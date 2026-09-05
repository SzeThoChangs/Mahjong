# Findings — the measured record

Everything below was measured, most of it more than once. It is kept because the expensive part of
this project has not been writing code, it is finding out which plausible ideas do not work, and
several of these were believed before they were checked.

Read [PLAN.md](PLAN.md) for what the project is and where it stands. This file is why.

**How to read a number here.** Every chips-per-game figure comes from `solver/src/tools/headtohead.ts`:
the tested bot is rotated through all four seats against three identical coaches, walls paired
between arms, reported as a mean and a standard error. A difference smaller than twice its error
bar is not a difference. The `self` arm plays the coach against itself and must return exactly
0.000 +/- 0.000; if it ever does not, nothing else on this page can be trusted.

**One caveat that applies to everything dated before 2026-08-30.** The wall seed was hardcoded, so
those runs all used a single set of 4,000 deals. Headline numbers survive it - the model's loss
reproduces at -0.544, -0.420 and -0.404 across three shuffles - but any per-seat or per-setting
BREAKDOWN from before that date should be re-checked on a second seed before it is trusted. One
already failed that test; see the seat asymmetry.

# Status — 2026-08-25 (data-generation programme)

The trainer plan above still stands; the project also now carries the three-layer data programme.

| Layer | Status |
|---|---|
| 1 — Data generator (`datagen/`) | **Done, milestone met**: 100,000 hands / 8.22M decisions generated, 0 illegal actions, chips net zero, every hand replays from its seed; 5 bot personalities with 70/15/10/5 controlled randomness; JSONL.gz + Parquet; validation stats + flags. |
| 2 — Evaluator (`datagen/src/evaluate.ts`) | **Run at scale**: `data/gen/run-money2` = 150k hands / 9.03M decisions under the money rules, with **479,912 evaluated decisions** (adaptive 128 paired rollouts, ShantenBot policy), 0 errors, 0 failed workers, 13h 12m. Resumable, crash-tolerant. The five original bot personalities only — `defensive` landed after this run was generated. **The stored `gapSe` in this run is sqrt(k) too small** (fixed in evaluate.ts after the run). Runs now carry `seVersion` in `evals-manifest.json` and `src/se.ts` corrects old ones on read, so every consumer sees the same honest number: **29% of decisions have a clear best action at 1 SE, 9% at 2 SE — 4% for discards, 27% for claims, 72% for self-actions** — on a mean paired SE of 1.10 chips. | **Superseded 2026-08-29 by `data/gen/run-money3`** — same shape (150k hands / 8.84M decisions / 479,923 evaluated, 0 errors, 6h 59m) but generated after the wildcard fixes below, so it is the first run where the recorded game is the game the table actually plays. Its noise floor is identical (29% / 9%, 4% discards), which is the useful negative result: wildcards were never what made discards unmeasurable. Everything the app serves is now built from it.
| 3 — Model | Not started. Blocked behind the layer-2 noise floor: the median gap between the best discard and the runner-up is 0.41 chips against a 1.10-chip standard error. More rollouts scale as 1/sqrt(n) and are a bad trade (16x compute -> 47%). |

### The noise floor is structural, not a coupling artifact (measured 2026-08-26)

The previous status blamed the sequential rollout RNG: branches were said to decorrelate on the
first claim, so sharing randomness better would tighten the estimate for free. **That diagnosis was
wrong, and it is worth recording why so nobody spends a week on it.**

`ShantenBot` — the rollout policy this run used — overrides all three decision methods and never
touches its RNG. It is completely deterministic. There was no RNG desynchronisation to fix, because
there was no RNG in the loop at all.

`src/evaluate.ts` now supports position-keyed rollout randomness anyway (`CoupledBot`: each decision
is re-keyed from a fingerprint of the position rather than from how many draws preceded it, so two
branches that reach the same position draw alike however they got there). `src/coupling.ts` measures
it, A/B, on the same decisions at the same seed:

| policy | mean paired SE, sequential | position-keyed | change |
|---|---|---|---|
| shanten (this run) | 2.227 | 2.227 | none — the policy is deterministic |
| efficiency | 2.323 | 2.209 | 4.9% lower (~1.1x the play-outs) |

What the pairing is really doing, over all 479,913 evaluated decisions:

```
outcome SD 9.8 chips, paired-difference SD 10.7, correlation 0.37
sharing the deal cuts the difference SD from 13.9 (independent) to 10.7 — 22% of the way to zero
```

The paired difference is *more* volatile than the outcome it is built from. Sharing the deal is
already being done and buys the 22%; the rest is the hand itself diverging. A different discard
draws a different claim, which shifts who draws what for the rest of the hand. That divergence is
not noise layered on the signal — it substantially *is* the effect being measured, and no amount of
shared randomness removes it.

So the remaining routes, in the order they look worth trying:

1. ~~**Lower-variance target.**~~ **Tried and closed** — see the measurement below. No reweighting
   of the outcome statistic helps, because the variance lives in which hand wins rather than in the
   size of the payout.
2. **Truncated rollouts plus a value estimate.** Shorter play-outs are both cheaper and less
   variable; a shanten/fan-aware terminal value would do. This is the only route that improves
   compute and variance together.
3. **Scoring-aware rollout policy.** ShantenBot is fan-blind and cannot know a hand is short of the
   2-tai minimum, so it misprices exactly the positions this table's minimum makes decisive. This
   changes what the rollouts measure rather than how precisely — worth doing, but it is a
   correctness fix, not a variance fix.
4. **Aim the product at what is measurable.** Claims (27% clear at 2 SE) and self-actions (72%) are
   resolvable today. Discards (4%) are not, and no near-term amount of compute makes them so.

Web app tabs: **Train** (book-coach synthetic quiz) · **Real quiz** (recorded positions graded by evaluator EVs; quiz packs via `datagen/src/quizpack.ts`) · **Film room** (replay explorer with per-decision EV bars; exports via `datagen/src/export.ts`). Dev server pinned to port 5174.

### Accuracy against measured EVs does not predict winning (measured 2026-08-27)

The learned discard model beats the book coach on every per-decision measure: it picks the
measured-best tile 70.4% of the time against 55.7%, and loses $1.29 a decision against $1.35
across all 49,075 evaluated discards. On that basis the Train tab was switched to grade on it.

Then it was played out. `solver/src/tools/headtohead.ts` rotates the tested bot through all four
seats and pairs the walls between arms, because a table of four IDENTICAL coaches still
spreads 4.5 chips a game between seats over 500 games — seat and deal variance swamp the
effect otherwise. Over 4,800 paired deals:

```
seat   model chips/game   coach chips/game   difference (paired)
  0        -1.77             -0.17            -1.60 +/- 1.21
  1        -2.12             +0.07            -2.19 +/- 1.22
  2        -2.29             +0.63            -2.91 +/- 1.21
  3        -4.46             -0.52            -3.94 +/- 1.23
overall                                       -2.66 +/- 0.61
```

**The model loses 2.66 chips a game to the coach**, negative in every seat, 4.4 standard
errors. The Train tab was switched back to grading on the coach.

Per-decision regret against a measured best does not aggregate into winning hands. The
likeliest reason is coherence: the coach commits to a target and plays toward it, while the
model scores each discard independently and can be locally right the whole way to an
incoherent hand. Two other candidates worth ruling out — the measured EVs come from
ShantenBot rollouts, so "best" means best against ShantenBot rather than against a coach;
and PolicyBot takes its claims from the coach, so its parts were tuned separately.

The lesson for anything built next: a per-decision metric is a proxy, and this one is a
proxy that pointed the wrong way. Play it out before believing it.

#### That margin was measured on the wrong wall — it is 0.54, not 2.66 (re-measured 2026-08-29)

**The table plays four wildcards and `tools/headtohead.ts` was dealing none.** Both bots it compares
were tuned on data generated WITH them, so the verdict above was measured on a game neither one
was built for. The harness now loads the table's rules and deals its wall. Re-run against the
model refitted on run-money3, 16,000 paired deals:

```
seat   model chips/game   coach chips/game   difference (paired)
  0        -0.38             -0.45            +0.07 +/- 0.29
  1        -0.16             +0.01            -0.18 +/- 0.28
  2        -0.94             +0.10            -1.04 +/- 0.29
  3        -0.69             +0.34            -1.02 +/- 0.29
overall                                       -0.544 +/- 0.144
```

**The direction holds and the magnitude does not.** The coach is still ahead, at 3.8 standard
errors, so the Train tab stays on the coach and the lesson above stands: 69.8% top-1 against the
coach's 52.8% still does not buy a win. But the gap is a fifth of what was recorded, and the
coherence diagnosis was reasoning about a 2.66-chip hole that was mostly an artefact. Whatever
explains 0.54 chips a game need not be as large a defect as incoherence.

Two things changed between the runs — the wall, and the model being refitted on run-money3 — so
the shift cannot be attributed wholly to the wall.

**New and unexplained: the loss is not spread across the table.** Seats 0 and 1 are at parity;
seats 2 and 3 each lose about a chip a game, ~3.5 SE apiece. The dealer rotates uniformly over
4,000 deals per seat, so seat effects should cancel and this asymmetry should not exist. It is
the most concrete lead on where the remaining 0.54 actually comes from.

**Verdicts respect the error bar.** The quiz used fixed $0.35 / $1.50 bands against a ~$1.10 paired
SE, so it called moves mistakes that the play-outs cannot separate. Bands are now floored at each
position's own error bar, with a **Too close to call** verdict inside 1 SE, and both the quiz and
the film room draw ±1 SE whiskers on the EV bars. Every consumer reads the SE through
`datagen/src/se.ts`, which corrects pre-`seVersion` runs on read.

**Packs select on decisiveness, not spread.** Selecting on EV spread (best minus worst) gave a pack
that was 80% discards with a mean best-vs-runner-up gap of $0.60 against a $1.07 error bar — three
quarters of it ungradeable, which the honest verdicts then made obvious. `quizpack.ts` now keeps
only positions where the best beats the runner-up by more than `--clear` (default 2) standard
errors, measured both ways the number can be read (paired gap, and the difference of means the UI
actually grades on — `separationT` in `se.ts` takes the weaker). Decisive positions on disk: 15.0k
discards, 21.6k claims, 4.9k self-actions — several times what a pack needs, so the mix is held at
the run's own proportions. Result: **100% of questions have a separable best answer at 1 SE and 99%
at 2 SE, against 24% before**, and the share of alternatives sitting inside 1 SE of the best fell
from 40% to 0.6%.

What this costs: **the questions are easier.** Mean best-vs-runner-up gap on a discard went from
$0.60 to $3.62. The trainer teaches positions where one tile is clearly right, which is a narrower
lesson than intended — but it is a real one, where the previous pack was mostly quizzing on coin
flips.

### The pack no longer skews late (fixed 2026-08-31)

Holding the mix by decision KIND alone left a second skew unheld. Decisiveness is very unevenly
spread through a hand — 7.0% of late discards clear 2 SE against 1.4% of early ones, because a late
hand is committed and an early one is still every hand at once — so selecting on decisiveness within
kind delivered a pack that was **43% late and 17% early against a run that is 25% late and 37%
early**. The trainer was quietly declining to ask the opening questions, which are the ones a player
has the most turns to get wrong.

The fix was to make a stratum kind × phase rather than kind, which the existing proportional
allocation then holds for free. It cost nothing in gradeability: at 5,000 questions every one of the
nine strata still fills from decisive positions alone, no backfill from close calls. The rebuilt
pack reports `pack [early 37% mid 38% late 25%] vs run [early 37% mid 38% late 25%]`, and the median
question moved from turn 32 to turn 23. The kind mix is unchanged (4,077 discards of 4,999).

One thing to watch, which `quizpack.ts` now prints as `drawn thin`: early discards are the binding
stratum — 1,554 wanted out of 2,066 decisive, 75% of the pool. That slice is no longer a sample of
early discards so much as most of the separable early discards there are, and a larger pack, or a
second pack off the same run, will repeat it before it repeats the others. More early questions need
more hands or deeper play-outs, not a different selection rule.

### The book's benchmark was never our game (2026-09-01)

The player asked whether the book's 23% win / 14% draws / 48 turns includes wildcards. It does not.
There is not one mention of a joker or wildcard anywhere in `knowledge/` - the source states only
"Singapore ... Minimum Fan 1 and Fan Limit 5" and adjusts for minimum fan, never for wildcards. Our
table plays with four. Every time that benchmark was quoted as a sanity check, it was checking a
different game.

It was also giving false comfort. run-money3 read 21.0% / 15.9% / 49.0 against 23 / 14 / 48 and
looked close - but wildcards should push wins UP and draws DOWN, and ours were lower and higher.
Two errors pointing opposite ways, landing near the book by coincidence.

Separating them. The wildcards-on arm runs the production path - `runSession`, six personalities
drawn per session, 70/15/10/5 randomness, exactly as `worker.ts` does - so it can be checked against
the dataset before anything is read off it. 20,000 hands for the production arms, 5,000 for the rest:

```
players             wildcards     win     draw    turns
production bots     none          9.3%   62.9%    67.9
production bots        4         21.2%   15.2%    48.6   <- run-money4 is 21.0 / 15.8 / 48.9
shanten+random      none         18.6%   25.6%    56.2
shanten+random         4         23.8%    4.7%    42.4
book coach          none         20.1%   19.7%    55.0
book coach             4         24.8%    0.9%    40.9
book (no wildcards)               23.0%   14.0%    48.0
```

**The harness reproduces the dataset**, so the rest of the grid is trustworthy.

**Wildcards are the larger effect by far.** Holding the players fixed, four of them take the
production bots from 62.9% drawn hands to 15.2%, and the coach from 19.7% to 0.9%. They are what
makes the game finish.

**On the book's own game, player strength walks the numbers at the book, monotonically on all
three.** This is the validation `PLAN.md` set out for the coach and never ran:

```
                 win     draw   turns
production       9.3%   62.9%    67.9
shanten+random  18.6%   25.6%    56.2
book coach      20.1%   19.7%    55.0
the book        23.0%   14.0%    48.0
```

The coach is not merely better than the baselines, it is better in the direction of real play. After
six measured failures to improve on it, that is the first independent evidence the coach is sound
rather than just locally unbeatable.

**A limitation of the dataset falls out of this.** run-money4's 15.8% drawn hands is a property of
weak bots, not of the table - the same rules with competent play draw 0.9%. The player said the draw
rate looked too high before any of this was measured, and they were right. So the recorded positions
over-represent hands that drift toward an exhausted wall, and under-represent the sharp end where a
hand is actually going somewhere. The EVs on each position are still measured correctly; it is the
MIX of positions that is skewed. Worth knowing before treating the quiz as representative of a real
table, and worth fixing by generating with stronger bots if the app ever depends on it.


### The first idea from the tactics book, and the first thing to beat the coach (2026-09-01)

The coach had never used a line of the 136-tip book. 77 of its tips were read, translated to
Singapore rules and written into `knowledge/playbook.json` in an earlier session, and NOTHING in any
package reads that file - the coach runs entirely on the other source, the Data Analytic study.
Reading the tips against what the coach computes turned up three things it cannot see at all:
winning tiles that cannot legally win, what an opponent MELDED rather than how many times, and
anything the discard pool says beyond tile class and freshness.

The first of those is `narrow_can_beat_wide`: at a table with a minimum, a wider wait can be worse,
because winning tiles that leave you under the minimum are dead. `ukeire` counts tiles that complete
the hand and never looks at tai, so an 8-tile wait that cannot legally win outscored a 4-tile wait
that can. This is one of the few tips in a Riichi book that exists BECAUSE of a table minimum rather
than in spite of one.

`legalWait` in `rank.ts` replaces the acceptance count once the hand is ready: a tile counts fully
if it reaches the minimum on a discard, 0.47 if only self-drawn, zero if it cannot win. It reuses
the existing multiplier so nothing was tuned to flatter it, and 0.47 is measured (59,392 of 126,273
wins in run-money4 were self-drawn) rather than chosen. Each candidate is scored both ways because
the all-chow rules reject some hands on a discard that are fine self-drawn.

Harness self-check first: the coach against itself returns +0.000 +/- 0.000 over 1,600 paired deals.
Then, `tools/headtohead.ts`, seven separate wall seeds:

```
  first batch    3 seeds, 18,000 deals   +0.072 +/- 0.030   t = 2.44
  confirmation   4 seeds, 32,000 deals   +0.035 +/- 0.022   t = 1.60
  ALL SEVEN               50,000 deals   +0.048 +/- 0.018   t = 2.74
  seat-runs: 20 positive, 7 negative, 1 exactly zero (of 28)
```

**The effect halved when it was tested harder.** That is the single most important line here. A
first batch at +0.072 and a confirmation at +0.035 is what regression to the mean looks like, and
the honest reading is that the true figure is nearer the pooled +0.048 than the number that made it
look exciting. Anyone quoting +0.072 later is quoting the lucky half of the evidence.

What survives that caution: pooled over 50,000 paired deals it clears 2 SE, the pessimistic bound is
still positive at +0.012, and 20 of 28 seat-runs are ahead (a sign test puts that near 1%). Small,
but the first positive result after six measured failures.

