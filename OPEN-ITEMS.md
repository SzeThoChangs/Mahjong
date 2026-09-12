# OPEN ITEMS

## Purpose of this file

This file records what the project does not yet safely know, so that uncertain, conflicting,
missing or externally dependent information is not silently turned into fact.

## It answers

What do we not safely know?

## What belongs here

| Type | Meaning | ID |
|---|---|---|
| QUESTION | Something needs an answer. | `Q-001` |
| ASSUMPTION | We are proceeding on something not confirmed. | `A-001` |
| CONFLICT | Two or more sources, behaviours or decisions disagree. | `C-001` |
| DEPENDENCY | Something external must happen or be supplied. | `DEP-001` |
| RISK | Something uncertain may materially affect the project. | `R-001` |

Identifiers are stable. Never renumber and never reuse one.

## What does not belong here

- Decisions already made; those are in `DECISIONS.md`.
- Work to be done; that is `PLAN.md`.
- Current state; that is `STATUS.md`.
- Measurements and their results; those are in `FINDINGS.md`.

An open item is about knowledge, not about tasks. "Build the claim judge" is work. "The Play review
cannot be trusted on calls, and we do not know how large the bias is" is an open item.

## When to update

Whenever uncertainty is created, changed or resolved. Do not silently turn an assumption into a
fact: when one is confirmed, record the resolution here and update the file that now states it.
Do not leave a resolved item looking open; a stale open item makes the whole file untrustworthy.

## Relationship to other files

Every other file points here when it cannot state something safely. On resolution the knowledge
moves into `PROJECT.md`, `PLAN.md` or the app, and if the choice was material a decision is
recorded in `DECISIONS.md`. Where an item needs investigation rather than a decision it may also
appear under "Research needed" in `RESEARCH.md`.

---

## Index

| ID | Type | Title | Status | Owner |
|---|---|---|---|---|
| Q-001 | QUESTION | Does the Play loop feel like mahjong, and is the review worth reading? | OPEN | Changs |
| Q-002 | QUESTION | The late-game table at 360px: accept the scroll, or a smaller tile on late hands? | OPEN | Changs |
| Q-003 | QUESTION | Are Train, Spot, Review and Tips the right four primary tabs? | OPEN | Changs |
| Q-004 | QUESTION | The framework draft is awaiting the owner's review | OPEN | Changs |
| Q-005 | QUESTION | Pack button to first question on a real phone on 4G is unmeasured | OPEN | Changs or any tester |
| Q-006 | QUESTION | About twenty rare combination tai values are still engine defaults | OPEN | Changs |
| Q-007 | QUESTION | Section 6.5 of the study, All-Pong at minimum 2, was never captured | OPEN | Agent |
| Q-008 | QUESTION | Did the study's own simulations use wildcards? | OPEN | Agent |
| Q-009 | QUESTION | The pack phase mix leans mid-hand: correct it or accept it? | OPEN | Changs |
| Q-010 | QUESTION | Which device holds the owner's own record | OPEN | Changs |
| Q-011 | QUESTION | Per-card table labels where a verdict differs between tables: still wanted? | OPEN | Changs |
| A-001 | ASSUMPTION | Training on play-out-graded decisive positions improves real play | OPEN | Changs |
| A-002 | ASSUMPTION | The stage order and the minute split of the practice hour | OPEN | Changs |
| A-003 | ASSUMPTION | Spotting is a separate skill from solving | OPEN | Agent |
| A-004 | ASSUMPTION | Friends' testing needs no shared data for now | OPEN | Changs |
| C-001 | CONFLICT | The P-Starter lifecycle rule for `prototype/` against the owner's decision | RESOLVED | Changs |
| C-002 | CONFLICT | The original plan says Vercel; the site is on GitHub Pages; `vercel.json` remains | RESOLVED | Agent |
| C-003 | CONFLICT | The framework describes two practice tabs with two judges; the app has one | OPEN | Changs |
| DEP-001 | DEPENDENCY | GitHub Pages on the free tier needs the repository public, with the sources excluded | OPEN | Changs |
| R-001 | RISK | The judge is measured wrong about taking a win; the cause is unknown | OPEN, narrowed | Agent |
| R-002 | RISK | The coach uses the four-joker danger reads and weight at every table | OPEN | Agent |
| R-003 | RISK | The no-joker pack cannot grow without more grading | OPEN | Agent |
| R-004 | RISK | Positive measurements shrink on fresh deals | OPEN | Agent |
| R-005 | RISK | The training record lives in one browser and is saved by hand | OPEN | Changs |

