import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";
import { XP_GROWTH } from "../defense-catalog.js";

const FULL_LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const FULL_REWARDS = ["abyssal-banner", "bulwark-brand", "stillwater-hourglass"];

function squaredDistance(left, right) {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function chooseGrowth(run) {
  const offer = getRunSnapshot(run).growthOffer;
  return offer ? queueInput(run, "SKILL_SELECTED", { skillId: offer.choices[0] }) : run;
}

function advanceTicks(run, tickCount, {
  castSkills = false,
  events = [],
  routeObjectives = false,
} = {}) {
  const targetTick = getRunSnapshot(run).tick + tickCount;
  let next = run;
  while (getRunSnapshot(next).tick < targetTick && !isTerminalRun(next)) {
    next = chooseGrowth(next);
    const snapshot = getRunSnapshot(next);
    if (routeObjectives) {
      next = queueInput(next, "MOVE", { octant: "IDLE" });
      if (snapshot.eliteCandidate && !snapshot.extracted) {
        next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
      }
    }
    if (castSkills) {
      for (const skillId of snapshot.commander.skills) {
        next = queueInput(next, "SKILL_CAST", { skillId });
      }
    }
    const advanced = advanceDefenseRun(next, 1);
    const advancedSnapshot = getRunSnapshot(advanced);
    events.push(...advancedSnapshot.events);
    if (advancedSnapshot.tick === snapshot.tick && !advancedSnapshot.growthOffer) {
      throw new Error("simulation did not advance a requested tick");
    }
    next = advanced;
  }
  return next;
}

function advanceUntil(run, predicate, maxTicks = 4000, options = {}) {
  let next = run;
  for (let elapsed = 0; elapsed < maxTicks && !isTerminalRun(next); elapsed += 1) {
    next = advanceTicks(next, 1, options);
    const snapshot = getRunSnapshot(next);
    if (predicate(snapshot)) return { run: next, snapshot };
  }
  return { run: next, snapshot: getRunSnapshot(next) };
}

function findPolicyScenario({
  stageId = "cinder-span",
  policyId,
  maxTicks,
  maxSeed = 16,
  predicate = () => true,
}) {
  for (let seed = 1; seed <= maxSeed; seed += 1) {
    const candidate = advanceUntil(
      createDefenseRun({ stageId, seed, companionLoadout: FULL_LOADOUT, rewardIds: FULL_REWARDS }),
      (snapshot) => {
        const enemy = snapshot.enemies.find((entry) => entry.policyId === policyId);
        return Boolean(enemy && predicate(snapshot, enemy));
      },
      maxTicks,
    );
    if (candidate.snapshot.enemies.some((enemy) => enemy.policyId === policyId)
        && predicate(candidate.snapshot, candidate.snapshot.enemies.find((enemy) => enemy.policyId === policyId))) {
      return candidate;
    }
  }
  return null;
}

function wavePolicySnapshot(snapshot) {
  return {
    tactics: snapshot.tactics,
    enemies: snapshot.enemies.map(({ id, class: enemyClass, spawnDirection, policyId, x, y }) => ({
      id,
      class: enemyClass,
      spawnDirection,
      policyId,
      x,
      y,
    })),
  };
}

function canonicalIds(entries) {
  return entries.map(({ id }) => id);
}

test("same seed and edge-equivalent seeds replay terrain, wave, and policy snapshots", () => {
  const replay = (seed) => getRunSnapshot(advanceTicks(
    createDefenseRun({ stageId: "cinder-span", seed, companionLoadout: FULL_LOADOUT }),
    150,
  ));

  const left = replay(0xffff_ffff);
  const right = replay(-1);
  assert.deepEqual(wavePolicySnapshot(left), wavePolicySnapshot(right));
  assert.ok(left.enemies.length > 0, "the snapshot must include a seeded wave");
  assert.ok(left.enemies.every((enemy) => enemy.spawnDirection && enemy.policyId));
  assert.deepEqual(canonicalIds(left.enemies), [...canonicalIds(left.enemies)].sort());
  assert.deepEqual(left.tactics, getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: -1 })).tactics);

  const zero = advanceTicks(createDefenseRun({ stageId: "cinder-span", seed: 0 }), 150);
  const one = advanceTicks(createDefenseRun({ stageId: "cinder-span", seed: 1 }), 150);
  assert.equal(getRunDigest(zero), getRunDigest(one), "zero and one are the documented equivalent xorshift edge seeds");
});

