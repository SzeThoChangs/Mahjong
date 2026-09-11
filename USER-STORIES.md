# USER STORIES

## Purpose of this file

This file translates supported product behaviour into coherent, buildable, testable slices.

## It answers

*What do we need to build?*

## What belongs here

Stories for behaviour the project actually supports, each with a stable identifier (`US-001`),
never renumbered. Acceptance criteria describe observable behaviour. Every rule gets at least one
example with real values. Each story says what it is not, and what evidence would prove it, before
the work starts.

## What does not belong here

Rules go in `SPEC.md`. Capabilities go in `FEATURES.md`. Processes go in `WORKFLOWS.md`. Delivery
sequencing goes in `PLAN.md`. Unknown behaviour goes in `OPEN-ITEMS.md`. Do not create stories to
fill a backlog.

## Status discipline

"Code written" is not "verified". A story is VERIFIED only when there is evidence for its acceptance
criteria and the story can say what the evidence was. This project was bootstrapped over a live app,
so most stories below are BUILT from the code and only three are VERIFIED, each naming its evidence
in `FINDINGS.md`. Where a story's behaviour was never stated as intent but exists in the code, the
story records it as OBSERVED and is still BUILT; accepting it as intended is a separate act.

## When to update

When a story is added, refined, split, completed, verified or dropped; when acceptance criteria
change; when a dependency or blocker changes.

## Relationship to other files

Each story points to its feature, workflow and journey, and to the spec rules that govern it.
`PLAN.md` sequences the work; this file defines it. `SPEC.md` owns the rules; this file owns the
examples.

---

## Story Index

| ID | Story | Feature | Status |
|---|---|---|---|
| US-001 | A mistake comes back bare, on the schedule | F-006 | BUILT |
| US-002 | Spot a position and be told which kind of seeing is weak | F-005 | BUILT |
| US-003 | Answer a measured discard and see what it cost | F-001 | BUILT |
| US-004 | Challenge a verdict on the device | F-004 | VERIFIED |
| US-005 | Aim the Train tab at the Cause that keeps coming up | F-002 | BUILT |
| US-006 | Sort a mistake by Cause and read the diagnosis | F-007 | BUILT |
| US-007 | Read every card with a badge saying what backs it | F-009 | BUILT |
| US-008 | Reopen a hand I played with the answer shown | F-008 | BUILT |
| US-009 | Ask what to throw from the hand I am holding | F-010 | BUILT |
| US-010 | Scrub a recorded hand and see what each move was worth | F-011 | BUILT |
| US-011 | A made-up hand is never mistaken for a measured one | F-003 | BUILT |
| US-012 | Set my table's money and see what it rewards | F-012 | BUILT |
| US-013 | Save my record to a file and restore it | F-013 | BUILT |
| US-014 | Install on my phone, work offline, and take updates | F-015 | BUILT |
| US-015 | Play one hand and judge each decision | F-014 | BUILT |
| US-016 | Answer a claim question and see why | F-001 | BUILT |
| US-017 | A claim judge the whole-hand review can trust | F-017 | PROPOSED |
| US-018 | Send my record to Changs with one press | F-018 | PROPOSED |
| US-019 | Every pack question verified on fresh play-outs | F-016 | VERIFIED |
| US-020 | The app knows which table I am playing | F-012 | IN PROGRESS |

---

## US-001 — A mistake comes back bare, on the schedule

**Story:**

As Changs,
I want each mistake to come back after a day, three days, a week, two weeks and a month, showing
the position and nothing else,
so that I redo the thinking rather than recognise the answer.

**Acceptance Criteria:**

- A card is due at the interval for its step and not before (BR-01).
- A due card shows the table and the hand and asks which tile; the old throw, the judge's tile and
  the old verdict are not on screen until I answer (BR-02).
- Right moves the card one step; wrong sends it to step 0; right at the last step finishes it.
- The result names the judge and says which kind of judge it is (BR-03).

**Examples:**

