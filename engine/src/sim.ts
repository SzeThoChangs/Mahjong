/** Simulator: play N hands, rotate the dealer, report aggregate stats. */
import { Wall, makeRng } from './wall.js';
import { playGame, type Bot } from './game.js';
import type { TableConfig } from './payout.js';
import { DEFAULT_RULES, type RulesConfig } from './rules.js';

export interface SimStats {
  games: number; draws: number;
  winsBySeat: number[]; chipsBySeat: number[]; selfDraws: number;
  avgPlayerTurns: number; avgFan: number;
  combos: Record<string, number>;
  playerTurnsHist: Record<string, number>;
}

export function runSim(n: number, makeBots: (rng: () => number) => Bot[], cfg: TableConfig, seed = 1, rules: RulesConfig = DEFAULT_RULES): SimStats {
  const rng = makeRng(seed);
  const st: SimStats = { games: 0, draws: 0, winsBySeat: [0, 0, 0, 0], chipsBySeat: [0, 0, 0, 0], selfDraws: 0, avgPlayerTurns: 0, avgFan: 0, combos: {}, playerTurnsHist: {} };
  let turnsSum = 0, fanSum = 0, wins = 0;
  for (let g = 0; g < n; g++) {
    const wall = new Wall(makeRng(seed * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count);
    const bots = makeBots(rng);
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    st.games++;
    // `wall.size` not a literal 148: the set is 152 when the table plays with wildcards
    if (r.tilesAccounted + wall.totalLeft !== wall.size) throw new Error(`tile leak: ${r.tilesAccounted} + ${wall.totalLeft} != ${wall.size}`);
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
    // Chairs, numbered 1-4 the way the app numbers them - NOT winds. The dealer moves round the
    // table every game, and a seat's wind is its distance from the dealer, so chair 1 is East in
    // only a quarter of these games. Labelling these columns E/S/W/N named a wind the chair does
    // not keep, and read as a seat-wind edge that is not what is being counted.
    `win rate by seat  ` + st.winsBySeat.map((w, i) => `${i + 1} ${pct(w)}`).join('  '),
    `chips/game by seat ` + st.chipsBySeat.map((c, i) => `${i + 1} ${(c / st.games).toFixed(2)}`).join('  '),
    `combinations: ` + Object.entries(st.combos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '),
  ];
  return lines.join('\n');
}

