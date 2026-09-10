import { useEffect, useMemo, useRef, useState } from 'react';
import { fanInHand, type TileKind } from 'sg-mahjong-engine';
import { suggestCause, CAUSES, causeLabel, type DiscardOption, type Verdict, type Cause } from 'sg-mahjong-solver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Tile } from '@/components/Tile';
import { tileLabel } from '@/lib/tiles';
import { PublicTable } from '@/components/PublicTable';
import { HandContext } from '@/components/HandContext';
import { makeScenario, makeScenarioFor, causeOf, PRACTISABLE, CONFIG, type Difficulty, type Phase, type Scenario } from '@/lib/scenario';
import { recordMistake, setCause, causeTally, readPractise, writePractise } from '@/lib/mistakes';
import { recordPlay } from '@/lib/history';
import { cn } from '@/lib/utils';
import { J } from '@/lib/jargon';

const WIND_NAME = ['東', '南', '西', '北'];
/** the small caption that says what a run of tiles actually IS */
const LABEL = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground';
const VERDICT_STYLE: Record<Verdict, string> = {
  best: 'bg-emerald-600 text-white', fine: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  mistake: 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50', blunder: 'bg-red-600 text-white',
};
const VERDICT_TEXT: Record<Verdict, string> = { best: 'Best', fine: 'Also fine', mistake: 'Mistake', blunder: 'Big mistake' };
/** What kind of question the hand was, so you know whether missing it meant anything. */
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  'toss-up': 'no clear answer',
  plain: 'the obvious throw is right',
  trap: 'trap — the obvious throw is wrong',
};
const EQUAL_TEXT = 'Equal best';

/**
 * The coach grades this tab. That was briefly changed to the model and then changed back, and the
 * reason is worth keeping.
 *
 * Per decision the model looks clearly better: it picks the measured-best tile 70.4% of the time
 * against the coach's 55.7%, and loses $1.29 a decision against $1.35. But played out - 4,800
 * paired deals with the tested bot rotated through all four seats, same walls in both arms - the
 * model LOSES to the coach by 2.66 +/- 0.61 chips a game, negative in all four seats
 * (`solver/src/headtohead.ts`).
 *
 * Per-decision regret against a measured best does not aggregate into winning hands. The likeliest
 * reason is coherence: the coach commits to a target and plays toward it, while the model scores
 * every discard independently and can be locally right all the way to an incoherent hand. Until
 * that is understood, the thing that demonstrably wins money is what the player gets scored on.
 *
 * If the model's play-out result ever turns around, grading on it needs probability bands rather
 * than chips. `solver/src/calibrate.ts` derives them by quantile-matching model probability ratios
 * to the measured regret bands over the quiz pack; it last produced FINE 0.2668 / MISTAKE 0.0091,
 * agreeing with the measured grader 48.9% exactly and 86.1% within one band. Re-run it rather than
 * trusting those numbers - they move with the weights.
 */


type Score = { best: number; fine: number; mistake: number; blunder: number; streak: number };