Worth recording WHY it may differ from those six. Every one of them - the discard model, the claim
model, both together, the flower route, and two fold rules - re-weighted information the coach
already had. This one hands it a fact it could not see. That is the distinction to test next, not
"another weighting".

**It stopped moving, so it is ON.** A third batch of five further seeds returned +0.049 +/- 0.019
against a pooled +0.048 - the estimate reproduced itself rather than shrinking again:

```
  batch 1   3 seeds, 18,000 deals   +0.072 +/- 0.030
  batch 2   4 seeds, 32,000 deals   +0.035 +/- 0.022
  batch 3   5 seeds, 40,000 deals   +0.049 +/- 0.019
  ALL TWELVE        90,000 deals    +0.048 +/- 0.013   t = 3.72   95%: +0.023 .. +0.074
```

Shipped on by default. `PlainWaitCoachBot` and the `plainwait` arm play the old way so the rule can
still be measured by REMOVING it: that returns -0.045 +/- 0.030 over 18,000 deals, the mirror of what
adding it won, which is the check that the flag still drives the shipped coach rather than dangling.
A result near zero there would mean the wiring had rotted.

What it actually changes, from `tools/_why.ts`:

```
hand:  2萬 2萬 2萬 3萬 3萬 5萬 6萬  .  4筒 7筒 7筒 8筒 8筒 9筒 9筒
OLD coach throws 4筒  -> ready, waiting on 4萬 or 7萬 - both dead
NEW coach throws 3萬  -> not ready, still building
```

Throwing 4筒 completes the hand two ways and both are 222萬 + 345萬 + 33萬 + 789筒 + 789筒: a chicken
hand at 0 tai that cannot be declared at this table. The old coach preferred it because it scored
readiness and wait width and never asked whether winning would be LEGAL. That is the whole of the
+0.048.


### The second idea from the tactics book is right and pays nothing (2026-09-01)

`no_chance_tiles`: when all four copies of a tile are accounted for, its neighbours are safer,
because every run containing a tile needs one of its immediate neighbours. Measured as a new
dimension on the existing reads pipeline - same method, same sample - and the read is emphatically
correct:

```
  simple|20|fresh    open 0.65%   walled 0.12%   x0.18
  simple|30|fresh    open 1.23%   walled 0.39%   x0.32
  simple|40|fresh    open 1.66%   walled 0.45%   x0.27
  simple|50|fresh    open 1.77%   walled 1.04%   x0.59
  terminal|40|seen   open 0.63%   walled 0.06%   x0.10
```

Three to five times safer, all sixteen cells with the sample for it. And it is worth **nothing**:

```
  seed 11  +0.038 +/- 0.050    seed 101  -0.017 +/- 0.060
  seed 23  +0.004 +/- 0.053    seed   7  -0.028 +/- 0.055
  pooled over 24,000 paired deals:  +0.002 +/- 0.027   t = 0.07
```

Dead level, and scattered either side of zero rather than leaning.

Checked before writing that down, because a rule that never fires measures zero exactly like a rule
that fires and does not pay, and this project has already lost a session to that confusion
(`tools/_wallrate.ts`, 16,088 discard decisions):

```
  tiles in hand that were walled         2.19%
  decisions with any walled tile        15.02%
  ...of those, the throw CHANGED        13.29%
  so the rule changes the play on        2.00% of all discards
```

It fires. One discard in fifty is different. The read is simply not decisive when it applies: the
coach was already close to the best throw, so swapping to the walled tile buys safety and gives back
roughly the same in hand value. A large discount on a rare tile, cancelled by what the swap costs.

Worth separating two things that are easy to conflate here. The MEASUREMENT is correct and stays -
it is in the shipped reads table, and "no run can still be waiting on it" is a true and teachable
fact about a tile. What failed is using it to PRICE a discard. Those are different claims, and only
the second one was tested and rejected.

The rule stays off behind `{ wall: true }` and `WallCoachBot`, with the arm kept so it can be
re-tested if the danger weight is ever refitted - `DANGER_WEIGHT = 40` was fitted without this
dimension existing, which is the one loose end.

That is two of the three gaps found in the tactics book now answered: counting the wait in legal
tiles WON (+0.048), and reading the wall did not. The third - that the coach sees how MANY melds an
opponent has but never what they are, so a dragon pong and a chow are the same input - is untouched,
and is the one the book spends eleven tips on.


### The grader does not need to be strong, so the dataset is unblocked (2026-09-02)

The dataset could not be regenerated because of an argument that turned out to be wrong. Every EV we
hold means "worth this much IF PLAY CONTINUES LIKE THE BOT THAT PLAYED IT OUT", and the bots that
graded everything finish a colour hand 1.5-3.5% of the time against the coach's 34.6%. Generating
positions from coach play - a third of them colour hands - while grading with a bot that cannot
finish one looked like a guaranteed way to produce good positions with wrong answers.

It was worth checking before building a fast coach to fix it. `--policy coach` grades a small sample
with the bot the positions come from; `--only` spends that expensive grader on the ~10% of decisions
that are decisive, which is the only subset any comparison can use and also exactly what the quiz
draws from. That turns an eight-hour comparison worth 58 usable answers into a 26-minute one worth
794.

Two populations, each against its own baseline of two WEAK graders disagreeing with each other:

```
                        graders          disagree on confident decisions
  run-money4            weak vs weak      0.9%   (n=330)
  run-money4            coach vs weak     4.0%   (n=329)    +3.0 points, z = 2.5

  coach-played hands    weak vs weak      0.7%   (n=432)
  coach-played hands    coach vs weak     2.4%   (n=420)    +1.7 points, z = 2.0
```

**On the positions we would actually generate, a colour-capable grader changes FEWER labels, not
more.** 2.4% against 4.0%. The prediction was backwards.

The reason, as far as it can be told: a position with a clear answer has a clear answer whoever
plays it out. Coach hands are also sharper - 10.6% of their decisions are decisive against 8.4% of
run-money4's - so the subset that survives the 2-SE filter is the subset where the play-out policy
matters least. The weak grader misprices colour hands, but not the ones it is confident about.

**So the fast coach is not needed for grading.** `datagen/src/coachcopy.ts` and `FastCoachBot` stay
as a measured record - the copy learned colour play, 1.5% -> 17.1%, which is the first evidence that
imitating the coach works at all - but nothing is waiting on them. The dataset can be regenerated
with coach-played hands and the shanten grader, at a cost of about one label in forty differing from
what a stronger grader would say, which is fewer than differ today.

**What was actually blocking it was never measured until now.** The whole argument rested on a
mechanism that sounded obviously right - weak bot cannot play the plan, therefore misgrades the plan
- and it took a 26-minute experiment to find out it does not survive the 2-SE filter. Worth
remembering the next time a chain of reasoning stands between us and a night of compute.

### The one thing we shipped is worth about a third of what we claimed (2026-09-02)

`legalWait` is the only change this project has ever made to the coach, and it went in at
+0.048 +/- 0.013 chips a game over 90,000 paired deals on twelve wall seeds. Its own entry above
carries the warning that the effect halved when it was tested harder - 0.072 in the first batch,
0.035 in the second - and the honest reading recorded there was that the truth was nearer the
pooled figure than the exciting one.

The named shuffle library made a real test possible for the first time: `shuffle-200001` onwards is
a range nothing in this project has ever been fitted, swept or confirmed on. The arm REMOVES the
rule, so a real effect reads negative:

```
  120,000 paired deals, shuffle-200001..230000, coach WITHOUT the rule

  seat 1   -0.01 +/- 0.02        seat 3   -0.05 +/- 0.02
  seat 2   -0.02 +/- 0.03        seat 4   +0.01 +/- 0.02

  overall  -0.018 +/- 0.012      t = -1.5, inside two standard errors
```

**So the rule is worth about +0.018, not +0.048, and on deals it was never fitted to it does not
clear two standard errors.** The sequence over the whole life of this result is 0.072, then 0.035,
then 0.049, pooling to 0.048 across twelve fitted seeds - and then 0.018 on virgin deals. That is
what the winner's curse looks like from the inside. Every stage of it was measured honestly and the
number still came down by two thirds the moment it met deals nobody had chosen.

**The rule fires, so this is a verdict and not an empty measurement.** `tools/_waitrate.ts` over
9,992 discard decisions: a throw leaves the hand ready on 13.55% of them, which is the only place
the rule speaks at all, and it changes the throw on 4.06% of those - one discard in 180. A rule that
never fired would have returned this same near-zero, and FINDINGS already carries a session lost to
exactly that confusion, so the check comes first now.

**It stays on.** The point estimate is still on its side, three of the four seats lean the right
way, and the reasoning is sound in a way that does not depend on the measurement: counting winning
tiles that the table's minimum forbids you to declare is wrong on its face, whatever it is worth in
chips. Keeping it costs nothing if it is truly zero. But the claim in the app and in this file is
now +0.018 +/- 0.012 on unseen deals, not +0.048, and nobody should quote the larger number again.

**What this says about the other results here.** Every figure in this file measured before
2026-09-02 was measured on deals that were, in one way or another, chosen - a handful of seeds, all
of them tried, the good ones reported. This is the first result measured on deals picked in advance
by name and never looked at before. The one thing it was pointed at shrank by two thirds. That is
not a reason to distrust the negative results, which had no incentive to be lucky, but it is a
strong reason to re-run any POSITIVE result on a fresh range before believing its size.

### Pricing what a deal-in COSTS is worth nothing either (2026-09-03)

Four reads have been priced into the coach and every one returned zero. All four sharpened the same
quantity: the chance that a discard deals in. This is the other half of the same term, and the last
form of the idea that had never been tried.

The coach's danger is `dealInChance x threatScale x DANGER_WEIGHT`. The first two are probabilities.
The third is a constant, and it says a deal-in costs the same whether the opponent has a cheap
chicken hand or a visible colour hand with a dragon pong - which on this table is 7 chips against
40. The engine already knows the difference: `visibleTai` computes what the table can see a hand is
worth off its exposed melds and face-up flowers, and it is what the bao rules run on. The coach had
never looked at it.

**The term redistributes rather than adds, which is the only version worth testing.** Turning the
coach's caution up loses money monotonically, measured, so a multiplier above 1 would be a slow way
of repeating that experiment. `tools/_valuerate.ts` measured the average shot at 8.76 chips over
real positions, and the term divides by it, so the mean multiplier is exactly 1.000: the coach gets
less careful in the 84% of positions where nothing expensive is showing (x0.80) and much more careful
in the 2.5% where a big hand is (x4.57).

**It fires.** 1.57% of discards change, one in 64 - the same order as the wall rule at 2.0% and the
legal-wait rule at 0.55%. Checked before the money ran, because a rule that never fires and a rule
that fires and does not pay both measure zero.

**120,000 paired deals on shuffle-310001 onwards, a range nothing here has been fitted on, in six
independent batches of 20,000:**

```
  -0.010   -0.009   +0.004   +0.045   -0.028   -0.007
  pooled: -0.001 +/- 0.013 chips/game     t = -0.06     two of six batches lean positive
```

Zero, and tightly zero: the batches scatter either side with a standard deviation of 0.025, which is
what six honest samples of nothing look like.

**That is five for five.** The wall read, the suit read, the meld read, the danger sweep, and now
the cost of a deal-in. Every one of them true or reasonable, every one worth nothing in chips. The
explanation that fits all five is the one FINDINGS reached after the fold experiment: the coach
already prices every discard continuously against what the tile does for the hand, and at the
margin those two numbers are close, so a better estimate on the danger side swaps one nearly-equal
throw for another. The value half is where the money is, and nothing here has moved it.

**What was NOT tested, and is the only remaining shape of the idea.** This is a position-level
multiplier: it asks what the most expensive visible hand at the table is worth and scales the whole
danger by it. It cannot say "this particular tile is dangerous to the expensive player and safe to
the cheap ones", because the shipped deal-in table is pooled across the three opponents. The reads
pipeline does have per-opponent tables. A per-opponent danger model, priced by each opponent's own
visible value, is a real build rather than an afternoon, and after five results like these it should
not be started without a reason better than "this time it is finer".

The arm stays in the tree as `value`, off by default, so the number can be reproduced.

### Three of the untested reads, answered: one real, one empty, one backwards (2026-09-03)

NEXT named four reads as cheap to settle with the tools that already exist. Three of them are now
measured on both populations - 25,000 hands the coach played against itself, and 25,000 replayed
from `run-money4` whose bots have no value model at all. All three are asked PER OPPONENT, because
pooling three seats lets two players who never saw the tile dilute a read about the one who did.

**`pair_discards_rule_out` is real, and it is the first read here that does not depend on who is
playing.** When a seat throws two copies of the same tile out of hand, the tiles beside it are
measurably safer against that seat:

```
                        one rank away   elsewhere   ratio      z
  coach hands              0.419%        0.609%     x0.69    -9.6
  run-money4               0.229%        0.318%     x0.72    -6.1
```

About a third safer, at every stage of the hand, and the two populations agree to three points.
Two ranks away is smaller and inconsistent - x0.65 against the coaches, x0.86 against the weak bots -
so the rule to carry is the immediate neighbour and nothing wider. The book's exception, that a 2 or
an 8 pair leaves a terminal wait live, has not been tested separately.

**`two_discard_piles` is the discard pile.** The book calls the tiles an open hand declined the
richest read available here. Mechanised as "a copy of this went past that seat uncalled", it is
worth about half:

```
                     passed them   never thrown   their own discards
  coach hands           0.359%        0.586%           0.085%
  run-money4            0.220%        0.317%           0.116%
```

Which looks strong until it is put beside the discount everybody already has. The plain
already-been-thrown discount on the same hands is x0.41-0.50 for a middle tile at the coach table,
and the per-opponent version is x0.57-0.64. In every cell of both populations the per-opponent read
is the same size or WEAKER than simply noticing the tile is on the floor.

The reason is obvious after the fact and was not before: every tile that gets discarded goes past
all three opponents, so "they declined it" and "it has been thrown" are nearly the same event. The
column worth keeping is the third one - a seat's OWN discards deal in four to eight times less often
than a fresh tile, which is far stronger than either. The book's narrower claim, about a tile that
would obviously complete their VISIBLE shape passing uncalled, needs a claim-eligibility model and
remains untested.

**`second_copy_call` comes apart into a half that survives and a half that is backwards.** The tip
says a player who claims only the second copy of a dragon is cheap but assembled. Every seat was
grouped by its first honour claim and the hand played to the end:

```
  coach hands, 20,000       seats   ready at the end   won    tai when they won
    took the first copy     14,887       53.9%        32.5%        3.45
    took a later copy          764       64.4%        38.1%        3.73
    claimed no honour       64,349       40.9%        22.9%        2.91
```

"Assembled" is right and it survives its control. A later copy is thrown later, so a seat claiming
one is claiming later in the hand, and a hand that has run longer is further along whatever it
claimed - but held at the turn of the claim the gap stays: 55.9% against 63.7% for claims from turn
20, and 65.1% against 72.6% from turn 40.

"Cheap" is false. Those hands were worth the same or more, 3.73 tai against 3.45, and won more
often. Against `run-money4` there is no readiness gap at all in any band. So the read is
population-dependent where it works and wrong where it does not, and following it would tell you to
relax about the player you should fear most.

What is not in doubt is the coarse version underneath it. Any seat that has claimed a dragon or a
wind is ready far more often than one that has not - 54 to 64% against 41% - and that is a bigger
signal than anything about which copy.

**Four reads have now been measured and priced, and none of them was worth chips.** The wall, the
suit, the melds, and the danger sweep. Two more are now measured and not yet priced, and one of them
is not worth pricing at all. The pattern is consistent enough to stop asking "is this read true" as
if that were the interesting question: the coach already prices every discard continuously, and a
better estimate of the PROBABILITY of dealing in has never moved the money. What has never been
tried is the price - what a deal-in costs when the opponent's visible hand is expensive.

### Every rule in the playbook now has a card, and most of them are untested (2026-09-03)

The Shapes tab is the Tips tab, and it carries all 102 rules in `knowledge/playbook.json` rather
than the 18 shape ones. 103 cards, grouped by where in a hand they apply, each with the rule in
plain English, the reasoning, and a badge saying what backs it.

The mix is the useful output, because it is an honest inventory of what this project actually knows:

```
  settled by counting the tiles on the card       9
  measured on played hands                       40
  measured and came out against the book          3
  rules of this table rather than advice          5
  advice about the player, not about tiles       14
  untested                                       32
```

**Half of the measured ones are not ours.** They come from the data-analytic study this table's
numbers were taken from, and the cards say so line by line rather than letting the badge imply we
ran them. The distinction matters: the study's author simulated this table, we simulated ours, and
where the two can be compared they agree - the study puts the colour hand at 32% of the opening book
at a 2 tai minimum, and four of our coaches choosing for themselves win a colour hand 31.7% of the
time.

