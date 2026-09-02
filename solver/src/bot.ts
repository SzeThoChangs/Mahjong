/** A bot that plays by the solver's advice. Exists to verify the advice in the simulator. */
import { kindOf, discardFeatures, unseenCounts, type Bot, type ClaimOption, type PlayerView, type SelfAction, type TileInstance, type TileKind, type Meld } from 'sg-mahjong-engine';
import { rankDiscards } from './rank.js';
import { type Context } from './targets.js';
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
