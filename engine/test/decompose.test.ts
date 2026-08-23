import { describe, it, expect } from 'vitest';
import { decompose, isThirteenWonders, winningKinds } from '../src/decompose.js';
import { countsOf, parseKinds } from '../src/tiles.js';

const C = (s: string) => countsOf(parseKinds(s));

describe('decompose', () => {
  it('finds a plain 4-set hand', () => {
    const d = decompose(C('1w 2w 3w 4t 5t 6t 7s 8s 9s E E E R R'), 4);
    expect(d.length).toBe(1);
    expect(d[0]!.eye).toBe(31);
  });
  it('enumerates ambiguous hands (111 222 333 vs 123 x3)', () => {
    const d = decompose(C('1w 1w 1w 2w 2w 2w 3w 3w 3w 9t 9t 9t S S'), 4);
    expect(d.length).toBe(2);
  });
  it('rejects incomplete hands', () => {
    expect(decompose(C('1w 2w 4w 4t 5t 6t 7s 8s 9s E E E R R'), 4)).toEqual([]);
  });
  it('respects exposed melds (fewer sets needed)', () => {
    expect(decompose(C('1w 2w 3w R R'), 1).length).toBe(1);
  });
  it('detects 13 wonders', () => {
    expect(isThirteenWonders(C('1w 9w 1t 9t 1s 9s E S W N R G Wh E'))).toBe(true);
    expect(isThirteenWonders(C('1w 9w 1t 9t 1s 9s E S W N R G Wh 2w'))).toBe(false);
  });
  it('lists winning kinds for a calling hand', () => {
    // 2w3w waits on 1w and 4w (two-sided)
    const outs = winningKinds(C('2w 3w 4t 5t 6t 7s 8s 9s E E E R R'), 4);
    expect(outs.map(String).sort()).toEqual(['0', '3']);
  });
});
