/**
 * The table's money schedule, and pricing hand types under it.
 *
 * The whole schedule follows from the ladder (base amount per tai):
 *   self-draw (ZM): each of the 3 opponents pays  ladder(tai) + zm
 *   discard win:    the shooter alone pays        ladder(tai) + 2 x ladder(tai-1)
 * Verified exactly against the "3/6, shooter pay, ZM +$2" table.
 */
/**
 * Who bears a discard win. The TOTAL is the same either way -
 * base(tai) + 2 x base(tai-1)  (5 tai = 20 + 10 + 10 = $40).
 *   'shooter'  - 打出者包: the discarder alone pays the whole $40
 *   'everyone' - the discarder pays $20 and each other loser pays $10
 *   'even'     - all three pay the same share
 */
export type PayMode = 'shooter' | 'everyone' | 'even';

export interface MoneyConfig {
  name: string;
  payMode: PayMode;
  ladder: Record<number, number>;   // tai -> base amount per person
  zm: number;                       // added per person on a self-draw
  minTai: number;
  maxTai: number;
  selfDrawMinTai: number;
  kongConcealed: number;            // 暗槓 concealed kong: each opponent pays
  kongExposed: number;              // 明槓 exposed kong (4th tile onto your own pong): each opponent pays
  kongFed: number;                  // fed kong (claimed off a discard): the feeder alone pays
  flowerBiteHidden: number;         // own-number flower pair, from the deal / during play
  flowerBiteOpen: number;
  animalBiteHidden: number;         // cat+mouse or rooster+centipede, from the deal / during play
  animalBiteOpen: number;
  jokers: number;                   // wildcards in play (0 = none, usually 4)
  shootOverride?: Record<number, number>;   // set only if the house does not follow the derived rule
}

export const PRESETS: MoneyConfig[] = [
  { name: 'Flat 2/3/5/10/20 (your table)', payMode: 'shooter', ladder: { 1: 2, 2: 3, 3: 5, 4: 10, 5: 20 }, zm: 2, minTai: 2, maxTai: 5, selfDrawMinTai: 1, kongConcealed: 2, kongExposed: 2, kongFed: 6, flowerBiteHidden: 4, flowerBiteOpen: 2, animalBiteHidden: 4, animalBiteOpen: 2, jokers: 4 },
  { name: 'Doubling 2/4/8/16/32', payMode: 'shooter', ladder: { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32 }, zm: 2, minTai: 2, maxTai: 5, selfDrawMinTai: 1, kongConcealed: 2, kongExposed: 2, kongFed: 6, flowerBiteHidden: 4, flowerBiteOpen: 2, animalBiteHidden: 4, animalBiteOpen: 2, jokers: 4 },
  { name: 'Doubling 1/2/4/8/16', payMode: 'shooter', ladder: { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }, zm: 1, minTai: 1, maxTai: 5, selfDrawMinTai: 1, kongConcealed: 1, kongExposed: 1, kongFed: 3, flowerBiteHidden: 2, flowerBiteOpen: 1, animalBiteHidden: 2, animalBiteOpen: 1, jokers: 4 },
  { name: 'Flat 1/2/3/5/10, max 5', payMode: 'shooter', ladder: { 1: 1, 2: 2, 3: 3, 4: 5, 5: 10 }, zm: 1, minTai: 1, maxTai: 5, selfDrawMinTai: 1, kongConcealed: 1, kongExposed: 1, kongFed: 3, flowerBiteHidden: 2, flowerBiteOpen: 1, animalBiteHidden: 2, animalBiteOpen: 1, jokers: 4 },
  { name: 'Doubling to 10 tai (big-hand house)', payMode: 'shooter', ladder: { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32, 7: 64, 8: 128, 9: 256, 10: 512 }, zm: 2, minTai: 1, maxTai: 10, selfDrawMinTai: 1, kongConcealed: 2, kongExposed: 2, kongFed: 6, flowerBiteHidden: 4, flowerBiteOpen: 2, animalBiteHidden: 4, animalBiteOpen: 2, jokers: 4 },
];

