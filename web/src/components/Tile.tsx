import { cn } from '@/lib/utils';
import { tileSrc, tileLabel } from '@/lib/tiles';
import type { TileKind } from 'sg-mahjong-engine';

/** tile width in px per size, matching the w-* classes below so a rotated tile is the same
 *  size as an upright one. xxs = 22px, xs = w-8 = 32px, sm = w-9 = 36px, md = w-14 = 56px,
 *  lg = w-20 = 80px. xxs is the phone's table tile: the size at which four seats around a pile
 *  still fit across a 360px screen (MOBILE.md). */
const PX = { xxs: 22, xs: 32, sm: 36, md: 56, lg: 80 } as const;
const FACE = 330 / 240;

export function Tile({ kind, size = 'md', className, highlight, dim, concealed, rot = 0, onClick, badge, fluid }: {
  kind: TileKind; size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'; className?: string; highlight?: boolean;
  /** gone: a discard that was claimed, or a tile ruled out */
  dim?: boolean;
  /** part of a concealed set — face down at a real table. Distinct from `dim`, which means gone. */
  concealed?: boolean;
  /** quarter turns, for the seats sitting along the sides of the table. Not for `fluid` tiles. */
  rot?: 0 | 90 | 180 | 270;
  onClick?: () => void; badge?: string;
  /** share the row: shrink with the container so a full hand always fits on one line. On a phone
   *  the tile is a fixed 38px and the row wraps instead, because a tile in your hand is a button
   *  and a button needs 48px of height: 38 wide is 52 tall, and seven of them fit a 360px screen
   *  with the card's padding, so fourteen make two rows. The arithmetic is in MOBILE.md. */
  fluid?: boolean;
}) {
  const face = cn('aspect-[240/330] rounded-md shadow-sm select-none transition-transform',
    highlight && 'ring-2 ring-primary ring-offset-2', dim && 'opacity-40',
    concealed && 'outline-2 outline-dashed outline-offset-1 outline-muted-foreground/60',
    onClick && 'hover:-translate-y-1 cursor-pointer active:translate-y-0');

  // A rotated tile keeps its own w x h and spins about its centre; the wrapper takes the SWAPPED
  // box so the grid around it reserves the space the turned tile actually occupies.
  if (rot && !fluid) {
    const w = PX[size], h = Math.round(w * FACE), turned = rot === 90 || rot === 270;
    return (
      <div className={cn('relative shrink-0', className)} style={{ width: turned ? h : w, height: turned ? w : h }}>
        <img src={tileSrc(kind)} alt={tileLabel(kind)} title={tileLabel(kind)} draggable={false}
          className={cn(face, 'absolute left-1/2 top-1/2')}
          style={{ width: w, height: h, transform: `translate(-50%, -50%) rotate(${rot}deg)` }} />
        {badge && <span className="absolute -top-2 -right-2 z-10 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{badge}</span>}
      </div>
    );
  }

  const w = fluid ? 'w-full' : size === 'xxs' ? 'w-[22px]' : size === 'xs' ? 'w-8' : size === 'sm' ? 'w-9' : size === 'lg' ? 'w-16 sm:w-20' : 'w-12 sm:w-14';
  const img = (
    <img src={tileSrc(kind)} alt={tileLabel(kind)} title={tileLabel(kind)} draggable={false} className={cn(w, face)} />
  );
  // fluid tiles SHARE the row: flex splits what is left after the gaps, capped at full size, so a
  // 14-tile hand fits exactly instead of overflowing the card by the width of the gaps.
  return (
    <div className={cn('relative', fluid ? 'min-w-0 flex-1 max-w-14 max-sm:w-[38px] max-sm:flex-none' : 'inline-block', className)}>
      {onClick ? <button type="button" onClick={onClick} aria-label={`discard ${tileLabel(kind)}`} className="block w-full rounded-md focus-visible:outline-2 focus-visible:outline-ring">{img}</button> : img}
      {badge && <span className="absolute -top-2 -right-2 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{badge}</span>}
    </div>
  );
}
