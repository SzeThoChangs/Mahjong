/**
 * Fan evaluation for a winning hand. Values from data/scoring.singapore.json,
 * which is sourced from "A Data Analytic Evaluation of Singapore Mahjong".
 * Fan and tai are the same unit.
 */
import {
  bonusSeat, countsOf, isAnimal, isDragon, isFlower, isHonour, isSeason, isSuited,
  isTerminalOrHonour, isWind, suitOf, windKind, type TileKind,
} from './tiles.js';
import { decompose, isThirteenWonders, winningKinds, jokerCompletions, thirteenWithJokers, type ConcealedSet } from './decompose.js';
import { countsAndJokers, isJoker, rankOf } from './tiles.js';
import { DEFAULT_RULES, type RulesConfig } from './rules.js';

export type MeldType = 'chow' | 'pong' | 'kong';
export interface Meld {
  type: MeldType;
  tiles: TileKind[];       // chow ascending; pong [k,k,k]; kong [k,k,k,k]
  concealed: boolean;      // true only for Kong-4 (declared from hand)
}

export interface WinContext {
  /** Concealed tiles INCLUDING the winning tile. May contain jokers (kind 46) when the table plays with them. */
  concealed: TileKind[];
  melds: Meld[];
  /** Flowers / seasons / animals held. */
  bonus: TileKind[];
  seat: number;              // 0..3 = E S W N
  prevailingWind: number;    // 0..3
  winningTile: TileKind;
  selfDraw: boolean;
  replacementWin?: boolean;  // won on a kong/flower replacement draw
  lastTile?: boolean;        // won on the last valid tile
  robbingKong?: boolean;
  firstDraw?: boolean;       // 天和: dealer, opening hand, nothing discarded yet
  firstDiscard?: boolean;    // 地和: won on the dealer's very first discard
  kongOnKong?: boolean;      // 杠上杠和: replacement of a second consecutive kong
  robbedFlower?: boolean;    // 七抢一: held seven flowers and took the eighth
  isDealer?: boolean;
  jokersUsed?: number;
}

export interface FanItem { id: string; fan: number; }
export interface ScoreResult {
  fan: number;
  items: FanItem[];
  /** Primary combination label (chicken / all_chow / ping_wu / ...) */
  combination: string;
  valid: boolean;
  reason?: string;
}

type FanTable = Record<string, number>;
function fanTable(r: RulesConfig): FanTable {
  return {
    ...r.combination_tai,
    animal: r.animal_scoring.each, animal_set: r.animal_scoring.set,
    own_flower: r.flower_scoring.own_flower, flower_set: r.flower_scoring.flower_set, season_set: r.flower_scoring.season_set,
    seven_flower: r.flower_scoring.seven_flower, eight_flower: r.flower_scoring.eight_flower,
    dragon_pong: r.honour_scoring.dragon_pong, prevailing_wind: r.honour_scoring.prevailing_wind, seat_wind: r.honour_scoring.seat_wind,
    replacement_win: r.event_scoring.replacement_win, last_tile: r.event_scoring.last_tile, robbing_kong: r.event_scoring.robbing_kong,
    men_qing: r.special_hands.men_qing_tai, four_jokers: r.jokers.all_four_tai,
  };
}

const DEFAULT_FAN: FanTable = fanTable(DEFAULT_RULES);
let FAN: FanTable = DEFAULT_FAN;

interface SetView { type: 'chow' | 'pong' | 'kong'; kind: TileKind; tiles: TileKind[]; concealed: boolean }

