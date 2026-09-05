/**
 * The reads that are about WATCHING somebody, measured by replaying hands and looking at the truth.
 *
 *   tsx src/tells.ts --dir ../data/gen/run-money4 --hands 20000 --name money
 *   tsx src/tells.ts --coach 20000 --name coach
 *
 * `reads.ts` answers the reads the coach might price. These are the ones the PAGE teaches: eight
 * cards that each claim a public signal tells you something about a hidden hand. None of them could
 * be settled by counting tiles and none of them needed a play-out either - they need hands where
 * somebody knows the answer, which is what a replay is.
 *
 * ALWAYS ON BOTH POPULATIONS. The recorded runs come from bots with no colour target at all, which
 * win a one-suit hand 1.3% of the time; a table of coaches wins one 32% of the time. A read about
 * suits measured on one of those is a read measured on a game the other is not playing, and this
 * project has already had one finding reverse between them.
 *
 * WHAT A NUMBER HERE IS. Every row is "of the moments with this tag, how often was the thing true",
 * with the comparison row beside it. They are counts over sampled positions, not play-outs, so
 * nothing here says what a read is WORTH - only whether the signal exists. Five danger-side changes
 * have been played for money and none paid, so a read landing here is a read to learn, not a change
 * to the coach.
 */
import { writeFileSync } from 'node:fs';
import {
  GameState, Wall, makeRng, tableConfigOf, kindOf, isHonour, isSuited, isJoker, suitOf, rankOf,
  countsAndJokers, shanten, winningKinds, playGame,
  type TileKind, type Bot, type Decision, type GameResult,
} from 'sg-mahjong-engine';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { botsFor } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { CoachBot } from 'sg-mahjong-solver';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const dir = arg('dir', '../data/gen/run-money4')!;
const name = arg('name', 'money')!;
const maxHands = Number(arg('hands', '20000'));
const coachHands = Number(arg('coach', '0'));
const coachSeed = Number(arg('seed', '11'));
const out = arg('out');

const rules = rulesForDir(dir);
const cfg = tableConfigOf(rules);
const bucket = (t: number) => Math.min(50, Math.floor(t / 10) * 10);
const DRAGONS = [31, 32, 33];                       // the three dragons, after the four winds
const isMiddle = (k: TileKind) => isSuited(k) && rankOf(k) >= 3 && rankOf(k) <= 7;

interface Cell { n: number; hit: number; sum: number }
type Table = Record<string, Cell>;
const tables: Record<string, Table> = {};
const T = (name: string): Table => (tables[name] ??= {});
const bump = (t: Table, key: string, hit: boolean, value = 0) => {
  const c = (t[key] ??= { n: 0, hit: 0, sum: 0 });
  c.n++; if (hit) c.hit++; c.sum += value;
};

/** Every seat's true distance from ready, and the exact tiles each would win on. */
function truthOf(hands: TileKind[][], melds: number[]) {
  return hands.map((kinds, s) => {
    const sh = shanten(kinds, melds[s]!);
    const { counts } = countsAndJokers(kinds);
    const outs = sh === 0 && kinds.length % 3 === 1 ? new Set(winningKinds(counts, 4 - melds[s]!)) : new Set<TileKind>();
    return { sh, outs, kinds };
  });
}

/** Facts about one seat that are gathered during the hand and only mean something once it ends. */
interface SeatState {
  concealedKong: boolean;
  shedValuePair: boolean;
  earlyDiscards: TileKind[];
  lateAllMiddle: boolean | null;
  lateSafeTiles: number;
  lateVisibleTai: number | null;
}

