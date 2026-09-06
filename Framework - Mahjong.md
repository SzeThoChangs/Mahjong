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

## The table this is for

Singapore mahjong, minimum 2 tai, capped at 5, self-draw allowed at 1. Four wildcards. The shooter
pays the whole bill on a discard win. Flowers and animals pay immediately, and here they pay double.
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
what a wait accepts, and how much of it is already face up. The sixth is choosing what to throw when
nothing is safe. The seventh is reading three hidden hands from what is public. The eighth is
deciding to push or fold. The ninth is calling, which is its own decision and not a smaller version
of discarding. The tenth is money and swings, and the eleventh is keeping your temper when a good
decision loses, which in this game it does constantly.

The app trains parts three to nine directly. Parts one, ten and eleven are read and remembered
rather than drilled.

## The patterns

The pattern library is the Tips page in the app, and it is not a reading list. It is 103 cards, each
with a badge saying how much we believe it:

Fifty-nine are measured, which means we checked them against played hands and they hold. Four are
confirmed by counting alone, which is stronger than it sounds — no error bars. Six are rules of this
table rather than claims about play. Sixteen are advice that states nothing testable, kept because
they are worth reading. And eighteen are contradicted: measured, and false here.

**Do not learn the eighteen.** They are `four_tile_ranking`, `honour_wait_timing`,
`break_mediocre_ready`, `last_chance_timing`, `locate_the_fourth`, `withhold_safe_tiles`,
`squeeze_the_caller`, `wind_discard_order`, `call_to_skip_draw`, `rebuild_waits`,
`middle_tile_hands_undefended`, `discard_provenance`, `discarded_value_pair`, `second_copy_call`,
`fear_the_chaser`, `one_turn_is_not_the_fight`, `not_the_third_fighter` and `binary_commitment`.
Several are the opposite of true. The card for each one says what we measured and why the book's
reasoning fails, and reading them is worth an evening — knowing why a plausible rule is wrong is
worth more than one more rule that is right.

Learn these first, because they are the best evidenced and they decide the most hands. Break a
finished shape to escape a lone-tile wait, which the play-outs take 89% of the time against 47% by
luck and which survives every correction we know how to apply. Commit to a colour hand at the deal
when you hold ten or more of one suit plus honours, and do not commit at seven or eight. Count their
melds, because a seat with three exposed sets is one tile from ready 39.5% of the time against 4.9%
with none, and that single number is the strongest free signal on the table. And what a seat threw
early is what it never had: a tile one rank from an early discard is held by that seat 14% of the
time against 22% for a tile of the same suit further away.

Then learn one mechanism that four separate cards turn on, because it explains more than any of
them. A suited tile deals in mostly by completing a run. So every argument of the form "they cannot
hold a pair of it, therefore it is safe" is nearly worthless, and three cards that make that
argument all fail. What does make a tile safe is the run waits being dead.

## How honest the feedback is

Badly dishonest, and this decides the shape of everything else.

In chess the engine tells you the truth at once and the better move usually wins. In mahjong a
correct discard deals in and a reckless one wins the hand, over and over, and you cannot tell them
apart by watching. You win about one hand in four. Nothing you can see in a single hand tells you
whether you played it well.

So this plan never judges a decision by its result. It judges against a measured best: every
position in the app's quiz packs has had each legal action played out 128 times, and the best is the
one with the highest average. That is the only honest grading available, and it comes with three
caveats worth keeping in mind. The play-outs are finished by a fast bot rather than by good players,
so an option whose value depends on playing a colour hand well is undervalued. The best is the best
action in the whole position, so it prices danger and value together and a card about shape is being
judged against a throw that may be chosen for safety. And the packs keep positions where one action
separates clearly from the rest, so they are decisions with answers rather than a fair sample of the
game.

The practical rule that follows: never say "that worked". Say "that was the measured best" or "that
was not", and when it was not, find out why.

One thing about the app follows from the same rule and you should know it before you trust a score.
The two practice tabs are graded by different judges. The Real quiz grades against those play-outs.
The Train tab grades against the coach, which explains its reasoning in words — the reason it is
worth practising against — but which picks the measured best only 52.8% of the time on positions
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
down, and then one question is asked: how far from ready the hand was, which suit it held most of,
which opponent had the most sets face up, or which shape the position was about. Scores are kept per
question, because those four are different skills and one of them is usually much worse than the
others.

