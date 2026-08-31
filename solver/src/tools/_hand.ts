import { shanten } from 'sg-mahjong-engine';
import { rankDiscards } from '../rank.js';
import { loadTableConfig } from 'sg-mahjong-engine/node';
const NAME = (k: number) => k === 46 ? 'WILD' : k < 9 ? `${k+1}萬` : k < 18 ? `${k-8}筒` : k < 27 ? `${k-17}條` : (['東','南','西','北','中','發','白'][k-27] ?? '?');
// 1萬 1萬 2萬 4萬 · 5筒 7筒 9筒 · 1條 2條 8條 9條 · 白 白 · + wildcard
const hand = [0,0,1,3, 13,15,17, 18,19,25,26, 33,33, 46];
const cfg = loadTableConfig();
console.log('tiles:', hand.length, '—', hand.map(NAME).join(' '));
console.log('shanten WITHOUT the wildcard counted:', shanten(hand.filter((k) => k !== 46), 0));
console.log('shanten WITH it:', shanten(hand, 0), '  (0 = waiting to win)');

const ctx = {
  // 2 animals (1 fan each) + this seat's own flower (1 fan) = 3 fan already in hand
  seat: 0, prevailingWind: 0, bonus: [42, 43, 34] as number[], playerTurns: 10,
  minimumFan: (cfg.minimum_fan === 2 ? 2 : 1) as 1 | 2, selfDrawMinimumFan: cfg.self_draw_minimum_fan,
  visible: [] as number[], opponentMelds: [0, 0, 0],
};
const r = rankDiscards(hand, [], ctx);
console.log('\ncoach plan:', r.plan);
console.log('ranking:');
for (const o of r.options) {
  console.log(`  ${NAME(o.tile).padEnd(5)} ${o.chips.toFixed(2).padStart(7)}  ${o.delta === 0 ? 'BEST' : o.delta.toFixed(2).padStart(6)}  ${o.verdict.padEnd(8)} ${o.reasons.join(' · ')}`);
}
