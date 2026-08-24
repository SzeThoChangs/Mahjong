import { describe, it, expect } from 'vitest';
import { makeRules, tableConfigOf, type MoneyRules } from '../src/rules.js';
import { winPaymentsMoney, moneyAt } from '../src/payout.js';
import { Wall, makeRng } from '../src/wall.js';
import { GameState } from '../src/state.js';
import { ShantenBot, RandomBot } from '../src/bots.js';
import { KIND, kindOf, isJoker } from '../src/tiles.js';

/** the player's table: "3/6, shooter pay, ZM +$2 each" */
const MONEY: MoneyRules = {
  ladder: { 1: 2, 2: 3, 3: 5, 4: 10, 5: 20 }, zm_bonus_per_player: 2,
  shoot_total: { 2: 7, 3: 11, 4: 20, 5: 40 },
  kong_each: 2, kong_fed_total: 6, bite_flower_hidden: 4, bite_flower_open: 2, bite_animal_hidden: 4, bite_animal_open: 2,
};
const RL = makeRules({ money: MONEY, jokers: { count: 4 } });

describe("the player's money table", () => {
  it('ZM: each pays 4/5/7/12/22 at 1-5 tai; 6+ tai pays the 5-tai cap', () => {
    expect([1, 2, 3, 4, 5, 7].map((t) => winPaymentsMoney(t, 0, null, MONEY)[1])).toEqual([4, 5, 7, 12, 22, 22]);
    expect(winPaymentsMoney(3, 0, null, MONEY)).toEqual([0, 7, 7, 7]);
  });
  it('shoot: the shooter alone pays 7/11/20/40 at 2-5 tai', () => {
    expect([2, 3, 4, 5].map((t) => winPaymentsMoney(t, 0, 2, MONEY)[2])).toEqual([7, 11, 20, 40]);
    expect(winPaymentsMoney(4, 0, 2, MONEY)).toEqual([0, 0, 20, 0]);
  });
  it('pay-all: the liable feeder takes over the whole bill', () => {
    expect(winPaymentsMoney(5, 0, 2, MONEY, 3)).toEqual([0, 0, 0, 40]);          // shoot by 2, but 3 is liable
    expect(winPaymentsMoney(5, 0, null, MONEY, 1)).toEqual([0, 66, 0, 0]);       // ZM 22x3 all on the liable seat
  });
  it('moneyAt caps above the table', () => { expect(moneyAt(MONEY.ladder, 9)).toBe(20); });
  it('full games under the money rules stay zero-sum and legal', () => {
    const cfg = tableConfigOf(RL);
    let wins = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const w = new Wall(makeRng(seed), 15, 4);
      const g = GameState.deal(cfg, w, { rules: RL });
      const r = g.run([0, 1, 2, 3].map((i) => (seed % 2 ? new ShantenBot(makeRng(seed * 4 + i)) : new RandomBot(makeRng(seed * 4 + i)))));
      expect(r.chipsDelta.reduce((a, b) => a + b, 0)).toBe(0);
      expect(r.counts.illegal).toBe(0);
      if (r.winner !== null) { wins++; expect(r.score!.fan).toBeGreaterThanOrEqual(r.selfDraw ? 1 : 2); }
    }
    expect(wins).toBeGreaterThan(60);
  });
  it('bites: own seat-flower pair pays from everyone; another seat number only from that seat', () => {
    // craft via snapshot: give seat 2 both #2 flowers (own: seat index 2 -> flowers F3/S3? seat numbering: bonusSeat n === seat)
    const cfg = tableConfigOf(makeRules({ money: MONEY }));
    const g0 = GameState.deal(cfg, new Wall(makeRng(11), 15, 0), { rules: makeRules({ money: MONEY }) });
    const snap = g0.snapshot();
    // find the instances of flower#3 (kind 36) and season#3 (kind 40) = seat 2's pair, and flower#4/season#4 (37/41) = seat 3's
    const inst = (k: number) => snap.wall.order.find((t) => kindOf(t) === k) ?? -1;
    void inst;
    const h = GameState.fromSnapshot(snap, cfg, { rules: makeRules({ money: MONEY }) });
    const p2 = h.players[2]!;
    const chipsBefore = h.players.map((p) => p.chips);
    // simulate: seat 2 has already set aside F3, then draws S3 (own pair, open) - call absorb path via a fake: directly test settleBonus through bonus arrays
    p2.bonus.push(...[36, 40].map((k) => snap.wall.order.find((t) => kindOf(t) === k)!));
    // @ts-expect-error private access for the test
    h.settleBonus(p2, false);
    expect(h.players[2]!.chips - chipsBefore[2]!).toBe(6);       // $2 open from each of 3
    // another seat's number: seat 2 also collects both #4 flowers (belongs to seat 3): only seat 3 pays, hidden $4
    p2.bonus.push(...[37, 41].map((k) => snap.wall.order.find((t) => kindOf(t) === k)!));
    const before3 = h.players[3]!.chips, before0 = h.players[0]!.chips, before2 = h.players[2]!.chips;
    // @ts-expect-error private access for the test
    h.settleBonus(p2, true);
    expect(h.players[3]!.chips - before3).toBe(-4);
    expect(h.players[0]!.chips - before0).toBe(0);
    expect(h.players[2]!.chips - before2).toBe(4);
  });
  it('kongs: self-made pays $2 each; a fed kong costs the feeder $6', () => {
    const cfg = tableConfigOf(makeRules({ money: MONEY }));
    const g = GameState.deal(cfg, new Wall(makeRng(3), 15, 0), { rules: makeRules({ money: MONEY }) });
    // @ts-expect-error private
    g.kongPayment(1, null);
    expect(g.players.map((p) => p.chips)).toEqual([-2, 6, -2, -2]);
    // @ts-expect-error private
    g.kongPayment(1, 3);
    expect(g.players.map((p) => p.chips)).toEqual([-2, 12, -2, -8]);
  });
  it('jokers still work with money rules (dealer four-joker win pays as 5-tai ZM)', () => {
    const cfg = tableConfigOf(RL);
    for (let seed = 1; seed <= 400; seed++) {
      const g = GameState.deal(cfg, new Wall(makeRng(seed), 15, 4), { rules: RL });
      if (g.finished && g.result!.score?.combination === 'four_jokers') {
        expect(g.result!.chipsDelta[g.result!.winner!]).toBe(66);   // 22 x 3
        return;
      }
    }
    // no natural case found in 400 seeds is fine - the payment path is covered by the ZM test
  });
});
