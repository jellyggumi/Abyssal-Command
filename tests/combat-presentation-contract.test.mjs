import assert from "node:assert/strict";
import { after, test } from "node:test";

import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { stageWorldFor } from "../stage-world-catalog.js";

const COMBAT_CLIP_KEYS = ["idle", "move", "run", "attack", "hit", "die", "show"];

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
    onLoad(syntheticRig());
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
  let state = adapter.debugPresentationState();
  const decor = state.stageDecor;
  const expectedRequests = [
    profile.terrainGlbPath,
    ...profile.presentation.props.map(({ modelPath }) => modelPath),
    ...profile.presentation.npcs.map(({ modelPath }) => modelPath),
  ].map((modelPath) => `./${modelPath}`).sort();
  assert.deepEqual(
    [...new Set(gltfRequests.slice(requestStart))].sort(),
    expectedRequests,
    "renderer requests the catalog terrain, prop, and NPC models without substituting generic assets",
  );
  assert.equal(decor.stageId, profile.stageId);
  assert.equal(decor.terrainLoaded, true);
  assert.equal(decor.propCount, profile.presentation.props.length);
  assert.equal(decor.npcCount, profile.presentation.npcs.length);
  assert.equal(state.actorCount, 0, "decorative lookouts never enter the simulation actor map");

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
  const failedProp = profile.presentation.props[0];
  const failedUrl = `./${failedProp.modelPath}`;
  const cachedTerrainUrl = `./${profile.terrainGlbPath}`;
  const expectedDecorCount = profile.presentation.props.length + profile.presentation.npcs.length;
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
      "the first stage visit did not settle with only the failed prop absent",
    );
    assert.equal(
      adapter.debugPresentationState().stageDecor.records.some(({ id }) => id === failedProp.id),
      false,
      "a rejected prop is absent from only the failed visit",
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
          && decor.records.some(({ id }) => id === failedProp.id);
      },
      "the failed prop was not retried on the later stage visit",
    );

    const requests = gltfRequests.slice(requestStart);
    assert.equal(
      requests.filter((url) => url === failedUrl).length,
      2,
      "the rejected prop URL is evicted and requested again",
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
  const secondProfile = stageWorldFor("veil-citadel");

  adapter.ensureStageTerrain(firstProfile.stageId);
  await waitFor(
    () => adapter.debugPresentationState().stageDecor.loading === false,
    "first stage dressing did not finish loading",
  );
  const first = adapter.debugPresentationState().stageDecor;
  const firstIds = new Set(first.records.map(({ id }) => id));
  assert.equal(first.mixerCount, firstProfile.presentation.npcs.length);
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
  assert.equal(second.mixerCount, secondProfile.presentation.npcs.length);
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
