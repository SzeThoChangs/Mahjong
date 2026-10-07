/**
 * Does a fitted discard policy take money off the Coach at Changs's table? The gate for the week.
 *
 *   tsx src/policymoney.ts 2000 --weights ../data/gen/coach2/policy-a.json --field coach --from 7900001
 *   tsx src/policymoney.ts 200  --self                                                  (must print 0.000)
 *
 * Paired deals, the same seat rotated through all four chairs, one thing different: arm A is the
 * shipped no-Joker Coach, arm B is the same Coach with its discards chosen by the weights in
 * `--weights`. Claims, kongs and wins go through the Coach in both arms, so the result is the
 * discard policy and nothing else. `--field coach` puts three shipped Coaches in the other chairs
 * (`--field pool`, the recorded personality bots, was dropped on 2026-10-04: no measurement rests
 * on simple bots any more, by Changs's rule); both arms see the same three with the
 * same random streams. Reported as B minus A in chips a game.
 *
 * `--self` plays arm B with the Coach's own discards, which must return exactly 0.000: the loop
 * plays the same game twice, and anything else is a bug in this file, not a result. The table is the
 * recorded 0-Joker min-1 run's own rules; a different table needs `--dir`.
 */
import { readFileSync } from 'node:fs';
import { playGame, shuffleWall, makeRng, kindOf, tableConfigOf, type Bot, type PlayerView, type TileInstance } from 'sg-mahjong-engine';
import { AltReadsCoachBot, READS_NOWILD, meldsOf, policyRankWith, policyRank, rankDiscards, readsFor, claimRank, claimRankWith, claimAdvice, type PolicyWeights, type ClaimCandidate, type ClaimWeights } from 'sg-mahjong-solver';
import type { ClaimOption } from 'sg-mahjong-engine';
import { fnv1a } from './records.js';
import { rulesForDir } from './tablerules.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const n = Number(process.argv[2] ?? 2000);
const fieldKind = arg('field', 'coach');
const from = Number(arg('from', '7900001'));
const self = process.argv.includes('--self');
/** `--hybrid`: the Coach keeps the tile whenever its plan is a colour hand or the thirteen; the fit picks otherwise */
const hybrid = process.argv.includes('--hybrid');
/** `--claims`: the Coach as shipped, except that Pong, Chow, Kong or pass comes from the learned claim model */
const claims = process.argv.includes('--claims');
/**
 * `--pure`: arm B is the Coach as it was before 2026-09-28, its own numbers choosing the tile on
 * every plan (`rankDiscards` with `fitted: false`). Arm A is always the Coach as shipped, which
 * from that date carries candidate B inside `rankDiscards`, so `--pure` on the deals B was measured
 * on must return the mirror of B's figure: the check that the shipped integration is the thing
 * that was measured.
 */
const pure = process.argv.includes('--pure');
/**
 * `--chow <cost>`: the Coach as shipped, except that a Chow must improve the hand by this much before
 * it is called, instead of the shipped 0.4 chips (`OPEN_COST`). Pongs keep 0.4. The Pong bar was
 * swept on 2026-09-17 and nothing beat 0.4; the Chow bar has never been measured.
 */
const chowCost = process.argv.includes('--chow') ? Number(arg('chow', '0.4')) : null;
/**
 * `--colour-below <chips>`: the shipped Coach, except that on a half-colour plan the Coach's own
 * numbers rate below this many chips a game, the fitted policy chooses the tile as it does on cheap
 * plans. The sixth item of D-034 in its cheapest form: one number, swept for money, that moves the
 * line between "the Coach keeps the plan" and "the fit chooses" instead of a model choosing plans.
 */
const colourBelow = process.argv.includes('--colour-below') ? Number(arg('colour-below', '0')) : null;
/**
 * `--old <path to a solver src/index.ts>`: arm A is the Coach from another checkout of the code,
 * loaded beside this one, so a change to the Coach can be measured against the Coach as it was
 * without a flag in the shipped code pretending to be the old behaviour. Made for the counting fix
 * of 2026-10-01 (`visibleOf`): the old checkout must carry its own engine, because the wrap it had
 * lives there (`git worktree add <dir> <commit>`, then `ln -s ../../engine
 * <dir>/solver/node_modules/sg-mahjong-engine`).
 */
const oldPath = arg('old', '');
/** `--claim-weights <json>`: arm B is the shipped Coach with a candidate claim model in place of the shipped one */
const claimWeightsPath = arg('claim-weights', '');
const claimWeights: ClaimWeights | null = claimWeightsPath ? (JSON.parse(readFileSync(claimWeightsPath, 'utf8')) as ClaimWeights) : null;
const weightsPath = arg('weights', '');
const dir = arg('dir', '../data/gen/run-min1-nowild');

