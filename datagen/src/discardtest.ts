/**
 * Do the book's rules about WHICH TILE TO THROW pick the tile the play-outs say is best?
 *
 *   tsx src/discardtest.ts --quiz ../web/public/quiz
 *
 * `tiptest.ts` already scores the tips the shape tagger can name, which is nine of them. It was
 * assumed that the rest of the book's discard advice could not be scored at all, because the tagger
 * only names shapes. That is not the reason. The tagger names shapes because a tip about SHAPE has
 * to point at the same tiles the card's example points at, and a hand-written filter does not: it
 * only has to say which throws a rule endorses in a position that has already been played out 128
 * times an option. Eight rules that were badged untested are testable that way, and this is them.
 *
 * WHAT IS DIFFERENT FROM `tiptest.ts`. The filters here are OURS. Every one of these cards names a
 * condition in ordinary words - "a feeble wait", "with nothing safe", "a borderline hand" - and the
 * filter is a reading of it, written out beside each rule below. A rule that fails here has failed
 * AS WE STATED IT, and somebody who disagrees with the reading should change the filter and re-run
 * rather than argue about the wording.
 *
 * THE CONTROLS COME FIRST, and they are the reason this file exists in the shape it does. On
 * 2026-09-05 the calling tips looked strong until somebody measured how often calling wins with no
 * condition at all - 72% - after which three of the five were below average. So the first arms here
 * carry no condition from any card: how often is the measured best the widest throw, the safest
 * throw, or simply a spare tile? Every rule below has to be read against those.
 */
import {
  scorePacks, seenCounts, waitWidth, acceptance, without, committedSeats, nextSeat,
  fitNull, featureKey, tileClass, shanten,
  type PackQ, type Split, type TileKind, type Arm, type NullModel,
} from './packlib.js';
import { loadPacks } from './packlib.js';
import { blocks, evaluateTargets, upgrades } from 'sg-mahjong-solver';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const quizDir = arg('quiz', '../web/public/quiz')!;
const only = arg('pack');

interface Throw {
  a: string; k: TileKind; rest: TileKind[];
  sh: number; raw: number; live: number; wait: number; dealin: number; loose: boolean;
}
interface Ctx {
  /**
   * `throws` is every legal throw; `keeps` is the ones that leave the hand as close to ready as any
   * throw can. Width may only ever be compared inside `keeps`. A hand one step further from ready
   * accepts far MORE tiles than a hand one step closer, so "the throw with the largest acceptance"
   * across all throws is a measure of which throw wrecks the hand most, and the first version of
   * this file scored exactly that: it reported the widest throw as best 6% of the time against 20%
   * by luck, in a project whose best-evidenced tip is that the play-outs take the wider wait 89% of
   * the time. The contradiction is what caught it.
   */
  throws: Throw[]; keeps: Throw[]; sh0: number; wait0: number; seen: Uint8Array;
  suit: number[];            // tiles held per suit
  honours: number;
  melds: number;
  /** the plan the coach would play from here, by its own ranking - a whole-hand pattern or not */
  topPlan: string;
  /** kinds held exactly twice that are a dragon or this seat's own wind: a one-tai block in the making */
  valuePairs: Set<TileKind>;
}

const HONOUR = (k: number) => k >= 27 && k < 34;
const TERMINAL = (k: number) => k < 27 && (k % 9 === 0 || k % 9 === 8);

