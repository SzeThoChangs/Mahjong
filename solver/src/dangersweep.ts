/**
 * Sweep DANGER_WEIGHT against MONEY.
 *
 *   tsx src/dangersweep.ts [deals-per-seat]
 *
 * The shipped 40 was fitted by sweeping the coach's per-decision agreement with the measured
 * play-outs (54.5% -> 55.7%, peak near 40). Agreement has since failed to predict chips three
 * separate times, so the number that governs how defensively the coach plays has never actually
 * been checked against the thing it is meant to win.
 *
 * This is also the continuous form of the fold rule: "defend harder when the table looks
 * dangerous" is already what the term does, graded per tile, and a fold is the crude switch
 * version of it. If more defence is worth anything, it should show up here.
 */
import { Wall, playGame, makeRng, kindOf, type Bot, type PlayerView, type TileInstance, type Meld } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot } from './bot.js';
import { rankDiscards } from './rank.js';
import type { Context } from './targets.js';

const n = Number(process.argv[2] ?? 1000);
/** wall seed base - see headtohead.ts: a single hardcoded shuffle hid a false per-seat pattern */
const seedBase = Number(process.argv[3] ?? 11);
const cfg = loadTableConfig(), rules = loadTableRules();

const ctxOf = (v: PlayerView, dangerWeight?: number): Context => ({
  seat: (v.seat - v.dealer + 4) % 4, prevailingWind: v.prevailingWind, bonus: v.bonus.map(kindOf), playerTurns: v.playerTurns,
  minimumFan: v.config.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: v.config.self_draw_minimum_fan,
  wallRemaining: v.wallRemaining, dangerWeight,
  visible: [
    ...v.discardLog.map((d) => kindOf(d.tile)),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.melds.flatMap((m) => m.tiles))),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.bonus.map(kindOf))),
  ],
  opponentMelds: v.players.map((p, s) => (s === v.seat ? -1 : p.melds.length)).filter((x) => x >= 0),
});
const meldsOf = (v: PlayerView): Meld[] => v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));

class WeightedCoach extends CoachBot {
  constructor(private w: number) { super(); }
  override chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), ctxOf(v, this.w));
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

function armChips(seat: number, make: () => Bot): number[] {
  const out: number[] = [];
  for (let g = 0; g < n; g++) {
    const wall = new Wall(makeRng(seedBase * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count);
    const bots: Bot[] = [0, 1, 2, 3].map((s) => (s === seat ? make() : new CoachBot()));
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    out.push(r.chipsDelta[seat]!);
  }
  return out;
}

console.log(`${n} paired deals per seat (${n * 4} per setting), danger weight vs the shipped 40 (wall seed base ${seedBase})\n`);
console.log(`weight    chips/game vs coach`);
for (const w of [10, 20, 40, 70, 110, 160, 240]) {
  const diffs: number[] = [];
  for (let seat = 0; seat < 4; seat++) {
    const a = armChips(seat, () => new WeightedCoach(w));
    const b = armChips(seat, () => new CoachBot());
    for (let i = 0; i < a.length; i++) diffs.push(a[i]! - b[i]!);
  }
  const m = mean(diffs), se = sd(diffs) / Math.sqrt(diffs.length);
  const mark = m > 2 * se ? '  <-- AHEAD' : m < -2 * se ? '  (behind)' : '';
  console.log(`  ${String(w).padStart(3)}     ${(m >= 0 ? '+' : '') + m.toFixed(3)} +/- ${se.toFixed(3)}${mark}`);
}
