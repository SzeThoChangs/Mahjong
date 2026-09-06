# The tables Changs actually plays

Two rules vary between his games, and they cross:

|                | 4 wildcards | 0 wildcards |
|---|---|---|
| **minimum 2 tai** | everything we measured | not measured |
| **minimum 1 tai** | not measured | not measured |

Every hand this project ever generated sits in the top-left cell — both quiz packs, the value
tables, the danger reads, every verdict on the Tips page. Three quarters of the table he plays at
has never been checked.

The two axes are not equally supported. Minimum tai is a setting the code already understands: the
solver threads `minimumFan` everywhere, the study's value tables carry `mf1` rows beside `mf2` for
all five plans, and four cards exist about what the 2-tai minimum changes. What is unknown is
whether the VERDICTS hold at 1, since every play-out that produced them ran at 2 - and by those four
cards' own account, the minimum changes which hands are worth playing. Wildcards are the opposite:
the engine parameterises the count, but nothing above the engine has ever seen a table without
them.

This is the plan for checking it. The rule throughout is to spend the cheap measurement before the
expensive rebuild.

## What we are actually asking

**On wildcards.** Removing four tiles that stand for anything makes hands strictly harder to
finish. If that only
slows the game down by a little, every number we have travels and there is nothing to do. If it
changes the shape of the game — how often a hand gets there at all, how long it takes, how dangerous
a late tile is — then the packs and the tables want a second edition, and the Tips page needs to say
which table each verdict is about.

**On the minimum.** At 1 tai a cheap hand is legal, so the plan that is worthless at this table
becomes the fastest way to end a hand - which is the thing `mf2_target_shift` says outright. The
question is whether the cards that were measured at 2 still point the right way at 1, and the four
`mf2_` cards are the ones most likely to move.

**Both at once.** The four cells are one experiment, not two: the same paired comparison run at each
corner. Wildcards first because nothing above the engine has ever run without them, so it is the
one that could break rather than merely shift.

## User stories

**As Changs, when I train for a no-wildcard game, I want to know whether the app's advice still
applies**, so that I am not drilling numbers from a different game. Done when the Tips page or the
framework says plainly either "these hold at both tables" or "these are the four-wildcard numbers".

**As Changs, I want the app to know which table I am playing**, so the plans it names and the danger
it prices match the game in front of me. Only worth building if the checks below say the tables
differ. `table.config.json` already carries `jokers.count` and `minimum_fan`, and the Table setup tab
already edits the money, so this is a control on a screen that exists rather than new machinery.

**As Changs, when a card's answer depends on which table I am at, I want the card to say so**, so I
do not carry a 2-tai habit into a 1-tai game. Done when a verdict that differs between tables is
labelled with the table it came from, rather than stated flatly as it is today.

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
4. **Read it and decide.** DONE 2026-09-06, and they are far apart: draws 0.6% against 19.0%, hands
   40 turns against 54, and a late throw about twice as likely to deal in. So the second edition is
   warranted and the tasks below are real. The full table is in FINDINGS.
5. **Say so on the page.** DONE 2026-09-06. The Tips page carries a line naming the table every
   verdict was measured at and what changes without wildcards; the framework's table section says the
   same and points here; and the `game_length` card, which had blamed the draw-rate gap on the
   players rather than the rules, is corrected.

6. **Then the same for the minimum.** Re-run the comparison at `minimum_fan: 1` against 2, both at
   four wildcards, and then at the fourth corner. The tool takes the rules object, so this is an
   argument rather than new code. Expect the four `mf2_` cards to move; the shape cards should not,
   since they are arithmetic about tiles rather than about what a hand is worth.

Only if a comparison says the tables differ:

7. A no-wildcard quiz pack, which is generation plus grading.
8. Value tables refitted at zero wildcards, using the committed-plan machinery already built.
9. The app told which table it is on - a control in Table setup beside the money, which already
   edits `table.config.json` - and the cards labelled where a verdict differs between tables.
