# Singapore Mahjong

| Dir | What |
|---|---|
| `engine/` | rules engine (TypeScript, UI-free): tiles, wall, win detection, Fan scoring, payouts, resumable game state, recorder hooks, configurable rules layer |
| `solver/` | the coach: book evaluators, target selection, discard ranking, explanations |
| `datagen/` | self-play data generator (Layer 1) and rollout evaluator (Layer 2) |
| `web/` | "Which tile?" — Vite + React + shadcn discard trainer |
| `data/` | tile set, scoring, rules, `table.config.json` (house rules); `data/gen/` = generated datasets (git-ignored) |
| `knowledge/` | the combined playbook and its sources |

```bash
pnpm install
pnpm test          # every package
pnpm dev           # the trainer at http://localhost:5173
pnpm -C datagen gen -- --hands 1000 --workers 8 --out ../data/gen/dev
```
See `PLAN.md` for the roadmap and status.
