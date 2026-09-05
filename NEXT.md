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

**3. The Spot drill has no cause either.** The same question, asked after a wrong answer there,
would sort spotting failures from deciding failures, which is the distinction the framework says
matters most.
