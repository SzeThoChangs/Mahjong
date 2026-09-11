# WORKFLOWS

## Purpose of this file

This file describes how users accomplish specific tasks using the product.

## It answers

*How is the product actually used?*

## What belongs here

Important user processes, written from the user's operational perspective rather than the
application's technical architecture. Give each a stable identifier (`WF-001`) and never renumber.
A workflow should describe a meaningful task or outcome, not an individual button click.

## What does not belong here

The broader end-to-end experience goes in `USER-JOURNEYS.md`. Capabilities go in `FEATURES.md`.
Rules go in `SPEC.md` and are referenced, not restated. Buildable slices go in `USER-STORIES.md`.
Steps you cannot establish go in `OPEN-ITEMS.md`. Do not invent missing steps.

## When to update

When a process changes; when an exception path is discovered; when prototype or user testing shows
the real process differs from what is recorded.

## Relationship to other files

A workflow normally belongs to one or more journeys in `USER-JOURNEYS.md` and uses features from
`FEATURES.md` under rules from `SPEC.md`. `USER-STORIES.md` slices it into buildable work.

## Prototype demo fields

The prototype is a runnable snapshot of the live app and its screens are the app's tabs, so a
workflow's opening route is `prototype/app.html#<tab-id>` with the id from `web/src/App.tsx`
(`train`, `spot`, `ask`, `review`, `tips`, `film`, `play`, `table`). The app reads that hash on load and writes it back as
the tab changes (OBSERVED), so a route opens its own screen. Steps carry no deeper links, because
the app addresses tabs and not the states inside them. A workflow with no
screen says so.

Every step below is OBSERVED from the code unless marked otherwise; where the framework states the
same step as intent it is marked CONFIRMED.

---

## Workflow Index

| ID | Workflow | Primary Actor | Journey | Status |
|---|---|---|---|---|
| WF-001 | Clear the due reviews | U-001 | UJ-002 | BUILT |
| WF-002 | Run the Spot drill and sort a miss | U-001 | UJ-002 | BUILT, one CONFLICT |
| WF-003 | Answer a measured position on Train | U-001, U-002 | UJ-002 | BUILT, one CONFLICT |
| WF-004 | Aim Train at the leading Cause | U-001 | UJ-002 | BUILT |
| WF-005 | Challenge a verdict | U-001 | UJ-004 | VERIFIED |
| WF-006 | Answer a made-up hand and sort its Cause | U-001 | UJ-002 | BUILT |
| WF-007 | Reopen a hand you have played | U-002, U-001 | UJ-006 | BUILT |
| WF-008 | Read one Tips card with the book closed | U-001 | UJ-002 | Partly outside the app |
| WF-009 | Ask about the hand you are holding | U-001 | UJ-005 | BUILT |
| WF-010 | Study a recorded hand in the Film room | U-001 | UJ-005 | BUILT |
| WF-011 | Set up the table's money and rules | U-001 | UJ-001 | BUILT, one gap |
| WF-012 | Save the record to a file, and restore it | U-001, U-002 | UJ-001 | BUILT |
| WF-013 | Play one hand and judge its decisions | U-001 | UJ-005 | BUILT (prototype) |
| WF-014 | Install on a phone and take an update | U-001, U-002 | UJ-001 | BUILT |

---

## WF-001 — Clear the due reviews

**Primary Actor:** U-001.

**Other Actors:** The play-out judge or the Coach, whichever marked the card.

