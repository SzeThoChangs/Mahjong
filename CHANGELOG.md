# CHANGELOG

## Purpose of this file

This file is the chronological record of material changes to the project, so that a person or an
agent can understand how the project reached its current state without reconstructing it from git,
old file versions, or conversations that no longer exist.

## It answers

What materially changed in the project, and when?

## What belongs here

Material project-level changes: scope added or removed, features added or substantially changed,
prototype findings taken into the definition, major implementation milestones, significant defects
that affected product behaviour, releases and deployments, lifecycle changes, major owner
feedback taken in, and significant changes to the plan. The test is whether understanding the
change would help someone understand how the project got here.

## What does not belong here

- Every commit, edit or formatting change; git has those.
- Routine refactors with no project-level effect.
- Every working session.
- The reasoning behind a decision; that is `DECISIONS.md`, referenced here rather than restated.
- A backlog, a status report or a session log.

## When to update

When a material project change occurs. Not mechanically after every session; many sessions produce
no entry, and several related changes may be one entry. New entries go at the top.

This file was created on 2026-09-12 for a project with 247 commits behind it. The entries below
are the phase-level events that the commit history and `NEXT.md` make unambiguous, each with the
commit that carries it. Finer history before and between them is in git and, for the
measurements, in `FINDINGS.md`. Nothing here was reconstructed from inference.

## Relationship to other files

`STATUS.md` says what is true now. `NEXT.md` says where we stopped and what happens next.
`DECISIONS.md` says what we decided and why. This file says what materially changed and when. Git
says exactly what changed in the files and the code.

---

## Changes

### 2026-09-12 — The project pack is introduced, and the prototype folder is made active

**Changed:**

- The canonical files from `P-Starter.md` are created. `PLAN.md` is replaced by the P-Starter plan;
  the app's original roadmap is preserved as received at `INPUTS/PLAN-original-2026-09-12.md`,
  and the previous `NEXT.md` at `INPUTS/NEXT-original-2026-09-12.md`.
- `prototype/` is seeded as a runnable snapshot of the current build, with its lifecycle state
  `ACTIVE`, against Part 6 of the recipe, by the owner's decision.
- The lifecycle phase is recorded as LIVE, the owner having said the project has passed BASELINE.

**Reason / Source:**

The owner asked for the project to be set up under the P-Starter recipe. The prototype decision is
D-025 and the tension with the recipe is C-001.

**Affected:**

- Every canonical file; `prototype/`; `INPUTS/`.

**Related:**

- D-025, C-001, `PROJECT.md`.

### 2026-09-12 — The Play tab: one whole hand, judged decision by decision

**Changed:**

- A Play tab deals one hand at the owner's table, sits the book coach in the other three chairs,
  and afterwards lets each decision be judged on fresh play-outs against the measured best. One
  hand only; no sessions, rotation or running score. Labelled a prototype. Commit `636a7a3`.
- The screen says where the judge is not to be trusted: on taking a win or making a call.

**Reason / Source:**

The direction recorded on 2026-09-06 (D-021). The judge's bias on claims was measured on the first
played hand and is R-001.

**Affected:**

- `web/src/components/Play.tsx`, `web/src/lib/play.ts`, `web/src/lib/rejudge.ts`.

**Related:**

- D-021, R-001, Q-001.

### 2026-09-11 — Every pack question verified twice, and the phone pass complete

**Changed:**

- `quizpack.ts --verify 512` re-judges every admitted question on fresh play-outs; about a fifth
  were dropped, and the packs were rebuilt admitting 12,800 so they hold about ten thousand each.
  Every earlier question id survives. Commits `4c89cc1` and `7287349`.
- The phone pass, all four items: the bottom bar with 48px targets and safe areas, the square
  table kept at a 22px tile, an update bar after every deploy, on-demand tabs precached by the
  worker, and the Challenge button running in a Web Worker on the device. Commit `2caa444`.
- The framework's mistake types and drill order redrafted from the findings, with a Sources list.
  Commit `130fb92`.

**Reason / Source:**

The verification followed the owner's disputed verdict of 2026-09-10 and the measurement of the
winner's curse (D-009). The phone pass was decided on 2026-09-07 (D-017, D-018, D-019).

**Affected:**

- The three packs; `web/`; `solver/src/rejudge.ts` and `question.ts`; `Framework - Mahjong.md`.

**Related:**

- D-009, D-017, D-018, D-019, Q-002, Q-003, Q-004, Q-005.

### 2026-09-10 — The site goes live, the packs are rebuilt and sharded, and the two practice tabs become one

**Changed:**

- The app is deployed to GitHub Pages at `https://szethochangs.github.io/Mahjong/`, building on
  every push. Paths go through `web/src/lib/asset.ts` so the build works under a project folder.
  Commit `df20e76`, after a single-file build the same day (`dd3e547`) that is now superseded.
- Train and Real quiz are merged into one Train tab judged by the play-outs, with the Coach as a
  labelled fallback. Three bugs found by driving it are fixed in the same commit. Commit `880eb5b`.
- The three packs are rebuilt with `--mix decisive` at about ten thousand questions each
  (`ab5e24f`), the `money` and `nowild` packs are retired from the site (`c7b8f67`), and the packs
  are sharded with the cause label baked in at build time (`8946d51`).
- The installed app opened at the account root, which has no site; fixed by making the manifest's
  paths relative. Found by the owner on his phone. Commit `614a965`.
- The icon becomes the green dragon on maroon (`b097a1c`), and the hand log arrives on the Review
  tab.

**Reason / Source:**

D-020 (Pages), D-012 (the merge, at the owner's request), D-008 and D-010 (the packs), D-015 (the
shards), D-023 (the icon).

**Affected:**

