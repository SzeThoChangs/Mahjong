/**
 * Opponent reading tables: what public signals actually tell you about a hidden hand.
 *
 *   tsx src/reads.ts --dir ../data/gen/run-money3 --hands 20000 --out ../web/public/reads --name money
 *
 * Replays recorded hands and, at sampled moments, compares what is PUBLIC about each seat
 * (exposed melds, their discard pattern, the turn) with what they are TRULY holding
 * (shanten, the exact tiles they would win on). Aggregated into probability tables.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GameState, Wall, makeRng, tableConfigOf, kindOf, isHonour, isSuited, isJoker, isTerminal, suitOf,
  countsAndJokers, shanten, winningKinds, type TileKind,
} from 'sg-mahjong-engine';
import { loadHands } from './stats.js';
import { rulesForDir } from './tablerules.js';
import { botsFor } from './position.js';
import { DEFAULT_RANDOMNESS } from './bots.js';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const dir = arg('dir', '../data/gen/run-money3')!;
const outDir = arg('out', '../web/public/reads')!;
const name = arg('name', 'money')!;
const maxHands = Number(arg('hands', '20000'));
const every = Number(arg('every', '3'));      // sample every Nth discard decision

const rules = rulesForDir(dir);
const cfg = tableConfigOf(rules);
const bucket = (turn: number) => Math.min(60, Math.floor(turn / 10) * 10);   // 0,10,...,60
const tileClass = (k: TileKind) => isJoker(k) ? 'joker' : isHonour(k) ? 'honour' : isTerminal(k) ? 'terminal' : 'simple';

interface Cell { n: number; hit: number }
const table = () => ({} as Record<string, Cell>);
const bump = (t: Record<string, Cell>, key: string, hit: boolean) => { const c = (t[key] ??= { n: 0, hit: 0 }); c.n++; if (hit) c.hit++; };

const ready = table();        // "melds|turn"        -> is that seat one tile away?
const suitTell = table();     // "ownSuitDiscards|turn" -> are they really collecting that suit?
const danger = table();       // "class|turn"        -> would discarding it have dealt in to someone?
const dangerSafe = table();   // "class|turn|seenBefore" -> same, split by whether the tile was already discarded
const honourTiming = table(); // "turn"              -> P(an honour discard is claimed)
let sampled = 0, hands = 0;

const all = loadHands(dir);
for (const hr of all.slice(0, maxHands)) {
  const g = GameState.deal(cfg, new Wall(makeRng(hr.seed), rules.unplayable_tiles, rules.jokers.count), { dealer: hr.dl, prevailingWind: hr.w, rules });
  const bots = botsFor(hr, DEFAULT_RANDOMNESS);
  let step = 0, guard = 0;
  hands++;
  while (!g.finished && guard++ < 3000) {
    g.advance();
    const p = g.pending();
    if (p && p.kind === 'discard' && step++ % every === 0) {
      sampled++;
      const turn = bucket(g.playerTurns);
      // what every seat is really holding, and what is public about them
      const truth = g.players.map((q) => {
        const kinds = q.hand.map(kindOf);
        const std = kinds.filter((k) => !isJoker(k));
        const sh = shanten(kinds, q.melds.length);
        const cj = countsAndJokers(kinds);
        const outs = sh === 0 && kinds.length % 3 === 1 ? winningKinds(cj.counts, 4 - q.melds.length) : [];
        return { sh, outs: new Set(outs), kinds, std };
      });
      for (let s = 0; s < 4; s++) {
        const q = g.players[s]!, t = truth[s]!;
        bump(ready, `${Math.min(3, q.melds.length)}|${turn}`, t.sh <= 0);
        // the suit tell: how many tiles of each suit have THEY discarded, vs what they actually hold
        for (const suit of ['wan', 'tong', 'sok'] as const) {
          const thrown = q.discards.filter((x) => suitOf(kindOf(x)) === suit).length;
          const holding = t.std.filter((k) => suitOf(k) === suit).length + q.melds.filter((m) => suitOf(m.tiles[0]!) === suit).length * 3;
          bump(suitTell, `${Math.min(3, thrown)}|${turn}`, holding >= 7);       // 7+ tiles = genuinely collecting it
        }
      }
      // danger: for each tile the acting player could throw, would it complete somebody?
      const me = p.seat;
      const seen = new Set(g.discardLog.map((e) => kindOf(e.tile)));
      for (const act of p.legal) {
        if (act.a !== 'discard') continue;
        const k = act.kind;
        const deadly = truth.some((t, s) => s !== me && t.sh === 0 && t.outs.has(k));
        bump(danger, `${tileClass(k)}|${turn}`, deadly);
        bump(dangerSafe, `${tileClass(k)}|${turn}|${seen.has(k) ? 'seen' : 'fresh'}`, deadly);
        if (isHonour(k)) bump(honourTiming, `${turn}`, deadly);
      }
    }
    if (g.finished) break;
    g.step(bots);
  }
}

mkdirSync(outDir, { recursive: true });
const pct = (t: Record<string, Cell>) => Object.fromEntries(Object.entries(t).filter(([, c]) => c.n >= 30).map(([k, c]) => [k, { p: c.hit / c.n, n: c.n }]));
writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ run: dir.split('/').pop(), hands, sampled, ready: pct(ready), suitTell: pct(suitTell), danger: pct(danger), dangerSafe: pct(dangerSafe) }));
console.log(`reads: ${hands} hands, ${sampled} sampled moments -> ${outDir}/${name}.json`);
const show = (label: string, t: Record<string, Cell>, keys: string[]) => {
  console.log(`\n${label}`);
  for (const k of keys) { const c = t[k]; if (c && c.n >= 30) console.log(`  ${k.padEnd(22)} ${(100 * c.hit / c.n).toFixed(0).padStart(3)}%   (n=${c.n})`); }
};
show('P(seat is one tile away)  melds|turn', ready, ['0|10', '0|30', '0|50', '1|30', '2|30', '3|30', '3|40', '3|50']);
show('P(they are really collecting a suit)  ownDiscardsOfThatSuit|turn', suitTell, ['0|20', '1|20', '2|20', '3|20', '0|40', '1|40', '2|40', '3|40']);
show('P(discarding this deals in)  tileClass|turn', danger, ['honour|10', 'honour|30', 'honour|50', 'terminal|30', 'simple|30', 'simple|50', 'joker|30']);
show('...split by whether the tile was already discarded once', dangerSafe, ['simple|40|fresh', 'simple|40|seen', 'honour|40|fresh', 'honour|40|seen']);
