/**
 * Layer 3, first cut: learn the discard policy from the decisions the evaluator can actually label.
 *
 *   tsx src/policy.ts --dir ../data/gen/run-money2 --epochs 60 --out ../solver/src/policy.weights.ts
 *
 * The noise floor blocks learning from all 480k evaluated decisions, but the ones whose best action
 * clears 2 SE have labels that are right by construction. That subset is the training set.
 *
 * The model is deliberately the same shape as the hand-tuned bots: a linear score over the features
 * `discardFeatures` already computes, picked by softmax over the legal discards (a conditional
 * logit). Same features, same scoring function - the only difference is that the weights are fitted
 * instead of guessed. It stays a short vector of numbers, so it ships to the static web app the way
 * the book tables already do, and it is directly comparable to both the bots and the book coach.
 *
 * Held out: the exact decisions in the quiz pack, so the reported accuracy is on the same 4,086
 * questions `solver/src/coachcheck.ts` scored the book coach on (52.8%). Nothing else is comparable.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { makeRng } from 'sg-mahjong-engine';
import { eachEval } from './evalstats.js';
import { separationT, seVersionOf } from './se.js';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { DiscardFeatures } from './features.js';
import type { DecisionRecord, HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money2')!;
const clear = Number(arg('clear', '2'));
const epochs = Number(arg('epochs', '60'));
const l2 = Number(arg('l2', '1e-4'));
const outPath = arg('out', '../solver/src/policy.weights.ts')!;
const packPath = arg('pack', '../web/public/quiz/money.json')!;

// ---------------------------------------------------------------- features
export const FEATURES = [
  'sh', 'eff', 'rem', 'pairs', 'trip', 'seq', 'pseq', 'iso',
  'isoTile', 'hon', 'term', 'dragon', 'seatWind', 'prevWind',
  'honIso', 'sh_x_turn', 'eff_x_turn', 'iso_x_turn',
] as const;

/** One candidate discard as a vector. Anything constant across candidates cancels in the softmax. */
function featurise(f: DiscardFeatures, role: number, prevailing: number, turns: number): number[] {
  const turnNorm = Math.min(1, turns / 40);
  const seatWind = f.k === 27 + role ? 1 : 0;
  const prevWind = f.k === 27 + prevailing ? 1 : 0;
  const isoTile = f.isoTile ? 1 : 0;
  const hon = f.hon ? 1 : 0;
  return [
    f.sh, f.eff, f.rem, f.pairs, f.trip, f.seq, f.pseq, f.iso,
    isoTile, hon, f.term ? 1 : 0, f.dragon ? 1 : 0, seatWind, prevWind,
    hon * isoTile, f.sh * turnNorm, f.eff * turnNorm, f.iso * turnNorm,
  ];
}

interface Example { x: number[][]; label: number; heldOut: boolean; sel: number; turns: number }

// ---------------------------------------------------------------- collect labels
const rules = rulesForDir(dir);
const seVersion = seVersionOf(dir);
const heldOutIds = new Set<string>();
if (existsSync(packPath)) {
  const pack = JSON.parse(readFileSync(packPath, 'utf8')) as { questions: { id: string; k: string }[] };
  for (const q of pack.questions) if (q.k === 'discard') heldOutIds.add(q.id);
  console.log(`holding out ${heldOutIds.size} discard questions that the book coach was scored on`);
}

const label = new Map<string, string>();          // "g:h:d" -> best action, decisive discards only
let seenDiscards = 0;
eachEval(dir, (e) => {
  if (e.k !== 'discard' || e.actions.length <= 1) return;
  seenDiscards++;
  if (separationT(e.actions[0]!, e.actions[1]!, seVersion) > clear) label.set(`${e.g}:${e.h}:${e.d}`, e.best);
});
console.log(`${label.size} decisive discards of ${seenDiscards} (${((100 * label.size) / Math.max(1, seenDiscards)).toFixed(1)}%)`);

