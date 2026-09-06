/**
 * The same table with and without Jokers, on the same deals.
 *
 *   tsx src/jokercompare.ts 3000
 *
 * Every hand this project generated used four Jokers, so every number it produced - the quiz
 * packs, the value tables, the danger reads, every verdict on the Tips page - describes that table.
 * Changs plays both. This asks how different the other one is, before anything is rebuilt for it.
 *
 * PAIRED. Arm 4 and arm 0 are dealt from the same seed, so the walls differ only by the four tiles
 * that are Jokers in one and ordinary in the other, and the comparison is of the rule rather
 * than of two sets of luck.
 *
 * It plays coaches against coaches, which is what the quiz packs were built from, and it watches
 * the whole hand rather than sampling: how often anybody wins at all, how long that takes, whether
 * a seat ever reaches Ting Pai, what wins when somebody does, and how dangerous a throw is by turn.
 */
import { GameState, Wall, makeRng, tableConfigOf, kindOf, isHonour, isTerminal, isJoker, countsAndJokers, shanten, winningKinds, type TileKind, type Decision } from 'sg-mahjong-engine';
import { CoachBot } from 'sg-mahjong-solver';
import { rulesForDir } from './tablerules.js';

const n = Number(process.argv[2] ?? 2000);
const base = rulesForDir('../data/gen/run-coach2');
/**
 * The four tables Changs plays: Jokers on or off, crossed with a 1 or 2 tai minimum. Everything
 * this project measured sits in the first column of the first row.
 */
const ARMS: { wild: number; minTai: number }[] = [
  { wild: 4, minTai: 2 }, { wild: 0, minTai: 2 }, { wild: 4, minTai: 1 }, { wild: 0, minTai: 1 },
];
const cls = (k: TileKind) => (isHonour(k) ? 'honour' : isTerminal(k) ? 'terminal' : 'simple');
const band = (t: number) => (t < 20 ? 'early' : t < 40 ? 'mid' : 'late');

interface Arm {
  hands: number; wins: number; draws: number; turns: number; chipsWon: number; tai: number;
  everReady: number; readyTurnSum: number; readyTurns: number; blocked: number;
  combos: Map<string, number>;
  /** deal-in: for every tile a seat could have thrown, would it have completed somebody? */
  danger: Map<string, { n: number; hit: number }>;
}
const blank = (): Arm => ({ hands: 0, wins: 0, draws: 0, turns: 0, chipsWon: 0, tai: 0, everReady: 0, readyTurnSum: 0, readyTurns: 0, blocked: 0, combos: new Map(), danger: new Map() });

function play(count: number, minTai: number, sample: boolean): Arm {
  const rules = { ...base, jokers: { ...base.jokers, count }, minimum_tai: minTai };
  const cfg = tableConfigOf(rules);
  const a = blank();
  let step = 0;
  for (let g = 0; g < n; g++) {
    const recorder = !sample ? undefined : { record(d: Decision) {
      if (d.kind !== 'discard' || step++ % 7 !== 0) return;
      const truth = d.truth().hands.map((h) => h.map(kindOf));
      const melds = d.view.players.map((p) => p.melds.length);
      const outs = truth.map((kinds, s) => {
        if (s === d.seat) return new Set<TileKind>();
        const { counts } = countsAndJokers(kinds);
        return shanten(kinds, melds[s]!) === 0 && kinds.length % 3 === 1 ? new Set(winningKinds(counts, 4 - melds[s]!)) : new Set<TileKind>();
      });
      const seen = new Set<TileKind>();
      for (const t of d.view.hand) {
        const k = kindOf(t);
        if (k >= 34 || isJoker(k) || seen.has(k)) continue;
        seen.add(k);
        const key = `${cls(k)}|${band(d.view.playerTurns)}`;
        const c = a.danger.get(key) ?? { n: 0, hit: 0 };
        c.n++; if (outs.some((o) => o.has(k))) c.hit++;
        a.danger.set(key, c);
      }
    } } ;
    const wall = new Wall(makeRng(4242 * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count);
    const res = GameState.deal(cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules, recorder })
      .run([0, 1, 2, 3].map(() => new CoachBot()));
    a.hands++; a.turns += res.playerTurns;
    a.blocked += res.blockedWins.reduce((x, y) => x + y, 0);
    for (const rt of res.readyTurn) if (rt >= 0) { a.everReady++; a.readyTurnSum += rt; a.readyTurns++; }
    if (res.winner === null) a.draws++;
    else {
      a.wins++; a.chipsWon += res.chipsDelta[res.winner]!; a.tai += res.score?.fan ?? 0;
      const c = res.score?.combination ?? 'none';
      a.combos.set(c, (a.combos.get(c) ?? 0) + 1);
    }
  }
  return a;
}

const t0 = Date.now();
const arms = ARMS.map((a) => ({ ...a, r: play(a.wild, a.minTai, true) }));
const pc = (x: number, y: number) => `${(100 * x / Math.max(1, y)).toFixed(1)}%`;
const head = arms.map((a) => `${a.wild}w/${a.minTai}tai`);
const row = (label: string, vals: string[]) => console.log(`  ${label.padEnd(34)}${vals.map((v) => v.padStart(11)).join('')}`);
console.log(`\n${n} paired deals per arm, four coaches, the same seeds in every arm (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
row('.', head);
row('somebody won', arms.map((a) => pc(a.r.wins, a.r.hands)));
row('nobody won (drawn hand)', arms.map((a) => pc(a.r.draws, a.r.hands)));
row('mean turns in a hand', arms.map((a) => (a.r.turns / a.r.hands).toFixed(1)));
row('seats that ever reached Ting Pai', arms.map((a) => pc(a.r.everReady, a.r.hands * 4)));
row('  ...and the turn they got there', arms.map((a) => (a.r.readyTurnSum / Math.max(1, a.r.readyTurns)).toFixed(1)));
row('tai per win', arms.map((a) => (a.r.tai / Math.max(1, a.r.wins)).toFixed(2)));
row('chips per win', arms.map((a) => (a.r.chipsWon / Math.max(1, a.r.wins)).toFixed(2)));
row('wins blocked by the minimum', arms.map((a) => String(a.r.blocked)));
console.log('\n  what won, as a share of wins');
const combos = [...new Set(arms.flatMap((a) => [...a.r.combos.keys()]))].sort();
for (const c of combos) row(`    ${c}`, arms.map((a) => pc(a.r.combos.get(c) ?? 0, a.r.wins)));
console.log('\n  chance a throw completes somebody');
for (const key of [...arms[0]!.r.danger.keys()].sort()) {
  row(`    ${key}`, arms.map((a) => { const c = a.r.danger.get(key) ?? { n: 0, hit: 0 }; return `${(100 * c.hit / Math.max(1, c.n)).toFixed(2)}%`; }));
}
