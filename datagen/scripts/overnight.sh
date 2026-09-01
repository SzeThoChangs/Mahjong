#!/bin/bash
# Generate + evaluate under the table's rules. Resumable; safe to re-run.
# Every step is checked: the run stops at the first failure instead of printing COMPLETE over broken outputs.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-../data/gen/run-money3}
HANDS=${HANDS:-150000}
DECISIONS=${DECISIONS:-120000}
# Parquet is an export for analysis OUTSIDE this repo - nothing here reads it - so a missing venv
# skips that step rather than failing a run that has already done its seven hours of work. The old
# default pointed into a per-session scratchpad that no longer existed, which would have failed the
# whole run at the very last step.
VENV=${VENV:-.venv}

fail() { echo "RUN FAILED at ${1} $(date)" >&2; exit 1; }
# stdout+stderr to a file, but only replace the previous good copy when the step succeeds
run_to() { local f=$1 label=$2; shift 2
  if "$@" > "$f.tmp" 2>&1; then mv "$f.tmp" "$f"; else echo "--- tail of $f.tmp ---" >&2; tail -20 "$f.tmp" >&2; fail "$label"; fi
}

if [ ! -f "$OUT/manifest.json" ]; then
  npx tsx src/generate.ts --hands "$HANDS" --workers 8 --out "$OUT" --seed 4040 --truth || fail generate
fi
run_to "$OUT/stats.txt" stats npx tsx src/stats.ts "$OUT"

ok=no
for i in 1 2 3 4 5 6; do
  echo "=== evaluation attempt $i $(date) ==="
  npx tsx src/evaluate.ts --dir "$OUT" --hands "$DECISIONS" --per-hand 4 --rollouts 128 --adaptive --policy shanten --workers 8 --seed 41 --resume
  ok=$(node -e "try{const m=JSON.parse(require('fs').readFileSync('$OUT/evals-manifest.json','utf8'));console.log(m.failedWorkers===0&&m.errors<100?'yes':'no')}catch{console.log('no')}")
  [ "$ok" = "yes" ] && break
  echo "attempt $i ended with failures; resuming in 30s"; sleep 30
done
[ "$ok" = "yes" ] || fail "evaluate (6 attempts exhausted)"

run_to "$OUT/evalstats.txt" evalstats npx tsx src/evalstats.ts "$OUT"
npx tsx src/profile.ts --dir "$OUT" --out ../web/public/profile --name money || fail profile
npx tsx src/quizpack.ts --dir "$OUT" --out ../web/public/quiz --name money --max 5000 || fail quizpack
npx tsx src/export.ts --dir "$OUT" --out ../web/public/replays/money --hands 180 || fail export
if [ -x "$VENV/bin/python" ]; then
  "$VENV/bin/python" scripts/to_parquet.py "$OUT" --rows-per-file 1000000 || fail parquet
  echo "OVERNIGHT RUN COMPLETE $(date)"
else
  echo "WARNING: no python venv at $VENV - parquet export SKIPPED. Everything the app reads is built." >&2
  echo "OVERNIGHT RUN COMPLETE (parquet skipped) $(date)"
fi
