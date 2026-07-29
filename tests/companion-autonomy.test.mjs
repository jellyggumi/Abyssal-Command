import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  queueInput,
} from "../defense-run-simulation.js";
import { COMPANION_AUTONOMY, TICK_RATE } from "../defense-catalog.js";
import { STANCE_CONFIG } from "../rpg-catalog.js";

const DEFAULT_OPTIONS = Object.freeze({
  stageId: "cinder-span",
  seed: 5,
  companionLoadout: ["ember-cohort", "rift-lens"],
});

function mutableRun(options = DEFAULT_OPTIONS) {
  return structuredClone(createDefenseRun(options));
}

function pickup({ id, kind, x, y, itemId = null, xp = 0 }) {
  return { id, kind, x, y, hp: 1, maxHp: 1, itemId, xp };
}

function companion(snapshot, companionId) {
  return snapshot.companions.find((entry) => entry.companionId === companionId);
}

function recoveryFixture(seed = 5) {
  const run = mutableRun({ ...DEFAULT_OPTIONS, seed });
  const ember = run.companions.find((entry) => entry.companionId === "ember-cohort");
  const rift = run.companions.find((entry) => entry.companionId === "rift-lens");
  ember.x = 7600;
  ember.y = 6000;
  rift.x = 8000;
  rift.y = 6000;
  run.pickups = [pickup({
    id: "fixture-item",
    kind: "item",
    itemId: "ward-splinter",
    x: 7000,
    y: 6000,
  })];
  return run;
}

test("a displaced FOLLOW companion advances by one deterministic movement step instead of snapping to formation", () => {
  const run = mutableRun({
    stageId: "cinder-span",
    seed: 5,
    companionLoadout: ["ember-cohort"],
  });
  const actor = run.companions[0];
  const anchorX = run.commander.x + STANCE_CONFIG.VANGUARD.offsets[0].x;
  const anchorY = run.commander.y + STANCE_CONFIG.VANGUARD.offsets[0].y;
  actor.x = anchorX - 1000;
  actor.y = anchorY;

  const snapshot = getRunSnapshot(advanceDefenseRun(run, 1));
  const advanced = companion(snapshot, "ember-cohort");
  const expectedStep = Math.trunc(COMPANION_AUTONOMY.followSpeed / TICK_RATE);

  assert.equal(advanced.aiState, "FOLLOW");
  assert.equal(advanced.aiTargetId, null);
  assert.deepEqual(
    { x: advanced.x, y: advanced.y },
    { x: actor.x + expectedStep, y: actor.y },
    "FOLLOW must make bounded deterministic progress without teleporting to the anchor",
  );
  assert.ok(advanced.x < anchorX, "one tick must not hard-snap a companion across the remaining displacement");
});

test("combat targeting remains orthogonal while a COLLECT companion fires automatically", () => {
  const options = {
    stageId: "cinder-span",
    seed: 5,
    companionLoadout: ["ember-cohort"],
  };
  const opening = getRunSnapshot(advanceDefenseRun(createDefenseRun(options), 1));
  assert.ok(opening.enemies.length > 0, "the fixed seed must spawn an opening target");
  const spawn = opening.enemies[0];

  const run = mutableRun(options);
  const actor = run.companions[0];
  run.commander.x = spawn.x + 3000;
  run.commander.y = spawn.y + 1414;
  actor.x = run.commander.x + STANCE_CONFIG.VANGUARD.offsets[0].x;
  actor.y = run.commander.y + STANCE_CONFIG.VANGUARD.offsets[0].y;
  run.pickups = [pickup({
    id: "combat-item",
    kind: "item",
    itemId: "ward-splinter",
    x: actor.x - 600,
    y: actor.y,
  })];

  const snapshot = getRunSnapshot(advanceDefenseRun(run, 1));
  const collecting = companion(snapshot, "ember-cohort");
  const fired = snapshot.events.find(
    (event) => event.type === "WEAPON_FIRED" && event.owner === "ember-cohort",
  );

  assert.equal(collecting.aiState, "COLLECT");
  assert.equal(collecting.aiTargetId, "combat-item");
  assert.ok(fired, "an ACTIVE companion must keep automatic fire while collecting an item");
  assert.equal(fired.targetId, null, "none-target combat must not create a target lock");
  assert.notEqual(collecting.combatTargetId, collecting.aiTargetId);
  assert.notEqual(fired.aimId, collecting.aiTargetId);
  assert.match(collecting.combatTargetId, /^enemy-/u);
  assert.match(fired.aimId, /^enemy-/u);
  assert.equal(fired.entityId, collecting.id);
});

test("one eligible companion reserves an item until contact and ITEM_COLLECTED identifies that companion", () => {
  let run = advanceDefenseRun(recoveryFixture(), 1);
  let snapshot = getRunSnapshot(run);
  const claimants = snapshot.companions.filter((entry) => entry.aiTargetId === "fixture-item");

  assert.deepEqual(
    claimants.map((entry) => entry.companionId),
    ["ember-cohort"],
    "the nearest eligible ACTIVE companion must own the unique deterministic claim",
  );
  assert.equal(snapshot.pickups.some((entry) => entry.id === "fixture-item"), true,
    "a claimed item inside commander magnet range must remain reserved before companion contact");

  let collected = null;
  for (let tick = 0; tick < 12 && !collected; tick += 1) {
    run = advanceDefenseRun(run, 1);
    snapshot = getRunSnapshot(run);
    collected = snapshot.events.find((event) => event.type === "ITEM_COLLECTED") ?? null;
  }

  assert.ok(collected, "the claimant must reach and collect the reserved item deterministically");
  assert.equal(collected.entityId, claimants[0].id);
  assert.equal(collected.companionId, "ember-cohort");
  assert.equal(collected.itemId, "ward-splinter");
  assert.equal(snapshot.pickups.some((entry) => entry.id === "fixture-item"), false);
});

