# The phone pass

Decided 2026-09-07. The trainer installs and runs offline already; what it is not is built for a
small screen. This is what is wrong, in the order it hurts, and what was settled about the layout.

## Settled: the navigation moves to the bottom

Option A. Five destinations in a bottom bar, the rest behind More. The mockup that settled it is
`https://claude.ai/code/artifact/e1788fde-df9e-43db-adfc-8da2352febc5`, which carries two live 360px
frames.

The argument is not fashion. Eight tabs cannot fit across 360px at a legible size, so a top bar has
only two options and the app currently takes both: it shrinks the tabs to 29px, below the touch
minimum, AND pushes Tips, Film room and Table setup off-screen behind a horizontal scroll that
nobody discovers. A bottom bar with an overflow sheet is the honest way to carry eight destinations
on a phone, and it puts the four used every session where the thumb already rests.

Still open: whether the four primary tabs are Train, Spot, Review and Tips - now that Train and the
Real quiz are one tab (2026-09-10), which is the
practice hour's own 5/10/25/15 split, with Tips as the five-minute tail behind More - or whether
Tips earns a slot.

## Settled: the square table stays on a phone

`PublicTable.tsx` gives the square up below 640px and stacks the seats into rows. It does not have
to. At a 22px tile the square is 315px wide, which fits the 343px of usable width at 360 with room
to spare. What it costs is height: 417px of the 557 a phone shows at once, so the hand sits below
the fold and the screen scrolls.

That is worth paying. A pile in front of a seat is information - which seat threw it and when - and
a stacked list throws that away. Reading danger off the discards is half of what this app teaches.

Spacing carries meaning and is spent nowhere else. Tiles that lie together on a real table touch, so
there is no gap at all inside a pile or inside a claimed set. A gap means something: 6px between a
seat's flowers and each claimed set, 11px between everything a seat has shown and the pile they have
thrown. Those are two different rings of the table and confusing them is the whole risk of shrinking
it - a Pong face up in front of somebody means something entirely different from the same three
tiles in their discard pile.

## Measured on the built app at 360px, 2026-09-07

    all 27 of 27   tappable controls below the 44px minimum: tabs 29, filter chips 24, reset 16
    557px          width of the tab bar on a 360px screen
    3,464ms        JSON.parse of one quiz pack, on a Mac; a phone will freeze for 8 to 15 seconds
    70MB           heap after that parse
    2.2MB          the same pack over the wire, gzipped - the download is not the problem
    0              uses of env(safe-area-inset-*), so content runs under the notch and home indicator

## The work, in the order the pain is felt

1. **Shard the quiz packs.** The freeze and the heap. Design settled below.
2. **The layout pass.** The bottom bar, 48px targets everywhere, safe-area insets top and bottom.
   48 satisfies Apple's 44 and Google's 48 at once.
3. **Split the bundle.** 596KB arrives as one file before anything is drawn.
4. **An update prompt.** Otherwise a tester's phone sits on a stale version behind the service
   worker every time we redeploy. This matters precisely because friends are testing.
5. **The device matrix.** 360 (Galaxy A and most budget Android), 375 (iPhone SE and mini), 393
   (iPhone 14-16, Pixel), 430 (Pro Max, Ultra). Build at 360 and the rest follow. iOS additionally
   ignores the manifest in favour of the apple-touch-icon, has no address bar to fall back on in
   standalone, and zooms the page if any input's font drops below 16px.

## Not doing: accounts

Friends testing does not need a login. Each phone already keeps its own record in localStorage,
separate by construction. A login buys their data on our machine, cross-device, and knowing who said
what, and none of those are wanted yet - the export on the Review tab is the bridge. If after a
fortnight their records turn out to be worth collecting, a single "send this to Changs" button that
posts the same JSON is an afternoon. A real login is an auth provider, a server, a database and
somebody's privacy to look after, and it puts a wall in front of the thing we want them to try.

## One constraint that is arithmetic rather than taste

Every tile in your own hand is a button, so each needs 44px. Seven at 44px plus their gaps is 332px,
which is exactly the usable width at 360. Fourteen tiles therefore wrap to two rows and the hand
claims about 130px of height before anything else. No layout choice avoids this.


## The sharding design, settled 2026-09-07

The awkward part was never the splitting, it was the cause filter, and looking at how it works
dissolved the problem rather than complicating it.

**The cause is computed in the browser today, and it should not be.** `RealQuiz` runs `rankDiscards`
and `suggestCause` over each question's own tiles to work out why the seat's throw failed, at about
5ms a question, and it needs a background warmer running in 25-question slices so that filtering
never walks cold. Sharding would break that warmer, because a shard can only warm itself.

The fix is to compute the cause once, when the pack is built, and store it on the question as one
short string. That deletes the warmer, the cache, the 5ms and the two-second cold walk in one go,
and it lets an index answer "which shard holds a miscounted question" without fetching anything.

**It is also more correct.** The label today is computed against YOUR table config, not the table the
position was played at, which is the same mismatch the pack banner already warns about for the
coach's reasoning. Baked at build time it uses the pack's own table, which is the table the hand was
actually played on.

The shape:

    quiz/<pack>/index.json     { run, money, unit, table, questions, shards: [
                                 { file, n, kinds: {discard, claim}, causes: {miscounted: 12, ...} } ] }
    quiz/<pack>/000.json ...   { questions: [ ... ] }, a hundred each, every question carrying `c`

The client loads the index, which is a few KB, picks a shard that can satisfy the current mode and
cause filter from the tallies alone, and fetches only that. First question after about 200KB and a
70ms parse instead of 10MB and 3.5 seconds. Offline, only the shards actually answered are kept,
so the phone holds what was practised rather than five whole tables.

Two things to be careful of when this is built. The pack builder must write the index and the shards
in one pass so a tally can never disagree with a shard - a filter that promises a cause the shard
does not contain is a bug that only shows up as an empty drill. And `index.json` at `quiz/index.json`
already lists the packs; the per-pack index is a second file inside the pack's own directory, so the
two must not be confused.