function walk(make: (r: { record: (d: Decision) => void }) => GameState, bots: Bot[], seatWind: (s: number) => number): void {
  const seats: SeatState[] = [0, 1, 2, 3].map(() => ({
    concealedKong: false, shedValuePair: false, earlyDiscards: [], lateAllMiddle: null, lateSafeTiles: 0, lateVisibleTai: null,
  }));
  const thrown = [0, 1, 2, 3].map(() => new Map<TileKind, number>());
  let sampled = 0;

  const recorder = {
    record(d: Decision) {
      const v = d.view, turn = v.playerTurns, tb = bucket(turn);
      const me = d.seat;

      // what everybody has exposed, needed for shanten and for the value read
      const melds = [0, 1, 2, 3].map((s) => v.players[s]!.melds.length);
      for (let s = 0; s < 4; s++) {
        if (v.players[s]!.melds.some((m) => m.concealed && m.tiles.length === 4)) seats[s]!.concealedKong = true;
      }

      const sel = d.selected;
      if (d.kind !== 'discard' || sel.a !== 'discard') return;
      sampled++;
      const hands = d.truth().hands.map((h) => h.map(kindOf));
      const truth = truthOf(hands, melds);

      // --- discard_provenance: was this the tile they just drew, or one that had been sitting there?
      const prov = d.drawn !== null && sel.tile === d.drawn ? 'drawn' : 'hand';
      const rest = [...hands[me]!];
      const at = rest.indexOf(sel.kind);
      if (at >= 0) rest.splice(at, 1);              // the truth is taken before the throw is applied
      bump(T('provenance'), `${prov}|${tb}`, shanten(rest, melds[me]!) <= 0);

      // --- what each seat has thrown, for the value-pair and early-discard reads
      const k = sel.kind;
      const m = thrown[me]!;
      m.set(k, (m.get(k) ?? 0) + 1);
      if ((m.get(k) ?? 0) >= 2 && (DRAGONS.includes(k) || k === 27 + seatWind(me))) seats[me]!.shedValuePair = true;
      if (turn <= 12) seats[me]!.earlyDiscards.push(k);

      // --- the three "is this seat dangerous" reads, asked about the OTHER three seats
      for (let s = 0; s < 4; s++) {
        if (s === me) continue;
        const ready = truth[s]!.sh <= 0;
        bump(T('kong'), `${seats[s]!.concealedKong ? 'kong' : 'none'}|${tb}`, ready);
        bump(T('valuepair'), `${seats[s]!.shedValuePair ? 'shed' : 'none'}|${tb}`, ready);
      }

      // --- last_chance_timing: for every tile this seat could throw, would it deal in, and how
      //     many copies can already be accounted for?
      const accounted = new Uint8Array(34);
      for (const e of v.discardLog) if (e.claimedBy === null) { const kk = kindOf(e.tile); if (kk < 34) accounted[kk]!++; }
      for (let s = 0; s < 4; s++) for (const mm of v.players[s]!.melds) for (const t of mm.tiles) if (t < 34) accounted[t]!++;
      for (const t of v.hand) { const kk = kindOf(t); if (kk < 34) accounted[kk]!++; }
      const seenKinds = new Set<TileKind>();
      for (const t of v.hand) {
        const kk = kindOf(t);
        if (kk >= 34 || seenKinds.has(kk)) continue;
        seenKinds.add(kk);
        const dealsIn = [0, 1, 2, 3].some((s) => s !== me && truth[s]!.outs.has(kk));
        // three copies accounted for means no opponent can hold a second one
        bump(T('lastchance'), `${accounted[kk]! >= 3 ? 'three' : 'fewer'}|${tb}`, dealsIn);
      }

      // --- locate_the_fourth: a threatening seat threw a kind early and no copy has appeared since.
      //     The card says assume they hold another. Sampled once per hand late on, per committed
      //     opponent, for every standard kind, tagged by what the table has shown of that kind.
      if (turn >= 24 && seats[me]!.lateAllMiddle === null) {
        const shown = new Uint8Array(34);
        for (const e of v.discardLog) { const kk = kindOf(e.tile); if (kk < 34) shown[kk]!++; }
        for (let s = 0; s < 4; s++) for (const mm of v.players[s]!.melds) for (const t of mm.tiles) if (t < 34) shown[t]!++;
        for (let s = 0; s < 4; s++) {
          if (s === me || v.players[s]!.melds.length < 2) continue;
          const held = new Set(truth[s]!.kinds.filter((x) => x < 34));
          const early = new Set(seats[s]!.earlyDiscards);
          const mine = new Set(v.discardLog.filter((e) => e.seat === s).map((e) => kindOf(e.tile)));
          for (let kk = 0 as TileKind; kk < 34; kk++) {
            const tag = early.has(kk) && shown[kk] === 1 ? 'threw early, none since'
              : early.has(kk) ? 'threw early, more since'
              : mine.has(kk) ? 'threw late'
              : shown[kk] === 0 ? 'never seen' : 'seen from others only';
            bump(T('locate'), tag, held.has(kk));
          }
        }
      }

      // --- wall_reading, sampled once per hand late on: does a seat hold the neighbours of what
      //     it threw early?
      if (turn >= 24 && seats[me]!.lateAllMiddle === null) {
        for (let s = 0; s < 4; s++) {
          const st = seats[s]!;
          if (st.lateAllMiddle !== null) continue;
          const held = new Set(truth[s]!.kinds.filter((x) => x < 34));
          const early = st.earlyDiscards.filter(isSuited);
          if (early.length) {
            for (let kk = 0 as TileKind; kk < 27; kk++) {
              const dist = Math.min(...early.map((e) => (suitOf(e) === suitOf(kk) ? Math.abs(rankOf(e) - rankOf(kk)) : 99)));
              const tag = dist === 0 ? null : dist === 1 ? 'adj1' : dist === 2 ? 'adj2' : dist < 90 ? 'samesuit' : 'othersuit';
              if (tag) bump(T('wallread'), tag, held.has(kk));
            }
          }
          const std = truth[s]!.kinds.filter((x) => !isJoker(x));
          st.lateAllMiddle = std.length > 0 && std.filter((x) => !isMiddle(x)).length <= 1;
          st.lateSafeTiles = std.filter((x) => !isMiddle(x)).length;
          st.lateVisibleTai = v.players[s]!.melds.filter((mm) =>
            mm.tiles.length >= 3 && (DRAGONS.includes(mm.tiles[0]!) || mm.tiles[0]! === 27 + seatWind(s))).length
            + v.players[s]!.bonus.length;
        }
      }
    },
  };

  const res: GameResult = make(recorder).run(bots);
  if (!sampled) return;

  // --- fear_the_chaser: who committed first, and did chasing pay?
  const order = [0, 1, 2, 3].filter((s) => res.readyTurn[s]! >= 0).sort((a, b) => res.readyTurn[a]! - res.readyTurn[b]!);
  order.forEach((s, i) => {
    const tag = i === 0 ? 'first' : i === 1 ? 'second' : 'later';
    bump(T('chaser'), tag, res.winner === s, res.winner === s ? res.chipsDelta[s]! : 0);
  });

  // --- value_from_melds and middle_tile_hands_undefended, resolved at the end of the hand
  for (let s = 0; s < 4; s++) {
    const st = seats[s]!;
    if (st.lateVisibleTai !== null) bump(T('valuemelds'), `${Math.min(3, st.lateVisibleTai)}`, res.winner === s, res.winner === s ? res.chipsDelta[s]! : 0);
    if (st.lateAllMiddle !== null) bump(T('middles'), `${Math.min(4, st.lateSafeTiles)} not middles`, res.discarder === s);
  }
}

