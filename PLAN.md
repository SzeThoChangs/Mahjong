# "Which tile?" — a Singapore Mahjong discard trainer

A web app. It shows you a hand and asks: **which tile do you discard?** You tap
one. It tells you what it would have done and why, in plain language, using the
playbook. Optionally you enter a real hand and ask it.

No game, no bots to play against. The engine is the referee and the solver is
the coach; the page is a question-and-answer loop.

## What you see

```
┌────────────────────────────────────────────────────────────┐
│  Seat: West   Prevailing: East   Turn 14   Min 2 / Max 5   │
│  Your flowers:  [F3] [A:cat]          Fan in hand: 2       │
│                                                            │
│  [2t][3t][4t] [6s][7s][8s] [1w][1w] [E][E] [9w] [5t] [R] [7w]│
│                        ▲ you just drew 7w                  │
│                                                            │
│         Which tile do you discard?  (tap one)              │
└────────────────────────────────────────────────────────────┘
```

After you tap:

```
  You discarded 9w.   ✓ Good — same as the coach.

  Plan: Chicken, fallback armed (2 Fan from F3 + cat).
  Why 9w: lone terminal, no neighbours, not your suit-in-progress.
  Also fine: R (1 point worse).  Mistake: 1w (breaks your only pair).

  Rule 4213 before 12 → after 12.  Win chance at turn 14: ~31%.
```

Three modes, built in this order:

1. **Quiz** — the app deals the hand. Score kept per session. This is the product.
2. **Solver** — you tap in your own 14 tiles + seat/wind/flowers, it answers.
3. **Later** — call-or-pass questions (pong this? chow this?), then push-or-fold
   with opponents' discards shown.

## How the coach decides (v1)

For each of the 14 tiles you could throw:

1. Take the other 13. Score them four ways — Rule 4213 (Chicken), Rule 961
   (Half-Color, best suit), Rule 5313 (All-Chow / Ping Wu), All-Pong ratio.
2. Convert each to chips-per-game using the book's MF2 tables at the current
   Player Turns. Chicken only counts if the fallback is armed (2 Fan in hand,
   or 1 Fan and self-draw-only).
3. Hand value = best of the four, plus a small shape bonus for how many tile
   kinds would improve it next draw.
4. Rank the 14 discards by resulting value. Top one is the answer; anything
   within a small margin is "also fine"; big drops are "mistakes" with a reason
   (breaks your only pair, leaves a single wait, throws a live value tile…).

Every number here already exists in `knowledge/sources/strategy.dataanalytic.json`.
The explanations come from `knowledge/playbook.json` rule text.

**Verification:** the same solver drives a bot in the existing simulator. If
coach-bots beat the baseline bots and walk toward the book's stats (23% win,
14% draws, 48 turns), the advice is real. If not, we know before anyone plays.

## Architecture

```
Mahjong/                      (git repo, pnpm workspace)
├── engine/    exists   rules engine — tiles, wall, win detection, Fan, payouts
├── solver/    new      evaluators, target selection, discard ranking, explanations
├── web/       new      Vite + React + TS, static, tile images in public/tiles
├── data/      exists   tiles, scoring, rules, table.config.json
├── knowledge/ exists   playbook (rule text the UI quotes)
└── assets/    exists   tile PNGs (source for web/public/tiles)
```

- **Static site, no backend.** Everything runs in the browser. Vercel serves it.
- `engine/config.ts` uses `node:fs` — split so the browser build imports the
  table config as JSON and never touches Node APIs.
- Solver is pure TypeScript with no DOM, so the simulator and the web page share it.

## Deploy

`vercel.json` at the repo root does the configuration, and it deploys **from the repo root,
not from `web/`**. That matters: `web/src/lib/scenario.ts` imports
`../../../data/table.config.json`, and the `workspace:*` deps live in `engine/` and `solver/`,
so a `web/`-rooted deploy would need Vercel's "include files outside the root directory"
toggle and fail confusingly without it. Rooting at the repo removes the problem.

```json
{ "framework": "vite", "installCommand": "pnpm install",
  "buildCommand": "pnpm -C web build", "outputDirectory": "web/dist" }
```

Verified locally: `rm -rf web/dist && pnpm -C web build` produces a 24 MB `web/dist` with
`index.html` + hashed `assets/` + the static data directories.

