/**
 * Hand decomposition: does a set of concealed standard tiles form
 * (needSets) sets + 1 eye? Enumerates ALL decompositions, because Fan
 * depends on which one you pick (e.g. 111 222 333 vs 123 123 123).
 */
import { KIND, THIRTEEN_WONDER_KINDS, isSuited, rankOf, type Counts, type TileKind } from './tiles.js';

export type SetType = 'chow' | 'pong';
export interface ConcealedSet { type: SetType; tiles: TileKind[] }          // chow tiles ascending; pong = [k,k,k]
export interface Decomposition { sets: ConcealedSet[]; eye: TileKind }

export function decompose(counts: Counts, needSets: number): Decomposition[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== needSets * 3 + 2) return [];
  const out: Decomposition[] = [];
  const c = Uint8Array.from(counts);
  // try every eye
  for (let e = 0; e < KIND.STANDARD_COUNT; e++) {
    if (c[e]! < 2) continue;
    c[e] = c[e]! - 2;
    const sets: ConcealedSet[] = [];
    walk(c, 0, sets, needSets, (s) => out.push({ sets: s.map((x) => ({ type: x.type, tiles: [...x.tiles] })), eye: e }));
    c[e] = c[e]! + 2;
  }
  return dedupe(out);
}

function walk(c: Uint8Array, from: number, acc: ConcealedSet[], need: number, emit: (s: ConcealedSet[]) => void): void {
  if (acc.length === need) {
    // all counts must be zero
    for (let i = 0; i < c.length; i++) if (c[i]) return;
    emit(acc);
    return;
  }
  let i = from;
  while (i < c.length && !c[i]) i++;
  if (i >= c.length) return;
  // pong
  if (c[i]! >= 3) {
    c[i] = c[i]! - 3;
    acc.push({ type: 'pong', tiles: [i, i, i] });
    walk(c, i, acc, need, emit);
    acc.pop();
    c[i] = c[i]! + 3;
  }
  // chow (suited, rank <= 7, same suit)
  if (isSuited(i) && rankOf(i) <= 7 && c[i + 1]! > 0 && c[i + 2]! > 0) {
    c[i]!--; c[i + 1]!--; c[i + 2]!--;
    acc.push({ type: 'chow', tiles: [i, i + 1, i + 2] });
    walk(c, i, acc, need, emit);
    acc.pop();
    c[i]!++; c[i + 1]!++; c[i + 2]!++;
  }
}

function dedupe(ds: Decomposition[]): Decomposition[] {
  const seen = new Set<string>();
  const out: Decomposition[] = [];
  for (const d of ds) {
    const key = d.eye + '|' + d.sets.map((s) => s.type[0] + s.tiles.join('')).sort().join(',');
    if (!seen.has(key)) { seen.add(key); out.push(d); }
  }
  return out;
}

/** Thirteen Wonders: all 13 wonder kinds present, one of them doubled, 14 tiles, no exposed sets. */
export function isThirteenWonders(counts: Counts): boolean {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i]!;
  if (total !== 14) return false;
  let doubled = 0;
  for (const k of THIRTEEN_WONDER_KINDS) {
    const n = counts[k]!;
    if (n === 0 || n > 2) return false;
    if (n === 2) doubled++;
  }
  return doubled === 1;
}

/**
 * Which kinds would complete this (3n+1) concealed hand? Used for Calling
 * detection and for the All-Chow "two or more unique winning tiles" rule.
 */