const rules = rulesForDir(dir);
const cfg = tableConfigOf(rules);
const reads = rules.jokers.count === 0 ? READS_NOWILD : readsFor(rules.jokers.count);
if (!self && !weightsPath && !claims && !claimWeights && !pure && chowCost === null && colourBelow === null && !oldPath) throw new Error('give --weights <json>, --claims, --claim-weights <json>, --pure, --chow <cost>, --colour-below <chips>, --old <path> or --self');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const old: any = oldPath ? await import(oldPath) : null;
const oldReads = old ? (rules.jokers.count === 0 ? old.READS_NOWILD : old.readsFor(rules.jokers.count)) : null;
const oldCoach = (): Bot => new old.AltReadsCoachBot(oldReads);
const weights: PolicyWeights | null = weightsPath ? (JSON.parse(readFileSync(weightsPath, 'utf8')) as PolicyWeights) : null;

/** The shipped Coach for this table, except that the discard comes from the fitted weights. */
class FittedDiscardBot extends AltReadsCoachBot {
  constructor(private readonly ws: PolicyWeights) { super(reads); }
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = policyRankWith(v.hand.map(kindOf), meldsOf(v), this.ctx(v), this.ws);
    return v.hand.find((t) => kindOf(t) === r.best) ?? super.chooseDiscard(v);
  }
}

/**
 * Candidate B: the fit is allowed to choose only inside the Coach's cheap plans.
 *
 * Candidate A won a quarter more hands and made almost nothing from them because it swapped
 * colour hands for chicken hands (the win mix, PROTOTYPE.md). The grades it was fitted to come
 * from play-outs that never collect a suit, so no feature can teach it otherwise. Here the Coach's
 * own plan decides: on a half-colour or thirteen-orphans plan the Coach's tile goes, on any other
 * plan the fit's. What the app explains stays the Coach's plan either way.
 */
class HybridBot extends AltReadsCoachBot {
  constructor(private readonly ws: PolicyWeights) { super(reads); }
  override chooseDiscard(v: PlayerView): TileInstance {
    const hand = v.hand.map(kindOf), melds = meldsOf(v), ctx = this.ctx(v);
    const r = rankDiscards(hand, melds, ctx);
    const plan = r.best.target.id;
    if (plan === 'half_color' || plan === 'thirteen') return v.hand.find((t) => kindOf(t) === r.best.tile)!;
    const m = policyRankWith(hand, melds, ctx, this.ws);
    return v.hand.find((t) => kindOf(t) === m.best) ?? v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

/**
 * The learned claim model, played for money at this table for the first time.
 *
 * `solver/src/claim.weights.ts` was fitted to 86.1% held-out accuracy and `ClaimBot` exists to play
 * it, but ClaimBot reads the table through the four-Joker danger table whatever the table is, so at
 * 0 Jokers it would be a handicapped Coach with a model on top. This is the same decision on the
 * shipped no-Joker Coach: a win is taken first, as every bot here does, then the model ranks pass
 * against the calls on offer. Discards stay the Coach's, so the result is the claim model alone.
 */
class LearnedClaimBot extends AltReadsCoachBot {
  constructor(private readonly weights: ClaimWeights | null = null) { super(reads); }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const offered = kindOf(v.lastDiscard!.tile);
    const ctx = this.ctx(v), melds = meldsOf(v), hand = v.hand.map(kindOf);
    const cands: (ClaimCandidate & { opt: ClaimOption | null })[] = [{ kind: 'pass', used: [], opt: null }];
    for (const o of options) {
      if (o.kind !== 'pong' && o.kind !== 'chow' && o.kind !== 'kong3') continue;
      cands.push({ kind: o.kind, used: (o.tiles ?? []).map(kindOf), opt: o });
    }
    if (cands.length === 1) return null;
    const plain = cands.map((c) => ({ kind: c.kind, used: c.used }));
    const r = this.weights ? claimRankWith(plain, hand, melds, offered, ctx, this.weights) : claimRank(plain, hand, melds, offered, ctx);
    const picked = cands.find((c) => c.kind === r.best.kind && c.used.join() === r.best.used.join());
    return picked?.opt ?? null;
  }
}

/** The Coach with the fitted policy switched off: what every money figure before 2026-09-28 was measured against. */
class PureCoachBot extends AltReadsCoachBot {
  constructor() { super(reads); }
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), this.ctx(v), { fitted: false });
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
  /** the claim rule as it was too, since D-036: a Kong on sight, otherwise the best call over OPEN_COST */
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kong = options.find((o) => o.kind === 'kong3'); if (kong) return kong;
    const usable = options.filter((o) => o.kind === 'pong' || o.kind === 'chow');
    if (!usable.length) return null;
    const cands: ClaimCandidate[] = usable.map((o) => ({ kind: o.kind as 'pong' | 'chow', used: (o.tiles ?? []).map(kindOf) }));
    const adv = claimAdvice([{ kind: 'pass', used: [] }, ...cands], v.hand.map(kindOf), meldsOf(v), kindOf(v.lastDiscard!.tile), this.ctx(v), { fitted: false });
    if (adv.best.kind === 'pass') return null;
    const i = cands.findIndex((c) => c.kind === adv.best.kind && c.used.join() === adv.best.used.join());
    return usable[i] ?? null;
  }
}

