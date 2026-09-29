# PROTOTYPE

## Purpose of this file

This file governs the project's prototype: what it represents, why, what we are trying to learn
from it, what it has taught, and where it sits in its own lifecycle. `prototype/` holds the
prototype itself; this file holds what it is for.

## It answers

What are we prototyping, what are we learning, and what is the lifecycle state of the prototype?

## Two kinds of prototype work

The visual product prototype is the primary kind: something to see, use, review and challenge
before production code is written. Here that is a runnable copy of the app, in one file, that a
new feature is added to first. The targeted experiment is the secondary kind: something built to
resolve one specific uncertainty. This project has run dozens of those, but they were measurements
of the coach and the packs rather than of the product, and they are recorded in `FINDINGS.md`
(`RS-001`), not here. The one experiment that belongs here is the claim judge, at the bottom.

## What belongs here

What the prototype represents and leaves out; the mocks, shortcuts and temporary assumptions it
uses; what we want to learn from it; review and feedback; what was learned; and what the next
iteration should change.

## What does not belong here

- The prototype itself; that is `prototype/`.
- Accepted product behaviour; that is `SPEC.md`, deliberately, after a finding is accepted.
- Resulting decisions; those are `DECISIONS.md`.
- New or changed uncertainty; that is `OPEN-ITEMS.md`.
- Delivery order; that is `PLAN.md`.
- The measurements of the coach and the packs; those are `FINDINGS.md`.

## When to update

Before an iteration is built, to say what it represents and what it should teach; and after review
or testing produces evidence, to say what was learned and what changes. Keep earlier iterations'
findings rather than overwriting them.

## Relationship to other files

Prototype scope is drawn from `USERS.md`, `USER-JOURNEYS.md`, `WORKFLOWS.md`, `FEATURES.md` and
`USER-STORIES.md`. Accepted learning flows back into those files and `SPEC.md`; new uncertainty
into `OPEN-ITEMS.md`; material decisions into `DECISIONS.md`; delivery changes into `PLAN.md`;
project-level change into `CHANGELOG.md`. The decision that shapes this file is `D-025`; the
tension it creates with the recipe is `C-001`.

## Rules

The prototype participates in product definition and does not wait for the definition to be
finished. Mock data, hard-coded states and disposable code are all legitimate; optimise for what
it must teach.

Do not silently invent unresolved product behaviour. Where the prototype must represent something
undecided, record it as an `ASSUMPTION` in `OPEN-ITEMS.md` and list it under Temporary assumptions
below. Prototype behaviour is not an approved requirement, and prototype code is not production
code. Learning must be deliberately accepted into the project files before it reaches production;
it never migrates by itself. This rule matters more here than usual, because the prototype is a
copy of production and the two will look alike.

Label every shortcut, mock and assumption below. Do not write scope the owner has not agreed to;
an iteration the agent thought of is `PROPOSED` and stays out of `PLAN.md` and `NEXT.md` until the
owner agrees.

## Lifecycle state

The three states are `NOT STARTED`, `ACTIVE` and `HISTORICAL`. They are sufficient.

This project departs from the recipe here, and it is worth being plain about it. Part 6 of
`P-Starter.md` says that after BASELINE the prototype becomes `HISTORICAL`, is not kept in step with
production, and that later prototyping is a fresh, scoped exercise rather than a second application
following production. This project passed BASELINE before the recipe arrived, the production app
is live, and on 2026-09-12 the owner decided that `prototype/` is instead a runnable snapshot of
the current build, kept true by a script, in which every new feature is tried before its
production code is written (`D-025`). So the state below is `ACTIVE` for as long as that decision
stands, and a later session must not "correct" it to `HISTORICAL` on the strength of Part 6. The
concern behind Part 6, that what runs in the prototype gets mistaken for what was agreed, is kept
as the rule above.

---

## Current Prototype

**Lifecycle State:** ACTIVE

**Iteration:** 1, the seed.

**Status:** SEEDED on 2026-09-12 and runnable. `prototype/build.sh` folds the current source into
`app.html`; `index.html`, `features.html` and `workflows.html` are the launchpads, generated from
`FEATURES.md` and `WORKFLOWS.md` at load time rather than retyped, and every card opens the screen
its record names. Nothing has been prototyped here yet that is not already in production, which is
the point of a seed: the next feature starts from what exists.

**Objective:** Give the owner, and anyone prototyping a feature, a copy of the app as it is today
that runs from one file with no server, so that a change can be tried and reacted to before it is
built for real.

**What part of the application is represented:** The whole app as of the current source, folded
into `prototype/app.html` by `prototype/build.sh`. As seeded on 2026-09-12 the folder holds three
things, all the lead's work.

- `build.sh` regenerates the snapshot from the current source: a single-file Vite build, then
  `web/tools/singlefile.mjs` with 500 questions and 30 replay hands, then the normal split build
  again so `web/dist/` is left as production expects.
- `app.html`, about 7 MB, the snapshot itself. It is git-ignored, since it is generated bytes that
  change wholesale on every build; anyone who needs it runs the script.
- `screens/`, empty but for a placeholder, for the hand-maintained launchpads that the recipe's
  Part 17 describes and that are to be committed beside the snapshot.

### Represented

**Users:** U-001 (Changs) and U-002 (a friend testing), as the production app serves them.

**Journeys:** Everything the production app supports, UJ-001 to UJ-006, at the level the snapshot
carries: 500 questions a pack rather than ten thousand, 30 replay hands rather than 360.

**Workflows:** WF-001 to WF-014, as built in production.

**Features:** F-001 to F-016, as built; F-014, the Play tab, is itself labelled a prototype in
production and is the first feature this folder should carry forward.

**Stories:** US-001 to US-016 and US-019, as built.

**Important states:** A fresh record with nothing due; a record with reviews due; a pack question
answered and graded; a made-up hand marked by the Coach; a whole hand played and its decisions
judged; the phone layout under 640px.

### Deliberately excluded

- The full packs. The single-file build keeps the first 500 questions a pack and the first few
  shards, so a stored card's shard may not be present; the reader must use the modulus from the
  index rather than counting shards, as `MOBILE.md` says.
- The service worker and offline behaviour. A single file has no scope to register one in.
- The export button, which cannot hand a viewer a file in an artifact viewer.

### Mocks and simulations

| Mocked | Stands in for | Why |
|---|---|---|
| Tile faces as data URIs on the window | The 48 image files in `web/public/tiles/` | An `<img>` needs a real URL in a single file |
| A fetch shim answering from an embedded map | The pack shards, replays and reads files | A single file has nothing to fetch from |
| Truncated packs and replays | The full data | Keeps the file inside what a viewer will load |

### Temporary assumptions

None recorded yet. The seed is a copy of production and embodies no undecided product behaviour of
its own. When a feature is prototyped here on an assumption, add it to this table and to
`OPEN-ITEMS.md`.

| Assumption | Open item | Why it was safe to proceed |
|---|---|---|

### Deliberate shortcuts

- The snapshot is built by the same `singlefile.mjs` that made the 2026-09-10 artifact, so its
  limits are that tool's limits. That is a shortcut, not a decision about how production is
  delivered; production is the split build on GitHub Pages (`D-020`).

### Known gaps

- Nothing has yet been prototyped here that is not also in production, so the folder has not yet
  done the job it exists for. The first candidate is the claim judge (`F-017`), below.
- The launchpads in `screens/` are not yet written.

---

### Iteration 2, 2026-09-16: a "hard only" filter on the Train tab

Changs said some quiz questions are too easy. The prototype adds a "hard only" button beside the
all, discard and claim buttons. It leaves out questions whose answer is a win, questions decided by
more than eight standard errors, and questions the recorded bot already got right (`A-005`). It is
remembered per device and on by default, at Changs's request on 2026-09-16.

Pushed to production on 2026-09-16 at his word, with the other changes in `D-028`. The ten passes
are in `MISTAKES.md`.

**Temporary assumption:** the definition of hard, `A-005`.

## What We Want to Learn

