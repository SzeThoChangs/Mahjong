# sg-mahjong-datagen — self-play simulator & data generator

Layer 1 of the three-layer plan (generator → evaluator → model). Dumb bots play
complete, legal Singapore Mahjong hands; every decision is recorded with its legal
actions; every hand reproduces from its seed. The bots' choices are **not labels**.

```bash
pnpm -C datagen test                                     # 11 tests: shanten, determinism, replay, legality, visibility, dealer rules
pnpm -C datagen gen -- --hands 100000 --workers 8 --out ../data/gen/run1 --seed 2026 --truth
pnpm -C datagen stats -- ../data/gen/run1                # validation statistics + bug flags
pnpm -C datagen replay -- ../data/gen/run1 17 3          # reproduce session 17 hand 3, compare decision hash
python datagen/scripts/to_parquet.py data/gen/run1       # JSONL.gz -> Parquet (needs pyarrow)
```

Generator flags: `--hands N` `--workers W` `--out DIR` `--seed S` `--truth` (write wall order per hand)
`--no-decisions` (hands only) `--max-hands 32` (per session) `--randomness '{"ranked":[0.7,0.15,0.1],"random":0.05}'`
`--rules '{"minimum_tai":1}'` (deep-merged over `engine/src/rules.ts` defaults).

## Layout

| File | What |
|---|---|
| `src/features.ts` | shanten (standard + 13 Wonders), ukeire (effective tiles + unseen copies), structure counts, per-discard features |
| `src/bots.ts` | EfficiencyBot, AggressiveBot, PongBot, ChowBot, RandomBot; controlled randomness `pickRanked` |
| `src/session.ts` | sessions: dealer retention, prevailing wind, running scores; `playHand` (used by replay); per-hand and per-seat seeds |
| `src/records.ts` | compact record schemas (numeric tile kinds, short action strings), FNV hash |
| `src/worker.ts` / `src/generate.ts` | worker_threads fan-out, shard files per worker, manifest |
| `src/stats.ts` | validation statistics and suspicious-behaviour flags |
| `src/replay.ts` | reproduce a hand from (session, hand) and compare |
| `scripts/to_parquet.py` | Parquet conversion, typed columns |

## Records

**decisions-wN.jsonl.gz** — one line per decision (self / discard / claim). Player-visible only:
`g h d seed k t p dl w sc ch rem` · `me {h, dr, b, m}` (acting player's concealed tiles, drawn tile, bonus, melds) ·
`pub {dl, m, b}` (full discard log with claims, every seat's melds and bonus) · `legal[]` · `sel` · `bot` · `f` (features:
per-candidate `DiscardFeatures` for discard decisions; `{sh}` otherwise).
Actions: `d:<kind>` `win` `kong4:<kind>` `kong1:<kind>` `proceed` `pass` `pong:<kind>` `kong3:<kind>` `chow:<k1,k2,k3>`.

**hands-wN.jsonl.gz** — one line per hand: seeds, dealer, wind, bot types, outcome, fan, combination, turns, counts
(chow/pong/kong/flowers/animals/decisions/illegal), chips delta, session scores, per-bot action counts, decision hash.

**truth-wN.jsonl.gz** (`--truth`) — ground truth per hand: the full shuffled wall order. Everything else hidden
(other hands, future draws) is reproduced exactly by replaying the seed. Never join this into model inputs.

## Reproducibility

`hand seed = fnv1a("<sessionSeed>:<handIdx>")`, `bot seed = fnv1a("<handSeed>:bot:<seat>")`, wall = `Wall(makeRng(handSeed))`.
Given a hand record (seed, dealer, wind, bot types) the hand replays bit-for-bit; `replay.ts` checks the decision hash.

## Known gaps (engine)

Pay-All liability, robbing the kong, Eight-Flower / all-animals instant wins are not implemented (config exists, logic does not).
