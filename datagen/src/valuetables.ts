/**
 * Turn the cells from `valuefit.ts` into a drop-in replacement for `solver/src/tables.ts`.
 *
 *   tsx src/valuetables.ts [--cells ../data/gen/valuefit-cells.json] [--k 200] [--out ../data/gen/tables-fit.json]
 *
 * The output has exactly the shape of `TABLES`, with the same table names, the same 0/20/40 rows and
 * the same keys in each row. Only the numbers change. Keeping the key set identical matters more
 * than it looks: `lookup` interpolates between neighbouring keys and extrapolates past the ends, so
 * adding or dropping keys would change how values BETWEEN the fitted points behave, and the
 * head-to-head would then be testing two things at once.
 *
 * SHRINKAGE. A cell backed by four hands should not overwrite the study, so every cell is pulled
 * toward the study's own number in proportion to how little we have:
 *
 *     fitted = (hands * ours + k * study) / (hands + k)
 *
 * `hands` rather than decisions, because every decision in a hand shares that hand's outcome and
 * cannot disagree with it. `--k` is the number of hand-visits at which our data and the study count
 * equally, so a large `--k` produces a cautious blend and a small one trusts our data.
 *
 * TWO TABLES NEED A TRANSFORM BEFORE THEY FIT.
 *
 * All-Pong is stored under `mf1` and read under both, with the code adding 0.5 for an MF2 table. Our
 * hands were played at MF2, so the fitted figure has that 0.5 taken back out before it is stored, or
 * the correction would be applied twice.
 *
 * Chicken is stored as a PROBABILITY and converted by `(chance - 0.31) * 26`. We measured chips, not
 * chances, so the fit is put back through the inverse of that line. The stored number is no longer a
 * probability of anything and is clamped to stay inside the range the pricing code expects.
 *
 * WHAT THIS IS AN ESTIMATE OF. The expected chips of a position under the coach's own play, which is
 * what the coach should believe if it goes on playing the way it does. It is not the value under best
 * play, and it cannot see value in a plan the coach never chooses.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { TABLES } from 'sg-mahjong-solver';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const cellsFile = arg('cells', '../data/gen/valuefit-cells.json');
const K = Number(arg('k', '200'));
const outFile = arg('out', '../data/gen/tables-fit.json');
const mode = arg('mode', 'pursued');
/** Multiply every fitted chips figure by this before storing it.
 *
 *  Our numbers are realised chips per hand and the study's are far larger - a strong half-colour hand
 *  at turn 40 is 41 chips in the study and 4.2 in our games. Whatever the study's figure means, it is
 *  not the average outcome of holding that hand at this table.
 *
 *  That matters because `rankDiscards` scores a throw as hand value MINUS danger, and the danger term
 *  is real chips scaled by DANGER_WEIGHT = 40. Flattening the value side by 2.2 is arithmetically the
 *  same as raising the danger weight to 88, and the danger sweep already showed that more defence
 *  loses monotonically out to 4.5 standard errors. So a straight swap would lose for a reason that
 *  has nothing to do with whether the fitted numbers are better.
 *
 *  A single multiplier applied to every table restores the spread while leaving every comparison
 *  inside the fit untouched. It has to be one global factor, not one per table: rescaling each table
 *  separately would change which PLAN wins, which is the thing being tested. An additive constant
 *  would be pointless - it shifts every candidate throw equally and cancels in the comparison. */
const SCALE = Number(arg('scale', '1'));

type Row = Record<string, number>;
interface CellData { sum: number; n: number; hands: number; pred: number }
const raw = JSON.parse(readFileSync(cellsFile, 'utf8')) as { cells: Record<string, CellData>; totals: unknown };

/** plan id -> where its numbers live in TABLES, which rows exist, and how a chips figure is stored. */
const MAP: { plan: string; table: string; variant: string | null; rows: number[]; toStore: (chips: number) => number; fromStore: (v: number) => number }[] = [
  { plan: 'half_color', table: 'half_color_chips', variant: 'mf2', rows: [0, 20, 40], toStore: (c) => c, fromStore: (v) => v },
  { plan: 'ping_wu', table: 'ping_wu_chips', variant: 'mf2', rows: [0, 20, 40], toStore: (c) => c, fromStore: (v) => v },
  { plan: 'thirteen', table: 'thirteen_chips', variant: 'mf2', rows: [20, 40], toStore: (c) => c, fromStore: (v) => v },
  // read as mf1 for every table, with +0.5 added by the caller when the table is MF2
  { plan: 'all_pong', table: 'all_pong_chips', variant: 'mf1', rows: [0, 20, 40], toStore: (c) => c - 0.5, fromStore: (v) => v + 0.5 },
  // one turn-0 row, scaled later by the ping-wu decay
  { plan: 'all_chow', table: 'all_chow_table_10_3_turn0_mf1', variant: null, rows: [0], toStore: (c) => c, fromStore: (v) => v },
  // stored as a chance and converted by (chance - 0.31) * 26
  { plan: 'chicken', table: 'chicken_chance', variant: 'mf2', rows: [20, 40], toStore: (c) => Math.max(0.005, Math.min(0.95, c / 26 + 0.31)), fromStore: (v) => (v - 0.31) * 26 },
];

const out = JSON.parse(JSON.stringify(TABLES)) as Record<string, unknown>;
const report: string[] = [];
let fittedCells = 0, keptCells = 0;

for (const m of MAP) {
  const holder = (m.variant === null ? { '0': out[m.table] } : (out[m.table] as Record<string, Record<string, Row>>)[m.variant]) as Record<string, Row> | undefined;
  if (!holder) { report.push(`  ${m.table}: MISSING in TABLES, skipped`); continue; }
  let changed = 0, kept = 0, sumAbs = 0, worst = 0, worstKey = '';
  for (const row of m.rows) {
    const r = holder[String(row)];
    if (!r) continue;
    for (const k of Object.keys(r)) {
      const study = m.fromStore(r[k]!);                       // the study's number, in chips
      const c = raw.cells[`${mode}|${m.plan}|${k}|${row}`];
      if (!c || c.n === 0) { kept++; continue; }
      const ours = c.sum / c.n;                                // decision-weighted mean outcome
      const blended = (c.hands * ours + K * study) / (c.hands + K);
      r[k] = Number(m.toStore(blended * SCALE).toFixed(4));
      changed++;
      const d = Math.abs(blended * SCALE - study);
      sumAbs += d;
      if (d > worst) { worst = d; worstKey = `turn ${row} key ${k}: study ${study.toFixed(1)} -> ${(blended * SCALE).toFixed(1)} on ${c.hands} hands`; }
    }
  }
  fittedCells += changed; keptCells += kept;
  report.push(`  ${m.table.padEnd(32)} ${String(changed).padStart(3)} refitted, ${String(kept).padStart(3)} left as the study's, mean move ${(sumAbs / Math.max(1, changed)).toFixed(2)} chips`);
  if (worstKey) report.push(`      largest: ${worstKey}`);
}

writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`fitted from ${cellsFile}, conditioning "${mode}", k=${K}, scale=${SCALE}\n`);
for (const line of report) console.log(line);
console.log(`\n${fittedCells} cells refitted, ${keptCells} kept from the study for want of data`);
console.log(`${outFile} written`);