test("different seeds vary authored waves while each seed remains replayable", () => {
  const snapshotFor = (seed) => wavePolicySnapshot(getRunSnapshot(advanceTicks(
    createDefenseRun({ stageId: "veil-citadel", seed, companionLoadout: FULL_LOADOUT }),
    150,
  )));

  const seedOne = snapshotFor(1);
  const seedTwo = snapshotFor(2);
  assert.notDeepEqual(seedOne.enemies, seedTwo.enemies);
  assert.deepEqual(seedOne, snapshotFor(1));
  assert.deepEqual(seedTwo, snapshotFor(2));
});

test("stage hazard damage and occupation recovery change the commander outcome", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 7,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const events = [];
  const ready = advanceUntil(
    run,
    (snapshot) => Boolean(snapshot.eliteCandidate) && snapshot.progress.skillsLearned > 0,
    1200,
    { castSkills: true, events },
  );
  assert.ok(ready.snapshot.eliteCandidate, "echo recovery must unlock occupation recovery");
  run = ready.run;

  run = queueInput(run, "MOVE", { octant: "W" });
  run = advanceTicks(run, 50, { castSkills: true, events });
  run = queueInput(run, "MOVE", { octant: "IDLE" });
  run = advanceTicks(run, 10, { castSkills: true, events });
  const damaged = getRunSnapshot(run);
  assert.ok(damaged.commander.integrity < damaged.commander.maxIntegrity);
  assert.ok(events.some((event) => event.type === "HAZARD_DAMAGE" && event.entityId === "commander"));

  run = queueInput(run, "MOVE", { octant: "E" });
  run = advanceTicks(run, 29, { castSkills: true, events });
  run = queueInput(run, "MOVE", { octant: "IDLE" });
  const recoveryEventsBefore = events.filter((event) => event.type === "TERRAIN_RECOVERY").length;
  run = advanceTicks(run, 60, { castSkills: true, events });
  const recovered = getRunSnapshot(run);
  assert.ok(events.filter((event) => event.type === "TERRAIN_RECOVERY").length > recoveryEventsBefore);
  assert.ok(events.some((event) => event.type === "TERRAIN_RECOVERY" && event.commanderRecovery > 0));
  assert.ok(squaredDistance(recovered.commander, recovered.tactics.occupation) <= recovered.tactics.occupation.radius ** 2);
});

test("a 60 Hz hazard applies its authored per-second damage rather than per-tick damage", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 9 });
  run = queueInput(run, "MOVE", { octant: "W" });
  run = advanceTicks(run, 50);
  run = queueInput(run, "MOVE", { octant: "IDLE" });
  run = advanceTicks(run, 1);
  const before = getRunSnapshot(run);
  assert.ok(squaredDistance(before.commander, before.tactics.hazard) <= before.tactics.hazard.radius ** 2);

  run = advanceTicks(run, 60);
  const after = getRunSnapshot(run);
  assert.equal(
    before.commander.integrity - after.commander.integrity,
    before.tactics.hazard.damagePerSecond,
  );
});

test("extraction cannot progress before an elite echo becomes recoverable", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 10,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  run = queueInput(run, "MOVE", { octant: "W" });
  run = advanceTicks(run, 39, { castSkills: true });
  run = queueInput(run, "MOVE", { octant: "IDLE" });
  run = advanceTicks(run, 60, { castSkills: true });
  const snapshot = getRunSnapshot(run);

  assert.equal(snapshot.eliteCandidate, null);
  assert.equal(snapshot.extractionProgress.holdTicks, 0);
  assert.equal(snapshot.extractionProgress.completed, false);
  assert.equal(snapshot.progress.extracted, 0);
});

