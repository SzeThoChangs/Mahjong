/** Validation statistics over generated hands. tsx src/stats.ts <out-dir> */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { HandRecord } from './records.js';

/**
 * Stream a .jsonl.gz one record at a time. The decompressed bytes live in a Buffer (outside the V8 heap)
 * and only one line is ever a string, so a caller that keeps just a summary stays flat in memory
 * no matter how large the file is. Use this over readJsonlGz for the big evals-*.jsonl.gz shards.
 */
export function eachJsonlGz<T>(path: string, fn: (rec: T) => void): void {
  const raw = readFileSync(path);
  if (raw.length === 0) return;
  const buf = gunzipSync(raw);
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0x0a) continue;
    if (i > start) fn(JSON.parse(buf.toString('utf8', start, i)) as T);
    start = i + 1;
  }
  if (start < buf.length) fn(JSON.parse(buf.toString('utf8', start, buf.length)) as T);
}
/** Whole file as an array. Fine for hands/truth; for evals prefer eachJsonlGz. */
export function readJsonlGz<T>(path: string): T[] {
  const out: T[] = [];
  eachJsonlGz<T>(path, (r) => out.push(r));
  return out;
}
export function loadHands(dir: string): HandRecord[] {
  return readdirSync(dir).filter((f) => f.startsWith('hands-') && f.endsWith('.jsonl.gz')).flatMap((f) => readJsonlGz<HandRecord>(join(dir, f)));
}

