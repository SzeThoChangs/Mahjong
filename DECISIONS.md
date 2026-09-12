# DECISIONS

## Purpose of this file

This file records the important decisions this project has made and the reasoning behind each one,
so that a later session does not quietly undo a deliberate choice it does not understand.

## It answers

What did we decide, and why?

## What belongs here

Decisions that materially affect what the app does, what the coach is, how the packs are built,
how the app is delivered, what the training plan asks for, or that involved a real trade-off. Each
has a stable identifier, `D-001` onwards, and each says what was decided, when, by whom, and on
what evidence.

Most of these decisions were made on measurement rather than on preference. The measurement itself
lives in `FINDINGS.md`; an entry here points at the finding rather than restating it.

## What does not belong here

- Minor implementation choices.
- Every change that followed from a decision; that is `CHANGELOG.md`.
- Open questions; those are in `OPEN-ITEMS.md`.
- Delivery order; that is `PLAN.md`.
- The measurements themselves; those are in `FINDINGS.md` and registered in `RESEARCH.md`.

## When to update

When a material decision is made, reversed or superseded. Not every session produces one. Do not
rewrite an old decision to make history look cleaner. If a later decision replaces an earlier one,
keep the earlier one, mark it `SUPERSEDED`, and point each at the other. The reasoning that was
later abandoned is often the most useful thing here.

## Relationship to other files

A decision usually closes an item in `OPEN-ITEMS.md`, changes something in `PLAN.md` or the app, and
earns a line in `CHANGELOG.md` that references it. The evidence for a measured decision is in
`FINDINGS.md`, registered as `RS-001` in `RESEARCH.md`. Where a decision came from the owner in
conversation it is marked `CONFIRMED`; where it was reached by the agent from measurement and has
stood since, it is marked `OBSERVED`, which means a later session should treat it as settled
practice but should not claim the owner said it.

---

## Decision Index

| ID | Date | Decision | Status |
|---|---|---|---|
| D-001 | 2026-08-24 | The table is the owner's own house rules, read from config and never from constants | ACTIVE |
| D-002 | 2026-08-29 | A decision is judged against a measured best from paired play-outs, never against the result | ACTIVE |
| D-003 | 2026-09-02 | Nothing ships to the coach without a paired money result on ranges named in advance | ACTIVE |
| D-004 | 2026-08-30 | The coach stays the hand-written book coach; the machine-learning programme is closed | ACTIVE |
| D-005 | 2026-09-06 | The coach's danger side is closed at weight 40; reads are taught, not priced | ACTIVE |
| D-006 | 2026-09-06 | The row-scaled value table ships; the committed table was baked and reverted | ACTIVE |
| D-007 | 2026-09-02 | The legal-wait rule stays on at about +0.018 chips a game | ACTIVE |
| D-008 | 2026-09-10 | Packs select on decisiveness, and honest packs beat balanced ones | ACTIVE |
| D-009 | 2026-09-11 | Every pack question is verified twice, on fresh play-outs | ACTIVE |
| D-010 | 2026-09-10 | Three tables only; the money and nowild packs are retired | ACTIVE |
| D-011 | 2026-09-06 | The no-joker table is measured before anything is rebuilt, and a second edition is warranted | ACTIVE |
| D-012 | 2026-09-10 | One practice tab, Train, judged by the play-outs, with the Coach as a labelled fallback | ACTIVE |
| D-013 | 2026-09-06 | Every playbook rule is a card with an evidence badge, and contradicted cards stay on the page | ACTIVE |
| D-014 | 2026-09-06 | The pattern library and the mistake record are software here, not markdown files | ACTIVE |
| D-015 | 2026-09-10 | Packs are sharded, with the cause label baked in at build time | ACTIVE |
| D-016 | 2026-09-07 | No login for friends testing; each phone keeps its own record | ACTIVE |
| D-017 | 2026-09-07 | A bottom bar on phones, not a top tab bar | ACTIVE |
| D-018 | 2026-09-07 | The square table stays on a phone, at a 22px tile | ACTIVE |
| D-019 | 2026-09-07 | The app is installable and works offline; packs are cached on use, not up front | ACTIVE |
| D-020 | 2026-09-10 | GitHub Pages at the project URL, deployed on every push, over a hosted service | ACTIVE |
| D-021 | 2026-09-06 | A playable game is the direction, but it is not the training tool, and it comes after the drills | ACTIVE |
| D-022 | 2026-09-06 | Game terms are written in italics and coloured by kind; *Ting Pai* is the word for ready | ACTIVE |
| D-023 | 2026-09-10 | The icon is the green dragon on maroon | ACTIVE |
| D-024 | 2026-08-23 | The copyrighted source material never leaves the machine | ACTIVE |
| D-025 | 2026-09-12 | `prototype/` is ACTIVE, is a snapshot of the current build, and new features are prototyped there first | ACTIVE |
| D-026 | 2026-08-30 | No Rust or WASM port for now | ACTIVE |
| D-027 | 2026-09-13 | The Play review never marks taking a win as a mistake | ACTIVE |

---

## D-001 — The table is the owner's own house rules, read from config and never from constants

**Date:** 2026-08-24, with rules confirmed on 2026-08-23, 2026-08-29 and 2026-09-01.

**Status:** ACTIVE

