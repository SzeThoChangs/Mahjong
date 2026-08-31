# Where we left off — 2026-08-31

Read this first. `PLAN.md` is the project. `FINDINGS.md` is everything we measured and why.

## Nothing is running

The last job finished. `DANGER_WEIGHT` stays at 40 — the sweep tried 10 through 240 and nothing
beat it. The safe range around it got wider after the danger data was corrected, but the answer
did not move.

## What we decided on 2026-08-30

**The bot is the hand-written coach, and it stays that way.** We tried six ways to improve it and
all six lost or drew:

- teach a model to pick discards — lost
- teach a model to decide pong/chow — dead level
- both models together — lost
- play on for flowers when the hand is weak — lost
- give up when the hand can't reach 2 tai — lost
- give up when someone looks ready and you're far — lost

Machine learning is closed. It picks the "right" tile more often than the coach and still loses
money. We checked that three separate times.

**We fixed a real bug.** The table plays with 4 wildcards and most of the code wasn't dealing them.
Worse, the tool that compares bots was dealing no wildcards at all — so an old result saying the
model loses 2.66 chips a game was measured on the wrong game. The real number is 0.54.

**We rebuilt everything the app serves** on the current data (`run-money3`). The old quiz was
offering wildcards as tiles you could throw, which the table forbids, and in 14 questions it taught
throwing one as the correct answer.

**We deleted 10 GB of old game data.** Five runs, all generated before the wildcard fix, so they
describe a game your table doesn't play. Gone for good — not in git, not recoverable. Nothing in
the repo depends on them any more.

**We added two things to the app**, which is where the only real wins came from:

- **Your hand** — type in the hand you're holding and ask what to throw, or tap the tile someone
  just threw and ask whether to take it.
- Claim questions in the quiz and the film room now explain *why*, not just what the money was.

## Done since (2026-08-31)

The list from yesterday is finished. The sweep landed on 40. **Your hand** remembers your seat and
round. The table view now shows the discard pile, turns the far seat's tiles the right way up for
that player, and puts seat/round/how-deep-you-are next to the tiles instead of in a card you scroll
away from. CI runs the checks on every push.

**The quiz no longer skews late.** It was 43% late-hand and 17% early against a run that is 25% and
37%. The cause was that the pack held its mix by decision *kind* only, and a late hand is far easier
for the simulator to grade than an early one (7.0% of late discards separate cleanly, against 1.4%
of early ones) — so decisiveness quietly did the choosing. Holding the mix by kind *and* phase fixes
it with no loss of gradeability: every slice still fills from cleanly-separated positions, and the
median question moved from turn 32 to turn 23. Pack rebuilt.

## What to do next

**Build the app.** No open bugs from the list above. Candidates, in no particular order:

- Early discards are the one thin slice — the pack uses 75% of all the separable early positions the
  run contains. More of them needs more hands or deeper play-outs, not a smarter picker. Worth a
  night of compute if the early questions start feeling repetitive.
- The open question below still has no answer, and the engine still does the nonsense thing.

**Don't work on the bot.** Six measured losses say it's as good as this approach gets. If it is ever
revisited: shorter play-outs with an estimated ending is the only idea left that saves time *and*
noise together. It was never urgent once the 2.66 turned out to be 0.54.

## Two habits worth keeping

**Play it out before believing it.** Being right per-decision has now failed to predict winning
three times. The only measure that counts is chips per game from
`solver/src/tools/headtohead.ts`.

**Change the shuffle.** The test tool used one fixed shuffle for every comparison. That made a
fake pattern look real enough that I called it the project's strongest lead for half a day. Pass a
different seed as the last argument and see if a result survives.

## Open question for you

At a real table, a player has four melds down and only wildcards left in hand. They can't win —
the hand is worth 0 tai and the table minimum is 2. They still have to throw something.

What actually happens? The engine currently lets them throw a wildcard, which you've said is
nonsense. It came up 195 times in 150,000 hands.
