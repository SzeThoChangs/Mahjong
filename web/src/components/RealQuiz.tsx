/**
 * Real quiz: positions from actual recorded games, graded by the evaluator's
 * measured EV of every legal action. Not heuristics - play-out counts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tile } from '@/components/Tile';
import { tileLabel } from '@/lib/tiles';
import { cn } from '@/lib/utils';

const WIND = ['East', 'South', 'West', 'North'];

interface PackIx { id: string; money: boolean; unit: string; questions: number }
interface Action { a: string; ev: number; win: number; dealin: number; draw: number }
interface Q { id: string; k: string; seat: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; bot: string; spread: number; best: string; sel: string; n: number; actions: Action[] }
type Verdict = 'best' | 'fine' | 'mistake' | 'blunder';

const VERDICT_STYLE: Record<Verdict, string> = {
  best: 'bg-emerald-600 text-white', fine: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  mistake: 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50', blunder: 'bg-red-600 text-white',
};
const VERDICT_TEXT: Record<Verdict, string> = { best: 'Best move', fine: 'Close enough', mistake: 'Mistake', blunder: 'Big mistake' };

const verdictOf = (regret: number, unit: string): Verdict => {
  const [fine, mistake] = unit === '$' ? [0.35, 1.5] : [0.8, 3.5];
  return regret <= 0.01 ? 'best' : regret <= fine ? 'fine' : regret <= mistake ? 'mistake' : 'blunder';
};
const kindsOf = (a: string): number[] => a.startsWith('d:') ? [Number(a.slice(2))] : a.startsWith('chow:') ? a.slice(5).split(',').map(Number) : (/^\w+:(\d+)$/.exec(a) ? [Number(/^\w+:(\d+)$/.exec(a)![1])] : []);
const actionText = (a: string) => a === 'win' ? 'Win' : a === 'pass' ? 'Pass' : a === 'proceed' ? 'No kong' : a.startsWith('d:') ? `Discard ${tileLabel(Number(a.slice(2)))}` : a.startsWith('pong') ? 'Pong' : a.startsWith('chow') ? 'Chow' : 'Kong';

export default function RealQuiz() {
  const [packs, setPacks] = useState<PackIx[]>([]);
  const [pack, setPack] = useState<string | null>(null);
  const [unit, setUnit] = useState('chips');
  const [qs, setQs] = useState<Q[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<'all' | 'discard' | 'claim'>('all');
  const [score, setScore] = useState({ best: 0, fine: 0, mistake: 0, blunder: 0, lost: 0, streak: 0 });

  useEffect(() => { fetch('/quiz/index.json').then((r) => r.json()).then((d: { packs: PackIx[] }) => { setPacks(d.packs); if (d.packs[0]) setPack(d.packs[0].id); }).catch(() => setPacks([])); }, []);
  useEffect(() => {
    if (!pack) return;
    fetch(`/quiz/${pack}.json`).then((r) => r.json()).then((d: { unit: string; questions: Q[] }) => {
      setUnit(d.unit); setQs(d.questions);
      const idx = d.questions.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!]; }
      setOrder(idx); setPos(0); setPicked(null);
    });
  }, [pack]);

  const filtered = useMemo(() => order.filter((i) => mode === 'all' || (mode === 'discard' ? qs[i]!.k === 'discard' : qs[i]!.k !== 'discard')), [order, qs, mode]);
  const q = qs[filtered[pos % Math.max(1, filtered.length)] ?? 0];
  const fmt = (x: number) => `${x < 0 ? '−' : ''}${unit === '$' ? '$' : ''}${Math.abs(x).toFixed(2)}${unit === '$' ? '' : ''}`;

  if (!packs.length) return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">No quiz packs found. Run: <code>pnpm -C datagen exec tsx src/quizpack.ts</code></div>;
  if (!q) return null;

  const pickedAction = picked === null ? null : q.actions.find((a) => a.a === picked) ?? null;
  const bestAction = q.actions[0]!;
  const regret = pickedAction ? bestAction.ev - pickedAction.ev : 0;
  const verdict = pickedAction ? verdictOf(regret, unit) : null;

  const choose = (a: string) => {
    if (picked !== null) return;
    setPicked(a);
    const act = q.actions.find((x) => x.a === a)!;
    const v = verdictOf(bestAction.ev - act.ev, unit);
    setScore((s) => ({ ...s, [v]: s[v] + 1, lost: s.lost + (bestAction.ev - act.ev), streak: v === 'best' || v === 'fine' ? s.streak + 1 : 0 }));
  };
  const next = () => { setPicked(null); setPos((p) => p + 1); };

  const discardKinds = new Set(q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2))));
  const sorted = [...q.h].sort((a, b) => a - b);
  const drIdx = q.dr !== null ? sorted.indexOf(q.dr) : -1;
  const handTiles = drIdx >= 0 ? [...sorted.slice(0, drIdx), ...sorted.slice(drIdx + 1)] : sorted;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {packs.map((p) => <Button key={p.id} size="sm" variant={p.id === pack ? 'default' : 'outline'} onClick={() => setPack(p.id)}>{p.id} · {p.questions}{p.money ? ' · $' : ''}</Button>)}
        <span className="ml-auto" />
        {(['all', 'discard', 'claim'] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? 'secondary' : 'ghost'} onClick={() => { setMode(m); setPicked(null); }}>{m}</Button>)}
      </div>

      <Card>
        <CardContent className="pt-4 !flex !flex-row flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span>You are <b>{WIND[q.seat]}</b></span>
          <span className="text-muted-foreground">Prevailing <b className="text-foreground">{WIND[q.w]}</b></span>
          <span className="text-muted-foreground">Turn <b className="text-foreground">{q.t}</b></span>
          <span className="text-muted-foreground">Tai in hand <b className="text-foreground">{q.fih}</b></span>
          {q.b.length > 0 && <span className="flex items-center gap-1">{q.b.map((k, i) => <Tile key={i} kind={k} size="sm" />)}</span>}
          {q.m.length > 0 && <span className="flex items-center gap-2">{q.m.map((m, i) => <span key={i} className="flex gap-0.5">{m.slice(2).map((k, j) => <Tile key={j} kind={k} size="sm" dim={m[1] === 1} />)}</span>)}</span>}
          <span className="ml-auto text-xs text-muted-foreground">a real position · {q.n} play-outs per move</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">
          {q.k === 'discard' ? 'Which tile do you discard?' : q.k === 'claim' ? <>{q.ld ? <>{WIND[q.ld[0]]} discarded <b>{tileLabel(q.ld[1]!)}</b> — claim or pass?</> : 'Claim or pass?'}</> : 'Kong, or keep the hand as it is?'}
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-1 sm:gap-1.5">
            {handTiles.map((k, i) => (
              <Tile key={i} kind={k} size="md"
                onClick={q.k === 'discard' && picked === null && discardKinds.has(k) ? () => choose(`d:${k}`) : undefined}
                dim={picked !== null && !(kindsOf(q.actions[0]!.a).includes(k) && q.actions[0]!.a.startsWith('d:')) && `d:${k}` !== picked}
                highlight={picked !== null && q.actions[0]!.a === `d:${k}`} />
            ))}
            {q.dr !== null && (
              <><div className="w-3" />
                <Tile kind={q.dr} size="md" badge="drew"
                  onClick={q.k === 'discard' && picked === null && discardKinds.has(q.dr) ? () => choose(`d:${q.dr}`) : undefined}
                  dim={picked !== null && q.actions[0]!.a !== `d:${q.dr}` && `d:${q.dr}` !== picked}
                  highlight={picked !== null && q.actions[0]!.a === `d:${q.dr}`} /></>
            )}
          </div>
          {q.k !== 'discard' && (
            <div className="flex flex-wrap gap-2">
              {q.actions.map((a) => (
                <Button key={a.a} variant="outline" disabled={picked !== null} onClick={() => choose(a.a)} className="gap-1">
                  {actionText(a.a)} {a.a.startsWith('chow') && kindsOf(a.a).map((k, i) => <Tile key={i} kind={k} size="sm" />)}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pickedAction && verdict && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={cn('text-sm px-3 py-1', VERDICT_STYLE[verdict])}>{VERDICT_TEXT[verdict]}</Badge>
              <span className="text-sm">
                {verdict === 'best' ? <>Measured best: worth <b>{fmt(pickedAction.ev)}</b> per hand.</>
                  : <>Your {actionText(pickedAction.a).toLowerCase()} is worth <b>{fmt(pickedAction.ev)}</b>; best was {actionText(bestAction.a).toLowerCase()} at <b>{fmt(bestAction.ev)}</b> — you gave up <b>{fmt(regret)}</b>.</>}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">the {q.bot} bot chose {actionText(q.sel).toLowerCase()}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {q.actions.map((a) => {
              const isBest = a.a === bestAction.a, isPick = a.a === picked;
              const min = Math.min(...q.actions.map((x) => x.ev), 0), max = Math.max(...q.actions.map((x) => x.ev), 0), span = Math.max(1e-6, max - min);
              return (
                <div key={a.a} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 flex items-center gap-1">{a.a.startsWith('d:') ? <Tile kind={Number(a.a.slice(2))} size="sm" /> : <span className="font-medium">{actionText(a.a)}</span>}</span>
                  <div className="flex-1 h-4 rounded bg-secondary relative overflow-hidden">
                    <div className={cn('absolute inset-y-0 rounded', isBest ? 'bg-emerald-500' : isPick ? 'bg-sky-500' : 'bg-muted-foreground/40')}
                      style={{ left: `${((Math.min(0, a.ev) - min) / span) * 100}%`, width: `${(Math.abs(a.ev) / span) * 100}%` }} />
                  </div>
                  <span className="w-16 tabular-nums text-right">{fmt(a.ev)}</span>
                  <span className="w-20 text-muted-foreground">win {(a.win * 100).toFixed(0)}%</span>
                  {isBest && <Badge className="bg-emerald-600 text-white">best</Badge>}
                  {isPick && !isBest && <Badge className="bg-sky-600 text-white">you</Badge>}
                </div>
              );
            })}
            <div className="pt-2"><Button onClick={next}>Next position</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Session:</span>
        <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:text-emerald-300">best {score.best}</Badge>
        <Badge variant="outline">close {score.fine}</Badge>
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">mistake {score.mistake}</Badge>
        <Badge variant="outline" className="border-red-600 text-red-700 dark:text-red-300">blunder {score.blunder}</Badge>
        <span>· given up {fmt(score.lost)} · streak {score.streak}</span>
        <button className="underline ml-auto" onClick={() => setScore({ best: 0, fine: 0, mistake: 0, blunder: 0, lost: 0, streak: 0 })}>reset</button>
      </div>
    </div>
  );
}
