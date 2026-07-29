#!/usr/bin/env bash
set -euo pipefail

BLENDER_BIN="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

STAGING_ROOT="${STAGING_ROOT:-/tmp/rig-staging}"
OVERLAY="${OVERLAY:-$ROOT_DIR/assets/motion/ingame/unarmed-core.glb}"
OUTPUT="${OUTPUT:-$ROOT_DIR/_workspace/current/engineering/asset-pipeline/motion-bench/deformation-gate-report.json}"
CATEGORIES="${CATEGORIES:-commander companions enemies bosses}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --staging-root)
      STAGING_ROOT="$2"
      shift 2
      ;;
    --overlay)
      OVERLAY="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --categories)
      CATEGORIES="$2"
      shift 2
      ;;
    --blender)
      BLENDER_BIN="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: audit-all-character-deformation.sh [options]

Options:
  --staging-root /path   Stage directory containing character GLBs
  --overlay /path        Overlay GLB path
  --output /path         JSON report output path
  --categories "a b c"   Space-separated categories
  --blender /path        Blender executable (default 5.2 install)
EOF
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -x "$BLENDER_BIN" ]]; then
  :
else
  BLENDER_FALLBACK="$(command -v blender || true)"
  if [[ -n "${BLENDER_FALLBACK}" ]]; then
    BLENDER_BIN="$BLENDER_FALLBACK"
  fi
fi

if [[ ! -x "$BLENDER_BIN" ]]; then
  echo "Blender executable not found: $BLENDER_BIN" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

read -r -a CATEGORY_ARGS <<< "$CATEGORIES"
set +e
"$BLENDER_BIN" -b --factory-startup -P "$ROOT_DIR/scripts/audit-character-deformation-blender.py" -- \
  --staging-root "$STAGING_ROOT" \
  --overlay "$OVERLAY" \
  --output "$OUTPUT" \
  --categories "${CATEGORY_ARGS[@]}"
status=$?
set -e


if [[ ! -f "$OUTPUT" ]]; then
  echo "Deformation gate did not write report at $OUTPUT" >&2
  exit 1
fi

if [[ $status -ne 0 ]]; then
  echo "Deformation gate failed. See $OUTPUT" >&2
  exit $status
fi

echo "deformation gate pass: $OUTPUT"
exit 0
