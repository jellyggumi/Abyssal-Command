import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMANDER,
  CINDER_SPAN_SURPRISE_TABLE,
  STAGE_BY_ID,
} from "../defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
} from "../defense-run-simulation.js";

const STAGE_ID = "cinder-span";
const STAGE = STAGE_BY_ID[STAGE_ID];
const MAX_CRITICAL_SEEDS = 16;
const MAX_CRITICAL_TICKS = 600;

function advanceCollectingEvents(run, steps) {
  let next = run;
  const events = [];
  for (let step = 0; step < steps; step += 1) {
    next = advanceDefenseRun(next, 1);
    const snapshot = getRunSnapshot(next);
    events.push(...snapshot.events);
    if (snapshot.terminal) break;
  }
  return { run: next, snapshot: getRunSnapshot(next), events };
}

function authoredWaveSelections(seed) {
  const maximumJitter = STAGE.tactics.seededVariation.timingJitterTicks;
  const lastSlotTick = Math.max(...STAGE.wavePlan.map(({ tick }) => tick));
  const { events } = advanceCollectingEvents(
    createDefenseRun({ stageId: STAGE_ID, seed }),
    lastSlotTick + maximumJitter + 1,
  );
  return events.filter(({ type }) => type === "WAVE_VARIANT_STARTED");
}

function assertAuthoredWaveSelections(selections) {
  assert.equal(
    selections.length,
    STAGE.wavePlan.length,
    "each Cinder Span wave-plan slot must start exactly once",
  );

  assert.deepEqual(
    selections.map(({ slot }) => slot),
    STAGE.wavePlan.map(({ slot }) => slot),
    "the run must cover every authored wave-plan slot in slot order",
  );

  for (const selection of selections) {
    const slot = STAGE.wavePlan.find(({ slot: authoredSlot }) => authoredSlot === selection.slot);
    assert.ok(slot, `selection ${selection.alternativeId} must identify an authored slot`);

    const alternative = slot.alternatives.find(({ id }) => id === selection.alternativeId);
    assert.ok(
      alternative,
      `slot ${slot.slot} must select one of its authored alternatives, not a generated composition`,
    );
    assert.deepEqual(
      selection.composition,
      alternative.composition,
      `slot ${slot.slot} must spawn the selected alternative's exact authored composition`,
    );
  }
}

function normalizedWaveSelections(selections) {
  return selections.map(({ slot, alternativeId, composition }) => ({ slot, alternativeId, composition }));
}

function findCriticalDamage() {
  for (let seed = 1; seed <= MAX_CRITICAL_SEEDS; seed += 1) {
    const run = createDefenseRun({ stageId: STAGE_ID, seed });
    const result = advanceCollectingEvents(run, MAX_CRITICAL_TICKS);
    const event = result.events.find(({ type }) => type === "CRITICAL_HIT");
    if (event) return { seed, event };
  }
  return null;
}

test("Cinder Span selects one authored alternative for every wave slot and replays it by seed", () => {
  const seed = 17;
  const replay = authoredWaveSelections(seed);
  const sameSeedReplay = authoredWaveSelections(seed);
  const anotherSeed = authoredWaveSelections(18);

  assertAuthoredWaveSelections(replay);
  assert.deepEqual(replay, sameSeedReplay, "the same seed must replay every selected authored alternative");
  assertAuthoredWaveSelections(anotherSeed);
  assert.notDeepEqual(
    normalizedWaveSelections(replay),
    normalizedWaveSelections(anotherSeed),
    "fixed seeds 17 and 18 must prove that selection can vary without leaving the authored catalog",
  );
});

test("Cinder Span critical damage exposes its source and authored chance and multiplier semantics", () => {
  const found = findCriticalDamage();
  assert.ok(
    found,
    `one of the fixed seeds 1-${MAX_CRITICAL_SEEDS} must produce an observable Cinder Span critical`,
  );

  const { seed, event } = found;
  const replay = advanceCollectingEvents(
    createDefenseRun({ stageId: STAGE_ID, seed }),
    MAX_CRITICAL_TICKS,
  ).events.find(({ type }) => type === "CRITICAL_HIT");

  assert.deepEqual(event, replay, "a seed must replay the same critical resolution event");
  assert.equal(event.entityId, "commander", "the event must attribute the combat source");
  assert.ok(
    COMMANDER.critProfile.sources.includes(event.source),
    "only authored critical-capable damage sources may resolve as critical",
  );
  assert.ok(event.baseDamage > 0, "the event must retain the pre-critical damage");
  assert.equal(event.chanceBp, COMMANDER.critProfile.chanceBp);
  assert.equal(event.multiplierBp, COMMANDER.critProfile.multiplierBp);
  assert.equal(
    event.damage,
    Math.trunc(event.baseDamage * COMMANDER.critProfile.multiplierBp / 10_000),
    "the observable final damage must apply the configured critical multiplier to base damage",
  );
});

test("Cinder Span lore surprise is a deterministic, non-combat event", () => {
  const seed = 23;
  const first = getRunSnapshot(createDefenseRun({ stageId: STAGE_ID, seed }));
  const replay = getRunSnapshot(createDefenseRun({ stageId: STAGE_ID, seed }));
  const surprise = first.events.find(({ type }) => type === "LORE_SURPRISE_RESOLVED");
  const replaySurprise = replay.events.find(({ type }) => type === "LORE_SURPRISE_RESOLVED");

  assert.ok(surprise, "Cinder Span must resolve its seeded lore surprise as a public event");
  assert.deepEqual(surprise, replaySurprise, "the lore surprise outcome must replay from the run seed");
  assert.equal(surprise.tableId, CINDER_SPAN_SURPRISE_TABLE.id);
  assert.deepEqual(first.loreSurprise, surprise, "the resolved surprise must be visible in the public snapshot");
  assert.ok(Number.isInteger(surprise.rollBp) && surprise.rollBp >= 0 && surprise.rollBp < 10_000);
  const outcome = CINDER_SPAN_SURPRISE_TABLE.outcomes.find(({ id }) => id === surprise.outcomeId);
  if (outcome) {
    assert.ok(
      surprise.rollBp < CINDER_SPAN_SURPRISE_TABLE.chanceBp,
      "only a successful authored chance roll may select a lore outcome",
    );
    assert.equal(surprise.text, outcome.text, "the event must expose the authored lore text");
  } else {
    assert.equal(surprise.outcomeId, null, "a missed surprise roll must not fabricate an outcome");
    assert.equal(surprise.text, null, "a missed surprise roll must not fabricate lore text");
    assert.ok(
      surprise.rollBp >= CINDER_SPAN_SURPRISE_TABLE.chanceBp,
      "a non-selected lore outcome must represent a failed authored chance roll",
    );
  }

  assert.equal(first.commander.integrity, first.commander.maxIntegrity, "lore may not damage the commander");
  assert.equal(first.gate.integrity, first.gate.maxIntegrity, "lore may not damage the gate");
  assert.deepEqual(first.enemies, [], "lore may not spawn enemies");
  assert.deepEqual(first.projectiles, [], "lore may not spawn combat projectiles");
  assert.equal(first.rewardOffer, null, "lore may not create reward choices");
  assert.deepEqual(first.waveVariant, replay.waveVariant, "lore resolution may not alter the seeded wave schedule");
});