/** Score a hand. Tries every decomposition (and every joker assignment) and returns the highest-Fan one. */
export function scoreHand(ctx: WinContext, rules: RulesConfig = DEFAULT_RULES): ScoreResult {
  FAN = rules === DEFAULT_RULES ? DEFAULT_FAN : fanTable(rules);
  const { counts, jokers } = countsAndJokers(ctx.concealed);
  if (jokers === 0) return scoreStandard(ctx, rules, false);
  // ---- jokers: enumerate what they could stand for, score each virtual hand, keep the best ----
  const std = ctx.concealed.filter((k) => !isJoker(k));
  const needSets = 4 - ctx.melds.length;
  const suitTally = [0, 0, 0]; for (const k of [...std, ...ctx.melds.flatMap((m) => m.tiles)]) if (isSuited(k)) suitTally[Math.floor(k / 9)]!++;
  const major = suitTally.indexOf(Math.max(...suitTally)) * 9;          // base kind of the majority suit (wan if none)
  const candidates: TileKind[][] = [];
  for (const c of jokerCompletions(counts, jokers, needSets)) {
    const base = [...std, ...c.jokerKinds];
    const eye = c.freeEye ? [major + 4, major + 4] : [];
    // free sets: try all-pong and all-chow materialisations (honour-free, majority suit)
    const variants: TileKind[][] = c.freeSets === 0 ? [[...base, ...eye]] : [
      [...base, ...eye, ...Array.from({ length: c.freeSets }, () => [major + 1, major + 1, major + 1]).flat()],
      [...base, ...eye, ...Array.from({ length: c.freeSets }, () => [major + 1, major + 2, major + 3]).flat()],
    ];
    candidates.push(...variants);
  }
  if (ctx.melds.length === 0) { const tw = thirteenWithJokers(counts, jokers); if (tw) candidates.push([...std, ...tw]); }
  let best: ScoreResult | null = null;
  for (const virt of candidates) {
    const wt = isJoker(ctx.winningTile) ? virt[virt.length - 1]! : ctx.winningTile;
    const r = scoreStandard({ ...ctx, concealed: virt, winningTile: wt }, rules, true);
    if (!r.valid) continue;
    if (!best || r.fan > best.fan) best = r;
  }
  if (!best) return { fan: 0, items: [], combination: 'none', valid: false, reason: 'no joker assignment completes the hand' };
  // same rule as the limit-hand check: no wildcard 天和 on a table playing more than four
  if (rules.jokers.count <= 4 && jokers >= 4 && best.fan < rules.jokers.all_four_tai) { best.items.push({ id: 'tian_hu', fan: rules.jokers.all_four_tai - best.fan }); best.fan = rules.jokers.all_four_tai; best.combination = 'tian_hu'; }
  best.items.push({ id: 'jokers_used', fan: 0 });
  return best;
}

function scoreStandard(ctx: WinContext, _rules: RulesConfig, withJokers: boolean): ScoreResult {
  const counts = countsOf(ctx.concealed);
  const needSets = 4 - ctx.melds.length;

  // ---- 13 Wonders (only possible fully concealed) -------------------------
  if (ctx.melds.length === 0 && isThirteenWonders(counts)) {
    const items: FanItem[] = [{ id: 'shi_san_yao', fan: FAN['shi_san_yao'] ?? 5 }];
    items.push(...bonusItems(ctx));
    items.push(...eventItems(ctx));
    return finish(items, 'shi_san_yao');
  }

  const decs = decompose(counts, needSets);
  if (decs.length === 0) return { fan: 0, items: [], combination: 'none', valid: false, reason: 'not a complete hand' };

  let best: ScoreResult | null = null;
  for (const d of decs) {
    const r = scoreDecomposition(ctx, d.sets, d.eye, withJokers, _rules);
    if (!r.valid) continue;
    if (!best || r.fan > best.fan) best = r;
  }
  return best ?? { fan: 0, items: [], combination: 'none', valid: false, reason: 'no valid decomposition' };
}

