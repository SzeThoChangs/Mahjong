/**
 * Does the model actually win money against the coach? tsx src/headtohead.ts [games]
 *
 * The naive tournament cannot answer this. In a table of four IDENTICAL coaches, chips per game
 * still spread about 4.5 between seats over 500 games - seat and deal variance swamp any real
 * difference between bots. Two things fix that:
 *
 *   1. Rotate. The tested bot sits in all four seats in turn, so its result is not one seat's luck.
 *   2. Pair the walls. Arm A game g and arm B game g are dealt from the same seed, so both arms see
 *      the same deals and the comparison is of decisions rather than of who got the good tiles.
 *
 * Reports the tested seat's chips per game against the same seat playing coach, with a standard
 * error, because a difference smaller than its error bar is not a difference.
 */
import { readFileSync } from 'node:fs';
import { Wall, playGame, makeRng, shuffleWall, shuffleName, type Bot, type TableConfig } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot, PolicyBot, ClaimBot, FullPolicyBot, FoldCoachBot, PlainWaitCoachBot, WallCoachBot, AltReadsCoachBot } from '../bot.js';
import type { ReadsTables } from '../reads.js';

/**
 * Load a reads table written by `datagen/src/reads.ts`, which stores each cell as `{p, n}`.
 * `--reads <file>` selects the file the `altreads` arm plays with.
 */
function loadReads(path: string): ReadsTables {
  const j = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Record<string, { p: number; n: number }>>;
  const flat = (t?: Record<string, { p: number; n: number }>) =>
    Object.fromEntries(Object.entries(t ?? {}).map(([k, c]) => [k, c.p]));
  return { dangerSafe: flat(j.dangerSafe), danger: flat(j.danger), ready: flat(j.ready), dangerWall: flat(j.dangerWall) };
}
const readsArg = process.argv.indexOf('--reads');
const readsPath = readsArg >= 0 ? process.argv[readsArg + 1]! : '../data/gen/reads-coach.json';


const n = Number(process.argv[2] ?? 1000);
/** which learned half to put in the seat: the discard model, the claim model, or both. */
const ARMS: Record<string, { label: string; make: () => Bot }> = {
  policy: { label: 'discard model', make: () => new PolicyBot() },
  claim: { label: 'claim model', make: () => new ClaimBot() },
  full: { label: 'both models', make: () => new FullPolicyBot() },
  fold: { label: 'coach WITH the give-up rule', make: () => new FoldCoachBot() },
  plainwait: { label: 'coach WITHOUT the legal-wait rule (expect roughly -0.048)', make: () => new PlainWaitCoachBot() },
  wall: { label: 'coach discounting tiles no run can be waiting on', make: () => new WallCoachBot() },
  // the same coach, pricing danger off a table measured on a different population of players
  altreads: { label: `coach reading danger off ${readsPath}`, make: () => new AltReadsCoachBot(loadReads(readsPath)) },
  // identical bots on both sides: the difference must be exactly zero, which checks the harness
  self: { label: 'the coach against itself (harness check)', make: () => new CoachBot() },
};
const armName = process.argv[3] ?? 'policy';
/**
 * Which deals to play, by name: `--from 1 --count 2000` plays shuffle-00001 to shuffle-02000.
 *
 * Named deals rather than a seed number, so a result recorded today can be laid beside one from
 * last week - both say which shuffles they were measured on. Taking a LATER range is how you get
 * deals nothing has been fitted on, which is the check that a result is structural rather than an
 * artefact of one shuffle. The library is endless; there is nothing to generate or run out of.
 *
 * shuffle-00001 onwards is, tile for tile, the old "wall seed base 11" sequence, so everything
 * already in FINDINGS keeps its meaning. `--seed N` still plays the legacy seed-N walls, for
 * reproducing a figure recorded against another seed before the library existed.
 */
const legacySeed = process.argv.includes('--seed') ? Number(process.argv[process.argv.indexOf('--seed') + 1]) : null;
const fromShuffle = process.argv.includes('--from') ? Number(process.argv[process.argv.indexOf('--from') + 1]) : 1;
const seedBase = legacySeed ?? 11;
const ARM = ARMS[armName];
if (!ARM) { console.error(`unknown arm ${armName}; expected one of ${Object.keys(ARMS).join(', ')}`); process.exit(1); }
const cfg: TableConfig = loadTableConfig();
// The wall must be the table's wall. This harness used to deal WITHOUT wildcards while the bots it
// compares were tuned on data generated WITH them, so the verdict was measured on a different game.
const rules = loadTableRules();

/** Play the same n deals with `seatBot` in `seat` and coaches elsewhere; return that seat's chips. */
function arm(seat: number, makeSeatBot: () => Bot): number[] {
  const out: number[] = [];
  for (let g = 0; g < n; g++) {
    const wall = legacySeed === null
      ? shuffleWall(fromShuffle + g, cfg.unplayable_tiles, rules.jokers.count)
      : new Wall(makeRng(legacySeed * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count);
    const bots: Bot[] = [0, 1, 2, 3].map((s) => (s === seat ? makeSeatBot() : new CoachBot()));
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    out.push(r.chipsDelta[seat]!);
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

const diffs: number[] = [];
const deals = legacySeed === null
  ? `${shuffleName(fromShuffle)}..${shuffleName(fromShuffle + n - 1)}`
  : `legacy wall seed base ${legacySeed}`;
console.log(`${n} paired deals per seat, ${ARM.label} vs the book coach, rotated through all four seats (${deals})\n`);
console.log(`seat   model chips/game   coach chips/game   difference (paired)`);
for (let seat = 0; seat < 4; seat++) {
  const model = arm(seat, ARM.make);
  const coach = arm(seat, () => new CoachBot());
  const d = model.map((x, i) => x - coach[i]!);
  diffs.push(...d);
  console.log(`  ${seat + 1}    ${mean(model).toFixed(2).padStart(14)}   ${mean(coach).toFixed(2).padStart(16)}   ${mean(d).toFixed(2).padStart(8)} ± ${(sd(d) / Math.sqrt(d.length)).toFixed(2)}`);
}
const m = mean(diffs), se = sd(diffs) / Math.sqrt(diffs.length);
console.log(`\nover all ${diffs.length} paired deals: ${m >= 0 ? '+' : ''}${m.toFixed(3)} ± ${se.toFixed(3)} chips/game for the model`);
console.log(m > 2 * se ? 'The model is ahead by more than two standard errors.'
  : m < -2 * se ? 'The COACH is ahead by more than two standard errors.'
  : 'Inside two standard errors: this many deals cannot separate them.');
