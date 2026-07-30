import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  advanceDefenseRun,
  applyIncomingDamage,
  buffBp,
  composedBuffStats,
  createDefenseRun,
  effectiveBasicDamage,
  effectiveCooldownScaleBp,
  effectiveCritChanceBp,
  effectiveGateMax,
  effectivePickupRange,
  getCommanderSpeed,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
  SKILL_RANK_DAMAGE_STEP,
} from "../defense-run-simulation.js";
import { cutsceneFromEvent } from "../defense-cutscene.js";
import {
  BUFF_ITEMS,
  BUFF_STAT_OPS,
  COMMANDER,
  CUTSCENES,
  DROP_TTL_TICKS,
  ENEMIES,
  ITEMS,
  MAX_FIELD_DROPS,
  MEASUREMENT_FIXTURE_BUDGET_ID,
  MEASUREMENT_PROFILES,
  OCTANT_VECTORS,
  REWARDS,
  SKILLS,
  STAGES,
  STAGE_BY_ID,
  STAGE_WAVE_DOCTRINE,
  XP_GROWTH,
} from "../defense-catalog.js";
import { COMPANION_ROLES } from "../rpg-catalog.js";
import { STAGE_STORIES } from "../stage-story-catalog.js";

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
test("all stage starts expose ordered authored quest dialogue without generic fallback", () => {
  const expectedByStage = {
    "cinder-span": {
      acquisition: [
        ["사슬이 길을 막는다고 생각하나요? 서쪽 불씨를 버티고, 무엇을 붙들고 있는지 직접 보세요.", "EMBER LOOKOUT"],
        ["문을 지키는 사슬인지, 무너지는 길을 붙드는 사슬인지 확인하겠다.", "DUSK WARDEN"],
      ],
      summary: ["서쪽 불씨를 버티고 사슬의 진실을 확인하세요.", "EMBER LOOKOUT"],
    },
    "abyss-chancel": {
      acquisition: [
        ["등불을 들었군요. 여섯 번째 손이 같은 길을 걷고 있습니다.", "VEIL LOOKOUT"],
        ["내 앞의 손들은 뭘 했지?", "DUSK WARDEN"],
        ["모두 거울 속 손이 보여준 서약을 되풀이했습니다. 당신도 그럴 건가요?", "VEIL LOOKOUT"],
      ],
      summary: ["거울이 먼저 내놓은 답을 거부하세요.", "VEIL LOOKOUT"],
    },
    "echo-throne": {
      acquisition: [
        ["왕좌는 비어 있지만 명령은 아직 회랑을 돌고 있습니다. 돌아오는 메아리보다 먼저 단상에 서세요.", "THRONE LOOKOUT"],
        ["주인이 아니라 명령을 끝내겠다.", "DUSK WARDEN"],
      ],
      summary: ["빈 왕좌보다 오래 남은 명령을 끊으세요.", "THRONE LOOKOUT"],
    },
  };

  for (const [stageId, expected] of Object.entries(expectedByStage)) {
    const snapshot = getRunSnapshot(createDefenseRun({ stageId, seed: 2 }));
    const started = snapshot.events.find(({ type }) => type === "STAGE_STARTED");
    assert.ok(started, `${stageId} must emit STAGE_STARTED`);
    const presentation = cutsceneFromEvent(started);
    const expectedSpeakerPairs = [
      [CUTSCENES[stageId].intro[0], "speaker-a"],
      [CUTSCENES[stageId].intro[1], "speaker-b"],
      ...expected.acquisition,
      expected.summary,
    ];
    const authoredDialogue = STAGE_STORIES[stageId].quest.acquisitionDialogue;

    assert.deepEqual(snapshot.cutscene, CUTSCENES[stageId], `${stageId} must retain its authored catalog cutscene`);
    assert.deepEqual(
      authoredDialogue.map(({ text, speaker }) => [text, speaker]),
      expected.acquisition,
      `${stageId} acquisition dialogue must retain its authoritative text and speakers`,
    );
    assert.deepEqual(
      [started?.storyBeat?.dialogue?.text, started?.storyBeat?.dialogue?.speaker],
      expected.summary,
      `${stageId} summary must retain its authoritative text and speaker`,
    );
    assert.deepEqual(started?.cutscene, CUTSCENES[stageId].intro, `${stageId} raw stage-start lines must retain only the authored intro`);
    assert.equal(new Set(started?.cutscene).size, CUTSCENES[stageId].intro.length, `${stageId} raw stage-start lines must be unique`);
    assert.deepEqual(
      presentation.beats.map(({ text, relay }) => [text, relay.speaker]),
      expectedSpeakerPairs,
      `${stageId} dialogue speakers must resolve from exact authored text`,
    );
    assert.deepEqual(
      presentation.beats.slice(0, CUTSCENES[stageId].intro.length).map(({ relay }) => relay.speaker),
      ["speaker-a", "speaker-b"],
      `${stageId} legacy intro lines must retain generic relay labels`,
    );
    assert.notDeepEqual(snapshot.cutscene, CUTSCENES.default, `${stageId} must reject generic fallback copy`);
    assert.equal(snapshot.stageId, stageId);
  }
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

/* ===========================================================================================
 * CYCLE 10 — ITEM DROP / TIMED STAT BUFF DETERMINISM GATE
 *
 * `_workspace/current/design/item-drop-timed-buff-spec.md` §9 names checks 1, 2, 5, 8, 10a, 17
 * and 20 the determinism gate: if any of the seven fails, the feature does not ship. Each one
 * defends against a specific silent-corruption mode from §10's risk register — the class of
 * defect that leaves the game playable and the suite green while the digest stops being
 * reproducible.
 *
 * FIVE of the seven assert an ABSENCE (no buff key, no event, no mutation, no float, no rng
 * movement), and an absence assertion passes trivially against a feature that was never wired
 * up. Every one below therefore carries a POSITIVE PAIR in the same test — an assertion that
 * fails if the drop/buff layer is inert — so a green result means "the layer ran and stayed
 * invisible", never "the layer did nothing".
 * =========================================================================================== */

/**
 * `createDefenseRun` returns a FROZEN run, so `run.buffs = [...]` silently no-ops and every
 * accessor keeps reporting its base value — a mutation that looks applied and isn't. Round-trip
 * through JSON to get a writable copy: `run.buffs` entries are eight integer/string fields with
 * no nesting, so the clone is lossless, and this is the same `clone` the simulation itself uses
 * on every `advanceDefenseRun`.
 */
function thawRun(run) {
  return JSON.parse(JSON.stringify(run));
}

/** A `run.buffs` entry built from the catalog, so magnitude/stat can never drift from BUFF_ITEMS. */
function buffEntry(itemId, { stacks = 1, buffId = `buff-${itemId}`, appliedAtTick = 0, expiresAtTick = 1_000_000 } = {}) {
  const definition = BUFF_ITEMS[itemId];
  return {
    buffId,
    itemId,
    stat: definition.stat,
    magnitude: definition.magnitude,
    stacks,
    appliedAtTick,
    expiresAtTick,
    sourceDropId: `drop-${itemId}`,
  };
}

/** A real buff drop actor, shaped exactly as `rollBuffDrop` builds one. */
function buffDropAt(run, itemId, x, y) {
  const definition = BUFF_ITEMS[itemId];
  return {
    id: `zz-drop-${itemId}`,
    type: "pickup",
    kind: "buff",
    itemId,
    rarity: definition.rarity,
    modelKey: definition.modelKey,
    grade: "BOSS",
    slabId: null,
    expiresAtTick: run.tick + DROP_TTL_TICKS,
    elevation: 0,
    x,
    y,
    hp: 1,
    maxHp: 1,
  };
}

/**
 * Clones a LIVE enemy `count` times with `hp = 0` so the next tick's `resolveDeaths` rolls a
 * drop for each. Cloning a real spawned enemy rather than hand-rolling a literal keeps every
 * field the tick loop touches (`route`, `waypointIndex`, `policyId`, …) present and valid.
 * Ids are `zz-`prefixed, so they sort last under the `id.localeCompare` order `resolveDeaths`
 * imposes and the roll sequence is fixed.
 */
function withDeadEnemies(run, count, mutate = () => {}) {
  const next = thawRun(run);
  const template = next.enemies[0];
  assert.ok(template, "withDeadEnemies needs at least one live enemy to clone");
  for (let index = 0; index < count; index += 1) {
    const corpse = JSON.parse(JSON.stringify(template));
    corpse.id = `zz-corpse-${String(index).padStart(2, "0")}`;
    corpse.hp = 0;
    corpse.x = 5000 + index * 7;
    corpse.y = 5000;
    mutate(corpse, index);
    next.enemies.push(corpse);
  }
  return next;
}

/** BOSS grade is 10000bp in every stage's DROP_CHANCE_BP, so each death spawns with certainty. */
function withDeadBosses(run, count) {
  return withDeadEnemies(run, count, (corpse) => {
    corpse.class = "boss";
    corpse.elite = false;
    corpse.midboss = false;
  });
}

/** Fills the field to `count` buff drops, far from the commander so none is collected. */
function withFieldDrops(run, count) {
  const next = thawRun(run);
  for (let index = 0; index < count; index += 1) {
    next.pickups.push({
      ...buffDropAt(next, "ember-edge", 200, 200 + index),
      id: `zz-fill-${index}`,
      expiresAtTick: next.tick + DROP_TTL_TICKS,
    });
  }
  return next;
}

/** Advances `steps` ticks through growth offers, tallying every event type seen on the way. */
function driveWithLedger(run, steps) {
  const counts = new Map();
  let next = run;
  for (let step = 0; step < steps && !isTerminalRun(next); step += 1) {
    const snapshot = getRunSnapshot(next);
    if (snapshot.growthOffer) next = queueInput(next, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    next = advanceDefenseRun(next, 1);
    for (const event of getRunSnapshot(next).events) counts.set(event.type, (counts.get(event.type) || 0) + 1);
  }
  return { run: next, counts, count: (type) => counts.get(type) || 0 };
}

/** Every numeric leaf in a serialized snapshot, as `path -> value`. Array indices are kept. */
function numericLeaves(value, path = "", out = []) {
  if (typeof value === "number") {
    out.push({ path, value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => numericLeaves(item, `${path}[${index}]`, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) numericLeaves(entry, path ? `${path}.${key}` : key, out);
  }
  return out;
}

const stripIndices = (path) => path.replace(/\[\d+\]/g, "[]");

/**
 * The complete set of non-integer leaves a snapshot carried BEFORE cycle 10, measured against
 * the pre-feature module at `033877ad` across every stage. All seven are authored float
 * multipliers in stage layout / recovery data. The drop-buff layer must add NOTHING to this
 * list: §10 risk 6 and risk 13 are both "a float reaches the digest and byte-identity dies
 * across engines", and both are invisible in an unbuffed fixture.
 */
const PRE_EXISTING_FLOAT_PATHS = Object.freeze([
  "stageLayout.elevation.rangeMultiplier",
  "stageLayout.occupationPoint.effects.moveMultiplier",
  "stageLayout.occupationPoint.effects.rangeMultiplier",
  "tactics.elevation.rangeMultiplier",
  "tactics.occupation.effects.moveMultiplier",
  "tactics.occupation.effects.rangeMultiplier",
  "terrainRecovery.capRatio",
]);

/** The seven event types §7 introduces. None may appear in a measurement-profile run (§6.3). */
const DROP_BUFF_EVENT_TYPES = Object.freeze([
  "DROP_SPAWNED",
  "DROP_DENIED",
  "DROP_EXPIRED",
  "BUFF_APPLIED",
  "BUFF_REFRESHED",
  "BUFF_EXPIRED",
  "ITEM_COLLECTED",
]);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

/**
 * §9 check 1 requires the zero-buff digest to be byte-identical to "the pre-change digest at
 * the same seed", captured BEFORE the feature landed. These are that capture: each hash is
 * `sha256(getRunDigest(run))` produced by the simulation module at commit `033877ad` — the last
 * commit before the drop/buff layer existed — run against the current catalog. Recover the
 * baseline module with `git show 033877ad:defense-run-simulation.js`.
 *
 * PROVENANCE — TWO catalogs, and only one of them is pure addition.
 *
 * This comment previously cited a single figure, "+173/-0 (pure addition, so the pre-feature
 * module loads unchanged against it)". That figure is correct, but it is `defense-catalog.js`
 * (923 lines at base, `git diff --numstat 033877ad..HEAD -- defense-catalog.js` = **+173/-0**)
 * and it was never the whole story, because the module loads against `stage-world-catalog.js`
 * too. Measured: `git diff --numstat 033877ad -- stage-world-catalog.js` = **+20/-16** (576
 * lines at base). It was already +17/-16 before the cinder obstacle promotion, because cycle
 * 10's route commit `87915ded` rewrote waypoints and corridor widths in place.
 *
 * So the justification splits:
 *
 *  - `defense-catalog.js` +173/-0 — genuinely pure addition. `BUFF_ITEMS` and friends are new
 *    exports the pre-feature module never reads, so nothing it does read moved.
 *  - `stage-world-catalog.js` +20/-16 — NOT pure addition, and obstacle geometry genuinely
 *    differs: cinder-span went 3 -> 6 obstacles (three already-visible frozen props promoted to
 *    collision). What holds here is narrower: the catalog's *exported shape* is unchanged. Every
 *    edit is a value edit or a row added inside an existing array; no export, field or helper
 *    the pre-feature module reads was renamed or removed, and it reaches obstacles only through
 *    `world.gameplay.obstacles`, which still exists with the same element shape.
 *
 * The four hashes below were re-measured against the 6-obstacle catalog after that promotion and
 * are UNCHANGED — the pinned values are the re-capture, not a stale carry-over. Obstacles do
 * displace entities, but these four windows never reach the three added circles: the closest any
 * body or projectile comes is +2494.53 (`relay-debris-south`, cinder/71/500 bare), with
 * `relay-debris-north` +3320.81 and `east-ash-wall` +3075.79. Control for the null result — the
 * same window run with one extra obstacle injected on the commander's start moves the hash to
 * `d4086a62…`, so this harness is demonstrably sensitive to an obstacle change and the
 * invariance above is a measurement, not an unwired no-op.
 *
 * A hash rather than a 19KB string because the digest is not the artifact under test — its
 * INVARIANCE is. Any byte that moves flips the hash.
 *
 * STATE THE CLAIM AT THE WIDTH THE EVIDENCE SUPPORTS (director R43). Byte-identity across the
 * feature boundary holds for a run that SPAWNED ZERO DROPS. It does NOT hold merely because no
 * buff is active at the measurement tick, and the difference is not a leak.
 *
 * Measured: 10 windows compared old-module against new-module, 7 byte-identical. Two of the
 * three that differed had a buff live at the tick — expected. The third (cinder-span/9/3000) had
 * `buffs` ABSENT, zero field drops, and an identical digest LENGTH, yet differed: enemy ids had
 * shifted `enemy-58` -> `enemy-63` and `eventSequence` `12831` -> `12842`. That is §10 risk 7 —
 * `nextId` is one counter shared with pickups, projectiles and enemies, so a drop actor that
 * spawned and was collected 2000 ticks earlier permanently renumbers every later actor. Its
 * `waveVariant` was byte-identical in that same run, which is what proves `run.rng` was never
 * touched. DropBuffImpl's independent 72-run sweep found the same shape: 6 divergences, every one
 * with a drop roll, zero divergences without one.
 *
 * So every window pinned below is chosen for ZERO SPAWNED DROPS, and the test asserts that
 * precondition rather than assuming it. A future balance change that starts dropping inside one
 * of these windows must fail as "precondition broke", never as a silent hash mismatch.
 */
const PRE_FEATURE_DIGEST_SHA256 = Object.freeze([
  { label: "cinder-span/71/500 +ember-cohort", options: { stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] }, steps: 500, sha: "4fa5abdeeff6c4782595c2b1b45681049b3f082a4a2e344a53aa16d3425e35d1" },
  { label: "cinder-span/71/500 bare", options: { stageId: "cinder-span", seed: 71, companionLoadout: [] }, steps: 500, sha: "c4e67af6ce7b052f3635132084e117b770d1d6f0f498405ab926d511e480793f" },
  { label: "abyss-chancel/71/1000 bare", options: { stageId: "abyss-chancel", seed: 71, companionLoadout: [] }, steps: 1000, sha: "b18f8900fb9b8fc181060ad91171188d902d2336ccccbd8e6c47b40f12916324" },
  { label: "echo-throne/12/500 bare", options: { stageId: "echo-throne", seed: 12, companionLoadout: [] }, steps: 500, sha: "ba0e8c11f35e015724e92e323c14d495711e14073005b40ecffb2580fb9f6ed0" },
]);

// ---------------------------------------------------------------------------------------------
// CHECK 1 — zero-buff digest byte-identity
// ---------------------------------------------------------------------------------------------

test("gate check 1: a run that collects no buff drop keeps a digest byte-identical to the pre-feature build", () => {
  for (const fixture of PRE_FEATURE_DIGEST_SHA256) {
    const ledger = driveWithLedger(createDefenseRun(fixture.options), fixture.steps);
    const digest = getRunDigest(ledger.run);
    const snapshot = JSON.parse(digest);

    // Precondition, asserted rather than assumed: this window really is buff-free. Stated first
    // so a future balance change that starts spawning here fails as "precondition broke", not as
    // a mysterious digest mismatch.
    assert.equal(ledger.count("DROP_SPAWNED"), 0, `${fixture.label}: expected a drop-free window`);
    assert.equal(ledger.count("BUFF_APPLIED"), 0, `${fixture.label}: expected a buff-free window`);
    assert.equal(ledger.run.tick, fixture.steps, `${fixture.label}: window must run to completion`);

    // POSITIVE PAIR. `dropRng` advanced, so `rollBuffDrop` really executed for every death in
    // this window — the identity below is "the layer ran and changed nothing", not "the layer
    // was never reached". Without this line the whole test passes against an unwired feature.
    assert.notEqual(
      ledger.run.dropRng,
      createDefenseRun(fixture.options).dropRng,
      `${fixture.label}: dropRng must advance, otherwise no drop was ever rolled and this proves nothing`,
    );

    // The additive claim itself.
    assert.equal(sha256(digest), fixture.sha, `${fixture.label}: digest diverged from the pre-feature baseline`);

    // Absent, not empty: an empty `buffs: []` would still change the serialized bytes.
    assert.equal("buffs" in snapshot, false, `${fixture.label}: buffs must be absent, not empty`);
    assert.equal("buffStats" in snapshot, false, `${fixture.label}: buffStats must be absent, not empty`);
    assert.equal(snapshot.version, 7, `${fixture.label}: SNAPSHOT_VERSION must not bump`);
  }
});

test("gate check 1: two runs at one seed ticked identically with no buff produce string-equal digests, and a buffed run does not", () => {
  const options = { stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] };
  const left = driveWithLedger(createDefenseRun(options), 500);
  const right = driveWithLedger(createDefenseRun(options), 500);
  assert.equal(left.count("BUFF_APPLIED"), 0);
  assert.equal(getRunDigest(left.run), getRunDigest(right.run));

  // POSITIVE PAIR for the byte-identity above: the same comparison MUST fail once a buff is
  // live, otherwise `getRunDigest` is insensitive to buff state and check 1 is vacuous.
  const buffed = thawRun(left.run);
  buffed.buffs = [buffEntry("ember-edge", { buffId: "buff-1", expiresAtTick: buffed.tick + 600 })];
  const buffedSnapshot = JSON.parse(getRunDigest(buffed));
  assert.notEqual(getRunDigest(buffed), getRunDigest(left.run));
  assert.equal("buffs" in buffedSnapshot, true);
  assert.equal("buffStats" in buffedSnapshot, true);
  assert.deepEqual(buffedSnapshot.buffStats, { basicDamage: 1200 });
  assert.equal(buffedSnapshot.version, 7, "a buffed snapshot must still report version 7");
});

// ---------------------------------------------------------------------------------------------
// CHECK 2 — `run.rng` untouched
// ---------------------------------------------------------------------------------------------

/**
 * `run.rng` is the wave-schedule and growth-offer stream and every draw on it is POSITIONAL.
 * One extra `rngNext(run.rng)` anywhere in the drop path shifts every subsequent draw — wave
 * composition, timing jitter, lane offset, spawn direction, policy selection, growth-offer
 * contents — for every seed on every stage (§6.2, §10 risk 4).
 *
 * The literals are `run.rng` measured on the PRE-FEATURE module at `033877ad` after 3000 ticks:
 * that build is §9 check 2's "build with the drop block deleted". Each row spawns drops in the
 * current build, so the stream is compared across a boundary where drop rolls demonstrably ran.
 */
const PRE_FEATURE_RNG_AT_3000 = Object.freeze([
  { options: { stageId: "cinder-span", seed: 9, companionLoadout: [] }, rng: 745195808 },
  { options: { stageId: "cinder-span", seed: 3, companionLoadout: [] }, rng: 3066949719 },
  { options: { stageId: "abyss-chancel", seed: 5, companionLoadout: ["ember-cohort"] }, rng: 3688787054 },
]);

test("gate check 2: 3000 ticks of live drop rolls leave run.rng and the wave schedule exactly where the pre-feature build left them", () => {
  for (const fixture of PRE_FEATURE_RNG_AT_3000) {
    const created = createDefenseRun(fixture.options);
    const ledger = driveWithLedger(created, 3000);

    // POSITIVE PAIR, stated before the invariant: drops really spawned in this window. A run
    // where nothing dropped would satisfy every assertion below while proving nothing.
    assert.ok(ledger.count("DROP_SPAWNED") > 0, "expected at least one live drop in a 3000-tick window");
    assert.notEqual(ledger.run.dropRng, created.dropRng, "dropRng must have advanced");

    // The invariant: the wave stream is where the drop-free build left it, to the integer.
    assert.equal(ledger.run.rng, fixture.rng, `${fixture.options.stageId}/${fixture.options.seed}: run.rng moved`);
    // And the schedule those draws produced is untouched — built once at creation, never re-drawn.
    assert.deepEqual(ledger.run.waveVariant, created.waveVariant);
  }
});

test("gate check 2: forcing extra drop rolls inside one tick moves dropRng and leaves run.rng and waveVariant identical", () => {
  // Isolates the drop path to a single tick: two runs differing ONLY in how many deaths they
  // resolve. Anything the drop roll touches beyond `dropRng` shows up as an inequality here.
  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  const control = advanceDefenseRun(thawRun(seeded), 1);
  const rolled = advanceDefenseRun(withDeadBosses(seeded, 3), 1);

  // Growth offers consume `run.rng` through `makeOffer`, and the injected corpses grant XP. If a
  // future XP change pushes either run into an offer the comparison is meaningless, so make that
  // a loud precondition failure rather than a silent false negative.
  assert.equal(getRunSnapshot(control).growthOffer, null, "control must not be mid-growth-offer");
  assert.equal(getRunSnapshot(rolled).growthOffer, null, "rolled run must not be mid-growth-offer");

  // POSITIVE PAIR: the extra deaths really did roll, spawn, and advance the drop stream.
  const spawned = getRunSnapshot(rolled).events.filter((event) => event.type === "DROP_SPAWNED");
  assert.equal(spawned.length, 3, "each BOSS-grade death is a 10000bp certainty");
  assert.notEqual(rolled.dropRng, control.dropRng, "dropRng must diverge once extra rolls happen");

  // The invariant.
  assert.equal(rolled.rng, control.rng, "run.rng must be untouched by drop rolls");
  assert.deepEqual(rolled.waveVariant, control.waveVariant);
});

// ---------------------------------------------------------------------------------------------
// DRAW PROTOCOL — §6.3 invariants 1 and 2
// ---------------------------------------------------------------------------------------------

test("draw protocol: a denied drop advances dropRng exactly as far as a spawned one", () => {
  // §6.3 invariant 2 / §10 risk 5. The field-cap check must happen AFTER all three draws. Check
  // the cap first and the stream position starts depending on how many drops the player happened
  // to leave lying around — a state-dependent RNG position that survives casual play and dies in
  // replay. Same seed, same kill sequence, opposite field occupancy.
  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  const emptyField = advanceDefenseRun(withDeadBosses(seeded, 2), 1);
  const fullField = advanceDefenseRun(withFieldDrops(withDeadBosses(seeded, 2), MAX_FIELD_DROPS), 1);

  const emptyEvents = getRunSnapshot(emptyField).events;
  const fullEvents = getRunSnapshot(fullField).events;

  // POSITIVE PAIR: the two runs really did take opposite branches. Without this the assertion
  // below passes for two runs that both spawned, or both denied, or both did nothing.
  assert.equal(emptyEvents.filter((event) => event.type === "DROP_SPAWNED").length, 2);
  assert.equal(emptyEvents.filter((event) => event.type === "DROP_DENIED").length, 0);
  assert.equal(fullEvents.filter((event) => event.type === "DROP_SPAWNED").length, 0);
  assert.equal(fullEvents.filter((event) => event.type === "DROP_DENIED").length, 2);
  for (const denial of fullEvents.filter((event) => event.type === "DROP_DENIED")) {
    assert.equal(denial.reason, "FIELD_CAP");
  }

  // The invariant: identical stream position despite opposite outcomes.
  assert.equal(fullField.dropRng, emptyField.dropRng, "a denied drop must consume the same three draws as a spawned one");

  // And denial adds no actor: the cap held.
  assert.equal(getRunSnapshot(fullField).pickups.filter((pickup) => pickup.kind === "buff").length, MAX_FIELD_DROPS);
});

test("draw protocol: draw 1 is unconditional, so a failed roll advances dropRng as far as a successful roll's first draw", () => {
  // §6.3 invariant 1. Draw 1 fires for every death outside a measurement profile, whatever the
  // chance table says. The measurement exploits stream arithmetic instead of re-implementing
  // `rngNext`: three cinder-span BASIC deaths (600bp — every roll fails, one draw each) must land
  // the stream on the SAME position as one BOSS death (10000bp — roll succeeds, three draws).
  // Three advances either way. Make draw 1 conditional and the failing rolls consume nothing,
  // so the two positions diverge.
  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  const threeFailures = advanceDefenseRun(withDeadEnemies(seeded, 3), 1);
  const oneSuccess = advanceDefenseRun(withDeadBosses(seeded, 1), 1);

  // POSITIVE PAIR: the two runs really did take the branches the arithmetic assumes.
  const failureEvents = getRunSnapshot(threeFailures).events;
  assert.equal(failureEvents.filter((event) => event.type === "DROP_SPAWNED").length, 0, "all three BASIC rolls must fail");
  assert.equal(failureEvents.filter((event) => event.type === "DROP_DENIED").length, 0, "a failed chance roll is not a denial");
  assert.equal(getRunSnapshot(oneSuccess).events.filter((event) => event.type === "DROP_SPAWNED").length, 1);
  assert.notEqual(threeFailures.dropRng, seeded.dropRng, "three failed rolls must still advance the stream");

  // The invariant: 3 x draw-1 == 1 x (draw-1 + draw-2 + draw-3).
  assert.equal(threeFailures.dropRng, oneSuccess.dropRng, "draw 1 must fire unconditionally for every death");
});

// ---------------------------------------------------------------------------------------------
// CHECK 5 — no float serialized
// ---------------------------------------------------------------------------------------------

test("gate check 5: every numeric leaf the buff layer serializes is an integer, and the snapshot gains no new float", () => {
  // §10 risk 6 (`Math.round(0.9 * 10000)` is 9000.000000000002 unrounded) and risk 13 (bp
  // conversion of a float multiplier). Both put a float in the digest, which breaks byte-identity
  // across engines while every gameplay assertion still passes.
  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  const staged = thawRun(seeded);
  // One drop on the commander (collected this tick -> buffs + buffStats + BUFF_APPLIED), one far
  // away (survives -> a buff pickup with its own numeric fields stays in `pickups`).
  staged.pickups.push(buffDropAt(staged, "reaver-fervor", staged.commander.x, staged.commander.y));
  // `lantern-aegis` replaces the WITHDRAWN `bulwark-echo` here. This drop is never collected
  // (400,400 is far from the commander), so its stat never reaches `buffStats` and the
  // `{ basicDamage: 2500 }` assertion below is unaffected -- only its numeric leaves matter.
  staged.pickups.push({ ...buffDropAt(staged, "lantern-aegis", 400, 400), id: "zz-drop-far" });
  const collected = advanceDefenseRun(staged, 1);

  const snapshot = JSON.parse(getRunDigest(collected));
  const buffPickups = snapshot.pickups.filter((pickup) => pickup.kind === "buff");
  const buffEvents = snapshot.events.filter((event) => DROP_BUFF_EVENT_TYPES.includes(event.type));

  // POSITIVE PAIR: the structures under test are populated. A walk over `undefined` finds no
  // float and passes, which is exactly the null-implementation trap.
  assert.equal(snapshot.buffs.length, 1, "expected one active buff to walk");
  assert.deepEqual(snapshot.buffStats, { basicDamage: 2500 }, "expected a populated buffStats to walk");
  assert.equal(buffPickups.length, 1, "expected one uncollected buff drop to walk");
  assert.ok(buffEvents.length > 0, "expected at least one drop/buff event payload to walk");

  // Scoped assertion: every number the feature introduces is an integer.
  const featureRoots = [
    ["buffs", snapshot.buffs],
    ["buffStats", snapshot.buffStats],
    ["buffPickups", buffPickups],
    ["buffEvents", buffEvents],
  ];
  for (const [label, root] of featureRoots) {
    for (const leaf of numericLeaves(root, label)) {
      assert.equal(Number.isInteger(leaf.value), true, `${leaf.path} = ${leaf.value} is not an integer`);
    }
  }

  // Whole-snapshot assertion: the set of float-bearing paths is EXACTLY the pre-cycle-10 set.
  // Stronger than the scoped walk — it catches a float introduced anywhere, including into a
  // field the feature only reads.
  const floats = [...new Set(numericLeaves(snapshot).filter((leaf) => !Number.isInteger(leaf.value)).map((leaf) => stripIndices(leaf.path)))].sort();
  assert.deepEqual(floats, [...PRE_EXISTING_FLOAT_PATHS]);
});

// ---------------------------------------------------------------------------------------------
// CHECK 8 — base stats never mutated
// ---------------------------------------------------------------------------------------------

test("gate check 8: a full buff apply then timeout expiry leaves every base stat field untouched", () => {
  // §10 risk 3: an implementer who "simplifies" composition by writing into
  // `run.commander.basicDamage` reintroduces the permanent-grant bug this layer exists to avoid,
  // and it looks like it works. Composition happens at the read site; the base is never written.
  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  const baseline = {
    basicDamage: seeded.commander.basicDamage,
    pickupRange: seeded.commander.pickupRange,
    critChanceBp: seeded.commander.critProfile.chanceBp,
    cooldownScale: seeded.commander.cooldownScale,
    incomingDamageMultiplier: seeded.commander.incomingDamageMultiplier,
    gateMaxIntegrity: seeded.gate.maxIntegrity,
  };
  const readBases = (run) => ({
    basicDamage: run.commander.basicDamage,
    pickupRange: run.commander.pickupRange,
    critChanceBp: run.commander.critProfile.chanceBp,
    cooldownScale: run.commander.cooldownScale,
    incomingDamageMultiplier: run.commander.incomingDamageMultiplier,
    gateMaxIntegrity: run.gate.maxIntegrity,
  });

  // Collect for real, through `collectPickups` -> `applyBuff`.
  const staged = thawRun(seeded);
  staged.pickups.push(buffDropAt(staged, "ember-edge", staged.commander.x, staged.commander.y));
  const active = advanceDefenseRun(staged, 1);
  const activeSnapshot = getRunSnapshot(active);

  // POSITIVE PAIR: the buff is genuinely live and genuinely changing the composed read. Without
  // this, "base fields unchanged" is satisfied by a buff that was never applied.
  assert.equal(activeSnapshot.buffs.length, 1, "the drop must have been collected");
  assert.equal(activeSnapshot.buffs[0].itemId, "ember-edge");
  assert.equal(buffBp(active, "basicDamage"), 1200);
  assert.equal(effectiveBasicDamage(active), Math.trunc(baseline.basicDamage * 11200 / 10000));
  assert.notEqual(effectiveBasicDamage(active), baseline.basicDamage, "the composed read must differ while buffed");

  // Invariant, while active.
  assert.deepEqual(readBases(active), baseline, "no base stat may be written while a buff is active");

  // Run to the exact expiry tick. `expireBuffs` removes on `expiresAtTick <= run.tick`, so the
  // entry is present at `expiresAtTick - 1` and gone at `expiresAtTick`.
  const entry = activeSnapshot.buffs[0];
  const beforeExpiry = advanceWithOffers(active, entry.expiresAtTick - 1 - active.tick);
  assert.equal(beforeExpiry.tick, entry.expiresAtTick - 1, "must reach the tick before expiry without going terminal");
  assert.equal(getRunSnapshot(beforeExpiry).buffs.length, 1, "the buff must still be live one tick before expiry");

  const expired = advanceWithOffers(beforeExpiry, 1);
  const expiredSnapshot = getRunSnapshot(expired);

  // POSITIVE PAIR: expiry really happened, by timeout, exactly once.
  const timeouts = expiredSnapshot.events.filter((event) => event.type === "BUFF_EXPIRED");
  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0].reason, "TIMEOUT");
  assert.equal(timeouts[0].buffId, entry.buffId);
  assert.equal("buffs" in expiredSnapshot, false, "buffs must be absent again, not an empty array");
  assert.equal(buffBp(expired, "basicDamage"), 0);
  assert.equal(effectiveBasicDamage(expired), baseline.basicDamage, "the composed read must restore exactly");

  // Invariant, after expiry.
  assert.deepEqual(readBases(expired), baseline, "no base stat may be written across a full apply -> expire cycle");
});

// ---------------------------------------------------------------------------------------------
// CHECK 10a — identity guard on every accessor
// ---------------------------------------------------------------------------------------------

/**
 * Each row names an accessor, the ORIGINAL expression §3.2 records it as replacing, and a buff
 * that makes it move. `original` is evaluated against the same run, so the row compares the
 * accessor to the expression rather than to a hard-coded number that could drift from the
 * catalog.
 *
 * READ THIS BEFORE TRUSTING THE ROWS BELOW AS GUARD EVIDENCE (director R44). The spec and the
 * source comment both say the `bp === 0` short-circuits are "what makes byte-identity a proof
 * rather than a hope". Measured by perturbation, that is one step wider than the evidence: for
 * six of the seven accessors the guarded branch and the composed branch are ARITHMETICALLY
 * IDENTICAL at bp = 0 — `Math.trunc(x * 10000 / 10000) === x` for an integer x, and the crit
 * clamp is an identity inside its range. Deleting the guard from `effectiveBasicDamage` leaves
 * every check in this file green, verified.
 *
 * So these six rows are REGRESSION rows: they pin that an unbuffed read returns the base value
 * and that a buffed read composes correctly. They are not evidence that the guards are
 * load-bearing, and they cannot become that. The guards are still worth keeping — they document
 * intent and they stay correct if a base field ever becomes non-integer — but the byte-identity
 * proof rests on `getRunSnapshot` omitting `buffs`/`buffStats` entirely (check 1), not on them.
 *
 * The one accessor whose zero-buff behaviour is a real arithmetic obligation is
 * `effectiveCooldownScaleBp`, which has no guard at all; it is tested separately below.
 */
const ACCESSOR_IDENTITY_ROWS = Object.freeze([
  {
    name: "effectiveBasicDamage",
    accessor: (run) => effectiveBasicDamage(run),
    original: (run) => run.commander.basicDamage,
    buff: () => [buffEntry("ember-edge", { stacks: 2 })],
    buffed: (run) => Math.trunc(run.commander.basicDamage * 12400 / 10000),
  },
  {
    name: "effectiveGateMax",
    accessor: (run) => effectiveGateMax(run),
    original: (run) => run.gate.maxIntegrity,
    // Synthetic, not `buffEntry` -- the only `gateMaxIntegrity` item (`bulwark-echo`) was
    // WITHDRAWN from BUFF_ITEMS this cycle because the composed cap makes the published
    // snapshot report `gate.integrity > gate.maxIntegrity` (see the catalog comment).
    // `effectiveGateMax` itself is still live code behind 7 read sites, so it keeps its
    // coverage here; only the catalog dependency is cut. Arithmetic is unchanged: the
    // withdrawn item was magnitude 1000 x 2 stacks = +2000bp = x1.2.
    buff: () => [{
      buffId: "buff-synthetic-gate-max",
      itemId: "synthetic-gate-max",
      stat: "gateMaxIntegrity",
      magnitude: 1000,
      stacks: 2,
      appliedAtTick: 0,
      expiresAtTick: 1_000_000,
      sourceDropId: "drop-synthetic-gate-max",
    }],
    buffed: (run) => Math.trunc(run.gate.maxIntegrity * 12000 / 10000),
  },
  {
    name: "effectivePickupRange",
    accessor: (run) => effectivePickupRange(run),
    original: (run) => run.commander.pickupRange,
    buff: () => [buffEntry("reclaimer-pulse", { stacks: 2 })],
    buffed: (run) => Math.trunc(run.commander.pickupRange * 15000 / 10000),
  },
  {
    name: "effectiveCritChanceBp",
    accessor: (run) => effectiveCritChanceBp(run),
    original: (run) => run.commander.critProfile.chanceBp,
    buff: () => [buffEntry("throne-resonance")],
    buffed: (run) => run.commander.critProfile.chanceBp + 1500,
  },
  {
    name: "effectiveCooldownScaleBp",
    accessor: (run) => effectiveCooldownScaleBp(run),
    // The accessor returns basis points where the original read site multiplied by the raw float.
    original: (run) => Math.round(run.commander.cooldownScale * 10000),
    buff: () => [buffEntry("chancel-tempo")],
    buffed: (run) => Math.round(run.commander.cooldownScale * 10000) - 1500,
  },
  {
    name: "getCommanderSpeed",
    accessor: (run) => getCommanderSpeed(run),
    // No occupation capture at tick 1, so the multiplier the original expression used is 1.0.
    original: () => Math.trunc(COMMANDER.speed * 1.0),
    buff: () => [buffEntry("ash-stride", { stacks: 2 })],
    buffed: () => Math.trunc(Math.trunc(COMMANDER.speed * 1.0) * 12000 / 10000),
  },
]);

test("gate check 10a: with no buff active every accessor is Object.is-identical to the expression it replaced", () => {
  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  for (const row of ACCESSOR_IDENTITY_ROWS) {
    const unbuffed = thawRun(seeded);
    unbuffed.buffs = [];
    assert.equal(
      Object.is(row.accessor(unbuffed), row.original(unbuffed)),
      true,
      `${row.name}: with run.buffs = [] the accessor must return the original expression exactly`,
    );

    // POSITIVE PAIR, per row. Without it the whole table passes against an accessor hard-wired to
    // return its base field and ignore buffs entirely — which is precisely the bug the identity
    // assertion cannot see, because at bp = 0 both branches agree.
    const buffed = thawRun(seeded);
    buffed.buffs = row.buff();
    assert.equal(row.accessor(buffed), row.buffed(buffed), `${row.name}: composed value wrong while buffed`);
    assert.notEqual(row.accessor(buffed), row.original(buffed), `${row.name}: accessor ignored an active buff`);
  }
});

test("gate check 10a: applyIncomingDamage preserves the original rounding for every damage value, including a float multiplier", () => {
  // The seventh accessor, kept separate because its identity is a sweep and because it is the one
  // §10 risk 13 targets. `incomingDamageMultiplier` is a PRODUCT of floats, not an authored
  // constant: three vanguard companions give 0.95^3 = 0.857375, which is not representable in
  // four decimals. Converting the read site to `Math.trunc(d * bp / 10000)` also flips the
  // rounding mode. Both changes are invisible in an unbuffed integer fixture, so the sweep runs
  // against an injected float and proves the bp form would actually disagree.
  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  for (const multiplier of [1, 0.95, 0.95 ** 2, 0.95 ** 3]) {
    const run = thawRun(seeded);
    run.buffs = [];
    run.commander.incomingDamageMultiplier = multiplier;
    let bpFormDisagreements = 0;
    const bpForm = Math.round(multiplier * 10000);
    for (let damage = 1; damage <= 2000; damage += 1) {
      const original = Math.round(damage * multiplier);
      assert.equal(applyIncomingDamage(run, damage), original, `multiplier ${multiplier}, damage ${damage}`);
      if (Math.trunc(damage * bpForm / 10000) !== original) bpFormDisagreements += 1;
    }
    // POSITIVE PAIR: for every real (non-unit) multiplier the tempting bp conversion genuinely
    // disagrees, so the identity above is a live constraint rather than an arithmetic tautology.
    if (multiplier !== 1) {
      assert.ok(bpFormDisagreements > 0, `multiplier ${multiplier}: sweep must discriminate against the bp form`);
    }
  }

  // And the buffed branch still composes off the ALREADY-ROUNDED base.
  const buffed = thawRun(seeded);
  buffed.buffs = [buffEntry("lantern-aegis")];
  assert.equal(buffBp(buffed, "incomingDamageBp"), -2000);
  assert.equal(applyIncomingDamage(buffed, 100), Math.max(0, Math.trunc(Math.round(100 * buffed.commander.incomingDamageMultiplier) * 8000 / 10000)));
  assert.notEqual(applyIncomingDamage(buffed, 100), Math.round(100 * buffed.commander.incomingDamageMultiplier));
});

test("gate check 10a: effectiveCooldownScaleBp returns integer basis points for every scale its write paths can produce", () => {
  // `effectiveCooldownScaleBp` is the one accessor with NO `bp === 0` short-circuit, so unlike the
  // six guarded rows above its behaviour at zero buff is real arithmetic rather than a branch.
  //
  // CORRECTION TO THE SPEC AND TO THE SOURCE COMMENT. §3.2 and the comment on the accessor both
  // justify `Math.round(scale * 10000)` with "`0.9 * 10000` is `9000.000000000002`". That is
  // FALSE: `0.9 * 10000` is exactly 9000 in IEEE-754, verified below so the claim cannot rot back
  // in. The dust does not come from the multiply — it comes from ACCUMULATED SUBTRACTION in the
  // four write paths, each of them `clamp(cooldownScale - reduction, floor, 1)`.
  //
  // Measured reachability: across every shipped `companionLoadout` (singles and triples) x
  // `stillwater-hourglass` x all three stages, run creation produces exactly {1, 0.8}, and both
  // are exact. `COMPANION_ROLES.support`'s 0.05 is not loadout-reachable (its members are not
  // `COMPANIONS` keys) and `hourglass-fragment` is not in `STAGE_ITEM_IDS`, so `applyItem`'s 0.1
  // is not reachable in play either. The round is therefore DEFENSIVE TODAY: no currently
  // reachable configuration produces a value where removing it changes a cooldown.
  //
  // So this test does not pretend the round is load-bearing for cooldown VALUES. It asserts the
  // property that is genuinely load-bearing and genuinely fails without the round: the accessor
  // feeds `Math.trunc(ticks * bp / 10000)` and must hand that expression an INTEGER. Delete the
  // round and 20 of the 35 scales the write paths can produce return a float — verified by
  // perturbation. One more reduction constant, or one more subtraction in a write path, turns
  // that from defensive into reachable without anyone editing this accessor.
  assert.equal(0.9 * 10000, 9000, "the spec's stated justification for Math.round is false; do not restore it");
  assert.equal(Number.isInteger(0.9 * 10000), true);

  const seeded = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 1);
  const clampScale = (value, floor) => Math.min(Math.max(value, floor), 1);

  // Every reduction the live catalogs can subtract from `cooldownScale`, read from the catalogs so
  // a new reduction widens this sweep automatically instead of silently escaping it.
  const reductions = [...new Set([
    ...Object.values(ITEMS).map((item) => item.cooldownReduction),
    ...Object.values(REWARDS).map((reward) => reward.cooldownReduction),
    COMPANION_ROLES.support?.commanderCooldownReduction,
  ].filter((value) => typeof value === "number" && value > 0))];
  assert.ok(reductions.length >= 2, "expected the catalogs to publish cooldown reductions to sweep");

  // Close the reduction set over the two clamp floors the four write paths use (0.4 and 0.5),
  // reproducing the shipped expression rather than hand-typing decimal literals — typing clean
  // literals is exactly what made an earlier revision of this test unable to fail.
  const producible = new Set([1]);
  let frontier = [1];
  for (let depth = 0; depth < 4; depth += 1) {
    const next = [];
    for (const scale of frontier) {
      for (const reduction of reductions) {
        for (const floor of [0.4, 0.5]) {
          const value = clampScale(scale - reduction, floor);
          if (!producible.has(value)) { producible.add(value); next.push(value); }
        }
      }
    }
    frontier = next;
  }

  // POSITIVE PAIR: the sweep really does contain values carrying floating-point dust, so the
  // integer assertion below has something to catch. Without this the sweep could silently narrow
  // to exact values and go quiet.
  const dusty = [...producible].filter((scale) => !Number.isInteger(scale * 10000));
  assert.ok(dusty.length > 0, "the sweep must include scales whose *10000 is not an integer");

  for (const scale of producible) {
    const run = thawRun(seeded);
    run.buffs = [];
    run.commander.cooldownScale = scale;
    const bp = effectiveCooldownScaleBp(run);
    // The load-bearing assertion. Fails for 20 of these scales if the `Math.round` is removed.
    assert.equal(Number.isInteger(bp), true, `scale ${scale}: accessor must return integer basis points, got ${bp}`);
    assert.equal(bp, Math.round(scale * 10000), `scale ${scale}: accessor must report exact basis points`);
  }

  // Regression row, labelled as such: for every scale a run can actually START at, the composed
  // call-site expression is identical to the pre-feature one. This does not evidence the round —
  // it pins that the bp refactor did not move a shipped cooldown.
  const reachableAtCreation = new Set();
  for (const rewardIds of [[], ["stillwater-hourglass"]]) {
    for (const stageId of STAGES.map((stage) => stage.id)) {
      reachableAtCreation.add(createDefenseRun({ stageId, seed: 71, companionLoadout: FULL_LOADOUT, rewardIds }).commander.cooldownScale);
      reachableAtCreation.add(createDefenseRun({ stageId, seed: 71, companionLoadout: [], rewardIds }).commander.cooldownScale);
    }
  }
  const authoredCooldowns = Object.values(SKILLS).map((skill) => skill.cooldown).filter((value) => Number.isInteger(value));
  assert.ok(authoredCooldowns.length > 0, "expected authored skill cooldowns to sweep");
  const maxCooldown = Math.max(...authoredCooldowns);
  for (const scale of reachableAtCreation) {
    const run = thawRun(seeded);
    run.buffs = [];
    run.commander.cooldownScale = scale;
    const bp = effectiveCooldownScaleBp(run);
    for (let ticks = 1; ticks <= maxCooldown * 2; ticks += 1) {
      assert.equal(
        Math.max(1, Math.trunc(ticks * bp / 10000)),
        Math.max(1, Math.trunc(ticks * scale)),
        `scale ${scale}, cooldown ${ticks}: composed cooldown diverged from the original expression`,
      );
    }
  }

  // POSITIVE PAIR: a cooldown buff must actually move the result, and clamp at the negative cap.
  const buffed = thawRun(seeded);
  buffed.commander.cooldownScale = 1;
  buffed.buffs = [buffEntry("chancel-tempo"), buffEntry("cinder-haste", { stacks: 2 })];
  assert.equal(buffBp(buffed, "cooldownScaleBp"), BUFF_STAT_OPS.cooldownScaleBp.capBp, "-1500 + -1600 must clamp to the -3000 cap");
  assert.equal(effectiveCooldownScaleBp(buffed), 7000);
  assert.notEqual(effectiveCooldownScaleBp(buffed), 10000, "a cooldown buff must move the composed basis points");
});

