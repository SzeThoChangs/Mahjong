/**
 * How often does the coach offer a discard with NO reason attached?
 *
 *   tsx src/reasoncheck.ts ../web/public/quiz/money.json
 *
 * The Train tab falls back to printing the internal plan id ("plan: chicken") whenever an option's
 * reasons array is empty, so every gap in `reasonsFor` surfaces as a non-explanation in front of the
 * player. This counts the gaps over real hands and shows which tiles fall through.
 */
import { readFileSync } from 'node:fs';
import { rankDiscards, type Context } from '../index.js';
import { isHonour, isSuited, rankOf, suitOf } from 'sg-mahjong-engine';
import type { Meld, TileKind } from 'sg-mahjong-engine';

interface Q { id: string; k: string; seat: number; dl?: number; w: number; t: number; h: number[]; b: number[]; m: number[][] }
const path = process.argv[2] ?? '../web/public/quiz/money.json';
const pack = JSON.parse(readFileSync(path, 'utf8')) as { questions: Q[] };
const cfg = JSON.parse(readFileSync('../data/table.config.json', 'utf8')) as { minimum_fan: number; self_draw_minimum_fan: number };

let hands = 0, options = 0, empty = 0, handsWithGap = 0, bestWasEmpty = 0;
const byRank = new Map<string, number>();

for (const q of pack.questions) {
  if (q.k !== 'discard' || q.h.length % 3 !== 2) continue;
  const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
  const ctx: Context = {
    seat: q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat,
    prevailingWind: q.w, bonus: q.b as TileKind[], playerTurns: q.t,
    minimumFan: cfg.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: cfg.self_draw_minimum_fan,
  };
  let r;
  try { r = rankDiscards(q.h as TileKind[], melds, ctx); } catch { continue; }
  hands++;
  let gap = false;
  for (const o of r.options) {
    options++;
    if (o.reasons.length === 0) {
      empty++; gap = true;
      if (o.tile === r.best.tile) bestWasEmpty++;
      const label = isHonour(o.tile) ? 'honour' : isSuited(o.tile) ? `rank ${rankOf(o.tile)}` : 'other';
      byRank.set(label, (byRank.get(label) ?? 0) + 1);
      void suitOf;
    }
  }
  if (gap) handsWithGap++;
}

const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;
console.log(`${hands} hands, ${options} discard options`);
console.log(`options with NO reason:      ${empty}  (${pct(empty, options)})`);
console.log(`hands showing at least one:  ${handsWithGap}  (${pct(handsWithGap, hands)})`);
console.log(`...where it was the COACH'S OWN pick: ${bestWasEmpty}  (${pct(bestWasEmpty, hands)} of hands)`);
console.log(`\nwhich tiles fall through`);
for (const [k, v] of [...byRank.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(10)} ${String(v).padStart(6)}  ${pct(v, empty)}`);
