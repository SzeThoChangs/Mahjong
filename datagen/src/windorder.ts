/**
 * `wind_discard_order`: among winds you do not need, does it pay to release the one belonging to the
 * player immediately before you?
 *
 *   tsx src/windorder.ts --coach 20000 --seed 11
 *   tsx src/windorder.ts --dir ../data/gen/run-money4 --hands 20000
 *
 * The book's reasoning is about tempo rather than danger. Play advances to the next seat, so the
 * player who acts immediately before you is `(you + 3) % 4`. If they pong your discard the turn
 * jumps straight to them and the two players in between are skipped, so you come round again
 * sooner. A pong by the player after you skips nobody and buys you nothing. That makes the wind of
 * the player before you the one to let go first.
 *
 * This is the last rule of the four that NEXT called cheap and is still genuinely unmeasured, and
 * it is the only one of them the reads pipeline cannot answer, because the outcome is not a
 * probability of dealing in. It is turns, and turns are worth real money here - a seat gets about
 * eleven draws in a hand, so one extra is nearly a tenth more hand.
 *
 * WHAT IS MEASURED. Every wind discarded by a seat that does not need it is classified by WHOSE
 * seat wind it is, as an offset from the thrower: 1 is the player who acts next, 3 is the player
 * who acts immediately before the thrower, 2 is the one across, and 0 is the thrower's own wind.
 * Against each we record how often it was ponged, by whom, and what the thrower got out of the
 * hand: draws taken, and chips.
 *
 * THE CONTROL THAT MATTERS. A wind's owner is not the only thing that decides whether it is ponged,
 * and the offsets are not dealt equally - a seat's own wind is worth tai to it and is thrown less,
 * and the prevailing wind is wanted by everybody. So the comparison is held at the turn of the
 * throw, and the thrower's own wind and the prevailing wind are reported as separate rows rather
 * than pooled into the three offsets. Without that the read would be measuring who holds tai
 * rather than who sits where.
 *
 * WHAT IT CANNOT SETTLE. Even a real gain in draws is not yet chips. The book's claim is about a
 * choice BETWEEN winds and this measures the winds a coach happened to throw, so a positive here
 * earns a proper arm in `headtohead`, not a place in `rankDiscards`. See FINDINGS: five danger
 * reads measured true and every one of them was worth nothing once it was played for money.
 */