**Where they disagree is more interesting.** The study reports 14% of hands drawn at a 2 tai
minimum. Four coaches playing each other draw under 1%. Neither is wrong: a draw rate is a fact
about the players, and four bots that all reliably reach 2 tai will not draw. That is the same
lesson as the suit read, in a place nobody would have looked for it.

**One card is now marked as contradicted for a reason worth keeping.** `binary_commitment` says push
or fold and never both. Measured here, the in-between is what wins: a rule that switched the coach
into folding lost twice, and pricing every throw continuously - what it does for the hand minus what
it hands the table - is what is shipped and what beat it. What was tested is a coach that can price
in chips rather than a person who cannot, and the card says that too.

**32 untested cards is the real finding.** Most of the book has never been checked here, and the
page now says so on each card rather than presenting all of it with the same confidence. Several are
cheap to settle with tools that already exist: what an opponent declined to claim, whether a shed
pair makes its neighbours safe, which copy of a dragon gets called, and whether a wind thrown to the
player before you buys the turn it is supposed to.

### The good waits rank the same way the bad ones do, and by about as little (2026-09-03)

`edge_waits_stronger` says that between two two-sided waits the one nearer the edge wins, because
opponents let go of edge tiles and hold middle ones. That is the same claim `bad_wait_ranking` makes
about the last two copies of a tile, so `release.ts` answers it from the same counts: for a block of
r and r+1, the chance at least one of the eight copies of r-1 and r+2 comes out after turn 30.

Four measurements - our coach, `ShantenBot` on two seeds, and the recorded `run-money4`:

```
                        coach    shanten s21   shanten s37    money4
  2-3, waits on 1/4     53.1%       32.3%         33.5%       75.1%
  3-4, waits on 2/5     50.9%       32.3%         32.4%       74.4%
  4-5, waits on 3/6     48.4%       30.5%         30.4%       72.7%
  5-6, waits on 4/7     48.3%       30.2%         31.6%       72.9%
  6-7, waits on 5/8     50.7%       32.5%         32.5%       74.4%
  7-8, waits on 6/9     53.2%       32.9%         33.8%       75.2%
```

**The book is right, the shape is a U, and the effect is small.** Every population puts the two
outermost waits at the top and the two middle ones at the bottom, and does it in the same order. The
gap between best and worst runs from 3% at `run-money4` to 10% at a table of coaches. The levels
differ hugely between populations - 32% against 75% - because they differ in how much they throw at
all, which is why only the ordering is worth reading.

It is also symmetric, which the card now says: a wait on 6 and 9 is as good as one on 1 and 4. The
rule is not "prefer low tiles", it is "prefer a wait that reaches an edge".

The play-out test cannot help here. A hand that can be made ready two ways on waits of the same
width is rare, so the quiz packs resolve 3 positions between them. The release count is the whole
evidence, and one tenth is what it is worth.

### The dataset is regenerated, and the tips were scored again on it (2026-09-03)

`run-coach2` is graded. 150,000 hands played by four coaches, 7,233,486 decisions recorded in 45
minutes, and 479,889 of them graded in 8h 8m at 16.4 decisions a second, with 0 errors and 0 failed
workers. Every check from NEXT passed: the manifest records `['coach','coach','coach','coach']`,
generation ran at 56 hands/s rather than the 329 of the run where `--bots coach` silently did
nothing, and the replay is exact - `quizpack` reports 0 drifted hands and 0 mismatched decisions
over 10,161 replayed hands.

The quiz pack and the film room are rebuilt from it. 4,999 questions and 180 replay hands, both
sitting beside the old `run-money4` ones rather than replacing them, so the two populations can be
compared inside the app.

**The pack is early-light and it is the run's own fault, not the sampler's.** Only 1.5% of early
discards separate by two standard errors, against 6.5% at mid and 16.6% late, so the early stratum
had 2,432 decisive positions to fill about 1,700 places and the pack came out 30% early against the
run's 41%. Closer than the old pack, which was 17% early against 37%, and still not level.

**Scoring the tips on it replicates the two big results exactly.**

```
                       coach pack (4,147 discards)      money pack (4,079 discards)
  escape_single_waits   303 resolved  89%  47%  +14.7    129 resolved  89%  47%   +9.8
  pair_rule             222 resolved  30%  66%  -11.9     87 resolved  31%  66%   -7.3
  threes_and_sevens      48 resolved  56%  47%   +1.3     20 resolved  50%  52%   -0.2
  triplet_adjacency      50 resolved  12%  41%   -4.3     32 resolved  47%  40%   +0.9
```

`escape_single_waits` gives 89% against 47% in both, on two populations that play differently.
`pair_rule` fails in both, in every split: restricted to positions where the alternative is a spare
number tile it is z = -11.6 on coach hands and -7.4 on the old ones, and restricted to hands two or
more tiles from ready it is -2.7 and -3.7. Two populations, four ways of cutting it, same answer.

**`triplet_adjacency` is where they disagree, and the disagreement is the finding.** The tip says
a spare beside your own triplet is weak because you are holding the tiles it needs. Counting agrees
and always did. But the tile the tip points at is in the biggest suit of the hand 63% of the time,
while the spare it prefers you keep is in that suit only 25% of the time. So the tip is largely
telling you to throw your longest suit. Against bots that never collect a suit that costs little;
at a table of coaches, whose biggest suit is 61% of the tiles they hold against 53% for the old
bots, it is wrong 88% of the time. Same tip, same counting, opposite advice, and the thing that
decides it is whether the table plays colour hands.

That is the same lesson as the suit read and the honour wait, which is now three for three: a claim
about what to do with a tile cannot be measured without saying who else is at the table.

### The pair rule is right about width and wrong about what to throw (2026-09-03)

Counting settles what a shape ACCEPTS and nothing else, and every verdict in the Shapes tab until
now rested on it. There is a much harder question available for free. Every position in a quiz pack
has been played out 128 times per option, so it already carries a measured best throw. If something
can say which positions a tip is ABOUT, the tip becomes a claim that can be scored against those
play-outs.

`solver/src/shapetag.ts` is that something. It reads a hand and returns the tips in play, each with
the throws that follow the tip and the throws it warns against. Four tips can be spotted without
ambiguity: `pair_rule`, `triplet_adjacency`, `threes_and_sevens` and `escape_single_waits`. The
others need a block decomposition or a hand score first, so they are not guessed at.

`datagen/src/tiptest.ts` scores them. Two corrections carry the measurement:

- Only positions the tip RESOLVES count - the measured best is a throw it points at or one it warns
  against. If the best is a third tile, the tip had no opinion.
- The baseline is a coin weighted by the tip's own share of the choice. A tip pointing at 3 of 5
  candidate throws is right 60% of the time by luck, and only beating its own share means anything.
  Without this correction `pair_rule` looks 21% right and `triplet_adjacency` 37%, and the ordering
  is an artifact of how many tiles each tip points at.

On the 4,079 discard positions in the money pack (from `run-money4`), 326 are about one of the four:

```
  tip                    about  resolved   follows it   by luck     z
  escape_single_waits      133       129          89%       47%   +9.8
  pair_rule                128        87          31%       66%   -7.3
  threes_and_sevens         46        20          50%       52%   -0.2
  triplet_adjacency         41        32          47%       40%   +0.9
  bad_wait_ranking          12        10          50%       50%   +0.0
  edge_waits_stronger        8         2           0%       50%   -1.4
```

**`escape_single_waits` is the strongest result any book tip has produced here.** When a hand can
stay ready in more than one way and the widths differ by a factor of two, the play-outs take the
wide wait 89% of the time against 47% by luck. Break the finished shape.

**`pair_rule` fails, and it fails the other way round.** The book says fix one pair, keep two, break
three. On positions holding three pairs the measured best throw was the LOOSE tile - keeping all
three - 69% of the time, against 34% expected. It is not the honours doing it: restricted to
positions where the alternative is a spare number tile the answer is the same, 30% following against
71% by luck, z = -7.4. Nor is it hands that are already ready on a two-pair wait, where breaking a
pair breaks the wait: hands two or more away from ready still go against the tip at z = -3.7.

One reason may be the table rather than the tiles. All Pungs is 2 tai here and the minimum to
declare is 2, so a third pair is a route to a hand you are ALLOWED to win with, and that is exactly
what a count of accepting tiles cannot see. That is a hypothesis and nothing here tests it.

`triplet_adjacency` and `threes_and_sevens` resolve too few positions to say anything, and the card
for `threes_and_sevens` already rests on a release measurement rather than on this.

**Added 2026-09-03, after the tagger learned to score a hand for tai: the one rule this project ever
shipped is confirmed from a second direction.** `narrow_can_beat_wide` says a winning tile that
leaves you under the table minimum is not a winning tile. On 35 graded positions where a hand could
be made ready two ways and one of the waits could not be declared, the measured best took the
declarable one 94% of the time against 50% by luck (z = +5.2), and 88% on the eight such positions
in the old pack. That sits beside the money result of +0.018 +/- 0.012 without contradicting it: the
decision is nearly always right, and it comes up on about one discard in 180, so what it is worth in
chips is small. A rule can be correct and cheap at the same time, and this is the clearest example
of it here.

The two wait tips are rarer still, and for a reason worth knowing: both need a hand that can be made
ready in two different ways with waits the same size, which is an uncommon position. Ten resolved
and two resolved say nothing at all. They stay in the tagger because the coach dataset is larger and
because these two are the only tips this project can now answer twice over - `release.ts` counts what
the table throws late, and this counts what the play-outs pay - and two roads to one claim is worth
more than either.

**What this measurement cannot separate.** A measured best is the best throw in the whole position,
so it prices danger as well as shape. A tip failing here has failed as ADVICE at this table, which
is what the app teaches, and not necessarily as a claim about shape. `pair_rule`'s counting result
still stands: the third pair really does cost about a third of the accepting tiles.

**It is also one population and one pack.** These positions come from `run-money4`, whose bots score
discards on hand shape alone, and they are the positions where one throw separated from the rest by
more than two standard errors. The coach-played dataset now being graded gives a second pack from a
population that plays colour hands, and this table should be re-run on it before any of it is
treated as settled.

### Half of the book's wait ranking is about the tiles, and half is about the table (2026-09-03)

Two cards in the Shapes tab were marked `needs-play`, both for the same reason. `bad_wait_ranking`
says that waiting on the last two of a terminal or an honour is close to a good wait and that a
middle tile is the worst place to be. `threes_and_sevens` says a lone 3 or 7 is the best spare to
keep. Neither is countable. Two hands can be identical tile for tile and differ entirely in what
the table will throw you, so both claims are about the same hidden thing: which tiles other players
let go of, and when.

`datagen/src/release.ts` measures exactly that. It plays or replays hands to the end and counts, for
every kind, the copies that were discarded - once over the whole hand, and again restricted to
turn 30 and later, because a wait only cares about tiles that come out after you are waiting on
them. Three populations, because a release rate is a fact about a population and not about mahjong:
our own coach, `ShantenBot`, and the datagen personalities that played `run-money4`.

`ShantenBot` is the control and it is the reason this finding exists. The coach prices every throw
against a danger table keyed on exactly the classes being measured here - it already believes an
honour is safer to throw than a middle tile - so a measurement taken only on coach hands would be
our own table read back to us. `ShantenBot` has no danger model and no honour rule at all.

The chance at least one of the last two copies comes out after turn 30:

```
                       coach     shanten    money4
  a middle tile (4-6)  15.4%   8.5 / 8.8%   28.0%
  a 2 or an 8          17.0%  10.1 / 10.5%  29.7%
  a terminal (1 or 9)  19.2%  10.3 / 10.8%  30.7%
  a wind               22.7%   7.9 / 8.4%   26.7%
  a dragon             23.1%   7.9 / 8.6%   27.1%
```

**The terminal half of the tip is true and the honour half is not.** A terminal wait beats a middle
one in all three populations, by about a quarter. The honour line is the top of the table under the
coach and the BOTTOM of it under the other two - worse than the shape the book calls worst.

The reason is timing, and it is visible in the same run. Honours are released more than anything
else over a whole hand, about 45-50% of every copy against 21% for a middle tile. Almost all of it
happens in the opening. Nobody keeps a lone wind, so under bots with no reason to hold one the
honours are gone by the middle of the hand and there is nothing left to feed a wait. Our coach holds
dragons and its seat wind for the tai and throws them late, which is why it alone agrees with the
book. So the useful form of the rule is not about the tile: an honour wait is good early and dead
late, and what decides it is how many are already face up.

`threes_and_sevens` survives everywhere, and small. A lone 3 grows into a wait on 1, 2, 4 or 5; a
lone 5 into a wait on 3, 4, 6 or 7. Late release of the first four against the second four is 8.8%
vs 7.9% (coach), 4.8% vs 4.4% and 5.0% vs 4.6% (shanten, two seeds), 15.8% vs 15.0% (money4). About
a tenth more, in the same direction every time, by the mechanism the book gives - the 3 and the 7
reach the edges, and the edges are where tiles are released. Two shanten seeds agree to within
0.3 points everywhere, so the run-to-run noise is well under the effect.

Neither has been played for money and neither should be. This is the suit read again: measured true
and worth teaching is a different finding from worth scoring with, and the coach already prices
waits continuously. The cards say what is true and claim nothing else.

### The wind ordering rule is a null on both populations, and the mechanism says why (2026-09-04)

The last of the four rules NEXT called cheap, and the only one of them still genuinely untested -
the other three were answered on 2026-09-03 and NEXT was stale about them.

The book says that among winds you do not need, you should release first the one belonging to the
player immediately before you. The reasoning is tempo rather than danger. Play advances to the next
seat, so if the player before you pongs your discard the turn jumps to them and the two players in
between are skipped, and you come round sooner. A pong by the player after you skips nobody.

That is a claim about turns, which is why the reads pipeline cannot answer it: its outcome is a
deal-in probability and this one's outcome is draws. `datagen/src/windorder.ts` is the tool, forked
from `valuecopy.ts` because that one is outcome-based too. Every wind thrown is grouped by whose
seat wind it was, as an offset from the thrower, and against each we record how often it was
ponged, by whom, how many seats the claim skipped for the thrower, and the draws and chips the
thrower ended the hand with.

```
                                 20,000 coach hands            20,000 hands of run-money4
                              before me   after me           before me   after me
  winds thrown                   24,873     24,756              30,755     30,540
  ponged at all                   7.46%      7.38%               5.02%      5.03%
  ...by the wind's own owner      2.57%      2.61%               1.72%      1.66%
  seats skipped for me            0.076      0.071               0.051      0.052
  my draws in that hand            9.75       9.76               12.32      12.32
```

Nothing, on either population, at every turn band, on 55,000 wind discards a side. The z on the
pong rate is 0.3 and on the draws it is -0.2.

**The mechanism is where it fails, and that is the useful part.** The rule needs the wind's owner to
want it. They do not. A wind is ponged about 7.5% of the time at a coach table and its owner
accounts for 2.57 of those points - almost exactly a third, which is what three opponents claiming
at random would give. So a seat has no special appetite for its own wind, the skip almost never
happens for the reason the book gives, and the whole chain comes apart at the first link. Even when
it does fire it is worth 0.076 skipped seats a throw, so the tempo it buys is a rounding error
against the eleven draws a hand.

This is a rule about opponent behaviour, so it is worth saying plainly that both populations agree
here, which is not something the last few reads managed. The suit read, the honour wait and
`triplet_adjacency` all split by population. This one is dead in both.

### Our own value tables lose, and the one part worth keeping is the smallest (2026-09-04)

`solver/src/tables.ts` turns a hand into a number of chips. It is auto-generated from the study
author's simulations, it was the largest piece of the coach never checked against anything we
measured, and re-fitting it on our own hands was the first job in NEXT. It is now fitted from all
7,233,486 recorded decisions, played for money four ways, and it loses.

```
  2,000 paired deals a seat on four fresh ranges, shuffle-820001 / 840001 / 860001 / 880001
  32,000 paired deals a row

  scale 2.17    -0.832 +/- 0.082
  scale 3       -0.932 +/- 0.083
  scale 4.3     -0.945 +/- 0.085
  scale 5.5     -1.093 +/- 0.086
```

**The fitted coach plays for the cheap hand, and that is what the loss is made of.** 1,500 deals a
seat, all four seats, from `tools/_cheapshape.ts --arm fitted`:

```
                             scale 2.17    coach       scale 4.3    coach
  won the hand                   24.10%   24.63%          23.60%   24.87%
    ...at the table minimum      50.76%   39.38%          54.73%   44.91%
    ...four fan or more          26.14%   37.69%          21.68%   33.04%
  won with a half-colour hand    17.70%   32.34%          15.89%   28.02%
  won with the cheap hand        32.57%   22.80%          29.17%   23.53%
  reached ready, average turn      32.2     34.1            31.5     33.6
  dealt in                       15.02%   14.83%          14.70%   15.72%
```

It gets ready sooner, wins about as often, and wins smaller. The deal-in rate is the control and it
does not move, so this is a clean change to the value half. It is the `onlycheap` arm in milder
form, and that arm costs 1.928 chips a game, which is why the fitted tables lose and why they lose
more the more of our own numbers they use.

