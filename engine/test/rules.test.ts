import { describe, it, expect } from 'vitest';
import { Wall, makeRng } from '../src/wall.js';
import { GameState } from '../src/state.js';
import { makeRules, tableConfigOf } from '../src/rules.js';
import { parseKinds, kindOf, INSTANCE_KIND, KIND, TOTAL_TILES, type TileKind, type TileInstance } from '../src/tiles.js';
import { scoreHand } from '../src/score.js';
import type { Bot, ClaimOption, PlayerView, SelfAction } from '../src/game.js';

/** instances for a list of kinds, each kind's next unused copy */
function instances(kinds: TileKind[], used: Set<TileInstance>): TileInstance[] {
  return kinds.map((k) => { for (let t = 0; t < INSTANCE_KIND.length; t++) if (INSTANCE_KIND[t] === k && !used.has(t)) { used.add(t); return t; } throw new Error('out of copies for ' + k); });
}
/** wall whose deal gives `hands[seat]` (13 kinds each, dealer 0) and whose next draws are `next` */
/** `jokers` = how many wildcards this game uses; without it the wall is the plain 148-tile set. */
function craftedWall(hands: string[], next: string, unplayable = 15, jokers = 0): Wall {
  const used = new Set<TileInstance>();
  const H = hands.map((h) => instances(parseKinds(h), used));
  const order: TileInstance[] = [];
  for (let i = 0; i < 13; i++) for (let s = 0; s < 4; s++) order.push(H[s]![i]!);
  for (const t of instances(parseKinds(next), used)) order.push(t);
  const limit = jokers > 0 ? INSTANCE_KIND.length : TOTAL_TILES;
  for (let t = 0; t < limit; t++) if (!used.has(t)) order.push(t);
  return Wall.fromSnapshot({ order, front: 0, back: order.length - 1, unplayable });
}
/** scripted bot: discards from a queue of kinds (else first tile), takes self actions / claims by preference */
class ScriptBot implements Bot {
  constructor(private discards: TileKind[] = [], private self: string[] = ['win'], private claims: string[] = ['win']) {}
  chooseDiscard(v: PlayerView): TileInstance { while (this.discards.length) { const k = this.discards.shift()!; const t = v.hand.find((x) => kindOf(x) === k); if (t !== undefined) return t; } return v.hand[0]!; }
  chooseSelfAction(_v: PlayerView, o: SelfAction[]): SelfAction | null { for (const p of this.self) { const x = o.find((y) => y.kind === p); if (x) return x; } return null; }
  chooseClaim(_v: PlayerView, o: ClaimOption[]): ClaimOption | null { for (const p of this.claims) { const x = o.find((y) => y.kind === p); if (x) return x; } return null; }
}
const rules = makeRules({});
const cfg = tableConfigOf(rules);

