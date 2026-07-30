globalThis.self = globalThis;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_BASE_ACTIONS = [
  "idle",
  "move",
  "run",
  "hit",
  "bighit",
  "attack",
  "critical",
  "avoid",
  "defence",
  "die",
  "show",
];
const OVERLAY_ACTIONS = new Set([
  "idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence",
]);

const LANTERN_REAVER_SOURCE_MESH = "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb";

const gltfRequests = [];
const failedGltfPaths = new Set();

function normalizeRequestPath(url) {
  return String(url).replace(/^\.\//, "");
}

function shouldFailLoadForRequest(requestUrl) {
  const normalized = normalizeRequestPath(requestUrl);
  for (const failedPath of failedGltfPaths) {
    if (normalized.endsWith(failedPath)) return true;
  }
  return false;
}

function setGltfLoadFailure(path, enabled = true) {
  const normalized = normalizeRequestPath(path);
  if (enabled) failedGltfPaths.add(normalized);
  else failedGltfPaths.delete(normalized);
}

function resetGltfFailures() {
  failedGltfPaths.clear();
}

function gltfRequestCountFor(path) {
  const normalized = normalizeRequestPath(path);
  return gltfRequests.filter((request) => request === normalized).length;
}

function safeLookup(map, key) {
  return Object.hasOwn(map, key) ? map[key] : null;
}

const originalGltfLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function loadGlbFromDisk(url, onLoad, _onProgress, onError) {
  const requestUrl = normalizeRequestPath(url);
  gltfRequests.push(requestUrl);
  if (shouldFailLoadForRequest(requestUrl)) {
    queueMicrotask(() => onError?.(new Error(`Simulated model load failure: ${requestUrl}`)));
    return this;
  }
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

function assertBaseClipContract(record, expectedAssetId, label) {
  for (const action of CANONICAL_BASE_ACTIONS) {
    if (OVERLAY_ACTIONS.has(action)) {
      assert.equal(
        safeLookup(record.actionSources, action),
        "overlay",
        `${label} must use overlay animation source for ${action}`,
      );
      assert.equal(
        safeLookup(record.actions, action)?.getClip?.()?.name,
        `unarmed-core::${action}::v01`,
        `${label} ${action} must use overlay namespace`,
      );
    } else {
      assert.equal(
        safeLookup(record.actionSources, action),
        "base",
        `${label} must use base animation source for ${action}`,
      );
      assert.equal(
        safeLookup(record.actions, action)?.getClip?.()?.name,
        `${expectedAssetId}::${action}::v01`,
        `${label} must expose namespaced base clip ${expectedAssetId}::${action}::v01`,
      );
    }
  }
}

function assertNoPrototypeLeakage(record, label) {
  for (const key of ["constructor", "toString", "__proto__"]) {
    assert.equal(safeLookup(record.actions, key), null, `${label} action map must return null for ${key}`);
    assert.equal(safeLookup(record.actionSources, key), null, `${label} source map must return null for ${key}`);
  }
}

function isMagentaMarker(record) {
  const root = record?.root;
  const material = root?.material;
  return (
    Boolean(root?.isMesh)
    && root.geometry?.type === "IcosahedronGeometry"
    && material?.color?.getHex?.() === 0xff00ff
    && material?.emissive?.getHex?.() === 0xff00ff
  );
}

test("failed motion model loads retry exactly once and marker on second failure", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await import(
    `../battle-realtime-three.js?realtime-motion-routing-fail=${Date.now()}`
  );
  const explicitModelPath = MOTION_MODELS.scout;
  assert.equal(explicitModelPath, "assets/motion/ingame/characters/scout/model.glb");

  {
    resetGltfFailures();
    gltfRequests.length = 0;
    setGltfLoadFailure(explicitModelPath);
    setGltfLoadFailure(LANTERN_REAVER_SOURCE_MESH);
    const adapter = createHarness(RealtimeBattle);

    try {
      const record = adapter.ensureActor(
        { id: "promoted+fallback-load-fail", kind: "rusher", motionAssetId: "scout" },
        "enemy",
      );
      await waitForLoaded(record, "promoted+fallback load marker");

      assert.equal(record.modelPath, LANTERN_REAVER_SOURCE_MESH);
      assert.equal(record.fallbackModelPath, null, "fallback failure should clear fallback slot");
      assert.equal(gltfRequestCountFor(explicitModelPath), 1, "promoted failure should be requested once");
      assert.equal(
        gltfRequestCountFor(LANTERN_REAVER_SOURCE_MESH),
        1,
        "fallback mesh failure should be requested once",
      );
      assert.equal(gltfRequests.length, 3, 'overlay GLB adds one request');
      assert.equal(record.actions?.attack, undefined, "missing actor marker should have no motion actions");
      assert.equal(record.mixer, null);
      assert.equal(isMagentaMarker(record), true, "dual load failure should show visible magenta marker");
    } finally {
      adapter.dispose();
      resetGltfFailures();
      gltfRequests.length = 0;
    }
  }

  {
    resetGltfFailures();
    gltfRequests.length = 0;
    setGltfLoadFailure(explicitModelPath);
    const adapter = createHarness(RealtimeBattle);

    try {
      const record = adapter.ensureActor(
        { id: "promoted-load-fail", kind: "rusher", motionAssetId: "scout" },
        "enemy",
      );
      await waitForLoaded(record, "rusher fallback model load");

      assert.equal(record.modelPath, LANTERN_REAVER_SOURCE_MESH);
      assert.equal(record.fallbackModelPath, null, "promoted-load failure should consume the fallback slot");
      assert.equal(gltfRequestCountFor(explicitModelPath), 1, "promoted failure should be requested once");
      assert.equal(
        gltfRequestCountFor(LANTERN_REAVER_SOURCE_MESH),
        1,
        "fallback mesh should be requested once",
      );
      assert.equal(gltfRequests.length, 2, 'overlay GLB is cached after first retry test');
    } finally {
      adapter.dispose();
      resetGltfFailures();
      gltfRequests.length = 0;
    }
  }
});

test("live actor routing loads all 11 motion models with namespaced attack clips", async () => {
  const { MOTION_MODELS, RealtimeBattle, meshRootForMotionCharacter } = await rendererModule;
  const routingCases = [
    {
      label: "commander default",
      expectedAssetId: "human-command-boss",
      entity: { id: "commander" },
      kind: "commander",
    },
    {
      label: "ember-cohort companion",
      expectedAssetId: "ember-cohort",
      entity: { id: "ember-companion", kind: "companion", companionId: "ember-cohort" },
      kind: "companion",
    },
    {
      label: "lantern-reaver companion",
      expectedAssetId: "lantern-reaver",
      entity: { id: "lantern-companion", kind: "companion", companionId: "lantern-reaver" },
      kind: "companion",
    },
    {
      label: "rusher default",
      expectedAssetId: "scout",
      entity: { id: "default-rusher", kind: "rusher" },
      kind: "enemy",
    },
    {
      label: "flanker default",
      expectedAssetId: "shade",
      entity: { id: "default-flanker", kind: "flanker" },
      kind: "enemy",
    },
    {
      label: "guardian default",
      expectedAssetId: "shadow-soldier-v04",
      entity: { id: "default-guardian", kind: "guardian" },
      kind: "enemy",
    },
    {
      label: "ranged default",
      expectedAssetId: "possessed",
      entity: { id: "default-ranged", kind: "ranged" },
      kind: "enemy",
    },
    ...[
      "broken-court-monarch-boss",
      "broken-court-monarch-v04",
      "guard",
      "shadow-commander-boss",
    ].map((motionAssetId) => ({
      label: `explicit ${motionAssetId}`,
      expectedAssetId: motionAssetId,
      entity: { id: `explicit-${motionAssetId}`, kind: "rusher", motionAssetId },
      kind: "enemy",
    })),
  ];
  const expectedAssetIds = routingCases.map(({ expectedAssetId }) => expectedAssetId).sort();

  assert.deepEqual(
    Object.keys(MOTION_MODELS).sort(),
    expectedAssetIds,
    "the public motion registry must expose exactly the 11 routed actor assets",
  );
  assert.equal(routingCases.length, 11, "routing should cover all eleven actor routes");

  const adapter = createHarness(RealtimeBattle);
  try {
    for (const routingCase of routingCases) {
      const expectedModelPath = `assets/motion/ingame/characters/${routingCase.expectedAssetId}/model.glb`;
      assert.equal(
        meshRootForMotionCharacter(routingCase.expectedAssetId),
        expectedModelPath,
        `${routingCase.expectedAssetId} must resolve through the public motion registry`,
      );

      const record = adapter.ensureActor(routingCase.entity, routingCase.kind);
      await waitForLoaded(record, routingCase.label);

      assert.equal(
        record.modelPath,
        expectedModelPath,
        `${routingCase.label} resolved to the wrong motion model`,
      );
      assert.ok(
        gltfRequests.includes(expectedModelPath),
        `${routingCase.label} did not load ${routingCase.expectedAssetId}`,
      );

      assertBaseClipContract(record, routingCase.expectedAssetId, routingCase.label);
      assertNoPrototypeLeakage(record, routingCase.label);
    }

    const unknownAssetId = "not-in-the-motion-library";
    assert.equal(meshRootForMotionCharacter(unknownAssetId), null);
    const fallbackRecord = adapter.ensureActor(
      { id: "unknown-motion-override", kind: "rusher", motionAssetId: unknownAssetId },
      "enemy",
    );
    await waitForLoaded(fallbackRecord, "unknown motionAssetId fallback");
    assert.equal(fallbackRecord.modelPath, MOTION_MODELS.scout);
    assertBaseClipContract(fallbackRecord, "scout", "unknown motionAssetId fallback");
    assertNoPrototypeLeakage(fallbackRecord, "unknown motionAssetId fallback");
  } finally {
    adapter.dispose();
    resetGltfFailures();
    gltfRequests.length = 0;
  }
});
