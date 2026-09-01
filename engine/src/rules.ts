import { JOKER_MAX } from './tiles.js';
/**
 * Configurable rules layer. Legality (decompose.ts / game.ts) and scoring
 * (score.ts / payout.ts) read from this; nothing is hardcoded in the modules.
 * House rules vary between groups - every value here is a default to confirm.
 */
export interface CombinationTai {
  // --- 1 fan ---
  chou_ping_hu: number;      // 臭平胡  all chows, but holding a flower or animal
  // --- 2 fan ---
  peng_peng_hu: number;      // 碰碰胡  all pongs/kongs + eye
  ban_se: number;            // 半色    one suit + honours (mixed suit)
  xiao_si_xi: number;        // 小四喜  three wind pongs + a wind pair
  hun_lao_tou: number;       // 混老头  every set a pong of terminals or honours
  qi_dui: number;            // 对对胡  seven pairs - NOT allowed by default (special_hands.seven_pairs)
  // --- 3 fan ---
  xiao_san_yuan: number;     // 小三元  two dragon pongs + a dragon pair
  // --- 4 fan ---
  ping_hu: number;           // 平胡    all chows with NO flower or animal
  qing_yi_se: number;        // 清一色  pure suit
  // --- 5 fan (the limit) ---
  tian_hu: number;           // 天和    dealer wins on the opening hand (also: four wildcards)
  di_hu: number;             // 地和    non-dealer wins on the dealer's first discard
  shi_san_yao: number;       // 十三幺  thirteen wonders
  da_si_xi: number;          // 大四喜  four wind pongs
  da_san_yuan: number;       // 大三元  three dragon pongs
  zi_yi_se: number;          // 字一色  all honours
  lv_yi_se: number;          // 绿一色  all green - off by default
  quan_yao_jiu: number;      // 全幺九/清老头  all terminals
  si_an_ke: number;          // 四暗刻/坎坎和  four concealed pongs, SELF-DRAWN only
  shi_ba_luo_han: number;    // 杠杠和/十八罗汉  four kongs
  gang_shang_gang: number;   // 杠上杠和  win on the replacement of a second consecutive kong
  qi_qiang_yi: number;       // 七抢一  holding seven flowers, rob the eighth
  hua_hu: number;            // 花和/八仙过海  all eight flowers
  jiu_lian: number;          // 九连宝灯  nine gates
}

export interface FlowerScoring { own_flower: number; flower_set: number; season_set: number; seven_flower: number; eight_flower: number; }
export interface AnimalScoring { each: number; set: number; }
/** Eyes do not pay at this table, so there is nothing here for a dragon or wind PAIR. There were
 *  two such fields, `two_dragons_eye` and `three_winds_eye`; the scorer never read either. */
