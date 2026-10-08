/**
 * Re-judge every question of a pack with the Coach in all four chairs of the play-outs (D-037).
 *
 *   tsx src/coachpack.ts --pack strong-nowild --run ../data/gen/run-strong2-nowild --out ../data/gen/coachpacks/strong-nowild --rollouts 256 --top 4 --worker 0 --workers 6
 *   tsx src/coachpack.ts --pack strong-nowild --out ../data/gen/coachpacks/strong-nowild --merge
 *
 * Every answer the app gives today rests on play-outs finished by the `shanten` bots, which never
 * defend and rarely win first. Changs disputed a verdict on 2026-09-28, the Coach-played judge did
 * not uphold it, and he said no answer may come from simple bots. The simple bots still choose the
 * positions, because that is cheap; here each question's throws are judged again with the Coach
 * playing out the rest of the hand, and the pack's answer becomes that.
 *
 * What is judged: for a discard, the top `top` throws by the old grade plus the throw the recorded
 * seat made, so a mistake verdict on the player's own throw is always Coach-judged; for a claim or
 * a self decision, every legal action. A win on offer keeps the rule (D-033). The question keeps
 * its position, its tips and its ids, gains `judge: 'coach'` and the Coach-judged actions, and its
 * cause is worked out again where the best throw moved. Shards are independent files, so each
 * worker takes shards by number and writes them under `--out`; `--merge` then writes the per-pack
 * index from the finished shards, copying the table and placement from the source index.
 *
 * Resume: a shard already present under `--out` is skipped, so a killed run continues.
 *
 * `--src <dir>` reads the pack from somewhere other than `web/public/quiz/<pack>`, for a pack built
 * but not yet on the site. `--drop-close` leaves out a question whose best no longer beats its
 * runner-up by two standard errors after the re-judging (a win on offer is kept by the rule), which
 * is the `--verify` rule of `quizpack.ts`, so a pack graded at 64 play-outs by the Coach can be
 * finished here at 256 instead of in the builder's single thread.
 *
 * `--ids <file>` (one question id a line) judges only those questions and copies the rest of their
 * shard as it is; a shard holding none of them is not written. With `--rollouts 512 --seed <n>` this
 * judges a few questions of a finished pack again at more play-outs, and `--merge --partial --to`
 * puts them back into the whole pack.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rejudge, pairedGap, encAction, snapshotFromQuestion, pendingOf, visibleOfQuestion, AltReadsCoachBot, CoachBot, readsFor, rankDiscards, suggestCause, type PackQuestion, type PackIndex, type Context, type Cause, type RejudgedAction } from 'sg-mahjong-solver';
import type { Meld, TileKind } from 'sg-mahjong-engine';
import { rulesForDir } from './tablerules.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const pack = arg('pack', 'strong-nowild'), run = arg('run', '../data/gen/run-strong2-nowild');
const out = arg('out', `../data/gen/coachpacks/${pack}`);
const rollouts = Number(arg('rollouts', '256')), top = Number(arg('top', '4'));
const worker = Number(arg('worker', '0')), workers = Number(arg('workers', '1'));
const merge = process.argv.includes('--merge');
/** `--limit N`: judge only the first N questions of this worker's first shard, for a smoke run */
const limit = Number(arg('limit', '0'));
const seed = Number(arg('seed', '20260928'));
const dropClose = process.argv.includes('--drop-close');
const only = process.argv.includes('--ids') ? new Set(readFileSync(arg('ids', ''), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) : null;

type Action = { a: string; ev: number; se: number; win: number; dealin: number; draw: number; n: number; mix?: unknown };
type Q = PackQuestion & { id: string; k: string; best: string; sel: string; n: number; c: Cause | null; rule?: 'win'; judge?: 'coach'; actions: Action[]; h: number[]; m: number[][]; disc?: number[][]; pm?: number[][][]; pb?: number[][]; b: number[]; seat: number; dl?: number; w: number; t: number };

const srcDir = arg('src', `../web/public/quiz/${pack}`);
const srcIx = JSON.parse(readFileSync(join(srcDir, 'index.json'), 'utf8')) as PackIndex;
mkdirSync(out, { recursive: true });

/**
 * `--merge --partial --to <dir>` writes a pack that can go on the site before every shard is
 * re-judged: a shard already judged comes from `--out`, any other is copied from the pack as shipped,
 * and each question still says which judge it rests on. It writes to `--to`, never into `--out`,
 * because a running worker takes any shard present under `--out` as judged and would skip it. The
 * index carries `judge: 'coach'` only when every shard was re-judged.
 */
const partial = process.argv.includes('--partial');
if (merge) {
  const to = arg('to', out);
  if (partial && to === out) throw new Error('--partial needs --to <dir> apart from --out');
  mkdirSync(to, { recursive: true });
  let judged = 0, coachMarked = 0, total = 0, fewest = Infinity;
  const shards = srcIx.shards.map((s) => {
    const mine = join(out, s.file);
    if (!existsSync(mine) && !partial) throw new Error(`${s.file} is not judged yet; pass --partial --to <dir> to fill from the shipped pack`);
    if (existsSync(mine)) judged++;
    const text = readFileSync(existsSync(mine) ? mine : join(srcDir, s.file), 'utf8');
    if (to !== out) writeFileSync(join(to, s.file), text);
    const qs = (JSON.parse(text) as { questions: Q[] }).questions;
    for (const q of qs) { total++; if (q.judge === 'coach') { coachMarked++; fewest = Math.min(fewest, q.n); } }
    const kinds: Record<string, number> = {}, causes: Record<string, number> = {};
    for (const q of qs) { kinds[q.k] = (kinds[q.k] ?? 0) + 1; if (q.c) causes[q.c] = (causes[q.c] ?? 0) + 1; }
    return { file: s.file, n: qs.length, kinds, causes };
  });
  // the mark goes by the questions, not the shards: a pack re-judged whole and then partly again at
  // more play-outs is still wholly the Coach's, and its `rollouts` is the fewest any question had
  const whole = coachMarked === total;
  const { judge: _j, rollouts: _r, ...base } = srcIx;
  const ix = { ...base, shards, questions: shards.reduce((a, s) => a + s.n, 0), ...(whole ? { judge: 'coach' as const, rollouts: fewest } : {}) };
  writeFileSync(join(to, 'index.json'), JSON.stringify(ix));
  console.log(`merged ${shards.length} shards (${judged} re-judged by the Coach), ${ix.questions} questions -> ${to}/index.json`);
  process.exit(0);
}

const rules = rulesForDir(run);
const reads = readsFor(srcIx.table.wildcards);
const coach = () => (srcIx.table.wildcards === 0 ? new AltReadsCoachBot(reads) : new CoachBot());
const minimumFan = srcIx.table.minimumTai === 2 ? 2 : 1;

/** the pack's action shape: best first, each with its paired standard error against the best, as the builder writes it */
const toActions = (r: RejudgedAction[]): Action[] => {
  const sorted = [...r].sort((a, b) => b.ev - a.ev);
  return sorted.map((a) => {
    const se = a === sorted[0] ? 0 : pairedGap(sorted[0]!, a).se;
    return { a: a.a, ev: Number(a.ev.toFixed(2)), se: Number((Number.isFinite(se) ? se : 0).toFixed(2)), win: Number(a.win.toFixed(2)), dealin: Number(a.dealin.toFixed(2)), draw: Number(a.draw.toFixed(2)), n: a.n, mix: a.mix };
  });
};

/** the same cause the builder works out, from the question alone */
const causeOf = (q: Q, best: string): Cause | null => {
  if (q.k !== 'discard' || q.sel === best || !q.sel.startsWith('d:') || !best.startsWith('d:')) return null;
  try {
    const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2) as TileKind[], concealed: m[1] === 1 }));
    const visible = visibleOfQuestion(q);
    const seat = q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat;
    const ctx: Context = { seat, prevailingWind: q.w, bonus: q.b as TileKind[], playerTurns: q.t, minimumFan, selfDrawMinimumFan: rules.self_draw_minimum_tai ?? 1, reads, jokers: srcIx.table.wildcards, visible,
      opponentMelds: (q.pm ?? []).map((ms, s) => (s === q.seat ? -1 : ms.length)).filter((n) => n >= 0) };
    const r = rankDiscards(q.h as TileKind[], melds, ctx);
    return suggestCause(q.h as TileKind[], melds, { bonus: q.b as TileKind[], seat, prevailingWind: q.w, melds, minimumFan, selfDrawMinimumFan: rules.self_draw_minimum_tai ?? 1 },
      r.options, Number(q.sel.slice(2)) as TileKind, Number(best.slice(2)) as TileKind).suggested;
  } catch { return null; }
};

