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

## Where the fast coach got to (2026-09-02, end of session)

The dataset cannot be regenerated until something plays the coach's game at a cheap bot's speed,
because every EV means "worth this much IF PLAY CONTINUES LIKE THE BOT THAT PLAYED IT OUT" and the
bots that graded everything we hold finish a colour hand 1.5-3.5% of the time against the coach's
36.2%.

Measured before building anything: discards are 88.2% of the coach's cost and claims 10.6%
(`tools/_profile.ts`); inside a discard the hot spot is `acceptance`, which calls an evaluator 34
times per candidate (`tools/_hotspot.ts`). Pruning that exactly would buy 2-3x and we need ~35x, so
an imitation is genuinely required rather than an optimisation.

`datagen/src/coachcopy.ts` trains one by copying the coach's own MOVE - unlimited, free,
self-consistent labels, unlike the three failed models that learned the noisy measured-best action.
The missing piece was suit: `policyFeatures` has none, so `solver/src/copy.ts` adds four.

```
  bot          ms/hand   colour hands
  shanten         0.95         1.5%
  coach          89.37        36.2%
  FAST COACH     11.35        17.1%      held-out agreement with the coach 58.1%
```

**Half a success.** It learned colour play, which is what the suit features bought and the first
evidence the approach works at all. It is not the coach's rate, and agreement plateaus at 58% -
25 numbers cannot express which plan a hand is on.

**It is 12x too slow, and we know exactly why:** claims still run the real coach, which is the 10.6%
the profile said would be left. Fast claims are the next piece and without them the discard work
buys nothing.

## The decision waiting for Changs

Before finishing the fast coach, find out whether it is needed. Does a grader that CAN play colour
hands pick different best tiles from the one we use? `--policy coach` now exists in the evaluator
for exactly this. A first attempt at 24 rollouts said no - 27.0% agreement between two weak graders,
26.5% between weak and coach - but only 4 of 400 decisions were confident enough to count, so it
proves nothing.

The coach grades at **0.05 decisions/sec** at 128 rollouts (measured, not extrapolated). So:

- **plain run tonight**: ~1,440 decisions in eight hours, ~4% of them confident, so ~58 usable
  comparisons. Enough to catch a large difference and nothing else.
- **filter first**: grade with shanten at 35/sec, keep only the confident ones, spend the coach's
  time on those alone. Same night, ~1,400 usable comparisons. Needs ~20 lines in `evaluate.ts` (an
  `--only <file>` of `g:h:d` keys) and a check that it grades exactly the listed decisions.

The second is 25x better and is also the right population - the quiz picks its questions by
confidence from the shipped grader, so "positions the shipped grader is sure about" is what we care
about. Recommended, and NOT started: writing new code late and running it unattended is how the
wasted runs happened.

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
