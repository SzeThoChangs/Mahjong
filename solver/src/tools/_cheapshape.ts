/**
 * WHY does removing the cheap hand cost nothing? Same paired structure as `headtohead`, but instead
 * of the chips it records what the tested seat's hands actually LOOKED like.
 *
 * The head-to-head says the `nocheap` arm is worth nothing over 40,000 paired deals, and there are
 * two very different games that produce that number. Either the coach without the cheap plan plays
 * the same hands (in which case removing 15% of its throws somehow changed nothing), or it plays a
 * genuinely different game - fewer wins, bigger ones - that happens to net out. The first would say
 * the value machinery is inert; the second would say it works and the trade is fair. Chips alone
 * cannot tell them apart.
 *
 * Reports, for the tested seat only: how often it wins, what a win is worth, what it is worth in
 * tai, what it wins WITH, how often it deals in and what that costs.
 */
import { playGame, shuffleWall, type Bot } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot, NoCheapCoachBot, OnlyCheapCoachBot } from '../bot.js';

const cfg = loadTableConfig(), rules = loadTableRules();
const n = Number(process.argv[2] ?? 1000);
const FROM = Number(process.argv[3] ?? 450001);
/** which end of the plan list to swing: `nocheap` removes the cheap hand, `onlycheap` leaves
 *  nothing else. Both tables in FINDINGS came from this tool, so both have to be reachable from it. */
const ARM = process.argv.includes('--arm') ? process.argv[process.argv.indexOf('--arm') + 1]! : 'nocheap';
const MAKE = ARM === 'onlycheap' ? () => new OnlyCheapCoachBot() : () => new NoCheapCoachBot();
if (ARM !== 'nocheap' && ARM !== 'onlycheap') { console.error(`unknown arm ${ARM}; expected nocheap or onlycheap`); process.exit(1); }

interface Shape {
  games: number; wins: number; selfDraws: number; winChips: number; winTai: number;
  dealIns: number; dealInChips: number; draws: number; combos: Map<string, number>; chips: number;
  /** the cheapest legal hand and the expensive end of the range, as shares of this seat's wins */
  minWins: number; bigWins: number;
  /** how often the seat ever got one tile from winning, and how late - the tell that caught the
   *  first version of the `onlycheap` arm playing like a folder rather than like a fast bot */
  gotReady: number; readySum: number;
}
const blank = (): Shape => ({ games: 0, wins: 0, selfDraws: 0, winChips: 0, winTai: 0, dealIns: 0, dealInChips: 0, draws: 0, combos: new Map(), chips: 0, minWins: 0, bigWins: 0, gotReady: 0, readySum: 0 });

function play(seat: number, make: () => Bot, s: Shape): void {
  for (let g = 0; g < n; g++) {
    const wall = shuffleWall(FROM + g, cfg.unplayable_tiles, rules.jokers.count);
    const bots: Bot[] = [0, 1, 2, 3].map((x) => (x === seat ? make() : new CoachBot()));
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    s.games++; s.chips += r.chipsDelta[seat]!;
    const rt = r.readyTurn[seat] ?? -1;
    if (rt >= 0) { s.gotReady++; s.readySum += rt; }
    if (r.winner === null) { s.draws++; continue; }
    if (r.winner === seat) {
      s.wins++; s.winChips += r.chipsDelta[seat]!; s.winTai += r.score?.fan ?? 0;
      if (r.selfDraw) s.selfDraws++;
      const fan = r.score?.fan ?? 0;
      if (fan <= cfg.minimum_fan) s.minWins++;
      if (fan >= 4) s.bigWins++;
      const c = r.score?.combination ?? 'unknown';
      s.combos.set(c, (s.combos.get(c) ?? 0) + 1);
    } else if (r.discarder === seat) { s.dealIns++; s.dealInChips += r.chipsDelta[seat]!; }
  }
}

const arm = blank(), coach = blank();
for (let seat = 0; seat < 4; seat++) { play(seat, MAKE, arm); play(seat, () => new CoachBot(), coach); }

const pc = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(2)}%`;
const row = (label: string, a: string, b: string) => console.log(`  ${label.padEnd(34)} ${a.padStart(12)}   ${b.padStart(12)}`);
console.log(`${n} deals per seat, all four seats, shuffle-${FROM}..${FROM + n - 1}\n`);
console.log(`  ${''.padEnd(34)} ${(ARM === 'onlycheap' ? 'cheap only' : 'no cheap plan').padStart(12)}   ${'book coach'.padStart(12)}`);
row('games', String(arm.games), String(coach.games));
row('chips per game', (arm.chips / arm.games).toFixed(3), (coach.chips / coach.games).toFixed(3));
row('won the hand', pc(arm.wins, arm.games), pc(coach.wins, coach.games));
row('  ...self-drawn', pc(arm.selfDraws, arm.wins), pc(coach.selfDraws, coach.wins));
row('  ...chips per win', (arm.winChips / Math.max(1, arm.wins)).toFixed(2), (coach.winChips / Math.max(1, coach.wins)).toFixed(2));
row('  ...tai per win', (arm.winTai / Math.max(1, arm.wins)).toFixed(2), (coach.winTai / Math.max(1, coach.wins)).toFixed(2));
row('  ...at the table minimum', pc(arm.minWins, arm.wins), pc(coach.minWins, coach.wins));
row('  ...four fan or more', pc(arm.bigWins, arm.wins), pc(coach.bigWins, coach.wins));
row('reached ready', pc(arm.gotReady, arm.games), pc(coach.gotReady, coach.games));
row('  ...average turn', (arm.readySum / Math.max(1, arm.gotReady)).toFixed(1), (coach.readySum / Math.max(1, coach.gotReady)).toFixed(1));
row('dealt in', pc(arm.dealIns, arm.games), pc(coach.dealIns, coach.games));
row('  ...chips per deal-in', (arm.dealInChips / Math.max(1, arm.dealIns)).toFixed(2), (coach.dealInChips / Math.max(1, coach.dealIns)).toFixed(2));
row('hand drawn', pc(arm.draws, arm.games), pc(coach.draws, coach.games));
console.log(`\n  what it won WITH (share of its own wins)`);
const keys = [...new Set([...arm.combos.keys(), ...coach.combos.keys()])].sort();
for (const k of keys) row(`  ${k}`, pc(arm.combos.get(k) ?? 0, arm.wins), pc(coach.combos.get(k) ?? 0, coach.wins));
