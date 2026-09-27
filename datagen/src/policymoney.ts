/**
 * Does a fitted discard policy take money off the Coach at Changs's table? The gate for the week.
 *
 *   tsx src/policymoney.ts 2000 --weights ../data/gen/coach2/policy-a.json --field coach --from 7900001
 *   tsx src/policymoney.ts 200  --self                                                  (must print 0.000)
 *
 * Paired deals, the same seat rotated through all four chairs, one thing different: arm A is the
 * shipped no-Joker Coach, arm B is the same Coach with its discards chosen by the weights in
 * `--weights`. Claims, kongs and wins go through the Coach in both arms, so the result is the
 * discard policy and nothing else. `--field coach` puts three shipped Coaches in the other chairs,
 * `--field pool` the recorded personalities drawn per deal; both arms see the same three with the
 * same random streams. Reported as B minus A in chips a game.
 *
 * `--self` plays arm B with the Coach's own discards, which must return exactly 0.000: the loop
 * plays the same game twice, and anything else is a bug in this file, not a result. The table is the
 * recorded 0-Joker min-1 run's own rules; a different table needs `--dir`.
 */
import { readFileSync } from 'node:fs';
import { playGame, shuffleWall, makeRng, kindOf, tableConfigOf, type Bot, type PlayerView, type TileInstance } from 'sg-mahjong-engine';
import { AltReadsCoachBot, READS_NOWILD, meldsOf, policyRankWith, readsFor, type PolicyWeights } from 'sg-mahjong-solver';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS } from './bots.js';
import { fnv1a } from './records.js';
import { rulesForDir } from './tablerules.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const n = Number(process.argv[2] ?? 2000);
const fieldKind = arg('field', 'coach');
const from = Number(arg('from', '7900001'));
const self = process.argv.includes('--self');
const weightsPath = arg('weights', '');
const dir = arg('dir', '../data/gen/run-min1-nowild');

const rules = rulesForDir(dir);
const cfg = tableConfigOf(rules);
const reads = rules.jokers.count === 0 ? READS_NOWILD : readsFor(rules.jokers.count);
if (!self && !weightsPath) throw new Error('give --weights <json> or --self');
const weights: PolicyWeights | null = self ? null : (JSON.parse(readFileSync(weightsPath, 'utf8')) as PolicyWeights);

/** The shipped Coach for this table, except that the discard comes from the fitted weights. */
class FittedDiscardBot extends AltReadsCoachBot {
  constructor(private readonly ws: PolicyWeights) { super(reads); }
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = policyRankWith(v.hand.map(kindOf), meldsOf(v), this.ctx(v), this.ws);
    return v.hand.find((t) => kindOf(t) === r.best) ?? super.chooseDiscard(v);
  }
}

function field(shuffle: number, tested: number, make: () => Bot): Bot[] {
  return [0, 1, 2, 3].map((s) => {
    if (s === tested) return make();
    if (fieldKind === 'coach') return new AltReadsCoachBot(reads);
    const pick = fnv1a(`field:${shuffle}:${s}`) % BOT_TYPES.length;
    return makeBot(BOT_TYPES[pick]!, makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
  });
}

const diffs: number[] = []; let chipsA = 0, chipsB = 0, winsA = 0, winsB = 0;
const started = Date.now();
for (let seat = 0; seat < 4; seat++) {
  for (let g = 0; g < n; g++) {
    const shuffle = from + g;
    const play = (make: () => Bot) => {
      const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
      const out = playGame(field(shuffle, seat, make), cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
      return { chips: out.chipsDelta[seat]!, won: out.winner === seat };
    };
    const a = play(() => new AltReadsCoachBot(reads));
    const b = play(() => (weights ? new FittedDiscardBot(weights) : new AltReadsCoachBot(reads)));
    chipsA += a.chips; chipsB += b.chips; if (a.won) winsA++; if (b.won) winsB++;
    diffs.push(b.chips - a.chips);
  }
  process.stdout.write(`\rchair ${seat + 1}/4 done, ${diffs.length} paired deals, ${((Date.now() - started) / 60000).toFixed(1)} min`);
}
const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
const sd = Math.sqrt(diffs.reduce((x, y) => x + (y - mean) ** 2, 0) / (diffs.length - 1));
const se = sd / Math.sqrt(diffs.length);
console.log(`\n${self ? 'self-check' : weightsPath} against the shipped Coach, ${rules.jokers.count}-Joker min-${rules.minimum_tai} table, field ${fieldKind}, deals ${from}..${from + n - 1}, all four chairs`);
console.log(`${diffs.length} paired deals. Hands won: Coach ${winsA}, fitted ${winsB}. Chips: Coach ${chipsA}, fitted ${chipsB}`);
console.log(`fitted minus Coach: ${mean >= 0 ? '+' : ''}${mean.toFixed(3)} chips a game +/- ${se.toFixed(3)} (t = ${(mean / se).toFixed(1)})`);
