/**
 * Fold the built app into one HTML file, so it can be handed to somebody with no server behind it.
 *
 *   node tools/singlefile.mjs [--questions 1000] [--hands 40] [--out dist-single/app.html]
 *
 * WHY. The normal build is 498 files and 61MB, which needs somewhere to host it. One file needs
 * nowhere: it can be published as an artifact, mailed, or opened off a phone's downloads. That is
 * the difference between friends testing this week and friends waiting for a hosting account.
 *
 * WHAT IT COSTS. Each quiz pack is cut to its first `--questions` rather than all 10,000 - for a
 * sharded pack, the first shards that fit - and the Film room to one run of `--hands` rather than
 * 360 across two, which is what keeps the page inside the 16MB an artifact allows. Both are cut by
 * rewriting the index as well as the files, so a list never offers something that cannot be opened. Everything else is whole: the Train tab deals from a
 * seed and needs no data at all, and Spot, Review, Tips and Table setup carry theirs.
 *
 * HOW. Two seams, both of which the app supports on its own rather than being rewritten here. Images
 * need real URLs, so the tile faces go in as data URIs and `tileSrc` reads them off the window. Data
 * is fetched, so a shim answers from an embedded map and falls back to the network for anything it
 * does not hold. The service worker is switched off, since there is no scope to register it in.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, '..', 'dist');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const MAX_Q = Number(arg('questions', '600'));
const OUT = join(here, '..', arg('out', 'dist-single/app.html'));

const read = (p) => readFileSync(join(DIST, p), 'utf8');
const b64 = (p) => readFileSync(join(DIST, p)).toString('base64');

// ---- the shell -------------------------------------------------------------------------------
const html = read('index.html');
const cssHref = /<link[^>]+href="(\/assets\/[^"]+\.css)"/.exec(html)?.[1];
const jsSrc = /<script[^>]+src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
if (!cssHref || !jsSrc) throw new Error('could not find the built css and js in index.html');
const css = read(cssHref.slice(1));
const js = read(jsSrc.slice(1));
// The normal build puts the Your hand, Film room and Table setup tabs in files of their own, fetched
// on first use, and a page with no server behind it cannot fetch them. `SINGLE_FILE=1 vite build`
// folds them back into the one script; anything else is refused here rather than shipped broken.
// A Web Worker is a script of its own by nature (the Challenge button's play-outs run in one), so
// it is carried as text and started from a blob; `lib/rejudge.ts` looks for it on the window.
const isWorker = (f) => /\.worker-[\w-]+\.js$/.test(f);
const scripts = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js') && !isWorker(f));
if (scripts.length !== 1) throw new Error(`dist/assets has ${scripts.length} scripts; build with SINGLE_FILE=1 so the on-demand tabs are folded into one`);
const workers = {};
for (const f of readdirSync(join(DIST, 'assets')).filter(isWorker)) workers[f.replace(/\.worker-[\w-]+\.js$/, '')] = read(`assets/${f}`);

// ---- the tile faces, as data URIs ------------------------------------------------------------
const tiles = {};
for (const f of readdirSync(join(DIST, 'tiles')).filter((f) => f.endsWith('.png'))) {
  tiles[f.replace(/\.png$/, '')] = `data:image/png;base64,${b64(`tiles/${f}`)}`;
}

// ---- the data the app fetches ----------------------------------------------------------------
/** Only the tables Changs actually plays, and only as much of each as the size allows. */
const WANTED = ['coach', 'min1', 'min1-nowild'];
const files = {};

const index = JSON.parse(read('quiz/index.json'));
const packs = index.packs.filter((p) => WANTED.includes(p.id));
for (const p of packs) {
  if (p.shards) {
    /**
     * A sharded pack (2026-09-10 on) is a directory: its own index, and a shard file of about a
     * hundred questions each. Carry the index and the first shards that fit inside `--questions`,
     * and rewrite the index to list only those, so the Train tab never asks for a shard that is
     * not here. The placement modulus is kept as it was: a stored card finds its shard by hashing
     * its id against that number, and the answer must be the same one the full build gave.
     */
    const ix = JSON.parse(read(`quiz/${p.id}/index.json`));
    const kept = [];
    let n = 0;
    for (const s of ix.shards) {
      if (kept.length && n + s.n > MAX_Q) break;
      kept.push(s); n += s.n;
      files[`/quiz/${p.id}/${s.file}`] = read(`quiz/${p.id}/${s.file}`);
    }
    files[`/quiz/${p.id}/index.json`] = JSON.stringify({ ...ix, questions: n, shards: kept });
    p.questions = n; p.shards = kept.length;
  } else {
    const pack = JSON.parse(read(`quiz/${p.id}.json`));
    const kept = pack.questions.slice(0, MAX_Q);
    files[`/quiz/${p.id}.json`] = JSON.stringify({ ...pack, questions: kept });
    p.questions = kept.length;
  }
}
files['/quiz/index.json'] = JSON.stringify({ packs });
files['/quiz/spot.json'] = read('quiz/spot.json');
/**
 * A slice of the Film room, rather than all of it or none.
 *
 * The replays are 12MB of the 61 and every hand is its own file, so the whole thing cannot come.
 * Dropping the tab entirely would leave a dead button, so one run comes with its first `--hands`
 * and its index is rewritten to match, which means the list shows exactly what can be opened.
 */
const HANDS = Number(arg('hands', '40'));
if (existsSync(join(DIST, 'replays'))) {
  const runs = JSON.parse(read('replays/index.json')).runs;
  const run = runs[0];
  const runIx = JSON.parse(read(`replays/${run.id}/index.json`));
  const kept = runIx.hands.slice(0, HANDS);
  for (const h of kept) files[`/replays/${run.id}/${h.file}`] = read(`replays/${run.id}/${h.file}`);
  files[`/replays/${run.id}/index.json`] = JSON.stringify({ ...runIx, hands: kept });
  files['/replays/index.json'] = JSON.stringify({ runs: [{ ...run, hands: kept.length }] });
}

for (const dir of ['reads', 'profile']) {
  if (!existsSync(join(DIST, dir))) continue;
  for (const f of readdirSync(join(DIST, dir))) {
    if (extname(f) === '.json') files[`/${dir}/${f}`] = read(`${dir}/${f}`);
  }
}

// ---- the page --------------------------------------------------------------------------------
/** Serve the embedded files, and let anything else try the network as it would have done. */
const shim = `
window.__SINGLE_FILE = true;
window.__TILES = ${JSON.stringify(tiles)};
window.__WORKER_SRC = ${JSON.stringify(workers)};
window.__FILES = ${JSON.stringify(files)};
(function () {
  var real = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var path = url.replace(/^https?:\\/\\/[^/]+/, '').split('?')[0];
    var body = window.__FILES[path];
    if (body === undefined) return real(input, init);
    return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
  };
})();
`;

// The artifact viewer wraps the page in its own head, but a phone opening the file straight from
// its downloads gets no charset and no viewport, which means mojibake and the desktop layout.
const page = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>${css}</style>
<div id="root"></div>
<script>${shim}</script>
<script type="module">${js}</script>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page);
const mb = (n) => (n / 1048576).toFixed(2);
console.log(`${OUT}`);
console.log(`  ${mb(page.length)} MB  =  css ${mb(css.length)} + js ${mb(js.length)} + tiles ${mb(JSON.stringify(tiles).length)} + data ${mb(JSON.stringify(files).length)}`);
console.log(`  packs: ${packs.map((p) => `${p.id} ${p.questions}`).join(', ')}`);
