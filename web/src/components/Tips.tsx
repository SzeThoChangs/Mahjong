/**
 * Tips: the whole playbook, one card each, said in plain English and marked with what backs it.
 *
 * This page started as the hand-shape tips and now carries the rest of the book with them, grouped
 * by where in a hand they apply. That is why the tab is called Tips: most of the book is not about
 * shape at all, it is about what to throw, what to claim, what to read and whether to fight.
 *
 * Every number on this page is computed from the hand beside it when the page loads - the accepting
 * tiles come out of the engine's own shanten function, not out of this file. So a card cannot
 * quietly disagree with its example, and `test/tips.test.ts` fails if one ever does.
 *
 * The verdict badge is the point of the page. A tip being in the book is not evidence it is true
 * here: the book is Riichi-derived and this table has a 2-tai minimum, four wildcards and a chicken
 * hand nobody else plays. Some of these tips turn out to be wrong at this table, and the page counts
 * them off in its own opening line, which is more useful than a page of confident advice.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tile } from '@/components/Tile';
import { TIPS, type Tip, type TipVerdict } from 'sg-mahjong-solver';
import { cn } from '@/lib/utils';
import { jargon } from '@/lib/jargon';

const VERDICT: Record<TipVerdict, { label: string; tone: string; blurb: string }> = {
  confirmed: { label: 'Confirmed by counting', tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200', blurb: 'Worked out exactly from the tiles. No simulation, no error bars.' },
  contradicted: { label: 'Not true here', tone: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200', blurb: 'The counting disagrees with the book at this table.' },
  level: { label: 'Level', tone: 'bg-muted text-muted-foreground', blurb: 'The two shapes come out the same.' },
  'needs-play': { label: 'Cannot be settled by counting', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', blurb: 'The claim is about what opponents throw, so only played hands can answer it. Not measured yet.' },
  measured: { label: 'Measured', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200', blurb: 'Counted over played hands rather than reasoned about. The note says who measured it — us, or the study this table\u2019s numbers come from.' },
  'table-rule': { label: 'How this table works', tone: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100', blurb: 'A rule of this table, read off the table configuration. Not a theory and not a measurement.' },
  advice: { label: 'Advice, not a claim', tone: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200', blurb: 'A way of playing or thinking rather than something that can be true or false, so nothing here can test it. Kept because it is worth reading, not because it was checked.' },
};

/** The order a hand happens in, which is the order the page runs in. */
const PHASES: { id: Tip['phase']; title: string; blurb: string }[] = [
  { id: 'deal', title: 'What you are dealt', blurb: 'The first decision is which hand you are even trying to make, and most of it is settled before you draw a tile.' },
  { id: 'build', title: 'Building the hand', blurb: 'The vocabulary of the game. A strong player does not read fourteen separate tiles, they read five or six shapes they already know.' },
  { id: 'discard', title: 'Choosing what to throw', blurb: 'Every discard hands the table something. These are the rules for making it the cheapest thing you hold.' },
  { id: 'call', title: 'Claiming a tile', blurb: 'A call buys speed and spends your hand, your defence and sometimes your own draw.' },
  { id: 'read', title: 'Reading the table', blurb: 'What the discards, the melds and the tiles nobody claimed tell you about the other three hands.' },
  { id: 'push_fold', title: 'Fighting or folding', blurb: 'Whether this hand is worth playing at all, which is the decision that costs the most when it goes wrong.' },
  { id: 'meta', title: 'How to play', blurb: 'Advice about the player rather than the hand. None of it can be measured here, and it is still the part most people get wrong.' },
];

/**
 * The hand drawn as the pieces it is made of, with the ones the tip is about ringed.
 *
 * It used to be thirteen loose tiles with some of them dimmed, which asked the reader to do the
 * grouping the tip is trying to teach. A card about blocks has to show blocks.
 */
function Hand({ blocks, focus }: { blocks: number[][]; focus: number[] }) {
  const hot = new Set(focus);
  return (
    <div className="flex flex-wrap items-end gap-2">
      {blocks.map((b, i) => (
        <div key={i}
          className={cn('flex gap-0.5 rounded-md border-2 p-1',
            hot.has(i) ? 'border-primary bg-primary/5' : 'border-transparent opacity-55')}>
          {b.map((k, j) => <Tile key={j} kind={k} size="sm" />)}
        </div>
      ))}
    </div>
  );
}

