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

## Layer 2 — evaluator (v1)

```bash
pnpm -C datagen exec tsx src/evaluate.ts --dir ../data/gen/run100k --hands 200 --per-hand 4 --rollouts 64 --mode sampled --policy fast --workers 8
```

For each sampled decision: rebuild the exact position (`positionAt` replays the hand to decision *d*), then for every
legal action run N rollouts to the end of the hand and average the acting seat's chips. Output `evals-wN.jsonl.gz`:
`{g,h,d,k,seat,bot,sel,mode,policy,n, actions:[{a,ev,sd,win,dealin,draw,n}], best, selEv, regret}`.

- `--mode sampled` (default): hidden information is re-dealt for every rollout consistent with what the acting seat can
  see — opponents' concealed tiles (standard tiles only), the remaining wall, the reserve. This is the honest label.
  `--mode oracle`: continue from the true hidden state (hindsight value; useful for debugging).
- Common random numbers: every action at a decision sees the same sampled hidden states and rollout seeds, so EV
  differences are paired comparisons, not noise between independent samples.
- `--policy fast` rolls out with the engine's IsolationBot (~2–3 ms per rollout); `efficiency` uses the heuristic bot
  (slower, stronger). Rollout-policy strength biases the values — treat v1 EVs as relative rankings.
- At a claim decision the other seats' (hidden) intentions are re-decided by the rollout bots after determinization.

`positionAt` + `determinize` live in `src/position.ts`; tests assert exact reconstruction of every decision of a hand and
tile conservation after determinization.

## Known gaps (engine)

Pay-All liability, robbing the kong, Eight-Flower / all-animals instant wins are not implemented (config exists, logic does not).
