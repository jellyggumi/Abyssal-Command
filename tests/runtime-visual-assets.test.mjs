import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

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

test("the three-stage catalog retains source meshes while routing all terrain to flat procedural support", async (t) => {
  const stageIds = STAGES.map(({ id }) => id);
  assert.deepEqual(stageIds, ["cinder-span", "abyss-chancel", "echo-throne"]);

  const retained = new Set(RETAINED_ASSET_PATHS);
  for (const stageId of stageIds) {
    const profile = stageWorldFor(stageId);
    assert.ok(profile, `${stageId}: missing stage world profile`);
    const terrainSourcePath = profile.terrainGlbPath ?? profile.terrainSourceCandidatePath;
    const paths = [
      terrainSourcePath,
      ...profile.presentation.props.map(({ modelPath }) => modelPath),
      ...profile.presentation.npcs.map(({ modelPath }) => modelPath),
      ...profile.presentation.vfxCues.map(({ modelPath }) => modelPath),
    ];
    await t.test(stageId, () => {
      // Cycle 10 supersession. Until now every stage routed gameplay onto a procedural
      // plane because the only retained terrains were authored dioramas and rejected
      // textured candidates. Each stage now ships a composed slab floor authored in
      // renderer world coordinates, so the invariant inverts: assert the promoted
      // terrain contract instead of asserting that no terrain is eligible. The
      // rejected sources stay retained and are still asserted below, so this replaces
      // the guard rather than removing it.
      assert.equal(profile.terrainRuntimeEligible, true, `${stageId}: the composed slab floor is gameplay-eligible`);
      assert.match(profile.terrainGlbPath, /^assets\/mesh\/terrain\/.*\/runtime\/.*-floor\.glb$/u, `${stageId}: runtime terrain must be a promoted floor under runtime/`);
      assert.ok(!profile.terrainGlbPath.includes("/textured-candidate/"), `${stageId}: a candidate path is never promotable`);
      assert.equal(profile.terrainFallback, undefined, `${stageId}: an eligible floor must not also carry a procedural fallback`);
      assert.match(profile.terrainSourceCandidatePath, /^assets\/mesh\/terrain\/.*\.glb$/u, `${stageId}: retained source must remain an inspectable terrain GLB`);
      if (stageId === "cinder-span") {
        assert.match(profile.terrainSourceCandidatePath, /\/runtime\/.*\.glb$/u, "Cinder must retain the promoted diorama for offline integrity checks");
      } else {
        assert.match(profile.terrainSourceCandidatePath, /\/textured-candidate\/.*\.glb$/u, `${stageId}: retained source must remain marked as a textured candidate`);
      }
      assert.equal(paths.every((assetPath) => retained.has(assetPath)), true, `${stageId}: every retained source and runtime model must be in the frozen asset allowlist`);
      assert.equal(paths.every((assetPath) => assetPath.startsWith("assets/mesh/") || assetPath.startsWith("assets/motion/")), true, `${stageId}: assets must use mesh or motion lanes`);
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

test("a staged idle commander clears the queued show before its model resolves", async () => {
  const clipKeys = [
    "idle",
    "move",
    "run",
    "attack",
    "hit",
    "bighit",
    "avoid",
    "defence",
    "critical",
    "die",
    "show",
  ];
  const originalLoad = GLTFLoader.prototype.load;
  GLTFLoader.prototype.load = function loadSyntheticRig(_url, onLoad) {
    queueMicrotask(() => {
      const scene = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.5, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
      body.position.y = 0.75;
      scene.add(body);
      onLoad({
        scene,
        animations: clipKeys.map((key) => new THREE.AnimationClip(`synthetic::${key}::v01`, 0.05, [])),
      });
    });
    return this;
  };

  let adapter;
  try {
    const { RealtimeBattle } = await import(`../battle-realtime-three.js?staged-idle-regression=${Date.now()}`);
    adapter = new RealtimeBattle({ reducedMotion: false });
    adapter.disposed = false;
    adapter.scene = new THREE.Scene();
    adapter.actorGroup = new THREE.Group();
    adapter.scene.add(adapter.actorGroup);

    adapter.reconcileActors({
      commander: {
        id: "commander",
        x: 12000,
        y: 6000,
        presentationAction: "idle",
      },
      enemies: [],
      companions: [],
      projectiles: [],
      pickups: [],
    });

    let commander;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      commander = adapter.debugPresentationState("commander");
      if (commander?.hasMixer) break;
      await Promise.resolve();
    }
    assert.equal(commander?.hasMixer, true, "the staged commander rig must resolve through the real actor-loading path");
    assert.equal(commander.presentationAction, "idle", "reconciliation must retain the staged idle request");
    assert.equal(commander.oneShotActionKey, null, "model resolution must not replay the default queued show action");
    assert.equal(commander.activeActionKey, "idle", "the resolved staged commander must settle into canonical idle");
  } finally {
    adapter?.dispose();
    GLTFLoader.prototype.load = originalLoad;
  }
});
