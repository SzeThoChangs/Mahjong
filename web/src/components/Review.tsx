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
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tile } from '@/components/Tile';
import { PublicTable } from '@/components/PublicTable';
import { HandContext } from '@/components/HandContext';
import { fanInHand } from 'sg-mahjong-engine';
import { makeScenario, CONFIG } from '@/lib/scenario';
import { readHistory, type Play } from '@/lib/history';
import { tileLabel } from '@/lib/tiles';
import { dueMistakes, openMistakes, reviewed, forget, whenDue, howLongAgo, causeTally, setCause, writePractise, bySource, INTERVALS_DAYS, type Mistake } from '@/lib/mistakes';
import { CAUSES, causeLabel, type Cause } from 'sg-mahjong-solver';
import { PRACTISABLE } from '@/lib/scenario';
import { leadingSpotCause, spotCauseLabel } from '@/lib/spotstats';
import { rankDiscards, suggestCause, type Context } from 'sg-mahjong-solver';
import type { Meld } from 'sg-mahjong-engine';
import { jargon, J } from '@/lib/jargon';
import { cn } from '@/lib/utils';

const WIND_NAME = ['\u6771', '\u5357', '\u897f', '\u5317'];

/** the slice of a pack question this screen needs - the same shape the Real quiz reads */
interface QuizQ {
  id: string; k: string; seat: number; dl?: number; w: number; t: number; h: number[]; dr: number | null;
  b: number[]; m: number[][]; disc?: number[][]; pm?: number[][][]; pb?: number[][]; best: string;
}

