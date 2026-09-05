/**
 * The tagger decides which questions the quiz can name a shape tip for, so a detector that fires on
 * the wrong hand puts a card in front of a player that has nothing to do with what they just did.
 * Each test below is one hand where the shape is unmistakable, plus the case that must NOT fire.
 */
import { describe, it, expect } from 'vitest';
import { parseKinds } from 'sg-mahjong-engine';
import { shapeCalls, liveCalls, blockCount, blocks } from '../src/shapetag.js';

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

describe('the two detectors that need more than the tiles', () => {
  it('counts blocks the generous way', () => {
    // three sets, a pair and two two-tile pieces: six blocks
    expect(blockCount(parseKinds('2w 3w 4w 9w 9w 3t 4t 6t 8t 3s 4s 6s 8s'))).toBe(6);
    // the same tiles with the loose pieces replaced by lone honours: four blocks
    expect(blockCount(parseKinds('2w 3w 4w 9w 9w 3t 4t 6t 8t 3s 4s E S'))).toBe(5);
  });

  it('splits a hand into named blocks, settling ties in a fixed order', () => {
    const kinds = (hand: string) => blocks(parseKinds(hand)).map((b) => `${b.kind}:${b.tiles.join(',')}`).sort();
    // a set beats an edge piece with a spare; an open piece beats a gap piece with a spare
    expect(kinds('1w 2w 3w')).toEqual(['set:0,1,2']);
    expect(kinds('2w 4w 5w')).toEqual(['open:3,4']);
    // the generous count still wins first: 2-3-4-5 is two open pieces, not one run and a spare
    expect(kinds('2w 3w 4w 5w')).toEqual(['open:1,2', 'open:3,4']);
    // 1-2 and 8-9 are edge pieces, a hole between two tiles is a gap, honours only pair or triple
    expect(kinds('1t 2t 8t 9t 4s 6s E E S S S')).toEqual(['edge:16,17', 'edge:9,10', 'gap:21,23', 'pair:27,27', 'set:28,28,28']);
  });

  it('counts the same blocks it names, on any hand', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 300; i++) {
      const hand: number[] = [];
      while (hand.length < 14) { const k = Math.floor(rand() * 34); if (hand.filter((x) => x === k).length < 4) hand.push(k); }
      expect(blocks(hand).length).toBe(blockCount(hand));
    }
  });

  it('spots a hand carrying a sixth block it can drop for free', () => {
    // six blocks and a lone honour: throwing the honour keeps all six, throwing from a block cuts one.
    // Three open pieces and one gap piece, so the weakest two are not both gaps and the rule applies.
    const hand = '2w 3w 4w 9w 9w 3t 4t 6t 7t 3s 4s 6s 8s E';
    const c = shapeCalls(parseKinds(hand), 0).find((x) => x.tip === 'five_blocks')!;
    expect(c).toBeDefined();
    expect(c.against).toEqual(parseKinds('E'));
    expect(c.says).toContain(parseKinds('3t')[0]);
    expect(tips(hand)).not.toContain('six_blocks_ok');
  });

  it('keeps the sixth block when the two weakest pieces are both gap waits', () => {
    // the card's own example hand with a lone honour added: two open pieces, two gap pieces
    const hand = '2w 3w 4w 9w 9w 3t 4t 6t 8t 3s 4s 6s 8s E';
    const c = shapeCalls(parseKinds(hand), 0).find((x) => x.tip === 'six_blocks_ok')!;
    expect(c).toBeDefined();
    expect(c.says).toEqual(parseKinds('E'));
    // the throws it warns against all come from the two weakest gap pieces, never from the open one
    expect(c.against.length).toBeGreaterThan(0);
    for (const k of c.against) expect(parseKinds('6t 8t 6s 8s')).toContain(k);
    expect(c.against).not.toContain(parseKinds('3t')[0]);
    expect(c.because).toMatch(/both gap waits/);
    // and the rule it is an exception to stays silent on the same hand
    expect(tips(hand)).not.toContain('five_blocks');
  });

  it('does not keep six when one of the two weakest is an edge piece', () => {
    // an open piece, an edge piece and two gap pieces: the weakest two are the edge and a gap
    const hand = '2w 3w 4w 9w 9w 3t 4t 8t 9t 6s 8s 1s 3s E';
    expect(blockCount(parseKinds(hand))).toBe(6);
    expect(tips(hand)).not.toContain('six_blocks_ok');
    expect(tips(hand)).toContain('five_blocks');
  });

  // a real position from the coach pack, where one way of staying ready wins nothing declarable
  const deadWait = parseKinds('3s 2s 4s 8w 6w 3s 4t 3s 8t 7t 4s 5t 7w 9t');
  const view = { bonus: parseKinds('S1 F4 S3'), seat: 2, prevailingWind: 1, minimumFan: 2, selfDrawMinimumFan: 1 };

  it('spots a wide wait that cannot be declared', () => {
    const c = shapeCalls(deadWait, 0, view).find((x) => x.tip === 'narrow_can_beat_wide')!;
    expect(c).toBeDefined();
    expect(c.because).toMatch(/can be declared at this table/);
  });

  it('says nothing about declaring when the caller cannot say what table it is', () => {
    expect(shapeCalls(deadWait, 0).map((x) => x.tip)).not.toContain('narrow_can_beat_wide');
  });

  it('stays quiet on a melded hand it cannot score', () => {
    // the meld count says one set is on the table but the view does not carry it
    expect(shapeCalls(deadWait.slice(0, 11), 1, view).map((x) => x.tip)).not.toContain('narrow_can_beat_wide');
  });
});
