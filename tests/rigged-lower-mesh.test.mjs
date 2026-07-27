import assert from "node:assert/strict";
import test from "node:test";
import { createHash, } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.env.PYTHON ?? "python3";
const SCRIPT = "scripts/bind-static-lower-mesh.py";
const MANIFEST = resolve(
  ROOT,
  "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline",
  "runtime-candidates/rigged-lower-mesh/rigged-lower-mesh.manifest.json",
);

const EXPECTED_CHARACTERS = 24;
const EXPECTED_BOUND = 19;
const MIN_DISPLACEMENT = 0.02;
const REQUIRED_SIDECAR_FIELDS = [
  "schemaVersion",
  "source",
  "generator",
  "output",
  "outputSha256",
  "runtimeSource",
  "runtimeSourceSha256",
  "rightsReceipt",
  "runtimeReceipt",
  "runtimeEligible",
  "boundLowerMeshMotion",
];

function parseGlbJson(path) {
  const bytes = readFileSync(path);
  assert.ok(bytes.length >= 20, `${path}: truncated GLB`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${path}: invalid GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${path}: expected glTF 2.0`);

  let offset = 12;
  let json;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    assert.ok(end <= bytes.length, `${path}: truncated GLB chunk`);
    if (type === 0x4e4f534a) {
      json = JSON.parse(bytes.subarray(start, end).toString("utf8").replace(/[\u0000 ]+$/u, ""));
    }
    offset = end;
  }
  assert.ok(json, `${path}: GLB has no JSON chunk`);
  return json;
}

function primitives(json) {
  const found = [];
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue;
    for (const primitive of json.meshes[node.mesh].primitives ?? []) {
      found.push({ node, primitive });
    }
  }
  return found;
}

function triangleCount(json) {
  return primitives(json).reduce((total, { primitive }) => {
    const indices = primitive.indices;
    const accessor = json.accessors[indices ?? primitive.attributes.POSITION];
    return total + Math.floor(accessor.count / 3);
  }, 0);
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const MANIFEST_PRESENT = existsSync(MANIFEST);

test("bind-static-lower-mesh --check passes on the staged pack", { skip: !MANIFEST_PRESENT }, () => {
  const result = spawnSync(PYTHON, [SCRIPT, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.characters, EXPECTED_CHARACTERS);
  assert.equal(payload.bound, EXPECTED_BOUND);
  assert.ok(
    payload.minDisplacement >= MIN_DISPLACEMENT,
    `bound lower meshes must move: ${payload.minDisplacement}`,
  );
});

test("every bound character animates as one skinned mesh", { skip: !MANIFEST_PRESENT }, async (t) => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  assert.equal(manifest.characterCount, EXPECTED_CHARACTERS);
  assert.equal(manifest.boundCount, EXPECTED_BOUND);
  assert.equal(manifest.alreadyFullySkinnedCount, EXPECTED_CHARACTERS - EXPECTED_BOUND);
  assert.equal(manifest.runtimeEligible, false);

  const bound = manifest.rows.filter((row) => row.action === "bind");
  assert.equal(bound.length, EXPECTED_BOUND);

  for (const row of bound) {
    await t.test(row.relativePath, async () => {
      const runtimePath = resolve(ROOT, row.runtimeSource);
      const candidatePath = resolve(ROOT, row.outputPath);
      assert.equal(existsSync(candidatePath), true, "candidate GLB missing");

      // The runtime lane stays byte-identical to what staging measured.
      assert.equal(hashFile(runtimePath), row.runtimeSourceSha256, "runtime GLB drifted");

      const source = parseGlbJson(runtimePath);
      const candidate = parseGlbJson(candidatePath);
      const assetId = row.assetId;

      const sourceNodeNames = (source.nodes ?? []).map((node) => node.name);
      assert.ok(
        sourceNodeNames.includes(`${assetId}_pedestal`),
        "runtime asset should still carry the unbound lower mesh",
      );

      const candidateNodeNames = (candidate.nodes ?? []).map((node) => node.name);
      assert.equal(
        candidateNodeNames.includes(`${assetId}_pedestal`),
        false,
        "candidate must not keep a separate static lower node",
      );

      assert.equal(candidate.meshes.length, 1, "candidate must expose a single mesh");
      assert.equal(candidate.skins?.length, 1, "candidate must expose a single skin");
      assert.equal(
        triangleCount(candidate),
        triangleCount(source),
        "join must preserve triangle count",
      );
      assert.deepEqual(
        (candidate.animations ?? []).map((clip) => clip.name).sort(),
        (source.animations ?? []).map((clip) => clip.name).sort(),
        "animation library must survive the join",
      );

      for (const { node, primitive } of primitives(candidate)) {
        assert.ok(node.skin !== undefined, `${node.name}: node lost its skin binding`);
        assert.ok(primitive.attributes.JOINTS_0 !== undefined, `${node.name}: primitive is unskinned`);
        assert.ok(primitive.attributes.TEXCOORD_0 !== undefined, `${node.name}: primitive lost UV0`);
        const material = candidate.materials[primitive.material];
        assert.ok(material?.pbrMetallicRoughness?.baseColorTexture, `${node.name}: no base color texture`);
        assert.ok(material?.normalTexture, `${node.name}: no normal texture`);
      }

      const sidecar = JSON.parse(
        await readFile(candidatePath.replace(/\.glb$/u, ".provenance.json"), "utf8"),
      );
      for (const field of REQUIRED_SIDECAR_FIELDS) {
        assert.ok(Object.hasOwn(sidecar, field), `sidecar missing ${field}`);
      }
      assert.equal(sidecar.runtimeEligible, false);
      assert.equal(sidecar.outputSha256, hashFile(candidatePath));
      assert.equal(sidecar.runtimeSourceSha256, row.runtimeSourceSha256);
      assert.ok(
        sidecar.boundLowerMeshMotion.maxDisplacement >= MIN_DISPLACEMENT,
        `bound lower mesh stayed static: ${sidecar.boundLowerMeshMotion.maxDisplacement}`,
      );
    });
  }
});

test("fully skinned characters are left untouched", { skip: !MANIFEST_PRESENT }, async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const passthrough = manifest.rows.filter((row) => row.action === "already-fully-skinned");
  assert.equal(passthrough.length, EXPECTED_CHARACTERS - EXPECTED_BOUND);
  for (const row of passthrough) {
    assert.equal(row.outputPath, null, `${row.relativePath}: no candidate should be produced`);
    assert.equal(row.staticLowerMeshPresent, false);
    const json = parseGlbJson(resolve(ROOT, row.runtimeSource));
    assert.equal(
      (json.nodes ?? []).some((node) => node.name === `${row.assetId}_pedestal`),
      false,
    );
  }
});