export default function Review({ onPractise }: { onPractise?: (c: Cause) => void } = {}) {
  const [now] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [pick, setPick] = useState<number | null>(null);

  // `tick` looks unused to the linter and is the whole point: these read localStorage, which React
  // cannot see change, so bumping it after a review is what re-reads the list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => dueMistakes(now), [now, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const open = useMemo(() => openMistakes(), [tick]);
  const tally = useMemo(() => causeTally(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sources = useMemo(() => bySource(), [tick]);

  /**
   * Two jobs on one screen, and they are opposites.
   *
   * The schedule ASKS: it shows a hand you got wrong and withholds everything else, because the
   * only thing that makes it stick is doing the thinking again. The log TELLS: you pick a hand you
   * have already played and it opens with the answer and the reasoning already on screen. Both are
   * in the method - the first is spaced retrieval, the second is finding out what the right answer
   * was and why - and they need different behaviour rather than one screen hedging between them.
   */
  const [view, setView] = useState<'due' | 'log'>('due');
  const [openId, setOpenId] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const log = useMemo(() => readHistory(), [tick]);
  const played = view === 'log' && openId ? log.find((h) => h.id === openId) : undefined;

  // A log entry carries the same few fields the rebuild needs, so it can stand in for a card here.
  const current: Mistake | undefined = played
    ? ({ id: played.id, seed: played.seed, phase: played.phase, pack: played.pack, qid: played.qid,
         picked: played.threw, coachPick: played.best, verdict: played.verdict, cost: played.cost,
         firstSeen: played.at, why: '' } as unknown as Mistake)
    : due[0];

  /**
   * A card comes back as the identical position, and there are two ways to rebuild one.
   *
   * A Train card carries a seed, and `makeScenario` deals it again. A Real quiz card carries a pack
   * and a question id, and the pack file holds it - fetched here rather than stored, for the same
   * reason the seed is stored rather than the hand: a thousand cards should cost kilobytes.
   */
  const [quizQ, setQuizQ] = useState<QuizQ | null>(null);
  const [quizErr, setQuizErr] = useState<string | null>(null);
  useEffect(() => {
    if (!current?.pack) { setQuizQ(null); setQuizErr(null); return; }
    let live = true;
    setQuizQ(null); setQuizErr(null);
    fetch(`/quiz/${current.pack}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { questions: QuizQ[] }) => { if (!live) return; const found = d.questions.find((x) => x.id === current.qid); found ? setQuizQ(found) : setQuizErr('that question is no longer in the pack'); })
      .catch(() => { if (live) setQuizErr('could not load the pack this came from'); });
    return () => { live = false; };
  }, [current]);

  const scenario = useMemo(
    () => (current && !current.pack && current.seed !== undefined && current.phase
      ? makeScenario(current.seed, current.phase, ((current.seed * 9301 + 49297) % 233280) / 233280 < 0.7)
      : null),
    [current],
  );

  /** the coach's ranking on a quiz position, for the explanation and the cause suggestion */
  const quizCoach = useMemo(() => {
    if (!quizQ) return null;
    const melds: Meld[] = quizQ.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    const visible: number[] = [];
    for (const d of quizQ.disc ?? []) visible.push(d[1]!);
    (quizQ.pm ?? []).forEach((ms, s2) => { if (s2 !== quizQ.seat) for (const m of ms) visible.push(...m.slice(2)); });
    (quizQ.pb ?? []).forEach((bs, s2) => { if (s2 !== quizQ.seat) visible.push(...bs); });
    const ctx: Context = {
      seat: quizQ.dl !== undefined ? (quizQ.seat - quizQ.dl + 4) % 4 : quizQ.seat, prevailingWind: quizQ.w, bonus: quizQ.b,
      playerTurns: quizQ.t, minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan, visible,
      opponentMelds: (quizQ.pm ?? []).map((ms, s2) => (s2 === quizQ.seat ? -1 : ms.length)).filter((n) => n >= 0),
    };
    try { return { melds, ctx, ranking: rankDiscards(quizQ.h, melds, ctx) }; } catch { return null; }
  }, [quizQ]);

  /**
   * One shape for the screen, whichever way the card was rebuilt. `judge` is the whole point of
   * keeping them apart: a quiz card's answer is 128 play-outs, a Train card's is the coach.
   */
  const pos = useMemo(() => {
    if (quizQ) {
      const sorted = [...quizQ.h].sort((a, b) => a - b);
      const i = quizQ.dr !== null ? sorted.indexOf(quizQ.dr) : -1;
      return {
        judge: 'the play-outs' as const,
        seat: quizQ.seat, dealer: quizQ.dl ?? 0, prevailingWind: quizQ.w, playerTurns: quizQ.t, phase: '' as string,
        hand: i >= 0 ? [...sorted.slice(0, i), ...sorted.slice(i + 1)] : sorted, drawn: quizQ.dr,
        melds: quizCoach?.melds ?? [], bonus: quizQ.b,
        publicMelds: (quizQ.pm ?? []).map((ms) => ms.map((m) => ({ tiles: m.slice(2), concealed: m[1] === 1 }))),
        publicBonus: quizQ.pb ?? [],
        discards: (quizQ.disc ?? []).map((d) => ({ seat: d[0]!, kind: d[1]!, claimed: (d[2] ?? -1) >= 0 })),
        best: quizQ.best.startsWith('d:') ? Number(quizQ.best.slice(2)) : null,
        reasons: (k: number) => quizCoach?.ranking.options.find((o) => o.tile === k)?.reasons ?? [],
        options: quizCoach?.ranking.options ?? [],
      };
    }
    if (!scenario) return null;
    const h = [...scenario.hand].sort((a, b) => a - b);
    if (scenario.drawn !== null) { const i = h.indexOf(scenario.drawn); if (i >= 0) h.splice(i, 1); }
    return {
      judge: 'the coach' as const,
      seat: scenario.seat, dealer: scenario.dealer, prevailingWind: scenario.prevailingWind,
      playerTurns: scenario.playerTurns, phase: scenario.phase as string,
      hand: h, drawn: scenario.drawn, melds: scenario.melds, bonus: scenario.bonus,
      publicMelds: scenario.publicMelds.map((ms) => ms.map((m) => ({ tiles: m.tiles, concealed: m.concealed }))),
      publicBonus: scenario.publicBonus, discards: scenario.discards,
      best: scenario.ranking.best.tile,
      reasons: (k: number) => scenario.ranking.options.find((o) => o.tile === k)?.reasons ?? [],
      options: scenario.ranking.options,
    };
  }, [scenario, quizQ, quizCoach]);
  const hand = pos?.hand ?? [];

  const answer = (k: number) => { if (pick === null) setPick(k); };
  const openPlayed = (h: Play) => { setOpenId(h.id); setPick(h.threw); };
  const closePlayed = () => { setOpenId(null); setPick(null); };
  const finish = () => {
    if (!current || pick === null || !pos || played) return;   // a look back moves nothing on
    // A quiz card is right if it is the throw the play-outs measured; a Train card if the coach
    // calls it best or also-fine. Different judges, and the record keeps them apart deliberately.
    const ok = quizQ ? pick === pos.best : (() => { const o = pos.options.find((x) => x.tile === pick); return !!o && (o.verdict === 'best' || o.verdict === 'fine'); })();
    reviewed(current.id, ok, Date.now());
    setPick(null); setTick((t) => t + 1);
  };

  // The diagnosis is the point of the record, and it must show whether or not anything is due -
  // most days nothing is, and that is exactly when it is worth reading.
  const diagnosis = tally.length > 0 ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Your mistakes, by why they happened</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="flex flex-wrap gap-1.5">
              {tally.map((t) => (
                <Badge key={t.cause} variant={t === tally[0] && t.cause !== 'unsorted' ? 'default' : 'outline'}>
                  {t.cause === 'unsorted' ? 'not sorted yet' : causeLabel(t.cause)} · {t.n}
                </Badge>
              ))}
            </div>
            {sources.quiz > 0 && (
              <p className="mt-2 text-muted-foreground">
                {sources.quiz} of these were judged by the play-outs and {sources.trainer} by the coach. The
                play-out ones are the surer mistakes: the coach picks the measured best about half the time.
              </p>
            )}
            <p className="mt-2 text-muted-foreground">
              {tally[0]!.cause === 'unsorted'
                ? 'Most of these were recorded before the question existed. Sort one when it comes back.'
                : `The one that keeps coming up is "${causeLabel(tally[0]!.cause as Cause)}". More puzzles do not fix a problem that is really about that.`}
            </p>
            {(() => { const sp = leadingSpotCause(); return sp ? (
              <p className="mt-2 text-muted-foreground">On the Spot drill, the miss that keeps coming up is <b className="text-foreground">{spotCauseLabel(sp.cause)}</b>, {sp.n} of {sp.total} sorted. {sp.cause === 'out-of-time' ? 'Give yourself a longer look until that stops, then shorten it.' : sp.cause === 'misread' ? 'You are seeing the tiles and reading them wrongly - that is a deciding problem, not a looking one.' : sp.cause === 'guessed' ? 'You are answering before you have seen: slow the look, not the answer.' : 'The table is not registering: look for one thing at a time, then two.'}</p>
            ) : null; })()}
            {tally[0]!.cause !== 'unsorted' && PRACTISABLE.includes(tally[0]!.cause as Cause) && onPractise && (
              <Button size="sm" className="mt-2" onClick={() => { writePractise(tally[0]!.cause as Cause); onPractise(tally[0]!.cause as Cause); }}>
                Practise "{causeLabel(tally[0]!.cause as Cause)}" on the Train tab
              </Button>
            )}
          </CardContent>
        </Card>
  ) : null;

  const switcher = (
    <div className="flex gap-1.5 text-sm">
      <Button size="sm" variant={view === 'due' ? 'default' : 'outline'}
        onClick={() => { setView('due'); closePlayed(); }}>Due now {due.length}</Button>
      <Button size="sm" variant={view === 'log' ? 'default' : 'outline'}
        onClick={() => { setView('log'); setPick(null); }}>Hands you have played {log.length}</Button>
    </div>
  );

  if (view === 'log' && !played) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Review</h2>{switcher}
        </div>
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Hands you have played</CardTitle>
            <p className="text-sm text-muted-foreground">
              The last {log.length ? log.length : 0} of them, newest first, whether they went well or badly.
              Open one and it shows the answer and the reasoning straight away — this is for understanding a
              hand, not for testing yourself on it again.
            </p>
          </CardHeader>
          <CardContent className="text-sm">
            {log.length === 0
              ? <p className="text-muted-foreground">Nothing yet. Play a hand on the Train tab or the Real quiz and it will appear here.</p>
              : (
                <div className="flex flex-col">
                  {log.map((h) => (
                    <button key={h.id} onClick={() => openPlayed(h)}
                      className="flex items-center gap-3 border-b py-3 text-left last:border-0 hover:bg-accent/50">
                      <Badge variant="outline" className={h.right ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
                        {h.right ? 'ok' : h.verdict}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Tile kind={h.threw} size="xs" />
                        {!h.right && <><span className="text-muted-foreground">not</span><Tile kind={h.best} size="xs" /></>}
                      </span>
                      <span className="ml-auto text-right text-xs text-muted-foreground">
                        {howLongAgo(h.at, now)}<br />{h.judge === 'playouts' ? 'play-outs' : 'the coach'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!open.length && view === 'due') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Review</h2>{switcher}
        </div>
        {diagnosis}
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

  if (!current || (!pos && !quizErr)) {
    const next = [...open].sort((a, b) => a.due - b.due)[0]!;
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Review</h2>{switcher}
        </div>
        {diagnosis}
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

  if (!pos) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Review</h2>{switcher}
        </div>
        {diagnosis}
        <Card>
          <CardHeader><CardTitle className="text-base">This one cannot be rebuilt</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{quizErr ?? 'the position could not be rebuilt'}. A quiz card points into a pack file, and a rebuilt pack does not keep the old question ids.</p>
            <Button size="sm" variant="outline" onClick={() => { forget(current.id); setTick((t) => t + 1); }}>Drop it from the schedule</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  const picked = pick === null ? undefined : pos.options.find((o) => o.tile === pick);
  const right = pick === null ? false : quizQ ? pick === pos.best : (!!picked && (picked.verdict === 'best' || picked.verdict === 'fine'));
  const coachTile = pos.best;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Review</h2>
        {switcher}
      </div>

      {diagnosis}

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">
            {played ? `You played this hand ${howLongAgo(played.at, now)}` : `You got this hand wrong ${howLongAgo(current.firstSeen, now)}`}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Judged by {pos.judge}{quizQ ? ', which is the honest grader here' : ', which is right about half the time on positions like this'}.</p>
          <p className="text-sm text-muted-foreground">
            {played
              ? 'Everything is shown: what you threw, what the judge threw, and why. Nothing here changes your schedule.'
              : 'Work it out again from the tiles. What you threw last time is deliberately not shown — recognising an answer is not the same as knowing it.'}
          </p>
          {played && <Button size="sm" variant="outline" className="self-start" onClick={closePlayed}>Back to the list</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          <PublicTable
            you={pos.seat}
            centre={<div className="text-center leading-tight">
              <div className="text-lg font-semibold">{WIND_NAME[pos.prevailingWind]}圈</div>
              <div className="text-xs text-muted-foreground">第{Math.max(1, Math.ceil(pos.playerTurns / 4))}巡 · {pos.phase} game</div>
            </div>}
            seats={[0, 1, 2, 3].map((s) => ({
              wind: WIND_NAME[(s - pos.dealer + 4) % 4]!,
              you: s === pos.seat,
              dealer: s === pos.dealer,
              bonus: pos.publicBonus[s] ?? [],
              melds: pos.publicMelds[s] ?? [],
              discards: pos.discards.filter((d) => d.seat === s).map((d) => ({ kind: d.kind, claimed: d.claimed })),
            }))} />
          <HandContext
            seat={pos.seat} dealer={pos.dealer} prevailingWind={pos.prevailingWind}
            playerTurns={pos.playerTurns} phase={(pos.phase || 'mid') as 'early' | 'mid' | 'late'}
            fan={fanInHand({ melds: pos.melds, bonus: pos.bonus, seat: (pos.seat - pos.dealer + 4) % 4, prevailingWind: pos.prevailingWind })}
            minimumFan={CONFIG.minimum_fan} />
          <div>
            <p className="mb-2 text-sm font-medium">Which tile do you discard?</p>
            <div className="flex flex-wrap items-end gap-1">
              {hand.map((k, i) => (
                <Tile key={i} kind={k} size="md" onClick={pick === null ? () => answer(k) : undefined}
                  highlight={pick === k} dim={pick !== null && pick !== k} />
              ))}
              {pos.drawn !== null && (
                <div className="ml-3 flex flex-col items-center">
                  <Tile kind={pos.drawn} size="md" onClick={pick === null ? () => answer(pos.drawn!) : undefined}
                    highlight={pick === pos.drawn} dim={pick !== null && pick !== pos.drawn} />
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
                  {jargon(played
                    ? (right ? `You threw ${tileLabel(pick)}, and that was right.`
                             : `You threw ${tileLabel(pick)}. ${quizQ ? 'The play-outs threw' : 'The *Coach* threw'} ${tileLabel(coachTile)}.`)
                    : (right ? `Right this time — ${tileLabel(pick)}.`
                             : `Still wrong — you threw ${tileLabel(pick)}, ${quizQ ? 'the play-outs throw' : 'the *Coach* throws'} ${tileLabel(coachTile)}.`))}
                </p>
                {pos.reasons(coachTile)[0] && <p className="text-muted-foreground">Why {tileLabel(coachTile)}: {pos.reasons(coachTile)[0]}.</p>}
                {played && !right && pos.reasons(pick)[0] && <p className="text-muted-foreground">Why not {tileLabel(pick)}: {pos.reasons(pick)[0]}.</p>}
                {played ? (
                  <p className="text-muted-foreground">
                    Looking back changes nothing: this hand keeps whatever place it already has on the schedule.
                  </p>
                ) : (<>
                <p className="text-muted-foreground">
                  {right
                    ? `Moving on: back ${current.step + 1 >= INTERVALS_DAYS.length ? 'no more — this one is finished' : `in ${INTERVALS_DAYS[current.step + 1]} days`}.`
                    : 'Back to the start of the schedule, due again tomorrow.'}
                </p>
                <div className="pt-1">
                  <p className="text-muted-foreground">
                    {current.cause ? <>You put this down to <b className="text-foreground">{causeLabel(current.cause)}</b>{right ? '.' : ' — still?'}</> : 'You never said why this one happened. Now is a good moment:'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {CAUSES.map((c) => (
                      <Button key={c.id} size="sm" title={c.blurb} variant={current.cause === c.id ? 'default' : 'outline'}
                        onClick={() => { setCause(current.id, c.id); setTick((t) => t + 1); }}>{c.label}</Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={finish}>Next</Button>
                  <Button variant="ghost" onClick={() => { forget(current.id); setPick(null); setTick((t) => t + 1); }}>
                    Drop this one
                  </Button>
                </div>
                </>)}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
