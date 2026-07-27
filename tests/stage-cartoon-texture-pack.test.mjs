import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.env.PYTHON ?? "python3";
const PIPELINE_ROOT = "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline";
const PIPELINE_ROOT_PATH = resolve(ROOT, PIPELINE_ROOT);

const AUDIT_PATH = resolve(PIPELINE_ROOT_PATH, "all-mesh-texture-candidates-v2", "audit.json");
const AUDIT_ROOT = resolve(PIPELINE_ROOT_PATH, "all-mesh-texture-candidates-v2");
const CANDIDATE_SOURCE_ROOT = resolve(PIPELINE_ROOT_PATH, "runtime-candidates", "cartoon-texture");
const COMMANDER_SOURCE = resolve(CANDIDATE_SOURCE_ROOT, "glb", "dusk-warden.glb");
const RUNTIME_ROOT = resolve(ROOT, "assets", "images", "battle", "glb");

const MANIFEST_NAME = "cartoon-texture-pack.manifest.json";
const GENERATOR = "scripts/stage-cartoon-texture-pack.py";
const SCHEMA_VERSION = 1;
const RIGHTS_RECEIPT = "candidate-only-no-promotion-pending-runtime-rights-review";
const RUNTIME_RECEIPT = "glb-embedding-complete-animation-and-armature-preserved-browser-fallback-pending";

const EXPECTED_CATEGORY_COUNTS = {
  bosses: 10,
  commander: 1,
  companions: 9,
  enemies: 4,
  previs: 1,
  props: 13,
  terrain: 10,
  vfx: 9,
};
const EXPECTED_TOTAL = 57;
const SHARED_TEXTURE_POLICY = "shared-abyssal-toon-surface-v2";
const COMMANDER_TEXTURE_POLICY = "commander-specific-cartoon-atlas";
const REQUIRED_SIDE_CAR_FIELDS = [
  "schemaVersion",
  "source",
  "generator",
  "output",
  "rightsReceipt",
  "runtimeReceipt",
  "runtimeEligible",
  "sourceMeshUnmodified",
  "animationPreserved",
  "texturePolicy",
  "runtimeSource",
  "runtimeSourceSha256",
  "outputSha256",
];

function asPosix(path) {
  return path.replace(/\\/gu, "/");
}

function hashPath(path) {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function parseGlbJson(buffer, label) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  assert.ok(bytes.length >= 20, `${label}: truncated GLB`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${label}: invalid GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: expected glTF 2.0`);

  let offset = 12;
  let json;
  while (offset < bytes.length) {
    assert.ok(offset + 8 <= bytes.length, `${label}: truncated GLB chunk header`);
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;

    assert.ok(chunkEnd <= bytes.length, `${label}: truncated GLB chunk body`);
    if (type === 0x4e4f534a) {
      assert.equal(json, undefined, `${label}: multiple GLB JSON chunks`);
      const payload = bytes.subarray(chunkStart, chunkEnd);
      json = JSON.parse(payload.toString("utf8").replace(/[\u0000 ]+$/gu, ""));
    }
    offset = chunkEnd;
  }

  assert.ok(json, `${label}: GLB had no JSON chunk`);
  return json;
}

function assertEmbeddedBaseAndNormal(json, label) {
  const materials = json.materials ?? [];
  assert.ok(Array.isArray(materials), `${label}: materials must be an array`);
  const textures = json.textures ?? [];
  const images = json.images ?? [];
  assert.ok(Array.isArray(textures), `${label}: textures must be an array`);
  assert.ok(Array.isArray(images), `${label}: images must be an array`);

  for (let index = 0; index < materials.length; index += 1) {
    const material = materials[index];
    assert.ok(material && typeof material === "object", `${label}: material #${index} must be an object`);

    const pbr = material.pbrMetallicRoughness;
    assert.ok(pbr && typeof pbr === "object", `${label}: material #${index} missing pbrMetallicRoughness`);
    const baseTexture = pbr.baseColorTexture;
    const normalTexture = material.normalTexture;

    assert.ok(baseTexture && typeof baseTexture === "object", `${label}: material #${index} missing baseColorTexture`);
    assert.ok(normalTexture && typeof normalTexture === "object", `${label}: material #${index} missing normalTexture`);
    assert.equal(typeof baseTexture.index, "number", `${label}: material #${index} baseColorTexture index must be a number`);
    assert.equal(typeof normalTexture.index, "number", `${label}: material #${index} normalTexture index must be a number`);

    for (const textureIndex of [baseTexture.index, normalTexture.index]) {
      const texture = textures[textureIndex];
      assert.ok(texture && typeof texture === "object", `${label}: texture #${textureIndex} must be an object`);
      const source = texture.source;
      assert.ok(typeof source === "number", `${label}: texture #${textureIndex} must reference an image source`);
      const image = images[source];
      assert.ok(image && typeof image === "object", `${label}: image #${source} must be an object`);
      if (Object.hasOwn(image, "uri")) {
        assert.ok(typeof image.uri === "string", `${label}: image #${source}.uri must be string`);
        assert.ok(image.uri.startsWith("data:"), `${label}: image #${source} must be embedded (data URI)`);
      }
      assert.ok(Object.hasOwn(image, "bufferView") || Object.hasOwn(image, "uri"), `${label}: image #${source} must be embedded`);
    }
  }
}

