# Where we left off — 2026-09-12

Read this first. `Framework - Mahjong.md` is the plan this project exists to produce. `PLAN.md` is
the app's roadmap, `MOBILE.md` the phone pass, `FINDINGS.md` everything measured and why.

## Nothing is running. The site is green and current.

Live at https://szethochangs.github.io/Mahjong/ (the `/Mahjong/` matters). Last deploy 636a7a3.
Everything below is pushed; the tree is clean.

## What landed on 2026-09-11

- **Every pack question verified twice.** `--verify 512` in `quizpack.ts` re-judges each admitted
  question on fresh play-outs and drops it unless the gap still clears 2 SE. About a fifth went.
  Rebuilt at `--max 12800` so the packs are back at ten thousand: coach 10,500, min1 10,473,
  min1-nowild 10,257. Every earlier question id survives, so no stored card is orphaned.
- **The phone pass, all four items.** Bottom bar (Train/Spot/Review/Tips/More), 48px targets,
  safe areas, square table kept at a 22px tile; an update bar after every deploy; on-demand tabs
  with the worker precaching every chunk; and the Challenge button running in the browser.
- **The Play tab (prototype).** One hand against three coaches, then every decision judgeable
  against the measured best. Committed 636a7a3.
- **Framework draft.** "The mistake types" and "The patterns" rewritten with a Sources list.

## What needs Changs

1. **Play a few hands and use the practice hour for a week.** The two questions: does the Play
   loop feel like mahjong, and is the review worth reading. That decides what gets built next.
2. **The late-game table at 360px.** With ~50 discards the square is ~410px wide against 320px of
   card, so it scrolls inside its card. Accept that, or a smaller tile on late hands.
3. **Read the framework draft** and say what is wrong in it.
4. **The one number still owed:** pack button to first question on a real phone on 4G.

## What is next to build, in the order I would do it

1. **The claim judge.** The Play review under-prices taking a win or making a call, because the
   play-out bots never fold and rarely win first (FINDINGS, "The whole-hand judge is honest on
   throws and not yet on claims"). The screen says so. The fix is a stronger rollout policy for
   claim questions, measured against the known claim results before it is trusted.
2. **The rest of the game**, per PLAN.md "Where this is going: a game": sessions, rotation, a
   running score. Only after the loop has been played and the review is trusted.
3. **Smaller:** an export button that posts a friend's record to Changs; the pack phase mix now
   leans mid-hand (50% against 40% in the run).

## Things that will bite whoever works here next

- The repo path has a colon, so pnpm `.bin` shims fail. Call tools by their real dist paths and
  glob the version directory. `./check.sh` runs exactly what CI runs; `tsc --noEmit -p .` in web/
  checks nothing because that tsconfig is a solution file.
- `git commit --only -- <paths>` silently skips UNTRACKED files inside a directory you name. `git
  add` every new file first, or the pushed commit will not build. This has happened twice.
- One long build at a time, and check `ps -eo rss,command | sort -rn | head` first: an idle Ollama
  model held 3.5GB and made a two-hour build look like a twenty-hour one.
- The single-file build needs `SINGLE_FILE=1 vite build` before `tools/singlefile.mjs`, and it
  carries the Challenge worker inline on `window.__WORKER_SRC`.

## Retired packs


`money` (the 4-joker min-2 table under an older name) and `nowild` (0 jokers, min 2, a table Changs
does not play) were dropped from the site on 2026-09-10 at his say-so; copies live in
`data/gen/retired-packs/` for the audit tools. Any mistake card on a phone that points at them will
show "cannot be rebuilt" with a button to drop it, which is the intended behaviour.

## Where things are

- **Live:** https://szethochangs.github.io/Mahjong/ - with `/Mahjong/` on the end; the bare account
  address has no site and shows GitHub's 404. Deploys on every push to `evaluator-accuracy` via
  `.github/workflows/pages.yml`. The repo must stay public for Pages on a free account.
- **Installed on a phone** it works offline after the first visit (`web/public/sw.js`).
- **Icon:** the green dragon on maroon (`b097a1c`).
- **Packs:** 10,000 questions on each of the three tables Changs plays, honest at every question,
  built with `--mix decisive` (commit `ab5e24f`). 14-16 MB each. The no-joker pack is half of all
  the decisive positions its run has, so it cannot grow without more grading.
- **Hand log:** every answered discard is kept and can be reopened with the answer shown, on the
  Review tab under "Hands you have played". Built for friends who want to see a past hand and why.
- **Docs still say "Real quiz"** in `PLAN.md`, `MOBILE.md`, `FINDINGS.md` and the framework. The
  last two are records of what was measured and should keep the name they measured under; the first
  two are forward-looking and should be updated.
- **Single-file build:** `node web/tools/singlefile.mjs` folds the app into one 8.5 MB page for
  anywhere with no host. Published once as an artifact; superseded by the real site.

## The merge (done, `880eb5b`)

One practice tab called **Train**, which is the old Real quiz's behaviour with a fallback:
- serves pack questions judged by the play-outs by default - the honest grader
- falls back to a generated hand only when the filters leave nothing, and then says plainly that
  the hand is made up and marked by the *Coach*, which is right about half the time
- never presents a *Coach* verdict and a play-out verdict as the same thing
- the mistake record and the hand log keep working, and both still say which judge marked a hand
- the old Real quiz tab disappears; nothing else in the tab bar changes

Why: the two tabs differed only in who marks the answer. The packs are already filtered to decisive
positions, which was Train's other claim, and both tabs already explain their reasoning. Changs said
"I want the best coach/trainer", which decides every small call in favour of the play-outs.

Driving it found three real bugs, all fixed in that commit; the commit message has them. The one
worth remembering: the hand log's Review path fetched a 10 MB pack in a loop (282 requests) because
a memo was missing - the kind of thing only clicking finds.

## Then, in the order the pain is felt

1. **The phone layout pass.** Bottom tab bar (decided), 48px targets, safe-area insets. `MOBILE.md`
   has the measurements. Open question: are the four primary tabs Train, Spot, Review and Tips?
2. **Split the bundle** and **an update prompt** so testers are not stuck on a stale version.
3. **The export button** does nothing in the single-file artifact version; irrelevant on the real
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
- `BASE_PATH` rewrites what Vite emits, not the static files in `web/public/`. The manifest's
  `start_url` and `scope` must be relative (`./`), or an installed copy opens on the host's root -
  which on this host is a 404. Found by Changs on his phone, 2026-09-10.

## Pointers

- Repo: https://github.com/SzeThoChangs/Mahjong (branch `evaluator-accuracy`)
- Phone mockup that settled the layout: https://claude.ai/code/artifact/e1788fde-df9e-43db-adfc-8da2352febc5
- Tips cards as a standalone page: https://claude.ai/code/artifact/263e56ef-880a-45e5-ab45-5fb37fdbda38
