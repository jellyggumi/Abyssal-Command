#!/usr/bin/env node
/**
 * Stage variation / monotony scan (system-diversification track, prompts/approved/24 and 27).
 *
 * MEASUREMENT ONLY — imports the shipped catalogs unmodified and observes them. It answers two
 * questions with numbers instead of adjectives:
 *
 *   1. VARIATION  — how much of each stage's authored shape is a copy of another stage's?
 *                   Every pair of stages is compared across the authored variation axes below;
 *                   `sharedRatio` is shared axes / total axes.
 *   2. ESCALATION — does the campaign actually ask for MORE KINDS OF RESPONSE as it advances?
 *                   `responseTypes` is the size of the union of the response-forcing identifiers a
 *                   stage fields (enemy classes, their policies, the mid-boss class, the boss, the
 *                   objective kinds, hazard/elevation/occupation/extraction fields, pressure lane).
 *                   Difficulty is defined as "how many different answers the player must own", not
 *                   as an HP multiplier — `scale` climbs 100 -> 115 -> 130 on its own and proves
 *                   nothing about variety.
 *
 * Both thresholds are RATCHETS, not aspirations: they are set at what the shipped catalog already
 * achieves, so a new or retuned stage may not make the campaign more repetitive than it is today.
 * `MAX_SHARED_AXIS_RATIO` is 0.20 = 4 of the 20 axes, one axis of headroom above the worst shipped
 * pair (3/20 = 0.15, `abyss-chancel` vs `echo-throne`).
 *
 * Usage:
 *   node scripts/scan-stage-variation.mjs [--output <path.json>] [--strict]
 *     [--max-shared-ratio 0.2]
 *
 * `tests/stage-variation-doctrine.test.mjs` imports `scanStageVariation()` from this file, so the
 * ratchet is a regression gate and not just a report.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ENEMIES,
  STAGES,
  STAGE_BY_ID,
  STAGE_ENCOUNTER_ROUTES,
  STAGE_TACTICS,
  STAGE_WAVE_DOCTRINE,
  TICK_RATE,
} from "../defense-catalog.js";

/** Ratchet: no two stages may share more than this share of the authored variation axes. */
export const MAX_SHARED_AXIS_RATIO = 0.2;

/** The authored axes a stage may vary. Identity fields (id, name, coordinates) are not axes. */
export function axesFor(stageId) {
  const stage = STAGE_BY_ID[stageId];
  const doctrine = STAGE_WAVE_DOCTRINE[stageId];
  const tactics = STAGE_TACTICS[stageId];
  const route = STAGE_ENCOUNTER_ROUTES[stageId];
  const plan = stage.wavePlan;
  const cadence = plan[1].tick - plan[0].tick;
  return {
    waveKindRhythm: plan.map((wave) => wave.kind[0]).join(""),
    waveCount: String(doctrine.waveCount),
    cadenceTicks: String(cadence),
    holdTicks: String(doctrine.defenseTicks),
    gateIntegrity: String(doctrine.gateIntegrity),
    classRotation: doctrine.classes.join(">"),
    midbossEnemy: doctrine.midbossEnemy,
    pressureLane: doctrine.pressureLane,
    spawnDirections: (tactics.spawnDirections ?? []).join(","),
    normalConcurrency: String(route.maxConcurrentEnemies),
    bigConcurrency: String(route.bigWaveMaxConcurrentEnemies),
    spawnIntervalPair: `${route.spawnIntervalTicks}/${route.bigWaveSpawnIntervalTicks}`,
    commitmentCapPair: `${route.commitmentCap}/${route.bigWaveCommitmentCap}`,
    objectiveShape: route.objectives.map(({ kind, waveSlots }) => `${kind}:${waveSlots.length}`).join(">"),
    seededVariation: `${tactics.seededVariation.timingJitterTicks}/${tactics.seededVariation.densityDelta}/${tactics.seededVariation.laneJitter}`,
    hazardDps: String(tactics.hazard.damagePerSecond),
    occupationHoldTicks: String(tactics.occupation.holdTicks),
    extractionWindowTicks: String(tactics.extraction.windowTicks),
    elevationRangeMultiplier: String(tactics.elevation.rangeMultiplier),
    eliteKind: stage.eliteKind,
  };
}

