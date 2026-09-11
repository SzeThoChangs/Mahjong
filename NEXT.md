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

2026-09-12 17:20

## Last Session / Work Package

### What We Were Doing

Laying the P-Starter project structure over an existing, live project, at the owner's request. The
app itself was already built, deployed and in use; what was missing was a place for the specs and
the decisions to live. The same session also seeded the prototype as a snapshot of the current
build, because the owner decided the prototype should be the current build and that future features
get prototyped before production code is written.

### What Was Completed

- The sixteen canonical files exist and are populated from the evidence that was already here:
  `PLAN.md` and `NEXT.md` rewritten to the P-Starter shape, the other fourteen created.
- `INPUTS/`, `RESEARCH/` and `prototype/` created. The old `PLAN.md` and `NEXT.md` are preserved in
  `INPUTS/` rather than lost.
- Twenty-six decisions harvested out of `FINDINGS.md`, `MOBILE.md` and the commit history into
  `DECISIONS.md`, where before they were scattered and only findable by reading everything.
- Twenty-four open items recorded, including five conflicts nobody had written down.
- The prototype seeded: `prototype/build.sh` regenerates `prototype/app.html`, a single-file
  snapshot of the current build that runs with no server.
- The app now reads and writes the tab in the address bar, so a feature record can link to its own
  screen instead of the front page.
- `vercel.json` removed. It configured a service this project does not deploy to, and a later
  session reading it would have believed otherwise.

### What Changed

- One production change: tab deep-linking in `web/src/App.tsx`.
- Everything else is new project-knowledge files, the prototype scaffolding and the project
  interface. No behaviour of the app changed.

### What Was Not Completed

- The owner has not reviewed any of it. The files are the agents' best reading of the evidence, not
  confirmed intent, and they are marked accordingly.
- Eight questions surfaced during the reading that need the owner, listed below.
- The framework's description of the practice hour still contradicts the app (`C-003`).

### Files / Areas Changed

- The sixteen canonical files at the project root, plus `INPUTS/`, `RESEARCH/`, `prototype/` and
  `project-view/`.
- `web/src/App.tsx` for the hash routing.
- `.gitignore`, for the generated prototype snapshot.

## Where We Stopped

The structure is complete and the working tree is uncommitted. Nothing is running.

## Recommended Next Action

### Next

The owner answers the questions under **Owner Input Required**, starting with the practice hour.

### Why

The structure now records what this project believes, and most of it is the agents' reading of code
and documents rather than anything the owner has confirmed. The single largest thing it cannot
settle for itself is what the practice hour is, now that the two practice tabs are one tab. That
question is upstream of the training plan, of what the app should do next, and of whether the
framework draft is right. Building anything else first risks building it against a plan that is
about to change.

### Expected Outcome

`C-003` closed, the framework's practice hour matching the app, and the open items that turn on it
either answered or knowingly deferred.

## After That

1. Fix the claim judge, so the Play tab's review can be trusted on calls and on taking a win.
2. Play a week of hands and practice hours, and record what the loop actually feels like.
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
