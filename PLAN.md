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

# Status — 2026-08-23 (data-generation programme)

The trainer plan above still stands; the project also now carries the three-layer data programme.

| Layer | Status |
|---|---|
| 1 — Data generator (`datagen/`) | **Done, milestone met**: 100,000 hands / 8.22M decisions generated, 0 illegal actions, chips net zero, every hand replays from its seed; 5 bot personalities with 70/15/10/5 controlled randomness; JSONL.gz + Parquet; validation stats + flags. |
| 2 — Evaluator (`datagen/src/evaluate.ts`) | **Running at scale**: `data/gen/run100k-table` = 100k hands under the confirmed table rules (jokers, shooter-pays, pay-all, 8-flower) with **99,980 evaluated decisions** (adaptive 128 paired rollouts, ShantenBot policy); 82% of decisions have a clear best action. Resumable, crash-tolerant. |
| 3 — Model | Not started. |

Engine: rules layer (`engine/src/rules.ts`), recorder hooks, resumable `GameState` (snapshot / resume), `Wall.fromSnapshot`.
Engine rules now include robbing the kong, Seven/Eight-Flower and all-animals specials, and Pay-All liability (config-gated, off by default pending house-rule confirmation).
