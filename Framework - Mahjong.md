# Framework — Singapore Mahjong

This is the plan. It says what to practise, in what order, on which days, and how to work out what
is going wrong so it can be fixed. It is built on the nine ideas in `CLAUDE.md`, and on about two
weeks of measurement written up in `FINDINGS.md` beside this file.

One thing makes this plan different from the chess one. For chess we took the patterns from books
and trusted them. Here we measured them. The playbook holds 103 rules taken from a tactics book and
from a data-analytic study of this exact table, and every one of them has now been checked against
hands played out a hundred and twenty-eight times per option. Eighteen of them are wrong. That
changes what a plan should say, because a plan that told you to learn the playbook would teach you
eighteen false things.

## A word on the words

Where this plan uses a term of the game it is written *like this*, and the app italicises the same
terms on screen. The first one to know is *Ting Pai*: a hand one tile from winning, waiting. The
code calls the same thing *Shanten* 0 and the engine's `readyTurn` records when a seat first reached
it, so if you go into the source expect the English word there.

Adopting the term settled a clash the app had with itself. The Spot drill used "one tile away" to
mean one tile away from *Ting Pai*, and the Table setup page used the same phrase to mean *Ting Pai*
itself. Both now say what they mean.

## The table this is for

Singapore mahjong, minimum 2 *Tai*, capped at 5, *Zi Mo* allowed at 1. Four *Jokers*.

Both of those last two are rules Changs also plays without, and it matters more than it sounds.
Everything measured in this project — every card, every table, every number below — was measured at
four *Jokers* and a 2 *Tai* minimum. Taking the *Jokers* out, on the same deals with the same
players, makes hands run 54 *Turns* instead of 40, drawn hands 19% instead of 0.6%, and a late throw
about twice as likely to complete somebody. So at a no-*Joker* table the shape advice should still
hold, being arithmetic about tiles, while the advice about timing, danger and what a hand is worth
is measured at the wrong table. `TABLE-VARIANTS.md` is the plan for fixing that. The shooter
pays the whole bill on a discard win. *Flowers* and *Animals* pay immediately, and here they pay double.
The full house rules are in `data/table.config.json`, and everything below assumes them —
several of the measured answers change if the minimum changes.

## What the skill is made of

Break mahjong into the parts you can practise separately, because the whole thing is too big to
improve at once and because the mistake record can only point at a part.

You need to know what a hand is worth before you know what to do with it, so the first part is
scoring: what each pattern pays and what the minimum does to that. The second is choosing a plan,
which is deciding which hand you are trying to build from thirteen tiles that could become several.
The third is seeing your own shape, which means reading fourteen tiles as five or six pieces rather
than as fourteen things. The fourth is telling apart shapes that look alike, because most of the
book's rules are about two hands that count the same and play differently. The fifth is counting:
what a *Wait* accepts, and how much of it is already face up. The sixth is choosing what to throw when
nothing is safe. The seventh is reading three hidden hands from what is public. The eighth is
deciding to push or fold. The ninth is calling, which is its own decision and not a smaller version
of discarding. The tenth is money and swings, and the eleventh is keeping your temper when a good
decision loses, which in this game it does constantly.

The app trains parts three to nine directly. Parts one, ten and eleven are read and remembered
rather than drilled.

## The patterns

The pattern library is the Tips page in the app, and it is not a reading list. It is 103 cards, each
with a badge saying how much we believe it. Fifty-nine are measured against played hands and hold.
Four are confirmed by counting alone. Six are rules of this table. Sixteen state nothing testable
and are kept because they are worth reading. And eighteen are contradicted: measured, and false here.

**Do not learn the eighteen.** They are `four_tile_ranking`, `honour_wait_timing`,
`break_mediocre_ready`, `last_chance_timing`, `locate_the_fourth`, `withhold_safe_tiles`,
`squeeze_the_caller`, `wind_discard_order`, `call_to_skip_draw`, `rebuild_waits`,
`middle_tile_hands_undefended`, `discard_provenance`, `discarded_value_pair`, `second_copy_call`,
`fear_the_chaser`, `one_turn_is_not_the_fight`, `not_the_third_fighter` and `binary_commitment`.
Several are the opposite of true. Each card says what we measured and why the book's reasoning
fails, and reading them is worth an evening.

