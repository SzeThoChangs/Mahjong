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

2026-09-13 02:30

## Last Session / Work Package

### What We Were Doing

The claim judge (`R-001`) — the one item on the plan that needed nothing from the owner. The Play
tab's review carried a warning that it could not be trusted on calls or on taking a win, and a
stated reason. Both had been written from a single played hand, so the first job was to measure
them rather than build the fix they implied.

### What Was Completed

- The stated reason is measured and wrong. Putting the Coach in the other three chairs moves the
  gap by -0.48 against a standard error of 0.35, and in the opposite direction to the prediction.
- A second explanation is excluded too: replaying the hand's real hidden tiles instead of guessing
  them moves the gap by +1.13 ± 1.15.
- The judge is nonetheless wrong on this decision, shown by the project's own bar. A coach that
  declines a win under two *Tai* loses 0.229 chips a game over 8,000 paired deals, and under three
  *Tai*, 0.944, against three coaches and against the mixed field alike.
- The review no longer marks taking a win as a mistake (`D-027`). It reads "Not judged" and says
  why in a sentence; the session tally ignores it.
- `FINDINGS.md`, `R-001`, `PROTOTYPE.md`, `DECISIONS.md`, `STATUS.md` and `CHANGELOG.md` updated to
  what is measured. Two tools kept: `datagen/src/winprice.ts` and `datagen/src/declinewin.ts`.

### What Changed

- `web/src/lib/rejudge.ts` gains a fourth verdict kind; `web/src/components/Play.tsx` renders it
  and the warning above the review is rewritten.
- No other app behaviour moved.

### What Was Not Completed

- **Why** the judge prefers declining is still unknown. Three explanations are excluded and none
  replaces them.
- *Pong* and *Chow* verdicts remain untested in either direction. The money test covers declining
  a win, not calling a tile.

### Files / Areas Changed

- `web/src/lib/rejudge.ts`, `web/src/components/Play.tsx`.
- `datagen/src/winprice.ts`, `datagen/src/declinewin.ts` (new).
- `FINDINGS.md`, `OPEN-ITEMS.md`, `DECISIONS.md`, `PROTOTYPE.md`, `STATUS.md`, `CHANGELOG.md`.

## Where We Stopped

The work is committed and the deploy is green. Nothing is running.

## Recommended Next Action

### Next

The owner uses the app for a week and plays a few hands, then answers the questions under **Owner
Input Required**.

### Why

Every remaining piece of work is aimed by something only he can say. The judge's remaining defect
matters a lot if the Play tab turns out to be where he spends his time and very little if it does
not, and a week of use is the cheapest way to find out which. The practice-hour question is
upstream of the training plan, of the app, and of whether the framework draft is right, and it has
been open since the two practice tabs merged.

### Expected Outcome

`Q-001` to `Q-004` answered, `C-003` closed, and a defensible order for the rest of Phase 7.

## After That

1. Find why the judge prefers declining a win, now that three explanations are excluded.
2. Run the same paired-money design on calling rather than winning, to settle *Pong* and *Chow*.
3. Build the next piece of the game, if the week says the loop is worth it.

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