**Why they compress, which is the part worth remembering.** `valuefit.ts` averages what a seat
finally won over every decision where a plan was on top. That is the value of the POSITION under a
coach that switches plans whenever the ranking changes, and it is not what the table is asked for.
The table is asked what a plan is worth if you play for it. The two come apart in proportion to how
often the coach abandons the plan, so the cheap hand converts quickly and keeps its spread while a
late half-colour hand rarely converts and loses four fifths of its. That is a property of the
estimator rather than a fact about mahjong, and it is why fitting realised outcomes made the coach
prefer whatever finishes soonest. Fitting the value of COMMITTING is the version nobody has tried,
and it needs hands generated by bots that pick a plan and keep it.

**The scale sweep was testing a confound rather than the tables.** Our numbers are far smaller than
the study's, so `valuetables.ts` offered one global multiplier and `valueday.sh` swept it. That
assumes the two sets differ by a single gain. `datagen/src/valuerows.ts` checks the assumption
instead of making it, regressing our realised chips on the study's number inside one row - one plan
at one turn - weighted by hands:

```
  table                     turn    hands   slope  1/slope    R2     x
  half_color_chips             0  227,861   0.279     3.59  0.97  0.88
  half_color_chips            20  325,681   0.223     4.49  0.98  0.70
  half_color_chips            40  201,374   0.181     5.51  0.86  0.57
  ping_wu_chips                0   78,801   0.389     2.57  0.96  1.23
  ping_wu_chips               20  116,749   0.310     3.22  0.95  0.98
  ping_wu_chips               40   43,122   0.286     3.49  0.93  0.90
  all_pong_chips               0  109,022   0.289     3.47  0.94  0.91
  all_pong_chips              20   68,999   0.296     3.38  0.92  0.94
  all_pong_chips              40   36,525   0.313     3.19  0.99  0.99
  all_chow_table_10_3_turn0    0   37,944   0.332     3.01  0.48  1.05
  chicken_chance               0   57,047   0.538     1.86  0.99  1.70
  chicken_chance              20  186,518   0.523     1.91  0.97  1.65
  chicken_chance              40   98,511   0.478     2.09  1.00  1.51
```

Two things follow and they point opposite ways.

**Inside a plan the study is right and we have nothing to add.** Our own hands reproduce its
ordering and its spacing at an R-squared of 0.86 to 1.00 in every row but one. So the part of the
re-fit that swaps the study's numbers for ours is swapping numbers that agree for numbers that
agree, and the money says the study's version does it slightly better.

**Between plans they disagree, and no single multiplier can say so.** The rows want scales from 1.86
to 5.51, a spread of three times. Whatever one number is chosen, the cheap hand and a late
half-colour hand end up on different footings and the coach compares plans that are no longer in the
same units. Every variant the sweep played carried that defect.

**So the fit's one real claim was tested on its own, and it is worth chips.** `valuerows.ts --out`
keeps the study's numbers everywhere and multiplies each row by its own slope, normalised so the
hands-weighted average multiplier is one. 128 numbers change and the rows our data cannot speak to,
13 Wonders among them, keep the study's values exactly. What it says is that the cheap hand is worth
about 1.6 times what the study gives it and a late half-colour hand about 0.57 times.

```
  2,000 paired deals a seat, ranges named in the message that launched each run

  first four,  shuffle-940001 / 950001 / 960001 / 970001        +0.132 +/- 0.056
  confirmation, shuffle-980001 / 990001 / 1000001 / 1010001     +0.097 +/- 0.056
  all eight, 64,000 paired deals                                +0.115 +/- 0.040
```

Seven of the eight ranges are positive and so are all four seats, at +0.152, +0.134, +0.049 and
+0.138 over 8,000 paired deals each. A ninth range agrees from a different tool: the shape run on
shuffle-1020001 puts the arm at +0.120 over 6,000 games.

**And the control says the gain is bigger than it looks.** The corrected set comes out about a fifth
flatter than the shipped one, because several things sit outside these tables - the MF2 correction,
the late-turn decay, the value-pair credit, the rows we have no data for. A flatter value side is
arithmetically the same as defending more, so `valuerows.ts --flat` builds the matched control: every
row multiplied by the same constant, chosen so the coach is exactly as decisive as the corrected set
and no more, with the plans left on the study's own footing.

```
  re-weighted rows        64,000 paired deals   +0.115 +/- 0.040
  flattening alone        32,000 paired deals   -0.163 +/- 0.058
  the re-weighting itself                       +0.278 +/- 0.070
```

The flattening loses on its own, which is what the danger sweep predicted and is a second
confirmation of it from a direction that knows nothing about danger. So the correction was paying a
toll it did not need to pay.

**Handing the toll back is what shipped.** `valuerows.ts --gain` raises every multiplier by one
constant, which moves the whole corrected set without touching the weight of one plan against
another. The gain was chosen at 1.35 because `_fitrate` puts the coach's top-two gap at 10.82
chips there against the shipped 11.15 - so it was picked on decisiveness, before any money was
played, rather than tuned on the result.

```
  2,000 paired deals a seat, ranges named in the message that launched each run

  first four,   shuffle-1080001 / 1090001 / 1100001 / 1110001    +0.190 +/- 0.058
  confirmation, shuffle-1120001 / 1130001 / 1140001 / 1150001    +0.210 +/- 0.057
  all eight, 64,000 paired deals                                 +0.200 +/- 0.041     t = +4.9
```

Positive on all eight ranges, and the confirmation came in slightly HIGHER rather than shrinking,
which is what `legalWait` did not do. So this is the second change ever shipped to the coach and
about eleven times the size of the first.

`solver/src/tools/baketables.ts` is the generator that applies it. `tables.ts` carried an
"AUTO-GENERATED" header with nothing behind it, exactly as `reads.ts` did before `bakereads.ts`,
and this is that generator. It reads a pristine snapshot of the study's own numbers at
`knowledge/sources/tables.study.json` rather than its own output, so running it twice is the same
as running it once and the correction cannot compound quietly. `--plain` writes the study's numbers
untouched, and that round-trips the old file exactly, which is the check that the generator is only
applying the correction and not quietly reformatting the book.

**What is left of the original idea.** Almost nothing, and that is the honest summary. Fitting our
own numbers was the plan and it loses about a chip a game. What survived is one constant per table
row, thirteen numbers in all, keeping every one of the study's own values and changing only how
much each plan's spread counts against another's. The rest of the fit measured the wrong quantity.

### The block rule's exception is spotted now, and the split that makes it possible is written down (2026-09-05)

NEXT said three tips could not be tagged: `five_blocks` and `six_blocks_ok` for want of an agreed
block decomposition, and `narrow_can_beat_wide` for want of a tai score. That was stale by a day.
Two of the three had detectors from 2026-09-03, and the tables in the pair-rule write-up above
already carry their numbers. The one genuinely missing was `six_blocks_ok`, and it was missing for a
real reason: the tagger could count blocks but could not say which ones they were, and the tip is
about the two WEAKEST.

**The split is `blocks` in `solver/src/shapetag.ts`, and it is the agreement.** A hand is read as
the most blocks it can be - triplets, runs, pairs, and two-tile pieces that could become runs - and
the pieces are named by the wait they make: `open` for two adjacent tiles, `edge` for 1-2 and 8-9,
`gap` for two tiles with a hole between them. The generous reading is deliberate and unchanged from
the count that was already there, so 2-3-4-5 is two open pieces and not one run. What is new is that
a tie between equally generous readings is settled in a fixed order, sets first, then pairs, then
open pieces, then gaps, so that 2-4-5 is an open piece with a spare 2 and never a gap piece with a
spare 5. Without that order the same tiles could come out as different blocks on different days,
and the tip would fire on a reading rather than on a hand. A test draws 300 random hands and checks
the split always has exactly as many blocks as the old count found.

**The rule and its exception are one detector, and they never fire on the same hand.** With six
blocks on the board and a throw that keeps all six at no cost in distance, the pieces that are not
yet sets or pairs are ranked - open above gap above edge - and the two weakest decide the card. Both
gaps, and it is `six_blocks_ok`: keep the six, throw the spare, let the wall choose. Otherwise it is
`five_blocks`: cut one. The card's own example hand, with a lone honour added, is the test case for
the exception; the same hand with one gap piece made open is the test case for the rule.

Scored against the play-outs, on both packs, after both were rebuilt twice the same day:

```
                            coach pack (run-coach2)       money pack (run-money4)
                          about  resolved  follows  luck   about  resolved  follows  luck
  five_blocks               170     133      54%    56%     175     135      46%    53%
  six_blocks_ok              30      12      58%    51%      43      30       67%    57%
```

`five_blocks` with the exception carved out of it is the same null it was before: 134 of 268
resolved positions cut the sixth block, 50% against 54% by luck, and both tables say it separately.
`six_blocks_ok` keeps the six on 27 of its 42 resolved positions, 64% against 56%, which is z = +1.2
- a lean in the book's direction on both populations and not a finding. It is rare because it needs
a six-block hand, a spare to throw, and the two weakest pieces both gaps, and one discard in two
hundred is that.

**Coverage did not move on the coach pack, and the reason is worth knowing.** It went from 841
tagged discard positions to 840. The 27 positions that left `five_blocks` are the 23 that arrived in
`six_blocks_ok` plus four where the only cutting throw broke an open piece rather than a gap, which
neither card is about. A better split names the shapes more truthfully; it does not make more
positions be about a shape.

Two smaller things came out of doing this. `datagen/src/retag.ts` re-runs the tagger over a pack in
place, in seconds rather than the half hour a rebuild costs, and it found that the money pack had no
tags at all - it was built on 2026-09-01, before the tagger existed - so the money-pack rows above
exist because of it. And `tiptest.ts` had been crashing on `spot.json` since the spotting pack moved
into the same directory on 2026-09-04; it now skips anything that is not a quiz.

### The two cheap sub-claims: the 2-or-8 exception is wrong, and the second discard pile is real once "declined" means "could have claimed" (2026-09-05)

The 2026-09-03 reads write-up left two things open. Both are answered in `datagen/src/reads.ts` on
the same two populations as before, with the ranges named before launch: 25,000 hands the coach
played against itself on a fresh wall seed, 29 rather than the 11 used then, and the first 25,000
hands of `run-money4` replayed. Logs are `data/gen/reads4-coach.log` and `reads4-money4.log`.

**The exception to `pair_discards_rule_out` is wrong on both tables.** The book says a shed pair of
2s or 8s leaves the terminal beside it live, because a double-pair wait on the 1 or the 9 survives
throwing the 2s. Each row here is a tile beside a shed pair against tiles of its OWN class sitting
away from any shed pair, because a terminal deals in less than a middle tile whatever anyone threw:

```
                                            coach, seed 29              run-money4
  the 1 or 9 beside a shed pair of 2s/8s   0.220% vs 0.399%  x0.55     0.114% vs 0.185%  x0.62
  the 3 or 7 on the other side of it       0.520% vs 0.751%  x0.69     0.270% vs 0.348%  x0.78
  a middle tile beside any other pair      0.376% vs 0.751%  x0.50     0.239% vs 0.348%  x0.69
```

The terminal beside a shed 2 or 8 is discounted exactly as much as any other neighbour, at z = -3.5
and -2.3. Nothing is left live. The main rule reproduces on the fresh seed - one rank away is x0.55
against coaches and x0.72 on the recorded run, against x0.69 and x0.72 on 2026-09-03 - so the rule
stands and the exception goes. The card says so.

**`two_discard_piles` is real, and the 2026-09-03 measurement missed it by not asking who could
claim.** That measurement tagged a tile `passed` if any copy had gone past the seat uncalled, and
found it no safer than the tile simply being on the floor. The book's claim is narrower: the tile
went past when they could have TAKEN it. So the tag now needs the seat to have been eligible under
the rolling rule, and it splits by what was on offer: a tile thrown by the seat before them could
have been chowed, and one thrown by anybody else could only have been ponged. Only tiles that
passed exactly once carry a tag, because a tile that has passed twice is safer for having two
copies gone and would flatter whichever tag it landed in. Deal-in rate to that seat, pooled over
the hand:

```
                                     coach, seed 29        run-money4
  passed once, a chow was on offer      0.230%               0.166%
  passed once, only a pong              0.517%               0.261%
  never thrown                          0.655%               0.314%
  chow against pong                     x0.44  z=-19.4       x0.64  z=-11.3
  chow against never thrown             x0.35                x0.53
  pong against never thrown             x0.79                x0.83
  the plain on-the-floor discount       x0.43-0.49           x0.51-0.60
```

Same direction on both populations, every turn band, and the size is a third to a half. The
comparison that matters is the last three lines. A tile that passed from the player on their left
is safer than the ordinary already-thrown discount says; a tile that passed from anywhere else is
markedly LESS safe than that discount says. The second discard pile is not the discard pile after
all. It is one third of it, the third the seat could have chowed, and the other two thirds carry
less information than a copy on the floor is usually credited with. That is the first read measured
here that sharpens the on-the-floor discount rather than restating it.

The mechanism is the one the book gives. A suited tile deals in mostly by completing a run, and a
seat that declined a chow on it has no two-tile piece it completes. A declined pong only says they
had no pair of it, which rules out much less.

**The book's own wording does not help.** Restricting the read to a tile in the suit the seat
visibly concentrates in, which is the "obviously complete their visible shape" of the tip, gives
x0.49 and x0.67 for chow against pong on a fifth of the sample, no sharper than the general form.
The shape you can see from the melds adds nothing to what claim eligibility already says.

**One control failed and is reported as such.** A `blind` tag was meant to catch tiles that passed
when the rolling rule forbade the claim, as the case where declining means nothing. It is tiny, 9,000
rows against 660,000, and it is not clean: a tile that passed a seat exactly once while forbidden is
nearly always one whose other copy was claimed into somebody's meld, which makes it safe for a
different reason. The chow-against-pong comparison does not need it, since both sides are tiles that
passed once while claimable and differ only in who threw them.

**Not priced, and not proposed for pricing.** Five danger-side changes have been played for money
and none paid, and the reason FINDINGS reached for them - the coach already prices every discard
continuously and a better deal-in probability swaps one nearly-equal throw for another - applies to
this one too. It goes on the Tips card as a read to learn. If the standing rule is ever revisited,
this is the read to try first, because unlike the five it does not restate a discount the coach
already has.

### Rebuilding the packs doubled the money pack's teachable questions and did nothing for the coach pack (2026-09-05)

NEXT gave two reasons to rebuild the quiz packs. One of them was wrong. The coach's OPINION beside
each question is computed live by the app from the hand, so it was never stale in the pack file and
a rebuild could not refresh it. The only real reason was tag coverage.

**On the coach pack the rebuild changed nothing: 840 tagged questions, the same 840, tip for tip.**
The prediction beforehand was 1,000 to 1,050, and it was wrong for a reason that is now measured.
The trim keeps tagged questions first, and every tagged candidate was already fitting: 840 tagged
among the 10,619 candidates that `OVERDRAW` draws, all of them kept. A tagger that names more shapes
does not find more taggable positions. The estimate came from the base rate among DISCARD positions,
9.8%, when candidates include claim and self decisions that can never carry a shape tag; across all
candidates it is 7.9%, and 7.9% of 10,619 is the 840 already there.

**On the money pack it doubled, 399 to 796.** That pack was built on 2026-09-01, before the tagger
existed, so it had never been filled tagged-first at all - the 399 were what a random draw happens
to contain. The rebuild is worth having for the sample sizes alone: `bad_wait_ranking` goes from 4
resolved positions to 21, `triplet_adjacency` from 32 to 71, and the pooled table below is the first
time most of these tips have been scored on more than a handful of positions from one population.

`tiptest.ts` now prints that pooled table, because every write-up since the tagger existed has had
to add two packs together by hand:

```
  tip                    about  resolved   follows it   by luck     z
  escape_single_waits      609       594          89%       47%   +20.7
  pair_rule                554       400          30%       66%   -16.0
  five_blocks              262       202          51%       54%    -1.1
  threes_and_sevens        161        88          50%       50%    +0.1
  triplet_adjacency        155       121          27%       42%    -3.5
  narrow_can_beat_wide      54        53          91%       50%    +5.9
  six_blocks_ok             53        28          68%       53%    +1.6
  bad_wait_ranking          27        25          56%       50%    +0.6
  edge_waits_stronger       27         6          33%       53%    -1.0
```

Nothing here reverses. `escape_single_waits` and `narrow_can_beat_wide` hold at more than twice the
sample. `pair_rule` fails harder. `triplet_adjacency` now has 121 resolved positions and fails at
z = -3.5, where on the old money pack alone it looked mildly positive at +0.9 - the coach population
is what turned it, which is the fourth read to split by who is at the table. `threes_and_sevens` is
exactly a coin. The two wait tips still resolve too few positions to say anything, and
`edge_waits_stronger` has six.

