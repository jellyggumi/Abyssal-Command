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
import {
  COMMANDER,
  CUTSCENES,
  MEASUREMENT_FIXTURE_BUDGET_ID,
  MEASUREMENT_PROFILES,
  SKILLS,
  XP_GROWTH,
} from "../defense-catalog.js";

function squaredDistance(left, right) {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function advanceWithOffers(run, steps, onTick = () => {}) {
  let next = run;
  for (let tick = 0; tick < steps && !isTerminalRun(next); tick += 1) {
    const snapshot = getRunSnapshot(next);
    if (snapshot.growthOffer) next = queueInput(next, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    onTick(snapshot, (type, payload) => { next = queueInput(next, type, payload); });
    next = advanceDefenseRun(next, 1);
  }
  return next;
}

function advanceUntilSnapshot(run, predicate, maxSteps = 10000) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceWithOffers(next, 1);
    const snapshot = getRunSnapshot(next);
    if (predicate(snapshot)) return snapshot;
  }
  return getRunSnapshot(next);
}

function advanceUntilWithPrevious(run, predicate, maxSteps = 10000) {
  let next = run;
  let previous = getRunSnapshot(run);
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceWithOffers(next, 1);
    const snapshot = getRunSnapshot(next);
    if (predicate(snapshot)) return { previous, snapshot };
    previous = snapshot;
  }
  return { previous, snapshot: getRunSnapshot(next) };
}

const FULL_LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const FULL_REWARDS = ["abyssal-banner", "bulwark-brand", "stillwater-hourglass"];

function queueObjectiveCommands(run) {
  const snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    return queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
  }

  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of snapshot.commander.skills) {
    next = queueInput(next, "SKILL_CAST", { skillId });
  }
  if (snapshot.eliteCandidate && !snapshot.extracted) {
    next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
  }
  return next;
}

function advanceThroughObjectives(run, maxSteps = 12000) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next), 1);
  }
  return next;
}

function advanceThroughObjectivesUntil(run, predicate, maxSteps = 12000) {
  let next = run;
  let previous = getRunSnapshot(next);
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next), 1);
    const snapshot = getRunSnapshot(next);
    if (predicate(snapshot)) return { run: next, previous, snapshot };
    previous = snapshot;
  }
  return { run: next, previous, snapshot: getRunSnapshot(next) };
}

function advanceToGrowthOffer(run, maxSteps = 4000) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    if (getRunSnapshot(next).growthOffer) return next;
    next = advanceDefenseRun(queueObjectiveCommands(next), 1);
  }
  return next;
}
function castMeasurementSkillAgainstTarget(profileId, seed = 17) {
  const profile = MEASUREMENT_PROFILES[profileId];
  let run = createDefenseRun({ stageId: "cinder-span", seed, measurementProfileId: profileId });
  const observedEvents = [...getRunSnapshot(run).events];
  const range = SKILLS[profile.activeSkillId].radius || COMMANDER.basicRange;

  for (let step = 0; step < 1200 && !isTerminalRun(run); step += 1) {
    const snapshot = getRunSnapshot(run);
    const targetInRange = snapshot.enemies.some(
      (enemy) => squaredDistance(enemy, snapshot.commander) <= range ** 2,
    );
    if (targetInRange) {
      const castRun = advanceDefenseRun(queueInput(run, "SKILL_CAST", { skillId: profile.activeSkillId }), 1);
      const castSnapshot = getRunSnapshot(castRun);
      observedEvents.push(...castSnapshot.events);
      if (castSnapshot.events.some((event) => event.type === "SKILL_RESOLVED_DAMAGE")) {
        return { castRun, castSnapshot, events: observedEvents, profile };
      }
      run = castRun;
      continue;
    }
    run = advanceDefenseRun(run, 1);
    observedEvents.push(...getRunSnapshot(run).events);
  }

  assert.fail("the fixed measurement fixture must encounter a target within its active-skill range");
}

test("equal seeds and identical inputs produce identical deterministic digests", () => {
  let left = createDefenseRun({ stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] });
  let right = createDefenseRun({ stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] });
  for (const input of [["MOVE", { octant: "NW" }], ["MOVE", { octant: "SE" }]]) {
    left = queueInput(left, input[0], input[1]);
    right = queueInput(right, input[0], input[1]);
  }
  left = advanceWithOffers(left, 500);
  right = advanceWithOffers(right, 500);
  assert.equal(getRunDigest(left), getRunDigest(right));
});

