/**
 * Play: deal one hand, play it out against three coaches, then review every decision you made
 * against the measured best.
 *
 * PLAN.md says what this is and what it must not become. A hand's result is mostly luck - its
 * standard deviation is two orders of magnitude wider than any real difference in play - so the
 * game is not the training tool and the drills keep their hour. What a game gives that no drill
 * can is the whole hand: sequencing it, folding in the middle of one, making calls in context, and
 * watching the wall run out. So the loop is built to be reviewed rather than won. Every decision
 * the human makes is kept with the engine's snapshot of the position before it, and afterwards each
 * one can be judged by `rejudge` - the same play-outs that grade the packs and answer the
 * Challenge button - on demand, one at a time, because judging a whole hand at once is minutes of
 * work on a phone.
 *
 * The engine is driven directly. `GameState` already stops at every decision and says whose it is
 * and what is legal, so the loop here is: step the bots until `pending()` names the human, take a
 * snapshot, wait for a tap, apply it, repeat. Nothing in this file decides what is legal; the
 * buttons are built from `pending().legal` and nothing else.
 *
 * The three opponents are `CoachBot`, the book coach, which is the player this app teaches. The
 * table is the one set up in Table setup - its wildcards, its minimum and its money - built the
 * way the Challenge button builds a pack's, so the money on screen is the money the review is
 * priced in.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tile } from '@/components/Tile';
import { PublicTable, type SeatPublic } from '@/components/PublicTable';
import { tileLabel } from '@/lib/tiles';
import { cn } from '@/lib/utils';
import { J, jargon } from '@/lib/jargon';
import { loadConfig, COMBO_LABEL } from '@/lib/money';
import { rulesForPack, judgePlay, PLAY_ROLLOUTS, type PlayVerdict } from '@/lib/rejudge';
import { readPlays, recordHand, noteVerdict, type PlayedHand, type PlayDecision } from '@/lib/play';
import { GameState, Wall, makeRng, kindOf, tableConfigOf, type Bot, type DecisionKind, type LegalAction, type RulesConfig, type Snapshot } from 'sg-mahjong-engine';
import { CoachBot, encAction, rankDiscards, ctxOf, meldsOf } from 'sg-mahjong-solver';

const WIND = ['東', '南', '西', '北'];
const LABEL = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground';
/** the pause between one bot's decision and the next, so a hand can be watched rather than
 *  appearing all at once */
const STEP_MS = 350;
/**
 * The most tiles a discard judgement compares. Thirteen legal tiles at 256 play-outs each is
 * several seconds on the Mac and half a minute on a phone, and most of them are tiles nobody would
 * throw. Six is the tile you threw plus the five the coach's own ranking likes best, which is
 * where the best tile almost always is; the screen says which were compared.
 */
const MAX_JUDGED = 6;

/** the game in progress: the engine, the bots, and the decision the human is being asked for */
interface Live {
  g: GameState; bots: Bot[]; rules: RulesConfig; human: number; id: string; at: number;
  decisions: PlayDecision[];
  /** captured the moment the engine stopped at the human's seat, before anything was tapped */
  pending: { snap: Snapshot; legal: LegalAction[]; kind: DecisionKind; turn: number } | null;
}

const fmt = (x: number) => `${x < 0 ? '−' : ''}$${Number.isInteger(x) ? Math.abs(x) : Math.abs(x).toFixed(2)}`;
/** what an action is called on a button or in a verdict */
function actionText(a: LegalAction): string {
  switch (a.a) {
    case 'discard': return `Discard ${tileLabel(a.kind)}`;
    case 'win': return 'Win';
    case 'pass': return 'Pass';
    case 'proceed': return 'Carry on';
    case 'pong': return 'Pong';
    case 'chow': return 'Chow';
    case 'kong4': return 'Kong (concealed)';
    case 'kong1': return 'Kong (add to your Pong)';
    case 'kong3': return 'Kong';
  }
}
/** the same, from the judge's compact action string */
const textOf = (a: string): string => a === 'win' ? 'win' : a === 'pass' ? 'pass' : a === 'proceed' ? 'carry on' : a.startsWith('d:') ? `discard ${tileLabel(Number(a.slice(2)))}` : a.startsWith('pong') ? 'Pong' : a.startsWith('chow') ? 'Chow' : 'Kong';
const KIND_WORD: Record<DecisionKind, string> = { discard: 'Discard', self: 'After the draw', claim: 'Claim window' };

