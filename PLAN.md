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

## Where it stands (2026-08-30)

| Layer | Status |
|---|---|
| 1 — Data generator (`datagen/`) | **Done.** 150,000 hands / 8.84M decisions per run, 0 illegal actions, chips net zero, every hand replays from its seed. 6 bot personalities with controlled randomness; JSONL.gz + Parquet; validation stats and flags. |
| 2 — Evaluator (`datagen/src/evaluate.ts`) | **Done.** `data/gen/run-money3` is the reference run: 479,923 evaluated decisions, adaptive 128 paired rollouts, 0 errors, 6h59m, resumable. Its noise floor is the central constraint on everything else — **29% of decisions have a clear best action at 1 SE and 9% at 2 SE; for discards it is 4%, for claims 27%, for self-actions 72%.** |
| 3 — Model | **Closed, negative.** Three models were fitted on the decisive subset and all three were played for money. Discard model −0.544 ± 0.144, claim model +0.001 ± 0.092, both together −0.180 ± 0.145. None beats the hand-written book coach. See [FINDINGS.md](FINDINGS.md). |
| App | **Five tabs, all live.** Train (synthetic quiz on the coach) · Real quiz (recorded positions graded on measured EVs) · Your hand (enter your own hand or a thrown tile and ask) · Film room (replay explorer with EV bars and reasoning) · Table setup (house money ladder). |

**The player is the book coach**, unchanged. Six candidate improvements were measured and none won —
the three models above, plus pricing the flower/animal route to the minimum (−0.18), giving up on a
hand that cannot reach it (−0.039), and folding on threat (no threshold ahead). `DANGER_WEIGHT = 40`
was swept against money and 40 is right.

**What is left, in the order I would do it.**

1. Nothing on the player. Six measured losses say the coach is at a local optimum that heuristic
   tweaks and fitted models do not move.
2. The app is where the wins came from. Obvious gaps: **Your hand** does not remember your table
   between visits, and the quiz packs skew late (46% late-hand against 26% in the run) because
   decisive positions cluster there — the early discards a trainer would add most value on are
   exactly the ones the evaluator cannot separate.
3. If the player is ever revisited: **truncated rollouts plus a terminal value estimate** is the
   only remaining lever that cuts variance and compute together, and it would help most where the
   packs are weakest. Its original justification — a 2.66-chip gap — turned out to be 0.54, so it
   is no longer urgent.

**Engine.** Rules layer (`engine/src/rules.ts`), recorder hooks, resumable `GameState` (snapshot /
resume), `Wall.fromSnapshot`. Includes robbing the kong, Seven/Eight-Flower and all-animals
specials, Pay-All liability (config-gated, off by default pending house-rule confirmation), and
wildcards — count, the no-discard rule, and the withdrawal of the four-wildcard limit hand above
four.
