/**
 * The service worker, and the moment a new version of the app is ready.
 *
 * A worker that has been installed while an older one still controls the page sits waiting, and
 * by default it waits until every tab of the app is closed. A phone that has the app installed to
 * its home screen may not close it for weeks, so a tester would sit on the version they first
 * opened long after a fix went out. This watches for that waiting worker, lets the page offer a
 * reload, and on "Reload" tells the worker to take over and reloads once it has.
 */
import { useSyncExternalStore } from 'react';
import { asset } from '@/lib/asset';

const HOUR = 60 * 60 * 1000;

let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** True once a new version has been fetched and is waiting for the page to let it in. */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, () => waiting !== null, () => false);
}

/** The Reload button: the worker swaps in, the `controllerchange` below fires, and the page reloads. */
export function applyUpdate(): void {
  waiting?.postMessage({ type: 'SKIP_WAITING' });
}

/** A worker counts as an update only when there is an older one in charge; the first install is not one. */
function watch(reg: ServiceWorkerRegistration) {
  const track = (w: ServiceWorker) => {
    if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; notify(); }
    else w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; notify(); } });
  };
  if (reg.waiting) track(reg.waiting);
  reg.addEventListener('updatefound', () => { if (reg.installing) track(reg.installing); });
}

/**
 * Register the worker in a built app only. In dev it would serve yesterday's bundle from cache and
 * make every edit look like it did nothing, which is a long afternoon to debug.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || window.__SINGLE_FILE || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let reg: ServiceWorkerRegistration | null = null;
  let checked = Date.now();

  window.addEventListener('load', () => {
    sw.register(asset('sw.js'), { scope: import.meta.env.BASE_URL })
      .then((r) => { reg = r; watch(r); })
      .catch(() => { /* offline is a bonus, never a blocker */ });
  });

  // The page is old the moment another worker takes over, so reload onto the new one. Not on the
  // first install, though: that one claims the page too, and reloading a page that just opened
  // would look like a glitch. `hadController` tells the two apart.
  const hadController = sw.controller !== null;
  let reloading = false;
  sw.addEventListener('controllerchange', () => {
    if (!hadController && waiting === null) return;
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  // The browser checks for a new worker when the page loads, and an installed app on a phone is
  // rarely loaded twice: it is brought back from the background. So check again when it comes to
  // the front, at most once an hour, which is the long gap that makes the bar appear at all.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - checked < HOUR) return;
    checked = Date.now();
    reg?.update().catch(() => { /* no network, most likely; the next check will try again */ });
  });
}
