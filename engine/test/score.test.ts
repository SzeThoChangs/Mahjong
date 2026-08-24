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
  it('平胡 = 4 with no bonus tile; 臭平胡 = 1 when holding one', () => {
    const hand = K('1w 2w 3w 4t 5t 6t 7s 8s 9s 2s 3s 4s 5w 5w');
    const pw = scoreHand(base({ concealed: hand, winningTile: 4, seat: 1, prevailingWind: 2 }));
    expect(pw.combination).toBe('ping_hu'); expect(pw.fan).toBe(4);
    const ac = scoreHand(base({ concealed: hand, winningTile: 4, seat: 1, prevailingWind: 2, bonus: [KIND.FLOWER + 1] }));
    expect(ac.combination).toBe('chou_ping_hu'); expect(ac.fan).toBe(1 + 1);   // 臭平胡 + 正花
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
    expect(ok.valid).toBe(true); expect(ok.combination).toBe('ping_hu');
  });
  it('碰碰胡 = 2; four concealed pongs = 四暗刻 5 only on a self-draw, else just 碰碰胡', () => {
    const exposed = scoreHand(base({ concealed: K('2w 2w 2w 5t 5t'), melds: [pong('9s'), pong('3t'), pong('7w')], winningTile: 1, seat: 1, prevailingWind: 2 }));
    expect(exposed.combination).toBe('peng_peng_hu'); expect(exposed.fan).toBe(2);
    const concealed = K('2w 2w 2w 5t 5t 9s 9s 9s 3t 3t 3t 7w 7w 7w');
    const zimo = scoreHand(base({ concealed, winningTile: 1, seat: 1, prevailingWind: 2, selfDraw: true }));
    expect(zimo.combination).toBe('si_an_ke'); expect(zimo.fan).toBe(5);
    const fed = scoreHand(base({ concealed, winningTile: 1, seat: 1, prevailingWind: 2, selfDraw: false }));
    expect(fed.combination).toBe('peng_peng_hu'); expect(fed.fan).toBe(2);
  });
  it('半色 2, 清一色 4, and they stack with the shape', () => {
    const half = scoreHand(base({ concealed: K('1w 2w 3w 4w 5w 6w 7w 8w 9w 2w 3w 4w N N'), winningTile: 0, seat: 1, prevailingWind: 2 }));
    expect(half.items.map(i => i.id).sort()).toEqual(['ban_se', 'ping_hu']); expect(half.fan).toBe(6);
    const full = scoreHand(base({ concealed: K('1w 2w 3w 4w 5w 6w 7w 8w 9w 2w 3w 4w 5w 5w'), winningTile: 0, seat: 1, prevailingWind: 2 }));
    expect(full.items.map(i => i.id)).toContain('qing_yi_se'); expect(full.fan).toBe(8);      // 清一色 + 平胡
    const hcp = scoreHand(base({ concealed: K('2w 2w 2w N N'), melds: [pong('9w'), pong('3w'), pong('7w')], winningTile: 1, seat: 1, prevailingWind: 2 }));
    expect(hcp.fan).toBe(4);                                                                  // 碰碰胡 2 + 半色 2
  });
  it('小三元 = 3, 小四喜 = 2', () => {
    const r = scoreHand(base({ concealed: K('1w 2w 3w R R'), melds: [pong('G'), pong('Wh'), chow('4t')], winningTile: 0, seat: 1, prevailingWind: 2 }));
    expect(r.combination).toBe('xiao_san_yuan'); expect(r.fan).toBe(3);
    const ws = scoreHand(base({ concealed: K('E E E S S'), melds: [pong('W'), pong('N'), pong('9t')], winningTile: 27, seat: 0, prevailingWind: 0 }));
    expect(ws.items.map(i => i.id)).toContain('xiao_si_xi');
  });
  it('bonus tiles and events', () => {
    const r = scoreHand(base({
      concealed: K('1w 2w 3w 4t 5t 6t 7s 7s 7s 2s 3s 4s R R'), winningTile: 31, seat: 2, prevailingWind: 1,
      bonus: [KIND.ANIMAL, KIND.ANIMAL + 1, KIND.FLOWER + 2, KIND.SEASON + 2, KIND.SEASON + 0], replacementWin: true,
    }));
    // 2 animals + F3 (seat 2) + S3 (seat 2) + replacement
    expect(r.fan).toBe(2 + 1 + 1 + 1);
  });
  it('十三幺 = 5', () => {
    const r = scoreHand(base({ concealed: K('1w 9w 1t 9t 1s 9s E S W N R G Wh E'), winningTile: 27, selfDraw: false }));
    expect(r.combination).toBe('shi_san_yao'); expect(r.fan).toBe(5);
  });
  it('the 5-fan limit hands are recognised by name', () => {
    const lim = (o: Partial<WinContext>) => scoreHand(base({ seat: 1, prevailingWind: 2, ...o })).combination;
    expect(lim({ concealed: K('E E E 5t 5t'), melds: [pong('S'), pong('W'), pong('N')], winningTile: 27 })).toBe('da_si_xi');
    expect(lim({ concealed: K('R R R 5t 5t'), melds: [pong('G'), pong('Wh'), pong('3t')], winningTile: 31 })).toBe('da_san_yuan');
    expect(lim({ concealed: K('R R R Wh Wh'), melds: [pong('E'), pong('S'), pong('G')], winningTile: 31 })).toBe('zi_yi_se');
    expect(lim({ concealed: K('1w 1w 1w 9w 9w'), melds: [pong('1t'), pong('9s'), pong('9t')], winningTile: 0 })).toBe('quan_yao_jiu');
    expect(lim({ concealed: K('1w 1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 9w 9w 5w'), winningTile: 4, selfDraw: true })).toBe('jiu_lian');
  });
  it('fanInHand counts armed fan without a win', () => {
    expect(fanInHand({ melds: [pong('R'), pong('E')], bonus: [KIND.FLOWER], seat: 0, prevailingWind: 0 })).toBe(1 + 2 + 1);
  });
});