**Decision:** The engine, the solver and the playbook read the house rules from
`data/table.config.json` and nothing hardcodes a tai value. The table is Singapore mahjong at a
minimum of 2 tai, capped at 5, self-draw allowed at 1, four jokers, the discarder paying the whole
bill on a discard win, flowers and animals paying double, and the bao rules as the owner confirmed
them on 2026-09-01.

**Context / Problem:** The rulebook the project started from describes a general Singapore table.
The owner plays a specific one, and several of the measured answers change with the minimum and
with the jokers.

**Reason:** The owner confirmed the rules item by item. The config file carries the confirmation
notes with their dates, and `RULES.md` says plainly that nothing in the engine should hardcode a
fan value.

**Alternatives Considered:** Using the study's default table of minimum 1 and no jokers. Rejected
because it is not the game the owner plays.

**Source / Evidence:** `data/table.config.json` (the `confirmed_2026_09_01` and
`confirmed_2026_08_29` blocks), `RULES.md`, commits of 2026-08-24 on the money rules. CONFIRMED,
owner-stated.

**Impact:** Every measurement in `FINDINGS.md` before 2026-09-06 is at this one table. The remaining
unconfirmed items are recorded as `Q-006`.

**Related Items:** D-010, D-011, Q-006.

---

## D-002 — A decision is judged against a measured best from paired play-outs, never against the result

**Date:** 2026-08-26, with the honest verdict bands added 2026-08-29.

**Status:** ACTIVE

**Decision:** Every quiz position is graded by playing each legal action out many times with the
same deals, and the best is the action with the highest average chips. A verdict respects the
error bar: a gap inside one standard error is "too close to call", and a pack admits a question
only when the best beats the runner-up by two standard errors.

**Context / Problem:** Mahjong lies. A correct discard deals in and a reckless one wins, so a
trainer that grades on outcome teaches nothing. The first quiz used fixed dollar bands and called
moves mistakes that the play-outs could not separate.

**Reason:** The paired play-out is the only honest grader available. The noise floor was measured
and found structural rather than a coupling artefact, so more play-outs alone do not fix it; what
fixes it is only asking questions the play-outs can answer.

**Alternatives Considered:** Grading on the coach's opinion (right 52.8% of the time on decisive
positions); a lower-variance target such as win rate (tried and closed 2026-08-26); more play-outs
(a bad trade, 16 times the compute for 47%).

**Source / Evidence:** `FINDINGS.md`, "The noise floor is structural" (2026-08-26), "Verdicts respect
the error bar" and "Packs select on decisiveness" (2026-08-29), "A lower-variance target does not
work either". OBSERVED from the record; the owner's 2026-09-10 request for "the best coach/trainer"
settled every later call in favour of the play-outs (see D-012).

**Impact:** The packs, the Challenge button, the Play tab's review and the tip verdicts all run on
this instrument. Its known weakness on claims is `R-001`.

**Related Items:** D-003, D-008, D-009, R-001, A-001.

---

## D-003 — Nothing ships to the coach without a paired money result on ranges named in advance

**Date:** 2026-09-02, after the lesson of 2026-08-27 and the bake rule of 2026-09-06.

**Status:** ACTIVE

**Decision:** A change to the coach is played for money against the shipped coach, with walls
paired between arms, the tested bot rotated through all four seats, on shuffle ranges named before
the run and never used to fit anything. A confirmation batch must hold on its own, and the bake
rule fixed on 2026-09-06 is that the second batch must be positive by itself and the pooled result
must reach three standard errors.

**Context / Problem:** Per-decision accuracy against the measured best predicted winning wrong three
times in a row. The one rule shipped on twelve fitted seeds at +0.048 shrank to +0.018 the moment it
met deals nobody had chosen, which is what the winner's curse looks like from the inside.

**Reason:** A proxy is unreliable, and the only way to know which way it points is to play it out,
which now costs about twenty minutes. Results measured on chosen deals overstate themselves.

**Alternatives Considered:** Trusting per-decision agreement; trusting a single batch.

**Source / Evidence:** `FINDINGS.md`, "Accuracy against measured EVs does not predict winning"
(2026-08-27), "The one thing we shipped is worth about a third of what we claimed" (2026-09-02),
"Eight more ranges, and it baked" (2026-09-06). OBSERVED.

**Impact:** Every positive result dated before 2026-09-02 should be re-run on a fresh range before
its size is believed. The `self` arm of the harness must return exactly zero or nothing else on the
page can be trusted.

**Related Items:** D-004, D-006, R-004.

---

## D-004 — The coach stays the hand-written book coach; the machine-learning programme is closed

**Date:** 2026-08-30, reinforced 2026-09-01.

**Status:** ACTIVE

**Decision:** The player the app teaches is the book coach in `solver/`, built on the study's value
tables. No fitted model replaces it.

**Context / Problem:** Three models were fitted on the decisive subset and beat the coach on every
per-decision measure. Three more hand-written ideas looked sound.

**Reason:** All six lost when played for money. The discard model lost 0.544 chips a game, the claim
model was dead level at +0.001, both together lost 0.180, pricing the flower route lost 0.18, the
give-up rule lost 0.039, and every fold threshold swept lost more the more it fired. On the study's
own game the coach walks the numbers toward the book monotonically, which was the first
independent evidence the coach is sound rather than merely locally unbeatable.

**Alternatives Considered:** The three models; a fast imitation coach (built, learned colour play,
not needed); truncated rollouts with a terminal value, which remains the only untried lever and is
no longer urgent since the gap it was meant to close turned out to be 0.54 rather than 2.66.

