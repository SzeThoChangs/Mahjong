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

2026-09-27, 15:05. Two jobs are queued on the Mac, one behind the other, and both write outside the
repository until they are checked:

1. **The strong-table pack** (`data/gen/strong-pack-chain.sh`): grading finished at 04:01 and the
   pack build has been verifying since; at 15:00 it was at 9,000 of 12,801 with 1,504 dropped and
   about four hours left. It builds with the win rule, because the pack step started after `f42068a`.
   Output `data/gen/strong-quiz/`, marker `data/gen/strong-pack.done`.
2. **The three-pack rebuild** (`data/gen/rebuild-chain.sh`): waits for that marker, then rebuilds
   `min1-nowild`, `min1` and `coach` from their graded runs with `--max 12800 --mix decisive
   --verify 512`, into `data/gen/rebuild/quiz/`. About seven hours. Marker
   `data/gen/rebuild/rebuild.done`, log `data/gen/rebuild/chain.log`.

Changs chose the built route over marking the shipped shards in place, and chose "a stronger Coach"
as the week's big job (2026-09-27). Its plan and first measurement are in `PROTOTYPE.md`, "Can
anything beat the Coach for money at Changs's table?".

## Recommended Next Action

### Next

When `rebuild.done` appears: read the three pack logs, count the `rule: 'win'` questions and the
restored ones per pack, copy the packs into `web/public/quiz/` with a new `index.json`, run the ten
passes against the real packs, deploy. Then start the Coach work proper: step 1 of the plan in
`PROTOTYPE.md`. The trainer (`datagen/src/policyfit.ts`) and the money harness
(`datagen/src/policymoney.ts`, self-check 0.000) are written and typecheck; neither has been run on
data. First run: `policyfit.ts` on the three runs with `--maxPerDir 150000`, then `policymoney.ts
2000 --weights <out> --field coach` and again `--field pool`.

### Why

The rebuild is what puts the win rule on the site. The Coach work needs the Mac for its money
tests, so it starts once the rebuild has it free; its analysis and code can be written before that.

### Expected Outcome

Three packs on the site carrying the rule; the first Coach candidate fitted and queued for the paired
money test at his table.

## After That

1. Read the strong-table pack when its chain finishes, and record what it says.
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
