# SPECIFICATION

## Purpose of this file

This file is the primary specification of required system behaviour.

## It answers

*What must the system do?*

## What belongs here

Expected behaviour, described as precisely as the available information allows: scope, out of
scope, functional requirements, business rules, permissions and access, data requirements,
integrations, validations, states and transitions, exceptions, edge cases, error behaviour,
non-functional requirements, security requirements, technical constraints, acceptance criteria.
This file states what must be true.

## What does not belong here

Capability summaries go in `FEATURES.md`. User processes go in `WORKFLOWS.md`. Buildable slices
go in `USER-STORIES.md`. Unknown, assumed or conflicting behaviour goes in `OPEN-ITEMS.md`, with a
pointer left here in place. Do not invent behaviour to make the specification look complete.

## Two rules that matter most here

Prototype behaviour does not automatically become specification. Implemented behaviour does not
automatically become intended behaviour. Findings from a prototype or from existing code are
incorporated here only when deliberately accepted. Until then they are OBSERVED, not CONFIRMED.

This project was bootstrapped over a live app, so most of what follows is OBSERVED from the code
and marked as such. A rule is CONFIRMED only where a project file records Changs saying or agreeing
to it, or where it is the method itself from `../CLAUDE.md`. Each rule carries an identifier so that
stories can cite it without restating it.

## When to update

When behaviour is agreed, clarified, changed or rejected; when a decision changes what the system
must do; when prototype learning is accepted; when an open item resolves into a rule.

## Relationship to other files

`USER-JOURNEYS.md` and `WORKFLOWS.md` describe how the behaviour is experienced and performed;
this file states what must be true regardless. `FEATURES.md` groups it into capabilities;
`USER-STORIES.md` slices it into buildable work. Both reference rules here rather than restating
them. `Framework - Mahjong.md` is the training plan the app serves and is the source of most
CONFIRMED intent; `FINDINGS.md` is the measured record behind the numbers.

---

## Scope

The system is a Singapore mahjong trainer delivered as a static web app, installable on a phone and
working offline, that teaches by posing real recorded positions graded by play-outs. It carries all
five components of the training system in `../CLAUDE.md`: a pattern library (Tips), spotting
practice (Spot), working-it-out practice and mixed practice (Train), and a mistake record with
spaced review (Review) (CONFIRMED, `Framework - Mahjong.md`, "The five components, and where they
live"). It also carries a way to ask about a hand actually held (Your hand), a replay explorer (Film
room), table configuration with backup (Table setup), and a prototype game loop (Play) (OBSERVED,
`web/src/App.tsx`).

The question packs, the play-out judge, the Coach and the engine are in scope as the machinery the
app depends on; their build tooling is documented in `NEXT.md`, `FINDINGS.md` and the package
READMEs rather than here.

## Out of Scope

- Accounts, login, a server or a database. Each phone keeps its own record; the export is the bridge
  (CONFIRMED, `MOBILE.md`, "Not doing: accounts"; `NEXT.md`, "Decided, so do not reopen").
