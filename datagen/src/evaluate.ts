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
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { GameState, makeRng, tableConfigOf, IsolationBot, ShantenBot, kindOf, type Bot, type LegalAction, type RulesConfig, type Snapshot } from 'sg-mahjong-engine';
import { positionAt, determinize } from './position.js';
import { playHand } from './session.js';
import { makeBot, type RandomnessConfig } from './bots.js';
import { loadHands, readJsonlGz } from './stats.js';
import { JsonlGzWriter } from './writer.js';
import { rulesForDir } from './tablerules.js';
import { encAction, fnv1a, type DecisionRecord, type HandRecord } from './records.js';

export type Policy = 'fast' | 'shanten' | 'efficiency';
export interface EvalArgs { dir: string; hands: number; perHand: number; rollouts: number; mode: 'sampled' | 'oracle'; policy: Policy; seed: number; workers: number; workerIndex: number; rulesOverride: object; randomness: RandomnessConfig; adaptive?: boolean; resume?: boolean }
/** Outcome mix for one action, from the acting seat's point of view.
 *  `w` keys are `<role><fan>` where role is: W self-draw win, D discard win, s pays the shooter share,
 *  o pays the other share, z pays a self-draw share, l pays everything (pay-all), n pays nothing, d draw.
 *  `led` is the summed ledger units (kongEach, kongFed, biteFH, biteFO, biteAH, biteAO).
 *  Together these let any money schedule be priced later without re-simulating. */
export interface OutcomeMix { w: Record<string, number>; led: [number, number, number, number, number, number, number] }
export interface ActionEval { a: string; ev: number; sd: number; win: number; dealin: number; draw: number; n: number; gap: number; gapSe: number; mix?: OutcomeMix }
// gap = EV(best) - EV(this), gapSe = standard error of that gap computed on PAIRED rollouts (same hidden states)
export interface EvalRecord { g: number; h: number; d: number; k: string; t: number; seat: number; bot: string; sel: string; mode: string; policy: string; n: number; actions: ActionEval[]; best: string; selEv: number; regret: number }

function rolloutBots(policy: Policy, seed: number, randomness: RandomnessConfig): Bot[] {
  return [0, 1, 2, 3].map((s) => policy === 'fast' ? new IsolationBot(makeRng(seed * 4 + s), 0.6, 0.4) : policy === 'shanten' ? new ShantenBot(makeRng(seed * 4 + s)) : makeBot('efficiency', makeRng(seed * 4 + s), randomness));
}

