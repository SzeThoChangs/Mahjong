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

### A win on offer is answered by rule, in the pack data and on the Train screen — Sat Sep 26 20:04:00 +08 2026

Passes run against the dev server on port 5174, on the working tree. Two defects were found and
fixed during the set, so the passes affected by each fix were run again on the fixed build; every
result below is from the final build.

The pack rule questions were served from a 199-question test pack built from `run-min1-nowild`
(34 carried `rule: 'win'`, 6 of them ones whose play-outs preferred passing). For the six where the
rule changes the answer, the shard was served through a patched `fetch` so each appeared once and by
name. The test pack was deleted afterwards and `web/public/quiz/index.json` restored.

**Test boundary**

- Workflows: answering a Train question (discard, claim, self), choosing a pack, the mode and hard
  only filters, Challenge, Next position, the whole-app navigation.
- Screens: Train, and every screen reachable from it (Spot, Review, Tips, Your hand, Film room,
  Play, Table setup).
- Access restrictions: none exist.
- Values, records and calculations: the stored `best` and `rule` in a pack question, the verdict, the
  session tally and its "Given up" figure, the hand log `mj.history.v1`, the mistake record
  `mj.mistakes.v1`, the pack index tallies against the shard files.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Local storage, session storage, IndexedDB and caches cleared, reloaded at 1280px and 390px. Train opened on "0 Jokers, min 1 Tai" with `mj.hard.v1` = "1" and served a question. A rule question answered straight after the cold start read "Best move", "Right. A win on offer is taken.", 0 money bars, 0 matches for NaN or undefined | 0 |
