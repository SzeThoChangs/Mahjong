/**
 * The named shuffle library must keep its promise: `shuffle-00001` is the same 152 tiles in the
 * same order today as it was when a result was recorded against it.
 *
 * These fingerprints are pinned deliberately. If one of them changes, the shuffle in `Wall`, the
 * random number generator, or the deck itself has moved, and EVERY comparison made across that
 * change is now between different deals - silently, unless this test says so. If that happens on
 * purpose, re-pin them in the same commit and say in FINDINGS which results predate the change.
 */
import { describe, it, expect } from 'vitest';
import { fingerprintOf, shuffleName, shuffleSeed, shuffleWall, makeRng, Wall } from '../src/index.js';

const UNPLAYABLE = 15, JOKERS = 4;   // this table

describe('the named shuffle library', () => {
  it('names shuffles from 1, the way the seats are numbered', () => {
    expect(shuffleName(1)).toBe('shuffle-00001');
    expect(shuffleName(42)).toBe('shuffle-00042');
    expect(() => shuffleSeed(0)).toThrow();
    expect(() => shuffleSeed(-1)).toThrow();
  });

  it('gives the same tiles in the same order every time it is asked', () => {
    const a = shuffleWall(7, UNPLAYABLE, JOKERS).snapshot().order;
    const b = shuffleWall(7, UNPLAYABLE, JOKERS).snapshot().order;
    expect(a).toEqual(b);
  });

  it('gives DIFFERENT tiles for different names', () => {
    const a = shuffleWall(7, UNPLAYABLE, JOKERS).snapshot().order;
    const b = shuffleWall(8, UNPLAYABLE, JOKERS).snapshot().order;
    expect(a).not.toEqual(b);
  });

  it('deals the table its full 152 tiles when it plays four wildcards', () => {
    expect(shuffleWall(1, UNPLAYABLE, JOKERS).snapshot().order).toHaveLength(152);
    expect(shuffleWall(1, UNPLAYABLE, 0).snapshot().order).toHaveLength(148);
  });

  it('starts where the existing evidence is: shuffle 1 is the old "seed base 11, game 0" wall', () => {
    const legacy = new Wall(makeRng(11 * 1000003), UNPLAYABLE, JOKERS).snapshot().order;
    expect(shuffleWall(1, UNPLAYABLE, JOKERS).snapshot().order).toEqual(legacy);
  });

  it('still means the same deals it meant when these were pinned', () => {
    expect(fingerprintOf(1, UNPLAYABLE, JOKERS)).toBe('71e2bb49');
    expect(fingerprintOf(2, UNPLAYABLE, JOKERS)).toBe('7c64c077');
    expect(fingerprintOf(3, UNPLAYABLE, JOKERS)).toBe('8a3cb8f5');
    expect(fingerprintOf(50, UNPLAYABLE, JOKERS)).toBe('3924c1b7');
    expect(fingerprintOf(8000, UNPLAYABLE, JOKERS)).toBe('e6079975');
  });
});
