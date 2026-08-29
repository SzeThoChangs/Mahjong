/**
 * Export replay bundles for the web film room.
 *   tsx src/export.ts --dir ../data/gen/run-money3 --out ../web/public/replays/table --hands 150
 * Picks hands (evaluated decisions first, then variety), replays each to collect its decisions,
 * attaches evaluations, and writes compact JSON: index.json + h<g>_<h>.json.
 * The evals are streamed twice - once to learn which hands were evaluated, once to load the shortlist -
 * so memory tracks the exported hands, not the size of the run.
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { kindOf } from 'sg-mahjong-engine';
import { loadHands } from './stats.js';
import { eachEval } from './evalstats.js';
import { pairedSe, seVersionOf } from './se.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, type EvalRecord } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { playHand } from './session.js';
import type { HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money3')!;
const out = arg('out', '../web/public/replays/table')!;
const maxHands = Number(arg('hands', '150'));

const rules = rulesForDir(dir);
const money = rules.money !== null;
const seVersion = seVersionOf(dir);   // older runs stored gapSe sqrt(k) short; pairedSe corrects on read
const hands = loadHands(dir);
// pass 1: which hands have evaluations at all - a key per hand is all the selection below needs
const evaluated = new Set<string>();
eachEval(dir, (e) => evaluated.add(`${e.g}:${e.h}`));

// ---- selection: evaluated hands first; inside that, spread across combinations and outcomes ----
const withEvals = hands.filter((h) => evaluated.has(`${h.g}:${h.h}`));
const pool = (withEvals.length >= maxHands ? withEvals : hands);
const byCombo = new Map<string, HandRecord[]>();
for (const h of pool) { const c = h.combo ?? 'draw'; (byCombo.get(c) ?? byCombo.set(c, []).get(c)!).push(h); }
const selected: HandRecord[] = [];
outer: while (selected.length < Math.min(maxHands, pool.length)) {
  for (const [, list] of [...byCombo.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const h = list.shift(); if (!h) continue;
    selected.push(h); if (selected.length >= Math.min(maxHands, pool.length)) break outer;
  }
  if ([...byCombo.values()].every((l) => l.length === 0)) break;
}

// pass 2: now that the shortlist is fixed, re-read and keep evaluations for those hands only
const need = new Set(selected.map((h) => `${h.g}:${h.h}`));
const evalsByHand = new Map<string, EvalRecord[]>();
eachEval(dir, (e) => { const k = `${e.g}:${e.h}`; if (need.has(k)) (evalsByHand.get(k) ?? evalsByHand.set(k, []).get(k)!).push(e); });

mkdirSync(out, { recursive: true });
interface Row { d: number; k: string; t: number; p: number; sel: string; legal: string[]; h: number[]; dr: number | null; b: number[]; m4?: number[][][]; ch?: number[]; f?: unknown; ev?: unknown }
const index: unknown[] = [];
let drifted = 0;
for (const hr of selected) {
  const decs = decisionsOfHand(hr, rules, DEFAULT_RANDOMNESS);
  if (!decs) { drifted++; continue; }
  const evs = new Map((evalsByHand.get(`${hr.g}:${hr.h}`) ?? []).map((e) => [e.d, e]));
  let lastM = '', lastCh = '';
  const rows: Row[] = decs.map((r) => {
    const row: Row = { d: r.d, k: r.k, t: r.t, p: r.p, sel: r.sel, legal: r.legal, h: r.me.h, dr: r.me.dr, b: r.me.b };
    const mStr = JSON.stringify(r.pub.m); if (mStr !== lastM) { row.m4 = r.pub.m; lastM = mStr; }
    const chStr = JSON.stringify(r.ch); if (chStr !== lastCh) { row.ch = r.ch; lastCh = chStr; }
    if (r.k === 'discard') row.f = (r.f as { k: number; sh: number; eff: number; rem: number }[]).map(({ k, sh, eff, rem }) => ({ k, sh, eff, rem }));
    const e = evs.get(r.d);
    // `se` = paired standard error of (best.ev - this.ev), so the film room can draw the bars with
    // the precision they actually have instead of implying the ranking is exact.
    if (e) row.ev = { best: e.best, regret: e.regret, n: e.n, actions: e.actions.map((a) => {
      const se = pairedSe(a, e.actions[0]!, seVersion);
      return { a: a.a, ev: a.ev, se: Number((Number.isFinite(se) ? se : 0).toFixed(2)), win: a.win, dealin: a.dealin, draw: a.draw, n: a.n };
    }) };
    return row;
  });
  // final board state via one more replay
  const scoresBefore = hr.scores.map((s, i) => s - hr.delta[i]!);
  const { result } = playHand({ sessionId: hr.g, handIdx: hr.h, seed: hr.seed, dealer: hr.dl, prevailingWind: hr.w, botTypes: hr.bots, scores: scoresBefore }, rules, DEFAULT_RANDOMNESS, undefined, false);
  const file = `h${hr.g}_${hr.h}.json`;
  writeFileSync(join(out, file), JSON.stringify({
    g: hr.g, h: hr.h, seed: hr.seed, dealer: hr.dl, wind: hr.w, bots: hr.bots, money,
    winner: hr.winner, selfDraw: hr.sd, discarder: hr.disc, fan: hr.fan, combo: hr.combo, turns: hr.turns, delta: hr.delta,
    log: result.log, decisions: rows, evalCount: evs.size,
  }));
  index.push({ file, g: hr.g, h: hr.h, winner: hr.winner, sd: hr.sd, fan: hr.fan, combo: hr.combo ?? 'draw', turns: hr.turns, delta: hr.delta, bots: hr.bots, evals: evs.size });
}
writeFileSync(join(out, 'index.json'), JSON.stringify({ dir: dir.split('/').pop(), money, unit: money ? '$' : 'chips', hands: index }));
// top-level list of exported runs
const runsRoot = out.split('/').slice(0, -1).join('/');
const runs = readdirSync(runsRoot).filter((d) => existsSync(join(runsRoot, d, 'index.json'))).map((d) => {
  const ix = JSON.parse(readFileSync(join(runsRoot, d, 'index.json'), 'utf8')) as { money: boolean; unit: string; hands: unknown[] };
  return { id: d, money: ix.money, unit: ix.unit, hands: ix.hands.length };
});
writeFileSync(join(runsRoot, 'index.json'), JSON.stringify({ runs }));
console.log(`exported ${index.length} hands (${evaluated.size} evaluated available, ${drifted} drifted skipped) -> ${out}`);
