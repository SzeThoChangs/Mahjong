# FEATURES

## Purpose of this file

This file describes the capabilities the product provides.

## It answers

*What can the product do?*

## What belongs here

A feature is a meaningful product capability, distinct enough to be useful when understanding,
designing, prototyping, planning or building the system. Give each a stable identifier (`F-001`)
and never renumber; mark retired features retired rather than deleting the ID. Every feature should
have a reason traceable to the project, users, journeys or specification.

## What does not belong here

Detailed rules go in `SPEC.md`. Detailed processes go in `WORKFLOWS.md`. Buildable slices go in
`USER-STORIES.md`. Unknowns go in `OPEN-ITEMS.md`. Do not create a feature per requirement, and do
not mark a feature confirmed merely because it appears in a prototype.

## When to update

When a capability is added, removed or substantially changed; when status changes; when
dependencies between capabilities change.

## Relationship to other files

Features are referenced by `USER-JOURNEYS.md`, `WORKFLOWS.md` and `USER-STORIES.md`. Their rules
live in `SPEC.md`.

## Prototype demo fields

The prototype in `prototype/` is a runnable snapshot of the live app, whose screens are the app's
own tabs, so a feature's route is the tab that shows it, written as `prototype/app.html#<tab-id>`
with the tab id from `web/src/App.tsx`. The eight ids are `train`, `spot`, `ask`, `review`,
`tips`, `film`, `play` and `table`. The app reads that hash on load and writes it back as
you move between tabs (OBSERVED, `App.tsx`), so every route below opens its own screen rather than
the front page. An unknown hash falls back to Train. A feature with no screen says so and carries
no route.

A status of BUILT below means the code exists on the live site. VERIFIED is used only where a
project file records evidence for the behaviour, and says what it was.

---

## Feature Index

| ID | Feature | Status |
|---|---|---|
| F-001 | Train on measured positions | BUILT |
| F-002 | Aim practice at a Cause | BUILT |
| F-003 | Made-up hand fallback, marked by the Coach | BUILT |
| F-004 | Challenge a verdict on the device | VERIFIED |
| F-005 | Spot drill | BUILT |
| F-006 | Mistake record with spaced review | BUILT |
| F-007 | Sorting by Cause and the diagnosis | BUILT |
| F-008 | Hand log | BUILT |
| F-009 | Tips: the pattern library with verdicts | BUILT |
| F-010 | Your hand | BUILT |
| F-011 | Film room | BUILT |
| F-012 | Table setup | BUILT, with one gap |
| F-013 | Save and restore the record | BUILT |
| F-014 | Play one hand and judge it | BUILT (prototype) |
| F-015 | Installable offline app with a phone layout and update bar | BUILT |
| F-016 | The question packs, three tables, verified twice | VERIFIED |
| F-017 | A claim judge for whole-hand review | PROPOSED |
| F-018 | Send the record to Changs | PROPOSED |
| F-019 | Push-or-fold questions | PROPOSED |
| F-020 | The rest of the game | PROPOSED |

---

## F-001 — Train on measured positions

**Purpose:** Working-it-out practice and mixed practice in one place: real recorded positions, no
label, graded by play-outs rather than by opinion (CONFIRMED, `NEXT.md`, "The merge").

**Users:** U-001, U-002.

**Description:** The Train tab serves a position from a chosen pack, asks which tile to throw, or
claim or pass, or kong or keep, and after the answer shows the verdict, the bars, the Coach's
reasoning, any shape card the position is about, and the position's id (OBSERVED, `Train.tsx`).

**Key Behaviour:** FR-01 to FR-05, BR-03, BR-04, BR-05. Discards go to the record and the log;
claims go to neither.

**Related Journeys:** UJ-002, UJ-003, UJ-006.

**Related Workflows:** WF-003.

**Related User Stories:** US-003, US-016.

**Dependencies:** F-016 for the positions; F-003 as the fallback; F-006 and F-008 as the sinks.

**Status:** BUILT (2026-09-10 merge, commit `880eb5b`).