test("the commander remains at the explicit idle position until movement input", () => {
  const initial = createDefenseRun({ stageId: "cinder-span", seed: 1 });
  const idle = advanceDefenseRun(initial, 1);
  const moved = advanceDefenseRun(queueInput(initial, "MOVE", { octant: "N" }), 1);
  assert.equal(getRunSnapshot(initial).commander.move, "IDLE");
  assert.deepEqual(getRunSnapshot(idle).commander.x, getRunSnapshot(initial).commander.x);
  assert.equal(getRunSnapshot(moved).commander.y, 5932);
});

test("growth pauses simulation until one offered skill is selected", () => {
  let run = advanceToGrowthOffer(
    createDefenseRun({ stageId: "cinder-span", seed: 4, companionLoadout: ["ember-cohort", "rift-lens"] }),
  );
  const offer = getRunSnapshot(run).growthOffer;
  assert.ok(offer, "earned XP should present a growth offer");
  const pausedTick = getRunSnapshot(run).tick;
  assert.equal(getRunSnapshot(advanceDefenseRun(run, 120)).tick, pausedTick);
  const selected = advanceDefenseRun(queueInput(run, "SKILL_SELECTED", { skillId: offer.choices[0] }), 1);
  const repeated = advanceDefenseRun(queueInput(selected, "SKILL_SELECTED", { skillId: offer.choices[0] }), 1);
  const selectedSnapshot = getRunSnapshot(selected);
  assert.ok(selectedSnapshot.commander.skills.includes(offer.choices[0]));
  assert.equal(selectedSnapshot.commander.level, offer.level);
  assert.equal(getRunSnapshot(repeated).commander.level, offer.level);
});

test("growth selection debits the reached-level threshold and preserves XP carryover", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 4,
    companionLoadout: ["ember-cohort", "rift-lens"],
  });
  run = advanceDefenseRun(run, 600);
  const banked = getRunSnapshot(run);
  assert.equal(banked.commander.level, 1);
  assert.ok(banked.commander.xp > 0, "pre-growth XP must be positive before Gate and Echo recovery");
  assert.equal(banked.growthOffer, null, "threshold XP must remain banked until Gate and Echo recovery complete");

  run = advanceToGrowthOffer(run);
  const firstOffer = getRunSnapshot(run);
  assert.equal(firstOffer.commander.level, 1);
  assert.ok(firstOffer.growthOffer);
  const firstThreshold = XP_GROWTH[firstOffer.commander.level - 1];
  const firstXpBeforeSelection = firstOffer.commander.xp;

  run = advanceDefenseRun(
    queueInput(run, "SKILL_SELECTED", { skillId: firstOffer.growthOffer.choices[0] }),
    1,
  );
  const levelTwo = getRunSnapshot(run);
  assert.equal(levelTwo.commander.level, 2);
  assert.equal(
    levelTwo.commander.xp,
    firstXpBeforeSelection - firstThreshold,
    "level-one selection must debit the reached threshold while retaining banked overflow",
  );

  run = advanceToGrowthOffer(run);
  const laterOffer = getRunSnapshot(run);
  assert.equal(laterOffer.commander.level, 2);
  assert.ok(laterOffer.growthOffer, "continued combat must expose a later-level offer");
  const threshold = XP_GROWTH[laterOffer.commander.level - 1];
  const xpBeforeSelection = laterOffer.commander.xp;

  run = advanceDefenseRun(
    queueInput(run, "SKILL_SELECTED", { skillId: laterOffer.growthOffer.choices[0] }),
    1,
  );
  const levelThree = getRunSnapshot(run);
  assert.equal(levelThree.commander.level, 3);
  assert.equal(
    levelThree.commander.xp,
    xpBeforeSelection - threshold,
    "later selection must debit the threshold for the level being left and retain overflow",
  );
});

