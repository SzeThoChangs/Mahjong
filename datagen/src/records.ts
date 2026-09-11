/** Compact, serialisable records. Tiles are numeric kinds (0..45); see engine/src/tiles.ts for the layout. */
import { kindOf, type Decision, type InstMeld, type TileKind } from 'sg-mahjong-engine';
import { encAction } from 'sg-mahjong-solver';
import type { BotType } from './bots.js';
import { discardFeatures, shanten, unseenCounts, type DiscardFeatures } from 'sg-mahjong-engine';

/** meld -> [type(0 chow,1 pong,2 kong), concealed(0/1), ...kinds] */
export const encMeld = (m: InstMeld | { type: string; tiles: TileKind[]; concealed: boolean }): number[] =>
  [m.type === 'chow' ? 0 : m.type === 'pong' ? 1 : 2, m.concealed ? 1 : 0, ...m.tiles];

export interface DecisionRecord {
  g: number; h: number; d: number; seed: number;           // session id, hand index, decision index, hand seed
  k: 'self' | 'discard' | 'claim';
  t: number; p: number; dl: number; w: number;             // player turns, acting seat, dealer, prevailing wind
  sc: number[];                                            // session scores before this hand (per seat)
  ch: number[];                                            // chips moved within this hand so far (per seat)
  rem: number;                                             // drawable tiles remaining
  me: { h: TileKind[]; dr: TileKind | null; b: TileKind[]; m: number[][] };
  pub: { dl: number[][]; m: number[][][]; b: TileKind[][] }; // discard log [seat,kind,claimedBy|-1,claimKind], melds per seat, bonus per seat
  legal: string[];                                         // compact actions: "d:5" "win" "kong4:12" "kong1:12" "proceed" "pass" "pong:7" "kong3:7" "chow:3,4,5"
  sel: string;
  bot: BotType;
  f: unknown;                                              // features: discard -> DiscardFeatures[]; self/claim -> { sh }
}

export function encodeDecision(d: Decision, meta: { g: number; h: number; d: number; seed: number; sc: number[]; bot: BotType }): DecisionRecord {
  const v = d.view;
  const hand = v.hand.map(kindOf);
  const melds = v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));
  let f: unknown;
  if (d.kind === 'discard') {
    const unseen = unseenCounts({ hand, allMelds: v.players.flatMap((p) => p.melds.flatMap((m) => m.tiles)), allDiscards: v.discardLog.map((x) => kindOf(x.tile)) });
    const feats: DiscardFeatures[] = discardFeatures(hand, melds, unseen);
    f = feats;
  } else {
    f = { sh: shanten(hand, melds.length) };
  }
  return {
    g: meta.g, h: meta.h, d: meta.d, seed: meta.seed, k: d.kind,
    t: v.playerTurns, p: d.seat, dl: v.dealer, w: v.prevailingWind, sc: meta.sc, ch: v.players.map((p) => p.chips), rem: v.wallRemaining,
    me: { h: hand, dr: d.drawn === null ? null : kindOf(d.drawn), b: v.bonus.map(kindOf), m: v.melds.map(encMeld) },
    pub: {
      dl: v.discardLog.map((e) => [e.seat, kindOf(e.tile), e.claimedBy ?? -1, e.claimKind === null ? 0 : e.claimKind === 'chow' ? 1 : e.claimKind === 'pong' ? 2 : e.claimKind === 'kong3' ? 3 : 4]),
      m: v.players.map((p) => p.melds.map(encMeld)),
      b: v.players.map((p) => p.bonus.map(kindOf)),
    },
    legal: d.legal.map(encAction), sel: encAction(d.selected), bot: meta.bot, f,
  };
}
/** compact action strings and the hash that keys every seed: the solver's, so the phone and the
 *  Mac agree on both to the bit */
export { encAction, fnv1a } from 'sg-mahjong-solver';

export interface HandRecord {
  g: number; h: number; seed: number; dl: number; w: number;
  bots: BotType[];
  winner: number | null; sd: boolean; disc: number | null; fan: number | null; combo: string | null;
  turns: number; cnt: { chow: number; pong: number; kong: number; flowers: number; animals: number; decisions: number; illegal: number };
  delta: number[]; scores: number[];                       // this hand's chips delta; session scores after
  led: number[][];                                         // per seat: [kongConcealed, kongExposed, kongFed, biteFH, biteFO, biteAH, biteAO] signed unit counts
  liable: number | null;
  draws: number[];                                         // tiles drawn per seat
  blocked: number[];                                       // complete hands per seat that were under the table minimum
  ready: number[];                                         // turn each seat first became one away (-1 never)
  wt: number;                                              // the winning tile kind (-1 if drawn game)
  acts: Record<string, Record<string, number>>;            // bot type -> action -> count
  hash: string;                                            // FNV-1a over the decision sequence (for replay checks)
  /**
   * Every action taken in this hand, in order, as compact strings.
   *
   * Replay used to work by asking the BOTS again what they would do, which welds a dataset to the
   * exact bots that made it: change one coach rule and 17 of every 100 hands stop replaying, because
   * a hand is ~50 decisions and one difference anywhere breaks the hash. Measured, not guessed.
   * Playing the recorded actions back instead makes a run independent of the bots forever.
   *
   * Optional, because runs generated before 2026-09-02 do not have it and fall back to the bots.
   */
  seq?: string[];
}
export interface TruthRecord { g: number; h: number; seed: number; dl: number; w: number; wall: number[]; }
