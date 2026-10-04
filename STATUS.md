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

2026-09-27

## Current Phase

LIVE, and inside it Phase 6 of `PLAN.md` — *Use it*. See `PROJECT.md` for why the phase is LIVE.

## Current Focus

The week's job, chosen by Changs on 2026-09-27: a Coach that takes money off the shipped one at his
table, gated on the paired money test rather than on accuracy (`PROTOTYPE.md`, "Can anything beat the
Coach for money at Changs's table?"). The win job is finished and on the site (`D-033`). Whether
"hard only" is hard enough for him (`A-005`) still waits on his use.

## In Progress

| Work | Owner / Agent | State |
|---|---|---|
| Using the hard questions and saying whether they are hard enough | Changs | Started 2026-09-16 |
| `D-037`: every pack re-judged with the Coach in the play-outs | Agent | Done: every pack on the site is Coach-judged (2026-10-02) |

The chain is grading `strong-min2` (`D-038`) on the Mac, six workers, from 2026-10-04 10:16; 40 hours, then build and finish. The Mac needs the lid open and power until about 2026-10-06 midday.

## Recently Completed

- 2026-10-04: `min1` retired from the pack buttons (`D-039`), files kept for Review.
- 2026-10-04: `strong-min1` on the site, 1,922 questions, the first pack judged by the Coach from the first candidate.
- 2026-10-03: a claimed tile leaves the pile on screen; Changs had counted five 8萬 on one table.
- 2026-10-02: the `coach` pack judged by the Coach and on the site (535 best answers moved); `D-037` is carried out for every pack. The grader gained a time budget after the new packs' chain failed on a `timeout` macOS does not have.
- 2026-10-01: the table counted once: a claimed discard was counted twice everywhere and wrapped the unseen count to 255; fixed at the source, measured at the noise floor for money (+0.095 +/- 0.059) and verdicts (1 of 300 past the bar).
- 2026-10-01: `min1-nowild` and `min1` judged by the Coach and on the site (576 and 601 best answers moved).
- 2026-09-30: the 615 strong-table verdicts that fell inside the noise judged again at 512 play-outs: 287 clear again, 257 still close, 71 the other way; the 512 answers on the site.
- 2026-09-30: the whole strong-table pack judged by the Coach and on the site; 474 best answers moved, 194 confident mistake verdicts reversed.
- 2026-09-29: the strong-table pack's first 49 shards re-judged with the Coach and on the site (4,931 questions, 221 best answers moved); the other 59 still say they rest on simple bots.
- 2026-09-28: no answer from simple bots (`D-037`): the Challenge and Play judges run the Coach; the packs are being re-judged the same way.
- 2026-09-28: the strong-table pack regenerated with the new Coach and put on the site (10,751 questions); the colour-plan line measured and kept; the shipped discard and claim rules checked identical to the measured bots.
- 2026-09-28: the claim model shipped inside the Coach's claim rule (`D-036`), pooled +0.249 chips a game against three Coaches; the Chow bar and the colour-plan grades measured and left as they were.
- 2026-09-28: a session on the Play tab, hands in a row with the dealer moving and chips carried; the fed count and the wind turn measured on the built app.
- 2026-09-28: candidate B, the fitted discard policy inside the Coach's cheap plans, clears the money gate twice on both fields and ships (`D-035`); the Play review answers a win on offer by the rule both ways; friends' records and Send my record on Table setup (`A-007`); the training plan brought up to date.
- 2026-09-27: the three packs rebuilt with the win rule and put on the site (10,547, 10,528 and 10,291 questions; every win-offering question marked); the strong-table pack built, 10,652 questions, and on the site as a fourth pack; ten passes in `MISTAKES.md`.
- 2026-09-26: a win on offer is answered by rule, written into the pack builder and taught on the Train screen (`D-033`); ten passes recorded in `MISTAKES.md`, two defects found and fixed; the banned middle dot removed from the five project files that still held it.
- 2026-09-24: the claims cleared. With every win taken, following the judge on Pong, Chow and pass is worth +0.150, +0.102 and +0.338 chips a game at the three tables, and the Coach-played judge loses more on wins than the simple one (`PROTOTYPE.md`, `FINDINGS.md`).
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
