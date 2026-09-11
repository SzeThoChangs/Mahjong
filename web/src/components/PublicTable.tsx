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
 * On a phone the square stays, at a 22px tile. It used to give up below `sm` and stack the seats
 * into rows, which threw away the one thing a pile carries - which seat threw it, and when - and
 * reading danger off the discards is half of what this app teaches. What the square costs on a
 * phone is height, and a late-game pile can still be wider than a 360px screen, in which case the
 * table scrolls inside its own card rather than dragging the page. The spacing is spent where it
 * means something and nowhere else: tiles that lie together on a real table touch, so there is no
 * gap inside a pile or inside a set; 6px sits between a seat's flowers and each of their sets;
 * 11px between everything a seat has shown and the pile they have thrown, because those are two
 * different rings of the table and a Pong face up in front of somebody means something entirely
 * different from the same three tiles in their discards. MOBILE.md settled all of this.
 */
import type { TileKind } from 'sg-mahjong-engine';
import { Card, CardContent } from '@/components/ui/card';
import { Tile } from '@/components/Tile';
import { cn } from '@/lib/utils';
import { J } from '@/lib/jargon';
import { usePhone } from '@/lib/phone';

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
/** the tile the table is drawn at: Tile's `sm` (w-9) on anything wide enough, its `xxs` on a
 *  phone. The width must match Tile's own or the pile wraps a tile early. This is the short side
 *  of a tile either way up: the width of an upright one, the height of a turned one - so one
 *  number sizes the row tracks for the seats across and the column tracks for the seats down. */
type Size = { size: 'sm' | 'xxs'; tile: number; phone: boolean };
const WIDE: Size = { size: 'sm', tile: 36, phone: false };
const PHONE: Size = { size: 'xxs', tile: 22, phone: true };

type Side = 'bottom' | 'right' | 'top' | 'left';
/** Every seat's tiles face THAT seat, as they would on a real table: the player opposite reads
 *  theirs upside down from where you sit, not the right way up. */
const ROT: Record<Side, 0 | 90 | 180 | 270> = { bottom: 0, right: 270, top: 180, left: 90 };

/**
 * Where the i-th tile of a pile goes, in the grid's own row and column.
 *
 * Every seat throws the same way: the first six go on the line NEAREST that player, left to right
 * as THEY see it, and the pile then grows towards the middle of the table. Saying that in screen
 * terms means something different for each of the four seats, because the grid always puts row 1
 * above row 2 and column 1 left of column 2 while "towards the player" points four different ways.
 * Left to auto-placement, opposite seats fill in opposite directions - the bottom seat's pile grew
 * away from them while the top seat's grew towards them, and neither matched a real table.
 *
 * `line` counts lines out from the player, `at` is the position along one. The seats along the
 * sides read their lines as columns, and their own left-to-right runs down the screen for the seat
 * on the left and up it for the seat on the right, which is what facing each other means.
 */