function scoreDecomposition(ctx: WinContext, concealedSets: ConcealedSet[], eye: TileKind, withJokers = false, rules: RulesConfig = DEFAULT_RULES): ScoreResult {
  const sets: SetView[] = [
    ...ctx.melds.map((m) => ({ type: m.type, kind: m.tiles[0]!, tiles: m.tiles, concealed: m.concealed })),
    ...concealedSets.map((s) => ({ type: s.type, kind: s.tiles[0]!, tiles: s.tiles, concealed: true })),
  ];
  const items: FanItem[] = [];
  const pongLike = (s: SetView) => s.type !== 'chow';
  const allPong = sets.every(pongLike), allChow = sets.every((s) => s.type === 'chow');
  const allKong = sets.every((s) => s.type === 'kong');
  const allConcealedPong = allPong && sets.every((s) => s.concealed);
  const allTiles: TileKind[] = [eye, eye, ...sets.flatMap((s) => s.tiles)];
  const suits = new Set(allTiles.filter(isSuited).map((k) => suitOf(k)!));
  const hasHonour = allTiles.some(isHonour), hasBonus = ctx.bonus.length > 0;
  const allHonours = allTiles.every(isHonour);
  const allTerminals = allTiles.every((k) => isSuited(k) && (rankOf(k) === 1 || rankOf(k) === 9));
  const GREEN = new Set([19, 20, 21, 23, 25, 32]);                 // 2,3,4,6,8 sok + 發
  const allGreen = allTiles.every((k) => GREEN.has(k));
  const windPongs = sets.filter((s) => pongLike(s) && isWind(s.kind));
  const dragonPongs = sets.filter((s) => pongLike(s) && isDragon(s.kind));

  // ---- 平胡/臭平胡 validity (all-chow restrictions) ----
  if (allChow) {
    if (isDragon(eye) || eye === windKind(ctx.seat) || eye === windKind(ctx.prevailingWind))
      return invalid('all-chow eye may not be a dragon, seat wind or round wind');
    if (ctx.concealed.length <= 2) return invalid('all-chow cannot win with only two concealed tiles');
    if (!ctx.selfDraw && !withJokers) {
      const before = countsOf(ctx.concealed.filter((k) => !isJoker(k)));
      before[ctx.winningTile] = before[ctx.winningTile]! - 1;
      if (winningKinds(before, 4 - ctx.melds.length).length < 2) return invalid('all-chow discard win needs two or more unique winning tiles');
    }
  }

  const F = (k: string) => FAN[k] ?? 0;
  const limit = (id: string): ScoreResult => {
    const li: FanItem[] = [{ id, fan: F(id) }, ...bonusItems(ctx), ...eventItems(ctx)];
    return { fan: li.reduce((a, i) => a + i.fan, 0), items: li, combination: id, valid: true };
  };

  // ---- 5 fan: the limit hands ----
  if (ctx.firstDraw && ctx.isDealer) return limit('tian_hu');
  if (ctx.firstDiscard && !ctx.isDealer) return limit('di_hu');
  if (ctx.robbedFlower) return limit('qi_qiang_yi');
  if (ctx.kongOnKong) return limit('gang_shang_gang');
  // Four wildcards is 天和 only on a table that plays FOUR - there, holding four means holding
  // every one in the game. Past four it is an ordinary occurrence (10.7% of games at 12 wildcards),
  // so the limit hand is withdrawn rather than paying max on nearly one win in five.
  if (rules.jokers.count <= 4 && (ctx.jokersUsed ?? 0) >= 4) return limit('tian_hu');
  if (windPongs.length === 4) return limit('da_si_xi');
  if (dragonPongs.length === 3) return limit('da_san_yuan');
  if (allHonours) return limit('zi_yi_se');
  if (allTerminals && allPong) return limit('quan_yao_jiu');
  if (allKong) return limit('shi_ba_luo_han');
  if (allConcealedPong && ctx.selfDraw) return limit('si_an_ke');
  if (rules.special_hands.all_green && allGreen) return limit('lv_yi_se');
  if (suits.size === 1 && !hasHonour && ctx.melds.length === 0 && isNineGates(allTiles)) return limit('jiu_lian');

  // ---- shape (mutually exclusive) ----
  let combination = 'chicken';
  if (allPong) { items.push({ id: 'peng_peng_hu', fan: F('peng_peng_hu') }); combination = 'peng_peng_hu'; }
  else if (allChow) {
    if (hasBonus) { items.push({ id: 'chou_ping_hu', fan: F('chou_ping_hu') }); combination = 'chou_ping_hu'; }
    else { items.push({ id: 'ping_hu', fan: F('ping_hu') }); combination = 'ping_hu'; }
  }
  // ---- colour (mutually exclusive) ----
  if (suits.size === 1 && !hasHonour) { items.push({ id: 'qing_yi_se', fan: F('qing_yi_se') }); if (combination === 'chicken') combination = 'qing_yi_se'; }
  else if (suits.size === 1 && hasHonour) { items.push({ id: 'ban_se', fan: F('ban_se') }); if (combination === 'chicken') combination = 'ban_se'; }
  // ---- 混老头: every set a pong of terminals or honours ----
  if (allPong && sets.every((s) => isTerminalOrHonour(s.kind)) && isTerminalOrHonour(eye) && !allHonours && !allTerminals) {
    items.push({ id: 'hun_lao_tou', fan: F('hun_lao_tou') }); if (combination === 'chicken') combination = 'hun_lao_tou';
  }
  // ---- honour part-hands ----
  if (dragonPongs.length === 2 && isDragon(eye)) { items.push({ id: 'xiao_san_yuan', fan: F('xiao_san_yuan') }); if (combination === 'chicken') combination = 'xiao_san_yuan'; }
  else for (const _ of dragonPongs) items.push({ id: 'dragon_pong', fan: F('dragon_pong') });
  if (windPongs.length === 3 && isWind(eye)) { items.push({ id: 'xiao_si_xi', fan: F('xiao_si_xi') }); if (combination === 'chicken') combination = 'xiao_si_xi'; }
  else for (const s of windPongs) {
    if (s.kind === windKind(ctx.prevailingWind)) items.push({ id: 'prevailing_wind', fan: F('prevailing_wind') });
    if (s.kind === windKind(ctx.seat)) items.push({ id: 'seat_wind', fan: F('seat_wind') });
  }
  // ---- 门清: fully concealed and self-drawn ----
  if (rules.special_hands.men_qing && ctx.melds.length === 0 && ctx.selfDraw) items.push({ id: 'men_qing', fan: F('men_qing') });

  items.push(...bonusItems(ctx));
  items.push(...eventItems(ctx));
  return finish(items, combination);
}

