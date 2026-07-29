#!/usr/bin/env bash
# Batch-rerig every character GLB through scripts/rig-character-asset-blender.py.
#
# Writes to a staging dir first (never in-place): a Blender crash mid-export
# would otherwise leave a truncated GLB in the assets tree with no way back
# short of a git checkout. Install with --install once the reports look right.
#
#   scripts/rig-all-characters.sh                 # stage into /tmp/rig-staging
#   scripts/rig-all-characters.sh --install       # stage, then copy over assets
#   scripts/rig-all-characters.sh --only guard    # single asset, for iteration
set -uo pipefail

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GLB_DIR="$ROOT/assets/images/battle/glb"
STAGE="${STAGE:-/tmp/rig-staging}"
REPORTS="$STAGE/reports"
BUDGETS="$ROOT/_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/action-pipeline.json"
REST_POSE="${REST_POSE:-natural}"

INSTALL=0
ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) INSTALL=1; shift ;;
    --only) ONLY="$2"; shift 2 ;;
    --rest-pose) REST_POSE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$REPORTS"

CATEGORIES=(commander companions enemies bosses)
declare -a FAILED=()
declare -a OK=()

for cat in "${CATEGORIES[@]}"; do
  for glb in "$GLB_DIR/$cat"/*.glb; do
    [[ -e "$glb" ]] || continue
    id="$(basename "$glb" .glb)"
    if [[ -n "$ONLY" && "$id" != "$ONLY" ]]; then continue; fi
    mkdir -p "$STAGE/$cat"
    out="$STAGE/$cat/$id.glb"
    rep="$REPORTS/$id.json"
    printf '%-22s %-11s ' "$id" "$cat"
    if "$BLENDER" -b -P "$ROOT/scripts/rig-character-asset-blender.py" -- \
        --glb "$glb" --asset-id "$id" --category "$cat" \
        --rest-pose "$REST_POSE" --out "$out" --report "$rep" \
        --budgets-json "$BUDGETS" >/dev/null 2>&1; then
      python3 - "$rep" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
b = next((s for s in d["steps"] if s["step"] == "bind"), {})
print(f"OK   bind={b.get('method','?'):16} armW={b.get('armWeightFrac','?'):<7} "
      f"clips={d.get('clipCount','?'):<3} verts={b.get('weightedVerts','?')}/{b.get('totalVerts','?')}")
PY
      OK+=("$id")
    else
      echo "FAIL"
      FAILED+=("$id")
    fi
  done
done

echo
echo "rigged ${#OK[@]} ok, ${#FAILED[@]} failed"
if [[ ${#FAILED[@]} -gt 0 ]]; then
  printf 'failed: %s\n' "${FAILED[*]}"
fi

if [[ $INSTALL -eq 1 ]]; then
  if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo "refusing to install with failures present" >&2
    exit 1
  fi
  COPY_FAILED=0
  for cat in "${CATEGORIES[@]}"; do
    for staged in "$STAGE/$cat"/*.glb; do
      [[ -e "$staged" ]] || continue
      if ! cp "$staged" "$GLB_DIR/$cat/$(basename "$staged")"; then
        echo "failed to copy staged runtime asset: $(basename "$staged")" >&2
        COPY_FAILED=1
      fi
    done
  done
  if [[ $COPY_FAILED -ne 0 ]]; then
    echo "refusing to install with copy failures present" >&2
    exit 1
  fi
  if ! python3 "$ROOT/scripts/promote-character-assets.py" --refresh-rig --report-dir "$REPORTS"; then
    echo "refusing to install because provenance refresh failed" >&2
    exit 1
  fi
  echo "installed into $GLB_DIR"
fi

exit $(( ${#FAILED[@]} > 0 ))
