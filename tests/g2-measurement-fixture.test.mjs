import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";
import {
  QA_MULTI_SKILL_MEASUREMENT_FIXTURE,
  QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID,
} from "../defense-catalog.js";

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

function traceM4Decisions(decisions) {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 71 });
  let snapshot = getRunSnapshot(run);
  const events = [...snapshot.events.filter((event) => event.type.startsWith("M4_"))];

  for (const payload of decisions) {
    run = advanceDefenseRun(queueInput(run, "M4_CARD_DECISION", payload), 1);
    snapshot = getRunSnapshot(run);
    events.push(...snapshot.events.filter((event) => event.type.startsWith("M4_")));
  }

  return { run, snapshot, events };
}

function advanceUntilM4Recovery(run, maxSteps = 12000) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next), 1);
    const snapshot = getRunSnapshot(next);
    if (snapshot.m4.status === "RECOVERED") return snapshot;
  }
  assert.fail("the authored route must reach the committed M4 recovery checkpoint");
}

test("a run commits an immutable plan identity before its first tick", () => {
  const initialRun = createDefenseRun({ stageId: "cinder-span", seed: 71 });
  const initial = getRunSnapshot(initialRun);
  const advanced = getRunSnapshot(advanceDefenseRun(queueInput(initialRun, "MOVE", { octant: "IDLE" }), 1));
  const start = initial.events.find((event) => event.type === "STAGE_STARTED");

  assert.equal(initial.tick, 0);
  assert.equal(Object.isFrozen(initial.plan), true);
  assert.ok(initial.plan.identity);
  assert.ok(initial.plan.mapPlanId);
  assert.ok(initial.plan.wavePlanId);
  assert.ok(initial.plan.m4PlanId);
  assert.equal(start.planIdentity, initial.plan.identity);
  assert.equal(start.mapPlanId, initial.plan.mapPlanId);
  assert.equal(start.wavePlanId, initial.plan.wavePlanId);
  assert.equal(start.m4PlanId, initial.plan.m4PlanId);
  assert.throws(() => { initial.plan.identity = "replacement"; }, TypeError);
  assert.deepEqual(advanced.plan, initial.plan);
});

test("M4 selected and declined paths retain deterministic committed-card traces through recovery and exhaustion", () => {
  const setup = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: 71 }));
  const [firstCardId, secondCardId] = setup.m4.inventory;
  const selected = traceM4Decisions([{ cardId: firstCardId, decision: "SELECT" }]);
  const declined = traceM4Decisions([
    { cardId: firstCardId, decision: "DECLINE" },
    { cardId: secondCardId, decision: "DECLINE" },
    { cardId: secondCardId, decision: "DECLINE" },
  ]);
  const repeatedDeclined = traceM4Decisions([
    { cardId: firstCardId, decision: "DECLINE" },
    { cardId: secondCardId, decision: "DECLINE" },
    { cardId: secondCardId, decision: "DECLINE" },
  ]);
  const recovered = advanceUntilM4Recovery(selected.run);
  const selectedEvent = selected.events.find((event) => event.type === "M4_CARD_SELECTED");
  const recoveryEvent = recovered.events.find((event) => event.type === "M4_RECOVERY_CHECKPOINT");
  const declinedTypes = declined.events.map((event) => event.type);

  assert.equal(selected.snapshot.m4.status, "RECOVERY_PENDING");
  assert.equal(selected.snapshot.m4.selectedCardId, firstCardId);
  assert.equal(selectedEvent.cardId, firstCardId);
  assert.equal(selectedEvent.m4PlanId, setup.plan.m4PlanId);
  assert.deepEqual(declinedTypes, [
    "M4_CARD_AVAILABLE",
    "M4_CARD_DECLINED",
    "M4_CARD_AVAILABLE",
    "M4_FALLBACK",
    "M4_CARD_REJECTED",
  ]);
  assert.equal(declined.snapshot.m4.status, "FALLBACK");
  assert.equal(declined.events.at(-2).fallbackId, "cinder-span-fallback");
  assert.equal(declined.events.at(-1).reason, "M4_CARD_INVENTORY_EXHAUSTED");
  assert.deepEqual(
    declined.events.map(({ eventId, eventSequence, tick, type, cardId, nextCardId, m4PlanId, fallbackId, reason }) => ({
      eventId, eventSequence, tick, type, cardId, nextCardId, m4PlanId, fallbackId, reason,
    })),
    repeatedDeclined.events.map(({ eventId, eventSequence, tick, type, cardId, nextCardId, m4PlanId, fallbackId, reason }) => ({
      eventId, eventSequence, tick, type, cardId, nextCardId, m4PlanId, fallbackId, reason,
    })),
  );
  assert.equal(recovered.m4.status, "RECOVERED");
  assert.ok(recoveryEvent, "recovery must emit its committed checkpoint observation");
  assert.equal(recoveryEvent.cardId, firstCardId);
  assert.equal(recoveryEvent.m4PlanId, setup.plan.m4PlanId);
  assert.equal(recoveryEvent.objectiveId, "occupation");

  for (const event of [...selected.events, ...declined.events, ...recovered.events]) {
    assert.equal(event.eventId, `${setup.plan.identity}:event:${event.eventSequence}`);
  }
});

