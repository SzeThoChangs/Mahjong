# USERS

## Purpose of this file

This file defines the people, roles and user groups that materially affect the product.

## It answers

*Who are we building for?*

## What belongs here

One section per materially different user type or role, describing actual responsibilities and
behaviour: context, goals, responsibilities, needs, pain points, relevant permissions or
limitations, and the journeys, workflows and features that matter to them.

## What does not belong here

Detailed permission rules go in `SPEC.md`. End-to-end experiences go in `USER-JOURNEYS.md`.
Task-level steps go in `WORKFLOWS.md`. Unknown user information goes in `OPEN-ITEMS.md`.

Do not invent personas. Do not invent demographics, motivations, pain points or behaviours that
project information does not support. Describe real roles, not characters.

## How to decide whether two users are separate

Keep them separate when they differ materially in permissions, workflows, responsibilities or
information access. Otherwise do not create the category. If the product genuinely has one user,
say so. If one person operates in materially different modes, those modes may be worth separating,
but only where the difference actually changes what gets built.

## When to update

When a user type is added, removed or materially changes; when responsibilities, permissions or
needs change; when prototype or user testing corrects an understanding recorded here.

## Relationship to other files

Users are referenced by `USER-JOURNEYS.md` (whose journey), `WORKFLOWS.md` (primary actor) and
`USER-STORIES.md` (the "as a…"). Permissions stated loosely here are specified precisely in
`SPEC.md`.

---

## How to read the evidence marks

Every statement below carries one of the states from the bootstrap recipe. CONFIRMED means Changs
said it or a project file records him saying it. OBSERVED means the code or data shows it, without
proof it was intended. ASSUMED means it is relied on without confirmation. UNRESOLVED means nobody
knows yet.

This product has two real user groups and nothing else the evidence supports. The parent project's
`../CLAUDE.md` says the reader of every plan is Changs, so the framework has no separate audience.
A future reader of `Framework - Mahjong.md` other than Changs is ASSUMED possible and is not a user
of the app, so no entry is made for one.

---

## Users

### U-001 — Changs, the trainer (and the owner)

**Context:** Changs owns the project and is the one person the training plan is written for. He
trains for about an hour a day across several skills, of which mahjong is one; the framework asks
for three of those hours a week, on Tuesday, Thursday and Saturday (CONFIRMED, `../CLAUDE.md` and
`Framework - Mahjong.md`, "The practice hour"). He plays Singapore mahjong at more than one table:
with four Jokers and without, and at a 2 Tai minimum and at 1 (CONFIRMED, `TABLE-VARIANTS.md`).
He uses the app on a phone as well as on the Mac, and the phone is where the layout work was aimed
(CONFIRMED, `MOBILE.md`).

**Goals:** To get measurably better at the decisions the game turns on, judged against what was
correct rather than against whether the hand won, because in this game a good decision loses all
the time (CONFIRMED, `Framework - Mahjong.md`, "How honest the feedback is"). He said "I want the
best coach/trainer", which is the sentence that settled the merge of the two practice tabs
(CONFIRMED, `NEXT.md`, "The merge").

**Responsibilities:** As the trainer, to run the practice hour, sort every mistake by why it
happened, and keep the record safe by saving it to a file at the end of the first week and then
whenever he remembers (CONFIRMED, `Framework - Mahjong.md`, "Running the app"). As the owner, to
make the decisions the project cannot make for itself: which packs stay on the site, which words
the app uses, whether the phone layout is right, and what gets built next (CONFIRMED, `NEXT.md`,
"What needs Changs" and "Decided, so do not reopen"; `JARGON.md`).

**Needs:** Honest grading, which means play-outs rather than opinion, and a clear label whenever
the weaker judge is the one marking (CONFIRMED, `NEXT.md`, "The merge"). A screen that fits a
360px phone with 48px targets (CONFIRMED, `MOBILE.md`). A way to dispute a verdict he thinks is
wrong, since he has already been right once when the pack was wrong (CONFIRMED, `FINDINGS.md`,
"The packs overstate their certainty"). The plain English of the parent project's house rules in
everything he reads (CONFIRMED, `../CLAUDE.md`).

**Pain Points:** The record lives only in one browser, so a cleared cache or a second device splits
or loses it; the export button is the only bridge (OBSERVED, `web/src/lib/backup.ts`; the one
device or two question is raised in `PLAN.md` and not recorded as settled for his own devices,
UNRESOLVED). A tester's phone can sit on a stale version behind the service worker, which is why
the update bar exists (CONFIRMED, `MOBILE.md`). The four-Joker, 2 Tai numbers are the only fully
measured ones, so at his other tables some advice is measured at the wrong game (CONFIRMED,
`TABLE-VARIANTS.md`).

