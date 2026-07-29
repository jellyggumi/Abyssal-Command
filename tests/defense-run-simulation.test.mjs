import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
  SKILL_RANK_DAMAGE_STEP,
} from "../defense-run-simulation.js";
import {
  COMMANDER,
  CUTSCENES,
  ENEMIES,
  MEASUREMENT_FIXTURE_BUDGET_ID,
  MEASUREMENT_PROFILES,
  OCTANT_VECTORS,
  SKILLS,
  STAGES,
  STAGE_BY_ID,
  STAGE_WAVE_DOCTRINE,
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
const FIRST_STAGE_ID = STAGES[0].id;
const FINAL_STAGE_ID = STAGES.at(-1).id;

// Step budgets below are expressed against the authored gate hold (STAGE_WAVE_DOCTRINE): a
// cinder-span run cannot reach the elite/occupation/extraction/boss chain until the hold closes.
const CINDER_HOLD_TICKS = STAGE_BY_ID[FIRST_STAGE_ID].gateTicks;
const OBJECTIVE_STEP_BUDGET = CINDER_HOLD_TICKS + 9000;

/**
 * Octant toward whatever the current objective phase actually needs: the point for
 * occupation/extraction, the nearest living enemy otherwise. A stationary commander cannot hold the
 * authored 170-250 s gate (STAGE_WAVE_DOCTRINE), so "IDLE" is no longer a neutral default for a
 * test that drives a run to its terminal state.
 */
function objectiveOctant(snapshot) {
  const phase = snapshot.objectives.phase;
  let target = null;
  if (phase === "occupation") target = snapshot.tactics.occupation;
  else if (phase === "extraction") target = snapshot.tactics.extraction;
  else {
    const living = snapshot.enemies.filter((enemy) => enemy.hp > 0);
    if (living.length) {
      target = living.slice().sort((left, right) =>
        squaredDistance(left, snapshot.commander) - squaredDistance(right, snapshot.commander))[0];
    }
  }
  if (!target) return "IDLE";
  const dx = target.x - snapshot.commander.x;
  const dy = target.y - snapshot.commander.y;
  if (target.radius && Math.hypot(dx, dy) < target.radius * 0.5) return "IDLE";
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

function queueObjectiveCommands(run, { extractElite = true, castSkills = true, moveOctant = null } = {}) {
  const snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    return queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
  }

  let next = queueInput(run, "MOVE", { octant: moveOctant ?? objectiveOctant(snapshot) });
  if (castSkills) {
    for (const skillId of snapshot.commander.skills) {
      next = queueInput(next, "SKILL_CAST", { skillId });
    }
  }
  if (extractElite && snapshot.eliteCandidate && !snapshot.extracted) {
    next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
  }
  return next;
}

function advanceThroughObjectives(run, maxSteps = OBJECTIVE_STEP_BUDGET, options = {}) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next, options), 1);
  }
  return next;
}

function advanceThroughObjectivesUntil(run, predicate, maxSteps = OBJECTIVE_STEP_BUDGET, options = {}) {
  let next = run;
  let previous = getRunSnapshot(next);
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next, options), 1);
    const snapshot = getRunSnapshot(next);
    if (predicate(snapshot)) return { run: next, previous, snapshot };
    previous = snapshot;
  }
  return { run: next, previous, snapshot: getRunSnapshot(next) };
}