**Open Items:** CONFLICT with the framework's two-tab hour, recorded under UJ-002. Whether claims
should reach the record in some form (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#train`

**Demo Group:** The practice hour

**Demo Description:** Tap a tile, see what it was worth against the measured best, and why.

**Demo Persona:** U-001

**New Since Last Demo:** yes

**Prototype Caveat:** Needs the pack files to be present; without them the fallback (F-003) shows.

---

## F-002 — Aim practice at a Cause

**Purpose:** The eighth idea: fix whatever is actually broken. Once the record names a leading Cause,
serve only positions where a real player's throw failed for that reason (CONFIRMED, framework, fifth
stage).

**Users:** U-001.

**Description:** A strip of Cause buttons on Train (the top three from the record, plus whatever
Review sent), a "Practise" button on the Review diagnosis that lands on Train with the filter set,
and a Cause label baked into each pack question at build time so the index can say which shard holds
one (OBSERVED, `Train.tsx`, `Review.tsx`; CONFIRMED design, `MOBILE.md`, "The sharding design").

**Key Behaviour:** FR-03, FR-13. Not applied in claim mode. Only four Causes are practisable from
packs: did not see it, miscounted, misjudged the safety, wrong plan (OBSERVED, `PRACTISABLE`).

**Related Journeys:** UJ-002, UJ-003.

**Related Workflows:** WF-004.

**Related User Stories:** US-005.

**Dependencies:** F-001, F-007, F-016.

**Status:** BUILT.

**Open Items:** None recorded.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#review` (press Practise), then `prototype/app.html#train`

**Demo Group:** The practice hour

**Demo Description:** The record names what keeps going wrong; one press aims the honest grader at it.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** Needs a record with sorted mistakes before the button appears.

---

## F-003 — Made-up hand fallback, marked by the Coach

**Purpose:** Supply when the pack has nothing: a hand on demand, with nothing to download, under a
banner that says it is made up and who marked it (CONFIRMED, `NEXT.md`, "The merge").

**Users:** U-001, U-002.

**Description:** The old Coach-graded practice tab, now loaded on demand only when no pack loads or
the filters leave nothing. It deals from a seed, aims at the chosen Cause where it can find one in
40 deals, grades with the Coach, suggests a Cause from the position on a mistake, and records to the
same record and log with the judge marked "coach" (OBSERVED, `GeneratedHand.tsx`).

**Key Behaviour:** FR-06, BR-03. The banner states the Coach's 52.8% and 36.1% (OBSERVED).

**Related Journeys:** UJ-002.

**Related Workflows:** WF-006.

**Related User Stories:** US-011.

**Dependencies:** F-001.

**Status:** BUILT.

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#train` (choose a Cause the pack does not carry, or run
without packs)

**Demo Group:** The practice hour

**Demo Description:** What the app does when it has no measured position to offer, and how it says so.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** The Coach is right about half the time on positions like these, and the screen
says so.

---

## F-004 — Challenge a verdict on the device

**Purpose:** The one honest answer to "that verdict was wrong" is to judge the position again on
dice it has not seen (CONFIRMED, `FINDINGS.md`).

**Users:** U-001.

**Description:** A button on the Train verdict screen that rebuilds the position from the question
alone, plays out the pick, the best and the runner-up at 512 fresh play-outs each in a Web Worker,
and reports holds, too close to call, or reversed. A charge that does not hold moves the tally and
notes the card and the log (OBSERVED, `rejudge.ts`, `Train.tsx`).

**Key Behaviour:** FR-07, BR-09.

**Related Journeys:** UJ-004.

**Related Workflows:** WF-005.

**Related User Stories:** US-004.

**Dependencies:** F-001, F-016; questions must carry the whole table (packs from 2026-09-06 on).

**Status:** VERIFIED. Evidence: `datagen/src/rejudgecheck.ts` on the min1 pack, 100 of 100
questions rebuilt with identical play-outs on canonical deals; timings measured in the in-app
browser 2026-09-11 (CONFIRMED, `FINDINGS.md`, "The Challenge button runs on the phone").

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#train` (answer, then press Challenge)

