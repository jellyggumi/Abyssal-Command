#!/usr/bin/env node
/**
 * Stage 1b Cinder persistence evidence.
 *
 * Deterministic synthetic scenarios driven through public simulation and campaign
 * APIs. Evidence is written as canonical UTF-8 JSON with fixed deterministic
 * inputs and persistent campaign handoff ordering.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
  captureElite,
  createCampaign,
  equipmentTierIndexFor,
  serializeCampaign,
  setCompanionLoadout,
  startRun,
} from "../campaign-state.js";
import { COMMANDER, OCTANT_VECTORS, SKILLS } from "../defense-catalog.js";
import { EQUIPMENT_SLOTS } from "../rpg-catalog.js";
import { canonicalStringify } from "../g2-full-route-runner.js";

const STAGE_ID = "cinder-span";
const CAMPAIGN_ID = "stage1b-cinder-persistence";
const FIXED_LOADOUT = Object.freeze(["ember-cohort", "rift-lens", "veil-vanguard"]);
const MAX_ADVANCE_CALLS = 20_000;
const MAX_CONSECUTIVE_NO_PROGRESS = 1_200;
const CADENCE_TICKS = 15;

const SYNTHETIC_BASELINE_CAPTURES = Object.freeze([
  Object.freeze({ eliteId: "stage1b-baseline-ember-cohort", prototype: "ember-cohort" }),
  Object.freeze({ eliteId: "s2-veil-sentinel", prototype: "rift-lens" }),
  Object.freeze({ eliteId: "s5-pack-sentinel", prototype: "veil-vanguard" }),
]);

const SCENARIOS = Object.freeze([
  Object.freeze({
    scenario: "victory",
    seed: 901,
    acceptExtract: true,
    moveOnlyAfterAcceptance: false,
    expectedTerminal: "VICTORY",
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
  }),
]);

const ALLOWED_INPUT_TYPES = new Set(["MOVE", "SKILL_CAST", "SKILL_SELECTED", "EXTRACT_ELITE"]);
const CONTROLLER_MEMO = Object.freeze({
  lastMoveTick: -Infinity,
  lastOctant: null,
  lastSituation: null,
});

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
    sourceRevision: process.env.SOURCE_REVISION || process.env.GIT_REVISION || "unknown",
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

function equipmentFor(campaign, ownerId) {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, equipmentTierIndexFor(campaign, ownerId, slot)]));
}

function createScenarioCampaign() {
  let campaign = createCampaign({ campaignId: CAMPAIGN_ID, resetEpoch: 0 });
  for (const capture of SYNTHETIC_BASELINE_CAPTURES) {
    campaign = captureElite(campaign, capture.eliteId, capture.prototype);
  }
  return setCompanionLoadout(campaign, FIXED_LOADOUT);
}

function createRunFromCampaign(campaign, seed) {
  const companionLoadout = campaign.companionLoadout.prototypeIds;
  return createDefenseRun({
    stageId: STAGE_ID,
    seed,
    companionLoadout,
    rewardIds: campaign.rewardIds,
    wardenProgress: campaign.wardenProgress,
    wardenEquipment: equipmentFor(campaign, "warden"),
    companionEquipment: Object.fromEntries(companionLoadout.map((id) => [id, equipmentFor(campaign, id)])),
    formation: campaign.companionFormation,
  });
}

function valueDiff(before, after, path = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (Array.isArray(before) || Array.isArray(after)
      || before === null || after === null || typeof before !== "object" || typeof after !== "object") {
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

function movementSituation(snapshot) {
  return `${snapshot.bossSpawned ? 1 : 0},${snapshot.eliteCandidate ? 1 : 0},${snapshot.objectives?.phase ?? ""},${Math.floor((snapshot.commander.integrity / snapshot.commander.maxIntegrity) * 4)}`;
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

function objectiveTarget(snapshot) {
  if (snapshot.objectives?.phase === "occupation") return snapshot.tactics?.occupation;
  if (snapshot.objectives?.phase === "extraction") return snapshot.tactics?.extraction;
  const enemy = nearestEnemy(snapshot);
  return enemy ?? null;
}

function octantToward(from, target) {
  if (!target) return "IDLE";
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  if (dx === 0 && dy === 0) return "IDLE";
  if (Math.hypot(dx, dy) < (target.radius ?? 400) * 0.5) return "IDLE";
  const length = Math.hypot(dx, dy) || 1;
  let selected = "IDLE";
  let bestDot = -Infinity;
  for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
    if (name === "IDLE") continue;
    const vectorLength = Math.hypot(vector.x, vector.y) || 1;
    const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
    if (dot > bestDot) {
      bestDot = dot;
      selected = name;
    }
  }
  return selected;
}

function projectedCommanderMoveDistance(from, target) {
  if (!target) return 0;
  const distance = Math.hypot(target.x - from.x, target.y - from.y);
  const holdRadius = target.radius ?? 0;
  if (!(distance > holdRadius)) return 0;
  return Math.min(Math.max(1, Math.trunc(COMMANDER.speed / TICK_RATE)), distance - holdRadius);
}

function newControllerMemo() {
  return {
    ...CONTROLLER_MEMO,
    acceptedEliteExtractCount: 0,
    acceptedEliteTick: null,
    extractionRequested: false,
    preMoveProjection: null,
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
    if (!request) {
      fail(`unable to queue ${type} at tick ${snapshot.tick}`);
    }
    nextInputs.push({
      tick: snapshot.tick,
      inputType: type,
      inputId: request.inputId,
      payload: clone(payload),
      requestedSituation: memo.lastSituation,
    });
    next = withInput;
  };

  if (snapshot.growthOffer) {
    const choice = snapshot.growthOffer.choices?.[0];
    if (!choice) fail(`growth offer at tick ${snapshot.tick} has no choices`);
    queue("SKILL_SELECTED", { skillId: choice });
    memo.preMoveProjection = null;
    return { run: next, nextInputs };
  }

  if (snapshot.tick - memo.lastMoveTick >= CADENCE_TICKS) {
    const target = objectiveTarget(snapshot);
    memo.lastMoveTick = snapshot.tick;
    const octant = octantToward(snapshot.commander, target);
    memo.preMoveProjection = target ? projectedCommanderMoveDistance(snapshot.commander, target) : 0;
    if (octant !== memo.lastOctant) {
      if (octant !== "IDLE") {
        queue("MOVE", { octant });
      }
      memo.lastOctant = octant;
    }
  }

  const moveOnly = definition.moveOnlyAfterAcceptance && memo.acceptedEliteExtractCount > 0;
  if (!moveOnly) {
    for (const skillId of snapshot.commander.skills) {
      if (SKILLS[skillId]?.kind === "active" && (snapshot.commander.cooldowns[skillId] ?? 0) <= 0) {
        queue("SKILL_CAST", { skillId });
      }
    }

    if (definition.acceptExtract && !memo.extractionRequested && snapshot.eliteCandidate && snapshot.extractionProgress.ready) {
      queue("EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
      memo.extractionRequested = true;
    }
  }

  return { run: next, nextInputs };
}

function acceptedEliteHandoffs(state) {
  const extractionEvents = state.events.filter(({ type }) => type === "ELITE_EXTRACTED");
  const acceptedInputs = state.events.filter((event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE");
  const handoffs = [];

  for (const event of extractionEvents) {
    const accepted = acceptedInputs.find(
      (input) => input.eventSequence > event.eventSequence && input.tick === event.tick,
    );
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
  collectNewEvents(snapshot, state);

  let lastCommanderPosition = { x: snapshot.commander.x, y: snapshot.commander.y };
  let consecutiveNoProgress = 0;
  let advanceCalls = 0;

  while (!isTerminalRun(run) && advanceCalls < MAX_ADVANCE_CALLS) {
    const inputResult = buildInputs(run, snapshot, definition, memo, state);
    const before = getRunSnapshot(run);
    run = advanceDefenseRun(inputResult.run, 1);
    advanceCalls += 1;

    const after = getRunSnapshot(run);
    const progressed = after.commander.x !== before.commander.x || after.commander.y !== before.commander.y;
    consecutiveNoProgress = progressed ? 0 : consecutiveNoProgress + 1;
    memo.acceptedEliteExtractCount = after.events
      .filter((event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE").length;

    if (consecutiveNoProgress > MAX_CONSECUTIVE_NO_PROGRESS) {
      fail(`${definition.scenario} exceeded maxConsecutiveNoProgress ${MAX_CONSECUTIVE_NO_PROGRESS} at tick ${after.tick}`);
    }

    state.maxObservedNoProgress = Math.max(state.maxObservedNoProgress, consecutiveNoProgress);

    const newEvents = collectNewEvents(after, state);
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

    lastCommanderPosition = { x: after.commander.x, y: after.commander.y };
    snapshot = after;
  }

  if (!isTerminalRun(run)) {
    fail(`${definition.scenario} did not reach terminal outcome within ${MAX_ADVANCE_CALLS} advances`);
  }
  if (definition.expectedTerminal && snapshot.terminal !== definition.expectedTerminal) {
    fail(`${definition.scenario} expected terminal ${definition.expectedTerminal}, observed ${snapshot.terminal} at tick ${snapshot.tick}`);
  }
  if (definition.requirePressureDeadlineDefeat) {
    const reachedDeadline = state.requiredPressureDeadline === null || snapshot.tick >= state.requiredPressureDeadline;
    if (snapshot.terminal !== "DEFEAT" || !reachedDeadline) {
      fail(`${definition.scenario} must reach pressure-deadline defeat (expected tick >= ${state.requiredPressureDeadline}), observed ${snapshot.terminal} at ${snapshot.tick}`);
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
  const campaignFinalObject = applyCampaignRunResult(campaignPostExtractionObject, { stageId: STAGE_ID, outcome });
  const campaignFinal = campaignEvidence(campaignFinalObject);

  const campaignDiffs = {
    initialToPostStart: valueDiff(campaignInitial, campaignPostStart),
    postStartToPostExtraction: valueDiff(campaignPostStart, campaignPostExtraction),
    postExtractionToFinal: valueDiff(campaignPostExtraction, campaignFinal),
  };

  const rewardSelections = state.inputs.filter((input) => input.inputType === "REWARD_SELECTED");
  const unexpectedInputs = state.inputs.filter((input) => !ALLOWED_INPUT_TYPES.has(input.inputType));

  return {
    scenario: definition.scenario,
    seed: definition.seed,
    stageId: STAGE_ID,
    terminal: snapshot.terminal,
    terminalTick: snapshot.tick,
    objectivePressure: {
      deadlineTick: state.requiredPressureDeadline,
      deadlineSatisfied: state.requiredPressureDeadline === null || snapshot.tick >= state.requiredPressureDeadline,
    },
    outcome,
    maxAdvanceCalls: advanceCalls,
    policy: {
      kind: "synthetic",
      cadenceTicks: CADENCE_TICKS,
      loadout: [...FIXED_LOADOUT],
      moveOnlyAfterAcceptance: definition.moveOnlyAfterAcceptance,
      acceptExtract: definition.acceptExtract,
      requirePressureDeadlineDefeat: Boolean(definition.requirePressureDeadlineDefeat),
      lastMoveTick: memo.lastMoveTick,
      lastOctant: memo.lastOctant,
      lastSituation: memo.lastSituation,
    },
    events: state.events,
    inputs: state.inputs,
    rewardSelections,
    inputTypeValidation: {
      unexpectedInputTypes: unexpectedInputs.map((input) => input.inputType),
      allInputTypes: [...new Set(state.inputs.map((input) => input.inputType))],
    },
    acceptance: {
      extractionEventCount,
      inputAcceptedCount: handoffs.length,
      requestedExtractCount,
      acceptedHandoffs: handoffs,
      acceptedEliteExtractCount: memo.acceptedEliteExtractCount,
      extractedEliteHandoffsOrdered: true,
    },
    campaign: {
      initial: campaignInitial,
      postStart: campaignPostStart,
      postExtraction: campaignPostExtraction,
      final: campaignFinal,
      diffs: campaignDiffs,
      schema: {
        initial: Object.keys(campaignInitial).sort(),
        postStart: Object.keys(campaignPostStart).sort(),
        postExtraction: Object.keys(campaignPostExtraction).sort(),
        final: Object.keys(campaignFinal).sort(),
      },
    },
    invariants: {
      maxConsecutiveNoProgressObserved: state.maxObservedNoProgress,
      acceptedEliteHandoffs: handoffs.length,
      noUnexpectedInputTypes: unexpectedInputs.length === 0,
      noSecondExtractionAttempt: requestedExtractCount <= 1,
      extractorAppliedBeforeCampaignResult: true,
      rewardSelections: rewardSelections.length,
    },
    maxNoProgressObserved: state.maxObservedNoProgress,
  };
}

function runScenarioWithReplay(definition) {
  const first = runSingleScenario(definition);
  const replay = runSingleScenario(definition);
  const firstBytes = canonicalStringify(first);
  const replayBytes = canonicalStringify(replay);
  if (firstBytes !== replayBytes) {
    fail(`scenario ${definition.scenario} failed replay byte identity check`);
  }

  return {
    ...first,
    replay: {
      status: "IDENTICAL",
      canonicalByteLength: firstBytes.length,
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
    noUnexpectedInputTypes: scenarios.every((scenario) => scenario.invariants?.noUnexpectedInputTypes),
  };
}

const parsed = parseArguments(process.argv.slice(2));
const scenarios = SCENARIOS.map(runScenarioWithReplay);
const payload = {
  schemaVersion: 1,
  stageId: STAGE_ID,
  sourceRevision: parsed.sourceRevision,
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
    status: "SYNTHETIC_BASELINE",
    baselineCaptures: SYNTHETIC_BASELINE_CAPTURES,
  },
  scenarios,
  invariants: invariantSummary(scenarios),
};

if (!parsed.check) {
  await mkdir(dirname(parsed.output), { recursive: true });
  await writeFile(parsed.output, canonicalBytes(payload), "utf8");
}