function advanceToGrowthOffer(run, maxSteps = OBJECTIVE_STEP_BUDGET) {
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

test("enemy XP reward scales with stage difficulty so late-stage level-up cadence tracks scaled enemy HP", () => {
  const scaled = (value, stageScale) => Math.trunc((value * stageScale) / 100);
  const firstSpawnedEnemy = (stageId) => {
    const snapshot = getRunSnapshot(advanceDefenseRun(createDefenseRun({ stageId, seed: 5 }), 1));
    const enemy = snapshot.enemies[0];
    assert.ok(enemy, `${stageId} opening wave must spawn an enemy`);
    return enemy;
  };

  const firstStage = STAGES[0];
  const lastStage = STAGES.at(-1);
  assert.deepEqual(
    [firstStage.id, lastStage.id],
    ["cinder-span", "echo-throne"],
    "the scaling boundary must compare the authored first and final stages",
  );
  assert.equal(firstStage.scale, 100, "cinder-span must remain the scale-100 baseline stage");

  const firstEnemy = firstSpawnedEnemy(firstStage.id);
  const lastEnemy = firstSpawnedEnemy(lastStage.id);

  // Stage 1 (scale 100) is an exact identity. This guards the determinism baseline:
  // every cinder-span digest fixture must stay byte-identical.
  assert.equal(firstEnemy.xp, ENEMIES[firstEnemy.class].xp);

  // The final stage scales enemy HP by run.stage.scale; XP tracks the same factor so
  // the in-run reward rhythm does not stall as the campaign gets harder.
  assert.equal(lastEnemy.xp, scaled(ENEMIES[lastEnemy.class].xp, lastStage.scale));
  assert.ok(
    lastEnemy.xp / ENEMIES[lastEnemy.class].xp > firstEnemy.xp / ENEMIES[firstEnemy.class].xp,
    `${lastStage.id} must apply a larger XP multiplier than ${firstStage.id}`,
  );
});

test("every stage replays with seeded enemy-composition variety inside its clear budget", () => {
  // Data contract: each doctrine wave publishes a primary composition and one remix. Both are sized
  // from the SAME HP budget (defense-catalog.js buildDoctrineWavePlan), so a replay changes what
  // shows up, never how much work the wave is.
  for (const stage of STAGES) {
    const scaledHp = (enemy) => (ENEMIES[enemy].hp * stage.scale) / 100;
    for (const wave of stage.wavePlan) {
      assert.ok(wave.alternatives.length >= 2,
        `${stage.id} wave ${wave.slot} must publish at least one remix alternative`);
      const budgets = wave.alternatives.map((alternative) => alternative.composition
        .reduce((sum, { enemy, count }) => sum + scaledHp(enemy) * count, 0));
      const [primaryBudget] = budgets;
      for (const [index, budget] of budgets.entries()) {
        assert.ok(Math.abs(budget - primaryBudget) <= primaryBudget * 0.45,
          `${stage.id} wave ${wave.slot} alternative ${index} (${Math.round(budget)} HP) must stay inside the primary budget (rounding at small body counts) (${Math.round(primaryBudget)} HP)`);
      }
      for (const alternative of wave.alternatives) {
        for (const { enemy, count } of alternative.composition) {
          assert.ok(ENEMIES[enemy], `${stage.id} wave ${wave.slot}: "${enemy}" must be a real enemy class`);
          assert.ok(count >= 1, `${stage.id} wave ${wave.slot}: every composition entry must field at least one body`);
        }
      }
    }
  }

  // Runtime contract: the seed actually selects among the alternatives. selectionId reflects the
  // picked alternative independent of density jitter, so it is the clean variety signal.
  const openingSelectionId = (stageId, seed) => {
    let run = createDefenseRun({ stageId, seed });
    for (let tick = 0; tick < 240 && !isTerminalRun(run); tick += 1) {
      run = advanceDefenseRun(run, 1);
      const started = getRunSnapshot(run).events.find(
        (event) => event.type === "WAVE_VARIANT_STARTED" && event.slot === 0,
      );
      if (started) return started.selectionId;
    }
    return null;
  };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  for (const { id: stageId } of STAGES.slice(1)) {
    const selections = new Set(seeds.map((seed) => openingSelectionId(stageId, seed)));
    selections.delete(null);
    assert.ok(selections.size >= 2, `${stageId} opening wave must vary its composition across seeds (saw ${selections.size})`);
  }
});

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
  assert.ok(banked.commander.xp > 0, "the opening wave must bank XP");
  // Growth is reachable DURING the gate-defense hold since the stage playtime doctrine: a
  // 3-6 minute stage that withheld every level-up until the objective chain closed would
  // spend most of its runtime with the growth loop switched off. What stays true -- and is
  // what this test guards -- is that banked XP alone never raises the level; only an
  // answered offer does, and it debits exactly the reached threshold.
  assert.equal(banked.commander.level, 1, "banked XP must not raise the level on its own");

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
test("Bind readiness does not extract an elite; matching input extracts once and FIFO rejects a duplicate", () => {
  const initial = createDefenseRun({
    stageId: "cinder-span",
    seed: 9,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const candidateReady = advanceThroughObjectivesUntil(
    initial,
    (snapshot) => Boolean(snapshot.eliteCandidate),
    OBJECTIVE_STEP_BUDGET,
  );
  const candidate = candidateReady.snapshot.eliteCandidate;
  assert.ok(candidate, "defeating the post-Gate elite must expose its Echo candidate");
  assert.equal(candidateReady.snapshot.extracted, false);
  assert.equal(candidateReady.snapshot.progress.extracted, 0);
  assert.deepEqual(
    candidateReady.snapshot.companions.map(({ companionId }) => companionId),
    FULL_LOADOUT,
    "candidate readiness must not add an automatic companion",
  );

  let run = candidateReady.run;
  let snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    run = advanceDefenseRun(queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] }), 1);
  }
  run = advanceDefenseRun(queueInput(run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }), 1);
  const routed = getRunSnapshot(run);
  const preReadyRejection = routed.events.find((event) => event.type === "EXTRACTION_REJECTED");
  assert.equal(routed.extracted, false, "a pre-Bind command cannot extract");
  assert.equal(routed.progress.extracted, 0);
  assert.ok(preReadyRejection);
  assert.equal(preReadyRejection.reason, "EXTRACTION_HOLD_INCOMPLETE");
  assert.equal(preReadyRejection.routeStarted, true);

  const bindReady = advanceThroughObjectivesUntil(
    run,
    (next) => next.extractionProgress.ready,
    OBJECTIVE_STEP_BUDGET,
    { extractElite: false },
  );
  snapshot = bindReady.snapshot;
  assert.equal(snapshot.extractionProgress.completed, true);
  assert.equal(snapshot.extractionProgress.ready, true);
  assert.equal(snapshot.extracted, false, "Bind completion is readiness, not player extraction");
  assert.equal(snapshot.progress.extracted, 0);
  assert.equal(snapshot.objectives.extraction.completed, false, "Bind readiness is not public objective completion");
  assert.equal(snapshot.objectives.phase, "extraction");
  assert.equal(snapshot.bossSpawned, true, "occupation unlocks the boss before extraction can complete");
  assert.equal(snapshot.objectives.occupation.completed, true);
  assert.equal(snapshot.objectives.bossKill.completed, true, "Bind readiness stays gated behind the boss kill");
  assert.equal(snapshot.terminal, null, "boss defeat and Bind readiness are not terminal before player extraction");
  assert.ok(
    snapshot.occupationProgress.capturedAt < snapshot.objectives.bossKill.completedAt
      && snapshot.objectives.bossKill.completedAt < snapshot.extractionProgress.completedAt,
    "the public timestamps must preserve occupation, boss kill, then extraction readiness",
  );
  assert.deepEqual(snapshot.companions.map(({ companionId }) => companionId), FULL_LOADOUT);
  const bindEvent = snapshot.events.find((event) => event.type === "EXTRACTION_COMPLETED");
  assert.ok(bindEvent, "Bind readiness must emit EXTRACTION_COMPLETED");
  assert.equal(snapshot.events.some((event) => event.type === "ELITE_EXTRACTED"), false);

  run = bindReady.run;
  snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    run = advanceDefenseRun(queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] }), 1);
  }
  const wrong = getRunSnapshot(advanceDefenseRun(
    queueInput(run, "EXTRACT_ELITE", { enemyId: "wrong-enemy-id" }),
    1,
  ));
  assert.equal(wrong.extracted, false);
  assert.equal(wrong.progress.extracted, 0);
  assert.deepEqual(wrong.companions.map(({ companionId }) => companionId), FULL_LOADOUT);
  assert.ok(wrong.events.some((event) => event.type === "EXTRACTION_REJECTED"));

  const successfulRun = advanceDefenseRun(
    queueInput(
      queueInput(run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }),
      "EXTRACT_ELITE",
      { enemyId: candidate.enemyId },
    ),
    1,
  );
  const successful = getRunSnapshot(successfulRun);
  assert.equal(successful.extracted, true);
  assert.equal(successful.progress.extracted, 1);
  assert.equal(successful.companions.filter(({ companionId }) => companionId === candidate.prototype).length, 1);
  assert.equal(successful.objectives.extraction.completed, true, "the accepted extraction completes the public objective");
  assert.equal(successful.objectives.phase, "complete");
  assert.equal(successful.bossSpawned, true, "the defeated boss remains recorded when extraction completes");
  assert.equal(successful.terminal, "VICTORY", "accepted extraction is the terminal victory transition");
  const extractedEvent = successful.events.find((event) => event.type === "ELITE_EXTRACTED");
  assert.ok(extractedEvent);
  assert.equal(successful.events.filter((event) => event.type === "ELITE_EXTRACTED").length, 1);
  const sameTickDuplicate = successful.events.find(
    (event) => event.type === "INPUT_REJECTED"
      && event.inputType === "EXTRACT_ELITE"
      && event.reason === "ELITE_ALREADY_EXTRACTED",
  );
  assert.ok(sameTickDuplicate, "a same-tick duplicate is rejected after the first extraction");
  assert.ok(extractedEvent.eventSequence < sameTickDuplicate.eventSequence, "same-tick extraction inputs are processed FIFO");
  assert.ok(bindEvent.eventSequence < extractedEvent.eventSequence, "Bind readiness must precede player extraction");
  const accepted = successful.events.find((event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE");
  assert.ok(accepted);
  assert.ok(extractedEvent.eventSequence < accepted.eventSequence, "extraction event must precede input acknowledgement");
  const terminalEvent = successful.events.find((event) => event.type === "TERMINAL");
  assert.ok(terminalEvent);
  assert.ok(extractedEvent.eventSequence < terminalEvent.eventSequence, "extraction must settle before terminal victory");

  const duplicate = getRunSnapshot(advanceDefenseRun(
    queueInput(successfulRun, "EXTRACT_ELITE", { enemyId: candidate.enemyId }),
    1,
  ));
  assert.equal(duplicate.extracted, true);
  assert.equal(duplicate.progress.extracted, 1);
  assert.deepEqual(
    duplicate.companions.map(({ companionId }) => companionId),
    successful.companions.map(({ companionId }) => companionId),
  );
  assert.equal(duplicate.events.filter((event) => event.type === "ELITE_EXTRACTED").length, 1);
  assert.equal(duplicate.tick, successful.tick, "queued input is not processed after terminal extraction");
  assert.deepEqual(duplicate.events, successful.events, "terminal snapshots retain the settled event batch unchanged");
});

