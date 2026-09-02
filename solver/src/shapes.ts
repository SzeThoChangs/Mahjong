/**
 * The book's hand-shape tips, as a teaching library — and a way of checking whether they are true.
 *
 * Everything the app taught until now was about the one decision in front of you. That leaves out
 * the vocabulary. A strong player does not read fourteen separate tiles, they read five or six
 * familiar shapes, and the book spends most of its pages on those shapes rather than on reads.
 *
 * HOW A TIP GETS CHECKED. There are three kinds of claim here and they need three different tests,
 * which is the whole reason each card carries a `verdict` rather than an air of authority.
 *
 *  - A claim about SHAPE ("this block accepts more than that one") is pure counting. `ukeire` below
 *    enumerates it exactly with the engine's own shanten function. No simulation, no noise, and it
 *    runs in the browser every time the page loads, so a card cannot drift away from its numbers.
 *    Two comparisons must be at the SAME shanten or the counts mean different things - most of the
 *    first draft of this file compared a ready hand against a one-away hand and proved nothing.
 *  - A claim about OPPONENTS ("terminals get released more freely") cannot be counted at all. Two
 *    hands can be identical on paper and differ entirely in what the table will throw you. Those
 *    need the reads pipeline over played hands, and they are marked `needs-play`.
 *  - A claim that following the tip WINS MONEY needs `headtohead.ts`: a coach that obeys it against
 *    one that does not. No shape tip has been through that yet.
 *
 * And "true" and "worth playing" are different findings. The suit read is the warning: measured at
 * twice the deal-in rate, correct, teachable, and worth -0.034 +/- 0.057 chips a game when priced.
 * This file teaches what is TRUE. It does not claim any of it is worth scoring with.
 *
 * Where the counting disagrees with the book, the card says so. The book is Riichi-derived and this
 * table is not Riichi: 2-tai minimum, four wildcards, animals, and a chicken hand nobody else plays.
 */
import { parseKinds, shanten, type TileKind } from 'sg-mahjong-engine';

/** `Verdict` is taken by rank.ts, which grades a discard; this grades a TIP. */
export type TipVerdict = 'confirmed' | 'contradicted' | 'level' | 'needs-play' | 'measured';

export interface Variant {
  label: string;
  /**
   * The hand, already split into the pieces it is made of.
   *
   * A card about blocks has to SHOW blocks. Rendering thirteen loose tiles and dimming some of them
   * asks the reader to do the very grouping the tip is trying to teach.
   */
  blocks: TileKind[][];
  /** which blocks the tip is about, by index */
  focus: number[];
  /** the whole hand, flattened - filled in by `withCounts`, never written by hand */
  tiles?: TileKind[];
  /** computed by `withCounts`, never written by hand */
  ukeire?: number; kinds?: number; shanten?: number;
  /** only for cards whose claim is about width the shanten count cannot see */
  upgrades?: number;
}

/** What this tip asserts, in a form a test can check. */
export type Claim =
  | { kind: 'accepts-more'; better: number; than: number }
  | { kind: 'closer-to-ready'; better: number; than: number }
  | { kind: 'level'; a: number; b: number }
  /** equal on acceptance, but one of them widens more from tiles that are not progress */
  | { kind: 'upgrades-more'; better: number; than: number }
  | { kind: 'not-countable' };

export interface ShapeTip {
  id: string;
  title: string;
  rule: string;
  why: string[];
  notWhen?: string;
  variants: Variant[];
  claim: Claim;
  /**
   * Where the tiles come from.
   *
   * `book` - the shape is the book's own diagram, read off the page.
   * `ours` - the book states the rule in words with no diagram we can read, so the shape is our
   *          reading of it. The verdict then tests OUR example, which is worth less, and the card
   *          says so rather than borrowing the book's authority.
   */
  shapeFrom: 'book' | 'ours';
  /** compute the expensive upgrade count for this card's hands */
  wantUpgrades?: boolean;
  verdict: TipVerdict;
  /** what the verdict means, said plainly */
  verdictNote: string;
}

const T = (s: string) => parseKinds(s);

/** Tiles that improve the hand: every kind that lowers shanten, counted by copies still available. */
export function ukeire(tiles: TileKind[]): { count: number; kinds: number; sh: number } {
  const sh = shanten(tiles, 0);
  const held = new Map<TileKind, number>();
  for (const k of tiles) held.set(k, (held.get(k) ?? 0) + 1);
  let count = 0, kinds = 0;
  for (let k = 0; k < 34; k++) {
    const left = 4 - (held.get(k) ?? 0);
    if (left <= 0) continue;
    if (shanten([...tiles, k], 0) < sh) { count += left; kinds++; }
  }
  return { count, kinds, sh };
}

