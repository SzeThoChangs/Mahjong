/**
 * Review: the mistakes you have made, brought back on a schedule.
 *
 * The fifth part of the training system, and the one the app was missing entirely. Everything else
 * here practises; nothing brought a mistake back, so every mistake was made freshly each time.
 *
 * Two rules govern this screen, and both are from the method rather than from taste.
 *
 * It ASKS, it does not remind. The hand comes back with nothing attached - not the tile you threw
 * last time, not the coach's answer, not even that you got it wrong. Recognising an answer feels
 * almost exactly like knowing it and is not the same thing, so being shown the answer first would
 * make the review feel productive and teach nothing.
 *
 * And getting it wrong sends it back to the beginning. The point is not to empty the list.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tile } from '@/components/Tile';
import { PublicTable } from '@/components/PublicTable';
import { HandContext } from '@/components/HandContext';
import { fanInHand } from 'sg-mahjong-engine';
import { makeScenario, CONFIG } from '@/lib/scenario';
import { tileLabel } from '@/lib/tiles';
import { dueMistakes, openMistakes, reviewed, forget, whenDue, howLongAgo, INTERVALS_DAYS, type Mistake } from '@/lib/mistakes';
import { cn } from '@/lib/utils';

const WIND_NAME = ['\u6771', '\u5357', '\u897f', '\u5317'];

export default function Review() {
  const [now] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [pick, setPick] = useState<number | null>(null);

  // `tick` looks unused to the linter and is the whole point: these read localStorage, which React
  // cannot see change, so bumping it after a review is what re-reads the list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => dueMistakes(now), [now, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const open = useMemo(() => openMistakes(), [tick]);
  const current: Mistake | undefined = due[0];

  // rebuilt from the seed, so it is the identical hand you got wrong
  const scenario = useMemo(
    () => (current ? makeScenario(current.seed, current.phase, ((current.seed * 9301 + 49297) % 233280) / 233280 < 0.7) : null),
    [current],
  );

  const hand = useMemo(() => {
    if (!scenario) return [];
    const h = [...scenario.hand].sort((a, b) => a - b);
    if (scenario.drawn !== null) { const i = h.indexOf(scenario.drawn); if (i >= 0) h.splice(i, 1); }
    return h;
  }, [scenario]);

  const answer = (k: number) => { if (pick === null) setPick(k); };
  const finish = () => {
    if (!current || pick === null || !scenario) return;
    const opt = scenario.ranking.options.find((o) => o.tile === pick);
    reviewed(current.id, opt ? opt.verdict === 'best' || opt.verdict === 'fine' : false, Date.now());
    setPick(null); setTick((t) => t + 1);
  };

  if (!open.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader><CardTitle className="text-base">Nothing to review yet</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Mistakes from the Train tab are kept here and come back on a schedule: after a day, then three
            days, a week, two weeks and a month. Getting one wrong again sends it back to the start.</p>
            <p className="mt-2">Nothing is stored anywhere but this browser.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!current || !scenario) {
    const next = [...open].sort((a, b) => a.due - b.due)[0]!;
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader><CardTitle className="text-base">All caught up</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{open.length} mistake{open.length === 1 ? '' : 's'} still on the schedule. The next comes back {whenDue(next.due)}.</p>
            <p className="mt-2">Waiting is the part that works. Coming back to something after it has faded is
            what makes it stick; doing it again now while you still remember it does almost nothing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const picked = pick === null ? undefined : scenario.ranking.options.find((o) => o.tile === pick);
  const right = picked ? picked.verdict === 'best' || picked.verdict === 'fine' : false;
  const coach = scenario.ranking.best;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Review</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{due.length} due now</Badge>
          <Badge variant="outline">{open.length} on the schedule</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">You got this hand wrong {howLongAgo(current.firstSeen, now)}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Work it out again from the tiles. What you threw last time is deliberately not shown — recognising
            an answer is not the same as knowing it.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <HandContext
            seat={scenario.seat} dealer={scenario.dealer} prevailingWind={scenario.prevailingWind}
            playerTurns={scenario.playerTurns} phase={scenario.phase}
            fan={fanInHand({ melds: scenario.melds, bonus: scenario.bonus, seat: (scenario.seat - scenario.dealer + 4) % 4, prevailingWind: scenario.prevailingWind })}
            minimumFan={CONFIG.minimum_fan} />
          <div>
            <p className="mb-2 text-sm font-medium">Which tile do you discard?</p>
            <div className="flex flex-wrap items-end gap-1">
              {hand.map((k, i) => (
                <Tile key={i} kind={k} size="md" onClick={pick === null ? () => answer(k) : undefined}
                  highlight={pick === k} dim={pick !== null && pick !== k} />
              ))}
              {scenario.drawn !== null && (
                <div className="ml-3 flex flex-col items-center">
                  <Tile kind={scenario.drawn} size="md" onClick={pick === null ? () => answer(scenario.drawn!) : undefined}
                    highlight={pick === scenario.drawn} dim={pick !== null && pick !== scenario.drawn} />
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">drew</span>
                </div>
              )}
            </div>
          </div>

          {pick !== null && (
            <>
              <Separator />
              <div className="space-y-2 text-sm">
                <p className={cn('font-medium', right ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                  {right ? `Right this time — ${tileLabel(pick)}.` : `Still wrong — you threw ${tileLabel(pick)}, the coach throws ${tileLabel(coach.tile)}.`}
                </p>
                {coach.reasons[0] && <p className="text-muted-foreground">Why {tileLabel(coach.tile)}: {coach.reasons[0]}.</p>}
                <p className="text-muted-foreground">
                  {right
                    ? `Moving on: back ${current.step + 1 >= INTERVALS_DAYS.length ? 'no more — this one is finished' : `in ${INTERVALS_DAYS[current.step + 1]} days`}.`
                    : 'Back to the start of the schedule, due again tomorrow.'}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button onClick={finish}>Next</Button>
                  <Button variant="ghost" onClick={() => { forget(current.id); setPick(null); setTick((t) => t + 1); }}>
                    Drop this one
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
