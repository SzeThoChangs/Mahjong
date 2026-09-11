/**
 * A position rebuilt from a pack question must account for every tile exactly once, size the wall
 * from what is unseen, and offer the actions the pack listed. Three real questions from the
 * `min1` pack (4 wildcards, 1 tai minimum), one of each decision kind. The behavioural check -
 * that the rebuilt position judges the same as the recorded one - is `datagen/src/rejudgecheck.ts`,
 * which needs the run and is not a unit test.
 */
import { describe, it, expect } from 'vitest';
import { GameState, makeRules, makeRng, tableConfigOf, kindOf, TOTAL_TILES, type Snapshot } from 'sg-mahjong-engine';
import { snapshotFromQuestion, pendingOf, encAction, determinize, rejudge, type PackQuestion } from '../src/index.js';

const MONEY = { ladder: { 1: 2, 2: 3, 3: 5, 4: 10, 5: 20 }, zm_bonus_per_player: 2, shoot_total: { 2: 7, 3: 11, 4: 20, 5: 40 }, kong_fed_total: 6, bite_flower_hidden: 4, bite_flower_open: 2, bite_animal_hidden: 4, bite_animal_open: 2, kong_concealed_each: 2, kong_exposed_each: 2 };
const RULES = makeRules({ minimum_tai: 1, discard_win_payment: 'discarder_pays_all', bao: { enabled: true, fresh_tile_threshold: 8 }, jokers: { count: 4, stranded_bao_each: 42 }, money: MONEY });

type Q = PackQuestion & { id: string; legal: string[] };
const DISCARD: Q = { id: '1494:5:22', k: 'discard', seat: 0, dl: 2, w: 0, t: 19, h: [5, 1, 21, 20, 3, 2, 46, 21, 13, 5, 21], dr: null, b: [], m: [[0, 0, 23, 24, 25]], disc: [[2, 33, -1], [3, 28, -1], [0, 30, -1], [1, 11, -1], [2, 29, -1], [3, 30, -1], [0, 29, -1], [1, 26, -1], [2, 9, -1], [3, 9, -1], [0, 28, -1], [1, 32, -1], [2, 17, 3], [3, 0, -1], [0, 12, -1], [1, 30, -1], [2, 18, -1], [3, 23, 0]], pm: [[[0, 0, 23, 24, 25]], [], [], [[0, 0, 15, 16, 17]]], pb: [[], [45, 36, 44], [38, 42], []], legal: ['d:5', 'd:21', 'd:13', 'd:20', 'd:2', 'd:1', 'd:3'] };
const CLAIM: Q = { id: '2457:4:16', k: 'claim', seat: 3, dl: 0, w: 1, t: 15, h: [23, 11, 22, 46, 28, 16, 28, 2, 20, 18, 12, 8, 29], dr: null, b: [], m: [], ld: [2, 28], disc: [[0, 30, -1], [1, 30, -1], [2, 33, -1], [3, 30, -1], [0, 29, -1], [1, 31, -1], [2, 31, -1], [3, 27, -1], [0, 27, -1], [1, 33, -1], [2, 17, -1], [3, 26, -1], [0, 19, -1], [1, 13, 2], [2, 28, -1]], pm: [[], [], [[0, 0, 11, 12, 13]], []], pb: [[41], [43, 38, 37], [44, 39], []], legal: ['pong:28', 'pass'] };
const SELF: Q = { id: '1620:10:43', k: 'self', seat: 3, dl: 1, w: 2, t: 34, h: [22, 10, 0, 24, 25, 24, 22, 2, 22, 22, 17, 26, 2, 29], dr: 29, b: [], m: [], disc: [[1, 31, -1], [2, 31, -1], [3, 1, -1], [0, 33, -1], [1, 26, -1], [2, 8, -1], [3, 31, -1], [0, 8, -1], [1, 23, -1], [2, 27, -1], [3, 27, -1], [0, 9, 2], [2, 10, -1], [3, 15, 0], [0, 11, -1], [1, 9, -1], [2, 15, -1], [3, 28, -1], [0, 14, -1], [1, 8, -1], [2, 7, -1], [3, 7, -1], [0, 18, 1], [1, 20, -1], [2, 12, -1], [3, 12, -1], [0, 17, -1], [1, 11, -1], [2, 30, -1], [3, 14, 0], [0, 17, -1], [1, 11, -1], [2, 30, -1]], pm: [[[0, 0, 14, 15, 16], [0, 0, 14, 15, 16]], [[0, 0, 18, 19, 20]], [[1, 0, 9, 9, 9]], []], pb: [[45, 42, 38, 39], [37], [36, 40], []], legal: ['kong4:22', 'proceed'] };