The rest are drilled in four groups, in this order: shape, then calling, then *Waits*, then danger.
The order comes from the sixth idea, that difficulty has to climb in steps, and from what the
measurements say is large and what is small. Shape can be practised with nobody else at the table.
Calling needs one other seat. *Waits* need the *Discard Pool*. Danger needs three hidden hands, which
is the hardest thing in the game and where our own numbers are least sure.

Shape comes first because it is arithmetic about tiles, so it holds at both of Changs's tables, with
*Jokers* and without, and because it carries the biggest results we have. A throw that costs the
hand no distance is the *Measured Best* 85% of the time, against 34% by luck. When a hand can stay
*Ting Pai* two ways and one *Wait* is twice as wide, the play-outs take the wide one about 90% of
the time against 47%. Holding ten or more of one suit plus *Honours* at the deal, throw outside the
suit, which is best 71% of the time against 23%; at seven or eight, do not commit. Those three are
the first month, and they are the bottom rung of the ladder: a rule you can be shown, work through
with the *Coach*, and then try alone. The published theory agrees. Riichi Book 1 builds a hand as
five *Blocks*, four sets and a pair, and says to improve the weakest *Block* first because it
finishes last (Chiba, 2016). That transfers, because it is about tiles and not about *Riichi*. One
part does not. The Japanese rule to fix one pair and break the third fails here, measured, because
*Pong Pong* pays 2 *Tai* and 2 is the minimum, so a third pair is a road to a hand you are allowed
to win with. A count of accepting tiles cannot see the minimum.

Calling comes second, earlier than books put it, for two reasons. It is the decision the play-outs
grade most sharply, with 27% of claims having a clear best action against 4% of discards, so the
feedback there is the most honest in the app, which is the seventh idea. And the rules are few and
large. Calling beats passing 72% of the time with no condition at all. A call that makes the hand
*Ting Pai* is best 88% of the time and one that costs it a step is best 6%. From a hand already
*Ting Pai*, call only when it leaves you on more live tiles, which is best 78% of the time, and pass
when it does not, where calling is best 27%. Whether an opponent looks dangerous changes none of
this, and neither does how late it is. Remember that at this table a *Chow* comes only from the seat
on your left and play runs to your right, so calling advice from Japanese material points at the
wrong seat.

*Waits* come third, with less time than a book would give them, because most of what is true about
them is small. Prefer a *Wait* that reaches an edge, but the gap between the best and worst
two-sided *Wait* is between 3 and 10 points. A *Terminal* *Wait* beats a *Middle Tile* *Wait* by
about a quarter. An *Honour* *Wait* is good early and dead late, and what decides it is how many
copies are face up. The one *Wait* rule that is not small is about the minimum: a winning tile that
leaves you under 2 *Tai* is not a winning tile, and the play-outs take the declarable *Wait* over
90% of the time. So the *Wait* drill is three questions in order. How wide is it, which is shape.
Can I declare on it, which is the table. And only then, does it reach an edge.

Danger comes last because it is the top rung. The reads that survive are
few. A seat's own discards deal in to it four to eight times less often than a fresh tile, which is
the Japanese *Genbutsu* and the only defensive idea that transfers whole. A tile already thrown by
anyone is about half as dangerous. A seat with three *Melds* face up is one tile from *Ting Pai*
39.5% of the time against 4.9% with none. A tile one rank from an early discard is held by that seat
14% of the time against 22%. And a seat that threw what it had just drawn is *Ting Pai* 25.5% of the
time against 16.4%. The Japanese *Suji* idea, that a thrown 5 makes the 2 and the 8 safer because
the common two-sided *Wait* is blocked, rests on the mechanism we found too, that suited tiles deal
in mostly by completing a run (tenpaiman, 2012). What does not transfer is the anchor. In *Riichi* a
declaration tells you who is waiting. Nobody declares here, so the *Meld* count and the
threw-what-it-drew tell have to do that job, and neither is certain. Two warnings belong with this
group. Every argument of the form "they cannot hold a pair of it, so it is safe" is nearly worthless
here, measured three ways. And more defence loses money steadily, so the danger drill is about
throwing the right tile when you are scared, not about being scared more often.

