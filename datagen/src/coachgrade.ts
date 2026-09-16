/**
 * Would smarter opponents in the play-outs change the answers?
 *
 *   tsx src/coachgrade.ts --pack min1-nowild --run ../data/gen/run-min1-nowild --n 200 --rollouts 256 --worker 0 --workers 4 --out ../data/gen/coachgrade-w0.jsonl
 *
 * Every pack answer is the measured best when the rest of the hand is played by `shanten` bots,
 * which play for speed and never defend. Changs asked whether measuring with smarter bots would
 * change the answers. This takes hard questions from a pack (not a win, gap of 8 SE or less, the
 * recorded seat chose otherwise, the same test as the app's "hard only"), rebuilds each position
 * from the question alone, and judges it twice on the same hidden deals: once with shanten bots,
 * once with the Coach in all four chairs, reading danger at the pack's own Joker count.
 *
 * The Coach plays about 120 times slower, so only the pack's top three actions are judged. A
 * changed answer counts as real when the Coach arm's best beats the shanten arm's best by more than
 * two paired standard errors inside the Coach arm; anything smaller is noise at this sample.
 */
import { readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { rejudge, pairedGap, encAction, snapshotFromQuestion, pendingOf, AltReadsCoachBot, CoachBot, readsFor, fnv1a, type PackQuestion } from 'sg-mahjong-solver';
import { rulesForDir } from './tablerules.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const pack = arg('pack', 'min1-nowild'), run = arg('run', '../data/gen/run-min1-nowild');
const N = Number(arg('n', '200')), rollouts = Number(arg('rollouts', '256')), top = Number(arg('top', '3'));
const worker = Number(arg('worker', '0')), workers = Number(arg('workers', '1')), out = arg('out', '../data/gen/coachgrade.jsonl');

type Q = PackQuestion & { id: string; k: string; best: string; sel: string; actions: { a: string; ev: number; se?: number }[] };
const hard = (q: Q) => {
  if (q.best === 'win' || q.sel === q.best) return false;
  const a = [...q.actions].sort((x, y) => y.ev - x.ev); const se = a[1]?.se ?? 0;
  return a.length > 1 && se > 0 && (a[0]!.ev - a[1]!.ev) / se <= 8;
};

const dir = `../web/public/quiz/${pack}`;
const ix = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { table: { wildcards: number } };
const all: Q[] = [];
/**
 * `--select hard` (default) is the app's hard-only test. `--select pong` takes every claim where the
 * pack's best is a Pong, and judges only that Pong against passing - the positions the money test
 * asks about.
 */
const select = arg('select', 'hard');
const picked = (q: Q) => (select === 'pong' ? q.k === 'claim' && q.best.startsWith('pong') && q.actions.some((a) => a.a === 'pass') : hard(q));
for (const f of readdirSync(dir).filter((x) => /^\d+\.json$/.test(x)).sort())
  for (const q of (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { questions: Q[] }).questions) if (picked(q)) all.push(q);
// a fixed, spread-out sample: order by a hash of the id, take the first N, then this worker's share
const sample = all.sort((a, b) => fnv1a(a.id) - fnv1a(b.id)).slice(0, N).filter((_, i) => i % workers === worker);

const rules = rulesForDir(run);
const reads = readsFor(ix.table.wildcards);
const coach = () => (ix.table.wildcards === 0 ? new AltReadsCoachBot(reads) : new CoachBot());
const seed = 20260917;

for (const q of sample) {
  const t0 = Date.now();
  try {
    const snap = snapshotFromQuestion(q, rules);
    const p = pendingOf(snap, rules);
    const want = select === 'pong' ? [q.best, 'pass'] : [...q.actions].sort((x, y) => y.ev - x.ev).slice(0, top).map((x) => x.a);
    const legal = p.legal.filter((l) => want.includes(encAction(l)));
    const judge = (policy: 'shanten' | (() => CoachBot)) => {
      const r = rejudge(snap, rules, p.seat, legal, { rollouts, seed, key: q.id, policy });
      const s = [...r].sort((x, y) => y.ev - x.ev);
      return { best: s[0]!.a, all: r };
    };
    const S = judge('shanten');
    const C = judge(coach);
    const inC = (a: string) => C.all.find((x) => x.a === a)!;
    const g = pairedGap(inC(C.best), inC(S.best));         // coach arm: its own best minus the shanten arm's best
    const evOf = (arm: typeof S, a: string) => arm.all.find((x) => x.a === a)?.ev ?? null;
    const line = { id: q.id, k: q.k, t: q.t, pack: q.best, shanten: S.best, coach: C.best, gap: g.gap, se: g.se, clear: C.best !== S.best && g.gap > 2 * g.se,
      evS: Object.fromEntries(want.map((a) => [a, evOf(S, a)])), evC: Object.fromEntries(want.map((a) => [a, evOf(C, a)])), ms: Date.now() - t0 };
    appendFileSync(out, JSON.stringify(line) + '\n');
    console.log(`${q.id.padEnd(14)} ${q.k.padEnd(8)} pack ${q.best.padEnd(12)} shanten ${S.best.padEnd(12)} coach ${C.best.padEnd(12)} ${line.clear ? 'CHANGED' : C.best !== S.best ? 'noise' : 'same'}  ${(line.ms / 1000).toFixed(0)}s`);
  } catch (e) {
    appendFileSync(out, JSON.stringify({ id: q.id, error: (e as Error).message }) + '\n');
    console.log(`${q.id} failed: ${(e as Error).message}`);
  }
}
