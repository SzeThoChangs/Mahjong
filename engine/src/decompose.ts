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