## How honest the feedback is

Badly dishonest, and this decides the shape of everything else.

In chess the engine tells you the truth at once and the better move usually wins. In mahjong a
correct discard deals in and a reckless one wins the hand, over and over, and you cannot tell them
apart by watching. You win about one hand in four. Nothing you can see in a single hand tells you
whether you played it well.

So this plan never judges a decision by its result. It judges against a *Measured Best*: every
position in the app's quiz packs has had each legal action played out 128 times, and the best is the
one with the highest average. That is the only honest grading available, and it comes with three
caveats worth keeping in mind. The play-outs are finished by a fast bot rather than by good players,
so an option whose value depends on playing a colour hand well is undervalued. The best is the best
action in the whole position, so it prices danger and value together and a card about shape is being
judged against a throw that may be chosen for safety. And the packs keep positions where one action
separates clearly from the rest, so they are decisions with answers rather than a fair sample of the
game.

The practical rule that follows: never say "that worked". Say "that was the *Measured Best*" or "that
was not", and when it was not, find out why.

One thing about the app follows from the same rule and you should know it before you trust a score.
The two practice tabs are graded by different judges. The Real quiz grades against those play-outs.
The Train tab grades against the *Coach*, which explains its reasoning in words — the reason it is
worth practising against — but which picks the *Measured Best* only 52.8% of the time on positions
where the play-outs genuinely separate an answer, and 36.1% early in the hand. On its worst
combination, an early hand headed for the cheap win, it is right 7.6% of the time, which is worse
than guessing.

So treat the Train tab as a place to practise REASONS and the Real quiz as the place that says
whether you are right. Where the two disagree, the play-outs win. And do not take a Train verdict on
an early hand very seriously, because that is exactly where its judge is weakest.

## The five components, and where they live

The training system in `CLAUDE.md` has five parts and the app has all five. That is the one way this
folder differs from `Chess/` and `Business Communication/`, which keep their pattern library and
their mistake record as `Pattern Library.md` and `Mistakes.md`. Here both are software: the library
is checked by tests so a card cannot quietly stop demonstrating its own claim, and the mistake
record schedules itself. Read those two folders' files if you want the shape; do not write the
markdown versions here, because they would go stale against the code within a week.

The pattern library is the Tips page, with the verdicts above.

Spotting practice is the Spot tab. A position appears for three, five or eight seconds, goes face
down, and then one question is asked: how far from *Ting Pai* the hand was, which suit it held most of,
which opponent had the most sets face up, or which shape the position was about. Scores are kept per
question, because those four are different skills and one of them is usually much worse than the
others.

Working it out is the Train tab. A hand, no hints, and one question: which tile do you throw. It
grades against the *Coach* and explains the answer in plain words.

Mixed practice is the Real quiz. These are positions from real recorded games, graded by play-out,
with no label saying what the position is about and no promise that anything special is happening.
This is the component most training material skips and the one that carries over into play.

The mistake record is the Review tab, and it is fed from both practice tabs. A card from the Real
quiz was judged by the play-outs and is a sure mistake. A card from the Train tab was judged by the
*Coach*, which is right about half the time on positions like that, so it is worth meeting again but
is not proof you were wrong. Each card says which judge it came from and the diagnosis counts them
separately. Every mistake comes back after a day, then three days, a week, two weeks and a month. It asks rather than reminds — the hand comes back with nothing
attached, not your old answer and not the *Coach's*, because recognising an answer feels almost
exactly like knowing it. Getting one wrong sends it back to the start.

## The mistake types

This is the eighth idea, and it is the part most people skip. Every mistake gets sorted by why it
happened, and the practice you do next is aimed at whatever keeps coming up. More puzzles will not
fix a problem that is really about safety.

