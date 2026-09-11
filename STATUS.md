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

2026-09-12

## Current Phase

LIVE. The app is deployed, installable, offline-capable and in use. See `PROJECT.md`.

## Current Focus

Two things. The owner is to use the app for a week, play a few hands on the Play tab, and read the
framework draft; that decides what is built next. And the project pack is being set up: the
canonical files from `P-Starter.md`, with `prototype/` seeded as a snapshot of the current build
under D-025.

## In Progress

| Work | Owner / Agent | State |
|---|---|---|
| The P-Starter bootstrap: the eight files this agent owns, and the definition spine and `NEXT.md`, `CLAUDE.md` and the project interface owned by others | Lead session and its agents | IN PROGRESS, uncommitted |
| `prototype/` seeded as a runnable snapshot of the current build | Lead session | IN PROGRESS, uncommitted |
| The owner's week of use | Changs | Not started as far as the record shows |

The working tree carries uncommitted changes to `.gitignore` and `web/src/App.tsx`, and the
untracked `INPUTS/`, `P-Starter.md` and `prototype/`. Those are the lead's work in flight, not
stray edits.

## Recently Completed

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
- Offline: built, served, server stopped, page reloaded; the app renders, deals and draws its
  tiles with nothing on the network (commit `804a911`, 2026-09-07).
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