**Source / Evidence:** `FINDINGS.md`, "Four things played for money, and none of them won"
(2026-08-29), "How much to defend, finally measured in money" (2026-08-30), "The book's benchmark
was never our game" (2026-09-01); `INPUTS/PLAN-original-2026-09-12.md`, "Where it stands
(2026-08-30)". OBSERVED.

**Impact:** Three changes have ever shipped to the coach: the legal-wait rule (D-007), the row
scaling (D-006), and the committed table, which was reverted (D-006). The learned model's opinion
was dropped from the app on 2026-09-02.

**Related Items:** D-003, D-005, D-006, D-007.

---

## D-005 — The coach's danger side is closed at weight 40; reads are taught, not priced

**Date:** 2026-09-06, after results on 2026-08-30, 2026-09-02 and 2026-09-03.

**Status:** ACTIVE

**Decision:** `DANGER_WEIGHT` stays at 40. No measured read is priced into the coach. Reads that are
true go on the Tips page as things a person can learn.

**Context / Problem:** Six danger-side changes were played for money and every one paid nothing:
the wall read, the suit read, the meld read, the danger weight sweep, the cost of a deal-in, and
the coach-measured reads table. Several of the reads are emphatically true.

**Reason:** The coach already prices every discard continuously against what the tile does for the
hand, and at the margin those two numbers are close, so a better estimate of deal-in probability
swaps one nearly equal throw for another. More defence loses money monotonically out to 4.5
standard errors. The weight is right at 40 against both opponent populations, and which population
the deal-in table was measured on does not change how the coach plays.

**Alternatives Considered:** A per-opponent danger model priced by each opponent's visible value,
which is a real build and is not to be started without a better reason than "this time it is
finer". The second-discard-pile read is the one to try first if the standing rule is ever
revisited, because it sharpens the on-the-floor discount rather than restating it.

**Source / Evidence:** `FINDINGS.md`, "How much to defend" (2026-08-30), "Pricing what a deal-in
COSTS is worth nothing either" (2026-09-03), "The danger reads do not matter on either field"
and "The danger weight is right at 40 on both fields" (2026-09-06). OBSERVED.

**Impact:** The danger side is field-independent end to end. It is not rule-independent: see D-011
and R-002 for the no-joker table.

**Related Items:** D-004, D-011, D-013, R-002.

---

## D-006 — The row-scaled value table ships; the committed table was baked and reverted

**Date:** 2026-09-04 (row scaling shipped), 2026-09-06 (committed table baked, then reverted the same
day).

**Status:** ACTIVE

**Decision:** `solver/src/tables.ts` is generated from `tables-rowscale-g1.35.json`: the study's own
values with one multiplier per table row and a gain of 1.35. The committed-slope table stays tracked
in `knowledge/sources/fitted/` as a candidate and is not shipped.

**Context / Problem:** Re-fitting the value tables on our own hands was the plan, and the full
re-fit lost about a chip a game because it measured the value of a position under a plan-switching
coach rather than the value of committing to a plan.

**Reason:** The row scaling is worth +0.200 chips a game against coaches over 64,000 paired deals
and +0.125 against the personality field, so it holds on both. The committed table won +0.101
against coaches over 128,000 deals and lost 0.210 against the field, so it is a table that wins
against one opponent and loses to everyone else the project can simulate. A table fitted to the
field alone only reaches level, which is the honest end of the value-table programme in this
family.

**Alternatives Considered:** The full re-fit (loses 0.83 to 1.09); the committed table (field-
specific); a table pooled across both fields (halves the field loss and does not clear it);
re-weighting the pool (does nothing at the weights tried).

**Source / Evidence:** `FINDINGS.md`, "Our own value tables lose, and the one part worth keeping is
the smallest" (2026-09-04), "The committed-slope table wins money" (2026-09-05), "The committed
table loses against a table that is not three coaches" and "The limit case" (2026-09-06).
OBSERVED.

**Impact:** The shipped coach is at its family's ceiling for both fields. Anything further has to
change the shape of the tables rather than their weights.

**Related Items:** D-003, D-004.

---

## D-007 — The legal-wait rule stays on at about +0.018 chips a game

**Date:** 2026-09-02.

**Status:** ACTIVE

**Decision:** `legalWait` in `solver/src/rank.ts` stays on by default. The claim in the app and in
`FINDINGS.md` is +0.018 plus or minus 0.012 on unseen deals, and nobody should quote the earlier
+0.048.

**Context / Problem:** The rule counts a winning tile as dead when it would leave the hand under the
table minimum. It shipped at +0.048 over twelve fitted seeds and measured +0.018 on 120,000 virgin
deals, inside two standard errors.

**Reason:** The point estimate is still on its side, and the reasoning does not depend on the
measurement: counting winning tiles the table forbids you to declare is wrong on its face. On 119
graded positions where it applied the play-outs took the declarable wait 91% of the time. Keeping
it costs nothing if it is truly zero.

**Alternatives Considered:** Turning it off.

**Source / Evidence:** `FINDINGS.md`, "The first idea from the tactics book" (2026-09-01) and "The
one thing we shipped is worth about a third of what we claimed" (2026-09-02). OBSERVED.

**Impact:** Small. It changes one discard in about 180.

**Related Items:** D-003, D-004.

---

