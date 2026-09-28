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

## M-002 — Changing what was described instead of opening the screen and looking

**Count: 1.**

| # | When | What was claimed | What was actually true |
|---|---|---|---|
| 1 | 2026-09-16 | Told the seat name 西 was upside down, changed the opposite seat's tile rotation and said it was fixed | The fault was `rotate-180` on the left seat's name at desktop width, which one look at the screen would have shown. Changs answered "did u even look at it?". The wrong change was reverted and the real one made in `f34d847` |

**What it is.** Acting on the description of a fault rather than on the fault. The description says
where it hurts; only the screen says what is broken.

**The check built for it.** None yet, because it is not a thing a script can catch. The rule that
replaces it: when the owner reports something on screen, open that screen at that width first, and
name what was seen before changing anything.

---

## M-003 — Trusting `.click()` to press a control that listens for pointer events

**Count: 1.**

| # | When | What was claimed | What was actually true |
|---|---|---|---|
| 1 | 2026-09-26, 23:12 | A pass over the navigation called `.click()` on each of the 8 tabs and collected a result for each | At desktop width the tabs act on `pointerdown`, so not one press registered. The address stayed `#train` for all 8 and the page text was the same length every time, which is what gave it away |

**What it is.** The element was the right one. The press was not a press. A synthetic `click` event
carries no pointer sequence, and a control built on `pointerdown` ignores it, so the check reads the
screen it was already on and calls it a result.

**The check built for it.** Two rules, used for the rest of that set. Press with a full sequence -
`pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click` - and **assert the thing that should have
changed** (the address, the served question id, the stored value), never merely that a screen
rendered.

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

### A verdict explained by what the play-outs did — Tue Sep 29 01:01:58 +08 2026

Passes run on the dev server on port 5174 with the six re-judging workers paused for the browser
steps. One change: under a verdict, Train now says what the play-outs did after the best action and
after the player's, from each action's stored outcome mix.

**Test boundary**

- Workflows: answering a discard on Train and reading the verdict.
- Screens: Train.
- Access restrictions: none exist.
- Values, records and calculations: the outcome shares (won, by size; drawn; dealt in; paid) against
  the stored mix counts.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage cleared, reloaded on #train; a question served | 0 |
| 2 | Errors | `console.error` hooked on every run; the disputed question served by id and answered, twice (before and after the trim) | 0 |
| 3 | Links | The pack buttons and the tile pressed; Next position not needed | 0 |
| 4 | Workflow steps | 5375:17:65 answered 5筒: "What the play-outs did after discard 9萬: won 60% (5 Tai 33%, 3 Tai 19%, 6 Tai 6%), drawn 27%, dealt in 3%, paid a self-draw 4%, paid as a bystander 5%, another seat won at no cost 1%." and "After your discard 5筒: won 88% (3 Tai 69%, 5 Tai 11%, 4 Tai 5%), drawn 7%, dealt in 1%, paid a self-draw 1%, paid as a bystander 3%." | 1, fixed |
| 5 | Writes | not run — the change stores nothing | not run — nothing stored |
| 6 | The data it moves | The shares against the stored mix for 9萬 over 512 play-outs: wins W*+D* = 306 (60%), of which 5 Tai 168 (33%), 3 Tai 97 (19%), 6 Tai 33 (6%); d0 139 (27%); s+l 12 (2%, shown 3% by rounding of 13 with l); z 20 (4%); o 27 (5%). For 5筒: wins 449 (88%), 3 Tai 353 (69%), 5 Tai 57 (11%), 4 Tai 27 (5%); d0 35 (7%) | 0 |
| 7 | Reconciliation | The shares explain the bars: 9萬 finishes as a 5-Tai hand a third of the time and 5筒 as a 3-Tai hand two thirds of the time, which is the $22.00 against $17.47 on the same screen | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train with the block on screen at 280px: page width equal to the screen, 0 elements past the edge outside a scroller | 0 |
| 10 | Look at it | Both sentences read in full, as above | 0 |

**Defects found:**

1. Pass 4, fixed: a share that rounds to 0% was still listed ("another seat won at no cost 0%").
   Fixed by leaving any share under half a percent unsaid; re-measured: the 5筒 line ends at "paid
   as a bystander 3%".

