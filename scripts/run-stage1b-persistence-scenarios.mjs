#!/usr/bin/env node
/**
 * Stage 1b Cinder persistence evidence.
 *
 * Deterministic synthetic scenarios driven through public simulation and campaign
 * APIs. Evidence is written as canonical UTF-8 JSON with fixed deterministic
 * inputs and persistent campaign handoff ordering.
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
  TICK_RATE,
} from "../defense-run-simulation.js";
import {
  applyCampaignRunResult,
  applyEliteExtractionEvents,
  createCampaign,
  serializeCampaign,
  startRun,
} from "../campaign-state.js";
import { ARENA, COMMANDER, OCTANT_VECTORS, SKILLS } from "../defense-catalog.js";
import { canonicalStringify } from "../g2-full-route-runner.js";

const STAGE_ID = "cinder-span";
const CAMPAIGN_ID = "stage1b-cinder-persistence";
const FIXED_LOADOUT = Object.freeze(["ember-cohort", "rift-lens", "veil-vanguard"]);
const MAX_ADVANCE_CALLS = 20_000;
const MAX_CONSECUTIVE_NO_PROGRESS = 1_200;
const CADENCE_TICKS = 15;

const SCENARIOS = Object.freeze([
  Object.freeze({
    scenario: "victory",
    seed: 901,
    acceptExtract: true,
    moveOnlyAfterAcceptance: false,
  }),
  Object.freeze({
    scenario: "defeat-before-acceptance",
    seed: 902,
    acceptExtract: false,
    moveOnlyAfterAcceptance: false,
    expectedTerminal: "DEFEAT",
  }),
  Object.freeze({
    scenario: "defeat-after-acceptance",
    seed: 901,
    acceptExtract: true,
    moveOnlyAfterAcceptance: true,
    requirePressureDeadlineDefeat: true,
    expectedTerminal: "DEFEAT",
    occupationAfterTick: 3700,
    preOccupationTarget: "extraction",
  }),
]);


const ALLOWED_INPUT_TYPES = new Set(["MOVE", "SKILL_CAST", "SKILL_SELECTED", "EXTRACT_ELITE"]);
const CONTROLLER_MEMO = Object.freeze({
  lastMoveTick: -Infinity,
  lastOctant: null,
  lastSituation: null,
});
const OCTANT_ORDER = Object.freeze(Object.keys(OCTANT_VECTORS).filter((name) => name !== "IDLE"));

const clone = (value) => structuredClone(value);

function fail(message) {
  throw new Error(`stage1b-persistence: ${message}`);
}

function usage() {
  return "Usage: node scripts/run-stage1b-persistence-scenarios.mjs --output <path.json> [--source-revision <revision>] [--check]";
}

function parseArguments(argv) {
  const parsed = {
    output: null,
    check: false,
    sourceRevision: "unknown",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${usage()}: --output requires a path`);
      if (parsed.output) fail(`${usage()}: duplicate --output`);
      parsed.output = resolve(value);
      index += 1;
      continue;
    }

    if (flag === "--source-revision") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${usage()}: --source-revision requires a value`);
      parsed.sourceRevision = value;
      index += 1;
      continue;
    }

    if (flag === "--check") {
      parsed.check = true;
      continue;
    }

    fail(`${usage()}: unknown flag ${flag}`);
  }

  if (!parsed.check && !parsed.output) {
    fail(`${usage()}`);
  }

  return parsed;
}

function canonicalBytes(value) {
  return `${canonicalStringify(value)}\n`;
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function campaignEvidence(campaign) {
  const serialized = serializeCampaign(campaign);
  return {
    ...serialized,
    capturedEliteIds: serialized.companionCollection
      .flatMap(({ capturedEliteIds }) => capturedEliteIds)
      .sort(),
  };
}

function campaignSchema(campaign) {
  return Object.keys(campaign).sort();
}

function createScenarioCampaign() {
  return createCampaign({ campaignId: CAMPAIGN_ID, resetEpoch: 0 });
}

function createRunFromCampaign(_campaign, seed) {
  return createDefenseRun({
    stageId: STAGE_ID,
    seed,
    companionLoadout: [...FIXED_LOADOUT],
  });
}


function valueDiff(before, after, path = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    Array.isArray(before)
    || Array.isArray(after)
    || before === null
    || after === null
    || typeof before !== "object"
    || typeof after !== "object"
  ) {
    return [{ path: path || "/", status: "CHANGED", before, after }];
  }

  const rows = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    const childPath = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
    if (!Object.hasOwn(before, key)) {
      rows.push({ path: childPath, status: "ADDED", before: null, after: after[key] });
      continue;
    }
    if (!Object.hasOwn(after, key)) {
      rows.push({ path: childPath, status: "REMOVED", before: before[key], after: null });
      continue;
    }
    rows.push(...valueDiff(before[key], after[key], childPath));
  }

  return rows;
}

function annotateDiffs(rows, segment) {
  return rows.map((row) => ({ ...row, segment }));
}

function movementSituation(snapshot) {
  return [
    snapshot.bossSpawned ? 1 : 0,
    snapshot.eliteCandidate ? 1 : 0,
    snapshot.objectivePressure?.phase ?? snapshot.objectives?.phase ?? "",
    Math.floor((snapshot.commander.integrity / snapshot.commander.maxIntegrity) * 4),
  ].join("|");
}

function nearestEnemy(snapshot) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const enemy of snapshot.enemies ?? []) {
    const dx = enemy.x - snapshot.commander.x;
    const dy = enemy.y - snapshot.commander.y;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = enemy;
    }
  }
  return nearest;
}

function objectiveTarget(snapshot, definition) {
  if (definition.preOccupationTarget && !snapshot.occupationProgress?.captured && snapshot.tick < (definition.occupationAfterTick ?? 0)) {
    return snapshot.tactics?.[definition.preOccupationTarget] ?? null;
  }
  if (!snapshot.occupationProgress?.captured && snapshot.tactics?.occupation && snapshot.tick >= (definition.occupationAfterTick ?? 0)) return snapshot.tactics.occupation;
  if (snapshot.eliteCandidate && !snapshot.extractionProgress?.completed && snapshot.tactics?.extraction && snapshot.tick >= (definition.extractAfterTick ?? 0)) return snapshot.tactics.extraction;
  if (snapshot.objectives?.phase === "occupation" && snapshot.tick >= (definition.occupationAfterTick ?? 0)) return snapshot.tactics?.occupation;
  if (snapshot.objectives?.phase === "extraction" && snapshot.tick >= (definition.extractAfterTick ?? 0)) return snapshot.tactics?.extraction;
  return nearestEnemy(snapshot) ?? null;
}

function distanceSquared(left, right) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return (dx * dx) + (dy * dy);
}

function projectedCommanderMoveSpeed(snapshot) {
  let multiplier = 1.0;
  const tactics = snapshot.tactics;
  if (
    snapshot.occupationProgress?.captured
    || (tactics?.occupation && distanceSquared(snapshot.commander, tactics.occupation) <= tactics.occupation.radius * tactics.occupation.radius)
  ) {
    multiplier *= tactics?.occupation?.effects?.moveMultiplier || 1.15;
  }
  return Math.trunc(COMMANDER.speed * multiplier);
}

function octantToward(from, target) {
  if (!target) return "IDLE";
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return "IDLE";
  if (Math.hypot(dx, dy) < (target.radius ?? 400) * 0.5) return "IDLE";

  let selected = null;
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

  return selected ?? "IDLE";
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}


function octantAwayFromBoss(snapshot) {
  const boss = (snapshot.enemies ?? []).find((enemy) => enemy.class === "boss" && enemy.alive !== false);
  if (!boss) return "IDLE";

  const commanderSpeed = Math.max(1, Math.trunc(projectedCommanderMoveSpeed(snapshot) / TICK_RATE));
  const bossSpeed = Math.max(1, Math.trunc(boss.speed / TICK_RATE));
  const project = (octant) => {
    const vector = OCTANT_VECTORS[octant];
    let commander = { x: snapshot.commander.x, y: snapshot.commander.y };
    let pursuer = { x: boss.x, y: boss.y };

    for (let tick = 0; tick < CADENCE_TICKS; tick += 1) {
      commander = {
        x: clamp(commander.x + Math.trunc(vector.x * commanderSpeed / 1000), 0, ARENA.width),
        y: clamp(commander.y + Math.trunc(vector.y * commanderSpeed / 1000), 0, ARENA.height),
      };
      const dx = commander.x - pursuer.x;
      const dy = commander.y - pursuer.y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) continue;
      const movement = Math.min(
        Math.abs(pursuer.x - 18000) <= 2200 ? Math.trunc(bossSpeed * 0.85) : bossSpeed,
        distance,
      );
      pursuer = {
        x: clamp(Math.round(pursuer.x + (dx / distance) * movement), 0, ARENA.width),
        y: clamp(Math.round(pursuer.y + (dy / distance) * movement), 0, ARENA.height),
      };
    }

    return distanceSquared(commander, pursuer);
  };

  let selected = "IDLE";
  let bestDistance = project(selected);
  for (const octant of OCTANT_ORDER) {
    const distance = project(octant);
    if (distance > bestDistance) {
      bestDistance = distance;
      selected = octant;
    }
  }
  return selected;
}


function newControllerMemo() {
  return {
    ...CONTROLLER_MEMO,
    acceptedEliteExtractCount: 0,
    extractionRequested: false,
  };
}

function collectNewEvents(snapshot, state) {
  const events = snapshot.events
    .filter(({ eventSequence }) => eventSequence > state.seenEventSequence)
    .sort((left, right) => left.eventSequence - right.eventSequence);
  if (!events.length) return [];
  state.seenEventSequence = events.at(-1).eventSequence;
  return events.map(clone);
}

function buildInputs(run, snapshot, definition, memo, state) {
  const nextInputs = [];
  let next = run;

  memo.lastSituation = movementSituation(snapshot);

  const queue = (type, payload) => {
    const withInput = queueInput(next, type, payload);
    const request = withInput.inputs.at(-1);
    if (!request) fail(`unable to queue ${type} at tick ${snapshot.tick}`);

    nextInputs.push({
      tick: snapshot.tick,
      inputType: type,
      inputId: request.inputId,
      payload: clone(payload),
      requestedSituation: memo.lastSituation,
    });

    next = withInput;
  };

  const moveOnly = definition.moveOnlyAfterAcceptance && memo.acceptedEliteExtractCount > 0;
  if (moveOnly) {
    if (snapshot.tick - memo.lastMoveTick >= CADENCE_TICKS) {
      memo.lastMoveTick = snapshot.tick;
      const octant = octantAwayFromBoss(snapshot);

      if (octant !== memo.lastOctant) {
        if (octant !== "IDLE") {
          queue("MOVE", { octant });
        }
        memo.lastOctant = octant;
      }
    }
    return { run: next, nextInputs };
  }

  if (snapshot.growthOffer) {
    const choice = snapshot.growthOffer.choices?.[0];
    if (!choice) fail(`growth offer at tick ${snapshot.tick} has no choices`);
    queue("SKILL_SELECTED", { skillId: choice });
    return { run: next, nextInputs };
  }

  if (snapshot.tick - memo.lastMoveTick >= CADENCE_TICKS) {
    const target = objectiveTarget(snapshot, definition);
    memo.lastMoveTick = snapshot.tick;
    const octant = octantToward(snapshot.commander, target);

    if (octant !== memo.lastOctant) {
      if (octant !== "IDLE") {
        queue("MOVE", { octant });
      }
      memo.lastOctant = octant;
    }
  }

  for (const skillId of snapshot.commander.skills) {
    if (SKILLS[skillId]?.kind === "active" && (snapshot.commander.cooldowns[skillId] ?? 0) <= 0) {
      queue("SKILL_CAST", { skillId });
    }
  }

  if (
    definition.acceptExtract
    && !memo.extractionRequested
    && snapshot.eliteCandidate
    && snapshot.extractionProgress?.ready
    && snapshot.tick >= (definition.extractAfterTick ?? 0)
  ) {
    queue("EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
    memo.extractionRequested = true;
  }

  return { run: next, nextInputs };
}
function updatePressureDeadline(state, snapshot) {
  if (Number.isInteger(snapshot.objectivePressure?.deadlineTick)) {
    state.requiredPressureDeadline = snapshot.objectivePressure.deadlineTick;
  }
}

function acceptedEliteHandoffs(state) {
  const extractionEvents = state.events.filter(({ type }) => type === "ELITE_EXTRACTED");
  const acceptedInputs = state.events.filter((event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE");

  const handoffs = [];
  for (const event of extractionEvents) {
    const accepted = acceptedInputs.find((input) => input.eventSequence > event.eventSequence && input.tick === event.tick);
    if (!accepted) continue;

    if (!event.eventId || !event.eliteId || !event.prototype) {
      fail(`ELITE_EXTRACTED event at tick ${event.tick} must include eventId/eliteId/prototype`);
    }

    handoffs.push({
      tick: event.tick,
      eventSequence: event.eventSequence,
      eventId: event.eventId,
      eliteId: event.eliteId,
      prototype: event.prototype,
      inputAcceptedEventSequence: accepted.eventSequence,
      inputId: accepted.inputId,
    });
  }

  const unique = new Map();
  for (const handoff of handoffs) {
    unique.set(`${handoff.eliteId}|${handoff.eventId}`, handoff);
  }

  return [...unique.values()].sort((left, right) => left.eventSequence - right.eventSequence);
}

function buildWrites(handoffs) {
  return handoffs.map((handoff, index) => ({
    writeIndex: index,
    acceptedExtract: true,
    tick: handoff.tick,
    eventSequence: handoff.eventSequence,
    eventId: handoff.eventId,
    eliteId: handoff.eliteId,
    prototype: handoff.prototype,
    inputId: handoff.inputId,
    inputAcceptedEventSequence: handoff.inputAcceptedEventSequence,
  }));
}

function runSingleScenario(definition) {
  const campaignInitialObject = createScenarioCampaign();
  const campaignInitial = campaignEvidence(campaignInitialObject);
  const campaignPostStartObject = startRun(campaignInitialObject, STAGE_ID);
  const campaignPostStart = campaignEvidence(campaignPostStartObject);

  const state = {
    seenEventSequence: -1,
    events: [],
    inputs: [],
    maxObservedNoProgress: 0,
    requiredPressureDeadline: null,
  };

  const memo = newControllerMemo();

  let run = createRunFromCampaign(campaignPostStartObject, definition.seed);
  let snapshot = getRunSnapshot(run);
  state.requiredPressureDeadline = snapshot.objectivePressure?.deadlineTick ?? null;
  state.events.push(...collectNewEvents(snapshot, state));
  memo.acceptedEliteExtractCount = state.events.filter(
    (event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE",
  ).length;

  memo.fleePattern = definition.fleePattern ?? null;
  let consecutiveNoProgress = 0;
  memo.fleeSegment = definition.fleeSegment ?? 20;
  let advanceCalls = 0;

  while (!isTerminalRun(run) && advanceCalls < MAX_ADVANCE_CALLS) {
    const inputResult = buildInputs(run, snapshot, definition, memo, state);
    const before = getRunSnapshot(run);

    run = advanceDefenseRun(inputResult.run, 1);
    advanceCalls += 1;

    const after = getRunSnapshot(run);
    updatePressureDeadline(state, after);
    const progressed = after.commander.x !== before.commander.x || after.commander.y !== before.commander.y;
    consecutiveNoProgress = progressed ? 0 : consecutiveNoProgress + 1;

    if (consecutiveNoProgress > MAX_CONSECUTIVE_NO_PROGRESS) {
      fail(`${definition.scenario} exceeded maxConsecutiveNoProgress ${MAX_CONSECUTIVE_NO_PROGRESS} at tick ${after.tick}`);
    }

    state.maxObservedNoProgress = Math.max(state.maxObservedNoProgress, consecutiveNoProgress);

    const newEvents = collectNewEvents(after, state);
    state.events.push(...newEvents);
    const acceptedEliteExtractCount = state.events.filter(
      (event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE",
    ).length;
    if (memo.acceptedEliteExtractCount === 0 && acceptedEliteExtractCount > 0) {
      memo.lastOctant = null;
      memo.lastMoveTick = -Infinity;
    }
    memo.acceptedEliteExtractCount = acceptedEliteExtractCount;
    const dispositions = new Map(
      newEvents
        .filter((event) => event.type === "INPUT_ACCEPTED" || event.type === "INPUT_REJECTED")
        .map((event) => [event.inputId, event]),
    );

    for (const input of inputResult.nextInputs) {
      const disposition = dispositions.get(input.inputId);
      input.disposition = disposition?.type ?? "NOT_RETAINED_IMMEDIATELY";
      input.dispositionReason = disposition?.reason ?? null;
      input.accepted = disposition?.type === "INPUT_ACCEPTED";
    }

    if (inputResult.nextInputs.length) {
      state.inputs.push(...inputResult.nextInputs.map(clone));
    }

    snapshot = after;
  }

  if (!isTerminalRun(run)) {
    fail(`${definition.scenario} did not reach terminal outcome within ${MAX_ADVANCE_CALLS} advances`);
  }

  if (definition.expectedTerminal && snapshot.terminal !== definition.expectedTerminal) {
    fail(`${definition.scenario} expected terminal ${definition.expectedTerminal}, observed ${snapshot.terminal} at tick ${snapshot.tick}`);
  }

  if (definition.requirePressureDeadlineDefeat) {
    const hasDeadline = Number.isInteger(state.requiredPressureDeadline);
    const deadlineEvent = state.events.some((event) => event.type === "OBJECTIVE_PRESSURE_DEADLINE");
    const reachedDeadline = hasDeadline && snapshot.tick >= state.requiredPressureDeadline;
    if (!hasDeadline || !deadlineEvent || snapshot.terminal !== "DEFEAT" || !reachedDeadline) {
      fail(
        `${definition.scenario} must reach pressure-deadline defeat (expected tick >= ${state.requiredPressureDeadline}), observed ${snapshot.terminal} at ${snapshot.tick}`,
      );
    }
  }

  const handoffs = acceptedEliteHandoffs(state);
  const extractionEventCount = state.events.filter((event) => event.type === "ELITE_EXTRACTED").length;

  if (definition.acceptExtract && handoffs.length !== 1) {
    fail(`${definition.scenario} expected exactly one accepted extraction handoff, observed ${handoffs.length}`);
  }
  if (!definition.acceptExtract && handoffs.length !== 0) {
    fail(`${definition.scenario} must not persist extraction, observed ${handoffs.length}`);
  }

  const requestedExtractCount = state.inputs.filter((input) => input.inputType === "EXTRACT_ELITE").length;
  if (requestedExtractCount > 1) {
    fail(`${definition.scenario} must not queue more than one EXTRACT_ELITE input`);
  }

  const applyCandidates = handoffs.map(({ eventId, eliteId, prototype }) => ({ eventId, eliteId, prototype }));
  const campaignPostExtractionObject = applyEliteExtractionEvents(campaignPostStartObject, applyCandidates);
  const campaignPostExtraction = campaignEvidence(campaignPostExtractionObject);

  const outcome = snapshot.terminal === "DEFEAT"
    ? "defeat"
    : snapshot.terminal === "FINAL_COMPLETION"
      ? "FINAL_COMPLETION"
      : "victory";
  const campaignFinalObject = applyCampaignRunResult(campaignPostExtractionObject, {
    stageId: STAGE_ID,
    outcome,
  });
  const campaignFinal = campaignEvidence(campaignFinalObject);

  const campaignDiffs = {
    initialToPostStart: valueDiff(campaignInitial, campaignPostStart),
    postStartToPostExtraction: valueDiff(campaignPostStart, campaignPostExtraction),
    postExtractionToFinal: valueDiff(campaignPostExtraction, campaignFinal),
  };
  const campaignDiff = [
    ...annotateDiffs(campaignDiffs.initialToPostStart, "INITIAL_TO_POST_START"),
    ...annotateDiffs(campaignDiffs.postStartToPostExtraction, "POST_START_TO_POST_EXTRACTION"),
    ...annotateDiffs(campaignDiffs.postExtractionToFinal, "POST_EXTRACTION_TO_FINAL"),
  ];

  const campaignSchemaInitial = campaignSchema(campaignInitial);
  const campaignSchemaPostStart = campaignSchema(campaignPostStart);
  const campaignSchemaPostExtraction = campaignSchema(campaignPostExtraction);
  const campaignSchemaFinal = campaignSchema(campaignFinal);

  const rewardSelections = state.inputs.filter((input) => input.inputType === "REWARD_SELECTED");
  const unexpectedInputs = state.inputs.filter((input) => !ALLOWED_INPUT_TYPES.has(input.inputType));
  const inputAcceptedEvidence = state.events
    .filter((event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE")
    .map(clone);
  const writes = buildWrites(handoffs);
  const acceptedEliteExtractCount = handoffs.length;
  const extractorAppliedBeforeCampaignResult =
    campaignPostExtraction.lastResolution === null
    && campaignFinal.lastResolution !== null;

  const acceptance = {
    extractorAppliedBeforeCampaignResult,
    extractionEventCount,
    inputAcceptedCount: acceptedEliteExtractCount,
    requestedExtractCount,
    acceptedHandoffs: handoffs,
    acceptedEliteExtractCount,
    extractedEliteHandoffsOrdered: handoffs.every((handoff, index) => index === 0 || handoff.eventSequence >= handoffs[index - 1].eventSequence),
  };

  return {
    scenario: definition.scenario,
    seed: definition.seed,
    stageId: STAGE_ID,
    realizationStatus: "REALIZED",
    eventTraceStatus: "RETAINED",
    terminal: snapshot.terminal,
    acceptedEliteExtractCount,
    terminalTick: snapshot.tick,
    outcome,
    objectivePressure: {
      deadlineTick: state.requiredPressureDeadline,
      deadlineSatisfied: Number.isInteger(state.requiredPressureDeadline) && snapshot.tick >= state.requiredPressureDeadline,
    },
    maxAdvanceCalls: advanceCalls,
    policy: {
      kind: "synthetic",
      cadenceTicks: CADENCE_TICKS,
      loadout: [...FIXED_LOADOUT],
      moveOnlyAfterAcceptance: definition.moveOnlyAfterAcceptance,
      acceptExtract: definition.acceptExtract,
      requirePressureDeadlineDefeat: Boolean(definition.requirePressureDeadlineDefeat),
      occupationAfterTick: definition.occupationAfterTick ?? null,
      preOccupationTarget: definition.preOccupationTarget ?? null,
      lastMoveTick: memo.lastMoveTick,
      lastOctant: memo.lastOctant,
      lastSituation: memo.lastSituation,
    },
    events: state.events,
    inputs: state.inputs,
    rewardSelections,
    writes,
    acceptedHandoffs: handoffs,
    inputAcceptedEvidence,
    inputTypeValidation: {
      unexpectedInputTypes: unexpectedInputs.map((input) => input.inputType),
      allInputTypes: [...new Set(state.inputs.map((input) => input.inputType))],
    },
    acceptance,
    campaignBefore: campaignPostStart,
    campaignAfter: campaignFinal,
    campaignDiff,
    campaign: {
      initial: campaignInitial,
      postStart: campaignPostStart,
      postExtraction: campaignPostExtraction,
      final: campaignFinal,
      diffs: campaignDiffs,
      schema: {
        initial: campaignSchemaInitial,
        postStart: campaignSchemaPostStart,
        postExtraction: campaignSchemaPostExtraction,
        final: campaignSchemaFinal,
      },
    },
    campaignSchema: {
      initial: campaignSchemaInitial,
      postStart: campaignSchemaPostStart,
      postExtraction: campaignSchemaPostExtraction,
      final: campaignSchemaFinal,
    },
    invariants: {
      scenario: definition.scenario,
      maxAcceptedHandoffs: 1,
      maxConsecutiveNoProgressObserved: state.maxObservedNoProgress,
      noUnexpectedInputTypes: unexpectedInputs.length === 0,
      noSecondExtractionAttempt: requestedExtractCount <= 1,
      noMonetizationInputs: rewardSelections.length === 0,
      writeRequiresAcceptedInput: writes.length === acceptedEliteExtractCount,
      writesWithoutAcceptedExtract: writes.length - acceptedEliteExtractCount,
      acceptedEliteExtractCount,
    },
    invariantChecks: {
      noUnexpectedInputTypes: unexpectedInputs.length === 0,
      extractorAppliedBeforeCampaignResult,
      noSecondExtractionAttempt: requestedExtractCount <= 1,
      writesWithoutAcceptedExtract: writes.length === acceptedEliteExtractCount,
      noMonetizationInputs: rewardSelections.length === 0,
      acceptanceConsistent: acceptedEliteExtractCount === inputAcceptedEvidence.length,
      acceptanceConsistentWithEvents: extractionEventCount === acceptedEliteExtractCount,
      campaignDiffRetained: campaignDiff.length > 0,
    },
    maxNoProgressObserved: state.maxObservedNoProgress,
  };
}

function runScenarioWithReplay(definition) {
  const first = runSingleScenario(definition);
  const replay = runSingleScenario(definition);
  const firstBytes = canonicalBytes(first);
  const replayBytes = canonicalBytes(replay);

  if (firstBytes !== replayBytes) {
    fail(`scenario ${definition.scenario} failed replay byte identity check`);
  }

  return {
    ...first,
    replay: {
      status: "IDENTICAL",
      canonicalByteLength: Buffer.byteLength(firstBytes, "utf8"),
      canonicalSha256: `sha256:${sha256Hex(firstBytes)}`,
    },
  };
}

function invariantSummary(scenarios) {
  return {
    scenarioCount: scenarios.length === SCENARIOS.length,
    allTerminal: scenarios.every((scenario) => Boolean(scenario.terminal)),
    replayMatches: scenarios.every((scenario) => scenario.replay?.status === "IDENTICAL"),
    monotonicAdvance: scenarios.every((scenario) => scenario.maxAdvanceCalls <= MAX_ADVANCE_CALLS),
    noUnexpectedInputTypes: scenarios.every((scenario) => scenario.invariantChecks?.noUnexpectedInputTypes),
    noPreAcceptanceWrite: scenarios.every((scenario) => scenario.writes.every((write) => write.acceptedExtract)),
    acceptedWritePersists: scenarios.every((scenario) => scenario.writes.length === scenario.acceptance?.inputAcceptedCount),
  };
}

function buildPayload(sourceRevision) {
  const scenarios = SCENARIOS.map(runScenarioWithReplay);
  return {
    schemaVersion: 1,
    stageId: STAGE_ID,
    sourceRevision,
    classification: "synthetic-scripted-evidence-not-human-g7-g8",
    humanEvidenceStatus: "NOT_CLAIMED",
    controller: {
      kind: "synthetic",
      policy: "public-input-apis-only",
      cadenceTicks: CADENCE_TICKS,
      maxAdvanceCalls: MAX_ADVANCE_CALLS,
      maxConsecutiveNoProgress: MAX_CONSECUTIVE_NO_PROGRESS,
      loadout: [...FIXED_LOADOUT],
      campaignId: CAMPAIGN_ID,
    },
    scenarioCount: scenarios.length,
    scenarioOrder: SCENARIOS.map(({ scenario }) => scenario),
    setup: {
      status: "EMPTY_CAMPAIGN_START",
      baselineCaptures: [],
    },
    scenarios,
    invariants: invariantSummary(scenarios),
  };
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function parseJsonFile(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(`cannot parse ${path}: ${error.message}`);
  }
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  const output = parsed.output ?? resolve("qa/evidence/gates/G7/stage1b-persistence-scenarios.json");
  const receiptPath = `${output}.receipt.json`;
  const payload = buildPayload(parsed.sourceRevision);
  const bytes = canonicalBytes(payload);

  if (parsed.check) {
    const expected = await parseJsonFile(output);
    const receipt = await parseJsonFile(receiptPath);
    if (canonicalBytes(expected) !== bytes) fail(`--check output mismatch: ${output}`);
    if (receipt.sourceRevision !== parsed.sourceRevision) fail(`--check receipt source revision mismatch: ${receiptPath}`);
    if (receipt.outputSha256 !== `sha256:${sha256Hex(bytes)}`) fail(`--check receipt hash mismatch: ${receiptPath}`);
    if (receipt.outputByteLength !== Buffer.byteLength(bytes, "utf8")) fail(`--check receipt byte length mismatch: ${receiptPath}`);
    return;
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes, "utf8");
  const receipt = {
    schemaVersion: 1,
    artifactPath: output,
    sourceRevision: parsed.sourceRevision,
    inputDigests: {
      script: `sha256:${await sha256File(new URL(import.meta.url))}`,
      campaignState: `sha256:${await sha256File(new URL("../campaign-state.js", import.meta.url))}`,
      defenseSimulation: `sha256:${await sha256File(new URL("../defense-run-simulation.js", import.meta.url))}`,
    },
    outputSha256: `sha256:${sha256Hex(bytes)}`,
    outputByteLength: Buffer.byteLength(bytes, "utf8"),
    command: ["node", "scripts/run-stage1b-persistence-scenarios.mjs", "--output", output, "--source-revision", parsed.sourceRevision],
  };
  await writeFile(receiptPath, canonicalBytes(receipt), "utf8");
}

export { SCENARIOS, buildPayload, runSingleScenario };

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  await main();
}