/** The shipped Coach with a different bar for Chows only; the same shape as the Pong sweep's bot. */
class ChowThresholdBot extends AltReadsCoachBot {
  constructor(private readonly cost: number) { super(reads); }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kong = options.find((o) => o.kind === 'kong3'); if (kong) return kong;
    const usable = options.filter((o) => o.kind === 'pong' || o.kind === 'chow');
    if (!usable.length) return null;
    const cands: ClaimCandidate[] = usable.map((o) => ({ kind: o.kind as 'pong' | 'chow', used: (o.tiles ?? []).map(kindOf) }));
    const adv = claimAdvice([{ kind: 'pass', used: [] }, ...cands], v.hand.map(kindOf), meldsOf(v), kindOf(v.lastDiscard!.tile), this.ctx(v));
    const call = adv.options.find((o) => o.candidate.kind !== 'pass' && o.gain > (o.candidate.kind === 'chow' ? this.cost : 0.4));
    if (!call) return null;
    const i = cands.findIndex((c) => c.kind === call.candidate.kind && c.used.join() === call.candidate.used.join());
    return usable[i] ?? null;
  }
}

/** The shipped Coach with the fit allowed onto weak colour plans: the Coach's own plan, then the fit's
 *  tile whenever the plan is cheap or its colour target is worth less than `below` chips. */
class ColourBelowBot extends AltReadsCoachBot {
  constructor(private readonly below: number) { super(reads); }
  override chooseDiscard(v: PlayerView): TileInstance {
    const hand = v.hand.map(kindOf), melds = meldsOf(v), ctx = this.ctx(v);
    const r = rankDiscards(hand, melds, ctx, { fitted: false });
    const t = r.best.target;
    const coachKeeps = (t.id === 'half_color' && t.chips >= this.below) || t.id === 'thirteen';
    if (coachKeeps) return v.hand.find((x) => kindOf(x) === r.best.tile)!;
    const m = policyRank(hand, melds, ctx);   // the shipped weights
    return v.hand.find((x) => kindOf(x) === m.best) ?? v.hand.find((x) => kindOf(x) === r.best.tile)!;
  }
}

function field(shuffle: number, tested: number, make: () => Bot): Bot[] {
  return [0, 1, 2, 3].map((s) => {
    if (s === tested) return make();
    if (fieldKind === 'coach') return new AltReadsCoachBot(reads);
    // `--field pure`: three Coaches as they were before 2026-09-28, which is the field every figure
    // up to candidate B was measured in; with `--pure` on B's own deals it must return B's mirror exactly
    if (fieldKind === 'pure') return new PureCoachBot();
    throw new Error(`--field ${fieldKind}: only coach and pure exist; the simple-bot pool was dropped on 2026-10-04`);
  });
}

const diffs: number[] = []; let chipsA = 0, chipsB = 0, winsA = 0, winsB = 0;
/**
 * What each arm wins with and loses to, for the tested seat. "More hands, less money" against the
 * loose field (2026-09-28) says the mix of wins moved, and this is the cheapest way to see how:
 * wins by the hand's combination and its fan, self-draws, and the two kinds of loss - paying for a
 * deal-in, or paying a self-draw or someone else's deal-in.
 */
