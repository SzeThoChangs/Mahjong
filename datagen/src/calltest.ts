/**
 * Do the book's CALLING tips pick the action the play-outs say is best?
 *
 *   tsx src/calltest.ts --quiz ../web/public/quiz
 *
 * `tiptest.ts` does this for the shape tips, which are all about which tile to throw. Five tips on
 * the page are about whether to CLAIM instead, and none of them had been measured, because the
 * shape tagger only ever looks at discards. It does not have to be that way: a quiz pack grades
 * claim decisions exactly as it grades throws, 128 play-outs an option, so every one of these
 * positions already carries a measured best. The only thing missing was a filter per tip.
 *
 * THE BASELINE IS THE WHOLE MEASUREMENT, as it is in `tiptest.ts`. Nearly every claim question here
 * offers exactly two actions, call or pass, so following a tip at random is usually a coin. Two
 * corrections, the same two:
 *
 *  - Only positions the tip RESOLVES count: the measured best is either an action it points at or
 *    one it warns against. A best the tip had no opinion on is not evidence either way.
 *  - The coin is the tip's own share of the choice, not 50% assumed.
 *
 * WHAT THESE FILTERS ARE. Three of the five tips name a condition the pack cannot read off directly
 * - "visibly going for it", "a dangerous hand", "a good wait" - so the filter is OUR reading of the
 * card and is written out beside each one below. A tip that fails here has failed AS WE STATED IT.
 * The two that need no interpretation are `pon_over_chii` and `never_break_your_pair`.
 *
 * WHAT IT CANNOT SEPARATE, also from `tiptest.ts`: a measured best is the best action in the whole
 * position, so it prices danger and value as well as the thing the tip is about. And a pack is not
 * a random sample of the game - its positions are the ones where one action separates from the rest
 * by more than two standard errors.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { shanten, isJoker, type TileKind } from 'sg-mahjong-engine';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const quizDir = arg('quiz', '../web/public/quiz')!;
const only = arg('pack');
const verbose = process.argv.includes('--verbose');

interface PackQ {
  k: string; seat: number; dl: number; w: number; t: number; h: number[]; b: number[]; m: number[][];
  ld?: [number, number]; disc: number[][]; pm: number[][][]; actions: { a: string }[]; best: string;
}

/** A legal action, with the tiles it takes out of the concealed hand (empty for a pass). */
interface Act { a: string; call: boolean; takes: TileKind[] }

const parseAct = (a: string, offered: TileKind | null): Act => {
  const [head, rest] = a.split(':');
  if (head === 'pong') return { a, call: true, takes: [Number(rest), Number(rest)] };
  if (head === 'kong3') return { a, call: true, takes: [Number(rest), Number(rest), Number(rest)] };
  if (head === 'chow') {
    const tiles = rest!.split(',').map(Number);
    const takes = [...tiles];
    const i = offered === null ? -1 : takes.indexOf(offered);
    if (i >= 0) takes.splice(i, 1);          // the tile on the floor is not one of yours
    return { a, call: true, takes };
  }
  return { a, call: false, takes: [] };
};

const without = (hand: TileKind[], takes: TileKind[]) => {
  const rest = [...hand];
  for (const k of takes) { const i = rest.indexOf(k); if (i >= 0) rest.splice(i, 1); }
  return rest;
};

/** Distance after a call, allowing the throw the call forces. A kong draws a replacement instead. */
function afterCall(q: PackQ, act: Act): { concealed: TileKind[]; melds: number; sh: number } {
  const concealed = without(q.h, act.takes);
  const melds = q.m.length + 1;
  if (act.a.startsWith('kong3')) return { concealed, melds, sh: shanten(concealed, melds) };
  let sh = 99;
  for (const d of new Set(concealed)) {
    if (isJoker(d)) continue;                // the coach never offers a wildcard as a throw
    const s = shanten(without(concealed, [d]), melds);
    if (s < sh) sh = s;
  }
  return { concealed, melds, sh };
}

/** Copies of each kind nobody can still draw: your hand, every meld on the table, live discards. */
function seenCounts(q: PackQ): Uint8Array {
  const seen = new Uint8Array(34);
  for (const k of q.h) if (k < 34) seen[k]!++;
  for (const seat of q.pm) for (const m of seat) for (const k of m.slice(2)) if (k < 34) seen[k]!++;
  for (const d of q.disc) if (d[2] === -1 && d[1]! < 34) seen[d[1]!]!++;   // a claimed discard is already in a meld
  return seen;
}

