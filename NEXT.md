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

## What is left of the book

Of the 102 rules in `knowledge/playbook.json`, 18 now have cards and every one of them is in the
`build` phase, which is 18 of that phase's 28. Ten build rules are left: `keep_floaters`,
`isolate_triplet`, `full_hand_over_partial`, `flush_decided_early`, `project_bad_draws`,
`break_mediocre_ready`, `weak_start_pivot`, `evaluators`, `mf2_half_color_easier` and
`threshold_rises`.

Nothing outside `build` has a card at all: 16 rules about discarding, 15 about calling, 13 about
reading, 12 about pushing and folding, 12 meta and 6 about the deal. Two reading rules were measured
and played for money without ever becoming cards - `wall_reading` and `value_from_melds` - and both
paid nothing.

The 16 discard rules are the ones to be careful with. They are almost all about danger, and the
coach already prices danger continuously; four attempts to price a true read have now returned
nothing. Measuring them is worth doing, teaching them is worth doing, and putting them in
`rankDiscards` is the thing that keeps failing.

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
