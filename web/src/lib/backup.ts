/**
 * Your training, in one file you can keep.
 *
 * Everything the app remembers lives in this browser's localStorage and nowhere else - which is
 * private, costs nothing to run, and means a cleared cache takes a month of records with it. The
 * mistake record is the part of the method the others hang off: a card is met again after a day,
 * three days, a week, two weeks and a month, so losing it in week three loses the work, not just
 * the file.
 *
 * Export writes every key. Restore puts them back. There is no server and no account, so this is
 * the whole of the backup story, and it is also how the record moves between two machines.
 */
export const KEYS = ['mj.mistakes.v1', 'mj.spot.v1', 'mj.spotcause.v1', 'mj.practise.v1', 'mj.history.v1'] as const;
export type Key = typeof KEYS[number];

export interface Backup { app: 'which-tile'; version: 1; savedAt: string; data: Partial<Record<Key, unknown>> }

/** What is in the file, said in the plain words the buttons use. */
export function summarise(b: Backup): { mistakes: number; sorted: number; spotAnswered: number; spotMisses: number; played: number } {
  const ms = (b.data['mj.mistakes.v1'] as { cause?: string }[] | undefined) ?? [];
  const spot = (b.data['mj.spot.v1'] as Record<string, { n: number; right: number }> | undefined) ?? {};
  const causes = (b.data['mj.spotcause.v1'] as Record<string, Record<string, number>> | undefined) ?? {};
  return {
    played: ((b.data['mj.history.v1'] as unknown[] | undefined) ?? []).length,
    mistakes: ms.length,
    sorted: ms.filter((m) => !!m.cause).length,
    spotAnswered: Object.values(spot).reduce((a, c) => a + (c?.n ?? 0), 0),
    spotMisses: Object.values(causes).reduce((a, k) => a + Object.values(k ?? {}).reduce((x, n) => x + (n ?? 0), 0), 0),
  };
}

export function readBackup(): Backup {
  const data: Partial<Record<Key, unknown>> = {};
  for (const k of KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (raw === null) continue;
      // the practise key is a bare string; the rest are JSON
      data[k] = k === 'mj.practise.v1' ? raw : JSON.parse(raw);
    } catch { /* a key we cannot read is a key we do not write */ }
  }
  return { app: 'which-tile', version: 1, savedAt: new Date().toISOString(), data };
}

/** Hand the file to the browser. Named by the day, so two exports do not overwrite each other. */
export function downloadBackup(): { mistakes: number } {
  const b = readBackup();
  const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `which-tile-${b.savedAt.slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { mistakes: summarise(b).mistakes };
}

/**
 * Put a file back. Replaces what is here rather than merging, because a merge has to decide what
 * happens when the same card is at step 2 in one copy and step 4 in the other, and quietly guessing
 * at that would corrupt the one thing the schedule depends on. The caller asks first and says what
 * is about to be overwritten.
 */
type Summary = ReturnType<typeof summarise>;
/**
 * Why each half also carries the other's keys as optional.
 *
 * This is a discriminated union and `if (r.ok)` ought to be enough to tell the halves apart. It is
 * not here: the project's tsconfig has no `strict`, and without `strictNullChecks` TypeScript
 * declines to narrow on the discriminant, so reading `r.error` after checking `r.ok` is an error.
 * Declaring the absent keys as optional-undefined makes both reads legal while `ok` still says which
 * case you are in. The better fix is `strict`, which is a job of its own rather than one squeezed
 * into a deploy.
 */
export type RestoreResult =
  | { ok: true; was: Summary; now: Summary; error?: undefined }
  | { ok: false; error: string; was?: undefined; now?: undefined };

export function restoreBackup(text: string): RestoreResult {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'that file is not JSON' }; }
  const b = parsed as Backup;
  if (!b || typeof b !== 'object' || b.app !== 'which-tile' || !b.data) return { ok: false, error: 'that is not a Which tile? export' };
  if (b.version !== 1) return { ok: false, error: `that file is version ${String(b.version)} and this app reads version 1` };
  const was = summarise(readBackup());
  try {
    for (const k of KEYS) {
      const v = b.data[k];
      if (v === undefined) { localStorage.removeItem(k); continue; }
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  } catch { return { ok: false, error: 'this browser would not let the app write to storage' }; }
  return { ok: true, was, now: summarise(b) };
}
