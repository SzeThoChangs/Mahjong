/**
 * Convert evaluator values to chips-per-game for each target at the current
 * Player Turns, using the book's tables. Picks the best target.
 */
import { fanInHand, isAnimal, isDragon, isFlower, isSeason, windKind, type TileKind } from 'sg-mahjong-engine';
import { TABLES } from './tables.js';
import { allPongBreakdown, rule4213, rule5313, rule961, thirteenBreakdown, type HandInput } from './evaluators.js';

export type TargetId = 'ping_wu' | 'all_chow' | 'half_color' | 'all_pong' | 'chicken' | 'thirteen';

/** Fan you do not hold yet but can reach by ponging a value pair already in hand.
 *  A pair of your seat wind in your own round is a DOUBLE - one pong is worth two fan,
 *  which is often the whole difference between a hand that can win and one that cannot. */
export interface FanRoute { tile: TileKind; fan: number; double: boolean }
export function fanRoutes(concealed: TileKind[], ctx: Context): FanRoute[] {
  const count = new Map<TileKind, number>();
  for (const k of concealed) count.set(k, (count.get(k) ?? 0) + 1);
  const routes: FanRoute[] = [];
  for (const [k, n] of count) {
    if (n < 2) continue;                                    // need a pair to be one tile from the pong
    let fan = 0;
    if (isDragon(k)) fan = 1;
    if (k === windKind(ctx.seat)) fan += 1;
    if (k === windKind(ctx.prevailingWind)) fan += 1;
    if (fan > 0) routes.push({ tile: k, fan, double: fan >= 2 });
  }
  return routes.sort((a, b) => b.fan - a.fan);
}
/**
 * The other way a hand reaches the table minimum: draw a flower or an animal.
 *
 * A value pair (see `fanRoutes`) needs a pong and a live tile. A bonus tile needs nothing but a
 * draw - which is why a weak hand with no pairs still plays on rather than folding. Of the twelve
 * bonus tiles, an animal is always worth 1 Fan and a flower or season only when it is this seat's
 * own, so six of the twelve carry Fan for any given player.
 *
 * Returns the chance of drawing at least one of the Fan-carrying ones in the draws this player has
 * left, which is `wallRemaining / 4` - the other three seats take the rest.
 */
export function bonusFanChance(ctx: Context): number {
  if (!ctx.wallRemaining || ctx.wallRemaining <= 0) return 0;
  const seen = new Set<TileKind>([...ctx.bonus, ...(ctx.visible ?? []).filter((k) => k >= 34)]);
  let live = 0;
  for (let k = 42; k < 46; k++) if (!seen.has(k)) live++;              // animals: 1 Fan each, always
  for (const k of [34 + ctx.seat, 38 + ctx.seat]) if (!seen.has(k)) live++;   // this seat's own flower and season
  if (!live) return 0;
  const myDraws = Math.max(0, Math.floor(ctx.wallRemaining / 4));
  if (!myDraws) return 0;
  // chance at least one of `live` specific tiles lands in `myDraws` draws from `wallRemaining`
  const miss = Math.pow(1 - live / ctx.wallRemaining, myDraws);
  return Math.max(0, Math.min(0.95, 1 - miss));
}

export interface TargetEval { id: TargetId; value: number | string; chips: number; armed: boolean; note?: string; suit?: string }
export interface Context {
  seat: number; prevailingWind: number; bonus: TileKind[]; playerTurns: number; minimumFan: 1 | 2; selfDrawMinimumFan: number;
  /** Every tile kind the player can SEE that is not in their own concealed hand or own melds:
   *  the discard pool, all players' exposed melds, all flowers and animals on the table. Without it
   *  the coach counts four copies of a tile that is already dead, which inflates what a shape can
   *  still become. Optional so older callers keep working - they just reason blind. */
  visible?: readonly TileKind[];
  /** Drawable tiles left in the wall. Needed to price the flower/animal route: a hand that is one
   *  Fan short at turn 12 has a real chance of drawing it and at turn 44 has almost none. Optional
   *  so older callers keep working - without it the bonus route is priced as unavailable. */
  wallRemaining?: number;
  /** Exposed meld count for each OTHER seat. Three exposed sets at turn 40 means that player is
   *  ready 39.5% of the time; none means 4.9%. Without it the coach cannot tell a dangerous table
   *  from a quiet one, so it prices every discard as if nobody were close. */
  opponentMelds?: readonly number[];
}

