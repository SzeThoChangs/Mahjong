/** Rank the 14 possible discards and explain the choice in plain language. */
import {
  fanInHand, isDragon, isHonour, isJoker, isSuited, isTerminal, kindName, rankOf, scoreHand, shanten, suitOf, windKind, type Meld, type TileKind,
} from 'sg-mahjong-engine';
import { handValue, fanRoutes, valueOfTargetAt, type Context, type TargetEval } from './targets.js';
import { allPongBreakdown, rule4213, rule5313, rule961, type HandInput } from './evaluators.js';
import { dealInChance, threatScale, maxReadyChance } from './reads.js';

export type Verdict = 'best' | 'fine' | 'mistake' | 'blunder';
export interface DiscardOption {
  tile: TileKind; chips: number; delta: number; verdict: Verdict;
  target: TargetEval; acceptance: number; reasons: string[];
  /** chips this throw concedes on average, from the measured deal-in reads */
  risk: number;
}
/** The cheap legal win to fall back on, and what in the hand keeps it available. */
export interface Bailout {
  target: string;              // usually Chicken
  enabler: TileKind | null;    // the value pair that makes it legal (e.g. your double wind)
  enablerFan: number;
  chips: number;               // what the bailout is worth right now
  switchBelow: number | null;  // primary evaluator score at which the bailout overtakes it
}
export interface Ranking {
  options: DiscardOption[];           // sorted best first
  plan: string;                        // one-line plan statement
  planDetail: string[];                // bullet lines
  best: DiscardOption;
  /** tiles that are equal-best within noise - naming one of them as 'the' answer would be arbitrary */
  tied: TileKind[];
  /** the fallback plan and its trigger, when the primary is not the cheap one */
  bailout: Bailout | null;
  /** the hand cannot reach the table minimum by any route, so the ranking is by safety alone */
  folding: boolean;
}

const WIND_OR_DRAGON: Record<number, string> = { 27: '\u6771', 28: '\u5357', 29: '\u897f', 30: '\u5317', 31: '\u4e2d', 32: '\u767c', 33: '\u767d' };
const SUIT_NAME = { wan: '萬', tong: '筒', sok: '條' } as const;
const TARGET_NAME: Record<string, string> = { ping_wu: 'Ping Wu', all_chow: 'All-Chow', half_color: 'Half-Color', all_pong: 'All-Pong', chicken: 'Chicken', thirteen: '13 Wonders' };

/**
 * What throwing this tile risks, in chips.
 *
 * The coach used to advise as if it were playing solitaire: it valued what a discard did to its own
 * hand and never asked what it hands the table. `READS` are measured on 574,775 real decisions and
 * say two things the discard pool alone can answer:
 *   - a tile already on the floor is 2-5x safer than a fresh one (simple at turn 40: 3.07% -> 1.75%,
 *     honours 0.76% -> 0.16%), because the players who could use it have passed on it
 *   - a player with three exposed sets is ready 39.5% of the time against 4.9% with none
 *
 * The two combine: base deal-in chance for the tile's class, freshness and turn, scaled by how
 * ready this particular table looks against an average one. DEAL_IN_COST turns that probability
 * into chips; it is swept against measured play-outs rather than guessed.
 */
// Fitted against measured play-outs, not derived: sweeping it moves the coach's agreement 54.5% ->
// 55.7% with a clear peak near 40 and a decline past 70, so it is a real optimum rather than "more
// caution is always better". It is larger than an actual deal-in costs at this table, which means
// it is also standing in for the other reasons a already-safe tile tends to be a good throw.
const DANGER_WEIGHT = 40;

function dealInChips(k: TileKind, ctx: Context, gone: number[]): number {
  if (isJoker(k)) return 0;
  return dealInChance(k, ctx.playerTurns, gone[k] ?? 0, ctx.reads) * threatScale(ctx.opponentMelds, ctx.playerTurns, ctx.reads) * (ctx.dangerWeight ?? DANGER_WEIGHT);
}

/** Say out loud what the discard pool means for this tile, so the advice can be argued with. */
function safetyReason(k: TileKind, ctx: Context, gone: number[]): string | null {
  if (isJoker(k)) return null;
  const seen = gone[k] ?? 0;
  const risk = dealInChips(k, ctx, gone);
  if (seen > 0) return `${seen === 1 ? 'one is' : `${seen} are`} already on the floor — safer to follow`;
  if (risk >= 0.6) return 'nobody has thrown one yet — the risky kind to break with';
  return null;
}

