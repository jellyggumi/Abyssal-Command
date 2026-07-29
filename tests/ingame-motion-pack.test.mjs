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
const DUSK_WARDEN_PATH = join(ROOT, "assets/images/battle/glb/commander/dusk-warden.glb");
const AUDIT_REPORT_PATH = join(
  ROOT,
  "_workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report-FULL-OBSERVED.json",
);

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

function loadGltfFile(loader, path, resourcePath = path) {
  return new Promise((fulfill, rejectLoad) => {
    const buf = readFileSync(path);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    loader.parse(arrayBuffer, resourcePath, fulfill, rejectLoad);
  });
}

function quaternionTrackBoneName(trackName) {
  const suffix = ".quaternion";
  if (!trackName.endsWith(suffix)) return null;
  const nodePath = trackName.slice(0, -suffix.length);
  const bonesMatch = nodePath.match(/\.bones\[([^\]]+)\]$/);
  if (bonesMatch) return bonesMatch[1];
  return nodePath.slice(nodePath.lastIndexOf("/") + 1);
}

function quaternionAt(track, keyframeIndex) {
  return new THREE.Quaternion().fromArray(track.values, keyframeIndex * 4).normalize();
}

function doubleCoverQuaternionAngle(left, right) {
  const dot = Math.min(1, Math.max(-1, Math.abs(left.dot(right))));
  return 2 * Math.acos(dot);
}

function assertQuaternionAngleWithin(actual, expected, epsilon, message) {
  const angle = doubleCoverQuaternionAngle(actual, expected);
  assert.ok(angle <= epsilon, `${message}; double-cover angle ${angle} exceeds ${epsilon}`);
}

function isNonconstantQuaternionTrack(track, epsilon = 1e-5) {
  const first = quaternionAt(track, 0);
  for (let index = 1; index < track.values.length / 4; index += 1) {
    if (doubleCoverQuaternionAngle(first, quaternionAt(track, index)) > epsilon) return true;
  }
  return false;
}

function snapshotLocalPositions(root) {
  const positions = new Map();
  root.traverse((object) => positions.set(object, object.position.clone()));
  return positions;
}

function assertLocalPositionsUnchanged(positions, message) {
  for (const [object, expected] of positions) {
    assert.ok(object.position.equals(expected), `${message}: ${object.name || object.type}`);
  }
}

// Intercept GLTFLoader.prototype.load to load real files from disk
let simulateOverlayLoadFailure = false;

const originalLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  if (url === "assets/motion/ingame/unarmed-core.glb" || url === "./assets/motion/ingame/unarmed-core.glb") {
    if (simulateOverlayLoadFailure) {
      queueMicrotask(() => {
        onError(new Error("Simulated overlay load failure"));
      });
      return this;
    }
  }
  try {
    const filePath = resolve(ROOT, url);
    const buf = readFileSync(filePath);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    this.parse(arrayBuffer, url, onLoad, (err) => {
      console.error(`GLTFLoader.parse error for ${url}:`, err);
      if (onError) onError(err);
    });
  } catch (err) {
    if (url === "assets/motion/ingame/unarmed-core.glb" || url === "./assets/motion/ingame/unarmed-core.glb") {
      // Expected ENOENT warning in production fallback test
      if (onError) {
        queueMicrotask(() => onError(err));
      }
    } else {
      console.error(`Mock loader readFileSync error for ${url}:`, err);
      if (onError) {
        queueMicrotask(() => onError(err));
      }
    }
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

// 1. Manifest structure, mappings, and meshes
test("manifest records the measured source and complete retarget contract", () => {
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
      `${override.action} must use the runtime clip naming contract`,
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

  assert.deepEqual(
    manifest.fallbackActions,
    ["die", "show", "attack_melee", "attack_ranged"],
    "the overlay must preserve the four authored fallback action keys",
  );
  assert.equal(manifest.compatibleMeshes.length, 24, "all 24 compatible runtime meshes must be listed");
  for (const relPath of manifest.compatibleMeshes) {
    assert.ok(!relPath.includes("assets/motion/bench"), `bench input leaked into compatibleMeshes: ${relPath}`);
    assert.ok(!relPath.endsWith(".fbx"), `FBX input leaked into compatibleMeshes: ${relPath}`);
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
  assert.equal(manifest.runtimeEligible, true, "the generated pack must pass every runtime gate");
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

  const targetGlb = readGlb(DUSK_WARDEN_PATH);
  const targetBoneNames = new Set(
    targetGlb.json.skins[0].joints.map((joint) => targetGlb.json.nodes[joint].name),
  );
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

// 3. Compatible character GLBs contain the target bone names
test("compatible character GLBs contain target bone names", () => {
  const duskWardenGlb = readGlb(DUSK_WARDEN_PATH);
  const duskWardenJoints = duskWardenGlb.json.skins[0].joints.map(j => duskWardenGlb.json.nodes[j].name);
  
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  for (const relPath of manifest.compatibleMeshes) {
    const fullPath = resolve(ROOT, relPath);
    assert.ok(existsSync(fullPath), `character GLB must exist: ${relPath}`);
    const charGlb = readGlb(fullPath);
    const nodeNames = new Set(charGlb.json.nodes.map(n => n.name));
    
    for (const bone of duskWardenJoints) {
      assert.ok(nodeNames.has(bone), `compatible mesh ${relPath} is missing bone ${bone}`);
    }
  }
});

// 4. Runtime behavior test: overlay precedence, fallback, and failed overlay load recovery
test("runtime overlay wins while authored fallbacks and load-failure actors survive", async () => {
  const { RealtimeBattle } = await rendererModule;
  const overlayActions = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).pack.clipOverrides;

  const failureAdapter = createHarness(RealtimeBattle);
  simulateOverlayLoadFailure = true;
  try {
    const failedOverlayActor = failureAdapter.ensureActor({ id: "commander" }, "commander");
    await waitFor(
      () => !failedOverlayActor.loading,
      "commander actor did not finish loading under overlay failure simulation",
    );
    assert.ok(failedOverlayActor.root, "the base actor must still be created when the overlay load fails");
    assert.ok(failedOverlayActor.mixer, "the base actor mixer must still be created when the overlay load fails");
    for (const key of ["attack", "die", "show", "attack_melee", "attack_ranged"]) {
      assert.equal(failedOverlayActor.actionSources[key], "base", `${key} must fall back to the authored base clip`);
      assert.equal(
        failedOverlayActor.actions[key].getClip().name,
        `dusk-warden::${key}::v01`,
        `${key} must retain its authored dusk-warden clip`,
      );
    }
  } finally {
    simulateOverlayLoadFailure = false;
    failureAdapter.dispose();
  }

  const adapter = createHarness(RealtimeBattle);
  const actors = [
    {
      name: "dusk-warden",
      kind: "commander",
      entity: { id: "commander" },
      fallbackActions: ["die", "show", "attack_melee", "attack_ranged"],
    },
    {
      name: "scout",
      kind: "enemy",
      entity: { id: "scout-actor", kind: "rusher" },
      fallbackActions: ["die", "show"],
    },
    {
      name: "bridge-colossus",
      kind: "boss",
      entity: { id: "colossus-actor", class: "boss", bossId: "s8-bridge-colossus" },
      fallbackActions: ["die", "show"],
    },
  ];

  try {
    for (const actor of actors) {
      const record = adapter.ensureActor(actor.entity, actor.kind);
      await waitFor(() => !record.loading, `${actor.name} actor did not finish loading`);
      assert.ok(record.root, `${actor.name} actor root must exist`);
      assert.ok(record.mixer, `${actor.name} actor mixer must exist`);

      for (const override of overlayActions) {
        assert.equal(
          record.actionSources[override.action],
          "overlay",
          `${actor.name} ${override.action} must prefer the overlay`,
        );
        assert.equal(
          record.actions[override.action].getClip().name,
          override.clipName,
          `${actor.name} ${override.action} must expose the adapted overlay clip`,
        );
      }

      for (const key of actor.fallbackActions) {
        assert.equal(record.actionSources[key], "base", `${actor.name} ${key} must remain authored fallback`);
        assert.equal(
          record.actions[key].getClip().name,
          `${actor.name}::${key}::v01`,
          `${actor.name} ${key} fallback must retain its authored clip`,
        );
      }
    }
  } finally {
    adapter.dispose();
  }
});

// 5. Cross-rig test for attack clip rotation tracks
test("runtime composes cached attack deltas with each target rig rest pose", async () => {
  const loader = new GLTFLoader();
  const packGltf = await loadGltfFile(loader, PACK_GLB_PATH, PACK_GLB_PATH);
  const rawAttackClip = packGltf.animations.find(
    (animation) => animation.name === "unarmed-core::attack::v01",
  );
  assert.ok(rawAttackClip, "the raw pack must contain the attack delta clip");

  const rawCandidates = rawAttackClip.tracks.filter(
    (track) => track.name.endsWith(".quaternion") && isNonconstantQuaternionTrack(track),
  );
  assert.ok(rawCandidates.length > 0, "the attack clip must contain a nonconstant quaternion delta track");

  const { RealtimeBattle } = await rendererModule;
  const adapter = createHarness(RealtimeBattle);
  const rigs = [
    {
      name: "scout",
      kind: "enemy",
      entity: { id: "cross-rig-scout", kind: "rusher" },
    },
    {
      name: "bridge-colossus",
      kind: "boss",
      entity: { id: "cross-rig-colossus", class: "boss", bossId: "s8-bridge-colossus" },
    },
    {
      name: "dusk-warden",
      kind: "commander",
      entity: { id: "commander" },
    },
  ];
  const angleEpsilon = 1e-5;

  try {
    for (const rig of rigs) {
      const record = adapter.ensureActor(rig.entity, rig.kind);
      await waitFor(() => !record.loading, `${rig.name} actor did not finish loading`);
      assert.ok(record.root, `${rig.name} actor root must exist`);
      assert.equal(record.actionSources.attack, "overlay", `${rig.name} attack must use the overlay`);

      const adaptedClip = record.actions.attack.getClip();
      const candidate = rawCandidates
        .map((rawTrack) => {
          const boneName = quaternionTrackBoneName(rawTrack.name);
          const bone = record.root.getObjectByName(boneName);
          const adaptedTrack = adaptedClip.tracks.find(
            (track) => quaternionTrackBoneName(track.name) === boneName,
          );
          if (!bone?.isBone || !adaptedTrack) return null;
          const restQuaternion = bone.quaternion.clone().normalize();
          const rawFirst = quaternionAt(rawTrack, 0);
          const composedFirst = restQuaternion.clone().multiply(rawFirst).normalize();
          return doubleCoverQuaternionAngle(composedFirst, rawFirst) > 1e-3
            ? { rawTrack, adaptedTrack, bone, boneName, restQuaternion }
            : null;
        })
        .find(Boolean);
      assert.ok(
        candidate,
        `${rig.name} must expose a nonconstant mapped track whose rest-relative result differs from the raw delta`,
      );

      const { rawTrack, adaptedTrack, bone, boneName, restQuaternion } = candidate;
      assert.deepEqual(
        Array.from(adaptedTrack.times),
        Array.from(rawTrack.times),
        `${rig.name} adapted track must preserve attack keyframe times`,
      );
      assert.equal(
        adaptedTrack.values.length,
        rawTrack.values.length,
        `${rig.name} adapted track must preserve every attack delta key`,
      );
      for (let index = 0; index < rawTrack.values.length / 4; index += 1) {
        const delta = quaternionAt(rawTrack, index);
        const expected = restQuaternion.clone().multiply(delta).normalize();
        const actual = quaternionAt(adaptedTrack, index);
        assertQuaternionAngleWithin(
          actual,
          expected,
          angleEpsilon,
          `${rig.name} ${boneName} key ${index} must equal qRestTarget * qDelta`,
        );
      }

      const localPositions = snapshotLocalPositions(record.root);
      record.mixer.stopAllAction();
      record.actions.attack.reset().play();
      record.mixer.setTime(0);

      const rawAtZero = quaternionAt(rawTrack, 0);
      const expectedAtZero = restQuaternion.clone().multiply(rawAtZero).normalize();
      assertQuaternionAngleWithin(
        bone.quaternion.clone().normalize(),
        expectedAtZero,
        angleEpsilon,
        `${rig.name} ${boneName} must receive the composed quaternion at t=0`,
      );
      assert.ok(
        doubleCoverQuaternionAngle(bone.quaternion.clone().normalize(), rawAtZero) > 1e-3,
        `${rig.name} ${boneName} must not receive the raw delta as an absolute quaternion at t=0`,
      );
      assertLocalPositionsUnchanged(
        localPositions,
        `${rig.name} local position changed when the attack started`,
      );

      record.mixer.update(adaptedClip.duration / 2);
      assertLocalPositionsUnchanged(
        localPositions,
        `${rig.name} local position changed while the attack played`,
      );
      record.actions.attack.stop();
    }
  } finally {
    adapter.dispose();
  }
});