/** Does a tip's own example still show what it claims? Used by the card and by the test. */
export function holds(t: ShapeTip): boolean {
  const v = t.variants.map((x) => { const tiles = x.blocks.flat(); return { tiles, ...ukeire(tiles) }; });
  const c = t.claim;
  if (c.kind === 'not-countable') return true;
  const a = v[c.kind === 'level' ? c.a : c.better]!, b = v[c.kind === 'level' ? c.b : c.than]!;
  if (c.kind === 'accepts-more') return a.sh === b.sh && a.count > b.count;
  if (c.kind === 'closer-to-ready') return a.sh < b.sh;
  if (c.kind === 'upgrades-more') return a.sh === b.sh && a.count === b.count && upgrades(a.tiles) > upgrades(b.tiles);
  return a.sh === b.sh && a.count === b.count;
}

/**
 * Tiles that do NOT bring the hand closer, but make it WIDER when they arrive.
 *
 * `ukeire` counts progress and cannot see this at all, and several of the book's tips are about
 * exactly what it cannot see - `linked_blocks` says a block touching a finished run "carries hidden
 * upgrades", which is a claim about tiles that keep you the same distance away and leave you
 * waiting on more. Measured here by drawing each tile, trying every throw, and asking whether any
 * of them leaves the hand the same distance out and wider than it started.
 *
 * Expensive - a few thousand shanten calls per hand - so it is computed only for the cards that
 * need it, flagged by `wantUpgrades`.
 */
export function upgrades(tiles: TileKind[]): number {
  const base = ukeire(tiles);
  const held = new Map<TileKind, number>();
  for (const k of tiles) held.set(k, (held.get(k) ?? 0) + 1);
  let n = 0;
  for (let k = 0; k < 34; k++) {
    const left = 4 - (held.get(k) ?? 0);
    if (left <= 0) continue;
    const withK = [...tiles, k];
    if (shanten(withK, 0) < base.sh) continue;                 // that is progress, not an upgrade
    let best = base.count;
    for (const drop of new Set(withK)) {
      const rest = [...withK]; rest.splice(rest.indexOf(drop), 1);
      const u = ukeire(rest);
      if (u.sh === base.sh && u.count > best) best = u.count;
    }
    if (best > base.count) n += left;
  }
  return n;
}

function withCounts(t: ShapeTip): ShapeTip {
  return { ...t, variants: t.variants.map((v) => {
    const tiles = v.blocks.flat();
    const u = ukeire(tiles);
    return { ...v, tiles, ukeire: u.count, kinds: u.kinds, shanten: u.sh, upgrades: t.wantUpgrades ? upgrades(tiles) : undefined };
  }) };
}

