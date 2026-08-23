/** Summaries over evaluator output. tsx src/evalstats.ts <dir> */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonlGz } from './stats.js';
import type { EvalRecord } from './evaluate.js';

export function loadEvals(dir: string): EvalRecord[] {
  return readdirSync(dir).filter((f) => f.startsWith('evals-') && f.endsWith('.jsonl.gz')).flatMap((f) => readJsonlGz<EvalRecord>(join(dir, f)));
}
const pct = (x: number) => (100 * x).toFixed(0).padStart(3) + '%';
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN; };

export function formatEvalStats(evs: EvalRecord[]): string {
  const L: string[] = [];
  const bad = evs.filter((e) => !Number.isFinite(e.regret));
  L.push(`${evs.length} evaluated decisions  (${bad.length} with unmatched selection)`);
  const byKey = (key: (e: EvalRecord) => string) => {
    const m = new Map<string, EvalRecord[]>();
    for (const e of evs) { if (!Number.isFinite(e.regret)) continue; const k = key(e); (m.get(k) ?? m.set(k, []).get(k)!).push(e); }
    return [...m.entries()].sort();
  };
  const table = (title: string, groups: [string, EvalRecord[]][]) => {
    L.push(`\n${title}`);
    L.push(`${'group'.padEnd(12)} ${'n'.padStart(5)}  ${'regret mean'.padStart(11)}  ${'median'.padStart(6)}  ${'p90'.padStart(6)}  ${'EV-best'.padStart(7)}  ${'top3'.padStart(5)}  ${'spread'.padStart(6)}`);
    for (const [k, g] of groups) {
      const r = g.map((e) => e.regret);
      const agree = mean(g.map((e) => e.best === e.sel ? 1 : 0)), top3 = mean(g.map((e) => e.actions.slice(0, 3).some((a) => a.a === e.sel) ? 1 : 0));
      const spread = mean(g.map((e) => e.actions[0]!.ev - e.actions[e.actions.length - 1]!.ev));
      L.push(`${k.padEnd(12)} ${String(g.length).padStart(5)}  ${mean(r).toFixed(2).padStart(11)}  ${q(r, 0.5).toFixed(2).padStart(6)}  ${q(r, 0.9).toFixed(2).padStart(6)}  ${pct(agree).padStart(7)}  ${pct(top3).padStart(5)}  ${spread.toFixed(1).padStart(6)}`);
    }
  };
  table('by bot type', byKey((e) => e.bot));
  table('by decision kind', byKey((e) => e.k));
  table('by game phase (turn of the hand)', byKey((e) => { const t = (e as unknown as { t?: number }).t; return t === undefined ? 'n/a' : t <= 15 ? 'early' : t <= 35 ? 'mid' : 'late'; }));
  // how decisive are decisions? share where best beats 2nd by > 1 SE
  const withGap = evs.filter((e) => e.actions.length > 1 && e.actions[1]!.gapSe !== undefined);
  if (withGap.length) {
    const clear1 = withGap.map((e) => (e.actions[1]!.gap > e.actions[1]!.gapSe ? 1 : 0)), clear2 = withGap.map((e) => (e.actions[1]!.gap > 2 * e.actions[1]!.gapSe ? 1 : 0));
    L.push(`\nclear best action (paired gap to runner-up > 1 SE): ${pct(mean(clear1))}   (> 2 SE): ${pct(mean(clear2))}   mean paired SE ${mean(withGap.map((e) => e.actions[1]!.gapSe)).toFixed(2)} chips`);
  } else {
    const decisive = evs.filter((e) => e.actions.length > 1).map((e) => { const a = e.actions[0]!, b = e.actions[1]!; const se = Math.sqrt(a.sd ** 2 / a.n + b.sd ** 2 / b.n); return (a.ev - b.ev) > se ? 1 : 0; });
    L.push(`\nclear best action (independent-SE gap > 1 SE over runner-up): ${pct(mean(decisive))} of decisions`);
  }
  // normalised regret: regret / EV spread of the decision (0 = picked best, 1 = picked worst)
  const norm = byKey((e) => e.bot).map(([k, g]) => `${k} ${mean(g.filter((e) => e.actions[0]!.ev - e.actions[e.actions.length - 1]!.ev > 0).map((e) => e.regret / (e.actions[0]!.ev - e.actions[e.actions.length - 1]!.ev))).toFixed(2)}`);
  L.push(`normalised regret (regret / spread, lower is better): ${norm.join('  ')}`);
  const flags: string[] = [];
  if (bad.length / evs.length > 0.01) flags.push(`${bad.length} evaluations could not match the bot's selected action`);
  const rb = byKey((e) => e.bot).find(([k]) => k === 'random')?.[1]; const eb = byKey((e) => e.bot).find(([k]) => k === 'efficiency')?.[1];
  const agree = (g: EvalRecord[]) => mean(g.map((e) => e.actions.slice(0, 3).some((a) => a.a === e.sel) ? 1 : 0));
  if (rb && eb && agree(rb) >= agree(eb)) flags.push('random bot agrees with the evaluator at least as often as the efficiency bot - evaluator or bots suspicious');
  L.push(flags.length ? `FLAGS:\n  - ${flags.join('\n  - ')}` : 'no flags');
  return L.join('\n');
}
if (process.argv[1] && /evalstats\.(ts|js)$/.test(process.argv[1])) {
  console.log(formatEvalStats(loadEvals(process.argv[2] ?? '../data/gen/dev')));
}
