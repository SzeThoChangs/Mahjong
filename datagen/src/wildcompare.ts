/**
 * The same table with and without wildcards, on the same deals.
 *
 *   tsx src/wildcompare.ts 3000
 *
 * Every hand this project generated used four wildcards, so every number it produced - the quiz
 * packs, the value tables, the danger reads, every verdict on the Tips page - describes that table.
 * Changs plays both. This asks how different the other one is, before anything is rebuilt for it.
 *
 * PAIRED. Arm 4 and arm 0 are dealt from the same seed, so the walls differ only by the four tiles
 * that are wildcards in one and ordinary in the other, and the comparison is of the rule rather
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

function play(count: number, sample: boolean): Arm {
  const rules = { ...base, jokers: { ...base.jokers, count } };
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
const four = play(4, true), zero = play(0, true);
const pc = (x: number, y: number) => `${(100 * x / Math.max(1, y)).toFixed(1)}%`;
const row = (label: string, f: string, z: string) => console.log(`  ${label.padEnd(34)}${f.padStart(10)}${z.padStart(12)}`);
console.log(`\n${n} paired deals, four coaches, the same seeds both ways (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
console.log(`  ${'.'.padEnd(34)}${'4 wildcards'.padStart(10)}${'0 wildcards'.padStart(12)}`);
row('somebody won', pc(four.wins, four.hands), pc(zero.wins, zero.hands));
row('nobody won (drawn hand)', pc(four.draws, four.hands), pc(zero.draws, zero.hands));
row('mean turns in a hand', (four.turns / four.hands).toFixed(1), (zero.turns / zero.hands).toFixed(1));
row('seats that ever reached Ting Pai', pc(four.everReady, four.hands * 4), pc(zero.everReady, zero.hands * 4));
row('  ...and the turn they got there', (four.readyTurnSum / Math.max(1, four.readyTurns)).toFixed(1), (zero.readyTurnSum / Math.max(1, zero.readyTurns)).toFixed(1));
row('tai per win', (four.tai / Math.max(1, four.wins)).toFixed(2), (zero.tai / Math.max(1, zero.wins)).toFixed(2));
row('chips per win', (four.chipsWon / Math.max(1, four.wins)).toFixed(2), (zero.chipsWon / Math.max(1, zero.wins)).toFixed(2));
row('wins blocked by the minimum', String(four.blocked), String(zero.blocked));
console.log('\n  what won, as a share of wins');
const combos = [...new Set([...four.combos.keys(), ...zero.combos.keys()])].sort();
for (const c of combos) row(`    ${c}`, pc(four.combos.get(c) ?? 0, four.wins), pc(zero.combos.get(c) ?? 0, zero.wins));
console.log('\n  chance a throw completes somebody');
for (const key of [...four.danger.keys()].sort()) {
  const f = four.danger.get(key)!, z = zero.danger.get(key) ?? { n: 0, hit: 0 };
  row(`    ${key}`, `${(100 * f.hit / Math.max(1, f.n)).toFixed(2)}%`, `${(100 * z.hit / Math.max(1, z.n)).toFixed(2)}%`);
}
