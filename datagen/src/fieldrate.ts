/**
 * How decisive is a value table on the positions a FIELD produces?
 *
 *   tsx src/fieldrate.ts 200 --tables ../knowledge/sources/fitted/tables-both-g1.30.json [--field pool|noisy]
 *
 * `_fitrate.ts` in the solver measures a candidate table's top-two plan gap against the shipped
 * one, on hands four coaches play, and the gain of every table so far was picked to match that
 * gap. But a gain matched to coach-table positions is a coach-table gain. This asks the same
 * question with the personality pool (or noisy coaches) in the other three chairs, watching one
 * coach's discards, so a table can be given the gain the FIELD wants. It lives here rather than
 * beside `_fitrate` because the personalities are datagen's and the solver cannot import them.
 */
import { readFileSync } from 'node:fs';
import { playGame, shuffleWall, makeRng, kindOf, type Bot, type PlayerView, type TileInstance } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot, ctxOf, meldsOf, evaluateTargets } from 'sg-mahjong-solver';
import { makeBot, BOT_TYPES, DEFAULT_RANDOMNESS, NoisyCoachBot } from './bots.js';
import { fnv1a } from './records.js';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const N = Number(process.argv[2] ?? 200);
const tables: unknown = JSON.parse(readFileSync(arg('tables', '../knowledge/sources/fitted/tables-both-g1.30.json'), 'utf8'));
const fieldKind = arg('field', 'pool');
const from = Number(arg('from', '800001'));
const cfg = loadTableConfig(), rules = loadTableRules();

let gapOld = 0, gapNew = 0, n = 0, planChanged = 0;
class Watch extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v);
    const ea = evaluateTargets({ concealed: hand, melds }, ctx);
    const eb = evaluateTargets({ concealed: hand, melds }, { ...ctx, tables });
    if (ea.length > 1 && eb.length > 1) { gapOld += ea[0]!.chips - ea[1]!.chips; gapNew += eb[0]!.chips - eb[1]!.chips; n++; if (ea[0]!.id !== eb[0]!.id) planChanged++; }
    return super.chooseDiscard(v);
  }
}
for (let g = 0; g < N; g++) {
  const shuffle = from + g;
  const wall = shuffleWall(shuffle, cfg.unplayable_tiles, rules.jokers.count);
  const seat = g % 4;
  const bots: Bot[] = [0, 1, 2, 3].map((s) => {
    if (s === seat) return new Watch();
    if (fieldKind === 'noisy') return new NoisyCoachBot(makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
    return makeBot(BOT_TYPES[fnv1a(`field:${shuffle}:${s}`) % BOT_TYPES.length]!, makeRng(fnv1a(`seed:${shuffle}:${s}`)), DEFAULT_RANDOMNESS);
  });
  playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
}
console.log(`${N} hands, one coach watched against ${fieldKind === 'noisy' ? 'three noisy coaches' : 'three personalities'}, ${n} discards with two plans`);
console.log(`  gap between the top two plans, shipped: ${(gapOld / Math.max(1, n)).toFixed(2)} chips`);
console.log(`  gap between the top two plans, fitted:  ${(gapNew / Math.max(1, n)).toFixed(2)} chips   (plan changes on ${(100 * planChanged / Math.max(1, n)).toFixed(2)}%)`);
