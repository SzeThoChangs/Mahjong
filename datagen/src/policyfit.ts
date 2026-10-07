/**
 * Fit a discard policy on EVERY evaluated discard, weighted by what each throw costs.
 *
 *   tsx src/policyfit.ts --dirs ../data/gen/run-min1-nowild,../data/gen/run-min1,../data/gen/run-coach2 \
 *       --packs ../web/public/quiz/min1-nowild,../web/public/quiz/min1,../web/public/quiz/coach \
 *       --out ../data/gen/coach2/policy-a.json --epochs 40 --hidden 16
 *
 * `policy.ts` trains on the 3.8% of discards whose best action clears 2 SE and drops the rest, so it
 * learned nothing about the ambiguous majority, and in the app it is asked about all of them. On
 * Changs's table it is worse than the Coach there, early and mid (PROTOTYPE.md, "Can anything beat
 * the Coach for money at Changs's table?", step 1). This trainer keeps every evaluated discard and
 * lets the loss carry the label's confidence instead of a threshold:
 *
 *   loss = sum over candidates of  p(candidate) * regret(candidate)
 *
 * where `p` is the model's softmax over the legal discards and `regret` is the measured best EV
 * minus the candidate's EV, in chips. A position where every throw is worth the same contributes
 * nothing, which is right; a position with one clearly bad throw teaches only that it is bad. The
 * gradient is p_c * (r_c - sum_k p_k r_k), so it is the same conditional logit as before with the
 * one-hot label replaced by money. `--loss ce --clear 2` reproduces the old objective for comparison.
 *
 * Three runs, not one, and held out are the discard questions in the packs built from them, so the
 * reported numbers are on positions nobody trained on. The Coach is scored on the same held-out set
 * in the same run, so the two are compared on identical positions. None of this is money; the paired
 * money test (`policymoney.ts`) decides whether anything ships.
 *
 * Memory: features are packed into one Float32Array as they are collected. At 21 features and about
 * ten legal discards a decision, a million decisions is roughly 800 MB, so `--maxPerDir` caps what
 * each run contributes and the cap is reported. The Mac has little headroom.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { makeRng, type DiscardFeatures, type Meld, type TileKind } from 'sg-mahjong-engine';
import { policyFeatures, policyTable, POLICY_FEATURE_NAMES, rankDiscards, readsFor, visibleOfQuestion, type Context, type PolicyTable } from 'sg-mahjong-solver';
import { eachEval } from './evalstats.js';
import { separationT, seVersionOf } from './se.js';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, type EvalRecord } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { DecisionRecord, HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dirs = arg('dirs', '../data/gen/run-min1-nowild')!.split(',');
const packs = (arg('packs', '') ?? '').split(',').filter(Boolean);
const outPath = arg('out', '../data/gen/coach2/policy.json')!;
const epochs = Number(arg('epochs', '40'));
const H = Number(arg('hidden', '0'));
const lr = Number(arg('lr', process.argv.includes('--init') ? '0.002' : H ? '0.01' : '0.05'));
const l2 = Number(arg('l2', '1e-4'));
const lossKind = arg('loss', 'regret') as 'regret' | 'ce';
const clear = Number(arg('clear', '2'));           // ce only: the old decisive threshold
const cap = Number(arg('cap', '20'));              // regret only: chips beyond which a throw is just "bad"
const maxPerDir = Number(arg('maxPerDir', '200000'));
const batch = Number(arg('batch', '256'));
/**
 * `--init <weights.json>`: start from fitted weights instead of random ones, keeping their feature
 * standardisation, so a model fitted on many cheap labels can be moved by fewer expensive ones (the
 * Coach-judged refit of 2026-10-06, where 100,000 Coach labels are all the Mac can grade in days
 * against the 442,474 shanten labels the shipped weights learned from). The learning rate defaults
 * to a fifth of the usual so the start is not thrown away in the first epoch.
 */
const initPath = arg('init', '');
const init = initPath ? (JSON.parse(readFileSync(initPath, 'utf8')) as { hidden: number; mu: number[]; sd: number[]; W1?: number[][]; b1?: number[]; w2?: number[]; w?: number[] }) : null;
if (init && init.hidden !== H) throw new Error(`--init has hidden ${init.hidden}, --hidden is ${H}`);

const FEATURES = POLICY_FEATURE_NAMES;
const D = FEATURES.length;

