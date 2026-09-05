/**
 * Which of the book's shape tips, if any, is the point of THIS decision.
 *
 * `shapes.ts` teaches the tips on hands we made up. That is the wrong way round for practice: a
 * question that announces "this one is about the pair rule" has already answered the hardest part,
 * which is noticing that the pair rule is what you are looking at. So the quiz shows a real position
 * with nothing attached, and a tip is named only AFTERWARDS, when the answer is revealed.
 *
 * For that to happen the pack has to know which positions are about which tip, and that is this
 * file. Each detector below reads a hand and returns a call: the tip, the discards that follow it,
 * the discards that go against it, and one sentence about these particular tiles. A position counts
 * as being ABOUT a tip only when both sides of the call are legal throws - if the tempting mistake
 * is not even available, the tip is not what the question turns on.
 *
 * WHAT IT DOES NOT DO. It never says the tip is right. Whether the tip's tile is also the measured
 * best answer is a separate question, and the graded pack can answer it position by position, which
 * is a stronger test of the book than any of the counting in `shapes.ts`. Keeping the two apart is
 * the whole point: this file spots the shape, the play-outs judge it.
 *
 * Nine tips are spotted here and the rest are not. Six of them can be read off the tiles without
 * anything being agreed first. `five_blocks` and `six_blocks_ok` need a hand split into blocks, and
 * the split is `blocks` below: the most generous reading, with the tie between equally generous
 * readings settled in a fixed order, so the same tiles always come out as the same blocks.
 * `narrow_can_beat_wide` needs the hand scored for tai, which a `TableView` supplies.
 *
 * The wait tips - `bad_wait_ranking` and `edge_waits_stronger` - are the interesting pair, because
 * they can now be answered two ways that know nothing about each other. `release.ts` counts what the
 * table actually throws late in a hand, and this asks whether the play-outs are worth more chips
 * when you take the wait the book prefers. Two roads to the same claim is worth more than either.
 */
import { countsAndJokers, isHonour, isJoker, isSuited, rankOf, scoreHand, shanten, winningKinds as engineWinningKinds, type Meld, type TileKind } from 'sg-mahjong-engine';
import { ukeire } from './tips.js';

/**
 * What a card needs to know about the table, for the tips that cannot be read off the tiles alone.
 *
 * `narrow_can_beat_wide` is the reason this exists: whether a winning tile can actually be declared
 * depends on the minimum, on your seat wind, on the round, and on the flowers in front of you. A
 * caller that cannot supply this gets the tile-only detectors and nothing else.
 */
export interface TableView {
  bonus: readonly TileKind[];
  seat: number;
  prevailingWind: number;
  minimumFan: number;
  selfDrawMinimumFan: number;
  /**
   * The sets already on the table, which a hand cannot be scored without.
   *
   * Optional, and the detector that needs it stays quiet rather than guessing: scoring a melded hand
   * as though it were concealed would call a legal wait dead and put a wrong card in front of a
   * reader. Must match the meld COUNT passed alongside it or it is ignored.
   */
  melds?: readonly Meld[];
}

export interface ShapeCall {
  /** the id of the card in TIPS */
  tip: string;
  /** throws that follow the tip */
  says: TileKind[];
  /** throws it warns against - the tempting ones */
  against: TileKind[];
  /** one sentence about these tiles, in the tip's own terms */
  because: string;
}

const SUIT = ['萬', '筒', '條'];
const name = (k: TileKind) => (isSuited(k) ? `${rankOf(k)}${SUIT[Math.floor(k / 9)]}` : ['東', '南', '西', '北', '中', '發', '白'][k - 27]!);

const countsOf = (tiles: TileKind[]) => {
  const c = new Array<number>(34).fill(0);
  for (const k of tiles) if (k < 34) c[k]! += 1;
  return c;
};
const suitBase = (k: TileKind) => k - (k % 9);
/** other tiles of the same suit within two ranks, ignoring the kinds named in `blind` */
function neighbours(c: number[], k: TileKind, blind: TileKind[] = []): number {
  if (!isSuited(k)) return 0;
  const base = suitBase(k), r = rankOf(k);
  let n = 0;
  for (let d = -2; d <= 2; d++) {
    if (d === 0) continue;
    const r2 = r + d;
    if (r2 < 1 || r2 > 9) continue;
    const x = (base + r2 - 1) as TileKind;
    if (!blind.includes(x)) n += c[x]!;
  }
  return n;
}
/** single tiles with nothing near them: the spares a hand throws first */
function spares(c: number[]): TileKind[] {
  const out: TileKind[] = [];
  for (let k = 0 as TileKind; k < 34; k++) {
    if (c[k] !== 1) continue;
    if (isHonour(k) || neighbours(c, k) === 0) out.push(k);
  }
  return out;
}

