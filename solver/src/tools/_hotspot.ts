/**
 * WHY does one discard decision cost 1.6 ms? Before training an approximate copy of the coach, find
 * out whether the exact coach can simply be made faster - an exact speed-up has no fidelity risk at
 * all, which an imitation always does.
 */
import { GameState, Wall, makeRng, kindOf, shanten, scoreHand, type PlayerView } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { rankDiscards } from '../rank.js';
import { handValue } from '../targets.js';
import { rule4213, rule5313, rule961, allPongBreakdown } from '../evaluators.js';
import { ctxOf, meldsOf, CoachBot } from '../bot.js';

const cfg = loadTableConfig(), rules = loadTableRules();
const N = Number(process.argv[2] ?? 60);
const cases: { hand: number[]; melds: ReturnType<typeof meldsOf>; ctx: ReturnType<typeof ctxOf> }[] = [];
for (let g = 0; g < N && cases.length < 400; g++) {
  const st = GameState.deal(cfg, new Wall(makeRng(9 * 1000003 + g), cfg.unplayable_tiles, rules.jokers.count), { rules, dealer: g % 4 });
  const bots = [0, 1, 2, 3].map(() => new CoachBot());
  let guard = 0;
  while (!st.finished && guard++ < 3000) {
    st.advance(); if (st.finished) break;
    const p = st.pending();
    if (p && p.kind === 'discard' && cases.length < 400) {
      const v: PlayerView = st.view(p.seat, null);
      cases.push({ hand: v.hand.map(kindOf), melds: meldsOf(v), ctx: ctxOf(v) });
    }
    st.step(bots);
  }
}
const time = (label: string, f: () => void, reps = 1) => {
  const a = performance.now(); for (let i = 0; i < reps; i++) f(); const ms = (performance.now() - a) / reps;
  console.log(`  ${label.padEnd(38)} ${(ms / cases.length * 1000).toFixed(0).padStart(6)} us per decision`);
};
console.log(`${cases.length} real discard positions\n`);
time('rankDiscards (the whole thing)', () => { for (const c of cases) rankDiscards(c.hand, c.melds, c.ctx); });
time('handValue once per candidate', () => {
  for (const c of cases) for (const k of new Set(c.hand)) { const r = [...c.hand]; r.splice(r.indexOf(k), 1); handValue({ concealed: r, melds: c.melds }, c.ctx); }
});
time('the four evaluators, once per candidate', () => {
  for (const c of cases) for (const k of new Set(c.hand)) { const r = [...c.hand]; r.splice(r.indexOf(k), 1); const h = { concealed: r, melds: c.melds }; rule4213(h); rule5313(h); rule961(h); allPongBreakdown(h); }
});
time('shanten, once per candidate', () => {
  for (const c of cases) for (const k of new Set(c.hand)) { const r = [...c.hand]; r.splice(r.indexOf(k), 1); shanten(r, c.melds.length); }
});
time('scoreHand, 34 kinds x 2 (what legalWait does)', () => {
  for (const c of cases) { const r = [...c.hand]; r.splice(0, 1);
    for (let k = 0; k < 34; k++) { const w = { concealed: [...r, k], melds: c.melds, bonus: [...c.ctx.bonus], seat: c.ctx.seat, prevailingWind: c.ctx.prevailingWind, winningTile: k };
      scoreHand({ ...w, selfDraw: false }); scoreHand({ ...w, selfDraw: true }); } }
});