**The lever for coverage is `OVERDRAW`, not the tagger.** It is how many candidates each stratum
draws for every question it keeps, currently 2.5, and the tagged rate among candidates is flat at
about 8%, so tagged questions scale with it almost exactly. Doubling it to 5 should give roughly
1,600 to 1,700 on the coach pack, capped in the strata that have already exhausted their decisive
pools - early discards are at 100% of theirs. The cost is pass 2, which replays every candidate
hand, so about 50 minutes a pack instead of 25. It is not free in kind either: it would make about a
third of the Real Quiz be about a named shape, against a sixth now and 8% drawn straight, and 2.5 is
a deliberate balance rather than an accident. That is a decision about what the quiz IS, so it is
left open rather than taken here.

One bug fixed on the way. `quizpack.ts` rebuilds `index.json` by scanning the output directory for
JSON, and `spot.json` moved into that directory on 2026-09-04, so the first rebuild after that date
would have put a phantom "spot" pack in the Real Quiz picker with an undefined question count. It
now skips anything without questions. This is the second thing that broke the same way in two days -
`tiptest.ts` was crashing on the same file - and the shared cause is that the spotting pack lives
beside the quiz packs while not being one.

### OVERDRAW raised to 5, which is what actually bought coverage, and the pack composition did not move (2026-09-05)

The rebuild earlier the same day settled that the tagger was never the constraint on how many quiz
questions can teach a shape tip. The candidate draw is, so `OVERDRAW` went from 2.5 to 5 and both
packs were built again. It is a flag now rather than a constant, so `--overdraw 2.5` reproduces the
old draw.

**Tagged questions, per pack, at each setting:**

```
                     coach (run-coach2)        money (run-money4)
  overdraw 2.5            840                        796
  overdraw 5.0          1,410                      1,220
```

Candidates went from 10,619 to 18,802 on the coach run - not the full doubling, because two strata
had already exhausted their decisive pools at 2.5 and cannot draw more - and tagged questions rose
almost in step with the candidates, which is what the flat 8% tagged rate predicts. The spotting
drill, which is built from the coach pack, goes from 407 positions that can ask a shape question to
536 of 965.

**The gain is broad rather than concentrated in the common tags.** The worry was that a more
aggressive tagged-first trim would fill the pack with the two tips that fire most, since
`escape_single_waits` and `pair_rule` are three quarters of everything tagged. They stayed at three
quarters. The tips that gained proportionally most are the rare ones the project could never say
anything about: pooled over both packs, `narrow_can_beat_wide` goes from 53 resolved positions to
119, `triplet_adjacency` from 121 to 205, `bad_wait_ranking` from 25 to 39.

```
  tip                    about  resolved   follows it   by luck     z
  escape_single_waits     1096      1061          90%       47%   +28.7
  pair_rule                814       592          28%       68%   -21.4
  five_blocks              345       268          50%       54%    -1.5
  triplet_adjacency        254       205          24%       43%    -5.8
  threes_and_sevens        251       142          57%       50%    +1.7
  narrow_can_beat_wide     121       119          91%       50%    +8.9
  six_blocks_ok             73        42          64%       56%    +1.2
  edge_waits_stronger       42        11          45%       53%    -0.5
  bad_wait_ranking          41        39          59%       50%    +1.1
```

Nothing reverses at the larger sample and nothing new clears. `triplet_adjacency` hardens into a
real failure at z = -5.8, and it splits by population exactly as the reads did - 12% following at a
table of coaches against 34% on the recorded run - which is now the fifth claim to do that.
`six_blocks_ok` did not grow more convincing as its sample grew, which is the honest thing to say
about it. `edge_waits_stronger` still resolves eleven positions and is not going to be settled this
way.

**The composition did not move at all, and checking that caught a reporting bug.** The build log's
`phase mix: pack [...]` line appeared to swing from 30% early to 21%, which is precisely the skew
that stratum keys were added on 2026-08-31 to prevent. It is not real. That line was computed over
`questions`, every candidate materialised in pass 2, rather than over the pack, and since OVERDRAW
arrived on 2026-09-03 the candidates have been two to four times the pack - so it has been reporting
the candidate mix under the word "pack" and drifting whenever the draw changed. Measured on the pack
files themselves, both settings give byte-for-byte the same strata: early 41%, mid 43%, late 16% on
the coach pack, matching the run exactly, and identical counts in all nine strata. Only WHICH
question fills each slot changed. The line now reads `kept` and says what it claims to say. The
2026-08-31 entry that quotes this number is unaffected, because it predates OVERDRAW, when the
candidates and the pack were the same thing.

**What it costs.** About 45 minutes a pack against 25, and the Real Quiz is now 28% questions that
are about a named shape, against 17% at 2.5 and roughly 8% drawn straight. That over-representation
is the deliberate part - a tip can only be taught on a position it is about - but it is worth
restating that the pack has never been a random sample of the game and is now four times less like
one on this axis. Every question in it is still a real decision that was played out 128 times, and
nothing is selected on what the answer turned out to be.

### The five block tips are testable now, and three of them are right, one is wrong and one settles nothing (2026-09-05)

`linked_blocks`, `sandwich`, `stepping_stones`, `perfect_one_away` and `sticky_one_away` were all
marked confirmed on the strength of counting a hand we made up. None had ever been put in front of a
play-out. They all needed the same thing first, a hand split into named blocks, and that arrived
earlier the same day, so they are done together.

**One of them needed a second way of reading a hand.** The generous split counts 4-5-6-7 as two
pieces to choose between, which is right for asking how many blocks you are carrying and useless for
asking which of your runs is finished - under that reading no hand ever holds a completed run,
because pulling one apart always counts higher. So `setBlocks` reads the same tiles the other way,
sets first and blocks second. Two honest answers to two different questions, and a detector has to
say which one it is asking. `perfect_one_away` and `linked_blocks` use the set-first reading; the
other three use the generous one.

Scored on both packs, pooled:

```
  tip                    about  resolved   follows it   by luck     z
  perfect_one_away          74        39          85%       28%    +8.0
  stepping_stones           21        21         100%       36%    +6.5
  sticky_one_away           20        15          87%       49%    +3.0
  linked_blocks             16         2          50%       71%    -0.7
  sandwich                  15        11           9%       55%    -3.1
```

**`perfect_one_away` is the strongest new result.** Two sets, a pair and two two-sided waits, with a
tile left over: throw the leftover rather than tidying away a wait. The measured best does that 33
times in 39, against 28% by luck, on both populations separately. The baseline is the interesting
half - the tempting throw outnumbers the right one three to one, so this is not a decision anybody
gets right by accident.

**`stepping_stones` has the only perfect record on the page.** In a hand with no pair, a tile sitting
between two part-runs is doing two jobs and looks spare. Twenty-one positions, twenty-one times the
measured best kept it, against 36% by luck. Twenty-one is not many, and it is rare for a reason worth
knowing: a hand with no pair anywhere is uncommon by the middle of a hand.

**`sticky_one_away` holds, with a condition the card did not state.** Six blocks and the surplus is a
second pair against a two-tile piece: break the pair. Thirteen of fifteen, 87% against 49%. The
condition is that the piece must finish from either side. A 7-9 or an 8-9 waits on one tile, exactly
like the pair, and the card's reason for preferring it is gone - the detector was written the loose
way first and fired 144 times against 7, most of them positions where the advice named nothing.

**`sandwich` fails, and the reason may be in the card's own numbers.** The book's shape is a pair, a
gap, a single, a gap, a pair, and its claim is that four kinds of tile turn it into a set and a pair.
That is exactly true. As advice it loses: the measured best threw the middle tile, the one the card
says to keep, ten times out of eleven. Both populations agree and eleven is a small sample, so it is
a warning rather than a verdict. What we did not notice when the card was written is that five tiles
are producing one set and one pair, which two ordinary blocks do with four. The extra tile buys the
four kinds. At this table that does not look worth it. That is a hypothesis and nothing here tests
it.

**`linked_blocks` settles nothing, and it was built so that it could not settle it dishonestly.** The
card's premise is that the count cannot separate the two blocks, so the detector fires only where the
acceptance really does come out equal between a block sitting against a finished run and a lone one.
Across both packs that happened 16 times and resolved 2. Anything the count can separate is a
question about width and `escape_single_waits` answers it. The claim stays proved by counting and
untested in play, which is the honest place for it.

The tagger now names fourteen tips. The coach pack goes from 1,410 tagged questions to 1,448 and the
money pack from 1,220 to 1,240, and the spotting drill can ask a shape question on 541 of 965
positions against 536. Those are small because the five new tips are all rare. `_shapehunt.ts` is
the tool that finds real positions for a detector, and every test for these five is a hand somebody
actually played rather than one invented to pass.

### Eight more rules measured against the packs, and the baseline that was wrong all along (2026-09-05)

The calling tips went the same day, and this is the same trick pointed at the throws: a filter per
rule over the graded discard positions, 8,226 of them across both packs. `datagen/src/discardtest.ts`
is the tool, `datagen/src/packlib.ts` holds the scoring both it and `calltest.ts` use, and it runs
in three seconds. Two things had to be built first, and both of them changed answers.

**The first was a bug that a known result caught.** The obvious control - how often is the widest
throw the best one - came back at 6% against 20% by luck, in a project whose best-evidenced tip is
that the play-outs take the wider wait 89% of the time. That contradiction is the only reason it was
found. Acceptance may only be compared between hands the same distance from ready, and a hand one
step FURTHER out accepts far more tiles, so "the throw with the largest acceptance" was picking
whichever throw wrecked the hand most. Restricted to throws that cost the hand nothing, the widest
throw is best 54% of the time against 37%. A second version of the same mistake: distance and width
belong to the hand you are LEFT with, and reading the wait off the fourteen tiles in front of you
disagrees with the best wait a throw can leave in 2,064 of 4,815 ready positions. Distance survives
that reading, differing 87 times in 8,226; width does not.

**The second was the baseline, and it was wrong for every verdict on the page.** `tiptest.ts` scores
a tip against the coin its own split implies, and its header names exactly the danger that leaves
open - a tip pointing at loose tiles looks right because loose tiles are what a hand throws anyway -
but the correction it applies equalises how MANY tiles sit on each side, not what those tiles are.
Nothing had ever measured the size of that. Now it has:

```
a throw that costs the hand no distance    best 85% of the time   (34% by luck)
a spare tile no block wants                     69%               (24%)
the throw with the lowest deal-in               51%               (20%)
the widest throw among those costing nothing    54%               (37%)
```

So `fitNull` in `packlib.ts` fits P(this throw is the best one) from things a beginner can read off
the table - does it cost distance, does any block want it, is it an honour, a terminal or a simple -
and every rule is now scored twice, against the flat coin and against that. The fitted table is the
useful object on its own: a spare simple tile that costs nothing is best 38% of the time, a block
simple tile that costs a step 2%.

**Four verdicts already on the page were wrong, and `audit.ts` re-ran all fourteen.**

```
tip                    resolved   follows   flat z   matched z
escape_single_waits        1061      90%     +28.7      +25.8
pair_rule                   592      28%     -21.4       +0.8
five_blocks                 268      50%      -1.5       +1.7
triplet_adjacency           204      24%      -5.8       -1.5
narrow_can_beat_wide        119      91%      +8.9       +6.7
perfect_one_away             39      85%      +8.0       -0.1
stepping_stones              21     100%      +6.5       +2.7
sandwich                     11       9%      -3.1       -3.5
```

`pair_rule` was published as a failure and is a null: the tile it warns against throwing is the
loose one, and once the baseline knows that, it comes out 0.8 standard errors high. `perfect_one_away`
was published at z = +8.0 as one of the four best-evidenced tips, and every throw it warns against
breaks a wait and costs a step, which is the measured best 2% of the time whatever the position - so
the expected rate is 85% and the measured rate is 85%. Its advice is still right; the claim on the
card that you would not get it right by accident is not. `triplet_adjacency` softens from a strong
failure to an ordinary null, and `stepping_stones` from 21 for 21 at z = +6.5 to +2.7. What survives
untouched is `escape_single_waits`, which stays the best-evidenced thing on the page by a distance,
along with `narrow_can_beat_wide` and `sticky_one_away`.

**Of the eight new rules, one is confirmed, five are contradicted and two are restatements.**

`flush_decided_early` is the one that survives everything. Early, holding ten or more of one suit
plus honours, the measured best is a throw outside that suit 71% of the time against 23% by luck and
29% matched, which is 14.9 standard errors on 221 positions. Two controls hold it up: throwing a
spare inside those same hands scores only 50%, and the same choice with seven or eight of a suit
comes out 4.4 standard errors LOW, so the bar the card names is doing real work.

`break_mediocre_ready` fails on its own condition. Ready on four live tiles or fewer, giving the
hand up is best 8% of the time; ready on eight or more, where the card says keep, 12%. The card's
condition carries no information at all, and both figures sit near the 15% at which costing yourself
distance is right in general.

`withhold_safe_tiles` and `terminal_triplet_release` fail for one shared reason worth stating on its
own. Both argue that a tile is safe because nobody can hold a pair of it - the last copy of a
passed tile, or a terminal you hold all three of. Measured directly from the play-outs, the last
safe copy deals in 9.04% of the time against 9.95% for an average throw, and the terminal triplet
10.68% against 10.71%, where the safest throw actually available is 4.83% and 5.52%. Ruling out a
pair wait and a pong removes almost none of the danger, because a suited tile deals in mostly by
completing a run. That is the same mechanism the second discard pile read turned on, arrived at from
the opposite direction.

`squeeze_the_caller` looked real and is not. Throwing what the committed seat after us cannot chow is
best 38% of the time against 30% - but the identical split aimed at a committed seat that is NOT
next to us, where the chow argument cannot apply, scores 37% against 26% on a larger sample. What
works is throwing honours at a committed player. The card's own idea contributes nothing.

`one_turn_is_not_the_fight` is contradicted at 4.9 standard errors matched: where the safest throw
costs half the hand's width, the play-outs take the safety. `not_the_third_fighter` is contradicted
by its own gradient - taking safety over width is best 40% of the time with nobody committed, 36%
with one, and 33% with two, so it is least right exactly where the card reaches for it, which agrees
with the earlier finding that turning the coach's caution up loses steadily. `keep_floaters` leans
the card's way at 1.6 standard errors on 60 positions and is not settled.

**What this costs.** The filters for these eight are ours, written out in the tool beside each rule,
so they have failed or passed as we stated them. And the matched baseline is a strong null on
purpose: it will not credit a rule for saying "do not wreck your hand", which is still good advice
for a person even when it is not a finding about this table. That is the distinction the two z
columns are there to keep visible.

### Eight reads measured by replay, and one of them reverses between populations (2026-09-05)

Eight cards on the Tips page claim that some public signal tells you about a hidden hand. None could
be settled by counting tiles and none needed a play-out either - they need hands where somebody
knows the answer, which is what a replay is. `datagen/src/tells.ts` walks 20,000 recorded hands and
10,000 coach hands with a recorder attached, and at every throw it compares what is public about
each seat with what that seat is really holding. Both populations, always, because this project has
already had a read reverse between them.

**`discard_provenance` is real and backwards.** The card says a tile thrown from the hand is more
informative than the one just drawn. Split every seat by where its last throw came from and ask how
often it is one tile away: a seat that threw what it had just drawn is ready 25.5% of the time
around turn 30 against 16.4% for a seat that threw from its hand, and 28.7% against 23.0% at a coach
table. Same direction at every turn on both populations. The mechanism is obvious once measured - a
finished hand has nothing left to rearrange, so it throws whatever it draws - and the card names the
wrong throw as the informative one.

**`wall_reading` is the best of the batch.** A tile one rank away from something a seat threw in the
first dozen turns is held by that seat 14.2% of the time late in the hand, against 21.6% for a tile
of the same suit three or more ranks away; on the recorded hands, 22.2% against 32.6%. Two ranks
away sits in between on both populations, at 18.1% and 25.5%. The same-suit control is what makes it
a finding rather than a suit tell - it is the neighbours specifically, not the suit. There IS a suit
effect on top at a coach table, 21.6% against 34.3% for another suit, and none at all on the
recorded hands, which is the two populations behaving exactly as their bots do.

**`concealed_kong_signal` reverses between populations, which is the useful result.** On the
recorded hands a seat that declared a concealed kong is ready more often than one that has not:
13.2% against 10.2% around turn 20. At a coach table it is the other way at every turn: 7.8%
against 9.5% at turn 20, and 29.1% against 33.3% at turn 40. Both arguments are sound - four tiles
spared for one set means a developed hand, and it also spends the flexibility a hand needs - and
which one wins is a fact about who is at the table. It goes on the card as a signal not worth
carrying rather than as a threat.

**Three more are contradicted outright.** A seat that shed a dragon or seat-wind pair is ready 16.0%
of the time against 17.2% for one that did not, level or slightly the wrong way at every turn on
both populations, so `discarded_value_pair` is nothing. `fear_the_chaser` is firmly backwards: the
first seat to reach ready wins 65.1% of coach hands, the second 43.4%, anyone later 32.8%, and on
the recorded hands 54.6%, 39.3%, 33.1%. Its mechanism does show up - a later committer collects 19.8
chips when it wins against the first mover's 18.1, so chasers really do hold better hands - and it
is nowhere near enough. And `middle_tile_hands_undefended` is a flat null: seats holding nothing but
middle tiles at turn 24 deal in 12.7% of the time against 15.4% for seats holding four or more
non-middles, which is the wrong way round, and every bucket on the recorded hands sits at 10.5%.

