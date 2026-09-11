# PROJECT

## Purpose of this file

This file is the primary orientation document for the project. Read it before interpreting any
other project file.

## It answers

What is this project and why does it exist?

## What belongs here

Project-level understanding: the name, the owner, the background, the problem, the purpose, the
intended outcomes, the scope and what is out of it, the context, the stakeholders, the known
constraints, the current lifecycle phase, and the operational facts that apply.

## What does not belong here

- What the app must do in detail; that is `SPEC.md` and `FEATURES.md`.
- Who the users are in detail; that is `USERS.md`.
- Delivery order; that is `PLAN.md`.
- Current state; that is `STATUS.md`.
- What is not known; that is `OPEN-ITEMS.md`.
- The measurements; those are `FINDINGS.md`, registered in `RESEARCH.md`.

## When to update

When the purpose, ownership, scope, context, constraints, lifecycle phase or intended outcome
changes. Not after routine work.

## Relationship to other files

Everything downstream should trace back to something here. `Framework - Mahjong.md` is the plan
this project exists to produce, and the app exists to serve that plan. `STATUS.md` says where the
project is within the phase recorded here. `DECISIONS.md` says why the app is shaped as it is.
The parent project's `../CLAUDE.md` carries the method every plan here has to use and the house
rules for writing.

---

## Project

### Name

The Singapore Mahjong trainer. The app was first called "Which tile?" and the repository is
`SzeThoChangs/Mahjong`. It is live at `https://szethochangs.github.io/Mahjong/`.

### Client / Owner

Changs. He is the owner, the main user and the only human the app has been tested against.

### Background

This is one skill under a parent project, one folder up, about how people learn fast. The parent
started from a talk, stripped it to nine ideas backed by studies, tried them on chess, and found
that the chess plan was really a plan for any skill that comes down to recognising patterns and
making decisions under pressure. Chess was written first. Mahjong is the second game, and it is
the one where the plan had to become software.

The project began on 2026-08-23 with an engine, a knowledge base built from two of the owner's
books, and a plan for a discard trainer. In three weeks it grew a self-play data generator, a
play-out grader, a coach, a web app with the five parts of the parent's training system, three
question packs of about ten thousand verified positions each, a phone layout, and a draft
training plan. Along the way it measured every rule in the playbook and found eighteen of them
false. The measured record is `FINDINGS.md`.

### Problem

Mahjong lies. A correct discard deals in and a reckless one wins the hand, over and over, and
nothing you can see in a single hand tells you whether you played it well. The parent's method
needs honest feedback, a pattern library and a mistake record, and for this game none of those
can be a book or a notebook: the feedback has to come from playing each option out many times,
the library has to say how much each rule is worth at this table, and the record has to schedule
itself.

### Purpose

To produce a training plan for Singapore mahjong that the owner can follow for an hour a day, and
to build the software that the plan needs in order to be followable: a grader that judges a
decision against a measured best rather than against its result, a library of patterns each with
a measured verdict, drills for spotting and working out, mixed practice on real positions, and a
mistake record that sorts by cause and comes back on a schedule.

### Intended Outcomes

- The owner gets measurably better at the tables he plays, judged by his Train score against the
  play-outs and by the leading cause in his mistake record changing over time.
- The plan in `Framework - Mahjong.md` is one he has reviewed and follows three days a week.
- Friends can install the app on a phone and use it with no account and no signal.
- The method itself, committing to an answer before checking it and sorting mistakes by cause,
  is learned here and carried to the next game.

### High-Level Scope

Four packages in one repository. `engine/` is the rules: tiles, wall, win detection, tai scoring,
payouts, a resumable game state, and a configurable rules layer read from
`data/table.config.json`. `solver/` is the coach: the book evaluators, target selection, discard
ranking, explanations, the tips and their detectors, and the play-out re-judge shared with the
phone. `datagen/` is the self-play generator and the play-out grader that builds the packs, plus
the tools that measured everything in `FINDINGS.md`. `web/` is the app: Train, Spot, Your hand,
Review, Tips, Film room, Play and Table setup, as an installable offline web app.

Also in scope: the three question packs for the three tables the owner plays; the framework; the
knowledge base in `knowledge/`; and now a prototype folder where new features are tried before
production code is written (D-025).