// ---------------------------------------------------------------- held-out ids: the packs' discard questions
const heldOut = new Set<string>();
for (const p of packs) {
  const ixPath = join(p, 'index.json');
  if (existsSync(ixPath)) {
    const ix = JSON.parse(readFileSync(ixPath, 'utf8')) as { shards: { file: string }[] };
    for (const s of ix.shards) {
      const qs = JSON.parse(readFileSync(join(p, s.file), 'utf8')).questions as { id: string; k: string }[];
      for (const q of qs) if (q.k === 'discard') heldOut.add(`${p}|${q.id}`);
    }
  } else if (existsSync(`${p}.json`)) {
    const qs = JSON.parse(readFileSync(`${p}.json`, 'utf8')).questions as { id: string; k: string }[];
    for (const q of qs) if (q.k === 'discard') heldOut.add(`${p}|${q.id}`);
  } else console.log(`no pack at ${p}; nothing held out from its run`);
}
console.log(`held out: ${heldOut.size} discard questions across ${packs.length} packs`);

// ---------------------------------------------------------------- packed examples
/** One decision: `off` is where its candidates start in `X`, `n` how many, `r` their regrets (chips),
 *  `label` the measured best's index, `coachPick` the Coach's index or -1, `turns`, `held`. */
interface Ex { off: number; n: number; r: Float32Array; label: number; coachPick: number; turns: number; held: boolean; dir: number }
const examples: Ex[] = [];
let X = new Float32Array(1 << 22);        // grows by doubling
let used = 0;
const push = (row: number[]) => {
  if (used + D > X.length) { const bigger = new Float32Array(X.length * 2); bigger.set(X); X = bigger; }
  X.set(row, used); used += D;
};

const contextOf = (d: DecisionRecord, minimumTai: number, jokers: number): Context => {
  const visible = visibleOfQuestion({ seat: d.p, disc: d.pub.dl, pm: d.pub.m, pb: d.pub.b });
  return {
    seat: (d.p - d.dl + 4) % 4, prevailingWind: d.w, bonus: (d.me.b ?? []) as TileKind[], playerTurns: d.t,
    minimumFan: minimumTai === 2 ? 2 : 1, selfDrawMinimumFan: 1, reads: readsFor(jokers),
    visible, opponentMelds: d.pub.m.map((ms, s) => (s === d.p ? -1 : ms.length)).filter((n) => n >= 0),
  };
};

for (let di = 0; di < dirs.length; di++) {
  const dir = dirs[di]!;
  const pack = packs[di] ?? '';
  const rules = rulesForDir(dir);
  const seVersion = seVersionOf(dir);
  interface Ev { best: string; sep: number; ev: Map<string, number> }
  const evals = new Map<string, Ev>();
  eachEval(dir, (e: EvalRecord) => {
    if (e.k !== 'discard' || e.actions.length <= 1) return;
    evals.set(`${e.g}:${e.h}:${e.d}`, { best: e.best, sep: separationT(e.actions[0]!, e.actions[1]!, seVersion), ev: new Map(e.actions.map((a) => [a.a, a.ev])) });
  });
  const wantHands = new Set<string>();
  for (const k of evals.keys()) { const [g, h] = k.split(':'); wantHands.add(`${g}:${h}`); }
  const rng = makeRng(1000 + di);
  const hands: HandRecord[] = loadHands(dir).filter((h) => wantHands.has(`${h.g}:${h.h}`));
  for (let i = hands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [hands[i], hands[j]] = [hands[j]!, hands[i]!]; }
  console.log(`${dir}: ${evals.size} evaluated discards in ${hands.length} hands; taking up to ${maxPerDir} decisions`);
  let taken = 0, drifted = 0, replayed = 0;
  for (const hand of hands) {
    if (taken >= maxPerDir) break;
    const decs = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS);
    if (!decs) { drifted++; continue; }
    for (const d of decs) {
      if (d.k !== 'discard') continue;
      const ev = evals.get(`${d.g}:${d.h}:${d.d}`);
      if (!ev) continue;
      const feats = d.f as DiscardFeatures[] | undefined;
      if (!feats?.length) continue;
      if (lossKind === 'ce' && ev.sep <= clear) continue;
      const bestEv = ev.ev.get(ev.best);
      if (bestEv === undefined) continue;
      const label = feats.findIndex((f) => `d:${f.k}` === ev.best);
      if (label < 0) continue;
      const r = new Float32Array(feats.length);
      let any = false;
      for (let i = 0; i < feats.length; i++) {
        const e = ev.ev.get(`d:${feats[i]!.k}`);
        r[i] = e === undefined ? cap : Math.min(cap, Math.max(0, bestEv - e));
        if (r[i]! > 0) any = true;
      }
      if (lossKind === 'regret' && !any) continue;      // every throw worth the same: nothing to learn
      const role = (d.p - d.dl + 4) % 4;
      const table: PolicyTable = policyTable(contextOf(d, rules.minimum_tai, rules.jokers.count));
      const off = used;
      for (const f of feats) push(policyFeatures(f, role, d.w, d.t, table));
      const held = heldOut.has(`${pack}|${d.g}:${d.h}:${d.d}`);
      let coachPick = -1;
      if (held) {
        try {
          const melds: Meld[] = d.me.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2) as TileKind[], concealed: m[1] === 1 }));
          const pick = rankDiscards(d.me.h as TileKind[], melds, contextOf(d, rules.minimum_tai, rules.jokers.count)).best.tile;
          coachPick = feats.findIndex((f) => f.k === pick);
        } catch { coachPick = -1; }
      }
      examples.push({ off, n: feats.length, r, label, coachPick, turns: d.t, held, dir: di });
      taken++;
    }
    if (++replayed % 5000 === 0) process.stdout.write(`\r  ${replayed}/${hands.length} hands, ${taken} decisions`);
  }
  console.log(`\r  ${replayed} hands replayed, ${taken} decisions kept, ${drifted} drifted`);
}
const train = examples.filter((e) => !e.held), test = examples.filter((e) => e.held);
console.log(`\ntrain ${train.length}   held-out ${test.length}   features ${used * 4 / 1e6 | 0} MB\n`);
if (!train.length) { console.error('nothing to train on'); process.exit(1); }

