/**
 * Does the coach already play the book's shape tips, without being told them?
 *
 * The tips are human heuristics for "which shape accepts more". The coach computes acceptance
 * directly, so it may get the same answers by arithmetic that a person gets by pattern. If it
 * already plays them, teaching it the tips changes nothing - and every read tested so far has been
 * true and worth nothing, so that is the way to bet until measured.
 */
import { rankDiscards } from '../rank.js';
import { SHAPE_TIPS } from '../shapes.js';
import { kindName, parseKinds, type TileKind } from 'sg-mahjong-engine';
import type { Context } from '../targets.js';

const ctx = {
  seat: 0, prevailingWind: 0, bonus: [], playerTurns: 12,
  minimumFan: 2 as const, selfDrawMinimumFan: 1, visible: [],
} as unknown as Context;

for (const t of SHAPE_TIPS) {
  console.log(`\n${t.id}`);
  for (const v of t.variants) {
    // give it the hand plus one drawn tile so there is something to throw
    const hand = [...v.blocks.flat(), parseKinds('1s')[0]!] as TileKind[];
    const r = rankDiscards(hand, [], ctx);
    const keeps = (blk: TileKind[]) => !blk.includes(r.best.tile);
    const focusKept = v.focus.every((i) => keeps(v.blocks[i]!));
    console.log(`  ${v.label.padEnd(44)} throws ${kindName(r.best.tile).padEnd(4)} ${focusKept ? 'keeps the shape' : 'BREAKS the shape'}`);
  }
}