## D-008 — Packs select on decisiveness, and honest packs beat balanced ones

**Date:** 2026-08-29 (decisiveness), 2026-08-31 (phase strata), 2026-09-10 (`--mix decisive`).

**Status:** ACTIVE

**Decision:** A pack keeps only positions where the best action beats the runner-up by two standard
errors. Strata are decision kind by hand phase. Since 2026-09-10 each stratum takes its share of the
decisive positions that exist rather than of every decision seen, so no stratum is padded with
close calls, and the resulting skew away from the early hand is accepted.

**Context / Problem:** Selecting on spread gave a pack that was three quarters ungradeable. Holding
the mix by kind alone gave a pack that was 43% late-hand against a run that is 25%. Holding the mix
to the run's proportions then padded the early stratum with close calls, 58% of it on the no-joker
pack.

**Reason:** Early in a hand most throws do not matter yet, so a pack that mirrors the run is asking
coin flips. The positions kept are the ones where being right is worth money. The owner listed
"honest packs over balanced ones" among the things decided and not to be reopened.

**Alternatives Considered:** Selecting on spread; holding the run's phase mix by backfilling with
close calls.

**Source / Evidence:** `FINDINGS.md`, "Packs select on decisiveness, not spread" (2026-08-29), "The
pack no longer skews late" (2026-08-31); commit `ab5e24f` (2026-09-10); `NEXT.md`, "Decided, so do
not reopen". CONFIRMED.

**Impact:** The trainer teaches positions where one action is clearly right, which is a narrower
lesson than a fair sample of the game, and the packs are about 28% questions about a named shape
against roughly 8% drawn straight, since tagged questions are kept first. The mid-hand lean this
produces is `Q-009`.

**Related Items:** D-002, D-009, Q-009, A-001.

---

## D-009 — Every pack question is verified twice, on fresh play-outs

**Date:** 2026-09-11.

**Status:** ACTIVE

**Decision:** `quizpack.ts --verify 512` re-judges every admitted question on 512 fresh coupled
play-outs with a different seed and drops it unless the best still beats the runner-up by two
standard errors. The packs were rebuilt admitting 12,800 so that after the drop they hold about
ten thousand each. Every question id from the earlier packs survives, so no stored card is
orphaned.

**Context / Problem:** The owner threw 1筒 on question `coach · 6310:4:31` and was charged a $4.03
big mistake; re-judged on 2,048 fresh play-outs the three tiles were within 28 cents. Picking the
winner from a noisy sample picks some of its luck, and nothing in the pipeline had measured that.

**Reason:** Forty random questions re-judged put about one verdict in ten as a close call wearing a
decisive badge. The verify pass dropped about a fifth, which is the stricter question of whether
the gap still clears the bar; the best answer itself changed on about one question in 400. Every
question now on the site has cleared the bar twice on independent play-outs.

**Alternatives Considered:** A one-off audit; leaving the badge as it was.

**Source / Evidence:** `FINDINGS.md`, "The packs overstate their certainty by about a tenth"
(2026-09-10, built 2026-09-11); commits `4c89cc1` and `7287349`. CONFIRMED, since the owner's
dispute triggered it and the result was reported to him.

**Impact:** Pack sizes are coach 10,500, min1 10,473, min1-nowild 10,257. A pack build now takes
about two hours longer per pack and must run one pack at a time.

**Related Items:** D-002, D-008, R-003.

---

## D-010 — Three tables only; the money and nowild packs are retired

**Date:** 2026-09-10.

**Status:** ACTIVE

**Decision:** The site serves three packs, one for each table the owner plays: `coach` (four jokers,
minimum 2), `min1` (four jokers, minimum 1) and `min1-nowild` (no jokers, minimum 1). The `money`
pack, which was the four-joker minimum-2 table under an older name, and the `nowild` pack, which
was no jokers at minimum 2, are dropped from the site. Copies stay in `data/gen/retired-packs/`
for the audit tools.

**Context / Problem:** Five buttons for three tables.

**Reason:** The owner does not play a no-joker table at minimum 2, and two packs for the same table
were confusing. Dropped at his say-so.

**Alternatives Considered:** Keeping all five.

**Source / Evidence:** Commit `c7b8f67`; `NEXT.md`, "Retired packs". CONFIRMED, owner-stated.

**Impact:** A mistake card on a phone that points at a retired pack shows "cannot be rebuilt" with a
button to drop it, which is intended.

**Related Items:** D-001, D-011.

---

## D-011 — The no-joker table is measured before anything is rebuilt, and a second edition is warranted

**Date:** 2026-09-06, on a request made the same day.

**Status:** ACTIVE

**Decision:** Before rebuilding any pack or table for the no-joker game, play the same deals with
and without jokers and compare. Having done so: the danger reads and the pack get a second edition
for the no-joker table, the value tables do not, and the Tips page and the framework say which
table every verdict was measured at.

**Context / Problem:** Every hand the project had ever generated used four jokers, and the owner
also plays without them. Three quarters of the table he plays at had never been checked.

**Reason:** The cheap measurement came first, fifteen minutes against a day of compute, and it
said the tables are far apart: drawn hands 19% against 0.6%, hands 54 turns against 40, and a late
throw about twice as likely to deal in. The minimum barely moves the danger at either joker count;
it decides what is allowed to finish instead. Refitting the value tables at zero jokers is a null
(-0.062), correcting the danger reads is worth +0.215, and the danger weight wants roughly 80
rather than 40 without jokers.

