# Where we left off — 2026-09-02

Read this first. `PLAN.md` is the project. `FINDINGS.md` is everything we measured and why.

## Nothing is running

All three ideas found in the tactics book have now been played for money. Counting the wait in tiles
that can legally win WON (+0.048) and is shipped. Reading the wall did not. Reading what an opponent
MELDED, rather than how many times, is the third, and it is the interesting one.

## The third read, and what it turned up (2026-09-02)

The read is `half_color_tell`: a player collecting a suit does not throw that suit, so the suit
missing from their discards is their hand. Measured on run-money4 it came out BACKWARDS - their suit
looked safer. The reason is that the recorded run has almost no colour hands in it. Its bots have no
colour target, so 1.29% of their wins are Half or Full Colour against 31.7% at a table of coaches.
The read was being looked for in players who do not make the play.

Measured again on 25,000 hands the coach played against itself (`reads.ts --coach`), the read is
right and large: a tile in their suit deals in to them at x2.03, rising to x5.52 late. Then played
for money over 16,000 paired deals on two seeds it returns -0.034 +/- 0.057. Nothing.

**That is four true reads in a row that pay nothing** (the wall, and now this). The coach's danger
term is not where the money is; it already prices every discard continuously and a better price does
not move it.

## What this leaves worth doing

**The training material, not the coach.** The quiz pack and the film room are drawn from the recorded
run, so a player practises positions from a game with 1.3% colour hands and 15.9% draws while being
taught by a coach that plays one with 31.7% and 0.9%. Regenerating from coach-played hands is the
job with real value in it, and it is the expensive one - it needs the evaluator run again, which was
seven hours on the weak bots and will be longer on coach play-outs.

**Teach the suit read to the player.** It is true, mechanical and measured at x2.03. It is worth
nothing to score with and worth a lot to know, because a person does not weigh danger continuously
the way the coach does. It belongs in the app's explanations, not in `rankDiscards`.

**Do not tune the danger model again.** Four measured failures.

## Fixed on the way past

Seats are numbered 1-4 everywhere a person reads one, matching the app; the tools used to print 0-3.
`sim.ts` and `stats.ts` labelled their four chairs E/S/W/N, which is wrong - the dealer rotates, so
chair 1 is East a quarter of the time - and that output reads as a seat-wind edge it never counted.
`.claude/launch.json` and `web/vite.config.ts` needed changes to run the dev server at all, because
the repo path contains a ':'.

## The overnight run finished, and it cut our headline result by two thirds

`legalWait` - the ONLY change this project has ever shipped - was tested on `shuffle-200001..230000`,
a range nothing here has ever been fitted or swept on. 120,000 paired deals:

```
  coach WITHOUT the rule:  -0.018 +/- 0.012      t = -1.5, inside two standard errors
```

It shipped at **+0.048 +/- 0.013**. On deals nobody chose it is worth about **+0.018** and does not
clear two standard errors. The whole history reads 0.072, 0.035, 0.049, pooled 0.048 on twelve
fitted seeds, then 0.018 on virgin deals - the winner's curse, measured honestly at every stage and
still shrinking by two thirds the moment the deals were picked in advance.

The rule FIRES, so this is a verdict and not an empty measurement: `tools/_waitrate.ts` says a throw
leaves the hand ready on 13.55% of decisions - the only place the rule speaks - and it changes the
throw on 4.06% of those, one discard in 180.

**It stays on**, because the point estimate still favours it, three of four seats lean the right way,
and counting winning tiles the table forbids you to declare is wrong on its face whatever it pays.
But the honest number is +0.018 +/- 0.012 and the larger one should not be quoted again.

**The rule this suggests for everything else here.** Every positive result in FINDINGS was measured
on deals that were chosen - a few seeds, all tried, the good ones reported. Re-run any positive
result on a fresh named range before believing its SIZE. The negative results had no incentive to be
lucky and can stand.

## The dataset is unblocked (2026-09-02)

The thing that blocked regenerating the dataset all day was an argument, not a measurement, and the
measurement says it is wrong.

The argument: our grader cannot finish a colour hand (1.5-3.5% against the coach's 34.6%), so
grading coach-played positions - a third of them colour hands - would give good positions with wrong
answers. Measured on the confident decisions each population actually yields:

```
                        graders          disagree
  run-money4            weak vs weak      0.9%   (n=330)
  run-money4            coach vs weak     4.0%   (n=329)
  coach-played hands    weak vs weak      0.7%   (n=432)
  coach-played hands    coach vs weak     2.4%   (n=420)
```

**A colour-capable grader changes FEWER labels on coach positions than on the old ones.** A position
with a clear answer has a clear answer whoever plays it out, and coach hands are sharper anyway
(10.6% decisive against 8.4%).

**So: regenerate with coach-played hands and the grader we already have.** The fast coach is not
needed. `coachcopy.ts` and `FastCoachBot` stay as a record - the copy did learn colour play,
1.5% -> 17.1% - but nothing waits on them.

## The regeneration, when it is run

`tsx src/generate.ts --hands N --workers 8 --out ../data/gen/run-coachN --seed S --bots coach`
then `evaluate.ts` as before. Checks that must pass first, all of which passed on the 3,000-hand
probe in `data/gen/run-coach1`:

- the hands record `['coach','coach','coach','coach']` - `--bots coach` silently did nothing at
  first, because the multi-worker path did not pass the option, and it recorded random
  personalities at 329 hands/s. The SPEED is the tell: the coach runs at about 35-60 hands/s.
- they replay exactly: 0 errors, no "did not replay" lines. The grader silently drops hands it
  cannot replay, so a broken run looks like a small one.
- the population is right: 38% colour hands against run-money4's 1.3%.

Generation is cheap: 3,000 hands in 50s on 8 workers. The evaluator is the long pole, ~7 hours for
480k decisions, unchanged.

## Next, asked for on 2026-09-02: hand shapes in the quiz

Changs asked that the book's hand-shape tips be measured and taught, not just the reading tips.
So far three of the book's 102 rules have been touched, all from `phase: read`. The untouched bulk
is shape work - 28 rules in `phase: build` and 16 in `phase: discard` - things like `five_blocks`,
`sandwich`, `stepping_stones`, `threes_and_sevens`, `edge_waits_stronger`, `pair_rule`,
`perfect_one_away` and `bad_wait_ranking`.

Two jobs, and they are separate. MEASURE each tip the way the three reads were measured, to find
which are true at this table. TEACH them in the quiz, which means the questions have to be picked
so a named shape is actually the point of the question - the pack currently selects on how cleanly
the play-outs separate an answer and nothing else, so no tip is guaranteed to appear at all.

Do the measuring first. The suit read is the warning: it is true, it is teachable, and pricing it
was worth nothing, so "measured true" and "worth scoring with" are different findings and the quiz
should only teach the first.

## Two habits worth keeping

**Play it out before believing it.** Being right per-decision has now failed to predict winning
three times. The only measure that counts is chips per game from
`solver/src/tools/headtohead.ts`.

**Change the shuffle.** The test tool used one fixed shuffle for every comparison. That made a
fake pattern look real enough that I called it the project's strongest lead for half a day. Pass a
different seed as the last argument and see if a result survives.
