/**
 * Shared plumbing for scoring a written-out rule against the graded positions in a quiz pack.
 *
 * `tiptest.ts` does this for the tips the shape tagger can name. `calltest.ts` and `discardtest.ts`
 * do it for the rules it cannot, by writing a filter per rule by hand. All three ask the same
 * question - of the positions this rule is about, how often is the measured best an action the rule
 * points at - and the scoring must be identical between them or the numbers cannot sit in the same
 * table, so it lives here.
 *
 * THE BASELINE IS THE MEASUREMENT. Two corrections, and everything here exists to keep them:
 *
 *  - Only positions the rule RESOLVES count: the measured best is either an action it points at or
 *    one it warns against. A best it had no opinion on is not evidence either way.
 *  - The coin is the rule's own share of the choice in that position, not 50% assumed.
 *
 * And a third that `calltest.ts` learned the hard way on 2026-09-05: a rule of the form "do X rather
 * than Y" has to be read against how often X wins with no condition at all. Calling beats passing
 * 72% of the time in these packs, so a calling rule scoring 80% against a 50% coin is below average.
 * Every tool built on this must carry its own unconditional control arms.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { shanten, isJoker, type TileKind } from 'sg-mahjong-engine';

export interface PackAction { a: string; ev: number; se: number; win: number; dealin: number; draw: number; n: number }
export interface PackQ {
  k: string; seat: number; dl: number; w: number; t: number; fih: number;
  h: number[]; dr: number | null; b: number[]; m: number[][];
  ld?: [number, number]; disc: number[][]; pm: number[][][]; pb: number[][];
  actions: PackAction[]; best: string; sel: string; n: number; tp?: string[];
}

/** A rule's opinion about one position: the actions it points at, and the ones it warns against. */
export interface Split { says: string[]; against: string[] }
export interface Arm<C> { note: string; f: (q: PackQ, c: C) => Split | null }

export const without = (hand: TileKind[], takes: TileKind[]) => {
  const rest = [...hand];
  for (const k of takes) { const i = rest.indexOf(k); if (i >= 0) rest.splice(i, 1); }
  return rest;
};

/**
 * Copies of each kind nobody can still draw: your own hand, every meld on the table, and the
 * discards that were not claimed - a claimed discard is already counted inside somebody's meld.
 */
export function seenCounts(q: PackQ): Uint8Array {
  const seen = new Uint8Array(34);
  for (const k of q.h) if (k < 34) seen[k]!++;
  for (const seat of q.pm) for (const m of seat) for (const k of m.slice(2)) if (k < 34) seen[k]!++;
  for (const d of q.disc) if (d[2] === -1 && d[1]! < 34) seen[d[1]!]!++;
  return seen;
}

/** How many tiles can end this hand, counting only copies still out there. */
export function waitWidth(concealed: TileKind[], melds: number, seen: Uint8Array): number {
  let n = 0;
  for (let k = 0; k < 34; k++) {
    const left = 4 - seen[k]!;
    if (left <= 0) continue;
    if (shanten([...concealed, k], melds) === -1) n += left;
  }
  return n;
}

/**
 * Tiles that bring the hand closer, counted two ways.
 *
 * `raw` is the count every tile counter shows, which assumes every copy you are not holding is
 * still available. `live` subtracts the copies already on the table. The gap between them is what
 * `keep_floaters` is about.
 */
export function acceptance(concealed: TileKind[], melds: number, seen: Uint8Array): { raw: number; live: number; kinds: number } {
  const sh = shanten(concealed, melds);
  const held = new Map<TileKind, number>();
  for (const k of concealed) held.set(k, (held.get(k) ?? 0) + 1);
  let raw = 0, live = 0, kinds = 0;
  for (let k = 0; k < 34; k++) {
    const mine = held.get(k) ?? 0;
    if (mine >= 4) continue;
    if (shanten([...concealed, k], melds) >= sh) continue;
    raw += 4 - mine;
    live += Math.max(0, 4 - seen[k]!);
    kinds++;
  }
  return { raw, live, kinds };
}

