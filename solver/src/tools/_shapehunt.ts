/**
 * Where in a real pack does each shape tip fire, and on what hand?
 *
 *   node ../solver/node_modules/tsx/dist/cli.mjs src/tools/_shapehunt.ts ../web/public/quiz/coach.json
 *
 * A detector written against a card's own example proves only that it reads that example. This asks
 * the harder question: does it ever fire on a position somebody actually played, and if so what did
 * that position look like? The hands it prints are what the tagger's tests are built from, so a test
 * is a real position rather than one invented to pass.
 */
import { readFileSync } from 'node:fs';
import { kindName, type Meld } from 'sg-mahjong-engine';
import { liveCalls } from '../shapetag.js';

const path = process.argv[2] ?? '../web/public/quiz/coach.json';
const only = process.argv[3];
interface Q { k: string; seat: number; dl: number; w: number; b: number[]; h: number[]; m: number[][]; actions: { a: string }[] }
const pack = JSON.parse(readFileSync(path, 'utf8')) as { run: string; questions: Q[] };

const seen = new Map<string, number>(), example = new Map<string, string>();
for (const q of pack.questions) {
  if (q.k !== 'discard') continue;
  const throws = q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2)));
  const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
  for (const c of liveCalls(q.h, q.m.length, throws, { bonus: q.b, seat: (q.seat - q.dl + 4) % 4, prevailingWind: q.w, melds, minimumFan: 2, selfDrawMinimumFan: 1 })) {
    seen.set(c.tip, (seen.get(c.tip) ?? 0) + 1);
    if (!example.has(c.tip) && (!only || c.tip === only) && q.m.length === 0) {
      example.set(c.tip, `${q.h.map(kindName).join(' ')}\n      says ${c.says.map(kindName).join(' ')} | against ${c.against.map(kindName).join(' ')}\n      ${c.because}`);
    }
  }
}
console.log(`${path}: ${pack.questions.length} questions`);
for (const [tip, n] of [...seen].sort((a, b) => b[1] - a[1])) {
  console.log(`\n  ${tip}  ${n}`);
  const e = example.get(tip); if (e) console.log(`      ${e}`);
}