test("an elite can be extracted only after the spatial objective chain and only once", () => {
  const ready = advanceThroughObjectivesUntil(
    createDefenseRun({
      stageId: "cinder-span",
      seed: 9,
      companionLoadout: FULL_LOADOUT,
      rewardIds: FULL_REWARDS,
    }),
    (snapshot) => Boolean(snapshot.eliteCandidate),
    3000,
  );
  const candidate = ready.snapshot.eliteCandidate;
  assert.ok(candidate, "defeating the post-Gate elite must expose its Echo candidate");

  let run = advanceDefenseRun(
    queueInput(ready.run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }),
    1,
  );
  const routing = getRunSnapshot(run);
  assert.equal(routing.extracted, false, "the extraction command cannot bypass occupation and Bind holds");
  assert.ok(routing.events.some((event) => event.type === "EXTRACTION_REJECTED"
    && event.reason === "EXTRACTION_HOLD_INCOMPLETE"
    && event.routeStarted === true));

  const completed = advanceThroughObjectivesUntil(run, (snapshot) => snapshot.extracted, 3000);
  run = completed.run;
  assert.equal(completed.snapshot.extracted, true);
  assert.equal(completed.snapshot.companions.filter((entry) => entry.companionId === "ember-cohort").length, 1);

  const repeat = advanceDefenseRun(queueInput(run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }), 1);
  assert.deepEqual(
    getRunSnapshot(repeat).companions.map((entry) => entry.companionId),
    completed.snapshot.companions.map((entry) => entry.companionId),
  );
});

