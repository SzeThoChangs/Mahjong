/* A small Markdown parser and renderer for the project interface.
 *
 * It covers what the canonical files use: ATX headings, paragraphs, ordered and unordered lists
 * with wrapped continuation lines and nesting by indent, pipe tables, fenced code, block quotes,
 * horizontal rules, and inline code, bold, italic, links and bare URLs. It does not try to be a
 * full CommonMark implementation. Where a construct is not covered, the text is shown as it was
 * written rather than dropped.
 *
 * The renderer takes hooks so that the interface can turn IDs into links and evidence words into
 * chips without the parser knowing about either:
 *   ctx.text(str)              plain text run -> HTML (must escape)
 *   ctx.code(str)              inline code span -> HTML (must escape)
 *   ctx.link(href, innerHtml)  a Markdown link -> HTML
 */
const MD = (() => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const slug = (s) => String(s).toLowerCase()
    .replace(/`/g, '').replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-+|-+$/g, '') || 'section';

  const RE_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
  const RE_FENCE = /^(```+|~~~+)\s*(\S*)\s*$/;
  const RE_HR = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
  const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const cells = []; let cur = ''; let inCode = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '`') inCode = !inCode;
      if (ch === '|' && !inCode && s[i - 1] !== '\\') { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells.map((c) => c.replace(/\\\|/g, '|'));
  }

  /** Parse Markdown text into an array of blocks. */
  function parse(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    return parseLines(lines);
  }

  function parseLines(lines) {
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      let m = RE_FENCE.exec(line);
      if (m) {
        const fence = m[1]; const lang = m[2]; const buf = [];
        i++;
        while (i < lines.length && !lines[i].startsWith(fence)) { buf.push(lines[i]); i++; }
        i++; // closing fence
        blocks.push({ type: 'code', lang, text: buf.join('\n') });
        continue;
      }
      m = RE_HEADING.exec(line);
      if (m) { blocks.push({ type: 'heading', level: m[1].length, text: m[2], id: slug(m[2]) }); i++; continue; }
      if (RE_HR.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }

      if (line.trim().startsWith('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1])) {
        const header = splitRow(line); i += 2; const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i++; }
        blocks.push({ type: 'table', header, rows });
        continue;
      }
      if (line.trimStart().startsWith('>')) {
        const buf = [];
        while (i < lines.length && lines[i].trimStart().startsWith('>')) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        blocks.push({ type: 'quote', blocks: parseLines(buf) });
        continue;
      }
      m = RE_ITEM.exec(line);
      if (m) {
        const list = { type: 'list', ordered: /\d/.test(m[2]), start: parseInt(m[2], 10) || 1, items: [] };
        const baseIndent = m[1].length;
        while (i < lines.length) {
          const im = RE_ITEM.exec(lines[i]);
          if (!im || im[1].length !== baseIndent) break;
          const contentIndent = baseIndent + im[2].length + 1;
          const buf = [im[3]];
          i++;
          while (i < lines.length) {
            const l = lines[i];
            if (!l.trim()) {
              // a blank line ends the item unless the next non-blank line is indented under it
              let j = i; while (j < lines.length && !lines[j].trim()) j++;
              if (j < lines.length && /^\s+/.test(lines[j]) && lines[j].search(/\S/) >= contentIndent - 1) { buf.push(''); i++; continue; }
              break;
            }
            const indent = l.search(/\S/);
            const nm = RE_ITEM.exec(l);
            if (nm && nm[1].length <= baseIndent) break;          // a sibling or parent item
            if (indent >= contentIndent - 1 || (!nm && indent > baseIndent) || (!nm && !RE_HEADING.test(l) && !RE_FENCE.test(l) && !l.trim().startsWith('|') && indent === 0 && !RE_HR.test(l))) {
              // wrapped continuation (lazy or indented) or a nested block
              buf.push(l.length > contentIndent ? l.slice(Math.min(contentIndent, indent)) : l.trim());
              i++; continue;
            }
            break;
          }
          list.items.push({ blocks: parseLines(buf) });
        }
        blocks.push(list);
        continue;
      }
      // paragraph: run of non-blank lines that do not start another block
      const buf = [line];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim() || RE_HEADING.test(l) || RE_FENCE.test(l) || RE_HR.test(l) || RE_ITEM.test(l) || l.trimStart().startsWith('>') || (l.trim().startsWith('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]))) break;
        buf.push(l); i++;
      }
      blocks.push({ type: 'para', text: buf.join('\n') });
    }
    return blocks;
  }

  // ---- inline -----------------------------------------------------------------------------
  const RE_INLINE = new RegExp([
    '(`+)([\\s\\S]*?[^`])\\1(?!`)',                            // 1,2 code span
    '\\[([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+"[^"]*")?\\)',           // 3,4 link
    '(\\*\\*|__)(?=\\S)([\\s\\S]*?\\S)\\5',                     // 5,6 bold
    '(?<![A-Za-z0-9*])(\\*|_)(?=[^\\s*_])([^*_\\n]*?[^\\s*_])\\7(?![A-Za-z0-9])', // 7,8 italic
    '<?(https?:\\/\\/[^\\s<>)\\]]+[^\\s<>)\\].,;:])>?',        // 9 bare URL
  ].join('|'), 'g');

  function inline(s, ctx) {
    let out = ''; let last = 0; let m;
    const re = new RegExp(RE_INLINE.source, 'g');   // a fresh regex: the function recurses
    const src = String(s);
    while ((m = re.exec(src))) {
      out += ctx.text(src.slice(last, m.index));
      if (m[2] !== undefined) out += ctx.code(m[2].trim());
      else if (m[4] !== undefined) out += ctx.link(m[4], inline(m[3], ctx));
      else if (m[6] !== undefined) out += '<strong>' + inline(m[6], ctx) + '</strong>';
      else if (m[8] !== undefined) out += '<em>' + inline(m[8], ctx) + '</em>';
      else if (m[9] !== undefined) out += ctx.link(m[9], esc(m[9]));
      last = m.index + m[0].length;
    }
    out += ctx.text(src.slice(last));
    return out;
  }

  const defaultCtx = { text: esc, code: (s) => '<code>' + esc(s) + '</code>', link: (h, inner) => '<a href="' + esc(h) + '">' + inner + '</a>' };

  function render(blocks, ctx = defaultCtx, opts = {}) {
    const c = Object.assign({}, defaultCtx, ctx);
    return blocks.map((b) => renderBlock(b, c, opts)).join('\n');
  }

  function renderBlock(b, c, opts) {
    switch (b.type) {
      case 'heading': {
        const lvl = Math.min(6, b.level + (opts.shift || 0));
        return `<h${lvl} id="${esc(opts.idPrefix ? opts.idPrefix + b.id : b.id)}">${inline(b.text, c)}</h${lvl}>`;
      }
      case 'para': return `<p>${inline(b.text.replace(/\n/g, ' '), c)}</p>`;
      case 'hr': return '<hr>';
      case 'code': {
        if (opts.codeBlock) { const r = opts.codeBlock(b); if (r != null) return r; }
        return `<pre class="code${b.lang ? ' lang-' + esc(b.lang) : ''}"><code>${esc(b.text)}</code></pre>`;
      }
      case 'quote': return `<blockquote>${render(b.blocks, c, opts)}</blockquote>`;
      case 'table': {
        const th = b.header.map((h) => `<th>${inline(h, c)}</th>`).join('');
        const rows = b.rows.map((r) => '<tr>' + b.header.map((_, i) => `<td>${inline(r[i] || '', c)}</td>`).join('') + '</tr>').join('');
        return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
        const items = b.items.map((it) => {
          const [first, ...rest] = it.blocks;
          let html = '';
          if (first && first.type === 'para') html += inline(first.text.replace(/\n/g, ' '), c);
          else if (first) html += renderBlock(first, c, opts);
          if (rest.length) html += rest.map((r) => renderBlock(r, c, opts)).join('');
          return `<li>${html}</li>`;
        }).join('');
        return `<${tag}${start}>${items}</${tag}>`;
      }
      default: return '';
    }
  }

  /** Plain text of a block (for summaries and matching), without Markdown marks. */
  function plain(b) {
    if (!b) return '';
    if (b.type === 'para' || b.type === 'heading') return String(b.text).replace(/\n/g, ' ').replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    if (b.type === 'list') return b.items.map((it) => it.blocks.map(plain).join(' ')).join(' ');
    if (b.type === 'table') return b.rows.map((r) => r.join(' ')).join(' ');
    if (b.type === 'quote') return b.blocks.map(plain).join(' ');
    if (b.type === 'code') return b.text;
    return '';
  }

  /** Group blocks into a tree of sections by heading level. */
  function sections(blocks, level = 2) {
    const out = []; let cur = { heading: null, blocks: [] }; const pre = cur;
    for (const b of blocks) {
      if (b.type === 'heading' && b.level <= level) { cur = { heading: b, blocks: [] }; out.push(cur); }
      else cur.blocks.push(b);
    }
    for (const s of out) s.children = sections(s.blocks.filter((b) => !(b.type === 'heading' && b.level <= level)), level + 1);
    return { preamble: pre.blocks, sections: out };
  }

  /** Extract `**Field:** value` paragraphs into a map, in order. Multi-line values are kept. */
  function fields(blocks) {
    const map = {}; const order = [];
    for (const b of blocks) {
      if (b.type !== 'para') continue;
      const m = /^\*\*([^*]+?):\*\*\s*([\s\S]*)$/.exec(b.text);
      if (m) { const k = m[1].trim(); map[k] = m[2].replace(/\n/g, ' ').trim(); order.push(k); }
    }
    return { map, order };
  }

  return { parse, render, inline, sections, fields, plain, esc, slug };
})();
