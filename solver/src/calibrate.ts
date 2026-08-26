/**
 * Turn the model's probabilities into verdict bands, by matching the measured ones.
 *
 *   tsx src/calibrate.ts ../web/public/quiz/money.json
 *
 * The Train tab deals synthetic hands, so there are no play-outs to grade against and no error
 * bar - it has to grade on the model. But the model emits a softmax over candidates, not chips,
 * and picking "p >= 0.4 is close enough" out of the air would just be the old invented thresholds
 * wearing a new hat.
 *
 * So calibrate against the one place both quantities exist: the quiz pack, where every option has
 * a MEASURED regret and the model can also be asked for a probability. Quantile-match the two - if
 * the measured grader calls 62% of moves at least "close enough", the model's threshold is set
 * wherever 62% of its probability ratios fall. The two graders then hand out the same mix of
 * verdicts, which is what "calibrated" means here.
 *
 * Prints the constants to paste into Trainer.tsx.
 */
import { readFileSync } from 'node:fs';
import { policyRank, type Context } from './index.js';
import type { Meld, TileKind } from 'sg-mahjong-engine';

interface Action { a: string; ev: number; se?: number }
interface Q { id: string; k: string; seat: number; dl?: number; w: number; t: number; h: number[]; b: number[]; m: number[][]; disc?: number[][]; pm?: number[][][]; pb?: number[][]; actions: Action[] }

const path = process.argv[2] ?? '../web/public/quiz/money.json';
const pack = JSON.parse(readFileSync(path, 'utf8')) as { unit: string; questions: Q[] };
const cfg = JSON.parse(readFileSync('../data/table.config.json', 'utf8')) as { minimum_fan: number; self_draw_minimum_fan: number };

// the Real quiz's measured bands, from RealQuiz.tsx verdictOf()
const [FINE, MISTAKE] = pack.unit === '$' ? [0.35, 1.5] : [0.8, 3.5];
const measuredVerdict = (regret: number, se = 0): string => {
  if (regret <= 0.01) return 'best';
  if (regret <= se) return 'unclear';
  if (regret <= Math.max(FINE, 2 * se)) return 'fine';
  if (regret <= Math.max(MISTAKE, 3 * se)) return 'mistake';
  return 'blunder';
};

const pairs: { ratio: number; regret: number; se: number }[] = [];
let hands = 0, threw = 0;
for (const q of pack.questions) {
  if (q.k !== 'discard' || q.h.length % 3 !== 2) continue;
  const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
  const visible: TileKind[] = [];
  for (const d of q.disc ?? []) visible.push(d[1]! as TileKind);
  (q.pm ?? []).forEach((ms, s) => { if (s !== q.seat) for (const m of ms) visible.push(...(m.slice(2) as TileKind[])); });
  (q.pb ?? []).forEach((bs, s) => { if (s !== q.seat) visible.push(...(bs as TileKind[])); });
  const ctx: Context = {
    seat: q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat,
    prevailingWind: q.w, bonus: q.b as TileKind[], playerTurns: q.t,
    minimumFan: cfg.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: cfg.self_draw_minimum_fan,
    visible, opponentMelds: (q.pm ?? []).map((ms, s) => (s === q.seat ? -1 : ms.length)).filter((n) => n >= 0),
  };
  let ranked;
  try { ranked = policyRank(q.h as TileKind[], melds, ctx); } catch { threw++; continue; }
  hands++;
  const pBest = ranked.options[0]!.p;
  const best = q.actions[0]!;
  for (const o of ranked.options) {
    const act = q.actions.find((a) => a.a === `d:${o.tile}`);
    if (!act) continue;
    pairs.push({ ratio: pBest > 0 ? o.p / pBest : 0, regret: best.ev - act.ev, se: act.se ?? 0 });
  }
}

console.log(`${hands} hands, ${pairs.length} options (${threw} threw)\n`);

// what share of options the MEASURED grader puts at or above each band
const share = (f: (p: typeof pairs[number]) => boolean) => pairs.filter(f).length / pairs.length;
const atLeastFine = share((p) => ['best', 'unclear', 'fine'].includes(measuredVerdict(p.regret, p.se)));
const atLeastMistake = share((p) => measuredVerdict(p.regret, p.se) !== 'blunder');

// the ratio thresholds that hand out those same shares
const sorted = [...pairs].map((p) => p.ratio).sort((a, b) => b - a);
const quantile = (s: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(s * sorted.length)))] ?? 0;
const rFine = quantile(atLeastFine);
const rMistake = quantile(atLeastMistake);

console.log(`measured grader: ${(100 * atLeastFine).toFixed(1)}% of options are at least "close enough", ${(100 * atLeastMistake).toFixed(1)}% are not blunders`);
console.log(`matching model probability ratios (p / p_best):`);
console.log(`  FINE_RATIO    = ${rFine.toFixed(4)}`);
console.log(`  MISTAKE_RATIO = ${rMistake.toFixed(4)}`);

// how well the calibrated bands actually agree, option by option
const modelVerdict = (ratio: number, isTop: boolean) =>
  isTop ? 'best' : ratio >= rFine ? 'fine' : ratio >= rMistake ? 'mistake' : 'blunder';
let agree = 0, within1 = 0;
const order = ['best', 'unclear', 'fine', 'mistake', 'blunder'];
const rank = (v: string) => Math.max(0, order.indexOf(v) - (v === 'unclear' ? 1 : 0));
for (const p of pairs) {
  const m = measuredVerdict(p.regret, p.se);
  const v = modelVerdict(p.ratio, p.ratio >= 1);
  if (rank(m) === rank(v)) agree++;
  if (Math.abs(rank(m) - rank(v)) <= 1) within1++;
}
console.log(`\nband agreement with the measured grader: exact ${(100 * agree / pairs.length).toFixed(1)}%, within one band ${(100 * within1 / pairs.length).toFixed(1)}%`);
console.log(`(exact agreement will not be high - these are different graders. Within-one-band is the honest test.)`);
