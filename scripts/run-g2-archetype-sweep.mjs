#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as Catalog from "../defense-catalog.js";
import {
  MEASUREMENT_FIXTURE_BUDGET_ID,
  MEASUREMENT_PROFILES,
  RULES_VERSION,
  TICK_RATE,
} from "../defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const output = outputIndex === -1 ? null : args[outputIndex + 1];

if (outputIndex === -1 || !output || output.startsWith("-")) {
  console.error("Error: --output <path> is required");
  process.exit(1);
}

const PROFILES = Object.freeze(["bulwark", "striker", "gambit", "conductor", "rift"]);
const SEEDS = Object.freeze([17, 18, 19]);
const STAGE_ID = "cinder-span";
const WINDOW_TICKS = 360;
const INPUT_TAPE_ID = "fixed-cinder-span-360-tick-no-movement-v1";
const OBSERVER_ID = "g2-archetype-sweep-runner";
const EVIDENCE_SCHEMA_VERSION = "g2-archetype-sweep-jsonl-v2";
const GATE_VERDICT = "NOT_PASSED";

const UNAVAILABLE_METRICS_TEMPLATE = Object.freeze({
  ordinary_ttk: Object.freeze({
    observed: false,
    reason: "360-tick window does not observe full ordinary enemy TTK trajectory",
  }),
  elite_ttk: Object.freeze({
    observed: false,
    reason: "360-tick window does not observe elite enemy spawn or TTK",
  }),
  stage10_ttk: Object.freeze({
    observed: false,
    reason: "360-tick window is not a Stage-10 boss run",
  }),
  combo_percentiles: Object.freeze({
    observed: false,
    p5: null,
    p50: null,
    p95: null,
    reason: "controlled no-movement single-skill window does not measure multi-skill combo percentiles",
  }),
  route_win_rate: Object.freeze({
    observed: false,
    reason: "360-tick window is a truncated diagnostic slice, not a full route run",
  }),
});

function computeCatalogDigest() {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(Catalog));
  return hash.digest("hex");
}

function computeInputTapeDigest(inputTape) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(inputTape));
  return hash.digest("hex");
}

function computeRecordChecksum(record) {
  const copy = { ...record };
  delete copy.checksum;
  const hash = createHash("sha256");
  hash.update(JSON.stringify(copy));
  return hash.digest("hex");
}

function executeWindowRun(profileId, seed) {
  let run = createDefenseRun({
    stageId: STAGE_ID,
    seed,
    measurementProfileId: profileId,
  });

  const profile = MEASUREMENT_PROFILES[profileId];
  if (!profile) {
    throw new Error(`Unknown measurement profile: ${profileId}`);
  }

  const startSnapshot = getRunSnapshot(run);
  const inputTape = [];
  const eventHistory = [];

  for (let t = 0; t < WINDOW_TICKS && !isTerminalRun(run); t += 1) {
    const nextTick = run.tick + 1;
    run = queueInput(run, "MOVE", "IDLE");
    inputTape.push({ tick: nextTick, type: "MOVE", payload: "IDLE" });

    run = queueInput(run, "SKILL_CAST", { skillId: profile.activeSkillId });
    inputTape.push({
      tick: nextTick,
      type: "SKILL_CAST",
      payload: { skillId: profile.activeSkillId },
    });

    run = advanceDefenseRun(run, 1);
    const tickSnapshot = getRunSnapshot(run);
    eventHistory.push(...tickSnapshot.events.map((event) => structuredClone(event)));
  }

  const endSnapshot = getRunSnapshot(run);
  const digest = getRunDigest(run);
  return { run, startSnapshot, endSnapshot, inputTape, eventHistory, digest };
}

