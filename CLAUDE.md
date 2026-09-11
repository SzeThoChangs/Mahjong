# CLAUDE.md

## Purpose of this file

This file tells Claude how to work inside this project.

**It answers:** *How should the agent operate here?*

It is an operating guide only. It must **not** become another repository of requirements, status,
product facts, decisions, user information or project history — those belong in the project files.

This project is the Singapore Mahjong trainer. `../CLAUDE.md`, one level up, governs the whole
"Key to Learning" folder and still applies: its house writing rules, its nine ideas about how
people learn, and its rule that every piece of advice traces to one of those ideas or to a named
study. Where the two disagree about this project's own subject, this file wins.

### The rule that matters most here

**Never write current project state into this file.**

No phase, no blockers, no "nothing is built yet", no "`prototype/` is empty", no "everything is
currently proposed", no list of what is waiting on whom. Every one of those is true on the day it
is written and wrong a few weeks later — and then the operating guide contradicts `STATUS.md`,
which is precisely the conflict the file separation exists to prevent.

If a sentence here would need changing because work progressed, it does not belong here. Point at
the file that owns it instead:

```
what is true now       → STATUS.md
where work stopped     → NEXT.md
what the product does  → SPEC.md / FEATURES.md
why we chose this      → DECISIONS.md
what we don't know     → OPEN-ITEMS.md
```

The same applies to product facts. Naming a rule and pointing at it is right; restating its content
here is not, because the copy drifts from the original and there is no way to tell which is current.

This file tells the agent **how to work**. The project files say **what is currently true**.

It should stay short and stable. Project changes normally change the project files, not this one.

---

## The principle that governs everything else

**This project system exists to reduce the owner's work, not create it.**

The project files are agent memory, not owner forms. The owner should never have to operate them.

The owner: provides information · answers material questions · reviews the prototype · gives
feedback · makes decisions when genuinely required.

The owner should **never** be asked which file something belongs in, which ID to create, whether
something is a spec rule or a feature, whether it is an open item, whether a decision or changelog
entry is needed, or to reconcile inconsistencies between files. **That is your job, every time.**

When the owner says something in plain language — *"the client changed this"*, *"this screen is
wrong"*, *"forget that feature for v1"*, *"what's blocking us?"* — work out yourself what it
changes across journeys, spec, features, workflows, stories, open items, decisions, plan, prototype,
status, next action and history. Then update only what actually changed.

Do as much useful structuring as the evidence safely supports **before** asking anything. If 90%
can be established, do that 90% and surface the remaining 10%. **Never ask a question merely
because a template field is empty** — ask only when the answer materially affects understanding,
prototyping or safe progress.

---

## Start of every session

Read, in order:

1. `PROJECT.md`
2. `STATUS.md`
3. `NEXT.md`

Then ask: *what else does this task actually need?*

**Do not load every project file by default.** `CHANGELOG.md` is not part of this bootstrap.

**`P-Starter.md` is not either.** It is the bootstrap and recovery reference that created this
structure — not project knowledge, and not part of normal session context. Read it only when
project structure, bootstrap behaviour, recovery or the starter method itself is directly relevant
to the task.

---

## Where project knowledge lives

| File | Answers |
|---|---|
| `PROJECT.md` | What is this project and why? |
| `USERS.md` | Who is it for? (`U-nnn`) |
| `USER-JOURNEYS.md` | What must each user accomplish end to end? (`UJ-nnn`) |
| `SPEC.md` | What must the system do? |
| `FEATURES.md` | What capabilities does the product need? (`F-nnn`) |
| `WORKFLOWS.md` | How does a user accomplish a task? (`WF-nnn`) |
| `USER-STORIES.md` | What do we need to build? (`US-nnn`) |
| `PROTOTYPE.md` | What are we testing and what did we learn? |
| `RESEARCH.md` | What did we investigate and what was accepted? (`RS-nnn`) |
| `OPEN-ITEMS.md` | What do we not safely know? (`Q/A/C/DEP/R-nnn`) |
| `DECISIONS.md` | What did we decide and why? (`D-nnn`) |
| `PLAN.md` | Where are we going? |
| `STATUS.md` | Where are we now? |
| `NEXT.md` | Where did we stop and what next? |
| `CHANGELOG.md` | What materially changed and when? |
| `INPUTS/` | What did we receive? |
| `RESEARCH/` | The investigation itself |
| `prototype/` | The working prototype |
| Git | Exactly what changed in files and code |