export const base = (c: MoneyConfig, tai: number): number => {
  const keys = Object.keys(c.ladder).map(Number).sort((a, b) => a - b);
  const t = Math.min(Math.max(tai, keys[0]!), c.maxTai);
  let v = c.ladder[keys[0]!]!;
  for (const k of keys) if (t >= k) v = c.ladder[k]!;
  return v;
};
/** what the winner collects in total */
export const zmTotal = (c: MoneyConfig, tai: number) => 3 * (base(c, tai) + c.zm);
/** total the WINNER collects on a discard win (how it is split depends on payMode) */
/** what each seat pays on a discard win */
export const shootSplit = (c: MoneyConfig, tai: number): { discarder: number; other: number } => {
  const b = base(c, tai), lower = base(c, Math.max(1, tai - 1));
  if (c.payMode === 'even') return { discarder: b, other: b };
  if (c.payMode === 'shooter') return { discarder: b + 2 * lower, other: 0 };   // shooter carries the whole bill
  return { discarder: b, other: lower };                                        // everyone pays their share
};
/** total the WINNER collects on a discard win */
export const shootTotal = (c: MoneyConfig, tai: number): number => {
  const sp = shootSplit(c, tai);
  return sp.discarder + 2 * sp.other;
};

export const COMBO_LABEL: Record<string, string> = {
  chicken: '雞胡 *Pi Wu* — no value',
  chou_ping_hu: '臭平胡 dirty *Ping Wu*, with a *Flower* or *Animal*',
  peng_peng_hu: '碰碰胡 *Pong Pong*',
  ban_se: '半色 *Half Colour*',
  xiao_si_xi: '小四喜 little four winds',
  hun_lao_tou: '混老头 mixed *Terminals* and *Honours*',
  qi_dui: '对对胡 seven pairs',
  xiao_san_yuan: '小三元 little three *Dragons*',
  ping_hu: '平胡 *Ping Wu*, no *Flower* or *Animal*',
  qing_yi_se: '清一色 *Full Colour*',
  tian_hu: '天和 heavenly / four *Jokers*',
  di_hu: '地和 earthly',
  shi_san_yao: '十三幺 thirteen wonders',
  da_si_xi: '大四喜 big four winds',
  da_san_yuan: '大三元 big three *Dragons*',
  zi_yi_se: '字一色 all *Honours*',
  lv_yi_se: '绿一色 all green',
  quan_yao_jiu: '全幺九 all *Terminals*',
  si_an_ke: '四暗刻 four concealed *Pongs* (*Zi Mo*)',
  shi_ba_luo_han: '十八罗汉 all *Kongs*',
  gang_shang_gang: '杠上杠和 *Kong* on *Kong*',
  qi_qiang_yi: '七抢一 robbing the *Flower*',
  hua_hu: '八仙过海 eight immortals',
  jiu_lian: '九连宝灯 nine gates',
};
export const ITEM_LABEL: Record<string, string> = {
  own_flower: '正花 seat *Flower*', flower_set: '花杠加台 *Flower* set', season_set: '花杠加台 season set',
  animal: '动物加台 *Animal*', animal_set: '动物杠加台 *Animal* set',
  dragon_pong: '箭刻 *Dragon* *Pong*', seat_wind: '门风刻 *Seat Wind*', prevailing_wind: '圈风刻 *Prevailing Wind*',
  replacement_win: '杠上开花 / 花上自摸', last_tile: '海底捞月 last tile', robbing_kong: '抢杠 robbing the *Kong*',
  men_qing: '门清 concealed *Zi Mo*', four_jokers: 'four *Jokers*', jokers_used: '*Jokers* used',
};

// ---------------------------------------------------------------------------
// Strategy profile: measured hand-type frequencies from the generated dataset
// ---------------------------------------------------------------------------
export interface Profile {
  run: string; hands: number; draws: number; avgTurns: number; kongsPerHand: number; sidePerHand: number;
  minimumTai: number; maximumTai: number;
  drawsPerHand?: number; claimsPerHand?: number; blockedPerHand?: number;
  avgReadyTurn?: number; readyRate?: number;
  unitsPerHand?: number[];
  winTiles?: Record<string, number>;
  combos: { id: string; wins: number; avgTurns: number; fan: Record<string, { sd: number; disc: number }> }[];
}
export interface ComboValue { id: string; wins: number; per1000: number; avgWin: number; avgTai: number; per1000Value: number; avgTurns: number }