/** distinct actions, as the judge names them: two copies of the same tile are one decision */
function distinct(legal: LegalAction[]): string[] {
  const out: string[] = [];
  for (const l of legal) { const k = encAction(l); if (!out.includes(k)) out.push(k); }
  return out;
}

/**
 * Which actions to play out for one decision. Everything, unless it is a discard with more tiles
 * than `MAX_JUDGED`, in which case the tile thrown plus the coach's five favourites. The coach's
 * ranking is only choosing what gets measured; the measurement itself is the play-outs.
 */
function compareFor(d: PlayDecision, rules: RulesConfig): string[] {
  const all = distinct(d.legal);
  if (d.kind !== 'discard' || all.length <= MAX_JUDGED) return all;
  const chosen = encAction(d.chosen);
  let liked: string[] = [];
  try {
    const g = GameState.fromSnapshot(d.snap, tableConfigOf(rules), { rules });
    const v = g.view(d.seat, null);
    liked = rankDiscards(v.hand.map(kindOf), meldsOf(v), ctxOf(v)).options.map((o) => `d:${o.tile}`);
  } catch { liked = []; }
  const rest = [...liked.filter((a) => all.includes(a) && a !== chosen), ...all.filter((a) => a !== chosen && !liked.includes(a))];
  return [chosen, ...rest.slice(0, MAX_JUDGED - 1)];
}

const roleOf = (seat: number, dealer: number) => (seat - dealer + 4) % 4;

