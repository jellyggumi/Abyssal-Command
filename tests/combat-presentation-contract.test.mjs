import assert from "node:assert/strict";
import { after, test } from "node:test";

import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { stageWorldFor, STAGE_WORLD_PROFILES } from "../stage-world-catalog.js";
import { createDefenseRun, getRunSnapshot } from "../defense-run-simulation.js";
// The transient VFX pool budget is authored by the renderer. Importing it keeps these
// assertions about "the pool stays capped at its authored budget" rather than about a
// number that has to be edited in two files whenever the budget moves.
import { MAX_VISUAL_EFFECTS } from "../battle-realtime-three.js";

// Mirrors the rig pipeline's authored library so the harness exercises the same
// beat set the deployed characters carry, not a subset.
const COMBAT_CLIP_KEYS = [
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

function syntheticRig() {
  const scene = new THREE.Group();
  scene.name = "synthetic-rig";
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.5, 0.35),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  body.position.y = 0.75;
  scene.add(body);
  const spine = new THREE.Bone();
  spine.name = "DEF-spine";
  const chest = new THREE.Bone();
  chest.name = "DEF-chest";
  const head = new THREE.Bone();
  head.name = "DEF-head";
  const offhand = new THREE.Bone();
  offhand.name = "DEF-hand.L";
  spine.add(chest);
  chest.add(head, offhand);
  scene.add(spine);
  const animations = COMBAT_CLIP_KEYS.map((key) => new THREE.AnimationClip(`synthetic::${key}::v01`, 0.05, []));
  return { scene, animations };
}

// RealtimeBattle's real actor-loading path is exercised while only the network
// boundary is replaced. The scene graph, SkeletonUtils clone, AnimationMixer,
// action selection, reconciliation, and cleanup remain the production code.
const gltfRequests = [];
const gltfFailuresRemaining = new Map();

// Every authored stage VFX cue, keyed by the request URL RealtimeBattle
// actually issues (modelUrl() prefixes catalog-relative paths with "./").
// The synthetic response below must expose the cue's qualityGroups node
// names and its exact loop clip so the mixer/clip contract is genuinely
// exercised instead of silently no-op-ing on a missing match.
const stageVfxCueByUrl = new Map();
for (const profile of Object.values(STAGE_WORLD_PROFILES)) {
  for (const cue of profile.presentation.vfxCues ?? []) {
    stageVfxCueByUrl.set(`./${cue.modelPath}`, cue);
  }
}

const stagePropNodesByUrl = new Map();
for (const profile of Object.values(STAGE_WORLD_PROFILES)) {
  for (const prop of profile.presentation.props ?? []) {
    if (!prop.modelNode) continue;
    const requestUrl = `./${prop.modelPath}`;
    if (!stagePropNodesByUrl.has(requestUrl)) stagePropNodesByUrl.set(requestUrl, new Set());
    stagePropNodesByUrl.get(requestUrl).add(prop.modelNode);
  }
}
const staticPropPacksByUrl = new Map();

function syntheticStaticPropPack(requestUrl) {
  const scene = new THREE.Group();
  scene.name = "synthetic-static-prop-pack";
  for (const modelNode of stagePropNodesByUrl.get(requestUrl) ?? []) {
    const node = new THREE.Group();
    node.name = modelNode;
    node.userData.syntheticModelNode = modelNode;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -0.5, 0, -0.5,
      0.5, 0, -0.5,
      0.5, 1, 0.5,
      -0.5, 0, -0.5,
      0.5, 1, 0.5,
      -0.5, 1, 0.5,
    ], 3));
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    node.add(mesh);
    scene.add(node);
  }
  const gltf = { scene, animations: [] };
  staticPropPacksByUrl.set(requestUrl, gltf);
  return gltf;
}

function syntheticStageVfxRig(cue) {
  const scene = new THREE.Group();
  scene.name = "synthetic-stage-vfx";
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial());
  core.name = cue.qualityGroups.core;
  scene.add(core);
  const detail = new THREE.Group();
  detail.name = cue.qualityGroups.detail;
  scene.add(detail);
  const decor = new THREE.Group();
  decor.name = cue.qualityGroups.decor;
  scene.add(decor);
  const animations = [new THREE.AnimationClip(cue.clip, 0.05, [])];
  return { scene, animations };
}

const originalGltfLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function loadSyntheticRig(url, onLoad, _onProgress, onError) {
  const requestUrl = String(url);
  gltfRequests.push(requestUrl);
  queueMicrotask(() => {
    const failuresRemaining = gltfFailuresRemaining.get(requestUrl) ?? 0;
    if (failuresRemaining > 0) {
      if (failuresRemaining === 1) gltfFailuresRemaining.delete(requestUrl);
      else gltfFailuresRemaining.set(requestUrl, failuresRemaining - 1);
      onError(new Error(`Synthetic GLB load failure: ${requestUrl}`));
      return;
    }
    const stageVfxCue = stageVfxCueByUrl.get(requestUrl);
    if (stageVfxCue) {
      onLoad(syntheticStageVfxRig(stageVfxCue));
      return;
    }
    if (stagePropNodesByUrl.has(requestUrl)) {
      onLoad(syntheticStaticPropPack(requestUrl));
      return;
    }
    const gltf = syntheticRig();
    onLoad(gltf);
  });
  return this;
};
after(() => {
  GLTFLoader.prototype.load = originalGltfLoad;
});


const rendererModule = import(`../battle-realtime-three.js?combat-presentation-contract=${Date.now()}`);

function realtimeBattleHarness(RealtimeBattle) {
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

function snapshotRenderHarness(RealtimeBattle, options = {}) {
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reducedMotion = options.reducedMotion === true;
  adapter.canvas = { width: 640, height: 360, dataset: {} };
  adapter.viewport = { width: 640, height: 360 };
  adapter.rimLight = new THREE.DirectionalLight();
  adapter.rimLightTarget = new THREE.Object3D();
  adapter.renderer = {
    info: { memory: { geometries: 0, textures: 0 }, programs: [] },
    getSize(target) { return target.set(640, 360); },
    setSize() {},
    setClearColor() {},
    render() {},
    dispose() {},
  };
  adapter.ensureStageTerrain = () => {};
  return adapter;
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(message);
}

async function settleLoadedActors(adapter, ids) {
  await waitFor(
    () => ids.every((id) => adapter.debugPresentationState(id)?.hasMixer === true),
    "the synthetic rigs did not finish loading",
  );
  // Loaded actors may first play their authored one-shot entrance. Advancing
  // its real AnimationMixer proves that completion recovers to standing idle.
  adapter.lastAnimMs = 0;
  adapter.updateAnimations(100);
  assert.ok(
    ids.every((id) => adapter.debugPresentationState(id)?.activeActionKey === "idle"),
    "loaded stationary actors must recover from their entrance into idle",
  );
}

function worldX(x) {
  return (x / 24000 * 2 - 1) * 14;
}

function worldZ(y) {
  return (y / 12000 * 2 - 1) * 14;
}

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

function assertMeshIntegrity(report, label) {
  assert.ok(report && typeof report === "object", `${label}: missing mesh integrity report`);
  for (const key of ["meshCount", "vertexCount", "triangleCount"]) {
    assert.ok(Number.isFinite(report[key]) && report[key] > 0, `${label}: ${key} must be finite and nonzero`);
  }
  assert.equal(report.invalidVertexCount, 0, `${label}: vertices must remain finite`);
  assert.equal(report.invalidIndexCount, 0, `${label}: indices must remain valid`);
  assert.equal(report.finiteBounds, true, `${label}: bounds must remain finite`);
}

test("projectile families publish distinct geometry, material, and motion contracts", async () => {
  const { projectilePresentationFor } = await rendererModule;
  const inputs = [
    [{ id: "orb-shot", owner: "throne-echo" }, { role: "support" }],
    [{ id: "bolt-shot", owner: "ember-cohort" }, { role: "ranged" }],
    [{ id: "slash-shot", owner: "anchor-shard" }, { role: "vanguard" }],
  ];
  const descriptors = inputs.map(([projectile, source]) => projectilePresentationFor(projectile, source));

  assert.deepEqual(descriptors.map(({ family }) => family), ["orb", "bolt", "slash"]);
  for (const field of ["geometry", "material", "motion"]) {
    assert.equal(new Set(descriptors.map((descriptor) => descriptor[field])).size, 3, `${field} metadata must distinguish all projectile families`);
    assert.ok(descriptors.every((descriptor) => typeof descriptor[field] === "string" && descriptor[field].length > 0));
  }
  assert.ok(descriptors.every(Object.isFrozen), "presentation descriptors are immutable catalog values");
  assert.strictEqual(
    projectilePresentationFor(inputs[0][0], inputs[0][1]),
    descriptors[0],
    "the same snapshot identity deterministically resolves the same descriptor",
  );
});

test("projectile scene graphs are family-specific and continue to follow snapshot travel", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const first = {
    tick: 1,
    enemies: [
      { id: "orb-source", kind: "ranged", role: "support", x: 6000, y: 6000 },
      { id: "bolt-source", kind: "ranged", role: "ranged", x: 6000, y: 6000 },
      { id: "slash-source", kind: "rusher", role: "vanguard", x: 6000, y: 6000 },
      { id: "target", kind: "guardian", x: 18000, y: 6000 },
    ],
    projectiles: [
      { id: "orb-shot", sourceId: "orb-source", targetId: "target", owner: "throne-echo", ttl: 5, x: 6000, y: 6000 },
      { id: "bolt-shot", sourceId: "bolt-source", targetId: "target", owner: "ember-cohort", ttl: 5, x: 6000, y: 6000 },
      { id: "slash-shot", sourceId: "slash-source", targetId: "target", owner: "anchor-shard", ttl: 5, x: 6000, y: 6000 },
    ],
  };
  const frozenFirst = structuredClone(first);
  adapter.reconcileActors(first);
  assert.deepEqual(first, frozenFirst, "presentation reconciliation must not mutate simulation snapshots");

  const initial = first.projectiles.map(({ id }) => adapter.debugPresentationState(id));
  assert.deepEqual(initial.map(({ projectileFamily }) => projectileFamily), ["orb", "bolt", "slash"]);
  assert.equal(new Set(initial.map(({ presentation }) => presentation.geometry)).size, 3);
  assert.equal(new Set(initial.map(({ presentation }) => presentation.material)).size, 3);
  assert.equal(new Set(initial.map(({ presentation }) => presentation.motion)).size, 3);

  const coreGeometryTypes = first.projectiles.map(({ id }) => (
    adapter.actors.get(id).root.getObjectByName("projectile-core").geometry.type
  ));
  const coreColors = first.projectiles.map(({ id }) => (
    adapter.actors.get(id).root.getObjectByName("projectile-core").material.color.getHex()
  ));
  assert.equal(new Set(coreGeometryTypes).size, 3, "orb, bolt, and slash may not collapse to one generic sphere geometry");
  assert.equal(new Set(coreColors).size, 3, "orb, bolt, and slash must carry distinct material treatment");

  const second = structuredClone(first);
  second.tick = 2;
  second.enemies.find(({ id }) => id === "target").x = 21000;
  for (const projectile of second.projectiles) {
    projectile.ttl = 2;
    projectile.x = 9000;
  }
  adapter.reconcileActors(second);

  for (let index = 0; index < second.projectiles.length; index += 1) {
    const state = adapter.debugPresentationState(second.projectiles[index].id);
    assert.ok(state.travelProgress > initial[index].travelProgress, `${state.projectileFamily} advances when snapshot ttl decreases`);
    const expectedX = worldX(9000) + (worldX(21000) - worldX(9000)) * state.travelProgress;
    assertNear(state.position.x, expectedX, `${state.projectileFamily} consumes the latest snapshot source and target positions`);
  }

  adapter.reconcileActors({ tick: 3, enemies: second.enemies, projectiles: [] });
  assert.deepEqual(adapter.debugPresentationState().projectiles, [], "projectiles absent from the next snapshot are retired");
  adapter.dispose();
});

test("a newly loaded stationary actor enters bounded ambient idle instead of a T-pose", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [{ id: "idle-actor", kind: "rusher", x: 12000, y: 6000 }],
  });
  await settleLoadedActors(adapter, ["idle-actor"]);

  const samples = [];
  for (let nowMs = 0; nowMs <= 12000; nowMs += 250) {
    adapter.updateAnimations(nowMs);
    samples.push(adapter.debugPresentationState("idle-actor"));
  }

  assert.ok(samples.every(({ ambient }) => ambient.active), "stationary loaded actors stay in ambient standing presentation");
  assert.ok(samples.some(({ ambient }) => Math.abs(ambient.breath) > 1e-4), "breathing must visibly leave the static bind pose");
  assert.ok(samples.some(({ ambient }) => Math.abs(ambient.look) > 1e-4), "look motion must visibly leave the static bind pose");
  assert.ok(samples.every(({ ambient }) => Math.abs(ambient.breath) <= 0.02), "breathing scale remains subtle and bounded");
  assert.ok(samples.every(({ ambient }) => Math.abs(ambient.weight) <= THREE.MathUtils.degToRad(2)), "weight shift remains bounded");
  assert.ok(samples.every(({ ambient }) => Math.abs(ambient.look) <= THREE.MathUtils.degToRad(10)), "look yaw remains bounded");
  adapter.dispose();
});

test("realtime animation ticks advance one 60 Hz slice while no-tick calls retain wall-clock advancement", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [{ id: "tick-clock-actor", kind: "rusher", x: 12000, y: 6000 }],
  });
  await settleLoadedActors(adapter, ["tick-clock-actor"]);

  const idle = adapter.actors.get("tick-clock-actor").actions.idle;
  idle.reset().play();
  adapter.lastAnimMs = null;
  adapter.updateAnimations(0, 240);
  const atTick = idle.time;
  adapter.updateAnimations(600000, 240);
  assert.equal(idle.time, atTick, "a repeated simulation tick cannot consume wall-clock animation time");

  adapter.updateAnimations(1200000, 241);
  assertNear(idle.time, atTick + 1 / 60, "the next simulation tick advances exactly one fixed slice");

  idle.reset().play();
  adapter.lastAnimMs = null;
  adapter.updateAnimations(0);
  adapter.updateAnimations(20);
  assert.ok(idle.time > 0, "direct no-tick animation calls preserve their wall-clock behavior");
  adapter.dispose();
});

test("fresh Stage 1 tick zero resets animation timing while stale tick regression remains non-advancing", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = snapshotRenderHarness(RealtimeBattle);
  const snapshotAt = (tick, fresh = false) => ({
    tick,
    stageId: "cinder-span",
    commander: { id: "commander", x: 19000, y: 6000, elevation: 0 },
    enemies: [{ id: "reused-tick-actor", kind: "rusher", x: 12000, y: 6000 }],
    companions: [],
    projectiles: [],
    pickups: [],
    events: fresh ? [{
      type: "STAGE_STARTED",
      eventId: `stage-start-${tick}`,
      stageId: "cinder-span",
      tick,
    }] : [],
  });

  adapter.renderSnapshot(snapshotAt(0, true));
  await settleLoadedActors(adapter, ["reused-tick-actor"]);
  const record = adapter.actors.get("reused-tick-actor");
  record.actions.idle.reset().play();

  adapter.renderSnapshot(snapshotAt(1));
  adapter.renderSnapshot(snapshotAt(2));
  assert.ok(record.mixer.time > 0, "the reused renderer must have progressed through its prior run");

  adapter.renderSnapshot(snapshotAt(0, true));
  const freshBaseline = record.mixer.time;
  adapter.renderSnapshot(snapshotAt(1));
  assertNear(record.mixer.time, freshBaseline + 1 / 60, "a fresh Stage 1 tick zero establishes a new one-tick animation baseline");

  adapter.renderSnapshot(snapshotAt(0));
  const staleBaseline = record.mixer.time;
  adapter.renderSnapshot(snapshotAt(2));
  assertNear(record.mixer.time, staleBaseline + 1 / 60, "a stale regressing snapshot in the active run cannot restart animation timing");
  adapter.dispose();
});