**`last_chance_timing` is right about the tile and wrong about the clock.** When three copies are
accounted for, the last one deals in about half as often as an ordinary tile at every single turn:
0.40% against 0.74% around turn 20 at a coach table, 1.82% against 3.72% at turn 40. Its absolute
danger climbs as the hand runs on, which is what the card noticed, but everything else's climbs
faster, so relative to what it competes with the last copy gets SAFER late. This is the third
finding this week whose mechanism is that suited tiles deal in mostly by completing a run: three
copies accounted for kills the pair wait and the pong, and the run wait does not care.

**`value_from_melds` is right at the top and wrong at the bottom.** Counting a dragon or seat-wind
triplet and each visible flower or animal as one tai, a seat showing three or more wins 28.4% of
coach hands and collects 24.4 chips when it does, against 22.1% and 15.3 for a seat showing one.
More visible tai really does mean a bigger bill, on both populations. What fails is the advice to
feed the cheap-looking hand: the seat showing NOTHING is the second most expensive on the board,
18.8 chips at a coach table and 16.1 on the recorded hands, because a hand with nothing exposed is a
concealed hand. Read the melds upward, and never read an empty table as safe.

**What these are not.** They are counts over sampled positions, not play-outs, so none of them says
what a read is WORTH. Five danger-side changes have been played for money and none paid, so these go
on the page as reads to learn.

### The value of COMMITTING, measured at last, and the standing explanation was wrong at the important end (2026-09-05)

The re-fit of `tables.ts` lost by 0.832 to 1.093 chips a game, and FINDINGS gave a reason: `valuefit.ts`
averages what a seat finally won over every decision where a plan was on top, which is the value of
a POSITION under a coach that abandons a plan the moment the ranking changes, while the table is
asked what a plan is worth if you play FOR it. The stated consequence was that a late half-colour
hand rarely converts and so loses four fifths of its spread. The stated fix was hands generated by
bots that pick a plan and keep it. Those hands now exist and the explanation does not survive them.

**The machinery.** `Context.onlyTarget` restricts the coach to one plan and never lets it switch,
following the same fallback rule as the `noCheap` and `onlyCheap` flags beside it - the filter never
empties the plan list and it wants the plan armed rather than merely listed. `PlanBot` wraps it, and
five `plan_*` bot types put it in the generator, kept out of the personality pool because a seat
that cannot abandon a hopeless plan is a measuring instrument rather than a player. `valuefit.ts`
gains a third conditioning, `committed`, which files a decision under the plan the seat was ASSIGNED
before the deal instead of the one currently on top. The assignment is what makes it unbiased: the
plan is not chosen because the hand suited it.

**It bites, and it costs what it should.** One locked seat against three coaches, 400 hands an arm:

```
                won    reached ready   chips/hand   suits held   triplets   honours
  coach        26.5%       48.0%          +1.44        2.53        0.78      1.92
  half_color   18.5%       30.8%          -0.03        2.08        0.89      3.53
  ping_wu      26.0%       49.8%          +1.70        2.62        0.72      1.67
  all_pong     19.0%       38.5%          -2.00        2.85        0.87      1.24
  chicken      17.5%       41.0%          -2.17        2.75        0.73      1.49
```

A locked half-colour seat ends on one fewer suit and two more honours; the all-pong and cheap seats
lose two chips a hand. `ping_wu` barely differs from the coach, which is a fact about the coach: its
default play is close to all-chow already.

**Two runs of 20,000 hands each, one locked seat, three coaches.** Both conditionings are then
measured on the SAME hands against the pristine study snapshot, which needed a `--study` flag in
`valuerows.ts`: the shipped tables now carry a row multiplier fitted from `pursued`, so re-running
that conditioning against them returns 0.235 in every row by construction, which means nothing. The
control is the first row - `pursued` on the original coach run reproduces the published figures
exactly.

```
                             turn 0   turn 20   turn 40
  half_color, pursued (old run)  0.279     0.223     0.181
  half_color, pursued (new run)  0.274     0.250     0.179
  half_color, COMMITTED          0.209     0.217     0.178

  all_pong,   pursued (new run)  0.287     0.297     0.347
  all_pong,   COMMITTED          0.363     0.355     0.330
```

**The late row is exactly where the switching estimator put it.** Half-colour at turn 40 comes out
at 0.178 committed against 0.179 pursued, on 19,428 and 35,788 hands. The compression that the whole
explanation rested on is not an artefact of abandoning the plan: it is a fact about a half-colour
hand late in a hand. Anyone re-opening this should stop looking for it there.

**What IS an artefact is the turn trend, and it lives at the early end.** Under `pursued` the two
plans trend in opposite directions - half-colour falls 35% from turn 0 to turn 40, all-pong rises
21% - and under commitment both are nearly flat, 0.209/0.217/0.178 and 0.363/0.355/0.330. The
mechanism is selection rather than abandonment: early in a hand the coach only has a plan on top
when the hand already suits it, so the study's ordering predicts realised chips more steeply than
committing to that plan from a random hand does. Take the selection away and a plan's slope barely
moves with the turn.

**What this means for the row scaling that shipped.** `valuerows.ts` fitted one multiplier per row
from `pursued` and it won +0.200 +/- 0.041 chips a game over 64,000 paired deals. Those multipliers
carry a turn structure - 0.88, 0.70, 0.57 across half-colour's three rows - that this measurement
says does not reflect the value of committing at all. Both can be true: a change can win money for a
reason other than the one it was built on, and that is worth knowing about something already
shipped. What commitment does say is that the plans sit on different footings from each other -
all-pong's spread is worth about 1.75 times half-colour's, flat across turns - and building a table
from committed slopes and playing it for money is the experiment this now points at. It has not been
run.

**What this cost and what it did not.** Two 20,000-hand runs at about 53 hands a second, seven
minutes each, plus 40 seconds a fit. The cheap version of this experiment was available the whole
time the expensive explanation was standing.

### The committed-slope table wins money, by half what the shipped one did (2026-09-05)

The commitment measurement above said the two conditionings disagree about how much each plan's
spread is worth, and that a table built from committed slopes was the experiment it pointed at.
That table now exists and has been played.

**Five runs, one per plan.** 20,000 hands each, one seat locked to the plan and three coaches
around it, about seven minutes a run: `plan-hc`, `plan-ap`, `plan-pw`, `plan-ch`, `plan-ac`.
`datagen/src/mergecells.ts` pools the five cells files, since a run can only produce `committed`
cells for the one plan its locked seat was playing. The multipliers the two conditionings ask for
are not the same table:

```
                SHIPPED (pursued)            COMMITTED
                t0     t20    t40         t0     t20    t40
  half_color   0.88   0.70   0.57        0.68   0.70   0.58
  ping_wu      1.23   0.98   0.90        1.46   1.08   0.88
  all_pong     0.91   0.94   0.99        1.18   1.15   1.07
  all_chow     1.05     -      -         1.78     -      -
  chicken      1.70   1.65   1.51        1.61   1.07   1.20
```

Committing moves weight off the cheap hand late and off half-colour early, and onto all-pong and
all-chow. The prior going in was the opposite of what happened: chicken's committed slopes are high
in isolation, and this project knows for certain that playing for the cheap hand loses 1.928 chips a
game, so the fear was a table that pushed the coach cheap. Measured against the shipped multipliers,
which are already high on chicken, the committed set actually pulls the cheap hand DOWN.

**The gain was picked on decisiveness before any money was played**, the same way 1.35 was. The
shipped tables put the coach's top-two plan gap at 10.92 chips; the committed set reaches 10.90 at a
gain of 1.30, against 8.90 at gain 1 and 11.24 at 1.35. At that gain it changes the coach's plan on
9.4% of discards and its throw on 7.9%, so it is a real change rather than a constant.

**Eight ranges, named in the message that launched the first run, none of them ever played before.**
The opponent is the CURRENT shipped coach, so this asks whether the committed table beats what we
ship, not whether it beats the study.

```
  2,000 paired deals a seat, all four seats, 8,000 paired deals a range

  first four     shuffle-1200001  +0.088    1210001  +0.235    1220001  -0.025    1230001  +0.133
  confirmation   shuffle-1240001  +0.166    1250001  +0.058    1260001  +0.093    1270001  +0.072

  first four,   32,000 paired deals   +0.108
  confirmation, 32,000 paired deals   +0.097
  all eight,    64,000 paired deals   +0.102 +/- 0.043     t = +2.4, positive on 7 of 8
```

The confirmation came in level with the first four rather than shrinking, which is the property
`legalWait` failed and the row scaling passed. It is half the size of the shipped change and at
half its t.

**What the win is made of.** 1,500 deals a seat on shuffle-1280001, 6,000 games, the tested seat
only:

```
                             committed    coach
  won the hand                  26.45%   24.80%
    ...chips per win             18.05    19.26
    ...at the table minimum     46.44%   42.14%
    ...four fan or more         31.82%   35.69%
  reached ready                 49.60%   46.87%
    ...average turn               32.2     33.0
  dealt in                      15.65%   15.32%
    ...chips per deal-in         -15.34   -15.78
  won with a half-colour hand   19.41%   26.34%
  won with the cheap hand       19.16%   21.57%
```

It wins more often and smaller, and gets ready more often and most of a turn sooner. The danger side
is the control and it very nearly holds still: deal-ins are 0.33 points higher and each one costs
0.44 chips less, both inside the noise of 6,000 games, so this is a change to the value half and not
a bought-back-by-defence result. A smaller 1,200-deal run of the same tool had the deal-in rate dead
level at 15.40% against 15.38%; the honest version is "does not move much", not "does not move".

The direction is worth staring at, because it is the SAME direction the fitted tables took when they
lost a chip a game: fewer half-colour hands, more wins at the table minimum. The difference is what
it buys. The fitted arm gave up half-colour and won no more often, so it simply won less; this one
gives up rather less half-colour and converts it into a win rate 1.65 points higher. A trade that
narrow could plausibly go the other way on a table that plays differently, and nothing here has been
measured against anything but the coach.

**Eight more ranges, and it baked (2026-09-06).** t = 2.4 on eight ranges was below the bar the last
change cleared, so before anything else a rule was fixed and eight more ranges were named: bake if
the second eight are positive on their own AND all sixteen pool to t >= 3. Ranges 1290001..1320001
and 1330001..1360001, none played before, same table, same gain:

```
  first eight     shuffle-1200001..1270001    64,000 paired deals   +0.102 +/- 0.043   7 of 8
  second eight    shuffle-1290001..1360001    64,000 paired deals   +0.099 +/- 0.043   6 of 8
  all sixteen                                128,000 paired deals   +0.101 +/- 0.031   t = +3.3, 13 of 16
```

The second eight reproduced the first to three thousandths of a chip, which is the confirmation
shape nothing here has shown before - `legalWait` shrank, the row scaling grew slightly, this one
held level. Both halves of the rule passed and `baketables.ts` now reads
`knowledge/sources/fitted/tables-committed-g1.30.json` by default. Checked the strict way: `_fitrate`
against the committed file reports zero plan changes and zero throw changes, so the shipped coach and
the file are the same thing. This is the third change ever shipped to the coach, worth half the
second. The one row to watch is ping-wu, whose committed slopes fall with turn on the smallest sample
of the five plans; see NEXT.

### Two tips built to order, because real play never produces them (2026-09-05)

`pon_over_chii` and `linked_blocks` could not be scored from the packs: both together offer a pong
and a chow on the same tile 9 times and fire the linked-blocks detector 16 times, and no amount of
sampling real play fixes a shape that real play does not produce. `datagen/src/buildrare.ts` makes
the position instead. It replays a recorded hand to a decision and swaps tiles between one seat's
concealed hand and the hidden part of the wall until that seat holds what the tip needs - nothing
public changes, no tile instance is duplicated because a swap trades places in the wall's full
permutation - and then grades the decision with exactly the packs' grader: sampled, shanten policy,
128 play-outs, seed 41, adaptive, coupled. The grader determinizes everything but the acting seat
anyway, so the one hand is all that has to be right.

Two things about the method were caught before they cost anything. The first version overwrote a
wall slot instead of swapping, which the grader's determinize step refused with a count mismatch.
And the first run built 300 positions from 9 hands, which is nine walls measured many times over
rather than 300 samples, so positions are now capped at two per recorded hand and spread over
hundreds of hands. Templates for `linked_blocks` are harvested from the packs - the real hands the
detector fires on, rotated through the suits, which keeps every count identical - after three
hand-written ones failed to fire it at all.

**`pon_over_chii`: there is no default.** 600 built positions a population, 150 hands each, only
suited tiles offered so the card's dragon-and-seat-wind exception never applies:

```
                         resolved   took the pong   by luck     z
  coach table                147          41%          43%    -0.4
  recorded hands             157          38%          43%    -1.4
```

The play-outs prefer the pong no more often than a coin would, on either population, and lean
toward the chow if anywhere. The card's argument is about what is left in hand to defend with; at
this table that does not show up as a preference.

**`linked_blocks`: leans one way on one population, and is still not a finding.** 600 built a
population, and the detector resolves about one in six because where the count is level a third
tile is usually best:

```
                         resolved   kept the block on the run   by luck     z
  coach table                 94              50%                 51%    -0.1
  recorded hands             121              60%                 50%    +2.1
  pooled                     215              55%                 50%    +1.4
```

So the card's claim survives counting, leans its way on the recorded hands and not at a coach
table, and 215 resolved positions do not settle it. Doubling the build would cost fifteen minutes
a population; it is not obvious the answer is worth it, since the tip only ever decides between two
throws the count already calls equal.

**What this unlocks.** Any future tip that is rare in play can now be measured for the price of a
builder function - about fifteen lines each here - rather than being left on the page as untested.

### The ping-wu row falls with turn because that is what ping-wu does, and it was not worth a re-bake (2026-09-06)

The committed table that baked had one row that looked wrong on its face: every plan's committed
slope was flat across turns except ping-wu's, which fell 0.450, 0.332, 0.272 - on the smallest
sample of the five, 2,072 hands at turn 40. That is either the plan or the sample, and a second
20,000-hand `plan_ping_wu` run on a fresh seed costs seven minutes.

```
                          turn 0   turn 20   turn 40      hands at 40
  first run,  seed 93      0.450     0.332     0.272           2,072
  second run, seed 96      0.391     0.303     0.235           1,904
  both pooled              0.420     0.317     0.255           3,976
  pursued, same hands      0.405     0.299     0.267          10,990
```

**It is the plan.** The second run reproduces the fall on an independent seed, and `pursued` on the
same hands has the same shape - which is what `plancheck` predicted, since a seat locked to ping-wu
barely plays differently from the coach and the two estimators have nothing to disagree about. So
the one row that broke the "flat under commitment" pattern breaks it honestly.

**What it would change, and the rule for whether to change it.** Rebuilding the whole committed
table with the pooled ping-wu cells at the same gain lowers that row by about 7% at every turn
(multipliers 1.36 / 1.02 / 0.82 against the baked 1.46 / 1.08 / 0.88). Run through `_fitrate`
against the baked coach, that changes the plan on 0.57% of discards and the throw on 0.66%. The rule,
fixed before the number was seen: re-bake only above about 2% of throws, because a re-baked table is
a different table and would need its own ranges rather than inheriting the sixteen already played.
It is a third of that, so the baked table stands and the pooled cells are tracked beside it at
`knowledge/sources/fitted/` for whoever rebuilds next.

### The matched baseline on the calling tips, and a dead wait is not worth a call (2026-09-06)

`discardtest.ts` and `audit.ts` score every throwing rule against a baseline that knows what each
throw is. `calltest.ts` did the same job by hand, with control arms, and the two could not sit in
one table. It now runs on `packlib.ts` with a claim-shaped null - four things a beginner can read
off the table, fitted on every graded claim action in both packs:

```
  a call that makes the hand ready     best 88% of the time
  a call that costs it nothing              60%
  a pass                                    28%
  a call that costs it a step                6%
```

Three of the five verdicts move in wording and none in direction. `call_to_upgrade` sharpens: the
widening call is 1.6 standard errors above its class, and the call that keeps the hand ready
without widening is 9.2 below - width is the whole condition. `call_to_skip_draw` goes from 2.4
above the flat coin to 3.8 below the matched one, with its own split saying late alone is 4.3 low
and early-and-safe 3.2 high. `take_ready_under_pressure` keeps its shape, 2.1 above under pressure
against 5.7 above with nobody committed. And `never_break_your_pair` was nearly promoted: passing is
3.4 above the baseline when the call would kill the only pair - until the control shows it is 2.4
above when the call would not, so passing is under-predicted in one-pair hands generally and the
pair-specific part is about one standard error. The control rows saved a wrong verdict for the
second time this week, which is the argument for always printing them.

