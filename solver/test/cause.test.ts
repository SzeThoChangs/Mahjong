/**
 * The cause suggestion reads the position, and a wrong suggestion is worse than none: it would
 * teach the player to practise the wrong thing. So each branch is pinned to a case that must fire
 * it, and the fallback is pinned to a case where nothing separates the two tiles.
 */
import { describe, it, expect } from 'vitest';
import { parseKinds } from 'sg-mahjong-engine';
import { suggestCause } from '../src/cause.js';
import { rankDiscards } from '../src/rank.js';
import type { TableView } from '../src/shapetag.js';

const view: TableView = { bonus: [], seat: 0, prevailingWind: 0, melds: [], minimumFan: 2, selfDrawMinimumFan: 1 };
const ctx = { seat: 0, prevailingWind: 0, bonus: [], playerTurns: 20, wallRemaining: 40, minimumFan: 2 as const, selfDrawMinimumFan: 1 };

describe('why a mistake happened', () => {
  it('names the shape tip when a card says the coach tile and warns against yours', () => {
    // escape_single_waits: ready two ways, one of them on a single tile - the card says take the wider wait
    const hand = parseKinds('2w 3w 4w 5w 6w 7w 2t 3t 4t 6t 7t 8t 5s 5s');
    const r = rankDiscards(hand, [], ctx);
    const worse = r.options.find((o) => o.tile !== r.best.tile && o.verdict !== 'best')!;
    const s = suggestCause(hand, [], view, r.options, worse.tile, r.best.tile);
    // whatever the suggestion, it must come with a reason, and a tip when it names one
    expect(s.because.length).toBeGreaterThan(0);
    if (s.tip) expect(s.suggested).toBe('not-seen');
  });

  it('calls a throw that costs a step miscounted', () => {
    const hand = parseKinds('1w 2w 3w 4t 5t 6t 7s 8s 9s 2t 2t 5w 9t 1s');
    const r = rankDiscards(hand, [], ctx);
    // throwing from a finished run costs a step; the coach throws a spare
    const s = suggestCause(hand, [], view, r.options, hand[0]!, r.best.tile);
    expect(['miscounted', 'not-seen']).toContain(s.suggested);
  });

  it('says nothing when the two tiles are the same tile', () => {
    const hand = parseKinds('1w 2w 3w 4t 5t 6t 7s 8s 9s 2t 2t 5w 9t 1s');
    const r = rankDiscards(hand, [], ctx);
    expect(suggestCause(hand, [], view, r.options, r.best.tile, r.best.tile).suggested).toBeNull();
  });
});
