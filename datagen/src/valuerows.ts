/**
 * Lay our fitted numbers against the study's, one table row at a time, and build the variant the
 * scale sweep could not.
 *
 *   tsx src/valuerows.ts [--cells ../data/gen/valuefit-cells.json] [--min 50]
 *   tsx src/valuerows.ts --out ../data/gen/tables-fit-rowscale.json
 *
 * WHY THIS EXISTS. `valuetables.ts` replaces the study's numbers with ours and offers one global
 * `--scale` to put them back on a comparable footing, and `valueday.sh` swept that scale over four
 * settings. Every one of them lost by about a chip a game, and the loss grew with the scale. That
 * result is hard to read on its own, because a global multiplier assumes the two table sets differ
 * by a single gain. This tool checks that assumption instead of making it.
 *
 * WHAT IT MEASURES. Inside one row - one plan at one turn - it regresses our realised chips on the
 * study's number, weighted by hands. The slope says how many chips of ours a chip of the study's is
 * worth, so `1/slope` is the scale that row alone would need. The R-squared says how much of the
 * study's ordering our own 150,000 hands reproduce.
 *
 * If every row wanted the same scale, a global multiplier would be exactly right and the sweep would
 * have been the correct experiment. They do not: the rows want scales between about 1.9 and 5.5, so
 * whatever single number is chosen, some rows end up far too flat and others far too steep, and the
 * coach is left comparing plans that are no longer on the same footing. That is a confound sitting
 * on top of the question the money runs were asked to settle.
 *
 * WHAT IT BUILDS. `--out` writes a table set that keeps the STUDY's numbers everywhere and only
 * multiplies each row by its own slope, normalised so the hands-weighted average multiplier is 1.
 * That isolates the single claim our fit actually makes. Our data agrees with the study about the
 * order of hands inside a plan, so re-fitting those numbers has little to offer; where it disagrees
 * is about how much a plan's spread is worth against another plan's, and this variant changes that
 * and nothing else. Overall decisiveness is held fixed by the normalisation, which removes the
 * danger-balance confound that `--scale` and `--dw` were invented to work around.
 *
 * WHAT THE NUMBERS CANNOT SETTLE. A row is compressed either because the study overstates it or
 * because that plan rarely converts under the coach's own play, and a realised-chips average is
 * diluted by every hand that never gets there. Those two readings point opposite ways and this tool
 * cannot separate them. The money run can.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { TABLES } from 'sg-mahjong-solver';

/**
 * `--study` regresses against the PRISTINE study snapshot instead of the shipped tables.
 *
 * It has to exist now that a row scaling has actually been shipped. `tables.ts` already carries one
 * multiplier per row, fitted from the `pursued` conditioning, so re-running that same conditioning
 * against the shipped tables returns the same slope in every row by construction - which is exactly
 * what it does, 0.235 across the board, and it means nothing. Any comparison between two
 * conditionings has to be made against the same unscaled reference, and this is it.
 */

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const cellsFile = arg('cells', '../data/gen/valuefit-cells.json');
const mode = arg('mode', 'pursued');
/** Cells thinner than this are left out of the fit. A cell of 1,000 hands carries a standard error
 *  of about 0.50 chips, because realised chips per hand have a standard deviation of 15.9, so a
 *  handful of hands says nothing at all about a row's slope. */
const MIN_HANDS = Number(arg('min', '50'));
const outFile = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1]! : null;
/** THE CONTROL. `--flat x` multiplies every row by the same x instead of by its own slope, which
 *  reproduces the change in how DECISIVE the coach is while leaving the plans on the footing the
 *  study gave them. The row-scaled variant is a little flatter than the shipped tables - the gap
 *  between the coach's top two plans falls from 10.53 chips to 8.35 - and being flatter is
 *  arithmetically the same as defending a little more, which is a separate knob with its own
 *  measured effect. Without this control a gain from the re-weighting cannot be told apart from a
 *  gain from the flattening. Play the two against the coach on the same ranges and the difference
 *  between them is the re-weighting alone. */
const FLAT = process.argv.includes('--flat') ? Number(process.argv[process.argv.indexOf('--flat') + 1]) : null;
/** `--gain x` multiplies every row's own multiplier by x, which moves the whole corrected set up or
 *  down without touching the RELATIVE weight of one plan against another.
 *
 *  It exists because normalising the multipliers to average one does not leave the coach as decisive
 *  as it was. Several things sit outside these tables - the MF2 correction, the late-turn decay, the
 *  value-pair credit added to All-Pong, the rows we have no data for - so the corrected set comes out
 *  about a fifth flatter in practice, and a flatter value side is arithmetically the same as
 *  defending more. Measured on its own that flattening costs 0.163 +/- 0.058 chips a game, so the
 *  correction was paying a toll it did not need to pay. `--gain` hands it back. */
const GAIN = process.argv.includes('--gain') ? Number(process.argv[process.argv.indexOf('--gain') + 1]) : 1;

/** How each plan's chips figure is stored in TABLES, so a stored number can be read back as chips. */
const MAP: { plan: string; table: string; variant: string | null; rows: number[]; toStore: (chips: number) => number; fromStore: (v: number) => number }[] = [
  { plan: 'half_color', table: 'half_color_chips', variant: 'mf2', rows: [0, 20, 40], toStore: (c) => c, fromStore: (v) => v },
  { plan: 'ping_wu', table: 'ping_wu_chips', variant: 'mf2', rows: [0, 20, 40], toStore: (c) => c, fromStore: (v) => v },
  { plan: 'all_pong', table: 'all_pong_chips', variant: 'mf1', rows: [0, 20, 40], toStore: (c) => c - 0.5, fromStore: (v) => v + 0.5 },
  { plan: 'all_chow', table: 'all_chow_table_10_3_turn0_mf1', variant: null, rows: [0], toStore: (c) => c, fromStore: (v) => v },
  { plan: 'chicken', table: 'chicken_chance', variant: 'mf2', rows: [0, 20, 40], toStore: (c) => Math.max(0.005, Math.min(0.95, c / 26 + 0.31)), fromStore: (v) => (v - 0.31) * 26 },
];

