/**
 * Who actually wins money? tsx src/sim.ts [games]
 *
 * Every other measurement in this project is accuracy against measured EVs, which is a proxy. This
 * plays whole games and reports chips per seat - the outcome the advice is supposed to produce.
 * Seats are rotated across the mixed tables so the dealer advantage does not decide it.
 */
import { runSim, formatStats, IsolationBot, makeRng } from 'sg-mahjong-engine';
import { loadTableConfig } from 'sg-mahjong-engine/node';
import { CoachBot, PolicyBot } from './bot.js';

const n = Number(process.argv[2] ?? 1000);
const cfg = loadTableConfig();
const t0 = Date.now();

console.log(formatStats(runSim(n, () => [0, 1, 2, 3].map(() => new CoachBot()), cfg, 11), 'coach x4'));
console.log(formatStats(runSim(n, () => [0, 1, 2, 3].map(() => new PolicyBot()), cfg, 11), 'model x4'));

// the comparison that matters: same table, one seat swapped. Run it in two seats so the result is
// not just the dealer's edge wearing a different hat.
console.log(formatStats(runSim(n, (rng) => [new PolicyBot(), new CoachBot(), new CoachBot(), new CoachBot()], cfg, 11), 'model (East) vs 3 coaches'));
console.log(formatStats(runSim(n, (rng) => [new CoachBot(), new CoachBot(), new CoachBot(), new PolicyBot()], cfg, 11), 'model (North) vs 3 coaches'));

console.log(formatStats(runSim(n, (rng) => [new PolicyBot(), new IsolationBot(rng), new IsolationBot(rng), new IsolationBot(rng)], cfg, 11), 'model (East) vs 3 isolation bots'));
console.log(formatStats(runSim(n, (rng) => [new CoachBot(), new IsolationBot(rng), new IsolationBot(rng), new IsolationBot(rng)], cfg, 11), 'coach (East) vs 3 isolation bots'));

console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
