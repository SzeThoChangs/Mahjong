/* The demo launchpads. Cards are derived from ../FEATURES.md and ../WORKFLOWS.md every time a
 * page loads; nothing is retyped here. Markdown is upstream, these pages are downstream, and they
 * are demo scaffolding that is expected to be thrown away.
 */
(() => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const $ = (s) => document.querySelector(s);

  // where the project interface lives: beside prototype/ by default, or wherever the query says
  function viewUrl() {
    let v = new URLSearchParams(location.search).get('view');
    try { if (v) localStorage.setItem('prototype.viewUrl', v); else v = localStorage.getItem('prototype.viewUrl'); } catch (e) { /* storage may be blocked */ }
    return v || '../project-view/';
  }

  // ---- a very small Markdown reader: enough for the record shape of the two files ----------------
  const RE_RECORD = /^##\s+([A-Z]+-\d{3})\s+[—–-]\s+(.*)$/;
  function records(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const out = []; let cur = null; let sec = null;
    for (const line of lines) {
      const m = RE_RECORD.exec(line);
      if (m) { cur = { id: m[1], title: m[2].trim(), fields: {}, sections: {}, body: [] }; out.push(cur); sec = null; continue; }
      if (/^##\s/.test(line)) { cur = null; continue; }
      if (!cur) continue;
      const h = /^###\s+(.*)$/.exec(line);
      if (h) { sec = h[1].trim(); cur.sections[sec] = { fields: {}, lines: [] }; continue; }
      (sec ? cur.sections[sec].lines : cur.body).push(line);
    }
    for (const r of out) {
      r.fields = fieldsOf(r.body);
      for (const k of Object.keys(r.sections)) r.sections[k].fields = fieldsOf(r.sections[k].lines);
    }
    return out;
  }
  function fieldsOf(lines) {
    const f = {}; let key = null;
    for (const line of lines) {
      const m = /^\*\*([^*]+?):\*\*\s*(.*)$/.exec(line);
      if (m) { key = m[1].trim(); f[key] = m[2].trim(); continue; }
      if (key && line.trim() && !/^\s*[-*]\s|^\s*\d+\.\s/.test(line)) f[key] = (f[key] + ' ' + line.trim()).trim();
      else if (!line.trim()) key = null;
    }
    return f;
  }
  function orderedItems(lines) {
    const items = []; let cur = null;
    for (const line of lines) {
      const m = /^\s*\d+\.\s+(.*)$/.exec(line);
      if (m) { cur = m[1]; items.push(cur); continue; }
      if (cur !== null && /^\s{2,}\S/.test(line)) items[items.length - 1] += ' ' + line.trim();
      else if (!line.trim()) cur = null;
    }
    return items;
  }
  const STATUS_RE = /(?<![A-Za-z0-9-])(NOT BUILT|BUILT|VERIFIED|PARTIAL|PROPOSED|IN PROGRESS|NOT STARTED)(?![A-Za-z0-9-])/;
  const firstStatus = (s) => (STATUS_RE.exec(s || '') || [])[1] || null;
  const chip = (w, extra = '') => `<span class="chip chip-${w.toLowerCase().replace(/\s+/g, '-')} ${extra}">${esc(w)}</span>`;
  function inline(s) {
    let h = esc(s);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(?<![A-Za-z0-9])\*([^*\n]+)\*(?![A-Za-z0-9])/g, '<em>$1</em>');
    return h.replace(/(?<![A-Za-z0-9-])(CONFIRMED|OBSERVED|ASSUMED|UNRESOLVED)(?![A-Za-z0-9-])/g, (m) => `<span class="ev ev-${m.toLowerCase()}">${m}</span>`);
  }

  /** The route a record names, or null with the reason. Only a bare `prototype/app.html#tab` counts. */
  function routeOf(r) {
    const demo = r.sections['Prototype / Demo'] || Object.values(r.sections).find((s) => 'Prototype Route' in s.fields) || { fields: {} };
    const f = demo.fields;
    const raw = f['Prototype Route'] || '';
    const m = /^`prototype\/app\.html#([a-z]+)`(.*)$/.exec(raw.trim());
    const tab = m && !/^\s*(none|no screen)/i.test(raw) ? m[1] : null;
    return { tab, note: tab ? m[2].trim() : '', raw, demo: f, pstatus: firstStatus(f['Prototype Status']) };
  }

  let appPresent = null;
  async function checkApp() {
    try { const r = await fetch('app.html', { method: 'HEAD', cache: 'no-store' }); appPresent = r.ok; }
    catch (e) { appPresent = false; }
    return appPresent;
  }
  function appMissingBanner() {
    return `<div class="banner missing"><strong>The app snapshot is not built.</strong> <code>prototype/app.html</code> is generated and not committed, so the cards below cannot open anything yet. From the project root run <code>prototype/build.sh</code> (about a minute), then reload this page.</div>`;
  }
  function openLink(route, label = 'Open') {
    if (!route.tab) return `<span class="noscreen">${route.raw ? inline(route.raw) : 'No screen'}</span>`;
    if (!appPresent) return `<span class="noscreen">Needs building: <code>app.html#${esc(route.tab)}</code></span>`;
    return `<a class="open" href="app.html#${esc(route.tab)}">${label} <code>#${esc(route.tab)}</code> →</a>`;
  }

  function groupBy(recs, keyFn) {
    const g = new Map();
    for (const r of recs) { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
    return g;
  }
  const personaChip = (p) => (p ? `<span class="persona">${esc(p.replace(/\.$/, ''))}</span>` : '');
  const caveat = (d) => (d['Prototype Caveat'] && !/^none\.?$/i.test(d['Prototype Caveat'].trim()) ? `<p class="caveat">${inline(d['Prototype Caveat'])}</p>` : '');
  const recordStatus = (r) => firstStatus(r.fields.Status);

  // ---- /features ------------------------------------------------------------------------------
  function featureCard(r) {
    const route = routeOf(r); const d = route.demo;
    const st = recordStatus(r); const built = route.pstatus === 'BUILT' && !!route.tab;
    const isNew = /^yes/i.test(d['New Since Last Demo'] || '');
    return `<article class="card ${built ? 'built' : 'unbuilt'}">
      <header><span class="id">${esc(r.id)}</span>${isNew ? '<span class="new">New</span>' : ''}${route.pstatus ? chip(route.pstatus) : (st ? chip(st) : '')}</header>
      <h3>${inline(r.title)}</h3>
      <p class="desc">${inline(d['Demo Description'] || r.fields.Purpose || '')}</p>
      <p class="meta">${personaChip(d['Demo Persona'])}${st && st !== route.pstatus ? `<span class="record-status">record: ${chip(st)}</span>` : ''}</p>
      ${caveat(d)}
      ${route.note ? `<p class="note">${inline(route.note)}</p>` : ''}
      <footer>${openLink(route)}</footer>
    </article>`;
  }
  function renderFeatures(recs) {
    const withGroup = recs.filter((r) => routeOf(r).demo['Demo Group']);
    const without = recs.filter((r) => !routeOf(r).demo['Demo Group']);
    const groups = groupBy(withGroup, (r) => routeOf(r).demo['Demo Group']);
    let html = '';
    for (const [g, rs] of groups) html += `<section class="group"><h2>${esc(g)}</h2><div class="grid">${rs.map(featureCard).join('')}</div></section>`;
    if (without.length) html += `<section class="group unbuilt-group"><h2>Not in the prototype</h2><p class="muted">Specified in <code>FEATURES.md</code> with no screen behind them. Shown so nobody asks for a demo of one.</p><div class="grid">${without.map(featureCard).join('')}</div></section>`;
    return html;
  }

  // ---- /workflows -----------------------------------------------------------------------------
  function workflowCard(r) {
    const route = routeOf(r); const d = route.demo;
    const st = recordStatus(r);
    const flow = r.sections['Normal Flow'] ? orderedItems(r.sections['Normal Flow'].lines) : [];
    return `<article class="card wf ${route.tab && route.pstatus !== 'NOT BUILT' ? 'built' : 'unbuilt'}">
      <header><span class="id big">${esc(r.id)}</span>${route.pstatus ? chip(route.pstatus) : (st ? chip(st) : '')}</header>
      <h3>${inline(r.title)}</h3>
      <p class="meta">${r.fields['Primary Actor'] ? `<span class="actor">${inline(r.fields['Primary Actor'].replace(/\.$/, ''))}</span>` : ''}${(d['Demo Persona'] || '').replace(/\.$/, '') !== (r.fields['Primary Actor'] || '').replace(/\.$/, '') ? personaChip(d['Demo Persona']) : ''}</p>
      <p class="desc">${inline(d['Demo Summary'] || '')}</p>
      ${flow.length ? `<details class="steps"><summary>${flow.length} steps</summary><ol>${flow.map((s) => `<li>${inline(s)}</li>`).join('')}</ol><p class="muted small">Steps carry no deeper links: the app addresses tabs, not the states inside them (<code>WORKFLOWS.md</code>).</p></details>` : ''}
      ${caveat(d)}
      <footer>${openLink(route, 'Open at')}</footer>
    </article>`;
  }
  function renderWorkflows(recs) {
    const groups = groupBy(recs, (r) => routeOf(r).demo['Demo Group'] || 'Ungrouped');
    let html = '';
    for (const [g, rs] of groups) html += `<section class="group"><h2>${esc(g)}</h2><div class="grid">${rs.map(workflowCard).join('')}</div></section>`;
    return html;
  }

  // ---- boot -----------------------------------------------------------------------------------
  async function boot() {
    document.querySelectorAll('a.view-link').forEach((a) => { a.href = viewUrl(); });
    const kind = document.body.dataset.launchpad;
    const main = $('#cards');
    await checkApp();
    if (!appPresent) $('#app-banner').innerHTML = appMissingBanner();
    if (!kind) { // the front page: only the app link needs the check
      const a = $('#open-app'); if (a) { if (appPresent) a.href = 'app.html#train'; else { a.classList.add('disabled'); a.removeAttribute('href'); a.textContent = 'App not built'; } }
      return;
    }
    const file = kind === 'features' ? '../FEATURES.md' : '../WORKFLOWS.md';
    try {
      const r = await fetch(file, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const recs = records(await r.text());
      main.innerHTML = kind === 'features' ? renderFeatures(recs) : renderWorkflows(recs);
      $('#derived').textContent = `${recs.length} records read from ${file.slice(3)} just now. If a card is wrong, the fix belongs in that file.`;
    } catch (e) {
      main.innerHTML = `<div class="banner missing">Could not read <code>${esc(file.slice(3))}</code>: ${esc(e.message)}. The launchpad is derived from that file and has nothing of its own to show. Serve the project root, not this folder alone.</div>`;
    }
  }
  boot();
})();
