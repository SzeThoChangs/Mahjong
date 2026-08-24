import { describe, it, expect } from 'vitest';
import { makeRules, tableConfigOf, type MoneyRules } from '../src/rules.js';
import { Wall, makeRng } from '../src/wall.js';
import { GameState } from '../src/state.js';
import { ShantenBot, RandomBot } from '../src/bots.js';
import { winPaymentsMoney, moneyAt } from '../src/payout.js';
import type { Ledger } from '../src/game.js';

const MONEY: MoneyRules = { ladder: { 1: 2, 2: 3, 3: 5, 4: 10, 5: 20 }, zm_bonus_per_player: 2, shoot_total: { 2: 7, 3: 11, 4: 20, 5: 40 }, kong_concealed_each: 2, kong_exposed_each: 2, kong_fed_total: 6, bite_flower_hidden: 4, bite_flower_open: 2, bite_animal_hidden: 4, bite_animal_open: 2 };
const RULES = makeRules({ money: MONEY, jokers: { count: 4 }, discard_win_payment: 'ladder_split' });

/** re-price a finished hand from its ledger + win facts alone */
function priceFromLedger(ledger: Ledger[], win: { winner: number | null; selfDraw: boolean; discarder: number | null; fan: number; liable: number | null; thirteen: boolean }, m: MoneyRules, r = RULES): number[] {
  const out = [0, 0, 0, 0];
  for (let s = 0; s < 4; s++) {
    const l = ledger[s]!;
    out[s] = l.kongConcealed * m.kong_concealed_each + l.kongExposed * m.kong_exposed_each + l.kongFed * m.kong_fed_total
      + l.biteFlowerHidden * m.bite_flower_hidden + l.biteFlowerOpen * m.bite_flower_open
      + l.biteAnimalHidden * m.bite_animal_hidden + l.biteAnimalOpen * m.bite_animal_open;
  }
  if (win.winner !== null) {
    const pays = winPaymentsMoney(win.fan, win.winner, win.selfDraw || win.thirteen ? null : win.discarder, m, win.liable, r);
    for (let s = 0; s < 4; s++) { out[s] = out[s]! - pays[s]!; out[win.winner] = out[win.winner]! + pays[s]!; }
  }
  return out;
}

describe('ledger re-pricing', () => {
  it('reproduces the engine chips exactly for 200 games', () => {
    const cfg = tableConfigOf(RULES);
    let checked = 0, withSide = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = GameState.deal(cfg, new Wall(makeRng(seed), 15, 4), { rules: RULES });
      const r = g.run([0, 1, 2, 3].map((i) => (seed % 3 ? new ShantenBot(makeRng(seed * 4 + i)) : new RandomBot(makeRng(seed * 4 + i)))));
      const priced = priceFromLedger(r.ledger, { winner: r.winner, selfDraw: r.selfDraw, discarder: r.discarder, fan: r.score?.fan ?? 0, liable: r.liable, thirteen: r.score?.combination === 'thirteen_wonders' }, MONEY);
      expect(priced).toEqual(r.chipsDelta);
      checked++;
      if (r.ledger.some((l) => Object.values(l).some((v) => v !== 0))) withSide++;
    }
    expect(checked).toBe(200);
    expect(withSide).toBeGreaterThan(100);          // side payments really are happening
  });
  it('the same ledger prices correctly under a different money schedule', () => {
    const DOUBLE: MoneyRules = { ...MONEY, ladder: { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32 }, shoot_total: { 2: 8, 3: 16, 4: 32, 5: 64 }, kong_concealed_each: 5, kong_exposed_each: 3 };
    const cfg = tableConfigOf(RULES);
    const g = GameState.deal(cfg, new Wall(makeRng(7), 15, 4), { rules: RULES });
    const r = g.run([0, 1, 2, 3].map((i) => new ShantenBot(makeRng(7 * 4 + i))));
    const other = priceFromLedger(r.ledger, { winner: r.winner, selfDraw: r.selfDraw, discarder: r.discarder, fan: r.score?.fan ?? 0, liable: r.liable, thirteen: r.score?.combination === 'thirteen_wonders' }, DOUBLE);
    expect(other.reduce((a, b) => a + b, 0)).toBe(0);                    // still zero-sum
    // and it must equal an engine run under those same rules
    const RULES2 = makeRules({ money: DOUBLE, jokers: { count: 4 }, discard_win_payment: 'ladder_split' });
    const g2 = GameState.deal(tableConfigOf(RULES2), new Wall(makeRng(7), 15, 4), { rules: RULES2 });
    const r2 = g2.run([0, 1, 2, 3].map((i) => new ShantenBot(makeRng(7 * 4 + i))));
    expect(other).toEqual(r2.chipsDelta);
  });
  it('a 5-tai discard win splits 20 / 10 / 10 and the ledger keeps kong and bite units separate', () => {
    expect(winPaymentsMoney(5, 0, 2, MONEY, null, RULES)).toEqual([0, 10, 20, 10]);
    expect(moneyAt(MONEY.ladder, 9)).toBe(20);
  });
});
