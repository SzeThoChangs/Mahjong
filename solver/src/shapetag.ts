/**
 * Which of the book's shape tips, if any, is the point of THIS decision.
 *
 * `shapes.ts` teaches the tips on hands we made up. That is the wrong way round for practice: a
 * question that announces "this one is about the pair rule" has already answered the hardest part,
 * which is noticing that the pair rule is what you are looking at. So the quiz shows a real position
 * with nothing attached, and a tip is named only AFTERWARDS, when the answer is revealed.
 *
 * For that to happen the pack has to know which positions are about which tip, and that is this
 * file. Each detector below reads a hand and returns a call: the tip, the discards that follow it,
 * the discards that go against it, and one sentence about these particular tiles. A position counts
 * as being ABOUT a tip only when both sides of the call are legal throws - if the tempting mistake
 * is not even available, the tip is not what the question turns on.
 *
 * WHAT IT DOES NOT DO. It never says the tip is right. Whether the tip's tile is also the measured
 * best answer is a separate question, and the graded pack can answer it position by position, which
 * is a stronger test of the book than any of the counting in `shapes.ts`. Keeping the two apart is
 * the whole point: this file spots the shape, the play-outs judge it.
 *
 * Four tips are spotted here and the other fifteen are not. These four are the ones a machine can
 * see without ambiguity. `five_blocks` and `six_blocks_ok` need a block decomposition to be agreed
 * on before they mean anything, and `narrow_can_beat_wide` needs the hand scored for tai; those are
 * jobs for later rather than things to guess at.
 */
import { isHonour, isJoker, isSuited, rankOf, shanten, type TileKind } from 'sg-mahjong-engine';
import { ukeire } from './shapes.js';

export interface ShapeCall {
  /** the id of the card in SHAPE_TIPS */
  tip: string;
  /** throws that follow the tip */
  says: TileKind[];
  /** throws it warns against - the tempting ones */
  against: TileKind[];
  /** one sentence about these tiles, in the tip's own terms */
  because: string;
}

const SUIT = ['萬', '筒', '條'];
const name = (k: TileKind) => (isSuited(k) ? `${rankOf(k)}${SUIT[Math.floor(k / 9)]}` : ['東', '南', '西', '北', '中', '發', '白'][k - 27]!);

const countsOf = (tiles: TileKind[]) => {
  const c = new Array<number>(34).fill(0);
  for (const k of tiles) if (k < 34) c[k]! += 1;
  return c;
};
const suitBase = (k: TileKind) => k - (k % 9);
/** other tiles of the same suit within two ranks, ignoring the kinds named in `blind` */
function neighbours(c: number[], k: TileKind, blind: TileKind[] = []): number {
  if (!isSuited(k)) return 0;
  const base = suitBase(k), r = rankOf(k);
  let n = 0;
  for (let d = -2; d <= 2; d++) {
    if (d === 0) continue;
    const r2 = r + d;
    if (r2 < 1 || r2 > 9) continue;
    const x = (base + r2 - 1) as TileKind;
    if (!blind.includes(x)) n += c[x]!;
  }
  return n;
}
/** single tiles with nothing near them: the spares a hand throws first */
function spares(c: number[]): TileKind[] {
  const out: TileKind[] = [];
  for (let k = 0 as TileKind; k < 34; k++) {
    if (c[k] !== 1) continue;
    if (isHonour(k) || neighbours(c, k) === 0) out.push(k);
  }
  return out;
}

/**
 * The tips this position is about.
 *
 * `concealed` is the hand in the player's own tiles including the one just drawn, and `melds` the
 * number of sets already exposed. A hand holding a joker or a bonus tile is not tagged at all: every
 * tip here is about ordinary tile shape, and a wildcard makes the shape mean something else.
 */