export interface HonourScoring { dragon_pong: number; prevailing_wind: number; seat_wind: number; }
export interface EventScoring { replacement_win: number; last_tile: number; robbing_kong: number; }
export interface KongScoring {
  /** immediate payouts, per opponent, at the reference minimum tai (1) */
  kong_1: number; kong_3: number; kong_4: number; animal_set: number; flower_set: number; animal_pair: number; flower_pair: number;
  /** multiplier applied by table minimum tai: book says halve at 0, double at 2 */
  multiplier_by_minimum_tai: Record<number, number>;
  /** double again if obtained from the initial 13 tiles */
  initial_hand_double: boolean;
}
export interface BaoRules {
  enabled: boolean;
  fan_limit_feed: boolean;
  dragon_set_feed: boolean;
  wind_set_feed: boolean;
  /** feeding the THIRD meld to a player whose melds are all one suit. Two of a colour is a plan;
   *  three is a hand, and the table holds whoever handed over the third. Liability attaches at the
   *  feed, so it survives a self-draw - which is the whole point of it. */
  colour_set_feed: boolean;
  /** feeding the THIRD pong to a player whose melds are all pongs of honours, dragons and 1s/9s
   *  (混老頭). A plain all-pong of middle numbers does NOT count - only this shape. */
  terminal_set_feed: boolean;
  /** they kong YOUR discard, draw the replacement, and win on it (杠上开花). You handed them the
   *  draw, so you carry the hand. Unlike the set-feed rules this does not persist: once they
   *  discard, the replacement is spent and so is the liability. */
  kong_feed: boolean;
  fresh_tile_threshold: number | null;
}
export interface DealerRules {
  retain_on_win: boolean;
  retain_on_draw: boolean;
  /** On a DRAWN hand the dealer normally keeps the deal - but a kong anywhere in that hand passes it
   *  on anyway. Any seat's kong counts, not just the dealer's. */
  kong_passes_draw: boolean;
  hands_per_wind: number;
}
export interface SpecialHands {
  /** 对对胡 seven pairs - most houses do NOT allow it */
  seven_pairs: boolean;
  /** 绿一色 all green - off at most tables */
  all_green: boolean;
  /** 门清 fully concealed AND self-drawn scores an extra fan - some houses */
  men_qing: boolean;
  men_qing_tai: number;
  eight_flower_instant_win: boolean;
  all_animals_instant_win: boolean;
}
/** Real-money payout schedule (e.g. the "3/6, shooter pay, ZM +$2" table). When set, it replaces the 2^tai chip formula entirely. */
export interface MoneyRules {
  /** per-person base amount by tai (values above the highest key use the highest) */
  ladder: Record<number, number>;
  /** added per person on a self-draw (ZM) */
  zm_bonus_per_player: number;
  /** total the shooter pays on a discard win, by tai */
  shoot_total: Record<number, number>;
  /** 暗槓 concealed kong (all four from hand): each opponent pays this */
  kong_concealed_each: number;
  /** 明槓 exposed kong (drawn 4th added to your own pong): each opponent pays this */
  kong_exposed_each: number;
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
  /** may a joker be THROWN at all? Most Singapore tables say no - it is too valuable to give up,
   *  so it simply is not a legal discard. When false the engine removes jokers from the legal
   *  discard list rather than trusting a bot not to pick one. */
  discardable: boolean;
  /** may a discarded joker be claimed (pong/chow/win)? Moot when `discardable` is false. */
  claimable_when_discarded: boolean;
  /** may jokers be used inside exposed pongs / chows / kongs? */
  usable_in_exposed_melds: boolean;
  /**
   * What each opponent collects when a player is STRANDED: they owe the table a discard and every
   * tile they hold is a wildcard, which they may not throw. The player kena bao - bears it - and
   * pays this to each of the other three; the hand ends with no winner.
   *
   * Only reachable with four melds down, and only by drawing into it: a hand of two wildcards
   * behind four melds is complete but usually worth 0 tai, so it can be neither declared nor
   * discarded from. null means the table has no such rule and the hand simply ends as a draw.
   * Never let this be "throw the wildcard" - that is not a legal tile at a table where
   * `discardable` is false, whatever the position.
   */
  stranded_bao_each: number | null;
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
  /**
   * How a win on a discard is split.
   *  'discarder_pays_all'- SHOOTER PAYS: the discarder alone pays the whole amount (5 tai = $40)
   *  'ladder_split'      - EVERYONE PAYS: discarder base(tai), each other base(tai-1)  (5 tai = 20 + 10 + 10)
   *  'discarder_double'  - discarder pays 2 x base, the other two pay base each
   *  'all_single'        - all three pay base
   */
  discard_win_payment: 'ladder_split' | 'discarder_double' | 'discarder_pays_all' | 'all_single';
  bao: BaoRules;
  dealer_rules: DealerRules;
  special_hands: SpecialHands;
  jokers: JokerRules;
  /** null = abstract chips (2^tai); set = real-money schedule */
  money: MoneyRules | null;
}

