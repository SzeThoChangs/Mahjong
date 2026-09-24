/**
 * Does following the judge on win decisions win money? The direct test, not a proxy.
 *
 *   tsx src/judgewin.ts 2000 --field coach --run ../data/gen/run-min1-nowild --from 7730001
 *
 * On 2026-09-13 a Coach that declines wins under a fixed Tai bar lost money, and on that evidence
 * the Play review stopped calling a taken win a mistake (D-027). That bar was a stand-in for the
 * judge, not the judge. The packs still carry the judge's own verdicts - over two thousand
 * questions whose measured best declines an offered win - and before anything is done to them the
 * question has to be asked of the judge itself.
 *
 * Arm A is the Coach, which takes every win. Arm B is the same Coach, except that whenever it may
 * win and may also decline, it stops, runs the judge exactly as the app does - `rejudge` on the real
 * position, 256 play-outs, simple bots, the hidden tiles re-dealt - and does whatever the judge says
 * is best. Same deals, same seat, same opponents, all four chairs. If arm B wins, the judge is right
 * about wins and D-027 was wrong. If it loses, the judge is wrong, and the verdicts in the packs are
 * wrong with it.
 */
import { GameState, shuffleWall, makeRng, tableConfigOf, type Bot, type LegalAction } from 'sg-mahjong-engine';
import { AltReadsCoachBot, CoachBot, READS_NOWILD, rejudge, encAction } from 'sg-mahjong-solver';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS } from './bots.js';
import { fnv1a } from './records.js';
import { rulesForDir } from './tablerules.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const n = Number(process.argv[2] ?? 2000);
const fieldKind = arg('field', 'coach');
const run = arg('run', '../data/gen/run-min1-nowild');
const from = Number(arg('from', '7730001'));
const rollouts = Number(arg('rollouts', '256'));
const seatsArg = arg('seats', '0,1,2,3').split(',').map(Number);
/**
 * `--judge coach` plays the judge's play-outs with the Coach in all four chairs (reading danger at
 * the table's Joker count) instead of simple bots: the judge for a table of strong players.
 * `--decisions claims` follows the judge at every claim decision with a real choice (win, Kong, Pong,
 * Chow or pass) and at every win on a self-draw, not only at wins. `--decisions calls` is the same
 * but takes every win regardless, which separates the Pong and Chow decisions from the win defect
 * those runs would otherwise carry.
 */
const judgeKind = arg('judge', 'shanten');
const decisions = arg('decisions', 'wins');

const rules = rulesForDir(run);
const cfg = tableConfigOf(rules);
const coach = (): Bot => (rules.jokers.count === 0 ? new AltReadsCoachBot(READS_NOWILD) : new CoachBot());

function field(shuffle: number, tested: number): Bot[] {
  return [0, 1, 2, 3].map((s) => {
    if (s === tested || fieldKind === 'coach') return coach();
    const pick = fnv1a(`field:${shuffle}:${s}`) % BOT_TYPES.length;
    return makeBot(BOT_TYPES[pick]!, makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
  });
}

let offers = 0, declined = 0, judgeMs = 0;
function play(shuffle: number, g: number, seat: number, judged: boolean): number {
  const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
  const game = GameState.deal(cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
  const bots = field(shuffle, seat);
  let guard = 0, k = 0;
  while (!game.finished && guard++ < 4000) {
    const p = game.pending();
    if (!p) { game.advance(); continue; }
    const hasWin = p.legal.some((l) => l.a === 'win');
    const ask = decisions === 'claims' ? (p.kind === 'claim' || hasWin)
      : decisions === 'calls' ? (p.kind === 'claim' && !hasWin)
      : hasWin;
    if (judged && p.seat === seat && ask && p.legal.length > 1) {
      const t0 = Date.now();
      const policy = judgeKind === 'coach' ? () => coach() : 'shanten' as const;
      const out = rejudge(game.snapshot(), rules, seat, p.legal, { rollouts, seed: 424242, key: `${shuffle}:${seat}:${k++}`, policy });
      judgeMs += Date.now() - t0;
      const best = [...out].sort((a, b) => b.ev - a.ev)[0]!.a;
      offers++; if (hasWin ? best !== 'win' : best === 'pass') declined++;
      const act: LegalAction = p.legal.find((l) => encAction(l) === best)!;
      game.apply(act);
      continue;
    }
    game.step(bots);
  }
  if (!game.finished) throw new Error(`deal ${shuffle} did not finish`);
  return game.result!.chipsDelta[seat]!;
}

const diffs: number[] = [];
const t0 = Date.now();
for (const seat of seatsArg) {
  for (let g = 0; g < n; g++) {
    const shuffle = from + g;
    const a = play(shuffle, g, seat, false);
    const b = play(shuffle, g, seat, true);
    diffs.push(b - a);
  }
}
const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
const sd = Math.sqrt(diffs.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, diffs.length - 1));
const se = sd / Math.sqrt(diffs.length);
console.log(`following the ${judgeKind} judge on ${decisions}, against the Coach; ${rules.jokers.count} Jokers, min ${rules.minimum_tai}; field ${fieldKind}; deals ${from}..${from + n - 1}; seats ${seatsArg.join(',')}`);
console.log(`${diffs.length} paired deals. Win offers judged ${offers}, judge said decline ${declined} (${offers ? Math.round((100 * declined) / offers) : 0}%). Judge time ${(judgeMs / 1000).toFixed(0)}s of ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(`judge minus Coach: ${mean >= 0 ? '+' : ''}${mean.toFixed(3)} chips a game +/- ${se.toFixed(3)} (t = ${(mean / se).toFixed(1)})`);