**Alternatives Considered:** Rebuilding the packs first without measuring. Rejected as a day of
compute that might buy nothing.

**Source / Evidence:** `TABLE-VARIANTS.md`; `FINDINGS.md`, "The wildcard rule changes the game more
than any opponent does", "All four of his tables", "The no-joker table wants a braver danger
weight and the same value tables" (all 2026-09-06). The request is recorded in
`INPUTS/PLAN-original-2026-09-12.md` under "On the phone, and on the other table". CONFIRMED that
the owner asked; the method and results are OBSERVED.

**Impact:** The no-joker pack exists (D-010). What has not been done is making the coach itself use
the no-joker reads and weight when the table has no jokers; that is `R-002`. Per-card table labels
where a verdict differs are `Q-011`.

**Related Items:** D-001, D-005, D-010, R-002, Q-008, Q-011.

---

## D-012 — One practice tab, Train, judged by the play-outs, with the Coach as a labelled fallback

**Date:** 2026-09-10.

**Status:** ACTIVE

**Decision:** The Train tab and the Real quiz tab are one tab called Train. It serves pack questions
judged by the play-outs by default, and falls back to a generated hand marked by the Coach only when
the filters leave nothing, saying plainly that the hand is made up and how often the Coach is
right. A Coach verdict and a play-out verdict are never presented as the same thing, and the
mistake record and hand log both say which judge marked a hand.

**Context / Problem:** The two tabs differed only in who marks the answer. Both explained their
reasoning and both could be aimed at a mistake cause.

**Reason:** The owner asked for the merge and said "I want the best coach/trainer", which decides
every small call in favour of the play-outs, since the Coach picks the measured best 52.8% of the
time on decisive positions and 36.1% early in the hand.

**Alternatives Considered:** Keeping two tabs.

**Source / Evidence:** Commit `880eb5b`; `NEXT.md`, "The merge". CONFIRMED, owner-stated.

**Impact:** `Framework - Mahjong.md` still describes two practice tabs graded by two judges; that is
`C-003`. `FINDINGS.md` keeps the name "Real quiz" as the name things were measured under.

**Related Items:** D-002, C-003.

---

## D-013 — Every playbook rule is a card with an evidence badge, and contradicted cards stay on the page

**Date:** 2026-09-03 (all 102 rules on the page), 2026-09-06 (every rule has a verdict).

**Status:** ACTIVE

**Decision:** The Tips page carries all 103 cards, grouped by where in a hand they apply, each with
the rule in plain English, the reasoning, and a badge saying what backs it. Of the 103, 59 are
measured and hold, 18 are contradicted, 4 are confirmed by counting, 6 are rules of the table and
16 state nothing testable. The eighteen contradicted cards stay, marked, with what was measured
and why the book's reasoning fails.

**Context / Problem:** The book was presented with one level of confidence. Most of it had never
been checked here, and a plan that told the reader to learn the playbook would teach eighteen false
things.

**Reason:** An honest inventory is the useful output. Several contradicted cards are the opposite
of true, and reading why is worth an evening.

**Alternatives Considered:** Deleting contradicted cards; presenting only the measured ones.

**Source / Evidence:** `FINDINGS.md`, "Every rule in the playbook now has a card" (2026-09-03) and
"The last untested read is backwards, and the playbook is done" (2026-09-06); `Framework -
Mahjong.md`, "The patterns". OBSERVED.

**Impact:** The pattern library is the Tips page (D-014). The list of the eighteen is in the
framework.

**Related Items:** D-005, D-014, RS-004.

---

## D-014 — The pattern library and the mistake record are software here, not markdown files

**Date:** 2026-09-06 (framework written), built into the app over 2026-09-02 to 2026-09-06.

**Status:** ACTIVE

**Decision:** Unlike the `Chess/` and `Business Communication/` folders, which keep `Pattern
Library.md` and `Mistakes.md`, this folder keeps both in the app: the library is the Tips page,
checked by tests so a card cannot quietly stop demonstrating its claim, and the mistake record is
the Review tab, which schedules itself at one, three, seven, fourteen and thirty days and asks the
question again rather than showing the old answer. Every mistake carries a cause, from a list of
eight, suggested by the app and confirmed by a tap.

**Context / Problem:** The parent project's five-part system needs a library and a record. Markdown
versions here would go stale against the code within a week.

**Reason:** The verdicts live on the cards and change when a measurement changes; the record has to
schedule reviews and count causes, which a file cannot do.

**Alternatives Considered:** Markdown files like the other two folders.

**Source / Evidence:** `Framework - Mahjong.md`, "The five components, and where they live"; commits
of 2026-09-02 (review schedule) and 2026-09-06 (every mistake has a cause). OBSERVED. The framework
is a draft awaiting owner review (`Q-004`), but the app is built this way and in use.

**Impact:** The record lives in one browser's storage; see `R-005` and D-016.

**Related Items:** D-013, D-016, Q-004, R-005.

---

## D-015 — Packs are sharded, with the cause label baked in at build time

**Date:** 2026-09-07 (design), 2026-09-10 (built).

**Status:** ACTIVE

**Decision:** Each pack is an index of a few kilobytes plus about a hundred shards of about a
hundred questions. Every question carries its cause label, computed once when the pack is built
against the pack's own table. A question's shard is a hash of its id (`fnv1a32`, modulus recorded
in the index), and a reader must use the modulus from the index rather than count the shards it
can see.

