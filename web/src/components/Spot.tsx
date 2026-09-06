import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tile } from '@/components/Tile';
import { HandContext } from '@/components/HandContext';
import { PublicTable } from '@/components/PublicTable';
import { TILE_BACK } from '@/lib/tiles';
import { TIPS } from 'sg-mahjong-solver';
import { jargon } from '@/lib/jargon';
import { loadSpotStats, recordSpot, resetSpotStats, recordSpotCause, loadSpotCauses, SPOT_CAUSES, spotCauseLabel, suggestedLook, type SpotKind, type SpotCause } from '@/lib/spotstats';

/**
 * The spotting drill: look at a position for a few seconds, then say what was in it.
 *
 * The other tabs all ask what to DO. This one asks what you SAW, which the research says is a
 * different skill: a strong player's advantage is that a position arrives already sorted into a few
 * familiar things, not that they work through it faster. So the position goes away before the
 * question arrives, and the answer has to come from what you took in rather than from counting.
 *
 * Every answer here is a property of the tiles rather than an opinion, so nothing is ever marked
 * wrong on a judgement call. The positions and their answers are built by `datagen/src/spotpack.ts`.
 */

interface Spot {
  id: string; seat: number; dl: number; w: number; t: number; fih: number;
  h: number[]; dr: number | null; b: number[]; m: number[][];
  disc: number[][]; pm: number[][][]; pb: number[][];
  sh: number; suit: number; melds: number[]; threat: number; tip: string | null;
}

const WIND = ['東', '南', '西', '北'] as const;
const SUIT = ['萬 characters', '筒 dots', '條 bamboo'] as const;
/** Play passes to the next seat index, so seat+1 acts next and seat+3 acts immediately before you. */
const SEAT_NAME: Record<number, string> = {
  0: 'nobody had any',
  1: 'the player after you',
  2: 'the player across',
  3: 'the player before you',
};

/** The four things a position can be asked about. Mixed rather than blocked, deliberately: a drill
 *  that asks the same question twenty times teaches you to answer it once and repeat. */
const KINDS: SpotKind[] = ['ready', 'suit', 'threat', 'shape'];
const PROMPT: Record<SpotKind, string> = {
  ready: 'How far from *Ting Pai* was your hand?',
  suit: 'Which suit were you holding most of?',
  threat: 'Who had the most sets face up?',
  shape: 'What shape was this position about?',
};
/** What each question is training, for the running score. Kept separate from the prompt because a
 *  question and the skill it tests do not read the same way in a list. */
const SKILL: Record<SpotKind, string> = {
  ready: 'your own hand',
  suit: 'what you are building',
  threat: 'reading the table',
  shape: 'naming the shape',
};
const READY = ['*Ting Pai* — waiting on a tile', 'one away from *Ting Pai*', 'two away', 'three or more away'];

/** Seconds the position stays on screen. Long enough to look, short enough to stop you counting. */
const LOOKS = [3, 5, 8] as const;

function optionsFor(s: Spot, kind: SpotKind, tipPool: string[]): { labels: string[]; answer: number } {
  if (kind === 'ready') return { labels: READY, answer: Math.min(3, s.sh) };
  if (kind === 'suit') return { labels: [...SUIT], answer: s.suit };
  if (kind === 'threat') return { labels: [0, 1, 2, 3].map((o) => SEAT_NAME[o]!), answer: s.threat };
  // A shape question offers the right tip and three others drawn from the tips this pack can show,
  // so a wrong answer is always a plausible one rather than something obviously off the page.
  const right = s.tip!;
  const others = tipPool.filter((t) => t !== right);
  const picked: string[] = [];
  // deterministic per position, so re-reading the same question does not reshuffle the answers
  let seed = 0;
  for (let i = 0; i < s.id.length; i++) seed = (seed * 31 + s.id.charCodeAt(i)) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const pool = [...others];
  while (picked.length < 3 && pool.length) picked.push(...pool.splice(Math.floor(rand() * pool.length), 1));
  const all = [right, ...picked];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j]!, all[i]!]; }
  return { labels: all.map((id) => TIPS.find((t) => t.id === id)?.title ?? id), answer: all.indexOf(right) };
}

