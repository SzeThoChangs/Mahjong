/** Baseline bots. Not strategy - just legal, deterministic-with-seed play for engine verification. */
import type { Bot, ClaimOption, PlayerView, SelfAction } from './game.js';
import { isHonour, isSuited, kindOf, rankOf, suitOf, type TileInstance, type TileKind } from './tiles.js';
import { shanten } from './shanten.js';

/** Random legal play. Always wins when able, always kongs, pongs/chows with fixed probability. */
export class RandomBot implements Bot {
  protected rng: () => number; private pongP: number; private chowP: number;
  constructor(rng: () => number, pongP = 0.6, chowP = 0.4) { this.rng = rng; this.pongP = pongP; this.chowP = chowP; }
  chooseDiscard(v: PlayerView): TileInstance { return v.hand[Math.floor(this.rng() * v.hand.length)]!; }
  chooseSelfAction(_v: PlayerView, options: SelfAction[]): SelfAction | null {
    return options.find((o) => o.kind === 'win') ?? options[0] ?? null;
  }
  chooseClaim(_v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kong = options.find((o) => o.kind === 'kong3'); if (kong) return kong;
    const pong = options.find((o) => o.kind === 'pong'); if (pong && this.rng() < this.pongP) return pong;
    const chow = options.find((o) => o.kind === 'chow'); if (chow && this.rng() < this.chowP) return chow;
    return null;
  }
}

/**
 * Discards the most isolated tile (fewest neighbours in hand). Honours with no
 * pair go first. A step up from random; still no target selection.
 */
export class IsolationBot extends RandomBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    let best: TileInstance = v.hand[0]!, bestScore = Infinity;
    const kinds = v.hand.map(kindOf);
    for (const t of v.hand) {
      const k = kindOf(t);
      let s = 0;
      const same = kinds.filter((x) => x === k).length;
      s += (same - 1) * 3;                      // pair / triplet potential
      if (isSuited(k)) {
        const r = rankOf(k), su = suitOf(k);
        for (const x of kinds) if (x !== k && suitOf(x) === su) { const d = Math.abs(rankOf(x) - r); if (d === 1) s += 2; else if (d === 2) s += 1; }
        if (r === 1 || r === 9) s -= 0.5;       // edge tiles are weaker
      } else if (isHonour(k)) {
        if (same === 1) s -= 1;                 // lone honour: dump early
      }
      if (s < bestScore) { bestScore = s; best = t; }
    }
    return best;
  }
}

/**
 * Shanten-greedy rollout policy: discard the tile that leaves the lowest shanten (ties: most isolated),
 * claim only when it lowers shanten, always win, kong when it keeps shanten. ~0.1 ms per decision.
 */
export class ShantenBot extends IsolationBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const kinds = v.hand.map(kindOf); const m = v.melds.length;
    let best: TileInstance = v.hand[0]!, bestSh = 99, bestIso = -Infinity;
    const seen = new Set<TileKind>();
    for (const t of v.hand) {
      const k = kindOf(t); if (seen.has(k)) continue; seen.add(k);
      const rest = [...kinds]; rest.splice(rest.indexOf(k), 1);
      const sh = shanten(rest, m);
      if (sh < bestSh) { bestSh = sh; best = t; bestIso = this.isolation(k, kinds); }
      else if (sh === bestSh) { const iso = this.isolation(k, kinds); if (iso > bestIso) { bestIso = iso; best = t; } }
    }
    return best;
  }
  /** higher = more isolated = better to throw */
  private isolation(k: TileKind, kinds: TileKind[]): number {
    const same = kinds.filter((x) => x === k).length;
    let s = -(same - 1) * 3;
    if (isSuited(k)) { const r = rankOf(k), su = suitOf(k); for (const x of kinds) if (x !== k && suitOf(x) === su) { const d = Math.abs(rankOf(x) - r); if (d === 1) s -= 2; else if (d === 2) s -= 1; } if (r === 1 || r === 9) s += 0.5; }
    else if (isHonour(k) && same === 1) s += 1;
    return s;
  }
  override chooseSelfAction(v: PlayerView, options: SelfAction[]): SelfAction | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kinds = v.hand.map(kindOf); const before = shanten(kinds, v.melds.length);
    for (const o of options) {
      if (o.kind === 'kong1') return o;
      if (o.kind === 'kong4') { const rest = kinds.filter((k) => k !== kindOf(o.tiles[0]!)); if (shanten(rest, v.melds.length + 1) <= before) return o; }
    }
    return null;
  }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kinds = v.hand.map(kindOf); const m = v.melds.length; const before = shanten(kinds, m);
    let best: ClaimOption | null = null, bestSh = before;
    for (const o of options) {
      if (o.kind === 'win') continue;
      const rest = [...kinds]; for (const t of o.tiles!) rest.splice(rest.indexOf(kindOf(t)), 1);
      let after = 99; const seen = new Set<TileKind>();
      for (const k of rest) { if (seen.has(k)) continue; seen.add(k); const r2 = [...rest]; r2.splice(r2.indexOf(k), 1); after = Math.min(after, shanten(r2, m + 1)); }
      if (o.kind === 'kong3') after -= 0.5;       // kongs pay; slight preference
      if (after < bestSh) { bestSh = after; best = o; }
    }
    return best;
  }
}
