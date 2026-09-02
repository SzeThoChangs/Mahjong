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