**Not checked:** a real phone; 320, 375, 390 and 1280px on this change, two wrapped lines; a claim
question, where the same block appears with the call's outcomes.

### The Coach in every chair of the app's own play-outs, and the judge named on each question — Mon Sep 28 19:57:03 +08 2026

Passes run on the dev server on port 5174 with the six pack re-judging workers paused (`kill -STOP`)
for the browser-driven steps and resumed after. One design change made inside the set after a
measurement: the Play judge's budget.

**Test boundary**

- Workflows: the Challenge button on Train; a Play hand's review and one judged decision; the line
  on Train saying which judge a question rests on.
- Screens: Train, Play.
- Access restrictions: none exist.
- Values, records and calculations: the play-outs' policy in the worker; the Challenge outcome on
  the disputed question 3349:11:51; the Play judge's time and words; the judge line's text.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage cleared, reloaded on #train: a question served, the judge line under it | 0 |
| 2 | Errors | `console.error` hooked on every run: the Challenge, two Play hands with a judged decision each, the width checks | 0 |
| 3 | Links | The Challenge button, Deal, Skip to my turn, Judge: each did what it names | 0 |
| 4 | Workflow steps | The disputed question served by id and answered 5筒: "Big mistake" from the pack bars, the line "Judged by simple bots; this pack is being re-judged with the Coach.", the button "Challenge the verdict (512 fresh play-outs, the Coach in every chair)". Challenged: 15.2 seconds, "Holds: on fresh play-outs your discard 5筒 is still $3.28 worse than discard 7筒 (about ±$1.01)", "discard 7筒 $19.79, discard 5筒 $16.51". Play: a turn-5 discard judged at the first budget, 224 of 1,536 play-outs after 38 seconds; at the new budget, 44.8 seconds, "Too close to call", "Compared 3 of 13 legal tiles: yours and the 2 the Coach liked best" | 1, fixed |
| 5 | Writes | The judged Play verdict counted "1 judged, 0 mistakes" in the tally; nothing new is stored by this change | 0 |
| 6 | The data it moves | The worker's play-outs run the Coach when asked: the Challenge on the disputed position took 15.2 seconds for 1,024 play-outs where the simple bots' Challenge on the same position took about 2, and its figures ($19.79 against $16.51) sit beside the Node re-judging's 18.13 against 16.86 in pack chips | 0 |
| 7 | Reconciliation | The Challenge's gap $3.28 +/- $1.01 in the table's money against the Node run's 1.27 in pack chips: the app prices the pack's 18.19 as $24.08, so $3.28 is about 2.5 chips; the two Coach-judged samples agree in direction and differ by 1.2 on a standard error of 1.4 for the difference | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train with the judge line and Play's review at 280px: page width equal to the screen, 0 elements past the edge outside a scroller | 0 |
| 10 | Look at it | The Challenge outcome, the judge line, the Play words ("Every judgement here is by strong play: the Coach sits in all four chairs of the play-outs. That makes an early decision slow, about a minute on a laptop and several on a phone...") read as text | 0 |

**Defects found:**

1. Pass 4, fixed: the Play judge with the Coach at 256 play-outs over six actions ran 6 play-outs a
   second from a turn-2 decision, over four minutes a decision on the Mac and far longer on a phone.
   Expected: a judgement a person waits for. Fixed by judging the thrown tile plus the Coach's two
   favourites at 128 each, and saying so on screen. Re-measured on a turn-5 decision: 44.8 seconds,
   the words naming the three tiles compared.

**Not checked:** a real phone, where the Coach's play-outs are several times slower again; the
Challenge on a claim or a self decision; dark mode; 320, 375, 390 and 1280px on this change, which
adds one short line and changes one paragraph.

### The strong-table pack regenerated with the new Coach, on the site — Mon Sep 28 16:41:44 +08 2026

Passes run on the dev server on port 5174 after the regenerated pack replaced the first one in
`web/public/quiz/strong-nowild/` and the top index was updated. The change is data plus one builder
line, so the boundary is the pack itself.

**Test boundary**

- Workflows: choosing the strong-table pack on Train and answering from it.
- Screens: Train.
- Access restrictions: none exist.
- Values, records and calculations: the pack's counts in the top index, the per-pack index and the
  shard files; the rule mark on every win offer; the label.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded on #train: four pack buttons, the default still the weak-bot 0-Joker pack, `mj.hard.v1` = "1", a question on screen | 0 |
