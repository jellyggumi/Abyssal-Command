globalThis.self = globalThis;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOTION_MODELS = Object.freeze({
  "broken-court-monarch-boss": "assets/motion/ingame/characters/broken-court-monarch-boss/model.glb",
  "broken-court-monarch-v04": "assets/motion/ingame/characters/broken-court-monarch-v04/model.glb",
  "ember-cohort": "assets/motion/ingame/characters/ember-cohort/model.glb",
  guard: "assets/motion/ingame/characters/guard/model.glb",
  "human-command-boss": "assets/motion/ingame/characters/human-command-boss/model.glb",
  "lantern-reaver": "assets/motion/ingame/characters/lantern-reaver/model.glb",
});

const gltfRequests = [];
const originalGltfLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function loadGlbFromDisk(url, onLoad, _onProgress, onError) {
  const requestUrl = String(url);
  gltfRequests.push(requestUrl);
  try {
    const filePath = resolve(ROOT, requestUrl);
    const bytes = readFileSync(filePath);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    this.parse(arrayBuffer, requestUrl, onLoad, onError);
  } catch (error) {
    queueMicrotask(() => onError(error));
  }
  return this;
};

after(() => {
  GLTFLoader.prototype.load = originalGltfLoad;
});

const rendererModule = import(`../battle-realtime-three.js?realtime-motion-routing=${Date.now()}`);

function createHarness(RealtimeBattle) {
  const adapter = new RealtimeBattle({ reducedMotion: false });
  adapter.disposed = false;
  adapter.scene = new THREE.Scene();
  adapter.camera = new THREE.PerspectiveCamera(42, 640 / 360, 0.1, 200);
  adapter.terrainGroup = new THREE.Group();
  adapter.actorGroup = new THREE.Group();
  adapter.vfxGroup = new THREE.Group();
  adapter.scene.add(adapter.terrainGroup, adapter.actorGroup, adapter.vfxGroup);
  adapter.gateMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.08, 12, 32),
    new THREE.MeshStandardMaterial(),
  );
  adapter.gateMesh.visible = false;
  adapter.scene.add(adapter.gateMesh);
  return adapter;
}

async function waitForLoaded(record, label) {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    if (!record.loading) {
      assert.ok(record.root, `${label} did not produce a renderable actor`);
      return;
    }
    await new Promise((fulfill) => setImmediate(fulfill));
  }
  assert.fail(`${label} did not finish loading`);
}

test("live actors resolve promoted motion models and keep their authored clips", async () => {
  const { RealtimeBattle, meshRootForMotionCharacter } = await rendererModule;

  assert.deepEqual(
    Object.fromEntries(Object.keys(MOTION_MODELS).map((assetId) => [
      assetId,
      meshRootForMotionCharacter(assetId),
    ])),
    MOTION_MODELS,
    "all six public motion-library IDs must resolve to their promoted GLBs",
  );

  const adapter = createHarness(RealtimeBattle);
  const routingCases = [
    {
      label: "ember-cohort companion default",
      assetId: "ember-cohort",
      entity: { id: "default-ember", kind: "companion", companionId: "ember-cohort" },
      kind: "companion",
    },
    {
      label: "lantern-reaver companion default",
      assetId: "lantern-reaver",
      entity: { id: "default-lantern", kind: "companion", companionId: "lantern-reaver" },
      kind: "companion",
    },
    {
      label: "guardian enemy default",
      assetId: "guard",
      entity: { id: "default-guardian", kind: "guardian" },
      kind: "enemy",
    },
    {
      label: "explicit motionAssetId override",
      assetId: "human-command-boss",
      entity: { id: "overridden-rusher", kind: "rusher", motionAssetId: "human-command-boss" },
      kind: "enemy",
    },
    {
      label: "explicit broken-court monarch boss",
      assetId: "broken-court-monarch-boss",
      entity: { id: "overridden-monarch", kind: "ranged", motionAssetId: "broken-court-monarch-boss" },
      kind: "enemy",
    },
    {
      label: "explicit broken-court monarch v04",
      assetId: "broken-court-monarch-v04",
      entity: { id: "overridden-monarch-v04", kind: "flanker", motionAssetId: "broken-court-monarch-v04" },
      kind: "enemy",
    },
  ];

  try {
    for (const routingCase of routingCases) {
      const record = adapter.ensureActor(routingCase.entity, routingCase.kind);
      await waitForLoaded(record, routingCase.label);

      const expectedPath = MOTION_MODELS[routingCase.assetId];
      assert.equal(record.modelPath, expectedPath, `${routingCase.label} selected the wrong model`);
      assert.ok(
        gltfRequests.includes(`./${expectedPath}`),
        `${routingCase.label} never loaded its promoted GLB`,
      );
      assert.equal(
        record.actionSources.attack,
        "base",
        `${routingCase.label} must prefer its self-authored attack over the generic overlay`,
      );
      assert.equal(
        record.actions.attack?.getClip().name,
        `${routingCase.assetId}::attack::v01`,
        `${routingCase.label} must expose the authored attack clip`,
      );
    }
    assert.equal(
      gltfRequests.includes("./assets/motion/ingame/unarmed-core.glb"),
      false,
      "promoted self-authored actors must not request the generic unarmed overlay",
    );

    const fallback = adapter.ensureActor(
      {
        id: "unknown-motion-override",
        kind: "companion",
        companionId: "rift-lens",
        motionAssetId: "not-in-the-motion-library",
      },
      "companion",
    );
    await waitForLoaded(fallback, "unknown explicit motionAssetId fallback");

    assert.equal(
      fallback.modelPath,
      "companions/rift-lens.glb",
      "an unknown explicit motionAssetId must fall back to the actor's standard catalog GLB",
    );
    assert.ok(
      gltfRequests.includes("./assets/images/battle/glb/companions/rift-lens.glb"),
      "the fallback must load the standard catalog GLB",
    );
    assert.equal(
      fallback.actionSources.attack,
      "overlay",
      "standard catalog GLBs keep the generic overlay while self-authored motion GLBs do not",
    );
    assert.equal(fallback.actions.attack?.getClip().name, "unarmed-core::attack::v01");
  } finally {
    adapter.dispose();
  }
});
