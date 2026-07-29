import assert from "node:assert/strict";
import test from "node:test";

import {
  CORPSE_DURATION_TICKS,
  EXTRACTION_CHANNEL_TICKS,
  createCorpse,
  updateCorpses,
  createExtractionState,
  attemptExtraction,
} from "../extraction-system.js";
import {
  calculateCompanionStatsAtLevel,
  gradeUpCompanion,
  gradeUpEquipment,
} from "../leveling-system.js";
import {
  applyVariance,
  generateEnemyStats,
} from "../enemy-grade-system.js";
import { sphereVsSphere } from "../collision-system.js";

test("createCorpse keeps live state mutable while sourceStats stay immutable", () => {
  const createdTick = 5;
  const corpse = createCorpse({
    id: "e-basic",
    grade: "BASIC",
    x: 100,
    y: 200,
    damage: 50,
    maxHp: 1000,
    attackTicks: 60,
    radius: 300,
    elevation: 0,
  }, createdTick);

  assert.equal(Object.isFrozen(corpse), false);
  assert.equal(Object.isFrozen(corpse.sourceStats), true);

  const corpses = [corpse];
  const tick = 17;
  const remaining = updateCorpses(corpses, tick);
  assert.equal(remaining.length, 1);
  assert.equal(corpse.remainingTicks, CORPSE_DURATION_TICKS - (tick - createdTick));

  const expired = updateCorpses(corpses, createdTick + CORPSE_DURATION_TICKS);
  assert.equal(expired.length, 0);
});

test("attemptExtraction channeling to completion updates mutable corpse state and returns frozen companion", () => {
  const state = createExtractionState();
  const corpses = [
    createCorpse({
      id: "e-shadow",
      grade: "SHADOW",
      x: 0,
      y: 0,
      damage: 60,
      maxHp: 2000,
      attackTicks: 70,
      radius: 400,
      elevation: 0,
    }, 0),
  ];
  const player = { id: "p-1", x: 0, y: 0 };

  let result = attemptExtraction(state, player, corpses, 0);
  assert.equal(result.status, "channeling");

  for (let tick = 1; tick < EXTRACTION_CHANNEL_TICKS; tick += 1) {
    result = attemptExtraction(state, player, corpses, tick);
  }

  assert.equal(result.status, "complete");
  assert.equal(result.companion.grade, "SHADOW");
  assert.equal(corpses[0].extractable, false);
  assert.equal(Object.isFrozen(result.companion), true);
});

test("SHADOW/BOSS companions use intentional multipliers and unknown grades fail deterministically", () => {
  const base = { damage: 100, maxHp: 2000, fireTicks: 30, range: 1000 };

  const shadow = calculateCompanionStatsAtLevel(base, 1, "SHADOW");
  const boss = calculateCompanionStatsAtLevel(base, 1, "BOSS");

  assert.equal(shadow.damage, Math.round(100 * 1.8));
  assert.equal(boss.damage, Math.round(100 * 2));
  assert.equal(boss.grade, "BOSS");

  const shadowCombo = [
    { id: "a", grade: "SHADOW", damage: 90, maxHp: 2000, fireTicks: 30, range: 800, level: 5, hp: 2000 },
    { id: "b", grade: "SHADOW", damage: 110, maxHp: 1800, fireTicks: 34, range: 820, level: 4, hp: 1800 },
    { id: "c", grade: "SHADOW", damage: 100, maxHp: 2200, fireTicks: 32, range: 780, level: 6, hp: 2200 },
  ];

  const rejected = gradeUpCompanion(shadowCombo);
  assert.equal(rejected.success, false);
  assert.equal(rejected.error, "SHADOW 등급은 더 이상 조합할 수 없습니다");

  assert.throws(() => calculateCompanionStatsAtLevel(base, 1, "UNKNOWN"));
});

test("grade-up IDs are deterministic monotonic counters", () => {
  const makeCompanion = (grade, id) => ({
    id,
    grade,
    damage: 100,
    maxHp: 2000,
    fireTicks: 30,
    range: 800,
    level: 10,
    hp: 2000,
  });

  const first = gradeUpCompanion([makeCompanion("BASIC", "c1"), makeCompanion("BASIC", "c2"), makeCompanion("BASIC", "c3")]);
  const second = gradeUpCompanion([makeCompanion("BASIC", "c4"), makeCompanion("BASIC", "c5"), makeCompanion("BASIC", "c6")]);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.match(first.result.id, /^combined-uncommon-\d+$/);
  assert.match(second.result.id, /^combined-uncommon-\d+$/);

  const firstCompanionId = Number(first.result.id.split("-").at(-1));
  const secondCompanionId = Number(second.result.id.split("-").at(-1));
  assert.ok(secondCompanionId > firstCompanionId);

  const makeEquipment = (id, rarity) => ({
    id,
    rarity,
    name: id,
    category: "weapon",
    subcategory: "blade",
    meshPath: "",
    stats: { attack: 100 },
    traits: ["pierce"],
    equippableBy: ["companion"],
    level: 1,
    enhanceLevel: 0,
  });

  const eqFirst = gradeUpEquipment([makeEquipment("e1", "common"), makeEquipment("e2", "common"), makeEquipment("e3", "common")]);
  const eqSecond = gradeUpEquipment([makeEquipment("e4", "common"), makeEquipment("e5", "common"), makeEquipment("e6", "common")]);

  assert.equal(eqFirst.success, true);
  assert.equal(eqSecond.success, true);
  assert.match(eqFirst.result.id, /^combined-uncommon-\d+$/);
  assert.match(eqSecond.result.id, /^combined-uncommon-\d+$/);

  const firstEquipmentId = Number(eqFirst.result.id.split("-").at(-1));
  const secondEquipmentId = Number(eqSecond.result.id.split("-").at(-1));
  assert.ok(secondEquipmentId > firstEquipmentId);
});

test("enemy attackTicks scales with level and seed=0 does not degenerate to variance floor", () => {
  const baseLvl1 = generateEnemyStats("BASIC", 1, 123);
  const baseLvl2 = generateEnemyStats("BASIC", 2, 123);

  assert.equal(baseLvl1.attackTicks, 60);
  assert.equal(baseLvl2.attackTicks, 65);

  const varianceFloor = Math.round(100000 * 0.65);
  assert.notEqual(applyVariance(100000, 0, 0), varianceFloor);
});

test("sphere-vs-sphere helper still reports overlap and misses", () => {
  const miss = sphereVsSphere({ x: 0, y: 0, radius: 5 }, { x: 10, y: 0, radius: 5 });
  assert.equal(miss.colliding, false);

  const hit = sphereVsSphere({ x: 0, y: 0, radius: 6 }, { x: 10, y: 0, radius: 6 });
  assert.equal(hit.colliding, true);
  assert.equal(hit.overlap, 2);
  assert.equal(hit.normalX, 1);
  assert.equal(hit.normalY, 0);
});
