/**
 * "The table" — everything face-up that is not your own concealed hand, laid out the way it sits
 * in front of you at a real table.
 *
 * SEATING. Play runs counter-clockwise: `state.ts` advances the turn to `(from + 1) % 4`, so the
 * seat after you is on your RIGHT, two along is opposite, three is on your LEFT. You are always
 * drawn at the bottom, so the picture matches what you would actually be looking at.
 *
 * TWO RINGS, because these are not the same thing and mixing them is what made the old view
 * unreadable:
 *
 *   outer   each seat's SHOWN tiles — flowers (scoring only) and open sets (claimed and locked)
 *   middle  the discard pile, all four seats pooled around the round marker, six to a line,
 *           each seat's throws in front of that seat exactly as they sit on a real table
 *
 * Nothing in the pile is dimmed. A concealed set is dashed — that is the one remaining mark, and it
 * means face-down, not gone.
 *
 * Below `sm` there is not room for four seats around a centre, so the same data renders as stacked
 * rows instead. Both layouts read from the same `seats`.
 */
import type { TileKind } from 'sg-mahjong-engine';
import { Card, CardContent } from '@/components/ui/card';
import { Tile } from '@/components/Tile';
import { cn } from '@/lib/utils';

export interface SeatPublic {
  wind: string;
  you: boolean;
  bonus: TileKind[];
  melds: { tiles: TileKind[]; concealed: boolean }[];
  discards: { kind: TileKind; claimed: boolean }[];
  /** film room only */
  name?: string;
  acting?: boolean;
  dealer?: boolean;
  hand?: TileKind[];
  drawn?: TileKind | null;
}

const LABEL = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground';
/** a real table stacks its discards six to a row in front of each player */
const PER_ROW = 6;
/** must match Tile's `sm` width (w-9), or the pile wraps a tile early. This is the short side of a
 *  tile either way up: the width of an upright one, the height of a turned one - so one number
 *  sizes the row tracks for the seats across and the column tracks for the seats down. */
const TILE = 36;

type Side = 'bottom' | 'right' | 'top' | 'left';
/** Every seat's tiles face THAT seat, as they would on a real table: the player opposite reads
 *  theirs upside down from where you sit, not the right way up. */
const ROT: Record<Side, 0 | 90 | 180 | 270> = { bottom: 0, right: 270, top: 180, left: 90 };

function Caption({ label, count }: { label: string; count: number }) {
  return <span className={LABEL}>{label} <span className="tabular-nums opacity-60">{count}</span></span>;
}

/**
 * The pool in front of one seat: six to a line, oldest first.
 *
 * The line runs PARALLEL TO THAT SEAT'S EDGE of the table - across for the seats top and bottom,
 * down for the seats left and right - and every tile is turned to face its own player, the same way
 * that seat's open sets are. So each pile lies in front of its owner exactly as it would on a real
 * table, and you read it from their side.
 *
 * An explicit grid rather than a wrapping flex: `flex-wrap` under a `max-width` takes its break
 * point from the container's intrinsic width, which the surrounding grid track had already
 * squeezed, so the upright seats broke at five per row while the turned seats got six.
 */
function Pool({ seat, side }: { seat: SeatPublic; side: Side }) {
  const rot = ROT[side];
  const down = side === 'left' || side === 'right';
  const n = Math.max(1, Math.min(PER_ROW, seat.discards.length));
  return (
    <div className="grid gap-0.5"
      style={down
        ? { gridTemplateRows: `repeat(${n}, ${TILE}px)`, gridAutoFlow: 'column', gridAutoColumns: 'max-content' }
        : { gridTemplateColumns: `repeat(${n}, ${TILE}px)`, gridAutoRows: 'max-content' }}>
      {seat.discards.map((d, i) => <Tile key={i} kind={d.kind} size="sm" rot={rot} />)}
    </div>
  );
}

/** flowers and locked sets: a seat's SHOWN tiles, in the outer ring away from the pile, always on
 *  a single line running the same way as that seat's pile */
