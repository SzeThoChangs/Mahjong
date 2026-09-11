# RESEARCH

## Purpose of this file

This file is the register of investigation done for this project: what exists, what it found, how
confident we are, and what has been accepted. The material itself lives elsewhere and is opened only
when this register is not enough.

## It answers

What have we investigated, what did it find, how confident are we, and what has been accepted?

## What belongs here

One entry per research item with a stable identifier, `RS-001` onwards: the question it set out to
answer, where the material came from, what it found, how confident that finding is, what it does
not establish, and whether it has been accepted into the project.

In this project the research is mostly measurement. The project's own play-out experiments are
written up in `FINDINGS.md` at the root, and they are registered here as one item because they are
one continuous record. The two source books are copyrighted, git-ignored, and registered by
reference only.

## What does not belong here

- The measurements themselves; those stay in `FINDINGS.md`, which is where the code and the other
  files already point. Do not move it into `RESEARCH/`.
- Source material as received; that is `INPUTS/`, and for the two books it is the two git-ignored
  folders at the root, which must never be copied anywhere.
- What we do not know; that is `OPEN-ITEMS.md`.
- Constructed experiments about the product; those are `PROTOTYPE.md` and `prototype/`.
- Choices made; those are `DECISIONS.md`.

## Rules

Every finding cites its source. Each entry records where the material came from: `OWNER-SUPPLIED`,
`AGENT-GATHERED` or `MIXED`. A finding is `OBSERVED` at best and reaches a decision or the app only
by deliberate acceptance, which the entry records. Each entry says what it does not establish.
Confidence is stated as `HIGH`, `MODERATE` or `LOW`. Each entry carries an `As of` date and a
`Recheck` trigger, because a finding about the coach expires when the coach changes and a finding
about a table expires when the rules do.

The copyrighted folders are registered by name and by what was extracted from them. Nothing from
inside them is quoted or copied into this file or into `RESEARCH/`.

## When to update

When an item is started, produces findings, is accepted or rejected, or is superseded. A new
`FINDINGS.md` entry does not need a new register entry; `RS-001` covers the file, and its `As of`
date should move when the file does.

## Relationship to other files

Research here usually exists to settle something in `OPEN-ITEMS.md` or to back a decision in
`DECISIONS.md`. The decisions that rest on measurement point at `RS-001` and at the dated entry in
`FINDINGS.md`. The framework, `Framework - Mahjong.md`, draws its numbers from `RS-001` and its
outside citations from `RS-005`. `RESEARCH/` holds a `README.md` and a `manifest.json` that point
at the material where it already lives, at the root and in `knowledge/`, because moving it would
break references in the code and every other document; any new write-up goes into `RESEARCH/`
itself, named `YYYY-MM-DD-slug.md`, and is registered here and added to the manifest.

---

## Register

| ID | Title | Question | Origin | Status | Confidence | As of | Recheck | Resolves |
|---|---|---|---|---|---|---|---|---|
| RS-001 | The measured record, `FINDINGS.md` | Which ideas about play, grading and the coach survive being played out? | AGENT-GATHERED | ACCEPTED | HIGH for the negatives, MODERATE for the positives | 2026-09-11 | When the coach, the packs or the table rules change | D-002 to D-011 |
| RS-002 | The Riichi tactics book, 136 tips | Which of its tips survive translation to Singapore rules? | OWNER-SUPPLIED | ACCEPTED | MODERATE | 2026-08-23 | None; the extraction is done, and the verdicts live in RS-001 | RS-004 |
| RS-003 | The data-analytic study of Singapore mahjong | What are the rules, the scoring, the value tables and the measured reads? | OWNER-SUPPLIED | ACCEPTED | HIGH on rules, MODERATE on numbers | 2026-08-23 | Q-007 and Q-008 remain | D-001, D-006 |
| RS-004 | The merged playbook, 103 rules | What does an expert at this table actually do, decision by decision? | MIXED | ACCEPTED | Per card, on the Tips page | 2026-09-06 | When a card's measurement is redone | D-013 |
| RS-005 | Outside sources cited in the framework | What published work backs the mistake types and the drill order? | AGENT-GATHERED | FINDINGS | MODERATE | 2026-09-11 | Before quoting | Q-004 |
| RS-006 | The parent research, how people learn fast | What makes learning fast, across skills? | OWNER-SUPPLIED | ACCEPTED | HIGH, as the parent project states it | 2026-09-06 | Owned by the parent folder | The nine ideas in `../CLAUDE.md` |
| RS-007 | The four tables, `TABLE-VARIANTS.md` | Does the advice hold with and without jokers, at minimum 1 and 2? | AGENT-GATHERED | ACCEPTED | HIGH | 2026-09-06 | When a fourth table is played | D-010, D-011 |
| RS-008 | The phone-pass measurements, `MOBILE.md` | What is wrong with the app on a 360px screen, and by how much? | AGENT-GATHERED | ACCEPTED | HIGH for the measurements | 2026-09-07 | Q-005 remains | D-015, D-017, D-018 |