test("an expired elite Bind window reaches terminal defeat before queued extraction can mutate state", () => {
  const candidateReady = advanceThroughObjectivesUntil(
    createDefenseRun({
      stageId: "cinder-span",
      seed: 9,
      companionLoadout: FULL_LOADOUT,
      rewardIds: FULL_REWARDS,
    }),
    (snapshot) => Boolean(snapshot.eliteCandidate),
    OBJECTIVE_STEP_BUDGET,
  );
  const candidate = candidateReady.snapshot.eliteCandidate;
  assert.ok(candidate);
  let run = candidateReady.run;
  let snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    run = advanceDefenseRun(queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] }), 1);
  }
  const atOccupation = advanceThroughObjectivesUntil(
    run,
    (next) => next.occupationProgress.holdTicks > 0,
    500,
    { extractElite: false },
  );
  assert.ok(atOccupation.snapshot.occupationProgress.holdTicks > 0);
  const occupation = advanceThroughObjectivesUntil(
    atOccupation.run,
    (next) => next.occupationProgress.captured,
    500,
    { extractElite: false, moveOctant: "IDLE" },
  );
  assert.equal(occupation.snapshot.occupationProgress.captured, true);
  const bossKilled = advanceThroughObjectivesUntil(
    occupation.run,
    (next) => next.objectives.bossKill.completed,
    OBJECTIVE_STEP_BUDGET,
    { extractElite: false },
  );
  assert.equal(bossKilled.snapshot.objectives.phase, "extraction");
  assert.equal(bossKilled.snapshot.terminal, null);
  const expired = advanceThroughObjectivesUntil(
    bossKilled.run,
    (next) => next.extractionProgress.failed,
    1000,
    { extractElite: false, moveOctant: "IDLE" },
  );
  snapshot = expired.snapshot;
  assert.equal(snapshot.extractionProgress.failed, true);
  assert.ok(snapshot.tick > snapshot.extractionProgress.expiresAt);
  assert.equal(snapshot.terminal, "DEFEAT");
  assert.equal(isTerminalRun(expired.run), true);
  const rejected = getRunSnapshot(advanceDefenseRun(
    queueInput(expired.run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }),
    1,
  ));
  assert.equal(rejected.terminal, "DEFEAT");
  assert.equal(rejected.tick, snapshot.tick, "queued input is not processed after terminal defeat");
  assert.equal(rejected.extracted, false);
  assert.deepEqual(rejected.progress, snapshot.progress);
  assert.deepEqual(rejected.companions, snapshot.companions);
  assert.deepEqual(rejected.extractionProgress, snapshot.extractionProgress);
  assert.equal(rejected.events.some((event) => event.type === "ELITE_EXTRACTED"), false);
});

