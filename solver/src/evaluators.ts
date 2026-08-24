/**
 * The book's four tile-set evaluators, computed on concealed tiles + melds.
 *  - Rule 4213  (Chicken):    triplet 4, two-sided pair 2 (1 after 4 blocks), one-sided pair 1, eye 3
 *  - Rule 961   (Half-Color): per candidate suit: triplet 9, pair 6, single 1, +3 if calling
 *  - Rule 5313  (All-Chow):   chow 5, two-sided pair 3 (1 after 4 blocks), one-sided pair 1, eye 3, +1 if calling
 *  - All-Pong breakdown:      "T:P" = pong triplets : pong pairs
 *
 * "Available tiles" (unusable pairs) are ignored in v1 - the trainer shows no discards yet.
 */
import {
  KIND, isHonour, isJoker, isSuited, rankOf, suitOf, countsOf, countsAndJokers, shanten, winningKinds, type TileKind, type Meld, type Counts,
} from 'sg-mahjong-engine';

export interface HandInput { concealed: TileKind[]; melds: Meld[]; }

// ---------- block search over suited counts ---------------------------------
type Block = { kind: 'triplet' | 'two' | 'one' | 'eye'; tiles: TileKind[] };

/** Enumerate maximal block assignments of a counts array (suited + honours), scoring with `score`. */
function bestBlocks(counts: Counts, score: (b: Block[]) => number, allowChows: boolean): { value: number; blocks: Block[] } {
  const c = Uint8Array.from(counts);
  let best = { value: -Infinity, blocks: [] as Block[] };
  const acc: Block[] = [];
  const visit = (from: number) => {
    // find first tile with count > 0 at/after `from`
    let i = from; while (i < c.length && !c[i]) i++;
    if (i >= c.length) { const v = score(acc); if (v > best.value) best = { value: v, blocks: acc.map((b) => ({ ...b, tiles: [...b.tiles] })) }; return; }
    // option: leave tile i as a single (skip it)
    c[i]!--; visit(i); c[i]!++;
    // pong triplet
    if (c[i]! >= 3) { c[i]! -= 3; acc.push({ kind: 'triplet', tiles: [i, i, i] }); visit(i); acc.pop(); c[i]! += 3; }
    // eye / pong pair
    if (c[i]! >= 2) { c[i]! -= 2; acc.push({ kind: 'eye', tiles: [i, i] }); visit(i); acc.pop(); c[i]! += 2; }
    if (allowChows && isSuited(i)) {
      const r = rankOf(i);
      // chow
      if (r <= 7 && c[i + 1]! && c[i + 2]!) { c[i]!--; c[i + 1]!--; c[i + 2]!--; acc.push({ kind: 'triplet', tiles: [i, i + 1, i + 2] }); visit(i); acc.pop(); c[i]!++; c[i + 1]!++; c[i + 2]!++; }
      // two-sided pair: consecutive, not touching an edge (23..78)
      if (r >= 2 && r <= 7 && c[i + 1]!) { c[i]!--; c[i + 1]!--; acc.push({ kind: 'two', tiles: [i, i + 1] }); visit(i); acc.pop(); c[i]!++; c[i + 1]!++; }
      // one-sided: edge pair 12 / 89, or kanchan x_x
      if ((r === 1 || r === 8) && c[i + 1]!) { c[i]!--; c[i + 1]!--; acc.push({ kind: 'one', tiles: [i, i + 1] }); visit(i); acc.pop(); c[i]!++; c[i + 1]!++; }
      if (r <= 7 && c[i + 2]!) { c[i]!--; c[i + 2]!--; acc.push({ kind: 'one', tiles: [i, i + 2] }); visit(i); acc.pop(); c[i]!++; c[i + 2]!++; }
    }
  };
  visit(0);
  return best;
}

const isCalling = (h: HandInput) => {
  const total = h.concealed.length;
  if ((total - 1) % 3 !== 0) return false;           // needs 3n+1 concealed to be "one away"
  const { counts, jokers } = countsAndJokers(h.concealed);
  if (jokers > 0) return shanten(h.concealed, h.melds.length) <= 0;   // the engine's shanten is joker-aware
  return winningKinds(counts, 4 - h.melds.length).length > 0;
};

/** Split a hand into its ordinary tiles and its wildcards.
 *  The evaluators score the ordinary tiles and then credit each wildcard with the block it can complete -
 *  approximate, but a wildcard really is worth roughly one finished block. */
function splitJokers(h: HandInput): { plain: HandInput; jokers: number } {
  let jokers = 0; const plain: TileKind[] = [];
  for (const k of h.concealed) { if (isJoker(k)) jokers++; else plain.push(k); }
  return { plain: { concealed: plain, melds: h.melds }, jokers };
}