type Made = (r: { record: (d: Decision) => void }) => GameState;
function* sources(): Generator<{ make: Made; bots: Bot[]; seatWind: (s: number) => number }> {
  if (coachHands > 0) {
    for (let i = 0; i < coachHands; i++) {
      const dealer = i % 4, wind = Math.floor(i / 4) % 4, seed = coachSeed * 1000003 + i;
      yield {
        make: (recorder) => GameState.deal(cfg, new Wall(makeRng(seed), cfg.unplayable_tiles, rules.jokers.count), { dealer, prevailingWind: wind, rules, recorder }),
        bots: [0, 1, 2, 3].map(() => new CoachBot()),
        seatWind: (s) => (s - dealer + 4) % 4,
      };
    }
    return;
  }
  for (const hr of loadHands(dir).slice(0, maxHands)) {
    yield {
      make: (recorder) => GameState.deal(cfg, new Wall(makeRng(hr.seed), rules.unplayable_tiles, rules.jokers.count), { dealer: hr.dl, prevailingWind: hr.w, rules, recorder }),
      bots: botsFor(hr, DEFAULT_RANDOMNESS),
      seatWind: (s) => (s - hr.dl + 4) % 4,
    };
  }
}

let hands = 0;
for (const { make, bots, seatWind } of sources()) { walk(make, bots, seatWind); if (++hands % 2000 === 0) process.stdout.write(`\r${hands} hands`); }
process.stdout.write(`\r${hands} hands walked\n`);

const show = (title: string, t: Table, note: string, mean = false) => {
  console.log(`\n${title}`);
  console.log(`  ${note}`);
  for (const [k, c] of Object.entries(t).sort()) {
    const p = c.hit / c.n, se = Math.sqrt(p * (1 - p) / c.n);
    const paid = c.hit ? c.sum / c.hit : 0;
    console.log(`    ${k.padEnd(18)} ${(100 * p).toFixed(2).padStart(6)}% +/- ${(100 * se).toFixed(2)}   n=${c.n}${mean ? `   worth ${paid.toFixed(2)} chips when it happens` : ''}`);
  }
};

console.log(`\n=== ${name} ===`);
show('discard_provenance: is a seat ready, by where its last throw came from?', T('provenance'), 'tag|turn -> that seat is one tile away or better');
show('concealed_kong_signal: is a seat with a concealed kong nearer to ready?', T('kong'), 'tag|turn -> that seat is one tile away or better');
show('discarded_value_pair: is a seat that shed a dragon or seat-wind pair nearer to ready?', T('valuepair'), 'tag|turn -> that seat is one tile away or better');
show('last_chance_timing: does the last copy deal in more often late?', T('lastchance'), 'copies accounted|turn -> throwing it would have dealt in');
show('wall_reading: does a seat hold the neighbours of what it threw early?', T('wallread'), 'distance from an early discard -> that seat holds the tile late in the hand');
show('locate_the_fourth: does a committed seat hold a kind it threw early with nothing seen since?', T('locate'), 'what the table shows of the kind -> that seat holds a copy late in the hand');
show('fear_the_chaser: does the player who commits later win more?', T('chaser'), 'order of becoming ready -> that seat won the hand', true);
show('value_from_melds: what the exposed melds are worth against what the hand pays', T('valuemelds'), 'visible tai -> that seat won the hand', true);
show('middle_tile_hands_undefended: does a hand of middles deal in more?', T('middles'), 'hand at turn 24 -> that seat dealt in');

if (out) { writeFileSync(out, JSON.stringify({ name, hands, tables }, null, 1)); console.log(`\nwritten to ${out}`); }
