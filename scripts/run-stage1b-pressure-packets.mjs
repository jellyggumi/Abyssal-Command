#!/usr/bin/env node
/**
 * Stage 1b Cinder pressure population exporter.
 *
 * This is instrumentation-only evidence. It drives the shipped public simulation
 * APIs and never changes simulation state outside those APIs.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
  BOSS_PRESSURE_GRACE_TICKS,
} from "../defense-run-simulation.js";
import { canonicalStringify } from "../g2-full-route-runner.js";
import { OCTANT_VECTORS, SKILLS, SKILL_RANK_PASSIVE_SHARE } from "../defense-catalog.js";

const STAGE_ID = "cinder-span";
const LOADOUT = Object.freeze(["ember-cohort", "rift-lens", "veil-vanguard"]);
const DEFAULT_SEEDS = Object.freeze([401, 402, 403, 404, 405]);
const DEFAULT_STANCES = Object.freeze(["VANGUARD", "TURRET", "SPLIT"]);
const FIGHT_MAX_ADVANCE_CALLS = 20_000;
const SETUP_MAX_ADVANCE_CALLS = 480;
const MAX_CONSECUTIVE_NO_PROGRESS = 1_200;
const REDECIDE_TICKS = 15;
const STAGE_GATE_TICKS = 900;
const AUTHORED_WAVE_STARTS = Object.freeze([0, 180, 390]);
const SETUP_CALLS_BY_STANCE = Object.freeze({ VANGUARD: 0, TURRET: 240, SPLIT: 480 });
const OCTANT_ORDER = Object.freeze(Object.keys(OCTANT_VECTORS).filter((name) => name !== "IDLE"));
const TARGET_CAUSE_ORDER = Object.freeze([
  "COMMANDER_DAMAGED",
  "COMMANDER_GATE_DIVERSION",
  "GATE_BREACHED",
  "HAZARD_DAMAGE",
  "OBJECTIVE_PRESSURE_PULSE",
  "OBJECTIVE_PRESSURE_DEADLINE",
  "TERRAIN_RECOVERY",
  "ENCOUNTER_REWARD_GRANTED",
  "WAVE_CLEARED",
  "PROJECTILE_IMPACT",
  "SKILL_SELECTED_PASSIVE_INTEGRITY",
  "SKILL_CAST_INTEGRITY",
  "WARDENS_VIGIL_REGEN",
  "WARDENS_WARD_TRIGGERED",
]);
// COMMANDER_GATE_DIVERSION is retained in the contract vocabulary as an annotation-only mirror; it never appears in `causes`.
const CONTROLLER = Object.freeze({
  kind: "synthetic",
  policy: "stage1b-public-objective-controller",
  redecideTicks: REDECIDE_TICKS,
  maxAdvanceCalls: FIGHT_MAX_ADVANCE_CALLS,
  maxConsecutiveNoProgress: MAX_CONSECUTIVE_NO_PROGRESS,
  humanEvidenceStatus: "NOT_HUMAN_G7_OR_G8_EVIDENCE",
});

const clone = (value) => structuredClone(value);

function fail(message) {
  throw new Error(`stage1b-pressure: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalBytes(value) {
  return `${canonicalStringify(value)}\n`;
}

function parseArgs(argv) {
  const parsed = {
    output: resolve("qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json"),
    seeds: [...DEFAULT_SEEDS],
    stances: [...DEFAULT_STANCES],
    sourceRevision: "unknown",
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--output" || flag === "--source-revision" || flag === "--seeds" || flag === "--stances") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
      index += 1;
      if (flag === "--output") parsed.output = resolve(value);
      else if (flag === "--source-revision") parsed.sourceRevision = value;
      else if (flag === "--seeds") parsed.seeds = value.split(",").map((entry) => Number(entry.trim()));
      else parsed.stances = value.split(",").map((entry) => entry.trim().toUpperCase());
      continue;
    }
    if (flag === "--check") {
      parsed.check = true;
      continue;
    }
    fail(`unknown argument ${flag}`);
  }
  if (!parsed.seeds.length || parsed.seeds.some((seed) => !DEFAULT_SEEDS.includes(seed)) || new Set(parsed.seeds).size !== parsed.seeds.length) {
    fail("seeds must be a unique subset of 401,402,403,404,405");
  }
  if (!parsed.stances.length || parsed.stances.some((stance) => !DEFAULT_STANCES.includes(stance)) || new Set(parsed.stances).size !== parsed.stances.length) {
    fail("stances must be a unique subset of VANGUARD,TURRET,SPLIT");
  }
  return parsed;
}

function integrityState(run) {
  return {
    tick: run.tick,
    gate: run.gate.integrity,
    gateMax: run.gate.maxIntegrity,
    commander: run.commander.integrity,
    commanderMax: run.commander.maxIntegrity,
  };
}

function presentationState(run) {
  return {
    tick: run.tick,
    formationStance: run.formationStance,
    phase: run.objectives.phase,
    gateIntegrity: run.gate.integrity,
    commanderIntegrity: run.commander.integrity,
    growthOffer: Boolean(run.growthOffer),
    extracted: Boolean(run.extracted),
    extractionReady: Boolean(run.extractionProgress.ready),
    occupationCaptured: Boolean(run.occupationProgress.captured),
  };
}

function distanceSquared(left, right) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return (dx * dx) + (dy * dy);
}

function octantToward(origin, target) {
  if (!target) return "IDLE";
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return "IDLE";
  let selected = "IDLE";
  let bestDot = -Infinity;
  for (const name of OCTANT_ORDER) {
    const vector = OCTANT_VECTORS[name];
    const vectorLength = Math.hypot(vector.x, vector.y) || 1;
    const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
    if (dot > bestDot) {
      bestDot = dot;
      selected = name;
    }
  }
  return selected;
}

function nearestEnemy(run) {
  let selected = null;
  let best = Infinity;
  for (const enemy of run.enemies ?? []) {
    const distance = distanceSquared(enemy, run.commander);
    if (distance < best) {
      best = distance;
      selected = enemy;
    }
  }
  return selected;
}

function controllerTarget(run) {
  if (!run.occupationProgress.captured && run.tactics.occupation) return run.tactics.occupation;
  if (run.extractionProgress.ready && run.tactics.extraction) return run.tactics.extraction;
  if (run.objectives.phase === "occupation" && run.tactics.occupation) return run.tactics.occupation;
  if (run.objectives.phase === "extraction" && run.tactics.extraction) return run.tactics.extraction;
  return nearestEnemy(run);
}

function queueRecorded(run, inputType, payload, issued) {
  const before = presentationState(run);
  const queued = queueInput(run, inputType, payload);
  const request = queued.inputs.at(-1);
  if (!request) fail(`public queueInput rejected ${inputType} at tick ${run.tick}`);
  issued.push({
    tick: run.tick,
    inputType,
    inputId: request.inputId,
    payload: clone(payload),
    stateBefore: before,
  });
  return queued;
}

function issueFightInputs(run, state) {
  let next = run;
  const issued = [];
  if (run.growthOffer) {
    const choice = run.growthOffer.choices?.[0];
    if (!choice) fail(`growth offer at tick ${run.tick} has no choices`);
    next = queueRecorded(next, "SKILL_SELECTED", { skillId: choice }, issued);
    return { run: next, issued };
  }

  if (run.tick - state.lastMoveTick >= REDECIDE_TICKS) {
    state.lastMoveTick = run.tick;
    const direction = octantToward(run.commander, controllerTarget(run));
    if (direction !== state.lastOctant) {
      next = queueRecorded(next, "MOVE", { octant: direction }, issued);
      state.lastOctant = direction;
    }
  }

  for (const skillId of run.commander.skills) {
    if (SKILLS[skillId]?.kind === "active" && (run.commander.cooldowns?.[skillId] ?? 0) <= 0) {
      next = queueRecorded(next, "SKILL_CAST", { skillId }, issued);
    }
  }

  if (run.eliteCandidate && !run.extracted) {
    if (!state.extractionRouteRequested) {
      next = queueRecorded(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId }, issued);
      state.extractionRouteRequested = true;
    } else if (run.extractionProgress.ready && !state.extractionAccepted) {
      next = queueRecorded(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId }, issued);
    }
  }
  return { run: next, issued };
}

function eventCauseForTarget(event, target) {
  if (event.type === "COMMANDER_DAMAGED" && target === "commander" && event.damage > 0) return "COMMANDER_DAMAGED";
  if (event.type === "HAZARD_DAMAGE" && target === "commander" && event.entityId === "commander" && event.damage > 0) return "HAZARD_DAMAGE";
  if (event.type === "PROJECTILE_IMPACT" && event.hit && event.targetId === target && event.damage > 0) return "PROJECTILE_IMPACT";
  if (event.type === "OBJECTIVE_PRESSURE_PULSE" && target === "gate" && event.damage > 0) return "OBJECTIVE_PRESSURE_PULSE";
  if (event.type === "OBJECTIVE_PRESSURE_DEADLINE" && target === "gate" && event.damage > 0) return "OBJECTIVE_PRESSURE_DEADLINE";
  if (event.type === "TERRAIN_RECOVERY" && target === "gate" && event.gateRecovery > 0) return "TERRAIN_RECOVERY";
  if (event.type === "TERRAIN_RECOVERY" && target === "commander" && event.commanderRecovery > 0) return "TERRAIN_RECOVERY";
  if (event.type === "WAVE_CLEARED" && target === "gate" && event.gateRecovered > 0) return "WAVE_CLEARED";
  if (event.type === "WAVE_CLEARED" && target === "commander" && event.commanderRecovered > 0) return "WAVE_CLEARED";
  if (event.type === "SKILL_SELECTED" && target === "commander" && Number.isFinite(SKILLS[event.skillId]?.maxIntegrity) && SKILLS[event.skillId].maxIntegrity > 0) return "SKILL_SELECTED_PASSIVE_INTEGRITY";
  if (event.type === "ENCOUNTER_REWARD_GRANTED" && target === "gate" && event.gateRecovered > 0) return "ENCOUNTER_REWARD_GRANTED";
  if (event.type === "ENCOUNTER_REWARD_GRANTED" && target === "commander" && event.commanderRecovered > 0) return "ENCOUNTER_REWARD_GRANTED";
  if (event.type === "SKILL_CAST" && target === "commander" && Number.isFinite(SKILLS[event.skillId]?.integrity) && SKILLS[event.skillId].integrity > 0) return "SKILL_CAST_INTEGRITY";
  if (event.type === "WARDENS_VIGIL_REGEN" && target === "commander" && event.regen > 0) return "WARDENS_VIGIL_REGEN";
  if (event.type === "WARDENS_WARD_TRIGGERED" && target === "commander" && event.shield > 0) return "WARDENS_WARD_TRIGGERED";
  if (event.type === "GATE_BREACHED" && target === "gate" && event.damage > 0) {
    return "GATE_BREACHED";
  }
  return null;
}
function causalEventsForStep(events, before, after, inputs = []) {
  const causalEvents = [...events];
  if (after.commander > before.commander && !events.some((event) => event.type === "TERRAIN_RECOVERY" || event.type === "SKILL_SELECTED")) {
    const skillInput = inputs.find((input) => input.inputType === "SKILL_SELECTED" && Number.isFinite(SKILLS[input.payload?.skillId]?.maxIntegrity));
    if (skillInput) {
      causalEvents.push({
        type: "SKILL_SELECTED",
        skillId: skillInput.payload.skillId,
        eventSequence: null,
        eventId: skillInput.inputId,
        inputId: skillInput.inputId,
      });
    }
  }
  return causalEvents;
}

function causalSource(event) {
  return {
    eventSequence: Number.isInteger(event.eventSequence) ? event.eventSequence : null,
    eventId: event.eventId ?? event.inputId ?? null,
    inputId: event.inputId ?? null,
    spawnEventId: event.spawnEventId ?? event.projectileSpawnEventId ?? null,
  };
}

function isWaveClearRewardMirror(event, events) {
  if (event.type !== "WAVE_CLEARED") return false;
  return events.some((candidate) => (
    candidate.type === "ENCOUNTER_REWARD_GRANTED"
    && candidate.rewardType === "wave-recovery"
    && candidate.tick === event.tick
    && candidate.waveIndex === event.waveIndex
    && candidate.gateRecovered === event.gateRecovered
  ));
}

function buildCompositeRecord(before, after, events, target) {
  const from = before[target];
  const to = after[target];
  const beforeMax = target === "gate" ? before.gateMax : before.commanderMax;
  const afterMax = target === "gate" ? after.gateMax : after.commanderMax;
  const max = Math.max(beforeMax, afterMax);
  const signals = events
    .map((event) => ({
      cause: eventCauseForTarget(event, target),
      event,
      zeroDeltaMirror: isWaveClearRewardMirror(event, events),
    }))
    .filter(({ cause }) => cause !== null);
  const deltaFor = ({ event, cause, zeroDeltaMirror }) => zeroDeltaMirror
    ? 0
    : cause === "TERRAIN_RECOVERY"
      ? (target === "gate" ? event.gateRecovery : event.commanderRecovery)
      : cause === "WAVE_CLEARED" || cause === "ENCOUNTER_REWARD_GRANTED"
        ? (target === "gate" ? event.gateRecovered : event.commanderRecovered)
      : cause === "SKILL_SELECTED_PASSIVE_INTEGRITY"
        // Rank-aware, mirroring `applySkillRankEffects`: a passive grants its full authored
        // `maxIntegrity` at rank 1 and SKILL_RANK_PASSIVE_SHARE of it on every rank-up. Reading
        // the flat catalog value assumed every selection was a first acquisition, so the moment a
        // run ranked a passive UP the auditor expected 120 where the simulation applied 60 and
        // reported it as an unobservable delta. The rank is on the event
        // (`emit(run, "SKILL_SELECTED", { skillId, rank, rankUp })`), so this needs no new state.
        ? Math.round(SKILLS[event.skillId].maxIntegrity * (event.rank === 1 ? 1 : SKILL_RANK_PASSIVE_SHARE))
        : cause === "WARDENS_VIGIL_REGEN"
          ? event.regen
        : cause === "WARDENS_WARD_TRIGGERED"
          ? event.shield
        : cause === "SKILL_CAST_INTEGRITY"
          ? SKILLS[event.skillId].integrity
          : -event.damage;
  const expectedDelta = signals.reduce((total, signal) => total + deltaFor(signal), 0);
  const expectedTo = signals.reduce((value, signal) => Math.max(0, Math.min(max, value + deltaFor(signal))), from);
  const appliedDelta = to - from;
  const clampedExpected = expectedTo - from;
  if (!Number.isInteger(from) || !Number.isInteger(to) || !Number.isInteger(max) || from < 0 || to < 0 || from > max || to > max) {
    fail(`invalid ${target} integrity state at tick ${before.tick}: from=${from}, to=${to}, max=${max}`);
  }
  if (appliedDelta !== clampedExpected) {
    fail(`unobservable ${target} integrity delta at tick ${before.tick}: ${from}->${to}, expected ${clampedExpected}; events=${events.map((event) => `${event.type}:${event.skillId ?? ""}:${event.damage ?? ""}`).join(",")}`);
  }
  const causes = [...new Set(signals.map(({ cause }) => cause))].sort((left, right) => TARGET_CAUSE_ORDER.indexOf(left) - TARGET_CAUSE_ORDER.indexOf(right));
  const sourceEvents = signals.map(({ event }) => causalSource(event)).sort((left, right) => (left.eventSequence ?? Infinity) - (right.eventSequence ?? Infinity));
  return {
    causeAnnotations: signals
      .filter(({ event }) => event.type === "GATE_BREACHED" && event.interceptedFor === "commander")
      .map(() => "COMMANDER_GATE_DIVERSION"),
    tick: before.tick,
    target,
    from,
    to,
    max,
    appliedDelta,
    zeroNet: appliedDelta === 0,
    causes,
    causalEventSequences: sourceEvents.map(({ eventSequence }) => eventSequence),
    causalEventIds: sourceEvents.map(({ eventId }) => eventId).filter(Boolean),
    causalInputIds: sourceEvents.map(({ inputId }) => inputId).filter(Boolean),
    causalSpawnEventIds: sourceEvents.map(({ spawnEventId }) => spawnEventId).filter(Boolean),
    sourcePacketIndex: null,
    sourcePacketIndices: [],
    observationBucketIndex: null,
    clampFlags: {
      fromAtFloor: from === 0,
      fromAtCeiling: from === beforeMax,
      toAtFloor: to === 0,
      toAtCeiling: to === afterMax,
      deltaClamped: appliedDelta !== expectedDelta,
      recoveryClamped: expectedDelta > appliedDelta,
      damageClamped: expectedDelta < appliedDelta,
    },
  };
}

function authoredIntervals(terminalTick) {
  const end = terminalTick + 1;
  const intervals = [
    { id: "pre-system", fromTick: 0, toTick: 0, empty: true },
    { id: "authored-wave-0", fromTick: 0, toTick: 180 },
    { id: "authored-wave-1", fromTick: 180, toTick: 390 },
    { id: "authored-wave-2", fromTick: 390, toTick: Math.min(STAGE_GATE_TICKS, end) },
    { id: "post-system", fromTick: Math.min(STAGE_GATE_TICKS, end), toTick: end },
  ];
  return intervals.map((interval) => ({
    ...interval,
    fromTick: Math.max(0, Math.min(end, interval.fromTick)),
    toTick: Math.max(0, Math.min(end, interval.toTick)),
    empty: interval.empty === true || interval.fromTick === interval.toTick,
  }));
}

function intervalForTick(intervals, tick) {
  const index = intervals.findIndex(({ fromTick, toTick, empty }) => (
    (empty && tick === fromTick) || (!empty && tick >= fromTick && tick < toTick)
  ));
  return index === -1 ? null : index;
}

function extractArrivals(events) {
  const rows = [];
  for (const event of events) {
    if (event.type !== "ENEMY_SPAWNED") continue;
    const wave = event.tick < 180 ? 0 : event.tick < 390 ? 1 : 2;
    rows.push({
      enemyId: event.enemyType,
      count: 1,
      policyId: null,
      lane: event.spawnDirection,
      entityId: event.entityId,
      wave,
      spawnEventId: event.spawnEventId ?? event.eventId,
    });
  }
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.wave}|${row.enemyId}|${row.lane}`;
    const group = grouped.get(key) ?? { ...row, count: 0, entityIds: [], spawnEventIds: [] };
    group.count += 1;
    group.entityIds.push(row.entityId);
    group.spawnEventIds.push(row.spawnEventId);
    grouped.set(key, group);
  }
  return [...grouped.values()].sort((left, right) => left.wave - right.wave || left.enemyId.localeCompare(right.enemyId) || left.lane.localeCompare(right.lane));
}

function newEventsFrom(snapshot, state) {
  const events = snapshot.events
    .filter(({ eventSequence }) => eventSequence > state.lastEventSequence)
    .sort((left, right) => left.eventSequence - right.eventSequence)
    .map(clone);
  if (events.length) state.lastEventSequence = events.at(-1).eventSequence;
  return events;
}

function runOne({ seed, stance }) {
  const formationOverride = {};
  let run = createDefenseRun({
    stageId: STAGE_ID,
    seed,
    companionLoadout: [...LOADOUT],
    rewardIds: [],
    measurementProfileId: null,
    wardenProgress: null,
    wardenEquipment: {},
    companionEquipment: {},
    formation: formationOverride,
  });
  if (run.measurementProfile || run.measurementProfileId || run.wardenState !== null || run.rewardIds.length !== 0 || Object.keys(run.wardenEquipment ?? {}).length !== 0) {
    fail(`forbidden RPG/measurement/reward state for ${stance}:${seed}`);
  }
  const state = {
    lastEventSequence: -1,
    events: [],
    inputs: [],
    ledger: [],
    timeline: new Map(),
    lastMoveTick: -Infinity,
    lastOctant: null,
    lastSituation: null,
    extractionRouteRequested: false,
    extractionAccepted: false,
    setupAdvanceCalls: 0,
    fightAdvanceCalls: 0,
    maxConsecutiveNoProgress: 0,
    consecutiveNoProgress: 0,
  };
  let snapshot = getRunSnapshot(run);
  state.timeline.set(snapshot.tick, integrityState(run));
  const setupTargetCalls = SETUP_CALLS_BY_STANCE[stance];
  for (let index = 0; index < setupTargetCalls; index += 1) {
    if (run.formationStance !== stance && run.tick >= (run.stanceCooldownUntilTick ?? 0) && run.formationStance !== "SPLIT") {
      run = queueRecorded(run, "STANCE_CYCLE", {}, state.inputs);
    }
    const beforeRun = run;
    const before = integrityState(beforeRun);
    run = advanceDefenseRun(run, 1);
    state.setupAdvanceCalls += 1;
    snapshot = getRunSnapshot(run);
    const events = newEventsFrom(snapshot, state);
    state.events.push(...events);
    const after = integrityState(run);
    state.timeline.set(after.tick, after);
    const causalEvents = causalEventsForStep(events, before, after);
    state.ledger.push(...["gate", "commander"].map((target) => buildCompositeRecord(before, after, causalEvents, target)));
  }
  if (run.formationStance !== stance) fail(`setup did not reach ${stance} from public stance cycle calls`);

  while (!isTerminalRun(run) && state.fightAdvanceCalls < FIGHT_MAX_ADVANCE_CALLS) {
    const inputResult = issueFightInputs(run, state);
    run = inputResult.run;
    for (const input of inputResult.issued) state.inputs.push(input);
    const beforeRun = run;
    const before = integrityState(beforeRun);
    run = advanceDefenseRun(run, 1);
    state.fightAdvanceCalls += 1;
    snapshot = getRunSnapshot(run);
    const events = newEventsFrom(snapshot, state);
    state.events.push(...events);
    if (events.some((event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE")) state.extractionAccepted = true;
    const after = integrityState(run);
    state.timeline.set(after.tick, after);
    const causalEvents = causalEventsForStep(events, before, after, inputResult.issued);
    state.ledger.push(...["gate", "commander"].map((target) => buildCompositeRecord(before, after, causalEvents, target)));
    const progressed = after.gate !== before.gate || after.commander !== before.commander || after.tick !== before.tick;
    state.consecutiveNoProgress = progressed ? 0 : state.consecutiveNoProgress + 1;
    state.maxConsecutiveNoProgress = Math.max(state.maxConsecutiveNoProgress, state.consecutiveNoProgress);
    if (state.consecutiveNoProgress > MAX_CONSECUTIVE_NO_PROGRESS) fail(`${stance}:${seed} exceeded no-progress cap`);
    for (const input of inputResult.issued) {
      const disposition = events.find((event) => event.inputId === input.inputId && (event.type === "INPUT_ACCEPTED" || event.type === "INPUT_REJECTED"));
      input.accepted = disposition?.type === "INPUT_ACCEPTED";
      input.disposition = disposition?.type ?? "NOT_RETAINED_IMMEDIATELY";
      input.dispositionReason = disposition?.reason ?? null;
    }
  }
  if (!isTerminalRun(run)) fail(`${stance}:${seed} did not reach terminal within ${FIGHT_MAX_ADVANCE_CALLS} fight advances`);

  const terminalTick = run.tick;
  const intervals = authoredIntervals(terminalTick);
  const eventTickToPacket = new Map();
  for (const event of state.events) {
    const bucket = intervalForTick(intervals, event.tick);
    if (bucket !== null) eventTickToPacket.set(event.eventSequence, bucket);
  }
  for (const input of state.inputs) {
    const bucket = intervalForTick(intervals, input.tick);
    if (bucket !== null) eventTickToPacket.set(input.inputId, bucket);
  }
  for (const record of state.ledger) {
    record.observationBucketIndex = intervalForTick(intervals, record.tick);
    const sourceKeys = [...record.causalEventSequences, ...record.causalEventIds];
    const sourceIndexes = sourceKeys.map((sourceKey) => eventTickToPacket.get(sourceKey)).filter((index) => Number.isInteger(index));
    record.sourcePacketIndices = [...new Set(sourceIndexes)].sort((left, right) => left - right);
    record.sourcePacketIndex = record.sourcePacketIndices.length === 1 ? record.sourcePacketIndices[0] : null;
  }
  for (const record of state.ledger) {
    if (record.appliedDelta !== 0 && record.sourcePacketIndices.length === 0) fail(`unattributed non-zero ledger record at tick ${record.tick}`);
  }
  const positiveIntervals = intervals.filter((interval) => !interval.empty && interval.toTick > interval.fromTick);
  const pressurePackets = positiveIntervals.map((interval, packetIndex) => {
    const records = state.ledger.filter((record) => record.tick >= interval.fromTick && record.tick < interval.toTick);
    const packetEvents = state.events.filter((event) => event.tick >= interval.fromTick && event.tick < interval.toTick);
    const arrivals = extractArrivals(packetEvents);
    const gateBefore = state.timeline.get(interval.fromTick) ?? state.timeline.get(0);
    const gateAfter = state.timeline.get(interval.toTick) ?? state.timeline.get(terminalTick);
    return {
      runId: `stage1b-pressure:${STAGE_ID}:${stance}:${seed}`,
      stageId: STAGE_ID,
      seed,
      stance,
      packetIndex,
      fromTick: interval.fromTick,
      toTick: interval.toTick,
      arrivals,
      gateIntegrityBefore: gateBefore.gate,
      gateIntegrityAfter: gateAfter.gate,
      gateIntegrityLoss: Math.max(0, gateBefore.gate - gateAfter.gate),
      gateNetIntegrityDelta: gateAfter.gate - gateBefore.gate,
      commanderIntegrityBefore: gateBefore.commander,
      commanderIntegrityAfter: gateAfter.commander,
      commanderIntegrityLoss: Math.max(0, gateBefore.commander - gateAfter.commander),
      commanderNetIntegrityDelta: gateAfter.commander - gateBefore.commander,
      pressureEvents: packetEvents.filter((event) => event.type === "GATE_BREACHED" || event.type === "COMMANDER_DAMAGED" || event.type === "HAZARD_DAMAGE" || event.type === "PROJECTILE_IMPACT"),
      terminalPressureEvents: packetEvents.filter((event) => event.type === "OBJECTIVE_PRESSURE_PULSE" || event.type === "OBJECTIVE_PRESSURE_DEADLINE"),
      recoveryEvents: packetEvents.filter((event) => event.type === "TERRAIN_RECOVERY"),
      agencyWindows: packetEvents.filter((event) => event.type === "GROWTH_OFFER" || event.type === "EXTRACTION_WINDOW_OPENED"),
      integrityLedger: records,
      controller: CONTROLLER,
    };
  });
  const bossSpawn = state.events.find((event) => event.type === "BOSS_SPAWNED") ?? null;
  const terminal = state.events.findLast?.((event) => event.type === "TERMINAL") ?? [...state.events].reverse().find((event) => event.type === "TERMINAL") ?? null;
  const bossTtkStatus = bossSpawn && terminal && terminal.outcome !== "DEFEAT" ? "MEASURED" : bossSpawn ? "BOSS_SPAWNED_DEFEAT_BEFORE_KILL" : "NOT_SPAWNED_DEFEAT";
  const noUnknownIntegrityDiffs = state.ledger.every((record) => (
    record.causes.every((cause) => cause !== "UNKNOWN" && cause !== "AMBIGUOUS")
    && (record.appliedDelta === 0 || record.sourcePacketIndex !== null || record.sourcePacketIndices.length > 0)
  ));
  const compositeLedgerOnly = state.ledger.length === (state.setupAdvanceCalls + state.fightAdvanceCalls) * 2
    && state.ledger.every((record, index) => record.target === (index % 2 === 0 ? "gate" : "commander"));
  return {
    runId: `stage1b-pressure:${STAGE_ID}:${stance}:${seed}`,
    stageId: STAGE_ID,
    seed,
    stance,
    setupAdvanceCalls: state.setupAdvanceCalls,
    fightAdvanceCalls: state.fightAdvanceCalls,
    maxAdvanceCalls: FIGHT_MAX_ADVANCE_CALLS,
    terminal: run.terminal,
    terminalTick,
    terminalReason: run.terminal === "DEFEAT" ? "PRESSURE_OR_INTEGRITY_DEFEAT" : "BOSS_DEFEATED",
    bossTtkStatus,
    bossTtkTicks: bossTtkStatus === "MEASURED" ? terminal.bossTtkTicks ?? null : null,
    bossPressureGraceTicks: BOSS_PRESSURE_GRACE_TICKS,
    gateMinPct: Math.min(...state.timeline.values().map(({ gate, gateMax }) => (gate / gateMax) * 100)),
    controller: CONTROLLER,
    loadout: [...LOADOUT],
    forbiddenOverrides: {
      measurementProfile: null,
      wardenProgress: null,
      equipment: {},
      rewardIds: [],
      formation: clone(formationOverride),
    },
    events: state.events,
    inputs: state.inputs,
    temporalIntervals: intervals,
    integrityLedger: state.ledger,
    pressurePackets,
    invariants: {
      setupAdvanceCallsBounded: state.setupAdvanceCalls <= SETUP_MAX_ADVANCE_CALLS,
      fightAdvanceCallsBounded: state.fightAdvanceCalls <= FIGHT_MAX_ADVANCE_CALLS,
      noMeasurementProfile: !run.measurementProfile && !run.measurementProfileId,
      noWardenProgress: run.wardenState === null,
      noEquipment: Object.keys(run.wardenEquipment ?? {}).length === 0,
      noRewards: run.rewardIds.length === 0,
      noFormationOverride: Object.keys(formationOverride).length === 0,
      noUnknownIntegrityDiffs,
      observationIntervalsComplete: intervals[0].fromTick === 0 && intervals.at(-1).toTick === terminalTick + 1,
      noGapsOrOverlaps: intervals.every((interval, index) => index === 0 || interval.fromTick === intervals[index - 1].toTick),
      compositeLedgerOnly,
    },
  };
}


async function fileSha256(path) {
  return sha256(await readFile(path));
}

async function buildReceipt(outputPath, sourceRevision, outputBytes) {
  const scriptPath = new URL(import.meta.url);
  return {
    schemaVersion: 1,
    artifactPath: outputPath,
    sourceRevision,
    inputDigests: {
      script: `sha256:${await fileSha256(scriptPath)}`,
      simulation: `sha256:${await fileSha256(new URL("../defense-run-simulation.js", import.meta.url))}`,
      catalog: `sha256:${await fileSha256(new URL("../defense-catalog.js", import.meta.url))}`,
      rpgCatalog: `sha256:${await fileSha256(new URL("../rpg-catalog.js", import.meta.url))}`,
      contract: `sha256:${await fileSha256(new URL("../_workspace/archive/20260726-stage1b-cinder-pressure-agency/engineering/instrumentation-contract.md", import.meta.url))}`,
    },
    outputSha256: `sha256:${sha256(outputBytes)}`,
    outputByteLength: Buffer.byteLength(outputBytes, "utf8"),
    command: ["node", "scripts/run-stage1b-pressure-packets.mjs", "--output", outputPath, "--source-revision", sourceRevision],
  };
}

function buildPayload(seeds = DEFAULT_SEEDS, stances = DEFAULT_STANCES, sourceRevision = "unknown") {
  const rows = [];
  for (const stance of stances) for (const seed of seeds) rows.push(runOne({ seed, stance }));
  return {
    schemaVersion: 1,
    classification: "deterministic-synthetic-scripted-measurement-not-human-g7-or-g8-evidence",
    sourceRevision,
    stageId: STAGE_ID,
    population: {
      stanceOrder: [...DEFAULT_STANCES],
      seedOrder: [...DEFAULT_SEEDS],
      loadout: [...LOADOUT],
      rowOrder: rows.map(({ stance, seed }) => `${stance}:${seed}`),
      exactDefaultPopulation: seeds.length === DEFAULT_SEEDS.length && stances.length === DEFAULT_STANCES.length,
    },
    controller: CONTROLLER,
    bossPressureGraceTicks: BOSS_PRESSURE_GRACE_TICKS,
    setupAdvanceCalls: { VANGUARD: 0, TURRET: 240, SPLIT: 480, max: SETUP_MAX_ADVANCE_CALLS },
    fightAdvanceCalls: { max: FIGHT_MAX_ADVANCE_CALLS },
    temporalContract: {
      range: "[0,terminalTick+1)",
      observationBucketIndex: "temporal interval index",
      sourcePacketIndex: "nullable causal packet index",
      authoredWaveStarts: [...AUTHORED_WAVE_STARTS],
      finalAuthoredIntervalEndsAt: STAGE_GATE_TICKS,
      postSystemStartsAt: STAGE_GATE_TICKS,
      emptyIntervalsAllowed: true,
      gapsOrOverlaps: "forbidden",
    },
    rows,
    invariants: {
      exactRowCountWhenDefault: rows.length === 15,
      exactStanceOrderWhenDefault: JSON.stringify(stances) === JSON.stringify(DEFAULT_STANCES),
      exactSeedOrderWhenDefault: JSON.stringify(seeds) === JSON.stringify(DEFAULT_SEEDS),
      noWardenProgress: rows.every(({ forbiddenOverrides }) => forbiddenOverrides.wardenProgress === null),
      noEquipment: rows.every(({ forbiddenOverrides }) => Object.keys(forbiddenOverrides.equipment).length === 0),
      noReward: rows.every(({ forbiddenOverrides }) => forbiddenOverrides.rewardIds.length === 0),
      noFormationOverride: rows.every(({ forbiddenOverrides }) => Object.keys(forbiddenOverrides.formation).length === 0),
      allCompositeLedgers: rows.every(({ invariants: rowInvariants }) => rowInvariants.compositeLedgerOnly),
    },
  };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(`cannot read JSON ${path}: ${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = buildPayload(args.seeds, args.stances, args.sourceRevision);
  const outputBytes = canonicalBytes(payload);
  const receiptPath = `${args.output}.receipt.json`;
  if (args.check) {
    const existing = await readJson(args.output);
    const receipt = await readJson(receiptPath);
    if (canonicalBytes(existing) !== outputBytes) fail(`--check output mismatch: ${args.output}`);
    if (receipt.sourceRevision !== args.sourceRevision) fail(`--check source revision mismatch: ${receiptPath}`);
    if (receipt.outputSha256 !== `sha256:${sha256(outputBytes)}`) fail(`--check output hash mismatch: ${receiptPath}`);
    if (receipt.outputByteLength !== Buffer.byteLength(outputBytes, "utf8")) fail(`--check byte length mismatch: ${receiptPath}`);
    return;
  }
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, outputBytes, "utf8");
  const receipt = await buildReceipt(args.output, args.sourceRevision, outputBytes);
  await writeFile(receiptPath, canonicalBytes(receipt), "utf8");
  process.stdout.write(`stage1b-pressure-packets: wrote ${payload.rows.length} rows to ${args.output}\n`);
}

export { buildPayload, runOne, CONTROLLER, DEFAULT_SEEDS, DEFAULT_STANCES };

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) await main();