| 2 | Errors | `console.error` hooked from the first line; the pack selected, 5 questions answered, one width | 0 |
| 3 | Links | The strong-table button, exactly one match, pressed once; the questions after it carried the id prefix `strong-nowild /`; Next position served the next each time | 0 |
| 4 | Workflow steps | 5 questions answered with hard only on (4127:13:59, 2468:4:39, 4383:7:74, 4603:19:56, 1027:15:19): 3 best, 2 big mistakes, the Coach line on every one | 0 |
| 5 | Writes | not run — the change stores nothing new | not run — nothing stored |
| 6 | The data it moves | 10,751 questions counted in the shards; 1,246 offer a win and all 1,246 carry the rule; 0 of 108 shard tallies disagree with their files; the play-outs preferred otherwise on 156 of the marked, counted in Node | 0 |
| 7 | Reconciliation | Top index 10,751 questions, 108 shards, players strong; per-pack index the same three; shards the same count | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train with the strong pack selected at 280px: page width equal to the screen, 0 elements past the edge outside a scroller; the button 231 by 48px, wrapped to two lines and selected | 0 |
| 10 | Look at it | The four labels read as text; the five Coach lines read ("The Coach would discard 9筒. The measurement disagrees...", "The Coach would pong. Agrees with the measurement.") | 0 |

**Defects found:** none in the pack. One in the builder, found by pass 7 before the copy: the top
index the builder writes did not carry `players`, because the edit that was meant to add it had
failed on an earlier assertion and was never re-run. Fixed and typechecked; the site's top index was
written by hand for this copy, as for the first strong pack.

**Not checked:** a real phone; 320, 375, 390 and 1280px on this change, which alters no layout; a
screenshot, the browser pane being hidden; the pack's questions in the Play or Review screens.

### The fitted claim model inside the Coach's claim rule — Mon Sep 28 06:03:11 +08 2026

Passes run on the built app served statically on port 5175 while the strong-table grader held the
Mac (load average about 100, so every screen was slow and the Train walk was cut short). The change
is one function: `claimAdvice` now returns the model's call and keeps the Coach's gains and reasons
as the explanation; `CoachBot` ranks a Kong with the rest instead of taking it on sight; Your hand
says when the model and the Coach's numbers differ.

**Test boundary**

- Workflows: a claim question on Train; a call on Your hand with a Pong or a Chow on offer, from the
  left and from elsewhere; the Coach's opponents in Play, which call through the same function.
- Screens: Train, Your hand.
- Access restrictions: none exist.
- Values, records and calculations: the call the Coach names; the note when it differs from the
  Coach's own numbers; `claimAdvice` with `fitted: false` giving the old rule.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Reloaded on #train with storage kept from the session passes, then #ask; both rendered, Your hand with its 46 tile pickers | 0 |
| 2 | Errors | `console.error` hooked on every run: 2 Train claim questions, 4 hands built on Your hand with 5 calls read, 2 widths | 0 |
| 3 | Links | claim filter, Next position, clear, thrown tile, remove, from 上家, from anyone else: each did what it names | 0 |
| 4 | Workflow steps | Your hand, a 2萬 pair with 2萬 thrown: "Pass." with the Coach's gains −3.4 and −3.0. 3條4條 with 5條 thrown from the left: "Pass."; from anyone else: no Chow offered, "You cannot claim it". Pack position 3088:16:24 with 發 thrown: "Take it — pong." Pack position 2843:23:8 with 5萬 thrown from the left: "Pass." and the note "The fitted claim model says so; the Coach's own numbers would chow." Train: 2 claim questions answered, the Coach line present on both ("would chow", "would pass") | 0 |
| 5 | Writes | not run — the change stores nothing | not run — nothing stored |
| 6 | The data it moves | Over the 4,644 claim questions of the 0-Joker pack that offer no win, the model and the Coach's numbers differ on 1,336 (28.8%), counted in Node with both flags of `claimAdvice` on the same positions. On Your hand the note appeared exactly on the position where they differed and not on the three where they agreed | 0 |
| 7 | Reconciliation | The harness's own claim bot against the shipped Coach on 8,000 paired deals must be exactly 0.000: running, `data/gen/coach2/identity-claims.log`, result recorded in `PROTOTYPE.md` when in | not checked — running |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Your hand with the note on screen at 280px: page width equal to the screen; 3 elements past the edge before the fix (the card header's two source buttons, 63px over), 0 after, measured with the grader paused so the screen could be driven | 1, fixed |
| 10 | Look at it | The four calls above read as text; the note's sentence read in full | 0 |

