import assert from "node:assert/strict";
import { after, test } from "node:test";

import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { stageWorldFor, STAGE_WORLD_PROFILES } from "../stage-world-catalog.js";

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
  const head = new THREE.Bone();
  head.name = "DEF-head";
  spine.add(head);
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

test("stage-world catalog props and lookout NPCs load at authored presentation placements", async () => {
  const { RealtimeBattle } = await rendererModule;
  const adapter = realtimeBattleHarness(RealtimeBattle);
  const profile = stageWorldFor("cinder-span");
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
  const { meshRootForStageBoss } = await rendererModule;
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
      ...profile.presentation.npcs.map(({ modelPath }) => modelPath),
      ...profile.presentation.vfxCues.map(({ modelPath }) => modelPath),
    ].map((modelPath) => `./${modelPath}`),
    // Stage load warms the boss rig so it does not pop in mid-fight.
    bossRequestPath,
  ].filter((requestUrl) => !alreadyCached.has(requestUrl)).sort();
  assert.deepEqual(
    gltfRequests.slice(requestStart).sort(),
    [...new Set(expectedRequests)].sort(),
    "renderer requests each unique catalog prop, NPC, VFX, and boss model exactly once",
  );
  assert.ok(
    gltfRequests.slice(requestStart).includes(bossRequestPath),
    "stage load must warm the authored boss rig before the boss spawns",
  );
  assert.equal(decor.stageId, profile.stageId);
  assert.equal(decor.terrainLoaded, true);
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
    assert.equal(record.modelPath, authored.modelPath);
    assert.equal(record.role, authored.role);
    assert.deepEqual(record.source, authored.placement);
    assertNear(record.position.x, worldX(authored.placement.x), `${authored.id} authored x placement`);
    assertNear(record.position.z, worldZ(authored.placement.y), `${authored.id} authored y placement`);
    assertNear(record.position.y, authored.placement.elevation * 14 / 12000, `${authored.id} authored elevation`);
    if (authored.role !== "lookout") {
      assertNear(record.yaw, authored.placement.yawRadians, `${authored.id} authored yaw`);
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

test("only an event tick-zero stage start confirms a retry without replaying carried VFX", async () => {
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
  assert.equal(
    adapter.vfxInstances.length,
    1,
    "the confirming batch does not replay an unrelated VFX event from the prior run",
  );

  adapter.renderSnapshot(newRunRally);
  assert.equal(adapter.vfxInstances.length, 2, "visual de-dupe resets after the confirming batch for new-run events");
  adapter.renderSnapshot(newRunRally);
  assert.equal(adapter.vfxInstances.length, 2, "duplicate new-run VFX remains suppressed after the reset");
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

test("failed stage decor loads retry on a later visit while successful GLBs remain cached", async () => {
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
  const cachedTerrainUrl = `./${profile.terrainGlbPath}`;
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
      requests.filter((url) => url === cachedTerrainUrl).length,
      1,
      "the successfully loaded terrain URL stays cached across the revisit",
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
