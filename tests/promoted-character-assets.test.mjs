import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.env.PYTHON ?? "python3";
const SCRIPT = "scripts/promote-character-assets.py";
const PROVENANCE = resolve(ROOT, "assets/images/battle/glb/character-build-provenance.json");
const COMMANDER = "assets/images/battle/glb/commander/dusk-warden.glb";

const EXPECTED_PROMOTED = 24;
const MIN_HALF_TRAVEL = 0.004;
const BALANCED_RATIO = 0.25;

function parseGlbJson(path) {
  const bytes = readFileSync(path);
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

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("promote-character-assets --check passes on the runtime lane", () => {
  const result = spawnSync(PYTHON, [SCRIPT, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.promoted, EXPECTED_PROMOTED);
  assert.deepEqual(payload.excluded, []);
});

test("every promoted character ships one skinned mesh with no frozen lower half", async (t) => {
  const provenance = JSON.parse(await readFile(PROVENANCE, "utf8"));
  assert.equal(provenance.assetCount, EXPECTED_PROMOTED);
  assert.deepEqual(provenance.excludedAssetIds, []);
  assert.deepEqual(provenance.pipeline, [
    "scripts/bind-static-lower-mesh.py",
    "scripts/author-wholebody-clips-blender.py",
  ]);

  const assets = Object.values(provenance.assets);
  assert.equal(assets.length, EXPECTED_PROMOTED);

  for (const asset of assets) {
    await t.test(asset.outputPath, () => {
      const runtimePath = resolve(ROOT, asset.outputPath);
      assert.equal(existsSync(runtimePath), true, "promoted runtime asset missing");
      assert.equal(hashFile(runtimePath), asset.outputSha256, "runtime bytes drifted from the build record");

      const json = parseGlbJson(runtimePath);
      const assetId = asset.outputPath.split("/").at(-1).replace(/\.glb$/u, "");
      const nodeNames = (json.nodes ?? []).map((node) => node.name);
      assert.equal(
        nodeNames.includes(`${assetId}_pedestal`),
        false,
        "the unskinned lower mesh must not ship any more",
      );
      assert.equal(json.meshes.length, 1, "a promoted character is one mesh");
      assert.equal(json.skins?.length, 1, "a promoted character is one skin");

      for (const node of json.nodes ?? []) {
        if (node.mesh === undefined) continue;
        assert.ok(node.skin !== undefined, `${node.name}: mesh node is not skinned`);
        for (const primitive of json.meshes[node.mesh].primitives ?? []) {
          assert.ok(primitive.attributes.JOINTS_0 !== undefined, `${node.name}: primitive is unskinned`);
          assert.ok(primitive.attributes.TEXCOORD_0 !== undefined, `${node.name}: primitive lost UV0`);
          const material = json.materials[primitive.material];
          assert.ok(material?.pbrMetallicRoughness?.baseColorTexture, `${node.name}: no base colour texture`);
          assert.ok(material?.normalTexture, `${node.name}: no normal texture`);
        }
      }

      assert.deepEqual(
        (json.animations ?? []).map((clip) => clip.name).sort(),
        [...asset.runtimeContract.animationNames].sort(),
        "clip library drifted from the build record",
      );

      assert.ok(Array.isArray(asset.clipBalance) && asset.clipBalance.length > 0, "no clip evidence");
      for (const clip of asset.clipBalance) {
        assert.ok(clip.upperTravel > 0, `${clip.clip}: upper body never moves`);
        assert.ok(clip.lowerTravel > 0, `${clip.clip}: lower body never moves`);
        assert.ok(
          Math.min(clip.upperTravel, clip.lowerTravel) >= MIN_HALF_TRAVEL
            || clip.halfBalance >= BALANCED_RATIO,
          `${clip.clip}: one half is a passenger (upper ${clip.upperTravel}, lower ${clip.lowerTravel})`,
        );
      }

      if (asset.lowerMeshBound) {
        assert.ok(
          asset.boundLowerMeshMotion?.maxDisplacement > 0,
          "a bound lower mesh must have measured motion",
        );
      }
    });
  }
});

test("the commander keeps its authored strike pipeline upstream of the whole-body pass", async () => {
  const provenance = JSON.parse(await readFile(PROVENANCE, "utf8"));
  const commander = provenance.assets[COMMANDER];
  assert.ok(commander, "the commander must appear in the character build record");

  // The commander is the one character whose strikes and guard pose are hand
  // authored, so its record must name that upstream stage and prove the
  // whole-body pass consumed exactly its output.
  assert.equal(
    commander.upstreamPipeline,
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
      + "/player-combat-animation-candidate/author_player_combat_clips.py",
    "the commander must record its authoring stage",
  );
  const authored = resolve(
    ROOT,
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline",
    "player-combat-animation-candidate/dusk-warden.glb",
  );
  if (existsSync(authored)) {
    assert.equal(
      commander.sourceInputSha256,
      hashFile(authored),
      "the whole-body pass must have consumed the authored strike candidate",
    );
  }
  assert.equal(commander.lowerMeshBound, false, "the commander was already fully skinned");
});

test("every character records the input its whole-body pass consumed", async () => {
  const provenance = JSON.parse(await readFile(PROVENANCE, "utf8"));
  for (const asset of Object.values(provenance.assets)) {
    assert.equal(typeof asset.sourceInputPath, "string", `${asset.outputPath}: no recorded input`);
    assert.match(asset.sourceInputSha256 ?? "", /^[0-9a-f]{64}$/u, `${asset.outputPath}: no input hash`);
    assert.ok(
      ["runtime", "rigged-lower-mesh-candidate"].includes(asset.sourceInputLane),
      `${asset.outputPath}: unknown input lane ${asset.sourceInputLane}`,
    );
    // A runtime-lane input was overwritten by this very promotion, so only a
    // candidate-lane input is still independently verifiable.
    if (asset.sourceInputLane !== "rigged-lower-mesh-candidate") continue;
    const input = resolve(ROOT, asset.sourceInputPath);
    if (!existsSync(input)) continue;
    assert.equal(hashFile(input), asset.sourceInputSha256, `${asset.outputPath}: input drifted`);
  }
});
