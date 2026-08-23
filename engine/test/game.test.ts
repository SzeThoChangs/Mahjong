import { describe, it, expect } from 'vitest';
import { Wall, makeRng } from '../src/wall.js';
import { playGame } from '../src/game.js';
import { IsolationBot, RandomBot } from '../src/bots.js';
import { DEFAULT_TABLE } from '../src/payout.js';
import { runSim } from '../src/sim.js';

describe('game', () => {
  it('plays 300 random-bot games with invariants held', () => {
    const rng = makeRng(42);
    let wins = 0, draws = 0;
    for (let g = 0; g < 300; g++) {
      const wall = new Wall(makeRng(g + 1), 15);
      const bots = [0, 1, 2, 3].map(() => new RandomBot(rng));
      const r = playGame(bots, DEFAULT_TABLE, wall, { dealer: g % 4 });
      expect(r.chipsDelta.reduce((a, b) => a + b, 0)).toBe(0);
      // every one of the 148 tiles is with a player or still in the wall
      expect(r.tilesAccounted + wall.totalLeft).toBe(148);
      expect(r.playerTurns).toBeGreaterThan(0);
      if (r.winner === null) draws++; else { wins++; expect(r.score!.valid).toBe(true); expect(r.score!.fan).toBeGreaterThanOrEqual(r.selfDraw ? 1 : 2); }
    }
    expect(wins + draws).toBe(300);
  });
  it('isolation bots win more often than random bots', () => {
    const a = runSim(300, (rng) => [0,1,2,3].map(() => new RandomBot(rng)), DEFAULT_TABLE, 3);
    const b = runSim(300, (rng) => [0,1,2,3].map(() => new IsolationBot(rng)), DEFAULT_TABLE, 3);
    expect(b.draws).toBeLessThanOrEqual(a.draws);
  });
  it('logs a readable trace', () => {
    const wall = new Wall(makeRng(9), 15);
    const rng = makeRng(9);
    const r = playGame([0,1,2,3].map(() => new IsolationBot(rng)), DEFAULT_TABLE, wall, { log: true });
    expect(Array.isArray(r.log)).toBe(true);
  });
});
