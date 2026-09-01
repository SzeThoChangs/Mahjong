# Where we left off — 2026-09-02

Read this first. `PLAN.md` is the project. `FINDINGS.md` is everything we measured and why.

## Nothing is running

All three ideas found in the tactics book have now been played for money. Counting the wait in tiles
that can legally win WON (+0.048) and is shipped. Reading the wall did not. Reading what an opponent
MELDED, rather than how many times, is the third, and it is the interesting one.

## The third read, and what it turned up (2026-09-02)

The read is `half_color_tell`: a player collecting a suit does not throw that suit, so the suit
missing from their discards is their hand. Measured on run-money4 it came out BACKWARDS - their suit
looked safer. The reason is that the recorded run has almost no colour hands in it. Its bots have no
colour target, so 1.29% of their wins are Half or Full Colour against 31.7% at a table of coaches.
The read was being looked for in players who do not make the play.

Measured again on 25,000 hands the coach played against itself (`reads.ts --coach`), the read is
right and large: a tile in their suit deals in to them at x2.03, rising to x5.52 late. Then played
for money over 16,000 paired deals on two seeds it returns -0.034 +/- 0.057. Nothing.

**That is four true reads in a row that pay nothing** (the wall, and now this). The coach's danger
term is not where the money is; it already prices every discard continuously and a better price does
not move it.

## What this leaves worth doing

**The training material, not the coach.** The quiz pack and the film room are drawn from the recorded
run, so a player practises positions from a game with 1.3% colour hands and 15.9% draws while being
taught by a coach that plays one with 31.7% and 0.9%. Regenerating from coach-played hands is the
job with real value in it, and it is the expensive one - it needs the evaluator run again, which was
seven hours on the weak bots and will be longer on coach play-outs.

**Teach the suit read to the player.** It is true, mechanical and measured at x2.03. It is worth
nothing to score with and worth a lot to know, because a person does not weigh danger continuously
the way the coach does. It belongs in the app's explanations, not in `rankDiscards`.

**Do not tune the danger model again.** Four measured failures.

## Fixed on the way past

Seats are numbered 1-4 everywhere a person reads one, matching the app; the tools used to print 0-3.
`sim.ts` and `stats.ts` labelled their four chairs E/S/W/N, which is wrong - the dealer rotates, so
chair 1 is East a quarter of the time - and that output reads as a seat-wind edge it never counted.
`.claude/launch.json` and `web/vite.config.ts` needed changes to run the dev server at all, because
the repo path contains a ':'.

## Two habits worth keeping

**Play it out before believing it.** Being right per-decision has now failed to predict winning
three times. The only measure that counts is chips per game from
`solver/src/tools/headtohead.ts`.

**Change the shuffle.** The test tool used one fixed shuffle for every comparison. That made a
fake pattern look real enough that I called it the project's strongest lead for half a day. Pass a
different seed as the last argument and see if a result survives.