export default function Trainer() {
  const [phase, setPhase] = useState<Phase>('any');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [pick, setPick] = useState<TileKind | null>(null);
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestCause> | null>(null);
  const [causeChosen, setCauseChosen] = useState<Cause | null>(null);
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
  // Practise mode: draw hands where the cause that keeps coming up in your record actually bites.
  const [practise, setPractiseState] = useState<Cause | null>(() => readPractise());
  const setPractise = (c: Cause | null) => { setPractiseState(c); writePractise(c); setPick(null); setSeed((s) => s + 1); };
  const tally = useMemo(() => (causeTally() as { cause: Cause | 'unsorted'; n: number }[]).filter((t): t is { cause: Cause; n: number } => t.cause !== 'unsorted' && PRACTISABLE.includes(t.cause as Cause)), [pick]);
  const drawn = useMemo(() => (practise ? makeScenarioFor(seed, phase, practise) : { scenario: build(seed, phase), seed, matched: false }), [seed, phase, practise]);  // eslint-disable-line react-hooks/exhaustive-deps
  const scenario = drawn.scenario;
  const teaches = useMemo(() => causeOf(scenario), [scenario]);
  useEffect(() => { const id = window.setTimeout(() => build(seed + 1, phase), 30); return () => window.clearTimeout(id); }, [seed, phase]);  // eslint-disable-line react-hooks/exhaustive-deps

  const sortedHand = useMemo(() => {
    const h = [...scenario.hand].sort((a, b) => a - b);
    if (scenario.drawn !== null) { const i = h.indexOf(scenario.drawn); if (i >= 0) h.splice(i, 1); }
    return h;
  }, [scenario]);

  const fan = fanInHand({ melds: scenario.melds, bonus: scenario.bonus, seat: (scenario.seat - scenario.dealer + 4) % 4, prevailingWind: scenario.prevailingWind });

  // --- the grader: the book coach, because it is what wins money in play (see above) ---
  const coachPick = scenario.ranking.best.tile;
  const coachTied = scenario.ranking.tied;
  const picked: DiscardOption | undefined = pick === null ? undefined : scenario.ranking.options.find((o) => o.tile === pick);
  const pickedVerdict: Verdict | null = picked ? picked.verdict : null;
  const gradedPick = coachPick;
  const gradedTied = coachTied;
  const gradedAnswerOpt = scenario.ranking.best;

  const choose = (k: TileKind) => {
    if (pick !== null) return;
    setPick(k);
    const opt = scenario.ranking.options.find((o) => o.tile === k)!;
    const v = opt.verdict;
    setScore((s) => ({ ...s, [v]: s[v] + 1, streak: v === 'best' || v === 'fine' ? s.streak + 1 : 0 }));
    // Every hand goes in the log, not just the ones that went wrong, so any of them can be opened
    // again and explained. The record below keeps only mistakes, and keeps them to ask rather than
    // to tell.
    recordPlay({ judge: 'coach', seed, phase, threw: k, best: coachPick, verdict: v, cost: opt.delta,
      right: v === 'best' || v === 'fine' });
    // A mistake you never meet again is a mistake you keep making. The position is rebuilt from the
    // seed, so the record is a few bytes rather than a hand.
    if (v === 'mistake' || v === 'blunder') {
      // Half the sorting can be read off the position - which tip the throw broke, whether it cost
      // a step, whether it was the wrong plan or the more dangerous tile. The other half is the
      // question below, because only you know whether you saw it and threw the other tile anyway.
      const sug = suggestCause(scenario.hand, scenario.melds, {
        bonus: scenario.bonus, seat: (scenario.seat - scenario.dealer + 4) % 4, prevailingWind: scenario.prevailingWind,
        melds: scenario.melds, minimumFan: CONFIG.minimum_fan, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
      }, scenario.ranking.options, k, coachPick);
      setSuggestion(sug);
      setCauseChosen(null);
      recordMistake({
        seed, phase, picked: k, coachPick, verdict: v, cost: opt.delta,
        why: scenario.ranking.best.reasons[0] ?? '',
        suggested: sug.suggested, ...(sug.tip ? { tip: sug.tip } : {}),
      });
    }
  };
  const chooseCause = (c: Cause) => { setCauseChosen(c); setCause(`${phase}:${seed}`, c); };
  const next = () => { setPick(null); setShowAll(false); setSuggestion(null); setCauseChosen(null); setSeed(drawn.seed + 1); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Which tile?</h1>
            <p className="text-sm text-muted-foreground">Singapore mahjong discard trainer · Min {CONFIG.minimum_fan} / Max {CONFIG.fan_limit} <J>Tai</J> · <J>Zi Mo</J> wins at {CONFIG.self_draw_minimum_fan}</p>
          </div>
          <Tabs value={phase} onValueChange={(v) => { setPhase(v as Phase); setPick(null); setShowAll(false); }}>
            <TabsList>
              <TabsTrigger value="early">Early</TabsTrigger>
              <TabsTrigger value="mid">Mid</TabsTrigger>
              <TabsTrigger value="late">Late</TabsTrigger>
              <TabsTrigger value="any">Any</TabsTrigger>
            </TabsList>
          </Tabs>
          {/* the eighth idea, pointed: hands where the cause that keeps coming up actually bites */}
          {tally.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Practise:</span>
              <Button size="sm" variant={practise === null ? 'default' : 'outline'} onClick={() => setPractise(null)}>anything</Button>
              {tally.slice(0, 4).map((t) => (
                <Button key={t.cause} size="sm" variant={practise === t.cause ? 'default' : 'outline'} title={`${t.n} of your mistakes`} onClick={() => setPractise(t.cause)}>
                  {causeLabel(t.cause)} · {t.n}
                </Button>
              ))}
            </div>
          )}
        </header>

        {/* the table: what is already face-up, and therefore dead. The coach counts it. */}
        <PublicTable
          you={scenario.seat}
          centre={<div className="text-center leading-tight">
            <div className="text-lg font-semibold">{WIND_NAME[scenario.prevailingWind]}圈</div>
            <div className="text-xs text-muted-foreground">第{Math.max(1, Math.ceil(scenario.playerTurns / 4))}巡 · {scenario.phase} game</div>
          </div>}
          seats={[0, 1, 2, 3].map((s) => ({
            wind: WIND_NAME[(s - scenario.dealer + 4) % 4]!,
            you: s === scenario.seat,
            dealer: s === scenario.dealer,
            bonus: scenario.publicBonus[s] ?? [],
            melds: (scenario.publicMelds[s] ?? []).map((m) => ({ tiles: m.tiles, concealed: m.concealed })),
            discards: scenario.discards.filter((d) => d.seat === s).map((d) => ({ kind: d.kind, claimed: d.claimed })),
          }))} />

        {/* hand */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{pick === null ? 'Which tile do you discard? Tap one.' : 'Your hand'}</CardTitle></CardHeader>
          {/* context: the facts that decide this discard, right above the tiles */}
          <CardContent className="border-b pb-(--card-spacing)">
            <HandContext seat={scenario.seat} dealer={scenario.dealer} prevailingWind={scenario.prevailingWind}
              playerTurns={scenario.playerTurns} phase={scenario.phase} fan={fan} minimumFan={CONFIG.minimum_fan} />
          </CardContent>
          <CardContent className="@container">
            {(scenario.melds.length > 0 || scenario.bonus.length > 0) && (
              <div className="flex flex-nowrap items-end gap-x-4 pb-2 mb-2 border-b">
                {scenario.bonus.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className={LABEL}>Your <J>Bonus Tiles</J></span>
                    <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1">{scenario.bonus.map((k, i) => <Tile key={i} kind={k} size="md" fluid />)}</div>
                  </div>
                )}
                {scenario.melds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className={LABEL}>Your <J>Melds</J></span>
                    <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1">
                      {scenario.melds.map((m, i) => (
                        <span key={i} className="flex gap-0.5 sm:gap-1 mr-2 last:mr-0">{m.tiles.map((k, j) => <Tile key={j} kind={k} size="md" fluid concealed={m.concealed} />)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {(scenario.melds.length > 0 || scenario.bonus.length > 0) && <span className={cn(LABEL, 'block pb-1')}>In your hand — concealed</span>}
            <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1.5">
              {sortedHand.map((k, i) => (
                <Tile key={i} kind={k} size="md" fluid onClick={pick === null ? () => choose(k) : undefined}
                  highlight={pick !== null && k === gradedPick} dim={pick !== null && k !== pick && k !== gradedPick} />
              ))}
              {scenario.drawn !== null && (
                <>
                  <div className="w-2 shrink-0" />
                  <Tile kind={scenario.drawn} size="md" fluid badge="drew" onClick={pick === null ? () => choose(scenario.drawn!) : undefined}
                    highlight={pick !== null && scenario.drawn === gradedPick} dim={pick !== null && scenario.drawn !== pick && scenario.drawn !== gradedPick} />
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
                <Badge className={cn('text-sm px-3 py-1', VERDICT_STYLE[gradedTied.length > 1 && gradedTied.includes(picked.tile) ? 'best' : (pickedVerdict ?? 'fine')])}>{gradedTied.length > 1 && gradedTied.includes(picked.tile) ? EQUAL_TEXT : VERDICT_TEXT[pickedVerdict ?? 'fine']}</Badge>
                {/* what KIND of question that was - the label the hand was selected on */}
                <Badge variant="outline" className="text-xs">{DIFFICULTY_LABEL[scenario.difficulty]}</Badge>
                {teaches && <Badge variant="secondary" className="text-xs" title="what the tempting throw here gets wrong">teaches: {causeLabel(teaches)}</Badge>}
                {practise && !drawn.matched && <Badge variant="outline" className="text-xs text-muted-foreground">no {causeLabel(practise)} hand in 40 deals — a trap instead</Badge>}
                <div className="text-sm">
                  {scenario.difficulty === 'trap' && (
                    <p className="mb-1 text-muted-foreground">
                      A trap: the lazy throw here is <b className="text-foreground">{tileLabel(scenario.naivePick)}</b>, and it is wrong.
                      Getting it right is worth {scenario.gap.toFixed(1)} chips over the next-best tile.
                    </p>
                  )}
                  You discarded <b>{tileLabel(picked.tile)}</b>.{' '}
                  {gradedTied.length > 1 && gradedTied.includes(picked.tile)
                    ? <>Equal best — {gradedTied.map(tileLabel).join(', ')} are all the same here, so pick whichever you like.</>
                    : pickedVerdict === 'best' ? 'Same as the coach.'
                    : <>Coach discards <b>{tileLabel(gradedPick)}</b>{picked.delta < 0 && <span className="text-muted-foreground"> ({picked.delta.toFixed(1)} chips/game)</span>}.</>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="font-medium">Plan: {scenario.ranking.plan}</div>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-0.5">{scenario.ranking.planDetail.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReasonBox title={`Why ${tileLabel(gradedPick)}`} opt={gradedAnswerOpt} />
                {pickedVerdict !== 'best' && <ReasonBox title={`About your ${tileLabel(picked.tile)}`} opt={picked} />}
              </div>
              {(pickedVerdict === 'mistake' || pickedVerdict === 'blunder') && suggestion && (
                <>
                  <Separator />
                  {/* the eighth idea: a mistake is only useful once you know why it happened */}
                  <div className="space-y-2">
                    <div className="font-medium">Why did that happen?</div>
                    {suggestion.because && <p className="text-muted-foreground">{suggestion.because}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {CAUSES.map((c) => (
                        <Button key={c.id} size="sm" title={c.blurb}
                          variant={causeChosen === c.id ? 'default' : suggestion.suggested === c.id && causeChosen === null ? 'secondary' : 'outline'}
                          onClick={() => chooseCause(c.id)}>
                          {c.label}{suggestion.suggested === c.id && causeChosen === null ? ' ?' : ''}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {causeChosen ? 'Recorded. The Review tab keeps a tally, and that tally is what to practise.' : 'One tap. The one marked ? is what the position suggests; you may know better.'}
                    </p>
                  </div>
                </>
              )}
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
                      {/* the solver guarantees at least one reason; never print the internal plan id at a player */}
                      <span className="text-muted-foreground truncate">{o.reasons.join(' · ')}</span>
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
