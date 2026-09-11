/**
 * Judge one decision by play-outs, with nothing in it that needs node.
 *
 * This is the loop that grades every dataset and admits every quiz question: for each legal
 * action, re-deal everything the acting seat cannot see, take the action, let fast bots play the
 * hand out, and keep the money. It lived in `datagen/src/evaluate.ts`, which imports worker threads
 * and the file system, so the only place it could run was the Mac. The Challenge button on the
 * Train tab wants the same judgement on a phone with no server behind it, so the loop moved here
 * and datagen now calls it. One implementation, two callers - the pack builder's output is
 * unchanged to the byte, which `datagen/src/rejudgecheck.ts` and a before/after pack build confirm.
 *
 * Two things make the numbers usable rather than merely honest.
 *
 * Common random numbers: play-out i deals every action the same hidden state and the same bot
 * dice, so the difference between two actions is measured on paired games rather than on two
 * independent samples. The paired standard error of that gap is what a verdict rests on.
 *
 * Coupling that survives a claim: the bots draw their randomness from a stream keyed to the
 * POSITION in front of them rather than to how many draws preceded it, so two branches that reach
 * the same position draw the same numbers however differently they got there. Without this the
 * pairing decays to a correlation of 0.42 on discards and 0.11 on claims, and the paired error bar
 * is a full chip at 128 play-outs. See `CoupledBot`.
 */
import {
  GameState, IsolationBot, ShantenBot, makeRng, tableConfigOf, isBonus, kindOf,
  type Bot, type ClaimOption, type LegalAction, type PlayerView, type RulesConfig, type SelfAction, type Snapshot, type TileInstance,
} from 'sg-mahjong-engine';
import { CoachBot } from './bot.js';

/** FNV-1a 32-bit over a string. The same function `datagen/src/records.ts` uses, and it must stay
 *  the same: every hidden state and every bot seed in every recorded run is keyed by it. */