**Context / Problem:** Parsing one 10 MB pack took 3.5 seconds on a Mac and would freeze a phone for
8 to 15 seconds at 70 MB of heap. The cause was computed in the browser against the reader's own
table config, which is the wrong table, and needed a background warmer that sharding would break.

**Reason:** Baking the cause deletes the warmer, the cache and the cold walk in one go, lets the
index answer a cause filter without fetching anything, and is more correct because it uses the
table the hand was played on. Hashing keeps ids exactly as they were so cards stored before the
shards still open. A qid-to-shard map would have cost 160 KB, most of what sharding was meant to
save.

**Alternatives Considered:** A qid-to-shard map in the index; renaming questions after their shard
(would orphan every stored card).

**Source / Evidence:** `MOBILE.md`, "The sharding design, settled 2026-09-07" and "Built 2026-09-10";
commit `8946d51`. OBSERVED, agent design recorded in the phone pass.

**Impact:** First question after about 200 KB instead of 15 MB. Offline, only shards actually
answered are kept. The pack builder writes index and shards in one pass so a tally can never
disagree with a shard.

**Related Items:** D-019, Q-005.

---

## D-016 — No login for friends testing; each phone keeps its own record

**Date:** 2026-09-07.

**Status:** ACTIVE

**Decision:** No accounts. Each phone keeps its own record in local storage, separate by
construction. The export on the Review tab, and the save-and-restore in Table setup, are the
bridge. If after a fortnight the friends' records turn out to be worth collecting, a single "send
this to Changs" button that posts the same JSON is an afternoon.

**Context / Problem:** Friends are testing on phones.

**Reason:** A login buys their data on our machine, cross-device use, and knowing who said what, and
none of those are wanted yet. A real login is an auth provider, a server, a database and somebody's
privacy to look after, and it puts a wall in front of the thing we want them to try.

**Alternatives Considered:** A real login; real sync, which would end the "nothing leaves your
browser" property.

**Source / Evidence:** `MOBILE.md`, "Not doing: accounts"; `NEXT.md`, "Decided, so do not reopen".
CONFIRMED.

**Impact:** The owner's own one-device-or-two question is still open (`Q-010`). The export button
that posts to Changs is on the list of smaller things to build (`PLAN.md`).

**Related Items:** D-014, Q-010, R-005, A-004.

---

## D-017 — A bottom bar on phones, not a top tab bar

**Date:** 2026-09-07, built 2026-09-11.

**Status:** ACTIVE

**Decision:** On screens under 640px the navigation is a bottom bar with five destinations, Train,
Spot, Review, Tips and More, with the remaining tabs behind More. Every control is at least 48px
tall and the safe-area insets are respected top and bottom.

**Context / Problem:** Eight tabs cannot fit across 360px at a legible size. The top bar shrank the
tabs to 29px, below the touch minimum, and pushed Tips, Film room and Table setup behind a
horizontal scroll nobody discovers. All 27 tappable controls were under the 44px minimum.

**Reason:** A bottom bar with an overflow sheet is the honest way to carry eight destinations on a
phone, and it puts the four used every session where the thumb rests. A mockup with two live
360px frames settled it.

**Alternatives Considered:** Keeping the top bar; a horizontal scroll.

**Source / Evidence:** `MOBILE.md`, "Settled: the navigation moves to the bottom", with the mockup
at `https://claude.ai/code/artifact/e1788fde-df9e-43db-adfc-8da2352febc5`; `NEXT.md`, "Decided, so
do not reopen"; commit `2caa444`. CONFIRMED.

**Impact:** Which four tabs are primary is still open (`Q-003`).

**Related Items:** D-018, Q-003.

---

## D-018 — The square table stays on a phone, at a 22px tile

**Date:** 2026-09-07, built 2026-09-11.

**Status:** ACTIVE

**Decision:** The public table keeps its square layout on a phone rather than stacking the seats
into rows. At a 22px tile the square is 315px wide, which fits the 343px of usable width at 360.
Spacing carries meaning: no gap inside a pile or a claimed set, 6px between a seat's flowers and
each claimed set, 11px between what a seat has shown and what it has thrown.

**Context / Problem:** The table gave up the square below 640px. The square costs height, 417px of
the 557 a phone shows, so the hand sits below the fold.

**Reason:** A pile in front of a seat is information, which seat threw it and when, and a stacked
list throws that away. Reading danger off the discards is half of what the app teaches.

**Alternatives Considered:** Stacking the seats into rows.

**Source / Evidence:** `MOBILE.md`, "Settled: the square table stays on a phone"; `NEXT.md`,
"Decided, so do not reopen". CONFIRMED.

**Impact:** With about fifty discards the square is about 410px wide against 320px of card, so a
late-game table scrolls inside its card at 360px. Whether to accept that is `Q-002`.

**Related Items:** D-017, Q-002.

---

## D-019 — The app is installable and works offline; packs are cached on use, not up front

**Date:** 2026-09-06 (asked for), 2026-09-07 (built).

**Status:** ACTIVE

**Decision:** A manifest, icons and a hand-written service worker of about forty lines. The shell,
the bundle and the 48 tile faces are precached, about 4.7 MB. A pack shard, replay or reads file is
kept only once it has been read. Since 2026-09-11 the worker precaches every on-demand chunk from a
`files.json` the build writes, and is stamped with a hash of the bundle so an update bar appears
after every deploy.

