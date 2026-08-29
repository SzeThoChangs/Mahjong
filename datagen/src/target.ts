/**
 * Which outcome statistic can the rollouts actually resolve?
 *
 *   tsx src/target.ts --dir ../data/gen/run-money3 --decisions 120 --rollouts 64
 *
 * The noise floor is set by the variance of what we measure, not only by how many play-outs we buy.
 * Chips per hand has an outcome SD of 9.8 - dominated by whether the hand is won and at what tai,
 * not by the discard under test. A statistic with less spread might separate the same two actions
 * on the same play-outs. This measures whether that is true, before anyone spends 13 hours on it.
 *
 * Method: run each action's play-outs ONCE, and score every play-out under several targets. Every
 * target therefore sees identical games - a perfectly paired comparison. For each decision we fix
 * the pair that matters (the best and runner-up BY CHIPS, the quantity we actually care about) and
 * ask each target how confidently it separates that pair:
 *
 *   t = |mean paired difference| / SE of that difference
 *
 * t is unit-free, so targets in chips, probabilities and signs are directly comparable. Higher t
 * means more resolving power on the same compute. `agree` reports how often a target's own best
 * action is the chips-best: a target that resolves confidently but ranks differently is measuring
 * something else, and its t is not a win.
 */
import { GameState, tableConfigOf, kindOf, type LegalAction, type RulesConfig, type Snapshot } from 'sg-mahjong-engine';
import { positionAt, determinize } from './position.js';
import { makeRng } from 'sg-mahjong-engine';
import { rolloutBots, decisionsOfHand, type EvalArgs } from './evaluate.js';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { encAction, fnv1a, type DecisionRecord, type HandRecord } from './records.js';

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? def) : def; }
const dir = arg('dir', '../data/gen/run-money3')!;
const want = Number(arg('decisions', '120'));
const rollouts = Number(arg('rollouts', '64'));
const seed = Number(arg('seed', '31'));
const policy = arg('policy', 'shanten') as EvalArgs['policy'];

/** One play-out, scored every way we are considering. `chips` is the incumbent. */
interface Outcome { chips: number; win: number; net: number; w8: number; w4: number; sign: number }
const TARGETS: { name: string; of: (o: Outcome) => number; note: string }[] = [
  { name: 'chips', of: (o) => o.chips, note: 'incumbent: money delta for the seat' },
  { name: 'win', of: (o) => o.win, note: 'did this seat win the hand (0/1)' },
  { name: 'win-dealin', of: (o) => o.net, note: 'won minus dealt-in (-1/0/1)' },
  { name: 'winsor8', of: (o) => o.w8, note: 'chips clamped to +/-8' },
  { name: 'winsor4', of: (o) => o.w4, note: 'chips clamped to +/-4' },
  { name: 'sign', of: (o) => o.sign, note: 'sign of the chip delta' },
];

const rules: RulesConfig = rulesForDir(dir);
const cfg = tableConfigOf(rules);

// ---- pick decisions, deterministically, spread across hands ----
const hands = loadHands(dir);
const rng = makeRng(seed);
const picked: { hand: HandRecord; dec: DecisionRecord }[] = [];
const usedHands = new Set<string>();
while (picked.length < want && usedHands.size < hands.length) {
  const hand = hands[Math.floor(rng() * hands.length)]!;
  const hk = `${hand.g}:${hand.h}`;
  if (usedHands.has(hk)) continue;
  usedHands.add(hk);
  const all = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS);
  if (!all) continue;
  const pool = all.filter((d) => d.legal.length > 1);
  if (pool.length) picked.push({ hand, dec: pool[Math.floor(rng() * pool.length)]! });
}

// ---- run the play-outs once, score them every way ----
const perTarget = new Map<string, { t: number[]; agree: number; n: number }>();
for (const t of TARGETS) perTarget.set(t.name, { t: [], agree: 0, n: 0 });
const byKind = new Map<string, number>();

