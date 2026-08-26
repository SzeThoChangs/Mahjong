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
import { isHonour, rankOf } from 'sg-mahjong-engine';
import type { Meld, TileKind } from 'sg-mahjong-engine';

/** honour / terminal / middle - the coarse classes a discard heuristic reasons in */
const classOf = (k: TileKind): string => (isHonour(k) ? 'honour' : rankOf(k) === 1 || rankOf(k) === 9 ? 'terminal' : 'middle');

interface Action { a: string; ev: number; se?: number; n: number }
interface Q { id: string; k: string; seat: number; dl?: number; w: number; t: number; h: number[]; b: number[]; m: number[][]; disc?: number[][]; pm?: number[][][]; pb?: number[][]; actions: Action[] }
const BLIND = process.argv.includes('--blind');   // ignore the table, to measure what seeing it is worth

const path = process.argv[2] ?? '../web/public/quiz/money.json';
const pack = JSON.parse(readFileSync(path, 'utf8')) as { unit: string; questions: Q[] };
const cfg = JSON.parse(readFileSync('../data/table.config.json', 'utf8')) as { minimum_fan: number; self_draw_minimum_fan: number };

let n = 0, agree = 0, tiedOk = 0, threw = 0, skipped = 0;
let lost = 0;
const rankOfCoach: number[] = [];
type Bucket = { n: number; agree: number; lost: number };
const byPhase = new Map<string, Bucket>();
const byPlan = new Map<string, Bucket>();
const byPhasePlan = new Map<string, Bucket>();
const confusion = new Map<string, number>();
const confusionCost = new Map<string, number>();
const focus: { fih: number; bonus: number; coachClass: string; bestClass: string; isBest: boolean; cost: number }[] = [];
const isoRank: { coach: number; measured: number }[] = [];