function processEvents(events, profile, startSnapshot, endSnapshot) {
  const skillId = profile.activeSkillId;

  let skillCasts = 0;
  let skillHits = 0;
  let skillDamageTotal = 0;

  let basicFires = 0;
  let basicImpacts = 0;
  let basicHits = 0;
  let basicDamageTotal = 0;

  let critTotal = 0;
  let critBasic = 0;
  let critSkill = 0;

  const cooldownSets = [];
  const cooldownReadies = [];

  let currentSkillDrought = 0;
  let maxSkillCritDrought = 0;

  for (const ev of events) {
    if (ev.type === "SKILL_CAST" && ev.skillId === skillId) {
      skillCasts += 1;
    } else if (ev.type === "SKILL_RESOLVED_DAMAGE" && ev.skillId === skillId) {
      skillHits += 1;
      skillDamageTotal += ev.damage || 0;

      if (ev.critical) {
        currentSkillDrought = 0;
      } else {
        currentSkillDrought += 1;
        if (currentSkillDrought > maxSkillCritDrought) {
          maxSkillCritDrought = currentSkillDrought;
        }
      }
    } else if (ev.type === "WEAPON_FIRED" && (ev.entityId === "commander" || ev.owner === "commander")) {
      basicFires += 1;
    } else if (ev.type === "PROJECTILE_IMPACT" && (ev.sourceId === "commander" || ev.owner === "commander")) {
      basicImpacts += 1;
      if (ev.hit) {
        basicHits += 1;
        basicDamageTotal += ev.damage || 0;
      }
    } else if (ev.type === "CRITICAL_HIT") {
      critTotal += 1;
      if (ev.source === "basic") {
        critBasic += 1;
      } else if (ev.source === "skill") {
        critSkill += 1;
      }
    } else if (ev.type === "SKILL_COOLDOWN_SET") {
      cooldownSets.push(ev);
    } else if (ev.type === "SKILL_COOLDOWN_READY") {
      cooldownReadies.push(ev);
    }
  }

  let basicDrought = 0;
  let maxBasicCritDrought = 0;
  for (const ev of events) {
    if (ev.type === "WEAPON_FIRED" && (ev.entityId === "commander" || ev.owner === "commander")) {
      const isCrit = events.some(
        (e) => e.type === "CRITICAL_HIT" && e.source === "basic" && e.tick === ev.tick
      );
      if (isCrit) {
        basicDrought = 0;
      } else {
        basicDrought += 1;
        if (basicDrought > maxBasicCritDrought) {
          maxBasicCritDrought = basicDrought;
        }
      }
    }
  }

  const cooldownCycles = [];
  let boundaryMismatchesCount = 0;

  for (let i = 0; i < cooldownSets.length; i += 1) {
    const setEv = cooldownSets[i];
    const readyEv = cooldownReadies[i] || null;
    const expectedReadyTick = setEv.readyTick;
    const actualReadyTick = readyEv ? readyEv.readyTick : null;
    const boundaryMismatch = actualReadyTick !== null ? actualReadyTick !== expectedReadyTick : false;

    if (boundaryMismatch) {
      boundaryMismatchesCount += 1;
    }

    cooldownCycles.push({
      skillId: setEv.skillId,
      setTick: setEv.setTick,
      baseCooldownTicks: setEv.baseCooldownTicks,
      effectiveCooldownTicks: setEv.effectiveCooldownTicks,
      expectedReadyTick,
      actualReadyTick,
      boundaryMismatchTicks: actualReadyTick !== null ? actualReadyTick - expectedReadyTick : null,
    });
  }

  const startCommanderIntegrity = startSnapshot.commander.integrity;
  const startGateIntegrity = startSnapshot.gate.integrity;
  const endCommanderIntegrity = endSnapshot.commander.integrity;
  const endGateIntegrity = endSnapshot.gate.integrity;

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      budgetId: profile.budgetId,
      maxIntegrity: profile.maxIntegrity,
      basicCooldownTicks: profile.basicCooldownTicks,
      basicDamage: profile.basicDamage,
      critProfile: profile.critProfile,
      activeSkillId: profile.activeSkillId,
      fixtureActiveCooldownTicks: profile.fixtureActiveCooldownTicks,
    },
    start_health: {
      commander: startCommanderIntegrity,
      gate: startGateIntegrity,
    },
    end_health: {
      commander: endCommanderIntegrity,
      gate: endGateIntegrity,
    },
    damage_taken: {
      commander: startCommanderIntegrity - endCommanderIntegrity,
      gate: startGateIntegrity - endGateIntegrity,
    },
    active_skill_metrics: {
      skillId,
      casts: skillCasts,
      hits: skillHits,
      damageTotal: skillDamageTotal,
    },
    basic_attack_metrics: {
      fires: basicFires,
      impacts: basicImpacts,
      hits: basicHits,
      damageTotal: basicDamageTotal,
    },
    crit_metrics: {
      totalCrits: critTotal,
      basicCrits: critBasic,
      skillCrits: critSkill,
      basicCritDroughtMax: maxBasicCritDrought,
      skillCritDroughtMax: maxSkillCritDrought,
    },
    cooldown_metrics: {
      setCount: cooldownSets.length,
      readyCount: cooldownReadies.length,
      boundaryMismatchesCount,
      cycles: cooldownCycles,
    },
  };
}

const catalogDigest = computeCatalogDigest();
const timestampUtc = new Date().toISOString();

