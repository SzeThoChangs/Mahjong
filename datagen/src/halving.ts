/**
 * Does successive halving inflate the gap it reports?
 *
 *   tsx src/halving.ts --dir ../data/gen/run-money3 --decisions 80 --rollouts 128
 *
 * `--adaptive` stops rolling out an action once its running mean looks bad: everyone gets n/4, the
 * top half gets n/2, the top quarter gets n. That saves most of the compute, but an action pruned
 * at n/4 was pruned BECAUSE its early mean was low, so its final estimate is conditioned on having
 * looked bad. If that bias is real, every gap measured against a pruned action is too wide - and
 * the quiz now SELECTS on gap, so it would preferentially admit exactly the overstated ones.
 *
 * The same decisions are evaluated twice, same seed and same hidden deals, once adaptive and once
 * with every action getting the full budget. Any systematic widening under adaptive is the bias.
 */
import type { RulesConfig } from 'sg-mahjong-engine';
import { makeRng } from 'sg-mahjong-engine';
import { positionAt } from './position.js';
import { evaluateDecision, decisionsOfHand, type EvalArgs } from './evaluate.js';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { DecisionRecord, HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money3')!;
const want = Number(arg('decisions', '80'));
const rollouts = Number(arg('rollouts', '128'));
const seed = Number(arg('seed', '17'));

const rules: RulesConfig = rulesForDir(dir);
const base: Omit<EvalArgs, 'workerIndex' | 'adaptive'> = {
  dir, hands: 0, perHand: 0, rollouts, mode: 'sampled', policy: 'shanten',
  seed, workers: 1, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS,
};

const hands = loadHands(dir);
const rng = makeRng(seed);
const picked: { hand: HandRecord; dec: DecisionRecord }[] = [];
const used = new Set<string>();
while (picked.length < want && used.size < hands.length) {
  const hand = hands[Math.floor(rng() * hands.length)]!;
  const hk = `${hand.g}:${hand.h}`;
  if (used.has(hk)) continue;
  used.add(hk);
  const all = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS);
  if (!all) continue;
  const pool = all.filter((d) => d.k === 'discard' && d.legal.length > 1);
  if (pool.length) picked.push({ hand, dec: pool[Math.floor(rng() * pool.length)]! });
}

interface Row { gapA: number; gapF: number; prunedRunnerUp: boolean; sameBest: boolean }
const rows: Row[] = [];
let done = 0;
for (const { hand, dec } of picked) {
  const pos = positionAt(hand, dec.d, rules, DEFAULT_RANDOMNESS);
  if (!pos) continue;
  const pos2 = positionAt(hand, dec.d, rules, DEFAULT_RANDOMNESS);
  if (!pos2) continue;
  const a = evaluateDecision(pos.g, dec, { ...base, workerIndex: 0, adaptive: true }, rules);
  const f = evaluateDecision(pos2.g, dec, { ...base, workerIndex: 0, adaptive: false }, rules);
  const [aB, aS] = [a.actions[0]!, a.actions[1]!];
  const [fB, fS] = [f.actions[0]!, f.actions[1]!];
  rows.push({
    gapA: aB.ev - aS.ev,
    gapF: fB.ev - fS.ev,
    prunedRunnerUp: aS.n < rollouts,
    sameBest: a.best === f.best,
  });
  if (++done % 10 === 0) process.stdout.write(`\r${done}/${picked.length}`);
}

const mean = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / Math.max(1, xs.length);
const report = (label: string, rs: Row[]) => {
  if (!rs.length) { console.log(`${label.padEnd(22)} (none)`); return; }
  const a = mean(rs.map((r) => r.gapA)), f = mean(rs.map((r) => r.gapF));
  console.log(`${label.padEnd(22)} n=${String(rs.length).padStart(3)}  adaptive gap ${a.toFixed(2).padStart(6)}   full gap ${f.toFixed(2).padStart(6)}   inflation ${(f > 0.01 ? `${((a / f - 1) * 100).toFixed(0)}%` : 'n/a').padStart(6)}   same best ${((100 * rs.filter((r) => r.sameBest).length) / rs.length).toFixed(0)}%`);
};
console.log(`\r${' '.repeat(30)}\r`);
console.log(`${rows.length} discard decisions, ${rollouts} play-outs, same seed and deals in both arms\n`);
report('all', rows);
report('runner-up pruned', rows.filter((r) => r.prunedRunnerUp));
report('runner-up survived', rows.filter((r) => !r.prunedRunnerUp));
