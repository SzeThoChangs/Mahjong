/**
 * Structural hand features: shanten (distance from completion), effective
 * incoming tiles, pairs / triplets / sequences / isolated tiles, current tai.
 *
 * Shanten uses per-suit enumeration with memoisation: each suit's 9 counts
 * are reduced to the set of achievable (sets, partials, pairs) outcomes, then
 * suits and honours are combined. Fast enough to run ~500 times per decision.
 */
import { KIND, countsAndJokers, isHonour, isJoker, isSuited, rankOf, suitOf, isTerminal, isWind, isDragon, type TileKind, THIRTEEN_WONDER_KINDS } from './tiles.js';
import { fanInHand, type Meld } from './score.js';

export { shantenStandard, shantenThirteen, shanten } from './shanten.js';
import { shantenStandard, shantenThirteen, shanten } from './shanten.js';

export interface Structure { pairs: number; triplets: number; sequences: number; partialSeqs: number; isolated: number; honours: number; suitCounts: [number, number, number]; terminals: number }
export function structure(concealed: TileKind[]): Structure {
  const c = countsAndJokers(concealed).counts;          // jokers are not part of the structure counts
  let pairs = 0, triplets = 0, sequences = 0, partialSeqs = 0, isolated = 0, honours = 0, terminals = 0;
  const suitCounts: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 34; k++) {
    const n = c[k]!; if (!n) continue;
    if (n === 2) pairs++; if (n >= 3) triplets++;
    if (isHonour(k)) { honours += n; if (n === 1) isolated++; continue; }
    suitCounts[Math.floor(k / 9)]! += n;
    if (isTerminal(k)) terminals += n;
    const r = rankOf(k);
    if (r <= 7 && c[k + 1]! && c[k + 2]!) sequences++;
    else if (r <= 8 && c[k + 1]!) partialSeqs++;
    else if (r <= 7 && c[k + 2]!) partialSeqs++;
    const near = (r > 2 && c[k - 2]!) || (r > 1 && c[k - 1]!) || (r < 9 && c[k + 1]!) || (r < 8 && c[k + 2]!);
    if (n === 1 && !near) isolated++;
  }
  return { pairs, triplets, sequences, partialSeqs, isolated, honours, suitCounts, terminals };
}

/** Unseen copies of each kind from the acting player's point of view. */
export function unseenCounts(visible: { hand: TileKind[]; allMelds: TileKind[]; allDiscards: TileKind[] }): Uint8Array {
  const u = new Uint8Array(34).fill(4);          // jokers (kind 46) are simply ignored here
  for (const k of visible.hand) if (k < 34) u[k]!--;
  for (const k of visible.allMelds) if (k < 34) u[k]!--;
  for (const k of visible.allDiscards) if (k < 34) u[k]!--;
  return u;
}

export interface Ukeire { kinds: TileKind[]; tiles: number }
/** Kinds whose draw reduces shanten, and how many unseen copies of them exist. */
export function ukeire(concealed: TileKind[], melds: number, unseen: Uint8Array): Ukeire {
  const base = shanten(concealed, melds);
  const kinds: TileKind[] = []; let tiles = 0;
  const { counts: c, jokers } = countsAndJokers(concealed);
  // Only tiles that can join an existing tile (same kind, or within 2 ranks in-suit) can lower shanten.
  const cand = new Uint8Array(34);
  for (let k = 0; k < 34; k++) {
    if (!c[k]) continue;
    cand[k] = 1;
    if (k < 27) { const r = k % 9; for (let d = -2; d <= 2; d++) { const rr = r + d; if (rr >= 0 && rr < 9) cand[k + d] = 1; } }
  }
  // 13 Wonders: any unheld wonder tile helps when that route is as close as the standard one
  if (melds === 0 && shantenThirteen(c) <= shantenStandard(c, 0)) for (const k of THIRTEEN_WONDER_KINDS) cand[k] = 1;
  for (let k = 0; k < 34; k++) {
    if (!cand[k] || !unseen[k] || c[k]! >= 4) continue;
    c[k]!++;
    const s = shantenStandard(c, melds);
    const s2 = Math.max(-1, (melds === 0 ? Math.min(s, shantenThirteen(c)) : s) - jokers);
    c[k]!--;
    if (s2 < base) { kinds.push(k); tiles += unseen[k]!; }
  }
  return { kinds, tiles };
}

export interface DiscardFeatures {
  k: TileKind;          // candidate discard
  sh: number;           // shanten after discarding it
  eff: number;          // effective incoming kinds
  rem: number;          // remaining effective tiles (unseen copies)
  pairs: number; trip: number; seq: number; pseq: number; iso: number;
  isoTile: boolean;     // the discarded tile itself was isolated
  term: boolean; hon: boolean; dragon: boolean; wind: boolean;
}
/** Features for every possible discard from a 3n+2 hand. Small cache: the bot and the recorder ask for the same view. */
const featCache = new Map<string, DiscardFeatures[]>();
export function discardFeatures(hand: TileKind[], melds: Meld[], unseen: Uint8Array): DiscardFeatures[] {
  const key = hand.join(',') + '|' + melds.length + '|' + unseen.join('');
  const hit = featCache.get(key); if (hit) return hit;
  const out = discardFeaturesUncached(hand, melds, unseen);
  if (featCache.size > 64) featCache.delete(featCache.keys().next().value!);
  featCache.set(key, out);
  return out;
}
function discardFeaturesUncached(hand: TileKind[], melds: Meld[], unseen: Uint8Array): DiscardFeatures[] {
  const out: DiscardFeatures[] = [];
  const st0 = structure(hand);
  const allJokers = hand.every(isJoker);
  for (const k of new Set(hand)) {
    if (isJoker(k) && !allJokers) continue;            // wild tiles are never candidate discards for the heuristic bots
    const rest = [...hand]; rest.splice(rest.indexOf(k), 1);
    const sh = shanten(rest, melds.length);
    const uk = ukeire(rest, melds.length, unseen);
    const st = structure(rest);
    const c = hand.filter((x) => x === k).length;
    const r = rankOf(k), su = suitOf(k);
    const near = isSuited(k) && hand.some((x) => x !== k && suitOf(x) === su && Math.abs(rankOf(x) - r) <= 2);
    out.push({ k, sh, eff: uk.kinds.length, rem: uk.tiles, pairs: st.pairs, trip: st.triplets, seq: st.sequences, pseq: st.partialSeqs, iso: st.isolated,
      isoTile: c === 1 && !near && !(isHonour(k) && false), term: isTerminal(k), hon: isHonour(k), dragon: isDragon(k), wind: isWind(k) });
  }
  void st0;
  return out;
}

export interface HandFeatures { sh: number; eff: number; rem: number; st: Structure; tai: number; openMelds: number }
export function handFeatures(concealed: TileKind[], melds: Meld[], unseen: Uint8Array, ctx: { bonus: TileKind[]; seat: number; prevailingWind: number }): HandFeatures {
  const sh = shanten(concealed, melds.length);
  const uk = concealed.length % 3 === 1 ? ukeire(concealed, melds.length, unseen) : { kinds: [], tiles: 0 };
  return { sh, eff: uk.kinds.length, rem: uk.tiles, st: structure(concealed), tai: fanInHand({ melds, bonus: ctx.bonus, seat: ctx.seat, prevailingWind: ctx.prevailingWind }), openMelds: melds.length };
}
export { KIND };