test("combat one-shots preempt ambient idle, recover cleanly, and death stays terminal", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [
      { id: "recovering-actor", kind: "rusher", x: 12000, y: 6000 },
      { id: "dying-actor", kind: "rusher", x: 14000, y: 6000 },
    ],
  });
  await settleLoadedActors(adapter, ["recovering-actor", "dying-actor"]);

  const recovering = adapter.actors.get("recovering-actor");
  const baseline = adapter.debugPresentationState();
  const baselineActionCount = adapter.debugPresentationState("recovering-actor").actionCount;
  for (const actionKey of ["attack", "hit"]) {
    assert.equal(adapter.triggerAction(recovering, actionKey, 0), true, `${actionKey} must preempt idle`);
    adapter.updateAnimations(adapter.lastAnimMs + 1);
    let state = adapter.debugPresentationState("recovering-actor");
    assert.equal(state.oneShotActionKey, actionKey);
    assert.equal(state.ambient.active, false, `${actionKey} suppresses ambient standing`);
    assert.deepEqual(
      { breath: state.ambient.breath, weight: state.ambient.weight, look: state.ambient.look },
      { breath: 0, weight: 0, look: 0 },
      `${actionKey} clears procedural offsets rather than stacking them onto combat`,
    );

    adapter.updateAnimations(adapter.lastAnimMs + 100);
    state = adapter.debugPresentationState("recovering-actor");
    assert.equal(state.oneShotActionKey, null, `${actionKey} completion clears the one-shot`);
    assert.equal(state.activeActionKey, "idle", `${actionKey} completion returns to idle`);
    assert.equal(state.ambient.active, true, `${actionKey} completion restores ambient standing`);
    assert.equal(state.actionCount, baselineActionCount, `${actionKey} completion must not allocate replacement actions`);
  }

  const dying = adapter.actors.get("dying-actor");
  assert.equal(adapter.triggerAction(dying, "die", 0), true, "death must preempt idle immediately");
  adapter.updateAnimations(adapter.lastAnimMs + 1);
  const death = adapter.debugPresentationState("dying-actor");
  assert.equal(death.activeActionKey, "die");
  assert.equal(death.oneShotActionKey, "die");
  assert.equal(death.dead, true);
  assert.equal(death.ambient.active, false, "death suppresses ambient standing");

  const during = adapter.debugPresentationState();
  assert.equal(during.actorCount, baseline.actorCount, "combat transitions do not add actor records");
  assert.equal(during.mixerCount, baseline.mixerCount, "combat transitions reuse the loaded mixers");
  assert.equal(during.actionCount, baseline.actionCount, "combat transitions reuse the loaded actions");

  adapter.reconcileActors({ tick: 2, enemies: [] });
  const retired = adapter.debugPresentationState();
  assert.equal(retired.actorCount, 0, "retirement removes actor presentation records");
  assert.equal(retired.mixerCount, 0, "retirement releases tracked mixers");
  assert.equal(retired.actionCount, 0, "retirement releases tracked actions");
  adapter.dispose();
});

test("commander target height stays strictly below normal enemies and bosses", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    commander: { id: "commander", x: 19000, y: 6000, elevation: 0 },
    enemies: [
      { id: "height-enemy", kind: "rusher", x: 12000, y: 6000, elevation: 0 },
      {
        // actorModelPath only starts a boss load for a catalog-backed id.
        // Keep this fixture on the same public boss lookup path as production.
        id: "height-boss",
        class: "boss",
        bossId: "s1-cinder-warden",
        x: 15000,
        y: 6000,
        elevation: 0,
      },
    ],
  });
  await settleLoadedActors(adapter, ["commander", "height-enemy", "height-boss"]);

  const commander = adapter.debugPresentationState("commander");
  const enemy = adapter.debugPresentationState("height-enemy");
  const boss = adapter.debugPresentationState("height-boss");
  assert.ok(
    commander.targetHeight < enemy.targetHeight && enemy.targetHeight < boss.targetHeight,
    `target-height order must be commander < enemy < boss, got ${commander.targetHeight} < ${enemy.targetHeight} < ${boss.targetHeight}`,
  );
  adapter.dispose();
});

test("authoritative companion aiState selects locomotion without a rendered position delta", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const companion = {
    id: "stateful-companion",
    kind: "companion",
    companionId: "ember-cohort",
    x: 17500,
    y: 6100,
    elevation: 0,
    aiState: "FOLLOW",
  };
  adapter.reconcileActors({ tick: 1, companions: [companion] });
  await waitFor(
    () => adapter.debugPresentationState(companion.id)?.hasMixer === true,
    "the synthetic companion rig did not finish loading",
  );
  adapter.lastAnimMs = 0;
  adapter.updateAnimations(100);
  // The first loaded companion receives its authoritative transform on the
  // next reconcile. Establish that position before proving a state-only
  // update selects locomotion without a position delta.
  adapter.reconcileActors({ tick: 2, companions: [companion] });

  for (const aiState of ["FOLLOW", "RETURN", "COLLECT"]) {
    const before = adapter.debugPresentationState(companion.id);
    adapter.reconcileActors({
      tick: 3,
      companions: [{ ...companion, aiState }],
    });
    const state = adapter.debugPresentationState(companion.id);
    assert.deepEqual(
      state.position,
      before.position,
      `${aiState} must select locomotion even when its rendered position is unchanged`,
    );
    assert.ok(
      ["move", "run"].includes(state.activeActionKey),
      `${aiState} must select a locomotion clip rather than ${state.activeActionKey}`,
    );
  }
  adapter.dispose();
});

test("snapshot-driven boss combat and enemy death one-shots are completed by their mixers", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [
      {
        id: "state-boss",
        class: "boss",
        bossId: "s1-cinder-warden",
        x: 15000,
        y: 6000,
        elevation: 0,
        presentationAction: "attack",
      },
      {
        id: "state-dead-enemy",
        kind: "rusher",
        x: 12000,
        y: 6000,
        elevation: 0,
        status: "DEAD",
      },
    ],
  });
  await waitFor(
    () => {
      const boss = adapter.debugPresentationState("state-boss");
      const enemy = adapter.debugPresentationState("state-dead-enemy");
      return boss?.oneShotActionKey === "attack" && enemy?.oneShotActionKey === "die";
    },
    "snapshot state did not start the boss combat and enemy death mixer actions",
  );

  adapter.lastAnimMs = 0;
  adapter.updateAnimations(1);
  assert.equal(
    adapter.debugPresentationState("state-boss").oneShotActionKey,
    "attack",
    "the boss combat action remains live until the mixer advances through its clip",
  );
  assert.equal(
    adapter.debugPresentationState("state-dead-enemy").oneShotActionKey,
    "die",
    "the enemy death action remains live until the mixer advances through its clip",
  );

  adapter.updateAnimations(100);
  const boss = adapter.debugPresentationState("state-boss");
  const enemy = adapter.debugPresentationState("state-dead-enemy");
  assert.equal(boss.oneShotActionKey, null, "the completed boss mixer clip returns to locomotion");
  assert.equal(boss.activeActionKey, "idle", "the completed boss combat clip recovers to idle");
  assert.equal(enemy.oneShotActionKey, null, "the completed death mixer clip no longer queues a one-shot");
  assert.equal(enemy.activeActionKey, "die", "enemy death remains terminal after its mixer completes");
  assert.equal(enemy.dead, true, "state-driven enemy death remains terminal");
  adapter.dispose();
});

test("commander appearance loadouts replace durable equipment without mutating caller state", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const initialLoadout = Object.freeze({
    head: Object.freeze({
      id: "iron-crown",
      modelPath: "assets/motion/ingame/characters/broken-court-monarch-boss/model.glb",
      scale: 0.24,
      offset: Object.freeze({ x: 0, y: 0.08, z: 0 }),
      yaw: 0.2,
    }),
    back: Object.freeze({
      id: "ember-pack",
      modelPath: "assets/motion/ingame/characters/human-command-boss/model.glb",
      scale: 0.3,
      offset: Object.freeze({ x: 0, y: 0.1, z: -0.08 }),
      yaw: Math.PI,
    }),
    ward: Object.freeze({
      id: "ward-lantern",
      modelPath: "assets/motion/ingame/characters/possessed/model.glb",
      scale: 0.2,
      offset: Object.freeze({ x: 0.04, y: 0, z: 0 }),
      yaw: 0,
    }),
  });
  const initialBefore = structuredClone(initialLoadout);
  const snapshot = Object.freeze({
    tick: 1,
    commander: Object.freeze({ id: "commander", x: 19000, y: 6000, elevation: 0 }),
    enemies: Object.freeze([]),
    companions: Object.freeze([]),
    projectiles: Object.freeze([]),
    pickups: Object.freeze([]),
    events: Object.freeze([]),
  });
  const snapshotBefore = structuredClone(snapshot);

  adapter.setAppearanceLoadout(initialLoadout);
  adapter.reconcileActors(snapshot);
  await waitFor(
    () => {
      const appearance = adapter.debugPresentationState("commander")?.appearance;
      return Array.isArray(appearance) && appearance.length === 3;
    },
    "the deferred commander appearance loadout did not attach after its rig resolved",
  );
  await settleLoadedActors(adapter, ["commander"]);
  assert.deepEqual(
    adapter.debugPresentationState("commander").appearance,
    [
      { slot: "back", id: "ember-pack" },
      { slot: "head", id: "iron-crown" },
      { slot: "ward", id: "ward-lantern" },
    ],
    "named commander sockets must expose deterministic equipped identities",
  );
  const canonicalEquivalentLoadout = Object.freeze([
    Object.freeze({
      slot: "ward",
      id: "ward-lantern",
      modelPath: "assets/motion/ingame/characters/possessed/model.glb",
      scale: 0.2,
      offset: Object.freeze({ x: 0.04, y: 0, z: 0 }),
      yaw: 0,
    }),
    Object.freeze({
      slot: "back",
      id: "ember-pack",
      modelPath: "assets/motion/ingame/characters/human-command-boss/model.glb",
      scale: 0.3,
      offset: Object.freeze({ x: 0, y: 0.1, z: -0.08 }),
      yaw: Math.PI,
    }),
    Object.freeze({
      slot: "head",
      id: "iron-crown",
      modelPath: "assets/motion/ingame/characters/broken-court-monarch-boss/model.glb",
      scale: 0.24,
      offset: Object.freeze({ x: 0, y: 0.08, z: 0 }),
      yaw: 0.2,
    }),
  ]);
  const canonicalEquivalentBefore = structuredClone(canonicalEquivalentLoadout);
  const commanderRecord = adapter.actors.get("commander");
  const initialAttachmentRoots = new Map(commanderRecord.appearanceRoots);
  const initialAppearanceGeneration = adapter.appearanceGeneration;
  const requestsAfterInitialLoadout = gltfRequests.length;

  adapter.setAppearanceLoadout(canonicalEquivalentLoadout);
  assert.equal(
    adapter.appearanceGeneration,
    initialAppearanceGeneration,
    "canonical-equivalent loadouts must not advance attachment generation",
  );
  assert.equal(
    gltfRequests.length,
    requestsAfterInitialLoadout,
    "canonical-equivalent loadouts must not issue attachment model loads",
  );
  for (const [slot, root] of initialAttachmentRoots) {
    assert.strictEqual(
      commanderRecord.appearanceRoots.get(slot),
      root,
      `canonical-equivalent ${slot} equipment must retain its mounted attachment root`,
    );
    assert.ok(root.parent, `canonical-equivalent ${slot} equipment must not be retired`);
  }
  assert.deepEqual(
    canonicalEquivalentLoadout,
    canonicalEquivalentBefore,
    "canonical-equivalent loadout comparison must not mutate caller state",
  );


  const replacementLoadout = Object.freeze({
    head: Object.freeze({
      id: "obsidian-crown",
      modelPath: "assets/motion/ingame/characters/shadow-soldier-v04/model.glb",
      scale: 0.28,
      offset: Object.freeze({ x: 0, y: 0.1, z: 0 }),
      yaw: 0,
    }),
  });
  const replacementBefore = structuredClone(replacementLoadout);
  adapter.setAppearanceLoadout(replacementLoadout);
  assert.equal(
    adapter.appearanceGeneration,
    initialAppearanceGeneration + 1,
    "a changed loadout must advance attachment generation exactly once",
  );
  for (const [slot, root] of initialAttachmentRoots) {
    assert.equal(root.parent, null, `changed loadout must retire the prior ${slot} attachment root`);
  }
  await waitFor(
    () => {
      const appearance = adapter.debugPresentationState("commander")?.appearance;
      return Array.isArray(appearance) && appearance.length === 1 && appearance[0]?.id === "obsidian-crown";
    },
    "replacing the loadout did not remove stale commander equipment",
  );
  assert.notStrictEqual(
    commanderRecord.appearanceRoots.get("head"),
    initialAttachmentRoots.get("head"),
    "a changed loadout must mount a fresh attachment root",
  );

  const attackSnapshot = Object.freeze({
    ...snapshot,
    tick: 2,
    enemies: Object.freeze([{ id: "appearance-target", kind: "rusher", x: 12000, y: 6000, elevation: 0 }]),
    events: Object.freeze([Object.freeze({
      type: "BASIC_ATTACK",
      eventId: "appearance-attack",
      entityId: "commander",
      targetId: "appearance-target",
    })]),
  });
  const attackBefore = structuredClone(attackSnapshot);
  adapter.reconcileActors(attackSnapshot);
  adapter.collectFeedback(attackSnapshot);
  await waitFor(
    () => adapter.debugPresentationState("commander")?.oneShotActionKey === "attack",
    "the commander attack presentation did not begin",
  );
  adapter.lastAnimMs = 0;
  adapter.updateAnimations(100);
  assert.deepEqual(
    adapter.debugPresentationState("commander").appearance,
    [{ slot: "head", id: "obsidian-crown" }],
    "transient attack cleanup must not remove durable commander appearance",
  );
  assert.deepEqual(initialLoadout, initialBefore, "setAppearanceLoadout must not mutate the supplied initial loadout");
  assert.deepEqual(replacementLoadout, replacementBefore, "setAppearanceLoadout must not mutate the supplied replacement loadout");
  assert.deepEqual(snapshot, snapshotBefore, "reconciliation must not mutate the supplied snapshot");
  assert.deepEqual(attackSnapshot, attackBefore, "attack presentation must not mutate the supplied snapshot");
  adapter.dispose();
});

test("a repeated combat beat restarts its clip and cannot be pinned at frame zero", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [
      { id: "combo-actor", kind: "rusher", x: 12000, y: 6000 },
      { id: "terminal-actor", kind: "rusher", x: 13000, y: 6000 },
    ],
  });
  await settleLoadedActors(adapter, ["combo-actor", "terminal-actor"]);

  const combo = adapter.actors.get("combo-actor");
  const baselineActionCount = adapter.debugPresentationState("combo-actor").actionCount;
  assert.equal(adapter.triggerAction(combo, "attack", 0), true, "the first beat plays");
  const action = combo.oneShotAction;
  assert.ok(action, "the attack clip is the live one-shot");
  assert.equal(action.time, 0, "a fresh beat starts at frame zero");

  // A snapshot can carry several same-beat events in one frame. Without the
  // one-frame floor those repeats would rewind the clip every call and the
  // character would never leave frame zero.
  assert.equal(adapter.triggerAction(combo, "attack", 0), false, "a same-frame repeat is floored");
  assert.equal(action.time, 0, "the floored repeat leaves the clip untouched");

  adapter.updateAnimations(adapter.lastAnimMs + 20);
  assert.ok(action.time > 0, "the mixer advanced the live beat");
  assert.equal(
    adapter.debugPresentationState("combo-actor").oneShotActionKey,
    "attack",
    "the beat is still playing before the repeat",
  );

  assert.equal(adapter.triggerAction(combo, "attack", 0), true, "a rapid repeat restarts the beat");
  assert.equal(action.time, 0, "the restart rewinds the clip so the combo reads as a second hit");
  const restarted = adapter.debugPresentationState("combo-actor");
  assert.equal(restarted.oneShotActionKey, "attack", "the restarted beat stays the live one-shot");
  assert.equal(restarted.activeActionKey, "attack", "the restarted beat stays the active clip");
  assert.equal(
    restarted.actionCount,
    baselineActionCount,
    "restarting reuses the loaded action instead of allocating a replacement",
  );

  // A different beat still queues rather than cutting the live one.
  assert.equal(adapter.triggerAction(combo, "hit", 0), false, "an incompatible beat still queues");
  assert.equal(combo.queuedAction?.key, "hit", "the incompatible beat is the queued follow-up");
  assert.equal(
    adapter.debugPresentationState("combo-actor").oneShotActionKey,
    "attack",
    "queuing must not preempt the live beat",
  );

  const terminal = adapter.actors.get("terminal-actor");
  assert.equal(adapter.triggerAction(terminal, "die", 0), true, "death preempts idle");
  adapter.updateAnimations(adapter.lastAnimMs + 20);
  assert.equal(adapter.triggerAction(terminal, "die", 0), false, "death never restarts");
  const dead = adapter.debugPresentationState("terminal-actor");
  assert.equal(dead.oneShotActionKey, "die", "death stays the live one-shot");
  assert.equal(dead.dead, true, "death stays terminal");

  adapter.dispose();
});

