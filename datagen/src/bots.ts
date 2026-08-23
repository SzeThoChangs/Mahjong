/**
 * Dumb bot personalities. Simple, rule-based, fast, seeded. They exist to
 * move simulations forward and create varied states - their choices are not
 * labels. Every heuristic bot ranks its legal actions and then picks with
 * controlled randomness (default 70 / 15 / 10 / 5% random).
 */
import {
  kindOf, type Bot, type ClaimOption, type PlayerView, type SelfAction, type TileInstance, type TileKind, type Meld,
} from 'sg-mahjong-engine';
import { discardFeatures, shanten, unseenCounts, type DiscardFeatures } from './features.js';

export type BotType = 'efficiency' | 'aggressive' | 'pong' | 'chow' | 'random';
export const BOT_TYPES: BotType[] = ['efficiency', 'aggressive', 'pong', 'chow', 'random'];

export interface RandomnessConfig { ranked: number[]; random: number }   // e.g. ranked [0.70, 0.15, 0.10], random 0.05
export const DEFAULT_RANDOMNESS: RandomnessConfig = { ranked: [0.70, 0.15, 0.10], random: 0.05 };

/** Pick from a best-first list with controlled randomness. */
export function pickRanked<T>(ranked: T[], rng: () => number, cfg: RandomnessConfig): T {
  if (ranked.length === 1) return ranked[0]!;
  const u = rng();
  if (u < cfg.random) return ranked[Math.floor(rng() * ranked.length)]!;
  let acc = cfg.random;
  for (let i = 0; i < cfg.ranked.length && i < ranked.length; i++) { acc += cfg.ranked[i]!; if (u < acc) return ranked[i]!; }
  return ranked[0]!;
}

const meldsOf = (v: PlayerView): Meld[] => v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));
const unseenOf = (v: PlayerView, extra: TileKind[] = []) => unseenCounts({
  hand: [...v.hand.map(kindOf), ...extra],
  allMelds: v.players.flatMap((p) => p.melds.flatMap((m) => m.tiles)),
  allDiscards: v.discardLog.map((d) => kindOf(d.tile)),
});

/** Personality weights over discard features. Higher = better tile to KEEP... we score the DISCARD, so sign flips below. */
interface Weights { sh: number; rem: number; eff: number; pairs: number; trip: number; seq: number; pseq: number; isoTile: number; honourIso: number; valueTile: number }
const W: Record<Exclude<BotType, 'random'>, Weights> = {
  efficiency: { sh: -100, rem: 2.0, eff: 1.0, pairs: 1, trip: 2, seq: 2, pseq: 0.5, isoTile: 6, honourIso: 3, valueTile: -1 },
  aggressive: { sh: -120, rem: 2.5, eff: 1.0, pairs: 0.5, trip: 1, seq: 1, pseq: 0.5, isoTile: 6, honourIso: 4, valueTile: -1 },
  pong:       { sh: -80,  rem: 1.0, eff: 0.5, pairs: 6, trip: 8, seq: -1, pseq: -2, isoTile: 5, honourIso: -2, valueTile: -4 },
  chow:       { sh: -80,  rem: 1.5, eff: 1.0, pairs: -1, trip: -2, seq: 6, pseq: 3, isoTile: 5, honourIso: 6, valueTile: 0 },
};

/** Score a candidate discard: higher = better to discard now. */
function discardScore(f: DiscardFeatures, w: Weights, ctxValue: (k: TileKind) => boolean): number {
  let s = w.sh * f.sh + w.rem * f.rem + w.eff * f.eff + w.pairs * f.pairs + w.trip * f.trip + w.seq * f.seq + w.pseq * f.pseq;
  if (f.isoTile) s += w.isoTile;
  if (f.hon && f.isoTile) s += w.honourIso;
  if (ctxValue(f.k)) s += w.valueTile;           // dragon / seat wind / prevailing wind: personality-dependent reluctance
  if (f.term && !f.hon) s += 0.5;
  return s;
}

export class HeuristicBot implements Bot {
  constructor(readonly type: Exclude<BotType, 'random'>, private rng: () => number, private randomness: RandomnessConfig = DEFAULT_RANDOMNESS) {}

  private valueTile(v: PlayerView) {
    const role = (v.seat - v.dealer + 4) % 4;              // the host is East; winds rotate with the deal
    return (k: TileKind) => k >= 31 || k === 27 + role || k === 27 + v.prevailingWind;
  }