/** How many tile kinds (weighted by copies left) would improve the hand FOR THE PLAN IT IS PLAYING.
 *  Using the wrong evaluator here silently applies chow logic to a pong hand (and vice versa),
 *  which shows up as a phantom preference between tiles the plan values identically. */
function acceptance(h: HandInput, best: TargetEval, gone: number[] = []): number {
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
    // a tile whose copies are all on the table cannot arrive, however much it would help
    const left = 4 - (held.get(k) ?? 0) - h.melds.reduce((a, m) => a + m.tiles.filter((t) => t === k).length, 0) - (gone[k] ?? 0);
    if (left <= 0) continue;
    if (evalFor({ concealed: [...h.concealed, k], melds: h.melds }) > base) n += left;
  }
  return n;
}

/**
 * The wait, counted in tiles that can ACTUALLY win.
 *
 * `acceptance` above counts tiles that improve the hand, which is the right question until the hand
 * is ready and the wrong one afterwards. At a 2-tai table a tile that completes the hand at 1 tai
 * completes nothing - you cannot declare it - so counting it makes a wide worthless wait beat a
 * narrow real one. This is `narrow_can_beat_wide` from the tactics book, and it is one of the few
 * tips there that exists BECAUSE of a table minimum rather than in spite of one.
 *
 * A tile that reaches the minimum only on a self-draw is not dead, only narrower: it can come off
 * the wall but not off a discard. It is weighted by the measured self-draw share of wins in
 * run-money4 - 59,392 of 126,273, so 0.47 - rather than by a number chosen to make this look good.
 *
 * Returns null when the hand is not ready, where ordinary acceptance is still the right measure.
 */
const SELF_DRAW_SHARE = 0.47;
function legalWait(h: HandInput, ctx: Context, gone: number[]): number | null {
  if (shanten(h.concealed, h.melds.length) !== 0) return null;
  let n = 0;
  const held = new Map<TileKind, number>();
  for (const k of h.concealed) held.set(k, (held.get(k) ?? 0) + 1);
  for (let k = 0; k < 34; k++) {
    const left = 4 - (held.get(k) ?? 0) - h.melds.reduce((a, m) => a + m.tiles.filter((t) => t === k).length, 0) - (gone[k] ?? 0);
    if (left <= 0) continue;
    const win = {
      concealed: [...h.concealed, k], melds: h.melds, bonus: [...ctx.bonus],
      seat: ctx.seat, prevailingWind: ctx.prevailingWind, winningTile: k,
    };
    // scored both ways on purpose: the all-chow rules reject some hands on a DISCARD that are fine
    // self-drawn, so a tile can be live off the wall and dead off the floor
    const shot = scoreHand({ ...win, selfDraw: false });
    if (shot.valid && shot.fan >= ctx.minimumFan) { n += left; continue; }
    const drawn = scoreHand({ ...win, selfDraw: true });
    if (drawn.valid && drawn.fan >= ctx.selfDrawMinimumFan) n += left * SELF_DRAW_SHARE;
  }
  return n;
}

/**
 * FOLDING. Two triggers, both off by default and both measured.
 *
 * `fold: true` gives up when the hand has no route to the table minimum. It LOSES 0.039 +/- 0.018
 * chips a game - the wrong question, because a hand that is unarmed now can still draw the flower
 * that arms it.
 *
 * `fold: { ready, shanten }` is the real rule as it is played: give up when somebody is probably
 * about to win AND this hand is still a long way off. Both halves are required - a dangerous table
 * is no reason to stop building a hand that is nearly there, and a hopeless hand costs nothing to
 * keep building while nobody is close.
 */
