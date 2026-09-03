/**
 * Does pricing an opponent's VISIBLE value change anything, and by how much?
 *
 * A rule that never fires and a rule that fires and does not pay both measure zero chips, and
 * FINDINGS records a session lost to that confusion. So this runs before the money does. It answers
 * three things: what a shot at the table actually costs across real positions (which is the
 * constant the term is normalised by), how often that differs from the average, and how often it
 * changes the coach's throw.
 */
import { GameState, Wall, makeRng, kindOf, type PlayerView } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { rankDiscards, shotScale } from '../rank.js';
import { ctxOf, meldsOf, CoachBot } from '../bot.js';

const cfg = loadTableConfig(), rules = loadTableRules();
const N = Number(process.argv[2] ?? 400);
const seed = Number(process.argv[3] ?? 555);
let decisions = 0, changed = 0, above = 0, below = 0, sum = 0;
const hist = new Map<string, number>();

for (let g = 0; g < N; g++) {
  const st = GameState.deal(cfg, new Wall(makeRng(seed * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count), { rules, dealer: g % 4 });
  const bots = [0, 1, 2, 3].map(() => new CoachBot());
  let guard = 0;
  while (!st.finished && guard++ < 3000) {
    st.advance(); if (st.finished) break;
    const p = st.pending();
    if (p && p.kind === 'discard') {
      const v: PlayerView = st.view(p.seat, null);
      const ctx = ctxOf(v), hand = v.hand.map(kindOf), melds = meldsOf(v);
      const scale = shotScale(ctx);
      decisions++; sum += scale;
      const key = scale.toFixed(2);
      hist.set(key, (hist.get(key) ?? 0) + 1);
      if (scale > 1.001) above++; else if (scale < 0.999) below++;
      if (Math.abs(scale - 1) > 0.001) {
        const a = rankDiscards(hand, melds, ctx, { valueDanger: false });
        const b = rankDiscards(hand, melds, ctx, { valueDanger: true });
        if (a.best.tile !== b.best.tile) changed++;
      }
    }
    st.step(bots);
  }
}
const pct = (n: number) => `${(100 * n / decisions).toFixed(2)}%`;
console.log(`\n${N} coach hands, seed ${seed}: ${decisions} discard decisions\n`);
console.log(`  mean scale                       ${(sum / decisions).toFixed(3)}   (1.000 would mean the term is exactly neutral overall)`);
console.log(`  positions priced ABOVE average   ${pct(above)}`);
console.log(`  positions priced BELOW average   ${pct(below)}`);
console.log(`  ...of all decisions, the throw CHANGED on ${pct(changed)}`);
console.log('\n  what the scale actually is:');
for (const [k, n] of [...hist].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`    x${k}  ${pct(n).padStart(7)}`);
}