- A mistake made on Tuesday at 21:00 is due on Wednesday at 21:00. Got right, it is next due three
  days later, on Saturday. Got wrong on Saturday, it is due again on Sunday.
- A card at step 4 (the month) got right shows "back no more — this one is finished".
- A pack card shows "Judged by the play-outs, which is the honest grader here"; a fallback card shows
  "Judged by the coach, which is right about half the time on positions like this".

**Not this story:**

- Sorting the Cause (US-006). Cards that cannot be rebuilt are covered by the exception in WF-001.

**Done when:**

A card recorded at a known time is absent from "Due now" before its interval and present after, with
nothing but the position on screen; one right and one wrong answer move it as stated. Checkable in a
browser with the clock advanced or with `mj.mistakes.v1` edited by hand.

**Related Feature:** F-006.

**Related Workflow:** WF-001.

**Related Journey:** UJ-002.

**Relevant Specification / Rules:** FR-10, FR-11, BR-01, BR-02, BR-03, BR-06.

**Dependencies:** US-003 or US-011 to produce a card.

**Status:** BUILT (OBSERVED, `mistakes.ts`, `Review.tsx`). Not verified against the clock.

---

## US-002 — Spot a position and be told which kind of seeing is weak

**Story:**

As Changs,
I want a position shown briefly and then one question about it, scored per question kind, with my
misses sorted by why,
so that I know which of the four kinds of seeing is worst and whether to change the look.

**Acceptance Criteria:**

- The look is 3, 5 or 8 seconds and both the table and the hand go face down before the question.
- Four question kinds, each scored separately (FR-08, FR-09).
- A miss can be sorted into four seeing causes and the tally is kept per question kind.
- A look change is suggested only under BR-08.

**Examples:**

- Six sorted misses of which three are "ran out of time" at a 5-second look: the box offers "Move
  the look to 8s". Two of six: no offer.
- Ten sorted misses, none about time, at 8 seconds: the box offers "Move the look to 5s". At 3
  seconds there is nothing shorter and no offer.
- The score line reads "your own hand: 60% of 5 · what you are building: — · reading the table: 100%
  of 2 · naming the shape: 0% of 1".

**Not this story:**

- Choosing which positions are in `spot.json`; that is the pack builder's.

**Done when:**

The offers appear at exactly the thresholds above when `mj.spotcause.v1` is set to those counts, and
the score line updates per kind.

**Related Feature:** F-005.

**Related Workflow:** WF-002.

**Related Journey:** UJ-002.

**Relevant Specification / Rules:** FR-08, FR-09, BR-08.

**Dependencies:** None.

**Status:** BUILT (OBSERVED). The CONFLICT on the starting look is recorded under WF-002.

---

## US-003 — Answer a measured discard and see what it cost

**Story:**

As Changs or a friend,
I want a real recorded position, a tap, and a verdict in money against the measured best with the
reasons beside it,
so that I am graded by play-outs and still told why.

**Acceptance Criteria:**

- The verdict follows BR-04 and shows what my tile and the best were worth and the difference.
- The Coach's own pick is shown with whether the measurement agrees, so the two judges are visible
  side by side (BR-03).
- A Mistake or Big mistake on a discard writes a card; every discard writes a log entry; the record
  never gets two cards for one position (BR-05, BR-06).
- The pack and question id are on the verdict screen.

**Examples:**

- On the `coach` pack, question `6310:4:31`, throwing 1筒 when the pack's best is 9條 at $5.47
  against $1.44 shows "Big mistake", "you gave up $4.03", and the id `coach · 6310:4:31` at the foot.
  (This is the position Changs disputed; see US-004.)
- A regret of $0.20 on a position whose error bar is $0.30 shows "Too close to call" and the line
  about the play-outs resolving a gap of about $0.30.
- Throwing the best tile shows "Best move" and "Measured best: worth $5.47 per hand".

**Not this story:**

- Claims (US-016). The fallback (US-011). Challenging (US-004).

**Done when:**

