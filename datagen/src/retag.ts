/**
 * Re-run the shape tagger over a quiz pack that already exists, in place.
 *
 *   tsx src/retag.ts [--quiz ../web/public/quiz] [--pack coach]
 *
 * A pack carries `tp`, the shape tips each question is about, and it is written once when the pack
 * is built. The tagger keeps learning new shapes, so a pack built last week says nothing about a tip
 * added today. Rebuilding the pack is half an hour and a replay of every hand; this is a few
 * seconds, because everything the tagger needs is already in the question. The app works the tips
 * out again live, so this only changes what the pack SUMMARY and the spotting pack can see.
 *
 * What it cannot do is change which questions are in the pack. `quizpack.ts` fills each stratum
 * tagged-first, so a rebuild would also pull in positions that were dropped as untagged and now are
 * not. This tags what is there and no more.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { liveCalls } from 'sg-mahjong-solver';
import type { Meld } from 'sg-mahjong-engine';
import { rulesForDir } from './tablerules.js';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const quizDir = arg('quiz', '../web/public/quiz')!;
const only = arg('pack');
const genDir = arg('gen', '../data/gen')!;

interface Q { tp: string[]; k: string; seat: number; dl: number; w: number; b: number[]; h: number[]; m: number[][]; actions: { a: string }[] }

for (const name of only ? [only] : (JSON.parse(readFileSync(join(quizDir, 'index.json'), 'utf8')) as { packs: { id: string }[] }).packs.map((p) => p.id)) {
  const path = join(quizDir, `${name}.json`);
  const pack = JSON.parse(readFileSync(path, 'utf8')) as { run: string; questions: Q[] };
  // the minimum this run was played at, so the tips that turn on what can be declared run truthfully
  const rules = rulesForDir(join(genDir, pack.run));
  const before = new Map<string, number>(), after = new Map<string, number>();
  let was = 0, now = 0;
  for (const q of pack.questions) {
    for (const t of q.tp ?? []) before.set(t, (before.get(t) ?? 0) + 1);
    if (q.tp?.length) was++;
    const throws = q.k === 'discard' ? q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2))) : [];
    const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    q.tp = throws.length ? liveCalls(q.h, q.m.length, throws, {
      bonus: q.b, seat: (q.seat - q.dl + 4) % 4, prevailingWind: q.w, melds,
      minimumFan: rules.minimum_tai, selfDrawMinimumFan: rules.self_draw_minimum_tai,
    }).map((c) => c.tip) : [];
    for (const t of q.tp) after.set(t, (after.get(t) ?? 0) + 1);
    if (q.tp.length) now++;
  }
  writeFileSync(path, JSON.stringify(pack));
  const tips = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => (after.get(b) ?? 0) - (after.get(a) ?? 0));
  console.log(`\n${name}.json (${pack.run}, minimum ${rules.minimum_tai} tai): tagged ${was} -> ${now} of ${pack.questions.length}`);
  for (const t of tips) console.log(`  ${t.padEnd(22)} ${String(before.get(t) ?? 0).padStart(5)} -> ${String(after.get(t) ?? 0).padStart(5)}`);
}
