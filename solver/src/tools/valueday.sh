#!/usr/bin/env bash
# Play the re-fitted value tables against the shipped coach, one variant at a time.
#
#   cd solver && caffeinate -i bash src/tools/valueday.sh
#
# Runs for hours, so it is built to be left alone. Every shard writes its own log under data/gen and
# a shard whose log already carries a pooled line is skipped, which makes the whole thing resumable:
# if it is killed, or the machine restarts, running it again picks up where it stopped rather than
# repeating deals that are already measured.
#
# WHY A SCALE SWEEP. A first triage of 1,200 paired deals put every fitted variant behind the coach,
# and ordered them by how much of the study's scale they kept: the raw swap lost 1.43 +/- 0.44 and
# the version rescaled by 2.17 lost 0.56 +/- 0.40. That points at the scale rather than at the
# numbers. `_fitrate` measures the coach's decisiveness as the gap between its top two plans - 10.75
# chips on the shipped tables - and the fitted tables reach that at a scale near 4.3 while STILL
# changing the throw on 28% of discards. So at 4.3 the two table sets are equally decisive and
# disagree only about which plan is better, which is the question worth a day of compute. The sweep
# runs either side of it so the answer is a curve rather than a single point.
#
# WHY MORE THAN ONE VARIANT. The fitted tables are about 2.2x flatter than the shipped ones - a
# strong half-colour hand at turn 40 is 41 chips in the study and 4.2 in our games. `rankDiscards`
# scores a throw as hand value MINUS danger, so flattening the value side is arithmetically the same
# as raising DANGER_WEIGHT from 40 to about 88, and the danger sweep already showed that more defence
# loses monotonically. A straight swap would therefore lose for a reason that has nothing to do with
# whether the fitted numbers are better. Two independent ways of restoring the balance are played
# here - lowering the danger weight, and rescaling the tables - and if they agree the answer is about
# the tables rather than about the knob.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1          # solver/
TSX=./node_modules/.bin/tsx
OUT=../data/gen
N=${N:-2000}                                   # paired deals per seat per shard
FROMS=${FROMS:-"820001 840001 860001 880001"}  # four fresh ranges, none used for fitting or tuning

# name | tables file | danger weight ("-" keeps the shipped 40)
VARIANTS=(
  "s2.17|$OUT/tables-fit-s2.17.json|-"
  "s3|$OUT/tables-fit-s3.json|-"
  "s4.3|$OUT/tables-fit-s4.3.json|-"
  "s5.5|$OUT/tables-fit-s5.5.json|-"
)

echo "=== value-table day started $(date '+%F %T') - $N deals/seat, ranges: $FROMS ==="
for v in "${VARIANTS[@]}"; do
  IFS='|' read -r name tables dw <<< "$v"
  [ -f "$tables" ] || { echo "  $name: $tables missing, skipped"; continue; }
  echo ""
  echo "--- $name  ($tables${dw:+, danger weight $dw}) $(date '+%T')"
  pids=()
  for from in $FROMS; do
    log="$OUT/h2h-fitted-$name-$from.log"
    if grep -q "over all" "$log" 2>/dev/null; then echo "    $from already done, skipping"; continue; fi
    if [ "$dw" = "-" ]; then
      $TSX src/tools/headtohead.ts "$N" fitted --tables "$tables" --from "$from" > "$log" 2>&1 &
    else
      $TSX src/tools/headtohead.ts "$N" fitted --tables "$tables" --dw "$dw" --from "$from" > "$log" 2>&1 &
    fi
    pids+=($!)
  done
  for p in "${pids[@]:-}"; do [ -n "$p" ] && wait "$p"; done
  for from in $FROMS; do
    printf "    %-8s " "$from"; grep "over all" "$OUT/h2h-fitted-$name-$from.log" 2>/dev/null || echo "(no result - check the log)"
  done
done

echo ""
echo "=== pooling $(date '+%T') ==="
python3 - "$OUT" <<'PY'
import glob, math, os, re, sys, collections
out = sys.argv[1]
rows = collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(out, "h2h-fitted-*.log"))):
    m = re.search(r"over all (\d+) paired deals: ([-+0-9.]+) . ([0-9.]+)", open(f).read())
    if not m: continue
    name = re.sub(r"^h2h-fitted-(.*)-\d+\.log$", r"\1", os.path.basename(f))
    rows[name].append((int(m.group(1)), float(m.group(2)), float(m.group(3))))
print(f"{'variant':16}{'deals':>10}{'chips/game':>16}{'t':>8}   verdict")
for name, rs in sorted(rows.items()):
    w = [1 / se**2 for _, _, se in rs]
    mean = sum(x * wi for (_, x, _), wi in zip(rs, w)) / sum(w)
    se = 1 / math.sqrt(sum(w))
    n = sum(d for d, _, _ in rs)
    t = mean / se
    verdict = "AHEAD" if t > 2 else "BEHIND" if t < -2 else "inside 2 SE"
    print(f"{name:16}{n:>10,}{mean:>+10.3f} ± {se:.3f}{t:>+8.1f}   {verdict}")
PY
echo ""
echo "=== finished $(date '+%F %T') ==="
