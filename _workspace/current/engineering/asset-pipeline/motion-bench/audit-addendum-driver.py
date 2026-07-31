#!/usr/bin/env python3
"""Measure bench FBX files with audit-fbx-motion-bench.py's analyze_fbx().

Two modes:
  --mode missing  measure only files absent from fbx-audit-report-FULL-OBSERVED.json
  --mode all      measure every bench FBX, so every row is produced by ONE metric

Mode ``all`` exists because the shipped FULL-OBSERVED report was produced by an older
revision of the audit tool whose ``hips_displacement`` is a flat signed end-minus-start
vector, whereas the current tool emits a nested local/world max-minus-min range. Those two
numbers are not comparable: a clip that returns to its start pose reads 0 under the old
metric and non-zero under the new one. Selecting sources across that seam would compare
unlike quantities, so candidate ranking uses a single uniform ``all`` pass.

Reuses analyze_fbx() verbatim; only main()'s 42-file corpus guard is bypassed, never the
measurement itself.

Run under Blender:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P <this> -- --mode all --out <json>
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]
AUDIT_SCRIPT = REPO_ROOT / "scripts/audit-fbx-motion-bench.py"
BENCH_DIR = REPO_ROOT / "assets/motion/bench"
BASE_REPORT = (
    REPO_ROOT
    / "_workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report-FULL-OBSERVED.json"
)


def script_args(argv: list[str] | None = None) -> list[str]:
    values = list(sys.argv if argv is None else argv)
    return values[values.index("--") + 1 :] if "--" in values else values[1:]


def load_audit_module():
    spec = importlib.util.spec_from_file_location("abyssal_audit_fbx", AUDIT_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--mode", choices=("missing", "all"), default="missing")
    args = parser.parse_args(script_args())

    audit = load_audit_module()
    every = sorted(BENCH_DIR.glob("*.fbx"))
    if args.mode == "all":
        todo = every
    else:
        covered = {entry["file"] for entry in json.loads(BASE_REPORT.read_text(encoding="utf-8"))["files"]}
        todo = [p for p in every if p.name not in covered]

    print(f"[addendum] mode={args.mode}: {len(todo)} files")

    rows = []
    for index, path in enumerate(todo, 1):
        print(f"  [{index}/{len(todo)}] {path.name}", flush=True)
        rows.append(audit.analyze_fbx(path))

    payload = {
        "schema": "fbx-audit-report-1.0",
        "tool": "audit-addendum-driver.py (reuses audit-fbx-motion-bench.analyze_fbx)",
        "mode": args.mode,
        "bench_directory": str(BENCH_DIR),
        "base_report": str(BASE_REPORT),
        "metric_note": (
            "hips_displacement here is the CURRENT tool's nested local/world max-minus-min "
            "range. It is NOT comparable to the flat signed end-minus-start vector stored in "
            "the legacy FULL-OBSERVED rows."
        ),
        "total_files": len(rows),
        "analysis_complete": True,
        "files": rows,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[addendum] wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
