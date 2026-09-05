/**
 * Does a change to the coach survive a table that is not three coaches?
 *
 *   tsx src/fieldtest.ts 2000 --from 1370001 --a ../knowledge/sources/fitted/tables-committed-g1.30.json --b ../knowledge/sources/fitted/tables-rowscale-g1.35.json
 *
 * `headtohead.ts` rotates the tested seat through four chairs and pairs the walls, but the other
 * three chairs are always the coach. Every money figure in FINDINGS was measured that way, and the
 * committed-slope table won +0.101 chips a game over 128,000 paired deals in that setting - by
 * winning more often and smaller, which is the direction the fitted tables took when they LOST a
 * chip a game. A gain that comes from converting half-colour hands into faster cheap ones against
 * coaches may not be a gain against players who do not play like the coach.
 *
 * Same design, different field. Seat A plays table A, seat B plays table B, on the same wall, in the
 * same chair, and the other three chairs hold the datagen personalities - the population the
 * recorded runs are played by, drawn per deal from the same pool the generator uses. Both arms see
 * the same three personalities with the same random streams, so the comparison is of the two
 * tables and nothing else. Reported as A minus B.
 *
 * This is a robustness check, not a bake decision. A table that wins against coaches and loses
 * against the field is a finding about the field, and what to do about it is a separate question.
 */
import { readFileSync } from 'node:fs';
import { playGame, shuffleWall, shuffleName, makeRng, type Bot } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { FittedCoachBot } from 'sg-mahjong-solver';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS } from './bots.js';
import { fnv1a } from './records.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const n = Number(process.argv[2] ?? 500);
const from = Number(arg('from', '1370001'));
const pathA = arg('a', '../knowledge/sources/fitted/tables-committed-g1.30.json');
const pathB = arg('b', '../knowledge/sources/fitted/tables-rowscale-g1.35.json');
const tablesA: unknown = JSON.parse(readFileSync(pathA, 'utf8'));
const tablesB: unknown = JSON.parse(readFileSync(pathB, 'utf8'));
const cfg = loadTableConfig(), rules = loadTableRules();

/** the three other chairs: one personality each, chosen and seeded by the deal so both arms get the same table */
function field(shuffle: number, tested: number, make: () => Bot): Bot[] {
  return [0, 1, 2, 3].map((s) => {
    if (s === tested) return make();
    const pick = fnv1a(`field:${shuffle}:${s}`) % BOT_TYPES.length;
    return makeBot(BOT_TYPES[pick]!, makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
  });
}
function arm(seat: number, tables: unknown): number[] {
  const out: number[] = [];
  for (let g = 0; g < n; g++) {
    const shuffle = from + g;
    const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
    const bots = field(shuffle, seat, () => new FittedCoachBot(tables));
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    out.push(r.chipsDelta[seat]!);
  }
  return out;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

console.log(`${n} paired deals per seat, A = ${pathA.split('/').pop()} minus B = ${pathB.split('/').pop()}, three datagen personalities in the other chairs (${shuffleName(from)}..${shuffleName(from + n - 1)})\n`);
console.log('seat   A chips/game   B chips/game   difference (paired)');
const diffs: number[] = [];
for (let seat = 0; seat < 4; seat++) {
  const a = arm(seat, tablesA), b = arm(seat, tablesB);
  const d = a.map((x, i) => x - b[i]!);
  diffs.push(...d);
  console.log(`  ${seat + 1}   ${mean(a).toFixed(2).padStart(12)}   ${mean(b).toFixed(2).padStart(12)}   ${mean(d).toFixed(2).padStart(8)} ± ${(sd(d) / Math.sqrt(d.length)).toFixed(2)}`);
}
const m = mean(diffs), se = sd(diffs) / Math.sqrt(diffs.length);
console.log(`\nover all ${diffs.length} paired deals: ${m >= 0 ? '+' : ''}${m.toFixed(3)} ± ${se.toFixed(3)} chips/game for A against the field`);