test("S1 defers earned growth until Gate and Echo recovery, then advances only to occupation", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 1 });
  const events = [];
  let thresholdReachedBeforePrerequisites = false;

  for (let tick = 0; tick < 3000 && !isTerminalRun(run); tick += 1) {
    const before = getRunSnapshot(run);
    const prerequisitesComplete = before.objectives.gateDefense.completed
      && before.objectives.echoRecovery.completed;
    if (!prerequisitesComplete) {
      if (before.commander.xp >= XP_GROWTH[before.commander.level - 1]) {
        thresholdReachedBeforePrerequisites = true;
      }
      assert.equal(before.growthOffer, null, "earned XP must not bypass Gate or Echo recovery");
      assert.equal(before.progress.skillsLearned, 0);
    }

    run = advanceDefenseRun(queueInput(run, "MOVE", { octant: "IDLE" }), 1);
    const after = getRunSnapshot(run);
    events.push(...after.events);
    if (after.objectives.gateDefense.completed
        && after.objectives.echoRecovery.completed
        && after.growthOffer) break;
  }

  const offered = getRunSnapshot(run);
  assert.equal(thresholdReachedBeforePrerequisites, true, "S1 must bank threshold XP before the source gate opens");
  assert.equal(offered.objectives.gateDefense.completed, true);
  assert.equal(offered.objectives.echoRecovery.completed, true);
  assert.ok(offered.objectives.gateDefense.completedAt < offered.objectives.echoRecovery.completedAt);
  assert.equal(offered.objectives.phase, "growth");
  assert.ok(offered.growthOffer, "growth must become observable once Gate and Echo recovery complete");
  assert.equal(events.filter((event) => event.type === "GROWTH_OFFER").length, 1);
  assert.equal(events.some((event) => event.type === "SKILL_SELECTED"), false);

  run = advanceDefenseRun(
    queueInput(run, "SKILL_SELECTED", { skillId: offered.growthOffer.choices[0] }),
    1,
  );
  const selected = getRunSnapshot(run);
  events.push(...selected.events);
  assert.ok(selected.commander.skills.includes(offered.growthOffer.choices[0]));
  assert.equal(selected.progress.skillsLearned, 1);
  assert.equal(selected.objectives.growth.completed, true);
  assert.equal(selected.objectives.phase, "occupation");
  assert.equal(selected.objectives.occupation.completed, false);
  assert.equal(selected.objectives.extraction.completed, false);
  assert.equal(selected.objectives.bossKill.completed, false);
  assert.deepEqual(
    events.filter((event) => event.type === "OBJECTIVE_COMPLETED").map((event) => event.objectiveId),
    ["gate-defense", "echo-recovery", "growth"],
  );
  assert.deepEqual(
    events.filter((event) => event.type === "OBJECTIVE_PHASE_CHANGED").map((event) => event.objectiveId),
    ["echo-recovery", "growth", "occupation"],
  );
});

test("occupation and extraction objectives expose progress before completing once", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 11,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const events = [];
  const ready = advanceUntil(
    run,
    (snapshot) => Boolean(snapshot.eliteCandidate) && snapshot.progress.skillsLearned > 0,
    1000,
    { castSkills: true, events },
  );
  assert.ok(ready.snapshot.eliteCandidate, "elite echo recovery must precede occupation and extraction");
  run = ready.run;

  run = queueInput(run, "MOVE", { octant: "W" });
  run = advanceTicks(run, 8, { castSkills: true, events });
  run = queueInput(run, "MOVE", { octant: "IDLE" });
  const progressingOccupation = advanceUntil(
    run,
    () => events.some((event) => event.type === "OCCUPATION_PROGRESS"),
    300,
    { castSkills: true, events },
  );
  const occupying = progressingOccupation.snapshot;
  assert.equal(occupying.occupationProgress.captured, false);
  assert.ok(occupying.occupationProgress.holdTicks > 0);
  assert.ok(events.some((event) => event.type === "OCCUPATION_PROGRESS"));

  const capturedOccupation = advanceUntil(
    progressingOccupation.run,
    (snapshot) => snapshot.occupationProgress.captured,
    300,
    { castSkills: true, events },
  );
  run = capturedOccupation.run;
  const occupied = capturedOccupation.snapshot;
  assert.equal(occupied.occupationProgress.captured, true);
  assert.equal(occupied.occupationProgress.holdTicks, occupied.occupationProgress.maxHoldTicks);
  assert.equal(events.filter((event) => event.type === "OCCUPATION_CAPTURED").length, 1);

  run = queueInput(run, "MOVE", { octant: "W" });
  run = advanceTicks(run, 32, { castSkills: true, events });
  run = queueInput(run, "MOVE", { octant: "IDLE" });
  const progressingExtraction = advanceUntil(
    run,
    () => events.some((event) => event.type === "EXTRACTION_PROGRESS"),
    300,
    { castSkills: true, events },
  );
  const extracting = progressingExtraction.snapshot;
  assert.equal(extracting.extractionProgress.completed, false);
  assert.ok(extracting.extractionProgress.holdTicks > 0);
  assert.ok(events.some((event) => event.type === "EXTRACTION_PROGRESS"));

  const completedExtraction = advanceUntil(
    progressingExtraction.run,
    (snapshot) => snapshot.extractionProgress.completed,
    300,
    { castSkills: true, events },
  );
  const extracted = completedExtraction.snapshot;
  assert.equal(extracted.extractionProgress.completed, true);
  assert.equal(extracted.extractionProgress.holdTicks, extracted.extractionProgress.maxHoldTicks);
  assert.equal(extracted.progress.extracted, 1);
  assert.equal(events.filter((event) => event.type === "EXTRACTION_COMPLETED").length, 1);
});

