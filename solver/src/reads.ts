/* AUTO-GENERATED from web/public/reads/money.json - do not edit by hand.
 * Measured opponent reads: 413,964 sampled decisions over 25,000 hands of run "run-money3".
 *   dangerSafe: P(this discard deals in) keyed "<class>|<turn>|<fresh|seen>" - a tile already on the
 *     floor is far safer, which is the whole reason the discard pool is worth reading.
 *   ready: P(an opponent is ready) keyed "<exposed melds>|<turn>" - how much to fear them at all.
 */
export const READS = {
  dangerSafe: {"simple|0|fresh":0.000118,"terminal|0|fresh":1.2e-05,"honour|0|fresh":6e-06,"honour|0|seen":0,"terminal|0|seen":0,"simple|0|seen":0.000124,"terminal|10|fresh":0.000904,"simple|10|fresh":0.001497,"honour|10|fresh":0.000188,"honour|10|seen":6.8e-05,"terminal|10|seen":0.000398,"simple|10|seen":0.000866,"simple|20|fresh":0.006459,"simple|20|seen":0.003703,"honour|20|fresh":0.001007,"terminal|20|seen":0.002275,"terminal|20|fresh":0.003645,"honour|20|seen":9e-05,"terminal|30|seen":0.003554,"honour|30|seen":0.000233,"simple|30|fresh":0.012424,"simple|30|seen":0.007215,"honour|30|fresh":0.002281,"terminal|30|fresh":0.006804,"honour|40|seen":0.000638,"simple|40|fresh":0.015908,"simple|40|seen":0.009744,"terminal|40|seen":0.005393,"honour|40|fresh":0.004027,"terminal|40|fresh":0.011211,"honour|50|seen":0.000934,"simple|50|fresh":0.016994,"simple|50|seen":0.00885,"terminal|50|seen":0.003944,"honour|50|fresh":0.006178,"simple|60|seen":0.006805,"terminal|60|seen":0.004192,"honour|60|seen":0.001315,"simple|60|fresh":0.014767,"honour|60|fresh":0.007565,"terminal|50|fresh":0.011331,"terminal|60|fresh":0.01138} as Record<string, number>,
  danger: {"simple|0":0.000118,"terminal|0":1.1e-05,"honour|0":5e-06,"terminal|10":0.000787,"simple|10":0.001414,"honour|10":0.000144,"simple|20":0.005739,"honour|20":0.000534,"terminal|20":0.00309,"terminal|30":0.005096,"honour|30":0.001036,"simple|30":0.010469,"honour|40":0.001699,"simple|40":0.012839,"terminal|40":0.007538,"honour|50":0.002211,"simple|50":0.011974,"terminal|50":0.00598,"simple|60":0.00875,"terminal|60":0.005391,"honour|60":0.00224} as Record<string, number>,
  ready: {"0|0":0.002901,"0|10":0.023768,"1|10":0.061077,"0|20":0.065427,"1|20":0.12518,"1|30":0.167382,"0|30":0.099709,"1|40":0.181954,"2|40":0.287412,"1|50":0.156481,"2|50":0.248881,"1|60":0.110996,"2|60":0.172611,"3|60":0.38843,"1|0":0.018011,"0|40":0.113225,"0|50":0.094273,"2|20":0.243839,"2|30":0.283567,"3|40":0.51134,"3|50":0.459607,"2|0":0.070376,"2|10":0.168972,"3|10":0.424757,"0|60":0.068051,"3|20":0.5179,"3|30":0.522467} as Record<string, number>
} as const;

/**
 * Turning the measured reads into numbers, in one place.
 *
 * Both the book coach (`rank.ts`) and the learned model (`policy.ts`) need these, and they must
 * agree: the coach prices danger into its ranking, and the model takes the same quantities as
 * features. Two copies of this arithmetic would drift.
 */
import { isHonour, isJoker, isTerminal, type TileKind } from 'sg-mahjong-engine';

/** The shape of a reads table, so an alternative one can be played against the shipped one.
 *  `Context.reads` carries it; everything defaults to READS, which is what the coach uses. */
export interface ReadsTables { dangerSafe: Record<string, number>; danger: Record<string, number>; ready: Record<string, number> }

const bucket = (turn: number) => Math.max(0, Math.min(60, Math.round(turn / 10) * 10));
const tileClass = (k: TileKind) => (isHonour(k) ? 'honour' : isTerminal(k) ? 'terminal' : 'simple');

/** P(throwing this tile deals in), given how late it is and whether the tile is already on the floor. */
export function dealInChance(k: TileKind, playerTurns: number, seenCopies: number, R: ReadsTables = READS): number {
  if (isJoker(k)) return 0;
  const t = bucket(playerTurns);
  const fresh = seenCopies === 0 ? 'fresh' : 'seen';
  return R.dangerSafe[`${tileClass(k)}|${t}|${fresh}`] ?? R.danger[`${tileClass(k)}|${t}`] ?? 0;
}

/**
 * How ready this table looks against a typical one at the same turn. 1 means average; a table with
 * three exposed sets everywhere runs high, a quiet one low. Clamped so one strange seat cannot
 * dominate the estimate.
 */
export function threatScale(opponentMelds: readonly number[] | undefined, playerTurns: number, R: ReadsTables = READS): number {
  if (!opponentMelds?.length) return 1;
  const t = bucket(playerTurns);
  const readyOf = (m: number) => R.ready[`${Math.max(0, Math.min(3, m))}|${t}`] ?? 0;
  const here = opponentMelds.reduce((a, m) => a + readyOf(m), 0) / opponentMelds.length;
  const typical = readyOf(0) * 0.55 + readyOf(1) * 0.3 + readyOf(2) * 0.12 + readyOf(3) * 0.03;
  return typical > 1e-9 ? Math.max(0.25, Math.min(4, here / typical)) : 1;
}

/**
 * The chance the MOST advanced opponent is ready, straight off the measured table.
 *
 * `threatScale` answers "is this table busier than usual", which prices a discard. Folding needs a
 * different question - "is somebody actually about to win" - and that is an absolute probability,
 * not a ratio. Three exposed sets at turn 40 is 39.5%; nothing exposed at turn 20 is 2.0%.
 */
export function maxReadyChance(opponentMelds: readonly number[] | undefined, playerTurns: number, R: ReadsTables = READS): number {
  if (!opponentMelds?.length) return 0;
  const t = bucket(playerTurns);
  let mx = 0;
  for (const m of opponentMelds) mx = Math.max(mx, R.ready[`${Math.max(0, Math.min(3, m))}|${t}`] ?? 0);
  return mx;
}
