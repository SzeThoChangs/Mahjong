// Put a persistent link back to the project interface into the generated app.html, so every
// prototype screen carries one (P-Starter Part 16). Run by build.sh after the snapshot is written:
//
//   node prototype/backlink.mjs prototype/app.html
//
// It is idempotent: a file that already carries the link is left alone. The link goes to
// ../project-view/ by default; a `?view=<url>` on the app's address, or the value the launchpads
// store under `prototype.viewUrl`, points it somewhere else when the two are served separately.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] || new URL('./app.html', import.meta.url).pathname;
let html = readFileSync(file, 'utf8');
if (html.includes('id="pv-backlink"')) { console.log('backlink already present in ' + file); process.exit(0); }

const snippet = `
<style id="pv-backlink-style">
#pv-backlink{position:fixed;top:calc(env(safe-area-inset-top,0px) + 6px);right:6px;z-index:60;display:flex;gap:4px;font:12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
#pv-backlink a{background:#7a1f2b;color:#fff;text-decoration:none;padding:6px 9px;border-radius:999px;opacity:.85}
#pv-backlink a:hover{opacity:1}
</style>
<div id="pv-backlink"><a id="pv-backlink-view" href="../project-view/" title="The project interface">Project</a><a href="index.html" title="The demo launchpads">Launchpads</a></div>
<script>(function(){try{var v=new URLSearchParams(location.search).get('view')||localStorage.getItem('prototype.viewUrl');if(v){document.getElementById('pv-backlink-view').href=v}}catch(e){}})();</script>
`;
const i = html.lastIndexOf('</body>');
html = i >= 0 ? html.slice(0, i) + snippet + html.slice(i) : html + snippet;
writeFileSync(file, html);
console.log('backlink added to ' + file);
