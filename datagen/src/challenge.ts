/**
 * Re-judge one recorded decision with more play-outs (the quiz's Challenge button).
 *   tsx src/challenge.ts --dir ../data/gen/run100k-table --id 976:13:4 --hand 17,9,... --rollouts 512
 * Prints a JSON result to stdout.
 */
import { kindOf } from 'sg-mahjong-engine';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, evaluateDecision, type EvalArgs } from './evaluate.js';
import { positionAt } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';

function arg(name: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
const dir = arg('dir')!;
const [g, h, d] = arg('id')!.split(':').map(Number);
const expected = (arg('hand') ?? '').split(',').filter(Boolean).map(Number);
const rollouts = Math.min(2048, Number(arg('rollouts') ?? 512));

function main(): unknown {
  const hand = loadHands(dir).find((x) => x.g === g && x.h === h);
  if (!hand) return { error: 'hand not found' };
  const rules = rulesForDir(dir);
  const pos = positionAt(hand, d!, rules, DEFAULT_RANDOMNESS);
  if (!pos) return { error: 'position not reachable' };
  const got = pos.g.players[pos.g.pending()!.seat]!.hand.map(kindOf).sort((a, b) => a - b).join(',');
  if (got !== [...expected].sort((a, b) => a - b).join(','))
    return { stale: true, error: 'this position was recorded under an older engine version and no longer replays identically — new packs will not have this problem' };
  const rec = decisionsOfHand(hand, rules, DEFAULT_RANDOMNESS).find((x) => x.d === d);
  if (!rec) return { error: 'decision not found' };
  const args: EvalArgs = { dir, hands: 0, perHand: 0, rollouts, mode: 'sampled', policy: 'shanten', seed: 777 + rollouts, workers: 1, workerIndex: 0, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS, adaptive: true };
  const t0 = Date.now();
  const ev = evaluateDecision(pos.g, rec, args, rules);
  return { ev, ms: Date.now() - t0 };
}
console.log(JSON.stringify(main()));
