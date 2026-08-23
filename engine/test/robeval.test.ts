import { describe, it, expect } from 'vitest';
import { makeRules, tableConfigOf } from '../src/rules.js';
import { Wall, makeRng } from '../src/wall.js';
import { GameState } from '../src/state.js';
import { ShantenBot } from '../src/bots.js';

/** Find a rob-the-kong claim in play and make sure the claim phase can be rebuilt (what the evaluator's determinizer does). */
describe('rob claim rebuild', () => {
  it('rebuildClaims works on a rob-the-kong claim phase', () => {
    const rules = makeRules({ jokers: { count: 4 } }); const cfg = tableConfigOf(rules);
    let found = 0;
    for (let seed = 1; seed <= 3000 && found < 3; seed++) {
      const g = GameState.deal(cfg, new Wall(makeRng(seed), 15, 4), { rules });
      const bots = [0, 1, 2, 3].map((i) => new ShantenBot(makeRng(seed * 4 + i)));
      let guard = 0;
      while (!g.finished && guard++ < 4000) {
        g.advance(); if (g.finished) break;
        const p = g.pending();
        if (p && p.kind === 'claim' && g.pendingRob) {
          found++;
          const before = g.pending()!;
          expect(() => g.rebuildClaims(before.seat)).not.toThrow();
          const after = g.pending()!;
          expect(after.kind).toBe('claim'); expect(after.seat).toBe(before.seat);
        }
        g.step(bots);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});