---

## Q-001 — Does the Play loop feel like mahjong, and is the review worth reading?

**Type:** QUESTION

**Description:** The Play tab deals one hand against three coaches and lets every decision be
judged afterwards against the measured best. Nobody has yet played enough hands, or run the
practice hour for a week, to say whether the loop feels like the game and whether the review is
worth reading.

**Why It Matters:** This answer decides what gets built next: the rest of the game, or something
else.

**Owner:** Changs.

**Source:** `NEXT.md` 2026-09-12, "What needs Changs", item 1.

**Impact:** `PLAN.md` sequences the game behind it.

**Related:** D-021, R-001, `PROTOTYPE.md`.

**Target Resolution:** After about a week of use.

**Status:** OPEN

**Resolution:**

---

## Q-002 — The late-game table at 360px: accept the scroll, or a smaller tile on late hands?

**Type:** QUESTION

**Description:** With about fifty discards the square table is about 410px wide against 320px of
card, so on a 360px phone it scrolls sideways inside its card late in a hand. The square at a 22px
tile was decided (D-018); what to do when it outgrows the card was not.

**Why It Matters:** Reading danger off the discards is half of what the app teaches, and the late
hand is where it matters most.

**Owner:** Changs.

**Source:** `NEXT.md` 2026-09-12, "What needs Changs", item 2.

**Impact:** One layout change, or none.

**Related:** D-018.

**Target Resolution:** When the owner has seen a late hand on his phone.

**Status:** OPEN

**Resolution:**

---

## Q-003 — Are Train, Spot, Review and Tips the right four primary tabs?

**Type:** QUESTION

**Description:** The bottom bar carries Train, Spot, Review, Tips and More. The practice hour's own
split is five minutes of Review, ten of Spot, forty on Train, and five with one Tips card. It is
not settled whether Tips earns a slot on the bar or belongs behind More, and the Play tab did not
exist when the four were chosen.

**Why It Matters:** The four on the bar are the four used every session, and the bar was built so
the thumb already rests on them.

**Owner:** Changs.

**Source:** `MOBILE.md`, "Still open"; `NEXT.md`, "Then, in the order the pain is felt", item 1.

**Impact:** A one-line change to the tab list.

**Related:** D-017, Q-001.

**Target Resolution:** After a week of use on the phone.

**Status:** OPEN

**Resolution:**

---

## Q-004 — The framework draft is awaiting the owner's review

**Type:** QUESTION

**Description:** `Framework - Mahjong.md` was rewritten on 2026-09-11, with "The mistake types" and
"The patterns" drafted from the findings and given a Sources list. The owner has not yet read the
draft and said what is wrong in it.

**Why It Matters:** The framework is the plan this project exists to produce. Until it is reviewed,
its stage order, its minute split and its cause list are the agent's draft, not the owner's plan.

**Owner:** Changs.

**Source:** `NEXT.md` 2026-09-12, "What needs Changs", item 3.

**Impact:** Everything in `PLAN.md` that refers to the practice hour inherits the draft's
uncertainty.

**Related:** A-002, A-003, C-003.

**Target Resolution:** Owner's reading.

**Status:** OPEN

**Resolution:**

---

## Q-005 — Pack button to first question on a real phone on 4G is unmeasured

**Type:** QUESTION

**Description:** The sharding was built so the first question costs about 200 KB and a 70ms parse
instead of 15 MB and 3.5 seconds, measured on a Mac. The time from tapping a pack button to seeing
the first question on a real phone over mobile data has not been measured.

**Why It Matters:** It was the one number still owed from the phone pass, and the reason the packs
were sharded at all.

**Owner:** Changs, or any tester with a phone and no wifi.

**Source:** `NEXT.md` 2026-09-12, "What needs Changs", item 4; `MOBILE.md`, "Measured on the built
app at 360px".

**Impact:** If it is slow, the shard size or the precache list changes.

**Related:** D-015, D-019.

**Target Resolution:** One measurement.

**Status:** OPEN

**Resolution:**

---

## Q-006 — About twenty rare combination tai values are still engine defaults

**Type:** QUESTION