**Demo Group:** Disputing a verdict

**Demo Description:** Re-judge a verdict on fresh play-outs, here, with no server, in a few seconds.

**Demo Persona:** U-001

**New Since Last Demo:** yes

**Prototype Caveat:** Runs the real play-outs; a phone takes a few seconds behind a progress bar.

---

## F-005 — Spot drill

**Purpose:** Spotting practice, the second component: seeing is a separate skill from solving
(CONFIRMED, `../CLAUDE.md`; framework, third stage).

**Users:** U-001.

**Description:** A position for 3, 5 or 8 seconds, face down, one of four questions, a score per
question, four seeing Causes for a miss, and a suggestion to move the look once the misses say so
(OBSERVED, `Spot.tsx`, `spotstats.ts`).

**Key Behaviour:** FR-08, FR-09, BR-08.

**Related Journeys:** UJ-002, UJ-003.

**Related Workflows:** WF-002.

**Related User Stories:** US-002.

**Dependencies:** `quiz/spot.json`, built by `datagen/src/spotpack.ts`.

**Status:** BUILT.

**Open Items:** CONFLICT on the starting look (framework eight seconds, tab five), recorded under
WF-002. The claim that spotting is a separate skill is borrowed from chess and untested here; the
per-question scores are what would test it (CONFIRMED, framework, "How much of this we believe").

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#spot`

**Demo Group:** The practice hour

**Demo Description:** Look for five seconds, then say what was there.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** None.

---

## F-006 — Mistake record with spaced review

**Purpose:** The fifth component and the spine of the method: every meaningful mistake comes back
after a day, three days, a week, two weeks and a month, and the thinking is redone rather than the
answer recalled (CONFIRMED, `../CLAUDE.md`).

**Users:** U-001, U-002.

**Description:** The "Due now" view of the Review tab, backed by `mj.mistakes.v1` (OBSERVED,
`Review.tsx`, `mistakes.ts`).

**Key Behaviour:** FR-10, FR-11, BR-01, BR-02, BR-03, BR-06, BR-11.

**Related Journeys:** UJ-002, UJ-004.

**Related Workflows:** WF-001.

**Related User Stories:** US-001.

**Dependencies:** F-001 and F-003 feed it; F-013 protects it; F-016 holds the positions the cards
point at.

**Status:** BUILT.

**Open Items:** Whether Play tab mistakes should enter it (UNRESOLVED, UJ-005).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#review`

**Demo Group:** The practice hour

**Demo Description:** A mistake comes back bare, is worked out again, and moves on or back.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** Needs a record with something due; a fresh browser shows "Nothing to review yet".

---

## F-007 — Sorting by Cause and the diagnosis

**Purpose:** Work out why each mistake happened and point practice at whatever keeps coming up
(CONFIRMED, `../CLAUDE.md`, the eighth idea; framework, "The mistake types").

**Users:** U-001.

**Description:** Eight Causes, offered on a mistake card at review and on a fallback hand at the
moment of the mistake, with a suggestion from the position on the fallback path; a tally by Cause
with the leading one named; a split between play-out and Coach cards; and the leading Spot cause
with a one-line prescription (OBSERVED, `Review.tsx`, `GeneratedHand.tsx`, `solver/src/cause.ts`).

**Key Behaviour:** FR-11, FR-12, FR-13.

**Related Journeys:** UJ-002.

**Related Workflows:** WF-001, WF-006.

**Related User Stories:** US-006.

**Dependencies:** F-006.

**Status:** BUILT.

**Open Items:** CONFLICT: on a pack question the app does not suggest a Cause at the moment of the
mistake; the framework says it does. Recorded under WF-003.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#review`

**Demo Group:** The practice hour

**Demo Description:** Your mistakes, by why they happened, and the one that keeps coming up.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** Needs sorted mistakes.

---

## F-008 — Hand log

