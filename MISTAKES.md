# MISTAKES — the agent's own register

## Purpose of this file

The agent's repeated mistakes, counted, and the record of every set of ten passes (Part 9 of the
starter).

**It answers:** *What does the agent get wrong repeatedly, how often, and what did each set of passes
actually measure?*

## What belongs here

- **One entry per kind of mistake**, with every occurrence dated: what was claimed, and what was
  actually true. A first occurrence is recorded so a second has somewhere to go.
- **Every set of ten passes**: the test boundary, the pasted `date` output, and a result for every
  dimension.

## What does not belong here

- A defect in the product → `PROTOTYPE.md`, or `OPEN-ITEMS.md` if nothing is prototyped
- An open question → `OPEN-ITEMS.md`
- A decision → `DECISIONS.md`

**This is not a place to be sorry in.** No apologies, no promises to be more careful. A count, and
what happened.

## When to update

**Immediately when a mistake repeats** — before continuing the work, not in a summary afterwards.
After each set of passes, before reporting the work.

## Relationship to other files

`PROTOTYPE.md` records what was wrong with the product. This records what was wrong with the agent.
Where a finding there exists because of a mistake here, both name the other. `check-evidence.js` and
`check-screens.js` exist because of the kinds recorded here.

## The rule

**On every third occurrence of the same kind, the agent says plainly: *I am fucked up.*** Each further
three adds one *very*: six is *I am very fucked up*, nine *I am very very fucked up*.

**At three occurrences, the agent also builds a check that can catch it**, and names it in the entry.
Then it continues the work. The count carries across sessions because it is in this file.

---

## Mistakes

## M-001 — Clicking a control because its name matched, without checking which control it was

**Count: 3.**

| # | When | What was claimed | What was actually true |
|---|---|---|---|
| 1 | 2026-09-13, 23:45 | A script answering positions offline clicked "a discard tile" five times and reported the hand never changed | It clicked the **discard filter chip** five times. `has-text("discard ")` matched the chip; no tile was ever played |
| 2 | 2026-09-13, 23:48 | The next script clicked "the answer" five times | It clicked the **claim filter chip**. A case-insensitive match for `Claim` caught it. Found both times by looking at the screenshot, which showed the chip highlighted |
| 3 | 2026-09-16, 23:08 | A script pressing each Table setup preset by a name match pressed nine buttons and reported the last four saved nothing | After the fifth press a second "compare against" list appeared with the same preset names, and the last four presses landed on it. Found by reading the result: the saved name did not match the button pressed |

**What it is.** Choosing an element by a word in its label, when the page has more than one element
with that word, and trusting the click rather than looking at what was pressed.

**The check built for it.** `prototype/tools/click-one.js`, built 2026-09-16 at the third occurrence.
`clickOne(pattern, { within })` presses a control only when exactly one visible control matches, and
otherwise throws, naming every match and the heading above it. The Table setup presses were re-run
with it, scoped to the preset row.
---

<!-- Shape of an entry:

## M-001 — [The kind of mistake]

**Count: 1.**

| # | When | What was claimed | What was actually true |
|---|---|---|---|

**What it is.**

**The check built for it.** None yet — built at the third occurrence.
-->

---

## Ten passes

### The Table setup default, the Coach's minimum, and the dealer badge on phones — Wed Sep 16 23:06:34 +08 2026