import {
  GameState, Wall, makeRng, tableConfigOf, kindOf, isWind, type TileKind,
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

/** A thrown wind, grouped by whose seat wind it was, as an offset from the seat that threw it. */
function blank() {
  return {
    throws: 0, ponged: 0, pongedByOwner: 0,
    /** the thing the rule is actually about: a claim that skips players between them and the thrower */
    skipped: 0, skippedSeats: 0,
    drawsSum: 0, drawsN: 0, chipsSum: 0, wins: 0,
  };
}
type Acc = ReturnType<typeof blank>;
const byOffset = new Map<string, Acc>();
const get = (m: Map<string, Acc>, k: string) => { let c = m.get(k); if (!c) m.set(k, c = blank()); return c; };
const byTurn = new Map<string, Acc>();

let hands = 0, windThrows = 0;

for (const { g, bots } of sources()) {
  hands++;
  const dealer = g.dealer, prevailing = g.prevailingWind;
  let guard = 0;
  while (!g.finished && guard++ < 3000) g.step(bots);
  const r = g.result; if (!r) continue;

  // A seat's own wind tile: role 0 is the dealer (East), and winds occupy kinds 27..30.
  const windOwner = (k: TileKind): number => ((k - 27) + dealer) % 4;   // which SEAT that wind belongs to
  const isPrevailing = (k: TileKind): boolean => k - 27 === prevailing;

  for (const e of g.discardLog) {
    const k = kindOf(e.tile);
    if (!isWind(k)) continue;
    windThrows++;
    const thrower = e.seat;
    const owner = windOwner(k);
    const offset = (owner - thrower + 4) % 4;              // 0 = my own wind, 3 = the player before me
    // The prevailing wind is wanted by every seat, so it is a different question and is kept apart.
    const label = isPrevailing(k) ? 'prevailing' : `own+${offset}`;
    const claimed = e.claimedBy !== null && e.claimKind !== 'win';
    const claimOffset = claimed ? (e.claimedBy! - thrower + 4) % 4 : -1;
    // How many seats the claim skipped for the thrower: a claim by the player before you skips two.
    const skipped = claimOffset > 0 ? claimOffset - 1 : 0;

    for (const acc of [get(byOffset, label), get(byTurn, `${label}|${Math.min(40, Math.floor(e.turn / 20) * 20)}`)]) {
      acc.throws++;
      if (claimed) { acc.ponged++; if (e.claimedBy === owner) acc.pongedByOwner++; if (skipped > 0) { acc.skipped++; acc.skippedSeats += skipped; } }
      acc.drawsSum += r.draws[thrower] ?? 0; acc.drawsN++;
      acc.chipsSum += r.chipsDelta[thrower] ?? 0;
      if (r.winner === thrower) acc.wins++;
    }
  }
}

const pct = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(2)}%`;
const NAME: Record<string, string> = {
  'own+0': 'my own seat wind',
  'own+1': "the next player's wind",
  'own+2': "the player across's wind",
  'own+3': "the wind of the player BEFORE me",
  prevailing: 'the prevailing wind',
};
const ORDER = ['own+3', 'own+2', 'own+1', 'own+0', 'prevailing'];

console.log(`\n${coachHands > 0 ? `${hands} coach hands, seed ${seed}` : `${hands} hands from ${dir}`}`);
console.log(`${windThrows.toLocaleString()} winds thrown\n`);
console.log(`  whose wind I threw                  throws     ponged   by its owner   skipped seats   my draws   chips/hand`);
for (const key of ORDER) {
  const a = byOffset.get(key); if (!a || !a.throws) continue;
  console.log(`  ${NAME[key]!.padEnd(34)}${a.throws.toLocaleString().padStart(7)}`
    + `   ${pct(a.ponged, a.throws).padStart(8)}   ${pct(a.pongedByOwner, a.throws).padStart(12)}`
    + `   ${(a.skippedSeats / a.throws).toFixed(3).padStart(13)}`
    + `   ${(a.drawsSum / Math.max(1, a.drawsN)).toFixed(2).padStart(8)}   ${(a.chipsSum / a.throws).toFixed(3).padStart(10)}`);
}

/** Two proportions, with the standard error of their difference: the same test the reads use. */
const z = (ah: number, an: number, bh: number, bn: number): number => {
  const pa = ah / an, pb = bh / bn;
  const se = Math.sqrt(pa * (1 - pa) / an + pb * (1 - pb) / bn);
  return se > 0 ? (pa - pb) / se : 0;
};
/** Two means of a count, with the standard error of their difference. Draws per hand vary by only a
 *  few, so this is the number the rule lives or dies by and it deserves an error bar. */
const zMean = (a: Acc, b: Acc, sd = 3.2): number => {
  const se = Math.sqrt(sd * sd / Math.max(1, a.drawsN) + sd * sd / Math.max(1, b.drawsN));
  return se > 0 ? (a.drawsSum / a.drawsN - b.drawsSum / b.drawsN) / se : 0;
};

const before = byOffset.get('own+3'), after = byOffset.get('own+1');
if (before && after && Math.min(before.throws, after.throws) > 200) {
  console.log(`\n  THE CLAIM. Releasing the wind of the player before me against the wind of the player after me:`);
  console.log(`    ponged at all          ${pct(before.ponged, before.throws)} against ${pct(after.ponged, after.throws)}   z = ${z(before.ponged, before.throws, after.ponged, after.throws).toFixed(1)}`);
  console.log(`    seats skipped for me   ${(before.skippedSeats / before.throws).toFixed(3)} against ${(after.skippedSeats / after.throws).toFixed(3)}`);
  console.log(`    my draws in that hand  ${(before.drawsSum / before.drawsN).toFixed(2)} against ${(after.drawsSum / after.drawsN).toFixed(2)}   z = ${zMean(before, after).toFixed(1)}`);
  console.log(`    my chips in that hand  ${(before.chipsSum / before.throws).toFixed(3)} against ${(after.chipsSum / after.throws).toFixed(3)}`);
  console.log(`\n  The middle line is the mechanism and it is arithmetic: a pong by the player before me`);
  console.log(`  skips two seats and a pong by the player after me skips none. The question is whether`);
  console.log(`  the first happens often enough, and whether the draws it buys ever reach the chips.`);
}

console.log(`\n  held at the turn of the throw, because a wind thrown late is a different tile:`);
console.log(`  turn   whose wind                          throws     ponged   skipped seats   my draws`);
for (const t of [0, 20, 40]) {
  for (const key of ['own+3', 'own+1']) {
    const a = byTurn.get(`${key}|${t}`); if (!a || a.throws < 200) continue;
    console.log(`   ${String(t).padStart(2)}+   ${NAME[key]!.padEnd(34)}${a.throws.toLocaleString().padStart(7)}`
      + `   ${pct(a.ponged, a.throws).padStart(8)}   ${(a.skippedSeats / a.throws).toFixed(3).padStart(13)}`
      + `   ${(a.drawsSum / Math.max(1, a.drawsN)).toFixed(2).padStart(8)}`);
  }
}
