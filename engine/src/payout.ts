/** Chips: 2^min(fan, limit). Discarder pays double; on self-draw everyone pays double. */
export interface TableConfig {
  minimum_fan: number;
  fan_limit: number;
  self_draw_minimum_fan: number;
  immediate_payouts_multiplier: number;
  unplayable_tiles: number;
}
export const DEFAULT_TABLE: TableConfig = {
  minimum_fan: 2, fan_limit: 5, self_draw_minimum_fan: 1, immediate_payouts_multiplier: 2, unplayable_tiles: 15,
};

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
  fan: number, winner: number, discarder: number | null, cfg: TableConfig, opts: { thirteenWonders?: boolean } = {},
): number[] {
  const base = baseChips(fan, cfg.fan_limit);
  const asSelfDraw = discarder === null || opts.thirteenWonders;
  const pays = [0, 0, 0, 0];
  for (let s = 0; s < 4; s++) {
    if (s === winner) continue;
    pays[s] = asSelfDraw || s === discarder ? base * 2 : base;
  }
  return pays;
}

/** Immediate payouts (each opponent pays this to the declarer). Source values assume MF1; multiplier handles MF2. */
export function immediatePayout(kind: 'kong_1' | 'kong_3' | 'kong_4' | 'animal_set' | 'flower_set' | 'animal_pair' | 'flower_pair', cfg: TableConfig, fromInitialHand = false): number {
  const base = { kong_1: 2, kong_3: 2, kong_4: 4, animal_set: 4, flower_set: 4, animal_pair: 2, flower_pair: 2 }[kind];
  return base * cfg.immediate_payouts_multiplier * (fromInitialHand ? 2 : 1);
}
