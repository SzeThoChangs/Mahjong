/** A bot that plays by the solver's advice. Exists to verify the advice in the simulator. */
import { kindOf, type Bot, type ClaimOption, type PlayerView, type SelfAction, type TileInstance, type Meld } from 'sg-mahjong-engine';
import { rankDiscards } from './rank.js';
import { type Context } from './targets.js';
import { policyRank } from './policy.js';
import { claimRank, claimAdvice, type ClaimCandidate } from './claim.js';

/**
 * The bot's view of the table, including what everyone can see.
 *
 * This used to pass neither `visible` nor `opponentMelds`, so CoachBot played blind in the
 * simulator even after `rankDiscards` learned to read the discard pool - it counted dead tiles as
 * live and priced every throw as if nobody were close to ready. Any comparison run against it was
 * measuring a handicapped coach.
 */
const ctxOf = (v: PlayerView): Context => ({
  seat: (v.seat - v.dealer + 4) % 4, prevailingWind: v.prevailingWind, bonus: v.bonus.map(kindOf), playerTurns: v.playerTurns, wallRemaining: v.wallRemaining,
  minimumFan: v.config.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: v.config.self_draw_minimum_fan,
  visible: [
    ...v.discardLog.map((d) => kindOf(d.tile)),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.melds.flatMap((m) => m.tiles))),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.bonus.map(kindOf))),
  ],
  opponentMelds: v.players.map((p, s) => (s === v.seat ? -1 : p.melds.length)).filter((n) => n >= 0),
});
const meldsOf = (v: PlayerView): Meld[] => v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));

export class CoachBot implements Bot {
  chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), ctxOf(v));
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
    const adv = claimAdvice([{ kind: 'pass', used: [] }, ...cands], v.hand.map(kindOf), meldsOf(v), kindOf(v.lastDiscard!.tile), ctxOf(v));
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
    const ctx = ctxOf(v), melds = meldsOf(v), hand = v.hand.map(kindOf);
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
export class FoldCoachBot extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), ctxOf(v), { fold: true });
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}
