# CHANGELOG

## Purpose of this file

This file is the chronological record of material changes to the project, so that a person or an
agent can understand how the project reached its current state without reconstructing it from git,
old file versions, or conversations that no longer exist.

## It answers

What materially changed in the project, and when?

## What belongs here

Material project-level changes: scope added or removed, features added or substantially changed,
prototype findings taken into the definition, major implementation milestones, significant defects
that affected product behaviour, releases and deployments, lifecycle changes, major owner
feedback taken in, and significant changes to the plan. The test is whether understanding the
change would help someone understand how the project got here.

## What does not belong here

- Every commit, edit or formatting change; git has those.
- Routine refactors with no project-level effect.
- Every working session.
- The reasoning behind a decision; that is `DECISIONS.md`, referenced here rather than restated.
- A backlog, a status report or a session log.

## When to update

When a material project change occurs. Not mechanically after every session; many sessions produce
no entry, and several related changes may be one entry. New entries go at the top.

This file was created on 2026-09-12 for a project with 247 commits behind it. The entries below
are the phase-level events that the commit history and `NEXT.md` make unambiguous, each with the
commit that carries it. Finer history before and between them is in git and, for the
measurements, in `FINDINGS.md`. Nothing here was reconstructed from inference.

## Relationship to other files

`STATUS.md` says what is true now. `NEXT.md` says where we stopped and what happens next.
`DECISIONS.md` says what we decided and why. This file says what materially changed and when. Git
says exactly what changed in the files and the code.

---

## Changes

### 2026-09-28 — The fitted discard policy inside the Coach, the Play review's win rule, friends' records

**Changed:** Inside every cheap plan the Coach's tile now comes from a policy fitted to 442,474
graded discards; on a colour or thirteen-orphans plan the Coach's own tile stands (`D-035`). The Play
review answers a win on offer by the rule both ways. Table setup gains "Send my record" (the phone's
share sheet) and a Friends' records card that reads a sent file in under a name, kept apart from
your own record (`A-007`). The training plan is brought up to date.

**Why:** Measured at Changs's table over two samples a field: +0.386 chips a game against three
Coaches and +0.759 against the recorded players. The review had let a declined win be called best.
Nothing left a phone before.

**Impact:** Every money figure from this date is against the new Coach. Ten passes in `MISTAKES.md`.

### 2026-10-02 — The last pack judged by the Coach; the grader takes a time budget

**Changed:** the `coach` pack (4 Jokers, min 2; 10,547 questions) carries the Coach's answers, 535
best answers moved; every pack on the site is now Coach-judged. `evaluate.ts --budget <seconds>`
stops each worker after its current decision and writes the manifest, for runs given a time rather
than a count.

**Why:** `D-037`; and the new packs' chain used `timeout`, which macOS lacks, so its grading step
ended at once and two empty packs were "merged" (2.3 hours lost, caught at 15:06).

**Impact:** Ten passes in `MISTAKES.md`; mistake `M-004` recorded.

### 2026-10-01 — The table counted once

**Changed:** the Coach, the bots and every screen count a claimed discard once (in the set, not the
pool), count the tile on offer once, and never wrap the unseen count. One builder each for a player's
view (`visibleOf`) and a pack question (`visibleOfQuestion`); three tests. `policymoney.ts --old
<path>` measures the Coach against the Coach from another checkout.

**Why:** "256 of them live" on screen. Over half the questions in each pack had a kind over-counted.

**Impact:** Ten passes in `MISTAKES.md`. Measured at the noise floor for money and for verdicts, so
the packs are not judged again. The `coach` pack's re-judging, running under the old code, finishes
as it is.

### 2026-10-01 — The two min-1 packs judged by the Coach

**Changed:** `min1-nowild` (10,291 questions) and `min1` (10,528) carry the Coach's answers; 576 and
601 best answers moved.

**Why:** `D-037`.

**Impact:** Ten passes in `MISTAKES.md`; pass 10 found a wrong number in the Coach's reason text
("256 of them live"), traced to claimed discards counted twice; the fix follows separately.

