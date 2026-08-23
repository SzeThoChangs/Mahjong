/**
 * Fast shanten (distance from a complete hand). Per-suit enumeration memoised by
 * an integer key, then suits + honours combined. ~5 µs per call warm.
 *   -1 = complete, 0 = one tile away (calling), 1 = two away, ...
 */
import { THIRTEEN_WONDER_KINDS, countsAndJokers, type TileKind, type Counts } from './tiles.js';

type Outcome = [sets: number, partials: number, pairs: number];
const suitMemo = new Map<number, Outcome[]>();
const scratch = new Array<number>(9).fill(0);
function suitOutcomesAt(counts: ArrayLike<number>, off: number): Outcome[] {
  let key = 0;
  for (let i = 0; i < 9; i++) key = key * 5 + counts[off + i]!;
  const hit = suitMemo.get(key); if (hit) return hit;
  const c = scratch; for (let i = 0; i < 9; i++) c[i] = counts[off + i]!;
  const res = new Set<number>(); const out: Outcome[] = [];
  const walk = (i: number, s: number, p: number, pr: number) => {
    while (i < 9 && c[i] === 0) i++;
    if (i >= 9) { const k = s * 100 + p * 10 + pr; if (!res.has(k)) { res.add(k); out.push([s, p, pr]); } return; }
    c[i]!--; walk(i, s, p, pr); c[i]!++;
    if (c[i]! >= 3) { c[i]! -= 3; walk(i, s + 1, p, pr); c[i]! += 3; }
    if (c[i]! >= 2) { c[i]! -= 2; walk(i, s, p, pr + 1); c[i]! += 2; }
    if (i <= 6 && c[i + 1]! > 0 && c[i + 2]! > 0) { c[i]!--; c[i + 1]!--; c[i + 2]!--; walk(i, s + 1, p, pr); c[i]!++; c[i + 1]!++; c[i + 2]!++; }
    if (i <= 7 && c[i + 1]! > 0) { c[i]!--; c[i + 1]!--; walk(i, s, p + 1, pr); c[i]!++; c[i + 1]!++; }
    if (i <= 6 && c[i + 2]! > 0) { c[i]!--; c[i + 2]!--; walk(i, s, p + 1, pr); c[i]!++; c[i + 2]!++; }
  };
  walk(0, 0, 0, 0);
  const kept = out.filter((o) => !out.some((q) => q !== o && q[0] >= o[0] && q[1] >= o[1] && q[2] >= o[2] && (q[0] > o[0] || q[1] > o[1] || q[2] > o[2])));
  suitMemo.set(key, kept);
  return kept;
}

/** Standard-form shanten for `4 - melds` sets + eye from concealed counts. */
export function shantenStandard(counts: ArrayLike<number>, melds: number): number {
  const need = 4 - melds;
  const A = suitOutcomesAt(counts, 0), B = suitOutcomesAt(counts, 9), C = suitOutcomesAt(counts, 18);
  let hs = 0, hp = 0;
  for (let k = 27; k < 34; k++) { const n = counts[k]!; if (n >= 3) hs++; else if (n === 2) hp++; }
  let best = 99;
  for (let ia = 0; ia < A.length; ia++) { const a = A[ia]!;
    for (let ib = 0; ib < B.length; ib++) { const b = B[ib]!;
      for (let ic = 0; ic < C.length; ic++) { const c = C[ic]!;
        const S = a[0] + b[0] + c[0] + hs, pairs = a[2] + b[2] + c[2] + hp, P = a[1] + b[1] + c[1];
        const S2 = S < need ? S : need;
        if (pairs > 0) { const P2 = Math.min(P + pairs - 1, need - S2); const sh = 2 * need - 2 * S2 - P2 - 1; if (sh < best) best = sh; }
        { const P2 = Math.min(P + pairs, need - S2); const sh = 2 * need - 2 * S2 - P2; if (sh < best) best = sh; }
      } } }
  return best;
}
export function shantenThirteen(counts: ArrayLike<number>): number {
  let distinct = 0, pair = 0;
  for (const k of THIRTEEN_WONDER_KINDS) { const n = counts[k]!; if (n >= 1) distinct++; if (n >= 2) pair = 1; }
  return 13 - distinct - pair;
}
/** Shanten of concealed tiles given `melds` exposed sets (13 Wonders considered only when fully concealed). Jokers in the hand each reduce it by one. */
export function shanten(concealed: TileKind[], melds: number): number {
  const { counts: c, jokers } = countsAndJokers(concealed);
  const s = shantenStandard(c, melds);
  const base = melds === 0 ? Math.min(s, shantenThirteen(c)) : s;
  return Math.max(-1, base - jokers);
}
/** Cheap necessary check before calling scoreHand: can these 3n+2 tiles (plus `jokers` wild tiles) be a complete hand? */
export function couldBeComplete(counts: Counts, melds: number, jokers = 0): boolean {
  if (shantenStandard(counts, melds) <= jokers - 1) return true;
  return melds === 0 && shantenThirteen(counts) <= jokers - 1;
}
