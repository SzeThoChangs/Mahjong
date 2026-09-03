/**
 * Build the pack the spotting drill plays from.
 *
 *   tsx src/spotpack.ts [--pack ../web/public/quiz/coach.json] [--out ../web/public/quiz/spot.json] [--n 1000]
 *
 * WHY A SEPARATE PACK. The Real quiz pack is 10MB, because every question carries the play-out
 * result of every legal move. A spotting drill needs none of that: it asks what is IN the position,
 * not what to do about it, so the answer is a property of the hand and the table rather than a
 * measured EV. Stripping to what the drill renders and pre-computing the answers gives a file the
 * drill can load in one go without a second ten-megabyte download.
 *
 * WHAT SPOTTING IS FOR. `CLAUDE.md` asks for five components and the app has four. The missing one
 * is the drill where a position is shown for a few seconds and then taken away, and the question is
 * what was going on in it. That trains seeing, which the research says is a separate skill from
 * solving - a strong player's advantage is that a position arrives already sorted into a few
 * familiar things, not that they calculate faster.
 *
 * THE ANSWERS ARE PROPERTIES, NOT OPINIONS. Every question here has one right answer that follows
 * from the tiles, so the drill never marks a judgement call wrong:
 *
 *   ready    how many tiles from ready the hand was, straight from the engine's own shanten
 *   suit     which suit the hand held most of, counting melds as the three tiles they are
 *   threat   which opponent had the most sets face up, which is the one visible threat signal
 *   shape    which shape the position was about, from the tips the tagger already found
 *
 * Positions where an answer would be ambiguous are dropped rather than guessed at: a tie for the
 * longest suit, a tie for the most exposed melds, or more than one shape tag in play.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { shanten } from 'sg-mahjong-engine';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; };
const packPath = arg('pack', '../web/public/quiz/coach.json');
const outPath = arg('out', '../web/public/quiz/spot.json');
const want = Number(arg('n', '1000'));

interface Q {
  tp?: string[]; id: string; k: string; seat: number; dl?: number; w: number; t: number; fih: number;
  h: number[]; dr: number | null; b: number[]; m: number[][];
  disc?: number[][]; pm?: number[][][]; pb?: number[][];
}
const pack = JSON.parse(readFileSync(packPath, 'utf8')) as { run: string; questions: Q[] };

/** Suit of a number tile: 0 = characters, 1 = dots, 2 = bamboo. Honours and bonus tiles have none. */
const suitOf = (k: number): number => (k < 27 ? Math.floor(k / 9) : -1);

interface Spot {
  id: string; seat: number; dl: number; w: number; t: number; fih: number;
  h: number[]; dr: number | null; b: number[]; m: number[][];
  disc: number[][]; pm: number[][][]; pb: number[][];
  /** tiles from ready: 0 is ready, 1 is one away, and so on */
  sh: number;
  /** the suit the hand holds most of, or -1 when two suits tie and the question would be unfair */
  suit: number;
  /** how many sets each seat has face up, indexed by offset from the player: [1] is the next to play */
  melds: number[];
  /** the offset of the seat with the most face-up sets, 0 when nobody has any, -1 when it ties */
  threat: number;
  /** the one shape tip in play, when the tagger found exactly one */
  tip: string | null;
}

const out: Spot[] = [];
let tied = 0, noPublic = 0;

for (const q of pack.questions) {
  // Claim questions are a decision about a tile somebody else threw; the drill asks about a position
  // the player is sitting in, so only discard positions are used.
  if (q.k !== 'discard' || !q.pm || !q.disc || !q.pb || q.dl === undefined) { noPublic++; continue; }

  const counts = [0, 0, 0];
  for (const k of q.h) { const s = suitOf(k); if (s >= 0) counts[s]!++; }
  for (const m of q.m) for (const k of m.slice(2)) { const s = suitOf(k); if (s >= 0) counts[s]!++; }
  const top = Math.max(...counts);
  const suit = counts.filter((c) => c === top).length === 1 && top > 0 ? counts.indexOf(top) : -1;

  // Face-up sets per seat, re-indexed as an offset from this player so the question can be asked as
  // "the player to your right" rather than "seat 3", which means nothing to somebody at a table.
  const melds = [0, 1, 2, 3].map((o) => (q.pm![(q.seat + o) % 4] ?? []).length);
  const most = Math.max(melds[1]!, melds[2]!, melds[3]!);
  const threat = most === 0 ? 0
    : [1, 2, 3].filter((o) => melds[o] === most).length === 1 ? [1, 2, 3].find((o) => melds[o] === most)!
    : -1;

  if (suit < 0 || threat < 0) { tied++; continue; }

  out.push({
    id: q.id, seat: q.seat, dl: q.dl, w: q.w, t: q.t, fih: q.fih,
    h: q.h, dr: q.dr, b: q.b, m: q.m, disc: q.disc, pm: q.pm, pb: q.pb,
    sh: Math.max(0, shanten(q.h, q.m.length)),
    suit, melds, threat,
    tip: q.tp && q.tp.length === 1 ? q.tp[0]! : null,
  });
}

// BALANCE THE ANSWER, or the drill teaches the wrong lesson. The quiz pack is built from decisions
// where the play-outs separated an answer, and those are mostly late, so half its positions are
// already ready. A drill drawn straight from it would reward answering "ready" every time without
// looking, which is the opposite of what a spotting drill is for. So the distance question is
// levelled by taking an equal quota from each answer, and inside a quota the positions that can
// also ask a shape question go first, because those are the scarce ones.
const shuffle = <T>(xs: T[]): T[] => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; };
const bucket = (s: Spot) => Math.min(3, s.sh);
const quota = Math.ceil(want / 4);
const chosen: Spot[] = [];
for (const b of [0, 1, 2, 3]) {
  const pool = out.filter((s) => bucket(s) === b);
  const withTip = shuffle(pool.filter((s) => s.tip)), without = shuffle(pool.filter((s) => !s.tip));
  chosen.push(...[...withTip, ...without].slice(0, quota));
}
shuffle(chosen);

writeFileSync(outPath, JSON.stringify({ run: pack.run, from: packPath.split('/').pop(), positions: chosen }));
const bytes = readFileSync(outPath).length;

const hist = (xs: number[]) => { const m = new Map<number, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}:${n}`).join('  '); };
console.log(`${pack.questions.length.toLocaleString()} questions in ${packPath}`);
console.log(`  ${noPublic.toLocaleString()} skipped as not a discard position or missing the public table`);
console.log(`  ${tied.toLocaleString()} skipped because the suit or the threat would have tied`);
console.log(`\n${chosen.length.toLocaleString()} positions written to ${outPath} (${(bytes / 1024).toFixed(0)} KB)`);
console.log(`  can ask a shape question: ${chosen.filter((s) => s.tip).length}`);
console.log(`  tiles from ready:  ${hist(chosen.map((s) => s.sh))}`);
console.log(`  longest suit:      ${hist(chosen.map((s) => s.suit))}   (0 characters, 1 dots, 2 bamboo)`);
console.log(`  biggest threat:    ${hist(chosen.map((s) => s.threat))}   (0 nobody, 1 next to play, 2 across, 3 before me)`);
