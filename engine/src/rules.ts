/**
 * Configurable rules layer. Legality (decompose.ts / game.ts) and scoring
 * (score.ts / payout.ts) read from this; nothing is hardcoded in the modules.
 * House rules vary between groups - every value here is a default to confirm.
 */
export interface CombinationTai {
  all_chow: number; all_pong: number; half_color: number; half_terminal: number; ping_wu: number; full_color: number;
  dragon_set: number; concealed_all_pong: number; thirteen_wonders: number; all_terminal: number; wind_set: number; all_kong: number;
}
export interface FlowerScoring { own_flower: number; flower_set: number; season_set: number; seven_flower: number; eight_flower: number; }
export interface AnimalScoring { each: number; set: number; }
export interface HonourScoring { dragon_pong: number; prevailing_wind: number; seat_wind: number; two_dragons_eye: number; three_winds_eye: number; }
export interface EventScoring { replacement_win: number; last_tile: number; robbing_kong: number; }
export interface KongScoring {
  /** immediate payouts, per opponent, at the reference minimum tai (1) */
  kong_1: number; kong_3: number; kong_4: number; animal_set: number; flower_set: number; animal_pair: number; flower_pair: number;
  /** multiplier applied by table minimum tai: book says halve at 0, double at 2 */
  multiplier_by_minimum_tai: Record<number, number>;
  /** double again if obtained from the initial 13 tiles */
  initial_hand_double: boolean;
}
export interface BaoRules { enabled: boolean; fan_limit_feed: boolean; dragon_set_feed: boolean; wind_set_feed: boolean; fresh_tile_threshold: number | null; }
export interface DealerRules { retain_on_win: boolean; retain_on_draw: boolean; hands_per_wind: number; }
export interface SpecialHands { seven_pairs: boolean; eight_flower_instant_win: boolean; all_animals_instant_win: boolean; }
/** Real-money payout schedule (e.g. the "3/6, shooter pay, ZM +$2" table). When set, it replaces the 2^tai chip formula entirely. */
export interface MoneyRules {
  /** per-person base amount by tai (values above the highest key use the highest) */
  ladder: Record<number, number>;
  /** added per person on a self-draw (ZM) */
  zm_bonus_per_player: number;
  /** total the shooter pays on a discard win, by tai */
  shoot_total: Record<number, number>;
  /** self-made kong (drawn 4th tile or concealed): each opponent pays this */
  kong_each: number;
  /** fed kong (claimed from a discard): the feeder alone pays this */
  kong_fed_total: number;
  /** flower-pair bite completed during the opening deal replacements / during play */
  bite_flower_hidden: number; bite_flower_open: number;
  /** animal-pair bite (cat+mouse, rooster+centipede) hidden / open */
  bite_animal_hidden: number; bite_animal_open: number;
}
export interface JokerRules {
  /** number of joker (wild) tiles shuffled into the wall; 0 = the standard 148-tile game */
  count: number;
  /** the dealer wins on the spot when holding all four */
  dealer_all_four_instant_win: boolean;
  /** a completed hand holding all four jokers is worth at least this many tai */
  all_four_tai: number;
  /** may a discarded joker be claimed (pong/chow/win)? */
  claimable_when_discarded: boolean;
  /** may jokers be used inside exposed pongs / chows / kongs? */
  usable_in_exposed_melds: boolean;
}

export interface RulesConfig {
  minimum_tai: number;
  maximum_tai: number;
  self_draw_minimum_tai: number;
  unplayable_tiles: number;
  combination_tai: CombinationTai;
  flower_scoring: FlowerScoring;
  animal_scoring: AnimalScoring;
  honour_scoring: HonourScoring;
  event_scoring: EventScoring;
  kong_scoring: KongScoring;
  /** how a self-drawn win is paid */
  self_draw_payment: 'all_double' | 'all_single';
  /** how a win on a discard is paid */
  discard_win_payment: 'discarder_double' | 'discarder_pays_all' | 'all_single';
  bao: BaoRules;
  dealer_rules: DealerRules;
  special_hands: SpecialHands;
  jokers: JokerRules;
  /** null = abstract chips (2^tai); set = real-money schedule */
  money: MoneyRules | null;
}

export const DEFAULT_RULES: RulesConfig = {
  minimum_tai: 2, maximum_tai: 5, self_draw_minimum_tai: 1, unplayable_tiles: 15,
  combination_tai: { all_chow: 1, all_pong: 2, half_color: 2, half_terminal: 2, ping_wu: 4, full_color: 4, dragon_set: 7, concealed_all_pong: 7, thirteen_wonders: 8, all_terminal: 9, wind_set: 12, all_kong: 14 },
  flower_scoring: { own_flower: 1, flower_set: 1, season_set: 1, seven_flower: 10, eight_flower: 12 },
  animal_scoring: { each: 1, set: 1 },
  honour_scoring: { dragon_pong: 1, prevailing_wind: 1, seat_wind: 1, two_dragons_eye: 1, three_winds_eye: 4 },
  event_scoring: { replacement_win: 1, last_tile: 1, robbing_kong: 1 },
  kong_scoring: { kong_1: 2, kong_3: 2, kong_4: 4, animal_set: 4, flower_set: 4, animal_pair: 2, flower_pair: 2, multiplier_by_minimum_tai: { 0: 0.5, 1: 1, 2: 2 }, initial_hand_double: true },
  self_draw_payment: 'all_double',
  discard_win_payment: 'discarder_double',
  bao: { enabled: false, fan_limit_feed: true, dragon_set_feed: true, wind_set_feed: true, fresh_tile_threshold: 4 },
  dealer_rules: { retain_on_win: true, retain_on_draw: true, hands_per_wind: 4 },
  special_hands: { seven_pairs: false, eight_flower_instant_win: false, all_animals_instant_win: false },
  jokers: { count: 0, dealer_all_four_instant_win: true, all_four_tai: 5, claimable_when_discarded: false, usable_in_exposed_melds: false },
  money: null,
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export function makeRules(over: DeepPartial<RulesConfig> = {}): RulesConfig {
  const merge = <T>(base: T, o: DeepPartial<T> | undefined): T => {
    if (o === undefined) return base;
    if (typeof base !== 'object' || base === null || Array.isArray(base)) return (o as T) ?? base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) out[k] = merge((base as Record<string, unknown>)[k] as unknown, v as DeepPartial<unknown>);
    return out as T;
  };
  return merge(DEFAULT_RULES, over);
}

/** Back-compat view used by payout/game/web: the handful of knobs they needed before the full rules layer. */
export interface TableConfig {
  minimum_fan: number; fan_limit: number; self_draw_minimum_fan: number; immediate_payouts_multiplier: number; unplayable_tiles: number;
}
export function tableConfigOf(r: RulesConfig): TableConfig {
  return { minimum_fan: r.minimum_tai, fan_limit: r.maximum_tai, self_draw_minimum_fan: r.self_draw_minimum_tai,
    immediate_payouts_multiplier: r.kong_scoring.multiplier_by_minimum_tai[r.minimum_tai] ?? 1, unplayable_tiles: r.unplayable_tiles };
}
export function rulesOfTable(t: TableConfig): RulesConfig {
  return makeRules({ minimum_tai: t.minimum_fan, maximum_tai: t.fan_limit, self_draw_minimum_tai: t.self_draw_minimum_fan, unplayable_tiles: t.unplayable_tiles,
    kong_scoring: { multiplier_by_minimum_tai: { [t.minimum_fan]: t.immediate_payouts_multiplier } } });
}