const manifestRecord = {
  record_type: "manifest",
  schema_version: EVIDENCE_SCHEMA_VERSION,
  measurement_status: "INCOMPLETE",
  gate_verdict: GATE_VERDICT,
  scope: {
    stage: STAGE_ID,
    window_ticks: WINDOW_TICKS,
    profiles: PROFILES,
    seeds: SEEDS,
    expected_profile_seed_tuples: PROFILES.flatMap((profileId) =>
      SEEDS.map((seed) => ({ profile_id: profileId, seed }))
    ),
    expected_run_count: PROFILES.length * SEEDS.length,
    fixture_mode: "controlled no-movement active-skill diagnostic window",
  },
  provenance: {
    observer_id: OBSERVER_ID,
    input_tape_id: INPUT_TAPE_ID,
    catalog_digest: catalogDigest,
    event_capture: "Detached public snapshot events captured after each one-tick advance.",
    source: "scripts/run-g2-archetype-sweep.mjs",
  },
  thresholds_intentionally_unavailable: Object.keys(UNAVAILABLE_METRICS_TEMPLATE),
  unavailable_metrics: UNAVAILABLE_METRICS_TEMPLATE,
  note: "This bounded 5×3 Cinder Span diagnostic collection is not a complete G2 gate contract and cannot establish full-G2 thresholds.",
  timestamp_utc: timestampUtc,
};
manifestRecord.checksum = computeRecordChecksum(manifestRecord);

const records = [];
let digestMismatchCount = 0;

for (const profileId of PROFILES) {
  const profile = MEASUREMENT_PROFILES[profileId];
  for (const seed of SEEDS) {
    const firstResult = executeWindowRun(profileId, seed);
    const repeatResult = executeWindowRun(profileId, seed);

    const inputTapeDigest = computeInputTapeDigest(firstResult.inputTape);
    const digestMatched = firstResult.digest === repeatResult.digest;

    if (!digestMatched) {
      digestMismatchCount += 1;
      console.error(
        `Deterministic replay mismatch detected for profile=${profileId}, seed=${seed}`
      );
    }

    const processed = processEvents(
      firstResult.eventHistory,
      profile,
      firstResult.startSnapshot,
      firstResult.endSnapshot
    );

    const record = {
      record_type: "run",
      fixture_id: profileId,
      budget_id: profile.budgetId || MEASUREMENT_FIXTURE_BUDGET_ID,
      rules_version: RULES_VERSION,
      catalog_digest: catalogDigest,
      snapshot_version: firstResult.endSnapshot.version,
      event_version: firstResult.endSnapshot.eventVersion,
      stage: STAGE_ID,
      seed,
      input_tape_id: INPUT_TAPE_ID,
      input_tape_digest: inputTapeDigest,
      clock_hz: TICK_RATE,
      viewport_device: "local-no-render",
      audio: false,
      reduced_motion: true,
      observer_id: OBSERVER_ID,
      timestamp_utc: timestampUtc,
      controlled_input_provenance: {
        stageId: STAGE_ID,
        seed,
        targetTicks: WINDOW_TICKS,
        moveInput: "IDLE",
        activeSkillId: profile.activeSkillId,
      },
      metrics: processed,
      outcome: firstResult.endSnapshot.terminal || "INCOMPLETE_WINDOW",
      digest: firstResult.digest,
      repeat_digest: repeatResult.digest,
      digest_matched: digestMatched,
      unavailable_metrics: UNAVAILABLE_METRICS_TEMPLATE,
    };
    record.checksum = computeRecordChecksum(record);
    records.push(record);
  }
}

const summaryRecord = {
  record_type: "summary",
  measurement_status: "INCOMPLETE",
  gate_verdict: GATE_VERDICT,
  total_runs: records.length,
  completed_runs: records.length,
  digest_mismatches: digestMismatchCount,
  profiles_evaluated: PROFILES,
  seeds_evaluated: SEEDS,
  unavailable_metrics_summary: Object.keys(UNAVAILABLE_METRICS_TEMPLATE),
  note: "Raw deterministic G2 measurement runner export. Single-slice 360-tick window; does not satisfy full G2 gate thresholds or claim a gate pass.",
  timestamp_utc: timestampUtc,
};
summaryRecord.checksum = computeRecordChecksum(summaryRecord);

const allLines = [manifestRecord, ...records, summaryRecord];
const jsonlContent = allLines.map((line) => JSON.stringify(line)).join("\n") + "\n";

const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, jsonlContent, "utf8");

if (digestMismatchCount > 0) {
  process.exitCode = 1;
}
