/**
 * A quiz question is a position. This turns it back into one the engine can play.
 *
 * A pack question carries what the acting seat could see: its hand, every seat's melds, bonus
 * tiles and discards, who dealt, the wind, the turn, and which decision it was. That is enough to
 * rebuild a position that is equivalent to the recorded one for the purpose of judging it by
 * play-outs, because a play-out re-deals everything the seat cannot see anyway (`determinize`) -
 * the recorded hidden tiles were never used. What has to be exact is the visible state and the
 * bookkeeping that decides what is legal: which tiles are in hand, on the table and in the wall,
 * how many each opponent conceals, the no-throw-back rule's memory, and who is liable for whom.
 *
 * A few facts a question does not carry, and what is done about each:
 *
 *   chips moved so far this hand    not recorded. Every play-out of every action starts from the
 *                                   same balance, so an EV here is relative to the moment of the
 *                                   decision; gaps and orderings are unchanged. Set to 0.
 *   whether the drawn tile was a    not recorded. It is known after a fed kong, because that claim
 *   replacement (after a kong or    is the last thing in the log; and on a `self` question the
 *   a bonus tile)                   pack's own action list says so when `win` is legal only with
 *                                   the replacement tai. Otherwise false, which can under-price a
 *                                   `win` on a `self` question by one tai's worth.
 *   a claim on a kong being robbed  a question does not say the pending claim is a rob rather than
 *                                   a discard. It is read as one when the discard reading cannot
 *                                   be right - the seat threw that tile itself, or is barred from
 *                                   it - or does not offer the actions the pack judged.
 *   bonus tiles at the time of an   liability from the fan-limit feed rule is read against the
 *   earlier feed                    claimer's bonus tiles now rather than then; they only grow, so
 *                                   this can attach a liability a little early. Rare.
 *   the turn each discard was made  stored on each log entry; nothing in a play-out reads it.
 *                                   Set to the entry's index.
 *
 * `datagen/src/rejudgecheck.ts` measures the rebuild against the recorded positions: same best,
 * same gap within noise.
 */
import {
  GameState, tableConfigOf, visibleTai, immediatePayout, kindOf, TOTAL_TILES, KIND,
  isBonus, isFlower, isSeason, isAnimal, animalPartner, bonusSeat, isDragon, isWind, isHonour, isTerminalOrHonour, isSuited, suitOf,
  type ClaimKind, type DiscardEvent, type InstMeld, type LegalAction, type RulesConfig, type Snapshot, type TileInstance, type TileKind,
} from 'sg-mahjong-engine';
import { encAction } from './rejudge.js';

/** The slice of a pack question this needs; `datagen/src/quizpack.ts` writes the whole of it. */
export interface PackQuestion {
  /** decision kind */
  k: string;
  seat: number;
  /** dealer */
  dl: number;
  /** prevailing wind */
  w: number;
  /** player turns so far */
  t: number;
  /** the seat's concealed hand, drawn tile included */
  h: TileKind[];
  /** the tile just drawn, or null after a claim */
  dr: TileKind | null;
  /** own bonus tiles */
  b: TileKind[];
  /** own melds as [type(0 chow,1 pong,2 kong), concealed(0/1), ...kinds] */
  m: number[][];
  /** the discard being claimed, [seat, kind], on a claim question */
  ld?: [number, number];
  /** every discard this hand as [seat, kind, claimedBy or -1] */
  disc: number[][];
  /** every seat's melds, in the form of `m` */
  pm: number[][][];
  /** every seat's bonus tiles */
  pb: TileKind[][];
  /** the actions the pack judged; when given, a `self` question's `win` is used to settle whether
   *  the drawn tile was a replacement (see the file comment) */
  actions?: { a: string }[];
}

/** the meld type a pack row encodes */
const meldType = (row: number[]): 'chow' | 'pong' | 'kong' => (row[0] === 0 ? 'chow' : row[0] === 1 ? 'pong' : 'kong');

/**
 * Hands out tile instances for kinds. Standard kinds have four instances each, laid out
 * consecutively; each bonus kind has one; the wildcards sit last and share a kind. Asking for a
 * fifth copy of a kind means the question is inconsistent, and that is an error rather than a
 * silent reuse.
 */
