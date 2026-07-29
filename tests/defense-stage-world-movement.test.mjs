import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  queueInput,
} from "../defense-run-simulation.js";
import { COMPANION_AUTONOMY, OCTANT_VECTORS, STAGES, TICK_RATE } from "../defense-catalog.js";
import { stageWorldFor } from "../stage-world-catalog.js";
import { STANCE_CONFIG } from "../rpg-catalog.js";

const STAGE_ID = "cinder-span";
const WORLD = stageWorldFor(STAGE_ID);
const OBSTACLE = WORLD.gameplay.obstacles.find(({ id }) => id === "cinder-span:west-ash-wall");

function isolatedRun(options = {}) {
  const run = structuredClone(createDefenseRun({ stageId: STAGE_ID, seed: 37, ...options }));
  run.waveSchedule = [];
  run.waveIndex = 0;
  run.enemies = [];
  run.projectiles = [];
  run.pickups = [];
  return run;
}

function step(run, octant, ticks = 1) {
  return advanceDefenseRun(queueInput(run, "MOVE", { octant }), ticks);
}

function placeCommander(run, x, y) {
  run.commander.x = x;
  run.commander.y = y;
  run.commander.elevation = 0;
  run.commander.move = "IDLE";
  run.commander.objectiveRoute = false;
  return run;
}

function assertWalkable(actor, profile = WORLD) {
  const { minX, maxX, minY, maxY } = profile.gameplay.bounds;
  assert.ok(actor.x - actor.radius >= minX, `${actor.id} footprint must stay inside minX`);
  assert.ok(actor.x + actor.radius <= maxX, `${actor.id} footprint must stay inside maxX`);
  assert.ok(actor.y - actor.radius >= minY, `${actor.id} footprint must stay inside minY`);
  assert.ok(actor.y + actor.radius <= maxY, `${actor.id} footprint must stay inside maxY`);
  for (const obstacle of profile.gameplay.obstacles) {
    const clearance = actor.radius + obstacle.footprint.radius;
    const distance = Math.hypot(actor.x - obstacle.footprint.x, actor.y - obstacle.footprint.y);
    assert.ok(distance >= clearance - 1, `${actor.id} footprint must not overlap ${obstacle.id}`);
  }
}


function openingEnemy() {
  const opening = getRunSnapshot(advanceDefenseRun(createDefenseRun({ stageId: STAGE_ID, seed: 37 }), 1));
  assert.ok(opening.enemies.length > 0, "the fixed seed must provide an enemy movement fixture");
  return structuredClone(opening.enemies[0]);
}

test("commander movement clamps the full actor footprint to all three authored stage bounds", () => {
  for (const { id: stageId } of STAGES) {
    const profile = stageWorldFor(stageId);
    const run = isolatedRun({ stageId });
    const { minY, maxX, maxY } = profile.gameplay.bounds;
    const y = Math.round((minY + maxY) / 2);
    placeCommander(run, maxX - run.commander.radius - 1, y);

    const snapshot = getRunSnapshot(step(run, "E", 4));

    assert.equal(snapshot.commander.x, maxX - snapshot.commander.radius, `${stageId} must clamp at maxX`);
    assert.equal(snapshot.commander.y, y);
    assertWalkable(snapshot.commander, profile);
  }
});

test("diagonal obstacle contact slides tangentially instead of clamp-only penetration or a full stop", () => {
  const run = isolatedRun();
  const { x, y, radius } = OBSTACLE.footprint;
  const clearance = radius + run.commander.radius;
  placeCommander(run, x - clearance - 4, y);
  const before = getRunSnapshot(run).commander;
  const vector = OCTANT_VECTORS.NE;
  const naive = {
    x: before.x + Math.trunc(vector.x * before.moveSpeed / 1000 / TICK_RATE),
    y: before.y + Math.trunc(vector.y * before.moveSpeed / 1000 / TICK_RATE),
  };
  assert.ok(
    Math.hypot(naive.x - x, naive.y - y) < clearance,
    "fixture must make naive bounds-only movement penetrate the obstacle",
  );

  const after = getRunSnapshot(step(run, "NE")).commander;

  assert.ok(after.y < before.y, "remaining diagonal motion must slide along the obstacle tangent");
  assert.ok(after.x < naive.x, "collision must remove the inward component of motion");
  assert.ok(
    Math.hypot(after.x - x, after.y - y) >= clearance - 1,
    "the commander footprint must finish outside the authored obstacle",
  );
});

