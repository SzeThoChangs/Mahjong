# Source coverage — what carried over, what did not

Source: a 136-tip Riichi (Japanese) strategy book, read in full (94 page captures,
5 chapters + 5 columns + glossary). Reviewed tip by tip and sorted into what
survives translation to Singapore rules.

**77 concepts kept** — see [tactics.singapore.json](tactics.singapore.json).
57 port directly, 19 needed re-tuning for tai scoring, 1 is a weak prior.

**~55 dropped.** Nothing kept is source text; the entries restate game mechanics
and probability facts in Singapore terms.

## Dropped, by reason

### Dora machinery — no equivalent (~15 tips)
Dora, ura dora, red fives, dora indicators, kan dora. Roughly a seventh of the
book is built on tiles that gain value by a flipped indicator. Singapore has no
such mechanic, so these tips are not merely re-tunable, they are inapplicable:
"aim for the ura dora", "tiles near the dora are precious", "don't wait on the
dora indicator", "a pair of fives is worth 0.5 han", "show off your red doras".

A few had a transferable core, which was extracted and re-derived: counting live
copies before committing to a wait, and locking a valuable tile into an exposed
meld so you are never forced to release it.

### Riichi declaration mechanics (~15 tips)
Riichi itself, double riichi, chasing riichi, silent tenpai, one-shot, one-shot
cancel, "riichi is worth 1.5 han", "don't be the third to riichi". All assume a
declaration that locks the hand in exchange for a scoring bonus.

Kept where the underlying idea was about **visible commitment** rather than the
declaration: fear the chaser more than the initiator, take ready under pressure,
and don't be the third fighter — all restated against Singapore's actual
commitment signals, which are meld patterns and discard tempo.

### Locked-discard (furiten)
No Singapore equivalent. Two tips are purely about exploiting it. One consequence
is worth noting positively: widening your wait when opponents fold is *cheaper*
here than in Riichi, because there is no penalty for having discarded your own
winning tile.

### Patterns absent from the tai table
Pinfu, All Simples, Three Colour Straight, Full Straight, Two Identical
Sequences, Seven Pairs. Around ten tips optimise toward these specifically.
Thirteen Wonders is the exception — it exists as a limit hand, so the tip on
holding pairs while chasing it was kept.

### Han/fu arithmetic and hand tiers
Fu calculation, mangan/haneman/baiman thresholds, "a Full Flush is at least 5
han". Singapore uses flat tai with a cap. Every value comparison had to be
recomputed rather than converted — Full Flush is 4 tai here, Half Flush 2, All
Pungs 2.

### Not-ready penalty
Several push/fold tips are driven by the penalty for ending a hand not ready,
including one whose entire conclusion is "passing on a win beats taking it".
Most Singapore tables have no such penalty, which removes the incentive.
Flagged inline in `folding_always_loses_slowly`; confirm against your table.

### Placement and match structure
Final-hand placement play, "be satisfied with 2nd or 3rd", dealer-continuation
management, East-South match pacing. These assume a fixed-length match scored by
finishing position. Singapore is normally money per hand, so the objective
function is different, not merely scaled. The *method* — enumerate outcomes for
push and for fold before committing — was kept; the placement conclusions were not.

### Rules not in play
Four Winds Abortive Draw. Open-kan costs, which are close to inverted in
Singapore: kongs here pay out immediately and grant a replacement draw, so the
Riichi warning against them is actively misleading. Only one downside survives —
revealing tiles costs you a future safe tile.

### Not about play
Online ranking systems, win-rate and call-rate statistics, streaming, mahjong
puns, and the author's afterword. The one substantive idea in this group was
kept: judge decisions, not outcome statistics.

## Gaps the source cannot fill

The book has nothing on these, and they are exactly where Singapore play is
decided. Original work required:

1. **Animals** — cat, mouse, rooster, centipede. Instant payouts on draw, pair
   bonuses, and on many tables an instant win on all four. No analogue exists in
   any Japanese variant. Their liability implications are the sharpest gap: feeding
   the fourth animal can trigger bao.
2. **Flowers and seasons** — seat matching, instant payouts, replacement draws,
   and the bonus-tile chains that follow.
3. **Bao / liability** — the feeder pays for everyone. This changes discard danger
   at a structural level, not by a tunable amount: some discards carry three
   players' worth of downside. Nothing in Riichi resembles this.
4. **The tai cap** — value above 5 tai is discarded entirely. Every "push for the
   bigger hand" tip in the source assumes value scales upward without limit.
   Handled in `push_only_if_it_matters`, but the whole offensive model deserves a
   pass with the cap in mind.
5. **Minimum tai** — the nearest analogue is Riichi's requirement to hold a named
   pattern, and one strong tip transferred from it (`narrow_can_beat_wide`). The
   rest of the interaction with wait selection is unexplored.
6. **Kong economics** — instant payouts plus replacement draws make kongs
   attractive here and unattractive there.

## Capture gap — closed

Pages 138–139 were initially missing and have since been captured. Both tips were
kept, and the second turned out to be one of the strongest reads in the book:

- **`second_copy_call`** (reading) — which *copy* of a value tile gets called is
  the signal. First copy passes uncalled, second copy gets ponned: that hand is
  cheap but assembled. Anyone holding real value would have taken the first copy
  even on an awkward shape; anyone cheap *and* badly shaped would have passed the
  second too and kept it as a safe tile. This is a different family from
  `two_set_gap` — that one measures tempo from completed sets and says nothing
  about value, this one gives you the value estimate. They compose: one tells you
  an opponent is ahead, the other tells you whether it is worth fearing.

- **`spread_not_rate`** (meta) — deal-in rate is not a target. The spread between
  winning and feeding is what matters; a player who never deals in but rarely wins
  loses to one who does both freely. The source's benchmark numbers were dropped:
  they assume a not-ready penalty, riichi sticks and placement scoring. Doubles as
  the correct objective for evaluating the AI, since optimising deal-in alone
  converges on a bot that folds every hand.

No known gaps remain in the source set (95 captures, pages 8–197).
