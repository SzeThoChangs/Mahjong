/**
 * Bots that decide nothing - they play back exactly what was recorded.
 *
 * Replaying a hand by asking the BOTS again welds a dataset to the exact bots that made it.
 * Measured on a coach-played run: turning off ONE coach rule, which changes a single discard in 180,
 * lost 17 of every 100 hands - a hand is around fifty decisions and one difference anywhere breaks
 * the hash for all of it. The 50 seconds of generation is not the loss; the seven hours of grading
 * that hangs off it is.
 *
 * `HandRecord.seq` is the whole hand as compact action strings, so replay needs no bot at all and a
 * run survives any future change to the coach.
 *
 * All four seats share one cursor. The engine consults them in the order the decisions were
 * recorded, and because the actions are identical the game unfolds identically, so cursor and engine
 * stay in step. The hash check in `decisionsOfHand` remains the guard - this is not trusted, it is
 * verified on every hand.
 */
import { kindOf, type Bot, type ClaimOption, type PlayerView, type SelfAction, type TileInstance } from 'sg-mahjong-engine';

class Cursor {
  i = 0;
  constructor(readonly seq: readonly string[]) {}
  next(): string | undefined { return this.seq[this.i++]; }
}

/** the same compact strings `records.ts` writes, so an option can be matched to what was recorded */
const encSelf = (o: SelfAction): string =>
  o.kind === 'win' ? 'win' : o.kind === 'kong4' ? `kong4:${kindOf(o.tiles[0]!)}` : `kong1:${kindOf(o.tile)}`;
/** A chow is recorded as the whole run it makes - `chow:5,6,7` - while the OPTION carries only the
 *  two tiles from hand, because the third comes off the discard. Put the claimed tile back in and
 *  sort, or every chow in the run fails to match. */
const encClaim = (o: ClaimOption, claimed: number): string =>
  o.kind === 'win' ? 'win'
    : o.kind === 'chow' ? `chow:${[...(o.tiles ?? []).map(kindOf), claimed].sort((a, b) => a - b).join(',')}`
      : `${o.kind}:${kindOf((o.tiles ?? [])[0]!)}`;

class ScriptedBot implements Bot {
  constructor(private readonly c: Cursor) {}
  chooseDiscard(v: PlayerView): TileInstance {
    const i = this.c.i, want = this.c.next();
    const kind = want?.startsWith('d:') ? Number(want.slice(2)) : -1;
    const t = v.hand.find((x) => kindOf(x) === kind);
    if (t === undefined) throw new Error(`scripted replay lost the thread at decision ${i}: wanted ${want}, hand has ${v.hand.map(kindOf).join(',')}`);
    return t;
  }
  chooseSelfAction(_v: PlayerView, options: SelfAction[]): SelfAction | null {
    const i = this.c.i, want = this.c.next();          // 'proceed' means the kong was declined
    if (want === 'proceed') return null;
    const o = options.find((x) => encSelf(x) === want);
    if (!o) throw new Error(`scripted replay lost the thread at decision ${i}: wanted self ${want}, options ${options.map(encSelf).join(' ')}`);
    return o;
  }
  chooseClaim(v: PlayerView, options: ClaimOption[]): ClaimOption | null {
    const i = this.c.i, want = this.c.next();
    if (want === 'pass') return null;
    const claimed = kindOf(v.lastDiscard!.tile);
    const o = options.find((x) => encClaim(x, claimed) === want);
    if (!o) throw new Error(`scripted replay lost the thread at decision ${i}: wanted claim ${want}, options ${options.map((x) => encClaim(x, claimed)).join(' ')}`);
    return o;
  }
}

/** Four bots replaying `seq`, or null when the record predates it and the bots must be re-run. */
export function scriptedBots(seq: readonly string[] | undefined): Bot[] | null {
  if (!seq?.length) return null;
  const c = new Cursor(seq);
  return [0, 1, 2, 3].map(() => new ScriptedBot(c));
}