Identifiers are stable. Never renumber them. Mark things retired rather than deleting their ID.

---

## Retrieving context

Search first. Read the relevant sections second. Expand only when necessary.

Implementing a story typically needs:

```
the story → its workflow → its feature → the relevant SPEC rules → the relevant code
```

Add the **journey** when the story depends on a broader experience or a hand-off.
Add `OPEN-ITEMS.md` when behaviour looks unclear or an assumption may be load-bearing.
Add `DECISIONS.md` when the reasoning behind a current constraint matters.
Add `CHANGELOG.md` when you need to know how the project reached its current state.
Add `INPUTS/` when the project files are insufficient, provenance matters, information is
ambiguous, or there is a conflict to resolve against source.
Add `RESEARCH.md` when an open item may already have been investigated, or before choosing between
options it covers. Read inside `RESEARCH/` only when the register entry is insufficient.

Do not automatically read every story, workflow, feature, decision or input.

**Do not optimise token usage at the expense of correctness.** If context is genuinely needed to
act safely, retrieve it.

---

## Changing a user journey

When materially changing a journey in `USER-JOURNEYS.md`:

1. update the written journey;
2. update its Mermaid diagram if one exists;
3. check the related workflows, features and stories;
4. update `OPEN-ITEMS.md` if the change exposes uncertainty;
5. **do not leave a stale diagram contradicting the journey prose.**

The prose is canonical. If the two disagree, fix the diagram — do not edit the prose to match the
picture.

---

## Working with uncertainty

Well-formed documentation is not necessarily true. Distinguish `CONFIRMED` / `OBSERVED` /
`ASSUMED` / `PROPOSED` / `UNRESOLVED` / `CONFLICTING` where it matters.

Never silently convert:

```
prototype behaviour → confirmed requirement
existing code       → intended behaviour
assumption          → fact
proposal            → approval
implementation      → verification
```

**Do not invent** users, journeys, features, requirements, workflows, stories, rules, permissions,
dependencies, dates, decisions, progress or verification results — including to fill a template
heading. An empty or explicitly-unknown section is better than an invented one.

If something important is unknown, record it in `OPEN-ITEMS.md` as a question, assumption,
conflict, dependency or risk, and surface it.

If two files disagree, do not silently pick one. Investigate whether durable evidence resolves it;
if not, record a `CONFLICT` and surface it. Do not rewrite files to make them look consistent.

---

## Using `INPUTS/`

`INPUTS/` holds original source material, preserved as received. **It is evidence, not
automatically project truth.**

Do not edit an input to agree with current understanding. Cite sources for consequential content
(e.g. `INPUTS/2026-03-04-brief.pdf § 4.2`). Add new material with a dated filename.


---

## Research

`RESEARCH.md` registers what has been investigated; `RESEARCH/` holds the material.

Before researching something, check it has not already been done. Not every question needs
research — most are answered by asking the owner or checking `INPUTS/`.

When you do research:

- **Cite every source.** A finding without a source is an opinion, and does not go in the register.
- **Record the origin** — owner-supplied or agent-gathered. **Agent-gathered material you cannot
  point at is not a source.** A confident summary of something you did not actually read is a
  fabrication that arrives already looking like evidence, which makes it worse than a visible guess.
- **State confidence**, and **what the research does not establish**. The second is usually the more
  useful field.
- **A finding is `OBSERVED`, not confirmed.** It reaches `SPEC.md`, `FEATURES.md` or a decision only
  by deliberate acceptance, recorded in the register.

If answering the question needs something **built** rather than read, it is a targeted experiment —
`PROTOTYPE.md` and `prototype/`, not research.

`RESEARCH/` is a place to put things, not a structure to satisfy. How the material is organised
follows the size of the work and needs no rule — the register makes it findable. The four rules
below are different: each is something there is an active reason to skip, which is why they are
written down rather than left to judgement.