**What needs validation:** Whether the Play loop feels like mahjong and whether its review is worth
reading (`Q-001`). That is the owner's question and it can be asked of the snapshot as well as of
the live site.

**Workflows that need review:** WF-013, playing one hand and judging it; WF-003 on a phone late in
a hand, where the table outgrows its card (`Q-002`); the bottom bar's choice of four (`Q-003`).

**Interactions that need review:** The on-demand judging of a decision after a hand; the
"cannot yet be trusted on calls" note on the Play screen; the update bar.

**Assumptions being exercised:** A-001, that graded decisive positions are what to practise; A-004,
that friends need no shared data.

**Evidence / feedback required:** The owner's reactions after a week; anything friends report.

**What would constitute a useful result:** A sentence from the owner of the form "this is right",
"this is wrong", "move this", or "this is missing", recorded under Review below and then acted on
in the project files.

---

## Review / Testing

| Date | Who | What was exercised |
|---|---|---|
| 2026-09-07 | Changs, on a mockup with two live 360px frames | The bottom bar and the square table on a phone; settled D-017 and D-018 |
| 2026-09-10 | Changs, on his phone | The installed app, which opened at the account root and showed a 404; fixed the same day |
| 2026-09-10 | Changs, on the Train tab | Disputed a big-mistake verdict; re-judged and found to be noise; led to D-009 |

Those three predate this folder and were done on the production app or a mockup. They are the
only owner reviews on record, and they are recorded here because they are exactly the kind of
evidence the prototype is meant to produce.

**Observations:** The manifest's relative paths and the winner's curse were both found by the owner
using the thing, not by anyone reading it.

**Feedback:** None yet on the seed.

**Failures / confusion:** None recorded on the seed.

**Missing behaviour:** None recorded on the seed.

**Unexpected behaviour:** None recorded on the seed.

---

## Learning

**What we learned:** From the mockup, that a bottom bar with five destinations is the honest way to
carry eight on a phone, and that the square table is worth its height (D-017, D-018). From the
phone, that the installed app must use relative paths. From the disputed verdict, that packs
overstated their certainty by about a tenth and needed a second pass (D-009).

**Assumptions supported:** None tested through this folder yet.

**Assumptions rejected:** None yet.

**New questions:** Q-002 and Q-003 came out of the phone pass.

**Required project-definition changes:** None outstanding from the reviews above; each was taken
into the app and recorded. C-003, the framework describing two tabs, is a definition change the
app has already made and the framework has not.

**Required prototype changes:** The launchpads in `screens/`.

---

## Next Prototype Iteration

**What should change:** The owner has not said. The agent's recommendation, `PROPOSED` and not
agreed, is that the next thing tried here is the claim judge: a stronger rollout policy for claim
questions inside the Play review, so the owner can see a whole hand judged honestly on calls
before that policy is built into `solver/src/rejudge.ts` for the packs and the phone.

**Why:** It is the first item in `PLAN.md` Phase 7 and the reason the Play review cannot yet be
trusted (`R-001`).

**What it should let us learn:** Whether a review that is honest on calls changes what the owner
thinks of the Play loop (`Q-001`).

**Or: are we at BASELINE?** Past it. This section does not apply in the usual way, since the
prototype tracks a live product by decision; see the Lifecycle state section.

---

## Targeted Experiments / Spikes

### A pack of positions that arise at a strong table

**Uncertainty addressed:** Every pack question so far comes from hands played by the weak personality
bots. Changs's opponents are strong (`D-032`), and a strong table produces different positions: hands
run differently, suits get collected, the floor looks different. Nothing in the project has graded
positions that came from strong play at his own table.

**Origin:** Changs asked for heavy work, 2026-09-26.

**Why construction:** it cannot be read off anything. The run has to be played and graded.

**What is built:** a new bot type `coachnowild`, the Coach reading the no-Joker danger table, so a
no-Joker run is four players who read danger the way the app does at that table (`D-030`). Then the
usual three stages at 0 Jokers, min 1: generate, grade, build the pack.

**Named before the run:** 150,000 hands, seed 902, four `coachnowild` seats, into
`data/gen/run-strong-nowild`. Graded at 4 decisions a hand, 128 play-outs, adaptive, policy shanten,
seed 1. Pack built at `--max 12800 --mix decisive --verify 512`, which is what the shipped packs use.
Smoke run first: 400 hands at 14 hands a second, 361 won, 39 drawn, mean 50.5 turns, and the manifest
records 0 Jokers, min 1 and four `coachnowild` seats.

**What it will and will not show:** the positions will be strong-table positions. The grading still
plays out with simple bots, because a Coach play-out costs 120 times more, so the answers still mean
"best if play continues loosely" for everything except wins, where the rule from `FINDINGS.md`
applies. Claims and throws were measured to survive that (`+0.150` to `+0.338` on calls, 1% of throws
changed), which is why this is worth building.

**Status:** RUN. Generated 18:01 to 18:55 on 2026-09-26 (150,000 hands, 9,059,955 decisions, 46
hands a second), graded 18:55 to 04:01 (599,991 decisions, 18.3 a second, 0 errors), pack built
04:01 to 15:55 on 2026-09-27, of which the verify pass was 709 minutes.

**Findings:**

1. **The pack:** 10,652 questions in 107 shards at `data/gen/strong-quiz/strong-nowild/`: 5,673
   discards, 4,280 claims, 699 self decisions. 1,198 offer a win and all 1,198 carry `rule: 'win'`,
   the first pack built with `D-033`; on 165 of them the play-outs preferred passing.
2. **Verify:** 12,801 admitted, 2,139 dropped for failing separation on 512 fresh play-outs (16.7%,
   against 18.0%, 18.2% and 19.9% for the three shipped packs), 0 could not be replayed. "Best changed
   on 203" against 31 to 44 for the shipped packs: the counter runs before the win rule is re-applied,
   so up to 165 of the 203 are rule questions whose fresh play-outs preferred passing, leaving about
   38, in line with the others. The counter should report rule questions apart; left alone until the
   rebuild finishes, so all four packs come from one builder.
3. **Phase mix:** pack early 8%, mid 32%, late 60%, against the run's 32%, 40%, 28%. The shipped
   0-Joker pack is 11%, 32%, 57%, so a decisive question at this table is a late one whoever plays.
4. **Not measured yet:** whether these positions differ from the weak-bot packs in any way a player
   would notice, and whether Changs finds them harder. Changs asked for it on the site on
   2026-09-27 ("Add it"); it is the fourth pack, labelled "0 Jokers, min 1 Tai, strong table", and
   the per-pack index carries `players: 'strong'` so a rebuild of the top index keeps the label. The
   default pack is still the weak-bot 0-Joker one.

**Regenerated with the new Coach, 2026-09-28** (`D-034`, fifth item; `D-035` in the four chairs,
before the claim model shipped): seed 903, 150,000 hands in 3,756 seconds (40 a second), 599,998
decisions graded in 32,535 seconds, the pack built 13:42 to 16:19. 10,751 questions in 108 shards:
5,190 discards, 4,816 claims, 745 self decisions; 1,246 offer a win, all marked, and the play-outs
preferred otherwise on 156. Verify dropped 2,049 of 12,800 (16.0%), the play-outs changed the best on
50 and the win rule overrode them on 156, now counted apart. Phase mix 9%, 37%, 54% against the
run's 35%, 41%, 24%. It replaced the first strong pack on the site the same day; the first stays at
`data/gen/strong-quiz/` as the record of the old Coach's table.

### Letting the fit choose on a weak colour plan

**Uncertainty addressed:** Candidate B draws the line at the plan: on any half-colour plan the
Coach's own tile stands, on any other the fit chooses. That line was set by hand. The sixth item of
`D-034`, a model choosing the plan on money, is a week of its own; the cheapest form of it is one
number swept for money: the fit is allowed onto a half-colour plan whose colour target the Coach's
own numbers rate below so many chips a game, and keeps off the ones rated above.

