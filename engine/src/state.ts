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
  animalPartner, bonusSeat, isAnimal, isBonus, isFlower, isSeason, isSuited, kindOf, rankOf, suitOf,
  type TileInstance, type TileKind,
} from './tiles.js';
import { scoreHand, type ScoreResult } from './score.js';
import { immediatePayout, meetsMinimum, winPayments, type TableConfig } from './payout.js';
import { DEFAULT_RULES, type RulesConfig } from './rules.js';
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
  pendingDiscard: { tile: TileInstance; from: number; lastTileDiscard: boolean } | null;
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
  paidEvents: Set<string>[]; counts: GameResult['counts'] = { chow: 0, pong: 0, kong: 0, flowers: 0, animals: 0, decisions: 0, illegal: 0 };
  log: string[] = []; result: GameResult | null = null;
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
      const { tile } = g.absorb(p, wall.draw(), true);
      if (tile !== null) p.hand.push(tile);
    }
    return g;
  }
  /** Rebuild from a snapshot (ground truth). */
  static fromSnapshot(snap: Snapshot, cfg: TableConfig, opts: GameOptions = {}): GameState {
    const wall = Wall.fromSnapshot(snap.wall);
    const g = new GameState(cfg, wall, { ...opts, dealer: snap.dealer, prevailingWind: snap.prevailingWind });
    g.players = snap.players.map((p) => ({ ...p, hand: [...p.hand], melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles], instances: [...m.instances] })), bonus: [...p.bonus], discards: [...p.discards], seenSinceLastDiscard: new Set(p.seenSinceLastDiscard) }));
    g.discardLog = snap.discardLog.map((e) => ({ ...e })); g.turn = snap.turn; g.phase = snap.phase; g.playerTurns = snap.playerTurns;
    g.drawnInfo = snap.drawnInfo ? { ...snap.drawnInfo } : null; g.pendingDiscard = snap.pendingDiscard ? { ...snap.pendingDiscard } : null;
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
      paidEvents: this.paidEvents.map((e) => [...e]), counts: { ...this.counts },
      claimQueue: this.claimQueue.map((q) => ({ seat: q.seat, options: q.options.map((o) => ({ ...o, tiles: o.tiles ? [...o.tiles] : undefined })) })),
      wanted: this.wanted.map((o) => ({ ...o, tiles: o.tiles ? [...o.tiles] : undefined })),
    };
  }

  // ---------------- helpers ----------------
  private L(s: string) { if (this.opts.log) this.log.push(s); }
  private pay(from: number, to: number, n: number) { this.players[from]!.chips -= n; this.players[to]!.chips += n; }
  private payAllOpponents(to: number, each: number) { for (let s = 0; s < 4; s++) if (s !== to) this.pay(s, to, each); }
  private settleBonus(p: PlayerState, fromInitial: boolean) {
    const kinds = p.bonus.map(kindOf), e = this.paidEvents[p.seat]!;
    const animals = kinds.filter(isAnimal), flowers = kinds.filter(isFlower), seasons = kinds.filter(isSeason);
    const ownPair = kinds.filter((k) => (isFlower(k) || isSeason(k)) && bonusSeat(k) === p.seat).length >= 2;
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
  private absorb(p: PlayerState, t: TileInstance | null, fromInitial: boolean): { tile: TileInstance | null; replaced: boolean } {
    let replaced = false;
    while (t !== null && isBonus(kindOf(t))) {
      p.bonus.push(t); if (isAnimal(kindOf(t))) this.counts.animals++; else this.counts.flowers++;
      this.settleBonus(p, fromInitial); replaced = true;
      t = this.wall.drawReplacement();
    }
    return { tile: t, replaced };
  }
  view(seat: number, lastDiscard: PlayerView['lastDiscard']): PlayerView {
    return {
      seat, hand: this.players[seat]!.hand, melds: this.players[seat]!.melds, bonus: this.players[seat]!.bonus,
      players: this.players.map((q) => ({ melds: q.melds, bonus: q.bonus, discards: q.discards, chips: q.chips })),
      prevailingWind: this.prevailingWind, dealer: this.dealer, wallRemaining: this.wall.remaining, playerTurns: this.playerTurns, lastDiscard, discardLog: this.discardLog, config: this.cfg,
    };
  }
  truth = (): GroundTruth => ({ hands: this.players.map((p) => [...p.hand]), wall: this.wall.snapshot(), dealer: this.dealer, prevailingWind: this.prevailingWind });
  private record(kind: DecisionKind, seat: number, v: PlayerView, legal: LegalAction[], selected: LegalAction, drawn: TileInstance | null) {
    this.counts.decisions++;
    if (!legal.some((l) => JSON.stringify(l) === JSON.stringify(selected))) this.counts.illegal++;
    this.opts.recorder?.record({ kind, seat, view: v, legal, selected, drawn, truth: this.truth });
  }
  private score(p: PlayerState, concealed: TileKind[], winningTile: TileKind, selfDraw: boolean, extra: { replacementWin?: boolean; lastTile?: boolean }) {
    return scoreHand({ concealed, melds: p.melds, bonus: p.bonus.map(kindOf), seat: p.seat, prevailingWind: this.prevailingWind, winningTile, selfDraw, ...extra }, this.rules);
  }
  private tilesAccounted() { return this.players.reduce((a, p) => a + p.hand.length + p.bonus.length + p.discards.length + p.melds.reduce((b, m) => b + m.instances.length, 0), 0); }
  private finish(winner: number | null, selfDraw: boolean, discarder: number | null, sc: ScoreResult | null): GameResult {
    if (winner !== null && sc) {
      const pays = winPayments(sc.fan, winner, discarder, this.cfg, { thirteenWonders: sc.combination === 'thirteen_wonders', rules: this.rules });
      for (let s = 0; s < 4; s++) if (pays[s]) this.pay(s, winner, pays[s]!);
    }
    this.phase = 'done';
    this.result = { winner, selfDraw, discarder, score: sc, chipsDelta: this.players.map((p) => p.chips), playerTurns: this.playerTurns, log: this.log, tilesAccounted: this.tilesAccounted(), counts: this.counts };
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
    const sc = this.score(p, p.hand.map(kindOf), kindOf(d.tile), true, { replacementWin: d.replaced, lastTile: d.lastTile });
    if (sc.valid && meetsMinimum(sc.fan, true, this.cfg)) options.push({ kind: 'win', score: sc });
    const byKind = new Map<TileKind, TileInstance[]>();
    for (const t of p.hand) { const k = kindOf(t); (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(t); }
    for (const [, ts] of byKind) if (ts.length === 4) options.push({ kind: 'kong4', tiles: ts });
    for (const m of p.melds) if (m.type === 'pong') { const t = p.hand.find((x) => kindOf(x) === m.tiles[0]); if (t !== undefined) options.push({ kind: 'kong1', meld: m, tile: t }); }
    return options;
  }
  /** compute claim options for all seats on the pending discard (prohibition uses pre-discard seen-sets) */
  private prepareClaims() {
    const { tile: d, from, lastTileDiscard } = this.pendingDiscard!;
    const dk = kindOf(d);
    this.claimQueue = []; this.wanted = [];
    for (let off = 1; off <= 3; off++) {
      const s = (from + off) % 4, q = this.players[s]!;
      if (q.lastDiscardKind === dk || q.seenSinceLastDiscard.has(dk)) continue;
      const os: ClaimOption[] = [];
      const sc = this.score(q, [...q.hand.map(kindOf), dk], dk, false, { lastTile: lastTileDiscard });
      if (sc.valid && meetsMinimum(sc.fan, false, this.cfg)) os.push({ kind: 'win', seat: s, score: sc });
      const same = q.hand.filter((t) => kindOf(t) === dk);
      if (same.length >= 3) os.push({ kind: 'kong3', seat: s, tiles: same.slice(0, 3) });
      if (same.length >= 2) os.push({ kind: 'pong', seat: s, tiles: same.slice(0, 2) });
      if (off === 1) for (const pair of this.legalChows(q, dk)) os.push({ kind: 'chow', seat: s, tiles: pair });
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
    if (this.phase === 'discard') return { kind: 'discard', seat: this.turn, legal: this.players[this.turn]!.hand.map((t): LegalAction => ({ a: 'discard', tile: t, kind: kindOf(t) })) };
    if (this.phase === 'claim' && this.claimQueue.length) {
      const q = this.claimQueue[0]!; const dk = kindOf(this.pendingDiscard!.tile);
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
      if (this.phase === 'draw' || this.phase === 'replacement') {
        const p = this.players[this.turn]!;
        const raw = this.phase === 'draw' ? this.wall.draw() : this.wall.drawReplacement();
        if (raw === null) { this.finish(null, false, null, null); return; }
        const lastTile = this.wall.isExhausted;
        const a = this.absorb(p, raw, false);
        if (a.tile === null) { this.finish(null, false, null, null); return; }
        p.hand.push(a.tile);
        this.drawnInfo = { tile: a.tile, replaced: this.phase === 'replacement' || a.replaced, lastTile };
        this.playerTurns++;
        this.selfOptions = this.computeSelfOptions();
        if (this.selfOptions.length) { this.phase = 'self'; return; }
        this.phase = 'discard'; return;
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
    if (action.a === 'win') { const o = this.selfOptions.find((x) => x.kind === 'win')!; this.L(`seat${this.turn} self-draw`); this.finish(this.turn, true, null, (o as { score: ScoreResult }).score); return; }
    if (action.a === 'kong4') {
      const o = this.selfOptions.find((x) => x.kind === 'kong4' && kindOf(x.tiles[0]!) === action.kind) as Extract<SelfAction, { kind: 'kong4' }>;
      p.hand = p.hand.filter((t) => !o.tiles.includes(t));
      p.melds.push({ type: 'kong', tiles: o.tiles.map(kindOf), concealed: true, instances: o.tiles });
      this.payAllOpponents(this.turn, immediatePayout('kong_4', this.cfg, false, this.rules)); this.counts.kong++; this.phase = 'replacement'; return;
    }
    if (action.a === 'kong1') {
      const o = this.selfOptions.find((x) => x.kind === 'kong1' && kindOf(x.tile) === action.kind) as Extract<SelfAction, { kind: 'kong1' }>;
      p.hand = p.hand.filter((t) => t !== o.tile);
      o.meld.type = 'kong'; o.meld.tiles.push(kindOf(o.tile)); o.meld.instances.push(o.tile);
      this.payAllOpponents(this.turn, immediatePayout('kong_1', this.cfg, false, this.rules)); this.counts.kong++; this.phase = 'replacement'; return;
    }
    this.phase = 'discard';
  }
  private applyDiscard(action: LegalAction) {
    if (action.a !== 'discard') throw new Error('discard expected');
    const p = this.players[this.turn]!, v = this.view(this.turn, null);
    const idx = p.hand.indexOf(action.tile);
    if (idx < 0) { this.counts.illegal++; throw new Error(`seat ${this.turn} discarded a tile it does not hold`); }
    this.record('discard', this.turn, v, p.hand.map((t): LegalAction => ({ a: 'discard', tile: t, kind: kindOf(t) })), action, this.drawnInfo?.tile ?? null);
    p.hand.splice(idx, 1); p.discards.push(action.tile);
    const dk = kindOf(action.tile);
    this.pendingDiscard = { tile: action.tile, from: this.turn, lastTileDiscard: this.wall.isExhausted };
    this.discardLog.push({ seat: this.turn, tile: action.tile, claimedBy: null, claimKind: null, turn: this.playerTurns });
    this.prepareClaims();
    // update prohibition state AFTER computing claims
    p.lastDiscardKind = dk; p.seenSinceLastDiscard.clear();
    for (const q of this.players) if (q !== p) q.seenSinceLastDiscard.add(dk);
    this.phase = 'claim';
  }
  private applyClaim(action: LegalAction) {
    const q = this.claimQueue.shift()!; const dk = kindOf(this.pendingDiscard!.tile);
    const v = this.view(q.seat, { tile: this.pendingDiscard!.tile, from: this.pendingDiscard!.from });
    this.record('claim', q.seat, v, [...q.options.map((o) => this.encClaim(o, dk)), { a: 'pass' }], action, null);
    if (action.a !== 'pass') {
      const o = q.options.find((x) => JSON.stringify(this.encClaim(x, dk)) === JSON.stringify(action));
      if (o) this.wanted.push(o);
    }
  }
  private resolveClaims() {
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
    if (taken.kind === 'win') { this.L(`seat${taken.seat} wins on seat${from}`); this.finish(taken.seat, false, from, taken.score!); return; }
    const p = this.players[from]!, q = this.players[taken.seat]!;
    p.discards.pop();
    q.hand = q.hand.filter((t) => !taken.tiles!.includes(t));
    const inst = [...taken.tiles!, d];
    q.melds.push({ type: taken.kind === 'chow' ? 'chow' : taken.kind === 'pong' ? 'pong' : 'kong', tiles: inst.map(kindOf).sort((a, b) => a - b), concealed: false, instances: inst });
    if (taken.kind === 'chow') this.counts.chow++; else if (taken.kind === 'pong') this.counts.pong++; else this.counts.kong++;
    this.playerTurns++;
    this.turn = taken.seat;
    if (taken.kind === 'kong3') { this.payAllOpponents(this.turn, immediatePayout('kong_3', this.cfg, false, this.rules)); this.phase = 'replacement'; }
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
      const q = this.claimQueue[0]!; const dk = kindOf(this.pendingDiscard!.tile);
      const c = bots[q.seat]!.chooseClaim(this.view(q.seat, { tile: this.pendingDiscard!.tile, from: this.pendingDiscard!.from }), q.options);
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