### 2026-09-30 — 615 strong-table questions judged again at 512 play-outs

**Changed:** the 615 questions whose old clear-mistake verdict fell inside the noise at 256 carry
answers from 512 Coach play-outs on a fresh seed; 103 best answers moved against the 256 run.
`coachpack.ts` takes `--ids` and `--seed`; a pack index's `rollouts` is the fewest any question has.

**Why:** Changs asked whether those 615 were the Coach's doing or the halved play-outs'. About half
each; the counts are in `FINDINGS.md`.

**Impact:** Ten passes in `MISTAKES.md`.

### 2026-09-30 — The whole strong-table pack judged by the Coach

**Changed:** all 10,751 questions carry the Coach's answers and the pack's index says `judge:
'coach'`; 474 best answers moved.

**Why:** `D-037`.

**Impact:** Ten passes in `MISTAKES.md`. The other three packs are being re-judged in a chain.

### 2026-09-29 — Half the strong-table pack judged by the Coach, on the site

**Changed:** 4,931 of the strong-table pack's 10,751 questions now carry the Coach's answers; 221
best answers moved. The rest are unchanged and still say they rest on simple bots.

**Why:** `D-037`. Changs asked for the judged half tonight rather than the whole pack tomorrow.

**Impact:** Ten passes in `MISTAKES.md`. The rest of the pack follows when the run finishes.

### 2026-09-29 — A verdict says what the play-outs did

**Changed:** Under a Train verdict, one line says what happened after the best action and one after
yours: how often the hand was won and at what size, drawn, dealt in, or paid. Read from each action's
stored outcome mix, so nothing new is computed.

**Why:** Changs called a sound verdict rubbish because the Coach's words explained nothing: the money
was in the hand size, and only the play-outs could say so.

**Impact:** Ten passes in `MISTAKES.md`.

### 2026-09-28 — No answer from simple bots: the Coach in every chair of the play-outs

**Changed:** The Challenge button and the Play tab's review run their play-outs with the Coach in
all four chairs. Each Train question says which judge its bars rest on. The Play judge compares the
thrown tile with the Coach's two favourites at 128 play-outs each, because the Coach is slow from an
early position, and says so. The packs are being re-judged the same way, the strong-table pack
first (`datagen/src/coachpack.ts`).

**Why:** Changs disputed a "big mistake" that the Coach-played judge did not uphold, and ruled that
no answer may rest on play-outs finished by simple bots (`D-037`).

**Impact:** Ten passes in `MISTAKES.md`. Until a pack is re-judged its questions say so.

### 2026-09-28 — The strong-table pack regenerated with the new Coach

**Changed:** The fourth pack is now cut from 150,000 hands played by the Coach that carries the
fitted discard policy: 10,751 questions in 108 shards, every one of its 1,246 win offers marked. The
builder's top index carries who played the hands, so a rebuild keeps the label.

**Why:** The first strong pack was played by the Coach as it was; the fifth item of `D-034`.

**Impact:** Ten passes in `MISTAKES.md`. The first strong pack stays on disk as a record.

### 2026-09-28 — The fitted claim model decides the call

**Changed:** After a win is taken, Pong, Chow, Kong or pass comes from the fitted claim model,
inside `claimAdvice`, so the Coach that plays and the advice on Your hand are one; the Coach's
gains and reasons stay as the explanation and Your hand says when they would have gone the other
way. A Kong is ranked with the rest instead of taken on sight.

**Why:** Two samples of 8,000 paired deals a field at Changs's table: pooled +0.249 +/- 0.092 chips a
game against three Coaches and +0.218 +/- 0.094 against the recorded players (`D-036`).

**Impact:** The Coach's call changes on 28.8% of the 0-Joker pack's claim questions. Every money
figure from this date is against the Coach with both models inside it. Ten passes in `MISTAKES.md`.

### 2026-09-28 — A session on the Play tab