/** Melds anyone else has on the table - the only commitment signal there is at this table. */
export const opponentMelds = (q: PackQ) => q.pm.map((ms, s) => (s === q.seat ? 0 : ms.length));

/** Seats holding at least `n` melds, which is how every card here says "committed". */
export const committedSeats = (q: PackQ, n: number) =>
  opponentMelds(q).map((c, s) => (c >= n ? s : -1)).filter((s) => s >= 0);

/** The seat that draws next, and the only one a discard can feed a chow to. */
export const nextSeat = (q: PackQ) => (q.seat + 1) % 4;

export const isSuited = (k: number) => k < 27;
export const suitOf = (k: number) => Math.floor(k / 9);

export interface Score {
  seen: number; resolved: number; follows: number;
  expected: number; variance: number;        // the flat coin: the rule's share of the choice
  expNull: number; varNull: number;          // the matched null: the same share, weighted by what each action is
}
const blank = (): Score => ({ seen: 0, resolved: 0, follows: 0, expected: 0, variance: 0, expNull: 0, varNull: 0 });

/**
 * A baseline that knows what a throw IS, without knowing anything a card could tell you.
 *
 * The flat coin asks how often a rule would be followed by picking at random between the actions it
 * points at and the ones it warns against. That is fair only if those actions were equally likely to
 * be best in the first place, and they are not: a spare tile is the measured best 69% of the time
 * against 24% by luck, and a throw that costs the hand no distance 85% against 34%. So a rule that
 * happens to point at spare tiles collects most of a finding for free, which is the confound
 * `tiptest.ts` warned about in words and nothing had measured.
 *
 * The fix is to fit P(this action is the measured best) from features a beginner could read off the
 * table - does the throw cost distance, is it a tile no block wants, is it an honour, a terminal or
 * a simple - and then use those as the weights in the same share. A rule that beats this baseline
 * knows something the shape of the choice does not already say. Fitted on the same packs it scores,
 * which is honest for a null: it can only make the null stronger and the rules harder to pass.
 */
export type NullModel = Map<string, number>;
export const featureKey = (costsDistance: boolean, loose: boolean, cls: string) => `${costsDistance ? 'cost' : 'keep'}|${loose ? 'spare' : 'block'}|${cls}`;
export const tileClass = (k: number) => (k >= 27 && k < 34 ? 'honour' : k < 27 && (k % 9 === 0 || k % 9 === 8) ? 'terminal' : 'simple');

export function fitNull(rows: { key: string; best: boolean }[]): NullModel {
  const n = new Map<string, number>(), hit = new Map<string, number>();
  for (const r of rows) { n.set(r.key, (n.get(r.key) ?? 0) + 1); if (r.best) hit.set(r.key, (hit.get(r.key) ?? 0) + 1); }
  const out: NullModel = new Map();
  for (const [k, c] of n) out.set(k, ((hit.get(k) ?? 0) + 0.5) / (c + 1));   // a half-count each way, so a rare bucket cannot read 0 or 1
  return out;
}

export function report(title: string, table: Map<string, Score>, width = 28) {
  console.log(`\n${title}`);
  console.log(`  ${'rule'.padEnd(width)} about  resolved   follows   by luck      z   matched      z   follows/resolved`);
  for (const [t, s] of [...table].sort((a, b) => b[1].seen - a[1].seen)) {
    if (!s.seen) continue;
    const rate = s.resolved ? s.follows / s.resolved : 0;
    const luck = s.resolved ? s.expected / s.resolved : 0, matched = s.resolved ? s.expNull / s.resolved : 0;
    const z = s.variance > 0 ? (s.follows - s.expected) / Math.sqrt(s.variance) : 0;
    const zn = s.varNull > 0 ? (s.follows - s.expNull) / Math.sqrt(s.varNull) : 0;
    const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
    const sig = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
    console.log(`  ${t.padEnd(width)}${String(s.seen).padStart(5)}  ${String(s.resolved).padStart(8)}   ${pct(rate).padStart(7)}  ${pct(luck).padStart(8)}  ${sig(z).padStart(5)}  ${pct(matched).padStart(8)}  ${sig(zn).padStart(5)}   ${s.follows}/${s.resolved}`);
  }
}