Eight *Causes* fit this game, and they are the eight the Review tab offers. The app suggests one
from the position and you confirm or correct it with a tap. Below is what each looks like at the
table, how to recognise it in your log afterwards, and what fixes it. The sorting only starts once
the result is out of the way. A throw that dealt in was not a mistake unless a safer throw was the
*Measured Best*, and a throw that won was not right because it won. People find this nearly
impossible: the same decision is judged worse when it turns out badly, even by people who say the
outcome should not count (Baron and Hershey, 1988), and that result replicated cleanly in 2023.

You never learnt it. The throw broke a rule you have never read, usually one of the three big shape
rules, and the card the app names is one you cannot give the reason for. The fix is the fourth
idea: read the card, close it, explain it out loud, then do a short run of hands of that one type
before it goes back into the mix, which is the one time the third idea allows a run.

You knew it and did not see it. You can recite the rule and the hand did not look like the rule,
usually a shape you know in a suit or arrangement you had not met. The fix is the Spot drill's shape
question, not more reading.

You never considered that tile. The right throw surprised you when the app showed it. The Train tab is built for it: say the candidates out loud before you choose, because finding options and proving them are different jobs.

You miscounted. This covers what is left and how wide a *Wait* is. In the log the tell is a *Wait*
you thought was live with three copies face up, or a narrow *Wait* kept over a wider one, which is
the mistake the play-outs punish hardest. Counting is drilled by doing it every throw until it is
not a separate step.

You misjudged the safety. The counting was fine and the danger was wrong. This has two forms and
the second is the one people miss. Too brave is throwing a fresh *Middle Tile* at a seat with three
*Melds* when your own discard, or a tile already on the floor, would do. Too scared costs at least
as much: turning the *Coach's* caution up loses money at every setting tried. In the log, a run of
this *Cause* on late throws is too brave and a run on early throws is too scared. Believing a false
read is the same *Cause*: feeding the seat with nothing showing, which is the second most expensive
hand on the board, or fearing the late chaser, when the first seat to reach *Ting Pai* wins about
twice as often. The fix is the Real quiz aimed at this *Cause*.

You played for the wrong plan. Three things hide under this one. The colour hand: committing at
seven or eight of a suit, or refusing at ten. The minimum: reaching *Ting Pai* on a *Wait* the
2 *Tai* rule will not let you declare, which comes up about once in 180 throws. And the *Jokers*,
which are a fact about the whole table. Without them a hand runs 54 *Turns* instead of 40, a late
throw is about twice as likely to complete somebody, *Half Colour* is worth more and the cheap hand
less. Playing a *Joker* table's patience at a no-*Joker* table is a plan mistake even when every
throw was fine. In the log this *Cause* is a hand that was tidy all the way to a result you could
not cash.

You missed a tile on the table. Something in the *Discard Pool* or a *Meld* was face up and you did
not take it in, and the replay shows it sitting there. The fix is the Spot drill's *Meld* question,
and nothing else will do it.

You knew, and threw something else. You found the right tile and did not play it. Two things cause
this at a live table, and the note you write beside the card tells them apart. The first is tilt.
After a bad beat the next few throws are made to get even rather than to be right. When your sense of how
well you played attaches to whether you won, every losing streak becomes evidence against you, and
the fix is to judge a session by the quality of the throws, in a ratio of about three process goals
to one result goal (Tendler and Carter, 2011). The rule for this plan is short: after a deal-in,
name whether the throw was the *Measured Best* before you name what it cost. The second is speed. A
live table has no clock but it has three people waiting, and a throw made to keep up is a throw not
thought about. Nothing here measures speed, so the fix is our best guess: shorten the Spot look until
the shape question is right at three seconds, because a slow throw is usually a slow read.

Calling has its own version of two of these. Passing a call that would have made you *Ting Pai* is
"never considered", because a pass is a choice and most people do not list it. Calling when it
costs a step is "wrong plan".

The Spot drill has its own four, because it trains seeing rather than deciding: you did not take it
in, you ran out of time, you saw it and read it wrongly, or you guessed. Running out of time means
lengthen the look. Misreading means the problem is not your eyes at all, and no amount of spotting
practice will fix it.

## The stages

Work through these in order. Each one assumes the last.

