# NEXT

## Purpose of this file

This file is the project's immediate handoff.

## It answers

What did we just do, where did we stop, and what should happen next?

A fresh person or agent should be able to read this and continue **without reconstructing the
previous working session**.

## What belongs here

The last work package, what was completed, what changed, what was left unfinished, the exact
stopping point, the single recommended next action and why, and what would need to be true to
proceed.

## What does not belong here

- Overall project state → `STATUS.md`
- Long-term sequencing → `PLAN.md`
- History → `CHANGELOG.md`
- Unresolved knowledge → `OPEN-ITEMS.md`

**Do not turn this into a second `STATUS.md`.** This file is about the transition between what
just happened and what happens next.

## Rules

**Identify ONE primary next action.** "After That" may list likely subsequent steps, but they are
not commitments and should be reassessed once the immediate action is done.

**Do not invent a next step merely to keep work moving.** If the project cannot safely proceed,
say what is blocking it and what owner decision is required.

## When asked "what's next?"

**Do not simply read this file back.** Reassess first — `PROJECT.md`, `STATUS.md`, this file,
`PLAN.md`, `OPEN-ITEMS.md`, and the actual state of the current work — then determine the most
useful next action, update this file, and answer from the updated version.

## When to update

After meaningful work; when work stops part-way through something; when the recommended next action
materially changes; before handing over to another session, agent, machine or person; and whenever
the owner asks what's next.

## Relationship to other files

`STATUS.md` says where the project is overall; this file says where the *work* stopped and what
happens next. `PLAN.md` holds the long-term sequence — the action recommended here should be
consistent with it. `CHANGELOG.md` holds history; this file is not a log. Blockers named here are
recorded properly in `OPEN-ITEMS.md`, and any decision that results from acting on them belongs in
`DECISIONS.md`.

---

## Last Updated

2026-09-26

## Last Session / Work Package

### What We Were Doing

Step 4 of the win job: carrying the measured answer, "when you can win, win", into the product.
Changs chose fixing the pack files over an app-side override ("Not shortcut"), so the builder marks
these questions and stores the win as the answer.

### What Was Completed

- `datagen/src/quizpack.ts` marks a question that offers a win with `rule: 'win'`, stores `best` as
  the win, and keeps those questions through the verify pass, re-asserting the win after re-judging.
- `solver/src/question.ts` carries the mark; `web/src/components/Train.tsx` teaches it: win is
  "Best move", pass is "Mistake", nothing is charged to "Given up", the money bars and Challenge are
  off, and a paragraph says why.
- Proved on a 199-question test pack built from `run-min1-nowild`: 34 marked, all 34 answered win, 0
  questions offering a win without the mark, 6 of the 34 ones the play-outs would have answered
  differently, each served to the app by name and answered both ways. The test pack was deleted.
- The ten passes run and recorded in `MISTAKES.md`. They found two defects, both fixed and
  re-measured: a shard with nothing for the current filters spun for ever and blanked the Train
  screen, and the Coach line claimed "the measurement" on questions the rule answers.
- `D-033` recorded, `Q-013` opened (the Coach still declines some offered wins), `PROTOTYPE.md`
  updated with step 4.
- The middle dot, banned everywhere by the owner, removed from the five project files that still
  carried it (34 of them). The app and the code were already clean.

### What Changed

- `datagen/src/quizpack.ts`, `solver/src/question.ts`, `web/src/components/Train.tsx`.
- `MISTAKES.md`, `DECISIONS.md`, `OPEN-ITEMS.md`, `PROTOTYPE.md`, and the five files that held
  middle dots.

### What Was Not Completed

- **The three shipped packs have not been rebuilt with the mark**, so the site still serves the
  play-outs' win answers. That is the next action.
- The Coach itself still declines some offered wins (`Q-013`).

## Where We Stopped

2026-09-28, 03:05. Pushed and deploying (`aafa056`): candidate B inside the Coach (`D-035`), the Play
review answering a win on offer by the rule both ways, friends' records and Send my record on Table
setup (`A-007`), a session on the Play tab, and the training plan brought up to date. Every one of
these has its ten passes in `MISTAKES.md`.

**Running on the Mac, in this order:**

