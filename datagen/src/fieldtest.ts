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
import { FittedCoachBot, AltReadsCoachBot } from 'sg-mahjong-solver';
import type { ReadsTables } from 'sg-mahjong-solver';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS, NoisyCoachBot } from './bots.js';
import { fnv1a } from './records.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const n = Number(process.argv[2] ?? 500);
const from = Number(arg('from', '1370001'));
const pathA = arg('a', '../knowledge/sources/fitted/tables-committed-g1.30.json');
const pathB = arg('b', '../knowledge/sources/fitted/tables-rowscale-g1.35.json');
const tablesA: unknown = JSON.parse(readFileSync(pathA, 'utf8'));
const tablesB: unknown = JSON.parse(readFileSync(pathB, 'utf8'));
/** who sits in the other three chairs: `pool` is the recorded population, `noisy` the coach with its randomness turned up */
const fieldKind = arg('field', 'pool');
/**
 * `--dwa N --dwb N` sweeps the DANGER WEIGHT instead of the value tables, against the same field.
 *
 * The weight governs how heavily the coach prices deal-in risk against hand value, and the shipped
 * 40 was swept against money only with three coaches in the other chairs, where more defence lost
 * monotonically. Against a field that never punishes a slow hand the optimum has no reason to sit
 * in the same place, and it is the one number that most shapes what the app ADVISES about safety.
 * When these are set both arms use the shipped tables and differ only in the weight.
 */
const dwA = process.argv.includes('--dwa') ? Number(process.argv[process.argv.indexOf('--dwa') + 1]) : undefined;
const dwB = process.argv.includes('--dwb') ? Number(process.argv[process.argv.indexOf('--dwb') + 1]) : undefined;
const sweepingDanger = dwA !== undefined || dwB !== undefined;

/**
 * `--readsa <file>` puts arm A on a different DANGER READS table, the shipped one on B.
 *
 * The coach's two halves are calibrated to different opponents: the value tables were fitted on
 * coach-against-coach play, the shipped reads in `solver/src/reads.ts` on `run-money4`, which is
 * this field. The value weights turned out to be field-specific and cost 0.21 chips carried across;
 * the danger weight turned out not to be. The reads are the piece nobody has checked, and the only
 * cell missing is coach-measured reads played against the field.
 */
const readsPath = process.argv.includes('--readsa') ? process.argv[process.argv.indexOf('--readsa') + 1]! : null;
const altReads: ReadsTables | null = readsPath ? (() => {
  const j = JSON.parse(readFileSync(readsPath, 'utf8')) as Record<string, Record<string, { p: number; n: number }>>;
  const flat = (t?: Record<string, { p: number; n: number }>) => Object.fromEntries(Object.entries(t ?? {}).map(([k, c]) => [k, c.p]));
  return { dangerSafe: flat(j.dangerSafe), danger: flat(j.danger), ready: flat(j.ready), dangerWall: flat(j.dangerWall) };
})() : null;
const cfg = loadTableConfig(), rules = loadTableRules();

/** the three other chairs: one personality each, chosen and seeded by the deal so both arms get the same table */
function field(shuffle: number, tested: number, make: () => Bot): Bot[] {
  return [0, 1, 2, 3].map((s) => {
    if (s === tested) return make();
    if (fieldKind === 'noisy') return new NoisyCoachBot(makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
    const pick = fnv1a(`field:${shuffle}:${s}`) % BOT_TYPES.length;
    return makeBot(BOT_TYPES[pick]!, makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
  });
}
/** what the tested seat's hands looked like, so a loss can be read as a trade rather than a number */
interface Shape { games: number; wins: number; winChips: number; minWins: number; dealins: number; dealinChips: number; ready: number }
const shapes: Record<'A' | 'B', Shape> = { A: { games: 0, wins: 0, winChips: 0, minWins: 0, dealins: 0, dealinChips: 0, ready: 0 }, B: { games: 0, wins: 0, winChips: 0, minWins: 0, dealins: 0, dealinChips: 0, ready: 0 } };
function arm(seat: number, tables: unknown, which: 'A' | 'B'): number[] {
  const out: number[] = [];
  const sh = shapes[which];
  for (let g = 0; g < n; g++) {
    const shuffle = from + g;
    const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
    const bots = field(shuffle, seat, () => (
      altReads ? (which === 'A' ? new AltReadsCoachBot(altReads) : new FittedCoachBot(undefined))
      : sweepingDanger ? new FittedCoachBot(undefined, which === 'A' ? dwA : dwB)
      : new FittedCoachBot(tables)));
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    out.push(r.chipsDelta[seat]!);
    sh.games++;
    if (r.winner === seat) { sh.wins++; sh.winChips += r.chipsDelta[seat]!; if ((r.score?.fan ?? 0) <= 2) sh.minWins++; }
    else if (r.winner !== null && r.discarder === seat) { sh.dealins++; sh.dealinChips += r.chipsDelta[seat]!; }
    if (r.readyTurn[seat]! >= 0) sh.ready++;
  }
  return out;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

const armName = altReads ? `reads ${readsPath!.split('/').slice(-2).join('/')} minus the shipped reads`
  : sweepingDanger ? `danger weight ${dwA ?? 'shipped'} minus ${dwB ?? 'shipped'}`
  : `${pathA.split('/').pop()} minus ${pathB.split('/').pop()}`;
console.log(`${n} paired deals per seat, A = ${armName}, ${fieldKind === 'noisy' ? 'three noisy coaches' : 'three datagen personalities'} in the other chairs (${shuffleName(from)}..${shuffleName(from + n - 1)})\n`);
console.log('seat   A chips/game   B chips/game   difference (paired)');
const diffs: number[] = [];
for (let seat = 0; seat < 4; seat++) {
  const a = arm(seat, tablesA, 'A'), b = arm(seat, tablesB, 'B');
  const d = a.map((x, i) => x - b[i]!);
  diffs.push(...d);
  console.log(`  ${seat + 1}   ${mean(a).toFixed(2).padStart(12)}   ${mean(b).toFixed(2).padStart(12)}   ${mean(d).toFixed(2).padStart(8)} ± ${(sd(d) / Math.sqrt(d.length)).toFixed(2)}`);
}
const m = mean(diffs), se = sd(diffs) / Math.sqrt(diffs.length);
console.log(`\nover all ${diffs.length} paired deals: ${m >= 0 ? '+' : ''}${m.toFixed(3)} ± ${se.toFixed(3)} chips/game for A against the field`);
const pc = (x: number, y: number) => `${(100 * x / Math.max(1, y)).toFixed(2)}%`;
console.log(`\nwhat the tested seat's hands looked like        A          B`);
for (const [label, f] of [
  ['won the hand', (s: Shape) => pc(s.wins, s.games)], ['  ...chips per win', (s: Shape) => (s.winChips / Math.max(1, s.wins)).toFixed(2)],
  ['  ...at the table minimum', (s: Shape) => pc(s.minWins, s.wins)], ['reached ready', (s: Shape) => pc(s.ready, s.games)],
  ['dealt in', (s: Shape) => pc(s.dealins, s.games)], ['  ...chips per deal-in', (s: Shape) => (s.dealinChips / Math.max(1, s.dealins)).toFixed(2)],
] as [string, (s: Shape) => string][]) console.log(`  ${label.padEnd(36)}${f(shapes.A).padStart(10)}${f(shapes.B).padStart(11)}`);