**Changed:** Hands in a row at your table: the dealer keeps the deal after a win or a draw and passes
it otherwise, the wind turns after four passes, chips carry across, and "End the session" opens a
summary that leads with the judged decisions costliest first. A reload keeps the session; a new day
does not.

**Why:** `PLAN.md` Phase 7, held until the review could be trusted on calls and wins; both were
measured, and Changs asked for the rest of the game (`D-034`).

**Impact:** Ten passes in `MISTAKES.md`. Whether a session is what he opens daily is his to say.

### 2026-09-27 — The three packs rebuilt with the win rule, and the strong-table pack built

**Changed:** `coach`, `min1` and `min1-nowild` rebuilt from their graded runs with the 512-play-out
verify: 10,547, 10,528 and 10,291 questions, every one that offers a win marked `rule: 'win'` (2,030,
2,332 and 1,030). A self-draw win question is now headed "Win, or play on?" with the choice "Play on"
instead of "No kong". The builder counts rule overrides apart from play-out changes. A fourth pack of
positions from Coach-played hands at the 0-Joker table is built (10,652 questions) and, at Changs's
word, on the site as "0 Jokers, min 1 Tai, strong table"; the pack index carries who played the hands.

**Why:** The rule was in the builder and on the screen since 2026-09-26, but the packs on the site
were built before it and still answered "decline" on 2,099 questions.

**Impact:** `D-033` carried out. Ten passes in `MISTAKES.md`. Strong-table pack findings in
`PROTOTYPE.md`.

### 2026-09-26 — The Coach line on Train shows the Coach that actually plays

**Changed:** For claim questions the Train screen took a win before ranking anything, as the Coach
bot does. The action row and the Challenge label wrap, so the button no longer runs off a 280px
screen. The shard walk skips cached empty shards inside one run instead of one state write each.

**Why:** The screen ran `claimRank`, the learned model, and called it the Coach. Over the 595 claim
questions in the 0-Joker pack that offer a win, that model declines 278; the Coach declines 0.

**Impact:** `Q-013` resolved, and it was a display fault, not a fault in the Coach, so the money
tests behind `D-032` and `D-033` are unaffected. Ten passes recorded in `MISTAKES.md` with three
defects found and fixed. `M-002` and `M-003` added to the register.

### 2026-09-26 — A win on offer is answered by a rule, in the pack data

**Changed:** The pack builder marks every question that offers a win with `rule: 'win'` and stores
the win as the answer, keeping it through the verify pass. The Train screen marks taking the win
right and passing a mistake, charges nothing to "Given up", and leaves the money bars and Challenge
off, saying in a paragraph why.

**Why:** Following the play-outs on these costs 0.22 to 0.46 chips a game against strong players over
48,000 paired deals, and no judge this project has beats the plain rule at that table. Changs asked
for the pack files to be fixed rather than overridden in the app.

**Impact:** `D-033`. `Q-013` opened. Ten passes recorded in `MISTAKES.md`, with two defects found and
fixed: a shard with nothing for the current filters spun for ever and blanked the Train screen, and
the Coach line claimed "the measurement" on a question the rule answers. The three shipped packs are
not rebuilt yet, so the site still carries the old win answers.

### 2026-09-17 — The Coach reads no-Joker danger at a no-Joker table

**Changed:** At 0 Jokers every Coach in the app reads danger from the table measured without Jokers.

**Why:** Worth +0.215 chips a game at that table over 32,000 paired deals; Changs's table has no Jokers.

**Impact:** `D-030`. `R-002` resolved. Ten passes recorded in `MISTAKES.md`.

### 2026-09-16 — Claims name their choices, and the pack buttons lose their count and "$"

**Changed:** A claim question names the choices on offer, "Pong or pass?", "Chow or pass?", or all of
them when there are several, on Train, in the Film room and in Play. The pack buttons show only the
table, without the question count and the "$".

**Why:** Changs asked for both; he called the count and "$" pointless.

**Impact:** Ten passes for each recorded in `MISTAKES.md`.

### 2026-09-16 — The Coach reasons at the table in play, and Table setup starts at 0 Jokers, min 1

