/**
 * Is declining a small win ever worth money?
 *
 *   tsx src/declinewin.ts 4000 --tai 2
 *
 * The judge behind the Play tab's review says that taking an available win is best on only about
 * half the positions where one is offered, and the coach always takes it. Two candidate reasons for
 * the judge being wrong have been measured and neither holds: the rollout opponents do not move the
 * number, and neither does replacing the guessed hidden tiles with the real ones (FINDINGS, "The
 * whole-hand judge prices a claim the same way it prices a throw"). What is left is the question
 * the judge cannot answer about itself - whether the advice makes money.
 *
 * This is the project's own bar for that: paired deals, the same seat, the same wall, one thing
 * different. Arm A is the coach. Arm B is the coach except that it declines a win worth fewer than
 * `--tai` Tai while there are still `--wall` tiles to draw, which is the crudest possible version
 * of what the judge is saying. If declining small wins were genuinely worth something, the crude
 * version should at least not lose; six previous attempts to improve this coach all lost, so the
 * prior is that it will.
 *
 * A small loss does not prove the judge wrong - a threshold on Tai is not the judge's rule. A large
 * one says the direction is wrong, which is what the app's warning needs to know.
 */
import { playGame, shuffleWall, makeRng, kindOf, type Bot, type PlayerView, type SelfAction, type ClaimOption } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot } from 'sg-mahjong-solver';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS } from './bots.js';
import { fnv1a } from './records.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const n = Number(process.argv[2] ?? 2000);
const from = Number(arg('from', '5510001'));
const minTai = Number(arg('tai', '2'));
const wallLeft = Number(arg('wall', '20'));
const fieldKind = arg('field', 'coach');

const cfg = loadTableConfig();
const rules = loadTableRules();

/** The coach, except that a cheap win early in the hand is passed over. */
class DeclineSmallWinBot extends CoachBot {
  override chooseSelfAction(v: PlayerView, options: SelfAction[]): SelfAction | null {
    const win = options.find((o) => o.kind === 'win');
    if (win && win.score.fan < minTai && v.wallRemaining > wallLeft) {
      const other = options.find((o) => o.kind !== 'win');
      return other ?? null;                      // carry on rather than bank it
    }
    return super.chooseSelfAction(v, options);
  }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win');
    if (win && (win.score?.fan ?? 0) < minTai && v.wallRemaining > wallLeft) {
      return super.chooseClaim(v, options.filter((o) => o.kind !== 'win'));
    }
    return super.chooseClaim(v, options);
  }
}

function field(shuffle: number, tested: number, make: () => Bot): Bot[] {
  return [0, 1, 2, 3].map((s) => {
    if (s === tested) return make();
    if (fieldKind === 'coach') return new CoachBot();
    const pick = fnv1a(`field:${shuffle}:${s}`) % BOT_TYPES.length;
    return makeBot(BOT_TYPES[pick]!, makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
  });
}

interface Shape { wins: number; chips: number; declined: number; dealins: number; draws: number }
const shape: Record<'A' | 'B', Shape> = { A: { wins: 0, chips: 0, declined: 0, dealins: 0, draws: 0 }, B: { wins: 0, chips: 0, declined: 0, dealins: 0, draws: 0 } };

function arm(seat: number, which: 'A' | 'B'): number[] {
  const out: number[] = []; const sh = shape[which];
  for (let g = 0; g < n; g++) {
    const shuffle = from + g;
    const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
    const bots = field(shuffle, seat, () => (which === 'A' ? new CoachBot() : new DeclineSmallWinBot()));
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    out.push(r.chipsDelta[seat]!);
    sh.chips += r.chipsDelta[seat]!;
    if (r.winner === seat) sh.wins++;
    else if (r.winner === null) sh.draws++;
    else if (r.discarder === seat) sh.dealins++;
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

const diffs: number[] = [];
for (let seat = 0; seat < 4; seat++) {
  const a = arm(seat, 'A'), b = arm(seat, 'B');
  for (let i = 0; i < a.length; i++) diffs.push(a[i]! - b[i]!);
}
const se = sd(diffs) / Math.sqrt(diffs.length);
console.log(`declining a win under ${minTai} Tai with more than ${wallLeft} tiles left, against ${fieldKind === 'coach' ? 'three coaches' : 'the field'}`);
console.log(`${diffs.length} paired deals (${n} per seat, all four chairs)\n`);
for (const w of ['A', 'B'] as const) {
  const s = shape[w];
  console.log(`${w === 'A' ? 'coach          ' : 'declines cheap '} won ${s.wins}  dealt in ${s.dealins}  drawn ${s.draws}  chips ${(s.chips / (n * 4)).toFixed(3)} a game`);
}
console.log(`\ncoach minus decliner: ${mean(diffs) >= 0 ? '+' : ''}${mean(diffs).toFixed(3)} chips a game ± ${se.toFixed(3)} (${(mean(diffs) / se).toFixed(1)} SE)`);
console.log(mean(diffs) > 2 * se ? 'Declining loses. The coach is right to take the win.' : mean(diffs) < -2 * se ? 'Declining WINS. That is a real finding and wants a proper sweep.' : 'No difference either way at this sample size.');