export function rankDiscards(concealed: TileKind[], melds: Meld[], ctx: Context, cfg: { fold?: boolean | { ready: number; shanten: number }; legalWait?: boolean } = {}): Ranking {
  const threatFold = typeof cfg.fold === 'object' ? cfg.fold : null;
  const foldEnabled = cfg.fold === true;
  const allJokers = concealed.every(isJoker);
  const kinds = [...new Set(concealed)].filter((k) => allJokers || !isJoker(k));   // never offer a wildcard as a discard
  // copies of each kind already face-up somewhere other than this player's own hand and melds
  const gone = new Array<number>(34).fill(0);
  for (const k of ctx.visible ?? []) if (k < 34) gone[k]!++;
  const opts: DiscardOption[] = [];
  const hands = new Map<TileKind, HandInput>();
  for (const k of kinds) {
    const rest = [...concealed]; rest.splice(rest.indexOf(k), 1);
    const h = { concealed: rest, melds };
    hands.set(k, h);
    const hv = handValue(h, ctx);
    opts.push({ tile: k, chips: hv.chips, delta: 0, verdict: 'fine', target: hv.best, acceptance: 0, reasons: [], risk: 0 });
  }
  // GIVING UP. A hand with no route to the table minimum - no value pair to pong, no flower or
  // animal left to draw - wins nothing however well it is played, so every tile it throws is pure
  // risk with no return. At that point the only question left is which throw is safest. This is
  // the fold: it is decided on whether winning is still POSSIBLE, not on how dangerous the table
  // looks, which is what `DefensiveBot` keys on and why nothing in the run ever folded.
  const folding = threatFold
    ? maxReadyChance(ctx.opponentMelds, ctx.playerTurns, ctx.reads) >= threatFold.ready && shanten(concealed, melds.length) >= threatFold.shanten
    : foldEnabled && kinds.every((k) => handValue(hands.get(k)!, ctx).all.every((t) => !t.armed));
  if (folding) {
    for (const o of opts) o.risk = dealInChips(o.tile, ctx, gone);
    opts.sort((a, b) => a.risk - b.risk);
    const safest = opts[0]!;
    for (const o of opts) {
      o.chips = -o.risk;
      o.delta = -(o.risk - safest.risk);
      o.verdict = o === safest ? 'best' : o.delta > -0.75 ? 'fine' : o.delta > -2.5 ? 'mistake' : 'blunder';
      o.reasons = [threatFold
        ? `someone is probably ready and this hand is ${shanten(concealed, melds.length)} away - playing for safety`
        : `the hand cannot reach ${ctx.minimumFan} tai by any route - playing for safety`];
      const sr = safetyReason(o.tile, ctx, gone); if (sr) o.reasons.push(sr);
    }
    return {
      options: opts, best: safest, tied: opts.filter((o) => o.risk <= safest.risk + 0.05).map((o) => o.tile),
      plan: 'Fold', bailout: null, folding: true,
      planDetail: [
        threatFold
          ? `An opponent is about ${Math.round(100 * maxReadyChance(ctx.opponentMelds, ctx.playerTurns, ctx.reads))}% likely to be ready and this hand is still ${shanten(concealed, melds.length)} tiles away.`
          : `No route to ${ctx.minimumFan} tai: nothing to pong for Fan, and no flower or animal left to draw in time.`,
        'The hand cannot be won, so it is played for damage: throw what is least likely to pay someone else.',
        `Safest here is ${kindName(safest.tile)} at about ${fmt(safest.risk)} chips of risk.`,
      ],
    };
  }
  opts.sort((a, b) => b.chips - a.chips);
  // acceptance (what improves next draw) is the expensive part: only compute it where it can change the order
  const cutoff = opts[0]!.chips - 1.5;
  for (const o of opts) {
    if (o.chips < cutoff) break;
    const h = hands.get(o.tile)!;
    // once ready, count what can legally win instead of what merely improves - same scale, so no
    // new constant to tune and the comparison is of one idea, not of an idea plus a weight.
    // ON by default since 2026-09-01: +0.048 +/- 0.013 chips/game over 90,000 paired deals on
    // twelve wall seeds. Pass `legalWait: false` to play the old way, which is how it is measured.
    o.acceptance = (cfg.legalWait === false ? null : legalWait(h, ctx, gone)) ?? acceptance(h, o.target, gone);
    o.chips += o.acceptance * 0.06;
  }
  // what the throw hands the table, priced in the same chips as what it does for the hand
  for (const o of opts) { o.risk = dealInChips(o.tile, ctx, gone); o.chips -= o.risk; }
  opts.sort((a, b) => b.chips - a.chips);
  const top = opts[0]!;
  for (const o of opts) {
    o.delta = o.chips - top.chips;
    o.verdict = o === top ? 'best' : o.delta > -0.75 ? 'fine' : o.delta > -2.5 ? 'mistake' : 'blunder';
    o.reasons = reasonsFor(o.tile, concealed, melds, ctx, top.target, unseenOf(concealed, melds, gone));
    const safety = safetyReason(o.tile, ctx, gone);
    if (safety) o.reasons.push(safety);
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

  // ---- the bailout: the cheap legal win, and the tile that keeps it available ----
  let bailout: Bailout | null = null;
  const restAfterBest = (() => { const r = [...concealed]; r.splice(r.indexOf(top.tile), 1); return r; })();
  const cheap = hvAll.find((x) => x.id === 'chicken');
  if (cheap && t.id !== 'chicken') {
    const routes = fanRoutes(restAfterBest, ctx);
    const r0 = routes[0] ?? null;
    // at what primary score does the cheap plan overtake the current plan?
    let switchBelow: number | null = null;
    if (typeof t.value === 'number') {
      for (let v = Math.floor(t.value); v >= 0; v--) {
        const probe = valueOfTargetAt(t.id, v, ctx);
        if (probe !== null && probe <= cheap.chips) { switchBelow = v; break; }
      }
    }
    bailout = { target: 'Chicken', enabler: r0 ? r0.tile : null, enablerFan: r0?.fan ?? 0, chips: cheap.chips, switchBelow };
    if (r0) {
      detail.push(`Bail-out if this stalls: pong ${WIND_OR_DRAGON[r0.tile] ?? ''} (${r0.fan} tai${r0.double ? ', 門風 + 圈風 double' : ''}) and take a quick Chicken — worth about ${fmt(cheap.chips)}. Hold that pair: it is the only thing making the cheap win legal.`);
    }
    if (switchBelow !== null && typeof t.value === 'number') {
      detail.push(`Switch when ${plan} drops below score ${switchBelow} (it is ${t.value} now) — or if it has not improved by 第${Math.max(1, Math.ceil((ctx.playerTurns + 20) / 4))}巡.`);
    }
  }
  return { options: opts, plan, planDetail: detail, best: top, tied, bailout, folding: false };
}

/** copies of each kind not visible in your own hand or any meld (a rough "still out there" count) */
function unseenOf(concealed: TileKind[], melds: Meld[], gone: number[] = []): number[] {
  const u = new Array(34).fill(4);
  for (const k of concealed) if (k < 34) u[k]--;
  for (const m of melds) for (const k of m.tiles) if (k < 34) u[k]--;
  for (let k = 0; k < 34; k++) u[k] = Math.max(0, u[k] - (gone[k] ?? 0));   // discards and everyone's exposed melds
  return u;
}
// only All-Pong forbids sequences; Half-Color is one suit + honours and may still chow, so neighbours matter there
const PONG_PLAN = (id: string) => id === 'all_pong';

/**
 * Why this tile, in words the player can act on.
 *
 * Every option must come back with at least one reason. The Train tab used to fall back to printing
 * the internal plan id ("plan: chicken") when the list was empty, which happened on 12.6% of options
 * and on the coach's OWN pick in 8.1% of hands - so the "Why 5筒" line became a non-explanation.
 */
function reasonsFor(k: TileKind, concealed: TileKind[], melds: Meld[], ctx: Context, target: TargetEval, unseen: number[]): string[] {
  const r = reasonsForInner(k, concealed, melds, ctx, target, unseen);
  if (!r.length) r.push('no strong shape either way');
  return r;
}

function reasonsForInner(k: TileKind, concealed: TileKind[], melds: Meld[], ctx: Context, target: TargetEval, unseen: number[]): string[] {
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
  if (isHonour(k) && count === 2) r.push('honour pair — one more makes the pong');
  r.push(...valueTileReasons(k, count, ctx));
  if (isSuited(k)) {
    const rk = rankOf(k), su = suitOf(k);
    const near = concealed.filter((x) => x !== k && suitOf(x) === su && Math.abs(rankOf(x) - rk) <= 2).length;
    if (near === 0 && count === 1) r.push('isolated — no neighbours');
    // 2 and 8 sit in neither the terminal branch nor the 3-7 middle branch, so they used to come
    // back with nothing at all - 89% of the empty-reason cases. They are genuinely in between: a 2
    // can only live in 1-2-3 or 2-3-4, where a 5 has three sequences open to it.
    if (isTerminal(k)) r.push('edge tile (1/9): fewest ways to connect');
    else if (rk === 2 || rk === 8) r.push(near > 0 ? 'next to the edge (2/8): only two sequences use it' : 'next to the edge (2/8): few ways to connect');
    else if (rk >= 3 && rk <= 7 && near > 0) r.push('middle tile with neighbours — flexible');
    else if (rk >= 3 && rk <= 7) r.push('middle tile, but nothing beside it yet');
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