For a known question the three outcomes above show the stated words, and `mj.mistakes.v1` and
`mj.history.v1` gain the stated entries once each.

**Related Feature:** F-001.

**Related Workflow:** WF-003.

**Related Journey:** UJ-002.

**Relevant Specification / Rules:** FR-01, FR-02, FR-04, FR-05, BR-03, BR-04, BR-05, BR-06.

**Dependencies:** US-019 for the packs.

**Status:** BUILT (OBSERVED). The merge commit `880eb5b` records three bugs found by driving it and
fixed.

---

## US-004 — Challenge a verdict on the device

**Story:**

As Changs,
I want to re-judge a verdict I doubt on fresh play-outs, on the phone, with no server,
so that a "big mistake" that was really a coin flip does not stand.

**Acceptance Criteria:**

- The pick, the reference and the runner-up are each played out 512 times on a new seed (BR-09).
- The outcome is holds, too close to call, or reversed at two standard errors.
- A charge that does not hold moves the session tally to "too close to call" and notes the card and
  the log entry; the card stays in the schedule.
- The position is rebuilt from the question alone and offers exactly the actions the pack judged.

**Examples:**

- Throwing 1筒 on `coach · 6310:4:31`, charged $4.03, challenged: 9條 +3.92, 4筒 +3.78, 1筒 +3.64 at
  2,048 play-outs on the Mac; on the phone at 512 the words are "Too close to call: the fresh gap is
  $0.28, inside the noise of ±…" and the tally's blunder count drops by one.
- A pick that was the pack's best, challenged, compares against the runner-up and says "Holds: on
  fresh play-outs your discard … is still $x better than the runner-up".

**Not this story:**

- Re-judging on the Mac at 2,048 play-outs; that is `challenge.ts`, outside the app.

**Done when:**

`rejudgecheck.ts` shows the rebuilt position gives identical play-outs to the recorded one, and a
challenge on a phone returns an outcome within a few seconds.

**Related Feature:** F-004.

**Related Workflow:** WF-005.

**Related Journey:** UJ-004.

**Relevant Specification / Rules:** FR-07, BR-07, BR-09.

**Dependencies:** US-019 (questions carry the whole table from 2026-09-06).

**Status:** VERIFIED. Evidence: `FINDINGS.md`, "The Challenge button runs on the phone, from the
question alone" (2026-09-11): 100 of 100 questions identical on canonical deals; best agrees 30 of
30 on wall-order deals with the gap differing by play-out noise; 1.0 s from press to answer on the
Mac. The phone timing is inferred from the Mac's, not measured (ASSUMED).

---

## US-005 — Aim the Train tab at the Cause that keeps coming up

**Story:**

As Changs,
I want one press on the diagnosis to make Train serve only positions where a real player's throw
failed for my leading Cause,
so that the practice is pointed at what is actually broken.

**Acceptance Criteria:**

- The Practise button appears when the leading Cause is one of the four the packs carry (FR-13).
- Train opens with that Cause selected and every question served carries it.
- The choice survives a reload and is cleared by "anything".
- In claim mode the strip is hidden and the filter is not applied (FR-03).

**Examples:**

- Leading Cause "Misjudged the safety" with 7 cards: the button reads "Practise "Misjudged the
  safety" on the Train tab"; Train then shows "the throw actually made here was: Misjudged the
  safety" under each question.
- Leading Cause "Knew, and threw something else": no button, because the packs cannot serve it.

**Not this story:**

- What to do when the leading Cause is unservable (UNRESOLVED, WF-004).

**Done when:**

With `mj.mistakes.v1` holding cards of a servable Cause, the button lands on Train with the filter
set and every served question's `c` equals that Cause.

**Related Feature:** F-002.

**Related Workflow:** WF-004.

**Related Journey:** UJ-002.

**Relevant Specification / Rules:** FR-03, FR-13, BR-12.

**Dependencies:** US-006, US-019.

**Status:** BUILT (OBSERVED).

---

## US-006 — Sort a mistake by Cause and read the diagnosis

**Story:**

