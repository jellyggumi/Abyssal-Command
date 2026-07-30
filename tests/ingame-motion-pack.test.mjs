globalThis.self = globalThis;
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = join(ROOT, "assets/motion/ingame/manifest.json");
const PACK_GLB_PATH = join(ROOT, "assets/motion/ingame/unarmed-core.glb");
const AUDIT_REPORT_PATH = join(
  ROOT,
  "_workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report-FULL-OBSERVED.json",
);
const PROMOTED_ASSET_IDS = [
  "broken-court-monarch-boss",
  "broken-court-monarch-v04",
  "ember-cohort",
  "guard",
  "human-command-boss",
  "lantern-reaver",
  "possessed",
  "scout",
  "shade",
  "shadow-commander-boss",
  "shadow-soldier-v04",
];
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


// Helper to parse GLB structure
function readGlb(path) {
  const buf = readFileSync(path);
  assert.equal(buf.readUInt32LE(0), 0x46546c67, `${path}: not a GLB`);
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { json, bin };
}

const COMPONENT_READERS = {
  5121: (b, o) => b.readUInt8(o),
  5123: (b, o) => b.readUInt16LE(o),
  5125: (b, o) => b.readUInt32LE(o),
  5126: (b, o) => b.readFloatLE(o),
};
const COMPONENT_SIZES = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(json, bin, index) {
  const acc = json.accessors[index];
  const n = TYPE_COUNTS[acc.type];
  const size = COMPONENT_SIZES[acc.componentType];
  const read = COMPONENT_READERS[acc.componentType];
  const view = json.bufferViews[acc.bufferView];
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? size * n;
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(read(bin, base + i * stride + c * size));
    out.push(row);
  }
  return { values: out, componentType: acc.componentType };
}


// Intercept GLTFLoader.prototype.load to load real files from disk.
let rejectedModelPath = null;

const originalLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  const relativeUrl = String(url).replace(/^\.\//, "");
  if (relativeUrl === rejectedModelPath) {
    queueMicrotask(() => onError?.(new Error(`Simulated model load failure: ${relativeUrl}`)));
    return this;
  }
  try {
    const filePath = resolve(ROOT, url);
    const buf = readFileSync(filePath);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    this.parse(arrayBuffer, url, onLoad, onError);
  } catch (error) {
    queueMicrotask(() => onError?.(error));
  }
  return this;
};

after(() => {
  GLTFLoader.prototype.load = originalLoad;
});

// Import RealtimeBattle dynamically to ensure prototype load override is active
const rendererModule = import(`../battle-realtime-three.js?ingame-motion-pack-contract=${Date.now()}`);

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const value = predicate();
    if (value) return value;
    await new Promise((fulfill) => setImmediate(fulfill));
  }
  assert.fail(message);
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

