# The words this project uses

For review. Edit this file — change a term, strike one out, add one — and the project-wide sweep will
follow whatever it says. Nothing here has been applied except *Ting Pai*, which was agreed on
2026-09-06 and is already in the app, the cards and the framework.

How to read the columns. **Term** is what the app would say. **Now** is what it says today, where
that differs. **Where** is roughly how often it appears in text a learner sees — the cards, the drill
prompts, the framework — not counting code.

Marking a term as jargon means two things: it is written `*like this*` in the source, and the app
renders it in italics through `web/src/lib/jargon.tsx`. Terms not marked are just ordinary words and
are left alone.

The colour says which kind of word it is, which is the one thing a learner cannot get from the word
itself. A *Chow* is something you do, a *Dragon* is something you hold, and *Pong Pong* is a hand you
are trying to make: three different sorts of fact wearing the same kind of name. The Tips page
carries the key.

| Kind | What it covers | Colour | Terms |
|---|---|---|---|
| what you do | actions | blue | *Chow*, *Pong*, *Kong*, *Zi Mo*, *Deal-in*, *Bao* |
| what you hold | tiles | green | *Terminal*, *Honour*, *Simple*, *Middle Tile*, *Dragon*, *Seat Wind*, *Prevailing Wind*, *Flower*, *Animal*, *Bonus Tile*, *Joker* |
| parts of a hand | shapes | amber | *Block*, *Wait*, *Floater*, *Meld*, *Ting Pai* |
| hands you can make | hand types | violet | *Half Colour*, *Full Colour*, *Ping Wu*, *Pong Pong*, *Pi Wu* |
| the table and its clock | the game around the hand | pink | *Tai*, *Turn*, *Wall*, *Discard Pool* |
| this app's own words | ours, not the game's | grey | *Measured Best*, *Coach*, *Field*, *Cause*, *Trap*, *Decisive*, *Shanten* |

A term missing from that map still renders in italics, just without a colour, so adding a word to a
card cannot break a page. It only means the word has not been sorted yet.

---

## 1. Agreed and already applied

| Term | Means | Now | Where |
|---|---|---|---|
| *Ting Pai* | a hand one tile from winning, waiting on it | was "ready" | 63 places |

Adopting it settled a clash: the Spot drill said "one tile away" meaning one away *from* Ting Pai,
while Table setup said the same phrase meaning Ting Pai itself. Both now say which.

---

## 2. Decided 2026-09-06

| Question | Decision |
|---|---|
| tai or fan? | **Tai**, everywhere a person reads. See the open question at the foot of this file about the code. |
| wildcard or joker? | **Joker**, including the two tool files named for it. |
| spare, floater or loose tile? | **Floater**, everywhere. |
| deal in or deal-in? | **deal in** the verb, **Deal-in** the noun. |
| round wind or prevailing wind? | **Prevailing Wind**. |

**Every term is capitalised.** A jargon term starts with a capital wherever it appears, so that a
reader meeting one can see it is a term and not an ordinary word.

## 3. The terms

| Term | Means |
|---|---|
| *Ting Pai* | a hand one tile from winning, waiting on it |
| *Tai* | the scoring unit; this table pays a minimum of 2 and caps at 5 |
| *Chow* | three in a run, claimed from the player on your left |
| *Pong* | three of a kind, claimable from anybody |
| *Kong* | four of a kind; draws a replacement tile |
| *Meld* | a set you have claimed and laid down, face up and locked |
| *Wait* | the tiles that would complete your hand |
| *Block* | a piece of a hand — a set, a pair, or two tiles that could become a run |
| *Floater* | a tile no block wants |
| *Deal-in* | discarding the tile somebody wins on, and paying for it |
| *Zi Mo* | to win on a tile you drew yourself |
| *Bao* | pay-all: feeding a hand that makes you liable for everybody's share |
| *Joker* | the four tiles that stand for anything and cannot be thrown |

## 4. Hand types

| Term | Means |
|---|---|
| *Half Colour* | one suit plus honours — 2 Tai |
| *Full Colour* | one suit and nothing else — 4 Tai |
| *Ping Wu* | all runs, no honours — 4 Tai |
| *Pong Pong* | four triplets — 2 Tai |
| *Pi Wu* | a hand with no pattern, worth zero Tai — legal only through flowers, animals or a value set |

The engine's scoring calls these `ban_se`, `qing_yi_se`, `ping_hu` / `chou_ping_hu`, `peng_peng_hu`
and `chicken`. The names above are what the app says.

## 5. Tile words

These were listed as "probably not jargon" on the grounds that marking ordinary words would make
half the page italic. That was overruled on 2026-09-06: they are marked like the rest, because a
reader meeting one needs to know it is a term, and these are exactly the ones that can be mistaken
for ordinary English.

| Term | Means |
|---|---|
| *Terminal* | a 1 or a 9 |
| *Honour* | a wind or a dragon — no number, no neighbours |
| *Simple* | a number tile from 2 to 8 |
| *Middle Tile* | a 3 to a 7, the tiles most runs need |
| *Dragon* | red, green or white |
| *Seat Wind* | the wind of your seat, worth *Tai* as a set |
| *Prevailing Wind* | the wind of the round |
| *Flower* | one of the four flower *Bonus Tiles* |
| *Animal* | one of the four animals, which pay at once here |
| *Bonus Tile* | a *Flower* or an *Animal*: drawn, set aside, replaced |
| *Wall* | the tiles nobody has drawn yet |
| *Discard Pool* | everything thrown, face up, in order |
| *Turn* | one player's draw and throw; the hand's clock |

Where these words are the ordinary English verb they are left alone, because the mark would be a
lie: "the shape *waits* on 8" is not the noun, "four cards *turn* on this" is not the clock, and
"a *simple* reason" is not a tile.

## 6. The project's own words — not mahjong, but load-bearing

These are ours, not the game's. They appear in the app and the write-ups and a reader will meet them
without warning, so as of 2026-09-06 they are marked too.

| Term | Means |
|---|---|
| *Measured Best* | the action 128 play-outs scored highest — the honest grader |
| *Trap* | a position where the tempting throw is wrong; how the Train tab picks hands |
| *Decisive* | a position where one action separates from the rest by more than two standard errors |
| *Coach* | the book-based solver that explains its reasoning, right about half the time |
| *Field* | the datagen personalities, as opposed to a table of coaches |
| *Cause* | why a mistake happened, from the eight in the record |
| *Shanten* | distance from a complete hand; the framework says the word once and the cards once |

---

## Still open: the code

The decision "change all fan to tai" is applied to everything a person reads. It is NOT applied to
121 occurrences of `minimum_fan`, `fan_limit`, `self_draw_minimum_fan` and `fanInHand` in the engine
and in `data/table.config.json`, because those are a data contract rather than prose: the JSON key
is read by the config loader, carried in every generated run's manifest, and stored in the packs.
Renaming them is a day's careful work with a migration for old files, in exchange for nothing a
learner ever sees. Say the word and it is done, but it is a different kind of change from the rest of
this file.

## What happens after you edit this

Marking a term costs one search and replace plus the asterisks; the renderer already exists and every
screen that shows card text runs through it. The risky ones are the words that also appear in code
identifiers or in the measured record — `ready` hid inside `already` 227 times, and three
`'closer-to-ready'` code literals had to be left alone — so the sweep is done term by term with the
tests and a browser check after each, not in one pass.