As Changs,
I want to say why each mistake happened, from eight Causes, and see the tally with the one that
keeps coming up,
so that I know what to practise instead of practising in general.

**Acceptance Criteria:**

- The eight Causes are offered on a card at review, and on a fallback hand at the moment of the
  mistake with a suggestion marked (FR-11).
- The diagnosis shows the tally by Cause, names the leader, and splits play-out from Coach cards
  (FR-12).
- The leading Spot cause appears with a one-line prescription.

**Examples:**

- Five cards sorted "Miscounted", two "Did not see it", three unsorted: badges "Miscounted · 5",
  "not sorted yet · 3", "Did not see it · 2", and the line "The one that keeps coming up is
  "Miscounted"".
- Three play-out cards and one Coach card: "3 of these were judged by the play-outs and 1 by the
  coach".
- Spot: "the miss that keeps coming up is Ran out of time, 4 of 6 sorted. Give yourself a longer look
  until that stops".

**Not this story:**

- Suggesting a Cause on a pack question at the moment of the mistake; not built, and a CONFLICT with
  the framework recorded under WF-003.

**Done when:**

The tally and lines above render from a hand-written `mj.mistakes.v1` and `mj.spotcause.v1`.

**Related Feature:** F-007.

**Related Workflow:** WF-001, WF-006.

**Related Journey:** UJ-002.

**Relevant Specification / Rules:** FR-11, FR-12.

**Dependencies:** US-001.

**Status:** BUILT (OBSERVED).

---

## US-007 — Read every card with a badge saying what backs it

**Story:**

As Changs,
I want every rule in the playbook as a card with a badge saying whether it is measured, counted, a
table rule, advice, or contradicted, and a line saying which table it was measured at,
so that I do not learn the eighteen false ones.

**Acceptance Criteria:**

- 103 cards in seven phases; every number on a card is computed from its hand at load (FR-15).
- The badges and their counts appear in the opening line (FR-16).
- The table line names four Jokers and a 2 Tai minimum and what changes without Jokers.

**Examples:**

- The opening line reads "Of 103 cards, 4 are settled exactly by counting the tiles on the card, 59
  were measured on played hands, 18 came out against the book, 6 are rules of this table …, 16 are
  about how to play …, and 0 are untested".
- `four_tile_ranking` carries the red badge "Not true here".

**Not this story:**

- Labelling per card which verdicts differ between tables; `TABLE-VARIANTS.md` task 9, not done.

**Done when:**

`test/tips.test.ts` passes and the counts on the page match the verdicts in `solver/src`.

**Related Feature:** F-009.

**Related Workflow:** WF-008.

**Related Journey:** UJ-002, UJ-003.

**Relevant Specification / Rules:** FR-15, FR-16, FR-27.

**Dependencies:** None.

**Status:** BUILT (OBSERVED; the verdict counts were checked in `solver/src` on 2026-09-12).

---

## US-008 — Reopen a hand I played with the answer shown

**Story:**

As a friend testing,
I want a list of the hands I have answered, and to open one and see the answer and why,
so that I can understand a hand without being tested on it again.

**Acceptance Criteria:**

- The last 200 answered discards, newest first, with verdict, tile thrown, best, when and judge
  (FR-14).
- Opening one shows the answer and both tiles' reasons at once; nothing on the schedule moves.

**Examples:**

- An entry "ok · 5萬 · earlier today · play-outs" opens to "You threw 5萬, and that was right."
- An entry "blunder · 1筒 not 9條 · yesterday · play-outs" opens to "You threw 1筒. The play-outs
  threw 9條." with "Why 9條" and "Why not 1筒" lines.

**Not this story:**

- Claims; they are not logged (BR-05).

**Done when:**

201 answered discards leave 200 in `mj.history.v1`, and opening any entry shows the lines above with
no change to `mj.mistakes.v1`.

**Related Feature:** F-008.

**Related Workflow:** WF-007.

**Related Journey:** UJ-006.

**Relevant Specification / Rules:** FR-14, BR-05.

