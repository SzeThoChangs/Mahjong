/**
 * Call or pass: the learned model for claim decisions, as it runs in the browser.
 *
 * Discards were the obvious thing to model and the hardest to measure - only 4% of them have a
 * best action the play-outs can separate at 2 SE. Claims are the opposite: 27% separate, because
 * the difference between ponging and passing is usually large. So the labels here are cleaner even
 * though there are fewer of them.
 *
 * As with `policy.ts`, the feature vector is defined HERE and imported by the trainer. A second
 * copy in datagen would silently drift and produce a model that looks trained and picks at random.
 */
import {
  fanInHand, handFeatures, shanten, unseenCounts,
  type Meld, type TileKind,
} from 'sg-mahjong-engine';
import { threatScale } from './reads.js';
import { CLAIM_POLICY } from './claim.weights.js';
import type { Context } from './targets.js';

export type ClaimKindName = 'pass' | 'chow' | 'pong' | 'kong3' | 'win';

/** One option on the table: what it is, and which tiles from hand it would consume. */
export interface ClaimCandidate {
  kind: ClaimKindName;
  /** hand tiles the claim eats (2 for pong/chow, 3 for kong3, none for pass/win) */
  used: TileKind[];
}

export const CLAIM_FEATURE_NAMES = [
  'isPass', 'isChow', 'isPong', 'isKong', 'isWin',
  'shAfter', 'shGain',            // distance to a win after the call, and what the call buys
  'eff', 'rem',                   // how many tiles still help, and how many copies of them are live
  'fanAfter', 'fanGain', 'armed', // does this call make the hand legal at the table minimum?
  'meldsAfter', 'opens',          // an exposed hand is worth less and is readable by everyone
  'opens_x_threat',               // ...and opening into a table that looks ready is worse still
  'shGain_x_turn', 'armed_x_turn', 'opens_x_late',
] as const;

const FALLBACK_SH = 9;

/**
 * Score one option. `concealed` and `melds` are the hand BEFORE the call; `offered` is the tile on
 * the floor. Everything is measured after the forced follow-up discard, because a call you cannot
 * discard sensibly out of is not the bargain it looks like.
 */
export function claimFeatures(c: ClaimCandidate, concealed: TileKind[], melds: Meld[], offered: TileKind, ctx: Context): number[] {
  const turnNorm = Math.min(1, ctx.playerTurns / 40);
  const threat = threatScale(ctx.opponentMelds, ctx.playerTurns);
  const fanBefore = fanInHand({ melds, bonus: [...ctx.bonus], seat: ctx.seat, prevailingWind: ctx.prevailingWind });
  const shBefore = shanten(concealed, melds.length);

  let rest = concealed;
  let newMelds = melds;
  if (c.kind !== 'pass' && c.kind !== 'win') {
    rest = [...concealed];
    for (const k of c.used) { const i = rest.indexOf(k); if (i >= 0) rest.splice(i, 1); }
    const type = c.kind === 'chow' ? 'chow' : c.kind === 'pong' ? 'pong' : 'kong';
    newMelds = [...melds, { type, tiles: [...c.used, offered].sort((a, b) => a - b), concealed: false }];
  }

  // after any call you must throw something: take the best hand you can be left with
  let shAfter = FALLBACK_SH;
  let best: TileKind[] | null = null;
  if (c.kind === 'pass' || c.kind === 'win') {
    shAfter = c.kind === 'win' ? -1 : shBefore;
    best = concealed;
  } else {
    const seen = new Set<TileKind>();
    for (const k of rest) {
      if (seen.has(k)) continue;
      seen.add(k);
      const after = [...rest]; after.splice(after.indexOf(k), 1);
      const sh = shanten(after, newMelds.length);
      if (sh < shAfter) { shAfter = sh; best = after; }
    }
  }

  const fanAfter = fanInHand({ melds: newMelds, bonus: [...ctx.bonus], seat: ctx.seat, prevailingWind: ctx.prevailingWind });
  const armed = fanAfter >= ctx.minimumFan ? 1 : 0;
  const opens = c.kind === 'pass' || c.kind === 'win' ? 0 : 1;

  // ukeire on the resulting hand, counting the table as gone
  let eff = 0, rem = 0;
  if (best && best.length % 3 === 1) {
    const unseen = unseenCounts({
      hand: best,
      allMelds: newMelds.flatMap((m) => m.tiles),
      allDiscards: [...(ctx.visible ?? []), offered],
    });
    const hf = handFeatures(best, newMelds, unseen, { bonus: [...ctx.bonus], seat: ctx.seat, prevailingWind: ctx.prevailingWind });
    eff = hf.eff; rem = hf.rem;
  }

  const shGain = shBefore - shAfter;
  return [
    c.kind === 'pass' ? 1 : 0, c.kind === 'chow' ? 1 : 0, c.kind === 'pong' ? 1 : 0,
    c.kind === 'kong3' ? 1 : 0, c.kind === 'win' ? 1 : 0,
    shAfter, shGain, eff, rem,
    fanAfter, fanAfter - fanBefore, armed,
    newMelds.length, opens,
    opens * threat,
    shGain * turnNorm, armed * turnNorm, opens * turnNorm,
  ];
}

type Weights = {
  hidden: number; mu: readonly number[]; sd: readonly number[];
  w?: readonly number[]; W1?: readonly (readonly number[])[]; b1?: readonly number[]; w2?: readonly number[];
};

export function claimScore(raw: number[], p: Weights = CLAIM_POLICY as Weights): number {
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

/**
 * Decode a legal-action string ("pong:7", "chow:5,6,7", "pass", "win") into a candidate.
 *
 * Shared by the trainer and the app so the two cannot disagree about what an action string means -
 * a mismatch here would train on one shape and score another.
 *
 * Returns null for the self-decision kongs (`kong4:` / `kong1:`): a concealed kong eats four tiles
 * from hand with no tile off the floor, and `kong1` upgrades an exposed pong rather than adding a
 * meld, so neither fits this shape. Those need their own model.
 */
export function claimCandidateOf(a: string, offered: TileKind): ClaimCandidate | null {
  if (a === 'pass' || a === 'proceed') return { kind: 'pass', used: [] };
  if (a === 'win') return { kind: 'win', used: [] };
  if (a.startsWith('pong:')) { const k = Number(a.slice(5)) as TileKind; return { kind: 'pong', used: [k, k] }; }
  if (a.startsWith('kong3:')) { const k = Number(a.slice(6)) as TileKind; return { kind: 'kong3', used: [k, k, k] }; }
  if (a.startsWith('chow:')) {
    const kinds = a.slice(5).split(',').map(Number) as TileKind[];
    const used = [...kinds]; const i = used.indexOf(offered); if (i >= 0) used.splice(i, 1);
    return { kind: 'chow', used };
  }
  return null;
}

export interface ClaimOptionScore { candidate: ClaimCandidate; score: number; p: number }
export interface ClaimRanking { best: ClaimCandidate; options: ClaimOptionScore[] }

/** Rank the legal claims (always including `pass`) by the learned model. */
export function claimRank(candidates: ClaimCandidate[], concealed: TileKind[], melds: Meld[], offered: TileKind, ctx: Context): ClaimRanking {
  const scores = candidates.map((c) => claimScore(claimFeatures(c, concealed, melds, offered, ctx)));
  const mx = Math.max(...scores);
  const ex = scores.map((s) => Math.exp(s - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  const options = candidates
    .map((c, i) => ({ candidate: c, score: scores[i]!, p: ex[i]! / sum }))
    .sort((a, b) => b.score - a.score);
  return { best: options[0]!.candidate, options };
}
