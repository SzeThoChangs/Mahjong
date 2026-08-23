# Which tile? — web trainer

Vite + React + TypeScript + Tailwind v4 + shadcn/ui. Static; no backend.

```bash
pnpm install          # from the repo root
pnpm dev              # http://localhost:5173
pnpm build            # web/dist
```

- `src/lib/scenario.ts` — deals a quiz hand by simulating a real game with baseline bots and stopping at a genuine
  discard decision in the chosen phase (early 1–15, mid 16–35, late 36–60 Player Turns). 70% of hands are filtered
  for "interesting" (the coach disagrees with the naive pick, or a real combination is in play, and wrong answers exist);
  30% are whatever was dealt.
- `src/App.tsx` — the quiz: context, hand, verdict, plan, reasons, every option, session score.
- `public/tiles/` — tile PNGs (copied from `../assets/tiles`).
- Table rules come from `../data/table.config.json` at build time.