// ---------------------------------------------------------------------------------------------
// CHECK 17 — measurement isolation
// ---------------------------------------------------------------------------------------------

test("gate check 17: a measurement-profile run consumes zero drop draws and emits no drop or buff event", () => {
  // §6.3 invariant 3. A fixture run must be bit-identical to its signed tuple, so the drop roll
  // is skipped entirely rather than rolled and discarded — a discarded roll still moves the
  // stream, which would make every fixture depend on kill count.
  const options = { stageId: "cinder-span", seed: 71, measurementProfileId: "striker" };
  const created = createDefenseRun(options);
  assert.equal(created.measurementProfileId, "striker");
  const ledger = driveWithLedger(created, 2000);

  // POSITIVE PAIR: enemies really died inside the window, so the guard was actually reached.
  // Without this the test passes on a run where `resolveDeaths` never fired.
  assert.ok(ledger.count("ENEMY_DEFEATED") > 0, "the measurement window must contain real deaths");
  assert.equal(ledger.run.tick, 2000);

  // The invariant: zero draws consumed, no buff state, none of the seven event types.
  assert.equal(ledger.run.dropRng, created.dropRng, "dropRng must be untouched for the whole fixture run");
  assert.deepEqual(ledger.run.buffs, []);
  assert.equal("buffs" in JSON.parse(getRunDigest(ledger.run)), false);
  for (const type of DROP_BUFF_EVENT_TYPES) {
    assert.equal(ledger.count(type), 0, `${type} must never be emitted inside a measurement profile`);
  }
});

