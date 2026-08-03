import assert from "node:assert/strict";
import test from "node:test";

import { ENEMIES, STAGES, STAGE_BY_ID, STAGE_WAVE_DOCTRINE } from "../defense-catalog.js";
import {
  MAX_SHARED_AXIS_RATIO,
  axesFor,
  responseSetFor,
  scanStageVariation,
} from "../scripts/scan-stage-variation.mjs";

/**
 * System-diversification doctrine. The wave doctrine already proves a stage is CLEARABLE
 * (`tests/stage-wave-doctrine.test.mjs`); this suite proves the campaign is not the same stage
 * three times with a bigger `scale`. Both thresholds are ratchets set at the shipped catalog:
 * the worst shipped pair shares 3 of 20 axes (0.15), and response types run 17 -> 17 -> 18.
 */

test("no two stages copy more than a fifth of the authored variation axes", () => {
  const report = scanStageVariation();
  assert.equal(report.thresholds.maxSharedRatio, MAX_SHARED_AXIS_RATIO);
  assert.equal(report.axisNames.length, 20, "the axis set is part of the contract; adding one is a deliberate change");
  for (const pair of report.pairs) {
    assert.ok(
      pair.sharedRatio <= MAX_SHARED_AXIS_RATIO,
      `${pair.stages.join(" vs ")} share ${pair.sharedCount}/${pair.axisCount} axes (${pair.sharedRatio} > ${MAX_SHARED_AXIS_RATIO}): ${pair.sharedAxes.join(", ")}`,
    );
  }
});

test("the wave-kind rhythm, the mid-boss class and the class rotation are stage-unique", () => {
  const rhythms = STAGES.map(({ id }) => axesFor(id).waveKindRhythm);
  assert.equal(new Set(rhythms).size, STAGES.length, `wave-kind rhythms must differ per stage, got ${rhythms.join(" / ")}`);

  const midbosses = STAGES.map(({ id }) => STAGE_WAVE_DOCTRINE[id].midbossEnemy);
  assert.equal(new Set(midbosses).size, STAGES.length, `each stage must wall on its own mid-boss class, got ${midbosses.join(" / ")}`);

  const rotations = STAGES.map(({ id }) => STAGE_WAVE_DOCTRINE[id].classes.join(">"));
  assert.equal(new Set(rotations).size, STAGES.length, `class rotations must differ per stage, got ${rotations.join(" / ")}`);
});

test("difficulty escalates as response types, not as an HP multiplier", () => {
  const report = scanStageVariation();
  const counts = report.escalation.map(({ responseTypes }) => responseTypes);
  assert.deepEqual(
    counts,
    [17, 17, 18],
    `campaign response-type escalation must remain 17 -> 17 -> 18, got ${counts.join(" -> ")}`,
  );
  const scales = report.escalation.map(({ stageId }) => STAGE_BY_ID[stageId].scale);

  // The HP curve is real but it is not the difficulty claim, so it is asserted separately.
  for (let index = 1; index < scales.length; index += 1) {
    assert.ok(scales[index] > scales[index - 1], `stage HP scale must climb, got ${scales.join(" -> ")}`);
  }
  for (let index = 1; index < counts.length; index += 1) {
    assert.ok(
      counts[index] >= counts[index - 1],
      `response types must never fall across the campaign, got ${counts.join(" -> ")}`,
    );
  }
  assert.ok(
    counts.at(-1) > counts[0],
    `the last stage must demand more distinct answers than the first, got ${counts.join(" -> ")}`,
  );
  assert.deepEqual(report.failures, [], "the shipped catalog must clear its own variation doctrine");
});

test("the final stage fields every enemy class the campaign taught", () => {
  const taught = new Set();
  for (const { id } of STAGES.slice(0, -1)) {
    for (const enemyId of STAGE_WAVE_DOCTRINE[id].classes) taught.add(enemyId);
  }
  const finalStageId = STAGES.at(-1).id;
  const fielded = new Set(STAGE_WAVE_DOCTRINE[finalStageId].classes);
  const missing = [...taught].filter((enemyId) => !fielded.has(enemyId));
  assert.deepEqual(missing, [], `${finalStageId} must field every class the earlier stages taught; missing ${missing.join(", ")}`);
});

test("every mid-boss wave uses its stage's authored, real mid-boss class", () => {
  for (const { id } of STAGES) {
    const doctrine = STAGE_WAVE_DOCTRINE[id];
    // A mid-boss class deliberately MAY sit outside the stage's own rotation — `cinder-span`
    // rotates rusher/flanker/ranged and walls on a guardian precisely because that body is an
    // answer the stage never otherwise asks for. What it may not be is unauthored or shared.
    assert.ok(ENEMIES[doctrine.midbossEnemy], `${id} mid-boss class ${doctrine.midbossEnemy} is not an authored enemy`);
    const midWaves = STAGE_BY_ID[id].wavePlan.filter((wave) => wave.midboss);
    assert.ok(midWaves.length >= 2, `${id} must field at least two mid-boss waves`);
    for (const wave of midWaves) {
      assert.equal(wave.midboss.enemy, doctrine.midbossEnemy, `${id} wave ${wave.slot} must use the authored mid-boss class`);
      assert.equal(wave.kind, "mid", `${id} wave ${wave.slot} carries a mid-boss outside a mid wave`);
    }
  }
});

test("every stage's response set stays auditable and non-empty", () => {
  for (const { id } of STAGES) {
    const responses = responseSetFor(id);
    assert.ok(responses.length >= 12, `${id} exposes only ${responses.length} response types`);
    assert.equal(new Set(responses).size, responses.length, `${id} response set must be deduplicated`);
    assert.ok(responses.every((entry) => /^[a-z]+:[a-z0-9-]+$/.test(entry)), `${id} response ids must stay namespaced`);
  }
});
