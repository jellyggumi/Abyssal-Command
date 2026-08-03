// Focused coverage for the Stage-A motion-repair kinematic gate and the
// world-pose alignment audit.
//
// Under test (untracked motion-repair implementation):
//   _workspace/current/engineering/asset-pipeline/motion-bench/lib/kinematic-gate.mjs
//   _workspace/current/engineering/asset-pipeline/tools/audit-kinematic-bounds.mjs
//   _workspace/current/engineering/asset-pipeline/tools/kinematic_gate.py
//   _workspace/current/engineering/asset-pipeline/tools/derive-kinematic-bounds-blender.py
//
// Synthetic GLB containers and the Blender stub harness live in an OS temp
// directory that is removed after the run.  The audit CLI is only exercised on
// refusal paths that abort before any output file is produced.
//
// The one exception is the pose-pair render probe at the end of this file: the
// renderer refuses any path outside the repository root, so its scratch
// residuals and output must live under `<repo>/tmp/` (gitignored).  That
// directory is created per-run and removed in `after()`.  Nothing is ever
// written into the approved evidence corpus under `_workspace/current/qa/`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, describe, test } from "node:test";

import {
  KinematicGateError,
  angularDistanceDegrees,
  buildClipProvenanceCharacter,
  buildClipProvenanceOverlay,
  measureGlb,
  measureQuaternionTrack,
  readAccessor,
  readGlb,
  redistributeStepShortestArc,
  runConformanceVectors,

  validateBoundsJson,
} from "../lib/kinematic-gate.mjs";
import { collectWorldPoseAlignment } from "../../tools/audit-kinematic-bounds.mjs";

const mutableFs = createRequire(import.meta.url)("node:fs");

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");

const PIPELINE = "_workspace/current/engineering/asset-pipeline";
const TOOLS_DIR = `${PIPELINE}/tools`;
const AUDIT_CLI = `${TOOLS_DIR}/audit-kinematic-bounds.mjs`;
const BLENDER_TOOL = `${TOOLS_DIR}/derive-kinematic-bounds-blender.py`;
const VECTORS_PATH = `${PIPELINE}/motion-bench/kinematic-conformance-vectors-v1.json`;
const TARGET_RIG = `${PIPELINE}/motion-bench/target-rig/dusk-warden-def-humanoid-v1.glb`;
const CERTIFICATION = `${PIPELINE}/motion-bench/target-rig/dusk-warden-def-humanoid-v1.provenance.json`;
const LIBRARY_CONFIG = `${PIPELINE}/character-motion-library/library-config.json`;
const RUNTIME_MANIFEST = "assets/motion/ingame/manifest.json";
const FULL_CORPUS_MANIFEST = `${PIPELINE}/motion-bench/full-corpus-v1.json`;

// The frozen protocol: 24-Hz endpoint-preserving resampling, angular-medoid-v1.
const SAMPLE_FPS = 24;
const POSE_ALIGNMENT_BONE_COUNT = 22;
const CONFORMANCE_VECTOR_IDS = ["V1", "V2", "V3", "V4", "V5"];

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const IDENTITY = [0, 0, 0, 1];
const QUARTER_TURN_Z = [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)];
const EIGHTH_TURN_Z = [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)];

function repositoryPath(relativePath) {
  return resolve(REPOSITORY_ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(repositoryPath(relativePath), "utf8"));
}

/** Assert a fail-closed gate error and return it for message inspection. */
function gateError(code, run) {
  let error;
  try {
    run();
  } catch (thrown) {
    error = thrown;
  }
  assert.ok(error, `expected ${code} to be thrown, but the call returned normally`);
  assert.ok(
    error instanceof KinematicGateError,
    `expected a KinematicGateError, got ${error?.stack ?? error}`,
  );
  assert.equal(
    error.code,
    code,
    `expected gate code ${code}, got ${error.code}: ${error.message}`,
  );
  assert.equal(error.name, "KinematicGateError");
  assert.ok(
    error.message.startsWith(`${code}: `),
    `gate message must be machine-readable, got ${error.message}`,
  );
  return error;
}

const scratchDir = mkdtempSync(join(tmpdir(), "kinematic-gate-"));
after(() => rmSync(scratchDir, { recursive: true, force: true }));

function scratchFile(name, contents) {
  const path = join(scratchDir, name);
  writeFileSync(path, contents);
  return path;
}

function float32(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

function pad4(buffer, fill) {
  return Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4, fill)]);
}

/**
 * Encode a single-buffer GLB.  `damage` deliberately corrupts the container so
 * the reader's fail-closed branches can be reached.
 */
function encodeGlb(json, bin, damage = {}) {
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json), "utf8"), 0x20);
  const binChunk = pad4(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(damage.magic ?? GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  const chunkHeader = (length, type) => {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(length, 0);
    buffer.writeUInt32LE(type, 4);
    return buffer;
  };
  const parts = [header, chunkHeader(damage.jsonLength ?? jsonChunk.length, JSON_CHUNK), jsonChunk];
  if (damage.duplicateJson) parts.push(chunkHeader(jsonChunk.length, JSON_CHUNK), jsonChunk);
  if (!damage.dropBin) parts.push(chunkHeader(binChunk.length, BIN_CHUNK), binChunk);
  const glb = Buffer.concat(parts);
  glb.writeUInt32LE(damage.totalLength ?? glb.length, 8);
  return glb;
}

/**
 * A two-keyframe rotation clip: `DEF-spine` sweeps from identity to `endQuaternion`
 * between t=0 s and t=1 s.  Only two source keys exist, so any measurement that
 * reports more than two samples proves 24-Hz resampling actually happened.
 */
function rotationClipDocument({ endQuaternion = EIGHTH_TURN_Z, times = [0, 1], interleave = false } = {}) {
  const timeBytes = float32(times);
  const rotationRows = [IDENTITY, endQuaternion];
  const rotationBytes = interleave
    ? Buffer.concat(rotationRows.map((row) => Buffer.concat([float32(row), Buffer.alloc(16, 0)])))
    : Buffer.concat(rotationRows.map((row) => float32(row)));
  const bin = Buffer.concat([timeBytes, rotationBytes]);
  const json = {
    asset: { version: "2.0" },
    nodes: [{ name: "DEF-spine" }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: timeBytes.length },
      {
        buffer: 0,
        byteOffset: timeBytes.length,
        byteLength: rotationBytes.length,
        ...(interleave ? { byteStride: 32 } : {}),
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: times.length, type: "SCALAR" },
      { bufferView: 1, componentType: 5126, count: rotationRows.length, type: "VEC4" },
    ],
    animations: [
      {
        name: "probe::sweep::v01",
        channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
        samplers: [{ input: 0, output: 1, interpolation: "LINEAR" }],
      },
    ],
  };
  return { json, bin };
}

function writeGlb(name, document, damage) {
  return scratchFile(name, encodeGlb(document.json, document.bin, damage));
}

async function withAuditReadFile(overrides, run) {
  const originalReadFileSync = mutableFs.readFileSync;
  mutableFs.readFileSync = (path, ...args) => overrides.get(resolve(String(path))) ?? originalReadFileSync(path, ...args);
  syncBuiltinESMExports();
  try {
    const moduleUrl = `${pathToFileURL(repositoryPath(AUDIT_CLI)).href}?fixture=${Date.now()}`;
    return await run(await import(moduleUrl));
  } finally {
    mutableFs.readFileSync = originalReadFileSync;
    syncBuiltinESMExports();
  }
}

// The full world-pose sweep reads 12 real GLBs; collect it once and share it.
let worldPoseCache;
function worldPoseAlignment() {
  worldPoseCache ??= collectWorldPoseAlignment(
    repositoryPath(TARGET_RIG),
    readJson(CERTIFICATION),
  );
  return worldPoseCache;
}

function detectPython3() {
  const probe = spawnSync("python3", ["-c", "print(1)"], { encoding: "utf8" });
  return probe.status === 0 ? "python3" : null;
}
const PYTHON3 = detectPython3();
const PYTHON_SKIP = PYTHON3 ? false : "python3 is unavailable on this host";

