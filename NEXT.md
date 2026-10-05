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

2026-10-04 19:05 (Singapore)

## Last Session / Work Package

### What We Were Doing

Carrying out `D-037` and `D-038`: every pack judged by the Coach, then two new strong-table packs at
the 4-Joker tables judged by the Coach from the first candidate.

### What Was Completed

All four original packs re-judged with the Coach and on the site (2026-09-29 to 10-02). The Coach's
double count of claimed discards found and fixed (10-01), measured at the noise floor; the same
double count in the table drawing found by Changs and fixed (10-03). `strong-min1` built and on the
site (10-04), 1,922 questions. `evaluate.ts --budget`, `quizpack.ts --judge coach`, `coachpack.ts
--src --drop-close`, `policymoney.ts --old`.

### What Was Learned

A Coach-built pack is about a fifth the size of a shanten-screened one for the same time, and a
quarter of what the Coach calls decisive at 64 play-outs does not hold at 256. macOS has no
`timeout` (`M-004`). A fix in the numbers needs the same look at the picture (`M-005`). The lid
closed stops every run.

### Superseded block (2026-09-26), kept for the record

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

**Changed course at 18:52, 2026-09-28:** Changs disputed a "big mistake" (strong-table question
3349:11:51); re-judged with the Coach in the play-outs it is a small edge for the pack's tile, not a
big one, and he ruled that no answer may rest on simple bots (`D-037`). The app's Challenge and Play
judges now run the Coach; each question names its judge; `datagen/src/coachpack.ts` re-judges a
whole pack.

**Running on the Mac:** the `coach` pack (4 Jokers, min 2) re-judged with the Coach, six workers,
the last of the chain (`data/gen/coach2/coachpack-rest-chain.sh`), started 2026-10-01 15:27 under
`caffeinate -is`; logs `coachpack-coach-w*.log`; `coachpack-coach.done` when merged. The Mac must
stay open and plugged in: `min1-nowild` took 15 hours and `min1` 11 for eight hours of work each,
asleep with the lid closed the rest.

## Recommended Next Action

### Next

1. `strong-min2` (`D-038`): grading from 2026-10-04 10:16; the Mac was shut down 04:50 to 13:28 on
   10-05 (18,096 graded on disk, about 1,800 unflushed lost and regraded), restarted 13:34 with the
   remaining 22 hours; then build and finish by itself; expected to merge about 2026-10-06 15:30. Then: copy `data/gen/coachpacks/strong-min2/`
   into `web/public/quiz/strong-min2/`, rewrite `web/public/quiz/index.json` from the per-pack
   indexes (the Node one-liner in the 2026-10-04 commit, or quizpack's Listed pass), ten passes with
   the felt tile count, deploy, record the counts as for `strong-min1`.
2. Then Changs's call: grade longer for bigger strong packs (`GRADE_HOURS`); whether to refit the
   two models on Coach-judged labels; and when `strong-min2` is big enough, retire `coach` the way
   `min1` was (`retired` in its index, `D-039`).

The `--field pool` arm and the `shanten` defaults in `challenge.ts` and `buildrare.ts` were dropped
on 2026-10-04 19:20; `halving.ts` keeps shanten because it measures the halving method, not a position.

### Why

`D-037` is not carried out until every pack a player can open rests on the Coach's play-outs.

### Expected Outcome

Four packs judged by strong play, each question saying so, and a record of how many answers moved.

## After That

Changs said on 2026-09-28: "Do all that, don't stop." The programme, in the order it was given,
every candidate gated on the paired money test at his table:

1. **Candidate B**: done, `D-035`.
2. **The learned claim model for money** (`policymoney.ts --claims`, running on deals 7950001
   onward, both fields): the second model in the repo, never played for money.
3. **The Coach's knobs on money:** done; the Chow bar barely binds, and the Pong bar and the danger
   weight were swept before.
4. **The grades themselves:** done for the packs; 2 of 287 colour-plan answers changed, chance's
   share, so the pack grades hold and the bias lives where a fit learns, not where a question is.
5. **Regenerate the strong-table pack with the stronger Coach:** done, on the site.
6. **The model choosing the plan, trained on money:** its cheap form measured (the line stays); the
   full form not started.

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