/** 九连宝灯: a concealed single-suit hand of 1112345678999 plus one duplicate. */
function isNineGates(tiles: TileKind[]): boolean {
  if (tiles.length !== 14) return false;
  const base = Math.floor(tiles[0]! / 9) * 9;
  if (!tiles.every((k) => k >= base && k < base + 9)) return false;
  const c = new Array(9).fill(0);
  for (const k of tiles) c[k - base]++;
  const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
  let extra = 0;
  for (let i = 0; i < 9; i++) { const d = c[i] - need[i]!; if (d < 0) return false; extra += d; }
  return extra === 1;
}

function bonusItems(ctx: WinContext): FanItem[] {
  const items: FanItem[] = [];
  const animals = ctx.bonus.filter(isAnimal);
  for (const _ of animals) items.push({ id: 'animal', fan: FAN['animal']! });
  if (animals.length === 4) items.push({ id: 'animal_set', fan: FAN['animal_set']! });
  const flowers = ctx.bonus.filter(isFlower), seasons = ctx.bonus.filter(isSeason);
  if (flowers.length + seasons.length === 7 && FAN['seven_flower']) { items.push({ id: 'seven_flower', fan: FAN['seven_flower']! }); return items; }   // individual flower Fan does not add
  for (const f of [...flowers, ...seasons]) if (bonusSeat(f) === ctx.seat) items.push({ id: 'own_flower', fan: FAN['own_flower']! });
  if (flowers.length === 4) items.push({ id: 'flower_set', fan: FAN['flower_set']! });
  if (seasons.length === 4) items.push({ id: 'season_set', fan: FAN['season_set']! });
  return items;
}
function eventItems(ctx: WinContext): FanItem[] {
  const items: FanItem[] = [];
  if (ctx.replacementWin) items.push({ id: 'replacement_win', fan: FAN['replacement_win']! });
  if (ctx.lastTile) items.push({ id: 'last_tile', fan: FAN['last_tile']! });
  if (ctx.robbingKong) items.push({ id: 'robbing_kong', fan: FAN['robbing_kong']! });
  return items;
}
function finish(items: FanItem[], combination: string): ScoreResult {
  return { fan: items.reduce((a, i) => a + i.fan, 0), items, combination, valid: true };
}
function invalid(reason: string): ScoreResult { return { fan: 0, items: [], combination: 'none', valid: false, reason }; }