/** Evaluate one decision at the given live position. */
export function evaluateDecision(g: GameState, rec: DecisionRecord, a: EvalArgs, rules: RulesConfig): EvalRecord {
  const pending = g.pending()!;
  const seat = pending.seat;
  const base = g.snapshot();
  const cfg = tableConfigOf(rules);
  // dedupe discard actions by kind (same kind, different instance are identical decisions)
  const legal: LegalAction[] = []; const seenKinds = new Set<string>();
  for (const l of pending.legal) { const k = encAction(l); if (seenKinds.has(k)) continue; seenKinds.add(k); legal.push(l); }

  // rollout i uses hidden state i and rollout-bot seeds i for EVERY action (common random numbers)
  const hiddenCache = new Map<number, Snapshot>();
  const hidden = (i: number): Snapshot => {
    if (a.mode === 'oracle') return base;
    let h = hiddenCache.get(i);
    if (!h) { const rSeed = fnv1a(`${rec.g}:${rec.h}:${rec.d}:${i}:${a.seed}`); h = determinize(GameState.fromSnapshot(base, cfg, { rules }), seat, makeRng(rSeed)); hiddenCache.set(i, h); }
    return h;
  };
  const acc = legal.map((act) => ({ act, key: encAction(act), sum: 0, sumsq: 0, win: 0, dealin: 0, draw: 0, n: 0, outcomes: [] as number[], mix: { w: {} as Record<string, number>, led: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number] } }));
  const roll = (x: typeof acc[number], i: number) => {
    const rSeed = fnv1a(`${rec.g}:${rec.h}:${rec.d}:${i}:${a.seed}`);
    const h = GameState.fromSnapshot(hidden(i), cfg, { rules });
    h.apply(x.act);
    const res = h.run(rolloutBots(a.policy, rSeed ^ 0x5bd1e995, a.randomness));
    const v = res.chipsDelta[seat]!; x.sum += v; x.sumsq += v * v; x.n++; x.outcomes[i] = v;
    if (res.winner === seat) x.win++; else if (res.winner === null) x.draw++; else if (res.discarder === seat) x.dealin++;
    // record the outcome in re-priceable form
    const L = res.ledger[seat]!;
    x.mix.led[0] += L.kongConcealed; x.mix.led[1] += L.kongExposed; x.mix.led[2] += L.kongFed;
    x.mix.led[3] += L.biteFlowerHidden; x.mix.led[4] += L.biteFlowerOpen; x.mix.led[5] += L.biteAnimalHidden; x.mix.led[6] += L.biteAnimalOpen;
    let role: string;
    if (res.winner === null) role = 'd';
    else if (res.winner === seat) role = res.selfDraw || res.score?.combination === 'shi_san_yao' ? 'W' : 'D';
    else if (res.liable !== null) role = res.liable === seat ? 'l' : 'n';
    else if (res.selfDraw || res.score?.combination === 'shi_san_yao') role = 'z';
    else role = res.discarder === seat ? 's' : 'o';
    const key = role + (res.score?.fan ?? 0);
    x.mix.w[key] = (x.mix.w[key] ?? 0) + 1;
  };
  if (!a.adaptive || acc.length <= 2) {
    for (const x of acc) for (let i = 0; i < a.rollouts; i++) roll(x, i);
  } else {
    // successive halving: everyone gets n0; the top half gets up to 2n0; the top quarter up to 4n0 (= a.rollouts)
    const n0 = Math.max(4, Math.ceil(a.rollouts / 4));
    let alive = [...acc]; let target = n0;
    while (true) {
      for (const x of alive) for (let i = x.n; i < target; i++) roll(x, i);
      if (alive.length <= 2 || target >= a.rollouts) break;
      alive.sort((p, q) => q.sum / q.n - p.sum / p.n);
      alive = alive.slice(0, Math.max(2, Math.ceil(alive.length / 2)));
      target = Math.min(a.rollouts, target * 2);
    }
  }
  const evOf = (x: typeof acc[number]) => x.sum / x.n;
  const bestAcc = acc.reduce((p, q) => (evOf(q) > evOf(p) ? q : p));
  const actions: ActionEval[] = acc.map((x) => {
    const ev = evOf(x);
    // paired gap to the best action over the rollout indices both have
    let m = 0, m2 = 0, k = 0;
    for (let i = 0; i < Math.min(x.outcomes.length, bestAcc.outcomes.length); i++) { const a = bestAcc.outcomes[i], b = x.outcomes[i]; if (a === undefined || b === undefined) continue; const d = a - b; m += d; m2 += d * d; k++; }
    const gap = k ? m / k : 0, gapVar = k > 1 ? Math.max(0, m2 / k - gap * gap) / (k - 1) * k / Math.max(1, k) : 0;
    return { a: x.key, ev, sd: Math.sqrt(Math.max(0, x.sumsq / x.n - ev * ev)), win: x.win / x.n, dealin: x.dealin / x.n, draw: x.draw / x.n, n: x.n, gap, gapSe: Math.sqrt(gapVar / Math.max(1, k)), mix: x.mix };
  });
  actions.sort((x, y) => y.ev - x.ev);
  const selEv = actions.find((x) => x.a === rec.sel)?.ev ?? NaN;
  return { g: rec.g, h: rec.h, d: rec.d, k: rec.k, t: rec.t, seat, bot: rec.bot, sel: rec.sel, mode: a.mode, policy: a.policy, n: a.rollouts, actions, best: actions[0]!.a, selEv, regret: actions[0]!.ev - selEv };
}

/** All decision records of a hand, reconstructed by replaying it (no need to read the decision shards).
 *  Returns null when the replay does not reproduce the recorded hand (hash mismatch) - e.g. the dataset
 *  was generated by an engine with different rules semantics. Callers must skip such hands. */
export function decisionsOfHand(hand: HandRecord, rules: RulesConfig, randomness: RandomnessConfig): DecisionRecord[] | null {
  const out: DecisionRecord[] = [];
  const scoresBefore = hand.scores.map((s, i) => s - hand.delta[i]!);
  const { record } = playHand({ sessionId: hand.g, handIdx: hand.h, seed: hand.seed, dealer: hand.dl, prevailingWind: hand.w, botTypes: hand.bots, scores: scoresBefore }, rules, randomness, { decision: (r) => out.push(r), hand: () => {} }, true);
  if (record.hash !== hand.hash || record.winner !== hand.winner || record.turns !== hand.turns) return null;
  return out;
}

