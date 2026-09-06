# The words this project uses

For review. Edit this file — change a term, strike one out, add one — and the project-wide sweep will
follow whatever it says. Nothing here has been applied except *Ting Pai*, which was agreed on
2026-09-06 and is already in the app, the cards and the framework.

How to read the columns. **Term** is what the app would say. **Now** is what it says today, where
that differs. **Where** is roughly how often it appears in text a learner sees — the cards, the drill
prompts, the framework — not counting code.

Marking a term as jargon means two things: it is written `*like this*` in the source, and the app
renders it in a distinct style through `web/src/lib/jargon.tsx`. Terms not marked are just ordinary
words and are left alone.

---

## 1. Agreed and already applied

| Term | Means | Now | Where |
|---|---|---|---|
| *Ting Pai* | a hand one tile from winning, waiting on it | was "ready" | 63 places |

Adopting it settled a clash: the Spot drill said "one tile away" meaning one away *from* Ting Pai,
while Table setup said the same phrase meaning Ting Pai itself. Both now say which.

---

## 2. The project contradicts itself — these need a decision

| Question | Today | Note |
|---|---|---|
| **tai** or **fan**? | "tai" 145 times in text, "fan" 21 | Already half-solved: `HandContext` carries a `fanLabel` prop with the comment "Singapore players say tai", so the UI can say tai while the code says fan. The config keys are `minimum_fan`, `self_draw_minimum_fan`. Suggest: **tai** everywhere a person reads, `fan` left alone in code and config. |
| **wildcard** or **joker**? | "wildcard" 49, "joker" 30 | The house rules and your own confirmations say wildcard; the engine says joker (`isJoker`, `jokers.count`). Suggest: **wildcard** in all text, `joker` left in code. |
| **spare**, **floater** or **loose tile**? | "spare" 26, "floater" 1, "loose tile" a few | Three words, one thing: a tile no block wants. One card is called `keep_floaters`. Suggest: **spare**, and rename the card's wording but not its id. |
| **deal in** or **deal-in**? | 4 and 4 | Suggest: **deal in** as the verb, **deal-in** as the noun ("its deal-in rate"). |
| **round wind** or **prevailing wind**? | code says prevailing, text says round | Suggest: **round wind** in text. |

---

## 3. Core terms — mark as jargon?

The vocabulary of the game itself. My suggestion is to mark all of these, because they are the words
that mean something precise here and a learner meeting them should see that they are terms.

| Term | Means |
|---|---|
| *Ting Pai* | one tile from winning — agreed |
| *tai* | the scoring unit; this table pays a minimum of 2 and caps at 5 |
| *chow* | three in a run, claimed from the player on your left |
| *pong* | three of a kind, claimable from anybody |
| *kong* | four of a kind; draws a replacement tile |
| *meld* | a set you have claimed and laid down, face up and locked |
| *wait* | the tiles that would complete your hand |
| *block* | a piece of a hand — a set, a pair, or two tiles that could become a run |
| *spare* | a tile no block wants |
| *deal in* | to discard the tile somebody wins on, and pay for it |
| *self-draw* | to win on a tile you drew yourself |
| *bao* | pay-all: feeding a hand that makes you liable for everybody's share |
| *wildcard* | the four tiles that stand for anything and cannot be thrown |

## 4. Hand types — mark as jargon?

These are names of things rather than concepts. They read as names already, so marking may be noise.
My suggestion is to mark them on first use in a card and leave them plain after.

| Term | Means |
|---|---|
| *half colour* | one suit plus honours — 2 tai |
| *full colour* | one suit and nothing else — 4 tai |
| *ping wu* | all runs, no honours — 4 tai |
| *all pongs* | four triplets — 2 tai |
| *chicken hand* | a hand with no pattern, worth the minimum only |

Note: the engine's scoring calls these `ban_se`, `qing_yi_se`, `ping_hu` / `chou_ping_hu`,
`peng_peng_hu`. The text uses the English. Worth deciding whether the cards should teach the Chinese
names alongside, since that is what gets said at a table.

## 5. Tile words — probably not jargon

Ordinary enough that marking them would make half the page italic. Listed so the decision is
deliberate.

terminal · honour · simple · middle tile · dragon · seat wind · round wind · flower · animal ·
bonus tile · the wall · the discard pool · turn

## 6. The project's own words — not mahjong, but load-bearing

These are ours, not the game's. They appear in the app and the write-ups and a reader will meet them
without warning.

| Term | Means |
|---|---|
| measured best | the action 128 play-outs scored highest — the honest grader |
| trap | a position where the tempting throw is wrong; how the Train tab picks hands |
| decisive | a position where one action separates from the rest by more than two standard errors |
| the coach | the book-based solver that explains its reasoning, right about half the time |
| the field | the datagen personalities, as opposed to a table of coaches |
| cause | why a mistake happened, from the eight in the record |
| shanten | distance from a complete hand — code only, never shown to a learner |

---

## What happens after you edit this

Marking a term costs one search and replace plus the asterisks; the renderer already exists and every
screen that shows card text runs through it. The risky ones are the words that also appear in code
identifiers or in the measured record — `ready` hid inside `already` 227 times, and three
`'closer-to-ready'` code literals had to be left alone — so the sweep is done term by term with the
tests and a browser check after each, not in one pass.