class Instances {
  private next = new Map<TileKind, number>();
  readonly jokers: number;
  readonly total: number;
  constructor(jokers: number) { this.jokers = jokers; this.total = TOTAL_TILES + jokers; }
  take(k: TileKind): TileInstance {
    const n = this.next.get(k) ?? 0;
    this.next.set(k, n + 1);
    if (k < KIND.STANDARD_COUNT) { if (n >= 4) throw new Error(`question shows more than four of kind ${k}`); return 4 * k + n; }
    if (k < KIND.JOKER) { if (n >= 1) throw new Error(`question shows bonus kind ${k} twice`); return 4 * KIND.STANDARD_COUNT + (k - KIND.FLOWER); }
    if (n >= this.jokers) throw new Error(`question shows more than ${this.jokers} wildcards`);
    return TOTAL_TILES + n;
  }
  /** every instance not yet handed out */
  rest(): TileInstance[] {
    const out: TileInstance[] = [];
    for (let k = 0; k < KIND.STANDARD_COUNT; k++) for (let n = this.next.get(k) ?? 0; n < 4; n++) out.push(4 * k + n);
    for (let k = KIND.FLOWER; k < KIND.JOKER; k++) if (!(this.next.get(k) ?? 0)) out.push(4 * KIND.STANDARD_COUNT + (k - KIND.FLOWER));
    for (let n = this.next.get(KIND.JOKER) ?? 0; n < this.jokers; n++) out.push(TOTAL_TILES + n);
    return out;
  }
}

/**
 * Is `dk`, claimed into a hand whose melds are `melds`, a tile the table holds the feeder for?
 * The same test the engine makes at the feed (`GameState.baoTile`), read against the melds as they
 * stand with the claimed set included.
 */
function baoTile(rules: RulesConfig, melds: InstMeld[], bonus: TileKind[], role: number, prevailingWind: number, dk: TileKind, fanLimit: number): boolean {
  const b = rules.bao;
  const heads = melds.map((m) => m.tiles[0]!);
  const honourSets = melds.filter((m) => m.type !== 'chow' && isHonour(m.tiles[0]!));
  const dragons = honourSets.filter((m) => isDragon(m.tiles[0]!)).length, winds = honourSets.filter((m) => isWind(m.tiles[0]!)).length;
  if (isDragon(dk) && b.dragon_set_feed && dragons >= 3) return true;
  if (isWind(dk) && b.wind_set_feed && winds >= 4) return true;
  if (b.terminal_set_feed && isTerminalOrHonour(dk) && melds.length >= 3 && melds.every((m) => m.type !== 'chow') && heads.every(isTerminalOrHonour)) return true;
  if (b.colour_set_feed && isSuited(dk) && melds.length >= 3 && heads.every(isSuited) && new Set(heads.map(suitOf)).size === 1) return true;
  if (b.fan_limit_feed && isTerminalOrHonour(dk)) {
    const seen = visibleTai({ melds, bonus, seat: role, prevailingWind }, rules);
    if (seen >= fanLimit) return true;
  }
  return false;
}

/** The bite payments a seat has already collected, read off the bonus tiles it holds, so a
 *  play-out cannot pay them a second time. Ids as `GameState.settleBonus` writes them. */
function paidEventsOf(rules: RulesConfig, bonus: TileKind[], role: number): string[] {
  const out: string[] = [];
  if (rules.money) {
    for (let n = 0; n < 4; n++) if (bonus.includes(KIND.FLOWER + n) && bonus.includes(KIND.SEASON + n)) out.push(`bite_flowers_${n}`);
    if (bonus.includes(42) && bonus.includes(43)) out.push('bite_cat_mouse');
    if (bonus.includes(44) && bonus.includes(45)) out.push('bite_rooster_centipede');
    return out;
  }
  const animals = bonus.filter(isAnimal), flowers = bonus.filter(isFlower), seasons = bonus.filter(isSeason);
  if (animals.length === 4) out.push('animal_set');
  else if (bonus.some((k) => isAnimal(k) && bonus.includes(animalPartner(k) as TileKind))) out.push('animal_pair');
  if (flowers.length === 4) out.push('flower_set');
  if (seasons.length === 4) out.push('season_set');
  if (bonus.filter((k) => (isFlower(k) || isSeason(k)) && bonusSeat(k) === role).length >= 2) out.push('flower_pair');
  return out;
}

