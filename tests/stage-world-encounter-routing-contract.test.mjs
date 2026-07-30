import assert from "node:assert/strict";
import { accessSync, constants } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OCTANT_VECTORS,
  STAGE_BY_ID,
  STAGE_ENCOUNTER_ROUTES,
  STAGE_REWARD_IDS,
  STAGES,
} from "../defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";
import {
  STAGE_SHOWCASE_IDS,
  STAGE_WORLD_PROFILES,
  stageWorldFor,
} from "../stage-world-catalog.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAGE_IDS = ["cinder-span", "abyss-chancel", "echo-throne"];
const FULL_LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const SUPPORT_REWARDS = ["abyssal-banner", "bulwark-brand", "stillwater-hourglass"];

function squaredDistance(left, right) {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function segmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx ** 2 + dy ** 2;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

function assertPointInsideBounds(point, bounds, clearance, label) {
  assert.ok(point.x - clearance >= bounds.minX, `${label} must clear minX`);
  assert.ok(point.x + clearance <= bounds.maxX, `${label} must clear maxX`);
  assert.ok(point.y - clearance >= bounds.minY, `${label} must clear minY`);
  assert.ok(point.y + clearance <= bounds.maxY, `${label} must clear maxY`);
  assert.equal(point.elevation, 0, `${label} must remain on the flat authored route plane`);
}

function assertRouteClear(profile, route) {
  const halfWidth = route.corridorWidth / 2;
  assert.ok(Number.isFinite(halfWidth) && halfWidth > 0, `${route.id} must publish a positive corridor width`);
  for (const waypoint of route.waypoints) {
    assertPointInsideBounds(waypoint.placement, profile.gameplay.bounds, halfWidth, waypoint.id);
  }
  for (let index = 1; index < route.waypoints.length; index += 1) {
    const start = route.waypoints[index - 1].placement;
    const end = route.waypoints[index].placement;
    for (const obstacle of profile.gameplay.obstacles) {
      const clearance = obstacle.footprint.radius + halfWidth;
      assert.ok(
        segmentDistance(obstacle.footprint, start, end) >= clearance,
        `${profile.stageId} ${route.id} segment ${index - 1}-${index} must clear ${obstacle.id}`,
      );
    }
  }
}

function profileAssetPaths(profile) {
  return [
    profile.terrainGlbPath ?? profile.terrainSourceCandidatePath,
    ...profile.presentation.props.map(({ modelPath }) => modelPath),
    ...(profile.presentation.vfxCues ?? []).map(({ modelPath }) => modelPath),
    ...profile.presentation.npcs.map(({ modelPath }) => modelPath),
  ];
}

function assertEncounterCatalog(stageId) {
  const stage = STAGE_BY_ID[stageId];
  const route = STAGE_ENCOUNTER_ROUTES[stageId];
  assert.ok(route, `${stageId} must publish an encounter route`);
  assert.equal(stage.encounterRoute, route, `${stageId} must reference its canonical encounter route`);
  assert.ok(route.id.includes(stageId), `${route.id} must identify ${stageId}`);
  assert.ok(Number.isInteger(route.commitmentCap) && route.commitmentCap > 0);
  assert.ok(Number.isInteger(route.maxConcurrentEnemies) && route.maxConcurrentEnemies >= route.commitmentCap);
  assert.ok(Number.isInteger(route.spawnIntervalTicks) && route.spawnIntervalTicks > 0);
  assert.ok(route.objectives.length >= 2, `${stageId} needs routed objective progression`);

  const objectiveIds = new Set();
  const authoredSlots = [];
  for (const objective of route.objectives) {
    assert.ok(objective.id.length > 0, `${stageId} objective ids must be non-empty`);
    assert.equal(objectiveIds.has(objective.id), false, `${objective.id} must be unique`);
    objectiveIds.add(objective.id);
    assert.ok(["corridor", "arena"].includes(objective.kind));
    assert.ok(Number.isFinite(objective.point?.x) && Number.isFinite(objective.point?.y));
    assert.ok(objective.waveSlots.length > 0, `${objective.id} must own at least one wave`);
    assert.ok(Number.isInteger(objective.retry?.commanderFloorBp) && objective.retry.commanderFloorBp > 0);
    assert.ok(Number.isInteger(objective.retry?.gateFloorBp) && objective.retry.gateFloorBp > 0);
    assert.ok(Number.isInteger(objective.retry?.recoveryTicks) && objective.retry.recoveryTicks > 0);
    assert.ok(Number.isInteger(objective.retry?.maxAttempts) && objective.retry.maxAttempts >= 1);
    assert.ok(Number.isInteger(objective.recovery?.commanderBp) && objective.recovery.commanderBp >= 0);
    assert.ok(Number.isInteger(objective.recovery?.gateBp) && objective.recovery.gateBp >= 0);
    authoredSlots.push(...objective.waveSlots);
  }

  const expectedSlots = stage.wavePlan.map(({ slot }) => slot);
  assert.deepEqual(authoredSlots.slice().sort((left, right) => left - right), expectedSlots);
  assert.equal(new Set(authoredSlots).size, authoredSlots.length, `${stageId} wave slots must not overlap objectives`);
  for (const wave of stage.wavePlan) {
    assert.ok(objectiveIds.has(wave.objectiveId), `${stageId} wave ${wave.slot} must reference an authored objective`);
    assert.ok(route.objectives.find(({ id }) => id === wave.objectiveId).waveSlots.includes(wave.slot));
  }
  return route;
}

function objectiveOctant(snapshot) {
  let target = null;
  if (snapshot.objectives.phase === "occupation") target = snapshot.tactics.occupation;
  else if (snapshot.objectives.phase === "extraction") target = snapshot.tactics.extraction;
  else {
    const living = snapshot.enemies.filter(({ hp }) => hp > 0);
    if (living.length) {
      target = living.slice().sort((left, right) =>
        squaredDistance(left, snapshot.commander) - squaredDistance(right, snapshot.commander))[0];
    }
  }
  if (!target) return "IDLE";
  const dx = target.x - snapshot.commander.x;
  const dy = target.y - snapshot.commander.y;
  if (target.radius && Math.hypot(dx, dy) < target.radius * 0.5) return "IDLE";
  const length = Math.hypot(dx, dy) || 1;
  let best = "IDLE";
  let bestDot = -Infinity;
  for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
    if (name === "IDLE") continue;
    const vectorLength = Math.hypot(vector.x, vector.y) || 1;
    const dot = (dx / length) * (vector.x / vectorLength)
      + (dy / length) * (vector.y / vectorLength);
    if (dot > bestDot) {
      best = name;
      bestDot = dot;
    }
  }
  return best;
}

