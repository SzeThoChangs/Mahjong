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
## Finding your way around

The project's knowledge lives in sixteen Markdown files at this level. Start at `PROJECT.md` for
what this is and why, `STATUS.md` for where it is now, and `NEXT.md` for where work stopped and
what happens next. `CLAUDE.md` says how to work in here. `DECISIONS.md` is the one to read before
changing something that looks arbitrary. `P-Starter.md` is the recipe that laid this structure
down; it is not project knowledge and is not needed in normal work.

`project-view/` renders all of it in a browser, so none of it has to be read as Markdown. Serve
the project root and open it:

```bash
python3 -m http.server 5179
```

`prototype/` holds a runnable snapshot of the current build, rebuilt by `prototype/build.sh`. New
features are prototyped there before production code is written.