test("a queued beat is chosen by presentation weight, not by arrival order", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [
      { id: "queue-actor", kind: "rusher", x: 12000, y: 6000 },
      { id: "tie-actor", kind: "rusher", x: 13000, y: 6000 },
    ],
  });
  await settleLoadedActors(adapter, ["queue-actor", "tie-actor"]);

  const queueActor = adapter.actors.get("queue-actor");
  assert.equal(adapter.triggerAction(queueActor, "attack", 0), true, "the live beat starts");

  assert.equal(adapter.triggerAction(queueActor, "hit", 0), false, "a flinch queues behind the swing");
  assert.equal(queueActor.queuedAction.key, "hit");

  assert.equal(adapter.triggerAction(queueActor, "bighit", 0), false, "a stagger queues behind the swing");
  assert.equal(
    queueActor.queuedAction.key,
    "bighit",
    "the heavier reaction takes the slot from the lighter one",
  );

  assert.equal(adapter.triggerAction(queueActor, "hit", 0), false, "a later flinch still queues");
  assert.equal(
    queueActor.queuedAction.key,
    "bighit",
    "arriving later must not evict the reaction the player has to read",
  );

  assert.equal(adapter.triggerAction(queueActor, "avoid", 0), false, "a dodge still queues");
  assert.equal(queueActor.queuedAction.key, "bighit", "a mid-weight reaction loses to the stagger");

  // The surviving beat is the one that actually plays on completion.
  adapter.updateAnimations(adapter.lastAnimMs + 100);
  const resolved = adapter.debugPresentationState("queue-actor");
  assert.equal(resolved.oneShotActionKey, "bighit", "the surviving reaction plays next");
  assert.equal(queueActor.queuedAction, null, "the slot is released once its beat plays");

  const tieActor = adapter.actors.get("tie-actor");
  assert.equal(adapter.triggerAction(tieActor, "attack", 0), true, "the live beat starts");
  assert.equal(adapter.triggerAction(tieActor, "avoid", 0), false, "a dodge queues");
  assert.equal(tieActor.queuedAction.key, "avoid");
  assert.equal(adapter.triggerAction(tieActor, "defence", 0), false, "a guard queues");
  assert.equal(
    tieActor.queuedAction.key,
    "defence",
    "equal-weight reactions resolve to the freshest simulation event",
  );

  adapter.dispose();
});

test("beat entry and recovery fades carry the weight of the beat", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [
      { id: "snap-actor", kind: "rusher", x: 12000, y: 6000 },
      { id: "ease-actor", kind: "rusher", x: 13000, y: 6000 },
    ],
  });
  await settleLoadedActors(adapter, ["snap-actor", "ease-actor"]);

  const snap = adapter.actors.get("snap-actor");
  const ease = adapter.actors.get("ease-actor");
  assert.equal(adapter.triggerAction(snap, "bighit", 0), true, "the stagger starts");
  assert.equal(adapter.triggerAction(ease, "show", 0), true, "the entrance starts");

  adapter.updateAnimations(adapter.lastAnimMs + 20);
  const snapWeight = snap.actions.bighit.getEffectiveWeight();
  const easeWeight = ease.actions.show.getEffectiveWeight();
  assert.ok(snapWeight > 0.5, `impact must be readable on arrival, got ${snapWeight}`);
  assert.ok(easeWeight < 0.5, `an entrance must ease in rather than pop, got ${easeWeight}`);
  assert.ok(snapWeight > easeWeight, "a stagger snaps in faster than an entrance");

  // Recovery: a stagger drains back to locomotion slower than a swing does.
  adapter.reconcileActors({
    tick: 2,
    enemies: [
      { id: "stagger-actor", kind: "rusher", x: 12000, y: 6000 },
      { id: "swing-actor", kind: "rusher", x: 13000, y: 6000 },
    ],
  });
  await settleLoadedActors(adapter, ["stagger-actor", "swing-actor"]);
  const stagger = adapter.actors.get("stagger-actor");
  const swing = adapter.actors.get("swing-actor");
  assert.equal(adapter.triggerAction(stagger, "bighit", 0), true, "the stagger starts");
  assert.equal(adapter.triggerAction(swing, "attack", 0), true, "the swing starts");

  adapter.updateAnimations(adapter.lastAnimMs + 100);
  assert.equal(adapter.debugPresentationState("stagger-actor").oneShotActionKey, null, "the stagger completed");
  assert.equal(adapter.debugPresentationState("swing-actor").oneShotActionKey, null, "the swing completed");

  adapter.updateAnimations(adapter.lastAnimMs + 60);
  const staggerRecovery = stagger.actions.idle.getEffectiveWeight();
  const swingRecovery = swing.actions.idle.getEffectiveWeight();
  assert.ok(
    swingRecovery > staggerRecovery,
    `a swing must snap back faster than a stagger (swing ${swingRecovery}, stagger ${staggerRecovery})`,
  );
  assert.ok(staggerRecovery > 0, "the stagger still recovers rather than stalling");

  adapter.dispose();
});

test("a retired enemy's death echo preserves its nonzero rendered elevation", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const enemy = {
    id: "elevated-enemy",
    kind: "rusher",
    x: 15000,
    y: 2800,
    elevation: 2400,
    hp: 1,
  };
  const alive = { tick: 1, enemies: [enemy], events: [] };
  adapter.reconcileActors(alive);
  await settleLoadedActors(adapter, [enemy.id]);
  adapter.reconcileActors(alive);

  const renderedEnemy = adapter.debugPresentationState(enemy.id);
  const expectedElevation = enemy.elevation * 14 / 12000;
  assertNear(renderedEnemy.position.y, expectedElevation, "fixture enemy renders at authoritative elevation");

  const defeated = {
    tick: 2,
    enemies: [],
    events: [{ type: "ENEMY_DEFEATED", enemyId: enemy.id, atTick: 2 }],
  };
  adapter.captureDeathEchoes(defeated);
  adapter.reconcileActors(defeated);
  adapter.collectFeedback(defeated);

  assert.equal(adapter.debugPresentationState(enemy.id), null, "the authoritative enemy actor is retired");
  const echo = await waitFor(
    () => adapter.vfxGroup.children[0] ?? null,
    "the retired enemy's death echo did not spawn",
  );
  assertNear(
    echo.position.y,
    renderedEnemy.position.y,
    "the death echo must spawn at the retired actor's rendered elevation",
  );
  assert.ok(echo.position.y > 0, "the regression fixture must prove elevation is not flattened to ground level");
  adapter.dispose();
});

test("3D pickup presentation consumes snapshot pickups, grounds both models, and retains its failure marker", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const bladePath = "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb";
  const relicPath = "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb";
  const run = structuredClone(createDefenseRun({ stageId: "cinder-span", seed: 211 }));
  run.pickups = [
    { id: "snapshot-item", kind: "item", itemId: "ward-splinter", x: 8400, y: 4100, elevation: 0, hp: 1, maxHp: 1 },
    { id: "snapshot-echo", kind: "echo", xp: 9, x: 15200, y: 7600, elevation: 0, hp: 1, maxHp: 1 },
  ];
  const snapshot = getRunSnapshot(run);
  const item = snapshot.pickups.find(({ kind }) => kind === "item");
  const echo = snapshot.pickups.find(({ kind }) => kind === "echo");
  const before = structuredClone(snapshot);
  const failedUrl = `./${bladePath}`;
  gltfFailuresRemaining.set(failedUrl, 1);

  try {
    adapter.reconcileActors(snapshot);
    await waitFor(
      () => adapter.actors.get(item.id)?.loading === false && adapter.actors.get(echo.id)?.loading === false,
      "snapshot pickup model requests did not settle",
    );

    const failedRecord = adapter.actors.get(item.id);
    assert.equal(
      failedRecord.root.children.some((child) => child.isMesh && child.visible),
      true,
      "a rejected pickup GLB must leave its visible marker attached",
    );
    assert.equal(adapter.debugPresentationState(item.id).meshIntegrity, null, "a failed GLB must not publish fabricated model integrity");

    adapter.reconcileActors({ ...snapshot, pickups: [echo] });
    assert.equal(adapter.debugPresentationState(item.id), null, "a pickup absent from the next snapshot must retire");
    adapter.reconcileActors(snapshot);
    await waitFor(
      () => snapshot.pickups.every(({ id }) => adapter.debugPresentationState(id)?.meshIntegrity),
      "the evicted pickup GLB did not load on the next authoritative snapshot appearance",
    );

    const pickupStates = adapter.debugPresentationState().pickups.sort((left, right) => left.id.localeCompare(right.id));
    assert.deepEqual(
      pickupStates.map(({ id }) => id),
      snapshot.pickups.map(({ id }) => id).sort(),
      "the renderer must publish exactly the pickups present in the simulation snapshot",
    );
    assert.deepEqual(
      Object.fromEntries(pickupStates.map(({ id, modelPath }) => [id, modelPath])),
      { "snapshot-echo": relicPath, "snapshot-item": bladePath },
      "item and echo pickups must resolve their distinct authored 3D models",
    );
    for (const pickup of pickupStates) {
      assertMeshIntegrity(pickup.meshIntegrity, pickup.id);
      assertNear(pickup.groundedMinY, 0, `${pickup.id} model rests on its local support plane`);
      const source = snapshot.pickups.find(({ id }) => id === pickup.id);
      assertNear(pickup.position.x, worldX(source.x), `${pickup.id} consumes snapshot x`);
      assertNear(pickup.position.z, worldZ(source.y), `${pickup.id} consumes snapshot y`);
    }
    assert.deepEqual(snapshot, before, "pickup reconciliation must not mutate the authoritative snapshot");
  } finally {
    gltfFailuresRemaining.delete(failedUrl);
    adapter.dispose();
  }
});

test("a lobby boss consumes the authored show presentation without mutating the staged snapshot", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const snapshot = Object.freeze({
    tick: 0,
    enemies: Object.freeze([Object.freeze({
      id: "lobby-preview:cinder-span",
      kind: "boss",
      class: "boss",
      bossId: "s1-cinder-warden",
      hp: 1,
      maxHp: 1,
      x: 16800,
      y: 6000,
      presentationAction: "show",
    })]),
    companions: Object.freeze([]),
    projectiles: Object.freeze([]),
    pickups: Object.freeze([]),
    events: Object.freeze([]),
  });
  const before = structuredClone(snapshot);

  adapter.reconcileActors(snapshot);
  const boss = await waitFor(
    () => {
      const state = adapter.debugPresentationState("lobby-preview:cinder-span");
      return state?.oneShotActionKey === "show" ? state : null;
    },
    "the lobby boss did not enter its show action",
  );
  assert.equal(boss.presentationAction, "show", "debug presentation must expose the lobby-authored action");
  assert.equal(boss.activeActionKey, "show", "the authored show action must reach the active mixer");
  assert.deepEqual(snapshot, before, "lobby boss presentation must not mutate the staged snapshot");
  adapter.dispose();
});


