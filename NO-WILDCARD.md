# The table without wildcards

Changs plays both tables: four wildcards, and none. Every hand this project ever generated used four
— both quiz packs, the value tables, the danger reads, every verdict on the Tips page. So the
trainer may be calibrated to half the game he plays, and nobody has checked.

This is the plan for checking it. The rule throughout is to spend the cheap measurement before the
expensive rebuild.

## What we are actually asking

Removing four tiles that stand for anything makes hands strictly harder to finish. If that only
slows the game down by a little, every number we have travels and there is nothing to do. If it
changes the shape of the game — how often a hand gets there at all, how long it takes, how dangerous
a late tile is — then the packs and the tables want a second edition, and the Tips page needs to say
which table each verdict is about.

## User stories

**As Changs, when I train for a no-wildcard game, I want to know whether the app's advice still
applies**, so that I am not drilling numbers from a different game. Done when the Tips page or the
framework says plainly either "these hold at both tables" or "these are the four-wildcard numbers".

**As Changs, I want the app to know which table I am playing**, so the plans it names and the danger
it prices match the game in front of me. Only worth building if the check below says the two tables
differ. `table.config.json` already carries `jokers.count`, so the plumbing exists.

**As whoever works here next, I want the difference measured before anything is rebuilt**, so that a
day of compute is spent only if it buys something. A full second edition is generation plus grading;
the check is fifteen minutes.

**As whoever works here next, I want the comparison to be paired**, so the answer is about wildcards
and not about two different sets of deals.

## The tasks, in order

1. **Prove the engine deals a legal no-wildcard game.** `jokers.count` validates from zero and the
   wall takes it, but nothing has ever run at zero. Smoke it: hands complete, chips net to zero, no
   illegal actions, and the wall is the right size.
2. **Generate the paired runs.** Two coach runs, same seed, same bots, same everything except the
   wildcard count. Paired, so the only difference is the thing under test.
3. **Write the comparison.** One tool, reporting the headline rates side by side: win rate, draw
   rate, the turn a seat first reaches *Ting Pai*, hand length, and deal-in by turn and tile class.
4. **Read it and decide.** Close together means the numbers travel and the finding is written up as
   a null. Far apart means a second edition, and the tasks below become real.
5. **Say so on the page.** Whichever way it goes, the framework and the Tips page should state which
   table the numbers are from. A learner cannot tell from the cards today.

Only if step 4 says the tables differ:

6. A no-wildcard quiz pack, which is generation plus grading.
7. Value tables refitted at zero wildcards, using the committed-plan machinery already built.
8. The app told which table it is on, and the cards labelled where a verdict differs between them.
