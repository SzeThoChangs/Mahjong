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

/**
 * Why a spot was missed. The Spot drill trains SEEING, so its causes are narrower than the
 * throwing record's eight: you did not take it in, the clock ran out first, you saw it and read it
 * wrongly, or you never saw it and guessed. Kept per question kind, because "misread" on the
 * distance question and "did not take it in" on the melds question are different things to fix.
 */
export type SpotCause = 'not-taken-in' | 'out-of-time' | 'misread' | 'guessed';
export const SPOT_CAUSES: { id: SpotCause; label: string; blurb: string }[] = [
  { id: 'not-taken-in', label: 'Did not take it in', blurb: 'I looked at the table and it did not register.' },
  { id: 'out-of-time', label: 'Ran out of time', blurb: 'I was still reading when it went face down.' },
  { id: 'misread', label: 'Misread what I saw', blurb: 'I saw the tiles and drew the wrong conclusion from them.' },
  { id: 'guessed', label: 'Guessed', blurb: 'I never saw it; the answer was a guess.' },
];
export const spotCauseLabel = (c: SpotCause): string => SPOT_CAUSES.find((x) => x.id === c)?.label ?? c;
const CAUSE_KEY = 'mj.spotcause.v1';
export type SpotCauseTally = Partial<Record<SpotKind, Partial<Record<SpotCause, number>>>>;
export function loadSpotCauses(): SpotCauseTally {
  try { return JSON.parse(localStorage.getItem(CAUSE_KEY) || '{}') as SpotCauseTally; } catch { return {}; }
}
export function recordSpotCause(kind: SpotKind, cause: SpotCause): void {
  try {
    const t = loadSpotCauses();
    const k = (t[kind] ??= {});
    k[cause] = (k[cause] ?? 0) + 1;
    localStorage.setItem(CAUSE_KEY, JSON.stringify(t));
  } catch { /* storage off */ }
}
/** The one that keeps coming up, over every kind - or null if nothing has been sorted yet. */
export function leadingSpotCause(): { cause: SpotCause; n: number; total: number } | null {
  const sum: Partial<Record<SpotCause, number>> = {};
  let total = 0;
  for (const k of Object.values(loadSpotCauses())) for (const [c, n] of Object.entries(k ?? {})) { sum[c as SpotCause] = (sum[c as SpotCause] ?? 0) + (n ?? 0); total += n ?? 0; }
  const top = (Object.entries(sum) as [SpotCause, number][]).sort((a, b) => b[1] - a[1])[0];
  return top ? { cause: top[0], n: top[1], total } : null;
}