test("stage-world catalog props and lookout NPCs load at authored presentation placements", async () => {
  const { RealtimeBattle, meshRootForStageBoss } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const profile = stageWorldFor("cinder-span");
  const stageNpcModelPath = "assets/motion/ingame/characters/lantern-reaver/model.glb";
  const requestStart = gltfRequests.length;

  adapter.ensureStageTerrain(profile.stageId);
  const loading = adapter.debugPresentationState().stageDecor;
  assert.equal(loading.stageId, profile.stageId);
  assert.equal(loading.loading, true);
  assert.deepEqual(loading.records, [], "decor is published only after the stage request settles");

  await waitFor(
    () => adapter.debugPresentationState().stageDecor.loading === false,
    "Cinder Span stage dressing did not finish loading",
  );
  await waitFor(
    () => adapter.debugPresentationState().stageDecor.propCount === profile.presentation.props.length,
    "Cinder Span pack-node props did not finish instantiating",
  );
  let state = adapter.debugPresentationState();
  const decor = state.stageDecor;
  const bossModelPath = meshRootForStageBoss(profile.stageId);
  assert.ok(bossModelPath, "the stage must resolve an authored boss rig");
  // BOSS_MODELS entries are stored relative to the renderer's model root,
  // unlike the catalog's absolute decor paths, so resolve it the same way the
  // renderer's modelUrl() does before comparing request URLs.
  const bossRequestPath = bossModelPath.startsWith("assets/")
    ? `./${bossModelPath}`
    : `./assets/images/battle/glb/${bossModelPath}`;
  // loadGltf() caches by URL for the lifetime of this module import, so a
  // URL an earlier test in this file already requested (e.g. the shared
  // commander/companion/lookout mesh, PLAYER_MESH) settles from cache here
  // instead of firing a fresh gltfLoader.load() call. Exclude anything
  // already seen before this test's requestStart from the strict fresh-
  // request assertion; its record is still verified below via debug state,
  // just without demanding a redundant network request for it.
  const alreadyCached = new Set(gltfRequests.slice(0, requestStart));
  const expectedRequests = [
    ...[
      profile.terrainGlbPath,
      ...profile.presentation.props.map(({ modelPath }) => modelPath),
      ...profile.presentation.npcs.map(() => stageNpcModelPath),
      ...profile.presentation.vfxCues.map(({ modelPath }) => modelPath),
    ].filter(Boolean).map((modelPath) => `./${modelPath}`),
    // Stage load warms the boss rig so it does not pop in mid-fight.
    bossRequestPath,
  ].filter((requestUrl) => !alreadyCached.has(requestUrl)).sort();
  assert.deepEqual(
    gltfRequests.slice(requestStart).sort(),
    [...new Set(expectedRequests)].sort(),
    "renderer requests each unique catalog prop, NPC, VFX, and boss model exactly once",
  );
  assert.ok(
    gltfRequests.includes(bossRequestPath),
    "stage load must warm the authored boss rig before the boss spawns",
  );
  assert.equal(
    gltfRequests.slice(requestStart).includes(`./${profile.terrainSourceCandidatePath}`),
    false,
    "Cinder must not request the renderer-ineligible diorama",
  );
  assert.equal(decor.stageId, profile.stageId);
  assert.equal(decor.terrainLoaded, true);
  // Cycle 10 supersession: Cinder ships a composed slab floor, so the renderer takes
  // instantiateTerrainModel() instead of instantiateProceduralTerrain(). The candidate
  // provenance assertion below is unchanged -- the rejected diorama is still retained.
  assert.equal(decor.terrainSource, "promoted-glb", "Cinder gameplay must load its composed slab floor");
  assert.equal(decor.terrainModelPath, profile.terrainGlbPath, "Cinder must publish the promoted floor as loaded gameplay terrain");
  assert.equal(decor.terrainSourceCandidatePath, profile.terrainSourceCandidatePath, "Cinder debug state must retain diorama provenance");
  assertMeshIntegrity(decor.terrainIntegrity, "Cinder composed slab floor");
  assert.equal(decor.propCount, profile.presentation.props.length);
  assert.equal(decor.npcCount, profile.presentation.npcs.length);
  assert.equal(decor.vfxCount, profile.presentation.vfxCues.length, "the authored ember-wake cue counts as loaded stage decor");
  assert.equal(state.actorCount, 0, "decorative lookouts never enter the simulation actor map");

  const authoredProps = profile.presentation.props;
  const loadedProps = adapter.stageDecorRecords.filter(({ kind }) => kind === "prop");
  assert.equal(loadedProps.length, 12, "all twelve authored Cinder pack nodes become stage prop records");
  assert.equal(new Set(loadedProps.map(({ id }) => id)).size, 12, "Cinder prop instances keep twelve independent IDs");
  assert.equal(new Set(loadedProps.map(({ modelNode }) => modelNode)).size, 12, "Cinder prop instances keep twelve independent pack-node selections");
  assert.equal(new Set(loadedProps.map(({ root }) => root)).size, 12, "Cinder pack-node selections become twelve independent scene instances");
  assert.equal(new Set(loadedProps.map(({ placement }) => placement)).size, 12, "Cinder prop instances keep twelve separate immutable placements");
  assert.equal(loadedProps.every(({ placement }) => Object.isFrozen(placement)), true, "loaded prop placements remain immutable catalog records");
  assert.equal(
    loadedProps.every(({ modelNode, root }) => root.userData.syntheticModelNode === modelNode),
    true,
    "each instance must clone the requested named node rather than the whole pack scene",
  );
  assert.deepEqual(
    loadedProps.map(({ id, modelNode }) => ({ id, modelNode })).sort((left, right) => left.id.localeCompare(right.id)),
    authoredProps.map(({ id, modelNode }) => ({ id, modelNode })).sort((left, right) => left.id.localeCompare(right.id)),
    "each scene instance keeps its authored ID-to-modelNode binding",
  );
  const cinderPackRequestUrls = [...new Set(authoredProps.map(({ modelPath }) => `./${modelPath}`))].sort();
  assert.deepEqual(
    cinderPackRequestUrls.map((requestUrl) => gltfRequests.filter((seenUrl) => seenUrl === requestUrl).length),
    [1, 1],
    "the GLTF cache issues one loader request per unique Cinder pack URL",
  );

  const records = new Map(decor.records.map((record) => [record.id, record]));
  for (const authored of [...profile.presentation.props, ...profile.presentation.npcs]) {
    const record = records.get(authored.id);
    assert.ok(record, `${authored.id} must be present in stage decor debug state`);
    assert.equal(record.modelPath, authored.actorId === "lantern-reaver" ? stageNpcModelPath : authored.modelPath);
    assert.equal(record.role, authored.role);
    assert.deepEqual(record.source, authored.placement);
    assertNear(record.position.x, worldX(authored.placement.x), `${authored.id} authored x placement`);
    assertNear(record.position.z, worldZ(authored.placement.y), `${authored.id} authored y placement`);
    assertNear(record.position.y, authored.placement.elevation * 14 / 12000, `${authored.id} authored elevation`);
    if (authored.role !== "lookout") {
      assertNear(record.yaw, authored.placement.yawRadians, `${authored.id} authored yaw`);
      assert.ok(Math.abs(record.groundedMinY) <= 1e-4, `${authored.id} must be grounded at minY 0, got ${record.groundedMinY}`);
      assertMeshIntegrity(record.meshIntegrity, authored.id);
    }
  }

  adapter.lastAnimMs = 0;
  adapter.updateAnimations(1000);
  state = adapter.debugPresentationState();
  const lookout = state.stageDecor.records.find(({ kind }) => kind === "stage-npc");
  assert.equal(lookout.actorId, profile.presentation.npcs[0].actorId);
  assert.equal(lookout.hasMixer, true);
  assert.ok(lookout.actionCount > 0, "decorative lookout binds its authored action library");
  assert.equal(lookout.activeActionKey, "idle", "decorative lookout starts its ambient standing clip");
  assert.equal(lookout.ambientState, "idle", "decorative lookout receives ambient look/breath presentation");
  assert.equal(adapter.debugPresentationState(lookout.id), null, "stage NPC ids remain separate from simulation actor lookup");

  const [vfxCue] = profile.presentation.vfxCues;
  const vfxRecord = state.stageDecor.records.find(({ kind }) => kind === "stage-vfx");
  assert.ok(vfxRecord, "the authored ember-wake cue must be present in stage decor debug state");
  assert.equal(vfxRecord.effectId, vfxCue.effectId);
  assert.equal(vfxRecord.modelPath, vfxCue.modelPath, "the renderer requests the authored VFX model, not a placeholder");
  assert.equal(vfxRecord.clip, vfxCue.clip, "the mixer loops the exact named clip authored for this stage");
  assert.equal(vfxRecord.hasMixer, true, "a resolved clip must bind a real AnimationMixer");
  assert.equal(vfxRecord.activeActionKey, "loop", "the stage VFX cue is playing, not idle-bound");
  assert.equal(vfxRecord.quality, "full", "full motion quality applies while reduced motion is off");
  assertNear(vfxRecord.position.x, worldX(vfxCue.placement.x), "the VFX cue authored x placement");
  assertNear(vfxRecord.position.z, worldZ(vfxCue.placement.y), "the VFX cue authored y placement");

  adapter.setReducedMotion(true);
  const reduced = adapter.debugPresentationState().stageDecor.records.find(({ kind }) => kind === "stage-vfx");
  assert.equal(reduced.clip, vfxCue.clip, "reduced motion keeps the same resolved clip, it only stops playback");
  assert.equal(reduced.activeActionKey, null, "reduced motion stops the stage VFX loop instead of leaving it running");
  assert.equal(reduced.quality, "reduced-motion");

  adapter.setReducedMotion(false);
  const restored = adapter.debugPresentationState().stageDecor.records.find(({ kind }) => kind === "stage-vfx");
  assert.equal(restored.activeActionKey, "loop", "disabling reduced motion resumes the stage VFX loop");
  assert.equal(restored.quality, "full");
  adapter.dispose();
});

test("a missing static Cinder pack node fails closed instead of cloning the whole pack scene", async () => {
  const { RealtimeBattle } = await rendererModule;
  const profile = stageWorldFor("cinder-span");
  const missingProp = profile.presentation.props[0];
  const requestUrl = `./${missingProp.modelPath}`;
  const pack = staticPropPacksByUrl.get(requestUrl);
  assert.ok(pack, "the successful Cinder load must seed the cached static pack fixture");
  const missingNode = pack.scene.getObjectByName(missingProp.modelNode);
  assert.ok(missingNode, "the static pack fixture must expose the requested modelNode");
  const parent = missingNode.parent;
  parent.remove(missingNode);

  const adapter = realtimeBattleHarness(RealtimeBattle);
  try {
    adapter.ensureStageTerrain(profile.stageId);
    await waitFor(
      () => adapter.debugPresentationState().stageDecor.terrainLoaded === true,
      "Cinder terrain did not settle after removing one static pack node",
    );
    await waitFor(
      () => adapter.debugPresentationState().stageDecor.propCount === 11,
      "the eleven resolvable Cinder props did not finish instantiating",
    );
    const decor = adapter.debugPresentationState().stageDecor;
    assert.equal(decor.propCount, 11, "the absent requested node must omit exactly that prop");
    assert.equal(
      decor.records.some(({ id }) => id === missingProp.id),
      false,
      "the renderer must not substitute the whole pack scene for an absent static modelNode",
    );
  } finally {
    parent.add(missingNode);
    adapter.dispose();
  }
});

test("Cinder Span stage intro dolly is tick-bounded, preserves selected orbit, and never mutates its snapshot", async () => {
  const { RealtimeBattle } = await rendererModule;
  const profile = stageWorldFor("cinder-span");
  const intro = profile.presentation.cinematic?.intro;
  assert.ok(intro, "Cinder Span exposes its Stage 1 intro from the stage catalog");
  assert.deepEqual(
    intro.from,
    { distance: 6, azimuth: -0.24, polar: -0.34 },
    "Cinder Span opens from its authored oblique camera offset",
  );
  assert.equal(intro.durationTicks, 90, "Cinder Span keeps its authored 90-tick intro duration");
  assert.ok(Number.isInteger(intro.durationTicks) && intro.durationTicks > 0, "intro duration is an authored tick budget");

  const makeSnapshot = (tick, events) => ({
    tick,
    stageId: profile.stageId,
    commander: { id: "commander", x: 19000, y: 6000, elevation: 0 },
    enemies: [],
    companions: [],
    projectiles: [],
    pickups: [],
    events,
  });
  const start = makeSnapshot(420, [{ type: "STAGE_STARTED", eventId: "cinder-stage-start", tick: 420 }]);
  const startBefore = structuredClone(start);
  const adapter = snapshotRenderHarness(RealtimeBattle);
  adapter.orbit(0.31, -0.08);
  adapter.zoom(-0.4);
  const selectedOrbit = {
    yaw: adapter.orbitYaw,
    pitch: adapter.orbitPitch,
    zoom: adapter.zoomFactor,
  };

  adapter.updateCamera(start);
  const baseline = adapter.camera.position.clone();
  adapter.renderSnapshot(start);
  assert.notDeepEqual(
    adapter.camera.position.toArray(),
    baseline.toArray(),
    "the authored Stage 1 intro transiently changes the actual camera framing",
  );
  assert.deepEqual(
    { yaw: adapter.orbitYaw, pitch: adapter.orbitPitch, zoom: adapter.zoomFactor },
    selectedOrbit,
    "the intro must not replace the player's selected orbit or zoom",
  );
  assert.deepEqual(start, startBefore, "the renderer keeps the supplied STAGE_STARTED snapshot immutable");

  const settled = makeSnapshot(start.tick + intro.durationTicks, []);
  adapter.renderSnapshot(settled);
  assertNear(adapter.camera.position.x, baseline.x, "the bounded intro returns the selected camera x framing");
  assertNear(adapter.camera.position.y, baseline.y, "the bounded intro returns the selected camera y framing");
  assertNear(adapter.camera.position.z, baseline.z, "the bounded intro returns the selected camera z framing");
  adapter.dispose();

  const reduced = snapshotRenderHarness(RealtimeBattle, { reducedMotion: true });
  reduced.orbit(0.31, -0.08);
  reduced.zoom(-0.4);
  reduced.updateCamera(start);
  const reducedBaseline = reduced.camera.position.clone();
  reduced.renderSnapshot(start);
  assert.deepEqual(
    reduced.camera.position.toArray(),
    reducedBaseline.toArray(),
    "reduced motion suppresses the nonessential Stage 1 camera dolly",
  );
  assert.deepEqual(start, startBefore, "reduced-motion rendering still leaves the supplied snapshot immutable");
  reduced.dispose();
});

test("confirmed same-stage same-seed tick-zero restarts replay the stage intro without stale de-dupe resets", async () => {
  const { RealtimeBattle } = await rendererModule;
  const profile = stageWorldFor("cinder-span");
  const intro = profile.presentation.cinematic?.intro;
  assert.ok(intro?.durationTicks > 13, "the fixture needs a positive-tick interval inside the authored intro");

  const stageStarted = () => Object.freeze({
    type: "STAGE_STARTED",
    eventId: "cinder-span:seed-73:stage-start",
    stageId: profile.stageId,
    tick: 0,
  });
  const snapshot = (tick, events = []) => Object.freeze({
    tick,
    seed: 73,
    stageId: profile.stageId,
    commander: Object.freeze({ id: "commander", x: 19000, y: 6000, elevation: 0 }),
    enemies: Object.freeze([]),
    companions: Object.freeze([]),
    projectiles: Object.freeze([]),
    pickups: Object.freeze([]),
    events: Object.freeze(events),
  });
  const firstStart = snapshot(0, [stageStarted()]);
  const progressed = snapshot(12);
  const staleTickZero = snapshot(0);
  const duplicateWithinRun = snapshot(13, [stageStarted()]);
  const restarted = snapshot(0, [stageStarted()]);
  const snapshots = [firstStart, progressed, staleTickZero, duplicateWithinRun, restarted];
  const snapshotsBefore = structuredClone(snapshots);
  const adapter = snapshotRenderHarness(RealtimeBattle);

  adapter.renderSnapshot(firstStart);
  await waitFor(
    () => adapter.debugPresentationState("commander")?.hasMixer === true,
    "the first stage-start commander rig did not load",
  );
  assert.equal(
    adapter.debugPresentationState("commander")?.oneShotActionKey,
    "show",
    "the initial confirmed start plays the commander's show presentation",
  );
  const initialIntro = adapter.stageIntro;
  assert.ok(initialIntro, "the initial confirmed start begins the stage intro");

  adapter.renderSnapshot(progressed);
  adapter.renderSnapshot(staleTickZero);
  adapter.renderSnapshot(duplicateWithinRun);
  assert.strictEqual(
    adapter.stageIntro,
    initialIntro,
    "an event-less tick-zero snapshot cannot clear de-dupe state and replay an in-run stage start",
  );

  adapter.renderSnapshot(restarted);
  assert.notStrictEqual(
    adapter.stageIntro,
    initialIntro,
    "a later confirmed tick-zero stage start creates a fresh stage intro despite its deterministic event id",
  );
  assert.equal(
    adapter.debugPresentationState("commander")?.oneShotActionKey,
    "show",
    "the later confirmed start replays the commander's show presentation",
  );
  assert.deepEqual(snapshots, snapshotsBefore, "restart and stale snapshots remain immutable during presentation");
  adapter.dispose();
});

test("an event tick-zero stage start clears prior-run VFX before deduplicating the retry", async () => {
  const { RealtimeBattle } = await rendererModule;
  const profile = stageWorldFor("cinder-span");
  const stageStarted = (tick) => Object.freeze({
    type: "STAGE_STARTED",
    eventId: "cinder-span:seed-97:stage-start",
    stageId: profile.stageId,
    tick,
  });
  const rallyWindow = (tick) => Object.freeze({
    type: "BOSS_RALLY_WINDOW",
    eventId: "cinder-span:seed-97:rally-window",
    targetId: "commander",
    tick,
  });
  const snapshot = (tick, events = []) => Object.freeze({
    tick,
    seed: 97,
    stageId: profile.stageId,
    commander: Object.freeze({ id: "commander", x: 19000, y: 6000, elevation: 0 }),
    enemies: Object.freeze([]),
    companions: Object.freeze([]),
    projectiles: Object.freeze([]),
    pickups: Object.freeze([]),
    events: Object.freeze(events),
  });
  const firstStart = snapshot(0, [stageStarted(0)]);
  const progressed = snapshot(12);
  const priorRally = snapshot(13, [rallyWindow(13)]);
  const staleEventTimestamp = snapshot(0, [stageStarted(13)]);
  const confirmedRetry = snapshot(0, [stageStarted(0), rallyWindow(13)]);
  const newRunRally = snapshot(1, [rallyWindow(1)]);
  const snapshots = [firstStart, progressed, priorRally, staleEventTimestamp, confirmedRetry, newRunRally];
  const snapshotsBefore = structuredClone(snapshots);
  const adapter = snapshotRenderHarness(RealtimeBattle);

  adapter.renderSnapshot(firstStart);
  await waitFor(
    () => adapter.debugPresentationState("commander")?.hasMixer === true,
    "the first stage-start commander rig did not load",
  );
  const firstIntro = adapter.stageIntro;
  assert.ok(firstIntro, "the initial stage-start event begins the stage intro");

  adapter.renderSnapshot(progressed);
  assert.equal(
    adapter.debugPresentationState("commander")?.activeActionKey,
    "idle",
    "the initial stage-start one-shot completes before retry detection is exercised",
  );
  adapter.renderSnapshot(priorRally);
  assert.equal(adapter.vfxInstances.length, 1, "the prior-run rally VFX is recorded for duplicate suppression");
  const priorRallyVfx = adapter.vfxInstances[0];

  adapter.renderSnapshot(staleEventTimestamp);
  assert.strictEqual(
    adapter.stageIntro,
    firstIntro,
    "a tick-zero snapshot paired with a positive-tick stage-start event cannot reset the intro",
  );
  assert.equal(
    adapter.debugPresentationState("commander")?.activeActionKey,
    "idle",
    "a mismatched stage-start timestamp cannot clear animation de-dupe and replay show",
  );

  adapter.renderSnapshot(confirmedRetry);
  assert.notStrictEqual(
    adapter.stageIntro,
    firstIntro,
    "the actual tick-zero stage-start event remains eligible to begin the retry intro",
  );
  assert.equal(
    adapter.debugPresentationState("commander")?.oneShotActionKey,
    "show",
    "the confirmed retry remains eligible for its stage-start animation",
  );
  assert.equal(adapter.vfxInstances.length, 1, "the confirming batch presents its carried VFX exactly once");
  assert.notStrictEqual(
    adapter.vfxInstances[0],
    priorRallyVfx,
    "the retry boundary retires the prior-run VFX before consuming the confirming batch",
  );

  adapter.renderSnapshot(newRunRally);
  assert.equal(adapter.vfxInstances.length, 1, "the confirming batch seeds visual de-duplication for the new run");
  adapter.renderSnapshot(newRunRally);
  assert.equal(adapter.vfxInstances.length, 1, "duplicate new-run VFX remains suppressed after the reset");
  assert.deepEqual(snapshots, snapshotsBefore, "retry snapshots remain immutable during presentation");
  adapter.dispose();
});

