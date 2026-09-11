/* The project interface. Derived from the canonical Markdown files at load time; writes nothing.
 * If this page and the files disagree, the files are right.
 */
(() => {
  const ROOT = '../';                       // the project root, relative to project-view/
  const esc = MD.esc;
  const $ = (sel, el = document) => el.querySelector(sel);

  // ---- the canonical files and their views ----------------------------------------------------
  const FILES = [
    { key: 'project',    file: 'PROJECT.md',       label: 'Project',       role: 'overview' },
    { key: 'users',      file: 'USERS.md',         label: 'Users',         role: 'records', idLevel: 3 },
    { key: 'journeys',   file: 'USER-JOURNEYS.md', label: 'Journeys',      role: 'journeys' },
    { key: 'spec',       file: 'SPEC.md',          label: 'Specification', role: 'spec' },
    { key: 'features',   file: 'FEATURES.md',      label: 'Features',      role: 'features' },
    { key: 'workflows',  file: 'WORKFLOWS.md',     label: 'Workflows',     role: 'workflows' },
    { key: 'stories',    file: 'USER-STORIES.md',  label: 'Stories',       role: 'board' },
    { key: 'prototype',  file: 'PROTOTYPE.md',     label: 'Prototype',     role: 'prototype' },
    { key: 'research',   file: 'RESEARCH.md',      label: 'Research',      role: 'research' },
    { key: 'library',    file: null,               label: 'Library',       role: 'library' },
    { key: 'inputs',     file: 'INPUTS/README.md', label: 'Inputs',        role: 'inputs' },
    { key: 'open-items', file: 'OPEN-ITEMS.md',    label: 'Open items',    role: 'open-items' },
    { key: 'decisions',  file: 'DECISIONS.md',     label: 'Decisions',     role: 'decisions' },
    { key: 'plan',       file: 'PLAN.md',          label: 'Plan',          role: 'plan' },
    { key: 'status',     file: 'STATUS.md',        label: 'Status',        role: 'doc' },
    { key: 'next',       file: 'NEXT.md',          label: 'Next',          role: 'doc' },
    { key: 'changelog',  file: 'CHANGELOG.md',     label: 'Changelog',     role: 'changelog' },
  ];
  const byKey = Object.fromEntries(FILES.map((f) => [f.key, f]));
  const keyByFile = Object.fromEntries(FILES.filter((f) => f.file).map((f) => [f.file, f.key]));
  // other readable documents in the project root; linked only if they are actually there
  const EXTRA_DOCS = ['Framework - Mahjong.md', 'MOBILE.md', 'TABLE-VARIANTS.md', 'JARGON.md', 'RULES.md', 'README.md', 'CLAUDE.md', 'P-Starter.md', 'RESEARCH/README.md'];

  // ---- chips ----------------------------------------------------------------------------------
  const CHIP = {
    CONFIRMED: 'confirmed', OBSERVED: 'observed', ASSUMED: 'assumed', PROPOSED: 'proposed',
    UNRESOLVED: 'unresolved', CONFLICTING: 'conflicting', CONFLICT: 'conflicting',
    VERIFIED: 'verified', BUILT: 'built', 'NOT BUILT': 'notbuilt', 'IN PROGRESS': 'inprogress',
    'NOT STARTED': 'notbuilt', PARTIAL: 'partial', OPEN: 'open', RESOLVED: 'resolved', ACTIVE: 'active',
    SUPERSEDED: 'superseded', HISTORICAL: 'superseded', PLANNED: 'planned', FINDINGS: 'findings',
    ACCEPTED: 'accepted', REJECTED: 'rejected', STALE: 'stale', AGREED: 'agreed', TARGET: 'target',
    ESTIMATE: 'estimate', RELEASED: 'released', LIVE: 'live', 'AGENT-GATHERED': 'origin',
    'OWNER-SUPPLIED': 'origin', MIXED: 'origin', QUESTION: 'type', ASSUMPTION: 'type', DEPENDENCY: 'type', RISK: 'type',
  };
  const CHIP_RE = /(?<![A-Za-z0-9-])(CONFLICTING|CONFIRMED|OBSERVED|ASSUMED|PROPOSED|UNRESOLVED|CONFLICT|VERIFIED|NOT BUILT|BUILT|IN PROGRESS|NOT STARTED|PARTIAL|OPEN|RESOLVED|ACTIVE|SUPERSEDED|HISTORICAL|PLANNED|FINDINGS|ACCEPTED|REJECTED|STALE|AGREED|TARGET|ESTIMATE|RELEASED|LIVE|AGENT-GATHERED|OWNER-SUPPLIED|QUESTION|ASSUMPTION|DEPENDENCY|RISK)(?![A-Za-z0-9-])/g;
  const chip = (word) => `<span class="chip chip-${CHIP[word] || 'plain'}">${esc(word)}</span>`;
  const chipify = (escapedText) => escapedText.replace(CHIP_RE, (m) => chip(m));
  function firstState(text, allowed) {
    const re = new RegExp(CHIP_RE.source, 'g'); let m;
    while ((m = re.exec(String(text || '')))) if (!allowed || allowed.includes(m[1])) return m[1];
    return null;
  }

  // ---- state ----------------------------------------------------------------------------------
  const S = { docs: {}, errors: {}, index: {}, manifest: null, extras: new Set(), loadedAt: null, prototypeBase: null };

  function prototypeBase() {
    if (S.prototypeBase) return S.prototypeBase;
    let v = new URLSearchParams(location.search).get('prototype');
    try { if (v) localStorage.setItem('project-view.prototypeUrl', v); else v = localStorage.getItem('project-view.prototypeUrl'); } catch (e) { /* storage may be unavailable */ }
    S.prototypeBase = (v || ROOT + 'prototype/').replace(/\/?$/, '/');
    return S.prototypeBase;
  }

  // ---- loading --------------------------------------------------------------------------------
  async function fetchText(path) {
    const r = await fetch(ROOT + path.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }
  async function exists(path) {
    try { const r = await fetch(ROOT + path.split('/').map(encodeURIComponent).join('/'), { method: 'HEAD', cache: 'no-store' }); return r.ok; } catch (e) { return false; }
  }

  async function loadAll() {
    const jobs = FILES.filter((f) => f.file).map(async (f) => {
      try { S.docs[f.key] = MD.parse(await fetchText(f.file)); }
      catch (e) { S.errors[f.key] = e.message; }
    });
    jobs.push((async () => {
      try { S.manifest = JSON.parse(await fetchText('RESEARCH/manifest.json')); }
      catch (e) { S.errors.manifest = e.message; }
    })());
    jobs.push(...EXTRA_DOCS.map(async (p) => { if (await exists(p)) S.extras.add(p); }));
    await Promise.all(jobs);
    S.loadedAt = new Date();
    buildIndex();
  }

  // ---- the ID index ---------------------------------------------------------------------------
  const RE_RECORD = /^([A-Z]{1,3}-\d{3})\s+[—–-]\s+(.*)$/;
  const RE_ID = /(?<![A-Za-z0-9-])(UJ|US|WF|DEP|RS|FR|BR|F|U|D|Q|A|C|R)-(\d{2,3})(?![A-Za-z0-9-])/g;

  function buildIndex() {
    S.index = {};
    for (const f of FILES) {
      const blocks = S.docs[f.key]; if (!blocks) continue;
      for (const b of blocks) {
        if (b.type !== 'heading') continue;
        const m = RE_RECORD.exec(b.text);
        if (m) S.index[m[1]] = { key: f.key, id: m[1], title: m[2], anchor: m[1] };
      }
    }
    // FR-nn and BR-nn live as bullets in SPEC.md
    const spec = S.docs.spec || [];
    for (const b of spec) {
      if (b.type !== 'list') continue;
      for (const it of b.items) {
        const t = MD.plain(it.blocks[0]); const m = /^((?:FR|BR)-\d{2})\.\s*(.*?)(?:\.|$)/.exec(t);
        if (m) S.index[m[1]] = { key: 'spec', id: m[1], title: m[2].slice(0, 80), anchor: m[1] };
      }
    }
  }

  // ---- link resolution ------------------------------------------------------------------------
  function manifestFiles() { return (S.manifest && S.manifest.files) || []; }
  function manifestHit(name) {
    const files = manifestFiles();
    let hit = files.find((f) => f.path === name);
    if (!hit) { const base = name.split('/').pop(); const c = files.filter((f) => f.path.split('/').pop() === base); if (c.length === 1) hit = c[0]; }
    return hit;
  }
  /** Where does a file mention go? A route hash, or null to leave the text alone. */
  function fileHref(name, fromDir) {
    let n = String(name).trim();
    if (/^https?:/.test(n)) return n;
    if (fromDir != null) n = normalisePath(fromDir, n);
    if (n.startsWith('../')) return null;                   // outside the project; cannot be fetched
    if (keyByFile[n]) return '#/' + keyByFile[n];
    if (n === 'RESEARCH/manifest.json') return '#/library';
    if (/^INPUTS\/.+/.test(n)) return '#/inputs/' + encodeURIComponent(n.slice(7));
    const hit = manifestHit(n);
    if (hit) return '#/library/' + hit.path.split('/').map(encodeURIComponent).join('/');
    if (S.extras.has(n)) return '#/doc/' + encodeURIComponent(n);
    if (n.endsWith('/') && manifestFiles().some((f) => f.path.startsWith(n))) return '#/library';
    return null;
  }
  function normalisePath(fromDir, rel) {
    const parts = (fromDir ? fromDir.split('/').filter(Boolean) : []);
    for (const p of rel.split('/')) {
      if (p === '..') { if (parts.length) parts.pop(); else return '../' + rel; }
      else if (p && p !== '.') parts.push(p);
    }
    return parts.join('/') + (rel.endsWith('/') ? '/' : '');
  }
  const idHref = (id) => (S.index[id] ? `#/${S.index[id].key}/${id}` : null);
  const linkIds = (escaped) => escaped.replace(RE_ID, (m) => (idHref(m) ? `<a class="ref" href="${idHref(m)}" title="${esc(S.index[m].title)}">${m}</a>` : m));

  const RE_FILE_IN_TEXT = /((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9 _-]+\.md)(?![\w-])/g;

  /** Turn file names in a text run into links. A capitalised word before a name would be swept
   *  into the match, so the candidate is shortened word by word until a known file is found. */
  function linkFiles(escaped, fromDir, keep) {
    return escaped.replace(RE_FILE_IN_TEXT, (m) => {
      const words = m.split(' ');
      for (let i = 0; i < words.length; i++) {
        const cand = words.slice(i).join(' ');
        if (!/^[A-Za-z0-9_./-]/.test(cand) || cand.startsWith('-')) continue;
        const href = fileHref(cand, fromDir);
        if (href) { keep.push(`<a class="ref file" href="${esc(href)}">${cand}</a>`); return words.slice(0, i).join(' ') + (i ? ' ' : '') + ` ${keep.length - 1} `; }
      }
      return m;
    });
  }

  /** The render context: chips, ID links and file links, applied to text runs and code spans. */
  function ctx(opts = {}) {
    const fromDir = opts.fromDir;
    return {
      text: (s) => {
        const keep = [];
        let h = linkFiles(esc(s), fromDir, keep);
        h = linkIds(chipify(h));
        return h.replace(/ (\d+) /g, (_, i) => keep[+i]);
      },
      code: (s) => {
        if (/^(UJ|US|WF|DEP|RS|FR|BR|F|U|D|Q|A|C|R)-\d{2,3}$/.test(s) && idHref(s)) return `<a class="ref" href="${idHref(s)}"><code>${esc(s)}</code></a>`;
        const href = fileHref(s.replace(/[§,;:].*$/, '').trim(), fromDir);
        if (href && /\.(md|json)$|\/$/.test(s.trim())) return `<a class="ref file" href="${esc(href)}"><code>${esc(s)}</code></a>`;
        if (/^prototype\/app\.html#[a-z]+/.test(s)) return `<a class="ref proto" href="${esc(prototypeBase() + s.replace(/^prototype\//, ''))}" target="_blank" rel="noopener"><code>${esc(s)}</code></a>`;
        return `<code>${esc(s)}</code>`;
      },
      link: (href, inner) => {
        if (/^#/.test(href)) return `<a class="in-doc" data-scroll="${esc(href.slice(1))}" href="javascript:void 0">${inner}</a>`;
        const r = fileHref(href, fromDir);
        if (r) return `<a class="ref file" href="${esc(r)}">${inner}</a>`;
        if (/^https?:/.test(href)) return `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`;
        return `<span class="deadref" title="Not resolvable from here: ${esc(href)}">${inner}</span>`;
      },
    };
  }
  function render(blocks, opts = {}) {
    // headings get unique ids per render, so a repeated heading still has its own anchor
    const seen = {};
    for (const b of blocks) if (b.type === 'heading') { const base = MD.slug(b.text); seen[base] = (seen[base] || 0) + 1; b.id = seen[base] > 1 ? `${base}-${seen[base]}` : base; }
    return MD.render(blocks, ctx(opts), Object.assign({ codeBlock: (b) => (b.lang === 'mermaid' ? renderMermaid(b.text) : null) }, opts));
  }
  const inline = (text, opts = {}) => MD.inline(String(text || ''), ctx(opts));

  // ---- helpers over a parsed file -------------------------------------------------------------
  /** The template preamble (before the first `---`) and the body after it. */
  function splitTemplate(blocks) {
    const i = blocks.findIndex((b) => b.type === 'hr');
    if (i < 0) return { pre: [], body: blocks };
    return { pre: blocks.slice(0, i), body: blocks.slice(i + 1) };
  }
  function answers(blocks) {
    const s = MD.sections(blocks, 2).sections.find((x) => x.heading && /^it answers/i.test(x.heading.text));
    return s ? s.blocks.filter((b) => b.type === 'para').map(MD.plain).join(' ') : '';
  }
  /** Records: sections whose heading is `ID — Title`, at level 2 or 3. */
  function records(blocks, level = 2) {
    const out = []; let cur = null;
    for (const b of blocks) {
      if (b.type === 'heading' && b.level <= level) {
        const m = RE_RECORD.exec(b.text);
        cur = m ? { id: m[1], title: m[2], heading: b, blocks: [] } : null;
        if (cur) out.push(cur);
        continue;
      }
      if (cur) cur.blocks.push(b);
    }
    for (const r of out) {
      const subs = MD.sections(r.blocks, level + 1);
      r.pre = subs.preamble; r.subs = subs.sections;
      r.fields = MD.fields(r.pre).map;
      for (const s of r.subs) s.fields = MD.fields(s.blocks).map;
    }
    return out;
  }
  const sub = (r, name) => r.subs.find((s) => s.heading && s.heading.text.toLowerCase().startsWith(name.toLowerCase()));
  function firstTable(blocks) { return blocks.find((b) => b.type === 'table'); }
  function tableOf(blocks, headingText) {
    const s = MD.sections(blocks, 2).sections.find((x) => x.heading && x.heading.text.toLowerCase().includes(headingText.toLowerCase()));
    return s ? firstTable(s.blocks) : null;
  }
  const fieldHtml = (r, name) => (r.fields[name] ? inline(r.fields[name]) : '');
  const oneLine = (text, n = 180) => { const t = String(text || '').replace(/\s+/g, ' '); return t.length > n ? t.slice(0, n).replace(/\s\S*$/, '') + '…' : t; };

  // ---- shared page pieces ----------------------------------------------------------------------
  function aboutFile(f, pre) {
    if (!pre || !pre.length) return '';
    return `<details class="about"><summary>About <code>${esc(f.file)}</code></summary>${render(pre)}</details>`;
  }
  function pageHeader(f, blocks, extra = '') {
    const a = f.file ? answers(blocks) : '';
    return `<header class="page-head"><div><p class="crumb"><code>${esc(f.file || 'RESEARCH/')}</code></p><h1>${esc(f.label)}</h1>${a ? `<p class="answers">${inline(a)}</p>` : ''}</div>${extra}</header>`;
  }
  function fileError(f) {
    return `<div class="page">${pageHeader(f, [])}<div class="error">Could not read <code>${esc(f.file)}</code>: ${esc(S.errors[f.key])}. The file is the source of truth; this page has nothing to show without it.</div></div>`;
  }
  function fieldRows(fields, names, opts = {}) {
    return names.filter((n) => fields[n]).map((n) => `<div class="field"><dt>${esc(n)}</dt><dd>${inline(fields[n], opts)}</dd></div>`).join('');
  }
  function allFields(fields, skip = []) {
    return Object.keys(fields).filter((k) => !skip.includes(k) && fields[k]).map((n) => `<div class="field"><dt>${esc(n)}</dt><dd>${inline(fields[n])}</dd></div>`).join('');
  }
  const plainTitle = (t) => esc(MD.plain({ type: 'para', text: t }));
  const statusChip = (text, allowed) => { const s = firstState(text, allowed); return s ? chip(s) : ''; };

  // ---- Mermaid flowcharts (a small subset, drawn as SVG; source kept beside it) ------------------
  function renderMermaid(src) {
    const fallback = `<details class="diagram-src"><summary>Diagram source (Mermaid)</summary><pre class="code"><code>${esc(src)}</code></pre></details>`;
    try {
      const svg = flowchartSvg(src);
      return svg ? `<figure class="diagram">${svg}<figcaption>Drawn from the journey's Mermaid diagram. The written journey is canonical; if they disagree, the prose is right.</figcaption>${fallback}</figure>` : fallback;
    } catch (e) { return fallback; }
  }
  function flowchartSvg(src) {
    const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
    const head = /^(flowchart|graph)\s+(LR|TD|TB|RL)?/.exec(lines[0] || '');
    if (!head) return null;
    const dir = head[2] || 'TD';
    const nodes = new Map(); const edges = [];
    const nodeRe = /^([A-Za-z0-9_]+)\s*(\[([^\]]*)\]|\{([^}]*)\}|\(\(([^)]*)\)\)|\(([^)]*)\))?/;
    const addNode = (id, label, shape) => { if (!nodes.has(id)) nodes.set(id, { id, label: label || id, shape: shape || 'box' }); else if (label) { const n = nodes.get(id); n.label = label; n.shape = shape || n.shape; } };
    for (const line of lines.slice(1)) {
      if (/^(%%|classDef|class |style |subgraph|end$|linkStyle)/.test(line)) continue;
      const parts = line.split(/\s*-->\s*/);
      if (parts.length === 1) {
        const m = nodeRe.exec(line); if (!m) return null;
        addNode(m[1], m[3] || m[4] || m[5] || m[6], m[4] ? 'diamond' : m[5] ? 'circle' : m[6] ? 'round' : 'box');
        continue;
      }
      let prev = null;
      for (let p of parts) {
        let label = null; const lm = /^\|([^|]*)\|\s*(.*)$/.exec(p); if (lm) { label = lm[1].trim(); p = lm[2]; }
        const m = nodeRe.exec(p.trim()); if (!m) return null;
        addNode(m[1], m[3] || m[4] || m[5] || m[6], m[4] ? 'diamond' : m[5] ? 'circle' : m[6] ? 'round' : 'box');
        if (prev) edges.push({ from: prev, to: m[1], label });
        prev = m[1];
      }
    }
    if (!nodes.size) return null;
    // rank by longest path from a source, ignoring back edges (a loop in the journey)
    const ids = [...nodes.keys()]; const rank = Object.fromEntries(ids.map((i) => [i, 0]));
    const visited = new Set(), onStack = new Set(), back = new Set();
    const dfs = (u) => { visited.add(u); onStack.add(u); for (const e of edges) if (e.from === u) { if (onStack.has(e.to)) back.add(e); else if (!visited.has(e.to)) dfs(e.to); } onStack.delete(u); };
    ids.forEach((i) => { if (!visited.has(i)) dfs(i); });
    const forward = edges.filter((e) => !back.has(e));
    for (let iter = 0; iter < ids.length + 2; iter++) {
      let changed = false;
      for (const e of forward) if (rank[e.to] < rank[e.from] + 1) { rank[e.to] = rank[e.from] + 1; changed = true; }
      if (!changed) break;
    }
    const cols = []; ids.forEach((i) => { (cols[rank[i]] = cols[rank[i]] || []).push(i); });
    const W = 168, PAD = 10, LH = 17, GAPX = 64, GAPY = 22;
    const wrap = (t) => { const words = t.split(/\s+/); const ls = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > 22 && cur) { ls.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) ls.push(cur); return ls; };
    const geo = {};
    for (const n of nodes.values()) { n.lines = wrap(n.label); n.h = n.lines.length * LH + PAD * 2 + (n.shape === 'diamond' ? 18 : 0); }
    // A rank with no node leaves a hole in this sparse array, and a hole spread into Math.max is
    // undefined, which makes every coordinate downstream NaN. Fill the holes rather than guarding
    // each sum: a diagram whose ranks are not contiguous is normal when a journey loops back.
    for (let i = 0; i < cols.length; i++) if (!cols[i]) cols[i] = [];
    const colH = cols.map((c) => c.reduce((a, i) => a + nodes.get(i).h + GAPY, -GAPY));
    const totalH = Math.max(0, ...colH);
    cols.forEach((c, ci) => { let y = (totalH - colH[ci]) / 2; for (const i of c) { const n = nodes.get(i); geo[i] = { x: ci * (W + GAPX), y, w: W, h: n.h }; y += n.h + GAPY; } });
    const LR = dir === 'LR' || dir === 'RL';
    const totalW = cols.length * (W + GAPX) - GAPX;
    const px = (g) => (LR ? g : { x: g.y, y: g.x, w: g.h, h: g.w });
    let svgNodes = '', svgEdges = '';
    for (const n of nodes.values()) {
      const g = px(geo[n.id]); const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
      const shape = n.shape === 'diamond'
        ? `<polygon points="${cx},${g.y} ${g.x + g.w},${cy} ${cx},${g.y + g.h} ${g.x},${cy}" class="dg-diamond"/>`
        : `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="${n.shape === 'round' ? 14 : 4}" class="dg-box"/>`;
      const t0 = cy - ((n.lines.length - 1) * LH) / 2;
      const text = n.lines.map((l, i) => `<tspan x="${cx}" y="${t0 + i * LH}">${esc(l)}</tspan>`).join('');
      svgNodes += `<g>${shape}<text class="dg-text" text-anchor="middle" dominant-baseline="middle">${text}</text></g>`;
    }
    for (const e of edges) {
      if (!geo[e.from] || !geo[e.to]) continue;      // an edge to something the parser never placed
      const a = px(geo[e.from]), b = px(geo[e.to]);
      let d, mx, my;
      if (LR) {
        const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
        if (x2 > x1) { const c = (x2 - x1) / 2; d = `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`; mx = (x1 + x2) / 2; my = (y1 + y2) / 2; }
        else { const top = Math.min(a.y, b.y) - 18; d = `M${a.x + a.w / 2},${a.y} C${a.x + a.w / 2},${top} ${b.x + b.w / 2},${top} ${b.x + b.w / 2},${b.y}`; mx = (a.x + b.x + (a.w + b.w) / 2) / 2; my = top + 4; }
      } else {
        const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
        if (y2 > y1) { const c = (y2 - y1) / 2; d = `M${x1},${y1} C${x1},${y1 + c} ${x2},${y2 - c} ${x2},${y2}`; mx = (x1 + x2) / 2; my = (y1 + y2) / 2; }
        else { const left = Math.min(a.x, b.x) - 18; d = `M${a.x},${a.y + a.h / 2} C${left},${a.y + a.h / 2} ${left},${b.y + b.h / 2} ${b.x},${b.y + b.h / 2}`; mx = left + 4; my = (a.y + b.y) / 2; }
      }
      svgEdges += `<path d="${d}" class="dg-edge" marker-end="url(#dg-arrow)"/>`;
      if (e.label) svgEdges += `<text x="${mx}" y="${my - 5}" class="dg-label" text-anchor="middle">${esc(e.label)}</text>`;
    }
    const vw = LR ? totalW : totalH, vh = LR ? totalH : totalW;
    return `<svg viewBox="-24 -24 ${vw + 48} ${vh + 48}" width="${vw + 48}" class="flowchart" role="img" aria-label="Journey diagram"><defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="dg-arrowhead"/></marker></defs>${svgEdges}${svgNodes}</svg>`;
  }

  // ---- the front page --------------------------------------------------------------------------
  function frontPage() {
    const proj = S.docs.project, status = S.docs.status, next = S.docs.next;
    let html = '<div class="page front">';
    if (proj) {
      const secs = MD.sections(splitTemplate(proj).body, 2).sections;
      const projSec = secs.find((s) => s.heading && s.heading.text === 'Project');
      const h3 = projSec ? MD.sections(projSec.blocks, 3).sections : [];
      const get = (name) => h3.find((s) => s.heading && s.heading.text.toLowerCase().startsWith(name.toLowerCase()));
      const name = get('Name'), purpose = get('Purpose'), phase = get('Current Lifecycle Phase'), problem = get('Problem');
      const phaseWord = phase ? firstState(MD.plain(phase.blocks[0]), ['LIVE', 'RELEASED', 'VERIFIED', 'BUILT', 'IN PROGRESS', 'PLANNED', 'NOT STARTED']) : null;
      html += `<section class="hero"><p class="crumb">From <a href="#/project">PROJECT.md</a></p>
        <h1>${name ? inline(oneLine(MD.plain(name.blocks[0]), 90).replace(/\..*$/, '')) : 'Project'} ${phaseWord ? `<span class="chip chip-live big">${esc(phaseWord)}</span>` : ''}</h1>
        ${purpose ? `<p class="lede">${inline(MD.plain(purpose.blocks[0]))}</p>` : ''}
        ${problem ? `<details class="more"><summary>The problem</summary>${render(problem.blocks)}</details>` : ''}
        ${phase ? `<details class="more"><summary>Lifecycle phase, in full</summary>${render(phase.blocks)}</details>` : ''}
      </section>`;
    } else html += `<div class="error">PROJECT.md could not be read: ${esc(S.errors.project || '')}</div>`;

    html += '<div class="front-grid">';
    if (status) {
      const secs = MD.sections(splitTemplate(status).body, 2).sections;
      const get = (n) => secs.find((s) => s.heading && s.heading.text.toLowerCase().startsWith(n.toLowerCase()));
      const part = (n, cls = '') => { const s = get(n); return s ? `<div class="panel-sec ${cls}"><h3>${esc(s.heading.text)}</h3>${render(s.blocks)}</div>` : ''; };
      const lu = get('Last Updated');
      html += `<section class="panel status"><header><h2>Where we are</h2><a class="crumb" href="#/status">STATUS.md${lu ? ' · ' + esc(MD.plain(lu.blocks[0])) : ''}</a></header>
        ${part('Current Phase')}${part('Current Focus')}${part('In Progress')}${part('Needs Attention')}${part('Next Actions')}${part('Next Milestone')}${part('Blocked')}
        <p class="more-link"><a href="#/status">Verified, recently completed and the rest →</a></p></section>`;
    } else html += `<section class="panel status"><div class="error">STATUS.md could not be read: ${esc(S.errors.status || '')}</div></section>`;

    if (next) {
      const body = splitTemplate(next).body.length ? splitTemplate(next).body : next;
      const secs = MD.sections(body, 2).sections;
      const get = (n) => secs.find((s) => s.heading && s.heading.text.toLowerCase().startsWith(n.toLowerCase()));
      const lu = get('Last Updated');
      const wanted = ['Where We Stopped', 'Recommended Next Action', 'Owner Input Required', 'Blockers', 'After That'].map(get).filter(Boolean);
      const shown = wanted.length ? wanted : secs.filter((s) => s.heading && !/last updated/i.test(s.heading.text)).slice(0, 3);
      html += `<section class="panel next"><header><h2>Where we left off</h2><a class="crumb" href="#/next">NEXT.md${lu ? ' · ' + esc(MD.plain(lu.blocks[0])) : ''}</a></header>
        ${shown.map((s) => `<div class="panel-sec"><h3>${inline(s.heading.text)}</h3>${render(s.blocks)}</div>`).join('')}
        <p class="more-link"><a href="#/next">The whole handoff →</a></p></section>`;
    } else html += `<section class="panel next"><div class="error">NEXT.md could not be read: ${esc(S.errors.next || '')}</div></section>`;
    html += '</div>';

    if (proj) {
      const t = tableOf(splitTemplate(proj).body, 'Operational Information');
      const ops = MD.sections(splitTemplate(proj).body, 2).sections.find((s) => s.heading && s.heading.text.startsWith('Operational'));
      const ms = ops ? MD.sections(ops.blocks, 3).sections.find((s) => s.heading && s.heading.text === 'Milestones') : null;
      if (ms) html += `<section class="panel wide"><header><h2>Milestones</h2><a class="crumb" href="#/project">PROJECT.md</a></header>${render(ms.blocks)}</section>`;
    }

    // the map of files, with counts as navigation only
    html += '<section class="filemap"><h2>The project files</h2><div class="cards">';
    for (const f of FILES) {
      if (f.key === 'library') {
        const n = manifestFiles().length;
        html += `<a class="card nav" href="#/library"><h3>Library</h3><p>The research material itself: ${n} document${n === 1 ? '' : 's'} listed in the manifest. Findings, not requirements.</p></a>`;
        continue;
      }
      const blocks = S.docs[f.key];
      const a = blocks ? answers(blocks) : (S.errors[f.key] ? 'Could not be read.' : '');
      let counts = '';
      if (blocks && ['users', 'journeys', 'features', 'workflows', 'stories', 'open-items', 'decisions', 'research'].includes(f.key)) {
        const recs = records(splitTemplate(blocks).body, f.idLevel || 2);
        const tally = {};
        for (const r of recs) { const st = statusOf(f.key, r, blocks); tally[st || 'unlabelled'] = (tally[st || 'unlabelled'] || 0) + 1; }
        counts = f.key === 'journeys' ? `<p class="counts">${recs.length} journeys</p>` : `<p class="counts">${recs.length} records · ${Object.entries(tally).map(([k, v]) => `${v} ${k === 'unlabelled' ? '<span class="muted">unlabelled</span>' : chip(k)}`).join(' ')}</p>`;
      }
      html += `<a class="card nav ${S.errors[f.key] ? 'broken' : ''}" href="#/${f.key}"><h3>${esc(f.label)}</h3><p>${inline(a)}</p>${counts}</a>`;
    }
    html += '</div></section></div>';
    return html;
  }

  /** The status word of a record, from its Status field or the file's index table. */
  function statusOf(key, r, blocks) {
    const allowed = ['VERIFIED', 'BUILT', 'NOT BUILT', 'IN PROGRESS', 'PROPOSED', 'OPEN', 'RESOLVED', 'ACTIVE', 'SUPERSEDED', 'PLANNED', 'FINDINGS', 'ACCEPTED', 'REJECTED', 'STALE', 'PARTIAL', 'AGREED', 'NOT STARTED'];
    if (r.fields.Status) return firstState(r.fields.Status, allowed);
    if (r.fields['Lifecycle State']) return firstState(r.fields['Lifecycle State']);
    if (key === 'journeys') return null;   // a journey's status is a sentence, shown as one
    const t = indexRowFor(key, r.id, blocks);
    return t ? firstState(t.status, allowed) : null;
  }
  const indexCache = {};
  function indexRowFor(key, id, blocks) {
    if (!indexCache[key]) {
      const rows = {};
      for (const b of blocks) if (b.type === 'table' && b.header.length && /^id$/i.test(b.header[0])) {
        const si = b.header.findIndex((h) => /status/i.test(h));
        for (const r of b.rows) rows[r[0].replace(/`/g, '')] = { cells: r, header: b.header, status: si >= 0 ? r[si] : '' };
      }
      indexCache[key] = rows;
    }
    return indexCache[key][id];
  }

  // ---- generic pieces for record files ---------------------------------------------------------
  function indexTable(blocks) {
    const t = blocks.find((b) => b.type === 'table' && b.header.length && /^id$/i.test(b.header[0]));
    return t ? `<div class="index">${render([t])}</div>` : '';
  }
  function recordCard(f, r, { summary, facets, body, open = false, cls = '' }) {
    const st = statusOf(f.key, r, S.docs[f.key]);
    return `<details class="record ${cls} st-${(st || 'none').toLowerCase().replace(/\s+/g, '-')}" id="${esc(r.id)}" ${open ? 'open' : ''}>
      <summary><span class="rid">${esc(r.id)}</span><span class="rtitle">${inline(r.title)}</span>${st ? chip(st) : ''}${facets || ''}</summary>
      ${summary ? `<p class="rsummary">${summary}</p>` : ''}
      <div class="rbody">${body}</div>
      <p class="rfoot"><a href="#/${f.key}/${esc(r.id)}" class="permalink">#${esc(r.id)}</a> · in <code>${esc(f.file)}</code></p>
    </details>`;
  }
  function subsHtml(r, { skip = [], open = [] } = {}) {
    return r.subs.filter((s) => s.heading && !skip.some((k) => s.heading.text.toLowerCase().startsWith(k.toLowerCase()))).map((s) =>
      `<details class="subsec" ${open.some((k) => s.heading.text.toLowerCase().startsWith(k.toLowerCase())) ? 'open' : ''}><summary>${inline(s.heading.text)}</summary>${render(s.blocks)}</details>`).join('');
  }
  // ---- views ----------------------------------------------------------------------------------
  const introHtml = (secs) => (secs.length ? `<div class="doc intro">${render(secs.flatMap((s) => [s.heading, ...s.blocks]))}</div>` : '');
  function viewOverview(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    return `<div class="page doc-page">${pageHeader(f, blocks)}${aboutFile(f, pre)}<div class="doc-cols"><article class="doc">${render(body)}</article>${toc(body)}</div></div>`;
  }
  function viewDoc(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const hasTemplate = pre.some((b) => b.type === 'heading' && /purpose of this file/i.test(b.text));
    const content = hasTemplate ? body : blocks;
    return `<div class="page doc-page">${pageHeader(f, blocks)}${hasTemplate ? aboutFile(f, pre) : ''}<div class="doc-cols"><article class="doc">${render(content)}</article>${toc(content)}</div></div>`;
  }
  function toc(blocks, maxLevel = 3) {
    const hs = blocks.filter((b) => b.type === 'heading' && b.level <= maxLevel);
    if (hs.length < 3) return '';
    return `<nav class="toc"><p class="toc-title">On this page</p>${hs.map((h) => `<a class="lvl${h.level}" href="javascript:void 0" data-scroll="${esc(h.id)}">${esc(MD.plain(h))}</a>`).join('')}</nav>`;
  }

  function viewRecords(f) {   // USERS.md: role cards
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 3);
    const secs = MD.sections(body, 2).sections;
    const intro = MD.sections(body, 2).preamble.concat(...secs.filter((s) => s.heading && !/^users$/i.test(s.heading.text) && !/non-human/i.test(s.heading.text)).map((s) => [s.heading, ...s.blocks]));
    const actors = secs.find((s) => s.heading && /non-human/i.test(s.heading.text));
    const cards = recs.map((r) => recordCard(f, r, {
      open: true,
      facets: r.fields.Context ? '' : '',
      body: `<dl class="fields">${allFields(r.fields)}</dl>${subsHtml(r)}`,
    })).join('');
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}<div class="doc intro">${render(intro)}</div><div class="records">${cards}</div>${actors ? `<section class="doc"><h2>${esc(actors.heading.text)}</h2>${render(actors.blocks)}</section>` : ''}</div>`;
  }

  function viewJourneys(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 2);
    const intro = MD.sections(body, 2).sections.filter((s) => s.heading && !RE_RECORD.test(s.heading.text) && !/index/i.test(s.heading.text));
    const cards = recs.map((r) => {
      const stages = sub(r, 'Journey Stages');
      const diagram = sub(r, 'Journey Diagram');
      const stageSecs = stages ? MD.sections(stages.blocks, 4).sections : [];
      const stepper = stageSecs.length ? `<ol class="stepper">${stageSecs.map((s) => {
        const fl = MD.fields(s.blocks).map;
        return `<li><h4>${inline(s.heading.text.replace(/^\d+\.\s*/, ''))}</h4>${fl['What the user is trying to do'] ? `<p class="goal">${inline(fl['What the user is trying to do'])}</p>` : ''}<details><summary>What happens</summary><dl class="fields">${allFields(fl, ['What the user is trying to do'])}</dl></details></li>`;
      }).join('')}</ol>` : (stages ? render(stages.blocks) : '');
      const row = indexRowFor(f.key, r.id, blocks);
      const facets = `${r.fields['Primary User'] ? `<span class="facet">${inline(oneLine(r.fields['Primary User'], 40))}</span>` : ''}${row && row.status ? `<span class="facet status-text">${inline(row.status)}</span>` : ''}`;
      return recordCard(f, r, {
        facets,
        summary: r.fields.Goal ? inline(r.fields.Goal) : '',
        body: `<dl class="fields">${fieldRows(r.fields, ['Starting Situation', 'Trigger', 'Desired Outcome'])}</dl>
          ${render(r.pre.filter((b) => b.type === 'para' && !/^\*\*[^*]+:\*\*/.test(b.text)))}
          ${diagram ? render(diagram.blocks) : ''}
          ${stepper}
          ${subsHtml(r, { skip: ['Journey Stages', 'Journey Diagram'] })}`,
      });
    }).join('');
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${introHtml(intro)}${indexTable(body)}<div class="records">${cards}</div></div>`;
  }

  function viewSpec(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    // give FR-nn and BR-nn bullets anchors so cross-references land on them
    const html = render(body).replace(/<li>((?:<strong>)?(?:<a [^>]*>)?)((?:FR|BR)-\d{2})/g, (m, pre, id) => `<li id="${id}">${pre}${id}`);
    return `<div class="page doc-page">${pageHeader(f, blocks)}${aboutFile(f, pre)}<div class="doc-cols"><article class="doc spec">${html}</article>${toc(body)}</div></div>`;
  }

  /** The prototype route of a feature or workflow record, or null with the reason. */
  function routeOf(r) {
    const demo = sub(r, 'Prototype');
    const fl = demo ? demo.fields : {};
    const raw = fl['Prototype Route'] || '';
    const pstatus = firstState(fl['Prototype Status'] || '', ['BUILT', 'NOT BUILT', 'PARTIAL', 'PROPOSED']);
    const m = /^`prototype\/app\.html#([a-z]+)`(.*)$/s.exec(raw.trim());
    if (m && !/^\s*(none|no screen)/i.test(raw)) return { tab: m[1], note: m[2].trim(), pstatus, fields: fl, raw };
    return { tab: null, pstatus, fields: fl, raw };
  }
  function routeHtml(route) {
    if (!route.tab) return route.raw ? `<span class="noscreen">${inline(route.raw)}</span>` : '<span class="noscreen">No prototype route recorded</span>';
    return `<a class="btn proto" target="_blank" rel="noopener" href="${esc(prototypeBase() + 'app.html#' + route.tab)}">Open in the prototype ↗ <code>#${esc(route.tab)}</code></a>${route.note ? `<span class="route-note">${inline(route.note)}</span>` : ''}`;
  }

  function viewFeatures(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 2);
    const intro = MD.sections(body, 2).sections.filter((s) => s.heading && !RE_RECORD.test(s.heading.text) && !/index/i.test(s.heading.text));
    const groups = new Map();
    for (const r of recs) { const g = routeOf(r).fields['Demo Group'] || (statusOf(f.key, r, blocks) === 'PROPOSED' ? 'Proposed, not built' : 'Ungrouped'); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
    const map = `<section class="feature-map"><h2>Feature map</h2><p class="muted">Grouped by the demo group each record names. A chip shows the record's own status; nothing here is inferred from the prototype.</p><div class="groups">${[...groups.entries()].map(([g, rs]) => `<div class="group"><h3>${esc(g)}</h3>${rs.map((r) => { const st = statusOf(f.key, r, blocks); return `<a class="mini st-${(st || 'none').toLowerCase().replace(/\s+/g, '-')}" href="#/features/${r.id}"><span class="rid">${r.id}</span> ${plainTitle(r.title)} ${st ? chip(st) : ''}</a>`; }).join('')}</div>`).join('')}</div></section>`;
    const cards = recs.map((r) => {
      const route = routeOf(r);
      const facets = `${route.pstatus ? `<span class="facet">prototype ${chip(route.pstatus)}</span>` : ''}`;
      return recordCard(f, r, {
        facets,
        summary: r.fields.Purpose ? inline(r.fields.Purpose) : '',
        body: `<dl class="fields">${allFields(r.fields, ['Purpose', 'Status'])}${r.fields.Status ? `<div class="field"><dt>Status</dt><dd>${inline(r.fields.Status)}</dd></div>` : ''}</dl>
          <div class="demo"><h4>Prototype</h4>${routeHtml(route)}<dl class="fields">${allFields(route.fields, ['Prototype Route'])}</dl></div>
          ${subsHtml(r, { skip: ['Prototype'] })}`,
      });
    }).join('');
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${introHtml(intro)}${map}${indexTable(body)}<div class="records">${cards}</div></div>`;
  }

  function viewWorkflows(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 2);
    const intro = MD.sections(body, 2).sections.filter((s) => s.heading && !RE_RECORD.test(s.heading.text) && !/index/i.test(s.heading.text));
    const cards = recs.map((r) => {
      const route = routeOf(r); const flow = sub(r, 'Normal Flow');
      const row = indexRowFor(f.key, r.id, blocks);
      const facets = `${r.fields['Primary Actor'] ? `<span class="facet">${inline(oneLine(r.fields['Primary Actor'], 30))}</span>` : ''}${row && row.cells[3] ? `<span class="facet">${inline(row.cells[3])}</span>` : ''}${route.pstatus ? `<span class="facet">prototype ${chip(route.pstatus)}</span>` : ''}`;
      return recordCard(f, r, {
        facets,
        summary: r.fields.Trigger ? '<strong>Trigger:</strong> ' + inline(r.fields.Trigger) : '',
        body: `<dl class="fields">${fieldRows(r.fields, ['Other Actors', 'Preconditions'])}</dl>
          ${flow ? `<div class="flow"><h4>Normal flow</h4>${render(flow.blocks)}</div>` : ''}
          <dl class="fields">${allFields(r.fields, ['Primary Actor', 'Other Actors', 'Trigger', 'Preconditions'])}</dl>
          <div class="demo"><h4>Prototype</h4>${routeHtml(route)}<dl class="fields">${allFields(route.fields, ['Prototype Route'])}</dl></div>
          ${subsHtml(r, { skip: ['Prototype', 'Normal Flow'] })}`,
      });
    }).join('');
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${introHtml(intro)}${indexTable(body)}<div class="records">${cards}</div></div>`;
  }

  function viewBoard(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 2);
    const intro = MD.sections(body, 2).sections.filter((s) => s.heading && !RE_RECORD.test(s.heading.text) && !/index/i.test(s.heading.text));
    const order = ['PROPOSED', 'PLANNED', 'AGREED', 'IN PROGRESS', 'BUILT', 'VERIFIED', 'RELEASED'];
    const cols = new Map();
    for (const r of recs) { const st = statusOf(f.key, r, blocks) || 'No status'; if (!cols.has(st)) cols.set(st, []); cols.get(st).push(r); }
    const sorted = [...cols.entries()].sort((a, b) => (order.indexOf(a[0]) + 100) % 100 - (order.indexOf(b[0]) + 100) % 100);
    const board = `<section class="board"><h2>Story board</h2><p class="muted">Columns are the status each story records for itself. BUILT means the code exists; VERIFIED means the file names evidence.</p><div class="columns">${sorted.map(([st, rs]) => `<div class="column"><h3>${chip(st)} <span class="muted">${rs.length}</span></h3>${rs.map((r) => `<a class="mini" href="#/stories/${r.id}"><span class="rid">${r.id}</span> ${plainTitle(r.title)}${r.fields['Related Feature'] ? `<span class="muted"> · ${esc(oneLine(r.fields['Related Feature'], 20).replace(/[`.]/g, ''))}</span>` : ''}</a>`).join('')}</div>`).join('')}</div></section>`;
    const cards = recs.map((r) => recordCard(f, r, {
      summary: r.fields.Story ? inline(r.fields.Story) : '',
      body: `${render(r.pre.filter((b) => !(b.type === 'para' && /^\*\*Story:\*\*/.test(b.text))))}${subsHtml(r)}`,
    })).join('');
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${introHtml(intro)}${board}<div class="records">${cards}</div></div>`;
  }

  function viewPrototype(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const fl = MD.fields(body).map;
    const state = firstState(fl['Lifecycle State'] || '', ['ACTIVE', 'NOT STARTED', 'HISTORICAL']);
    const extra = `<div class="head-actions">${state ? `<p>Lifecycle ${chip(state)}${fl.Status ? ' · ' + inline(oneLine(fl.Status, 60)) : ''}</p>` : ''}<a class="btn proto" target="_blank" rel="noopener" href="${esc(prototypeBase())}">Open the prototype ↗</a></div>`;
    return `<div class="page doc-page">${pageHeader(f, blocks, extra)}${aboutFile(f, pre)}<div class="doc-cols"><article class="doc">${render(body)}</article>${toc(body)}</div></div>`;
  }

  function viewResearch(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 2);
    const secs = MD.sections(body, 2).sections;
    const register = secs.find((s) => s.heading && /^register/i.test(s.heading.text));
    const needed = secs.find((s) => s.heading && /research needed/i.test(s.heading.text));
    const cards = recs.map((r) => {
      const facets = `${r.fields.Origin ? `<span class="facet">${statusChip(r.fields.Origin, ['AGENT-GATHERED', 'OWNER-SUPPLIED', 'MIXED']) || inline(oneLine(r.fields.Origin, 20))}</span>` : ''}${r.fields['As of'] ? `<span class="facet">as of ${inline(oneLine(r.fields['As of'], 24))}</span>` : ''}`;
      return recordCard(f, r, {
        facets,
        summary: r.fields.Question ? inline(r.fields.Question) : '',
        body: `<dl class="fields">${allFields(r.fields, ['Question'])}</dl>${subsHtml(r, { open: ['Findings', 'Accepted'] })}`,
      });
    }).join('');
    const extra = `<div class="head-actions"><a class="btn" href="#/library">Read the material: the library →</a></div>`;
    return `<div class="page">${pageHeader(f, blocks, extra)}${aboutFile(f, pre)}
      ${register ? `<section class="doc"><h2>${esc(register.heading.text)}</h2>${render(register.blocks)}</section>` : ''}
      ${needed ? `<section class="doc"><h2>${esc(needed.heading.text)}</h2>${render(needed.blocks)}</section>` : ''}
      <div class="records">${cards}</div></div>`;
  }

  function viewLibrary(path) {
    const f = byKey.library;
    if (!S.manifest) return `<div class="page">${pageHeader(f, [])}<div class="error">Could not read <code>RESEARCH/manifest.json</code>: ${esc(S.errors.manifest || '')}. The manifest lists the material; without it this view cannot know what is in the folders.</div></div>`;
    const banner = `<div class="findings-banner"><strong>Findings, not requirements.</strong> Everything in this view is research material. Nothing here is a requirement, a protocol or a decision until it has been accepted into the definition files, which the <a href="#/research">register</a> records.</div>`;
    if (path) return libraryDoc(f, path, banner);
    const files = manifestFiles();
    const groups = new Map();
    for (const m of files) { const dir = m.path.includes('/') ? m.path.slice(0, m.path.lastIndexOf('/')) + '/' : '(project root)'; if (!groups.has(dir)) groups.set(dir, []); groups.get(dir).push(m); }
    const list = [...groups.entries()].map(([dir, ms]) => `<div class="group" id="folder-${esc(MD.slug(dir))}"><h3><code>${esc(dir)}</code></h3>${ms.map((m) => `<a class="mini kind-${esc(m.kind || 'file')}" href="#/library/${m.path.split('/').map(encodeURIComponent).join('/')}"><span class="rid">${esc(m.kind || '')}</span> ${plainTitle(m.title || m.path)} <span class="muted">${esc(m.path)}</span></a>`).join('')}</div>`).join('');
    const excluded = (S.manifest.excluded || []).map((x) => `<li><code>${esc(x.path)}</code> — ${esc(x.why)}</li>`).join('');
    const readme = S.docs.researchReadme;
    return `<div class="page">${pageHeader(f, [])}${banner}
      <p class="muted">Listed by <code>RESEARCH/manifest.json</code> (generated ${esc(S.manifest.generated || '?')}). ${esc(S.manifest.note || '')}</p>
      <div class="groups library">${list}</div>
      ${excluded ? `<section class="doc"><h3>Registered by reference only</h3><ul>${excluded}</ul></section>` : ''}
      <section class="doc"><h3>About the folder</h3><p><a href="#/library/RESEARCH/README.md">RESEARCH/README.md</a> says where the material lives and what goes in the folder from now on.</p></section></div>`;
  }
  function libraryDoc(f, path, banner) {
    const hit = manifestFiles().find((m) => m.path === path) || { path, title: path, kind: /\.json$/.test(path) ? 'json' : 'markdown' };
    const id = 'lib:' + path;
    const holder = `<div class="page doc-page library-doc">${pageHeader({ label: hit.title || path, file: path }, [], '<div class="head-actions"><a class="btn" href="#/library">← Library</a> <a class="btn" href="#/research">Register</a></div>')}${banner}<div id="lazy" data-path="${esc(path)}" data-kind="${esc(hit.kind || '')}"><p class="muted">Loading <code>${esc(path)}</code>…</p></div></div>`;
    return holder;
  }
  async function fillLazy() {
    const el = $('#lazy'); if (!el) return;
    const path = el.dataset.path; const kind = el.dataset.kind;
    try {
      const text = await fetchText(path);
      if (!$('#lazy') || $('#lazy').dataset.path !== path) return;
      if (kind === 'json' || /\.json$/.test(path)) {
        let pretty = text; try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* show as is */ }
        el.outerHTML = `<article class="doc"><pre class="code json"><code>${esc(pretty)}</code></pre></article>`;
      } else {
        const blocks = MD.parse(text);
        const fromDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        el.outerHTML = `<div class="doc-cols"><article class="doc">${render(blocks, { fromDir })}</article>${toc(blocks, 4)}</div>`;
      }
      afterRender();
    } catch (e) {
      el.innerHTML = `<div class="error">Could not read <code>${esc(path)}</code>: ${esc(e.message)}. The manifest lists it; if it is not in the folder, the folder is right and the manifest is stale.</div>`;
    }
  }

  function viewInputs(path) {
    const f = byKey.inputs;
    const blocks = S.docs.inputs;
    const banner = `<div class="findings-banner inputs"><strong>As received.</strong> Inputs are evidence, preserved as they arrived. They are not automatically project truth, and they are not edited to agree with the current understanding.</div>`;
    if (path) return `<div class="page doc-page">${pageHeader({ label: path, file: 'INPUTS/' + path }, [], '<div class="head-actions"><a class="btn" href="#/inputs">← Inputs</a></div>')}${banner}<div id="lazy" data-path="${esc('INPUTS/' + path)}" data-kind="markdown"><p class="muted">Loading…</p></div></div>`;
    if (!blocks) return fileError(f);
    const files = []; for (const b of blocks) if (b.type === 'table') for (const r of b.rows) { const m = /`([^`]+)`/.exec(r[0]); if (m) files.push({ name: m[1], what: r[1] }); }
    return `<div class="page">${pageHeader(f, [])}${banner}<article class="doc">${render(blocks, { fromDir: 'INPUTS' })}</article>
      <div class="groups library"><div class="group"><h3>Open an input</h3>${files.map((x) => `<a class="mini" href="#/inputs/${encodeURIComponent(x.name)}"><span class="rid">input</span> ${esc(x.name)}</a>`).join('') || '<p class="muted">The README lists no files.</p>'}</div></div></div>`;
  }

  function viewOpenItems(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 2);
    const TYPES = [['QUESTION', 'Questions'], ['ASSUMPTION', 'Assumptions'], ['CONFLICT', 'Conflicts'], ['DEPENDENCY', 'Dependencies'], ['RISK', 'Risks']];
    const typeOf = (r) => firstState(r.fields.Type || '', ['QUESTION', 'ASSUMPTION', 'CONFLICT', 'DEPENDENCY', 'RISK']) || 'OTHER';
    const groups = TYPES.map(([t, label]) => [label, recs.filter((r) => typeOf(r) === t)]).filter((g) => g[1].length);
    const others = recs.filter((r) => typeOf(r) === 'OTHER'); if (others.length) groups.push(['Other', others]);
    const summary = `<section class="feature-map"><h2>By type</h2><div class="groups">${groups.map(([label, rs]) => `<div class="group"><h3>${esc(label)} <span class="muted">${rs.length}</span></h3>${rs.map((r) => { const st = statusOf(f.key, r, blocks); return `<a class="mini st-${(st || '').toLowerCase()}" href="#/open-items/${r.id}"><span class="rid">${r.id}</span> ${plainTitle(r.title)} ${st ? chip(st) : ''}</a>`; }).join('')}</div>`).join('')}</div></section>`;
    const cards = groups.map(([label, rs]) => `<h2 class="group-title">${esc(label)}</h2>` + rs.map((r) => recordCard(f, r, {
      cls: 'type-' + typeOf(r).toLowerCase(),
      facets: `${r.fields.Owner ? `<span class="facet">owner: ${inline(oneLine(r.fields.Owner, 24))}</span>` : ''}`,
      summary: r.fields.Description ? inline(r.fields.Description) : '',
      body: `<dl class="fields">${allFields(r.fields, ['Description', 'Type'])}</dl>${subsHtml(r)}`,
    })).join('')).join('');
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${summary}${indexTable(body)}<div class="records">${cards}</div></div>`;
  }

  function viewDecisions(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const recs = records(body, 2);
    const dateOf = (r) => (/(\d{4}-\d{2}-\d{2})/.exec(r.fields.Date || '') || [])[1] || '';
    const sorted = recs.slice().sort((a, b) => (dateOf(b) > dateOf(a) ? 1 : dateOf(b) < dateOf(a) ? -1 : b.id.localeCompare(a.id)));
    const intro = MD.sections(body, 2).sections.filter((s) => s.heading && !RE_RECORD.test(s.heading.text) && !/index/i.test(s.heading.text));
    const cards = sorted.map((r) => recordCard(f, r, {
      facets: `<span class="facet date">${esc(dateOf(r) || 'undated')}</span>`,
      summary: r.fields.Decision ? inline(r.fields.Decision) : '',
      body: `<dl class="fields">${allFields(r.fields, ['Decision', 'Date', 'Status'])}</dl>${subsHtml(r)}`,
    })).join('');
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${introHtml(intro)}${indexTable(body)}<p class="muted">Newest first, by the date each decision records. SUPERSEDED decisions stay listed and are marked.</p><div class="records timeline">${cards}</div></div>`;
  }

  function viewPlan(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const secs = MD.sections(body, 2).sections;
    const phases = secs.find((s) => s.heading && /^phases/i.test(s.heading.text));
    let roadmap = '';
    if (phases) {
      const ps = MD.sections(phases.blocks, 3);
      roadmap = `<section class="roadmap"><h2>Roadmap</h2>${render(ps.preamble)}<ol class="phases">${ps.sections.map((p) => {
        const fl = MD.fields(p.blocks).map;
        const exit = fl['Exit Condition'] || '';
        const met = /^met\b/i.test(exit) ? 'met' : /answers|after|when|not|only/i.test(exit) ? 'open' : '';
        return `<li class="phase ${met}"><h3>${inline(p.heading.text)}</h3>${fl.Objective ? `<p class="goal">${inline(fl.Objective)}</p>` : ''}<details><summary>Work, dependencies and exit condition</summary><dl class="fields">${allFields(fl, ['Objective'])}</dl>${render(p.blocks.filter((b) => b.type !== 'para' || !/^\*\*[^*]+:\*\*/.test(b.text)))}</details>${exit ? `<p class="exit"><strong>Exit:</strong> ${inline(oneLine(exit, 160))}</p>` : ''}</li>`;
      }).join('')}</ol></section>`;
    }
    const rest = secs.filter((s) => s !== phases);
    return `<div class="page doc-page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${roadmap}<div class="doc-cols"><article class="doc">${render(rest.flatMap((s) => [s.heading, ...s.blocks]))}</article>${toc(rest.flatMap((s) => [s.heading, ...s.blocks]))}</div></div>`;
  }

  function viewChangelog(f) {
    const blocks = S.docs[f.key]; const { pre, body } = splitTemplate(blocks);
    const secs = MD.sections(body, 2).sections;
    const changes = secs.find((s) => s.heading && /^changes/i.test(s.heading.text));
    const entries = changes ? MD.sections(changes.blocks, 3).sections : [];
    const html = entries.map((e) => {
      const m = /^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/.exec(e.heading.text);
      return `<li class="entry"><span class="date">${esc(m ? m[1] : '')}</span><div><h3 id="${esc(e.heading.id)}">${inline(m ? m[2] : e.heading.text)}</h3>${render(e.blocks)}</div></li>`;
    }).join('');
    const rest = secs.filter((s) => s !== changes);
    return `<div class="page">${pageHeader(f, blocks)}${aboutFile(f, pre)}${rest.length ? `<div class="doc intro">${render(rest.flatMap((s) => [s.heading, ...s.blocks]))}</div>` : ''}<ol class="changelog">${html || '<p class="muted">No entries.</p>'}</ol></div>`;
  }

  function viewExtraDoc(path) {
    return `<div class="page doc-page">${pageHeader({ label: path, file: path }, [])}<p class="muted">A project document outside the canonical set, shown as it is.</p><div id="lazy" data-path="${esc(path)}" data-kind="markdown"><p class="muted">Loading…</p></div></div>`;
  }

  // ---- routing --------------------------------------------------------------------------------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [key, ...rest] = h.split('/');
    const tail = rest.map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } }).join('/');
    return { key: key || '', tail };
  }
  function renderRoute() {
    const { key, tail } = route();
    const main = $('#main');
    let html = '';
    if (!key) html = frontPage();
    else if (key === 'library') html = viewLibrary(tail);
    else if (key === 'inputs') html = viewInputs(tail);
    else if (key === 'doc') html = viewExtraDoc(tail);
    else if (byKey[key]) {
      const f = byKey[key];
      if (S.errors[f.key]) html = fileError(f);
      else {
        const v = { overview: viewOverview, records: viewRecords, journeys: viewJourneys, spec: viewSpec, features: viewFeatures, workflows: viewWorkflows, board: viewBoard, prototype: viewPrototype, research: viewResearch, 'open-items': viewOpenItems, decisions: viewDecisions, plan: viewPlan, changelog: viewChangelog, doc: viewDoc }[f.role] || viewDoc;
        html = v(f);
      }
    } else html = `<div class="page"><div class="error">No such page: <code>${esc(key)}</code>.</div></div>`;
    main.innerHTML = html;
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('current', a.dataset.key === (key || 'front')));
    afterRender();
    if (tail && key !== 'library' && key !== 'inputs' && key !== 'doc') openAnchor(tail);
    else window.scrollTo(0, 0);
    fillLazy();
  }
  function openAnchor(id) {
    const el = document.getElementById(id);
    if (!el) { window.scrollTo(0, 0); return; }
    if (el.tagName === 'DETAILS') el.open = true;
    let p = el.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; }
    el.classList.add('target');
    const go = () => { const top = el.getBoundingClientRect().top + window.scrollY - 12; window.scrollTo(0, Math.max(0, top)); };
    requestAnimationFrame(go);
    setTimeout(go, 120);   // a fresh load can lay out again after the first frame
  }
  function afterRender() {
    document.querySelectorAll('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const el = document.getElementById(a.dataset.scroll); if (el) { let p = el.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; } el.scrollIntoView({ block: 'start' }); } }));
  }
  function nav() {
    const items = [{ key: 'front', label: 'Front page', href: '#/' }].concat(FILES.map((f) => ({ key: f.key, label: f.label, href: '#/' + f.key })));
    $('#nav').innerHTML = items.map((i) => `<a data-key="${i.key}" href="${i.href}" class="${S.errors[i.key] ? 'broken' : ''}">${esc(i.label)}${S.errors[i.key] ? ' <span title="could not be read">!</span>' : ''}</a>`).join('');
    $('#proto-link').href = prototypeBase();
    $('#loaded').textContent = 'read ' + S.loadedAt.toLocaleTimeString();
    const bad = Object.keys(S.errors).filter((k) => k !== 'manifest');
    $('#load-errors').innerHTML = bad.length ? `Could not read: ${bad.map((k) => `<code>${esc((byKey[k] || {}).file || k)}</code>`).join(', ')}. The files are right; this page cannot show what it could not read.` : '';
  }

  async function boot() {
    $('#main').innerHTML = '<div class="page"><p class="muted">Reading the project files…</p></div>';
    await loadAll();
    if (S.docs.inputs === undefined && !S.errors.inputs) { /* nothing */ }
    nav();
    renderRoute();
    window.addEventListener('hashchange', renderRoute);
    $('#reload').addEventListener('click', async () => { indexCache && Object.keys(indexCache).forEach((k) => delete indexCache[k]); S.docs = {}; S.errors = {}; S.extras = new Set(); await loadAll(); nav(); renderRoute(); });
  }
  boot();
})();