// 1. Raw unarmed-core source and mapping contract
test("raw unarmed-core manifest records the measured retarget contract", () => {
  assert.ok(existsSync(MANIFEST_PATH), `manifest.json should exist at ${MANIFEST_PATH}`);
  assert.ok(existsSync(AUDIT_REPORT_PATH), `FBX audit report should exist at ${AUDIT_REPORT_PATH}`);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const audit = JSON.parse(readFileSync(AUDIT_REPORT_PATH, "utf8"));
  const pack = manifest.pack;

  assert.equal(manifest.schemaVersion, 1, "schemaVersion must be 1");
  assert.equal(pack.id, "unarmed-core", "pack id must be unarmed-core");
  assert.equal(pack.path, "assets/motion/ingame/unarmed-core.glb", "pack path must match");
  assert.equal(pack.sourceRig, "mixamo-37", "source rig must match the exported deltas");
  assert.equal(pack.targetRig, "def-humanoid-v1", "target rig must match the runtime skeleton");
  assert.equal(pack.targetBoneNames.length, 24, "the pack must cover the 24-bone DEF runtime rig");

  for (const field of [
    "sourceBoneNames",
    "mappedSourceBones",
    "unmappedSourceBones",
    "targetBoneNames",
    "unmappedTargetBones",
    "synthesizedTargetBones",
  ]) {
    assert.ok(
      Object.hasOwn(pack, field) && Array.isArray(pack[field]),
      `manifest.pack.${field} must contain the generated mapping list`,
    );
  }

  const mappedSourceBones = new Set(pack.mappedSourceBones);
  const expectedUnmappedSourceBones = pack.sourceBoneNames
    .filter((boneName) => !mappedSourceBones.has(boneName))
    .sort();
  assert.deepEqual(
    [...pack.unmappedSourceBones].sort(),
    expectedUnmappedSourceBones,
    "unmapped source bones must be exactly sourceBoneNames minus mappedSourceBones",
  );
  assert.equal(
    pack.unmappedSourceBones.length,
    15,
    "the observed Mixamo source rig has 15 intentionally unmapped end/finger bones",
  );

  const mappingRows = pack.boneMapping?.rows ?? manifest.boneMapping?.rows;
  assert.ok(Array.isArray(mappingRows), "the manifest must expose target/source mapping rows");
  const mappedTargetBones = new Set(mappingRows.map((row) => row.targetBoneName));
  const expectedUnmappedTargetBones = pack.targetBoneNames
    .filter((boneName) => !mappedTargetBones.has(boneName))
    .sort();
  assert.deepEqual(
    [...pack.unmappedTargetBones].sort(),
    expectedUnmappedTargetBones,
    "unmapped target bones must reflect the target names absent from the mapping rows",
  );

  const expectedSources = new Map([
    ["idle", "Unarmed Idle.fbx"],
    ["move", "Walking.fbx"],
    ["run", "Running.fbx"],
    ["hit", "Standing React Small From Left.fbx"],
    ["bighit", "Receive Uppercut To The Face.fbx"],
    ["attack", "Punching.fbx"],
    ["critical", "Illegal Elbow Punch.fbx"],
    ["avoid", "Dodging.fbx"],
    ["defence", "Body Block.fbx"],
  ]);
  const auditByFile = new Map(audit.files.map((entry) => [entry.file, entry]));

  assert.ok(
    Object.hasOwn(pack, "clipOverrides") && Array.isArray(pack.clipOverrides),
    "clip overrides must live inside manifest.pack",
  );
  assert.equal(pack.clipOverrides.length, expectedSources.size, "the pack must define all nine overrides");
  for (const override of pack.clipOverrides) {
    const expectedSource = expectedSources.get(override.action);
    assert.ok(expectedSource, `unknown override action ${override.action}`);
    assert.equal(override.source, expectedSource, `${override.action} must use its approved measured source`);
    assert.equal(override.sourceFile, expectedSource, `${override.action} sourceFile must match its source`);
    assert.equal(
      override.clipName,
      `unarmed-core::${override.action}::v01`,
      `${override.action} must use the raw pack clip naming contract`,
    );

    const observed = auditByFile.get(expectedSource);
    assert.ok(observed?.import_success, `${expectedSource} must have a successful observed FBX audit`);
    assert.equal(observed.metrics.scene_fps, 24, `${expectedSource} must be observed at 24 fps`);
    assert.equal(override.sourceFps, 24, `${override.action} must retain the observed 24 fps`);
    assert.equal(
      override.frameStart,
      observed.metrics.frame_range.start,
      `${override.action} frameStart must come from the observed audit`,
    );
    assert.equal(
      override.frameEnd,
      observed.metrics.frame_range.end,
      `${override.action} frameEnd must come from the observed audit`,
    );
    const expectedDuration = (override.frameEnd - override.frameStart) / 24;
    assert.ok(
      Math.abs(override.durationSeconds - expectedDuration) <= Number.EPSILON,
      `${override.action} duration must be (frameEnd - frameStart) / 24`,
    );
  }

  for (const check of [
    "glb2",
    "animationOnly",
    "finiteKeyframes",
    "onlyTargetBoneTracks",
    "rotationOnly",
    "restRelativeDeltas",
    "inPlaceRoot",
    "loopClosure",
  ]) {
    assert.equal(manifest.checks[check], true, `manifest check ${check} must pass`);
  }
});

// 2. GLB Structural Verification
test("raw pack contains only nine finite local quaternion-delta clips", () => {
  assert.ok(existsSync(PACK_GLB_PATH), `unarmed-core.glb should exist at ${PACK_GLB_PATH}`);
  const { json, bin } = readGlb(PACK_GLB_PATH);

  assert.ok(!json.meshes || json.meshes.length === 0, "the shared delta pack must contain no meshes");
  assert.ok(!json.materials || json.materials.length === 0, "the shared delta pack must contain no materials");
  assert.ok(!json.textures || json.textures.length === 0, "the shared delta pack must contain no textures");
  assert.ok(!json.images || json.images.length === 0, "the shared delta pack must contain no images");

  const expectedClipNames = [
    "unarmed-core::idle::v01",
    "unarmed-core::move::v01",
    "unarmed-core::run::v01",
    "unarmed-core::hit::v01",
    "unarmed-core::bighit::v01",
    "unarmed-core::attack::v01",
    "unarmed-core::critical::v01",
    "unarmed-core::avoid::v01",
    "unarmed-core::defence::v01",
  ];
  assert.deepEqual(
    json.animations.map((animation) => animation.name).sort(),
    [...expectedClipNames].sort(),
    "the raw pack must contain exactly one clip for every override action",
  );

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const targetBoneNames = new Set(manifest.pack.targetBoneNames);
  for (const animation of json.animations) {
    for (const channel of animation.channels) {
      const targetNodeName = json.nodes[channel.target.node].name;
      assert.ok(targetBoneNames.has(targetNodeName), `${animation.name} targets unknown bone ${targetNodeName}`);
      assert.equal(
        channel.target.path,
        "rotation",
        `${animation.name} must contain local quaternion deltas, never position or scale tracks`,
      );
    }
    for (const sampler of animation.samplers) {
      for (const values of [
        ...readAccessor(json, bin, sampler.input).values,
        ...readAccessor(json, bin, sampler.output).values,
      ]) {
        for (const value of values) {
          assert.ok(Number.isFinite(value), `${animation.name} contains a non-finite keyframe value`);
        }
      }
    }
  }
});

