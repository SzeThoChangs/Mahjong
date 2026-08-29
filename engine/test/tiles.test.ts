import { describe, it, expect } from 'vitest';
import { INSTANCE_KIND, TOTAL_TILES, kindOf, parseKinds, kindName, isAnimal, animalPartner, bonusSeat, KIND, JOKER_MAX } from '../src/tiles.js';

describe('tiles', () => {
  // The map is built out to JOKER_MAX so a table can play any wildcard count; the wall takes the
  // first `count` of them. Instances 0..147 keep their meaning whatever the count.
  it('has 148 standard instances (34 kinds x4 + 12 bonus x1) then jokers out to JOKER_MAX', () => {
    expect(INSTANCE_KIND.length).toBe(TOTAL_TILES + JOKER_MAX);
    expect(INSTANCE_KIND.slice(TOTAL_TILES).every((k) => k === 46)).toBe(true);
    const c = new Map<number, number>();
    for (const k of INSTANCE_KIND) c.set(k, (c.get(k) ?? 0) + 1);
    for (let k = 0; k < 34; k++) expect(c.get(k)).toBe(4);
    for (let k = 34; k < 46; k++) expect(c.get(k)).toBe(1);
    expect(c.get(46)).toBe(JOKER_MAX);
  });
  it('round-trips names', () => {
    const ks = parseKinds('1w 9t 5s E N R Wh F1 S4 A:cat');
    expect(ks.map(kindName)).toEqual(['1w','9t','5s','E','N','R','Wh','F1','S4','A:cat']);
  });
  it('animal partners and flower seats', () => {
    const [cat, mouse, rooster, centipede] = [42, 43, 44, 45];
    expect(animalPartner(cat)).toBe(mouse); expect(animalPartner(centipede)).toBe(rooster);
    expect(bonusSeat(KIND.FLOWER + 2)).toBe(2); expect(bonusSeat(KIND.SEASON)).toBe(0);
    expect(isAnimal(kindOf(147))).toBe(true);
  });
});
