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
let draws = 0, kongs = 0, sideMoved = 0, turnsTotal = 0, drawsTotal = 0, claimsTotal = 0, blockedTotal = 0, readySum = 0, readyN = 0;
const winTiles: Record<number, number> = {};
const ledTotal = [0, 0, 0, 0, 0, 0, 0];   // units of each configurable side amount, summed over winners' side (received)

for (const h of hands) {
  turnsTotal += h.turns; kongs += h.cnt.kong;
  claimsTotal += h.cnt.chow + h.cnt.pong + h.cnt.kong;
  drawsTotal += (h.draws ?? []).reduce((a, b) => a + b, 0);
  blockedTotal += (h.blocked ?? []).reduce((a, b) => a + b, 0);
  for (const rt of h.ready ?? []) if (rt >= 0) { readySum += rt; readyN++; }
  if (h.wt !== undefined && h.wt >= 0) winTiles[h.wt] = (winTiles[h.wt] ?? 0) + 1;
  for (const l of h.led ?? []) for (let i = 0; i < 7; i++) { const v = l[i] ?? 0; if (v > 0) ledTotal[i] = (ledTotal[i] ?? 0) + v; }   // receiving side only
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
  drawsPerHand: drawsTotal / hands.length, claimsPerHand: claimsTotal / hands.length,
  blockedPerHand: blockedTotal / hands.length,
  avgReadyTurn: readyN ? readySum / readyN : -1, readyRate: readyN / (hands.length * 4),
  winTiles,
  /** units of [kongConcealed, kongExposed, kongFed, biteFlowerHidden, biteFlowerOpen, biteAnimalHidden, biteAnimalOpen] earned per hand across the table */
  unitsPerHand: ledTotal.map((v) => v / hands.length),
  generatedWith: money,
  minimumTai: rules.minimum_tai, maximumTai: rules.maximum_tai, selfDrawMinimumTai: rules.self_draw_minimum_tai,
  combos: [...combos.values()].map((c) => ({ id: c.id, wins: c.wins, avgTurns: c.turns / c.wins, fan: c.fan })).sort((a, b) => b.wins - a.wins),
};
writeFileSync(join(outDir, `${name}.json`), JSON.stringify(profile));
console.log(`profile: ${hands.length} hands, ${profile.combos.length} combinations -> ${outDir}/${name}.json`);
for (const c of profile.combos.slice(0, 6)) console.log(`  ${c.id.padEnd(18)} ${String(c.wins).padStart(6)} wins`);
