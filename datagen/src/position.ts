/**
 * Reconstruct a recorded position and re-sample its hidden information.
 *
 *  positionAt(hand, d)        -> GameState exactly at decision d (ground truth, via replay)
 *  determinize(g, seat, rng)  -> a copy where everything `seat` cannot see is re-dealt at random,
 *                                consistent with the visible state (hand sizes, melds, bonus, discards, wall size).
 *                                Lives in the solver now, so the phone can do it too; re-exported here.
 */
export { determinize } from 'sg-mahjong-solver';
import { GameState, Wall, makeRng, tableConfigOf, type RulesConfig, type Bot } from 'sg-mahjong-engine';
import { makeBot, type RandomnessConfig, DEFAULT_RANDOMNESS } from './bots.js';
import { botSeed } from './session.js';
import { scriptedBots } from './scripted.js';
import type { HandRecord } from './records.js';

export function botsFor(rec: HandRecord, randomness: RandomnessConfig = DEFAULT_RANDOMNESS): Bot[] {
  return rec.bots.map((t, seat) => makeBot(t, makeRng(botSeed(rec.seed, seat)), randomness));
}


/** Replay hand `rec` until decision index `d` is pending. Returns the live state and the bots (with rng state advanced). */
export function positionAt(rec: HandRecord, d: number, rules: RulesConfig, randomness: RandomnessConfig = DEFAULT_RANDOMNESS): { g: GameState; bots: Bot[] } | null {
  const cfg = tableConfigOf(rules);
  const g = GameState.deal(cfg, new Wall(makeRng(rec.seed), rules.unplayable_tiles, rules.jokers.count), { dealer: rec.dl, prevailingWind: rec.w, rules });
  const bots = scriptedBots(rec.seq) ?? botsFor(rec, randomness);
  let idx = 0;
  g.advance();
  while (!g.finished) {
    const p = g.pending();
    if (!p) { g.advance(); continue; }
    if (idx === d) return { g, bots };
    g.step(bots); idx++;
  }
  return null;
}