Working it out is the Train tab. A hand, no hints, and one question: which tile do you throw. It
grades against the coach and explains the answer in plain words.

Mixed practice is the Real quiz. These are positions from real recorded games, graded by play-out,
with no label saying what the position is about and no promise that anything special is happening.
This is the component most training material skips and the one that carries over into play.

The mistake record is the Review tab, and it is fed from both practice tabs. A card from the Real
quiz was judged by the play-outs and is a sure mistake. A card from the Train tab was judged by the
coach, which is right about half the time on positions like that, so it is worth meeting again but
is not proof you were wrong. Each card says which judge it came from and the diagnosis counts them
separately. Every mistake comes back after a day, then three days, a week, two weeks and a month. It asks rather than reminds — the hand comes back with nothing
attached, not your old answer and not the coach's, because recognising an answer feels almost
exactly like knowing it. Getting one wrong sends it back to the start.

## The mistake types

This is the eighth idea, and it is the part most people skip. Every mistake gets sorted by why it
happened, and the practice you do next is aimed at whatever keeps coming up. More puzzles will not
fix a problem that is really about safety.

Eight causes fit this game. You never learnt the idea behind the right tile. You knew the idea and
did not see it in this hand. You saw the situation but that throw was never on your list. You
considered it and got the counting wrong. The counting was fine and you misread how dangerous your
tile was. You were building a different hand from the one worth building. You missed something on
the table. Or you found the right tile and threw something else anyway.

The app does half of this sorting for you. It reads the position and suggests a cause — which shape
card your throw broke, whether your tile cost the hand a step, whether you were on a different plan,
whether yours was simply the more dangerous tile — and you confirm or correct it with one tap. The
Review tab then tells you which cause keeps coming up, and the Train tab will draw hands where
exactly that cause bites.

The Spot drill has its own four, because it trains seeing rather than deciding: you did not take it
in, you ran out of time, you saw it and read it wrongly, or you guessed. That distinction matters.
Running out of time means lengthen the look. Misreading means the problem is not your eyes at all,
and no amount of spotting practice will fix it.

## The stages

Work through these in order. Each one assumes the last.

The first stage is the table. Learn the tai table until you can price a hand without thinking, learn
what the 2 tai minimum does — it kills the cheap hand as a plan and makes the colour hand easier
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
competing to be the thing you remember. Expect to be worse here than on the Train tab, and expect
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
has named a leading cause, spend that time on hands where that cause bites. Then fifteen minutes on
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
that gap is theirs and not yours. The leading cause in your mistake record should change over time, because a cause that stays at the top
for a month means the practice is not aimed at it. Reviews should come back right more often at the
longer intervals rather than at the short ones. And on the Spot drill, the same accuracy at a
shorter look is real progress in a way that the same accuracy at the same look is not.

Track the spread between what you win and what you feed, never either alone.

## How much of this we believe

The method is not our invention and is well supported. Pulling things out of memory rather than
reading them again, leaving gaps between sessions, mixing problem types, explaining with the book
closed, getting the right answer after every attempt, and sorting errors by cause — these come out
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
is graded by the coach, and the coach is right about half the time on decisive positions. It is
still far better than the simulator bots and miles better than random, and it is the only thing here
that can tell you WHY. But the honest ordering is that the Real quiz judges and the Train tab
teaches, and the record hears from both, marked.

And one caution about the coach that grades you. It was tuned against opponents like itself, and
when we sat it at a table of weaker bots one of its improvements reversed. Its advice on shape is
measured and solid. How heavily it weighs safety against value has now been checked against two
different populations and comes out the same, so that much is not a fitting artefact. What is still
fitted to one table is the danger READS underneath it — how likely each tile is to deal in — and one
of those has already reversed between populations. No human has been measured against any of it.

## Running the app

From this folder, `pnpm install` then `pnpm dev`, and it is at `http://localhost:5173`. Everything it
remembers is in your browser and nowhere else.
