/**
 * Reading the paired standard error back correctly, whichever run wrote it.
 *
 * Runs evaluated before 2026-08-25 stored `gapSe` a factor of sqrt(k) too small: the Bessel
 * correction was written as `/(k-1) * k / max(1,k)`, whose trailing term cancels to 1, so the
 * variance came out a factor of k short (11.3x on the standard error at 128 rollouts).
 * `ev`, `gap` and every ranking built on them were never affected - only the claim that the
 * ranking was reliable.
 *
 * The stored value is recoverable rather than lost: the gap was measured over k paired rollouts,
 * k = min(action.n, best.n), so the true SE is the stored one times sqrt(k). Runs carry
 * `seVersion` in evals-manifest.json; a run without one predates the fix.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ActionEval } from './evaluate.js';

export const SE_VERSION = 2;   // 1: the sqrt(k)-short formula.  2: corrected in evaluate.ts

/** Which formula wrote this run's gapSe. Absent manifest or field => the old one. */
export function seVersionOf(dir: string): number {
  try {
    const m = JSON.parse(readFileSync(resolve(dir, 'evals-manifest.json'), 'utf8')) as { seVersion?: number };
    return typeof m.seVersion === 'number' ? m.seVersion : 1;
  } catch { return 1; }
}

/** Standard error of (best.ev - action.ev) on paired rollouts, corrected for how `version` stored it. */
export function pairedSe(action: ActionEval, best: ActionEval, version: number): number {
  if (typeof action.gapSe !== 'number') return NaN;
  if (version >= SE_VERSION) return action.gapSe;
  return action.gapSe * Math.sqrt(Math.max(1, Math.min(action.n, best.n)));
}

/**
 * How many standard errors separate the best action from the runner-up - the t statistic that says
 * whether a position can be graded at all.
 *
 * Two statistics are compared and the WEAKER one wins, because they can disagree: `gap` is the mean
 * paired difference over the rollouts the pair shares, while `best.ev - second.ev` is the difference
 * of two means that adaptive halving may have computed over different rollout counts. A question is
 * only worth asking if it is decisive whichever way the number is read.
 *
 * The degenerate cases are the ones that bite:
 *   - se absent (a run predating gapSe): unjudgeable, so let it through rather than empty the pack
 *   - se == 0 with a real gap: the branches never disagreed, so the separation is perfect
 *   - se == 0 with gap == 0: the two actions produced IDENTICAL outcomes. They are tied, not
 *     decisively separated - treating this as infinite separation admits ungradeable ties.
 */
export function separationT(best: ActionEval, second: ActionEval, version: number): number {
  const se = pairedSe(second, best, version);
  const gap = Math.min(second.gap, best.ev - second.ev);
  if (!Number.isFinite(se)) return Infinity;
  if (se > 0) return gap / se;
  return gap > 0 ? Infinity : 0;
}