**Dependencies:** US-003.

**Status:** BUILT (OBSERVED).

---

## US-009 — Ask what to throw from the hand I am holding

**Story:**

As Changs,
I want to tap in the hand I am actually holding, with what is face up on the table, and get the
Coach's throw and reasons, or claim-or-pass on a thrown tile,
so that the app helps at a real table.

**Acceptance Criteria:**

- The answer appears only at fourteen tiles counting three per set, and the header says how far off
  I am (FR-17).
- A thrown tile with thirteen in hand gives take it or pass, with a Chow offered only from the player
  before me.
- Seat, round, turn and meld counts are remembered; the tiles are not.

**Examples:**

- Eleven tiles and one Pong: "14/14 tiles", and "Throw 9萬" with the plan and reasons.
- Thirteen tiles, thrown tile 5筒 from the player before me, holding 4筒 6筒: options Pass and Chow
  4筒 6筒 with the gain in chips beside the Chow.
- Thirteen tiles, thrown tile 中 with one 中 in hand: "You cannot claim it".

**Not this story:**

- A measured verdict; this tab is Coach-only.

**Done when:**

The three examples produce the stated screens.

**Related Feature:** F-010.

**Related Workflow:** WF-009.

**Related Journey:** UJ-005.

**Relevant Specification / Rules:** FR-17; the validations in `SPEC.md`.

**Dependencies:** None.

**Status:** BUILT (OBSERVED).

---

## US-010 — Scrub a recorded hand and see what each move was worth

**Story:**

As Changs,
I want to pick a recorded hand and step through every decision with the table, the values of every
legal move, and the Coach's words,
so that I can watch what a seat's discards said before the hand ended.

**Acceptance Criteria:**

- Two runs of 180 hands, filterable by hand type and to evaluated only (FR-18).
- Each decision shows the bars with whiskers, whether the bot's pick was inside the noise, and the
  Coach's reasons for discards and claims.

**Examples:**

- Filter "evaluated only" on: the list shows only hands with "n evaluated" above zero, at most 60.
- A decision where the bot's regret is $0.30 with a standard error of $0.50 reads "inside the ±$0.50
  these 128 play-outs can resolve, so the two are not actually separated".

**Not this story:**

- Recording anything from the Film room.

**Done when:**

Both runs list and any evaluated decision renders the lines above.

**Related Feature:** F-011.

**Related Workflow:** WF-010.

**Related Journey:** UJ-005.

**Relevant Specification / Rules:** FR-18.

**Dependencies:** The exported replays.

**Status:** BUILT (OBSERVED).

---

## US-011 — A made-up hand is never mistaken for a measured one

**Story:**

As Changs,
I want the fallback hand, when the pack has nothing, to say plainly that it is made up and that the
Coach marks it, with every verdict naming the Coach,
so that a Coach opinion is never read as a measurement.

**Acceptance Criteria:**

- The fallback appears only when no pack loads or the filters leave nothing (FR-06).
- The banner says why and gives the Coach's 52.8% and 36.1%.
- Every verdict word names the Coach; the record and log mark the judge "coach" (BR-03).

**Examples:**

- Cause "Missed a tile on the table" chosen on the `coach` pack, which cannot serve it: the banner
  reads "Nothing in this pack is about "Missed a tile on the table", so the engine dealt one instead".
- Throwing the Coach's tile: "The Coach agrees". Throwing a worse one: "Mistake, says the Coach".

**Not this story:**

- Improving the Coach; out of scope.

**Done when:**

The two conditions produce the banner, and no verdict text on the fallback screen omits the Coach.

**Related Feature:** F-003.

**Related Workflow:** WF-006.

**Related Journey:** UJ-002.

**Relevant Specification / Rules:** FR-06, BR-03, BR-05.

**Dependencies:** None.

**Status:** BUILT (OBSERVED; the rule itself is CONFIRMED in `NEXT.md`, "The merge").

---

## US-012 — Set my table's money and see what it rewards

**Story:**

