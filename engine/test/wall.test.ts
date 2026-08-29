import { describe, it, expect } from 'vitest';
import { Wall, makeRng } from '../src/wall.js';
import { TOTAL_TILES, isJoker, kindOf, JOKER_MAX } from '../src/tiles.js';

describe('wall', () => {
  it('is reproducible and contains every tile once', () => {
    const a = new Wall(makeRng(7)), b = new Wall(makeRng(7));
    const seen = new Set<number>();
    const da = a.dealMany(133), db = b.dealMany(133);
    expect(da).toEqual(db);
    for (const t of da) seen.add(t);
    expect(seen.size).toBe(133);
  });
  it('reserves the last 15 tiles from both ends', () => {
    const w = new Wall(makeRng(1), 15);
    expect(w.remaining).toBe(TOTAL_TILES - 15);
    w.dealMany(100);
    expect(w.remaining).toBe(33);
    for (let i = 0; i < 33; i++) expect(w.drawReplacement()).not.toBeNull();
    expect(w.isExhausted).toBe(true);
    expect(w.draw()).toBeNull();
    expect(w.drawReplacement()).toBeNull();
  });
});

describe('wildcard count', () => {
  // Regression: the constructor used to read `jokers` as a FLAG - any non-zero gave the standard
  // four - so a table configured for 12 silently played with 4.
  it('puts exactly as many wildcards in the wall as asked for', () => {
    for (const n of [0, 1, 4, 8, 12, 16]) {
      const w = new Wall(makeRng(7), 15, n);
      const jokers = w.snapshot().order.filter((t) => isJoker(kindOf(t))).length;
      expect(jokers).toBe(n);
      expect(w.size).toBe(TOTAL_TILES + n);
    }
  });
  it('clamps a silly count to JOKER_MAX rather than dealing tiles that do not exist', () => {
    const w = new Wall(makeRng(7), 15, 999);
    expect(w.snapshot().order.filter((t) => isJoker(kindOf(t))).length).toBe(JOKER_MAX);
  });
});