export default function Spot() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [look, setLook] = useState<number>(5);
  /** 'looking' shows the position, 'asking' hides it and asks, 'done' reveals it again with the answer */
  const [stage, setStage] = useState<'looking' | 'asking' | 'done'>('looking');
  const [left, setLeft] = useState(look);
  const [picked, setPicked] = useState<number | null>(null);
  const [missCause, setMissCause] = useState<SpotCause | null>(null);
  const [tick, setTick] = useState(0);
  const timer = useRef<number | null>(null);

  /**
   * Read after every recorded cause, so the suggestion appears the moment the tally earns it.
   *
   * It must sit below every `useState` above it. The first version referenced `tick` from a line
   * before `tick` was declared: legal inside a closure as far as the compiler is concerned, and a
   * temporal-dead-zone crash the moment React runs the memo during render. The typecheck passed and
   * the tab went blank.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lookHint = useMemo(() => suggestedLook(look, LOOKS), [look, missCause, tick]);

  useEffect(() => {
    fetch('/quiz/spot.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`spot.json ${r.status}`))))
      .then((d: { positions: Spot[] }) => {
        const xs = [...d.positions];
        for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; }
        setSpots(xs);
      })
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  const tipPool = useMemo(() => [...new Set((spots ?? []).map((s) => s.tip).filter((t): t is string => !!t))], [spots]);
  const s = spots?.[pos % Math.max(1, spots.length)] ?? null;
  // Which question this position gets. Fixed by the position's own id so it cannot change under you,
  // and never a shape question when the tagger found no single shape here.
  const kind: SpotKind = useMemo(() => {
    if (!s) return 'ready';
    let n = 0;
    for (let i = 0; i < s.id.length; i++) n = (n * 31 + s.id.charCodeAt(i)) >>> 0;
    // Only two positions in five carry a single shape tag, so spreading the four questions evenly
    // over every position would make the shape question a ninth of the drill. It is the one that
    // connects to the Tips page, so a tagged position asks it half the time and the other three
    // questions share the rest.
    if (s.tip && n % 2 === 0) return 'shape';
    const pool = KINDS.filter((k) => k !== 'shape');
    return pool[(n >>> 1) % pool.length]!;
  }, [s]);
  const opts = useMemo(() => (s ? optionsFor(s, kind, tipPool) : null), [s, kind, tipPool]);
  const stats = useMemo(() => loadSpotStats(), [tick]);

  // The countdown. One interval per look, cleared on unmount and whenever the position changes, so
  // switching tabs mid-look cannot leave a timer running against a position that is no longer shown.
  useEffect(() => {
    if (stage !== 'looking' || !s) return;
    setLeft(look);
    const started = Date.now();
    timer.current = window.setInterval(() => {
      const remaining = look - (Date.now() - started) / 1000;
      if (remaining <= 0) { setLeft(0); setStage('asking'); }
      else setLeft(remaining);
    }, 100);
    return () => { if (timer.current) window.clearInterval(timer.current); timer.current = null; };
  }, [stage, s, look]);

  function choose(i: number) {
    if (picked !== null || !opts || !s) return;
    setPicked(i);
    setStage('done');
    recordSpot(kind, i === opts.answer);
    setTick((t) => t + 1);
  }
  function next() {
    setMissCause(null);
    setPicked(null);
    setStage('looking');
    setPos((p) => p + 1);
  }

  if (err) return <div className="mx-auto max-w-5xl px-4 py-5 text-sm text-destructive">Could not load the drill: {err}</div>;
  if (!spots || !s || !opts) return <div className="mx-auto max-w-5xl px-4 py-5 text-sm text-muted-foreground">Loading positions…</div>;

  const right = picked !== null && picked === opts.answer;
  const hidden = stage === 'asking';

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-medium">Spotting drill</span>
            <span className="text-muted-foreground">Look at the position, then say what was in it. The tiles go away before the question.</span>
            <span className="ml-auto flex items-center gap-1">
              {LOOKS.map((n) => (
                <Button key={n} size="sm" variant={look === n ? 'default' : 'outline'} onClick={() => setLook(n)}>{n}s</Button>
              ))}
            </span>
          </div>
          {stage === 'looking' && (
            <div className="space-y-1">
              <Progress value={(left / look) * 100} />
              <div className="text-xs text-muted-foreground">{left.toFixed(1)}s left — take in what you can</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The table and the hand are the thing being memorised, so both are hidden together. Hiding
          only the hand would leave the answer to the threat question sitting on screen. */}
      {hidden ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <img src={TILE_BACK} alt="" className="mx-auto mb-3 w-14 opacity-70" />
            The position is face down. Answer from what you saw.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-4">
              <HandContext seat={s.seat} dealer={s.dl} prevailingWind={s.w} playerTurns={s.t} fan={s.fih} fanLabel="Tai in hand" className="gap-x-5 gap-y-2" />
            </CardContent>
          </Card>

          <PublicTable
            you={s.seat}
            centre={<div className="text-center leading-tight">
              <div className="text-lg font-semibold">{WIND[s.w]}圈</div>
              <div className="text-xs text-muted-foreground">第{Math.max(1, Math.ceil(s.t / 4))}巡</div>
            </div>}
            seats={[0, 1, 2, 3].map((seat) => ({
              wind: WIND[(seat - s.dl + 4) % 4]!,
              you: seat === s.seat,
              dealer: seat === s.dl,
              bonus: seat === s.seat ? [] : s.pb[seat] ?? [],
              melds: seat === s.seat ? [] : (s.pm[seat] ?? []).map((m) => ({ tiles: m.slice(2), concealed: m[1] === 1 })),
              discards: s.disc.filter((d) => d[0] === seat).map((d) => ({ kind: d[1]!, claimed: d[2]! >= 0 })),
            }))} />

          <Card>
            <CardContent className="pt-4 space-y-3">
              {s.b.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">Your flowers</span>
                  <div className="flex gap-1">{s.b.map((k, i) => <Tile key={i} kind={k} size="xs" />)}</div>
                </div>
              )}
              {s.m.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">Your sets</span>
                  <div className="flex flex-wrap gap-3">
                    {s.m.map((m, i) => (
                      <div key={i} className="flex gap-0.5">{m.slice(2).map((k, j) => <Tile key={j} kind={k} size="xs" concealed={m[1] === 1} />)}</div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-end gap-1">
                {[...s.h].sort((a, b) => a - b).map((k, i) => <Tile key={i} kind={k} fluid />)}
                {s.dr !== null && <><span className="w-2" /><Tile kind={s.dr} fluid badge="drew" /></>}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {stage !== 'looking' && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="text-sm font-medium">{jargon(PROMPT[kind])}</div>
            <div className="flex flex-wrap gap-2">
              {opts.labels.map((label, i) => (
                <Button key={i} variant={picked === null ? 'outline' : i === opts.answer ? 'default' : i === picked ? 'destructive' : 'outline'}
                  disabled={picked !== null} onClick={() => choose(i)}>
                  {jargon(label)}
                </Button>
              ))}
            </div>
            {picked !== null && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={right ? 'default' : 'destructive'}>{right ? 'Right' : 'Missed it'}</Badge>
                  <span className="text-muted-foreground">{jargon(explain(s, kind))}</span>
                </div>
                {!right && (
                  <div className="space-y-1.5">
                    {/* seeing failures sort differently from deciding failures, and only you know which this was */}
                    <div className="font-medium">Why did you miss it?</div>
                    <div className="flex flex-wrap gap-1.5">
                      {SPOT_CAUSES.map((c) => (
                        <Button key={c.id} size="sm" title={c.blurb} variant={missCause === c.id ? 'default' : 'outline'}
                          onClick={() => { setMissCause(c.id); recordSpotCause(kind, c.id); }}>{c.label}</Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{missCause ? 'Recorded against this question type.' : 'One tap. It goes on the tally below.'}</p>
                    {missCause && lookHint && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2">
                        <span className="text-xs text-muted-foreground">{lookHint.why}</span>
                        <Button size="sm" variant="secondary" onClick={() => setLook(lookHint.look)}>Move the look to {lookHint.look}s</Button>
                      </div>
                    )}
                  </div>
                )}
                <Button onClick={next}>Next position</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {KINDS.map((k) => {
              const c = stats[k];
              return (
                <span key={k} className="text-muted-foreground">
                  {SKILL[k]}:{' '}
                  <span className="text-foreground">{c.n ? `${Math.round((100 * c.right) / c.n)}%` : '—'}</span>
                  <span className="text-xs"> of {c.n}</span>
                </span>
              );
            })}
            {/* misses by why they happened, per question kind - the diagnosis the framework asks for */}
            {(() => {
              const t = loadSpotCauses();
              const rows = (Object.entries(t) as [SpotKind, Partial<Record<SpotCause, number>>][]).filter(([, v]) => Object.keys(v ?? {}).length);
              if (!rows.length) return null;
              return (
                <div className="mt-2 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Misses, by why</div>
                  {rows.map(([k, v]) => (
                    <div key={k}>{k}: {(Object.entries(v ?? {}) as [SpotCause, number][]).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${spotCauseLabel(c)} ${n}`).join(' · ')}</div>
                  ))}
                </div>
              );
            })()}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { resetSpotStats(); setTick((t) => t + 1); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Say what the answer was and, where it helps, why it is worth seeing. */
function explain(s: Spot, kind: SpotKind): string {
  if (kind === 'ready') return s.sh === 0 ? 'The hand was ready.' : `The hand was ${READY[Math.min(3, s.sh)]}.`;
  if (kind === 'suit') return `Most of the hand was in ${SUIT[s.suit]}, counting your sets.`;
  if (kind === 'threat') {
    if (s.threat === 0) return 'Nobody had a set face up.';
    return `${SEAT_NAME[s.threat]} had ${s.melds[s.threat]} face up, against ${s.melds.slice(1).filter((_, i) => i + 1 !== s.threat).join(' and ')} for the others.`;
  }
  const tip = TIPS.find((t) => t.id === s.tip);
  return tip ? `${tip.title}. It is on the Tips page.` : 'See the Tips page.';
}