**Defects found:**

1. Pass 9, fixed: on Your hand the "from 上家 (before you)" and "from anyone else" buttons sat in a
   row that did not wrap and ran 63px past a 280px screen. Older than this change, found by it.
   Fixed by letting the row wrap; re-measured with the note on screen: 0 past the edge.

**Not checked:** the identity check (running, and recorded separately); a real phone; 320, 375, 390
and 1280px on the note, one wrapped line; the Play tab's opponents calling, which go through the
same function but were not watched hand by hand; more than two Train claim questions, because the
loaded machine made each one take half a minute.

### A session on the Play tab: hands in a row, the dealer moving, chips carried — Mon Sep 28 03:02:33 +08 2026

Passes run on the built app served statically on port 5175, the hands played by a script that
chooses the Coach's tile and takes any win, so a hand takes seconds. One defect found inside the
set and fixed; the passes it touched were run again on the rebuilt app.

**Test boundary**

- Workflows: Deal, the hand, the review's Next hand and End the session, the summary, Start a new
  session, a reload mid-session.
- Screens: Play (table, review, summary, nothing dealt).
- Access restrictions: none exist.
- Values, records and calculations: the dealer after each hand, the prevailing wind after four
  passes, the session chips, the hands won and fed counts, `mj.session.v1` in sessionStorage.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Session storage cleared, reloaded on #play: "Deal" and no session line. Reloaded with a stored session: "A session is in progress: 3 hands played, you $0. Next: 東圈, you are 南." with Next hand and End the session | 0 |
| 2 | Errors | `console.error` hooked on every run: 6 hands played through the session, one decision judged, the summary opened, a new session started | 0 |
| 3 | Links | Deal, Next hand (twice), End the session, Back, Start a new session, the summary's judged-decision link; each led where it says | 0 |
| 4 | Workflow steps | Hand 1 (dealer 1, 東圈, 西 self-drew) passed the deal to 2; hand 2 (南 won on my throw) passed it to 3; the strips read "hand 1, 東圈, session $0" and "hand 2, 東圈, session −$7"; the review lines "Session: hand 2, you −$13 so far. Next: 東圈, you are 南." A stored session at three passes followed by a fourth non-dealer win read "Next: 南圈, you are 東 and you deal" | 0 |
| 5 | Writes | `mj.session.v1` after hand 1 held dealer 2, passes 1, chips [−7, −7, 1, 13]; still there after a reload; after the fourth pass dealer 0, passes 4, prevailingWind 1; Start a new session removed it | 0 |
| 6 | The data it moves | Chips carried: −$7 then −$13 for me across two hands, the stored total equal to the sum of the two hands' deltas; the dealer moved 1, 2, 3 on three non-dealer wins and the wind turned only on the fourth pass | 0 |
| 7 | Reconciliation | The strip, the review line and the stored session agreed on the hand number, the wind and my chips at every step. The summary's "fed 2" disagreed with the two hands, one of which was a self-draw nobody fed (defect 1); after the fix the count reads the discarder | 1, fixed |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | The review with the session line and buttons at 280 and 390px: page width equal to the screen, 0 elements past the edge outside a scroller | 0 |
| 10 | Look at it | Screenshot at 390px of the review: the session line ending "東 and you deal.", the buttons Next hand, End the session, Judge all 14 unjudged, and the decision rows with their drawn tile marked. The summary read: "Session: 2 hands", "You won 0 of 2, fed 2", "26 decisions, 1 judged, 0 mistakes", "chips: you −$13, 東 −$1, 南 $1, 西 $13", "Nothing judged was a mistake." | 0 |

**Defects found:**

1. Pass 7, fixed: "fed" counted every hand I paid for, including a self-draw. Expected: only hands
   my own throw gave away. Fixed by keeping the discarder on each session hand and counting on it.
   Rebuilt and re-measured on the stored three-pass session: 0 errors, the wind turn and the summary
   unchanged otherwise.