export default function Play() {
  const live = useRef<Live | null>(null);
  /** bumped after every engine step so the screen redraws from the engine's state */
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const [err, setErr] = useState<string | null>(null);
  /** the finished hand under review, from this session or reopened from the store */
  const [hand, setHand] = useState<PlayedHand | null>(null);
  const handRef = useRef<PlayedHand | null>(null);
  const [verdicts, setVerdicts] = useState<Record<number, { v: PlayVerdict; compared: { judged: number; legal: number } }>>({});
  const verdictsRef = useRef(verdicts);
  const [judging, setJudging] = useState<Record<number, { done: number; total: number }>>({});
  const [judgeErr, setJudgeErr] = useState<Record<number, string>>({});
  const inflight = useRef(new Set<number>());
  const [allRunning, setAllRunning] = useState(false);
  const money = useMemo(() => loadConfig(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const earlier = useMemo(() => readPlays(), [hand, tick]);

  /** Bring the engine to the next decision. If it is the human's, capture the position before
   *  anything is shown; if the hand is over, close it out. */
  const settle = useCallback(() => {
    const L = live.current;
    if (!L) return;
    try {
      if (!L.g.finished && !L.g.pending()) L.g.advance();
      if (L.g.finished) {
        const r = L.g.result!;
        const finished: PlayedHand = {
          id: L.id, at: L.at, seat: L.human, dealer: L.g.dealer, prevailingWind: L.g.prevailingWind, rules: L.rules,
          result: { winner: r.winner, selfDraw: r.selfDraw, discarder: r.discarder, fan: r.score?.fan ?? null, combination: r.score?.combination ?? null, chips: r.chipsDelta, playerTurns: r.playerTurns },
          decisions: L.decisions,
        };
        recordHand(finished);
        live.current = null;
        open(finished);
        return;
      }
      const p = L.g.pending();
      if (p && p.seat === L.human && !L.pending) L.pending = { snap: L.g.snapshot(), legal: p.legal, kind: p.kind, turn: L.g.playerTurns };
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Show a finished hand's review, with whatever verdicts it already carries. */
  const open = (h: PlayedHand) => {
    const seeded: typeof verdicts = {};
    h.decisions.forEach((d, i) => { if (d.verdict && d.compared) seeded[i] = { v: d.verdict, compared: d.compared }; });
    inflight.current.clear();
    verdictsRef.current = seeded; setVerdicts(seeded); setJudging({}); setJudgeErr({});
    handRef.current = h; setHand(h);
  };

  const deal = () => {
    const rules = rulesForPack({ wildcards: money.jokers, minimumTai: money.minTai }, '$', money);
    const seed = Math.floor(Math.random() * 1e9);
    const wall = new Wall(makeRng(seed), rules.unplayable_tiles, rules.jokers.count);
    const dealer = Math.floor(Math.random() * 4);
    try {
      const g = GameState.deal(tableConfigOf(rules), wall, { dealer, prevailingWind: 0, rules });
      live.current = { g, bots: [0, 1, 2, 3].map(() => new CoachBot()), rules, human: 0, id: `play:${seed}:${Date.now()}`, at: Date.now(), decisions: [], pending: null };
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); return; }
    setErr(null); setHand(null); handRef.current = null;
    settle();
  };

  const botStep = useCallback(() => {
    const L = live.current;
    if (!L || L.g.finished) return;
    try { L.g.step(L.bots); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    settle();
  }, [settle]);

  // One bot decision per pause. The effect re-arms after every redraw, and it does nothing while
  // the engine is waiting on the human, so the pause is only ever between bot moves.
  useEffect(() => {
    const L = live.current;
    if (!L || L.g.finished) return;
    const p = L.g.pending();
    if (!p || p.seat === L.human) return;
    const t = window.setTimeout(botStep, STEP_MS);
    return () => window.clearTimeout(t);
  }, [tick, botStep]);

  /** every bot decision up to the next one that is the human's, at once */
  const skip = () => {
    const L = live.current;
    if (!L) return;
    try {
      for (let guard = 0; guard < 4000 && !L.g.finished; guard++) {
        if (!L.g.pending()) L.g.advance();
        const p = L.g.pending();
        if (!p || p.seat === L.human) break;
        L.g.step(L.bots);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    settle();
  };

  /** the human's tap: recorded with the position it was made in, then applied */
  const act = (action: LegalAction) => {
    const L = live.current;
    if (!L || !L.pending) return;
    const pend = L.pending;
    L.decisions.push({ turn: pend.turn, kind: pend.kind, seat: L.human, snap: pend.snap, legal: pend.legal, chosen: action });
    L.pending = null;
    try { L.g.apply(action); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    settle();
  };

  /** judge decision `i` of the hand on screen, once */
  const judge = useCallback(async (i: number) => {
    const h = handRef.current;
    const d = h?.decisions[i];
    if (!h || !d || inflight.current.has(i) || verdictsRef.current[i]) return;
    inflight.current.add(i);
    const compare = compareFor(d, h.rules);
    setJudging((m) => ({ ...m, [i]: { done: 0, total: compare.length * PLAY_ROLLOUTS } }));
    setJudgeErr((m) => { const n = { ...m }; delete n[i]; return n; });
    try {
      const v = await judgePlay(d.snap, h.rules, d.seat, compare, encAction(d.chosen), `${h.id}:${i}`, (done, total) => setJudging((m) => ({ ...m, [i]: { done, total } })));
      if (handRef.current?.id !== h.id) return;              // the hand changed under the judge
      const compared = { judged: compare.length, legal: distinct(d.legal).length };
      noteVerdict(h.id, i, v, compared);
      verdictsRef.current = { ...verdictsRef.current, [i]: { v, compared } };
      setVerdicts(verdictsRef.current);
    } catch (e) {
      if (handRef.current?.id === h.id) setJudgeErr((m) => ({ ...m, [i]: e instanceof Error ? e.message : String(e) }));
    } finally {
      inflight.current.delete(i);
      setJudging((m) => { const n = { ...m }; delete n[i]; return n; });
    }
  }, []);

  /** the whole hand, one decision after another, for whoever is willing to wait */
  const judgeAll = async () => {
    const h = handRef.current;
    if (!h) return;
    setAllRunning(true);
    for (let i = 0; i < h.decisions.length; i++) {
      if (handRef.current?.id !== h.id) break;
      await judge(i);
    }
    setAllRunning(false);
  };

  // ------------------------------------------------------------------ the table, mid-hand
  const L = live.current;
  if (L && !L.g.finished) {
    const g = L.g, human = L.human;
    const p = g.pending();
    const me = g.players[human]!;
    const legal = L.pending?.legal ?? [];
    const throwable = new Set(legal.filter((a) => a.a === 'discard').map((a) => a.tile));
    const drawn = g.turn === human && g.drawnInfo && (g.phase === 'self' || g.phase === 'discard') ? g.drawnInfo.tile : null;
    const sorted = [...me.hand].filter((t) => t !== drawn).sort((a, b) => kindOf(a) - kindOf(b));
    const offered = g.pendingRob ? { tile: g.pendingRob.tile, from: g.pendingRob.from, rob: true } : g.pendingDiscard ? { tile: g.pendingDiscard.tile, from: g.pendingDiscard.from, rob: false } : null;
    const last = g.discardLog[g.discardLog.length - 1];
    const seats: SeatPublic[] = [0, 1, 2, 3].map((s) => ({
      wind: WIND[g.role(s)]!, you: s === human, dealer: s === g.dealer, acting: p?.seat === s,
      bonus: s === human ? [] : g.players[s]!.bonus.map(kindOf),
      melds: s === human ? [] : g.players[s]!.melds.map((m) => ({ tiles: m.tiles, concealed: m.concealed })),
      discards: g.players[s]!.discards.map((t) => ({ kind: kindOf(t), claimed: false })),
    }));
    const mine = p?.seat === human;
    const prompt = !mine ? <>{WIND[g.role(p?.seat ?? g.turn)]} is thinking…</>
      : p!.kind === 'discard' ? <>Your turn — tap a tile to throw it.</>
      : p!.kind === 'self' ? <>You drew <b>{tileLabel(kindOf(g.drawnInfo!.tile))}</b>. Win, <J>Kong</J>, or carry on?</>
      : offered?.rob ? <>{WIND[g.role(offered.from)]} declared a <J>Kong</J> on <b>{tileLabel(kindOf(offered.tile))}</b> — rob it, or pass?</>
      : offered ? <>{WIND[g.role(offered.from)]} threw <b>{tileLabel(kindOf(offered.tile))}</b> — claim it, or pass?</> : null;

    return (
      <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        <Card>
          <CardContent className="pt-4 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>You are <b>{WIND[g.role(human)]}</b>{g.dealer === human && ' (host)'}</span>
              <span className="text-muted-foreground">turn <b className="text-foreground">{g.playerTurns}</b> · <J>Wall</J> <b className="text-foreground">{g.wall.remaining}</b></span>
              {last && <span className="flex items-center gap-1 text-muted-foreground">last throw <Tile kind={kindOf(last.tile)} size="xxs" /> by {WIND[g.role(last.seat)]}</span>}
              <span className="text-muted-foreground">you: <b className="text-foreground">{fmt(me.chips)}</b></span>
              <span className="ml-auto flex gap-2">
                {!mine && <Button size="sm" variant="outline" onClick={skip}>Skip to my turn</Button>}
                <Button size="sm" variant="ghost" onClick={() => { live.current = null; bump(); }}>Abandon</Button>
              </span>
            </div>
            {err && <p className="text-destructive">The engine stopped: {err}</p>}
          </CardContent>
        </Card>

        <PublicTable you={human} seats={seats}
          centre={<div className="text-center leading-tight">
            <div className="text-lg font-semibold">{WIND[g.prevailingWind]}圈</div>
            <div className="text-xs text-muted-foreground">第{Math.max(1, Math.ceil(g.playerTurns / 4))}巡</div>
          </div>} />

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{prompt}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(me.melds.length > 0 || me.bonus.length > 0) && (
              <div className="flex flex-nowrap max-sm:flex-wrap items-end gap-x-4 gap-y-2 pb-1 border-b">
                {me.bonus.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className={LABEL}>Your <J>Bonus Tiles</J></span>
                    <div className="flex flex-wrap items-end gap-0.5 sm:gap-1">{me.bonus.map((t) => <Tile key={t} kind={kindOf(t)} size="xs" />)}</div>
                  </div>
                )}
                {me.melds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className={LABEL}>Your <J>Melds</J></span>
                    <div className="flex flex-wrap items-end gap-0.5 sm:gap-1">
                      {me.melds.map((m, i) => (
                        <span key={i} className="flex gap-0.5 mr-2 last:mr-0">{m.instances.map((t) => <Tile key={t} kind={kindOf(t)} size="xs" concealed={m.concealed} />)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <span className={cn(LABEL, 'block')}>In your hand — concealed{offered && mine && p!.kind === 'claim' ? <> · offered: {tileLabel(kindOf(offered.tile))}</> : ''}</span>
            {/* every tile is a button only when the engine lists it as a legal throw: a wildcard
                at a table that forbids throwing one has no click, and neither does anything
                while it is not your turn */}
            <div className="flex flex-nowrap max-sm:flex-wrap items-end gap-0.5 gap-y-2 sm:gap-1.5">
              {sorted.map((t) => (
                <Tile key={t} kind={kindOf(t)} size="md" fluid
                  onClick={throwable.has(t) ? () => act(legal.find((a) => a.a === 'discard' && a.tile === t)!) : undefined} />
              ))}
              {drawn !== null && (
                <><div className="w-2 shrink-0" />
                  <Tile kind={kindOf(drawn)} size="md" badge="drew" fluid
                    onClick={throwable.has(drawn) ? () => act(legal.find((a) => a.a === 'discard' && a.tile === drawn)!) : undefined} /></>
              )}
            </div>
            {mine && p!.kind !== 'discard' && (
              <div className="flex flex-wrap gap-2">
                {legal.filter((a) => a.a !== 'discard').map((a) => (
                  <Button key={encAction(a)} variant={a.a === 'win' ? 'default' : 'outline'} onClick={() => act(a)} className="gap-1">
                    {a.a === 'pong' ? <J>Pong</J> : a.a === 'chow' ? <J>Chow</J> : a.a === 'kong3' || a.a === 'kong4' || a.a === 'kong1' ? <><J>Kong</J>{a.a === 'kong4' ? ' (concealed)' : a.a === 'kong1' ? ' (add to your Pong)' : ''}</> : actionText(a)}
                    {a.a === 'chow' && a.kinds.map((k, i) => <Tile key={i} kind={k} size="xs" />)}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ------------------------------------------------------------------ the review, after the hand
  if (hand) {
    const r = hand.result, you = hand.seat;
    const name = (s: number) => (s === you ? 'You' : WIND[roleOf(s, hand.dealer)]!);
    const combo = r.combination ? COMBO_LABEL[r.combination] ?? r.combination : null;
    const outcome = r.winner === null
      ? <>Nobody won — the hand was drawn.</>
      : <>{name(r.winner)} won {r.selfDraw ? 'by self-draw' : r.discarder !== null ? <>on {name(r.discarder).toLowerCase() === 'you' ? 'your' : `${name(r.discarder)}'s`} throw</> : ''}{r.fan !== null && <>, <b>{r.fan} <J>Tai</J></b></>}{combo && <> — {jargon(combo)}</>}.</>;
    const judgedCount = Object.keys(verdicts).length;
    const mistakes = Object.values(verdicts).filter((x) => x.v.kind === 'mistake').length;
    return (
      <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{outcome}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {[0, 1, 2, 3].map((s) => <span key={s} className={cn(s === you && 'font-semibold')}>{name(s)}: {fmt(r.chips[s] ?? 0)}</span>)}
              <span className="text-muted-foreground">· {r.playerTurns} turns · {hand.decisions.length} decisions of yours</span>
            </div>
            <p className="text-muted-foreground">A hand's result is mostly luck. The review below is what to read.</p>
            {/*
              The play-out bots never fold and rarely win first, so a hand still waiting looks worth
              more to them than one cashed for a small win. That makes the judge unreliable on the
              decision to take a win or make a call, and it says so rather than being believed.
              FINDINGS carries the measurement; the fix is a stronger rollout policy for claims.
            */}
            <p className="text-muted-foreground">Trust it on throws. On <J>Pong</J>, <J>Chow</J> and taking a win it is not reliable yet: the play-outs push on rather than cashing a small win, so they under-price a claim.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={deal}>Play another hand</Button>
              {judgedCount < hand.decisions.length && (
                <Button variant="outline" disabled={allRunning} onClick={judgeAll}>
                  {allRunning ? `Judging… ${judgedCount} of ${hand.decisions.length}` : `Judge all ${hand.decisions.length - judgedCount} unjudged`}
                </Button>
              )}
              {judgedCount > 0 && <span className="self-center text-xs text-muted-foreground">{judgedCount} judged · {mistakes} {mistakes === 1 ? 'mistake' : 'mistakes'}</span>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {hand.decisions.map((d, i) => <DecisionRow key={i} d={d} verdict={verdicts[i]} progress={judging[i]} error={judgeErr[i]} onJudge={() => void judge(i)} />)}
          {hand.decisions.length === 0 && <p className="text-sm text-muted-foreground">The hand ended before you had a decision to make.</p>}
        </div>

        <Earlier list={earlier.filter((h) => h.id !== hand.id)} onOpen={open} />
      </div>
    );
  }

  // ------------------------------------------------------------------ nothing dealt yet
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Play a whole hand</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>One hand against three <J>Coaches</J>, at your table: {money.jokers} <J>Jokers</J>, {money.minTai} <J>Tai</J> minimum, {money.name}.</p>
          <p className="text-muted-foreground">A hand's result is mostly luck. What is worth reading is the review afterwards, where every decision you made can be judged by play-outs against the <J>Measured Best</J>.</p>
          {err && <p className="text-destructive">The engine stopped: {err}</p>}
          <Button onClick={deal}>Deal</Button>
        </CardContent>
      </Card>
      <Earlier list={earlier} onOpen={open} />
    </div>
  );
}

/** One decision of the hand: what the position was, what you did, and what the judge says. */
function DecisionRow({ d, verdict, progress, error, onJudge }: {
  d: PlayDecision;
  verdict?: { v: PlayVerdict; compared: { judged: number; legal: number } };
  progress?: { done: number; total: number }; error?: string; onJudge: () => void;
}) {
  const me = d.snap.players[d.seat]!;
  const chosen = encAction(d.chosen);
  const chosenKind = d.chosen.a === 'discard' ? d.chosen.kind : null;
  const hand14 = [...me.hand].map(kindOf).sort((a, b) => a - b);
  // the drawn tile is separated on a self or discard decision, as it was on screen
  const drawn = d.snap.drawnInfo && d.snap.turn === d.seat && (d.kind === 'self' || d.kind === 'discard') ? kindOf(d.snap.drawnInfo.tile) : null;
  const drawnAt = drawn !== null ? hand14.indexOf(drawn) : -1;
  const shown = drawnAt >= 0 ? [...hand14.slice(0, drawnAt), ...hand14.slice(drawnAt + 1)] : hand14;
  const offered = d.kind === 'claim' ? (d.snap.pendingRob?.tile ?? d.snap.pendingDiscard?.tile ?? null) : null;
  // only one copy of the thrown kind gets the ring: the drawn tile if it was that, else the first in the row
  const ringOnDrawn = drawn !== null && chosenKind === drawn;
  const ringAt = chosenKind === null || ringOnDrawn ? -1 : shown.indexOf(chosenKind);
  const v = verdict?.v;
  const style = v?.kind === 'best' ? 'bg-emerald-600 text-white' : v?.kind === 'mistake' ? 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50' : 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-50';
  const badge = v?.kind === 'best' ? 'Best' : v?.kind === 'mistake' ? 'Mistake' : 'Too close to call';
  const x = v ? fmt(Math.abs(v.gap)) : '', y = v ? fmt(v.se) : '', ref = v ? textOf(v.reference) : '';
  const mineTop = v ? v.actions[0]?.a === chosen : false;
  const words = !v ? null
    : v.actions.length < 2 ? <>Nothing else was legal, so there was nothing to compare.</>
    : v.kind === 'best' ? <>Nothing compared came close: the runner-up, {ref}, is {x} behind (about ±{y}).</>
    : v.kind === 'mistake' ? <>{ref[0]!.toUpperCase() + ref.slice(1)} was worth <b>{x}</b> more (about ±{y}).</>
    : mineTop ? <>Yours came top, but {ref} is within the noise — {x} apart, about ±{y}.</>
    : <>{ref[0]!.toUpperCase() + ref.slice(1)} measured {x} better, inside the noise of ±{y} — not a worse move, an unmeasurable one.</>;

  return (
    <div className="rounded-md border p-2 space-y-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-muted-foreground">turn {d.turn}</span>
        <span><span className="text-muted-foreground">{KIND_WORD[d.kind]}:</span> <b>{actionText(d.chosen)}</b></span>
        {d.chosen.a === 'chow' && <span className="flex gap-0.5">{d.chosen.kinds.map((k, i) => <Tile key={i} kind={k} size="xxs" />)}</span>}
        {offered !== null && <span className="flex items-center gap-1 text-xs text-muted-foreground">offered <Tile kind={kindOf(offered)} size="xxs" /></span>}
        <span className="ml-auto flex items-center gap-2">
          {v ? <Badge className={style}>{badge}</Badge>
            : progress ? <span className="text-xs text-muted-foreground tabular-nums">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
            : <Button size="sm" variant="outline" onClick={onJudge}>Judge</Button>}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-0.5">
        {me.melds.map((m, i) => <span key={`m${i}`} className="flex gap-0 mr-1.5">{m.tiles.map((k, j) => <Tile key={j} kind={k} size="xxs" concealed={m.concealed} dim />)}</span>)}
        {shown.map((k, i) => <Tile key={i} kind={k} size="xxs" highlight={i === ringAt} />)}
        {drawn !== null && <><span className="w-1.5" /><Tile kind={drawn} size="xxs" highlight={ringOnDrawn} badge="drew" /></>}
      </div>
      {progress && <div className="h-1.5 rounded bg-secondary overflow-hidden"><div className="h-full bg-sky-500 transition-[width]" style={{ width: `${100 * progress.done / Math.max(1, progress.total)}%` }} /></div>}
      {error && <p className="text-xs text-muted-foreground">Could not judge this one: {error}.</p>}
      {v && verdict && (
        <div className="space-y-1">
          <div>{words}</div>
          <div className="text-xs text-muted-foreground">
            {v.n} play-outs each, {(v.ms / 1000).toFixed(1)}s. Compared {verdict.compared.judged} of {verdict.compared.legal} legal {d.kind === 'discard' ? 'tiles' : 'actions'}
            {verdict.compared.judged < verdict.compared.legal ? <>: yours and the {verdict.compared.judged - 1} the <J>Coach</J> liked best</> : ''}.
            {' '}{v.actions.map((a) => `${textOf(a.a)} ${fmt(a.ev)}${a.a === chosen ? ' (you)' : ''}`).join(' · ')}.
          </div>
        </div>
      )}
    </div>
  );
}

/** Hands played before, newest first, each reopenable for review. */
function Earlier({ list, onOpen }: { list: PlayedHand[]; onOpen: (h: PlayedHand) => void }) {
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Earlier hands</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        {list.map((h) => {
          const judged = h.decisions.filter((d) => d.verdict).length;
          const mistakes = h.decisions.filter((d) => d.verdict?.kind === 'mistake').length;
          return (
            <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
              <span>{h.result.winner === null ? 'drawn' : h.result.winner === h.seat ? 'you won' : `${WIND[roleOf(h.result.winner, h.dealer)]} won`} · you {fmt(h.result.chips[h.seat] ?? 0)}</span>
              <span className="text-xs text-muted-foreground">{judged} of {h.decisions.length} judged{judged ? `, ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}` : ''}</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onOpen(h)}>Review</Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
