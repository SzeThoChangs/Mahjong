/**
 * Real quiz: positions from actual recorded games, graded by the evaluator's
 * measured EV of every legal action. Not heuristics - play-out counts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tile } from '@/components/Tile';
import { PublicTable } from '@/components/PublicTable';
import { tileLabel } from '@/lib/tiles';
import { cn } from '@/lib/utils';
import { CONFIG } from '@/lib/scenario';
import { priceMix, type OutcomeMix } from '@/lib/money';
import { loadConfig } from '@/components/TableSetup';
import { rankDiscards, handValue, claimRank, claimReasons, claimCandidateOf, policyRank, type Context } from 'sg-mahjong-solver';
import type { Meld } from 'sg-mahjong-engine';

const WIND = ['東', '南', '西', '北'];
/** the small caption that says what a run of tiles actually IS */
const LABEL = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground';

interface PackIx { id: string; money: boolean; unit: string; questions: number }
// `se` = paired standard error of (best.ev - this.ev): how far apart two moves must sit before
// the play-outs can tell them apart. Packs built before 2026-08-26 have no `se` field.
interface Action { a: string; ev: number; se?: number; win: number; dealin: number; draw: number; n?: number; mix?: OutcomeMix }
// `disc` = the discard pool as [seat, kind, claimedBy]; `pm` / `pb` = every seat's exposed melds and
// bonus tiles. Packs built before 2026-08-26 lack them, so every use is guarded.
interface Q { id: string; k: string; seat: number; dl?: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; disc?: number[][]; pm?: number[][][]; pb?: number[][]; bot: string; spread: number; best: string; sel: string; n: number; actions: Action[] }
type Verdict = 'best' | 'unclear' | 'fine' | 'mistake' | 'blunder';

const VERDICT_STYLE: Record<Verdict, string> = {
  best: 'bg-emerald-600 text-white', unclear: 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-50',
  fine: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  mistake: 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50', blunder: 'bg-red-600 text-white',
};
const VERDICT_TEXT: Record<Verdict, string> = { best: 'Best move', unclear: 'Too close to call', fine: 'Close enough', mistake: 'Mistake', blunder: 'Big mistake' };

/**
 * Nothing inside the measurement error may be called a mistake. At 128 play-outs the paired error
 * on this dataset averages about a chip, which is larger than the old fixed 0.35 / 1.5 bands - so
 * the bands are floored at the position's own error bar and only widen when it is the binding one.
 */
