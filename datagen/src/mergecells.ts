/**
 * Pool the fitted cells from several runs into one file.
 *
 *   tsx src/mergecells.ts --out ../data/gen/plan-all-cells.json ../data/gen/plan-*-cells.json
 *
 * A `committed` fit needs one run per plan, because a run has only one locked seat and that seat
 * plays one plan. `valuerows.ts` wants every plan in a single cells file, so this is the join.
 *
 * Cells are summed rather than averaged: `sum`, `n`, `hands` and `pred` are all totals, so pooling
 * two runs that happened to cover the same cell gives the same answer as one run twice the size.
 * That should not arise here - each run contributes `committed` cells for its own plan only - but
 * the merge is written to be correct if it ever does, and it reports any key it saw twice.
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface CellData { sum: number; n: number; hands: number; pred: number }
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const outFile = oi >= 0 ? args[oi + 1]! : '../data/gen/plan-all-cells.json';
const files = args.filter((a, i) => !a.startsWith('--') && i !== oi + 1 && !(i > 0 && args[i - 1] === '--weight'));
/**
 * `--weight <file>=<w>` scales every count in one file before the pool - sum, n, hands and pred
 * alike, so the cell means are untouched and only their weight in the hands-weighted regression
 * changes. A pool of two populations by hands is a 50/50 pool; this is how the field is made to
 * count for more than half.
 */
const weights = new Map<string, number>();
for (let i = 0; i < args.length; i++) if (args[i] === '--weight') { const [f, w] = args[i + 1]!.split('='); weights.set(f!, Number(w)); }
if (!files.length) { console.error('give at least one cells file'); process.exit(1); }

const cells: Record<string, CellData> = {};
let overlaps = 0;
const from: string[] = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(f, 'utf8')) as { runDir?: string; cells: Record<string, CellData> };
  from.push(j.runDir ?? f);
  let added = 0;
  const w = weights.get(f) ?? 1;
  for (const [k, c0] of Object.entries(j.cells)) {
    const c = w === 1 ? c0 : { sum: c0.sum * w, n: c0.n * w, hands: c0.hands * w, pred: c0.pred * w };
    const cur = cells[k];
    if (cur) { overlaps++; cur.sum += c.sum; cur.n += c.n; cur.hands += c.hands; cur.pred += c.pred; }
    else { cells[k] = { ...c }; added++; }
  }
  const modes = new Set(Object.keys(j.cells).map((k) => k.split('|')[0]!));
  const plans = new Set(Object.keys(j.cells).filter((k) => k.startsWith('committed|')).map((k) => k.split('|')[1]!));
  console.log(`  ${f}${w !== 1 ? ` x${w}` : ''}: ${Object.keys(j.cells).length} cells (${added} new), modes ${[...modes].join('/')}, committed plans ${[...plans].join('/') || 'none'}`);
}
writeFileSync(outFile, JSON.stringify({ runDir: from.join(' + '), cells }, null, 0));
console.log(`\n${Object.keys(cells).length} cells written to ${outFile}${overlaps ? `, ${overlaps} keys appeared in more than one file and were summed` : ''}`);
