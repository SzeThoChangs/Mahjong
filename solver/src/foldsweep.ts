/**
 * Sweep the threat-fold thresholds and play each setting for money.
 *
 *   tsx src/foldsweep.ts [deals-per-seat]
 *
 * The rule is "give up when somebody is probably ready AND this hand is still far", which has two
 * numbers in it and no principled way to pick them. So every combination is played against the
 * plain coach on paired walls, rotated through all four seats, exactly as headtohead.ts does.
 * A POSITIVE difference means folding on those thresholds wins.
 *
 * Fold rates are reported alongside, because a setting that never fires and a setting that is
 * genuinely neutral look identical in the chips column.
 */
import { Wall, playGame, makeRng, kindOf, shanten, type Bot, type PlayerView, type TileInstance, type Meld } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot } from './bot.js';
import { rankDiscards } from './rank.js';
import { maxReadyChance } from './reads.js';
import type { Context } from './targets.js';

const n = Number(process.argv[2] ?? 1000);
const cfg = loadTableConfig(), rules = loadTableRules();

const ctxOf = (v: PlayerView): Context => ({
  seat: (v.seat - v.dealer + 4) % 4, prevailingWind: v.prevailingWind, bonus: v.bonus.map(kindOf), playerTurns: v.playerTurns,
  minimumFan: v.config.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: v.config.self_draw_minimum_fan, wallRemaining: v.wallRemaining,
  visible: [
    ...v.discardLog.map((d) => kindOf(d.tile)),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.melds.flatMap((m) => m.tiles))),
    ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.bonus.map(kindOf))),
  ],
  opponentMelds: v.players.map((p, s) => (s === v.seat ? -1 : p.melds.length)).filter((x) => x >= 0),
});
const meldsOf = (v: PlayerView): Meld[] => v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));

let fired = 0, seen = 0;
class ThreatFoldBot extends CoachBot {
  constructor(private ready: number, private sh: number) { super(); }
  override chooseDiscard(v: PlayerView): TileInstance {
    const ctx = ctxOf(v);
    seen++;
    if (maxReadyChance(ctx.opponentMelds, ctx.playerTurns) >= this.ready && shanten(v.hand.map(kindOf), v.melds.length) >= this.sh) fired++;
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), ctx, { fold: { ready: this.ready, shanten: this.sh } });
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

/** Play `n` deals with the tested bot in `seat` and plain coaches elsewhere; return that seat's chips. */
function armChips(seat: number, make: () => Bot): number[] {
  const out: number[] = [];
  for (let g = 0; g < n; g++) {
    const wall = new Wall(makeRng(11 * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count);
    const bots: Bot[] = [0, 1, 2, 3].map((s) => (s === seat ? make() : new CoachBot()));
    const r = playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
    out.push(r.chipsDelta[seat]!);
  }
  return out;
}

const READY = [0.10, 0.16, 0.25, 0.35];
const SH = [2, 3, 4];
console.log(`${n} paired deals per seat (${n * 4} per setting), threat-fold vs the plain coach\n`);
console.log(`ready>=  shanten>=   fires    chips/game vs coach`);
for (const ready of READY) {
  for (const sh of SH) {
    const diffs: number[] = [];
    fired = 0; seen = 0;
    for (let seat = 0; seat < 4; seat++) {
      const f = armChips(seat, () => new ThreatFoldBot(ready, sh));
      const c = armChips(seat, () => new CoachBot());
      for (let i = 0; i < f.length; i++) diffs.push(f[i]! - c[i]!);
    }
    const m = mean(diffs), se = sd(diffs) / Math.sqrt(diffs.length);
    const mark = m > 2 * se ? '  <-- ahead' : m < -2 * se ? '  (behind)' : '';
    console.log(`  ${ready.toFixed(2)}       ${sh}      ${(100 * fired / Math.max(1, seen)).toFixed(2).padStart(5)}%   ${(m >= 0 ? '+' : '') + m.toFixed(3)} +/- ${se.toFixed(3)}${mark}`);
  }
}