/**
 * What a block is, once the hand has been split.
 *
 * `set` is a finished triplet or run. `pair` is two of a kind. The other three are two tiles that
 * could become a run, named by the wait they make: `open` is two adjacent tiles that can be finished
 * from either side, `edge` is 1-2 or 8-9 which only one tile finishes, and `gap` is two tiles with a
 * hole between them, which the book calls a middle wait. Anything left over is a spare, not a block.
 */
export type BlockKind = 'set' | 'pair' | 'open' | 'edge' | 'gap';
export interface Block { kind: BlockKind; tiles: TileKind[] }

/**
 * The hand split into blocks - sets, pairs and two-tile pieces that could become runs.
 *
 * The book's first rule is that a winning hand is five blocks and a sixth is tiles you will throw
 * later. To spot a position where that decision is live, something has to agree on what a block is,
 * and this is the agreement. It takes the most generous reading: at each rank, try it as a triplet,
 * as a run, as a pair, as two adjacent tiles, as two tiles with a gap, or as a spare, and keep
 * whichever branch yields the most blocks. Honours can only be triplets or pairs.
 *
 * Generous on purpose. A tip about cutting the sixth block should only fire where six can honestly
 * be seen, and a mean counter would call a six-block hand five and never fire at all. It means
 * 2-3-4-5 is read as two open pieces rather than one long run, which is the reading the tip wants:
 * the question it asks is how many pieces you are carrying, not how many you will end up with.
 *
 * When two readings give the same number of blocks, the tie goes to the one with more finished
 * sets, then more pairs, then more open pieces, then more gap pieces. So 1-2-3 is a set rather than
 * an edge piece with a spare 3, and 2-4-5 is 45 with a spare 2 rather than 24 with a spare 5. The
 * order matters because `six_blocks_ok` asks which two blocks are the WEAKEST, and a reading that
 * hid an open piece inside a gap one would answer that wrongly.
 */
export function blocks(tiles: TileKind[]): Block[] {
  const c = countsOf(tiles);
  const out: Block[] = [];
  for (let k = 27 as TileKind; k < 34; k++) {
    if (c[k]! >= 3) out.push({ kind: 'set', tiles: [k, k, k] });
    else if (c[k]! === 2) out.push({ kind: 'pair', tiles: [k, k] });
  }
  for (const base of [0, 9, 18]) out.push(...suitBlocks(c.slice(base, base + 9), 0, new Map()).blocks.map((b) => ({ kind: b.kind, tiles: b.tiles.map((r) => (base + r) as TileKind) })));
  return out;
}
/** how many blocks the hand splits into under `blocks` */
export function blockCount(tiles: TileKind[]): number {
  return blocks(tiles).length;
}
interface Split { score: number; blocks: Block[] }
/** count first, then sets, pairs, open, gap - each place is small enough never to carry into the next */
const splitScore = (bs: Block[]) => {
  let sets = 0, pairs = 0, open = 0, gap = 0;
  for (const b of bs) { if (b.kind === 'set') sets++; else if (b.kind === 'pair') pairs++; else if (b.kind === 'open') open++; else if (b.kind === 'gap') gap++; }
  return bs.length * 1e5 + sets * 1e4 + pairs * 1e3 + open * 1e2 + gap * 10;
};
/** `n` is the counts of one suit by rank offset 0-8; the blocks come back with those offsets as tiles */
function suitBlocks(n: number[], i: number, memo: Map<string, Split>): Split {
  while (i < 9 && n[i] === 0) i++;
  if (i >= 9) return { score: 0, blocks: [] };
  const key = `${i}:${n.join('')}`;
  const hit = memo.get(key); if (hit !== undefined) return hit;
  let best: Split = { score: -1, blocks: [] };
  const consider = (piece: Block | null, drops: [number, number][]) => {
    for (const [at, howMany] of drops) n[at]! -= howMany;
    const rest = suitBlocks(n, i, memo);
    for (const [at, howMany] of drops) n[at]! += howMany;
    const bs = piece ? [piece, ...rest.blocks] : rest.blocks;
    const score = splitScore(bs);
    if (score > best.score) best = { score, blocks: bs };
  };
  const r = i + 1;   // rank 1-9, for naming the edge pieces
  if (n[i]! >= 3) consider({ kind: 'set', tiles: [i, i, i] }, [[i, 3]]);
  if (i + 2 < 9 && n[i]! >= 1 && n[i + 1]! >= 1 && n[i + 2]! >= 1) consider({ kind: 'set', tiles: [i, i + 1, i + 2] }, [[i, 1], [i + 1, 1], [i + 2, 1]]);
  if (n[i]! >= 2) consider({ kind: 'pair', tiles: [i, i] }, [[i, 2]]);
  if (i + 1 < 9 && n[i + 1]! >= 1) consider({ kind: r === 1 || r === 8 ? 'edge' : 'open', tiles: [i, i + 1] }, [[i, 1], [i + 1, 1]]);
  if (i + 2 < 9 && n[i + 2]! >= 1) consider({ kind: 'gap', tiles: [i, i + 2] }, [[i, 1], [i + 2, 1]]);
  consider(null, [[i, 1]]);           // a spare, worth no block at all
  memo.set(key, best);
  return best;
}

