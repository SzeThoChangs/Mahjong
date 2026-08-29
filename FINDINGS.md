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
discards, 21.6k claims, 4.9k self-actions — several times what a pack needs, so the kind mix is held
at the run's own proportions and the trainer stays discard-heavy. Result: **100% of questions have a
separable best answer at 1 SE and 99% at 2 SE, against 24% before**, and the share of alternatives
sitting inside 1 SE of the best fell from 40% to 0.6%.

Two things this costs, both worth knowing:

- **The pack skews late.** Decisive positions are 46% late-hand against 26% in the run, and 16%
  early against 36%. Hands resolve once they are committed; the early discards a trainer would add
  most value on are exactly the ones the evaluator cannot separate. `quizpack.ts` prints the phase
  mix on every build so this stays visible.
- **The questions are easier.** Mean best-vs-runner-up gap on a discard went from $0.60 to $3.62.
  The trainer now teaches positions where one tile is clearly right, which is a narrower lesson than
  intended — but it is a real one, where the previous pack was mostly quizzing on coin flips.

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
