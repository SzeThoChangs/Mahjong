/**
 * Table setup: configure the house money schedule and see, immediately,
 * which hand types pay best at that table (priced from 150,000 recorded hands).
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PRESETS, base, zmTotal, shootTotal, shootSplit, priceProfile, COMBO_LABEL, type MoneyConfig, type PayMode, type Profile, type ComboValue } from '@/lib/money';

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
  const [cfg, setCfg] = useState<MoneyConfig>(loadConfig);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [compare, setCompare] = useState<string>(PRESETS[1]!.name);

  useEffect(() => { save(cfg); }, [cfg]);
  useEffect(() => { fetch('/profile/money.json').then((r) => r.json()).then(setProfile).catch(() => setProfile(null)); }, []);

  const rows = useMemo(() => (profile ? priceProfile(profile, cfg) : []), [profile, cfg]);
  const other = PRESETS.find((p) => p.name === compare) ?? PRESETS[1]!;
  const otherRows = useMemo(() => (profile ? priceProfile(profile, other) : []), [profile, other]);
  const otherById = useMemo(() => new Map(otherRows.map((r) => [r.id, r])), [otherRows]);
  const maxValue = Math.max(1, ...rows.map((r) => r.per1000Value));

  const setLadder = (tai: number, v: number) => setCfg({ ...cfg, ladder: { ...cfg.ladder, [tai]: v } });
  const taiKeys = Object.keys(cfg.ladder).map(Number).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
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
                <tr><th className="text-left font-normal py-1">Tai</th><th className="text-left font-normal">Base ($ each)</th><th className="text-left font-normal">自摸 ZM — each pays</th><th className="text-left font-normal">On a discard win</th><th className="text-left font-normal">Winner collects (ZM)</th></tr>
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
            <label>Min tai to win <Num v={cfg.minTai} on={(v) => setCfg({ ...cfg, minTai: v })} /></label>
            <label>Max tai (cap) <Num v={cfg.maxTai} on={(v) => setCfg({ ...cfg, maxTai: v })} /></label>
            <label>自摸 min tai <Num v={cfg.selfDrawMinTai} on={(v) => setCfg({ ...cfg, selfDrawMinTai: v })} /></label>
            <label>Kong each <Num v={cfg.kongEach} on={(v) => setCfg({ ...cfg, kongEach: v })} /></label>
            <label>Fed kong <Num v={cfg.kongFed} on={(v) => setCfg({ ...cfg, kongFed: v })} /></label>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm items-center">
            <span className="text-muted-foreground">Bites (hidden / open):</span>
            <label>花 Flowers <Num v={cfg.flowerBiteHidden} on={(v) => setCfg({ ...cfg, flowerBiteHidden: v })} /> <Num v={cfg.flowerBiteOpen} on={(v) => setCfg({ ...cfg, flowerBiteOpen: v })} /></label>
            <label>Animals <Num v={cfg.animalBiteHidden} on={(v) => setCfg({ ...cfg, animalBiteHidden: v })} /> <Num v={cfg.animalBiteOpen} on={(v) => setCfg({ ...cfg, animalBiteOpen: v })} /></label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={cfg.jokers > 0} onChange={(e) => setCfg({ ...cfg, jokers: e.target.checked ? 4 : 0 })} />
              Wildcards (飛) in play
            </label>
            {cfg.jokers > 0 && <label>how many <Num v={cfg.jokers} on={(v) => setCfg({ ...cfg, jokers: v })} /></label>}
          </div>
          <p className="text-xs text-muted-foreground">The winner collects the same total either way — <b>base(tai) + 2 × base(tai−1)</b>, i.e. $7 / $11 / $20 / $40. {cfg.payMode === 'shooter'
            ? <>On <b>shooter pays</b> the discarder carries the whole thing and the other two pay nothing — your table.</>
            : cfg.payMode === 'everyone' ? <>On <b>everyone pays</b> the discarder pays the big share and the other two losers pay the smaller one (5 tai = $20 + $10 + $10).</>
            : <>All three pay the same share.</>} Edit the base column and everything re-prices instantly.</p>
          <p className="text-xs text-muted-foreground"><b>Amounts</b> (ladder, 自摸 bonus, kongs, bites) re-price the table below straight away. <b>Min tai and wildcards</b> change how hands actually play out, so the numbers below still reflect the recorded rules until the dataset is regenerated — run <code>pnpm -C datagen gen</code> then <code>tsx src/profile.ts</code>.</p>
        </CardContent>
      </Card>

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
                    <tr><th className="text-left font-normal py-1">Hand type</th><th className="text-right font-normal">Wins / 1,000</th><th className="text-right font-normal">Avg tai</th><th className="text-right font-normal">Pays</th><th className="text-right font-normal pr-3">Value / 1,000 hands</th><th className="text-left font-normal">vs {other.name.split(' ')[0]}</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r: ComboValue) => {
                      const o = otherById.get(r.id);
                      const ratio = o && o.per1000Value > 0 ? r.per1000Value / o.per1000Value : 1;
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="py-1">{COMBO_LABEL[r.id] ?? r.id}</td>
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
      <div><b>The money is in:</b> {top.map((t) => COMBO_LABEL[t.id] ?? t.id).join(', ')} — together {Math.round((top.reduce((a, t) => a + t.per1000Value, 0) / rows.reduce((a, t) => a + t.per1000Value, 0)) * 100)}% of all value won.</div>
      <div><b>Cheap-and-often vs big-and-rare:</b> hands averaging ≤2.5 tai carry {money(Math.round(cheap))} per 1,000 hands; bigger hands carry {money(Math.round(big))}. {cheap > big * 2 ? 'This table rewards finishing fast far more than chasing.' : big > cheap ? 'This table genuinely rewards chasing bigger hands.' : 'Fast and big are roughly balanced here.'}</div>
      {biggestGain && biggestLoss && biggestGain.ratio / biggestLoss.ratio > 1.05 && (
        <div><b>Versus {otherName}:</b> {COMBO_LABEL[biggestGain.r.id] ?? biggestGain.r.id} is worth {biggestGain.ratio.toFixed(2)}× here, while {COMBO_LABEL[biggestLoss.r.id] ?? biggestLoss.r.id} is {(1 / biggestLoss.ratio).toFixed(2)}× better there. Same tiles, different plan.</div>
      )}
      <div><b>自摸 vs winning off a discard:</b> at {cfg.maxTai} tai a self-draw collects {money(zmTotal(cfg, cfg.maxTai))} but a discard win collects {money(shootTotal(cfg, cfg.maxTai))} — {zmTotal(cfg, cfg.maxTai) > shootTotal(cfg, cfg.maxTai) * 1.15 ? <>self-draw is worth <b>{(zmTotal(cfg, cfg.maxTai) / shootTotal(cfg, cfg.maxTai)).toFixed(1)}×</b> more, so waits you can draw yourself are worth a lot more than waits you must be fed.</> : shootTotal(cfg, cfg.maxTai) > zmTotal(cfg, cfg.maxTai) * 1.15 ? <>the discard win is worth more here, so a wide wait others may feed is worth more than a self-draw-only shape.</> : <>they are close, so the wait type matters less here than at tables with a big gap.</>}</div>
      <div className="text-muted-foreground text-xs">
        Also moving on every hand: kongs and bites, about {money(profile.sidePerHand)} per hand at the recorded amounts (kong {money(cfg.kongEach)} each, flower bites {money(cfg.flowerBiteHidden)}/{money(cfg.flowerBiteOpen)}, animal bites {money(cfg.animalBiteHidden)}/{money(cfg.animalBiteOpen)}) — combination-independent, so it does not change which plan to pick, but it does reward declaring kongs.
        <br />Frequencies come from simple bots, so they are a floor: a strong player converts more of the harder hands than these numbers show. The ranking by value is what matters.
      </div>
    </div>
  );
}
