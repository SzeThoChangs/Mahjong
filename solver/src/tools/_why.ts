/**
 * Find a real hand where the legal-wait rule changes the coach's answer, and print both sides.
 *
 * The point it makes, from seed 4242: the old coach throws 4筒 to reach a ready hand waiting on
 * 4萬 or 7萬, and BOTH of those complete a 0-tai chicken hand that cannot be declared at a 2-tai
 * table. It counted "am I ready" and "how many tiles finish me" and never asked whether finishing
 * would be legal. The new coach gives that up and keeps building.
 *
 *   ./node_modules/.bin/tsx src/tools/_why.ts
 */
import { makeRng, shanten, scoreHand } from 'sg-mahjong-engine';
import { loadTableConfig } from 'sg-mahjong-engine/node';
import { rankDiscards } from '../rank.js';

const NAME = (k: number) => (k < 9 ? `${k + 1}萬` : k < 18 ? `${k - 8}筒` : k < 27 ? `${k - 17}條` : (['東', '南', '西', '北', '中', '發', '白'][k - 27] ?? '?'));
const cfg = loadTableConfig();
const ctx = {
  seat: 0, prevailingWind: 0, bonus: [] as number[], playerTurns: 12,
  minimumFan: (cfg.minimum_fan === 2 ? 2 : 1) as 1 | 2, selfDrawMinimumFan: cfg.self_draw_minimum_fan,
  visible: [] as number[], opponentMelds: [0, 0, 0],
};
const rng = makeRng(4242);
for (let attempt = 0; attempt < 40000; attempt++) {
  const wall = Array.from({ length: 34 }, (_, k) => [k, k, k, k]).flat();
  for (let i = wall.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [wall[i], wall[j]] = [wall[j]!, wall[i]!]; }
  const hand = wall.slice(0, 14).sort((a, b) => a - b);
  const a = rankDiscards(hand, [], ctx, { legalWait: false });
  const b = rankDiscards(hand, [], ctx, { legalWait: true });
  if (a.best.tile === b.best.tile) continue;
  // only interesting when at least one of the two leaves a READY hand
  const restOf = (t: number) => { const r = [...hand]; r.splice(r.indexOf(t), 1); return r; };
  if (shanten(restOf(a.best.tile), 0) !== 0 && shanten(restOf(b.best.tile), 0) !== 0) continue;
  const wait = (t: number) => {
    const rest = restOf(t); const out: string[] = [];
    for (let k = 0; k < 34; k++) {
      if (rest.filter((x) => x === k).length >= 4) continue;
      const sc = scoreHand({ concealed: [...rest, k], melds: [], bonus: [], seat: 0, prevailingWind: 0, winningTile: k, selfDraw: false });
      if (shanten([...rest, k], 0) === -1) out.push(`${NAME(k)}${sc.valid && sc.fan >= ctx.minimumFan ? `=${sc.fan}tai` : '=dead'}`);
    }
    return out;
  };
  console.log('hand:', hand.map(NAME).join(' '), '\n');
  console.log(`OLD coach throws ${NAME(a.best.tile)}  -> wait: ${wait(a.best.tile).join('  ') || '(not ready)'}`);
  console.log(`NEW coach throws ${NAME(b.best.tile)}  -> wait: ${wait(b.best.tile).join('  ') || '(not ready)'}`);
  break;
}
