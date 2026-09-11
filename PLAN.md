# PLAN

## Purpose of this file

This file describes how the project intends to move from where it is toward the outcomes in
`PROJECT.md`. The app's original roadmap, which this file replaces, is preserved as received at
`INPUTS/PLAN-original-2026-09-12.md`; its architecture and status content now live in
`PROJECT.md` and `STATUS.md`, and its forward-looking content is folded in below.

## It answers

Where are we going, and how are we approaching delivery?

## What belongs here

The delivery approach, the current phase, the phases done and to come, the workstreams, the
sequence and priorities, milestones, how things are tested and verified, how releases happen,
dependencies, and who does what.

## What does not belong here

- The buildable work itself; that is `USER-STORIES.md`.
- Current state; that is `STATUS.md`.
- The immediate next action; that is `NEXT.md`.
- Why an approach was chosen; that is `DECISIONS.md`.
- The measurements that shaped the sequence; those are `FINDINGS.md`.

## Rules

Do not present an uncertain sequence or date as a commitment. Below, `AGREED` means the owner
said so, `TARGET` means the project is aiming at it, and `ESTIMATE` means a guess. Where an order
is the agent's recommendation and the owner has not confirmed it, it is marked `PROPOSED`.

## When to update

When the approach, sequence, phases, priorities, milestones or dependencies materially change.
Not because work progressed; that is `STATUS.md`.

## Relationship to other files

This file sequences the work toward the outcomes in `PROJECT.md`. `STATUS.md` reports actual
position against it. Material plan changes are recorded in `CHANGELOG.md` and justified in
`DECISIONS.md`. The framework, `Framework - Mahjong.md`, is the plan for the owner's training; this
file is the plan for the software and the record that serve it.

---

## Delivery Approach

Measure before building, and spend the cheap measurement before the expensive rebuild. Every
change to the coach is played for money on paired deals before it ships (D-003). Every change to
the packs is checked against the run it came from. Every change to the app is driven in a browser
before it is committed, because three of the last real bugs were found by clicking and none by
reading. From 2026-09-12, a new feature is prototyped in `prototype/` before its production code
is written (D-025).

The app serves the framework, not the other way round. The framework's practice hour is the
product, and the app exists so that hour can be run with honest grading and a self-scheduling
mistake record.

Work ships continuously: a push to `evaluator-accuracy` deploys, and an update bar tells every
installed phone.

## Current Phase

LIVE, in the stretch where the owner uses what exists and says what is wrong with it. The next
build decision waits on that (Q-001, Q-004).

## Phases

### Phase 1 — Foundations

**Objective:** An engine that plays the owner's table legally, a knowledge base from the two
books, a data generator and a play-out grader.

**Work:** Engine with a configurable rules layer; the merged playbook; six bot personalities;
150,000-hand runs with about 480,000 graded decisions; the paired standard error corrected.

**Dependencies:** The owner's table rules (D-001).

**Exit Condition:** Met on 2026-08-30. Hands replay from their seed, chips net to zero, and the
grader's noise floor is measured.

### Phase 2 — The coach and the measured record

**Objective:** Find out what actually improves the book coach, and write down what does not.

**Work:** Three fitted models, six heuristics, the danger sweep, the value-table refits, the
tips scored against the play-outs, the reads measured by replay.

**Dependencies:** Phase 1.

**Exit Condition:** Met on 2026-09-06. The coach is at its family's ceiling on both opponent
populations, the danger side is closed, and every playbook card has a verdict (D-004, D-005,
D-006, D-013).

### Phase 3 — The five-part trainer

**Objective:** The parent's five components, in software, on the owner's table.

**Work:** The Tips page as the library; the Spot drill; the Train tab; the Review tab with causes
and a schedule; the Film room; Your hand; Table setup with save and restore.

**Dependencies:** Phase 2, for the verdicts on the cards.

**Exit Condition:** Met on 2026-09-06, with Train and Real quiz merged on 2026-09-10 (D-012).

### Phase 4 — The owner's tables

**Objective:** Advice that is honest at each table the owner plays.

**Work:** The four-corner comparison; the no-joker pack; packs per table with the table named on
the button; every question verified twice.

**Dependencies:** Phase 1's engine parameterising jokers and the minimum.

**Exit Condition:** Met on 2026-09-11 (D-010, D-011, D-009). What remains from this phase is
R-002, the coach's own reads at the no-joker table, and Q-011, the per-card labels.

### Phase 5 — On the phone

**Objective:** Installable, offline, usable with a thumb, and never parsing a whole pack.

**Work:** The service worker and manifest; sharded packs with the cause baked in; the bottom bar,
48px targets and safe areas; on-demand chunks; the update bar; the Challenge button running on the
device.

**Dependencies:** A public URL, which arrived on 2026-09-10 (D-020).

