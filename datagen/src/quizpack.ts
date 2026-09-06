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
import { eachEval, phaseOfTurn, PHASES } from './evalstats.js';
import { pairedSe, separationT, seVersionOf } from './se.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, type EvalRecord } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { liveCalls } from 'sg-mahjong-solver';
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
 * still ~15,700 positions, far more than a pack needs. Within each stratum we take decisive
 * positions only, and hold the stratum mix at the run's own proportions. A stratum whose decisive
 * pool is short is topped up from its closest calls, and the shortfall is reported rather than
 * passed off as full coverage.
 *
 * A stratum is decision KIND x PHASE, not kind alone. Kind alone holds a discard trainer to being a
 * discard trainer and nothing else, and decisiveness is very unevenly spread through a hand: 7.0% of
 * late discards clear 2 SE against 1.4% of early ones, because a late hand is committed and an early
 * one is still every hand at once. Selecting on decisiveness within kind therefore delivered a pack
 * that was 43% late and 17% early against a run that is 25% late and 37% early - a trainer that
 * quietly declined to ask the opening questions, which are the ones a player has the most turns to
 * get wrong. Adding phase to the key costs nothing: every stratum still fills from decisive
 * positions alone at 5,000 questions. Early discards are the binding one (2,066 decisive for ~1,550
 * wanted), so that slice is drawn thin and repeats across large packs sooner than the others.
 */
// `sep` is the separation in standard errors; `turn` is the player-turn the decision was made on.
// These were both called `t` and the phase report silently bucketed decisions by their t-statistic.
interface Ref { g: number; h: number; d: number; spread: number; k: string; sep: number; turn: number }
const stratumOf = (kind: string, turn: number) => `${kind}/${phaseOfTurn(turn)}`;
const decisive = new Map<string, Ref[]>(), close = new Map<string, Ref[]>(), seen = new Map<string, number>();
eachEval(dir, (e) => {
  if (e.actions.length <= 1) return;
  const best = e.actions[0]!, second = e.actions[1]!;
  const spread = best.ev - e.actions[e.actions.length - 1]!.ev;
  const sep = separationT(best, second, seVersion);
  const ref: Ref = { g: e.g, h: e.h, d: e.d, spread, k: e.k, sep, turn: e.t };
  const stratum = stratumOf(e.k, e.t);
  seen.set(stratum, (seen.get(stratum) ?? 0) + 1);
  const bucket = sep > clear ? decisive : close;
  let list = bucket.get(stratum); if (!list) bucket.set(stratum, list = []);
  list.push(ref);
});
const rng = makeRng(99);
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };

const totalSeen = [...seen.values()].reduce((a, b) => a + b, 0);
const chosen: Ref[] = [];
const shortfall: string[] = [], drawnThin: string[] = [];
const strata = [...seen.entries()].sort((a, b) => b[1] - a[1]);
/**
 * How many candidates each stratum draws for every question it will keep.
 *
 * The pack is meant to TEACH the shape tips as well as ask questions, and a tip can only be named
 * on a position it is actually about - three pairs in the hand, a spare beside your own triplet, two
 * ways to stay ready. Those positions are a minority, so a pack drawn straight from the decisive
 * pool names a shape on very few of its questions and some tips never come up at all.
 *
 * So each stratum draws more decisive positions than it needs and drops the untagged ones first when
 * it trims back to size. The stratum mix is unchanged - every stratum still ends at the same count -
 * and nothing is selected on its ANSWER, only on whether a named shape is what the question is
 * about.
 *
 * About 8% of CANDIDATES are about a tip - fewer than the one discard in twelve, because claim and
 * self decisions can never carry a shape tag - and every tagged candidate is kept, so the tagged
 * share of the pack is almost exactly this number times that 8%. Measured on 2026-09-05: at 2.5 the
 * coach pack has 840 tagged questions, and adding five detectors to the tagger changed that by one,
 * because the constraint was never how many shapes could be named. It is how many candidates are
 * drawn. Raised to 5 on 2026-09-05 for that reason.
 *
 * The cost is pass 2, which replays every candidate hand, so it is the build that gets slower and
 * not the pack. The other cost is not time: a third of the pack ends up being about a named shape
 * against 8% drawn straight, so the Real Quiz over-represents teachable positions by about four
 * times. That is deliberate - a tip can only be taught on a position it is about - but it is the
 * reason this is a flag rather than a constant, so the old draw stays reproducible with
 * `--overdraw 2.5`.
 */