### Out of Scope

- Accounts, login, a server or sync; each phone keeps its own record (D-016).
- Pricing measured reads into the coach; that side is closed (D-005).
- A fitted model in place of the book coach (D-004).
- A Rust or WASM port (D-026).
- Tables the owner does not play; the no-joker minimum-2 pack was retired (D-010).
- A full game with sessions, rotation and a running score, until the first hand has been played
  and its review trusted (D-021, `PLAN.md`).
- Publishing the source books, which stay git-ignored (D-024).

### Business Context

A personal project with no client, no budget and no deadline. Hosting is GitHub Pages on a free
account, which needs the repository public. Compute is the owner's Mac, where grading runs at
about eight hours per 480,000 decisions and one long build at a time. Several Claude sessions
have worked in the same tree at once, which is why the commit discipline in `NEXT.md` exists.

### Key Stakeholders

| Person | Role | Involvement |
|---|---|---|
| Changs | Owner, main user, house-rules authority | Confirms the table rules, decides what is built, reviews the framework, tests on his phone |
| Friends | Testers | Install on their phones; their feedback is awaited; no records collected yet |
| Claude sessions | Builder and measurer | Build, measure, write the record; several may run at once |

### Known Constraints

- The training reader trains for about an hour a day, and where several subjects run at once the
  plan must say which days it wants. The framework asks for Tuesday, Thursday and Saturday, with
  chess running first on other days.
- Every verdict must respect its error bar. A difference smaller than twice its standard error is
  not a difference, and nothing ships to the coach without a paired money result on ranges named
  in advance (D-002, D-003).
- The app runs entirely in the browser with no backend. Everything it remembers is in local
  storage (R-005).
- The repository must stay public and the copyrighted folders must stay ignored (DEP-001).
- The repository path contains a colon, which breaks pnpm's `.bin` shims; tools are called by
  their real paths and `check.sh` runs what CI runs.
- Packs are 14 to 19 MB each and are fetched a shard at a time; the phone must never parse a
  whole pack (D-015).
- Writing for the reader follows the parent's house rules: plain English, full sentences, no
  motivational filler.

### Current Lifecycle Phase

LIVE.

The production app is built, deployed at a public URL, installable, working offline, and in use
by the owner and by friends. The owner said on 2026-09-12 that the project has passed BASELINE
(CONFIRMED). The deployment and the use are OBSERVED from `NEXT.md`, the Pages workflow and the
commit history. It reads as LIVE rather than VERIFY because the site has been released and is
being used for its purpose, and further product change continues inside it, which Part 6 of the
recipe says is normal for LIVE. What has not happened, and stays open inside this phase, is the
VERIFY-shaped question of whether the training works on a human (A-001); the software's own
verification, CI on every push and every pack question judged twice, is recorded in `STATUS.md`.

One part of production carries the label "prototype": the Play tab, one hand against three
coaches. It is the first thing the `prototype/` folder is to carry forward under D-025.

---

## Operational Information

### Dates

| | Date |
|---|---|
| Project start | 2026-08-23, the first commit |
| First public deployment | 2026-09-10, GitHub Pages |
| Target end | None; the framework runs indefinitely |

### Team

| Person | Role | Allocation |
|---|---|---|
| Changs | Owner and user | About an hour a day for training; decisions as they come up |
| Claude sessions | Build and measurement | As directed; several in parallel at times |

### Milestones

| Milestone | Target | Status |
|---|---|---|
| Engine, knowledge base, data generator and grader | 2026-08-30 | Done |
| Coach measured and closed at its ceiling | 2026-09-06 | Done |
| Every playbook rule given a verdict | 2026-09-06 | Done |
| Framework first written | 2026-09-06 | Done, redrafted 2026-09-11, awaiting review |
| Site live, installable, offline | 2026-09-10 | Done |
| Phone pass complete | 2026-09-11 | Done, two items open |
| Packs at ten thousand a table, every question verified twice | 2026-09-11 | Done |
| First whole hand playable and reviewable | 2026-09-12 | Done, labelled prototype |
| Owner's week of use and verdict on the Play loop | About 2026-09-19 | Waiting on the owner |
