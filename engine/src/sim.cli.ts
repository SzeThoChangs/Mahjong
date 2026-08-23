import { runSim, formatStats } from './sim.js';
import { loadTableConfig } from './config.node.js';
import { IsolationBot, RandomBot } from './bots.js';
// CLI: tsx src/sim.ts [games] [bot]
{
  const n = Number(process.argv[2] ?? 2000);
  const which = process.argv[3] ?? 'isolation';
  const cfg = loadTableConfig();
  const mk = (rng: () => number) => [0, 1, 2, 3].map(() => which === 'random' ? new RandomBot(rng) : new IsolationBot(rng));
  const t0 = Date.now();
  const st = runSim(n, mk, cfg);
  console.log(formatStats(st, `${which} bots, MF${cfg.minimum_fan}/limit${cfg.fan_limit}/selfdraw${cfg.self_draw_minimum_fan}`));
  console.log(`Book reference (MF2, equal players): win ~21-25% per seat (E highest), draws 14%, ~48 Player Turns, E +1.0 / N -1.1 chips`);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
