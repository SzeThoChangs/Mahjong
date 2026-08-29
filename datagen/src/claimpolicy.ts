/**
 * Train the call-or-pass model on the claim decisions the evaluator can label.
 *
 *   tsx src/claimpolicy.ts --dir ../data/gen/run-money3 --epochs 60 --hidden 16
 *
 * These labels were already on disk and being thrown away: claims ARE evaluated (selectDecisions
 * only filters `legal.length > 1`), but the discard trainer drops everything that is not a discard.
 * Claims are the decision type the play-outs resolve best - 27% of them separate at 2 SE against
 * 4% of discards - so the labels are cleaner even though there are fewer.
 *
 * The features are NOT recorded: for claim and self decisions `DecisionRecord.f` is only
 * `{ sh }`. They are recomputed here by replaying hands, exactly as the discard trainer does.
 *
 * KONGS ARE NOT TRAINED HERE, deliberately. A claim consumes hand tiles and adds the tile off the
 * floor; a concealed kong consumes FOUR from hand and there is no floor tile, and `kong1` upgrades
 * an existing exposed pong rather than adding a meld. Forcing those through the claim feature
 * builder double-counts a tile and silently mislabels the shape. They need their own small model,
 * and the decision is nearly always "take it" anyway - the 4,943 decisive self decisions are worth
 * far less than getting this one right.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { makeRng, type Meld, type TileKind } from 'sg-mahjong-engine';
import { claimFeatures, claimCandidateOf, CLAIM_FEATURE_NAMES, type Context } from 'sg-mahjong-solver';
import { eachEval } from './evalstats.js';
import { separationT, seVersionOf } from './se.js';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { DecisionRecord, HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money3')!;
const clear = Number(arg('clear', '2'));
const epochs = Number(arg('epochs', '60'));
const l2 = Number(arg('l2', '1e-4'));
const H = Number(arg('hidden', '16'));
const KIND = 'claim' as const;
const outPath = arg('out', '../solver/src/claim.weights.ts')!;

const rules = rulesForDir(dir);
const seVersion = seVersionOf(dir);
const packPath = arg('pack', '../web/public/quiz/money.json')!;
const heldOutIds = new Set<string>();
if (existsSync(packPath)) {
  const pack = JSON.parse(readFileSync(packPath, 'utf8')) as { questions: { id: string; k: string }[] };
  for (const q of pack.questions) if (q.k === KIND) heldOutIds.add(q.id);
  console.log(`holding out ${heldOutIds.size} ${KIND} questions that also appear in the quiz pack`);
}

const label = new Map<string, string>();
let seenAll = 0;
eachEval(dir, (e) => {
  if (e.k !== KIND || e.actions.length <= 1) return;
  seenAll++;
  if (separationT(e.actions[0]!, e.actions[1]!, seVersion) > clear) label.set(`${e.g}:${e.h}:${e.d}`, e.best);
});
console.log(`${label.size} decisive ${KIND} decisions of ${seenAll} (${((100 * label.size) / Math.max(1, seenAll)).toFixed(1)}%)`);

const wantHands = new Set<string>();
for (const k of label.keys()) { const [g, h] = k.split(':'); wantHands.add(`${g}:${h}`); }

interface Example { x: number[][]; label: number; heldOut: boolean; sel: number; turns: number; passIdx: number }
const examples: Example[] = [];
let drifted = 0, skippedRob = 0, unmatched = 0, replayed = 0;
const hands: HandRecord[] = loadHands(dir).filter((h) => wantHands.has(`${h.g}:${h.h}`));
console.log(`replaying ${hands.length} hands to recover their features…`);

for (const hand of hands) {
  const decs: DecisionRecord[] | null = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS);
  if (!decs) { drifted++; continue; }
  for (const d of decs) {
    const best = label.get(`${d.g}:${d.h}:${d.d}`);
    if (best === undefined || d.k !== KIND) continue;

    // Rob-the-kong is also k==='claim' but the tile is NOT the last discard-log row, so recovering
    // the offered tile from pub.dl would silently mislabel these. They are exactly the claims whose
    // only real option is `win`, so drop them.
    const nonPass = d.legal.filter((a) => a !== 'pass' && a !== 'proceed');
    if (KIND === 'claim' && nonPass.length === 1 && nonPass[0] === 'win') { skippedRob++; continue; }

    const last = d.pub.dl[d.pub.dl.length - 1];
    const offered = (KIND === 'claim' ? last?.[1] : undefined) as TileKind | undefined;
    if (KIND === 'claim' && offered === undefined) { unmatched++; continue; }

    const cands = d.legal.map((a) => claimCandidateOf(a, offered ?? (0 as TileKind)));
    if (cands.some((c) => c === null) || cands.length < 2) { unmatched++; continue; }
    const li = d.legal.indexOf(best);
    if (li < 0) { unmatched++; continue; }

    const melds: Meld[] = d.me.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    const visible: TileKind[] = [];
    for (const e of d.pub.dl) visible.push(e[1]! as TileKind);
    d.pub.m.forEach((ms, s) => { if (s !== d.p) for (const m of ms) visible.push(...(m.slice(2) as TileKind[])); });
    d.pub.b.forEach((bs, s) => { if (s !== d.p) visible.push(...(bs as TileKind[])); });
    const ctx: Context = {
      seat: (d.p - d.dl + 4) % 4, prevailingWind: d.w, bonus: d.me.b as TileKind[], playerTurns: d.t,
      minimumFan: rules.minimum_tai === 2 ? 2 : 1, selfDrawMinimumFan: rules.self_draw_minimum_tai ?? 1,
      visible, opponentMelds: d.pub.m.map((ms, s) => (s === d.p ? -1 : ms.length)).filter((n) => n >= 0),
    };

    try {
      examples.push({
        x: cands.map((c) => claimFeatures(c!, d.me.h as TileKind[], melds, offered ?? (0 as TileKind), ctx)),
        label: li,
        heldOut: heldOutIds.has(`${d.g}:${d.h}:${d.d}`),
        sel: d.legal.indexOf(d.sel),
        turns: d.t,
        passIdx: Math.max(d.legal.indexOf('pass'), d.legal.indexOf('proceed')),
      });
    } catch { unmatched++; }
  }
  if (++replayed % 2000 === 0) process.stdout.write(`\r${replayed}/${hands.length} hands`);
}
console.log(`\r${' '.repeat(44)}\r${examples.length} examples (${drifted} hands drifted, ${skippedRob} rob-the-kong skipped, ${unmatched} unmatched)`);

// hold out the quiz-pack ids where possible; otherwise a deterministic 20% by hand
const rngSplit = makeRng(5);
if (!examples.some((e) => e.heldOut)) {
  console.log('no quiz-pack overlap for this kind - holding out a deterministic 20% instead');
  for (const e of examples) e.heldOut = rngSplit() < 0.2;
}
const train = examples.filter((e) => !e.heldOut);
const test = examples.filter((e) => e.heldOut);
console.log(`train ${train.length}   held-out ${test.length}\n`);
if (train.length < 50 || test.length < 20) { console.error('not enough data'); process.exit(1); }

const D = CLAIM_FEATURE_NAMES.length;
const mu = new Array<number>(D).fill(0), sd = new Array<number>(D).fill(0);
let count = 0;
for (const e of train) for (const row of e.x) { for (let j = 0; j < D; j++) mu[j]! += row[j]!; count++; }
for (let j = 0; j < D; j++) mu[j]! /= Math.max(1, count);
for (const e of train) for (const row of e.x) for (let j = 0; j < D; j++) sd[j]! += (row[j]! - mu[j]!) ** 2;
for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j]! / Math.max(1, count)) || 1;
const z = (e: Example) => e.x.map((row) => row.map((v, j) => (v - mu[j]!) / sd[j]!));

const w = new Array<number>(D).fill(0);
const W1 = Array.from({ length: H }, () => new Array<number>(D).fill(0));
const b1 = new Array<number>(H).fill(0);
const w2 = new Array<number>(H).fill(0);
if (H) {
  const r0 = makeRng(11); const scale = Math.sqrt(1 / D);
  for (let h = 0; h < H; h++) { for (let j = 0; j < D; j++) W1[h]![j] = (r0() * 2 - 1) * scale; w2[h] = (r0() * 2 - 1) * 0.5; }
}
const hiddenOf = (r: number[]): number[] => {
  const h = new Array<number>(H);
  for (let i = 0; i < H; i++) { let t = b1[i]!; const row = W1[i]!; for (let j = 0; j < D; j++) t += row[j]! * r[j]!; h[i] = Math.tanh(t); }
  return h;
};
const scoreOf = (r: number[]): number => {
  if (!H) { let t = 0; for (let j = 0; j < D; j++) t += w[j]! * r[j]!; return t; }
  const h = hiddenOf(r); let t = 0; for (let i = 0; i < H; i++) t += w2[i]! * h[i]!; return t;
};
const softmax = (rows: number[][]): number[] => {
  const s = rows.map(scoreOf); const mx = Math.max(...s);
  const ex = s.map((t) => Math.exp(t - mx)); const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((t) => t / sum);
};
const accuracy = (set: Example[]) => {
  let ok = 0;
  for (const e of set) { const p = softmax(z(e)); let bi = 0; for (let i = 1; i < p.length; i++) if (p[i]! > p[bi]!) bi = i; if (bi === e.label) ok++; }
  return ok / Math.max(1, set.length);
};

const params: number[] = H ? [...W1.flat(), ...b1, ...w2] : w;
const writeBack = () => {
  if (!H) return;
  let o = 0;
  for (let i = 0; i < H; i++) for (let j = 0; j < D; j++) W1[i]![j] = params[o++]!;
  for (let i = 0; i < H; i++) b1[i] = params[o++]!;
  for (let i = 0; i < H; i++) w2[i] = params[o++]!;
};
const P = params.length;
const mA = new Array<number>(P).fill(0), vA = new Array<number>(P).fill(0);
const rng = makeRng(7);
const idx = train.map((_, i) => i);
const lr = Number(arg('lr', H ? '0.01' : '0.05')), beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
let step = 0; const batch = 256;
for (let ep = 1; ep <= epochs; ep++) {
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!]; }
  let loss = 0;
  for (let b = 0; b < idx.length; b += batch) {
    const g = new Array<number>(P).fill(0);
    const slice = idx.slice(b, b + batch);
    for (const ii of slice) {
      const e = train[ii]!; const rows = z(e); const p = softmax(rows);
      loss += -Math.log(Math.max(1e-12, p[e.label]!));
      for (let c = 0; c < rows.length; c++) {
        const dS = p[c]! - (c === e.label ? 1 : 0);
        if (dS === 0) continue;
        const r = rows[c]!;
        if (!H) { for (let j = 0; j < D; j++) g[j]! += dS * r[j]!; continue; }
        const h = hiddenOf(r); let o = 0;
        for (let i = 0; i < H; i++) { const dd = dS * w2[i]! * (1 - h[i]! * h[i]!); for (let j = 0; j < D; j++) g[o + j]! += dd * r[j]!; o += D; }
        for (let i = 0; i < H; i++) g[o + i]! += dS * w2[i]! * (1 - h[i]! * h[i]!);
        o += H;
        for (let i = 0; i < H; i++) g[o + i]! += dS * h[i]!;
      }
    }
    step++;
    for (let j = 0; j < P; j++) {
      const gj = g[j]! / slice.length + 2 * l2 * params[j]!;
      mA[j] = beta1 * mA[j]! + (1 - beta1) * gj;
      vA[j] = beta2 * vA[j]! + (1 - beta2) * gj * gj;
      params[j]! -= (lr * (mA[j]! / (1 - beta1 ** step))) / (Math.sqrt(vA[j]! / (1 - beta2 ** step)) + eps);
    }
    writeBack();
  }
  if (ep % 10 === 0 || ep === 1) console.log(`epoch ${String(ep).padStart(3)}  loss ${(loss / train.length).toFixed(4)}   train ${(100 * accuracy(train.slice(0, 4000))).toFixed(1)}%   held-out ${(100 * accuracy(test)).toFixed(1)}%`);
}

const learned = accuracy(test);
const botAcc = test.filter((e) => e.sel === e.label).length / test.length;
const randomAcc = test.reduce((a, e) => a + 1 / e.x.length, 0) / test.length;
// "Always pass" is the baseline that matters for call-or-pass: it is what a cautious player does
// by default, and a model that cannot beat it has learned nothing worth shipping. A lopsided
// action distribution can make top-1 look good while the model just says "pass" every time.
const passAcc = test.filter((e) => e.label === e.passIdx).length / test.length;
const modelSaysPass = test.filter((e) => {
  const p = softmax(z(e)); let bi = 0; for (let i = 1; i < p.length; i++) if (p[i]! > p[bi]!) bi = i;
  return bi === e.passIdx;
}).length / test.length;
console.log(`\nheld-out top-1 (${test.length} decisions)`);
console.log(`  learned model    ${(100 * learned).toFixed(1)}%`);
console.log(`  always pass      ${(100 * passAcc).toFixed(1)}%   <- the baseline to beat`);
console.log(`  recorded bot     ${(100 * botAcc).toFixed(1)}%`);
console.log(`  random           ${(100 * randomAcc).toFixed(1)}%`);
console.log(`  (the model itself says pass ${(100 * modelSaysPass).toFixed(1)}% of the time)`);

const round = (xs: number[]) => xs.map((x) => Number(x.toFixed(6)));
writeFileSync(outPath, `/* AUTO-GENERATED by datagen/src/claimpolicy.ts - do not edit by hand.
 * ${KIND} policy fitted on ${train.length} decisions from ${dir.split('/').pop()} whose best action
 * clears ${clear} SE. Held-out top-1: ${(100 * learned).toFixed(1)}% (bot ${(100 * botAcc).toFixed(1)}%, random ${(100 * randomAcc).toFixed(1)}%).
 */
export const CLAIM_POLICY = {
  hidden: ${H},
  mu: ${JSON.stringify(round(mu))},
  sd: ${JSON.stringify(round(sd))},
${H ? `  W1: ${JSON.stringify(W1.map(round))},\n  b1: ${JSON.stringify(round(b1))},\n  w2: ${JSON.stringify(round(w2))},` : `  w: ${JSON.stringify(round(w))},`}
} as const;
`);
console.log(`\nweights -> ${outPath}`);