The first stage is the table. Learn the *Tai* table until you can price a hand without thinking, learn
what the 2 *Tai* minimum does — it kills the *Pi Wu* as a plan and makes the colour hand easier
than the rules suggest — and learn what the shooter pays. This is a week of reading, not drilling,
and everything after it is meaningless without it. You cannot judge a discard if you do not know
what the hand it protects is worth.

The second stage is the vocabulary. Read the Tips page in order, phase by phase: what you are dealt,
building the hand, choosing what to throw, claiming a tile, reading the table, pushing and folding.
Read the eighteen contradicted cards too, and read why. Do not try to memorise. The aim is that a
shape looks familiar later, not that you can recite it.

The third stage is spotting, on the Spot tab, at eight seconds. Seeing is a separate skill from
solving, and it is trainable on its own. Stay here until the four question types are all above about
sixty per cent, then shorten the look to five seconds, then three. The drill will tell you when to
move: sort your misses, and once enough of them are about running out of time it offers to lengthen
the look, and once none of them are it offers to shorten it. Take the offer rather than guessing,
because the same score at a shorter look is progress and the same score at the same look is not.

The fourth stage is working it out, on the Train tab. Start with the hand types you have just read
about. When you throw a tile, say why before you tap, because the reason is the thing being trained
and the tile is only evidence of it.

The fifth stage is mixed practice, on the Real quiz. No labels, real positions, everything you know
competing to be the thing you remember. It can also be aimed: once your record has a leading *Cause*,
the quiz will serve only positions where the throw actually made failed for that reason, which puts
the honest grader behind the practice rather than behind a shuffled deck. Use that when a *Cause* has
been at the top for a while, and use the unfiltered deck the rest of the time — the whole point of
mixed practice is that nothing tells you what the position is about. Expect to be worse here than on the Train tab, and expect
that gap to be the honest measure of how much of this you can actually use.

The sixth stage is reading. The read cards, plus the Film room, which replays real hands so you can
watch what a seat's discards said about it before the hand ended.

The seventh stage is pushing and folding, which is last because it needs everything before it: you
cannot decide whether to push without knowing what your hand is worth and what theirs is.

Throughout all seven, the mistake record runs. It is not a stage. It is the thing that makes the
stages stick.

## The practice hour

Three days a week, an hour each. Tuesday, Thursday and Saturday.

Three rather than daily is deliberate and comes from the second idea. Material needs to fade a
little before you pull it back, and a mistake met again the next day is being recognised rather than
recalled. Three also leaves room for chess, which should be running first and on other days, because
chess is where you learn to run this system in a game that tells you the truth.

Spend the hour like this. Five minutes on the Review tab, clearing whatever is due. Do this first,
while you are fresh, because it is the highest-value thing in the hour and the easiest to skip.
Then ten minutes on the Spot drill. Then twenty-five minutes on the Train tab, and if the Review tab
has named a leading *Cause*, spend that time on hands where that *Cause* bites. Then fifteen minutes on
the Real quiz, which is the one that transfers. Then five minutes with one card from the Tips page:
read it, close it, and explain it out loud in plain words. Where the sentence falls apart is the
thing you do not yet understand, and that is the fourth idea working.

Two rules about the hour. If the review queue is long, let it eat the Spot and Tips time rather than
the Train and Real quiz time, because meeting an old mistake again beats meeting a new one. And stop
at the hour. Practice at the edge of your ability is exhausting, and the hours past the point of
tiredness turn into entertainment that feels like work.

Once a week, ideally on the Saturday, add a real game or a Film room session and take notes on your
own decisions rather than on the results. You are looking for decisions you cannot justify, not for
hands you lost.

## How to tell it is working

Not by how it feels. That is the ninth idea, and it is the one that catches everybody. The methods
that feel smooth store the least. If a session felt fluent you probably practised something you had
already learnt.

The honest signals are these. Your Real quiz score should rise, and that one is worth more than the
rest put together, because the Real quiz is real positions judged by play-outs rather than by
opinion. Do not read the gap between your Train score and your Real quiz score as a measure of
transfer: the two tabs are graded by different judges that agree about half the time, so most of
that gap is theirs and not yours. The leading *Cause* in your mistake record should change over time, because a *Cause* that stays at the top
for a month means the practice is not aimed at it. Reviews should come back right more often at the
longer intervals rather than at the short ones. And on the Spot drill, the same accuracy at a
shorter look is real progress in a way that the same accuracy at the same look is not.