**Status:** `PLANNED`, `IN PROGRESS`, `FINDINGS`, `ACCEPTED`, `REJECTED`, `STALE`, `SUPERSEDED`.

---

## Research needed

Open items whose answer looks like it needs investigation rather than an owner decision. This is an
agent assessment; appearing here does not settle how an item is resolved.

| Open item | Why research rather than a decision |
|---|---|
| Q-008, whether the study used wildcards | A careful reading of the study's method section, on the owner's machine, might answer it. Nobody can decide it. |
| Q-007, Section 6.5 of the study | The section exists in the source and was never captured; capturing it is extraction, not a choice. |
| R-001, the claim judge | This one needs construction and measurement, so it is an experiment for `PROTOTYPE.md` rather than reading. |

---

## Items

## RS-001 — The measured record, `FINDINGS.md`

**Question:** Which ideas about how to play this table, how to grade a decision, and how to improve
the coach survive being played out for money on paired deals?

**Origin:** AGENT-GATHERED. Every number was measured in this project on the owner's Mac, at the
owner's direction; the owner supplied the table rules and, on 2026-09-10, one disputed verdict that
led to the verification pass.

**Status:** ACCEPTED

**Confidence:** HIGH for the negative results, which had no incentive to be lucky. MODERATE for the
positive results, one of which shrank by two thirds when re-run on fresh deals; every positive dated
before 2026-09-02 should be re-run on a named range before its size is believed.

**As of:** 2026-09-11, the date of the last entry.

**Recheck:** When the coach, the packs or the table rules change. Any figure quoted from before
2026-08-30 was measured on a single hardcoded set of deals, and per-seat breakdowns from then
should be re-checked on a second seed.

**Resolves / informs:** D-002 through D-011, D-013, R-001, R-002, R-004.

**Material:** `FINDINGS.md` at the project root, about 32,000 words in about fifty dated entries from
2026-08-25 to 2026-09-11, newest near the top of each section. The tools that produced it are in
`solver/src/tools/` and `datagen/src/`, and the logs in the git-ignored `data/gen/`.

### Sources

| Source | Type | Where it came from |
|---|---|---|
| `solver/src/tools/headtohead.ts` and `datagen/src/fieldtest.ts` | Paired money harnesses | Written here; the `self` arm must return exactly zero |
| `datagen/src/evaluate.ts` and `solver/src/rejudge.ts` | The play-out grader | Written here; the phone and the pack builder share it |
| `data/gen/run-money3`, `run-money4`, `run-coach2` and the plan-locked runs | Generated datasets | Git-ignored, about 11 GB |
| `datagen/src/tiptest.ts`, `calltest.ts`, `discardtest.ts`, `tells.ts`, `reads.ts`, `release.ts`, `windorder.ts`, `wildcompare.ts` | Tip and read scorers | Written here |

### Method

Every chips-per-game figure rotates the tested bot through all four seats against three identical
opponents, pairs the walls between arms, and reports a mean and a standard error. A difference
smaller than twice its error bar is not a difference. Tips are scored on graded pack positions
against a baseline that knows what each throw is, and reads are measured by replay on two
populations because one read has already reversed between them. Since 2026-09-02, ranges are named
before a run.

### Findings

- The noise floor on discards is structural: 4% of discards, 27% of claims and 72% of self-actions
  have a best action separable at two standard errors. Packs therefore keep only decisive
  positions (D-008).
- The hand-written coach beats every fitted model and every heuristic tried; six candidates lost
  or drew (D-004). Three changes have ever shipped: the legal-wait rule at about +0.018, the row
  scaling at +0.200, and the committed table, which was reverted (D-006, D-007).