**Trigger:** The start of the practice hour (CONFIRMED, framework: "Do this first, while you are
fresh").

**Preconditions:** A record with at least one card whose due time has passed.

### Normal Flow

1. Open the Review tab. The diagnosis shows first, then the oldest due card as the bare position:
   table, hand, drawn tile, and "Which tile do you discard?". Nothing about the last attempt is
   shown (BR-02).
2. Work it out and tap a tile.
3. Read the result. It names the judge and says whether it is the honest grader or the one right
   about half the time (BR-03). Right says when the card is next due; wrong says it is back to the
   start, due tomorrow (BR-01).
4. Sort it. If the card has no Cause, pick one of the eight; if it has one, confirm or change it.
5. Press Next. The next due card appears, or "All caught up" with when the next comes back.

### Decisions

- Whether the queue is long enough to eat the Spot and Tips time (CONFIRMED rule, framework; not
  enforced by the app).

### Alternative Flows

- "Drop this one" removes a card from the schedule without answering.
- "Hands you have played" switches to the log (WF-007) and back.

### Hand-offs

- The "Practise" button on the diagnosis hands off to WF-004.

### Exceptions / Failure Flows

- A card that points at a retired pack, or a question no longer in its pack, shows "This one cannot
  be rebuilt" with a button to drop it (BR-11).
- A card from a pack that will not load shows "could not load the pack this came from"; try again
  with signal, or drop it.

**Completion Condition:** Nothing due, or the five minutes are up and the rest waits.

**Related Journey:** UJ-002.

**Related Features:** F-006, F-007.

**Relevant Business Rules:** BR-01, BR-02, BR-03, BR-06, BR-11.

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#review`

**Demo Summary:** A mistake from days ago comes back bare. Work it out again; it moves on or back.

**Demo Persona:** U-001

**Demo Group:** The practice hour

**Prototype Caveat:** Needs a record with something due.

---

## WF-002 — Run the Spot drill and sort a miss

**Primary Actor:** U-001.

**Other Actors:** None.

**Trigger:** The ten minutes after the reviews (CONFIRMED, framework).

**Preconditions:** `quiz/spot.json` loads.

### Normal Flow

1. Open the Spot tab. Choose the look: 3, 5 or 8 seconds. The tab opens at 5.
2. A position shows with a countdown. Take in what you can.
3. The table and hand go face down and one question is asked: how far from Ting Pai, which suit,
   who had most Melds up, or which shape.
4. Tap an answer. Right or Missed, with the explanation and the position shown again.
5. On a miss, say why: did not take it in, ran out of time, misread, or guessed. It goes on the
   tally for that question kind.
6. If the tally has earned it, a dashed box offers to move the look, with the reason. Take it or
   not (BR-08; CONFIRMED as intent, framework: "Take the offer rather than guessing").
7. Next position. The running score per skill sits at the foot of the page.

### Decisions

- Whether to take the offered look change.

### Alternative Flows

- Reset clears the scores and the cause tally.

### Hand-offs

- The leading Spot cause appears on the Review diagnosis with a one-line prescription (F-007).

### Exceptions / Failure Flows

- "Could not load the drill" with the status if the positions file fails.

**Completion Condition:** Ten minutes, or the framework's threshold: all four questions above about
sixty per cent at the current look.

**Related Journey:** UJ-002, UJ-003.

**Related Features:** F-005.

**Relevant Business Rules:** BR-08.

**Open Items:** CONFLICT. The framework says to start the third stage "at eight seconds" and shorten
to five, then three; the tab opens at five seconds and remembers nothing between visits. Either the
default is wrong or the framework is; nothing records which.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#spot`

**Demo Summary:** Five seconds to look, then one question about what was there.

**Demo Persona:** U-001

**Demo Group:** The practice hour

**Prototype Caveat:** None.

---

## WF-003 — Answer a measured position on Train

**Primary Actor:** U-001 or U-002.

**Other Actors:** The play-out judge (the verdict), the Coach (the words).

**Trigger:** The twenty-five minutes of Train, or any spare minute.

**Preconditions:** A pack loads.

### Normal Flow

1. Open the Train tab. Pick the pack by table: 4 Jokers min 2, 4 Jokers min 1, or 0 Jokers min 1.
   Pick all, discard or claim.
2. Read the position: seat, prevailing wind, turn, Tai in hand, the table with every seat's Melds,
   bonus tiles and discards, and your own hand with the drawn tile apart.
3. Say why before you tap (CONFIRMED, framework, fourth stage; not enforced). Tap a tile, or a
   claim button.
4. Read the verdict: Best move, Close enough, Too close to call, Mistake or Big mistake, with what
   yours and the best were worth and what you gave up (BR-04).
5. Read the reasons: what the Coach would do and whether the measurement agrees, the Coach's plan,
   why the best tile, why yours, any shape card this position has and whether the Measured Best
   follows it, and the bars for every action with their whiskers.
6. Note the id at the foot if the verdict looks wrong (WF-005).
7. Next position. The session tally updates.

### Decisions

- Which pack. The note beside the buttons says whether the pack's table matches the app's static
  config, and warns that the Coach's reasoning is computed for the app's table when it does not.

### Alternative Flows

- A discard verdict of Mistake or Big mistake writes a card to the record; every discard writes a
  log entry (BR-05). No Cause is asked for here; it is asked when the card comes back (WF-001).
- A claim question is graded and explained but written nowhere (BR-05).
- When the filters leave the pack nothing, WF-006 runs instead.

### Hand-offs

- To WF-005 on doubt. To WF-001 when the card comes due.

### Exceptions / Failure Flows

- No pack, or a pack that will not load: WF-006 with a banner saying why.
- A shard that will not load is skipped for this walk.

**Completion Condition:** The time is up. There is no end to a pack; shards are walked in a random
order and start over when all have been seen.

**Related Journey:** UJ-002, UJ-003, UJ-006.

**Related Features:** F-001, F-016.

**Relevant Business Rules:** BR-03, BR-04, BR-05, BR-06, BR-07, BR-12.

**Open Items:** CONFLICT. The framework says "The app suggests one from the position and you confirm
or correct it with a tap" about the Cause of a mistake. On the pack path, which is the main path,
the app suggests nothing and asks nothing at the moment of the mistake; the question comes at the
first review a day later, with no suggestion. The suggestion exists only on the fallback path
(WF-006). Whether the framework overstates or the tab is missing a step is for Changs.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#train`

**Demo Summary:** A real position, one tap, and what it cost against the measured best.

**Demo Persona:** U-001

**Demo Group:** The practice hour

**Prototype Caveat:** Needs the pack files.

---

## WF-004 — Aim Train at the leading Cause

**Primary Actor:** U-001.

**Other Actors:** None.

**Trigger:** A Cause has been at the top of the record for a while (CONFIRMED, framework, fifth
stage).

**Preconditions:** Sorted mistakes in the record; the leading Cause is one of the four the packs can
serve.

### Normal Flow

1. On the Review tab, read the diagnosis: the tally by Cause and the one that keeps coming up.
2. Press "Practise … on the Train tab". The app switches to Train with that Cause selected in the
   "about:" strip.
3. Train now serves only questions whose recorded throw failed for that Cause, and each says so
   under the question.
4. Answer as in WF-003.
5. When done, press "anything" in the strip to go back to the unfiltered deck (CONFIRMED, framework:
   "use the unfiltered deck the rest of the time").

### Decisions

- When to go back to the unfiltered deck. The framework says most of the time; the filter persists
  across reloads until changed.

### Alternative Flows

- Pick a Cause directly from the strip on Train; the top three from the record are offered.

### Hand-offs

- None.

### Exceptions / Failure Flows

- Nothing in the pack is about that Cause: the fallback deals a made-up hand aimed at it (WF-006)
  and says so.
- Claim mode: the strip is hidden and the filter is not applied, because Causes are read off
  discards.

**Completion Condition:** The Cause stops leading, or the deck is set back to anything.

**Related Journey:** UJ-002, UJ-003.

**Related Features:** F-002, F-007.

**Relevant Business Rules:** BR-12.

**Open Items:** Only four of the eight Causes can be aimed at from the packs (OBSERVED,
`PRACTISABLE`); the framework does not say what to do when the leading Cause is one of the other
four (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#review`

**Demo Summary:** The record says "misjudged the safety" keeps coming up; one press aims the honest
grader at it.

**Demo Persona:** U-001

**Demo Group:** The practice hour

**Prototype Caveat:** Needs sorted mistakes.

---

## WF-005 — Challenge a verdict

**Primary Actor:** U-001.

**Other Actors:** The play-out judge, in a Web Worker on the device.

**Trigger:** A verdict on Train that looks wrong.

**Preconditions:** The answer has been given; the question carries the whole table (packs from
2026-09-06 on).

### Normal Flow

1. On the verdict screen, press "Challenge the verdict (512 fresh play-outs)".
2. Watch the progress bar; about a second on the Mac, a few on a phone.
3. Read the outcome. Holds: your throw is still worse by about the same. Too close to call: the
   fresh gap is inside the noise and the pack's verdict was a coin flip. Reversed: yours comes out
   better (BR-09).
4. If the original charge was a mistake and it did not hold, the session tally moves it to "too
   close to call" and the hand log and mistake card carry the note. The card stays in the schedule.

### Decisions

- Whether to take it further on the Mac: quote the pack and id and run `challenge.ts` at 2,048
  play-outs (CONFIRMED, `FINDINGS.md`; outside the app).

### Alternative Flows

- When the pick was the pack's best, the comparison is against the runner-up and the words turn
  round: holds while the pick stays ahead.

### Hand-offs

- To the Mac for a definitive answer.

### Exceptions / Failure Flows

- A question from an older pack: "this pack was built before questions carried the whole table".
- The worker fails: "Could not re-judge this one" with the message.
- The button is gone once it has answered; a second opinion means the next time the position comes
  round.

**Completion Condition:** An outcome shown.

**Related Journey:** UJ-004.

**Related Features:** F-004.

**Relevant Business Rules:** BR-07, BR-09.

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#train`

**Demo Summary:** Doubt a "big mistake"; re-judge it on fresh dice in seconds, with no server.

**Demo Persona:** U-001

**Demo Group:** Disputing a verdict

**Prototype Caveat:** Runs the real play-outs.

---

## WF-006 — Answer a made-up hand and sort its Cause

**Primary Actor:** U-001.

**Other Actors:** The Coach.

**Trigger:** The pack has nothing for the current filters, or no pack loads.

**Preconditions:** None.

### Normal Flow

1. A banner says the hand is made up, why the pack had nothing, and that the Coach marks it and is
   right about half the time.
2. The hand shows, with a badge saying what it teaches and whether it matched the Cause asked for or
   is a trap instead.
3. Tap a tile. The verdict names the Coach: "The Coach agrees", "Mistake, says the Coach".
4. On a mistake, the position suggests a Cause, marked with a question mark; confirm it or pick
   another. It is recorded at once.
5. Next. The parent tries the pack again on every next.

### Decisions

- Pick "anything" or another pack to get back to measured positions.

### Alternative Flows

- None.

### Hand-offs

- The card enters the record with the judge marked "coach", counted separately in the diagnosis.

### Exceptions / Failure Flows

- No hand for the Cause in 40 deals: a trap is dealt and the badge says so.

**Completion Condition:** Back on a measured position, or time up.

**Related Journey:** UJ-002.

**Related Features:** F-003, F-007.

**Relevant Business Rules:** BR-03, BR-05, BR-06.

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#train`

**Demo Summary:** What the app says when it has nothing measured to offer, and how a Coach verdict
is kept apart from a measured one.

**Demo Persona:** U-001

**Demo Group:** The practice hour

**Prototype Caveat:** Reached by choosing a Cause the pack does not carry.

---

## WF-007 — Reopen a hand you have played

**Primary Actor:** U-002, and U-001.

**Other Actors:** None.

**Trigger:** Wanting to understand a hand already answered.

**Preconditions:** At least one discard answered on Train.

### Normal Flow

1. On the Review tab press "Hands you have played". The last 200 list newest first, each with ok or
   its verdict, the tile thrown, the best if different, when, and which judge.
2. Open one. The position shows with what you threw, what the judge threw, why the judge's tile,
   and why not yours.
3. "Back to the list". Nothing on the schedule has moved.

### Decisions

- None.

### Alternative Flows

- A challenged entry carries the fresh gap and its error.

### Hand-offs

- None.

### Exceptions / Failure Flows

- An entry whose pack or question is gone shows the "cannot be rebuilt" card.

**Completion Condition:** Understanding, or the list closed.

**Related Journey:** UJ-006.

**Related Features:** F-008.

**Relevant Business Rules:** BR-05.

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#review`

**Demo Summary:** Open a hand from yesterday and see the answer and the reasoning straight away.

**Demo Persona:** U-002

**Demo Group:** Looking back

**Prototype Caveat:** Needs hands played first.

---

## WF-008 — Read one Tips card with the book closed

**Primary Actor:** U-001.

**Other Actors:** None.

**Trigger:** The last five minutes of the hour (CONFIRMED, framework).

**Preconditions:** None.

### Normal Flow

1. Open the Tips tab. Pick a phase from the strip, or scroll.
2. Read one card: its rule, its example blocks, why it works, where it stops applying, and its
   badge.
3. Close it, meaning look away, and explain it out loud in plain words (CONFIRMED, framework and
   `../CLAUDE.md`, the fourth idea). This step is outside the app.
4. Where the sentence falls apart, read that part again and try once more.

### Decisions

- Which card. The framework says read in phase order for the vocabulary stage; the hour's card is
  the reader's choice.

### Alternative Flows

- None.

### Hand-offs

- None.

### Exceptions / Failure Flows

- None.

**Completion Condition:** An explanation that holds together.

**Related Journey:** UJ-002, UJ-003.

**Related Features:** F-009.

**Relevant Business Rules:** FR-15, FR-16.

**Open Items:** The app does not know which cards have been done or which phase the reader is up
to (OBSERVED absence; nobody has asked for it).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#tips`

**Demo Summary:** One card, its badge, and the reason it is or is not true here.

**Demo Persona:** U-001

**Demo Group:** The practice hour

**Prototype Caveat:** The explaining happens off the screen.

---

## WF-009 — Ask about the hand you are holding

**Primary Actor:** U-001.

**Other Actors:** The Coach.

**Trigger:** A real hand and a real question.

**Preconditions:** None.

### Normal Flow

1. Open Your hand (behind More on a phone). Set your seat, the round, the turn and the sets showing
   opposite; these are remembered from last time.
2. With "to hand" selected, tap tiles into the hand. Use "+ pong" or "+ chow" for exposed sets, and
   the bonus row for flowers and animals. Use "seen on table" for everything face up elsewhere; the
   more of it, the better the danger read.
3. At fourteen tiles counting three per set, the answer appears: the tile to throw, the plan, the
   reasons, and everything else ranked with "also fine", "mistake" or "blunder".
4. Or, at thirteen, press "thrown tile" and tap the tile someone threw; say whether it came from the
   player before you. The answer is take it or pass, with each option's gain in chips and reasons.
5. Clear for the next hand. The tiles are not remembered.

### Decisions

- Whether the thrown tile came from the player before you, since only they can be chowed from.

### Alternative Flows

- None.

### Hand-offs

- None; nothing here is recorded.

### Exceptions / Failure Flows

- Fourteen tiles that are not a hand about to throw: "that is a full hand, not one waiting to
  throw".
- A thrown tile with the wrong count: "You need 13 tiles to answer this".
- Nothing in hand matches the thrown tile: "You cannot claim it".

**Completion Condition:** An answer read.

**Related Journey:** UJ-005.

**Related Features:** F-010.

**Relevant Business Rules:** The validations in `SPEC.md`.

**Open Items:** Whether it is used at a live table (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#ask`

**Demo Summary:** Tap in fourteen tiles and it says what to throw, and why.

**Demo Persona:** U-001

**Demo Group:** At the table

**Prototype Caveat:** The Coach's opinion, not a measurement.

---

## WF-010 — Study a recorded hand in the Film room

**Primary Actor:** U-001.

**Other Actors:** None.

**Trigger:** The weekly whole-hand slot, or the reading stage.

**Preconditions:** The replays are present.

### Normal Flow

1. Open Film room (behind More). Pick a dataset, `coach` or `money`, 180 hands each. Filter by hand
   type; "evaluated only" is on by default.
2. Pick a hand from the list: who won, what, how many Tai, at which turn, how many decisions were
   evaluated.
3. Scrub with the slider or the arrows, or jump between the evaluated decisions.
4. At each decision, read the table from behind the acting seat, what it chose, the bars for every
   legal action with whiskers, whether the bot's pick was inside the noise, and the Coach's words.
5. "All hands" to go back.

### Decisions

- None.

### Alternative Flows

- None.

### Hand-offs

- None; nothing is recorded.

### Exceptions / Failure Flows

- No replays: a line saying which command exports them.

**Completion Condition:** The hand watched.

**Related Journey:** UJ-003, UJ-005.

**Related Features:** F-011.

**Relevant Business Rules:** None.

**Open Items:** None.

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#film`

**Demo Summary:** Scrub a real hand decision by decision and see what each move was worth.

**Demo Persona:** U-001

**Demo Group:** The whole hand

**Prototype Caveat:** Needs the replay files.

---

## WF-011 — Set up the table's money and rules

**Primary Actor:** U-001.

**Other Actors:** None.

**Trigger:** First use, or a different table.

**Preconditions:** None.

### Normal Flow

1. Open Table setup (behind More). The backup card is first; the money card is second.
2. Pick a preset. The first, "Flat 2/3/5/10/20 (your table)", is the default.
3. Pick who pays on a discard win: shooter alone, everyone with shooter double, or all the same.
4. Edit the ladder, the Zi Mo bonus, the minimum and maximum Tai, the Zi Mo minimum, the kong and
   bite amounts, and whether Jokers are in play and how many. Everything saves as you go.
5. Read "What this table rewards", "Reading the other seats", and "What pays best" against a
   comparison preset.

### Decisions

- The pay mode and the minimum, which change what the Play tab and the Challenge button price.

### Alternative Flows

- None.

### Hand-offs

- To the Play tab and the Challenge button, which read these settings.

### Exceptions / Failure Flows

- No profile file: a line saying which command builds it.

**Completion Condition:** The table matches the one played.

**Related Journey:** UJ-001, UJ-003.

**Related Features:** F-012.

**Relevant Business Rules:** FR-19, FR-20.

**Open Items:** The Train tab's "your table" note and its Coach reasoning read the static config,
not these settings (OBSERVED; see F-012).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#table`

**Demo Summary:** Set the money and see which hands are worth chasing here.

**Demo Persona:** U-001

**Demo Group:** Setting up

**Prototype Caveat:** None.

---

## WF-012 — Save the record to a file, and restore it

**Primary Actor:** U-001, U-002.

**Other Actors:** None.

**Trigger:** The end of the first week, then whenever remembered (CONFIRMED, framework); or a new
device; or sending a record to Changs.

**Preconditions:** None.

### Normal Flow

1. Open Table setup. Press "Save my record to a file". The browser downloads
   `which-tile-YYYY-MM-DD.json` and the card says how many mistakes it saved.
2. Keep the file somewhere that survives the browser.
3. To restore, press "Restore from a file" and pick the file. The card says what was restored and
   what it replaced, and to reload the page.

### Decisions

- Whether to overwrite; restore replaces rather than merges, and the card says so.

### Alternative Flows

- None.

### Hand-offs

- To Changs, by whatever channel, when the file is a friend's (UJ-006).

### Exceptions / Failure Flows

- Not JSON, not a "which-tile" export, or a different version: "Not restored" with the reason.
- The browser refuses to write storage: "this browser would not let the app write to storage".

**Completion Condition:** A file saved, or a record restored and the page reloaded.

**Related Journey:** UJ-001, UJ-006.

**Related Features:** F-013.

**Relevant Business Rules:** The data rules in `SPEC.md`.

**Open Items:** Play hands, table money and Your hand settings are not in the file (OBSERVED).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#table`

**Demo Summary:** The whole record to a file and back.

**Demo Persona:** U-001

**Demo Group:** Setting up

**Prototype Caveat:** A sandboxed viewer may block the download.

---

## WF-013 — Play one hand and judge its decisions

**Primary Actor:** U-001.

**Other Actors:** Three Coaches; the play-out judge.

**Trigger:** The weekly whole-hand slot, or `NEXT.md`'s request to play a few hands.

**Preconditions:** The table set up in WF-011.

### Normal Flow

1. Open Play (behind More). The card says the table: Jokers, minimum, preset. Press Deal.
2. Watch the bots move one decision every 350 ms, or press "Skip to my turn".
3. When it is yours, the prompt says which decision: tap a tile to throw; or Win, Kong or Carry on
   after a draw; or claim or pass on a thrown tile, with Chow, Pong, Kong and Pass as buttons. Only
   legal actions are tappable.
4. Play the hand out. When it ends, the review shows: who won, on what, the chips, how many turns
   and how many decisions were yours, and the line that the result is mostly luck and the judge is
   trusted on throws but not yet on claims.
5. Judge one decision with its Judge button, or "Judge all". Each verdict is Best, Too close to
   call, or Mistake, with what the reference action was worth, how many actions were compared of
   how many were legal, and each action's value (BR-10).
6. "Play another hand", or reopen an earlier hand from the list below, with its verdicts still
   there.

### Decisions

- Abandon mid-hand; the hand is not kept.

### Alternative Flows

- A hand that ends before you have a decision says so.

### Hand-offs

- None into the record (OBSERVED absence).

### Exceptions / Failure Flows

- "The engine stopped: …" if the engine throws.
- "Could not judge this one: …" if the worker fails; the Judge button returns.

**Completion Condition:** The hand reviewed.

**Related Journey:** UJ-005.

**Related Features:** F-014.

**Relevant Business Rules:** BR-10, BR-13.

**Open Items:** Whether the loop feels like mahjong and the review is worth reading (UNRESOLVED,
`NEXT.md`). The claim judge (F-017).

### Prototype / Demo

**Prototype Status:** BUILT

**Prototype Route:** `prototype/app.html#play`

**Demo Summary:** One hand against three Coaches, then every decision judged against the measured
best.

**Demo Persona:** U-001

**Demo Group:** The whole hand

**Prototype Caveat:** Prototype; claims under-priced; seat and wind fixed.

---

## WF-014 — Install on a phone and take an update

**Primary Actor:** U-001, U-002.

**Other Actors:** The service worker; GitHub Pages.

**Trigger:** First visit; a deploy.

**Preconditions:** The address with `/Mahjong/` on the end.

### Normal Flow

1. Open the address in the phone's browser. The bottom bar shows Train, Spot, Review, Tips and
   More.
2. Add it to the home screen. It opens standalone with the green dragon icon.
3. Use it once with signal; every chunk is cached and it works offline after that.
4. After a deploy, when the app comes back to the foreground, a bar says "A new version is ready."
   Press Reload. The new worker takes over and the page reloads.

### Decisions

- None.

### Alternative Flows

- On a screen 640px or wider the eight tabs sit in a strip along the top.

### Hand-offs

- None.

### Exceptions / Failure Flows

- A tab whose chunk fails to arrive shows "This part of the app could not be loaded" with a Reload
  button.
- iOS uses the apple-touch-icon and ignores the manifest icon.

**Completion Condition:** The app on the home screen, current, and working offline.

**Related Journey:** UJ-001, UJ-006.

**Related Features:** F-015.

**Relevant Business Rules:** FR-25, FR-26.

**Open Items:** The four primary tabs (CONFLICT, F-015). The 4G first-question number (UNRESOLVED).

### Prototype / Demo

**Prototype Status:** PARTIAL

**Prototype Route:** `prototype/app.html#train`

**Demo Summary:** The phone layout, narrowed under 640px.

**Demo Persona:** U-002

**Demo Group:** Setting up

**Prototype Caveat:** Install, offline and the update bar need the built site and a real service
worker; the prototype can show the layout only.
