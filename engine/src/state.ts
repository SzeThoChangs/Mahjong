/**
 * Resumable game state for one hand. Same rules as game.ts, restructured so a
 * position can be captured and continued from (the evaluator needs this).
 *
 *   const g = GameState.deal(cfg, wall, opts)        // or GameState.fromSnapshot(snap, cfg, opts)
 *   while (!g.finished) g.step(bots)                 // one bot decision at a time
 *   g.result
 *
 * The phase machine is identical to playGame():
 *   draw -> self -> discard -> (claim?) -> next draw;  kong -> replacement draw; pong/chow -> claimant's discard
 */
import { Wall } from './wall.js';
import {
  animalPartner, bonusSeat, isAnimal, isBonus, isFlower, isSeason, isSuited, isTerminalOrHonour, kindOf, rankOf, suitOf,
  type TileInstance, type TileKind,
} from './tiles.js';
import { scoreHand, type ScoreResult } from './score.js';
import { immediatePayout, meetsMinimum, winPayments, winPaymentsMoney, type TableConfig } from './payout.js';
import { DEFAULT_RULES, type RulesConfig } from './rules.js';
import { couldBeComplete, shanten } from './shanten.js';
import { countsAndJokers, isHonour, isDragon, isWind, isJoker } from './tiles.js';
import { visibleTai } from './score.js';
import { emptyLedger, type Ledger } from './game.js';
import type {
  Bot, ClaimKind, ClaimOption, DecisionKind, DiscardEvent, GameOptions, GameResult, GroundTruth, InstMeld, LegalAction, PlayerState, PlayerView, SelfAction,
} from './game.js';

export type Phase = 'draw' | 'replacement' | 'self' | 'discard' | 'claim' | 'done';

/** Everything needed to rebuild a position exactly. Ground truth - contains all hands and the wall. */
export interface Snapshot {
  players: { seat: number; hand: TileInstance[]; melds: InstMeld[]; bonus: TileInstance[]; discards: TileInstance[]; lastDiscardKind: TileKind | null; seenSinceLastDiscard: TileKind[]; chips: number }[];
  wall: { order: TileInstance[]; front: number; back: number; unplayable: number };
  discardLog: DiscardEvent[];
  dealer: number; prevailingWind: number; turn: number; phase: Phase; playerTurns: number;
  drawnInfo: { tile: TileInstance; replaced: boolean; lastTile: boolean } | null;
  pendingDiscard: { tile: TileInstance; from: number; lastTileDiscard: boolean; eligible: number[] } | null;
  /** a kong in progress that opponents may rob; `kongKind` tells how to complete it if nobody does */
  pendingRob: { tile: TileInstance; from: number; kong: 'kong1' | 'kong4'; meldIndex: number; feeEach: number } | null;
  /** Pay-All liability: seat -> the seat that must pay for everyone if this seat wins (null = none) */
  liable: (number | null)[];
  /** seat -> who fed the kong this seat is drawing a replacement for, while that draw is still live */
  kongFedBy: (number | null)[];
  paidEvents: string[][];
  counts: GameResult['counts'];
  claimQueue: { seat: number; options: ClaimOption[] }[];
  wanted: ClaimOption[];
}

export class GameState {
  readonly cfg: TableConfig; readonly rules: RulesConfig; readonly opts: GameOptions;
  players: PlayerState[]; wall: Wall; discardLog: DiscardEvent[] = [];
  dealer: number; prevailingWind: number; turn: number; phase: Phase = 'draw'; playerTurns = 0;
  drawnInfo: Snapshot['drawnInfo'] = null; pendingDiscard: Snapshot['pendingDiscard'] = null;
  pendingRob: Snapshot['pendingRob'] = null; liable: (number | null)[] = [null, null, null, null];
  kongFedBy: (number | null)[] = [null, null, null, null];
  paidEvents: Set<string>[]; counts: GameResult['counts'] = { chow: 0, pong: 0, kong: 0, flowers: 0, animals: 0, decisions: 0, illegal: 0 };
  log: string[] = []; result: GameResult | null = null;
  ledger: Ledger[] = [0, 1, 2, 3].map(emptyLedger);
  draws = [0, 0, 0, 0]; blockedWins = [0, 0, 0, 0]; readyTurn = [-1, -1, -1, -1]; winTile = -1;
  private consecutiveKongs = 0;
  private lastLiable: number | null = null;
  private selfOptions: SelfAction[] = [];
  private claimQueue: { seat: number; options: ClaimOption[] }[] = []; private wanted: ClaimOption[] = [];

  private constructor(cfg: TableConfig, wall: Wall, opts: GameOptions) {
    this.cfg = cfg; this.wall = wall; this.opts = opts; this.rules = opts.rules ?? DEFAULT_RULES;
    this.dealer = opts.dealer ?? 0; this.prevailingWind = opts.prevailingWind ?? 0; this.turn = this.dealer;
    this.players = [0, 1, 2, 3].map((seat) => ({ seat, hand: [], melds: [], bonus: [], discards: [], lastDiscardKind: null, seenSinceLastDiscard: new Set(), chips: 0 }));
    this.paidEvents = this.players.map(() => new Set<string>());
  }
  get finished(): boolean { return this.phase === 'done'; }

