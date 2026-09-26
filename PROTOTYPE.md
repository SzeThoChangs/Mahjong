# PROTOTYPE

## Purpose of this file

This file governs the project's prototype: what it represents, why, what we are trying to learn
from it, what it has taught, and where it sits in its own lifecycle. `prototype/` holds the
prototype itself; this file holds what it is for.

## It answers

What are we prototyping, what are we learning, and what is the lifecycle state of the prototype?

## Two kinds of prototype work

The visual product prototype is the primary kind: something to see, use, review and challenge
before production code is written. Here that is a runnable copy of the app, in one file, that a
new feature is added to first. The targeted experiment is the secondary kind: something built to
resolve one specific uncertainty. This project has run dozens of those, but they were measurements
of the coach and the packs rather than of the product, and they are recorded in `FINDINGS.md`
(`RS-001`), not here. The one experiment that belongs here is the claim judge, at the bottom.

## What belongs here

What the prototype represents and leaves out; the mocks, shortcuts and temporary assumptions it
uses; what we want to learn from it; review and feedback; what was learned; and what the next
iteration should change.

## What does not belong here

- The prototype itself; that is `prototype/`.
- Accepted product behaviour; that is `SPEC.md`, deliberately, after a finding is accepted.
- Resulting decisions; those are `DECISIONS.md`.
- New or changed uncertainty; that is `OPEN-ITEMS.md`.
- Delivery order; that is `PLAN.md`.
- The measurements of the coach and the packs; those are `FINDINGS.md`.

## When to update

Before an iteration is built, to say what it represents and what it should teach; and after review
or testing produces evidence, to say what was learned and what changes. Keep earlier iterations'
findings rather than overwriting them.

## Relationship to other files

Prototype scope is drawn from `USERS.md`, `USER-JOURNEYS.md`, `WORKFLOWS.md`, `FEATURES.md` and
`USER-STORIES.md`. Accepted learning flows back into those files and `SPEC.md`; new uncertainty
into `OPEN-ITEMS.md`; material decisions into `DECISIONS.md`; delivery changes into `PLAN.md`;
project-level change into `CHANGELOG.md`. The decision that shapes this file is `D-025`; the
tension it creates with the recipe is `C-001`.

## Rules

The prototype participates in product definition and does not wait for the definition to be
finished. Mock data, hard-coded states and disposable code are all legitimate; optimise for what
it must teach.

Do not silently invent unresolved product behaviour. Where the prototype must represent something
undecided, record it as an `ASSUMPTION` in `OPEN-ITEMS.md` and list it under Temporary assumptions
below. Prototype behaviour is not an approved requirement, and prototype code is not production
code. Learning must be deliberately accepted into the project files before it reaches production;
it never migrates by itself. This rule matters more here than usual, because the prototype is a
copy of production and the two will look alike.

Label every shortcut, mock and assumption below. Do not write scope the owner has not agreed to;
an iteration the agent thought of is `PROPOSED` and stays out of `PLAN.md` and `NEXT.md` until the
owner agrees.

## Lifecycle state

The three states are `NOT STARTED`, `ACTIVE` and `HISTORICAL`. They are sufficient.

This project departs from the recipe here, and it is worth being plain about it. Part 6 of
`P-Starter.md` says that after BASELINE the prototype becomes `HISTORICAL`, is not kept in step with
production, and that later prototyping is a fresh, scoped exercise rather than a second application
following production. This project passed BASELINE before the recipe arrived, the production app
is live, and on 2026-09-12 the owner decided that `prototype/` is instead a runnable snapshot of
the current build, kept true by a script, in which every new feature is tried before its
production code is written (`D-025`). So the state below is `ACTIVE` for as long as that decision
stands, and a later session must not "correct" it to `HISTORICAL` on the strength of Part 6. The
concern behind Part 6, that what runs in the prototype gets mistaken for what was agreed, is kept
as the rule above.

---

