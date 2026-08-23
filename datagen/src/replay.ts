/** Reproduce a recorded hand from its seed and compare the decision hash. tsx src/replay.ts <out-dir> <session g> <hand h> */
import { makeRules, DEFAULT_RULES, type RulesConfig } from 'sg-mahjong-engine';
import { rulesForDir } from './tablerules.js';
import { playHand } from './session.js';
import { loadHands } from './stats.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HandRecord } from './records.js';
import { DEFAULT_RANDOMNESS } from './bots.js';

export function replayHand(rec: HandRecord, rulesOverride: object = {}, randomness = DEFAULT_RANDOMNESS, rulesBase: RulesConfig = DEFAULT_RULES) {
  const rules = Object.keys(rulesOverride).length ? makeRules({ ...(rulesBase as object), ...rulesOverride }) : rulesBase;
  // session scores before the hand are not needed for play; recover from after - delta
  const scoresBefore = rec.scores.map((s, i) => s - rec.delta[i]!);
  const { record } = playHand({ sessionId: rec.g, handIdx: rec.h, seed: rec.seed, dealer: rec.dl, prevailingWind: rec.w, botTypes: rec.bots, scores: scoresBefore }, rules, randomness, undefined, false);
  return { match: record.hash === rec.hash && record.winner === rec.winner && record.turns === rec.turns, replayed: record, original: rec };
}

if (process.argv[1] && /replay\.(ts|js)$/.test(process.argv[1])) {
  const [dir = '../data/gen/dev', g = '0', h = '0'] = process.argv.slice(2);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { rulesOverride: object; randomness: typeof DEFAULT_RANDOMNESS };
  const hands = loadHands(dir);
  const rec = hands.find((x) => x.g === Number(g) && x.h === Number(h));
  if (!rec) { console.error('hand not found'); process.exit(1); }
  const r = replayHand(rec, {}, manifest.randomness, rulesForDir(dir));
  console.log(r.match ? 'REPRODUCED' : 'MISMATCH', { stored: { hash: rec.hash, winner: rec.winner, turns: rec.turns }, replayed: { hash: r.replayed.hash, winner: r.replayed.winner, turns: r.replayed.turns } });
  process.exit(r.match ? 0 : 2);
}