- The danger side is closed: six danger-side changes paid nothing, the weight is right at 40 on
  both opponent populations, and the deal-in table is population-proof (D-005).
- The wildcard rule changes the game more than any opponent does: hands run 54 turns against 40,
  draws 19% against 0.6%, late danger roughly doubles. The minimum barely moves the danger and
  decides what may finish instead (D-011).
- Of 103 playbook cards, 59 hold, 18 are contradicted, 4 are confirmed by counting, 6 are rules of
  the table, 16 state nothing testable (D-013). The strongest results are `escape_single_waits`
  (90% against 47% by luck), `flush_decided_early` (71% against 23%) and the finding that a throw
  that costs the hand no distance is best 85% of the time.
- The packs overstated their certainty by about a tenth; verifying every question on fresh
  play-outs dropped about a fifth and changed the best answer on about one in 400 (D-009).
- The whole-hand judge is honest on throws and biased toward playing on for claims (R-001).

### What this does NOT establish

- Anything about a human player. No human has been measured against the coach, the packs or the
  framework (A-001).
- Which of the two simulated opponent populations a person is nearer, which decides the sign of
  the one value-side trade the project could not settle.
- The value of any read as advice to a person, as opposed to as a term in the coach; the reads are
  measured true and priced worthless, and only the pricing was rejected.

### Limitations

- The play-outs are finished by a fast shanten bot rather than good players, so an option whose
  value depends on playing a colour hand well is undervalued; this was measured to matter little on
  decisive positions (2026-09-02) and to matter on claims (2026-09-11).
- The packs are decisions with answers, not a fair sample of the game, and about 28% of questions
  are about a named shape against roughly 8% drawn straight.

### Accepted

Accepted continuously into the coach, the packs, the Tips page and the framework as each finding
landed; the decisions record the dates. Nothing in the file is quoted in the app at a size larger
than its confirmation batch supports.

---

## RS-002 — The Riichi tactics book, 136 tips

**Question:** Which of the book's tips survive translation from Japanese rules to Singapore rules,
and what do they become?

**Origin:** OWNER-SUPPLIED. The owner's copy, as page captures in the git-ignored folder
`136 ready to use MJ strategy and tactics/` at the root (95 files) with its `.acsm` file beside
it. Registered by reference only; nothing from it is copied here or anywhere in the repository.

**Status:** ACCEPTED

**Confidence:** MODERATE as a source for this table. The extraction is careful, but the book is
about a different game, and measurement later contradicted eighteen of the merged cards, most of
them from this source.

**As of:** 2026-08-23, when the extraction was made.

**Recheck:** None; the extraction is done, and the verdicts on each tip now live in RS-001 and on
the Tips page.

**Resolves / informs:** RS-004, D-013.

**Material:** `knowledge/sources/tactics.singapore.json` (the 77 concepts kept, restated in
Singapore terms) and `knowledge/sources/COVERAGE.md` (what was dropped and why).

### Sources

| Source | Type | Where it came from |
|---|---|---|
| The book itself | Copyrighted page captures, git-ignored | Owner-supplied |
| `knowledge/sources/COVERAGE.md` | The project's own coverage note | Written here |

### Method

Read in full, tip by tip, and sorted into what survives. 77 concepts kept, of which 57 port
directly, 19 needed re-tuning for tai scoring and one is a weak prior. About 55 dropped: the dora
machinery, riichi declaration mechanics, furiten, patterns absent from the tai table, han and fu
arithmetic, and the not-ready penalty.

### Findings

- The book's value is in shaping a hand: which block to break, which wait to prefer, what a
  discard reveals. It says nothing about wildcards and nothing native about the tai table.
- Three things it could see that the coach could not: winning tiles that cannot legally win, what
  an opponent melded rather than how many times, and what the discard pool says beyond class and
  freshness. The first became the one rule shipped from this source (D-007).

### What this does NOT establish

- Whether any tip is true at this table. That was measured separately (RS-001), and eighteen of the
  merged cards are contradicted.

### Limitations

- Handedness: play runs to the right here, the opposite of Japanese convention, so any seat-based
  tip had to be re-aimed.

### Accepted

Accepted into the playbook (RS-004) on 2026-08-23, then re-judged card by card through 2026-09-06.

---

## RS-003 — The data-analytic study of Singapore mahjong

**Question:** What are the rules, the scoring, the target values by turn and the measured
opponent reads for Singapore mahjong, from a native source that simulated the game?