**Named before the run:** `policymoney.ts --colour-below 2`, `4` and `8` against the shipped Coach,
three Coaches in the other chairs, deals 7980001 to 7982000, 2,000 a chair. A setting counts as
better only past two standard errors, then gets the recorded field and a fresh-deal confirmation
before it ships, as B did. Output `data/gen/coach2/colour-*-coach.log`.

**Status:** RUN, 2026-09-28 06:53 to 09:55.

**Findings, the fit allowed onto half-colour plans the Coach rates below:**

    below     candidate minus Coach       hands won        half-colour wins   chicken wins
    2 chips   +0.092 +/- 0.086  (t 1.1)   1,934   2,047       219   162        1,150  1,316
    4 chips   +0.118 +/- 0.091  (t 1.3)   1,934   2,088       219   150        1,150  1,368
    8 chips   +0.180 +/- 0.098  (t 1.8)   1,934   2,144       219   106        1,150  1,457

None past the bar. The trend is A's: the more colour plans the fit takes over, the more cheap hands
it wins against three Coaches and the fewer colour hands it finishes, and A's loss came against the
loose players on exactly that trade. So the line B draws, the Coach keeps every colour plan, stays,
and the sixth item of `D-034` closes in its cheap form. The full form, a model choosing plans on
money, would need a training loop over games rather than grades, and is not started.

### The learned claim model, played for money

**Uncertainty addressed:** `solver/src/claim.weights.ts` decides Pong, Chow, Kong or pass with
86.1% held-out accuracy and had never been played for money in a full game. Second item of `D-034`.

**Status:** SHIPPED, 2026-09-28 (`D-036`); the ten passes are in `MISTAKES.md`.

**Named before the run:** `policymoney.ts --claims`, the shipped Coach (with candidate B inside)
in arm A, the same Coach with the model deciding claims in arm B, deals 7950001 to 7952000, 2,000 a
chair, both fields, at the 0-Joker min-1 table. The gate as always: past two standard errors against
three Coaches and no loss against the recorded players.

**First sample, 2026-09-28 02:42 to 03:23:**

    field                model minus Coach            hands won        chicken wins   deal-ins
    three Coaches        +0.171 +/- 0.131  (t 1.3)   1,921   2,113    980   1,252    1,372  1,402
    recorded players     +0.212 +/- 0.133  (t 1.6)   3,779   4,077  1,901   2,490      526    500

Positive both ways, neither past the bar. It calls more and wins more cheap hands, without the
colour-hand cost A showed (half-colour 252 against 242, 557 against 516).

**Named before the run, the second sample:** the same test on deals 7970001 to 7972000, both
fields, queued behind the Chow sweep. The decision is on the pooled figure over 16,000 paired deals
a field: past two standard errors against three Coaches and not negative against the recorded
players, or the model stays out.

**Second sample, 04:40 to 05:18, deals 7970001 to 7972000:** +0.327 +/- 0.130 (t 2.5) against three
Coaches, hands won 1,919 against 2,077; +0.224 +/- 0.133 (t 1.7) against the recorded players.
**Pooled: +0.249 +/- 0.092 (t 2.7) against three Coaches and +0.218 +/- 0.094 (t 2.3) against the
recorded players.** Past the bar on the first and positive on the second, so the claim model ships,
the way B did: inside `claimAdvice`, so the Coach that explains a call on Your hand and the Coach
that plays are one, with `fitted: false` giving the rule as it was. The Coach's rule of taking a
Kong before asking is replaced by the model ranking the Kong with the rest, because that is what
was measured (`D-036`). The identity check follows: the harness's own claim bot against the shipped
Coach must return exactly 0.000.

**Identity check, 05:49 to 06:55, deals 7950001 to 7952000: exactly +0.000, hands won 2,248
against 2,248, chips 6,360 against 6,360.** The shipped `claimAdvice` and the harness's own claim
bot make the same call on every one of 8,000 paired deals.

**What it changes on screen, counted 2026-09-28:** over the 4,644 claim questions of the 0-Joker
pack that do not offer a win, the model and the Coach's own numbers make a different call on 1,336
(28.8%). Where they differ, Your hand says so under the call, and the Train line "The Coach would
..." now follows the model.

### The Coach's Chow bar, swept for money

**Uncertainty addressed:** The Coach calls a claim when it improves the hand by more than 0.4 chips
(`OPEN_COST`), a number nobody measured when it was set. The Pong bar was swept on 2026-09-17 and
nothing beat 0.4 (`D-031`); the Chow bar has not been. Third item of `D-034`, the one knob left.

**Named before the run:** `policymoney.ts --chow 0.2` and `--chow 0.8` against the shipped Coach,
three Coaches in the other chairs, deals 7960001 to 7962000, 2,000 a chair, at the 0-Joker min-1
table. A bar counts as better only past two standard errors, and then gets the recorded field and a
fresh-deal confirmation before it ships, as B did. Output `data/gen/coach2/chow-*-coach.log`.

**Status:** RUN, 2026-09-28 03:23 to 04:39.

**Findings:** a bar of 0.2 against the shipped 0.4: +0.006 +/- 0.021, hands won 1,920 against
1,916; a bar of 0.8: +0.044 +/- 0.034, t 1.3, hands won 1,926 against 1,916. Neither past the
bar, and the win mixes differ by a handful of hands in 8,000 deals, so the Chow bar barely binds at
this table: the calls the Coach makes are the same at 0.2, 0.4 and 0.8. It stays at 0.4. With the
Pong bar (`D-031`) and the danger weight swept before, the third item of `D-034` closes: the Coach's
fixed numbers are not where money is.

### Every answer re-judged with the Coach in the play-outs

**Uncertainty addressed:** none about the choice, which is Changs's (`D-037`): no answer may rest on
play-outs finished by simple bots. What is uncertain is how many answers move, and what the packs
look like when the Coach is the judge.

**What is built:** `datagen/src/coachpack.ts`. It takes a pack as shipped, rebuilds every position
from the question alone, and judges again with the Coach in all four chairs: for a discard the top
four throws by the old grade plus the throw the recorded seat made, for a claim or a self decision
every legal action, at 256 play-outs, the win rule kept. The question keeps its position, tips, ids
and cause machinery, gains `judge: 'coach'`, and its cause is worked out again where the best throw
moved. Six workers take shards by number; a merge writes the per-pack index with `judge: 'coach'`
on it. A killed run resumes from the shards already written.

**Named before the run:** the strong-table pack first, 10,751 questions, then `min1-nowild`. The
counts to report: how many best answers moved, how many of the old "decisive" gaps the Coach does
not reproduce, the phase and kind of the moved ones, and the time taken. The app then shows which
judge a question rests on, and the Challenge button gains the strong-table play-outs.

**Status:** RUNNING from 2026-09-28 19:45, six workers. A smoke run of three questions at 64
play-outs took 12 seconds and wrote the pack's own shape with `judge: 'coach'`. The Mac restarted
about 11:50 on 2026-09-29 and the run died at 49 of 108 shards; restarted 17:22 under
`caffeinate -is`, skipping the written shards.

**The first 49 shards, measured 2026-09-29 17:30:** 4,931 questions judged, none failed. The best
answer moved on 221 (4.5%): 114 of 2,392 discards (4.8%), 101 of 2,190 claims (4.6%), 6 of 349 self
decisions (1.7%). Every one of the 1,246 win-offering questions in the pack still answers "win". On
Changs's word these went on the site the same evening, the other 59 shards as they were, each
question naming its judge (`--merge --partial --to`). The whole pack finished 2026-09-30 01:37 and went on
the site at 01:50; the counts are in `FINDINGS.md`, "The strong-table pack re-judged". The other
three packs followed in one chain (`data/gen/coach2/coachpack-rest-chain.sh`: `min1-nowild`, then
`min1`, then `coach`), started 01:43 under `caffeinate -is`, a merged pack skipped on restart.