**Not checked:** a real phone; dark mode; 320, 375 and 1280px on the session screens (the only new
layout is one line of text and two buttons, measured at 280 and 390); a session across a day, which
by design is not kept; the summary's costly list with more than one judged mistake.

### Candidate B inside the Coach, the Play review's win rule both ways, and friends' records — Mon Sep 28 02:50:53 +08 2026

Three app changes in one set, because they were built together while the money runs held the Mac:
the fitted discard policy inside `rankDiscards` (`D-035`), the Play review answering a win on offer
by the rule in both directions, and the "Send my record" and "Friends' records" additions to Table
setup (`A-007`). The Play passes ran on the built app served statically on port 5175, because a
source edit hot-reloads the dev server and wiped a hand in progress twice; the Table setup passes
ran on the dev server on port 5174. Two defects found inside the set, both fixed and re-measured.

**Test boundary**

- Workflows: answering on Train; the Coach's line and plan text on Train, Review and Your hand; a
  whole hand on Play, its review and its earlier-hands list; export, send, restore and a friend's
  record on Table setup.
- Screens: Train, Review, Your hand, Play, Table setup.
- Access restrictions: none exist.
- Values, records and calculations: which tile the Coach names and why; the Play verdict on a
  taken and on a declined win and the two tallies that count them; `mj.friends.v1`; the player's
  own record staying untouched by a friend's file.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage cleared on both servers, reloaded on #table and on #play. Table setup showed the four record buttons and the Friends' records card; Play showed Deal | 0 |
| 2 | Errors | `console.error` hooked on every run: 12 Train discards, Review and Your hand opened, 6 whole hands on Play with two judged decisions, every Table setup action below | 0 |
| 3 | Links | Save my record, Send my record, Restore from a file, Add a friend's record, Remove; Deal, Skip to my turn, Judge, Play another hand; the Train filters. Each did what it names | 0 |
| 4 | Workflow steps | Send on a desktop browser fell back to the download and said so. Add a friend's record refused with no name (button disabled) and with a file that is not JSON ("Not added — that file is not JSON."), and read a good file in as "Wei: 4 hands played, 3 mistakes". Play: a win declined at a claim window read "Mistake — Take the win. Declining costs a fifth to a half a chip a game against strong players, whatever the play-outs say about Pong." with the bars "Pong $6.72, win $6, pass $1.45 (you)"; a self-drawn win taken read "Best — Right. A win on offer is taken; the play-outs are not asked." | 1, fixed |
| 5 | Writes | `mj.friends.v1` held Wei after a reload, byte for byte; Remove emptied it. The player's own `mj.mistakes.v1` stayed null after the friend's file was read in. The Play hand log kept both judged verdicts across a reload | 0 |
| 6 | The data it moves | The friends row read Wei, 4, 3 (2 sorted), 12, Miscounted, 20/09/2026, from a file holding 4 hands, 3 mistakes with 2 sorted under miscounted, and 12 Spot answers. On Train the plan line "the fitted policy throws ..." appeared on 2 of 12 discards, which is the fitted Coach overriding its own numbers inside a cheap plan | 0 |
| 7 | Reconciliation | The finished-hand tally read "2 judged, 1 mistake" after the declined win was judged, and the earlier-hands list for the same hand read "2 of 19 judged, 0 mistakes" — the two disagreed (defect 2). After the fix, "2 of 19 judged, 1 mistake" on the same stored hand | 1, fixed |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Table setup at 280px with the friends row present: page width equal to the screen, 14 elements past the edge before the fix (the friends table), 2 after, both the pre-existing "Doubling to 10 tai" preset buttons, 8px over. At 390px with no row: 0. Play's review at the pane's own width: read in the screenshot | 1, fixed |
| 10 | Look at it | Screenshot of the Play review after a taken win: "turn 38 After the draw: Win", the green "Best", "Right. A win on offer is taken; the play-outs are not asked.", "256 play-outs each, 0.1s. Compared 2 of 2 legal actions. win $21 (you), carry on $13.69.", and the earlier-hands list with its dates and counts | 0 |

**Defects found:**

1. Pass 9, fixed: the friends table was 462px wide at 280px and was cut off, not scrollable. Fixed
   by putting it in a scrolling container like the money table. Re-measured: 0 elements of that
   card past the edge.