test("all three stage worlds publish flat routes with two replacement intermediate objectives", () => {
  for (const { id: stageId } of STAGES) {
    const profile = stageWorldFor(stageId);
    assert.deepEqual(profile.gameplay.surfaces, [], `${stageId} must not retain stale ramp or platform surfaces`);
    const critical = profile.gameplay.routes.filter(({ kind }) => kind === "critical");
    assert.equal(critical.length, 1, `${stageId} must publish one critical route`);
    assert.deepEqual(
      critical[0].waypoints.map(({ role }) => role),
      ["ingress", "intermediate-objective", "intermediate-gate", "final-gate"],
    );
    assert.equal(
      critical[0].waypoints.filter(({ role }) => role.startsWith("intermediate-")).length,
      2,
      `${stageId} must replace elevation traversal with two routed intermediate objectives`,
    );
    for (const route of profile.gameplay.routes) {
      for (const waypoint of route.waypoints) {
        assert.equal(waypoint.placement.elevation, 0, `${waypoint.id} must stay on the flat gameplay plane`);
      }
    }
  }
});

test("flat support triangles keep replacement intermediate objectives on deterministic terrain", () => {
  for (const { id: stageId } of STAGES) {
    const profile = stageWorldFor(stageId);
    const support = profile.gameplay.meshColliders[0];
    assert.ok(support, `${stageId} declares an authored walkable support mesh`);
    assert.ok(support.triangles.length > 0, `${stageId} support mesh contains collision triangles`);
    for (const triangle of support.triangles) {
      assert.equal(triangle.length, 3);
      for (const vertex of triangle) {
        assert.ok(Number.isInteger(vertex.x) && Number.isInteger(vertex.y));
        assert.equal(vertex.elevation, 0, `${stageId} support triangles must stay flat`);
      }
    }

    const intermediates = profile.gameplay.routes
      .find(({ kind }) => kind === "critical")
      .waypoints.filter(({ role }) => role.startsWith("intermediate-"));
    for (const waypoint of intermediates) {
      const run = isolatedRun({ stageId });
      placeCommander(run, waypoint.placement.x, waypoint.placement.y);
      const commander = getRunSnapshot(advanceDefenseRun(run, 0)).commander;
      assert.equal(commander.supportMeshId, support.id, `${waypoint.id} resolves to the authored support`);
      assert.equal(commander.elevation, 0, `${waypoint.id} remains on the flat support`);
      assertWalkable(commander, profile);
    }
  }
});

test("legacy entities with integer elevation reacquire each stage's flat support without advancing time", () => {
  for (const { id: stageId } of STAGES) {
    const profile = stageWorldFor(stageId);
    const support = profile.gameplay.meshColliders[0];
    const waypoint = profile.gameplay.routes
      .find(({ kind }) => kind === "critical")
      .waypoints.find(({ role }) => role === "intermediate-objective");
    for (const prepare of [
      (entity) => { delete entity.supportMeshId; },
      (entity) => { entity.supportMeshId = "legacy:missing-support"; },
    ]) {
      const run = isolatedRun({ stageId });
      placeCommander(run, waypoint.placement.x, waypoint.placement.y);
      run.commander.elevation = 999;
      prepare(run.commander);

      const snapshot = getRunSnapshot(advanceDefenseRun(run, 0));
      assert.equal(snapshot.tick, 0, `${stageId} legacy migration must not consume a simulation tick`);
      assert.equal(snapshot.commander.supportMeshId, support.id);
      assert.equal(snapshot.commander.elevation, 0, `${stageId} legacy elevation resolves to the flat plane`);
    }
  }
});

test("companions and enemies cannot follow targets or routes beyond walkable terrain", () => {
  const run = isolatedRun({ companionLoadout: ["ember-cohort"] });
  const { minX, minY, maxY } = WORLD.gameplay.bounds;
  placeCommander(run, minX + run.commander.radius, Math.round((minY + maxY) / 2));

  const companion = run.companions[0];
  companion.x = minX + companion.radius;
  companion.y = run.commander.y + 900;
  companion.elevation = 0;

  const enemy = openingEnemy();
  enemy.x = minX + enemy.radius + 1;
  enemy.y = run.commander.y - 900;
  enemy.elevation = 0;
  enemy.route = [{ id: "fixture-outside-route", x: 0, y: enemy.y }];
  enemy.waypointIndex = 0;
  enemy.attackCooldown = 1000;
  enemy.rangedCooldown = 1000;
  run.enemies = [enemy];

  let next = run;
  for (let tick = 0; tick < 30; tick += 1) {
    next = step(next, "W");
    const snapshot = getRunSnapshot(next);
    assertWalkable(snapshot.commander);
    snapshot.companions.forEach((actor) => assertWalkable(actor));
    snapshot.enemies.forEach((actor) => assertWalkable(actor));
  }

  const final = getRunSnapshot(next);
  assert.equal(final.commander.x, minX + final.commander.radius);
  assert.equal(final.companions.length, 1);
  assert.equal(final.enemies.length, 1);
});

