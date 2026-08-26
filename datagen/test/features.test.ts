import { describe, it, expect } from 'vitest';
import { parseKinds } from 'sg-mahjong-engine';
import { shanten, ukeire, structure, unseenCounts } from 'sg-mahjong-engine';
const K = parseKinds;
describe('shanten', () => {
  it('complete hand = -1, calling = 0', () => {
    expect(shanten(K('1w 2w 3w 4t 5t 6t 7s 8s 9s E E E R R'), 0)).toBe(-1);
    expect(shanten(K('1w 2w 3w 4t 5t 6t 7s 8s 9s E E E R'), 0)).toBe(0);
    expect(shanten(K('2w 3w 4t 5t 6t 7s 8s 9s E E E R R'), 0)).toBe(0);
  });
  it('counts sets from melds', () => {
    expect(shanten(K('1w 2w 3w R R'), 3)).toBe(-1);
    expect(shanten(K('1w 2w R R'), 3)).toBe(0);
  });
  it('one and two away', () => {
    expect(shanten(K('1w 2w 3w 4t 5t 6t 7s 8s E E E R G'), 0)).toBe(1);     // need 9s + pair...: 7s8s partial, R G singles -> 1-shanten
    expect(shanten(K('1w 2w 3w 4t 5t 9t 7s 8s E E N R G'), 0)).toBe(3);   // 1 set, 2 partials, 1 pair, 4 singles -> 4 tiles short -> 3
  });
  it('13 wonders shanten', () => {
    expect(shanten(K('1w 9w 1t 9t 1s 9s E S W N R G Wh'), 0)).toBe(0);
    expect(shanten(K('1w 9w 1t 9t 1s 9s E S W N R G 5w'), 0)).toBe(1);
  });
  it('ukeire lists the tiles that help', () => {
    const hand = K('1w 2w 3w 4t 5t 6t 7s 8s 9s E E E R');
    const u = unseenCounts({ hand, allMelds: [], allDiscards: [] });
    const uk = ukeire(hand, 0, u);
    expect(uk.kinds).toEqual([31]); expect(uk.tiles).toBe(3);
  });
  it('structure counts', () => {
    const st = structure(K('1w 1w 5t 5t 5t 7s 8s 2w 9s E'));
    expect(st.pairs).toBe(1); expect(st.triplets).toBe(1); expect(st.sequences).toBe(1); expect(st.partialSeqs).toBe(2); expect(st.isolated).toBe(1); // 7s8s9s seq; 1w2w and 8s9s partials (overlap allowed); only E is isolated
  });
});
