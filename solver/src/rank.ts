/** Rank the 14 possible discards and explain the choice in plain language. */
import {
  fanInHand, isDragon, isHonour, isSuited, isTerminal, kindName, rankOf, suitOf, windKind, type Meld, type TileKind,
} from 'sg-mahjong-engine';
import { handValue, fanRoutes, type Context, type TargetEval } from './targets.js';
import { allPongBreakdown, rule4213, rule5313, rule961, type HandInput } from './evaluators.js';

export type Verdict = 'best' | 'fine' | 'mistake' | 'blunder';
export interface DiscardOption {
  tile: TileKind; chips: number; delta: number; verdict: Verdict;
  target: TargetEval; acceptance: number; reasons: string[];
}
export interface Ranking {
  options: DiscardOption[];           // sorted best first
  plan: string;                        // one-line plan statement
  planDetail: string[];                // bullet lines
  best: DiscardOption;
  /** tiles that are equal-best within noise - naming one of them as 'the' answer would be arbitrary */
  tied: TileKind[];
}

const WIND_OR_DRAGON: Record<number, string> = { 27: '\u6771', 28: '\u5357', 29: '\u897f', 30: '\u5317', 31: '\u4e2d', 32: '\u767c', 33: '\u767d' };
const SUIT_NAME = { wan: '萬', tong: '筒', sok: '條' } as const;
const TARGET_NAME: Record<string, string> = { ping_wu: 'Ping Wu', all_chow: 'All-Chow', half_color: 'Half-Color', all_pong: 'All-Pong', chicken: 'Chicken', thirteen: '13 Wonders' };

/** How many tile kinds (weighted by copies left) would improve the hand FOR THE PLAN IT IS PLAYING.
 *  Using the wrong evaluator here silently applies chow logic to a pong hand (and vice versa),
 *  which shows up as a phantom preference between tiles the plan values identically. */
function acceptance(h: HandInput, best: TargetEval): number {
  const evalFor = (x: HandInput): number => {
    if (best.id === 'half_color') return rule961(x).value;
    if (best.id === 'ping_wu' || best.id === 'all_chow') return rule5313(x).value;
    if (best.id === 'all_pong') { const b = allPongBreakdown(x); return b.triplets * 10 + b.pairs * 3; }
    return rule4213(x).value;
  };
  const base = evalFor(h);
  let n = 0;
  const held = new Map<TileKind, number>(); for (const k of h.concealed) held.set(k, (held.get(k) ?? 0) + 1);
  for (let k = 0; k < 34; k++) {
    const left = 4 - (held.get(k) ?? 0) - h.melds.reduce((a, m) => a + m.tiles.filter((t) => t === k).length, 0);
    if (left <= 0) continue;
    if (evalFor({ concealed: [...h.concealed, k], melds: h.melds }) > base) n += left;
  }
  return n;
}

export function rankDiscards(concealed: TileKind[], melds: Meld[], ctx: Context): Ranking {
  const kinds = [...new Set(concealed)];
  const opts: DiscardOption[] = [];
  const hands = new Map<TileKind, HandInput>();
  for (const k of kinds) {
    const rest = [...concealed]; rest.splice(rest.indexOf(k), 1);
    const h = { concealed: rest, melds };
    hands.set(k, h);
    const hv = handValue(h, ctx);
    opts.push({ tile: k, chips: hv.chips, delta: 0, verdict: 'fine', target: hv.best, acceptance: 0, reasons: [] });
  }
  opts.sort((a, b) => b.chips - a.chips);
  // acceptance (what improves next draw) is the expensive part: only compute it where it can change the order
  const cutoff = opts[0]!.chips - 1.5;
  for (const o of opts) {
    if (o.chips < cutoff) break;
    o.acceptance = acceptance(hands.get(o.tile)!, o.target);
    o.chips += o.acceptance * 0.06;
  }
  opts.sort((a, b) => b.chips - a.chips);
  const top = opts[0]!;
  for (const o of opts) {
    o.delta = o.chips - top.chips;
    o.verdict = o === top ? 'best' : o.delta > -0.75 ? 'fine' : o.delta > -2.5 ? 'mistake' : 'blunder';
    o.reasons = reasonsFor(o.tile, concealed, melds, ctx, top.target, unseenOf(concealed, melds));
  }
  const t = top.target;
  const where = t.suit ? ` in ${SUIT_NAME[t.suit as keyof typeof SUIT_NAME]}` : '';
  const restAll = [...concealed.filter((_, i) => i !== concealed.indexOf(top.tile)), ...melds.flatMap((m) => m.tiles)];
  const pureSuit = t.id === 'half_color' && !restAll.some(isHonour);
  const label = pureSuit ? 'Full-Color (no honours — 4 Fan)' : TARGET_NAME[t.id]!;
  const plan = `${label}${where}`;
  const detail: string[] = [];
  detail.push(`${label}${where}: ${t.id === 'all_pong' ? 'breakdown' : 'score'} ${t.value} → about ${fmt(t.chips)} chips/game at turn ${ctx.playerTurns}.`);
  if (pureSuit) detail.push('Scored with the Half-Color method (the book treats Full-Color as Half-Color without honours); the payout is higher.');
  if (t.note) detail.push(`Note: ${t.note}.`);
  const hvAll = handValue({ concealed: (() => { const r = [...concealed]; r.splice(r.indexOf(top.tile), 1); return r; })(), melds }, ctx).all;
  const second = hvAll[1];
  if (second) detail.push(`Next best plan: ${TARGET_NAME[second.id]}${second.suit ? ` in ${SUIT_NAME[second.suit as keyof typeof SUIT_NAME]}` : ''} (${fmt(second.chips)}).`);
  const chicken = hvAll.find((x) => x.id === 'chicken');
  if (chicken && t.id !== 'chicken') detail.push(chicken.armed ? `Chicken fallback is armed${chicken.note ? ` (${chicken.note})` : ''}.` : `Chicken fallback NOT armed — ${chicken.note}.`);
  // if the hand cannot legally win yet, say plainly how it gets there
  const fih = fanInHand({ melds, bonus: ctx.bonus, seat: ctx.seat, prevailingWind: ctx.prevailingWind });
  if (fih < ctx.minimumFan) {
    const routes = fanRoutes(concealed, ctx);
    if (routes.length) {
      const r = routes[0]!;
      detail.push(`You are ${ctx.minimumFan - fih} tai short. Your ${WIND_OR_DRAGON[r.tile] ?? ''} pair is the way out — ponging it is worth ${r.fan} tai${r.double ? ' (門風 + 圈風 double)' : ''}, which arms the hand.`);
    } else {
      detail.push(`You are ${ctx.minimumFan - fih} tai short and hold no value pair — the tai has to come from a flower, an animal, or a colour hand.`);
    }
  }
  const tied = opts.filter((o) => o.delta > -0.05).map((o) => o.tile);
  return { options: opts, plan, planDetail: detail, best: top, tied };
}

