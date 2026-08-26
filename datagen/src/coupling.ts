/**
 * Does position-keyed rollout randomness actually shrink the error bar?
 *
 *   tsx src/coupling.ts --dir ../data/gen/run-money2 --decisions 200 --rollouts 128
 *
 * Evaluates the SAME decisions twice at the same seed and rollout count, once with the sequential
 * per-seat stream (--no-coupled behaviour) and once with the position-keyed one, and reports what
 * happened to the paired standard error. Nothing here writes to the dataset.
 *
 * The number that matters is the mean paired SE: it sets how large a gap the evaluator can resolve,
 * and therefore how much of the dataset is usable as a training signal at all.
 */
import { makeRng, type RulesConfig } from 'sg-mahjong-engine';
import { positionAt } from './position.js';
import { evaluateDecision, decisionsOfHand, type EvalArgs, type EvalRecord } from './evaluate.js';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { DecisionRecord, HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money2')!;
const want = Number(arg('decisions', '200'));
const rollouts = Number(arg('rollouts', '128'));
const seed = Number(arg('seed', '77'));

const rules: RulesConfig = rulesForDir(dir);
const policy = arg('policy', 'shanten') as EvalArgs['policy'];
const base: Omit<EvalArgs, 'workerIndex' | 'coupled'> = {
  dir, hands: 0, perHand: 0, rollouts, mode: 'sampled', policy,
  seed, workers: 1, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS, adaptive: false,
};

// a deterministic spread of decisions across hands, same set for both arms
const hands = loadHands(dir);
const rng = makeRng(seed);
const picked: { hand: HandRecord; dec: DecisionRecord }[] = [];
const seenHands = new Set<string>();
let drifted = 0;
while (picked.length < want && seenHands.size < hands.length) {
  const hand = hands[Math.floor(rng() * hands.length)]!;
  const hk = `${hand.g}:${hand.h}`;
  if (seenHands.has(hk)) continue;
  seenHands.add(hk);
  const all = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS);
  if (!all) { drifted++; continue; }
  const pool = all.filter((d) => d.legal.length > 1);
  for (let i = 0; i < 2 && pool.length && picked.length < want; i++) picked.push({ hand, dec: pool.splice(Math.floor(rng() * pool.length), 1)[0]!, });
}
console.log(`${picked.length} decisions from ${seenHands.size} hands (${drifted} did not replay), ${rollouts} rollouts, policy ${policy}, seed ${seed}\n`);

interface Arm { se: number[]; gap: number[]; clear1: number; clear2: number; agree: number; ms: number }
const arm = (): Arm => ({ se: [], gap: [], clear1: 0, clear2: 0, agree: 0, ms: 0 });
const arms: Record<string, Arm> = { sequential: arm(), coupled: arm() };

const record = (a: Arm, e: EvalRecord) => {
  const [best, second] = [e.actions[0], e.actions[1]];
  if (!best || !second) return;
  a.se.push(second.gapSe); a.gap.push(second.gap);
  if (second.gap > second.gapSe) a.clear1++;
  if (second.gap > 2 * second.gapSe) a.clear2++;
};

const bestOf: Record<string, string[]> = { sequential: [], coupled: [] };
let done = 0;
for (const { hand, dec } of picked) {
  for (const [name, coupled] of [['sequential', false], ['coupled', true]] as const) {
    const pos = positionAt(hand, dec.d, rules, DEFAULT_RANDOMNESS);
    if (!pos) continue;
    const t0 = Date.now();
    const e = evaluateDecision(pos.g, dec, { ...base, workerIndex: 0, coupled }, rules);
    arms[name]!.ms += Date.now() - t0;
    record(arms[name]!, e);
    bestOf[name]!.push(`${dec.g}:${dec.h}:${dec.d}=${e.best}`);
  }
  if (++done % 25 === 0) process.stdout.write(`\r${done}/${picked.length}`);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? NaN; };
const pct = (x: number, n: number) => `${((100 * x) / Math.max(1, n)).toFixed(1)}%`;

console.log(`\r${' '.repeat(24)}\r`);
console.log(`${'arm'.padEnd(12)} ${'mean SE'.padStart(8)} ${'median SE'.padStart(10)} ${'mean gap'.padStart(9)} ${'>1 SE'.padStart(7)} ${'>2 SE'.padStart(7)} ${'seconds'.padStart(8)}`);
for (const [name, a] of Object.entries(arms)) {
  const n = a.se.length;
  console.log(`${name.padEnd(12)} ${mean(a.se).toFixed(3).padStart(8)} ${median(a.se).toFixed(3).padStart(10)} ${mean(a.gap).toFixed(3).padStart(9)} ${pct(a.clear1, n).padStart(7)} ${pct(a.clear2, n).padStart(7)} ${(a.ms / 1000).toFixed(1).padStart(8)}`);
}
const s = mean(arms.sequential!.se), c = mean(arms.coupled!.se);
console.log(`\nmean paired SE ${s.toFixed(3)} -> ${c.toFixed(3)}  (${c < s ? `${((1 - c / s) * 100).toFixed(1)}% lower` : `${((c / s - 1) * 100).toFixed(1)}% HIGHER`})`);
console.log(`equivalent rollout multiple: coupling buys what ${((s / c) ** 2).toFixed(1)}x the play-outs would, at the same cost`);
const same = bestOf.sequential!.filter((x, i) => x === bestOf.coupled![i]).length;
console.log(`same best action in ${pct(same, bestOf.sequential!.length)} of decisions (rankings should mostly agree; only the confidence changes)`);
