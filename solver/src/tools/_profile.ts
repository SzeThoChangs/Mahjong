/**
 * WHERE does the coach spend its 78.86 ms a hand? Discards, claims, or somewhere else?
 *
 * A fast copy of the coach is only worth building for the part that is actually slow. `PolicyBot`
 * already replaces the discard with a small network and still costs 12.14 ms a hand, which says
 * most of the cost is somewhere the model does not touch - but says it by inference. This measures
 * it directly, before anything is built on the assumption.
 */
import { runSim, type Bot, type ClaimOption, type PlayerView, type SelfAction, type TileInstance } from 'sg-mahjong-engine';
import { loadTableConfig, loadTableRules } from 'sg-mahjong-engine/node';
import { CoachBot } from '../bot.js';

const t = { discard: 0, claim: 0, self: 0, nDiscard: 0, nClaim: 0, nSelf: 0 };
class TimedCoach extends CoachBot {
  override chooseDiscard(v: PlayerView): TileInstance {
    const a = performance.now(); const r = super.chooseDiscard(v); t.discard += performance.now() - a; t.nDiscard++; return r;
  }
  override chooseClaim(v: PlayerView, o: ClaimOption[]): ClaimOption | null {
    const a = performance.now(); const r = super.chooseClaim(v, o); t.claim += performance.now() - a; t.nClaim++; return r;
  }
  override chooseSelfAction(v: PlayerView, o: SelfAction[]): SelfAction | null {
    const a = performance.now(); const r = super.chooseSelfAction(v, o); t.self += performance.now() - a; t.nSelf++; return r;
  }
}
const cfg = loadTableConfig(), rules = loadTableRules();
const n = Number(process.argv[2] ?? 200);
const t0 = performance.now();
runSim(n, () => [0, 1, 2, 3].map(() => new TimedCoach() as Bot), cfg, 11, rules);
const total = performance.now() - t0;
const row = (label: string, ms: number, calls: number) =>
  console.log(`  ${label.padEnd(10)} ${ms.toFixed(0).padStart(6)} ms total   ${(100 * ms / total).toFixed(1).padStart(5)}% of the run   ${calls} calls   ${(ms / Math.max(1, calls)).toFixed(3)} ms each`);
console.log(`${n} hands, ${(total / n).toFixed(2)} ms per hand\n`);
row('discards', t.discard, t.nDiscard);
row('claims', t.claim, t.nClaim);
row('self', t.self, t.nSelf);
row('elsewhere', total - t.discard - t.claim - t.self, 0);