  chooseDiscard(v: PlayerView): TileInstance {
    const hand = v.hand.map(kindOf);
    const feats = discardFeatures(hand, meldsOf(v), unseenOf(v));
    const w = W[this.type]; const isValue = this.valueTile(v);
    const ranked = feats.map((f) => ({ f, s: discardScore(f, w, isValue) })).sort((a, b) => b.s - a.s).map((x) => x.f.k);
    const k = pickRanked(ranked, this.rng, this.randomness);
    return v.hand.find((t) => kindOf(t) === k)!;
  }

  chooseSelfAction(v: PlayerView, options: SelfAction[]): SelfAction | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    // kongs: rank by whether they keep shanten; personality decides appetite
    const hand = v.hand.map(kindOf); const melds = meldsOf(v);
    const before = shanten(hand, melds.length);
    const ranked: (SelfAction | null)[] = [];
    for (const o of options) {
      if (o.kind === 'kong4') {
        const rest = hand.filter((k) => k !== kindOf(o.tiles[0]!));
        const after = shanten(rest, melds.length + 1);
        const ok = after <= before && this.type !== 'chow';
        if (ok) ranked.push(o);
      } else if (o.kind === 'kong1') ranked.push(o);
    }
    ranked.push(null);
    if (this.type === 'chow') ranked.reverse();        // chow bot prefers not to kong
    return pickRanked(ranked, this.rng, this.randomness);
  }

  chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const hand = v.hand.map(kindOf); const melds = meldsOf(v);
    const dk = kindOf(v.lastDiscard!.tile);
    const before = shanten(hand, melds.length);
    const scored: { o: ClaimOption | null; s: number }[] = [{ o: null, s: 0 }];
    for (const o of options) {
      if (o.kind === 'win') continue;
      const used = o.tiles!.map(kindOf);
      const rest = [...hand]; for (const k of used) rest.splice(rest.indexOf(k), 1);
      // after claiming we discard one: best shanten over discards
      let after = 99;
      for (const k of new Set(rest)) { const r2 = [...rest]; r2.splice(r2.indexOf(k), 1); after = Math.min(after, shanten(r2, melds.length + 1)); }
      const gain = before - after;            // >0 improves
      let s = gain * 10;
      switch (this.type) {
        case 'efficiency': s += gain > 0 ? 2 : -8; if (o.kind === 'kong3') s += 1; break;
        case 'aggressive': s += gain >= 0 ? 5 : -4; if (o.kind === 'kong3') s += 2; break;
        case 'pong':       s += o.kind === 'chow' ? -20 : gain >= 0 ? 6 : -3; if (o.kind === 'kong3') s += 3; break;
        case 'chow':       s += o.kind === 'chow' ? (gain >= 0 ? 6 : -3) : gain > 0 ? -2 : -12; break;
      }
      if (melds.length >= 3 && this.type === 'efficiency') s -= 6;   // third call test: keep some defence
      scored.push({ o, s });
    }
    scored.sort((a, b) => b.s - a.s);
    return pickRanked(scored.map((x) => x.o), this.rng, this.randomness);
  }
}

/** Uniform over legal actions, except it always takes a win (configurable). Exists to create unusual states. */
export class RandomBot implements Bot {
  constructor(private rng: () => number, private alwaysWin = true) {}
  chooseDiscard(v: PlayerView): TileInstance { return v.hand[Math.floor(this.rng() * v.hand.length)]!; }
  chooseSelfAction(_v: PlayerView, options: SelfAction[]): SelfAction | null {
    if (this.alwaysWin) { const w = options.find((o) => o.kind === 'win'); if (w) return w; }
    const all: (SelfAction | null)[] = [...options, null];
    return all[Math.floor(this.rng() * all.length)]!;
  }
  chooseClaim(_v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    if (this.alwaysWin) { const w = options.find((o) => o.kind === 'win'); if (w) return w; }
    const all: (ClaimOption | null)[] = [...options, null];
    return all[Math.floor(this.rng() * all.length)]!;
  }
}

export function makeBot(type: BotType, rng: () => number, randomness: RandomnessConfig = DEFAULT_RANDOMNESS): Bot {
  return type === 'random' ? new RandomBot(rng) : new HeuristicBot(type, rng, randomness);
}