**Description:** The five hand types that decide 99.5% of wins are confirmed with the owner. The
remaining values, such as full colour at 4 and the small three dragons at 3 and the long list of
5-tai limit hands, are engine defaults, each occurring in under 0.3% of hands. The original plan
also listed unplayable tiles, the Pay-All threshold and a self-draw bonus as unconfirmed; all three
were confirmed on 2026-09-01 and that list is stale.

**Why It Matters:** Low. They would matter for scoring a rare hand correctly in the Play tab.

**Owner:** Changs.

**Source:** `data/table.config.json`, `unconfirmed.combination_tai_rest`;
`INPUTS/PLAN-original-2026-09-12.md`, "Open items".

**Impact:** Small, and only on rare hands.

**Related:** D-001.

**Target Resolution:** Whenever the owner has a minute with the tai table.

**Status:** OPEN

**Resolution:**

---

## Q-007 — Section 6.5 of the study, All-Pong at minimum 2, was never captured

**Type:** QUESTION

**Description:** The solver uses the study's minimum-1 All-Pong table plus a flat +0.5 correction
where the other targets have real minimum-2 corrections of +1.6 to +3.8. Sweeping the placeholder
from 0 to 3 moved overall agreement by 0.1 points and raising it made All-Pong worse, so the 0.5 is
near optimal.

**Why It Matters:** A rigour item rather than a quality one. Capturing the section would let the
table be exact.

**Owner:** Agent, with the source book on the owner's machine.

**Source:** `INPUTS/PLAN-original-2026-09-12.md`, "Open items"; `FINDINGS.md`, "How far the book
coach is from the measurement" (2026-08-26).

**Impact:** Small and measured.

**Related:** RS-003, D-006.

**Target Resolution:** Not scheduled.

**Status:** OPEN

**Resolution:**

---

## Q-008 — Did the study's own simulations use wildcards?

**Type:** QUESTION

**Description:** The study's source note mentions the minimum fan and the fan limit and never
mentions wildcards. Its draw rate of 14% sits near our no-wildcard 19% and nowhere near our
four-wildcard 0.6%, but its turn count is nearer our four-wildcard game. Two numbers point
opposite ways.

**Why It Matters:** It decides how far the study's value tables and reads travel to the owner's two
tables. The project left it open rather than guessing.

**Owner:** Agent; reading the source more carefully might answer it.

**Source:** `FINDINGS.md`, "The book's benchmark was never our game" (2026-09-01) and "What it does
not settle" under "The wildcard rule changes the game more than any opponent does" (2026-09-06).

**Impact:** Interpretive. The project's own measurements at each table do not depend on it.

**Related:** RS-003, D-011.

**Target Resolution:** Listed under "Research needed" in `RESEARCH.md`.

**Status:** OPEN

**Resolution:**

---

## Q-009 — The pack phase mix leans mid-hand: correct it or accept it?

**Type:** QUESTION

**Description:** With `--mix decisive` each stratum takes its share of the decisive positions that
exist, and the packs came out about 50% mid-hand against 40% in the run, with the early hand
under-represented on purpose. Whether the mid-hand lean should be corrected has not been decided.

**Why It Matters:** The early hand is where a player has the most turns to get wrong and the fewest
decisive positions to practise on; more early questions need more hands or deeper play-outs, not a
different selection rule.

**Owner:** Changs.

**Source:** `NEXT.md` 2026-09-12, "Smaller"; commit `ab5e24f`; `FINDINGS.md`, "The pack no longer
skews late" (2026-08-31).

**Impact:** A pack rebuild if corrected.

**Related:** D-008.

**Target Resolution:** After the owner has used the packs for a week.

**Status:** OPEN

**Resolution:**

---

## Q-010 — Which device holds the owner's own record

**Type:** QUESTION

**Description:** Everything the app remembers lives in one browser's storage. Training on both a
phone and a desktop produces two mistake records, two schedules and two cause tallies. The original
plan said to pick one device, or treat the other as read-only, or use the save-and-restore in Table
setup as a manual bridge, and to pick before the record has a month in it. The bridge exists; no
rule has been chosen.

**Why It Matters:** The record is the spine of the method and splitting it costs more than the
convenience is worth.

**Owner:** Changs.

**Source:** `INPUTS/PLAN-original-2026-09-12.md`, "The thing to decide before any of this: one
device or two".

**Impact:** A habit rather than a build.

**Related:** D-016, R-005.

**Target Resolution:** Before the record has a month in it.

**Status:** OPEN

**Resolution:**

---

## Q-011 — Per-card table labels where a verdict differs between tables: still wanted?

**Type:** QUESTION