// 3. Promoted character GLBs are self-contained and publicly routable
test("public motion registry exports 11 self-contained promoted character GLBs", async () => {
  const { MOTION_MODELS, meshRootForMotionCharacter } = await rendererModule;
  const expectedRegistry = Object.fromEntries(
    PROMOTED_ASSET_IDS.map((assetId) => [
      assetId,
      `assets/motion/ingame/characters/${assetId}/model.glb`,
    ]),
  );

  assert.deepEqual(
    MOTION_MODELS,
    expectedRegistry,
    "the public motion registry must expose the complete promoted character library",
  );
  for (const [assetId, relPath] of Object.entries(expectedRegistry)) {
    assert.equal(
      meshRootForMotionCharacter(assetId),
      relPath,
      `${assetId} must resolve to its own promoted character model`,
    );
    const fullPath = resolve(ROOT, relPath);
    assert.ok(existsSync(fullPath), `promoted character GLB must exist: ${relPath}`);
    const { json } = readGlb(fullPath);
    assert.ok(json.meshes?.length > 0, `${assetId} must carry its renderable mesh`);
    assert.ok(json.skins?.length > 0, `${assetId} must carry its rig`);
    assert.deepEqual(
      json.animations.map(({ name }) => name).sort(),
      CANONICAL_BASE_ACTIONS.map((action) => `${assetId}::${action}::v01`).sort(),
      `${assetId} must carry exactly the canonical 11 namespaced base clips`,
    );
  }
  assert.equal(
    meshRootForMotionCharacter("not-in-the-motion-library"),
    null,
    "unknown motion asset IDs must not alias a promoted character",
  );
});

test("raw promoted GLBs contain normalized sign-continuous rotation accessors", async () => {
  const { MOTION_MODELS } = await rendererModule;

  for (const [assetId, relPath] of Object.entries(MOTION_MODELS)) {
    const { json, bin } = readGlb(resolve(ROOT, relPath));
    for (const animation of json.animations) {
      for (const channel of animation.channels) {
        if (channel.target.path !== "rotation") continue;

        const nodeName = json.nodes[channel.target.node].name;
        const outputAccessorIndex = animation.samplers[channel.sampler].output;
        const outputAccessor = json.accessors[outputAccessorIndex];
        const label = `${assetId}/${animation.name}/${nodeName}`;
        assert.equal(
          outputAccessor.componentType,
          5126,
          `${label}: rotation output accessor ${outputAccessorIndex} must use FLOAT components`,
        );
        assert.equal(
          outputAccessor.type,
          "VEC4",
          `${label}: rotation output accessor ${outputAccessorIndex} must contain VEC4 quaternions`,
        );

        const quaternions = readAccessor(json, bin, outputAccessorIndex).values;
        let previous = null;
        for (let key = 0; key < quaternions.length; key += 1) {
          const quaternion = quaternions[key];
          for (const value of quaternion) {
            assert.ok(Number.isFinite(value), `${label}: key ${key} contains a non-finite quaternion value`);
          }

          const length = Math.hypot(...quaternion);
          assert.ok(
            Math.abs(length - 1) <= 1e-6,
            `${label}: key ${key} quaternion length ${length} exceeds the 1e-6 normalization tolerance`,
          );
          const normalized = quaternion.map((value) => value / length);
          if (previous) {
            const dot = normalized.reduce((sum, value, component) => (
              sum + value * previous[component]
            ), 0);
            assert.ok(
              dot >= -1e-6,
              `${label}: adjacent keys ${key - 1}/${key} have discontinuous normalized dot ${dot}`,
            );
          }
          previous = normalized;
        }
      }
    }
  }
});