// ---------------------------------------------------------------- standardise on TRAIN only
const mu = new Float64Array(D), sd = new Float64Array(D);
let rows = 0;
for (const e of train) for (let c = 0; c < e.n; c++) { const o = e.off + c * D; for (let j = 0; j < D; j++) mu[j]! += X[o + j]!; rows++; }
for (let j = 0; j < D; j++) mu[j]! /= Math.max(1, rows);
for (const e of train) for (let c = 0; c < e.n; c++) { const o = e.off + c * D; for (let j = 0; j < D; j++) sd[j]! += (X[o + j]! - mu[j]!) ** 2; }
for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j]! / Math.max(1, rows)) || 1;
if (init) { mu.set(init.mu); sd.set(init.sd); }   // the start's own standardisation, or its weights mean nothing
for (let o = 0; o < used; o += D) for (let j = 0; j < D; j++) X[o + j] = (X[o + j]! - mu[j]!) / sd[j]!;   // in place, once

// ---------------------------------------------------------------- the scorer: linear, or one tanh layer
const w = new Float64Array(D);
const W1 = Array.from({ length: H }, () => new Float64Array(D));
const b1 = new Float64Array(H), w2 = new Float64Array(H);
if (H) { const r0 = makeRng(11); const scale = Math.sqrt(1 / D); for (let h = 0; h < H; h++) { for (let j = 0; j < D; j++) W1[h]![j] = (r0() * 2 - 1) * scale; w2[h] = (r0() * 2 - 1) * 0.5; } }
if (init) { if (H) { for (let h = 0; h < H; h++) W1[h]!.set(init.W1![h]!); b1.set(init.b1!); w2.set(init.w2!); } else w.set(init.w!); }
const hidden = new Float64Array(H);
const scoreAt = (o: number): number => {
  if (!H) { let t = 0; for (let j = 0; j < D; j++) t += w[j]! * X[o + j]!; return t; }
  let t = 0;
  for (let i = 0; i < H; i++) { let h = b1[i]!; const row = W1[i]!; for (let j = 0; j < D; j++) h += row[j]! * X[o + j]!; hidden[i] = Math.tanh(h); t += w2[i]! * hidden[i]!; }
  return t;
};
const probs = (e: Ex, out: Float64Array) => {
  let mx = -Infinity;
  for (let c = 0; c < e.n; c++) { out[c] = scoreAt(e.off + c * D); if (out[c]! > mx) mx = out[c]!; }
  let sum = 0;
  for (let c = 0; c < e.n; c++) { out[c] = Math.exp(out[c]! - mx); sum += out[c]!; }
  for (let c = 0; c < e.n; c++) out[c]! /= sum;
};
const P = H ? H * D + H + H : D;
const params = new Float64Array(P);
const load = () => { if (!H) { w.set(params); return; } let o = 0; for (let i = 0; i < H; i++) { W1[i]!.set(params.subarray(o, o + D)); o += D; } b1.set(params.subarray(o, o + H)); o += H; w2.set(params.subarray(o, o + H)); };
const save = () => { if (!H) { params.set(w); return; } let o = 0; for (let i = 0; i < H; i++) { params.set(W1[i]!, o); o += D; } params.set(b1, o); o += H; params.set(w2, o); };
save();

