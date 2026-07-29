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


function assertModel(assetPath) {
  assert.ok(existsSync(join(ROOT, assetPath)), `${assetPath}: missing runtime model`);
  assert.equal(assetPath.endsWith(".glb"), true, `${assetPath}: active runtime models must use GLB`);
  parseGlb(assetPath);
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

test("each canonical stage publishes dense prop meshes, one VFX effect, and one Lantern Reaver lookout", () => {
  for (const { id: stageId } of STAGES) {
    const profile = stageWorldFor(stageId);
    if (stageId === "cinder-span") {
      assert.equal(profile.presentation.props.length, 12, "Cinder Span requires its twelve authored pack-node placements");
    } else {
      assert.ok(profile.presentation.props.length >= 2, `${stageId}: requires multiple placed prop meshes`);
    }
    assert.equal(profile.presentation.vfxCues.length, 1, `${stageId}: requires one authored stage VFX cue`);
    assert.equal(profile.presentation.npcs.length, 1, `${stageId}: requires one Lantern Reaver lookout`);
    assert.equal(
      profile.presentation.npcs[0].modelPath,
      "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb",
      `${stageId}: lookout must use the supplied Lantern Reaver source mesh`,
    );
  }
});

test("Cinder Span publishes twelve frozen, independently placed nodes across its two runtime packs", () => {
  const props = stageWorldFor("cinder-span").presentation.props;
  const expectedPlacements = {
    "cinder-span:collapsed-parapet-prop": { x: 13200, y: 9300, elevation: 0, yawRadians: 1.5708 },
    "cinder-span:east-ash-wall-prop": { x: 20800, y: 9900, elevation: 0, yawRadians: 1.5708 },
    "cinder-span:forge-arch": { x: 12600, y: 2800, elevation: 0, yawRadians: 0 },
    "cinder-span:forge-relic": { x: 15400, y: 7400, elevation: 0, yawRadians: 1.5708 },
    "cinder-span:gate-beacon-prop": { x: 22500, y: 10100, elevation: 0, yawRadians: 2.8 },
    "cinder-span:ingress-beacon-prop": { x: 3000, y: 1700, elevation: 0, yawRadians: -0.35 },
    "cinder-span:north-ash-talon-prop": { x: 2400, y: 10100, elevation: 0, yawRadians: 0.35 },
    "cinder-span:relay-debris-north-prop": { x: 5000, y: 10400, elevation: 0, yawRadians: 0.5 },
    "cinder-span:relay-debris-south-prop": { x: 15000, y: 1500, elevation: 0, yawRadians: -0.4 },
    "cinder-span:seal-brand": { x: 17600, y: 7400, elevation: 0, yawRadians: 0 },
    "cinder-span:south-forge-teeth-prop": { x: 9000, y: 1700, elevation: 0, yawRadians: 1.5708 },
    "cinder-span:west-ash-wall-prop": { x: 19000, y: 4400, elevation: 0, yawRadians: 1.5708 },
  };
  assert.deepEqual(
    props.map(({ id }) => id).sort(),
    Object.keys(expectedPlacements).sort(),
    "the twelve authored Cinder prop IDs are the runtime placement identities",
  );
  assert.deepEqual(
    props.map(({ modelNode }) => modelNode).sort(),
    [
      "terrain-cinder-span-feature-005",
      "terrain-cinder-span-feature-008",
      "terrain-cinder-span-feature-016",
      "terrain-cinder-span-feature-026",
      "terrain-cinder-span-feature-039",
      "terrain-cinder-span-prop-006",
      "terrain-cinder-span-prop-011",
      "terrain-cinder-span-prop-012",
      "terrain-cinder-span-prop-014",
      "terrain-cinder-span-prop-030",
      "terrain-cinder-span-prop-033",
      "terrain-cinder-span-prop-044",
    ],
    "every Cinder placement addresses one exact pack node",
  );
  assert.deepEqual(
    [...new Set(props.map(({ modelPath }) => modelPath))].sort(),
    [
      "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-features.glb",
      "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-props.glb",
    ],
    "the twelve placements share exactly two runtime pack URLs",
  );
  assert.deepEqual(
    Object.fromEntries(props.map(({ id, placement }) => [id, placement])),
    expectedPlacements,
    "each Cinder prop keeps its separate authored placement",
  );
  assert.equal(new Set(props.map(({ placement }) => placement)).size, 12, "placements must not share mutable object identity");
  assert.equal(new Set(props.map(({ placement }) => JSON.stringify(placement))).size, 12, "placements must not collapse to duplicate coordinates");
  assert.equal(props.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.placement)), true, "prop records and placements stay immutable");
});