**Description:** The Tips page carries one line naming the table every verdict was measured at and
what changes without wildcards, and the framework's table section says the same. The last task in
`TABLE-VARIANTS.md`, labelling each card whose answer differs between tables and giving Table setup
a control for which table the app is on, is not marked done. Table setup already edits the joker
count and the minimum.

**Why It Matters:** The user story was that a card whose answer depends on the table should say so,
so a 2-tai habit is not carried into a 1-tai game.

**Owner:** Changs.

**Source:** `TABLE-VARIANTS.md`, tasks 5 and 9.

**Impact:** A pass over the cards.

**Related:** D-011, D-013.

**Target Resolution:** Not scheduled.

**Status:** OPEN

**Resolution:**

---

## A-001 — Training on play-out-graded decisive positions improves real play

**Type:** ASSUMPTION

**Description:** The whole app rests on the belief that practising positions where the play-outs
separate a best answer, graded against that answer, makes a person better at the table. No human
has been measured against any of it. The coach was tuned against opponents like itself, the packs
are decisions with answers rather than a fair sample of the game, and the play-outs are finished by
a fast bot rather than good players.

**Why It Matters:** It is the premise of the project.

**What Happens If Wrong:** The hour is spent on the wrong positions. The framework's honest signals,
a rising Train score and a changing leading cause, would still move without real play improving.

**Owner:** Changs, as the only human who can be measured.

**Source:** `Framework - Mahjong.md`, "How much of this we believe" and "How honest the feedback
is".

**Related:** D-002, D-008, Q-001.

**Status:** OPEN

**Resolution:**

---

## A-002 — The stage order and the minute split of the practice hour

**Type:** ASSUMPTION

**Description:** The framework orders the stages as table, vocabulary, spotting, working it out,
mixed practice, reading, then pushing and folding, and splits the hour five, ten, twenty-five,
fifteen, five. Both are the agent's best guess, chosen so the two components that transfer get
more than half the time. Nothing tested whether vocabulary must come before spotting or reading
sits better sixth than third.

**Why It Matters:** It is what the owner will actually do three days a week.

**What Happens If Wrong:** Time goes to the wrong drill. The mistake record would show it slowly.

**Owner:** Changs.

**Source:** `Framework - Mahjong.md`, "How much of this we believe".

**Related:** Q-004, C-003.

**Status:** OPEN

**Resolution:**

---

## A-003 — Spotting is a separate skill from solving

**Type:** ASSUMPTION

**Description:** The Spot tab exists because the chess framework treats seeing as a skill separate
from solving. That has not been tested here. The Spot tab keeps the per-question scores that would
test it.

**Why It Matters:** Ten minutes of every hour.

**What Happens If Wrong:** The Spot time would be better spent on Train.

**Owner:** Agent, with the Spot scores once there are enough.

**Source:** `Framework - Mahjong.md`, "How much of this we believe".

**Related:** A-002.

**Status:** OPEN

**Resolution:**

---

## A-004 — Friends' testing needs no shared data for now

**Type:** ASSUMPTION

**Description:** Friends test on their own phones with their own records and no login. The export
on the Review tab is assumed to be enough of a bridge, and a "send this to Changs" button an
afternoon's work if their records turn out worth collecting after a fortnight.

**Why It Matters:** It is the reason there is no server.

**What Happens If Wrong:** A button to post a record is built; a real login is not.

**Owner:** Changs.

**Source:** `MOBILE.md`, "Not doing: accounts".

**Related:** D-016.

**Status:** OPEN

**Resolution:**

---

## C-001 — The P-Starter lifecycle rule for `prototype/` against the owner's decision

**Type:** CONFLICT

**Description:** Part 6 of `P-Starter.md` says that after BASELINE the prototype is a historical
artefact, is not kept in step with production, and that prototyping again later means a fresh,
scoped exercise rather than a second application tracking production. The owner decided on
2026-09-12 that `prototype/` is a runnable snapshot of the current build, is `ACTIVE`, and is
where new features are prototyped before production code is written.

**Sources In Conflict:**

- `P-Starter.md`, Part 6, "After BUILD — three things stay separate" and "Prototyping again later".
- The owner's instruction of 2026-09-12, recorded as D-025.

**Why It Matters:** A later session reading Part 6 would otherwise set the folder to `HISTORICAL`
and stop maintaining it.

**Owner:** Changs.

**Impact:** `PROTOTYPE.md` is written to the owner's decision and says so.

