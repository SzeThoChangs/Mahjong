/** A bot that plays by the solver's advice. Exists to verify the advice in the simulator. */
import { kindOf, type Bot, type ClaimOption, type PlayerView, type SelfAction, type TileInstance, type Meld } from 'sg-mahjong-engine';
import { rankDiscards } from './rank.js';
import { handValue, type Context } from './targets.js';

const ctxOf = (v: PlayerView): Context => ({
  seat: v.seat, prevailingWind: v.prevailingWind, bonus: v.bonus.map(kindOf), playerTurns: v.playerTurns,
  minimumFan: v.config.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: v.config.self_draw_minimum_fan,
});
const meldsOf = (v: PlayerView): Meld[] => v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));

export class CoachBot implements Bot {
  chooseDiscard(v: PlayerView): TileInstance {
    const r = rankDiscards(v.hand.map(kindOf), meldsOf(v), ctxOf(v));
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
  chooseSelfAction(_v: PlayerView, options: SelfAction[]): SelfAction | null {
    return options.find((o) => o.kind === 'win') ?? options.find((o) => o.kind === 'kong4') ?? options.find((o) => o.kind === 'kong1') ?? null;
  }
  chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const win = options.find((o) => o.kind === 'win'); if (win) return win;
    const kong = options.find((o) => o.kind === 'kong3'); if (kong) return kong;
    const ctx = ctxOf(v), melds = meldsOf(v), hand = v.hand.map(kindOf);
    const before = handValue({ concealed: hand, melds }, ctx).chips;
    let best: ClaimOption | null = null, bestGain = 0.4;      // require a real gain to open the hand
    for (const o of options) {
      if (o.kind !== 'pong' && o.kind !== 'chow') continue;
      const used = o.tiles!.map(kindOf);
      const rest = [...hand]; for (const k of used) rest.splice(rest.indexOf(k), 1);
      const dk = kindOf(v.lastDiscard!.tile);
      const meld: Meld = { type: o.kind, tiles: [...used, dk].sort((a, b) => a - b), concealed: false };
      // after claiming we must discard one: take the best resulting 13
      const r = rankDiscards(rest, [...melds, meld], ctx);
      const after = r.best.chips;
      if (after - before > bestGain) { bestGain = after - before; best = o; }
    }
    return best;
  }
}
