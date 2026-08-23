/**
 * Build a quiz pack: real evaluated decisions, compact, for the web Real Quiz.
 *   tsx src/quizpack.ts --dir ../data/gen/run100k-table --out ../web/public/quiz --name table --max 4000
 * Every question carries the acting player's visible context and the measured EV of every legal action.
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fanInHand, makeRng, type Meld } from 'sg-mahjong-engine';
import { loadHands, readJsonlGz } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, type EvalRecord } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run100k-table')!;
const outDir = arg('out', '../web/public/quiz')!;
const name = arg('name', 'table')!;
const maxQ = Number(arg('max', '4000'));

const rules = rulesForDir(dir);
const money = rules.money !== null;
const hands = new Map(loadHands(dir).map((h) => [`${h.g}:${h.h}`, h]));
const evals: EvalRecord[] = [];
for (const f of readdirSync(dir).filter((x) => x.startsWith('evals-') && x.endsWith('.jsonl.gz'))) evals.push(...readJsonlGz<EvalRecord>(join(dir, f)));

// prefer decisions where the choice matters: sort into meaty (spread >= 2) and the rest; sample 75/25
const withSpread = evals.map((e) => ({ e, spread: e.actions[0]!.ev - e.actions[e.actions.length - 1]!.ev })).filter((x) => x.e.actions.length > 1);
const rng = makeRng(99);
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };
const meaty = shuffle(withSpread.filter((x) => x.spread >= 2));
const rest = shuffle(withSpread.filter((x) => x.spread < 2));
const chosen = [...meaty.slice(0, Math.floor(maxQ * 0.75)), ...rest.slice(0, Math.ceil(maxQ * 0.25))].slice(0, maxQ);

// group by hand so each hand is replayed once
const byHand = new Map<string, typeof chosen>();
for (const c of chosen) { const k = `${c.e.g}:${c.e.h}`; (byHand.get(k) ?? byHand.set(k, []).get(k)!).push(c); }

interface Q { id: string; k: string; seat: number; dl: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; bot: string; spread: number; best: string; sel: string; n: number; actions: { a: string; ev: number; win: number; dealin: number; draw: number }[] }
const questions: Q[] = [];
let handsDone = 0;
for (const [key, list] of byHand) {
  const hr = hands.get(key) as HandRecord | undefined; if (!hr) continue;
  const decs = decisionsOfHand(hr, rules, DEFAULT_RANDOMNESS);
  for (const { e, spread } of list) {
    const d = decs.find((x) => x.d === e.d); if (!d) continue;
    const melds: Meld[] = d.me.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    const fih = fanInHand({ melds, bonus: d.me.b, seat: (d.p - d.dl + 4) % 4, prevailingWind: d.w });
    const last = d.pub.dl[d.pub.dl.length - 1];
    questions.push({
      id: `${e.g}:${e.h}:${e.d}`, k: e.k, seat: d.p, dl: d.dl, w: d.w, t: d.t, fih,
      h: d.me.h, dr: d.me.dr, b: d.me.b, m: d.me.m,
      ...(e.k === 'claim' && last ? { ld: [last[0]!, last[1]!] as [number, number] } : {}),
      bot: e.bot, spread: Number(spread.toFixed(2)), best: e.best, sel: e.sel, n: e.n,
      actions: e.actions.map((a) => ({ a: a.a, ev: Number(a.ev.toFixed(2)), win: Number(a.win.toFixed(2)), dealin: Number(a.dealin.toFixed(2)), draw: Number(a.draw.toFixed(2)) })),
    });
  }
  if (++handsDone % 500 === 0) process.stdout.write(`\r${handsDone}/${byHand.size} hands replayed`);
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ run: dir.split('/').pop(), money, unit: money ? '$' : 'chips', questions }));
const packs = readdirSync(outDir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => {
  const p = JSON.parse(readFileSync(join(outDir, f), 'utf8')) as { money: boolean; unit: string; questions: unknown[] };
  return { id: f.replace('.json', ''), money: p.money, unit: p.unit, questions: p.questions.length };
});
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ packs }));
console.log(`\n${questions.length} questions -> ${outDir}/${name}.json (${money ? 'dollars' : 'chips'})`);
void existsSync;