function Shown({ seat, side }: { seat: SeatPublic; side: Side }) {
  const rot = ROT[side];
  const across = side === 'left' || side === 'right';
  if (!seat.bonus.length && !seat.melds.length) return null;
  // one line however many sets there are: wrapping split a seat's sets across two columns/rows,
  // which read as belonging to different players
  return (
    <div className={cn('flex flex-nowrap gap-3', across ? 'flex-col' : 'items-end justify-center')}>
      {seat.bonus.length > 0 && (
        <div className={cn('flex gap-0.5', across && 'flex-col')}>
          {seat.bonus.map((k, i) => <Tile key={i} kind={k} size="sm" rot={rot} />)}
        </div>
      )}
      {seat.melds.map((m, i) => (
        <div key={i} className={cn('flex gap-0.5', across && 'flex-col')}>
          {m.tiles.map((k, j) => <Tile key={j} kind={k} size="sm" rot={rot} concealed={m.concealed} />)}
        </div>
      ))}
    </div>
  );
}

function SeatName({ seat, className }: { seat: SeatPublic; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs whitespace-nowrap', className)}>
      <span className={cn('text-sm', seat.you ? 'font-semibold' : 'font-medium')}>{seat.wind}</span>
      {seat.you && <span className="text-muted-foreground">(you)</span>}
      {seat.name && <span className="text-muted-foreground">{seat.name}</span>}
      {seat.dealer && <span className="rounded border px-1 text-[10px] text-muted-foreground">dealer</span>}
      {seat.acting && <span className="rounded bg-primary px-1.5 text-[10px] text-primary-foreground">acting</span>}
    </div>
  );
}

/** the acting seat's concealed hand, shown in the film room where there is nothing below the table */
function Concealed({ seat }: { seat: SeatPublic }) {
  if (!seat.hand?.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{seat.you ? 'Your hand' : `${seat.wind}'s hand`} — concealed</span>
      <div className="flex flex-wrap items-end gap-0.5" style={{ maxWidth: 9 * (TILE + 2) }}>
        {[...seat.hand].sort((a, b) => a - b).filter((k) => k !== seat.drawn).map((k, i) => <Tile key={i} kind={k} size="sm" />)}
        {seat.drawn != null && <span className="ml-1.5"><Tile kind={seat.drawn} size="sm" badge="drew" /></span>}
      </div>
    </div>
  );
}

