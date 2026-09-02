/** Which fast bots can actually finish a colour hand? That, not overall strength, is what the
 *  grader has to be able to do - it is the plan our current grader cannot execute. */
import { runSim, ShantenBot, IsolationBot, RandomBot, type Bot } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot, FastCoachBot } from '../bot.js';
const cfg = loadTableConfig(), rules = loadTableRules();
const n = Number(process.argv[2] ?? 600);
const arms: [string, (r: () => number) => Bot][] = [
  ['isolation', (r) => new IsolationBot(r, 0.6, 0.4)],
  ['shanten', (r) => new ShantenBot(r)],
  ['random', (r) => new RandomBot(r)],
  ['coach', () => new CoachBot()],
  ['FAST COACH', () => new FastCoachBot()],
];
console.log('bot          ms/hand   colour hands   draws   avg tai');
for (const [name, make] of arms) {
  const t0 = performance.now();
  const st = runSim(n, (rng) => [0, 1, 2, 3].map(() => make(rng)), cfg, 11, rules);
  const ms = (performance.now() - t0) / n;
  const wins = Object.values(st.combos).reduce((a, b) => a + b, 0);
  const col = ((st.combos['ban_se'] ?? 0) + (st.combos['qing_yi_se'] ?? 0)) / Math.max(1, wins);
  console.log(`${name.padEnd(12)} ${ms.toFixed(2).padStart(6)}   ${(100 * col).toFixed(1).padStart(9)}%   ${(100 * st.draws / st.games).toFixed(1).padStart(5)}%   ${st.avgFan.toFixed(2)}`);
}
