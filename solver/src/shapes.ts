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
  /** the whole 13-tile hand, so a count means something */
  tiles: TileKind[];
  /** the part the tip is about */
  focus: TileKind[];
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
  const v = t.variants.map((x) => ({ ...x, ...ukeire(x.tiles) }));
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
    const u = ukeire(v.tiles);
    return { ...v, ukeire: u.count, kinds: u.kinds, shanten: u.sh, upgrades: t.wantUpgrades ? upgrades(v.tiles) : undefined };
  }) };
}

const TIPS: ShapeTip[] = [
  {
    id: 'five_blocks',
    title: 'Count blocks, not tiles',
    rule: 'A hand is four sets and a pair. Five blocks, no more.',
    why: [
      'Fourteen tiles is too many things to hold in your head, and you never need to. Every winning hand is five pieces, so the only question a shape asks is whether it is one of your five.',
      'A sixth block is not free. Every tile in it is a tile you will throw later, and while you hold it you are a tile short somewhere else.',
    ],
    notWhen: 'Six blocks is right when your two weakest are both middle waits. Then you keep both and let the wall pick.',
    variants: [
      { label: 'Five blocks: three runs, a part-run, a pair', tiles: T('2w 3w 4w 6w 7w 8w 2t 3t 4t 5t 6t 9s 9s'), focus: T('5t 6t 9s 9s') },
      { label: 'Six blocks: the pair broken to hold a spare', tiles: T('2w 3w 4w 6w 7w 8w 2t 3t 4t 5t 6t 9s 2s'), focus: T('9s 2s') },
    ],
    claim: { kind: 'closer-to-ready', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'The five-block hand is ready; the six-block one is a tile further away. It accepts more tiles, which is exactly the trap — a wider hand that is further from done.',
  },
  {
    id: 'pair_rule',
    title: 'One pair, keep two, break three',
    rule: 'One pair is what you need. Two is fine, because the spare can become a triplet. Three is too many.',
    why: [
      'Your hand needs exactly one pair, and a second is useful because it is also a triplet waiting to happen. So two pairs do two jobs.',
      'A third adds almost nothing. All three are competing to finish the same way, so each one makes the others less likely to be the one that pays.',
    ],
    variants: [
      { label: 'Two pairs', tiles: T('2w 3w 4w 6w 7w 8w 2t 3t 5s 5s 9s 9s 4s'), focus: T('5s 5s 9s 9s') },
      { label: 'Three pairs', tiles: T('2w 3w 4w 6w 7w 8w 2t 2t 5s 5s 9s 9s 4s'), focus: T('2t 2t 5s 5s 9s 9s') },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'Both hands are one away from ready. The third pair costs about a third of the accepting tiles.',
  },
  {
    id: 'sandwich',
    title: 'One block can be the set AND the pair',
    rule: 'A run with a tile doubled at its edge — 4-5-6-6 — gives you a set and your pair out of one block. So no other block has to be the pair.',
    why: [
      'Read 4-5-6-6 as one thing and it settles two of your five pieces at once: the run, and the pair you were going to need somewhere.',
      'Miss it and you go looking for a pair elsewhere, keep one, and end up holding three pairs — which is the shape the pair rule says to break.',
      'That is why this tip is really about reading rather than about width. Seeing it tells you what the rest of the hand is allowed to be.',
    ],
    variants: [
      { label: 'Sandwich: 4-5-6-6 supplies the set and the pair', tiles: T('4w 5w 6w 6w 2t 3t 6t 7t 3s 4s 7s 8s 9s'), focus: T('4w 5w 6w 6w') },
      { label: 'No sandwich: a plain run, pair needed elsewhere', tiles: T('4w 5w 6w 9w 2t 3t 6t 7t 3s 4s 7s 8s 9s'), focus: T('4w 5w 6w 9w') },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'confirmed',
    verdictNote: 'Confirmed, but read the margin honestly: both hands are two away and the sandwich accepts a little more, not a lot. The value of this tip is not the extra tiles — it is knowing your pair is already settled, so you stop hoarding a second one.',
  },
  {
    id: 'stepping_stones',
    title: 'The tile bridging two blocks works harder than it looks',
    rule: 'In a hand with no pair, a tile sitting between two part-runs is doing more than it appears. Do not cut it just because it looks spare.',
    why: [
      'A 5 between 3-4 and 6-7 is not one tile with one job. It extends either side, and it can pair up to become the pair the hand still needs.',
      'It looks like the loose tile because it is not obviously part of anything. That is exactly why it gets thrown.',
    ],
    variants: [
      { label: 'Bridge kept: 5w links 3-4w and 6-7w', tiles: T('3w 4w 5w 6w 7w 2t 3t 6t 7t 3s 4s 7s 8s'), focus: T('3w 4w 5w 6w 7w') },
      { label: 'Bridge cut for an isolated tile', tiles: T('3w 4w 6w 7w 9s 2t 3t 6t 7t 3s 4s 7s 8s'), focus: T('3w 4w 6w 7w 9s') },
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
      'A finished shape feels like an achievement, so it is hard to take apart. But what matters is not how tidy the hand is, it is how many tiles can end it.',
      'Sitting on one tile means three copies at most, often fewer once the table has seen some. Opening the hand back up trades that for a wait several times wider.',
    ],
    variants: [
      { label: 'Ready, but stuck on one tile', tiles: T('2w 3w 4w 5w 6w 7w 2t 3t 4t 6t 7t 8t 5s'), focus: T('5s') },
      { label: 'Broken up — still ready, and open again', tiles: T('2w 3w 4w 5w 6w 7w 2t 3t 4t 6t 7t 5s 5s'), focus: T('6t 7t 5s 5s') },
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
      'Three-four-five-six-seven can be read as 345 with 67 spare, or 567 with 34 spare, or a run plus a pair-to-be. Nothing is committed.',
      'The same five tiles split into two rigid pieces cannot do any of that. Every tile is already spoken for.',
    ],
    variants: [
      { label: 'One continuous run, 3w to 7w', tiles: T('3w 4w 5w 6w 7w 2t 3t 4t 6t 7t 8t 5s 5s'), focus: T('3w 4w 5w 6w 7w') },
      { label: 'Same five tiles, split and rigid', tiles: T('3w 4w 5w 8w 9w 2t 3t 4t 6t 7t 8t 5s 5s'), focus: T('3w 4w 5w 8w 9w') },
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
      'A spare tile beside a neighbour can finish as a run, from either side. A spare pair can only ever finish as a triplet, from the two copies left.',
      'The pair looks more solid, which is why it gets kept. It is the narrower of the two.',
    ],
    variants: [
      { label: 'Spare tile with a neighbour (7w 8w)', tiles: T('2w 3w 4w 7w 8w 2t 3t 4t 6t 7t 8t 5s 5s'), focus: T('7w 8w') },
      { label: 'Spare kept as a second pair (9w 9w)', tiles: T('2w 3w 4w 9w 9w 2t 3t 4t 6t 7t 8t 5s 5s'), focus: T('9w 9w') },
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
      'Count the tiles that finish the hand and these two look identical, because they are.',
      'The difference is in the tiles that are not progress at all — the ones that leave you the same distance away but waiting on more. A block touching a run has somewhere to grow. An isolated block has nowhere.',
      'This is the tip that shows why counting acceptance is not the whole story, and it is why the card below shows a second number.',
    ],
    variants: [
      { label: 'Block touching the run (4w5w6w + 7w9w)', tiles: T('4w 5w 6w 7w 9w 2t 3t 4t 6t 7t 8t 5s 5s'), focus: T('4w 5w 6w 7w 9w') },
      { label: 'Block standing alone (4w5w6w + 2s4s)', tiles: T('4w 5w 6w 2s 4s 2t 3t 4t 6t 7t 8t 5s 5s'), focus: T('2s 4s') },
    ],
    claim: { kind: 'upgrades-more', better: 0, than: 1 },
    wantUpgrades: true,
    verdict: 'confirmed',
    verdictNote: 'Identical on acceptance — 4 tiles from 1 kind each — and not identical at all. The attached block has 12 tiles that widen it without bringing it closer; the lone block has 5. The book called these "hidden upgrades" and they are hidden precisely from the count everybody uses.',
  },
  {
    id: 'perfect_one_away',
    title: 'Two open part-runs plus a pair',
    rule: 'The book calls this the widest shape you can hold one tile from ready, and says not to tidy it.',
    why: [
      'Both part-runs can finish from either end and the pair is already settled, so on paper nothing competes for the same job.',
      'It looks untidy, which is the reason people break it up.',
    ],
    variants: [
      { label: 'Two open part-runs and a pair', tiles: T('2w 3w 4w 5w 6w 7w 3t 4t 6t 7t 5s 5s 9s'), focus: T('3t 4t 6t 7t 5s 5s') },
      { label: '"Tidied" — one part-run traded for a pair', tiles: T('2w 3w 4w 5w 6w 7w 3t 4t 6t 6t 5s 5s 9s'), focus: T('3t 4t 6t 6t 5s 5s') },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    wantUpgrades: true,
    verdict: 'contradicted',
    verdictNote: 'Not shown here. The two are exactly level on acceptance — 12 tiles each — and on the second measure the "tidied" version is ahead, 30 upgrade tiles against 14. Whatever makes this shape special at a Riichi table, it is not width at ours, and the tidier hand is not obviously worse.',
  },
  {
    id: 'four_tile_ranking',
    title: 'Which four-tile block to break',
    rule: 'The book ranks them: extended run (2-3-4-5) and bulging run (3-4-4-5) near-equal, pair-attached (2-3-3-4) clearly weakest.',
    why: [
      'A four-tile block is a run plus a spare, and what matters is how hard the spare works.',
      'In 2-3-4-5 the spare extends the run at either end. In 3-4-4-5 the doubled middle can become the pair. In 2-3-3-4 the spare only duplicates a tile the run already uses.',
    ],
    variants: [
      { label: 'Extended run  2-3-4-5', tiles: T('2w 3w 4w 5w 2t 3t 4t 6t 7t 8t 5s 5s 9s'), focus: T('2w 3w 4w 5w') },
      { label: 'Bulging run  3-4-4-5', tiles: T('3w 4w 4w 5w 2t 3t 4t 6t 7t 8t 5s 5s 9s'), focus: T('3w 4w 4w 5w') },
      { label: 'Pair-attached  2-3-3-4', tiles: T('2w 3w 3w 4w 2t 3t 4t 6t 7t 8t 5s 5s 9s'), focus: T('2w 3w 3w 4w') },
    ],
    claim: { kind: 'level', a: 1, b: 2 },
    verdict: 'contradicted',
    verdictNote: 'Half of it is wrong here. The extended run is well ahead, as the book says. But the bulging run is NOT near-equal to it — it comes out level with the pair-attached shape the book calls clearly weakest. So the useful version of this tip at our table is simpler: keep the extended run, and the other two are much of a muchness.',
  },
  {
    id: 'threes_and_sevens',
    title: 'A 3 or a 7 is the best loose tile to keep',
    rule: 'Of the single tiles you might hold, 3 and 7 are the strongest. Counting cannot see why.',
    why: [
      'A lone tile is worth what it can grow into. A 3 can become 1-2-3, 2-3-4 or 3-4-5, and two of those end at the edge of the suit.',
      'Edge-facing runs are easier to finish, because the tiles that complete them are the ones opponents give up most readily. A 5 has just as many runs available, but every one waits on a middle tile other people are holding.',
    ],
    notWhen: 'This decides which floater to keep when the rest is equal. It never beats keeping a block you already have.',
    variants: [
      { label: 'Keeping the 3', tiles: T('3w 2t 3t 4t 6t 7t 8t 2s 3s 4s 6s 7s 9s'), focus: T('3w') },
      { label: 'Keeping the 5', tiles: T('5w 2t 3t 4t 6t 7t 8t 2s 3s 4s 6s 7s 9s'), focus: T('5w') },
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
      'This wait needs one of the two remaining copies of one tile. Everything depends on whether anybody will let it go.',
      'Terminals and honours get thrown early and freely, because they are worth little in most hands. A middle tile is useful to everyone, so the copies you need sit in hands until the wall runs out.',
    ],
    variants: [
      { label: 'Waiting on the last two 9s', tiles: T('9w 9w 2t 3t 4t 6t 7t 8t 2s 3s 4s 6s 6s'), focus: T('9w 9w') },
      { label: 'Waiting on the last two 5s', tiles: T('5w 5w 2t 3t 4t 6t 7t 8t 2s 3s 4s 6s 6s'), focus: T('5w 5w') },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    verdict: 'needs-play',
    verdictNote: 'Identical on paper — same width, same shanten. The whole claim is about who releases the tile, so counting can never settle it. The reads pipeline can, and has not been pointed at it yet.',
  },
  {
    id: 'triplet_adjacency',
    title: 'Tiles beside your own triplet',
    rule: 'The book says a tile next to a triplet you hold is weak, because you hold three of the copies it needs.',
    why: [
      'The reasoning is that a tile is worth what can still arrive to join it, and you are holding much of that yourself.',
      'But it cuts the other way too: the triplet can lend one tile to a run. Three 4s and a 3 is a set and a part-run at the same time.',
    ],
    variants: [
      { label: '3w sitting beside your own 4w-4w-4w', tiles: T('3w 4w 4w 4w 2t 3t 4t 6t 7t 8t 2s 3s 9s'), focus: T('3w 4w 4w 4w') },
      { label: 'An isolated 9w instead', tiles: T('9w 4w 4w 4w 2t 3t 4t 6t 7t 8t 2s 3s 9s'), focus: T('9w 4w 4w 4w') },
    ],
    claim: { kind: 'accepts-more', better: 0, than: 1 },
    verdict: 'contradicted',
    verdictNote: 'The opposite of the book, and not by a little. The tile beside the triplet accepts far more, because the triplet can spare one tile for a run. The book\'s reasoning is sound about the copies, but it misses what the triplet gives back. Treat this tip as not applying here until somebody builds a fairer test of it.',
  },
  {
    id: 'narrow_can_beat_wide',
    title: 'A wide wait can be worth less than a narrow one',
    rule: 'At a 2-tai table, a winning tile that leaves you under the minimum is not a winning tile. Count the outs that can actually be declared.',
    why: [
      'Every other tip about waits assumes any completing tile ends the hand. Here it does not — you can finish your hand and be unable to declare it.',
      'So an eight-tile wait where every out makes 0 tai is worth nothing, and a four-tile wait that reaches 2 tai is worth having.',
    ],
    variants: [
      { label: 'Ready, waiting on 4w and 7w — eight tiles, all dead', tiles: T('2w 2w 2w 3w 3w 5w 6w 7t 7t 8t 8t 9t 9t'), focus: T('5w 6w') },
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
      'You complete a triplet from a tile somebody throws or you draw. Middle tiles stay in other hands because they are useful there, so the copies never appear.',
      'Winds and dragons are the opposite. They are useless to anyone not already holding a pair, so they come out early and you get to claim them.',
      'This is also why a value pair is worth more than it looks at a 2-tai table. It is the easiest triplet to finish AND the one that arms the hand.',
    ],
    variants: [
      { label: 'A wind pair — completes 69% of the time', tiles: T('E E 2w 3w 4w 6w 7w 8w 2t 3t 4t 6t 7t'), focus: T('E E') },
      { label: 'A middle pair — 39%', tiles: T('5s 5s 2w 3w 4w 6w 7w 8w 2t 3t 4t 6t 7t'), focus: T('5s 5s') },
    ],
    claim: { kind: 'level', a: 0, b: 1 },
    verdict: 'measured',
    verdictNote: 'Level on paper and nowhere near level in practice. These rates come from the study of this table, not adapted from anywhere, and the gap between 69% and 39% is invisible to any amount of counting.',
  },
];

export const SHAPE_TIPS: ShapeTip[] = TIPS.map(withCounts);
