/**
 * Build positions to order for the tips real play never produces, and grade them like the packs.
 *
 *   tsx src/buildrare.ts --dir ../data/gen/run-coach2 --tip pon_over_chii --want 200 --name coach
 *   tsx src/buildrare.ts --dir ../data/gen/run-money4 --tip linked_blocks --want 200 --name money
 *
 * Two cards on the page could not be scored because the shape is rare: both packs together offer a
 * pong and a chow on the same tile 9 times, and `linked_blocks` fires only where the count comes out
 * level, 16 times. No sample of real play fixes that. So instead of waiting for the position, this
 * MAKES it, in a real table context, and then grades it with exactly the machinery the packs use.
 *
 * HOW A POSITION IS MADE. Replay a recorded hand to a decision, then swap tiles between one seat's
 * concealed hand and the hidden part of the wall until that seat holds what the tip needs. Nothing
 * public changes - discards, melds, bonus, the other hands' SIZES - and no tile instance is
 * duplicated, because a swap is a swap. The grader then determinizes everything except the acting
 * seat anyway, so the only thing that has to be right is that one hand, and it is.
 *
 * WHAT THIS MEASURES. The same question `calltest.ts` and `discardtest.ts` ask - of the positions
 * the tip is about, how often is the 128-play-out best an action it points at, against the coin
 * its own split implies - and with the same grader settings as the packs (sampled, shanten policy,
 * 128 rollouts, seed 41, adaptive, coupled), so the number can sit in the same table. What differs
 * is that the positions are not a sample of anything: they are real contexts with a hand put into
 * them. A verdict here is about the shape, at this table, in ordinary surroundings.
 */
import {
  GameState, Wall, makeRng, tableConfigOf, kindOf, isSuited, isJoker, rankOf,
  type TileInstance, type TileKind, type Snapshot, type Bot,
} from 'sg-mahjong-engine';
import { readFileSync } from 'node:fs';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { botsFor } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import { evaluateDecision, type EvalArgs } from './evaluate.js';
import { liveCalls } from 'sg-mahjong-solver';
import type { DecisionRecord } from './records.js';
import type { Meld } from 'sg-mahjong-engine';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const dir = arg('dir', '../data/gen/run-coach2')!;
const tip = arg('tip', 'pon_over_chii')!;
const want = Number(arg('want', '200'));
const name = arg('name', 'coach')!;
const maxHands = Number(arg('hands', '6000'));
/** built positions taken from one recorded hand - low, so the sample is spread over many walls */
const perHand = Number(arg('perhand', '2'));
const verbose = process.argv.includes('--verbose');

const rules = rulesForDir(dir);
const cfg = tableConfigOf(rules);
/** the packs' grader settings, so the verdict can be read beside theirs */
const EVAL: EvalArgs = {
  dir, hands: 0, perHand: 0, rollouts: 128, mode: 'sampled', policy: 'shanten', seed: 41,
  workers: 1, workerIndex: 0, rulesOverride: {}, randomness: DEFAULT_RANDOMNESS, adaptive: true, coupled: true,
};

/**
 * Give `seat` the kinds in `wantKinds`, same hand size, by swapping with the wall's live region.
 * Tiles in `keep` are never swapped out (the drawn tile, for one). Returns null if the wall cannot
 * supply a kind - every copy is already visible or in somebody's hand - which is the honest way
 * to skip rather than invent a fifth copy.
 */
function reshape(snap: Snapshot, seat: number, wantKinds: TileKind[], keep: Set<TileInstance>): Snapshot | null {
  const p = snap.players[seat]!;
  const have = [...p.hand];
  const wantLeft = [...wantKinds];
  // what the hand already holds that the wish list also wants stays put
  const staying = new Set<TileInstance>();
  for (const t of have) {
    const i = wantLeft.indexOf(kindOf(t));
    if (i >= 0) { wantLeft.splice(i, 1); staying.add(t); }
  }
  const removable = have.filter((t) => !staying.has(t) && !keep.has(t));
  if (removable.length < wantLeft.length) return null;
  const order = [...snap.wall.order];
  const hand = [...have];
  for (const k of wantLeft) {
    let wi = -1;
    for (let i = snap.wall.front; i <= snap.wall.back; i++) if (kindOf(order[i]!) === k) { wi = i; break; }
    if (wi < 0) return null;
    const out = removable.pop()!;
    const hi = hand.indexOf(out);
    // `order` is the full permutation of every tile in the game, dealt hands included, so the two
    // instances trade PLACES in it - overwriting one slot would leave a duplicate and a missing tile,
    // and the grader's determinize step counts those and refuses.
    const oi = order.indexOf(out);
    hand[hi] = order[wi]!;
    order[oi] = order[wi]!;
    order[wi] = out;
  }
  const players = snap.players.map((q) => (q.seat === seat ? { ...q, hand } : q));
  return { ...snap, players, wall: { ...snap.wall, order } };
}

