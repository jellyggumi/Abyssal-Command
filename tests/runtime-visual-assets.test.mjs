import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { STAGES } from "../campaign-state.js";
import { RETAINED_ASSET_PATHS } from "../scripts/defense-runtime-assets.mjs";
import { stageWorldFor } from "../stage-world-catalog.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;

function parseGlb(assetPath) {
  const bytes = readFileSync(join(ROOT, assetPath));
  assert.ok(bytes.length >= 20, `${assetPath}: truncated GLB (${bytes.length} bytes)`);
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, `${assetPath}: invalid GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${assetPath}: expected glTF 2.0 GLB`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${assetPath}: GLB header length does not match file size`);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), GLB_JSON_CHUNK, `${assetPath}: first GLB chunk must be JSON`);
  const jsonEnd = 20 + jsonLength;
  assert.ok(jsonEnd <= bytes.length, `${assetPath}: JSON chunk exceeds file length`);
  const json = JSON.parse(bytes.toString("utf8", 20, jsonEnd));
  assert.equal(json.asset?.version, "2.0", `${assetPath}: glTF asset.version must be 2.0`);
  assert.ok((json.meshes ?? []).length > 0, `${assetPath}: requires at least one mesh`);
  return json;
}

function assertObjMesh(assetPath) {
  const text = readFileSync(join(ROOT, assetPath), "utf8");
  assert.match(text, /^v\s+[-+\d.]+\s+[-+\d.]+\s+[-+\d.]+/m, `${assetPath}: missing vertex data`);
  assert.match(text, /^f\s+\d+/m, `${assetPath}: missing face data`);
}

function assertModel(assetPath) {
  assert.ok(existsSync(join(ROOT, assetPath)), `${assetPath}: missing runtime model`);
  if (assetPath.endsWith(".glb")) parseGlb(assetPath);
  else if (assetPath.endsWith(".obj")) assertObjMesh(assetPath);
  else assert.fail(`${assetPath}: unsupported runtime model extension`);
}

test("the three-stage catalog resolves only retained mesh and motion resources", async (t) => {
  const stageIds = STAGES.map(({ id }) => id);
  assert.deepEqual(stageIds, ["cinder-span", "abyss-chancel", "echo-throne"]);

  const retained = new Set(RETAINED_ASSET_PATHS);
  for (const stageId of stageIds) {
    const profile = stageWorldFor(stageId);
    assert.ok(profile, `${stageId}: missing stage world profile`);
    const paths = [
      profile.terrainGlbPath,
      ...profile.presentation.props.map(({ modelPath }) => modelPath),
      ...profile.presentation.npcs.map(({ modelPath }) => modelPath),
      ...profile.presentation.vfxCues.map(({ modelPath }) => modelPath),
    ];
    await t.test(stageId, () => {
      assert.equal(paths.every((assetPath) => retained.has(assetPath)), true, `${stageId}: every runtime model must be in the frozen asset allowlist`);
      assert.equal(paths.every((assetPath) => assetPath.startsWith("assets/mesh/") || assetPath.startsWith("assets/motion/")), true, `${stageId}: models must use mesh or motion lanes`);
      for (const assetPath of paths) assertModel(assetPath);
    });
  }
});

test("the retained runtime manifest excludes retired battle artwork except UI", () => {
  const retiredStageArt = RETAINED_ASSET_PATHS.filter((assetPath) => assetPath.startsWith("assets/images/battle/stages/"));
  assert.deepEqual(retiredStageArt, [], "runtime must not retain legacy stage image backplates");

  const invalidBattleAssets = RETAINED_ASSET_PATHS.filter((assetPath) => assetPath.startsWith("assets/images/battle/") && !assetPath.startsWith("assets/images/battle/ui/"));
  assert.deepEqual(invalidBattleAssets, [], "only UI artwork may remain in the retained battle-image lane");
});

test("each canonical stage publishes two prop meshes, one VFX effect, and one Lantern Reaver lookout", () => {
  for (const { id: stageId } of STAGES) {
    const profile = stageWorldFor(stageId);
    assert.equal(profile.presentation.props.length, 2, `${stageId}: requires two placed prop meshes`);
    assert.equal(profile.presentation.vfxCues.length, 1, `${stageId}: requires one authored stage VFX cue`);
    assert.equal(profile.presentation.npcs.length, 1, `${stageId}: requires one Lantern Reaver lookout`);
    assert.equal(
      profile.presentation.npcs[0].modelPath,
      "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb",
      `${stageId}: lookout must use the supplied Lantern Reaver source mesh`,
    );
  }
});