/** Pick decisions to evaluate: `hands` sampled hands (deterministic), `perHand` decisions each, only decisions with a real choice. */
export function selectDecisions(dir: string, a: EvalArgs, rules: RulesConfig): { hand: HandRecord; decisions: DecisionRecord[] }[] {
  const hands = loadHands(dir).filter((_, i) => i % a.workers === a.workerIndex);
  const rng = makeRng(a.seed + a.workerIndex);
  const chosen = new Map<string, HandRecord>();
  const quota = Math.ceil(a.hands / a.workers);
  while (chosen.size < Math.min(quota, hands.length)) { const h = hands[Math.floor(rng() * hands.length)]!; chosen.set(`${h.g}:${h.h}`, h); }
  const out: { hand: HandRecord; decisions: DecisionRecord[] }[] = [];
  let drifted = 0;
  for (const hand of chosen.values()) {
    const all = decisionsOfHand(hand, rules, a.randomness);
    if (!all) { drifted++; continue; }
    const pool = all.filter((d) => d.legal.length > 1);
    const pick: DecisionRecord[] = [];
    while (pick.length < a.perHand && pool.length) pick.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    pick.sort((x, y) => x.d - y.d);
    out.push({ hand, decisions: pick });
  }
  if (drifted) console.error(`[w${a.workerIndex}] ${drifted} hands did not replay under the current engine and were skipped`);
  return out;
}

export function runEvalWorker(a: EvalArgs, progress?: (n: number) => void): { evaluated: number; skipped: number; errors: number } {
  const rules = rulesForDir(a.dir, a.rulesOverride);
  const path = join(a.dir, `evals-w${a.workerIndex}.jsonl.gz`);
  // --resume: skip decisions already on disk (selection is deterministic, so the same worker sees the same hands)
  const done = new Set<string>();
  if (a.resume && existsSync(path)) for (const e of readJsonlGz<EvalRecord>(path)) done.add(`${e.g}:${e.h}:${e.d}`);
  const out = new JsonlGzWriter(path, 1 << 20, a.resume);
  let n = 0, skipped = 0, errors = 0;
  for (const { hand, decisions } of selectDecisions(a.dir, a, rules)) {
    for (const dec of decisions) {
      if (done.has(`${dec.g}:${dec.h}:${dec.d}`)) { skipped++; continue; }
      try {
        const pos = positionAt(hand, dec.d, rules, a.randomness);
        if (!pos) continue;
        // sanity: the reconstructed visible hand must match the record
        const hk = pos.g.players[pos.g.pending()!.seat]!.hand.map(kindOf).sort((x, y) => x - y).join(',');
        if (hk !== [...dec.me.h].sort((x, y) => x - y).join(',')) throw new Error(`position mismatch at ${dec.g}:${dec.h}:${dec.d}`);
        out.write(evaluateDecision(pos.g, dec, a, rules)); n++; progress?.(n);
      } catch (e) {
        errors++; console.error(`[w${a.workerIndex}] decision ${dec.g}:${dec.h}:${dec.d} (${dec.k}) failed: ${(e as Error).message}`);
        if (errors > 50) throw e;            // something systematic: stop this worker
      }
    }
  }
  out.close();
  return { evaluated: n, skipped, errors };
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
    mode: (arg('mode', 'sampled') as 'sampled' | 'oracle'), policy: (arg('policy', 'shanten') as Policy), seed: Number(arg('seed', '1')), workers, adaptive: process.argv.includes('--adaptive'), resume: process.argv.includes('--resume'),
    rulesOverride: arg('rules') ? JSON.parse(arg('rules')!) : {}, randomness: arg('randomness') ? JSON.parse(arg('randomness')!) : { ranked: [0.7, 0.15, 0.1], random: 0.05 },
  };
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now(); let remaining = workers, total = 0; const prog = new Array<number>(workers).fill(0);
  for (let i = 0; i < workers; i++) {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { ...base, workerIndex: i } });
    let totalSkipped = 0, totalErrors = 0, failedWorkers = 0;
    const finishIfDone = () => {
      if (--remaining !== 0) return;
      const s = (Date.now() - t0) / 1000;
      writeFileSync(join(dir, 'evals-manifest.json'), JSON.stringify({ ...base, total, skipped: totalSkipped, errors: totalErrors, failedWorkers, seconds: s }, null, 2));
      console.log(`\n${total} decisions evaluated in ${s.toFixed(0)}s (${(total / s).toFixed(2)}/s), ${totalSkipped} skipped (resume), ${totalErrors} errors, ${failedWorkers} failed workers -> ${dir}/evals-w*.jsonl.gz`);
    };
    w.on('message', (m: { type: string; n?: number; evaluated?: number; skipped?: number; errors?: number }) => {
      if (m.type === 'progress') { prog[i] = m.n!; const tot = prog.reduce((x, y) => x + y, 0); if (process.stdout.isTTY) process.stdout.write(`\r${tot} decisions evaluated`); else if (tot % 50 === 0) console.log(`${tot} decisions evaluated`); }
      if (m.type === 'done') { total += m.evaluated!; totalSkipped += m.skipped ?? 0; totalErrors += m.errors ?? 0; finishIfDone(); }
    });
    w.on('error', (e) => { console.error(`worker ${i} failed:`, e); failedWorkers++; finishIfDone(); });   // other workers keep going; rerun with --resume
  }
}