/** Step a recorded hand decision by decision, yielding the live state before each one. */
function* decisions(hr: ReturnType<typeof loadHands>[number]): Generator<{ g: GameState; bots: Bot[]; d: number }> {
  const g = GameState.deal(cfg, new Wall(makeRng(hr.seed), rules.unplayable_tiles, rules.jokers.count), { dealer: hr.dl, prevailingWind: hr.w, rules });
  const bots = botsFor(hr, DEFAULT_RANDOMNESS);
  let d = 0;
  g.advance();
  while (!g.finished) {
    const p = g.pending();
    if (!p) { g.advance(); continue; }
    yield { g, bots, d };
    if (g.finished) return;
    g.step(bots); d++;
  }
}

const recOf = (hr: { g: number; h: number; seed: number; dl: number; w: number }, g: GameState, d: number, k: DecisionRecord['k'], sel: string): DecisionRecord => ({
  g: hr.g, h: hr.h, d: 100000 + d, seed: hr.seed, k, t: g.playerTurns, p: g.pending()!.seat, dl: hr.dl, w: hr.w,
  sc: [0, 0, 0, 0], ch: [0, 0, 0, 0], rem: 0, me: { h: [], dr: null, b: [], m: [] }, pub: { dl: [], m: [], b: [] },
  legal: [], sel, bot: 'coach', f: null,
});

interface Score { seen: number; resolved: number; follows: number; expected: number; variance: number }
const score: Score = { seen: 0, resolved: 0, follows: 0, expected: 0, variance: 0 };
const tally = (says: string[], against: string[], best: string) => {
  score.seen++;
  const hit = says.includes(best), miss = against.includes(best);
  if (!hit && !miss) return;
  const p = says.length / (says.length + against.length);
  score.resolved++; score.follows += hit ? 1 : 0; score.expected += p; score.variance += p * (1 - p);
};

/**
 * pon_over_chii: at a discard by seat D, choose a suited tile X that D holds, give the seat after D
 * two copies of X and its two neighbours, throw X, and grade the claim that follows. The seat after
 * D is the only one that can chow, so it is the only seat the card is about.
 */
function* ponOverChii(hr: ReturnType<typeof loadHands>[number]): Generator<{ g: GameState; d: number; says: string[]; against: string[] }> {
  for (const { g, d } of decisions(hr)) {
    const p = g.pending()!;
    if (p.kind !== 'discard') continue;
    const D = p.seat, S = (D + 1) % 4;
    const snap = g.snapshot();
    const dHand = snap.players[D]!.hand;
    // candidate X: suited, rank 2..8, and the wall can still supply two more plus both neighbours
    for (const x of dHand) {
      const k = kindOf(x);
      if (!isSuited(k) || rankOf(k) < 2 || rankOf(k) > 8) continue;
      const S0 = snap.players[S]!;
      if (S0.melds.length > 2) continue;                       // leave the seat some hand to reshape
      const wantKinds = [...S0.hand.map(kindOf)];
      // replace four tiles that are not X or its neighbours with X, X, X-1, X+1
      const avoid = new Set<TileKind>([k, (k - 1) as TileKind, (k + 1) as TileKind]);
      const removableKinds = wantKinds.filter((w) => !avoid.has(w) && !isJoker(w));
      if (removableKinds.length < 4) continue;
      for (const r of removableKinds.slice(0, 4)) wantKinds.splice(wantKinds.indexOf(r), 1);
      wantKinds.push(k, k, (k - 1) as TileKind, (k + 1) as TileKind);
      const edited = reshape(snap, S, wantKinds, new Set());
      if (!edited) continue;
      const h = GameState.fromSnapshot(edited, cfg, { rules });
      h.apply({ a: 'discard', tile: x, kind: k });
      let guard = 0;
      while (!h.pending() && !h.finished && guard++ < 5) h.advance();
      const q = h.pending();
      if (!q || q.kind !== 'claim' || q.seat !== S) continue;
      const legal = q.legal.map((l) => (l.a === 'chow' ? `chow:${l.kinds.join(',')}` : l.a === 'pong' ? `pong:${l.kind}` : l.a));
      const says = legal.filter((a) => a.startsWith('pong:')), against = legal.filter((a) => a.startsWith('chow:'));
      if (!says.length || !against.length) continue;
      yield { g: h, d, says, against };
      break;                                                   // one built position per real decision
    }
  }
}

/**
 * linked_blocks: at a seat's own discard with no melds, replace its fourteen tiles with a hand that
 * holds a block against a finished run AND a lone block of the same width, shifted around the suits
 * for variety, and grade the throw. `liveCalls` decides whether the built hand really fires the
 * card, so the detector is the judge of its own positions.
 */
