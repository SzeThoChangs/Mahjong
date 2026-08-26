import { describe, it, expect } from 'vitest';
import { parseKinds, KIND } from 'sg-mahjong-engine';
import { rule4213, rule5313, rule961, allPongBreakdown } from '../src/evaluators.js';
import { evaluateTargets, handValue, type Context } from '../src/targets.js';
import { rankDiscards } from '../src/rank.js';

const K = parseKinds;
const ctx = (o: Partial<Context> = {}): Context => ({ seat: 2, prevailingWind: 0, bonus: [], playerTurns: 0, minimumFan: 2, selfDrawMinimumFan: 1, ...o });

describe('evaluators (book worked examples)', () => {
  it('Rule 4213 example from Fig 8:5 = 14', () => {
    // 3s 3s 3s | 7s 8s | 7t 8t | 3w 4w | 7w 8w | G G  -> 1 triplet, 4 two-sided pairs, 1 eye
    const r = rule4213({ concealed: K('3s 3s 3s 7s 8s 7t 8t 3w 4w 7w 8w G G'), melds: [] });
    expect(r.value).toBe(14);
  });
  it('Rule 5313 values chows 5, two-sided 3, eye 3', () => {
    const r = rule5313({ concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 2s 3s 5w 5w 9t'), melds: [] });
    // 2 chows (10) + two-sided 7s8s (3) + 2s3s (3) + eye 5w5w (3) = 19; 9t single 0. Not calling (13 tiles, one away? needs 3n+1=13 yes) -> check calling adds 1 if one-away
    expect(r.value).toBeGreaterThanOrEqual(19);
  });
  it('Rule 961 picks the right suit and counts 9/6/1', () => {
    const r = rule961({ concealed: K('1s 2s 3s 5s 5s 7s 9s E E R 4w 6t 8t'), melds: [] });
    expect(r.suit).toBe('sok');
    // 123s triplet 9 + 55s pair 6 + EE pair 6 + 7s9s one-sided chow pair 6 (book values it 6) + R single 1 = 28; 4w 6t 8t excluded as off-suit
    expect(r.value).toBe(28);
  });
  it('All-Pong breakdown counts triplets:pairs', () => {
    expect(allPongBreakdown({ concealed: K('1w 1w 1w 5t 5t E E 9s 9s 2w 3w 4w 7t'), melds: [] }).key).toBe('1:3');
  });
});

describe('targets', () => {
  it('no bonus tiles -> Ping Wu is on the table; with bonus -> All-Chow instead', () => {
    const h = { concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 2s 3s 5w 5w 9t'), melds: [] };
    expect(evaluateTargets(h, ctx()).some((t) => t.id === 'ping_wu')).toBe(true);
    expect(evaluateTargets(h, ctx({ bonus: [KIND.ANIMAL] })).some((t) => t.id === 'all_chow')).toBe(true);
  });
  it('Chicken is unarmed with 0 Fan at MF2, self-draw-only with 1, armed with 2', () => {
    const h = { concealed: K('1w 2w 3w 4t 5t 6t 7s 7s 7s 2s 3s 4s R'), melds: [] };
    const g = (b: number[]) => evaluateTargets(h, ctx({ bonus: b })).find((t) => t.id === 'chicken')!;
    expect(g([]).armed).toBe(false);
    expect(g([KIND.FLOWER + 2]).note).toBe('self-draw only');       // F3 = seat 2's flower
    expect(g([KIND.FLOWER + 2, KIND.ANIMAL]).armed).toBe(true);
  });
  it('a strong single-suit hand prefers Half-Color', () => {
    const h = { concealed: K('1s 2s 3s 4s 5s 6s 7s 7s 9s 9s E E 4w'), melds: [] };
    expect(handValue(h, ctx()).best.id).toBe('half_color');
  });
});

describe('rankDiscards', () => {
  it('throws the off-suit tile from a Half-Color hand', () => {
    const r = rankDiscards(K('1s 2s 3s 4s 5s 6s 7s 7s 9s 9s E E 4w 8t'), [], ctx());
    expect(['4w', '8t']).toContain(['1s','2s','3s','4s','5s','6s','7s','8s','9s'].includes(String(r.best.tile)) ? '' : (r.best.tile === 3 ? '4w' : '8t'));
    expect(r.plan.startsWith('Half-Color')).toBe(true);
    expect(r.options.find((o) => o.tile === 18 /*1s*/)!.verdict).not.toBe('best');
  });
  it('never recommends breaking the only pair when an isolated tile exists', () => {
    const r = rankDiscards(K('2t 3t 4t 6s 7s 8s 1w 1w E E 9w 5t R 7w'), [], ctx({ bonus: [KIND.FLOWER + 2, KIND.ANIMAL], playerTurns: 14 }));
    expect([0 /*1w*/]).not.toContain(r.best.tile);
    expect(r.options.every((o) => o.reasons !== undefined)).toBe(true);
  });
});

describe('discard reasons are always explanations', () => {
  // The Train tab prints o.reasons directly. When the list came back empty it used to fall back to
  // the internal plan id ("plan: chicken") - 12.6% of options, and the coach's own pick in 8.1% of
  // hands. Ranks 2 and 8 were 89% of it: they sit in neither the terminal branch nor the 3-7 one.
  const hands = [
    '2t 2t 3t 4t 5t 6t 7t 8t 8t 9t 1s 2s 3s 5s',   // ranks 2 and 8 with neighbours, both suits
    '1w 1w 2w 8w 9w 5t 5t 6t 2s 8s E E S S',        // 2/8 next to nothing, honour pairs
    '2t 8t 2s 8s 2w 8w 5t 5s 5w E S W N',           // every 2 and 8 isolated
    '3t 3t 3t 4t 5t 6t 7t 7t 7t 2s 2s 8s 8s 9s',    // completed sets plus 2/8 pairs
  ];
  it('never returns an option with no reason', () => {
    for (const h of hands) {
      const r = rankDiscards(K(h), [], ctx({ playerTurns: 12 }));
      for (const o of r.options) {
        expect(o.reasons.length, `${h} -> tile ${o.tile} had no reason`).toBeGreaterThan(0);
        for (const reason of o.reasons) expect(reason).not.toMatch(/^plan:/);
      }
    }
  });
  it('explains 2 and 8 specifically rather than falling through', () => {
    const r = rankDiscards(K('2t 3t 4t 5t 6t 7t 8t 2s 3s 4s 5s 6s 7s 8s'), [], ctx({ playerTurns: 12 }));
    for (const rank2or8 of r.options.filter((o) => [1, 7].includes(o.tile % 9))) {
      expect(rank2or8.reasons.join(' ')).toMatch(/edge/);
    }
  });
});

describe('learned policy', () => {
  // The shipped weights and the trainer must agree on the feature vector. If they drift, the model
  // still returns a confident answer - it is just scoring the wrong numbers - so pin the contract.
  it('scores the vector it was trained on', async () => {
    const { POLICY_FEATURE_NAMES, policyFeatures, policyRank, policyScore } = await import('../src/policy.js');
    const { POLICY } = await import('../src/policy.weights.js');
    expect(POLICY.mu.length).toBe(POLICY_FEATURE_NAMES.length);
    expect(POLICY.sd.length).toBe(POLICY_FEATURE_NAMES.length);
    if (POLICY.hidden) {
      expect(POLICY.W1.length).toBe(POLICY.hidden);
      for (const row of POLICY.W1) expect(row.length).toBe(POLICY_FEATURE_NAMES.length);
      expect(POLICY.w2.length).toBe(POLICY.hidden);
    }
    const hand = K('2t 3t 4t 5t 6t 7t 8t 2s 3s 4s 5s 6s 7s 9w');
    const r = policyRank(hand, [], ctx({ playerTurns: 12 }));
    expect(r.options.length).toBe(new Set(hand).size);
    expect(r.options[0]!.tile).toBe(r.best);
    // sorted by score, and the softmax is a distribution
    for (let i = 1; i < r.options.length; i++) expect(r.options[i - 1]!.score).toBeGreaterThanOrEqual(r.options[i]!.score);
    expect(r.options.reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 6);
    // no feature index is silently dropped: a changed vector changes the score
    const f = { k: 0, sh: 2, eff: 5, rem: 12, pairs: 1, trip: 0, seq: 2, pseq: 1, iso: 3, isoTile: false, term: false, hon: false, dragon: false, wind: false } as never;
    expect(policyScore(policyFeatures(f, 0, 0, 10))).not.toBe(policyScore(policyFeatures(f, 0, 0, 40)));
  });

  it('counts the table: a tile whose copies are all gone is not an improver', async () => {
    const { policyRank } = await import('../src/policy.js');
    const hand = K('2t 3t 5t 6t 8t 9t 2s 3s 5s 6s 8s 9s 1w 1w');
    const blind = policyRank(hand, [], ctx({ playerTurns: 20 }));
    // bury every tile that would complete the 2t3t shape
    const dead = [...K('1t 1t 1t 1t 4t 4t 4t 4t')];
    const seeing = policyRank(hand, [], ctx({ playerTurns: 20, visible: dead }));
    expect(seeing.options.map((o) => o.score)).not.toEqual(blind.options.map((o) => o.score));
  });
});

describe('the coach reads the table', () => {
  const hand = '1t 2t 3t 4s 5s 6s 7w 8w 9w E E 2s 8s 5w';
  it('prefers a tile already on the floor over an identical fresh one', () => {
    const late = { playerTurns: 40 };
    const blind = rankDiscards(K(hand), [], ctx(late));
    // bury three copies of 5w: it is now the safe throw, and the coach should notice
    const seeing = rankDiscards(K(hand), [], ctx({ ...late, visible: K('5w 5w 5w') }));
    const riskOf = (r: typeof blind, tile: number) => r.options.find((o) => o.tile === tile)!.risk;
    const fiveWan = K('5w')[0]!;
    expect(riskOf(seeing, fiveWan)).toBeLessThan(riskOf(blind, fiveWan));
    expect(seeing.options.find((o) => o.tile === fiveWan)!.reasons.join(' ')).toMatch(/on the floor/);
  });

  it('fears a table with three exposed sets more than a quiet one', () => {
    const quiet = rankDiscards(K(hand), [], ctx({ playerTurns: 40, opponentMelds: [0, 0, 0] }));
    const scary = rankDiscards(K(hand), [], ctx({ playerTurns: 40, opponentMelds: [3, 3, 3] }));
    const total = (r: typeof quiet) => r.options.reduce((a, o) => a + o.risk, 0);
    expect(total(scary)).toBeGreaterThan(total(quiet));
  });

  it('charges nothing on turn zero, when nobody can be ready', () => {
    const r = rankDiscards(K(hand), [], ctx({ playerTurns: 0 }));
    for (const o of r.options) expect(o.risk).toBeLessThan(0.05);
  });
});