test("boss waits for its stage gate and cleared authored waves; final completion is terminal", () => {
  const waiting = advanceWithOffers(createDefenseRun({ stageId: "cinder-span", seed: 12, companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"] }), 719);
  assert.equal(getRunSnapshot(waiting).bossSpawned, false);
  const committed = createDefenseRun({
    stageId: "gate-zenith",
    seed: 12,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const committedPlan = getRunSnapshot(committed).plan.identity;
  const final = advanceThroughObjectives(committed);
  const snapshot = getRunSnapshot(final);
  const terminalEvent = snapshot.events.find((event) => event.type === "TERMINAL");

  assert.equal(snapshot.terminal, "FINAL_COMPLETION");
  assert.equal(isTerminalRun(final), true);
  assert.ok(terminalEvent, "the terminal transition must be observed");
  assert.equal(terminalEvent.planIdentity, committedPlan);
  assert.match(terminalEvent.eventId, new RegExp(`^${committedPlan}:event:\\d+$`));
});

test("terminal victory suppresses a growth offer when boss XP crosses the next threshold", () => {
  const { previous, snapshot } = advanceThroughObjectivesUntil(
    createDefenseRun({
      stageId: "cinder-span",
      seed: 12,
      companionLoadout: FULL_LOADOUT,
      rewardIds: FULL_REWARDS,
    }),
    (candidate) => candidate.terminal === "VICTORY",
  );
  const nextGrowthThreshold = XP_GROWTH[previous.commander.level - 1];

  assert.equal(snapshot.terminal, "VICTORY");
  assert.equal(snapshot.commander.level, previous.commander.level);
  assert.ok(previous.commander.xp < nextGrowthThreshold);
  assert.ok(snapshot.commander.xp >= nextGrowthThreshold);
  assert.equal(snapshot.growthOffer, null);
});

test("terminal victory accepts a queued reward selection and closes the offer", () => {
  const terminal = advanceThroughObjectives(
    createDefenseRun({
      stageId: "gate-zenith",
      seed: 12,
      companionLoadout: FULL_LOADOUT,
    }),
  );
  const before = getRunSnapshot(terminal);
  assert.equal(before.terminal, "FINAL_COMPLETION");
  assert.ok(before.rewardOffer);

  const selected = advanceDefenseRun(
    queueInput(terminal, "REWARD_SELECTED", { rewardId: before.rewardOffer.choices[0] }),
    1,
  );
  const after = getRunSnapshot(selected);
  assert.equal(after.rewardOffer, null);
  assert.deepEqual(after.rewardIds, [before.rewardOffer.choices[0]]);
  assert.equal(after.events.find((e) => e.type === "REWARD_SELECTED")?.type, "REWARD_SELECTED");
});

test("an active zero-radius skill damages a single target", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 4,
    companionLoadout: ["ember-cohort", "rift-lens"],
  });
  let skillId = null;

  for (let step = 0; step < 4000 && !skillId && !isTerminalRun(run); step += 1) {
    const snapshot = getRunSnapshot(run);
    if (snapshot.growthOffer) {
      const zeroRadiusSkill = snapshot.growthOffer.choices.find((id) => id === "rift-bolt" || id === "soul-lance");
      if (zeroRadiusSkill) skillId = zeroRadiusSkill;
      run = queueInput(run, "SKILL_SELECTED", { skillId: zeroRadiusSkill ?? snapshot.growthOffer.choices[0] });
    } else {
      run = queueObjectiveCommands(run);
    }
    run = advanceDefenseRun(run, 1);
  }

  for (let step = 0; step < 2000 && !isTerminalRun(run); step += 1) {
    const snapshot = getRunSnapshot(run);
    const targetInRange = snapshot.enemies.some(
      (enemy) => squaredDistance(enemy, snapshot.commander) <= COMMANDER.basicRange ** 2,
    );
    const damageSourcesIdle = snapshot.commander.basicCooldown > 1
      && snapshot.companions.every((companion) => companion.cooldown > 1)
      && snapshot.projectiles.every((projectile) => projectile.ttl > 1);
    if (targetInRange && damageSourcesIdle) break;

    if (snapshot.growthOffer) {
      run = queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    } else {
      run = queueInput(run, "MOVE", { octant: "IDLE" });
      if (snapshot.eliteCandidate && !snapshot.extracted) {
        run = queueInput(run, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
      }
    }
    run = advanceDefenseRun(run, 1);
  }

  assert.ok(skillId, "deterministic offer sequence should expose a zero-radius active skill");
  const before = getRunSnapshot(run);
  assert.ok(before.commander.skills.includes(skillId));
  assert.ok(
    before.enemies.some((enemy) => squaredDistance(enemy, before.commander) <= COMMANDER.basicRange ** 2),
    "the public route must bring an enemy within the zero-radius skill's fallback range",
  );

  const after = getRunSnapshot(
    advanceDefenseRun(queueInput(run, "SKILL_CAST", { skillId }), 1),
  );
  const damageObserved = before.enemies.some((enemy) => {
    const surviving = after.enemies.find((candidate) => candidate.id === enemy.id);
    return surviving
      ? enemy.hp - surviving.hp === SKILLS[skillId].damage
      : after.progress.defeated > before.progress.defeated;
  });
  assert.equal(damageObserved, true, "the cast must apply its authored damage to one in-range target");
  const castEvent = after.events.find((event) => event.type === "SKILL_CAST" && event.skillId === skillId);
  assert.ok(castEvent, "the damage tick must report the active skill that caused it");
});
test("measurement fixtures expose the five frozen signed tuples", () => {
  assert.equal(MEASUREMENT_FIXTURE_BUDGET_ID, "g2-measurement-fixture-budget-v1");
  assert.equal(Object.isFrozen(MEASUREMENT_PROFILES), true);
  assert.deepEqual(MEASUREMENT_PROFILES, {
    bulwark: {
      id: "bulwark", name: "Bulwark", budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
      maxIntegrity: 1250, basicCooldownTicks: 30, basicDamage: 900,
      critProfile: { sources: ["basic", "skill"], chanceBp: 500, multiplierBp: 15000 },
      activeSkillId: "void-aegis", fixtureActiveCooldownTicks: 300,
    },
    striker: {
      id: "striker", name: "Striker", budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
      maxIntegrity: 1000, basicCooldownTicks: 18, basicDamage: 900,
      critProfile: { sources: ["basic", "skill"], chanceBp: 1500, multiplierBp: 17000 },
      activeSkillId: "soul-lance", fixtureActiveCooldownTicks: 270,
    },
    gambit: {
      id: "gambit", name: "Gambit", budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
      maxIntegrity: 900, basicCooldownTicks: 30, basicDamage: 900,
      critProfile: { sources: ["basic", "skill"], chanceBp: 3000, multiplierBp: 19000 },
      activeSkillId: "grave-pulse", fixtureActiveCooldownTicks: 240,
    },
    conductor: {
      id: "conductor", name: "Conductor", budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
      maxIntegrity: 1000, basicCooldownTicks: 24, basicDamage: 900,
      critProfile: { sources: ["basic", "skill"], chanceBp: 1500, multiplierBp: 17000 },
      activeSkillId: "shadow-step", fixtureActiveCooldownTicks: 120,
    },
    rift: {
      id: "rift", name: "Rift", budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
      maxIntegrity: 1000, basicCooldownTicks: 30, basicDamage: 900,
      critProfile: { sources: ["basic", "skill"], chanceBp: 2000, multiplierBp: 18000 },
      activeSkillId: "shadow-step", fixtureActiveCooldownTicks: 210,
    },
  });
  for (const profile of Object.values(MEASUREMENT_PROFILES)) {
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.critProfile), true);
  }
});

test("catalog-selected measurement fixtures isolate their signed commander setup", () => {
  for (const profile of Object.values(MEASUREMENT_PROFILES)) {
    const snapshot = getRunSnapshot(createDefenseRun({
      stageId: "cinder-span",
      seed: 71,
      companionLoadout: FULL_LOADOUT,
      rewardIds: FULL_REWARDS,
      measurementProfileId: profile.id,
    }));

    assert.equal(snapshot.measurementProfileId, profile.id);
    assert.equal(snapshot.commander.maxIntegrity, profile.maxIntegrity);
    assert.equal(snapshot.commander.integrity, profile.maxIntegrity);
    assert.equal(snapshot.commander.basicTicks, profile.basicCooldownTicks);
    assert.equal(snapshot.commander.basicDamage, profile.basicDamage);
    assert.deepEqual(snapshot.commander.critProfile, profile.critProfile);
    assert.deepEqual(snapshot.commander.skills, [profile.activeSkillId]);
    assert.deepEqual(snapshot.commander.cooldowns, { [profile.activeSkillId]: 0 });
    assert.deepEqual(snapshot.companions, []);
    assert.deepEqual(snapshot.itemIds, []);
    assert.deepEqual(snapshot.rewardIds, []);
  }
});

test("measurement fixtures remain isolated through a deterministic combat interval", () => {
  const profile = MEASUREMENT_PROFILES.striker;
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 71,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
    measurementProfileId: profile.id,
  });
  let combatObserved = false;

  for (let tick = 0; tick < 360; tick += 1) {
    run = advanceDefenseRun(run, 1);
    combatObserved ||= getRunSnapshot(run).events.some(
      (event) => event.type === "WEAPON_FIRED" && event.entityId === "commander",
    );
  }
  const snapshot = getRunSnapshot(run);

  assert.equal(snapshot.tick, 360, "the isolated fixture must continue through the complete combat interval");
  assert.equal(combatObserved, true, "the deterministic interval must exercise commander combat");
  assert.deepEqual(snapshot.companions, []);
  assert.deepEqual(snapshot.rewardIds, []);
  assert.deepEqual(snapshot.itemIds, []);
  assert.equal(snapshot.progress.itemsCollected, 0);
  assert.equal(snapshot.commander.basicDamage, profile.basicDamage);
  assert.deepEqual(snapshot.commander.skills, [profile.activeSkillId]);
  assert.equal(snapshot.growthOffer, null);
});

