/**
 * Train a fast IMITATION of the coach's discard.
 *
 *   tsx src/coachcopy.ts --hands 3000 --epochs 40 --hidden 24 --out ../solver/src/copy.weights.ts
 *
 * The coach costs 77 ms a hand and the grader needs 1 ms, so the dataset cannot be regenerated
 * until something plays the coach's game at a cheap bot's speed. This is that attempt.
 *
 * It is NOT a fourth run at the thing that failed three times. Those models learned the MEASURED
 * best action - labels that exist for 4% of discards and are noisy even there. This one copies the
 * coach's own move: the coach answers every position, always the same way, so the labels are
 * unlimited, free, and exactly consistent. Imitating a known teacher is a much easier problem, and
 * the target is not to play well but to play LIKE THE COACH, fast.
 *
 * The one number that decides whether it worked is not accuracy. Accuracy has failed to predict
 * anything three times here. It is whether the copy finishes colour hands at the coach's rate
 * (34.6%) rather than a cheap bot's (2-4%), because that is the specific thing the grader gets
 * wrong. `solver/src/tools/_rates.ts` measures it.
 */
import { writeFileSync } from 'node:fs';
import { GameState, makeRng, kindOf, discardFeatures, unseenCounts, shuffleWall, type PlayerView } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot, ctxOf, meldsOf, rankDiscards, policyTable, copyFeatures, suitTable, COPY_FEATURE_NAMES } from 'sg-mahjong-solver';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const nHands = Number(arg('hands', '2000'));
const epochs = Number(arg('epochs', '40'));
const H = Number(arg('hidden', '24'));
const lr = Number(arg('lr', '0.05'));
const l2 = Number(arg('l2', '1e-5'));
const outPath = arg('out', '../solver/src/copy.weights.ts')!;
/** deals to learn from, by name. Held-out deals come from a different range, never these. */
const from = Number(arg('from', '400001'));
const heldFrom = Number(arg('heldfrom', '500001'));
const heldHands = Number(arg('held', '400'));

const cfg = loadTableConfig(), rules = loadTableRules();

interface Example { x: number[][]; label: number }

/** Play coach hands and write down, at every discard, what each candidate looked like and which
 *  one the coach actually threw. The coach is deterministic, so this is a clean teacher. */
function collect(first: number, count: number): Example[] {
  const out: Example[] = [];
  for (let g = 0; g < count; g++) {
    const st = GameState.deal(cfg, shuffleWall(first + g, cfg.unplayable_tiles, rules.jokers.count), { rules, dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4 });
    const bots = [0, 1, 2, 3].map(() => new CoachBot());
    let guard = 0;
    while (!st.finished && guard++ < 3000) {
      st.advance(); if (st.finished) break;
      const p = st.pending();
      if (p && p.kind === 'discard') {
        const v: PlayerView = st.view(p.seat, null);
        const hand = v.hand.map(kindOf), melds = meldsOf(v), ctx = ctxOf(v);
        const kinds = [...new Set(hand)].filter((k) => k < 34);
        if (kinds.length > 1) {
          const pick = rankDiscards(hand, melds, ctx).best.tile;
          const label = kinds.indexOf(pick);
          if (label >= 0) {
            const tbl = policyTable(ctx), suits = suitTable(hand);
            // one call gives a row per candidate tile, in the engine's own order
            const unseen = unseenCounts({ hand, allMelds: v.players.flatMap((q) => q.melds.flatMap((m) => m.tiles)), allDiscards: v.discardLog.map((d) => kindOf(d.tile)) });
            const feats = discardFeatures(hand, melds, unseen);
            const byKind = new Map(feats.map((f) => [f.k, f]));
            const rows = kinds.map((k) => byKind.get(k));
            if (rows.every(Boolean)) {
              const x = rows.map((f) => copyFeatures(f!, ctx.seat, ctx.prevailingWind, ctx.playerTurns, tbl, suits));
              out.push({ x, label });
            }
          }
        }
      }
      st.step(bots);
    }
  }
  return out;
}

