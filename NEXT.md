# Where we left off — 2026-09-06, small hours

Read this first. `PLAN.md` is the project. `FINDINGS.md` is everything we measured and why.

## The playbook went from 29 untested rules to 7 in one day, and four published verdicts were wrong

The old NEXT said the 29 untested rules were "not cheap". Two thirds of them were. A quiz pack
grades every decision it holds, claims and self-actions included, so a rule of the form "in
positions like this, do that" is a filter over graded positions and no new compute. Three tools do
it: `datagen/src/calltest.ts` for the claiming tips, `datagen/src/discardtest.ts` for the throwing
tips, and `datagen/src/tells.ts` for the reads, which replays 20,000 recorded and 10,000 coach
hands with a recorder attached and compares what is public about each seat with what it holds.
`datagen/src/packlib.ts` is the scoring they share.

**The baseline every verdict stood on was too easy, and `datagen/src/audit.ts` re-scored them.**
`tiptest.ts` compared a tip against the coin its own split implies, which equalises how MANY tiles
sit on each side and not what those tiles are - and a spare tile is the measured best 69% of the
time against 24% by luck. `fitNull` in `packlib.ts` weights each action by what it is (costs
distance or not, wanted by a block or not, honour, terminal or simple), and every rule now reports
two z columns, flat and matched. `pair_rule` went from a published failure at -21.4 to a null at
+0.8. `perfect_one_away` went from +8.0 to -0.1: its advice is right, but every throw it warns
against costs a step and a throw that costs a step is best 2% of the time, so you get it right by
throwing your spare. `escape_single_waits` survives at +25.8 and is the best-evidenced tip by a
distance. The matched baseline is a strong null on purpose - it will not credit a rule for saying
"do not wreck your hand" - and the two columns are there so that distinction stays visible.

**One mechanism came up three times and is worth knowing on its own.** `withhold_safe_tiles`,
`terminal_triplet_release` and `last_chance_timing` all argue a tile is safe because nobody can hold
a pair of it. Measured from the play-outs directly, that removes almost none of the danger: a suited
tile deals in mostly by completing a run, and a run wait does not care how many copies you hold.

**Two tips real play never produces were built to order.** `datagen/src/buildrare.ts` replays a
recorded hand to a decision, swaps tiles between one seat and the hidden wall until the shape is
there, and grades with the packs' own grader. `pon_over_chii` has no default at this table;
`linked_blocks` leans the card's way on one population and not the other. Two method faults are
written up in FINDINGS and both are the kind to remember: overwriting a wall slot rather than
swapping, and 300 positions built from 9 hands.

## The value side: the standing explanation was wrong, and the replacement wins a little money

FINDINGS said the re-fit of `tables.ts` lost because `valuefit.ts` measures the value of a position
under a coach that abandons plans, and that fitting the value of COMMITTING needed hands where
somebody committed. Those hands exist now. `Context.onlyTarget` locks the coach to one plan,
`PlanBot` wraps it, five `plan_*` bot types put it in the generator, and `valuefit.ts` has a third
conditioning, `committed`, keyed on the plan a seat was ASSIGNED before the deal.

**The late half-colour row is identical under both estimators**, 0.178 committed against 0.179
pursued. The compression the whole explanation rested on is a fact about the hand. What IS an
artefact is the turn trend, it lives at the early end, and its mechanism is selection rather than
abandonment. `valuerows.ts --study` regresses against the pristine snapshot, which is necessary now
that a row scaling has shipped: against the shipped tables `pursued` returns 0.235 everywhere by
construction.

**The committed-slope table beats the shipped coach.** Gain 1.30, picked on decisiveness before any
money was played. Sixteen ranges named before the first ran, none played before:

```
  first eight    shuffle-1200001..1270001   64,000 paired deals   +0.102 +/- 0.043   7 of 8
  batch A        shuffle-1290001..1320001   32,000 paired deals   +0.077 +/- 0.062   2 of 4
  batch B        shuffle-1330001..1360001   32,000 paired deals   +0.121 +/- 0.061   4 of 4
  all sixteen                              128,000 paired deals   +0.101 +/- 0.031   t = +3.3, 13 of 16
```

The rule fixed before batch A ran: bake if the second eight are positive on their own and all
sixteen pool to t >= 3. The second eight came in at +0.099 against the first eight's +0.102, both
halves passed, and it is BAKED: `baketables.ts` reads `tables-committed-g1.30.json` by default and
`_fitrate` against that file reports zero plan changes. Third change ever shipped to the coach.

It wins more often and smaller, reaches ready 49.6% against 46.9% and most of a turn sooner, and
the deal-in rate moves by a third of a point, inside the noise of 6,000 games. That is the same
direction the fitted tables took when they lost a chip a game; the difference is that this one
converts the lost half-colour hands into a higher win rate. Nothing has been measured against
anything but the coach.

## Housekeeping done, and one item retired rather than done

The fitted tables live at `knowledge/sources/fitted/` now, beside the pristine study snapshot, and
`baketables.ts` reads them from there: the shipped coach could not previously be rebuilt from a
clean clone, because its source file was gitignored. Baking from the tracked file reproduces
`src/tables.ts` byte for byte.

The old NEXT's item 4 - drop the 14MB `run-money4` quiz pack and film room - is retired, not done.
Both come from `run-money4`, the pack was rebuilt on 2026-09-05, and it is the second population in
every measurement above. There is nothing stale to delete.

The web build passes, every package typechecks, and 178 tests pass - the same three things CI runs.

## Where to start next, in order

**1. The seven rules still untested, and what each needs.** Two are filters over the packs that
nobody has written: `full_hand_over_partial` needs a tai routine to say which throws keep a
whole-hand pattern, and `project_bad_draws` is `upgrades()` from `tips.ts` used as a throw
criterion. `locate_the_fourth` is a read for `tells.ts`. `rebuild_waits` is a claim on a dead wait,
which the packs will hold almost none of, so it wants a `buildrare.ts` builder. `last_tile_shift` is
arithmetic about who draws last and is probably a table-rule badge rather than a measurement.
`weak_start_pivot` and `no_phantom_hands` do not state a testable condition, and the honest badge
for those may be `advice`.

**2. Both populations, always.** `concealed_kong_signal` reversed sign between the recorded hands
and the coach table. That is the second read to do so. Any read measured on one population is a
read about a game the other is not playing.

**3. The ping-wu row is the one to check first.** Its committed slopes fall with turn (0.450,
0.332, 0.272) where every other plan's are flat, on the smallest sample of the five - 2,072 hands
at turn 40. A second 20,000-hand `plan_ping_wu` run costs seven minutes and would say whether that
is the plan or the sample.

**4. `main` was fast-forwarded to this branch at the end of the session.** There is no git remote
configured, so nothing was pushed and no CI ran anywhere: the local typecheck, tests and build ARE
the checks. A deploy, when somebody does one, is made from `main`.