**`rebuild_waits` is contradicted, built to order.** A seat is given four finished runs and a single
tile whose other three copies are on the table, the seat before it throws a tile that extends one
run, and the claim is graded with the packs' grader. Calling and throwing the dead tile leaves a
live single wait; passing keeps a hand that cannot win as it stands. Four hundred positions a
population, one per recorded hand:

```
                    resolved   took the call   by luck     z
  coach table           400         42%          50%    -3.5
  recorded hands        400         42%          50%    -3.3
```

The play-outs pass. The likely reason is that the wait can be rebuilt by drawing as well as by
calling - every turn, for nothing - so the call spends a concealed tile to buy what the next draw
already offered. The card is right that the wait is dead and wrong about what to do.

### The last untested read is backwards, and the playbook is done (2026-09-06)

`locate_the_fourth` says that between two equally safe tiles, if the threatening player threw one
copy early and nothing has come out since, assume they hold another. `tells.ts` asks every committed
seat, for every standard kind, late in the hand, whether it holds a copy:

```
                                    coach table   recorded hands
  never seen anywhere                  25.22%         24.13%
  seen from other seats only           11.74%         11.79%
  they threw it early, none since       5.25%          8.01%
  they threw it early, more since       1.96%          3.15%
  they threw it late                    5.21%          7.02%
```

The kind the card says to assume they hold is the one they are least likely to hold, by three to
four times, on both populations. The grain of truth is the bottom pair of rows - an early discard
with no copy out since is held more often than one with copies out since - and it is arithmetic
about how many copies remain, dwarfed by the fact that they threw it. That is the same shape as
`wall_reading`, which was confirmed: what a seat threw early is what it never had.

With that, every rule in the playbook has a verdict. Of 103 cards, 59 are measured, 18 contradicted,
4 confirmed by counting, 6 are rules of the table and 16 are advice that states no testable claim.
Nothing is left badged untested.

### The committed table loses against a table that is not three coaches (2026-09-06)

Every money figure in this file was measured with the coach in the other three chairs. The
committed-slope table won +0.101 chips a game that way over 128,000 paired deals and baked. It won
by winning more often and smaller - fewer half-colour hands, more wins at the table minimum - which
is the direction the fitted tables took when they LOST a chip a game, and nothing had asked whether
a gain made of converting slow big hands into fast cheap ones survives opponents who play
differently. `datagen/src/fieldtest.ts` asks. Same design as `headtohead.ts` - the tested seat
rotates through four chairs, walls paired, arms differ only in the table - but the other three
chairs hold the datagen personalities, drawn per deal from the generator's own pool and seeded by
the deal, so both arms face the same three players making the same decisions. Reported as committed
minus the previous table. Eight ranges named before the first ran, none played before:

```
  2,000 paired deals a seat, all four seats, 8,000 paired deals a range

  batch 1   1370001  -0.206   1380001  -0.438   1390001  -0.141   1400001  -0.006      -0.198 +/- 0.060
  batch 2   1410001  -0.163   1420001  -0.369   1430001  -0.089   1440001  -0.267      -0.222 +/- 0.061

  all eight, 64,000 paired deals                                 -0.210 +/- 0.043   t = -4.9, negative on 8 of 8
```

**It loses by twice what it won, at a stronger t than the bake had.** The breakdown, pooled over
batch 2, is the same trade in the same direction:

```
                               committed   previous
  won the hand                    41.14%     39.21%
    ...chips per win               18.18      19.71
    ...at the table minimum       45.30%     40.80%
  reached ready                   59.75%     57.39%
  dealt in                         8.65%      8.63%
```

Against coaches, getting ready sooner is worth more than the size given up, because a coach table
punishes a slow hand. Against a field that never collects a suit and wins a colour hand 1.3% of
the time, nobody punishes the slow hand, so speed buys less and the bigger hand cashes. The
deal-in rate is identical in both settings, so this is entirely a value-side trade whose sign
depends on who is at the table.

**What it means for the bake.** The shipped coach is the better table against coaches and the worse
one against everyone else this project can simulate. Neither field is a human. The rule fixed before
this ran was that it is a robustness check and not a bake decision, so the coach stands as baked
and the decision is written up here rather than taken. The natural follow-up is the same question
one change back - whether the row scaling that won +0.200 against coaches also holds against the
field, or whether the whole value-side programme has been fitted to one opponent - and it is
ran on four more ranges named in advance, 1450001..1480001, the previous table against the plain
study table with the same field in the other chairs:

```
  rowscale minus the study's own numbers, against the field
  1450001  +0.197   1460001  -0.060   1470001  +0.208   1480001  +0.154
  32,000 paired deals   +0.125 +/- 0.056   t = +2.2, positive on 3 of 4
```

**The row scaling holds against the field, at about the size it had against coaches.** So the
value-side programme was not fitted to one opponent from the start; one step of it was. The
committed bake is the field-specific change, and reverting to the row-scaled table gives a coach
that wins against both fields rather than one that wins against coaches and loses to everyone else.
That is the recommendation. It is not done here, because the rule said so, and because the field
is still not a person.

### The calling tips can be measured after all, and the baseline is the whole story (2026-09-05)

Five tips on the page are about whether to CLAIM rather than what to throw, and all five were badged
untested on the grounds that testing them was expensive. That was wrong, and cheaply so. A quiz pack
grades claim decisions exactly as it grades throws, 128 play-outs an option, so every one of these
positions already carried a measured best; the only thing missing was a filter per tip. There are
1,646 claim positions across the two packs and 1,392 of them are a real call-or-pass choice, the
rest being positions where the hand could simply be declared. `datagen/src/calltest.ts` is the tool
and it runs in under two seconds.

**The first number to know is that calling beats passing 72% of the time, with no condition at all.**
That is 997 of 1,392, and it is 75% at the coach table and 69% on the recorded run. Every one of
these five tips has the form "call rather than pass", so a tip that scores 80% against a 50% coin
looks like a strong finding and is actually below average. Three of the five looked convincing until
this control was run, which is the single most useful thing measured here.

**`call_to_upgrade` is confirmed, and the confirmation is a contrast rather than a rate.** Starting
from hands that are already ready, a call that leaves the hand ready on MORE live tiles is the
measured best 78% of the time, 40 of 51. A call that leaves it ready on the same number or fewer is
best 27% of the time, 27 of 100, and there the answer is to pass. Six standard errors apart, same
direction on both populations. The 78% on its own is barely above the 72% base rate, so what the
play-outs endorse is not "call when you are ready" but "call when it widens you", which is the same
condition the discard version of this tip already survived at 89%.

**`take_ready_under_pressure` gives the right action for the wrong reason.** A call that turns a
not-ready hand into a ready one is the measured best 89% of the time when an opponent holds three
melds, 40 of 45. With nobody holding as many as two melds it is 94%, 168 of 179, and at two melds
85%. So taking the ready hand is among the strongest things on the page, and the pressure condition
does not select for it - if anything a committed opponent is a mild reason to hesitate, which is the
opposite of the card. This one matters beyond its own tip, because "somebody has three melds" is the
threat signal the coach already prices, and it is doing no work here.

**`call_to_skip_draw` names the wrong positions.** Take a call that does not leave the hand further
from ready, which is the card's "keeps your shape". Unconditionally it is the measured best 72% of
the time. Under the card's own condition, late with somebody on two melds, it is 60%, on 204
positions, against 75% in the early and mid positions where nobody is committed. Splitting the
condition, being late alone gives 60% and somebody being committed alone gives 68%: the lateness is
doing all of it and the danger half adds nothing. Calling still edges passing there, so this is not
advice that loses money - it is advice that points at the positions where calling is least reliable
as though they were where it pays. Since a measured best already prices deal-in, a call that was
genuinely defensive would have shown up here.

**`never_break_your_pair` is not detectable, and the first version of the test was confounded.**
The honest comparison takes the hands the card is about, exactly one pair and no joker, and the
positions offering one call against one pass, then splits them by whether the call kills the pair.
Passing was best 47% of the time when it did, on 94 positions, and 39% when the call left a pair
standing, on 130. That is 1.2 standard errors, and the pair-killing call is still the better action
more often than not, so "never" is too strong. The first cut looked far worse for the call, best 51%
against 78%, but its control was drawn from hands holding two pairs, which are pong-friendly hands
rather than the same hands. Matching the population removed nearly all of the effect. Worth
remembering the next time a control is chosen for being easy to write.

**`pon_over_chii` cannot be settled this way and the card now says so.** Both packs together offer a
pong and a chow on the same tile 9 times, and 3 of those resolve. That is about the game, not the
packs: holding a pair of a tile and the two tiles it runs with, at the moment somebody throws it, is
rare. It needs positions built to order and played out.

**What this costs and what it does not prove.** The filters for the three interpreted tips - "a
dangerous hand", "visibly going for it", "keeps your shape" - are ours, written out in the tool
beside each one, so those three have failed or passed AS WE STATED THEM. And the standing caveat
from `tiptest.ts` applies unchanged: a measured best is the best action in the whole position, so it
prices value and danger as well as the thing the tip is about, and a pack is not a random sample of
the game.

### The value side is live, and it is the first thing here that has ever moved (2026-09-03)

Five danger ideas in a row came back at zero, and the fear behind this experiment was that the coach
might be just as deaf on the other side - in which case there is nothing left to improve and the bot
is finished. It is not deaf. Swing what the coach thinks a hand is WORTH and the money moves by two
orders of magnitude more than anything on the danger side has ever managed.

**The obvious test of the book's claim returned nothing, because it was not the book's claim.**
`hybrid_fallback` (`playbook.json:836`) is the largest strategic finding the book has, and it says to
keep Chicken alive as a fallback while building a pattern, worth +3.4 chips a game. The `nocheap` arm
drops Chicken from the plan list, so the coach only ever builds a pattern:

```
  six shards of 20,000    +0.051 +/- 0.030    t = +1.67
  three batches of 10,000 +0.018 +/- 0.061    t = +0.29
  pooled, 150,000 paired deals on fresh ranges    +0.044 +/- 0.027    t = +1.62
```

Inside two standard errors, and leaning the wrong way if it leans at all.

A fourth batch of 10,000 on shuffle-440001 finished after that figure was pooled and is not in it:
+0.277 +/- 0.105. Adding it would move the pooled number to +0.059 +/- 0.026 and just outside two
standard errors, which is exactly the shape this project has learned to distrust - a positive that
appears when one more batch is added to a pool assembled for another purpose. It is recorded here
so nobody finds it later and thinks it was hidden. Nothing should be quoted from it until the arm
is re-run on a range chosen in advance.

**The narrow arm does change the game, so the null is not inertness.** `tools/_cheapshape.ts` over
12,000 deals on shuffle-450001 onwards, the arm rotated through all four seats:

```
                            coach    nocheap
  won the hand             24.83%     24.27%
    ...tai per win           3.11       3.24
    ...chips per win        19.87      20.55
  won with Chicken         20.94%     12.64%
  won with a colour hand   30.20%     33.72%
  dealt in                 15.37%     15.95%
```

Two fifths of its cheap wins become pattern wins. It then wins slightly less often, wins slightly
more when it does, and pays slightly more often, and those three cancel almost exactly. So the plan
list steers the play hard at this end as well as at the other - it is the exchange that is fair, not
the machinery that is deaf. Taken with the mirror arm, the two ends bracket the question: forcing
every hand down the cheap route costs 1.928, removing the cheap route costs nothing, and the border
between them sits on a flat part of the curve.

**None of that refutes the book, because the book asked a different question.** Read its sentence
again: the +3.4 is measured **over a pure All-Pong strategy** - a player locked into one
pattern who never bails out. `nocheap` keeps every pattern, switches freely between them, and still
DECLARES a cheap win when one lands, because the engine offers the win and the bot takes it. All it
gives up is planning for one. So this null does not touch the book's claim. It answers a narrower
question the book never asked, and the answer is that having Chicken in the list is worth nothing
once the coach is already free to take a cheap win when it appears.

**The mirror is what actually answered the question.** `onlyCheap` leaves nothing but Chicken, so the
coach plays every hand for the quick legal win and never builds. That is a far bigger intervention -
it changes the throw on 21% of discards against `nocheap`'s 15% and the danger arms' 1.5% - and it
loses heavily:

```
  four ranges of 8,000 paired deals, shuffle-720001 onwards

  -2.030   -1.912   -1.907   -1.860     each +/- 0.150

  pooled, 32,000 paired deals    -1.928 +/- 0.075     t = -25.8
```

The four ranges scatter by 0.072, less than the 0.150 that noise alone would give. Nothing else in
this project has produced a number like this: every danger arm ever measured sits within 0.03 of
zero, and this is sixty times further out.

**The first version of the mirror was wrong, and the shape check is what caught it.** It read -3.662
and -3.734, nearly twice the truth. The cause is that a hand with no route to the table minimum still
LISTS Chicken, priced -9 and flagged unarmed, so when Chicken was the only plan left the coach's best
plan was worth -9, no throw improved anything, the danger term alone decided, and the bot quietly
played like a folder. Measured at 41.7% of its decisions against the coach's own 10.1%. The tell was
in the shape run before the number was believed: the arm reached ready LATER than the coach (34.5
against 33.5), which is the opposite of what playing for a fast cheap hand should do. Filtering on
`armed` rather than on the plan being listed puts it back to 10.05%, and the corrected arm gets ready
FASTER, which is what the strategy actually predicts.

**What the arm gives up, now that it is measuring the right thing.** 8,000 games a side:

```
                          coach   onlycheap        z
  wins                   24.75%      20.45%     +6.5
    at the minimum       40.86%      56.42%     -9.3
    four fan or more     36.21%      21.03%    +10.0
  average fan winning      3.07        2.52
  reached ready          45.98%      42.02%
    average turn           34.1        33.6
  deals in               15.11%      15.90%     -1.4
```

It gets ready sooner and wins cheaper, exactly as advertised, and it is not worth it: the big hands
it stops making are worth more than the speed it buys. The deal-in rate is the control and it does
not move, so this is a clean measurement of the value half with the danger half untouched.

**What follows from it.** The plan list is not decoration, and `solver/src/tables.ts` - which turns a
hand into a number of chips, and which is auto-generated from the book author's simulations rather
than from ours - is now worth re-fitting on our own 150,000 hands. That is the first time any part of
this project has earned that sentence on evidence rather than on hope. The danger side stays closed.

**Two arms and two tools stay in the tree**: `nocheap` and `onlycheap` in `headtohead.ts`, with
`tools/_cheaprate.ts` for how often an arm fires and `tools/_cheapshape.ts` for what it does to the
hands that get won. The second of those is the one that saved this finding from being reported at
twice its size, and it is worth running on any future arm whose result is either surprising or zero.

### The third gap from the tactics book is real, was invisible in our data, and pays nothing (2026-09-02)

The gap: the coach sees how MANY melds an opponent has and never what they are, so a dragon pong and
a chow of 3-4-5 are the same input to it. Eleven of the book's tips turn on the difference, and the
one it calls the strongest single read available is `half_color_tell` - a player collecting a suit
does not throw that suit, so the suit missing from their discards is their hand.

Mechanised as something a player can work out from the table alone: a seat is concentrating in suit
S when every suited set they have exposed is in S and they have thrown at most one S themselves.
Honour melds do not break the pattern, because Half-Color is one suit plus honours. Measured as new
dimensions on the existing reads pipeline - same method, same 25,000 hands of run-money4 - at two
strictnesses, one exposed set in the suit and two.

**The tell fires, and it is false.** Two exposed sets in one suit with the suit undiscarded flags a
seat 3.7% of the time, and when it does, that seat's CONCEALED part is in the suit almost never:

```
                          5+ concealed of it    80%+ of their concealed suited tiles
  one exposed set               10.2%                        1.0%       (n=211,160)
  two exposed sets               2.1%                        2.6%       (n= 16,979)
```

An earlier version of this check said 78.6% and was measuring nothing: it counted melds towards the
holding, and two exposed sets already supply six tiles of the suit, so it was true by construction.
The melds are not evidence about the part you cannot see. The question is only ever what is
concealed.

**Per opponent, the danger runs the other way.** Asked as "does this tile deal in to THAT seat",
which is the only honest form - pooling three seats lets two players who have nothing to do with the
read dilute it - a tile in the suit they are concentrating in is SAFER than one outside it:

```
  fresh turn 20   in 0.65%  off 0.76%   x0.85        seen turn 20   in 0.24%  off 0.35%   x0.70
  fresh turn 30   in 0.48%  off 0.80%   x0.60        seen turn 30   in 0.43%  off 0.45%   x0.94
  fresh turn 40   in 0.69%  off 0.92%   x0.75        seen turn 40   in 0.47%  off 0.49%   x0.94
  fresh turn 50   in 0.63%  off 0.86%   x0.72        seen turn 50   in 0.24%  off 0.32%   x0.77
  pooled: in 0.495%  off 0.649%  no concentration 0.286%    in/off x0.76   z = -3.33
```

