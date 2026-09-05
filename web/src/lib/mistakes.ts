/**
 * The mistake record, and when each one comes back.
 *
 * This is the fifth part of the training system in CLAUDE.md and the app had none of it. The score
 * on the Train tab lived in React state, so every mistake you have ever made was forgotten the
 * moment you refreshed the page. Practising and then discarding the evidence is the one thing the
 * method says not to do: the research behind this whole project is that spaced RETRIEVAL is what
 * makes something stick, and a mistake you never meet again is a mistake you keep making.
 *
 * A record is tiny because a scenario is entirely determined by its seed - `makeScenario(seed,
 * phase, ...)` rebuilds the identical hand, table and discard pool. So we store the seed and what
 * you threw, not the position, and a thousand mistakes cost a few tens of kilobytes.
 *
 * THE INTERVALS ARE THE ONES THE METHOD SPECIFIES: a day, three days, a week, two weeks, a month.
 * Get it right and it moves to the next one. Get it wrong and it goes back to the start, because a
 * mistake you have just repeated is not one you are half way through learning.
 *
 * And the review must ask, never remind. It shows the hand and nothing else - not your old answer,
 * not the coach's - because recognising an answer you have seen feels like knowing it and is not
 * the same thing. You redo the thinking or the review is worth nothing.
 */
import type { TileKind } from 'sg-mahjong-engine';
import type { Cause } from 'sg-mahjong-solver';

export type Phase = 'early' | 'mid' | 'late' | 'any';

export interface Mistake {
  /** seed + phase rebuild the exact position */
  id: string;
  seed: number;
  phase: Phase;
  /** what you threw the first time, and what the coach threw */
  picked: TileKind;
  coachPick: TileKind;
  verdict: 'mistake' | 'blunder';
  /** what it cost, in chips, against the coach's pick */
  cost: number;
  /** the coach's one-line reason for its own tile, kept so the review can explain without recomputing */
  why: string;
  /**
   * WHY it happened, which is the method's eighth idea and the only thing that says what to
   * practise. `suggested` is what the coach's ranking and the shape tips could read off the
   * position; `cause` is what you said when asked. Older records have neither and count as unsorted.
   */
  cause?: Cause;
  suggested?: Cause | null;
  /** the tip the throw broke, when that was the evidence */
  tip?: string;
  firstSeen: number;
  /** how far through the schedule: 0 = due tomorrow, 5 = finished */
  step: number;
  due: number;
  /** how many times it has been met again, and how many of those went right */
  seen: number;
  right: number;
}

/** a day, three days, a week, two weeks, a month */
export const INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
const DAY = 24 * 60 * 60 * 1000;
const KEY = 'mj.mistakes.v1';

function read(): Mistake[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Mistake[]) : []; } catch { return []; }
}
function write(all: Mistake[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode or full: nothing useful to say */ }
}

export const allMistakes = (): Mistake[] => read();

/** Mistakes ready to be met again, oldest due first. */
export function dueMistakes(now = Date.now()): Mistake[] {
  return read().filter((m) => m.step < INTERVALS_DAYS.length && m.due <= now).sort((a, b) => a.due - b.due);
}

/** Everything still in the schedule, whether or not it is due yet. */
export const openMistakes = (): Mistake[] => read().filter((m) => m.step < INTERVALS_DAYS.length);

export function recordMistake(m: Omit<Mistake, 'id' | 'firstSeen' | 'step' | 'due' | 'seen' | 'right'>, now = Date.now()): void {
  const all = read();
  const id = `${m.phase}:${m.seed}`;
  // meeting the same position again does not create a second entry - it is the same mistake
  if (all.some((x) => x.id === id)) return;
  all.push({ ...m, id, firstSeen: now, step: 0, due: now + INTERVALS_DAYS[0]! * DAY, seen: 0, right: 0 });
  write(all);
}

/**
 * Answer a review. Right moves it on; wrong sends it back to the start.
 *
 * Sending it back is deliberate. The point is not to clear the list, it is to stop making the
 * mistake, and a position you have just got wrong for the second time is not one you are most of
 * the way through learning.
 */
export function reviewed(id: string, right: boolean, now = Date.now()): void {
  const all = read();
  const m = all.find((x) => x.id === id);
  if (!m) return;
  m.seen++;
  if (right) { m.right++; m.step++; } else { m.step = 0; }
  m.due = now + (INTERVALS_DAYS[Math.min(m.step, INTERVALS_DAYS.length - 1)]! * DAY);
  write(all);
}

/** What you said the mistake was, at the moment of making it - or later, from the review. */
export function setCause(id: string, cause: Cause): void {
  const all = read();
  const m = all.find((x) => x.id === id);
  if (!m) return;
  m.cause = cause;
  write(all);
}

/**
 * The diagnosis: how many of your mistakes fall under each cause. Counted over everything ever
 * recorded rather than what is still due, because the question is which cause keeps coming up,
 * and a mistake that has been worked through still happened for a reason.
 */
export function causeTally(): { cause: Cause | 'unsorted'; n: number }[] {
  const t = new Map<Cause | 'unsorted', number>();
  for (const m of read()) { const c = m.cause ?? 'unsorted'; t.set(c, (t.get(c) ?? 0) + 1); }
  return [...t].map(([cause, n]) => ({ cause, n })).sort((a, b) => b.n - a.n);
}

export function forget(id: string): void {
  write(read().filter((m) => m.id !== id));
}

/** "how long ago", for a timestamp in the past: "earlier today", "yesterday", "5 days ago". */
export function howLongAgo(then: number, now = Date.now()): string {
  const days = Math.floor((now - then) / DAY);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** "in 3 days", "today", "tomorrow" - for telling you when something comes back. */
export function whenDue(due: number, now = Date.now()): string {
  const days = Math.round((due - now) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
