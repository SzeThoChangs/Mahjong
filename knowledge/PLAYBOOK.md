# Singapore Mahjong — combined playbook

Two sources merged into one, organised by **the decision you are making** rather
than by which book it came from.

- **Measured** (20 rules) — simulated Singapore data. Numbers you implement.
- **Heuristic** (77 rules) — adapted from a Riichi source. Judgment you calibrate.

**When they disagree, measured wins.** It is native Singapore, simulated against
the actual rules, and it already corrected one factual error in the adapted
material. The heuristics fill the gap the analytic source leaves: which tile to
keep when two look equally good.

*(Fan and tai are the same unit — one doubling. Different dialects.)*

---

## Your table: Min 2 / Max 5, Self-Draw wins at 1

Everything below was written against Minimum Fan 1. Your table is Minimum Fan 2
with a house rule that a **Self-Draw (zi mo) wins with 1 Fan**. That shifts the
opening book meaningfully:

| Target | Best choice at MF1 | **at MF2** |
|---|---|---|
| Half-Color | 25% | **32%** |
| All-Chow | 22% | **26%** |
| Ping Wu | 24% | 24% |
| All-Pong | 9% | **14%** |
| Chicken | 20% | **4%** |

**What this means in practice:**

- **Chicken stops being a plan.** A 0-Fan hand needs 2 Fan from elsewhere to win on
  a discard. It survives only as the Hybrid fallback — and the fallback is *armed*
  only when you already hold 2 Fan (or 1 Fan and you draw it yourself).
- **Half-Color gets easier, not safer.** Break-even drops to Rule 961 ≥ 21 at the
  deal (was 23), 29 at turn 20, 34 at turn 40, and the same tiles win ~30% more
  often because everyone else takes longer to reach 2 Fan. It is still the one hand
  with no exit.
- **All-Chow is better than the numbers say.** A bare All-Chow is 1 Fan — and on
  your table that is a **legal Self-Draw win**. The All-Chow discard restriction
  never applied to Self-Draw anyway. The MF2 tables don't credit this.
- **Any 1-Fan hand is alive but Self-Draw-only.** You can't win it on a discard, so
  wait *width* is everything. A 1-Fan Self-Draw pays 12 chips (4 from each); a
  2-Fan discard win pays 16. Not far apart — don't throw a 1-Fan hand away.
- **Kongs pay double.** Kong-1/3 = 4 from each opponent, Kong-4 = 8, Animal or
  Flower set = 8. A Kong-4 is 24 chips on the spot, more than a 2-Fan discard win.
- **Games run longer:** ~48 Player Turns (was 43), 14% drawn (was 8%). Shift every
  turn-indexed threshold right by about five turns, and give yourself more rounds
  before judging a bad night — variance is wider too.

*The Self-Draw exemption is not in the source, so its value is reasoned, not
measured. Re-measure once the engine can simulate it.*

---

## At the deal — what am I playing for?

**1. Look at your Flowers and Animals first.** Before the tiles. This is the
biggest single predictor of how the hand goes, and you have no say in it:

| | chips/game |
|---|---|
| Flowers worth 2+ Fan | **+10.3** |
| Flowers worth 1 Fan | +0.7 |
| No flowers at all | −1.0 |
| **Flowers worth 0 Fan** | **−4.3** |

Useless flowers are worse than none — they burn replacement draws, tell people
what you have, and lock you out of Ping Wu.

**2. No flowers? Play Ping Wu.** Right about three quarters of the time.

**3. Otherwise score the hand four ways and take the best.** Rule 4213 for
Chicken, 961 for Half-Color, 5313 for All-Chow, and the Triplets:Pairs ratio for
All-Pong. Convert each to a chips range and rank them. There is no default target
— every fixed strategy loses money.

**4. Pick a primary AND a fallback.** Fallback is Chicken. Worth +3.4 chips/game.

> **The Half-Color exception.** Half-Color has no fallback — you have thrown away
> two whole suits, so if it fails you cannot bail. It is the most dangerous
> commitment on the board and deserves a higher bar than its 2 Fan suggests.

**5. Don't count on flowers you haven't drawn.** Getting even one more Fan from
flowers is under even money at the deal and worse after.

---

## Each turn

**Count Player Turns** — discards plus exposed sets, across the whole table. Every
threshold below moves with it.

**Re-score your hand against *this turn's* break-even, not the deal's.** Half-Color
needs Rule 961 ≥ 23 at the start, ≥ 30 by turn 20, ≥ 35 by turn 40. Same tiles,
rising bar. A strong hand that stops improving quietly becomes a losing one.

**Below the bar? Switch, drop to the fallback, or fold.** Do not continue on
inertia. Grinding a hopeless hand doesn't just cost you — it pays everyone else,
because you lengthen the game and stop controlling tiles.

**Scan the threats.** Per opponent: exposed sets, own-suit discards, what they
declined to call, and whether they discarded the tile they just drew or one from
hand.

- Three exposed sets by turn 40 → **~83% they're ready**
- Half-Color player discards one tile of their own suit → **25–73% ready**; two → **44–86%**
- First copy of a value tile passes uncalled, then they pong the second → **cheap hand, but assembled**

**Then commit: push or fold. Binary.** Developing a hand while only discarding
safe tiles is the worst of both. Ask what *your* hand is worth before you worry
about their wait.

**If pushing** — rank discards by shape, then filter by measured risk, take the
best survivor. *This is the whole point of merging the two books: heuristics
propose, data disposes.*

**If folding** — ignore shape completely. Order by safety alone:

1. Tiles that opponent discarded themselves
2. Tiles already discarded once by anyone
3. Low Chow Combinational Value — Honors are 0, terminals max 16, middle tiles max 48
4. Honors you hold two of

**Calls** — does it advance the target, secure Fan, or steal tempo? Never break
your only pair. Before a third call, ask honestly whether the hand can still
fight. Remember calls skip players: with only ~11 turns each, that's real value.

**Take the fallback win when it appears.** Almost always correct — the exceptions
are about 1 game in 2300.

---

## Endgame

As the wall empties, watch **Fresh Tiles** — a tile nobody has discarded. Below
roughly 4–8 remaining (table dependent), throwing one that wins makes you pay for
everybody.

On All-Pong this bites hardest: you ponged every matching discard along the way,
so the pairs left in your hand are Fresh by construction and you'll have nothing
safe. Bank a safe tile earlier than feels necessary.

And there is **no penalty for ending not-ready** — so unlike Riichi, never force a
bad ready hand at the close.

---

## Two things that aren't about tiles

**Seat matters.** Same logic in every seat: East wins 24.7% and makes +1.0
chips/game; North wins 21.3% and loses 1.1. Some of a bad night is just turn order.

**You get about 11 turns a game.** One turn is ~9% of everything you do. There is
no spare turn — and 11 decisions is a small enough sample that variance is large,
which is the honest answer to most "why did I lose" questions.

---

## Judging the AI

- **Control for seat**, or you'll measure turn order instead of skill
- **Target ~23% win rate** against equal opponents (8% draws at Min Fan 1, 14% at Min Fan 2)
- **Score win-rate minus deal-in rate.** Optimise deal-in alone and you converge on a bot that folds everything
- **Watch the target distribution.** Trending toward one combination is a bug, not a style

---

Machine-readable: [playbook.json](playbook.json) — 102 rules plus a 22-step
decision procedure with cross-referenced rule ids.