test("enemy policies produce gate pressure, pursuit, flank, denial, escort, and low-HP focus", async (t) => {
  await t.test("gate pressure advances toward the gate", () => {
    const appeared = findPolicyScenario({ policyId: "gate-pressure", maxTicks: 120 });
    assert.ok(appeared, "a seeded opening wave must expose gate pressure");
    const before = appeared.snapshot.enemies.find((enemy) => enemy.policyId === "gate-pressure");
    const after = getRunSnapshot(advanceTicks(appeared.run, 1)).enemies.find((enemy) => enemy.id === before.id);
    assert.ok(after, "the pressure unit must survive long enough to act");
    assert.ok(squaredDistance(after, appeared.snapshot.gate) < squaredDistance(before, appeared.snapshot.gate));
  });

  await t.test("flank policy takes the authored flank route", () => {
    const appeared = findPolicyScenario({ policyId: "flank", maxTicks: 400 });
    assert.ok(appeared, "seeded waves must expose a flanker");
    const before = appeared.snapshot.enemies.find((enemy) => enemy.policyId === "flank");
    const after = getRunSnapshot(advanceTicks(appeared.run, 1)).enemies.find((enemy) => enemy.id === before.id);
    assert.ok(after, "the flanker must survive long enough to take its route");
    const waypoint = { x: appeared.snapshot.tactics.flank.entryX, y: appeared.snapshot.tactics.flank.entryY };
    assert.ok(squaredDistance(after, waypoint) < squaredDistance(before, waypoint));
  });

  await t.test("resource denial suppresses an available echo pickup", () => {
    const appeared = findPolicyScenario({ stageId: "veil-citadel", policyId: "resource-denial", maxTicks: 550 });
    assert.ok(appeared, "seeded ranged waves must expose resource denial");
    const events = [];
    advanceUntil(
      appeared.run,
      () => events.some((event) => event.type === "PICKUP_DENIED"),
      1000,
      { castSkills: true, events },
    );
    assert.ok(events.some((event) => event.type === "PICKUP_DENIED"));
  });

  await t.test("elite escort acquires and closes on the post-Gate elite", () => {
    const events = [];
    const appeared = advanceUntil(
      createDefenseRun({
        stageId: "echo-throne",
        seed: 1,
        companionLoadout: FULL_LOADOUT,
        rewardIds: FULL_REWARDS,
      }),
      (snapshot) => snapshot.enemies.some(
        (enemy) => enemy.policyId === "elite-escort" && enemy.escortLeaderId,
      ),
      2500,
      { castSkills: true, events },
    );
    const escort = appeared.snapshot.enemies.find(
      (enemy) => enemy.policyId === "elite-escort" && enemy.escortLeaderId,
    );
    assert.ok(escort, "Gate completion must expose the authored elite escort");
    assert.equal(appeared.snapshot.objectives.gateDefense.completed, true);
    const leader = appeared.snapshot.enemies.find((enemy) => enemy.id === escort.escortLeaderId);
    assert.ok(leader?.elite || leader?.class === "boss");
    assert.ok(events.some((event) => event.type === "ESCORT_LEADER_ACQUIRED"
      && event.entityId === escort.id
      && event.leaderId === leader.id));

    const after = getRunSnapshot(
      advanceTicks(appeared.run, 1, { castSkills: true }),
    ).enemies.find((enemy) => enemy.id === escort.id);
    assert.ok(after, "the escort must survive long enough to act");
    assert.ok(squaredDistance(after, leader) < squaredDistance(escort, leader));
  });

  for (const policyId of ["player-pursuit", "low-hp-focus"]) {
    await t.test(`${policyId} closes on the selected friendly target`, () => {
      const appeared = findPolicyScenario({ policyId, maxTicks: 400, maxSeed: 8 });
      assert.ok(appeared, `seeded waves must expose ${policyId}`);
      const enemy = appeared.snapshot.enemies.find((entry) => entry.policyId === policyId);
      const target = policyId === "player-pursuit"
        ? appeared.snapshot.commander
        : appeared.snapshot.commander.integrity / appeared.snapshot.commander.maxIntegrity
          < appeared.snapshot.gate.integrity / appeared.snapshot.gate.maxIntegrity
          ? appeared.snapshot.commander
          : appeared.snapshot.gate;
      const after = getRunSnapshot(advanceTicks(appeared.run, 1)).enemies.find((entry) => entry.id === enemy.id);
      assert.ok(after, `${policyId} unit must survive long enough to act`);
      assert.ok(squaredDistance(after, target) < squaredDistance(enemy, target));
    });
  }
});

