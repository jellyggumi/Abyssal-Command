#!/usr/bin/env node
/**
 * Stage 1b Cinder pressure-packet exporter.
 *
 * Measurement only: this script drives the shipped deterministic simulation and
 * derives evidence from its public events and authored wave schedule. Scripted
 * controller output is synthetic and is not human G7 or G8 evidence.
 *
 * Usage:
 *   node scripts/run-stage1b-pressure-packets.mjs --output <path.json>
 *     [--seeds 401,402,403,404,405]
 *     [--stances VANGUARD,TURRET,SPLIT]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  advanceDefenseRun,
  createDefenseRun,
  isTerminalRun,
  queueInput,
  TICK_RATE,
} from "../defense-run-simulation.js";

const STAGE_ID = "cinder-span";
const LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const DEFAULT_SEEDS = [401, 402, 403, 404, 405];
const DEFAULT_STANCES = ["VANGUARD", "TURRET", "SPLIT"];
const MAX_TICKS = 20_000;
const BOSS_PRESSURE_GRACE_TICKS = 30 * TICK_RATE;
const CONTROLLER = Object.freeze({
  kind: "synthetic",
  policy: "fixed-stance-objective-engaged",
  redecideTicks: 1,
  humanEvidenceStatus: "NOT_HUMAN_G7_OR_G8_EVIDENCE",
});
const RELEVANT_DECISION_INPUTS = new Set(["STANCE_CYCLE", "SKILL_SELECTED", "EXTRACT_ELITE"]);
const IRREVERSIBLE_EVENT_TYPES = new Set([
  "GATE_BREACHED",
  "COMMANDER_DAMAGED",
  "HAZARD_DAMAGE",
  "PROJECTILE_IMPACT",
  "COMPANION_DOWNED",
  "ENEMY_DEFEATED",
  "OBJECTIVE_PRESSURE_PULSE",
  "OBJECTIVE_PRESSURE_DEADLINE",
  "OBJECTIVE_COMPLETED",
  "OBJECTIVE_FAILED",
  "EXTRACTION_COMPLETED",
  "ELITE_EXTRACTED",
  "TERMINAL",
]);

const clone = (value) => structuredClone(value);
const finiteDamage = (value) => Number.isFinite(value) && value > 0 ? value : 0;

function stateView(run) {
  return {
    tick: run.tick,
    formationStance: run.formationStance,
    gateIntegrity: run.gate.integrity,
    commanderIntegrity: run.commander.integrity,
    objectivePhase: run.objectives.phase,
    growthOfferStatus: run.growthOffer ? "OPEN" : "CLOSED",
    extractionStatus: run.extracted
      ? "ACCEPTED"
      : run.extractionProgress.failed
        ? "FAILED"
        : run.extractionProgress.completed
          ? "READY"
          : run.extractionProgress.availableAt === null
            ? "NOT_OPENED"
            : "OPEN",
  };
}

function issueInput(run, type, payload, issued) {
  const before = stateView(run);
  const queued = queueInput(run, type, payload);
  const request = queued.inputs.at(-1);
  issued.push({
    inputId: request.inputId,
    inputType: type,
    payload: clone(payload),
    requestedAtTick: run.tick,
    stateBefore: before,
  });
  return queued;
}

function queueControllerInputs(run, stance, memo) {
  let next = run;
  const issued = [];

  if (run.growthOffer) {
    next = issueInput(next, "SKILL_SELECTED", { skillId: run.growthOffer.choices[0] }, issued);
    return { run: next, issued };
  }

  if (run.formationStance !== stance && run.tick >= (run.stanceCooldownUntilTick ?? 0)) {
    next = issueInput(next, "STANCE_CYCLE", {}, issued);
  }

  if (!memo.engagementIssued) {
    next = issueInput(next, "MOVE", { octant: "IDLE" }, issued);
    memo.engagementIssued = true;
  }

  for (const skillId of run.commander.skills) {
    if ((run.commander.cooldowns?.[skillId] ?? 0) <= 0) {
      next = issueInput(next, "SKILL_CAST", { skillId }, issued);
    }
  }

  if (run.eliteCandidate && !run.extracted) {
    if (!memo.routeRequested) {
      next = issueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId }, issued);
      memo.routeRequested = true;
    } else if (run.extractionProgress.completed && !memo.extractionAccepted) {
      next = issueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId }, issued);
    }
  }

  return { run: next, issued };
}

function retainDecisionResults(issued, advanced, decisions) {
  const dispositionByInputId = new Map(
    advanced.events
      .filter(({ type }) => type === "INPUT_ACCEPTED" || type === "INPUT_REJECTED")
      .map((event) => [event.inputId, event]),
  );

  for (const request of issued) {
    if (!RELEVANT_DECISION_INPUTS.has(request.inputType)) continue;
    const disposition = dispositionByInputId.get(request.inputId) ?? null;
    const growthSelectionAccepted = request.inputType === "SKILL_SELECTED"
      && request.stateBefore.growthOfferStatus === "OPEN"
      && advanced.growthOffer === null;
    const accepted = disposition?.type === "INPUT_ACCEPTED" || growthSelectionAccepted;
    decisions.push({
      ...request,
      accepted,
      dispositionStatus: disposition
        ? disposition.type
        : growthSelectionAccepted
          ? "ACCEPTED_STATE_TRANSITION"
          : "NO_RETAINED_DISPOSITION_EVENT",
      dispositionEvent: disposition ? clone(disposition) : null,
      dispositionReason: disposition
        ? disposition.reason
        : growthSelectionAccepted
          ? "Growth selection is observed in the before/after state; the simulation resets pre-tick selection events before returning the advanced run"
          : "No input disposition event or accepted state transition was observed",
      stateAfter: stateView(advanced),
    });
  }
}

function extractAuthoredArrivals(events) {
  const bySlot = new Map();
  let activeWave = null;

  for (const event of events) {
    if (event.type === "WAVE_VARIANT_STARTED") {
      activeWave = {
        slot: event.slot,
        remaining: event.count,
        entities: [],
        rawEvents: [clone(event)],
      };
      bySlot.set(event.slot, activeWave);
      continue;
    }
    if (!activeWave) continue;
    if (event.type === "ENEMY_SPAWNED" && activeWave.remaining > 0) {
      activeWave.entities.push({
        entityId: event.entityId,
        enemyType: event.enemyType,
        policyId: null,
        lane: event.spawnDirection,
      });
      activeWave.rawEvents.push(clone(event));
      activeWave.remaining -= 1;
      continue;
    }
    if (event.type === "ENEMY_POLICY_SELECTED") {
      const entity = activeWave.entities.find(({ entityId }) => entityId === event.entityId);
      if (entity) {
        entity.policyId = event.policyId;
        entity.lane = event.spawnDirection;
        activeWave.rawEvents.push(clone(event));
      }
      if (activeWave.remaining === 0
          && activeWave.entities.every(({ policyId }) => typeof policyId === "string")) {
        activeWave = null;
      }
    }
  }

  for (const wave of bySlot.values()) {
    if (wave.remaining !== 0 || wave.entities.some(({ policyId }) => policyId === null)) {
      throw new Error(`Incomplete authored arrival evidence for packet slot ${wave.slot}`);
    }
  }
  return bySlot;
}

function summarizeArrivals(entities) {
  const groups = new Map();
  for (const entity of entities) {
    const key = `${entity.enemyType}\u0000${entity.policyId}\u0000${entity.lane}`;
    const group = groups.get(key) ?? {
      enemyId: entity.enemyType,
      count: 0,
      policyId: entity.policyId,
      lane: entity.lane,
      entityIds: [],
    };
    group.count += 1;
    group.entityIds.push(entity.entityId);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) =>
    left.enemyId.localeCompare(right.enemyId)
      || left.policyId.localeCompare(right.policyId)
      || left.lane.localeCompare(right.lane));
}

function integrityEffect(event) {
  const damage = finiteDamage(event.damage);
  if (event.type === "GATE_BREACHED") return { target: "gate", damage, recovery: 0, terminalPressure: false };
  if (event.type === "COMMANDER_DAMAGED") return { target: "commander", damage, recovery: 0, terminalPressure: false };
  if (event.type === "HAZARD_DAMAGE" && event.entityId === "commander") {
    return { target: "commander", damage, recovery: 0, terminalPressure: false };
  }
  if (event.type === "PROJECTILE_IMPACT"
      && event.hit
      && (event.targetId === "gate" || event.targetId === "commander")) {
    return { target: event.targetId, damage, recovery: 0, terminalPressure: false };
  }
  if (event.type === "OBJECTIVE_PRESSURE_PULSE" || event.type === "OBJECTIVE_PRESSURE_DEADLINE") {
    return { target: "gate", damage, recovery: 0, terminalPressure: true };
  }
  if (event.type === "TERRAIN_RECOVERY") {
    return {
      target: "both",
      damage: 0,
      recovery: {
        gate: finiteDamage(event.gateRecovery),
        commander: finiteDamage(event.commanderRecovery),
      },
      terminalPressure: false,
    };
  }
  return null;
}

function attributedDamageEvent(event) {
  const effect = integrityEffect(event);
  return effect && effect.damage > 0
    ? { ...clone(event), target: effect.target }
    : null;
}

function accountIntegrity(pressureEvents, terminalPressureEvents, recoveryEvents, before, after) {
  const ordinaryGateLoss = pressureEvents
    .filter(({ target }) => target === "gate")
    .reduce((sum, event) => sum + finiteDamage(event.damage), 0);
  const terminalGateLoss = terminalPressureEvents
    .filter(({ target }) => target === "gate")
    .reduce((sum, event) => sum + finiteDamage(event.damage), 0);
  const commanderLoss = pressureEvents
    .filter(({ target }) => target === "commander")
    .reduce((sum, event) => sum + finiteDamage(event.damage), 0);
  const gateRecovery = recoveryEvents.reduce((sum, event) => sum + finiteDamage(event.gateRecovery), 0);
  const commanderRecovery = recoveryEvents.reduce(
    (sum, event) => sum + finiteDamage(event.commanderRecovery),
    0,
  );

  return {
    gateIntegrityLoss: ordinaryGateLoss + terminalGateLoss,
    ordinaryGateIntegrityLoss: ordinaryGateLoss,
    terminalPressureGateIntegrityLoss: terminalGateLoss,
    commanderIntegrityLoss: commanderLoss,
    gateIntegrityRecovery: gateRecovery,
    commanderIntegrityRecovery: commanderRecovery,
    gateNetIntegrityDelta: before.gate - after.gate,
    commanderNetIntegrityDelta: before.commander - after.commander,
  };
}

function nextIrreversibleEvent(events, afterSequence) {
  const event = events.find((candidate) =>
    candidate.eventSequence > afterSequence
      && IRREVERSIBLE_EVENT_TYPES.has(candidate.type)
      && !(candidate.type === "HAZARD_DAMAGE" && candidate.entityId !== "commander")
      && !(candidate.type === "PROJECTILE_IMPACT"
        && !["gate", "commander"].includes(candidate.targetId)));
  return event
    ? { status: "OBSERVED", event: clone(event) }
    : { status: "NOT_OBSERVED_BEFORE_RUN_END", event: null };
}

function buildAgencyWindows(events, decisions, timeline) {
  const windows = [];
  const accepted = decisions.filter((decision) => decision.accepted);

  for (const sourceEvent of events.filter(({ type }) =>
    type === "GROWTH_OFFER" || type === "EXTRACTION_WINDOW_OPENED")) {
    const inputType = sourceEvent.type === "GROWTH_OFFER" ? "SKILL_SELECTED" : "EXTRACT_ELITE";
    const decision = accepted.find((candidate) =>
      candidate.inputType === inputType && candidate.stateAfter.tick >= sourceEvent.tick) ?? null;
    const anchorSequence = decision?.dispositionEvent?.eventSequence ?? sourceEvent.eventSequence;
    const observedState = timeline.get(sourceEvent.tick) ?? null;
    windows.push({
      type: sourceEvent.type,
      tick: sourceEvent.tick,
      sourceEvent: clone(sourceEvent),
      accepted: Boolean(decision),
      acceptedInput: decision
        ? {
            status: decision.dispositionStatus,
            inputId: decision.inputId,
            inputType: decision.inputType,
            payload: clone(decision.payload),
            acceptedTick: decision.stateAfter.tick,
            dispositionEvent: decision.dispositionEvent,
          }
        : {
            status: "NOT_ACCEPTED_BEFORE_RUN_END",
            inputId: null,
            inputType,
            payload: null,
            acceptedTick: null,
            dispositionEvent: null,
          },
      stateBefore: decision?.stateBefore ?? observedState,
      stateAfter: decision?.stateAfter ?? observedState,
      nextIrreversibleEvent: nextIrreversibleEvent(events, anchorSequence),
    });
  }

  for (const decision of accepted.filter(({ inputType }) => inputType === "STANCE_CYCLE")) {
    const sourceEvent = events.find((event) =>
      event.type === "STANCE_SWITCHED"
        && event.tick === decision.stateAfter.tick
        && event.eventSequence < (decision.dispositionEvent?.eventSequence ?? Infinity)) ?? null;
    const anchorSequence = decision.dispositionEvent?.eventSequence ?? sourceEvent?.eventSequence ?? 0;
    windows.push({
      type: "STANCE_CYCLE",
      tick: decision.stateAfter.tick,
      sourceEvent: sourceEvent ? clone(sourceEvent) : null,
      accepted: true,
      acceptedInput: {
        status: decision.dispositionStatus,
        inputId: decision.inputId,
        inputType: decision.inputType,
        payload: clone(decision.payload),
        acceptedTick: decision.stateAfter.tick,
        dispositionEvent: decision.dispositionEvent,
      },
      stateBefore: decision.stateBefore,
      stateAfter: decision.stateAfter,
      nextIrreversibleEvent: nextIrreversibleEvent(events, anchorSequence),
    });
  }

  return windows.sort((left, right) => left.tick - right.tick
    || (left.sourceEvent?.eventSequence ?? 0) - (right.sourceEvent?.eventSequence ?? 0));
}

function bossGraceForPacket(packet, bossSpawn) {
  if (!bossSpawn) {
    return {
      status: "BOSS_NOT_SPAWNED",
      graceTicks: BOSS_PRESSURE_GRACE_TICKS,
      spawnTick: null,
      graceUntilTickExclusive: null,
      overlapTicks: 0,
      bossArrivalEvents: [],
      nonArrivalBossDamageEventsDuringGrace: [],
    };
  }

  const graceUntil = bossSpawn.tick + BOSS_PRESSURE_GRACE_TICKS;
  const overlapTicks = Math.max(0, Math.min(packet.toTick, graceUntil) - Math.max(packet.fromTick, bossSpawn.tick));
  const duringGrace = (event) => event.tick >= bossSpawn.tick && event.tick < graceUntil;
  const fromBoss = (event) => event.enemyId === bossSpawn.entityId || event.sourceId === bossSpawn.entityId;
  const bossDamage = [...packet.pressureEvents, ...packet.terminalPressureEvents].filter((event) =>
    duringGrace(event) && fromBoss(event));
  return {
    status: overlapTicks > 0
      ? "OVERLAPS_BOSS_GRACE"
      : packet.toTick <= bossSpawn.tick
        ? "BEFORE_BOSS_SPAWN"
        : "AFTER_BOSS_GRACE",
    graceTicks: BOSS_PRESSURE_GRACE_TICKS,
    spawnTick: bossSpawn.tick,
    graceUntilTickExclusive: graceUntil,
    overlapTicks,
    bossArrivalEvents: bossDamage.filter(({ arrival }) => arrival === true).map(clone),
    nonArrivalBossDamageEventsDuringGrace: bossDamage.filter(({ arrival }) => arrival !== true).map(clone),
  };
}

function terminalReason(run) {
  if (!isTerminalRun(run)) return "MAX_TICKS_REACHED_WITHOUT_TERMINAL";
  if (run.terminal !== "DEFEAT") return "BOSS_DEFEATED";
  const causes = [];
  if (run.gate.integrity <= 0) causes.push("GATE_INTEGRITY_ZERO");
  if (run.commander.integrity <= 0) causes.push("COMMANDER_INTEGRITY_ZERO");
  if (run.extractionProgress.failed) causes.push("EXTRACTION_FAILED");
  return causes.length ? `DEFEAT_${causes.join("_AND_")}` : "DEFEAT_REASON_NOT_EXPOSED";
}

function bossTtk(run, events) {
  const bossSpawn = events.find(({ type }) => type === "BOSS_SPAWNED") ?? null;
  const terminal = [...events].reverse().find(({ type }) => type === "TERMINAL") ?? null;
  if (bossSpawn && run.terminal && run.terminal !== "DEFEAT"
      && Number.isFinite(terminal?.bossTtkTicks) && terminal.bossTtkTicks >= 0) {
    return {
      bossTtkStatus: "MEASURED",
      bossTtkTicks: terminal.bossTtkTicks,
      bossTtkSeconds: terminal.bossTtkTicks / TICK_RATE,
      bossTtkReason: "BOSS_DEFEATED",
      bossSpawn,
    };
  }
  const status = bossSpawn
    ? run.terminal === "DEFEAT"
      ? "BOSS_SPAWNED_DEFEAT_BEFORE_KILL"
      : "BOSS_SPAWNED_MAX_TICKS_BEFORE_KILL"
    : run.terminal === "DEFEAT"
      ? "NOT_SPAWNED_DEFEAT"
      : "NOT_SPAWNED_MAX_TICKS";
  return {
    bossTtkStatus: status,
    bossTtkTicks: null,
    bossTtkSeconds: null,
    bossTtkReason: status,
    bossSpawn,
  };
}


function measureRun({ seed, stance }) {
  let run = createDefenseRun({ stageId: STAGE_ID, seed, companionLoadout: LOADOUT });
  const runId = `${STAGE_ID}:${stance}:${seed}`;
  const initial = { gate: run.gate.integrity, commander: run.commander.integrity };
  const events = run.events.map(clone);
  const decisions = [];
  const timeline = new Map([[0, stateView(run)]]);
  const integrityTimeline = new Map([[0, initial]]);
  const memo = { engagementIssued: false, routeRequested: false, extractionAccepted: false };
  let gateMin = run.gate.integrity;
  let commanderMin = run.commander.integrity;
  let stanceReachedAtTick = stance === "VANGUARD" ? 0 : null;

  while (!isTerminalRun(run) && run.tick < MAX_TICKS) {
    const queued = queueControllerInputs(run, stance, memo);
    run = advanceDefenseRun(queued.run, 1);
    retainDecisionResults(queued.issued, run, decisions);
    if (decisions.at(-1)?.inputType === "EXTRACT_ELITE" && decisions.at(-1).accepted) {
      memo.extractionAccepted = true;
    }
    events.push(...run.events.map(clone));
    timeline.set(run.tick, stateView(run));
    integrityTimeline.set(run.tick, { gate: run.gate.integrity, commander: run.commander.integrity });
    gateMin = Math.min(gateMin, run.gate.integrity);
    commanderMin = Math.min(commanderMin, run.commander.integrity);
    if (stanceReachedAtTick === null && run.formationStance === stance) stanceReachedAtTick = run.tick;
  }

  const schedule = run.waveVariant.schedule;
  const boundaries = schedule.map(({ baseAt }) => baseAt).sort((left, right) => left - right);
  if (boundaries.length !== 3 || new Set(boundaries).size !== boundaries.length) {
    throw new Error(`Expected three distinct authored Cinder packet boundaries, observed ${boundaries.join(",")}`);
  }
  const finalToTick = run.tick + 1;
  const arrivalsBySlot = extractAuthoredArrivals(events);
  const agencyWindows = buildAgencyWindows(events, decisions, timeline);
  const pressurePackets = schedule
    .slice()
    .sort((left, right) => left.baseAt - right.baseAt || left.slot - right.slot)
    .map((wave, packetIndex, ordered) => {
      const fromTick = wave.baseAt;
      const toTick = ordered[packetIndex + 1]?.baseAt ?? finalToTick;
      const packetEvents = events.filter(({ tick }) => tick >= fromTick && tick < toTick);
      const pressureEvents = packetEvents
        .filter((event) => {
          const effect = integrityEffect(event);
          return effect && effect.damage > 0 && !effect.terminalPressure;
        })
        .map(attributedDamageEvent);
      const terminalPressureEvents = packetEvents
        .filter((event) =>
          event.type === "OBJECTIVE_PRESSURE_PULSE" || event.type === "OBJECTIVE_PRESSURE_DEADLINE")
        .map(attributedDamageEvent);
      const recoveryEvents = packetEvents.filter(({ type }) => type === "TERRAIN_RECOVERY").map(clone);
      const beforeTick = fromTick === 0 ? 0 : fromTick - 1;
      const afterTick = toTick - 1;
      const before = integrityTimeline.get(beforeTick);
      const after = integrityTimeline.get(afterTick);
      if (!before || !after) throw new Error(`Missing integrity boundary state for packet ${packetIndex}`);
      const integrity = accountIntegrity(
        pressureEvents,
        terminalPressureEvents,
        recoveryEvents,
        before,
        after,
      );
      const arrivalEvidence = arrivalsBySlot.get(wave.slot);
      if (!arrivalEvidence) throw new Error(`Missing arrival evidence for authored packet slot ${wave.slot}`);
      const packet = {
        runId,
        stageId: STAGE_ID,
        seed,
        stance,
        packetIndex,
        authoredWaveSlot: wave.slot,
        fromTick,
        toTick,
        tickInterval: "FROM_INCLUSIVE_TO_EXCLUSIVE",
        authoredBoundary: {
          baseTick: wave.baseAt,
          actualStartTick: wave.at,
          alternativeId: wave.alternativeId,
          selectionId: wave.selectionId,
          composition: clone(wave.composition),
        },
        arrivals: summarizeArrivals(arrivalEvidence.entities),
        arrivalEvents: arrivalEvidence.rawEvents,
        gateIntegrityBefore: before.gate,
        gateIntegrityAfter: after.gate,
        commanderIntegrityBefore: before.commander,
        commanderIntegrityAfter: after.commander,
        gateIntegrityDelta: after.gate - before.gate,
        commanderIntegrityDelta: after.commander - before.commander,
        ...integrity,
        pressureEvents,
        terminalPressureEvents,
        recoveryEvents,
        agencyWindows: agencyWindows.filter(({ tick }) => tick >= fromTick && tick < toTick),
        bossGrace: null,
        controller: CONTROLLER,
      };
      return packet;
    });

  const ttk = bossTtk(run, events);
  pressurePackets.forEach((packet) => { packet.bossGrace = bossGraceForPacket(packet, ttk.bossSpawn); });
  const allArrivalEntities = [...arrivalsBySlot.values()].flatMap(({ entities }) => entities);
  const aggregateIntegrity = {
    gateIntegrityStart: initial.gate,
    gateIntegrityEnd: run.gate.integrity,
    gateIntegrityMinimum: gateMin,
    gateIntegrityLoss: pressurePackets.reduce((sum, packet) => sum + packet.gateIntegrityLoss, 0),
    ordinaryGateIntegrityLoss: pressurePackets.reduce((sum, packet) => sum + packet.ordinaryGateIntegrityLoss, 0),
    terminalPressureGateIntegrityLoss: pressurePackets.reduce((sum, packet) => sum + packet.terminalPressureGateIntegrityLoss, 0),
    gateIntegrityRecovery: pressurePackets.reduce((sum, packet) => sum + packet.gateIntegrityRecovery, 0),
    commanderIntegrityStart: initial.commander,
    commanderIntegrityEnd: run.commander.integrity,
    commanderIntegrityMinimum: commanderMin,
    commanderIntegrityLoss: pressurePackets.reduce((sum, packet) => sum + packet.commanderIntegrityLoss, 0),
    commanderIntegrityRecovery: pressurePackets.reduce((sum, packet) => sum + packet.commanderIntegrityRecovery, 0),
  };
  const terminalPressureEvents = pressurePackets.flatMap((packet) => packet.terminalPressureEvents);

  return {
    runId,
    stageId: STAGE_ID,
    seed,
    stance,
    stanceReachedAtTick,
    controller: CONTROLLER,
    tickRate: TICK_RATE,
    ticksUsed: run.tick,
    gateMinPct: Number((100 * gateMin / run.gate.maxIntegrity).toFixed(2)),
    terminal: run.terminal ?? "NOT_TERMINAL",
    terminalReason: terminalReason(run),
    bossTtkStatus: ttk.bossTtkStatus,
    bossTtkTicks: ttk.bossTtkTicks,
    bossTtkSeconds: ttk.bossTtkSeconds,
    bossTtkReason: ttk.bossTtkReason,
    bossGrace: ttk.bossSpawn
      ? {
          status: "BOSS_SPAWNED",
          spawnTick: ttk.bossSpawn.tick,
          graceTicks: BOSS_PRESSURE_GRACE_TICKS,
          graceUntilTickExclusive: ttk.bossSpawn.tick + BOSS_PRESSURE_GRACE_TICKS,
        }
      : {
          status: "BOSS_NOT_SPAWNED",
          spawnTick: null,
          graceTicks: BOSS_PRESSURE_GRACE_TICKS,
          graceUntilTickExclusive: null,
        },
    terminalPressureSeparation: {
      ordinaryGateIntegrityLoss: aggregateIntegrity.ordinaryGateIntegrityLoss,
      terminalPressureGateIntegrityLoss: aggregateIntegrity.terminalPressureGateIntegrityLoss,
      terminalPressureEvents,
    },
    packetCount: pressurePackets.length,
    pressurePackets,
    aggregate: {
      arrivals: summarizeArrivals(allArrivalEntities),
      integrity: aggregateIntegrity,
      agencyWindows,
      terminalPressure: {
        status: terminalPressureEvents.length ? "OBSERVED" : "NOT_OBSERVED",
        gateIntegrityLoss: aggregateIntegrity.terminalPressureGateIntegrityLoss,
        events: terminalPressureEvents,
      },
    },
  };
}

function optionValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1] ?? null;
}

function parseList(value, fallback) {
  return value === null ? [...fallback] : value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

const args = process.argv.slice(2);
const output = optionValue(args, "--output");
const seeds = parseList(optionValue(args, "--seeds"), DEFAULT_SEEDS).map(Number);
const stances = parseList(optionValue(args, "--stances"), DEFAULT_STANCES).map((stance) => stance.toUpperCase());
const validSeeds = seeds.length > 0
  && new Set(seeds).size === seeds.length
  && seeds.every((seed) => DEFAULT_SEEDS.includes(seed));
const validStances = stances.length > 0
  && new Set(stances).size === stances.length
  && stances.every((stance) => DEFAULT_STANCES.includes(stance));

if (!output || output.startsWith("-") || !validSeeds || !validStances) {
  console.error(
    "Usage: node scripts/run-stage1b-pressure-packets.mjs --output <path.json> "
      + "[--seeds 401,402,403,404,405] [--stances VANGUARD,TURRET,SPLIT]",
  );
  process.exit(1);
}

const rows = [];
for (const stance of stances) {
  for (const seed of seeds) rows.push(measureRun({ seed, stance }));
}

const payload = {
  schemaVersion: 1,
  classification: "deterministic-synthetic-scripted-measurement-not-human-g7-or-g8-evidence",
  controller: CONTROLLER,
  bossPressureGraceTicks: BOSS_PRESSURE_GRACE_TICKS,
  bossPressureGraceSource: "30 seconds at exported simulation TICK_RATE",
  samplePlan: {
    stageId: STAGE_ID,
    seeds,
    stances,
    loadout: LOADOUT,
    authoredPacketFromTicks: rows[0].pressurePackets.map(({ fromTick }) => fromTick),
    expectedRunCount: seeds.length * stances.length,
    maxTicksPerRun: MAX_TICKS,
  },
  rows,
};

const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`stage1b-pressure-packets: wrote ${rows.length} run rows to ${outputPath}`);
