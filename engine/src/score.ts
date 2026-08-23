/**
 * Fan evaluation for a winning hand. Values from data/scoring.singapore.json,
 * which is sourced from "A Data Analytic Evaluation of Singapore Mahjong".
 * Fan and tai are the same unit.
 */
import {
  bonusSeat, countsOf, isAnimal, isDragon, isFlower, isHonour, isSeason, isSuited,
  isTerminalOrHonour, isWind, suitOf, windKind, type TileKind,
} from './tiles.js';
import { decompose, isThirteenWonders, winningKinds, type ConcealedSet } from './decompose.js';
import { DEFAULT_RULES, type RulesConfig } from './rules.js';

export type MeldType = 'chow' | 'pong' | 'kong';
export interface Meld {
  type: MeldType;
  tiles: TileKind[];       // chow ascending; pong [k,k,k]; kong [k,k,k,k]
  concealed: boolean;      // true only for Kong-4 (declared from hand)
}

export interface WinContext {
  /** Concealed standard tiles INCLUDING the winning tile. */
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
    dragon_pong: r.honour_scoring.dragon_pong, prevailing_wind: r.honour_scoring.prevailing_wind, seat_wind: r.honour_scoring.seat_wind,
    two_dragons_eye: r.honour_scoring.two_dragons_eye, three_winds_eye: r.honour_scoring.three_winds_eye,
    replacement_win: r.event_scoring.replacement_win, last_tile: r.event_scoring.last_tile, robbing_kong: r.event_scoring.robbing_kong,
  };
}
const DEFAULT_FAN: FanTable = fanTable(DEFAULT_RULES);
let FAN: FanTable = DEFAULT_FAN;

interface SetView { type: 'chow' | 'pong' | 'kong'; kind: TileKind; tiles: TileKind[]; concealed: boolean }

/** Score a hand. Tries every decomposition and returns the highest-Fan one. */
export function scoreHand(ctx: WinContext, rules: RulesConfig = DEFAULT_RULES): ScoreResult {
  FAN = rules === DEFAULT_RULES ? DEFAULT_FAN : fanTable(rules);
  const counts = countsOf(ctx.concealed);
  const needSets = 4 - ctx.melds.length;

  // ---- 13 Wonders (only possible fully concealed) -------------------------
  if (ctx.melds.length === 0 && isThirteenWonders(counts)) {
    const items: FanItem[] = [{ id: 'thirteen_wonders', fan: FAN['thirteen_wonders']! }];
    items.push(...bonusItems(ctx));
    items.push(...eventItems(ctx));
    return finish(items, 'thirteen_wonders');
  }

  const decs = decompose(counts, needSets);
  if (decs.length === 0) return { fan: 0, items: [], combination: 'none', valid: false, reason: 'not a complete hand' };

  let best: ScoreResult | null = null;
  for (const d of decs) {
    const r = scoreDecomposition(ctx, d.sets, d.eye);
    if (!r.valid) continue;
    if (!best || r.fan > best.fan) best = r;
  }
  return best ?? { fan: 0, items: [], combination: 'none', valid: false, reason: 'no valid decomposition' };
}

