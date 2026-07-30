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
  "idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show",
];

// The shared overlay pack's roster, read from the pack itself rather than duplicated: a rig
// takes overlay motion for every action the pack carries and its own authored motion for
// everything else. The pack grew from 9 to 21 actions (directional reactions, exact attack
// delivery, terminal and entrance beats), so `die`/`show` are now overlay-backed too.
const OVERLAY_ACTIONS = new Set(
  (JSON.parse(readFileSync(resolve(ROOT, "assets/motion/ingame/manifest.json"), "utf8"))
    .pack.clipOverrides ?? []).map((override) => override.action),
);

// Actions a rig must still serve from its own authored library because the overlay does not
// carry them. Empty today; kept as the seam that proves "no overlay entry -> base" still works.
const FALLBACK_ONLY_ACTIONS = CANONICAL_BASE_ACTIONS.filter((action) => !OVERLAY_ACTIONS.has(action));

const OVERLAY_GLB_PATH = "assets/motion/ingame/unarmed-core.glb";

const gltfRequests = [];
const failedGltfPaths = new Set();

function normalizeRequestPath(url) {
  return String(url).replace(/^\.\//, "");
}

function shouldFailLoadForRequest(requestUrl) {
  const normalized = normalizeRequestPath(requestUrl);
  for (const failedPath of failedGltfPaths) {
    if (normalized.endsWith(failedPath) || normalized === failedPath) return true;
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
  return gltfRequests.filter((req) => req === normalized).length;
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

const rendererModule = import(`../battle-realtime-three.js?overlay-runtime-qa=${Date.now()}`);

let moduleImportCounter = 0;
function importFreshRuntime() {
  moduleImportCounter += 1;
  return import(`../battle-realtime-three.js?overlay-qa-fresh-${Date.now()}-${moduleImportCounter}`);
}

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

function assertActionSources(record, label) {
  for (const action of CANONICAL_BASE_ACTIONS) {
    const expectedSource = OVERLAY_ACTIONS.has(action) ? "overlay" : "base";
    assert.equal(
      safeLookup(record.actionSources, action),
      expectedSource,
      `${label} ${action} source must be ${expectedSource}`,
    );
  }
}

function assertActionClipNames(record, baseAssetId, label) {
  for (const action of CANONICAL_BASE_ACTIONS) {
    const clipName = record.actions[action]?.getClip?.()?.name;
    if (OVERLAY_ACTIONS.has(action)) {
      assert.equal(
        clipName,
        `unarmed-core::${action}::v01`,
        `${label} ${action} clip name must use overlay namespace`,
      );
    } else {
      assert.equal(
        clipName,
        `${baseAssetId}::${action}::v01`,
        `${label} ${action} clip name must use base namespace ${baseAssetId}`,
      );
    }
  }
}

// ── 1. Normal overlay action sources and clip names ──
test("normal overlay routing assigns correct sources and clip names for every routed action", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await rendererModule;

  gltfRequests.length = 0;
  resetGltfFailures();

  const adapter = createHarness(RealtimeBattle);
  try {
    const record = adapter.ensureActor(
      { id: "overlay-qa-scout", kind: "rusher" },
      "enemy",
    );
    await waitForLoaded(record, "scout overlay QA");

    assertActionSources(record, "scout");
    assertActionClipNames(record, "scout", "scout");
    assert.equal(record.modelPath, MOTION_MODELS.scout);

    // A rig exposes its own canonical actions plus every action the overlay pack adds on top.
    const expectedActionKeys = [...new Set([...CANONICAL_BASE_ACTIONS, ...OVERLAY_ACTIONS])].sort();
    assert.deepEqual(
      Object.keys(record.actions).sort(),
      expectedActionKeys,
      "scout must expose its canonical actions plus every overlay action",
    );

    // Every exposed action must declare where its clip came from -- no untracked action.
    assert.deepEqual(
      Object.keys(record.actionSources).sort(),
      expectedActionKeys,
      "scout must declare a source for every action it exposes",
    );

    // Verify no prototype leakage
    for (const key of ["constructor", "toString", "__proto__"]) {
      assert.equal(safeLookup(record.actionSources, key), null,
        `actionSources must not have prototype key ${key}`);
    }
  } finally {
    adapter.dispose();
    resetGltfFailures();
    gltfRequests.length = 0;
  }
});

// ── 2. All 11 promoted characters get overlay ──
test("all 11 promoted characters receive overlay for exactly the pack's actions", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await rendererModule;

  gltfRequests.length = 0;
  resetGltfFailures();

  const adapter = createHarness(RealtimeBattle);
  try {
    const routingCases = [
      { entity: { id: "commander" }, kind: "commander", assetId: "human-command-boss" },
      { entity: { id: "qa-ember", kind: "companion", companionId: "ember-cohort" }, kind: "companion", assetId: "ember-cohort" },
      { entity: { id: "qa-lantern", kind: "companion", companionId: "lantern-reaver" }, kind: "companion", assetId: "lantern-reaver" },
      { entity: { id: "qa-rusher", kind: "rusher" }, kind: "enemy", assetId: "scout" },
      { entity: { id: "qa-flanker", kind: "flanker" }, kind: "enemy", assetId: "shade" },
      { entity: { id: "qa-guardian", kind: "guardian" }, kind: "enemy", assetId: "shadow-soldier-v04" },
      { entity: { id: "qa-ranged", kind: "ranged" }, kind: "enemy", assetId: "possessed" },
      { entity: { id: "qa-boss1", kind: "rusher", motionAssetId: "broken-court-monarch-boss" }, kind: "enemy", assetId: "broken-court-monarch-boss" },
      { entity: { id: "qa-boss2", kind: "rusher", motionAssetId: "broken-court-monarch-v04" }, kind: "enemy", assetId: "broken-court-monarch-v04" },
      { entity: { id: "qa-guard", kind: "rusher", motionAssetId: "guard" }, kind: "enemy", assetId: "guard" },
      { entity: { id: "qa-shadow-cmd", kind: "rusher", motionAssetId: "shadow-commander-boss" }, kind: "enemy", assetId: "shadow-commander-boss" },
    ];

    for (const { entity, kind, assetId } of routingCases) {
      const record = adapter.ensureActor(entity, kind);
      await waitForLoaded(record, assetId);

      assert.equal(record.modelPath, MOTION_MODELS[assetId], `${assetId} must use its own model`);
      assertActionSources(record, assetId);
      assertActionClipNames(record, assetId, assetId);
    }
  } finally {
    adapter.dispose();
    resetGltfFailures();
    gltfRequests.length = 0;
  }
});

// ── 3. Overlay load failure falls back to base ──
test("overlay GLB load failure falls back to base clips for every canonical action", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await importFreshRuntime();

  gltfRequests.length = 0;
  resetGltfFailures();
  setGltfLoadFailure(OVERLAY_GLB_PATH);

  const adapter = createHarness(RealtimeBattle);
  try {
    const record = adapter.ensureActor(
      { id: "overlay-fail-scout", kind: "rusher" },
      "enemy",
    );
    await waitForLoaded(record, "overlay failure scout");

    // All 11 actions must use base source when overlay fails
    for (const action of CANONICAL_BASE_ACTIONS) {
      assert.equal(
        safeLookup(record.actionSources, action),
        "base",
        `overlay-fail ${action} must be "base" when overlay GLB fails`,
      );
      assert.equal(
        record.actions[action].getClip().name,
        `scout::${action}::v01`,
        `overlay-fail ${action} must use scout base namespace`,
      );
    }

    // Character must still render
    assert.ok(record.root, "overlay failure character must render");
    assert.ok(record.mixer, "overlay failure character must have animation mixer");
    assert.equal(record.modelPath, MOTION_MODELS.scout);

    // Overlay GLB should be requested exactly once
    assert.equal(
      gltfRequestCountFor(OVERLAY_GLB_PATH),
      1,
      "overlay GLB must be requested exactly once on failure path",
    );
  } finally {
    adapter.dispose();
    resetGltfFailures();
    gltfRequests.length = 0;
  }
});

