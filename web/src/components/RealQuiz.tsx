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
import { CONFIG } from '@/lib/scenario';
import { priceMix, type OutcomeMix } from '@/lib/money';
import { loadConfig } from '@/components/TableSetup';
import { rankDiscards, handValue, type Context } from 'sg-mahjong-solver';
import type { Meld } from 'sg-mahjong-engine';

const WIND = ['東', '南', '西', '北'];

interface PackIx { id: string; money: boolean; unit: string; questions: number }
interface Action { a: string; ev: number; win: number; dealin: number; draw: number; n?: number; mix?: OutcomeMix }
interface Q { id: string; k: string; seat: number; dl?: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; bot: string; spread: number; best: string; sel: string; n: number; actions: Action[] }
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
  const [challenging, setChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState<null | { error?: string; stale?: boolean; ms?: number; ev?: { best: string; actions: Action[]; n: number } }>(null);

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
  // The coach (book heuristics) explains the position; the measured EVs above remain the authority.
  const coach = useMemo(() => {
    if (!q) return null;
    try {
      const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
      const ctx: Context = {
        seat: q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat, prevailingWind: q.w, bonus: q.b, playerTurns: q.t,
        minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
      };
      if (q.k === 'discard' && q.h.length % 3 === 2) {
        const r = rankDiscards(q.h, melds, ctx);
        return { plan: r.plan, detail: r.planDetail, best: r.best.tile, tied: r.tied, reasonFor: (k: number) => r.options.find((o) => o.tile === k)?.reasons ?? [] };
      }
      const hv = handValue({ concealed: q.h, melds }, ctx);
      return { plan: hv.best.id.replace('_', '-'), detail: [], best: null as number | null, tied: [] as number[], reasonFor: () => [] as string[] };
    } catch { return null; }
  }, [q]);

  const fmt = (x: number) => `${x < 0 ? '−' : ''}${unit === '$' ? '$' : ''}${Math.abs(x).toFixed(2)}${unit === '$' ? '' : ''}`;

  if (!packs.length) return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">No quiz packs found. Run: <code>pnpm -C datagen exec tsx src/quizpack.ts</code></div>;
  if (!q) return null;

  // If the evaluator recorded an outcome mix, re-price every action under the table config the user set.
  const money = useMemo(() => loadConfig(), []);
  const actions = useMemo(() => {
    if (!q?.actions?.some((a) => a.mix)) return q?.actions ?? [];
    return [...q.actions].map((a) => (a.mix ? { ...a, ev: priceMix(a.mix, a.n ?? 128, money) } : a)).sort((x, y) => y.ev - x.ev);
  }, [q, money]);
  const repriced = !!q?.actions?.some((a) => a.mix);

  const pickedAction = picked === null ? null : actions.find((a) => a.a === picked) ?? null;
  const bestAction = actions[0]!;
  const regret = pickedAction ? bestAction.ev - pickedAction.ev : 0;
  const verdict = pickedAction ? verdictOf(regret, unit) : null;

  const choose = (a: string) => {
    if (picked !== null) return;
    setPicked(a);
    const act = actions.find((x) => x.a === a)!;
    const v = verdictOf(bestAction.ev - act.ev, unit);
    setScore((s) => ({ ...s, [v]: s[v] + 1, lost: s.lost + (bestAction.ev - act.ev), streak: v === 'best' || v === 'fine' ? s.streak + 1 : 0 }));
  };
  const next = () => { setPicked(null); setChallengeResult(null); setPos((p) => p + 1); };
  const runsChallenge = async () => {
    if (!pack || picked === null) return;
    setChallenging(true); setChallengeResult(null);
    try {
      const packMeta = await fetch(`/quiz/${pack}.json`).then((r) => r.json()) as { run: string };
      const res = await fetch(`/api/challenge?run=${packMeta.run}&id=${q.id}&hand=${q.h.join(',')}&rollouts=512`).then((r) => r.json());
      setChallengeResult(res);
    } catch { setChallengeResult({ error: 'challenge needs the local dev server' }); }
    setChallenging(false);
  };

  const discardKinds = new Set(q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2))));
  const sorted = [...q.h].sort((a, b) => a - b);
  const drIdx = q.dr !== null ? sorted.indexOf(q.dr) : -1;
  const handTiles = drIdx >= 0 ? [...sorted.slice(0, drIdx), ...sorted.slice(drIdx + 1)] : sorted;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {packs.map((p) => <Button key={p.id} size="sm" variant={p.id === pack ? 'default' : 'outline'} onClick={() => setPack(p.id)}>{p.id} · {p.questions}{p.money ? ' · $' : ''}</Button>)}
        <span className="ml-auto" />
        {(['all', 'discard', 'claim'] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? 'secondary' : 'ghost'} onClick={() => { setMode(m); setPicked(null); }}>{m}</Button>)}
      </div>

      <Card>
        <CardContent className="pt-4 !flex !flex-row flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {q.dl !== undefined ? (() => { const role = (q.seat - q.dl! + 4) % 4; const doubleWind = role === q.w; return (
            <>
              <span>Seat <b>{q.seat + 1}</b> · you are <b>{WIND[role]}</b></span>
              <span className="text-muted-foreground">Host: seat <b className="text-foreground">{q.dl! + 1}</b>{q.dl === q.seat ? ' (you)' : ''}</span>
              <span className="text-muted-foreground">Round <b className="text-foreground">{WIND[q.w]}</b></span>
              <span className="flex items-center gap-1 text-muted-foreground">tai winds:
                <Tile kind={27 + q.w} size="sm" /><Tile kind={27 + role} size="sm" className={cn(doubleWind && '-ml-4')} />
                {doubleWind && <Badge variant="outline">double!</Badge>}
              </span>
            </>
          ); })() : (
            <>
              <span>You are <b>{WIND[q.seat]}</b></span>
              <span className="text-muted-foreground">Round <b className="text-foreground">{WIND[q.w]}</b></span>
            </>
          )}
          <span className="text-muted-foreground"><b className="text-foreground">第{Math.max(1, Math.ceil(q.t / 4))}巡</b></span>
          <span className="text-muted-foreground">Tai in hand <b className="text-foreground">{q.fih}</b></span>
          <span className="ml-auto text-xs text-muted-foreground">a real position · {q.n} play-outs per move{repriced ? ' · priced at your table' : ''}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">
          {q.k === 'discard' ? 'Which tile do you discard?' : q.k === 'claim' ? <>{q.ld ? <>{WIND[q.ld[0]]} discarded <b>{tileLabel(q.ld[1]!)}</b> — claim or pass?</> : 'Claim or pass?'}</> : 'Kong, or keep the hand as it is?'}
        </CardTitle></CardHeader>
        <CardContent className="space-y-3 @container">
          {(q.m.length > 0 || q.b.length > 0) && (
            <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1.5 pb-1 border-b">
              {q.b.length > 0 && <span className="flex gap-0.5 sm:gap-1 mr-3">{q.b.map((k, i) => <Tile key={i} kind={k} size="md" fluid className="opacity-90" />)}</span>}
              {q.m.map((m, i) => (
                <span key={i} className="flex gap-0.5 sm:gap-1 mr-2">{m.slice(2).map((k, j) => <Tile key={j} kind={k} size="md" fluid dim={m[1] === 1} />)}</span>
              ))}
            </div>
          )}
          <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1.5">
            {handTiles.map((k, i) => (
              <Tile key={i} kind={k} size="md" fluid
                onClick={q.k === 'discard' && picked === null && discardKinds.has(k) ? () => choose(`d:${k}`) : undefined}
                dim={picked !== null && !(kindsOf(q.actions[0]!.a).includes(k) && q.actions[0]!.a.startsWith('d:')) && `d:${k}` !== picked}
                highlight={picked !== null && q.actions[0]!.a === `d:${k}`} />
            ))}
            {q.dr !== null && (
              <><div className="w-2 shrink-0" />
                <Tile kind={q.dr} size="md" badge="drew" fluid
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
            {coach && (
              <div className="mb-3 rounded-md border bg-secondary/40 p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">Coach reads this as</span> <b>{coach.plan}</b>.
                  {coach.best !== null && bestAction.a.startsWith('d:') && (
                    coach.best === Number(bestAction.a.slice(2))
                      ? <span className="text-emerald-700 dark:text-emerald-300"> Agrees with the measurement.</span>
                      : <span className="text-amber-700 dark:text-amber-300"> It would throw {tileLabel(coach.best)} — the measurement disagrees, so trust the bars.</span>
                  )}
                </div>
                {coach.detail.filter((l) => !/^Next best plan/.test(l)).map((l, i) => (
                  <div key={i} className="text-muted-foreground">{l.replace(/ → about [+-]?[\d.]+ chips\/game at turn \d+\./, '.')}</div>
                ))}
                {bestAction.a.startsWith('d:') && coach.reasonFor(Number(bestAction.a.slice(2))).length > 0 && (
                  <div><span className="text-muted-foreground">Why {tileLabel(Number(bestAction.a.slice(2)))}:</span> {coach.reasonFor(Number(bestAction.a.slice(2))).join(' · ')}</div>
                )}
                {picked !== null && picked !== bestAction.a && picked.startsWith('d:') && coach.reasonFor(Number(picked.slice(2))).length > 0 && (
                  <div><span className="text-muted-foreground">Your {tileLabel(Number(picked.slice(2)))}:</span> {coach.reasonFor(Number(picked.slice(2))).join(' · ')}</div>
                )}
              </div>
            )}
            {actions.map((a) => {
              const isBest = a.a === bestAction.a, isPick = a.a === picked;
              const min = Math.min(...actions.map((x) => x.ev), 0), max = Math.max(...actions.map((x) => x.ev), 0), span = Math.max(1e-6, max - min);
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
            <div className="pt-2 flex items-center gap-2">
              <Button onClick={next}>Next position</Button>
              <Button variant="outline" disabled={challenging} onClick={runsChallenge}>{challenging ? 'Re-judging — up to a minute…' : 'Challenge the verdict (512 play-outs)'}</Button>
            </div>
            {challengeResult && (
              <div className="mt-2 rounded-md border p-3 text-sm space-y-1">
                {challengeResult.error && <div className="text-muted-foreground">{challengeResult.error}</div>}
                {challengeResult.ev && (() => {
                  const na = challengeResult.ev.actions;
                  const nBest = na[0]!;
                  const nPick = na.find((a) => a.a === picked);
                  const overturned = picked !== null && nBest.a === picked && bestAction.a !== picked;
                  const stillBest = nBest.a === bestAction.a;
                  return (
                    <>
                      <div className="font-medium">{overturned ? '🎉 Overturned — the recount says YOUR move is best.' : stillBest ? 'Verdict stands on the recount.' : `The recount prefers ${actionText(nBest.a).toLowerCase()} — a genuinely close position.`}</div>
                      <div className="text-muted-foreground">512 fresh play-outs per move: your {picked !== null ? actionText(picked).toLowerCase() : ''} {nPick ? fmt(nPick.ev) : '?'} vs best {actionText(nBest.a).toLowerCase()} {fmt(nBest.ev)} (was {fmt(bestAction.ev)} at {q.n}).</div>
                      {nPick && Math.abs(nBest.ev - nPick.ev) < 0.3 && <div className="text-muted-foreground">Gap under 0.3 — call it a coin flip; either move is fine at the table.</div>}
                    </>
                  );
                })()}
              </div>
            )}
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
