/**
 * The tagger decides which questions the quiz can name a shape tip for, so a detector that fires on
 * the wrong hand puts a card in front of a player that has nothing to do with what they just did.
 * Each test below is one hand where the shape is unmistakable, plus the case that must NOT fire.
 */
import { describe, it, expect } from 'vitest';
import { parseKinds } from 'sg-mahjong-engine';
import { shapeCalls, liveCalls } from '../src/shapetag.js';

const call = (hand: string, tip: string) => shapeCalls(parseKinds(hand), 0).find((c) => c.tip === tip);
const tips = (hand: string) => shapeCalls(parseKinds(hand), 0).map((c) => c.tip);

describe('spotting the shape a decision is about', () => {
  it('picks between two loose tiles when one of them is a 3 or a 7', () => {
    // 3w and 6s have nothing within two ranks of them; the 9w is loose too but the tip is not about it
    const c = call('3w 6s 9w E E 2t 3t 4t 6t 7t 8t 1s 2s 3s', 'threes_and_sevens')!;
    expect(c).toBeDefined();
    expect(c.against).toEqual(parseKinds('3w'));
    expect(c.says).toEqual(parseKinds('6s'));
  });

  it('does not fire when the only loose tile is the 3', () => {
    expect(tips('3w 9w E E 2t 3t 4t 6t 7t 8t 1s 2s 3s 9s')).not.toContain('threes_and_sevens');
  });

  it('spots a spare sitting beside your own triplet', () => {
    const c = call('3w 4w 4w 4w 2t 3t 4t 6t 7t 8t 2s 3s 4s 9s', 'triplet_adjacency')!;
    expect(c).toBeDefined();
    expect(c.says).toEqual(parseKinds('3w'));       // the 3w, whose good draws you are holding
    expect(c.against).toEqual(parseKinds('9s'));    // the spare that is not beside anything of yours
  });

  it('does not call it when the triplet is nowhere near the spare', () => {
    expect(tips('3w 1s 1s 1s 2t 3t 4t 6t 7t 8t 5t 6t 9s 9s')).not.toContain('triplet_adjacency');
  });

  it('spots three pairs with something loose to throw instead', () => {
    const c = call('2w 2w 5w 5w 9s 9s 2t 3t 4t 6t 7t 8t E 3s', 'pair_rule')!;
    expect(c).toBeDefined();
    expect(c.says).toEqual(parseKinds('2w 5w 9s'));
    expect(c.against.length).toBeGreaterThan(0);
  });

  it('spots the choice between a wide wait and a lone-tile one', () => {
    const c = call('2w 3w 4w 5w 6w 7w 2t 3t 4t 6t 7t 8t 5s 5s', 'escape_single_waits')!;
    expect(c).toBeDefined();
    // 2-3-4-5-6-7萬 can be re-cut, so throwing either end leaves eleven tiles; the tidy throw leaves three
    expect(c.says).toEqual(parseKinds('2w 7w'));
    expect(c.against).toEqual(parseKinds('5s'));
  });

  it('says nothing at all about a hand holding a wildcard', () => {
    expect(shapeCalls(parseKinds('3w 6s 9w E E 2t 3t 4t 6t 7t 8t 1s 2s J'), 0)).toEqual([]);
  });

  it('drops a call when one side of it is not a throw on offer', () => {
    const hand = parseKinds('3w 6s 9w E E 2t 3t 4t 6t 7t 8t 1s 2s 3s');
    expect(liveCalls(hand, 0, hand).map((c) => c.tip)).toContain('threes_and_sevens');
    // the 3w is not among the tiles being ranked, so the tip has nothing to decide here
    expect(liveCalls(hand, 0, parseKinds('6s 2t 6t')).map((c) => c.tip)).not.toContain('threes_and_sevens');
  });
});

describe('the two waits that are the same size and not the same wait', () => {
  it('spots a terminal wait against a middle one', () => {
    // one set already exposed, three in hand, and a choice of which single tile to sit on: keep the
    // 9筒 and wait on the last three 9筒, or keep the 5筒 and wait on the last three 5筒
    const c = shapeCalls(parseKinds('2w 3w 4w 6w 7w 8w 2s 3s 4s 9t 5t'), 1).find((x) => x.tip === 'bad_wait_ranking')!;
    expect(c).toBeDefined();
    expect(c.says).toEqual(parseKinds('5t'));      // throw the 5筒, wait on the 9筒
    expect(c.against).toEqual(parseKinds('9t'));   // throw the 9筒, wait on the 5筒
  });

  it('spots two two-sided waits at different heights', () => {
    // 2筒3筒4筒 spare: throw the 4筒 and you wait on 1筒/4筒, throw the 2筒 and you wait on 2筒/5筒
    const c = shapeCalls(parseKinds('2w 3w 4w 6w 7w 8w 2s 3s 4s 9s 9s 2t 3t 4t'), 0).find((x) => x.tip === 'edge_waits_stronger')!;
    expect(c).toBeDefined();
    expect(c.says).toContain(parseKinds('4t')[0]);
    expect(c.against).toContain(parseKinds('2t')[0]);
  });
});
