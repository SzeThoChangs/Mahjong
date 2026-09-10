/**
 * Build a quiz pack: real evaluated decisions, compact, for the web Real Quiz.
 *   tsx src/quizpack.ts --dir ../data/gen/run-money3 --out ../web/public/quiz --name table --max 4000
 * Every question carries the acting player's visible context and the measured EV of every legal action.
 * Two streaming passes over the evals: the first keeps only a key and a spread per decision so the sample
 * can be drawn, the second re-reads and materialises just the few thousand records that were picked.
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fanInHand, makeRng, type Meld } from 'sg-mahjong-engine';
import { eachJsonlGz } from './stats.js';
import { eachEval, phaseOfTurn, PHASES } from './evalstats.js';
import { pairedSe, separationT, seVersionOf, SE_VERSION } from './se.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, evaluateDecision, type EvalRecord, type EvalArgs } from './evaluate.js';
import { positionAt } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { liveCalls, rankDiscards, suggestCause, shardOf, shardFile, type Cause, type Context, type PackIndex } from 'sg-mahjong-solver';
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
/**
 * What a stratum's share of the pack is a share OF.
 *
 *   run       (default) its share of every decision seen, so the pack mirrors where decisions
 *             happen in a real hand. The cost shows in early discards: they are 24-38% of decisions
 *             and 1.5-2.6% of them are decisive, so the stratum runs dry at about 5,000 questions
 *             and is padded with close calls from there - 58% padding in the no-joker pack shipped
 *             on 2026-09-10 before anyone looked.
 *   decisive  its share of the decisive positions that exist. No stratum can run short, because
 *             each takes a proportional slice of a pool that is by definition there, so the pack is
 *             honest at every question and as large as the data allows. It skews to mid-game,
 *             late-game and claims, which is where being right matters - a drill full of early
 *             positions is a drill of coin flips, because early in a hand most throws do not matter
 *             yet. The phase-mix line at the end shows the skew rather than hiding it.
 */
