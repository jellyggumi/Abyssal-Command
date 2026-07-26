#!/usr/bin/env python3
"""Validate the concept/runtime/candidate asset lanes.

The validator is deterministic, uses only Python's standard library, and emits a
machine-readable report with ``--json``.  By default it scans the repository
root; positional roots (or repeated ``--root`` values) replace that root.  A
missing candidate directory is an expected clean-baseline condition when
``--allow-missing-candidates`` is supplied.

Example:
    python3 scripts/validate-asset-lanes.py --json --allow-missing-candidates

A non-zero exit status means the policy or one of the scanned roots has a
violation.  Candidate media must have a sibling ``.provenance.json`` sidecar
whose fields authorize runtime promotion; candidates remain unshipped even
when that sidecar says ``runtimeEligible: true``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


SCRIPT_PATH = Path(__file__).resolve()
REPO_ROOT = SCRIPT_PATH.parents[1]
DEFAULT_POLICY_PATH = REPO_ROOT / "_workspace/20260726-stage2-balance-agency/engineering/asset-pipeline/asset-lanes.json"
IGNORED_NAMES = {".git", ".DS_Store", "__pycache__"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("roots", nargs="*", type=Path, help="scan roots (default: repository root)")
    parser.add_argument("--root", dest="option_roots", action="append", type=Path, help="additional scan root")
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY_PATH, help="asset-lane policy JSON")
    parser.add_argument("--json", action="store_true", dest="as_json", help="emit a JSON report")
    parser.add_argument(
        "--allow-missing-candidates",
        action="store_true",
        help="do not report a missing candidate directory as a violation",
    )
    return parser.parse_args()


def violation(code: str, path: str, message: str, **extra: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"code": code, "path": path, "message": message}
    result.update(extra)
    return result


def load_policy(policy_path: Path) -> dict[str, Any]:
    with policy_path.open("r", encoding="utf-8") as handle:
        policy = json.load(handle)
    if not isinstance(policy, dict) or not isinstance(policy.get("lanes"), dict):
        raise ValueError("policy must contain a lanes object")
    for lane_name in ("concept", "runtime", "candidate"):
        lane = policy["lanes"].get(lane_name)
        if not isinstance(lane, dict) or not isinstance(lane.get("paths"), list):
            raise ValueError(f"policy lane {lane_name!r} must contain paths")
    return policy


def normalize_rel(path: str | Path) -> PurePosixPath:
    text = str(path).replace(os.sep, "/").strip("/")
    if text in ("", "."):
        return PurePosixPath()
    return PurePosixPath(text)


def path_parts(path: PurePosixPath) -> tuple[str, ...]:
    return tuple(part.casefold() for part in path.parts if part not in ("", "."))


def matches_spec(relative_path: PurePosixPath, spec: dict[str, Any], root: Path) -> bool:
    configured = normalize_rel(spec.get("path", ""))
    if not configured:
        return False
    recursive = bool(spec.get("recursive", True))
    rel_parts = path_parts(relative_path)
    configured_parts = path_parts(configured)
    if recursive:
        return rel_parts[: len(configured_parts)] == configured_parts

    target = root.joinpath(*configured.parts)
    if target.is_file():
        return rel_parts == configured_parts
    return len(rel_parts) == len(configured_parts) + 1 and rel_parts[: len(configured_parts)] == configured_parts


def matching_lanes(relative_path: PurePosixPath, root: Path, policy: dict[str, Any]) -> list[str]:
    lanes: list[str] = []
    for lane_name in ("concept", "runtime", "candidate"):
        lane = policy["lanes"][lane_name]
        excluded = {normalize_rel(item.get("path", "")) for item in lane.get("excludedPaths", [])}
        if relative_path in excluded:
            continue
        if any(matches_spec(relative_path, spec, root) for spec in lane["paths"]):
            lanes.append(lane_name)
    return lanes


def should_ignore(path: Path) -> bool:
    return any(part in IGNORED_NAMES for part in path.parts)


def iter_files(root: Path) -> Iterable[Path]:
    for directory, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
        dirnames[:] = sorted(name for name in dirnames if name not in IGNORED_NAMES)
        for name in sorted(filenames):
            path = Path(directory) / name
            if not should_ignore(path):
                yield path


def display_path(root: Path, file_path: Path, multiple_roots: bool) -> str:
    relative = file_path.relative_to(root).as_posix()
    if not multiple_roots:
        return relative or "."
    return f"{root.as_posix()}:{relative}"


def is_concept_marked(relative_path: PurePosixPath, markers: dict[str, Any]) -> tuple[bool, str]:
    parts = path_parts(relative_path)
    configured_segments = {str(item).casefold() for item in markers.get("pathSegments", [])}
    for segment in parts:
        if segment in configured_segments:
            return True, f"path segment {segment!r} is a concept marker"

    basename = relative_path.name.casefold()
    for prefix in markers.get("filePrefixes", []):
        prefix_text = str(prefix).casefold()
        if basename.startswith(prefix_text):
            return True, f"file name starts with concept marker {prefix_text!r}"
    return False, ""


def nonempty(value: Any) -> bool:
    if value is None or value is False:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, dict)):
        return bool(value)
    return True


def validate_candidate_sidecar(
    artifact: Path,
    relative_path: PurePosixPath,
    root: Path,
    lane: dict[str, Any],
    report_path: str,
) -> list[dict[str, Any]]:
    sidecar_config = lane.get("sidecar", {})
    suffix = str(sidecar_config.get("suffix", ".provenance.json"))
    sidecar = artifact.with_name(artifact.stem + suffix)
    if not sidecar.is_file():
        return [
            violation(
                "candidate_sidecar_missing",
                report_path,
                f"generated candidate requires sibling sidecar {sidecar.name!r}",
                sidecar=(sidecar.relative_to(root).as_posix() if sidecar.is_relative_to(root) else sidecar.as_posix()),
            )
        ]

    try:
        with sidecar.open("r", encoding="utf-8") as handle:
            metadata = json.load(handle)
    except (OSError, ValueError) as exc:
        return [violation("candidate_sidecar_invalid_json", sidecar.relative_to(root).as_posix(), str(exc))]
    if not isinstance(metadata, dict):
        return [violation("candidate_sidecar_not_object", sidecar.relative_to(root).as_posix(), "sidecar JSON must be an object")]

    errors: list[dict[str, Any]] = []
    required_fields = sidecar_config.get("requiredFields", [])
    aliases = {
        "rightsReceipt": ("rightsReceipt", "rights_receipt", "rights"),
        "runtimeReceipt": ("runtimeReceipt", "runtime_receipt", "runtimeVerification"),
    }
    for field in required_fields:
        names = aliases.get(str(field), (str(field),))
        present_name = next((name for name in names if name in metadata and nonempty(metadata[name])), None)
        if present_name is None:
            errors.append(
                violation(
                    "candidate_sidecar_field_missing",
                    sidecar.relative_to(root).as_posix(),
                    f"sidecar field {field!r} must be present and non-empty",
                    field=field,
                )
            )
    expected_eligible = sidecar_config.get("runtimeEligibleValue", True)
    if "runtimeEligible" in metadata and metadata["runtimeEligible"] is not expected_eligible:
        errors.append(
            violation(
                "candidate_runtime_ineligible",
                sidecar.relative_to(root).as_posix(),
                f"runtimeEligible must be {expected_eligible!r} before candidate promotion",
            )
        )
    return errors


def validate(
    policy: dict[str, Any],
    policy_path: Path,
    roots: list[Path],
    allow_missing_candidates: bool,
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "policy": policy_path.relative_to(REPO_ROOT).as_posix()
        if policy_path.is_relative_to(REPO_ROOT)
        else policy_path.as_posix(),
        "roots": [root.as_posix() for root in roots],
        "lanes": {"concept": 0, "runtime": 0, "candidate": 0},
        "filesScanned": 0,
        "violations": [],
    }
    violations: list[dict[str, Any]] = report["violations"]
    multiple_roots = len(roots) > 1
    candidate_specs = policy["lanes"]["candidate"]["paths"]

    for root in roots:
        if not root.exists() or not root.is_dir():
            violations.append(violation("scan_root_missing", root.as_posix(), "scan root does not exist or is not a directory"))
            continue
        for spec in candidate_specs:
            candidate_root = root.joinpath(*normalize_rel(spec.get("path", "")).parts)
            if not candidate_root.exists() and not allow_missing_candidates:
                violations.append(
                    violation(
                        "candidate_root_missing",
                        candidate_root.relative_to(root).as_posix(),
                        "candidate lane root is missing (use --allow-missing-candidates for a clean baseline)",
                    )
                )

        for file_path in iter_files(root):
            relative_path = normalize_rel(file_path.relative_to(root))
            lanes = matching_lanes(relative_path, root, policy)
            if not lanes:
                continue
            report["filesScanned"] += 1
            for lane_name in lanes:
                report["lanes"][lane_name] += 1
            report_path = display_path(root, file_path, multiple_roots)
            if len(lanes) > 1:
                violations.append(violation("lane_overlap", report_path, f"asset matches multiple lanes: {', '.join(lanes)}"))

            extension = file_path.suffix.casefold()
            for lane_name in lanes:
                lane = policy["lanes"][lane_name]
                allowed = {str(item).casefold() for item in lane.get("allowedExtensions", [])}
                if extension not in allowed:
                    violations.append(
                        violation(
                            "extension_not_allowed",
                            report_path,
                            f"extension {extension or '<none>'!r} is not allowed in {lane_name} lane",
                            lane=lane_name,
                        )
                    )

            if "runtime" in lanes:
                runtime = policy["lanes"]["runtime"]
                suffixes = {str(item).casefold() for item in runtime.get("forbiddenConceptMarkers", {}).get("metadataSuffixesExcluded", [])}
                if not any(file_path.name.casefold().endswith(suffix) for suffix in suffixes):
                    marked, reason = is_concept_marked(relative_path, runtime.get("forbiddenConceptMarkers", {}))
                    if marked:
                        violations.append(violation("runtime_concept_asset", report_path, f"concept material is under runtime path: {reason}"))

            if "candidate" in lanes:
                candidate = policy["lanes"]["candidate"]
                artifact_extensions = {str(item).casefold() for item in candidate.get("artifactExtensions", [])}
                if extension in artifact_extensions:
                    violations.extend(validate_candidate_sidecar(file_path, relative_path, root, candidate, report_path))

    violations.sort(key=lambda item: (str(item.get("path", "")), str(item.get("code", "")), str(item.get("field", ""))))
    report["violationCount"] = len(violations)
    report["ok"] = not violations
    return report


def main() -> int:
    args = parse_args()
    roots_input = list(args.roots) + list(args.option_roots or [])
    roots = [path.expanduser().resolve() for path in roots_input] if roots_input else [REPO_ROOT]
    policy_path = args.policy.expanduser().resolve()
    try:
        policy = load_policy(policy_path)
        report = validate(policy, policy_path, roots, args.allow_missing_candidates)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        report = {
            "policy": policy_path.as_posix(),
            "roots": [root.as_posix() for root in roots],
            "lanes": {"concept": 0, "runtime": 0, "candidate": 0},
            "filesScanned": 0,
            "violations": [violation("policy_invalid", policy_path.as_posix(), str(exc))],
            "violationCount": 1,
            "ok": False,
        }
        if args.as_json:
            print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False))
        else:
            print(f"asset lane validation failed: {exc}", file=sys.stderr)
        return 2

    if args.as_json:
        print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False))
    else:
        status = "OK" if report["ok"] else "FAIL"
        print(f"{status}: scanned {report['filesScanned']} lane files; {report['violationCount']} violation(s)")
        for item in report["violations"]:
            print(f"- {item['path']}: {item['message']}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
