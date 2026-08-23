import { useEffect, useMemo, useRef, useState } from 'react';
import { fanInHand, type TileKind } from 'sg-mahjong-engine';
import type { DiscardOption, Verdict } from 'sg-mahjong-solver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Tile } from '@/components/Tile';
import { tileLabel } from '@/lib/tiles';
import { makeScenario, CONFIG, type Phase, type Scenario } from '@/lib/scenario';
import { cn } from '@/lib/utils';

const WIND_NAME = ['東', '南', '西', '北'];
const VERDICT_STYLE: Record<Verdict, string> = {
  best: 'bg-emerald-600 text-white', fine: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  mistake: 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50', blunder: 'bg-red-600 text-white',
};
const VERDICT_TEXT: Record<Verdict, string> = { best: 'Best', fine: 'Also fine', mistake: 'Mistake', blunder: 'Big mistake' };

type Score = { best: number; fine: number; mistake: number; blunder: number; streak: number };

export default function Trainer() {
  const [phase, setPhase] = useState<Phase>('any');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [pick, setPick] = useState<TileKind | null>(null);
  const [score, setScore] = useState<Score>({ best: 0, fine: 0, mistake: 0, blunder: 0, streak: 0 });
  const [showAll, setShowAll] = useState(false);

  // Scenarios are generated off the click path: the current one is computed when needed,
  // and the NEXT one is prefetched in the background while you think.
  const cache = useRef(new Map<string, Scenario>());
  const build = (sd: number, ph: Phase) => {
    const key = `${ph}:${sd}`;
    let sc = cache.current.get(key);
    if (!sc) { const wantInteresting = ((sd * 9301 + 49297) % 233280) / 233280 < 0.7; sc = makeScenario(sd, ph, wantInteresting); cache.current.set(key, sc); }
    return sc;
  };
  const scenario = useMemo(() => build(seed, phase), [seed, phase]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = window.setTimeout(() => build(seed + 1, phase), 30); return () => window.clearTimeout(id); }, [seed, phase]);  // eslint-disable-line react-hooks/exhaustive-deps

  const sortedHand = useMemo(() => {
    const h = [...scenario.hand].sort((a, b) => a - b);
    if (scenario.drawn !== null) { const i = h.indexOf(scenario.drawn); if (i >= 0) h.splice(i, 1); }
    return h;
  }, [scenario]);

  const fan = fanInHand({ melds: scenario.melds, bonus: scenario.bonus, seat: scenario.seat, prevailingWind: scenario.prevailingWind });
  const picked: DiscardOption | undefined = pick === null ? undefined : scenario.ranking.options.find((o) => o.tile === pick);

  const choose = (k: TileKind) => {
    if (pick !== null) return;
    setPick(k);
    const v = scenario.ranking.options.find((o) => o.tile === k)!.verdict;
    setScore((s) => ({ ...s, [v]: s[v] + 1, streak: v === 'best' || v === 'fine' ? s.streak + 1 : 0 }));
  };
  const next = () => { setPick(null); setShowAll(false); setSeed((s) => s + 1); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Which tile?</h1>
            <p className="text-sm text-muted-foreground">Singapore mahjong discard trainer · Min {CONFIG.minimum_fan} / Max {CONFIG.fan_limit} · self-draw wins at {CONFIG.self_draw_minimum_fan}</p>
          </div>
          <Tabs value={phase} onValueChange={(v) => { setPhase(v as Phase); setPick(null); setShowAll(false); }}>
            <TabsList>
              <TabsTrigger value="early">Early</TabsTrigger>
              <TabsTrigger value="mid">Mid</TabsTrigger>
              <TabsTrigger value="late">Late</TabsTrigger>
              <TabsTrigger value="any">Any</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        {/* context */}
        <Card>
          <CardContent className="pt-5 !flex !flex-row flex-wrap items-center justify-start gap-x-6 gap-y-3 text-sm">
            {(() => { const role = (scenario.seat - scenario.dealer + 4) % 4; const dbl = role === scenario.prevailingWind; return (<>
            <div>Seat <b>{scenario.seat + 1}</b> · you are <b>{WIND_NAME[role]}</b></div>
            <div><span className="text-muted-foreground">Host: seat</span> <b>{scenario.dealer + 1}</b>{scenario.dealer === scenario.seat ? ' (you)' : ''}</div>
            <div><span className="text-muted-foreground">Round</span> <b>{WIND_NAME[scenario.prevailingWind]}</b></div>
            <div className="flex items-center gap-1"><span className="text-muted-foreground">tai winds</span>
              <Tile kind={27 + scenario.prevailingWind} size="sm" /><Tile kind={27 + role} size="sm" className={dbl ? '-ml-4' : ''} />
              {dbl && <span className="text-xs text-muted-foreground">double!</span>}
            </div>
            </>); })()}
            <div><b>第{Math.max(1, Math.ceil(scenario.playerTurns / 4))}巡</b> <span className="text-muted-foreground">({scenario.phase} game)</span></div>
            <div><span className="text-muted-foreground">Fan in hand</span> <b>{fan}</b>{fan < CONFIG.minimum_fan && <span className="text-muted-foreground"> — need {CONFIG.minimum_fan} to win on a discard</span>}</div>
          </CardContent>
        </Card>

        {/* hand */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{pick === null ? 'Which tile do you discard? Tap one.' : 'Your hand'}</CardTitle></CardHeader>
          <CardContent className="@container">
            {(scenario.melds.length > 0 || scenario.bonus.length > 0) && (
              <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1.5 pb-2 mb-2 border-b">
                {scenario.bonus.length > 0 && <span className="flex gap-0.5 sm:gap-1 mr-3">{scenario.bonus.map((k, i) => <Tile key={i} kind={k} size="md" fluid className="opacity-90" />)}</span>}
                {scenario.melds.map((m, i) => (
                  <span key={i} className="flex gap-0.5 sm:gap-1 mr-2">{m.tiles.map((k, j) => <Tile key={j} kind={k} size="md" fluid dim={m.concealed} />)}</span>
                ))}
              </div>
            )}
            <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1.5">
              {sortedHand.map((k, i) => (
                <Tile key={i} kind={k} size="md" fluid onClick={pick === null ? () => choose(k) : undefined}
                  highlight={pick !== null && k === scenario.ranking.best.tile} dim={pick !== null && k !== pick && k !== scenario.ranking.best.tile} />
              ))}
              {scenario.drawn !== null && (
                <>
                  <div className="w-2 shrink-0" />
                  <Tile kind={scenario.drawn} size="md" fluid badge="drew" onClick={pick === null ? () => choose(scenario.drawn!) : undefined}
                    highlight={pick !== null && scenario.drawn === scenario.ranking.best.tile} dim={pick !== null && scenario.drawn !== pick && scenario.drawn !== scenario.ranking.best.tile} />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* verdict */}
        {picked && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={cn('text-sm px-3 py-1', VERDICT_STYLE[picked.verdict])}>{VERDICT_TEXT[picked.verdict]}</Badge>
                <div className="text-sm">
                  You discarded <b>{tileLabel(picked.tile)}</b>.{' '}
                  {picked.verdict === 'best' ? 'Same as the coach.' : <>Coach discards <b>{tileLabel(scenario.ranking.best.tile)}</b>{picked.delta < 0 && <span className="text-muted-foreground"> ({picked.delta.toFixed(1)} chips/game)</span>}.</>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="font-medium">Plan: {scenario.ranking.plan}</div>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-0.5">{scenario.ranking.planDetail.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReasonBox title={`Why ${tileLabel(scenario.ranking.best.tile)}`} opt={scenario.ranking.best} />
                {picked.verdict !== 'best' && <ReasonBox title={`About your ${tileLabel(picked.tile)}`} opt={picked} />}
              </div>
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={next}>Next hand</Button>
                <Button variant="outline" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Hide' : 'Show'} every option</Button>
                <span className="ml-auto text-xs text-muted-foreground">{scenario.interesting ? 'picked as a teaching hand' : 'random deal'}</span>
              </div>
              {showAll && (
                <div className="space-y-1.5">
                  {scenario.ranking.options.map((o) => (
                    <div key={o.tile} className="flex items-center gap-3 rounded-md border px-2 py-1.5">
                      <Tile kind={o.tile} size="sm" />
                      <Badge className={cn('w-24 justify-center', VERDICT_STYLE[o.verdict])}>{VERDICT_TEXT[o.verdict]}</Badge>
                      <span className="w-14 tabular-nums text-muted-foreground">{o.delta === 0 ? '—' : o.delta.toFixed(1)}</span>
                      <span className="text-muted-foreground truncate">{o.reasons.join(' · ') || `plan: ${o.target.id.replace('_', ' ')}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* session */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>This session:</span>
          <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:text-emerald-300">best {score.best}</Badge>
          <Badge variant="outline">fine {score.fine}</Badge>
          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">mistake {score.mistake}</Badge>
          <Badge variant="outline" className="border-red-600 text-red-700 dark:text-red-300">big mistake {score.blunder}</Badge>
          <span>· streak {score.streak}</span>
          <button className="underline ml-auto" onClick={() => setScore({ best: 0, fine: 0, mistake: 0, blunder: 0, streak: 0 })}>reset</button>
        </div>
      </div>
    </div>
  );
}

function ReasonBox({ title, opt }: { title: string; opt: DiscardOption }) {
  return (
    <div className="rounded-md border p-3">
      <div className="font-medium mb-1">{title}</div>
      {opt.reasons.length ? <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">{opt.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        : <div className="text-muted-foreground">Keeps the plan on track ({opt.target.id.replace('_', ' ')}); {opt.acceptance} tiles would improve the hand next draw.</div>}
    </div>
  );
}