As Changs,
I want to set the ladder, who pays, the minimum, the Jokers and the side payments, and see at once
which hands are worth chasing here,
so that the app prices things in my table's money.

**Acceptance Criteria:**

- Five presets, three pay modes, every amount editable, saved as I go (FR-19).
- The pricing table, the sweet spot and the chase-or-avoid lines re-price on every amount change
  (FR-20).
- The Play tab and the Challenge button use these settings.

**Examples:**

- Preset "Flat 2/3/5/10/20 (your table)", shooter pays: the 5 Tai row reads "$20 — shooter alone";
  switching to "everyone" reads "$20 + $10 × 2 = $40".
- Jokers unticked: the Play card reads "0 Jokers, 2 Tai minimum".

**Not this story:**

- Making the Train tab read these settings (US-020).

**Done when:**

The rows above render, and a Play hand dealt after unticking Jokers has no Jokers in the wall.

**Related Feature:** F-012.

**Related Workflow:** WF-011.

**Related Journey:** UJ-001.

**Relevant Specification / Rules:** FR-19, FR-20.

**Dependencies:** None.

**Status:** BUILT (OBSERVED).

---

## US-013 — Save my record to a file and restore it

**Story:**

As Changs or a friend,
I want one button that writes everything the app remembers to a file, and one that puts it back,
so that a cleared browser does not cost a month of mistakes.

**Acceptance Criteria:**

- The file holds the record, the Spot scores and causes, the practise filter and the hand log, and
  is named by the day.
- Restore replaces rather than merges and says what it replaced.
- A wrong file is refused with a reason.

**Examples:**

- Pressing Save on 2026-09-12 downloads `which-tile-2026-09-12.json` and the card reads "Saved 12
  mistakes and your drill scores to a file."
- Restoring a file with 12 mistakes over a browser holding 3: "Restored: 12 mistakes (9 sorted) and
  40 spot answers, replacing 3. Reload the page to see them."
- Restoring a text file: "Not restored — that file is not JSON."

**Not this story:**

- The Play hands, table money and Your hand settings; not in the file (OBSERVED, UNRESOLVED).

**Done when:**

The three examples behave as stated and the file's `data` carries exactly the five keys.

**Related Feature:** F-013.

**Related Workflow:** WF-012.

**Related Journey:** UJ-001, UJ-006.

**Relevant Specification / Rules:** FR-21; the data rules in `SPEC.md`.

**Dependencies:** None.

**Status:** BUILT (OBSERVED).

---

## US-014 — Install on my phone, work offline, and take updates

**Story:**

As Changs or a friend,
I want the app on my home screen, working with no signal, with a bar that tells me when a new
version is ready,
so that I train on the phone and never sit on a stale version.

**Acceptance Criteria:**

- Under 640px: a bottom bar with four tabs and More; every control at least 48px; safe-area insets
  (FR-25).
- After one visit every tab works offline.
- After a deploy, a Reload bar appears when the app comes to the foreground, checked at most hourly
  (FR-26).

**Examples:**

- At 360px wide the bar shows Train, Spot, Review, Tips, More; More opens a sheet with Your hand,
  Film room, Play, Table setup.
- Airplane mode after one visit: Train serves any shard already answered; Tips and Spot open.
- A deploy at 14:00; the app was backgrounded at 13:30 and brought back at 15:10: the bar "A new
  version is ready." with Reload.

**Not this story:**

- The 4G first-question time (UNRESOLVED). The late-game table width (UNRESOLVED).

**Done when:**

The three examples hold on a real phone. `MOBILE.md` records the 360px measurements that drove the
work; whether they were re-measured after the pass is not recorded.

**Related Feature:** F-015.

**Related Workflow:** WF-014.

**Related Journey:** UJ-001, UJ-006.

**Relevant Specification / Rules:** FR-25, FR-26; the non-functional rules in `SPEC.md`.

**Dependencies:** GitHub Pages.

