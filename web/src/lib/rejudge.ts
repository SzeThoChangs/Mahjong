/**
 * Challenge a pack verdict with fresh play-outs, on this device.
 *
 * WHY. A question gets into a pack by beating its runner-up by more than two paired standard
 * errors on the play-outs its verdict is then reported from, so the reported gap carries some of
 * the sample's luck: about one verdict in ten is a close call wearing a decisive badge (FINDINGS,
 * "The packs overstate their certainty"). The one honest answer to "that verdict was wrong" is to
 * judge the position again on dice it has not seen. This used to need the Mac's dev server; the
 * solver's `rejudge` and `snapshotFromQuestion` now run in a Web Worker, so it works on the phone,
 * offline.
 *
 * WHAT IS COMPARED. Not every legal action - only what the verdict rested on: the tile the player
 * picked, the pack's best, and the pack's runner-up when that is a third tile. Fewer actions means
 * each gets the whole budget, and the paired gap between the pick and the best is the number the
 * verdict was, so it is the number that gets re-measured.
 *
 * WHICH TABLE. The position is played at the pack's table - its wildcard count and minimum - so
 * the same actions are legal that the pack judged; the money is the schedule the player set up in
 * Table setup, which is also what the verdict on screen was priced in.
 */
import { makeRules, type RulesConfig, type MoneyRules } from 'sg-mahjong-engine';
import { pairedGap, type PackQuestion, type RejudgedAction } from 'sg-mahjong-solver';
import { RULES } from './scenario';
import { shootTotal, type MoneyConfig } from './money';
import type { ChallengeMessage, ChallengeRequest } from '../workers/rejudge.worker';

/**
 * How many fresh play-outs each compared action gets.
 *
 * Measured 2026-09-11 in the Mac's in-app browser: three actions at 512 play-outs each took 0.6s
 * of play-outs and about 1.0s from press to answer with the worker's start-up; a two-action claim
 * took 0.2s. A phone is three to five times slower, so a challenge there is a few seconds, which
 * the progress bar covers. 512 is also what the packs were verified on, so a challenge is the
 * same instrument as the verdict it questions, on different dice.
 */
export const CHALLENGE_ROLLOUTS = 512;

/** The engine's money schedule for the table the player set up. */
export function moneyRulesOf(c: MoneyConfig): MoneyRules {
  const tais = Object.keys(c.ladder).map(Number).sort((a, b) => a - b);
  const shoot: Record<number, number> = {};
  for (const t of tais) shoot[t] = shootTotal(c, t);
  return {
    ladder: { ...c.ladder }, zm_bonus_per_player: c.zm, shoot_total: shoot,
    kong_concealed_each: c.kongConcealed, kong_exposed_each: c.kongExposed, kong_fed_total: c.kongFed,
    bite_flower_hidden: c.flowerBiteHidden, bite_flower_open: c.flowerBiteOpen, bite_animal_hidden: c.animalBiteHidden, bite_animal_open: c.animalBiteOpen,
  };
}

/** The rules a pack's positions are played under here: the pack's table, the player's money. */
export function rulesForPack(table: { wildcards: number; minimumTai: number } | undefined, unit: string, money: MoneyConfig): RulesConfig {
  return makeRules({
    ...RULES,
    minimum_tai: table?.minimumTai ?? RULES.minimum_tai,
    maximum_tai: unit === '$' ? money.maxTai : RULES.maximum_tai,
    self_draw_minimum_tai: unit === '$' ? Math.min(money.selfDrawMinTai, table?.minimumTai ?? RULES.minimum_tai) : RULES.self_draw_minimum_tai,
    jokers: { ...RULES.jokers, count: table?.wildcards ?? RULES.jokers.count },
    discard_win_payment: money.payMode === 'shooter' ? 'discarder_pays_all' : money.payMode === 'everyone' ? 'ladder_split' : 'all_single',
    money: unit === '$' ? moneyRulesOf(money) : null,
  });
}

export interface ChallengeOutcome {
  /** EV of the reference action minus EV of the pick, on paired play-outs: positive means the pick is worse */
  gap: number;
  se: number;
  /** play-outs per action */
  n: number;
  ms: number;
  actions: RejudgedAction[];
  /** the action the pick was measured against: the pack's best, or the runner-up when the pick was the best */
  reference: string;
}

/**
 * Run one challenge. `compare` is the pick first, then the reference, then any third action.
 * Resolves with the outcome; `onProgress` is called as play-outs complete.
 */
export function challenge(req: Omit<ChallengeRequest, 'rollouts' | 'seed'> & { rollouts?: number }, onProgress: (done: number, total: number) => void): Promise<ChallengeOutcome> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    // The single-file build (tools/singlefile.mjs) has no server to fetch the worker's chunk from,
    // so it carries the chunk's text on the window and the worker is started from a blob instead.
    const inline = (window as unknown as { __WORKER_SRC?: Record<string, string> }).__WORKER_SRC?.rejudge;
    try {
      worker = inline
        ? new Worker(URL.createObjectURL(new Blob([inline], { type: 'text/javascript' })), { type: 'module' })
        : new Worker(new URL('../workers/rejudge.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); return; }
    const rollouts = req.rollouts ?? CHALLENGE_ROLLOUTS;
    // a different seed from anything the pack builder uses, and different on every press, so a
    // second challenge is a second opinion rather than the same dice again
    const seed = 900000 + Math.floor(Math.random() * 1e6);
    worker.onmessage = (e: MessageEvent<ChallengeMessage>) => {
      const m = e.data;
      if (m.type === 'progress') { onProgress(m.done, m.total); return; }
      worker.terminate();
      if (m.type === 'error') { reject(new Error(m.message)); return; }
      const pick = m.actions.find((a) => a.a === req.compare[0]), ref = m.actions.find((a) => a.a === req.compare[1]);
      if (!pick || !ref) { reject(new Error('the play-outs came back without the actions asked for')); return; }
      const { gap, se } = pairedGap(ref, pick);
      resolve({ gap, se, n: rollouts, ms: m.ms, actions: m.actions, reference: ref.a });
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'the play-out worker failed')); };
    const msg: ChallengeRequest = { q: req.q, rules: req.rules, compare: req.compare, rollouts, seed };
    worker.postMessage(msg);
  });
}

/**
 * What the fresh gap says about the verdict, at the same bar the pack admits a question on: two
 * paired standard errors. `gap` is reference minus pick. When the pick was the pack's best the
 * reference is the runner-up, so the signs turn round: the verdict holds while the pick stays
 * ahead, and is reversed when the runner-up pulls clear.
 */
export function challengeKind(gap: number, se: number, pickWasBest: boolean): 'holds' | 'close' | 'reversed' {
  const clear = Math.abs(gap) > 2 * se;
  if (!clear) return 'close';
  return (gap > 0) !== pickWasBest ? 'holds' : 'reversed';
}

/** whether a question carries what the rebuild needs; packs built before 2026-09-06 do not */
export const canChallenge = (q: Partial<PackQuestion>): q is PackQuestion =>
  q.dl !== undefined && Array.isArray(q.disc) && Array.isArray(q.pm) && Array.isArray(q.pb);
