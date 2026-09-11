/**
 * Is this a phone? One answer for every component that lays itself out differently on one.
 *
 * The line is Tailwind's `sm` breakpoint, 640px, so that a component deciding in JS (which tile
 * size to draw, whether to render the bottom bar) and a class deciding in CSS (`max-sm:`) can
 * never disagree about which side of it they are on. MOBILE.md has the measurements that set it.
 */
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 639.98px)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
