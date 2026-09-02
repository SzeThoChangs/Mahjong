/**
 * Shapes: the book's hand-shape tips, with the tiles in front of you and the reason spelled out.
 *
 * Every number on this page is computed from the hand beside it when the page loads - the accepting
 * tiles come out of the engine's own shanten function, not out of this file. So a card cannot
 * quietly disagree with its example, and `test/shapes.test.ts` fails if one ever does.
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
import { SHAPE_TIPS, type ShapeTip, type TipVerdict } from 'sg-mahjong-solver';
import { cn } from '@/lib/utils';

const VERDICT: Record<TipVerdict, { label: string; tone: string; blurb: string }> = {
  confirmed: { label: 'Confirmed by counting', tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200', blurb: 'Worked out exactly from the tiles. No simulation, no error bars.' },
  contradicted: { label: 'Not true here', tone: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200', blurb: 'The counting disagrees with the book at this table.' },
  level: { label: 'Level', tone: 'bg-muted text-muted-foreground', blurb: 'The two shapes come out the same.' },
  'needs-play': { label: 'Cannot be settled by counting', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', blurb: 'The claim is about what opponents throw, so only played hands can answer it. Not measured yet.' },
  measured: { label: 'Measured on real hands', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200', blurb: 'Measured over played hands at this table rather than adapted from the book.' },
};

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

function TipCard({ t }: { t: ShapeTip }) {
  const v = VERDICT[t.verdict];
  const best = Math.max(...t.variants.map((x) => x.ukeire ?? 0));
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t.title}</CardTitle>
          <div className="flex items-center gap-2">
            {/* whose tiles these are. The book gives a diagram for some tips and only words for
                others, and a verdict on OUR reading of a tip is worth less than one on the book's
                own shape. Say which, rather than borrowing its authority. */}
            <Badge variant="outline" className="text-xs font-normal">
              {t.shapeFrom === 'book' ? "the book's own shape" : 'our example'}
            </Badge>
            <Badge className={cn('font-medium', v.tone)}>{v.label}</Badge>
          </div>
        </div>
        <p className="text-sm">{t.rule}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
        <Separator />
        <div className="flex flex-col gap-2 text-sm">
          {t.why.map((w, i) => <p key={i}>{w}</p>)}
          {t.notWhen && <p className="text-muted-foreground"><b className="text-foreground">Where it stops applying.</b> {t.notWhen}</p>}
        </div>
        <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
          <b>{v.label}.</b> {t.verdictNote}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Shapes() {
  const counted = SHAPE_TIPS.filter((t) => t.verdict === 'confirmed').length;
  const wrong = SHAPE_TIPS.filter((t) => t.verdict === 'contradicted').length;
  const open = SHAPE_TIPS.filter((t) => t.verdict === 'needs-play').length;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Hand shapes</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The vocabulary of the game. A strong player does not read fourteen separate tiles — they read five or
          six shapes they already know, and decide between those. These are the shape tips from the 136-tip book,
          each with the tiles in front of you and the reason why.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every number here is worked out from the hand beside it, live. Where the counting disagrees with the
          book, the card says so: {counted} of these hold up exactly, {wrong} do not apply at this table, and{' '}
          {open} cannot be settled by counting at all because they are really claims about what your opponents
          will throw away.
        </p>
      </div>
      <div className="grid gap-4">
        {SHAPE_TIPS.map((t) => <TipCard key={t.id} t={t} />)}
      </div>
    </div>
  );
}