function prepare(q: PackQ): Ctx | null {
  if (q.k !== 'discard' || !q.best.startsWith('d:')) return null;
  const melds = q.m.length;
  const seen = seenCounts(q);
  // the tiles no block wants: what `blocks` leaves over once the hand is split as generously as it can be
  const spare = new Map<TileKind, number>();
  for (const k of q.h) spare.set(k, (spare.get(k) ?? 0) + 1);
  for (const b of blocks(q.h)) for (const k of b.tiles) spare.set(k, (spare.get(k) ?? 0) - 1);
  const throws: Throw[] = [];
  for (const act of q.actions) {
    if (!act.a.startsWith('d:')) continue;
    const k = Number(act.a.slice(2)) as TileKind;
    const rest = without(q.h, [k]);
    const sh = shanten(rest, melds);
    const acc = acceptance(rest, melds, seen);
    throws.push({
      a: act.a, k, rest, sh, raw: acc.raw, live: acc.live,
      wait: sh === 0 ? waitWidth(rest, melds, seen) : 0,
      dealin: act.dealin, loose: (spare.get(k) ?? 0) > 0,
    });
  }
  if (throws.length < 2) return null;
  const suit = [0, 0, 0];
  let honours = 0;
  for (const k of q.h) { if (k < 27) suit[Math.floor(k / 9)]!++; else if (k < 34) honours++; }
  const minSh = Math.min(...throws.map((t) => t.sh));
  const keeps = throws.filter((t) => t.sh === minSh);
  /**
   * Distance and width are properties of the hand you are LEFT with, not of the fourteen tiles in
   * front of you. Reading the wait off the undiscarded hand disagrees with the best wait a throw
   * can actually leave in 2,064 of 4,815 ready positions - it was wrong 43% of the time - so both
   * are taken from the throws. Distance barely moves either way, differing 87 times in 8,226, which
   * is why only the width mattered.
   */
  const wait0 = minSh === 0 ? Math.max(...keeps.map((t) => t.wait)) : 0;
  // `wallRemaining` only prices an UNARMED cheap hand, which never ranks first, so the top plan is
  // unaffected by the estimate; the pack does not store the true count.
  const evals = evaluateTargets({ concealed: q.h, melds: q.m.map((x) => ({ type: x[0] === 0 ? 'chow' : x[0] === 1 ? 'pong' : 'kong', tiles: x.slice(2), concealed: x[1] === 1 })) },
    { seat: (q.seat - q.dl + 4) % 4, prevailingWind: q.w, bonus: q.b, playerTurns: q.t, wallRemaining: 40, minimumFan: 2, selfDrawMinimumFan: 1 });
  const topPlan = evals[0]?.id ?? 'none';
  const count = new Map<number, number>();
  for (const k of q.h) count.set(k, (count.get(k) ?? 0) + 1);
  const seatWind = 27 + ((q.seat - q.dl + 4) % 4);
  const valuePairs = new Set<TileKind>([...count].filter(([k, n]) => n === 2 && (k === 31 || k === 32 || k === 33 || k === seatWind)).map(([k]) => k as TileKind));
  return { throws, keeps, sh0: minSh, wait0, seen, suit, honours, melds, topPlan, valuePairs };
}

/** every throw that ties for the largest value of `f`, and every throw that does not */
function topSplit(ts: Throw[], f: (t: Throw) => number): Split | null {
  const best = Math.max(...ts.map(f));
  const says = ts.filter((t) => f(t) === best).map((t) => t.a);
  const against = ts.filter((t) => f(t) !== best).map((t) => t.a);
  return says.length && against.length ? { says, against } : null;
}
const namesOf = (ts: Throw[]) => ts.map((t) => t.a);