/** copies of each kind not visible in your own hand or any meld (a rough "still out there" count) */
function unseenOf(concealed: TileKind[], melds: Meld[]): number[] {
  const u = new Array(34).fill(4);
  for (const k of concealed) if (k < 34) u[k]--;
  for (const m of melds) for (const k of m.tiles) if (k < 34) u[k]--;
  return u;
}
// only All-Pong forbids sequences; Half-Color is one suit + honours and may still chow, so neighbours matter there
const PONG_PLAN = (id: string) => id === 'all_pong';

function reasonsFor(k: TileKind, concealed: TileKind[], melds: Meld[], ctx: Context, target: TargetEval, unseen: number[]): string[] {
  const r: string[] = [];
  const count = concealed.filter((x) => x === k).length;
  const pairs = new Set(concealed.filter((x) => concealed.filter((y) => y === x).length === 2));
  if (count === 2 && pairs.size === 1) r.push('breaks your only pair');
  if (count >= 3) r.push('breaks a completed set');
  if (PONG_PLAN(target.id)) {
    // in an All-Pong plan neighbours are worthless: what matters is whether a tile can still become a set
    const left = k < 34 ? unseen[k]! : 0;
    if (count === 2) r.push(`pair — ${left} left to make the pong`);
    else if (count === 1) r.push(left <= 1 ? `single, only ${left} left — it will not pair up` : `single — needs ${left > 0 ? left : 0} more, and neighbours do not help in a pong hand`);
    if (isHonour(k) && count === 1) r.push('lone honour');
    r.push(...valueTileReasons(k, count, ctx));
    return r;
  }
  if (isHonour(k) && count === 1) r.push('lone honour');
  r.push(...valueTileReasons(k, count, ctx));
  if (isSuited(k)) {
    const rk = rankOf(k), su = suitOf(k);
    const near = concealed.filter((x) => x !== k && suitOf(x) === su && Math.abs(rankOf(x) - rk) <= 2).length;
    if (near === 0 && count === 1) r.push('isolated — no neighbours');
    if (isTerminal(k)) r.push('edge tile (1/9): fewest ways to connect');
    if (rk >= 3 && rk <= 7 && near > 0) r.push('middle tile with neighbours — flexible');
    if (target.id === 'half_color' && target.suit && su === target.suit) r.push(`in your ${SUIT_NAME[target.suit as keyof typeof SUIT_NAME]} suit`);
    if (target.id === 'half_color' && target.suit && su !== target.suit) r.push('outside your suit');
  }
  if (melds.length) { /* nothing extra for now */ }
  return r;
}
/** why an honour matters here: dragons, your seat wind, the round wind - and the double when they coincide */
function valueTileReasons(k: TileKind, count: number, ctx: Context): string[] {
  const isSeat = k === windKind(ctx.seat), isRound = k === windKind(ctx.prevailingWind);
  const out: string[] = [];
  if (isSeat && isRound) out.push(count >= 2 ? 'your DOUBLE wind (門風 + 圈風) — pong it for 2 fan and the hand is armed' : 'your double wind — a pong here is worth 2 fan');
  else if (isSeat) out.push(count >= 2 ? 'seat wind pair — one more is 1 fan' : 'your seat wind — 1 fan as a pong');
  else if (isRound) out.push(count >= 2 ? 'round wind pair — one more is 1 fan' : 'round wind — 1 fan as a pong');
  else if (isDragon(k)) out.push(count >= 2 ? 'dragon pair — one more is 1 fan' : 'dragon — 1 fan as a pong');
  return out;
}
const fmt = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(1);
export { kindName };
