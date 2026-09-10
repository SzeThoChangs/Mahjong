/**
 * Offline for the app, on demand for the packs.
 *
 * The built app is about 600KB and the quiz packs are ten megabytes each. Precaching everything
 * would put 42MB on a phone before the first question, most of it for tables the player never
 * opens, so the shell and the tiles are cached up front and a pack is kept only once it has
 * actually been used. Open a table once on wifi and it is yours on the train.
 */
const VERSION = 'v2';   // bumped for the new icon, which lives in the cached shell
const SHELL = `shell-${VERSION}`;   // the app itself: HTML, JS, CSS, tiles, icons
const DATA = `data-${VERSION}`;     // packs, replays, reads - cached the first time they are read

/** The worker is served from the site's own base, so its scope is the right root to build on. */
const BASE = new URL('./', self.registration.scope).pathname;
const at = (p) => BASE + p.replace(/^\//, '');
const SHELL_URLS = ['', 'index.html', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'manifest.webmanifest'].map(at);

/**
 * The tile faces, precached because the app is unreadable without them.
 *
 * Everything else can wait for its first use, but a position drawn with 14 broken images is not a
 * position. The names are listed rather than discovered because a worker cannot read a directory;
 * the set has not changed since the tiles were drawn, and if a face is ever added it belongs here.
 * 48 files, about 4MB.
 */
const TILES = [
  '1s.png', '1t.png', '1w.png', '2s.png', '2t.png', '2w.png', '3s.png', '3t.png', '3w.png',
  '4s.png', '4t.png', '4w.png', '5s.png', '5t.png', '5w.png', '6s.png', '6t.png', '6w.png',
  '7s.png', '7t.png', '7w.png', '8s.png', '8t.png', '8w.png', '9s.png', '9t.png', '9w.png',
  'A_cat.png', 'A_centipede.png', 'A_mouse.png', 'A_rooster.png', 'E.png', 'F1.png', 'F2.png',
  'F3.png', 'F4.png', 'G.png', 'J.png', 'N.png', 'R.png', 'S.png', 'S1.png', 'S2.png', 'S3.png',
  'S4.png', 'W.png', 'Wh.png', '_back.png'
].map((n) => at('tiles/' + n));

/**
 * The bundle's own file names, read out of index.html at install time.
 *
 * Vite hashes them, so they cannot be listed here, and they cannot be left to be picked up on first
 * use either: the browser has already fetched the script and the stylesheet by the time this worker
 * registers, so they never pass through the fetch handler below and never reach the cache. The first
 * version of this file made that mistake and went offline to a blank page with a correct title.
 */
async function bundleUrls() {
  try {
    const html = await (await fetch(at('index.html'), { cache: 'reload' })).text();
    return [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => m[1]);
  } catch { return []; }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(SHELL_URLS);
    await Promise.all(TILES.map((u) => c.add(u).catch(() => { /* a missing face is not worth failing over */ })));
    const assets = await bundleUrls();
    await Promise.all(assets.map((u) => c.add(u).catch(() => { /* one missing asset must not fail the install */ })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/** Big, immutable, and only worth keeping once the player has opened that table. */
const isData = (p) => p.startsWith(BASE + 'quiz/') || p.startsWith(BASE + 'replays/') || p.startsWith(BASE + 'reads/') || p.startsWith(BASE + 'profile/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(BASE + 'api/')) return;             // dev-only re-judge endpoint, never cached

  // A navigation must survive a dead network, so fall back to the shell rather than the browser's error page.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(at('index.html'), { ignoreVary: true })
      .then((r) => r ?? caches.match(BASE, { ignoreVary: true }))));
    return;
  }

  // Everything else: serve from cache when we have it, otherwise fetch and keep a copy.
  // `ignoreVary` matters more than it looks. The server sends Vary: Accept-Encoding, so a stored
  // response will not match a later request whose encoding header differs, the lookup misses, the
  // fetch behind it fails with no network, and the page comes back blank with a correct title. That
  // is exactly what the first version of this file did.
  e.respondWith(caches.match(req, { ignoreVary: true, ignoreSearch: false }).then((hit) => hit ?? fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') {
      const bucket = isData(url.pathname) ? DATA : SHELL;
      const copy = res.clone();
      caches.open(bucket).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