/** How many tiles can end this hand, counting only copies still out there. */
function waitWidth(concealed: TileKind[], melds: number, seen: Uint8Array): number {
  let n = 0;
  for (let k = 0; k < 34; k++) {
    const left = 4 - seen[k]!;
    if (left <= 0) continue;
    if (shanten([...concealed, k], melds) === -1) n += left;
  }
  return n;
}

/** The widest ready hand a call can leave, or null if no throw keeps it ready. */
function widestAfter(q: PackQ, act: Act, seen: Uint8Array): number | null {
  const { concealed, melds } = afterCall(q, act);
  if (act.a.startsWith('kong3')) return shanten(concealed, melds) === 0 ? waitWidth(concealed, melds, seen) : null;
  let best: number | null = null;
  for (const d of new Set(concealed)) {
    if (isJoker(d)) continue;
    const rest = without(concealed, [d]);
    if (shanten(rest, melds) !== 0) continue;
    const w = waitWidth(rest, melds, seen);
    if (best === null || w > best) best = w;
  }
  return best;
}

const pairKinds = (hand: TileKind[]) => {
  const c = new Map<TileKind, number>();
  for (const k of hand) c.set(k, (c.get(k) ?? 0) + 1);
  return [...c].filter(([, n]) => n >= 2).map(([k]) => k);
};

/** Melds anyone else has on the table - the only commitment signal there is at this table. */
const opponentMelds = (q: PackQ) => q.pm.map((ms, s) => (s === q.seat ? 0 : ms.length));

/**
 * Each tip as a filter: given a position and its legal actions, which does the card point at, and
 * which does it warn against? Returning null means the position is not about this tip at all.
 */
interface Split { says: string[]; against: string[] }
type Filter = (q: PackQ, acts: Act[], seen: Uint8Array) => Split | null;

