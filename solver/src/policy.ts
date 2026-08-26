/**
 * The learned discard policy, as it runs in the browser.
 *
 * Weights are fitted by `datagen/src/policy.ts` on the decisions the evaluator can label reliably
 * (best action separated by more than 2 SE) and written to `policy.weights.ts`. Here we only score.
 *
 * `policyFeatures` is the single definition of the feature vector, imported by the trainer as well,
 * so training and inference cannot drift apart - a mismatch there produces a model that looks
 * trained and behaves randomly, with nothing to catch it.
 */
import { discardFeatures, unseenCounts, type DiscardFeatures, type Meld, type TileKind } from 'sg-mahjong-engine';
import { POLICY } from './policy.weights.js';
import { dealInChance, threatScale } from './reads.js';
import type { Context } from './targets.js';

export const POLICY_FEATURE_NAMES = [
  'sh', 'eff', 'rem', 'pairs', 'trip', 'seq', 'pseq', 'iso',
  'isoTile', 'hon', 'term', 'dragon', 'seatWind', 'prevWind',
  'honIso', 'sh_x_turn', 'eff_x_turn', 'iso_x_turn',
  // What the throw hands the TABLE. Everything above describes only the player's own hand, which
  // is how the model came to know nothing about danger while the coach was being taught it.
  'seen', 'dealIn', 'dealIn_x_threat',
] as const;

/**
 * What the player can see, reduced to the two numbers the features need.
 *
 * `threat` alone is deliberately NOT a feature: it is identical for every candidate discard, so it
 * cancels in the softmax and would train to nothing. It only carries signal multiplied by a
 * per-tile quantity.
 */
export interface PolicyTable { gone: readonly number[]; threat: number }
export function policyTable(ctx: Context): PolicyTable {
  const gone = new Array<number>(34).fill(0);
  for (const k of ctx.visible ?? []) if (k < 34) gone[k]!++;
  return { gone, threat: threatScale(ctx.opponentMelds, ctx.playerTurns) };
}

/** One candidate discard as a vector. Anything constant across candidates cancels in the softmax. */
export function policyFeatures(f: DiscardFeatures, role: number, prevailingWind: number, playerTurns: number, table?: PolicyTable): number[] {
  const turnNorm = Math.min(1, playerTurns / 40);
  const isoTile = f.isoTile ? 1 : 0;
  const hon = f.hon ? 1 : 0;
  const seen = table ? (table.gone[f.k] ?? 0) : 0;
  const dealIn = dealInChance(f.k, playerTurns, seen);
  return [
    f.sh, f.eff, f.rem, f.pairs, f.trip, f.seq, f.pseq, f.iso,
    isoTile, hon, f.term ? 1 : 0, f.dragon ? 1 : 0,
    f.k === 27 + role ? 1 : 0, f.k === 27 + prevailingWind ? 1 : 0,
    hon * isoTile, f.sh * turnNorm, f.eff * turnNorm, f.iso * turnNorm,
    seen, dealIn, dealIn * (table?.threat ?? 1),
  ];
}

type Weights = {
  hidden: number; mu: readonly number[]; sd: readonly number[];
  w?: readonly number[]; W1?: readonly (readonly number[])[]; b1?: readonly number[]; w2?: readonly number[];
};

export function policyScore(raw: number[], p: Weights = POLICY as Weights): number {
  const x = raw.map((v, j) => (v - p.mu[j]!) / p.sd[j]!);
  if (!p.hidden) { let t = 0; for (let j = 0; j < x.length; j++) t += p.w![j]! * x[j]!; return t; }
  let t = 0;
  for (let i = 0; i < p.hidden; i++) {
    let h = p.b1![i]!;
    const row = p.W1![i]!;
    for (let j = 0; j < x.length; j++) h += row[j]! * x[j]!;
    t += p.w2![i]! * Math.tanh(h);
  }
  return t;
}

export interface PolicyOption { tile: TileKind; score: number; p: number }
export interface PolicyRanking { best: TileKind; options: PolicyOption[] }

/**
 * Rank the legal discards by the learned policy. `ctx.visible` matters here for the same reason it
 * matters to the coach: `rem` counts how many copies of an improver are still out there, and a tile
 * whose copies are all face-up is not coming back.
 */
export function policyRank(concealed: TileKind[], melds: Meld[], ctx: Context): PolicyRanking {
  const unseen = unseenCounts({
    hand: concealed,
    allMelds: melds.flatMap((m) => m.tiles),      // own melds; the other seats' arrive via `visible`
    allDiscards: [...(ctx.visible ?? [])],
  });
  const feats = discardFeatures(concealed, melds, unseen);
  const table = policyTable(ctx);
  const scores = feats.map((f) => policyScore(policyFeatures(f, ctx.seat, ctx.prevailingWind, ctx.playerTurns, table)));
  const mx = Math.max(...scores);
  const ex = scores.map((s) => Math.exp(s - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  const options: PolicyOption[] = feats
    .map((f, i) => ({ tile: f.k, score: scores[i]!, p: ex[i]! / sum }))
    .sort((a, b) => b.score - a.score);
  return { best: options[0]!.tile, options };
}