/** every instance a snapshot places, with where it was found, so a double placement names itself */
function placements(s: Snapshot): Map<number, string> {
  const where = new Map<number, string>();
  const put = (t: number, at: string) => { if (where.has(t)) throw new Error(`tile ${t} is both ${where.get(t)} and ${at}`); where.set(t, at); };
  for (const p of s.players) {
    p.hand.forEach((t) => put(t, `hand${p.seat}`)); p.bonus.forEach((t) => put(t, `bonus${p.seat}`)); p.discards.forEach((t) => put(t, `floor${p.seat}`));
    p.melds.forEach((m) => m.instances.forEach((t) => put(t, `meld${p.seat}`)));
  }
  for (let i = s.wall.front; i <= s.wall.back; i++) put(s.wall.order[i]!, 'wall');
  return where;
}
const kinds = (ts: number[]) => ts.map(kindOf).sort((a, b) => a - b);

describe('snapshotFromQuestion', () => {
  for (const q of [DISCARD, CLAIM, SELF]) {
    describe(`${q.k} ${q.id}`, () => {
      const snap = snapshotFromQuestion(q, RULES);
      it('places every tile in the game exactly once', () => {
        const where = placements(snap);
        expect(where.size).toBe(TOTAL_TILES + 4);
        expect(new Set(snap.wall.order).size).toBe(TOTAL_TILES + 4);
      });
      it('shows the visible tiles where the question put them', () => {
        expect(kinds(snap.players[q.seat]!.hand)).toEqual([...q.h].sort((a, b) => a - b));
        for (let s = 0; s < 4; s++) {
          expect(snap.players[s]!.melds.map((m) => [m.type, m.concealed, ...m.tiles])).toEqual((s === q.seat ? q.m : q.pm[s]!).map((r) => [r[0] === 0 ? 'chow' : r[0] === 1 ? 'pong' : 'kong', r[1] === 1, ...r.slice(2)]));
          expect(kinds(snap.players[s]!.bonus)).toEqual([...(s === q.seat ? q.b : q.pb[s]!)].sort((a, b) => a - b));
          expect(kinds(snap.players[s]!.discards)).toEqual(q.disc.filter((d) => d[0] === s && d[2]! < 0).map((d) => d[1]!).sort((a, b) => a - b));
        }
        expect(snap.discardLog.map((e) => [e.seat, kindOf(e.tile), e.claimedBy ?? -1])).toEqual(q.disc);
      });
      it('sizes the opponents\' hands from their melds and the wall from what is unseen', () => {
        let held = 0;
        for (let s = 0; s < 4; s++) {
          const p = snap.players[s]!;
          if (s !== q.seat) expect(p.hand.length).toBe(13 - 3 * p.melds.length);
          held += p.hand.length + p.bonus.length + p.discards.length + p.melds.reduce((a, m) => a + m.instances.length, 0);
        }
        expect(snap.wall.back - snap.wall.front + 1).toBe(TOTAL_TILES + 4 - held);
        expect(snap.wall.unplayable).toBe(RULES.unplayable_tiles);
      });
      it('offers exactly the actions the pack listed', () => {
        const p = pendingOf(snap, RULES);
        expect(p.kind).toBe(q.k); expect(p.seat).toBe(q.seat);
        expect([...new Set(p.legal.map(encAction))].sort()).toEqual([...q.legal].sort());
      });
      it('re-deals and plays out without complaint', () => {
        const g = GameState.fromSnapshot(snap, tableConfigOf(RULES), { rules: RULES });
        const h = determinize(g, q.seat, makeRng(3));
        expect(placements(h).size).toBe(TOTAL_TILES + 4);
        const judged = rejudge(snap, RULES, q.seat, pendingOf(snap, RULES).legal, { rollouts: 4, seed: 1, key: q.id });
        expect(judged.map((x) => x.a).sort()).toEqual([...q.legal].sort());
        expect(judged.every((x) => x.n === 4 && Number.isFinite(x.ev))).toBe(true);
      });
    });
  }
  it('remembers the no-throw-back rule from the discard log', () => {
    // seat 3 threw 30 and has since seen 29, 29, 26, 9, 9, 28, 32, 17, 0(own), ... - after its own
    // last throw (23) it has seen nothing yet, because that throw is the last entry
    const snap = snapshotFromQuestion(DISCARD, RULES);
    expect(snap.players[3]!.lastDiscardKind).toBe(23);
    expect(snap.players[3]!.seenSinceLastDiscard).toEqual([]);
    expect(snap.players[0]!.lastDiscardKind).toBe(12);
    expect([...snap.players[0]!.seenSinceLastDiscard].sort((a, b) => a - b)).toEqual([18, 23, 30]);
  });
  it('refuses a question whose hand size does not fit its melds', () => {
    expect(() => snapshotFromQuestion({ ...DISCARD, h: DISCARD.h.slice(1) }, RULES)).toThrow(/tiles in hand/);
  });
});