Track the spread between what you win and what you feed, never either alone.

## How much of this we believe

The method is not our invention and is well supported. Pulling things out of memory rather than
reading them again, leaving gaps between sessions, mixing problem types, explaining with the book
closed, getting the right answer after every attempt, and sorting errors by *Cause* — these come out
of the research write-up in `Research - How to Learn Fast.md` and rest on experiments rather than on
our opinion.

The measured verdicts on the 103 cards are ours, and they are the most solid thing here. Each one
says how many positions it rests on and how far it sits from chance, and each was checked on two
different populations of players because one read has already reversed between them.

The stage order is our best guess. Nothing tested whether the vocabulary must come before spotting,
or whether reading is better placed sixth than third. The minute split inside the hour is also a
guess, chosen so that the two components that transfer get more than half the time.

The claim that spotting is a separate skill from solving is borrowed from the chess framework and
has not been tested here, though the Spot tab keeps the per-question scores that would test it.

The biggest known weakness of the app is the one above: the tab you will spend most of the hour on
is graded by the *Coach*, and the *Coach* is right about half the time on *Decisive* positions. It is
still far better than the simulator bots and miles better than random, and it is the only thing here
that can tell you WHY. But the honest ordering is that the Real quiz judges and the Train tab
teaches, and the record hears from both, marked.

And one caution about the *Coach* that grades you. It was tuned against opponents like itself, and
when we sat it at a table of weaker bots one of its improvements reversed. Its advice on shape is
measured and solid, and its judgement about safety turns out not to be a fitting artefact at all:
how heavily it weighs danger against value comes out the same against two different populations,
and the table of *Deal-in* probabilities underneath it can be measured on either without changing how
it plays. What does still depend on who is at the table is which PLAN is worth building — a value
table tuned on one population costs a fifth of a chip a hand against the other — and two of the
reads on the Tips page, which reverse outright between populations and say so on their cards. No
human has been measured against any of it, and that is the real gap.

## Running the app

From this folder, `pnpm install` then `pnpm dev`, and it is at `http://localhost:5173`. Everything it
remembers is in your browser and nowhere else, so save it: the Table setup tab has a button that
writes your whole record to a file and another that puts it back. Do that at the end of the first
week and then whenever you remember. A mistake record is worth most in its third and fourth week,
which is exactly when losing it would cost the most.

## Sources

Every number in this file that is not attributed below was measured in this project and is written
up, with its date and its error bars, in `FINDINGS.md`.

Baron, J. and Hershey, J. C. (1988). Outcome bias in decision evaluation. Journal of Personality and
Social Psychology, 54(4), 569–579. https://pubmed.ncbi.nlm.nih.gov/3367280/ — the same decision is
judged worse when it turns out badly; used for why a mistake is sorted only after the result is set
aside. The 2023 replication by Aiyer and others is at https://rips-irsp.com/articles/10.5334/irsp.751.

Tendler, J. and Carter, B. (2011). The Mental Game of Poker.
https://jaredtendler.com/books/the-mental-game-of-poker/ — tilt as the result of attaching your sense
of skill to results; the three-to-one ratio of process goals to result goals is from Tendler's 2013
PokerNews piece, https://www.pokernews.com/strategy/jared-tendler-in-defense-of-results-oriented-goals-15650.htm.

Chiba, D. (2016). Riichi Book 1. https://riichi.wiki/Riichi_Book_1, with the book itself at
https://f.hubspotusercontent-eu1.net/hubfs/26591288/Mahjong%20documents/Riichi/RiichiBook1.pdf — the
five-block method, used for the shape group and for the pair rule that does not transfer here.

tenpaiman (2012). Basic Defense Techniques in Mahjong. https://osamuko.com/basic-defense-techniques-in-mahjong/
— *Genbutsu* and *Suji*, and the note that both apply against open hands with no *Riichi* declared;
used for what does and does not transfer in the danger group.