**Exit Condition:** Met on 2026-09-11 (D-015, D-017, D-018, D-019). Two residuals: Q-002, the
late-game table at 360px, and Q-005, the 4G load time.

### Phase 6 — Use it

**Objective:** Find out whether the thing works for the person it was built for.

**Work:** The owner runs the practice hour for a week and plays a few hands on the Play tab.
Friends test on their phones. The owner reads the framework draft and says what is wrong.

**Dependencies:** The owner's time. `AGREED` as the next thing, per `NEXT.md`.

**Exit Condition:** Answers to Q-001, Q-002, Q-003 and Q-004.

### Phase 7 — The game

**Objective:** The place where everything else gets used: a whole hand, then a session.

**Work:** In the order the agent recommends, `PROPOSED` and not yet confirmed by the owner:

1. The claim judge. A stronger rollout policy for claim questions, measured against the known
   claim results before it is trusted (R-001). Nothing about the game is worth building on a
   review that is wrong about calls.
2. The rest of the game: sessions, rotation, a running score. Only after the loop has been played
   and the review is trusted (D-021).
3. Smaller: an export button that posts a friend's record to Changs; whether to correct the pack
   phase mix (Q-009).

**Dependencies:** Phase 6's answers.

**Exit Condition:** A session can be played and reviewed end to end.

### Later, and deliberately not scheduled

- The coach selecting its reads and danger weight by table (R-002). Measured and unwired; needs
  the owner to say it matters.
- Per-card table labels and a table control in Table setup (Q-011).
- Truncated rollouts with a terminal value, the one lever that cuts variance and compute
  together, if the player is ever revisited. No longer urgent (D-004).
- A per-opponent danger model. Not to be started without a better reason than "finer" (D-005).
- A real login, only if friends' records turn out to be worth collecting (D-016).
- A Rust or WASM port, only past millions of games (D-026).

## Workstreams

| Workstream | Where | What it carries now |
|---|---|---|
| Engine | `engine/` | Stable; the rules layer is read from config |
| Coach | `solver/` | Closed at its ceiling; R-002 is the one known gap |
| Data and grading | `datagen/` | Pack builds with verify; the claim-judge policy would live here and in `solver/src/rejudge.ts` |
| App | `web/` | Phase 7, plus Q-002 and Q-003 |
| Framework | `Framework - Mahjong.md` | Awaiting review; C-003 to fix |
| Record | `FINDINGS.md`, the canonical files | Kept current as work lands |
| Prototype | `prototype/` | Seeded 2026-09-12; new features start here |

## Sequence / Priorities

1. The owner's week of use and his answers (Phase 6).
2. The claim judge (Phase 7, item 1).
3. The rest of the game.
4. The residuals from Phases 4 and 5 as the owner asks for them.

The original roadmap's three modes, quiz, solver and call-or-pass, are all built: Train, Your
hand, and claim questions inside Train. Its "one device or two" question is still open (Q-010).

## Milestones

| Milestone | Target | Confidence | Status |
|---|---|---|---|
| Owner's verdict on the Play loop and the framework | About 2026-09-19 | ESTIMATE | Waiting on the owner |
| Claim judge measured against the known claim results | After that | TARGET | Not started |
| A full session playable and reviewable | After the claim judge | TARGET | Not started |
| Friends' feedback collected | Not set | ESTIMATE | Nothing recorded yet |

## Testing and Verification Approach

`./check.sh` runs what CI runs: each package typechecked with its own compiler, the engine and
solver tests, and the web build. A change to the coach is verified by the money harness with a
`self` arm at exactly zero and ranges named in advance (D-003). A change to a pack is verified by
`quizpack` reporting zero drifted hands, and by the `--verify` pass (D-009). A change to the app
is driven in a browser, and on a phone where the change is about phones. A finding is written to
`FINDINGS.md` with its date, its sample and its error bar before it is quoted anywhere.

## Release / UAT / Maintenance

A push to `evaluator-accuracy` or `main` builds and deploys to GitHub Pages. The service worker is
stamped with a hash of the bundle, so installed phones show a "new version is ready" bar and
reload on demand. There is no staging site; the single-file build in `web/tools/singlefile.mjs`
serves as a fallback for anywhere with no host. Acceptance is the owner and his friends using it.
Maintenance is the pack rebuilds, which cost about two hours a pack with verify and must run one at
a time.

## Dependencies

- The owner's time and his answers (Phase 6).
- GitHub Pages on a free account, which needs the repository public (DEP-001).
- The Mac for grading: about eight hours per 480,000 decisions, one long build at a time, with a
  check for memory hogs first.
- The copyrighted sources staying on the owner's machine (D-024).

## Team / Responsibilities

Changs owns the product, the table rules, the framework's acceptance and every decision listed as
his in `OPEN-ITEMS.md`. Claude sessions build, measure and keep the record; when several run at
once they commit by pathspec and check for running jobs first. Friends test and report.