const TIPS: ShapeTip[] = [
  {
    id: 'five_blocks',
    title: 'Count blocks, not tiles',
    rule: 'You need four sets and a pair. That is five blocks. Count blocks, not tiles.',
    why: [
      'Every winning hand is five pieces. So ask of any shape: is this one of my five?',
      'A sixth block is tiles you will throw later. While you hold it you are short somewhere else.',
    ],
    notWhen: 'Keep six if your two worst blocks are both middle waits. Let the wall choose.',
    shapeFrom: 'ours',
    variants: [
      { label: 'Five blocks', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2t 3t 4t'), T('5t 6t'), T('9s 9s')], focus: [3, 4] },
      { label: 'Six blocks — the pair broken for a spare', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2t 3t 4t'), T('5t 6t'), T('9s'), T('2s')], focus: [4, 5] },
    ],
    claim: { kind: 'closer-to-ready', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'The five-block hand is ready; the six-block one is a tile further away. It accepts more tiles, which is exactly the trap — a wider hand that is further from done.',
  },
  {
    id: 'pair_rule',
    title: 'One pair, keep two, break three',
    rule: 'Fix one pair. Keep two. Break three.',
    why: [
      'You need one pair to win. A second is still useful: if it becomes a triplet, the first is still your pair.',
      'Three is too many. The book: with three pairs "each pair is doing less work than it would in a two-pair setup", because they all finish the same way.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Two pairs', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2t 3t'), T('5s 5s'), T('9s 9s'), T('4s')], focus: [3, 4] },
      { label: 'Three pairs', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2t 2t'), T('5s 5s'), T('9s 9s'), T('4s')], focus: [2, 3, 4] },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'Both hands are one away from ready. The third pair costs about a third of the accepting tiles.',
  },
  {
    id: 'sandwich',
    title: 'The sandwich: one block, four useful draws',
    rule: 'A pair, a gap, a single, a gap, a pair — 4筒 4筒 6筒 8筒 8筒. Four different tiles turn it into a set and a pair.',
    why: [
      'Draw the 5 and you have 456 with 88 left over. Draw the 7 and you have 678 with 44. Draw a 4 or an 8 and you have a triplet with the other pair.',
      'Four kinds of tile do the job, all from one block. That is why it is worth keeping something that looks like scattered pairs.',
      'It also tells you which block is your pair. If this one supplies the pair, nothing else has to.',
    ],
    variants: [
      { label: 'The sandwich, in a hand', blocks: [T('4t 4t 6t 8t 8t'), T('2w 3w 4w'), T('6w 7w 8w'), T('3s 4s')], focus: [0] },
    ],
    claim: { kind: 'not-countable' },
    shapeFrom: 'book',
    verdict: 'confirmed',
    verdictNote: 'This is the book\u2019s own example and its own claim, and it checks out exactly: 4筒, 5筒, 7筒 and 8筒 each leave one set and one pair, and nothing else does. Four kinds, from one block of five tiles.',
  },
  {
    id: 'stepping_stones',
    title: 'The tile bridging two blocks works harder than it looks',
    rule: 'In a hand with no pair, a tile sitting between two part-runs is doing more than it appears. Do not cut it just because it looks spare.',
    why: [
      'A 5 sitting between 3-4 and 6-7 does two jobs. It joins either side, and it can pair up.',
      'It gets thrown because it looks spare. It is the opposite.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Bridge kept — 5w joins 3-4w to 6-7w', blocks: [T('3w 4w 5w 6w 7w'), T('2t 3t'), T('6t 7t'), T('3s 4s'), T('7s 8s')], focus: [0] },
      { label: 'Bridge cut, a lone tile kept instead', blocks: [T('3w 4w'), T('6w 7w'), T('9s'), T('2t 3t'), T('6t 7t'), T('3s 4s'), T('7s 8s')], focus: [0, 1, 2] },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'Confirmed by counting, both hands three away: keeping the bridge accepts 79 tiles from 23 kinds against 66 from 19. A fifth more, for a tile most people throw.',
  },
  {
    id: 'escape_single_waits',
    title: 'Break a finished shape to escape a lone-tile wait',
    rule: 'Being ready but waiting on the last copies of one tile is worse than breaking the hand up and waiting again on something open.',
    why: [
      'A finished hand is hard to break up. But what counts is how many tiles can end it, not how tidy it looks.',
      'Waiting on one tile means three copies left at most, usually fewer. Breaking it open buys a much wider wait.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Ready, waiting on one tile', blocks: [T('2w 3w 4w'), T('5w 6w 7w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s')], focus: [4] },
      { label: 'Broken up — still ready, now open', blocks: [T('2w 3w 4w'), T('5w 6w 7w'), T('2t 3t 4t'), T('6t 7t'), T('5s 5s')], focus: [3, 4] },
    ],
    claim: { kind: 'accepts-more', better: 1, than: 0 },
    verdict: 'confirmed',
    verdictNote: 'Confirmed, and by more than you would guess. Both hands are ready; the one that gave up its finished shape waits on 8 tiles against 3. Nearly three times the chance to win, for a hand that looks worse.',
  },
  {
    id: 'reset_via_runs',
    title: 'A long run can re-form on a better wait',
    rule: 'Five tiles in a row are not a set plus spares. They are a block that can be taken apart and put back together on a better wait, cheaply.',
    why: [
      '3-4-5-6-7 can be read as 345 with 67 left, or 567 with 34 left. Nothing is fixed yet.',
      'The same five tiles in two separate pieces can do none of that. Every tile is already spoken for.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Five in a row, 3w to 7w', blocks: [T('3w 4w 5w 6w 7w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s')], focus: [0] },
      { label: 'Same five tiles, split apart', blocks: [T('3w 4w 5w'), T('8w 9w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s')], focus: [0, 1] },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'Confirmed by counting, both hands ready: the continuous run waits on 11 tiles from 3 kinds against 4 from 1. Same number of tiles, nearly three times the wait.',
  },
  {
    id: 'sticky_one_away',
    title: 'A floater with a neighbour beats a lone pair',
    rule: 'Three sets and a pair, with something spare: the spare is worth more sitting next to a tile than sitting alone as a second pair.',
    why: [
      'A spare tile with a neighbour can finish as a run, from either side. A spare pair can only become a triplet, from the two copies left.',
      'The pair looks solid, so it gets kept. It is the narrower one.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Spare with a neighbour', blocks: [T('2w 3w 4w'), T('7w 8w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s')], focus: [1] },
      { label: 'Spare kept as a second pair', blocks: [T('2w 3w 4w'), T('9w 9w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s')], focus: [1] },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'Confirmed by counting, both ready: the neighbour waits on 8 tiles, the second pair on 4. Twice the wait for the shape that looks less finished.',
  },
  {
    id: 'linked_blocks',
    title: 'A block touching a finished run has hidden upgrades',
    rule: 'Two blocks that need the same number of tiles are not equal. The one sitting against a completed run can improve in ways the other cannot.',
    why: [
      'Count the tiles that finish the hand and these two are the same. They really are.',
      'The difference is in tiles that are not progress: ones that leave you the same distance out, but waiting on more. A block touching a run can grow. A lone block cannot.',
      'That is why this card shows a second number.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Block touching the run', blocks: [T('4w 5w 6w 7w 9w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s')], focus: [0] },
      { label: 'Block on its own', blocks: [T('4w 5w 6w'), T('2s 4s'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s')], focus: [1] },
    ],
    claim: { kind: 'upgrades-more', better: 0, than: 1 },
    wantUpgrades: true,
    verdict: 'confirmed',
    verdictNote: 'Identical on acceptance — 4 tiles from 1 kind each — and not identical at all. The attached block has 12 tiles that widen it without bringing it closer; the lone block has 5. The book called these "hidden upgrades" and they are hidden precisely from the count everybody uses.',
  },
  {
    id: 'four_tile_ranking',
    title: 'Which four-tile block to break',
    rule: 'The book names three: four in a row (nobetan), a doubled middle (nakabukure), and a pair on the end (aryanmen). It says the first two are near-equal and the third is clearly weakest.',
    why: [
      'These are the book\u2019s own three shapes, in its own tiles.',
      'Its reason is about the wait you end up with, not the number of tiles you accept. Four in a row leaves waits that "all lead to two-sided waits or better". The pair on the end has only two tiles that leave a two-sided wait.',
    ],
    variants: [
      { label: 'Four in a row — nobetan', blocks: [T('3w 4w 5w 6w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s'), T('9s')], focus: [0] },
      { label: 'Doubled middle — nakabukure', blocks: [T('6w 7w 7w 8w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s'), T('9s')], focus: [0] },
      { label: 'Pair on the end — aryanmen', blocks: [T('2w 2w 3w 4w'), T('2t 3t 4t'), T('6t 7t 8t'), T('5s 5s'), T('9s')], focus: [0] },
    ],
    claim: { kind: 'level', a: 1, b: 2 },
    // The three four-tile blocks are the book's. The hand around them is ours, and so is the
    // measure - the book ranks these by the wait they leave, not by how many tiles improve the
    // hand - so this is OUR test, not the book's, and the badge says so.
    shapeFrom: 'ours',
    verdict: 'contradicted',
    verdictNote: 'We counted the tiles that improve the hand: four in a row 41, doubled middle 29, pair on the end 29. So the doubled middle is not near-equal to four in a row \u2014 it is level with the shape the book calls weakest. But the book ranks these by the WAIT you are left with, and counting cannot see that. So read this as a simpler rule for our table, not as the book being wrong: keep the four in a row.',
  },
  {
    id: 'threes_and_sevens',
    title: 'A 3 or a 7 is the best loose tile to keep',
    rule: 'Of the single tiles you might hold, 3 and 7 are the strongest. Counting cannot see why.',
    why: [
      'A lone tile is worth what it can grow into. A 3 can become 1-2-3, 2-3-4 or 3-4-5.',
      'Two of those end at the edge, and people throw edge tiles. A 5 has as many runs, but each one waits on a middle tile that others keep.',
    ],
    shapeFrom: 'ours',
    notWhen: 'This only decides which spare tile to keep. It never beats keeping a block you already have.',
    variants: [
      { label: 'Keep the 3', blocks: [T('3w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 7s'), T('9s')], focus: [0] },
      { label: 'Keep the 5', blocks: [T('5w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 7s'), T('9s')], focus: [0] },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    verdict: 'needs-play',
    verdictNote: 'The counts come out exactly level, which is the tip\'s own point: the difference is invisible to counting. It lives entirely in which tiles the table will throw you, so it can only be settled by measuring real hands. Not done yet.',
  },
  {
    id: 'bad_wait_ranking',
    title: 'Not all bad waits are equally bad',
    rule: 'Waiting on the last two of one tile is weak — but a terminal or honour is close to a good wait, and a middle tile is the worst place to be.',
    why: [
      'You need one of the two copies left. It all depends on whether anyone will throw it.',
      'People throw terminals and honours early, because they are worth little. A middle tile is useful to everyone, so your two copies sit in other hands until the wall runs out.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Waiting on the last two 9s', blocks: [T('9w 9w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 6s')], focus: [0] },
      { label: 'Waiting on the last two 5s', blocks: [T('5w 5w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 6s')], focus: [0] },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    verdict: 'needs-play',
    verdictNote: 'Identical on paper — same width, same shanten. The whole claim is about who releases the tile, so counting can never settle it. The reads pipeline can, and has not been pointed at it yet.',
  },
  {
    id: 'triplet_adjacency',
    title: 'A tile next to your own triplet is weak',
    rule: 'Holding three 4s makes a lone 3 worse, not better. You are holding the tiles it needs.',
    why: [
      'A tile is worth what can still come to join it. A 3 wants 2s, 4s and 5s. If you hold three of the 4s yourself, only one is left in the wall.',
      'The book puts it as counting what is left: your good draws "only has two left in the wall" and "only has one left", so the tile "despite seeming connected, isn\u2019t pulling much weight".',
    ],
    variants: [
      { label: 'Your triplet is right beside it', blocks: [T('3w'), T('4w 4w 4w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s'), T('9s')], focus: [0, 1] },
      { label: 'Same 3w, but your triplet is elsewhere', blocks: [T('3w'), T('1s 1s 1s'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s'), T('9s')], focus: [0, 1] },
    ],
    claim: { kind: 'accepts-more', better: 1, than: 0 },
    shapeFrom: 'ours',
    verdict: 'confirmed',
    verdictNote: 'Confirmed, and this card was WRONG until now. It said "not true here" because the old test compared the 3w against a different, weaker floater. The right test keeps the 3w and moves the triplet: 22 tiles when you hold the 4s, 35 when you do not. A third of the acceptance, for the same tile.',
  },
  {
    id: 'narrow_can_beat_wide',
    title: 'A wide wait can be worth less than a narrow one',
    rule: 'At a 2-tai table, a winning tile that leaves you under the minimum is not a winning tile. Count the outs that can actually be declared.',
    why: [
      'Every other wait tip assumes any tile that completes the hand ends it. Here it does not. You can finish and still not be allowed to declare.',
      'So an eight-tile wait worth 0 tai is worth nothing, and a four-tile wait that reaches 2 tai is worth having.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Ready, waiting on 4w and 7w — eight tiles, all dead', blocks: [T('2w 2w 2w'), T('3w 3w'), T('5w 6w'), T('7t 7t'), T('8t 8t'), T('9t 9t')], focus: [2] },
    ],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'The one tip from the book that has been played for money and won: +0.048 chips a game over 90,000 paired deals, and it is on by default in the coach. Completed, this hand is 222w + 345w + 33w + 789t + 789t — a chicken hand at 0 tai that the table will not let you declare. The count below says eight tiles. The truthful number is zero.',
  },
  {
    id: 'pong_pair_quality',
    title: 'Which pair will actually become a triplet',
    rule: 'Measured on this table: a wind pair completes 69% of the time, a dragon 66%, a terminal 59%, a 2 or 8 48%, a middle tile 39%.',
    why: [
      'You finish a triplet from a tile someone throws, or one you draw. Middle tiles stay in other hands, so your copies never come out.',
      'Winds and dragons are the opposite. They are no use to anyone without a pair already, so they come out early and you claim them.',
      'That is also why a value pair is worth more than it looks here. Easiest to finish, and it arms the hand.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'A wind pair — completes 69% of the time', blocks: [T('E E'), T('2w 3w 4w'), T('6w 7w 8w'), T('2t 3t 4t'), T('6t 7t')], focus: [0] },
      { label: 'A middle pair — 39%', blocks: [T('5s 5s'), T('2w 3w 4w'), T('6w 7w 8w'), T('2t 3t 4t'), T('6t 7t')], focus: [0] },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    verdict: 'measured',
    verdictNote: 'Level on paper and nowhere near level in practice. These rates come from the study of this table, not adapted from anywhere, and the gap between 69% and 39% is invisible to any amount of counting.',
  },
];

export const SHAPE_TIPS: ShapeTip[] = TIPS.map(withCounts);