**Changed:** Table setup defaults to 0 Jokers and min 1. The Coach's reasoning uses the pack's own
minimum on Train and Review, and the Table setup minimum elsewhere. The table-mismatch note under the
pack buttons is gone. On phones the dealer badge sits under the wind in the table's corners. Review's
top row wraps on narrow phones.

**Why:** Changs found the Coach saying a min-1 hand still needed another Tai, and asked for the rest.

**Impact:** `D-029`. `US-020` built. Ten passes recorded in `MISTAKES.md`.

### 2026-09-16 — Harder questions by default, and a green table

**Changed:** Train has a "hard only" filter, on by default, and opens on the 0-joker min-1 pack. The
cause line moved to after the answer, the seat and wind details moved into the question card, and a
one-line status message was removed. The square table is green felt with a pale discard box, and the
left seat's name is no longer upside down.

**Why:** Changs said some questions were too easy and asked for each of the rest.

**Impact:** `D-028`. `A-005` open on what counts as hard. Ten passes recorded in `MISTAKES.md`.

### 2026-09-13 — The claim judge measured, and the review stops second-guessing a win

**Changed:** The Play tab's review no longer marks taking a win as a mistake; the verdict reads
"Not judged" and gives the reason, and the session tally ignores it. The warning above the review
now says what is actually known. Two measurement tools are added to `datagen/`, `winprice.ts` and
`declinewin.ts`.

**Why:** The warning that stood there claimed the judge under-prices a call because the play-out
bots never fold. That came from one played hand. Measured over 50 recorded win offers, neither the
rollout opponents nor the guessed hidden tiles move the number, so the stated cause is wrong - but
the judge is wrong anyway, because a coach that declines cheap wins loses 0.229 chips a game at two
*Tai* and 0.944 at three, over 8,000 paired deals against both fields.

**Impact:** `D-027` recorded. `R-001` rewritten and narrowed to what is measured. The `FINDINGS.md`
entry replaced. Nothing about *Pong* and *Chow* is settled, and the record now says so rather than
generalising from a single hand.

### 2026-09-12 — The project pack is introduced, and the prototype folder is made active

**Changed:**

- The canonical files from `P-Starter.md` are created. `PLAN.md` is replaced by the P-Starter plan;
  the app's original roadmap is preserved as received at `INPUTS/PLAN-original-2026-09-12.md`,
  and the previous `NEXT.md` at `INPUTS/NEXT-original-2026-09-12.md`.
- `prototype/` is seeded as a runnable snapshot of the current build, with its lifecycle state
  `ACTIVE`, against Part 6 of the recipe, by the owner's decision.
- The lifecycle phase is recorded as LIVE, the owner having said the project has passed BASELINE.

**Reason / Source:**

The owner asked for the project to be set up under the P-Starter recipe. The prototype decision is
D-025 and the tension with the recipe is C-001.

**Affected:**

- Every canonical file; `prototype/`; `INPUTS/`.

**Related:**

- D-025, C-001, `PROJECT.md`.

### 2026-09-12 — The Play tab: one whole hand, judged decision by decision

**Changed:**

- A Play tab deals one hand at the owner's table, sits the book coach in the other three chairs,
  and afterwards lets each decision be judged on fresh play-outs against the measured best. One
  hand only; no sessions, rotation or running score. Labelled a prototype. Commit `636a7a3`.
- The screen says where the judge is not to be trusted: on taking a win or making a call.

**Reason / Source:**

The direction recorded on 2026-09-06 (D-021). The judge's bias on claims was measured on the first
played hand and is R-001.

**Affected:**

- `web/src/components/Play.tsx`, `web/src/lib/play.ts`, `web/src/lib/rejudge.ts`.

**Related:**

- D-021, R-001, Q-001.

### 2026-09-11 — Every pack question verified twice, and the phone pass complete

**Changed:**

- `quizpack.ts --verify 512` re-judges every admitted question on fresh play-outs; about a fifth
  were dropped, and the packs were rebuilt admitting 12,800 so they hold about ten thousand each.
  Every earlier question id survives. Commits `4c89cc1` and `7287349`.
