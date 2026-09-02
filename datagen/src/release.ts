/**
 * How freely does each tile come out? The one number two of the book's shape tips depend on.
 *
 *   tsx src/release.ts --coach 5000 --seed 21
 *   tsx src/release.ts --dir ../data/gen/run-money4 --hands 20000
 *
 * Two cards in `shapes.ts` are marked `needs-play`, and they are marked that way for the same
 * reason: counting cannot settle them. `bad_wait_ranking` says waiting on the last two of a
 * terminal or an honour is close to a good wait and waiting on the last two of a middle tile is
 * the worst place to be. `threes_and_sevens` says a lone 3 or 7 is the best spare to keep. Both
 * claims are about the same thing - which tiles other players let go of - and neither is visible
 * in a hand on paper. Two hands can be identical tile for tile and differ entirely in what the
 * table will throw you.
 *
 * So measure the table. For every kind, over every hand, count the copies that were discarded, and
 * count them again restricted to the late game, because a wait only cares about tiles that come
 * out AFTER you are waiting on them.
 *
 * WHO IS PLAYING DECIDES WHAT THIS MEANS. A release rate is a fact about a population, not about
 * mahjong. `--coach` plays fresh hands with four CoachBots, which is the table the app's player is
 * being taught to sit at. `--dir` replays a recorded run, whose bots score discards on hand shape
 * only. Run both: a pattern that holds under two different discard policies is a property of the
 * tiles, and one that does not is a property of the bot.
 *
 * What it cannot tell you: whether HUMANS throw tiles this way. Nothing in this repo can. The
 * honest reading is that these are the rates against the opponents we can actually measure.
 */
import {
  GameState, Wall, makeRng, tableConfigOf, kindOf, isHonour, isJoker, rankOf, suitOf,
  type TileKind,
} from 'sg-mahjong-engine';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { botsFor } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { ShantenBot } from 'sg-mahjong-engine';
import { CoachBot } from 'sg-mahjong-solver';
import type { Bot } from 'sg-mahjong-engine';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const dir = arg('dir', '../data/gen/run-money4')!;
const maxHands = Number(arg('hands', '20000'));
const coachHands = Number(arg('coach', '0'));
const coachSeed = Number(arg('seed', '21'));
/**
 * Which bot plays the fresh hands: `coach` or `shanten`.
 *
 * The control matters more than the measurement here. The coach prices every throw against a
 * danger table that is keyed on exactly the classes this tool is about - it treats an honour as
 * safer than a middle tile - so if only the coach is measured, the answer is partly our own table
 * read back to us. `ShantenBot` has no danger model and no honour rule at all; it throws whatever
 * leaves the hand closest to done. An ordering that survives that is a property of the tiles.
 */
const botKind = arg('bots', 'coach')!;
/**
 * Where "late" starts, counted in turns taken at the table rather than rounds.
 *
 * A hand runs to about 60 of these. 30 is roughly half way, and it is past the point where a hand
 * that is going to be ready is ready - `reads.ts` puts a seat one tile away 20% of the time by
 * then. Before that a discard is somebody clearing rubbish, which tells you nothing about whether
 * your wait will be fed.
 */
const LATE = Number(arg('late', '30'));

const rules = rulesForDir(dir);
const cfg = tableConfigOf(rules);

function* sources(): Generator<{ g: GameState; bots: Bot[] }> {
  if (coachHands > 0) {
    for (let i = 0; i < coachHands; i++) {
      const wall = new Wall(makeRng(coachSeed * 1000003 + i), cfg.unplayable_tiles, rules.jokers.count);
      yield {
        g: GameState.deal(cfg, wall, { dealer: i % 4, prevailingWind: Math.floor(i / 4) % 4, rules }),
        bots: [0, 1, 2, 3].map(() => (botKind === 'shanten' ? new ShantenBot(makeRng(coachSeed * 7919 + i)) : new CoachBot())),
      };
    }
    return;
  }
  for (const hr of loadHands(dir).slice(0, maxHands)) {
    yield {
      g: GameState.deal(cfg, new Wall(makeRng(hr.seed), rules.unplayable_tiles, rules.jokers.count), { dealer: hr.dl, prevailingWind: hr.w, rules }),
      bots: botsFor(hr, DEFAULT_RANDOMNESS),
    };
  }
}