**Context / Problem:** The owner asked to train on a phone. The five packs at the time were 45 MB;
precaching everything would have put the whole thing on the phone before the first question.

**Reason:** Open a table once with a signal and it is yours offline. No build plugin was needed for
a page with no routes. Verified by building, serving, stopping the server and reloading.

**Alternatives Considered:** `vite-plugin-pwa`; precaching everything.

**Source / Evidence:** Commit `804a911` (2026-09-07) and `2caa444` (2026-09-11); the request is in
`INPUTS/PLAN-original-2026-09-12.md`, "On the phone, and on the other table". CONFIRMED that it was
asked for; the caching design is OBSERVED.

**Impact:** The manifest's `start_url` and `scope` must stay relative, or an installed copy opens on
the host's root, which is a 404 on this host. The owner found that on his phone on 2026-09-10.

**Related Items:** D-015, D-020, Q-005.

---

## D-020 — GitHub Pages at the project URL, deployed on every push, over a hosted service

**Date:** 2026-09-10.

**Status:** ACTIVE

**Decision:** The site is `https://szethochangs.github.io/Mahjong/`, built and published by
`.github/workflows/pages.yml` on every push to `main` or `evaluator-accuracy`. Every path the app
fetches goes through `web/src/lib/asset.ts` so the same build works at a domain root or under a
project folder. The repository is public, which the free Pages tier needs.

**Context / Problem:** The original plan deployed from Vercel and `vercel.json` was configured, but
the repository had no remote and the agent could not create hosting accounts. A single-file build
was made first so friends could test without a host.

**Reason:** Pages needs only the repository and a workflow. Once the owner created the remote the
site was live the same day and the single-file build was superseded.

**Alternatives Considered:** Vercel, as the original plan; the single-file build, kept as a fallback
for anywhere with no host.

**Source / Evidence:** Commits `dd3e547` and `df20e76` (2026-09-10); `NEXT.md`, "Where things are".
OBSERVED from the configuration and the live site; the owner's choice of host is not quoted
anywhere, but he created the remote and the site is in use.

**Impact:** `vercel.json` is still in the tree and is not what serves the site; see `C-002`. The
bare account address shows GitHub's 404; the `/Mahjong/` matters.

**Related Items:** D-019, C-002, DEP-001.

---

## D-021 — A playable game is the direction, but it is not the training tool, and it comes after the drills

**Date:** 2026-09-06 (recorded in the plan), 2026-09-12 (first hand playable).

**Status:** ACTIVE

**Decision:** The app will eventually deal a hand and let the player play it out against three
opponents, and that is the direction to build in. It is built after the parts that carry the
training, and it is the place where everything else gets used rather than another drill. The first
slice, one hand against three coaches with every decision judgeable afterwards, is the Play tab,
labelled a prototype. No sessions, rotation or running score yet.

**Context / Problem:** Playing is the seventh stage of the framework and the plan asks for one
whole-hand session a week.

**Reason:** A hand's result has a standard deviation of about 10.7 chips even on paired walls, and a
real improvement to the coach is worth 0.1 to 0.2 chips a hand, so a session cannot tell you
whether you played well. An hour of play is sixty to a hundred discards of which a handful matter,
against a hundred-plus graded positions on the Train tab. What a game gives that no drill can is
the whole hand. So the loop is built to be reviewed rather than won.

**Alternatives Considered:** Building the game first; not building it.

**Source / Evidence:** `INPUTS/PLAN-original-2026-09-12.md`, "Where this is going: a game"; commit
`636a7a3`; the header of `web/src/components/Play.tsx`. OBSERVED from the plan the owner worked
from; whether the loop feels like mahjong is `Q-001`.

**Impact:** The Play review under-prices wins and calls (`R-001`). The rest of the game is sequenced
in `PLAN.md` behind the owner's verdict on the first hand.

**Related Items:** D-002, D-025, Q-001, R-001.

---

## D-022 — Game terms are written in italics and coloured by kind; *Ting Pai* is the word for ready

**Date:** 2026-09-06.

**Status:** ACTIVE

**Decision:** Terms of the game are written `*like this*` in source and rendered in italics by
`web/src/lib/jargon.tsx`, coloured by what kind of word it is: what you do, what you hold, parts of
a hand, hands you can make, the table and its clock, and this app's own words. *Ting Pai* replaces
"ready" in the app, the cards and the framework.

**Context / Problem:** The Spot drill and the Table setup page used "one tile away" to mean two
different things.

**Reason:** A learner cannot tell from the word whether it is an action, a tile or a hand type.
Adopting the game's own term settled the clash.

**Alternatives Considered:** Recorded in `JARGON.md`, which is the review list for the remaining
terms.

**Source / Evidence:** `JARGON.md`; commits of 2026-09-06 tagged `jargon:` and `tips:`; `NEXT.md`,
"Decided, so do not reopen". CONFIRMED.

**Impact:** The code still says `shanten` and `readyTurn`; the framework says so.

**Related Items:** D-013.

---

## D-023 — The icon is the green dragon on maroon

**Date:** 2026-09-10.

**Status:** ACTIVE

**Decision:** The home-screen icon is the green dragon tile on a maroon ground, replacing the red
dragon on felt made earlier the same day.

**Context / Problem:** The installed app needed an icon.

