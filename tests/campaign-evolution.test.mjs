import assert from "node:assert/strict";
import test from "node:test";

import {
  SUMMON_RECIPES,
  applyAction,
  createCampaign,
  createSaveEnvelope,
  evolveSummon,
  getSummonEvolutionBenefits,
  restoreSaveEnvelope,
  startCampaign,
} from "../campaign-state.js";

function accepted(result, label) {
  assert.equal(result.accepted, true, label ?? result.message);
  return result.state;
}

function start() {
  return accepted(startCampaign(createCampaign()), "a fresh campaign should start");
}

function action(state, name) {
  return accepted(applyAction(state, name), `the ${name} action should be accepted`);
}

function extract(state) {
  state = action(state, "hunt");
  state = action(state, "hunt");
  return action(state, "extract");
}

function stateWithExtracts(count) {
  let state = start();
  for (let index = 0; index < count; index += 1) state = extract(state);
  return state;
}

function snapshot(value) {
  return JSON.stringify(value);
}

function assertRejectedWithoutMutation(state, transition, expectedMessage) {
  const before = snapshot(state);
  const result = transition();
  assert.equal(result.accepted, false, "the invalid transition must reject");
  assert.equal(result.state, state, "a rejected transition must return the supplied state");
  assert.equal(snapshot(state), before, "a rejected transition must not mutate campaign resources or trace");
  if (expectedMessage) assert.match(result.message, expectedMessage);
}

test("fresh campaigns expose empty summon progression through the public helper", () => {
  const state = createCampaign();

  assert.deepEqual(getSummonEvolutionBenefits(state), {
    essence: 0,
    levels: {},
    materializeBonus: 0,
    assaultDamageBonus: 0,
    counterReduction: 0,
  });
  assert.equal(state.progression.summons.essence, 0);
  assert.deepEqual(state.progression.summons.levels, {});
});

test("two hunts and an extract grant two essence while preserving the four-soul extract", () => {
  const state = extract(start());

  assert.equal(state.stage.souls, 4, "extract must keep the existing four-soul reward");
  assert.equal(state.progression.summons.essence, 2, "each extract grants exactly two summon essence");
  assert.equal(state.stage.hunted, 0, "extraction resets the hunted spoor counter");
  assert.equal(state.stage.extracted, true, "the extracted cache remains observable on the stage state");
});

test("summon evolution enforces exact costs, unknown recipes, and maximum levels immutably", () => {
  const recipe = SUMMON_RECIPES[0];
  const insufficient = stateWithExtracts(1);
  assert.equal(insufficient.progression.summons.essence, recipe.essenceCosts[0] - 2);
  assertRejectedWithoutMutation(
    insufficient,
    () => evolveSummon(insufficient, recipe.id),
    /Not enough summon essence/,
  );

  const unknown = stateWithExtracts(2);
  assertRejectedWithoutMutation(
    unknown,
    () => evolveSummon(unknown, "not-a-real-summon"),
    /summon recipe does not exist/,
  );

  const exactCost = stateWithExtracts(2);
  assert.equal(exactCost.progression.summons.essence, recipe.essenceCosts[0]);
  const evolved = accepted(applyAction(exactCost, "evolve-summon", recipe.id), "exact essence cost should evolve level one");
  assert.equal(evolved.progression.summons.essence, 0, "level-one evolution consumes the exact available cost");
  assert.equal(evolved.progression.summons.levels[recipe.id], 1);
  assert.equal(exactCost.progression.summons.essence, recipe.essenceCosts[0], "accepted transitions must not mutate their input");

  let maxed = stateWithExtracts(recipe.essenceCosts.reduce((sum, cost) => sum + cost, 0) / 2);
  for (let level = 0; level < recipe.maxLevel; level += 1) {
    maxed = accepted(evolveSummon(maxed, recipe.id), `level ${level + 1} should accept its level-specific cost`);
  }
  assert.equal(maxed.progression.summons.levels[recipe.id], recipe.maxLevel);
  assert.equal(maxed.progression.summons.essence, 0);
  assertRejectedWithoutMutation(
    maxed,
    () => evolveSummon(maxed, recipe.id),
    /already at maximum evolution/,
  );
});

test("evolution benefits are public and add to materialization", () => {
  const recipe = SUMMON_RECIPES.find(({ benefits }) => benefits[0].materializeBonus !== undefined);
  assert.ok(recipe, "the public recipe catalog must expose a materialization evolution");

  const evolved = accepted(evolveSummon(stateWithExtracts(2), recipe.id));
  assert.deepEqual(getSummonEvolutionBenefits(evolved), {
    essence: 0,
    levels: { [recipe.id]: 1 },
    materializeBonus: recipe.benefits[0].materializeBonus,
    assaultDamageBonus: 0,
    counterReduction: 0,
  });

  const materialized = action(evolved, "materialize");
  assert.equal(materialized.stage.legion, 2 + recipe.benefits[0].materializeBonus, "materialize applies the additive summon benefit");
  assert.equal(materialized.stage.souls, 6, "evolution does not alter materialization's soul cost");
});

test("save envelopes replay evolved campaign state byte-for-byte", () => {
  const recipe = SUMMON_RECIPES[0];
  const evolved = accepted(evolveSummon(stateWithExtracts(2), recipe.id));
  const envelope = createSaveEnvelope(evolved);
  const restored = restoreSaveEnvelope(envelope);

  assert.equal(snapshot(restored), snapshot(evolved), "restore must reproduce the evolved state byte-for-byte");
  assert.equal(snapshot(createSaveEnvelope(restored)), snapshot(envelope), "re-saving a restored state must preserve the replay envelope bytes");
});

test("restore normalizes a legacy trace whose progression has no summons branch", () => {
  const legacyState = start();
  const legacyStateWithoutSummons = JSON.parse(JSON.stringify(legacyState));
  delete legacyStateWithoutSummons.progression.summons;

  const envelope = createSaveEnvelope(legacyStateWithoutSummons);
  const restored = restoreSaveEnvelope(envelope);

  assert.deepEqual(restored.progression.summons, { essence: 0, levels: {} });
  assert.deepEqual(getSummonEvolutionBenefits(restored), {
    essence: 0,
    levels: {},
    materializeBonus: 0,
    assaultDamageBonus: 0,
    counterReduction: 0,
  });
  assert.equal(restored.status, "active", "legacy replay must preserve the started campaign status");
  assert.deepEqual(restored.trace, legacyState.trace, "legacy replay must preserve the original event trace");
});