- Any further work on the player, the Coach, until something measured says otherwise. Six
  candidate improvements were played for money and none won (CONFIRMED, `PLAN.md`, "Where it
  stands").
- A Rust or WASM port (CONFIRMED, `PLAN.md`, "Open items").
- A Markdown pattern library or mistakes file beside the app; the framework says they would go stale
  against the code within a week (CONFIRMED, `Framework - Mahjong.md`).
- The full game, meaning sessions, seat rotation and a running score, until the Play loop has been
  played and its review is trusted (CONFIRMED as ordering, `NEXT.md`, item 2; PROPOSED as scope).
- Collecting friends' records on the project's machine, until a fortnight of testing says they are
  worth having (CONFIRMED deferral, `MOBILE.md`).

## Functional Requirements

### Train

- **FR-01.** The Train tab serves positions from a chosen question pack, each a real recorded
  position, and asks one of three questions: which tile to discard, claim or pass on a thrown tile,
  or kong or keep the hand (OBSERVED, `Train.tsx`).
- **FR-02.** A pack is chosen by table, and the button names the table (Jokers and minimum Tai),
  not the run it was built from (CONFIRMED, commit `0296c88`, "the pack buttons say the table";
  OBSERVED).
- **FR-03.** Questions can be limited to discards or to claims, and, outside claim mode, to
  positions whose recorded throw failed for a chosen Cause (OBSERVED). The Cause choice persists
  across reloads and is shared with the Review tab (OBSERVED, `mj.practise.v1`).
- **FR-04.** After an answer the screen shows the verdict, what the answer and the best were worth,
  every action's bar with its error whisker, the Coach's plan and reasons, the Coach's own pick with
  whether it agrees with the measurement, any shape card the position is about, the recorded seat's
  own choice, and the pack and question id (OBSERVED).
- **FR-05.** A session tally counts best, close, too close to call, mistake and blunder, the total
  given up and the streak; it lives in page state and resets on reload (OBSERVED).
- **FR-06.** When the index shows no pack, a pack will not load, or nothing in the pack fits the
  current filters, a made-up hand is dealt instead under a banner that says it is made up and that
  the Coach marks it (CONFIRMED, `NEXT.md`, "The merge"; OBSERVED).
- **FR-07.** A Challenge button re-judges the verdict on this device on fresh play-outs and reports
  holds, too close to call, or reversed (OBSERVED; CONFIRMED as intent, `FINDINGS.md`, "The
  Challenge button runs on the phone").

### Spot

- **FR-08.** The Spot tab shows a position for 3, 5 or 8 seconds, hides the table and the hand
  together, and asks one of four questions: distance from Ting Pai, the suit held most, which
  opponent has the most Melds face up, or which shape the position is about (OBSERVED, `Spot.tsx`;
  CONFIRMED as the four, framework).
- **FR-09.** Scores are kept per question kind. A miss can be sorted into one of four seeing causes,
  and once enough misses are sorted the drill suggests moving the look (OBSERVED, `spotstats.ts`;
  CONFIRMED as intent, framework, third stage). See BR-08 for the thresholds.

### Review

- **FR-10.** The Review tab shows the mistakes that are due, oldest first, each as the bare position
  with no answer, no old throw and no verdict attached, and asks which tile to discard (CONFIRMED,
  `../CLAUDE.md` and framework; OBSERVED).
- **FR-11.** After the answer it says whether it was right for its judge, moves the card on or back
  (BR-01), and asks for or confirms the Cause (OBSERVED).
- **FR-12.** The diagnosis, a tally of mistakes by Cause with the leading one named, and the split
  between play-out-judged and Coach-judged cards, is shown whether or not anything is due (OBSERVED;
  CONFIRMED as intent, framework, "The mistake types").
- **FR-13.** A "Practise" button on the diagnosis sends the leading Cause to the Train tab as its
  filter (OBSERVED).
- **FR-14.** "Hands you have played" lists the last 200 answered discards, newest first, and opens
  one with the answer and reasoning shown; looking back changes nothing on the schedule (OBSERVED,
  `history.ts`, `Review.tsx`; CONFIRMED as purpose, `NEXT.md`).

### Tips

- **FR-15.** The Tips tab shows every card in the playbook, grouped in the order a hand happens, each
  with its rule, its example hand drawn as blocks where it has one, why it is supposed to work, where
  it stops applying, and a verdict badge (OBSERVED, `Tips.tsx`).
- **FR-16.** The page's opening lines name the table every verdict was measured at and what changes
  without Jokers (CONFIRMED, `TABLE-VARIANTS.md`, task 5, done 2026-09-06; OBSERVED).

### Your hand

- **FR-17.** The Your hand tab lets the user tap in a hand, exposed sets, bonus tiles, tiles already
  seen on the table, seat, round, turn and opponents' meld counts, and answers which tile to throw
  with the Coach's plan and reasons, or, given a thrown tile and thirteen tiles, whether to claim it
  (OBSERVED, `AskHand.tsx`). Seat, round, turn and meld counts are remembered between visits; the
  tiles are not (OBSERVED, `mahjong.ask.table`).

### Film room

- **FR-18.** The Film room lists recorded hands from each exported run, filterable by hand type and
  to evaluated hands only, and scrubs a chosen hand decision by decision showing the table, the
  acting seat's hand, every legal action's measured value, and the Coach's reasons (OBSERVED,
  `Replay.tsx`).

### Table setup

- **FR-19.** The Table setup tab edits the money ladder, pay mode, Zi Mo bonus, minimum and maximum
  Tai, self-draw minimum, kong and bite amounts and the Joker count, with five presets; amounts
  re-price the "what pays best" table immediately (OBSERVED, `TableSetup.tsx`, `money.ts`).
- **FR-20.** It shows what the table rewards, the danger and readiness reads, and what pays best
  against a comparison preset, from the recorded profile and reads files (OBSERVED).
- **FR-21.** It carries the save-to-file and restore-from-file buttons for the record (OBSERVED;
  CONFIRMED as intent, framework, "Running the app").

### Play

- **FR-22.** The Play tab deals one hand against three Coaches at the table set up in Table setup,
  steps the bots visibly, lets the user take any legal action and only legal actions, and keeps the
  engine snapshot before each human decision (OBSERVED, `Play.tsx`, `play.ts`).
- **FR-23.** After the hand, each decision can be judged on demand, or all at once, by play-outs
  against the measured best, and the verdict is stored with the hand (OBSERVED).
- **FR-24.** The review screen says the judge is to be trusted on throws and not yet on Pong, Chow or
  taking a win (CONFIRMED, `FINDINGS.md`, "The whole-hand judge is honest on throws and not yet on
  claims"; OBSERVED).

### The app as a whole

- **FR-25.** On a screen under 640px the app shows a bottom bar with Train, Spot, Review and Tips and
  a More button opening Your hand, Film room, Play and Table setup; wider screens show all eight
  tabs in a top strip (OBSERVED, `App.tsx`). The bottom bar itself is CONFIRMED (`NEXT.md`,
  "Decided"); which four are primary is recorded as open in `MOBILE.md` and `NEXT.md` while the code
  comment calls it settled (CONFLICT; see the note under F-015).
- **FR-26.** After a deploy, an open app shows a "new version is ready" bar with a Reload button
  (CONFIRMED, `MOBILE.md`, item 4; OBSERVED).
- **FR-27.** Every term of the game is written `*like this*` in source and rendered in italics,
  coloured by kind, with a key on the Tips page (CONFIRMED, `JARGON.md`; `NEXT.md`, "Decided").

## Business Rules

- **BR-01. The schedule.** A recorded mistake comes back after a day, three days, a week, two weeks
  and a month. Right moves it to the next interval; wrong sends it back to the start; right at the
  last interval finishes it (CONFIRMED, `../CLAUDE.md`, the fifth component; OBSERVED,
  `INTERVALS_DAYS = [1, 3, 7, 14, 30]` in `mistakes.ts`).
- **BR-02. Ask, never remind.** A review shows the hand and nothing else: not the old throw, not the
  judge's answer, not that it was wrong (CONFIRMED, framework; OBSERVED).
- **BR-03. Two judges, never confused.** A verdict from the Coach and a verdict from the play-outs are
  never shown as the same kind of thing; every card, log entry and verdict names its judge, and the
  diagnosis counts them separately (CONFIRMED, `NEXT.md`, "The merge"; OBSERVED).
- **BR-04. Nothing inside the noise is a mistake.** On Train, a pick is "best" at a regret of at most
  0.01; "too close to call" at or under one standard error; "close enough" at or under the larger of
  the fixed band and two standard errors; "mistake" at or under the larger of the second band and
  three standard errors; "blunder" beyond. The fixed bands are $0.35 and $1.50 in money and 0.8 and
  3.5 in chips (OBSERVED, `verdictOf` in `Train.tsx`). Whether these bands are the intended ones is
  not recorded (UNRESOLVED).
- **BR-05. What enters the record.** Only a mistake or blunder on a discard question enters the
  mistake record; every answered discard, right or wrong, enters the hand log; claims enter neither
  (OBSERVED, `Train.tsx`; the reason given is that the review screen can only ask "which tile").
- **BR-06. One card per position.** Meeting the same position again does not create a second card
  (OBSERVED, `recordMistake`).
- **BR-07. Pack admission.** A question enters a pack only when its best action beats the runner-up
  by more than two paired standard errors on 128 play-outs, and then only if the gap still clears two
  standard errors on 512 fresh play-outs with a different seed (CONFIRMED, `FINDINGS.md`, "The packs
  overstate their certainty", and `NEXT.md`, "Every pack question verified twice").
- **BR-08. When the Spot look moves.** No suggestion until six misses are sorted. With 40% or more
  of sorted misses being "ran out of time", suggest the next longer look. With none being about time
  over at least ten, suggest the next shorter (OBSERVED, `suggestedLook`).
- **BR-09. The Challenge compares what the verdict rested on.** The pick, the pack's best (or the
  runner-up when the pick was best), and the runner-up when it is a third tile, at 512 play-outs
  each; a charge that does not hold at two standard errors moves the tally and notes the card and
  log, and the card stays in the schedule (CONFIRMED, `FINDINGS.md`; OBSERVED).
- **BR-10. The Play judge.** 256 play-outs per action, at most six actions compared on a discard
  (the one taken plus the five the Coach ranks highest), verdict at two standard errors (OBSERVED,
  `PLAY_ROLLOUTS`, `MAX_JUDGED`).
- **BR-11. The retired packs.** `money` and `nowild` are off the site by Changs's decision; a card
  that points at them shows "cannot be rebuilt" with a button to drop it (CONFIRMED, `NEXT.md`,
  "Retired packs").
- **BR-12. Honest packs over balanced ones.** The packs keep decisive positions rather than a fair
  sample of the game (CONFIRMED, `NEXT.md`, "Decided").
- **BR-13. The game is not the training tool.** Play sits behind More and its result is presented as
  mostly luck; the review is what to read (CONFIRMED, `PLAN.md`, "Where this is going: a game";
  OBSERVED).

## Permissions and Access

There are no users in the system's sense. Anyone with the address can use every tab. Nothing is
written anywhere but the browser's own storage (CONFIRMED, `MOBILE.md`; OBSERVED). The repository
is public because GitHub Pages on a free account requires it (CONFIRMED, `NEXT.md`).

## Data

- **Browser storage keys.** `mj.mistakes.v1` (the record), `mj.spot.v1` and `mj.spotcause.v1` (Spot
  scores and causes), `mj.practise.v1` (the Cause filter, a bare string), `mj.history.v1` (the hand
  log, capped at 200), `mj.play.v1` (played hands with snapshots, capped at 20),
  `mahjong.money.config` (the table), `mahjong.ask.table` (seat, round, turn, meld counts)
  (OBSERVED).
- **The backup file.** JSON with `app: "which-tile"`, `version: 1`, `savedAt`, and `data` holding the
  first five keys above. The Play hands, the table money and the Your hand settings are not in it
  (OBSERVED, `backup.ts`). Whether they should be is UNRESOLVED.
- **A mistake card** stores a pack and question id, or a seed and phase for a made-up hand; what was
  thrown and what the judge threw; verdict, cost, the judge's one-line reason, the Cause chosen and
  the Cause suggested, the step, the due time, and counts of times seen and got right; and a
  `challenged` note when a challenge did not uphold it (OBSERVED, `mistakes.ts`).
- **The packs.** Three on the site: `coach` (4 Jokers, min 2, 10,500 questions, 105 shards), `min1`
  (4 Jokers, min 1, 10,473, 105), `min1-nowild` (0 Jokers, min 1, 10,257, 103). Each is a directory
  with an `index.json` listing shards with their kind and Cause tallies and the hash modulus, and
  shard files of about a hundred questions each; a question's shard is a hash of its id so old cards
  still find their question (OBSERVED, `web/public/quiz/index.json`; CONFIRMED design,
  `MOBILE.md`, "The sharding design"). The no-Joker pack is half of all the decisive positions its
  run has and cannot grow without more grading (CONFIRMED, `NEXT.md`).
- **Other static data.** `quiz/spot.json` for the Spot drill; `replays/` with runs `coach` and
  `money` of 180 hands each; `profile/money.json` and `reads/money.json` for Table setup (OBSERVED).
- **Retired packs** live in `data/gen/retired-packs/` off the site (CONFIRMED, `NEXT.md`).

## Integrations

None. There is no backend and no third-party service. GitHub Pages hosts the built site; the
service worker caches it (OBSERVED, `.github/workflows/pages.yml`, `web/public/sw.js`). A
`vercel.json` remains from the earlier deploy plan in `PLAN.md`; the live site is Pages
(OBSERVED both; `NEXT.md` is the later statement).

## Validations

- Your hand accepts at most four copies of a playing tile and one of each bonus tile; a hand of
  fourteen tiles counting three per exposed set before it answers a discard question; thirteen plus
  a thrown tile before a claim question; a Chow only from the player before you and only within one
  suit (OBSERVED, `AskHand.tsx`).
- Restore refuses a file that is not JSON, not a "which-tile" export, or not version 1, and says
  which (OBSERVED, `restoreBackup`).
- On Play, a tile is tappable only when the engine lists it as a legal throw, and every button is
  built from the engine's legal list (OBSERVED, `Play.tsx`).

## States and Transitions

- **A mistake card** moves through steps 0 to 5; step 0 is due tomorrow and step 5 is finished.
  Right increments the step; wrong resets it to 0 (BR-01).
- **A Spot question** goes looking, then asking with the position face down, then done with it shown
  again (OBSERVED).
- **The Train tab** is loading, ready, or has no pack; with a pack it walks one shard at a time in a
  random order and moves to another shard that the index says can serve the filters when the current
  one is used up (OBSERVED).
- **The Play tab** is idle, mid-hand, or reviewing a finished hand; a decision is unjudged, judging
  with progress, judged, or failed (OBSERVED).
- **The app's version** is current, or has a new version waiting behind the Reload bar (OBSERVED).

## Exceptions and Edge Cases

- A card whose pack is gone or whose question is no longer in the pack shows "This one cannot be
  rebuilt" and offers to drop it (BR-11; OBSERVED).
- A challenge on a question from a pack built before 2026-09-06 says the position cannot be rebuilt
  here (OBSERVED).
- A shard that will not load is left out of the walk rather than fetched repeatedly; a shard whose
  tally promised a Cause it does not contain is marked barren and skipped (OBSERVED, `Train.tsx`).
- A Cause filter that matches nothing in the pack deals a made-up hand aimed at that Cause where one
  can be found in 40 deals, and a trap otherwise, and says which (OBSERVED, `GeneratedHand.tsx`).
- With storage turned off, every drill still runs and simply does not remember (OBSERVED, every
  `try/catch` around `localStorage`).
- A pack from a different table than the app's static config shows an amber note that the Measured
  Best holds but the Coach's reasoning beside it is computed for the app's table (OBSERVED,
  `Train.tsx`; the "your table" here is `data/table.config.json`, not the Table setup tab).

## Error Behaviour

- An on-demand tab that fails to load shows a message and a Reload button instead of a blank page
  (OBSERVED, `LoadGuard` in `App.tsx`).
- The Spot drill and the Film room show a plain "could not load" line with the status (OBSERVED).
- A Play engine error is shown as "The engine stopped: …" on the table (OBSERVED).
- Service worker registration failing is silent; offline is a bonus, never a blocker (OBSERVED,
  `update.ts`).

## Non-Functional Requirements

- Every tappable control at least 48px, safe-area insets top and bottom, inputs at 16px on iOS
  (CONFIRMED, `MOBILE.md`; OBSERVED in `App.tsx` and `CELL`).
- The square table stays on a phone at a 22px tile (CONFIRMED, `NEXT.md`, "Decided").
- The first question costs one shard of about 160 to 200KB rather than a whole pack; the first script
  is 553KB, 177KB gzipped; the rest arrives on demand and is precached (CONFIRMED, `MOBILE.md`,
  item 3 done). The time from pack button to first question on a real phone on 4G is not measured
  (UNRESOLVED, `NEXT.md`).
- Offline after one visit (CONFIRMED, `NEXT.md`).
- A Challenge is about a second on the Mac and a few seconds on a phone; a Play judgement of six
  actions about the same (CONFIRMED, `FINDINGS.md`; OBSERVED).
- At 360px a late-hand table of about fifty discards is about 410px wide and scrolls inside its
  card; whether that is accepted or the tile shrinks is for Changs (UNRESOLVED, `NEXT.md`, "What
  needs Changs", item 2).

## Security Requirements

- Nothing leaves the browser; no request carries user data (CONFIRMED, `MOBILE.md`; OBSERVED).
- The copyrighted book scans, the `.acsm` file and `data/gen/` are git-ignored and not tracked, so
  nothing copyrighted leaves the machine (CONFIRMED, `PLAN.md`, "Deploy", step 2).
- The Tips cards are reworded from a tactics book; publishing them openly was flagged as Changs's
  call, and the site is public (CONFIRMED that it was flagged, `PLAN.md`, "On the phone, and on the
  other table"; whether that call was made is not recorded, UNRESOLVED).

## Technical Constraints

- Static site, no backend, everything in the browser; Vite, React, TypeScript; the solver and engine
  are pure TypeScript shared with the simulator (CONFIRMED, `PLAN.md`, "Architecture").
- Deploys on every push to `evaluator-accuracy` via `.github/workflows/pages.yml`, served under
  `/Mahjong/`; the manifest's `start_url` and `scope` must stay relative (CONFIRMED, `NEXT.md`).
- The repository path contains a colon, so pnpm's `.bin` shims fail; tools are called by their real
  paths, as `check.sh` does. `web/tsconfig.json` is a solution file, so `tsc --noEmit -p .` checks
  nothing; use `tsc -b --force`. Web is on TypeScript 6, the rest on 5 (CONFIRMED, `NEXT.md`,
  "Things that will bite").
- The single-file build needs `SINGLE_FILE=1` and carries the Challenge worker inline (CONFIRMED,
  `NEXT.md`).
- One long build at a time on the Mac, after checking for memory hogs (CONFIRMED, `NEXT.md`).
- The code keeps `minimum_fan`, `fan_limit` and related keys as a data contract even though every
  screen says Tai; renaming is a day's work with a migration and is not asked for (CONFIRMED,
  `JARGON.md`, "Still open: the code").

## Acceptance Criteria

- `./check.sh` is green: typecheck of all four packages, engine and solver tests, and the web build
  (OBSERVED as the CI definition; CONFIRMED as what CI runs, `NEXT.md`).
- The verdicts on the site have each cleared two standard errors on two independent sets of
  play-outs (CONFIRMED, `FINDINGS.md`; BR-07).
- The training plan's own signals, which the app does not yet report and no one has yet produced: a
  rising Train score, a leading Cause that changes over time, reviews coming back right more often at
  the longer intervals, and the same Spot accuracy at a shorter look (CONFIRMED as the signals,
  framework, "How to tell it is working"; UNRESOLVED whether the app should compute any of them).