/** Re-price every hand type under a money config. Exact for win payments. */
export function priceProfile(p: Profile, c: MoneyConfig): ComboValue[] {
  const out: ComboValue[] = [];
  for (const combo of p.combos) {
    let total = 0, n = 0, taiSum = 0;
    for (const [fanStr, { sd, disc }] of Object.entries(combo.fan)) {
      const tai = Number(fanStr);
      if (sd) { total += sd * zmTotal(c, tai); n += sd; taiSum += sd * tai; }
      if (disc) { total += disc * shootTotal(c, tai); n += disc; taiSum += disc * tai; }
    }
    if (!n) continue;
    const per1000 = (combo.wins / p.hands) * 1000;
    out.push({ id: combo.id, wins: combo.wins, per1000, avgWin: total / n, avgTai: taiSum / n, per1000Value: per1000 * (total / n), avgTurns: combo.avgTurns });
  }
  return out.sort((a, b) => b.per1000Value - a.per1000Value);
}

export interface TaiBand { tai: number; wins: number; per1000: number; avgWin: number; value: number }
/** Value by tai level, across all hand types - where the money actually is. */
export function taiBands(p: Profile, c: MoneyConfig): TaiBand[] {
  const byTai = new Map<number, { wins: number; total: number }>();
  for (const combo of p.combos) for (const [fanStr, { sd, disc }] of Object.entries(combo.fan)) {
    const tai = Number(fanStr);
    const e = byTai.get(tai) ?? { wins: 0, total: 0 };
    e.wins += sd + disc; e.total += sd * zmTotal(c, tai) + disc * shootTotal(c, tai);
    byTai.set(tai, e);
  }
  return [...byTai.entries()].map(([tai, e]) => ({ tai, wins: e.wins, per1000: (e.wins / p.hands) * 1000, avgWin: e.total / e.wins, value: (e.wins / p.hands) * 1000 * (e.total / e.wins) }))
    .sort((a, b) => a.tai - b.tai);
}

export interface SideEconomics { perHandTable: number; perDraw: number; perSeatPerHand: number; callCost: number; kongBonus: number }
/** Side-payment economics: what a draw is worth, and therefore what calling costs. */
export function sideEconomics(p: Profile, c: MoneyConfig): SideEconomics | null {
  const u = p.unitsPerHand, draws = p.drawsPerHand;
  if (!u || !draws) return null;
  const amt = [c.kongConcealed, c.kongExposed, c.kongFed, c.flowerBiteHidden, c.flowerBiteOpen, c.animalBiteHidden, c.animalBiteOpen];
  const perHandTable = u.reduce((a, v, i) => a + v * (amt[i] ?? 0), 0);
  const biteMoney = u.slice(3).reduce((a, v, i) => a + v * (amt[i + 3] ?? 0), 0);
  const perDraw = biteMoney / draws;
  return { perHandTable, perDraw, perSeatPerHand: perHandTable / 4, callCost: perDraw, kongBonus: 3 * c.kongExposed + perDraw };
}

// ---------------------------------------------------------------------------
// Re-pricing measured decisions under any money schedule
// ---------------------------------------------------------------------------
export interface OutcomeMix { w: Record<string, number>; led: [number, number, number, number, number, number, number] }

/** value to the acting seat of one hand outcome: role letter + tai */
export function outcomeValue(role: string, tai: number, c: MoneyConfig): number {
  const sp = shootSplit(c, tai);
  switch (role) {
    case 'W': return zmTotal(c, tai);
    case 'D': return shootTotal(c, tai);
    case 'z': return -(base(c, tai) + c.zm);
    case 's': return -sp.discarder;
    case 'o': return -sp.other;
    case 'l': return -(sp.discarder + 2 * sp.other);
    default: return 0;
  }
}
/** EV of an action in dollars under `c`, from the outcome mix. Exact - no re-simulation. */
export function priceMix(mix: OutcomeMix, n: number, c: MoneyConfig): number {
  let total = 0;
  for (const [key, count] of Object.entries(mix.w)) total += count * outcomeValue(key[0]!, Number(key.slice(1)), c);
  const amt = [c.kongConcealed, c.kongExposed, c.kongFed, c.flowerBiteHidden, c.flowerBiteOpen, c.animalBiteHidden, c.animalBiteOpen];
  for (let i = 0; i < amt.length; i++) total += (mix.led[i] ?? 0) * amt[i]!;
  return total / Math.max(1, n);
}

/**
 * The table the player set up, kept in the browser. It lives here rather than in the Table setup
 * screen because Train prices every action under it, and Train must not have to carry that whole
 * screen in its file to read one setting.
 */
const KEY = 'mahjong.money.config';
export function loadConfig(): MoneyConfig {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as MoneyConfig; } catch { /* ignore */ }
  return PRESETS[0]!;
}
export const saveConfig = (c: MoneyConfig): void => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } };
