/**
 * Reconstruct a recorded position and re-sample its hidden information.
 *
 *  positionAt(hand, d)        -> GameState exactly at decision d (ground truth, via replay)
 *  determinize(g, seat, rng)  -> a copy where everything `seat` cannot see is re-dealt at random,
 *                                consistent with the visible state (hand sizes, melds, bonus, discards, wall size)
 */
import { GameState, Wall, makeRng, tableConfigOf, isBonus, kindOf, type RulesConfig, type Bot, type Snapshot, type TileInstance } from 'sg-mahjong-engine';
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

/** Re-deal everything `seat` cannot see. Returns a new Snapshot (the input state is untouched). */
export function determinize(g: GameState, seat: number, rng: () => number): Snapshot {
  const snap = g.snapshot();
  const visible = new Set<TileInstance>();
  for (const p of snap.players) {
    if (p.seat === seat) for (const t of p.hand) visible.add(t);
    for (const m of p.melds) for (const t of m.instances) visible.add(t);
    for (const t of p.bonus) visible.add(t);
    for (const t of p.discards) visible.add(t);
  }
  // tiles already drawn from the wall but not visible are exactly the opponents' concealed tiles;
  // the unseen pool = everything not visible
  const unseen: TileInstance[] = [];
  for (const t of snap.wall.order) if (!visible.has(t)) unseen.push(t);     // the wall order holds every tile in this game (148 or 152)
  for (let i = unseen.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [unseen[i], unseen[j]] = [unseen[j]!, unseen[i]!]; }
  // opponents' hands: standard tiles only (bonus tiles would have been exposed on draw)
  const standard = unseen.filter((t) => !isBonus(kindOf(t)));
  const bonus = unseen.filter((t) => isBonus(kindOf(t)));
  let si = 0;
  for (const p of snap.players) {
    if (p.seat === seat) continue;
    const n = p.hand.length;
    p.hand = standard.slice(si, si + n); si += n;
  }
  // the rest fills the wall's live region [front..back] in random order (bonus tiles mixed back in)
  const rest = [...standard.slice(si), ...bonus];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j]!, rest[i]!]; }
  const { front, back } = snap.wall;
  if (rest.length !== back - front + 1) throw new Error(`determinize: unseen ${rest.length} != wall region ${back - front + 1}`);
  const order = [...snap.wall.order];
  for (let i = 0; i < rest.length; i++) order[front + i] = rest[i]!;
  snap.wall = { ...snap.wall, order };
  if (snap.phase === 'claim') {
    // other seats' queued claim options referenced their old tiles, and their (hidden) intentions must be re-decided:
    // rebuild the claim phase from the visible facts, with the acting seat asked first.
    const h = GameState.fromSnapshot(snap, tableConfigOf(g.rules), { rules: g.rules });
    h.rebuildClaims(seat);
    return h.snapshot();
  }
  return snap;
}