### Say how closely you actually looked

**A citation says a source exists. It does not say what you did with it.** Record, per source, how
closely you examined it. The scale is yours; the subject decides it. Reading a paper, trialling a
product, querying an API and asking a supplier are examined differently.

**Then state how many you examined properly.** Forty sources of which two were read in full is a
completely different position from ten of which all ten were, and **a citation list makes those look
identical**. Nothing else in the work reveals it, and nothing pulls you toward admitting it — which
is exactly why it has to be stated.

### Preserve disagreement between sources

Where credible sources disagree, **record both and name what differs** — scope, method, date,
definition, or who was asked.

**Choosing the more convenient one and moving on is the most common way research quietly becomes
fiction.** It leaves no trace, so nobody can audit it afterwards.

Say plainly when something was **looked for and not found**. That is a finding, and a different one
from never having looked.

### Log the dead ends and the empty searches

Keep a running note of **what could not be reached, what was blocked, and what worked instead**. A
later session rediscovering the same dead ends is **paying twice for nothing**, and the value of the
note is invisible until the third one.

**Log searches that returned nothing usable, deliberately.** When a widely-repeated claim returns
only marketing and aggregators, **that asymmetry is itself evidence about the claim** — and dropping
it silently invites the next session to run the same search.

### Work spanning several areas needs a synthesis pass

**It cannot be done from inside any one area**, because each area only ever sees itself.

Findings that recur **independently** across separate areas are the most reliable thing research
produces — different routes that never consulted each other. **They are invisible without a
deliberate pass to look for them**, and they are usually the most valuable output.

---

## Working on implementation

Before implementing consequential behaviour, retrieve enough to understand the user, the journey,
the workflow, the feature, the story, the applicable rules, relevant open items and the existing
implementation. Retrieve the relevant sections — not all of these files in full, every time.

If behaviour is insufficiently defined, **do not guess to keep coding**. Work out whether it can
be resolved from the project files, `INPUTS/`, existing behaviour, an owner answer, or a
prototype. If it cannot be resolved safely, record or update the open item and surface it.

---

## Working on the prototype

Prototype code lives in `prototype/`. Read `PROTOTYPE.md` before changing it.

The prototype is normally the **visual product prototype** — a working representation of the
current understanding, built so the owner can see and use it and say whether it is what they mean
to build. It participates in definition; it does not wait for definition to finish. Targeted
experiments and spikes are secondary and are governed by the same file.

Unresolved production technology does not block it. Mock data, fake APIs, hard-coded states,
simulated integrations, simplified authentication and disposable code are legitimate — optimise for
what the prototype must teach, not for production architecture, scalability, abstraction,
completeness or polish, unless one of those is what is being tested.

**Do not silently invent unresolved product behaviour.** Where the prototype must represent
something undecided, record it as an `ASSUMPTION` in `OPEN-ITEMS.md` and under Temporary
Assumptions in `PROTOTYPE.md`. Its presence in running software is not confirmation.

**Check the prototype's lifecycle state in `PROTOTYPE.md` before working on it.** If it is
`HISTORICAL`, the project has passed BASELINE and production has taken over: the prototype is a
design record, not the current implementation. Do not update it to match production, and do not
read it as intended behaviour — that lives in the definition files. Keep `INTENDED` (project
files), `PROTOTYPED` (`prototype/`) and `IMPLEMENTED` (production code) distinct.

**This project's owner has deliberately overridden that,** and `PROTOTYPE.md` carries the decision
and its reasoning. Read that file rather than assuming either the generic rule or the override.
The three states above stay distinct whatever the prototype is for: something existing in the
prototype still never makes it an approved requirement.

Record every shortcut, mock and assumption in `PROTOTYPE.md` so they are not mistaken for
decisions.

If the prototype has `/features` or `/workflows` demo launchpads, they are generated from
`FEATURES.md` and `WORKFLOWS.md` and those files stay canonical. Update the Markdown first, then
the launchpad — never the reverse. Never put a route on a card that does not work, and never hide
that the prototype is simulating something.

