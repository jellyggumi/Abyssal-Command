#!/usr/bin/env python3
"""Stage all v2 cartoon-texture GLBs into the runtime candidate lane.

The script copies the 57 reviewed outputs listed by
all-mesh-texture-candidates-v2/audit.json into a candidate GLB root while
writing one provenance sidecar per staged file and one canonical manifest.

Default paths are fixed to the existing repository layout.

Usage:
  python3 scripts/stage-cartoon-texture-pack.py
  python3 scripts/stage-cartoon-texture-pack.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Mapping

DEFAULT_PIPELINE_ROOT = Path(
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
)
DEFAULT_AUDIT_PATH = DEFAULT_PIPELINE_ROOT / "all-mesh-texture-candidates-v2" / "audit.json"
DEFAULT_V2_ROOT = DEFAULT_PIPELINE_ROOT / "all-mesh-texture-candidates-v2"
DEFAULT_COMMANDER_SOURCE = (
    DEFAULT_PIPELINE_ROOT / "runtime-candidates" / "cartoon-texture" / "glb" / "dusk-warden.glb"
)
DEFAULT_CANDIDATE_ROOT = DEFAULT_PIPELINE_ROOT / "runtime-candidates" / "cartoon-texture" / "glb"

GLB_JSON_CHUNK = 0x4E4F534A
COMMANDER_RELATIVE_PATH = "commander/dusk-warden.glb"
COMMANDER_POLICY = "commander-specific-cartoon-atlas"
SHARED_POLICY = "shared-abyssal-toon-surface-v2"
MANIFEST_NAME = "cartoon-texture-pack.manifest.json"
RUNTIME_ROOT_SUFFIX = Path("assets/images/battle/glb")
EXPECTED_CATEGORY_COUNTS = {
    "bosses": 10,
    "commander": 1,
    "companions": 9,
    "enemies": 4,
    "previs": 1,
    "props": 13,
    "terrain": 10,
    "vfx": 9,
}
TOTAL_EXPECTED_ROWS = 57
SCHEMA_VERSION = 1


class StageError(RuntimeError):
    """Raised when staging or check invariants are violated."""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create deterministic cartoon-texture GLB candidates from the v2 audit."
    )
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Repository root used to resolve relative asset paths",
    )
    parser.add_argument(
        "--audit",
        default=str(DEFAULT_AUDIT_PATH),
        help="Path to all-mesh-texture-candidates-v2/audit.json",
    )
    parser.add_argument(
        "--candidate-root",
        default=str(DEFAULT_CANDIDATE_ROOT),
        help="Destination candidate GLB directory",
    )
    parser.add_argument(
        "--v2-root",
        default=str(DEFAULT_V2_ROOT),
        help="Source root containing v2 staged GLBs",
    )
    parser.add_argument(
        "--commander-source",
        default=str(DEFAULT_COMMANDER_SOURCE),
        help="Existing generated commander source GLB",
    )
    parser.add_argument(
        "--runtime-root",
        default=None,
        help="Runtime GLB root (defaults to assets/images/battle/glb under --repo-root)",
    )
    parser.add_argument(
        "--manifest-name",
        default=MANIFEST_NAME,
        help="Manifest file name written under --candidate-root",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate manifest/sidecars/hashes/embedded textures without staging",
    )
    return parser.parse_args(argv)


def _canonical(value: Path | str) -> str:
    return str(value).replace("\\", "/")


def _resolve(path_text: str | None, repo_root: Path, fallback_roots: Iterable[Path] = ()) -> Path:
    if not isinstance(path_text, str) or not path_text:
        raise StageError("missing or non-string path in audit row")
    candidate = Path(path_text)
    if candidate.is_absolute():
        return candidate
    direct = repo_root / candidate
    if direct.is_file():
        return direct
    for root in fallback_roots:
        alt = Path(root) / candidate
        if alt.is_file():
            return alt
    raise StageError(f"cannot resolve audit-relative path: {path_text}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
        raise StageError(f"failed to read JSON from {path}: {exc}") from exc


def read_glb_json(path: Path) -> Mapping[str, Any]:
    data = path.read_bytes()
    if len(data) < 20:
        raise StageError(f"GLB is too short: {path}")
    if data[:4] != b"glTF":
        raise StageError(f"not a glTF file: {path}")
    version = struct.unpack_from("<I", data, 4)[0]
    declared = struct.unpack_from("<I", data, 8)[0]
    if version != 2 or declared != len(data):
        raise StageError(f"invalid GLB header: {path}")

    offset = 12
    json_text = None
    while offset < len(data):
        if offset + 8 > len(data):
            raise StageError(f"truncated GLB chunk header in {path}")
        chunk_length = struct.unpack_from("<I", data, offset)[0]
        chunk_type = struct.unpack_from("<I", data, offset + 4)[0]
        chunk_start = offset + 8
        chunk_end = chunk_start + chunk_length
        if chunk_end > len(data):
            raise StageError(f"truncated GLB chunk body in {path}")
        if chunk_type == GLB_JSON_CHUNK:
            if json_text is not None:
                raise StageError(f"multiple JSON chunks in GLB: {path}")
            chunk = data[chunk_start:chunk_end]
            try:
                json_text = json.loads(chunk.decode("utf-8").rstrip("\0 \t\r\n"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise StageError(f"invalid GLB JSON chunk in {path}: {exc}") from exc
        offset = chunk_end

    if json_text is None:
        raise StageError(f"GLB JSON chunk missing in {path}")
    if not isinstance(json_text, dict):
        raise StageError(f"GLB JSON payload is not an object: {path}")
    return json_text


def census(document: Mapping[str, Any]) -> tuple[int, int, int]:
    materials = document.get("materials", [])
    textures = document.get("textures", [])
    animations = document.get("animations", [])
    if not all(isinstance(value, list) for value in (materials, textures, animations)):
        raise StageError("GLB document has malformed materials/textures/animations arrays")
    return len(materials), len(textures), len(animations)


def _json_textures(document: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    textures = document.get("textures", [])
    if not isinstance(textures, list):
        raise StageError("GLB textures block is malformed")
    return textures


def _json_images(document: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    images = document.get("images", [])
    if not isinstance(images, list):
        raise StageError("GLB images block is malformed")
    return images

def _ensure_embedded_image(image: Mapping[str, Any], image_index: int, glb_label: str) -> None:
    if "uri" not in image:
        if "bufferView" in image:
            return
        raise StageError(f"{glb_label}: image#{image_index} has neither uri nor bufferView")
    uri = image["uri"]
    if not isinstance(uri, str):
        raise StageError(f"{glb_label}: image#{image_index}.uri must be a string")
    if not uri.startswith("data:"):
        raise StageError(f"{glb_label}: image#{image_index}.uri is not embedded")


def ensure_base_and_normal_textures(document: Mapping[str, Any], glb_label: str) -> None:
    materials = document.get("materials", [])
    if not isinstance(materials, list):
        raise StageError(f"{glb_label}: materials block is malformed")
    textures = _json_textures(document)
    images = _json_images(document)

    for index, material in enumerate(materials):
        if not isinstance(material, Mapping):
            raise StageError(f"{glb_label}: material#{index} is not an object")
        pbr = material.get("pbrMetallicRoughness")
        if not isinstance(pbr, Mapping):
            raise StageError(f"{glb_label}: material#{index} missing pbrMetallicRoughness")
        base_texture = pbr.get("baseColorTexture")
        normal_texture = material.get("normalTexture")
        if not isinstance(base_texture, Mapping) or "index" not in base_texture:
            raise StageError(f"{glb_label}: material#{index} missing baseColorTexture index")
        if not isinstance(normal_texture, Mapping) or "index" not in normal_texture:
            raise StageError(f"{glb_label}: material#{index} missing normalTexture index")

        texture_indices = [base_texture["index"], normal_texture["index"]]
        for texture_index in texture_indices:
            if not isinstance(texture_index, int):
                raise StageError(f"{glb_label}: material#{index} texture index is not int")
            if texture_index < 0 or texture_index >= len(textures):
                raise StageError(f"{glb_label}: material#{index} references missing texture#{texture_index}")
            texture = textures[texture_index]
            if not isinstance(texture, Mapping):
                raise StageError(f"{glb_label}: texture#{texture_index} is not an object")
            image_indices = set()
            source = texture.get("source")
            if isinstance(source, int):
                image_indices.add(source)
            for value in (texture.get("extensions") or {}).values():
                if isinstance(value, Mapping) and isinstance(value.get("source"), int):
                    image_indices.add(int(value["source"]))
            if not image_indices:
                raise StageError(f"{glb_label}: texture#{texture_index} has no image source")
            for image_index in sorted(image_indices):
                if image_index < 0 or image_index >= len(images):
                    raise StageError(f"{glb_label}: texture#{texture_index} references missing image#{image_index}")
                image = images[image_index]
                if not isinstance(image, Mapping):
                    raise StageError(f"{glb_label}: image#{image_index} is not an object")
                _ensure_embedded_image(image, image_index, glb_label)


def expected_sidecar(policy: str) -> Mapping[str, Any]:
    return {
        "schemaVersion": 1,
        "generator": "scripts/stage-cartoon-texture-pack.py",
        "rightsReceipt": "candidate-only-no-promotion-pending-runtime-rights-review",
        "runtimeReceipt": "glb-embedding-complete-animation-and-armature-preserved-browser-fallback-pending",
        "runtimeEligible": False,
        "sourceMeshUnmodified": True,
        "animationPreserved": True,
        "texturePolicy": policy,
    }


def build_plan(args: argparse.Namespace) -> list[dict[str, Any]]:
    repo_root = Path(args.repo_root).expanduser().resolve()
    runtime_root = Path(args.runtime_root).expanduser()
    if not runtime_root.is_absolute():
        runtime_root = repo_root / runtime_root
    audit_path = _resolve(args.audit, repo_root)
    v2_root = Path(args.v2_root)
    if not v2_root.is_absolute():
        v2_root = repo_root / v2_root
    candidate_root = Path(args.candidate_root)
    if not candidate_root.is_absolute():
        candidate_root = repo_root / candidate_root

    audit = read_json(audit_path)
    if not isinstance(audit, Mapping):
        raise StageError("audit JSON must be an object")

    rows = audit.get("rows")
    if not isinstance(rows, list):
        raise StageError("audit rows must be an array")
    if len(rows) != TOTAL_EXPECTED_ROWS:
        raise StageError(f"expected {TOTAL_EXPECTED_ROWS} audit rows, found {len(rows)}")

    commander_source = Path(args.commander_source)
    if not commander_source.is_absolute():
        commander_source = repo_root / commander_source

    if not commander_source.is_file():
        raise StageError(f"commander source not found: {commander_source}")

    plan: list[dict[str, Any]] = []
    seen: set[str] = set()

    for entry in rows:
        if not isinstance(entry, Mapping):
            raise StageError("each audit row must be an object")
        relative_text = entry.get("relativePath")
        if not isinstance(relative_text, str):
            raise StageError("audit row missing relativePath")
        relative_path = Path(relative_text)
        relative_posix = _canonical(relative_path)
        if relative_posix in seen:
            raise StageError(f"duplicate relativePath in audit: {relative_posix}")
        seen.add(relative_posix)

        category = relative_path.parts[0] if relative_path.parts else ""
        if not category:
            raise StageError(f"invalid relativePath: {relative_posix}")

        is_commander = relative_posix == COMMANDER_RELATIVE_PATH
        staged_source = commander_source if is_commander else _resolve(entry.get("outputPath"), repo_root, (v2_root,))
        runtime_source = runtime_root / relative_path
        output_path = candidate_root / relative_posix

        if not staged_source.is_file():
            raise StageError(f"staged source not found for {relative_posix}: {staged_source}")
        if not runtime_source.is_file():
            raise StageError(f"runtime source not found for {relative_posix}: {runtime_source}")

        policy = COMMANDER_POLICY if is_commander else SHARED_POLICY
        status = str(entry.get("status", "ok"))
        if status != "ok":
            raise StageError(f"audit row {relative_posix} is not ok: status={status}")

        plan.append(
            {
                "relativePath": relative_posix,
                "category": category,
                "runtimeSource": runtime_source,
                "stagedSource": staged_source,
                "outputPath": output_path,
            }
        )

    if len(plan) != TOTAL_EXPECTED_ROWS:
        raise StageError(f"planned row mismatch: expected {TOTAL_EXPECTED_ROWS}, found {len(plan)}")

    counts = Counter(item["category"] for item in plan)
    for category, expected_count in EXPECTED_CATEGORY_COUNTS.items():
        if counts.get(category) != expected_count:
            raise StageError(
                f"category count mismatch for {category}: expected {expected_count}, found {counts.get(category, 0)}"
            )

    extra = sorted(set(counts) - set(EXPECTED_CATEGORY_COUNTS))
    if extra:
        raise StageError(f"unexpected candidate categories: {', '.join(extra)}")

    # attach resolved constants used during write/check
    plan.sort(key=lambda item: item["relativePath"])
    return plan


def write_sidecar(sidecar_path: Path, row: dict[str, Any], policy: str, staged_source: Path, output_path: Path) -> None:
    sidecar_path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(expected_sidecar(policy))
    payload["source"] = _canonical(staged_source)
    payload["runtimeSource"] = _canonical(row["runtimeSource"])
    payload["runtimeSourceSha256"] = row["runtimeSourceSha256"]
    payload["output"] = _canonical(output_path)
    payload["outputSha256"] = row["outputSha256"]
    sidecar_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def make_manifest(
    runtime_root: Path,
    candidate_root: Path,
    audit_path: Path,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    rows_payload = [
        {
            "relativePath": row["relativePath"],
            "category": row["category"],
            "runtimeSource": _canonical(row["runtimeSource"]),
            "stagedSource": _canonical(row["stagedSource"]),
            "outputPath": _canonical(row["outputPath"]),
            "sourceSha256": row["sourceSha256"],
            "runtimeSourceSha256": row["runtimeSourceSha256"],
            "outputSha256": row["outputSha256"],
            "materialCount": row["materialCount"],
            "textureCount": row["textureCount"],
            "animationCount": row["animationCount"],
            "runtimeEligible": False,
        }
        for row in rows
    ]
    category_counts = Counter(item["category"] for item in rows_payload)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedBy": "scripts/stage-cartoon-texture-pack.py",
        "auditPath": _canonical(audit_path),
        "runtimeRoot": _canonical(runtime_root),
        "candidateRoot": _canonical(candidate_root),
        "rowCount": len(rows_payload),
        "categoryCounts": {key: category_counts[key] for key in sorted(category_counts)},
        "rows": rows_payload,
    }


def validate_sidecar(sidecar_path: Path, row: dict[str, Any], policy: str) -> None:
    if not sidecar_path.is_file():
        raise StageError(f"missing sidecar: {sidecar_path}")
    payload = read_json(sidecar_path)
    if not isinstance(payload, Mapping):
        raise StageError(f"sidecar must be an object: {sidecar_path}")

    expected_text = _canonical(row["stagedSource"])
    expected_runtime = _canonical(row["runtimeSource"])
    expected_output = _canonical(row["outputPath"])

    for key in (
        "source",
        "generator",
        "output",
        "rightsReceipt",
        "runtimeReceipt",
        "runtimeSource",
        "runtimeSourceSha256",
        "outputSha256",
    ):
        if key not in payload or not isinstance(payload[key], str) or not payload[key].strip():
            raise StageError(f"sidecar missing non-empty {key}: {sidecar_path}")
    if payload.get("schemaVersion") != 1:
        raise StageError(f"sidecar schemaVersion must be 1: {sidecar_path}")
    if payload.get("runtimeEligible") is not False:
        raise StageError(f"sidecar runtimeEligible must be false: {sidecar_path}")
    if payload.get("sourceMeshUnmodified") is not True:
        raise StageError(f"sidecar sourceMeshUnmodified must be true: {sidecar_path}")
    if payload.get("animationPreserved") is not True:
        raise StageError(f"sidecar animationPreserved must be true: {sidecar_path}")
    if payload.get("source") != expected_text:
        raise StageError(f"sidecar source mismatch: {sidecar_path}")
    if payload.get("runtimeSource") != expected_runtime:
        raise StageError(f"sidecar runtimeSource mismatch: {sidecar_path}")
    if payload.get("output") != expected_output:
        raise StageError(f"sidecar output mismatch: {sidecar_path}")
    if payload.get("texturePolicy") != policy:
        raise StageError(f"sidecar texturePolicy mismatch: {sidecar_path}")
    if payload.get("runtimeSourceSha256") != row["runtimeSourceSha256"]:
        raise StageError(f"sidecar runtimeSourceSha256 mismatch: {sidecar_path}")
    if payload.get("outputSha256") != row["outputSha256"]:
        raise StageError(f"sidecar outputSha256 mismatch: {sidecar_path}")


def analyze_row(item: dict[str, Any]) -> dict[str, Any]:
    output_path = item["outputPath"]
    if not output_path.is_file():
        raise StageError(f"missing output GLB: {output_path}")

    staged_source = item["stagedSource"]
    if not staged_source.is_file():
        raise StageError(f"missing staged source GLB: {staged_source}")

    runtime_source = item["runtimeSource"]
    if not runtime_source.is_file():
        raise StageError(f"missing runtime source GLB: {runtime_source}")

    document = read_glb_json(output_path)
    ensure_base_and_normal_textures(document, output_path.as_posix())
    material_count, texture_count, animation_count = census(document)

    return {
        "sourceSha256": sha256(staged_source),
        "runtimeSourceSha256": sha256(runtime_source),
        "outputSha256": sha256(output_path),
        "materialCount": material_count,
        "textureCount": texture_count,
        "animationCount": animation_count,
    }


def run_stage(plan: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    repo_root = Path(args.repo_root).expanduser().resolve()
    runtime_root = Path(args.runtime_root).expanduser()
    if not runtime_root.is_absolute():
        runtime_root = repo_root / runtime_root
    audit_path = _resolve(args.audit, repo_root)
    candidate_root = Path(args.candidate_root)
    if not candidate_root.is_absolute():
        candidate_root = repo_root / candidate_root

    manifest_rows = []
    for item in plan:
        relative_posix = item["relativePath"]
        staged_source = item["stagedSource"]
        output_path = item["outputPath"]
        is_commander = relative_posix == COMMANDER_RELATIVE_PATH
        policy = COMMANDER_POLICY if is_commander else SHARED_POLICY

        if output_path != staged_source:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(staged_source, output_path)

        analyzed = analyze_row(item)

        row_payload = dict(item)
        row_payload.update(analyzed)
        manifest_rows.append(row_payload)

        sidecar_path = output_path.with_suffix(".provenance.json")
        write_sidecar(sidecar_path, row_payload, policy, staged_source, output_path)

    manifest = make_manifest(runtime_root, candidate_root, audit_path, manifest_rows)
    manifest_path = candidate_root / args.manifest_name
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"manifestPath": _canonical(manifest_path), "rows": manifest["rowCount"]}


def validate_manifest(plan: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    repo_root = Path(args.repo_root).expanduser().resolve()
    runtime_root = Path(args.runtime_root).expanduser()
    if not runtime_root.is_absolute():
        runtime_root = repo_root / runtime_root
    candidate_root = Path(args.candidate_root)
    if not candidate_root.is_absolute():
        candidate_root = repo_root / candidate_root

    manifest_path = candidate_root / args.manifest_name
    if not manifest_path.is_file():
        raise StageError(f"manifest is missing: {manifest_path}")

    manifest = read_json(manifest_path)
    if not isinstance(manifest, Mapping):
        raise StageError("manifest must be an object")

    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        raise StageError(f"manifest schemaVersion must be {SCHEMA_VERSION}")

    rows = manifest.get("rows")
    if not isinstance(rows, list):
        raise StageError("manifest rows must be an array")
    if len(rows) != TOTAL_EXPECTED_ROWS:
        raise StageError(f"manifest rowCount expected {TOTAL_EXPECTED_ROWS}, found {len(rows)}")

    expected_by_relative = {item["relativePath"]: item for item in plan}
    if len(expected_by_relative) != TOTAL_EXPECTED_ROWS:
        raise StageError("manifest validation planning mismatch")

    plan_rows_by_relative = set(expected_by_relative)
    manifest_rows_by_relative = {row.get("relativePath") for row in rows}
    if plan_rows_by_relative != manifest_rows_by_relative:
        missing = sorted(plan_rows_by_relative - manifest_rows_by_relative)
        extra = sorted(manifest_rows_by_relative - plan_rows_by_relative)
        parts = []
        if missing:
            parts.append(f"missing={', '.join(missing)}")
        if extra:
            parts.append(f"extra={', '.join(extra)}")
        raise StageError(f"manifest rows mismatch ({'; '.join(parts)})")

    for row in rows:
        if not isinstance(row, Mapping):
            raise StageError("manifest row must be an object")
        relative_posix = row.get("relativePath")
        if not isinstance(relative_posix, str):
            raise StageError("manifest row missing relativePath")
        planned = expected_by_relative.get(relative_posix)
        if planned is None:
            raise StageError(f"manifest contains unexpected row: {relative_posix}")

        category = planned["category"]
        is_commander = relative_posix == COMMANDER_RELATIVE_PATH
        policy = COMMANDER_POLICY if is_commander else SHARED_POLICY

        if row.get("category") != category:
            raise StageError(f"manifest category mismatch for {relative_posix}")
        if row.get("runtimeSource") != _canonical(planned["runtimeSource"]):
            raise StageError(f"manifest runtimeSource mismatch for {relative_posix}")
        if row.get("stagedSource") != _canonical(planned["stagedSource"]):
            raise StageError(f"manifest stagedSource mismatch for {relative_posix}")
        if row.get("outputPath") != _canonical(planned["outputPath"]):
            raise StageError(f"manifest outputPath mismatch for {relative_posix}")
        if row.get("runtimeEligible") is not False:
            raise StageError(f"manifest runtimeEligible must be false for {relative_posix}")

        sidecar_path = Path(row.get("outputPath")).with_suffix(".provenance.json")
        validate_sidecar(sidecar_path, {
            "stagedSource": Path(row.get("stagedSource")),
            "runtimeSource": Path(row.get("runtimeSource")),
            "outputPath": Path(row.get("outputPath")),
            "runtimeSourceSha256": row.get("runtimeSourceSha256"),
            "outputSha256": row.get("outputSha256"),
        }, policy)

        analyzed = analyze_row({
            "stagedSource": Path(row["stagedSource"]),
            "runtimeSource": Path(row["runtimeSource"]),
            "outputPath": Path(row["outputPath"]),
        })

        if row.get("sourceSha256") != analyzed["sourceSha256"]:
            raise StageError(f"manifest sourceSha256 mismatch for {relative_posix}")
        if row.get("runtimeSourceSha256") != analyzed["runtimeSourceSha256"]:
            raise StageError(
                f"runtime GLB changed since staging for {relative_posix}; restage the pack"
            )
        if row.get("outputSha256") != analyzed["outputSha256"]:
            raise StageError(f"manifest outputSha256 mismatch for {relative_posix}")
        if row.get("materialCount") != analyzed["materialCount"]:
            raise StageError(f"manifest materialCount mismatch for {relative_posix}")
        if row.get("textureCount") != analyzed["textureCount"]:
            raise StageError(f"manifest textureCount mismatch for {relative_posix}")
        if row.get("animationCount") != analyzed["animationCount"]:
            raise StageError(f"manifest animationCount mismatch for {relative_posix}")

    counts = Counter(item["category"] for item in rows)
    for category, expected_count in EXPECTED_CATEGORY_COUNTS.items():
        if counts.get(category) != expected_count:
            raise StageError(
                f"manifest category count mismatch for {category}: expected {expected_count}, found {counts.get(category, 0)}"
            )

    return {
        "manifestPath": _canonical(manifest_path),
        "rowCount": len(rows),
        "categories": {key: counts[key] for key in sorted(counts)},
    }


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    args.runtime_root = Path(args.runtime_root) if args.runtime_root else RUNTIME_ROOT_SUFFIX
    try:
        plan = build_plan(args)
        if args.check:
            result = validate_manifest(plan, args)
            print(json.dumps(result, sort_keys=True))
        else:
            result = run_stage(plan, args)
            print(json.dumps(result, sort_keys=True))
    except StageError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