// ── 4. Overlay load failure on character with explicit motionAssetId ──
test("overlay load failure with explicit motionAssetId still uses base clips", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await importFreshRuntime();

  gltfRequests.length = 0;
  resetGltfFailures();
  setGltfLoadFailure(OVERLAY_GLB_PATH);

  const adapter = createHarness(RealtimeBattle);
  try {
    const record = adapter.ensureActor(
      { id: "overlay-fail-explicit", kind: "rusher", motionAssetId: "shadow-commander-boss" },
      "enemy",
    );
    await waitForLoaded(record, "overlay failure explicit boss");

    // All base, because overlay failed
    for (const action of CANONICAL_BASE_ACTIONS) {
      assert.equal(
        safeLookup(record.actionSources, action),
        "base",
        `overlay-fail explicit ${action} must be "base"`,
      );
      assert.equal(
        record.actions[action].getClip().name,
        `shadow-commander-boss::${action}::v01`,
        `overlay-fail explicit ${action} must use shadow-commander-boss namespace`,
      );
    }

    assert.ok(record.root, "explicit overlay failure character must render");
    assert.equal(record.modelPath, MOTION_MODELS["shadow-commander-boss"]);
  } finally {
    adapter.dispose();
    resetGltfFailures();
    gltfRequests.length = 0;
  }
});

