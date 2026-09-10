/**
 * Table setup: configure the house money schedule and see, immediately,
 * which hand types pay best at that table (priced from 150,000 recorded hands).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadBackup, restoreBackup } from '@/lib/backup';
import { jargon, J } from '@/lib/jargon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PRESETS, base, zmTotal, shootTotal, shootSplit, priceProfile, taiBands, sideEconomics, COMBO_LABEL, type MoneyConfig, type PayMode, type Profile, type ComboValue } from '@/lib/money';
import { asset } from '@/lib/asset';

const KEY = 'mahjong.money.config';
export function loadConfig(): MoneyConfig {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as MoneyConfig; } catch { /* ignore */ }
  return PRESETS[0]!;
}
const save = (c: MoneyConfig) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } };
const money = (x: number) => `$${x % 1 === 0 ? x.toFixed(0) : x.toFixed(2)}`;
const Num = ({ v, on }: { v: number; on: (n: number) => void }) => (
  <input type="number" min={0} value={v} onChange={(e) => on(Number(e.target.value))} className="w-16 rounded border bg-background px-2 py-0.5 ml-1" />
);

export default function TableSetup() {
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const doExport = () => { const r = downloadBackup(); setBackupNote(`Saved ${r.mistakes} mistake${r.mistakes === 1 ? '' : 's'} and your drill scores to a file.`); };
  const doRestore = (f: File) => {
    void f.text().then((text) => {
      const r = restoreBackup(text);
      // an `if` rather than a ternary: this project's tsconfig has no `strict`, and the ternary did
      // not narrow the result to its failing half, so `r.error` came out as an error
      if (r.ok) {
        setBackupNote(`Restored: ${r.now.mistakes} mistakes (${r.now.sorted} sorted) and ${r.now.spotAnswered} spot answers, replacing ${r.was.mistakes}. Reload the page to see them.`);
      } else {
        setBackupNote(`Not restored — ${r.error}.`);
      }
    });
  };

  const [cfg, setCfg] = useState<MoneyConfig>(loadConfig);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [compare, setCompare] = useState<string>(PRESETS[1]!.name);

  useEffect(() => { save(cfg); }, [cfg]);
  useEffect(() => { fetch(asset('profile/money.json')).then((r) => r.json()).then(setProfile).catch(() => setProfile(null)); }, []);

  const rows = useMemo(() => (profile ? priceProfile(profile, cfg) : []), [profile, cfg]);
  const other = PRESETS.find((p) => p.name === compare) ?? PRESETS[1]!;
  const otherRows = useMemo(() => (profile ? priceProfile(profile, other) : []), [profile, other]);
  const otherById = useMemo(() => new Map(otherRows.map((r) => [r.id, r])), [otherRows]);
  const maxValue = Math.max(1, ...rows.map((r) => r.per1000Value));

  const setLadder = (tai: number, v: number) => setCfg({ ...cfg, ladder: { ...cfg.ladder, [tai]: v } });
  const taiKeys = Object.keys(cfg.ladder).map(Number).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
      {/* everything the app remembers is in this browser and nowhere else, so this is the whole backup story */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Your training record</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Your mistakes, their schedule, the causes you sorted them under and your drill scores live in this
            browser and nowhere else — no server, no account. Clearing the browser loses them, and a mistake
            record is worth most in its third and fourth week, so save it somewhere before that happens.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={doExport}>Save my record to a file</Button>
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>Restore from a file</Button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) doRestore(f); e.target.value = ''; }} />
          </div>
          {backupNote && <p className="text-foreground">{backupNote}</p>}
          <p className="text-xs text-muted-foreground">
            Restoring replaces what is here rather than merging it, because two copies of the same card can sit
            at different points in the schedule and guessing which to keep would corrupt the one thing the
            reviews depend on.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Your table's money</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.name} size="sm" variant={p.name === cfg.name ? 'default' : 'outline'} onClick={() => setCfg({ ...p, payMode: cfg.payMode })}>{p.name}</Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">On a discard win, who pays?</span>
            {([['shooter', 'Shooter pays — the discarder alone pays it all'], ['everyone', 'Everyone pays — shooter double, other two one share each'], ['even', 'All three pay the same share']] as [PayMode, string][]).map(([m, label]) => (
              <Button key={m} size="sm" variant={cfg.payMode === m ? 'default' : 'outline'} onClick={() => setCfg({ ...cfg, payMode: m })}>{label}</Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[34rem]">
              <thead className="text-muted-foreground">
                <tr><th className="text-left font-normal py-1"><J>Tai</J></th><th className="text-left font-normal">Base ($ each)</th><th className="text-left font-normal">自摸 ZM — each pays</th><th className="text-left font-normal">On a discard win</th><th className="text-left font-normal">Winner collects (ZM)</th></tr>
              </thead>
              <tbody>
                {taiKeys.map((t) => (
                  <tr key={t} className={cn('border-t', t < cfg.minTai && 'opacity-45')}>
                    <td className="py-1">{t}{t === cfg.maxTai ? ' (max)' : ''}</td>
                    <td><input type="number" min={0} value={cfg.ladder[t]} onChange={(e) => setLadder(t, Number(e.target.value))} className="w-20 rounded border bg-background px-2 py-0.5" /></td>
                    <td className="tabular-nums">{money(base(cfg, t) + cfg.zm)}</td>
                    <td className="tabular-nums">{t < cfg.minTai ? '—' : (() => { const sp = shootSplit(cfg, t); return sp.other === 0 ? `${money(sp.discarder)} — shooter alone` : `${money(sp.discarder)} + ${money(sp.other)} × 2 = ${money(shootTotal(cfg, t))}`; })()}</td>
                    <td className="tabular-nums text-muted-foreground">{money(zmTotal(cfg, t))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm items-center">
            <label>自摸 bonus each <Num v={cfg.zm} on={(v) => setCfg({ ...cfg, zm: v })} /></label>
            <label>Min <J>Tai</J> to win <Num v={cfg.minTai} on={(v) => setCfg({ ...cfg, minTai: v })} /></label>
            <label>Max <J>Tai</J> (cap) <Num v={cfg.maxTai} on={(v) => setCfg({ ...cfg, maxTai: v })} /></label>
            <label><J>Zi Mo</J> min <J>Tai</J> <Num v={cfg.selfDrawMinTai} on={(v) => setCfg({ ...cfg, selfDrawMinTai: v })} /></label>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm items-center">
            <span className="text-muted-foreground"><J>Kongs</J> — each opponent pays:</span>
            <label>暗槓 concealed <Num v={cfg.kongConcealed} on={(v) => setCfg({ ...cfg, kongConcealed: v })} /></label>
            <label>明槓 exposed <Num v={cfg.kongExposed} on={(v) => setCfg({ ...cfg, kongExposed: v })} /></label>
            <label>Fed <J>Kong</J> — feeder alone pays <Num v={cfg.kongFed} on={(v) => setCfg({ ...cfg, kongFed: v })} /></label>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm items-center">
            <span className="text-muted-foreground">Bites (hidden / open):</span>
            <label>花 <J>Flowers</J> <Num v={cfg.flowerBiteHidden} on={(v) => setCfg({ ...cfg, flowerBiteHidden: v })} /> <Num v={cfg.flowerBiteOpen} on={(v) => setCfg({ ...cfg, flowerBiteOpen: v })} /></label>
            <label><J>Animals</J> <Num v={cfg.animalBiteHidden} on={(v) => setCfg({ ...cfg, animalBiteHidden: v })} /> <Num v={cfg.animalBiteOpen} on={(v) => setCfg({ ...cfg, animalBiteOpen: v })} /></label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={cfg.jokers > 0} onChange={(e) => setCfg({ ...cfg, jokers: e.target.checked ? 4 : 0 })} />
              <span><J>Jokers</J> (飛) in play</span>
            </label>
            {cfg.jokers > 0 && <label>how many <Num v={cfg.jokers} on={(v) => setCfg({ ...cfg, jokers: v })} /></label>}
          </div>
          <p className="text-xs text-muted-foreground">The winner collects the same total either way — <b>base(tai) + 2 × base(tai−1)</b>, i.e. $7 / $11 / $20 / $40. {cfg.payMode === 'shooter'
            ? <>On <b>shooter pays</b> the discarder carries the whole thing and the other two pay nothing — your table.</>
            : cfg.payMode === 'everyone' ? <>On <b>everyone pays</b> the discarder pays the big share and the other two losers pay the smaller one (5 <J>Tai</J> = $20 + $10 + $10).</>
            : <>All three pay the same share.</>} Edit the base column and everything re-prices instantly.</p>
          <p className="text-xs text-muted-foreground"><b>Amounts</b> (ladder, 自摸 bonus, kongs, bites) re-price the table below straight away. <b>Min <J>Tai</J> and <J>Jokers</J></b> change how hands actually play out, so the numbers below still reflect the recorded rules until the dataset is regenerated — run <code>pnpm -C datagen gen</code> then <code>tsx src/profile.ts</code>.</p>
        </CardContent>
      </Card>

      {profile && <Advice profile={profile} cfg={cfg} rows={rows} />}
      <Reads />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What pays best at this table</CardTitle>
          {profile && <p className="text-xs text-muted-foreground">From {profile.hands.toLocaleString()} recorded hands. "Per 1,000 hands" = how often the hand type is actually won × what it pays here.</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          {!profile && <div className="text-sm text-muted-foreground">No profile found. Run: <code>pnpm -C datagen exec tsx src/profile.ts</code></div>}
          {profile && (
            <>
              <div className="overflow-x-auto">
                <table className="text-sm w-full min-w-[42rem]">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left font-normal py-1">Hand type</th><th className="text-right font-normal">Wins / 1,000</th><th className="text-right font-normal">Avg <J>Tai</J></th><th className="text-right font-normal">Pays</th><th className="text-right font-normal pr-3">Value / 1,000 hands</th><th className="text-left font-normal">vs {other.name.split(' ')[0]}</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r: ComboValue) => {
                      const o = otherById.get(r.id);
                      const ratio = o && o.per1000Value > 0 ? r.per1000Value / o.per1000Value : 1;
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="py-1">{jargon(COMBO_LABEL[r.id] ?? r.id)}</td>
                          <td className="text-right tabular-nums">{r.per1000.toFixed(r.per1000 < 1 ? 2 : 0)}</td>
                          <td className="text-right tabular-nums text-muted-foreground">{r.avgTai.toFixed(1)}</td>
                          <td className="text-right tabular-nums">{money(r.avgWin)}</td>
                          <td className="text-right tabular-nums pr-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 rounded bg-primary/70" style={{ width: `${Math.max(2, (r.per1000Value / maxValue) * 90)}px` }} />
                              <span className="w-16">{money(Math.round(r.per1000Value))}</span>
                            </div>
                          </td>
                          <td className={cn('tabular-nums text-xs', ratio > 1.15 ? 'text-emerald-700 dark:text-emerald-300' : ratio < 0.87 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                            {ratio > 1.02 ? `${ratio.toFixed(2)}× better here` : ratio < 0.98 ? `${(1 / ratio).toFixed(2)}× better there` : 'same'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Compare against:</span>
                {PRESETS.filter((p) => p.name !== cfg.name).map((p) => (
                  <Button key={p.name} size="sm" variant={p.name === compare ? 'secondary' : 'ghost'} onClick={() => setCompare(p.name)}>{p.name}</Button>
                ))}
              </div>
              <Separator />
              <Takeaways rows={rows} otherById={otherById} otherName={other.name} profile={profile} cfg={cfg} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Takeaways({ rows, otherById, otherName, profile, cfg }: { rows: ComboValue[]; otherById: Map<string, ComboValue>; otherName: string; profile: Profile; cfg: MoneyConfig }) {
  const top = rows.slice(0, 3);
  const biggestGain = rows.filter((r) => r.wins > 200).map((r) => { const o = otherById.get(r.id); return { r, ratio: o && o.per1000Value > 0 ? r.per1000Value / o.per1000Value : 1 }; }).sort((a, b) => b.ratio - a.ratio)[0];
  const biggestLoss = rows.filter((r) => r.wins > 200).map((r) => { const o = otherById.get(r.id); return { r, ratio: o && o.per1000Value > 0 ? r.per1000Value / o.per1000Value : 1 }; }).sort((a, b) => a.ratio - b.ratio)[0];
  const cheap = rows.filter((r) => r.avgTai <= 2.5).reduce((a, r) => a + r.per1000Value, 0);
  const big = rows.filter((r) => r.avgTai > 2.5).reduce((a, r) => a + r.per1000Value, 0);
  return (
    <div className="space-y-1.5 text-sm">
      <div><b>The money is in:</b> {jargon(top.map((t) => COMBO_LABEL[t.id] ?? t.id).join(', '))} — together {Math.round((top.reduce((a, t) => a + t.per1000Value, 0) / rows.reduce((a, t) => a + t.per1000Value, 0)) * 100)}% of all value won.</div>
      <div><b>Cheap-and-often vs big-and-rare:</b> hands averaging ≤2.5 <J>Tai</J> carry {money(Math.round(cheap))} per 1,000 hands; bigger hands carry {money(Math.round(big))}. {cheap > big * 2 ? 'This table rewards finishing fast far more than chasing.' : big > cheap ? 'This table genuinely rewards chasing bigger hands.' : 'Fast and big are roughly balanced here.'}</div>
      {biggestGain && biggestLoss && biggestGain.ratio / biggestLoss.ratio > 1.05 && (
        <div><b>Versus {otherName}:</b> {jargon(COMBO_LABEL[biggestGain.r.id] ?? biggestGain.r.id)} is worth {biggestGain.ratio.toFixed(2)}× here, while {jargon(COMBO_LABEL[biggestLoss.r.id] ?? biggestLoss.r.id)} is {(1 / biggestLoss.ratio).toFixed(2)}× better there. Same tiles, different plan.</div>
      )}
      <div><b>自摸 vs winning off a discard:</b> at {cfg.maxTai} <J>Tai</J> a <J>Zi Mo</J> collects {money(zmTotal(cfg, cfg.maxTai))} but a discard win collects {money(shootTotal(cfg, cfg.maxTai))} — {zmTotal(cfg, cfg.maxTai) > shootTotal(cfg, cfg.maxTai) * 1.15 ? <><J>Zi Mo</J> is worth <b>{(zmTotal(cfg, cfg.maxTai) / shootTotal(cfg, cfg.maxTai)).toFixed(1)}×</b> more, so <J>Waits</J> you can draw yourself are worth a lot more than <J>Waits</J> you must be fed.</> : shootTotal(cfg, cfg.maxTai) > zmTotal(cfg, cfg.maxTai) * 1.15 ? <>the discard win is worth more here, so a wide <J>Wait</J> others may feed is worth more than a <J>Zi Mo</J>-only shape.</> : <>they are close, so the <J>Wait</J> type matters less here than at tables with a big gap.</>}</div>
      <div className="text-muted-foreground text-xs">
        Also moving on every hand: kongs and bites, about {money(profile.sidePerHand)} per hand at the recorded amounts (kongs {money(cfg.kongConcealed)}/{money(cfg.kongExposed)}/{money(cfg.kongFed)}, <J>Flower</J> bites {money(cfg.flowerBiteHidden)}/{money(cfg.flowerBiteOpen)}, <J>Animal</J> bites {money(cfg.animalBiteHidden)}/{money(cfg.animalBiteOpen)}) — combination-independent, so it does not change which plan to pick, but it does reward declaring <J>Kongs</J>.
        <br />Frequencies come from simple bots, so they are a floor: a strong player converts more of the harder hands than these numbers show. The ranking by value is what matters.
      </div>
    </div>
  );
}

function Advice({ profile, cfg, rows }: { profile: Profile; cfg: MoneyConfig; rows: ComboValue[] }) {
  const bands = taiBands(profile, cfg).filter((b) => b.tai >= cfg.minTai || b.wins > 0);
  const econ = sideEconomics(profile, cfg);
  const peak = bands.reduce((a, b) => (b.value > a.value ? b : a), bands[0] ?? { tai: 0, value: 0, per1000: 0, avgWin: 0, wins: 0 });
  const maxBand = Math.max(1, ...bands.map((b) => b.value));
  const chase = rows.filter((r) => r.per1000Value >= rows[0]!.per1000Value * 0.08);
  const avoid = rows.filter((r) => r.per1000Value < rows[0]!.per1000Value * 0.01 && r.avgTai >= 5);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">What this table rewards</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="font-medium mb-1">Sweet spot: <b>{peak.tai} <J>Tai</J></b> — where the most money actually is</div>
          <div className="space-y-0.5">
            {bands.map((b) => (
              <div key={b.tai} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-muted-foreground">{b.tai} <J>Tai</J></span>
                <div className="h-3 rounded bg-primary/70" style={{ width: `${Math.max(2, (b.value / maxBand) * 260)}px` }} />
                <span className="w-16 tabular-nums">{money(Math.round(b.value))}</span>
                <span className="text-muted-foreground">{b.per1000.toFixed(b.per1000 < 1 ? 2 : 0)} wins / 1,000 × {money(b.avgWin)}</span>
                {b.tai === peak.tai && <Badge className="bg-emerald-600 text-white">most value</Badge>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Hands at {peak.tai} <J>Tai</J> carry more total value than any other level here — not because they pay most, but because they pay decently <i>and</i> happen often.
          </p>
        </div>

        <Separator />
        <div>
          <div className="font-medium">Chase: {jargon(chase.map((r) => COMBO_LABEL[r.id] ?? r.id).join(', '))}</div>
          {avoid.length > 0 && <div className="text-muted-foreground">Avoid steering toward: {jargon(avoid.map((r) => COMBO_LABEL[r.id] ?? r.id).join(', '))} — they pay well but land under once per {Math.round(1000 / Math.max(0.001, avoid[0]!.per1000)).toLocaleString()} hands, so the tiles you spend chasing them cost more than they return.</div>}
        </div>

        {econ && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="font-medium">Draw or call?</div>
              <div><J>Flowers</J>, <J>Animals</J> and <J>Kongs</J> move <b>{money(econ.perHandTable)}</b> per hand across the table — about <b>{money(econ.perSeatPerHand)}</b> a hand each, and <b>{money(econ.perDraw)}</b> for every tile you personally draw.</div>
              <div>
                A <J>Chow</J> or <J>Pong</J> takes a discard <i>instead of</i> drawing, so each call quietly costs you about <b>{money(econ.callCost)}</b> in forgone <J>Flowers</J> and <J>Animals</J>.{' '}
                {econ.perDraw >= 0.25
                  ? <>At these bite prices that is real money — <b>lean toward drawing</b> and only call when it genuinely speeds the hand up.</>
                  : econ.perDraw >= 0.1
                    ? <>That is small but not nothing — call when it helps the hand, do not call just to be busy.</>
                    : <>That is negligible here, so call freely whenever it improves the hand.</>}
              </div>
              <div>A <J>Kong</J> runs the other way: it pays <b>{money(3 * cfg.kongExposed)}</b> ({money(cfg.kongConcealed * 3)} concealed) <i>and</i> buys you a replacement draw worth another {money(econ.perDraw)} — <b>declare <J>Kongs</J> whenever the hand allows</b>.</div>
            </div>
          </>
        )}

        {profile.blockedPerHand !== undefined && profile.blockedPerHand > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="font-medium">The minimum is costing you hands</div>
              <div>Across the table, <b>{profile.blockedPerHand.toFixed(2)} complete hands per hand</b> could not be declared because they were under the {profile.minimumTai}-<J>Tai</J> minimum{profile.avgReadyTurn !== undefined && profile.avgReadyTurn > 0 ? <>, and a seat reaches one-away at 第{Math.max(1, Math.round(profile.avgReadyTurn / 4))}巡 on average</> : null}. Build a <J>Tai</J> <i>before</i> you build a shape: a <J>Flower</J>, a <J>Dragon</J> pair, your own <J>Seat Wind</J> — otherwise you finish the hand and cannot say 胡.</div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ReadCell { p: number; n: number }
interface ReadsData { hands: number; sampled: number; ready: Record<string, ReadCell>; suitTell: Record<string, ReadCell>; danger: Record<string, ReadCell>; dangerSafe: Record<string, ReadCell> }

function Reads() {
  const [d, setD] = useState<ReadsData | null>(null);
  useEffect(() => { fetch(asset('reads/money.json')).then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);
  if (!d) return null;
  const P = (t: Record<string, ReadCell>, k: string) => t[k] ? `${Math.round(t[k]!.p * 100)}%` : '—';
  const bar = (t: Record<string, ReadCell>, k: string) => (
    <div className="flex items-center gap-2"><div className="h-2.5 rounded bg-primary/70" style={{ width: `${Math.max(2, (t[k]?.p ?? 0) * 220)}px` }} /><span className="tabular-nums w-10">{P(t, k)}</span></div>
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Reading the other seats</CardTitle>
        <p className="text-xs text-muted-foreground">Measured over {d.sampled.toLocaleString()} moments across {d.hands.toLocaleString()} recorded hands — comparing what was public with what each seat was truly holding.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="font-medium mb-1">How close is a seat to winning? Count their exposed <J>Melds</J>.</div>
          <div className="space-y-1 text-xs">
            {(['0', '1', '2', '3'] as const).map((m) => (
              <div key={m} className="flex items-center gap-2"><span className="w-40 text-muted-foreground">{m} <J>Melds</J>, mid-game (第8巡)</span>{bar(d.ready, `${m}|30`)}<span className="text-muted-foreground">{jargon('*Ting Pai*')}</span></div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Three exposed <J>Melds</J> mid-game ≈ a 4-in-10 chance they are <J>Ting Pai</J>. Treat their discards with respect from the third <J>Meld</J> on.</p>
        </div>
        <Separator />
        <div>
          <div className="font-medium mb-1">How strong is the silent-suit read?</div>
          <div className="space-y-1 text-xs">
            {(['0', '1', '2', '3'] as const).map((n) => (
              <div key={n} className="flex items-center gap-2"><span className="w-40 text-muted-foreground">threw {n} of a suit by 第10巡</span>{bar(d.suitTell, `${n}|40`)}<span className="text-muted-foreground">actually collecting it (7+ tiles)</span></div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">You already know the silent suit is the one to fear — this is how much. Even a suit they have never touched is only about a 1-in-5 read, so respect it without folding a good hand over it. Three discards of a suit drops them to 7%, which is close to safe.</p>
        </div>
        <Separator />
        <div>
          <div className="font-medium mb-1">Which discards actually deal in (per tile thrown)</div>
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2"><span className="w-36 text-muted-foreground"><J>Simple</J>, mid-game</span>{bar(d.danger, 'simple|30')}</div>
            <div className="flex items-center gap-2"><span className="w-36 text-muted-foreground"><J>Simple</J>, late (第13巡+)</span>{bar(d.danger, 'simple|50')}</div>
            <div className="flex items-center gap-2"><span className="w-36 text-muted-foreground"><J>Terminal</J>, mid-game</span>{bar(d.danger, 'terminal|30')}</div>
            <div className="flex items-center gap-2"><span className="w-36 text-muted-foreground"><J>Honour</J>, any time</span>{bar(d.danger, 'honour|30')}</div>
            <div className="flex items-center gap-2"><span className="w-36 text-muted-foreground">fresh <J>Simple</J>, 第10巡</span>{bar(d.dangerSafe, 'simple|40|fresh')}</div>
            <div className="flex items-center gap-2"><span className="w-36 text-muted-foreground">already-seen <J>Simple</J></span>{bar(d.dangerSafe, 'simple|40|seen')}</div>
          </div>
          <p className="text-xs text-muted-foreground mt-1"><J>Honours</J> are near-zero risk all game, <J>Middle Tiles</J> are the danger. It is just counting: to win on 中 someone needs a pair of it already, but 5筒 can complete 3筒4筒, 4筒6筒, 6筒7筒, a pair, or a lone <J>Wait</J> — far more ways to be caught. A tile already thrown once is roughly a third safer than a fresh one.</p>
        </div>
        <p className="text-xs text-muted-foreground">Caveat: measured on the simulator's bots, who never disguise their hands. The <J>Meld</J> and suit signals are structural and carry to humans; the exact percentages will drift against players who hide their intent.</p>
      </CardContent>
    </Card>
  );
}