**Status:** BUILT (commit `2caa444`, 2026-09-11; OBSERVED). Changs found and reported the
installed-app 404 on his phone, which is the one piece of phone evidence recorded.

---

## US-015 — Play one hand and judge each decision

**Story:**

As Changs,
I want to play a whole hand against three Coaches at my table and then have each of my decisions
judged by play-outs against the measured best,
so that I get the whole hand without the drills losing their hour to it.

**Acceptance Criteria:**

- Only legal actions are tappable; the position before each of my decisions is kept (FR-22).
- Each decision can be judged alone or all together at BR-10, and the verdicts persist on the hand
  (FR-23).
- The review says the judge is trusted on throws and not yet on claims (FR-24).
- Up to twenty hands are kept and reopenable.

**Examples:**

- A discard with thirteen legal tiles: "Compared 6 of 13 legal tiles: yours and the 5 the Coach
  liked best", 256 play-outs each.
- A throw that measured $2.10 worse than the best with ±$0.80: "Mistake"; at ±$1.50: "Too close to
  call".
- A Pass on an offered win judged better than the Win, as happened on the first hand played: the
  review's caveat line is why it is not to be believed.

**Not this story:**

- Sessions, rotation, a score (F-020). Play mistakes entering the record (UNRESOLVED).

**Done when:**

Changs has played a few hands and said whether the loop feels like mahjong and the review is worth
reading (`NEXT.md`, "What needs Changs", item 1). Until then it is a prototype.

**Related Feature:** F-014.

**Related Workflow:** WF-013.

**Related Journey:** UJ-005.

**Relevant Specification / Rules:** FR-22, FR-23, FR-24, BR-10, BR-13.

**Dependencies:** US-012.

**Status:** BUILT (commit `636a7a3`; OBSERVED). Not played by its owner yet.

---

## US-016 — Answer a claim question and see why

**Story:**

As Changs,
I want claim-or-pass and kong-or-keep positions on Train, graded by play-outs, with the Coach's
reasons for the best call and mine,
so that calling, which the play-outs grade most sharply, gets its own practice.

**Acceptance Criteria:**

- Claim mode serves only claim and self questions; the buttons offer exactly the pack's actions.
- The verdict follows BR-04 and the reasons say what the best call buys and what mine did.
- Nothing is written to the record or the log (BR-05).

**Examples:**

- "西 discarded 3條 — claim or pass?" with buttons Pong, Chow 2條 4條, Pass; choosing Pass when Pong
  measured $1.90 better shows "Mistake" and "Why pong: …".
- "Kong, or keep the hand as it is?" with buttons Kong and No kong.

**Not this story:**

- Recording claims (UNRESOLVED). The claim judge for whole hands (US-017).

**Done when:**

A claim question renders the buttons from its actions and the record and log are unchanged after
answering.

**Related Feature:** F-001.

**Related Workflow:** WF-003.

**Related Journey:** UJ-002.

**Relevant Specification / Rules:** FR-01, BR-04, BR-05.

**Dependencies:** US-019.

**Status:** BUILT (OBSERVED).

---

## US-017 — A claim judge the whole-hand review can trust

**Story:**

As Changs,
I want the Play review to judge a Pong, a Chow or taking a win as honestly as it judges a throw,
so that the review stops calling a win a mistake.

**Acceptance Criteria:**

- Not written. The measured target is that the judge, on claim questions with known answers, agrees
  with the measured results: calling beats passing 72% of the time unconditionally, 88% when it
  makes the hand Ting Pai, 6% when it costs a step (CONFIRMED numbers, `Framework - Mahjong.md`;
  CONFIRMED as the fix, `NEXT.md`, item 1).

**Examples:**

- None until the story is agreed.

**Not this story:**

- Changing how throws are judged.

**Done when:**

A rollout policy for claim questions reproduces the three rates above within their error bars before
it replaces the current one.

**Related Feature:** F-017.

**Related Workflow:** WF-013.

**Related Journey:** UJ-005.

**Relevant Specification / Rules:** FR-24, BR-10.

**Dependencies:** US-015.

