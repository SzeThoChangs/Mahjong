import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES, makeRng } from 'sg-mahjong-engine';
import { runSession } from '../src/session.js';
import { positionAt } from '../src/position.js';
import { evaluateDecision, type ActionEval } from '../src/evaluate.js';
import { pairedSe, SE_VERSION } from '../src/se.js';
import { DEFAULT_RANDOMNESS } from '../src/bots.js';
import type { DecisionRecord, HandRecord } from '../src/records.js';

const action = (over: Partial<ActionEval>): ActionEval =>
  ({ a: 'd:1', ev: 0, sd: 0, win: 0, dealin: 0, draw: 0, n: 128, gap: 0, gapSe: 0, ...over });

describe('paired standard error', () => {
  it('reads a current run as written', () => {
    const a = action({ gapSe: 1.25, n: 128 }), best = action({ n: 128 });
    expect(pairedSe(a, best, SE_VERSION)).toBeCloseTo(1.25, 10);
  });

  it('restores the sqrt(k) a pre-fix run left off, on the PAIRED count', () => {
    // k is the number of rollouts the two actions share, so the smaller n of the pair
    const a = action({ gapSe: 0.1, n: 32 }), best = action({ n: 128 });
    expect(pairedSe(a, best, 1)).toBeCloseTo(0.1 * Math.sqrt(32), 10);
    // this is the 11.3x that made run-money2 look decisive when it was not
    expect(pairedSe(action({ gapSe: 0.1, n: 128 }), best, 1) / 0.1).toBeCloseTo(Math.sqrt(128), 6);
  });

  it('is NaN when the run predates gapSe entirely', () => {
    const a = { ...action({}), gapSe: undefined as unknown as number };
    expect(Number.isNaN(pairedSe(a, action({}), 1))).toBe(true);
  });
});

describe('evaluator gapSe', () => {
  // The bug was a Bessel correction that cancelled to 1. Guard the property it violated:
  // gapSe must be the sample SD of the paired differences divided by sqrt(k), which for k
  // paired rollouts of a spread-out outcome is the same order as the outcomes themselves - not
  // a factor of sqrt(k) below them.
  it('is the sample SD of paired differences over sqrt(k), not the population SD over k', () => {
    const decisions: DecisionRecord[] = []; const hands: HandRecord[] = [];
    runSession({ sessionId: 11, seed: 909, rules: DEFAULT_RULES, botTypes: ['efficiency', 'pong', 'chow', 'aggressive'], maxHands: 2, sink: { decision: (r) => decisions.push(r), hand: (r) => hands.push(r) } });
    const hand = hands[0]!;
    const d = decisions.find((x) => x.g === hand.g && x.h === hand.h && x.k === 'discard' && x.t > 10)!;
    const { g } = positionAt(hand, d.d, DEFAULT_RULES)!;
    const rollouts = 24;
    const ev = evaluateDecision(g, d, { dir: '', hands: 0, perHand: 0, rollouts, mode: 'sampled', policy: 'shanten', seed: 2, workers: 1, workerIndex: 0, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS }, DEFAULT_RULES);

    for (const a of ev.actions.slice(1)) {
      expect(a.gapSe).toBeGreaterThanOrEqual(0);
      if (a.gap === 0 && a.gapSe === 0) continue;              // identical outcome streams
      // SE of a mean over k draws sits at sd/sqrt(k). With chip outcomes in the tens, the
      // pre-fix formula produced values ~1/sqrt(k) of this - assert the honest magnitude.
      const implied = a.gapSe * Math.sqrt(rollouts);            // implied sample SD of the differences
      expect(implied).toBeGreaterThan(a.gapSe);
      expect(implied).toBeLessThan(1000);
    }
  });

  it('a known sample: Bessel-corrected SE of the mean matches the textbook value', () => {
    // differences 1,2,3,4,5 -> sample sd = sqrt(2.5), SE = sqrt(2.5/5) = 0.7071
    const xs = [1, 2, 3, 4, 5];
    const k = xs.length, m = xs.reduce((a, b) => a + b, 0) / k, m2 = xs.reduce((a, b) => a + b * b, 0) / k;
    const gapVar = Math.max(0, m2 - m * m) * k / (k - 1);       // the corrected line from evaluate.ts
    expect(Math.sqrt(gapVar / k)).toBeCloseTo(0.70710678, 6);
    // the shipped bug: /(k-1) * k / max(1,k) === /(k-1), a factor of k short in the variance
    const buggy = Math.max(0, m2 - m * m) / (k - 1) * k / Math.max(1, k);
    expect(Math.sqrt(gapVar / k) / Math.sqrt(buggy / k)).toBeCloseTo(Math.sqrt(k), 6);
  });

  it('makeRng is deterministic, so the paired rollouts really are paired', () => {
    const a = makeRng(7), b = makeRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
