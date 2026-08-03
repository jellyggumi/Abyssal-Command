#!/usr/bin/env python3
"""Policy-free frozen quaternion measurement primitives for the motion bench."""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path
from typing import Any, Iterable, Sequence

DEGREES = 180.0 / math.pi
EPSILON = 1e-12


class KinematicGateError(ValueError):
    """A fail-closed, machine-readable gate error."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(f"{code}: {message}")


def _unit(quaternion: Sequence[float]) -> tuple[float, float, float, float]:
    if len(quaternion) != 4:
        raise KinematicGateError("KG_QUATERNION", "a quaternion must have four components")
    values = tuple(float(component) for component in quaternion)
    magnitude = math.sqrt(sum(component * component for component in values))
    if not math.isfinite(magnitude) or magnitude <= EPSILON:
        raise KinematicGateError("KG_QUATERNION", "a quaternion must be finite and non-zero")
    return tuple(component / magnitude for component in values)  # type: ignore[return-value]


def angular_distance_degrees(left: Sequence[float], right: Sequence[float]) -> float:
    """Return d(q1,q2)=2*acos(clamp(abs(dot(q1,q2)),0,1)) in degrees."""
    q_left, q_right = _unit(left), _unit(right)
    dot = abs(sum(a * b for a, b in zip(q_left, q_right)))
    return 0.0 if dot >= 1.0 - 1e-12 else 2.0 * math.acos(max(0.0, min(1.0, dot))) * DEGREES


def measure_quaternion_track(quaternions: Iterable[Sequence[float]]) -> dict[str, float | int]:
    """Measure angular-medoid peak and adjacent-sample step; ties choose earliest."""
    frames = [_unit(frame) for frame in quaternions]
    if not frames:
        raise KinematicGateError("KG_EMPTY_TRACK", "at least one quaternion sample is required")
    totals = [sum(angular_distance_degrees(frame, other) for other in frames) for frame in frames]
    medoid_index = min(range(len(frames)), key=lambda index: (totals[index], index))
    reference = frames[medoid_index]
    peak = max(angular_distance_degrees(frame, reference) for frame in frames)
    step = max((angular_distance_degrees(frames[index - 1], frames[index]) for index in range(1, len(frames))), default=0.0)
    return {"peakDeg": peak, "stepDeg": step, "medoidIndex": medoid_index}


def validate_bounds_json(bounds: dict[str, Any]) -> dict[str, Any]:
    """Reject incomplete stage-B bounds before a gate can select from them."""
    required = ("schemaVersion", "sampleFps", "referencePoseMethod", "boundsFullCohort", "boundsByExcludedSource")
    missing = [key for key in required if key not in bounds]
    if missing:
        raise KinematicGateError("KG_BOUNDS_SCHEMA", f"missing required bounds fields: {', '.join(missing)}")
    if bounds["sampleFps"] != 24 or bounds["referencePoseMethod"] != "angular-medoid-v1":
        raise KinematicGateError("KG_BOUNDS_PROTOCOL", "bounds do not use frozen 24-Hz angular-medoid-v1 protocol")
    return bounds


def _validate_provenance(provenance: dict[str, Any]) -> dict[str, Any]:
    required = ("assetId", "clipName", "action", "actionClass", "encoding", "sourceGroup")
    missing = [key for key in required if key not in provenance]
    if missing:
        raise KinematicGateError("KG_PROVENANCE", f"missing provenance fields: {', '.join(missing)}")
    if provenance["encoding"] not in {"local-rest-relative-quaternion-deltas", "absolute-local-rotation"}:
        raise KinematicGateError("KG_ENCODING", f"unsupported encoding: {provenance['encoding']!r}")
    source_group = provenance["sourceGroup"]
    if not isinstance(source_group, dict):
        raise KinematicGateError("KG_UNKNOWN_SOURCE", "sourceGroup must be an object")
    if "repoRelativePath" not in source_group and "generator" not in source_group:
        raise KinematicGateError("KG_UNKNOWN_SOURCE", "sourceGroup needs a bench path or authored generator")
    return provenance


def build_clip_provenance_overlay(clip: dict[str, Any], asset_id: str = "unarmed-core") -> dict[str, Any]:
    return _validate_provenance({"assetId": asset_id, **clip})


def build_clip_provenance_character(clip: dict[str, Any], asset_id: str) -> dict[str, Any]:
    return _validate_provenance({"assetId": asset_id, **clip})


_GLB_MAGIC = 0x46546C67
_JSON_CHUNK = 0x4E4F534A
_BIN_CHUNK = 0x004E4942
_TYPE_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
_COMPONENT_FORMATS = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}


def read_glb(path: str | Path) -> dict[str, Any]:
    """Parse a single-buffer GLB strictly enough for the frozen motion metric."""
    raw = Path(path).read_bytes()
    if len(raw) < 20 or struct.unpack_from("<I", raw, 0)[0] != _GLB_MAGIC:
        raise KinematicGateError("KG_GLB", f"{path} is not a GLB")
    total_length = struct.unpack_from("<I", raw, 8)[0]
    if total_length != len(raw):
        raise KinematicGateError("KG_GLB", f"{path} has an invalid total length")
    offset, document, binary = 12, None, None
    while offset < total_length:
        if offset + 8 > total_length:
            raise KinematicGateError("KG_GLB", f"{path} has a truncated chunk header")
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        end = offset + 8 + length
        if end > total_length:
            raise KinematicGateError("KG_GLB", f"{path} has a truncated chunk")
        chunk = raw[offset + 8:end]
        if chunk_type == _JSON_CHUNK:
            if document is not None:
                raise KinematicGateError("KG_GLB", f"{path} contains multiple JSON chunks")
            try:
                document = json.loads(chunk.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise KinematicGateError("KG_GLB", f"{path} has invalid JSON: {error}") from error
        elif chunk_type == _BIN_CHUNK:
            if binary is not None:
                raise KinematicGateError("KG_GLB", f"{path} contains multiple BIN chunks")
            binary = chunk
        offset = end
    if offset != total_length or document is None or binary is None:
        raise KinematicGateError("KG_GLB", f"{path} requires exactly one JSON and BIN chunk")
    return {"json": document, "bin": binary}


def read_accessor(glb: dict[str, Any], index: int) -> list[list[float]]:
    """Read an interleaved GLB accessor; sparse/data-URI accessors fail closed."""
    try:
        accessor = glb["json"]["accessors"][index]
        view = glb["json"]["bufferViews"][accessor["bufferView"]]
        component_format, component_size = _COMPONENT_FORMATS[accessor["componentType"]]
        width = _TYPE_COUNTS[accessor["type"]]
    except (IndexError, KeyError, TypeError) as error:
        raise KinematicGateError("KG_GLB_ACCESSOR", f"unsupported accessor {index}") from error
    if accessor.get("sparse"):
        raise KinematicGateError("KG_GLB_ACCESSOR", f"unsupported sparse accessor {index}")
    base = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    stride = int(view.get("byteStride", component_size * width))
    count = int(accessor["count"])
    if stride < component_size * width or base < 0 or base + max(0, count - 1) * stride + component_size * width > len(glb["bin"]):
        raise KinematicGateError("KG_GLB_ACCESSOR", f"out-of-range accessor {index}")
    return [
        [float(struct.unpack_from("<" + component_format, glb["bin"], base + row * stride + column * component_size)[0]) for column in range(width)]
        for row in range(count)
    ]


def _sample_quaternion(times: Sequence[float], values: Sequence[Sequence[float]], interpolation: str, moment: float) -> tuple[float, float, float, float]:
    if not times or len(times) != len(values) or any(len(value) != 4 for value in values):
        raise KinematicGateError("KG_GLB_ANIMATION", "rotation sampler has mismatched VEC4 samples")
    if interpolation == "CUBICSPLINE":
        raise KinematicGateError("KG_GLB_ANIMATION", "CUBICSPLINE rotation samplers are unsupported by frozen linear protocol")
    if moment <= times[0]:
        return _unit(values[0])
    if moment >= times[-1]:
        return _unit(values[-1])
    upper = next((index for index, value in enumerate(times) if value >= moment), None)
    if upper is None or upper == 0 or times[upper] <= times[upper - 1]:
        raise KinematicGateError("KG_GLB_ANIMATION", "rotation times must be strictly increasing")
    if interpolation == "STEP":
        return _unit(values[upper - 1])
    if interpolation != "LINEAR":
        raise KinematicGateError("KG_GLB_ANIMATION", f"unsupported rotation interpolation: {interpolation}")
    return _slerp(values[upper - 1], values[upper], (moment - times[upper - 1]) / (times[upper] - times[upper - 1]))


def _samples_at_24hz(times: Sequence[float]) -> list[float]:
    if not times or any(not math.isfinite(value) or (index and value <= times[index - 1]) for index, value in enumerate(times)):
        raise KinematicGateError("KG_GLB_ANIMATION", "rotation times must be finite and strictly increasing")
    output = [times[0]]
    frame = 1
    while times[0] + frame / 24.0 < times[-1] - 1e-9:
        output.append(times[0] + frame / 24.0)
        frame += 1
    if times[-1] > times[0]:
        output.append(times[-1])
    return output


def measure_glb(path: str | Path) -> list[dict[str, Any]]:
    """Measure real GLB rotation tracks at endpoint-preserving 24 Hz without bpy."""
    glb = read_glb(path)
    rows = []
    for animation in glb["json"].get("animations", []):
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            if target.get("path") != "rotation":
                continue
            try:
                sampler = animation["samplers"][channel["sampler"]]
                node = glb["json"]["nodes"][target["node"]]
                name = node["name"]
            except (IndexError, KeyError, TypeError) as error:
                raise KinematicGateError("KG_GLB_ANIMATION", f"invalid rotation channel in {animation.get('name', '<unnamed>')}") from error
            times = [row[0] for row in read_accessor(glb, sampler["input"])]
            values = read_accessor(glb, sampler["output"])
            quaternions = [_sample_quaternion(times, values, sampler.get("interpolation", "LINEAR"), moment) for moment in _samples_at_24hz(times)]
            rows.append({
                "clipName": animation.get("name", f"animation-{len(rows)}"), "bone": name, "sampleFps": 24,
                **measure_quaternion_track(quaternions),
            })
    if not rows:
        raise KinematicGateError("KG_GLB_ANIMATION", f"{path} has no rotation tracks")
    return rows


def _slerp(left: Sequence[float], right: Sequence[float], ratio: float) -> tuple[float, float, float, float]:
    a, b = _unit(left), _unit(right)
    dot = sum(x * y for x, y in zip(a, b))
    if dot < 0.0:
        b, dot = tuple(-value for value in b), -dot
    dot = max(-1.0, min(1.0, dot))
    if dot > 0.9995:
        return _unit(tuple((1.0 - ratio) * x + ratio * y for x, y in zip(a, b)))
    theta = math.acos(dot)
    divisor = math.sin(theta)
    return tuple((math.sin((1.0 - ratio) * theta) * x + math.sin(ratio * theta) * y) / divisor for x, y in zip(a, b))  # type: ignore[return-value]


def redistribute_step_shortest_arc(quaternions: Iterable[Sequence[float]], max_step_degrees: float) -> list[tuple[float, float, float, float]]:
    if max_step_degrees <= 0.0:
        raise KinematicGateError("KG_REDISPATCH_WINDOW", "max_step_degrees must be positive")
    source = list(quaternions)
    if not source:
        raise KinematicGateError("KG_EMPTY_TRACK", "at least one quaternion sample is required")
    output = [_unit(source[0])]
    for current in source[1:]:
        previous = output[-1]
        steps = max(1, math.ceil(angular_distance_degrees(previous, current) / max_step_degrees))
        output.extend(_slerp(previous, current, index / steps) for index in range(1, steps + 1))
    return output


def run_conformance_vectors(path: str | Path) -> list[dict[str, Any]]:
    payload = json.loads(Path(path).read_text())
    if payload.get("schemaVersion") != 1 or payload.get("protocol") != "angular-medoid-v1":
        raise KinematicGateError("KG_VECTOR_SCHEMA", "expected kinematic conformance vectors v1")
    tolerance = float(payload.get("angleToleranceDeg", 0.1))
    results = []
    for vector in payload.get("vectors", []):
        if not vector.get("id") or len(vector.get("times", [])) != len(vector.get("quaternions", [])):
            raise KinematicGateError("KG_VECTOR_SCHEMA", f"invalid vector: {vector.get('id', '<unnamed>')}")
        actual = measure_quaternion_track(vector["quaternions"])
        expected = vector["expected"]
        if actual["medoidIndex"] != expected["medoidIndex"] or any(abs(float(actual[key]) - float(expected[key])) > tolerance for key in ("peakDeg", "stepDeg")):
            raise KinematicGateError("KG_CONFORMANCE", f"{vector['id']} expected {expected}, got {actual}")
        results.append({"id": vector["id"], "actual": actual})
    ids = [result["id"] for result in results]
    if ids != ["V1", "V2", "V3", "V4", "V5"]:
        raise KinematicGateError("KG_VECTOR_SCHEMA", "Stage A requires exactly V1–V5")
    return results