export function fnv1a(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** compact action string; instance ids are engine-internal and dropped:
 *  "d:5" "win" "kong4:12" "kong1:12" "proceed" "pass" "pong:7" "kong3:7" "chow:3,4,5" */
export function encAction(a: LegalAction): string {
  switch (a.a) {
    case 'discard': return `d:${a.kind}`;
    case 'kong4': case 'kong1': case 'kong3': case 'pong': return `${a.a}:${a.kind}`;
    case 'chow': return `chow:${a.kinds.join(',')}`;
    default: return a.a;
  }
}

/** Outcome mix for one action, from the acting seat's point of view.
 *  `w` keys are `<role><fan>` where role is: W self-draw win, D discard win, s pays the shooter share,
 *  o pays the other share, z pays a self-draw share, l pays everything (pay-all), n pays nothing, d draw.
 *  `led` is the summed ledger units (kongConcealed, kongExposed, kongFed, biteFH, biteFO, biteAH, biteAO).
 *  Together these let any money schedule be priced later without re-simulating. */
export interface OutcomeMix { w: Record<string, number>; led: [number, number, number, number, number, number, number] }
/** What the play-outs say about one action. `gap` = EV(best) - EV(this); `gapSe` is the standard
 *  error of that gap computed on PAIRED play-outs (the same hidden states). */
export interface ActionEval { a: string; ev: number; sd: number; win: number; dealin: number; draw: number; n: number; gap: number; gapSe: number; mix?: OutcomeMix }
/** The same, still carrying every play-out's outcome so any two actions can be paired afterwards. */
export interface RejudgedAction extends ActionEval { outcomes: number[] }

/**
 * Who plays the hand out after the tile under test is thrown. This decides every label: an EV
 * means "worth this much IF PLAY CONTINUES LIKE THIS BOT", never "worth this much".
 *
 * `shanten` is the one that grades datasets and packs. `coach` is 120x slower and exists so a small
 * sample can be graded by the bot the positions came from. `fast` is the older isolation bot. A
 * caller with a bot of its own passes a factory instead of a name.
 */
export type RolloutPolicy = 'fast' | 'shanten' | 'coach';
export type BotFactory = (rng: () => number) => Bot;

const positionKey = (v: PlayerView, kind: string, extra = ''): string =>
  `${kind}:${v.playerTurns}:${v.discardLog.length}:${v.melds.length}:${v.hand.map(kindOf).sort((x, y) => x - y).join('.')}${extra}`;

/** A bot whose randomness is re-keyed from the position in front of it before every decision. */
class CoupledBot implements Bot {
  private inner: Bot; private reseed: (key: string) => void;
  constructor(inner: Bot, reseed: (key: string) => void) { this.inner = inner; this.reseed = reseed; }
  chooseDiscard(v: PlayerView): TileInstance {
    this.reseed(positionKey(v, 'd'));
    return this.inner.chooseDiscard(v);
  }
  chooseSelfAction(v: PlayerView, o: SelfAction[]): SelfAction | null {
    this.reseed(positionKey(v, 's', `:${o.map((x) => x.kind).join('|')}`));
    return this.inner.chooseSelfAction(v, o);
  }
  chooseClaim(v: PlayerView, o: ClaimOption[]): ClaimOption | null {
    this.reseed(positionKey(v, 'c', `:${v.lastDiscard ? kindOf(v.lastDiscard.tile) : -1}:${o.map((x) => x.kind).join('|')}`));
    return this.inner.chooseClaim(v, o);
  }
}

/** The four bots that play a hand out, seeded so that play-out i is the same game for every action. */
export function rolloutBots(policy: RolloutPolicy | BotFactory, seed: number, coupled = true): Bot[] {
  const build: BotFactory = typeof policy === 'function' ? policy
    : policy === 'fast' ? (rng) => new IsolationBot(rng, 0.6, 0.4)
    : policy === 'shanten' ? (rng) => new ShantenBot(rng)
    : () => new CoachBot();
  return [0, 1, 2, 3].map((s) => {
    if (!coupled) return build(makeRng(seed * 4 + s));
    let stream = makeRng(seed * 4 + s);                                    // until the first decision re-keys it
    return new CoupledBot(build(() => stream()), (key) => { stream = makeRng(fnv1a(`${seed}:${s}:${key}`)); });
  });
}

/**
 * Re-deal everything `seat` cannot see. Returns a new Snapshot (the input state is untouched),
 * consistent with the visible state: hand sizes, melds, bonus, discards and the wall's size.
 *
 * `canonical` draws the unseen tiles in kind order rather than in the wall's recorded order. Two
 * positions that show the same tiles then re-deal the same KINDS for the same rng, whatever
 * numbers their tile instances carry - which is what lets a position rebuilt from a question be
 * checked against the recorded one play-out by play-out rather than within noise. Off by default,
 * because every recorded evaluation was made in wall order and must stay reproducible.
 */
export function determinize(g: GameState, seat: number, rng: () => number, canonical = false): Snapshot {
  const snap = g.snapshot();
  const visible = new Set<TileInstance>();
  for (const p of snap.players) {
    if (p.seat === seat) for (const t of p.hand) visible.add(t);
    for (const m of p.melds) for (const t of m.instances) visible.add(t);
    for (const t of p.bonus) visible.add(t);
    for (const t of p.discards) visible.add(t);
  }
  // tiles already drawn from the wall but not visible are exactly the opponents' concealed tiles;
  // the unseen pool = everything not visible
  const unseen: TileInstance[] = [];
  for (const t of snap.wall.order) if (!visible.has(t)) unseen.push(t);     // the wall order holds every tile in this game (148 or 152)
  if (canonical) unseen.sort((x, y) => kindOf(x) - kindOf(y) || x - y);
  for (let i = unseen.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [unseen[i], unseen[j]] = [unseen[j]!, unseen[i]!]; }
  // opponents' hands: standard tiles only (bonus tiles would have been exposed on draw)
  const standard = unseen.filter((t) => !isBonus(kindOf(t)));
  const bonus = unseen.filter((t) => isBonus(kindOf(t)));
  let si = 0;
  for (const p of snap.players) {
    if (p.seat === seat) continue;
    const n = p.hand.length;
    p.hand = standard.slice(si, si + n); si += n;
  }
  // the rest fills the wall's live region [front..back] in random order (bonus tiles mixed back in)
  const rest = [...standard.slice(si), ...bonus];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j]!, rest[i]!]; }
  const { front, back } = snap.wall;
  if (rest.length !== back - front + 1) throw new Error(`determinize: unseen ${rest.length} != wall region ${back - front + 1}`);
  const order = [...snap.wall.order];
  for (let i = 0; i < rest.length; i++) order[front + i] = rest[i]!;
  snap.wall = { ...snap.wall, order };
  if (snap.phase === 'claim') {
    // other seats' queued claim options referenced their old tiles, and their (hidden) intentions must be re-decided:
    // rebuild the claim phase from the visible facts, with the acting seat asked first.
    const h = GameState.fromSnapshot(snap, tableConfigOf(g.rules), { rules: g.rules });
    h.rebuildClaims(seat);
    return h.snapshot();
  }
  return snap;
}