**Related:** D-025, `PROTOTYPE.md`.

**Status:** RESOLVED

**Resolution:** The owner's decision wins for this project (D-025). The recipe's underlying concern,
that prototype behaviour must not be mistaken for accepted behaviour, still applies and is kept as
a rule in `PROTOTYPE.md`.

---

## C-002 — The original plan says Vercel; the site is on GitHub Pages; `vercel.json` remains

**Type:** CONFLICT

**Description:** `INPUTS/PLAN-original-2026-09-12.md` describes a Vercel deployment from the
repository root and gives the steps. The live site is GitHub Pages, built by
`.github/workflows/pages.yml`. `vercel.json` is still in the tree with its build and cache-header
configuration.

**Sources In Conflict:**

- `INPUTS/PLAN-original-2026-09-12.md`, "Deploy".
- `.github/workflows/pages.yml` and `NEXT.md`, "Where things are".

**Why It Matters:** A session reading the old plan could try to deploy to a host that does not serve
the site.

**Owner:** Agent.

**Impact:** None on the live site.

**Related:** D-020.

**Status:** RESOLVED

**Resolution:** Two states of the same thing over time. Vercel was the plan on 2026-08-27; Pages went
live on 2026-09-10 (D-020). `vercel.json` is dead configuration. Whether to delete it has not been
asked; it does no harm and it is not what serves the site.

---

## C-003 — The framework describes two practice tabs with two judges; the app has one

**Type:** CONFLICT

**Description:** `Framework - Mahjong.md` says the two practice tabs are graded by different judges,
that the Train tab grades against the Coach and the Real quiz against the play-outs, and splits the
hour into twenty-five minutes on Train and fifteen on the Real quiz. On 2026-09-10 the two tabs
were merged into one Train tab judged by the play-outs with the Coach as a labelled fallback
(D-012). The framework was rewritten on 2026-09-11 and still carries the two-tab description.

**Sources In Conflict:**

- `Framework - Mahjong.md`, "The five components, and where they live", "The stages", "The practice
  hour" and "How to tell it is working".
- The app since commit `880eb5b`, and D-012.

**Why It Matters:** The framework is the plan the owner will follow. As written it sends him to a
tab that no longer exists and describes a transfer gap between two judges that the app no longer
presents. `NEXT.md` noted that the framework "should keep the name it measured under", which is
right for the measurements and wrong for the practice-hour instructions.

**Owner:** Changs, since the framework draft is his to review (Q-004).

**Impact:** The practice hour's forty minutes on the two tabs become forty minutes on one, and the
"honest signal" paragraph about the Train-versus-Real-quiz gap needs rewriting.

**Related:** D-012, Q-004, A-002.

**Status:** OPEN

**Resolution:**

---

## DEP-001 — GitHub Pages on the free tier needs the repository public, with the sources excluded

**Type:** DEPENDENCY

**Description:** The site is served by GitHub Pages on a free account, which requires the
repository to be public. The two scanned books, the `.acsm` file and the tile charts are excluded
by `.gitignore` and must stay excluded.

**Depends On:** GitHub's free Pages tier remaining available for public repositories; the
`.gitignore` rules staying in place.

**Why It Matters:** Making the repository private would take the site down; pushing the sources
would publish the owner's books.

**Owner:** Changs.

**Blocks:** Nothing today.

**Needed By:** Continuously.

**Status:** OPEN

**Resolution:**

---

## R-001 — The whole-hand judge is wrong about taking a win, and the cause is unknown

**Type:** RISK

**Description:** The Play tab judges each decision with the same play-outs as the packs. On
positions where a win is on offer and could be declined, it prefers declining about half the time,
and that preference costs money: a coach that declines a win under two *Tai* loses 0.229 chips a
game over 8,000 paired deals, and under three *Tai*, 0.944. Measured 2026-09-13.

The reason first written here was that the play-out bots never fold, so a waiting hand keeps its
future value while a cashed one stops. **That was measured and it is wrong.** Putting the Coach in
the other three chairs moves the gap by -0.48 ± 0.35, the wrong way. Replaying the hand's real
hidden tiles instead of guessing them moves it by +1.13 ± 1.15. Three explanations are excluded -
the rollout opponents, the hidden-tile guess, and noise - and none has replaced them. FINDINGS
carries all of it.

