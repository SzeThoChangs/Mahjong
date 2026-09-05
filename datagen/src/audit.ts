/**
 * Re-score the shape tips against a baseline that knows what each throw IS.
 *
 *   tsx src/audit.ts --quiz ../web/public/quiz
 *
 * `tiptest.ts` scores a tip against the coin its own split implies: point at three tiles and warn
 * against two, and following it at random is 60%. Its own header names the danger this is meant to
 * handle - "a tip pointing at the loose tiles will look right far more often than that, because
 * loose tiles are what a hand throws anyway" - and the share correction does not actually handle it.
 * It equalises HOW MANY tiles are on each side, not what those tiles are. On 2026-09-05 the size of
 * the gap was measured for the first time: a spare tile is the measured best 69% of the time against
 * 24% by luck, and a throw costing the hand no distance 85% against 34%.
 *
 * So every verdict on the Tips page was standing on a baseline that was too easy, by an unknown
 * amount. This re-runs them all against the matched baseline from `packlib.ts`, which weights each
 * action by how often a throw of that description is the best one - costs distance or not, wanted by
 * a block or not, honour, terminal or simple. A tip that survives knows something the shape of the
 * choice does not already say. A tip that does not was reading its own tiles back to itself.
 *
 * The splits are `shapetag.ts`'s, unchanged, so the only thing that differs from `tiptest.ts` is
 * what the number is compared against.
 */
import {
  loadPacks, scorePacks, fitNull, featureKey, tileClass, without, shanten,
  type PackQ, type Arm, type NullModel,
} from './packlib.js';
import { liveCalls, blocks } from 'sg-mahjong-solver';
import type { Meld } from 'sg-mahjong-engine';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const quizDir = arg('quiz', '../web/public/quiz')!;
const only = arg('pack');

interface Ctx {
  calls: { tip: string; says: string[]; against: string[] }[];
  feat: Map<string, string>;      // action -> feature bucket
}

function prepare(q: PackQ): Ctx | null {
  if (q.k !== 'discard' || !q.best.startsWith('d:')) return null;
  const melds = q.m.length;
  const throws = q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2)));
  if (throws.length < 2) return null;

  const spare = new Map<number, number>();
  for (const k of q.h) spare.set(k, (spare.get(k) ?? 0) + 1);
  for (const b of blocks(q.h)) for (const k of b.tiles) spare.set(k, (spare.get(k) ?? 0) - 1);
  const sh = new Map<number, number>();
  for (const k of throws) sh.set(k, shanten(without(q.h, [k]), melds));
  const minSh = Math.min(...sh.values());
  const feat = new Map<string, string>();
  for (const k of throws) feat.set(`d:${k}`, featureKey(sh.get(k)! > minSh, (spare.get(k) ?? 0) > 0, tileClass(k)));

  const meldList: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
  const calls = liveCalls(q.h, melds, throws, {
    bonus: q.b, seat: (q.seat - q.dl + 4) % 4, prevailingWind: q.w, melds: meldList,
    minimumFan: 2, selfDrawMinimumFan: 1,
  }).map((c) => ({
    tip: c.tip,
    says: c.says.filter((k) => throws.includes(k)).map((k) => `d:${k}`),
    against: c.against.filter((k) => throws.includes(k)).map((k) => `d:${k}`),
  }));
  return { calls, feat };
}

function fit(): NullModel {
  const rows: { key: string; best: boolean }[] = [];
  for (const { questions } of loadPacks(quizDir, only)) {
    for (const q of questions) {
      const c = prepare(q);
      if (!c) continue;
      for (const [a, key] of c.feat) rows.push({ key, best: q.best === a });
    }
  }
  return fitNull(rows);
}
const NULL = fit();

// one arm per tip the tagger can name, so the table has the same rows `tiptest.ts` prints
const TIP_IDS = [...new Set(loadPacks(quizDir, only).flatMap(({ questions }) =>
  questions.flatMap((q) => { const c = prepare(q); return c ? c.calls.map((x) => x.tip) : []; })))];
const ARMS: Record<string, Arm<Ctx>> = {};
for (const id of TIP_IDS) {
  ARMS[id] = { note: 'from shapetag.ts, unchanged', f: (_q, c) => c.calls.find((x) => x.tip === id) ?? null };
}

console.log('the matched baseline, fitted on every graded throw in both packs:');
for (const [k, v] of [...NULL].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} best ${(100 * v).toFixed(0)}% of the time`);

scorePacks<Ctx>({
  quizDir, only, arms: ARMS, prepare, width: 24,
  heading: (f, used, total) => `${f}: ${used} graded discard positions, of ${total} questions`,
  weight: (_q, c, a) => NULL.get(c.feat.get(a) ?? '') ?? 0.1,
});