## Current Prototype

**Lifecycle State:** ACTIVE

**Iteration:** 1, the seed.

**Status:** SEEDED on 2026-09-12 and runnable. `prototype/build.sh` folds the current source into
`app.html`; `index.html`, `features.html` and `workflows.html` are the launchpads, generated from
`FEATURES.md` and `WORKFLOWS.md` at load time rather than retyped, and every card opens the screen
its record names. Nothing has been prototyped here yet that is not already in production, which is
the point of a seed: the next feature starts from what exists.

**Objective:** Give the owner, and anyone prototyping a feature, a copy of the app as it is today
that runs from one file with no server, so that a change can be tried and reacted to before it is
built for real.

**What part of the application is represented:** The whole app as of the current source, folded
into `prototype/app.html` by `prototype/build.sh`. As seeded on 2026-09-12 the folder holds three
things, all the lead's work.

- `build.sh` regenerates the snapshot from the current source: a single-file Vite build, then
  `web/tools/singlefile.mjs` with 500 questions and 30 replay hands, then the normal split build
  again so `web/dist/` is left as production expects.
- `app.html`, about 7 MB, the snapshot itself. It is git-ignored, since it is generated bytes that
  change wholesale on every build; anyone who needs it runs the script.
- `screens/`, empty but for a placeholder, for the hand-maintained launchpads that the recipe's
  Part 17 describes and that are to be committed beside the snapshot.

### Represented

**Users:** U-001 (Changs) and U-002 (a friend testing), as the production app serves them.

**Journeys:** Everything the production app supports, UJ-001 to UJ-006, at the level the snapshot
carries: 500 questions a pack rather than ten thousand, 30 replay hands rather than 360.

**Workflows:** WF-001 to WF-014, as built in production.

**Features:** F-001 to F-016, as built; F-014, the Play tab, is itself labelled a prototype in
production and is the first feature this folder should carry forward.

**Stories:** US-001 to US-016 and US-019, as built.

**Important states:** A fresh record with nothing due; a record with reviews due; a pack question
answered and graded; a made-up hand marked by the Coach; a whole hand played and its decisions
judged; the phone layout under 640px.

### Deliberately excluded

- The full packs. The single-file build keeps the first 500 questions a pack and the first few
  shards, so a stored card's shard may not be present; the reader must use the modulus from the
  index rather than counting shards, as `MOBILE.md` says.
- The service worker and offline behaviour. A single file has no scope to register one in.
- The export button, which cannot hand a viewer a file in an artifact viewer.

### Mocks and simulations

| Mocked | Stands in for | Why |
|---|---|---|
| Tile faces as data URIs on the window | The 48 image files in `web/public/tiles/` | An `<img>` needs a real URL in a single file |
| A fetch shim answering from an embedded map | The pack shards, replays and reads files | A single file has nothing to fetch from |
| Truncated packs and replays | The full data | Keeps the file inside what a viewer will load |

### Temporary assumptions

None recorded yet. The seed is a copy of production and embodies no undecided product behaviour of
its own. When a feature is prototyped here on an assumption, add it to this table and to
`OPEN-ITEMS.md`.

| Assumption | Open item | Why it was safe to proceed |
|---|---|---|

### Deliberate shortcuts

- The snapshot is built by the same `singlefile.mjs` that made the 2026-09-10 artifact, so its
  limits are that tool's limits. That is a shortcut, not a decision about how production is
  delivered; production is the split build on GitHub Pages (`D-020`).

### Known gaps

- Nothing has yet been prototyped here that is not also in production, so the folder has not yet
  done the job it exists for. The first candidate is the claim judge (`F-017`), below.
- The launchpads in `screens/` are not yet written.

---

### Iteration 2, 2026-09-16: a "hard only" filter on the Train tab

