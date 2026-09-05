/** A bot that plays by the solver's advice. Exists to verify the advice in the simulator. */
import { kindOf, discardFeatures, unseenCounts, type Bot, type ClaimOption, type PlayerView, type SelfAction, type TileInstance, type TileKind, type Meld } from 'sg-mahjong-engine';
import { rankDiscards } from './rank.js';
import { type Context, type TargetId } from './targets.js';
import { type ReadsTables } from './reads.js';
import { policyRank, policyTable } from './policy.js';
import { copyFeatures, copyScore, suitTable } from './copy.js';
import { COPY } from './copy.weights.js';
import { claimRank, claimAdvice, type ClaimCandidate } from './claim.js';

/**
 * The bot's view of the table, including what everyone can see.
 *
 * This used to pass neither `visible` nor `opponentMelds`, so CoachBot played blind in the
 * simulator even after `rankDiscards` learned to read the discard pool - it counted dead tiles as
 * live and priced every throw as if nobody were close to ready. Any comparison run against it was
 * measuring a handicapped coach.
 */
export const ctxOf = (v: PlayerView): Context => ({
  seat: (v.seat - v.dealer + 4) % 4, prevailingWind: v.prevailingWind, bonus: v.bonus.map(kindOf), playerTurns: v.playerTurns, wallRemaining: v.wallRemaining,
  minimumFan: v.config.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: v.config.self_draw_minimum_fan,
  visible: [
    ...v.discardLog.map((d) => kindOf(d.tile)),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.melds.flatMap((m) => m.tiles))),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.bonus.map(kindOf))),
  ],
  opponentMelds: v.players.map((p, s) => (s === v.seat ? -1 : p.melds.length)).filter((n) => n >= 0),
  // the same seats unreduced, for the advice only - see `collectingSuit`
  opponents: v.players.flatMap((p, s) => (s === v.seat ? [] : [{
    label: WIND[(s - v.dealer + 4) % 4]!,
    melds: p.melds.map((m) => m.tiles),
    discards: v.discardLog.filter((d) => d.seat === s).map((d) => kindOf(d.tile)),
    role: (s - v.dealer + 4) % 4,
    bonus: p.bonus.map(kindOf),
  }])),
});
const WIND = ['\u6771', '\u5357', '\u897f', '\u5317'];
export const meldsOf = (v: PlayerView): Meld[] => v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));

export class CoachBot implements Bot {
  /** Every decision reads the table through here, so a subclass can change what the coach is told
   *  about it - an alternative reads table, say - without reimplementing the decisions. */
  protected ctx(v: PlayerView): Context { return ctxOf(v); }
  chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), this.ctx(v));
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
  chooseSelfAction(_v: PlayerView, options: SelfAction[]): SelfAction | null {
    return options.find((o) => o.kind === 'win') ?? options.find((o) => o.kind === 'kong4') ?? options.find((o) => o.kind === 'kong1') ?? null;
  }
  /** The rule itself lives in `claimAdvice` so the app can show exactly what the bot plays. */
  chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kong = options.find((o) => o.kind === 'kong3'); if (kong) return kong;
    const usable = options.filter((o) => o.kind === 'pong' || o.kind === 'chow');
    if (!usable.length) return null;
    const cands: ClaimCandidate[] = usable.map((o) => ({ kind: o.kind as 'pong' | 'chow', used: (o.tiles ?? []).map(kindOf) }));
    const adv = claimAdvice([{ kind: 'pass', used: [] }, ...cands], v.hand.map(kindOf), meldsOf(v), kindOf(v.lastDiscard!.tile), this.ctx(v));
    if (adv.best.kind === 'pass') return null;
    const i = cands.findIndex((c) => c.kind === adv.best.kind && c.used.join() === adv.best.used.join());
    return usable[i] ?? null;
  }
}

/**
 * The same bot, but the discard comes from the learned model instead of the book coach.
 *
 * Claims and kongs still go through the coach's logic - only the discard differs - so a
 * head-to-head against CoachBot isolates the one thing being compared. Accuracy against measured
 * EVs says the model should be ahead; chips per game in the simulator is the claim that matters.
 */
export class PolicyBot extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = policyRank(v.hand.map(kindOf), meldsOf(v), ctxOf(v));
    return v.hand.find((t) => kindOf(t) === r.best) ?? super.chooseDiscard(v);
  }
}

/**
 * The same bot, but call-or-pass comes from the learned claim model instead of the coach's
 * hand-value comparison. Discards still go through the coach, so a head-to-head against CoachBot
 * isolates the claim decision the way PolicyBot isolates the discard.
 *
 * This is the arm the claim model had never been played in: PolicyBot extends CoachBot and only
 * overrides the discard, so 86.1% held-out accuracy had never been converted into chips.
 */