- `.github/workflows/pages.yml`; `web/`; the packs under `web/public/quiz/`; `solver/src/pack.ts`.

**Related:**

- D-008, D-010, D-012, D-015, D-020, D-023, C-002.

### 2026-09-07 — Installable and offline, and the phone layout decided

**Changed:**

- A manifest, icons and a hand-written service worker; the shell, bundle and tile faces
  precached, packs cached on use. Verified by reloading with the server stopped. Commit `804a911`.
- The phone pass written up in `MOBILE.md`: the measurements at 360px, the bottom bar and the
  square table settled on a mockup, and the sharding design. Commits `d746e6d` and `a236654`.

**Reason / Source:**

The owner asked on 2026-09-06 for the app on a phone. D-015, D-016, D-017, D-018, D-019.

**Affected:**

- `web/public/`; `MOBILE.md`.

**Related:**

- RS-008.

### 2026-09-06 — The owner's other tables measured, the framework written, and the coach's programme closed

**Changed:**

- The four-corner comparison, jokers on or off at minimum 1 and 2, on paired deals. The wildcard
  rule dominates; the Tips page and the framework now say which table every verdict was measured
  at; a no-wildcard pack is built. Commits `6fa2c4e`, `a048e53`, `c507be4` and the `wild:` series;
  `TABLE-VARIANTS.md` created.
- `Framework - Mahjong.md` is created: the plan this project exists to produce. Commits `9f6beb0`
  and `f277c12`.
- The committed value table is baked and, the same day, reverted to the row-scaled table after it
  lost against the personality field; the value-table programme is closed at its ceiling. The
  danger side is closed on both fields.
- Every playbook card has a verdict; the playbook is done.
- Game terms are italicised and coloured by kind; *Ting Pai* is adopted. The training record can
  be saved and restored. Every mistake carries a cause, and the play-outs feed the mistake record.

**Reason / Source:**

D-005, D-006, D-011, D-013, D-014, D-022. The measurements are the entries dated 2026-09-06 in
`FINDINGS.md`.

**Affected:**

- `solver/src/tables.ts`; `knowledge/sources/fitted/`; the Tips page; `web/`; the framework.

**Related:**

- RS-001, RS-007, Q-011, R-002.

### 2026-09-02 to 2026-09-05 — The whole playbook on the page, measured, and the trainer's five parts in place

**Changed:**

- Mistakes come back on a schedule (2026-09-02). The Shapes tab becomes the Tips page and carries
  all 102 rules (2026-09-03). The Spot drill, the fifth component, is added (2026-09-04). The
  second change ever to the coach, one constant per value-table row, ships (2026-09-04).
- The tips are scored against the play-outs on both packs, the calling and discard rules against a
  baseline that knows what each throw is, and the reads by replay on two populations (2026-09-03
  to 2026-09-05). Four published verdicts were corrected when the baseline was fixed.
- The learned model's opinion is dropped from the app; the dataset is regenerated from coach-played
  hands; the quiz and film room are rebuilt from it (2026-09-02, 2026-09-03).

**Reason / Source:**

D-004, D-006, D-013, D-014. `FINDINGS.md`, entries dated 2026-09-02 to 2026-09-05.

**Affected:**

- `web/`; `solver/src/tips.ts` and `shapetag.ts`; `datagen/src/tiptest.ts`, `calltest.ts`,
  `discardtest.ts`, `tells.ts`; the packs.

**Related:**

- RS-001, RS-004.

### 2026-09-01 — The first change to the coach, and the book's benchmark shown to be a different game

**Changed:**

- The legal-wait rule ships: a winning tile that leaves the hand under the minimum does not count.
  Measured at +0.048 then, and at +0.018 on fresh deals the next day.
- The study's benchmark of 23% wins, 14% draws and 48 turns is shown to describe a game without
  wildcards; on its own game the coach walks the numbers toward the book monotonically.
- The engine plays bao as the table actually does, and the table's tai values are the owner's.

**Reason / Source:**

D-007. `FINDINGS.md`, "The first idea from the tactics book" and "The book's benchmark was never our
game".

**Affected:**

- `solver/src/rank.ts`; `engine/`; `data/table.config.json`.

**Related:**

- D-001, D-003, Q-008.

### 2026-08-29 to 2026-08-30 — The harness deals the real table, four candidates lose, and the coach stands

**Changed:**

- The money harness was dealing no wildcards while the bots it compared were tuned with them; fixed,
  and the model's loss re-measured at 0.54 chips a game rather than 2.66.
- Four candidates played for money: the discard model, the claim model, both together, and two
  strategy rules. None won. The machine-learning programme is closed. Defending harder loses
  monotonically; the fold question is closed; the danger weight stays at 40.
- Ten gigabytes of dead runs removed; `NEXT.md` created; the Your hand tab can ask about a thrown
  tile.

**Reason / Source:**

D-004, D-005. `FINDINGS.md`, "The table plays with wildcards and the code was not dealing them",
"Four things played for money", "How much to defend".

**Affected:**

- `solver/src/tools/headtohead.ts`; `solver/`; `web/`.

**Related:**

- D-003, R-004.

### 2026-08-23 to 2026-08-25 — The project begins

**Changed:**

- The engine, the knowledge base merged from the two books, the tile assets and the plan
  (`9a04a9b`, 2026-08-23). The solver, the web trainer, and the data generator with its
  evaluator the same day and the next. The owner's money rules and table confirmed and captured
  in `data/table.config.json` (2026-08-24).
- The 100,000-hand milestone run verified; the paired standard error found to be too small by a
  factor of the square root of the play-outs and fixed (2026-08-25).

**Reason / Source:**

The original plan, now at `INPUTS/PLAN-original-2026-09-12.md`. D-001, D-024.

**Affected:**

- Everything.

**Related:**

- RS-002, RS-003.