2. Pass 7, fixed: the earlier-hands list counted only `mistake`, so a declined win judged a mistake
   by the rule showed as "0 mistakes" beside a tally that said 1. Fixed to count `winDeclined`
   too. Re-measured on the same stored hand after a rebuild: "2 of 19 judged, 1 mistake".

**Not checked:** a real phone, and the share sheet itself, which no desktop browser offers; dark
mode; 320 and 375px; the friends row at 390px, which lives on the other server's storage; the
Spot and Film room screens; the Coach's line on a rule question of a shipped pack.

### The strong-table pack on the site as a fourth pack — Sun Sep 27 23:48:10 +08 2026

Passes run against the dev server on port 5174, the pack copied from `data/gen/strong-quiz/` into
`web/public/quiz/strong-nowild/` and listed in the top index with `players: 'strong'`. The money test
of candidate A was running on the Mac at the same time; it is single-threaded and did not touch the
site.

**Test boundary**

- Workflows: choosing a pack on Train, answering questions from the new pack.
- Screens: Train.
- Access restrictions: none exist.
- Values, records and calculations: the pack list and its labels, the new pack's index against its
  shards, the default pack.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage and caches cleared, reloaded. Four pack buttons: "4 Jokers, min 2 Tai", "4 Jokers, min 1 Tai", "0 Jokers, min 1 Tai", "0 Jokers, min 1 Tai, strong table". The default was still the weak-bot 0-Joker pack, `mj.hard.v1` = "1", a question on screen | 0 |
| 2 | Errors | `console.error` hooked from the first line; pack selected, 5 questions answered, two widths | 0 |
| 3 | Links | The strong-table button, pressed once: exactly one control matched, and the questions that followed carried the id prefix `strong-nowild /` | 0 |
| 4 | Workflow steps | 5 questions answered from the new pack with hard only on (5:22:27, 1572:3:35, 2955:11:26, 1090:11:72, 6473:5:40): 2 best, 3 big mistakes, Next position served the next each time | 0 |
| 5 | Writes | not run — the change stores nothing new; the pack choice is not persisted, which is how the tab already worked | not run — nothing stored |
| 6 | The data it moves | The new pack's index against its shard files: 10,652 in 107 shards, counted in Node on 2026-09-27 15:56 (see the previous set); 1,198 questions offer a win and all 1,198 carry the rule | 0 |
| 7 | Reconciliation | The top index lists 10,547, 10,528, 10,291 and 10,652, the same numbers as the four per-pack indexes | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train at 280 and 390px with the new pack selected: page scroll width equal to the screen at both, 0 elements past the right edge outside a scroller. The longer button wraps to two lines at 280px, 231 by 48px | 0 |
| 10 | Look at it | Screenshot at 390px, read: the four labels above, the strong-table button selected in dark green with its words readable, "hard only" pressed, a 南圈 第9巡 position with three seats showing exposed sets, "Which tile do you discard?". The right seat's "dealer" badge is cut at the felt's edge on this late position, which `Q-002` already records | 0 |

**Defects found:** none new. The clipped badge is `Q-002`, open since 2026-09-16.

**Not checked:** a real phone; 320, 375 and 1280px on this change (the only change to the layout is
one longer button label, measured at 280 and 390); the Spot, Review and Play screens, which do not
read the pack list.

### The three packs rebuilt with the win rule, on the site — Sun Sep 27 23:27:47 +08 2026

Passes run against the dev server on port 5174 serving the rebuilt packs from `web/public/quiz`, no
test pack and no patched `fetch`: every question below came from a real shard. One defect was found
and fixed inside the set; the passes it could affect were run again on the fixed build.

**Test boundary**

- Workflows: answering a Train question of every kind (discard, claim, self), the pack, mode and
  hard-only filters, the hand log and the mistake record, the Review screen's counts.
- Screens: Train, Review.
- Access restrictions: none exist.
- Values, records and calculations: the rule mark and `best` on every rebuilt question, the pack
  index tallies against the shard files, the session tally, `mj.history.v1`, `mj.mistakes.v1`.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Storage, caches and IndexedDB cleared, reloaded. Train opened on "0 Jokers, min 1 Tai" with `mj.hard.v1` = "1", served a question, 0 matches for NaN or undefined | 0 |
