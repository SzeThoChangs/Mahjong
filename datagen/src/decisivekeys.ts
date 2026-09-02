/**
 * List the decisions a graded run came out SURE about.  tsx src/decisivekeys.ts <dir> [se] > keys.txt
 *
 * One `g:h:d` per line, for `evaluate.ts --only`. About 4% of decisions clear 2 SE; the rest are
 * ties where two graders differ because there is nothing to agree about. Feeding an expensive
 * grader only these is what makes comparing it affordable, and it is also the set the quiz draws
 * from, so it is the population we actually care about.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eachJsonlGz } from './stats.js';
import { separationT, seVersionOf } from './se.js';
import type { EvalRecord } from './evaluate.js';

const dir = process.argv[2]!;
const minSe = Number(process.argv[3] ?? 2);
const v = seVersionOf(dir);
let seen = 0, kept = 0;
for (const f of readdirSync(dir).filter((x) => x.startsWith('evals-') && x.endsWith('.jsonl.gz'))) {
  eachJsonlGz<EvalRecord>(join(dir, f), (r) => {
    seen++;
    if (r.actions.length < 2) return;
    if (separationT(r.actions[0]!, r.actions[1]!, v) > minSe) { kept++; console.log(`${r.g}:${r.h}:${r.d}`); }
  });
}
console.error(`${kept} of ${seen} decisions clear ${minSe} SE (${(100 * kept / Math.max(1, seen)).toFixed(1)}%)`);