for (const q of pack.questions) {
  if (q.k !== 'discard' || q.h.length % 3 !== 2) { skipped++; continue; }
  const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
  const visible: TileKind[] = [];
  if (!BLIND) {
    for (const d of q.disc ?? []) visible.push(d[1]! as TileKind);
    (q.pm ?? []).forEach((seatMelds, s) => { if (s !== q.seat) for (const meld of seatMelds) visible.push(...(meld.slice(2) as TileKind[])); });
    (q.pb ?? []).forEach((bonus, s) => { if (s !== q.seat) visible.push(...(bonus as TileKind[])); });
  }
  const ctx: Context = {
    seat: q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat,
    prevailingWind: q.w, bonus: q.b as TileKind[], playerTurns: q.t,
    minimumFan: cfg.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: cfg.self_draw_minimum_fan,
    visible,
  };
  let pick: TileKind, tied: TileKind[], plan: string, coachOrder: TileKind[];
  try { const r = rankDiscards(q.h as TileKind[], melds, ctx); pick = r.best.tile; tied = r.tied; plan = r.best.target.id; coachOrder = r.options.map((o) => o.tile); }
  catch { threw++; continue; }

  // rank every isolated candidate two ways: by the coach's ordering and by measured EV
  {
    const evOrder = q.actions.filter((a) => a.a.startsWith('d:')).sort((x, y) => y.ev - x.ev).map((a) => Number(a.a.slice(2)) as TileKind);
    const denom = Math.max(1, evOrder.length - 1);
    for (const t of new Set(q.h as TileKind[])) {
      if (isHonour(t)) continue;
      const same = (q.h as TileKind[]).filter((x) => x !== t && Math.floor(x / 9) === Math.floor(t / 9) && Math.abs(rankOf(x) - rankOf(t)) <= 2).length;
      const copies = (q.h as TileKind[]).filter((x) => x === t).length;
      if (same > 0 || copies > 1) continue;                       // only genuinely isolated singles
      const ci = coachOrder.indexOf(t), mi = evOrder.indexOf(t);
      if (ci < 0 || mi < 0) continue;
      isoRank.push({ coach: ci / Math.max(1, coachOrder.length - 1), measured: mi / denom });
    }
  }

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

  const pg = byPlan.get(plan) ?? { n: 0, agree: 0, lost: 0 };
  pg.n++; if (isBest) pg.agree++; pg.lost += cost;
  byPlan.set(plan, pg);

  const pp = `${p}/${plan}`;
  const eg = byPhasePlan.get(pp) ?? { n: 0, agree: 0, lost: 0 };
  eg.n++; if (isBest) eg.agree++; eg.lost += cost;
  byPhasePlan.set(pp, eg);

  if (p === 'early' && plan === 'chicken' && best.a.startsWith('d:')) {
    focus.push({
      fih: (q as unknown as { fih: number }).fih, bonus: q.b.length,
      coachClass: classOf(pick), bestClass: classOf(Number(best.a.slice(2)) as TileKind),
      isBest, cost,
    });
  }

  // where a disagreement goes: what class did the coach throw, what class was right
  if (!isBest && best.a.startsWith('d:')) {
    const key = `${classOf(pick)} -> ${classOf(Number(best.a.slice(2)) as TileKind)}`;
    confusion.set(key, (confusion.get(key) ?? 0) + 1);
    confusionCost.set(key, (confusionCost.get(key) ?? 0) + cost);
  }
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
// Does the coach rank ISOLATED tiles the way the play-outs do? Throwing a tile with no neighbours
// should normally beat breaking up a connected middle shape. If the coach ranks isolated tiles
// systematically lower than the measurement does, that is a ranking bug, not a taste difference.
if (isoRank.length) {
  const mean2 = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  console.log(`\nisolated tiles: where each ranks them among the legal discards (0 = best, 1 = worst)`);
  console.log(`  coach       ${mean2(isoRank.map((x) => x.coach)).toFixed(3)}`);
  console.log(`  measurement ${mean2(isoRank.map((x) => x.measured)).toFixed(3)}   (n=${isoRank.length} isolated candidates)`);
  const disagree = isoRank.filter((x) => x.coach - x.measured > 0.25).length;
  console.log(`  coach ranks it much lower than the play-outs do in ${((100 * disagree) / isoRank.length).toFixed(1)}% of cases`);
  const bothTop = isoRank.filter((x) => x.measured < 0.15);
  console.log(`  when the play-outs make the isolated tile the best throw (n=${bothTop.length}), the coach agrees ${((100 * bothTop.filter((x) => x.coach < 0.15).length) / Math.max(1, bothTop.length)).toFixed(1)}%`);
}

const table = (title: string, m: Map<string, Bucket>, min = 20) => {
  console.log(`\n${title}`);
  for (const [k, g] of [...m.entries()].filter(([, g]) => g.n >= min).sort((a, b) => a[1].agree / a[1].n - b[1].agree / b[1].n))
    console.log(`  ${k.padEnd(20)} n=${String(g.n).padStart(4)}  best ${((100 * g.agree) / g.n).toFixed(1).padStart(5)}%   cost ${(g.lost / g.n).toFixed(2).padStart(6)}`);
};
table('by the plan the coach committed to (worst first)', byPlan);
table('by phase x plan (worst first, n>=40)', byPhasePlan, 40);

console.log(`\nwhere the disagreements go (coach's tile class -> the measured best's), worst total cost first`);
for (const [k, c] of [...confusionCost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
  console.log(`  ${k.padEnd(22)} n=${String(confusion.get(k) ?? 0).padStart(4)}  total cost ${c.toFixed(0).padStart(6)}   per case ${(c / Math.max(1, confusion.get(k) ?? 1)).toFixed(2)}`);

// The worst cell in the table above is early/chicken. Chicken is meant to be the FALLBACK - the
// cheap legal win you keep available - not a plan to commit to on turn 8. If the coach is naming it
// early because the hand is already legal, it is trading a hand that could still grow for one that
// cannot, and the play-outs should punish exactly that.
if (focus.length) {
  const fihHist = new Map<number, number>();
  let armedByBonus = 0, coachThrowsMiddle = 0, bestThrowsMiddle = 0;
  for (const f of focus) {
    fihHist.set(f.fih, (fihHist.get(f.fih) ?? 0) + 1);
    if (f.bonus > 0) armedByBonus++;
    if (f.coachClass === 'middle') coachThrowsMiddle++;
    if (f.bestClass === 'middle') bestThrowsMiddle++;
  }
  console.log(`\nthe worst cell: early + coach committed to Chicken  (n=${focus.length}, best ${(100 * focus.filter((f) => f.isBest).length / focus.length).toFixed(1)}%)`);
  console.log(`  tai already in hand: ${[...fihHist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k} tai ${((100 * v) / focus.length).toFixed(0)}%`).join('  ')}`);
  console.log(`  hand already legal off a flower/animal: ${((100 * armedByBonus) / focus.length).toFixed(0)}%`);
  console.log(`  coach throws a middle tile ${((100 * coachThrowsMiddle) / focus.length).toFixed(0)}%   the measured best is a middle tile ${((100 * bestThrowsMiddle) / focus.length).toFixed(0)}%`);
  console.log(`  mean cost of the coach's Chicken call here: ${pack.unit === '$' ? '$' : ''}${(focus.reduce((a, f) => a + f.cost, 0) / focus.length).toFixed(2)} per hand`);
}

console.log(`\nBaseline: picking a discard at random from this pack would agree ~${(100 / mean(pack.questions.map((q) => q.actions.filter((a) => a.a.startsWith('d:')).length))).toFixed(1)}% of the time.`);
