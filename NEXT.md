# Where we left off — 2026-09-06, end of day

Read this first. `Framework - Mahjong.md` is the plan this project exists to produce. `PLAN.md` is
the app's roadmap. `FINDINGS.md` is everything we measured and why.

## The three things that are finished

**The playbook.** All 103 cards have a verdict: 59 measured, 18 contradicted, 4 confirmed by
counting, 6 rules of the table, 16 advice that states nothing testable. Nothing is left untested.
Every verdict is scored twice, against the coin its own split implies and against a baseline that
knows what each action is, and the second column is the one to quote.

**The framework.** `Framework - Mahjong.md`: the parts of the skill, the pattern library with its
verdicts, how dishonest the feedback is and what to grade against instead, the eight mistake causes,
seven stages, and an hour on Tuesday, Thursday and Saturday. It names the eighteen contradicted
cards so the plan cannot teach them. Its figures were checked against `tips.ts` when it was written;
re-check them if verdicts change.

**The value tables.** The shipped row-scaled table is at its family's ceiling on both fields. A
table fitted on the field alone plays the field level and no better, two tables 43% apart in their
numbers produce the same game against that opponent, and both knobs - the gain and the population
weight - are dead. Anything further has to change the SHAPE: per-breakdown corrections rather than
per-row, or a term these tables do not have.

## What the app does now

All five components, each with a cause attached. The Train tab draws hands where the cause that
keeps coming up in your record actually bites. The Spot drill asks why a miss happened and moves its
own look time from the answer. The mistake record is fed by both practice tabs and marks which judge
each card came from, because the coach picks the play-outs' best 52.8% of the time on decisive
positions and 36.1% early, while the Real quiz is judged by 128 play-outs an option.

## The one thing nobody has written down about the coach

Its two halves are calibrated to different opponents. The value tables were fitted on `run-coach2`,
coach against coach. The danger reads in `solver/src/reads.ts` were measured on `run-money4`, which
is the personality field - the header of that file says so. We now know the value weights ARE
field-specific, costing 0.21 chips a game when carried across, and that the danger WEIGHT is not,
coming out at 40 on both fields. What the reads themselves do is the missing piece.

Half of that 2x2 is already filled and both cells are nulls: coach-measured reads played against
coaches came in at -0.054 and -0.013. The missing cell is coach-measured reads against the field,
and `reads2/coach.json` and `reads2/money4.json` both exist, so it is a `--reads` flag on
`fieldtest.ts` - the same shape as the `--dwa` flag added today - plus four ranges.

## Where to start next, in order

**1. Done on 2026-09-06, and the coach's danger side is closed.** Coach-measured reads played
against the field: -0.035 +/- 0.039 over 32,000 paired deals, the tightest of the three cells, and
all three are nulls. Which population the deal-in table was measured on does not change how the
coach plays against either opponent. Combined with the weight being 40 on both fields, nothing about
how the app judges danger is an artefact of its fitting population, and the framework's caveat has
been narrowed to say so. The value side remains the field-specific half.

**2. Done on 2026-09-06.** The Real quiz can be aimed at a cause. A pack question records what the
seat actually threw beside what the play-outs measured, so where they differ the position holds a
real mistake and `suggestCause` reads why it failed - that is the label, and it needs nothing new in
the pack. Measured before it shipped: labelling costs about 2ms a question, the rarest label fires
one in 86, and a 400-question walk finds one about 99% of the time with a message when it does not.
The first version walked cold and took 1.9 seconds a question in the browser, which no drill can
wear; the cache is now warmed in 25-question slices after the pack loads and a filter switch costs
3 to 52ms.

**3. Stop measuring, and start training.** This was agreed on 2026-09-06 and it is the real answer
rather than a fallback. Every line the measurement could close by itself is closed: all 103 cards
have verdicts, the value tables are at their family's ceiling on both fields, the danger side is
field-independent end to end, and the framework is written. What is left cannot be produced by more
compute - it is somebody following the plan for a few weeks and a mistake record with real mistakes
in it. The next person here should be led by what that record says. If it says nothing yet, the
honest answer is that there is nothing to do but the hour on Tuesday, Thursday and Saturday.

## House-keeping note for whoever writes here next

This file had grown two "Where to start next" sections by prepending, and every item in both was
already done. It is the continuity file; if a section is finished, delete it rather than leaving a
"Done on" note above another list.