type Row = Record<string, number>;
const lookup = (row: Row | undefined, v: number, floor = -8): number => {
  if (!row) return floor;
  const keys = Object.keys(row).map(Number).sort((a, b) => a - b);
  if (!keys.length) return floor;
  if (v <= keys[0]!) return row[String(keys[0])]! - (keys[0]! - v) * 0.8;     // extrapolate down gently
  const last = keys[keys.length - 1]!;
  if (v >= last) return row[String(last)]! + (v - last) * 1.5;                // extrapolate up
  let lo = keys[0]!, hi = last;
  for (const k of keys) { if (k <= v) lo = k; if (k >= v) { hi = k; break; } }
  if (lo === hi) return row[String(lo)]!;
  const t = (v - lo) / (hi - lo); return row[String(lo)]! + t * (row[String(hi)]! - row[String(lo)]!);
};
/** interpolate between the 0/20/40 rows by Player Turns; beyond 40 keep decaying gently. */
const byTurn = (tab: Record<string, Row>, turns: number, v: number): number => {
  const rows = Object.keys(tab).map(Number).sort((a, b) => a - b);
  const t = Math.min(turns, rows[rows.length - 1]!);
  let lo = rows[0]!, hi = rows[rows.length - 1]!;
  for (const r of rows) { if (r <= t) lo = r; if (r >= t) { hi = r; break; } }
  const a = lookup(tab[String(lo)], v), b = lookup(tab[String(hi)], v);
  const x = lo === hi ? a : a + ((t - lo) / (hi - lo)) * (b - a);
  const over = Math.max(0, turns - rows[rows.length - 1]!);
  return x - over * 0.15;   // late-game decay beyond the last row
};

export function evaluateTargets(h: HandInput, ctx: Context): TargetEval[] {
  const mf = ctx.minimumFan === 2 ? 'mf2' : 'mf1';
  const fan = fanInHand({ melds: h.melds, bonus: ctx.bonus, seat: ctx.seat, prevailingWind: ctx.prevailingWind });
  const hasBonus = ctx.bonus.some((k) => isFlower(k) || isSeason(k) || isAnimal(k));
  const out: TargetEval[] = [];
  const T = TABLES as unknown as Record<string, Record<string, Record<string, Row>>>;

  // Half-Color
  const hc = rule961(h);
  if (hc.suit) out.push({ id: 'half_color', value: hc.value, suit: hc.suit, armed: true, chips: byTurn(T.half_color_chips![mf]!, ctx.playerTurns, hc.value) });

  // Ping Wu / All-Chow
  const ac = rule5313(h);
  if (!h.melds.some((m) => m.type !== 'chow')) {
    if (!hasBonus) out.push({ id: 'ping_wu', value: ac.value, armed: true, chips: byTurn(T.ping_wu_chips![mf]!, ctx.playerTurns, ac.value) });
    else {
      // All-Chow is 1 Fan: on a discard it needs 1 more Fan in hand at MF2; self-draw is fine at 1.
      const armed = ctx.minimumFan <= 1 || fan >= 1;
      const turn0 = lookup(TABLES.all_chow_table_10_3_turn0_mf1 as unknown as Row, ac.value);
      // scale the turn-0 figure by the ping-wu turn decay
      const decay = byTurn(T.ping_wu_chips![mf]!, ctx.playerTurns, ac.value) - byTurn(T.ping_wu_chips![mf]!, 0, ac.value);
      const chips = turn0 + decay;
      out.push({ id: 'all_chow', value: ac.value, armed, chips: armed ? chips : chips * 0.5 - 1, note: armed ? undefined : 'self-draw only until you hold 1 more Fan' });
    }
  }

  // All-Pong (MF1 tables; MF2 slightly kinder - flagged)
  const ap = allPongBreakdown(h);
  if (!ap.chowsExposed) {
    const tab = T.all_pong_chips!['mf1']!;
    const rowAt = (turns: number) => { const rows = [0, 20, 40]; const t = Math.min(turns, 40); let lo = 0, hi = 40; for (const r of rows) { if (r <= t) lo = r; if (r >= t) { hi = r; break; } } return { lo, hi, t }; };
    const { lo, hi, t } = rowAt(ctx.playerTurns);
    const get = (r: number) => { const row = tab[String(r)]!; if (row[ap.key] !== undefined) return row[ap.key]!; // nearest: same triplets, fewer pairs
      for (let p = ap.pairs; p >= 0; p--) { const k = `${ap.triplets}:${p}`; if (row[k] !== undefined) return row[k]! + (ap.pairs - p) * 2; }
      for (let tt = ap.triplets; tt >= 0; tt--) { const k = `${tt}:0`; if (row[k] !== undefined) return row[k]! + (ap.triplets - tt) * 6; } return -7; };
    const a = get(lo), b = get(hi);
    let chips = lo === hi ? a : a + ((t - lo) / (hi - lo)) * (b - a);
    if (ctx.minimumFan === 2) chips += 0.5;     // longer games favour All-Pong (book: general MF2 correction)
    out.push({ id: 'all_pong', value: ap.key, armed: true, chips });
  }

  // Chicken: viable only if the hand can actually reach the table minimum
  const ch = rule4213(h);
  // chicken_chance is a PROBABILITY table: the generic extrapolation can run past 0, so clamp before pricing
  const chance = Math.max(0.005, Math.min(0.95, byTurn(T.chicken_chance![mf]!, ctx.playerTurns, ch.value)));
  const chickenChips = (chance - 0.31) * 26;    // fit to Table 10:3 (see PLAN.md)
  const routes = fanRoutes(h.concealed, ctx);
  const best = routes[0];
  const reachable = fan + (best?.fan ?? 0);
  if (fan >= ctx.minimumFan) out.push({ id: 'chicken', value: ch.value, armed: true, chips: chickenChips });
  else if (reachable >= ctx.minimumFan && best) {
    // one pong away from a legal hand - a real plan, just not armed yet
    out.push({ id: 'chicken', value: ch.value, armed: true, chips: chickenChips * 0.8 - 0.3,
      note: `needs the ${tileName(best.tile)} pong first${best.double ? ' (double wind: 2 fan in one call)' : ''}` });
  }
  else if (fan >= ctx.selfDrawMinimumFan) out.push({ id: 'chicken', value: ch.value, armed: true, chips: chickenChips * 0.45 - 0.5, note: 'self-draw only' });
  else {
    // No pair to pong into Fan - but a flower or an animal arms the hand just as well, and needs
    // only a draw. Priced by the chance of getting one in the draws this seat has left, so the plan
    // decays as the wall empties and is worth nothing once it is gone.
    // The route is REPORTED but not PRICED. Pricing it - arming Chicken in proportion to the
    // chance of drawing a bonus tile - was measured over 16,000 paired deals and cost 0.18 +/- 0.06
    // chips a game against the coach that simply wrote the hand off. Knowing a flower could still
    // arm the hand is worth saying to a player; it is not worth playing on for.
    const pb = bonusFanChance(ctx);
    const how = pb > 0.05 ? `a flower or animal would arm it (about ${Math.round(pb * 100)}% of the draws left)` : 'no route to it';
    out.push({ id: 'chicken', value: ch.value, armed: false, chips: -9, note: `needs ${ctx.minimumFan - fan} more Fan - ${how}` });
  }
  // All-Pong gets the same credit: a value pair is both a set and the tai the hand needs
  if (best) { const ap = out.find((x) => x.id === 'all_pong'); if (ap) ap.chips += best.fan * 1.2; }

  // 13 Wonders (only when plausible)
  const tw = thirteenBreakdown(h);
  if (tw >= 9) out.push({ id: 'thirteen', value: tw, armed: true, chips: byTurn(T.thirteen_chips![mf === 'mf2' ? 'mf2' : 'mf1']! ?? T.thirteen_chips!['mf1']!, ctx.playerTurns, tw) });

  return out.sort((a, b) => b.chips - a.chips);
}

