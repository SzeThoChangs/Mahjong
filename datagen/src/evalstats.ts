/** Summaries over evaluator output. tsx src/evalstats.ts <dir> */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eachJsonlGz, readJsonlGz } from './stats.js';
import { pairedSe, seVersionOf, SE_VERSION } from './se.js';
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

/** Accumulate decisions one at a time; call format() when the stream is exhausted.
 *  `seVersion` says which gapSe formula wrote the run - pass seVersionOf(dir), never assume the current one. */
export function evalSummary(seVersion: number = SE_VERSION): EvalSummary {
  let total = 0, bad = 0;
  let gapN = 0, clear1 = 0, clear2 = 0, gapSeSum = 0;   // paired-rollout gap to the runner-up
  let indepN = 0, indepHits = 0;                        // fallback for runs evaluated before gapSe existed
  const decisive = new Map<string, { n: number; c: number }>();   // share clear at 2 SE, by decision kind
  // How much the paired rollouts actually cancel. rho = 1 means the two branches follow each other
  // exactly and only the action's own effect survives; rho = 0 means the pairing bought nothing and
  // the branches are independent play-outs. This is the number that says whether the noise floor is
  // a coupling problem (fixable by sharing randomness) or a structural one (not).
  let rhoN = 0, rhoSum = 0, sdSum = 0, diffSdSum = 0;
  const byBot = new Map<string, Group>(), byKind = new Map<string, Group>(), byPhase = new Map<string, Group>();
  const at = (m: Map<string, Group>, k: string) => { let g = m.get(k); if (!g) m.set(k, g = newGroup()); return g; };

  const add = (e: EvalRecord) => {
    total++;
    const finite = Number.isFinite(e.regret);
    if (!finite) bad++;
    const a0 = e.actions[0], a1 = e.actions[1], aN = e.actions[e.actions.length - 1];
    if (a0 && a1) {
      const se = pairedSe(a1, a0, seVersion);
      if (Number.isFinite(se)) {
        gapN++; gapSeSum += se; if (a1.gap > se) clear1++; if (a1.gap > 2 * se) clear2++;
        let d = decisive.get(e.k); if (!d) decisive.set(e.k, d = { n: 0, c: 0 });
        d.n++; if (a1.gap > 2 * se) d.c++;
        // Var(A-B) = se^2 * k over the k paired rollouts; rho from Var(A-B) = varA + varB - 2*rho*sdA*sdB
        const k = Math.max(1, Math.min(a0.n, a1.n));
        const diffVar = se * se * k;
        if (a0.sd > 1e-9 && a1.sd > 1e-9) {
          rhoN++; rhoSum += (a0.sd ** 2 + a1.sd ** 2 - diffVar) / (2 * a0.sd * a1.sd);
          sdSum += (a0.sd + a1.sd) / 2; diffSdSum += Math.sqrt(diffVar);
        }
      }
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
      L.push(`  clear at 2 SE by kind: ${[...decisive.entries()].sort().map(([k, d]) => `${k} ${pct(d.c / Math.max(1, d.n)).trim()}`).join('  ')}`);
      if (seVersion < SE_VERSION) L.push(`  (run stored gapSe with the sqrt(k)-short formula; corrected on read)`);
      if (rhoN) {
        const rho = rhoSum / rhoN, sd = sdSum / rhoN, diffSd = diffSdSum / rhoN;
        const independent = sd * Math.SQRT2;                       // difference SD if the branches shared nothing
        L.push(`pairing: outcome SD ${sd.toFixed(1)} chips, paired-difference SD ${diffSd.toFixed(1)}, correlation ${rho.toFixed(2)}`);
        L.push(`  sharing the deal already cuts the difference SD from ${independent.toFixed(1)} (independent) to ${diffSd.toFixed(1)} - ${(100 * (1 - diffSd / independent)).toFixed(0)}% of the way to zero`);
        L.push(`  remaining headroom is what better coupling could win; halving the SE by rollouts alone costs 4x the compute`);
      }
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

export function formatEvalStats(evs: EvalRecord[], seVersion: number = SE_VERSION): string {
  const s = evalSummary(seVersion);
  for (const e of evs) s.add(e);
  return s.format();
}
if (process.argv[1] && /evalstats\.(ts|js)$/.test(process.argv[1])) {
  const dir = process.argv[2] ?? '../data/gen/dev';
  const s = evalSummary(seVersionOf(dir));
  eachEval(dir, (e) => s.add(e));
  console.log(s.format());
}
