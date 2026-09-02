/**
 * Features for a fast IMITATION of the coach.
 *
 * Why this exists. Every EV in the dataset was measured by playing the hand out with a cheap bot,
 * and that bot decides what the label means: "worth this much if play continues like THAT". The
 * cheap bots all fail at the same thing - a colour hand. Measured over 500 hands apiece, isolation
 * finishes one 3.9% of the time and shanten 2.0%, against the coach's 34.6%. So on any position
 * whose best plan is a colour hand, the grader is scoring a plan it cannot carry out. The coach
 * itself cannot grade: at 77 ms a hand against shanten's 0.57 it is 135x too slow, and the job is
 * hundreds of millions of hands.
 *
 * WHAT IS DIFFERENT ABOUT THIS MODEL, and why it is not a fourth attempt at something that failed
 * three times. The models that lost money learned from the MEASURED best action - labels that exist
 * for only 4% of discards and are noisy even there. This one copies the coach's own move. The coach
 * answers every position, always the same way, so the labels are unlimited, free and exactly
 * consistent. Imitating a known teacher is a far easier problem than learning from noise, and the
 * goal is not to play well - it is to play like the coach, fast, so it can grade.
 *
 * THE FEATURES ADD SUIT, which `policyFeatures` has none of. The coach plays colour hands because
 * `handValue` picks Half-Color as its plan; nothing in the old 21 features can see a suit at all, so
 * a copy built on them could not learn the one behaviour this whole exercise is about. These four
 * make suit concentration visible: how much of the hand is in this tile's suit, whether that is the
 * hand's dominant suit, how dominant that suit is, and the two together.
 */
import { isHonour, suitOf, type DiscardFeatures, type TileKind } from 'sg-mahjong-engine';
import { policyFeatures, POLICY_FEATURE_NAMES, type PolicyTable } from './policy.js';

export const COPY_FEATURE_NAMES = [
  ...POLICY_FEATURE_NAMES,
  'suitShare',        // share of the hand's suited tiles that are in THIS tile's suit
  'inDominant',       // 1 if this tile is in the suit the hand holds most of
  'dominance',        // how concentrated the hand is: share held by its biggest suit
  'offDominant_x_dominance',   // throwing off-suit matters more the more committed the hand is
] as const;

/** The suit facts a colour plan turns on, computed once for the whole hand. */
export interface SuitTable {
  /** count of suited tiles by suit index 0-2 */
  bySuit: [number, number, number];
  suited: number;
  dominant: number;      // suit index 0-2, or -1 when the hand holds no suited tiles
  dominance: number;     // 0..1
}
export function suitTable(hand: readonly TileKind[]): SuitTable {
  const bySuit: [number, number, number] = [0, 0, 0];
  let suited = 0;
  for (const k of hand) {
    if (k > 26 || isHonour(k)) continue;
    bySuit[Math.floor(k / 9) as 0 | 1 | 2]++;
    suited++;
  }
  let dominant = -1, best = 0;
  for (let s = 0; s < 3; s++) if (bySuit[s]! > best) { best = bySuit[s]!; dominant = s; }
  return { bySuit, suited, dominant, dominance: suited ? best / suited : 0 };
}

export function copyFeatures(
  f: DiscardFeatures, role: number, prevailingWind: number, playerTurns: number,
  table: PolicyTable | undefined, suits: SuitTable,
): number[] {
  const base = policyFeatures(f, role, prevailingWind, playerTurns, table);
  const s = f.k <= 26 ? Math.floor(f.k / 9) : -1;
  const share = s < 0 || !suits.suited ? 0 : suits.bySuit[s as 0 | 1 | 2]! / suits.suited;
  const inDom = s >= 0 && s === suits.dominant ? 1 : 0;
  return [...base, share, inDom, suits.dominance, (1 - inDom) * suits.dominance];
}

/** The fitted weights, in the same shape `policy.weights.ts` uses. */
export interface CopyWeights {
  hidden: number; mu: number[]; sd: number[];
  W1: number[][]; b1: number[]; w2: number[];
  /** linear head, used when hidden is 0 */
  w?: number[];
}

/** Score one candidate. Same arithmetic as the policy model, so nothing new to get wrong. */
export function copyScore(x: number[], P: CopyWeights): number {
  const r = x.map((v, j) => (v - (P.mu[j] ?? 0)) / (P.sd[j] || 1));
  if (!P.hidden) { let t = 0; for (let j = 0; j < r.length; j++) t += (P.w?.[j] ?? 0) * r[j]!; return t; }
  let t = 0;
  for (let i = 0; i < P.hidden; i++) {
    let h = P.b1[i]!; const row = P.W1[i]!;
    for (let j = 0; j < r.length; j++) h += row[j]! * r[j]!;
    t += P.w2[i]! * Math.tanh(h);
  }
  return t;
}

export { suitOf };
