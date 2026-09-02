/** What a graded directory actually contains, one `g:h:d` per line. Verifies `--only` grades
 *  exactly what it was asked for and nothing else. */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eachJsonlGz } from './stats.js';
import type { EvalRecord } from './evaluate.js';
const dir = process.argv[2]!;
const got: string[] = [];
for (const f of readdirSync(dir).filter((x) => x.startsWith('evals-') && x.endsWith('.jsonl.gz'))) {
  eachJsonlGz<EvalRecord>(join(dir, f), (r) => got.push(`${r.g}:${r.h}:${r.d}`));
}
for (const k of got.sort()) console.log(k);
