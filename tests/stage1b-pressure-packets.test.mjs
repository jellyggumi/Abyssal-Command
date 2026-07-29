import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPayload,
} from "../scripts/run-stage1b-pressure-packets.mjs";
import { canonicalStringify } from "../g2-full-route-runner.js";

const EXPECTED_LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const EXPECTED_STANCES = ["VANGUARD", "TURRET", "SPLIT"];
const EXPECTED_SEEDS = [401, 402, 403, 404, 405];
const EXPECTED_CAUSES = new Set([
  "COMMANDER_DAMAGED",
  "COMMANDER_GATE_DIVERSION",
  "GATE_BREACHED",
  "HAZARD_DAMAGE",
  "OBJECTIVE_PRESSURE_PULSE",
  "OBJECTIVE_PRESSURE_DEADLINE",
  "TERRAIN_RECOVERY",
  "WAVE_CLEARED",
  "PROJECTILE_IMPACT",
  "SKILL_SELECTED_PASSIVE_INTEGRITY",
  "SKILL_CAST_INTEGRITY",
]);
const EXPECTED_CAUSE_ANNOTATIONS = new Set(["COMMANDER_GATE_DIVERSION"]);

function assertIntervals(intervals, terminalTick) {
  assert.ok(Array.isArray(intervals) && intervals.length === 5);
  assert.deepEqual(intervals.map(({ id }) => id), [
    "pre-system",
    "authored-wave-0",
    "authored-wave-1",
    "authored-wave-2",
    "post-system",
  ]);
  assert.deepEqual(intervals[0], { id: "pre-system", fromTick: 0, toTick: 0, empty: true });
  assert.equal(intervals.at(-1).toTick, terminalTick + 1);
  for (let index = 1; index < intervals.length; index += 1) {
    assert.equal(intervals[index].fromTick, intervals[index - 1].toTick, "temporal intervals must be contiguous");
  }
  for (const interval of intervals) {
    assert.ok(interval.fromTick <= interval.toTick);
    assert.equal(interval.empty, interval.fromTick === interval.toTick || interval.empty === true);
  }
}

