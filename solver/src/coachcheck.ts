/**
 * Does the book coach agree with the measured EVs?
 *
 *   tsx src/coachcheck.ts ../web/public/quiz/money.json
 *
 * The Train tab teaches the coach (book heuristics, `rankDiscards`); the Real quiz teaches the
 * evaluator (measured play-outs). If they disagree often, the two tabs are teaching different games
 * and one of them is teaching a bad habit. Every question in a decisive pack has a best answer the
 * play-outs CAN separate, so disagreement here is the coach's, not noise.
 *
 * Reports how often the coach's pick is the measured best, how often it is at least not a blunder,
 * and what its choices cost in dollars per hand.
 */
import { readFileSync } from 'node:fs';
import { rankDiscards, type Context } from './index.js';
import type { Meld, TileKind } from 'sg-mahjong-engine';

interface Action { a: string; ev: number; se?: number; n: number }
interface Q { id: string; k: string; seat: number; dl?: number; w: number; t: number; h: number[]; b: number[]; m: number[][]; actions: Action[] }

const path = process.argv[2] ?? '../web/public/quiz/money.json';
const pack = JSON.parse(readFileSync(path, 'utf8')) as { unit: string; questions: Q[] };
const cfg = JSON.parse(readFileSync('../data/table.config.json', 'utf8')) as { minimum_fan: number; self_draw_minimum_fan: number };

let n = 0, agree = 0, tiedOk = 0, threw = 0, skipped = 0;
let lost = 0;
const rankOfCoach: number[] = [];
const byPhase = new Map<string, { n: number; agree: number; lost: number }>();

for (const q of pack.questions) {
  if (q.k !== 'discard' || q.h.length % 3 !== 2) { skipped++; continue; }
  const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
  const ctx: Context = {
    seat: q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat,
    prevailingWind: q.w, bonus: q.b as TileKind[], playerTurns: q.t,
    minimumFan: cfg.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: cfg.self_draw_minimum_fan,
  };
  let pick: TileKind, tied: TileKind[];
  try { const r = rankDiscards(q.h as TileKind[], melds, ctx); pick = r.best.tile; tied = r.tied; }
  catch { threw++; continue; }

  const discards = q.actions.filter((a) => a.a.startsWith('d:'));
  if (!discards.length) { skipped++; continue; }
  const coachAction = discards.find((a) => Number(a.a.slice(2)) === pick);
  if (!coachAction) { skipped++; continue; }   // coach named a tile that was not a legal discard here

  const best = q.actions[0]!;
  n++;
  const isBest = coachAction.a === best.a;
  if (isBest) agree++;
  else if (tied.some((t) => `d:${t}` === best.a)) tiedOk++;   // coach called it a tie and the best was in it
  const cost = best.ev - coachAction.ev;
  lost += cost;
  rankOfCoach.push(discards.sort((x, y) => y.ev - x.ev).findIndex((a) => a.a === coachAction.a) + 1);

  const p = q.t <= 15 ? 'early' : q.t <= 35 ? 'mid' : 'late';
  const g = byPhase.get(p) ?? { n: 0, agree: 0, lost: 0 };
  g.n++; if (isBest) g.agree++; g.lost += cost;
  byPhase.set(p, g);
}

const pct = (x: number, d = n) => `${((100 * x) / Math.max(1, d)).toFixed(1)}%`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`${n} discard questions with a coach opinion  (${skipped} skipped, ${threw} threw)\n`);
console.log(`coach picks the measured best      ${pct(agree)}`);
console.log(`  ...or called it a tie that contains the best   +${pct(tiedOk)}  =  ${pct(agree + tiedOk)}`);
console.log(`mean rank of the coach's tile      ${mean(rankOfCoach).toFixed(2)} of ${(pack.questions.length ? mean(pack.questions.map((q) => q.actions.filter((a) => a.a.startsWith('d:')).length)) : 0).toFixed(1)} discards`);
console.log(`mean cost of following the coach   ${pack.unit === '$' ? '$' : ''}${(lost / Math.max(1, n)).toFixed(2)} per hand`);
console.log(`\nby phase`);
for (const p of ['early', 'mid', 'late']) {
  const g = byPhase.get(p); if (!g) continue;
  console.log(`  ${p.padEnd(6)} n=${String(g.n).padStart(4)}  best ${((100 * g.agree) / g.n).toFixed(1).padStart(5)}%   cost ${(g.lost / g.n).toFixed(2).padStart(6)}`);
}
console.log(`\nBaseline: picking a discard at random from this pack would agree ~${(100 / mean(pack.questions.map((q) => q.actions.filter((a) => a.a.startsWith('d:')).length))).toFixed(1)}% of the time.`);