export class ClaimBot extends CoachBot {
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const offered = kindOf(v.lastDiscard!.tile);
    const ctx = this.ctx(v), melds = meldsOf(v), hand = v.hand.map(kindOf);
    // `pass` is always on the table and is not in `options`; the model ranks it alongside the rest.
    const cands: (ClaimCandidate & { opt: ClaimOption | null })[] = [{ kind: 'pass', used: [], opt: null }];
    for (const o of options) {
      if (o.kind !== 'pong' && o.kind !== 'chow' && o.kind !== 'kong3') continue;
      cands.push({ kind: o.kind, used: (o.tiles ?? []).map(kindOf), opt: o });
    }
    if (cands.length === 1) return null;
    const r = claimRank(cands.map((c) => ({ kind: c.kind, used: c.used })), hand, melds, offered, ctx);
    const picked = cands.find((c) => c.kind === r.best.kind && c.used.join() === r.best.used.join());
    return picked?.opt ?? null;
  }
}

/** Both learned halves at once: model discards AND model claims. */
export class FullPolicyBot extends ClaimBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = policyRank(v.hand.map(kindOf), meldsOf(v), ctxOf(v));
    return v.hand.find((t) => kindOf(t) === r.best) ?? super.chooseDiscard(v);
  }
}

/**
 * The coach WITH the fold rule: on a hand that cannot reach the table minimum by any route it
 * stops playing for value and throws the safest tile.
 *
 * Measured against plain CoachBot over 16,000 paired deals and it loses 0.039 +/- 0.018 chips a
 * game, so the coach does not use it. Kept as an arm so the result can be reproduced, and because
 * the rule is probably right in spirit and wrong in its trigger: it asks whether the hand is armed
 * NOW, which writes off hands that could still draw the flower or animal that arms them.
 */
/**
 * The coach as it was BEFORE the legal-wait rule: counting every tile that completes the hand,
 * including the ones that complete it below the table minimum and therefore cannot be declared.
 *
 * Kept so the rule that is now shipped can still be measured. Running this arm should return
 * roughly the mirror of what the rule won - about -0.02 on deals nobody chose, more on the seeds it
 * was fitted on - and a result near zero would mean the flag stopped being wired to anything.
 */
export class PlainWaitCoachBot extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), this.ctx(v), { legalWait: false });
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

/**
 * The coach, plus the measured discount for a tile no run can still be waiting on.
 *
 * Second idea from the tactics book (`no_chance_tiles`). Measured at three to five times safer in
 * every cell of `dangerWall`; whether that is worth chips is what the `wall` arm answers.
 */
export class WallCoachBot extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), this.ctx(v), { wall: true });
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

/**
 * The coach, plus what a deal-in would COST rather than only how likely it is.
 *
 * Every read this project has priced so far sharpened the same thing: the chance of dealing in. The
 * wall, the suit, the melds and the danger sweep were all that, and all four returned nothing. This
 * arm changes the other half. The coach's danger term is a probability multiplied by a constant, and
 * the constant treats a cheap chicken hand and a visible colour hand with a dragon pong as the same
 * loss, when at this table they are 7 chips and 40.
 *
 * Normalised so it adds no caution overall - see `shotScale`. It changes the throw on 1.57% of
 * discards, about one in 64, which is the same order as the two rules already measured here.
 */
export class ValueDangerCoachBot extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), this.ctx(v), { valueDanger: true });
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

/**
 * The coach WITHOUT the cheap hand among its plans.
 *
 * Everything ever measured here has been on the danger side, and all of it came back at zero. This
 * is the first arm pointed at the other half: what the coach thinks a hand is WORTH. It scores four
 * plans every turn and usually keeps the cheap one, which is the book's hybrid - play for something
 * good, take the quick legal win if it arrives first. Nobody has priced that. The study the tables
 * came from puts it at +3.4 chips a game, which would be the largest effect anyone has claimed in
 * this project.
 *
 * The flag rides on the context rather than on `rankDiscards`, so it reaches the claim decision as
 * well as the discard - both ask `handValue`, and a coach that no longer plans for a cheap hand
 * should not pong for one either.
 *
 * This arm is expected to LOSE, and to lose clearly. If it does not, the coach is as insensitive on
 * the value side as it is on the danger side, and the bot is finished.
 */
export class NoCheapCoachBot extends CoachBot {
  protected override ctx(v: PlayerView): Context { return { ...ctxOf(v), noCheap: true }; }
}

/**
 * The coach with NOTHING BUT the cheap hand among its plans - the mirror of `NoCheapCoachBot`.
 *
 * `nocheap` on its own cannot settle the question it was built for. That arm still declares a
 * cheap win when one lands, because the engine offers the win and the bot takes it; all it gives
 * up is planning for one. So a null there has two readings: the plan list does not steer the play,
 * or the coach reaches cheap hands anyway without aiming at them.
 *
 * This arm separates them by pushing the same dial the other way. It never builds towards a colour
 * hand, an all-pong hand or the thirteen, and plays every hand for the quick legal win. Between
 * the two arms the coach's plan list is swung from one end to the other, and if neither end costs
 * or wins chips then the value machinery is inert and re-fitting its tables cannot help.
 */
export class OnlyCheapCoachBot extends CoachBot {
  protected override ctx(v: PlayerView): Context { return { ...ctxOf(v), onlyCheap: true }; }
}