/**
 * Run every arm over every pack, per pack and pooled.
 *
 * `prepare` turns a question into whatever the arms need, and returning null drops the question -
 * that is where a tool says which decisions it is about at all.
 */
/** every quiz pack in a directory, as questions (the spotting pack is not one and is skipped) */
export function loadPacks(quizDir: string, only?: string): { file: string; questions: PackQ[] }[] {
  return readdirSync(quizDir)
    .filter((f) => f.endsWith('.json') && f !== 'index.json' && (!only || f === `${only}.json`))
    .map((f) => ({ file: f, questions: (JSON.parse(readFileSync(join(quizDir, f), 'utf8')) as { questions?: PackQ[] }).questions ?? [] }))
    .filter((p) => p.questions.length);
}

export function scorePacks<C>(opts: {
  quizDir: string; only?: string; arms: Record<string, Arm<C>>;
  prepare: (q: PackQ) => C | null;
  heading: (file: string, used: number, total: number) => string;
  width?: number;
  /** relative chance this action is the best one, knowing only what it is - see `fitNull` */
  weight?: (q: PackQ, c: C, action: string) => number;
}): Map<string, Score> {
  const files = readdirSync(opts.quizDir).filter((f) => f.endsWith('.json') && f !== 'index.json' && (!opts.only || f === `${opts.only}.json`));
  const pooled = new Map<string, Score>();
  let packsRead = 0;
  for (const f of files) {
    const pack = JSON.parse(readFileSync(join(opts.quizDir, f), 'utf8')) as { questions?: PackQ[] };
    if (!pack.questions) continue;   // the spotting pack lives in the same directory and is not a quiz
    packsRead++;
    const st = new Map<string, Score>();
    let used = 0, total = 0;
    for (const q of pack.questions) {
      total++;
      const ctx = opts.prepare(q);
      if (ctx === null) continue;
      used++;
      for (const [name, arm] of Object.entries(opts.arms)) {
        const split = arm.f(q, ctx);
        if (!split || !split.says.length || !split.against.length) continue;
        const s = st.get(name) ?? blank(), g = pooled.get(name) ?? blank();
        s.seen++; g.seen++;
        const hit = split.says.includes(q.best), miss = split.against.includes(q.best);
        if (hit || miss) {
          const p = split.says.length / (split.says.length + split.against.length);
          let pn = p;
          if (opts.weight) {
            const wSay = split.says.reduce((a, x) => a + opts.weight!(q, ctx, x), 0);
            const wAll = wSay + split.against.reduce((a, x) => a + opts.weight!(q, ctx, x), 0);
            if (wAll > 0) pn = wSay / wAll;
          }
          for (const x of [s, g]) {
            x.resolved++; x.follows += hit ? 1 : 0;
            x.expected += p; x.variance += p * (1 - p);
            x.expNull += pn; x.varNull += pn * (1 - pn);
          }
        }
        st.set(name, s); pooled.set(name, g);
      }
    }
    report(opts.heading(f, used, total), st, opts.width);
  }
  if (packsRead > 1) report('pooled over both packs - the number to quote', pooled, opts.width);
  console.log('\nfilters:');
  for (const [name, arm] of Object.entries(opts.arms)) console.log(`  ${name.padEnd(opts.width ?? 28)}${arm.note}`);
  return pooled;
}

export { shanten, isJoker };
export type { TileKind };