Changs said some quiz questions are too easy. The prototype adds a "hard only" button beside the
all, discard and claim buttons. It leaves out questions whose answer is a win, questions decided by
more than eight standard errors, and questions the recorded bot already got right (`A-005`). It is
remembered per device and on by default, at Changs's request on 2026-09-16.

Pushed to production on 2026-09-16 at his word, with the other changes in `D-028`. The ten passes
are in `MISTAKES.md`.

**Temporary assumption:** the definition of hard, `A-005`.

## What We Want to Learn

**What needs validation:** Whether the Play loop feels like mahjong and whether its review is worth
reading (`Q-001`). That is the owner's question and it can be asked of the snapshot as well as of
the live site.

**Workflows that need review:** WF-013, playing one hand and judging it; WF-003 on a phone late in
a hand, where the table outgrows its card (`Q-002`); the bottom bar's choice of four (`Q-003`).

**Interactions that need review:** The on-demand judging of a decision after a hand; the
"cannot yet be trusted on calls" note on the Play screen; the update bar.

**Assumptions being exercised:** A-001, that graded decisive positions are what to practise; A-004,
that friends need no shared data.

**Evidence / feedback required:** The owner's reactions after a week; anything friends report.

**What would constitute a useful result:** A sentence from the owner of the form "this is right",
"this is wrong", "move this", or "this is missing", recorded under Review below and then acted on
in the project files.

---

## Review / Testing

| Date | Who | What was exercised |
|---|---|---|
| 2026-09-07 | Changs, on a mockup with two live 360px frames | The bottom bar and the square table on a phone; settled D-017 and D-018 |
| 2026-09-10 | Changs, on his phone | The installed app, which opened at the account root and showed a 404; fixed the same day |
| 2026-09-10 | Changs, on the Train tab | Disputed a big-mistake verdict; re-judged and found to be noise; led to D-009 |

Those three predate this folder and were done on the production app or a mockup. They are the
only owner reviews on record, and they are recorded here because they are exactly the kind of
evidence the prototype is meant to produce.

**Observations:** The manifest's relative paths and the winner's curse were both found by the owner
using the thing, not by anyone reading it.

**Feedback:** None yet on the seed.

**Failures / confusion:** None recorded on the seed.

**Missing behaviour:** None recorded on the seed.

**Unexpected behaviour:** None recorded on the seed.

---

## Learning

**What we learned:** From the mockup, that a bottom bar with five destinations is the honest way to
carry eight on a phone, and that the square table is worth its height (D-017, D-018). From the
phone, that the installed app must use relative paths. From the disputed verdict, that packs
overstated their certainty by about a tenth and needed a second pass (D-009).

**Assumptions supported:** None tested through this folder yet.

**Assumptions rejected:** None yet.

**New questions:** Q-002 and Q-003 came out of the phone pass.

**Required project-definition changes:** None outstanding from the reviews above; each was taken
into the app and recorded. C-003, the framework describing two tabs, is a definition change the
app has already made and the framework has not.

**Required prototype changes:** The launchpads in `screens/`.

---

## Next Prototype Iteration

**What should change:** The owner has not said. The agent's recommendation, `PROPOSED` and not
agreed, is that the next thing tried here is the claim judge: a stronger rollout policy for claim
questions inside the Play review, so the owner can see a whole hand judged honestly on calls
before that policy is built into `solver/src/rejudge.ts` for the packs and the phone.

**Why:** It is the first item in `PLAN.md` Phase 7 and the reason the Play review cannot yet be
trusted (`R-001`).

**What it should let us learn:** Whether a review that is honest on calls changes what the owner
thinks of the Play loop (`Q-001`).

**Or: are we at BASELINE?** Past it. This section does not apply in the usual way, since the
prototype tracks a live product by decision; see the Lifecycle state section.

---

## Targeted Experiments / Spikes

### A pack of positions that arise at a strong table

**Uncertainty addressed:** Every pack question so far comes from hands played by the weak personality
bots. Changs's opponents are strong (`D-032`), and a strong table produces different positions: hands
run differently, suits get collected, the floor looks different. Nothing in the project has graded
positions that came from strong play at his own table.