That is not the book's read with the sign flipped, it is a different mechanism wearing its clothes.
Two exposed sets in a suit are six of that suit's tiles taken off the table, so what that seat still
needs is disproportionately outside it. Scarcity, not intention. The `off` column is also the reason
to distrust the aggregate version: a seat with two melds is a developed seat, so `off` beats `no
concentration` (0.649% against 0.286%) purely on tempo, and any comparison against the unflagged
cell measures development rather than content.

**The reason it finds nothing is that the players in the data do not play the hand.** What a
recorded run wins with, against what a table of coaches wins with (`solver/src/tools/_combos.ts`,
2,000 games; the recorded side is `datagen/src/stats.ts` over run-money4's 126,273 wins):

```
                       run-money4      four coaches
  chicken                 63.6%            22.7%
  chou_ping_hu            26.5%            33.2%
  ping_hu                  6.0%             9.4%
  peng_peng_hu             2.1%             2.6%
  ban_se   (Half-Color)    1.17%           28.9%
  qing_yi_se (Full)        0.12%            2.8%
  ---------------------------------------------------
  colour hands             1.29%           31.7%
```

**A read about suits cannot be measured on players who never collect one.** The datagen
personalities score discards on shanten, pairs, triplets and sequences; not one of them has a colour
target, so a suit concentration in their melds is a coincidence rather than a plan - which is
exactly what the 2.1% precision says. The book's tip is not refuted here. It was never tested.

**One defect looked for and not found.** The danger table splits fresh from seen on the discard pool
alone, and `rank.ts` looks the answer up with `ctx.visible`, which is the pool PLUS every exposed
meld - so a tile whose only copies sit in somebody's chow is `fresh` to the table and `seen` to the
coach. Melded copies are two thirds invisible to the pool: a chow claimed on 4筒 shows the 4 in the
discard log and hides the 3 and the 5. Measured both ways on the same sample, the discount is the
same either way, so the coach has not been reading a cell that was never measured for it:

```
  simple|20   pool  fresh 0.65%  seen 0.38%  x0.58     visible  fresh 0.65%  seen 0.44%  x0.68
  simple|30   pool  fresh 1.23%  seen 0.72%  x0.59     visible  fresh 1.23%  seen 0.80%  x0.65
  simple|40   pool  fresh 1.64%  seen 0.99%  x0.60     visible  fresh 1.70%  seen 1.04%  x0.61
  terminal|40 pool  fresh 1.05%  seen 0.57%  x0.54     visible  fresh 1.04%  seen 0.59%  x0.56
  honour|40   pool  fresh 0.37%  seen 0.06%  x0.17     visible  fresh 0.37%  seen 0.06%  x0.17
```

**Measured again on 25,000 hands the coach played against itself**, through a new `--coach` source in
`datagen/src/reads.ts`, every number turns over:

```
                                              run-money4      four coaches
  the tell is true (80%+ of concealed)             2.6%           49.6%
  deals in to that seat, in-suit vs off            x0.76           x2.03   (z = 14.1)
    ...at turn 40, tile already thrown             x0.94           x5.52
  a tile is IN somebody's suit (one set)          13.1%           20.9%
  they have thrown none of a suit by turn 40 ->
    they are really collecting it                   18%             54%
```

So the book is right and the coach is blind to it. The earlier reading was not an inversion of the
tip, it was its absence: with no colour hands in the population, the only thing left in the signal
was the scarcity artefact, and that is what got measured.

**A second thing falls out, larger than the read.** The whole danger table is soft for the game the
coach plays. A fresh simple tile at turn 30 deals in 1.23% of the time in run-money4 and 2.38% at a
table of coaches - about double, all the way along - and the fresh/seen discount is sharper too
(x0.44 against x0.59). `DANGER_WEIGHT = 40` was swept on coach games, but the probabilities it
multiplies were measured on the other one.

**And none of it is worth anything.** `AltReadsCoachBot` and the `altreads` arm exist so a table can
be PLAYED rather than admired - `Context.reads` had been declared for this since the reads went in
and had never had a user. The coach-measured table against the shipped one:

```
  seed 11    8,000 paired deals    -0.054 +/- 0.078
  seed 23    8,000 paired deals    -0.013 +/- 0.083
  pooled    16,000 paired deals    -0.034 +/- 0.057    t = -0.59
```

Dead level, and if anything the wrong side of zero. That is the fourth read that is measurably true
and pays nothing, after the wall, and it is the same shape: the coach was already close to the best
throw, so a better price on danger moves it somewhere it was nearly going anyway.

**What to take from four of these in a row.** The coach's danger term is not where the money is. It
already prices every discard continuously, and sharpening the price does not move the result. The
place these reads are worth something is the app, where the reader is a person who does NOT weigh
danger continuously and can be taught a true, mechanical rule. "Two sets in one suit and they are
not throwing it - stop feeding that suit" is worth teaching even though it is worth nothing to
score with.

**The real cost of the population gap is the training material, not the coach.** Everything the app
serves - the quiz pack, the film room - is drawn from the recorded run, so the positions a player
practises come from a game with 1.3% colour hands and 15.9% draws, taught by a coach that plays one
with 31.7% and 0.9%. The EVs on each position are still measured correctly; it is the mix that is
wrong, and this is the second time that has been said here about the same run.


### A lower-variance target does not work either (measured 2026-08-26)

Route 1 below was to attack the 9.8-chip outcome SD by scoring the same play-outs with a
less volatile statistic. `src/target.ts` runs each action's play-outs once and scores every one of
them six ways, so all targets see identical games, then asks how confidently each separates the pair
that matters (the best and runner-up **by chips**). `t` = |paired difference| / SE, unit-free, so
targets in chips, probabilities and signs compare directly. 400 decisions, 64 play-outs per action:

| target | mean t | t>1 | t>2 | agrees with chips ranking |
|---|---|---|---|---|
| chips (incumbent) | 0.74 | 22% | 6% | 100% |
| win (0/1) | 0.84 | 26% | 8% | 60% |
| win − dealt-in | 0.82 | 28% | 8% | 62% |
| chips clamped ±8 | 0.73 | 22% | 6% | 65% |
| chips clamped ±4 | 0.74 | 25% | 6% | 61% |
| sign of chips | 0.74 | 25% | 5% | 60% |

Clamping and sign buy **nothing** — identical t to chips. `win` buys 1.14x in t, worth 1.3x the
play-outs, while ranking a different action best 40% of the time; that is not a precision win, it is
a different question answered confidently. (A 100-decision pilot showed the clamped targets at
1.15–1.19x; the larger sample flattened them to 1.00x, so treat small samples here with suspicion.)

The variance is not in the payout scale. It is in *which hand wins*, and every one of these targets
inherits that. Route 1 is closed.

**That leaves route 2 as the only remaining lever**: truncated rollouts plus a terminal value
estimate, the one option that cuts variance and compute together. It is also the one that would help
most where the pack is now weakest — early-hand positions, which is exactly where a full play-out is
longest and most chaotic.

### How far the book coach is from the measurement (measured 2026-08-26)

The Train tab teaches the coach; the Real quiz teaches the evaluator. `solver/src/tools/coachcheck.ts`
measures the distance on the 4,086 decisive discard questions — positions where the play-outs
genuinely separate the best answer, so any disagreement is the coach's and not noise.

| | picks the measured best | cost per hand |
|---|---|---|
| book coach | 52.8% (61.6% counting ties it declared) | $2.02 |
| the recorded bots | 41.0% | $2.90 |
| random discard | 15.1% | — |

The coach is real signal — clearly ahead of the simulator bots, miles ahead of random — but it
leaves $2.02 a hand behind, and it is uneven:

```
by plan     all_chow 79.3% ($0.64)   ping_wu 59.0%   half_color 46.9%   chicken 38.3%   all_pong 33.2% ($2.72)
by phase    mid 61.8%   late 50.7%   early 36.1% ($2.84)
worst cell  early + chicken  7.6%  ($3.78)  - worse than guessing at random
```

**Two obvious fixes were tried and neither works.** Both are recorded so they are not tried again:

- *The missing Section 6.5 (All-Pong at MF2).* The code substitutes the MF1 table plus a flat
  `+0.5`, where the targets that do have both levels show real MF2 corrections of +1.6 to +3.8
  chips — so the placeholder looked about 4x too small. Sweeping it 0.0 → 3.0 moves overall
  agreement by 0.1pp, and *raising* it makes All-Pong worse (33.2% → 27.7%) by committing to the
  plan more often. The current 0.5 is already near-optimal. Capturing 6.5 is a rigour item, not a
  quality one.
- *Chicken committed too early.* In the worst cell, 97% of the hands are legal only because of a
  flower and 92% hold just 1–2 tai: the coach names Chicken on turn 8 because the hand is already
  legal, when it should still be building. Discounting Chicken by remaining turns does stop that —
  the cell shrinks from 92 cases to 42 — but overall agreement moves 52.8% → 53.2% and cost $2.02 →
  $2.00. It relabels the decision without improving it.

The disagreements are also *within* tile class (the largest bucket is middle → middle, 776 cases at
$4.43 each), not a coarse "throws honours when it should throw middles" bias. Taken together: the
coach's gap is not one mis-set constant, and the plan-by-plan spread mostly reflects which positions
land under each label — All-Chow hands tend to have an obvious throw, All-Pong and Chicken hands do
not. Tuning book heuristics further looks like a poor use of effort.

**The decisive subset is the training set layer 3 was waiting for.** The noise floor blocks learning
from all 479,913 decisions, but ~48,000 of them (15.0k discards, 21.6k claims, 4.9k self-actions)
have a best action separated at 2 SE — labels that are reliable by construction. That is a
supervised dataset large enough to fit a discard policy against, and it needs no new compute. It
would also be the honest way to close the coach's $2.02, since no amount of book-table tuning has.

### The table plays with wildcards and the code was not dealing them (fixed 2026-08-29)

The table config has said `jokers.count 4` since the money rules went in. Several places never
read it and the ones that did read it wrong, so "the game" meant different things in different
files. Three separate defects, all now fixed and covered by `engine/test/jokers.test.ts`:

- **A wildcard was a legal throw.** It is not — confirmed for this table, it is too valuable to
  give up, so it is not a discard at all (`rules.jokers.discardable`, default false). Enforcing
  it in `legalActions()` alone was not enough: the bots pick a tile straight out of the hand, not
  off the legal list, so it is enforced in `applyDiscard` too and `PlayerView.legalDiscards` gives
  a freely-picking bot somewhere correct to pick from. In run-money2 a wildcard was offered as a
  legal discard in **41.1%** of discard positions and thrown in **0.72%**.
- **`Wall` read a count as a flag.** `jokers > 0 ? TOTAL_TILES_WITH_JOKERS : TOTAL_TILES`, so a
  table asking for 12 wildcards silently got 4.
- **The harnesses measured a different game.** `tools/headtohead.ts` and `tools/leakhunt.ts` dealt walls with
  no wildcards while the bots they compare were tuned on data generated with them. This is what
  put the 2.66-chip verdict above 5x out.

**The one case left, and what it really is.** run-money3 still contains 195 wildcard discards in
150,000 hands (0.13%), every one the same position: four melds exposed and a concealed part that
is nothing but wildcards, where `throwable()` falls back to the full hand so the game can move.

That fallback is the wrong answer, and the state should be unreachable. The win detection is not
at fault — it accepts a wildcard pair as the eye, `valid=true`, a complete hand. The player cannot
declare it because the locked melds score 0–1 tai against the 2-tai minimum, and no wildcard
assignment can raise that. So the hand is **complete and uncashable**, and since a wildcard pairs
with anything the seat sits in permanent ready-to-win it can never legally take. Those hands run
83–88 turns against a 49-turn average and mostly end in a draw.

The wildcard is only thrown on the turn every tile held is a wildcard: four melds plus one
wildcard, draw a second, something must go. **The fix belongs in the claim policy — refusing the
claim that locks a hand below the minimum — not in a discard rule for the corner it creates.**
That is route 3 (a scoring-aware policy) showing up in its most visible form. The run as a whole
is not distorted by it: 15.9% draws and 49.0 mean turns against the book's 14% and 48.

### Four things played for money, and none of them won (measured 2026-08-29)

With `tools/headtohead.ts` finally dealing the table's own wall, every outstanding "this should be
better" claim was played out. It is parameterised by arm now (`policy` / `claim` / `full` / `fold`
/ `self`), 4,000 paired deals per seat, tested bot rotated through all four seats. `self` puts the
coach against itself and must return exactly 0.000 +/- 0.000 - a harness check, since a pairing bug
would show up as a spurious difference between identical bots.

| arm | vs the book coach | read |
|---|---|---|
| discard model | -0.544 +/- 0.144 | loses, 3.8 SE |
| claim model | **+0.001 +/- 0.092** | dead level |
| both models | -0.180 +/- 0.145 | inside noise, not ahead |
| coach + flower/animal route priced | -0.180 +/- 0.061 | loses, 3 SE |
| coach + give-up rule | -0.039 +/- 0.018 | loses, 2.2 SE |

**The machine-learning programme is closed by the claim model.** Discards were always the weak
case - only 4% of them have a best action the play-outs separate at 2 SE, so the labels are mostly
noise. Claims were the strong case: 27% separate, 22,107 decisive examples, and the model reaches
86.1% held-out top-1 against 32.2% for always-pass and 59.6% for the recorded bots. It converts to
**+0.001 chips a game**. That is not a near miss, it is nothing. Three models have now been played
for money and none is ahead of a hand-written book heuristic. Per-decision accuracy has failed to
predict winning three times in a row; it should not be believed a fourth.

**Two hand-written strategy rules also lost, in opposite directions.** Both came from a description
of how the table is actually played: all-chow is the default plan, a hand that cannot carry tai in
its shape plays for flowers, animals or self-draw, and late on you decide whether to give up and
defend.

- *Pricing the flower/animal route* - arming a Chicken hand in proportion to the chance of drawing
  a Fan-carrying bonus tile in the draws left - cost 0.18 chips a game. The advice was sound and
  the encoding was not: knowing a flower could still arm the hand is a reason not to despair of it,
  not a reason to invest in it. `bonusFanChance` survives and is REPORTED in the plan note, so a
  player is told the route exists; nothing prices it.
- *Giving up* - on a hand with no route to the minimum, rank by safety alone - cost 0.039. The
  likely fault is the trigger: it asks whether the hand is armed NOW, which writes off exactly the
  hands that could still draw the flower that arms them. Premature surrender. Kept opt-in behind
  `rankDiscards(..., { fold: true })` and `FoldCoachBot`, off by default.

A measurement trap worth recording: while the flower route was priced, the fold rule fired 0 times
in 15,909 decisions and looked inert. It was not inert - the route was arming the hands the fold
would have caught. With the pricing removed it fires on 2.24%. **A rule measured underneath another
untested change measures nothing.**

What survives: the coach is unchanged and remains the best player available, at exactly the
behaviour it had before any of this. The harness is better - four arms and a self-check - and
`solver/src/tools/foldrate.ts` reports how often a rule actually fires, which is the check that would
have caught the trap above immediately.

### How much to defend, finally measured in money (2026-08-30)

Folding failed twice - once keyed on the hand being unable to reach the minimum (-0.039), once on
the real trigger, somebody looking ready AND this hand being far (`tools/foldsweep.ts`, 12 threshold
combinations, none ahead; the more a setting fired the more it lost). The explanation is that the
coach ALREADY does this continuously: every discard is priced `dealInChance * threatScale *
DANGER_WEIGHT` and that is subtracted from what the tile does for the hand. A fold replaces a
graded trade-off with a switch and throws the value half away.

Which moved the question to the constant. `DANGER_WEIGHT = 40` was fitted by sweeping the coach's
per-decision AGREEMENT with the play-outs (54.5% -> 55.7%, peak near 40) - the same proxy that has
now failed to predict chips three times. So the number governing how defensively the coach plays
had never been checked against money. `tools/dangersweep.ts`, 6,000 paired deals per setting:

```
weight    chips/game vs the shipped 40
   10     -0.113 +/- 0.100
   20     +0.006 +/- 0.083
   40      0.000  (baseline, and a harness self-check: identical bots must return exactly 0)
   70     -0.052 +/- 0.079
  110     -0.185 +/- 0.109
  160     -0.401 +/- 0.131
  240     -0.683 +/- 0.153
```

**More defence is monotonically worse, out to 4.5 SE.** The optimum is a plateau over roughly
20-40 and 40 stays; being bolder than 20 is also worse. Two things worth taking from this:

- **The fold question is now answered from two directions.** A fold is "defend more" in switch
  form, and defending more loses across the entire range. It was never a threshold problem.
- **The agreement-fitted 40 was right anyway.** Agreement has been a bad guide to money three times
  and a good one here, which is the useful nuance: a proxy is not always wrong, it is unreliable.
  The only way to know which is to play it out, and that now costs 20 minutes.

Engine: rules layer (`engine/src/rules.ts`), recorder hooks, resumable `GameState` (snapshot / resume), `Wall.fromSnapshot`.
Engine rules now include robbing the kong, Seven/Eight-Flower and all-animals specials, and Pay-All liability (config-gated, off by default pending house-rule confirmation).