const FILTERS: Record<string, { note: string; f: Filter }> = {
  /**
   * "Chowing with the tiles that were your pair" - a call that leaves the concealed hand with no
   * pair at all. A pong of your own pair does it too, by turning the pair into a triplet, and the
   * card's title says "a call", so both count. The premise is that it is your ONLY pair, so hands
   * holding more than one are out, and so are hands holding a joker, where any tile is half a pair.
   */
  never_break_your_pair: {
    note: 'hand holds exactly one pair, no joker, and some call would leave it with none',
    f: (q, acts) => {
      if (q.h.some(isJoker)) return null;
      if (pairKinds(q.h).length !== 1) return null;
      const says: string[] = [], against: string[] = [];
      for (const act of acts) {
        const kills = act.call && pairKinds(without(q.h, act.takes)).length === 0;
        (kills ? against : says).push(act.a);
      }
      return against.length && says.length ? { says, against } : null;
    },
  },
  /** Both a pong and a chow are on offer for the same tile. No interpretation needed. */
  pon_over_chii: {
    note: 'a pong and a chow are both legal on the tile',
    f: (_q, acts) => {
      const says = acts.filter((a) => a.a.startsWith('pong:')).map((a) => a.a);
      const against = acts.filter((a) => a.a.startsWith('chow:')).map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  /**
   * Already ready, and a call would leave you ready on strictly more tiles. Width is counted in
   * live copies, which is the card's own "how many tiles can end the hand". The call is credited
   * with its best throw, so the tip is tested at its strongest.
   */
  call_to_upgrade: {
    note: 'hand is already ready and a call would leave it ready on more live tiles',
    f: (q, acts, seen) => {
      if (shanten(q.h, q.m.length) !== 0) return null;
      const now = waitWidth(q.h, q.m.length, seen);
      const says = acts.filter((a) => { if (!a.call) return false; const w = widestAfter(q, a, seen); return w !== null && w > now; }).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  /**
   * OUR READING. "Late in a dangerous hand, a call that keeps your shape" - late is the pack's own
   * late phase (turn past 35), dangerous is somebody else holding two or more melds, and keeping
   * your shape is a call that does not leave you further from ready than you already are.
   */
  call_to_skip_draw: {
    note: 'late, an opponent holds two or more melds, and a call would not cost distance',
    f: (q, acts) => {
      if (q.t <= 35) return null;
      if (!opponentMelds(q).some((n) => n >= 2)) return null;
      const now = shanten(q.h, q.m.length);
      const says = acts.filter((a) => a.call && afterCall(q, a).sh <= now).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  /**
   * OUR READING. "Against a committed opponent, take ready now" - committed is three melds, which
   * is the one commitment signal this project has actually measured (a seat with three exposed sets
   * is ready 39.5% of the time against 4.9% with none), and taking ready is a call that leaves the
   * hand one tile away when it was further than that.
   */
  take_ready_under_pressure: {
    note: 'an opponent holds three melds, our hand is not ready, and a call would make it ready',
    f: (q, acts) => {
      if (!opponentMelds(q).some((n) => n >= 3)) return null;
      if (shanten(q.h, q.m.length) <= 0) return null;
      const says = acts.filter((a) => a.call && afterCall(q, a).sh === 0).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  /** The same rule with the bar at two melds, to show whether the answer turns on where it is set. */
  take_ready_two_melds: {
    note: 'as above, but an opponent holding two melds counts as committed',
    f: (q, acts) => {
      if (!opponentMelds(q).some((n) => n >= 2)) return null;
      if (shanten(q.h, q.m.length) <= 0) return null;
      const says = acts.filter((a) => a.call && afterCall(q, a).sh === 0).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },

  /**
   * CONTROLS. Every tip above says "call rather than pass", and the packs were selected for
   * decisive positions, so the first thing to know is how often calling simply wins. These arms
   * carry no condition from any card: they are the base rate each tip has to beat to mean anything.
   */
  ctl_any_call: {
    note: 'CONTROL: every position offering a call and a pass, no condition at all',
    f: (_q, acts) => {
      const says = acts.filter((a) => a.call).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  ctl_ready_no_pressure: {
    note: 'CONTROL for take_ready: a call makes us ready and NOBODY has two melds',
    f: (q, acts) => {
      if (opponentMelds(q).some((n) => n >= 2)) return null;
      if (shanten(q.h, q.m.length) <= 0) return null;
      const says = acts.filter((a) => a.call && afterCall(q, a).sh === 0).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  ctl_skip_draw_early_safe: {
    note: 'CONTROL for call_to_skip_draw: same shape-keeping call, but early or mid and nobody committed',
    f: (q, acts) => {
      if (q.t > 35) return null;
      if (opponentMelds(q).some((n) => n >= 2)) return null;
      const now = shanten(q.h, q.m.length);
      const says = acts.filter((a) => a.call && afterCall(q, a).sh <= now).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  ctl_upgrade_not_wider: {
    note: 'CONTROL for call_to_upgrade: already ready, the call keeps us ready but NOT wider',
    f: (q, acts, seen) => {
      if (shanten(q.h, q.m.length) !== 0) return null;
      const now = waitWidth(q.h, q.m.length, seen);
      const says = acts.filter((a) => { if (!a.call) return false; const w = widestAfter(q, a, seen); return w !== null && w <= now; }).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  ctl_pair_killer_elsewhere: {
    note: 'CONTROL for never_break_your_pair: a call that keeps a pair, in hands that hold two or more',
    f: (q, acts) => {
      if (q.h.some(isJoker)) return null;
      if (pairKinds(q.h).length < 2) return null;
      const says = acts.filter((a) => a.call).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  /**
   * The pair question again, as a clean binary. The arm above bundles passing with any other call,
   * and its control is drawn from hands holding two pairs, which are a different kind of hand. These
   * two arms take the same hands - exactly one pair, no joker - and the same shape of position, one
   * call against one pass, and differ ONLY in whether that call would kill the pair. `follows` is
   * how often PASSING was the measured best, so the card is right if the first is far above the
   * second.
   */
  pair_kill_binary: {
    note: 'MATCHED: one pair, no joker, one call against one pass, and the call kills the pair',
    f: (q, acts) => {
      if (q.h.some(isJoker)) return null;
      if (pairKinds(q.h).length !== 1) return null;
      if (acts.length !== 2) return null;
      const call = acts.find((a) => a.call), pass = acts.find((a) => a.a === 'pass');
      if (!call || !pass) return null;
      if (pairKinds(without(q.h, call.takes)).length !== 0) return null;
      return { says: [pass.a], against: [call.a] };
    },
  },
  ctl_pair_keep_binary: {
    note: 'MATCHED CONTROL: the same hands and shape, but the call leaves a pair standing',
    f: (q, acts) => {
      if (q.h.some(isJoker)) return null;
      if (pairKinds(q.h).length !== 1) return null;
      if (acts.length !== 2) return null;
      const call = acts.find((a) => a.call), pass = acts.find((a) => a.a === 'pass');
      if (!call || !pass) return null;
      if (pairKinds(without(q.h, call.takes)).length === 0) return null;
      return { says: [pass.a], against: [call.a] };
    },
  },
  /**
   * The two halves of `call_to_skip_draw`'s condition, each on its own, so the write-up can say
   * which of them - being late, or somebody being committed - the answer actually turns on.
   */
  ctl_skip_draw_late_only: {
    note: 'SPLIT: a shape-keeping call, late, whatever anyone else holds',
    f: (q, acts) => {
      if (q.t <= 35) return null;
      const now = shanten(q.h, q.m.length);
      const says = acts.filter((a) => a.call && afterCall(q, a).sh <= now).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
  ctl_skip_draw_pressure_only: {
    note: 'SPLIT: a shape-keeping call with somebody on two melds, at any turn',
    f: (q, acts) => {
      if (!opponentMelds(q).some((n) => n >= 2)) return null;
      const now = shanten(q.h, q.m.length);
      const says = acts.filter((a) => a.call && afterCall(q, a).sh <= now).map((a) => a.a);
      const against = acts.filter((a) => a.a === 'pass').map((a) => a.a);
      return says.length && against.length ? { says, against } : null;
    },
  },
};

interface Score { seen: number; resolved: number; follows: number; expected: number; variance: number }
const blank = (): Score => ({ seen: 0, resolved: 0, follows: 0, expected: 0, variance: 0 });
const pooled = new Map<string, Score>();

const report = (title: string, table: Map<string, Score>) => {
  console.log(`\n${title}`);
  console.log('  tip                        about  resolved   follows it   by luck      z   follows/resolved');
  for (const [t, s] of [...table].sort((a, b) => b[1].seen - a[1].seen)) {
    if (!s.seen) continue;
    const rate = s.resolved ? s.follows / s.resolved : 0, luck = s.resolved ? s.expected / s.resolved : 0;
    const z = s.variance > 0 ? (s.follows - s.expected) / Math.sqrt(s.variance) : 0;
    console.log(`  ${t.padEnd(26)} ${String(s.seen).padStart(4)}  ${String(s.resolved).padStart(8)}   ${`${(100 * rate).toFixed(0)}%`.padStart(10)}  ${`${(100 * luck).toFixed(0)}%`.padStart(8)}  ${`${z >= 0 ? '+' : ''}${z.toFixed(1)}`.padStart(5)}   ${s.follows}/${s.resolved}`);
  }
};

const files = readdirSync(quizDir).filter((f) => f.endsWith('.json') && f !== 'index.json' && (!only || f === `${only}.json`));
let packsRead = 0;

for (const f of files) {
  const pack = JSON.parse(readFileSync(join(quizDir, f), 'utf8')) as { questions?: PackQ[] };
  if (!pack.questions) continue;
  packsRead++;
  const st = new Map<string, Score>();
  let claims = 0, usable = 0;
  for (const q of pack.questions) {
    if (q.k !== 'claim') continue;
    claims++;
    // A position where the hand can simply be declared is not a question about calling.
    if (q.actions.some((a) => a.a === 'win')) continue;
    usable++;
    const offered = q.ld ? (q.ld[1] as TileKind) : null;
    const acts = q.actions.map((a) => parseAct(a.a, offered));
    const seen = seenCounts(q);
    for (const [tip, { f: filter }] of Object.entries(FILTERS)) {
      const split = filter(q, acts, seen);
      if (!split) continue;
      const s = st.get(tip) ?? blank(), g = pooled.get(tip) ?? blank();
      s.seen++; g.seen++;
      const hit = split.says.includes(q.best), miss = split.against.includes(q.best);
      if (hit || miss) {
        const p = split.says.length / (split.says.length + split.against.length);
        for (const x of [s, g]) { x.resolved++; x.follows += hit ? 1 : 0; x.expected += p; x.variance += p * (1 - p); }
        if (verbose) console.log(`  ${tip} ${f} best=${q.best} says=[${split.says}] against=[${split.against}] ${hit ? 'FOLLOWS' : 'breaks'}`);
      }
      st.set(tip, s); pooled.set(tip, g);
    }
  }
  report(`${f}: ${usable} claim positions with something to decide, of ${claims}`, st);
}

if (packsRead > 1) report(`pooled over ${packsRead} packs - the number to quote`, pooled);
console.log('\nfilters:');
for (const [tip, { note }] of Object.entries(FILTERS)) console.log(`  ${tip.padEnd(26)} ${note}`);
