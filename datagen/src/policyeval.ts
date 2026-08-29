/**
 * Does the learned policy hold up OFF its training distribution?
 *
 *   tsx src/policyeval.ts --dir ../data/gen/run-money3 --hands 20000
 *
 * policy.ts trains and reports on decisive decisions only - the 3.8% of discards whose best action
 * clears 2 SE. In the app the policy is asked about every position, including the 96% it has never
 * seen. Top-1 accuracy cannot answer this: on an ambiguous position there is no right answer to be
 * right about. Mean EV regret can - it is well defined everywhere, and it is what the player
 * actually pays.
 *
 * Scores four deciders on the SAME decisions: the learned policy, the book coach (which now sees
 * the table), the bot that actually played, and a random discard.
 */
import { readFileSync, existsSync } from 'node:fs';
import { makeRng, kindOf, type Meld, type TileKind } from 'sg-mahjong-engine';
import { rankDiscards, type Context } from 'sg-mahjong-solver';
import { eachEval } from './evalstats.js';
import { separationT, seVersionOf } from './se.js';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, type EvalRecord } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { discardFeatures, unseenCounts, type DiscardFeatures } from 'sg-mahjong-engine';
import type { DecisionRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money3')!;
const maxHands = Number(arg('hands', '20000'));
const weightsPath = arg('weights', '../solver/src/policy.weights.json')!;

if (!existsSync(weightsPath)) { console.error(`no weights at ${weightsPath} - run policy.ts first`); process.exit(1); }
const P = JSON.parse(readFileSync(weightsPath, 'utf8')) as {
  features: string[]; hidden: number; mu: number[]; sd: number[]; w?: number[]; W1?: number[][]; b1?: number[]; w2?: number[];
};
console.log(`weights: hidden=${P.hidden}, ${P.features.length} features, trained on decisive decisions only\n`);

// must match policy.ts exactly
function featurise(f: DiscardFeatures, role: number, prevailing: number, turns: number): number[] {
  const turnNorm = Math.min(1, turns / 40);
  const isoTile = f.isoTile ? 1 : 0, hon = f.hon ? 1 : 0;
  return [
    f.sh, f.eff, f.rem, f.pairs, f.trip, f.seq, f.pseq, f.iso,
    isoTile, hon, f.term ? 1 : 0, f.dragon ? 1 : 0, f.k === 27 + role ? 1 : 0, f.k === 27 + prevailing ? 1 : 0,
    hon * isoTile, f.sh * turnNorm, f.eff * turnNorm, f.iso * turnNorm,
  ];
}
const score = (raw: number[]): number => {
  const x = raw.map((v, j) => (v - P.mu[j]!) / P.sd[j]!);
  if (!P.hidden) { let t = 0; for (let j = 0; j < x.length; j++) t += P.w![j]! * x[j]!; return t; }
  let t = 0;
  for (let i = 0; i < P.hidden; i++) {
    let h = P.b1![i]!; const row = P.W1![i]!;
    for (let j = 0; j < x.length; j++) h += row[j]! * x[j]!;
    t += P.w2![i]! * Math.tanh(h);
  }
  return t;
};

const rules = rulesForDir(dir);
const seVersion = seVersionOf(dir);

// every evaluated discard, with its EVs and whether it was decisive
interface Ev { best: string; sep: number; ev: Map<string, number> }
const evals = new Map<string, Ev>();
eachEval(dir, (e: EvalRecord) => {
  if (e.k !== 'discard' || e.actions.length <= 1) return;
  evals.set(`${e.g}:${e.h}:${e.d}`, {
    best: e.best,
    sep: separationT(e.actions[0]!, e.actions[1]!, seVersion),
    ev: new Map(e.actions.map((a) => [a.a, a.ev])),
  });
});
console.log(`${evals.size} evaluated discards on disk`);

const wantHands = new Set<string>();
for (const k of evals.keys()) { const [g, h] = k.split(':'); wantHands.add(`${g}:${h}`); }
const rng = makeRng(4242);
const hands = loadHands(dir).filter((h) => wantHands.has(`${h.g}:${h.h}`));
for (let i = hands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [hands[i], hands[j]] = [hands[j]!, hands[i]!]; }
const sample = hands.slice(0, maxHands);
console.log(`replaying ${sample.length} of ${hands.length} hands\n`);

interface Acc { n: number; regret: number; top1: number }
const mk = (): Acc => ({ n: 0, regret: 0, top1: 0 });
const buckets = new Map<string, Record<string, Acc>>();
const at = (key: string) => {
  let b = buckets.get(key);
  if (!b) buckets.set(key, b = { policy: mk(), coach: mk(), bot: mk(), random: mk() });
  return b;
};

let done = 0, scored = 0;
for (const hand of sample) {
  const decs: DecisionRecord[] | null = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS);
  if (!decs) continue;
  for (const d of decs) {
    if (d.k !== 'discard') continue;
    const ev = evals.get(`${d.g}:${d.h}:${d.d}`);
    if (!ev) continue;
    const feats = d.f as DiscardFeatures[] | undefined;
    if (!feats?.length) continue;
    const role = (d.p - d.dl + 4) % 4;
    const bestEv = ev.ev.get(ev.best);
    if (bestEv === undefined) continue;
    const evOf = (kind: number) => ev.ev.get(`d:${kind}`);

    // learned policy
    let pick = feats[0]!.k, bestScore = -Infinity;
    for (const f of feats) { const s = score(featurise(f, role, d.w, d.t)); if (s > bestScore) { bestScore = s; pick = f.k; } }

    // book coach, with the table in view
    const melds: Meld[] = d.me.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    const visible: TileKind[] = [];
    for (const e of d.pub.dl) visible.push(e[1]! as TileKind);
    d.pub.m.forEach((ms, s) => { if (s !== d.p) for (const m of ms) visible.push(...(m.slice(2) as TileKind[])); });
    d.pub.b.forEach((bs, s) => { if (s !== d.p) visible.push(...(bs as TileKind[])); });
    const ctx: Context = {
      seat: role, prevailingWind: d.w, bonus: d.me.b as TileKind[], playerTurns: d.t,
      minimumFan: rules.minimum_tai === 2 ? 2 : 1, selfDrawMinimumFan: rules.self_draw_minimum_tai ?? 1, visible,
      opponentMelds: d.pub.m.map((ms, s2) => (s2 === d.p ? -1 : ms.length)).filter((n) => n >= 0),
    };
    let coachPick: number | null = null;
    try { coachPick = rankDiscards(d.me.h as TileKind[], melds, ctx).best.tile; } catch { coachPick = null; }

    const botPick = d.sel.startsWith('d:') ? Number(d.sel.slice(2)) : null;
    const legal = feats.map((f) => f.k);
    const randomRegret = legal.reduce((a, k) => a + (bestEv - (evOf(k) ?? bestEv)), 0) / legal.length;

    const keys = ['all', ev.sep > 2 ? 'decisive' : 'ambiguous', d.t <= 15 ? 'early' : d.t <= 35 ? 'mid' : 'late'];
    for (const key of keys) {
      const b = at(key);
      const add = (acc: Acc, chosen: number | null) => {
        if (chosen === null) return;
        const e = evOf(chosen); if (e === undefined) return;
        acc.n++; acc.regret += bestEv - e; if (`d:${chosen}` === ev.best) acc.top1++;
      };
      add(b.policy!, pick);
      add(b.coach!, coachPick);
      add(b.bot!, botPick);
      b.random!.n++; b.random!.regret += randomRegret; b.random!.top1 += 1 / legal.length;
    }
    scored++;
    void discardFeatures; void unseenCounts; void kindOf;
  }
  if (++done % 2000 === 0) process.stdout.write(`\r${done}/${sample.length} hands, ${scored} decisions`);
}

console.log(`\r${' '.repeat(50)}\r${scored} evaluated discards scored\n`);
const order = ['all', 'decisive', 'ambiguous', 'early', 'mid', 'late'];
console.log(`${'slice'.padEnd(11)} ${'n'.padStart(7)}   ${'decider'.padEnd(8)} ${'mean regret'.padStart(11)} ${'top-1'.padStart(7)}`);
for (const key of order) {
  const b = buckets.get(key); if (!b) continue;
  let first = true;
  for (const name of ['policy', 'coach', 'bot', 'random']) {
    const a = b[name]!;
    if (!a.n) continue;
    console.log(`${(first ? key : '').padEnd(11)} ${String(first ? a.n : '').padStart(7)}   ${name.padEnd(8)} ${(a.regret / a.n).toFixed(3).padStart(11)} ${((100 * a.top1) / a.n).toFixed(1).padStart(6)}%`);
    first = false;
  }
  console.log('');
}
console.log(`Mean regret is chips (dollars) per decision against the measured best action.`);
console.log(`The 'ambiguous' slice is the one that matters: the policy never trained on it.`);
