# sg-mahjong-engine

Singapore Mahjong rules engine in TypeScript. UI-free. Reads the table's house
rules from `../data/table.config.json`.

```bash
pnpm install
pnpm test            # 30 tests: tiles, wall, decomposition, Fan scoring, payouts, full games
pnpm sim 5000        # simulate 5000 hands with baseline bots, print stats vs the book's numbers
pnpm sim 2000 random # same with purely random bots
```

## Layout

| File | What |
|---|---|
| `src/tiles.ts` | 148-tile model: 46 kinds x instances, names, parsing, predicates |
| `src/wall.ts` | seeded shuffle, front draws, back replacement draws, 15-tile unplayable reserve |
| `src/decompose.ts` | 4 sets + eye decomposition (all of them), 13 Wonders, winning-tile enumeration |
| `src/score.ts` | Fan evaluation: every combination, honour/bonus/event Fan, All-Chow restrictions, `fanInHand` |
| `src/payout.ts` | `2^min(fan,limit)`, discarder/self-draw doubling, minimum-Fan incl. the self-draw-at-1 rule, immediate payouts |
| `src/game.ts` | one hand as a phase machine: deal, draw/self/discard, claims with priority, kongs, prohibited-discard rule, draws |
| `src/bots.ts` | `RandomBot`, `IsolationBot` — legal baseline play for engine verification only |
| `src/sim.ts` | N-game harness with conservation and zero-sum invariants; prints win/draw/seat/turn/combination stats |

## What is verified

- Every game conserves all 148 tiles and every payment nets to zero (checked on every simulated hand).
- Every win the engine accepts decomposes validly and meets the table minimum (2 Fan, or 1 on self-draw).
- Fan values against worked cases: Ping Wu 4, All-Chow 1, All-Pong 2, Concealed All-Pong 7, Half-Color 2,
  Full-Color 4, 13 Wonders 8, dragon/wind sets, two-dragons-eye, three-winds-eye, bonus and event Fan.
- All-Chow restrictions: eye not dragon / seat / prevailing wind; not with two concealed tiles; discard win needs two
  or more unique winning tiles (self-draw exempt).

## Rules coverage

- Robbing the kong: an added kong (kong1) can be robbed by any winning hand; a concealed kong (kong4) only by 13 Wonders. The robbed kong is undone.
- Seven Flower (10 Fan, replaces individual flower Fan), Eight Flower and all-four-animals instant wins (`special_hands`, off by default).
- Pay-All liability (`bao`, off by default): feeding the third dragon set / fourth wind set / an honour pong that takes the exposed Fan to the limit,
  feeding a 3-4-exposed-set colour hand, and fresh-tile discards late in the wall. The liable seat pays all three shares.
- Not modelled: seven-pairs (no such hand on this table), table-etiquette remedies.
- Strategy lives in `solver/`; the bots here exist to exercise the rules.

## Reading the sim output against the book

The book's equal-skill baseline at Minimum Fan 2: ~23% win per seat with East highest, 14% draws,
~48 Player Turns per hand, East +1.0 / North −1.1 chips. Baseline bots land at ~18% / 29% draws / 62 turns —
the gap is bot skill, not rules. As the AI layer lands those numbers should walk toward the book's.