test("runtime reduced-motion toggle cancels an active Cinder intro without mutating or reviving snapshots", async () => {
  const { RealtimeBattle } = await rendererModule;
  const profile = stageWorldFor("cinder-span");
  const makeSnapshot = (tick, events = []) => ({
    tick,
    stageId: profile.stageId,
    commander: { id: "commander", x: 19000, y: 6000, elevation: 0 },
    enemies: [],
    companions: [],
    projectiles: [],
    pickups: [],
    events,
  });
  const start = makeSnapshot(420, [{ type: "STAGE_STARTED", eventId: "runtime-motion-start", tick: 420 }]);
  const whileReduced = makeSnapshot(421);
  const restoredMotion = makeSnapshot(422);
  const snapshotsBefore = structuredClone([start, whileReduced, restoredMotion]);
  const adapter = snapshotRenderHarness(RealtimeBattle);
  adapter.orbit(0.31, -0.08);
  adapter.zoom(-0.4);
  adapter.updateCamera(start);
  const baseline = adapter.camera.position.clone();

  adapter.renderSnapshot(start);
  assert.notDeepEqual(adapter.camera.position.toArray(), baseline.toArray(), "the active intro visibly changes camera framing before the preference changes");

  adapter.setReducedMotion(true);
  adapter.updateCamera(whileReduced);
  assertNear(adapter.camera.position.x, baseline.x, "enabling reduced motion cancels the active dolly x offset immediately");
  assertNear(adapter.camera.position.y, baseline.y, "enabling reduced motion cancels the active dolly y offset immediately");
  assertNear(adapter.camera.position.z, baseline.z, "enabling reduced motion cancels the active dolly z offset immediately");

  adapter.setReducedMotion(false);
  adapter.updateCamera(restoredMotion);
  assertNear(adapter.camera.position.x, baseline.x, "re-enabling motion does not resurrect the cancelled dolly x offset");
  assertNear(adapter.camera.position.y, baseline.y, "re-enabling motion does not resurrect the cancelled dolly y offset");
  assertNear(adapter.camera.position.z, baseline.z, "re-enabling motion does not resurrect the cancelled dolly z offset");
  assert.deepEqual([start, whileReduced, restoredMotion], snapshotsBefore, "runtime preference changes leave every supplied snapshot immutable");
  adapter.dispose();
});

test("authored lookout attention targets determine rendered yaw instead of being ignored", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const profile = stageWorldFor("cinder-span");
  const lookout = profile.presentation.npcs[0];

  try {
    adapter.ensureStageTerrain(profile.stageId);
    const rendered = await waitFor(
      () => adapter.debugPresentationState().stageDecor.records.find(({ id }) => id === lookout.id),
      "the authored lookout did not render",
    );
    const target = lookout.presentationCue.lookAt;
    const expectedYaw = Math.atan2(
      worldX(target.x) - worldX(lookout.placement.x),
      worldZ(target.y) - worldZ(lookout.placement.y),
    );
    const fallbackDelta = Math.atan2(
      Math.sin(expectedYaw - lookout.placement.yawRadians),
      Math.cos(expectedYaw - lookout.placement.yawRadians),
    );

    assert.ok(
      Math.abs(fallbackDelta) > 0.1,
      "the fixture's attention heading must differ materially from its fallback placement yaw",
    );
    assertNear(rendered.yaw, expectedYaw, "the rendered lookout faces its authored attention target");
  } finally {
    adapter.dispose();
  }
});

test("failed stage decor retries while ineligible terrain candidates are never requested", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const profile = stageWorldFor("echo-throne");
  const bridgeProfile = stageWorldFor("cinder-span");
  // Every prop mesh URL (PROPS.blade/PROPS.relic) is already cached by
  // earlier tests in this file (loadGltf() caches by URL for the module's
  // lifetime), so injecting a failure there would never fire a fresh
  // gltfLoader.load() call. Echo Throne's VFX cue model is stage-unique
  // and untouched before this test runs, making it the only decor entry
  // that can genuinely exercise the retry-after-failure path.
  const failedDecor = profile.presentation.vfxCues[0];
  const failedUrl = `./${failedDecor.modelPath}`;
  const candidateTerrainUrl = `./${profile.terrainSourceCandidatePath}`;
  const expectedDecorCount = profile.presentation.props.length + profile.presentation.npcs.length + profile.presentation.vfxCues.length;
  const requestStart = gltfRequests.length;
  gltfFailuresRemaining.set(failedUrl, 1);

  try {
    adapter.ensureStageTerrain(profile.stageId);
    await waitFor(
      () => {
        const decor = adapter.debugPresentationState().stageDecor;
        return decor.stageId === profile.stageId
          && decor.loading === false
          && decor.records.length === expectedDecorCount - 1;
      },
      "the first stage visit did not settle with only the failed VFX cue absent",
    );
    assert.equal(
      adapter.debugPresentationState().stageDecor.records.some(({ id }) => id === failedDecor.id),
      false,
      "a rejected VFX cue is absent from only the failed visit",
    );
    const firstTerrain = adapter.debugPresentationState().stageDecor;
    // Cycle 10 supersession: promoted composed slab floor replaces procedural support.
    assert.equal(firstTerrain.terrainSource, "promoted-glb", "Echo Throne must render its composed slab floor");
    assert.equal(firstTerrain.terrainModelPath, profile.terrainGlbPath, "Echo Throne must publish the promoted floor as loaded terrain");
    assert.equal(firstTerrain.terrainSourceCandidatePath, profile.terrainSourceCandidatePath, "Echo Throne must retain candidate provenance");

    adapter.ensureStageTerrain(bridgeProfile.stageId);
    await waitFor(
      () => {
        const decor = adapter.debugPresentationState().stageDecor;
        return decor.stageId === bridgeProfile.stageId && decor.loading === false;
      },
      "the bridge stage visit did not settle",
    );

    adapter.ensureStageTerrain(profile.stageId);
    await waitFor(
      () => {
        const decor = adapter.debugPresentationState().stageDecor;
        return decor.stageId === profile.stageId
          && decor.loading === false
          && decor.records.length === expectedDecorCount
          && decor.records.some(({ id }) => id === failedDecor.id);
      },
      "the failed VFX cue was not retried on the later stage visit",
    );

    const requests = gltfRequests.slice(requestStart);
    assert.equal(
      requests.filter((url) => url === failedUrl).length,
      2,
      "the rejected VFX cue URL is evicted and requested again",
    );
    assert.equal(
      requests.filter((url) => url === candidateTerrainUrl).length,
      0,
      "the retained but ineligible Echo Throne terrain candidate must never be requested",
    );
    assert.equal(
      adapter.debugPresentationState().stageDecor.records.length,
      expectedDecorCount,
      "the later visit publishes the complete authored decor set",
    );
  } finally {
    gltfFailuresRemaining.delete(failedUrl);
    adapter.dispose();
  }
});

test("BOSS_SPAWNED VFX anchors to the spawned boss instead of a quest point", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const profile = stageWorldFor("cinder-span");
  const boss = Object.freeze({
    id: "s1-cinder-warden",
    class: "boss",
    x: 8300,
    y: 3100,
    elevation: 420,
  });
  const event = Object.freeze({
    type: "BOSS_SPAWNED",
    eventId: "boss-spawned:entity-anchor",
    bossId: boss.id,
    objectiveId: "boss-kill",
    quest: Object.freeze({
      questId: "cinder-span:unchain-the-descent",
      objectiveId: null,
    }),
    storyBeat: Object.freeze({
      event: Object.freeze({ type: "BOSS_SPAWNED", bossId: boss.id }),
    }),
  });
  const snapshot = Object.freeze({
    tick: 90,
    stageId: profile.stageId,
    commander: Object.freeze({ id: "commander", x: 9000, y: 6000, elevation: 0 }),
    enemies: Object.freeze([boss]),
    companions: Object.freeze([]),
    projectiles: Object.freeze([]),
    pickups: Object.freeze([]),
    events: Object.freeze([event]),
  });
  const snapshotBefore = structuredClone(snapshot);

  try {
    adapter.collectFeedback(snapshot);
    const spawnVfx = adapter.vfxInstances.find(({ eventType }) => eventType === "BOSS_SPAWNED");
    assert.ok(spawnVfx, "the boss-entry event must create its transient VFX");
    assertNear(spawnVfx.root.position.x, worldX(boss.x), "boss-entry VFX consumes the spawned boss x");
    assertNear(spawnVfx.root.position.z, worldZ(boss.y), "boss-entry VFX consumes the spawned boss y");
    assertNear(
      spawnVfx.root.position.y,
      boss.elevation * 14 / 12000 + 0.6,
      "boss-entry VFX consumes the spawned boss elevation",
    );
    const questPointPositions = profile.presentation.questPoints.map(({ placement }) => [
      worldX(placement.x),
      placement.elevation * 14 / 12000 + 0.6,
      worldZ(placement.y),
    ]);
    assert.equal(
      questPointPositions.some(([x, y, z]) =>
        Math.abs(spawnVfx.root.position.x - x) <= 1e-6
        && Math.abs(spawnVfx.root.position.y - y) <= 1e-6
        && Math.abs(spawnVfx.root.position.z - z) <= 1e-6),
      false,
      "boss-entry VFX must not fall back to any authored quest-point placement",
    );
    assert.deepEqual(snapshot, snapshotBefore, "boss-entry presentation must not mutate the authoritative snapshot");
  } finally {
    await Promise.allSettled([...adapter.pendingVfxLoads]);
    adapter.dispose();
  }
});

test("impact VFX stay short-lived and bounded without evicting an active boss telegraph", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const tick = 100;
  const baseSnapshot = Object.freeze({
    tick,
    commander: Object.freeze({ id: "commander", x: 9000, y: 6000, elevation: 0 }),
    enemies: Object.freeze([Object.freeze({ id: "boss-target", class: "boss", x: 17000, y: 6000, elevation: 0 })]),
    companions: Object.freeze([]),
    projectiles: Object.freeze([]),
    pickups: Object.freeze([]),
  });
  const emit = async (event) => {
    adapter.collectFeedback({ ...baseSnapshot, events: [event] });
    await waitFor(
      () => adapter.pendingVfxLoads.size === 0,
      `${event.type} VFX load did not settle`,
    );
  };

  try {
    await emit({
      type: "BOSS_ATTACK_TELEGRAPHED",
      eventId: "telegraph:active",
      targetId: "commander",
      windupTicks: 60,
    });
    const telegraph = adapter.vfxInstances.find(({ eventType }) => eventType === "BOSS_ATTACK_TELEGRAPHED");
    assert.ok(telegraph, "the active boss telegraph must enter the transient VFX pool");
    assert.equal(telegraph.untilTick - tick, 60, "the telegraph lifetime must follow its active windup window");

    const impactTypes = ["MELEE_IMPACT", "PROJECTILE_IMPACT", "SKILL_RESOLVED_DAMAGE"];
    for (let index = 0; index < MAX_VISUAL_EFFECTS + 6; index += 1) {
      const type = impactTypes[index % impactTypes.length];
      await emit({
        type,
        eventId: `impact:${index}`,
        sourceId: "commander",
        targetId: "boss-target",
        damage: index + 1,
      });
    }

    assert.equal(adapter.vfxInstances.length, MAX_VISUAL_EFFECTS, "the transient VFX pool must stay capped after impact pressure exceeds its budget");
    assert.equal(adapter.vfxInstances.includes(telegraph), true, "non-critical impact eviction must preserve the active boss telegraph");
    const expectedLifetime = { MELEE_IMPACT: 8, PROJECTILE_IMPACT: 8, SKILL_RESOLVED_DAMAGE: 10 };
    const impacts = adapter.vfxInstances.filter(({ eventType }) => eventType in expectedLifetime);
    assert.equal(impacts.length, MAX_VISUAL_EFFECTS - 1, "only non-critical impacts may occupy the remaining capped slots");
    for (const type of impactTypes) {
      const records = impacts.filter(({ eventType }) => eventType === type);
      assert.ok(records.length > 0, `${type} must remain represented after eviction`);
      assert.equal(
        records.every(({ untilTick }) => untilTick - tick === expectedLifetime[type]),
        true,
        `${type} must use its short authored lifetime`,
      );
    }
  } finally {
    adapter.dispose();
  }
});

test("a cold-load boss telegraph preempts one unresolved impact VFX at the authored pool budget", async () => {
  const previousLoad = GLTFLoader.prototype.load;
  const heldLoads = [];
  let adapter = null;
  GLTFLoader.prototype.load = function holdColdVfx(url, onLoad) {
    heldLoads.push({ onLoad, requestUrl: String(url) });
    return this;
  };

  try {
    const { RealtimeBattle } = await import(`../battle-realtime-three.js?cold-vfx-priority=${Date.now()}`);
    adapter = realtimeBattleHarness(RealtimeBattle);
    const tick = 200;
    const baseSnapshot = {
      tick,
      commander: { id: "commander", x: 9000, y: 6000, elevation: 0 },
      enemies: [{ id: "boss-target", class: "boss", x: 17000, y: 6000, elevation: 0 }],
      companions: [],
      projectiles: [],
      pickups: [],
    };
    const impacts = Array.from({ length: MAX_VISUAL_EFFECTS }, (_, index) => ({
      type: "MELEE_IMPACT",
      eventId: `cold-impact:${index}`,
      sourceId: "commander",
      targetId: "boss-target",
      damage: index + 1,
    }));

    adapter.collectFeedback({ ...baseSnapshot, events: impacts });
    assert.equal(adapter.pendingVfxLoads.size, MAX_VISUAL_EFFECTS, "the fixture must hold every non-critical impact load unresolved");
    assert.equal(adapter.vfxInstances.length, MAX_VISUAL_EFFECTS, "unresolved impacts must occupy the full active VFX budget");
    const firstImpact = adapter.vfxInstances[0];
    assert.equal(firstImpact.eventType, "MELEE_IMPACT", "the first expendable record must be an impact");
    assert.equal(firstImpact.loaded, false, "cold impact records must still be placeholders");
    const firstImpactLoadRequest = firstImpact.loadRequest;
    assert.equal(adapter.pendingVfxLoads.has(firstImpactLoadRequest), true, "the first impact load must begin in pending accounting");

    adapter.collectFeedback({
      ...baseSnapshot,
      events: [{
        type: "BOSS_ATTACK_TELEGRAPHED",
        eventId: "cold-telegraph:priority",
        targetId: "commander",
        windupTicks: 60,
      }],
    });

    const telegraph = adapter.vfxInstances.find(({ eventType }) => eventType === "BOSS_ATTACK_TELEGRAPHED");
    assert.ok(telegraph, "priority admission must retain the boss telegraph");
    assert.equal(telegraph.loaded, false, "the admitted telegraph must remain an active placeholder while its GLB is cold");
    assert.equal(telegraph.root.parent, adapter.vfxGroup, "the telegraph placeholder must be attached to the live VFX group");
    assert.equal(adapter.vfxInstances.length, MAX_VISUAL_EFFECTS, "priority admission must keep the active VFX pool capped");
    assert.equal(adapter.pendingVfxLoads.size, MAX_VISUAL_EFFECTS, "evicted pending work must make room for the critical load without raw pending growth");
    assert.equal(adapter.vfxInstances.includes(firstImpact), false, "priority eviction must invalidate an expendable impact record");
    assert.equal(firstImpact.root.parent, null, "the invalidated impact placeholder must leave the live VFX group");
    assert.equal(firstImpact.loadRequest, null, "retirement must sever the evicted impact's pending-load ownership");
    assert.equal(adapter.pendingVfxLoads.has(firstImpactLoadRequest), false, "the evicted impact load must leave pending accounting");
    assert.equal(
      adapter.vfxInstances.filter(({ eventType }) => eventType === "MELEE_IMPACT").length,
      MAX_VISUAL_EFFECTS - 1,
      "the telegraph must replace exactly one non-critical impact",
    );

    const secondImpact = adapter.vfxInstances.find(({ eventType }) => eventType === "MELEE_IMPACT");
    const secondImpactLoadRequest = secondImpact.loadRequest;
    adapter.collectFeedback({
      ...baseSnapshot,
      events: [{
        type: "BOSS_ATTACK_TELEGRAPHED",
        eventId: "cold-telegraph:priority-repeat",
        targetId: "commander",
        windupTicks: 60,
      }],
    });
    const telegraphs = adapter.vfxInstances.filter(({ eventType }) => eventType === "BOSS_ATTACK_TELEGRAPHED");
    assert.equal(telegraphs.length, 2, "a second critical admission must repeat while the cold pool remains full");
    assert.equal(adapter.vfxInstances.length, MAX_VISUAL_EFFECTS, "repeated critical replacement must keep the active pool capped");
    assert.equal(adapter.pendingVfxLoads.size, MAX_VISUAL_EFFECTS, "repeated replacement must not accumulate dead pending loads");
    assert.equal(secondImpact.loadRequest, null, "the second evicted impact must also release its load request");
    assert.equal(adapter.pendingVfxLoads.has(secondImpactLoadRequest), false, "the second evicted request must leave pending accounting");
    assert.equal(
      adapter.vfxInstances.filter(({ eventType }) => eventType === "MELEE_IMPACT").length,
      MAX_VISUAL_EFFECTS - 2,
      "two critical placeholders must replace exactly two non-critical impacts",
    );
  } finally {
    GLTFLoader.prototype.load = previousLoad;
    const pending = adapter ? [...adapter.pendingVfxLoads] : [];
    for (const { onLoad, requestUrl } of heldLoads) {
      const cue = stageVfxCueByUrl.get(requestUrl);
      onLoad(cue ? syntheticStageVfxRig(cue) : syntheticRig());
    }
    await Promise.allSettled(pending);
    adapter?.dispose();
  }
});

