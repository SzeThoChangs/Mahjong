/**
 * Train: positions from actual recorded games, graded by the evaluator's measured EV of every
 * legal action. Not heuristics - play-out counts.
 *
 * This was the "Real quiz" tab until 2026-09-10, and there was a second practice tab beside it that
 * dealt hands from a seed and had the coach mark them. The two differed in one thing that matters,
 * which is who marks the answer, and the play-outs are the honest judge: the coach picks their best
 * 52.8% of the time on decisive positions and 36.1% early in a hand. Both tabs already explained
 * themselves in words and could be aimed at a mistake cause, and the packs are already filtered to
 * decisive positions, so nothing else separated them. One tab, then, and this is it.
 *
 * What the seeded hands uniquely had was supply: a hand on demand, with nothing to download. That
 * survives as `GeneratedHand`, served only when the pack has nothing to offer - a cause filter that
 * matches no question, or no pack loaded at all - and always under a note that says the hand is
 * made up and who marked it. A coach verdict and a play-out verdict are never shown as the same
 * kind of thing.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tile } from '@/components/Tile';
import { PublicTable } from '@/components/PublicTable';
import { HandContext } from '@/components/HandContext';
import { tileLabel } from '@/lib/tiles';
import { cn } from '@/lib/utils';
import { CONFIG, JOKERS, PRACTISABLE } from '@/lib/scenario';
import { recordMistake, challengeMistake, causeTally, readPractise, writePractise } from '@/lib/mistakes';
import { recordPlay, challengePlay } from '@/lib/history';
import { priceMix, loadConfig, type OutcomeMix } from '@/lib/money';
import { challenge, challengeKind, canChallenge, rulesForPack, CHALLENGE_ROLLOUTS, type ChallengeOutcome } from '@/lib/rejudge';
import { rankDiscards, handValue, claimRank, claimReasons, claimCandidateOf, liveCalls, causeLabel, TIPS, type Context, type Cause, type ShardIx } from 'sg-mahjong-solver';
import type { Meld } from 'sg-mahjong-engine';
import { jargon, J } from '@/lib/jargon';
import { asset } from '@/lib/asset';

// The made-up hand is the fallback, not the tab, so its code arrives only on the day a pack has
// nothing to offer rather than with every page load. The service worker still keeps it offline.
const GeneratedHand = lazy(() => import('@/components/GeneratedHand'));

const WIND = ['東', '南', '西', '北'];
/** the small caption that says what a run of tiles actually IS */
const LABEL = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground';

/** `table` is absent on packs built before 2026-09-06, when nothing recorded which table a pack came from. */
interface PackTable { wildcards: number; minimumTai: number }
/** `shards` is how many shard files a pack is cut into; absent on a pack that is still one file. */
interface PackIx { id: string; money: boolean; unit: string; questions: number; table?: PackTable; shards?: number }
/** the slice of a pack's own `index.json` this tab reads - see `pack.ts` in the solver for the whole of it */
interface Ix { run: string | null; unit: string; questions: number; shards: ShardIx[] }
// `se` = paired standard error of (best.ev - this.ev): how far apart two moves must sit before
// the play-outs can tell them apart. Packs built before 2026-08-26 have no `se` field.
interface Action { a: string; ev: number; se?: number; win: number; dealin: number; draw: number; n?: number; mix?: OutcomeMix }
// `disc` = the discard pool as [seat, kind, claimedBy]; `pm` / `pb` = every seat's exposed melds and
// bonus tiles. Packs built before 2026-08-26 lack them, so every use is guarded.
// `c` = why the seat's own throw failed, read off the position when the pack was built, at the table
// the hand was played on. Null where the seat threw the measured best, or where nothing separates
// the two tiles; absent on packs built before 2026-09-10, which therefore never match a cause.
interface Q { id: string; k: string; c?: string | null; seat: number; dl?: number; w: number; t: number; fih: number; h: number[]; dr: number | null; b: number[]; m: number[][]; ld?: [number, number]; disc?: number[][]; pm?: number[][][]; pb?: number[][]; bot: string; spread: number; best: string; sel: string; n: number; actions: Action[] }
type Verdict = 'best' | 'unclear' | 'fine' | 'mistake' | 'blunder';

