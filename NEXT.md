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

2026-09-27, 23:30. The three packs rebuilt with the win rule are on the site (pushed with the ten
passes recorded in `MISTAKES.md`). The strong-table pack is on the site as a fourth pack, at Changs's
word, and recorded in `PROTOTYPE.md`. Nothing is running on the Mac.

The Coach work has its plan and first measurement in `PROTOTYPE.md`, its trainer
(`datagen/src/policyfit.ts`) and its money gate (`datagen/src/policymoney.ts`, self-check exactly
0.000). Neither has been run on data.

## Recommended Next Action

### Next

The first fit: `policyfit.ts` on the three runs with `--maxPerDir 150000`, held out against the three
packs, then `policymoney.ts 2000 --weights <out> --field coach` and `--field pool` at the 0-Joker
table. Name the deal range before running (7900001 onward is reserved for this).

### Why

It is step 1 of the plan Changs chose, and the Mac is free. The result decides whether the
regret-weighted loss alone moves the early and middle game, or whether the features (step 2) are
needed first.

### Expected Outcome

A held-out table of mean regret by phase for the fit and the Coach on the same positions, and two
money figures with standard errors. Nothing ships on this run whatever it says; it says where to go.

## After That

1. Ask Changs, after a few days on it, whether the strong-table pack feels different.
2. Read `A-005` once Changs has used the hard questions: whether "hard only" is hard enough.
3. Changs uses the hard questions for a few days and says whether they are still too easy
   (`A-005`); rule questions are not hard by that definition, so hard only hides them.

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
