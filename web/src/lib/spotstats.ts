/**
 * How the spotting drill is going, kept per question type.
 *
 * A single overall score would hide the thing worth knowing. Seeing how far a hand is from ready and
 * seeing which opponent is dangerous are different skills, and a player is usually much better at
 * one than the other. Keeping them apart is what turns the drill into a diagnosis rather than a
 * number, which is the same reason the mistake record sorts mistakes by cause.
 *
 * Stored the way `mistakes.ts` stores its record: one namespaced localStorage key, written whole,
 * wrapped in try/catch so a browser with storage turned off degrades to a session that forgets
 * rather than a tab that breaks.
 */

export type SpotKind = 'ready' | 'suit' | 'threat' | 'shape';
export interface SpotCount { n: number; right: number }
export type SpotStats = Record<SpotKind, SpotCount>;

const KEY = 'mj.spot.v1';
const KINDS: SpotKind[] = ['ready', 'suit', 'threat', 'shape'];
const blank = (): SpotStats => ({ ready: { n: 0, right: 0 }, suit: { n: 0, right: 0 }, threat: { n: 0, right: 0 }, shape: { n: 0, right: 0 } });

export function loadSpotStats(): SpotStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw) as Partial<SpotStats>;
    const out = blank();
    for (const k of KINDS) {
      const c = parsed[k];
      if (c && typeof c.n === 'number' && typeof c.right === 'number') out[k] = { n: c.n, right: c.right };
    }
    return out;
  } catch { return blank(); }
}

export function recordSpot(kind: SpotKind, right: boolean): void {
  try {
    const s = loadSpotStats();
    s[kind].n++;
    if (right) s[kind].right++;
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* storage off: the session still runs, it just does not remember */ }
}

export function resetSpotStats(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