test("unknown or absent measurement profile IDs preserve the identical ordinary run", () => {
  const options = {
    stageId: "cinder-span",
    seed: 71,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  };
  const baseline = createDefenseRun(options);
  const unknown = createDefenseRun({ ...options, measurementProfileId: "not-a-measurement-profile" });

  assert.equal(getRunDigest(unknown), getRunDigest(baseline));
});

test("measurement skill events preserve target results and report readiness on the advertised tick", () => {
  const { castRun, castSnapshot, profile } = castMeasurementSkillAgainstTarget("conductor");
  const resolutions = castSnapshot.events.filter((event) => event.type === "SKILL_RESOLVED_DAMAGE");
  const cooldownSet = castSnapshot.events.find((event) => event.type === "SKILL_COOLDOWN_SET");

  assert.ok(cooldownSet, "a successful active-skill cast must expose its cooldown observation");
  assert.ok(resolutions.length > 0, "a successful active-skill cast must resolve at least one target");
  assert.equal(cooldownSet.skillId, profile.activeSkillId);
  assert.equal(cooldownSet.targetCount, resolutions.length);
  for (const resolution of resolutions) {
    assert.equal(resolution.sourceId, castSnapshot.commander.id);
    assert.equal(resolution.skillId, profile.activeSkillId);
    assert.equal(resolution.simTick, cooldownSet.setTick);
    assert.equal(resolution.damage, resolution.finalDamage);
    assert.equal(resolution.healthBefore - resolution.healthAfter, resolution.finalDamage);
  }

  const justBeforeReady = getRunSnapshot(advanceDefenseRun(castRun, cooldownSet.effectiveCooldownTicks - 2));
  assert.equal(
    justBeforeReady.events.some((event) => event.type === "SKILL_COOLDOWN_READY"),
    false,
    "cooldown readiness must not arrive one simulation tick early",
  );
  const readySnapshot = getRunSnapshot(advanceDefenseRun(
    advanceDefenseRun(castRun, cooldownSet.effectiveCooldownTicks - 2),
    1,
  ));
  const ready = readySnapshot.events.find((event) => event.type === "SKILL_COOLDOWN_READY");

  assert.ok(ready, "the cooldown must become ready on the next tick");
  assert.equal(readySnapshot.tick, cooldownSet.readyTick);
  assert.equal(ready.readyTick, cooldownSet.readyTick);
  assert.equal(ready.simTick, cooldownSet.readyTick);
});

