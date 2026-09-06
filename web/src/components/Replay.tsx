/**
 * Film room: browse recorded hands from the data generator, scrub through every
 * decision, and see what each legal move was worth (evaluator EVs).
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tile } from '@/components/Tile';
import { PublicTable } from '@/components/PublicTable';
import { tileLabel } from '@/lib/tiles';
import { cn } from '@/lib/utils';
import { rankDiscards, claimReasons, claimCandidateOf, type Context } from 'sg-mahjong-solver';
import { CONFIG } from '@/lib/scenario';
import type { Meld } from 'sg-mahjong-engine';
import { jargon } from '@/lib/jargon';

const WIND = ['東', '南', '西', '北'];

interface RunIx { id: string; money: boolean; unit: string; hands: number }
interface HandIx { file: string; g: number; h: number; winner: number | null; sd: boolean; fan: number | null; combo: string; turns: number; delta: number[]; bots: string[]; evals: number }
// `se` = paired standard error of (best.ev - this.ev). Exports written before 2026-08-26 lack it.
interface ActionEv { a: string; ev: number; se?: number; win: number; dealin: number; draw: number; n: number }
interface Row { d: number; k: string; t: number; p: number; sel: string; legal: string[]; h: number[]; dr: number | null; b: number[]; m4?: number[][][]; ch?: number[]; ev?: { best: string; regret: number; n: number; actions: ActionEv[] } }
interface HandData { g: number; h: number; dealer: number; wind: number; bots: string[]; money: boolean; winner: number | null; selfDraw: boolean; discarder: number | null; fan: number | null; combo: string | null; turns: number; delta: number[]; decisions: Row[]; evalCount: number }

const kindOfAction = (a: string): number[] => {
  if (a.startsWith('d:')) return [Number(a.slice(2))];
  if (a.startsWith('chow:')) return a.slice(5).split(',').map(Number);
  const m = /^(pong|kong3|kong4|kong1):(\d+)$/.exec(a);
  if (m) return [Number(m[2])];
  return [];
};
const actionText = (a: string): string => {
  if (a === 'win') return 'Win'; if (a === 'pass') return 'Pass'; if (a === 'proceed') return 'No kong';
  if (a.startsWith('d:')) return `Discard ${tileLabel(Number(a.slice(2)))}`;
  if (a.startsWith('pong')) return 'Pong'; if (a.startsWith('chow')) return 'Chow';
  return a.startsWith('kong') ? 'Kong' : a;
};

export default function Replay() {
  const [runs, setRuns] = useState<RunIx[]>([]);
  const [run, setRun] = useState<string | null>(null);
  const [unit, setUnit] = useState('chips');
  const [hands, setHands] = useState<HandIx[]>([]);
  const [combo, setCombo] = useState('all');
  const [onlyEvals, setOnlyEvals] = useState(true);
  const [hand, setHand] = useState<HandData | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => { fetch('/replays/index.json').then((r) => r.json()).then((d: { runs: RunIx[] }) => { setRuns(d.runs); if (d.runs[0]) setRun(d.runs[0].id); }).catch(() => setRuns([])); }, []);
  useEffect(() => {
    if (!run) return;
    fetch(`/replays/${run}/index.json`).then((r) => r.json()).then((d: { unit: string; hands: HandIx[] }) => { setUnit(d.unit); setHands(d.hands); setHand(null); });
  }, [run]);

  const combos = useMemo(() => ['all', ...new Set(hands.map((h) => h.combo))], [hands]);
  const list = useMemo(() => hands.filter((h) => (combo === 'all' || h.combo === combo) && (!onlyEvals || h.evals > 0)).slice(0, 60), [hands, combo, onlyEvals]);

  const open = (f: string) => fetch(`/replays/${run}/${f}`).then((r) => r.json()).then((d: HandData) => { setHand(d); setI(0); });

  if (!runs.length) return <div className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">No exported replays found. Run: <code>pnpm -C datagen exec tsx src/export.ts</code></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Dataset</span>
        {runs.map((r) => <Button key={r.id} size="sm" variant={r.id === run ? 'default' : 'outline'} onClick={() => setRun(r.id)}>{r.id} · {r.hands} hands{r.money ? ' · $' : ''}</Button>)}
        <span className="ml-4 text-muted-foreground">Hand type</span>
        <select className="border rounded-md px-2 py-1 bg-background" value={combo} onChange={(e) => setCombo(e.target.value)}>{combos.map((c) => <option key={c}>{c}</option>)}</select>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyEvals} onChange={(e) => setOnlyEvals(e.target.checked)} /> evaluated only</label>
      </div>

      {!hand && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Pick a hand</CardTitle></CardHeader>
          <CardContent className="grid gap-1.5 sm:grid-cols-2">
            {list.map((h) => (
              <button key={h.file} onClick={() => open(h.file)} className="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent">
                <span className="font-medium w-24">{h.winner === null ? 'Draw' : `${WIND[h.winner]} wins`}</span>
                <span className="text-muted-foreground w-28 truncate">{jargon(`${h.combo}${h.fan !== null ? ` · ${h.fan} *Tai*` : ''}`)}</span>
                <span className="text-muted-foreground">第{Math.max(1, Math.ceil(h.turns / 4))}巡</span>
                <span className="ml-auto text-xs text-muted-foreground">{h.evals} evaluated</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {hand && <HandView hand={hand} i={i} setI={setI} unit={unit} onBack={() => setHand(null)} />}
    </div>
  );
}

function HandView({ hand, i, setI, unit, onBack }: { hand: HandData; i: number; setI: (n: number) => void; unit: string; onBack: () => void }) {
  const cur = hand.decisions[i]!;
  // melds: last m4 at or before i
  const melds = useMemo(() => { let m: number[][][] = [[], [], [], []]; for (let j = 0; j <= i; j++) { const x = hand.decisions[j]!.m4; if (x) m = x; } return m; }, [hand, i]);
  // discard river per seat up to i; a discard is "claimed" if a later claim decision selected non-pass on it (approx: next claim rows after it, same tile kind)
  const rivers = useMemo(() => {
    const out: { k: number; claimed: boolean }[][] = [[], [], [], []];
    for (let j = 0; j <= i; j++) {
      const r = hand.decisions[j]!;
      if (r.k !== 'discard') continue;
      const k = Number(r.sel.slice(2));
      let claimed = false;
      for (let q = j + 1; q < hand.decisions.length && hand.decisions[q]!.k === 'claim'; q++) {
        const c = hand.decisions[q]!;
        if (c.sel !== 'pass' && kindOfAction(c.sel).includes(k)) claimed = true;
      }
      if (claimed && j < i) continue;               // claimed tiles leave the river once taken
      out[r.p]!.push({ k, claimed });
    }
    return out;
  }, [hand, i]);
  const evalIdxs = useMemo(() => hand.decisions.map((r, j) => (r.ev ? j : -1)).filter((x) => x >= 0), [hand]);

  /**
   * What the coach would say about this decision, in words.
   *
   * The film room could show what every move was WORTH and never why any of it was so - which
   * makes the EV bars a scoreboard rather than a lesson. The Real quiz explains itself and this
   * did not, for either kind of decision.
   *
   * A claim needs the tile on the floor, which is not on the row: it is the `sel` of the nearest
   * preceding discard.
   */
  const why = useMemo((): { head: string; lines: string[] } | null => {
    if (!hand) return null;
    try {
      const seatMelds: Meld[] = melds[cur.p]!.map((m) => ({
        type: m[0] === 0 ? 'chow' : m[0] === 1 ? 'pong' : 'kong', concealed: m[1] === 1, tiles: m.slice(2),
      }));
      const visible: number[] = [];
      for (let s = 0; s < 4; s++) {
        for (const t of rivers[s]!) visible.push(t.k);
        if (s !== cur.p) for (const m of melds[s]!) visible.push(...m.slice(2));
      }
      const ctx: Context = {
        seat: (cur.p - hand.dealer + 4) % 4, prevailingWind: hand.wind, bonus: cur.b, playerTurns: cur.t,
        minimumFan: CONFIG.minimum_fan === 2 ? 2 : 1, selfDrawMinimumFan: CONFIG.self_draw_minimum_fan,
        visible, opponentMelds: [0, 1, 2, 3].filter((s) => s !== cur.p).map((s) => melds[s]!.length),
      };
      if (cur.k === 'discard' && cur.h.length % 3 === 2) {
        const r = rankDiscards(cur.h, seatMelds, ctx);
        const chosen = cur.sel.startsWith('d:') ? Number(cur.sel.slice(2)) : null;
        const lines = [`Plan: ${r.plan}.`];
        const bestWhy = r.options.find((o) => o.tile === r.best.tile)?.reasons ?? [];
        if (bestWhy.length) lines.push(`Coach would throw ${tileLabel(r.best.tile)} — ${bestWhy.join(' · ')}`);
        if (chosen !== null && chosen !== r.best.tile) {
          const mine = r.options.find((o) => o.tile === chosen)?.reasons ?? [];
          if (mine.length) lines.push(`It threw ${tileLabel(chosen)} — ${mine.join(' · ')}`);
        }
        return { head: 'Why', lines };
      }
      if (cur.k === 'claim') {
        let offered: number | null = null;
        for (let j = i - 1; j >= 0; j--) {
          const r = hand.decisions[j]!;
          if (r.k === 'discard' && r.sel.startsWith('d:')) { offered = Number(r.sel.slice(2)); break; }
        }
        if (offered === null) return null;
        const lines: string[] = [];
        const say = (a: string, label: string) => {
          const c = claimCandidateOf(a, offered!);
          if (!c) return;
          const rs = claimReasons(c, cur.h, seatMelds, offered!, ctx);
          if (rs.length) lines.push(`${label} — ${rs.join(' · ')}`);
        };
        if (cur.ev?.best && cur.ev.best !== cur.sel) say(cur.ev.best, `Best was ${actionText(cur.ev.best).toLowerCase()}`);
        say(cur.sel, `It chose ${actionText(cur.sel).toLowerCase()}`);
        return lines.length ? { head: 'Why', lines } : null;
      }
      return null;
    } catch { return null; }
  }, [hand, cur, melds, rivers, i]);
  const fmt = (x: number) => `${x < 0 ? '-' : ''}${unit === '$' ? '$' : ''}${Math.abs(x).toFixed(1)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button size="sm" variant="outline" onClick={onBack}>← All hands</Button>
        <span><b>{jargon(hand.winner === null ? 'Draw' : `${WIND[hand.winner]} wins ${hand.combo} (${hand.fan} *Tai*)${hand.selfDraw ? ' by *Zi Mo*' : hand.discarder !== null ? ` off ${WIND[hand.discarder]}` : ''}`)}</b></span>
        <span className="text-muted-foreground">{WIND[hand.wind]}圈 · dealer {WIND[hand.dealer]}</span>
        <span className="ml-auto text-muted-foreground">{unit === '$' ? 'money' : 'chips'}: {hand.delta.map((d, s) => `${WIND[s]} ${fmt(d)}`).join('  ')}</span>
      </div>

      {/* timeline */}
      <Card><CardContent className="pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setI(Math.max(0, i - 1))}>◀</Button>
          <input type="range" min={0} max={hand.decisions.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setI(Math.min(hand.decisions.length - 1, i + 1))}>▶</Button>
          <span className="text-xs text-muted-foreground w-44">decision {i + 1}/{hand.decisions.length} · 第{Math.max(1, Math.ceil(cur.t / 4))}巡</span>
        </div>
        {evalIdxs.length > 0 && (
          <div className="flex flex-wrap gap-1 text-xs items-center"><span className="text-muted-foreground mr-1">evaluated:</span>
            {evalIdxs.map((j) => <button key={j} onClick={() => setI(j)} className={cn('rounded px-1.5 py-0.5 border', j === i ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>#{j + 1}</button>)}
          </div>
        )}
      </CardContent></Card>

      {/* the table, seen from behind whoever is deciding */}
      <PublicTable
        you={cur.p}
        centre={<div className="text-center leading-tight">
          <div className="text-lg font-semibold">{WIND[hand.wind]}圈</div>
          <div className="text-xs text-muted-foreground">第{Math.max(1, Math.ceil(cur.t / 4))}巡</div>
        </div>}
        seats={[0, 1, 2, 3].map((s) => ({
          wind: WIND[s]!,
          you: false,
          name: hand.bots[s],
          dealer: s === hand.dealer,
          acting: s === cur.p,
          // the generator only carries the acting seat's flowers and concealed hand
          bonus: s === cur.p ? cur.b : [],
          hand: s === cur.p ? cur.h : undefined,
          drawn: s === cur.p ? cur.dr : undefined,
          // a meld row is [type, concealed, ...tiles]
          melds: melds[s]!.map((m) => ({ tiles: m.slice(2), concealed: m[1] === 1 })),
          discards: rivers[s]!.map((t) => ({ kind: t.k, claimed: t.claimed })),
        }))} />

      {/* decision detail */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">
          {WIND[cur.p]} ({hand.bots[cur.p]}) — {cur.k === 'discard' ? 'which tile to discard?' : cur.k === 'claim' ? 'claim or pass?' : jargon('*Kong* or win?')}
          <span className="ml-2 font-normal text-muted-foreground">chose: {actionText(cur.sel)}</span>
        </CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!cur.ev && <div className="text-sm text-muted-foreground">Not evaluated. Legal: {cur.legal.map(actionText).join(' · ')}</div>}
          {cur.ev && <EvBars ev={cur.ev} sel={cur.sel} unit={unit} />}
          {why && why.lines.length > 0 && (
            <div className="space-y-1 border-t pt-2 text-xs">
              {why.lines.map((l, x) => <div key={x} className={x === 0 ? 'font-medium' : 'text-muted-foreground'}>{l}</div>)}
            </div>
          )}
        </CardContent>
      </Card>
      <Separator />
    </div>
  );
}

function EvBars({ ev, sel, unit }: { ev: NonNullable<Row['ev']>; sel: string; unit: string }) {
  const min = Math.min(...ev.actions.map((a) => a.ev), 0), max = Math.max(...ev.actions.map((a) => a.ev), 0);
  const span = Math.max(1e-6, max - min);
  const fmt = (x: number) => `${x < 0 ? '−' : '+'}${unit === '$' ? '$' : ''}${Math.abs(x).toFixed(2)}`;
  // ev.n is the budget; successive halving spends far less on moves that fall behind early
  const counts = ev.actions.map((a) => a.n ?? ev.n);
  const [lo, hi] = [Math.min(...counts), Math.max(...counts)];
  const playouts = lo === hi ? `${hi}` : `${lo}–${hi}`;
  return (
    <div className="space-y-1">
      {ev.regret > 0.05 && (() => {
        const se = ev.actions.find((a) => a.a === sel)?.se ?? 0;
        return se > 0 && ev.regret <= se
          ? <div className="text-sm">The bot's pick reads <b>{fmt(-ev.regret).replace('−', '')}</b> behind the best move — inside the ±{fmt(se).replace('+', '')} these {ev.n} play-outs can resolve, so the two are not actually separated. <span className="text-muted-foreground">(bars show ±1 SE)</span></div>
          : <div className="text-sm">The bot's pick cost <b>{fmt(-ev.regret).replace('−', '')}</b> per hand vs the best move. <span className="text-muted-foreground">({playouts} paired play-outs per move, bars show ±1 SE)</span></div>;
      })()}
      {ev.regret <= 0.05 && <div className="text-sm text-emerald-700 dark:text-emerald-300">The bot found the best move.</div>}
      {ev.actions.map((a) => {
        const kinds = kindOfAction(a.a);
        const isBest = a.a === ev.best, isSel = a.a === sel;
        return (
          <div key={a.a} className="flex items-center gap-2 text-xs">
            <span className="w-28 flex items-center gap-1 shrink-0">
              {kinds.length > 0 && a.a.startsWith('d:') ? <Tile kind={kinds[0]!} size="sm" /> : <span className="font-medium">{actionText(a.a)}</span>}
              {a.a.startsWith('chow') && kinds.map((k, x) => <Tile key={x} kind={k} size="sm" />)}
            </span>
            <div className="flex-1 h-4 rounded bg-secondary relative overflow-hidden">
              <div className={cn('absolute inset-y-0 rounded', isBest ? 'bg-emerald-500' : isSel ? 'bg-sky-500' : 'bg-muted-foreground/40')}
                style={{ left: `${((Math.min(0, a.ev) - min) / span) * 100}%`, width: `${(Math.abs(a.ev) / span) * 100}%` }} />
              {a.se ? (   // ±1 SE: how far this bar could slide if the play-outs were run again
                <div className="absolute inset-y-1 border-x-2 border-foreground/35"
                  style={{ left: `${(Math.max(min, a.ev - a.se) - min) / span * 100}%`, width: `${(Math.min(max, a.ev + a.se) - Math.max(min, a.ev - a.se)) / span * 100}%` }} />
              ) : null}
            </div>
            <span className="w-16 tabular-nums text-right">{fmt(a.ev)}</span>
            <span className="w-24 text-muted-foreground">win {(a.win * 100).toFixed(0)}% · in {(a.dealin * 100).toFixed(0)}%</span>
            {isBest && <Badge className="bg-emerald-600 text-white">best</Badge>}
            {isSel && !isBest && <Badge className="bg-sky-600 text-white">chosen</Badge>}
          </div>
        );
      })}
    </div>
  );
}
