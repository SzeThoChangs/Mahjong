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

## Layer 2 — evaluator

```bash
pnpm -C datagen evaluate -- --dir ../data/gen/run100k --hands 2000 --per-hand 4 --rollouts 128 --adaptive --policy shanten --workers 8 --seed 7
pnpm -C datagen evalstats -- ../data/gen/run100k
```

For each sampled decision: rebuild the exact position (`positionAt` replays the hand to decision *d* — decisions are
reconstructed by replay too, so no decision shard is read), then for every legal action run rollouts to the end of the
hand and average the acting seat's chips. Output `evals-wN.jsonl.gz`:
`{g,h,d,k,t,seat,bot,sel,mode,policy,n, actions:[{a,ev,sd,win,dealin,draw,n}], best, selEv, regret}`.

- `--mode sampled` (default): hidden information is re-dealt for every rollout consistent with what the acting seat can
  see — opponents' concealed tiles (standard tiles only), the remaining wall, the reserve. This is the honest label.
  `--mode oracle`: continue from the true hidden state (hindsight value; for debugging).
- Common random numbers: every action at a decision sees the same sampled hidden states and rollout seeds, so EV
  differences are paired comparisons.
- `--adaptive`: successive halving — every action gets ¼ of the budget, the top half gets ½, the top quarter the full
  `--rollouts`. All actions still get an EV; the close ones get the samples.
- Rollout policies: `shanten` (default; shanten-greedy, ~12 µs/decision, 93% of hands end in a win), `fast`
  (IsolationBot), `efficiency` (the heuristic bot; slow). Rollout-policy strength biases absolute EVs — treat them as
  relative rankings until the policy is stronger.
- At a claim decision the other seats' (hidden) intentions are re-decided by the rollout bots after determinization.
- Cost: ~0.4 ms per rollout, ~200 ms per decision at adaptive-128; ~40 decisions/s on 8 workers.

`positionAt` + `determinize` live in `src/position.ts`; tests assert exact reconstruction of every decision of a hand and
tile conservation after determinization. `evalstats.ts` reports regret / agreement by bot, kind and phase, plus flags.
`scripts/to_parquet.py` also converts `evals-*` to one row per (decision, action).

## Which rules a dataset uses

The generator plays the rules in `data/table.config.json` (`rules` block, deep-merged over the engine defaults) unless
`--book-rules` is given; the *effective* rules are written to `manifest.json` and `evaluate`/`replay` read them back from
there, so a dataset always replays under the rules it was made with. Datasets `run100k` / `run100k-v2` predate this and
used the engine defaults (no jokers, discarder-pays-double, no pay-all).

## Engine rules coverage

Robbing the kong, Seven/Eight-Flower and all-animals specials, Pay-All liability, shooter-pays, and **jokers** (4 wild tiles;
dealer's four-joker instant win; four jokers in a complete hand = 5 tai; discarded jokers dead; jokers never in exposed melds)
are implemented and config-gated (`engine/src/rules.ts`). The player's table (`data/table.config.json`) turns on shooter-pays,
pay-all (fresh tile: last 8), 8-flower instant win and 4 jokers. With jokers in play ~83% of hands end in a win (vs ~37% without).
