/**
 * Convert evaluator values to chips-per-game for each target at the current
 * Player Turns, using the book's tables. Picks the best target.
 */
import { fanInHand, isAnimal, isFlower, isSeason, type TileKind, type Meld } from 'sg-mahjong-engine';
import { TABLES } from './tables.js';
import { allPongBreakdown, rule4213, rule5313, rule961, thirteenBreakdown, type HandInput } from './evaluators.js';

export type TargetId = 'ping_wu' | 'all_chow' | 'half_color' | 'all_pong' | 'chicken' | 'thirteen';
export interface TargetEval { id: TargetId; value: number | string; chips: number; armed: boolean; note?: string; suit?: string }
export interface Context { seat: number; prevailingWind: number; bonus: TileKind[]; playerTurns: number; minimumFan: 1 | 2; selfDrawMinimumFan: number }

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

  // Chicken: only if the fallback is armed
  const ch = rule4213(h);
  const chance = byTurn(T.chicken_chance![mf]!, ctx.playerTurns, ch.value);
  const chickenChips = (chance - 0.31) * 26;    // fit to Table 10:3 (see PLAN.md)
  if (fan >= ctx.minimumFan) out.push({ id: 'chicken', value: ch.value, armed: true, chips: chickenChips });
  else if (fan >= ctx.selfDrawMinimumFan) out.push({ id: 'chicken', value: ch.value, armed: true, chips: chickenChips * 0.45 - 0.5, note: 'self-draw only' });
  else out.push({ id: 'chicken', value: ch.value, armed: false, chips: -9, note: `needs ${ctx.minimumFan - fan} more Fan` });

  // 13 Wonders (only when plausible)
  const tw = thirteenBreakdown(h);
  if (tw >= 9) out.push({ id: 'thirteen', value: tw, armed: true, chips: byTurn(T.thirteen_chips![mf === 'mf2' ? 'mf2' : 'mf1']! ?? T.thirteen_chips!['mf1']!, ctx.playerTurns, tw) });

  return out.sort((a, b) => b.chips - a.chips);
}

export function handValue(h: HandInput, ctx: Context): { chips: number; best: TargetEval; all: TargetEval[] } {
  const all = evaluateTargets(h, ctx);
  return { chips: all[0]!.chips, best: all[0]!, all };
}