/**
 * Build a Snapshot from a pack question, with the decision it asks about pending.
 *
 * The result is ground truth in form only: the opponents' concealed tiles and the wall are filled
 * with the unseen tiles in an arbitrary order, and `rejudge` re-deals them for every play-out. What
 * is exact is everything that was visible, and the sizes of everything that was not.
 */
export function snapshotFromQuestion(q: PackQuestion, rules: RulesConfig): Snapshot {
  if (q.dl === undefined || !q.disc || !q.pm || !q.pb) throw new Error('this question predates the table fields (dl, disc, pm, pb) and cannot be rebuilt');
  if (q.k !== 'discard' && q.k !== 'claim' && q.k !== 'self') throw new Error(`unknown decision kind ${q.k}`);
  const inst = new Instances(rules.jokers.count);
  const cfg = tableConfigOf(rules);
  const role = (s: number) => (s - q.dl + 4) % 4;

  // ---- every seat's melds and bonus tiles, with instances ----
  const meldsOf = (s: number): number[][] => (s === q.seat ? q.m : q.pm[s] ?? []);
  const melds: InstMeld[][] = [0, 1, 2, 3].map((s) => meldsOf(s).map((row) => {
    const tiles = row.slice(2);
    return { type: meldType(row), tiles: [...tiles], concealed: row[1] === 1, instances: tiles.map((k) => inst.take(k)) };
  }));
  const bonus: TileInstance[][] = [0, 1, 2, 3].map((s) => (s === q.seat ? q.b : q.pb[s] ?? []).map((k) => inst.take(k)));
  const hand = q.h.map((k) => inst.take(k));

  // ---- the discard log, in order: floor tiles, the no-throw-back memory, and who fed whom ----
  // A claimed discard lives in the claimer's meld, so its log entry borrows an instance from
  // there; the k-th claim a seat made is its k-th exposed meld, because melds are kept in the
  // order they were made.
  const floor: TileInstance[][] = [[], [], [], []];
  const log: DiscardEvent[] = [];
  const lastDiscardKind: (TileKind | null)[] = [null, null, null, null];
  const seen: Set<TileKind>[] = [new Set(), new Set(), new Set(), new Set()];
  const claimsSeen = [0, 0, 0, 0];                       // exposed melds matched so far, per seat
  const borrowed = new Set<TileInstance>();
  const liable: (number | null)[] = [null, null, null, null];
  const kongFedBy: (number | null)[] = [null, null, null, null];
  let eligible: number[] = [];
  const isClaimQ = q.k === 'claim';
  q.disc.forEach((row, i) => {
    const [s, kind, claimedBy] = [row[0]!, row[1]!, row[2] ?? -1];
    let tile: TileInstance; let claimKind: ClaimKind | null = null;
    if (claimedBy >= 0) {
      const exposed = melds[claimedBy]!.map((m, idx) => ({ m, idx })).filter((x) => !x.m.concealed);
      let at = claimsSeen[claimedBy]!;
      while (at < exposed.length && !exposed[at]!.m.tiles.includes(kind)) at++;
      const hit = exposed[at];
      if (!hit) throw new Error(`discard ${i} (kind ${kind}) was claimed by seat ${claimedBy} but no exposed meld of theirs holds it`);
      claimsSeen[claimedBy] = at + 1;
      tile = hit.m.instances.find((t, j) => hit.m.tiles[j] === kind && !borrowed.has(t))!;
      borrowed.add(tile);
      // an exposed kong claimed just now was fed; an older one may equally be a pong later completed
      // from hand, and nothing visible tells the two apart - nothing in a play-out reads it either
      claimKind = hit.m.type === 'kong' ? (i === q.disc.length - 1 ? 'kong3' : 'pong') : hit.m.type;
      // liability attaches at the feed, against the melds the claimer had down at that moment:
      // everything up to this one in the order they were made
      const then = melds[claimedBy]!.slice(0, hit.idx + 1);
      if (rules.bao.enabled && baoTile(rules, then, q.pb[claimedBy] ?? [], role(claimedBy), q.w, kind, cfg.fan_limit)) liable[claimedBy] = s;
    } else {
      tile = inst.take(kind);
      floor[s]!.push(tile);
    }
    log.push({ seat: s, tile, claimedBy: claimedBy >= 0 ? claimedBy : null, claimKind, turn: i + 1 });
    // the claim being asked about is the last discard: who may claim it was decided before the
    // memory was updated for it
    if (isClaimQ && i === q.disc.length - 1) {
      for (let off = 1; off <= 3; off++) { const c = (s + off) % 4; if (!(lastDiscardKind[c] === kind || seen[c]!.has(kind))) eligible.push(c); }
    }
    lastDiscardKind[s] = kind; seen[s]!.clear();
    for (let o = 0; o < 4; o++) if (o !== s) seen[o]!.add(kind);
  });
  for (let s = 0; s < 4; s++) if (claimsSeen[s]! !== melds[s]!.filter((m) => !m.concealed).length) throw new Error(`seat ${s} has ${melds[s]!.filter((m) => !m.concealed).length} exposed melds but the log shows ${claimsSeen[s]} claims`);
  const last = log[log.length - 1];
  // a fed kong's replacement draw is live only while that claim is the last thing that happened:
  // the seat is now deciding on the replacement, and its next discard would have spent it
  if (last && last.claimedBy !== null && last.claimKind === 'kong3') kongFedBy[last.claimedBy] = last.seat;
  if (isClaimQ && !last) throw new Error('a claim question needs a discard log');

  // ---- what each opponent conceals, and what is left for the wall ----
  // A seat holds 13 tiles plus one while it is deciding what to throw; a meld stands in for three
  // of them (a kong's fourth came with a replacement draw). The acting seat's hand is given.
  const concealed = (s: number) => 13 - 3 * melds[s]!.length;
  const expectMine = concealed(q.seat) + (q.k === 'claim' ? 0 : 1);
  if (hand.length !== expectMine) throw new Error(`a ${q.k} question with ${melds[q.seat]!.length} melds should show ${expectMine} tiles in hand, not ${hand.length}`);
  const unseen = inst.rest();
  // placeholder hands from the standard tiles among the unseen, as the re-deal will lay them out
  const standard = unseen.filter((t) => !isBonus(kindOf(t)));
  const hands: TileInstance[][] = [[], [], [], []];
  let si = 0;
  for (let s = 0; s < 4; s++) {
    if (s === q.seat) { hands[s] = hand; continue; }
    const n = concealed(s);
    if (si + n > standard.length) throw new Error('not enough unseen tiles to fill the opponents\' hands');
    hands[s] = standard.slice(si, si + n); si += n;
  }
  const inHands = new Set(hands.flat());
  const wallLive = unseen.filter((t) => !inHands.has(t));
  // the wall's order holds every tile in the game; the ones already drawn sit before the cursor
  const live = new Set(wallLive);
  const order: TileInstance[] = [];
  for (let t = 0; t < inst.total; t++) if (!live.has(t)) order.push(t);
  const front = order.length;
  order.push(...wallLive);
  const back = order.length - 1;
  if (order.length !== inst.total) throw new Error(`tile accounting: ${order.length} of ${inst.total}`);
  const remaining = back - front + 1 - rules.unplayable_tiles;
  const exhausted = remaining <= 0;

  // ---- the decision that is pending ----
  const drawnTile = q.dr === null ? null : hand[q.h.indexOf(q.dr)] ?? null;
  if (q.k === 'self' && drawnTile === null) throw new Error('a self question needs the drawn tile');
  // a seat deciding on a tile it drew straight after its kong claim drew it as a replacement
  const replaced = !isClaimQ && drawnTile !== null && last !== undefined && last.claimedBy === q.seat && last.claimKind === 'kong3';
  const snap: Snapshot = {
    players: [0, 1, 2, 3].map((s) => ({
      seat: s, hand: hands[s]!, melds: melds[s]!, bonus: bonus[s]!, discards: floor[s]!,
      lastDiscardKind: lastDiscardKind[s]!, seenSinceLastDiscard: [...seen[s]!], chips: 0,
    })),
    wall: { order, front, back, unplayable: rules.unplayable_tiles },
    discardLog: log,
    dealer: q.dl, prevailingWind: q.w, turn: isClaimQ ? q.ld![0] : q.seat, phase: q.k as Snapshot['phase'], playerTurns: q.t,
    drawnInfo: !isClaimQ && drawnTile !== null ? { tile: drawnTile, replaced, lastTile: exhausted } : null,
    pendingDiscard: null, pendingRob: null,
    liable, kongFedBy,
    paidEvents: [0, 1, 2, 3].map((s) => paidEventsOf(rules, (s === q.seat ? q.b : q.pb[s]) ?? [], role(s))),
    counts: { chow: 0, pong: 0, kong: 0, flowers: 0, animals: 0, decisions: 0, illegal: 0 },
    claimQueue: [], wanted: [],
  };
  if (q.k === 'self' && q.actions?.some((x) => x.a === 'win') && !snap.drawnInfo!.replaced) {
    // the pack could declare a win here; if this position cannot, the one tai it is short is the
    // replacement tai, so the draw was a replacement after a kong or a bonus tile this turn
    const offers = (sn: Snapshot) => pendingOf(sn, rules).legal.some((l) => l.a === 'win');
    if (!offers(snap)) {
      snap.drawnInfo = { ...snap.drawnInfo!, replaced: true };
      if (!offers(snap)) throw new Error('the pack lists a win this position cannot declare');
    }
  }
  if (!isClaimQ) return snap;

  // ---- a claim: on the last discard, or on a kong being robbed ----
  // A question does not say which. Almost every claim is on the last discard, and that reading is
  // taken whenever the seat may make it and it offers what the pack judged. When it cannot - the
  // last discard was the seat's own, or the seat is barred from it - the claim is on a kong: some
  // seat drew after that discard and declared one, and this seat can win on the kong tile. That
  // seat is the one whose turn it was, and the kong is whichever of its kongs gives this seat a
  // win, which the engine's own claim builder decides. Either way the claim queue is built from
  // the hands as they stand with the acting seat first, exactly as every play-out rebuilds it.
  const legalOf = (sn: Snapshot) => [...new Set(pendingOf(sn, rules).legal.map(encAction))].sort().join(' ');
  const packLegal = q.actions ? q.actions.map((x) => x.a).sort().join(' ') : null;
  const withQueue = (sn: Snapshot): Snapshot | null => {
    const g = GameState.fromSnapshot(sn, cfg, { rules });
    g.rebuildClaims(q.seat);
    const out = g.snapshot();
    return out.claimQueue[0]?.seat === q.seat ? out : null;
  };
  const onDiscard = (): Snapshot | null => {
    if (last!.claimedBy !== null || last!.seat === q.seat || !eligible.includes(q.seat)) return null;
    if (q.ld && (q.ld[0] !== last!.seat || q.ld[1] !== kindOf(last!.tile))) throw new Error('the claimed discard is not the last one in the log');
    return withQueue({ ...snap, turn: last!.seat, pendingDiscard: { tile: last!.tile, from: last!.seat, lastTileDiscard: exhausted, eligible } });
  };
  const onKong = (): Snapshot | null => {
    const konger = last!.claimedBy ?? (last!.seat + 1) % 4;
    for (const [idx, m] of melds[konger]!.entries()) {
      if (m.type !== 'kong' || konger === q.seat) continue;
      const kong = m.concealed ? 'kong4' : 'kong1';
      const feeEach = rules.money ? (m.concealed ? rules.money.kong_concealed_each : rules.money.kong_exposed_each) : immediatePayout(m.concealed ? 'kong_4' : 'kong_1', cfg, false, rules);
      const out = withQueue({ ...snap, turn: konger, pendingRob: { tile: m.instances[m.instances.length - 1]!, from: konger, kong, meldIndex: idx, feeEach } });
      if (out) return out;
    }
    return null;
  };
  const fits = (sn: Snapshot | null) => sn !== null && (packLegal === null || legalOf(sn) === packLegal);
  const asDiscard = onDiscard();
  if (fits(asDiscard)) return asDiscard!;
  const asRob = onKong();
  if (fits(asRob)) return asRob!;
  if (asDiscard) return asDiscard;
  if (asRob) return asRob;
  throw new Error(`seat ${q.seat} has no claim to make: not on the last discard, and no kong to rob`);
}

/** The decision a rebuilt snapshot has pending: its kind, seat and the distinct legal actions. */
export function pendingOf(snap: Snapshot, rules: RulesConfig): { kind: string; seat: number; legal: LegalAction[] } {
  const g = GameState.fromSnapshot(snap, tableConfigOf(rules), { rules });
  const p = g.pending();
  if (!p) throw new Error(`no decision pending in phase ${snap.phase}`);
  return p;
}
