#!/usr/bin/env node
/**
 * Frozen Stage 1b G3 formation-transition evidence exporter.
 *
 * Measurement only: this script drives and reads the shipped deterministic simulation. Its
 * synthetic controller output is not human G7/G8 evidence and changes no gameplay values.
 *
 * Usage:
 *   node scripts/run-g3-stance-events.mjs --output <path.json> [--seeds 401]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

const RUN_ID = "20260726-stage1b-cinder-pressure-agency";
const STAGE_ID = "cinder-span";
const LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const REQUIRED_PER_ARM = 50;
const MAX_CANDIDATE_SEEDS = 500;
const MAX_CONTROLLER_STEPS = 20000;
// Read-only instrumentation context pinned by the frozen Stage 1b contract.
const BOSS_PRESSURE_GRACE_TICKS = 1800;
const RETAINED_EVENT_TYPES = new Set([
  "BOSS_RALLY_WINDOW",
  "BOSS_SPAWNED",
  "COMPANION_DAMAGED",
  "COMPANION_DOWNED",
  "ENEMY_SPAWNED",
  "STANCE_SWITCHED",
  "TERMINAL",
]);

function queueObjectiveCommands(run) {
  if (run.growthOffer) {
    const skillId = run.growthOffer.choices[0];
    return skillId ? queueInput(run, "SKILL_SELECTED", { skillId }) : run;
  }
  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of run.commander.skills) {
    next = queueInput(next, "SKILL_CAST", { skillId });
  }
  if (run.eliteCandidate && !run.extracted) {
    next = queueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId });
  }
  return next;
}

function livingFrontIds(snapshot) {
  return snapshot.companions
    .filter((companion) => companion.status === "ACTIVE" && companion.slot === "FRONT")
    .map((companion) => companion.id)
    .sort();
}

function evidenceCollector(initialRun) {
  const events = [];
  const enemyClasses = new Map();
  const stanceAttempts = new Map();
  const acceptedSnapshots = new Map();
  let bossSpawnedAt = null;

  const rememberStanceAttempt = (queuedRun, beforeSnapshot) => {
    const input = queuedRun.inputs.at(-1);
    if (input?.type === "STANCE_CYCLE") stanceAttempts.set(input.inputId, beforeSnapshot);
  };

  const capture = (run) => {
    const companionTarget = (targetId) => typeof targetId === "string" && targetId.startsWith("companion-");

    for (const event of run.events) {
      if (event.type === "ENEMY_SPAWNED") {
        enemyClasses.set(event.entityId, event.elite ? "elite" : event.enemyType);
      } else if (event.type === "BOSS_SPAWNED") {
        enemyClasses.set(event.entityId, "boss");
        bossSpawnedAt = event.tick;
      }

      const sourceId = event.enemyId
        ?? event.owner
        ?? (event.type === "ENEMY_ATTACK" || event.type === "WEAPON_FIRED" ? event.entityId : null);
      const sourceClass = sourceId
        ? (enemyClasses.get(sourceId)
          ?? run.enemies.find((enemy) => enemy.id === sourceId)?.class
          ?? null)
        : null;
      const targetsCompanion = companionTarget(event.targetId)
        || event.type === "COMPANION_DAMAGED"
        || event.type === "COMPANION_DOWNED";
      const stanceInputEvent = (event.type === "INPUT_ACCEPTED" || event.type === "INPUT_REJECTED")
        && event.inputType === "STANCE_CYCLE";
      const incomingPressureEvent = targetsCompanion
        && (event.type === "ENEMY_ATTACK" || event.type === "WEAPON_FIRED");

      if (RETAINED_EVENT_TYPES.has(event.type) || stanceInputEvent || incomingPressureEvent) {
        events.push({
          ...event,
          ...(sourceId ? { sourceId, sourceClass } : {}),
        });
      }

      if (event.type === "INPUT_ACCEPTED" && event.inputType === "STANCE_CYCLE") {
        acceptedSnapshots.set(event.inputId, getRunSnapshot(run));
      }
    }
  };

  capture(initialRun);
  return {
    events,
    stanceAttempts,
    acceptedSnapshots,
    rememberStanceAttempt,
    capture,
    get bossSpawnedAt() {
      return bossSpawnedAt;
    },
  };
}

function acceptedTransitionTo(events, targetStance) {
  for (const accepted of events) {
    if (accepted.type !== "INPUT_ACCEPTED" || accepted.inputType !== "STANCE_CYCLE") continue;
    const switched = events
      .filter((event) => event.type === "STANCE_SWITCHED"
        && event.stance === targetStance
        && event.tick === accepted.tick
        && event.eventSequence < accepted.eventSequence)
      .at(-1);
    if (switched) return { accepted, switched };
  }
  return null;
}

function queueStanceCycle(run, collector) {
  const beforeSnapshot = getRunSnapshot(run);
  const queued = queueInput(run, "STANCE_CYCLE");
  collector.rememberStanceAttempt(queued, beforeSnapshot);
  return queued;
}

function driveRun({ seed, mode }) {
  let run = createDefenseRun({
    stageId: STAGE_ID,
    seed,
    companionLoadout: LOADOUT,
  });
  const collector = evidenceCollector(run);
  let controllerStatus = "MAX_STEPS_REACHED";

  for (let step = 0; step < MAX_CONTROLLER_STEPS && !isTerminalRun(run); step += 1) {
    if (run.growthOffer && !run.growthOffer.choices[0]) {
      controllerStatus = "BLOCKED_NO_GROWTH_CHOICE";
      break;
    }

    let next = run;
    if (mode === "SPLIT"
      && run.formationStance !== "SPLIT"
      && run.tick >= (run.stanceCooldownUntilTick ?? 0)) {
      next = queueStanceCycle(next, collector);
    } else if (mode === "rally-then-turret"
      && run.rallyTargetId
      && run.formationStance !== "TURRET") {
      next = queueStanceCycle(next, collector);
    }

    next = queueObjectiveCommands(next);
    run = advanceDefenseRun(next, 1);
    collector.capture(run);
  }

  if (isTerminalRun(run)) controllerStatus = "TERMINAL";
  return { run, collector, controllerStatus };
}

function pressureEvidence(events) {
  return events.filter((event) => (
    event.type === "COMPANION_DAMAGED"
    || ((event.type === "ENEMY_ATTACK" || event.type === "WEAPON_FIRED")
      && event.targetId?.startsWith("companion-"))
  ));
}

function isBossGraceEvent(event, bossSpawnedAt) {
  return event.sourceClass === "boss"
    && bossSpawnedAt !== null
    && event.tick < bossSpawnedAt + BOSS_PRESSURE_GRACE_TICKS;
}

function buildFormationTransition(seed, driven) {
  const { run, collector, controllerStatus } = driven;
  const transition = acceptedTransitionTo(collector.events, "TURRET");
  const rallyEvent = collector.events.find((event) => event.type === "BOSS_RALLY_WINDOW");
  if (!transition || !rallyEvent || transition.accepted.eventSequence <= rallyEvent.eventSequence) return null;

  const { accepted, switched } = transition;
  const beforeSnapshot = collector.stanceAttempts.get(accepted.inputId);
  const afterSnapshot = collector.acceptedSnapshots.get(accepted.inputId);
  if (!beforeSnapshot || !afterSnapshot) return null;

  const events = collector.events.map((event) => ({
    ...event,
    phase: event.tick < accepted.tick ? "before" : "after",
  }));
  const companionDamageByPhase = { before: 0, switchTick: 0, after: 0 };
  const downsByPhase = { before: 0, switchTick: 0, after: 0 };
  for (const event of events) {
    const phase = event.tick < accepted.tick ? "before" : "after";
    if (event.type === "COMPANION_DAMAGED") {
      companionDamageByPhase[phase] += event.damage ?? 0;
    } else if (event.type === "COMPANION_DOWNED") {
      downsByPhase[phase] += 1;
    }
  }

  const postSwitchPressure = pressureEvidence(events)
    .filter((event) => event.tick >= accepted.tick);
  const nonBossPressure = postSwitchPressure
    .filter((event) => event.sourceClass !== "boss");
  const nonGracePressure = postSwitchPressure
    .filter((event) => !isBossGraceEvent(event, collector.bossSpawnedAt));
  const exposureStatus = nonGracePressure.length > 0 ? "EXPOSED" : "NOT_EXPOSED";
  const snapshot = getRunSnapshot(run);

  return {
    runId: `${RUN_ID}:g3:rally-then-turret:${seed}`,
    stageId: STAGE_ID,
    seed,
    mode: "rally-then-turret",
    rallyEventTick: rallyEvent.tick,
    rallyEventSequence: rallyEvent.eventSequence,
    switchEventSequence: accepted.eventSequence,
    stanceSwitchEventSequence: switched.eventSequence,
    acceptedSwitchTick: accepted.tick,
    acceptedSwitchInputId: accepted.inputId,
    stanceBefore: beforeSnapshot.formationStance,
    stanceAfter: afterSnapshot.formationStance,
    targetStance: "TURRET",
    frontBefore: livingFrontIds(beforeSnapshot),
    frontAfter: livingFrontIds(afterSnapshot),
    companionDamageByPhase,
    downsByPhase,
    pressureContext: {
      bossSpawnedAt: collector.bossSpawnedAt,
      bossPressureGraceTicks: BOSS_PRESSURE_GRACE_TICKS,
      bossGraceActive: collector.bossSpawnedAt !== null
        && accepted.tick < collector.bossSpawnedAt + BOSS_PRESSURE_GRACE_TICKS,
      bossGraceEndTick: collector.bossSpawnedAt === null
        ? null
        : collector.bossSpawnedAt + BOSS_PRESSURE_GRACE_TICKS,
      nonBossPressureActive: nonBossPressure.length > 0,
      postSwitchPressureEventCount: postSwitchPressure.length,
      nonGracePressureEventCount: nonGracePressure.length,
    },
    exposureStatus,
    terminal: snapshot.terminal,
    ticksUsed: snapshot.tick,
    controllerStatus,
    events,
  };
}

function buildControlRun(seed, targetStance, driven) {
  const { run, collector, controllerStatus } = driven;
  const snapshot = getRunSnapshot(run);
  const events = collector.events;
  const pressureEvents = pressureEvidence(events);
  const nonBossPressure = pressureEvents.filter((event) => event.sourceClass !== "boss");
  const nonGracePressure = pressureEvents
    .filter((event) => !isBossGraceEvent(event, collector.bossSpawnedAt));
  const companionsDowned = events.filter((event) => event.type === "COMPANION_DOWNED").length;
  const companionDamageTaken = events
    .filter((event) => event.type === "COMPANION_DAMAGED")
    .reduce((total, event) => total + (event.damage ?? 0), 0);

  return {
    runId: `${RUN_ID}:g3:control:${targetStance}:${seed}`,
    stageId: STAGE_ID,
    seed,
    mode: "control",
    stance: targetStance,
    targetStance,
    finalStance: snapshot.formationStance,
    livingFrontIds: livingFrontIds(snapshot),
    companionDamageTaken,
    companionsDowned,
    defeated: snapshot.terminal === "DEFEAT",
    defeatCount: snapshot.terminal === "DEFEAT" ? 1 : 0,
    terminal: snapshot.terminal,
    ticksUsed: snapshot.tick,
    controllerStatus,
    pressureContext: {
      bossSpawnedAt: collector.bossSpawnedAt,
      bossPressureGraceTicks: BOSS_PRESSURE_GRACE_TICKS,
      bossGraceObserved: collector.bossSpawnedAt !== null,
      bossGraceActive: collector.bossSpawnedAt !== null
        && snapshot.tick < collector.bossSpawnedAt + BOSS_PRESSURE_GRACE_TICKS,
      nonBossPressureActive: nonBossPressure.length > 0,
      nonGracePressureActive: nonGracePressure.length > 0,
      pressureEventCount: pressureEvents.length,
    },
    events,
  };
}

function parseSeedAnchors(args) {
  const seedsIndex = args.indexOf("--seeds");
  if (seedsIndex === -1) return [401];
  const raw = args[seedsIndex + 1];
  if (!raw || raw.startsWith("-")) return null;
  const seeds = raw.split(",").map((value) => Number(value.trim()));
  return seeds.length && seeds.every((seed) => Number.isInteger(seed)) ? seeds : null;
}

function candidateSeeds(seedAnchors) {
  const candidates = [];
  const seen = new Set();
  for (const seed of seedAnchors) {
    if (!seen.has(seed)) {
      candidates.push(seed);
      seen.add(seed);
    }
  }
  let nextSeed = Math.max(...seedAnchors) + 1;
  while (candidates.length < MAX_CANDIDATE_SEEDS) {
    if (!seen.has(nextSeed)) candidates.push(nextSeed);
    nextSeed += 1;
  }
  return candidates;
}

function workerTask(task) {
  if (task.kind === "transition") {
    return buildFormationTransition(
      task.seed,
      driveRun({ seed: task.seed, mode: "rally-then-turret" }),
    );
  }
  return buildControlRun(
    task.seed,
    task.stance,
    driveRun({ seed: task.seed, mode: task.stance }),
  );
}

function runWorker(task) {
  return new Promise((resolveWorker, rejectWorker) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: task });
    worker.once("message", resolveWorker);
    worker.once("error", rejectWorker);
    worker.once("exit", (code) => {
      if (code !== 0) rejectWorker(new Error(`G3 evidence worker exited with code ${code}`));
    });
  });
}

async function parallelMap(items, concurrency = 8) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await runWorker(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const output = outputIndex === -1 ? null : args[outputIndex + 1];
  const seedAnchors = parseSeedAnchors(args);
  if (!output || output.startsWith("-") || !seedAnchors) {
    console.error("Usage: node scripts/run-g3-stance-events.mjs --output <path.json> [--seeds 401]");
    process.exit(1);
  }

  const formationTransitions = [];
  const acceptedSeeds = [];
  const candidates = candidateSeeds(seedAnchors);
  let candidatesAttempted = 0;
  while (formationTransitions.length < REQUIRED_PER_ARM && candidatesAttempted < candidates.length) {
    const needed = REQUIRED_PER_ARM - formationTransitions.length;
    const batch = candidates.slice(candidatesAttempted, candidatesAttempted + Math.max(needed, 10));
    candidatesAttempted += batch.length;
    const transitions = await parallelMap(batch.map((seed) => ({ kind: "transition", seed })));
    for (let index = 0; index < transitions.length && formationTransitions.length < REQUIRED_PER_ARM; index += 1) {
      if (transitions[index]) {
        formationTransitions.push(transitions[index]);
        acceptedSeeds.push(batch[index]);
      }
    }
  }

  const controlRuns = await parallelMap(acceptedSeeds.flatMap((seed) => [
    { kind: "control", seed, stance: "VANGUARD" },
    { kind: "control", seed, stance: "SPLIT" },
  ]));
  const sampleCounts = {
    acceptedRallyToTurretConversions: formationTransitions.length,
    vanguardControls: controlRuns.filter((run) => run.targetStance === "VANGUARD").length,
    splitControls: controlRuns.filter((run) => run.targetStance === "SPLIT").length,
  };
  const insufficientSamples = Object.values(sampleCounts).some((count) => count < REQUIRED_PER_ARM);
  if (insufficientSamples) {
    console.error(`g3-stance-events: insufficient deterministic samples ${JSON.stringify(sampleCounts)}`);
    process.exit(2);
  }

  const observedRuntimeContract = {
    turretLivingFrontCounts: [...new Set(formationTransitions.map((row) => row.frontAfter.length))].sort(),
    bossRallyCooldownReductionBp: [...new Set(formationTransitions.map((row) => (
      row.events.find((event) => event.type === "BOSS_RALLY_WINDOW")?.cooldownReductionBp
    )))].sort(),
  };
  const document = {
    schemaVersion: "stage1b-g3-formation-transition-v1",
    runId: RUN_ID,
    evidenceLabel: "SYNTHETIC_CONTROLLER_EVIDENCE_NOT_HUMAN_G7_G8",
    controller: {
      kind: "synthetic",
      policy: "objective-driving-rally-switch",
      humanEvidenceStatus: "DOES_NOT_SATISFY_G7_OR_G8",
    },
    samplePlan: {
      stageId: STAGE_ID,
      requiredPerArm: REQUIRED_PER_ARM,
      seedAnchors,
      seedPolicy: "anchors-then-sequential-from-last-plus-one",
      acceptedSeeds,
      maxCandidateSeeds: MAX_CANDIDATE_SEEDS,
      candidatesAttempted,
    },
    sampleCounts,
    observedRuntimeContract,
    formationTransitions,
    controlRuns,
    summary: {
      status: "COMPLETE",
      sampleCounts,
      exposureCounts: {
        EXPOSED: formationTransitions.filter((row) => row.exposureStatus === "EXPOSED").length,
        NOT_EXPOSED: formationTransitions.filter((row) => row.exposureStatus === "NOT_EXPOSED").length,
      },
      immunityClaims: 0,
    },
  };

  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(document), "utf8");
  console.log(`g3-stance-events: ${formationTransitions.length} conversions + ${controlRuns.length} controls, wrote ${outputPath}`);
}

if (isMainThread) {
  await main();
} else {
  parentPort.postMessage(workerTask(workerData));
}