test("item assignment chooses the closest eligible companion instead of the earlier formation rank", () => {
  const fixture = recoveryFixture();
  const earlier = fixture.companions.find((entry) => entry.companionId === "ember-cohort");
  const closerLater = fixture.companions.find((entry) => entry.companionId === "rift-lens");
  earlier.x = 8000;
  closerLater.x = 7600;
  fixture.pickups[0].id = "later-ranked-item";

  let run = advanceDefenseRun(fixture, 1);
  let snapshot = getRunSnapshot(run);
  const earlierAfterClaim = companion(snapshot, "ember-cohort");
  const closerAfterClaim = companion(snapshot, "rift-lens");

  assert.deepEqual(
    {
      earlier: { aiState: earlierAfterClaim.aiState, aiTargetId: earlierAfterClaim.aiTargetId },
      closerLater: { aiState: closerAfterClaim.aiState, aiTargetId: closerAfterClaim.aiTargetId },
    },
    {
      earlier: { aiState: "FOLLOW", aiTargetId: null },
      closerLater: { aiState: "COLLECT", aiTargetId: "later-ranked-item" },
    },
    "global item assignment must give the sole claim to the strictly closest eligible companion",
  );

  let collected = null;
  for (let tick = 0; tick < 12 && !collected; tick += 1) {
    run = advanceDefenseRun(run, 1);
    snapshot = getRunSnapshot(run);
    collected = snapshot.events.find((event) => event.type === "ITEM_COLLECTED") ?? null;
  }

  assert.ok(collected, "the closer later-ranked companion must reach the item");
  assert.equal(collected.entityId, closerAfterClaim.id);
  assert.equal(collected.companionId, "rift-lens");
  const collectorOnCollectionTick = companion(snapshot, "rift-lens");
  assert.deepEqual(
    {
      aiState: collectorOnCollectionTick.aiState,
      aiTargetId: collectorOnCollectionTick.aiTargetId,
    },
    { aiState: "RETURN", aiTargetId: null },
    "the ITEM_COLLECTED tick must clear the consumed claim and begin RETURN immediately",
  );
});

test("echo pickups remain commander-owned and are never claimed by a nearby companion", () => {
  const run = mutableRun({
    stageId: "cinder-span",
    seed: 5,
    companionLoadout: ["ember-cohort"],
  });
  const actor = run.companions[0];
  actor.x = 8000;
  actor.y = 6000;
  run.pickups = [pickup({ id: "remote-echo", kind: "echo", x: 6500, y: 6000, xp: 8 })];
  const beforeXp = run.commander.xp;

  const snapshot = getRunSnapshot(advanceDefenseRun(run, 1));
  const active = companion(snapshot, "ember-cohort");

  assert.equal(active.aiState, "FOLLOW");
  assert.equal(active.aiTargetId, null);
  assert.equal(snapshot.pickups.some((entry) => entry.id === "remote-echo"), true);
  assert.equal(snapshot.commander.xp, beforeXp,
    "a companion near an echo outside commander range must not recover its XP");
});

test("a DOWNED companion stays inert beside eligible combat and item targets", () => {
  const options = {
    stageId: "cinder-span",
    seed: 5,
    companionLoadout: ["ember-cohort"],
  };
  const opening = getRunSnapshot(advanceDefenseRun(createDefenseRun(options), 1));
  const run = mutableRun(options);
  const actor = run.companions[0];
  actor.x = 8000;
  actor.y = 6000;
  actor.hp = 0;
  actor.status = "DOWNED";
  run.pickups = [pickup({
    id: "downed-item",
    kind: "item",
    itemId: "ward-splinter",
    x: 6500,
    y: 6000,
  })];
  run.enemies = [structuredClone(opening.enemies[0])];
  run.enemies[0].x = 8100;
  run.enemies[0].y = 6000;

  const snapshot = getRunSnapshot(advanceDefenseRun(run, 1));
  const downed = companion(snapshot, "ember-cohort");

  assert.deepEqual({ x: downed.x, y: downed.y }, { x: 8000, y: 6000 });
  assert.equal(downed.aiState, "DOWNED");
  assert.equal(downed.aiTargetId, null);
  assert.equal(downed.combatTargetId, null);
  assert.equal(snapshot.pickups.some((entry) => entry.id === "downed-item"), true);
  assert.equal(snapshot.events.some(
    (event) => event.type === "WEAPON_FIRED" && event.owner === "ember-cohort",
  ), false);
  assert.equal(snapshot.events.some(
    (event) => event.type === "ITEM_COLLECTED" && event.companionId === "ember-cohort",
  ), false);
});

test("same-seed recovery replays remain digest-identical through claim, collection, and return", () => {
  let left = recoveryFixture(29);
  let right = recoveryFixture(29);
  let observedCollection = false;
  let observedReturn = false;

  for (let tick = 0; tick < 24; tick += 1) {
    left = advanceDefenseRun(queueInput(left, "MOVE", { octant: "IDLE" }), 1);
    right = advanceDefenseRun(queueInput(right, "MOVE", { octant: "IDLE" }), 1);
    const snapshot = getRunSnapshot(left);
    observedCollection ||= snapshot.events.some((event) => event.type === "ITEM_COLLECTED");
    observedReturn ||= snapshot.companions.some((entry) => entry.aiState === "RETURN");
    assert.equal(getRunDigest(left), getRunDigest(right), `digest diverged at autonomy tick ${tick + 1}`);
  }

  assert.equal(observedCollection, true, "the replay fixture must exercise companion collection");
  assert.equal(observedReturn, true, "the replay fixture must exercise the RETURN state after collection");
});