test("stage switches replace decor resources and dispose clears all tracked stage presentation", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const firstProfile = stageWorldFor("cinder-span");
  const secondProfile = stageWorldFor("abyss-chancel");

  adapter.ensureStageTerrain(firstProfile.stageId);
  await waitFor(
    () => adapter.debugPresentationState().stageDecor.loading === false,
    "first stage dressing did not finish loading",
  );
  const first = adapter.debugPresentationState().stageDecor;
  const firstIds = new Set(first.records.map(({ id }) => id));
  assert.equal(first.mixerCount, firstProfile.presentation.npcs.length + firstProfile.presentation.vfxCues.length);
  assert.ok(first.actionCount > 0);

  adapter.ensureStageTerrain(secondProfile.stageId);
  const replacing = adapter.debugPresentationState().stageDecor;
  assert.equal(replacing.stageId, secondProfile.stageId);
  assert.equal(replacing.loading, true);
  assert.equal(replacing.terrainLoaded, false);
  assert.equal(replacing.propCount, 0);
  assert.equal(replacing.npcCount, 0);
  assert.equal(replacing.mixerCount, 0);
  assert.equal(replacing.actionCount, 0);
  assert.deepEqual(replacing.records, [], "old-stage records are removed before replacement assets publish");

  await waitFor(
    () => adapter.debugPresentationState().stageDecor.loading === false,
    "replacement stage dressing did not finish loading",
  );
  const second = adapter.debugPresentationState().stageDecor;
  assert.equal(second.stageId, secondProfile.stageId);
  assert.equal(second.terrainLoaded, true);
  assert.equal(second.propCount, secondProfile.presentation.props.length);
  assert.equal(second.npcCount, secondProfile.presentation.npcs.length);
  assert.equal(second.mixerCount, secondProfile.presentation.npcs.length + secondProfile.presentation.vfxCues.length);
  assert.ok(second.actionCount > 0);
  assert.ok(
    second.records.every(({ id }) => !firstIds.has(id)),
    "no old-stage prop or NPC record survives the switch",
  );

  adapter.dispose();
  const disposed = adapter.debugPresentationState().stageDecor;
  assert.equal(disposed.stageId, null);
  assert.equal(disposed.loading, false);
  assert.equal(disposed.terrainLoaded, false);
  assert.equal(disposed.propCount, 0);
  assert.equal(disposed.npcCount, 0);
  assert.equal(disposed.mixerCount, 0);
  assert.equal(disposed.actionCount, 0);
  assert.deepEqual(disposed.records, []);
});

test("actors render with banded cel shading rather than smooth PBR", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  adapter.reconcileActors({
    tick: 1,
    enemies: [{ id: "cel-actor", kind: "rusher", x: 12000, y: 6000 }],
  });
  await settleLoadedActors(adapter, ["cel-actor"]);

  const record = adapter.actors.get("cel-actor");
  const materials = [];
  record.root.traverse((node) => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material) materials.push(material);
    }
  });
  assert.ok(materials.length > 0, "the actor must expose materials");

  for (const material of materials) {
    assert.equal(material.isMeshToonMaterial, true, `${material.name}: actor materials must be toon shaded`);
    const ramp = material.gradientMap;
    assert.ok(ramp?.isTexture, `${material.name}: cel shading needs a gradient ramp`);
    // Nearest filtering is what makes the ramp read as hard bands; a filtered
    // ramp would interpolate straight back into the smooth gradient this
    // replaces.
    assert.equal(ramp.magFilter, THREE.NearestFilter, "the ramp must not interpolate between bands");
    assert.equal(ramp.minFilter, THREE.NearestFilter, "the ramp must not interpolate between bands");
    assert.equal(ramp.image.width, 3, "the authored contract is three shadow bands");
    assert.ok(ramp.image.data[0] > 0, "the darkest band must stay readable rather than crushing to black");
    assert.ok(
      ramp.image.data[2] > ramp.image.data[0],
      "the ramp must actually rise from shadow to light",
    );
  }

  // The ramp is shared, not rebuilt per actor.
  adapter.reconcileActors({
    tick: 2,
    enemies: [
      { id: "cel-actor", kind: "rusher", x: 12000, y: 6000 },
      { id: "cel-actor-2", kind: "rusher", x: 13000, y: 6000 },
    ],
  });
  await settleLoadedActors(adapter, ["cel-actor", "cel-actor-2"]);
  const second = adapter.actors.get("cel-actor-2");
  let secondRamp = null;
  second.root.traverse((node) => {
    if (node.isMesh && !secondRamp) secondRamp = (Array.isArray(node.material) ? node.material[0] : node.material)?.gradientMap;
  });
  assert.equal(secondRamp, materials[0].gradientMap, "every actor shares one cel ramp");

  adapter.dispose();
});

// --- Cycle-10 renderer VFX contracts -------------------------------------------------
// The drop / buff / arrival / deformation families landed with no test that emits their
// event types, so every branch below was unreachable from this suite: the pre-existing
// tests could only prove the new code did not break old behaviour. The failure mode being
// hunted here is SILENT ABSENCE. effectAnchor() returns null for an unanchorable event and
// spawnVfx() hard-returns with no console warning, so a cue that never spawns is
// indistinguishable in production from a cue that was never requested.

// MAX_VISUAL_EFFECTS. The predicates under test are still not exported, so they are asserted
// against restated behaviour -- but the BUDGET is now exported and is imported here. Restating
// it duplicated an authored number in two files, and when the budget moved from 24 to 40 for
// the always-area combat model these rows failed on the stale copy rather than on any real
// behaviour change. The pool's capacity is the renderer's to author; what this file asserts is
// that the pool stays AT that capacity and that the right records survive overflow.
const POOL_CAPACITY = MAX_VISUAL_EFFECTS;
// MAX_DROP_BEACONS, equal to the peer contract's MAX_FIELD_DROPS so the bound cannot grow
// with wave count.
const DROP_BEACON_CAP = 8;
// DROP_BEACON_WARN_TICKS. A cross-lane constant: HUD, audio and VFX must warn on the same
// tick, so the boundary is pinned rather than merely relationally asserted.
const DROP_BEACON_WARN_TICKS = 180;

// The 33 event ids VFX_MODELS carried before this cycle, and the 17 of them
// CRITICAL_VFX_EVENT_TYPES exempts from eviction. Both lists are restated independently so
// the equivalence check below is a real contract rather than a mirror of the frozen
// literals it is meant to police.
const PRE_CYCLE10_VFX_EVENT_TYPES = Object.freeze([
  "INPUT_ACCEPTED",
  "INPUT_REJECTED",
  "PICKUP_DENIED",
  "ECHO_DENIED",
  "EXTRACTION_REJECTED",
  "OBJECTIVE_FAILED",
  "ENCOUNTER_OBJECTIVE_FAILED",
  "PROJECTILE_BLOCKED",
  "PROJECTILE_EXPIRED",
  "BOSS_ATTACK_CANCELLED",
  "CRITICAL_HIT",
  "MELEE_IMPACT",
  "PROJECTILE_IMPACT",
  "SKILL_RESOLVED_DAMAGE",
  "COMMANDER_DAMAGED",
  "COMPANION_DAMAGED",
  "ITEM_COLLECTED",
  "OBJECTIVE_PHASE_CHANGED",
  "ENCOUNTER_OBJECTIVE_STARTED",
  "OBJECTIVE_COMPLETED",
  "ENCOUNTER_OBJECTIVE_COMPLETED",
  "WAVE_CLEARED",
  "EXTRACTION_WINDOW_OPENED",
  "OCCUPATION_CAPTURED",
  "EXTRACTION_COMPLETED",
  "BOSS_ATTACK_TELEGRAPHED",
  "BOSS_SPAWNED",
  "BOSS_RALLY_WINDOW",
  "GATE_BREACHED",
  "WARDENS_WARD_TRIGGERED",
  "ECHO_WARDEN_AWAKENING_TRIGGERED",
  "COMPANION_DOWNED",
  "TERMINAL",
]);
const PRE_CYCLE10_CRITICAL_TYPES = Object.freeze([
  "CRITICAL_HIT",
  "BOSS_ATTACK_TELEGRAPHED",
  "BOSS_RALLY_WINDOW",
  "BOSS_SPAWNED",
  "EXTRACTION_WINDOW_OPENED",
  "GATE_BREACHED",
  "WARDENS_WARD_TRIGGERED",
  "ECHO_WARDEN_AWAKENING_TRIGGERED",
  "COMPANION_DOWNED",
  "OBJECTIVE_PHASE_CHANGED",
  "ENCOUNTER_OBJECTIVE_STARTED",
  "OBJECTIVE_COMPLETED",
  "ENCOUNTER_OBJECTIVE_COMPLETED",
  "OCCUPATION_CAPTURED",
  "OBJECTIVE_FAILED",
  "ENCOUNTER_OBJECTIVE_FAILED",
  "TERMINAL",
]);

function cycle10Snapshot(overrides = {}) {
  return {
    commander: { id: "commander", x: 9000, y: 6000, elevation: 0 },
    gate: { id: "gate", x: 22000, y: 6000, elevation: 0 },
    enemies: [],
    companions: [],
    projectiles: [],
    pickups: [],
    ...overrides,
  };
}

// Drives exactly one event and returns the record it produced, or null when the cue was
// silently dropped. The pool is swept to empty first: collectFeedback() retires records
// whose untilTick has passed before admitting new ones, so each case starts with an empty
// pool AND an empty per-family live budget (drop 3 / buff 2 / spawn 4 / deform 1). Without
// that sweep a dropped cue would be masked by the previous case's surviving record.
async function driveOneVfxEvent(adapter, base, event, tick) {
  adapter.collectFeedback({ ...base, tick, events: [] });
  assert.equal(
    adapter.vfxInstances.length,
    0,
    `the transient pool must be quiescent before driving ${event.type}`,
  );
  adapter.collectFeedback({ ...base, tick, events: [event] });
  await waitFor(
    () => adapter.pendingVfxLoads.size === 0,
    `${event.type} VFX load did not settle`,
  );
  return adapter.vfxInstances.length === 1 ? adapter.vfxInstances[0] : null;
}

// spawnVfx() offsets every placeholder 0.6 above its anchor, and worldPointInto() maps
// gameplay elevation through the same WORLD_SCALE/arena-height ratio the actor path uses.
function assertVfxAnchoredAt(record, anchor, label) {
  assertNear(record.root.position.x, worldX(anchor.x), `${label}: rendered x must consume the payload anchor`);
  assertNear(record.root.position.z, worldZ(anchor.y), `${label}: rendered z must consume the payload anchor`);
  assertNear(
    record.root.position.y,
    (anchor.elevation ?? 0) * 14 / 12000 + 0.6,
    `${label}: rendered elevation must consume the payload anchor`,
  );
}

// Admits `subjectEvent`, fills the pool to MAX_VISUAL_EFFECTS behind it, then overflows by
// one. trackVfxInstance() evicts the FIRST non-critical record, and the subject is that
// record's predecessor at index 0, so an exempt subject survives and a non-exempt subject
// is the first thing to go. Survival is therefore a direct read of the exemption predicate
// through the only surface that observes it.
async function poolSurvivalOf(RealtimeBattle, subjectEvent) {
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const base = cycle10Snapshot({
    enemies: [{ id: "pool-enemy", class: "boss", x: 17000, y: 6000, elevation: 0 }],
  });
  const tick = 100;
  const settle = () => waitFor(
    () => adapter.pendingVfxLoads.size === 0,
    `${subjectEvent.type} pool fixture did not settle`,
  );
  const filler = (index) => ({
    type: "MELEE_IMPACT",
    eventId: `pool-filler:${subjectEvent.eventId}:${index}`,
    sourceId: "commander",
    targetId: "pool-enemy",
    damage: index + 1,
  });

  try {
    adapter.collectFeedback({ ...base, tick, events: [subjectEvent] });
    await settle();
    const subject = adapter.vfxInstances[0] ?? null;
    if (!subject) return { admitted: false, survived: false, filledSize: 0, poolSize: adapter.vfxInstances.length };

    adapter.collectFeedback({
      ...base,
      tick,
      events: Array.from({ length: POOL_CAPACITY - 1 }, (_unused, index) => filler(index)),
    });
    await settle();
    const filledSize = adapter.vfxInstances.length;

    adapter.collectFeedback({ ...base, tick, events: [filler(POOL_CAPACITY)] });
    await settle();
    return {
      admitted: true,
      survived: adapter.vfxInstances.includes(subject),
      filledSize,
      poolSize: adapter.vfxInstances.length,
    };
  } finally {
    adapter.dispose();
  }
}

function dropBeaconHarness(RealtimeBattle) {
  const adapter = realtimeBattleHarness(RealtimeBattle);
  // mount() builds this group beside terrain/actor/vfx and adds it straight to the scene;
  // the shared harness predates the beacon surface, so it is wired here the same way.
  // syncDropBeacons() no-ops without it, which would make every beacon assertion vacuous.
  adapter.dropDecalGroup = new THREE.Group();
  adapter.dropDecalGroup.name = "drop-decals";
  adapter.scene.add(adapter.dropDecalGroup);
  return adapter;
}

// Read through the live scene graph rather than the internal Map, so the assertions cover
// what is actually attached and drawn.
function beaconGroupFor(adapter, pickupId) {
  return adapter.dropDecalGroup?.children.find((child) => child.name === `drop-beacon-${pickupId}`) ?? null;
}