| 2 | Errors | `console.error` hooked from the first line of each run, plus the tab's own console and network log. 25 questions answered, 7 screens opened, every control on Train pressed: 0 errors, 0 failed requests | 1, fixed and re-measured 0 |
| 3 | Links | The 4 pack buttons, all, discard, claim, hard only, reset, Next position, the 5 navigation tabs, and the 4 entries behind More (Your hand #ask, Film room #film, Play #play, Table setup #table) and its Close. Each rendered its own screen; Close removed the sheet; Train came back with a question | 0 |
| 4 | Workflow steps | 6 rule questions answered, 3 Win and 3 Pass; 8 ordinary questions answered (discard, Pong, Chow). Refusals: a second answer after one is given was ignored, the tally and the verdict unchanged; Challenge is absent on a rule question; with hard only on, rule questions are filtered out and the made-up hand is served instead, saying so | 0 |
| 5 | Writes | hard only stored "0" and "1" and survived a reload both ways. After 10 answered discards the hand log held 10 entries and the mistake record 7; both were still 10 and 7 after a reload | 0 |
| 6 | The data it moves | In the test pack 34 of 199 questions carry `rule: 'win'`, all 34 have `best` = "win", all 34 offer a win action, and 0 questions offer a win without the flag. Answering a rule question wrong moved "Given up" by $0.00 (it stayed $0.00 across 5 rule answers, then $7.91 after one discard blunder and $7.91 after two further rule mistakes); the streak still reset to 0. Claims, and so rule questions, are not written to the hand log or the mistake record, which is how the tab already worked | 0 |
| 7 | Reconciliation | Session tally after the walk read best 3, mistake 4, blunder 1, close 0, too close to call 0, Given up $7.91 — exactly the 8 answers given. The Review screen read "Hands you have played 10" and "not sorted yet 7" against 10 and 7 in local storage. Pack index tallies checked against the shard files in Node: ruletest 199 = 199 over 2 shards, min1-nowild 10,257 = 10,257 over 103 shards, 0 mismatches | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train with a rule question answered at 280, 320, 375, 390 and 1280px. Page scroll width equalled the screen at all five (1265 of 1280 at desktop). Elements reaching past the right edge: 194 at 280px, all 194 inside a deliberate `overflow-x-auto` container (the pack strip and the felt); 0 outside one at any width | 0 |
| 10 | Look at it | Screenshots of Train at 390px (question and verdict) and 1280px, read line by line. Lines read: "南 discarded 9萬 — Win, Chow or pass?", "Mistake", "Take the win. Declining costs a fifth to a half a chip a game against strong players.", "the pong bot chose win", "The Coach would pass. The win is still the answer here.", "Coach reads this as half-color.", "Why win: It wins the hand.", "The play-outs on this one rate passing higher, and they are wrong about it...", "ruletest / 2572:0:56" | 1, fixed |

**Defects found:**

1. Pass 2, fixed: a shard that loads with nothing in it for the current filters spun for ever and
   left the Train screen blank. Expected: the walk moves on to another shard, or the made-up hand.
   Actually: 888 "Maximum update depth exceeded" errors in six seconds and no content. The cause was
   in `web/src/components/Train.tsx` — a shard already marked barren was marked again on every run,
   and `new Set(b).add(...)` is a new object each time, so `eligible` changed identity and the effect
   re-ran itself. Reachable in the field from a cached index with rebuilt shards, which is what the
   pack rebuild will produce. Fixed by marking once. Re-measured with the same injected empty shard:
   0 errors, and the screen falls back to the made-up hand with its explanation. Passes 1, 2, 3, 4,
   5, 7, 9 and 10 were then run again on the fixed build.
2. Pass 10, fixed: on a rule question the Coach line still read "Agrees with the measurement" or
   "The measurement disagrees — trust the bars here". Both are untrue there: the answer comes from
   the rule, not the play-outs, and there are no bars on the screen to trust. Fixed to "It takes the
   win too" and "The win is still the answer here". Re-measured over the 6 rule questions: 3 of each
   branch, 0 mentions of the measurement; on 6 ordinary questions from the shipped pack the original
   wording is unchanged and the bars and Challenge are still there.

**Not checked:** a real phone; dark mode; the Spot screen's own workflows; the three shipped packs
with the rule baked in, because they have not been rebuilt yet — the rule questions above came from a
test pack built from the same run; the Challenge button on a rule question beyond its absence.

### The direct money test of the judge's win verdicts (experiment tool only, no app change) — Thu Sep 17 17:42:26 +08 2026

The change was one measurement tool, `datagen/src/judgewin.ts`. Nothing the app runs changed.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | not run — no screen changed | not run — no app change |
| 2 | Errors | All six logs ended with a result line; no deal reported unfinished | 0 |
| 3 | Links | not run — no screen changed | not run — no app change |
| 4 | Workflow steps | The chain wrote `judgewin.done`; six runs of 8,000 paired deals each | 0 |
| 5 | Writes | not run — the tool writes its own logs only | not run — no app data |
| 6 | The data it moves | With the judge forced to take every win, the hand-driven loop returned +0.000 +/- 0.000 against the Coach over 60 paired deals, 16 offers judged | 0 |
| 7 | Reconciliation | Decline rates matched the earlier measurement at 4 Jokers (51% to 53% here, 23 of 50 earlier) | 0 |
| 8 | Access | not run — no access control exists | not run — no access control exists |
| 9 | Width | not run — no screen changed | not run — no app change |
| 10 | Look at it | Read all six logs; the tables in `PROTOTYPE.md` and `FINDINGS.md` were copied from them | 0 |

**Defects found:** none.

**Not checked:** any population between the two fields; real players.

### The Pong money test (experiment tools only, no app change) — Thu Sep 17 15:57:35 +08 2026

The change was two measurement tools in `datagen/`, `coachgrade.ts --select pong` and `pongmoney.ts`.
Nothing the app runs was changed.

**Test boundary**

- Workflows: none in the app.
- Screens: none.
- Access restrictions: none.
- Values, records and calculations: the tools' outputs, and that they pair correctly.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | not run — no screen changed | not run — no app change |
| 2 | Errors | The stage one output held 600 rows and 0 errors; all six stage two logs ended with a result line | 0 |
| 3 | Links | not run — no screen changed | not run — no app change |
| 4 | Workflow steps | Both stages ran to their end: `pongmoney.done` written at 02:43 | 0 |
| 5 | Writes | not run — the tools write their own logs only | not run — no app data |
| 6 | The data it moves | At a Pong bar of 0.4 the money harness returned +0.000 +/- 0.000 against the shipped Coach, with Pongs called 139 and 139 against Coaches and 143 and 143 against the recorded players, over 240 paired deals each | 0 |
| 7 | Reconciliation | Stage one's simple-bot arm agreed with the pack on 594 of 600, which reconciles the rebuilt positions with the pack | 0 |
| 8 | Access | not run — no access control exists | not run — no access control exists |
| 9 | Width | not run — no screen changed | not run — no app change |
| 10 | Look at it | Read all six stage two logs and the stage one summary; the table in `FINDINGS.md` was copied from those numbers | 0 |

**Defects found:** none.

**Not checked:** a rule aimed at the flipped positions; Chow decisions.

### The Coach reads danger from the no-Joker table at 0 Jokers — Thu Sep 17 00:21:33 +08 2026

Passes run on the prototype build served from the project root, plus solver checks run in Node on
the exact functions the app calls. No code changed during them. Finished Thu Sep 17 00:23:37 +08 2026.

**Test boundary**

- Workflows: playing a whole hand in Play at 0 Jokers and at 4 Jokers; judging a Play decision;
  answering Train positions on the 0-Joker and 4-Joker min-1 packs; Your hand; Review; Table setup's
  Joker switch.
- Screens: Play, Train, Review, Your hand, Table setup.
- Access restrictions: none; the app has no accounts.
- Values, records and calculations: the danger table the Coach reads at each Joker count; the Coach's
  throw; `mahjong.money.config` jokers.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded at 1280px on Play: "at your table: 0 Jokers, 1 Tai minimum" | 0 |
| 2 | Errors | Page error and unhandled-rejection listeners through every workflow below | 0 |
| 3 | Links | Deal, Pass, Carry on, Skip to my turn, tile throws, Judge, Play another hand, Abandon in Play; the Table setup Joker box ticked and unticked; the 4-Joker min-1 pack button on Train | 0 |
| 4 | Workflow steps | A 0-Joker hand in Play ran to its end (52 turns, won on a throw, 4 Tai) with the Coaches reading the no-Joker table, and one decision judged ("Compared 6 of 12 legal tiles: yours and the 5 the Coach liked best"). A 4-Joker hand ran to its end (44 turns, self-draw, 3 Tai). Train showed the Coach block on both packs; Your hand gave "Throw 1萬, or 9萬, equally good" on a built hand | 0 |
| 5 | Writes | The Joker box saved jokers 4 when ticked and 0 when unticked, and Play's table line followed it | 0 |
| 6 | The data it moves | In Node on the functions the app calls: `readsFor(0)` returned the no-Joker table and `readsFor(4)` the shipped one. The baked table held all 144 cells of the measured file, largest rounding difference 0.413%. A late fresh middle tile's deal-in chance read 0.0875 against 0.0173. The Coach's throw changed on 136 of 1,177 0-Joker pack discards (123 of 833 late) and on 0 of 931 4-Joker pack discards | 0 |
| 7 | Reconciliation | Agreement with the measured best on 2,001 0-Joker discards: 60% before, 60% after; hard questions 43% before, 46% after | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train, Play (before and after a deal), Review, Your hand and Table setup at 280 and 390px, and 1280px from the play-throughs: page width within the screen on all 11 at phone widths | 0 |
| 10 | Look at it | Screenshot of Play at 390px mid-hand at 0 Jokers: table, prompt and hand read correctly | 0 |

**Defects found:** none.

**Not checked:** a money run on the baked table itself; the +0.215 chips a game was measured on the
same table read from its JSON file, and the baked copy differs by rounding of at most 0.413%. The
Film room, whose recorded runs are 4-Joker games and keep the shipped table. A real phone; dark mode.

### Your sets on the felt, empty felt kept for bare seats, and the question card reordered — Thu Sep 17 00:08:45 +08 2026

Passes run on the prototype build served from the project root. Code changed once during them: the
gap before the comma on the pack buttons (pass 10). The passes it could affect were run again.
Finished Thu Sep 17 00:12:52 +08 2026.

**Test boundary**

- Workflows: answering Train positions; dealing and playing in Play; the pack buttons.
- Screens: Train and Play, and Spot, Review and the Film room, which draw the same table.
- Access restrictions: none; the app has no accounts.
- Values, records and calculations: the space kept for a seat with nothing shown; which tiles sit at
  your seat on the felt; the order of the question card.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded at 1280px; Train rendered with no "Your Bonus Tiles" or "Your Melds" in the card | 0 |
| 2 | Errors | Page error listener through every workflow below | 0 |
| 3 | Links | 3 pack buttons pressed with `clickOne` on exact labels, each became selected; Pass, Chow and tile answers and Next position on Train; Deal and Abandon six times in Play | 0 |
| 4 | Workflow steps | Train card text in order: question at 22, "IN YOUR HAND" at 31, buttons, "Seat" at 66. Play offered "Pong or pass?" with Pong and Pass buttons | 0 |
| 5 | Writes | not run — nothing the change touches is saved | not run — no stored value involved |
| 6 | The data it moves | An empty seat reserved 50px at 1280 and 30px at 390; a turned tile's long edge measured 50px and 30px at those widths. Your seat on the felt held 0 to 13 tiles across 31 positions and deals, where it always held 0 before | 0 |
| 7 | Reconciliation | not run — the tiles at your seat were not compared with the engine's own count, which the page does not expose | not checked — no second source on the page |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train, Play (before and after a deal), Spot, Review and Film room at 280, 390 and 1280px: page width within the screen on all 18 | 0 |
| 10 | Look at it | Screenshots of Play and Train at 390px. Your flowers and sets sat below the pile on the felt; the Train card read question, hand, buttons, then "Seat 4, you are 東". The pack buttons read "4 Jokers , min 2 Tai" with a 4.0px gap before the comma | 1 |

**Defects found:**

1. Pass 10, fixed: a 4.0px gap sat between "Jokers" and its comma on the pack buttons, because the
   button spaces its children and the word and the comma were separate children. Fixed by putting the
   label in one span. Re-ran passes 1, 2, 3, 9 and 10 on Train: gap 0 on all three buttons, each still
   selectable, 390 of 390 wide, screenshot read "4 Jokers, min 2 Tai".

**Not checked:** Spot and the made-up hand, which still list your flowers and sets in the question
card rather than on the felt; a real phone; dark mode. The table is still wider than its card at 390px
on a late position, which is open as `Q-002`.

### Middle dots removed from the app — Thu Sep 17 00:02:26 +08 2026

Passes run on the prototype build served from the project root. No code changed during them.
Finished Thu Sep 17 00:05:37 +08 2026.

**Test boundary**

- Workflows: answering a Train discard and reading the Coach's reasons; the Film room list, a hand,
  and an evaluated decision; Spot; Tips; Review; playing a hand in Play and judging a decision; the
  made-up hand; building a hand in Your hand; Table setup.
- Screens: all eight tabs.
- Access restrictions: none; the app has no accounts.
- Values, records and calculations: every piece of text that used to be joined with a middle dot.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded at 1280px; every tab opened | 0 |
| 2 | Errors | Page error listener across every screen and workflow below | 0 |
| 3 | Links | 8 tabs opened by address; Film room hand opened, stepped with next, closed with All hands; Play Deal, Judge, Play another hand, Abandon; Your hand picker pressed 14 times | 0 |
| 4 | Workflow steps | Train discard answered; a Play hand played to its end (61 turns, 21 decisions) and one decision judged; a 14-tile hand built in Your hand; a made-up hand dealt and answered | 0 |
| 5 | Writes | not run — nothing the change touches is saved | not run — no stored value involved |
| 6 | The data it moves | not run — the change is words and separators | not run — no value moved |
| 7 | Reconciliation | not run — no two figures were changed that could disagree | not run — nothing to compare |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | All 8 tabs at 280, 390 and 1280px: page width within the screen on all 24 | 0 |
| 10 | Look at it | Page text read on every screen: middle dots 0 on each, and 0 matches for ", ,", " .", ",." or doubled full stops. Built file: 0 middle dots. Lines read: "Seat 4, you are 東", "4 Jokers, min 2 Tai", "min1-nowild / 1782:23:59", "Given up $3.77, streak 0", "Why 6條: Single — needs 2 more, and neighbours do not help in a pong hand. One is already on the floor — safer to follow.", "東圈, dealer 東", "decision 1/17, 第1巡", "win 25%, in 6%", "Ting Pai, 11 tiles improve it, from 3 kinds", "1 judged, 1 mistake", "東 won, you −$16", "Breaks your only pair. Middle tile with neighbours — flexible.", "a made-up hand, marked by the Coach", "第11巡, late game", "Streak 0" | 0 |

**Defects found:** none.

**Not checked:** screenshots, because the browser pane was hidden; the Spot tally line, which only
appears once a Spot session has causes recorded; dark mode.

### A claim names its choices: "Pong or pass?" instead of "claim or pass?" — Wed Sep 16 23:31:52 +08 2026

Passes run on the prototype build served from the project root. No code changed during them.
Finished Wed Sep 16 23:34:10 +08 2026.

**Test boundary**

- Workflows: a claim question on Train; a claim decision stepped to in the Film room; a claim offered
  while playing a hand in Play.
- Screens: Train, Film room, Play.
- Access restrictions: none; the app has no accounts.
- Values, records and calculations: the words in each claim question against the buttons or legal
  actions actually offered.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded at 390px; a Train claim question rendered its title | 0 |
| 2 | Errors | Page error listener through all three screens | 0 |
| 3 | Links | The claim filter pressed with `clickOne`; Pass pressed on 20 Train questions and 3 Play offers; Film room next pressed through a hand; Abandon and All hands pressed | 0 |
| 4 | Workflow steps | `claimQuestion` on 6 choice sets gave the expected words on 6 of 6, including three choices ("*Pong*, *Chow* or pass?") and a win with a Kong. Train: 20 claim titles, every one naming exactly the buttons offered, 0 still saying "claim or pass". Film room: 3 claim decisions titled "Chow or pass?", "Pong or pass?" and "Win or pass?", each matching its legal list. Play: 3 offers titled "Chow or pass?", each matching its buttons | 0 |
| 5 | Writes | not run — nothing the change touches is saved | not run — no stored value involved |
| 6 | The data it moves | not run — the change is words; which actions are offered was not changed | not run — no value moved |
| 7 | Reconciliation | The words and the buttons compared on 26 claims across the three screens: 26 agreed | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train at 280, 320, 375, 390 and 1280px with a claim question: page width within the screen at all 5; at 280 the title wraps to two lines and ends at 248px | 0 |
| 10 | Look at it | The title text read from the page: "北 discarded 白 — Pong or pass?". Screenshots could not be taken, because the browser pane was hidden and does not draw frames | not checked — no screenshot possible with the pane hidden |

**Defects found:** none.

**Not checked:** a screenshot of any of the three screens; a Pong or three-choice offer in Play,
where only Chow offers came up in the time run; a real phone; dark mode.

### The question count and "$" removed from the Train pack buttons — Wed Sep 16 23:29:23 +08 2026

Passes run on the prototype build served from the project root. No code changed during them.
Finished Wed Sep 16 23:30:11 +08 2026.

**Test boundary**

- Workflows: choosing a pack on Train; answering a position after choosing.
- Screens: Train.
- Access restrictions: none; the app has no accounts.
- Values, records and calculations: the three pack button labels; which pack is selected.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded at 1280px. Labels read "4 Jokers, min 2 Tai", "4 Jokers, min 1 Tai", "0 Jokers, min 1 Tai" with no number or "$" after them; the 0-Joker pack selected | 0 |
| 2 | Errors | Page error listener through the passes | 0 |
| 3 | Links | Each of the 3 pack buttons pressed with `clickOne` on its exact label: each became the selected one and served a question | 0 |
| 4 | Workflow steps | At 390px, answered the served position: the answer registered and Next position appeared | 0 |
| 5 | Writes | not run — nothing the change touches is saved | not run — no stored value involved |
| 6 | The data it moves | not run — the labels are text; which pack loads was checked in pass 3 | not run — no value moved |
| 7 | Reconciliation | not run — the count that could have disagreed with the pack index is no longer shown | not run — nothing left to compare |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train at 280, 320, 375, 390 and 1280px: page width within the screen at all 5; 0 controls under 48px at 280 | 0 |
| 10 | Look at it | Screenshots of Train at 1280 and 390px. Read the button row | 0 |

**Defects found:** none.

**Not checked:** a real phone; dark mode. The middle dots inside the button labels remain; removing
them across the app is still a separate job the owner has not asked for.

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
