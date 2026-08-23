# Knowledge base

**Start here:** [PLAYBOOK.md](PLAYBOOK.md) to read, [playbook.json](playbook.json)
to build against.

Two sources merged into one, organised by the decision being made rather than by
which book it came from.

| File | What it is |
|---|---|
| [PLAYBOOK.md](PLAYBOOK.md) | The combined playbook, human-readable. Deal → each turn → endgame. |
| [playbook.json](playbook.json) | Same thing machine-readable: 102 rules + a 22-step decision procedure with cross-referenced rule ids, plus a `table_profile` for the Min 2 / Max 5 / Self-Draw-at-1 table. |
| [../data/table.config.json](../data/table.config.json) | The house rules the engine and playbook read from. |
| [sources/](sources/) | Provenance. The two per-source knowledge bases and their coverage notes. |

## What is in it

102 rules across seven decision phases:

| Phase | The question | Rules | Measured |
|---|---|---|---|
| deal | What am I playing for? | 6 | 6 |
| build | Which tiles do I keep? | 28 | 4 |
| call | Do I claim this tile? | 15 | 3 |
| read | What are opponents doing? | 13 | 2 |
| push_fold | Am I still in this hand? | 12 | 1 |
| discard | Which tile is safe to throw? | 16 | 4 |
| meta | Am I judging my play correctly? | 12 | 4 |

**Measured** (24) comes from the Singapore simulation study — numbers you
implement directly. **Heuristic** (78) is adapted from a Riichi source or reasoned from a house rule — judgment
you calibrate.

## Precedence

**When the two disagree, measured wins.** It is native Singapore, simulated
against the actual rules, and it already corrected a factual error in the adapted
material (see `widen_when_folding`, tagged `corrected`).

The split is clean and not accidental. The analytic source answers *what to play
and when to quit* — target selection, valuation, break-even thresholds, measured
deal-in risk. The Riichi source answers *how to shape a hand* — which block to
break, which wait to prefer, what a discard reveals. Where both speak they agree,
which is worth something given no shared lineage: 13 rules are tagged
`cross_checked`.

The merge shows up most concretely in the push step of the turn loop — rank
discards by shape heuristics, then filter by measured risk. Neither book states
that; it only exists because both are present.

## Three things to get right before writing code

1. **Play moves counterclockwise — to each player's right.** Opposite handedness
   from Japanese sources. Only your right-hand opponent can Chow you. Any
   seat-based heuristic ported from Riichi material targets the wrong player.

2. **Make Player Turns a first-class value** — discards plus exposed sets. Nearly
   every threshold is indexed on it, and the whole idea that a good hand decays
   into a bad one depends on tracking it.

3. **Every fixed strategy loses money.** An AI that settles on one target loses
   regardless of how well it plays it. Selection is the engine.

## Build order

1. Tile set, wall, deal — `../data/tiles.json` (bonus replacement is the fiddly part)
2. Hand representation, melds, concealed vs exposed, **Player Turns counter**, **opponent-observation state**
3. Win detection: four sets + Eye, plus 13 Wonders, plus the All-Chow restrictions
4. Fan evaluation — `../data/scoring.singapore.json`
5. Payment: immediate payouts, the eight Pay All scenarios, Fan Limit — `../data/rules.singapore.json`
6. AI: follow `decision_procedure` in playbook.json, phase by phase

Opponent-observation state (per-player discard history, uncalled tiles, meld
timing, own-suit discard counts, draw-vs-hand discards) is needed by nearly every
`read` rule. Build it at step 2 — retrofitting it is painful.
