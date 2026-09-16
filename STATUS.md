# STATUS

## Purpose of this file

This file is the concise current snapshot of the project. It is read at the start of every
session, so length here is paid for repeatedly.

## It answers

Where are we now?

## What belongs here

The last updated date, the current phase, the current focus, work in progress, recently completed
work, what has actually been verified and on what evidence, blockers, open items that matter now,
decisions needed, immediate next actions, and the next milestone.

## What does not belong here

- History; that is `CHANGELOG.md`, and the fine grain is git.
- The session handoff; that is `NEXT.md`.
- Future sequencing; that is `PLAN.md`.
- The measurements; those are `FINDINGS.md`.

## When to update

Whenever the material current state changes. Not mechanically after every session; a session that
moved nothing materially leaves this file alone and updates `NEXT.md`. Do not claim something
works because code exists. `BUILT` and `VERIFIED` are different claims, and `VERIFIED` needs
evidence named beside it.

## Relationship to other files

`PLAN.md` is where the project intends to go; this file is where it is. `NEXT.md` is the handoff
for the current work. `PROJECT.md` records the lifecycle phase; this file says what is happening
inside it. Blockers here point at `OPEN-ITEMS.md`, and decisions needed point at items that will be
recorded in `DECISIONS.md` once made.

---

## Last Updated

2026-09-16

## Current Phase

LIVE, and inside it Phase 6 of `PLAN.md` — *Use it*. See `PROJECT.md` for why the phase is LIVE.

## Current Focus

Changs is using the app and sending what is wrong with it screen by screen. On 2026-09-16 that
produced `D-028` and `D-029`: harder questions by default, his own table (0 Jokers, min 1) as the
default everywhere, the Coach reasoning at the table in play, and a green table. The open question
behind it is whether "hard only" is hard enough for him (`A-005`), which only his use can answer.

## In Progress

| Work | Owner / Agent | State |
|---|---|---|
| Using the hard questions and saying whether they are hard enough | Changs | Started 2026-09-16 |

Nothing is running. The working tree is clean after the 2026-09-16 push.

## Recently Completed

- 2026-09-16: hard only on by default, 0 Jokers and min 1 as the default pack and Table setup, the Coach's reasoning at the table in play, the green felt table, the seat details in the question card, and the dealer badge under the wind on phones (`f34d847`, `1b64f3f`); ten passes for each set recorded in `MISTAKES.md`.
- 2026-09-12: the P-Starter project pack, the project interface and the prototype launchpads, committed as `1257e4e` and `62d55ec` and deployed green.
- 2026-09-12: the Play tab, one whole hand against three coaches with every decision judgeable
  afterwards (commit `636a7a3`); `NEXT.md` rewritten.
- 2026-09-11: every pack question verified on 512 fresh play-outs and the packs rebuilt to about
  ten thousand each (`4c89cc1`, `7287349`); the phone pass, all four items (`2caa444`); the
  framework's mistake types and drill order redrafted (`130fb92`).
- 2026-09-10: the site live on GitHub Pages; Train and Real quiz merged; packs rebuilt with
  `--mix decisive`, sharded with the cause baked in; money and nowild packs retired; the
  installed-app 404 fixed.

## Verified

- CI runs `./check.sh` on every push: four packages typechecked with their own compilers, 94
  engine and 60 solver tests, and the web build. `NEXT.md` on 2026-09-12 reports the site green
  and current at the last deploy, `636a7a3`.
- Every question on the site has cleared the two-standard-error bar twice on independent
  play-outs; the drop rates per pack are in `FINDINGS.md` (2026-09-11).
- The phone's rebuild of a position from a pack question alone gives identical play-outs, outcome
  for outcome, on 100 of 100 questions against the recorded run (`datagen/src/rejudgecheck.ts`,
  2026-09-11).
- Offline: measured 2026-09-13 at 23:49 against the deployed site, `szethochangs.github.io/Mahjong/`,
  in a fresh browser at 393px. The service worker installs and controls the page after one online
  load. With the network cut, the page reloads with no page errors, and ten positions in a row
  answer and load with every tile drawn, 27 to 102 tiles each, none broken. Each run, between 13 and
  84 background requests for `/quiz/coach/` shards fail offline; none stopped a position loading.
  Not checked: a local build of the uncommitted working tree.
- Layout at 360, 393 and 430: no control under 48px, no sideways page scroll (commit `2caa444`).
- The `self` arm of the money harness returns exactly zero, which is the check that every
  chips-per-game figure in `FINDINGS.md` depends on.

Not verified: anything about a human getting better (A-001); the pack-load time on a real phone
over mobile data (Q-005); the Play review on claims, which is known to be biased (R-001).

## Blocked

Nothing is blocked.

## Needs Attention / Decision

- Q-001: after a week, does the Play loop feel like mahjong and is the review worth reading.
- Q-002: the late-game table at 360px, accept the scroll or use a smaller tile.
- Q-003: whether Train, Spot, Review and Tips are the right four primary tabs.
- Q-004: the framework draft, and with it C-003, since the framework still describes two practice
  tabs and the app has one.

## Important Open Items

- R-001: the whole-hand judge under-prices wins and calls; the screen says so.
- R-002: the coach uses the four-joker danger reads and weight at the no-joker table.
- C-003: the framework's practice hour is written for a tab that no longer exists.
- Q-005: the 4G number is still owed.

## Next Actions

1. The lead finishes the bootstrap and the prototype snapshot, and commits them.
2. Changs uses the app for a week, plays a few hands, and reads the framework draft.
3. On his verdict: the claim judge first, then the rest of the game, in the order `PLAN.md` gives.

## Next Milestone

The owner's verdict on the Play loop and the framework, about a week from 2026-09-12.