**Why It Matters:** The Play review is the reason the Play tab exists. On one decision it is
measured to be wrong, and the mechanism that would tell us which *other* decisions are affected is
not understood. *Pong* and *Chow* verdicts have not been tested either way; the money test above
covers declining a win, not calling a tile.

**Likelihood / Impact:** Certain on the decision to take a win, and measured. Unknown on calls.

**Owner:** Agent.

**Mitigation:** The Play tab no longer marks taking a win as a mistake; the verdict reads "Not
judged" and says why, and the session tally does not count it. The screen says throws are trusted
and calls have not been checked. That is containment, not a fix.

**Resolution Method:** Two pieces, in this order. First, find the cause: the excluded explanations
narrow it, and the next candidates worth instrumenting are what the acting seat's own rollout bot
does after declining, and whether the hand-level payoff is complete for a branch that ends the hand
early. Second, run the same paired-money design on calling rather than winning, which is the only
thing that will settle *Pong* and *Chow*.

**Related:** D-002, D-021, D-027, Q-001, `PLAN.md`, `PROTOTYPE.md`.

**Status:** OPEN, narrowed

**Resolution:**

---

## R-002 — The coach uses the four-joker danger reads and weight at every table

**Type:** RISK

**Description:** `solver/src/reads.ts` is one table measured on the four-joker run, and
`DANGER_WEIGHT` in `solver/src/rank.ts` is 40. Both can be overridden through the context, and
nothing above the solver selects a different table or weight when the table has no jokers.
Measured on 2026-09-06, taking the jokers out roughly doubles the danger of every tile, the
corrected reads table is worth +0.215 chips a game at a no-joker table, and the weight there wants
about 80. So at the owner's no-joker table the coach under-reads late danger by about half.

**Why It Matters:** The coach is the three opponents on the Play tab, the judge of the made-up-hand
fallback on Train, and the answer on the Your hand tab. The pack verdicts are not affected, since
they are play-outs at the pack's own table.

**Likelihood / Impact:** Certain at the no-joker table; the cost to the owner is that the coach's
safety advice there is too brave.

**Owner:** Agent.

**Mitigation:** None built. The measurement says which reads table to use and roughly what weight;
the reverse transfer, no-joker reads at a four-joker table, costs nothing measurable, so if one
table must serve both it is the no-joker one. Not on the plan; surfaced here for the owner.

**Related:** D-005, D-011.

**Status:** OPEN

**Resolution:**

---

## R-003 — The no-joker pack cannot grow without more grading

**Type:** RISK

**Description:** The `min1-nowild` pack holds about half of all the decisive positions its run has,
so it is honest but has no headroom. Growing it, or rebuilding it with a different mix, means
grading more no-joker hands, at about eight hours per 480,000 decisions on the Mac.

**Why It Matters:** Any change to the pack recipe hits this pack first.

**Likelihood / Impact:** Certain if the pack is rebuilt larger.

**Owner:** Agent.

**Mitigation:** Budget a night of grading before promising a larger no-joker pack.

**Related:** D-009, D-010.

**Status:** OPEN

**Resolution:**

---

## R-004 — Positive measurements shrink on fresh deals

**Type:** RISK

**Description:** Every figure measured before 2026-09-02 was measured on deals that were in some
way chosen. The one positive result re-run on named virgin ranges shrank by two thirds. Negative
results had no incentive to be lucky; positive ones did.

**Why It Matters:** A positive result quoted at its fitted size will be relied on.

**Likelihood / Impact:** Known to have happened once; likely for any positive not re-run.

**Owner:** Agent.

**Mitigation:** D-003 is the rule: ranges named in advance, a confirmation batch that holds on its
own, and no quoting of the earlier number.

**Related:** D-003, D-007.

**Status:** OPEN

**Resolution:**

---

## R-005 — The training record lives in one browser and is saved by hand

**Type:** RISK

**Description:** The mistake record, the schedule, the cause tallies and the hand log are in local
storage. Save-and-restore in Table setup writes and reads a file, and the Review tab has an export.
A mistake record is worth most in its third and fourth week, which is exactly when losing it would
cost the most.

**Why It Matters:** The record is the spine of the method.

**Likelihood / Impact:** Cleared site data, a lost phone or a new browser loses everything since the
last save.

**Owner:** Changs.

**Mitigation:** The framework says to save at the end of the first week and then whenever he
remembers. No automatic backup exists and none is planned (D-016).

**Related:** D-014, D-016, Q-010.

**Status:** OPEN

**Resolution:**