// ── 5. Overlay GLB is cached across multiple instantiations ──
test("overlay delta entries promise caches across multiple character instantiations", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await rendererModule;

  gltfRequests.length = 0;
  resetGltfFailures();

  const adapter = createHarness(RealtimeBattle);
  try {
    // First actor triggers overlay GLB load
    const first = adapter.ensureActor(
      { id: "overlay-cache-first", kind: "rusher" },
      "enemy",
    );
    await waitForLoaded(first, "first overlay cache actor");

    const requestsAfterFirst = gltfRequests.length;
    const overlayRequestsAfterFirst = gltfRequestCountFor(OVERLAY_GLB_PATH);

    // Second actor of same model type
    const second = adapter.ensureActor(
      { id: "overlay-cache-second", kind: "rusher" },
      "enemy",
    );
    await waitForLoaded(second, "second overlay cache actor");

    // Total requests should be: first_scout_load + first_overlay_load + second_scout_load
    // Not: first_scout_load + first_overlay_load + second_scout_load + second_overlay_load
    assert.equal(
      gltfRequestCountFor(OVERLAY_GLB_PATH),
      overlayRequestsAfterFirst,
      "overlay GLB must not be re-requested for a second actor (cached promise)",
    );

    // Both actors must have overlay sources
    assertActionSources(first, "first cached actor");
    assertActionSources(second, "second cached actor");
    assertActionClipNames(first, "scout", "first cached actor");
    assertActionClipNames(second, "scout", "second cached actor");
  } finally {
    adapter.dispose();
    resetGltfFailures();
    gltfRequests.length = 0;
  }
});

// ── 6. Fallback-only actions never come from overlay ──
test("die and show always report base source even with overlay present", async () => {
  const { RealtimeBattle } = await rendererModule;

  gltfRequests.length = 0;
  resetGltfFailures();

  const adapter = createHarness(RealtimeBattle);
  try {
    for (const kind of ["rusher", "flanker", "guardian", "ranged"]) {
      const record = adapter.ensureActor(
        { id: `fallback-${kind}`, kind },
        "enemy",
      );
      await waitForLoaded(record, `fallback ${kind}`);

      for (const action of FALLBACK_ONLY_ACTIONS) {
        assert.equal(
          safeLookup(record.actionSources, action),
          "base",
          `${kind} ${action} must use base source`,
        );
        // Clip name must be the character's base namespace
        assert.ok(
          record.actions[action].getClip().name.endsWith(`::${action}::v01`),
          `${kind} ${action} clip must end with ::${action}::v01`,
        );
      }
    }
  } finally {
    adapter.dispose();
    resetGltfFailures();
    gltfRequests.length = 0;
  }
});
