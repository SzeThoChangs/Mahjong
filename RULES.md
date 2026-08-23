# Singapore Mahjong — implementation notes

Sourced from *A Data Analytic Evaluation of Singapore Mahjong*. Machine-readable
form in [data/](data/); strategy in [knowledge/](knowledge/).

## Tile set (148)

| Group | Count | Notes |
|---|---|---|
| Suits (Bamboo / Circle / Million) | 108 | 3 suits x 9 ranks x 4 |
| Honors (winds + dragons) | 28 | 4 winds, 3 dragons, x4 |
| Flowers + Seasons | 8 | seat-linked, 1 copy each |
| **Animals** | **4** | cat, mouse, chicken, centipede |

The last **15** tiles of the wall are Unplayable — not drawn, and yielding no
replacement tiles. (67% of tables; 25% use 1–14, 8% use none.)

## Scoring: Fan, not tai

Chips = `2 ^ min(Fan, Fan Limit)`. The discarder pays double; on a Self-Draw all
three opponents pay double. Typical table: Minimum Fan 1, Fan Limit 5.

Full tables in [data/scoring.singapore.json](data/scoring.singapore.json).
Headline values: Chicken 0, All-Chow 1, All-Pong 2, Half-Color 2, **Ping Wu 4**,
Full-Color 4, 13 Wonders 8, All-Terminal 9, Wind Set 12, All-Kong 14.

## Direction — read this before writing turn logic

Play moves **counterclockwise, which from a seated player is to their right.**

- The player to your **right** plays after you, and is the **only** opponent who
  may Chow your discard.
- The player to your **left** plays before you; you may Chow their discards.

This is the opposite handedness from Japanese convention. Any seat-based
heuristic taken from Riichi material will target the wrong player.

## Rules with no Japanese analogue

- **Animals** — cat, mouse, chicken, centipede. Instant payouts, pair bonuses
  (cat+mouse, chicken+centipede), 1 Fan each.
- **Pay All** — eight scenarios where the discarder covers everyone's share. This
  changes discard danger structurally: some discards carry three players' downside.
- **Prohibited discard use** — you may not claim a tile matching your own last
  discard, nor any discarded by anyone after your last discard. Rolling, so it
  clears when you discard again. Milder than furiten, but real.
- **Kong taxonomy** — Kong-4 (four concealed), Kong-3 (claim a discard onto three
  concealed), Kong-1 (add to an exposed Pong). Each pays out immediately and grants
  a replacement draw, so kongs are *good* here — the opposite of the Riichi warning.

## Move priority

`Win > Kong-3 > Pong > Chow`, ties broken by the nearest player counterclockwise
of the discarder.

## This table

**Minimum Fan 2, Fan Limit 5, Self-Draw wins at 1 Fan.** Captured in
[data/table.config.json](data/table.config.json) with the items still to confirm.
The playbook carries a `table_profile` describing how the opening book shifts.

## House rules — decide before writing the scorer

Table variation is surveyed in Section 2.6 and captured in
[data/rules.singapore.json](data/rules.singapore.json). The switches that change
engine behaviour: Minimum Fan (0/1/2), Fan Limit (3–6 or none), Unplayable Tile
count, Pay All Fresh Tile threshold and definition, Kong payout amounts, and
whether a Self-Draw or fully-concealed win earns a bonus Fan.

Nothing in the engine should hardcode a Fan value. Read from config.

## Skip this

Sections 2.4 and 2.5 cover table etiquette and remedies for irregular play —
misdeals, exposed tiles, wrong tile counts. The source states these cannot occur
in a computer implementation. Largest block of rules text, least relevance here.

## Build order

See [knowledge/README.md](knowledge/README.md#build-order). Two notes worth
lifting: track **Player Turns** (discards + exposed sets) from the start — every
analytic threshold is indexed by it — and design opponent-observation state in
early, because both reading models need it and it is painful to retrofit.
