# Where we left off — 2026-09-06, evening

Read this first. `PLAN.md` is the project. `FINDINGS.md` is everything we measured and why.

## Three things happened today, in the order they were asked for

**1. Every mistake now has a cause.** The method's eighth idea, and the first product change in
days. `solver/src/cause.ts` reads what it can off the position - the shape tip the throw broke, a
throw that cost a step, the wrong plan, the more dangerous tile - and the Train tab asks one
question at the moment of the mistake with that suggestion marked. `mistakes.ts` keeps the
suggestion and the answer; Review shows the tally in every state of the tab and names the cause
that keeps coming up. Checked in the browser end to end. What is not done: nothing yet points the
Train tab AT the leading cause - a "practise this" that draws hands where that cause bites is the
next step on that screen, and the natural one.

**2. A table fitted across both fields wins on one and loses on the other.** The generator can
now pin one seat to a plan and draw the other three from the personality pool (`--bots
plan_x,pool,pool,pool`), so committed value runs exist against the field as well as against
coaches. The two fields disagree about weights and not about ordering, which is the case where one
table across both makes sense. Pooled by hands and played at the usual gain, against the shipped
row-scaled coach:

```
  against three coaches    32,000 paired deals   +0.131 +/- 0.054   t = +2.4, 4 of 4
  against the field        32,000 paired deals   -0.098 +/- 0.055   t = -1.8, 1 of 4
```

Half the field loss gone, not all of it. Not baked; tracked as `tables-both-g1.30.json` beside the
committed candidate. The two untried knobs are both one line in `valuerows.ts`: weight the field's
cells above half, and pick the gain on the field's decisiveness rather than the coach table's.

**3. A third field exists.** `NoisyCoachBot` is the coach with the personalities' randomness over
its own ranking - the nearest thing here to a competent player who is not a machine - and
`fieldtest.ts --field noisy` plays it. The pooled table against it, on 1570001..1600001: +0.089
+/- 0.059, t = 1.5, positive on 4 of 4. So a noisy coach sits on the coach side, not the
personality side - the three fields line up as coaches +0.131, noisy coaches +0.089, personalities
-0.098 - which says the personality field is a different KIND of opponent, one that never plays
for a colour hand and never punishes a slow hand, rather than a careless one. Noise is not what
separates the fields. Whether anything is in the middle is the open question, and no human has
been measured.

## Standing facts

The shipped coach is the row-scaled table, which holds on both fields. Any value change plays on
both fields before it bakes; that is the bar. The playbook has a verdict on all 103 cards and the
matched baseline is the column to quote. `main` is fast-forwarded to this branch at the end of each
session; there is no remote and the local checks are the checks.

## The framework exists now

`Framework - Mahjong.md` is in this folder, written 2026-09-06: the parts of the skill, the pattern
library with its verdicts, how dishonest the feedback is and what to grade against instead, the
eight mistake causes, seven stages, and an hour on Tuesday, Thursday and Saturday. It names the
eighteen contradicted cards so the plan cannot teach them.

Two things about it to keep true. It quotes counts and figures from `tips.ts` - 59 measured, 4
confirmed, 6 table rules, 16 advice, 18 contradicted - and every one was checked against the code
when it was written, so re-check them if verdicts change. And it deliberately has no
`Pattern Library.md` or `Mistakes.md` beside it, unlike `Chess/`, because here both are software.

## The record hears from the honest grader now (2026-09-06)

Until today only the Train tab fed the mistake record, so every card in it was judged by the coach -
which picks the play-outs' best 52.8% of the time on decisive positions and 36.1% early. The Real
quiz, graded by 128 play-outs an option, threw its verdicts away after each question.

A record now carries either a seed and a phase (a Train card, rebuilt by `makeScenario`) or a pack
and a question id (a quiz card, rebuilt by fetching the pack). Review renders both, grades a quiz
card against the pack's measured best rather than the coach's opinion, says which judge each card
came from, and counts the two separately in the diagnosis. A quiz card whose pack has since been
rebuilt cannot be found by id, and that path is handled with an explanation and a button to drop it.
Discards only: a claim question is a different question and the review screen cannot pose it.

## Where to start next, in order

**1. Done on 2026-09-06: the Train tab points at the leading cause.** `causeOf` in `scenario.ts`
runs the record's own `suggestCause` on the TEMPTING throw, so a generated trap is labelled with
what it teaches before anyone throws; `makeScenarioFor` walks seeds until the label matches.
Measured before it shipped: 45% of seeds are traps, a third of those teach "miscounted", a fifth
"wrong plan", and the two rarer labels sit near one in thirty seeds; drawing to order matches 9 to
12 times in 12 inside a 40-seed walk at 190 to 530 ms a draw. Four causes are about the player and
not the hand and are not offered. The Train tab has the selector, every hand shows what it
teaches, and Review's diagnosis hands off with one button. Checked in the browser end to end.

**2. Done on 2026-09-06, and both knobs are dead.** The gain the field wants is the gain the coach
table wants - 1.30 either way - so decisiveness was never where the loss lived. And weighting the
field's cells two or three times in the pool loses against the field by the same 0.10 as the
50/50 pool, within a hundredth. A family of one multiplier per row cannot separate two fields
whose committed rows differ by a fifth at most. Nothing baked; the shipped coach stays the
row-scaled table, which holds on all three fields. What is left is not a knob: fit the field
alone as the limit case, and sweep the danger weight against the field, because every losing
candidate gets ready sooner and wins smaller and that is the danger weight's territory too.

**3. Done on 2026-09-06: the Spot drill asks why.** A miss on the drill offers four causes, narrower
than the throwing record's eight because the drill trains seeing - did not take it in, ran out of
time, misread what was seen, guessed - recorded against the question kind in `spotstats.ts`. The
drill shows the tally per kind, and Review's diagnosis names the spotting miss that keeps coming up
and says which kind of problem it is: out of time or not taken in is a looking problem, misread is
a deciding one. Checked in the browser end to end.

## Where to start next, in order

**1. Done on 2026-09-06, and it closes the value-table programme.** A table fitted on the field's
committed cells alone, at a field-matched gain, plays the field level: +0.028 +/- 0.050 over 32,000
paired deals. The gradient across every fit is monotone - coaches only -0.210, both 50/50 -0.098,
field x2 -0.106, field x3 -0.104, field alone +0.028 - so the field loss really was the weights, and
fixing them removes all of it and produces no gain. Two tables 43% apart in their numbers play that
field to a draw on every line of the breakdown. The shipped row-scaled table is at this family's
ceiling for both fields. Anything further has to change the SHAPE - per-breakdown corrections
rather than per-row, or a term these tables do not have.

One correction went into FINDINGS with it: the earlier entry said a one-multiplier-per-row family
"cannot separate two fields however the pool is weighted". Three flat readings at half, two thirds
and three quarters invited that, and the limit case disproves it. The family can separate them; the
weights tried were not extreme enough to show it.

**2. Sweep the danger weight against the field.** Every losing candidate gets ready sooner and
wins smaller, which is the danger weight's territory as much as the value tables'. It has only ever
been swept against coaches (`dangersweep.ts`); the same sweep with the field in the other chairs
is a `--field` flag away, and would say whether the field's answer is "defend less" rather than
"value differently".

**3. The mistake record now has causes on both drills; nothing yet joins them.** The Train tab
practises the leading throwing cause. The Spot drill has a look-time control and no link from the
"ran out of time" tally to it. That link - lengthen the look automatically while that cause leads,
then shorten it - is the drill's version of "practise this", and it is small.
