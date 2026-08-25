/** Summaries over evaluator output. tsx src/evalstats.ts <dir> */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eachJsonlGz, readJsonlGz } from './stats.js';
import type { EvalRecord } from './evaluate.js';

const evalShards = (dir: string) => readdirSync(dir).filter((f) => f.startsWith('evals-') && f.endsWith('.jsonl.gz')).map((f) => join(dir, f));
/** Stream every evaluated decision in a run. The shards decompress to gigabytes, so never hold them all. */
export function eachEval(dir: string, fn: (e: EvalRecord) => void): void {
  for (const p of evalShards(dir)) eachJsonlGz<EvalRecord>(p, fn);
}
export function loadEvals(dir: string): EvalRecord[] {
  return evalShards(dir).flatMap((p) => readJsonlGz<EvalRecord>(p));
}
const pct = (x: number) => (100 * x).toFixed(0).padStart(3) + '%';
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN; };
const phaseOf = (e: EvalRecord) => { const t = (e as unknown as { t?: number }).t; return t === undefined ? 'n/a' : t <= 15 ? 'early' : t <= 35 ? 'mid' : 'late'; };

// Only `regret` is retained per decision - median and p90 need the distribution. Everything else is a running total,
// so the summary costs one number per decision per grouping instead of the whole record.
interface Group { n: number; regrets: number[]; agree: number; top3: number; spread: number; normSum: number; normN: number }
const newGroup = (): Group => ({ n: 0, regrets: [], agree: 0, top3: 0, spread: 0, normSum: 0, normN: 0 });

export interface EvalSummary { add(e: EvalRecord): void; format(): string }

/** Accumulate decisions one at a time; call format() when the stream is exhausted. */
export function evalSummary(): EvalSummary {
  let total = 0, bad = 0;
  let gapN = 0, clear1 = 0, clear2 = 0, gapSeSum = 0;   // paired-rollout gap to the runner-up
  let indepN = 0, indepHits = 0;                        // fallback for runs evaluated before gapSe existed
  const byBot = new Map<string, Group>(), byKind = new Map<string, Group>(), byPhase = new Map<string, Group>();
  const at = (m: Map<string, Group>, k: string) => { let g = m.get(k); if (!g) m.set(k, g = newGroup()); return g; };

  const add = (e: EvalRecord) => {
    total++;
    const finite = Number.isFinite(e.regret);
    if (!finite) bad++;
    const a0 = e.actions[0], a1 = e.actions[1], aN = e.actions[e.actions.length - 1];
    if (a0 && a1) {
      if (a1.gapSe !== undefined) { gapN++; gapSeSum += a1.gapSe; if (a1.gap > a1.gapSe) clear1++; if (a1.gap > 2 * a1.gapSe) clear2++; }
      indepN++;
      if (a0.ev - a1.ev > Math.sqrt(a0.sd ** 2 / a0.n + a1.sd ** 2 / a1.n)) indepHits++;
    }
    if (!finite) return;
    const spread = a0!.ev - aN!.ev;
    const agree = e.best === e.sel ? 1 : 0;
    const top3 = e.actions.slice(0, 3).some((a) => a.a === e.sel) ? 1 : 0;
    for (const g of [at(byBot, e.bot), at(byKind, e.k), at(byPhase, phaseOf(e))]) {
      g.n++; g.regrets.push(e.regret); g.agree += agree; g.top3 += top3; g.spread += spread;
    }
    if (spread > 0) { const g = at(byBot, e.bot); g.normSum += e.regret / spread; g.normN++; }
  };

  const format = () => {
    const L: string[] = [];
    L.push(`${total} evaluated decisions  (${bad} with unmatched selection)`);
    const sorted = (m: Map<string, Group>) => [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const table = (title: string, m: Map<string, Group>) => {
      L.push(`\n${title}`);
      L.push(`${'group'.padEnd(12)} ${'n'.padStart(5)}  ${'regret mean'.padStart(11)}  ${'median'.padStart(6)}  ${'p90'.padStart(6)}  ${'EV-best'.padStart(7)}  ${'top3'.padStart(5)}  ${'spread'.padStart(6)}`);
      for (const [k, g] of sorted(m)) {
        const d = Math.max(1, g.n);
        L.push(`${k.padEnd(12)} ${String(g.n).padStart(5)}  ${mean(g.regrets).toFixed(2).padStart(11)}  ${q(g.regrets, 0.5).toFixed(2).padStart(6)}  ${q(g.regrets, 0.9).toFixed(2).padStart(6)}  ${pct(g.agree / d).padStart(7)}  ${pct(g.top3 / d).padStart(5)}  ${(g.spread / d).toFixed(1).padStart(6)}`);
      }
    };
    table('by bot type', byBot);
    table('by decision kind', byKind);
    table('by game phase (turn of the hand)', byPhase);
    // how decisive are decisions? share where best beats 2nd by > 1 SE
    if (gapN) {
      L.push(`\nclear best action (paired gap to runner-up > 1 SE): ${pct(clear1 / gapN)}   (> 2 SE): ${pct(clear2 / gapN)}   mean paired SE ${(gapSeSum / gapN).toFixed(2)} chips`);
    } else {
      L.push(`\nclear best action (independent-SE gap > 1 SE over runner-up): ${pct(indepHits / Math.max(1, indepN))} of decisions`);
    }
    // normalised regret: regret / EV spread of the decision (0 = picked best, 1 = picked worst)
    L.push(`normalised regret (regret / spread, lower is better): ${sorted(byBot).map(([k, g]) => `${k} ${(g.normSum / Math.max(1, g.normN)).toFixed(2)}`).join('  ')}`);
    const flags: string[] = [];
    if (bad / total > 0.01) flags.push(`${bad} evaluations could not match the bot's selected action`);
    const rb = byBot.get('random'), eb = byBot.get('efficiency');
    const top3Rate = (g: Group) => g.top3 / Math.max(1, g.n);
    if (rb && eb && top3Rate(rb) >= top3Rate(eb)) flags.push('random bot agrees with the evaluator at least as often as the efficiency bot - evaluator or bots suspicious');
    L.push(flags.length ? `FLAGS:\n  - ${flags.join('\n  - ')}` : 'no flags');
    return L.join('\n');
  };

  return { add, format };
}

export function formatEvalStats(evs: EvalRecord[]): string {
  const s = evalSummary();
  for (const e of evs) s.add(e);
  return s.format();
}
if (process.argv[1] && /evalstats\.(ts|js)$/.test(process.argv[1])) {
  const s = evalSummary();
  eachEval(process.argv[2] ?? '../data/gen/dev', (e) => s.add(e));
  console.log(s.format());
}