/** The union of response-forcing identifiers a stage fields. Difficulty = size of this set. */
export function responseSetFor(stageId) {
  const stage = STAGE_BY_ID[stageId];
  const doctrine = STAGE_WAVE_DOCTRINE[stageId];
  const tactics = STAGE_TACTICS[stageId];
  const route = STAGE_ENCOUNTER_ROUTES[stageId];
  const responses = new Set();
  for (const wave of stage.wavePlan) {
    for (const alternative of wave.alternatives) {
      for (const { enemy } of alternative.composition) {
        responses.add(`class:${enemy}`);
        const policyId = ENEMIES[enemy]?.policyId;
        if (policyId) responses.add(`policy:${policyId}`);
      }
    }
    if (wave.policyId) responses.add(`policy:${wave.policyId}`);
    if (wave.midboss) responses.add(`midboss:${wave.midboss.enemy}`);
  }
  responses.add(`boss:${stage.boss}`);
  for (const { kind } of route.objectives) responses.add(`objective:${kind}`);
  if (tactics.hazard) responses.add("field:hazard");
  if (tactics.elevation) responses.add("field:elevation");
  if (tactics.occupation) responses.add("field:occupation");
  if (tactics.extraction) responses.add("field:extraction");
  if (doctrine.pressureLane) responses.add(`lane:${doctrine.pressureLane}`);
  return [...responses].sort();
}

/** Deterministic, data-only scan. Returns the full report; never throws on a doctrine miss. */
export function scanStageVariation({ maxSharedRatio = MAX_SHARED_AXIS_RATIO } = {}) {
  if (!Number.isFinite(maxSharedRatio) || maxSharedRatio <= 0 || maxSharedRatio > 1) {
    throw new RangeError("maxSharedRatio must be a ratio in (0, 1]");
  }
  const stageIds = STAGES.map(({ id }) => id);
  const axesByStage = Object.fromEntries(stageIds.map((id) => [id, axesFor(id)]));
  const axisNames = Object.keys(axesByStage[stageIds[0]]);
  const responsesByStage = Object.fromEntries(stageIds.map((id) => [id, responseSetFor(id)]));

  const pairs = [];
  for (let left = 0; left < stageIds.length; left += 1) {
    for (let right = left + 1; right < stageIds.length; right += 1) {
      const a = stageIds[left];
      const b = stageIds[right];
      const shared = axisNames.filter((axis) => axesByStage[a][axis] === axesByStage[b][axis]);
      pairs.push({
        stages: [a, b],
        axisCount: axisNames.length,
        sharedAxes: shared,
        sharedCount: shared.length,
        sharedRatio: Number((shared.length / axisNames.length).toFixed(4)),
      });
    }
  }

  const axisDistinctness = axisNames.map((axis) => {
    const values = stageIds.map((id) => axesByStage[id][axis]);
    return {
      axis,
      distinctValues: new Set(values).size,
      stageCount: stageIds.length,
      constantAcrossCampaign: new Set(values).size === 1,
      values: Object.fromEntries(stageIds.map((id, index) => [id, values[index]])),
    };
  });

  const escalation = stageIds.map((id, index) => ({
    order: index + 1,
    stageId: id,
    scale: STAGE_BY_ID[id].scale,
    holdSeconds: Number((STAGE_WAVE_DOCTRINE[id].defenseTicks / TICK_RATE).toFixed(2)),
    responseTypes: responsesByStage[id].length,
    responses: responsesByStage[id],
  }));

  const failures = [];
  for (const pair of pairs) {
    if (pair.sharedRatio > maxSharedRatio) {
      failures.push(`variation: ${pair.stages.join(" vs ")} share ${pair.sharedCount}/${pair.axisCount} authored axes (${pair.sharedRatio}); maximum ${maxSharedRatio}. Shared: ${pair.sharedAxes.join(", ")}`);
    }
  }
  for (let index = 1; index < escalation.length; index += 1) {
    if (escalation[index].responseTypes < escalation[index - 1].responseTypes) {
      failures.push(`escalation: ${escalation[index].stageId} asks for ${escalation[index].responseTypes} response types, fewer than ${escalation[index - 1].stageId} (${escalation[index - 1].responseTypes})`);
    }
  }
  if (escalation.length > 1 && escalation.at(-1).responseTypes <= escalation[0].responseTypes) {
    failures.push(`escalation: the last stage (${escalation.at(-1).responseTypes}) must ask for more response types than the first (${escalation[0].responseTypes})`);
  }

  return {
    scanner: "scan-stage-variation.mjs",
    schemaVersion: "stage-variation-scan-v1",
    classification: "deterministic-catalog-scan-not-playtest-evidence",
    thresholds: {
      maxSharedRatio,
      escalation: "responseTypes non-decreasing in campaign order and last > first",
    },
    stageIds,
    axisNames,
    axesByStage,
    axisDistinctness,
    pairs,
    escalation,
    worstSharedRatio: pairs.reduce((worst, pair) => Math.max(worst, pair.sharedRatio), 0),
    failures,
    pass: failures.length === 0,
  };
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const argValue = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
  };
  const outputPath = argValue("--output", null);
  const report = scanStageVariation({
    maxSharedRatio: Number(argValue("--max-shared-ratio", String(MAX_SHARED_AXIS_RATIO))),
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    const target = resolve(outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, json, "utf8");
  }
  process.stdout.write(json);
  if (args.includes("--strict") && !report.pass) process.exitCode = 1;
}
