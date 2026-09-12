/**
 * Does the play-out policy under-price taking a win?
 *
 *   tsx src/winprice.ts --dir ../data/gen/run-min1 --n 40 --rollouts 512
 *
 * The Play tab judges each of your decisions with `rejudge`, the same instrument as the packs, and
 * on its first played hand it called a Pass on an offered win better than taking it. That is one
 * anecdote, and one anecdote is not a bias. This measures it.
 *
 * WHY IT WOULD HAPPEN. Taking a win is terminal and its payoff is exact: the judge does not have
 * to estimate it. Passing is not, so its value is whatever the play-outs say happens afterwards,
 * and that depends entirely on who is sitting in the other three chairs during the roll-out. The
 * default policy is `shanten`, a bot that plays for speed alone: it never folds and it never
 * defends. Against three of those, a hand that is one tile away keeps getting fed, so passing on a
 * small win looks cheap. Against three coaches it would not.
 *
 * WHAT THIS DOES. It finds recorded positions where a win was legally on offer, and judges each
 * one under every rollout policy, on the same seed and the same number of play-outs. The win's own
 * value is a fixed number that no policy can move, so any movement is in the alternative, and the
 * gap between them is what the verdict on screen is made of.
 *
 * READ THE OUTPUT LIKE THIS. `win EV` should be identical across policies - if it is not, the
 * measurement is broken, not the policy. `pass EV` is the estimate under test. If the gap flips
 * sign between `shanten` and `coach`, the screen's warning is right and the policy is the fix.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { rejudge, type RejudgedAction } from 'sg-mahjong-solver';
import { rulesForDir } from './tablerules.js';
import { loadHands, eachJsonlGz } from './stats.js';
import { positionAt } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { DecisionRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-min1')!;
const want = Number(arg('n', '40'));
const rollouts = Number(arg('rollouts', '512'));
const seed = Number(arg('seed', '9109'));
/**
 * Each arm is a rollout policy, or `oracle:<policy>` to play the hand's REAL hidden tiles instead
 * of re-dealing them. Oracle is calibration only - no judge on a phone can know the other hands -
 * but it separates two different ways the estimate could be wrong. If the arms agree, guessing the
 * hidden tiles is not what is bending the number.
 */
const ARMS = (arg('arms', 'shanten,coach')!).split(',');
const armPolicy = (a: string) => (a.startsWith('oracle:') ? a.slice(7) : a) as 'fast' | 'shanten' | 'coach';
const armOracle = (a: string) => a.startsWith('oracle:');

const rules = rulesForDir(dir);

// ---- find the spots cheaply -------------------------------------------------------------------
// The recorded decisions carry their legal actions as strings, so a win that could be declined is
// a string scan over the decision files rather than a replay of 120,000 hands.
const spots: { g: number; h: number; d: number }[] = [];
const seenHand = new Set<string>();
outer: for (const f of readdirSync(dir).filter((n) => /^decisions-w\d+\.jsonl\.gz$/.test(n)).sort()) {
  eachJsonlGz<DecisionRecord>(join(dir, f), (r) => {
    if (spots.length >= want) return;
    if (!r.legal || r.legal.length < 2 || !r.legal.includes('win')) return;
    const key = `${r.g}:${r.h}`;
    if (seenHand.has(key)) return;                 // one per hand, so the sample is not one hand's luck
    seenHand.add(key);
    spots.push({ g: r.g, h: r.h, d: r.d });
  });
  if (spots.length >= want) break outer;
}

const wanted = new Set(spots.map((s) => `${s.g}:${s.h}`));
const hands = new Map(loadHands(dir).filter((h) => wanted.has(`${h.g}:${h.h}`)).map((h) => [`${h.g}:${h.h}`, h]));

console.log(`${spots.length} positions where a win was on offer and could be declined · ${rollouts} play-outs each · arms ${ARMS.join(', ')}\n`);
const agg: Record<string, { n: number; win: number; alt: number; gap: number; winBest: number }> = {};
for (const p of ARMS) agg[p] = { n: 0, win: 0, alt: 0, gap: 0, winBest: 0 };

const skipped: Record<string, number> = {};
const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1; };
for (const s of spots) {
  const rec = hands.get(`${s.g}:${s.h}`);
  if (!rec) { skip('hand not loaded'); continue; }
  const pos = positionAt(rec, s.d, rules, DEFAULT_RANDOMNESS);
  if (!pos) { skip('decision index not reached'); continue; }
  const pending = pos.g.pending();
  if (!pending) { skip('nothing pending'); continue; }
  if (!pending.legal.some((l) => l.a === 'win')) { skip(`no win offered, got [${pending.legal.map((l) => l.a).join(' ')}]`); continue; }
  const key = `${s.g}:${s.h}:${s.d}`;
  const row: string[] = [key.padEnd(14)];
  for (const arm of ARMS) {
    const policy = armPolicy(arm);
    let out: RejudgedAction[];
    try { out = rejudge(pos.g.snapshot(), rules, pending.seat, pending.legal, { rollouts, seed, key, policy, oracle: armOracle(arm) }); }
    catch (e) { row.push(`${arm}: ${(e as Error).message}`); continue; }
    const win = out.find((a) => a.a === 'win');
    const alt = out.filter((a) => a.a !== 'win').sort((x, y) => y.ev - x.ev)[0];
    if (!win || !alt) continue;
    const gap = win.ev - alt.ev;
    const a = agg[arm]!;
    a.n++; a.win += win.ev; a.alt += alt.ev; a.gap += gap; if (gap > 0) a.winBest++;
    row.push(`${arm} win ${win.ev.toFixed(2)} vs ${alt.a} ${alt.ev.toFixed(2)} (${gap >= 0 ? '+' : ''}${gap.toFixed(2)})`);
  }
  console.log(row.join('  |  '));
}

for (const [why, n] of Object.entries(skipped)) console.log(`skipped ${n}: ${why}`);
console.log('');
for (const p of ARMS) {
  const a = agg[p]!;
  if (!a.n) { console.log(`${p}: nothing judged`); continue; }
  console.log(`${p.padEnd(8)} n=${a.n}  mean win ${(a.win / a.n).toFixed(2)}  mean best alternative ${(a.alt / a.n).toFixed(2)}  mean gap ${a.gap / a.n >= 0 ? '+' : ''}${(a.gap / a.n).toFixed(2)}  taking the win is best on ${a.winBest}/${a.n}`);
}
