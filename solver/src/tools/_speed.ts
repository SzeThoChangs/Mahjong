/** How much does a play-out cost per hand, by the policy playing it? Decides whether the evaluator
 *  can afford competent rollouts, which is what the LABELS are measured under. */
import { runSim, ShantenBot, IsolationBot, makeRng } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot, PolicyBot } from '../bot.js';
const cfg = loadTableConfig(), rules = loadTableRules();
const n = Number(process.argv[2] ?? 300);
for (const [name, make] of [
  ['isolation (policy=fast)', (r: () => number) => new IsolationBot(r, 0.6, 0.4)],
  ['shanten   (run-money4)', (r: () => number) => new ShantenBot(r)],
  ['coach', () => new CoachBot()],
  ['policy model', () => new PolicyBot()],
] as const) {
  const t0 = Date.now();
  runSim(n, (rng) => [0, 1, 2, 3].map(() => make(rng)), cfg, 11, rules);
  const ms = (Date.now() - t0) / n;
  console.log(`${name.padEnd(24)} ${ms.toFixed(2)} ms/hand`);
}