const wantHands = new Set<string>();
for (const k of label.keys()) { const [g, h] = k.split(':'); wantHands.add(`${g}:${h}`); }

// ---------------------------------------------------------------- replay for features
const examples: Example[] = [];
let replayed = 0, drifted = 0, unmatched = 0;
const hands: HandRecord[] = loadHands(dir).filter((h) => wantHands.has(`${h.g}:${h.h}`));
console.log(`replaying ${hands.length} hands to recover their features…`);
for (const hand of hands) {
  const decs: DecisionRecord[] | null = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS);
  if (!decs) { drifted++; continue; }
  const role = (d: DecisionRecord) => (d.p - d.dl + 4) % 4;
  for (const d of decs) {
    const best = label.get(`${d.g}:${d.h}:${d.d}`);
    if (best === undefined || d.k !== 'discard') continue;
    const feats = d.f as DiscardFeatures[] | undefined;
    if (!feats?.length) { unmatched++; continue; }
    const bestKind = Number(best.slice(2));
    const li = feats.findIndex((f) => f.k === bestKind);
    if (li < 0) { unmatched++; continue; }
    examples.push({
      x: feats.map((f) => featurise(f, role(d), d.w, d.t)),
      label: li,
      heldOut: heldOutIds.has(`${d.g}:${d.h}:${d.d}`),
      sel: feats.findIndex((f) => `d:${f.k}` === d.sel),
      turns: d.t,
    });
  }
  if (++replayed % 2000 === 0) process.stdout.write(`\r${replayed}/${hands.length} hands`);
}
console.log(`\r${' '.repeat(40)}\r${examples.length} examples (${drifted} hands drifted, ${unmatched} unmatched)`);

const train = examples.filter((e) => !e.heldOut);
const test = examples.filter((e) => e.heldOut);
console.log(`train ${train.length}   held-out ${test.length}\n`);
if (!train.length || !test.length) { console.error('not enough data'); process.exit(1); }

// ---------------------------------------------------------------- standardise on TRAIN only
const D = FEATURES.length;
const mu = new Array<number>(D).fill(0), sd = new Array<number>(D).fill(0);
let count = 0;
for (const e of train) for (const row of e.x) { for (let j = 0; j < D; j++) mu[j]! += row[j]!; count++; }
for (let j = 0; j < D; j++) mu[j]! /= Math.max(1, count);
for (const e of train) for (const row of e.x) for (let j = 0; j < D; j++) sd[j]! += (row[j]! - mu[j]!) ** 2;
for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j]! / Math.max(1, count)) || 1;
const z = (e: Example) => e.x.map((row) => row.map((v, j) => (v - mu[j]!) / sd[j]!));