export function PublicTable({ seats, you, centre }: {
  /** indexed by absolute seat 0-3 */
  seats: SeatPublic[];
  /** the seat the view belongs to — it is drawn at the bottom */
  you: number;
  /** round, turn, wall — whatever belongs in the middle of the table */
  centre?: React.ReactNode;
}) {
  const has = (s: SeatPublic | undefined) => !!s && (s.bonus.length > 0 || s.melds.length > 0 || s.discards.length > 0 || !!s.hand?.length);
  if (!seats.some(has)) return null;

  // counter-clockwise from you: +1 right, +2 opposite, +3 left. `seats` comes from callers as a
  // 4-entry map, but index arithmetic on a bad `you` would hand back undefined and blow up the
  // whole tab, so an empty seat is the floor.
  const EMPTY: SeatPublic = { wind: '', you: false, bonus: [], melds: [], discards: [] };
  const at = (off: number) => seats[(((you % 4) + 4) % 4 + off) % 4] ?? EMPTY;
  const bottom = at(0), right = at(1), top = at(2), left = at(3);
  const anyConcealed = seats.some((s) => s.melds.some((m) => m.concealed));
  const holder = [bottom, right, top, left].find((s) => s.hand?.length);

  return (
    <Card>
      <CardContent className="pt-5">
        {/* ---------- the table, sm and up. Six turned tiles across is wide; if the card is still
             narrower than that, the table scrolls inside itself rather than clipping. ---------- */}
        <div className="hidden sm:block overflow-x-auto">
          <div className="grid w-max mx-auto gap-x-3 gap-y-2 rounded-2xl bg-muted/40 p-3"
          style={{ gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto auto' }}>

          <div className="col-start-2 row-start-1 flex flex-col items-center gap-1.5">
            <SeatName seat={top} /><Shown seat={top} side="top" />
          </div>

          <div className="col-start-1 row-start-2 flex items-center gap-2">
            <SeatName seat={left} className="[writing-mode:vertical-rl] rotate-180" /><Shown seat={left} side="left" />
          </div>

          {/* The middle: the discard pile, each seat's throws in front of that seat.
              The dashed box is the one line that separates thrown tiles from shown ones - two
              different kinds of information sitting a few millimetres apart - so it is drawn to be
              seen rather than hinted at. */}
          <div className="col-start-2 row-start-2 grid w-max items-start justify-items-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/45 bg-background/70 px-2 py-2"
            style={{ gridTemplateColumns: 'auto minmax(6rem,auto) auto' }}>
            <div className="col-start-2 row-start-1"><Pool seat={top} side="top" /></div>
            <div className="col-start-1 row-start-2"><Pool seat={left} side="left" /></div>
            <div className="col-start-2 row-start-2 self-center px-2 py-1 text-center">{centre}</div>
            <div className="col-start-3 row-start-2"><Pool seat={right} side="right" /></div>
            <div className="col-start-2 row-start-3"><Pool seat={bottom} side="bottom" /></div>
          </div>

          <div className="col-start-3 row-start-2 flex items-center gap-2">
            <Shown seat={right} side="right" /><SeatName seat={right} className="[writing-mode:vertical-rl]" />
          </div>

          <div className="col-start-2 row-start-3 flex flex-col items-center gap-1.5">
            <Shown seat={bottom} side="bottom" /><SeatName seat={bottom} />
          </div>

          {/* only ever one seat is mid-decision, and its hand reads best upright, under the table */}
          {holder && <div className="col-span-3 row-start-4 flex justify-center pt-1"><Concealed seat={holder} /></div>}
          </div>
        </div>

        {/* ---------- stacked rows, below sm: four seats around a middle do not fit ---------- */}
        <div className="sm:hidden">
          {centre && <div className="flex justify-center pb-3 text-center">{centre}</div>}
          {[0, 1, 2, 3].map((off) => at(off)).filter(has).map((s, i) => (
            <div key={s.wind + i} className={cn('flex items-start gap-x-3 py-3 text-xs', i > 0 && 'border-t')}>
              <span className={cn('w-14 shrink-0 pt-4', s.you ? 'font-semibold' : 'text-muted-foreground')}>
                {s.wind}{s.you ? ' (you)' : ''}
              </span>
              {/* the groups wrap inside their own column, so a wrapped row stays under the groups
                  rather than sliding back under the seat name */}
              <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-6 gap-y-3">
                {s.hand?.length ? <Concealed seat={s} /> : null}
                {s.bonus.length > 0 && (
                  <div className="flex flex-col gap-1"><Caption label="Flowers" count={s.bonus.length} />
                    <div className="flex flex-wrap items-end gap-0.5">{s.bonus.map((k, j) => <Tile key={j} kind={k} size="sm" />)}</div>
                  </div>
                )}
                {s.melds.length > 0 && (
                  <div className="flex flex-col gap-1"><Caption label="Open sets" count={s.melds.length} />
                    <div className="flex flex-wrap items-end gap-0.5">
                      {s.melds.map((m, j) => <span key={j} className="flex gap-0.5 mr-2 last:mr-0">{m.tiles.map((k, x) => <Tile key={x} kind={k} size="sm" concealed={m.concealed} />)}</span>)}
                    </div>
                  </div>
                )}
                {s.discards.length > 0 && (
                  <div className="flex flex-col gap-1"><Caption label="Discarded" count={s.discards.length} />
                    <div className="flex flex-wrap items-end gap-0.5">{s.discards.map((d, j) => <Tile key={j} kind={d.kind} size="sm" />)}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {anyConcealed && (
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">A dashed set is a <b className="text-foreground">concealed kong</b> — declared, but face down at a real table.</p>
        )}
      </CardContent>
    </Card>
  );
}