interface Mix { wins: Record<string, number>; fan: Record<number, number>; selfDraw: number; winChips: number; dealIns: number; dealInChips: number; otherLoss: number; otherChips: number; draws: number }
const mixOf = (): Mix => ({ wins: {}, fan: {}, selfDraw: 0, winChips: 0, dealIns: 0, dealInChips: 0, otherLoss: 0, otherChips: 0, draws: 0 });
const mixA = mixOf(), mixB = mixOf();
const tally = (m: Mix, seat: number, out: { winner: number | null; selfDraw: boolean; discarder: number | null; score: { fan: number; combination: string } | null; chipsDelta: number[] }) => {
  const chips = out.chipsDelta[seat]!;
  if (out.winner === null) { m.draws++; return; }
  if (out.winner === seat) {
    const c = out.score?.combination ?? '?'; m.wins[c] = (m.wins[c] ?? 0) + 1;
    const f = out.score?.fan ?? -1; m.fan[f] = (m.fan[f] ?? 0) + 1;
    if (out.selfDraw) m.selfDraw++; m.winChips += chips; return;
  }
  if (out.discarder === seat) { m.dealIns++; m.dealInChips += chips; } else { m.otherLoss++; m.otherChips += chips; }
};
const started = Date.now();
for (let seat = 0; seat < 4; seat++) {
  for (let g = 0; g < n; g++) {
    const shuffle = from + g;
    const play = (make: () => Bot) => {
      const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
      const out = playGame(field(shuffle, seat, make), cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
      return { chips: out.chipsDelta[seat]!, won: out.winner === seat, out };
    };
    const a = play(() => (old ? oldCoach() : new AltReadsCoachBot(reads)));
    const b = play(() => (colourBelow !== null ? new ColourBelowBot(colourBelow) : chowCost !== null ? new ChowThresholdBot(chowCost) : pure ? new PureCoachBot() : claimWeights ? new LearnedClaimBot(claimWeights) : claims ? new LearnedClaimBot() : weights ? (hybrid ? new HybridBot(weights) : new FittedDiscardBot(weights)) : new AltReadsCoachBot(reads)));
    tally(mixA, seat, a.out); tally(mixB, seat, b.out);
    chipsA += a.chips; chipsB += b.chips; if (a.won) winsA++; if (b.won) winsB++;
    diffs.push(b.chips - a.chips);
  }
  process.stdout.write(`\rchair ${seat + 1}/4 done, ${diffs.length} paired deals, ${((Date.now() - started) / 60000).toFixed(1)} min`);
}
const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
const sd = Math.sqrt(diffs.reduce((x, y) => x + (y - mean) ** 2, 0) / (diffs.length - 1));
const se = sd / Math.sqrt(diffs.length);
console.log(`\n${old ? `the Coach as it is, against the Coach at ${oldPath}` : self ? 'self-check' : colourBelow !== null ? `the fit allowed onto colour plans worth under ${colourBelow} chips` : chowCost !== null ? `a Chow bar of ${chowCost} against the shipped 0.4` : pure ? 'the Coach before the fitted policy (pure)' : claimWeights ? `the claim model at ${claimWeightsPath}` : claims ? 'the learned claim model' : weightsPath}${hybrid ? ' (hybrid: Coach keeps colour plans)' : ''} against the shipped Coach, ${rules.jokers.count}-Joker min-${rules.minimum_tai} table, field ${fieldKind}, deals ${from}..${from + n - 1}, all four chairs`);
console.log(`${diffs.length} paired deals. Hands won: Coach ${winsA}, fitted ${winsB}. Chips: Coach ${chipsA}, fitted ${chipsB}`);
console.log(`fitted minus Coach: ${mean >= 0 ? '+' : ''}${mean.toFixed(3)} chips a game +/- ${se.toFixed(3)} (t = ${(mean / se).toFixed(1)})`);
const show = (name: string, m: Mix) => {
  const wins = Object.values(m.wins).reduce((x, y) => x + y, 0);
  const combos = Object.entries(m.wins).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n}`).join(', ');
  const fans = Object.entries(m.fan).sort((x, y) => Number(x[0]) - Number(y[0])).map(([f, n]) => `${f}:${n}`).join(' ');
  console.log(`${name.padEnd(7)} wins ${wins} (${m.selfDraw} self-drawn, ${(m.winChips / Math.max(1, wins)).toFixed(2)} chips each)  by fan ${fans}  [${combos}]`);
  console.log(`        deal-ins ${m.dealIns} (${(m.dealInChips / Math.max(1, m.dealIns)).toFixed(2)} chips each), other losses ${m.otherLoss} (${(m.otherChips / Math.max(1, m.otherLoss)).toFixed(2)} each), drawn ${m.draws}`);
};
show('Coach', mixA); show('fitted', mixB);