**The app's own judges, changed the same evening:** the Challenge button and the Play tab's review
now run their play-outs with the Coach in every chair (`policy: 'coach'` in the worker, reading
danger at the table's Joker count), so a challenge answers by strong play whatever the pack was
built with; each Train question says which judge its bars rest on until the pack it came from has
been re-judged.

**Measured on Changs's own phone, an iPhone 18 Pro Max, 2026-09-29 01:12:** a Challenge with the
Coach in every chair, 512 play-outs on each of two actions from a mid-hand claim (`min1-nowild`
4634:5:12), took 44.7 seconds; the same on the Mac from a late position took 15.2. So on the phone
a Challenge is under a minute, and the Play review at 384 play-outs a decision is about half that
per decision, or ten minutes and more for a whole hand's "Judge all"; the screen says so. The
"what the play-outs did" line and the judge line both rendered on the phone.

### A second disputed verdict: throw the dead tile, strong-table question 5375:17:65

**Uncertainty addressed:** Changs called this one "a rubbish question" on 2026-09-29: at turn 54
with 發 ponged and 3筒 konged, holding 7萬7萬 8萬8萬 9萬 7條7條 and a drawn 5筒 with the other three
copies already visible, he threw the dead 5筒 and the pack called it a big mistake against 9萬.

**What was run:** the top three throws re-judged on the same hidden deals, simple bots at 2,048
and the Coach in all four chairs at 512 twice on different dice.

    finished by                      9萬                5筒               7萬
    simple bots, 2,048        20.79  win 58%    16.32  win 84%    7.26  win 45%
    Coach, 512                18.34  win 55%    12.61  win 84%    7.88  win 45%
    Coach, 512, other dice    19.26  win 56%    12.45  win 84%    7.18  win 40%

9萬 over 5筒 by 4.47 +/- 0.51, 5.72 +/- 1.10 and 6.81 +/- 1.07. Every judge agrees, past five
standard errors: throwing the dead tile wins the hand far more often and is worth five or six
chips less a hand. Three pairs kept make an All-Pong hand, with the dead tile held back as the
safe throw for later; the dead tile thrown now leaves a quick cheap hand.

**What this establishes:** the verdict is sound under strong play, and the question is a real
lesson, not a defect of the grader. What failed was the explanation: the Coach's reasons for 9萬
("single, needs two more") say nothing about why, and the Coach itself, its numbers and the fitted
policy both, would have thrown 5筒. The play-outs know why: each action's stored win mix says what
the hand finished as and for how much. The fix is to explain a verdict from that, beside the
Coach's words, and to say plainly when the Coach disagrees with the measurement, which it does
here.

### A disputed verdict: wait now or build bigger, strong-table question 3349:11:51

**Uncertainty addressed:** Changs challenged a "big mistake" on 2026-09-28: at turn 44 with two
pongs down, 白白, 4條5條6條 and 5筒 7筒 8筒, he threw 5筒 to wait on 6筒 or 9筒; the pack and the
Challenge button both say 7筒, one draw short of a bigger hand, at 18 chips against 10.

**What was run:** the position re-judged from the pack question, the top three throws, twice on the
same hidden deals: the usual play-outs at 2,048, and the Coach in all four chairs at 512.

    finished by                       7筒               5筒               8筒
    simple bots, 2,048        18.80  win 55%   12.12  win 78%   10.35  win 63%
    Coach in four chairs, 512  18.13  win 49%   16.86  win 71%   18.52  win 59%

Against simple bots 7筒 leads 5筒 by 6.68 +/- 0.58 (t 11.6); against the Coach the three are within
0.39 +/- 1.23 of each other, and 5筒 wins the hand 71% of the time.

**A second Coach-judged sample, from the app's own Challenge button once it ran the Coach (19:52):**
512 fresh play-outs on 7筒 and 5筒 only, 15 seconds in the browser: 7筒 ahead by $3.28 +/- $1.01 in
Changs's table money, which is about 2.5 +/- 0.8 in the pack's chips (the app prices the pack's
18.19 as $24.08). So the two Coach-judged samples read 1.3 +/- 1.2 and 2.5 +/- 0.8 for 7筒 over
5筒, about 1.9 +/- 0.7 pooled, against 6.7 +/- 0.6 from the simple bots.

**What this establishes:** under strong play 7筒 is still the better throw, by about two chips
rather than seven, and the "big mistake" is the grader's known weakness: simple bots never defend
and rarely win first, so a hand one draw short of bigger gets time that strong players do not give
it. The first reading here, that the three throws were equal within the noise, was one sample; the
second narrowed it to a small edge for 7筒, and both are recorded. The colour-plan regrade found the bias absent
on separable colour-plan positions (2 of 287); this is a different class, wait now against build
bigger, and it flips. The count of that class in the packs is below; the next step is to regrade a
sample of it with the Coach in the play-outs, as the colour class was, and if a material share flips,
to re-grade the class.

**The class, counted 2026-09-28:** discard questions where the pack's best throw leaves the hand
short of Ting Pai while another legal throw would leave it waiting: 208 of 5,190 in the strong-table
pack (4.0%), 120 of 4,001 in `min1-nowild` (3.0%), 198 of 3,303 in `min1`, 197 of 4,739 in `coach`.
In the strong-table pack the recorded seat waited on all 208.

**All 328 at Changs's table judged again with the Coach in the play-outs, 19:00 to 19:44, 256
play-outs, the top three throws:** strong-table pack, 4 best answers moved past two standard errors,
21 more where the Coach names a different best inside the noise, 183 the same; `min1-nowild`, 2, 15
and 103. So about one in eight of these "decisive" verdicts is not upheld under strong play and
about one in fifty reverses outright. Changs's position is one of the 21. On the same day he ruled
that no answer may rest on simple bots (`D-037`), so the class is not re-graded on its own: the whole
pack is, in the entry above.

### The grades on colour-hand positions, re-made with the Coach playing the play-outs

**Uncertainty addressed:** Every pack answer is the measured best when the rest of the hand is
played by `shanten` bots, which never collect a suit. On 2026-09-28 a policy fitted to those grades
gave up colour hands and lost money, which measured the bias. The question is how many of the
answers the app teaches on colour-hand positions are wrong because of it, and what they should be.

**Origin:** the fourth item of `D-034`, scoped to where the bias was measured to live.

**Counted before the run, 2026-09-28:** discard questions whose plan, by the Coach's own numbers, is
a half-colour hand: 287 of 4,001 in the 0-Joker pack (7.2%), 637 of 3,303 in `min1` (19.3%), 1,780
of 4,739 in `coach` (37.6%). The fitted policy changes the Coach's tile on 1,410, 638 and 515 of the
same discards (35.2%, 19.3%, 10.9%).

**Named before the run:** `coachgrade.ts --select colour`, the 0-Joker pack first, all 287, the
pack's top three actions judged twice on the same hidden deals at 256 play-outs: once by shanten
bots, once with the Coach in all four chairs. An answer counts as changed when the Coach arm's best
beats the shanten arm's best by more than two paired standard errors inside the Coach arm, the same
test the Pong stage used. Output `data/gen/coach2/regrade-colour-w*.jsonl`. If the changed share is
material, the follow-up is a pack whose colour-plan questions carry the Coach-played grade, marked
as such, then the other two packs.

**Status:** RUN, 2026-09-28 02:55 to 03:27, three workers, 19.9 seconds a question.

**Findings:** all 287 judged, 0 errors. **2 answers changed past two standard errors** (0.7%), 20
more differ inside the noise, and the pack's stored answer matched the fresh shanten best on 284 of
287, so the verify pass holds. At a two-standard-error bar over 287 tests about six false alarms are
expected, and two were seen, so the Coach-played play-outs agree with the shanten ones on these
positions. The two that moved: `1795:13:87` (turn 73, 5萬 over the pack's 4筒 by 0.68 +/- 0.32) and
`910:22:70` (turn 58, 8條 over the pack's 北 by 2.17 +/- 1.02).

**What this establishes:** the grades the app teaches on colour-plan positions at Changs's table
hold. The bias candidate A measured is not in the pack's separable answers; it is in the ambiguous
majority and in the choice of plan, which is where a fit learns and where a pack question never
goes. So the grades job closes here for the packs: re-grading the other two packs' colour positions
would cost days to confirm the same thing at tables he plays less. For fitting, the bias stands, and
candidate B's design, the Coach's plan with the fit inside it, is the answer to it.

**What it does not establish:** the ambiguous positions, which no pack holds and this did not judge;
the two changed answers are not corrected in the pack, because two of 287 is what chance gives.

### A session on the Play tab: hands in a row, the dealer moving, money carried across

**Uncertainty addressed:** The Play tab plays one hand and reviews it. `PLAN.md` Phase 7 names the
rest of the game, sessions, rotation and a running score, and holds it until the review can be
trusted on calls and wins (`D-021`). Calls were measured sound and wins are answered by rule
(`D-032`, `D-033`), so that hold is lifted, and Changs asked for it on 2026-09-28 (`D-034`).

**What the prototype has to teach:** whether a session, rather than a hand, is what he would open
daily; whether the dealer staying on after a win and the prevailing wind turning are understood
from the screen without a rule sheet; whether a session summary that ranks the decisions by what
they cost, rather than by whether the hand was won, is read as the point of the session. The
result of a hand is mostly luck, so the summary must never lead with money won.

**What is built first, and deliberately not:** hands in a row at the table set in Table setup, the
dealer keeping the deal after a win or a draw and passing it otherwise, the prevailing wind turning
after four passes, chips carried across hands, every hand's decisions kept for review as now, and
a session summary. Not built: a leaderboard, a bankroll across sessions, or any score kept between
days; those wait on whether a session is used at all.

**Status:** BUILT, 2026-09-28, in `web/src/components/Play.tsx`. A session starts with the first
Deal and lives in the browser's sessionStorage, so a reload keeps it and a new tab or a new day does
not. The strip above the table reads "hand 4, 東圈, session $0"; the review after a hand says where
the session stands and who deals next; "End the session" opens the summary, which leads with the
judged decisions costliest first and puts the money after them; "Start a new session" clears it.

**Measured on the built app, 2026-09-28:** four hands played through it by a script choosing the
Coach's tile. After a non-dealer win the deal passed and the seat names on screen followed
(dealer 1 to 2 to 3, "you are 西" then "you are 南"); chips carried across (−$7 after hand 1, −$13
after hand 2, matching the stored session); a reload mid-session showed "A session is in progress:
1 hand played". A stored session at three passes followed by a fourth non-dealer win turned the wind:
"Next: 南圈, you are 東 and you deal", stored `passes 4, prevailingWind 1, dealer 0`. The summary read
"You won 0 of 2, fed 2" before the fed count was corrected to count only hands your own throw gave
away, and the corrected build was re-measured on the same stored session. The ten passes are in
`MISTAKES.md`.

**What it does not establish:** whether Changs opens a session rather than a hand, and whether the
summary's ordering is read as the point. Both are his to say after a week.

### Can anything beat the Coach for money at Changs's table?

**Uncertainty addressed:** The Coach picks the measured best on 52.8% of decisive positions and
36.1% early in a hand, and Changs asked what it would take to make it better. A learned discard
policy already exists in the repo and was dropped from the app on 2026-09-02 because it lost 0.544
chips a game, so the question is not whether a model can be more accurate. It is whether anything can
take money off the Coach at his table.

**Origin:** Changs, 2026-09-26, choosing this over three other week-sized jobs.

**The gate, named before any work:** a candidate ships only if it wins in the paired money test at
his table (0 Jokers, min 1) against three Coaches by more than two standard errors, and does not lose
by more than two standard errors against the recorded personalities. Accuracy against the grader
decides nothing; it is the measurement that produced the model that already lost.

**What is already known, and is the thing most likely to waste the week:** the labels come from 128
play-outs by bots that never collect a suit, while the Coach wins a colour hand about a third of the
time. A decider fitted to those labels learns not to build colour hands. That is the standing
explanation for the 2026-09-02 loss, and it is written into `solver/src/policy.weights.ts` and the
Train tab's own comment. Any candidate has to be judged on money for this reason, not on regret.

**Step 1, run 2026-09-26: where does the Coach actually lose?** `policyeval.ts --dir
../data/gen/run-min1-nowild --hands 3000`, which scores four deciders on the same 9,731 evaluated
discards by mean EV regret in chips per decision.

    slice        n       Coach   old policy   bot that played   random
    decisive    450      1.792      1.047          2.370         3.806
    ambiguous  9,281     1.203      1.226          1.195         1.711
    early      2,808     1.371      1.491          1.341         1.807
    mid        3,272     1.244      1.431          1.342         2.038
    late       3,651     1.111      0.816          1.096         1.601

Top-1 against the measured best, same order: 49.6% and 66.4% on decisive, 20.0% and 20.7% on
ambiguous.

**What that says.** The old policy's advantage is entirely where the labels are clean: decisive
positions, and late hands. On the 95% of positions that are ambiguous it is no better than the bot
that played, and it is worse than the Coach early and mid, which is most of a hand. So the week's
target is the early and middle game on ambiguous positions, and a candidate that only sharpens
decisive positions will repeat 2026-09-02.

**What it does not establish:** none of this is money. Regret per decision is measured against the
same play-outs whose field cannot play a colour hand, so it inherits the bias described above. It is
a map of where to look, not a verdict.

**Next steps, in the order they will run:**

1. Fit a candidate on all three runs rather than one, with the ambiguous positions carried by an
   EV-weighted loss instead of being dropped for not clearing 2 SE.
2. Add the features the current set lacks and the Coach uses: progress toward a colour or all-pong
   hand, danger from the discards at the table's Joker count, and how much wall is left.
3. Money-test each candidate against three Coaches and against the recorded field, paired, at his
   table first.
4. Whatever wins: ship it with the Coach's explanations intact, re-run the ten passes, and say
   plainly where the two disagree.

**Built for steps 1 and 3, 2026-09-27, not yet run on data:** `datagen/src/policyfit.ts`, which
fits on every evaluated discard across several runs with the expected-regret loss, holds out the
packs' own questions, and scores the Coach on the same held-out positions; and
`datagen/src/policymoney.ts`, the paired money test of a fitted policy against the shipped Coach,
same seat through four chairs, either field. `solver/src/policy.ts` gained `policyRankWith` so a
candidate can be played from a JSON file before anything is baked in. Self-check of the harness
before any result: with arm B playing the Coach's own discards it returned exactly +0.000 over 200
paired deals, 43 hands won by each arm, 0.22 seconds a paired deal against three Coaches, so 8,000
paired deals is about half an hour. The trainer waits for the Mac: it loads a whole run's hands, and
the pack builds hold the machine until the rebuild finishes.

**Step 1, run 2026-09-27, 23:29 to 23:43 (candidate A):** `policyfit.ts` on the three runs, 150,000
decisions from each, one tanh layer of 16, the regret loss, 40 epochs. 442,474 training decisions;
held out the 7,528 discard questions of the three rebuilt packs, which are by construction the
positions the play-outs could separate. Peak 2.8 GB, no swapping. Mean regret in chips a decision,
final epoch, the Coach scored on the same positions:

    slice                 n     candidate A   Coach
    all               7,528       1.201       1.398
    early               534       2.352       1.920
    mid               2,930       1.424       1.000
    late              4,064       0.889       1.617
    0 Jokers, min 1   3,398       0.913       1.648
    4 Jokers, min 1   2,309       1.283       1.354
    4 Jokers, min 2   1,821       1.634       0.988

The loss moved from 1.111 to 1.083 over 40 epochs and the held-out figure wandered between 1.110 and
1.212 from epoch 10 on, so the features are the limit, not the epochs. The same shape as the old
policy: far better late, worse early and mid, and worse at the 4-Joker min-2 table than the Coach by
a wide margin. Carrying the ambiguous positions did not change that. At Changs's own table it is
ahead on every phase except early, which is the smallest slice.

**What it does not establish:** anything about the ambiguous majority: the held-out set is pack
questions, which are the separable ones. Money is below.

**Step 3 for candidate A, run 2026-09-27 23:44 to 2026-09-28 00:15:** `policymoney.ts 2000
--weights policy-a.json`, deals 7900001 to 7902000, all four chairs, 8,000 paired deals a field, at
the 0-Joker min-1 table. Arm A the shipped Coach, arm B the same Coach with its discards from the
fit; claims, kongs and wins identical.

    field                fitted minus Coach          hands won (Coach, fitted)   chips (Coach, fitted)
    three Coaches        +0.406 +/- 0.181  (t 2.2)      1,812   2,378               0    3,246
    recorded players     -0.067 +/- 0.173  (t -0.4)     3,192   4,014          46,277   45,745

Against three Coaches it clears the gate, by a little: +0.406 a game, t 2.2. Against the recorded
players it is flat in money while winning a quarter more hands, so the extra hands are cheaper ones
and something is given up when it loses. That is the shape the fitted tables had in 2026-09-13's
field test (`fieldtest.ts`): faster cheap hands, which pay against Coaches and not against loose
players. Changs's table is strong (`A-006`), so the first row is the one that decides.

**Named before the run, the confirmation:** the same test on fresh deals, 7910001 to 7912000,
three Coaches. A t of 2.2 on one sample is inside the range this project has watched shrink on
re-run (`R-004`); the candidate counts as ahead only if the second sample is also past two standard
errors, and the two are then pooled. Also to measure before anything ships: what the fitted arm
wins with (the hand types and their sizes), because "more hands, less money" against the loose field
says the win mix moved.

**Confirmation, run 2026-09-28 00:20 to 00:47, deals 7910001 to 7912000, three Coaches:** +0.120
+/- 0.185, t 0.7, hands won 1,807 against 2,301. Pooled with the first sample, 16,000 paired deals:
+0.263 +/- 0.129, t 2.0. **Candidate A is not ahead** by the rule set before the run: the second
sample is not past two standard errors, and the pooled figure sits on the bar. The first sample's
+0.406 shrank by more than half on fresh deals, which is `R-004` happening again. What held on both
samples is the shape: a quarter more hands won for little money, so the fit wins cheaper hands. The
win-mix tally added to `policymoney.ts` (self-check identical on both arms) ran on deals 7920001 to
7922000, both fields.

**The win mix, 2026-09-28 00:48 to 01:20.** Three Coaches, third sample: +0.128 +/- 0.183, t 0.7.
Pooled over the three samples, 24,000 paired deals: +0.218 +/- 0.106, t 2.1. Recorded players:
-0.202 +/- 0.176, t -1.1; pooled over two, -0.135 +/- 0.123. What the tested seat won with, three
Coaches:

                          Coach              candidate A
    hands won         1,808 at 15.64        2,325 at 13.58 chips each
    chicken             335                 1,488
    chou ping hu        944                   587
    half-colour         290                    59
    full colour          25                     6
    all-pong             85                    99
    wins by fan       1: 390  4+: 471       1: 816  4+: 338
    deal-ins          1,293 at -12.23       1,370 at -12.99
    drawn hands         768                   594

Against the recorded players the same, larger: chicken 520 against 2,595, half-colour 511 against 79.

**What this establishes.** Candidate A takes its extra hands by giving up colour hands for chicken
hands: four times the chicken wins, a fifth of the half-colour wins, and a chip and a half less per
win. At a strong table that is worth about a fifth of a chip a game and no more, and against loose
players it costs money. This is the label bias the plan named before any fitting: the play-outs
that grade every decision are played by bots that never collect a suit, so a fit to those grades
learns that a suit is not worth collecting. It is now measured, on 24,000 paired deals, rather than
argued. Step 2 as written, more features, is aimed at the wrong thing: a feature that sees a colour
hand being built cannot outweigh a label that says to abandon it.

**Named before the run, candidate B (the hybrid):** the Coach's own plan decides when the model is
allowed to pick. When `rankDiscards` says the best plan is a half-colour hand or the thirteen, the
Coach's tile is thrown; on every other plan the fit's tile is. If the gain against Coaches came from
the cheap plans and the loss against loose players from the abandoned colour hands, this keeps the
first and drops the second, and it stays explainable: the Coach's plan is the Coach's, and the model
only chooses within it. Deals 7930001 to 7932000, both fields, the same gate.

**Candidate B, first sample, 2026-09-28 01:23 to 01:59.** The tested seat's Coach keeps the tile on
a half-colour or thirteen plan and the fit picks on every other plan (`policymoney.ts --hybrid`):

    field                B minus Coach              hands won         chips each     half-colour wins   chicken wins
    three Coaches        +0.378 +/- 0.162  (t 2.3)  1,800   2,110    16.24  15.34      284   326          294  1,046
    recorded players     +0.767 +/- 0.147  (t 5.2)  3,118   3,711    16.73  15.87      500   564          479  1,837

Both past two standard errors, and the mix is the one the reading predicted: the colour hands are
kept (326 against A's 59 at the same table) and the cheap wins still come. The deal-in count and
cost barely move (1,221 at -12.42 against 1,343 at -12.39). So A's gain and A's loss were two
different things, and the plan gate separates them.

**Named before the run, the confirmation:** the same test on deals 7940001 to 7942000, both fields.
B counts as ahead only if the second sample against three Coaches is also past two standard errors;
the recorded-field figure is confirmed the same way because it is cheap (four minutes).

**Confirmation against three Coaches, 2026-09-28 02:00 to 02:28, deals 7940001 to 7942000:**
+0.393 +/- 0.159, t 2.5, hands won 1,818 against 2,109. Pooled with the first sample, 16,000
paired deals: +0.386 +/- 0.114, t 3.4. **Candidate B is ahead by the rule set before the run.** The
first sample did not shrink on fresh deals, which is the difference from A.

**Confirmation against the recorded players, 02:28 to 02:36, the same deals:** +0.750 +/- 0.150,
t 5.0, hands won 3,179 against 3,784. Pooled with the first sample: +0.759 +/- 0.105, t 7.2. So B
clears the gate on both fields, twice. It ships as the Coach's discard rule: inside `rankDiscards`,
so the Coach that teaches, the Coach that plays the Play tab's opponents, and the Coach that stands
in for strong players in every future money test are one player (`D-035`).

**The shipped integration, checked against the measurement, 2026-09-28 02:42 to 03:10.** With B
inside `rankDiscards`, `policymoney.ts --pure` plays the Coach as it was in arm B against the
shipped Coach in arm A, on B's own deals (7930001 to 7932000). First run, the other three chairs
holding the new Coach: −0.416 +/- 0.151, t −2.8, hands won 1,927 against 1,531; arm A's chips
exactly 0, as four identical players must give. That is B's sign and size in a field of Bs, not the
exact mirror, because the field is not the one B was measured in. The exact check, three old
Coaches in the other chairs (`--field pure`), ran 03:13 to 03:48: **−0.482 +/- 0.160, t −3.0, hands
won 2,137 against 1,786.** Not the exact mirror: B's first sample on the same deals was +0.378 +/-
0.162 with 1,800 against 2,110. The same direction and a size 0.10 apart on a standard error of
0.23 for the difference, so the shipped Coach is measured to beat the old one by at least as much
as B did; but decision for decision it is not the same bot as the one measured, and the difference
has to be named, not waved at. The one thing that differs by construction: B played from
`policy-a.json` at full precision and the shipped `policy.weights.ts` carries the same weights
rounded to six decimals, which can flip a near-tie, and one flipped tile changes the rest of a hand.

**Named before the run, the identity check:** `policymoney.ts --weights solver/src/policy.weights.json
--hybrid --field pure` on the same deals, which plays the harness's own HybridBot with the rounded
weights against the shipped Coach. If the integration is the bot that was measured, given the same
weights, the result is exactly 0.000 with identical hands won, like the self-check. Anything else is
a difference in the code, to be found.

**Identity check, 03:51 to 04:32: exactly +0.000, hands won 2,137 against 2,137, chips 3,859
against 3,859.** The shipped `rankDiscards` and the harness's HybridBot make the same decision on
every one of 8,000 paired deals when they hold the same weights. So the whole of the −0.482 against
−0.378 gap is the rounding of the weights to six decimals, which flips near-ties, and the figure
that belongs to the shipped Coach is the mirror's: **+0.482 +/- 0.160 over the old Coach on B's
deals in the old field**, alongside B's own +0.378 +/- 0.162 and +0.393 +/- 0.159 unrounded. The
rounded weights stay: they measure no worse, and a fit that lives on a sixth decimal is not a fit.

**Open with it:** if a model wins, the Train tab can no longer say "Why 6條" in the Coach's words for
the picks where they disagree. That is a design decision for Changs, and it is not needed until
something actually wins money.

### Is the judge right to decline wins? The direct money test, then the fix

**Uncertainty addressed:** Over two thousand pack questions have a measured best that declines an
offered win. D-027 stopped the Play review from marking a taken win wrong, on the evidence of a
fixed-bar stand-in for the judge. Changs asked on 2026-09-17 for what is right rather than for the
quick option of dropping those questions, so the judge itself is tested before anything is done.

**The whole job, in order:**

1. Test the judge's own win verdicts for money: a Coach that follows the judge whenever it may win
   or decline, against the Coach that always wins, on paired deals.
2. If the judge loses, find why. Three causes are already excluded (`R-001`); the next candidates are
   what the declining seat's own play-out bot does afterwards, and whether the payoff counted for a
   branch that continues is complete.
3. Fix the judge, and show the fixed judge's win verdicts pass the same money test.
4. Re-judge every win-offered question in all three packs with the fixed judge, rebuild the packs
   with their verification pass, and ship. Only then does D-027's guard come out of the Play review.

**What was built for step 1:** `datagen/src/judgewin.ts`. The judged seat plays the Coach, and at a
win it may decline it runs `rejudge` on the real position exactly as the app does (256 play-outs,
simple bots, hidden tiles re-dealt) and follows the best action. Self-check before any result: with
the judge forced to take every win, the hand-driven loop returned exactly 0.000 against the Coach
over 60 paired deals, so the loop plays the same games as the engine's own.

**Named before the run (step 1):** 2,000 deals per seat in all four chairs, 8,000 paired deals per
run, the judge at 256 play-outs, seed 424242.

    table              run folder          against three Coaches     against the recorded players
    0 Jokers, min 1    run-min1-nowild     7730001 to 7732000        7740001 to 7742000
    4 Jokers, min 1    run-min1            7750001 to 7752000        7760001 to 7762000
    4 Jokers, min 2    run-coach2          7770001 to 7772000        7780001 to 7782000

A result counts at more than two standard errors.

**Status:** Step 1 RUN, 2026-09-17, finished 17:41. Steps 2 to 4 wait on the result below.

**Findings, step 1:**

    table              against three Coaches               against the recorded players
                       declined   judge minus Coach       declined   judge minus Coach
    0 Jokers, min 1       24%     -0.221 +/- 0.041         22%     +0.093 +/- 0.043
    4 Jokers, min 1       51%     -0.327 +/- 0.072         53%     +0.683 +/- 0.087
    4 Jokers, min 2       51%     -0.321 +/- 0.079         53%     +0.810 +/- 0.089

Every one of the six is past two standard errors, and the two fields point opposite ways at every
table. Following the judge on wins loses a fifth to a third of a chip a game against Coaches and wins
up to eight tenths against the recorded players. So the judge is neither right nor wrong about wins:
it is right against players like the ones its play-outs use, and wrong against players who punish a
hand that waits. The fixed-bar test behind D-027 lost on both fields, because a bar declines cheap
wins blindly; the judge declines the ones worth declining against weak players.

**What this changes about the job:** there is no single fix for step 3. What is correct at Changs's
table depends on how his opponents play, which nothing here has measured.

**Owner answer, 2026-09-17:** his opponents are strong (`Q-012`). So the target is a judge that is
right against strong players. The Coach field is the project's stand-in for strong players; that is
an assumption, not a measurement of real people (`A-006`).

**Step 3, named before the run:** the same money test with the judge's play-outs played by the Coach
(reading danger at the table's Joker count), following it on wins, against three Coaches.
`judgewin.ts --judge coach --decisions wins --field coach`, 2,000 deals per seat, all four chairs.

    table              deals
    0 Jokers, min 1    7790001 to 7792000
    4 Jokers, min 1    7800001 to 7802000
    4 Jokers, min 2    7810001 to 7812000

If the Coach-played judge does not lose to always taking the win against strong players, it is the
judge for Changs's table on wins.

**Step 3 result, finished 2026-09-24 (the Coach-played judge is slow: 2 to 4 days of play-outs per
run).** It loses by more than the simple judge does, at every table:

    table              offers judged   declined   Coach-played judge minus Coach
    0 Jokers, min 1        2,302          34%      -0.345 +/- 0.045  (t -7.7)
    4 Jokers, min 1        3,447          59%      -0.425 +/- 0.089  (t -4.8)
    4 Jokers, min 2        3,413          57%      -0.455 +/- 0.095  (t -4.8)

So no judge this project has beats the plain rule at a strong table: **when you can win, win.** The
simple judge loses 0.22 to 0.33 chips a game by declining, the Coach-played judge 0.35 to 0.46. Step 3
is answered, and the answer is that the fix is not a better judge. Claims follow once their cost is measured: a smoke run following
the Coach-played judge at every claim took more than ten minutes for twelve deals.

**Claim cost, measured 2026-09-17:** following the Coach-played judge at every claim took 1,115 seconds
for 12 paired deals, 42 claim decisions at 26 seconds each, and it said pass on 57% of them. At that
rate the named test is about 200 hours on one worker. The simple judge took 13 seconds for the same
12 deals.

**So claims go in the order the money allows.** First the question that is cheap and decides whether
anything else is needed: do the pack's current claim answers, the simple judge's, lose money against
strong players? `judgewin.ts --judge shanten --decisions claims --field coach`, 2,000 deals per seat,
all four chairs, queued after step 3.

    table              deals
    0 Jokers, min 1    7820001 to 7822000
    4 Jokers, min 1    7830001 to 7832000
    4 Jokers, min 2    7840001 to 7842000

If they do not lose against the Coach's own claim rule, the pack's claims are fit for a strong table
and the 200-hour test is not needed to decide anything. If they lose, the claims are re-judged, and
the cost of doing that properly is the next thing to solve.

**Result, 2026-09-24.** Following the simple judge at every claim, against three Coaches:

    table              decisions judged   passed   judge minus Coach
    0 Jokers, min 1        23,043          42%     -0.137 +/- 0.140  (t -1.0)
    4 Jokers, min 1        18,149          44%     -0.240 +/- 0.143  (t -1.7)
    4 Jokers, min 2        19,142          43%     -0.380 +/- 0.153  (t -2.5)

Only the third is past two standard errors. **But these runs carry the win defect**: `--decisions
claims` also follows the judge when a win is on offer, and declining wins is already measured to cost
0.22 to 0.33 a game at these tables. So this cannot say what Pong and Chow decisions alone are worth.

**Named before the run, the separation:** `--decisions calls`, which follows the judge at every Pong,
Chow or pass with no win on offer, and takes every win. Same fields, same sizes.

    table              deals
    0 Jokers, min 1    7850001 to 7852000
    4 Jokers, min 1    7860001 to 7862000
    4 Jokers, min 2    7870001 to 7872000

**Result, 2026-09-24, and it clears the claims.** With every win taken, following the judge on Pong,
Chow and pass is worth nothing to a third of a chip a game, and never loses:

    table              decisions judged   passed   judge minus Coach
    0 Jokers, min 1        20,383          43%     +0.150 +/- 0.133  (t 1.1)
    4 Jokers, min 1        14,464          41%     +0.102 +/- 0.122  (t 0.8)
    4 Jokers, min 2        15,553          41%     +0.338 +/- 0.141  (t 2.4)

So the whole loss in the claims runs was the win decisions. The pack's Pong and Chow answers are fit
for a strong table, which agrees with the Pong bar sweep that found nothing beats the shipped rule.

**The job's answer.** One defect, not two: a win on offer must be taken, and everything else the packs
teach stands. Step 4 is the fix.

**Step 4, done 2026-09-26: the rule is written into the pack data.** Changs was offered two ways to
carry it: fix the pack files, or leave them wrong and override in the app. He answered "Not
shortcut", so the builder does it (`D-033`).

`datagen/src/quizpack.ts` marks any question that offers a win with `rule: 'win'`, stores `best` as
the win, and the verify pass keeps rule questions even where the fresh play-outs fail the separation
test and re-asserts the win after re-judging. `solver/src/question.ts` carries the mark.
`web/src/components/Train.tsx` reads it: taking the win is "Best move", passing is "Mistake", the
"Given up" figure is not charged, the money bars and the Challenge button are left off, and a
paragraph says why the bars are absent.

**Measured on a 199-question test pack built from `run-min1-nowild`** (deleted afterwards): 34
questions carry the mark, all 34 store `best` = win, and 0 questions offer a win without it. On 6 of
the 34 the play-outs preferred passing, which are the ones the rule changes; each was served to the
app by name and answered both ways. The ten passes for this change are in `MISTAKES.md`, dated
2026-09-26, with the two defects they found.

**The three packs rebuilt, 2026-09-27**, from their graded runs at `--max 12800 --mix decisive
--verify 512`, one after another on the Mac (`data/gen/rebuild-chain.sh`, 16:02 to 23:09, 143, 132
and 146 minutes of verify):

    pack          questions   offer a win   marked   play-outs preferred otherwise   dropped at verify
    coach           10,547       2,030       2,030              814                   2,247 of 12,800
    min1            10,528       2,332       2,332            1,217                   2,266 of 12,801
    min1-nowild     10,291       1,030       1,030              153                   2,502 of 12,800

Every question that offers a win carries the mark, in all three, and 0 shard tallies disagree with
their files. Before the rebuild the same packs answered "decline" on 790, 1,179 and 130; those are
inside the fourth column, which is larger because the fresh 512 play-outs preferred passing on more
of them than the original 128 had. The builder's "best changed on" line counted those in (197, 1,246
and 846 against 31 to 44 a fortnight earlier); it now counts rule overrides apart.

The packs are on the site. The ten passes against them are in `MISTAKES.md`, 2026-09-27, and found
one thing the test pack had not: a self-draw win question was headed "Kong, or keep the hand as it
is?" over the choices "Win" and "No kong". It now reads "Win, or play on?" over "Win" and "Play on".

**One thing that looked like a second defect was not.** On 3 of the 6 positions the screen said the
Coach would pass. The Coach does not: `CoachBot.chooseClaim` takes a win before it asks
`claimAdvice`, and over the 595 claim questions in the 0-Joker pack that offer a win it declines 0.
The Train screen was running `claimRank`, the learned model, which declines 278 of the same 595. One
line in the screen now takes the win first, as the bot does (`Q-013`). Nothing was measured with a
win-declining field, so the results above stand unchanged.

### Should the Coach call Pong more or less at a no-Joker table?

**Uncertainty addressed:** On 2026-09-17 a judge with the Coach in the play-outs said pass on
positions where the pack says Pong. A count of changed answers cannot say which is right.

**Origin:** Changs chose the money test over re-grading, 2026-09-17.

**What was built:** `datagen/src/coachgrade.ts --select pong`, which judges every chosen Pong
question twice on the same deals, and `datagen/src/pongmoney.ts`, which plays paired deals where one
seat's Coach holds Pongs to a different bar from the shipped 0.4 chips. Self-check before any
result: at a bar of 0.4 it returns exactly 0.000 against the shipped Coach on both fields, with the
same Pong count, over 240 paired deals each.

**Named before the run:**

- Stage one: 600 of the 2,193 0-Joker pack questions whose best is Pong, hashed by id, at 256
  play-outs, simple bots against the no-Joker Coach.
- Stage two: Pong bars 0, 1.5 and 3 against the shipped 0.4, 2,000 deals per seat in all four
  chairs, 8,000 paired deals each. Deals 7710001 to 7712000 against three Coaches, 7720001 to 7722000
  against the recorded personalities. A bar is called better only at more than two standard errors.

**Status:** RUN, 2026-09-17, finished 02:43.

**Findings:**

1. **Stage one.** With the Coach in the play-outs, 73 of the 600 Pong answers clearly flip to pass
   (12.2%), and 40 of those 73 are late in the hand, against 194 of 600 positions overall. The simple
   bots still say Pong on 594 of 600, which is the control. Pong's value over passing falls from +3.35
   to +2.11 on average, so the Coach bots like these Pongs less, not usually enough to pass.
2. **Stage two.** Passing more Pongs never won money:

       bar   against three Coaches      against the recorded players
       0     -0.005 +/- 0.023           +0.043 +/- 0.029   (calls more)
       1.5   -0.014 +/- 0.035           -0.040 +/- 0.038
       3     -0.046 +/- 0.051           -0.107 +/- 0.053   (t = -2.0, calls fewest)

   Nothing beats the shipped 0.4 by two standard errors. The bar that passes the most Pongs is the
   only result past two standard errors, and it loses.
3. **So the pack's Pong answers stand**, and the Coach-played judge's pass verdicts on them are not
   borne out in money. The shipped bar of 0.4 stays.

**What it does not establish:** Stage two tests a bar applied to every Pong, not the 73 flipped
positions one by one. A rule that passes exactly those, late in the hand, was not played.


### The claim judge

**Uncertainty addressed:** `R-001`. Whether the whole-hand judge can be trusted on the decision to
take a win or make a call.

**Origin:** Agent proposal, recorded in `NEXT.md` on 2026-09-12 and in `PLAN.md` Phase 7. Run on
2026-09-13.

**Why construction rather than another method:** Nothing could be read that answers it. The claim
in the record was about a mechanism inside the play-outs, and the only way to test a mechanism is
to vary it and see whether the number moves.

**What was built:** Two tools in `datagen/`, both small and both kept. `winprice.ts` takes recorded
positions where a win was on offer and could be declined, and judges each under interchangeable
arms on the same seed and the same play-outs - a different rollout opponent, or the hand's real
hidden tiles instead of guessed ones. `declinewin.ts` runs the project's paired-money design over
a coach that declines cheap wins against one that does not.

**Findings, 2026-09-13:**

1. **The stated cause is wrong.** Swapping the rollout opponents for the Coach moves the gap by
   -0.48 against a standard error of 0.35, and in the opposite direction to the prediction.
2. **The hidden-tile guess is not the cause either.** Using the hand's real tiles moves it by
   +1.13 ± 1.15, and of the 23 positions where the judge declines a win, the real tiles agree with
   it on 19.
3. **The judge is nonetheless wrong.** Declining cheap wins loses money at every threshold and
   against both fields, 0.229 chips a game under two *Tai* and 0.944 under three, over 8,000
   paired deals each. An effect that grows with the dose is a real one.
4. **So the cause is unknown.** Three explanations are excluded and none replaces them.

**What was accepted into the project:** `D-027`, the review no longer marks taking a win as a
mistake. `R-001` rewritten and narrowed. The `FINDINGS.md` entry replaced - the old one asserted
a mechanism from a single played hand, and the mechanism was not there.

**What it does not establish:** Anything about *Pong* and *Chow*. The money test covers declining
a win, not calling a tile, and the two are different decisions. Saying so is the point: the
previous entry generalised from one hand to every claim, and that is what went wrong.

**Status:** RUN, and it produced a decision. The follow-on - finding the cause, and the same money
design applied to calling - is recorded in `R-001` under Resolution Method, not here.