- The phone pass, all four items: the bottom bar with 48px targets and safe areas, the square
  table kept at a 22px tile, an update bar after every deploy, on-demand tabs precached by the
  worker, and the Challenge button running in a Web Worker on the device. Commit `2caa444`.
- The framework's mistake types and drill order redrafted from the findings, with a Sources list.
  Commit `130fb92`.

**Reason / Source:**

The verification followed the owner's disputed verdict of 2026-09-10 and the measurement of the
winner's curse (D-009). The phone pass was decided on 2026-09-07 (D-017, D-018, D-019).

**Affected:**

- The three packs; `web/`; `solver/src/rejudge.ts` and `question.ts`; `Framework - Mahjong.md`.

**Related:**

- D-009, D-017, D-018, D-019, Q-002, Q-003, Q-004, Q-005.

### 2026-09-10 — The site goes live, the packs are rebuilt and sharded, and the two practice tabs become one

**Changed:**

- The app is deployed to GitHub Pages at `https://szethochangs.github.io/Mahjong/`, building on
  every push. Paths go through `web/src/lib/asset.ts` so the build works under a project folder.
  Commit `df20e76`, after a single-file build the same day (`dd3e547`) that is now superseded.
- Train and Real quiz are merged into one Train tab judged by the play-outs, with the Coach as a
  labelled fallback. Three bugs found by driving it are fixed in the same commit. Commit `880eb5b`.
- The three packs are rebuilt with `--mix decisive` at about ten thousand questions each
  (`ab5e24f`), the `money` and `nowild` packs are retired from the site (`c7b8f67`), and the packs
  are sharded with the cause label baked in at build time (`8946d51`).
- The installed app opened at the account root, which has no site; fixed by making the manifest's
  paths relative. Found by the owner on his phone. Commit `614a965`.
- The icon becomes the green dragon on maroon (`b097a1c`), and the hand log arrives on the Review
  tab.

**Reason / Source:**

D-020 (Pages), D-012 (the merge, at the owner's request), D-008 and D-010 (the packs), D-015 (the
shards), D-023 (the icon).

**Affected:**

- `.github/workflows/pages.yml`; `web/`; the packs under `web/public/quiz/`; `solver/src/pack.ts`.

**Related:**

- D-008, D-010, D-012, D-015, D-020, D-023, C-002.

### 2026-09-07 — Installable and offline, and the phone layout decided

**Changed:**

- A manifest, icons and a hand-written service worker; the shell, bundle and tile faces
  precached, packs cached on use. Verified by reloading with the server stopped. Commit `804a911`.
- The phone pass written up in `MOBILE.md`: the measurements at 360px, the bottom bar and the
  square table settled on a mockup, and the sharding design. Commits `d746e6d` and `a236654`.

**Reason / Source:**

The owner asked on 2026-09-06 for the app on a phone. D-015, D-016, D-017, D-018, D-019.

**Affected:**

- `web/public/`; `MOBILE.md`.

**Related:**

- RS-008.

### 2026-09-06 — The owner's other tables measured, the framework written, and the coach's programme closed

**Changed:**

- The four-corner comparison, jokers on or off at minimum 1 and 2, on paired deals. The wildcard
  rule dominates; the Tips page and the framework now say which table every verdict was measured
  at; a no-wildcard pack is built. Commits `6fa2c4e`, `a048e53`, `c507be4` and the `wild:` series;
  `TABLE-VARIANTS.md` created.
- `Framework - Mahjong.md` is created: the plan this project exists to produce. Commits `9f6beb0`
  and `f277c12`.
- The committed value table is baked and, the same day, reverted to the row-scaled table after it
  lost against the personality field; the value-table programme is closed at its ceiling. The
  danger side is closed on both fields.
- Every playbook card has a verdict; the playbook is done.
- Game terms are italicised and coloured by kind; *Ting Pai* is adopted. The training record can
  be saved and restored. Every mistake carries a cause, and the play-outs feed the mistake record.