const tileName = (k: TileKind): string => {
  const N = ['\u6771', '\u5357', '\u897f', '\u5317'];
  if (k >= 27 && k < 31) return N[k - 27]!;
  if (k === 31) return '\u4e2d'; if (k === 32) return '\u767c'; if (k === 33) return '\u767d';
  return String(k);
};

/** What a target would be worth at evaluator score `v` and the current turn - used to find a switch point. */
export function valueOfTargetAt(id: TargetId, v: number, ctx: Context): number | null {
  const mf = ctx.minimumFan === 2 ? 'mf2' : 'mf1';
  const T = TABLES as unknown as Record<string, Record<string, Record<string, Row>>>;
  if (id === 'half_color') return byTurn(T.half_color_chips![mf]!, ctx.playerTurns, v);
  if (id === 'ping_wu') return byTurn(T.ping_wu_chips![mf]!, ctx.playerTurns, v);
  if (id === 'all_chow') { const turn0 = lookup(TABLES.all_chow_table_10_3_turn0_mf1 as unknown as Row, v); return turn0 + byTurn(T.ping_wu_chips![mf]!, ctx.playerTurns, v) - byTurn(T.ping_wu_chips![mf]!, 0, v); }
  return null;
}

export function handValue(h: HandInput, ctx: Context): { chips: number; best: TargetEval; all: TargetEval[] } {
  const all = evaluateTargets(h, ctx);
  return { chips: all[0]!.chips, best: all[0]!, all };
}
