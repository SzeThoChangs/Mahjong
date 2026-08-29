/** How often the fold rule fires, and how often the bonus route keeps a hand alive. */
import { Wall, playGame, makeRng, kindOf, type Bot, type PlayerView, type TileInstance, type Meld } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { rankDiscards } from './rank.js';
import { bonusFanChance, handValue, type Context } from './targets.js';
import { CoachBot } from './bot.js';

const cfg = loadTableConfig(), rules = loadTableRules();
const n = Number(process.argv[2] ?? 300);
let decisions = 0, folds = 0, savedByBonus = 0, foldHands = new Set<string>();

const ctxOf = (v: PlayerView): Context => ({
  seat: (v.seat - v.dealer + 4) % 4, prevailingWind: v.prevailingWind, bonus: v.bonus.map(kindOf), playerTurns: v.playerTurns,
  minimumFan: v.config.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: v.config.self_draw_minimum_fan,
  wallRemaining: v.wallRemaining,
  visible: [...v.discardLog.map((d) => kindOf(d.tile)), ...v.players.flatMap((p, s) => (s === v.seat ? [] : p.melds.flatMap((m) => m.tiles)))],
  opponentMelds: v.players.map((p, s) => (s === v.seat ? -1 : p.melds.length)).filter((x) => x >= 0),
});
const meldsOf = (v: PlayerView): Meld[] => v.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));

class Watch extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const ctx = ctxOf(v), melds = meldsOf(v), hand = v.hand.map(kindOf);
    const r = rankDiscards(hand, melds, ctx, { fold: true });
    decisions++;
    if (r.folding) { folds++; foldHands.add(`${v.seat}`); }
    else {
      // would it have been dead without the bonus route?
      const bare = { ...ctx, wallRemaining: undefined };
      const deadBare = [...new Set(hand)].every((k) => {
        const rest = [...hand]; rest.splice(rest.indexOf(k), 1);
        return handValue({ concealed: rest, melds }, bare).all.every((t) => !t.armed);
      });
      if (deadBare) savedByBonus++;
    }
    void bonusFanChance;
    return v.hand.find((t) => kindOf(t) === r.best.tile)!;
  }
}

for (let g = 0; g < n; g++) {
  const wall = new Wall(makeRng(11 * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count);
  const bots: Bot[] = [0, 1, 2, 3].map(() => new Watch());
  playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
}
console.log(`${n} games, ${decisions} coach discard decisions`);
console.log(`  fold rule fired          : ${folds} (${(100 * folds / decisions).toFixed(2)}%)`);
console.log(`  bonus route kept alive   : ${savedByBonus} (${(100 * savedByBonus / decisions).toFixed(2)}%) - dead without it`);
