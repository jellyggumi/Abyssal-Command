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
import { DIRECT_COMBAT, OCTANT_VECTORS, STAGE_BY_ID, XP_GROWTH } from "../defense-catalog.js";

const FULL_LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const FULL_REWARDS = ["abyssal-banner", "bulwark-brand", "stillwater-hourglass"];

function squaredDistance(left, right) {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function octantFor(dx, dy) {
  let best = "IDLE";
  let bestDot = -Infinity;
  const length = Math.hypot(dx, dy) || 1;
  for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
    if (name === "IDLE") continue;
    const vectorLength = Math.hypot(vector.x, vector.y) || 1;
    const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
    if (dot > bestDot) { bestDot = dot; best = name; }
  }
  return best;
}

function queueMoveTowardRouteTarget(run, routeObjectives) {
  const snapshot = getRunSnapshot(run);
  let target = null;
  if (routeObjectives && snapshot.objectives.phase === "occupation") target = snapshot.tactics.occupation;
  else if (routeObjectives && snapshot.objectives.phase === "extraction") target = snapshot.tactics.extraction;
  else {
    target = snapshot.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort((left, right) => squaredDistance(left, snapshot.commander) - squaredDistance(right, snapshot.commander))[0];
  }
  if (!target) return queueInput(run, "MOVE", { octant: "IDLE" });
  const distance = Math.hypot(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
  const octant = target.radius && distance < target.radius * 0.5
    ? "IDLE"
    : octantFor(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
  return queueInput(run, "MOVE", { octant });
}

function chooseGrowth(run) {
  const offer = getRunSnapshot(run).growthOffer;
  return offer ? queueInput(run, "SKILL_SELECTED", { skillId: offer.choices[0] }) : run;
}

function queueDirectAttackWhenAvailable(run) {
  const snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer || snapshot.commander.verbState !== "IDLE") return run;
  const reach = DIRECT_COMBAT.light[0].reach;
  const targetInMelee = snapshot.enemies.some((enemy) => {
    if (enemy.hp <= 0) return false;
    const contactDistance = snapshot.commander.radius + enemy.radius + reach;
    return squaredDistance(enemy, snapshot.commander) <= contactDistance ** 2;
  });
  return targetInMelee ? queueInput(run, "ATTACK_LIGHT") : run;
}

function advanceTicks(run, tickCount, {
  castSkills = false,
  directAttack = false,
  events = [],
  routeObjectives = false,
} = {}) {
  const targetTick = getRunSnapshot(run).tick + tickCount;
  let next = run;
  while (getRunSnapshot(next).tick < targetTick && !isTerminalRun(next)) {
    next = chooseGrowth(next);
    const snapshot = getRunSnapshot(next);
    if (routeObjectives && !directAttack) next = queueInput(next, "MOVE", { octant: "IDLE" });
    if (routeObjectives && snapshot.eliteCandidate && !snapshot.extracted) {
      next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
    }
    if (castSkills) {
      for (const skillId of snapshot.commander.skills) {
        next = queueInput(next, "SKILL_CAST", { skillId });
      }
    }
    if (directAttack) {
      next = queueMoveTowardRouteTarget(next, routeObjectives);
      next = queueDirectAttackWhenAvailable(next);
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
    createDefenseRun({ stageId: "abyss-chancel", seed, companionLoadout: FULL_LOADOUT }),
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
  run = structuredClone(ready.run);
  run.commander.x = ready.snapshot.tactics.hazard.x;
  run.commander.y = ready.snapshot.tactics.hazard.y;
  run = advanceTicks(run, 60, { castSkills: true, events });
  const damaged = getRunSnapshot(run);
  assert.ok(damaged.commander.integrity < damaged.commander.maxIntegrity);
  assert.ok(events.some((event) => event.type === "HAZARD_DAMAGE" && event.entityId === "commander"));

  run = structuredClone(run);
  run.commander.x = damaged.tactics.occupation.x;
  run.commander.y = damaged.tactics.occupation.y;
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

test("occupation and post-boss extraction expose progress before completing once", () => {
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
  assert.ok(ready.snapshot.eliteCandidate, "elite echo recovery must precede occupation");
  const eliteCandidate = ready.snapshot.eliteCandidate;
  run = structuredClone(ready.run);
  run.commander.x = ready.snapshot.tactics.occupation.x;
  run.commander.y = ready.snapshot.tactics.occupation.y;
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
  assert.equal(occupied.eliteCandidate.enemyId, eliteCandidate.enemyId,
    "the defeated elite must remain recoverable through occupation");
  assert.equal(occupied.extractionProgress.expiresAt, null,
    "occupation must not open extraction before the boss is defeated");
  assert.equal(occupied.extractionProgress.holdTicks, 0);
  assert.equal(occupied.extractionProgress.completed, false);
  assert.equal(events.filter((event) => event.type === "EXTRACTION_WINDOW_OPENED").length, 0);

  const bossAppeared = advanceUntil(
    run,
    (snapshot) => snapshot.enemies.some((enemy) => enemy.class === "boss"),
    4000,
    { castSkills: true, events },
  );
  const boss = bossAppeared.snapshot.enemies.find((enemy) => enemy.class === "boss");
  assert.ok(boss, "occupation must advance into a spawned boss phase");
  assert.equal(bossAppeared.snapshot.objectives.phase, "boss-kill");
  assert.equal(bossAppeared.snapshot.objectives.bossKill.completed, false);
  assert.equal(bossAppeared.snapshot.extractionProgress.expiresAt, null);
  assert.equal(events.filter((event) => event.type === "BOSS_SPAWNED").length, 1);

  const defeatedBoss = advanceUntil(
    bossAppeared.run,
    (snapshot) => snapshot.objectives.bossKill.completed,
    6000,
    { castSkills: true, events },
  );
  run = defeatedBoss.run;
  const postBoss = defeatedBoss.snapshot;
  assert.equal(postBoss.objectives.bossKill.completed, true);
  assert.equal(postBoss.enemies.some((enemy) => enemy.class === "boss"), false);
  assert.equal(postBoss.eliteCandidate.enemyId, eliteCandidate.enemyId,
    "the elite candidate must survive the boss phase");
  assert.equal(postBoss.objectives.phase, "extraction");
  assert.ok(postBoss.extractionProgress.expiresAt > postBoss.tick);
  assert.equal(postBoss.extractionProgress.holdTicks, 0);
  assert.equal(postBoss.extractionProgress.completed, false);
  assert.equal(postBoss.extractionProgress.ready, false);
  assert.equal(events.filter((event) => event.type === "OBJECTIVE_COMPLETED"
    && event.objectiveId === "boss-kill").length, 1);
  assert.equal(events.filter((event) => event.type === "EXTRACTION_WINDOW_OPENED").length, 1);

  run = structuredClone(run);
  run.commander.x = postBoss.tactics.extraction.x;
  run.commander.y = postBoss.tactics.extraction.y;
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
  assert.equal(bindReady.enemies.some((enemy) => enemy.class === "boss"), false);
  assert.equal(events.some((event) => event.type === "ELITE_EXTRACTED"), false);
  run = advanceDefenseRun(
    queueInput(completedExtraction.run, "EXTRACT_ELITE", { enemyId: bindReady.eliteCandidate.enemyId }),
    1,
  );
  const extracted = getRunSnapshot(run);
  events.push(...extracted.events);
  assert.equal(extracted.extracted, true);
  assert.equal(extracted.progress.extracted, 1);
  assert.equal(extracted.companions.filter(({ companionId }) => companionId === eliteCandidate.prototype).length, 1);
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
    const appeared = findPolicyScenario({ stageId: "abyss-chancel", policyId: "resource-denial", maxTicks: POLICY_SEARCH_TICKS });
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

  await t.test("elite escort acquisition is emitted at spawn and the escort retreats with its leader", () => {
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
      { castSkills: true, directAttack: true, events, routeObjectives: true },
    );
    const escort = appeared.snapshot.enemies.find(
      (enemy) => enemy.policyId === "elite-escort" && enemy.escortLeaderId,
    );
    assert.ok(escort, "Gate completion must expose the authored elite escort");
    assert.equal(appeared.snapshot.objectives.gateDefense.completed, true);
    const leader = appeared.snapshot.enemies.find((enemy) => enemy.id === escort.escortLeaderId);
    assert.ok(leader?.elite || leader?.class === "boss");
    assert.equal(events.filter((event) => event.type === "ESCORT_LEADER_ACQUIRED"
      && event.entityId === escort.id
      && event.leaderId === leader.id).length, 1);

    const after = getRunSnapshot(
      advanceTicks(appeared.run, 1, { castSkills: true }),
    ).enemies.find((enemy) => enemy.id === escort.id);
    assert.ok(after, "the escort must survive long enough to act");
    assert.ok(squaredDistance(after, leader) < squaredDistance(escort, leader));

    const recovered = advanceUntil(
      appeared.run,
      (snapshot) => snapshot.eliteCandidate?.enemyId === leader.id,
      3000,
      { castSkills: true, directAttack: true, events, routeObjectives: true },
    );
    assert.equal(recovered.snapshot.eliteCandidate?.enemyId, leader.id);
    assert.equal(recovered.snapshot.enemies.some((enemy) => enemy.id === escort.id), false,
      "an escort must not remain orphaned after its elite leader dies");
    assert.equal(events.filter((event) => event.type === "ESCORT_RETREATED"
      && event.entityId === escort.id
      && event.leaderId === leader.id).length, 1);
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
  // Without an explicit attack, the commander earns no combat XP. This is the actual no-input
  // contract now that autonomous attacks have been removed.
  let run = createDefenseRun({ stageId: "echo-throne", seed: 37 });
  const budget = STAGE_BY_ID["echo-throne"].gateTicks + 9000;
  for (let tick = 0; tick < budget && !isTerminalRun(run); tick += 1) {
    run = advanceDefenseRun(run, 1);
  }
  const snapshot = getRunSnapshot(run);

  assert.equal(snapshot.commander.xp, 0, "a no-fight run earns no combat XP");
  assert.equal(snapshot.terminal, "DEFEAT");
  // A run that never fights loses either bar, or loses the extraction window it never worked.
  assert.ok(snapshot.gate.integrity === 0
    || snapshot.commander.integrity === 0
    || snapshot.extractionProgress.failed === true);
});

test("a spawned boss applies attack pressure before it dies and opens extraction", () => {
  const events = [];
  const bossAppeared = advanceUntil(
    createDefenseRun({
      stageId: "echo-throne",
      seed: 12,
      companionLoadout: FULL_LOADOUT,
      rewardIds: FULL_REWARDS,
    }),
    (snapshot) => snapshot.enemies.some((enemy) => enemy.class === "boss"),
    STAGE_BY_ID["echo-throne"].gateTicks + 9000,
    { castSkills: true, directAttack: true, events, routeObjectives: true },
  );
  const boss = bossAppeared.snapshot.enemies.find((enemy) => enemy.class === "boss");
  assert.ok(boss, "the public route must capture occupation and spawn the boss");
  assert.equal(bossAppeared.snapshot.objectives.occupation.completed, true);
  assert.equal(bossAppeared.snapshot.objectives.phase, "boss-kill");
  assert.equal(bossAppeared.snapshot.objectives.bossKill.completed, false);
  assert.equal(bossAppeared.snapshot.extractionProgress.expiresAt, null,
    "the extraction window must remain closed while the boss lives");
  assert.equal(bossAppeared.snapshot.extractionProgress.completed, false);
  assert.equal(bossAppeared.snapshot.progress.extracted, 0);
  assert.equal(events.filter((event) => event.type === "BOSS_SPAWNED"
    && event.entityId === boss.id).length, 1);

  const pressureRun = structuredClone(bossAppeared.run);
  pressureRun.commander.integrity = pressureRun.commander.maxIntegrity;
  pressureRun.gate.integrity = pressureRun.gate.maxIntegrity;
  pressureRun.commander.x = pressureRun.gate.x + 2000;
  pressureRun.commander.y = 0;
  const combatCompanions = structuredClone(pressureRun.companions);
  const positionedBoss = pressureRun.enemies.find((enemy) => enemy.id === boss.id);
  positionedBoss.x = pressureRun.gate.x - positionedBoss.radius - pressureRun.gate.radius + 300;
  positionedBoss.y = pressureRun.gate.y;
  positionedBoss.waypointIndex = positionedBoss.route.length;
  const telegraphed = advanceUntil(
    pressureRun,
    () => events.some((event) => event.type === "BOSS_ATTACK_TELEGRAPHED"
      && event.entityId === boss.id),
    2500,
    { events },
  );
  assert.ok(events.some((event) => event.type === "BOSS_ATTACK_TELEGRAPHED"
    && event.entityId === boss.id));

  const attackRun = structuredClone(telegraphed.run);
  const attackingBoss = attackRun.enemies.find((enemy) => enemy.id === boss.id);
  attackingBoss.x = attackRun.gate.x - attackingBoss.radius - attackRun.gate.radius + 300;
  attackingBoss.y = attackRun.gate.y;
  attackingBoss.waypointIndex = attackingBoss.route.length;
  attackingBoss.attackCooldown = 0;
  const pressured = advanceUntil(
    attackRun,
    () => events.some((event) => ["COMMANDER_DAMAGED", "GATE_BREACHED"].includes(event.type)
      && event.enemyId === boss.id),
    2,
    { events },
  );
  const pressureEvent = events.find((event) =>
    ["COMMANDER_DAMAGED", "GATE_BREACHED"].includes(event.type) && event.enemyId === boss.id);
  assert.ok(pressureEvent, "the spawned boss must land pressure before being defeated");
  assert.ok(pressureEvent.damage > 0);
  assert.ok(pressured.snapshot.commander.integrity < pressured.snapshot.commander.maxIntegrity
    || pressured.snapshot.gate.integrity < pressured.snapshot.gate.maxIntegrity);

  const resumedCombat = structuredClone(pressured.run);
  resumedCombat.companions = combatCompanions;
  const pressuredBoss = pressured.snapshot.enemies.find((enemy) => enemy.id === boss.id);
  assert.ok(pressuredBoss, "the boss must still be alive after applying pressure");
  resumedCombat.commander.x = pressuredBoss.x;
  resumedCombat.commander.y = pressuredBoss.y;
  const defeatedBoss = advanceUntil(
    resumedCombat,
    (snapshot) => snapshot.objectives.bossKill.completed,
    6000,
    { castSkills: true, events },
  );
  assert.equal(defeatedBoss.snapshot.objectives.bossKill.completed, true,
    "resumed combat must defeat the pressured boss");
  assert.equal(defeatedBoss.snapshot.enemies.some((enemy) => enemy.id === boss.id), false);
  assert.equal(defeatedBoss.snapshot.objectives.phase, "extraction");
  assert.ok(defeatedBoss.snapshot.extractionProgress.expiresAt > defeatedBoss.snapshot.tick);
  assert.equal(events.filter((event) => event.type === "OBJECTIVE_COMPLETED"
    && event.objectiveId === "boss-kill").length, 1);
  assert.equal(events.filter((event) => event.type === "EXTRACTION_WINDOW_OPENED").length, 1);
});

test("run rewards, learned skills, pickups, and companions remain distinct growth layers", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 8,
    companionLoadout: ["rift-lens"],
    rewardIds: ["bulwark-brand"],
  });
  const offered = advanceUntil(run, (snapshot) => Boolean(snapshot.growthOffer), 1500, { directAttack: true });
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