function queueProgressInputs(run) {
  const snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    return queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
  }
  let next = queueInput(run, "MOVE", { octant: objectiveOctant(snapshot) });
  for (const skillId of snapshot.commander.skills) {
    next = queueInput(next, "SKILL_CAST", { skillId });
  }
  if (snapshot.eliteCandidate && !snapshot.extracted) {
    next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
  }
  return next;
}

function advanceResolvingGrowth(run, steps, events = []) {
  let next = run;
  for (let step = 0; step < steps && !isTerminalRun(next); step += 1) {
    const before = getRunSnapshot(next);
    if (before.growthOffer) {
      next = queueInput(next, "SKILL_SELECTED", { skillId: before.growthOffer.choices[0] });
    }
    next = advanceDefenseRun(next, 1);
    events.push(...getRunSnapshot(next).events);
  }
  return next;
}

function retryTrace(stageId) {
  const route = STAGE_ENCOUNTER_ROUTES[stageId];
  const initial = createDefenseRun({ stageId, seed: 41 });
  const before = getRunSnapshot(initial);
  assert.equal(before.encounter.status, "ACTIVE");
  assert.equal(before.encounter.attempt, 1);
  assert.equal(before.encounter.retries, 0);

  const abandoned = advanceDefenseRun(
    queueInput(
      queueInput(initial, "RETRY_OBJECTIVE", { objectiveId: before.encounter.objectiveId }),
      "RETRY_OBJECTIVE",
      { objectiveId: before.encounter.objectiveId },
    ),
    1,
  );
  const failed = getRunSnapshot(abandoned);
  const trace = [...failed.events];
  assert.equal(failed.encounter.status, "RECOVERY");
  assert.equal(failed.encounter.attempt, 1);
  assert.equal(failed.encounter.retries, 0);
  assert.deepEqual(failed.encounter.rewardKeys, before.encounter.rewardKeys);
  assert.equal(trace.filter(({ type }) => type === "ENCOUNTER_OBJECTIVE_FAILED").length, 1);
  assert.equal(trace.filter(({ type }) => type === "ENCOUNTER_RECOVERY_STARTED").length, 1);
  assert.equal(trace.filter(({ type, inputType }) => type === "INPUT_REJECTED" && inputType === "RETRY_OBJECTIVE").length, 1);

  const recoveryTicks = route.objectives[0].retry.recoveryTicks;
  let recovered = abandoned;
  for (let step = 0; step <= recoveryTicks + 1; step += 1) {
    if (getRunSnapshot(recovered).encounter.status === "ACTIVE") break;
    recovered = advanceResolvingGrowth(recovered, 1, trace);
  }
  const after = getRunSnapshot(recovered);
  assert.equal(after.encounter.status, "ACTIVE");
  assert.equal(after.encounter.objectiveId, before.encounter.objectiveId);
  assert.equal(after.encounter.attempt, 2);
  assert.equal(after.encounter.retries, 1);
  assert.deepEqual(after.encounter.rewardKeys, before.encounter.rewardKeys);
  assert.equal(trace.filter(({ type }) => type === "ENCOUNTER_RETRY_STARTED").length, 1);
  assert.equal(new Set(after.encounter.rewardKeys).size, after.encounter.rewardKeys.length);
  return {
    digest: getRunDigest(recovered),
    encounter: after.encounter,
    trace: trace.map(({ eventId, type, objectiveId, reason, inputType }) => ({ eventId, type, objectiveId, reason, inputType })),
  };
}

