/**
 * A tutorial that asserts numbers is a tutorial that quietly goes stale.
 *
 * Every card in the Shapes tab shows an example hand and a count of the tiles that improve it, and
 * the count is worked out from the hand rather than typed in. This test holds the two together: if
 * an example is edited, or the engine's shanten changes, and a card stops demonstrating the thing it
 * claims, the suite fails instead of the page quietly teaching something untrue.
 *
 * The first draft of that file needed this badly. Four of ten cards did not show what their text
 * said, and one showed the opposite, because the examples compared a ready hand against a one-away
 * hand - and the accepting-tile counts of hands at different distances are not comparable at all.
 */
import { describe, it, expect } from 'vitest';
import { SHAPE_TIPS, holds, ukeire } from '../src/shapes.js';
import { parseKinds } from 'sg-mahjong-engine';

describe('the hand-shape tips', () => {
  it('every card still demonstrates what it claims', () => {
    const broken = SHAPE_TIPS.filter((t) => !holds(t)).map((t) => t.id);
    expect(broken).toEqual([]);
  });

  it('compares like with like: a claim about width is between hands the same distance from ready', () => {
    for (const t of SHAPE_TIPS) {
      if (t.claim.kind !== 'accepts-more' && t.claim.kind !== 'level') continue;
      const [a, b] = t.claim.kind === 'accepts-more' ? [t.claim.better, t.claim.than] : [t.claim.a, t.claim.b];
      expect(t.variants[a]!.shanten, `${t.id}: comparing hands at different shanten proves nothing`)
        .toBe(t.variants[b]!.shanten);
    }
  });

  it('every example is a legal 13-tile hand holding at most four of any tile', () => {
    for (const t of SHAPE_TIPS) for (const v of t.variants) {
      expect(v.tiles, `${t.id} / ${v.label}`).toHaveLength(13);
      const n = new Map<number, number>();
      for (const k of v.tiles) n.set(k, (n.get(k) ?? 0) + 1);
      for (const [k, c] of n) expect(c, `${t.id}: five copies of kind ${k}`).toBeLessThanOrEqual(4);
    }
  });

  it('the highlighted tiles are actually in the hand', () => {
    for (const t of SHAPE_TIPS) for (const v of t.variants) {
      for (const k of v.focus) expect(v.tiles, `${t.id} / ${v.label}`).toContain(k);
    }
  });

  it('counts the tiles that improve a hand, and only those', () => {
    // 13 tiles, one tile from ready, waiting to pair up the lone 9s: only a 9s improves it
    const u = ukeire(parseKinds('2w 3w 4w 6w 7w 8w 2t 3t 4t 6t 7t 8t 9s'));
    expect(u.sh).toBe(0);
    expect(u.kinds).toBe(1);
    expect(u.count).toBe(3);         // three 9s left
  });

  it('says out loud which tips do NOT hold at this table', () => {
    // Not a style check: the page's honesty depends on these staying marked. If a verdict is ever
    // quietly upgraded to make the tutorial tidier, this fails.
    const byId = Object.fromEntries(SHAPE_TIPS.map((t) => [t.id, t.verdict]));
    expect(byId['four_tile_ranking']).toBe('contradicted');
    expect(byId['triplet_adjacency']).toBe('contradicted');
    expect(byId['threes_and_sevens']).toBe('needs-play');
    expect(byId['bad_wait_ranking']).toBe('needs-play');
  });
});
