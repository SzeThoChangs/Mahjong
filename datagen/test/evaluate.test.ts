import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES, GameState, makeRng, tableConfigOf, kindOf, isBonus, TOTAL_TILES } from 'sg-mahjong-engine';
import { runSession } from '../src/session.js';
import { positionAt, determinize } from '../src/position.js';
import { evaluateDecision } from '../src/evaluate.js';
import type { DecisionRecord, HandRecord } from '../src/records.js';
import { DEFAULT_RANDOMNESS } from '../src/bots.js';

describe('evaluator', () => {
  const decisions: DecisionRecord[] = []; const hands: HandRecord[] = [];
  runSession({ sessionId: 7, seed: 4242, rules: DEFAULT_RULES, botTypes: ['efficiency', 'pong', 'chow', 'aggressive'], maxHands: 2, sink: { decision: (r) => decisions.push(r), hand: (r) => hands.push(r) } });
  const hand = hands[0]!; const ds = decisions.filter((d) => d.g === hand.g && d.h === hand.h);

  it('reconstructs the recorded position exactly (every decision of a hand)', () => {
    for (const d of ds) {
      const pos = positionAt(hand, d.d, DEFAULT_RULES)!;
      const p = pos.g.pending()!;
      expect(p.kind).toBe(d.k); expect(p.seat).toBe(d.p);
      expect(pos.g.players[p.seat]!.hand.map(kindOf).sort((a, b) => a - b)).toEqual([...d.me.h].sort((a, b) => a - b));
      expect(p.legal.length).toBe(d.legal.length);
    }
  });
  it('determinize keeps everything visible, conserves all 148 tiles, never puts bonus tiles in hands', () => {
    const d = ds.find((x) => x.k === 'discard' && x.t > 20)!;
    const { g } = positionAt(hand, d.d, DEFAULT_RULES)!;
    const before = g.snapshot();
    const snap = determinize(g, d.p, makeRng(5));
    expect(snap.players[d.p]!.hand).toEqual(before.players[d.p]!.hand);
    for (let s = 0; s < 4; s++) {
      expect(snap.players[s]!.melds).toEqual(before.players[s]!.melds);
      expect(snap.players[s]!.bonus).toEqual(before.players[s]!.bonus);
      expect(snap.players[s]!.discards).toEqual(before.players[s]!.discards);
      expect(snap.players[s]!.hand.length).toBe(before.players[s]!.hand.length);
      if (s !== d.p) for (const t of snap.players[s]!.hand) expect(isBonus(kindOf(t))).toBe(false);
    }
    const all = new Set<number>();
    for (const p of snap.players) { p.hand.forEach((t) => all.add(t)); p.bonus.forEach((t) => all.add(t)); p.discards.forEach((t) => all.add(t)); p.melds.forEach((m) => m.instances.forEach((t) => all.add(t))); }
    for (let i = snap.wall.front; i <= snap.wall.back; i++) all.add(snap.wall.order[i]!);
    expect(all.size).toBe(TOTAL_TILES);
    // the determinized game is playable to the end
    const h = GameState.fromSnapshot(snap, tableConfigOf(DEFAULT_RULES), { rules: DEFAULT_RULES });
    expect(() => h.run([0, 1, 2, 3].map(() => ({ chooseDiscard: (v) => v.hand[0]!, chooseSelfAction: (_v, o) => o.find((x) => x.kind === 'win') ?? null, chooseClaim: (_v, o) => o.find((x) => x.kind === 'win') ?? null })))).not.toThrow();
  });
  it('evaluates every legal action with rollouts and reports regret', () => {
    const d = ds.find((x) => x.k === 'discard' && x.t > 10)!;
    const { g } = positionAt(hand, d.d, DEFAULT_RULES)!;
    const ev = evaluateDecision(g, d, { dir: '', hands: 0, perHand: 0, rollouts: 6, mode: 'sampled', policy: 'shanten', seed: 1, workers: 1, workerIndex: 0, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS }, DEFAULT_RULES);
    expect(ev.actions.length).toBe(new Set(d.me.h).size);
    expect(ev.actions.every((a) => a.n === 6 && Number.isFinite(a.ev))).toBe(true);
    expect(ev.best).toBe(ev.actions[0]!.a);
    expect(Number.isFinite(ev.regret)).toBe(true); expect(ev.regret).toBeGreaterThanOrEqual(0);
    // oracle mode works too and is deterministic
    const o1 = evaluateDecision(g, d, { dir: '', hands: 0, perHand: 0, rollouts: 4, mode: 'oracle', policy: 'fast', seed: 3, workers: 1, workerIndex: 0, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS }, DEFAULT_RULES);
    const o2 = evaluateDecision(g, d, { dir: '', hands: 0, perHand: 0, rollouts: 4, mode: 'oracle', policy: 'fast', seed: 3, workers: 1, workerIndex: 0, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS }, DEFAULT_RULES);
    expect(o1.actions).toEqual(o2.actions);
  });
});
