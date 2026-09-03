/**
 * Fit the coach's value tables on OUR games instead of the study author's simulations.
 *
 *   tsx src/valuefit.ts [--run ../data/gen/run-coach2] [--out ../data/gen/valuefit-cells.json]
 *
 * `solver/src/tables.ts` is what turns a hand into a number of chips, and it is auto-generated from
 * "A Data Analytic Evaluation of Singapore Mahjong". It is the largest piece of the coach that has
 * never been checked against anything we measured. That was not worth fixing while the value side
 * looked inert; it is worth fixing now that removing the coach's pattern plans has been shown to
 * cost 1.928 +/- 0.075 chips a game.
 *
 * The recorded run already holds what a fit needs. Every decision stores the hand as it stood and
 * the turn it stood on, and the hands file stores what that seat finally won or lost. Join them and
 * a table cell is just an average.
 *
 * THREE THINGS DECIDE WHETHER THE NUMBERS MEAN ANYTHING.
 *
 * The conditioning. The study's tables read "playing for All-Pong with this breakdown, expect this
 * many chips", so they are conditional on pursuing the plan. An average over every hand that merely
 * SCORES that way is a different quantity, and mixing the two would produce tables that rank plans
 * wrongly while looking perfectly plausible. Both are collected here, under `pursued` and `all`.
 * `pursued` keeps only the plan the coach was actually playing, which is the top of the sorted list
 * `evaluateTargets` returns, and it is the one that matches what the table is for.
 *
 * The sample unit. Every decision in a hand shares one outcome, so a hand that ran forty turns
 * contributes forty rows that cannot disagree. Counting decisions would make a cell of one hand look
 * like a cell of forty. Hands are counted separately and are what the fit should weight by.
 *
 * What this estimates. Fitting on coach-played hands estimates the value of a position UNDER THE
 * COACH'S OWN POLICY, not under best play. That is the right first step - it is what the coach
 * should believe if it keeps playing the way it does - but it means the fit cannot discover value in
 * a plan the coach never pursues, and a second pass on hands played by the re-fitted coach would say
 * something different again.
 */
