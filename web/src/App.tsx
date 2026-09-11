import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Train from '@/components/Train';
import Tips from '@/components/Tips';
import Review from '@/components/Review';
import Spot from '@/components/Spot';
import { usePhone } from '@/lib/phone';
import { useUpdateReady, applyUpdate } from '@/lib/update';
import { cn } from '@/lib/utils';

// The three behind More on a phone arrive when first opened rather than with the page. The four on
// the bar are what every session starts with, so they stay in the main file. The service worker
// caches these on-demand files at install from the list the build writes, so they are there
// offline whether or not they were ever opened; see `bundleUrls` in public/sw.js.
const AskHand = lazy(() => import('@/components/AskHand'));
const Replay = lazy(() => import('@/components/Replay'));
const TableSetup = lazy(() => import('@/components/TableSetup'));
// The game, a prototype: one hand against three coaches, then a review of every decision. Behind
// More on a phone, because PLAN.md is clear that it is not the training tool.
const Play = lazy(() => import('@/components/Play'));

/** every destination, in the order the top bar shows them */
const TABS = [
  { id: 'train', label: 'Train' },
  { id: 'spot', label: 'Spot' },
  { id: 'ask', label: 'Your hand' },
  { id: 'review', label: 'Review' },
  { id: 'tips', label: 'Tips' },
  { id: 'film', label: 'Film room' },
  { id: 'play', label: 'Play' },
  { id: 'table', label: 'Table setup' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** The four that sit under the thumb on a phone: the practice hour's own split, with Tips as its
 *  five-minute tail. The rest go behind More. Settled in MOBILE.md. */
const PRIMARY: readonly TabId[] = ['train', 'spot', 'review', 'tips'];

export default function App() {
  const [tab, setTab] = useState<TabId>('train');
  const phone = usePhone();
  return (
    // the top inset is the notch and the status bar on a phone installed to the home screen; on
    // anything else env() is zero and the class does nothing
    <div className="min-h-screen bg-background text-foreground pt-[env(safe-area-inset-top)]">
      <UpdateBar />
      {/* Seven tabs at a legible size are wider than a phone, so on one they move to a bar along the
          bottom instead (below). On anything wider they still scroll inside their own strip rather
          than dragging the whole page sideways, which is what happened when the tips tab was added. */}
      {!phone && (
        <div className="mx-auto max-w-5xl overflow-x-auto px-4 pt-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsList className="w-max">
              {/* one practice tab: pack positions marked by play-outs, with a made-up hand only as
                  a labelled fallback. The coach-marked tab that used to sit beside it is folded in. */}
              {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
      )}
      {/* the bottom bar is fixed, so the page needs its height back at the end or the last row of
          every screen sits under it */}
      <div className={cn(phone && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]')}>
        <LoadGuard key={tab}>
          <Suspense fallback={<p className="mx-auto max-w-5xl p-4 text-sm text-muted-foreground">Loading…</p>}>
            {tab === 'train' ? <Train /> : tab === 'spot' ? <Spot /> : tab === 'ask' ? <AskHand /> : tab === 'tips' ? <Tips /> : tab === 'review' ? <Review onPractise={() => setTab('train')} /> : tab === 'table' ? <TableSetup /> : tab === 'play' ? <Play /> : <Replay />}
          </Suspense>
        </LoadGuard>
      </div>
      {phone && <BottomBar tab={tab} setTab={setTab} />}
    </div>
  );
}

/**
 * A new version has been fetched and is waiting for this page to let it in. Say so, and offer the
 * swap; `lib/update.ts` has the why. Sticky, so it is seen from the middle of a long screen too,
 * and it pulls itself up over the page's top inset and pads by the same amount, so on a phone its
 * colour runs under the status bar and its text does not.
 */
function UpdateBar() {
  const ready = useUpdateReady();
  if (!ready) return null;
  return (
    <div role="status" className="sticky top-0 z-30 -mt-[env(safe-area-inset-top)] flex items-center justify-between gap-3 border-b bg-primary pl-4 pt-[env(safe-area-inset-top)] text-sm text-primary-foreground">
      <span>A new version is ready.</span>
      <button type="button" onClick={applyUpdate} className="min-h-12 px-4 font-semibold underline underline-offset-4">Reload</button>
    </div>
  );
}

/**
 * A tab that arrives on demand can fail to arrive: a flaky connection, or a build that was deployed
 * between this page loading and the tap. Without this the failure would unmount the whole app to a
 * blank page. Keyed on the tab by the caller, so picking another tab is the retry.
 */
class LoadGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-5xl p-4 text-sm">
        <p>This part of the app could not be loaded. Check the connection, then reload the page.</p>
        <button type="button" onClick={() => location.reload()} className="mt-2 min-h-12 rounded-md border px-4 font-medium">Reload</button>
      </div>
    );
  }
}

/** one cell of the bar: 56px tall, which clears the 48px a thumb needs with the label centred */
const CELL = 'flex h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium whitespace-nowrap transition-colors';

/**
 * The phone's navigation: four destinations along the bottom, where the thumb already rests, and
 * a More button that lifts a sheet with the other three. Eight tabs cannot fit across 360px at a
 * legible size, and a top bar that scrolls hides the ones off the edge from anybody who does not
 * think to drag it; a bar and a sheet carry all of them in the open.
 */
function BottomBar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  const [more, setMore] = useState(false);
  const primary = TABS.filter((t) => PRIMARY.includes(t.id));
  const rest = TABS.filter((t) => !PRIMARY.includes(t.id));
  const restActive = rest.find((t) => t.id === tab);
  const pick = (id: TabId) => { setTab(id); setMore(false); };

  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [more]);

  return (
    <>
      {more && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="More sections">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-2xl border-t bg-background p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-lg">
            {rest.map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => pick(t.id)}
                className={cn('flex min-h-12 w-full items-center rounded-md px-4 text-left text-sm', tab === t.id ? 'bg-muted font-semibold' : 'hover:bg-muted')}>
                {t.label}
              </button>
            ))}
            <button type="button" onClick={() => setMore(false)} className="flex min-h-12 w-full items-center justify-center rounded-md text-sm text-muted-foreground hover:bg-muted">Close</button>
          </div>
        </div>
      )}
      {/* the bottom inset is the home indicator; the bar's background runs under it and its buttons
          sit above it, so nothing tappable is where the swipe-up gesture lives */}
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div role="tablist" className="grid grid-cols-5">
          {primary.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)}
              className={cn(CELL, tab === t.id ? 'text-foreground' : 'text-foreground/60')}>
              <span className={cn('h-0.5 w-6 rounded-full', tab === t.id ? 'bg-foreground' : 'bg-transparent')} />
              {t.label}
            </button>
          ))}
          <button type="button" aria-haspopup="dialog" aria-expanded={more} onClick={() => setMore((v) => !v)}
            className={cn(CELL, restActive || more ? 'text-foreground' : 'text-foreground/60')}>
            <span className={cn('h-0.5 w-6 rounded-full', restActive ? 'bg-foreground' : 'bg-transparent')} />
            {restActive ? restActive.label : 'More'}
          </button>
        </div>
      </nav>
    </>
  );
}
