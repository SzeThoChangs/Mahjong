/**
 * How often does the legal-wait rule change the throw?
 *
 * A rule that never fires and a rule that fires and does not pay both measure zero chips, and this
 * project has already lost a session to that confusion. Run this BEFORE reading any verdict on the
 * rule: a near-zero head-to-head means something entirely different depending on the answer here.
 */
import { GameState, Wall, kindOf, shuffleWall, type PlayerView } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { rankDiscards } from '../rank.js';
import { ctxOf, meldsOf, CoachBot } from '../bot.js';
import { shanten } from 'sg-mahjong-engine';

const cfg = loadTableConfig(), rules = loadTableRules();
const N = Number(process.argv[2] ?? 300);
let decisions = 0, ready = 0, changed = 0;
for (let g = 0; g < N; g++) {
  const wall: Wall = shuffleWall(300001 + g, cfg.unplayable_tiles, rules.jokers.count);
  const st = GameState.deal(cfg, wall, { rules, dealer: g % 4 });
  const bots = [0, 1, 2, 3].map(() => new CoachBot());
  let guard = 0;
  while (!st.finished && guard++ < 3000) {
    st.advance(); if (st.finished) break;
    const p = st.pending();
    if (p && p.kind === 'discard') {
      const v: PlayerView = st.view(p.seat, null);
      const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v);
      decisions++;
      // the rule only speaks once some discard leaves the hand ready - otherwise it returns null
      const anyReady = [...new Set(hand)].some((k) => {
        const rest = [...hand]; rest.splice(rest.indexOf(k), 1);
        return shanten(rest, melds.length) === 0;
      });
      // NOT `continue` - that would skip st.step below and spin the hand to the guard limit
      if (anyReady) {
        ready++;
        const on = rankDiscards(hand, melds, ctx);
        const off = rankDiscards(hand, melds, ctx, { legalWait: false });
        if (on.best.tile !== off.best.tile) changed++;
      }
    }
    st.step(bots);
  }
}
const pc = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(2)}%`;
console.log(`${N} hands, ${decisions} discard decisions`);
console.log(`  a throw would leave the hand READY on   ${ready}  (${pc(ready, decisions)})  - the only place the rule speaks`);
console.log(`  ...of those, the throw CHANGED          ${changed}  (${pc(changed, ready)})`);
console.log(`  so the rule changes the play on         ${pc(changed, decisions)} of all discards`);