const t0 = Date.now();
console.log(`collecting from shuffle-${from} (${nHands} hands)...`);
const train = collect(from, nHands);
const held = collect(heldFrom, heldHands);
console.log(`${train.length} training decisions, ${held.length} held out, in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// ------------------------------------------------------------------ standardise
const D = COPY_FEATURE_NAMES.length;
const mu = new Array<number>(D).fill(0), sd = new Array<number>(D).fill(0);
let count = 0;
for (const e of train) for (const row of e.x) { for (let j = 0; j < D; j++) mu[j]! += row[j]!; count++; }
for (let j = 0; j < D; j++) mu[j]! /= Math.max(1, count);
for (const e of train) for (const row of e.x) for (let j = 0; j < D; j++) sd[j]! += (row[j]! - mu[j]!) ** 2;
for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j]! / Math.max(1, count)) || 1;
const z = (e: Example) => e.x.map((row) => row.map((v, j) => (v - mu[j]!) / sd[j]!));

// ------------------------------------------------------------------ model: one tanh layer, softmax over candidates
const W1 = Array.from({ length: H }, () => new Array<number>(D).fill(0));
const b1 = new Array<number>(H).fill(0);
const w2 = new Array<number>(H).fill(0);
const r0 = makeRng(11), scale = Math.sqrt(1 / D);
for (let h = 0; h < H; h++) { for (let j = 0; j < D; j++) W1[h]![j] = (r0() * 2 - 1) * scale; w2[h] = (r0() * 2 - 1) * 0.5; }

const hiddenOf = (r: number[]) => { const h = new Array<number>(H); for (let i = 0; i < H; i++) { let t = b1[i]!; const row = W1[i]!; for (let j = 0; j < D; j++) t += row[j]! * r[j]!; h[i] = Math.tanh(t); } return h; };
const scoreOf = (r: number[]) => { const h = hiddenOf(r); let t = 0; for (let i = 0; i < H; i++) t += w2[i]! * h[i]!; return t; };
const softmax = (rows: number[][]) => { const s = rows.map(scoreOf); const mx = Math.max(...s); const ex = s.map((t) => Math.exp(t - mx)); const sum = ex.reduce((a, b) => a + b, 0); return ex.map((t) => t / sum); };
const accuracy = (set: Example[]) => {
  let ok = 0;
  for (const e of set) { const p = softmax(z(e)); let bi = 0; for (let i = 1; i < p.length; i++) if (p[i]! > p[bi]!) bi = i; if (bi === e.label) ok++; }
  return ok / Math.max(1, set.length);
};

// plain SGD with momentum over the flat parameter vector
const params = [...W1.flat(), ...b1, ...w2];
const vel = new Array<number>(params.length).fill(0);
const load = () => { let o = 0; for (let i = 0; i < H; i++) for (let j = 0; j < D; j++) W1[i]![j] = params[o++]!; for (let i = 0; i < H; i++) b1[i] = params[o++]!; for (let i = 0; i < H; i++) w2[i] = params[o++]!; };

const rng = makeRng(7);
for (let ep = 1; ep <= epochs; ep++) {
  let loss = 0;
  const order = train.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  const grad = new Array<number>(params.length).fill(0);
  let inBatch = 0;
  for (const idx of order) {
    const e = train[idx]!, rows = z(e), p = softmax(rows);
    loss += -Math.log(Math.max(1e-12, p[e.label]!));
    // d loss / d score_c = p_c - [c == label]
    for (let c = 0; c < rows.length; c++) {
      const g = p[c]! - (c === e.label ? 1 : 0);
      if (g === 0) continue;
      const r = rows[c]!, h = hiddenOf(r);
      let o = 0;
      for (let i = 0; i < H; i++) { const dh = g * w2[i]! * (1 - h[i]! * h[i]!); for (let j = 0; j < D; j++) grad[o + i * D + j]! += dh * r[j]!; }
      o += H * D;
      for (let i = 0; i < H; i++) grad[o + i]! += g * w2[i]! * (1 - h[i]! * h[i]!);
      o += H;
      for (let i = 0; i < H; i++) grad[o + i]! += g * h[i]!;
    }
    if (++inBatch >= 32) {
      for (let k = 0; k < params.length; k++) {
        const gk = grad[k]! / inBatch + l2 * params[k]!;
        vel[k] = 0.9 * vel[k]! - lr * gk;
        params[k]! += vel[k]!;
        grad[k] = 0;
      }
      load(); inBatch = 0;
    }
  }
  if (ep % 5 === 0 || ep === 1) {
    console.log(`epoch ${String(ep).padStart(3)}  loss ${(loss / train.length).toFixed(4)}   copies the coach: train ${(100 * accuracy(train.slice(0, 3000))).toFixed(1)}%   held-out ${(100 * accuracy(held)).toFixed(1)}%`);
  }
}

const round = (x: number) => Number(x.toPrecision(6));
writeFileSync(outPath, `/* AUTO-GENERATED by datagen/src/coachcopy.ts - do not edit by hand.
 * A fast imitation of the coach's discard, fitted on ${train.length.toLocaleString('en-GB')} of its own decisions
 * from shuffle-${from} onwards, held out on shuffle-${heldFrom} onwards.
 * It copies the coach's MOVE, not the measured-best move: the teacher always answers and never
 * contradicts itself, so the labels are unlimited and noise-free. Held-out agreement with the
 * coach: ${(100 * accuracy(held)).toFixed(1)}%.
 * The number that matters is not that one - it is whether the copy plays colour hands at the
 * coach's rate. See solver/src/tools/_rates.ts and FINDINGS.
 */
import type { CopyWeights } from './copy.js';
export const COPY: CopyWeights = {
  hidden: ${H},
  mu: ${JSON.stringify(mu.map(round))},
  sd: ${JSON.stringify(sd.map(round))},
  W1: ${JSON.stringify(W1.map((r) => r.map(round)))},
  b1: ${JSON.stringify(b1.map(round))},
  w2: ${JSON.stringify(w2.map(round))},
};
`);
console.log(`\nheld-out agreement with the coach: ${(100 * accuracy(held)).toFixed(1)}%  ->  ${outPath}`);
console.log('Now measure what actually matters: tsx ../solver/src/tools/_rates.ts');