**Steps (the repo has no git remote yet, and the branch is `evaluator-accuracy`):**

1. Create an empty GitHub repo. Do **not** initialise it with any files.
2. `git remote add origin <url>` and push. `.gitignore` is verified clean — `git ls-files`
   shows none of the copyrighted book scans, the `.acsm`, or the 10 GB `data/gen/` are
   tracked, so nothing copyrighted can leave the machine.
3. Vercel → New Project → import the repo. Leave **Root Directory as the repo root**;
   `vercel.json` supplies framework, install, build and output. Nothing else to configure —
   there are no environment variables anywhere in `web/`.
4. Pick the production branch (currently `evaluator-accuracy`; rename to `main` if you want
   the usual default).

**What does not survive the move to production, by design:** `/api/challenge` is a Vite
dev-server middleware and cannot exist on static hosting — it shells out to the evaluator over
the 10 GB `data/gen/`. `RealQuiz` already gates that button behind `import.meta.env.DEV`, and
Vite strips both the button and its handler from the production bundle.

**First load is heavy:** `quiz/money.json` is 10.4 MB and the Real quiz fetches the whole pack
up front. Vercel will compress it in transit and the `Cache-Control` headers in `vercel.json`
keep it cached afterwards, but the first visit on mobile data will be slow. Splitting the pack
is the fix if that ever matters.

## Build order

| # | Step | Done when |
|---|---|---|
| 1 | Repo: git init, .gitignore, pnpm workspace, engine browser-safe | `pnpm -r test` green |
| 2 | Solver: evaluators + MF2 tables + discard ranking + explanations | unit tests on book worked examples; coach-bot beats IsolationBot in sim |
| 3 | Web quiz: deal → tap → verdict + explanation, session score | works locally, tiles render |
| 4 | Vercel deploy | URL you can open on your phone |
| 5 | Solver mode (enter your own hand) | — |
| 6 | Call-or-pass, push-or-fold questions | — |

Step 2 is the real work. Steps 3–4 are a day. Step 1 is an hour.

## Open items

- **Rust / WASM:** not now. Revisit only if we start tuning runs in the millions of games; first fix would be algorithmic in TS (cache evaluations, prune candidates), WASM port of the solver hot loop only after that.

- Tile images: the four animals are low-res (~90px source). Fine for v1; a sharper
  photo later.
- Table config still has unconfirmed items (unplayable tiles, Pay-All threshold,
  self-draw bonus Fan). They don't block the trainer; they'd matter for push/fold.
- Section 6.5 of the book (All-Pong at MF2) was never captured; the solver uses
  MF1 All-Pong tables with the general MF2 correction until it is.


---

# Status — 2026-08-25 (data-generation programme)

The trainer plan above still stands; the project also now carries the three-layer data programme.

| Layer | Status |
|---|---|
| 1 — Data generator (`datagen/`) | **Done, milestone met**: 100,000 hands / 8.22M decisions generated, 0 illegal actions, chips net zero, every hand replays from its seed; 5 bot personalities with 70/15/10/5 controlled randomness; JSONL.gz + Parquet; validation stats + flags. |
| 2 — Evaluator (`datagen/src/evaluate.ts`) | **Run at scale**: `data/gen/run-money2` = 150k hands / 9.03M decisions under the money rules, with **479,912 evaluated decisions** (adaptive 128 paired rollouts, ShantenBot policy), 0 errors, 0 failed workers, 13h 12m. Resumable, crash-tolerant. The five original bot personalities only — `defensive` landed after this run was generated. **The stored `gapSe` in this run is sqrt(k) too small** (fixed in evaluate.ts after the run). Runs now carry `seVersion` in `evals-manifest.json` and `src/se.ts` corrects old ones on read, so every consumer sees the same honest number: **29% of decisions have a clear best action at 1 SE, 9% at 2 SE — 4% for discards, 27% for claims, 72% for self-actions** — on a mean paired SE of 1.10 chips. |
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

The Train tab teaches the coach; the Real quiz teaches the evaluator. `solver/src/coachcheck.ts`
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

Engine: rules layer (`engine/src/rules.ts`), recorder hooks, resumable `GameState` (snapshot / resume), `Wall.fromSnapshot`.
Engine rules now include robbing the kong, Seven/Eight-Flower and all-animals specials, and Pay-All liability (config-gated, off by default pending house-rule confirmation).