/** The mean paired difference a - b over the play-outs both have, and its standard error. */
export function pairedGap(a: { outcomes: number[] }, b: { outcomes: number[] }): { gap: number; se: number; k: number } {
  let m = 0, m2 = 0, k = 0;
  for (let i = 0; i < Math.min(a.outcomes.length, b.outcomes.length); i++) {
    const x = a.outcomes[i], y = b.outcomes[i]; if (x === undefined || y === undefined) continue;
    const d = x - y; m += d; m2 += d * d; k++;
  }
  const gap = k ? m / k : 0, gapVar = k > 1 ? Math.max(0, m2 / k - gap * gap) * k / (k - 1) : 0;   // Bessel: population -> unbiased sample variance
  return { gap, se: Math.sqrt(gapVar / Math.max(1, k)), k };
}

export interface RejudgeOptions {
  /** play-outs per action (the ceiling, when `adaptive`) */
  rollouts: number;
  seed: number;
  /** names the decision - `g:h:d` for a recorded one - so its hidden states are reproducible and
   *  different from every other decision's under the same seed */
  key: string;
  policy?: RolloutPolicy | BotFactory;
  /** position-keyed bot randomness (default); false reproduces runs from before 2026-08-26 */
  coupled?: boolean;
  /** successive halving: everyone gets a quarter; the top half gets up to half; the top quarter the lot */
  adaptive?: boolean;
  /** play the recorded hidden state rather than re-dealing it - ground truth, for calibration only */
  oracle?: boolean;
  /** re-deal in kind order, so two positions showing the same tiles get the same deals - see `determinize` */
  canonical?: boolean;
  /** called after every play-out; `total` is the ceiling, which halving may not spend */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Judge every action in `legal` from the position in `base`, for the seat that is to act.
 *
 * Returns one entry per distinct action (discards of the same kind are one decision), in the order
 * given, each with its gap to the best of them on paired play-outs. Callers sort as they please.
 */
export function rejudge(base: Snapshot, rules: RulesConfig, seat: number, legal: LegalAction[], o: RejudgeOptions): RejudgedAction[] {
  const cfg = tableConfigOf(rules);
  const policy = o.policy ?? 'shanten', coupled = o.coupled !== false;
  // dedupe discard actions by kind (same kind, different instance are identical decisions)
  const distinct: LegalAction[] = []; const seenKinds = new Set<string>();
  for (const l of legal) { const k = encAction(l); if (seenKinds.has(k)) continue; seenKinds.add(k); distinct.push(l); }

  // play-out i uses hidden state i and bot seeds i for EVERY action (common random numbers)
  const hiddenCache = new Map<number, Snapshot>();
  const hidden = (i: number): Snapshot => {
    if (o.oracle) return base;
    let h = hiddenCache.get(i);
    if (!h) { const rSeed = fnv1a(`${o.key}:${i}:${o.seed}`); h = determinize(GameState.fromSnapshot(base, cfg, { rules }), seat, makeRng(rSeed), o.canonical); hiddenCache.set(i, h); }
    return h;
  };
  const acc = distinct.map((act) => ({ act, key: encAction(act), sum: 0, sumsq: 0, win: 0, dealin: 0, draw: 0, n: 0, outcomes: [] as number[], mix: { w: {} as Record<string, number>, led: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number] } }));
  const total = o.rollouts * acc.length;
  let done = 0;
  const roll = (x: typeof acc[number], i: number) => {
    const rSeed = fnv1a(`${o.key}:${i}:${o.seed}`);
    const h = GameState.fromSnapshot(hidden(i), cfg, { rules });
    h.apply(x.act);
    const res = h.run(rolloutBots(policy, rSeed ^ 0x5bd1e995, coupled));
    const v = res.chipsDelta[seat]!; x.sum += v; x.sumsq += v * v; x.n++; x.outcomes[i] = v;
    if (res.winner === seat) x.win++; else if (res.winner === null) x.draw++; else if (res.discarder === seat) x.dealin++;
    // record the outcome in re-priceable form
    const L = res.ledger[seat]!;
    x.mix.led[0] += L.kongConcealed; x.mix.led[1] += L.kongExposed; x.mix.led[2] += L.kongFed;
    x.mix.led[3] += L.biteFlowerHidden; x.mix.led[4] += L.biteFlowerOpen; x.mix.led[5] += L.biteAnimalHidden; x.mix.led[6] += L.biteAnimalOpen;
    let role: string;
    if (res.winner === null) role = 'd';
    else if (res.winner === seat) role = res.selfDraw || res.score?.combination === 'shi_san_yao' ? 'W' : 'D';
    else if (res.liable !== null) role = res.liable === seat ? 'l' : 'n';
    else if (res.selfDraw || res.score?.combination === 'shi_san_yao') role = 'z';
    else role = res.discarder === seat ? 's' : 'o';
    const key = role + (res.score?.fan ?? 0);
    x.mix.w[key] = (x.mix.w[key] ?? 0) + 1;
    o.onProgress?.(++done, total);
  };
  if (!o.adaptive || acc.length <= 2) {
    for (const x of acc) for (let i = 0; i < o.rollouts; i++) roll(x, i);
  } else {
    // successive halving: everyone gets n0; the top half gets up to 2n0; the top quarter up to 4n0 (= rollouts)
    const n0 = Math.max(4, Math.ceil(o.rollouts / 4));
    let alive = [...acc]; let target = n0;
    while (true) {
      for (const x of alive) for (let i = x.n; i < target; i++) roll(x, i);
      if (alive.length <= 2 || target >= o.rollouts) break;
      alive.sort((p, q) => q.sum / q.n - p.sum / p.n);
      alive = alive.slice(0, Math.max(2, Math.ceil(alive.length / 2)));
      target = Math.min(o.rollouts, target * 2);
    }
  }
  const evOf = (x: typeof acc[number]) => x.sum / x.n;
  const bestAcc = acc.reduce((p, q) => (evOf(q) > evOf(p) ? q : p));
  return acc.map((x) => {
    const ev = evOf(x);
    // paired gap to the best action over the play-out indices both have
    const { gap, se } = pairedGap(bestAcc, x);
    return { a: x.key, ev, sd: Math.sqrt(Math.max(0, x.sumsq / x.n - ev * ev)), win: x.win / x.n, dealin: x.dealin / x.n, draw: x.draw / x.n, n: x.n, gap, gapSe: se, mix: x.mix, outcomes: x.outcomes };
  });
}
