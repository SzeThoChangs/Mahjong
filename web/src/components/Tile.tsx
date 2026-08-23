import { cn } from '@/lib/utils';
import { tileSrc, tileLabel } from '@/lib/tiles';
import type { TileKind } from 'sg-mahjong-engine';

export function Tile({ kind, size = 'md', className, highlight, dim, onClick, badge, fluid }: {
  kind: TileKind; size?: 'sm' | 'md' | 'lg'; className?: string; highlight?: boolean; dim?: boolean; onClick?: () => void; badge?: string;
  /** share the row: shrink with the container so a full hand always fits on one line */
  fluid?: boolean;
}) {
  const w = fluid ? 'w-full' : size === 'sm' ? 'w-9' : size === 'lg' ? 'w-16 sm:w-20' : 'w-12 sm:w-14';
  const img = (
    <img src={tileSrc(kind)} alt={tileLabel(kind)} title={tileLabel(kind)} draggable={false}
      className={cn(w, 'aspect-[240/330] rounded-md shadow-sm select-none transition-transform', highlight && 'ring-2 ring-primary ring-offset-2', dim && 'opacity-40', onClick && 'hover:-translate-y-1 cursor-pointer active:translate-y-0')} />
  );
  return (
    <div className={cn('relative', fluid ? 'flex-1 min-w-0 max-w-14' : 'inline-block', className)}>
      {onClick ? <button type="button" onClick={onClick} aria-label={`discard ${tileLabel(kind)}`} className="block w-full rounded-md focus-visible:outline-2 focus-visible:outline-ring">{img}</button> : img}
      {badge && <span className="absolute -top-2 -right-2 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{badge}</span>}
    </div>
  );
}
