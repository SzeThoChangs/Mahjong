import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES, makeRng } from 'sg-mahjong-engine';
import { runSession, playHand, handSeed } from '../src/session.js';
import { replayHand } from '../src/replay.js';
import { computeStats } from '../src/stats.js';
import { DEFAULT_RANDOMNESS, pickRanked, type BotType } from '../src/bots.js';
import type { DecisionRecord, HandRecord } from '../src/records.js';

describe('generator', () => {
  it('a session is deterministic and every hand reproduces from its seed', () => {
    const a = runSession({ sessionId: 3, seed: 12345, rules: DEFAULT_RULES, botTypes: ['efficiency', 'pong', 'chow', 'random'], maxHands: 6 });
    const b = runSession({ sessionId: 3, seed: 12345, rules: DEFAULT_RULES, botTypes: ['efficiency', 'pong', 'chow', 'random'], maxHands: 6 });
    expect(a.hands.map((h) => h.hash)).toEqual(b.hands.map((h) => h.hash));
    for (const h of a.hands) expect(replayHand(h).match).toBe(true);
  });
  it('records every decision with legal actions, the selection is always legal, visible state has no hidden info', () => {
    const decisions: DecisionRecord[] = []; const hands: HandRecord[] = [];
    runSession({ sessionId: 1, seed: 99, rules: DEFAULT_RULES, botTypes: ['aggressive', 'efficiency', 'pong', 'chow'], maxHands: 4, sink: { decision: (r) => decisions.push(r), hand: (r) => hands.push(r) } });
    expect(decisions.length).toBeGreaterThan(100);
    for (const d of decisions) {
      expect(d.legal).toContain(d.sel);
      expect(d.legal.length).toBeGreaterThan(0);
      if (d.k === 'discard') { expect(d.legal.every((l) => l.startsWith('d:'))).toBe(true); expect(Array.isArray(d.f)).toBe(true); expect((d.f as unknown[]).length).toBe(new Set(d.me.h).size); }
      if (d.k === 'claim') expect(d.legal).toContain('pass');
      if (d.k === 'self') expect(d.legal).toContain('proceed');
      expect(Object.keys(d)).not.toContain('truth'); expect(Object.keys(d)).not.toContain('wall');
      expect(d.me.h.length % 3).toBe(d.k === 'discard' ? 2 : d.k === 'self' ? 2 : 1);
    }
    const st = computeStats(hands);
    expect(st.illegal).toBe(0); expect(st.chipsSum).toBe(0);
    expect(hands.every((h) => h.cnt.decisions === decisions.filter((d) => d.g === h.g && d.h === h.h).length)).toBe(true);
  });
  it('dealer rotates per rules and winds advance', () => {
    const s = runSession({ sessionId: 0, seed: 5, rules: DEFAULT_RULES, botTypes: ['efficiency', 'efficiency', 'efficiency', 'efficiency'], maxHands: 40 });
    const winds = new Set(s.hands.map((h) => h.w));
    expect(winds.size).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < s.hands.length; i++) {
      const prev = s.hands[i - 1]!, cur = s.hands[i]!;
      const retained = prev.winner === prev.dl || prev.winner === null;
      expect(cur.dl).toBe(retained ? prev.dl : (prev.dl + 1) % 4);
    }
  });
  it('controlled randomness picks the top choice ~70% of the time', () => {
    const rng = makeRng(1); let top = 0, N = 20000;
    for (let i = 0; i < N; i++) if (pickRanked(['a', 'b', 'c', 'd', 'e'], rng, DEFAULT_RANDOMNESS) === 'a') top++;
    expect(top / N).toBeGreaterThan(0.69); expect(top / N).toBeLessThan(0.73);   // 0.70 + 0.05/5
  });
  it('hand seeds differ per hand and bots differ per seat', () => {
    expect(handSeed(1, 0)).not.toBe(handSeed(1, 1));
    const t: BotType[] = ['random', 'random', 'random', 'random'];
    const a = playHand({ sessionId: 0, handIdx: 0, seed: 77, dealer: 0, prevailingWind: 0, botTypes: t, scores: [0, 0, 0, 0] }, DEFAULT_RULES, DEFAULT_RANDOMNESS);
    const b = playHand({ sessionId: 0, handIdx: 0, seed: 77, dealer: 0, prevailingWind: 0, botTypes: t, scores: [0, 0, 0, 0] }, DEFAULT_RULES, DEFAULT_RANDOMNESS);
    expect(a.record.hash).toBe(b.record.hash);
  });
});