// ---------- Rule 4213 ------------------------------------------------------------
export function rule4213(hIn: HandInput): { value: number; blocks: Block[] } {
  const { plain: h, jokers } = splitJokers(hIn);
  const meldPts = h.melds.length * 4 + jokers * 4;      // a wildcard completes a triplet
  const r = bestBlocks(countsOf(h.concealed), (bs) => {
    let trip = h.melds.length, two = 0, one = 0, eye = 0, v = 0;
    for (const b of bs) {
      if (b.kind === 'triplet') { trip++; v += 4; }
      else if (b.kind === 'eye') { if (eye === 0) { eye = 1; v += 3; } else { one++; v += 1; } }   // second pair = pong pair = one-sided
      else if (b.kind === 'two') two++;
      else if (b.kind === 'one') { one++; v += 1; }
    }
    // two-sided pairs: 2 each while (trip + two) <= 4, then 1
    for (let i = 1; i <= two; i++) v += trip + i <= 4 ? 2 : 1;
    return v;
  }, true);
  return { value: r.value + meldPts, blocks: r.blocks };
}

// ---------- Rule 5313 ------------------------------------------------------------
export function rule5313(hIn: HandInput): { value: number; blocks: Block[]; calling: boolean } {
  const { plain: h, jokers } = splitJokers(hIn);
  // exposed chows count 5; exposed pongs/kongs make All-Chow impossible
  if (h.melds.some((m) => m.type !== 'chow')) return { value: 0, blocks: [], calling: false };
  const meldPts = h.melds.length * 5 + jokers * 5;      // a wildcard completes a chow
  const calling = isCalling(hIn);
  const r = bestBlocks(countsOf(h.concealed), (bs) => {
    let chows = h.melds.length, two = 0, v = 0, eye = 0;
    for (const b of bs) {
      if (b.kind === 'triplet') { if (b.tiles[0] === b.tiles[1]) { /* pong: worthless for all-chow */ } else { chows++; v += 5; } }
      else if (b.kind === 'eye') { if (eye === 0) { eye = 1; v += 3; } }
      else if (b.kind === 'two') two++;
      else if (b.kind === 'one') v += 1;
    }
    for (let i = 1; i <= two; i++) v += chows + i <= 4 ? 3 : 1;
    return v;
  }, true);
  return { value: r.value + meldPts + (calling ? 1 : 0), blocks: r.blocks, calling };
}

// ---------- Rule 961 (per suit) -------------------------------------------------------
export function rule961(hIn: HandInput): { value: number; suit: 'wan' | 'tong' | 'sok' | null; blocks: Block[]; calling: boolean } {
  const { plain: h, jokers } = splitJokers(hIn);
  const calling = isCalling(hIn);
  let best = { value: -Infinity, suit: null as 'wan' | 'tong' | 'sok' | null, blocks: [] as Block[] };
  for (const suit of ['wan', 'tong', 'sok'] as const) {
    // exposed melds: only those in-suit or honours count (others make half-color impossible -> heavy penalty)
    let meldPts = 0, dead = false;
    for (const m of h.melds) { const k = m.tiles[0]!; if (isHonour(k) || suitOf(k) === suit) meldPts += 9; else dead = true; }
    if (dead) continue;
    const kinds = h.concealed.filter((k) => isHonour(k) || suitOf(k) === suit);
    const r = bestBlocks(countsOf(kinds), (bs) => {
      let v = 0; const used = new Set<number>();
      for (const b of bs) {
        if (b.kind === 'triplet') v += 9; else if (b.kind === 'eye' || b.kind === 'two' || b.kind === 'one') v += 6;
        b.tiles.forEach((_, i) => used.add(i));
      }
      return v;
    }, true);
    // singles: tiles not in any block, 1 each
    const inBlocks = r.blocks.reduce((a, b) => a + b.tiles.length, 0);
    const singles = kinds.length - inBlocks;
    const v = r.value + singles + meldPts + jokers * 9;   // a wildcard completes a triplet
    if (v > best.value) best = { value: v, suit, blocks: r.blocks };
  }
  return { ...best, value: best.value + (calling ? 3 : 0), calling };
}

// ---------- All-Pong breakdown -------------------------------------------------------
export function allPongBreakdown(hIn: HandInput): { triplets: number; pairs: number; key: string; chowsExposed: boolean } {
  const { plain: h, jokers } = splitJokers(hIn);
  const chowsExposed = h.melds.some((m) => m.type === 'chow');
  let triplets = h.melds.filter((m) => m.type !== 'chow').length, pairs = 0;
  const c = countsOf(h.concealed);
  for (let k = 0; k < KIND.STANDARD_COUNT; k++) { if (c[k]! >= 3) triplets++; else if (c[k] === 2) pairs++; }
  // each wildcard promotes a pair to a triplet, or stands alone as part of a new one
  let j = jokers;
  while (j > 0 && pairs > 0) { pairs--; triplets++; j--; }
  while (j >= 1) { pairs++; j--; }
  return { triplets, pairs, key: `${triplets}:${pairs}`, chowsExposed };
}

/** 13 Wonders breakdown: distinct wonder kinds held (max 13). */
export function thirteenBreakdown(hIn: HandInput): number {
  const { plain: h, jokers } = splitJokers(hIn);
  if (h.melds.length) return 0;
  const s = new Set(h.concealed.filter((k) => (isSuited(k) && (rankOf(k) === 1 || rankOf(k) === 9)) || isHonour(k)));
  return Math.min(13, s.size + jokers);
}
