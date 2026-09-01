import { describe, it, expect } from 'vitest';
import { parseKinds, countsOf, KIND, kindOf, isJoker, TOTAL_TILES_WITH_JOKERS } from '../src/tiles.js';
import { jokerCompletions, thirteenWithJokers } from '../src/decompose.js';
import { shanten, couldBeComplete } from '../src/shanten.js';
import { scoreHand } from '../src/score.js';
import { makeRules, tableConfigOf } from '../src/rules.js';
import { winPaymentsMoney } from '../src/payout.js';
import { fanInHand, visibleTai } from '../src/score.js';
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

describe('wildcard 天和 only on a four-wildcard table', () => {
  /** the same completed hand holding all four wildcards, scored at different table counts */
  const fourJokerWin = (count: number) =>
    scoreHand({ ...base, concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s 5w J J J J'), winningTile: 46 },
      makeRules({ jokers: { count } }));

  it('awards it at four - there, holding four IS holding every one in the game', () => {
    const r = fourJokerWin(4);
    expect(r.valid).toBe(true);
    expect(r.fan).toBe(5);
    expect(r.combination).toBe('tian_hu');
  });

  it('withdraws it past four, where holding four is ordinary', () => {
    for (const n of [8, 12, 16]) {
      const r = fourJokerWin(n);
      expect(r.valid).toBe(true);
      expect(r.combination).not.toBe('tian_hu');
      expect(r.fan).toBeLessThan(5);
    }
  });

  it('leaves the REAL 天和 alone - dealer winning on the opening hand is still a limit hand', () => {
    const r = scoreHand({ ...base, concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s 2s 3s 4s 5w 5w'), winningTile: 4,
      isDealer: true, firstDraw: true }, makeRules({ jokers: { count: 12 } }));
    expect(r.combination).toBe('tian_hu');
    expect(r.fan).toBe(5);
  });
});

/**
 * A call you cannot discard out of. Both positions below are real - lifted from run-money3, where
 * the engine offered the call, the player took it, and the only way to continue was to throw a
 * wildcard the table forbids.
 *
 * Only the FOURTH meld can do this. Three melds down leaves four concealed tiles and a call
 * consumes two, so stranding needs two wildcards; two melds down leaves seven and would need five.
 * The table has four.
 */
describe('jokers: a call that leaves nothing legal to throw is not offered', () => {
  const cfg = tableConfigOf(JR);
  const inst = (kind: number, copy = 0) => kind * 4 + copy;      // standard tiles are 4 instances each, in kind order
  const JOKERS = [148, 149, 150, 151];

  /** Seat 1 holds `hand`, has three melds down, and seat 0 throws `thrown`. What may seat 1 do? */
  const offer = (hand: number[], thrown: number) => {
    const g = GameState.deal(cfg, new Wall(makeRng(11), 15, 4), { rules: JR, dealer: 0 });
    const snap = g.snapshot();
    const used = new Set([...hand, thrown]);
    for (const p of snap.players) p.hand = p.hand.filter((t) => !used.has(t));
    const order = snap.wall.order.filter((t) => !used.has(t));
    snap.wall = { ...snap.wall, order, back: snap.wall.back - (snap.wall.order.length - order.length) };
    // three melds that carry no tai, so nothing here can be a legal win at the 2-tai minimum
    snap.players[1]!.melds = [[0, 1, 2], [9, 10, 11], [18, 19, 20]].map((ks) => ({
      type: 'chow' as const, tiles: ks, concealed: false, instances: ks.map((k) => inst(k, 1)),
    }));
    snap.players[1]!.hand = hand;
    snap.phase = 'claim'; snap.turn = 0;
    snap.pendingDiscard = { tile: thrown, from: 0, lastTileDiscard: false, eligible: [1, 2, 3] };
    const h = GameState.fromSnapshot(snap, cfg, { rules: JR, dealer: 0 });
    h.rebuildClaims(1);
    const p = h.pending();
    return p && p.seat === 1 ? p.legal.map((a) => a.a) : [];
  };

  // With the call refused and no legal win, the seat has nothing to claim, so it is not asked at
  // all - the engine only queues a seat that has options. An empty list IS the refusal.
  it('no fourth pong when the two tiles left behind are both wildcards', () => {
    // g720 h11 seat 1: held [WILD 7 WILD 7], somebody threw a 7, engine offered pong -> [WILD WILD]
    expect(offer([JOKERS[0]!, inst(7, 0), JOKERS[1]!, inst(7, 1)], inst(7, 2))).toEqual([]);
  });

  it('no fourth chow when the two tiles left behind are both wildcards', () => {
    // g608 h9 seat 3: held [21 20 WILD WILD], the seat above threw 19, engine offered chow 19-20-21
    expect(offer([inst(21, 0), inst(20, 0), JOKERS[0]!, JOKERS[1]!], inst(19, 0))).toEqual([]);
  });

  it('but the call is still offered when a real tile survives it', () => {
    // same shape, one wildcard instead of two: after the chow the hand is [5 WILD] and 5 is throwable
    const legal = offer([inst(21, 0), inst(20, 0), inst(4, 0), JOKERS[0]!], inst(19, 0));
    expect(legal).toContain('chow');
  });

  it('and a table that allows throwing wildcards keeps the call', () => {
    const permissive = makeRules({ jokers: { count: 4, discardable: true } });
    const g = GameState.deal(tableConfigOf(permissive), new Wall(makeRng(11), 15, 4), { rules: permissive, dealer: 0 });
    const snap = g.snapshot();
    const hand = [JOKERS[0]!, inst(7, 0), JOKERS[1]!, inst(7, 1)], thrown = inst(7, 2);
    const used = new Set([...hand, thrown]);
    for (const p of snap.players) p.hand = p.hand.filter((t) => !used.has(t));
    const order = snap.wall.order.filter((t) => !used.has(t));
    snap.wall = { ...snap.wall, order, back: snap.wall.back - (snap.wall.order.length - order.length) };
    snap.players[1]!.melds = [[0, 1, 2], [9, 10, 11], [18, 19, 20]].map((ks) => ({
      type: 'chow' as const, tiles: ks, concealed: false, instances: ks.map((k) => inst(k, 1)),
    }));
    snap.players[1]!.hand = hand;
    snap.phase = 'claim'; snap.turn = 0;
    snap.pendingDiscard = { tile: thrown, from: 0, lastTileDiscard: false, eligible: [1, 2, 3] };
    const h = GameState.fromSnapshot(snap, tableConfigOf(permissive), { rules: permissive, dealer: 0 });
    h.rebuildClaims(1);
    expect(h.pending()!.legal.map((a) => a.a)).toContain('pong');
  });
});

/**
 * Stranded: four melds down, nothing but wildcards in hand. Cannot win - two wildcards behind four
 * melds is a complete hand but scores 0 tai, under the 2-tai minimum - and cannot throw, because a
 * wildcard is not a legal discard. The player kena bao and pays every other player the maximum.
 */
describe('jokers: stranded on wildcards is bao, not a wildcard discard', () => {
  const BAO = 42;
  const baoRules = makeRules({ jokers: { count: 4, stranded_bao_each: BAO } });
  const inst = (kind: number, copy = 0) => kind * 4 + copy;

  /** Seat 1, four melds down, holding exactly `hand`, owing the table a discard. */
  const strand = (hand: number[], rules = baoRules) => {
    const cfg = tableConfigOf(rules);
    const g = GameState.deal(cfg, new Wall(makeRng(3), 15, 4), { rules, dealer: 0 });
    const snap = g.snapshot();
    const meldKinds = [[0, 1, 2], [9, 10, 11], [18, 19, 20], [27, 27, 27]];
    const meldInst = meldKinds.map((ks, i) => ks.map((k) => inst(k, i === 3 ? ks.indexOf(k) : 1)));
    const used = new Set([...hand, ...meldInst.flat()]);
    for (const p of snap.players) { p.hand = p.hand.filter((t) => !used.has(t)); p.chips = 0; }
    const order = snap.wall.order.filter((t) => !used.has(t));
    snap.wall = { ...snap.wall, order, back: snap.wall.back - (snap.wall.order.length - order.length) };
    snap.players[1]!.melds = meldKinds.map((ks, i) => ({
      type: (i === 3 ? 'pong' : 'chow') as 'pong' | 'chow', tiles: ks, concealed: false, instances: meldInst[i]!,
    }));
    snap.players[1]!.hand = hand;
    snap.phase = 'discard'; snap.turn = 1;
    const h = GameState.fromSnapshot(snap, cfg, { rules, dealer: 0 });
    h.advance();
    return h;
  };

  it('the hand ends, nobody wins, and the stranded seat pays every opponent the maximum', () => {
    const h = strand([148, 149]);
    expect(h.finished).toBe(true);
    expect(h.result!.winner).toBeNull();
    expect(h.result!.chipsDelta[1]).toBe(-3 * BAO);
    for (const s of [0, 2, 3]) expect(h.result!.chipsDelta[s]).toBe(BAO);
    expect(h.result!.chipsDelta.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('a table with no such rule just ends the hand, and still never throws a wildcard', () => {
    const h = strand([148, 149], makeRules({ jokers: { count: 4 } }));   // stranded_bao_each defaults to null
    expect(h.finished).toBe(true);
    expect(h.result!.winner).toBeNull();
    expect(h.result!.chipsDelta).toEqual([0, 0, 0, 0]);
  });

  it('one real tile alongside the wildcard is not stranded - it is an ordinary discard', () => {
    const h = strand([148, inst(5, 0)]);
    expect(h.finished).toBe(false);
    const p = h.pending()!;
    expect(p.kind).toBe('discard'); expect(p.seat).toBe(1);
    expect(p.legal.map((a) => (a.a === 'discard' ? a.kind : null))).toEqual([5]);   // the wildcard is not on the list
  });
});

/**
 * 包 colour fed: three melds of one suit are down, you throw that suit, they claim it. From that
 * moment you carry the whole bill - including if they go on to self-draw, which is the case the
 * old rule missed because it only ever looked at the winning discard.
 */
describe('bao: feeding the fourth meld of a colour hand', () => {
  const MONEY = { ladder: { 1: 2, 2: 3, 3: 5, 4: 10, 5: 20 }, zm_bonus_per_player: 2, shoot_total: { 2: 7, 3: 11, 4: 20, 5: 40 }, kong_fed_total: 6, bite_flower_hidden: 4, bite_flower_open: 2, bite_animal_hidden: 4, bite_animal_open: 2, kong_concealed_each: 2, kong_exposed_each: 2 };
  const rules = makeRules({ money: MONEY, jokers: { count: 4 }, bao: { enabled: true }, discard_win_payment: 'discarder_pays_all' });
  const inst = (kind: number, copy = 0) => kind * 4 + copy;

  /** Seat 1 already has `melds` down; seat 0 throws `thrown` and seat 1 claims it. */
  const feed = (meldKinds: number[][], hand: number[], thrown: number, alreadyLiable: number | null = null) => {
    const cfg = tableConfigOf(rules);
    const g = GameState.deal(cfg, new Wall(makeRng(5), 15, 4), { rules, dealer: 0 });
    const snap = g.snapshot();
    const meldInst = meldKinds.map((ks, i) => ks.map((k, j) => inst(k, meldKinds.slice(0, i).flat().filter((x) => x === k).length + ks.slice(0, j).filter((x) => x === k).length)));
    const used = new Set([...hand, thrown, ...meldInst.flat()]);
    for (const p of snap.players) { p.hand = p.hand.filter((t) => !used.has(t)); p.chips = 0; }
    const order = snap.wall.order.filter((t) => !used.has(t));
    snap.wall = { ...snap.wall, order, back: snap.wall.back - (snap.wall.order.length - order.length) };
    snap.players[1]!.melds = meldKinds.map((ks, i) => ({
      type: (ks[0] === ks[1] ? 'pong' : 'chow') as 'pong' | 'chow', tiles: ks, concealed: false, instances: meldInst[i]!,
    }));
    snap.players[1]!.hand = hand;
    snap.phase = 'claim'; snap.turn = 0;
    snap.pendingDiscard = { tile: thrown, from: 0, lastTileDiscard: false, eligible: [1, 2, 3] };
    // the claim resolver writes the outcome back onto the discard it came from, so it has to exist
    snap.players[0]!.discards = [...snap.players[0]!.discards, thrown];
    snap.discardLog = [...snap.discardLog, { seat: 0, tile: thrown, claimedBy: null, claimKind: null, turn: snap.playerTurns }];
    snap.liable = [null, alreadyLiable, null, null];
    const h = GameState.fromSnapshot(snap, cfg, { rules, dealer: 0 });
    h.rebuildClaims(1);
    const p = h.pending()!;
    const pong = p.legal.find((a) => a.a === 'pong');
    h.apply(pong ?? p.legal.find((a) => a.a === 'chow')!);
    return h;
  };

  const TWO_SUITED = [[0, 1, 2], [3, 4, 5]];                 // two chows, both in the first suit
  const TWO_TERMINAL = [[0, 0, 0], [8, 8, 8]];               // two pongs, 1 and 9 of the first suit

  it('the THIRD meld of a colour is the bao, not the fourth', () => {
    const h = feed(TWO_SUITED, [inst(6, 1), inst(6, 2), inst(20, 0)], inst(6, 3));
    expect(h.snapshot().liable[1]).toBe(0);
  });

  it('the second is not - two of a colour is a plan, not a hand', () => {
    const h = feed([[0, 1, 2]], [inst(6, 1), inst(6, 2), inst(20, 0)], inst(6, 3));
    expect(h.snapshot().liable[1]).toBeNull();
  });

  it('a third meld in a DIFFERENT suit carries no liability', () => {
    const h = feed(TWO_SUITED, [inst(13, 1), inst(13, 2), inst(20, 0)], inst(13, 3));
    expect(h.snapshot().liable[1]).toBeNull();
  });

  it('the third 1/9 pong is bao', () => {
    const h = feed(TWO_TERMINAL, [inst(17, 1), inst(17, 2), inst(20, 0)], inst(17, 3));   // 9 of the second suit
    expect(h.snapshot().liable[1]).toBe(0);
  });

  it('but a plain all-pong of middle numbers is not', () => {
    const h = feed([[4, 4, 4], [5, 5, 5]], [inst(13, 1), inst(13, 2), inst(20, 0)], inst(13, 3));
    expect(h.snapshot().liable[1]).toBeNull();
  });

  it('bao transfers: feed a bao tile into a hand somebody else already fed and you take it over', () => {
    // seat 3 was already carrying it; seat 0 throws the next one of the colour and it moves to seat 0
    const h = feed([[0, 1, 2], [3, 4, 5]], [inst(6, 1), inst(6, 2), inst(20, 0)], inst(6, 3), 3);
    expect(h.snapshot().liable[1]).toBe(0);
  });

  it('what the table can SEE is not what fanInHand counts', () => {
    const pong = (k: number) => ({ type: 'pong' as const, tiles: [k, k, k], concealed: false });
    const ctx = (ks: number[]) => ({ melds: ks.map(pong), bonus: [], seat: 0, prevailingWind: 0 });
    // four terminal pongs: no dragons, no winds, so fanInHand sees nothing at all
    expect(fanInHand(ctx([0, 8, 9, 17]))).toBe(0);
    expect(visibleTai(ctx([0, 8, 9, 17]), rules)).toBe(2);          // ...but it is 混老頭 on the table
    // two dragon pongs plus two terminals: 2 tai of dragons, and ONE shape bonus on top, never both.
    // The finished hand scores 6 (all-pong 2 + 混老頭 2 + two dragons); reading 4 off the table is
    // the conservative side of that, which is the side a liability rule should sit on.
    expect(fanInHand(ctx([31, 32, 0, 8]))).toBe(2);
    expect(visibleTai(ctx([31, 32, 0, 8]), rules)).toBe(4);
    // under three melds nothing is settled yet
    expect(visibleTai(ctx([0, 8]), rules)).toBe(0);
  });

  it('the liable seat pays $40 when they win on a discard and $66 when they self-draw', () => {
    expect(winPaymentsMoney(5, 1, 0, MONEY, 0, rules)).toEqual([40, 0, 0, 0]);        // shot by the liable seat
    expect(winPaymentsMoney(5, 1, 2, MONEY, 0, rules)).toEqual([40, 0, 0, 0]);        // shot by someone else - the liable seat still pays
    expect(winPaymentsMoney(5, 1, null, MONEY, 0, rules)).toEqual([66, 0, 0, 0]);     // self-drawn: 22 x 3, all of it on the liable seat
    expect(winPaymentsMoney(5, 1, null, MONEY, null, rules)).toEqual([22, 0, 22, 22]);  // ...and 22 each with nobody liable
  });
});

/** "Take it or win on it" - winning on a bao tile moves the liability to whoever threw it. */
describe('bao: winning on a bao tile transfers it to the shooter', () => {
  const MONEY = { ladder: { 1: 2, 2: 3, 3: 5, 4: 10, 5: 20 }, zm_bonus_per_player: 2, shoot_total: { 2: 7, 3: 11, 4: 20, 5: 40 }, kong_fed_total: 6, bite_flower_hidden: 4, bite_flower_open: 2, bite_animal_hidden: 4, bite_animal_open: 2, kong_concealed_each: 2, kong_exposed_each: 2 };
  const rules = makeRules({ money: MONEY, jokers: { count: 4 }, bao: { enabled: true }, discard_win_payment: 'discarder_pays_all' });
  const inst = (kind: number, copy = 0) => kind * 4 + copy;

  /**
   * Seat 1 shows three melds all in the first suit and wins on 3w thrown by `from`; seat 3 was
   * already carrying the bao. One meld is a pong on purpose: an all-chow hand may not win on a
   * discard off a single wait (`score.ts` rules that out), and this hand waits only on 3w.
   */
  const winOn = (from: number) => {
    const cfg = tableConfigOf(rules);
    const g = GameState.deal(cfg, new Wall(makeRng(9), 15, 4), { rules, dealer: 0 });
    const snap = g.snapshot();
    const meldKinds = [[0, 1, 2], [3, 4, 5], [8, 8, 8]];
    const meldInst = [[inst(0, 0), inst(1, 0), inst(2, 0)], [inst(3, 0), inst(4, 0), inst(5, 0)], [inst(8, 0), inst(8, 1), inst(8, 2)]];
    const hand = [inst(0, 1), inst(1, 1), inst(4, 1), inst(4, 2)];   // 1w 2w 5w 5w - wins on 3w
    const thrown = inst(2, 1);
    const used = new Set([...hand, thrown, ...meldInst.flat()]);
    for (const p of snap.players) { p.hand = p.hand.filter((t) => !used.has(t)); p.chips = 0; }
    const order = snap.wall.order.filter((t) => !used.has(t));
    snap.wall = { ...snap.wall, order, back: snap.wall.back - (snap.wall.order.length - order.length) };
    snap.players[1]!.melds = meldKinds.map((ks, i) => ({ type: (ks[0] === ks[1] ? 'pong' : 'chow') as 'pong' | 'chow', tiles: ks, concealed: false, instances: meldInst[i]! }));
    snap.players[1]!.hand = hand;
    snap.players[from]!.discards = [...snap.players[from]!.discards, thrown];
    snap.discardLog = [...snap.discardLog, { seat: from, tile: thrown, claimedBy: null, claimKind: null, turn: snap.playerTurns }];
    snap.phase = 'claim'; snap.turn = from;
    snap.pendingDiscard = { tile: thrown, from, lastTileDiscard: false, eligible: [0, 1, 2, 3].filter((s) => s !== from) };
    snap.liable = [null, 3, null, null];        // seat 3 fed the colour earlier and was carrying it
    const h = GameState.fromSnapshot(snap, cfg, { rules, dealer: 0 });
    h.rebuildClaims(1);
    const p = h.pending()!;
    h.apply(p.legal.find((a) => a.a === 'win')!);
    return h.result!;
  };

  it('the shooter takes the bao off the player who fed the hand', () => {
    const r = winOn(2);
    expect(r.winner).toBe(1);
    expect(r.liable).toBe(2);              // not seat 3, who was carrying it before
    expect(r.chipsDelta[2]).toBe(-40);     // and pays the whole bill
    expect(r.chipsDelta[3]).toBe(0);       // the old feeder walks away
  });

  it('and if the original feeder is the one who shoots it, it simply stays with them', () => {
    const r = winOn(3);
    expect(r.liable).toBe(3);
    expect(r.chipsDelta[3]).toBe(-40);
  });
});

/** 杠上开花 off a kong you fed: they kong your discard, draw the replacement, win on it - you carry it. */
describe('bao: feeding a kong that wins on the replacement', () => {
  const MONEY = { ladder: { 1: 2, 2: 3, 3: 5, 4: 10, 5: 20 }, zm_bonus_per_player: 2, shoot_total: { 2: 7, 3: 11, 4: 20, 5: 40 }, kong_fed_total: 6, bite_flower_hidden: 4, bite_flower_open: 2, bite_animal_hidden: 4, bite_animal_open: 2, kong_concealed_each: 2, kong_exposed_each: 2 };
  const rules = makeRules({ money: MONEY, jokers: { count: 4 }, bao: { enabled: true }, discard_win_payment: 'discarder_pays_all' });
  const inst = (kind: number, copy = 0) => kind * 4 + copy;

  /** Seat 1 has four melds all in one suit, one tile in hand, and the replacement pairs it. */
  const replacementWin = (kongFedBy: number | null) => {
    const cfg = tableConfigOf(rules);
    const g = GameState.deal(cfg, new Wall(makeRng(13), 15, 4), { rules, dealer: 0 });
    const snap = g.snapshot();
    const melds = [
      { type: 'chow' as const, tiles: [0, 1, 2], instances: [inst(0, 0), inst(1, 0), inst(2, 0)] },
      { type: 'chow' as const, tiles: [3, 4, 5], instances: [inst(3, 0), inst(4, 0), inst(5, 0)] },
      { type: 'pong' as const, tiles: [8, 8, 8], instances: [inst(8, 0), inst(8, 1), inst(8, 2)] },
      { type: 'kong' as const, tiles: [6, 6, 6, 6], instances: [inst(6, 0), inst(6, 1), inst(6, 2), inst(6, 3)] },
    ];
    const hand = [inst(4, 1)], replacement = inst(4, 2);     // 5w in hand, 5w off the back of the wall
    const used = new Set([...hand, replacement, ...melds.flatMap((m) => m.instances)]);
    for (const p of snap.players) { p.hand = p.hand.filter((t) => !used.has(t)); p.chips = 0; }
    const order = snap.wall.order.filter((t) => !used.has(t));
    order.push(replacement);                                  // the back of the wall is drawn first for a replacement
    snap.wall = { ...snap.wall, order, back: order.length - 1 };
    snap.players[1]!.melds = melds.map((m) => ({ ...m, concealed: false }));
    snap.players[1]!.hand = hand;
    snap.phase = 'replacement'; snap.turn = 1;
    snap.kongFedBy = [null, kongFedBy, null, null];
    const h = GameState.fromSnapshot(snap, cfg, { rules, dealer: 0 });
    h.advance();
    const p = h.pending()!;
    h.apply(p.legal.find((a) => a.a === 'win')!);
    return h.result!;
  };

  it('the seat that fed the kong pays for everyone', () => {
    const r = replacementWin(0);
    expect(r.winner).toBe(1);
    expect(r.selfDraw).toBe(true);
    expect(r.score!.items.map((i) => i.id)).toContain('replacement_win');
    expect(r.liable).toBe(0);
    expect(r.chipsDelta[0]).toBe(-66);        // 22 x 3, all of it on the feeder
    expect(r.chipsDelta[2]).toBe(0);
    expect(r.chipsDelta[3]).toBe(0);
  });

  it('a kong nobody fed is an ordinary self-draw - everyone pays their share', () => {
    const r = replacementWin(null);
    expect(r.liable).toBeNull();
    for (const s of [0, 2, 3]) expect(r.chipsDelta[s]).toBe(-22);
  });
});