const ARMS: Record<string, Arm<Ctx>> = {
  /**
   * CONTROLS. No card, no condition - just how often each obvious throw is the right one. Nothing
   * below can be read without these, because a rule that happens to point at spare tiles inherits
   * whatever rate spare tiles win at.
   */
  ctl_widest_raw: {
    note: 'CONTROL: of the throws that cost no distance, the one accepting most tiles on paper',
    f: (_q, c) => topSplit(c.keeps, (t) => t.raw),
  },
  ctl_widest_live: {
    note: 'CONTROL: the same, counting only copies not already visible',
    f: (_q, c) => topSplit(c.keeps, (t) => t.live),
  },
  ctl_keeps_distance: {
    note: 'CONTROL: any throw that costs no distance, against the ones that do',
    f: (_q, c) => {
      const names = new Set(namesOf(c.keeps));
      const against = namesOf(c.throws.filter((t) => !names.has(t.a)));
      return against.length ? { says: [...names], against } : null;
    },
  },
  ctl_safest: {
    note: 'CONTROL: the throw the play-outs deal in with least often',
    f: (_q, c) => topSplit(c.throws, (t) => -t.dealin),
  },
  ctl_spare_tile: {
    note: 'CONTROL: any tile no block wants - the throw a hand makes anyway',
    f: (_q, c) => {
      const says = namesOf(c.throws.filter((t) => t.loose)), against = namesOf(c.throws.filter((t) => !t.loose));
      return says.length && against.length ? { says, against } : null;
    },
  },

  /**
   * `break_mediocre_ready`: ready on a feeble wait, and a throw exists that gives ready up. Feeble
   * is four live tiles or fewer, which is the width the book's own bad-wait cards use.
   */
  break_mediocre_ready: {
    note: 'ready on four live tiles or fewer, and some throw gives ready up',
    f: (_q, c) => {
      if (c.sh0 !== 0 || c.wait0 > 4) return null;
      return { says: namesOf(c.throws.filter((t) => t.sh > 0)), against: namesOf(c.throws.filter((t) => t.sh === 0)) };
    },
  },
  ctl_keep_wide_ready: {
    note: 'MATCHED CONTROL: the same choice, but ready on eight live tiles or more, where the card says keep',
    f: (_q, c) => {
      if (c.sh0 !== 0 || c.wait0 < 8) return null;
      return { says: namesOf(c.throws.filter((t) => t.sh > 0)), against: namesOf(c.throws.filter((t) => t.sh === 0)) };
    },
  },

  /**
   * `keep_floaters`: the widest throw on paper is not the widest in fact, because some of what it
   * accepts is already on the table. Fires only where the two disagree, and asks which one the
   * play-outs pick.
   */
  keep_floaters: {
    note: 'the throw that is widest on paper is not the one that is widest in live tiles',
    f: (_q, c) => {
      const rawBest = Math.max(...c.keeps.map((t) => t.raw)), liveBest = Math.max(...c.keeps.map((t) => t.live));
      const says = namesOf(c.keeps.filter((t) => t.live === liveBest && t.raw !== rawBest));
      const against = namesOf(c.keeps.filter((t) => t.raw === rawBest && t.live !== liveBest));
      return says.length && against.length ? { says, against } : null;
    },
  },

  /**
   * `withhold_safe_tiles`: you hold the last copy of a tile the table has already passed on. The
   * card says keep it, so the throw it warns against is that tile and everything else is endorsed.
   */
  withhold_safe_tiles: {
    note: 'holding the last copy of a kind already thrown and passed - the card says do not throw it',
    f: (q, c) => {
      const passed = new Set(q.disc.filter((d) => d[2] === -1).map((d) => d[1]!));
      const held = new Map<TileKind, number>();
      for (const k of q.h) held.set(k, (held.get(k) ?? 0) + 1);
      const lastSafe = c.throws.filter((t) => passed.has(t.k) && held.get(t.k) === 1 && c.seen[t.k] === 4);
      if (!lastSafe.length) return null;
      const names = new Set(namesOf(lastSafe));
      return { says: namesOf(c.throws.filter((t) => !names.has(t.a))), against: [...names] };
    },
  },
  ctl_safe_not_last: {
    note: 'MATCHED CONTROL: the same proven-safe tile, but copies of it remain unseen',
    f: (q, c) => {
      const passed = new Set(q.disc.filter((d) => d[2] === -1).map((d) => d[1]!));
      const safe = c.throws.filter((t) => passed.has(t.k) && c.seen[t.k]! < 4);
      if (!safe.length) return null;
      const names = new Set(namesOf(safe));
      return { says: namesOf(c.throws.filter((t) => !names.has(t.a))), against: [...names] };
    },
  },

  /**
   * `terminal_triplet_release`: with somebody committed and the hand late, throw from a terminal
   * triplet you hold all three of. "Nothing safe" is read as somebody holding two melds past turn
   * 25, which is when a fold is a real option at all.
   */
  terminal_triplet_release: {
    note: 'late, somebody committed, and the hand holds all three of a terminal - throw from it',
    f: (q, c) => {
      if (q.t <= 25 || !committedSeats(q, 2).length) return null;
      const held = new Map<TileKind, number>();
      for (const k of q.h) held.set(k, (held.get(k) ?? 0) + 1);
      const from = c.throws.filter((t) => TERMINAL(t.k) && held.get(t.k) === 3);
      if (!from.length) return null;
      const names = new Set(namesOf(from));
      return { says: [...names], against: namesOf(c.throws.filter((t) => !names.has(t.a))) };
    },
  },

  /**
   * `squeeze_the_caller`: only the seat after you can chow, so when that seat is the committed one,
   * throw something it cannot chow. Read strictly: an honour cannot be chowed by anyone, and a kind
   * that seat has already discarded is one it has shown it does not want.
   */
  squeeze_the_caller: {
    note: 'the seat after us is committed - throw what it cannot chow (an honour, or a kind it threw)',
    f: (q, c) => {
      const nxt = nextSeat(q);
      if (q.pm[nxt]!.length < 2) return null;
      const theirs = new Set(q.disc.filter((d) => d[0] === nxt).map((d) => d[1]!));
      const says = namesOf(c.throws.filter((t) => HONOUR(t.k) || theirs.has(t.k)));
      const against = namesOf(c.throws.filter((t) => !HONOUR(t.k) && !theirs.has(t.k)));
      return says.length && against.length ? { says, against } : null;
    },
  },

  /**
   * MATCHED CONTROL for `squeeze_the_caller`. Its whole mechanism is that only the seat after you
   * can chow your throw, so the identical split aimed at a committed seat that is NOT next to us
   * has to score worse. If it scores the same, what we measured was "throw an honour at a committed
   * player" and the chow half of the card is doing nothing.
   */
  ctl_squeeze_other_seat: {
    note: 'MATCHED CONTROL: the same split aimed at a committed seat that is not the one after us',
    f: (q, c) => {
      const nxt = nextSeat(q);
      if (q.pm[nxt]!.length >= 2) return null;
      const other = committedSeats(q, 2).find((s) => s !== nxt);
      if (other === undefined) return null;
      const theirs = new Set(q.disc.filter((d) => d[0] === other).map((d) => d[1]!));
      const says = namesOf(c.throws.filter((t) => HONOUR(t.k) || theirs.has(t.k)));
      const against = namesOf(c.throws.filter((t) => !HONOUR(t.k) && !theirs.has(t.k)));
      return says.length && against.length ? { says, against } : null;
    },
  },

  /**
   * MATCHED CONTROL for `flush_decided_early`. A hand holding ten of one suit has almost nothing
   * outside it, and what is outside is nearly always a spare - and spares are the measured best 69%
   * of the time whatever the card says. This arm asks the spare question inside the same positions,
   * so the colour rule can be read against its own neighbourhood rather than the global rate.
   */
  ctl_flush_local_spare: {
    note: 'MATCHED CONTROL: inside those same early colour hands, spare tiles against the rest',
    f: (q, c) => {
      if (q.t > 12) return null;
      let bestN = 0;
      for (let s = 0; s < 3; s++) bestN = Math.max(bestN, c.suit[s]! + c.honours);
      if (bestN < 10) return null;
      const says = namesOf(c.throws.filter((t) => t.loose)), against = namesOf(c.throws.filter((t) => !t.loose));
      return says.length && against.length ? { says, against } : null;
    },
  },


  /**
   * `full_hand_over_partial`: the hand is being played for a whole-hand pattern and also holds a
   * pair of a dragon or its seat wind, which is a one-tai block that depends on one pong arriving.
   * The card says the pattern comes first, so it points at throwing from that pair. Only throws
   * that cost the hand no distance are compared, so the play-outs are not being asked whether to
   * wreck the hand to keep a pair - that question the distance control already answers.
   */
  full_hand_over_partial: {
    note: 'top plan is a whole-hand pattern and the hand holds one dragon or seat-wind pair - throw from the pair',
    f: (_q, c) => {
      if (!['half_color', 'ping_wu', 'all_chow', 'all_pong'].includes(c.topPlan) || c.valuePairs.size !== 1) return null;
      const says = namesOf(c.keeps.filter((t) => c.valuePairs.has(t.k)));
      const against = namesOf(c.keeps.filter((t) => !c.valuePairs.has(t.k)));
      return says.length && against.length ? { says, against } : null;
    },
  },
  ctl_value_pair_no_pattern: {
    note: 'MATCHED CONTROL: the same choice when the top plan is the cheap hand, where the card says the pair is the point',
    f: (_q, c) => {
      if (c.topPlan !== 'chicken' || c.valuePairs.size !== 1) return null;
      const says = namesOf(c.keeps.filter((t) => c.valuePairs.has(t.k)));
      const against = namesOf(c.keeps.filter((t) => !c.valuePairs.has(t.k)));
      return says.length && against.length ? { says, against } : null;
    },
  },

  /**
   * `project_bad_draws`: among throws that keep the hand at its best distance AND tie on how many
   * tiles bring it closer, prefer the one that leaves the most draws that WIDEN it without bringing
   * it closer - `upgrades` from `tips.ts`, which is the card's "somewhere to go" made countable.
   * Restricted to hands with no melds because `upgrades` reads a concealed hand.
   */
  project_bad_draws: {
    note: 'throws tied on distance and acceptance, no melds - take the one leaving the most upgrade draws',
    f: (_q, c) => {
      if (c.melds !== 0) return null;
      const top = Math.max(...c.keeps.map((t) => t.raw));
      const tied = c.keeps.filter((t) => t.raw === top);
      if (tied.length < 2) return null;
      const up = new Map(tied.map((t) => [t.a, upgrades(t.rest)] as const));
      const best = Math.max(...up.values());
      const says = tied.filter((t) => up.get(t.a) === best).map((t) => t.a), against = tied.filter((t) => up.get(t.a) !== best).map((t) => t.a);
      return says.length && against.length ? { says, against } : null;
    },
  },

  /**
   * `one_turn_is_not_the_fight`: the safest throw here costs half the hand's width or more. The card
   * says take the width, so the safe throw is the one it warns against.
   */
  one_turn_is_not_the_fight: {
    note: 'the safest throw costs half the acceptance or more - the card says keep the width',
    f: (_q, c) => {
      const wide = Math.max(...c.keeps.map((t) => t.live));
      if (wide <= 0) return null;
      const safest = c.throws.reduce((a, b) => (b.dealin < a.dealin ? b : a));
      if (safest.live * 2 > wide) return null;
      const says = namesOf(c.keeps.filter((t) => t.live === wide));
      return says.includes(safest.a) ? null : { says, against: [safest.a] };
    },
  },

  /**
   * `not_the_third_fighter`: with two opponents already committed, take the safe throw over the wide
   * one. The two controls run the identical choice with one opponent committed and with none, so
   * the question is whether the answer moves with the number of fighters or is the same throughout.
   */
  not_the_third_fighter: {
    note: 'two or more opponents committed: take the safest throw over the widest',
    f: (q, c) => fightSplit(q, c, 2, 9),
  },
  ctl_one_fighter: {
    note: 'MATCHED CONTROL: the same choice with exactly one opponent committed',
    f: (q, c) => fightSplit(q, c, 1, 1),
  },
  ctl_no_fighter: {
    note: 'MATCHED CONTROL: the same choice with nobody committed',
    f: (q, c) => fightSplit(q, c, 0, 0),
  },

  /**
   * `flush_decided_early`: early, and the hand already holds ten of one suit plus honours. The card
   * says commit, so it points at every throw outside that suit. The control is the hand that is
   * close to the bar but under it, where the card says an ordinary hand is the better route.
   */
  flush_decided_early: {
    note: 'early, and ten or more tiles of one suit plus honours - throw outside the suit',
    f: (q, c) => (q.t <= 12 ? flushSplit(c, 10, 99) : null),
  },
  ctl_flush_under_bar: {
    note: 'MATCHED CONTROL: the same early choice with seven or eight of a suit plus honours',
    f: (q, c) => (q.t <= 12 ? flushSplit(c, 7, 8) : null),
  },
};