test("M4 decline-then-select retains the exact committed-card trace", () => {
  const setup = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: 71 }));
  const [firstCardId, secondCardId] = setup.m4.inventory;
  const traced = traceM4Decisions([
    { cardId: firstCardId, decision: "DECLINE" },
    { cardId: secondCardId, decision: "SELECT" },
  ]);

  assert.equal(traced.snapshot.m4.status, "RECOVERY_PENDING");
  assert.equal(traced.snapshot.m4.selectedCardId, secondCardId);
  assert.deepEqual(traced.events.map(({ type, cardId, nextCardId, m4PlanId }) => ({
    type, cardId, nextCardId: nextCardId ?? null, m4PlanId,
  })), [
    { type: "M4_CARD_AVAILABLE", cardId: firstCardId, nextCardId: null, m4PlanId: setup.plan.m4PlanId },
    { type: "M4_CARD_DECLINED", cardId: firstCardId, nextCardId: secondCardId, m4PlanId: setup.plan.m4PlanId },
    { type: "M4_CARD_AVAILABLE", cardId: secondCardId, nextCardId: null, m4PlanId: setup.plan.m4PlanId },
    { type: "M4_CARD_SELECTED", cardId: secondCardId, nextCardId: null, m4PlanId: setup.plan.m4PlanId },
  ]);
});

test("M3 loss and reacquisition probes retain public transitions and actual dispositions", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 71 });
  run = advanceDefenseRun(queueInput(run, "M3_TARGET_PROBE", { phase: "LOSS", probeId: "test-m3" }), 1);
  const loss = getRunSnapshot(run);
  run = advanceDefenseRun(queueInput(run, "M3_TARGET_PROBE", { phase: "REACQUIRE", probeId: "test-m3" }), 1);
  const reacquired = getRunSnapshot(run);
  const transitions = [...loss.events, ...reacquired.events].filter(({ type }) => ["M3_TARGET_LOSS", "M3_TARGET_REACQUIRED"].includes(type));
  const dispositions = [...loss.events, ...reacquired.events].filter(({ type }) => type === "INPUT_ACCEPTED" || type === "INPUT_REJECTED");

  assert.deepEqual([...new Set(transitions.map(({ type }) => type))].sort(), ["M3_TARGET_LOSS", "M3_TARGET_REACQUIRED"]);
  assert.ok(transitions.every(({ probeId, targetAvailable }) => probeId === "test-m3" && typeof targetAvailable === "boolean"));
  assert.ok(dispositions.some(({ inputType }) => inputType === "M3_TARGET_PROBE"));
});

test("the QA-only fixture exposes exactly two distinct active skills without player setup leakage", () => {
  const qa = getRunSnapshot(createDefenseRun({
    stageId: "cinder-span",
    seed: 71,
    companionLoadout: FULL_LOADOUT,
    rewardIds: FULL_REWARDS,
    measurementProfileId: QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID,
  }));
  const standard = getRunSnapshot(createDefenseRun({
    stageId: "cinder-span",
    seed: 71,
    measurementProfileId: "striker",
  }));

  assert.equal(QA_MULTI_SKILL_MEASUREMENT_FIXTURE.qaOnly, true);
  assert.equal(qa.measurementProfileId, QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID);
  assert.deepEqual(qa.commander.skills, QA_MULTI_SKILL_MEASUREMENT_FIXTURE.activeSkillIds);
  assert.equal(new Set(qa.commander.skills).size, 2);
  assert.deepEqual(
    qa.commander.cooldowns,
    Object.fromEntries(QA_MULTI_SKILL_MEASUREMENT_FIXTURE.activeSkillIds.map((skillId) => [skillId, 0])),
  );
  assert.deepEqual(qa.companions, []);
  assert.deepEqual(qa.itemIds, []);
  assert.deepEqual(qa.rewardIds, []);
  assert.deepEqual(standard.commander.skills, ["soul-lance"]);
  assert.equal(standard.commander.skills.includes("grave-pulse"), false);
});
