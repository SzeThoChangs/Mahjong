/** Does the suit read actually show up in the advice, and does it change the ranking? It must not. */
import { GameState, Wall, makeRng, kindOf, type PlayerView } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { rankDiscards } from '../rank.js';
import { ctxOf, meldsOf, CoachBot } from '../bot.js';
import { suitWatch } from '../reads.js';

const cfg = loadTableConfig(), rules = loadTableRules();
let decisions = 0, flagged = 0, changed = 0, shown: string[] = [];
for (let g = 0; g < Number(process.argv[2] ?? 200); g++) {
  const st = GameState.deal(cfg, new Wall(makeRng(777 * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count), { rules, dealer: g % 4 });
  const bots = [0, 1, 2, 3].map(() => new CoachBot());
  let guard = 0;
  while (!st.finished && guard++ < 3000) {
    st.advance(); if (st.finished) break;
    const p = st.pending();
    if (p && p.kind === 'discard') {
      const v: PlayerView = st.view(p.seat, null);
      const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v);
      decisions++;
      const w = suitWatch(ctx.opponents);
      if (w.length) {
        flagged++;
        const withIt = rankDiscards(hand, melds, ctx);
        const without = rankDiscards(hand, melds, { ...ctx, opponents: undefined });
        if (withIt.best.tile !== without.best.tile) changed++;
        if (shown.length < 3) shown.push(withIt.planDetail.find((d) => d.includes('probably their hand')) ?? '');
      }
    }
    st.step(bots);
  }
}
console.log(`${decisions} discard decisions, a seat looked to be collecting a suit on ${flagged} (${(100*flagged/decisions).toFixed(1)}%)`);
console.log(`the coach's PICK changed on ${changed} of them - must be 0, the read is reported and never scored`);
for (const s of shown.filter(Boolean)) console.log(`  e.g. ${s}`);
