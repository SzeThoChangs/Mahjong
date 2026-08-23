#!/bin/bash
# Overnight: generate under the table's money rules, evaluate ~480k decisions (resumable), summarise, convert to Parquet.
cd "$(dirname "$0")/.."
OUT=../data/gen/run-money
VENV="/private/tmp/claude-502/-Users-changshengszetho-Desktop-01-All-Projects-My-Games-Mahjong/12a7a5b9-734f-47e0-a966-762b0e9ab487/scratchpad/venv"

if [ ! -f "$OUT/manifest.json" ]; then
  npx tsx src/generate.ts --hands 150000 --workers 8 --out "$OUT" --seed 3030 --truth || exit 1
fi
npx tsx src/stats.ts "$OUT" > "$OUT/stats.txt" 2>&1

for i in 1 2 3 4 5 6; do
  echo "=== evaluation attempt $i $(date) ==="
  npx tsx src/evaluate.ts --dir "$OUT" --hands 120000 --per-hand 4 --rollouts 128 --adaptive --policy shanten --workers 8 --seed 31 --resume
  ok=$(node -e "try{const m=require('$PWD/$OUT/evals-manifest.json');console.log(m.failedWorkers===0&&m.errors<100?'yes':'no')}catch{console.log('no')}")
  [ "$ok" = "yes" ] && break
  echo "attempt $i ended with failures; resuming in 30s"; sleep 30
done

npx tsx src/evalstats.ts "$OUT" > "$OUT/evalstats.txt" 2>&1
"$VENV/bin/python" scripts/to_parquet.py "$OUT" --rows-per-file 1000000
echo "OVERNIGHT RUN COMPLETE $(date)"
