/**
 * Does a table with no Jokers deal, play and pay out correctly?
 *
 *   tsx src/jokercheck.ts [hands]
 *
 * `jokers.count` validates from zero and the wall takes it, but no run in this project has ever
 * used anything but four, so nothing has ever exercised the zero path. Before any comparison is
 * worth reading, the game at zero has to be a legal game: hands finish, nobody plays an illegal
 * action, the chips net to zero, and the wall holds the right number of tiles.
 */
import { GameState, Wall, makeRng, tableConfigOf } from 'sg-mahjong-engine';
import { CoachBot } from 'sg-mahjong-solver';
import { rulesForDir } from './tablerules.js';

const n = Number(process.argv[2] ?? 200);
const base = rulesForDir('../data/gen/run-coach2');

for (const count of [4, 0]) {
  const rules = { ...base, jokers: { ...base.jokers, count } };
  const cfg = tableConfigOf(rules);
  let chips = 0, illegal = 0, wins = 0, draws = 0, turns = 0, accounted = new Set<number>(), blocked = 0;
  for (let g = 0; g < n; g++) {
    const wall = new Wall(makeRng(4242 * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count);
    const res = GameState.deal(cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules })
      .run([0, 1, 2, 3].map(() => new CoachBot()));
    chips += res.chipsDelta.reduce((a, b) => a + b, 0);
    illegal += res.counts.illegal;
    turns += res.playerTurns;
    accounted.add(res.tilesAccounted);
    if (res.winner !== null) wins++; else draws++;
    blocked += res.blockedWins.reduce((a, b) => a + b, 0);
  }
  console.log(`Jokers ${count}: ${n} hands · chips net ${chips.toFixed(2)} · illegal ${illegal} · won ${wins} drawn ${draws} · mean turns ${(turns / n).toFixed(1)} · tiles accounted ${[...accounted].sort().join('/')} · blocked wins ${blocked}`);
}