export function shapeCalls(concealed: TileKind[], melds: number): ShapeCall[] {
  if (concealed.some((k) => isJoker(k) || k >= 34)) return [];
  const c = countsOf(concealed);
  const distinct = [...new Set(concealed)];
  const loose = spares(c);
  const calls: ShapeCall[] = [];

  // threes_and_sevens: two loose tiles, and the tip picks between them
  const suitedLoose = loose.filter(isSuited);
  const edgey = suitedLoose.filter((k) => rankOf(k) === 3 || rankOf(k) === 7);
  const middling = suitedLoose.filter((k) => rankOf(k) >= 4 && rankOf(k) <= 6);
  if (edgey.length && middling.length) {
    calls.push({
      tip: 'threes_and_sevens', says: middling, against: edgey,
      because: `${name(edgey[0]!)} and ${name(middling[0]!)} are both loose tiles. The ${rankOf(edgey[0]!)} grows into a wait that reaches the edge, where tiles come out; the ${rankOf(middling[0]!)} grows into a wait in the middle, where they do not.`,
    });
  }

  // triplet_adjacency: a spare sitting beside your own triplet, against a spare sitting elsewhere
  for (let k = 0 as TileKind; k < 34; k++) {
    if (c[k]! < 3 || !isSuited(k)) continue;
    const beside = distinct.filter((x) => isSuited(x) && c[x] === 1 && suitBase(x) === suitBase(k)
      && Math.abs(rankOf(x) - rankOf(k)) <= 2 && neighbours(c, x, [k]) === 0);
    const elsewhere = loose.filter((x) => !beside.includes(x));
    if (beside.length && elsewhere.length) {
      calls.push({
        tip: 'triplet_adjacency', says: beside, against: elsewhere,
        because: `You hold three ${name(k)} yourself, so the ${name(beside[0]!)} next to them has fewer tiles left to grow with than ${name(elsewhere[0]!)} has.`,
      });
    }
  }

  // pair_rule: three pairs and something loose, so the choice is break one or keep them all
  const pairs = distinct.filter((k) => c[k] === 2);
  if (pairs.length >= 3 && loose.length) {
    calls.push({
      tip: 'pair_rule', says: pairs, against: loose,
      because: `Three pairs — ${pairs.slice(0, 3).map(name).join(', ')} — and they all finish the same way, on the two copies left. The tip breaks one rather than throwing a tile that could still become a run.`,
    });
  }

  // escape_single_waits: more than one way to stay ready, and the widths are not close
  const ready = distinct
    .map((k) => { const rest = concealed.filter((_, i) => i !== concealed.indexOf(k)); return { k, rest }; })
    .filter(({ rest }) => shanten(rest, melds) === 0)
    .map(({ k, rest }) => ({ k, width: ukeire(rest, melds).count }));
  if (ready.length >= 2) {
    const widest = Math.max(...ready.map((r) => r.width)), narrowest = Math.min(...ready.map((r) => r.width));
    if (narrowest <= 4 && widest >= 2 * narrowest) {
      calls.push({
        tip: 'escape_single_waits', says: ready.filter((r) => r.width === widest).map((r) => r.k),
        against: ready.filter((r) => r.width === narrowest).map((r) => r.k),
        because: `Two ways to stay ready. Throwing ${name(ready.find((r) => r.width === widest)!.k)} leaves you waiting on ${widest} tiles; throwing ${name(ready.find((r) => r.width === narrowest)!.k)} leaves ${narrowest}.`,
      });
    }
  }

  return calls;
}

/**
 * The calls that this position can actually pose, given the throws on offer.
 *
 * A tip is only the point of a question when the player could follow it AND could go against it. If
 * every throw the tip warns about has already been made, or the tile it points at is not in the
 * hand, naming the tip afterwards teaches nothing about the decision that was in front of them.
 */
export function liveCalls(concealed: TileKind[], melds: number, options: TileKind[]): ShapeCall[] {
  const on = new Set(options);
  return shapeCalls(concealed, melds).filter((c) => c.says.some((k) => on.has(k)) && c.against.some((k) => on.has(k)));
}