**Origin:** Changs asked for heavy work, 2026-09-26.

**Why construction:** it cannot be read off anything. The run has to be played and graded.

**What is built:** a new bot type `coachnowild`, the Coach reading the no-Joker danger table, so a
no-Joker run is four players who read danger the way the app does at that table (`D-030`). Then the
usual three stages at 0 Jokers, min 1: generate, grade, build the pack.

**Named before the run:** 150,000 hands, seed 902, four `coachnowild` seats, into
`data/gen/run-strong-nowild`. Graded at 4 decisions a hand, 128 play-outs, adaptive, policy shanten,
seed 1. Pack built at `--max 12800 --mix decisive --verify 512`, which is what the shipped packs use.
Smoke run first: 400 hands at 14 hands a second, 361 won, 39 drawn, mean 50.5 turns, and the manifest
records 0 Jokers, min 1 and four `coachnowild` seats.

**What it will and will not show:** the positions will be strong-table positions. The grading still
plays out with simple bots, because a Coach play-out costs 120 times more, so the answers still mean
"best if play continues loosely" for everything except wins, where the rule from `FINDINGS.md`
applies. Claims and throws were measured to survive that (`+0.150` to `+0.338` on calls, 1% of throws
changed), which is why this is worth building.

**Status:** RUNNING

**Findings:** None yet.

### Is the judge right to decline wins? The direct money test, then the fix

**Uncertainty addressed:** Over two thousand pack questions have a measured best that declines an
offered win. D-027 stopped the Play review from marking a taken win wrong, on the evidence of a
fixed-bar stand-in for the judge. Changs asked on 2026-09-17 for what is right rather than for the
quick option of dropping those questions, so the judge itself is tested before anything is done.

**The whole job, in order:**

1. Test the judge's own win verdicts for money: a Coach that follows the judge whenever it may win
   or decline, against the Coach that always wins, on paired deals.
2. If the judge loses, find why. Three causes are already excluded (`R-001`); the next candidates are
   what the declining seat's own play-out bot does afterwards, and whether the payoff counted for a
   branch that continues is complete.
3. Fix the judge, and show the fixed judge's win verdicts pass the same money test.
4. Re-judge every win-offered question in all three packs with the fixed judge, rebuild the packs
   with their verification pass, and ship. Only then does D-027's guard come out of the Play review.

**What was built for step 1:** `datagen/src/judgewin.ts`. The judged seat plays the Coach, and at a
win it may decline it runs `rejudge` on the real position exactly as the app does (256 play-outs,
simple bots, hidden tiles re-dealt) and follows the best action. Self-check before any result: with
the judge forced to take every win, the hand-driven loop returned exactly 0.000 against the Coach
over 60 paired deals, so the loop plays the same games as the engine's own.

**Named before the run (step 1):** 2,000 deals per seat in all four chairs, 8,000 paired deals per
run, the judge at 256 play-outs, seed 424242.

    table              run folder          against three Coaches     against the recorded players
    0 Jokers, min 1    run-min1-nowild     7730001 to 7732000        7740001 to 7742000
    4 Jokers, min 1    run-min1            7750001 to 7752000        7760001 to 7762000
    4 Jokers, min 2    run-coach2          7770001 to 7772000        7780001 to 7782000

A result counts at more than two standard errors.

**Status:** Step 1 RUN, 2026-09-17, finished 17:41. Steps 2 to 4 wait on the result below.

**Findings, step 1:**

    table              against three Coaches               against the recorded players
                       declined   judge minus Coach       declined   judge minus Coach
    0 Jokers, min 1       24%     -0.221 +/- 0.041         22%     +0.093 +/- 0.043
    4 Jokers, min 1       51%     -0.327 +/- 0.072         53%     +0.683 +/- 0.087
    4 Jokers, min 2       51%     -0.321 +/- 0.079         53%     +0.810 +/- 0.089

