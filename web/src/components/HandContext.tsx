/**
 * The facts that decide a discard: where you sit, who deals, which winds score,
 * how deep the hand is, and how much you are holding. Shown directly above the
 * tiles, because every one of them changes what the right tile is.
 *
 * Trainer and Real quiz both need this, so it lives in one place.
 */
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tile } from '@/components/Tile';
import { cn } from '@/lib/utils';

const WIND = ['東', '南', '西', '北'];

interface HandContextProps {
  seat: number;
  /** undefined when the position does not record who deals — then we only name your wind */
  dealer?: number;
  prevailingWind: number;
  /** turns taken by all four seats; the 巡 number is that over four, rounded up */
  playerTurns: number;
  /** 'early' | 'mid' | 'late', shown in brackets after the 巡 when given */
  phase?: string;
  fan: number;
  /** what a fan is called at this table: Singapore players say tai */
  fanLabel?: string;
  /** when given and the hand is short, says how much more it needs to win on a discard */
  minimumFan?: number;
  className?: string;
  /** trailing extras, e.g. the quiz's play-out count */
  children?: ReactNode;
}

export function HandContext({
  seat, dealer, prevailingWind, playerTurns, phase,
  fan, fanLabel = 'Fan in hand', minimumFan, className, children,
}: HandContextProps) {
  const round = Math.max(1, Math.ceil(playerTurns / 4));
  // your wind is your seat measured from the dealer, not your seat number
  const role = dealer === undefined ? seat : (seat - dealer + 4) % 4;
  const doubleWind = role === prevailingWind;

  return (
    <div className={cn('flex flex-row flex-wrap items-center gap-x-6 gap-y-3 text-sm', className)}>
      {dealer === undefined ? (
        <span>You are <b>{WIND[role]}</b></span>
      ) : (
        <>
          <span>Seat <b>{seat + 1}</b> · you are <b>{WIND[role]}</b></span>
          <span className="text-muted-foreground">Host: seat <b className="text-foreground">{dealer + 1}</b>{dealer === seat ? ' (you)' : ''}</span>
        </>
      )}
      <span className="text-muted-foreground">Round <b className="text-foreground">{WIND[prevailingWind]}</b></span>
      {/* without a known dealer we cannot say which wind is yours, so there is no pair to show */}
      {dealer !== undefined && (
        <span className="flex items-center gap-1 text-muted-foreground">tai winds
          <Tile kind={27 + prevailingWind} size="sm" />
          <Tile kind={27 + role} size="sm" className={cn(doubleWind && '-ml-4')} />
          {doubleWind && <Badge variant="outline">double!</Badge>}
        </span>
      )}
      <span><b>第{round}巡</b>{phase && <span className="text-muted-foreground"> ({phase} game)</span>}</span>
      <span className="text-muted-foreground">{fanLabel} <b className="text-foreground">{fan}</b>
        {minimumFan !== undefined && fan < minimumFan && <> — need {minimumFan} to win on a discard</>}
      </span>
      {children}
    </div>
  );
}
