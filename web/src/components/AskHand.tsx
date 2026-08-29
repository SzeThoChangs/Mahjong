/**
 * "Ask" — type in the hand you are actually holding and get the coach's answer.
 *
 * Every other tab shows you a hand it chose: the Train tab deals one, the Real quiz replays a
 * recorded one, the Film room studies a finished one. None of them helps at a real table, which is
 * the only place the question ever actually comes up.
 *
 * The whole tab is one constraint: a mahjong hand is 14 tiles counting the one you just drew, and
 * an exposed set is three of them. So `concealed + 3 x melds` must reach 14 before there is
 * anything to ask, and the header says how far off you are rather than leaving you guessing why
 * nothing has happened.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tile } from '@/components/Tile';
import { tileLabel } from '@/lib/tiles';
import { cn } from '@/lib/utils';
import { rankDiscards, type Context } from 'sg-mahjong-solver';
import type { Meld, TileKind } from 'sg-mahjong-engine';
import { CONFIG } from '@/lib/scenario';

const WIND = ['東', '南', '西', '北'];
const SUITS: { label: string; base: number }[] = [
  { label: '萬 wan', base: 0 }, { label: '筒 tong', base: 9 }, { label: '條 sok', base: 18 },
];
const HONOURS = [27, 28, 29, 30, 31, 32, 33];
const BONUS = [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45];
const HAND_TILES = 14;
/** four copies of every playing tile; one of each flower, season and animal */
const copiesAllowed = (k: TileKind) => (k >= 34 ? 1 : 4);

