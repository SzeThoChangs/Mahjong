/**
 * Layer 2 evaluator: for a recorded decision, estimate the value of EVERY legal action by rollouts.
 *
 *   tsx src/evaluate.ts --dir ../data/gen/run100k --hands 200 --per-hand 4 --rollouts 32 --mode sampled --policy fast --workers 8 --seed 1
 *
 * Output: <dir>/evals-wN.jsonl.gz, one line per evaluated decision:
 *   { g,h,d,k,seat,bot,sel, mode, policy, n, actions:[{a, ev, sd, win, dealin, draw}], best, regret }
 * EV = mean chips delta for the acting seat at the end of the hand, over n rollouts per action.
 */
import { Worker, parentPort, workerData } from 'node:worker_threads';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { GameState, makeRng, makeRules, tableConfigOf, IsolationBot, kindOf, type Bot, type LegalAction, type RulesConfig } from 'sg-mahjong-engine';
import { positionAt, determinize } from './position.js';
import { makeBot, type RandomnessConfig } from './bots.js';
import { loadHands, readJsonlGz } from './stats.js';
import { JsonlGzWriter } from './writer.js';
import { encAction, fnv1a, type DecisionRecord, type HandRecord } from './records.js';

export type Policy = 'fast' | 'efficiency';
export interface EvalArgs { dir: string; hands: number; perHand: number; rollouts: number; mode: 'sampled' | 'oracle'; policy: Policy; seed: number; workers: number; workerIndex: number; rulesOverride: object; randomness: RandomnessConfig }
export interface ActionEval { a: string; ev: number; sd: number; win: number; dealin: number; draw: number; n: number }
export interface EvalRecord { g: number; h: number; d: number; k: string; seat: number; bot: string; sel: string; mode: string; policy: string; n: number; actions: ActionEval[]; best: string; selEv: number; regret: number }

function rolloutBots(policy: Policy, seed: number, randomness: RandomnessConfig): Bot[] {
  return [0, 1, 2, 3].map((s) => policy === 'fast' ? new IsolationBot(makeRng(seed * 4 + s), 0.6, 0.4) : makeBot('efficiency', makeRng(seed * 4 + s), randomness));
}

/** Evaluate one decision at the given live position. */
export function evaluateDecision(g: GameState, rec: DecisionRecord, a: EvalArgs, rules: RulesConfig): EvalRecord {
  const pending = g.pending()!;
  const seat = pending.seat;
  const base = g.snapshot();
  const cfg = tableConfigOf(rules);
  const actions: ActionEval[] = [];
  // dedupe discard actions by kind (same kind, different instance are identical decisions)
  const legal: LegalAction[] = []; const seenKinds = new Set<string>();
  for (const l of pending.legal) { const k = encAction(l); if (seenKinds.has(k)) continue; seenKinds.add(k); legal.push(l); }
  for (const act of legal) {
    let sum = 0, sumsq = 0, win = 0, dealin = 0, draw = 0;
    for (let i = 0; i < a.rollouts; i++) {
      // common random numbers: the SAME hidden state and rollout seeds for every action at this decision (paired comparison)
      const rSeed = fnv1a(`${rec.g}:${rec.h}:${rec.d}:${i}:${a.seed}`);
      const snap = a.mode === 'sampled' ? determinize(GameState.fromSnapshot(base, cfg, { rules }), seat, makeRng(rSeed)) : base;
      const h = GameState.fromSnapshot(snap, cfg, { rules });
      h.apply(act);
      const res = h.run(rolloutBots(a.policy, rSeed ^ 0x5bd1e995, a.randomness));
      const v = res.chipsDelta[seat]!; sum += v; sumsq += v * v;
      if (res.winner === seat) win++; else if (res.winner === null) draw++; else if (res.discarder === seat) dealin++;
    }
    const n = a.rollouts, ev = sum / n;
    actions.push({ a: encAction(act), ev, sd: Math.sqrt(Math.max(0, sumsq / n - ev * ev)), win: win / n, dealin: dealin / n, draw: draw / n, n });
  }
  actions.sort((x, y) => y.ev - x.ev);
  const selEv = actions.find((x) => x.a === rec.sel)?.ev ?? NaN;
  return { g: rec.g, h: rec.h, d: rec.d, k: rec.k, seat, bot: rec.bot, sel: rec.sel, mode: a.mode, policy: a.policy, n: a.rollouts, actions, best: actions[0]!.a, selEv, regret: actions[0]!.ev - selEv };
}

