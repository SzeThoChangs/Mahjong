/**
 * How often does the wall rule actually CHANGE anything?
 *
 * A rule that never fires and a rule that fires and does not pay both measure zero chips. FINDINGS
 * records a session lost to exactly that confusion, so this separates them before the verdict.
 */
import { GameState, Wall, makeRng, kindOf, type PlayerView } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { rankDiscards } from '../rank.js';
import { ctxOf, meldsOf, CoachBot } from '../bot.js';
import { walled } from '../reads.js';

const cfg = loadTableConfig(), rules = loadTableRules();
const N = Number(process.argv[2] ?? 400);
let decisions = 0, anyWalled = 0, walledTiles = 0, tiles = 0, changed = 0;
for (let g = 0; g < N; g++) {
  const st = GameState.deal(cfg, new Wall(makeRng(555 * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count), { rules, dealer: g % 4 });
  const bots = [0, 1, 2, 3].map(() => new CoachBot());
  let guard = 0;
  while (!st.finished && guard++ < 3000) {
    st.advance(); if (st.finished) break;
    const p = st.pending();
    if (p && p.kind === 'discard') {
      const v: PlayerView = st.view(p.seat, null);
      const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v);
      const acc = new Array<number>(34).fill(0);
      for (const k of ctx.visible ?? []) if (k < 34) acc[k]!++;
      for (const k of hand) if (k < 34) acc[k]!++;
      for (const m of melds) for (const k of m.tiles) if (k < 34) acc[k]!++;
      const kinds = [...new Set(hand)].filter((k) => k < 34);
      const w = kinds.filter((k) => walled(k, acc)).length;
      decisions++; tiles += kinds.length; walledTiles += w; if (w) anyWalled++;
      if (w) {
        const a = rankDiscards(hand, melds, ctx, { wall: false });
        const b = rankDiscards(hand, melds, ctx, { wall: true });
        if (a.best.tile !== b.best.tile) changed++;
      }
    }
    st.step(bots);
  }
}
const pc = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(2)}%`;
console.log(`${N} hands, ${decisions} discard decisions`);
console.log(`  tiles that were walled:            ${walledTiles} of ${tiles}  (${pc(walledTiles, tiles)})`);
console.log(`  decisions with ANY walled tile:    ${anyWalled}  (${pc(anyWalled, decisions)})`);
console.log(`  ...of those, the throw CHANGED:    ${changed}  (${pc(changed, anyWalled)})`);
console.log(`  so the rule changes the play on    ${pc(changed, decisions)} of all discards`);