export interface Stats {
  hands: number; sessions: number; avgTurns: number; winRate: number; drawRate: number; selfDrawRate: number; discardWinRate: number;
  chowPerHand: number; pongPerHand: number; kongPerHand: number; flowersPerHand: number; animalsPerHand: number;
  avgTai: number; actionsPerHand: number; illegal: number; chipsSum: number;
  winRateBySeat: number[]; chipsPerHandBySeat: number[];
  combos: Record<string, number>; botActions: Record<string, Record<string, number>>; winRateByBot: Record<string, number>;
  flags: string[];
}
export function computeStats(hands: HandRecord[]): Stats {
  const n = hands.length;
  const sum = (f: (h: HandRecord) => number) => hands.reduce((a, h) => a + f(h), 0);
  const wins = hands.filter((h) => h.winner !== null);
  const st: Stats = {
    hands: n, sessions: new Set(hands.map((h) => h.g)).size,
    avgTurns: sum((h) => h.turns) / n, winRate: wins.length / n, drawRate: 1 - wins.length / n,
    selfDrawRate: wins.filter((h) => h.sd).length / Math.max(1, wins.length), discardWinRate: wins.filter((h) => !h.sd).length / Math.max(1, wins.length),
    chowPerHand: sum((h) => h.cnt.chow) / n, pongPerHand: sum((h) => h.cnt.pong) / n, kongPerHand: sum((h) => h.cnt.kong) / n,
    flowersPerHand: sum((h) => h.cnt.flowers) / n, animalsPerHand: sum((h) => h.cnt.animals) / n,
    avgTai: wins.reduce((a, h) => a + (h.fan ?? 0), 0) / Math.max(1, wins.length), actionsPerHand: sum((h) => h.cnt.decisions) / n,
    illegal: sum((h) => h.cnt.illegal), chipsSum: sum((h) => h.delta.reduce((a, b) => a + b, 0)),
    winRateBySeat: [0, 1, 2, 3].map((s) => wins.filter((h) => h.winner === s).length / n),
    chipsPerHandBySeat: [0, 1, 2, 3].map((s) => sum((h) => h.delta[s]!) / n),
    combos: {}, botActions: {}, winRateByBot: {}, flags: [],
  };
  for (const h of wins) st.combos[h.combo!] = (st.combos[h.combo!] ?? 0) + 1;
  const seatsByBot: Record<string, number> = {}, winsByBot: Record<string, number> = {};
  for (const h of hands) {
    for (const [bot, acts] of Object.entries(h.acts)) { const d = (st.botActions[bot] ??= {}); for (const [a, c] of Object.entries(acts)) d[a] = (d[a] ?? 0) + c; }
    h.bots.forEach((b, s) => { seatsByBot[b] = (seatsByBot[b] ?? 0) + 1; if (h.winner === s) winsByBot[b] = (winsByBot[b] ?? 0) + 1; });
  }
  for (const b of Object.keys(seatsByBot)) st.winRateByBot[b] = (winsByBot[b] ?? 0) / seatsByBot[b]!;
  // ---- flags: things that would indicate an engine or bot bug ----
  const f = st.flags;
  if (st.illegal > 0) f.push(`ILLEGAL ACTIONS: ${st.illegal} (must be 0)`);
  if (st.chipsSum !== 0) f.push(`chips do not net to zero: ${st.chipsSum}`);
  // Dumb bots under a 2-tai minimum draw a lot (4x efficiency: 29% greedy, ~57% with 70/15/10/5 randomness; 4x random: 97%).
  if (st.drawRate > 0.75 || st.drawRate < 0.02) f.push(`draw rate ${(st.drawRate * 100).toFixed(1)}% outside 2-75% (expected ~50-65% with default randomness)`);
  if (st.avgTurns < 25 || st.avgTurns > 85) f.push(`avg turns ${st.avgTurns.toFixed(1)} outside 25-85`);
  const wr = st.winRateBySeat; if (Math.max(...wr) - Math.min(...wr) > 0.10) f.push(`seat win-rate spread ${(100 * (Math.max(...wr) - Math.min(...wr))).toFixed(1)} pts > 10`);
  if (st.flowersPerHand < 5 || st.flowersPerHand > 9) f.push(`flowers per hand ${st.flowersPerHand.toFixed(2)} outside 5-9 (8 exist; ~6-7 surface before the wall ends)`);
  if (st.animalsPerHand < 2 || st.animalsPerHand > 4.01) f.push(`animals per hand ${st.animalsPerHand.toFixed(2)} outside 2-4`);
  if (st.kongPerHand > 1.5) f.push(`kongs per hand ${st.kongPerHand.toFixed(2)} suspiciously high`);
  if (st.avgTai < 1 || st.avgTai > 6) f.push(`avg tai ${st.avgTai.toFixed(2)} outside 1-6`);
  for (const [b, r] of Object.entries(st.winRateByBot)) if (r > 0.5) f.push(`bot ${b} wins ${(r * 100).toFixed(0)}% of its seats`);
  if (Object.keys(st.botActions).length < 5) f.push(`only ${Object.keys(st.botActions).length} bot types appear`);
  return st;
}
export function formatStats(st: Stats): string {
  const pct = (x: number) => (100 * x).toFixed(1) + '%';
  const L = [
    `hands ${st.hands}  sessions ${st.sessions}  avg turns ${st.avgTurns.toFixed(1)}  actions/hand ${st.actionsPerHand.toFixed(1)}`,
    `win ${pct(st.winRate)}  draw ${pct(st.drawRate)}  | of wins: self-draw ${pct(st.selfDrawRate)}  discard ${pct(st.discardWinRate)}  avg tai ${st.avgTai.toFixed(2)}`,
    `per hand: chow ${st.chowPerHand.toFixed(2)}  pong ${st.pongPerHand.toFixed(2)}  kong ${st.kongPerHand.toFixed(2)}  flowers ${st.flowersPerHand.toFixed(2)}  animals ${st.animalsPerHand.toFixed(2)}`,
    `win by seat  E ${pct(st.winRateBySeat[0]!)}  S ${pct(st.winRateBySeat[1]!)}  W ${pct(st.winRateBySeat[2]!)}  N ${pct(st.winRateBySeat[3]!)}   chips/hand by seat ${st.chipsPerHandBySeat.map((x) => x.toFixed(2)).join(' / ')}`,
    `win by bot   ` + Object.entries(st.winRateByBot).map(([b, r]) => `${b} ${pct(r)}`).join('  '),
    `combinations ` + Object.entries(st.combos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '),
    `illegal actions ${st.illegal}   chips net ${st.chipsSum}`,
    `bot action distributions:`,
    ...Object.entries(st.botActions).map(([b, a]) => `  ${b.padEnd(11)} ` + Object.entries(a).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join('  ')),
    st.flags.length ? `FLAGS:\n  - ${st.flags.join('\n  - ')}` : 'no flags',
  ];
  return L.join('\n');
}
if (process.argv[1] && /[\\/]stats\.(ts|js)$/.test(process.argv[1])) {
  const dir = process.argv[2] ?? '../data/gen/dev';
  const hands = loadHands(dir);
  console.log(formatStats(computeStats(hands)));
}
