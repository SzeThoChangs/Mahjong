/**
 * One hand of Singapore Mahjong as a phase machine.
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
import { Wall } from './wall.js';
import {
  animalPartner, bonusSeat, isAnimal, isBonus, isFlower, isSeason, isSuited, kindOf, rankOf, suitOf,
  type TileInstance, type TileKind,
} from './tiles.js';
import { scoreHand, type Meld, type ScoreResult } from './score.js';
import { immediatePayout, meetsMinimum, winPayments, type TableConfig } from './payout.js';
import { DEFAULT_RULES, type RulesConfig } from './rules.js';

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
}

export interface GameOptions {
  prevailingWind?: number; dealer?: number; log?: boolean;
  rules?: RulesConfig;
  recorder?: Recorder;
  /** Called right before a player chooses a discard. Throw to abort the game. */
  onDiscardDecision?: (view: PlayerView, drawn: TileInstance | null) => void;
}

export function playGame(bots: Bot[], cfg: TableConfig, wall: Wall, opts: GameOptions = {}): GameResult {
  const rules = opts.rules ?? DEFAULT_RULES;
  const log: string[] = [];
  const L = (s: string) => { if (opts.log) log.push(s); };
  const prevailingWind = opts.prevailingWind ?? 0;
  const dealer = opts.dealer ?? 0;
  const players: PlayerState[] = [0, 1, 2, 3].map((seat) => ({
    seat, hand: [], melds: [], bonus: [], discards: [], lastDiscardKind: null, seenSinceLastDiscard: new Set(), chips: 0,
  }));
  const discardLog: DiscardEvent[] = [];
  const counts = { chow: 0, pong: 0, kong: 0, flowers: 0, animals: 0, decisions: 0, illegal: 0 };
  let playerTurns = 0;

  const pay = (from: number, to: number, n: number) => { players[from]!.chips -= n; players[to]!.chips += n; };
  const payAllOpponents = (to: number, each: number) => { for (let s = 0; s < 4; s++) if (s !== to) pay(s, to, each); };

  // ---- bonus tiles ------------------------------------------------------------
  const paidEvents = players.map(() => new Set<string>());
  const settleBonus = (p: PlayerState, fromInitial: boolean) => {
    const kinds = p.bonus.map(kindOf), e = paidEvents[p.seat]!;
    const animals = kinds.filter(isAnimal), flowers = kinds.filter(isFlower), seasons = kinds.filter(isSeason);
    const ownPair = kinds.filter((k) => (isFlower(k) || isSeason(k)) && bonusSeat(k) === p.seat).length >= 2;
    const animalPair = kinds.some((k) => isAnimal(k) && kinds.includes(animalPartner(k) as TileKind));
    const fire = (id: string, kind: Parameters<typeof immediatePayout>[0]) => {
      if (e.has(id)) return; e.add(id);
      const n = immediatePayout(kind, cfg, fromInitial, rules); payAllOpponents(p.seat, n); L(`seat${p.seat} ${id} +${n}x3`);
    };
    if (animals.length === 4) fire('animal_set', 'animal_set'); else if (animalPair) fire('animal_pair', 'animal_pair');
    if (flowers.length === 4) fire('flower_set', 'flower_set');
    if (seasons.length === 4) fire('season_set', 'flower_set');
    if (ownPair) fire('flower_pair', 'flower_pair');
  };
  const absorb = (p: PlayerState, t: TileInstance | null, fromInitial: boolean): { tile: TileInstance | null; replaced: boolean } => {
    let replaced = false;
    while (t !== null && isBonus(kindOf(t))) {
      p.bonus.push(t); if (isAnimal(kindOf(t))) counts.animals++; else counts.flowers++;
      settleBonus(p, fromInitial); replaced = true;
      t = wall.drawReplacement();
    }
    return { tile: t, replaced };
  };

  // ---- deal -----------------------------------------------------------------
  for (let i = 0; i < 13; i++) for (let s = 0; s < 4; s++) {
    const p = players[(dealer + s) % 4]!;
    const { tile } = absorb(p, wall.draw(), true);
    if (tile !== null) p.hand.push(tile);
  }

  const view = (seat: number, lastDiscard: PlayerView['lastDiscard']): PlayerView => ({
    seat, hand: players[seat]!.hand, melds: players[seat]!.melds, bonus: players[seat]!.bonus,
    players: players.map((q) => ({ melds: q.melds, bonus: q.bonus, discards: q.discards, chips: q.chips })),
    prevailingWind, dealer, wallRemaining: wall.remaining, playerTurns, lastDiscard, discardLog, config: cfg,
  });
  const truth = (): GroundTruth => ({ hands: players.map((p) => [...p.hand]), wall: wall.snapshot(), dealer, prevailingWind });
  const record = (kind: DecisionKind, seat: number, v: PlayerView, legal: LegalAction[], selected: LegalAction, drawn: TileInstance | null) => {
    counts.decisions++;
    if (!legal.some((l) => JSON.stringify(l) === JSON.stringify(selected))) counts.illegal++;
    opts.recorder?.record({ kind, seat, view: v, legal, selected, drawn, truth });
  };
  const score = (p: PlayerState, concealed: TileKind[], winningTile: TileKind, selfDraw: boolean, extra: { replacementWin?: boolean; lastTile?: boolean }) =>
    scoreHand({ concealed, melds: p.melds, bonus: p.bonus.map(kindOf), seat: p.seat, prevailingWind, winningTile, selfDraw, ...extra }, rules);
  const tilesAccounted = () => players.reduce((a, p) => a + p.hand.length + p.bonus.length + p.discards.length + p.melds.reduce((b, m) => b + m.instances.length, 0), 0);
  const finish = (winner: number | null, selfDraw: boolean, discarder: number | null, sc: ScoreResult | null): GameResult => {
    if (winner !== null && sc) {
      const pays = winPayments(sc.fan, winner, discarder, cfg, { thirteenWonders: sc.combination === 'thirteen_wonders', rules });
      for (let s = 0; s < 4; s++) if (pays[s]) pay(s, winner, pays[s]!);
    }
    return { winner, selfDraw, discarder, score: sc, chipsDelta: players.map((p) => p.chips), playerTurns, log, tilesAccounted: tilesAccounted(), counts };
  };
  const drawGame = () => finish(null, false, null, null);
  const legalChows = (q: PlayerState, dk: TileKind): TileInstance[][] => {
    if (!isSuited(dk)) return [];
    const r = rankOf(dk), su = suitOf(dk), out: TileInstance[][] = [];
    const find = (rr: number) => q.hand.find((t) => suitOf(kindOf(t)) === su && rankOf(kindOf(t)) === rr);
    for (const [a, b] of [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]] as const) {
      if (a < 1 || b > 9) continue;
      const ta = find(a), tb = find(b);
      if (ta !== undefined && tb !== undefined) out.push([ta, tb]);
    }
    return out;
  };

  // ---- phase machine ------------------------------------------------------------
  type Phase = 'draw' | 'replacement' | 'discard';
  let turn = dealer, phase: Phase = 'draw';
  let drawnInfo: { tile: TileInstance; replaced: boolean; lastTile: boolean } | null = null;
  let guard = 0;

  while (guard++ < 2000) {
    const p = players[turn]!;

    if (phase === 'draw' || phase === 'replacement') {
      const raw = phase === 'draw' ? wall.draw() : wall.drawReplacement();
      if (raw === null) return drawGame();
      const lastTile = wall.isExhausted;
      const a = absorb(p, raw, false);
      if (a.tile === null) return drawGame();
      p.hand.push(a.tile);
      drawnInfo = { tile: a.tile, replaced: phase === 'replacement' || a.replaced, lastTile };
      playerTurns++;

      const options: SelfAction[] = [];
      const sc = score(p, p.hand.map(kindOf), kindOf(a.tile), true, { replacementWin: drawnInfo.replaced, lastTile });
      if (sc.valid && meetsMinimum(sc.fan, true, cfg)) options.push({ kind: 'win', score: sc });
      const byKind = new Map<TileKind, TileInstance[]>();
      for (const t of p.hand) { const k = kindOf(t); (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(t); }
      for (const [, ts] of byKind) if (ts.length === 4) options.push({ kind: 'kong4', tiles: ts });
      for (const m of p.melds) if (m.type === 'pong') { const t = p.hand.find((x) => kindOf(x) === m.tiles[0]); if (t !== undefined) options.push({ kind: 'kong1', meld: m, tile: t }); }

      let chosen: SelfAction | null = null;
      if (options.length) {
        const v = view(turn, null);
        chosen = bots[turn]!.chooseSelfAction(v, options);
        const legal: LegalAction[] = [...options.map((o): LegalAction => o.kind === 'win' ? { a: 'win' } : o.kind === 'kong4' ? { a: 'kong4', kind: kindOf(o.tiles[0]!) } : { a: 'kong1', kind: kindOf(o.tile) }), { a: 'proceed' }];
        const sel: LegalAction = !chosen ? { a: 'proceed' } : chosen.kind === 'win' ? { a: 'win' } : chosen.kind === 'kong4' ? { a: 'kong4', kind: kindOf(chosen.tiles[0]!) } : { a: 'kong1', kind: kindOf(chosen.tile) };
        record('self', turn, v, legal, sel, a.tile);
      }
      if (chosen?.kind === 'win') { L(`seat${turn} self-draw ${chosen.score.combination} ${chosen.score.fan}f`); return finish(turn, true, null, chosen.score); }
      if (chosen?.kind === 'kong4') {
        p.hand = p.hand.filter((t) => !chosen.tiles.includes(t));
        p.melds.push({ type: 'kong', tiles: chosen.tiles.map(kindOf), concealed: true, instances: chosen.tiles });
        payAllOpponents(turn, immediatePayout('kong_4', cfg, false, rules)); counts.kong++; L(`seat${turn} kong4`);
        phase = 'replacement'; continue;
      }
      if (chosen?.kind === 'kong1') {
        p.hand = p.hand.filter((t) => t !== chosen.tile);
        chosen.meld.type = 'kong'; chosen.meld.tiles.push(kindOf(chosen.tile)); chosen.meld.instances.push(chosen.tile);
        payAllOpponents(turn, immediatePayout('kong_1', cfg, false, rules)); counts.kong++; L(`seat${turn} kong1`);
        phase = 'replacement'; continue;
      }
      phase = 'discard';
      continue;
    }

    // ---- discard ---------------------------------------------------------------
    const dv = view(turn, null);
    opts.onDiscardDecision?.(dv, drawnInfo?.tile ?? null);
    const d = bots[turn]!.chooseDiscard(dv);
    const idx = p.hand.indexOf(d);
    if (idx < 0) { counts.illegal++; throw new Error(`seat ${turn} discarded a tile it does not hold`); }
    record('discard', turn, dv, p.hand.map((t): LegalAction => ({ a: 'discard', tile: t, kind: kindOf(t) })), { a: 'discard', tile: d, kind: kindOf(d) }, drawnInfo?.tile ?? null);
    p.hand.splice(idx, 1); p.discards.push(d);
    const dk = kindOf(d);
    const lastTileDiscard = wall.isExhausted;
    const ev: DiscardEvent = { seat: turn, tile: d, claimedBy: null, claimKind: null, turn: playerTurns };
    discardLog.push(ev);

    // claims (prohibition evaluated BEFORE this discard is added to others' seen-sets)
    const claims: ClaimOption[] = [];
    for (let off = 1; off <= 3; off++) {
      const s = (turn + off) % 4, q = players[s]!;
      if (q.lastDiscardKind === dk || q.seenSinceLastDiscard.has(dk)) continue;
      const sc = score(q, [...q.hand.map(kindOf), dk], dk, false, { lastTile: lastTileDiscard });
      if (sc.valid && meetsMinimum(sc.fan, false, cfg)) claims.push({ kind: 'win', seat: s, score: sc });
      const same = q.hand.filter((t) => kindOf(t) === dk);
      if (same.length >= 3) claims.push({ kind: 'kong3', seat: s, tiles: same.slice(0, 3) });
      if (same.length >= 2) claims.push({ kind: 'pong', seat: s, tiles: same.slice(0, 2) });
      if (off === 1) for (const pair of legalChows(q, dk)) claims.push({ kind: 'chow', seat: s, tiles: pair });
    }
    p.lastDiscardKind = dk; p.seenSinceLastDiscard.clear();
    for (const q of players) if (q !== p) q.seenSinceLastDiscard.add(dk);

    const prio: Record<ClaimKind, number> = { win: 0, kong3: 1, pong: 2, chow: 3 };
    const bySeat = new Map<number, ClaimOption[]>();
    for (const c of claims) (bySeat.get(c.seat) ?? bySeat.set(c.seat, []).get(c.seat)!).push(c);
    const wanted: ClaimOption[] = [];
    for (const [s, os] of bySeat) {
      const v = view(s, { tile: d, from: turn });
      const c = bots[s]!.chooseClaim(v, os);
      const enc = (o: ClaimOption): LegalAction => o.kind === 'win' ? { a: 'win' } : o.kind === 'pong' ? { a: 'pong', kind: dk } : o.kind === 'kong3' ? { a: 'kong3', kind: dk } : { a: 'chow', kinds: [...o.tiles!.map(kindOf), dk].sort((x, y) => x - y) };
      record('claim', s, v, [...os.map(enc), { a: 'pass' }], c ? enc(c) : { a: 'pass' }, null);
      if (c) wanted.push(c);
    }
    wanted.sort((a, b) => prio[a.kind] - prio[b.kind] || ((a.seat - turn + 4) % 4) - ((b.seat - turn + 4) % 4));
    const taken = wanted[0];

    if (!taken) {
      if (wall.isExhausted) return drawGame();
      turn = (turn + 1) % 4; phase = 'draw'; continue;
    }
    ev.claimedBy = taken.seat; ev.claimKind = taken.kind;
    if (taken.kind === 'win') { L(`seat${taken.seat} wins on seat${turn}: ${taken.score!.combination} ${taken.score!.fan}f`); return finish(taken.seat, false, turn, taken.score!); }

    const q = players[taken.seat]!;
    p.discards.pop();
    q.hand = q.hand.filter((t) => !taken.tiles!.includes(t));
    const inst = [...taken.tiles!, d];
    q.melds.push({ type: taken.kind === 'chow' ? 'chow' : taken.kind === 'pong' ? 'pong' : 'kong', tiles: inst.map(kindOf).sort((a, b) => a - b), concealed: false, instances: inst });
    if (taken.kind === 'chow') counts.chow++; else if (taken.kind === 'pong') counts.pong++; else counts.kong++;
    L(`seat${taken.seat} ${taken.kind} from seat${turn}`);
    playerTurns++;
    turn = taken.seat;
    if (taken.kind === 'kong3') { payAllOpponents(turn, immediatePayout('kong_3', cfg, false, rules)); phase = 'replacement'; }
    else { phase = 'discard'; drawnInfo = null; }
  }
  throw new Error('game loop guard tripped');
}