test("boss waits for its stage gate and cleared authored waves; final completion is terminal", () => {
  const waiting = advanceWithOffers(createDefenseRun({ stageId: FIRST_STAGE_ID, seed: 12, companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"] }), 719);
  assert.equal(getRunSnapshot(waiting).bossSpawned, false);
  const committed = createDefenseRun({
    stageId: FINAL_STAGE_ID,
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

test("boss rewards settle exactly once before extraction terminal victory", () => {
  const started = createDefenseRun({
    stageId: "cinder-span",
    seed: 12,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
  });
  const bossKilled = advanceThroughObjectivesUntil(
    started,
    (candidate) => candidate.objectives.bossKill.completed,
  );
  const defeatedBoss = bossKilled.previous.enemies.find((enemy) => enemy.class === "boss");
  const bossKillEvents = bossKilled.snapshot.events.filter(
    (event) => event.type === "ENEMY_DEFEATED" && event.enemyId === defeatedBoss?.id,
  );

  assert.ok(defeatedBoss, "the transition must expose the living boss immediately before its defeat");
  assert.equal(bossKillEvents.length, 1, "the boss defeat must be recorded exactly once");
  assert.equal(
    bossKilled.snapshot.commander.xp,
    bossKilled.previous.commander.xp + defeatedBoss.xp,
    "the boss XP must be credited exactly once on the boss-kill tick",
  );
  assert.equal(bossKilled.snapshot.progress.defeated, bossKilled.previous.progress.defeated + 1);
  assert.equal(bossKilled.snapshot.objectives.phase, "extraction");
  assert.equal(bossKilled.snapshot.terminal, null, "boss defeat opens extraction instead of ending the run");
  assert.ok(bossKilled.snapshot.events.some((event) => event.type === "EXTRACTION_WINDOW_OPENED"));

  const terminal = advanceThroughObjectivesUntil(
    bossKilled.run,
    (candidate) => candidate.terminal === "VICTORY",
  );
  const terminalEvents = terminal.snapshot.events.filter((event) => event.type === "TERMINAL");
  assert.equal(terminal.snapshot.terminal, "VICTORY");
  assert.equal(terminal.snapshot.objectives.extraction.completed, true);
  assert.equal(terminal.snapshot.commander.xp, terminal.previous.commander.xp,
    "extraction settlement must not credit the boss XP a second time");
  assert.equal(terminal.snapshot.progress.defeated, terminal.previous.progress.defeated,
    "extraction settlement must not count the boss defeat a second time");
  assert.equal(terminal.snapshot.events.some((event) => event.type === "ENEMY_DEFEATED"), false);
  assert.equal(terminalEvents.length, 1, "extraction completion emits one terminal settlement");
  assert.deepEqual(terminal.snapshot.rewardOffer?.choices, terminalEvents[0].rewardChoices,
    "the single terminal event must carry the public loot offer");
  assert.equal(terminal.snapshot.growthOffer, null);

  const settledAgain = advanceDefenseRun(terminal.run, 1);
  assert.equal(getRunDigest(settledAgain), getRunDigest(terminal.run),
    "a settled terminal run must keep its deterministic digest and rewards unchanged");
});

test("terminal victory accepts a queued reward selection and closes the offer", () => {
  const terminal = advanceThroughObjectives(
    createDefenseRun({
      stageId: FINAL_STAGE_ID,
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

  assert.ok(skillId, "deterministic offer sequence should expose a zero-radius active skill");

  // Find a tick where the cast has something measurable to hit, then assert on that tick.
  // Pinning the assertion to the first tick that merely has an in-range enemy is not stable:
  // an enemy that attacks the Gate on the same tick is consumed by its own breach (removed
  // from run.enemies without incrementing progress.defeated), which leaves the cast with no
  // observable target. The cast is trialled on a branch of the run, so a tick that turns out
  // to be unmeasurable costs nothing and the search simply continues.
  let before = null;
  let after = null;
  let rank = 1;
  let expectedDamage = 0;
  let damageObserved = false;
  for (let step = 0; step < 2000 && !isTerminalRun(run) && !damageObserved; step += 1) {
    const snapshot = getRunSnapshot(run);
    const targetInRange = snapshot.enemies.some(
      (enemy) => squaredDistance(enemy, snapshot.commander) <= COMMANDER.basicRange ** 2,
    );
    const damageSourcesIdle = snapshot.commander.basicCooldown > 1
      && snapshot.companions.every((companion) => companion.cooldown > 1)
      && snapshot.projectiles.every((projectile) => projectile.ttl > 1);
    const skillReady = (snapshot.commander.cooldowns?.[skillId] ?? 0) === 0;

    if (targetInRange && damageSourcesIdle && skillReady) {
      before = snapshot;
      rank = before.commander.skillRanks?.[skillId] ?? 1;
      // Skills carry a rank, so the contract is exact authored damage at the rank the run
      // actually reached -- not the raw catalog number.
      expectedDamage = Math.round(SKILLS[skillId].damage * (1 + SKILL_RANK_DAMAGE_STEP * (rank - 1)));
      after = getRunSnapshot(advanceDefenseRun(queueInput(run, "SKILL_CAST", { skillId }), 1));
      damageObserved = before.enemies.some((enemy) => {
        const surviving = after.enemies.find((candidate) => candidate.id === enemy.id);
        return surviving
          ? enemy.hp - surviving.hp === expectedDamage
          : after.progress.defeated > before.progress.defeated;
      });
      if (damageObserved) break;
    }

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

  assert.ok(before, "the public route must reach a tick with an in-range target and a ready skill");
  assert.ok(before.commander.skills.includes(skillId));
  assert.ok(
    before.enemies.some((enemy) => squaredDistance(enemy, before.commander) <= COMMANDER.basicRange ** 2),
    "the public route must bring an enemy within the zero-radius skill's fallback range",
  );
  assert.equal(damageObserved, true, `the cast must apply its rank-${rank} damage (${expectedDamage}) to one in-range target`);
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

test("owned Warden's Lantern increases commander pickupRange by exactly 400 over baseline", () => {
  const baseline = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: 1, companionLoadout: ["ember-cohort"] }));
  const lantern = getRunSnapshot(createDefenseRun({
    stageId: "cinder-span", seed: 1, companionLoadout: ["ember-cohort"], rewardIds: ["warden-lantern"],
  }));

  assert.equal(baseline.commander.pickupRange, 12000);
  assert.equal(lantern.commander.pickupRange, 12400);
  assert.equal(lantern.commander.pickupRange - baseline.commander.pickupRange, 400);
});

test("owned Choir Ward Crystal increases commander crit chance by exactly 300bp over baseline", () => {
  const baseline = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: 1, companionLoadout: ["ember-cohort"] }));
  const crystal = getRunSnapshot(createDefenseRun({
    stageId: "cinder-span", seed: 1, companionLoadout: ["ember-cohort"], rewardIds: ["choir-ward-crystal"],
  }));

  assert.equal(baseline.commander.critProfile.chanceBp, 1500);
  assert.equal(crystal.commander.critProfile.chanceBp, 1800);
  assert.equal(crystal.commander.critProfile.chanceBp - baseline.commander.critProfile.chanceBp, 300);

  // Composes additively with a Warden stat crit investment and stays clamped within [0, 10000]:
  // base 1500 + maxed fracture-precision (10 * 100 = 1000) applied first by wardenProgress, then
  // + the 300bp reward on top -- the same clamp() call path that guards the ceiling for any stack.
  const stacked = getRunSnapshot(createDefenseRun({
    stageId: "cinder-span", seed: 1, companionLoadout: ["ember-cohort"],
    rewardIds: ["choir-ward-crystal"],
    wardenProgress: { statPoints: { "fracture-precision": 10 }, skillTreeIds: [], traitIds: [] },
  }));
  assert.equal(stacked.commander.critProfile.chanceBp, 2800);
  assert.ok(stacked.commander.critProfile.chanceBp <= 10000, "chanceBp must never exceed the 10000bp clamp ceiling");
});

test("Warden's Lantern and Choir Ward Crystal are applied once at run creation and never compound across ticks with no pickups", () => {
  let run = createDefenseRun({
    stageId: "cinder-span", seed: 1, companionLoadout: ["ember-cohort"],
    rewardIds: ["warden-lantern", "choir-ward-crystal"],
  });
  const initial = getRunSnapshot(run);
  assert.equal(initial.commander.pickupRange, 12400);
  assert.equal(initial.commander.critProfile.chanceBp, 1800);

  for (let step = 0; step < 200; step += 1) run = advanceDefenseRun(run, 1);
  const after = getRunSnapshot(run);

  assert.deepEqual(after.itemIds, [], "the fixture window must not have collected an item that could re-trigger pickupRange logic");
  assert.equal(after.growthOffer, null, "the fixture window must not have offered growth that could re-trigger pickupRange logic");
  assert.equal(after.commander.pickupRange, 12400, "pickupRange must not compound or drift across ticks");
  assert.equal(after.commander.critProfile.chanceBp, 1800, "chanceBp must not compound or drift across ticks");
});

test("an item pickup applies both gate maximum and current integrity", () => {
  const chancelHoldTicks = STAGE_BY_ID["abyss-chancel"].gateTicks;
  const { previous, snapshot } = advanceThroughObjectivesUntil(
    createDefenseRun({
      stageId: "abyss-chancel",
      seed: 5,
      companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    }),
    (next) => next.itemIds.includes("ward-splinter"),
    chancelHoldTicks + 9000,
  );

  assert.deepEqual(snapshot.itemIds, ["ward-splinter"]);
  assert.equal(snapshot.gate.maxIntegrity, STAGE_WAVE_DOCTRINE["abyss-chancel"].gateIntegrity + 80);
  assert.equal(snapshot.gate.integrity, previous.gate.integrity + 80);
  assert.equal(snapshot.progress.itemsCollected, 1);
  assert.ok(snapshot.events.some((event) => event.type === "ITEM_COLLECTED"));
});

test("repeated ticks after an item pickup do not compound Abyssal Banner companion damage", () => {
  let run = createDefenseRun({
    stageId: "abyss-chancel",
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

  // The stage item drops from the elite, which now appears only after the authored gate hold
  // (STAGE_WAVE_DOCTRINE), so the run has to be played toward the objective rather than idled.
  const chancelItemBudget = STAGE_BY_ID["abyss-chancel"].gateTicks + 9000;
  for (let step = 0; step < chancelItemBudget && !getRunSnapshot(run).itemIds.length && !isTerminalRun(run); step += 1) {
    run = advanceDefenseRun(queueObjectiveCommands(run), 1);
  }
  const afterPickup = getRunSnapshot(run);
  assert.deepEqual(afterPickup.itemIds, ["ward-splinter"]);
  assert.deepEqual(
    afterPickup.companions.map(({ companionId, damage }) => ({ companionId, damage })),
    initialDamage,
  );

  for (let step = 0; step < 30; step += 1) run = advanceDefenseRun(queueObjectiveCommands(run), 1);
  assert.deepEqual(
    getRunSnapshot(run).companions.map(({ companionId, damage }) => ({ companionId, damage })),
    initialDamage,
  );
});


test("Abyssal Banner gives a later extracted companion one bonus", () => {
  const completed = advanceThroughObjectivesUntil(
    createDefenseRun({
      stageId: "abyss-chancel",
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
  const run = createDefenseRun({ stageId: "abyss-chancel", seed: 2 });
  const snapshot = getRunSnapshot(run);
  const started = snapshot.events.find(({ type }) => type === "STAGE_STARTED");

  assert.deepEqual(snapshot.cutscene, CUTSCENES["abyss-chancel"]);
  assert.deepEqual(started?.cutscene, CUTSCENES["abyss-chancel"].intro);
  assert.notDeepEqual(snapshot.cutscene, CUTSCENES.default);
  assert.equal(snapshot.stageId, "abyss-chancel");
});

test("selecting an already-owned reward closes an all-owned terminal offer", () => {
  const terminal = advanceThroughObjectives(
    createDefenseRun({
      stageId: FINAL_STAGE_ID,
      seed: 12,
      companionLoadout: FULL_LOADOUT,
      rewardIds: ["throne-echo-record", "veil-vanguard-legacy", "stillwater-hourglass"],
    }),
  );
  const before = getRunSnapshot(terminal);
  assert.equal(before.terminal, "FINAL_COMPLETION");
  assert.deepEqual(
    [...before.rewardOffer.choices].sort(),
    ["stillwater-hourglass", "throne-echo-record", "veil-vanguard-legacy"],
  );

  const selected = advanceDefenseRun(
    queueInput(terminal, "REWARD_SELECTED", { rewardId: before.rewardOffer.choices[0] }),
    1,
  );
  const after = getRunSnapshot(selected);
  assert.equal(after.rewardOffer, null);
  assert.deepEqual(after.rewardIds, ["stillwater-hourglass", "throne-echo-record", "veil-vanguard-legacy"]);
  assert.equal(
    after.events.find((event) => event.type === "REWARD_SELECTION_DUPLICATE_IGNORED")?.reason,
    "REWARD_ALREADY_OWNED",
  );
});
