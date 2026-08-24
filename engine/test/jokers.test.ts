import { describe, it, expect } from 'vitest';
import { parseKinds, countsOf, KIND, kindOf, isJoker, TOTAL_TILES_WITH_JOKERS } from '../src/tiles.js';
import { jokerCompletions, thirteenWithJokers } from '../src/decompose.js';
import { shanten, couldBeComplete } from '../src/shanten.js';
import { scoreHand } from '../src/score.js';
import { makeRules, tableConfigOf } from '../src/rules.js';
import { Wall, makeRng } from '../src/wall.js';
import { GameState } from '../src/state.js';
import { ShantenBot, RandomBot } from '../src/bots.js';

const K = parseKinds;
const JR = makeRules({ jokers: { count: 4 } });
const base = { melds: [] as import('../src/score.js').Meld[], bonus: [] as number[], seat: 1, prevailingWind: 2, selfDraw: true };

describe('jokers: completion', () => {
  it('a joker completes a chow, a pong, or an eye', () => {
    expect(jokerCompletions(countsOf(K('1w 2w 4t 5t 6t 7s 8s 9s E E E R R')), 1, 4).length).toBeGreaterThan(0);   // J = 3w
    expect(jokerCompletions(countsOf(K('5w 5w 4t 5t 6t 7s 8s 9s E E E R R')), 1, 4).length).toBeGreaterThan(0);   // J = 5w (pong)
    expect(jokerCompletions(countsOf(K('1w 2w 3w 4t 5t 6t 7s 8s 9s E E E R')), 1, 4).length).toBeGreaterThan(0);   // J = R (eye)
    expect(jokerCompletions(countsOf(K('1w 2w 3w 4t 5t 6t 7s 8s 9s E E E R')), 0, 4).length).toBe(0);
  });
  it('two jokers can be a whole eye, three a whole set', () => {
    expect(jokerCompletions(countsOf(K('1w 2w 3w 4t 5t 6t 7s 8s 9s E E E')), 2, 4).some((c) => c.freeEye)).toBe(true);
    expect(jokerCompletions(countsOf(K('1w 2w 3w 4t 5t 6t 7s 8s 9s R R')), 3, 4).some((c) => c.freeSets === 1)).toBe(true);
  });
  it('shanten and the completeness precheck count jokers', () => {
    expect(shanten(K('1w 2w J 4t 5t 6t 7s 8s 9s E E E R R'), 0)).toBe(-1);
    expect(shanten(K('1w 2w J 4t 5t 6t 7s 8s 9s E E E R'), 0)).toBe(0);
    expect(couldBeComplete(countsOf(K('1w 2w 4t 5t 6t 7s 8s 9s E E E R R')), 0, 1)).toBe(true);
    expect(couldBeComplete(countsOf(K('1w 2w 4t 5t 6t 7s 8s 9s E E E R R')), 0, 0)).toBe(false);
  });
  it('13 Wonders with jokers', () => {
    expect(thirteenWithJokers(countsOf(K('1w 9w 1t 9t 1s 9s E S W N R G Wh')), 1)).toEqual([0]);        // free pair -> 1-wan
    expect(thirteenWithJokers(countsOf(K('1w 9w 1t 9t 1s 9s E S W N R G 1w')), 1)).toEqual([33]);       // joker = Wh
  });
});

describe('jokers: scoring', () => {
  it('scores as the substituted tiles (平胡 through a joker)', () => {
    const r = scoreHand({ ...base, concealed: K('1w 2w J 4t 5t 6t 7s 8s 9s 2s 3s 4s 5w 5w'), winningTile: 4 }, JR);
    expect(r.valid).toBe(true); expect(r.combination).toBe('ping_hu'); expect(r.items.map((i) => i.id)).toContain('jokers_used');
  });
  it('picks the best assignment (joker as a dragon to make the pong)', () => {
    const r = scoreHand({ ...base, concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s R R J 5w 5w'), winningTile: 31 }, JR);
    expect(r.valid).toBe(true); expect(r.items.map((i) => i.id)).toContain('dragon_pong');
  });
  it('all four jokers in a complete hand is worth the table value (5)', () => {
    const r = scoreHand({ ...base, concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s 5w J J J J'), winningTile: 46 }, JR);
    expect(r.valid).toBe(true); expect(r.fan).toBe(5); expect(r.items.map((i) => i.id)).toContain('tian_hu');
  });
  it('all-joker groups take no honour value', () => {
    const r = scoreHand({ ...base, concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s 2s 3s 4s J J'), winningTile: 46 }, JR);   // JJ = eye
    expect(r.valid).toBe(true);
    expect(r.items.some((i) => i.id === 'dragon_pong' || i.id === 'seat_wind' || i.id === 'prevailing_wind')).toBe(false);
  });
});

describe('jokers: play', () => {
  const cfg = tableConfigOf(JR);
  it('the wall has 152 tiles and games conserve them', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = new Wall(makeRng(seed), 15, 4);
      expect(w.size).toBe(TOTAL_TILES_WITH_JOKERS);
      const g = GameState.deal(cfg, w, { rules: JR });
      const r = g.run([0, 1, 2, 3].map((i) => (seed % 2 ? new ShantenBot(makeRng(seed * 4 + i)) : new RandomBot(makeRng(seed * 4 + i)))));
      expect(r.tilesAccounted + w.totalLeft).toBe(TOTAL_TILES_WITH_JOKERS);
      expect(r.chipsDelta.reduce((a, b) => a + b, 0)).toBe(0);
      if (r.winner !== null) expect(r.score!.valid).toBe(true);
    }
  });
  it('a discarded joker is dead: nobody can claim it', () => {
    let claimsOnJoker = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = GameState.deal(cfg, new Wall(makeRng(seed), 15, 4), { rules: JR, recorder: { record: (d) => { if (d.kind === 'claim' && d.view.lastDiscard && isJoker(kindOf(d.view.lastDiscard.tile))) claimsOnJoker++; } } });
      g.run([0, 1, 2, 3].map((i) => new RandomBot(makeRng(seed * 4 + i))));   // random bots DO throw jokers
    }
    expect(claimsOnJoker).toBe(0);
  });
  it('the dealer wins on the spot with all four jokers; a non-dealer does not', () => {
    const mk = (dealer: number) => {
      const g = GameState.deal(cfg, new Wall(makeRng(7), 15, 4), { rules: JR, dealer });
      const snap = g.snapshot();
      // hand seat 0 all four jokers in place of its first four tiles
      const jokers = [148, 149, 150, 151];
      for (const p of snap.players) p.hand = p.hand.filter((t) => !jokers.includes(t));
      const order = snap.wall.order.filter((t) => !jokers.includes(t)); snap.wall = { ...snap.wall, order, back: snap.wall.back - (snap.wall.order.length - order.length) };
      snap.players[0]!.hand = [...jokers, ...snap.players[0]!.hand.slice(4)];
      return GameState.fromSnapshot(snap, cfg, { rules: JR, dealer });
    };
    const g0 = mk(0); g0.advance();                      // dealer = seat 0: wins on its first draw
    expect(g0.finished).toBe(true); expect(g0.result!.winner).toBe(0); expect(g0.result!.score!.combination).toBe('tian_hu');
    const g1 = mk(1); g1.step([0, 1, 2, 3].map((i) => new ShantenBot(makeRng(i)))); g1.step([0, 1, 2, 3].map((i) => new ShantenBot(makeRng(i))));
    expect(g1.result?.score?.combination).not.toBe('tian_hu');
  });
});
