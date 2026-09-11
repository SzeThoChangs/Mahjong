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

### The claim judge

**Uncertainty addressed:** `R-001`. The whole-hand judge under-prices taking a win or making a
call, because the play-out bots never fold and rarely win first.

**Origin:** Agent proposal, `PROPOSED`. Recorded as the first item in `NEXT.md` on 2026-09-12 and
in `PLAN.md` Phase 7; the owner has not yet confirmed the order.

**Why construction rather than another method:** Nothing can be read that answers it. The bias is a
property of the rollout policy, and the only way to know whether a stronger policy fixes it is to
build the policy and measure it.

**What it is:** A rollout policy for claim questions that can fold and can take a win, played on
the graded claim positions in the packs and compared with the known results: calling beats
passing 72% of the time unconditionally, 88% when it makes the hand *Ting Pai*, and 6% when it
costs the hand a step.

**What would constitute a useful result:** The new policy reproducing those three numbers within
their error bars on the packs, and then, on the first played hand, no longer calling a pass on an
offered win better than taking it.

**Status:** PROPOSED

**Findings:** None yet.