/** the kinds that would finish a hand already ready */
function winningKinds(tiles: TileKind[], melds: number): TileKind[] {
  const c = countsOf(tiles), out: TileKind[] = [];
  for (let k = 0 as TileKind; k < 34; k++) {
    if (c[k]! >= 4) continue;
    if (shanten([...tiles, k], melds) < 0) out.push(k);
  }
  return out;
}

/**
 * The tips this position is about.
 *
 * `concealed` is the hand in the player's own tiles including the one just drawn, and `melds` the
 * number of sets already exposed. A hand holding a joker or a bonus tile is not tagged at all: every
 * tip here is about ordinary tile shape, and a wildcard makes the shape mean something else.
 */
export function shapeCalls(concealed: TileKind[], melds: number, view?: TableView): ShapeCall[] {
  if (concealed.some((k) => isJoker(k) || k >= 34)) return [];
  const c = countsOf(concealed);
  const distinct = [...new Set(concealed)];
  const loose = spares(c);
  const calls: ShapeCall[] = [];

  // threes_and_sevens: two loose tiles, and the tip picks between them
  const suitedLoose = loose.filter(isSuited);
  const edgey = suitedLoose.filter((k) => rankOf(k) === 3 || rankOf(k) === 7);
  const middling = suitedLoose.filter((k) => rankOf(k) >= 4 && rankOf(k) <= 6);
  if (edgey.length && middling.length) {
    calls.push({
      tip: 'threes_and_sevens', says: middling, against: edgey,
      because: `${name(edgey[0]!)} and ${name(middling[0]!)} are both loose tiles. The ${rankOf(edgey[0]!)} grows into a wait that reaches the edge, where tiles come out; the ${rankOf(middling[0]!)} grows into a wait in the middle, where they do not.`,
    });
  }

  // triplet_adjacency: a spare sitting beside your own triplet, against a spare sitting elsewhere
  for (let k = 0 as TileKind; k < 34; k++) {
    if (c[k]! < 3 || !isSuited(k)) continue;
    const beside = distinct.filter((x) => isSuited(x) && c[x] === 1 && suitBase(x) === suitBase(k)
      && Math.abs(rankOf(x) - rankOf(k)) <= 2 && neighbours(c, x, [k]) === 0);
    const elsewhere = loose.filter((x) => !beside.includes(x));
    if (beside.length && elsewhere.length) {
      calls.push({
        tip: 'triplet_adjacency', says: beside, against: elsewhere,
        because: `You hold three ${name(k)} yourself, so the ${name(beside[0]!)} next to them has fewer tiles left to grow with than ${name(elsewhere[0]!)} has.`,
      });
    }
  }

  // pair_rule: three pairs and something loose, so the choice is break one or keep them all
  const pairs = distinct.filter((k) => c[k] === 2);
  if (pairs.length >= 3 && loose.length) {
    calls.push({
      tip: 'pair_rule', says: pairs, against: loose,
      because: `Three pairs — ${pairs.slice(0, 3).map(name).join(', ')} — and they all finish the same way, on the two copies left. The tip breaks one rather than throwing a tile that could still become a run.`,
    });
  }

  // every throw that leaves the hand ready, with the wait it leaves: the ground the wait tips stand on
  const ready = distinct
    .map((k) => { const rest = concealed.filter((_, i) => i !== concealed.indexOf(k)); return { k, rest }; })
    .filter(({ rest }) => shanten(rest, melds) === 0)
    .map(({ k, rest }) => { const u = ukeire(rest, melds); return { k, width: u.count, on: winningKinds(rest, melds) }; });

  // escape_single_waits: more than one way to stay ready, and the widths are not close
  if (ready.length >= 2) {
    const widest = Math.max(...ready.map((r) => r.width)), narrowest = Math.min(...ready.map((r) => r.width));
    if (narrowest <= 4 && widest >= 2 * narrowest) {
      calls.push({
        tip: 'escape_single_waits', says: ready.filter((r) => r.width === widest).map((r) => r.k),
        against: ready.filter((r) => r.width === narrowest).map((r) => r.k),
        because: `Two ways to stay ready. Throwing ${name(ready.find((r) => r.width === widest)!.k)} leaves you waiting on ${widest} tiles; throwing ${name(ready.find((r) => r.width === narrowest)!.k)} leaves ${narrowest}.`,
      });
    }
  }

  /**
   * bad_wait_ranking and edge_waits_stronger: two waits the same size, made of different tiles.
   *
   * Both tips say the same thing in different places - a wait is worth what the table will throw
   * you, and two waits of the same width are not worth the same. So they are spotted the same way:
   * among the throws that leave the hand ready, look for two whose waits are equally wide and then
   * ask which tiles they sit on. Anything with a different width is `escape_single_waits`, above.
   */
  const byWidth = new Map<number, typeof ready>();
  for (const r of ready) { let g = byWidth.get(r.width); if (!g) byWidth.set(r.width, g = []); g.push(r); }
  for (const group of byWidth.values()) {
    if (group.length < 2) continue;
    // waiting on one kind: the book ranks a terminal above a 2 or an 8, and both above a middle tile
    const single = group.filter((r) => r.on.length === 1);
    const ends = single.filter((r) => isSuited(r.on[0]!) && (rankOf(r.on[0]!) === 1 || rankOf(r.on[0]!) === 9));
    const middles = single.filter((r) => isSuited(r.on[0]!) && rankOf(r.on[0]!) >= 4 && rankOf(r.on[0]!) <= 6);
    if (ends.length && middles.length) {
      calls.push({
        tip: 'bad_wait_ranking', says: ends.map((r) => r.k), against: middles.map((r) => r.k),
        because: `Two waits of the same size: throw ${name(ends[0]!.k)} and you wait on ${name(ends[0]!.on[0]!)}, throw ${name(middles[0]!.k)} and you wait on ${name(middles[0]!.on[0]!)}. The terminal keeps coming out all game; the middle tile sits in other hands.`,
      });
    }
    // waiting on two kinds: the book takes the pair of tiles nearer the edge
    const two = group.filter((r) => r.on.length === 2 && r.on.every(isSuited));
    if (two.length >= 2) {
      const edgeness = (r: { on: TileKind[] }) => r.on.reduce((a, k) => a + Math.min(rankOf(k), 10 - rankOf(k)), 0) / 2;
      const lowest = Math.min(...two.map(edgeness)), highest = Math.max(...two.map(edgeness));
      const lows = two.filter((r) => edgeness(r) === lowest), highs = two.filter((r) => edgeness(r) === highest);
      const low = lows[0]!, high = highs[0]!;
      // one rank apart is the book's own comparison - waiting on 1 and 4 against waiting on 2 and 5
      if (highest - lowest >= 1) {
        calls.push({
          tip: 'edge_waits_stronger', says: lows.map((r) => r.k), against: highs.map((r) => r.k),
          because: `Two waits of the same size: throw ${name(low.k)} and you wait on ${low.on.map(name).join(' or ')}, throw ${name(high.k)} and you wait on ${high.on.map(name).join(' or ')}. The book takes the pair nearer the edge, because that is where tiles are released.`,
        });
      }
    }
  }

  /**
   * five_blocks and six_blocks_ok: six blocks on the board, and a throw that would cut one.
   *
   * They are one rule and its exception, so they are spotted together and never on the same hand.
   * The rule says cut to five. The exception says keep six while the two weakest blocks are both gap
   * waits, because you would be choosing between them before the wall has said which one fills. So
   * the hand is split, the pieces that are not yet sets or pairs are ranked - an open piece above a
   * gap piece above an edge piece, by what finishes it - and the two weakest decide which card this
   * is. Either way the choice on the table is the same: a throw that keeps all six blocks at no cost
   * in distance, against a throw that cuts one.
   */
  const split = blocks(concealed);
  if (split.length >= 6) {
    const cuts: TileKind[] = [], keeps: TileKind[] = [];
    for (const k of distinct) {
      const rest = concealed.filter((_, i) => i !== concealed.indexOf(k));
      if (shanten(rest, melds) !== shanten(concealed, melds)) continue;   // only throws that cost nothing
      (blockCount(rest) <= 5 ? cuts : keeps).push(k);
    }
    const strength: Record<BlockKind, number> = { set: 3, pair: 3, open: 2, gap: 1, edge: 0 };
    const pieces = split.filter((b) => b.kind !== 'set' && b.kind !== 'pair').sort((a, b) => strength[a.kind] - strength[b.kind]);
    const weakest = pieces.slice(0, 2);
    const exception = weakest.length === 2 && weakest.every((b) => b.kind === 'gap');
    if (exception) {
      // the tempting throw is one that breaks either of the two gap pieces
      const weakTiles = new Set(weakest.flatMap((b) => b.tiles));
      const breaks = cuts.filter((k) => weakTiles.has(k));
      if (keeps.length && breaks.length) {
        const [a, b] = weakest as [Block, Block];
        calls.push({
          tip: 'six_blocks_ok', says: keeps, against: breaks,
          because: `Six blocks, and the two weakest - ${a.tiles.map(name).join('')} and ${b.tiles.map(name).join('')} - are both gap waits. The book keeps both and throws ${name(keeps[0]!)} instead, and lets the wall say which one fills.`,
        });
      }
    } else if (cuts.length && keeps.length) {
      calls.push({
        tip: 'five_blocks', says: cuts, against: keeps,
        because: `There are six blocks here and a hand needs five. Throwing ${name(cuts[0]!)} cuts one and costs nothing; throwing ${name(keeps[0]!)} keeps all six.`,
      });
    }
  }

  // narrow_can_beat_wide: a wait that cannot be declared, and a narrower one that can
  if (view && (view.melds?.length ?? 0) === melds) {
    const declarable = (rest: TileKind[]) => {
      const cj = countsAndJokers(rest);
      let live = 0, dead = 0;
      for (const k of engineWinningKinds(cj.counts, 4 - melds)) {
        const held = rest.filter((x) => x === k).length;
        const left = 4 - held;
        if (left <= 0) continue;
        const win = { concealed: [...rest, k], melds: [...(view.melds ?? [])] as Meld[], bonus: [...view.bonus], seat: view.seat, prevailingWind: view.prevailingWind, winningTile: k, selfDraw: false };
        const shot = scoreHand(win);
        if (shot.valid && shot.fan >= view.minimumFan) live += left; else dead += left;
      }
      return { live, dead };
    };
    const ready = distinct
      .map((k) => ({ k, rest: concealed.filter((_, i) => i !== concealed.indexOf(k)) }))
      .filter(({ rest }) => shanten(rest, melds) === 0)
      .map(({ k, rest }) => ({ k, ...declarable(rest) }));
    if (ready.length >= 2) {
      const best = ready.reduce((a, b) => (b.live > a.live ? b : a));
      const widest = ready.reduce((a, b) => (b.live + b.dead > a.live + a.dead ? b : a));
      // the trap: the widest-looking wait is not the one that can actually be declared
      if (widest.dead > 0 && best.live > widest.live && widest.k !== best.k) {
        calls.push({
          tip: 'narrow_can_beat_wide', says: [best.k], against: [widest.k],
          because: `Throwing ${name(widest.k)} leaves ${widest.live + widest.dead} tiles that would finish the hand and only ${widest.live} of them can be declared at this table. Throwing ${name(best.k)} leaves ${best.live + best.dead}, and ${best.live} of those count.`,
        });
      }
    }
  }

  return calls;
}

/**
 * The calls that this position can actually pose, given the throws on offer.
 *
 * A tip is only the point of a question when the player could follow it AND could go against it. If
 * every throw the tip warns about has already been made, or the tile it points at is not in the
 * hand, naming the tip afterwards teaches nothing about the decision that was in front of them.
 */
export function liveCalls(concealed: TileKind[], melds: number, options: TileKind[], view?: TableView): ShapeCall[] {
  const on = new Set(options);
  return shapeCalls(concealed, melds, view).filter((c) => c.says.some((k) => on.has(k)) && c.against.some((k) => on.has(k)));
}