test("three canonical stage profiles publish distinct, loadable routed worlds", () => {
  assert.deepEqual(STAGE_SHOWCASE_IDS, STAGE_IDS);
  assert.deepEqual(STAGES.map(({ id }) => id), STAGE_IDS);
  assert.deepEqual(Object.keys(STAGE_WORLD_PROFILES), STAGE_IDS);

  const signatures = [];
  for (const stageId of STAGE_IDS) {
    const profile = STAGE_WORLD_PROFILES[stageId];
    assert.equal(stageWorldFor(stageId), profile);
    assert.equal(profile.stageId, stageId);
    assert.equal(profile.sequence, STAGE_IDS.indexOf(stageId) + 1);
    assert.equal(Object.isFrozen(profile), true);

    // Cycle 10 supersession: promoted composed slab floor replaces procedural support.
    assert.equal(profile.terrainRuntimeEligible, true, `${stageId} composed slab floor is gameplay-eligible`);
    assert.match(profile.terrainGlbPath, /\/runtime\/.*-floor\.glb$/u, `${stageId} runtime terrain must be a promoted floor under runtime/`);
    assert.equal(profile.terrainFallback, undefined, `${stageId} an eligible floor must not also carry a procedural fallback`);
    assert.match(profile.terrainSourceCandidatePath, /^assets\/mesh\/terrain\/.*\.glb$/u, `${stageId} must retain its source mesh for offline checks`);
    if (stageId !== "cinder-span") {
      assert.match(profile.terrainSourceCandidatePath, /\/textured-candidate\//u, `${stageId} must retain the rejected textured candidate`);
    }
    const paths = [...new Set(profileAssetPaths(profile))];
    assert.ok(paths.length >= 4, `${stageId} must route terrain and authored presentation assets`);
    for (const path of paths) {
      assert.match(path, /^assets\//u);
      assert.doesNotThrow(
        () => accessSync(resolve(ROOT, path), constants.R_OK),
        `${stageId} asset must exist and be readable: ${path}`,
      );
    }

    const critical = profile.gameplay.routes.filter(({ kind }) => kind === "critical");
    const detours = profile.gameplay.routes.filter(({ kind }) => kind === "optional-detour");
    assert.equal(critical.length, 1, `${stageId} must have one critical route`);
    assert.equal(detours.length, 1, `${stageId} must have one optional detour`);
    assert.deepEqual(critical[0].waypoints.map(({ role }) => role), [
      "ingress",
      "intermediate-objective",
      "intermediate-gate",
      "final-gate",
    ]);
    assert.equal(critical[0].waypoints.filter(({ role }) => role.startsWith("intermediate-")).length >= 2, true);
    assert.deepEqual(detours[0].waypoints.map(({ role }) => role), ["detour-entry", "detour-objective", "detour-exit"]);
    assertRouteClear(profile, critical[0]);
    assertRouteClear(profile, detours[0]);

    signatures.push(JSON.stringify({
      terrainGlbPath: profile.terrainGlbPath,
      terrainSourceCandidatePath: profile.terrainSourceCandidatePath,
      terrainRuntimeEligible: profile.terrainRuntimeEligible,
      bounds: profile.gameplay.bounds,
      obstacles: profile.gameplay.obstacles,
      routes: profile.gameplay.routes,
      palette: profile.presentation.palette,
    }));
  }
  assert.equal(new Set(signatures).size, STAGE_IDS.length, "stage profiles must not collapse to one layout");
  assert.equal(stageWorldFor("missing-stage"), null);
});

test("critical-route clearance rejects a blocked route independently for every stage", async (t) => {
  for (const stageId of STAGE_IDS) {
    await t.test(stageId, () => {
      const profile = structuredClone(stageWorldFor(stageId));
      const critical = profile.gameplay.routes.find(({ kind }) => kind === "critical");
      const obstacle = profile.gameplay.obstacles[0];
      critical.waypoints[1].placement.x = obstacle.footprint.x;
      critical.waypoints[1].placement.y = obstacle.footprint.y;
      assert.throws(() => assertRouteClear(profile, critical), /must clear/u);
    });
  }
});

test("all stages publish stage-specific wave and objective routes through catalog and snapshots", () => {
  const routeSignatures = [];
  for (const stageId of STAGE_IDS) {
    const route = assertEncounterCatalog(stageId);
    const snapshot = getRunSnapshot(createDefenseRun({ stageId, seed: 41 }));
    assert.equal(snapshot.encounter.version, 1);
    assert.equal(snapshot.encounter.routeId, route.id);
    assert.equal(snapshot.encounter.status, "ACTIVE");
    assert.equal(snapshot.encounter.objectiveIndex, 0);
    assert.equal(snapshot.encounter.objectiveId, route.objectives[0].id);
    assert.equal(snapshot.encounter.attempt, 1);
    assert.equal(snapshot.encounter.retries, 0);
    assert.equal(snapshot.encounter.recoveryUntil, null);
    assert.equal(snapshot.encounter.commitmentCap, route.commitmentCap);
    assert.equal(snapshot.encounter.maxConcurrentEnemies, route.maxConcurrentEnemies);
    assert.deepEqual(snapshot.encounter.committedAttackerIds, []);
    assert.equal(snapshot.encounter.committedAttackerCount, 0);
    assert.deepEqual(snapshot.encounter.rewardKeys, []);
    assert.equal(snapshot.encounter.pendingSpawnCount, 0);
    assert.deepEqual(
      Object.values(snapshot.encounter.objectives).map(({ id, kind, completed, attempts, retries }) =>
        ({ id, kind, completed, attempts, retries })),
      route.objectives.map(({ id, kind }) => ({ id, kind, completed: false, attempts: 1, retries: 0 })),
    );
    routeSignatures.push(JSON.stringify(route));
  }
  assert.equal(new Set(routeSignatures).size, STAGE_IDS.length, "encounter routes must be authored per stage");
});

test("committed attackers never exceed the authored cap on any stage", () => {
  for (const stageId of STAGE_IDS) {
    const route = STAGE_ENCOUNTER_ROUTES[stageId];
    let run = createDefenseRun({ stageId, seed: 73, rewardIds: ["bulwark-brand"] });
    let maxObserved = 0;
    for (let elapsed = 0; elapsed < 5200 && !isTerminalRun(run); elapsed += 12) {
      const before = getRunSnapshot(run);
      if (before.growthOffer) {
        run = queueInput(run, "SKILL_SELECTED", { skillId: before.growthOffer.choices[0] });
      }
      run = advanceDefenseRun(run, 12);
      const snapshot = getRunSnapshot(run);
      const { committedAttackerCount, committedAttackerIds } = snapshot.encounter;
      maxObserved = Math.max(maxObserved, committedAttackerCount);
      assert.equal(committedAttackerCount, committedAttackerIds.length);
      assert.equal(new Set(committedAttackerIds).size, committedAttackerIds.length);
      assert.ok(committedAttackerCount <= route.commitmentCap, `${stageId} exceeded its commitment cap`);
      const routedEnemies = snapshot.enemies.filter(({ elite, class: enemyClass }) => !elite && enemyClass !== "boss");
      assert.ok(routedEnemies.length <= route.maxConcurrentEnemies, `${stageId} exceeded its concurrent-enemy cap`);
    }
    assert.equal(maxObserved, route.commitmentCap, `${stageId} must exercise its commitment-cap boundary`);
  }
});

test("objective failure and retry are idempotent for every stage", async (t) => {
  for (const stageId of STAGE_IDS) {
    await t.test(stageId, () => {
      const first = retryTrace(stageId);
      const replay = retryTrace(stageId);
      assert.deepEqual(replay, first, `${stageId} retry trace must replay byte-for-byte`);
    });
  }
});

test("stage-specific encounter progression grants each reward once and preserves legacy extraction state", () => {
  for (const stageId of STAGE_IDS) {
    const route = STAGE_ENCOUNTER_ROUTES[stageId];
    const ownedRewardIds = [...new Set([...SUPPORT_REWARDS, ...STAGE_REWARD_IDS[stageId]])];
    let run = createDefenseRun({
      stageId,
      seed: 12,
      companionLoadout: FULL_LOADOUT,
      rewardIds: ownedRewardIds,
    });
    const maxTick = STAGE_BY_ID[stageId].gateTicks + 9000;
    while (getRunSnapshot(run).tick < maxTick && !isTerminalRun(run)) {
      run = advanceDefenseRun(queueProgressInputs(run), 12);
    }
    const terminal = getRunSnapshot(run);
    assert.ok(["VICTORY", "FINAL_COMPLETION"].includes(terminal.terminal), `${stageId} must finish its routed stage`);
    assert.equal(terminal.encounter.status, "COMPLETE");
    assert.equal(terminal.objectives.route.completed, true);
    assert.equal(terminal.objectives.route.phase, "complete");
    assert.deepEqual(terminal.objectives.route.order, route.objectives.map(({ id }) => id));
    assert.deepEqual(
      Object.values(terminal.encounter.objectives).map(({ id, completed }) => ({ id, completed })),
      route.objectives.map(({ id }) => ({ id, completed: true })),
    );
    const expectedRewardKeys = route.objectives.flatMap(({ id, waveSlots }) => [
      ...waveSlots.map((slot) => `wave:${slot}`),
      `objective:${id}`,
    ]);
    assert.deepEqual(terminal.encounter.rewardKeys, expectedRewardKeys);
    assert.equal(new Set(terminal.encounter.rewardKeys).size, terminal.encounter.rewardKeys.length);
    assert.equal(terminal.objectives.gateDefense.completed, true);
    assert.equal(terminal.objectives.echoRecovery.completed, true);
    assert.equal(terminal.objectives.growth.completed, true);
    assert.equal(terminal.objectives.occupation.completed, true);
    assert.equal(terminal.objectives.extraction.completed, true);
    assert.equal(terminal.objectives.bossKill.completed, true);
    assert.equal(terminal.extracted, true, `${stageId} must preserve explicit extraction`);
    assert.equal(terminal.bossSpawned, true, `${stageId} boss remains after extraction`);

    assert.ok(terminal.rewardOffer, `${stageId} must retain its all-owned terminal reward offer`);
    const rewardId = terminal.rewardOffer.choices[0];
    assert.ok(terminal.rewardIds.includes(rewardId), "fixture must select an already-owned authored reward");
    const selected = getRunSnapshot(advanceDefenseRun(
      queueInput(run, "REWARD_SELECTED", { rewardId }),
      1,
    ));
    assert.deepEqual(selected.rewardIds, terminal.rewardIds);
    assert.equal(selected.events.filter(({ type }) => type === "REWARD_SELECTED").length, 0);
    assert.equal(selected.events.filter(({ type }) => type === "REWARD_SELECTION_DUPLICATE_IGNORED").length, 1);
  }
});
