# solver/src/tools

Measurement scripts, not library code. Nothing in `solver/src` imports from here; these exist to
answer a question and then to still be runnable when the answer is doubted later.

| script | question it answers |
|---|---|
| `headtohead.ts` | does a bot actually win money against the book coach? Rotates through all four seats, pairs the walls, reports a mean and an error bar. Arms: `policy` / `claim` / `full` / `fold` / `self`. `self` plays the coach against itself and MUST return exactly 0.000 — it is the harness's own self-check. |
| `dangersweep.ts` | how defensively should the coach play? Sweeps `DANGER_WEIGHT` against chips. |
| `foldsweep.ts` | should the coach ever give up on a hand? Sweeps the threat/shanten thresholds. |
| `foldrate.ts` | how often does a rule actually FIRE? Run this before believing any result about a rule — a rule measured underneath another untested change measures nothing. |
| `coachcheck.ts` | how far is the book coach from the measured EVs, and where? |
| `calibrate.ts` | fits the coach's verdict bands to the measured spread |
| `reasoncheck.ts` | does every discard come back with a real reason, or a fallback? |
| `leakhunt.ts` | do tiles ever go missing, and do bots ever name a tile they do not hold? |
| `sim.ts` | plain N-game simulation with win/draw/seat/turn statistics |

Two things every one of these takes: a game count, and — since 2026-08-30 — a **wall seed base**.
The seed used to be hardcoded, which let a single shuffle fake a per-seat pattern convincingly
enough that it was reported as the project's strongest lead. Any breakdown finer than a headline
number should be re-run on a second seed before it is believed.