test("Stage1b pressure export covers the exact 15-row population and public setup bounds", () => {
  const payload = buildPayload(EXPECTED_SEEDS, EXPECTED_STANCES, "stage1b-test-revision");
  assert.equal(payload.rows.length, 15);
  assert.deepEqual(payload.population.stanceOrder, EXPECTED_STANCES);
  assert.deepEqual(payload.population.seedOrder, EXPECTED_SEEDS);
  assert.deepEqual(payload.population.loadout, EXPECTED_LOADOUT);
  assert.equal(payload.population.exactDefaultPopulation, true);
  assert.deepEqual(
    payload.rows.map(({ stance, seed }) => `${stance}:${seed}`),
    EXPECTED_STANCES.flatMap((stance) => EXPECTED_SEEDS.map((seed) => `${stance}:${seed}`)),
  );
  assert.deepEqual(payload.setupAdvanceCalls, { VANGUARD: 0, TURRET: 240, SPLIT: 480, max: 480 });
  assert.equal(payload.fightAdvanceCalls.max, 20_000);
  assert.equal(payload.controller.kind, "synthetic");
  assert.equal(payload.controller.humanEvidenceStatus, "NOT_HUMAN_G7_OR_G8_EVIDENCE");
  assert.equal(payload.invariants.exactRowCountWhenDefault, true);
  assert.equal(payload.invariants.noWardenProgress, true);
  assert.equal(payload.invariants.noEquipment, true);
  assert.equal(payload.invariants.noReward, true);
  assert.equal(payload.invariants.noFormationOverride, true);
  assert.equal(payload.invariants.allCompositeLedgers, true);

  const setupCallsByStance = { VANGUARD: 0, TURRET: 240, SPLIT: 480 };
  for (const row of payload.rows) {
    assert.equal(row.loadout.join("|"), EXPECTED_LOADOUT.join("|"));
    assert.equal(row.forbiddenOverrides.measurementProfile, null);
    assert.equal(row.forbiddenOverrides.wardenProgress, null);
    assert.deepEqual(row.forbiddenOverrides.equipment, {});
    assert.deepEqual(row.forbiddenOverrides.rewardIds, []);
    assert.deepEqual(row.forbiddenOverrides.formation, {});
    assert.equal(row.setupAdvanceCalls, setupCallsByStance[row.stance]);
    assert.ok(row.setupAdvanceCalls <= 480);
    assert.ok(row.fightAdvanceCalls <= 20_000);
    assert.ok(row.fightAdvanceCalls > 0);
    const setupTicks = row.terminalTick - row.fightAdvanceCalls;
    assert.ok(setupTicks >= 0 && setupTicks <= row.setupAdvanceCalls);
    assert.ok(row.invariants.compositeLedgerOnly);
    assert.ok(row.invariants.noUnknownIntegrityDiffs);
    assertIntervals(row.temporalIntervals, row.terminalTick);

    for (const record of row.integrityLedger) {
      assert.ok(record.causes.every((cause) => EXPECTED_CAUSES.has(cause)));
      assert.ok(record.causeAnnotations.every((annotation) => EXPECTED_CAUSE_ANNOTATIONS.has(annotation)));
      if (record.causeAnnotations.includes("COMMANDER_GATE_DIVERSION")) {
        assert.ok(record.causes.includes("GATE_BREACHED"));
      }
      assert.ok(record.target === "gate" || record.target === "commander");
      assert.equal(Number.isInteger(record.tick), true);
      assert.equal(record.observationBucketIndex, row.temporalIntervals.findIndex((interval) => (
        interval.empty ? record.tick === interval.fromTick : record.tick >= interval.fromTick && record.tick < interval.toTick
      )));
      assert.equal(typeof record.zeroNet, "boolean");
      assert.equal(record.appliedDelta, record.to - record.from);
      assert.ok(Array.isArray(record.causes));
      assert.ok(Array.isArray(record.causalEventSequences));
      assert.ok(Array.isArray(record.causalEventIds));
      assert.ok(Array.isArray(record.sourcePacketIndices));
      assert.ok(record.sourcePacketIndex === null || Number.isInteger(record.sourcePacketIndex));
      if (record.appliedDelta !== 0) assert.ok(record.sourcePacketIndices.length > 0);
    }
  }
});

test("Stage1b pressure output has no gaps or ambiguous causal attribution", () => {
  const payload = buildPayload([401], ["VANGUARD"], "stage1b-test-revision");
  const row = payload.rows[0];
  for (const record of row.integrityLedger) {
    assert.ok(record.causes.every((cause) => EXPECTED_CAUSES.has(cause)));
    assert.equal(record.causes.includes("UNKNOWN"), false);
    assert.equal(record.causes.includes("AMBIGUOUS"), false);
    assert.ok(record.causeAnnotations.every((annotation) => EXPECTED_CAUSE_ANNOTATIONS.has(annotation)));
    if (record.causeAnnotations.includes("COMMANDER_GATE_DIVERSION")) {
      assert.ok(record.causes.includes("GATE_BREACHED"));
    }
    if (record.appliedDelta !== 0) {
      assert.ok(record.sourcePacketIndex !== null || record.sourcePacketIndices.length > 1);
    }
  }
  assert.equal(row.invariants.noGapsOrOverlaps, true);
  assert.equal(row.invariants.observationIntervalsComplete, true);
});
test("Stage1b pressure packets are canonical-byte replay deterministic", () => {
  const first = buildPayload(EXPECTED_SEEDS, EXPECTED_STANCES, "stage1b-test-revision");
  const second = buildPayload(EXPECTED_SEEDS, EXPECTED_STANCES, "stage1b-test-revision");
  assert.equal(canonicalStringify(first), canonicalStringify(second));
});