const MIX = arg('mix', 'run') as 'run' | 'decisive';
const totalDecisive = [...decisive.values()].reduce((a, l) => a + l.length, 0);
if (MIX === 'decisive' && maxQ > totalDecisive) {
  console.log(`  --max ${maxQ} is more than the ${totalDecisive} decisive positions there are; building all of them`);
}
const want = new Map<string, number>();
for (const [stratum, n] of strata) {
  const share = MIX === 'decisive'
    ? (decisive.get(stratum) ?? []).length / Math.max(1, totalDecisive)
    : n / totalSeen;
  const target = Math.round(share * Math.min(maxQ, MIX === 'decisive' ? totalDecisive : maxQ));
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
// `c` is why the seat's own throw failed, where it did fail - see `causeOf` below.
interface Q { tp: string[]; c: Cause | null; id: string; k: string; seat: number; dl: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; disc: number[][]; pm: number[][][]; pb: number[][]; bot: string; spread: number; best: string; sel: string; n: number; actions: { a: string; ev: number; se: number; win: number; dealin: number; draw: number; n: number; mix?: unknown }[] }
const questions: Q[] = [];
let handsDone = 0;
let drifted = 0, mismatched = 0;
/**
 * Why the seat's own throw failed, read off the position at build time.
 *
 * A question records what the seat actually threw beside what the play-outs measured as best, so
 * where those differ the position holds a real mistake, and `suggestCause` can say what kind. The
 * app used to work this out in the browser, at about five milliseconds a question, and needed a
 * background pass over the whole pack so that filtering by cause never walked cold. A sharded pack
 * cannot run that pass, because a shard can only label itself, so the label is baked here instead
 * and the index can say which shard holds a "miscounted" question without anyone fetching it.
 *
 * It is also the more honest label. The browser computed it against whatever table the APP was set
 * to; this uses the table the hand was actually played at, which is the one in the run's manifest.
 * Where the two tables differ the two labels can differ, and this one is the right one.
 */
const minimumFan: 1 | 2 = rules.minimum_tai === 2 ? 2 : 1;
type Decision = NonNullable<ReturnType<typeof decisionsOfHand>>[number];
const causeOf = (e: EvalRecord, d: Decision, melds: Meld[], seat: number): Cause | null => {
  if (e.k !== 'discard' || e.sel === e.best || !e.sel.startsWith('d:') || !e.best.startsWith('d:')) return null;
  try {
    // everything the seat can see that is not its own concealed hand or own melds: the pool, the
    // other seats' exposed melds, and their bonus tiles. Without it the coach counts four copies
    // of a tile that is already dead on the table.
    const visible: number[] = d.pub.dl.map((x) => x[1]!);
    d.pub.m.forEach((ms, s) => { if (s !== d.p) for (const m of ms) visible.push(...m.slice(2)); });
    d.pub.b.forEach((bs, s) => { if (s !== d.p) visible.push(...bs); });
    const ctx: Context = {
      seat, prevailingWind: d.w, bonus: d.me.b, playerTurns: d.t, minimumFan, selfDrawMinimumFan: rules.self_draw_minimum_tai, visible,
      opponentMelds: d.pub.m.map((ms, s) => (s === d.p ? -1 : ms.length)).filter((n) => n >= 0),
    };
    const r = rankDiscards(d.me.h, melds, ctx);
    return suggestCause(d.me.h, melds, { bonus: d.me.b, seat, prevailingWind: d.w, melds, minimumFan, selfDrawMinimumFan: rules.self_draw_minimum_tai },
      r.options, Number(e.sel.slice(2)), Number(e.best.slice(2))).suggested;
  } catch { return null; }
};
/** A record's options as the pack stores them: best first, each with its paired SE against the best. */
function toActions(e: EvalRecord, version: number): Q['actions'] {
  const sorted = [...e.actions].sort((a, b) => b.ev - a.ev);
  return sorted.map((a) => {
    const se = pairedSe(a, sorted[0]!, version);
    return { a: a.a, ev: Number(a.ev.toFixed(2)), se: Number((Number.isFinite(se) ? se : 0).toFixed(2)), win: Number(a.win.toFixed(2)), dealin: Number(a.dealin.toFixed(2)), draw: Number(a.draw.toFixed(2)), n: a.n, mix: a.mix };
  });
}
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
      tp, c: causeOf(e, d, melds, view.seat),
      id: `${e.g}:${e.h}:${e.d}`, k: e.k, seat: d.p, dl: d.dl, w: d.w, t: d.t, fih,
      h: d.me.h, dr: d.me.dr, b: d.me.b, m: d.me.m,
      disc: d.pub.dl.map((x) => [x[0]!, x[1]!, x[2]!]), pm: d.pub.m, pb: d.pub.b,
      ...(e.k === 'claim' && last ? { ld: [last[0]!, last[1]!] as [number, number] } : {}),
      bot: e.bot, spread: Number(ref.spread.toFixed(2)), best: e.best, sel: e.sel, n: e.n,
      actions: toActions(e, seVersion),
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

/**
 * A second, independent look at every admitted question - the fix for the winner's curse.
 *
 * A question gets in by beating its runner-up by more than `--clear` SE on the same play-outs its
 * verdict is then reported from. Choosing the winner from a noisy sample chooses some of the
 * sample's luck along with it, so the admitted gap is biased upward. Measured on 2026-09-10 on 40
 * random coach questions re-judged at 1,024 fresh play-outs: the best held on 36, the mean gap
 * shrank 9%, and one reversed. Changs had disputed a $4.03 "big mistake" that fresh dice put at 28
 * cents, and he was right.
 *
 * So with `--verify N` each admitted question is replayed and judged again on N play-outs with a
 * different seed. One that no longer clears the bar is dropped; one that does keeps the FRESH
 * numbers, which are unbiased and usually from a larger sample. That costs about a tenth of a pack,
 * which is the honest size, and it is a step of the build rather than a one-off so every rebuild
 * pays it.
 */
const VERIFY = Number(arg('verify', '0'));
if (VERIFY > 0) {
  const hrOf = new Map<string, HandRecord>();
  for (const hr of hands.values()) hrOf.set(`${hr.g}:${hr.h}`, hr);
  const decsOf = new Map<string, NonNullable<ReturnType<typeof decisionsOfHand>>>();
  const args: EvalArgs = { dir, hands: 0, perHand: 0, rollouts: VERIFY, mode: 'sampled', policy: 'shanten',
    seed: 424242 + VERIFY, workers: 1, workerIndex: 0, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS, adaptive: false, coupled: true };
  const survivors: Q[] = [];
  let dropped = 0, changed = 0, unreplayable = 0, done = 0;
  const t0 = Date.now();
  for (const q of kept) {
    const [g, h, d] = q.id.split(':').map(Number);
    const hr = hrOf.get(`${g}:${h}`);
    let decs = hr ? decsOf.get(`${g}:${h}`) : undefined;
    if (hr && !decs) { const dd = decisionsOfHand(hr, rules, DEFAULT_RANDOMNESS); if (dd) { decs = dd; decsOf.set(`${g}:${h}`, dd); } }
    const rec = decs?.find((x) => x.d === d);
    const pos = hr && rec ? positionAt(hr, d!, rules, DEFAULT_RANDOMNESS) : null;
    if (!hr || !rec || !pos) { unreplayable++; continue; }
    const fresh = evaluateDecision(pos.g, rec, args, rules);
    const sorted = [...fresh.actions].sort((a, b) => b.ev - a.ev);
    const sep = sorted.length > 1 ? separationT(sorted[0]!, sorted[1]!, SE_VERSION) : 0;
    if (++done % 250 === 0) {
      const rate = (Date.now() - t0) / done;
      process.stdout.write(`\r  verifying ${done}/${kept.length}  dropped ${dropped}  ~${Math.round(rate * (kept.length - done) / 60000)} min left`);
    }
    if (!(sep > clear)) { dropped++; continue; }
    if (fresh.best !== q.best) changed++;
    q.best = fresh.best; q.n = fresh.n; q.actions = toActions(fresh, SE_VERSION);
    survivors.push(q);
  }
  kept.length = 0; kept.push(...survivors);
  console.log(`\n  verified at ${VERIFY} fresh play-outs each: kept ${survivors.length}, dropped ${dropped} (${(100 * dropped / Math.max(1, done)).toFixed(1)}% did not hold at ${clear} SE), best changed on ${changed}, ${unreplayable} could not replay, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

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
/**
 * The pack is a directory of shards, not one file - see `pack.ts` in the solver for the shape and
 * for why a question's shard is a hash of its id. The index and the shards are written in one pass
 * from the same lists, so a tally can never disagree with the shard it describes: a filter that
 * promised a cause the shard did not hold would only ever show up as an empty drill.
 *
 * The directory is cleared first. A smaller rebuild over an old one would otherwise leave the old
 * build's tail shards in place, unlisted by the new index but still there for anything that reads
 * the directory rather than the index.
 */
const SHARD = 100;
const modulo = Math.max(1, Math.ceil(kept.length / SHARD));
const packDir = join(outDir, name);
rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
const buckets: Q[][] = Array.from({ length: modulo }, () => []);
for (const q of kept) buckets[shardOf(q.id, modulo)]!.push(q);
const shards = buckets.map((qs, i) => {
  const kinds: Record<string, number> = {}, causes: Record<string, number> = {};
  for (const q of qs) {
    kinds[q.k] = (kinds[q.k] ?? 0) + 1;
    if (q.c) causes[q.c] = (causes[q.c] ?? 0) + 1;
  }
  writeFileSync(join(packDir, shardFile(i)), JSON.stringify({ questions: qs }));
  return { file: shardFile(i), n: qs.length, kinds, causes };
});
const packIx: PackIndex = { run: dir.split('/').pop()!, money, unit: money ? '$' : 'chips', table, questions: kept.length, placement: { by: 'fnv1a32', modulo }, shards };
writeFileSync(join(packDir, 'index.json'), JSON.stringify(packIx));
const labelled = kept.filter((q) => q.c).length;
const perCause = new Map<string, number>();
for (const q of kept) if (q.c) perCause.set(q.c, (perCause.get(q.c) ?? 0) + 1);
console.log(`${labelled} questions carry a cause  [${[...perCause].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'}]`);

/**
 * The TOP-LEVEL index, `quiz/index.json`, which lists the packs and is the file the app reads
 * first. It is a different file from the per-pack `quiz/<name>/index.json` written just above,
 * and the two must not be confused: this one says which packs exist, that one says what is in
 * each shard of one pack.
 *
 * Two layouts live in this directory. A sharded pack is a directory holding an index; a pack built
 * before 2026-09-10 (`money.json`, `nowild.json`) is still one file, and the app opens it as one
 * big shard. And not every file here is a quiz pack: `spot.json` moved in on 2026-09-04 and has
 * positions rather than questions, so a scan that trusts the extension puts a phantom pack in the
 * picker. Anything without questions is not a quiz pack.
 */
type Listed = { id: string; money?: boolean; unit?: string; table?: unknown; questions: number; shards?: number };
const packs = readdirSync(outDir, { withFileTypes: true }).map((ent): Listed | null => {
  if (ent.isDirectory()) {
    try {
      const ix = JSON.parse(readFileSync(join(outDir, ent.name, 'index.json'), 'utf8')) as PackIndex;
      return { id: ent.name, money: ix.money, unit: ix.unit, table: ix.table, questions: ix.questions, shards: ix.shards.length };
    } catch { return null; }
  }
  if (!ent.name.endsWith('.json') || ent.name === 'index.json') return null;
  const p = JSON.parse(readFileSync(join(outDir, ent.name), 'utf8')) as { money?: boolean; unit?: string; table?: unknown; questions?: unknown[] };
  return p.questions ? { id: ent.name.replace('.json', ''), money: p.money, unit: p.unit, table: p.table, questions: p.questions.length } : null;
}).filter((x) => x !== null).sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ packs }));
console.log(`\n${kept.length} questions -> ${packDir}/ in ${modulo} shards (${money ? 'dollars' : 'chips'}); ${drifted} drifted hands skipped, ${mismatched} mismatched decisions dropped`);
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