When prototype testing produces meaningful evidence:

1. record the finding in `PROTOTYPE.md`;
2. state what was learned;
3. update `OPEN-ITEMS.md` where uncertainty was resolved or created;
4. update the project-definition files where the learning is **accepted**;
5. record a decision in `DECISIONS.md` if one was made;
6. update `STATUS.md`;
7. update `NEXT.md`;
8. add a `CHANGELOG.md` entry **if** a material project-level change resulted.

Prototype behaviour must never silently redefine the project.

---

## Updating project state

After meaningful work, decide which files **materially changed** — and update only those.

- `NEXT.md` — when meaningful work stops or is handed off. Usually.
- `STATUS.md` — when the overall current state materially changed.
- `DECISIONS.md` — only when a material decision was made.
- `CHANGELOG.md` — only when a material project-level change occurred.
- `OPEN-ITEMS.md` — when uncertainty was created, changed or resolved.
- Definition files — when the understanding they hold actually changed.

**Do not mechanically update every file because a session happened.**

**Do not over-document.** No requirements for obvious implementation details, stories written for
coverage, workflows for trivial interactions, decisions for inconsequential choices, open items for
harmless unknowns, or changelog entries for routine edits. Optimise for understanding, truth,
continuity and recoverability — not for completeness. A session can update
`NEXT.md` and nothing else. A session can change implementation without touching `PROJECT.md`.

Do not mark work `VERIFIED` without evidence. `built` is not `verified`; `verified` is not
`released`; `deployed` is not `accepted`.

---

## When asked "what's next?"

Do not read `NEXT.md` back. Reassess `PROJECT.md`, `STATUS.md`, `NEXT.md`, `PLAN.md`,
`OPEN-ITEMS.md` and the actual state of current work; determine the most useful next action;
update `NEXT.md`; then answer.

Do not recommend work merely to stay busy. If something is blocked, say so and say what decision
is needed.

---

## Finishing a session

Leave the project in a state a fresh session can continue from
`PROJECT.md` → `STATUS.md` → `NEXT.md`, retrieving deeper context only as required.

Before stopping meaningful work: make sure the files reflect what actually changed, update
`NEXT.md`, update `STATUS.md` if current state moved, record any material decision, record any
unresolved matter.

---

## Working in this repository

These are the things that have actually cost time here. They are how to work, not what is true, so
they belong in this file.

**The folder path contains a colon**, which breaks every pnpm `.bin` shim. Call tools by their real
paths inside `node_modules/.pnpm/` and glob the version directory rather than hardcoding it, for
example `node ../node_modules/.pnpm/vite@5*/node_modules/vite/bin/vite.js`. The web package builds
with TypeScript 6; engine, solver and datagen build with TypeScript 5.

**Run `./check.sh` before committing.** It runs exactly what the CI workflow runs: typecheck of all
four packages, the engine and solver tests, and the web build. `tsc --noEmit -p .` inside `web/`
checks nothing at all, because that tsconfig is a solution file with an empty `files` array, and
trusting it has shipped broken commits twice.

**`git commit --only -- <paths>` silently skips untracked files** inside a directory you name. Run
`git add` on every new file first, or the pushed commit will not build. This has happened twice.
While another agent may be working in the same tree, always commit with an explicit pathspec rather
than a bare `git commit`.

**One long build at a time.** The Mac has little memory headroom. Before starting anything that
runs for hours, look at `ps -eo rss,command | sort -rn | head` — an idle local model once held
3.5 GB and made a two-hour build look like a twenty-hour one. Never run two dev servers.

**Measure rather than argue.** This project's findings are its own measurements, and several
confident arguments have been wrong. When a claim can be checked by running something, run it.
A count is not evidence of the thing the count was supposed to prove.

---

## Structure

The canonical structure is the sixteen files above plus `INPUTS/`, `RESEARCH/` and `prototype/`. Do
not add canonical files or directories, and do not split existing ones.

If a file genuinely becomes too large or unnavigable, do not migrate it automatically. Explain the
problem, why the current structure is insufficient, the smallest change that solves it, and how
portability is preserved — then get the owner's agreement.