const thrown = new Float64Array(34);      // copies discarded, over all hands
const thrownLate = new Float64Array(34);  // the same, restricted to turn >= LATE
let hands = 0;

for (const { g, bots } of sources()) {
  hands++;
  let guard = 0;
  while (!g.finished && guard++ < 3000) g.step(bots);
  for (const e of g.discardLog) {
    const k = kindOf(e.tile);
    if (isJoker(k) || k >= 34) continue;
    thrown[k]! += 1;
    if (e.turn >= LATE) thrownLate[k]! += 1;
  }
}

/** Per copy, per hand: of the four copies of this kind, what share came out? */
const rate = (k: TileKind, late: boolean) => (late ? thrownLate[k]! : thrown[k]!) / (hands * 4);
/** Average over a group of kinds, so the three suits can be pooled by rank. */
const groupRate = (ks: TileKind[], late: boolean) => ks.reduce((a, k) => a + rate(k, late), 0) / ks.length;
const ranked = (r: number) => [0, 9, 18].map((base) => (base + r - 1) as TileKind);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

console.log(`\n${coachHands > 0 ? `${hands} ${botKind} hands, seed ${coachSeed}` : `${hands} hands from ${dir}`}   late = turn ${LATE}+\n`);
console.log('  tile          released   released late');
for (let r = 1; r <= 9; r++) {
  console.log(`  rank ${r}        ${pct(groupRate(ranked(r), false)).padStart(8)}   ${pct(groupRate(ranked(r), true)).padStart(8)}`);
}
const winds = [27, 28, 29, 30] as TileKind[], dragons = [31, 32, 33] as TileKind[];
console.log(`  winds         ${pct(groupRate(winds, false)).padStart(8)}   ${pct(groupRate(winds, true)).padStart(8)}`);
console.log(`  dragons       ${pct(groupRate(dragons, false)).padStart(8)}   ${pct(groupRate(dragons, true)).padStart(8)}`);

/**
 * `bad_wait_ranking`, answered.
 *
 * You are holding two copies and waiting on the other two. Each of those two comes out late with
 * probability p, so the chance at least one arrives is 1 - (1-p)^2. That treats the two copies as
 * independent, which they are not quite - a player holding one is likelier to hold the other - so
 * read the gap between classes rather than the absolute level.
 */
const twoLeft = (ks: TileKind[]) => 1 - (1 - groupRate(ks, true)) ** 2;
console.log('\n  bad_wait_ranking - you hold two, you wait on the last two:');
console.log(`    a middle tile (4-6)   ${pct(twoLeft([4, 5, 6].flatMap(ranked)))}`);
console.log(`    a 2 or an 8           ${pct(twoLeft([2, 8].flatMap(ranked)))}`);
console.log(`    a terminal (1 or 9)   ${pct(twoLeft([1, 9].flatMap(ranked)))}`);
console.log(`    a wind                ${pct(twoLeft(winds))}`);
console.log(`    a dragon              ${pct(twoLeft(dragons))}`);

/**
 * `threes_and_sevens`, answered.
 *
 * A lone tile of rank r is worth what it can grow into. Pair it with r+1 and the run waits on r-1
 * and r+2; pair it with r-1 and it waits on r-2 and r+1. So the tile's eventual wait is drawn from
 * those four ranks, and the tip's claim is that for a 3 or a 7 they sit lower and higher - where
 * tiles are released - while a 5's all sit in the middle, where they are not.
 */
const waitRanks = (r: number) => [r - 2, r - 1, r + 1, r + 2].filter((x) => x >= 1 && x <= 9);
console.log('\n  threes_and_sevens - how freely the wait a lone tile grows into is fed:');
for (const r of [2, 3, 4, 5, 6, 7, 8]) {
  const ks = waitRanks(r).flatMap(ranked);
  console.log(`    a lone ${r} waits on ${waitRanks(r).join('/')}`.padEnd(34) + `   ${pct(groupRate(ks, true))} late`);
}