test("core event identities stay ordered and preserve spawn, cast, causal, and kill linkage", () => {
  const { castRun, castSnapshot, events, profile } = castMeasurementSkillAgainstTarget("striker");
  const cast = castSnapshot.events.find((event) => event.type === "SKILL_CAST");
  const resolution = castSnapshot.events.find((event) => event.type === "SKILL_RESOLVED_DAMAGE");
  const spawn = events.find((event) => event.eventId === resolution?.targetSpawnEventId);
  let laterRun = castRun;
  const laterEvents = [];
  let defeat = null;

  for (let tick = 0; tick < 360 && !defeat; tick += 1) {
    laterRun = advanceDefenseRun(laterRun, 1);
    const tickEvents = getRunSnapshot(laterRun).events;
    laterEvents.push(...tickEvents);
    defeat = tickEvents.find((event) => event.type === "ENEMY_DEFEATED" && event.enemyId === resolution?.targetId) || null;
  }

  assert.ok(cast, "the fixture cast must expose a cast event");
  assert.ok(resolution, "the fixture cast must expose resolved damage");
  assert.ok(spawn, "resolved damage must point to the target's spawn event");
  assert.ok(defeat, "the resolved target must later emit a defeat event");
  assert.equal(cast.skillId, profile.activeSkillId);
  assert.equal(resolution.castInstanceId, cast.castInstanceId);
  assert.equal(resolution.causalRootId, cast.causalRootId);
  assert.equal(resolution.targetId, spawn.entityId);
  assert.equal(defeat.spawnEventId, spawn.eventId);

  for (const event of [...events, ...laterEvents]) {
    assert.equal(event.eventId, `${castSnapshot.plan.identity}:event:${event.eventSequence}`);
  }
  for (let index = 1; index < laterEvents.length; index += 1) {
    assert.equal(laterEvents[index].eventSequence, laterEvents[index - 1].eventSequence + 1);
  }
});

test("owned Bulwark Brand reduces gate breach damage", () => {
  const firstBreach = (rewardIds) => advanceUntilSnapshot(
    createDefenseRun({ stageId: "cinder-span", seed: 3, rewardIds }),
    (snapshot) => snapshot.events.some((event) => event.type === "GATE_BREACHED"),
  );
  const unbranded = firstBreach([]);
  const branded = firstBreach(["bulwark-brand"]);
  const unbrandedEvent = unbranded.events.find((event) => event.type === "GATE_BREACHED");
  const brandedEvent = branded.events.find((event) => event.type === "GATE_BREACHED");

  assert.ok(unbrandedEvent, "a deterministic wave should breach the gate");
  assert.ok(brandedEvent, "the same wave should breach the branded gate");
  assert.equal(unbrandedEvent.damage - brandedEvent.damage, 2);
  assert.equal(branded.gateDamageReduction, 2);
});

