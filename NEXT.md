# Where we left off — 2026-09-10, evening

Read this first. `Framework - Mahjong.md` is the plan this project exists to produce. `PLAN.md` is
the app's roadmap, `MOBILE.md` the phone pass, `FINDINGS.md` everything measured and why.

## First thing: is the deploy green?

Confirmed green at 18:20 on 2026-09-10: the merged Train tab, the 10k packs, the hand log and the
green-dragon icon are all live and were loaded on a phone-sized viewport.

**The sharding is built and sitting uncommitted in the working tree.** A Fable agent started at about
18:05 sharded the quiz packs to the design at the end of MOBILE.md and finished at about 18:40 with
`./check.sh` green and the Train tab and Review driven. `git status --short` shows its work: the
three pack directories under `web/public/quiz/` (the monolithic `coach.json`, `min1.json` and
`min1-nowild.json` are deleted), `datagen/src/quizpack.ts`, `packlib.ts` and `buildrare.ts`,
`solver/src/pack.ts` and its test, `web/src/components/Train.tsx`, `Review.tsx`,
`web/tools/singlefile.mjs`, and a paragraph in MOBILE.md. It was told not to commit. Commit it whole
with `git commit --only <paths>`; the pack directories are about 47MB across three hundred files,
which is the same bytes as before in more files.

HEAD builds again as of `880eb5b`, which committed the finished Train merge in one piece. Everything
is pushed. Check https://github.com/SzeThoChangs/Mahjong/actions - the top "Deploy the trainer" run
should be green and https://szethochangs.github.io/Mahjong/ should show the green-dragon icon in its
tab. If it is red, read the failing step's annotations (the check-runs API returns them without
signing in) and run `./check.sh` locally; it runs exactly what CI runs.

How HEAD came to be broken, so it does not recur: two agents were working in this tree at once, and
a bare `git commit` for the icon swept in the renames one of them had staged with `git mv`, leaving
`App.tsx` importing files that no longer existed. Commit with `git commit --only <paths>` while any
agent may be in the tree. Written up in memory as well.

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