test("a boundary-clipped RETURN companion reaches its walkable formation anchor and resumes FOLLOW", () => {
  const run = isolatedRun({ companionLoadout: ["ember-cohort"] });
  const { minX, minY, maxY } = WORLD.gameplay.bounds;
  placeCommander(run, minX + run.commander.radius, Math.round((minY + maxY) / 2));

  const actor = run.companions[0];
  const rawAnchor = {
    x: run.commander.x + STANCE_CONFIG.VANGUARD.offsets[0].x,
    y: run.commander.y + STANCE_CONFIG.VANGUARD.offsets[0].y,
  };
  const reachableAnchor = {
    x: minX + actor.radius,
    y: rawAnchor.y,
  };
  assert.ok(rawAnchor.x - actor.radius < minX, "fixture must push the formation anchor beyond minX");

  actor.x = reachableAnchor.x + 1800;
  actor.y = reachableAnchor.y;
  actor.aiState = "RETURN";
  actor.aiTargetId = null;

  let next = run;
  let returned = null;
  for (let tick = 0; tick < 60 && !returned; tick += 1) {
    next = advanceDefenseRun(next, 1);
    const active = getRunSnapshot(next).companions[0];
    if (active.aiState === "FOLLOW") returned = active;
  }

  assert.ok(returned, "RETURN must complete at the boundary-resolved formation anchor");
  assert.deepEqual(
    { x: returned.x, y: returned.y },
    reachableAnchor,
    "FOLLOW begins only at the exact reachable anchor, not the out-of-bounds raw offset",
  );
  assertWalkable(returned);
});

test("a head-on RETURN companion takes a deterministic bounded tangent around the west ash wall", () => {
  const makeFixture = () => {
    const run = isolatedRun({ companionLoadout: ["ember-cohort"] });
    const actor = run.companions[0];
    const clearance = OBSTACLE.footprint.radius + actor.radius;
    const anchor = {
      x: OBSTACLE.footprint.x - clearance - 1000,
      y: OBSTACLE.footprint.y,
    };
    const offset = STANCE_CONFIG.VANGUARD.offsets[0];
    placeCommander(run, anchor.x - offset.x, anchor.y - offset.y);
    actor.x = OBSTACLE.footprint.x + clearance;
    actor.y = OBSTACLE.footprint.y;
    actor.elevation = 0;
    actor.aiState = "RETURN";
    actor.aiTargetId = null;
    return { run, anchor };
  };

  const leftFixture = makeFixture();
  const rightFixture = makeFixture();
  let left = leftFixture.run;
  let right = rightFixture.run;
  let previous = getRunSnapshot(left).companions[0];
  let arrived = null;
  let observedTangent = false;
  const returnStep = Math.trunc(COMPANION_AUTONOMY.returnSpeed / TICK_RATE);

  for (let tick = 0; tick < 120 && !arrived; tick += 1) {
    left = advanceDefenseRun(left, 1);
    right = advanceDefenseRun(right, 1);
    assert.equal(getRunDigest(left), getRunDigest(right), `head-on replay diverged at tick ${tick + 1}`);

    const active = getRunSnapshot(left).companions[0];
    const displacement = Math.hypot(active.x - previous.x, active.y - previous.y);
    assert.ok(
      displacement <= returnStep + 1,
      `RETURN step ${tick + 1} must stay within the authored ${returnStep}-unit step plus integer rounding`,
    );
    assertWalkable(active);
    observedTangent ||= active.y !== OBSTACLE.footprint.y;

    const atAnchor = active.x === leftFixture.anchor.x && active.y === leftFixture.anchor.y;
    if (atAnchor) {
      assert.equal(active.aiState, "FOLLOW", "FOLLOW begins on exact formation-anchor arrival");
      arrived = active;
    } else {
      assert.equal(active.aiState, "RETURN", "RETURN remains observable throughout obstacle avoidance");
    }
    previous = active;
  }

  assert.equal(observedTangent, true, "a head-on collision must choose a bounded tangent instead of deadlocking");
  assert.ok(arrived, "the deterministic tangent path must eventually reach the formation anchor");
});

