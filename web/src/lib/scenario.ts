/**
 * Deals a quiz scenario by playing a real (simulated) game with baseline bots
 * and stopping at a genuine discard decision in the requested phase.
 */
import {
  Wall, makeRng, playGame, IsolationBot, kindOf, type PlayerView, type TileInstance, type TileKind, type Meld, type TableConfig,
} from 'sg-mahjong-engine';
import { rankDiscards, type Ranking, type Context } from 'sg-mahjong-solver';
import tableConfig from '../../../data/table.config.json';

export type Phase = 'early' | 'mid' | 'late' | 'any';
export const PHASE_TURNS: Record<Exclude<Phase, 'any'>, [number, number]> = { early: [1, 15], mid: [16, 35], late: [36, 60] };

export const CONFIG: TableConfig = {
  minimum_fan: tableConfig.minimum_fan, fan_limit: tableConfig.fan_limit, self_draw_minimum_fan: tableConfig.self_draw_minimum_fan,
  immediate_payouts_multiplier: tableConfig.immediate_payouts_multiplier, unplayable_tiles: 15,
};

export interface Scenario {
  id: number;
  phase: Exclude<Phase, 'any'>;
  seat: number; dealer: number; prevailingWind: number; playerTurns: number;
  hand: TileKind[];          // 14 concealed, drawn tile last if any
  drawn: TileKind | null;
  melds: Meld[];
  bonus: TileKind[];
  ranking: Ranking;
  interesting: boolean;
  naivePick: TileKind;       // what the baseline bot would discard
  discards: { seat: number; kind: TileKind; claimed: boolean }[];   // the pool, in order thrown
  publicMelds: Meld[][];     // per seat, exposed sets (empty for the player's own seat)
  publicBonus: TileKind[][]; // per seat, flowers and animals
}

class Stop { view: PlayerView; drawn: TileInstance | null; constructor(view: PlayerView, drawn: TileInstance | null) { this.view = view; this.drawn = drawn; } }

function capture(seed: number, phase: Exclude<Phase, 'any'>): { view: PlayerView; drawn: TileInstance | null } | null {
  const rng = makeRng(seed);
  const [lo, hi] = PHASE_TURNS[phase];
  const targetTurn = lo + Math.floor(rng() * (hi - lo + 1));
  const targetSeat = Math.floor(rng() * 4);
  const wall = new Wall(makeRng(seed * 7919 + 1), CONFIG.unplayable_tiles);
  const bots = [0, 1, 2, 3].map(() => new IsolationBot(makeRng(seed * 31 + 7)));
  try {
    playGame(bots, CONFIG, wall, {
      dealer: seed % 4, prevailingWind: Math.floor(seed / 4) % 4,
      onDiscardDecision: (v, drawn) => {
        if (v.seat === targetSeat && v.playerTurns >= targetTurn && v.hand.length % 3 === 2) {
          // snapshot: the view holds live arrays
          throw new Stop({
            ...v, hand: [...v.hand], melds: v.melds.map((m) => ({ ...m, tiles: [...m.tiles], instances: [...m.instances] })), bonus: [...v.bonus],
            // the table is live too, and the coach needs it to know which tiles are already dead
            discardLog: v.discardLog.map((e) => ({ ...e })),
            players: v.players.map((p) => ({ ...p, melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles] })), bonus: [...p.bonus] })),
          } as PlayerView, drawn);
        }
      },
    });
  } catch (e) { if (e instanceof Stop) return { view: e.view, drawn: e.drawn }; throw e; }
  return null; // game ended before the target turn
}

export function makeScenario(seed: number, phase: Phase, wantInteresting: boolean): Scenario {
  const ph: Exclude<Phase, 'any'> = phase === 'any' ? (['early', 'mid', 'late'] as const)[seed % 3]! : phase;
  let fallback: Scenario | null = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const cap = capture(seed * 101 + attempt, ph);
    if (!cap) continue;
    const { view, drawn } = cap;
    const hand = view.hand.map(kindOf);
    const melds: Meld[] = view.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }));
    const bonus = view.bonus.map(kindOf);
    // everything face-up that is not this player's own hand or melds: the discard pool, the other
    // seats' exposed sets, and every flower/animal on the table
    const discards = view.discardLog.map((e) => ({ seat: e.seat, kind: kindOf(e.tile), claimed: e.claimedBy !== null && e.claimedBy !== undefined }));
    const publicMelds: Meld[][] = view.players.map((p, s) => (s === view.seat ? [] : p.melds.map((m) => ({ type: m.type, tiles: m.tiles, concealed: m.concealed }))));
    const publicBonus: TileKind[][] = view.players.map((p, s) => (s === view.seat ? [] : p.bonus.map(kindOf)));
    const visible: TileKind[] = [
      ...discards.map((d) => d.kind),
      ...publicMelds.flatMap((ms) => ms.flatMap((m) => m.tiles)),
      ...publicBonus.flat(),
    ];
    const ctx: Context = { seat: (view.seat - view.dealer + 4) % 4, prevailingWind: view.prevailingWind, bonus, playerTurns: view.playerTurns, minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan, visible };
    const ranking = rankDiscards(hand, melds, ctx);
    const naive = new IsolationBot(makeRng(1)).chooseDiscard(view);
    const naivePick = kindOf(naive);
    const hasWrongAnswers = ranking.options.some((o) => o.verdict === 'mistake' || o.verdict === 'blunder');
    const interesting = hasWrongAnswers && (naivePick !== ranking.best.tile || ranking.best.target.id !== 'chicken');
    const sc: Scenario = { id: seed, phase: ph, seat: view.seat, dealer: view.dealer, prevailingWind: view.prevailingWind, playerTurns: view.playerTurns, hand, drawn: drawn === null ? null : kindOf(drawn), melds, bonus, ranking, interesting, naivePick, discards, publicMelds, publicBonus };
    if (!wantInteresting) return sc;
    if (interesting) return sc;
    fallback ??= sc;
  }
  if (fallback) return fallback;
  throw new Error('could not generate a scenario');
}