| 2 | Errors | `console.error` hooked from the first line of every run; 3 walks totalling about 40 answered questions across the modes, the Review screen, and 3 reloads | 0 |
| 3 | Links | discard, claim, hard only, Next position and the Review tab, pressed with a full pointer sequence (`M-003`); each changed the address or the question. The pack buttons and the rest of the navigation were checked in the 2026-09-26 sets and the code behind them did not change | 0 |
| 4 | Workflow steps | 6 rule questions answered from the real 0-Joker pack, 3 taken and 3 declined, including one self-draw win declined: each Win read "Best move" and "Right. A win on offer is taken.", each decline "Mistake" and "Take the win...", 0 money bars, the paragraph shown, no Challenge button, the streak reset to 0 on each decline. A plain Kong question still read "Kong, or keep the hand as it is?" over "Kong" and "No kong" | 1, fixed |
| 5 | Writes | 3 discards answered (2 big mistakes, 1 best): `mj.history.v1` 3 entries and `mj.mistakes.v1` 2 entries, still 3 and 2 after a reload, "Given up $5.94" | 0 |
| 6 | The data it moves | Every question that offers a win in the three packs carries `rule: 'win'`: 2,030 of 2,030, 2,332 of 2,332, 1,030 of 1,030, counted in Node over the shard files. On 814, 1,217 and 153 the play-outs preferred passing and the rule overrode them. Before the rebuild the same packs answered "decline" on 790, 1,179 and 130. "Given up" moved by $0.00 across all 6 rule declines | 0 |
| 7 | Reconciliation | Index tallies against shard files: 10,547, 10,528 and 10,291, 0 mismatched shards in 315. Session tally after the walks read best 59, mistake 6, blunder 0, Given up $0.00: six mistakes and no money means all six were rule declines, which is what was answered. Review read "Hands you have played 3" and "not sorted yet 2" against 3 and 2 in storage | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train with a rule question answered at 280, 390 and 1280px: page scroll width equal to the screen at all three (1265 of 1280 at desktop), 0 elements past the right edge outside a deliberate scroller | 0 |
| 10 | Look at it | Screenshot of the verdict block at 390px, read line by line: "Mistake", "Take the win. Declining costs a fifth to a half a chip a game against strong players.", "the pong bot chose win", "The Coach would win. It takes the win too.", "Coach reads this as all-pong.", the paragraph, "min1-nowild / 2241:0:48", "best 59", "mistake 6", "Given up $0.00, streak 0" | 0 |

**Defects found:**

1. Pass 4, fixed: a self-draw question with a win on offer was headed "Kong, or keep the hand as it
   is?" over the choices "Win" and "No kong". Expected: the question names the choices. Fixed with a
   heading built from the actions ("Win, or play on?", or "Win, Kong, or keep the hand as it is?")
   and "Play on" for the decline when a win is offered. Re-measured on 5479:31:59: "Win, or play on?"
   over "Win" and "Play on", declining read "Mistake" and "Take the win..."; a plain Kong question
   still read "Kong, or keep the hand as it is?" over "Kong" and "No kong". Passes 2, 4, 9 and 10 run
   again after it.

**Not checked:** a real phone; dark mode; 320 and 375px, which were measured on 2026-09-26 on the
same layout with no change since; Spot, Play, Film room and Table setup, which the change does not
touch; the `coach` and `min1` packs in the browser, which were counted in Node but not walked.

### The Coach line shows the Coach that plays, and the shard walk stops cascading — Sat Sep 26 23:20:45 +08 2026

Passes run against the dev server on port 5174, on the working tree, after the win-rule commit
`f42068a`. Three defects were found and fixed inside the set; every result below is from the final
build. Where a harness was needed it is named, and its artefacts are separated from the app's
behaviour.

**Test boundary**

- Workflows: answering a Train question, the pack, mode and hard-only filters, the shard walk behind
  them, navigation to every screen.
- Screens: Train, and the seven screens reachable from its navigation.
- Access restrictions: none exist.
- Values, records and calculations: the Coach's pick shown beside a question, `mj.hard.v1`,
  `mj.history.v1`, `mj.mistakes.v1`, and the pack question ids served.