describe('robbing the kong', () => {
  it('a 13 Wonders hand robs a concealed kong (kong4) and the kong is undone', () => {
    const wall = craftedWall([
      'E E E 2w 3w 4w 6t 7t 8t 2s 3s 4s 5w',                   // dealer: will draw the 4th E and declare kong4
      '1w 9w 1t 9t 1s 9s S W N R G Wh 1w',                     // seat 1: 13 wonders waiting on E
      '2t 2t 3t 3t 4t 4t 5t 5t 6t 6t 7t 7t 8t',
      '2s 2s 3s 3s 4s 4s 5s 5s 6s 6s 7s 7s 8s',
    ], 'E 9t');
    const g = GameState.deal(cfg, wall, { rules, log: true });
    const res = g.run([new ScriptBot([], ['win', 'kong4']), new ScriptBot(), new ScriptBot(), new ScriptBot()]);
    expect(res.winner).toBe(1); expect(res.discarder).toBe(0);
    expect(res.score!.combination).toBe('shi_san_yao');
    expect(res.score!.items.map((i) => i.id)).toContain('robbing_kong');
    expect(res.counts.kong).toBe(0);                               // the kong was undone
    expect(g.players[0]!.hand.filter((t) => kindOf(t) === KIND.WIND).length).toBe(3);   // three E back in hand
    expect(res.chipsDelta.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('a sequence wait robs an added kong (kong1) of a suited tile; the same wait cannot rob a concealed kong (kong4)', () => {
    const build = (kong: 'kong1' | 'kong4') => {
      const wall = craftedWall([
        kong === 'kong1' ? 'E S 7s 2t 4t 6t 8t 1s 3s 9s 2w 8w 9w' : '4w 4w 4w 2t 4t 6t 8t 1s 3s 7s 9s 2w 8w',   // dealer draws the last 4w
        '5w 6w 1t 2t 3t 7t 8t 9t 2s 3s 4s 9s 9s',                 // seat 1: two-sided wait on 4w/7w (All-Chow needs 2+ winning tiles), 2 Fan from its own flowers
        '2t 2t 3t 3t 4t 4t 5t 5t 6t 6t 7t 7t 8t',
        '1s 2s 2s 3s 3s 4s 4s 5s 5s 6s 6s 7s 7s',
      ], kong === 'kong1' ? '9t 9t' : '4w 9t 9t');
      const g0 = GameState.deal(cfg, wall, { rules });
      const snap = g0.snapshot();
      if (kong === 'kong1') {   // dealer holds an exposed pong of 5w (copies 0-2) in place of E S 7s; copy 3 is forced to be the next draw
        const p0 = snap.players[0]!; p0.hand = p0.hand.filter((t) => ![KIND.WIND, KIND.WIND + 1, KIND.SOK + 6].includes(kindOf(t)));
        const fours = [0, 1, 2, 3].map((c) => INSTANCE_KIND.findIndex((k, i) => k === KIND.WAN + 3 && INSTANCE_KIND.slice(0, i).filter((x) => x === KIND.WAN + 3).length === c));
        p0.melds = [{ type: 'pong', tiles: [KIND.WAN + 3, KIND.WAN + 3, KIND.WAN + 3], concealed: false, instances: fours.slice(0, 3) }];
        const order = [...snap.wall.order]; const j = order.indexOf(fours[3]!); const f = snap.wall.front;
        [order[f], order[j]] = [order[j]!, order[f]!];           // next draw = 4th 4w
        for (const c of fours.slice(0, 3)) { const i = order.indexOf(c); if (i >= 0) order.splice(i, 1); }   // the ponged copies are no longer in the wall
        snap.wall = { ...snap.wall, order, back: snap.wall.back - 3 };
      }
      snap.players[1]!.bonus = [KIND.FLOWER + 1, KIND.SEASON + 1];   // seat 1's own flower + season = 2 Fan in hand
      return GameState.fromSnapshot(snap, cfg, { rules });
    };
    const g1 = build('kong1');
    const r1 = g1.run([new ScriptBot([], ['win', 'kong1']), new ScriptBot(), new ScriptBot(), new ScriptBot()]);
    expect(r1.winner).toBe(1); expect(r1.discarder).toBe(0);
    expect(r1.score!.items.map((i) => i.id)).toContain('robbing_kong');
    expect(g1.players[0]!.melds[0]!.type).toBe('pong');              // the kong reverted to a pong
    const g4 = build('kong4');
    const bots = [new ScriptBot([], ['win', 'kong4']), new ScriptBot(), new ScriptBot(), new ScriptBot()];
    g4.step(bots);                                                   // dealer draws the 4th 5w and declares kong4
    expect(g4.players[0]!.melds.length).toBe(1); expect(g4.players[0]!.melds[0]!.type).toBe('kong');
    expect(g4.finished).toBe(false);                                  // nobody could rob it
  });
});

describe('flower specials', () => {
  it('Seven Flower scores 10 instead of the individual flower Fan', () => {
    const r = scoreHand({ concealed: parseKinds('1w 2w 3w 4t 5t 6t 7s 7s 7s 2s 3s 4s R R'), melds: [], bonus: [KIND.FLOWER, KIND.FLOWER + 1, KIND.FLOWER + 2, KIND.FLOWER + 3, KIND.SEASON, KIND.SEASON + 1, KIND.SEASON + 2], seat: 0, prevailingWind: 1, winningTile: 31, selfDraw: true });
    expect(r.items.map((i) => i.id)).toContain('seven_flower');
    expect(r.items.map((i) => i.id)).not.toContain('own_flower');
    expect(r.fan).toBe(10);
  });
  it('Eight Flower is an instant win when enabled (and not when disabled)', () => {
    const mk = (on: boolean) => {
      const rl = makeRules({ special_hands: { eight_flower_instant_win: on } });
      const used = new Set<TileInstance>();
      const bonus8 = [KIND.FLOWER, KIND.FLOWER + 1, KIND.FLOWER + 2, KIND.FLOWER + 3, KIND.SEASON, KIND.SEASON + 1, KIND.SEASON + 2, KIND.SEASON + 3];
      const s0 = instances([...bonus8, ...parseKinds('1w 2w 3w 4w 5w')], used);
      const others = [1, 2, 3].map((s) => instances(parseKinds(['2t 2t 3t 3t 4t 4t 5t 5t 6t 6t 7t 7t 8t', '2s 2s 3s 3s 4s 4s 5s 5s 6s 6s 7s 7s 8s', '1t 9t 1s 9s 2w 8w E S W N R G Wh'][s - 1]!), used));
      const order: TileInstance[] = [];
      for (let i = 0; i < 13; i++) for (let s = 0; s < 4; s++) order.push(s === 0 ? s0[i]! : others[s - 1]![i]!);
      for (let t = 0; t < INSTANCE_KIND.length; t++) if (!used.has(t)) order.push(t);
      const g = GameState.deal(tableConfigOf(rl), Wall.fromSnapshot({ order, front: 0, back: order.length - 1, unplayable: 15 }), { rules: rl });
      return g;
    };
    const g = mk(true);
    expect(g.finished).toBe(true); expect(g.result!.winner).toBe(0); expect(g.result!.score!.combination).toBe('hua_hu');
    expect(g.result!.score!.items.find((i) => i.id === 'hua_hu')!.fan).toBe(5); expect(g.result!.score!.fan).toBeGreaterThanOrEqual(5);
    const g2 = mk(false);
    expect(g2.finished).toBe(false); expect(g2.players[0]!.bonus.length).toBeGreaterThanOrEqual(8);   // keeps drawing replacements (and collects the animals too)
  });
});

describe('Pay-All (bao)', () => {
  /** seat 1 holds two exposed dragon pongs; dealer feeds the third (Wh); seat 1 later wins on seat 2's discard */
  const build = (rl: ReturnType<typeof makeRules>) => {
    const wall = craftedWall([
      'Wh 2t 4t 6t 8t 1s 3s 5s 7s 9s 2w 4w 6w',              // dealer discards Wh first
      'Wh Wh 1w 2w 3w 5t 7t 9w 9w 9w 8s 8s 8s',              // seat 1 (9w/8s triplets replaced by R/G pongs below): after ponging Wh it discards 7t and waits on 5t
      '5t 2t 2t 3t 3t 4t 4t 6t 6t 7t 7t 8t 8t',              // seat 2 discards 5t -> seat 1 wins
      '2s 2s 3s 3s 4s 4s 5s 5s 6s 6s 7s 7s 8s',
    ], '1t 9s 9s 9s');
    const g0 = GameState.deal(tableConfigOf(rl), wall, { rules: rl });
    const snap = g0.snapshot(); const p1 = snap.players[1]!;
    p1.hand = p1.hand.filter((t) => kindOf(t) !== KIND.WAN + 8 && kindOf(t) !== KIND.SOK + 7);
    const used = new Set(snap.players.flatMap((p) => p.hand));
    p1.melds = [{ type: 'pong', tiles: [31, 31, 31], concealed: false, instances: instances([31, 31, 31], used) }, { type: 'pong', tiles: [32, 32, 32], concealed: false, instances: instances([32, 32, 32], used) }];
    return GameState.fromSnapshot(snap, tableConfigOf(rl), { rules: rl });
  };
  const bots = () => [new ScriptBot([KIND.DRAGON + 2]), new ScriptBot([KIND.TONG + 6], ['win'], ['win', 'pong']), new ScriptBot([KIND.TONG + 4]), new ScriptBot()];
  it('feeding the third dragon set makes the feeder pay for everyone', () => {
    const res = build(makeRules({ bao: { enabled: true } })).run(bots());
    expect(res.winner).toBe(1); expect(res.discarder).toBe(2);
    expect(res.score!.combination).toBe('da_san_yuan');
    // 7 fan capped at 5 -> base 32; discarder double 64 + 32 + 32 = 128, ALL paid by the feeder (seat 0)
    expect(res.chipsDelta).toEqual([-128, 128, 0, 0]);
  });
  it('with bao disabled the same hand is paid normally', () => {
    const res = build(rules).run(bots());
    expect(res.winner).toBe(1); expect(res.discarder).toBe(2);
    expect(res.chipsDelta).toEqual([-32, 128, -64, -32]);
  });
});
