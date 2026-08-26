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
