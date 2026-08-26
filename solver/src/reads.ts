/* AUTO-GENERATED from web/public/reads/money.json - do not edit by hand.
 * Measured opponent reads: 574,775 sampled decisions over 25,000 hands of run "run-money".
 *   dangerSafe: P(this discard deals in) keyed "<class>|<turn>|<fresh|seen>" - a tile already on the
 *     floor is far safer, which is the whole reason the discard pool is worth reading.
 *   ready: P(an opponent is ready) keyed "<exposed melds>|<turn>" - how much to fear them at all.
 */
export const READS = {
  dangerSafe: {"terminal|0|fresh":0.000058,"simple|0|fresh":0.000114,"honour|0|fresh":0.000029,"honour|0|seen":0,"terminal|10|seen":0.00068,"simple|10|fresh":0.00232,"honour|10|fresh":0.000287,"terminal|10|fresh":0.001177,"honour|10|seen":0.000031,"simple|10|seen":0.001801,"terminal|20|seen":0.002796,"simple|20|fresh":0.010306,"simple|20|seen":0.006259,"honour|20|seen":0.000364,"simple|30|fresh":0.021649,"simple|30|seen":0.012247,"terminal|30|seen":0.006008,"honour|30|seen":0.000579,"honour|40|seen":0.001604,"simple|40|fresh":0.030713,"simple|40|seen":0.017495,"terminal|40|seen":0.008161,"honour|50|seen":0.002143,"simple|50|seen":0.017506,"simple|50|fresh":0.034729,"terminal|50|seen":0.009045,"simple|60|fresh":0.032356,"simple|60|seen":0.014072,"terminal|60|seen":0.008242,"honour|60|seen":0.003146,"simple|0|seen":0.000228,"terminal|20|fresh":0.005842,"terminal|30|fresh":0.012167,"terminal|40|fresh":0.019538,"terminal|60|fresh":0.027648,"honour|20|fresh":0.002429,"honour|60|fresh":0.013312,"terminal|0|seen":0,"honour|40|fresh":0.00762,"honour|50|fresh":0.009265,"terminal|50|fresh":0.022642,"honour|30|fresh":0.004165} as Record<string, number>,
  danger: {"terminal|0":0.000055,"simple|0":0.000117,"honour|0":0.000025,"terminal|10":0.001059,"simple|10":0.002249,"honour|10":0.000194,"terminal|20":0.00457,"simple|20":0.009215,"honour|20":0.001351,"simple|30":0.018006,"terminal|30":0.008828,"honour|30":0.001964,"honour|40":0.003425,"simple|40":0.023934,"terminal|40":0.012099,"honour|50":0.003754,"simple|50":0.023876,"terminal|50":0.012419,"simple|60":0.018346,"terminal|60":0.011036,"honour|60":0.004536} as Record<string, number>,
  ready: {"0|0":0.000501,"0|10":0.005853,"1|10":0.021562,"0|20":0.02012,"1|20":0.051464,"0|30":0.039049,"1|30":0.075596,"2|30":0.162387,"0|40":0.048661,"1|40":0.090171,"2|40":0.168592,"3|40":0.395453,"0|50":0.048335,"2|50":0.13676,"3|50":0.360905,"0|60":0.032833,"2|60":0.081523,"3|60":0.304538,"1|60":0.04885,"2|10":0.079669,"2|20":0.131021,"3|30":0.408023,"1|50":0.080338,"1|0":0.004681,"3|10":0.350313,"3|20":0.379187,"2|0":0.035461} as Record<string, number>,
} as const;

/**
 * Turning the measured reads into numbers, in one place.
 *
 * Both the book coach (`rank.ts`) and the learned model (`policy.ts`) need these, and they must
 * agree: the coach prices danger into its ranking, and the model takes the same quantities as
 * features. Two copies of this arithmetic would drift.
 */
import { isHonour, isJoker, isTerminal, type TileKind } from 'sg-mahjong-engine';

const bucket = (turn: number) => Math.max(0, Math.min(60, Math.round(turn / 10) * 10));
const tileClass = (k: TileKind) => (isHonour(k) ? 'honour' : isTerminal(k) ? 'terminal' : 'simple');

/** P(throwing this tile deals in), given how late it is and whether the tile is already on the floor. */
export function dealInChance(k: TileKind, playerTurns: number, seenCopies: number): number {
  if (isJoker(k)) return 0;
  const t = bucket(playerTurns);
  const fresh = seenCopies === 0 ? 'fresh' : 'seen';
  return READS.dangerSafe[`${tileClass(k)}|${t}|${fresh}`] ?? READS.danger[`${tileClass(k)}|${t}`] ?? 0;
}

/**
 * How ready this table looks against a typical one at the same turn. 1 means average; a table with
 * three exposed sets everywhere runs high, a quiet one low. Clamped so one strange seat cannot
 * dominate the estimate.
 */
export function threatScale(opponentMelds: readonly number[] | undefined, playerTurns: number): number {
  if (!opponentMelds?.length) return 1;
  const t = bucket(playerTurns);
  const readyOf = (m: number) => READS.ready[`${Math.max(0, Math.min(3, m))}|${t}`] ?? 0;
  const here = opponentMelds.reduce((a, m) => a + readyOf(m), 0) / opponentMelds.length;
  const typical = readyOf(0) * 0.55 + readyOf(1) * 0.3 + readyOf(2) * 0.12 + readyOf(3) * 0.03;
  return typical > 1e-9 ? Math.max(0.25, Math.min(4, here / typical)) : 1;
}