**Purpose:** Idea seven: find out what the right answer was and why. A hand that went right leaves
no trace in the record, so the log keeps every answered discard and opens it with the answer shown
(CONFIRMED as purpose, `NEXT.md`; OBSERVED, `history.ts` header).

**Users:** U-002 especially, U-001.

**Description:** "Hands you have played" on the Review tab, last 200, newest first, with the judge
named and any challenge noted (OBSERVED).

**Key Behaviour:** FR-14, BR-05.

**Related Journeys:** UJ-006.

**Related Workflows:** WF-007.

**Related User Stories:** US-008.

**Dependencies:** F-001, F-003, F-016.

**Status:** BUILT. The fetch-in-a-loop bug found while driving it is fixed (CONFIRMED, `NEXT.md`).

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#review` (Hands you have played)

**Demo Group:** Looking back

**Demo Description:** Reopen a hand you played and see the answer and the reasoning straight away.

**Demo Persona:** U-002

**New Since Last Demo:** no

**Prototype Caveat:** Needs hands played on Train first.

---

## F-009 — Tips: the pattern library with verdicts

**Purpose:** The first component, the vocabulary of the skill, with every card carrying a badge
saying how much we believe it, because eighteen of the book's rules are false at this table
(CONFIRMED, framework, "The patterns").

**Users:** U-001.

**Description:** 103 cards in seven phases, each with rule, example blocks where it has tiles,
reasoning, where it stops applying, a verdict badge and a verdict note; an opening line naming the
table every verdict was measured at; a colour key for jargon (OBSERVED, `Tips.tsx`).

**Key Behaviour:** FR-15, FR-16, FR-27. Every number on a card is computed from its hand at load and
a test fails if a card disagrees with its example (OBSERVED, `Tips.tsx` header).

**Related Journeys:** UJ-002, UJ-003.

**Related Workflows:** WF-008.

**Related User Stories:** US-007.

**Dependencies:** `TIPS` in `solver/`.

**Status:** BUILT.

**Open Items:** Per-card labelling of verdicts that differ between tables, `TABLE-VARIANTS.md` task
9, is not done (CONFIRMED). Whether publishing reworded book material openly is acceptable was
flagged as Changs's call and the decision is not recorded (UNRESOLVED, `PLAN.md`).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#tips`

**Demo Group:** The practice hour

**Demo Description:** Every rule in the book, and which ones are wrong here.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** None.

---

## F-010 — Your hand

**Purpose:** Every other tab shows a hand it chose; this one answers about the hand actually held,
which is the only place the question comes up (OBSERVED intent, `AskHand.tsx` header).

**Users:** U-001.

**Description:** Tap in the hand, sets, bonus tiles and tiles seen; set seat, round, turn and
opponents' meld counts; get the Coach's throw with plan and reasons and every other tile ranked; or
set a thrown tile with thirteen in hand and get claim or pass (OBSERVED).

**Key Behaviour:** FR-17, and the validations in `SPEC.md`.

**Related Journeys:** UJ-005.

**Related Workflows:** WF-009.

**Related User Stories:** US-009.

**Dependencies:** The Coach.

**Status:** BUILT. The tab remembering the table between visits, listed as a gap in `PLAN.md`, is
done (OBSERVED, `mahjong.ask.table`).