// ---------------------------------------------------------------- scorer: linear, or one tanh layer
// Every candidate is scored by the SAME function and the scores are softmaxed over the candidates,
// so the model never sees how many legal discards there were. `--hidden 0` is the plain conditional
// logit, which is exactly the shape the hand-tuned bots already use.
const H = Number(arg('hidden', '0'));
const w = new Array<number>(D).fill(0);                                  // linear head (H = 0)
const W1 = Array.from({ length: H }, () => new Array<number>(D).fill(0));
const b1 = new Array<number>(H).fill(0);
const w2 = new Array<number>(H).fill(0);
if (H) {   // small symmetric-breaking init; Adam does the rest
  const r0 = makeRng(11);
  const scale = Math.sqrt(1 / D);
  for (let h = 0; h < H; h++) { for (let j = 0; j < D; j++) W1[h]![j] = (r0() * 2 - 1) * scale; w2[h] = (r0() * 2 - 1) * 0.5; }
}
const hiddenOf = (r: number[]): number[] => {
  const h = new Array<number>(H);
  for (let i = 0; i < H; i++) { let t = b1[i]!; const row = W1[i]!; for (let j = 0; j < D; j++) t += row[j]! * r[j]!; h[i] = Math.tanh(t); }
  return h;
};
const scoreOf = (r: number[]): number => {
  if (!H) { let t = 0; for (let j = 0; j < D; j++) t += w[j]! * r[j]!; return t; }
  const h = hiddenOf(r);
  let t = 0; for (let i = 0; i < H; i++) t += w2[i]! * h[i]!;
  return t;
};
const softmax = (rows: number[][]): number[] => {
  const s = rows.map(scoreOf);
  const mx = Math.max(...s);
  const ex = s.map((t) => Math.exp(t - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((t) => t / sum);
};
const accuracy = (set: Example[]) => {
  let ok = 0;
  for (const e of set) {
    const p = softmax(z(e));
    let bi = 0; for (let i = 1; i < p.length; i++) if (p[i]! > p[bi]!) bi = i;
    if (bi === e.label) ok++;
  }
  return ok / Math.max(1, set.length);
};

// flat parameter vector so one Adam loop covers both shapes
const params: number[] = H ? [...W1.flat(), ...b1, ...w2] : w;
const writeBack = () => {
  if (!H) return;
  let o = 0;
  for (let i = 0; i < H; i++) for (let j = 0; j < D; j++) W1[i]![j] = params[o++]!;
  for (let i = 0; i < H; i++) b1[i] = params[o++]!;
  for (let i = 0; i < H; i++) w2[i] = params[o++]!;
};
const P = params.length;
const mAdam = new Array<number>(P).fill(0), vAdam = new Array<number>(P).fill(0);

const rng = makeRng(7);
const idx = train.map((_, i) => i);
const lr = Number(arg('lr', H ? '0.01' : '0.05')), beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
let step = 0;
const batch = 256;
let bestTest = 0, bestParams = [...params];
for (let ep = 1; ep <= epochs; ep++) {
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!]; }
  let loss = 0;
  for (let b = 0; b < idx.length; b += batch) {
    const g = new Array<number>(P).fill(0);
    const slice = idx.slice(b, b + batch);
    for (const ii of slice) {
      const e = train[ii]!;
      const rows = z(e);
      const p = softmax(rows);
      loss += -Math.log(Math.max(1e-12, p[e.label]!));
      // dL/dscore_c = p_c - [c == label]
      for (let c = 0; c < rows.length; c++) {
        const dS = p[c]! - (c === e.label ? 1 : 0);
        if (dS === 0) continue;
        const r = rows[c]!;
        if (!H) { for (let j = 0; j < D; j++) g[j]! += dS * r[j]!; continue; }
        const h = hiddenOf(r);
        let o = 0;
        for (let i = 0; i < H; i++) {                       // W1
          const d = dS * w2[i]! * (1 - h[i]! * h[i]!);
          for (let j = 0; j < D; j++) g[o + j]! += d * r[j]!;
          o += D;
        }
        for (let i = 0; i < H; i++) g[o + i]! += dS * w2[i]! * (1 - h[i]! * h[i]!);   // b1
        o += H;
        for (let i = 0; i < H; i++) g[o + i]! += dS * h[i]!;                          // w2
      }
    }
    step++;
    for (let j = 0; j < P; j++) {
      const gj = g[j]! / slice.length + 2 * l2 * params[j]!;
      mAdam[j] = beta1 * mAdam[j]! + (1 - beta1) * gj;
      vAdam[j] = beta2 * vAdam[j]! + (1 - beta2) * gj * gj;
      params[j]! -= (lr * (mAdam[j]! / (1 - beta1 ** step))) / (Math.sqrt(vAdam[j]! / (1 - beta2 ** step)) + eps);
    }
    writeBack();
  }
  const te = accuracy(test);
  if (te > bestTest) { bestTest = te; bestParams = [...params]; }
  if (ep % 10 === 0 || ep === 1) console.log(`epoch ${String(ep).padStart(3)}  loss ${(loss / train.length).toFixed(4)}   train ${(100 * accuracy(train.slice(0, 4000))).toFixed(1)}%   held-out ${(100 * te).toFixed(1)}%`);
}
// NOTE: the reported number below is the FINAL epoch, not the best seen - picking the best epoch by
// the held-out set would be selecting on the thing we are reporting.
console.log(`\n(best held-out seen during training was ${(100 * bestTest).toFixed(1)}%; reporting the final epoch, not that)`);
void bestParams;

