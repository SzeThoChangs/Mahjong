/**
 * `second_copy_call`: what it means when a player claims the SECOND copy of a dragon or a wind.
 *
 *   tsx src/valuecopy.ts --coach 20000 --seed 11
 *   tsx src/valuecopy.ts --dir ../data/gen/run-money4 --hands 20000
 *
 * The tactics book's most specific read. If the first dragon or wind is thrown and nobody wants it,
 * and then the second comes out and somebody pongs THAT, the book says read the hand as cheap but
 * assembled: low tai, and probably ready or a good one away. Its reasoning is an elimination. A
 * player holding real value would have taken the first copy even with an awkward shape, because the
 * tai was the point. A player who was cheap AND badly shaped would have passed the second too and
 * kept it as a safe tile. Claiming only the second is neither.
 *
 * So the measurement is not about danger, it is about what the hand turns out to be. Every seat in
 * every hand is put in one of three groups by its FIRST honour claim - the first copy of that kind
 * to be thrown, a later copy, or no honour claimed at all - and then the hand is played to the end
 * and we look at what those seats actually had: how often they got ready, how often they won, and
 * what they scored when they did.
 *
 * WHO IS PLAYING DECIDES THIS ONE TOO. Our coach keeps dragons and its seat wind for the tai, so it
 * claims first copies readily; the datagen personalities have no value model at all. Run both.
 */
import {
  GameState, Wall, makeRng, tableConfigOf, kindOf, isHonour, shanten, type TileKind,
} from 'sg-mahjong-engine';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { botsFor } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { CoachBot } from 'sg-mahjong-solver';
import type { Bot } from 'sg-mahjong-engine';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const dir = arg('dir', '../data/gen/run-money4')!;
const maxHands = Number(arg('hands', '20000'));
const coachHands = Number(arg('coach', '0'));
const seed = Number(arg('seed', '11'));

const rules = rulesForDir(dir);
const cfg = tableConfigOf(rules);

function* sources(): Generator<{ g: GameState; bots: Bot[] }> {
  if (coachHands > 0) {
    for (let i = 0; i < coachHands; i++) {
      yield {
        g: GameState.deal(cfg, new Wall(makeRng(seed * 1000003 + i), cfg.unplayable_tiles, rules.jokers.count), { dealer: i % 4, prevailingWind: Math.floor(i / 4) % 4, rules }),
        bots: [0, 1, 2, 3].map(() => new CoachBot()),
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

type Group = 'first' | 'later' | 'none';
function blank() { return { seats: 0, ready: 0, won: 0, fan: 0, chips: 0 }; }
const stat = { first: blank(), later: blank(), none: blank() };
/**
 * The same split, held at the turn the claim happened.
 *
 * A later copy is thrown later, so a seat that claims one is claiming later in the hand, and a hand
 * that is further along by then is not the same evidence as a hand that got there faster. Bucketing
 * by the claim's own turn is the cheapest way to see whether the difference is about WHICH copy or
 * only about WHEN.
 */
const byTurn = new Map<string, ReturnType<typeof blank>>();
const at = (g: Group, t: number) => {
  const key = `${g}|${Math.min(40, Math.floor(t / 20) * 20)}`;
  let c = byTurn.get(key); if (!c) byTurn.set(key, c = blank());
  return c;
};
let hands = 0;

for (const { g, bots } of sources()) {
  hands++;
  let guard = 0;
  while (!g.finished && guard++ < 3000) g.step(bots);
  const r = g.result; if (!r) continue;

  // classify every seat by its first honour claim: was that copy the first of its kind to be thrown?
  const group: Group[] = ['none', 'none', 'none', 'none'];
  const claimTurn = [-1, -1, -1, -1];
  const thrownBefore = new Map<TileKind, number>();
  for (const e of g.discardLog) {
    const k = kindOf(e.tile);
    if (isHonour(k) && e.claimedBy !== null && e.claimKind !== 'win' && group[e.claimedBy] === 'none') {
      group[e.claimedBy] = (thrownBefore.get(k) ?? 0) > 0 ? 'later' : 'first';
      claimTurn[e.claimedBy] = e.turn;
    }
    if (k < 34) thrownBefore.set(k, (thrownBefore.get(k) ?? 0) + 1);
  }

  for (let s = 0; s < 4; s++) {
    const q = g.players[s]!;
    const isReady = shanten(q.hand.map(kindOf), q.melds.length) <= 0;
    const won = r.winner === s, fan = won ? (r.score?.fan ?? 0) : 0, chips = r.chipsDelta[s] ?? 0;
    for (const acc of [stat[group[s]!], ...(claimTurn[s]! >= 0 ? [at(group[s]!, claimTurn[s]!)] : [])]) {
      acc.seats++;
      if (isReady) acc.ready++;
      if (won) { acc.won++; acc.fan += fan; }
      acc.chips += chips;
    }
  }
}

const pct = (a: number, b: number) => `${(100 * a / b).toFixed(1)}%`;
console.log(`\n${coachHands > 0 ? `${hands} coach hands, seed ${seed}` : `${hands} hands from ${dir}`}\n`);
console.log('  first honour claim      seats     ready at the end     won      tai when they won    chips/hand');
for (const g of ['first', 'later', 'none'] as const) {
  const a = stat[g];
  if (!a.seats) continue;
  const label = g === 'first' ? 'the first copy thrown' : g === 'later' ? 'a later copy' : 'claimed no honour';
  console.log(`  ${label.padEnd(24)}${String(a.seats).padStart(6)}   ${pct(a.ready, a.seats).padStart(14)}`
    + `   ${pct(a.won, a.seats).padStart(7)}   ${(a.won ? (a.fan / a.won).toFixed(2) : '-').padStart(14)}`
    + `   ${(a.chips / a.seats).toFixed(3).padStart(10)}`);
}
console.log('\n  held at the turn the claim happened, because a later copy is thrown later:');
for (const t of [0, 20, 40]) {
  const first = byTurn.get(`first|${t}`), later = byTurn.get(`later|${t}`);
  if (!first || !later || Math.min(first.seats, later.seats) < 50) continue;
  const line = (label: string, a: ReturnType<typeof blank>) =>
    `  claimed at turn ${String(t).padStart(2)}+ ${label.padEnd(14)}${String(a.seats).padStart(6)}   ${pct(a.ready, a.seats).padStart(14)}`
    + `   ${pct(a.won, a.seats).padStart(7)}   ${(a.won ? (a.fan / a.won).toFixed(2) : '-').padStart(14)}   ${(a.chips / a.seats).toFixed(3).padStart(10)}`;
  console.log(line('the first copy', first));
  console.log(line('a later copy', later));
}