test("hard-leash recovery uses the authored return step and stays RETURN until exact arrival", () => {
  const snappedDistance = 17840;
  const makeFixture = () => {
    const run = isolatedRun({ companionLoadout: ["ember-cohort"] });
    run.formationStance = "TURRET";
    placeCommander(run, 22000, 6000);
    const actor = run.companions[0];
    const offset = STANCE_CONFIG.TURRET.offsets[0];
    const anchor = {
      x: run.commander.x + offset.x,
      y: run.commander.y + offset.y,
    };
    actor.x = anchor.x - snappedDistance;
    actor.y = anchor.y;
    actor.elevation = 0;
    actor.aiState = "RETURN";
    actor.aiTargetId = null;
    assert.equal(Math.hypot(anchor.x - actor.x, anchor.y - actor.y), snappedDistance);
    assert.ok(
      Math.hypot(run.commander.x - actor.x, run.commander.y - actor.y)
        > COMPANION_AUTONOMY.hardLeashRange,
      "fixture must start beyond the authored hard leash",
    );
    return { run, anchor };
  };

  const leftFixture = makeFixture();
  const rightFixture = makeFixture();
  let left = leftFixture.run;
  let right = rightFixture.run;
  let previous = getRunSnapshot(left).companions[0];
  let arrived = null;
  const returnStep = Math.trunc(COMPANION_AUTONOMY.returnSpeed / TICK_RATE);

  for (let tick = 0; tick < 160 && !arrived; tick += 1) {
    left = advanceDefenseRun(left, 1);
    right = advanceDefenseRun(right, 1);
    assert.equal(getRunDigest(left), getRunDigest(right), `hard-leash replay diverged at tick ${tick + 1}`);

    const active = getRunSnapshot(left).companions[0];
    const displacement = Math.hypot(active.x - previous.x, active.y - previous.y);
    assert.ok(displacement <= returnStep, `hard-leash tick ${tick + 1} exceeded ${returnStep} units`);
    if (tick === 0) {
      assert.equal(displacement, returnStep, "recovery must begin with one full authored RETURN step");
    }

    const atAnchor = active.x === leftFixture.anchor.x && active.y === leftFixture.anchor.y;
    if (atAnchor) {
      assert.equal(active.aiState, "FOLLOW", "FOLLOW begins only on exact formation-anchor arrival");
      arrived = active;
    } else {
      assert.equal(active.aiState, "RETURN", "hard-leash recovery must expose RETURN until arrival");
    }
    previous = active;
  }

  assert.ok(arrived, "bounded hard-leash recovery must eventually reach the formation anchor");
});

test("maximum authored commander speed cannot tunnel into a circular obstacle", () => {
  const calibration = isolatedRun();
  calibration.occupationProgress.captured = true;
  placeCommander(calibration, 19000, 6000);
  const calibrated = getRunSnapshot(step(calibration, "E")).commander;
  const maximumStep = calibrated.x - calibration.commander.x;
  assert.ok(maximumStep > Math.trunc(calibration.commander.moveSpeed / TICK_RATE), "fixture must activate the authored movement boost");

  const run = isolatedRun();
  run.occupationProgress.captured = true;
  const { x, y, radius } = OBSTACLE.footprint;
  const contactX = x - radius - run.commander.radius;
  placeCommander(run, contactX - maximumStep + 1, y);

  const snapshot = getRunSnapshot(step(run, "E"));

  assert.ok(run.commander.x + maximumStep > contactX, "the maximum-speed free step must cross the contact plane");
  assert.ok(snapshot.commander.x <= contactX, "swept collision must stop at the near face rather than enter the obstacle");
  assertWalkable(snapshot.commander);
});

test("same-seed routed terrain traversal preserves digest identity on the flat gameplay plane", () => {
  const critical = WORLD.gameplay.routes.find(({ kind }) => kind === "critical");
  const ingress = critical.waypoints.find(({ role }) => role === "ingress").placement;
  const makeReplay = () => {
    const run = isolatedRun({ seed: 91, companionLoadout: ["ember-cohort"] });
    placeCommander(run, ingress.x, ingress.y);
    return run;
  };
  let left = makeReplay();
  let right = makeReplay();
  const inputs = [...Array(28).fill("E"), ...Array(28).fill("W")];

  for (const octant of inputs) {
    left = step(left, octant);
    right = step(right, octant);
    assert.equal(getRunSnapshot(left).commander.elevation, 0);
    assert.equal(getRunDigest(left), getRunDigest(right));
  }

  assert.equal(getRunSnapshot(left).commander.elevation, 0);
});