/**
 * Templates for `linked_blocks` come from the packs themselves: every graded discard position on
 * which the detector already fires, rotated through the three suits. Hand-written templates did not
 * fire it at all - the shape it wants is a scattered one-away hand where a block against a finished
 * run and a lone block happen to count level, and that is easier to find than to invent. A suit
 * rotation keeps every count identical, so each real hand yields three templates.
 */
function harvestTemplates(): TileKind[][] {
  const out: TileKind[][] = [];
  // `suitOf` names the suit; the arithmetic wants its index
  const rotate = (h: TileKind[], by: number) => h.map((k) => (k < 27 ? (((Math.floor(k / 9) + by) % 3) * 9 + (k % 9)) as TileKind : k));
  for (const pack of ['coach', 'money']) {
    let j: { questions: { k: string; h: number[]; m: number[][]; b: number[]; seat: number; dl: number; w: number; actions: { a: string }[] }[] };
    try { j = JSON.parse(readFileSync(`../web/public/quiz/${pack}.json`, 'utf8')); } catch { continue; }
    for (const q of j.questions) {
      if (q.k !== 'discard' || q.m.length || q.h.length !== 14 || q.h.some(isJoker)) continue;
      const throws = q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2)) as TileKind);
      const calls = liveCalls(q.h, 0, throws, { bonus: q.b, seat: (q.seat - q.dl + 4) % 4, prevailingWind: q.w, melds: [], minimumFan: 2, selfDrawMinimumFan: 1 });
      if (!calls.some((c) => c.tip === 'linked_blocks')) continue;
      for (let by = 0; by < 3; by++) out.push(rotate(q.h as TileKind[], by));
    }
  }
  return out;
}
function* linkedBlocks(hr: ReturnType<typeof loadHands>[number]): Generator<{ g: GameState; d: number; says: string[]; against: string[] }> {
  const templates = TEMPLATES;
  if (!templates.length) return;
  let ti = 0;
  for (const { g, d } of decisions(hr)) {
    const p = g.pending()!;
    if (p.kind !== 'discard') continue;
    const S = p.seat;
    const snap = g.snapshot();
    const me = snap.players[S]!;
    if (me.melds.length !== 0 || me.hand.length !== 14) continue;
    gates.eligible++;
    const drawn = snap.drawnInfo?.tile;
    const tmpl = templates[ti++ % templates.length]!;
    const edited = reshape(snap, S, tmpl, new Set());
    if (!edited) { gates.wallShort++; continue; }
    // the drawn tile must still be a tile in the hand, or the discard phase is inconsistent
    if (drawn && !edited.players[S]!.hand.includes(drawn)) edited.drawnInfo = { ...edited.drawnInfo!, tile: edited.players[S]!.hand[0]! };
    const h = GameState.fromSnapshot(edited, cfg, { rules });
    const q = h.pending();
    if (!q || q.kind !== 'discard' || q.seat !== S) continue;
    const hand = h.players[S]!.hand.map(kindOf);
    const throws = q.legal.filter((l) => l.a === 'discard').map((l) => l.kind);
    const melds: Meld[] = [];
    const calls = liveCalls(hand, 0, throws, { bonus: h.players[S]!.bonus.map(kindOf), seat: (S - hr.dl + 4) % 4, prevailingWind: hr.w, melds, minimumFan: 2, selfDrawMinimumFan: 1 });
    const c = calls.find((x) => x.tip === 'linked_blocks');
    if (!c) { gates.noFire++; if (verbose && gates.noFire <= 3) console.log(`  detector silent on ${hand.join(',')} -> fired [${calls.map((x) => x.tip).join(' ')}]`); continue; }
    yield { g: h, d, says: c.says.map((k) => `d:${k}`), against: c.against.map((k) => `d:${k}`) };
  }
}


/**
 * rebuild_waits: a seat that is ready on a wait that is already dead - four finished sets and a
 * single tile of which every other copy is on the table - is offered a tile that extends one of
 * its runs. Claiming it and throwing the dead tile leaves a live single wait; passing keeps a hand
 * that can never win. The card says learn to see the call. Built to order because a ready hand on
 * a dead wait at the moment a rebuilding tile is thrown is about as rare as positions get.
 *
 * Only a kind with exactly three copies already visible can be the dead tile, because what is
 * visible cannot be changed by a swap; the fourth has to be in the wall for `reshape` to fetch it.
 */