**Status:** PROPOSED (agent-generated ordering in `NEXT.md`; not agreed by Changs).

---

## US-018 — Send my record to Changs with one press

**Story:**

As a friend testing,
I want a button that sends my record to Changs,
so that he does not have to talk me through finding a downloaded file.

**Acceptance Criteria:**

- Not written. The stated shape is "a single 'send this to Changs' button that posts the same JSON"
  (CONFIRMED wording, `MOBILE.md`). Where it posts, and what Changs sees, are not stated.

**Examples:**

- None until agreed.

**Not this story:**

- A login or account (out of scope, CONFIRMED).

**Done when:**

Changs decides, after the fortnight of testing, that the records are worth collecting (UNRESOLVED),
and a destination exists.

**Related Feature:** F-018.

**Related Workflow:** WF-012.

**Related Journey:** UJ-006.

**Relevant Specification / Rules:** Security Requirements in `SPEC.md`; this would be the first thing
to leave the browser.

**Dependencies:** US-013.

**Status:** PROPOSED.

---

## US-019 — Every pack question verified on fresh play-outs

**Story:**

As Changs,
I want every question on the site to have cleared its bar twice on independent play-outs,
so that a "big mistake" badge is as certain as it looks.

**Acceptance Criteria:**

- A question is admitted at more than two paired standard errors on 128 play-outs and kept only if
  the gap still clears two standard errors on 512 fresh play-outs with a different seed (BR-07).
- Every question id from the earlier packs survives, so no stored card is orphaned.
- Each pack holds about ten thousand questions.

**Examples:**

- Admitting 12,800 on the `coach` pack held 10,500 (18.0% dropped); `min1` 10,473 (18.2%);
  `min1-nowild` 10,257 (19.9%).
- The best answer changed on about one question in 400 across the verify pass.

**Not this story:**

- Growing the no-Joker pack, which cannot grow without more grading.

**Done when:**

The pack counts on the site match the verify pass output and a card stored before the rebuild still
opens.

**Related Feature:** F-016.

**Related Workflow:** WF-003, WF-005.

**Related Journey:** UJ-004.

**Relevant Specification / Rules:** BR-07, BR-12.

**Dependencies:** None.

**Status:** VERIFIED. Evidence: `FINDINGS.md`, "The packs overstate their certainty by about a
tenth", built and measured 2026-09-11, with the counts above; `web/public/quiz/index.json` carries
the same counts (checked 2026-09-12).

---

## US-020 — The app knows which table I am playing

**Story:**

As Changs,
I want the app to know which table I am at, so the plans it names and the danger it prices match the
game in front of me
(CONFIRMED wording, `TABLE-VARIANTS.md`, user story 2, whose author is the agent writing in Changs's
voice; ASSUMED to reflect his intent).

**Acceptance Criteria:**

- A control in Table setup for Jokers and the minimum, beside the money.
- Every screen that prices or explains reads it.

**Examples:**

- Table setup set to 0 Jokers, min 1: Play deals a no-Joker hand and the Challenge button rebuilds
  positions at the pack's table but prices them in this money (OBSERVED, works).
- The same setting: the Train tab's note still says "your table is set to 4 and 2" because it reads
  `data/table.config.json`, and the Coach's reasoning on Train is computed for 4 Jokers and min 2
  (OBSERVED, the gap).

**Not this story:**

- Labelling per card which verdicts differ between tables (`TABLE-VARIANTS.md` task 9, second
  half; not started).

**Done when:**

With Table setup at 0 Jokers and min 1, the Train note and the Coach's reasoning on Train use those
values.

**Related Feature:** F-012.

**Related Workflow:** WF-011.

**Related Journey:** UJ-001.

**Relevant Specification / Rules:** FR-19; the exception on the pack-table note in `SPEC.md`.

**Dependencies:** US-012.

**Status:** IN PROGRESS, meaning partly built with nobody actively on it: the control exists and two
of three readers use it. Whether the third should is UNRESOLVED and has not been asked.