// 4. A failed promoted override falls back to the actor's standard promoted model
test("failed promoted model load recovers with the standard actor base clips", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await rendererModule;
  const adapter = createHarness(RealtimeBattle);
  rejectedModelPath = MOTION_MODELS.guard;
  try {
    const record = adapter.ensureActor(
      { id: "guard-load-failure", kind: "rusher", motionAssetId: "guard" },
      "enemy",
    );
    await waitFor(() => !record.loading, "actor did not finish loading after promoted model failure");

    assert.ok(record.root, "the standard actor model must render when the promoted override fails");
    assert.ok(record.mixer, "the standard actor model must retain its animation mixer");
    assert.equal(
      record.modelPath,
      MOTION_MODELS.scout,
      "a failed rusher override must fall back to the standard scout model",
    );
    assert.deepEqual(
      Object.keys(record.actions).sort(),
      [...CANONICAL_BASE_ACTIONS].sort(),
      "the fallback actor must retain the complete canonical base action set",
    );
    for (const action of CANONICAL_BASE_ACTIONS) {
      if (OVERLAY_ACTIONS.has(action)) {
        assert.equal(record.actionSources[action], "overlay", `fallback ${action} must come from overlay pack`);
        assert.equal(
          record.actions[action].getClip().name,
          `unarmed-core::${action}::v01`,
          `fallback ${action} must use the overlay namespace`,
        );
      } else {
        assert.equal(record.actionSources[action], "base", `fallback ${action} must come from the scout model`);
        assert.equal(
          record.actions[action].getClip().name,
          `scout::${action}::v01`,
          `fallback ${action} must retain the scout namespace`,
        );
      }
    }
  } finally {
    rejectedModelPath = null;
    adapter.dispose();
  }
});

// 5. Live routing uses each promoted model's own base action library
test("runtime routes all promoted rigs to their namespaced base action clips", async () => {
  const { MOTION_MODELS, RealtimeBattle } = await rendererModule;
  const routingCases = [
    {
      label: "commander",
      assetId: "human-command-boss",
      entity: { id: "commander" },
      kind: "commander",
    },
    {
      label: "ember-cohort companion",
      assetId: "ember-cohort",
      entity: { id: "ember-cohort-runtime", kind: "companion", companionId: "ember-cohort" },
      kind: "companion",
    },
    {
      label: "lantern-reaver companion",
      assetId: "lantern-reaver",
      entity: { id: "lantern-reaver-runtime", kind: "companion", companionId: "lantern-reaver" },
      kind: "companion",
    },
    {
      label: "rusher",
      assetId: "scout",
      entity: { id: "scout-runtime", kind: "rusher" },
      kind: "enemy",
    },
    {
      label: "flanker",
      assetId: "shade",
      entity: { id: "shade-runtime", kind: "flanker" },
      kind: "enemy",
    },
    {
      label: "guardian",
      assetId: "shadow-soldier-v04",
      entity: { id: "guardian-runtime", kind: "guardian" },
      kind: "enemy",
    },
    {
      label: "ranged enemy",
      assetId: "possessed",
      entity: { id: "possessed-runtime", kind: "ranged" },
      kind: "enemy",
    },
    ...[
      "broken-court-monarch-boss",
      "broken-court-monarch-v04",
      "guard",
      "shadow-commander-boss",
    ].map((assetId) => ({
      label: `explicit ${assetId}`,
      assetId,
      entity: { id: `${assetId}-runtime`, kind: "rusher", motionAssetId: assetId },
      kind: "enemy",
    })),
  ];

  assert.deepEqual(
    routingCases.map(({ assetId }) => assetId).sort(),
    PROMOTED_ASSET_IDS,
    "runtime cases must cover every public promoted motion asset",
  );

  const adapter = createHarness(RealtimeBattle);
  try {
    for (const routingCase of routingCases) {
      const record = adapter.ensureActor(routingCase.entity, routingCase.kind);
      await waitFor(() => !record.loading, `${routingCase.label} actor did not finish loading`);

      assert.ok(record.root, `${routingCase.label} actor root must exist`);
      assert.ok(record.mixer, `${routingCase.label} actor mixer must exist`);
      assert.equal(
        record.modelPath,
        MOTION_MODELS[routingCase.assetId],
        `${routingCase.label} must use its routed promoted model`,
      );
      assert.deepEqual(
        Object.keys(record.actions).sort(),
        [...CANONICAL_BASE_ACTIONS].sort(),
        `${routingCase.label} must expose the complete canonical base action set`,
      );
      for (const action of CANONICAL_BASE_ACTIONS) {
        if (OVERLAY_ACTIONS.has(action)) {
          assert.equal(record.actionSources[action], "overlay", `${routingCase.label} ${action} must come from overlay pack`);
          assert.equal(
            record.actions[action].getClip().name,
            `unarmed-core::${action}::v01`,
            `${routingCase.label} ${action} must use the overlay namespace`,
          );
        } else {
          assert.equal(record.actionSources[action], "base", `${routingCase.label} ${action} must come from its promoted model`);
          assert.equal(
            record.actions[action].getClip().name,
            `${routingCase.assetId}::${action}::v01`,
            `${routingCase.label} ${action} must retain the promoted asset namespace`,
          );
        }
      }

    }

  } finally {
    adapter.dispose();
  }
});