**Origin:** OWNER-SUPPLIED. The owner's copy, as page captures in the git-ignored folder
`Data Analytic Evluation of Singapore Mahjong/` at the root (116 files). Registered by reference
only; nothing from it is copied here or anywhere in the repository.

**Status:** ACCEPTED

**Confidence:** HIGH on the rules and the scoring, which the owner then confirmed against his own
table (D-001). MODERATE on the numbers: the study's benchmark of 23% wins, 14% draws and 48 turns
turned out to describe a game without wildcards, and one section was never captured (Q-007).

**As of:** 2026-08-23, when the extraction was made; the value tables were checked against our own
hands on 2026-09-04.

**Recheck:** Q-007 and Q-008 remain open against it.

**Resolves / informs:** D-001, D-006, Q-007, Q-008.

**Material:** `RULES.md` (the implementation notes), `knowledge/sources/strategy.dataanalytic.json`
(the measured rules), `knowledge/sources/tables.study.json` (a pristine snapshot of the study's
value tables, which `baketables.ts` reads so the correction cannot compound), and
`knowledge/sources/COVERAGE-dataanalytic.md`.

### Sources

| Source | Type | Where it came from |
|---|---|---|
| The study itself | Copyrighted page captures, git-ignored | Owner-supplied |
| `knowledge/sources/COVERAGE-dataanalytic.md` | The project's own coverage note | Written here |

### Method

Extraction and verification rather than translation. The coverage note records that the project's
first guess at the scoring file was wrong in its values and was replaced, and that the study
corrected one factual error in the Riichi material.

### Findings

- The tile set, the wall, the move priority, the direction of play, the pay-all scenarios and the
  kong taxonomy, all now in the engine.
- The value tables by plan and turn, which the coach runs on. Inside a plan our own hands
  reproduce the study's ordering and spacing at an R-squared of 0.86 to 1.00; between plans the
  rows want different scales, which is what the row scaling corrects (D-006).
- Every fixed strategy loses money; selection is the engine.

### What this does NOT establish

- Whether its simulations used wildcards (Q-008), so how far its numbers travel to the owner's
  four-joker table is not settled by the study itself.
- Anything about the owner's minimum-2 table directly; the study is at minimum 1, with minimum-2
  adjustments, and Section 6.5 on All-Pong at minimum 2 was never captured (Q-007).

### Limitations

- Its draw rate is a fact about its players as much as its rules, which this project learned the
  hard way (2026-09-01 and 2026-09-06).

### Accepted

Accepted into the engine, the solver and `RULES.md` on 2026-08-23 and 2026-08-24; the table rules
were then confirmed with the owner (D-001).

---

## RS-004 — The merged playbook, 103 rules

**Question:** What does an expert at this table actually do, organised by the decision being made
rather than by which book it came from?

**Origin:** MIXED. Two owner-supplied books (RS-002, RS-003) merged by the agent, then every rule
measured (RS-001).

**Status:** ACCEPTED

**Confidence:** Stated per card on the Tips page, not for the playbook as a whole. Fifty-nine cards
hold, eighteen are contradicted, four are confirmed by counting, six are rules of the table, and
sixteen state nothing testable.

**As of:** 2026-09-06, when the last untested card got a verdict.

**Recheck:** When a card's measurement is redone; each card carries the date and the sample of its
verdict.

**Resolves / informs:** D-013, D-014.

**Material:** `knowledge/PLAYBOOK.md` (readable), `knowledge/playbook.json` (102 rules plus a
22-step decision procedure and a table profile), `knowledge/README.md`, and the Tips page in the
app, which is the accepted form.

### Sources

| Source | Type | Where it came from |
|---|---|---|
| RS-002 and RS-003 | The two books | Owner-supplied |
| `solver/src/tips.ts` and `solver/src/shapetag.ts` | The cards and the tagger that finds positions a card is about | Written here |

### Method

Merged by decision phase: deal, build, call, read, push or fold, discard, and meta. Where the two
sources disagree the measured one wins. Then, from 2026-09-02 to 2026-09-06, each rule was given
a detector and scored on graded pack positions, by replay, or by counting, on two populations.

### Findings

- The playbook is worth reading and not worth learning whole. The eighteen contradicted cards are
  listed in `Framework - Mahjong.md` under "The patterns".
- A claim about what to do with a tile cannot be measured without saying who else is at the table;
  five claims split by population.