export const DEFAULT_RULES: RulesConfig = {
  minimum_tai: 2, maximum_tai: 5, self_draw_minimum_tai: 1, unplayable_tiles: 15,
  combination_tai: {
    chou_ping_hu: 1,
    peng_peng_hu: 2, ban_se: 2, xiao_si_xi: 2, hun_lao_tou: 2, qi_dui: 2,
    xiao_san_yuan: 3,
    ping_hu: 4, qing_yi_se: 4,
    tian_hu: 5, di_hu: 5, shi_san_yao: 5, da_si_xi: 5, da_san_yuan: 5, zi_yi_se: 5, lv_yi_se: 5,
    quan_yao_jiu: 5, si_an_ke: 5, shi_ba_luo_han: 5, gang_shang_gang: 5, qi_qiang_yi: 5, hua_hu: 5, jiu_lian: 5,
  },
  flower_scoring: { own_flower: 1, flower_set: 1, season_set: 1, seven_flower: 10, eight_flower: 12 },
  animal_scoring: { each: 1, set: 1 },
  honour_scoring: { dragon_pong: 1, prevailing_wind: 1, seat_wind: 1 },
  event_scoring: { replacement_win: 1, last_tile: 1, robbing_kong: 1 },
  kong_scoring: { kong_1: 2, kong_3: 2, kong_4: 4, animal_set: 4, flower_set: 4, animal_pair: 2, flower_pair: 2, multiplier_by_minimum_tai: { 0: 0.5, 1: 1, 2: 2 }, initial_hand_double: true },
  self_draw_payment: 'all_double',
  discard_win_payment: 'discarder_double',
  bao: { enabled: false, fan_limit_feed: true, dragon_set_feed: true, wind_set_feed: true, colour_set_feed: true, terminal_set_feed: true, kong_feed: true, fresh_tile_threshold: 4 },
  dealer_rules: { retain_on_win: true, retain_on_draw: true, kong_passes_draw: false, hands_per_wind: 4 },
  special_hands: { seven_pairs: false, all_green: false, men_qing: false, men_qing_tai: 1, eight_flower_instant_win: false, all_animals_instant_win: false },
  jokers: { count: 0, dealer_all_four_instant_win: true, all_four_tai: 5, discardable: false, claimable_when_discarded: false, usable_in_exposed_melds: false, stranded_bao_each: null },
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
  const r = merge(DEFAULT_RULES, over);
  validateRules(r);
  return r;
}

/** Fail loudly at config time rather than deep inside a game. */
export function validateRules(r: RulesConfig): void {
  const m = r.money;
  if (m) {
    const need: (keyof MoneyRules)[] = ['ladder', 'zm_bonus_per_player', 'shoot_total', 'kong_concealed_each', 'kong_exposed_each', 'kong_fed_total', 'bite_flower_hidden', 'bite_flower_open', 'bite_animal_hidden', 'bite_animal_open'];
    const missing = need.filter((k) => m[k] === undefined || m[k] === null);
    if (missing.length) throw new Error(`money config is incomplete: missing ${missing.join(', ')}. A partial money override REPLACES the whole schedule - pass every field, or omit "money" to use chips.`);
    for (const [name, tbl] of [['ladder', m.ladder], ['shoot_total', m.shoot_total]] as const) {
      if (typeof tbl !== 'object' || !Object.keys(tbl).length) throw new Error(`money.${name} must be a non-empty { tai: amount } map`);
      for (const [k, v] of Object.entries(tbl)) if (!Number.isFinite(Number(k)) || !Number.isFinite(v)) throw new Error(`money.${name} has a bad entry ${k}: ${v}`);
    }
  }
  if (r.minimum_tai < 0 || r.maximum_tai < r.minimum_tai) throw new Error(`minimum_tai ${r.minimum_tai} / maximum_tai ${r.maximum_tai} are inconsistent`);
  if (r.self_draw_minimum_tai > r.minimum_tai) throw new Error(`self_draw_minimum_tai ${r.self_draw_minimum_tai} cannot exceed minimum_tai ${r.minimum_tai}`);
  if (r.jokers.count < 0 || r.jokers.count > JOKER_MAX) throw new Error(`jokers.count ${r.jokers.count} out of range (0..${JOKER_MAX})`);
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
