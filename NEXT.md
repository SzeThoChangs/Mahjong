# Where we left off — 2026-09-06

Read this first. `PLAN.md` is the project. `FINDINGS.md` is everything we measured and why.

## The playbook is finished: every one of 103 cards has a verdict

Two days ago 29 rules were badged untested. None are now. Of 103 cards, 59 are measured, 18
contradicted, 4 confirmed by counting, 6 are rules of the table and 16 are advice that states no
testable claim. The tools that did it, in the order they were built: `datagen/src/calltest.ts` for
the claiming tips, `datagen/src/discardtest.ts` for the throwing tips, `datagen/src/tells.ts` for
the reads, `datagen/src/buildrare.ts` for the three shapes real play never produces, and
`datagen/src/packlib.ts` for the scoring they all share, including the matched baseline.

**The matched baseline is the thing to keep.** Every verdict is scored twice: against the coin its
own split implies, and against a baseline that knows what each action is - for a throw, whether it
costs distance, whether a block wants it, honour or terminal or simple; for a claim, whether it
makes the hand ready, costs nothing, costs a step, or is a pass. The second column is the one to
quote. It overturned four published verdicts on 2026-09-05 and nearly promoted one wrongly on
2026-09-06 until the control row was read. Print the control rows.

**Two mechanisms are worth more than any single card.** A suited tile deals in mostly by completing
a run, so every card whose safety argument is "nobody can hold a pair of it" fails, and there were
three. And what a seat threw early is what it never had - `wall_reading` confirmed it,
`locate_the_fourth` is the same fact read backwards.

## The value side: what won against coaches loses against everyone else

The committed-slope table baked on 2026-09-06 at +0.101 +/- 0.031 over 128,000 paired deals, t =
3.3, against three coaches. `datagen/src/fieldtest.ts` then put the datagen personalities in the
other three chairs - the population the recorded runs are played by - on eight ranges named before
the first ran:

```
  committed minus the previous table, against the field
  64,000 paired deals   -0.210 +/- 0.043   t = -4.9, negative on 8 of 8
```

It loses by twice what it won, on the same trade: wins more often and smaller, deal-in rate
untouched. A coach table punishes a slow hand, so speed is worth the size given up; a field that
never collects a suit does not, so the bigger hand cashes.

The same test one change back says the row scaling that shipped before it HOLDS against the field:
+0.125 +/- 0.056 over 32,000 paired deals, t = 2.2, about the size it had against coaches. So the
programme was not fitted to one opponent from the start. One step was.

**The bake is reverted.** The row-scaled table wins against both fields; the committed one won
against coaches by 0.10 and lost to the field by 0.21; no human has been measured against either.
So the shipped coach is the row-scaled table again, checked with `_fitrate` at zero plan changes
against that file, and the committed table stays tracked beside it as the candidate it was.

The ping-wu row is answered: its committed slope falls with turn on a second seed too, and pooling
the two runs moves 0.66% of throws, under the 2% bar. Pooled cells and the rebuilt table are at
`knowledge/sources/fitted/` for the next rebuild.

## Housekeeping

The fitted tables, their cells, the plain study table and the committed candidate are all tracked
under `knowledge/sources/fitted/`, and the shipped coach rebuilds from a clean clone byte for byte.
There is no git remote: `main` is fast-forwarded to this branch at the end of each session, nothing
is pushed, and the local typecheck, tests and build are the only checks. The web build passes.

## Where to start next, in order

**1. A third field, if the two-field picture is to be trusted for a person.** The one closest to a
player is probably the coach with its randomness turned up, and `fieldtest.ts` takes any bot the
generator can make. Any future value change should be played against both fields before it bakes;
that is now the bar.

**2. Fit for both fields at once.** The value tables are keyed by plan, breakdown and turn. Nothing
stops a fit from being weighted across two opponent populations, and a table that is level on both
fields is a better thing to ship than one that wins on one and loses on the other. The committed
runs and `valuefit.ts --committed` are the machinery; what is missing is a second set of committed
runs against the personality field.

**3. Done on 2026-09-06: the mistake record has a cause.** `solver/src/cause.ts` reads what it can
off the position - the shape tip the throw broke, a throw that cost a step, the wrong plan, the
more dangerous tile - and the Train tab asks one question at the moment of the mistake with that
suggestion marked. `mistakes.ts` stores both the suggestion and the answer, Review shows the tally
under every state of the tab and names the cause that keeps coming up, and a reviewed hand can be
re-sorted. Older records count as unsorted until they come back. What is not done: nothing yet
points the Train tab AT the leading cause - a "practise this" that draws hands where that cause
bites is the next step on that screen.
