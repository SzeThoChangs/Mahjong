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
 *    one that does not. One tip has been through that - `narrow_can_beat_wide`, worth about +0.018
 *    chips a game on deals nobody chose - and it is the only one.
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
export type TipVerdict = 'confirmed' | 'contradicted' | 'level' | 'needs-play' | 'measured' | 'advice' | 'table-rule';

/**
 * Where in a hand the tip applies, which is how the page is ordered.
 *
 * These are the playbook's own phases, so a card and the rule it came from can always be lined up.
 * A hand runs through them in this order: what you are dealt, what you build, what you throw, what
 * you claim, what you read off the table, and whether to fight at all. `meta` is none of those - it
 * is advice about playing rather than about a hand.
 */
export type Phase = 'deal' | 'build' | 'discard' | 'call' | 'read' | 'push_fold' | 'meta';

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

export interface Tip {
  id: string;
  title: string;
  rule: string;
  why: string[];
  notWhen?: string;
  phase: Phase;
  /**
   * Example hands, where the tip is the sort of thing tiles can show.
   *
   * Most of the book is not. "Push or fold, and commit" has no diagram, and inventing one would put
   * a made-up position in front of a reader and imply it was checked. Those cards carry no tiles and
   * their claim is `not-countable`, which the test enforces.
   */
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
  shapeFrom?: 'book' | 'ours';
  /** compute the expensive upgrade count for this card's hands */
  wantUpgrades?: boolean;
  verdict: TipVerdict;
  /** what the verdict means, said plainly */
  verdictNote: string;
}

const T = (s: string) => parseKinds(s);

/**
 * Tiles that improve the hand: every kind that lowers shanten, counted by copies still available.
 *
 * The cards below are all concealed hands, so `melds` defaults to none. `shapetag.ts` asks the same
 * question about real positions, where some of the hand is already on the table.
 */
export function ukeire(tiles: TileKind[], melds = 0): { count: number; kinds: number; sh: number } {
  const sh = shanten(tiles, melds);
  const held = new Map<TileKind, number>();
  for (const k of tiles) held.set(k, (held.get(k) ?? 0) + 1);
  let count = 0, kinds = 0;
  for (let k = 0; k < 34; k++) {
    const left = 4 - (held.get(k) ?? 0);
    if (left <= 0) continue;
    if (shanten([...tiles, k], melds) < sh) { count += left; kinds++; }
  }
  return { count, kinds, sh };
}