function hasEmbeddedBaseAndNormal(path, label) {
  try {
    const glb = parseGlbJson(readFileSync(path), label);
    assertEmbeddedBaseAndNormal(glb, label);
    return true;
  } catch {
    return false;
  }
}

function runScript(args, { allowFailure = false } = {}) {
  const result = spawnSync(PYTHON, ["scripts/stage-cartoon-texture-pack.py", ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined, result.error?.message);
  if (!allowFailure) {
    assert.equal(result.status, 0, `${result.stderr}${result.stdout}`.trim() || "script returned non-zero status");
  }
  return result;
}

function runScriptJson(args, options = {}) {
  const result = runScript(args, options);
  assert.equal(result.status, 0, `${result.stderr}${result.stdout}`.trim() || "script returned non-zero status");
  return JSON.parse(result.stdout);
}

function setFromRows(rows, selector) {
  const values = rows.map(selector);
  values.sort();
  return values;
}

function makeCounts(rows, selector) {
  const counts = {};
  for (const row of rows) {
    const key = selector(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertCategoryCounts(counts) {
  assert.equal(Object.keys(counts).length, Object.keys(EXPECTED_CATEGORY_COUNTS).length);
  for (const [category, expectedCount] of Object.entries(EXPECTED_CATEGORY_COUNTS)) {
    assert.equal(counts[category], expectedCount, `category count mismatch for ${category}`);
  }
}

async function copyFixtureTree(src, dst) {
  await cp(src, dst, { recursive: true });
}

const BASE_INPUTS_PRESENT = [
  existsSync(AUDIT_PATH),
  existsSync(CANDIDATE_SOURCE_ROOT),
  existsSync(AUDIT_ROOT),
  existsSync(RUNTIME_ROOT),
  existsSync(COMMANDER_SOURCE),
].every(Boolean);

const COMMANDER_SOURCE_HAS_TEXTURES = BASE_INPUTS_PRESENT && hasEmbeddedBaseAndNormal(COMMANDER_SOURCE, "commander candidate");
const STAGE_INPUTS_PRESENT = BASE_INPUTS_PRESENT && COMMANDER_SOURCE_HAS_TEXTURES;

test("stage-cartoon-texture-pack fails closed when commander source is missing", { skip: !BASE_INPUTS_PRESENT }, async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "stage-cartoon-texture-pack-"));
  try {
    const tempPipelineRoot = resolve(tempRoot, PIPELINE_ROOT);
    const tempV2Root = resolve(tempPipelineRoot, "all-mesh-texture-candidates-v2");
    const tempCandidateSourceRoot = resolve(tempPipelineRoot, "runtime-candidates", "cartoon-texture");
    const tempCandidateRoot = resolve(tempCandidateSourceRoot, "glb");
    const tempAudit = resolve(tempV2Root, "audit.json");
    const missingCommanderSource = resolve(tempCandidateRoot, "dusk-warden.glb");

    await copyFixtureTree(resolve(ROOT, PIPELINE_ROOT, "all-mesh-texture-candidates-v2"), tempV2Root);
    await copyFixtureTree(CANDIDATE_SOURCE_ROOT, tempCandidateSourceRoot);
    await rm(resolve(tempCandidateRoot, MANIFEST_NAME), { force: true });

    await rm(missingCommanderSource, { force: true });

    const result = runScript(
      [
        "--repo-root",
        tempRoot,
        "--runtime-root",
        RUNTIME_ROOT,
        "--audit",
        tempAudit,
        "--candidate-root",
        tempCandidateRoot,
        "--v2-root",
        tempV2Root,
        "--commander-source",
        missingCommanderSource,
        "--manifest-name",
        MANIFEST_NAME,
      ],
      { allowFailure: true },
    );

    assert.equal(result.status, 1);
    const output = `${result.stdout}${result.stderr}`;
    assert.ok(output.includes("commander source not found"), output);
    assert.equal(existsSync(resolve(tempCandidateRoot, MANIFEST_NAME)), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("stage-cartoon-texture-pack stages all v2 assets and validates manifest and sidecars", { skip: !STAGE_INPUTS_PRESENT }, async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "stage-cartoon-texture-pack-"));
  try {
    const tempPipelineRoot = resolve(tempRoot, PIPELINE_ROOT);
    const tempV2Root = resolve(tempPipelineRoot, "all-mesh-texture-candidates-v2");
    const tempCandidateSourceRoot = resolve(tempPipelineRoot, "runtime-candidates", "cartoon-texture");
    const tempCandidateRoot = resolve(tempCandidateSourceRoot, "glb");
    const tempAudit = resolve(tempV2Root, "audit.json");
    const tempCommanderSource = resolve(tempCandidateRoot, "dusk-warden.glb");

    await copyFixtureTree(resolve(ROOT, PIPELINE_ROOT, "all-mesh-texture-candidates-v2"), tempV2Root);
    await copyFixtureTree(CANDIDATE_SOURCE_ROOT, tempCandidateSourceRoot);

    const sourceAudit = JSON.parse(await readFile(tempAudit, "utf8"));
    assert.equal(sourceAudit.schemaVersion, 2);
    const auditRows = sourceAudit.rows;
    assert.ok(Array.isArray(auditRows), "audit rows must be an array");
    assert.equal(auditRows.length, EXPECTED_TOTAL);

    const auditRowsByRelative = new Map();
    for (const row of auditRows) {
      assert.equal(typeof row.relativePath, "string", "audit row missing relativePath");
      auditRowsByRelative.set(row.relativePath, row);
    }

    const expectedRelativeRows = setFromRows(auditRows, (row) => row.relativePath);
    const baselineRuntimeHashes = new Map();

    for (const row of auditRows) {
      const runtimePath = resolve(RUNTIME_ROOT, row.relativePath);
      assert.equal(existsSync(runtimePath), true, `runtime source missing: ${row.relativePath}`);
      baselineRuntimeHashes.set(row.relativePath, hashPath(runtimePath));
    }

    const commonArgs = [
      "--repo-root",
      tempRoot,
      "--runtime-root",
      RUNTIME_ROOT,
      "--audit",
      tempAudit,
      "--candidate-root",
      tempCandidateRoot,
      "--v2-root",
      tempV2Root,
      "--commander-source",
      tempCommanderSource,
      "--manifest-name",
      MANIFEST_NAME,
    ];

    const stagePayload = runScriptJson(commonArgs);
    assert.equal(stagePayload.rows, EXPECTED_TOTAL);
    assert.ok(stagePayload.manifestPath.startsWith(tempRoot));

    const manifestPath = resolve(tempCandidateRoot, MANIFEST_NAME);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(manifest.schemaVersion, SCHEMA_VERSION);
    assert.equal(manifest.generatedBy, GENERATOR);
    assert.equal(manifest.rowCount, EXPECTED_TOTAL);
    assert.deepEqual(setFromRows(manifest.rows, (row) => row.relativePath), expectedRelativeRows);

    const categoryCounts = makeCounts(manifest.rows, (row) => row.category);
    assertCategoryCounts(categoryCounts);

    const observedRelativeRows = new Set();
    const outputAndSidecarHashes = new Map();

    for (const row of manifest.rows) {
      assert.equal(row.runtimeEligible, false);
      assert.equal(typeof row.materialCount, "number");
      assert.equal(typeof row.textureCount, "number");
      assert.equal(typeof row.animationCount, "number");
      assert.equal(row.category, row.relativePath.split("/").at(0));
      assert.equal(observedRelativeRows.has(row.relativePath), false);
      observedRelativeRows.add(row.relativePath);

      const auditRow = auditRowsByRelative.get(row.relativePath);
      assert.ok(auditRow, `audit missing row for ${row.relativePath}`);

      const expectedStagedSource = row.relativePath === "commander/dusk-warden.glb"
        ? tempCommanderSource
        : asPosix(realpathSync(resolve(tempRoot, auditRow.outputPath)));
      const expectedRuntimeSource = asPosix(realpathSync(resolve(RUNTIME_ROOT, row.relativePath)));
      const expectedOutputPath = asPosix(resolve(tempCandidateRoot, row.relativePath));
      const expectedPolicy = row.category === "commander" ? COMMANDER_TEXTURE_POLICY : SHARED_TEXTURE_POLICY;

      assert.equal(row.stagedSource, expectedStagedSource);
      assert.equal(row.runtimeSource, expectedRuntimeSource);
      assert.equal(row.outputPath, expectedOutputPath);
      assert.equal(row.sourceSha256, hashPath(row.stagedSource));
      assert.equal(row.outputSha256, hashPath(row.outputPath));

      const sidecarPath = row.outputPath.replace(/\.glb$/u, ".provenance.json");
      const sidecar = JSON.parse(await readFile(sidecarPath, "utf8"));
      for (const field of REQUIRED_SIDE_CAR_FIELDS) {
        assert.ok(Object.hasOwn(sidecar, field), `sidecar for ${row.relativePath} missing ${field}`);
      }
      assert.equal(sidecar.schemaVersion, SCHEMA_VERSION);
      assert.equal(sidecar.generator, GENERATOR);
      assert.equal(sidecar.rightsReceipt, RIGHTS_RECEIPT);
      assert.equal(sidecar.runtimeReceipt, RUNTIME_RECEIPT);
      assert.equal(sidecar.runtimeEligible, false);
      assert.equal(sidecar.sourceMeshUnmodified, true);
      assert.equal(sidecar.animationPreserved, true);
      assert.equal(sidecar.source, expectedStagedSource);
      assert.equal(sidecar.output, expectedOutputPath);
      assert.equal(sidecar.texturePolicy, expectedPolicy);
      assert.equal(sidecar.runtimeSource, expectedRuntimeSource);
      assert.equal(sidecar.runtimeSourceSha256, row.runtimeSourceSha256);
      assert.equal(sidecar.runtimeSourceSha256, hashPath(row.runtimeSource));
      assert.equal(sidecar.outputSha256, row.outputSha256);

      const outputGlb = parseGlbJson(readFileSync(row.outputPath), row.relativePath);
      assertEmbeddedBaseAndNormal(outputGlb, row.relativePath);

      outputAndSidecarHashes.set(row.outputPath, hashPath(row.outputPath));
      outputAndSidecarHashes.set(sidecarPath, hashPath(sidecarPath));
    }

    assert.deepEqual([...observedRelativeRows].sort(), expectedRelativeRows);

    for (const [relativePath, baselineHash] of baselineRuntimeHashes.entries()) {
      const runtimePath = resolve(RUNTIME_ROOT, relativePath);
      assert.equal(hashPath(runtimePath), baselineHash, `runtime bytes changed for ${relativePath}`);
    }

    const manifestHash = hashPath(manifestPath);
    const checkPayload = runScriptJson(["--check", ...commonArgs]);
    assert.equal(checkPayload.rowCount, EXPECTED_TOTAL);
    assertCategoryCounts(checkPayload.categories);

    assert.equal(hashPath(manifestPath), manifestHash);
    for (const [path, expectedHash] of outputAndSidecarHashes.entries()) {
      assert.equal(hashPath(path), expectedHash);
    }

    const staleRelativePath = manifest.rows[0].relativePath;
    const staleSidecarPath = manifest.rows[0].outputPath.replace(/\.glb$/u, ".provenance.json");
    const staleManifest = JSON.parse(JSON.stringify(manifest));
    staleManifest.rows[0].runtimeSourceSha256 = "0".repeat(64);
    const staleSidecar = JSON.parse(await readFile(staleSidecarPath, "utf8"));
    staleSidecar.runtimeSourceSha256 = "0".repeat(64);
    await writeFile(manifestPath, `${JSON.stringify(staleManifest, null, 2)}\n`, "utf8");
    await writeFile(staleSidecarPath, `${JSON.stringify(staleSidecar, null, 2)}\n`, "utf8");

    const staleResult = runScript(["--check", ...commonArgs], { allowFailure: true });
    assert.equal(staleResult.status, 1);
    assert.ok(
      `${staleResult.stdout}${staleResult.stderr}`.includes(
        `runtime GLB changed since staging for ${staleRelativePath}`,
      ),
      `${staleResult.stdout}${staleResult.stderr}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