Passes run on the prototype build served from the project root. Code changed four times during the
passes: the one-time move of the old default (found in pass 3, below), the Coach's minimum (Changs's
report), the dealer badge (Changs's request), and a Review row that did not wrap (pass 9). Every pass
each change could affect was run again. Finished Wed Sep 16 23:21:48 +08 2026.

**Test boundary**

- Workflows: first load of Train; opening Table setup and what it saves; a phone that already stored
  the old 4-Joker min-2 default; choosing 4 and 2 on purpose afterwards; the preset buttons; the
  Coach's claim reasoning on a Train pack question; the made-up hand's minimum; Play's table line.
- Screens: Train, Table setup, Play, Review, Spot, Film room, Your hand.
- Access restrictions: none; the app has no accounts.
- Values, records and calculations: `mahjong.money.config` jokers and minTai;
  `mahjong.money.default-0j-min1`; the minimum the Coach reasons at; "need N to win on a discard".

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded at 1280 and 390px. Train showed no table commentary under the pack buttons. Table setup showed Jokers unticked and Min Tai 1. Play read "0 Jokers, 1 Tai minimum". A corner seat that was dealer showed the badge below the wind (column layout, badge top 333 against wind top 311) | 0 |
| 2 | Errors | Page error listeners on every screen through every pass | 0 |
| 3 | Links | 8 tabs pressed at 1280, each set its address. Table setup presets pressed with `clickOne` scoped to the preset row: 5 of 5 saved their own name. Play Deal and Abandon; Film room open, next, previous, back | 1 |
| 4 | Workflow steps | The Coach's claim reasoning run on the exact screenshot position (min1-nowild 3935:11:64) at min 2 and min 1: min 2 reproduced the reported "1 more tai needed" word for word, min 1 did not. In the build, 8 of the 62 prototype questions where min 2 would say it were served, and 0 of 8 said it. 2 other lines said "1 more tai needed", both with 0 Tai in hand, which is correct at min 1. Made-up hands (pack index removed to force them): 14 dealt, Tai 1 or 2 showed no "need", Tai 0 showed "need 1" | 0 |
| 5 | Writes | Fresh device: Table setup saved jokers 0, minTai 1. Old default seeded: first load stored 0 and 1 and set the marker. 4 Jokers and min 2 then chosen through the screen: still 4 and 2 after reload (run on the 23:07 build; nothing changed after it touches the move) | 0 |
| 6 | The data it moves | The move changed only jokers and minTai; the preset name and money fields stayed as stored. Each preset press saved that preset's own jokers and minTai | 0 |
| 7 | Reconciliation | Play's table line, Table setup's controls and the stored config agreed at 0 and 1 on a fresh device, and at 4 and 2 after the deliberate choice | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train, Spot, Review, Table setup, Film room (hand open), Play (dealt) at 280, 320, 375, 390 and 1280px: 30 checks, page width within the screen on all 30 after the fix; 0 controls under 48px at phone widths | 1 |
| 10 | Look at it | Screenshots: Train at 390 with the dealer badge under 東, Play at 390, Review at 1280. Read each | 0 |

**Defects found:**

1. Pass 3 on the first version of the default move, fixed: it moved any stored 4-and-2 on that preset
   every time the app loaded, so a player who chose 4 Jokers and min 2 on purpose would have been
   switched back on every visit. Expected a deliberate choice to stay. Fixed by moving it once per
   device behind a marker. Re-ran passes 1, 3, 5, 6 and 7: the deliberate 4 and 2 survived a reload.
2. Pass 9, fixed: Review at 280px was 301px wide, because the "Due now" and "Hands you have played"
   row did not wrap. Fixed with a wrap. Re-ran passes 1, 2, 9 and 10 on Review: 280 of 280.

**Not checked:** Your hand, whose reasoning uses the same Table setup minimum but needs a 14-tile
hand built before the minimum changes any words; a Review card reopened from a pack question, which
needs a recorded mistake from a min-1 pack first; a real iPhone 12; dark mode.

### Hard only, the left seat name, the felt table, and the Train screen changes — Wed Sep 16 22:50:01 +08 2026

Passes run on the prototype build (`prototype/app.html`, the whole app folded into one file) served
from the project root. Code changed three times during the passes, at the owner's request (hard only
on by default, the 0-joker min-1 pack first, and a readability fix found in pass 10); every pass that
change could affect was run again from the start. Finished Wed Sep 16 23:02:06 +08 2026.

**Test boundary**

