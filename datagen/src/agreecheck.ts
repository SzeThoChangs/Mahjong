/**
 * Do two different play-out bots name the same best move on the SAME positions?
 *
 *   tsx src/agreecheck.ts <dirA> <dirB>
 *
 * The whole method rests on an argument nobody had checked. A play-out bot is weak, so every EV it
 * produces is wrong - but it plays both branches, so the wrongness is supposed to cancel and the
 * COMPARISON survive. That holds only while the bot's weakness is the same down both branches. It
 * stops holding when the choice being graded is about a plan the bot cannot carry out.
 *
 * `selectDecisions` keys only off the seed, so two runs with the same seed and different `--policy`
 * grade exactly the same decisions. Anywhere they disagree, the cancelling argument has failed and
 * the label is an artefact of whichever bot happened to play it out.
 *
 * What this CANNOT show: every policy available here (isolation, shanten, efficiency) is a
 * shape-efficiency bot with no colour target, so agreement between them is silent about colour
 * hands - the case the argument is most likely to fail on. Disagreement is decisive; agreement is
 * only evidence that these particular bots agree.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eachJsonlGz } from './stats.js';
import { separationT, seVersionOf } from './se.js';
import type { EvalRecord } from './evaluate.js';

const load = (dir: string) => {
  const v = seVersionOf(dir);
  const m = new Map<string, EvalRecord>();
  for (const f of readdirSync(dir).filter((x) => x.startsWith('evals-') && x.endsWith('.jsonl.gz'))) {
    eachJsonlGz<EvalRecord>(join(dir, f), (r) => m.set(`${r.g}:${r.h}:${r.d}`, r));
  }
  return { m, v };
};
const [dirA, dirB] = [process.argv[2]!, process.argv[3]!];
const A = load(dirA), B = load(dirB);

interface Bucket { n: number; agree: number }
const bump = (t: Map<string, Bucket>, k: string, ok: boolean) => { const c = t.get(k) ?? { n: 0, agree: 0 }; c.n++; if (ok) c.agree++; t.set(k, c); };
const byKind = new Map<string, Bucket>(), byPhase = new Map<string, Bucket>(), byDecisive = new Map<string, Bucket>();
let n = 0, agree = 0;

/** is this decision one the quiz would use - a clear best, separated by more than `t` standard errors? */
const decisive = (r: EvalRecord, v: number, t = 2) => {
  if (r.actions.length < 2) return false;
  return separationT(r.actions[0]!, r.actions[1]!, v) > t;
};

for (const [k, a] of A.m) {
  const b = B.m.get(k); if (!b) continue;
  const ok = a.best === b.best;
  n++; if (ok) agree++;
  bump(byKind, a.k, ok);
  bump(byPhase, a.t < 15 ? 'early (turn <15)' : a.t < 30 ? 'mid (15-29)' : 'late (30+)', ok);
  const dA = decisive(a, A.v), dB = decisive(b, B.v);
  bump(byDecisive, dA && dB ? 'both call it decisive' : dA || dB ? 'one calls it decisive' : 'neither is decisive', ok);
}

const pc = (c: Bucket) => `${(100 * c.agree / Math.max(1, c.n)).toFixed(1)}%`;
const show = (title: string, t: Map<string, Bucket>) => {
  console.log(`\n${title}`);
  for (const [k, c] of [...t].sort((x, y) => y[1].n - x[1].n)) console.log(`  ${k.padEnd(26)} ${pc(c)}   (n=${c.n})`);
};
console.log(`${n} decisions graded by both play-out bots`);
console.log(`they name the SAME best move on ${agree} of them (${pc({ n, agree })})`);
show('by decision kind', byKind);
show('by how late it is', byPhase);
show('by whether the grade is decisive (this is the subset the quiz uses)', byDecisive);
