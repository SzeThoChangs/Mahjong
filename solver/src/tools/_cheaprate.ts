/**
 * How much of the coach's play is the cheap hand, and how much changes when it is taken away?
 *
 * Run this BEFORE any money run on the `nocheap` arm. Five danger rules have come back at zero and
 * the explanation offered for all five is that they swap one nearly-equal throw for another, so a
 * near-zero here would be read the same way - unless the arm is doing something large, which is
 * what this measures. Four numbers say that:
 *
 *   - how often Chicken is the plan the coach is actually playing
 *   - how often removing it changes the plan, and how often it changes the throw
 *   - how often it changes a call-or-pass, which is where the hybrid really lives: the cheap hand
 *     is usually reached by ponging a value pair
 *
 * The watching bot plays the coach's own choice, so all of this is measured on the coach's own
 * trajectory rather than on positions a crippled bot walked into.
 */
import { playGame, shuffleWall, kindOf, type Bot, type ClaimOption, type PlayerView, type TileInstance } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { rankDiscards } from '../rank.js';
import { claimAdvice, type ClaimCandidate } from '../claim.js';
import { ctxOf, meldsOf, CoachBot } from '../bot.js';

const cfg = loadTableConfig(), rules = loadTableRules();
const N = Number(process.argv[2] ?? 300);
const FROM = Number(process.argv[3] ?? 400001);   // deals nothing here has been fitted or measured on

let decisions = 0, cheapPlan = 0, changed = 0, planChanged = 0;
let claims = 0, claimChanged = 0, claimToPass = 0, passToClaim = 0;
let sumOn = 0, sumOff = 0;
// the mirror arm: the coach playing for the cheap hand and nothing else
let onlyChanged = 0, onlyPlanChanged = 0, onlyClaimChanged = 0, sumOnly = 0;
// How often the plan the arm is left with is one the hand may not legally declare. When Chicken is
// the only plan, a hand with no route to the table minimum still lists it, priced -9 and unarmed -
// and a coach whose best plan is worth -9 has nothing to gain on any throw, so the danger term
// decides and it quietly plays like a folder. That would make the arm's loss a bot giving up
// rather than a bot playing fast for a cheap win, which is a different finding.
let onlyDead = 0, coachDead = 0;

class Watch extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v);
    const on = rankDiscards(hand, melds, ctx);
    const off = rankDiscards(hand, melds, { ...ctx, noCheap: true });
    const only = rankDiscards(hand, melds, { ...ctx, onlyCheap: true });
    decisions++;
    if (on.best.target.id === 'chicken') cheapPlan++;
    if (on.best.target.id !== off.best.target.id) planChanged++;
    if (on.best.tile !== off.best.tile) changed++;
    if (!only.best.target.armed) onlyDead++;
    if (!on.best.target.armed) coachDead++;
    if (on.best.target.id !== only.best.target.id) onlyPlanChanged++;
    if (on.best.tile !== only.best.tile) onlyChanged++;
    sumOn += on.best.chips; sumOff += off.best.chips; sumOnly += only.best.chips;
    return v.hand.find((t) => kindOf(t) === on.best.tile)!;
  }
  override chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const usable = options.filter((o) => o.kind === 'pong' || o.kind === 'chow');
    if (usable.length && v.lastDiscard) {
      const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v), tile = kindOf(v.lastDiscard.tile);
      const cands: ClaimCandidate[] = [{ kind: 'pass', used: [] }, ...usable.map((o) => ({ kind: o.kind as 'pong' | 'chow', used: (o.tiles ?? []).map(kindOf) }))];
      const a = claimAdvice(cands, hand, melds, tile, ctx);
      const b = claimAdvice(cands, hand, melds, tile, { ...ctx, noCheap: true });
      const c = claimAdvice(cands, hand, melds, tile, { ...ctx, onlyCheap: true });
      claims++;
      if (a.best.kind !== c.best.kind || a.best.used.join() !== c.best.used.join()) onlyClaimChanged++;
      if (a.best.kind !== b.best.kind || a.best.used.join() !== b.best.used.join()) {
        claimChanged++;
        if (a.best.kind !== 'pass' && b.best.kind === 'pass') claimToPass++;
        if (a.best.kind === 'pass' && b.best.kind !== 'pass') passToClaim++;
      }
    }
    return super.chooseClaim(v, options);
  }
}

for (let g = 0; g < N; g++) {
  const wall = shuffleWall(FROM + g, cfg.unplayable_tiles, rules.jokers.count);
  const bots: Bot[] = [0, 1, 2, 3].map(() => new Watch());
  playGame(bots, cfg, wall, { dealer: g % 4, prevailingWind: Math.floor(g / 4) % 4, rules });
}

const pc = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(2)}%`;
console.log(`${N} coach hands from shuffle-${String(FROM).padStart(5, '0')}: ${decisions} discard decisions, ${claims} live call decisions\n`);
console.log(`  Chicken is the plan being played on   ${cheapPlan}  (${pc(cheapPlan, decisions)} of discards)`);
console.log(`  removing it changes the PLAN on       ${planChanged}  (${pc(planChanged, decisions)})`);
console.log(`  removing it changes the THROW on      ${changed}  (${pc(changed, decisions)})`);
console.log(`  removing it changes a CALL on         ${claimChanged}  (${pc(claimChanged, claims)} of live call decisions)`);
console.log(`     of those, call -> pass ${claimToPass}, pass -> call ${passToClaim}`);
console.log(`\n  the coach's own estimate of the hand: ${(sumOn / Math.max(1, decisions)).toFixed(2)} chips with the cheap plan, ${(sumOff / Math.max(1, decisions)).toFixed(2)} without`);
console.log(`\nthe mirror arm - only the cheap hand, never a pattern:`);
console.log(`  it changes the PLAN on                ${onlyPlanChanged}  (${pc(onlyPlanChanged, decisions)})`);
console.log(`  it changes the THROW on               ${onlyChanged}  (${pc(onlyChanged, decisions)})`);
console.log(`  it changes a CALL on                  ${onlyClaimChanged}  (${pc(onlyClaimChanged, claims)} of live call decisions)`);
console.log(`  the coach's own estimate of the hand:  ${(sumOnly / Math.max(1, decisions)).toFixed(2)} chips`);
console.log(`\n  its best plan is one it may NOT declare on  ${onlyDead}  (${pc(onlyDead, decisions)} of discards)`);
console.log(`  the same for the unchanged coach            ${coachDead}  (${pc(coachDead, decisions)})`);