import { createReadStream, writeFileSync, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { evaluateTargets } from 'sg-mahjong-solver';
import type { Meld } from 'sg-mahjong-engine';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const runDir = arg('run', '../data/gen/run-coach2');
const outFile = arg('out', '../data/gen/valuefit-cells.json');

/** The tables carry rows at 0, 20 and 40 player turns and `byTurn` interpolates between them, so a
 *  fit has to land on those same three anchors or the interpolation stops meaning what it meant. */
const turnRow = (t: number): 0 | 20 | 40 => (t < 10 ? 0 : t < 30 ? 20 : 40);

interface Cell { sum: number; n: number; hands: number; pred: number; last: string }
const cells = new Map<string, Cell>();
const key = (mode: string, plan: string, value: string, row: number) => `${mode}|${plan}|${value}|${row}`;

function add(mode: string, plan: string, value: string, row: number, chips: number, pred: number, hand: string): void {
  const k = key(mode, plan, value, row);
  let c = cells.get(k);
  if (!c) { c = { sum: 0, n: 0, hands: 0, pred: 0, last: '' }; cells.set(k, c); }
  c.sum += chips; c.n++; c.pred += pred;
  if (c.last !== hand) { c.hands++; c.last = hand; }
}

const decMelds = (m: number[][]): Meld[] =>
  m.map((x) => ({ type: x[0] === 0 ? 'chow' : x[0] === 1 ? 'pong' : 'kong', tiles: x.slice(2), concealed: x[1] === 1 }) as Meld);

async function readShard(w: number, totals: { lines: number; used: number; skippedNoHand: number; outOfOrder: number }): Promise<void> {
  const handsPath = join(runDir, `hands-w${w}.jsonl.gz`);
  const decPath = join(runDir, `decisions-w${w}.jsonl.gz`);
  if (!existsSync(handsPath) || !existsSync(decPath)) return;

  // The outcome of every decision in a hand is that hand's result, so the hands file is the lookup.
  // 18,750 hands a shard, so this fits in memory comfortably and the join stays inside one shard.
  const delta = new Map<string, number[]>();
  {
    const rl = createInterface({ input: createReadStream(handsPath).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of rl) {
      const h = JSON.parse(line) as { g: number; h: number; delta: number[] };
      delta.set(`${h.g}:${h.h}`, h.delta);
    }
  }

  // Decisions of one hand are written together, so a cell can count distinct hands by watching for
  // the id changing rather than by holding every id it has seen. Violations are counted, not assumed
  // away: if the file is ever not grouped this way the hand counts would silently inflate.
  const seenHands = new Set<string>();
  let prevHand = '';
  const rl = createInterface({ input: createReadStream(decPath).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    totals.lines++;
    const r = JSON.parse(line) as {
      g: number; h: number; k: string; t: number; p: number; dl: number; w: number; rem: number;
      me: { h: number[]; b: number[]; m: number[][] };
    };
    if (r.k !== 'discard') continue;
    const hand = `${r.g}:${r.h}`;
    if (hand !== prevHand) {
      if (seenHands.has(hand)) totals.outOfOrder++;
      seenHands.add(hand); prevHand = hand;
    }
    const d = delta.get(hand);
    if (!d) { totals.skippedNoHand++; continue; }
    const chips = d[r.p]!;

    const evals = evaluateTargets({ concealed: r.me.h, melds: decMelds(r.me.m) }, {
      seat: (r.p - r.dl + 4) % 4, prevailingWind: r.w, bonus: r.me.b, playerTurns: r.t,
      wallRemaining: r.rem, minimumFan: 2, selfDrawMinimumFan: 1,
    });
    if (!evals.length) continue;
    const row = turnRow(r.t);
    totals.used++;

    // `evaluateTargets` returns the list sorted by chips, so the head is the plan the coach is
    // actually playing. An unarmed plan is a hand with no route to that target at all, priced as a
    // constant rather than off a table, so it carries no information about the table and is skipped.
    //
    // A plan carrying a `note` was priced down a side branch - Chicken that still needs a pong,
    // All-Chow that can only be self-drawn - where the code scales the table figure by a constant
    // before using it. Those cells would be fitting the constant as much as the table, so only the
    // plain branch feeds the fit. `pred` carries what the CURRENT tables said, so the report can put
    // the study's number and ours side by side rather than only showing the new one.
    const top = evals[0]!;
    if (top.armed && !top.note) add('pursued', top.id, String(top.value), row, chips, top.chips, hand);
    for (const e of evals) if (e.armed && !e.note) add('all', e.id, String(e.value), row, chips, e.chips, hand);
  }
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const totals = { lines: 0, used: 0, skippedNoHand: 0, outOfOrder: 0 };
  for (let w = 0; w < 8; w++) {
    await readShard(w, totals);
    process.stdout.write(`  shard ${w} done - ${totals.lines.toLocaleString()} lines, ${totals.used.toLocaleString()} discards used\n`);
  }
  const out: Record<string, { sum: number; n: number; hands: number; pred: number }> = {};
  for (const [k, c] of cells) out[k] = { sum: Number(c.sum.toFixed(3)), n: c.n, hands: c.hands, pred: Number(c.pred.toFixed(3)) };
  writeFileSync(outFile, JSON.stringify({ runDir, totals, cells: out }, null, 0));
  console.log(`\n${totals.lines.toLocaleString()} decision records, ${totals.used.toLocaleString()} discards fitted, ${cells.size} cells`);
  if (totals.skippedNoHand) console.log(`  ${totals.skippedNoHand} decisions had no matching hand record and were dropped`);
  console.log(`  hand grouping violations: ${totals.outOfOrder} (must be 0, or the hand counts are inflated)`);
  console.log(`  ${outFile} written in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
main();
