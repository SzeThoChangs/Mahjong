/**
 * Every hand you have played, so one can be opened again and explained.
 *
 * The mistake record next door keeps only what went wrong, and it keeps it in order to ASK: a card
 * comes back showing the hand and nothing else, because recognising an answer feels like knowing it.
 * That is right for spaced review and useless for the other job, which is idea seven of the method -
 * find out what the right answer was and why it was right. A hand you got right leaves no trace at
 * all today, and the moment you tap for the next position the one you just played is gone.
 *
 * So this is the plain log. It keeps hands whether they went well or badly, newest first, and what
 * it is for is looking rather than testing: opening one shows the answer and the reasoning straight
 * away instead of holding them back.
 *
 * It costs almost nothing for the same reason the record does. A made-up hand is entirely determined
 * by its seed, and a pack hand lives in its pack, so an entry is a handful of numbers rather than a
 * position. Two hundred of them are a few tens of kilobytes.
 */
import type { Phase } from './mistakes';

/** How the hand was judged, which decides how much its verdict is worth. */
export type Judge = 'coach' | 'playouts';

export interface Play {
  /** `${source}:${key}:${at}` - unique per entry, since the same hand can be played twice */
  id: string;
  at: number;
  judge: Judge;
  /** a made-up hand: the seed and phase rebuild it exactly */
  seed?: number;
  phase?: Phase;
  /** a pack hand: the pack holds it */
  pack?: string;
  qid?: string;
  /** what you threw, and what the judge would have thrown */
  threw: number;
  best: number;
  /** the grade the tab gave it, in that tab's own words */
  verdict: string;
  /** chips given up, negative or zero */
  cost: number;
  right: boolean;
  /**
   * The verdict was challenged on fresh play-outs and did not hold: the fresh gap between the
   * pack's best and the throw, its standard error, and how many play-outs each got. Only written
   * when the original verdict charged a mistake and the fresh dice called it a coin flip or turned
   * it round, because that is the case where the log's own verdict is now known to overstate.
   */
  challenged?: Challenge;
}
export interface Challenge { gap: number; se: number; n: number; at: number }

const KEY = 'mj.history.v1';
/** Enough to look back over several sessions without the log ever being worth pruning by hand. */
const CAP = 200;

export function readHistory(): Play[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Play[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function writeHistory(list: Play[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch { /* a full disk must not break a drill */ }
}

/** Log one answered hand. Called for every hand, not only the ones that went wrong. */
export function recordPlay(p: Omit<Play, 'id' | 'at'>, now = Date.now()): void {
  const key = p.pack ? `${p.pack}:${p.qid}` : `${p.phase}:${p.seed}`;
  const entry: Play = { ...p, id: `${p.judge}:${key}:${now}`, at: now };
  writeHistory([entry, ...readHistory()]);
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Note a challenge against the most recent log entry for a pack question. */
export function challengePlay(pack: string, qid: string, c: Challenge): void {
  const list = readHistory();
  const p = list.find((x) => x.pack === pack && x.qid === qid);
  if (!p) return;
  p.challenged = c;
  writeHistory(list);
}