- Workflows: answering a Train position (discard, claim, self); the hard only filter and its saved
  setting; the pack buttons; the all, discard and claim filters; the cause line after answering;
  opening and stepping a Film room hand; dealing and throwing in Play; opening Review.
- Screens: Train, Spot, Review, Film room, Play (all five draw the square table).
- Access restrictions: none; the app has no accounts.
- Values, records and calculations: `mj.hard.v1`; which questions are served with hard only on; the
  session tally; the hand log `mj.history.v1`; the pack counts on the buttons against the index.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Cleared local storage, session storage and caches, reloaded at 1280px and 375px. Train opened on "0 Jokers, min 1 Tai" with hard only pressed and `mj.hard.v1` = "1". Seat and wind details sat inside the question card. The "a real position" line was absent. Spot, Review, Film room and Play rendered | 0 |
| 2 | Errors | Page error and unhandled-rejection listeners on every screen through every pass; console read at the start | 0 |
| 3 | Links | All 8 tabs pressed, each set its own address (#train, #spot, #ask, #review, #tips, #film, #play, #table). Each of 3 pack buttons selected itself and served a question. discard, claim and all each served a question of that kind. Film room: opened a hand, next went 1/17 to 2/17, previous back to 1/17, All hands returned to the list. Play: Deal, one throw moved turn 4 to 8, Abandon returned to Deal | 0 |
| 4 | Workflow steps | Answered 25 positions (14 discards, 9 claims, 2 self). The cause line was absent before answering and present after on 128:20:88 ("Miscounted", which is the pack's `c` for that id). Claim screens offered no tile buttons | 0 |
| 5 | Writes | hard only off: stored "0", still off after reload. Turned on: stored "1", still on after reload | 0 |
| 6 | The data it moves | All 25 served ids found in the 0-joker pack and all 25 hard by the definition (not a win, gap 8 SE or less, the recorded seat chose otherwise), checked in Python against the pack files. Every answer raised the session tally by exactly 1 | 0 |
| 7 | Reconciliation | Pack buttons 480, 440, 409 match the prototype's own index (the one-file build carries a cut of each pack). Hand log 14 entries = 14 discards answered; claims and self decisions are not logged, by design | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train, Spot, Review, Film room (hand open), Play (dealt) at 280, 320, 375 and 1280px. Page width never exceeded the screen; 0 controls under 48px at 280, 320 and 375 | 0 |
| 10 | Look at it | Screenshots of Train at 375 and 1280, Play at 375, Film room at 1280. Read each | 3 |

**Defects found:**

1. Pass 10, fixed: the selected pack button showed "Jokers" and "Tai" in their green and red on the
   button's dark green, which could not be read. Expected readable words. Fixed by giving marked words
   on the selected button the button's own colour. Re-ran passes 1, 2, 3, 9 and 10 on Train: the
   words now match the button colour on all three when selected, 0 errors, 375px and 1280px wide.
2. Pass 10, not fixed, needs the owner: with the 0-joker pack first, a device whose Table setup is
   still 4 Jokers and min 2 shows an orange paragraph under the pack buttons on first load, saying the
   Coach's reasoning is computed for a different table. True, but it is the first thing a new tester
   reads.
3. Pass 10, not fixed, already open as `Q-002`: at 375px the table is wider than its card on a
   late-game position, so the right-hand seat is cut off until the card is scrolled sideways.

**Not checked:** a real phone; the Your hand, Tips and Table setup screens beyond pressing their tabs;
Challenge; the Review screen with a card opened; dark mode.


<!-- Shape of a set:

### [What changed] — [pasted `date` output]

**Test boundary**

- Workflows:
- Screens:
- Access restrictions:
- Values, records and calculations:

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | | |
| 2 | Errors | | |
| 3 | Links | | |
| 4 | Workflow steps | | |
| 5 | Writes | | |
| 6 | The data it moves | | |
| 7 | Reconciliation | | |
| 8 | Access | | |
| 9 | Width | | |
| 10 | Look at it | | |

**Defects found:**

**Not checked:**
-->
