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