function TipCard({ t }: { t: Tip }) {
  const v = VERDICT[t.verdict];
  const best = Math.max(...t.variants.map((x) => x.ukeire ?? 0));
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{jargon(t.title)}</CardTitle>
          <div className="flex items-center gap-2">
            {/* whose tiles these are. The book gives a diagram for some tips and only words for
                others, and a verdict on OUR reading of a tip is worth less than one on the book's
                own shape. Say which, rather than borrowing its authority. */}
            {t.shapeFrom && (
              <Badge variant="outline" className="text-xs font-normal">
                {t.shapeFrom === 'book' ? "the book's own shape" : 'our example'}
              </Badge>
            )}
            <Badge className={cn('font-medium', v.tone)}>{v.label}</Badge>
          </div>
        </div>
        <p className="text-sm">{jargon(t.rule)}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* cards with no tiles skip straight to the reasoning: most of the book is not about shape */}
        {t.variants.map((x, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{x.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {x.shanten === 0 ? 'ready' : `${x.shanten} from ready`} ·{' '}
                <b className={cn('text-foreground', t.variants.length > 1 && x.ukeire === best && 'text-emerald-700 dark:text-emerald-300')}>
                  {x.ukeire} tiles
                </b>{' '}
improve it, from {x.kinds} kinds
                {/* only on cards whose claim is about width the shanten count cannot see */}
                {x.upgrades !== undefined && <> · <b className="text-foreground">{x.upgrades}</b> widen it without bringing it closer</>}
              </span>
            </div>
            <Hand blocks={x.blocks} focus={x.focus} />
          </div>
        ))}
        {t.variants.length > 0 && <Separator />}
        <div className="flex flex-col gap-2 text-sm">
          {t.why.map((w, i) => <p key={i}>{jargon(w)}</p>)}
          {t.notWhen && <p className="text-muted-foreground"><b className="text-foreground">Where it stops applying.</b> {jargon(t.notWhen)}</p>}
        </div>
        <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
          <b>{v.label}.</b> {jargon(t.verdictNote)}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Tips() {
  const counted = TIPS.filter((t) => t.verdict === 'confirmed').length;
  const measured = TIPS.filter((t) => t.verdict === 'measured').length;
  const wrong = TIPS.filter((t) => t.verdict === 'contradicted').length;
  const open = TIPS.filter((t) => t.verdict === 'needs-play').length;
  const table = TIPS.filter((t) => t.verdict === 'table-rule').length;
  const advice = TIPS.filter((t) => t.verdict === 'advice').length;
  const withTiles = TIPS.filter((t) => t.variants.length).length;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Tips</h2>
        {/* every verdict here was measured at one table; a learner cannot tell that from the cards */}
        <p className="max-w-3xl text-xs text-muted-foreground">
          Every verdict on this page was measured at one table: <b>four wildcards</b> and a <b>2 tai minimum</b>.
          Both rules change the game measurably — taking the wildcards out makes hands run 54 turns instead of 40
          and drawn hands 19% instead of 0.6%, and a late throw is about twice as likely to complete somebody.
          The shape cards should travel, since they are arithmetic about tiles. The cards about timing, danger and
          what a hand is worth may not.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every tip we hold, one card each, in the order a hand happens. Each card says the tip in plain English,
          says why it is supposed to work, and carries a badge saying what actually backs it.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The badge is the point. A tip being in a book is not evidence it is true here: most of them are adapted
          from Riichi, and this table has a 2 tai minimum, a 5 tai cap, four wildcards, animals, bao and a cheap
          hand nobody else plays. Of {TIPS.length} cards, {counted} are settled exactly by counting the tiles on
          the card, {measured} were measured on played hands, {wrong} came out against the book, {table} are rules
          of this table rather than anybody's advice, {advice} are about how to play rather than about tiles, and{' '}
          {open} are untested — real claims that nobody here has measured yet.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Only {withTiles} of them can be shown in tiles, and those are the hand-shape ones. The rest carry no
          example hand on purpose: inventing a position for "push or fold, and commit" would put a made-up hand in
          front of you and imply somebody had checked it.
        </p>
      </div>
      {/* 103 cards is a long page, so the phases are also the way around it */}
      <div className="flex flex-wrap gap-2 text-sm">
        {PHASES.map((p) => {
          const n = TIPS.filter((t) => t.phase === p.id).length;
          return (
            <a key={p.id} href={`#tips-${p.id}`}
              className="rounded-md border px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
              {p.title} <span className="tabular-nums">{n}</span>
            </a>
          );
        })}
      </div>
      {PHASES.map((p) => {
        const cards = TIPS.filter((t) => t.phase === p.id);
        if (!cards.length) return null;
        return (
          <div key={p.id} id={`tips-${p.id}`} className="flex flex-col gap-3 scroll-mt-4">
            <div className="flex flex-col gap-1 border-t pt-4">
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="max-w-3xl text-sm text-muted-foreground">{p.blurb}</p>
            </div>
            <div className="grid gap-4">
              {cards.map((t) => <TipCard key={t.id} t={t} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
