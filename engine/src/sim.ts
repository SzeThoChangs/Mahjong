/** Simulator: play N hands, rotate the dealer, report aggregate stats. */
import { Wall, makeRng } from './wall.js';
import { playGame, type Bot } from './game.js';
import { loadTableConfig } from './config.node.js';
import { IsolationBot, RandomBot } from './bots.js';
import type { TableConfig } from './payout.js';

export interface SimStats {
  games: number; draws: number;
  winsBySeat: number[]; chipsBySeat: number[]; selfDraws: number;
  avgPlayerTurns: number; avgFan: number;
  combos: Record<string, number>;
  playerTurnsHist: Record<string, number>;
}

export function runSim(n: number, makeBots: (rng: () => number) => Bot[], cfg: TableConfig, seed = 1): SimStats {
  const rng = makeRng(seed);
  const st: SimStats = { games: 0, draws: 0, winsBySeat: [0, 0, 0, 0], chipsBySeat: [0, 0, 0, 0], selfDraws: 0, avgPlayerTurns: 0, avgFan: 0, combos: {}, playerTurnsHist: {} };
  let turnsSum = 0, fanSum = 0, wins = 0;
  for (let g = 0; g < n; g++) {
    const wall = new Wall(makeRng(seed * 1000003 + g), cfg.unplayable_tiles);
    const bots = makeBots(rng);
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4 });
    st.games++;
    if (r.tilesAccounted + wall.totalLeft !== 148) throw new Error(`tile leak: ${r.tilesAccounted} + ${wall.totalLeft}`);
    const sum = r.chipsDelta.reduce((a, b) => a + b, 0);
    if (sum !== 0) throw new Error(`chips do not sum to zero: ${r.chipsDelta}`);
    for (let s = 0; s < 4; s++) st.chipsBySeat[s]! += r.chipsDelta[s]!;
    turnsSum += r.playerTurns;
    const bucket = String(Math.floor(r.playerTurns / 5) * 5);
    st.playerTurnsHist[bucket] = (st.playerTurnsHist[bucket] ?? 0) + 1;
    if (r.winner === null) { st.draws++; continue; }
    wins++;
    st.winsBySeat[r.winner]!++;
    if (r.selfDraw) st.selfDraws++;
    fanSum += r.score!.fan;
    st.combos[r.score!.combination] = (st.combos[r.score!.combination] ?? 0) + 1;
  }
  st.avgPlayerTurns = turnsSum / n;
  st.avgFan = wins ? fanSum / wins : 0;
  return st;
}

export function formatStats(st: SimStats, label: string): string {
  const pct = (x: number) => (100 * x / st.games).toFixed(1) + '%';
  const lines = [
    `== ${label}: ${st.games} games ==`,
    `draws ${pct(st.draws)} | self-draw share of wins ${st.games - st.draws ? (100 * st.selfDraws / (st.games - st.draws)).toFixed(0) : 0}% | avg Player Turns ${st.avgPlayerTurns.toFixed(1)} | avg Fan ${st.avgFan.toFixed(2)}`,
    `win rate by seat  E ${pct(st.winsBySeat[0]!)}  S ${pct(st.winsBySeat[1]!)}  W ${pct(st.winsBySeat[2]!)}  N ${pct(st.winsBySeat[3]!)}`,
    `chips/game by seat E ${(st.chipsBySeat[0]! / st.games).toFixed(2)}  S ${(st.chipsBySeat[1]! / st.games).toFixed(2)}  W ${(st.chipsBySeat[2]! / st.games).toFixed(2)}  N ${(st.chipsBySeat[3]! / st.games).toFixed(2)}`,
    `combinations: ` + Object.entries(st.combos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '),
  ];
  return lines.join('\n');
}

// CLI: tsx src/sim.ts [games] [bot]
if (process.argv[1] && /sim\.(ts|js)$/.test(process.argv[1])) {
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
