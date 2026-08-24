/** Chips: 2^min(fan, limit). Payment shape comes from the rules layer. */
import { DEFAULT_RULES, tableConfigOf, type RulesConfig, type TableConfig } from './rules.js';
export type { TableConfig } from './rules.js';
export const DEFAULT_TABLE: TableConfig = tableConfigOf(DEFAULT_RULES);

export function baseChips(fan: number, limit: number): number {
  return 2 ** Math.min(fan, limit);
}

/** Is this Fan total enough to win on this table? */
export function meetsMinimum(fan: number, selfDraw: boolean, cfg: TableConfig): boolean {
  return fan >= (selfDraw ? Math.min(cfg.minimum_fan, cfg.self_draw_minimum_fan) : cfg.minimum_fan);
}

/**
 * Payments for a win. Returns chips paid BY each seat (positive = pays).
 * `winner` receives the sum. `discarder` null on self-draw. 13 Wonders is
 * always paid as a self-draw.
 */
export function winPayments(
  fan: number, winner: number, discarder: number | null, cfg: TableConfig, opts: { thirteenWonders?: boolean; rules?: RulesConfig } = {},
): number[] {
  const rules = opts.rules ?? DEFAULT_RULES;
  const base = baseChips(fan, cfg.fan_limit);
  const asSelfDraw = discarder === null || opts.thirteenWonders;
  const pays = [0, 0, 0, 0];
  for (let s = 0; s < 4; s++) {
    if (s === winner) continue;
    if (asSelfDraw) pays[s] = rules.self_draw_payment === 'all_double' ? base * 2 : base;
    else if (rules.discard_win_payment === 'discarder_pays_all') pays[s] = s === discarder ? base * 3 : 0;
    else if (rules.discard_win_payment === 'all_single') pays[s] = base;
    else pays[s] = s === discarder ? base * 2 : base;
  }
  return pays;
}

/** Money-table lookup: values above the highest tai key use the highest (the cap). */
export function moneyAt(table: Record<number, number>, tai: number): number {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  let v = table[keys[0]!]!;
  for (const k of keys) if (tai >= k) v = table[k]!;
  return v;
}
/**
 * Real-money win payments. Returns chips paid BY each seat.
 *  - self-draw (ZM): each opponent pays ladder(tai) + zm_bonus
 *  - discard win: the shooter alone pays shoot_total(tai)
 *  - a liable (Pay-All) seat takes over the whole bill
 */
export function winPaymentsMoney(fan: number, winner: number, discarder: number | null, m: NonNullable<RulesConfig['money']>, liable: number | null = null, rules?: RulesConfig): number[] {
  const pays = [0, 0, 0, 0];
  if (discarder === null) {
    const each = moneyAt(m.ladder, fan) + m.zm_bonus_per_player;
    for (let s = 0; s < 4; s++) if (s !== winner) pays[s] = each;
    if (liable !== null && liable !== winner) { const total = each * 3; pays.fill(0); pays[liable] = total; }
  } else if (liable !== null && liable !== winner) {
    pays[liable] = moneyAt(m.shoot_total, fan);              // pay-all: the liable seat covers the whole bill
  } else {
    const mode = rules?.discard_win_payment ?? 'ladder_split';
    const b = moneyAt(m.ladder, fan);
    if (mode === 'discarder_pays_all') pays[discarder] = moneyAt(m.shoot_total, fan);
    else if (mode === 'all_single') { for (let s = 0; s < 4; s++) if (s !== winner) pays[s] = b; }
    else if (mode === 'discarder_double') { for (let s = 0; s < 4; s++) if (s !== winner) pays[s] = s === discarder ? b * 2 : b; }
    else {                                                    // ladder_split (default): discarder base(tai), others base(tai-1)
      const lower = moneyAt(m.ladder, Math.max(1, fan - 1));
      for (let s = 0; s < 4; s++) if (s !== winner) pays[s] = s === discarder ? b : lower;
    }
  }
  return pays;
}

/** Immediate payouts (each opponent pays this to the declarer). Source values assume MF1; multiplier handles MF2. */
export function immediatePayout(kind: 'kong_1' | 'kong_3' | 'kong_4' | 'animal_set' | 'flower_set' | 'animal_pair' | 'flower_pair', cfg: TableConfig, fromInitialHand = false, rules: RulesConfig = DEFAULT_RULES): number {
  const base = rules.kong_scoring[kind];
  return base * cfg.immediate_payouts_multiplier * (fromInitialHand && rules.kong_scoring.initial_hand_double ? 2 : 1);
}