function* rebuildWaits(hr: ReturnType<typeof loadHands>[number]): Generator<{ g: GameState; d: number; says: string[]; against: string[] }> {
  for (const { g, d } of decisions(hr)) {
    const p = g.pending()!;
    if (p.kind !== 'discard') continue;
    const D = p.seat, S = (D + 1) % 4;
    const snap = g.snapshot();
    const S0 = snap.players[S]!;
    if (S0.melds.length !== 0 || S0.hand.length !== 13) continue;
    // what the table already shows of each kind
    const shown = new Uint8Array(34);
    for (const e of snap.discardLog) if (e.claimedBy === null) { const kk = kindOf(e.tile); if (kk < 34) shown[kk]!++; }
    for (const q of snap.players) for (const m of q.melds) for (const t of m.tiles) if (t < 34) shown[t]!++;
    const dead = ([] as TileKind[]).concat(...Array.from({ length: 34 }, (_, k) => (shown[k] === 3 ? [k as TileKind] : [])));
    if (!dead.length) continue;
    for (const x of snap.players[D]!.hand) {
      const X = kindOf(x);
      if (!isSuited(X) || rankOf(X) < 4) continue;                       // the run it extends is X-3, X-2, X-1
      const sx = Math.floor(X / 9), a = X - 3;
      const others = [0, 1, 2].filter((u) => u !== sx);
      // four sets: the run X extends, plus three runs in the other two suits; the dead single tile K
      for (const K of dead) {
        const want: TileKind[] = [a, a + 1, a + 2, others[0]! * 9 + 1, others[0]! * 9 + 2, others[0]! * 9 + 3, others[0]! * 9 + 5, others[0]! * 9 + 6, others[0]! * 9 + 7, others[1]! * 9 + 1, others[1]! * 9 + 2, others[1]! * 9 + 3, K] as TileKind[];
        const edited = reshape(snap, S, want, new Set());
        if (!edited) continue;
        const h = GameState.fromSnapshot(edited, cfg, { rules });
        h.apply({ a: 'discard', tile: x, kind: X });
        let guard = 0;
        while (!h.pending() && !h.finished && guard++ < 5) h.advance();
        const q = h.pending();
        if (!q || q.kind !== 'claim' || q.seat !== S) continue;
        const legal = q.legal.map((l) => (l.a === 'chow' ? `chow:${l.kinds.join(',')}` : l.a === 'pong' ? `pong:${l.kind}` : l.a));
        const says = legal.filter((l) => l.startsWith('chow:')), against = legal.filter((l) => l === 'pass');
        if (!says.length || !against.length) continue;
        yield { g: h, d, says, against };
        break;
      }
      break;
    }
  }
}

const gates = { eligible: 0, wallShort: 0, noFire: 0 };
const TEMPLATES = tip === 'linked_blocks' ? harvestTemplates() : [];
if (tip === 'linked_blocks') console.log(`${TEMPLATES.length} templates harvested from the packs (real firing hands x three suit rotations)`);
const build = tip === 'pon_over_chii' ? ponOverChii : tip === 'linked_blocks' ? linkedBlocks : tip === 'rebuild_waits' ? rebuildWaits : null;
if (!build) { console.error(`no builder for ${tip}`); process.exit(1); }

const t0 = Date.now();
let built = 0, hands = 0;
outer: for (const hr of loadHands(dir).slice(0, maxHands)) {
  hands++;
  let fromThisHand = 0;
  for (const pos of build(hr)) {
    if (fromThisHand++ >= perHand) break;              // positions built from one hand share its wall and table, so they are not independent samples
    const kind = tip === 'linked_blocks' ? 'discard' : 'claim';
    const rec = recOf(hr, pos.g, pos.d, kind, 'pass');
    const ev = evaluateDecision(pos.g, rec, EVAL, rules);
    tally(pos.says, pos.against, ev.best);
    built++;
    if (verbose) console.log(`  ${hr.g}:${hr.h}:${pos.d} best=${ev.best} says=[${pos.says}] against=[${pos.against}] ${pos.says.includes(ev.best) ? 'FOLLOWS' : pos.against.includes(ev.best) ? 'breaks' : 'neither'}`);
    if (built % 10 === 0) process.stdout.write(`\r${built} built from ${hands} hands, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (built >= want) break outer;
  }
}
const rate = score.resolved ? score.follows / score.resolved : 0, luck = score.resolved ? score.expected / score.resolved : 0;
const z = score.variance > 0 ? (score.follows - score.expected) / Math.sqrt(score.variance) : 0;
console.log(`\n\n${name}: ${tip} on ${built} built positions from ${hands} hands (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
if (tip === 'linked_blocks') console.log(`  gates: ${gates.eligible} eligible discards, ${gates.wallShort} where the wall could not supply the hand, ${gates.noFire} where the detector stayed silent`);
console.log(`  about ${score.seen}  resolved ${score.resolved}  follows ${(100 * rate).toFixed(0)}%  by luck ${(100 * luck).toFixed(0)}%  z ${z >= 0 ? '+' : ''}${z.toFixed(1)}  (${score.follows}/${score.resolved})`);