**Reason / Source:**

D-005, D-006, D-011, D-013, D-014, D-022. The measurements are the entries dated 2026-09-06 in
`FINDINGS.md`.

**Affected:**

- `solver/src/tables.ts`; `knowledge/sources/fitted/`; the Tips page; `web/`; the framework.

**Related:**

- RS-001, RS-007, Q-011, R-002.

### 2026-09-02 to 2026-09-05 — The whole playbook on the page, measured, and the trainer's five parts in place

**Changed:**

- Mistakes come back on a schedule (2026-09-02). The Shapes tab becomes the Tips page and carries
  all 102 rules (2026-09-03). The Spot drill, the fifth component, is added (2026-09-04). The
  second change ever to the coach, one constant per value-table row, ships (2026-09-04).
- The tips are scored against the play-outs on both packs, the calling and discard rules against a
  baseline that knows what each throw is, and the reads by replay on two populations (2026-09-03
  to 2026-09-05). Four published verdicts were corrected when the baseline was fixed.
- The learned model's opinion is dropped from the app; the dataset is regenerated from coach-played
  hands; the quiz and film room are rebuilt from it (2026-09-02, 2026-09-03).

**Reason / Source:**

D-004, D-006, D-013, D-014. `FINDINGS.md`, entries dated 2026-09-02 to 2026-09-05.

**Affected:**

- `web/`; `solver/src/tips.ts` and `shapetag.ts`; `datagen/src/tiptest.ts`, `calltest.ts`,
  `discardtest.ts`, `tells.ts`; the packs.

**Related:**

- RS-001, RS-004.

### 2026-09-01 — The first change to the coach, and the book's benchmark shown to be a different game

**Changed:**

- The legal-wait rule ships: a winning tile that leaves the hand under the minimum does not count.
  Measured at +0.048 then, and at +0.018 on fresh deals the next day.
- The study's benchmark of 23% wins, 14% draws and 48 turns is shown to describe a game without
  wildcards; on its own game the coach walks the numbers toward the book monotonically.
- The engine plays bao as the table actually does, and the table's tai values are the owner's.

**Reason / Source:**

D-007. `FINDINGS.md`, "The first idea from the tactics book" and "The book's benchmark was never our
game".

**Affected:**

- `solver/src/rank.ts`; `engine/`; `data/table.config.json`.

**Related:**

- D-001, D-003, Q-008.

### 2026-08-29 to 2026-08-30 — The harness deals the real table, four candidates lose, and the coach stands

**Changed:**

- The money harness was dealing no wildcards while the bots it compared were tuned with them; fixed,
  and the model's loss re-measured at 0.54 chips a game rather than 2.66.
- Four candidates played for money: the discard model, the claim model, both together, and two
  strategy rules. None won. The machine-learning programme is closed. Defending harder loses
  monotonically; the fold question is closed; the danger weight stays at 40.
- Ten gigabytes of dead runs removed; `NEXT.md` created; the Your hand tab can ask about a thrown
  tile.

**Reason / Source:**

D-004, D-005. `FINDINGS.md`, "The table plays with wildcards and the code was not dealing them",
"Four things played for money", "How much to defend".

**Affected:**

- `solver/src/tools/headtohead.ts`; `solver/`; `web/`.

**Related:**

- D-003, R-004.

### 2026-08-23 to 2026-08-25 — The project begins

**Changed:**

- The engine, the knowledge base merged from the two books, the tile assets and the plan
  (`9a04a9b`, 2026-08-23). The solver, the web trainer, and the data generator with its
  evaluator the same day and the next. The owner's money rules and table confirmed and captured
  in `data/table.config.json` (2026-08-24).
- The 100,000-hand milestone run verified; the paired standard error found to be too small by a
  factor of the square root of the play-outs and fixed (2026-08-25).

**Reason / Source:**

The original plan, now at `INPUTS/PLAN-original-2026-09-12.md`. D-001, D-024.

**Affected:**

- Everything.

**Related:**

- RS-002, RS-003.
