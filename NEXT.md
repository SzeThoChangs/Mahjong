# Where we left off — 2026-09-10, evening

Read this first. `Framework - Mahjong.md` is the plan this project exists to produce. `PLAN.md` is
the app's roadmap, `MOBILE.md` the phone pass, `FINDINGS.md` everything measured and why.

## First thing: is the deploy green?

Confirmed green at 18:20 on 2026-09-10: the merged Train tab, the 10k packs, the hand log and the
green-dragon icon are all live and were loaded on a phone-sized viewport.

**The sharding is committed (`8946d51`) and pushed.** Measured on this Mac, pack button to first
question: 3,541 ms -> 784 ms, 15.03 MB -> 217 KB fetched, heap 164 MB -> 29 MB. Every old qid is
present in the new packs, so nobody's record is orphaned. Not measured on a real phone yet - that is
the one number still owed, and Changs can supply it by opening the Train tab on 4G.

## A three-hour build may be running, finished, or cut off - check before anything else

RESTARTED 01:40 on 2026-09-11, one pack at a time (min1, then min1-nowild, then coach): the first run at 21:10 ran all three at once, swapped the machine to a crawl and was killed. The relaunch crawled too for its first hour (10 s a question) while the swap from the killed run drained; by 02:45 it was back to 0.6 s a question with min1 at 750/10001 verified, dropping about 1 in 6. min1 FINISHED 04:27 on 2026-09-11: kept 8,156 of 10,001 admitted (18.4% did not hold at 2 SE on fresh play-outs, best changed on 26), written to `web/public/quiz/min1/` in 82 shards - not yet committed. min1-nowild FINISHED 06:19: kept 8,002 of 10,000 (20.0% dropped, best changed on 28), written to `web/public/quiz/min1-nowild/` in 81 shards - not yet committed. coach FINISHED 08:15: kept 8,133 of 10,001 (18.7% dropped, best changed on 25). All three verified packs committed and pushed 08:20 with the FINDINGS entry; the top-up (stream 2 below) started by itself at ~08:20. Note the verified packs land nearer 8.2k than the 10k Changs asked for; a top-up (`--max` ~12,300 so the drop lands at 10k) is a decision for him once all three are in. `data/gen/verify-chain.log` gets a "start <pack>" line as each begins. All three packs rebuilding with `--verify 512`, a second independent
pass that drops questions whose gap does not hold on fresh play-outs (FINDINGS: "The packs overstate
their certainty"). They rewrite `web/public/quiz/coach/`, `min1/` and `min1-nowild/` in
place, so those directories are NOT safe to commit until each build's log says it finished.

How to tell, per pack, from `data/gen/pack-<name>-verified.log`:

    grep -E "verified at|questions ->" data/gen/pack-coach-verified.log

Finished: both lines present ("verified at 512 fresh play-outs each: kept N, dropped M ..." then
"N questions -> ..."). Cut off: either line missing. `pgrep -f quizpack.ts` says whether anything
is still running.

If all three finished: `./check.sh`, then commit the three directories and `web/public/quiz/
index.json` together with `git commit --only`, push, watch the deploy, and add the measured drop
rates to the FINDINGS entry (it predicts about a tenth; the smoke test at 64 play-outs dropped 60%,
which was lack of power, not the curse - that is why the real pass uses 512).

If cut off, re-run the missing ones. From `datagen/`, one per pack, each takes about an hour
(coach nearer two):

    node ../node_modules/.pnpm/tsx@4.23.12/node_modules/tsx/dist/cli.mjs src/quizpack.ts \
      --dir ../data/gen/run-coach2 --out ../web/public/quiz --name coach --max 10000 --mix decisive --verify 512
    ... same with run-min1 / min1, and run-min1-nowild / min1-nowild

Run them under `nohup` so a closed session cannot kill them; log to `data/gen/pack-<name>-verified.log`.

## PUSHED 12:40 on 2026-09-11 at Changs's "Push": everything below is live

Commits 2caa444 (web batch), 130fb92 (framework draft), 102b0c1 (eight new files the first
commit missed - `git commit --only` skips untracked paths; `git add` new files first). Deploy
green on 102b0c1. The top-up packs landed 15:19 and were copied in and pushed at 15:25: coach 10,500, min1
10,473, min1-nowild 10,257, every earlier question id still present (0 orphaned cards). The
`data/gen/topup/` directory can be deleted once the deploy is confirmed.

## Overnight 2026-09-11 (Changs asleep from ~04:40): three streams running

1. **Verify chain** as above; caffeinate is armed on it so the Mac does not idle-sleep. When it ends
   (`data/gen/verify.done` appears): `./check.sh`, commit the three pack directories plus
   `web/public/quiz/index.json` with `git commit --only`, push, watch the deploy, add the measured
   drop rates to FINDINGS ("packs overstate their certainty": min1 dropped 18.4%).
2. **Top-up to 10,000**, queued in `data/gen/topup/run.sh` (its own caffeinate). It waits for
   `verify.done`, then rebuilds each pack at `--max 12800 --verify 512` into `data/gen/topup/quiz/`
   (NOT web/public/quiz, so the committed packs are never half-written). Logs in
   `data/gen/topup/pack-<name>.log`, `chain.log`; `topup.done` marks the end, expected mid-afternoon.
   When done: check each pack's kept count, copy `data/gen/topup/quiz/<name>/` over
   `web/public/quiz/<name>/`, regenerate/copy `quiz/index.json`, check.sh, commit, push.
3. **Two Fable agents** in this working tree, both told not to run git: one doing the phone layout
   pass (bottom bar with Train/Spot/Review/Tips + More, 48px targets, safe areas, square table kept
   on phones; touches web/src only), one drafting "The mistake types" and "The patterns" in
   `Framework - Mahjong.md` with a Sources list. BOTH FINISHED by 05:45: their changes sit
   uncommitted for review. `./check.sh` is ALL GREEN with the layout changes in. The layout preview
   is published at https://claude.ai/code/artifact/5a732dfe-0a3f-48a8-b16e-a99695c50fae (single
   file, 600 questions a pack). One open point from the layout agent: a late-game table (50
   discards) is ~410px wide at 22px tiles against 320px of card at 360, so it scrolls inside its
   card; fitting it needs a smaller tile than the settled 22px. Changs decides.
   06:45: a third agent finished MOBILE items 3 and 4 (bundle split with lazy tabs, SW update bar,
   build-stamped worker). check.sh ALL GREEN with everything in. Also uncommitted. The single-file
   build now needs `SINGLE_FILE=1 vite build` first.
   11:45: a fourth agent built the IN-BROWSER CHALLENGE BUTTON (Changs asked "where is my
   challenge button"): the play-out core moved to `solver/src/rejudge.ts` (datagen calls it; a
   20-question pack build is bit-identical before/after), `solver/src/question.ts` rebuilds a
   position from a pack question alone (proved identical outcome-for-outcome on 100 questions via
   `datagen/src/rejudgecheck.ts`), a web worker runs 512 fresh play-outs on the phone (~1 s on the
   Mac), and the result is written to the hand log and mistake card as a `challenged` note. The
   dev-only /api/challenge is gone. check.sh ALL GREEN. Uncommitted with the rest.
   12:10: the single-file build carries the worker inline (`window.__WORKER_SRC`, blob worker in
   `web/src/lib/rejudge.ts`) and now has its own charset+viewport metas; Challenge verified in the
   one-file preview (2.7 s for three actions at 512 on the loaded Mac). Preview republished at the
   artifact URL above. `.claude/launch.json` gained `web-single` (python http.server on 5178 over
   web/dist-single) for checking that build.
   Top-up: min1 finished 10:32 (kept 10,473 of 12,801, 18.2% dropped) (see data/gen/topup/pack-min1.log), min1-nowild running, coach next.
   Memory: an idle Ollama model was holding 3.5GB and swapping the Mac; unloaded 05:20 via
   `curl localhost:11434/api/generate -d '{"model":"<name>","keep_alive":0}'` (app left running).

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