function place(i: number, total: number, side: Side): { gridRow: number; gridColumn: number } {
  const line = Math.floor(i / PER_ROW), at = i % PER_ROW;
  const lines = Math.max(1, Math.ceil(total / PER_ROW));      // how deep the pile has grown
  const wide = Math.max(1, Math.min(PER_ROW, total));         // how long a full line is
  switch (side) {
    case 'bottom': return { gridRow: lines - line, gridColumn: at + 1 };
    case 'top': return { gridRow: line + 1, gridColumn: wide - at };
    case 'left': return { gridRow: at + 1, gridColumn: line + 1 };
    case 'right': return { gridRow: wide - at, gridColumn: lines - line };
  }
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
 * squeezed, so the upright seats broke at five per row while the turned seats got six. Each tile is
 * then placed by hand, because auto-placement cannot fill in four different directions.
 */
function Pool({ seat, side, at }: { seat: SeatPublic; side: Side; at: Size }) {
  const rot = ROT[side];
  const down = side === 'left' || side === 'right';
  const total = seat.discards.length;
  const n = Math.max(1, Math.min(PER_ROW, total));
  return (
    <div className={cn('grid', at.phone ? 'gap-0' : 'gap-0.5')}
      style={down
        ? { gridTemplateRows: `repeat(${n}, ${at.tile}px)`, gridAutoColumns: 'max-content' }
        : { gridTemplateColumns: `repeat(${n}, ${at.tile}px)`, gridAutoRows: 'max-content' }}>
      {seat.discards.map((d, i) => (
        <div key={i} style={place(i, total, side)}><Tile kind={d.kind} size={at.size} rot={rot} /></div>
      ))}
    </div>
  );
}

/** flowers and locked sets: a seat's SHOWN tiles, in the outer ring away from the pile, always on
 *  a single line running the same way as that seat's pile */
function Shown({ seat, side, at }: { seat: SeatPublic; side: Side; at: Size }) {
  const rot = ROT[side];
  const across = side === 'left' || side === 'right';
  if (!seat.bonus.length && !seat.melds.length) return null;
  // one line however many sets there are: wrapping split a seat's sets across two columns/rows,
  // which read as belonging to different players
  const inside = at.phone ? 'gap-0' : 'gap-0.5';   // tiles in one set touch
  return (
    <div className={cn('flex flex-nowrap', at.phone ? 'gap-1.5' : 'gap-3', across ? 'flex-col' : 'items-end justify-center')}>
      {seat.bonus.length > 0 && (
        <div className={cn('flex', inside, across && 'flex-col')}>
          {seat.bonus.map((k, i) => <Tile key={i} kind={k} size={at.size} rot={rot} />)}
        </div>
      )}
      {seat.melds.map((m, i) => (
        <div key={i} className={cn('flex', inside, across && 'flex-col')}>
          {m.tiles.map((k, j) => <Tile key={j} kind={k} size={at.size} rot={rot} concealed={m.concealed} />)}
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
function Concealed({ seat, at }: { seat: SeatPublic; at: Size }) {
  if (!seat.hand?.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{seat.you ? 'Your hand' : `${seat.wind}'s hand`} — concealed</span>
      <div className="flex flex-wrap items-end gap-0.5" style={{ maxWidth: 9 * (at.tile + 2) }}>
        {[...seat.hand].sort((a, b) => a - b).filter((k) => k !== seat.drawn).map((k, i) => <Tile key={i} kind={k} size={at.size} />)}
        {seat.drawn != null && <span className="ml-1.5"><Tile kind={seat.drawn} size={at.size} badge="drew" /></span>}
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
  const sz = usePhone() ? PHONE : WIDE;
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
      <CardContent className={cn('pt-5', sz.phone && 'px-1')}>
        {/* ---------- the table. Six turned tiles across is wide; if the card is still narrower
             than that, the table scrolls inside itself rather than clipping. On a phone the gaps
             are the ones the header explains: none inside a pile or a set, 6px between a seat's
             flowers and sets, 11px between what a seat has shown and their pile - which here is
             5px of grid gap, the pile's 2px border and its 4px of padding. ---------- */}
        <div className="overflow-x-auto">
          <div className={cn('grid w-max mx-auto rounded-2xl bg-muted/40', sz.phone ? 'gap-[5px] p-1' : 'gap-x-3 gap-y-2 p-3')}
          style={{ gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto auto' }}>

          {/* The seats along the sides are named down their edge, as they sit. On a phone that
              costs 28px a side that the piles need, so their names go in the top corners instead,
              which are empty anyway, each pulled towards its own seat. */}
          {sz.phone && <div className="col-start-1 row-start-1 self-end justify-self-end"><SeatName seat={left} /></div>}
          {sz.phone && <div className="col-start-3 row-start-1 self-end justify-self-start"><SeatName seat={right} /></div>}

          <div className="col-start-2 row-start-1 flex flex-col items-center gap-1.5">
            <SeatName seat={top} /><Shown seat={top} side="top" at={sz} />
          </div>

          <div className="col-start-1 row-start-2 flex items-center gap-2">
            {!sz.phone && <SeatName seat={left} className="[writing-mode:vertical-rl] rotate-180" />}<Shown seat={left} side="left" at={sz} />
          </div>

          {/* The middle: the discard pile, each seat's throws in front of that seat.
              The dashed box is the one line that separates thrown tiles from shown ones - two
              different kinds of information sitting a few millimetres apart - so it is drawn to be
              seen rather than hinted at. */}
          <div className={cn('col-start-2 row-start-2 grid w-max items-start justify-items-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/45 bg-background/70', sz.phone ? 'p-1' : 'px-2 py-2')}
            style={{ gridTemplateColumns: sz.phone ? 'auto minmax(4.5rem,auto) auto' : 'auto minmax(6rem,auto) auto' }}>
            <div className="col-start-2 row-start-1"><Pool seat={top} side="top" at={sz} /></div>
            <div className="col-start-1 row-start-2"><Pool seat={left} side="left" at={sz} /></div>
            <div className={cn('col-start-2 row-start-2 self-center text-center', sz.phone ? 'px-1' : 'px-2 py-1')}>{centre}</div>
            <div className="col-start-3 row-start-2"><Pool seat={right} side="right" at={sz} /></div>
            <div className="col-start-2 row-start-3"><Pool seat={bottom} side="bottom" at={sz} /></div>
          </div>

          <div className="col-start-3 row-start-2 flex items-center gap-2">
            <Shown seat={right} side="right" at={sz} />{!sz.phone && <SeatName seat={right} className="[writing-mode:vertical-rl]" />}
          </div>

          <div className="col-start-2 row-start-3 flex flex-col items-center gap-1.5">
            <Shown seat={bottom} side="bottom" at={sz} /><SeatName seat={bottom} />
          </div>

          {/* only ever one seat is mid-decision, and its hand reads best upright, under the table */}
          {holder && <div className="col-span-3 row-start-4 flex justify-center pt-1"><Concealed seat={holder} at={sz} /></div>}
          </div>
        </div>

        {anyConcealed && (
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">A dashed set is a <b className="text-foreground">concealed <J>Kong</J></b> — declared, but face down at a real table.</p>
        )}
      </CardContent>
    </Card>
  );
}
