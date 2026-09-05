/**
 * Deals a quiz scenario by playing a real (simulated) game with baseline bots
 * and stopping at a genuine discard decision in the requested phase.
 */
import {
  Wall, makeRng, playGame, IsolationBot, kindOf, makeRules,
  type PlayerView, type TileInstance, type TileKind, type Meld, type TableConfig, type RulesConfig,
} from 'sg-mahjong-engine';
import { rankDiscards, suggestCause, type Ranking, type Context, type Cause } from 'sg-mahjong-solver';
import tableConfig from '../../../data/table.config.json';

/** seat winds by ROLE (distance from the host), for naming an opponent in the advice */
const WIND_NAME = ['\u6771', '\u5357', '\u897f', '\u5317'];

export type Phase = 'early' | 'mid' | 'late' | 'any';
export const PHASE_TURNS: Record<Exclude<Phase, 'any'>, [number, number]> = { early: [1, 15], mid: [16, 35], late: [36, 60] };

export const CONFIG: TableConfig = {
  minimum_fan: tableConfig.minimum_fan, fan_limit: tableConfig.fan_limit, self_draw_minimum_fan: tableConfig.self_draw_minimum_fan,
  immediate_payouts_multiplier: tableConfig.immediate_payouts_multiplier, unplayable_tiles: 15,
};

/**
 * The table's FULL house rules, not just its fan limits - bao, special hands, and above all
 * `jokers.count`. This tab used to deal with the engine defaults and no wildcards at all, so the
 * hands it asked about were a different game from the one the Real quiz and Film room record.
 *
 * The node loader (`sg-mahjong-engine/node`) cannot be used here: it reads the file with node:fs
 * and this bundle must stay browser-only. Vite inlines the JSON instead and `makeRules` - which is
 * pure - does the same deep merge over the defaults.
 */
const { _note: _drop, ...RULES_OVERRIDE } = tableConfig.rules as Record<string, unknown>;
export const RULES: RulesConfig = makeRules({
  ...RULES_OVERRIDE,
  minimum_tai: tableConfig.minimum_fan,
  maximum_tai: tableConfig.fan_limit,
  self_draw_minimum_tai: tableConfig.self_draw_minimum_fan,
});
/** wildcards in the wall, from the table config (4 at this table) */
export const JOKERS = RULES.jokers.count;

export type Difficulty = 'toss-up' | 'plain' | 'trap';

