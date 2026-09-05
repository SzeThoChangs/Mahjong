/**
 * Does a plan-locked seat actually play for its plan, and what does it cost?
 *
 *   tsx src/plancheck.ts --hands 400
 *
 * `PlanBot` exists so a value fit can be made on hands where somebody COMMITTED. That is only worth
 * generating if the flag actually changes how the seat plays, so this measures it before any long
 * run: one locked seat against three coaches, the locked seat rotating, and at the last throw of
 * the hand we look at what the seat is holding. A half-colour seat should be down to one suit, an
 * all-pong seat should be holding triplets, and both should be losing chips - a seat that cannot
 * abandon a bad plan is not supposed to play well.
 */
import {
  GameState, Wall, makeRng, tableConfigOf, kindOf, isHonour, isSuited, suitOf, isJoker,
  type Bot, type Decision, type TileKind,
} from 'sg-mahjong-engine';
import { rulesForDir } from './tablerules.js';
import { CoachBot, PlanBot } from 'sg-mahjong-solver';
import type { TargetId } from 'sg-mahjong-solver';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const hands = Number(arg('hands', '400'));
const rules = rulesForDir('../data/gen/run-coach2');
const cfg = tableConfigOf(rules);

const PLANS: (TargetId | 'coach')[] = ['coach', 'half_color', 'ping_wu', 'all_pong', 'chicken'];

for (const plan of PLANS) {
  let n = 0, wins = 0, chips = 0, suits = 0, triplets = 0, honours = 0, ready = 0;
  for (let i = 0; i < hands; i++) {
    const locked = i % 4, dealer = i % 4 === 0 ? 1 : i % 4;   // the locked seat is not always the dealer
    let last: { hand: TileKind[]; melds: TileKind[][] } | null = null;
    const bots: Bot[] = [0, 1, 2, 3].map((s) => (s === locked && plan !== 'coach' ? new PlanBot(plan) : new CoachBot()));
    const g = GameState.deal(cfg, new Wall(makeRng(7 * 1000003 + i), cfg.unplayable_tiles, rules.jokers.count), {
      dealer, prevailingWind: Math.floor(i / 4) % 4, rules,
      recorder: { record(d: Decision) {
        if (d.seat !== locked || d.kind !== 'discard') return;
        last = { hand: d.view.hand.map(kindOf).filter((k) => !isJoker(k)), melds: d.view.melds.map((m) => m.tiles) };
      } },
    });
    const res = g.run(bots);
    if (!last) continue;
    const { hand, melds } = last as { hand: TileKind[]; melds: TileKind[][] };
    const all = [...hand, ...melds.flat()];
    n++;
    if (res.winner === locked) wins++;
    chips += res.chipsDelta[locked]!;
    suits += new Set(all.filter(isSuited).map(suitOf)).size;
    const c = new Map<TileKind, number>();
    for (const k of all) c.set(k, (c.get(k) ?? 0) + 1);
    triplets += [...c.values()].filter((x) => x >= 3).length;
    honours += all.filter(isHonour).length;
    if (res.readyTurn[locked]! >= 0) ready++;
  }
  console.log(`  ${String(plan).padEnd(12)} n=${n}  won ${(100 * wins / n).toFixed(1)}%  reached ready ${(100 * ready / n).toFixed(1)}%  chips/hand ${(chips / n).toFixed(2).padStart(6)}   suits held ${(suits / n).toFixed(2)}  triplets ${(triplets / n).toFixed(2)}  honours ${(honours / n).toFixed(2)}`);
}
