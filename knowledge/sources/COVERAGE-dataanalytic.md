# Source 2 coverage — *A Data Analytic Evaluation of Singapore Mahjong*

259 pages, 116 captures. A formal rulebook plus a simulation study: the author
ran millions of computer games and regressed tile-evaluation heuristics against
the outcomes. This is a **native Singapore primary source**, so the job was not
translation — it was extraction and verification.

## What this changed

**The scoring file was wrong and has been replaced.** My earlier
`scoring.singapore.json` was built from general knowledge and got the **values**
wrong. (Not the unit name — *fan* 番 and *tai* 台 are the same unit, one doubling,
just Mandarin/Cantonese versus Hokkien. Singapore tables use both.) What was
actually wrong was the scale and the numbers on it:

| I had guessed | Actually |
|---|---|
| Full Flush 4 | Full-Color **4** ✓ |
| All Pungs 2 | All-Pong **2** ✓ |
| Half Flush 2 | Half-Color **2** ✓ |
| Thirteen Wonders 5 (my cap) | 13 Wonders **8** — the cap was my invention |
| — | Ping Wu **4** — a whole combination I had missed |
| — | All-Terminal **9**, Wind Set **12**, Eight Flower **12**, All-Kong **14** |
| payout ≈ base × 2^tai | chips = **2^Fan**, doubled for the discarder or on Self-Draw ✓ |

The old file is kept as `scoring.singapore.GUESS.json.bak` — **do not use it.**
The structural shape of my guess (additive, doubling payout, instant payouts,
bao) was right; the values were not.

**Ping Wu was the biggest omission.** All-Chow with no Flower or Animal tiles,
worth 4 Fan. When you start with no Flower or Animal tile — 32% of hands — it is
the optimal target **76%** of the time. I had no entry for it at all.

## What the source corrected in the Riichi knowledge base

One outright factual error, now fixed in `tactics.singapore.json`:

> **`widen_when_folding`** claimed Singapore has no locked-discard rule and that
> widening your wait therefore costs nothing. **Wrong.** Singapore does have one:
> you may not claim a tile matching your own last discard, nor any tile discarded
> by anyone *after* your last discard. It is rolling rather than permanent — it
> clears when you discard again — so it is milder than furiten, but it is real.

Two entries had direction hedged as "the player after you in turn order." Now
confirmed concrete: play moves **counterclockwise, to each player's right**, the
opposite handedness from Japanese convention. `squeeze_the_caller` and
`wind_discard_order` are updated. Any seat-name-based heuristic ported from a
Japanese source will target the wrong player.

Thirteen entries were **cross-checked and annotated** where this source confirms
or quantifies them. The convergences are worth noting because the two sources
share no lineage:

- `edge_waits_stronger` — the Riichi intuition that edge tiles come out more
  freely is measured here as Pong Pair conversion: Wind 69%, Dragon 66%, terminal
  59%, 2/8 48%, middle 39%.
- `flush_traffic_light` — my three-colour approximation is replaced by a real
  table. One own-suit discard puts a Half-Color player at 25–73% Calling depending
  on Exposed Sets; two puts them at 44–86%. 64% of Half-Color winners discard
  their own suit before winning.
- `two_set_gap` — three Exposed Sets at 40 Player Turns is ~83% Calling.
- `folding_always_loses_slowly` — weakened exactly as flagged. No not-ready
  penalty exists, so the Riichi incentive to force a ready hand does not apply.

## What is new and has no Riichi counterpart

1. **Four tile-evaluation functions**, one per target, each with break-even
   thresholds by turn count — Rule 4213 (Chicken), Rule 961 (Half-Color),
   Rule 5313 (All-Chow/Ping Wu), and the All-Pong Breakdown ratio. Plus a
   unified table converting all four onto a common Chips-per-Game scale, which
   is effectively a ready-made opening-move engine.

2. **The Hybrid strategy**, the largest strategic finding in the book: when
   playing All-Pong or All-Chow, keep Chicken alive as a fallback and take the
   Chicken win whenever it appears. Worth **+3.4 chips/game**. The consequence is
   counter-intuitive — a Hybrid All-Pong player wins more Chicken games than
   All-Pong games. Half-Color cannot do this, which is what makes it a genuinely
   dangerous commitment: it discards two whole suits, so there is no exit if it
   fails.

3. **Every fixed strategy loses.** Chicken −0.9, All-Chow −2.9, All-Pong −4.4,
   Half-Color −4.8, Full-Color −8.8, 13 Wonders −9.1 chips per game. Selection
   between targets *is* the skill; there is no strategy to settle on.

4. **Flowers and Animals dominate the deal.** By starting case: none −1.0,
   worth 0 Fan −4.3, worth 1 Fan +0.7, worth 2+ Fan +10.3. The striking result is
   that Flowers worth **zero** Fan are much worse than **no** Flowers — they burn
   replacement draws, leak information, and disqualify Ping Wu.

5. **A measured defensive model** — the gap the Riichi source could not fill.
   Chow prevention via three ranked methods (opponent's own discards, declined
   tiles with measured decay, then Chow Combinational Value), Pong prevention
   tables by opponent game type and turn count, and Calling detection by Exposed
   Set count.

6. **Seat advantage is real and large.** With all four players running identical
   logic: East +1.0 chips / 24.7% win, North −1.1 / 21.3%. Any AI benchmark must
   control for seat or it will measure turn order instead of skill.

7. **Turn scarcity.** Players average only **11 turns per game**. One turn is 9%
   of your game. Pong and Kong skip intervening players — tempo theft that appears
   in no Fan count.

8. **The full Pay All / liability system** — eight distinct scenarios, plus the
   rule that each player carries at most one Fan Limit infraction at a time.

## What was skipped, and why

**Sections 2.4 and 2.5** (roughly 20 pages) cover table etiquette and remedies
for irregular play: misdeals, exposed tiles, wrong tile counts, incorrect
declarations. The source states outright that these cannot occur in a computer
implementation. Noted in `rules.singapore.json` and not extracted further.

**Chapter 3** is terminology. Its vocabulary — Available Tiles, Player Turns,
Calling, Chips per Game, Two-Sided vs One-Sided Chow Pair, Unusable Pairs — is
used throughout the extracted files rather than recorded separately. One term is
worth adopting in code: **Player Turns** = discards + exposed sets, a single
integer measuring game progress that every table in the book is indexed by.

## Reading coverage

All 116 captures read. Every chapter and every major table extracted, including the
Minimum Fan 0 / 2 permutations (Sections 5.5, 7.6, 8.3, 9.4, 13.3) — now relevant
because the target table plays Minimum Fan 2. Those tables live under
`minimum_fan_2_overlay` in `strategy.dataanalytic.json`.

**One gap remains in the source set:** Section 6.5 — All-Pong at Minimum Fan 0 and
2, pages ~130–134 — was not captured (the captures jump from 129 to 135). Until it
is, the MF2 overlay carries the MF1 All-Pong tables with the general MF2 correction
(longer games favour higher-Fan targets). Worth recapturing.

## Open question for the source

Chapter 7 names the All-Chow evaluator **Rule 5313**; the unified table in
Chapter 10 labels the Ping Wu column **Rule 5312**. I have treated them as the
same method. Worth confirming before relying on any distinction between them.