/** Does a tip's own example still show what it claims? Used by the card and by the test. */
export function holds(t: Tip): boolean {
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

function withCounts(t: Tip): Tip {
  return { ...t, variants: t.variants.map((v) => {
    const tiles = v.blocks.flat();
    const u = ukeire(tiles);
    return { ...v, tiles, ukeire: u.count, kinds: u.kinds, shanten: u.sh, upgrades: t.wantUpgrades ? upgrades(tiles) : undefined };
  }) };
}

const CARDS: Tip[] = [
  {
    id: 'five_blocks',
    phase: 'build',
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
    id: 'six_blocks_ok',
    phase: 'build',
    title: 'When to keep a sixth block',
    rule: 'The card above says cut to five. The book keeps six while the two weakest blocks are gap waits, and lets the wall decide which one to drop.',
    why: [
      'Cutting to five early means choosing between two blocks before anything has happened to tell you which is better.',
      'Holding both costs nothing in distance here. The sixth block is made of tiles that would otherwise be spares, so the hand is the same distance from ready either way.',
      'What it costs is room. A hand that is nothing but blocks has no tile left to improve with, and the second number on this card is where that shows up.',
    ],
    notWhen: 'It ends the moment one of the weak blocks fills or turns two-sided. Then you have your five and the sixth is just tiles.',
    shapeFrom: 'ours',
    variants: [
      { label: 'Six blocks, the two weakest are gap waits', blocks: [T('2w 3w 4w'), T('9w 9w'), T('3t 4t'), T('6t 8t'), T('3s 4s'), T('6s 8s')], focus: [3, 5] },
      { label: 'One of them cut, two lone honours kept instead', blocks: [T('2w 3w 4w'), T('9w 9w'), T('3t 4t'), T('6t 8t'), T('3s 4s'), T('E'), T('S')], focus: [5, 6] },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    wantUpgrades: true,
    verdict: 'confirmed',
    verdictNote: 'Both hands are two away, and the six-block one accepts 24 tiles against 20 — a fifth more, from tiles that were doing nothing else. The second number is the other half of the trade: 2 tiles widen the six-block hand and 26 widen the one holding honours, because there every draw replaces something dead. The book’s condition did not survive, though. Run the same comparison with two-sided blocks instead of gap waits and the sixth block is worth MORE, 32 against 24, so width is not what makes the rule about gap waits. The real reason is a tile you will waste later cutting the block you did not need, and no count can see that.',
  },
  {
    id: 'pair_rule',
    phase: 'build',
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
    notWhen: 'This is the one tip on the page the play-outs argue with, so treat it as a fact about width rather than as advice about what to throw.',
    verdict: 'measured',
    verdictNote: 'Counting agrees with the book \u2014 both hands are one away, and the third pair costs about a third of the accepting tiles. Playing it out does not. On 87 graded positions holding three pairs, the measured best throw was the loose tile, keeping all three, 69% of the time against 34% expected from the number of tiles each side offers. That held whether the alternative was a spare number tile or an honour, and whether the hand was near ready or far from it. One reason may be the table: All Pungs is 2 tai here and the minimum is 2, so a third pair is a route to a hand you are allowed to declare, which no count of accepting tiles can see.',
  },
  {
    id: 'sandwich',
    phase: 'build',
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
    phase: 'build',
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
    phase: 'build',
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
    verdict: 'measured',
    verdictNote: 'Confirmed by counting, and then confirmed again by the play-outs, which makes it the best-evidenced tip on this page. Both hands here are ready and the one that gave up its finished shape waits on 8 tiles against 3. Across 432 real positions where a hand could be made ready two ways, the measured best throw took the wider wait 89% of the time against 47% expected \u2014 and it came out at 89% on both populations we have, one that collects suits and one that never does.',
  },
  {
    id: 'reset_via_runs',
    phase: 'build',
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
    id: 'perfect_one_away',
    phase: 'build',
    title: 'The widest hand one away from ready',
    rule: 'Two sets, a pair, and two two-sided waits. Nothing one away from ready accepts more, so do not tidy it.',
    why: [
      'A two-sided wait is finished by two kinds of tile, eight copies. Two of those, and a pair that is already made, is sixteen tiles that put you ready.',
      'Trade one of them for a gap wait and it is twelve. Trade both and it is eight, in a hand that looks just as neat.',
      'It looks untidy because one tile is left over with nothing to do. That spare is what the shape costs, not a fault in it.',
    ],
    notWhen: 'The two waits have to be apart. Two of them sharing a tile — 3-4 and 6-7 in one suit — accept 12 rather than 16, because the 5 is doing both jobs.',
    shapeFrom: 'ours',
    variants: [
      { label: 'Two two-sided waits and a pair', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('R R'), T('3t 4t'), T('6s 7s'), T('W')], focus: [3, 4] },
      { label: 'One of them traded for a gap wait', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('R R'), T('3t 4t'), T('6s 8s'), T('W')], focus: [3, 4] },
      { label: 'Both traded for gap waits', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('R R'), T('3t 5t'), T('6s 8s'), T('W')], focus: [3, 4] },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'All three are one tile from ready and they are nowhere near each other: 16 tiles from 4 kinds, then 12 from 3, then 8 from 2. The book says this shape beats anything else at the same distance, and here it beats the worst of them by two to one.',
  },
  {
    id: 'sticky_one_away',
    phase: 'build',
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
    phase: 'build',
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
    phase: 'build',
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
    phase: 'build',
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
    verdict: 'measured',
    verdictNote: 'The counts come out exactly level, which is the tip\u2019s own point, and measuring the table settles it in the book\u2019s favour. A lone 3 grows into a wait on 1, 2, 4 or 5; a lone 5 into a wait on 3, 4, 6 or 7. Late in the hand those first four are thrown about a tenth more often than the second four, and that held in all three populations we measured. Real, and small \u2014 it decides which spare to keep, nothing more.',
  },
  {
    id: 'bad_wait_ranking',
    phase: 'build',
    title: 'Not all bad waits are equally bad',
    rule: 'Waiting on the last two of one tile is weak. Waiting on the last two of a middle tile is the worst of it. A terminal is the best version of a bad wait.',
    why: [
      'You need one of the two copies left. It all depends on whether anyone will throw it.',
      'People let go of 1s and 9s. They are worth little and they connect to less, so they keep coming out all game.',
      'A middle tile is useful to everyone, so your two copies sit in other hands until the wall runs out.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Waiting on the last two 9s', blocks: [T('9w 9w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 6s')], focus: [0] },
      { label: 'Waiting on the last two 5s', blocks: [T('5w 5w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 6s')], focus: [0] },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    verdict: 'measured',
    verdictNote: 'Identical on paper \u2014 same width, same shanten \u2014 and not identical at the table. Counting the tiles thrown after the half-way point, a terminal wait is fed about a quarter more often than a middle one, and that held in all three populations we measured. The book put an honour alongside the terminal. That half did not survive; see the next card.',
  },
  {
    id: 'honour_wait_timing',
    phase: 'build',
    title: 'An honour wait is good early and dead late',
    rule: 'The book groups a terminal and an honour together as the tolerable bad waits. They are not alike, because an honour is fed early or not at all.',
    why: [
      'More honours get thrown than anything else, about half of every copy in the game. Over a whole hand the book is right.',
      'But nearly all of it happens in the opening. Nobody keeps a lone wind, so the winds are gone by the middle of the hand and there is nothing left to feed you.',
      'A 1 or a 9 is different. It stays in hands as part of a run, so it keeps coming out right to the end.',
      'The question to ask of an honour wait is not whether it is an honour. It is how many are already face up.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Waiting on the last two red dragons', blocks: [T('R R'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 6s')], focus: [0] },
      { label: 'Waiting on the last two 9s', blocks: [T('9w 9w'), T('2t 3t 4t'), T('6t 7t 8t'), T('2s 3s 4s'), T('6s 6s')], focus: [0] },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    verdict: 'contradicted',
    verdictNote: 'Level on paper, and the answer depends entirely on who you are playing. Against bots with no reason to hold an honour, a late honour wait is fed LESS often than a middle-tile wait \u2014 worse than the shape the book calls worst. Against our own coach, which keeps dragons and its seat wind for the tai, it is the best wait on the board. Same tiles, opposite answer, so this is a fact about the table and not about the tile.',
  },
  {
    id: 'triplet_adjacency',
    phase: 'build',
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
    notWhen: 'It stops meaning what it says when the tile beside the triplet is in the suit you are collecting, which is most of the time.',
    verdict: 'measured',
    verdictNote: 'The counting is not in doubt: 22 tiles when you hold the three 4\u842c, 35 when the triplet is somewhere else, for the same 3\u842c. Whether it is good ADVICE depends on who is at the table. On 50 graded positions from hands the coach played, the measured best threw the other spare instead 88% of the time against 59% expected; on hands played by the weaker bots it leant the tip\u2019s way, on 32 positions, which is too few to lean on. The reason is probably which tile the tip points at. The tile beside your triplet is in the biggest suit of your hand 63% of the time and the other spare only 25%, so at a table that collects suits the tip keeps telling you to throw the suit you are collecting.',
  },
  {
    id: 'count_your_outs',
    phase: 'build',
    title: 'Half your wait can be face up already',
    rule: 'A two-sided wait is eight tiles on the first turn and fewer on every turn after. Once four of them are showing, you are waiting on as few tiles as a gap wait.',
    why: [
      'Both hands below wait on the same shapes people rank by name: the first is the good wait, the second is the bad one.',
      'But the good one is only good while its tiles are unseen. Four copies gone — two in the discards, two in a meld — and the two hands are the same size.',
      'Nothing on this page can see that for you. The count beside a hand always assumes every tile you cannot see is still live, which is the exact illusion this tip is about. You have to look at the table.',
    ],
    notWhen: 'The book’s next step, that this is the moment to call rather than hold out, has not been tested here. What is on this card is the arithmetic, not the advice.',
    shapeFrom: 'ours',
    variants: [
      { label: 'Two-sided wait — 2筒 and 5筒, eight tiles', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2s 3s 4s'), T('5s 5s'), T('3t 4t')], focus: [4] },
      { label: 'Gap wait — 4筒 only, four tiles', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2s 3s 4s'), T('5s 5s'), T('3t 5t')], focus: [4] },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'This one is arithmetic rather than a measurement, and the arithmetic is the whole tip. Eight tiles against four, and four of the eight can be face up by the middle of the hand, at which point the wait everyone calls good has become the one everyone calls bad. The two are still not identical, because which tiles they wait on decides how freely they come out — that is the card below.',
  },
  {
    id: 'edge_waits_stronger',
    phase: 'build',
    title: 'Two two-sided waits, and the lower one is better',
    rule: 'Between two waits that accept the same eight tiles, the book takes the one nearer the edge. People let go of edge tiles and hold on to middle ones.',
    why: [
      'Both hands below are ready and both wait on eight tiles. Counting has nothing more to say about them.',
      'The difference is who will throw you the tile. A 1 is worth little to anyone, so it comes out. A 4 or a 7 is in the middle of three possible runs, so it stays in hands until the wall runs out.',
      'This is the same claim as the one about bad waits, made about good ones, and it is measured the same way: count the copies of each kind that come out after the half-way point.',
    ],
    shapeFrom: 'ours',
    variants: [
      { label: 'Waiting on 1筒 and 4筒', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2s 3s 4s'), T('5s 5s'), T('2t 3t')], focus: [4] },
      { label: 'Waiting on 4筒 and 7筒', blocks: [T('2w 3w 4w'), T('6w 7w 8w'), T('2s 3s 4s'), T('5s 5s'), T('5t 6t')], focus: [4] },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    notWhen: 'It only decides between waits of the same size. A wider wait beats a better-placed narrow one every time.',
    verdict: 'measured',
    verdictNote: 'Level on paper \u2014 both ready, both waiting on 8 tiles from 2 kinds \u2014 and the table settles it in the book\u2019s favour, by a little. Counting the copies thrown after the half-way point, a wait on 1 and 4 is fed 53.1% of the time at a table of coaches against 48.3% for a wait on 3 and 6. The same ordering came out of all four measurements \u2014 our coach, two ShantenBot seeds and the old recorded run \u2014 and it is symmetric: a wait on 6 and 9 is as good as one on 1 and 4, because both reach an edge. The gap runs from 3% to 10% depending on who is playing, so it settles a choice between two equal waits and nothing bigger than that.',
  },
  {
    id: 'narrow_can_beat_wide',
    phase: 'build',
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
    verdictNote: 'The only tip here that has been played for money. It measured +0.048 chips a game on twelve wall seeds we had picked, then +0.018 +/- 0.012 on 120,000 paired deals from a range chosen in advance \u2014 that second number is the honest one, and it does not clear two standard errors. It stays on in the coach anyway, because counting winning tiles the table forbids you to declare is wrong whatever it pays. Completed, this hand is 222w + 345w + 33w + 789t + 789t — a chicken hand at 0 tai that the table will not let you declare. The count below says eight tiles. The truthful number is zero.',
  },
  {
    id: 'pong_pair_quality',
    phase: 'build',
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
  // ---- the rest of the build phase: tips about the hand that counting cannot settle ----
  {
    id: 'break_mediocre_ready',
    phase: 'build',
    title: 'A ready hand is not automatically worth keeping',
    rule: 'When you are ready on something feeble, count what breaking it would open up before you decide to sit on it. Do not eyeball it.',
    why: [
      'A ready hand feels finished, and that feeling is most of the reason bad ones get kept.',
      'The card above about escaping a lone-tile wait is the version of this that stays ready either way, and it is worth 89% against 47%. This one is the harder case, where you give up ready altogether and go back to building.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Untested here, and it is not the same claim as the escape card even though it sounds like it. Giving up ready costs turns, and nothing in this project has measured what those turns are worth.',
  },
  {
    id: 'keep_floaters',
    phase: 'build',
    title: 'The widest hand is not always the best hand',
    rule: 'Do not lock yourself into the wait that accepts the most tiles if the tiles it needs are already gone. A spare tile that keeps the hand able to improve is often worth more.',
    why: [
      'The count of accepting tiles assumes every tile you cannot see is still out there. It is not: some are in the discards, some are in melds, and some are sitting in one opponent’s hand.',
      'A hand made entirely of blocks has nothing left to improve with. The six-blocks card above shows the size of that: 2 tiles widen the all-blocks hand and 26 widen the one that kept two spares.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'The mechanism is real and countable — that is the 2 against 26 on the six-blocks card — but the trade it asks you to make has never been played out here. Nobody has measured what a hand that can improve is worth against a hand that is simply wider today.',
  },
  {
    id: 'isolate_triplet',
    phase: 'build',
    title: 'Reading a wait with a triplet in it',
    rule: 'When a hand with a triplet in it is ready and you cannot see what it is waiting on, read it twice: once with the triplet as a set, once with one of its tiles as your pair.',
    why: [
      'A triplet can be a finished set or it can be a pair with a spare copy attached, and those two readings give completely different waits.',
      'This is where multi-sided waits get miscounted by eye. The two readings together are the whole wait; either one alone is half of it.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'advice',
    verdictNote: 'A method rather than a claim, so there is nothing to be right or wrong about. The app already does it for you — every tile count on this page comes from an enumeration that tries both readings — but at a real table you are doing it by hand.',
  },
  {
    id: 'full_hand_over_partial',
    phase: 'build',
    title: 'Prefer tai that the whole hand carries',
    rule: 'Half-Color is 2 tai, Full-Color 4, All-Pong 2, Ping Wu 4. Those come from the shape of the whole hand. A dragon pong or your seat wind is 1 tai and depends on one block surviving.',
    why: [
      'A whole-hand pattern cannot be taken away by one bad draw. A part-hand pattern is one broken block away from nothing.',
      'It also stacks: a Half-Color hand can still hold a dragon pong, but the reverse plan rarely turns into a colour hand.',
    ],
    notWhen: 'A part-hand tai you already hold beats a whole-hand tai you are still hoping for. The cards below about not chasing unconfirmed patterns are the other half of this.',
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'The tai values are this table’s own and are not in doubt. The preference between the two kinds of tai has not been measured here, and it is testable: the coach picks a target every turn, so an arm that prefers whole-hand targets could be played for money.',
  },
  {
    id: 'flush_decided_early',
    phase: 'build',
    title: 'A colour hand is decided at the deal',
    rule: 'Commit to Half-Color from the starting hand, when you already hold ten or more tiles of one suit plus honours and no ordinary route worth having. Deciding halfway through wastes the turns that make it work.',
    why: [
      'A colour hand throws away two whole suits. Every turn you spend deciding is a turn you needed for that.',
      'It is worth 2 tai, and it lets you call freely, because a called set of your suit costs you nothing.',
    ],
    notWhen: 'It is the one plan with no way out. Once two suits are on the floor you cannot fall back to a cheap hand, which is why the card about keeping a fallback does not apply to it.',
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Untested here as a rule about TIMING. What is measured is that the plan itself is normal at this table: a table of coaches wins a colour hand 31.7% of the time, and the study this rule comes from puts Half-Color at 32% of the opening book once the minimum is 2 tai. Two different methods, the same third of hands.',
  },
  {
    id: 'project_bad_draws',
    phase: 'build',
    title: 'Ask what happens if the next draw is useless',
    rule: 'Before you throw, picture the worst tile you could draw next turn. Prefer the throw that leaves that draw somewhere to go.',
    why: [
      'Most turns hand you something you did not want. A hand that can absorb a bad draw keeps moving; one that cannot spends the turn throwing what it drew.',
      'It is the same idea as keeping a spare rather than a sixth block, one turn further ahead.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Untested, and it is the most expensive tip on this page to test properly, because it is a claim about the turn after next rather than about this one.',
  },
  {
    id: 'weak_start_pivot',
    phase: 'build',
    title: 'A hopeless starting hand should change its mind immediately',
    rule: 'Thirteen scattered tiles with no block worth keeping are not a slow hand, they are a different hand. Turn them toward a colour hand or toward defending, at once, rather than drifting.',
    why: [
      'Drifting costs you both: too late to build anything, and no safe tiles banked when somebody else commits.',
      'You win about one hand in four. What you do with the other three is most of the game.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Untested here. The coach has no notion of giving up at the deal at all — it picks the best target it can see and plays it — so this is a real gap rather than a settled question.',
  },
  {
    id: 'threshold_rises',
    phase: 'build',
    title: 'The bar rises as the hand runs',
    rule: 'A hand that was good at the deal and has not improved by turn 20 is not still good. The score a plan needs to be worth keeping climbs as the wall shrinks.',
    why: [
      'You have fewer draws left to fix it and the other three are closer to done, so the same tiles are worth less than they were.',
      'The study behind this measured it for the colour hand: it needs a score of 23 at the deal, 30 by turn 20 and 35 by turn 40 on its own scale. The exact numbers belong to that scale, but the shape of it is the point.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table that the rule comes from — the author’s own simulations, not ours. Our coach does the same thing in a different way: it prices every plan in chips per game at the current turn, so a plan that stops improving falls behind on its own.',
  },
  // ---- the deal: what you are dealt, and what to do about it before you draw ----
  {
    id: 'flower_animal_case',
    phase: 'deal',
    title: 'Look at your flowers and animals first',
    rule: 'Before you look at a single tile, look at the bonus tiles. They are the largest single thing deciding what this hand is worth, and you had no say in them.',
    why: [
      'They are free tai when they are yours, and they are worse than nothing when they are not: flowers worth 0 tai measured -4.3 chips a game against -1.0 for holding none at all.',
      'The reason is that a useless flower still burns your replacement draw, still tells the table something, and still stops you playing Ping Wu.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table that the rule comes from, not by us. Our own engine agrees on the mechanism at least — bonus tiles draw a replacement and are scored separately — but we have never played the -4.3 against -1.0 ourselves.',
  },
  {
    id: 'flowers_wont_save_you',
    phase: 'deal',
    title: 'Do not plan on drawing a flower',
    rule: 'If your hand needs one more tai to be legal, that tai has to come from tiles you can see a route to. The chance of picking up a flower tai is 48% at the deal, 35% by turn 20 and 27% by turn 40, and the chance of two never gets above 14%.',
    why: [
      'A hand that is one tai short and hoping is a hand that cannot be declared, which at this table means it cannot win on anyone’s discard at all.',
      'Half the time is not a plan. It is the coin you were going to flip anyway.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us. It matters more here than anywhere else on this page because of the 2 tai minimum: the card about counting only the wins you may declare is the same problem seen from the other end.',
  },
  {
    id: 'target_selection',
    phase: 'deal',
    title: 'Score every plan, then pick one',
    rule: 'Do not open with a favourite. Score the hand for each of the plans available — the cheap hand, the colour hand, the all-runs hand, the all-triplets hand — and take whichever is worth the most right now.',
    why: [
      'The four plans want different tiles, so the same thirteen tiles are a good hand for one of them and rubbish for the rest.',
      'This is what the app does every turn on the Train tab, and the plan it names is the one it scored highest, not one it prefers.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'The four scoring functions come from the data-analytic study of this table, fitted by its author against simulated outcomes. Our coach uses them, re-fitted, and the way it picks between them is measured by every head-to-head run in FINDINGS.',
  },
  {
    id: 'no_fixed_strategy',
    phase: 'deal',
    title: 'Every fixed plan loses',
    rule: 'Playing the same combination every hand loses money whichever one you pick: the cheap hand -0.9 chips a game, all-runs -2.9, all-triplets -4.4, Half-Color -4.8, Full-Color -8.8, 13 Wonders -9.1. Choosing between them is the skill.',
    why: [
      'Every one of those numbers is negative, which is the point. There is no plan that beats the table by itself.',
      'What beats the table is that some hands are colour hands and some are not, and telling them apart is worth more than any of the plans.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us. Ours is the same lesson from the other direction: a bot that always plays the same way is exactly what every failed arm in FINDINGS has been.',
  },
  {
    id: 'ping_wu_default',
    phase: 'deal',
    title: 'No flower, no animal: think all-runs first',
    rule: 'About a third of hands arrive with no bonus tile at all. On those, the all-runs hand is the best plan about three quarters of the time.',
    why: [
      'With no bonus tai to build on, the tai has to come from the shape of the hand itself, and Ping Wu is worth 4.',
      'It is a prior, not a rule. Score the hand anyway — a hand with ten tiles of one suit does not care what the average hand does.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us.',
  },
  {
    id: 'mf2_target_shift',
    phase: 'deal',
    title: 'The 2 tai minimum changes which hands are worth playing',
    rule: 'At this table you may not declare a win under 2 tai on a discard. That pushes the opening book toward the bigger hands: Half-Color 32% of hands, all-runs 26%, Ping Wu 24%, all-triplets 14%, and the cheap hand only 4%.',
    why: [
      'The cheap hand is no longer a plan, because it is not legal to declare unless something else arms it. It survives as a fallback you keep alive, not as a target.',
      'Longer games follow from the same rule — everyone needs more tai, so hands take more turns and more of them end drawn.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'The opening book is from the data-analytic study of this table. Our own play agrees where the two can be compared: four coaches choosing targets for themselves win a colour hand 31.7% of the time, against the study’s 32% of the opening book.',
  },
  // ---- choosing what to throw: the danger half of the game ----
  {
    id: 'count_wait_types',
    phase: 'discard',
    title: 'Rank a tile by how many ways it can be waiting',
    rule: 'A terminal can only be caught by three kinds of wait. A middle tile can be caught by five. Fewer ways to be wrong is the whole of tile safety.',
    why: [
      'A 9 can finish a two-sided wait, a pair wait or a single-tile wait. A 5 can do all of those and two more, because runs can close on it from either side.',
      'Honours are the extreme case: no run can contain one, so only a pair or single-tile wait can catch them.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured on our own recorded hands, and the ordering is exactly what the counting predicts. The chance a throw deals in, at turn 40, for a tile nobody has thrown yet: an honour 0.37%, a terminal 1.05%, a middle tile 1.64%. This is the table the coach prices every discard against.',
  },
  {
    id: 'check_your_spares',
    phase: 'discard',
    title: 'A tile already on the floor is the safest thing you hold',
    rule: 'Before throwing out of habit, compare your spares. Whether a copy has already been thrown matters more than what kind of tile it is.',
    why: [
      'If a tile has passed and nobody claimed it, the players who could have used it have told you so.',
      'The effect is bigger than most people think, and it changes the ranking: a middle tile that has already been seen is safer than a fresh terminal.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured on our own recorded hands. At turn 40 a middle tile goes from 1.64% to 0.99% once one is on the floor, a terminal from 1.05% to 0.57%, and an honour from 0.37% to 0.06% — six times safer. So the fresh terminal at 1.05% really is more dangerous than the seen middle tile at 0.99%.',
  },
  {
    id: 'live_honour_pairs',
    phase: 'discard',
    title: 'Throwing from a pair of honours buys two turns',
    rule: 'Honours are the safest tiles on the table, and a pair of them is better than one. If the first passes, the second is proven safe and buys another turn.',
    why: [
      'No run can contain an honour, so the only hand that catches it is one holding the other two copies.',
      'Once you have thrown one and nothing happened, the second is as close to free as this game offers.',
    ],
    notWhen: 'The other half of this is on the reading cards: a player who has already thrown a value pair is telling you their hand does not need it, and one who is collecting honours is the reason the first copy is not free.',
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'The safety is measured on our own hands — an honour is the safest class at every turn we measured, 0.37% fresh at turn 40 against 1.64% for a middle tile, and 0.06% once one has passed. The "buys two turns" half is arithmetic on top of that rather than something we played out.',
  },
  {
    id: 'no_chance_tiles',
    phase: 'discard',
    title: 'When all four copies are visible, the neighbours go quiet',
    rule: 'Every run needs one of a tile’s immediate neighbours. When all four copies of a tile are face up, the runs that depended on it are dead, and its neighbours become much safer.',
    why: [
      'It is a deduction rather than a guess. You are not reading anybody, you are counting what is impossible.',
      'It is also cheap to do at the table: watch for a tile with all four copies out and remember which of your own tiles it protects.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'True and large: measured on our own hands a walled tile deals in three to five times less often — at turn 30 a fresh middle tile goes from 1.23% to 0.39%. And it is worth nothing in chips. Played for money over 24,000 paired deals it returned +0.002 +/- 0.027, because the rule only fires on 2% of discards and the coach was already throwing something nearly as good. True and teachable is not the same as worth scoring with.',
  },
  {
    id: 'relative_not_exact',
    phase: 'discard',
    title: 'Rank your tiles, do not guess their tile',
    rule: 'Defending is putting your own tiles in order of danger and throwing the safest. It is not working out exactly what they are waiting on.',
    why: [
      'You almost never have enough to name their wait, and trying produces a confident answer that is wrong.',
      'You do not need it. You only need to know which of the five tiles in your hand is least likely to be the one.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'advice',
    verdictNote: 'A way of thinking rather than a claim, and it is how the app itself works — the coach prices every tile in your hand and orders them, and never commits to a wait.',
  },
  {
    id: 'last_chance_timing',
    phase: 'discard',
    title: 'The fourth copy is safe early and dangerous late',
    rule: 'When three copies of a tile are visible, the last one is only dangerous if a threatening player is sitting on it. Early that is unlikely, because it is probably still in the wall. Late it is much more likely.',
    why: [
      'The wall shrinks all game. The same tile, unaccounted for, is far more likely to be in a hand at turn 45 than at turn 15.',
      'It is the one danger judgement where the answer flips completely between early and late, which is why habit is a bad guide to it.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here. Our danger table knows the turn and knows whether a copy has been seen, but it has never been asked the specific question of where the missing copies are, so this is a real gap rather than a settled rule.',
  },
  {
    id: 'locate_the_fourth',
    phase: 'discard',
    title: 'Ask where the missing copy is',
    rule: 'Between two tiles that look equally safe, ask which one has a plausible home. If the threatening player threw one early and nothing has come out since, assume they hold another.',
    why: [
      'Copies do not vanish. Every one that is not on the table or in your hand is somewhere, and the discards say a lot about where.',
      'A player who threw a tile early was not collecting it then, which is exactly why a second copy in their hand now is a signal rather than noise.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here, and it is the harder half of the card above: our reads know how many copies are visible, not who is likely to hold the rest.',
  },
  {
    id: 'withhold_safe_tiles',
    phase: 'discard',
    title: 'Do not hand the table a safe tile',
    rule: 'Holding the last copy of a tile everybody has already passed on, keep it. Throwing it lets all three opponents fold comfortably behind it.',
    why: [
      'A proven safe tile is worth more as something nobody else has than as one turn of your own comfort.',
      'It is the only card on this page about denying information rather than using it.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here, and awkward to measure, because the cost falls on other players’ hands rather than on yours. Nothing in the coach does it.',
  },
  {
    id: 'terminal_triplet_release',
    phase: 'discard',
    title: 'With nothing safe, break your own terminal triplet',
    rule: 'When every tile in your hand is dangerous, throw from a triplet of terminals you hold yourself. It cannot be caught by a run wait, and holding all three copies means it cannot be caught by a pair wait either.',
    why: [
      'You are throwing a tile whose danger you have personally eliminated by holding the rest of it.',
      'It also buys three turns rather than one, which is usually the whole of what a fold needs.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'The safety argument is arithmetic and not in doubt. What has never been measured here is the price — giving up a whole triplet is a real cost to the hand, and nobody has played out whether the three safe turns are worth it.',
  },
  {
    id: 'squeeze_the_caller',
    phase: 'discard',
    title: 'Feed the caller tiles they cannot use',
    rule: 'Only the player who draws immediately after you can chow your discard. To slow one particular opponent, throw what they cannot claim: tiles they have already discarded, honours, and tiles outside the suit they are collecting.',
    why: [
      'Anybody can pong, but a chow is a one-way street, so the player after you is the only one your discards can feed that way.',
      'Against a colour hand it is simpler still: anything outside their suit is nothing to them.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'The direction is a fact about the game and the engine plays it that way. Whether steering discards to squeeze one player is worth chips has never been measured here.',
  },
  {
    id: 'wind_discard_order',
    phase: 'discard',
    title: 'Which useless wind to throw first',
    rule: 'Among winds you do not need, throw first the one belonging to the player just before you in the turn order. If they pong it, the players between you are skipped and you get to draw sooner.',
    why: [
      'A pong skips everybody between the thrower and the claimer, so who claims decides who loses a turn.',
      'The same tile claimed by the player after you costs you nothing and gains you nothing.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured. Turns are worth real money at this table — a player gets about eleven of them in a hand — so this is a cheap idea to test and nobody has tested it.',
  },
  {
    id: 'chow_danger',
    phase: 'discard',
    title: 'How likely a tile is to be chowed',
    rule: 'Only the player after you can chow. Rank what you feed them: tiles they have thrown themselves are safest, then tiles they declined to chow, and after that a middle tile is worth about three times a terminal to them.',
    why: [
      'A chow needs two specific neighbours, so a middle tile fits many more runs than an edge one. The study scores the potential 16 for a terminal, 32 for a 2 or an 8, 48 for a middle tile and 0 for an honour.',
      'The safety of a tile they declined to chow wears off, because their hand changes. It is a real signal for a few turns, not forever.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us. Our own danger table does not separate chow risk from pong risk at all — it prices a tile by class, turn and whether a copy has been seen — so this is one of the clearest gaps between what is known about the game and what the coach knows.',
  },
  {
    id: 'pong_danger',
    phase: 'discard',
    title: 'Anybody can pong, and honours are the ones that hurt',
    rule: 'A pong can come from any of the three, not just the player after you. An honour thrown at turn 40 is claimed about 16% of the time against a cheap hand and 29% against a colour hand.',
    why: [
      'Honours are the tiles most worth claiming here, because a dragon or a seat wind is a tai on its own.',
      'Holding two copies rather than one drops the risk of throwing it from about 3% to about 1%, because you are holding the tiles the pong needs.',
    ],
    notWhen: 'This is in tension with the card above about honours being safe. Both are true: an honour rarely deals in, and it is the tile most likely to be claimed and turned into value.',
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us. Worth knowing here in particular because of bao: feeding the third meld of a colour or terminal hand, or a wind set, makes you liable for the whole payout.',
  },
  {
    id: 'one_sided_chow_trap',
    phase: 'discard',
    title: 'Their own discard is not always safe',
    rule: 'The rule that a player cannot win on a tile they threw themselves has a hole in it. A player who chows can end up waiting on the tile they just discarded, and on tiles three and six away from it in the same suit.',
    why: [
      'Calling reshapes the hand after the discard, so what was useless a turn ago can be the winning tile now.',
      'It is rare early and common late: about 0.07% at turn 10 and 26% by turn 50.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us. Note that this table also has a rolling locked-discard rule of its own, which is on the calling card about widening a wait.',
  },
  {
    id: 'fresh_tile_endgame',
    phase: 'discard',
    title: 'An all-triplets hand runs out of safe tiles',
    rule: 'Late in a hand built on triplets, what you are holding is pairs, and pairs of tiles nobody has thrown. You arrive at the end of the wall with nothing safe to play.',
    why: [
      'Every pair you keep for a triplet is a pair of tiles that has not appeared, which is the definition of the most dangerous kind of tile.',
      'At this table it is worse than uncomfortable: with the wall nearly out, a tile nobody has seen before can leave you paying the whole hand for everybody.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'table-rule',
    verdictNote: 'The liability is a rule of this table, confirmed against the rulebook and written into `data/table.config.json`: with fewer than eight tiles left in the wall, if somebody wins on a tile you threw that had never appeared before, you pay the whole hand for everybody. The advice that follows from it — plan the way out before you arrive there — has not been measured.',
  },
  // ---- claiming a tile: what a call buys and what it spends ----
  {
    id: 'call_necessity',
    phase: 'call',
    title: 'The only question is whether this call helps this hand',
    rule: 'There is no right number of calls. A player who never calls and a player who always calls are making the same mistake, which is deciding before they look.',
    why: [
      'Every other card here is a reason a particular call is good or bad. None of them is a reason to call more often in general.',
      'If you catch yourself with a policy about calling rather than a reason for this call, that is the mistake.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'advice',
    verdictNote: 'A way of thinking rather than a claim. It is also how the coach is built: there is no call-rate setting anywhere in it, only a score for the call in front of it.',
  },
  {
    id: 'speed_value_safety',
    phase: 'call',
    title: 'Three questions before any call',
    rule: 'Does it get you closer to ready? Does it lock in tai worth having? Do you keep enough safe tiles to defend? Two yeses, call. None, pass. One, let the shape decide.',
    why: [
      'A call always spends something. Concealed tiles are your defence and your flexibility, and they leave the hand the moment you claim.',
      'Value is easier to satisfy here than in the game this rule came from, because a dragon or your seat wind is a tai on its own and there is no bonus for staying concealed.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'advice',
    verdictNote: 'A checklist rather than a claim. The coach does the same three sums numerically and in chips, which is the only way to weigh them against each other, but at the table the three questions are what you have.',
  },
  {
    id: 'never_break_your_pair',
    phase: 'call',
    title: 'A call that kills your only pair has not helped',
    rule: 'Chowing with the tiles that were your pair trades one problem for a worse one. You are no closer to a hand with a pair in it, and now you cannot defend either.',
    why: [
      'Every winning hand needs a pair. A hand with four sets and no pair is not nearly finished, it is stuck.',
      'Passing and drawing normally usually beats it, because the pair you already hold is the hard part to replace.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here, though it could be: the tile counter on this page would show the pair-breaking call as further from ready in most hands. The card is honest about not having done it rather than implying the counting was run.',
  },
  {
    id: 'pon_over_chii',
    phase: 'call',
    title: 'Prefer the pong when both are on offer',
    rule: 'A pong takes two tiles out of your hand and leaves your runs where they are. A chow takes the run and leaves the pair. Default to the pong.',
    why: [
      'What you keep in hand after a call is your defence, and a run in hand is more useful to defend with than a spare pair.',
      'The exception is when the pair is the tai — your seat wind, a dragon — in which case the pong you are avoiding is the whole reason the hand is worth anything.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here. The coach scores both and takes the higher, so it has no default at all, which means this is a testable difference rather than an agreement.',
  },
  {
    id: 'call_to_upgrade',
    phase: 'call',
    title: 'Being ready is not a reason to stop calling',
    rule: 'A call that turns a bad wait into a good one is worth making even when you are already ready. These come up often and get missed because the hand feels finished.',
    why: [
      'What matters is how many tiles can end the hand, and a call can double that in one move.',
      'It is the same idea as breaking a finished shape to widen a wait, which is the best-evidenced tip on this page.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured as a call rule. The discard version of it is measured and strong — the play-outs take the wider wait 89% of the time against 47% by luck — but a call also costs a concealed tile and a turn, and nobody has priced that here.',
  },
  {
    id: 'call_to_skip_draw',
    phase: 'call',
    title: 'A call can be a way of not drawing',
    rule: 'Claiming a tile uses up your own draw. Late in a dangerous hand, a call that keeps your shape while sparing you a live tile is a defensive move, not an attacking one.',
    why: [
      'The tile you would have drawn is a tile you would then have to throw. A call skips that.',
      'It also skips the players between you and the discarder, which is a real gain when a player gets about eleven turns in a whole hand.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here. The tempo half of it is measured in the study of this table; the defensive half is not measured anywhere we know of.',
  },
  {
    id: 'turn_theft',
    phase: 'call',
    title: 'A pong steals turns from the players it skips',
    rule: 'Pong and kong jump the turn order, so the players between you and the discarder simply lose their go. With about eleven turns each in a hand, that is worth real money on its own.',
    why: [
      'One turn is roughly a twelfth of everything you will do in the hand.',
      'It is also the reason a call is not only about the tile: you gain a turn and three other people lose the use of theirs.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'The turn count is measured in the data-analytic study of this table, not by us. Our coach has no tempo term in its call scoring at all, so if this is worth what the study implies, it is a gap.',
  },
  {
    id: 'third_call_test',
    phase: 'call',
    title: 'The third call is the one to think about',
    rule: 'Three melds leave four tiles in your hand. You have no defence left, so the third call needs either a genuinely good wait or real tai. The same is true of an opponent making theirs.',
    why: [
      'With four tiles left you cannot fold. Whatever happens next, you are in the hand to the end of it.',
      'From the other side of the table it is the clearest threat signal there is, and it is free to watch.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Half of it is measured on our own hands, and it is the half about the opponent: a player with three exposed sets is ready 39.5% of the time against 4.9% with none. That is the number the coach uses to price danger. Whether your own third call is worth making has not been measured.',
  },
  {
    id: 'all_pungs_needs_value',
    phase: 'call',
    title: 'All-triplets on its own loses money',
    rule: 'All-Pong is 2 tai, and as a plan it measured -4.4 chips a game — the worst of the ordinary targets. Only steer into it when it arrives with something else: a dragon, your seat wind, a colour, animals.',
    why: [
      'It shortens your hand every time you call, so you end up with no defence, and it always finishes on a narrow wait.',
      'The fix that measured well is to keep the cheap hand alive underneath it as a fallback, which is worth +3.4 chips a game.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us. Our own tile-level number points the same way: a middle-tile pair becomes a triplet only 39% of the time, so a hand of them is slower than it looks.',
  },
  {
    id: 'hybrid_fallback',
    phase: 'call',
    title: 'Keep the cheap hand alive underneath the plan',
    rule: 'Playing for triplets or for runs, keep the cheap hand available and take it the moment it is legal. That fallback measured +3.4 chips a game.',
    why: [
      'Hands that keep a fallback win more cheap hands than plan hands, and still finish ahead. The fallback is not a failure, it is the point.',
      'The colour hand is the exception, and it is the reason that plan is the most dangerous commitment on the board: it throws away two suits, so it has no fallback to take.',
    ],
    notWhen: 'At this table a cheap hand is only legal at all if something arms it — a flower, an animal, a value pong — which is what the 2 tai minimum means in practice.',
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured in the data-analytic study of this table, not by us. Our coach does hold a fallback and names it on the Train tab, which is the same idea arrived at separately.',
  },
  {
    id: 'take_ready_under_pressure',
    phase: 'call',
    title: 'Against a committed opponent, take ready now',
    rule: 'When somebody is visibly going for it, get ready immediately even if your hand is cheap. Being not-ready against a ready opponent is the losing end of the trade.',
    why: [
      'You cannot win a race you have not entered, and a cheap hand that ends the round stops theirs.',
      'The signal here is melds and tempo, not any kind of declaration — there is nothing to announce at this table.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured as stated. What our own runs do say is that caution is not where the money is: a rule that switches the coach into folding lost twice, and turning its caution up loses steadily, out to four and a half standard errors at the far end. That does not test this tip, but it points the same way.',
  },
  {
    id: 'rebuild_waits',
    phase: 'call',
    title: 'A dead wait can sometimes be rebuilt',
    rule: 'When the tiles you are waiting on are all gone, calling can reshape the hand into a live wait instead of abandoning it. Learn to see those before you give up.',
    why: [
      'A wait dies when its tiles are visible, not when your hand changes. The hand is often one call away from a different wait entirely.',
      'This is the same arithmetic as counting your outs, one step further on: once you know the wait is dead, the question is what else the hand could be.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured, and not implemented either — the coach evaluates the call in front of it and never searches a sequence of calls that would rebuild a hand.',
  },
  {
    id: 'middle_tile_hands_undefended',
    phase: 'call',
    title: 'A hand of middle tiles cannot defend itself',
    rule: 'A hand made entirely of middle tiles holds nothing safe. When somebody commits you can neither push confidently nor fold. Count that cost when you call, not when the attack arrives.',
    why: [
      'Middle tiles are the most dangerous class to throw — 1.64% at turn 40 against 0.37% for an honour — so a hand full of them has no exit.',
      'Calling makes it worse, because every call takes another concealed tile out of your hand.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'The danger numbers are ours and are not in doubt. Costing them at call time is the part nobody has measured: the coach prices the danger of a throw when it makes it, never the future cost of holding a hand with no safe tiles in it.',
  },
  {
    id: 'widen_when_folding',
    phase: 'call',
    title: 'When everybody folds, widen for the self-draw',
    rule: 'If all three are clearly folding, nobody is going to throw you anything. Winning now means drawing it yourself, so take the widest wait you can build rather than the safest.',
    why: [
      'A self-draw needs only one tai here, so a wide cheap wait is a real hand once nobody is feeding you.',
      'It is not free. This table has its own locked-discard rule: you cannot claim a tile matching your own last discard, nor any tile discarded by anybody after it. It clears when you discard again, so it is a rolling cost rather than a permanent one.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'table-rule',
    verdictNote: 'The locked-discard rule is this table’s own, taken from the rulebook and implemented in the engine, which checks both your last discard and everything thrown since it. The advice built on it — widen when the table folds — has not been measured.',
  },
  {
    id: 'mf2_kongs_pay_double',
    phase: 'call',
    title: 'Kongs and bonus sets pay on the spot, and here they pay double',
    rule: 'Because the minimum is 2 tai, this table doubles its immediate payouts. A concealed kong is 4 chips from each player, a four-of-a-kind kong 8 from each, a flower or animal set 8 from each. That last one is 24 chips before anybody has won anything.',
    why: [
      'These are paid the moment you declare them and you keep them whoever wins the hand.',
      'A kong-4 declared is worth more than winning an ordinary 2 tai hand off a discard, which is the sort of thing that is easy to leave on the table by not declaring.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'table-rule',
    verdictNote: 'Read straight off `data/table.config.json`: the immediate payouts carry a multiplier that is 2 at a 2 tai minimum. Never leave a kong undeclared without a reason — and the reason, when there is one, is usually that declaring it hands the table information or a replacement draw you do not want.',
  },
  // ---- reading the table: what the other three hands have told you ----
  {
    id: 'reads_need_basis',
    phase: 'read',
    title: 'A read comes from something you can point at',
    rule: 'A read is an inference from what is visible: the discards, the melds, the tiles nobody claimed, the copies already out. Anything based on streaks or on how the game feels is not a read.',
    why: [
      'Every card in this section names the thing it is reading off. If you cannot name it, you are guessing and calling it a read.',
      'This is also the reason the app never says "they look dangerous". It says how many sets are exposed and what the discards contain.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'advice',
    verdictNote: 'The design constraint the whole project runs on rather than a claim to test. It is why nothing in the coach has any memory of previous hands.',
  },
  {
    id: 'calling_by_exposed_sets',
    phase: 'read',
    title: 'Count their melds — it is the strongest free signal',
    rule: 'How ready a player is climbs steeply with how many sets they have exposed. It costs nothing to watch and it is the single best guide to who to be afraid of.',
    why: [
      'A player with nothing exposed is usually nowhere. A player with three is usually one tile away.',
      'Careful players run above these rates rather than below, because they only expose when the hand is worth it.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured on our own recorded hands, and it is the number the coach prices every discard against: a seat with three exposed sets is one tile from ready 39.5% of the time, against 4.9% with none. The study of this table puts the same seat at about 83% likely to be calling by turn 40, which is the same signal read at a later point in the hand.',
  },
  {
    id: 'half_color_tell',
    phase: 'read',
    title: 'The suit missing from their discards is their hand',
    rule: 'A player collecting a suit does not throw that suit. When one of the three suits stops appearing in somebody’s discards, that is the suit they are building, and once they start throwing it they are close to done.',
    why: [
      'It is the one read that needs no arithmetic. Look at three piles of discards and find the suit that is not there.',
      'It is worth being right about here, because a colour hand is 2 tai and a full colour hand is 4.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Measured twice, with opposite answers, and the difference is who was playing. On our old recorded run — bots with no colour plan at all — a tile in their suit came out SAFER, because two exposed sets in a suit are six of it off the table and what they still need is elsewhere. Measured on 25,000 hands a table of coaches played against itself, where colour hands are a third of the wins, the read is right and large: a tile in their suit deals in at twice the rate, rising to five and a half times late. Then played for money it returned -0.034 +/- 0.057, which is nothing: the coach already prices danger continuously and knowing WHY a tile is dangerous does not move it. True, worth teaching, not worth scoring with.',
  },
  {
    id: 'flush_traffic_light',
    phase: 'read',
    title: 'A colour hand has three stages, and you can see all of them',
    rule: 'Green: their discards are ordinary tiles from every suit, so push your awkward tiles out now while it is cheap. Yellow: they start throwing honours, including ones they had kept, so they are getting close. Red: their discards are mostly one suit, so assume ready and stop feeding that suit entirely.',
    why: [
      'The stages come in order and each one is a chance to act before the hand becomes expensive.',
      'The mistake is to react at red, when there is nothing left to do except fold badly.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'measured',
    verdictNote: 'Quantified in the study of this table: one discard of their own suit puts a colour hand at 25-73% likely to be calling depending on how many sets they have exposed, two puts it at 44-86%, and 64% of colour-hand winners throw their own suit before they win. Our own measurement of the same tell is on the card above, including why it comes out backwards against players who never collect a suit.',
  },
  {
    id: 'value_from_melds',
    phase: 'read',
    title: 'Work out what their hand is worth before what it wants',
    rule: 'Look at what they have exposed and add it up. A dragon pong or their seat wind is 1 tai each, a colour is 2 or 4, visible animals and flowers 1 each. A cheap hand you can afford to feed; an expensive one you cannot.',
    why: [
      'Deciding whether to push is a question about the price of being wrong, and the melds tell you the price directly.',
      'It is also the read our coach cannot make: it counts how many sets an opponent has exposed and never looks at what they are, so a dragon pong and a run of 3-4-5 are the same thing to it.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'The tai arithmetic is this table’s own and is not in doubt. Whether pricing it changes what you should throw is untested here — and eleven of the book’s tips turn on the distinction the coach cannot see, which makes this the largest known blind spot in the app.',
  },
  {
    id: 'two_discard_piles',
    phase: 'read',
    title: 'The tiles they did not claim are a second discard pile',
    rule: 'Every tile that passed an open hand and was not claimed tells you something that hand does not have. Watch what goes past the player with melds down, not only what they throw.',
    why: [
      'If a tile that would obviously finish their visible shape went past uncalled, they do not have that shape.',
      'It matters here more than in most games because hands open early and often, so there is a lot to watch go past.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here, and not modelled either: nothing in the coach records what an opponent declined. The information is in the recorded hands, so this is measurable with the tools that already exist.',
  },
  {
    id: 'discard_provenance',
    phase: 'read',
    title: 'A tile thrown from the hand says more than the one just drawn',
    rule: 'Throwing the tile you just drew says only that it was no use. Throwing one that has been sitting in your hand says it stopped being useful, which is far more informative — and the same is true when you watch somebody else do it.',
    why: [
      'A hand-thrown tile marks the moment their plan changed, which is exactly the moment worth noticing.',
      'You can use it the other way too: a deliberate throw from hand resets what the table believes about you.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here. Our recorded hands do store whether a discard came from the hand or from the draw, so this one is waiting on somebody to ask the question rather than on new data.',
  },
  {
    id: 'pair_discards_rule_out',
    phase: 'read',
    title: 'A shed pair makes the tiles beside it safer',
    rule: 'When a player throws two copies of the same tile out of their hand, the tiles either side of it become close to safe: nearly every wait that would make them dangerous needed the pair they just gave up.',
    why: [
      'Nobody throws a pair they are using. Discarding it says the block it belonged to is gone.',
      'The exception is a 2 or an 8: shedding that pair still leaves a terminal pair wait live.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here. It is the same shape of claim as the walled-tile read, which was true at three to five times and worth nothing in chips, so a good guess is that this is real and also unprofitable — but that is a guess.',
  },
  {
    id: 'discarded_value_pair',
    phase: 'read',
    title: 'Somebody who throws away a value pair has a good hand',
    rule: 'A player who sheds a pair of dragons or their own seat wind has given up a tai on purpose. That means what is left is strong enough not to need it.',
    why: [
      'A tai for free is not a thing anybody discards lightly, especially at a table with a 2 tai minimum.',
      'It also tells you the honours near it are relatively safe now, which is useful when you are looking for something to throw.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here, and it is a good candidate: value pairs are easy to spot in the recorded hands, and the claim is exactly the kind the reads pipeline answers.',
  },
  {
    id: 'second_copy_call',
    phase: 'read',
    title: 'Watch which copy of a dragon gets claimed',
    rule: 'If the first dragon or wind goes past uncalled and somebody pongs the second, read that hand as cheap but assembled — probably ready or nearly so, and probably not worth much.',
    why: [
      'A player with real value would have claimed the first copy even with an awkward shape, because the tai was the point.',
      'A player who was both cheap and badly shaped would have let the second go too and kept it as a safe tile. Claiming only the second means neither.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here. It is the most specific read in the book and it fires often at this table, because honours are worth a tai each and hands open early — which makes it one of the better things to point the reads pipeline at next.',
  },
  {
    id: 'concealed_kong_signal',
    phase: 'read',
    title: 'A concealed kong means a developed hand',
    rule: 'Somebody declaring a concealed kong has a hand far enough along to spare four tiles for one set, and they get paid for it immediately. Treat them as a live threat and start banking safe tiles.',
    why: [
      'It is one of the few moments a concealed hand tells you something about itself.',
      'Do not import the fear that belongs to other variants: here a kong mostly just pays the declarer, and the payout is doubled at this table.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Untested as a threat signal here. The payout half of it is a rule of this table and is on the calling card about kongs.',
  },
  {
    id: 'fear_the_chaser',
    phase: 'read',
    title: 'Fear the second player to commit, not the first',
    rule: 'When somebody pushes into a threat that is already on the table, they are telling you their hand is worth the risk. Nobody chases with a weak one.',
    why: [
      'The first player to commit may simply have a hand. The second has looked at the first and decided to fight anyway.',
      'It is a read you get for free from the order of events, without knowing a single tile.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured here, and it needs a population that pushes and folds like a person to mean anything — the bots in our recorded runs do not chase, so this is one to be careful about measuring on the data we have.',
  },
  {
    id: 'wall_reading',
    phase: 'read',
    title: 'An early discard says what they never had',
    rule: 'When a player throws a tile early, the tiles next to it were probably not in their hand either. That makes those neighbours likelier to be still in the wall, which is worth knowing both for building and for defending.',
    why: [
      'Early discards are the cleanest information on the table, because nothing has happened yet to make a player lie with them.',
      'It cuts both ways: those tiles are safer to throw at that player, and they are also likelier to be drawn.',
    ],
    variants: [],
    claim: { kind: 'not-countable' },
    verdict: 'needs-play',
    verdictNote: 'Not measured, and easy to confuse with a read that was: the card about tiles with all four copies visible is a different rule, and it turned out true at three to five times and worth nothing in chips.',
  },
];

export const TIPS: Tip[] = CARDS.map(withCounts);