type Row = Record<string, number>;
interface CellData { sum: number; n: number; hands: number; pred: number }
const raw = JSON.parse(readFileSync(cellsFile, 'utf8')) as { cells: Record<string, CellData> };
const studySnapshot = process.argv.includes('--study');
const BASE = studySnapshot
  ? (JSON.parse(readFileSync(arg('studyfile', '../knowledge/sources/tables.study.json'), 'utf8')) as { TABLES: typeof TABLES }).TABLES
  : TABLES;
const out = JSON.parse(JSON.stringify(BASE)) as Record<string, unknown>;

interface Fit { table: string; row: number; keys: string[]; slope: number; r2: number; cells: number; hands: number; sdStudy: number; sdOurs: number; holder: Record<string, Row>; }
const fits: Fit[] = [];

for (const m of MAP) {
  const holder = (m.variant === null ? { '0': out[m.table] } : (out[m.table] as Record<string, Record<string, Row>>)[m.variant]) as Record<string, Row> | undefined;
  if (!holder) continue;
  for (const row of m.rows) {
    const r = holder[String(row)];
    if (!r) continue;
    const xs: number[] = [], ys: number[] = [], ws: number[] = [], keys: string[] = [];
    for (const k of Object.keys(r)) {
      const c = raw.cells[`${mode}|${m.plan}|${k}|${row}`];
      if (!c || c.hands < MIN_HANDS) continue;
      xs.push(m.fromStore(r[k]!)); ys.push(c.sum / c.n); ws.push(c.hands); keys.push(k);
    }
    if (xs.length < 4) continue;
    const sw = ws.reduce((a, b) => a + b, 0);
    const mx = xs.reduce((a, x, i) => a + ws[i]! * x, 0) / sw;
    const my = ys.reduce((a, y, i) => a + ws[i]! * y, 0) / sw;
    const sxx = xs.reduce((a, x, i) => a + ws[i]! * (x - mx) ** 2, 0);
    const syy = ys.reduce((a, y, i) => a + ws[i]! * (y - my) ** 2, 0);
    const sxy = xs.reduce((a, x, i) => a + ws[i]! * (x - mx) * (ys[i]! - my), 0);
    fits.push({ table: m.table, row, keys, slope: sxy / sxx, r2: syy ? sxy ** 2 / (sxx * syy) : NaN, cells: xs.length, hands: sw, sdStudy: Math.sqrt(sxx / sw), sdOurs: Math.sqrt(syy / sw), holder });
  }
}

const totalHands = fits.reduce((a, f) => a + f.hands, 0);
const meanSlope = fits.reduce((a, f) => a + f.slope * f.hands, 0) / totalHands;

console.log(`${cellsFile}, conditioning "${mode}", cells of ${MIN_HANDS}+ hands\n`);
console.log(`slope   = chips of ours per chip of the study's, so 1/slope is the scale THIS ROW alone would need`);
console.log(`R2      = how much of the study's ordering inside the row our own hands reproduce`);
console.log(`x       = the multiplier --out applies, the row's slope over the hands-weighted mean of ${meanSlope.toFixed(3)}\n`);
console.log(`${'table'.padEnd(24)}${'turn'.padStart(5)}${'cells'.padStart(7)}${'hands'.padStart(10)}${'slope'.padStart(8)}${'1/slope'.padStart(9)}${'R2'.padStart(7)}${'x'.padStart(7)}`);
for (const f of fits) {
  console.log(`${f.table.slice(0, 24).padEnd(24)}${String(f.row).padStart(5)}${String(f.cells).padStart(7)}${f.hands.toLocaleString().padStart(10)}${f.slope.toFixed(3).padStart(8)}${(1 / f.slope).toFixed(2).padStart(9)}${f.r2.toFixed(2).padStart(7)}${(f.slope / meanSlope).toFixed(2).padStart(7)}`);
}
const lo = Math.min(...fits.map((f) => 1 / f.slope)), hi = Math.max(...fits.map((f) => 1 / f.slope));
console.log(`\nthe rows want scales from ${lo.toFixed(2)} to ${hi.toFixed(2)}, a spread of ${(hi / lo).toFixed(1)}x`);
console.log(`a single --scale can satisfy one of them at a time, which is why the sweep could not settle this`);

if (outFile) {
  for (const f of fits) {
    const r = f.holder[String(f.row)]!;
    const mult = (FLAT ?? f.slope / meanSlope) * GAIN;
    const m = MAP.find((x) => x.table === f.table)!;
    for (const k of f.keys) r[k] = Number(m.toStore(m.fromStore(r[k]!) * mult).toFixed(4));
  }
  writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(FLAT === null
    ? `\n${outFile} written: the study's own numbers, each row multiplied by its own x above.`
    : `\n${outFile} written: THE CONTROL - every row multiplied by the same ${FLAT}, so the coach is flatter by that much and the plans keep the study's footing.`);
  console.log(`Rows with too little data are left exactly as the study had them.`);
}