test("a run given no queued input loses to enemy pressure", () => {
  const run = advanceDefenseRun(createDefenseRun({ stageId: "gate-zenith", seed: 37 }), 5000);
  const snapshot = getRunSnapshot(run);

  assert.equal(snapshot.terminal, "DEFEAT");
  assert.ok(snapshot.gate.integrity === 0 || snapshot.commander.integrity === 0);
});

test("a spawned boss applies attack pressure after the public spatial objective route", () => {
  const events = [];
  const appeared = advanceUntil(
    createDefenseRun({
      stageId: "gate-zenith",
      seed: 12,
      companionLoadout: FULL_LOADOUT,
      rewardIds: FULL_REWARDS,
    }),
    (snapshot) => snapshot.enemies.some((enemy) => enemy.class === "boss"),
    10000,
    { castSkills: true, events, routeObjectives: true },
  );
  const boss = appeared.snapshot.enemies.find((enemy) => enemy.class === "boss");
  assert.ok(boss, "completing Gate, Echo, growth, occupation, and extraction must spawn the boss");
  assert.equal(appeared.snapshot.extractionProgress.completed, true);
  assert.equal(appeared.snapshot.progress.extracted, 1);

  advanceUntil(
    appeared.run,
    () => events.some((event) => ["COMMANDER_DAMAGED", "GATE_BREACHED"].includes(event.type)
      && event.enemyId === boss.id),
    4000,
    { events, routeObjectives: true },
  );
  assert.ok(events.some((event) => ["COMMANDER_DAMAGED", "GATE_BREACHED"].includes(event.type)
    && event.enemyId === boss.id));
});

test("run rewards, learned skills, pickups, and companions remain distinct growth layers", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 43,
    companionLoadout: ["rift-lens"],
    rewardIds: ["bulwark-brand"],
  });
  const offered = advanceUntil(run, (snapshot) => Boolean(snapshot.growthOffer), 1500);
  assert.ok(offered.snapshot.growthOffer, "combat XP must offer a run skill");
  const skillId = offered.snapshot.growthOffer.choices[0];
  run = advanceDefenseRun(queueInput(offered.run, "SKILL_SELECTED", { skillId }), 1);
  const snapshot = getRunSnapshot(run);

  assert.ok(snapshot.commander.skills.includes(skillId));
  assert.equal(snapshot.commander.skillRanks[skillId], 1);
  assert.deepEqual(snapshot.rewardIds, ["bulwark-brand"]);
  assert.deepEqual(snapshot.companions.map((entry) => entry.companionId), ["rift-lens"]);
  assert.equal(snapshot.itemIds.includes(skillId), false);
  assert.equal(snapshot.rewardIds.includes(skillId), false);
  assert.equal(snapshot.progress.skillsLearned, 1);
});