/** Pick decisions to evaluate: `hands` sampled hands (deterministic), `perHand` decisions each (prefer discards + claims with a real choice). */
export function selectDecisions(dir: string, a: EvalArgs): { hand: HandRecord; decisions: DecisionRecord[] }[] {
  const hands = loadHands(dir).filter((_, i) => i % a.workers === a.workerIndex);
  const rng = makeRng(a.seed + a.workerIndex);
  const chosen = new Map<string, HandRecord>();
  const quota = Math.ceil(a.hands / a.workers);
  while (chosen.size < Math.min(quota, hands.length)) { const h = hands[Math.floor(rng() * hands.length)]!; chosen.set(`${h.g}:${h.h}`, h); }
  const want = new Map<string, DecisionRecord[]>(); for (const k of chosen.keys()) want.set(k, []);
  for (const f of readdirSync(dir).filter((x) => x.startsWith('decisions-') && x.endsWith('.jsonl.gz'))) {
    for (const d of readJsonlGz<DecisionRecord>(join(dir, f))) { const k = `${d.g}:${d.h}`; const arr = want.get(k); if (arr && d.legal.length > 1) arr.push(d); }
  }
  const out: { hand: HandRecord; decisions: DecisionRecord[] }[] = [];
  for (const [k, ds] of want) {
    const pool = [...ds]; const pick: DecisionRecord[] = [];
    while (pick.length < a.perHand && pool.length) pick.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    pick.sort((x, y) => x.d - y.d);
    out.push({ hand: chosen.get(k)!, decisions: pick });
  }
  return out;
}

export function runEvalWorker(a: EvalArgs, progress?: (n: number) => void): { evaluated: number } {
  const rules = makeRules(a.rulesOverride);
  const out = new JsonlGzWriter(join(a.dir, `evals-w${a.workerIndex}.jsonl.gz`));
  let n = 0;
  for (const { hand, decisions } of selectDecisions(a.dir, a)) {
    for (const dec of decisions) {
      const pos = positionAt(hand, dec.d, rules, a.randomness);
      if (!pos) continue;
      // sanity: the reconstructed visible hand must match the record
      const hk = pos.g.players[pos.g.pending()!.seat]!.hand.map(kindOf).sort((x, y) => x - y).join(',');
      if (hk !== [...dec.me.h].sort((x, y) => x - y).join(',')) throw new Error(`position mismatch at ${dec.g}:${dec.h}:${dec.d}`);
      out.write(evaluateDecision(pos.g, dec, a, rules)); n++; progress?.(n);
    }
  }
  out.close();
  return { evaluated: n };
}

if (parentPort) {
  const a = workerData as EvalArgs;
  const res = runEvalWorker(a, (n) => parentPort!.postMessage({ type: 'progress', n }));
  parentPort.postMessage({ type: 'done', ...res });
} else if (process.argv[1] && /evaluate\.(ts|js)$/.test(process.argv[1])) {
  const arg = (name: string, def?: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? 'true') : def; };
  const dir = arg('dir', '../data/gen/dev')!;
  const workers = Number(arg('workers', String(Math.max(1, Math.min(8, cpus().length - 1)))));
  const base: Omit<EvalArgs, 'workerIndex'> = {
    dir, hands: Number(arg('hands', '50')), perHand: Number(arg('per-hand', '4')), rollouts: Number(arg('rollouts', '32')),
    mode: (arg('mode', 'sampled') as 'sampled' | 'oracle'), policy: (arg('policy', 'fast') as Policy), seed: Number(arg('seed', '1')), workers,
    rulesOverride: arg('rules') ? JSON.parse(arg('rules')!) : {}, randomness: arg('randomness') ? JSON.parse(arg('randomness')!) : { ranked: [0.7, 0.15, 0.1], random: 0.05 },
  };
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now(); let remaining = workers, total = 0; const prog = new Array<number>(workers).fill(0);
  for (let i = 0; i < workers; i++) {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { ...base, workerIndex: i } });
    w.on('message', (m: { type: string; n?: number; evaluated?: number }) => {
      if (m.type === 'progress') { prog[i] = m.n!; const tot = prog.reduce((x, y) => x + y, 0); if (process.stdout.isTTY) process.stdout.write(`\r${tot} decisions evaluated`); else if (tot % 50 === 0) console.log(`${tot} decisions evaluated`); }
      if (m.type === 'done') { total += m.evaluated!; if (--remaining === 0) { const s = (Date.now() - t0) / 1000; writeFileSync(join(dir, 'evals-manifest.json'), JSON.stringify({ ...base, total, seconds: s }, null, 2)); console.log(`\n${total} decisions evaluated in ${s.toFixed(0)}s (${(total / s).toFixed(2)}/s) -> ${dir}/evals-w*.jsonl.gz`); } }
    });
    w.on('error', (e) => { console.error(e); process.exit(1); });
  }
}