const OVERDRAW = Number(arg('overdraw', '5'));
const want = new Map<string, number>();
for (const [stratum, n] of strata) {
  const target = Math.round((n / totalSeen) * maxQ);
  want.set(stratum, target);
  const pool = shuffle(decisive.get(stratum) ?? []);
  const take = pool.slice(0, Math.round(target * OVERDRAW));
  if (take.length < target) {
    // not enough decisive positions in this stratum: fall back to its closest calls, hardest first
    const backfill = (close.get(stratum) ?? []).sort((a, b) => b.sep - a.sep).slice(0, target - take.length);
    take.push(...backfill);
    shortfall.push(`${stratum}: ${target - backfill.length}/${target} decisive, ${backfill.length} backfilled`);
  }
  // How much of the stratum's decisive pool a pack this size consumes. Above ~50% the questions stop
  // being a sample of the position type and start being most of the positions of that type there are.
  if (pool.length && target / pool.length > 0.5) drawnThin.push(`${stratum} ${Math.round(100 * target / pool.length)}% of ${pool.length}`);
  chosen.push(...take);
}
shuffle(chosen);
console.log(`drew ${chosen.length} candidates for a pack of ${maxQ} at gap > ${clear} SE  [${strata.map(([k, n]) => `${k} ${(decisive.get(k) ?? []).length}/${n} decisive`).join(', ')}]`);
if (shortfall.length) console.log(`  backfilled from close calls - ${shortfall.join('; ')}`);
if (drawnThin.length) console.log(`  drawn thin - ${drawnThin.join(', ')}`);

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
// `tp` is the ids of the shape tips this position is about, from `shapetag.ts` - not stored for the
// app to read (it works them out again from the hand, so the wording stays in one place) but for the
// pack summary, which reports how many questions each tip can be taught on.
interface Q { tp: string[]; id: string; k: string; seat: number; dl: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; disc: number[][]; pm: number[][][]; pb: number[][]; bot: string; spread: number; best: string; sel: string; n: number; actions: { a: string; ev: number; se: number; win: number; dealin: number; draw: number; n: number; mix?: unknown }[] }
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
    // which of the book's shape tips this decision is actually about, given the throws on offer
    const throws = e.k === 'discard' ? e.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2))) : [];
    // the table view, so the tips that depend on what can legally be declared can run at all
    const view = {
      bonus: d.me.b, seat: (d.p - d.dl + 4) % 4, prevailingWind: d.w, melds,
      minimumFan: rules.minimum_tai, selfDrawMinimumFan: rules.self_draw_minimum_tai,
    };
    const tp = throws.length ? liveCalls(d.me.h, d.me.m.length, throws, view).map((c) => c.tip) : [];
    questions.push({
      tp,
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
/**
 * Trim each stratum back to the size it was always going to be, dropping untagged questions first.
 *
 * Only the ORDER within a stratum changes here. Every stratum ends at the count the run's own
 * proportions asked for, so the pack is still a discard trainer in the same measure as before, and a
 * question is never kept or dropped for having an easy answer - the tag says what the position is
 * about, not what the answer was.
 */
const kept: Q[] = [];
const byStratum = new Map<string, Q[]>();
for (const q of questions) {
  const key = stratumOf(q.k, q.t);
  let list = byStratum.get(key); if (!list) byStratum.set(key, list = []);
  list.push(q);
}
for (const [stratum, list] of byStratum) {
  list.sort((a, b) => (b.tp.length ? 1 : 0) - (a.tp.length ? 1 : 0));
  kept.push(...list.slice(0, want.get(stratum) ?? list.length));
}
shuffle(kept);
const tagged = kept.filter((q) => q.tp.length).length;
const perTip = new Map<string, number>();
for (const q of kept) for (const t of q.tp) perTip.set(t, (perTip.get(t) ?? 0) + 1);
console.log(`\n${tagged} of ${kept.length} questions have a shape tip to teach on  [${[...perTip].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}]`);

mkdirSync(outDir, { recursive: true });
/**
 * The table the pack was played at, written into the pack.
 *
 * Every pack until 2026-09-06 came from the same table and nothing recorded which, so a second pack
 * from a different one would have been indistinguishable from the first. The wildcard count and the
 * minimum are the two rules that vary between the tables Changs plays, and both change the game
 * measurably - without wildcards hands run 54 turns against 40 and a late throw is about twice as
 * likely to deal in. A grader reading this pack needs to know which game it is looking at.
 */
const table = { wildcards: rules.jokers.count, minimumTai: rules.minimum_tai };
writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ run: dir.split('/').pop(), money, unit: money ? '$' : 'chips', table, questions: kept }));
// The index lists the QUIZ packs, and this directory holds more than those: `spot.json` moved in on
// 2026-09-04 and has positions rather than questions, so a scan that trusts the extension puts a
// phantom pack in the Real Quiz picker. Anything without questions is not a quiz pack.
const packs = readdirSync(outDir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => {
  const p = JSON.parse(readFileSync(join(outDir, f), 'utf8')) as { money?: boolean; unit?: string; table?: unknown; questions?: unknown[] };
  return p.questions ? { id: f.replace('.json', ''), money: p.money, unit: p.unit, table: p.table, questions: p.questions.length } : null;
}).filter((x) => x !== null);
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ packs }));
console.log(`\n${kept.length} questions -> ${outDir}/${name}.json (${money ? 'dollars' : 'chips'}); ${drifted} drifted hands skipped, ${mismatched} mismatched decisions dropped`);
// Phase is a selection key now, so this is the check that it worked rather than a warning that it
// did not. The two rows should agree to within rounding; a gap means a stratum was backfilled or
// ran dry, and the lines above say which.
{
  // Over `kept`, not `questions`. `questions` is every candidate materialised in pass 2, and since
  // OVERDRAW arrived on 2026-09-03 that is two to four times the pack - so this line reported the
  // CANDIDATE mix under the word "pack" and drifted whenever the draw changed, which looked exactly
  // like the skew the stratum keys were added to prevent. The pack's own mix cannot drift: every
  // stratum ends at a count taken from the run's proportions.
  const mix = new Map<string, number>(), all = new Map<string, number>();
  for (const q of kept) { const p = phaseOfTurn(q.t); mix.set(p, (mix.get(p) ?? 0) + 1); }
  for (const list of [...decisive.values(), ...close.values()]) for (const r of list) { const p = phaseOfTurn(r.turn); all.set(p, (all.get(p) ?? 0) + 1); }
  const show = (m: Map<string, number>, n: number) => PHASES.map((p) => `${p} ${(100 * (m.get(p) ?? 0) / Math.max(1, n)).toFixed(0)}%`).join('  ');
  const seenTotal = [...all.values()].reduce((a, b) => a + b, 0);
  console.log(`  phase mix: pack [${show(mix, kept.length)}] vs run [${show(all, seenTotal)}]`);
}