test("gate check 17: the identical kill sequence outside a measurement profile does roll, spawn, and advance dropRng", () => {
  // The discriminating half of check 17. The assertions above are all absences and pass against
  // a drop layer that was never wired up; this proves the same code path is live and productive
  // the moment the profile is removed, so the isolation above is a guard and not an accident.
  const base = { stageId: "cinder-span", seed: 71 };
  const measured = advanceDefenseRun(createDefenseRun({ ...base, measurementProfileId: "striker" }), 1);
  const ordinary = advanceDefenseRun(createDefenseRun(base), 1);

  const measuredAfter = advanceDefenseRun(withDeadBosses(measured, 2), 1);
  const ordinaryAfter = advanceDefenseRun(withDeadBosses(ordinary, 2), 1);

  assert.equal(measuredAfter.dropRng, measured.dropRng, "a measurement profile must consume zero draws even on a guaranteed roll");
  assert.equal(getRunSnapshot(measuredAfter).events.filter((event) => DROP_BUFF_EVENT_TYPES.includes(event.type)).length, 0);

  assert.notEqual(ordinaryAfter.dropRng, ordinary.dropRng, "an ordinary run must advance the drop stream");
  assert.equal(getRunSnapshot(ordinaryAfter).events.filter((event) => event.type === "DROP_SPAWNED").length, 2);
});