export function winningKinds(counts: Counts, needSets: number): TileKind[] {
  const out: TileKind[] = [];
  for (let k = 0; k < KIND.STANDARD_COUNT; k++) {
    if (counts[k]! >= 4) continue;
    counts[k]!++;
    const ok = decompose(counts, needSets).length > 0 || (needSets === 4 && isThirteenWonders(counts));
    counts[k]!--;
    if (ok) out.push(k);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Jokers (wild tiles)
// ---------------------------------------------------------------------------
import { isSuited as _isSuited, rankOf as _rankOf } from './tiles.js';

/** One way to complete a hand using jokers: which kinds the jokers stand for, plus any groups made entirely of jokers. */
export interface JokerCompletion { jokerKinds: TileKind[]; freeSets: number; freeEye: boolean }

/**
 * All ways the `jokers` wild tiles can complete `counts` into (needSets) sets + eye.
 * Jokers may stand for any standard tile (a 5th copy is allowed). Groups made only of
 * jokers are reported as `freeSets` / `freeEye` because their identity is the scorer's choice.
 */
export function jokerCompletions(counts: Counts, jokers: number, needSets: number): JokerCompletion[] {
  const total = counts.reduce((a, b) => a + b, 0) + jokers;
  if (total !== needSets * 3 + 2) return [];
  const out: JokerCompletion[] = []; const seen = new Set<string>();
  const c = Uint8Array.from(counts);
  const emit = (assign: TileKind[], freeSets: number, freeEye: boolean) => {
    const key = [...assign].sort((a, b) => a - b).join(',') + '|' + freeSets + '|' + (freeEye ? 1 : 0);
    if (!seen.has(key)) { seen.add(key); out.push({ jokerKinds: [...assign], freeSets, freeEye }); }
  };
  const rec = (from: number, jl: number, setsLeft: number, eyeTaken: boolean, assign: TileKind[]) => {
    let i = from; while (i < KIND.STANDARD_COUNT && !c[i]) i++;
    if (i >= KIND.STANDARD_COUNT) {
      const needTiles = setsLeft * 3 + (eyeTaken ? 0 : 2);
      if (jl === needTiles) emit(assign, setsLeft, !eyeTaken);
      return;
    }
    // pong at i: r real + (3-r) jokers
    for (let r = Math.min(3, c[i]!); r >= 1; r--) {
      const j = 3 - r; if (j > jl || setsLeft === 0) continue;
      c[i] = c[i]! - r; for (let x = 0; x < j; x++) assign.push(i);
      rec(i, jl - j, setsLeft - 1, eyeTaken, assign);
      for (let x = 0; x < j; x++) assign.pop(); c[i] = c[i]! + r;
    }
    // eye at i: r real + (2-r) jokers
    if (!eyeTaken) for (let r = Math.min(2, c[i]!); r >= 1; r--) {
      const j = 2 - r; if (j > jl) continue;
      c[i] = c[i]! - r; for (let x = 0; x < j; x++) assign.push(i);
      rec(i, jl - j, setsLeft, true, assign);
      for (let x = 0; x < j; x++) assign.pop(); c[i] = c[i]! + r;
    }
    // chows containing i (i is the lowest real tile present, so anything below i must be a joker)
    if (_isSuited(i) && setsLeft > 0) {
      const r = _rankOf(i);
      for (const offs of [[-2, -1, 0], [-1, 0, 1], [0, 1, 2]] as const) {
        if (r + offs[0] < 1 || r + offs[2] > 9) continue;
        const others = offs.filter((o) => o !== 0).map((o) => i + o);
        // each other tile: real if available and above i, else joker; enumerate real-or-joker for the ones above i
        const choices: TileKind[][] = [[]];
        let ok = true;
        for (const k of others) {
          const next: TileKind[][] = [];
          for (const ch of choices) {
            next.push([...ch, -1 - k]);                       // joker standing for k (encoded negative)
            if (k > i && c[k]! > 0) next.push([...ch, k]);    // real
          }
          choices.length = 0; choices.push(...next);
          if (!next.length) ok = false;
        }
        if (!ok) continue;
        for (const ch of choices) {
          const jokersNeeded = ch.filter((x) => x < 0).length;
          if (jokersNeeded > jl) continue;
          const reals = ch.filter((x) => x >= 0);
          // a real tile used twice in one template is impossible; templates have distinct kinds so fine
          c[i]!--; for (const k of reals) c[k]!--;
          for (const x of ch) if (x < 0) assign.push(-1 - x);
          rec(i, jl - jokersNeeded, setsLeft - 1, eyeTaken, assign);
          for (const x of ch) if (x < 0) assign.pop();
          for (const k of reals) c[k]!++; c[i]!++;
        }
      }
    }
  };
  rec(0, jokers, needSets, false, []);
  return out;
}

/** 13 Wonders with jokers: missing wonders (and the pair) may be jokers. Returns the kinds the jokers must stand for, or null. */
export function thirteenWithJokers(counts: Counts, jokers: number): TileKind[] | null {
  let total = jokers; for (let i = 0; i < counts.length; i++) total += counts[i]!;
  if (total !== 14) return null;
  const missing: TileKind[] = []; let extra = 0; let pairKind: TileKind = -1;
  for (const k of THIRTEEN_WONDER_KINDS) { const n = counts[k]!; if (n === 0) missing.push(k); else if (n === 2) { if (pairKind >= 0) return null; pairKind = k; } else if (n > 2) return null; }
  for (let k = 0; k < counts.length; k++) if (counts[k]! && !THIRTEEN_WONDER_KINDS.includes(k)) extra += counts[k]!;
  if (extra) return null;
  const need = missing.length + (pairKind >= 0 ? 0 : 1);
  if (need !== jokers) return null;
  return pairKind >= 0 ? missing : [...missing, THIRTEEN_WONDER_KINDS[0]!];   // free pair: call it 1-wan
}
