/**
 * What does a table of coaches actually WIN with?  tsx src/tools/_combos.ts [games]
 *
 * The reads table - the whole danger model - is measured by replaying a recorded run, and those
 * runs were played by the datagen personalities. This asks whether that population plays the same
 * game the coach does. `datagen/src/stats.ts` prints the same breakdown for a recorded run, so the
 * two are read side by side.
 *
 * It exists because a read about SUITS cannot be measured on players who never collect one.
 */
import { runSim } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot } from '../bot.js';

const n = Number(process.argv[2] ?? 1500);
const st = runSim(n, () => [0, 1, 2, 3].map(() => new CoachBot()), loadTableConfig(), 11, loadTableRules());
const wins = Object.values(st.combos).reduce((a, b) => a + b, 0);
console.log(`${st.games} games, ${wins} wins, ${st.draws} draws (${(100 * st.draws / st.games).toFixed(1)}%), ${st.avgPlayerTurns.toFixed(1)} mean player turns`);
for (const [k, v] of Object.entries(st.combos).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(24)} ${String(v).padStart(5)}  ${(100 * v / wins).toFixed(2)}%`);
}
const colour = (st.combos['ban_se'] ?? 0) + (st.combos['qing_yi_se'] ?? 0);
console.log(`\ncolour hands (ban_se + qing_yi_se): ${(100 * colour / wins).toFixed(1)}% of wins`);