### What this does NOT establish

- That a rule which is true is worth scoring with. The coach does not read the playbook; it never
  has, and the one time a playbook idea was priced into it the gain was small (D-007).

### Limitations

- `knowledge/README.md` still says 102 rules and counts 24 measured; the Tips page counts 103 cards
  and 59 measured. The page is current and the README is the older inventory.

### Accepted

Accepted as the Tips page on 2026-09-03, with verdicts complete on 2026-09-06 (D-013).

---

## RS-005 — Outside sources cited in the framework

**Question:** What published work backs the parts of the framework that this project's own
measurements cannot: why a mistake is sorted only after the result is set aside, what tilt is, and
which Japanese shape and defence ideas transfer?

**Origin:** AGENT-GATHERED, for the framework draft of 2026-09-11.

**Status:** FINDINGS. The framework that cites them is a draft awaiting the owner's review (Q-004).

**Confidence:** MODERATE. The citations are real and linked, and each is used for one narrow claim.
They were gathered from the agent's reading rather than from a search the owner directed.

**As of:** 2026-09-11.

**Recheck:** Before quoting any of them beyond the use the framework makes of them.

**Resolves / informs:** Q-004, A-002.

**Material:** The "Sources" section at the end of `Framework - Mahjong.md`.

### Sources

| Source | Type | Where it came from |
|---|---|---|
| Baron and Hershey (1988), Outcome bias in decision evaluation, and the 2023 replication by Aiyer and others | Published papers | Agent-gathered; links in the framework |
| Tendler and Carter (2011), The Mental Game of Poker, and Tendler's 2013 PokerNews piece | Published book and article | Agent-gathered |
| Chiba (2016), Riichi Book 1 | Published book, free | Agent-gathered |
| tenpaiman (2012), Basic Defense Techniques in Mahjong | Published article | Agent-gathered |

### Method

Each is cited once, for the one claim it supports, with a link.

### Findings

- Outcome bias: the same decision is judged worse when it turns out badly, which is why the cause
  sort starts only after the result is set aside.
- Tilt as attaching one's sense of skill to results, and the three-to-one ratio of process goals to
  result goals.
- The five-block method transfers because it is about tiles; the pair rule does not, because of the
  minimum.
- Genbutsu and suji rest on the mechanism this project found, that suited tiles deal in mostly by
  completing a run; the riichi declaration as an anchor does not transfer.

### What this does NOT establish

- That the framework's stage order or minute split is right (A-002). None of these sources speaks
  to that.

### Limitations

- Four sources for four claims; not a literature review.

### Accepted

Not yet. Acceptance follows the owner's review of the framework (Q-004).

---

## RS-006 — The parent research, how people learn fast

**Question:** What makes learning fast, across skills, and what does a training plan for any skill
have to contain?

**Origin:** OWNER-SUPPLIED, from the parent project one folder up.

**Status:** ACCEPTED

**Confidence:** HIGH, as the parent project states it: the nine ideas rest on experiments, and the
parent's own write-up separates what is proven from what is a guess.

**As of:** 2026-09-06, when the framework for this skill was first written against them.

**Recheck:** Owned by the parent folder; this project does not maintain it.

**Resolves / informs:** The nine ideas and the five-part system in `../CLAUDE.md`, which every plan
here has to use.

**Material:** `../Research - How to Learn Fast.md` and `../CLAUDE.md`. Referenced, not copied.

### Sources

| Source | Type | Where it came from |
|---|---|---|
| `../Research - How to Learn Fast.md` | The parent's research write-up | Owner's project |
| `../Key to Learning.txt` | The conversation that produced the five-part system | Owner's project |

### Method

Read as given. This project adds one thing the parent did not anticipate: mahjong's feedback is not
merely noisy but dishonest, so the plan judges decisions against a measured best rather than
against results.

### Findings

- The nine ideas: retrieve rather than reread; space the sessions; mix the types; explain with the
  book closed; build patterns; climb difficulty in steps; find out the right answer and why; fix
  what is actually broken; distrust how practice feels.
- The five components: a pattern library, spotting practice, working-it-out practice, mixed
  practice, and a mistake record reviewed at one, three, seven, fourteen and thirty days.

### What this does NOT establish

- Anything specific to mahjong.

### Limitations

- None that this project can assess; the parent owns it.

### Accepted

