/**
 * How often does a hand lose a tile? tsx src/leakcheck.ts [hands]
 *
 * `runSim` asserts that every game accounts for all 148 tiles, and it trips about once in 300 -
 * with the stock IsolationBot as well as with the solver's bots, so it is the engine and not a bot
 * naming a tile it does not hold. The dataset generator has no such assertion, which means the
 * 150,000 recorded hands were never checked. This measures the rate on the path that made them.
 */
import { Wall, playGame, makeRng, TOTAL_TILES, type Bot } from 'sg-mahjong-engine';
import { loadTableConfig } from 'sg-mahjong-engine/node';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS } from './bots.js';

const n = Number(process.argv[2] ?? 2000);
const cfg = loadTableConfig();
const rng = makeRng(4040);

let leaks = 0, threw = 0;
const byCombo = new Map<string, number>();
const examples: string[] = [];
for (let g = 0; g < n; g++) {
  const wall = new Wall(makeRng(4040 * 1000003 + g), cfg.unplayable_tiles);
  const bots: Bot[] = [0, 1, 2, 3].map(() => makeBot(BOT_TYPES[Math.floor(rng() * BOT_TYPES.length)]!, makeRng(g * 31 + 7), DEFAULT_RANDOMNESS));
  try {
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4 });
    const total = r.tilesAccounted + wall.totalLeft;
    if (total !== TOTAL_TILES + (cfg.unplayable_tiles ? 0 : 0)) {
      leaks++;
      const combo = r.score?.combination ?? (r.winner === null ? 'draw' : '-');
      byCombo.set(combo, (byCombo.get(combo) ?? 0) + 1);
      if (examples.length < 5) examples.push(`game ${g}: ${total} tiles (${r.tilesAccounted} held + ${wall.totalLeft} wall), winner ${r.winner}, selfDraw ${r.selfDraw}, combo ${combo}, turns ${r.playerTurns}`);
    }
  } catch { threw++; }
}

console.log(`${n} hands on the generator's own bot mix`);
console.log(`  tile leaks: ${leaks}  (${((100 * leaks) / n).toFixed(2)}%)`);
console.log(`  threw:      ${threw}`);
if (byCombo.size) console.log(`  by outcome: ${[...byCombo.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
for (const e of examples) console.log(`  ${e}`);