test("an item pickup applies both gate maximum and current integrity", () => {
  const { previous, snapshot } = advanceUntilWithPrevious(
    createDefenseRun({
      stageId: "veil-citadel",
      seed: 5,
      companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    }),
    (next) => next.itemIds.includes("ward-splinter"),
    2000,
  );

  assert.deepEqual(snapshot.itemIds, ["ward-splinter"]);
  assert.equal(snapshot.gate.maxIntegrity, 1080);
  assert.equal(snapshot.gate.integrity, previous.gate.integrity + 80);
  assert.equal(snapshot.progress.itemsCollected, 1);
  assert.ok(snapshot.events.some((event) => event.type === "ITEM_COLLECTED"));
});

test("repeated ticks after an item pickup do not compound Abyssal Banner companion damage", () => {
  let run = createDefenseRun({
    stageId: "veil-citadel",
    seed: 5,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    rewardIds: ["abyssal-banner"],
  });
  const initialDamage = getRunSnapshot(run).companions.map((companion) => ({
    companionId: companion.companionId,
    damage: companion.damage,
  }));
  assert.deepEqual(initialDamage, [
    { companionId: "ember-cohort", damage: 480 },
    { companionId: "rift-lens", damage: 600 },
    { companionId: "veil-vanguard", damage: 420 },
  ]);

  for (let step = 0; step < 2000 && !getRunSnapshot(run).itemIds.length; step += 1) {
    run = advanceWithOffers(run, 1);
  }
  const afterPickup = getRunSnapshot(run);
  assert.deepEqual(afterPickup.itemIds, ["ward-splinter"]);
  assert.deepEqual(
    afterPickup.companions.map(({ companionId, damage }) => ({ companionId, damage })),
    initialDamage,
  );

  for (let step = 0; step < 30; step += 1) run = advanceWithOffers(run, 1);
  assert.deepEqual(
    getRunSnapshot(run).companions.map(({ companionId, damage }) => ({ companionId, damage })),
    initialDamage,
  );
});


test("Abyssal Banner gives a later extracted companion one bonus", () => {
  const completed = advanceThroughObjectivesUntil(
    createDefenseRun({
      stageId: "veil-citadel",
      seed: 5,
      companionLoadout: ["ember-cohort", "veil-vanguard"],
      rewardIds: FULL_REWARDS,
    }),
    (snapshot) => snapshot.extracted,
  );
  assert.equal(completed.snapshot.extracted, true);
  assert.equal(
    completed.snapshot.companions.filter((entry) => entry.companionId === "rift-lens").length,
    1,
  );
  assert.equal(
    completed.snapshot.companions.find((entry) => entry.companionId === "rift-lens").damage,
    600,
  );
});
test("later-stage runs expose their authored cutscene without falling back to generic copy", () => {
  const run = createDefenseRun({ stageId: "sunken-bastion", seed: 2 });
  const snapshot = getRunSnapshot(run);
  const started = snapshot.events.find(({ type }) => type === "STAGE_STARTED");

  assert.deepEqual(snapshot.cutscene, CUTSCENES["sunken-bastion"]);
  assert.deepEqual(started?.cutscene, CUTSCENES["sunken-bastion"].intro);
  assert.notDeepEqual(snapshot.cutscene, CUTSCENES.default);
  assert.equal(snapshot.stageId, "sunken-bastion");
});

test("selecting an already-owned reward closes an all-owned terminal offer", () => {
  const terminal = advanceThroughObjectives(
    createDefenseRun({
      stageId: "gate-zenith",
      seed: 12,
      companionLoadout: FULL_LOADOUT,
      rewardIds: ["dawnless-crown", "throne-echo-record", "rift-lens-archive"],
    }),
  );
  const before = getRunSnapshot(terminal);
  assert.equal(before.terminal, "FINAL_COMPLETION");
  assert.deepEqual(
    [...before.rewardOffer.choices].sort(),
    ["dawnless-crown", "rift-lens-archive", "throne-echo-record"],
  );

  const selected = advanceDefenseRun(
    queueInput(terminal, "REWARD_SELECTED", { rewardId: before.rewardOffer.choices[0] }),
    1,
  );
  const after = getRunSnapshot(selected);
  assert.equal(after.rewardOffer, null);
  assert.deepEqual(after.rewardIds, ["dawnless-crown", "rift-lens-archive", "throne-echo-record"]);
  assert.equal(after.events.find((e) => e.type === "REWARD_SELECTED")?.alreadyOwned, true);
});