function scoreDecomposition(ctx: WinContext, concealedSets: ConcealedSet[], eye: TileKind): ScoreResult {
  const sets: SetView[] = [
    ...ctx.melds.map((m) => ({ type: m.type, kind: m.tiles[0]!, tiles: m.tiles, concealed: m.concealed })),
    ...concealedSets.map((s) => ({ type: s.type, kind: s.tiles[0]!, tiles: s.tiles, concealed: true })),
  ];
  const items: FanItem[] = [];
  const pongLike = (s: SetView) => s.type !== 'chow';
  const allPong = sets.every(pongLike);
  const allChow = sets.every((s) => s.type === 'chow');
  const allKong = sets.every((s) => s.type === 'kong');
  const allTiles: TileKind[] = [eye, eye, ...sets.flatMap((s) => s.tiles)];
  const suits = new Set(allTiles.filter(isSuited).map((k) => suitOf(k)!));
  const hasHonour = allTiles.some(isHonour);
  const hasBonus = ctx.bonus.length > 0;

  // ---- All-Chow validity (source: All-Chow restrictions) ------------------
  if (allChow) {
    if (isDragon(eye) || eye === windKind(ctx.seat) || eye === windKind(ctx.prevailingWind))
      return invalid('all_chow eye may not be a dragon, seat wind or prevailing wind');
    if (ctx.concealed.length <= 2)
      return invalid('all_chow cannot win with only two concealed tiles');
    if (!ctx.selfDraw) {
      const before = countsOf(ctx.concealed);
      before[ctx.winningTile] = before[ctx.winningTile]! - 1;
      const outs = winningKinds(before, 4 - ctx.melds.length);
      if (outs.length < 2) return invalid('all_chow discard win needs two or more unique winning tiles');
    }
  }

  // ---- Combinations ---------------------------------------------------------
  let combination = 'chicken';
  const windPongs = sets.filter((s) => pongLike(s) && isWind(s.kind));
  const dragonPongs = sets.filter((s) => pongLike(s) && isDragon(s.kind));

  if (allKong) { items.push({ id: 'all_kong', fan: FAN['all_kong']! }); combination = 'all_kong'; }
  else if (windPongs.length === 4) {
    items.push({ id: 'wind_set', fan: FAN['wind_set']! }); combination = 'wind_set';
    if (allPong) items.push({ id: 'all_pong', fan: FAN['all_pong']! });
  }
  else if (allPong && sets.every((s) => isTerminalOrHonour(s.kind)) && isTerminalOrHonour(eye)) {
    items.push({ id: 'all_terminal', fan: FAN['all_terminal']! }, { id: 'all_pong', fan: FAN['all_pong']! });
    combination = 'all_terminal';
  }
  else {
    if (allPong) {
      const concealedAll = sets.every((s) => s.concealed) ;
      if (concealedAll) { items.push({ id: 'concealed_all_pong', fan: FAN['concealed_all_pong']! }); combination = 'concealed_all_pong'; }
      else { items.push({ id: 'all_pong', fan: FAN['all_pong']! }); combination = 'all_pong'; }
    } else if (allChow) {
      if (!hasBonus) { items.push({ id: 'ping_wu', fan: FAN['ping_wu']! }); combination = 'ping_wu'; }
      else { items.push({ id: 'all_chow', fan: FAN['all_chow']! }); combination = 'all_chow'; }
    }
    // colour
    if (suits.size === 1 && !hasHonour) { items.push({ id: 'full_color', fan: FAN['full_color']! }); if (combination === 'chicken') combination = 'full_color'; }
    else if (suits.size === 1 && hasHonour) { items.push({ id: 'half_color', fan: FAN['half_color']! }); if (combination === 'chicken') combination = 'half_color'; }
    else if (suits.size === 0) { /* all honours: covered by all_terminal branch above */ }
    // half-terminal: every set AND the eye touches a terminal or honour
    const touches = (s: SetView) => s.tiles.some(isTerminalOrHonour);
    if (!allPong && sets.every(touches) && isTerminalOrHonour(eye)) {
      items.push({ id: 'half_terminal', fan: FAN['half_terminal']! }); if (combination === 'chicken') combination = 'half_terminal';
    }
  }

  // ---- Honour sets ------------------------------------------------------------
  if (dragonPongs.length === 3) {
    items.push({ id: 'dragon_set', fan: FAN['dragon_set']! }); if (combination === 'chicken') combination = 'dragon_set';
  } else {
    for (const _ of dragonPongs) items.push({ id: 'dragon_pong', fan: FAN['dragon_pong']! });
    if (dragonPongs.length === 2 && isDragon(eye)) items.push({ id: 'two_dragons_eye', fan: FAN['two_dragons_eye']! });
  }
  if (windPongs.length === 3 && isWind(eye)) {
    items.push({ id: 'three_winds_eye', fan: FAN['three_winds_eye']! }); // includes the wind pong fan
  } else if (windPongs.length < 4) {
    for (const s of windPongs) {
      if (s.kind === windKind(ctx.prevailingWind)) items.push({ id: 'prevailing_wind', fan: FAN['prevailing_wind']! });
      if (s.kind === windKind(ctx.seat)) items.push({ id: 'seat_wind', fan: FAN['seat_wind']! });
    }
  }

  items.push(...bonusItems(ctx));
  items.push(...eventItems(ctx));
  return finish(items, combination);
}

function bonusItems(ctx: WinContext): FanItem[] {
  const items: FanItem[] = [];
  const animals = ctx.bonus.filter(isAnimal);
  for (const _ of animals) items.push({ id: 'animal', fan: FAN['animal']! });
  if (animals.length === 4) items.push({ id: 'animal_set', fan: FAN['animal_set']! });
  const flowers = ctx.bonus.filter(isFlower), seasons = ctx.bonus.filter(isSeason);
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
