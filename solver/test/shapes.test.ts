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
      if (t.claim.kind === 'closer-to-ready' || t.claim.kind === 'not-countable') continue;
      const [a, b] = t.claim.kind === 'level' ? [t.claim.a, t.claim.b]
        : t.claim.kind === 'upgrades-more' ? [t.claim.better, t.claim.than]
        : [t.claim.better, t.claim.than];
      expect(t.variants[a]!.shanten, `${t.id}: comparing hands at different shanten proves nothing`)
        .toBe(t.variants[b]!.shanten);
    }
  });

  it('every example is a legal 13-tile hand holding at most four of any tile', () => {
    for (const t of SHAPE_TIPS) for (const v of t.variants) {
      const tiles = v.blocks.flat();
      expect(tiles, `${t.id} / ${v.label}`).toHaveLength(13);
      const n = new Map<number, number>();
      for (const k of tiles) n.set(k, (n.get(k) ?? 0) + 1);
      for (const [k, c] of n) expect(c, `${t.id}: five copies of kind ${k}`).toBeLessThanOrEqual(4);
    }
  });

  it('every hand is split into blocks, and the highlighted ones exist', () => {
    // a card about blocks has to show blocks: no example may be one undivided lump
    for (const t of SHAPE_TIPS) for (const v of t.variants) {
      expect(v.blocks.length, `${t.id} / ${v.label}: not split into blocks`).toBeGreaterThan(1);
      for (const b of v.blocks) expect(b.length, `${t.id}: empty block`).toBeGreaterThan(0);
      for (const i of v.focus) expect(v.blocks[i], `${t.id}: focus ${i} is not a block`).toBeDefined();
    }
  });

  it('counts the tiles that improve a hand, and only those', () => {
    // 13 tiles, one tile from ready, waiting to pair up the lone 9s: only a 9s improves it
    const u = ukeire(parseKinds('2w 3w 4w 6w 7w 8w 2t 3t 4t 6t 7t 8t 9s'));
    expect(u.sh).toBe(0);
    expect(u.kinds).toBe(1);
    expect(u.count).toBe(3);         // three 9s left
  });

  it('says whose tiles each card shows', () => {
    // a verdict on OUR reading of a tip is worth less than one on the book's own diagram, so the
    // card must never leave that ambiguous
    for (const t of SHAPE_TIPS) expect(['book', 'ours'], t.id).toContain(t.shapeFrom);
  });

  it('says out loud which tips do NOT hold at this table', () => {
    // Not a style check: the page's honesty depends on these staying marked. If a verdict is ever
    // quietly upgraded to make the tutorial tidier, this fails.
    const byId = Object.fromEntries(SHAPE_TIPS.map((t) => [t.id, t.verdict]));
    expect(byId['four_tile_ranking']).toBe('contradicted');
    expect(byId['threes_and_sevens']).toBe('needs-play');
    expect(byId['bad_wait_ranking']).toBe('needs-play');
  });
});
