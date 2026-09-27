/**
 * Friends' records, read in from the files they send.
 *
 * Nothing leaves a phone by itself: a friend presses "Send my record", the file reaches Changs by
 * whatever they use, and he reads it in here under a name he types. It is kept apart from his own
 * record in every way - its own key, never merged, never scheduled - and what the screen shows of
 * it is a summary: hands played, mistakes and how many are sorted, drill answers, the cause that
 * keeps coming up, and when the file was made. That is the whole of "did my friends use it" for
 * now (`A-007`); if it turns out to be worth more than that, the next step is a record that is
 * posted somewhere, which needs somewhere to post to.
 */
import { parseBackup, summarise, type Backup } from './backup';
import { causeLabel, type Cause } from 'sg-mahjong-solver';

const KEY = 'mj.friends.v1';

export interface Friend {
  name: string;
  /** when the friend's file was written, from the file */
  savedAt: string;
  /** when Changs read it in */
  addedAt: string;
  played: number; mistakes: number; sorted: number; spotAnswered: number;
  /** the cause named most often among the sorted mistakes, in the app's words, or null */
  leadingCause: string | null;
  /** the file itself, kept so a later screen can show more than the summary */
  backup: Backup;
}

export function readFriends(): Friend[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Friend[]) : []; } catch { return []; }
}
function writeFriends(fs: Friend[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(fs)); } catch { /* private window: the list is shown but not kept */ }
}

/** the cause that keeps coming up in a record, or null when nothing is sorted */
export function leadingCauseOf(b: Backup): string | null {
  const ms = (b.data['mj.mistakes.v1'] as { cause?: Cause }[] | undefined) ?? [];
  const tally = new Map<Cause, number>();
  for (const m of ms) if (m.cause) tally.set(m.cause, (tally.get(m.cause) ?? 0) + 1);
  let best: Cause | null = null, n = 0;
  for (const [c, k] of tally) if (k > n) { best = c; n = k; }
  return best ? causeLabel(best) : null;
}

/** Read a friend's file in under a name. A second file under the same name replaces the first. */
export function addFriend(name: string, text: string): { ok: true; friend: Friend; error?: undefined } | { ok: false; error: string; friend?: undefined } {
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'a name is needed, so the record has someone to belong to' };
  const p = parseBackup(text);
  if (!p.ok) return { ok: false, error: p.error };
  const s = summarise(p.backup);
  const friend: Friend = {
    name: clean, savedAt: p.backup.savedAt, addedAt: new Date().toISOString(),
    played: s.played, mistakes: s.mistakes, sorted: s.sorted, spotAnswered: s.spotAnswered,
    leadingCause: leadingCauseOf(p.backup), backup: p.backup,
  };
  const rest = readFriends().filter((f) => f.name !== clean);
  writeFriends([...rest, friend].sort((a, b) => a.name.localeCompare(b.name)));
  return { ok: true, friend };
}

export function removeFriend(name: string): void {
  writeFriends(readFriends().filter((f) => f.name !== name));
}
