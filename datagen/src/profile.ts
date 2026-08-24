/**
 * Strategy profile: how often each hand type is actually won, and at what tai.
 * Lets the app re-price every combination under ANY money ladder instantly,
 * without re-simulating.
 *   tsx src/profile.ts --dir ../data/gen/run-money --out ../web/public/profile --name money
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { moneyAt } from 'sg-mahjong-engine';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const dir = arg('dir', '../data/gen/run-money')!;
const outDir = arg('out', '../web/public/profile')!;
const name = arg('name', 'money')!;

const rules = rulesForDir(dir);
const money = rules.money;
const hands = loadHands(dir);

interface Combo { id: string; wins: number; turns: number; fan: Record<string, { sd: number; disc: number }> }
const combos = new Map<string, Combo>();
let draws = 0, kongs = 0, sideMoved = 0, turnsTotal = 0;

for (const h of hands) {
  turnsTotal += h.turns; kongs += h.cnt.kong;
  if (h.winner === null) { draws++; continue; }
  const id = h.combo ?? 'unknown';
  const c = combos.get(id) ?? { id, wins: 0, turns: 0, fan: {} };
  c.wins++; c.turns += h.turns;
  const slot = (c.fan[String(h.fan ?? 0)] ??= { sd: 0, disc: 0 });
  if (h.sd) slot.sd++; else slot.disc++;
  combos.set(id, c);
  // back out side payments (kongs + bites): what the winner received beyond the win itself
  if (money) {
    const gross = h.sd ? 3 * (moneyAt(money.ladder, h.fan ?? 0) + money.zm_bonus_per_player) : moneyAt(money.shoot_total, h.fan ?? 0);
    sideMoved += Math.abs((h.delta[h.winner] ?? 0) - gross);
  }
}

mkdirSync(outDir, { recursive: true });
const profile = {
  run: dir.split('/').pop(), hands: hands.length, draws,
  avgTurns: turnsTotal / hands.length, kongsPerHand: kongs / hands.length,
  sidePerHand: sideMoved / hands.length,
  generatedWith: money,
  minimumTai: rules.minimum_tai, maximumTai: rules.maximum_tai, selfDrawMinimumTai: rules.self_draw_minimum_tai,
  combos: [...combos.values()].map((c) => ({ id: c.id, wins: c.wins, avgTurns: c.turns / c.wins, fan: c.fan })).sort((a, b) => b.wins - a.wins),
};
writeFileSync(join(outDir, `${name}.json`), JSON.stringify(profile));
console.log(`profile: ${hands.length} hands, ${profile.combos.length} combinations -> ${outDir}/${name}.json`);
for (const c of profile.combos.slice(0, 6)) console.log(`  ${c.id.padEnd(18)} ${String(c.wins).padStart(6)} wins`);