/** the safe throw against the wide one, with the number of committed opponents pinned */
function fightSplit(q: PackQ, c: Ctx, lo: number, hi: number): Split | null {
  const n = committedSeats(q, 2).length;
  if (n < lo || n > hi) return null;
  const wide = Math.max(...c.keeps.map((t) => t.live));
  const safest = c.throws.reduce((a, b) => (b.dealin < a.dealin ? b : a));
  const widest = namesOf(c.keeps.filter((t) => t.live === wide));
  if (widest.includes(safest.a)) return null;      // nothing to trade off
  return { says: [safest.a], against: widest };
}

/** throws outside the suit the hand is already collecting, when it holds between `lo` and `hi` of it */
function flushSplit(c: Ctx, lo: number, hi: number): Split | null {
  let best = -1, bestN = 0;
  for (let s = 0; s < 3; s++) { const n = c.suit[s]! + c.honours; if (n > bestN) { bestN = n; best = s; } }
  if (bestN < lo || bestN > hi) return null;
  const inSuit = (k: TileKind) => k < 27 && Math.floor(k / 9) === best;
  const says = namesOf(c.throws.filter((t) => !inSuit(t.k) && !HONOUR(t.k)));
  const against = namesOf(c.throws.filter((t) => inSuit(t.k) || HONOUR(t.k)));
  return says.length && against.length ? { says, against } : null;
}