**Reason:** The owner's choice.

**Alternatives Considered:** The red dragon on felt.

**Source / Evidence:** Commit `b097a1c`; `NEXT.md`, "Decided, so do not reopen". CONFIRMED.

**Impact:** None beyond the assets in `web/public/`.

**Related Items:** D-019.

---

## D-024 — The copyrighted source material never leaves the machine

**Date:** 2026-08-23.

**Status:** ACTIVE

**Decision:** The two scanned books, the `.acsm` file and the two tile charts are excluded from git
by `.gitignore` under the heading "copyrighted source material: NEVER push". What is committed is
the project's own restatement in `knowledge/`, which the coverage notes describe as game mechanics
and probability facts in Singapore terms rather than source text. `RESEARCH.md` registers the
books by reference and copies nothing.

**Context / Problem:** The repository is public (D-020), and the original plan noted that publishing
the cards openly is a different act from using them privately.

**Reason:** They are the owner's books. `git ls-files` shows none of them tracked.

**Alternatives Considered:** A password-protected deployment was offered in the original plan and
not taken up.

**Source / Evidence:** `.gitignore`; `INPUTS/PLAN-original-2026-09-12.md`, "Two things to settle
before a public URL". CONFIRMED by the repository's own rule.

**Impact:** The `.gitignore` entries must stay. Anyone registering the books writes about them, not
from them.

**Related Items:** D-020, RS-002, RS-003, DEP-001.

---

## D-025 — `prototype/` is ACTIVE, is a snapshot of the current build, and new features are prototyped there first

**Date:** 2026-09-12.

**Status:** ACTIVE

**Decision:** The `prototype/` folder is seeded as a runnable snapshot of the current production
build, its lifecycle state in `PROTOTYPE.md` is `ACTIVE`, and from now on a new feature is
prototyped there before its production code is written.

**Context / Problem:** The P-Starter recipe (Part 6) says that after BASELINE the prototype becomes a
historical artefact that must not track production, and that later prototyping should be a fresh,
deliberately scoped exercise rather than a second application following production. This project
passed BASELINE long before the recipe arrived: the production app is live and in use.

**Reason:** The owner decided it. His reasoning as given to the lead is that he wants somewhere to
try a feature and react to it before it is built for real, and the cheapest such place is a copy
of what exists. The tension with the recipe is real and is recorded here so a later session does
not "correct" the folder back to `HISTORICAL`: the risk the recipe names, that prototype behaviour
gets mistaken for accepted behaviour, is handled by the rule that learning still has to be accepted
into the project files before it reaches production, and that a prototype divergence is not a
defect.

**Alternatives Considered:** Following Part 6 as written and leaving `prototype/` empty or
historical.

**Source / Evidence:** Owner-stated to the lead on 2026-09-12; recorded in `PROTOTYPE.md` and
`C-001`. CONFIRMED.

**Impact:** The lead builds the prototype. This decision sits above Part 6 of `P-Starter.md` for
this project. The Play tab, which production carries under the label "prototype", is the first
thing the folder should carry (`PROTOTYPE.md`).

**Related Items:** D-021, C-001, Q-001.

---

## D-026 — No Rust or WASM port for now

**Date:** 2026-08-30.

**Status:** ACTIVE

**Decision:** The solver stays in TypeScript. A port is revisited only if tuning runs reach millions
of games, and the first fix would be algorithmic in TypeScript rather than a port.

**Context / Problem:** Grading is slow: about eight hours per 480,000 decisions on the Mac.

**Reason:** Nothing has needed it. The one lever that cuts variance and compute together is
truncated rollouts with a terminal value, which is a change of method rather than of language.

**Alternatives Considered:** A WASM port of the solver hot loop.

**Source / Evidence:** `INPUTS/PLAN-original-2026-09-12.md`, "Open items". OBSERVED.

**Impact:** Compute stays a constraint; see `PROJECT.md`.

**Related Items:** D-004.

---

## D-027 — The Play review never marks taking a win as a mistake

**Date:** 2026-09-13 · **Decided by:** Agent, on measurement · **Status:** ACTIVE

**What was decided:** When a player declares a win and the play-outs prefer some other action, the
Play tab's review shows "Not judged" and a sentence saying why, rather than "Mistake". The session
tally does not count it.

**Why:** The judge is measured to be wrong on exactly this decision. On 50 recorded positions where
a win could be declined it preferred carrying on 23 times, and a coach that follows that preference
loses 0.229 chips a game at a two *Tai* threshold and 0.944 at three, over 8,000 paired deals each,
against three coaches and against the mixed field alike. Two candidate explanations were tested and
excluded: the rollout opponents move the gap by -0.48 ± 0.35, and replaying the real hidden tiles
moves it by +1.13 ± 1.15. `FINDINGS.md` carries all of it.

**What was rejected, and why:** Leaving the verdict in with a warning. A player reading "Mistake"
against a win they took learns the opposite of what makes money, and a warning at the top of the
page does not undo a badge next to the decision. Also rejected: changing the rollout policy, which
was the fix the previous entry proposed - it is measured not to be the cause.

**What would reverse it:** Finding the cause and fixing it, then showing the verdict again. This is
containment of a defect, not a view about mahjong.

**Related:** `R-001`, D-002, D-021, `FINDINGS.md`, `datagen/src/winprice.ts`, `datagen/src/declinewin.ts`.