| Pass | Dimension | What was done | Found |
|---|---|---|---|
| 1 | Cold start | Local storage, session storage, caches and IndexedDB cleared, reloaded. Train opened on "0 Jokers, min 1 Tai" with `mj.hard.v1` = "1", served a question, 0 matches for NaN or undefined | 0 |
| 2 | Errors | `console.error` hooked from the first line of every run. 10 questions answered across the three packs and the three modes, 8 screens opened, every Train control pressed: 0 errors. Separately, with all 103 shards of the 0-Joker pack made empty: 0 errors and the made-up hand shown | 1, fixed and re-measured 0 |
| 3 | Links | The 3 pack buttons, all, discard, claim, hard only, reset, Next position, and all 8 navigation tabs. Each of the 8 set its own address (#train, #spot, #review, #tips, #ask, #film, #play, #table) and rendered. Pressing them needed a real pointer sequence; see `M-003` | 0 |
| 4 | Workflow steps | 10 questions answered with hard only on, 2 in each mode and 2 in each pack. 5 claim questions that offer a win, served by id through a patched `fetch`, all answered Win | 0 |
| 5 | Writes | `mj.hard.v1` written on each toggle (1 to 0 to 1) and read back after a reload; `mj.history.v1` 5 entries and `mj.mistakes.v1` 4 entries, identical before and after the reload | 0 |
| 6 | The data it moves | In the 0-Joker pack, 595 claim questions offer a win. `claimRank`, which the Train screen was using, declines the win on 278 of them; `claimAdvice`, which the Coach bot plays, declines 0. Measured in Node over the shipped shards | 1, fixed |
| 7 | Reconciliation | The five worked examples of that disagreement (2336:29:61, 4671:13:80, 4161:17:97, 4308:16:60, 3877:18:23) read "The Coach would pass" before the fix and "The Coach would win" after, which is what `claimAdvice` returns for each. 3877:18:23 still shows the amber disagreement line, correctly: its stored answer is pass and the pack has not been rebuilt with the rule | 0 |
| 8 | Access | not run — the app has no accounts or restricted actions | not run — no access control exists |
| 9 | Width | Train with a claim question answered, at 280, 320, 375, 390 and 1280px. Page scroll width equalled the screen at all five. Elements past the right edge and outside a deliberate scroller: 1 at 280px before the fix, 0 at every width after | 1, fixed |
| 10 | Look at it | Screenshots at 390px (table, question, verdict) and the verdict block read line by line: "西 discarded 2萬 — Pong or pass?", "Best move", "Measured best: worth $20.48 per hand.", "the aggressive bot chose pass", "The Coach would pong. Agrees with the measurement.", "Coach reads this as all-pong.", "Pong $20.48 win 81% best", "Pass $17.23 win 59%", "min1-nowild / 918:12:52", "Challenge the verdict (512 fresh play-outs)" | 0 |

**Defects found:**

1. Pass 6, fixed: the Train screen ran `claimRank` for claims, which is the learned softmax model,
   while the Coach that plays takes a win before it ranks anything. Expected: the line says what the
   Coach does. Actually: it declined the win on 278 of the 595 claim questions in the 0-Joker pack
   that offer one, against 0 for the Coach. Fixed by taking the win first, as `CoachBot.chooseClaim`
   does. This is the whole of `Q-013`, which is now about a display, not about the Coach.
2. Pass 2, fixed: with many shards cached and empty for the current filters, each one was marked
   through state separately, and a cached shard answers synchronously, so the walk nested more than
   fifty updates and React stopped it. Fixed by skipping cached empty shards inside one run of the
   effect, so only an uncached shard costs a round trip. Re-measured with all 103 shards empty: 0
   errors, the made-up hand shown.
3. Pass 9, fixed: at 280px the Challenge button is 305px wide and ran off the screen, where nothing
   could scroll to it. Fixed by letting its row wrap and its label wrap; it is 216 by 48px at 280px
   and back to one line at 1280px.

**A harness artefact, not a defect:** the same walk logged 2 to 3 errors when the test harness
answered every shard from `Promise.resolve`, because fifty replies then land in one microtask chain.
Answering on a task boundary, as a network or service worker does, gave 0 errors in the same test.
Said here because it would otherwise look like a fourth defect.

**Not checked:** a real phone; dark mode; the Spot and Play workflows beyond opening them; the
Coach line on a rule question in a shipped pack, because the packs have not been rebuilt yet.

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
