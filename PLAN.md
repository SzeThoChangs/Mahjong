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

- GitHub repo for `Mahjong/`. **`.gitignore` the two screenshot folders, the
  `.acsm`, and `node_modules`** — the book pages are copyrighted and must not be
  pushed. Everything else (engine, solver, data, knowledge, tile images) is ours.
- Vercel project → root `web/`, build `pnpm build`, output `dist/`. Preview URL
  on every push.

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

1. **Lower-variance target.** The 9.8-chip outcome SD is dominated by whether the hand is won and
   at what tai, not by the discard. Evaluating a shrunk statistic (win probability, or winsorised
   chips) and pricing afterwards attacks the variance at its source. The recorded `mix` already
   makes any re-pricing possible without re-simulating.
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

Engine: rules layer (`engine/src/rules.ts`), recorder hooks, resumable `GameState` (snapshot / resume), `Wall.fromSnapshot`.
Engine rules now include robbing the kong, Seven/Eight-Flower and all-animals specials, and Pay-All liability (config-gated, off by default pending house-rule confirmation).
