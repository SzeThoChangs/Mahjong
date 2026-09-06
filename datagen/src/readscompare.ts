/**
 * Danger tables side by side, so a difference can be attributed to one thing.
 *
 *   tsx src/readscompare.ts a=../data/gen/reads2/coach.json b=../data/gen/reads-nowild/nowild.json
 *
 * A read is a claim about what the OPPONENTS hold, so every cell in one of these tables is a fact
 * about two things at once: the rule the table was played under, and who was sitting at it. The
 * shipped table came from the personality field at four wildcards. Comparing a fresh no-wildcard
 * coach table against it would move both at once and call the answer a wildcard effect.
 *
 * So this takes tables by name and prints them in columns, and the caller's job is to vary one
 * thing. `reads2/coach.json` is the coach population at four wildcards and is the right comparator
 * for a coach population at zero.
 */
import { readFileSync } from 'node:fs';

interface Cell { p: number; n: number }
interface Reads { run?: string; hands?: number; dangerSafe?: Record<string, Cell>; danger?: Record<string, Cell>; ready?: Record<string, Cell> }

const args = process.argv.slice(2).filter((a) => a.includes('='));
if (args.length < 2) { console.error('give at least two as name=path'); process.exit(1); }
const tables = args.map((a) => { const [name, path] = a.split('='); return { name: name!, path: path!, r: JSON.parse(readFileSync(path!, 'utf8')) as Reads }; });

const pct = (c?: Cell) => (c && c.n > 0 ? `${(100 * c.p).toFixed(2)}%` : '—');
const thin = (c?: Cell) => !c || c.n < 200;

for (const key of ['danger', 'dangerSafe', 'ready'] as const) {
  const rows = [...new Set(tables.flatMap((t) => Object.keys(t.r[key] ?? {})))].sort();
  if (!rows.length) continue;
  console.log(`\n${key}`);
  console.log(`  ${'cell'.padEnd(26)}${tables.map((t) => t.name.padStart(12)).join('')}   ratio`);
  for (const row of rows) {
    const cells = tables.map((t) => t.r[key]?.[row]);
    if (cells.every(thin)) continue;
    const a = cells[0], b = cells[cells.length - 1];
    const ratio = a && b && a.p > 0 && b.n > 0 ? (b.p / a.p).toFixed(2) + 'x' : '—';
    console.log(`  ${row.padEnd(26)}${cells.map((c) => pct(c).padStart(12)).join('')}   ${ratio}${cells.some(thin) ? '  (thin)' : ''}`);
  }
}
console.log('\nsource');
for (const t of tables) console.log(`  ${t.name.padEnd(12)} run ${t.r.run ?? '?'}, ${t.r.hands ?? '?'} hands`);
console.log('\nratio is the last column over the first. A cell under 200 samples is marked thin and two thin cells are dropped.');