1. The mirror check of the shipped integration: `policymoney.ts --pure` on B's own deals (7930001
   to 7932000, three Coaches). Must read about −0.378, the mirror of B's first sample; anything else
   says the shipped code is not the thing that was measured. `data/gen/coach2/mirror-pure-coach.log`.
2. The learned claim model for money, both fields, deals 7950001 onward:
   `data/gen/coach2/claims-*.log`.
3. The colour-plan regrade of the 0-Joker pack, 287 questions judged twice at 256 play-outs:
   `data/gen/coach2/regrade-colour-w*.jsonl`. After 74 of them: 0 answers changed past two standard
   errors, 4 differ inside the noise.
4. Queued behind 3: the strong-table pack regenerated with the new Coach, seed 903, about twelve
   hours (`data/gen/strong2-pack-chain.sh`).

## Recommended Next Action

### Next

Read the three results as they land. The mirror check decides whether anything else is trusted: if
it is not the mirror of B, stop and find out why before reading the others. Then record the claim
model's figures against the gate, and the regrade's count of changed answers against the 287.

### Why

The shipped Coach is now the stand-in in every test, so a fault in the integration would poison
every figure after it. The mirror check is the one measurement that catches that.

### Expected Outcome

Three recorded findings; the claim model shipped or set aside; the regrade either extended to the
other two packs or closed with the finding that the grades on separable colour positions hold.

## After That

Changs said on 2026-09-28: "Do all that, don't stop." The programme, in the order it was given,
every candidate gated on the paired money test at his table:

1. **Candidate B**: done, `D-035`.
2. **The learned claim model for money** (`policymoney.ts --claims`, running on deals 7950001
   onward, both fields): the second model in the repo, never played for money.
3. **The Coach's knobs on money:** the open cost (0.4), the danger weight (40) at the 0-Joker table,
   and how ready a colour hand must look before the plan commits. One setting is thirty minutes a
   field; sweep each around its current value.
4. **The grades themselves:** re-grade, with the Coach playing the play-outs, the decisions where the
   fit and the Coach disagree and the Coach's plan is a colour hand. Days of the Mac. Then refit
   (candidate C) and money-test.
5. **Regenerate the strong-table pack with the stronger Coach**, twelve hours, after B ships.
6. **The model choosing the plan, trained on money.** Last, and only if 4 leaves money on the table.

Outside the Coach, run on model time while the Mac is busy: the training plan, the whole-game
session in the app (prototype first), and a way for records to leave a phone. Each gets its own
entry in `PROTOTYPE.md` or the definition files before it is built.

*Likely subsequent steps, not commitments. Reassess after the immediate action.*

## Blockers / Dependencies Before Proceeding

- None. Work can continue without the answers; it just risks being aimed wrongly.

## Owner Input Required

These came out of reading the whole project against itself. The first is the one that matters.

1. **What is the practice hour now?** The framework splits it between a coach-graded tab and a
   play-out-graded one. Those merged on 2026-09-10. (`C-003`, `Q-004`)
2. **Should a mistake ask for its cause when it is made?** The framework says the app suggests one
   and you confirm it; the app only asks the next day, at review.
3. **Should the Spot drill open at eight seconds** rather than five, as the framework says?
4. **Should the Train tab read the table set in Table setup?** Play and the Challenge button do;
   Train reads a fixed config, so the app disagrees with itself about which table you are at.
5. **Should Play hands and the table settings be in the backup file, and should a Play mistake
   enter the mistake record?**
6. **The late-game table at 360px** scrolls inside its card. Accept it, or a smaller tile on late
   hands? (`Q-002`)
7. **Are Train, Spot, Review and Tips the right four primary tabs**, now that Play exists? (`Q-003`)
8. **Does the no-joker safety advice matter enough to wire in?** The coach uses the four-joker
   danger reads at every table, and the no-joker table was measured to want braver ones. (`R-002`)

## Resume Instruction

A fresh session should:

1. read `PROJECT.md`;
2. read `STATUS.md`;
3. read this file;
4. retrieve only the context the next action requires;
5. verify the actual current project/repository state;
6. continue from **Recommended Next Action**.

Do not redo completed work unless the project state shows it was not actually completed.