Accepted by construction; it is the brief this project was built to.

---

## RS-007 — The four tables, `TABLE-VARIANTS.md`

**Question:** Does the app's advice hold at the tables the owner actually plays, with four jokers
and with none, at a minimum of 1 and of 2, when everything had been measured at one corner?

**Origin:** AGENT-GATHERED, on a question the owner raised on 2026-09-06.

**Status:** ACCEPTED

**Confidence:** HIGH. Paired comparisons of 3,000 deals an arm at each corner, the same seeds in
every arm.

**As of:** 2026-09-06.

**Recheck:** If a fourth table is ever played, or if the coach is changed to select reads by
table (R-002).

**Resolves / informs:** D-010, D-011, R-002, Q-011.

**Material:** `TABLE-VARIANTS.md` (the plan, with tasks marked done) and the entries dated 2026-09-06
in `FINDINGS.md`.

### Sources

| Source | Type | Where it came from |
|---|---|---|
| `datagen/src/wildcompare.ts` and `wildcheck.ts` | The four-corner harness and the legality smoke test | Written here |
| `FINDINGS.md`, six entries dated 2026-09-06 | The results | RS-001 |

### Method

Prove the engine deals a legal no-joker game, then play the same deals at each corner with four
coaches, then refit the value tables and re-measure the danger reads at zero jokers and play each
for money.

### Findings

- The wildcard axis dominates. Late danger roughly doubles without jokers at either minimum and
  barely moves with the minimum at either joker count.
- The minimum decides what is allowed to finish: wins blocked by the minimum fall from 846 to 215
  with jokers and from 656 to 37 without.
- The value tables do not want a refit at zero jokers (a null); the danger reads do (+0.215), and
  the weight wants about 80. The transfer is one way: no-joker reads at a four-joker table cost
  nothing measurable.

### What this does NOT establish

- Whether the study's own numbers were at a joker table (Q-008).
- Anything about the coach as shipped at the no-joker table; the corrected reads exist as a
  measured table and are not wired in (R-002).

### Limitations

- The danger-weight sweep at zero jokers used different shuffle ranges per arm, so it locates a
  direction rather than a number.

### Accepted

Tasks 1 to 6 and 8 of `TABLE-VARIANTS.md` are done and accepted: the Tips page and the framework
say which table each verdict is about, and the no-joker pack exists (D-010). Task 9, the per-card
labels and the table control, is open (Q-011).

---

## RS-008 — The phone-pass measurements, `MOBILE.md`

**Question:** What is wrong with the app on a 360px screen, and by how much?

**Origin:** AGENT-GATHERED, measured on the built app on 2026-09-07.

**Status:** ACCEPTED

**Confidence:** HIGH for the measurements, which are counts and timings on the built app. The
layout decisions that followed were settled with the owner on a mockup.

**As of:** 2026-09-07; the fixes landed on 2026-09-10 and 2026-09-11.

**Recheck:** Q-005, the 4G load time, is the one measurement still owed.

**Resolves / informs:** D-015, D-017, D-018, D-019, Q-002, Q-003, Q-005.

**Material:** `MOBILE.md`.

### Sources

| Source | Type | Where it came from |
|---|---|---|
| The built app at 360px | Measurement | Agent |
| The mockup at `https://claude.ai/code/artifact/e1788fde-df9e-43db-adfc-8da2352febc5` | Two live 360px frames | Agent, reviewed by the owner |

### Method

Measure every tappable control, the tab bar width, the pack parse time and heap, the gzipped
transfer size, and the use of safe-area insets, on the built app at 360px.

### Findings

- All 27 tappable controls were under the 44px minimum; the tab bar was 557px wide on a 360px
  screen; one pack took 3,464ms to parse on a Mac and 70 MB of heap; the download was 2.2 MB
  gzipped and was not the problem; nothing used the safe-area insets.
- Seven tiles at 44px plus gaps is 332px, exactly the usable width at 360, so a fourteen-tile hand
  always wraps to two rows; no layout choice avoids this.

### What this does NOT establish

- Anything on a real phone over mobile data (Q-005).

### Limitations

- Measured on one viewport; the device matrix in `MOBILE.md` names the others, and the layout was
  later checked at 360, 393 and 430.

### Accepted

Accepted into the app on 2026-09-10 (sharding, D-015) and 2026-09-11 (the layout pass, D-017,
D-018, D-019).
