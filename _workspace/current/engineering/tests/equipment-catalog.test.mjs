import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEquipmentStats,
  equipmentByCategory,
  equipmentById,
  equipmentBySlot,
} from "../equipment-database.js";

const ZERO_STATS = {
  attack: 0,
  defense: 0,
  hp: 0,
  speed: 0,
  critChanceBp: 0,
  critMultiplierBp: 0,
  range: 0,
};


test("calculateEquipmentStats keeps critical multiplier non-additive while preserving additive crit chance and attack", () => {
  const loadout = ["sovereign-edge", "abyss-gauntlets", "shadow-ring"].map((id) => {
    return equipmentById(id);
  });

  const result = calculateEquipmentStats(loadout);

  assert.equal(result.stats.attack, 345);
  assert.equal(result.stats.critChanceBp, 1100);
  assert.equal(result.stats.critMultiplierBp, 20000);
  assert.equal(result.traitEffects.critChanceBp, 600);
});

test("set bonuses activate at each threshold count", () => {
  const twoPieceShadowSet = ["shadow-helm", "shadow-plate"].map((id) => {
    return equipmentById(id);
  });
  const threePieceShadowSet = ["shadow-helm", "shadow-plate", "shadow-ring"].map((id) => {
    return equipmentById(id);
  });

  const twoSetResult = calculateEquipmentStats(twoPieceShadowSet);
  const twoSetBonuses = twoSetResult.activeSets["shadow-set"].bonuses;

  assert.equal(twoSetResult.activeSets["shadow-set"].count, 2);
  assert.equal(twoSetBonuses.damagePct, 10);
  assert.equal(twoSetBonuses.shadowAoe, undefined);

  const threeSetResult = calculateEquipmentStats(threePieceShadowSet);
  const threeSetBonuses = threeSetResult.activeSets["shadow-set"].bonuses;

  assert.equal(threeSetResult.activeSets["shadow-set"].count, 3);
  assert.equal(threeSetBonuses.damagePct, 10);
  assert.equal(threeSetBonuses.shadowAoe, true);
});

test("calculateEquipmentStats handles null and empty equipment input", () => {
  const nullInput = calculateEquipmentStats(null);
  const emptyInput = calculateEquipmentStats([]);

  assert.deepEqual(nullInput.stats, ZERO_STATS);
  assert.deepEqual(nullInput.traitEffects, {});
  assert.deepEqual(nullInput.activeSets, {});

  assert.deepEqual(emptyInput.stats, ZERO_STATS);
  assert.deepEqual(emptyInput.traitEffects, {});
  assert.deepEqual(emptyInput.activeSets, {});
});

test("lookup helpers return empty results on misses", () => {
  assert.equal(equipmentById("does-not-exist"), null);
  assert.deepEqual(equipmentBySlot("not-a-slot"), []);
  assert.deepEqual(equipmentByCategory("NO_SUCH_CAT"), []);
});
