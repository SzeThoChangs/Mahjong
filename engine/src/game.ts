/**
  * One hand of Singapore Mahjong. Types + the `playGame` convenience wrapper; the phase machine lives in state.ts.
 *
 *   draw -> self -> discard -> (claim?) -> next player's draw
 *                 ^                |
 *                 |   kong -> replacement draw -> self
 *                 |   pong/chow -> claimant's discard
 *
 * Implements: deal with bonus replacement and immediate payouts, self-draw
 * win, win on discard, Pong / Chow (right-hand opponent only) / Kong-1 /
 * Kong-3 / Kong-4 with replacement draws, claim priority (Win > Kong-3 >
 * Pong > Chow, nearest counterclockwise breaks ties), the rolling
 * prohibited-discard rule, the unplayable reserve, draw games, last-tile and
 * replacement-tile Fan, and the table's minimum-Fan rules.
 *
 * Every bot decision can be recorded (visible state + legal actions + chosen
 * action) with lazy access to ground truth. See `Recorder`.
 *
 * NOT yet: Pay-All liability, robbing the kong, eight-flower special win.
 */
import type { Wall } from './wall.js';
import type { TileInstance, TileKind } from './tiles.js';
import type { Meld, ScoreResult } from './score.js';
import type { TableConfig } from './payout.js';
import type { RulesConfig } from './rules.js';
import { GameState } from './state.js';

export interface InstMeld extends Meld { instances: TileInstance[]; }

export interface PlayerState {
  seat: number;
  hand: TileInstance[];
  melds: InstMeld[];
  bonus: TileInstance[];
  discards: TileInstance[];
  lastDiscardKind: TileKind | null;
  seenSinceLastDiscard: Set<TileKind>;
  chips: number;
}

export type ClaimKind = 'win' | 'kong3' | 'pong' | 'chow';
export interface ClaimOption { kind: ClaimKind; seat: number; tiles?: TileInstance[]; score?: ScoreResult }
export type SelfAction =
  | { kind: 'win'; score: ScoreResult }
  | { kind: 'kong4'; tiles: TileInstance[] }
  | { kind: 'kong1'; meld: InstMeld; tile: TileInstance };

export interface DiscardEvent { seat: number; tile: TileInstance; claimedBy: number | null; claimKind: ClaimKind | null; turn: number }

/** Everything the acting player may legitimately see. */
export interface PlayerView {
  seat: number;
  hand: TileInstance[];
  melds: InstMeld[];
  bonus: TileInstance[];
  players: { melds: InstMeld[]; bonus: TileInstance[]; discards: TileInstance[]; chips: number }[];
  prevailingWind: number;
  dealer: number;
  wallRemaining: number;
  playerTurns: number;
  lastDiscard: { tile: TileInstance; from: number } | null;
  /** every discard this hand, in order, with who claimed it (public) */
  discardLog: DiscardEvent[];
  config: TableConfig;
  /** The tiles this seat may actually THROW - `hand` minus anything the table forbids discarding
   *  (a wildcard, at most tables). A bot that picks freely must pick from here, not from `hand`. */
  legalDiscards: TileInstance[];
}

/** Simulator ground truth. For replay/debugging/evaluation only. */
export interface GroundTruth {
  hands: TileInstance[][];
  wall: { order: TileInstance[]; front: number; back: number; unplayable: number };
  dealer: number; prevailingWind: number;
}

export interface Bot {
  chooseDiscard(view: PlayerView): TileInstance;
  chooseSelfAction(view: PlayerView, options: SelfAction[]): SelfAction | null;
  chooseClaim(view: PlayerView, options: ClaimOption[]): ClaimOption | null;
}

/** Structured, serialisable legal actions. */
export type LegalAction =
  | { a: 'discard'; tile: TileInstance; kind: TileKind }
  | { a: 'win' } | { a: 'kong4'; kind: TileKind } | { a: 'kong1'; kind: TileKind } | { a: 'proceed' }
  | { a: 'pass' } | { a: 'pong'; kind: TileKind } | { a: 'kong3'; kind: TileKind } | { a: 'chow'; kinds: TileKind[] };

export type DecisionKind = 'self' | 'discard' | 'claim';
export interface Decision {
  kind: DecisionKind;
  seat: number;
  view: PlayerView;
  legal: LegalAction[];
  selected: LegalAction;
  drawn: TileInstance | null;          // tile just drawn (self/discard decisions), null after a claim
  truth: () => GroundTruth;
}
export interface Recorder { record(d: Decision): void; }

/** Signed COUNT of each configurable amount a seat received (+) or paid (-).
 *  Lets any money schedule be re-priced later without replaying the hand. */
export interface Ledger {
  kongConcealed: number; kongExposed: number; kongFed: number;
  biteFlowerHidden: number; biteFlowerOpen: number; biteAnimalHidden: number; biteAnimalOpen: number;
}
export const emptyLedger = (): Ledger => ({ kongConcealed: 0, kongExposed: 0, kongFed: 0, biteFlowerHidden: 0, biteFlowerOpen: 0, biteAnimalHidden: 0, biteAnimalOpen: 0 });

export interface GameResult {
  winner: number | null;
  selfDraw: boolean;
  discarder: number | null;
  score: ScoreResult | null;
  chipsDelta: number[];
  playerTurns: number;
  log: string[];
  tilesAccounted: number;
  counts: { chow: number; pong: number; kong: number; flowers: number; animals: number; decisions: number; illegal: number };
  /** per seat: tiles actually drawn from the wall (calls skip your draw; kongs add one) */
  draws: number[];
  /** per seat: times a COMPLETE hand could not be declared because it was under the table minimum */
  blockedWins: number[];
  /** per seat: the turn at which the seat first became one tile from winning (-1 = never) */
  readyTurn: number[];
  /** the tile the winner won on (-1 if the hand was drawn) */
  winTile: number;
  /** which seat (if any) had to pay the whole bill under pay-all */
  liable: number | null;
  /** per seat: how many units of each configurable amount changed hands */
  ledger: Ledger[];
}

export interface GameOptions {
  prevailingWind?: number; dealer?: number; log?: boolean;
  rules?: RulesConfig;
  recorder?: Recorder;
  /** Called right before a player chooses a discard. Throw to abort the game. */
  onDiscardDecision?: (view: PlayerView, drawn: TileInstance | null) => void;
}

export function playGame(bots: Bot[], cfg: TableConfig, wall: Wall, opts: GameOptions = {}): GameResult {
  return GameState.deal(cfg, wall, opts).run(bots);
}