export default function AskHand() {
  const [hand, setHand] = useState<TileKind[]>([]);
  const [melds, setMelds] = useState<Meld[]>([]);
  const [bonus, setBonus] = useState<TileKind[]>([]);
  const [seat, setSeat] = useState(0);
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(16);
  const [pending, setPending] = useState<'hand' | 'pong' | 'chow' | 'seen'>('hand');
  /** tiles already face-up anywhere on the table: the discard pool and everyone else's sets.
   *  Without these the coach counts four copies of a dead tile as live and reads the table as
   *  quieter than it is - it is the single biggest thing separating real advice from a guess. */
  const [seen, setSeen] = useState<TileKind[]>([]);
  /** exposed sets in front of each of the other three players - what "the table looks dangerous" is made of */
  const [oppMelds, setOppMelds] = useState<[number, number, number]>([0, 0, 0]);

  const used = useMemo(() => {
    const c = new Map<TileKind, number>();
    const bump = (k: TileKind) => c.set(k, (c.get(k) ?? 0) + 1);
    hand.forEach(bump); bonus.forEach(bump); seen.forEach(bump);
    melds.forEach((m) => m.tiles.forEach(bump));
    return c;
  }, [hand, melds, bonus, seen]);

  const total = hand.length + melds.length * 3;
  const short = HAND_TILES - total;

  const add = (k: TileKind) => {
    if ((used.get(k) ?? 0) >= copiesAllowed(k)) return;
    if (pending === 'seen') { setSeen((v) => [...v, k].sort((a, b) => a - b)); return; }
    if (k >= 34) { setBonus((b) => [...b, k].sort((a, b2) => a - b2)); return; }
    if (pending === 'hand') {
      if (total >= HAND_TILES) return;
      setHand((h) => [...h, k].sort((a, b) => a - b));
      return;
    }
    // a meld eats three tiles at once, so it needs room for all three
    if (total + 3 > HAND_TILES) { setPending('hand'); return; }
    if (pending === 'pong') {
      if ((used.get(k) ?? 0) > 1) return;                       // needs three copies free
      setMelds((m) => [...m, { type: 'pong', tiles: [k, k, k], concealed: false }]);
    } else {
      const suit = Math.floor(k / 9);
      if (k >= 27 || k % 9 > 6 || Math.floor((k + 2) / 9) !== suit) return;   // a chow cannot cross suits or run off the end
      if ([k, k + 1, k + 2].some((t) => (used.get(t) ?? 0) >= 4)) return;
      setMelds((m) => [...m, { type: 'chow', tiles: [k, k + 1, k + 2], concealed: false }]);
    }
    setPending('hand');
  };
  const removeAt = (i: number) => setHand((h) => h.filter((_, x) => x !== i));
  const clear = () => { setHand([]); setMelds([]); setBonus([]); setSeen([]); setPending('hand'); };

  // The coach only has an answer when the hand is a legal 14 and it is your turn to throw.
  const answer = useMemo(() => {
    if (total !== HAND_TILES || hand.length % 3 !== 2) return null;
    try {
      const ctx: Context = {
        // `seat` here is already a WIND - the player picks 東/南/西/北 directly - which is what
        // Context wants. Elsewhere it is derived as (seat - dealer + 4) % 4 from an absolute seat.
        seat, prevailingWind: round, bonus, playerTurns: turn,
        minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
        visible: seen, opponentMelds: oppMelds,
      };
      return rankDiscards(hand, melds, ctx);
    } catch { return null; }
  }, [hand, melds, bonus, seat, round, turn, total, seen, oppMelds]);

  const Picker = ({ kinds, cols }: { kinds: TileKind[]; cols?: string }) => (
    <div className={cn('flex flex-wrap gap-1', cols)}>
      {kinds.map((k) => {
        const left = copiesAllowed(k) - (used.get(k) ?? 0);
        return (
          <button key={k} type="button" disabled={left <= 0} onClick={() => add(k)}
            className={cn('relative rounded-md transition', left <= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:-translate-y-0.5')}
            aria-label={`add ${tileLabel(k)}`}>
            <Tile kind={k} size="sm" />
            {k < 34 && <span className="absolute -bottom-1 -right-1 rounded-full bg-secondary text-[9px] px-1 leading-tight">{left}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Your hand</h1>
        <p className="text-sm text-muted-foreground">Tap tiles to build the hand you are holding, then it tells you what to throw and why.</p>
      </div>

      {/* who and when: both change the answer, so they are not buried in a settings panel */}
      <Card><CardContent className="pt-4 text-sm"><div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-1">Your seat:
          {WIND.map((w, i) => <Button key={i} size="sm" variant={seat === i ? 'secondary' : 'ghost'} onClick={() => setSeat(i)}>{w}</Button>)}
        </span>
        <span className="flex items-center gap-1">Round:
          {WIND.map((w, i) => <Button key={i} size="sm" variant={round === i ? 'secondary' : 'ghost'} onClick={() => setRound(i)}>{w}</Button>)}
        </span>
        <span className="flex items-center gap-1">Sets showing opposite you:
          {[0, 1, 2].map((i) => (
            <input key={i} type="number" min={0} max={4} value={oppMelds[i]!}
              onChange={(e) => setOppMelds((o) => { const n = [...o] as [number, number, number]; n[i] = Math.max(0, Math.min(4, Number(e.target.value))); return n; })}
              className="w-12 rounded border bg-background px-2 py-0.5" />
          ))}
        </span>
        <span className="flex items-center gap-1">Turn
          <input type="number" min={1} max={70} value={turn} onChange={(e) => setTurn(Math.max(1, Math.min(70, Number(e.target.value))))}
            className="w-16 rounded border bg-background px-2 py-0.5" />
          <span className="text-muted-foreground">(第{Math.max(1, Math.ceil(turn / 4))}巡 — early is under 16, late is over 36)</span>
        </span>
      </div></CardContent></Card>

      {/* the hand as it stands */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {total}/{HAND_TILES} tiles
            {short > 0 && <span className="ml-2 font-normal text-muted-foreground">— {short} more to go</span>}
            {short === 0 && hand.length % 3 !== 2 && <span className="ml-2 font-normal text-amber-600">— that is a full hand, not one waiting to throw</span>}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={clear} disabled={!total && !bonus.length && !seen.length}>clear</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {melds.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Exposed sets</div>
              <div className="flex flex-wrap gap-3">
                {melds.map((m, i) => (
                  <button key={i} type="button" onClick={() => setMelds((ms) => ms.filter((_, x) => x !== i))}
                    className="flex gap-0.5 rounded hover:opacity-60" title="remove this set">
                    {m.tiles.map((k, j) => <Tile key={j} kind={k} size="sm" />)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">In your hand {hand.length > 0 && <span className="normal-case tracking-normal">— tap to remove</span>}</div>
            {hand.length === 0 ? <div className="text-sm text-muted-foreground">nothing yet</div> : (
              <div className="flex flex-wrap gap-1">
                {hand.map((k, i) => <button key={i} type="button" onClick={() => removeAt(i)} className="rounded hover:opacity-60"><Tile kind={k} size="md" /></button>)}
              </div>
            )}
          </div>
          {seen.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Already on the table — tap to remove</div>
              <div className="flex flex-wrap gap-1">
                {seen.map((k, i) => <button key={i} type="button" onClick={() => setSeen((v) => v.filter((_, x) => x !== i))} className="rounded hover:opacity-60"><Tile kind={k} size="xs" dim /></button>)}
              </div>
            </div>
          )}
          {bonus.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Flowers and animals — tap to remove</div>
              <div className="flex flex-wrap gap-1">
                {bonus.map((k, i) => <button key={i} type="button" onClick={() => setBonus((b) => b.filter((_, x) => x !== i))} className="rounded hover:opacity-60"><Tile kind={k} size="sm" /></button>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* the answer, as soon as there is one */}
      {answer && (
        <Card className="border-primary">
          <CardHeader className="pb-2"><CardTitle className="text-base">
            Throw <span className="text-primary">{tileLabel(answer.best.tile)}</span>
            {answer.tied.length > 1 && <span className="ml-2 text-sm font-normal text-muted-foreground">— or {answer.tied.filter((t) => t !== answer.best.tile).map(tileLabel).join(' / ')}, equally good</span>}
          </CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Tile kind={answer.best.tile} size="lg" highlight />
              <div className="space-y-1">
                <div><Badge variant="secondary">{answer.plan}</Badge></div>
                <div className="text-muted-foreground">{answer.best.reasons.join(' · ')}</div>
              </div>
            </div>
            <Separator />
            {answer.planDetail.map((l, i) => <div key={i} className="text-muted-foreground">{l}</div>)}
            <Separator />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Everything else, best first</div>
            <div className="space-y-1">
              {answer.options.slice(1).map((o) => (
                <div key={o.tile} className="flex items-center gap-2 text-xs">
                  <Tile kind={o.tile} size="sm" />
                  <span className={cn('w-16 shrink-0',
                    o.verdict === 'fine' ? 'text-emerald-700 dark:text-emerald-300' : o.verdict === 'mistake' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300')}>
                    {o.verdict === 'fine' ? 'also fine' : o.verdict}
                  </span>
                  <span className="text-muted-foreground">{o.reasons.join(' · ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* the picker */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Add tiles</CardTitle>
          <div className="flex flex-wrap gap-1">
            {(['hand', 'pong', 'chow', 'seen'] as const).map((m) => (
              <Button key={m} size="sm" variant={pending === m ? 'secondary' : 'ghost'} onClick={() => setPending(m)}
                disabled={(m === 'pong' || m === 'chow') && total + 3 > HAND_TILES}>
                {m === 'hand' ? 'to hand' : m === 'pong' ? '+ pong' : m === 'chow' ? '+ chow' : 'seen on table'}
              </Button>
            ))}
          </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending !== 'hand' && (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              {pending === 'pong' ? 'Tap the tile you ponged — it takes three copies.'
                : pending === 'chow' ? 'Tap the LOWEST tile of the run you chowed — 3條 for 3-4-5條.'
                : 'Tap everything already face-up: the discard pool and the sets in front of the other players. The more of it you enter, the better the danger read.'}
            </div>
          )}
          {SUITS.map((s) => (
            <div key={s.base}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
              <Picker kinds={Array.from({ length: 9 }, (_, i) => s.base + i)} />
            </div>
          ))}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Winds and dragons</div>
            <Picker kinds={HONOURS} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Flowers, seasons and animals — they score, they never sit in your hand</div>
            <Picker kinds={BONUS} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
