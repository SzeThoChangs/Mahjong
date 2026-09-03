/**
 * Do the re-fitted value tables actually change how the coach plays?
 *
 *   tsx src/tools/_fitrate.ts [games] [--tables ../data/gen/tables-fit.json]
 *
 * Run this before any money run on the `fitted` arm. A table that moves every number by a constant
 * changes nothing at all, because `rankDiscards` compares plans against each other and compares one
 * candidate throw against another - only DIFFERENCES survive. So a fit can look dramatically
 * different on the page and be worth exactly zero, and the way to find out is to count.
 *
 * Three numbers matter. How often the coach's chosen plan changes, how often the thrown tile
 * changes, and how far apart the top two plans now sit - because a fit that flattens the table makes
 * the coach indecisive between plans even when it does not change today's throw, and that would show
 * up as a slow loss rather than as anything visible here.
 */
import { playGame, shuffleWall, kindOf, type Bot, type PlayerView, type TileInstance } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { readFileSync } from 'node:fs';
import { rankDiscards } from '../rank.js';
import { evaluateTargets } from '../targets.js';
import { ctxOf, meldsOf, CoachBot } from '../bot.js';

const cfg = loadTableConfig(), rules = loadTableRules();
const N = Number(process.argv[2] ?? 300);
const ti = process.argv.indexOf('--tables');
const path = ti >= 0 ? process.argv[ti + 1]! : '../data/gen/tables-fit.json';
const tables: unknown = JSON.parse(readFileSync(path, 'utf8'));
const FROM = Number(process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : 800001);

let decisions = 0, planChanged = 0, throwChanged = 0;
let sumOld = 0, sumNew = 0, gapOld = 0, gapNew = 0, gapN = 0;

class Watch extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v);
    const a = rankDiscards(hand, melds, ctx);
    const b = rankDiscards(hand, melds, { ...ctx, tables });
    decisions++;
    if (a.best.target.id !== b.best.target.id) planChanged++;
    if (a.best.tile !== b.best.tile) throwChanged++;
    sumOld += a.best.chips; sumNew += b.best.chips;
    // how decisive the coach is between its top two plans, which is what a flattened table erodes
    const ea = evaluateTargets({ concealed: hand, melds }, ctx);
    const eb = evaluateTargets({ concealed: hand, melds }, { ...ctx, tables });
    if (ea.length > 1 && eb.length > 1) { gapOld += ea[0]!.chips - ea[1]!.chips; gapNew += eb[0]!.chips - eb[1]!.chips; gapN++; }
    return v.hand.find((t) => kindOf(t) === a.best.tile)!;
  }
}

for (let g = 0; g < N; g++) {
  const wall = shuffleWall(FROM + g, cfg.unplayable_tiles, rules.jokers.count);
  const bots: Bot[] = [0, 1, 2, 3].map(() => new Watch());
  playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
}

const pc = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(2)}%`;
console.log(`${N} coach hands from shuffle-${FROM}, ${decisions} discard decisions, tables ${path}\n`);
console.log(`  the fitted tables change the PLAN on   ${planChanged}  (${pc(planChanged, decisions)})`);
console.log(`  they change the THROW on               ${throwChanged}  (${pc(throwChanged, decisions)})`);
console.log(`\n  hand value, shipped tables: ${(sumOld / Math.max(1, decisions)).toFixed(2)} chips`);
console.log(`  hand value, fitted tables:  ${(sumNew / Math.max(1, decisions)).toFixed(2)} chips`);
console.log(`\n  gap between the top two plans, shipped: ${(gapOld / Math.max(1, gapN)).toFixed(2)} chips`);
console.log(`  gap between the top two plans, fitted:  ${(gapNew / Math.max(1, gapN)).toFixed(2)} chips`);
console.log(`  (a much smaller gap means a flatter table and a less decisive coach, which a throw count alone would miss)`);