/**
 * Fit the matched baseline before scoring anything, on every graded throw in both packs. Every
 * throw contributes one row saying what it was and whether it turned out to be the measured best.
 */
function fit(): NullModel {
  const rows: { key: string; best: boolean }[] = [];
  for (const { questions } of loadPacks(quizDir, only)) {
    for (const q of questions) {
      const c = prepare(q);
      if (!c) continue;
      for (const t of c.throws) rows.push({ key: featureKey(t.sh > c.sh0, t.loose, tileClass(t.k)), best: q.best === t.a });
    }
  }
  return fitNull(rows);
}
const NULL = fit();
console.log('the matched baseline, fitted on every graded throw in both packs:');
for (const [k, v] of [...NULL].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} best ${(100 * v).toFixed(0)}% of the time`);

scorePacks<Ctx>({
  quizDir, only, arms: ARMS, prepare, width: 28,
  heading: (f, used, total) => `${f}: ${used} graded discard positions, of ${total} questions`,
  weight: (_q, c, a) => {
    const t = c.throws.find((x) => x.a === a);
    return t ? (NULL.get(featureKey(t.sh > c.sh0, t.loose, tileClass(t.k))) ?? 0.1) : 0.1;
  },
});

/**
 * Two of these cards claim a tile is SAFE, and the packs measure that directly: every action
 * carries the share of play-outs in which it dealt in. So the advice and the mechanism can be
 * separated. A card can be right that its tile is safe and still be wrong to tell you to throw it,
 * and the two failures deserve different words on the page.
 */
function mechanism() {
  const rows: Record<string, { n: number; tip: number; safest: number; all: number }> = {
    terminal_triplet_release: { n: 0, tip: 0, safest: 0, all: 0 },
    withhold_safe_tiles: { n: 0, tip: 0, safest: 0, all: 0 },
  };
  for (const { questions } of loadPacks(quizDir, only)) {
    for (const q of questions) {
      const c = prepare(q);
      if (!c) continue;
      const held = new Map<number, number>();
      for (const k of q.h) held.set(k, (held.get(k) ?? 0) + 1);
      const safest = Math.min(...c.throws.map((t) => t.dealin));
      const all = c.throws.reduce((a, t) => a + t.dealin, 0) / c.throws.length;

      if (q.t > 25 && committedSeats(q, 2).length) {
        const from = c.throws.filter((t) => TERMINAL(t.k) && held.get(t.k) === 3);
        if (from.length) {
          const r = rows.terminal_triplet_release!;
          r.n++; r.tip += from.reduce((a, t) => a + t.dealin, 0) / from.length; r.safest += safest; r.all += all;
        }
      }
      const passed = new Set(q.disc.filter((d) => d[2] === -1).map((d) => d[1]!));
      const last = c.throws.filter((t) => passed.has(t.k) && held.get(t.k) === 1 && c.seen[t.k] === 4);
      if (last.length) {
        const r = rows.withhold_safe_tiles!;
        r.n++; r.tip += last.reduce((a, t) => a + t.dealin, 0) / last.length; r.safest += safest; r.all += all;
      }
    }
  }
  console.log('\nis the tile the card points at actually safe? (share of play-outs that dealt in)');
  console.log('  card                        positions   the card’s tile   the safest throw   every throw');
  for (const [k, r] of Object.entries(rows)) {
    if (!r.n) continue;
    console.log(`  ${k.padEnd(28)}${String(r.n).padStart(9)}   ${(100 * r.tip / r.n).toFixed(2).padStart(14)}%  ${(100 * r.safest / r.n).toFixed(2).padStart(16)}%  ${(100 * r.all / r.n).toFixed(2).padStart(11)}%`);
  }
}
mechanism();