**Permissions / Limitations:** There are no accounts and no server; everything he does stays in the
browser he did it in (CONFIRMED, `MOBILE.md`, "Not doing: accounts"). He can edit the table's money
and rules on the Table setup tab, and those settings drive the Play tab and the Challenge button's
pricing (OBSERVED, `web/src/components/TableSetup.tsx`, `web/src/lib/rejudge.ts`).

**A second mode, worth naming:** Changs also operates the machinery behind the app, with an agent:
generating runs, building and verifying packs, and pushing deploys. That mode uses `datagen/`,
`solver/` and `check.sh` rather than the app, and its traps are written up in `NEXT.md`. It is not
separated into its own user because it does not change what the app has to do; it changes what the
repository has to do, which `PLAN.md` and `NEXT.md` own.

**Related Journeys:** UJ-001, UJ-002, UJ-003, UJ-004, UJ-005.

**Related Workflows:** WF-001 to WF-014.

**Related Features:** F-001 to F-016; the proposed F-017 to F-020 are his to accept.

**Open Items:** Whether he trains on one device or two (UNRESOLVED, `PLAN.md`, "The thing to decide
before any of this"). Whether the practice hour keeps its 25/15 split between two practice tabs now
that the app has one; see the CONFLICT under UJ-002. The four things `NEXT.md` lists under "What
needs Changs".

---

### U-002 — Friends testing on their phones

**Context:** Changs has friends trying the app on their own phones. Each phone keeps its own record,
separate by construction, and there is no login (CONFIRMED, `MOBILE.md`, "Not doing: accounts";
`NEXT.md`, "Decided, so do not reopen"). The hand log on the Review tab was built for them, so that
a friend can reopen a hand they played and see the answer and the reasoning (CONFIRMED, `NEXT.md`,
"Where things are").

**Goals:** Not recorded. Whether they are learning the game, checking the app, or humouring Changs
is UNRESOLVED, and nothing here should be built on a guess about it.

**Responsibilities:** To use the app and say what they find. Nothing else is recorded.

**Needs:** The same phone layout as U-001. A way to get their record to Changs if it turns out to be
worth collecting; the intended shape is a single "send this to Changs" button that posts the same
JSON the export writes, described as an afternoon's work and not built (CONFIRMED as the intended
shape, `MOBILE.md`; PROPOSED as a feature, F-018). An update bar so a fix reaches them without
anyone reinstalling (CONFIRMED, `MOBILE.md`, item 4, built 2026-09-11).

**Pain Points:** Their records are on their phones and nowhere else, so nothing they learn reaches
the project unless they export a file by hand (OBSERVED, `web/src/lib/backup.ts`). On a phone on
mobile data, the first question's cost has not yet been measured; it is "the one number still owed"
(UNRESOLVED, `NEXT.md`).

**Permissions / Limitations:** Identical to U-001 inside the app. They do not operate the machinery
behind it.

**Related Journeys:** UJ-001, UJ-006.

**Related Workflows:** WF-003, WF-007, WF-012, WF-014.

**Related Features:** F-001, F-008, F-013, F-015; F-018 proposed.

**Open Items:** How many friends, which phones, and what they have said so far are not recorded
anywhere in the project (UNRESOLVED). Whether their records should be collected at all is a
decision `MOBILE.md` defers until "after a fortnight" (UNRESOLVED).

---

## Non-Human Actors

These are named because journeys and workflows refer to them. They are not users.

| Actor | Role |
|---|---|
| The Coach | The book-based solver in `solver/`. It explains its reasoning in words, marks the made-up fallback hands, sits in the three other chairs on the Play tab, and answers the Your hand tab. It picks the Measured Best 52.8% of the time on Decisive positions and 36.1% early in a hand (CONFIRMED, `FINDINGS.md` and `Framework - Mahjong.md`). |
| The play-out judge | The rollout evaluator in `solver/src/rejudge.ts`, run at pack-build time and, since 2026-09-11, in a Web Worker on the device. It is the honest grader: every pack verdict, every Challenge, and every Play tab judgement comes from it (CONFIRMED, `FINDINGS.md`, "The Challenge button runs on the phone"). |
| The question packs | Three packs of about ten thousand positions each, one per table Changs plays, every question verified twice on independent play-outs. Built by `datagen/` and served as static files (CONFIRMED, `NEXT.md`, "What landed on 2026-09-11"). |
| The service worker and GitHub Pages | The site deploys on every push to `evaluator-accuracy`; the worker caches every chunk so the app runs offline after one visit and shows an update bar after each deploy (OBSERVED, `.github/workflows/pages.yml`, `web/public/sw.js`, `web/src/lib/update.ts`). |