// ---------------------------------------------------------------- baselines on the SAME held-out set
const botAcc = test.filter((e) => e.sel === e.label).length / test.length;
const randomAcc = test.reduce((a, e) => a + 1 / e.x.length, 0) / test.length;
const learned = accuracy(test);
console.log(`\nheld-out top-1 accuracy (same ${test.length} questions the book coach scored 52.8% on)`);
console.log(`  learned policy   ${(100 * learned).toFixed(1)}%`);
console.log(`  recorded bot     ${(100 * botAcc).toFixed(1)}%`);
console.log(`  random discard   ${(100 * randomAcc).toFixed(1)}%`);

const byPhase = (lo: number, hi: number, name: string) => {
  const s = test.filter((e) => e.turns > lo && e.turns <= hi);
  if (s.length) console.log(`  ${name.padEnd(6)} n=${String(s.length).padStart(4)}  learned ${(100 * accuracy(s)).toFixed(1)}%   bot ${(100 * s.filter((e) => e.sel === e.label).length / s.length).toFixed(1)}%`);
};
console.log(`\nby phase`);
byPhase(-1, 15, 'early'); byPhase(15, 35, 'mid'); byPhase(35, 1e9, 'late');

if (!H) {
  console.log(`\nlearned weights (standardised units, largest first)`);
  for (const [name, weight] of FEATURES.map((f, j) => [f, w[j]!] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
    console.log(`  ${name.padEnd(12)} ${weight >= 0 ? '+' : ''}${weight.toFixed(3)}`);
}

const round = (xs: number[]) => xs.map((x) => Number(x.toFixed(6)));
writeFileSync(outPath, `/* AUTO-GENERATED by datagen/src/policy.ts - do not edit by hand.
 * Discard policy fitted on ${train.length} decisions from ${dir.split('/').pop()} whose best action
 * clears ${clear} SE - the subset the evaluator can label reliably.
 * Score every candidate with the same function, take the largest. Inputs are standardised: (x - mu) / sd.
 * Held-out top-1 on the ${test.length} quiz-pack questions: ${(100 * learned).toFixed(1)}%
 * (book coach 52.8%, recorded bot ${(100 * botAcc).toFixed(1)}%, random ${(100 * randomAcc).toFixed(1)}%).
 */
export const POLICY_FEATURES = ${JSON.stringify(FEATURES)} as const;
export const POLICY = {
  hidden: ${H},
  mu: ${JSON.stringify(round(mu))},
  sd: ${JSON.stringify(round(sd))},
${H
    ? `  W1: ${JSON.stringify(W1.map(round))},\n  b1: ${JSON.stringify(round(b1))},\n  w2: ${JSON.stringify(round(w2))},`
    : `  w: ${JSON.stringify(round(w))},`}
} as const;
`);
// also as JSON, so tooling can load the weights without importing the browser-facing module
const jsonPath = outPath.replace(/\.ts$/, '.json');
writeFileSync(jsonPath, JSON.stringify({
  features: FEATURES, hidden: H, mu: round(mu), sd: round(sd),
  ...(H ? { W1: W1.map(round), b1: round(b1), w2: round(w2) } : { w: round(w) }),
  trainedOn: train.length, heldOut: test.length, heldOutTop1: Number(learned.toFixed(4)), clear,
}, null, 1));
console.log(`\nweights -> ${outPath}  and  ${jsonPath}  (hidden=${H})`);