let done = 0, used = 0;
for (const { hand, dec } of picked) {
  const pos = positionAt(hand, dec.d, rules, DEFAULT_RANDOMNESS);
  if (!pos) continue;
  const g = pos.g;
  const pending = g.pending()!;
  const seat = pending.seat;
  const base = g.snapshot();

  const legal: LegalAction[] = []; const seenKinds = new Set<string>();
  for (const l of pending.legal) { const k = encAction(l); if (seenKinds.has(k)) continue; seenKinds.add(k); legal.push(l); }
  if (legal.length < 2) continue;

  // one determinized deal per rollout index, shared by every action (common random numbers)
  const hiddenCache = new Map<number, Snapshot>();
  const hidden = (i: number): Snapshot => {
    let h = hiddenCache.get(i);
    if (!h) { h = determinize(GameState.fromSnapshot(base, cfg, { rules }), seat, makeRng(fnv1a(`${dec.g}:${dec.h}:${dec.d}:${i}:${seed}`))); hiddenCache.set(i, h); }
    return h;
  };

  // outcomes[actionIndex][rolloutIndex]
  const outcomes: Outcome[][] = legal.map(() => []);
  for (let ai = 0; ai < legal.length; ai++) {
    for (let i = 0; i < rollouts; i++) {
      const rSeed = fnv1a(`${dec.g}:${dec.h}:${dec.d}:${i}:${seed}`);
      const h = GameState.fromSnapshot(hidden(i), cfg, { rules });
      h.apply(legal[ai]!);
      const res = h.run(rolloutBots(policy, rSeed ^ 0x5bd1e995, DEFAULT_RANDOMNESS, true));
      const chips = res.chipsDelta[seat]!;
      const win = res.winner === seat ? 1 : 0;
      const dealt = res.discarder === seat && res.winner !== null && res.winner !== seat ? 1 : 0;
      outcomes[ai]!.push({ chips, win, net: win - dealt, w8: Math.max(-8, Math.min(8, chips)), w4: Math.max(-4, Math.min(4, chips)), sign: Math.sign(chips) });
    }
  }

  // the pair that matters: best and runner-up by chips
  const meanOf = (ai: number, f: (o: Outcome) => number) => outcomes[ai]!.reduce((s, o) => s + f(o), 0) / rollouts;
  const order = legal.map((_, ai) => ai).sort((x, y) => meanOf(y, (o) => o.chips) - meanOf(x, (o) => o.chips));
  const [bi, si] = [order[0]!, order[1]!];
  byKind.set(dec.k, (byKind.get(dec.k) ?? 0) + 1);
  used++;

  for (const target of TARGETS) {
    // paired difference over the shared rollout indices
    let m = 0, m2 = 0;
    for (let i = 0; i < rollouts; i++) { const d = target.of(outcomes[bi]![i]!) - target.of(outcomes[si]![i]!); m += d; m2 += d * d; }
    const gap = m / rollouts;
    const varD = Math.max(0, m2 / rollouts - gap * gap) * rollouts / (rollouts - 1);
    const se = Math.sqrt(varD / rollouts);
    const rec = perTarget.get(target.name)!;
    rec.n++;
    rec.t.push(se > 1e-12 ? Math.abs(gap) / se : 0);
    // does this target rank the same action first?
    const ownBest = legal.map((_, ai) => ai).sort((x, y) => meanOf(y, target.of) - meanOf(x, target.of))[0]!;
    if (ownBest === bi) rec.agree++;
  }
  if (++done % 10 === 0) process.stdout.write(`\r${done}/${picked.length}`);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const share = (xs: number[], f: (x: number) => boolean) => xs.filter(f).length / Math.max(1, xs.length);
console.log(`\r${' '.repeat(30)}\r`);
console.log(`${used} decisions (${[...byKind.entries()].map(([k, n]) => `${k} ${n}`).join(', ')}), ${rollouts} play-outs per action, policy ${policy}\n`);
console.log(`${'target'.padEnd(12)} ${'mean t'.padStart(7)} ${'t>1'.padStart(6)} ${'t>2'.padStart(6)} ${'agree'.padStart(6)}   note`);
const baseline = perTarget.get('chips')!;
for (const t of TARGETS) {
  const r = perTarget.get(t.name)!;
  console.log(`${t.name.padEnd(12)} ${mean(r.t).toFixed(2).padStart(7)} ${(100 * share(r.t, (x) => x > 1)).toFixed(0).padStart(5)}% ${(100 * share(r.t, (x) => x > 2)).toFixed(0).padStart(5)}% ${(100 * r.agree / Math.max(1, r.n)).toFixed(0).padStart(5)}%   ${t.note}`);
}
console.log(`\nA target only helps if it raises t AND keeps agree high - otherwise it resolves a different question confidently.`);
const best = TARGETS.map((t) => ({ t, r: perTarget.get(t.name)! })).filter((x) => x.t.name !== 'chips')
  .sort((a, b) => mean(b.r.t) - mean(a.r.t))[0];
if (best) {
  const lift = mean(best.r.t) / Math.max(1e-9, mean(baseline.t));
  console.log(`best non-incumbent: ${best.t.name} at t=${mean(best.r.t).toFixed(2)} vs chips ${mean(baseline.t).toFixed(2)} (${lift.toFixed(2)}x), agreeing with the chips ranking ${(100 * best.r.agree / Math.max(1, best.r.n)).toFixed(0)}% of the time`);
  console.log(`a ${lift.toFixed(2)}x in t is worth the same as ${(lift ** 2).toFixed(1)}x the play-outs`);
}