function beaconPartOpacity(group, geometryType) {
  const mesh = group?.children.find((child) => child.isMesh && child.geometry?.type === geometryType);
  return mesh ? mesh.material.opacity : null;
}

test("every cycle-10 event family produces an anchored VFX record instead of failing silently", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const commander = { id: "commander", x: 9000, y: 6000, elevation: 0 };
  const arrival = { id: "arrival-shadow", class: "rusher", x: 15000, y: 8000, elevation: 240 };
  const base = cycle10Snapshot({ commander, enemies: [arrival] });
  const before = structuredClone(base);
  // Every deformation anchor is deliberately far from the commander and from the arrival,
  // so an implementation that anchored the whole family to one convenient entity fails.
  const cases = [
    {
      event: {
        type: "DROP_SPAWNED",
        eventId: "drop:spawned",
        dropId: "drop-001",
        itemId: "ember-draught",
        rarity: "resonant",
        x: 6200,
        y: 3400,
      },
      anchor: { x: 6200, y: 3400, elevation: 0 },
      why: "top-level x/y via the event-as-own-anchor branch",
    },
    {
      event: {
        type: "DROP_EXPIRED",
        eventId: "drop:expired",
        dropId: "drop-002",
        itemId: "ember-draught",
        x: 7100,
        y: 9200,
      },
      anchor: { x: 7100, y: 9200, elevation: 0 },
      why: "top-level x/y, no rarity in the ruled payload",
    },
    {
      event: {
        type: "DROP_DENIED",
        eventId: "drop:denied",
        dropId: "drop-003",
        reason: "FIELD_CAP",
        x: 18300,
        y: 2100,
      },
      anchor: { x: 18300, y: 2100, elevation: 0 },
      why: "top-level x/y with the single ruled reason value",
    },
    {
      event: {
        type: "BUFF_APPLIED",
        eventId: "buff:applied",
        buffId: "buff-001",
        stat: "power",
        magnitude: 120,
        durationTicks: 600,
      },
      anchor: commander,
      why: "commander fallback: the buff family carries no position and no entity id",
    },
    {
      event: {
        type: "BUFF_REFRESHED",
        eventId: "buff:refreshed",
        buffId: "buff-001",
        stat: "power",
        stacks: 2,
        expiresAtTick: 2400,
      },
      anchor: commander,
      why: "commander fallback",
    },
    {
      event: {
        type: "BUFF_EXPIRED",
        eventId: "buff:expired",
        buffId: "buff-001",
        stat: "power",
        reason: "TIMEOUT",
      },
      anchor: commander,
      why: "commander fallback, TIMEOUT is the only reason that reads as a loss",
    },
    {
      event: {
        type: "ENEMY_SPAWNED",
        eventId: "arrival:shadow",
        enemyId: arrival.id,
        grade: "SHADOW",
        telegraphTicks: 60,
      },
      anchor: arrival,
      why: "enemyId resolves the live snapshot enemy, elevation included",
    },
    {
      event: {
        type: "GIMMICK_ARMED",
        eventId: "gimmick:armed",
        gimmickId: "span-fracture",
        gimmickClass: "deformation",
        telegraphTicks: 180,
        x: 11000,
        y: 4200,
      },
      anchor: { x: 11000, y: 4200, elevation: 0 },
      why: "top-level x/y; gimmickId is not an entity id",
    },
    {
      event: {
        type: "GIMMICK_TRIGGERED",
        eventId: "gimmick:triggered",
        gimmickId: "span-fracture",
        gimmickClass: "deformation",
        x: 11000,
        y: 4200,
      },
      anchor: { x: 11000, y: 4200, elevation: 0 },
      why: "top-level x/y",
    },
    {
      event: {
        type: "GIMMICK_RESOLVED",
        eventId: "gimmick:resolved",
        gimmickId: "span-fracture",
        gimmickClass: "deformation",
        x: 11000,
        y: 4200,
      },
      anchor: { x: 11000, y: 4200, elevation: 0 },
      why: "top-level x/y",
    },
  ];

  try {
    // Spacing exceeds the longest new-family lifetime (GIMMICK_ARMED fallback 180), so the
    // previous cue is always swept before the next case is admitted.
    let tick = 1000;
    for (const { event, anchor, why } of cases) {
      tick += 400;
      const record = await driveOneVfxEvent(adapter, base, event, tick);
      assert.ok(record, `${event.type} must produce a VFX record (${why}) -- a null anchor is discarded with no warning`);
      assert.equal(record.eventType, event.type, `${event.type} must publish its own event type on the pool record`);
      assertVfxAnchoredAt(record, anchor, event.type);
      assert.equal(record.root.parent, adapter.vfxGroup, `${event.type} placeholder must be attached to the live VFX group`);
    }

    // The suppression rule shares the `reason` field with four unrelated vocabularies, so
    // it is asserted alongside the positive case: only TIMEOUT reads as a loss, and a
    // stage-transition flush of MAX_ACTIVE_BUFFS must not burst six cues.
    for (const reason of ["EVICTED", "STAGE_TRANSITION", "DEATH"]) {
      tick += 400;
      const suppressed = await driveOneVfxEvent(adapter, base, {
        type: "BUFF_EXPIRED",
        eventId: `buff:expired:${reason}`,
        buffId: "buff-002",
        stat: "power",
        reason,
      }, tick);
      assert.equal(suppressed, null, `BUFF_EXPIRED reason ${reason} must be suppressed at source, not rendered as a loss`);
    }

    assert.deepEqual(base, before, "cycle-10 cue presentation must not mutate the authoritative snapshot");
  } finally {
    await Promise.allSettled([...adapter.pendingVfxLoads]);
    adapter.dispose();
  }
});

test("telegraph lifetimes come from the event payload and fall back to the class default when unusable", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const arrival = { id: "arrival-unit", class: "rusher", x: 15000, y: 8000, elevation: 0 };
  const base = cycle10Snapshot({ enemies: [arrival] });
  let tick = 5000;

  const lifetimeOf = async (event) => {
    tick += 400;
    const record = await driveOneVfxEvent(adapter, base, event, tick);
    assert.ok(record, `${event.eventId} must produce a VFX record before its lifetime can be measured`);
    return record.untilTick - tick;
  };

  try {
    // A hardcoded constant would be right for exactly one authored tier and wrong for the
    // other three. The simulation fires TRIGGERED at ARMED + telegraphTicks, so a cue that
    // ignores the field keeps claiming "arming" after the gimmick already fired.
    const armedByTier = {};
    for (const [gimmickClass, telegraphTicks] of [
      ["deformation", 180],
      ["gate", 120],
      ["mirror", 90],
      ["hazard", 60],
    ]) {
      armedByTier[gimmickClass] = await lifetimeOf({
        type: "GIMMICK_ARMED",
        eventId: `armed:${gimmickClass}`,
        gimmickId: `g-${gimmickClass}`,
        gimmickClass,
        telegraphTicks,
        x: 11000,
        y: 4200,
      });
    }
    assert.deepEqual(
      armedByTier,
      { deformation: 180, gate: 120, mirror: 90, hazard: 60 },
      "each authored arming window must produce its own cue length, not one shared constant",
    );

    // Fallback is the CLASS default, never the malformed field. Integer-only on purpose:
    // ticks are integers everywhere, so a float is a payload defect worth rejecting.
    const GIMMICK_ARMED_DEFAULT = 180;
    for (const [label, telegraphTicks] of [
      ["absent", undefined],
      ["zero", 0],
      ["negative", -30],
      ["fractional", 90.5],
      ["string", "120"],
      ["null", null],
      ["NaN", Number.NaN],
    ]) {
      const observed = await lifetimeOf({
        type: "GIMMICK_ARMED",
        eventId: `armed-fallback:${label}`,
        gimmickId: "g-fallback",
        gimmickClass: "deformation",
        telegraphTicks,
        x: 11000,
        y: 4200,
      });
      assert.equal(
        observed,
        GIMMICK_ARMED_DEFAULT,
        `an ${label} telegraphTicks must fall back to the class default, never be honoured`,
      );
    }

    // Arrival reaction windows are a gameplay contract: the cue length is how long the
    // player has to reposition. SHADOW carries its own default; every other grade uses the
    // registry value.
    const arrivalByGrade = {};
    for (const grade of ["BASIC", "SHADOW", "BOSS"]) {
      arrivalByGrade[grade] = await lifetimeOf({
        type: "ENEMY_SPAWNED",
        eventId: `arrival-default:${grade}`,
        enemyId: arrival.id,
        grade,
      });
    }
    assert.deepEqual(
      arrivalByGrade,
      { BASIC: 30, SHADOW: 60, BOSS: 30 },
      "the SHADOW arrival default must be distinct from the registry default the other grades take",
    );

    assert.equal(
      await lifetimeOf({
        type: "ENEMY_SPAWNED",
        eventId: "arrival-override:basic",
        enemyId: arrival.id,
        grade: "BASIC",
        telegraphTicks: 75,
      }),
      75,
      "an authored telegraphTicks must win over the grade default",
    );
    // The sharpest case in this test: a SHADOW arrival whose telegraphTicks is unusable
    // must fall back to the SHADOW default, not to the shared registry default. A fallback
    // wired to the table would silently halve the elite reaction window to 30.
    assert.equal(
      await lifetimeOf({
        type: "ENEMY_SPAWNED",
        eventId: "arrival-fallback:shadow",
        enemyId: arrival.id,
        grade: "SHADOW",
        telegraphTicks: 0,
      }),
      60,
      "an unusable telegraphTicks on a SHADOW arrival must fall back to the SHADOW default, not the registry default",
    );
  } finally {
    await Promise.allSettled([...adapter.pendingVfxLoads]);
    adapter.dispose();
  }
});

test("BOSS_ATTACK_TELEGRAPHED keeps reading windupTicks and never adopts the cycle-10 telegraphTicks field", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const base = cycle10Snapshot({
    enemies: [{ id: "boss-target", class: "boss", x: 17000, y: 6000, elevation: 0 }],
  });
  const BOSS_TELEGRAPH_DEFAULT = 45;
  let tick = 20000;

  const lifetimeOf = async (event) => {
    tick += 400;
    const record = await driveOneVfxEvent(adapter, base, event, tick);
    assert.ok(record, `${event.eventId} must produce a VFX record`);
    return record.untilTick - tick;
  };

  try {
    // Two distinct values, because a single value cannot distinguish "reads the payload"
    // from "happens to equal the constant".
    assert.equal(
      await lifetimeOf({ type: "BOSS_ATTACK_TELEGRAPHED", eventId: "windup:60", targetId: "commander", windupTicks: 60 }),
      60,
      "an active boss windup must set the telegraph length",
    );
    assert.equal(
      await lifetimeOf({ type: "BOSS_ATTACK_TELEGRAPHED", eventId: "windup:33", targetId: "commander", windupTicks: 33 }),
      33,
      "a second windup value must also be honoured, proving the field is read and not coincidental",
    );
    assert.equal(
      await lifetimeOf({ type: "BOSS_ATTACK_TELEGRAPHED", eventId: "windup:absent", targetId: "commander" }),
      BOSS_TELEGRAPH_DEFAULT,
      "a windupless boss telegraph must fall back to its registry default",
    );
    // The regression this guards: telegraphTicks is a cycle-10 field, and the boss branch
    // predates it. A shared cross-family telegraph reader would silently retarget this
    // event onto the wrong field and hold the cue 200 ticks instead of 45.
    assert.equal(
      await lifetimeOf({
        type: "BOSS_ATTACK_TELEGRAPHED",
        eventId: "windup:foreign-field",
        targetId: "commander",
        telegraphTicks: 200,
      }),
      BOSS_TELEGRAPH_DEFAULT,
      "BOSS_ATTACK_TELEGRAPHED must ignore telegraphTicks -- windupTicks is its only override",
    );
    // And the converse: when both arrive, the branch keyed to this type still wins.
    assert.equal(
      await lifetimeOf({
        type: "BOSS_ATTACK_TELEGRAPHED",
        eventId: "windup:both-fields",
        targetId: "commander",
        windupTicks: 72,
        telegraphTicks: 200,
      }),
      72,
      "with both fields present the boss branch must still resolve through windupTicks",
    );
  } finally {
    await Promise.allSettled([...adapter.pendingVfxLoads]);
    adapter.dispose();
  }
});

test("a contested route path carries telegraphTicks yet produces no telegraph cue", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const enemy = { id: "e-014", class: "rusher", x: 15000, y: 8000, elevation: 0 };
  const base = cycle10Snapshot({ enemies: [enemy] });
  let tick = 30000;

  try {
    // Positive control, run first and against the same adapter and snapshot shape: a real
    // gimmick telegraph DOES produce a cue here. Without it, the absence asserted below
    // would also pass against a dead harness.
    tick += 400;
    const armed = await driveOneVfxEvent(adapter, base, {
      type: "GIMMICK_ARMED",
      eventId: "control:armed",
      gimmickId: "span-fracture",
      gimmickClass: "deformation",
      telegraphTicks: 120,
      x: 11000,
      y: 4200,
    }, tick);
    assert.ok(armed, "positive control: a real GIMMICK_ARMED must still produce a telegraph cue");
    assert.equal(armed.untilTick - tick, 120, "positive control: the control cue must read its own arming window");

    // The real emit from getTargetPosition()'s waypoint.contest branch. It carries BOTH
    // telegraphTicks (a contest duration, not an arming window) and objectiveId -- the two
    // fields a presence-keyed reader would dispatch on. Such a reader renders a complete,
    // plausible-looking telegraph for a route contest that has no gimmick at all.
    tick += 400;
    const contested = await driveOneVfxEvent(adapter, base, {
      type: "ENCOUNTER_PATH_CONTESTED",
      eventId: "contest:single",
      entityId: enemy.id,
      routeId: "cinder-approach",
      waypointId: "contest-gate",
      objectiveId: "hold-the-span",
      releaseAt: tick + 60,
      telegraphTicks: 60,
    }, tick);
    assert.equal(contested, null, "a route contest must produce no telegraph cue -- correct dispatch keys on event.type, never on field presence");

    // The cost of getting this wrong, driven at the stage's real body count: 130 arriving
    // bodies against a 24-slot pool would evict every live combat cue, every wave.
    tick += 400;
    adapter.collectFeedback({ ...base, tick, events: [] });
    assert.equal(adapter.vfxInstances.length, 0, "the pool must be quiescent before the contest flood");
    adapter.collectFeedback({
      ...base,
      tick,
      events: Array.from({ length: 130 }, (_unused, index) => ({
        type: "ENCOUNTER_PATH_CONTESTED",
        eventId: `contest:flood:${index}`,
        entityId: `e-${index}`,
        routeId: "cinder-approach",
        waypointId: "contest-gate",
        objectiveId: "hold-the-span",
        releaseAt: tick + 60,
        telegraphTicks: 60,
      })),
    });
    await waitFor(() => adapter.pendingVfxLoads.size === 0, "the contest flood did not settle");
    assert.equal(adapter.vfxInstances.length, 0, "130 contested bodies must consume zero of the 24 transient pool slots");
    assert.equal(adapter.pendingVfxLoads.size, 0, "a contested body must not even open a model load");
  } finally {
    await Promise.allSettled([...adapter.pendingVfxLoads]);
    adapter.dispose();
  }
});

