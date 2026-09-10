# Where we left off — 2026-09-10, evening

Read this first. `Framework - Mahjong.md` is the plan this project exists to produce. `PLAN.md` is
the app's roadmap, `MOBILE.md` the phone pass, `FINDINGS.md` everything measured and why.

## The one thing to do before anything else

**HEAD does not build, and a merge is half-finished in the working tree.** Fix that first.

What happened. Two Fable agents were working in this tree at once. One rebuilt the quiz packs (done,
committed). The other was merging the Train tab into the Real quiz tab (see "The merge" below). While
it worked, I committed the app icon with `git add <paths>` and then a bare `git commit`, which
commits the whole index - and the agent had already staged its renames with `git mv`. So commit
`0b9d065` carries `Train.tsx` and `GeneratedHand.tsx` without the `App.tsx` that imports them, and
every deploy since has failed. The live site is unaffected: it still serves the last good build.

Do this, in order:

    ./check.sh                      # runs exactly what CI runs; read its header, it names three traps

If it prints ALL GREEN, the agent finished: commit everything under web/src in ONE commit, push,
and watch the deploy at https://github.com/SzeThoChangs/Mahjong/actions. Then commit `NEXT.md`.

If it is not green, the agent was cut off mid-edit. `git status --short` will show what it touched
(`App.tsx`, `GeneratedHand.tsx`, `Review.tsx`, `Train.tsx`, `lib/mistakes.ts`, `lib/scenario.ts`).
Read `App.tsx` first - it must import `Train` and not `Trainer` or `RealQuiz` - then work through
the errors. The design it was implementing is in "The merge" below; do not redesign it.

Never again commit with a bare `git commit` while an agent may be in the tree. Use
`git commit --only <paths>`. The two commits after the bad one were made that way and are clean:
`180eec2` (the `--mix` flag) and `ab5e24f` (the 10k packs). Neither is pushed.

## Where things are

- **Live:** https://szethochangs.github.io/Mahjong/ - with `/Mahjong/` on the end; the bare account
  address has no site and shows GitHub's 404. Deploys on every push to `evaluator-accuracy` via
  `.github/workflows/pages.yml`. The repo must stay public for Pages on a free account.
- **Installed on a phone** it works offline after the first visit (`web/public/sw.js`).
- **Icon:** the green dragon on maroon, committed in `b097a1c`, not yet live because that deploy
  failed for the reason above.
- **Packs:** 10,000 questions on each of the three tables Changs plays, honest at every question,
  built with `--mix decisive` (commit `ab5e24f`). 14-16 MB each. The no-joker pack is half of all
  the decisive positions its run has, so it cannot grow without more grading.
- **Hand log:** every answered discard is kept and can be reopened with the answer shown, on the
  Review tab under "Hands you have played". Built for friends who want to see a past hand and why.
- **Single-file build:** `node web/tools/singlefile.mjs` folds the app into one 8.5 MB page for
  anywhere with no host. Published once as an artifact; superseded by the real site.

## The merge (what the agent was building)

One practice tab called **Train**, which is the Real quiz's behaviour with a fallback:
- serves pack questions judged by the play-outs by default - the honest grader
- falls back to a generated hand only when the filters leave nothing, and then says plainly that
  the hand is made up and marked by the *Coach*, which is right about half the time
- never presents a *Coach* verdict and a play-out verdict as the same thing
- the mistake record and the hand log keep working, and both still say which judge marked a hand
- the old Real quiz tab disappears; nothing else in the tab bar changes

Why: the two tabs differed only in who marks the answer. The packs are already filtered to decisive
positions, which was Train's other claim, and both tabs already explain their reasoning. Changs said
"I want the best coach/trainer", which decides every small call in favour of the play-outs.

## Then, in the order the pain is felt

1. **Shard the quiz packs.** At 15 MB a pack, the Real quiz's parse-on-open is 3.5s on this Mac and
   15-25s on a phone. Design is settled in `MOBILE.md`: hundred-question shards plus an index, and the
   *Cause* label baked into the pack at build time so the index can pick a shard without loading one.
2. **The phone layout pass.** Bottom tab bar (decided), 48px targets, safe-area insets. `MOBILE.md`
   has the measurements. Open question: are the four primary tabs Train, Spot, Review and Tips?
3. **Split the bundle** and **an update prompt** so testers are not stuck on a stale version.
4. **The export button** does nothing in the single-file artifact version; irrelevant on the real
   site, where it works.

## Decided, so do not reopen

Bottom bar over top bar. The square table stays on a phone at a 22px tile. No login for friends
testing - each phone keeps its own record; the export is the bridge. Honest packs over balanced ones.
Green dragon on maroon. Jargon is written `*like this*`, italic, coloured by kind (`JARGON.md`).

## Traps that cost a day, all now written down

- `web/tsconfig.json` is a solution file with `"files": []`; `tsc --noEmit -p .` checks nothing.
- `tsc -b` is incremental; use `--force`.
- web is on TypeScript 6 (strict by default), the rest on 5; use each package's own compiler.
- The repo path has a colon, so pnpm's `.bin` shims fail; `check.sh` shows the real paths.
- A bare `git commit` sweeps whatever an agent staged. Pathspec, always.

## Pointers

- Repo: https://github.com/SzeThoChangs/Mahjong (branch `evaluator-accuracy`)
- Phone mockup that settled the layout: https://claude.ai/code/artifact/e1788fde-df9e-43db-adfc-8da2352febc5
- Tips cards as a standalone page: https://claude.ai/code/artifact/263e56ef-880a-45e5-ab45-5fb37fdbda38
