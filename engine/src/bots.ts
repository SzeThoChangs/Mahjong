/** Baseline bots. Not strategy - just legal, deterministic-with-seed play for engine verification. */
import type { Bot, ClaimOption, PlayerView, SelfAction } from './game.js';
import { isHonour, isSuited, kindOf, rankOf, suitOf, type TileInstance } from './tiles.js';

/** Random legal play. Always wins when able, always kongs, pongs/chows with fixed probability. */
export class RandomBot implements Bot {
  constructor(private rng: () => number, private pongP = 0.6, private chowP = 0.4) {}
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
