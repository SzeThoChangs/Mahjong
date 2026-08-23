/** Compact, serialisable records. Tiles are numeric kinds (0..45); see engine/src/tiles.ts for the layout. */
import { kindOf, type Decision, type InstMeld, type LegalAction, type TileKind } from 'sg-mahjong-engine';
import type { BotType } from './bots.js';
import { discardFeatures, shanten, unseenCounts, type DiscardFeatures } from './features.js';

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
/** compact action string; instance ids are engine-internal and dropped */
export function encAction(a: LegalAction): string {
  switch (a.a) {
    case 'discard': return `d:${a.kind}`;
    case 'kong4': case 'kong1': case 'kong3': case 'pong': return `${a.a}:${a.kind}`;
    case 'chow': return `chow:${a.kinds.join(',')}`;
    default: return a.a;
  }
}

export interface HandRecord {
  g: number; h: number; seed: number; dl: number; w: number;
  bots: BotType[];
  winner: number | null; sd: boolean; disc: number | null; fan: number | null; combo: string | null;
  turns: number; cnt: { chow: number; pong: number; kong: number; flowers: number; animals: number; decisions: number; illegal: number };
  delta: number[]; scores: number[];                       // this hand's chips delta; session scores after
  acts: Record<string, Record<string, number>>;            // bot type -> action -> count
  hash: string;                                            // FNV-1a over the decision sequence (for replay checks)
}
export interface TruthRecord { g: number; h: number; seed: number; dl: number; w: number; wall: number[]; }

/** FNV-1a 32-bit over a string, hex */
export function fnv1a(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
