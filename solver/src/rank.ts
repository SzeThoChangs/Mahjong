/** Rank the 14 possible discards and explain the choice in plain language. */
import {
  isDragon, isHonour, isSuited, isTerminal, kindName, rankOf, suitOf, windKind, type Meld, type TileKind,
} from 'sg-mahjong-engine';
import { handValue, type Context, type TargetEval } from './targets.js';
import { rule4213, rule5313, rule961, type HandInput } from './evaluators.js';

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
}

const SUIT_NAME = { wan: '萬', tong: '筒', sok: '條' } as const;
const TARGET_NAME: Record<string, string> = { ping_wu: 'Ping Wu', all_chow: 'All-Chow', half_color: 'Half-Color', all_pong: 'All-Pong', chicken: 'Chicken', thirteen: '13 Wonders' };

/** how many tile kinds (weighted by copies left) would raise the best target's evaluator */
function acceptance(h: HandInput, best: TargetEval): number {
  const evalFor = (x: HandInput): number => {
    if (best.id === 'half_color') return rule961(x).value;
    if (best.id === 'ping_wu' || best.id === 'all_chow') return rule5313(x).value;
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
    o.reasons = reasonsFor(o.tile, concealed, melds, ctx, top.target);
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
  return { options: opts, plan, planDetail: detail, best: top };
}

function reasonsFor(k: TileKind, concealed: TileKind[], melds: Meld[], ctx: Context, target: TargetEval): string[] {
  const r: string[] = [];
  const count = concealed.filter((x) => x === k).length;
  const pairs = new Set(concealed.filter((x) => concealed.filter((y) => y === x).length === 2));
  if (count === 2 && pairs.size === 1) r.push('breaks your only pair');
  if (count >= 3) r.push('breaks a completed set');
  if (isHonour(k)) {
    if (count === 1) r.push('lone honour');
    if (isDragon(k)) r.push('dragon — worth 1 Fan as a pong');
    if (k === windKind(ctx.seat)) r.push('your seat wind — worth 1 Fan as a pong');
    if (k === windKind(ctx.prevailingWind)) r.push('prevailing wind — worth 1 Fan as a pong');
  }
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
const fmt = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(1);
export { kindName };