const mine = srcIx.shards.filter((_, i) => i % workers === worker);
let done = 0, changed = 0, failed = 0;
const dropped = new Set<string>();
const t0 = Date.now();
for (const s of mine) {
  const target = join(out, s.file);
  if (existsSync(target)) { console.log(`${s.file} already judged, skipped`); continue; }
  const all = (JSON.parse(readFileSync(join(srcDir, s.file), 'utf8')) as { questions: Q[] }).questions;
  if (only && !all.some((q) => only.has(q.id))) continue;
  const qs = limit > 0 ? all.slice(0, limit) : all;
  for (const q of qs) {
    if (only && !only.has(q.id)) continue;
    try {
      const snap = snapshotFromQuestion(q, rules);
      const p = pendingOf(snap, rules);
      const byOld = [...q.actions].sort((a, b) => b.ev - a.ev).map((a) => a.a);
      const want = new Set<string>(q.k === 'discard' ? [...byOld.slice(0, top), q.sel] : byOld);
      if (byOld.includes('win')) want.add('win');
      const legal = p.legal.filter((l) => want.has(encAction(l)));
      if (legal.length < 2) { q.judge = 'coach'; continue; }      // one legal action: nothing to judge, but the mark says the Coach looked
      const r = rejudge(snap, rules, p.seat, legal, { rollouts, seed, key: q.id, policy: coach });
      const actions = toActions(r);
      const oldBest = q.best;
      q.actions = actions; q.n = rollouts; q.judge = 'coach';
      q.best = q.rule === 'win' && actions.some((a) => a.a === 'win') ? 'win' : actions[0]!.a;
      if (q.best !== oldBest) { changed++; q.c = causeOf(q, q.best); }
      // the builder's verify rule: the best must beat the runner-up past two of the runner-up's paired SE
      if (dropClose && q.rule !== 'win' && actions.length > 1 && !(actions[0]!.ev - actions[1]!.ev > 2 * actions[1]!.se)) { dropped.add(q.id); }
    } catch (e) { failed++; q.judge = undefined; console.log(`${q.id} failed: ${(e as Error).message}`); }
    if (++done % 25 === 0) console.log(`worker ${worker}: ${done} judged, ${changed} best moved, ${dropped.size} dropped, ${failed} failed, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  const keep = qs.filter((q) => !dropped.has(q.id));
  writeFileSync(target, JSON.stringify({ questions: keep }));
  console.log(`${s.file}: ${keep.length} questions written${dropClose ? `, ${qs.length - keep.length} dropped` : ''}`);
  if (limit > 0) break;
}
console.log(`worker ${worker} finished: ${done} judged, ${changed} best moved, ${dropped.size} dropped, ${failed} failed, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
