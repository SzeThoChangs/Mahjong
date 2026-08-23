import { describe, it, expect } from 'vitest';
import { scoreHand, fanInHand, type WinContext, type Meld } from '../src/score.js';
import { parseKinds, KIND } from '../src/tiles.js';

const base = (over: Partial<WinContext>): WinContext => ({
  concealed: [], melds: [], bonus: [], seat: 0, prevailingWind: 0, winningTile: 0, selfDraw: true, ...over,
});
const K = parseKinds;
const pong = (k: string): Meld => ({ type: 'pong', tiles: [K(k)[0]!, K(k)[0]!, K(k)[0]!], concealed: false });
const chow = (a: string): Meld => { const k = K(a)[0]!; return { type: 'chow', tiles: [k, k + 1, k + 2], concealed: false }; };

describe('scoreHand', () => {
  it('chicken = 0 fan', () => {
    const r = scoreHand(base({ concealed: K('1w 2w 3w 4t 5t 6t 7s 7s 7s 2s 3s 4s R R'), winningTile: 31, seat: 1, prevailingWind: 2 }));
    expect(r.valid).toBe(true); expect(r.combination).toBe('chicken'); expect(r.fan).toBe(0);
  });
  it('ping wu = 4 when all chow and no bonus; all_chow = 1 with bonus', () => {
    const hand = K('1w 2w 3w 4t 5t 6t 7s 8s 9s 2s 3s 4s 5w 5w');
    const pw = scoreHand(base({ concealed: hand, winningTile: 4, seat: 1, prevailingWind: 2 }));
    expect(pw.combination).toBe('ping_wu'); expect(pw.fan).toBe(4);
    const ac = scoreHand(base({ concealed: hand, winningTile: 4, seat: 1, prevailingWind: 2, bonus: [KIND.FLOWER + 1] }));
    expect(ac.combination).toBe('all_chow'); expect(ac.fan).toBe(1 + 1); // all_chow + own flower (seat 1, F2)
  });
  it('all-chow eye restriction', () => {
    const r = scoreHand(base({ concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s 2s 3s 4s R R'), winningTile: 31 }));
    expect(r.valid).toBe(false);
  });
  it('all-chow discard win needs 2+ unique outs', () => {
    // 1w2w is an edge wait on 3w only -> invalid on a discard
    const r = scoreHand(base({ concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s 2s 3s 4s 5w 5w'), winningTile: 2, selfDraw: false, seat: 1, prevailingWind: 2 }));
    expect(r.valid).toBe(false);
    // ...but fine on self-draw
    expect(scoreHand(base({ concealed: K('1w 2w 3w 4t 5t 6t 7s 8s 9s 2s 3s 4s 5w 5w'), winningTile: 2, selfDraw: true, seat: 1, prevailingWind: 2 })).valid).toBe(true);
    // 2w3w is two-sided (1w or 4w) -> valid on a discard
    const ok = scoreHand(base({ concealed: K('2w 3w 4w 4t 5t 6t 7s 8s 9s 2s 3s 4s 6w 6w'), winningTile: 3, selfDraw: false, seat: 1, prevailingWind: 2 }));
    expect(ok.valid).toBe(true); expect(ok.combination).toBe('ping_wu');
  });
  it('all pong = 2, concealed all pong = 7', () => {
    const exposed = scoreHand(base({ concealed: K('2w 2w 2w 5t 5t'), melds: [pong('9s'), pong('3t'), pong('7w')], winningTile: 1, seat: 1, prevailingWind: 2 }));
    expect(exposed.combination).toBe('all_pong'); expect(exposed.fan).toBe(2);
    const conc = scoreHand(base({ concealed: K('2w 2w 2w 5t 5t 9s 9s 9s 3t 3t 3t 7w 7w 7w'), winningTile: 1, seat: 1, prevailingWind: 2 }));
    expect(conc.combination).toBe('concealed_all_pong'); expect(conc.fan).toBe(7);
  });
  it('half color 2, full color 4, stacks with all_pong', () => {
    const half = scoreHand(base({ concealed: K('1w 2w 3w 4w 5w 6w 7w 8w 9w 2w 3w 4w N N'), winningTile: 0, seat: 1, prevailingWind: 2 }));
    expect(half.items.map(i => i.id).sort()).toEqual(['half_color', 'ping_wu']); expect(half.fan).toBe(6);
    const full = scoreHand(base({ concealed: K('1w 2w 3w 4w 5w 6w 7w 8w 9w 2w 3w 4w 5w 5w'), winningTile: 0, seat: 1, prevailingWind: 2 }));
    expect(full.items.map(i => i.id)).toContain('full_color'); expect(full.fan).toBe(4 + 4); // full_color + ping_wu (all chow, no bonus)
    const hcp = scoreHand(base({ concealed: K('2w 2w 2w N N'), melds: [pong('9w'), pong('3w'), pong('7w')], winningTile: 1, seat: 1, prevailingWind: 2 }));
    expect(hcp.fan).toBe(4); // all_pong 2 + half_color 2
  });
  it('honour pongs and eyes', () => {
    const r = scoreHand(base({ concealed: K('1w 2w 3w R R'), melds: [pong('G'), pong('Wh'), chow('4t')], winningTile: 0, seat: 1, prevailingWind: 2 }));
    expect(r.fan).toBe(1 + 1 + 1); // two dragon pongs + two_dragons_eye
    const ws = scoreHand(base({ concealed: K('E E E S S'), melds: [pong('W'), pong('N'), pong('9t')], winningTile: 27, seat: 0, prevailingWind: 0 }));
    expect(ws.items.map(i => i.id)).toContain('three_winds_eye');
    expect(ws.fan).toBe(4 + 2 + 9); // three_winds_eye + all_pong ... and all_terminal since every set is terminal/honour
  });
  it('bonus tiles and events', () => {
    const r = scoreHand(base({
      concealed: K('1w 2w 3w 4t 5t 6t 7s 7s 7s 2s 3s 4s R R'), winningTile: 31, seat: 2, prevailingWind: 1,
      bonus: [KIND.ANIMAL, KIND.ANIMAL + 1, KIND.FLOWER + 2, KIND.SEASON + 2, KIND.SEASON + 0], replacementWin: true,
    }));
    // 2 animals + F3 (seat 2) + S3 (seat 2) + replacement
    expect(r.fan).toBe(2 + 1 + 1 + 1);
  });
  it('13 wonders = 8', () => {
    const r = scoreHand(base({ concealed: K('1w 9w 1t 9t 1s 9s E S W N R G Wh E'), winningTile: 27 }));
    expect(r.combination).toBe('thirteen_wonders'); expect(r.fan).toBe(8);
  });
  it('fanInHand counts armed fan without a win', () => {
    expect(fanInHand({ melds: [pong('R'), pong('E')], bonus: [KIND.FLOWER], seat: 0, prevailingWind: 0 })).toBe(1 + 2 + 1);
  });
});
