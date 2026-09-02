# Where we left off — 2026-09-03 (04:30)

Read this first. `PLAN.md` is the project. `FINDINGS.md` is everything we measured and why.

## The regeneration is done and it is in the app

`run-coach2` is generated and graded. 150,000 hands played by four coaches, 7,233,486 decisions
recorded in 45 minutes, and 479,889 of them graded in 8h 8m at 16.4 a second, with 0 errors, 0
failed workers and 0 hands that failed to replay.

The quiz pack and the film room are rebuilt from it. Both sort before the old `run-money4` ones and
both are still there, so the app opens on coach-played positions and the old population is one click
away for comparison. That was the whole point of the exercise: a player now practises positions from
a game with 31.7% colour hands rather than 1.3%.

Two things to know about the new pack. It has 4,999 questions and 719 of them can name a shape tip,
against 326 in the old one. And it is still light on early decisions - 30% against the run's own 41%
- because only 1.5% of early discards separate by two standard errors, so the stratum runs out of
decisive positions. Better than the old pack's 17% against 37%. Not fixed.

The old pack and film room are about 14MB of tracked files. If they are not being used for
comparison they are worth deleting; `run-money4` is still on disk, so they can be rebuilt in half an
hour.

## The tips can now be scored against the play-outs, not just counted

This is the new machinery and it is the thing worth building on. `solver/src/shapetag.ts` reads a
hand and says which of the book's shape tips the decision is about, with the throws that follow each
tip and the throws it warns against. `datagen/src/tiptest.ts` scores those against the measured best
throw, correcting for the tip's own share of the choice - without that correction a tip that points
at four tiles in six looks two-thirds right while knowing nothing.

```
                       coach pack                    money pack
  escape_single_waits   303 resolved  89% vs 47%      129 resolved  89% vs 47%
  pair_rule             222 resolved  30% vs 66%       87 resolved  31% vs 66%
```

`escape_single_waits` is the strongest thing this book has produced here and it replicates exactly
on two populations. `pair_rule` fails in both, in every split. `triplet_adjacency` splits by
population, because the tile it points at is usually in your longest suit - see FINDINGS.

Six tips are tagged. The rest need something the tagger does not have: `five_blocks` and
`six_blocks_ok` need an agreed block decomposition, `narrow_can_beat_wide` needs the hand scored for
tai. Both are buildable and both would raise the share of the pack that can teach a shape.

## The book is all on the page now, and 32 of it is untested

Every rule in `knowledge/playbook.json` has a card in the Tips tab - 102 of them, plus one of our
own about honour waits. They are grouped by where in a hand they apply, and each carries a badge
saying what backs it: 9 settled by counting, 40 measured, 3 measured against the book, 5 that are
rules of this table, 14 that are advice about the player, and 32 untested.

**The 32 are the work that is left.** They are real claims nobody here has checked, and several are
cheap with tools that already exist:

- what an opponent declined to claim (`two_discard_piles`) - the recorded hands hold it and nothing
  reads it
- whether shedding a pair makes its neighbours safe (`pair_discards_rule_out`) - the same shape of
  claim as the walled-tile read, which the reads pipeline answered in an afternoon
- which copy of a value tile gets claimed (`second_copy_call`) - fires often here and needs only the
  meld log
- whether a wind thrown to the player before you buys the turn it is supposed to
  (`wind_discard_order`) - turns are worth real money at this table

**Be careful with the danger ones.** Most of the discard rules are about safety, the coach already
prices safety continuously, and four true reads have now returned nothing when priced. Measure them,
teach them, and do not put them in `rankDiscards`.

**The largest known blind spot is `value_from_melds`.** The coach counts how many sets an opponent
has exposed and never looks at what they are, so a dragon pong and a run of 3-4-5 are the same input
to it. Eleven of the book's tips turn on that difference.

## Habits that keep proving themselves

**Play it out before believing it.** Being right per-decision has failed to predict winning three
times. The only measure that counts is chips per game from `solver/src/tools/headtohead.ts`.

**Change the shuffle.** One fixed shuffle made a fake pattern look real for half a day. Pass a
different seed and see if the result survives.

**Say who is at the table.** Three findings now turn on it: the suit read, the honour wait, and
`triplet_adjacency`. A claim about what to do with a tile cannot be measured without naming the
population, and measuring only on coach hands hands us our own assumptions back.

**Re-run any positive result on a fresh named range before believing its size.** `legalWait` went
from +0.048 to +0.018 the moment it met deals nobody had chosen.

**Do not tune the danger model.** Four measured failures: the wall read, the suit read, the meld
read, and the danger sweep.

## Already done, so do not redo it

The suit read is taught in the app. `rankDiscards` appends it as a reason - "seat 3 looks to be
collecting 筒 - feeding it is the risky part" - and does not price it, which is what the measurement
said to do.

`legalWait` is the only change ever shipped to the coach. It stays on, and the honest number is
+0.018 +/- 0.012 on deals nobody chose, not the +0.048 that was quoted for a week.