export interface Scenario {
  id: number;
  phase: Exclude<Phase, 'any'>;
  seat: number; dealer: number; prevailingWind: number; playerTurns: number;
  hand: TileKind[];          // 14 concealed, drawn tile last if any
  drawn: TileKind | null;
  melds: Meld[];
  bonus: TileKind[];
  ranking: Ranking;           // the book coach - now the EXPLAINER, not the grader
  interesting: boolean;
  /**
   * What kind of question this is, judged by the coach.
   *
   * `toss-up`  several tiles are equal-best, so there is nothing to get right. Not worth asking.
   * `plain`    there is a clear best tile and it is the obvious one. Worth playing, teaches little.
   * `trap`     there is a clear best tile and the obvious throw is NOT it. This is the one to keep.
   */
  difficulty: Difficulty;
  /** chips between the coach's best tile and its runner-up: what getting it wrong actually costs */
  gap: number;
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
  const wall = new Wall(makeRng(seed * 7919 + 1), CONFIG.unplayable_tiles, JOKERS);
  const bots = [0, 1, 2, 3].map(() => new IsolationBot(makeRng(seed * 31 + 7)));
  try {
    playGame(bots, CONFIG, wall, {
      dealer: seed % 4, prevailingWind: Math.floor(seed / 4) % 4, rules: RULES,
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
  let decidedFallback: Scenario | null = null;   // has a right answer, but the obvious tile is it
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
    const ctx: Context = { seat: (view.seat - view.dealer + 4) % 4, prevailingWind: view.prevailingWind, bonus, playerTurns: view.playerTurns, minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan, visible,
      opponentMelds: view.players.map((p2, s2) => (s2 === view.seat ? -1 : p2.melds.length)).filter((n) => n >= 0),
      opponents: view.players.flatMap((p2, s2) => (s2 === view.seat ? [] : [{
        label: WIND_NAME[(s2 - view.dealer + 4) % 4]!,
        melds: p2.melds.map((m) => m.tiles),
        discards: discards.filter((d) => d.seat === s2).map((d) => d.kind),
      }])) };
    const ranking = rankDiscards(hand, melds, ctx);
    const naive = new IsolationBot(makeRng(1)).chooseDiscard(view);
    const naivePick = kindOf(naive);
    // ---- is this hand worth asking, and what KIND of question is it? ----
    //
    // Two different things were being called "interesting" and only one of them is difficulty.
    //
    // First, is there a right answer at all? If several tiles are equal-best the question is not
    // hard, it is unanswerable, and asking it teaches nothing but doubt. Second, is the answer the
    // one you would reach for anyway? A hand where the lazy throw is also the correct throw teaches
    // nothing either. A question needs BOTH: a real answer, and a real reason to miss it.
    //
    // Both now come from the COACH. Selection used to key off the learned model while the scoring
    // keyed off the coach, so the app chose your hands by one standard and marked them by another -
    // and the model is the one that loses 0.544 chips a game.
    //
    // The threshold is the coach's own: it calls a throw within 0.75 chips of best "also fine", so
    // a runner-up further off than that is genuinely a mistake. Borrowing the existing boundary
    // keeps this from being one more invented constant.
    const runnerUp = ranking.options[1];
    const gap = runnerUp ? ranking.best.chips - runnerUp.chips : Infinity;
    const decided = ranking.tied.length === 1 && gap >= 0.75;
    const trap = naivePick !== ranking.best.tile;
    const difficulty: Difficulty = !decided ? 'toss-up' : trap ? 'trap' : 'plain';
    const interesting = difficulty === 'trap';
    const sc: Scenario = { id: seed, phase: ph, seat: view.seat, dealer: view.dealer, prevailingWind: view.prevailingWind, playerTurns: view.playerTurns, hand, drawn: drawn === null ? null : kindOf(drawn), melds, bonus, ranking, interesting, difficulty, gap, naivePick, discards, publicMelds, publicBonus };
    if (!wantInteresting) return sc;
    // Prefer a trap, settle for a hand that at least HAS an answer, and only serve a toss-up when
    // sixteen deals produced nothing better. A plain yes/no test starved this: measured over 250
    // deals, 2% are traps, 8% are plain and 90% are toss-ups, because the median hand's runner-up
    // is only 0.14 chips behind the best. That is not a flaw in the test - most discards genuinely
    // have no answer worth asking about, which is the same 4%-separable wall the evaluator hits.
    if (sc.difficulty === 'trap') return sc;
    if (sc.difficulty === 'plain') decidedFallback ??= sc;
    fallback ??= sc;
  }
  if (decidedFallback) return decidedFallback;
  if (fallback) return fallback;
  throw new Error('could not generate a scenario');
}


/**
 * What a position TEACHES, in the record's own vocabulary.
 *
 * A trap is a hand where the tempting throw is wrong. The mistake record sorts every mistake by
 * why it happened, using `suggestCause` on the tile you threw against the coach's. Run that same
 * function on the tempting throw instead and a generated position gets the same label before
 * anybody has thrown anything: this is a hand where the lazy throw is a safety misjudgement, or a
 * wrong plan, or a shape you have to see. A position that is not a trap teaches no cause.
 */
export function causeOf(sc: Scenario): Cause | null {
  if (sc.difficulty !== 'trap') return null;
  return suggestCause(sc.hand, sc.melds, {
    bonus: sc.bonus, seat: (sc.seat - sc.dealer + 4) % 4, prevailingWind: sc.prevailingWind, melds: sc.melds,
    minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
  }, sc.ranking.options, sc.naivePick, sc.ranking.best.tile).suggested;
}

/**
 * Draw a position that teaches `cause`, starting from `seed` and walking forward.
 *
 * This is the method's eighth idea turned into practice: the record says which cause keeps coming
 * up, and this hands you hands where exactly that cause bites. It walks seeds rather than captures
 * so the Train tab's "next" stays a seed, and it gives up after `maxSeeds` and returns the best
 * trap it saw, because a practice screen that hangs teaches nothing.
 */
export function makeScenarioFor(seed: number, phase: Phase, cause: Cause, maxSeeds = 40): { scenario: Scenario; seed: number; matched: boolean } {
  let anyTrap: { scenario: Scenario; seed: number } | null = null;
  let first: { scenario: Scenario; seed: number } | null = null;
  for (let s = seed; s < seed + maxSeeds; s++) {
    // a seed whose sixteen captures all fail throws; walking many seeds will meet one, so skip it
    let sc: Scenario; try { sc = makeScenario(s, phase, true); } catch { continue; }
    first ??= { scenario: sc, seed: s };
    if (sc.difficulty !== 'trap') continue;
    if (causeOf(sc) === cause) return { scenario: sc, seed: s, matched: true };
    anyTrap ??= { scenario: sc, seed: s };
  }
  const fb = anyTrap ?? first;
  if (fb) return { ...fb, matched: false };
  return { scenario: makeScenario(seed + maxSeeds, phase, true), seed: seed + maxSeeds, matched: false };
}

/**
 * The causes a position can be built for. The other four - never learnt it, never considered the
 * tile, missed a tile on the table, knew and threw something else - are about the player and not
 * the hand, and no deal can be labelled with them. Practising "any trap" is the honest offer there.
 */
export const PRACTISABLE: Cause[] = ['not-seen', 'miscounted', 'misjudged-safety', 'wrong-plan'];