  /** Fresh hand: deal 13 tiles each (dealer first), replacing bonus tiles. */
  static deal(cfg: TableConfig, wall: Wall, opts: GameOptions = {}): GameState {
    const g = new GameState(cfg, wall, opts);
    for (let i = 0; i < 13; i++) for (let s = 0; s < 4; s++) {
      const p = g.players[(g.dealer + s) % 4]!;
      const a = g.absorb(p, wall.draw(), true);
      if (a.special) { g.finish(p.seat, true, null, a.special); return g; }
      if (a.tile !== null) p.hand.push(a.tile);
    }
    const dj = g.fourJokerWin(g.players[g.dealer]!); if (dj) g.finish(g.dealer, true, null, dj);
    return g;
  }
  /** Rebuild from a snapshot (ground truth). */
  static fromSnapshot(snap: Snapshot, cfg: TableConfig, opts: GameOptions = {}): GameState {
    const wall = Wall.fromSnapshot(snap.wall);
    const g = new GameState(cfg, wall, { ...opts, dealer: snap.dealer, prevailingWind: snap.prevailingWind });
    g.players = snap.players.map((p) => ({ ...p, hand: [...p.hand], melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles], instances: [...m.instances] })), bonus: [...p.bonus], discards: [...p.discards], seenSinceLastDiscard: new Set(p.seenSinceLastDiscard) }));
    g.discardLog = snap.discardLog.map((e) => ({ ...e })); g.turn = snap.turn; g.phase = snap.phase; g.playerTurns = snap.playerTurns;
    g.drawnInfo = snap.drawnInfo ? { ...snap.drawnInfo } : null; g.pendingDiscard = snap.pendingDiscard ? { ...snap.pendingDiscard } : null;
    g.pendingRob = snap.pendingRob ? { ...snap.pendingRob } : null; g.liable = [...snap.liable];
    g.kongFedBy = [...(snap.kongFedBy ?? [null, null, null, null])];
    g.paidEvents = snap.paidEvents.map((e) => new Set(e)); g.counts = { ...snap.counts };
    // melds inside claim options must reference the rebuilt players' meld objects where relevant (kong1 uses melds; claims don't), so a plain copy is fine
    g.claimQueue = snap.claimQueue.map((q) => ({ seat: q.seat, options: q.options.map((o) => ({ ...o, tiles: o.tiles ? [...o.tiles] : undefined })) }));
    g.wanted = snap.wanted.map((o) => ({ ...o, tiles: o.tiles ? [...o.tiles] : undefined }));
    if (g.phase === 'self') g.selfOptions = g.computeSelfOptions();
    return g;
  }
  snapshot(): Snapshot {
    return {
      players: this.players.map((p) => ({ seat: p.seat, hand: [...p.hand], melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles], instances: [...m.instances] })), bonus: [...p.bonus], discards: [...p.discards], lastDiscardKind: p.lastDiscardKind, seenSinceLastDiscard: [...p.seenSinceLastDiscard], chips: p.chips })),
      wall: this.wall.snapshot(), discardLog: this.discardLog.map((e) => ({ ...e })),
      dealer: this.dealer, prevailingWind: this.prevailingWind, turn: this.turn, phase: this.phase, playerTurns: this.playerTurns,
      drawnInfo: this.drawnInfo ? { ...this.drawnInfo } : null, pendingDiscard: this.pendingDiscard ? { ...this.pendingDiscard } : null,
      pendingRob: this.pendingRob ? { ...this.pendingRob } : null, liable: [...this.liable], kongFedBy: [...this.kongFedBy],
      paidEvents: this.paidEvents.map((e) => [...e]), counts: { ...this.counts },
      claimQueue: this.claimQueue.map((q) => ({ seat: q.seat, options: q.options.map((o) => ({ ...o, tiles: o.tiles ? [...o.tiles] : undefined })) })),
      wanted: this.wanted.map((o) => ({ ...o, tiles: o.tiles ? [...o.tiles] : undefined })),
    };
  }

  // ---------------- helpers ----------------
  private L(s: string) { if (this.opts.log) this.log.push(s); }
  private pay(from: number, to: number, n: number) { this.players[from]!.chips -= n; this.players[to]!.chips += n; }
  private payAllOpponents(to: number, each: number) { for (let s = 0; s < 4; s++) if (s !== to) this.pay(s, to, each); }
  /** record that `to` received `units` of amount `k` from `from` ('all' = each opponent pays one unit) */
  private note(k: keyof Ledger, to: number, from: number | 'all') {
    if (from === 'all') { this.ledger[to]![k] += 3; for (let s = 0; s < 4; s++) if (s !== to) this.ledger[s]![k] -= 1; }
    else { this.ledger[to]![k] += 1; this.ledger[from]![k] -= 1; }
  }
  private settleBonus(p: PlayerState, fromInitial: boolean) {
    const kinds = p.bonus.map(kindOf), e = this.paidEvents[p.seat]!;
    if (this.rules.money) {         // ---- real-money bites ----
      const m = this.rules.money;
      const flowerAmt = fromInitial ? m.bite_flower_hidden : m.bite_flower_open;
      const animalAmt = fromInitial ? m.bite_animal_hidden : m.bite_animal_open;
      // flower-number pairs: flower n + season n. Own number: everyone pays. Another player's number: only the seat holding that role pays.
      for (let n = 0; n < 4; n++) {
        const id = `bite_flowers_${n}`;
        if (e.has(id)) continue;
        if (kinds.includes(34 + n) && kinds.includes(38 + n)) {
          e.add(id);
          const fk: keyof Ledger = fromInitial ? 'biteFlowerHidden' : 'biteFlowerOpen';
          if (n === this.role(p.seat)) { this.payAllOpponents(p.seat, flowerAmt); this.note(fk, p.seat, 'all'); }
          else { const payer = (this.dealer + n) % 4; this.pay(payer, p.seat, flowerAmt); this.note(fk, p.seat, payer); }
          this.L(`seat${p.seat} bite flowers#${n + 1} ${fromInitial ? 'hidden' : 'open'} $${flowerAmt}`);
        }
      }
      // animal pairs: cat+mouse, rooster+centipede - everyone pays (assumption: animals belong to no seat)
      for (const [id, a, b] of [['bite_cat_mouse', 42, 43], ['bite_rooster_centipede', 44, 45]] as const) {
        if (e.has(id)) continue;
        if (kinds.includes(a) && kinds.includes(b)) { e.add(id); this.payAllOpponents(p.seat, animalAmt); this.note(fromInitial ? 'biteAnimalHidden' : 'biteAnimalOpen', p.seat, 'all'); this.L(`seat${p.seat} ${id} ${fromInitial ? 'hidden' : 'open'} $${animalAmt}`); }
      }
      return;
    }
    const animals = kinds.filter(isAnimal), flowers = kinds.filter(isFlower), seasons = kinds.filter(isSeason);
    const ownPair = kinds.filter((k) => (isFlower(k) || isSeason(k)) && bonusSeat(k) === this.role(p.seat)).length >= 2;
    const animalPair = kinds.some((k) => isAnimal(k) && kinds.includes(animalPartner(k) as TileKind));
    const fire = (id: string, kind: Parameters<typeof immediatePayout>[0]) => {
      if (e.has(id)) return; e.add(id);
      const n = immediatePayout(kind, this.cfg, fromInitial, this.rules); this.payAllOpponents(p.seat, n); this.L(`seat${p.seat} ${id} +${n}x3`);
    };
    if (animals.length === 4) fire('animal_set', 'animal_set'); else if (animalPair) fire('animal_pair', 'animal_pair');
    if (flowers.length === 4) fire('flower_set', 'flower_set');
    if (seasons.length === 4) fire('season_set', 'flower_set');
    if (ownPair) fire('flower_pair', 'flower_pair');
  }
  /** the dealer holding all four jokers wins on the spot (config-gated) */
  private fourJokerWin(p: PlayerState): ScoreResult | null {
    const jr = this.rules.jokers;
    // exactly four: holding four is only "all of them" on a four-wildcard table. Past four this
    // instant win would fire constantly, so it is off.
    if (jr.count !== 4 || !jr.dealer_all_four_instant_win || p.seat !== this.dealer) return null;
    if (p.hand.filter((t) => isJoker(kindOf(t))).length < 4) return null;
    return { fan: jr.all_four_tai, items: [{ id: 'tian_hu', fan: jr.all_four_tai }], combination: 'tian_hu', valid: true };   // 天和: four wildcards for the host
  }
  /** instant wins on bonus tiles (config-gated): Eight Flower, all four animals */
  private specialBonusWin(p: PlayerState): ScoreResult | null {
    const kinds = p.bonus.map(kindOf);
    const fs = kinds.filter((k) => isFlower(k) || isSeason(k)).length, an = kinds.filter(isAnimal).length;
    const items: { id: string; fan: number }[] = [];
    if (fs === 8 && this.rules.special_hands.eight_flower_instant_win) items.push({ id: 'hua_hu', fan: this.rules.combination_tai.hua_hu });
    else if (an === 4 && this.rules.special_hands.all_animals_instant_win) items.push({ id: 'animal', fan: this.rules.animal_scoring.each * 4 }, { id: 'animal_set', fan: this.rules.animal_scoring.set });
    else return null;
    if (items[0]!.id === 'eight_flower') { for (let i = 0; i < an; i++) items.push({ id: 'animal', fan: this.rules.animal_scoring.each }); if (an === 4) items.push({ id: 'animal_set', fan: this.rules.animal_scoring.set }); }
    return { fan: items.reduce((a, i) => a + i.fan, 0), items, combination: items[0]!.id === 'hua_hu' ? 'hua_hu' : 'all_animals', valid: true };
  }
  private absorb(p: PlayerState, t: TileInstance | null, fromInitial: boolean): { tile: TileInstance | null; replaced: boolean; special?: ScoreResult } {
    let replaced = false;
    while (t !== null && isBonus(kindOf(t))) {
      p.bonus.push(t); if (isAnimal(kindOf(t))) this.counts.animals++; else this.counts.flowers++;
      this.settleBonus(p, fromInitial); replaced = true;
      const special = this.specialBonusWin(p);
      if (special) return { tile: null, replaced, special };
      t = this.wall.drawReplacement();
    }
    return { tile: t, replaced };
  }
  view(seat: number, lastDiscard: PlayerView['lastDiscard']): PlayerView {
    return {
      seat, hand: this.players[seat]!.hand, melds: this.players[seat]!.melds, bonus: this.players[seat]!.bonus,
      players: this.players.map((q) => ({ melds: q.melds, bonus: q.bonus, discards: q.discards, chips: q.chips })),
      prevailingWind: this.prevailingWind, dealer: this.dealer, wallRemaining: this.wall.remaining, playerTurns: this.playerTurns, lastDiscard, discardLog: this.discardLog, config: this.cfg,
      legalDiscards: this.throwable(this.players[seat]!),
    };
  }
  truth = (): GroundTruth => ({ hands: this.players.map((p) => [...p.hand]), wall: this.wall.snapshot(), dealer: this.dealer, prevailingWind: this.prevailingWind });
  /** Wind ROLE of a seat: the host (dealer) is always East, the next seat South, and the seat flowers follow.
   *  All scoring uses roles, so moving the dealership rotates everyone's winds exactly as at a real table. */
  role(seat: number): number { return (seat - this.dealer + 4) % 4; }
  private record(kind: DecisionKind, seat: number, v: PlayerView, legal: LegalAction[], selected: LegalAction, drawn: TileInstance | null) {
    this.counts.decisions++;
    if (!legal.some((l) => JSON.stringify(l) === JSON.stringify(selected))) this.counts.illegal++;
    this.opts.recorder?.record({ kind, seat, view: v, legal, selected, drawn, truth: this.truth });
  }
  private score(p: PlayerState, concealed: TileKind[], winningTile: TileKind, selfDraw: boolean, extra: { replacementWin?: boolean; lastTile?: boolean; robbingKong?: boolean }) {
    const noDiscardsYet = this.discardLog.length === 0;
    return scoreHand({
      concealed, melds: p.melds, bonus: p.bonus.map(kindOf), seat: this.role(p.seat), prevailingWind: this.prevailingWind, winningTile, selfDraw,
      isDealer: p.seat === this.dealer,
      firstDraw: selfDraw && noDiscardsYet && this.draws[p.seat]! <= 1,
      firstDiscard: !selfDraw && this.discardLog.length === 1 && this.discardLog[0]!.seat === this.dealer,
      kongOnKong: !!extra.replacementWin && this.consecutiveKongs >= 2,
      jokersUsed: concealed.filter(isJoker).length,
      ...extra,
    }, this.rules);
  }
  private tilesAccounted() { return this.players.reduce((a, p) => a + p.hand.length + p.bonus.length + p.discards.length + p.melds.reduce((b, m) => b + m.instances.length, 0), 0); }
  private finish(winner: number | null, selfDraw: boolean, discarder: number | null, sc: ScoreResult | null, robbed = false): GameResult {
    if (winner !== null && sc) {
      let liable: number | null = this.rules.bao.enabled ? this.liable[winner]! : null;
      const b = this.rules.bao;
      if (b.enabled && discarder !== null && !robbed) {   // these apply to genuine discards only
        const w = this.players[winner]!;
        const dk = kindOf(this.discardLog[this.discardLog.length - 1]!.tile);
        // Winning on a bao tile transfers the liability exactly as claiming one does - the house
        // rule is "take it or win on it". So this OVERRIDES an earlier feeder rather than deferring
        // to them: shoot the tile they win on and you take the bao off whoever fed the hand.
        if (this.baoTile(w, dk)) liable = discarder;
        else if (liable === null && b.fresh_tile_threshold !== null && this.wall.remaining < b.fresh_tile_threshold) {
          const seenBefore = this.discardLog.slice(0, -1).some((e) => kindOf(e.tile) === dk);
          if (!seenBefore) liable = discarder;
        }
      } else if (b.enabled && discarder === null && b.kong_feed && this.kongFedBy[winner] !== null
                 && sc.items.some((i) => i.id === 'replacement_win')) {
        liable = this.kongFedBy[winner] ?? null;   // 杠上开花 off a kong you fed
      }
      // `lastLiable` is what the result, the recorder and every dataset consumer read to find out
      // who carried the hand. It was declared and reported but never assigned, so it has always
      // come back null - every bao that ever fired was invisible downstream. Recorded here, at the
      // point the payment is actually decided, and only when it changed who pays.
      this.lastLiable = liable !== null && liable !== winner ? liable : null;
      const asSelfDraw = discarder === null || sc.combination === 'shi_san_yao';
      const pays = this.rules.money
        ? winPaymentsMoney(sc.fan, winner, asSelfDraw ? null : discarder, this.rules.money, liable, this.rules)
        : winPayments(sc.fan, winner, discarder, this.cfg, { thirteenWonders: sc.combination === 'shi_san_yao', rules: this.rules });
      if (!this.rules.money && liable !== null && liable !== winner) { const total = pays.reduce((a, b) => a + b, 0); this.pay(liable, winner, total); }
      else for (let s = 0; s < 4; s++) if (pays[s]) this.pay(s, winner, pays[s]!);
    }
    this.phase = 'done';
    this.result = { winner, selfDraw, discarder, score: sc, chipsDelta: this.players.map((p) => p.chips), playerTurns: this.playerTurns, log: this.log, tilesAccounted: this.tilesAccounted(), counts: this.counts, liable: this.lastLiable, ledger: this.ledger.map((l) => ({ ...l })), draws: [...this.draws], blockedWins: [...this.blockedWins], readyTurn: [...this.readyTurn], winTile: this.winTile };
    return this.result;
  }
  private legalChows(q: PlayerState, dk: TileKind): TileInstance[][] {
    if (!isSuited(dk)) return [];
    const r = rankOf(dk), su = suitOf(dk), out: TileInstance[][] = [];
    const find = (rr: number) => q.hand.find((t) => suitOf(kindOf(t)) === su && rankOf(kindOf(t)) === rr);
    for (const [a, b] of [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]] as const) {
      if (a < 1 || b > 9) continue;
      const ta = find(a), tb = find(b);
      if (ta !== undefined && tb !== undefined) out.push([ta, tb]);
    }
    return out;
  }
  private computeSelfOptions(): SelfAction[] {
    const p = this.players[this.turn]!, d = this.drawnInfo!;
    const options: SelfAction[] = [];
    const kinds = p.hand.map(kindOf);
    const cj = countsAndJokers(kinds);
    if (couldBeComplete(cj.counts, p.melds.length, cj.jokers)) {
      const sc = this.score(p, kinds, kindOf(d.tile), true, { replacementWin: d.replaced, lastTile: d.lastTile });
      if (sc.valid && meetsMinimum(sc.fan, true, this.cfg)) options.push({ kind: 'win', score: sc });
      else if (sc.valid) this.blockedWins[this.turn]!++;          // complete, but under the table minimum
    }
    const byKind = new Map<TileKind, TileInstance[]>();
    for (const t of p.hand) { const k = kindOf(t); if (isJoker(k)) continue; (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(t); }
    for (const [, ts] of byKind) if (ts.length === 4) options.push({ kind: 'kong4', tiles: ts });
    for (const m of p.melds) if (m.type === 'pong') { const t = p.hand.find((x) => kindOf(x) === m.tiles[0]); if (t !== undefined) options.push({ kind: 'kong1', meld: m, tile: t }); }
    return options;
  }
  /** compute claim options for all seats on the pending discard (prohibition uses pre-discard seen-sets) */
  private prepareClaims() {
    const pd = this.pendingDiscard!;
    const { tile: d, from } = pd; const dk = kindOf(d);
    pd.eligible = [];
    for (let off = 1; off <= 3; off++) { const s = (from + off) % 4, q = this.players[s]!; if (!(q.lastDiscardKind === dk || q.seenSinceLastDiscard.has(dk))) pd.eligible.push(s); }
    this.buildClaimQueue(pd.eligible);
  }
  /** (Re)build claim options for the given seats from their CURRENT hands, in the given order. Used after determinization. */
  rebuildClaims(firstSeat: number) {
    if (this.pendingRob) {        // rob-the-kong claim: recompute who can rob with the re-dealt hands, acting seat first
      const q = this.robQueue(this.pendingRob.tile, this.pendingRob.kong, this.pendingRob.from);
      this.claimQueue = [...q.filter((e) => e.seat === firstSeat), ...q.filter((e) => e.seat !== firstSeat)]; this.wanted = [];
      return;
    }
    const pd = this.pendingDiscard!;
    const order = [firstSeat, ...pd.eligible.filter((s) => s !== firstSeat)].filter((s) => pd.eligible.includes(s));
    this.buildClaimQueue(order);
  }
  private buildClaimQueue(seats: number[]) {
    const { tile: d, from, lastTileDiscard } = this.pendingDiscard!;
    const dk = kindOf(d);
    this.claimQueue = []; this.wanted = [];
    for (const s of seats) {
      const q = this.players[s]!; const off = (s - from + 4) % 4;
      const os: ClaimOption[] = [];
      const withTile = [...q.hand.map(kindOf), dk];
      const cj = countsAndJokers(withTile);
      if (couldBeComplete(cj.counts, q.melds.length, cj.jokers)) {
        const sc = this.score(q, withTile, dk, false, { lastTile: lastTileDiscard });
        if (sc.valid && meetsMinimum(sc.fan, false, this.cfg)) os.push({ kind: 'win', seat: s, score: sc });
        else if (sc.valid) this.blockedWins[s]!++;                 // could have won on it, but under the minimum
      }
      // A call you cannot discard out of is not a call, it is a dead end: you owe the table a tile
      // and every one you hold is a wildcard. Only the FOURTH meld can do this - with three or fewer
      // down, stranding would take more than four wildcards and the table has four - which is why
      // all 195 of these in a 150,000-hand run were a fourth pong or chow.
      //
      // The engine used to offer them, the hand became unplayable, and `throwable` broke the
      // no-wildcard-discard rule to let the turn continue. Refusing the call is the honest fix: the
      // player keeps three melds and a hand they can still play out. A kong is exempt because it
      // draws a replacement before any discard is owed.
      const strands = (used: TileInstance[]) => {
        if (this.rules.jokers.discardable) return false;
        const rest = q.hand.filter((t) => !used.includes(t));
        return rest.length > 0 && rest.every((t) => isJoker(kindOf(t)));
      };
      const same = q.hand.filter((t) => kindOf(t) === dk);
      if (same.length >= 3) os.push({ kind: 'kong3', seat: s, tiles: same.slice(0, 3) });
      if (same.length >= 2 && !strands(same.slice(0, 2))) os.push({ kind: 'pong', seat: s, tiles: same.slice(0, 2) });
      if (off === 1) for (const pair of this.legalChows(q, dk)) if (!strands(pair)) os.push({ kind: 'chow', seat: s, tiles: pair });
      if (os.length) this.claimQueue.push({ seat: s, options: os });
    }
  }

  // ---------------- legal actions for the CURRENT decision (for evaluators) ----------------
  /** Who decides now and what they may do. Null when no decision is pending (engine-driven phase). */
  pending(): { kind: DecisionKind; seat: number; legal: LegalAction[] } | null {
    if (this.phase === 'self') {
      const legal: LegalAction[] = [...this.selfOptions.map((o): LegalAction => o.kind === 'win' ? { a: 'win' } : o.kind === 'kong4' ? { a: 'kong4', kind: kindOf(o.tiles[0]!) } : { a: 'kong1', kind: kindOf(o.tile) }), { a: 'proceed' }];
      return { kind: 'self', seat: this.turn, legal };
    }
    if (this.phase === 'discard') {
      // A wildcard is not a legal throw unless the table says so. Enforced HERE, in the legal list,
      // rather than left to the bots: a bot that picks at random would otherwise throw one, and
      // 0.76% of the recorded dataset is exactly that.
      const src = this.throwable(this.players[this.turn]!);
      return { kind: 'discard', seat: this.turn, legal: src.map((t): LegalAction => ({ a: 'discard', tile: t, kind: kindOf(t) })) };
    }
    if (this.phase === 'claim' && this.claimQueue.length) {
      const q = this.claimQueue[0]!; const dk = kindOf(this.claimTile());
      return { kind: 'claim', seat: q.seat, legal: [...q.options.map((o) => this.encClaim(o, dk)), { a: 'pass' }] };
    }
    return null;
  }
  private encClaim(o: ClaimOption, dk: TileKind): LegalAction {
    return o.kind === 'win' ? { a: 'win' } : o.kind === 'pong' ? { a: 'pong', kind: dk } : o.kind === 'kong3' ? { a: 'kong3', kind: dk } : { a: 'chow', kinds: [...o.tiles!.map(kindOf), dk].sort((x, y) => x - y) };
  }

  // ---------------- advance ----------------
  /** Run engine-driven phases until a bot decision is needed (or the hand ends). */
  advance(): void {
    for (let guard = 0; guard < 64 && !this.finished; guard++) {
      // Before anyone is asked for a tile: can they actually produce one?
      if (this.phase === 'discard' && this.strandedBao()) return;
      if (this.phase === 'draw' || this.phase === 'replacement') {
        const p = this.players[this.turn]!;
        const raw = this.phase === 'draw' ? this.wall.draw() : this.wall.drawReplacement();
        if (raw === null) { this.finish(null, false, null, null); return; }
        const lastTile = this.wall.isExhausted;
        const a = this.absorb(p, raw, false);
        if (a.special) { this.finish(this.turn, true, null, a.special); return; }
        if (a.tile === null) { this.finish(null, false, null, null); return; }
        p.hand.push(a.tile); this.draws[this.turn]!++;
        this.drawnInfo = { tile: a.tile, replaced: this.phase === 'replacement' || a.replaced, lastTile };
        this.playerTurns++;
        const fj = this.fourJokerWin(p); if (fj) { this.finish(this.turn, true, null, fj); return; }
        this.selfOptions = this.computeSelfOptions();
        if (this.selfOptions.length) { this.phase = 'self'; return; }
        this.phase = 'discard'; continue;      // continue, not return: the stranded check is at the top
      }
      if (this.phase === 'claim' && this.claimQueue.length === 0) { this.resolveClaims(); continue; }
      return; // self / discard / claim-with-queue: a decision is pending
    }
  }
  /** Apply a bot's decision for the pending phase, then advance to the next decision. */
  apply(action: LegalAction): void {
    if (this.phase === 'self') this.applySelf(action);
    else if (this.phase === 'discard') this.applyDiscard(action);
    else if (this.phase === 'claim') this.applyClaim(action);
    else throw new Error(`no decision pending in phase ${this.phase}`);
    this.advance();
  }
  private applySelf(action: LegalAction) {
    const p = this.players[this.turn]!, v = this.view(this.turn, null), d = this.drawnInfo!;
    const legal = this.pending()!.legal;
    this.record('self', this.turn, v, legal, action, d.tile);
    if (action.a === 'win') { const o = this.selfOptions.find((x) => x.kind === 'win')!; this.winTile = kindOf(d.tile); this.L(`seat${this.turn} self-draw`); this.finish(this.turn, true, null, (o as { score: ScoreResult }).score); return; }
    if (action.a === 'kong4') {
      const o = this.selfOptions.find((x) => x.kind === 'kong4' && kindOf(x.tiles[0]!) === action.kind) as Extract<SelfAction, { kind: 'kong4' }>;
      p.hand = p.hand.filter((t) => !o.tiles.includes(t));
      p.melds.push({ type: 'kong', tiles: o.tiles.map(kindOf), concealed: true, instances: o.tiles });
      const fee4 = this.kongPayment(this.turn, null, 'kong_4'); this.counts.kong++; this.consecutiveKongs++;
      this.beginRob(o.tiles[0]!, 'kong4', p.melds.length - 1, fee4); return;
    }
    if (action.a === 'kong1') {
      const o = this.selfOptions.find((x) => x.kind === 'kong1' && kindOf(x.tile) === action.kind) as Extract<SelfAction, { kind: 'kong1' }>;
      p.hand = p.hand.filter((t) => t !== o.tile);
      o.meld.type = 'kong'; o.meld.tiles.push(kindOf(o.tile)); o.meld.instances.push(o.tile);
      const fee1 = this.kongPayment(this.turn, null, 'kong_1'); this.counts.kong++; this.consecutiveKongs++;
      this.beginRob(o.tile, 'kong1', p.melds.indexOf(o.meld), fee1); return;
    }
    this.phase = 'discard';
  }
  /** Kong side payment. `feeder` = the discarder for a fed kong (kong3), null for a self-made kong.
   *  Returns the per-opponent amount paid (for a refund if the kong is robbed). */
  private kongPayment(to: number, feeder: number | null, kind: 'kong_1' | 'kong_3' | 'kong_4'): number {
    const m = this.rules.money;
    if (m) {
      if (feeder !== null) { this.pay(feeder, to, m.kong_fed_total); this.note('kongFed', to, feeder); return m.kong_fed_total / 3; }
      const concealed = kind === 'kong_4';
      const each = concealed ? m.kong_concealed_each : m.kong_exposed_each;
      this.payAllOpponents(to, each); this.note(concealed ? 'kongConcealed' : 'kongExposed', to, 'all'); return each;
    }
    const each = immediatePayout(kind, this.cfg, false, this.rules);
    if (feeder !== null) { this.payAllOpponents(to, each); return each; }
    this.payAllOpponents(to, each); return each;
  }
  /**
   * Pay-All: after seat `q` claims a set from `from`, does `from` become liable for q's eventual win?
   *
   * Every rule here attaches at the FEED, not at the winning discard, which is what makes it stick:
   * `finish` reads `this.liable[winner]` whether or not anybody shot the last tile, so the feeder
   * still pays when the hand is self-drawn. That is the whole point - the older colour rule in
   * `finish` looked only at the winning throw, so taking your tile and then self-drawing let you off.
   *
   * Liability is a single slot per player and every rule ASSIGNS it, so a later feed replaces an
   * earlier one: throw a bao tile into a hand somebody else already fed and you take it over from
   * them. Deliberate - the table transfers bao rather than splitting it.
   *
   * The threshold is the THIRD meld throughout (four for winds, there being only four of them):
   * two of a kind is a plan, three is a hand you can see coming.
   */
  private noteLiability(q: PlayerState, from: number, dk: TileKind) {
    if (this.rules.bao.enabled && this.baoTile(q, dk)) this.liable[q.seat] = from;
  }
  /**
   * Is `q`'s hand one the table can see coming, and is `dk` the tile that carries it?
   *
   * Read against the melds as they stand, which on the claim path already INCLUDE the tile just
   * taken - so "the third meld is the bao" means `melds.length >= 3` here. On the win path the
   * melds are whatever was showing and `dk` is the winning tile.
   */
  private baoTile(q: PlayerState, dk: TileKind): boolean {
    const b = this.rules.bao;
    const heads = q.melds.map((m) => m.tiles[0]!);
    const honourSets = q.melds.filter((m) => m.type !== 'chow' && isHonour(m.tiles[0]!));
    const dragons = honourSets.filter((m) => isDragon(m.tiles[0]!)).length, winds = honourSets.filter((m) => isWind(m.tiles[0]!)).length;

    if (isDragon(dk) && b.dragon_set_feed && dragons >= 3) return true;
    if (isWind(dk) && b.wind_set_feed && winds >= 4) return true;
    // 混老頭: all pongs, every one an honour, a dragon or a 1/9. A plain all-pong of middle
    // numbers is not this hand and carries no liability.
    if (b.terminal_set_feed && isTerminalOrHonour(dk) && q.melds.length >= 3
        && q.melds.every((m) => m.type !== 'chow') && heads.every(isTerminalOrHonour)) return true;
    // colour: three melds, all the same suit
    if (b.colour_set_feed && isSuited(dk) && q.melds.length >= 3 && heads.every(isSuited)
        && new Set(heads.map(suitOf)).size === 1) return true;
    // fed the limit: the tile took what the table can SEE of their hand to the fan limit. Only
    // honours and terminals can do it - those are the tiles that carry tai on their own.
    if (b.fan_limit_feed && isTerminalOrHonour(dk)) {
      const seen = visibleTai({ melds: q.melds, bonus: q.bonus.map(kindOf), seat: this.role(q.seat), prevailingWind: this.prevailingWind }, this.rules);
      if (seen >= this.cfg.fan_limit) return true;
    }
    return false;
  }
  /** After a kong: can anyone win on the kong tile? (kong4 only robbable for 13 Wonders.) If so, open a claim phase; else take the replacement draw. */
  private robQueue(tile: TileInstance, kong: 'kong1' | 'kong4', from: number): { seat: number; options: ClaimOption[] }[] {
    const dk = kindOf(tile); const out: { seat: number; options: ClaimOption[] }[] = [];
    for (let off = 1; off <= 3; off++) {
      const s = (from + off) % 4, q = this.players[s]!;
      if (q.lastDiscardKind === dk || q.seenSinceLastDiscard.has(dk)) continue;       // same prohibition as a discard
      const withTile = [...q.hand.map(kindOf), dk];
      const cjr = countsAndJokers(withTile);
      if (!couldBeComplete(cjr.counts, q.melds.length, cjr.jokers)) continue;
      const sc = this.score(q, withTile, dk, false, { robbingKong: true });
      if (!sc.valid || !meetsMinimum(sc.fan, false, this.cfg)) continue;
      if (kong === 'kong4' && sc.combination !== 'shi_san_yao') continue;
      out.push({ seat: s, options: [{ kind: 'win', seat: s, score: sc }] });
    }
    return out;
  }
  private beginRob(tile: TileInstance, kong: 'kong1' | 'kong4', meldIndex: number, feeEach: number) {
    this.claimQueue = this.robQueue(tile, kong, this.turn); this.wanted = [];
    if (this.claimQueue.length) { this.pendingRob = { tile, from: this.turn, kong, meldIndex, feeEach }; this.phase = 'claim'; }
    else this.phase = 'replacement';
  }
  /** The tiles this seat may legally throw. A wildcard is not one of them unless the table says so.
   *  This can come back EMPTY - a hand of nothing but wildcards has no legal throw, and the answer
   *  to that is `strandedBao`, not breaking the rule to keep the turn moving. */
  private throwable(p: PlayerState): TileInstance[] {
    if (this.rules.jokers.discardable) return p.hand;
    return p.hand.filter((t) => !isJoker(kindOf(t)));
  }
  /**
   * The seat to play owes a discard and holds nothing but wildcards. It cannot win either - two
   * wildcards behind four melds is a complete hand, but at 0 tai the minimum refuses it - so the
   * hand is over. The player kena bao: pays `stranded_bao_each` to each of the other three, and
   * nobody wins.
   *
   * Returns true when it fired, so `advance` stops rather than asking for a discard that has no
   * legal answer.
   */
  private strandedBao(): boolean {
    const p = this.players[this.turn]!;
    if (this.throwable(p).length) return false;
    const each = this.rules.jokers.stranded_bao_each;
    if (each) for (let s = 0; s < 4; s++) if (s !== this.turn) this.pay(this.turn, s, each);
    this.L(`seat${this.turn} stranded on wildcards - bao ${each ?? 0} each`);
    this.finish(null, false, null, null);
    return true;
  }
  private applyDiscard(action: LegalAction) {
    if (action.a !== 'discard') throw new Error('discard expected');
    const p = this.players[this.turn]!, v = this.view(this.turn, null);
    const idx = p.hand.indexOf(action.tile);
    if (idx < 0) { this.counts.illegal++; throw new Error(`seat ${this.turn} discarded a tile it does not hold`); }
    // Bots pick a tile straight out of the hand rather than off a legal list, so the no-throw rule
    // has to be enforced HERE too - filtering `legalActions()` alone left every bot free to throw a
    // wildcard, which is how 0.76% of the old dataset came to contain moves the table forbids.
    const ok = this.throwable(p);
    if (!ok.includes(action.tile)) { this.counts.illegal++; throw new Error(`seat ${this.turn} may not discard a wildcard at this table`); }
    this.record('discard', this.turn, v, ok.map((t): LegalAction => ({ a: 'discard', tile: t, kind: kindOf(t) })), action, this.drawnInfo?.tile ?? null);
    this.consecutiveKongs = 0;                     // a discard breaks the kong chain
    this.kongFedBy[this.turn] = null;              // ...and spends the fed kong's replacement draw
    p.hand.splice(idx, 1); p.discards.push(action.tile);
    if (this.readyTurn[this.turn] === -1 && shanten(p.hand.map(kindOf), p.melds.length) <= 0) this.readyTurn[this.turn] = this.playerTurns;
    const dk = kindOf(action.tile);
    this.pendingDiscard = { tile: action.tile, from: this.turn, lastTileDiscard: this.wall.isExhausted, eligible: [] };
    this.discardLog.push({ seat: this.turn, tile: action.tile, claimedBy: null, claimKind: null, turn: this.playerTurns });
    if (isJoker(dk) && !this.rules.jokers.claimable_when_discarded) { this.claimQueue = []; this.wanted = []; }   // a discarded joker is dead
    else this.prepareClaims();
    // update prohibition state AFTER computing claims
    p.lastDiscardKind = dk; p.seenSinceLastDiscard.clear();
    for (const q of this.players) if (q !== p) q.seenSinceLastDiscard.add(dk);
    this.phase = 'claim';
  }
  private claimTile(): TileInstance { return this.pendingRob ? this.pendingRob.tile : this.pendingDiscard!.tile; }
  private claimFrom(): number { return this.pendingRob ? this.pendingRob.from : this.pendingDiscard!.from; }
  private applyClaim(action: LegalAction) {
    const q = this.claimQueue.shift()!; const dk = kindOf(this.claimTile());
    const v = this.view(q.seat, { tile: this.claimTile(), from: this.claimFrom() });
    this.record('claim', q.seat, v, [...q.options.map((o) => this.encClaim(o, dk)), { a: 'pass' }], action, null);
    if (action.a !== 'pass') {
      const o = q.options.find((x) => JSON.stringify(this.encClaim(x, dk)) === JSON.stringify(action));
      if (o) this.wanted.push(o);
    }
  }
  private resolveClaims() {
    if (this.pendingRob) {   // robbing the kong: only wins were offered
      const rob = this.pendingRob; const from = rob.from;
      const prio: Record<ClaimKind, number> = { win: 0, kong3: 1, pong: 2, chow: 3 };
      this.wanted.sort((a, b) => prio[a.kind] - prio[b.kind] || ((a.seat - from + 4) % 4) - ((b.seat - from + 4) % 4));
      const taken = this.wanted[0]; this.wanted = []; this.pendingRob = null;
      if (taken) {
        // the robbed tile leaves the kong (kong1: meld reverts to a pong; kong4: cannot happen except 13 wonders - meld removed entirely)
        const p = this.players[from]!; const m = p.melds[rob.meldIndex]!;
        if (rob.kong === 'kong1') { m.type = 'pong'; m.tiles.pop(); m.instances = m.instances.filter((t) => t !== rob.tile); }
        else { p.melds.splice(rob.meldIndex, 1); for (const t of m.instances) if (t !== rob.tile) p.hand.push(t); }
        this.counts.kong--;
        // ...and it goes to the player who robbed it. Without this the tile is removed from the
        // kong and handed to nobody, so it vanishes: the hand accounts for 147 tiles instead of
        // 148. Rare (about 1 hand in 1,400) and it never changed a score, because the win is
        // already resolved by this point - but it left the winner not holding the tile they won on.
        this.players[taken.seat]!.hand.push(rob.tile);
        // the kong never stood: refund its immediate payment (house-rule assumption, flagged in docs)
        for (let s2 = 0; s2 < 4; s2++) if (s2 !== from) this.pay(from, s2, rob.feeEach);
        this.winTile = kindOf(rob.tile);
        this.L(`seat${taken.seat} robs the kong of seat${from}`);
        this.finish(taken.seat, false, from, taken.score!, true); return;
      }
      this.phase = 'replacement'; return;
    }
    const { tile: d, from } = this.pendingDiscard!;
    const prio: Record<ClaimKind, number> = { win: 0, kong3: 1, pong: 2, chow: 3 };
    this.wanted.sort((a, b) => prio[a.kind] - prio[b.kind] || ((a.seat - from + 4) % 4) - ((b.seat - from + 4) % 4));
    const taken = this.wanted[0];
    this.wanted = []; this.pendingDiscard = null;
    const ev = this.discardLog[this.discardLog.length - 1]!;
    if (!taken) {
      if (this.wall.isExhausted) { this.finish(null, false, null, null); return; }
      this.turn = (from + 1) % 4; this.phase = 'draw'; return;
    }
    ev.claimedBy = taken.seat; ev.claimKind = taken.kind;
    if (taken.kind === 'win') { this.winTile = kindOf(d); this.L(`seat${taken.seat} wins on seat${from}`); this.finish(taken.seat, false, from, taken.score!); return; }
    const p = this.players[from]!, q = this.players[taken.seat]!;
    p.discards.pop();
    q.hand = q.hand.filter((t) => !taken.tiles!.includes(t));
    const inst = [...taken.tiles!, d];
    q.melds.push({ type: taken.kind === 'chow' ? 'chow' : taken.kind === 'pong' ? 'pong' : 'kong', tiles: inst.map(kindOf).sort((a, b) => a - b), concealed: false, instances: inst });
    if (taken.kind === 'chow') this.counts.chow++; else if (taken.kind === 'pong') this.counts.pong++; else this.counts.kong++;
    this.noteLiability(q, from, kindOf(d));
    this.playerTurns++;
    this.turn = taken.seat;
    if (taken.kind === 'kong3') { this.kongFedBy[this.turn] = from; this.kongPayment(this.turn, from, 'kong_3'); this.consecutiveKongs++; this.phase = 'replacement'; }
    else { this.phase = 'discard'; this.drawnInfo = null; }
  }

  /** Let bots decide the pending decision. One call = one bot decision. */
  step(bots: Bot[]): void {
    if (this.phase === 'draw' || this.phase === 'replacement' || (this.phase === 'claim' && !this.claimQueue.length)) this.advance();
    if (this.finished) return;
    if (this.phase === 'self') {
      const chosen = bots[this.turn]!.chooseSelfAction(this.view(this.turn, null), this.selfOptions);
      this.apply(!chosen ? { a: 'proceed' } : chosen.kind === 'win' ? { a: 'win' } : chosen.kind === 'kong4' ? { a: 'kong4', kind: kindOf(chosen.tiles[0]!) } : { a: 'kong1', kind: kindOf(chosen.tile) });
    } else if (this.phase === 'discard') {
      const v = this.view(this.turn, null);
      this.opts.onDiscardDecision?.(v, this.drawnInfo?.tile ?? null);
      const d = bots[this.turn]!.chooseDiscard(v);
      this.apply({ a: 'discard', tile: d, kind: kindOf(d) });
    } else if (this.phase === 'claim') {
      const q = this.claimQueue[0]!; const dk = kindOf(this.claimTile());
      const c = bots[q.seat]!.chooseClaim(this.view(q.seat, { tile: this.claimTile(), from: this.claimFrom() }), q.options);
      this.apply(c ? this.encClaim(c, dk) : { a: 'pass' });
    }
  }
  /** Play to the end with these bots. */
  run(bots: Bot[]): GameResult {
    let guard = 0;
    while (!this.finished && guard++ < 4000) this.step(bots);
    if (!this.finished) throw new Error('game loop guard tripped');
    return this.result!;
  }
}