/**
 * The coach playing for ONE plan, chosen before the deal and never revised.
 *
 * It exists to generate the hands a value fit needs. `tables.ts` answers "playing for this plan
 * with this breakdown, expect this many chips", and no hand the coach has ever played answers that
 * question, because the coach switches plans whenever the ranking changes. A seat that cannot
 * switch does answer it, and assigning the plan before the hand rather than letting the hand
 * suggest it is what makes the answer unbiased: the plan is not chosen because the hand suited it.
 *
 * It is not expected to play well. A seat told to build All-Pong from a hand full of runs will lose
 * chips, and that loss is the measurement, not a bug.
 */
export class PlanBot extends CoachBot {
  constructor(private readonly plan: TargetId) { super(); }
  protected override ctx(v: PlayerView): Context { return { ...ctxOf(v), onlyTarget: this.plan }; }
}

/**
 * The coach pricing its PLANS off tables fitted on our own hands rather than the study author's.
 *
 * `AltReadsCoachBot` is this bot's opposite number on the danger side, and the danger side is closed:
 * five reads measured true and every one paid nothing. This is the same experiment where the money
 * actually is. `solver/src/tables.ts` turns a hand into a number of chips, it is auto-generated from
 * simulations that are not ours, and no part of it has ever been checked against the 150,000 hands
 * this project has recorded.
 *
 * Fitted tables estimate the value of a position UNDER THE COACH'S OWN PLAY, so a first pass is
 * policy evaluation and not best play. That is the honest thing to test first: it asks whether the
 * coach is better off believing what actually happens to hands like this one.
 */
export class FittedCoachBot extends CoachBot {
  // Written out as fields rather than as constructor parameter properties: the web build runs with
  // `erasableSyntaxOnly`, which rejects the shorthand because it emits code rather than only types.
  private readonly tables: unknown;
  private readonly dangerWeight?: number;
  constructor(tables: unknown, dangerWeight?: number) { super(); this.tables = tables; this.dangerWeight = dangerWeight; }
  protected override ctx(v: PlayerView): Context {
    return { ...ctxOf(v), tables: this.tables, ...(this.dangerWeight === undefined ? {} : { dangerWeight: this.dangerWeight }) };
  }
}

export class FoldCoachBot extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), this.ctx(v), { fold: true });
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

/**
 * The coach pricing danger off a DIFFERENT measured table.
 *
 * `Context.reads` has existed since the reads went in, for exactly this - so a regenerated table can
 * be PLAYED against the shipped one before it replaces it - and nothing had ever used it. The table
 * that ships was measured by replaying a recorded run, and those runs were played by the datagen
 * personalities: they win a colour hand 1.3% of the time against the coach's 32%, so every read
 * about suits in it was measured on a game nobody at this table plays.
 *
 * The alternative table is passed in rather than read from disk, because this file is also part of
 * the browser build.
 */
export class AltReadsCoachBot extends CoachBot {
  // a plain field, not a constructor parameter property: the web build runs `erasableSyntaxOnly`
  private readonly tables: ReadsTables;
  constructor(tables: ReadsTables) { super(); this.tables = tables; }
  protected override ctx(v: PlayerView): Context { return { ...ctxOf(v), reads: this.tables }; }
}

/**
 * The fast copy of the coach: same discard decision, a few hundred times cheaper.
 *
 * The point is not to play well. It is to play LIKE THE COACH at a cheap bot's speed, so it can be
 * the evaluator's play-out policy. Every EV in the dataset means "worth this much if play continues
 * like the bot that played it out", and the bots that graded everything we hold finish a colour hand
 * 2-4% of the time against the coach's 34.6% - so they grade a plan they cannot carry out.
 *
 * Claims still go through the coach, which is 10.6% of its cost against the discard's 88.2%
 * (`tools/_profile.ts`). Discards first; if the speed is still short after that, claims are next.
 *
 * Judge it on `tools/_rates.ts`, not on how often it agrees with the coach. Per-decision agreement
 * has failed to predict anything in this project three times. The question is whether it finishes
 * colour hands at the coach's rate.
 */
export class FastCoachBot extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const hand = v.hand.map(kindOf);
    const kinds = [...new Set(hand)].filter((k) => k < 34);
    if (kinds.length <= 1) return super.chooseDiscard(v);
    const ctx = this.ctx(v), melds = meldsOf(v);
    const unseen = unseenCounts({
      hand,
      allMelds: v.players.flatMap((p) => p.melds.flatMap((m) => m.tiles)),
      allDiscards: v.discardLog.map((d) => kindOf(d.tile)),
    });
    const byKind = new Map(discardFeatures(hand, melds, unseen).map((f) => [f.k, f]));
    const tbl = policyTable(ctx), suits = suitTable(hand);
    let best: TileKind | null = null, bestScore = -Infinity;
    for (const k of kinds) {
      const f = byKind.get(k); if (!f) continue;
      const sc = copyScore(copyFeatures(f, ctx.seat, ctx.prevailingWind, ctx.playerTurns, tbl, suits), COPY);
      if (sc > bestScore) { bestScore = sc; best = k; }
    }
    if (best === null) return super.chooseDiscard(v);
    return v.hand.find((t) => kindOf(t) === best) ?? super.chooseDiscard(v);
  }
}
