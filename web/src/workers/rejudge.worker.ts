/**
 * The Challenge button's play-outs, off the main thread.
 *
 * A challenge is 512 play-outs for each of two or three actions, which is a second or two on a
 * laptop and several on a phone. On the main thread that would freeze the page; here the page
 * keeps drawing and gets a progress message every thirty-two play-outs. The judging itself is the
 * solver's `rejudge`, the same code that graded the pack, on a position rebuilt from the question
 * by `snapshotFromQuestion`. Nothing here needs a server, so it works offline once the service
 * worker has cached this file with the rest of the bundle.
 */
import { rejudge, snapshotFromQuestion, pendingOf, encAction, type PackQuestion, type RejudgedAction } from 'sg-mahjong-solver';
import type { RulesConfig } from 'sg-mahjong-engine';

export interface ChallengeRequest {
  q: PackQuestion & { id: string };
  rules: RulesConfig;
  /** the actions to judge, as the pack names them; everything else the seat could do is left out */
  compare: string[];
  rollouts: number;
  seed: number;
}
export type ChallengeMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; actions: RejudgedAction[]; ms: number }
  | { type: 'error'; message: string };

const post = (m: ChallengeMessage) => self.postMessage(m);

self.onmessage = (e: MessageEvent<ChallengeRequest>) => {
  const { q, rules, compare, rollouts, seed } = e.data;
  try {
    const snap = snapshotFromQuestion(q, rules);
    const p = pendingOf(snap, rules);
    if (p.seat !== q.seat || p.kind !== q.k) throw new Error(`the rebuilt position has ${p.kind} pending for seat ${p.seat}`);
    const legal = p.legal.filter((l) => compare.includes(encAction(l)));
    const found = new Set(legal.map(encAction));
    const missing = compare.filter((a) => !found.has(a));
    if (missing.length) throw new Error(`the rebuilt position does not offer ${missing.join(', ')}`);
    const t0 = performance.now();
    let last = 0;
    const actions = rejudge(snap, rules, q.seat, legal, {
      rollouts, seed, key: q.id, coupled: true, adaptive: false,
      onProgress: (done, total) => { if (done - last >= 32 || done === total) { last = done; post({ type: 'progress', done, total }); } },
    });
    post({ type: 'done', actions, ms: performance.now() - t0 });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
