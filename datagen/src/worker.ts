/** Worker: runs sessions until its hand quota is met, writing its own shard files. */
import { parentPort, workerData } from 'node:worker_threads';
import { join } from 'node:path';
import { makeRules, makeRng, type RulesConfig } from 'sg-mahjong-engine';
import { loadTableRulesOverride } from './tablerules.js';
import { runSession } from './session.js';
import { JsonlGzWriter } from './writer.js';
import { BOT_TYPES, type BotType, type RandomnessConfig } from './bots.js';
import { fnv1a } from './records.js';

export interface WorkerArgs { workerIndex: number; workers: number; handQuota: number; out: string; baseSeed: number; truth: boolean; rulesOverride: object; rules?: RulesConfig; randomness: RandomnessConfig; maxHands: number; decisions: boolean; botTypes?: BotType[] }

export function runWorker(a: WorkerArgs, progress?: (hands: number) => void) {
  const rules = a.rules ?? makeRules({ ...loadTableRulesOverride(), ...a.rulesOverride });
  const dec = new JsonlGzWriter(join(a.out, `decisions-w${a.workerIndex}.jsonl.gz`));
  const hands = new JsonlGzWriter(join(a.out, `hands-w${a.workerIndex}.jsonl.gz`));
  const truth = a.truth ? new JsonlGzWriter(join(a.out, `truth-w${a.workerIndex}.jsonl.gz`)) : null;
  const sink = { decision: (r: unknown) => dec.write(r), hand: (r: unknown) => hands.write(r), truth: truth ? (r: unknown) => truth.write(r) : undefined };
  let done = 0, sessions = 0;
  for (let j = 0; done < a.handQuota; j++) {
    const sessionId = a.workerIndex + a.workers * j;
    const seed = fnv1a(`${a.baseSeed}:${sessionId}`) || 1;
    // personalities: seeded shuffle of the pool, 4 drawn with replacement bias toward variety
    const rng = makeRng(seed ^ 0x9e3779b9);
    const botTypes: BotType[] = a.botTypes ?? [0, 1, 2, 3].map(() => BOT_TYPES[Math.floor(rng() * BOT_TYPES.length)]!);
    const { hands: hs } = runSession({ sessionId, seed, rules, botTypes, randomness: a.randomness, maxHands: Math.min(a.maxHands, a.handQuota - done), sink, recordDecisions: a.decisions });
    done += hs.length; sessions++;
    progress?.(done);
  }
  dec.close(); hands.close(); truth?.close();
  return { hands: done, sessions, decisions: dec.lines };
}

if (parentPort) {
  const a = workerData as WorkerArgs;
  const res = runWorker(a, (n) => parentPort!.postMessage({ type: 'progress', hands: n }));
  parentPort.postMessage({ type: 'done', ...res });
}
