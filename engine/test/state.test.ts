import { describe, it, expect } from 'vitest';
import { Wall, makeRng } from '../src/wall.js';
import { playGame, type Decision, type Bot } from '../src/game.js';
import { GameState } from '../src/state.js';
import { IsolationBot, RandomBot } from '../src/bots.js';
import { DEFAULT_TABLE } from '../src/payout.js';

const hashOf = () => { const seen: string[] = []; return { rec: { record: (d: Decision) => seen.push(`${d.kind}:${d.seat}:${JSON.stringify(d.selected)}:${d.legal.length}`) }, seen }; };
const mk = (seed: number, i: number): Bot[] => [0, 1, 2, 3].map((s) => (i % 2 ? new IsolationBot(makeRng(seed * 7 + s)) : new RandomBot(makeRng(seed * 7 + s), 0.5, 0.5)));

describe('GameState', () => {
  it('matches playGame exactly over 200 seeds (results and decision sequence)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const a = hashOf(), b = hashOf();
      const r1 = playGame(mk(seed, seed), DEFAULT_TABLE, new Wall(makeRng(seed), 15), { dealer: seed % 4, recorder: a.rec });
      const g = GameState.deal(DEFAULT_TABLE, new Wall(makeRng(seed), 15), { dealer: seed % 4, recorder: b.rec });
      const r2 = g.run(mk(seed, seed));
      expect(r2.winner).toBe(r1.winner); expect(r2.playerTurns).toBe(r1.playerTurns);
      expect(r2.chipsDelta).toEqual(r1.chipsDelta); expect(r2.counts).toEqual(r1.counts);
      expect(b.seen).toEqual(a.seen);
    }
  });
  it('snapshot / resume reproduces the uninterrupted game', () => {
    for (let seed = 300; seed < 340; seed++) {
      const full = GameState.deal(DEFAULT_TABLE, new Wall(makeRng(seed), 15), { dealer: seed % 4 });
      const fullRes = full.run(mk(seed, 1));
      // replay but stop after k decisions, snapshot, resume with fresh bots of same seeds... bots are stateful (rng), so rebuild bots and fast-forward them by replaying the same prefix
      const g = GameState.deal(DEFAULT_TABLE, new Wall(makeRng(seed), 15), { dealer: seed % 4 });
      const bots = mk(seed, 1);
      const k = 10 + (seed % 25);
      for (let i = 0; i < k && !g.finished; i++) g.step(bots);
      if (g.finished) continue;
      const snap = g.snapshot();
      const h = GameState.fromSnapshot(snap, DEFAULT_TABLE, { dealer: seed % 4 });
      expect(h.pending()?.kind).toBe(g.pending()?.kind);
      const res = h.run(bots);  // same bot objects (same rng state) continue
      expect(res.winner).toBe(fullRes.winner); expect(res.playerTurns).toBe(fullRes.playerTurns); expect(res.chipsDelta).toEqual(fullRes.chipsDelta);
    }
  });
  it('exposes legal actions for the pending decision', () => {
    const g = GameState.deal(DEFAULT_TABLE, new Wall(makeRng(9), 15), {});
    g.advance();
    const p = g.pending()!;
    expect(['self', 'discard']).toContain(p.kind);
    if (p.kind === 'discard') expect(p.legal.length).toBe(14);
  });
});
