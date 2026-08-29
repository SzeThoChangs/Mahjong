/**
 * Build a quiz pack: real evaluated decisions, compact, for the web Real Quiz.
 *   tsx src/quizpack.ts --dir ../data/gen/run-money3 --out ../web/public/quiz --name table --max 4000
 * Every question carries the acting player's visible context and the measured EV of every legal action.
 * Two streaming passes over the evals: the first keeps only a key and a spread per decision so the sample
 * can be drawn, the second re-reads and materialises just the few thousand records that were picked.
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fanInHand, makeRng, type Meld } from 'sg-mahjong-engine';
import { eachJsonlGz } from './stats.js';
import { eachEval } from './evalstats.js';
import { pairedSe, separationT, seVersionOf } from './se.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, type EvalRecord } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money3')!;
const outDir = arg('out', '../web/public/quiz')!;
const name = arg('name', 'table')!;
const maxQ = Number(arg('max', '4000'));
const clear = Number(arg('clear', '2'));   // keep positions whose best beats the runner-up by > this many SE

const rules = rulesForDir(dir);
const money = rules.money !== null;
const seVersion = seVersionOf(dir);   // older runs stored gapSe sqrt(k) short; pairedSe corrects on read

/**
 * pass 1: one lightweight reference per decision, then keep only the questions that can be GRADED.
 *
 * The old rule sampled on EV spread (best minus worst). Spread says the options are far apart
 * overall; it says nothing about whether the best is separable from the runner-up, which is the
 * only thing a verdict rests on. Selecting on spread produced a pack that was 80% discards with a
 * mean best-vs-runner-up gap of $0.60 against a $1.07 error bar - three quarters of it ungradeable.
 *
 * Select on `gap > clear * se` instead. Only ~4% of discards clear 2 SE, but 4% of 392k discards is
 * still ~15,700 positions, far more than a pack needs. Within each decision kind we take decisive
 * positions only, and hold the kind mix at the run's own proportions so a discard trainer stays a
 * discard trainer. A kind whose decisive pool is short is topped up from its closest calls, and the
 * shortfall is reported rather than passed off as full coverage.
 */
// `sep` is the separation in standard errors; `turn` is the player-turn the decision was made on.
// These were both called `t` and the phase report silently bucketed decisions by their t-statistic.
interface Ref { g: number; h: number; d: number; spread: number; k: string; sep: number; turn: number }
const decisive = new Map<string, Ref[]>(), close = new Map<string, Ref[]>(), seen = new Map<string, number>();
eachEval(dir, (e) => {
  if (e.actions.length <= 1) return;
  const best = e.actions[0]!, second = e.actions[1]!;
  const spread = best.ev - e.actions[e.actions.length - 1]!.ev;
  const sep = separationT(best, second, seVersion);
  const ref: Ref = { g: e.g, h: e.h, d: e.d, spread, k: e.k, sep, turn: e.t };
  seen.set(e.k, (seen.get(e.k) ?? 0) + 1);
  const bucket = sep > clear ? decisive : close;
  let list = bucket.get(e.k); if (!list) bucket.set(e.k, list = []);
  list.push(ref);
});
const rng = makeRng(99);
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };

const totalSeen = [...seen.values()].reduce((a, b) => a + b, 0);
const chosen: Ref[] = [];
const shortfall: string[] = [];
for (const [kind, n] of [...seen.entries()].sort((a, b) => b[1] - a[1])) {
  const target = Math.round((n / totalSeen) * maxQ);
  const pool = shuffle(decisive.get(kind) ?? []);
  const take = pool.slice(0, target);
  if (take.length < target) {
    // not enough decisive positions of this kind: fall back to its closest calls, hardest first
    const backfill = (close.get(kind) ?? []).sort((a, b) => b.sep - a.sep).slice(0, target - take.length);
    take.push(...backfill);
    shortfall.push(`${kind}: ${target - backfill.length}/${target} decisive, ${backfill.length} backfilled`);
  }
  chosen.push(...take);
}
shuffle(chosen);
console.log(`selected ${chosen.length} of ${maxQ} at gap > ${clear} SE  [${[...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(decisive.get(k) ?? []).length}/${n} decisive`).join(', ')}]`);
if (shortfall.length) console.log(`  backfilled from close calls - ${shortfall.join('; ')}`);

// group by hand so each hand is replayed once
const byHand = new Map<string, Ref[]>();
for (const c of chosen) { const k = `${c.g}:${c.h}`; (byHand.get(k) ?? byHand.set(k, []).get(k)!).push(c); }

// pass 2: pull back the full record for the picked decisions only, and only the hands they belong to
const wanted = new Set(chosen.map((c) => `${c.g}:${c.h}:${c.d}`));
const full = new Map<string, EvalRecord>();
eachEval(dir, (e) => { const k = `${e.g}:${e.h}:${e.d}`; if (wanted.has(k)) full.set(k, e); });
const hands = new Map<string, HandRecord>();
for (const f of readdirSync(dir).filter((x) => x.startsWith('hands-') && x.endsWith('.jsonl.gz')))
  eachJsonlGz<HandRecord>(join(dir, f), (h) => { const k = `${h.g}:${h.h}`; if (byHand.has(k)) hands.set(k, h); });

// `se` is the paired standard error of (best.ev - this.ev): how far apart two actions must sit
// before the rollouts can tell them apart at all. The quiz must not call anything inside it a mistake.
// `disc` is the discard pool as [seat, kind, claimedBy] - what the player can actually see on the
// table, and what tells them which tiles are dead. `pm` / `pb` are every seat's exposed melds and
// bonus tiles. Together they are the visible information the coach was previously reasoning without.
interface Q { id: string; k: string; seat: number; dl: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; disc: number[][]; pm: number[][][]; pb: number[][]; bot: string; spread: number; best: string; sel: string; n: number; actions: { a: string; ev: number; se: number; win: number; dealin: number; draw: number; n: number; mix?: unknown }[] }
const questions: Q[] = [];
let handsDone = 0;
let drifted = 0, mismatched = 0;
for (const [key, list] of byHand) {
  const hr = hands.get(key); if (!hr) continue;
  const decs = decisionsOfHand(hr, rules, DEFAULT_RANDOMNESS);
  if (!decs) { drifted++; continue; }
  for (const ref of list) {
    const e = full.get(`${ref.g}:${ref.h}:${ref.d}`); if (!e) continue;
    const d = decs.find((x) => x.d === e.d); if (!d) continue;
    if (d.k !== e.k || d.p !== e.seat || d.sel !== e.sel || d.t !== e.t) { mismatched++; continue; }   // eval and replay must describe the same position
    const melds: Meld[] = d.me.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    const fih = fanInHand({ melds, bonus: d.me.b, seat: (d.p - d.dl + 4) % 4, prevailingWind: d.w });
    const last = d.pub.dl[d.pub.dl.length - 1];
    questions.push({
      id: `${e.g}:${e.h}:${e.d}`, k: e.k, seat: d.p, dl: d.dl, w: d.w, t: d.t, fih,
      h: d.me.h, dr: d.me.dr, b: d.me.b, m: d.me.m,
      disc: d.pub.dl.map((x) => [x[0]!, x[1]!, x[2]!]), pm: d.pub.m, pb: d.pub.b,
      ...(e.k === 'claim' && last ? { ld: [last[0]!, last[1]!] as [number, number] } : {}),
      bot: e.bot, spread: Number(ref.spread.toFixed(2)), best: e.best, sel: e.sel, n: e.n,
      actions: e.actions.map((a) => {
        const se = pairedSe(a, e.actions[0]!, seVersion);
        return { a: a.a, ev: Number(a.ev.toFixed(2)), se: Number((Number.isFinite(se) ? se : 0).toFixed(2)), win: Number(a.win.toFixed(2)), dealin: Number(a.dealin.toFixed(2)), draw: Number(a.draw.toFixed(2)), n: a.n, mix: a.mix };
      }),
    });
  }
  if (++handsDone % 500 === 0) process.stdout.write(`\r${handsDone}/${byHand.size} hands replayed`);
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ run: dir.split('/').pop(), money, unit: money ? '$' : 'chips', questions }));
const packs = readdirSync(outDir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => {
  const p = JSON.parse(readFileSync(join(outDir, f), 'utf8')) as { money: boolean; unit: string; questions: unknown[] };
  return { id: f.replace('.json', ''), money: p.money, unit: p.unit, questions: p.questions.length };
});
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ packs }));
console.log(`\n${questions.length} questions -> ${outDir}/${name}.json (${money ? 'dollars' : 'chips'}); ${drifted} drifted hands skipped, ${mismatched} mismatched decisions dropped`);
// Decisive positions are not spread evenly through a hand: late decisions resolve because the hands
// are committed, early ones rarely do. Selecting on decisiveness therefore skews the pack late, and
// that skew is a property of the trainer worth stating rather than discovering.
{
  const phase = (t: number) => (t <= 15 ? 'early' : t <= 35 ? 'mid' : 'late');
  const mix = new Map<string, number>(), all = new Map<string, number>();
  for (const q of questions) mix.set(phase(q.t), (mix.get(phase(q.t)) ?? 0) + 1);
  for (const list of [...decisive.values(), ...close.values()]) for (const r of list) all.set(phase(r.turn), (all.get(phase(r.turn)) ?? 0) + 1);
  const show = (m: Map<string, number>, n: number) => ['early', 'mid', 'late'].map((p) => `${p} ${(100 * (m.get(p) ?? 0) / Math.max(1, n)).toFixed(0)}%`).join('  ');
  const seenTotal = [...all.values()].reduce((a, b) => a + b, 0);
  console.log(`  phase mix: pack [${show(mix, questions.length)}] vs run [${show(all, seenTotal)}] - decisive positions cluster late`);
}