/** Fan currently held from bonus tiles + exposed melds (no win needed). Used for "is the fallback armed". */
/**
 * What the TABLE can see this hand is worth - the tai already locked in by the exposed melds,
 * as a player sitting opposite would count it. Different from `fanInHand`, which counts only
 * dragon and wind pongs and is blind to shape: four terminal pongs read as 0 there, though
 * everyone at the table can see what is coming.
 *
 * Used for the fed-the-limit bao, which asks whether your tile took their VISIBLE hand to the
 * limit. Only shapes the exposed melds already settle are counted, and only from three melds on,
 * because with two down the hand can still become anything:
 *
 *   - all pongs of honours and terminals (混老頭) - counted per the house rule that a plain
 *     all-pong of middle numbers does NOT make a feeder liable, only this one
 *   - every meld in one suit (清一色), or one suit plus honours (半色)
 *
 * Deliberately CONSERVATIVE, in two ways, because this number decides whether somebody owes the
 * whole bill and a rule that fires too readily is worse than one that fires too late:
 *
 *   - the shape bonuses do not stack. A 混老頭 of one suit's terminals plus dragons is also,
 *     technically, half-colour, and adding both reads 8 against a finished hand worth 6. The
 *     larger of the two is taken and the other dropped.
 *   - a plain all-pong scores nothing here. Three pongs down can still take a chow for the
 *     fourth set, so 碰碰胡 is not settled, and the house rule says a plain all-pong of middle
 *     numbers carries no liability anyway.
 *
 * It prices what is on the table, never a hand's potential.
 */
export function visibleTai(ctx: Pick<WinContext, 'melds' | 'bonus' | 'seat' | 'prevailingWind'>, rules: RulesConfig = DEFAULT_RULES): number {
  const t = fanTable(rules), F = (k: string) => t[k] ?? 0;
  let fan = fanInHand(ctx);
  if (ctx.melds.length < 3) return fan;
  const heads = ctx.melds.map((m) => m.tiles[0]!);
  const suits = new Set(heads.filter(isSuited).map(suitOf));
  const terminals = ctx.melds.every((m) => m.type !== 'chow') && heads.every(isTerminalOrHonour) ? F('hun_lao_tou') : 0;
  const colour = suits.size === 1 ? (heads.every(isSuited) ? F('qing_yi_se') : F('ban_se')) : 0;
  return fan + Math.max(terminals, colour);
}

export function fanInHand(ctx: Pick<WinContext, 'melds' | 'bonus' | 'seat' | 'prevailingWind'>): number {
  let fan = 0;
  for (const i of bonusItems({ ...ctx, concealed: [], winningTile: 0, selfDraw: false })) fan += i.fan;
  for (const m of ctx.melds) {
    if (m.type === 'chow') continue;
    const k = m.tiles[0]!;
    if (isDragon(k)) fan += 1;
    if (k === windKind(ctx.prevailingWind)) fan += 1;
    if (k === windKind(ctx.seat)) fan += 1;
  }
  return fan;
}
