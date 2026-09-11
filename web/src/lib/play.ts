/**
 * Every hand played on the Play tab, kept so it can be reviewed against the measured best.
 *
 * PLAN.md is blunt about what a hand's result is worth: its standard deviation is two orders of
 * magnitude wider than the thing it would be measuring, so whether a hand won says nothing about
 * whether it was played well. What can be judged is each decision on its own, by the same
 * play-outs that grade the packs, and that needs the position exactly as it stood when the
 * decision was made. So this keeps the engine's own snapshot before every human decision, with
 * what was legal and what was chosen. A snapshot is a few kilobytes; a hand has twenty or so
 * decisions; twenty hands are a megabyte or two, which is the cap.
 *
 * The verdicts are written back as they are made, so a hand reopened later shows what was judged
 * and does not spend the play-outs twice.
 */
import type { DecisionKind, LegalAction, RulesConfig, Snapshot } from 'sg-mahjong-engine';
import type { PlayVerdict } from './rejudge';

export interface PlayDecision {
  /** the engine's turn counter when the decision was posed */
  turn: number;
  kind: DecisionKind;
  seat: number;
  /** the position before the decision, ground truth, as `GameState.snapshot()` returned it */
  snap: Snapshot;
  legal: LegalAction[];
  chosen: LegalAction;
  /** the judge's verdict, once it has been asked for */
  verdict?: PlayVerdict;
  /** how many actions the judge compared, of how many were legal */
  compared?: { judged: number; legal: number };
}

export interface PlayedHand {
  id: string;
  at: number;
  seat: number;
  dealer: number;
  prevailingWind: number;
  /** the table it was played at, kept with the hand so a later review judges under the same rules */
  rules: RulesConfig;
  result: {
    winner: number | null; selfDraw: boolean; discarder: number | null;
    fan: number | null; combination: string | null;
    /** every seat's chips at the end, in the table's money */
    chips: number[];
    playerTurns: number;
  };
  decisions: PlayDecision[];
}

const KEY = 'mj.play.v1';
/** twenty hands with their snapshots is a megabyte or two, which is as much of the browser's
 *  store as a prototype should take */
const CAP = 20;

export function readPlays(): PlayedHand[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PlayedHand[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function writePlays(list: PlayedHand[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch { /* a full store must not break the game */ }
}

/** Keep one finished hand, newest first. */
export function recordHand(h: PlayedHand): void {
  writePlays([h, ...readPlays().filter((x) => x.id !== h.id)]);
}

/** Write a verdict back onto a stored hand's decision, so it is there when the hand is reopened. */
export function noteVerdict(id: string, index: number, verdict: PlayVerdict, compared: { judged: number; legal: number }): void {
  const list = readPlays();
  const h = list.find((x) => x.id === id);
  const d = h?.decisions[index];
  if (!d) return;
  d.verdict = verdict; d.compared = compared;
  writePlays(list);
}

export function clearPlays(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