const verdictOf = (regret: number, unit: string, se = 0): Verdict => {
  const [fine, mistake] = unit === '$' ? [0.35, 1.5] : [0.8, 3.5];
  if (regret <= 0.01) return 'best';
  if (regret <= se) return 'unclear';
  if (regret <= Math.max(fine, 2 * se)) return 'fine';
  if (regret <= Math.max(mistake, 3 * se)) return 'mistake';
  return 'blunder';
};
/** The recount runs in the dev server's /api/challenge middleware; a static build has no such route. */
const CAN_CHALLENGE = import.meta.env.DEV;

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
  const [score, setScore] = useState({ best: 0, unclear: 0, fine: 0, mistake: 0, blunder: 0, lost: 0, streak: 0 });
  const [runId, setRunId] = useState<string | null>(null);   // from the pack we already have; refetching it costs 10MB
  const [challenging, setChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState<null | { error?: string; stale?: boolean; ms?: number; ev?: { best: string; actions: Action[]; n: number } }>(null);

  useEffect(() => { fetch('/quiz/index.json').then((r) => r.json()).then((d: { packs: PackIx[] }) => { setPacks(d.packs); if (d.packs[0]) setPack(d.packs[0].id); }).catch(() => setPacks([])); }, []);
  useEffect(() => {
    if (!pack) return;
    fetch(`/quiz/${pack}.json`).then((r) => r.json()).then((d: { unit: string; run?: string; questions: Q[] }) => {
      setUnit(d.unit); setQs(d.questions); setRunId(d.run ?? null);
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
      // everything the player can see that is not their own concealed hand or own melds, so the
      // coach stops counting four copies of a tile that is already dead on the table
      const visible: number[] = [];
      for (const d of q.disc ?? []) visible.push(d[1]!);
      (q.pm ?? []).forEach((seatMelds, s) => { if (s !== q.seat) for (const meld of seatMelds) visible.push(...meld.slice(2)); });
      (q.pb ?? []).forEach((bonus, s) => { if (s !== q.seat) visible.push(...bonus); });
      const ctx: Context = {
        seat: q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat, prevailingWind: q.w, bonus: q.b, playerTurns: q.t,
        minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
        visible,
        opponentMelds: (q.pm ?? []).map((ms, s2) => (s2 === q.seat ? -1 : ms.length)).filter((n) => n >= 0),
      };
      if (q.k === 'discard' && q.h.length % 3 === 2) {
        const r = rankDiscards(q.h, melds, ctx);
        return { plan: r.plan, detail: r.planDetail, best: r.best.tile, tied: r.tied, reasonFor: (k: number) => r.options.find((o) => o.tile === k)?.reasons ?? [], reasonForAction: () => [] as string[] };
      }
      const hv = handValue({ concealed: q.h, melds }, ctx);
      // A claim question used to come back with no reasons at all, so the memo could say what the
      // money was and never why. `claimReasons` reads out the same quantities the claim model
      // scores - what the call buys in distance, what it buys in tai, and what it costs in cover.
      const reasonForAction = (a: string): string[] => {
        if (q.k !== 'claim' || !q.ld) return [];
        const c = claimCandidateOf(a, q.ld[1]!);
        if (!c) return [];
        try { return claimReasons(c, q.h, melds, q.ld[1]!, ctx); } catch { return []; }
      };
      return { plan: hv.best.id.replace('_', '-'), detail: [], best: null as number | null, tied: [] as number[], reasonFor: () => [] as string[], reasonForAction };
    } catch { return null; }
  }, [q]);

  // What the learned models would do here. Grading stays on the measured EVs - those are the
  // authority in this tab - but the models are what the Train tab teaches, so showing their answer
  // beside the measurement is how you find out where they are wrong.
  const modelPick = useMemo(() => {
    if (!q) return null;
    try {
      const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
      const visible: number[] = [];
      for (const d of q.disc ?? []) visible.push(d[1]!);
      (q.pm ?? []).forEach((ms, s) => { if (s !== q.seat) for (const m of ms) visible.push(...m.slice(2)); });
      (q.pb ?? []).forEach((bs, s) => { if (s !== q.seat) visible.push(...bs); });
      const ctx: Context = {
        seat: q.dl !== undefined ? (q.seat - q.dl + 4) % 4 : q.seat, prevailingWind: q.w, bonus: q.b, playerTurns: q.t,
        minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
        visible, opponentMelds: (q.pm ?? []).map((ms, s) => (s === q.seat ? -1 : ms.length)).filter((n) => n >= 0),
      };
      if (q.k === 'discard' && q.h.length % 3 === 2) return `d:${policyRank(q.h, melds, ctx).best}`;
      if (q.k === 'claim' && q.ld) {
        const offered = q.ld[1]!;
        const acts = q.actions.map((a) => a.a);
        const cands = acts.map((a) => claimCandidateOf(a, offered));
        if (cands.some((c) => c === null)) return null;
        const r = claimRank(cands.map((c) => c!), q.h, melds, offered, ctx);
        return acts[cands.findIndex((c) => c === r.best)] ?? null;
      }
      return null;
    } catch { return null; }
  }, [q]);

  const fmt = (x: number) => `${x < 0 ? '−' : ''}${unit === '$' ? '$' : ''}${Math.abs(x).toFixed(2)}${unit === '$' ? '' : ''}`;

  // If the evaluator recorded an outcome mix, re-price every action under the table config the user set.
  // Both memos stay above the early returns below: a hook that only runs on some renders breaks the hook order.
  const money = useMemo(() => loadConfig(), []);
  const actions = useMemo(() => {
    if (!q?.actions?.some((a) => a.mix)) return q?.actions ?? [];
    const out = q.actions.map((a) => (a.mix ? { ...a, ev: priceMix(a.mix, a.n ?? 128, money) } : a)).sort((x, y) => y.ev - x.ev);
    // Re-pricing re-weights the same play-out outcomes, so the error bar moves with the spread it was
    // measured against. Scale it by how much the spread moved rather than keep the recorded number.
    const ev = (xs: Action[]) => Math.max(1e-6, (xs[0]?.ev ?? 0) - (xs[xs.length - 1]?.ev ?? 0));
    const k = Math.min(10, Math.max(0.1, ev(out) / ev(q.actions)));
    return out.map((a) => (a.se === undefined ? a : { ...a, se: a.se * k }));
  }, [q, money]);

  if (!packs.length) return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">No quiz packs found. Run: <code>pnpm -C datagen exec tsx src/quizpack.ts</code></div>;
  if (!q) return null;

  const repriced = !!q?.actions?.some((a) => a.mix);
  // q.n is the play-out BUDGET, not what each move got: successive halving stops rolling out an
  // action once its running mean looks bad, so most moves are estimated on a quarter of it. Show
  // the range that was actually spent rather than the ceiling.
  const counts = q.actions.map((a) => a.n ?? q.n);
  const [lowN, highN] = [Math.min(...counts), Math.max(...counts)];
  const playoutRange = lowN === highN ? `${highN}` : `${lowN}–${highN}`;

  const pickedAction = picked === null ? null : actions.find((a) => a.a === picked) ?? null;
  const bestAction = actions[0]!;
  const regret = pickedAction ? bestAction.ev - pickedAction.ev : 0;
  const pickedSe = pickedAction?.se ?? 0;
  const verdict = pickedAction ? verdictOf(regret, unit, pickedSe) : null;

  const choose = (a: string) => {
    if (picked !== null) return;
    setPicked(a);
    const act = actions.find((x) => x.a === a)!;
    const v = verdictOf(bestAction.ev - act.ev, unit, act.se ?? 0);
    const kept = v === 'best' || v === 'fine' || v === 'unclear';
    setScore((s) => ({ ...s, [v]: s[v] + 1, lost: s.lost + (bestAction.ev - act.ev), streak: kept ? s.streak + 1 : 0 }));
  };
  const next = () => { setPicked(null); setChallengeResult(null); setPos((p) => p + 1); };
  const runsChallenge = async () => {
    if (!pack || picked === null) return;
    setChallenging(true); setChallengeResult(null);
    try {
      const res = await fetch(`/api/challenge?run=${runId ?? pack}&id=${q.id}&hand=${q.h.join(',')}&rollouts=512`).then((r) => r.json());
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
          <span className="ml-auto text-xs text-muted-foreground">a real position · {playoutRange} play-outs per move{repriced ? ' · priced at your table' : ''}</span>
        </CardContent>
      </Card>

      <PublicTable
        you={q.seat}
        centre={<div className="text-center leading-tight">
          <div className="text-lg font-semibold">{WIND[q.w]}圈</div>
          <div className="text-xs text-muted-foreground">第{Math.max(1, Math.ceil(q.t / 4))}巡</div>
        </div>}
        seats={[0, 1, 2, 3].map((s) => ({
        wind: WIND[q.dl !== undefined ? (s - q.dl + 4) % 4 : s]!,
        you: s === q.seat,
        dealer: s === q.dl,
        // your own flowers and sets belong to the hand card below, where they are labelled "Your ...".
        // Showing them here too printed them twice, from two sources that could disagree.
        bonus: s === q.seat ? [] : (q.pb ?? [])[s] ?? [],
        // a meld row is [type, concealed, ...tiles]
        melds: s === q.seat ? [] : ((q.pm ?? [])[s] ?? []).map((m) => ({ tiles: m.slice(2), concealed: m[1] === 1 })),
        // [seat, kind, claimedBy] - claimedBy >= 0 means it left the floor into someone's set
        discards: (q.disc ?? []).filter((d) => d[0] === s).map((d) => ({ kind: d[1]!, claimed: d[2]! >= 0 })),
        }))} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">
          {q.k === 'discard' ? 'Which tile do you discard?' : q.k === 'claim' ? <>{q.ld ? <>{WIND[q.ld[0]]} discarded <b>{tileLabel(q.ld[1]!)}</b> — claim or pass?</> : 'Claim or pass?'}</> : 'Kong, or keep the hand as it is?'}
        </CardTitle></CardHeader>
        <CardContent className="space-y-3 @container">
          {(q.m.length > 0 || q.b.length > 0) && (
            <div className="flex flex-nowrap items-end gap-x-4 pb-1 border-b">
              {q.b.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className={LABEL}>Your flowers</span>
                  <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1">{q.b.map((k, i) => <Tile key={i} kind={k} size="md" fluid />)}</div>
                </div>
              )}
              {q.m.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className={LABEL}>Your open sets</span>
                  <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1">
                    {q.m.map((m, i) => (
                      <span key={i} className="flex gap-0.5 sm:gap-1 mr-2 last:mr-0">{m.slice(2).map((k, j) => <Tile key={j} kind={k} size="md" fluid concealed={m[1] === 1} />)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {(q.m.length > 0 || q.b.length > 0) && <span className={cn(LABEL, 'block')}>In your hand — concealed</span>}
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
                {verdict === 'unclear' && pickedSe > 0 && <> These {q.n} play-outs resolve a gap of about <b>{fmt(pickedSe)}</b>, so this one is inside the noise — not a worse move, just an unmeasurable one.</>}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">the {q.bot} bot chose {actionText(q.sel).toLowerCase()}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {coach && (
              <div className="mb-3 rounded-md border bg-secondary/40 p-3 text-sm space-y-1">
                {/* The models are what the Train tab teaches. Measured EVs are the authority here,
                    so this is the place their disagreements with the measurement show up. */}
                {modelPick !== null && (
                  <div className="pb-1 mb-1 border-b">
                    <span className="text-muted-foreground">The learned model would</span> <b>{actionText(modelPick).toLowerCase()}</b>.
                    {modelPick === bestAction.a
                      ? <span className="text-emerald-700 dark:text-emerald-300"> Agrees with the measurement.</span>
                      : <span className="text-amber-700 dark:text-amber-300"> The measurement disagrees — trust the bars here.</span>}
                  </div>
                )}
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
                {/* the same for claims: what the best call buys, and what yours did instead */}
                {q.k === 'claim' && coach.reasonForAction(bestAction.a).length > 0 && (
                  <div><span className="text-muted-foreground">Why {actionText(bestAction.a).toLowerCase()}:</span> {coach.reasonForAction(bestAction.a).join(' · ')}</div>
                )}
                {q.k === 'claim' && picked !== null && picked !== bestAction.a && coach.reasonForAction(picked).length > 0 && (
                  <div><span className="text-muted-foreground">Your {actionText(picked).toLowerCase()}:</span> {coach.reasonForAction(picked).join(' · ')}</div>
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
                    {a.se ? (   // ±1 SE: how far this bar could slide on a re-run. Overlapping whiskers = not separated.
                      <div className="absolute inset-y-1 border-x-2 border-foreground/35"
                        style={{ left: `${(Math.max(min, a.ev - a.se) - min) / span * 100}%`, width: `${(Math.min(max, a.ev + a.se) - Math.max(min, a.ev - a.se)) / span * 100}%` }} />
                    ) : null}
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
              {/* /api/challenge is a Vite dev-server middleware (vite.config.ts); the deployed site is
                  static, so the button would only ever 404 there. Show it where it can actually run. */}
              {CAN_CHALLENGE && <Button variant="outline" disabled={challenging} onClick={runsChallenge}>{challenging ? 'Re-judging — up to a minute…' : 'Challenge the verdict (512 play-outs)'}</Button>}
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
                      <div className="text-muted-foreground">512 fresh play-outs per move: your {picked !== null ? actionText(picked).toLowerCase() : ''} {nPick ? fmt(nPick.ev) : '?'} vs best {actionText(nBest.a).toLowerCase()} {fmt(nBest.ev)} (was {fmt(bestAction.ev)} at {bestAction.n ?? q.n}).</div>
                      {nPick && (() => {
                        // the recount buys precision as 1/sqrt(n), so its resolution is the pack's scaled by
                        // sqrt(n_pack / n_recount) - using the PICKED move's own count, not the budget
                        const res = pickedSe > 0 ? pickedSe * Math.sqrt((pickedAction.n ?? q.n) / Math.max(1, challengeResult.ev!.n)) : 0.3;
                        return Math.abs(nBest.ev - nPick.ev) < res
                          ? <div className="text-muted-foreground">Gap under {fmt(res)} — still inside what {challengeResult.ev!.n} play-outs can resolve; call it a coin flip.</div>
                          : null;
                      })()}
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
        <Badge variant="outline" className="border-slate-400 text-slate-600 dark:text-slate-300">too close to call {score.unclear}</Badge>
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">mistake {score.mistake}</Badge>
        <Badge variant="outline" className="border-red-600 text-red-700 dark:text-red-300">blunder {score.blunder}</Badge>
        <span>· given up {fmt(score.lost)} · streak {score.streak}</span>
        <button className="underline ml-auto" onClick={() => setScore({ best: 0, unclear: 0, fine: 0, mistake: 0, blunder: 0, lost: 0, streak: 0 })}>reset</button>
      </div>
    </div>
  );
}
