/**
 * Should the Coach call Pong more often or less often, at a no-Joker table? Money decides.
 *
 *   tsx src/pongmoney.ts 2000 --pong 1.5 --field coach --from 7710001
 *
 * The pack says Pong on positions where a judge with the Coach in the play-outs says pass, and a
 * count of changed answers cannot say which is right (FINDINGS, "Smarter play-out opponents leave
 * throws alone and change one claim in eight"). This asks the project's own question of it: paired
 * deals, the same seat, one thing different.
 *
 * The one thing is the Pong threshold. The Coach calls a claim when it improves the hand by more
 * than `OPEN_COST`, 0.4 chips, a number nobody has ever measured. Arm A is the Coach as shipped at a
 * no-Joker table (no-Joker danger reads, threshold 0.4). Arm B is the same Coach with a different
 * threshold for Pongs only; Chows keep 0.4. A higher threshold passes more Pongs, which is what the
 * Coach-played judge was saying; a lower one calls more, which is what the pack was saying.
 *
 * `--field coach` puts the shipped no-Joker Coach in the other three chairs; `--field pool` puts the
 * recorded personalities there, drawn per deal. Both arms see the same three opponents with the same
 * random streams. The table is the recorded 0-Joker min-1 run's own rules.
 */
import { playGame, shuffleWall, makeRng, kindOf, tableConfigOf, type Bot, type PlayerView, type ClaimOption } from 'sg-mahjong-engine';
import { AltReadsCoachBot, READS_NOWILD, claimAdvice, meldsOf, type ClaimCandidate } from 'sg-mahjong-solver';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS } from './bots.js';
import { fnv1a } from './records.js';
import { rulesForDir } from './tablerules.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const n = Number(process.argv[2] ?? 2000);
const pongCost = Number(arg('pong', '1.5'));
const fieldKind = arg('field', 'coach');
const from = Number(arg('from', '7710001'));

const rules = rulesForDir('../data/gen/run-min1-nowild');
const cfg = tableConfigOf(rules);
if (rules.jokers.count !== 0) throw new Error(`expected a no-Joker table, got ${rules.jokers.count} Jokers`);

/** The shipped no-Joker Coach, except that a Pong must clear `pongCost` rather than 0.4. */
class PongThresholdBot extends AltReadsCoachBot {
  constructor(private readonly cost: number) { super(READS_NOWILD); }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kong = options.find((o) => o.kind === 'kong3'); if (kong) return kong;
    const usable = options.filter((o) => o.kind === 'pong' || o.kind === 'chow');
    if (!usable.length) return null;
    const cands: ClaimCandidate[] = usable.map((o) => ({ kind: o.kind as 'pong' | 'chow', used: (o.tiles ?? []).map(kindOf) }));
    const adv = claimAdvice([{ kind: 'pass', used: [] }, ...cands], v.hand.map(kindOf), meldsOf(v), kindOf(v.lastDiscard!.tile), this.ctx(v));
    // the best call by gain, with Pongs held to their own bar and Chows to the shipped one
    const call = adv.options.find((o) => o.candidate.kind !== 'pass' && o.gain > (o.candidate.kind === 'pong' ? this.cost : 0.4));
    if (!call) return null;
    const i = cands.findIndex((c) => c.kind === call.candidate.kind && c.used.join() === call.candidate.used.join());
    return usable[i] ?? null;
  }
}

function field(shuffle: number, tested: number, make: () => Bot): Bot[] {
  return [0, 1, 2, 3].map((s) => {
    if (s === tested) return make();
    if (fieldKind === 'coach') return new AltReadsCoachBot(READS_NOWILD);
    const pick = fnv1a(`field:${shuffle}:${s}`) % BOT_TYPES.length;
    return makeBot(BOT_TYPES[pick]!, makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
  });
}

let pongsA = 0, pongsB = 0;
class Counting extends PongThresholdBot {
  constructor(cost: number, private readonly tally: (called: boolean) => void) { super(cost); }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const r = super.chooseClaim(v, options);
    if (options.some((o) => o.kind === 'pong')) this.tally(r?.kind === 'pong');
    return r;
  }
}

/** Arm A is the shipped bot itself, not this file's copy of its rule, so a mistake in the copy shows
 *  up as a non-zero result at `--pong 0.4` instead of being paired away. */
class CountingShipped extends AltReadsCoachBot {
  constructor(private readonly tally: (called: boolean) => void) { super(READS_NOWILD); }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const r = super.chooseClaim(v, options);
    if (options.some((o) => o.kind === 'pong')) this.tally(r?.kind === 'pong');
    return r;
  }
}

const diffs: number[] = []; let chipsA = 0, chipsB = 0;
for (let seat = 0; seat < 4; seat++) {
  for (let g = 0; g < n; g++) {
    const shuffle = from + g;
    const play = (make: () => Bot) => {
      const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
      return playGame(field(shuffle, seat, make), cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules }).chipsDelta[seat]!;
    };
    const a = play(() => new CountingShipped((c) => { if (c) pongsA++; }));
    const b = play(() => new Counting(pongCost, (c) => { if (c) pongsB++; }));
    chipsA += a; chipsB += b; diffs.push(b - a);
  }
}
const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
const sd = Math.sqrt(diffs.reduce((x, y) => x + (y - mean) ** 2, 0) / (diffs.length - 1));
const se = sd / Math.sqrt(diffs.length);
console.log(`Pong threshold ${pongCost} against the shipped 0.4, at a no-Joker min-${rules.minimum_tai} table, field ${fieldKind}, deals ${from}..${from + n - 1}, all four chairs`);
console.log(`${diffs.length} paired deals. Pongs called: shipped ${pongsA}, tested ${pongsB}`);
console.log(`tested minus shipped: ${mean >= 0 ? '+' : ''}${mean.toFixed(3)} chips a game +/- ${se.toFixed(3)} (t = ${(mean / se).toFixed(1)})`);