/** mean regret and top-1 of a decider over a set, where the decider is an index per example */
const judge = (set: Ex[], pickOf: (e: Ex, p: Float64Array) => number) => {
  const p = new Float64Array(20);
  let n = 0, regret = 0, top1 = 0;
  for (const e of set) { probs(e, p); const c = pickOf(e, p); if (c < 0) continue; n++; regret += e.r[c]!; if (c === e.label) top1++; }
  return { n, regret: regret / Math.max(1, n), top1: top1 / Math.max(1, n) };
};
const argmax = (_e: Ex, p: Float64Array) => { let b = 0; for (let c = 1; c < _e.n; c++) if (p[c]! > p[b]!) b = c; return b; };
const report = (label: string, set: Ex[]) => {
  const m = judge(set, argmax), c = judge(set, (e) => e.coachPick);
  console.log(`  ${label.padEnd(9)} n=${String(m.n).padStart(6)}   model regret ${m.regret.toFixed(3)} top-1 ${(100 * m.top1).toFixed(1)}%   coach regret ${c.regret.toFixed(3)} top-1 ${(100 * c.top1).toFixed(1)}%`);
};

// ---------------------------------------------------------------- Adam over the regret (or CE) loss
const g = new Float64Array(P), mA = new Float64Array(P), vA = new Float64Array(P);
const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
const rng = makeRng(7);
const idx = train.map((_, i) => i);
const p = new Float64Array(20), dS = new Float64Array(20);
let step = 0;
for (let ep = 1; ep <= epochs; ep++) {
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!]; }
  let loss = 0;
  for (let b = 0; b < idx.length; b += batch) {
    g.fill(0);
    const end = Math.min(idx.length, b + batch);
    for (let ii = b; ii < end; ii++) {
      const e = train[idx[ii]!]!;
      probs(e, p);
      if (lossKind === 'regret') {
        let expected = 0;
        for (let c = 0; c < e.n; c++) expected += p[c]! * e.r[c]!;
        loss += expected;
        for (let c = 0; c < e.n; c++) dS[c] = p[c]! * (e.r[c]! - expected);
      } else {
        loss += -Math.log(Math.max(1e-12, p[e.label]!));
        for (let c = 0; c < e.n; c++) dS[c] = p[c]! - (c === e.label ? 1 : 0);
      }
      for (let c = 0; c < e.n; c++) {
        const d = dS[c]!; if (d === 0) continue;
        const o = e.off + c * D;
        if (!H) { for (let j = 0; j < D; j++) g[j]! += d * X[o + j]!; continue; }
        scoreAt(o);                                             // refreshes `hidden` for this row
        let q = 0;
        for (let i = 0; i < H; i++) { const dh = d * w2[i]! * (1 - hidden[i]! * hidden[i]!); for (let j = 0; j < D; j++) g[q + j]! += dh * X[o + j]!; q += D; }
        for (let i = 0; i < H; i++) g[q + i]! += d * w2[i]! * (1 - hidden[i]! * hidden[i]!);
        q += H;
        for (let i = 0; i < H; i++) g[q + i]! += d * hidden[i]!;
      }
    }
    step++;
    const m = end - b;
    for (let j = 0; j < P; j++) {
      const gj = g[j]! / m + 2 * l2 * params[j]!;
      mA[j] = beta1 * mA[j]! + (1 - beta1) * gj;
      vA[j] = beta2 * vA[j]! + (1 - beta2) * gj * gj;
      params[j]! -= (lr * (mA[j]! / (1 - beta1 ** step))) / (Math.sqrt(vA[j]! / (1 - beta2 ** step)) + eps);
    }
    load();
  }
  if (ep === 1 || ep % 5 === 0 || ep === epochs) {
    console.log(`epoch ${String(ep).padStart(3)}  loss ${(loss / train.length).toFixed(4)}`);
    report('held-out', test);
  }
}

// ---------------------------------------------------------------- the final epoch, on the held-out set, by slice
console.log(`\nheld-out, final epoch (mean regret in chips a decision against the measured best; the Coach on the same positions)`);
report('all', test);
report('early', test.filter((e) => e.turns <= 15));
report('mid', test.filter((e) => e.turns > 15 && e.turns <= 35));
report('late', test.filter((e) => e.turns > 35));
for (let di = 0; di < dirs.length; di++) report(dirs[di]!.split('/').pop()!.slice(0, 9), test.filter((e) => e.dir === di));

const round = (xs: ArrayLike<number>) => Array.from(xs, (x) => Number(x.toFixed(6)));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({
  features: FEATURES, hidden: H, mu: round(mu), sd: round(sd), ...(init ? { initFrom: initPath } : {}),
  ...(H ? { W1: W1.map(round), b1: round(b1), w2: round(w2) } : { w: round(w) }),
  loss: lossKind, cap, clear, epochs, lr, l2, dirs, packs, trainedOn: train.length, heldOut: test.length, maxPerDir,
}, null, 1));
console.log(`\nweights -> ${outPath}`);
