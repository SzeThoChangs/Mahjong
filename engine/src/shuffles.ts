/**
 * The named shuffle library: `shuffle-00001` is always the same 152 tiles in the same order.
 *
 * Every comparison in this project is paired on the wall - both arms play deal g from the same
 * shuffle - because deal luck swamps everything else. What was missing is a NAME. Each run picked a
 * seed number of its own, so a result from last week and one from today were measured on different
 * deals and could not be laid side by side, and FINDINGS carries a caveat on every per-seat figure
 * measured before that was noticed.
 *
 * Nothing is stored. A shuffle is completely determined by its seed, so the library is generated on
 * demand and is endless: take shuffles 1-50 for a quick look, 1-8,000 for a batch, 40,001-200,000
 * for deals nothing has been fitted on. Taking a later range is how you get FRESH deals; there is no
 * file to regenerate and no way to run out.
 *
 * Numbered from 1, like the seats and for the same reason.
 *
 * `shuffle-00001` onwards reproduces, tile for tile, the deals every result recorded against "wall
 * seed base 11" was measured on. That was the default for most of this project's history, so the
 * library starts where the evidence already is rather than orphaning it.
 *
 * WHAT WOULD BREAK IT: a name is only worth having if it keeps meaning the same tiles. Change the
 * shuffle in `Wall`, change `makeRng`, or change how many wildcards the table deals, and every name
 * silently points at a different deal - which would quietly invalidate every comparison made across
 * the change. `fingerprintOf` exists to make that loud instead of silent, and `test/shuffles.test.ts`
 * pins the first few so the suite fails the moment it happens.
 */
import { makeRng, Wall } from './wall.js';


/** the historical default; shuffle 1 is the wall that "seed base 11, game 0" dealt */
const ANCHOR = 11 * 1000003;

/** The seed behind a named shuffle. `n` counts from 1. */
export function shuffleSeed(n: number): number {
  if (!Number.isInteger(n) || n < 1) throw new Error(`shuffle numbers count from 1, got ${n}`);
  return ANCHOR + (n - 1);
}

/** `shuffle-00042`. Zero-padded to five so a listing sorts the way a person reads it. */
export function shuffleName(n: number): string {
  return `shuffle-${String(n).padStart(5, '0')}`;
}

/** The wall named by `n`, dealt for this table. Same number and same table, same tiles, always. */
export function shuffleWall(n: number, unplayable = 15, jokers = 0): Wall {
  return new Wall(makeRng(shuffleSeed(n)), unplayable, jokers);
}

/** Shuffles `from`..`from + count - 1`, the slice a run works through. */
export function shuffleRange(from: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => from + i);
}

/**
 * A short hash of the tile order a name produces, so a name that has quietly started meaning a
 * different deal can be caught. Compare against the pinned values in the test, not by eye.
 */
export function fingerprintOf(n: number, unplayable = 15, jokers = 0): string {
  const tiles = shuffleWall(n, unplayable, jokers).snapshot().order;
  let h = 0x811c9dc5;
  for (const t of tiles) { h ^= t; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
