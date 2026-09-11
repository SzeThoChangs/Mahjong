/**
 * The Challenge button's play-outs, off the main thread - and the Play tab's, which are the same
 * play-outs on a position the game loop captured rather than one rebuilt from a pack question.
 *
 * A challenge is 512 play-outs for each of two or three actions, which is a second or two on a
 * laptop and several on a phone. On the main thread that would freeze the page; here the page
 * keeps drawing and gets a progress message every thirty-two play-outs. The judging itself is the
 * solver's `rejudge`, the same code that graded the pack, on a position rebuilt from the question
 * by `snapshotFromQuestion`. Nothing here needs a server, so it works offline once the service
 * worker has cached this file with the rest of the bundle.
 *
 * The Play tab sends a `PositionRequest` instead: the engine snapshot it took before the human
 * decided, which needs no rebuilding. Everything after that point is shared, so a decision made at
 * the table and a decision posed by a pack are judged by one instrument.
 */
import { rejudge, snapshotFromQuestion, pendingOf, encAction, type PackQuestion, type RejudgedAction } from 'sg-mahjong-solver';
import type { LegalAction, RulesConfig, Snapshot } from 'sg-mahjong-engine';

export interface ChallengeRequest {
  q: PackQuestion & { id: string };
  rules: RulesConfig;
  /** the actions to judge, as the pack names them; everything else the seat could do is left out */
  compare: string[];
  rollouts: number;
  seed: number;
}
/** A position captured live, before the seat decided. `key` names it so its hidden states are
 *  reproducible and different from every other decision's under the same seed. */
export interface PositionRequest {
  snap: Snapshot;
  rules: RulesConfig;
  seat: number;
  compare: string[];
  rollouts: number;
  seed: number;
  key: string;
}
export type WorkerRequest = ChallengeRequest | PositionRequest;
export type ChallengeMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; actions: RejudgedAction[]; ms: number }
  | { type: 'error'; message: string };

const post = (m: ChallengeMessage) => self.postMessage(m);

/** the legal actions named in `compare`, or a reason why one of them is not on offer */
function pickLegal(legal: LegalAction[], compare: string[]): LegalAction[] {
  const out = legal.filter((l) => compare.includes(encAction(l)));
  const found = new Set(out.map(encAction));
  const missing = compare.filter((a) => !found.has(a));
  if (missing.length) throw new Error(`the position does not offer ${missing.join(', ')}`);
  return out;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { rules, compare, rollouts, seed } = e.data;
  try {
    let snap: Snapshot, seat: number, key: string;
    if ('snap' in e.data) {
      snap = e.data.snap; seat = e.data.seat; key = e.data.key;
      const p = pendingOf(snap, rules);
      if (p.seat !== seat) throw new Error(`the position has seat ${p.seat} to act, not seat ${seat}`);
    } else {
      const { q } = e.data;
      snap = snapshotFromQuestion(q, rules); seat = q.seat; key = q.id;
      const p = pendingOf(snap, rules);
      if (p.seat !== q.seat || p.kind !== q.k) throw new Error(`the rebuilt position has ${p.kind} pending for seat ${p.seat}`);
    }
    const legal = pickLegal(pendingOf(snap, rules).legal, compare);
    const t0 = performance.now();
    let last = 0;
    const actions = rejudge(snap, rules, seat, legal, {
      rollouts, seed, key, coupled: true, adaptive: false,
      onProgress: (done, total) => { if (done - last >= 32 || done === total) { last = done; post({ type: 'progress', done, total }); } },
    });
    post({ type: 'done', actions, ms: performance.now() - t0 });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