test("the cycle-10 pool exemption is payload-conditional and keeps the transient pool capped", async () => {
  const { RealtimeBattle } = await rendererModule;
  // Exempting an arrival or a gimmick wholesale would make every BASIC body and every
  // decorative gate un-evictable and starve the pool; exempting none would let an active
  // hazard telegraph be evicted while the hazard is still live. Each row is one branch of
  // the predicate, evaluated against the persisted pool record rather than the live event.
  const cases = [
    { label: "SHADOW arrival", exempt: true, event: { type: "ENEMY_SPAWNED", eventId: "exempt:shadow", enemyId: "pool-enemy", grade: "SHADOW" } },
    { label: "BASIC arrival", exempt: false, event: { type: "ENEMY_SPAWNED", eventId: "exempt:basic", enemyId: "pool-enemy", grade: "BASIC" } },
    { label: "gradeless arrival", exempt: false, event: { type: "ENEMY_SPAWNED", eventId: "exempt:gradeless", enemyId: "pool-enemy" } },
    { label: "deformation arming", exempt: true, event: { type: "GIMMICK_ARMED", eventId: "exempt:deform-armed", gimmickClass: "deformation", x: 11000, y: 4200 } },
    { label: "hazard arming", exempt: true, event: { type: "GIMMICK_ARMED", eventId: "exempt:hazard-armed", gimmickClass: "hazard", x: 11000, y: 4200 } },
    { label: "gate arming", exempt: false, event: { type: "GIMMICK_ARMED", eventId: "exempt:gate-armed", gimmickClass: "gate", x: 11000, y: 4200 } },
    { label: "mirror arming", exempt: false, event: { type: "GIMMICK_ARMED", eventId: "exempt:mirror-armed", gimmickClass: "mirror", x: 11000, y: 4200 } },
    { label: "classless arming", exempt: false, event: { type: "GIMMICK_ARMED", eventId: "exempt:classless-armed", x: 11000, y: 4200 } },
    { label: "deformation contact", exempt: true, event: { type: "GIMMICK_TRIGGERED", eventId: "exempt:deform-trig", gimmickClass: "deformation", x: 11000, y: 4200 } },
    { label: "gate contact", exempt: false, event: { type: "GIMMICK_TRIGGERED", eventId: "exempt:gate-trig", gimmickClass: "gate", x: 11000, y: 4200 } },
    // GIMMICK_RESOLVED is deliberately outside the predicate: the deformation is over, so
    // the cue no longer carries live gameplay information and must stay evictable even
    // though it shares the deformation class with the two exempt phases above.
    { label: "deformation resolution", exempt: false, event: { type: "GIMMICK_RESOLVED", eventId: "exempt:deform-resolved", gimmickClass: "deformation", x: 11000, y: 4200 } },
    { label: "drop appear", exempt: false, event: { type: "DROP_SPAWNED", eventId: "exempt:drop", dropId: "d-1", rarity: "relic", x: 6200, y: 3400 } },
    { label: "buff apply", exempt: false, event: { type: "BUFF_APPLIED", eventId: "exempt:buff", buffId: "b-1", stat: "power" } },
  ];

  const observed = {};
  for (const { label, event } of cases) {
    const result = await poolSurvivalOf(RealtimeBattle, event);
    assert.equal(result.admitted, true, `${label}: the subject must enter the pool before its exemption can be measured`);
    assert.equal(result.filledSize, POOL_CAPACITY, `${label}: the pool must fill to exactly ${POOL_CAPACITY} before overflow`);
    assert.equal(result.poolSize, POOL_CAPACITY, `${label}: the pool must stay capped at ${POOL_CAPACITY} after overflow`);
    observed[label] = result.survived;
  }
  assert.deepEqual(
    observed,
    Object.fromEntries(cases.map(({ label, exempt }) => [label, exempt])),
    "pool exemption must follow the payload (grade / gimmickClass), not the event type alone",
  );
});

test("pool exemption stays byte-equivalent to the pre-cycle-10 membership test for all 33 event ids", async () => {
  const { RealtimeBattle } = await rendererModule;
  // The predicate replaced two bare CRITICAL_VFX_EVENT_TYPES.includes() calls. An
  // over-broad predicate starves the pool and a narrowed one drops live boss telegraphs,
  // and neither shows up in any other test, so every pre-existing id is measured.
  const observed = {};
  for (const type of PRE_CYCLE10_VFX_EVENT_TYPES) {
    const result = await poolSurvivalOf(RealtimeBattle, {
      type,
      eventId: `equivalence:${type}`,
      targetId: "commander",
      sourceId: "commander",
      damage: 1,
    });
    assert.equal(result.admitted, true, `${type}: the subject must enter the pool before its exemption can be measured`);
    assert.equal(result.poolSize, POOL_CAPACITY, `${type}: the pool must stay capped at ${POOL_CAPACITY}`);
    observed[type] = result.survived;
  }
  assert.deepEqual(
    observed,
    Object.fromEntries(PRE_CYCLE10_VFX_EVENT_TYPES.map((type) => [type, PRE_CYCLE10_CRITICAL_TYPES.includes(type)])),
    "every pre-existing event id must keep exactly its old CRITICAL_VFX_EVENT_TYPES eviction behaviour",
  );
  assert.equal(
    Object.values(observed).filter(Boolean).length,
    PRE_CYCLE10_CRITICAL_TYPES.length,
    "the exempt set must stay at its measured size -- a wider set starves the 24-slot pool",
  );
});

test("drop beacons are pool-free scenery, bounded, retired with their pickup, and swept by reduced motion and dispose", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = dropBeaconHarness(RealtimeBattle);
  const rarities = ["common", "rare", "resonant", "relic"];
  // More drops than the bound, so the cap is exercised rather than merely satisfied.
  const drops = Array.from({ length: DROP_BEACON_CAP + 4 }, (_unused, index) => ({
    id: `drop-${String(index).padStart(2, "0")}`,
    kind: "buff",
    itemId: "ember-draught",
    rarity: rarities[index % rarities.length],
    x: 4000 + index * 500,
    y: 3000 + index * 200,
    elevation: 0,
    expiresAtTick: 100000,
    hp: 1,
    maxHp: 1,
  }));
  // Echo and item pickups predate the beacon surface and must stay unmarked.
  const legacyPickups = [
    { id: "legacy-item", kind: "item", itemId: "ward-splinter", x: 8400, y: 4100, elevation: 0, hp: 1, maxHp: 1 },
    { id: "legacy-echo", kind: "echo", xp: 9, x: 15200, y: 7600, elevation: 0, hp: 1, maxHp: 1 },
  ];
  const snapshotWith = (pickups, tick) => ({ tick, ...cycle10Snapshot({ pickups }) });
  const allPickups = [...drops, ...legacyPickups];
  const before = structuredClone(allPickups);

  try {
    // Kind filter FIRST, deliberately under cap headroom. Asserted after saturation it is
    // vacuous: the bound would reject a legacy pickup anyway, so the assertion would pass
    // against an implementation that had lost the `kind === "buff"` filter entirely.
    const headroom = [drops[0], drops[1], ...legacyPickups];
    adapter.reconcileActors(snapshotWith(headroom, 400));
    const headroomState = adapter.debugPresentationState();
    assert.ok(
      headroomState.dropBeaconCount < DROP_BEACON_CAP,
      "the kind-filter fixture must leave spare beacon slots or the assertion below proves nothing",
    );
    assert.deepEqual(
      headroomState.dropBeacons.map(({ id }) => id),
      [drops[0].id, drops[1].id].sort(),
      "only buff field drops may be marked -- echo and item pickups predate this surface and stay unmarked",
    );
    for (const pickup of legacyPickups) {
      assert.equal(beaconGroupFor(adapter, pickup.id), null, `a ${pickup.kind} pickup must not receive a drop beacon`);
    }

    adapter.reconcileActors(snapshotWith(allPickups, 500));

    const state = adapter.debugPresentationState();
    assert.equal(state.dropBeaconCount, DROP_BEACON_CAP, `the beacon population must be bounded at ${DROP_BEACON_CAP}, not grow with the drop count`);
    assert.equal(adapter.dropDecalGroup.children.length, DROP_BEACON_CAP, "the scene graph must carry exactly the bounded beacon population");
    assert.deepEqual(
      state.dropBeacons.map(({ id }) => id),
      drops.slice(0, DROP_BEACON_CAP).map(({ id }) => id).sort(),
      "the bound must admit drops in snapshot order, not silently reshuffle them",
    );
    assert.deepEqual(
      state.dropBeacons.map(({ rarity }) => rarity),
      drops.slice(0, DROP_BEACON_CAP)
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(({ rarity }) => rarity),
      "each beacon must carry its own drop's rarity classifier",
    );

    // The load-bearing claim: this whole surface costs nothing from the transient budget.
    assert.equal(state.activeVfxCount, 0, "beacons must consume zero transient VFX pool slots");
    assert.equal(adapter.vfxInstances.length, 0, "no beacon may be pushed into the transient pool");
    assert.equal(adapter.pendingVfxLoads.size, 0, "no beacon may open a transient VFX model load");

    const marked = drops[0];
    const markedGroup = beaconGroupFor(adapter, marked.id);
    assert.ok(markedGroup, "a bounded-in drop must be attached to the drop decal group");
    assertNear(markedGroup.position.x, worldX(marked.x), "a beacon must sit at its own drop's x");
    assertNear(markedGroup.position.z, worldZ(marked.y), "a beacon must sit at its own drop's z");
    assert.ok(
      markedGroup.position.y > 0 && markedGroup.position.y < 0.1,
      `a beacon must be lifted clear of the floor without floating: got ${markedGroup.position.y}`,
    );

    // Pre-expiry read, derived from the snapshot rather than from an event. The threshold
    // is a cross-lane constant -- HUD, audio and VFX must warn on the same tick -- so the
    // boundary is asserted on both sides.
    const idleTickOpacity = beaconPartOpacity(markedGroup, "RingGeometry");
    const justOutside = snapshotWith(
      allPickups.map((pickup) => (pickup.id === marked.id
        ? { ...pickup, expiresAtTick: 600 + DROP_BEACON_WARN_TICKS + 1 }
        : pickup)),
      600,
    );
    adapter.reconcileActors(justOutside);
    assert.equal(
      adapter.debugPresentationState().dropBeacons.find(({ id }) => id === marked.id).warning,
      false,
      `a drop ${DROP_BEACON_WARN_TICKS + 1} ticks from expiry must not warn yet`,
    );
    const justInside = snapshotWith(
      allPickups.map((pickup) => (pickup.id === marked.id
        ? { ...pickup, expiresAtTick: 600 + DROP_BEACON_WARN_TICKS }
        : pickup)),
      600,
    );
    adapter.reconcileActors(justInside);
    assert.equal(
      adapter.debugPresentationState().dropBeacons.find(({ id }) => id === marked.id).warning,
      true,
      `a drop exactly ${DROP_BEACON_WARN_TICKS} ticks from expiry must warn on that tick`,
    );
    assert.ok(
      beaconPartOpacity(markedGroup, "RingGeometry") < idleTickOpacity,
      "the warning read must dim the ground tick rather than leave it at its idle value",
    );

    // Retirement is snapshot-derived, so collection and expiry are the same code path: the
    // beacon leaves the tick its id leaves snapshot.pickups, whatever the reason.
    const collected = drops[3];
    const collectedGroup = beaconGroupFor(adapter, collected.id);
    const survivors = allPickups.filter(({ id }) => id !== collected.id);
    adapter.reconcileActors(snapshotWith(survivors, 700));
    assert.equal(beaconGroupFor(adapter, collected.id), null, "a beacon must be retired the tick its drop leaves the snapshot");
    assert.equal(collectedGroup.parent, null, "a retired beacon must be detached from the drop decal group, not merely forgotten");
    assert.equal(adapter.debugPresentationState().dropBeaconCount, DROP_BEACON_CAP - 1, "retirement must free a slot rather than leave a hole");

    // A freed slot must be reusable: a high-water-mark bound would leave the population
    // one short forever, and a leaked entry would keep the retired id occupying it.
    adapter.reconcileActors(snapshotWith(survivors, 800));
    const refilled = adapter.debugPresentationState();
    assert.equal(refilled.dropBeaconCount, DROP_BEACON_CAP, "a freed slot must be reclaimed by a previously bounded-out drop");
    assert.equal(
      refilled.dropBeacons.some(({ id }) => id === collected.id),
      false,
      "the reclaimed slot must not resurrect the retired drop",
    );

    // Reduced motion degrades the beacon to a static marker and never hides it: it is the
    // only way to find a drop at max zoom.
    adapter.setReducedMotion(true);
    const staticGroup = beaconGroupFor(adapter, drops[1].id);
    assert.equal(staticGroup.visible, true, "reduced motion must never hide a beacon -- it is the only way to find a drop");
    assert.equal(beaconPartOpacity(staticGroup, "CylinderGeometry"), 1, "reduced motion must hold the shaft at full opacity");
    adapter.updateDropBeacons(1234);
    assert.equal(beaconPartOpacity(staticGroup, "CylinderGeometry"), 1, "reduced-motion travel must stay stopped across animation ticks");

    adapter.setReducedMotion(false);
    adapter.updateDropBeacons(1234);
    assert.ok(
      beaconPartOpacity(staticGroup, "CylinderGeometry") < 1,
      "clearing reduced motion must let the shaft resume its opacity travel",
    );

    assert.deepEqual(allPickups, before, "beacon presentation must not mutate the authoritative snapshot pickups");

    // Every beacon owns its geometry and materials, so unmount must drain the map before
    // the group reference is dropped.
    const livingGroups = adapter.dropDecalGroup.children.slice();
    assert.equal(livingGroups.length, DROP_BEACON_CAP, "the dispose fixture must start with a populated decal group");
    adapter.dispose();
    assert.equal(adapter.dropBeacons.size, 0, "dispose must drain the beacon map");
    assert.equal(adapter.dropDecalGroup, null, "dispose must release the decal group reference");
    assert.equal(
      livingGroups.every((group) => group.parent === null),
      true,
      "dispose must detach every beacon from the scene graph",
    );
  } finally {
    if (!adapter.disposed) adapter.dispose();
  }
});

test("pickup model selection preserves the legacy kind mapping and honours an authored modelKey", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const BLADE = "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb";
  const RELIC = "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb";
  // The expression this replaced, restated as an oracle. Every keyless row below is
  // checked against it rather than against a transcribed table, so "byte-identical to the
  // old behaviour" is asserted differentially instead of by hand.
  const legacyModelPath = (kind) => (kind === "item" ? BLADE : RELIC);

  const keyless = [
    { id: "keyless-item", kind: "item" },
    { id: "keyless-echo", kind: "echo" },
    { id: "keyless-buff", kind: "buff" },
    { id: "keyless-unknown", kind: "shard" },
    { id: "keyless-absent" },
  ];
  const keyed = [
    { id: "keyed-blade-on-buff", kind: "buff", modelKey: "blade", expected: BLADE },
    { id: "keyed-relic-on-buff", kind: "buff", modelKey: "relic", expected: RELIC },
    // An authored key must override the kind inference in both directions, otherwise the
    // simulation's catalog choice is silently discarded for one of the two kinds.
    { id: "keyed-relic-on-item", kind: "item", modelKey: "relic", expected: RELIC },
    { id: "keyed-blade-on-echo", kind: "echo", modelKey: "blade", expected: BLADE },
    // An unrecognised key must degrade to the legacy kind rule, not to a broken path.
    { id: "unkeyed-item", kind: "item", modelKey: "sunburst", expected: BLADE },
    { id: "unkeyed-echo", kind: "echo", modelKey: "sunburst", expected: RELIC },
  ];
  const pickups = [
    ...keyless.map(({ id, kind }) => ({ id, ...(kind ? { kind } : {}), x: 9000, y: 5000, elevation: 0, hp: 1, maxHp: 1 })),
    ...keyed.map(({ id, kind, modelKey }) => ({ id, kind, modelKey, x: 9000, y: 5000, elevation: 0, hp: 1, maxHp: 1 })),
  ];

  try {
    adapter.reconcileActors({ tick: 1, ...cycle10Snapshot({ pickups }) });
    await waitFor(
      () => pickups.every(({ id }) => adapter.actors.get(id)?.loading === false),
      "pickup model requests did not settle",
    );

    const observed = Object.fromEntries(
      pickups.map(({ id }) => [id, adapter.debugPresentationState(id).modelPath]),
    );
    assert.deepEqual(
      Object.fromEntries(keyless.map(({ id, kind }) => [id, observed[id]])),
      Object.fromEntries(keyless.map(({ id, kind }) => [id, legacyModelPath(kind)])),
      "a pickup with no modelKey must resolve exactly as the pre-cycle-10 kind expression did",
    );
    assert.deepEqual(
      Object.fromEntries(keyed.map(({ id }) => [id, observed[id]])),
      Object.fromEntries(keyed.map(({ id, expected }) => [id, expected])),
      "an authored modelKey must select its own mesh and degrade to the kind rule when unrecognised",
    );
  } finally {
    adapter.dispose();
  }
});