function runPython(source, args) {
  const harness = scratchFile(`harness-${createHash("sha256").update(source).digest("hex").slice(0, 12)}.py`, source);
  const result = spawnSync(PYTHON3, [harness, ...args], { encoding: "utf8", cwd: REPOSITORY_ROOT });
  assert.equal(result.status, 0, `python harness failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

describe("frozen angular metric rejects malformed quaternions and honours double cover", () => {
  test("distance is representation-invariant, magnitude-invariant, and folded to [0, 180]", () => {
    assert.equal(angularDistanceDegrees(IDENTITY, IDENTITY), 0);
    // q and -q are the same rotation; a naive dot product would report 360.
    assert.equal(angularDistanceDegrees(IDENTITY, [0, 0, 0, -1]), 0);
    // Unnormalised input must be normalised before measurement.
    assert.equal(angularDistanceDegrees([0, 0, 0, 5], [0, 0, 0, -3]), 0);
    assert.ok(Math.abs(angularDistanceDegrees(IDENTITY, QUARTER_TURN_Z) - 90) < 1e-9);
    assert.ok(Math.abs(angularDistanceDegrees(IDENTITY, EIGHTH_TURN_Z) - 45) < 1e-9);
    // A 200-degree rotation folds to its 160-degree shortest arc via abs(dot).
    const twoHundred = [0, 0, Math.sin(Math.PI * (100 / 180)), Math.cos(Math.PI * (100 / 180))];
    assert.ok(Math.abs(angularDistanceDegrees(IDENTITY, twoHundred) - 160) < 1e-9);

    for (const [left, right] of [
      [IDENTITY, QUARTER_TURN_Z],
      [QUARTER_TURN_Z, EIGHTH_TURN_Z],
    ]) {
      assert.equal(angularDistanceDegrees(left, right), angularDistanceDegrees(right, left));
      assert.ok(angularDistanceDegrees(left, right) >= 0);
      assert.ok(angularDistanceDegrees(left, right) <= 180 + 1e-9);
    }
  });

  test("degenerate quaternion shapes and magnitudes fail closed", () => {
    gateError("KG_QUATERNION", () => angularDistanceDegrees([0, 0, 1], IDENTITY));
    gateError("KG_QUATERNION", () => angularDistanceDegrees([0, 0, 0, 1, 0], IDENTITY));
    gateError("KG_QUATERNION", () => angularDistanceDegrees("0,0,0,1", IDENTITY));
    gateError("KG_QUATERNION", () => angularDistanceDegrees([0, 0, 0, 0], IDENTITY));
    gateError("KG_QUATERNION", () => angularDistanceDegrees([0, 0, 0, Number.NaN], IDENTITY));
    gateError("KG_QUATERNION", () => angularDistanceDegrees([0, 0, 0, Number.POSITIVE_INFINITY], IDENTITY));
    gateError("KG_QUATERNION", () => measureQuaternionTrack([IDENTITY, [1, 2, 3]]));
  });

  test("track measurement separates medoid peak from adjacent step and breaks ties earliest", () => {
    gateError("KG_EMPTY_TRACK", () => measureQuaternionTrack([]));

    const single = measureQuaternionTrack([QUARTER_TURN_Z]);
    assert.deepEqual(single, { peakDeg: 0, stepDeg: 0, medoidIndex: 0 });

    // Symmetric sweep: the middle frame is the angular medoid.
    const sweep = measureQuaternionTrack([
      [0, 0, -Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)],
      IDENTITY,
      QUARTER_TURN_Z,
    ]);
    assert.equal(sweep.medoidIndex, 1);
    assert.ok(Math.abs(sweep.peakDeg - 90) < 1e-9);
    assert.ok(Math.abs(sweep.stepDeg - 90) < 1e-9);

    // Two frames have identical medoid totals; the earliest index wins.
    const tie = measureQuaternionTrack([IDENTITY, QUARTER_TURN_Z]);
    assert.equal(tie.medoidIndex, 0);

    // Peak is a excursion metric, step is an adjacency metric: a fine sweep has
    // a large peak and a tiny step, which is exactly what the gate must separate.
    const fine = measureQuaternionTrack(
      Array.from({ length: 181 }, (_, index) => {
        const half = (Math.PI * index) / 360;
        return [0, 0, Math.sin(half), Math.cos(half)];
      }),
    );
    assert.equal(fine.medoidIndex, 90);
    assert.ok(Math.abs(fine.peakDeg - 90) < 1e-6, `peak ${fine.peakDeg}`);
    assert.ok(Math.abs(fine.stepDeg - 1) < 1e-6, `step ${fine.stepDeg}`);
  });
});

describe("quaternion conformance vectors pin the frozen protocol", () => {
  test("the shipped V1-V5 vector file passes and is reproduced independently", () => {
    const payload = readJson(VECTORS_PATH);
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.protocol, "angular-medoid-v1");
    const tolerance = Number(payload.angleToleranceDeg ?? 0.1);
    assert.ok(tolerance > 0 && tolerance <= 0.1, `tolerance ${tolerance} must stay tight`);

    const results = runConformanceVectors(repositoryPath(VECTORS_PATH));
    assert.deepEqual(results.map((result) => result.id), CONFORMANCE_VECTOR_IDS);

    // Re-derive every expectation instead of trusting the harness's own compare.
    for (const vector of payload.vectors) {
      assert.equal(vector.times.length, vector.quaternions.length);
      const actual = measureQuaternionTrack(vector.quaternions);
      assert.equal(actual.medoidIndex, vector.expected.medoidIndex, `${vector.id} medoid`);
      assert.ok(Math.abs(actual.peakDeg - vector.expected.peakDeg) <= tolerance, `${vector.id} peak`);
      assert.ok(Math.abs(actual.stepDeg - vector.expected.stepDeg) <= tolerance, `${vector.id} step`);
    }
  });

  test("tampered vectors, protocols, and rosters are refused", () => {
    const payload = readJson(VECTORS_PATH);

    gateError("KG_VECTOR_SCHEMA", () => runConformanceVectors({ ...payload, schemaVersion: 2 }));
    gateError("KG_VECTOR_SCHEMA", () => runConformanceVectors({ ...payload, protocol: "angular-mean-v1" }));
    gateError("KG_VECTOR_SCHEMA", () => runConformanceVectors({}));

    // The roster is order-sensitive and exact: no subset, superset, or shuffle.
    gateError("KG_VECTOR_SCHEMA", () =>
      runConformanceVectors({ ...payload, vectors: payload.vectors.slice(0, 4) }));
    gateError("KG_VECTOR_SCHEMA", () =>
      runConformanceVectors({ ...payload, vectors: [...payload.vectors].reverse() }));
    gateError("KG_VECTOR_SCHEMA", () =>
      runConformanceVectors({
        ...payload,
        vectors: payload.vectors.map((vector) =>
          vector.id === "V2" ? { ...vector, times: vector.times.slice(1) } : vector),
      }));

    // A drifted implementation shows up as a numeric conformance failure.
    const drifted = gateError("KG_CONFORMANCE", () =>
      runConformanceVectors({
        ...payload,
        vectors: payload.vectors.map((vector) =>
          vector.id === "V5"
            ? { ...vector, expected: { ...vector.expected, peakDeg: vector.expected.peakDeg + 5 } }
            : vector),
      }));
    assert.match(drifted.message, /V5 expected/);
  });
});

describe("bounds and clip provenance validation", () => {
  const BOUNDS = Object.freeze({
    schemaVersion: 1,
    sampleFps: SAMPLE_FPS,
    referencePoseMethod: "angular-medoid-v1",
    boundsFullCohort: {},
    boundsByExcludedSource: {},
  });

  test("bounds must be complete and pinned to the 24-Hz angular-medoid-v1 protocol", () => {
    assert.equal(validateBoundsJson({ ...BOUNDS }).sampleFps, SAMPLE_FPS);

    const missing = gateError("KG_BOUNDS_SCHEMA", () =>
      validateBoundsJson({ schemaVersion: 1, sampleFps: SAMPLE_FPS }));
    assert.match(missing.message, /referencePoseMethod/);
    assert.match(missing.message, /boundsFullCohort/);
    assert.match(missing.message, /boundsByExcludedSource/);

    gateError("KG_BOUNDS_PROTOCOL", () => validateBoundsJson({ ...BOUNDS, sampleFps: 30 }));
    gateError("KG_BOUNDS_PROTOCOL", () => validateBoundsJson({ ...BOUNDS, sampleFps: "24" }));
    gateError("KG_BOUNDS_PROTOCOL", () =>
      validateBoundsJson({ ...BOUNDS, referencePoseMethod: "angular-mean-v1" }));
  });

  const CLIP = Object.freeze({
    clipName: "unarmed-core::attack::v01",
    action: "attack",
    actionClass: "attack",
    encoding: "local-rest-relative-quaternion-deltas",
    sourceGroup: { repoRelativePath: "assets/motion/bench/attack.fbx", sha256: "0".repeat(64) },
  });

  test("well-formed provenance is accepted for both overlay and character clips", () => {
    assert.equal(buildClipProvenanceOverlay({ ...CLIP }).assetId, "unarmed-core");
    // An explicit clip assetId overrides the overlay default.
    assert.equal(buildClipProvenanceOverlay({ ...CLIP, assetId: "guard" }).assetId, "guard");
    assert.equal(buildClipProvenanceCharacter({ ...CLIP }, "guard").assetId, "guard");
    // Both frozen encodings are allowed.
    assert.equal(
      buildClipProvenanceOverlay({ ...CLIP, encoding: "absolute-local-rotation" }).encoding,
      "absolute-local-rotation",
    );
    // An authored fallback cites a generator instead of a bench take.
    assert.deepEqual(
      buildClipProvenanceOverlay({ ...CLIP, sourceGroup: { generator: "authored-rig-fallback" } }).sourceGroup,
      { generator: "authored-rig-fallback" },
    );
  });

  test("malformed provenance is refused with a field-specific code", () => {
    const incomplete = gateError("KG_PROVENANCE", () =>
      buildClipProvenanceOverlay({ clipName: "unarmed-core::attack::v01" }));
    assert.equal(
      incomplete.message,
      "KG_PROVENANCE: missing provenance fields: action, actionClass, encoding, sourceGroup",
    );

    for (const field of ["clipName", "action", "actionClass", "encoding", "sourceGroup"]) {
      const clip = { ...CLIP };
      delete clip[field];
      const error = gateError("KG_PROVENANCE", () => buildClipProvenanceCharacter(clip, "guard"));
      assert.match(error.message, new RegExp(field));
    }

    gateError("KG_ENCODING", () => buildClipProvenanceOverlay({ ...CLIP, encoding: "euler-xyz" }));
    gateError("KG_ENCODING", () => buildClipProvenanceOverlay({ ...CLIP, encoding: "" }));
    gateError("KG_ENCODING", () =>
      buildClipProvenanceOverlay({ ...CLIP, encoding: "LOCAL-REST-RELATIVE-QUATERNION-DELTAS" }));

    // An unattributable source group is the whole point of the gate.
    for (const sourceGroup of [null, {}, "assets/motion/bench/attack.fbx", ["attack.fbx"], { sha256: "x" }]) {
      gateError("KG_UNKNOWN_SOURCE", () => buildClipProvenanceOverlay({ ...CLIP, sourceGroup }));
    }
  });
});

describe("shortest-arc step redistribution", () => {
  test("subdivision caps adjacent step while preserving endpoints and direction", () => {
    const arc = [IDENTITY, QUARTER_TURN_Z];
    const dense = redistributeStepShortestArc(arc, 5);

    assert.equal(dense.length, 19, "90 degrees at a 5-degree window needs 18 sub-steps");
    assert.equal(angularDistanceDegrees(dense[0], arc[0]), 0);
    assert.ok(angularDistanceDegrees(dense.at(-1), arc[1]) < 1e-9);
    assert.ok(measureQuaternionTrack(dense).stepDeg <= 5 + 1e-9);

    // Every emitted sample is a unit quaternion advancing monotonically along
    // the shortest arc, never a straight-line lerp that shrinks the norm.
    let previous = -1;
    for (const sample of dense) {
      assert.ok(Math.abs(Math.hypot(...sample) - 1) < 1e-9);
      const travelled = angularDistanceDegrees(arc[0], sample);
      assert.ok(travelled > previous - 1e-9, "samples must advance along the arc");
      previous = travelled;
    }

    // A window wider than the arc leaves the track untouched.
    assert.equal(redistributeStepShortestArc(arc, 180).length, 2);
    // Multi-segment tracks subdivide each segment independently.
    const folded = redistributeStepShortestArc([IDENTITY, QUARTER_TURN_Z, IDENTITY], 30);
    assert.equal(folded.length, 7);
    assert.ok(measureQuaternionTrack(folded).stepDeg <= 30 + 1e-9);
    assert.ok(angularDistanceDegrees(folded.at(-1), IDENTITY) < 1e-9);
  });

  test("a non-positive window or an empty track fails closed", () => {
    gateError("KG_REDISPATCH_WINDOW", () => redistributeStepShortestArc([IDENTITY], 0));
    gateError("KG_REDISPATCH_WINDOW", () => redistributeStepShortestArc([IDENTITY], -5));
    gateError("KG_REDISPATCH_WINDOW", () => redistributeStepShortestArc([IDENTITY], Number.NaN));
    gateError("KG_EMPTY_TRACK", () => redistributeStepShortestArc([], 5));
  });
});

describe("GLB container parsing and 24-Hz resampling", () => {
  test("a two-keyframe clip is resampled at 24 Hz with preserved endpoints", () => {
    const path = writeGlb("sweep.glb", rotationClipDocument());
    const rows = measureGlb(path);

    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(row.clipName, "probe::sweep::v01");
    assert.equal(row.bone, "DEF-spine");
    assert.equal(row.sampleFps, SAMPLE_FPS);
    // 45 degrees over one second: the source holds two keys, but the frozen
    // protocol measures 25 samples, so the adjacent step must be 45/24.
    assert.ok(Math.abs(row.peakDeg - 22.5) < 1e-6, `peak ${row.peakDeg}`);
    assert.ok(Math.abs(row.stepDeg - 45 / SAMPLE_FPS) < 1e-6, `step ${row.stepDeg}`);
    assert.equal(row.medoidIndex, 12, "the medoid of a symmetric 25-sample sweep is the centre");

    // Halving the duration halves the sample count and doubles the step.
    const brisk = measureGlb(writeGlb("brisk.glb", rotationClipDocument({ times: [0, 0.5] })));
    assert.ok(Math.abs(brisk[0].stepDeg - 90 / SAMPLE_FPS) < 1e-6, `step ${brisk[0].stepDeg}`);
    assert.equal(brisk[0].medoidIndex, 6);
  });

  test("STEP samplers hold the lower key instead of interpolating", () => {
    const document = rotationClipDocument();
    document.json.animations[0].samplers[0].interpolation = "STEP";
    const [row] = measureGlb(writeGlb("stepped.glb", document));
    assert.ok(Math.abs(row.peakDeg - 45) < 1e-6);
    assert.ok(Math.abs(row.stepDeg - 45) < 1e-6, "a held pose jumps once, at the final sample");
    assert.equal(row.medoidIndex, 0);
  });

  test("interleaved accessors are read by byteStride, not by assumed packing", () => {
    const packed = measureGlb(writeGlb("packed.glb", rotationClipDocument()));
    const interleaved = measureGlb(writeGlb("interleaved.glb", rotationClipDocument({ interleave: true })));
    assert.deepEqual(interleaved, packed.map((row) => ({ ...row })));

    const glb = readGlb(writeGlb("accessor.glb", rotationClipDocument({ interleave: true })));
    const rotations = readAccessor(glb, 1);
    assert.equal(rotations.length, 2);
    rotations[1].forEach((value, index) => assert.ok(Math.abs(value - EIGHTH_TURN_Z[index]) < 1e-6));
  });

  test("corrupt containers are refused before any measurement", () => {
    const document = rotationClipDocument();
    gateError("KG_GLB", () => readGlb(writeGlb("magic.glb", document, { magic: 0x11111111 })));
    gateError("KG_GLB", () => readGlb(writeGlb("length.glb", document, { totalLength: 4 })));
    gateError("KG_GLB", () => readGlb(writeGlb("truncated.glb", document, { jsonLength: 1 << 20 })));
    gateError("KG_GLB", () => readGlb(scratchFile("stub.glb", Buffer.alloc(8))));
    gateError("KG_GLB", () => readGlb(repositoryPath("package.json")));

    const duplicate = gateError("KG_GLB", () =>
      readGlb(writeGlb("duplicate.glb", document, { duplicateJson: true })));
    assert.match(duplicate.message, /multiple JSON chunks/);

    const noBin = gateError("KG_GLB", () => readGlb(writeGlb("nobin.glb", document, { dropBin: true })));
    assert.match(noBin.message, /exactly one JSON and BIN chunk/);

    const badJson = rotationClipDocument();
    const brokenJson = Buffer.from("{ not json ", "utf8");
    const glb = encodeGlb({}, badJson.bin);
    brokenJson.copy(glb, 20, 0, Math.min(brokenJson.length, glb.length - 20));
    gateError("KG_GLB", () => readGlb(scratchFile("badjson.glb", glb)));
  });

  test("the audit rejects a target rig with a duplicate JSON chunk", async () => {
    const targetPath = repositoryPath(TARGET_RIG);
    const original = readFileSync(targetPath);
    const jsonChunkLength = original.readUInt32LE(12);
    const duplicateJsonChunk = original.subarray(12, 20 + jsonChunkLength);
    const malformed = Buffer.concat([original, duplicateJsonChunk]);
    malformed.writeUInt32LE(malformed.length, 8);

    await assert.rejects(
      withAuditReadFile(
        new Map([[targetPath, malformed]]),
        ({ collectWorldPoseAlignment: collect }) => collect(targetPath, readJson(CERTIFICATION)),
      ),
      { code: "KG_GLB" },
    );
  });

  test("accessor and animation shapes outside the frozen protocol are refused", () => {
    const outOfRange = rotationClipDocument();
    outOfRange.json.accessors[1].count = 64;
    gateError("KG_GLB_ACCESSOR", () => measureGlb(writeGlb("range.glb", outOfRange)));

    const sparse = rotationClipDocument();
    sparse.json.accessors[1].sparse = { count: 1 };
    gateError("KG_GLB_ACCESSOR", () => measureGlb(writeGlb("sparse.glb", sparse)));

    const narrowStride = rotationClipDocument();
    narrowStride.json.bufferViews[1].byteStride = 8;
    gateError("KG_GLB_ACCESSOR", () => measureGlb(writeGlb("stride.glb", narrowStride)));

    const badComponent = rotationClipDocument();
    badComponent.json.accessors[1].componentType = 5130;
    gateError("KG_GLB_ACCESSOR", () => measureGlb(writeGlb("component.glb", badComponent)));

    const cubic = rotationClipDocument();
    cubic.json.animations[0].samplers[0].interpolation = "CUBICSPLINE";
    const cubicError = gateError("KG_GLB_ANIMATION", () => measureGlb(writeGlb("cubic.glb", cubic)));
    assert.match(cubicError.message, /frozen linear protocol/);

    const unknownInterpolation = rotationClipDocument();
    unknownInterpolation.json.animations[0].samplers[0].interpolation = "QUADRATIC";
    gateError("KG_GLB_ANIMATION", () => measureGlb(writeGlb("interp.glb", unknownInterpolation)));

    // Rotation output must be VEC4; a VEC3 sampler is a Euler leak.
    const vec3 = rotationClipDocument();
    vec3.json.accessors[1].type = "VEC3";
    const vec3Error = gateError("KG_GLB_ANIMATION", () => measureGlb(writeGlb("vec3.glb", vec3)));
    assert.match(vec3Error.message, /VEC4 quaternions/);

    const unsorted = rotationClipDocument({ times: [1, 0] });
    gateError("KG_GLB_ANIMATION", () => measureGlb(writeGlb("unsorted.glb", unsorted)));

    const mismatched = rotationClipDocument();
    mismatched.json.accessors[0].count = 1;
    gateError("KG_GLB_ANIMATION", () => measureGlb(writeGlb("mismatch.glb", mismatched)));

    // A rotation channel must resolve to a named bone node.
    const unnamed = rotationClipDocument();
    delete unnamed.json.nodes[0].name;
    gateError("KG_GLB_ANIMATION", () => measureGlb(writeGlb("unnamed.glb", unnamed)));

    const translationOnly = rotationClipDocument();
    translationOnly.json.animations[0].channels[0].target.path = "translation";
    const empty = gateError("KG_GLB_ANIMATION", () => measureGlb(writeGlb("translation.glb", translationOnly)));
    assert.match(empty.message, /no rotation tracks/);
  });

  test("the shipped target rig and overlay pack parse as single-buffer GLBs", () => {
    for (const path of [TARGET_RIG, "assets/motion/ingame/unarmed-core.glb"]) {
      const glb = readGlb(repositoryPath(path));
      assert.equal(glb.json.asset.version, "2.0");
      assert.ok(glb.bin.length > 0);
      assert.ok(Array.isArray(glb.json.nodes) && glb.json.nodes.length > 0);
    }
  });
});

describe("target-rig certification evidence", () => {
  test("certification pins the exact rig bytes and a conformant 22-bone rest pose", () => {
    const certification = readJson(CERTIFICATION);
    const rigBytes = readFileSync(repositoryPath(TARGET_RIG));

    // These two fields are the audit's KG_TARGET_RIG_HASH gate.
    assert.equal(createHash("sha256").update(rigBytes).digest("hex"), certification.targetRigSha256);
    assert.equal(statSync(repositoryPath(TARGET_RIG)).size, certification.targetRigBytes);

    assert.equal(certification.poseAlignmentBones.length, POSE_ALIGNMENT_BONE_COUNT);
    assert.equal(new Set(certification.poseAlignmentBones).size, POSE_ALIGNMENT_BONE_COUNT);

    const declared = new Set(certification.targetBoneNames);
    for (const bone of certification.poseAlignmentBones) {
      assert.ok(declared.has(bone), `pose bone ${bone} is not a declared target bone`);
    }
    // Deliberately excluded pelvis helpers must never enter the pose cohort.
    for (const bone of certification.excludedStaticBones) {
      assert.ok(declared.has(bone));
      assert.ok(!certification.poseAlignmentBones.includes(bone), `${bone} must stay excluded`);
    }

    // Every frozen rest rotation is a conformant unit quaternion.
    const rotations = Object.entries(certification.restQuaternions);
    assert.equal(rotations.length, certification.targetBoneNames.length);
    for (const [bone, quaternion] of rotations) {
      assert.ok(declared.has(bone), `${bone} has a rest rotation but is not a declared bone`);
      assert.equal(quaternion.length, 4, `${bone} rest rotation must be VEC4`);
      assert.ok(quaternion.every(Number.isFinite), `${bone} rest rotation must be finite`);
      assert.ok(Math.abs(Math.hypot(...quaternion) - 1) < 1e-6, `${bone} rest rotation must be unit`);
      assert.equal(angularDistanceDegrees(quaternion, quaternion), 0);
    }

    // Bone identity must agree with the shipped retarget manifest.
    assert.deepEqual(
      [...certification.targetBoneNames].sort(),
      [...readJson(RUNTIME_MANIFEST).targetBoneNames].sort(),
    );

    // Recovery lineage the CLI refuses to run without.
    for (const field of ["originCommit", "deletedBy", "originPath", "recoveryCommand"]) {
      assert.ok(certification[field], `certification must record ${field}`);
    }
  });

  test("a certification cannot swap a required limb for an excluded pelvis", () => {
    const certification = readJson(CERTIFICATION);
    const swapped = certification.poseAlignmentBones.map((bone) =>
      bone === "DEF-hand.L" ? "DEF-pelvis.L" : bone);
    assert.equal(swapped.length, POSE_ALIGNMENT_BONE_COUNT);
    assert.equal(new Set(swapped).size, POSE_ALIGNMENT_BONE_COUNT);
    assert.ok(certification.excludedStaticBones.includes("DEF-pelvis.L"));

    gateError("KG_TARGET_RIG_PROVENANCE", () =>
      collectWorldPoseAlignment(repositoryPath(TARGET_RIG), {
        ...certification,
        poseAlignmentBones: swapped,
      }));
  });
});

describe("world-pose alignment audit over the real cohort", () => {
  test("every configured actor is measured on every certified bone", () => {
    const certification = readJson(CERTIFICATION);
    const { config, rows, residualRows } = worldPoseAlignment();
    const actorIds = config.characters.map((character) => character.assetId);
    assert.ok(actorIds.length > 0);

    const clipNames = [...new Set(rows.map((row) => row.clipName))];
    assert.equal(residualRows.length, actorIds.length * POSE_ALIGNMENT_BONE_COUNT);
    assert.equal(rows.length, actorIds.length * POSE_ALIGNMENT_BONE_COUNT * clipNames.length * 2);
    assert.deepEqual([...new Set(rows.map((row) => row.frameSample))].sort(), ["first", "midpoint"]);

    const seen = new Set();
    for (const row of residualRows) {
      assert.ok(actorIds.includes(row.actorId));
      assert.ok(certification.poseAlignmentBones.includes(row.bone));
      const key = `${row.actorId}|${row.bone}`;
      assert.ok(!seen.has(key), `duplicate residual row for ${key}`);
      seen.add(key);
      assert.equal(row.orientationSpace, "world");
      assert.equal(row.localOrientationSpace, "local");
      for (const metric of ["restResidualDeg", "localRestResidualDeg"]) {
        assert.ok(Number.isFinite(row[metric]), `${key} ${metric} must be finite`);
        assert.ok(row[metric] >= 0 && row[metric] <= 180 + 1e-9, `${key} ${metric} out of range`);
      }
    }
    assert.equal(seen.size, actorIds.length * POSE_ALIGNMENT_BONE_COUNT);

    for (const row of rows) {
      assert.equal(row.orientationSpace, "world");
      assert.ok(Number.isFinite(row.frameTime) && row.frameTime >= 0);
      assert.ok(
        Number.isFinite(row.worldPoseResidualDeg)
          && row.worldPoseResidualDeg >= 0
          && row.worldPoseResidualDeg <= 180 + 1e-9,
        `${row.actorId}/${row.clipName}/${row.bone} residual out of range`,
      );
    }
  });

  test("world and local rest residuals are distinct metrics, not one value copied twice", () => {
    const { residualRows } = worldPoseAlignment();
    const divergent = residualRows.filter(
      (row) => Math.abs(row.restResidualDeg - row.localRestResidualDeg) > 1e-9,
    );
    // A world residual accumulates the parent chain; a local residual does not.
    // If the audit ever collapsed the two, this ratio would drop to zero.
    assert.ok(
      divergent.length > residualRows.length / 2,
      `world/local residuals diverge on only ${divergent.length}/${residualRows.length} rows`,
    );
    assert.ok(
      Math.max(...residualRows.map((row) => row.restResidualDeg)) > 0,
      "a world rest residual set of all zeros means the hierarchy was never walked",
    );
  });

  test("the dynamic world baseline is driven by clip deltas, not repeated static residuals", () => {
    const { rows, residualRows } = worldPoseAlignment();
    const staticByKey = new Map(
      residualRows.map((row) => [`${row.actorId}|${row.bone}`, row.restResidualDeg]),
    );

    let matchesStatic = 0;
    let maxDivergenceDeg = 0;
    const distinctByKey = new Map();
    for (const row of rows) {
      const key = `${row.actorId}|${row.bone}`;
      const divergence = Math.abs(row.worldPoseResidualDeg - staticByKey.get(key));
      if (divergence <= 1e-9) matchesStatic += 1;
      maxDivergenceDeg = Math.max(maxDivergenceDeg, divergence);
      if (!distinctByKey.has(key)) distinctByKey.set(key, new Set());
      distinctByKey.get(key).add(row.worldPoseResidualDeg.toFixed(9));
    }

    // A baseline that merely restamped the static residual for every clip and
    // frame would score matchesStatic === rows.length and maxDivergence === 0.
    assert.ok(
      matchesStatic < rows.length * 0.25,
      `${matchesStatic}/${rows.length} dynamic rows merely restate the static residual`,
    );
    assert.ok(maxDivergenceDeg > 5, `dynamic rows never leave the static pose (max ${maxDivergenceDeg})`);

    const varying = [...distinctByKey.values()].filter((values) => values.size > 1).length;
    assert.ok(
      varying > distinctByKey.size / 2,
      `only ${varying}/${distinctByKey.size} actor/bone pairs vary across the clip set`,
    );

    const distinctDynamic = new Set(rows.map((row) => row.worldPoseResidualDeg.toFixed(9))).size;
    const distinctStatic = new Set(residualRows.map((row) => row.restResidualDeg.toFixed(9))).size;
    assert.ok(
      distinctDynamic > distinctStatic * 4,
      `dynamic baseline carries ${distinctDynamic} distinct values against ${distinctStatic} static values`,
    );
  });

  test("each clip is sampled at two different times and yields its own residual profile", () => {
    const { config, rows } = worldPoseAlignment();
    const byRow = new Map(
      rows.map((row) => [`${row.actorId}|${row.clipName}|${row.bone}|${row.frameSample}`, row]),
    );
    const clipNames = [...new Set(rows.map((row) => row.clipName))];

    for (const clipName of clipNames) {
      const first = rows.filter((row) => row.clipName === clipName && row.frameSample === "first");
      const midpointTimes = new Set(
        rows.filter((row) => row.clipName === clipName && row.frameSample === "midpoint")
          .map((row) => row.frameTime),
      );
      assert.equal(midpointTimes.size, 1, `${clipName} must have one midpoint time`);
      const [midpointTime] = midpointTimes;
      assert.ok(midpointTime > first[0].frameTime, `${clipName} midpoint must follow its first frame`);

      const moved = first.filter((row) => {
        const midpoint = byRow.get(`${row.actorId}|${clipName}|${row.bone}|midpoint`);
        return Math.abs(midpoint.worldPoseResidualDeg - row.worldPoseResidualDeg) > 1e-9;
      });
      // A clip whose midpoint equals its first frame everywhere carries no motion.
      assert.ok(
        moved.length > first.length * 0.1,
        `${clipName} moves on only ${moved.length}/${first.length} actor/bone pairs`,
      );
    }

    // Distinct clips must produce distinct residual profiles for one actor.
    const actorId = config.characters[0].assetId;
    const profile = (clipName) => rows
      .filter((row) => row.clipName === clipName && row.actorId === actorId && row.frameSample === "midpoint")
      .map((row) => row.worldPoseResidualDeg.toFixed(6))
      .join(",");
    const profiles = clipNames.map(profile);
    assert.ok(
      new Set(profiles).size >= Math.ceil(clipNames.length * 0.6),
      `only ${new Set(profiles).size}/${clipNames.length} clips have their own residual profile`,
    );
  });

  test("a mutated certification pose cohort fails closed before actor-rig validation", () => {
    const certification = readJson(CERTIFICATION);
    const error = gateError("KG_TARGET_RIG_PROVENANCE", () =>
      collectWorldPoseAlignment(repositoryPath(TARGET_RIG), {
        ...certification,
        poseAlignmentBones: [...certification.poseAlignmentBones, "DEF-absent-bone"],
      }));
    assert.match(error.message, /pose cohort or excluded pelvis pair differs from the code-owned contract/);

    // A non-GLB target rig is rejected by the container reader, not silently skipped.
    gateError("KG_GLB", () =>
      collectWorldPoseAlignment(repositoryPath("package.json"), certification));
  });

  test("the Blender overlay comparison rejects 21 arbitrary action names", { skip: PYTHON_SKIP }, () => {
    const results = runPython(BLENDER_HARNESS, [repositoryPath(BLENDER_TOOL)]);
    assert.equal(results.nonCanonicalOverlayNames.ok, false);
    assert.equal(results.nonCanonicalOverlayNames.code, "KG_OVERLAY_ACTIONS");
  });

  test("every configured character has a runtime model on disk", () => {
    const config = readJson(LIBRARY_CONFIG);
    assert.ok(config.characters.length > 0);
    for (const character of config.characters) {
      const model = `assets/motion/ingame/characters/${character.assetId}/model.glb`;
      assert.ok(statSync(repositoryPath(model)).size > 0, `${model} must exist`);
    }
  });
});

describe("the pose-alignment CLI fails closed before writing anything", () => {
  function runCli(args) {
    return spawnSync(process.execPath, [repositoryPath(AUDIT_CLI), ...args], {
      encoding: "utf8",
      cwd: REPOSITORY_ROOT,
    });
  }

  test("the inert bounds mode, missing arguments, and escaping paths are all refused", () => {
    const inert = runCli([]);
    assert.equal(inert.status, 2);
    assert.match(inert.stderr, /^KG_BOUNDS_REQUIRED: /);
    assert.equal(inert.stdout, "");

    const missing = runCli(["--pose-alignment"]);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /^KG_ARGUMENTS: --target-rig is required/);

    const stray = runCli(["--pose-alignment", "stray"]);
    assert.equal(stray.status, 2);
    assert.match(stray.stderr, /^KG_ARGUMENTS: unexpected argument: stray/);

    // Containment: an output path outside the repository is refused up front.
    const escaping = runCli([
      "--pose-alignment",
      "--target-rig", TARGET_RIG,
      "--vectors", VECTORS_PATH,
      "--baseline-out", join(scratchDir, "baseline.json"),
      "--residuals-out", join(scratchDir, "residuals.json"),
    ]);
    assert.equal(escaping.status, 2);
    assert.match(escaping.stderr, /^KG_PATH: baseline out must stay under repository root/);
    assert.equal(escaping.stdout, "");
  });
});

// The Blender-side extractor cannot import bpy here, so the compatibility
// contract is exercised against a stub that models the Blender 5 layered
// action API (action.layers -> layer.strips -> strip.channelbag(slot)) and the
// pre-5 legacy API (action.fcurves).  A tool that dereferenced action.fcurves
// directly would raise AttributeError on the layered stubs below.
const BLENDER_HARNESS = `
import importlib.util
import json
import sys
import types
from pathlib import Path

TOOL = Path(sys.argv[1])


class Point:
    def __init__(self, x):
        self.co = types.SimpleNamespace(x=x)


class Curve:
    def __init__(self, data_path, array_index, keys):
        self.data_path = data_path
        self.array_index = array_index
        self.keyframe_points = [Point(key) for key in keys]

    def evaluate(self, moment):
        return float(moment) * (self.array_index + 1)


class Strip:
    def __init__(self, curves_by_slot, strip_type="KEYFRAME"):
        self.type = strip_type
        self._curves_by_slot = curves_by_slot

    def channelbag(self, slot):
        curves = self._curves_by_slot.get(id(slot))
        return None if curves is None else types.SimpleNamespace(fcurves=curves)


class Layer:
    def __init__(self, strips):
        self.strips = strips


class LayeredAction:
    def __init__(self, name, layers, slots):
        self.name = name
        self.layers = layers
        self.slots = slots


class LegacyAction:
    def __init__(self, name, fcurves):
        self.name = name
        self.fcurves = fcurves


class OpaqueAction:
    def __init__(self, name):
        self.name = name


def install_stub_bpy():
    bpy = types.ModuleType("bpy")
    armature = types.SimpleNamespace(type="ARMATURE", name="rig", data=types.SimpleNamespace(bones=[]))
    def import_gltf(filepath, guess_original_bind_pose=True, **kwargs):
        # The stub refuses the default rather than tolerating it: left True,
        # Blender rebuilds armature rest from the inverse bind matrices and the
        # tool measures a re-posed rig instead of the shipped one.
        assert guess_original_bind_pose is False, "import_scene.gltf must pass guess_original_bind_pose=False"
        bpy.data.actions = bpy._actions_by_path.get(filepath, bpy.data.actions)
    bpy.ops = types.SimpleNamespace(
        wm=types.SimpleNamespace(read_factory_settings=lambda **kwargs: None),
        import_scene=types.SimpleNamespace(gltf=import_gltf, fbx=lambda **kwargs: None),
    )
    bpy.context = types.SimpleNamespace(scene=types.SimpleNamespace(objects=[armature]))
    bpy.data = types.SimpleNamespace(actions=[])
    bpy._actions_by_path = {}
    bpy.app = types.SimpleNamespace(version_string="5.1.2", binary_path="/stub/Blender")
    bpy.types = types.SimpleNamespace(Object=object)
    sys.modules["bpy"] = bpy
    mathutils = types.ModuleType("mathutils")
    mathutils.Quaternion = tuple
    sys.modules["mathutils"] = mathutils
    return bpy


bpy = install_stub_bpy()
spec = importlib.util.spec_from_file_location("derive_kinematic_bounds_blender", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

BONE_PATH = 'pose.bones["DEF-spine"].rotation_quaternion'
results = {}


def scenario(label, actions):
    bpy.data.actions = actions
    try:
        results[label] = {"ok": True, "value": tool.action_channels(Path("stub.glb"))}
    except Exception as error:
        results[label] = {
            "ok": False,
            "code": getattr(error, "code", type(error).__name__),
            "message": str(error),
        }


def quaternion_curves(keys=(1.0, 5.0), path=BONE_PATH):
    return [Curve(path, index, keys) for index in range(4)]


slot = types.SimpleNamespace(name="Object")
other_slot = types.SimpleNamespace(name="Armature")

scenario("layered", [LayeredAction("clip", [Layer([Strip({id(slot): quaternion_curves()})])], [slot])])
scenario("layeredNoSlots", [LayeredAction("clip", [Layer([Strip({})])], [])])
scenario(
    "layeredNonKeyframeStrip",
    [LayeredAction("clip", [Layer([Strip({id(slot): quaternion_curves()}, strip_type="ANIM")])], [slot])],
)
scenario(
    "layeredMultiSlot",
    [
        LayeredAction(
            "clip",
            [Layer([Strip({id(slot): [Curve("left", 0, (1.0, 3.0))], id(other_slot): [Curve("right", 0, (1.0, 3.0))]})])],
            [slot, other_slot],
        )
    ],
)
scenario(
    "layeredEmptyChannelbag",
    [LayeredAction("clip", [Layer([Strip({id(slot): quaternion_curves()}), Strip({})])], [slot])],
)
scenario("legacy", [LegacyAction("clip", quaternion_curves())])
scenario("neitherApi", [OpaqueAction("clip")])
scenario(
    "duplicateChannel",
    [
        LayeredAction(
            "clip",
            [Layer([Strip({id(slot): quaternion_curves() + [Curve(BONE_PATH, 0, (1.0, 5.0))]})])],
            [slot],
        )
    ],
)
scenario(
    "emptyChannel",
    [LayeredAction("clip", [Layer([Strip({id(slot): [Curve(BONE_PATH, 0, ())]})])], [slot])],
)
scenario("noChannels", [LayeredAction("clip", [Layer([Strip({id(slot): []})])], [slot])])
scenario(
    "duplicateActionName",
    [
        LayeredAction("clip", [Layer([Strip({id(slot): quaternion_curves()})])], [slot]),
        LayeredAction("clip", [Layer([Strip({id(slot): quaternion_curves()})])], [slot]),
    ],
)
scenario(
    "fractionalFrameRange",
    [LayeredAction("clip", [Layer([Strip({id(slot): quaternion_curves(keys=(1.0, 3.5))})])], [slot])],
)

arbitrary_names = [f"arbitrary-overlay-action-{index}" for index in range(21)]
repo_root = TOOL.parents[5]
scratch_overlay = repo_root / "scratch.glb"
committed_overlay = repo_root / "overlay.glb"
bpy._actions_by_path = {
    str(scratch_overlay): [LegacyAction(name, quaternion_curves()) for name in arbitrary_names],
    str(committed_overlay): [LegacyAction(name, quaternion_curves()) for name in arbitrary_names],
}
try:
    results["nonCanonicalOverlayNames"] = {
        "ok": True,
        "value": tool.compare_overlays(scratch_overlay, committed_overlay),
    }
except Exception as error:
    results["nonCanonicalOverlayNames"] = {
        "ok": False,
        "code": getattr(error, "code", type(error).__name__),
        "message": str(error),
    }

results["poseAlignmentBones"] = {"ok": True, "value": list(tool.POSE_ALIGNMENT_BONES)}
print(json.dumps(results))
`;

const PARITY_HARNESS = `
import json
import sys
from pathlib import Path

sys.path.insert(0, sys.argv[1])
import kinematic_gate as gate

vectors_path, probes_path, glb_path = sys.argv[2], sys.argv[3], sys.argv[4]
payload = json.loads(Path(vectors_path).read_text())
probes = json.loads(Path(probes_path).read_text())

print(json.dumps({
    "conformance": [row["id"] for row in gate.run_conformance_vectors(vectors_path)],
    "tracks": {
        vector["id"]: gate.measure_quaternion_track(vector["quaternions"])
        for vector in payload["vectors"]
    },
    "distances": [gate.angular_distance_degrees(left, right) for left, right in probes],
    "glb": gate.measure_glb(glb_path),
}))
`;

const CORPUS_HARNESS = `
import importlib.util
import json
import sys
import tempfile
import types
import zipfile
from pathlib import Path

TOOL = Path(sys.argv[1])

bpy = types.ModuleType("bpy")
bpy.app = types.SimpleNamespace(version_string="5.1.2", binary_path="/stub/Blender")
bpy.ops = types.SimpleNamespace(
    wm=types.SimpleNamespace(read_factory_settings=lambda **kwargs: None),
    import_scene=types.SimpleNamespace(fbx=lambda **kwargs: None),
)
bpy.context = types.SimpleNamespace(scene=types.SimpleNamespace(objects=[]))
bpy.data = types.SimpleNamespace(actions=[])
bpy.types = types.SimpleNamespace(Object=object)
sys.modules["bpy"] = bpy
mathutils = types.ModuleType("mathutils")
mathutils.Quaternion = tuple
sys.modules["mathutils"] = mathutils

spec = importlib.util.spec_from_file_location("derive_kinematic_bounds_blender", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

def captured(call):
    try:
        return {"ok": True, "value": call()}
    except BaseException as error:
        return {
            "ok": False,
            "code": getattr(error, "code", type(error).__name__),
            "message": str(error),
        }

def parsed(arguments):
    previous = sys.argv
    sys.argv = ["derive-kinematic-bounds-blender.py", "--", *arguments]
    try:
        value = tool.parse_args()
        return {"ok": True, "value": vars(value)}
    except BaseException as error:
        return {
            "ok": False,
            "code": getattr(error, "code", type(error).__name__),
            "message": str(error),
        }
    finally:
        sys.argv = previous

with tempfile.TemporaryDirectory(prefix="survey-corpus-") as temporary:
    root = Path(temporary)
    tool.REPO_ROOT = root
    loose_root = root / "assets/motion/bench"
    loose_root.mkdir(parents=True)
    loose_deaths = [f"Loose Death {index}.fbx" for index in range(1, 4)]
    loose_names = loose_deaths + [f"Loose Motion {index:02d}.fbx" for index in range(1, 64)]
    for relative in loose_names:
        (loose_root / relative).write_bytes(b"synthetic-fbx")

    archive_relative = "assets/motion/bench/Sword and Shield Pack.zip"
    archive_path = root / archive_relative
    archive_deaths = ["archive/Archive Death 01.fbx", "archive/Archive Death 02.fbx"]
    archive_names = archive_deaths + [f"archive/Archive Motion {index:02d}.fbx" for index in range(1, 49)]
    with zipfile.ZipFile(archive_path, "w") as archive:
        for member in archive_names:
            archive.writestr(member, b"synthetic-fbx")

    manifest = {
        "schemaVersion": 1,
        "looseRoot": "assets/motion/bench",
        "expectedLooseFbx": 66,
        "archives": [{"path": archive_relative, "expectedFbx": 50}],
        "deathCandidates": [
            *(f"assets/motion/bench/{path}" for path in loose_deaths),
            *(f"{archive_relative}!{member}" for member in archive_deaths),
        ],
    }
    manifest_path = root / "full-corpus-v1.json"
    manifest_path.write_text(json.dumps(manifest))
    bad_manifest_path = root / "bad-corpus-v1.json"
    bad_manifest_path.write_text(json.dumps({**manifest, "expectedLooseFbx": 65}))

    valid = captured(lambda: tool.load_survey_corpus(manifest_path))
    invalid = captured(lambda: tool.load_survey_corpus(bad_manifest_path))
    if valid["ok"]:
        candidates = valid["value"]
        provenance = [row["sourceGroup"]["repoRelativePath"] for row in candidates]
        valid["summary"] = {
            "candidateCount": len(candidates),
            "looseCount": sum("!" not in path for path in provenance),
            "archiveCount": sum("!" in path for path in provenance),
            "ordered": provenance == sorted(provenance),
            "relativeOnly": all(not Path(path).is_absolute() for path in provenance),
            "dieCount": sum("die" in row.get("candidateActionClasses", []) for row in candidates),
            "nonDeathDieCount": sum(
                "die" in row.get("candidateActionClasses", []) and path not in manifest["deathCandidates"]
                for row, path in zip(candidates, provenance)
            ),
        }

result = {
    "valid": valid,
    "invalid": invalid,
    "surveyArgs": parsed(["--survey", "--corpus-manifest", "full-corpus-v1.json", "--vectors", "vectors.json", "--out", "out.json"]),
    "certifyArgs": parsed(["--certify-target-rig", "rig.glb", "--corpus-manifest", "full-corpus-v1.json", "--vectors", "vectors.json", "--out", "out.json"]),
    "surveyScratchTargetArgs": parsed(["--survey", "--scratch-target-rig", "scratch-target.glb", "--corpus-manifest", "full-corpus-v1.json", "--vectors", "vectors.json", "--out", "out.json"]),
    "certifyScratchTargetArgs": parsed(["--certify-target-rig", "rig.glb", "--scratch-target-rig", "scratch-target.glb", "--scratch-overlay", "scratch.glb", "--overlay", "overlay.glb", "--vectors", "vectors.json", "--out", "out.json"]),
    "temporaryRootRemoved": not root.exists(),
}

print(json.dumps(result))
`;

const SURVEY_GAP_HARNESS = `
import importlib.util
import json
import sys
import tempfile
import types
import zipfile
from pathlib import Path

TOOL = Path(sys.argv[1])

bpy = types.ModuleType("bpy")
bpy.app = types.SimpleNamespace(version_string="5.1.2", binary_path="/stub/Blender")
bpy.data = types.SimpleNamespace(actions=[])
bpy.context = types.SimpleNamespace(scene=types.SimpleNamespace(objects=[], frame_set=lambda frame: None))

def reset_scene(**kwargs):
    bpy.context.scene.objects = []
    bpy.data.actions = []

def import_fbx(filepath):
    slot = types.SimpleNamespace(target_id_type="OBJECT")
    action = types.SimpleNamespace(name="synthetic-action", frame_range=(1, 2), slots=[slot])
    rest = types.SimpleNamespace(to_quaternion=lambda: (0, 0, 0, 1))
    bone = types.SimpleNamespace(
        name="mixamorig:Hips",
        rotation_quaternion=(0, 0, 0.1, 0.995),
        bone=types.SimpleNamespace(matrix_local=rest),
    )
    armature = types.SimpleNamespace(
        type="ARMATURE",
        id_type="OBJECT",
        pose=types.SimpleNamespace(bones=[bone]),
    )
    armature.animation_data_create = lambda: setattr(armature, "animation_data", types.SimpleNamespace())
    bpy.context.scene.objects = [armature]
    bpy.data.actions = [action]

bpy.ops = types.SimpleNamespace(
    wm=types.SimpleNamespace(read_factory_settings=reset_scene),
    import_scene=types.SimpleNamespace(fbx=import_fbx),
)
bpy.types = types.SimpleNamespace(Object=object, Action=object)
sys.modules["bpy"] = bpy
mathutils = types.ModuleType("mathutils")
mathutils.Quaternion = tuple
sys.modules["mathutils"] = mathutils

spec = importlib.util.spec_from_file_location("derive_kinematic_bounds_blender", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

def captured(call):
    try:
        return {"ok": True, "value": call()}
    except BaseException as error:
        return {
            "ok": False,
            "code": getattr(error, "code", type(error).__name__),
            "message": str(error),
        }

with tempfile.TemporaryDirectory(prefix="survey-gap-") as temporary:
    root = Path(temporary).resolve()
    tool.REPO_ROOT = root
    bench = root / "assets/motion/bench"
    bench.mkdir(parents=True)
    death_names = [f"Approved Death {index}.fbx" for index in range(1, 6)]
    outside_death = "Unapproved Death.fbx"
    for name in [*death_names, outside_death]:
        (bench / name).write_bytes(b"synthetic-fbx")

    manifest_path = root / "corpus.json"
    manifest_path.write_text(json.dumps({
        "schemaVersion": 1,
        "looseRoot": "assets/motion/bench",
        "expectedLooseFbx": 6,
        "archives": [],
        "deathCandidates": [f"assets/motion/bench/{name}" for name in death_names],
    }))
    config_path = root / "config.json"
    config_path.write_text(json.dumps({
        "motionBench": "assets/motion/bench",
        "characters": [{
            "assetId": "synthetic",
            "motions": {"die": {"source": outside_death, "loop": False}},
        }],
    }))

    die_guard = captured(lambda: tool.survey(config_path, manifest_path))
    if die_guard["ok"]:
        die_guard["dieCount"] = sum(
            "die" in row["candidateActionClasses"] for row in die_guard["value"]["sources"]
        )

    archive_path = bench / "synthetic.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("nested/synthetic.fbx", b"archived-fbx")
    archive_candidate = {
        "sourceGroup": {"repoRelativePath": "assets/motion/bench/synthetic.zip!nested/synthetic.fbx"},
        "archivePath": "assets/motion/bench/synthetic.zip",
        "archiveMember": "nested/synthetic.fbx",
    }
    with tool.materialize_survey_candidate(archive_candidate) as extracted:
        materialized = {
            "readableInside": extracted.read_bytes() == b"archived-fbx",
            "existsInside": extracted.exists(),
            "path": extracted,
        }
    materialized["removedAfter"] = not materialized["path"].exists()

print(json.dumps({"dieGuard": die_guard, "materialized": materialized}, default=str))
`;

const SCRATCH_TARGET_IDENTITY_HARNESS = `
import hashlib
import importlib.util
import json
import sys
import tempfile
import types
from pathlib import Path

TOOL = Path(sys.argv[1])

bpy = types.ModuleType("bpy")
bpy.app = types.SimpleNamespace(version_string="5.1.2", binary_path="/stub/Blender")
bpy.ops = types.SimpleNamespace(wm=types.SimpleNamespace(read_factory_settings=lambda **kwargs: None))
bpy.context = types.SimpleNamespace(scene=types.SimpleNamespace(objects=[]))
bpy.data = types.SimpleNamespace(actions=[])
bpy.types = types.SimpleNamespace(Object=object)
sys.modules["bpy"] = bpy
mathutils = types.ModuleType("mathutils")
mathutils.Quaternion = tuple
sys.modules["mathutils"] = mathutils

spec = importlib.util.spec_from_file_location("derive_kinematic_bounds_blender", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

def captured(call):
    try:
        return {"ok": True, "value": call()}
    except BaseException as error:
        return {
            "ok": False,
            "code": getattr(error, "code", type(error).__name__),
            "message": str(error),
        }

with tempfile.TemporaryDirectory(prefix="scratch-target-identity-") as temporary:
    root = Path(temporary).resolve()
    tool.REPO_ROOT = root
    target = root / "certified-target.glb"
    target_bytes = b"synthetic-target-glb"
    target.write_bytes(target_bytes)
    target_hash = hashlib.sha256(target_bytes).hexdigest()
    target.with_suffix(".provenance.json").write_text(json.dumps({
        "originCommit": "synthetic",
        "deletedBy": "synthetic",
        "originPath": "synthetic-target.glb",
        "targetRigSha256": target_hash,
        "targetRigBytes": len(target_bytes),
        "recoveryCommand": "synthetic",
    }))
    matching_target = root / "matching-scratch-target.glb"
    matching_target.write_bytes(target_bytes)
    mismatched_target = root / "mismatched-scratch-target.glb"
    mismatched_target.write_bytes(b"other-synthetic-target-glb")
    scratch_overlay = root / "scratch-overlay.glb"
    committed_overlay = root / "committed-overlay.glb"
    scratch_overlay.write_bytes(b"synthetic-overlay")
    committed_overlay.write_bytes(b"synthetic-overlay")
    vectors = root / "vectors.json"
    vectors.write_text("{}")
    out = root / "out.json"

    tool.run_conformance_vectors = lambda path: []
    tool.certify_target_rig = lambda rig: {"synthetic": True}
    tool.subprocess.run = lambda *args, **kwargs: types.SimpleNamespace(stdout=target_bytes)
    compare_calls = []
    tool.compare_overlays = lambda scratch, committed: (
        compare_calls.append((str(scratch), str(committed))) or {"passed": True}
    )
    tool.print = lambda *args, **kwargs: None

    def invoke(scratch_target=None):
        args = [
            "--certify-target-rig", str(target),
            "--scratch-overlay", str(scratch_overlay),
            "--overlay", str(committed_overlay),
            "--vectors", str(vectors),
            "--out", str(out),
        ]
        if scratch_target is not None:
            args.extend(["--scratch-target-rig", str(scratch_target)])
        previous = sys.argv
        sys.argv = ["derive-kinematic-bounds-blender.py", "--", *args]
        try:
            return tool.main()
        finally:
            sys.argv = previous

    result = {
        "absent": captured(lambda: invoke()),
        "mismatched": captured(lambda: invoke(mismatched_target)),
        "matching": captured(lambda: invoke(matching_target)),
        "compareCalls": len(compare_calls),
    }

print(json.dumps(result))
`;

const COMPARATOR_LOCATION_HARNESS = `
import importlib.util
import json
import sys
import tempfile
import types
from pathlib import Path

TOOL = Path(sys.argv[1])
bpy = types.ModuleType("bpy")
bpy.app = types.SimpleNamespace(version_string="5.1.2", binary_path="/stub/Blender")
sys.modules["bpy"] = bpy
mathutils = types.ModuleType("mathutils")
mathutils.Quaternion = tuple
sys.modules["mathutils"] = mathutils

spec = importlib.util.spec_from_file_location("derive_kinematic_bounds_blender", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

def channels(quaternion):
    return {
        'pose.bones["DEF-spine"].rotation_quaternion[0]': [quaternion[0]],
        'pose.bones["DEF-spine"].rotation_quaternion[1]': [quaternion[1]],
        'pose.bones["DEF-spine"].rotation_quaternion[2]': [quaternion[2]],
        'pose.bones["DEF-spine"].rotation_quaternion[3]': [quaternion[3]],
    }

identity = [0, 0, 0, 1]
early_small = [0.08715574274765817, 0, 0, 0.9961946980917455]
later_large = [0.7071067811865475, 0, 0, 0.7071067811865476]
left = {
    "early-temporal-divergence": {"sampleTimes": [1], "channels": channels(identity)},
    "later-global-maximum": {"sampleTimes": [2], "channels": channels(identity)},
}
right = {
    "early-temporal-divergence": {"sampleTimes": [1], "channels": channels(early_small)},
    "later-global-maximum": {"sampleTimes": [2], "channels": channels(later_large)},
}

with tempfile.TemporaryDirectory(prefix="comparator-location-") as temporary:
    root = Path(temporary).resolve()
    tool.REPO_ROOT = root
    scratch, committed = root / "scratch.glb", root / "committed.glb"
    tool.action_channels = lambda path: left if path == scratch else right
    tool.canonical_overlay_actions = lambda: set(left)
    print(json.dumps(tool.compare_overlays(scratch, committed)))
`;

describe("Blender 5 layered action compatibility", () => {
  test("the certification evidence was produced by a Blender 5 runtime", () => {
    const certification = readJson(CERTIFICATION);
    assert.match(
      certification.blender.version,
      /^5\./,
      `layered actions are mandatory from Blender 5; certification recorded ${certification.blender.version}`,
    );
  });

  test("layered actions resolve through slots and channelbags, legacy actions still work", { skip: PYTHON_SKIP }, () => {
    const results = runPython(BLENDER_HARNESS, [repositoryPath(BLENDER_TOOL)]);

    // Blender 5: fcurves live behind action.layers -> strip.channelbag(slot).
    assert.equal(results.layered.ok, true, JSON.stringify(results.layered));
    const layered = results.layered.value.clip;
    assert.deepEqual(layered.sampleTimes, [1, 2, 3, 4, 5], "frames are sampled one per step, endpoints kept");
    assert.deepEqual(
      Object.keys(layered.channels).sort(),
      [0, 1, 2, 3].map((index) => `pose.bones["DEF-spine"].rotation_quaternion[${index}]`),
    );
    for (const samples of Object.values(layered.channels)) {
      assert.equal(samples.length, layered.sampleTimes.length);
    }

    // A layered action with no slots is unreadable and must not be silently empty.
    assert.equal(results.layeredNoSlots.ok, false);
    assert.equal(results.layeredNoSlots.code, "KG_OVERLAY_ACTIONS");
    assert.match(results.layeredNoSlots.message, /has no slots/);

    // Non-keyframe strips carry no curves; the action then has nothing to measure.
    assert.equal(results.layeredNonKeyframeStrip.ok, false);
    assert.equal(results.layeredNonKeyframeStrip.code, "KG_OVERLAY_CHANNELS");

    // Every slot on a strip contributes; a single-slot assumption would drop data.
    assert.equal(results.layeredMultiSlot.ok, true, JSON.stringify(results.layeredMultiSlot));
    assert.deepEqual(Object.keys(results.layeredMultiSlot.value.clip.channels).sort(), ["left[0]", "right[0]"]);

    // A strip whose channelbag is absent for a slot is skipped, not fatal.
    assert.equal(results.layeredEmptyChannelbag.ok, true, JSON.stringify(results.layeredEmptyChannelbag));
    assert.equal(Object.keys(results.layeredEmptyChannelbag.value.clip.channels).length, 4);

    // Pre-5 files with legacy fcurves still measure identically.
    assert.equal(results.legacy.ok, true, JSON.stringify(results.legacy));
    assert.deepEqual(results.legacy.value.clip, layered);

    // An action exposing neither API fails closed instead of measuring nothing.
    assert.equal(results.neitherApi.ok, false);
    assert.equal(results.neitherApi.code, "KG_OVERLAY_ACTIONS");
    assert.match(results.neitherApi.message, /neither layered nor legacy fcurves/);

    // Ambiguity and emptiness are refused rather than averaged away.
    assert.equal(results.duplicateChannel.code, "KG_OVERLAY_CHANNELS");
    assert.match(results.duplicateChannel.message, /ambiguous duplicate fcurve/);
    assert.equal(results.emptyChannel.code, "KG_OVERLAY_CHANNELS");
    assert.match(results.emptyChannel.message, /empty fcurve/);
    assert.equal(results.noChannels.code, "KG_OVERLAY_CHANNELS");
    assert.equal(results.duplicateActionName.code, "KG_OVERLAY_ACTIONS");
    assert.match(results.duplicateActionName.message, /ambiguous duplicate action name/);

    // A fractional end frame is preserved as the final sample.
    assert.deepEqual(results.fractionalFrameRange.value.clip.sampleTimes, [1, 2, 3, 3.5]);

    // The extractor and the audit agree on the certified pose cohort.
    assert.deepEqual(
      results.poseAlignmentBones.value,
      readJson(CERTIFICATION).poseAlignmentBones,
    );
  });
});

describe("Node and Python gate implementations agree", () => {
  test("both runtimes reproduce the same frozen measurements", { skip: PYTHON_SKIP }, () => {
    const payload = readJson(VECTORS_PATH);
    const probes = [
      [IDENTITY, [0, 0, 0, -1]],
      [IDENTITY, QUARTER_TURN_Z],
      [IDENTITY, EIGHTH_TURN_Z],
      [[0, 0, 0, 5], [0, 0, 0, -3]],
      [QUARTER_TURN_Z, EIGHTH_TURN_Z],
      [IDENTITY, [0, 0, Math.sin(Math.PI * (100 / 180)), Math.cos(Math.PI * (100 / 180))]],
    ];
    const probesPath = scratchFile("probes.json", JSON.stringify(probes));
    const glbPath = writeGlb("parity.glb", rotationClipDocument());

    const python = runPython(PARITY_HARNESS, [
      repositoryPath(TOOLS_DIR),
      repositoryPath(VECTORS_PATH),
      probesPath,
      glbPath,
    ]);

    assert.deepEqual(python.conformance, CONFORMANCE_VECTOR_IDS);

    for (const vector of payload.vectors) {
      const node = measureQuaternionTrack(vector.quaternions);
      const other = python.tracks[vector.id];
      assert.equal(node.medoidIndex, other.medoidIndex, `${vector.id} medoid`);
      assert.ok(Math.abs(node.peakDeg - other.peakDeg) < 1e-9, `${vector.id} peak`);
      assert.ok(Math.abs(node.stepDeg - other.stepDeg) < 1e-9, `${vector.id} step`);
    }

    probes.forEach(([left, right], index) => {
      assert.ok(
        Math.abs(angularDistanceDegrees(left, right) - python.distances[index]) < 1e-9,
        `probe ${index} disagrees: ${angularDistanceDegrees(left, right)} vs ${python.distances[index]}`,
      );
    });

    // Both GLB readers resample the same two-key clip at 24 Hz identically.
    const nodeRows = measureGlb(glbPath);
    assert.equal(python.glb.length, nodeRows.length);
    nodeRows.forEach((row, index) => {
      const other = python.glb[index];
      assert.equal(other.clipName, row.clipName);
      assert.equal(other.bone, row.bone);
      assert.equal(other.sampleFps, SAMPLE_FPS);
      assert.equal(other.medoidIndex, row.medoidIndex);
      assert.ok(Math.abs(other.peakDeg - row.peakDeg) < 1e-9);
      assert.ok(Math.abs(other.stepDeg - row.stepDeg) < 1e-9);
    });
  });
});

describe("survey-only full corpus input contract", () => {
  test("the real corpus manifest binds 66 loose FBX, 50 archived FBX, and five die candidates without runtime routing", () => {
    const corpus = readJson(FULL_CORPUS_MANIFEST);
    assert.equal(corpus.schemaVersion, 1);
    assert.equal(corpus.looseRoot, "assets/motion/bench");
    assert.equal(corpus.expectedLooseFbx, 66);
    assert.deepEqual(corpus.archives, [{
      path: "assets/motion/bench/Sword and Shield Pack.zip",
      expectedFbx: 50,
    }]);
    assert.equal(corpus.deathCandidates.length, 5);
    assert.equal(corpus.deathCandidates.filter((candidate) => candidate.includes("!")).length, 2);
    assert.equal(corpus.deathCandidates.filter((candidate) => !candidate.includes("!")).length, 3);

    const runtimeSources = new Set(
      readJson(LIBRARY_CONFIG).characters.flatMap((character) =>
        Object.values(character.motions)
          .filter((motion) => motion.kind !== "authored-fallback")
          .map((motion) => motion.source)),
    );
    assert.equal(runtimeSources.size, 30, "the 116 survey candidates must not be promoted into runtime routing");
    assert.ok([...runtimeSources].every((source) => !source.includes("!")));
  });

  test("the pure corpus loader enumerates deterministic loose and archive provenance without leaking extraction", { skip: PYTHON_SKIP }, () => {
    const result = runPython(CORPUS_HARNESS, [repositoryPath(BLENDER_TOOL)]);
    assert.equal(result.valid.ok, true, JSON.stringify(result.valid));
    assert.deepEqual(result.valid.summary, {
      candidateCount: 116,
      looseCount: 66,
      archiveCount: 50,
      ordered: true,
      relativeOnly: true,
      dieCount: 5,
      nonDeathDieCount: 0,
    });
    assert.equal(result.invalid.ok, false, "a mismatched corpus count must reject");
    assert.equal(result.invalid.code, "KG_SURVEY_CORPUS");
    assert.equal(result.surveyArgs.ok, true, JSON.stringify(result.surveyArgs));
    assert.equal(result.surveyArgs.value.corpus_manifest, "full-corpus-v1.json");
    assert.equal(result.certifyArgs.ok, false, "--corpus-manifest must be rejected outside survey mode");
    assert.equal(result.temporaryRootRemoved, true, "synthetic archive extraction must leave no temporary tree");
  });

  test("survey rejects the certification-only scratch target rig argument", { skip: PYTHON_SKIP }, () => {
    const result = runPython(CORPUS_HARNESS, [repositoryPath(BLENDER_TOOL)]);
    assert.equal(result.surveyScratchTargetArgs.ok, false, JSON.stringify(result.surveyScratchTargetArgs));
    assert.equal(result.certifyScratchTargetArgs.ok, true, JSON.stringify(result.certifyScratchTargetArgs));
    assert.equal(result.certifyScratchTargetArgs.value.scratch_target_rig, "scratch-target.glb");
  });

  test("survey rejects a config-created sixth die outside the corpus manifest", { skip: PYTHON_SKIP }, () => {
    const result = runPython(SURVEY_GAP_HARNESS, [repositoryPath(BLENDER_TOOL)]);
    assert.equal(result.dieGuard.ok, false, JSON.stringify(result.dieGuard));
    assert.equal(result.dieGuard.code, "KG_SURVEY_CORPUS", JSON.stringify(result.dieGuard));
  });

  test("materialize_survey_candidate removes a synthetic archive extraction after its context", { skip: PYTHON_SKIP }, () => {
    const result = runPython(SURVEY_GAP_HARNESS, [repositoryPath(BLENDER_TOOL)]);
    assert.equal(result.materialized.readableInside, true);
    assert.equal(result.materialized.existsInside, true);
    assert.equal(result.materialized.removedAfter, true);
  });

  test("certification rejects absent or mismatched scratch target rigs before overlay comparison", { skip: PYTHON_SKIP }, () => {
    const result = runPython(SCRATCH_TARGET_IDENTITY_HARNESS, [repositoryPath(BLENDER_TOOL)]);
    assert.equal(result.absent.ok, false, JSON.stringify(result.absent));
    assert.equal(result.absent.code, "KG_TARGET_RIG_PROVENANCE", JSON.stringify(result.absent));
    assert.equal(result.mismatched.ok, false, JSON.stringify(result.mismatched));
    assert.equal(result.mismatched.code, "KG_TARGET_RIG_PROVENANCE", JSON.stringify(result.mismatched));
    assert.equal(result.matching.ok, true, JSON.stringify(result.matching));
    assert.equal(result.compareCalls, 1, "only the matching scratch target may reach overlay comparison");
  });

  test("compare_overlays exposes the deterministic global maxDivergenceLocation", { skip: PYTHON_SKIP }, () => {
    const result = runPython(COMPARATOR_LOCATION_HARNESS, [repositoryPath(BLENDER_TOOL)]);
    assert.equal("firstMaxDivergence" in result, false, JSON.stringify(result));
    assert.equal(result.maxDivergenceLocation.clipName, "later-global-maximum");
    assert.equal(result.maxDivergenceLocation.targetBone, "DEF-spine");
    assert.equal(result.maxDivergenceLocation.frameTime, 2);
    assert.ok(Math.abs(result.maxDivergenceLocation.angularDeviationDeg - 90) < 1e-9);
  });
});

describe("pose-pair render evidence", () => {
  test("render manifest paths resolve inside its supplied pose-pairs output root", () => {
    const outputRoot = "_workspace/current/qa/motion-repair-20260803/pose-pairs";
    const outputDirectory = repositoryPath(outputRoot);
    const manifest = readJson(`${outputRoot}/render-manifest.json`);
    assert.equal(manifest.pairs.length, 55, "the T4b render manifest preserves every actor/bone row");

    const renderedFiles = new Set();
    for (const pair of manifest.pairs) {
      for (const field of ["canonical", "actor"]) {
        const storedPath = pair[field];
        const resolvedPath = resolve(REPOSITORY_ROOT, storedPath);
        assert.ok(
          resolvedPath === outputDirectory || resolvedPath.startsWith(`${outputDirectory}/`),
          `${pair.actorId}/${pair.bone} ${field} must resolve inside ${outputRoot}, got ${storedPath}`,
        );
        assert.ok(statSync(resolvedPath).isFile(), `${pair.actorId}/${pair.bone} ${field} must exist: ${storedPath}`);
        renderedFiles.add(resolvedPath);
      }
    }
    assert.equal(renderedFiles.size, 110, "55 pose rows retain one canonical and one actor PNG each");
  });
});

// ---------------------------------------------------------------------------
// Bind-pose import contract.
//
// Blender's glTF importer defaults `guess_original_bind_pose` to True, which
// rebuilds armature rest from the inverse bind matrices instead of reading the
// authored `node.rotation` chain. Every Blender-side tool here measures rest
// pose, so a bare `import_scene.gltf(filepath=...)` call risks measuring a
// re-derived rig rather than the shipped one.
// scripts/measure-joint-articulation.py already documents and pins the flag;
// this regression holds the pipeline tools to the same contract statically, so
// a future bare call is caught without needing a Blender run.
// ---------------------------------------------------------------------------

const BIND_POSE_TOOLS = Object.freeze([
  `${TOOLS_DIR}/render-character-motion-contact-sheet-blender.py`,
  `${TOOLS_DIR}/derive-kinematic-bounds-blender.py`,
]);

/** Every `import_scene.gltf(...)` call site with its balanced argument text. */
function gltfImportCallSites(source) {
  const marker = "import_scene.gltf(";
  const sites = [];
  let cursor = source.indexOf(marker);
  while (cursor !== -1) {
    const open = cursor + marker.length - 1;
    let depth = 0;
    let end = open;
    while (end < source.length) {
      const character = source[end];
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          break;
        }
      }
      end += 1;
    }
    assert.ok(depth === 0 && end < source.length, `unbalanced import_scene.gltf( call at offset ${cursor}`);
    sites.push({ line: source.slice(0, cursor).split("\n").length, args: source.slice(open + 1, end) });
    cursor = source.indexOf(marker, end);
  }
  return sites;
}

describe("Blender-side tools import glTF without re-deriving armature rest", () => {
  test("every import_scene.gltf call in both Blender tools disables bind-pose guessing", () => {
    for (const relative of BIND_POSE_TOOLS) {
      const sites = gltfImportCallSites(readFileSync(repositoryPath(relative), "utf8"));
      assert.ok(sites.length >= 1, `${relative} must contain at least one import_scene.gltf call site`);
      const bare = sites.filter((site) => !/guess_original_bind_pose\s*=\s*False/.test(site.args));
      assert.deepEqual(
        bare.map((site) => site.line),
        [],
        `${relative}: import_scene.gltf call(s) on the listed line(s) must pass guess_original_bind_pose=False, `
          + "matching scripts/measure-joint-articulation.py; otherwise Blender rebuilds armature rest from the "
          + "inverse bind matrices instead of the authored node.rotation chain",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Semantic pose-pair render contract.
//
// The contract below is derived from the APPROVED evidence corpus
// `pose-pairs-semantic-v3/render-manifest.json`, whose digest is pinned in
// `scripts/repair-static-rest-pose.py` as APPROVED_EVIDENCE_MANIFEST_SHA256.
// That manifest is the specification: it was produced by the renderer these
// tests gate, so every field it carries must be reproducible.  It is read-only
// here and never regenerated -- rewriting it would break the pinned digest.
//
// The evidence shape these tests forbid is the schema-v1 one: rendering two
// DIFFERENT whole GLBs (target rig + actor) framed on the whole body, with the
// selected bone appearing only as a text caption.  A caption is not evidence.
// The semantic shape renders ONE actor twice -- PRE at its own rest, POST with
// the selected bone world-aligned to the certified target -- cropped to that
// bone, with each panel recording the orientation it actually rendered under.
// ---------------------------------------------------------------------------

const RENDER_TOOL = `${TOOLS_DIR}/render-character-motion-contact-sheet-blender.py`;
const SEMANTIC_V3 = "_workspace/current/qa/motion-repair-20260803/pose-pairs-semantic-v3";
const POSE_PAIR_TARGET_RIG = `${PIPELINE}/motion-bench/target-rig/human-command-boss-def-humanoid-v1.glb`;
const ACTORS_ROOT = "assets/motion/ingame/characters";
const RESIDUALS = "_workspace/current/qa/motion-repair-20260803/static-rest-residuals.json";

// Importer tolerance: every pass/fail and no-op decision in the manifest is
// governed by this bound, and it is recorded on every row.
const IMPORTER_TOLERANCE_DEG = 0.001;
const DEFAULT_CAMERA_DIRECTION = [0.48, -1.0, 0.12];
const BONE_LOCAL_CROP = "selected-bone-head-tail-and-direct-influence-vertices-pre-post";

const BLENDER_BIN = process.env.BLENDER_BIN ?? "/Applications/Blender.app/Contents/MacOS/Blender";
const BLENDER_SKIP = existsSync(BLENDER_BIN) ? false : `Blender is unavailable at ${BLENDER_BIN}`;

/**
 * The renderer refuses any path outside the repository root, so scratch input
 * and output cannot live in the OS temp directory.  `<repo>/tmp/` is gitignored;
 * this run's subtree is removed in `after()`.
 */
let posePairScratch;
function posePairScratchDir() {
  if (posePairScratch === undefined) {
    const parent = repositoryPath("tmp");
    mkdirSync(parent, { recursive: true });
    posePairScratch = mkdtempSync(join(parent, "pose-pairs-gate-"));
  }
  return posePairScratch;
}
after(() => {
  if (posePairScratch !== undefined) rmSync(posePairScratch, { recursive: true, force: true });
});

/** Repository-relative path of a file inside this run's scratch subtree. */
function scratchRelative(...parts) {
  return join(posePairScratchDir(), ...parts).slice(`${REPOSITORY_ROOT}/`.length);
}

/**
 * A residuals document carrying `rows`, reusing the real schema envelope.  The
 * `targetRigSha256` must match the real rig or the renderer's pre-flight hash
 * check rejects the run before anything is selected.
 */
function writeScratchResiduals(name, rows) {
  const real = readJson(RESIDUALS);
  const relative = scratchRelative(name);
  writeFileSync(
    repositoryPath(relative),
    JSON.stringify({
      schemaVersion: real.schemaVersion,
      kind: real.kind,
      blender: real.blender,
      orientationSpace: real.orientationSpace,
      localOrientationSpace: real.localOrientationSpace,
      renderRankingMetric: real.renderRankingMetric,
      numericGateMetric: real.numericGateMetric,
      targetRig: real.targetRig,
      targetRigSha256: real.targetRigSha256,
      rows,
    }, null, 2),
  );
  return relative;
}

function residualRow(actorId, bone, restResidualDeg, localRestResidualDeg) {
  return {
    actorId,
    bone,
    orientationSpace: "world",
    localOrientationSpace: "local",
    restResidualDeg,
    localRestResidualDeg,
  };
}

function runRenderTool(args) {
  return spawnSync(
    BLENDER_BIN,
    ["--background", "--factory-startup", "--python", repositoryPath(RENDER_TOOL), "--", ...args],
    { encoding: "utf8", cwd: REPOSITORY_ROOT },
  );
}

/**
 * Shortest-arc angle between two quaternions in degrees.  `abs(dot)` folds the
 * double cover; `rotation_difference().angle` does NOT take the shortest arc
 * and disagrees with the recorded evidence by up to 356 degrees.
 */
function quaternionAngleDeg(a, b) {
  const norm = (q) => Math.hypot(...q);
  const dot = Math.abs(a.reduce((sum, value, index) => sum + value * b[index], 0)) / (norm(a) * norm(b));
  return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

/**
 * Canonical key order, read from the approved evidence so there is one source
 * of truth for it.
 *
 * Key ORDER is load-bearing, not cosmetic: the manifest is serialised with
 * `json.dumps`, which preserves insertion order, and its digest is pinned in
 * `scripts/repair-static-rest-pose.py` as APPROVED_EVIDENCE_MANIFEST_SHA256.
 * Emitting the same fields in a different order yields the same parsed object
 * but a different digest -- moving one key flips dea668cc to d0301dcf, which
 * trips SPR_POLICY_HASH.  Field-presence assertions cannot see this, because
 * re-inserting an existing dict key keeps its ORIGINAL position, so a late
 * `entry["k"] = v` fix silently lands the key in the wrong slot.
 */
function canonicalKeyOrder(sample) {
  return {
    pair: Object.keys(sample),
    transformProvenance: Object.keys(sample.transformProvenance),
    boneLocalFraming: Object.keys(sample.boneLocalFraming),
    panel: Object.keys(sample.panels[0]),
  };
}

/**
 * Assert `actual` emits its keys in `canonical` relative order.  Keys absent
 * from `actual` are skipped (a failed row carries no measured provenance), and
 * keys outside `canonical` must trail rather than interleave.
 */
function assertKeyOrder(actual, canonical, label) {
  const keys = Object.keys(actual);
  const known = keys.filter((key) => canonical.includes(key));
  assert.deepEqual(
    known,
    canonical.filter((key) => keys.includes(key)),
    `${label}: keys must be emitted in the approved order; the manifest digest is byte-sensitive, so a `
      + "reordered key changes the hash pinned as APPROVED_EVIDENCE_MANIFEST_SHA256",
  );
  const firstUnknown = keys.findIndex((key) => !canonical.includes(key));
  if (firstUnknown !== -1) {
    assert.deepEqual(
      keys.slice(firstUnknown).filter((key) => canonical.includes(key)),
      [],
      `${label}: keys outside the approved set must trail, not interleave`,
    );
  }
}

/**
 * Field names the approved evidence writes as float literals even when the
 * value is integral -- `"passThreshold": 1.0`, not `1`.
 *
 * This distinction is invisible to every assertion in this file that works on
 * parsed JSON, because JavaScript has one number type: `JSON.parse('1')` and
 * `JSON.parse('1.0')` are the same value, so `assert.equal(x, 1.0)` passes for
 * both.  Python does distinguish them, and `json.dumps` writes `1` for an int
 * and `1.0` for a float.  A renderer that declared its threshold as int `1`
 * would emit a semantically identical manifest with different bytes, missing
 * any pinned digest while every value-level check still passed -- so the
 * literal form has to be asserted against the raw text.
 */
function integralFloatLiteralKeys(rawManifest) {
  return new Set(
    [...rawManifest.matchAll(/"(\w+)":\s*-?\d+\.0(?=[,\n\]])/g)].map((match) => match[1]),
  );
}

/** Fail if any `keys` field is written as a bare integer rather than a float. */
function assertFloatLiterals(rawManifest, keys, label) {
  const demoted = [...rawManifest.matchAll(/"(\w+)":\s*(-?\d+)(?=[,\n\]])/g)]
    .filter((match) => keys.has(match[1]))
    .map((match) => `${match[1]}: ${match[2]}`);
  assert.deepEqual(
    [...new Set(demoted)],
    [],
    `${label}: these fields are float literals in the approved evidence but were emitted as bare integers; `
      + "the digest is byte-sensitive, so an int-typed constant silently breaks the pin while every "
      + "parsed-value assertion still passes",
  );
}

/**
 * Exercise the renderer's argument validation without paying a Blender launch.
 * `bpy` is stubbed only so the module imports; every case below is refused
 * before any Blender call, so the stub is never actually driven.
 */
const ARG_VALIDATION_HARNESS = `
import contextlib
import importlib.util
import io
import json
import sys
import types
from pathlib import Path

TOOL = Path(sys.argv[1])
PROBES = json.loads(sys.argv[2])


def install_stub_bpy():
    bpy = types.ModuleType("bpy")
    bpy.ops = types.SimpleNamespace()
    bpy.context = types.SimpleNamespace()
    bpy.data = types.SimpleNamespace()
    bpy.app = types.SimpleNamespace(version_string="5.1.2", binary_path="/stub/Blender")
    bpy.types = types.SimpleNamespace(Scene=object, Object=object)
    sys.modules["bpy"] = bpy
    mathutils = types.ModuleType("mathutils")
    mathutils.Vector = tuple
    mathutils.Quaternion = tuple
    mathutils.Matrix = object
    sys.modules["mathutils"] = mathutils


install_stub_bpy()
spec = importlib.util.spec_from_file_location("render_contact_sheet", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

results = {}
for label, argv in PROBES.items():
    saved = sys.argv
    sys.argv = ["blender", "--"] + argv
    # argparse writes its own refusals to stderr; capture them so a genuine
    # validation refusal can be told apart from "unrecognized arguments".
    captured = io.StringIO()
    try:
        with contextlib.redirect_stderr(captured):
            results[label] = {"outcome": "returned", "code": tool.main()}
    except SystemExit as exit_request:
        results[label] = {"outcome": "SystemExit", "code": exit_request.code}
    except BaseException as error:  # noqa: BLE001 - the probe records any refusal
        results[label] = {"outcome": type(error).__name__, "message": str(error)}
    finally:
        sys.argv = saved
        results[label]["stderr"] = captured.getvalue()

print(json.dumps(results))
`;

describe("--camera-direction is validated and scoped to pose-pairs mode", () => {
  test("a camera direction outside pose-pairs mode is refused with a non-zero exit", { skip: BLENDER_SKIP }, () => {
    const rejected = runRenderTool([
      "--model", repositoryPath(`${ACTORS_ROOT}/guard/model.glb`),
      "--asset-id", "guard",
      "--out-dir", scratchRelative("camera-direction-contact-sheet"),
      "--camera-direction", "0.48,-1.0,0.12",
    ]);

    // Blender only propagates SystemExit: a bare `raise RuntimeError` from the
    // tool leaves the process status at 0, so the refusal would fail open.
    assert.notEqual(
      rejected.status,
      0,
      "--camera-direction outside --pose-pairs must exit non-zero; under Blender only a "
        + "non-zero SystemExit propagates, so a bare RuntimeError silently reports success",
    );
    // argparse's own "unrecognized arguments" also exits 2, which would pass a
    // naive status check while the flag does not exist at all.  The flag must be
    // registered and refused by an explicit mode check.
    assert.doesNotMatch(
      rejected.stderr,
      /unrecognized argument/,
      "--camera-direction must be a registered flag refused by an explicit mode check, "
        + "not an unknown argument rejected by argparse",
    );
    assert.match(
      rejected.stderr,
      /camera-direction/,
      `the refusal must name the offending flag on stderr, got: ${rejected.stderr}`,
    );
    assert.equal(
      existsSync(repositoryPath(scratchRelative("camera-direction-contact-sheet"))),
      false,
      "a refused run must not create its output directory",
    );
  });

  test("non-finite, mis-sized, non-numeric, and zero camera directions are refused", { skip: PYTHON_SKIP }, () => {
    const residuals = writeScratchResiduals("camera-direction-residuals.json", [
      residualRow("guard", "DEF-foot.L", 15.05661874166174, 15.056618741661838),
    ]);
    const baseArgs = [
      "--pose-pairs", residuals,
      "--target-rig", POSE_PAIR_TARGET_RIG,
      "--actors-root", ACTORS_ROOT,
      "--worst-n", "1",
      "--out", scratchRelative("camera-direction-refused"),
    ];
    const malformed = {
      twoComponents: "0.48,-1.0",
      fourComponents: "0.48,-1.0,0.12,0.0",
      notANumber: "0.48,nan,0.12",
      infinite: "0.48,inf,0.12",
      zeroVector: "0,0,0",
      nonNumeric: "a,b,c",
      empty: "",
    };
    const probes = Object.fromEntries(
      Object.entries(malformed).map(([label, value]) => [label, [...baseArgs, "--camera-direction", value]]),
    );
    const results = runPython(ARG_VALIDATION_HARNESS, [repositoryPath(RENDER_TOOL), JSON.stringify(probes)]);

    for (const label of Object.keys(malformed)) {
      const result = results[label];
      const detail = `${result.message ?? ""}\n${result.stderr ?? ""}`;
      const refused = result.outcome !== "returned" || result.code !== 0;
      assert.ok(
        refused,
        `--camera-direction "${malformed[label]}" must be refused, got ${JSON.stringify(result)}`,
      );
      // argparse rejects an UNREGISTERED flag with SystemExit(2) for every
      // value alike, which would satisfy the check above while no validation
      // exists at all.  The refusal has to come from the tool's own check.
      assert.doesNotMatch(
        detail,
        /unrecognized argument/,
        `the ${label} refusal must come from an explicit camera-direction check, not from argparse `
          + `rejecting an unregistered flag: ${JSON.stringify(result)}`,
      );
      assert.match(
        detail,
        /camera-direction/,
        `the ${label} refusal must name the offending flag, got ${JSON.stringify(result)}`,
      );
    }
    assert.equal(
      existsSync(repositoryPath(scratchRelative("camera-direction-refused"))),
      false,
      "camera-direction validation must run before any output directory is created",
    );
  });
});

// A single real-Blender run shared by the semantic assertions below.  Each
// Blender launch costs seconds, so one bounded run is reused rather than
// re-rendered per test.
//
// Two rows are selected, deliberately: one worst on the WORLD metric and one
// worst on the LOCAL metric.  The local row is not redundant -- it takes a
// different branch (`local-quaternion-delta`, resolving postLocalResidualDeg
// while postWorldResidualDeg stays non-zero) and it is the only row here whose
// residual is exactly zero, which is the shape the residuals input writes as a
// bare `0`.  A renderer that echoes that value through `json.dumps` re-emits
// `0` where the approved evidence has `0.0`.
let semanticRunCache;
function semanticPairRun() {
  if (semanticRunCache === undefined) {
    const residuals = writeScratchResiduals("semantic-residuals.json", [
      // Worst on the world metric: a 15.06-degree residual, large enough that
      // PRE and POST cannot be confused for one another.
      residualRow("guard", "DEF-foot.L", 15.05661874166174, 15.056618741661838),
      // Worst on the local metric, and zero on the world metric.
      residualRow("guard", "DEF-toe.L", 0, 15.05661267365437),
      // The self-target reference: its model SHA equals the target rig's, so it
      // must be excluded before selection rather than rendered against itself.
      residualRow("human-command-boss", "DEF-foot.L", 0, 0),
    ]);
    const outputRoot = scratchRelative("semantic-out");
    const cameraDirection = [0.5, -1.0, 0.25];
    const result = runRenderTool([
      "--pose-pairs", residuals,
      "--target-rig", POSE_PAIR_TARGET_RIG,
      "--actors-root", ACTORS_ROOT,
      "--worst-n", "2",
      "--out", outputRoot,
      "--camera-direction", cameraDirection.join(","),
    ]);
    const manifestPath = repositoryPath(join(outputRoot, "render-manifest.json"));
    const rawManifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : undefined;
    semanticRunCache = {
      result,
      outputRoot,
      cameraDirection,
      rawManifest,
      manifest: rawManifest === undefined ? undefined : JSON.parse(rawManifest),
    };
  }
  return semanticRunCache;
}

describe("a pose pair renders one actor twice, PRE and POST, cropped to the selected bone", () => {
  test("the run succeeds and records the semantic pair schema", { skip: BLENDER_SKIP }, () => {
    const { result, manifest, rawManifest, cameraDirection } = semanticPairRun();
    assert.equal(result.status, 0, `pose-pair render failed: ${result.stderr || result.stdout}`);
    assert.ok(manifest, "a successful run must write render-manifest.json");

    assert.equal(manifest.schemaVersion, 2, "the semantic pair evidence is schema 2");
    assert.equal(manifest.kind, "pose-pairs");
    assert.equal(manifest.passThreshold, 1.0, "pose-pair evidence is fail-closed: every selected pair must render");
    assert.equal(manifest.camera.boneLocalCrop, BONE_LOCAL_CROP);
    // The camera direction round-trips verbatim; it is normalised only for
    // camera placement, never rewritten in the evidence.
    assert.deepEqual(manifest.camera.direction, cameraDirection);

    // Byte-level, not value-level: an int-typed constant would satisfy every
    // assertion above and still emit `"passThreshold": 1` instead of `1.0`.
    assertFloatLiterals(
      rawManifest,
      integralFloatLiteralKeys(readFileSync(repositoryPath(`${SEMANTIC_V3}/render-manifest.json`), "utf8")),
      "rendered manifest",
    );

    // The self-target actor is excluded, so the two guard rows are selected.
    assert.equal(manifest.pairs.length, 2, "both guard rows are selected; the self-target is excluded");
    assert.deepEqual(
      manifest.pairs.map((row) => [row.bone, row.status]),
      [["DEF-foot.L", "passed"], ["DEF-toe.L", "passed"]],
      "ranked by the larger of the two metrics",
    );
    // Both rows sit inside both worst-2 lists here, so both carry both
    // reasons.  Reason SHAPES (world-only, local-only, both) and worst-N
    // truncation are covered by the selection probe below, which has enough
    // rows for truncation to bite; this run exists to render, not to rank.
    for (const row of manifest.pairs) {
      assert.deepEqual(
        row.selectionReasons.slice().sort(),
        ["localRestResidualDeg", "restResidualDeg"],
        `${row.bone} is inside both worst-2 lists`,
      );
    }
  });

  test("PRE and POST are the same actor under two different pose states", { skip: BLENDER_SKIP }, () => {
    const { manifest } = semanticPairRun();
    assert.ok(manifest, "a successful run must write render-manifest.json");
    const pair = manifest.pairs.find((row) => row.bone === "DEF-foot.L");
    const provenance = pair.transformProvenance;

    assert.equal(pair.panels.length, 2, "a semantic pair is exactly two panels");
    const [pre, post] = pair.panels;
    assert.equal(pre.state, "pre");
    assert.equal(post.state, "post");

    // One actor rendered twice.  The schema-v1 shape rendered the target rig as
    // the left panel, which would show a different model hash here.
    assert.equal(pre.actorModelSha256, pair.actorModelSha256);
    assert.equal(post.actorModelSha256, pair.actorModelSha256);
    assert.notEqual(
      pair.actorModelSha256,
      manifest.targetRigSha256,
      "both panels must render the ACTOR, never the target rig",
    );

    // Each panel records the orientation it actually rendered under, and the
    // two differ: that is what proves the bone was transformed between renders
    // rather than captioned.
    assert.deepEqual(pre.renderedSelectedWorldQuaternion, provenance.actorPreWorldQuaternion);
    assert.deepEqual(post.renderedSelectedWorldQuaternion, provenance.actorPostWorldQuaternion);
    const renderedDeltaDeg = quaternionAngleDeg(
      pre.renderedSelectedWorldQuaternion,
      post.renderedSelectedWorldQuaternion,
    );
    assert.ok(
      renderedDeltaDeg > 1,
      `PRE and POST must render under different orientations, got ${renderedDeltaDeg} degrees apart`,
    );
    // The load-bearing check.  `postWorldResidualDeg` is definitionally zero
    // after alignment and is not re-derived from the rendered quaternions --
    // 2*acos(|dot|) is ill-conditioned near identity and cannot resolve a
    // near-zero angle in float32 -- so it cannot, on its own, prove the pose
    // was applied.  Comparing the ACTUALLY RENDERED PRE->POST rotation against
    // the recorded delta can, and does: applying the delta in the bone's
    // parent-relative frame instead of world space leaves the recorded delta
    // describing a rotation the panels never underwent, which reads here as a
    // 2.7-degree disagreement (17.73 rendered vs 15.06 recorded).
    assert.ok(
      Math.abs(renderedDeltaDeg - pair.appliedDeltaDeg) < 1e-3,
      `the rendered PRE->POST rotation must equal the recorded applied delta, got ${renderedDeltaDeg} `
        + `vs ${pair.appliedDeltaDeg}`,
    );

    // Residuals stay in the rest-chain frame they are defined in -- the frame
    // `scripts/repair-static-rest-pose.py` gates on -- so POST resolves the
    // selected metric exactly, not merely to within tolerance.
    const postSelected = pair.visualizationMetric === "local" ? pair.postLocalResidualDeg : pair.postWorldResidualDeg;
    assert.equal(
      postSelected,
      0,
      `POST must resolve the ${pair.visualizationMetric} metric to zero, got ${postSelected}`,
    );
    assert.equal(provenance.importerMetricToleranceDeg, IMPORTER_TOLERANCE_DEG);
    assert.equal(provenance.parentTransformUntouched, true);
    assert.equal(provenance.descendantsInheritSelectedBoneTransform, true);
    assert.equal(provenance.originalMatrixUsedForBothPanels, false, "a non-zero residual row must apply a pose");
    assert.equal(pair.zeroResidualNoOp, false);

    // A freshly rendered row must be byte-compatible with the approved
    // evidence, not merely field-compatible: the digest is order-sensitive.
    const canonical = canonicalKeyOrder(readJson(`${SEMANTIC_V3}/render-manifest.json`).pairs[0]);
    assertKeyOrder(pair, canonical.pair, "rendered pair row");
    assertKeyOrder(provenance, canonical.transformProvenance, "rendered transformProvenance");
    assertKeyOrder(pair.boneLocalFraming, canonical.boneLocalFraming, "rendered boneLocalFraming");
    for (const panel of pair.panels) {
      assertKeyOrder(panel, canonical.panel, `rendered ${panel.state} panel`);
    }

    // Two distinct PNGs on disk, inside the supplied output root.
    const outputDirectory = repositoryPath(semanticPairRun().outputRoot);
    const bytes = pair.panels.map((panel) => {
      const resolved = resolve(REPOSITORY_ROOT, panel.path);
      assert.ok(
        resolved.startsWith(`${outputDirectory}/`),
        `${panel.state} panel must resolve inside the supplied output root, got ${panel.path}`,
      );
      assert.ok(statSync(resolved).isFile(), `${panel.state} panel must exist: ${panel.path}`);
      return readFileSync(resolved);
    });
    assert.ok(
      !bytes[0].equals(bytes[1]),
      "PRE and POST panels must differ: identical bytes mean the pose was never applied",
    );
  });

  test("the camera crops to the selected bone rather than framing the whole body", { skip: BLENDER_SKIP }, () => {
    const { manifest } = semanticPairRun();
    assert.ok(manifest, "a successful run must write render-manifest.json");
    const pair = manifest.pairs.find((row) => row.bone === "DEF-foot.L");
    const framing = pair.boneLocalFraming;

    assert.equal(framing.bone, pair.bone);
    assert.equal(framing.crop, BONE_LOCAL_CROP);
    assert.ok(framing.directInfluenceCount > 0, "the crop must include the bone's direct-influence vertices");
    // Head and tail in both states, plus every direct-influence vertex in both
    // states: the crop spans PRE and POST so neither state is clipped.
    assert.equal(
      framing.pointCount,
      2 * framing.directInfluenceCount + 4,
      "the crop must span head/tail and direct-influence vertices across BOTH pose states",
    );
    for (const axis of [0, 1, 2]) {
      assert.ok(
        framing.worldMinimum[axis] <= framing.worldMaximum[axis],
        `bone-local bounds must be ordered on axis ${axis}`,
      );
    }
    assert.ok(framing.cameraOrthoScale > 0);
    // A whole-body frame on this rig spans over a metre; a foot crop is far
    // tighter.  This is the numeric difference between the two evidence shapes.
    assert.ok(
      framing.cameraOrthoScale < 1,
      `a bone-local crop must be tighter than a whole-body frame, got ortho scale ${framing.cameraOrthoScale}`,
    );
  });

  test("a local-metric row resolves the local delta and leaves the world delta alone", { skip: BLENDER_SKIP }, () => {
    const { manifest } = semanticPairRun();
    assert.ok(manifest, "a successful run must write render-manifest.json");
    const pair = manifest.pairs.find((row) => row.bone === "DEF-toe.L");
    assert.ok(pair, "the local-metric row must be selected");

    // `local` is chosen only because a world delta would be degenerate here:
    // the world residual is already zero, so aligning on it would be a no-op
    // that renders two identical panels.
    assert.equal(pair.restResidualDeg, 0);
    assert.ok(pair.localRestResidualDeg > IMPORTER_TOLERANCE_DEG);
    assert.equal(pair.visualizationMetric, "local");
    assert.equal(pair.encoding, "local-quaternion-delta");
    assert.equal(pair.transformProvenance.encoding, "local-quaternion-delta");

    // A zero world residual is NOT a zero-residual no-op: the local metric is
    // still out of tolerance, so a pose is applied.
    assert.equal(pair.zeroResidualNoOp, false);
    assert.equal(pair.transformProvenance.originalMatrixUsedForBothPanels, false);
    assert.equal(pair.status, "passed");

    // The selected metric resolves; the unselected one is free to stay
    // non-zero, so asserting both would be wrong.
    assert.equal(pair.postLocalResidualDeg, 0, "POST must resolve the local metric");

    // Still a genuine two-state render.
    const rendered = quaternionAngleDeg(
      pair.panels[0].renderedSelectedWorldQuaternion,
      pair.panels[1].renderedSelectedWorldQuaternion,
    );
    assert.ok(rendered > 1, `PRE and POST must differ, got ${rendered} degrees`);
    assert.ok(
      Math.abs(rendered - pair.appliedDeltaDeg) < 1e-3,
      `rendered rotation ${rendered} must equal recorded delta ${pair.appliedDeltaDeg}`,
    );
  });
});

// A second bounded run: every selected bone is absent from the rigs, so each
// pair fails without paying a render.  This exercises selection, exclusion and
// the fail-closed exit in one launch.
let selectionRunCache;
function selectionRun() {
  if (selectionRunCache === undefined) {
    const residuals = writeScratchResiduals("selection-residuals.json", [
      residualRow("guard", "DEF-probe-world", 9.0, 0.0),
      residualRow("guard", "DEF-probe-local", 0.0, 8.0),
      residualRow("guard", "DEF-probe-mid", 5.0, 5.0),
      // Outside the top two on BOTH metrics, so union selection must drop it.
      residualRow("guard", "DEF-probe-tiny", 0.5, 0.5),
      // This actor's only row is below tolerance on both metrics, so it is
      // selected regardless and must take the zero-residual no-op path.
      residualRow("scout", "DEF-probe-zero", 0.0, 0.0),
      // Self-target reference: excluded by SHA before selection.
      residualRow("human-command-boss", "DEF-probe-self", 7.0, 7.0),
    ]);
    const outputRoot = scratchRelative("selection-out");
    const result = runRenderTool([
      "--pose-pairs", residuals,
      "--target-rig", POSE_PAIR_TARGET_RIG,
      "--actors-root", ACTORS_ROOT,
      "--worst-n", "2",
      "--out", outputRoot,
    ]);
    const manifestPath = repositoryPath(join(outputRoot, "render-manifest.json"));
    const rawManifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : undefined;
    selectionRunCache = {
      result,
      rawManifest,
      manifest: rawManifest === undefined ? undefined : JSON.parse(rawManifest),
    };
  }
  return selectionRunCache;
}

describe("pose-pair selection unions both residual metrics and excludes the self-target", () => {
  test("each actor contributes the union of its worst-N world and worst-N local bones", { skip: BLENDER_SKIP }, () => {
    const { manifest } = selectionRun();
    assert.ok(manifest, "a failed run must still write render-manifest.json before exiting non-zero");

    const guard = manifest.pairs
      .filter((pair) => pair.actorId === "guard")
      .sort((left, right) => left.rank - right.rank);
    assert.deepEqual(
      guard.map((pair) => pair.bone),
      ["DEF-probe-world", "DEF-probe-local", "DEF-probe-mid"],
      "selection is the union of both worst-N lists, ranked by the larger of the two metrics",
    );
    assert.deepEqual(guard.map((pair) => pair.rank), [1, 2, 3], "ranks are contiguous and 1-based");

    // Each row names which list(s) selected it -- a world-only bone, a
    // local-only bone, and one worst on both.
    assert.deepEqual(
      Object.fromEntries(guard.map((pair) => [pair.bone, pair.selectionReasons.slice().sort()])),
      {
        "DEF-probe-world": ["restResidualDeg"],
        "DEF-probe-local": ["localRestResidualDeg"],
        "DEF-probe-mid": ["localRestResidualDeg", "restResidualDeg"],
      },
    );
    // A local-only worst bone is invisible to a world-only ranking: this is the
    // row the pre-union selection silently dropped.
    assert.ok(
      guard.some((pair) => pair.bone === "DEF-probe-local"),
      "a bone worst only on the local metric must still be selected",
    );
    assert.equal(
      guard.some((pair) => pair.bone === "DEF-probe-tiny"),
      false,
      "worst-N truncation still applies to the union",
    );
  });

  test("the self-target reference is excluded by SHA and recorded with its derivation", { skip: BLENDER_SKIP }, () => {
    const { manifest } = selectionRun();
    assert.ok(manifest, "a failed run must still write render-manifest.json before exiting non-zero");

    assert.equal(
      manifest.pairs.some((pair) => pair.actorId === "human-command-boss"),
      false,
      "an actor whose model SHA equals the target rig's cannot be posed against itself",
    );
    assert.deepEqual(manifest.excludedReferences, [{
      actorId: "human-command-boss",
      actorModelSha256: manifest.targetRigSha256,
      reason: "self-target reference",
    }]);

    const derivation = manifest.derivation;
    assert.equal(derivation.kind, "actor-exclusion");
    assert.equal(derivation.sourceRowCount, 6, "the derivation counts every source row");
    assert.equal(derivation.candidateRowCount, 5, "one self-target row is excluded");
    assert.equal(derivation.candidateActorCount, 2);
    assert.equal(derivation.exclusionSelection, "existing actor model SHA-256 equals targetRigSha256");
    assert.deepEqual(derivation.excludedReferences, manifest.excludedReferences);

    assert.equal(manifest.residualActorCount, 3, "the residual count covers every actor in the source");
    assert.equal(manifest.candidateActorCount, 2, "the candidate count excludes the self-target");
    // Coverage is a candidate-only roster: an excluded actor must not appear at
    // all, rather than appearing as an unmet `false`.
    assert.deepEqual(
      Object.keys(manifest.actorCoverage).sort(),
      ["guard", "scout"],
      "actorCoverage is keyed over candidates only",
    );
  });

  test("one failed selected render fails the whole run closed", { skip: BLENDER_SKIP }, () => {
    const { result, manifest } = selectionRun();
    assert.ok(manifest, "a failed run must still write render-manifest.json before exiting non-zero");

    assert.equal(manifest.passThreshold, 1.0, "pose-pair evidence admits no partial credit");
    assert.ok(manifest.passedPairs < manifest.totalPairs, "this probe selects bones no rig carries");
    assert.equal(manifest.totalPairs, manifest.pairs.length);
    assert.notEqual(
      result.status,
      0,
      `an incomplete pose-pair run must exit non-zero, got ${result.status}: ${result.stdout}`,
    );
    // A failed row still has to emit its known keys in the approved order,
    // with `error` trailing rather than interleaved: the fill order of a
    // failure branch must not be able to perturb the layout.
    const canonical = canonicalKeyOrder(readJson(`${SEMANTIC_V3}/render-manifest.json`).pairs[0]);
    const failed = manifest.pairs.filter((row) => row.status !== "passed");
    assert.ok(failed.length > 0, "this probe selects bones no rig carries");
    for (const pair of failed) {
      assert.ok(pair.error, `${pair.actorId}/${pair.bone} must record why it failed`);
      assertKeyOrder(pair, canonical.pair, `failed row ${pair.actorId}/${pair.bone}`);
    }
  });

  test("worst-N and the zero-residual no-op rows are recorded", { skip: BLENDER_SKIP }, () => {
    const { manifest, rawManifest } = selectionRun();
    assert.ok(manifest, "a failed run must still write render-manifest.json before exiting non-zero");

    assert.equal(manifest.worstN, 2, "the manifest records the worst-N it was run with");

    // This probe's rows carry residuals of exactly zero, and the residuals
    // input writes those as a bare `0` -- which is how the real corpus writes
    // all 344 of its zeros.  A renderer that echoes the parsed value straight
    // back through `json.dumps` re-emits `0` where the approved evidence has
    // `0.0`.  Checking it here costs nothing: these rows never render.
    assertFloatLiterals(
      rawManifest,
      integralFloatLiteralKeys(readFileSync(repositoryPath(`${SEMANTIC_V3}/render-manifest.json`), "utf8")),
      "selection-probe manifest",
    );

    // `scout` carries a single row that is below tolerance on both metrics, so
    // it is selected anyway and must take the no-op path: no pose assignment,
    // the original matrix reused for both panels, recorded truthfully.
    assert.ok(Array.isArray(manifest.zeroNoOpCandidateRows));
    assert.deepEqual(
      manifest.zeroNoOpCandidateRows.map((row) => [row.actorId, row.bone, row.rank]),
      [["scout", "DEF-probe-zero", 1]],
      "a selected row below tolerance on both metrics is listed as a zero-residual no-op candidate",
    );
    for (const row of manifest.zeroNoOpCandidateRows) {
      assert.ok(row.restResidualDeg <= IMPORTER_TOLERANCE_DEG);
      assert.ok(row.localRestResidualDeg <= IMPORTER_TOLERANCE_DEG);
      const selected = manifest.pairs.find((pair) => pair.actorId === row.actorId && pair.bone === row.bone);
      assert.ok(selected, "every no-op candidate must be a selected row");
      // Decided from the source metrics before any import, so it is recorded
      // even on a row whose render later failed.
      assert.equal(selected.zeroResidualNoOp, true);
      // The provenance block records measured orientations, so it exists only
      // once the actor imported.  Assert its no-op shape only when present.
      if (selected.transformProvenance) {
        assert.equal(
          selected.transformProvenance.originalMatrixUsedForBothPanels,
          true,
          "a zero-residual row reuses the original matrix instead of assigning a pose",
        );
        assert.match(
          selected.transformProvenance.poseAssignment,
          /^skipped/,
          "a zero-residual row must record that pose assignment was skipped",
        );
      }
    }
  });
});

describe("the approved pose-pair evidence satisfies the semantic contract", () => {
  const manifest = readJson(`${SEMANTIC_V3}/render-manifest.json`);

  test("every row renders one actor twice and records both rendered orientations", () => {
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.passThreshold, 1.0);
    assert.equal(manifest.passedPairs, manifest.totalPairs, "fail-closed evidence has no unrendered selected pair");
    assert.equal(manifest.totalPairs, manifest.pairs.length);
    assert.deepEqual(manifest.camera.direction, DEFAULT_CAMERA_DIRECTION);
    assert.equal(manifest.camera.boneLocalCrop, BONE_LOCAL_CROP);

    for (const pair of manifest.pairs) {
      const label = `${pair.actorId}/${pair.bone}`;
      const provenance = pair.transformProvenance;
      assert.deepEqual(pair.panels.map((panel) => panel.state), ["pre", "post"], `${label} panels`);
      assert.deepEqual(pair.panels[0].renderedSelectedWorldQuaternion, provenance.actorPreWorldQuaternion, label);
      assert.deepEqual(pair.panels[1].renderedSelectedWorldQuaternion, provenance.actorPostWorldQuaternion, label);
      for (const panel of pair.panels) {
        assert.equal(panel.actorModelSha256, pair.actorModelSha256, `${label} renders one actor twice`);
      }
      assert.notEqual(pair.actorModelSha256, manifest.targetRigSha256, `${label} never renders the target rig`);

      // The rendered rotation is the recorded applied delta.
      const rendered = quaternionAngleDeg(provenance.actorPreWorldQuaternion, provenance.actorPostWorldQuaternion);
      assert.ok(Math.abs(rendered - pair.appliedDeltaDeg) < 1e-3, `${label} rendered delta ${rendered}`);
      assert.ok(pair.appliedDeltaQuaternion[3] >= 0, `${label} applied delta is canonicalised to w >= 0`);

      // `local` is chosen only when a world delta would be degenerate.
      const expected = pair.restResidualDeg <= IMPORTER_TOLERANCE_DEG
        && pair.localRestResidualDeg > IMPORTER_TOLERANCE_DEG
        ? "local"
        : "world";
      assert.equal(pair.visualizationMetric, expected, `${label} visualization metric`);
      assert.equal(pair.encoding, `${pair.visualizationMetric}-quaternion-delta`, label);
      const postSelected = pair.visualizationMetric === "local"
        ? pair.postLocalResidualDeg
        : pair.postWorldResidualDeg;
      assert.equal(postSelected, 0, `${label} POST must resolve the selected metric to zero`);

      assert.equal(
        pair.boneLocalFraming.pointCount,
        2 * pair.boneLocalFraming.directInfluenceCount + 4,
        `${label} crop spans both pose states`,
      );
    }
  });

  test("every row emits the approved key order, which the pinned digest depends on", () => {
    const canonical = canonicalKeyOrder(manifest.pairs[0]);
    // The digest covers bytes, not parsed structure, so the order has to be
    // uniform across every row -- one row out of step rewrites the hash.
    for (const pair of manifest.pairs) {
      const label = `${pair.actorId}/${pair.bone}`;
      assert.deepEqual(Object.keys(pair), canonical.pair, `${label} pair row key order`);
      assert.deepEqual(
        Object.keys(pair.transformProvenance),
        canonical.transformProvenance,
        `${label} transformProvenance key order`,
      );
      assert.deepEqual(
        Object.keys(pair.boneLocalFraming),
        canonical.boneLocalFraming,
        `${label} boneLocalFraming key order`,
      );
      for (const panel of pair.panels) {
        assert.deepEqual(Object.keys(panel), canonical.panel, `${label} ${panel.state} panel key order`);
      }
    }
    // `zeroResidualNoOp` is the row this pins hardest: it is seeded from the
    // source metrics before the render is attempted, and re-assigning an
    // existing dict key keeps its first position, so a late fix lands it in
    // the wrong slot while every field-presence check still passes.
    assert.equal(
      canonical.pair.indexOf("zeroResidualNoOp"),
      canonical.pair.indexOf("encoding") + 1,
      "zeroResidualNoOp follows encoding in the approved evidence",
    );
  });

  test("integral-valued fields are written as float literals, which the pinned digest depends on", () => {
    const raw = readFileSync(repositoryPath(`${SEMANTIC_V3}/render-manifest.json`), "utf8");
    const floatKeys = integralFloatLiteralKeys(raw);

    // The threshold is the one most easily declared as an int by mistake: it
    // is compared numerically everywhere and reads naturally as `1`.
    assert.ok(floatKeys.has("passThreshold"), "passThreshold is a float literal in the approved evidence");
    assert.match(raw, /"passThreshold": 1\.0(?=[,\n])/);
    for (const key of ["keyEnergy", "fillEnergy", "restResidualDeg", "postWorldResidualDeg"]) {
      assert.ok(floatKeys.has(key), `${key} is a float literal in the approved evidence`);
    }
    assertFloatLiterals(raw, floatKeys, "approved evidence");

    // Genuine integers must stay integers: this is a float-vs-int contract,
    // not a blanket "write everything with a decimal point" rule.
    assert.match(raw, /"resolution": \[\n\s+640,\n\s+640\n\s+\]/);
    for (const key of ["schemaVersion", "rank", "frame", "worstN", "pointCount", "totalPairs"]) {
      assert.equal(floatKeys.has(key), false, `${key} is a genuine integer and must not gain a decimal point`);
    }
  });

  test("the recorded selection is exactly the union of both worst-N residual metrics", () => {
    const residuals = readJson(RESIDUALS);
    const excluded = new Set(manifest.excludedReferences.map((reference) => reference.actorId));
    assert.ok(excluded.size > 0, "the self-target reference is excluded");

    const byActor = new Map();
    for (const row of residuals.rows) {
      if (excluded.has(row.actorId)) continue;
      if (!byActor.has(row.actorId)) byActor.set(row.actorId, []);
      byActor.get(row.actorId).push(row);
    }
    assert.equal(byActor.size, manifest.candidateActorCount);

    const worst = (rows, key) => rows
      .slice()
      .sort((left, right) => right[key] - left[key] || left.bone.localeCompare(right.bone))
      .slice(0, manifest.worstN);

    const expected = [];
    for (const [actorId, rows] of [...byActor].sort((left, right) => left[0].localeCompare(right[0]))) {
      const reasons = new Map();
      for (const row of worst(rows, "restResidualDeg")) reasons.set(row.bone, ["restResidualDeg"]);
      for (const row of worst(rows, "localRestResidualDeg")) {
        const existing = reasons.get(row.bone);
        if (existing) existing.push("localRestResidualDeg");
        else reasons.set(row.bone, ["localRestResidualDeg"]);
      }
      const larger = (bone) => {
        const row = rows.find((candidate) => candidate.bone === bone);
        return Math.max(row.restResidualDeg, row.localRestResidualDeg);
      };
      [...reasons.keys()]
        .sort((left, right) => larger(right) - larger(left) || left.localeCompare(right))
        .forEach((bone, index) => expected.push({ actorId, bone, rank: index + 1, reasons: reasons.get(bone) }));
    }

    const actual = manifest.pairs
      .map((pair) => ({
        actorId: pair.actorId,
        bone: pair.bone,
        rank: pair.rank,
        reasons: pair.selectionReasons,
      }))
      .sort((left, right) => left.actorId.localeCompare(right.actorId) || left.rank - right.rank);

    assert.deepEqual(actual, expected, "the approved evidence is reproduced by the union selection rule");
    assert.deepEqual(
      manifest.zeroNoOpCandidateRows,
      [],
      "no selected row in the approved corpus is below tolerance on both metrics",
    );
  });
});
