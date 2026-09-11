/**
 * Does a position rebuilt from a pack question judge the same as the recorded one?
 *
 *   tsx src/rejudgecheck.ts --dir ../data/gen/run-min1 --pack ../web/public/quiz/min1 --n 30 --rollouts 256 [--wall-order]
 *
 * The phone's Challenge button has no run to replay: it rebuilds the position from the question
 * alone (`snapshotFromQuestion` in the solver) and re-judges that. This takes questions from a
 * pack and judges each twice on the same seed - once from the recorded hand replayed to the
 * decision, once from the rebuilt question - and compares them three ways.
 *
 * First the two states are diffed field by field, in tile kinds rather than instances: hands,
 * melds, bonus, floor, log, the no-throw-back memory, the wall's size, what is pending, who is
 * liable, what has been paid. A rebuild that differs anywhere is named here before a single
 * play-out runs.
 *
 * Then both are judged with `canonical` re-deals, which draw the unseen tiles in kind order so the
 * two positions get the same deals however their tile instances are numbered. Two correct states
 * then produce IDENTICAL play-outs, outcome for outcome, up to the one thing a question does not
 * record: the chips already moved in the hand, a constant per question that is subtracted. This
 * is the strong check - a single play-out that differs means the states differ.
 *
 * With `--wall-order` the deals follow the recorded wall instead and the two differ by play-out
 * noise, so the comparison is the statistical one: the best must agree on at least nine in ten and
 * the paired gap between the recorded best and its runner-up must differ by less than two combined
 * standard errors. That bar is generous where the exact one is not, and it is kept because it is
 * what the Challenge button's own play-outs will do - it does not use canonical deals, having
 * nothing to be canonical against. A failure under either is a wrong rebuild; the fix is the
 * rebuild, never the bar.
 *
 * The EV difference is printed twice: after removing the recorded chips offset, and raw.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRng, GameState, tableConfigOf, kindOf, type Snapshot } from 'sg-mahjong-engine';
import { rejudge, pairedGap, encAction, snapshotFromQuestion, pendingOf, type PackQuestion, type RejudgedAction } from 'sg-mahjong-solver';
import { eachJsonlGz } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand } from './evaluate.js';
import { positionAt } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-min1')!;
const packDir = arg('pack', '../web/public/quiz/min1')!;
const want = Number(arg('n', '30'));
const rollouts = Number(arg('rollouts', '256'));
const seed = Number(arg('seed', '7'));
const canonical = !process.argv.includes('--wall-order');

type Q = PackQuestion & { id: string; actions: { a: string }[] };
const rules = rulesForDir(dir);

// ---- draw the questions: shards in order, a deterministic shuffle, every kind represented ----
const ix = JSON.parse(readFileSync(join(packDir, 'index.json'), 'utf8')) as { shards: { file: string }[] };
const pool: Q[] = [];
for (const s of ix.shards) {
  pool.push(...(JSON.parse(readFileSync(join(packDir, s.file), 'utf8')) as { questions: Q[] }).questions);
  if (pool.length >= want * 4) break;
}
// every question in the shards read must at least rebuild and offer what the pack judged; this
// costs nothing and covers several times more questions than the play-outs can
let broken = 0;
for (const q of pool) {
  try {
    const p = pendingOf(snapshotFromQuestion(q, rules), rules);
    const legal = [...new Set(p.legal.map(encAction))].sort().join(' '), listed = q.actions.map((x) => x.a).sort().join(' ');
    if (p.kind !== q.k || p.seat !== q.seat || legal !== listed) { broken++; console.log(`${q.id} ${q.k}: rebuilt offers [${legal}], pack judged [${listed}]`); }
  } catch (e) { broken++; console.log(`${q.id} ${q.k}: ${(e as Error).message}`); }
}
console.log(`${pool.length} questions rebuilt, ${broken} could not be, or offer other actions\n`);
const rng = makeRng(seed);
for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
const chosen = pool.slice(0, want);

// ---- the hands they came from, streamed so a 150,000-hand run never sits in memory ----
const wantedHands = new Set(chosen.map((q) => q.id.split(':').slice(0, 2).join(':')));
const hands = new Map<string, HandRecord>();
for (const f of readdirSync(dir).filter((x) => x.startsWith('hands-') && x.endsWith('.jsonl.gz')))
  eachJsonlGz<HandRecord>(join(dir, f), (h) => { const k = `${h.g}:${h.h}`; if (wantedHands.has(k)) hands.set(k, h); });

const byA = (xs: RejudgedAction[]) => new Map(xs.map((x) => [x.a, x]));
const sortedKinds = (ts: number[]) => ts.map(kindOf).sort((a, b) => a - b).join(',');
/** Every way two states can differ that a play-out could notice, in kinds; `seat` is the one acting. */
function stateDiff(a: Snapshot, b: Snapshot, seat: number): string[] {
  const out: string[] = [];
  const same = (name: string, x: unknown, y: unknown) => { const xs = JSON.stringify(x), ys = JSON.stringify(y); if (xs !== ys) out.push(`${name}: recorded ${xs} rebuilt ${ys}`); };
  for (let s = 0; s < 4; s++) {
    const p = a.players[s]!, q = b.players[s]!;
    if (s === seat) same(`hand${s}`, p.hand.map(kindOf), q.hand.map(kindOf)); else same(`hand${s} size`, p.hand.length, q.hand.length);
    same(`melds${s}`, p.melds.map((m) => [m.type, m.concealed, m.tiles]), q.melds.map((m) => [m.type, m.concealed, m.tiles]));
    same(`bonus${s}`, sortedKinds(p.bonus), sortedKinds(q.bonus));
    same(`floor${s}`, p.discards.map(kindOf), q.discards.map(kindOf));
    same(`lastDiscardKind${s}`, p.lastDiscardKind, q.lastDiscardKind);
    same(`seen${s}`, [...p.seenSinceLastDiscard].sort((x, y) => x - y), [...q.seenSinceLastDiscard].sort((x, y) => x - y));
    same(`paid${s}`, [...a.paidEvents[s]!].sort(), [...b.paidEvents[s]!].sort());
  }
  // an exposed kong that was claimed some time ago may have been fed (kong3) or been a pong later
  // completed from hand (kong1): the visible state cannot tell, nothing in a play-out reads the
  // label, and the rebuild says pong. Compared as "kong" so a real difference still shows.
  const kongish = (k: string | null) => (k === 'kong3' ? 'pong' : k);
  same('log', a.discardLog.map((e) => [e.seat, kindOf(e.tile), e.claimedBy, kongish(e.claimKind)]), b.discardLog.map((e) => [e.seat, kindOf(e.tile), e.claimedBy, kongish(e.claimKind)]));
  same('wall live', a.wall.back - a.wall.front + 1, b.wall.back - b.wall.front + 1);
  same('wall unplayable', a.wall.unplayable, b.wall.unplayable);
  same('wall size', a.wall.order.length, b.wall.order.length);
  for (const k of ['dealer', 'prevailingWind', 'turn', 'phase', 'playerTurns'] as const) same(k, a[k], b[k]);
  // in a claim phase the recorded state still carries the DISCARDER's draw, which nothing reads
  // again: a claim resolves into either a fresh draw or a replacement, both of which overwrite it
  // `replaced` decides one tai on a self-drawn win, so it matters only where a win is on offer: a
  // self decision. On a discard decision it is carried and never read, and a question cannot
  // recover it there, so it is compared only in the self phase.
  if (a.phase !== 'claim') same('drawnInfo', a.drawnInfo && { kind: kindOf(a.drawnInfo.tile), replaced: a.phase === 'self' ? a.drawnInfo.replaced : null, lastTile: a.drawnInfo.lastTile }, b.drawnInfo && { kind: kindOf(b.drawnInfo.tile), replaced: b.phase === 'self' ? b.drawnInfo.replaced : null, lastTile: b.drawnInfo.lastTile });
  same('pendingDiscard', a.pendingDiscard && { kind: kindOf(a.pendingDiscard.tile), from: a.pendingDiscard.from, last: a.pendingDiscard.lastTileDiscard, eligible: a.pendingDiscard.eligible }, b.pendingDiscard && { kind: kindOf(b.pendingDiscard.tile), from: b.pendingDiscard.from, last: b.pendingDiscard.lastTileDiscard, eligible: b.pendingDiscard.eligible });
  same('pendingRob', a.pendingRob && kindOf(a.pendingRob.tile), b.pendingRob && kindOf(b.pendingRob.tile));
  same('liable', a.liable, b.liable);
  same('kongFedBy', a.kongFedBy, b.kongFedBy);
  // the other seats' entries come from their concealed hands, which the rebuild fills with
  // placeholders and every play-out re-deals; only the acting seat's options are a fact
  const mine = (sn: Snapshot) => { const c = sn.claimQueue.find((x) => x.seat === seat); return c && [c.seat, c.options.map((o) => o.kind + ':' + (o.tiles ?? []).map(kindOf).join('.'))]; };
  same('claimQueue', mine(a), mine(b));
  return out;
}
let n = 0, bestAgree = 0, orderAgree = 0, maxGapZ = 0, gapFails = 0, sumAbsEv = 0, sumAbsEvRaw = 0, evCount = 0, stateSame = 0, exact = 0;
const t0 = Date.now();
for (const q of chosen) {
  const [g, h, d] = q.id.split(':').map(Number);
  const hr = hands.get(`${g}:${h}`);
  if (!hr) { console.log(`${q.id}: hand not in the run`); continue; }
  const decs = decisionsOfHand(hr, rules, DEFAULT_RANDOMNESS);
  const rec = decs?.find((x) => x.d === d);
  const pos = positionAt(hr, d!, rules, DEFAULT_RANDOMNESS);
  if (!decs || !rec || !pos) { console.log(`${q.id}: does not replay`); continue; }
  const pending = pos.g.pending()!;
  const seat = pending.seat;
  const chips = pos.g.players[seat]!.chips;

  // (a) the recorded position; (b) the question alone
  const snapA = pos.g.snapshot();
  const snap = snapshotFromQuestion(q, rules);
  const p = pendingOf(snap, rules);
  // the recorded claim queue may already have been shifted past earlier seats; the re-deal rebuilds
  // it with the acting seat first in both, so compare it that way
  let cmpA = snapA;
  if (snapA.phase === 'claim') { const ga = GameState.fromSnapshot(snapA, tableConfigOf(rules), { rules }); ga.rebuildClaims(seat); cmpA = ga.snapshot(); }
  const diffs = stateDiff(cmpA, snap, seat);
  if (diffs.length) for (const d of diffs) console.log(`${q.id}: STATE DIFFERS  ${d}`); else stateSame++;
  const a = rejudge(snapA, rules, seat, pending.legal, { rollouts, seed, key: q.id, canonical });
  const legalA = [...new Set(pending.legal.map(encAction))].sort(), legalB = [...new Set(p.legal.map(encAction))].sort(), legalQ = q.actions.map((x) => x.a).sort();
  if (p.kind !== pending.kind || p.seat !== seat || legalA.join(' ') !== legalB.join(' ') || legalB.join(' ') !== legalQ.join(' ')) {
    console.log(`${q.id}: LEGAL ACTIONS DIFFER  recorded [${legalA.join(' ')}]  rebuilt [${legalB.join(' ')}]  pack [${legalQ.join(' ')}]`);
    gapFails++; n++; continue;
  }
  const b = rejudge(snap, rules, seat, p.legal, { rollouts, seed, key: q.id, canonical });

  const sortedA = [...a].sort((x, y) => y.ev - x.ev), sortedB = [...b].sort((x, y) => y.ev - x.ev);
  const mb = byA(b);
  const sameBest = sortedA[0]!.a === sortedB[0]!.a;
  const sameOrder = sortedA.map((x) => x.a).join(' ') === sortedB.map((x) => x.a).join(' ');
  // outcome for outcome, after the chips offset: identical states give identical play-outs under canonical deals
  let differing = 0;
  for (const x of a) { const y = mb.get(x.a)!; for (let i = 0; i < x.outcomes.length; i++) if (x.outcomes[i] !== undefined && Math.abs((x.outcomes[i]! - chips) - y.outcomes[i]!) > 1e-9) differing++; }
  if (!differing) exact++;
  let line = `${q.id.padEnd(12)} ${q.k.padEnd(7)} best ${sortedA[0]!.a.padEnd(9)} ${sameBest ? 'same' : `vs ${sortedB[0]!.a}`}  ${canonical ? (differing ? `${differing} play-outs differ` : 'play-outs identical') : ''}`;
  if (sortedA.length > 1) {
    const ga = pairedGap(sortedA[0]!, sortedA[1]!);
    const gb = pairedGap(mb.get(sortedA[0]!.a)!, mb.get(sortedA[1]!.a)!);
    const z = Math.abs(ga.gap - gb.gap) / Math.max(1e-9, Math.sqrt(ga.se * ga.se + gb.se * gb.se));
    maxGapZ = Math.max(maxGapZ, z);
    if (!(z < 2)) gapFails++;
    line += `  gap ${ga.gap.toFixed(2)}±${ga.se.toFixed(2)} vs ${gb.gap.toFixed(2)}±${gb.se.toFixed(2)}  (${z.toFixed(2)} SE)`;
  }
  for (const x of a) { const y = mb.get(x.a)!; sumAbsEv += Math.abs((x.ev - chips) - y.ev); sumAbsEvRaw += Math.abs(x.ev - y.ev); evCount++; }
  n++; if (sameBest) bestAgree++; if (sameOrder) orderAgree++;
  console.log(line);
}
const secs = (Date.now() - t0) / 1000;
console.log(`\n${n} questions at ${rollouts} play-outs, ${secs.toFixed(0)}s, ${canonical ? 'canonical deals' : 'wall-order deals'}`);
console.log(`state identical in kinds on ${stateSame}/${n}${canonical ? `; play-outs identical outcome for outcome on ${exact}/${n}` : ''}`);
console.log(`best agrees on ${bestAgree}/${n}; whole ordering agrees on ${orderAgree}/${n}`);
console.log(`gap best-vs-runner-up: max difference ${maxGapZ.toFixed(2)} combined SE; ${gapFails} outside 2 SE`);
console.log(`mean |EV difference| per action: ${(sumAbsEv / Math.max(1, evCount)).toFixed(3)} after removing the recorded chips offset (${(sumAbsEvRaw / Math.max(1, evCount)).toFixed(3)} raw)`);
const ok = broken === 0 && bestAgree >= Math.ceil(0.9 * n) && gapFails === 0 && n === chosen.length && stateSame === n && (!canonical || exact === n);
console.log(ok ? 'REBUILD HOLDS' : 'REBUILD FAILS');
process.exit(ok ? 0 : 1);