Every one of the six is past two standard errors, and the two fields point opposite ways at every
table. Following the judge on wins loses a fifth to a third of a chip a game against Coaches and wins
up to eight tenths against the recorded players. So the judge is neither right nor wrong about wins:
it is right against players like the ones its play-outs use, and wrong against players who punish a
hand that waits. The fixed-bar test behind D-027 lost on both fields, because a bar declines cheap
wins blindly; the judge declines the ones worth declining against weak players.

**What this changes about the job:** there is no single fix for step 3. What is correct at Changs's
table depends on how his opponents play, which nothing here has measured.

**Owner answer, 2026-09-17:** his opponents are strong (`Q-012`). So the target is a judge that is
right against strong players. The Coach field is the project's stand-in for strong players; that is
an assumption, not a measurement of real people (`A-006`).

**Step 3, named before the run:** the same money test with the judge's play-outs played by the Coach
(reading danger at the table's Joker count), following it on wins, against three Coaches.
`judgewin.ts --judge coach --decisions wins --field coach`, 2,000 deals per seat, all four chairs.

    table              deals
    0 Jokers, min 1    7790001 to 7792000
    4 Jokers, min 1    7800001 to 7802000
    4 Jokers, min 2    7810001 to 7812000

If the Coach-played judge does not lose to always taking the win against strong players, it is the
judge for Changs's table on wins.

**Step 3 result, finished 2026-09-24 (the Coach-played judge is slow: 2 to 4 days of play-outs per
run).** It loses by more than the simple judge does, at every table:

    table              offers judged   declined   Coach-played judge minus Coach
    0 Jokers, min 1        2,302          34%      -0.345 +/- 0.045  (t -7.7)
    4 Jokers, min 1        3,447          59%      -0.425 +/- 0.089  (t -4.8)
    4 Jokers, min 2        3,413          57%      -0.455 +/- 0.095  (t -4.8)

So no judge this project has beats the plain rule at a strong table: **when you can win, win.** The
simple judge loses 0.22 to 0.33 chips a game by declining, the Coach-played judge 0.35 to 0.46. Step 3
is answered, and the answer is that the fix is not a better judge. Claims follow once their cost is measured: a smoke run following
the Coach-played judge at every claim took more than ten minutes for twelve deals.

**Claim cost, measured 2026-09-17:** following the Coach-played judge at every claim took 1,115 seconds
for 12 paired deals, 42 claim decisions at 26 seconds each, and it said pass on 57% of them. At that
rate the named test is about 200 hours on one worker. The simple judge took 13 seconds for the same
12 deals.

**So claims go in the order the money allows.** First the question that is cheap and decides whether
anything else is needed: do the pack's current claim answers, the simple judge's, lose money against
strong players? `judgewin.ts --judge shanten --decisions claims --field coach`, 2,000 deals per seat,
all four chairs, queued after step 3.

    table              deals
    0 Jokers, min 1    7820001 to 7822000
    4 Jokers, min 1    7830001 to 7832000
    4 Jokers, min 2    7840001 to 7842000

If they do not lose against the Coach's own claim rule, the pack's claims are fit for a strong table
and the 200-hour test is not needed to decide anything. If they lose, the claims are re-judged, and
the cost of doing that properly is the next thing to solve.

**Result, 2026-09-24.** Following the simple judge at every claim, against three Coaches:

    table              decisions judged   passed   judge minus Coach
    0 Jokers, min 1        23,043          42%     -0.137 +/- 0.140  (t -1.0)
    4 Jokers, min 1        18,149          44%     -0.240 +/- 0.143  (t -1.7)
    4 Jokers, min 2        19,142          43%     -0.380 +/- 0.153  (t -2.5)

Only the third is past two standard errors. **But these runs carry the win defect**: `--decisions
claims` also follows the judge when a win is on offer, and declining wins is already measured to cost
0.22 to 0.33 a game at these tables. So this cannot say what Pong and Chow decisions alone are worth.

**Named before the run, the separation:** `--decisions calls`, which follows the judge at every Pong,
Chow or pass with no win on offer, and takes every win. Same fields, same sizes.

    table              deals
    0 Jokers, min 1    7850001 to 7852000
    4 Jokers, min 1    7860001 to 7862000
    4 Jokers, min 2    7870001 to 7872000

**Result, 2026-09-24, and it clears the claims.** With every win taken, following the judge on Pong,
Chow and pass is worth nothing to a third of a chip a game, and never loses:

    table              decisions judged   passed   judge minus Coach
    0 Jokers, min 1        20,383          43%     +0.150 +/- 0.133  (t 1.1)
    4 Jokers, min 1        14,464          41%     +0.102 +/- 0.122  (t 0.8)
    4 Jokers, min 2        15,553          41%     +0.338 +/- 0.141  (t 2.4)

So the whole loss in the claims runs was the win decisions. The pack's Pong and Chow answers are fit
for a strong table, which agrees with the Pong bar sweep that found nothing beats the shipped rule.

**The job's answer.** One defect, not two: a win on offer must be taken, and everything else the packs
teach stands. Step 4 is the fix.

**Step 4, done 2026-09-26: the rule is written into the pack data.** Changs was offered two ways to
carry it: fix the pack files, or leave them wrong and override in the app. He answered "Not
shortcut", so the builder does it (`D-033`).

`datagen/src/quizpack.ts` marks any question that offers a win with `rule: 'win'`, stores `best` as
the win, and the verify pass keeps rule questions even where the fresh play-outs fail the separation
test and re-asserts the win after re-judging. `solver/src/question.ts` carries the mark.
`web/src/components/Train.tsx` reads it: taking the win is "Best move", passing is "Mistake", the
"Given up" figure is not charged, the money bars and the Challenge button are left off, and a
paragraph says why the bars are absent.

**Measured on a 199-question test pack built from `run-min1-nowild`** (deleted afterwards): 34
questions carry the mark, all 34 store `best` = win, and 0 questions offer a win without it. On 6 of
the 34 the play-outs preferred passing, which are the ones the rule changes; each was served to the
app by name and answered both ways. The ten passes for this change are in `MISTAKES.md`, dated
2026-09-26, with the two defects they found.

**Still to do before this reaches the site:** the three shipped packs have to be rebuilt with the
mark. Until then the rule questions exist only in the builder's output, and the packs on the site
still carry the play-outs' win answers.

**One thing that looked like a second defect was not.** On 3 of the 6 positions the screen said the
Coach would pass. The Coach does not: `CoachBot.chooseClaim` takes a win before it asks
`claimAdvice`, and over the 595 claim questions in the 0-Joker pack that offer a win it declines 0.
The Train screen was running `claimRank`, the learned model, which declines 278 of the same 595. One
line in the screen now takes the win first, as the bot does (`Q-013`). Nothing was measured with a
win-declining field, so the results above stand unchanged.

### Should the Coach call Pong more or less at a no-Joker table?

**Uncertainty addressed:** On 2026-09-17 a judge with the Coach in the play-outs said pass on
positions where the pack says Pong. A count of changed answers cannot say which is right.

**Origin:** Changs chose the money test over re-grading, 2026-09-17.

**What was built:** `datagen/src/coachgrade.ts --select pong`, which judges every chosen Pong
question twice on the same deals, and `datagen/src/pongmoney.ts`, which plays paired deals where one
seat's Coach holds Pongs to a different bar from the shipped 0.4 chips. Self-check before any
result: at a bar of 0.4 it returns exactly 0.000 against the shipped Coach on both fields, with the
same Pong count, over 240 paired deals each.

**Named before the run:**

- Stage one: 600 of the 2,193 0-Joker pack questions whose best is Pong, hashed by id, at 256
  play-outs, simple bots against the no-Joker Coach.
- Stage two: Pong bars 0, 1.5 and 3 against the shipped 0.4, 2,000 deals per seat in all four
  chairs, 8,000 paired deals each. Deals 7710001 to 7712000 against three Coaches, 7720001 to 7722000
  against the recorded personalities. A bar is called better only at more than two standard errors.

**Status:** RUN, 2026-09-17, finished 02:43.

**Findings:**

1. **Stage one.** With the Coach in the play-outs, 73 of the 600 Pong answers clearly flip to pass
   (12.2%), and 40 of those 73 are late in the hand, against 194 of 600 positions overall. The simple
   bots still say Pong on 594 of 600, which is the control. Pong's value over passing falls from +3.35
   to +2.11 on average, so the Coach bots like these Pongs less, not usually enough to pass.
2. **Stage two.** Passing more Pongs never won money:

       bar   against three Coaches      against the recorded players
       0     -0.005 +/- 0.023           +0.043 +/- 0.029   (calls more)
       1.5   -0.014 +/- 0.035           -0.040 +/- 0.038
       3     -0.046 +/- 0.051           -0.107 +/- 0.053   (t = -2.0, calls fewest)

   Nothing beats the shipped 0.4 by two standard errors. The bar that passes the most Pongs is the
   only result past two standard errors, and it loses.
3. **So the pack's Pong answers stand**, and the Coach-played judge's pass verdicts on them are not
   borne out in money. The shipped bar of 0.4 stays.

**What it does not establish:** Stage two tests a bar applied to every Pong, not the 73 flipped
positions one by one. A rule that passes exactly those, late in the hand, was not played.


### The claim judge

**Uncertainty addressed:** `R-001`. Whether the whole-hand judge can be trusted on the decision to
take a win or make a call.

**Origin:** Agent proposal, recorded in `NEXT.md` on 2026-09-12 and in `PLAN.md` Phase 7. Run on
2026-09-13.

**Why construction rather than another method:** Nothing could be read that answers it. The claim
in the record was about a mechanism inside the play-outs, and the only way to test a mechanism is
to vary it and see whether the number moves.

**What was built:** Two tools in `datagen/`, both small and both kept. `winprice.ts` takes recorded
positions where a win was on offer and could be declined, and judges each under interchangeable
arms on the same seed and the same play-outs - a different rollout opponent, or the hand's real
hidden tiles instead of guessed ones. `declinewin.ts` runs the project's paired-money design over
a coach that declines cheap wins against one that does not.

**Findings, 2026-09-13:**

1. **The stated cause is wrong.** Swapping the rollout opponents for the Coach moves the gap by
   -0.48 against a standard error of 0.35, and in the opposite direction to the prediction.
2. **The hidden-tile guess is not the cause either.** Using the hand's real tiles moves it by
   +1.13 ± 1.15, and of the 23 positions where the judge declines a win, the real tiles agree with
   it on 19.
3. **The judge is nonetheless wrong.** Declining cheap wins loses money at every threshold and
   against both fields, 0.229 chips a game under two *Tai* and 0.944 under three, over 8,000
   paired deals each. An effect that grows with the dose is a real one.
4. **So the cause is unknown.** Three explanations are excluded and none replaces them.

**What was accepted into the project:** `D-027`, the review no longer marks taking a win as a
mistake. `R-001` rewritten and narrowed. The `FINDINGS.md` entry replaced - the old one asserted
a mechanism from a single played hand, and the mechanism was not there.

**What it does not establish:** Anything about *Pong* and *Chow*. The money test covers declining
a win, not calling a tile, and the two are different decisions. Saying so is the point: the
previous entry generalised from one hand to every claim, and that is what went wrong.

**Status:** RUN, and it produced a decision. The follow-on - finding the cause, and the same money
design applied to calling - is recorded in `R-001` under Resolution Method, not here.