/** the tallies a shard entry carries, counted here for a pack built before packs were sharded */
const tallyOf = (file: string, qs: Q[]): ShardIx => {
  const kinds: Record<string, number> = {}, causes: Record<string, number> = {};
  for (const qq of qs) { kinds[qq.k] = (kinds[qq.k] ?? 0) + 1; if (qq.c) causes[qq.c] = (causes[qq.c] ?? 0) + 1; }
  return { file, n: qs.length, kinds, causes };
};
/** 0..n-1 in a random order, so a shard is walked differently each time it comes round */
const shuffled = (n: number): number[] => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};

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

const kindsOf = (a: string): number[] => a.startsWith('d:') ? [Number(a.slice(2))] : a.startsWith('chow:') ? a.slice(5).split(',').map(Number) : (/^\w+:(\d+)$/.exec(a) ? [Number(/^\w+:(\d+)$/.exec(a)![1])] : []);
const actionText = (a: string) => a === 'win' ? 'Win' : a === 'pass' ? 'Pass' : a === 'proceed' ? 'No kong' : a.startsWith('d:') ? `Discard ${tileLabel(Number(a.slice(2)))}` : a.startsWith('pong') ? 'Pong' : a.startsWith('chow') ? 'Chow' : 'Kong';

export default function Train() {
  const [packs, setPacks] = useState<PackIx[]>([]);
  const [pack, setPack] = useState<string | null>(null);
  /**
   * Whether there is a pack to serve from at all. `loading` keeps the fallback from flashing up
   * before the index has answered; `none` is the index missing or empty, which is what a fresh
   * install with no signal sees, and the made-up hands are the right answer to it.
   */
  const [packState, setPackState] = useState<'loading' | 'ready' | 'none'>('loading');
  const [packFailed, setPackFailed] = useState(false);
  /** where the fallback deals from; it moves on when the fallback's own "next" is pressed */
  const [genSeed, setGenSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [unit, setUnit] = useState('chips');
  /**
   * The pack's own index: what each shard holds, so a shard is fetched only when the filters need
   * it. A pack built before 2026-09-10 is one file, and is opened as a single shard whose tallies
   * are counted on arrival, so the rest of this tab need not know which layout it is looking at.
   */
  const [ix, setIx] = useState<Ix | null>(null);
  /** the shard on screen, and the order its questions are being walked in */
  const [loaded, setLoaded] = useState<{ shard: number; qs: Q[]; order: number[] } | null>(null);
  const [pos, setPos] = useState(0);
  const shardCache = useRef(new Map<number, Q[]>());
  /**
   * Which shards have been walked under the current filters, and which turned out to hold
   * nothing that fits although their tally said they would. The second should never happen -
   * the builder writes the tallies and the shards from one list - but if it does, the drill must
   * move on rather than fetch the same shard forever. Both start again when the filters change.
   */
  const [walked, setWalked] = useState<Set<number>>(() => new Set());
  const [barren, setBarren] = useState<Set<number>>(() => new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<'all' | 'discard' | 'claim'>('all');
  const [score, setScore] = useState({ best: 0, unclear: 0, fine: 0, mistake: 0, blunder: 0, lost: 0, streak: 0 });
  /**
   * The Challenge button's state: running with a count, or finished with an outcome or a reason
   * it could not run. The play-outs happen in a Web Worker (`lib/rejudge.ts`), so the page stays
   * live and the count moves.
   */
  const [challengeState, setChallengeState] = useState<null | { running: true; done: number; total: number } | { running: false; outcome?: ChallengeOutcome; error?: string }>(null);

  useEffect(() => {
    fetch(asset('quiz/index.json')).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { packs: PackIx[] }) => {
        setPacks(d.packs);
        if (d.packs[0]) { setPack(d.packs[0].id); setPackState('ready'); } else setPackState('none');
      })
      .catch(() => { setPacks([]); setPackState('none'); });
  }, []);
  useEffect(() => {
    if (!pack) return;
    setPackFailed(false); setIx(null); setLoaded(null); setPos(0); setPicked(null);
    setWalked(new Set()); setBarren(new Set());
    shardCache.current = new Map();
    let live = true;
    const ok = (r: Response) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))));
    const listed = packs.find((p) => p.id === pack);
    const load: Promise<Ix> = listed?.shards
      ? fetch(asset(`quiz/${pack}/index.json`)).then(ok).then((d: Ix) => d)
      : fetch(asset(`quiz/${pack}.json`)).then(ok).then((d: { unit: string; run?: string; questions: Q[] }) => {
          if (live) shardCache.current.set(0, d.questions);
          return { run: d.run ?? null, unit: d.unit, questions: d.questions.length, shards: [tallyOf(`${pack}.json`, d.questions)] };
        });
    load.then((d) => { if (!live) return; setUnit(d.unit); setIx(d); if (!d.questions) setPackFailed(true); })
      // a pack that will not load - no signal, or one being rebuilt under us - leaves the fallback
      // to serve, rather than a blank screen
      .catch(() => { if (live) setPackFailed(true); });
    return () => { live = false; };
  }, [pack, packs]);

  /**
   * Serve questions about the cause that keeps going wrong.
   *
   * A pack question records what the seat ACTUALLY threw (`sel`) beside what the play-outs
   * measured as best, so where those differ the position holds a real mistake made by a real
   * player, and the pack builder has read why it failed into the question's `c`. Until 2026-09-10
   * this tab worked that out itself, at five milliseconds a question, with a background pass over
   * the whole pack so the filter never walked cold. A sharded pack cannot run that pass, and does
   * not need to: the index's tallies say which shards hold which causes before any is fetched.
   *
   * The choice is shared with the Review tab through `readPractise`, which is how its "practise
   * this" button lands here with the filter already set, and it survives a reload for the same
   * reason the old tab's did: the cause that keeps coming up does not change between sessions.
   */
  const [causeFilter, setCauseFilterState] = useState<Cause | null>(() => readPractise());
  const setCauseFilter = (c: Cause | null) => { setCauseFilterState(c); writePractise(c); };
  const noPack = packState === 'none' || packFailed;
  // Causes are read off discards, so the filter has nothing to say about claim questions and is
  // not applied in claim mode; the strip that sets it is hidden there too, which is how the
  // screen says so.
  const causeApplies = causeFilter !== null && (mode !== 'claim' || noPack);
  /** whether one question fits the mode and the cause filter */
  const fits = (qq: Q) => (mode === 'all' || (mode === 'discard' ? qq.k === 'discard' : qq.k !== 'discard')) && (!causeApplies || qq.c === causeFilter);
  /** whether a shard holds anything that fits, from its tallies alone - the index is enough to know */
  const canServe = (s: ShardIx) => {
    const ofKind = mode === 'all' ? s.n : mode === 'discard' ? (s.kinds.discard ?? 0) : s.n - (s.kinds.discard ?? 0);
    return ofKind > 0 && (!causeApplies || (s.causes[causeFilter!] ?? 0) > 0);
  };
  const filterKey = `${mode}|${causeApplies ? causeFilter : ''}`;
  useEffect(() => { setWalked(new Set()); setBarren(new Set()); }, [filterKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eligible = useMemo(() => (ix ? ix.shards.map((_, i) => i).filter((i) => !barren.has(i) && canServe(ix.shards[i]!)) : []), [ix, barren, filterKey]);
  /** the question on screen: the first from `pos` in the loaded shard's order that fits */
  const chosenAt = useMemo(() => {
    if (!loaded) return -1;
    for (let i = pos; i < loaded.order.length; i++) if (fits(loaded.qs[loaded.order[i]!]!)) return i;
    return -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pos, filterKey]);
  const q = chosenAt >= 0 ? loaded!.qs[loaded!.order[chosenAt]!] : undefined;
  /**
   * Move to another shard when the one on screen has nothing more for these filters.
   *
   * The next shard is drawn at random from those the index says can serve and that have not been
   * walked yet; when every one has been, the walk starts over. One shard is fetched at a time and
   * only when it is needed, which is the whole point: the first question costs one shard of about
   * 160KB rather than the whole pack, and offline the phone holds what was practised.
   */
  useEffect(() => {
    if (!ix || q) return;
    let live = true;
    const done = new Set(walked);
    if (loaded) {
      done.add(loaded.shard);
      if (!loaded.qs.some(fits) && canServe(ix.shards[loaded.shard]!)) { setBarren((b) => new Set(b).add(loaded.shard)); return; }
    }
    let pool = eligible.filter((i) => !done.has(i));
    if (!pool.length) { if (!eligible.length) return; pool = eligible; done.clear(); }
    const shard = pool[Math.floor(Math.random() * pool.length)]!;
    done.add(shard);
    setWalked(done);
    const show = (qq: Q[]) => { if (live) { setLoaded({ shard, qs: qq, order: shuffled(qq.length) }); setPos(0); } };
    const hit = shardCache.current.get(shard);
    if (hit) { show(hit); return; }
    fetch(asset(`quiz/${pack}/${ix.shards[shard]!.file}`)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { questions: Q[] }) => { shardCache.current.set(shard, d.questions); show(d.questions); })
      // a shard that will not come - no signal, or a pack being rebuilt under us - is left out of
      // this walk rather than fetched again and again
      .catch(() => { if (live) setBarren((b) => new Set(b).add(shard)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ix, q, eligible, loaded, pack]);
  /** the pack has been read and nothing in it fits: the index says so, and no shard was fetched to find out */
  const exhausted = ix !== null && eligible.length === 0;
  const teaches = (q?.c ?? null) as Cause | null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tally = useMemo(() => (causeTally() as { cause: Cause | 'unsorted'; n: number }[]).filter((t): t is { cause: Cause; n: number } => t.cause !== 'unsorted' && PRACTISABLE.includes(t.cause)), [pack]);
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
  const coachPick = useMemo(() => {
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
      // The COACH, not the learned model. This block said "the learned model would..." while
      // running the model for discards and the coach's own `claimRank` for claims - one label over
      // two different players. It is the coach in both now, which is also the honest comparison to
      // draw here: the Train tab teaches the coach, so where the coach and the measurement disagree
      // is worth seeing. The model was dropped from the app on 2026-09-02; it loses 0.544 chips a
      // game and its accuracy is measured against a grader that cannot play a colour hand.
      if (q.k === 'discard' && q.h.length % 3 === 2) return `d:${rankDiscards(q.h, melds, ctx).best.tile}`;
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
  /**
   * The shape tips this position is about, worked out from the hand rather than stored in the pack.
   *
   * Shown only after the answer. A question that says "this one is about the pair rule" has given
   * away the part that is actually hard, which is noticing that the pair rule is what you are
   * looking at. The pack is built to contain these positions; naming them is this file's job.
   */
  const shapeCallsHere = useMemo(() => {
    if (!q || q.k !== 'discard') return [];
    const throws = q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2)));
    const melds: Meld[] = q.m.map((m) => ({ type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', tiles: m.slice(2), concealed: m[1] === 1 }));
    return liveCalls(q.h, q.m.length, throws, {
      bonus: q.b, seat: (q.seat - (q.dl ?? 0) + 4) % 4, prevailingWind: q.w, melds,
      minimumFan: CONFIG.minimum_fan, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
    });
  }, [q]);
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

  /**
   * The strip of controls along the top, shared by the pack path and the fallback so that the
   * pack switcher and the cause filter are the way back from a made-up hand to a measured one.
   */
  const causeChoices = tally.slice(0, 3).map((t) => t.cause);
  if (causeFilter && !causeChoices.includes(causeFilter)) causeChoices.push(causeFilter);   // a practise cause set from Review that is not in this tab's top three still needs its button
  const controls = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {/* A pack is a table, so the button says the table. The file names (coach, min1, min1-nowild)
          are the runs they were built from, which meant nothing to Changs on his phone; a pack built
          before the table field existed still falls back to its name. */}
      {packs.map((p) => (
        <Button key={p.id} size="sm" variant={p.id === pack ? 'default' : 'outline'} onClick={() => setPack(p.id)}>
          {p.table ? <>{p.table.wildcards} <J>Jokers</J> · min {p.table.minimumTai} <J>Tai</J></> : p.id}
          <span className="ml-1.5 opacity-70">{p.questions.toLocaleString()}{p.money ? ' · $' : ''}</span>
        </Button>
      ))}
      {/*
        A pack is a record of one table. The coach's opinion beside each question is computed live
        from this app's own table config, so a pack from a different table gets its reasoning from
        the wrong game - the play-out verdict stays right, the explanation beside it does not.
        Worth saying out loud rather than leaving the reader to notice.
      */}
      {(() => {
        const t = packs.find((p) => p.id === pack)?.table;
        if (!t) return null;
        const mine = { wildcards: JOKERS, minimumTai: CONFIG.minimum_fan };
        const same = t.wildcards === mine.wildcards && t.minimumTai === mine.minimumTai;
        return (
          <span className={cn('ml-2 text-xs', same ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
            {t.wildcards} <J>Jokers</J> · {t.minimumTai} <J>Tai</J> minimum
            {!same && <> — your table is set to {mine.wildcards} and {mine.minimumTai}, so the <J>Measured Best</J> answers hold but the <J>Coach</J>'s reasoning beside them is computed for your table, not this pack's</>}
          </span>
        );
      })()}
      <span className="ml-auto" />
      {!noPack && (['all', 'discard', 'claim'] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? 'secondary' : 'ghost'} onClick={() => { setMode(m); setPicked(null); }}>{m}</Button>)}
      {/* the honest grader, aimed at whatever keeps going wrong; hidden in claim mode, where a cause has nothing to say */}
      {causeChoices.length > 0 && (mode !== 'claim' || noPack) && (
        <span className="flex flex-wrap items-center gap-1">
          <span className="ml-2 text-xs text-muted-foreground">about:</span>
          <Button size="sm" variant={causeFilter === null ? 'secondary' : 'ghost'} onClick={() => { setCauseFilter(null); setPicked(null); }}>anything</Button>
          {causeChoices.map((c) => (
            <Button key={c} size="sm" variant={causeFilter === c ? 'secondary' : 'ghost'} title={`${tally.find((t) => t.cause === c)?.n ?? 0} of your recorded mistakes`}
              onClick={() => { setCauseFilter(c); setPicked(null); }}>{causeLabel(c)}</Button>
          ))}
        </span>
      )}
    </div>
  );

  if (!noPack && !exhausted && (packState === 'loading' || !q)) return <div className="mx-auto max-w-5xl px-4 py-5 text-sm text-muted-foreground">Loading the pack…</div>;

  /**
   * The fallback: a made-up hand, marked by the coach. Served only when the pack has nothing for
   * the current filters or there is no pack, and never without saying so. The note above the hand
   * is the whole point of the arrangement - the coach is right about half the time, and a verdict
   * from it must not be mistaken for one from the play-outs.
   */
  if (noPack || exhausted || !q) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        {controls}
        <Card className="border-amber-400 dark:border-amber-700">
          <CardContent className="pt-4 text-sm space-y-1">
            <p className="font-medium">This hand is made up, and the <J>Coach</J> marks it.</p>
            <p className="text-muted-foreground">
              {noPack
                ? <>No question pack could be loaded, so there is no measured position to show. </>
                : causeApplies
                  ? <>Nothing in this pack is about "{causeLabel(causeFilter!)}", so the engine dealt one instead, aimed at that <J>cause</J> where it can be. Pick <i>anything</i>, or another pack, to get back to measured positions. </>
                  : <>Nothing in this pack fits the current mode, so the engine dealt one instead. Pick another mode, or another pack, to get back to measured positions. </>}
              The <J>Coach</J> is a set of rules that explains itself well, but it picks the play-outs' best only about half the time — 52.8% on <J>decisive</J> positions and 36.1% early in a hand. Treat its verdict as an opinion to argue with, not a measurement.
            </p>
          </CardContent>
        </Card>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Dealing…</p>}>
          <GeneratedHand seed={genSeed} cause={causeApplies ? causeFilter : null}
            onNext={(s) => { setGenSeed(s); setPicked(null); setPos((p) => p + 1); }} />
        </Suspense>
      </div>
    );
  }

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
    // The log takes every discard answered here, right or wrong, so it can be opened again with the
    // reasoning shown. Claims are left out for the same reason they are left out of the record: the
    // screen that reopens a hand asks which tile, which is not the question a claim poses.
    if (pack && q.k === 'discard' && a.startsWith('d:') && bestAction.a.startsWith('d:')) {
      recordPlay({ judge: 'playouts', pack, qid: q.id, threw: Number(a.slice(2)), best: Number(bestAction.a.slice(2)),
        verdict: v, cost: -(bestAction.ev - act.ev), right: kept });
    }
    // A mistake judged by 128 play-outs is worth meeting again more than one judged by the coach,
    // and until now the record never heard from this tab at all. Discards only: the review screen
    // asks "which tile", and a claim question is a different question that it cannot pose.
    if ((v === 'mistake' || v === 'blunder') && pack && q.k === 'discard' && a.startsWith('d:') && bestAction.a.startsWith('d:')) {
      recordMistake({
        pack, qid: q.id, picked: Number(a.slice(2)), coachPick: Number(bestAction.a.slice(2)), verdict: v,
        cost: -(bestAction.ev - act.ev), why: coach?.reasonFor(Number(bestAction.a.slice(2)))[0] ?? '',
      });
    }
  };
  const next = () => { setPicked(null); setChallengeState(null); setPos(chosenAt + 1); };
  /**
   * Judge the verdict again on fresh play-outs, here, with no server. The pick is measured against
   * the pack's best (or, when the pick was the best, against the runner-up), with the runner-up
   * along as a third action where it is a different tile. When the original verdict charged a
   * mistake and the fresh dice do not uphold it, the hand log and the mistake card are told, and
   * the session tally moves the answer to "too close to call".
   */
  const runsChallenge = async () => {
    if (!pack || picked === null || !pickedAction || !verdict) return;
    if (!canChallenge(q)) { setChallengeState({ running: false, error: 'this pack was built before questions carried the whole table, so the position cannot be rebuilt here' }); return; }
    const pickWasBest = picked === bestAction.a;
    const reference = pickWasBest ? actions[1]?.a : bestAction.a;
    if (!reference) return;
    const compare = [picked, reference];
    const runnerUp = actions[1]?.a;
    if (runnerUp && !compare.includes(runnerUp)) compare.push(runnerUp);
    const table = packs.find((p) => p.id === pack)?.table;
    setChallengeState({ running: true, done: 0, total: compare.length * CHALLENGE_ROLLOUTS });
    try {
      const outcome = await challenge({ q: { ...q, id: q.id }, rules: rulesForPack(table, unit, money), compare }, (done, total) => setChallengeState({ running: true, done, total }));
      setChallengeState({ running: false, outcome });
      const charged = verdict === 'mistake' || verdict === 'blunder';
      if (charged && challengeKind(outcome.gap, outcome.se, pickWasBest) !== 'holds') {
        const note = { gap: outcome.gap, se: outcome.se, n: outcome.n, at: Date.now() };
        challengePlay(pack, q.id, note);
        challengeMistake(pack, q.id, note);
        setScore((s) => ({ ...s, [verdict]: Math.max(0, s[verdict] - 1), unclear: s.unclear + 1, lost: s.lost - regret + Math.max(0, outcome.gap) }));
      }
    } catch (e) { setChallengeState({ running: false, error: e instanceof Error ? e.message : String(e) }); }
  };

  const discardKinds = new Set(q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2))));
  // an unmatched filter never reaches here: the fallback above serves it
  const causeNote = teaches ? `the throw actually made here was: ${causeLabel(teaches)}` : null;
  const sorted = [...q.h].sort((a, b) => a - b);
  const drIdx = q.dr !== null ? sorted.indexOf(q.dr) : -1;
  const handTiles = drIdx >= 0 ? [...sorted.slice(0, drIdx), ...sorted.slice(drIdx + 1)] : sorted;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
      {controls}

      <Card>
        <CardContent className="pt-4">
          <HandContext seat={q.seat} dealer={q.dl} prevailingWind={q.w} playerTurns={q.t}
            fan={q.fih} fanLabel="*Tai* in hand" className="gap-x-5 gap-y-2">
            <span className="ml-auto text-xs text-muted-foreground">a real position · {playoutRange} play-outs per move{repriced ? ' · priced at your table' : ''}</span>
          </HandContext>
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
        </CardTitle>
          {causeNote && <p className="text-xs text-muted-foreground">{causeNote}</p>}
        </CardHeader>
        <CardContent className="space-y-3 @container">
          {(q.m.length > 0 || q.b.length > 0) && (
            <div className="flex flex-nowrap max-sm:flex-wrap items-end gap-x-4 gap-y-2 pb-1 border-b">
              {q.b.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className={LABEL}>Your <J>Bonus Tiles</J></span>
                  <div className="flex flex-nowrap max-sm:flex-wrap items-end gap-0.5 sm:gap-1">{q.b.map((k, i) => <Tile key={i} kind={k} size="md" fluid />)}</div>
                </div>
              )}
              {q.m.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className={LABEL}>Your <J>Melds</J></span>
                  <div className="flex flex-nowrap max-sm:flex-wrap items-end gap-0.5 sm:gap-1">
                    {q.m.map((m, i) => (
                      <span key={i} className="flex gap-0.5 sm:gap-1 mr-2 last:mr-0">{m.slice(2).map((k, j) => <Tile key={j} kind={k} size="md" fluid concealed={m[1] === 1} />)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {(q.m.length > 0 || q.b.length > 0) && <span className={cn(LABEL, 'block')}>In your hand — concealed</span>}
          {/* on a phone the tiles are fixed at 38px and wrap to two rows: see Tile's `fluid` */}
          <div className="flex flex-nowrap max-sm:flex-wrap items-end gap-0.5 gap-y-2 sm:gap-1.5">
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
                {/* The coach is what the Train tab teaches. Measured EVs are the authority here,
                    so this is the place the coach's disagreements with the measurement show up. */}
                {coachPick !== null && (
                  <div className="pb-1 mb-1 border-b">
                    <span className="text-muted-foreground">The <J>Coach</J> would</span> <b>{actionText(coachPick).toLowerCase()}</b>.
                    {coachPick === bestAction.a
                      ? <span className="text-emerald-700 dark:text-emerald-300"> Agrees with the measurement.</span>
                      : <span className="text-amber-700 dark:text-amber-300"> The measurement disagrees — trust the bars here.</span>}
                  </div>
                )}
                <div><span className="text-muted-foreground"><J>Coach</J> reads this as</span> <b>{coach.plan}</b>.
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
            {shapeCallsHere.length > 0 && (
              <div className="mb-3 rounded-md border bg-secondary/40 p-3 text-sm space-y-2">
                {shapeCallsHere.map((c) => {
                  const tip = TIPS.find((t) => t.id === c.tip);
                  const bestKind = bestAction.a.startsWith('d:') ? Number(bestAction.a.slice(2)) : null;
                  const follows = bestKind !== null && c.says.includes(bestKind);
                  const goesAgainst = bestKind !== null && c.against.includes(bestKind);
                  return (
                    <div key={c.tip} className="space-y-0.5">
                      <div><span className="text-muted-foreground">A shape you have a card for:</span> <b>{jargon(tip?.title ?? c.tip)}</b></div>
                      <div className="text-muted-foreground">{c.because}</div>
                      <div>
                        {follows ? <span className="text-emerald-700 dark:text-emerald-300">The <J>Measured Best</J> does what the tip says.</span>
                          : goesAgainst ? <span className="text-amber-700 dark:text-amber-300">The <J>Measured Best</J> goes the other way here. One position settles nothing, but it is worth asking what this hand has that the tip does not know about.</span>
                          : <span className="text-muted-foreground">The <J>Measured Best</J> is a third tile, so the tip did not decide this one.</span>}
                      </div>
                    </div>
                  );
                })}
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
              {/* The one handle a person has on a position they dispute. Without it, "that verdict
                  was wrong" cannot be checked by anybody, because the id lives only in the hand log.
                  Quote pack and id and the position can be re-judged here at 2,048 play-outs. */}
              <span className="ml-auto self-center font-mono text-[11px] text-muted-foreground select-all">{pack} · {q.id}</span>
              {/* The verdict rests on the same play-outs that admitted the question, so about one in
                  ten overstates. This judges the pick again on fresh dice, on this device, with no
                  server - see `lib/rejudge.ts`. Gone once it has answered: a second press would be
                  a second opinion on new dice, and the tally must not be moved twice. */}
              {challengeState === null && actions.length > 1 && (
                <Button variant="outline" onClick={runsChallenge}>Challenge the verdict ({CHALLENGE_ROLLOUTS} fresh play-outs)</Button>
              )}
            </div>
            {challengeState && (
              <div className="mt-2 rounded-md border p-3 text-sm space-y-2">
                {challengeState.running ? (
                  <>
                    <div>Re-judging on fresh play-outs… {challengeState.done.toLocaleString()} of {challengeState.total.toLocaleString()}</div>
                    <div className="h-2 rounded bg-secondary overflow-hidden"><div className="h-full bg-sky-500 transition-[width]" style={{ width: `${100 * challengeState.done / Math.max(1, challengeState.total)}%` }} /></div>
                  </>
                ) : challengeState.error ? (
                  <div className="text-muted-foreground">Could not re-judge this one: {challengeState.error}.</div>
                ) : challengeState.outcome && picked !== null && (() => {
                  const o = challengeState.outcome;
                  const pickWasBest = picked === bestAction.a;
                  const kind = challengeKind(o.gap, o.se, pickWasBest);
                  const mine = actionText(picked).toLowerCase(), ref = actionText(o.reference).toLowerCase();
                  const x = fmt(Math.abs(o.gap)), y = fmt(o.se);
                  const words = !pickWasBest
                    ? kind === 'holds' ? <><b>Holds:</b> on fresh play-outs your {mine} is still {x} worse than {ref} (about ±{y}).</>
                      : kind === 'close' ? <><b>Too close to call:</b> the fresh gap is {x}, inside the noise of ±{y} — the pack's verdict was a coin flip.</>
                        : <><b>Reversed:</b> on fresh play-outs your {mine} comes out {x} better than {ref}.</>
                    : kind === 'holds' ? <><b>Holds:</b> on fresh play-outs your {mine} is still {x} better than the runner-up, {ref} (about ±{y}).</>
                      : kind === 'close' ? <><b>Too close to call:</b> the fresh gap to the runner-up is {x}, inside the noise of ±{y} — the pack's verdict was a coin flip.</>
                        : <><b>Reversed:</b> on fresh play-outs the runner-up, {ref}, comes out {x} better than your {mine}.</>;
                  return (
                    <>
                      <div className={cn(kind === 'holds' ? '' : kind === 'close' ? 'text-slate-700 dark:text-slate-200' : 'text-emerald-700 dark:text-emerald-300')}>{words}</div>
                      {/* fresh EVs count from this decision, not from the deal, so they sit at a
                          different level from the pack's; the gap is what to read */}
                      <div className="text-xs text-muted-foreground">
                        {o.n} fresh play-outs each, {(o.ms / 1000).toFixed(1)}s: {o.actions.map((a) => `${actionText(a.a).toLowerCase()} ${fmt(a.ev)}`).join(' · ')}.
                        {/* claims are in neither the log nor the record (see `choose`), so only a discard has entries to note */}
                        {!pickWasBest && (verdict === 'mistake' || verdict === 'blunder') && kind !== 'holds' && <> Moved to "too close to call" in the session tally{q.k === 'discard' ? ', and noted on the hand log and the mistake card' : ''}.</>}
                      </div>
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
