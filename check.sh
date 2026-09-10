#!/bin/bash
# Everything CI checks, run the way CI runs it.
#
# Three traps live here and all three cost a green local run and a red CI run on the same commit.
# `web/tsconfig.json` is a solution file with "files": [], so `tsc --noEmit -p .` compiles nothing
# and exits 0. `tsc -b` is incremental, so a stale .tsbuildinfo can skip the file you just broke;
# --force is the only honest form. And web is on TypeScript 6 while the other three are on 5, and
# TypeScript 6 turns `strict` on by default - so reaching for a tsc from the wrong package checks
# the code under rules it will not be built with.
#
# The repository path contains a colon, which pnpm's .bin shims cannot handle, so every tool is
# called by its real path in the store.
set -uo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
fail=0

tsc_of() {  # each package's OWN compiler, not whichever one is to hand
  ls -d "$ROOT/node_modules/.pnpm/typescript@$1"*/node_modules/typescript/bin/tsc 2>/dev/null | head -1
}
TS5=$(tsc_of 5); TS6=$(tsc_of 6)
VITEST=$(ls -d "$ROOT/node_modules/.pnpm/"vitest@*/node_modules/vitest/vitest.mjs 2>/dev/null | head -1)

echo "== typecheck"
for pkg in engine solver datagen; do
  printf '  %-9s ' "$pkg"
  (cd "$pkg" && node "$TS5" -b --force 2>&1 | head -5) && echo ok || { echo FAILED; fail=1; }
done
printf '  %-9s ' web
(cd web && node "$TS6" -b --force 2>&1 | head -10) && echo ok || { echo FAILED; fail=1; }

echo "== tests"
for pkg in engine solver; do
  printf '  %-9s ' "$pkg"
  (cd "$pkg" && node "$VITEST" run 2>&1 | grep -E "Tests +[0-9]+ (passed|failed)") || { echo FAILED; fail=1; }
done

echo "== build"
printf '  %-9s ' web
(cd web && node "$TS6" -b --force && node "$ROOT/node_modules/.pnpm/"vite@5*/node_modules/vite/bin/vite.js build 2>&1 | tail -1) || { echo FAILED; fail=1; }

[ $fail -eq 0 ] && echo "ALL GREEN" || echo "SOMETHING FAILED"
exit $fail
