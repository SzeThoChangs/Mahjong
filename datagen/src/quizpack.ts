/**
 * Build a quiz pack: real evaluated decisions, compact, for the web Real Quiz.
 *   tsx src/quizpack.ts --dir ../data/gen/run100k-table --out ../web/public/quiz --name table --max 4000
 * Every question carries the acting player's visible context and the measured EV of every legal action.
 * Two streaming passes over the evals: the first keeps only a key and a spread per decision so the sample
 * can be drawn, the second re-reads and materialises just the few thousand records that were picked.
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fanInHand, makeRng, type Meld } from 'sg-mahjong-engine';
import { eachJsonlGz } from './stats.js';
import { eachEval } from './evalstats.js';
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

// pass 1: one lightweight reference per decision. prefer decisions where the choice matters:
// sort into meaty (spread >= 2) and the rest, sample 75/25
interface Ref { g: number; h: number; d: number; spread: number }
const meaty: Ref[] = [], rest: Ref[] = [];
eachEval(dir, (e) => {
  if (e.actions.length <= 1) return;
  const spread = e.actions[0]!.ev - e.actions[e.actions.length - 1]!.ev;
  (spread >= 2 ? meaty : rest).push({ g: e.g, h: e.h, d: e.d, spread });
});
const rng = makeRng(99);
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };
shuffle(meaty); shuffle(rest);
const chosen = [...meaty.slice(0, Math.floor(maxQ * 0.75)), ...rest.slice(0, Math.ceil(maxQ * 0.25))].slice(0, maxQ);

// group by hand so each hand is replayed once
const byHand = new Map<string, Ref[]>();
for (const c of chosen) { const k = `${c.g}:${c.h}`; (byHand.get(k) ?? byHand.set(k, []).get(k)!).push(c); }

// pass 2: pull back the full record for the picked decisions only, and only the hands they belong to
const wanted = new Set(chosen.map((c) => `${c.g}:${c.h}:${c.d}`));
const full = new Map<string, EvalRecord>();
eachEval(dir, (e) => { const k = `${e.g}:${e.h}:${e.d}`; if (wanted.has(k)) full.set(k, e); });
const hands = new Map<string, HandRecord>();
for (const f of readdirSync(dir).filter((x) => x.startsWith('hands-') && x.endsWith('.jsonl.gz')))
  eachJsonlGz<HandRecord>(join(dir, f), (h) => { const k = `${h.g}:${h.h}`; if (byHand.has(k)) hands.set(k, h); });

interface Q { id: string; k: string; seat: number; dl: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; bot: string; spread: number; best: string; sel: string; n: number; actions: { a: string; ev: number; win: number; dealin: number; draw: number; n: number; mix?: unknown }[] }
const questions: Q[] = [];
let handsDone = 0;
let drifted = 0, mismatched = 0;
for (const [key, list] of byHand) {
  const hr = hands.get(key); if (!hr) continue;
  const decs = decisionsOfHand(hr, rules, DEFAULT_RANDOMNESS);
  if (!decs) { drifted++; continue; }
  for (const ref of list) {
    const e = full.get(`${ref.g}:${ref.h}:${ref.d}`); if (!e) continue;
    const d = decs.find((x) => x.d === e.d); if (!d) continue;
    if (d.k !== e.k || d.p !== e.seat || d.sel !== e.sel || d.t !== e.t) { mismatched++; continue; }   // eval and replay must describe the same position
    const melds: Meld[] = d.me.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    const fih = fanInHand({ melds, bonus: d.me.b, seat: (d.p - d.dl + 4) % 4, prevailingWind: d.w });
    const last = d.pub.dl[d.pub.dl.length - 1];
    questions.push({
      id: `${e.g}:${e.h}:${e.d}`, k: e.k, seat: d.p, dl: d.dl, w: d.w, t: d.t, fih,
      h: d.me.h, dr: d.me.dr, b: d.me.b, m: d.me.m,
      ...(e.k === 'claim' && last ? { ld: [last[0]!, last[1]!] as [number, number] } : {}),
      bot: e.bot, spread: Number(ref.spread.toFixed(2)), best: e.best, sel: e.sel, n: e.n,
      actions: e.actions.map((a) => ({ a: a.a, ev: Number(a.ev.toFixed(2)), win: Number(a.win.toFixed(2)), dealin: Number(a.dealin.toFixed(2)), draw: Number(a.draw.toFixed(2)), n: a.n, mix: a.mix })),
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
console.log(`\n${questions.length} questions -> ${outDir}/${name}.json (${money ? 'dollars' : 'chips'}); ${drifted} drifted hands skipped, ${mismatched} mismatched decisions dropped`);