**Open Items:** Whether Changs uses it at a live table is not recorded (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#ask`

**Demo Group:** At the table

**Demo Description:** Enter the hand you are holding; it says what to throw and why.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** Coach-graded, so an opinion rather than a measurement.

---

## F-011 — Film room

**Purpose:** The sixth stage, reading: watch what a seat's discards said before the hand ended, with
grading attached, which live play would not have (CONFIRMED, framework and `PLAN.md`).

**Users:** U-001.

**Description:** Two exported runs of 180 hands each, filterable by hand type and to evaluated only;
a chosen hand scrubbed decision by decision with the table, the acting seat's hand, EV bars with
error whiskers, and the Coach's words for discards and claims (OBSERVED, `Replay.tsx`).

**Key Behaviour:** FR-18.

**Related Journeys:** UJ-003, UJ-005.

**Related Workflows:** WF-010.

**Related User Stories:** US-010.

**Dependencies:** `replays/` exported by `datagen/src/export.ts`.

**Status:** BUILT.

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#film`

**Demo Group:** Looking back

**Demo Description:** Scrub a real hand and see what every move was worth.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** Bots' hands, not people's.

---

## F-012 — Table setup

**Purpose:** Tell the app which money and rules the table plays, and see what that table rewards
(OBSERVED, `TableSetup.tsx`; `TABLE-VARIANTS.md` user story 2).

**Users:** U-001.

**Description:** Presets, pay mode, ladder, bonuses, kongs, bites, minimum and maximum Tai, Jokers;
"What this table rewards"; "Reading the other seats"; "What pays best" against a comparison
preset; and the backup card (OBSERVED).

**Key Behaviour:** FR-19, FR-20, FR-21.

**Related Journeys:** UJ-001, UJ-003.

**Related Workflows:** WF-011.

**Related User Stories:** US-012, US-020.

**Dependencies:** `profile/money.json`, `reads/money.json`.

**Status:** BUILT, with one gap. The Play tab and the Challenge button read the Joker count and
minimum from here, but the Train tab's "your table" note and the Coach's reasoning on Train read the
static `data/table.config.json` (OBSERVED, `Train.tsx` uses `JOKERS` and `CONFIG.minimum_fan` from
`scenario.ts`; `Play.tsx` uses `money.jokers` and `money.minTai`). So the app is told which table it
is on in one place and listens in some. `TABLE-VARIANTS.md` task 9 asks for the control and for
labelled cards; the control exists, the labelling does not.

**Open Items:** Whether Train should read the Table setup table (UNRESOLVED; nobody has asked).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#table`

**Demo Group:** Setting up

**Demo Description:** Set the money; see which hands are worth chasing at this table.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** The pricing table reflects the recorded rules until the dataset is regenerated.

---

## F-013 — Save and restore the record

**Purpose:** The record is worth most in its third and fourth week, which is when losing it costs
most; there is no server, so a file is the whole backup story (CONFIRMED, framework, "Running the
app"; `backup.ts` header).

**Users:** U-001, U-002.

**Description:** Two buttons on Table setup. Save writes one JSON file named by the day; Restore
replaces what is here and says what it replaced (OBSERVED).

**Key Behaviour:** FR-21; the data rules in `SPEC.md`.

**Related Journeys:** UJ-001, UJ-006.

**Related Workflows:** WF-012.

**Related User Stories:** US-013.

**Dependencies:** None.

**Status:** BUILT.

**Open Items:** The Play hands, the table money and the Your hand settings are not in the file
(OBSERVED; UNRESOLVED whether they should be).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#table`

**Demo Group:** Setting up

**Demo Description:** Your whole record in one file, and back again.

**Demo Persona:** U-001

**New Since Last Demo:** no

**Prototype Caveat:** In a sandboxed viewer the download may be inert.

---

## F-014 — Play one hand and judge it

**Purpose:** What a game gives that no drill can: the whole hand. Built after the parts that carry
the training, and treated as the place everything else gets used (CONFIRMED, `PLAN.md`, "Where this
is going: a game").

**Users:** U-001.

**Description:** Deal one hand against three Coaches at the Table setup table; watch the bots move
or skip to your turn; act on legal actions only; then judge each decision, or all, by play-outs
against the measured best, with the verdicts stored on the hand and earlier hands reopenable
(OBSERVED, `Play.tsx`, `play.ts`).

**Key Behaviour:** FR-22, FR-23, FR-24, BR-10, BR-13.

**Related Journeys:** UJ-003, UJ-005.

**Related Workflows:** WF-013.

**Related User Stories:** US-015.

**Dependencies:** The engine, the Coach, the play-out judge, F-012.

**Status:** BUILT (prototype, commit `636a7a3`, 2026-09-11). Not yet played by Changs; that is the
first thing `NEXT.md` asks of him.

**Open Items:** Does the loop feel like mahjong and is the review worth reading (UNRESOLVED,
`NEXT.md`). The claim judge's bias (F-017). Play mistakes do not enter the record (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#play`

**Demo Group:** The whole hand

**Demo Description:** Play a hand, then find out which of your twenty decisions were wrong.

**Demo Persona:** U-001

**New Since Last Demo:** yes

**Prototype Caveat:** The judge is trusted on throws, not yet on claims; you always sit at seat 0
with East prevailing.

---

## F-015 — Installable offline app with a phone layout and update bar

**Purpose:** The trainer on a phone, built for a 360px screen, working with no signal, and never
stuck on a stale version while friends are testing (CONFIRMED, `MOBILE.md`).

**Users:** U-001, U-002.

**Description:** A manifest and service worker; on-demand chunks precached from a build-written
list; a bottom bar of four with More for the other four under 640px; 48px targets and safe-area
insets; a Reload bar after each deploy with an hourly foreground check; a load guard for a chunk that
fails to arrive (OBSERVED, `App.tsx`, `update.ts`, `phone.ts`, `sw.js`, `manifest.webmanifest`).

**Key Behaviour:** FR-25, FR-26, and the non-functional rules in `SPEC.md`.

**Related Journeys:** UJ-001, UJ-006.

**Related Workflows:** WF-014.

**Related User Stories:** US-014.

**Dependencies:** GitHub Pages.

**Status:** BUILT (2026-09-11, commit `2caa444`).

**Open Items:** CONFLICT: `MOBILE.md` and `NEXT.md` list "are the four primary tabs Train, Spot,
Review and Tips?" as open, while `App.tsx` implements exactly those four with a comment saying it
was settled in `MOBILE.md`. The code is OBSERVED; the intent is UNRESOLVED. Also: the late-game table
at 360px (UNRESOLVED, `NEXT.md`); the 4G first-question number (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#train` (narrow the window under 640px for the bottom bar)

**Demo Group:** Setting up

**Demo Description:** The same app on a phone: bottom bar, thumb-sized targets, offline.

**Demo Persona:** U-002

**New Since Last Demo:** yes

**Prototype Caveat:** The service worker registers only on a built app, not in dev.

---

## F-016 — The question packs, three tables, verified twice

**Purpose:** The honest grader's supply: about ten thousand Decisive positions on each of the three
tables Changs plays, every one having cleared two standard errors on two independent sets of
play-outs (CONFIRMED, `NEXT.md`, "What landed on 2026-09-11").

**Users:** Everything that grades; not a screen.

**Description:** `coach` (4 Jokers, min 2, 10,500), `min1` (4 Jokers, min 1, 10,473), `min1-nowild`
(0 Jokers, min 1, 10,257), sharded by a hash of the question id with the Cause baked in, listed in
`quiz/index.json` (OBSERVED). Built by `datagen/src/quizpack.ts` with `--mix decisive` and
`--verify 512` (CONFIRMED).

**Key Behaviour:** BR-07, BR-11, BR-12; the data rules in `SPEC.md`.

**Related Journeys:** UJ-004.

**Related Workflows:** WF-003, WF-005.

**Related User Stories:** US-019.

**Dependencies:** `data/gen/` runs, which are git-ignored and live only on the Mac.

**Status:** VERIFIED. Evidence: the verify pass held 10,500 / 10,473 / 10,257 of 12,800 admitted,
with every earlier question id surviving (CONFIRMED, `FINDINGS.md`, "The packs overstate their
certainty", built and measured 2026-09-11).

**Open Items:** The pack phase mix leans mid-hand, 50% against 40% in the run (CONFIRMED, `NEXT.md`,
"Smaller"). The no-Joker pack cannot grow without more grading (CONFIRMED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** No screen of its own; visible through `prototype/app.html#train`.

**Demo Group:** Behind the scenes

**Demo Description:** Not demonstrated directly.

**Demo Persona:** None.

**New Since Last Demo:** yes

**Prototype Caveat:** The prototype carries the pack files as static data; the build tooling is not
part of it.

---

## F-017 — A claim judge for whole-hand review

**Purpose:** The Play review under-prices taking a win or making a call, because the play-out bots
never fold and rarely win first (CONFIRMED problem, `FINDINGS.md`, "The whole-hand judge is honest
on throws and not yet on claims").

**Users:** U-001.

**Description:** A stronger rollout policy for claim questions, measured against the known claim
results, that calling beats passing 72% of the time unconditionally and 88% when it makes the hand
Ting Pai, before it is trusted (CONFIRMED as the fix, `NEXT.md`, item 1; PROPOSED as scope, since it
is the agent's ordering and Changs has not agreed to it).

**Key Behaviour:** Not specified.

**Related Journeys:** UJ-005.

**Related Workflows:** WF-013.

**Related User Stories:** US-017.

**Dependencies:** F-014, the play-out judge.

**Status:** PROPOSED.

**Open Items:** Whether it comes before or after Changs has played a few hands (UNRESOLVED;
`NEXT.md` asks him to play first).

### Prototype / Demo

**Prototype Status:** NOT BUILT

**Prototype Route:** None; no screen exists.

---

## F-018 — Send the record to Changs

**Purpose:** If, after a fortnight, friends' records turn out to be worth collecting, one button that
posts the same JSON the export writes (CONFIRMED as the intended shape, `MOBILE.md`, "Not doing:
accounts"; `NEXT.md`, "Smaller").

**Users:** U-002.

**Description:** Described as an afternoon's work; where it would post to is not recorded.

**Key Behaviour:** Not specified. It would be the first thing to leave the browser (see Security
Requirements in `SPEC.md`).

**Related Journeys:** UJ-006.

**Related Workflows:** WF-012.

**Related User Stories:** US-018.

**Dependencies:** F-013; somewhere to post to.

**Status:** PROPOSED.

**Open Items:** Whether the fortnight has passed and what it showed (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** NOT BUILT

**Prototype Route:** None; no screen exists.

---

## F-019 — Push-or-fold questions

**Purpose:** The seventh stage of the framework and the third of `PLAN.md`'s modes: push-or-fold
with opponents' discards shown (CONFIRMED as intended someday, `PLAN.md`, "What you see", mode 3).

**Users:** U-001.

**Description:** Not designed. The Table config's unconfirmed items, unplayable tiles, the Pay-All
threshold and the self-draw bonus, would matter here (CONFIRMED, `PLAN.md`, "Open items").

**Key Behaviour:** Not specified.

**Related Journeys:** UJ-003.

**Related Workflows:** None.

**Related User Stories:** None; write the story when it is asked for.

**Dependencies:** F-016 or the engine.

**Status:** PROPOSED. `NEXT.md` does not list it; it is here so the seventh stage is not forgotten.

**Open Items:** Whether it is wanted before the rest of the game (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** NOT BUILT

**Prototype Route:** None; no screen exists.

---

## F-020 — The rest of the game

**Purpose:** Sessions, seat rotation and a running score, so that Play is a game rather than one
hand (CONFIRMED as next after the loop is trusted, `NEXT.md`, item 2).

**Users:** U-001.

**Description:** Not designed. What it needs that does not exist is a game loop across hands, the
Coach in the other three chairs (done for one hand), and review against the measured best rather
than the result (partly done) (CONFIRMED, `PLAN.md`).

**Key Behaviour:** Not specified.

**Related Journeys:** UJ-005.

**Related Workflows:** WF-013.

**Related User Stories:** None yet.

**Dependencies:** F-014, F-017.

**Status:** PROPOSED.

**Open Items:** Only after the loop has been played and the review is trusted (CONFIRMED ordering).

### Prototype / Demo

**Prototype Status:** NOT BUILT

**Prototype Route:** None; `prototype/app.html#play` shows the one-hand loop only.
