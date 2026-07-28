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
import { STAGE_BY_ID, XP_GROWTH } from "../defense-catalog.js";

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

// Policy scenarios have to be searched across the authored wave cadence: a doctrine stage lands one
// wave every ~1000 ticks (STAGE_WAVE_DOCTRINE), so the flank/denial/escort lanes simply do not
// exist in the first few hundred ticks any more.
const POLICY_SEARCH_TICKS = 6000;
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
    seed: 901,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const events = [];
  const ready = advanceUntil(
    run,
    (snapshot) => Boolean(snapshot.eliteCandidate) && snapshot.progress.skillsLearned > 0,
    STAGE_BY_ID["cinder-span"].gateTicks + 6000,
    { castSkills: true, events, routeObjectives: true },
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

test("S1 offers growth as soon as XP is earned and still orders the objective chain", () => {
  // SUPERSEDED (run-id 20260728-stage-playtime-doctrine): growth used to be withheld until the
  // gate-defense and echo-recovery objectives were complete. With the authored 170-250 s hold that
  // meant the entire defense was played at level 1, so the XP threshold is now the only gate.
  // What is still contractual: the offer appears while the hold is live, a selection completes the
  // growth objective, and the objective/phase chain keeps its authored order.
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 901,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const events = [];
  let offerDuringHold = false;

  for (let tick = 0; tick < STAGE_BY_ID["cinder-span"].gateTicks && !isTerminalRun(run); tick += 1) {
    const before = getRunSnapshot(run);
    if (before.growthOffer) {
      assert.ok(before.commander.xp >= XP_GROWTH[before.commander.level - 1],
        "an offer must be backed by earned XP");
      assert.equal(before.objectives.gateDefense.completed, false);
      offerDuringHold = true;
      break;
    }
    run = advanceDefenseRun(queueInput(run, "MOVE", { octant: "IDLE" }), 1);
    events.push(...getRunSnapshot(run).events);
  }

  const offered = getRunSnapshot(run);
  assert.equal(offerDuringHold, true, "growth must be reachable during the authored gate hold");
  assert.ok(offered.growthOffer);
  assert.equal(offered.progress.skillsLearned, 0);
  assert.equal(events.filter((event) => event.type === "SKILL_SELECTED").length, 0);

  run = advanceDefenseRun(
    queueInput(run, "SKILL_SELECTED", { skillId: offered.growthOffer.choices[0] }),
    1,
  );
  const selected = getRunSnapshot(run);
  events.push(...selected.events);
  assert.ok(selected.commander.skills.includes(offered.growthOffer.choices[0]));
  assert.equal(selected.progress.skillsLearned, 1);
  assert.equal(selected.objectives.growth.completed, true);
  // The growth objective completing early does NOT skip the chain: the phase is still whatever the
  // ordered objective list says, which during the hold is gate-defense.
  assert.equal(selected.objectives.phase, "gate-defense");
  assert.equal(selected.objectives.gateDefense.completed, false);
  assert.equal(selected.objectives.occupation.completed, false);
  assert.equal(selected.objectives.extraction.completed, false);
  assert.equal(selected.objectives.bossKill.completed, false);
});

test("occupation and extraction objectives expose progress before completing once", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 901,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const events = [];
  const ready = advanceUntil(
    run,
    (snapshot) => Boolean(snapshot.eliteCandidate) && snapshot.progress.skillsLearned > 0,
    STAGE_BY_ID["cinder-span"].gateTicks + 6000,
    { castSkills: true, events, routeObjectives: true },
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
  const bindReady = completedExtraction.snapshot;
  assert.equal(bindReady.extractionProgress.completed, true);
  assert.equal(bindReady.extractionProgress.ready, true);
  assert.equal(bindReady.extractionProgress.holdTicks, bindReady.extractionProgress.maxHoldTicks);
  assert.equal(bindReady.extracted, false, "Bind completion must not auto-extract");
  assert.equal(bindReady.progress.extracted, 0);
  assert.equal(bindReady.objectives.extraction.completed, false, "Bind readiness must not complete public extraction");
  assert.equal(bindReady.enemies.some((enemy) => enemy.class === "boss"), false, "Bind readiness must not spawn the boss");
  assert.equal(events.some((event) => event.type === "ELITE_EXTRACTED"), false);
  run = advanceDefenseRun(
    queueInput(completedExtraction.run, "EXTRACT_ELITE", { enemyId: bindReady.eliteCandidate.enemyId }),
    1,
  );
  const extracted = getRunSnapshot(run);
  events.push(...extracted.events);
  assert.equal(extracted.extracted, true);
  assert.equal(extracted.progress.extracted, 1);
  assert.equal(extracted.companions.filter(({ companionId }) => companionId === bindReady.eliteCandidate.prototype).length, 1);
  assert.equal(events.filter((event) => event.type === "EXTRACTION_COMPLETED").length, 1);
  assert.equal(events.filter((event) => event.type === "ELITE_EXTRACTED").length, 1);
});

test("enemy policies produce gate pressure, pursuit, flank, denial, escort, and low-HP focus", async (t) => {
  await t.test("gate pressure advances toward the gate", () => {
    const appeared = findPolicyScenario({ policyId: "gate-pressure", maxTicks: POLICY_SEARCH_TICKS });
    assert.ok(appeared, "a seeded opening wave must expose gate pressure");
    const before = appeared.snapshot.enemies.find((enemy) => enemy.policyId === "gate-pressure");
    const after = getRunSnapshot(advanceTicks(appeared.run, 1)).enemies.find((enemy) => enemy.id === before.id);
    assert.ok(after, "the pressure unit must survive long enough to act");
    assert.ok(squaredDistance(after, appeared.snapshot.gate) < squaredDistance(before, appeared.snapshot.gate));
  });

  await t.test("flank policy takes the authored flank route", () => {
    const appeared = findPolicyScenario({ policyId: "flank", maxTicks: POLICY_SEARCH_TICKS });
    assert.ok(appeared, "seeded waves must expose a flanker");
    const before = appeared.snapshot.enemies.find((enemy) => enemy.policyId === "flank");
    const after = getRunSnapshot(advanceTicks(appeared.run, 1)).enemies.find((enemy) => enemy.id === before.id);
    assert.ok(after, "the flanker must survive long enough to take its route");
    const waypoint = { x: appeared.snapshot.tactics.flank.entryX, y: appeared.snapshot.tactics.flank.entryY };
    assert.ok(squaredDistance(after, waypoint) < squaredDistance(before, waypoint));
  });

  await t.test("resource denial suppresses an available echo pickup", () => {
    const appeared = findPolicyScenario({ stageId: "veil-citadel", policyId: "resource-denial", maxTicks: POLICY_SEARCH_TICKS });
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
      STAGE_BY_ID["cinder-span"].gateTicks + 6000,
      { castSkills: true, events, routeObjectives: true },
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
      const appeared = findPolicyScenario({ policyId, maxTicks: POLICY_SEARCH_TICKS, maxSeed: 8 });
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

test("a run that never fights loses to enemy pressure", () => {
  // A pending growth offer PAUSES the simulation, so "no input at all" now means "stalled at the
  // first offer" rather than "played passively". The pressure contract is measured with the offers
  // resolved and nothing else done: no movement, no casts, no extraction.
  let run = createDefenseRun({ stageId: "gate-zenith", seed: 37 });
  const budget = STAGE_BY_ID["gate-zenith"].gateTicks + 9000;
  let offersSeen = 0;
  for (let tick = 0; tick < budget && !isTerminalRun(run); tick += 1) {
    const snapshot = getRunSnapshot(run);
    if (snapshot.growthOffer) {
      offersSeen += 1;
      run = queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    }
    run = advanceDefenseRun(run, 1);
  }
  const snapshot = getRunSnapshot(run);

  assert.ok(offersSeen > 0, "a stalled run must still have been offered growth during the hold");
  assert.equal(snapshot.terminal, "DEFEAT");
  // A run that never fights loses either bar, or loses the extraction window it never worked.
  assert.ok(snapshot.gate.integrity === 0
    || snapshot.commander.integrity === 0
    || snapshot.extractionProgress.failed === true);
});

test("a spawned boss applies attack pressure after the public spatial objective route", () => {
  const events = [];
  const bindReady = advanceUntil(
    createDefenseRun({
      stageId: "gate-zenith",
      seed: 12,
      companionLoadout: FULL_LOADOUT,
      rewardIds: FULL_REWARDS,
    }),
    (snapshot) => snapshot.extractionProgress.ready && !snapshot.extracted,
    STAGE_BY_ID["gate-zenith"].gateTicks + 9000,
    { castSkills: true, events, routeObjectives: true },
  );
  assert.equal(bindReady.snapshot.extractionProgress.completed, true);
  assert.equal(bindReady.snapshot.progress.extracted, 0, "Bind readiness must not recruit the elite");
  assert.equal(bindReady.snapshot.objectives.extraction.completed, false, "Bind readiness must not complete public extraction");
  assert.equal(bindReady.snapshot.enemies.some((enemy) => enemy.class === "boss"), false, "Bind readiness must not spawn the boss");

  const extractedRun = advanceDefenseRun(
    queueInput(bindReady.run, "EXTRACT_ELITE", { enemyId: bindReady.snapshot.eliteCandidate.enemyId }),
    1,
  );
  const extracted = getRunSnapshot(extractedRun);
  events.push(...extracted.events);
  assert.equal(extracted.extracted, true);
  assert.equal(extracted.progress.extracted, 1);
  assert.equal(extracted.objectives.extraction.completed, true);
  assert.equal(extracted.companions.filter(
    ({ companionId }) => companionId === bindReady.snapshot.eliteCandidate.prototype,
  ).length, 1);
  // The boss spawns once the extraction is done AND the field is clear of the authored waves, which
  // with the doctrine hold is no longer guaranteed to be the same tick as the extraction itself.
  const bossAppeared = advanceUntil(
    extractedRun,
    (snapshot) => snapshot.enemies.some((enemy) => enemy.class === "boss"),
    STAGE_BY_ID["gate-zenith"].gateTicks + 9000,
    { castSkills: true, events, routeObjectives: true },
  );
  const boss = bossAppeared.snapshot.enemies.find((enemy) => enemy.class === "boss");
  assert.ok(boss, "a matching elite extraction must complete the public objective and spawn the boss");

  advanceUntil(
    bossAppeared.run,
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
    seed: 8,
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
