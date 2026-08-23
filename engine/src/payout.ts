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

/** Immediate payouts (each opponent pays this to the declarer). Source values assume MF1; multiplier handles MF2. */
export function immediatePayout(kind: 'kong_1' | 'kong_3' | 'kong_4' | 'animal_set' | 'flower_set' | 'animal_pair' | 'flower_pair', cfg: TableConfig, fromInitialHand = false, rules: RulesConfig = DEFAULT_RULES): number {
  const base = rules.kong_scoring[kind];
  return base * cfg.immediate_payouts_multiplier * (fromInitialHand && rules.kong_scoring.initial_hand_double ? 2 : 1);
}
