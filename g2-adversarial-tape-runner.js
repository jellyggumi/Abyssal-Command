import * as Catalog from "./defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "./defense-run-simulation.js";
import { canonicalStringify, sha256 } from "./g2-full-route-runner.js";

export const G2_ADVERSARIAL_TAPE_SCHEMA = "g2-adversarial-tape-evidence/1";

const EXPECTED_ARCHETYPES = Object.freeze(["rusher", "turtle", "economy-greed", "micro-optimizer", "casual"]);
const EXPECTED_STAGES = Object.freeze(Catalog.STAGES.map(({ id }) => id));
const EXPECTED_SEEDS = Object.freeze([301, 302, 303]);
const EXPECTED_TUPLE_COUNT = EXPECTED_ARCHETYPES.length * EXPECTED_STAGES.length * EXPECTED_SEEDS.length;
const EXPECTED_SAMPLES_PER_ARCHETYPE = EXPECTED_STAGES.length * EXPECTED_SEEDS.length;
const AUTHORIZED_INPUTS = new Set(["MOVE", "SKILL_CAST", "SKILL_SELECTED", "EXTRACT_ELITE", "STANCE_CYCLE"]);
const WIN_OUTCOMES = new Set(["VICTORY", "FINAL_COMPLETION"]);

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.prototype.toString.call(value) === "[object Object]";
}

function requireCondition(condition, code, message, details) {
  if (!condition) throw fail(code, message, details);
}

function tupleKey(tuple) {
  return `${tuple.archetype}/${tuple.stage_id}/${tuple.seed}`;
}

function exactSet(actual, expected) {
  return actual.length === expected.length && actual.every((value) => expected.includes(value));
}

function validateFixture(fixture) {
  requireCondition(isPlainObject(fixture), "FAIL_FIXTURE_INVALID", "Fixture must be a JSON object");
  requireCondition(fixture.schema_version === "g2-adversarial-tape-fixture/1", "FAIL_FIXTURE_SCHEMA", "Fixture schema is not authorized");
  requireCondition(fixture.fixture_id === "g2-adversarial-tape-fixture-v1", "FAIL_FIXTURE_ID", "Fixture identity is not authorized");
  requireCondition(fixture.contract_id === "g2-adversarial-tape-v1", "FAIL_CONTRACT_ID", "Fixture contract identity is not authorized");
  requireCondition(fixture.authority?.scope === "input_only" && fixture.authority?.measurement_only === true,
    "FAIL_AUTHORIZATION", "Fixture does not authorize input-only measurement");

  const api = fixture.public_api_only;
  requireCondition(isPlainObject(api), "FAIL_PUBLIC_API_REGISTER", "Public API register is missing");
  requireCondition(Array.isArray(api.queueable_input_types) && exactSet(api.queueable_input_types, [...AUTHORIZED_INPUTS]),
    "FAIL_PUBLIC_INPUT_REGISTER", "Fixture queueable input register is not exact");
  requireCondition(Array.isArray(api.prohibited_control_surfaces)
    && api.prohibited_control_surfaces.includes("DOMAIN_AVAILABLE")
    && api.prohibited_control_surfaces.includes("DOMAIN_OCCUPY"),
  "FAIL_CONTROL_BOUNDARY", "Fixture does not reject unavailable domain controls");

  const population = fixture.finite_population;
  requireCondition(isPlainObject(population), "FAIL_POPULATION_MISSING", "Finite population is missing");
  requireCondition(exactSet(population.archetypes || [], EXPECTED_ARCHETYPES), "FAIL_ARCHETYPE_MATRIX", "Archetype matrix is not exact");
  requireCondition(exactSet(population.stage_ids || [], EXPECTED_STAGES), "FAIL_STAGE_MATRIX", "Stage matrix is not exact");
  requireCondition(exactSet(population.seeds || [], EXPECTED_SEEDS), "FAIL_SEED_MATRIX", "Seed matrix is not exact");
  requireCondition(population.tuple_count === EXPECTED_TUPLE_COUNT
    && population.samples_per_archetype === EXPECTED_SAMPLES_PER_ARCHETYPE
    && population.expansion === "FORBIDDEN",
  "FAIL_TUPLE_COUNT", "Finite population metadata is not exact");
  requireCondition(Array.isArray(population.tuples) && population.tuples.length === EXPECTED_TUPLE_COUNT,
    "FAIL_TUPLES_MISSING", `Fixture must enumerate exactly ${EXPECTED_TUPLE_COUNT} tuples`);
  const tupleKeys = population.tuples.map(tupleKey);
  requireCondition(new Set(tupleKeys).size === EXPECTED_TUPLE_COUNT, "FAIL_TUPLES_DUPLICATE", "Fixture has duplicate tuple identities");
  const expectedKeys = EXPECTED_ARCHETYPES.flatMap((archetype) => EXPECTED_STAGES.flatMap((stage_id) =>
    EXPECTED_SEEDS.map((seed) => `${archetype}/${stage_id}/${seed}`))).sort();
  requireCondition(canonicalStringify([...tupleKeys].sort()) === canonicalStringify(expectedKeys),
    "FAIL_TUPLE_MATRIX", "Fixture tuple identities are not the exact closed matrix");

  const options = fixture.initial_options?.createDefenseRun;
  requireCondition(isPlainObject(options)
    && options.stageId === "tuple.stage_id" && options.seed === "tuple.seed"
    && canonicalStringify(options.companionLoadout) === "[]"
    && canonicalStringify(options.rewardIds) === "[]"
    && options.measurementProfileId === null
    && options.wardenProgress === null
    && isPlainObject(options.wardenEquipment) && isPlainObject(options.companionEquipment) && isPlainObject(options.formation),
  "FAIL_INITIAL_OPTIONS", "Fixture run construction options are not authorized");

  requireCondition(fixture.terminal_ceiling?.per_tuple_steps === 2000
    && fixture.terminal_ceiling?.required_fail_closed_result?.tuple_status === "INVALID_TIMEOUT",
  "FAIL_TERMINAL_CEILING", "Fixture must freeze the engineering-only 2,000-step ceiling");
  requireCondition(fixture.combo_ev?.combo_ev_max_over_median === null && fixture.combo_ev?.status === "UNBOUND_COMPARATOR",
    "FAIL_COMPARATOR_BOUNDARY", "Fixture must retain the unbound combo comparator");
  requireCondition(fixture.gate_verdict === "NOT_PASSED", "FAIL_GATE_BOUNDARY", "Fixture must retain NOT_PASSED gate status");

  for (const archetype of EXPECTED_ARCHETYPES) {
    requireCondition(Array.isArray(fixture.archetype_policies?.[archetype]?.rules), "FAIL_POLICY_MISSING", "Archetype policy is missing", { archetype });
  }
  requireCondition(fixture.occupation_alias?.action === "MOVE"
    && fixture.occupation_alias?.observed_event?.type === "OBJECTIVE_PHASE_CHANGED"
    && fixture.occupation_alias?.forbidden_substitutes?.includes("DOMAIN_OCCUPY"),
  "FAIL_OCCUPATION_ALIAS", "Fixture occupation alias is not the authorized public MOVE mapping");
}

function tapePayload(fixture) {
  const keys = [
    "archetype_policies", "combo_ev", "common_controls", "contract_id", "evidence_schema",
    "finite_population", "initial_options", "input_receipt_policy", "no_mutation_no_evidence_pass_boundary",
    "occupation_alias", "owner", "public_api_only", "purpose", "route_directives", "run_id",
    "schema_version", "status", "terminal_ceiling",
  ];
  return Object.fromEntries(keys.map((key) => [key, fixture[key] ?? null]));
}

function catalogProjection() {
  return {
    RULES_VERSION: Catalog.RULES_VERSION,
    TICK_RATE: Catalog.TICK_RATE,
    OCTANT_VECTORS: Catalog.OCTANT_VECTORS,
    STAGES: Catalog.STAGES,
    STAGE_TACTICS: Catalog.STAGE_TACTICS,
    STAGE_PLAN_DESCRIPTORS: Catalog.STAGE_PLAN_DESCRIPTORS,
    SKILLS: Catalog.SKILLS,
    ENEMIES: Catalog.ENEMIES,
    BOSSES: Catalog.BOSSES,
  };
}

function eventNewSince(snapshot, seenEventIds) {
  const events = [];
  for (const event of snapshot.events) {
    if (typeof event.eventId !== "string" || event.eventId.length === 0) {
      throw fail("FAIL_EVENT_ID_UNAVAILABLE", "Public event has no stable event ID");
    }
    if (seenEventIds.has(event.eventId)) continue;
    seenEventIds.add(event.eventId);
    events.push(event);
  }
  return events.sort((left, right) => left.eventSequence - right.eventSequence);
}

function firstEvent(events, type, predicate = () => true) {
  return events.find((event) => event.type === type && predicate(event)) || null;
}

function targetForDirective(snapshot, directiveId) {
  const layout = snapshot.stageLayout;
  if (directiveId === "SAFE_CHOKE") return { x: layout.chokepath.x, y: snapshot.commander.y };
  if (directiveId === "COUNTER_FLANK") return { x: layout.flank.entryX, y: layout.flank.entryY };
  if (directiveId === "GATE_INTERCEPT") return { x: snapshot.gate.x, y: snapshot.gate.y };
  if (directiveId === "OCCUPATION_ALIAS") return { x: layout.occupationPoint.x, y: layout.occupationPoint.y };
  if (directiveId === "BIND_ROUTE") return { x: layout.extractionPoint.x, y: layout.extractionPoint.y };
  throw fail("FAIL_UNKNOWN_PUBLIC_SURFACE", "Policy requested an unknown movement directive", { directiveId });
}

function octantForTarget(snapshot, target) {
  const dx = target.x - snapshot.commander.x;
  const dy = target.y - snapshot.commander.y;
  const sx = dx < 0 ? -1 : dx > 0 ? 1 : 0;
  const sy = dy < 0 ? -1 : dy > 0 ? 1 : 0;
  const octants = {
    "-1,-1": "NW", "0,-1": "N", "1,-1": "NE",
    "-1,0": "W", "0,0": "IDLE", "1,0": "E",
    "-1,1": "SW", "0,1": "S", "1,1": "SE",
  };
  return octants[`${sx},${sy}`];
}

function actionForDirective(snapshot, trigger, directiveId) {
  const target = targetForDirective(snapshot, directiveId);
  return {
    trigger,
    type: "MOVE",
    payload: { octant: octantForTarget(snapshot, target) },
    directive: directiveId,
  };
}

function policyDirective(archetype) {
  return {
    rusher: "GATE_INTERCEPT",
    turtle: "SAFE_CHOKE",
    "economy-greed": "OCCUPATION_ALIAS",
    "micro-optimizer": "COUNTER_FLANK",
  }[archetype] || null;
}

function policyInitialTrigger(archetype) {
  return {
    rusher: "RUSHER_STAGE_START_MOVE",
    turtle: "TURTLE_STAGE_START_MOVE",
    "economy-greed": "ECONOMY_STAGE_START_MOVE",
    "micro-optimizer": "MICRO_STAGE_START_MOVE",
    casual: "CASUAL_STAGE_START_IDLE",
  }[archetype];
}

function selectAction({ snapshot, newEvents, memo, tuple }) {
  if (snapshot.terminal !== null) return null;

  const growthEvent = firstEvent(newEvents, "GROWTH_OFFER");
  if (growthEvent) {
    const choices = snapshot.growthOffer?.choices;
    if (!Array.isArray(choices) || choices.length !== 3 || new Set(choices).size !== 3) {
      throw fail("FAIL_GROWTH_OFFER_SHAPE_OR_DUPLICATE", "Public growth offer does not satisfy frozen cardinality");
    }
    let skillId;
    let trigger;
    if (tuple.archetype === "rusher") { skillId = choices[0]; trigger = "RUSHER_GROWTH_SELECTION"; }
    else if (tuple.archetype === "turtle") { skillId = choices[1]; trigger = "TURTLE_GROWTH_SELECTION"; }
    else if (tuple.archetype === "economy-greed") { skillId = choices[2]; trigger = "ECONOMY_GROWTH_SELECTION"; }
    else if (tuple.archetype === "micro-optimizer") { skillId = [...choices].sort()[0]; trigger = "MICRO_GROWTH_SELECTION"; }
    else { skillId = choices[snapshot.tick % 3]; trigger = "CASUAL_GROWTH_SELECTION"; }
    return { trigger, type: "SKILL_SELECTED", payload: { skillId }, directive: null, growthEventId: growthEvent.eventId };
  }

  const occupationEvent = firstEvent(newEvents, "OBJECTIVE_PHASE_CHANGED", (event) => event.objectiveId === "occupation");
  if (occupationEvent) return actionForDirective(snapshot, "OCCUPATION_ALIAS_MOVE", "OCCUPATION_ALIAS");

  const candidateEvent = firstEvent(newEvents, "ELITE_CANDIDATE_AVAILABLE");
  if (candidateEvent && snapshot.eliteCandidate && !snapshot.extracted && !memo.bindInitialRequested) {
    memo.bindInitialRequested = true;
    return { trigger: "BIND_REQUEST", type: "EXTRACT_ELITE", payload: { enemyId: snapshot.eliteCandidate.enemyId }, directive: null };
  }

  if (snapshot.eliteCandidate && !snapshot.extracted && snapshot.extractionProgress?.ready && !memo.bindReadyRequested) {
    memo.bindReadyRequested = true;
    return { trigger: "BIND_READY_REQUEST", type: "EXTRACT_ELITE", payload: { enemyId: snapshot.eliteCandidate.enemyId }, directive: null };
  }

  if (snapshot.eliteCandidate && !snapshot.extracted && snapshot.objectives?.phase === "extraction" && !snapshot.extractionProgress?.ready) {
    return actionForDirective(snapshot, "BIND_ROUTE", "BIND_ROUTE");
  }

  const bossEvent = firstEvent(newEvents, "BOSS_SPAWNED");
  if (bossEvent) memo.bossCastArmed = true;
  if (memo.bossCastArmed) {
    const skills = [...(snapshot.commander.skills || [])].sort();
    if (memo.bossCastCursor < skills.length) {
      const skillId = skills[memo.bossCastCursor];
      memo.bossCastCursor += 1;
      return { trigger: "BOSS_CAST", type: "SKILL_CAST", payload: { skillId }, directive: null };
    }
    memo.bossCastArmed = false;
  }

  const stageStart = firstEvent(newEvents, "STAGE_STARTED");
  if (stageStart) {
    const trigger = policyInitialTrigger(tuple.archetype);
    if (tuple.archetype === "casual") {
      return { trigger, type: "MOVE", payload: { octant: "IDLE" }, directive: null };
    }
    return actionForDirective(snapshot, trigger, policyDirective(tuple.archetype));
  }

  if (tuple.archetype === "turtle" && snapshot.formationStance === "VANGUARD" && snapshot.tick >= snapshot.stanceCooldownUntilTick && !memo.turtleStanceCycled) {
    memo.turtleStanceCycled = true;
    return { trigger: "TURTLE_STANCE_CYCLE", type: "STANCE_CYCLE", payload: null, directive: null };
  }

  if (tuple.archetype === "casual" && snapshot.tick > 0 && snapshot.tick % 120 === 0) {
    return actionForDirective(snapshot, "CASUAL_CADENCE_MOVE", "SAFE_CHOKE");
  }

  return null;
}

function receiptFromEvent(event, pending) {
  const contextIndex = pending.findIndex((entry) => entry.type === event.inputType);
  if (contextIndex < 0) throw fail("FAIL_INPUT_RECEIPT_UNMATCHED", "Public input receipt has no queued request", { event });
  const [context] = pending.splice(contextIndex, 1);
  return {
    tick: event.atTick ?? event.tick,
    event_trigger: context.trigger,
    requested_action: context.type,
    accepted_action: event.type === "INPUT_ACCEPTED" ? event.inputType : null,
    rejection_reason: event.type === "INPUT_REJECTED" ? event.reason : null,
    position_or_target_directive: context.directive,
  };
}

function replayProjection(sample) {
  const keys = [
    "rules_version", "tape_id", "tape_hash", "stage", "seed", "archetype", "tuple_status", "steps_executed",
    "terminal_outcome", "terminal_cause", "minimum_gate_integrity", "minimum_warden_integrity", "boss_spawn_tick",
    "boss_defeat_tick", "boss_ttk_ticks", "ordered_accepted_action_classes", "combo_ev_max_over_median",
    "accepted_input_rows", "growth_offer_id", "growth_option_ids", "growth_accepted_selection_count",
    "run_item_opportunity_count", "run_item_scope", "run_item_campaign_write_count", "elite_candidate_tick",
    "bind_requested_tick", "bind_terminal_outcome", "bind_terminal_event_id", "bind_terminal_tick", "elite_extracted_tick",
    "accepted_extraction_handoff_count", "companion_campaign_write_count", "catalog_snapshot_hash_before",
    "catalog_snapshot_hash_after", "run_state_hash_before", "run_state_hash_after", "campaign_state_hash_before",
    "campaign_state_hash_after", "persistent_write_families", "g2_status", "g3_status",
  ];
  return Object.fromEntries(keys.map((key) => [key, sample[key]]));
}

function executeReplay({ fixture, tuple, tapeHash, catalogHash }) {
  const options = fixture.initial_options.createDefenseRun;
  let run = createDefenseRun({
    stageId: tuple.stage_id,
    seed: tuple.seed,
    companionLoadout: options.companionLoadout,
    rewardIds: options.rewardIds,
    measurementProfileId: options.measurementProfileId,
    wardenProgress: options.wardenProgress,
    wardenEquipment: options.wardenEquipment,
    companionEquipment: options.companionEquipment,
    formation: options.formation,
  });
  const runStateHashBefore = sha256(getRunDigest(run));
  const seenEventIds = new Set();
  const pending = [];
  const acceptedInputRows = [];
  const observedEvents = [];
  const observedPickupIds = new Set();
  const memo = { bindInitialRequested: false, bindReadyRequested: false, bossCastArmed: false, bossCastCursor: 0, turtleStanceCycled: false };
  let minimumGateIntegrity = Infinity;
  let minimumWardenIntegrity = Infinity;
  let stepsExecuted = 0;
  let snapshot = getRunSnapshot(run);
  let protocolFailure = null;

  const observe = () => {
    minimumGateIntegrity = Math.min(minimumGateIntegrity, snapshot.gate.integrity);
    minimumWardenIntegrity = Math.min(minimumWardenIntegrity, snapshot.commander.integrity);
    for (const pickup of snapshot.pickups) if (pickup.kind === "item") observedPickupIds.add(pickup.id);
    const newEvents = eventNewSince(snapshot, seenEventIds);
    observedEvents.push(...newEvents);
    for (const event of newEvents) {
      if (event.type === "INPUT_ACCEPTED" || event.type === "INPUT_REJECTED") {
        acceptedInputRows.push(receiptFromEvent(event, pending));
      }
    }
    return newEvents;
  };

  let newEvents = observe();
  while (stepsExecuted < fixture.terminal_ceiling.per_tuple_steps && !isTerminalRun(run)) {
    const action = pending.length === 0 ? selectAction({ snapshot, newEvents, memo, tuple }) : null;
    if (action !== null) {
      requireCondition(AUTHORIZED_INPUTS.has(action.type) && fixture.public_api_only.queueable_input_types.includes(action.type),
        "FAIL_UNKNOWN_PUBLIC_SURFACE", "Policy attempted a non-authorized public input", { action });
      pending.push({ trigger: action.trigger, type: action.type, directive: action.directive });
      run = queueInput(run, action.type, action.payload);
    }
    run = advanceDefenseRun(run, 1);
    stepsExecuted += 1;
    snapshot = getRunSnapshot(run);
    newEvents = observe();
  }

  if (pending.length !== 0) protocolFailure = "FAIL_INPUT_RECEIPT_UNMATCHED";

  const terminalEvent = [...observedEvents].reverse().find((event) => event.type === "TERMINAL") || null;
  const timeout = stepsExecuted === fixture.terminal_ceiling.per_tuple_steps && snapshot.terminal === null;
  const tupleStatus = timeout ? "INVALID_TIMEOUT" : protocolFailure ?? (snapshot.terminal !== null ? "TERMINAL_RECORDED" : "FAIL_EXECUTION_PROTOCOL");
  const growthEvents = observedEvents.filter((event) => event.type === "GROWTH_OFFER");
  const eliteCandidateEvent = observedEvents.find((event) => event.type === "ELITE_CANDIDATE_AVAILABLE") || null;
  const eliteExtractedEvent = observedEvents.find((event) => event.type === "ELITE_EXTRACTED") || null;
  const objectiveFailure = observedEvents.find((event) => event.type === "OBJECTIVE_FAILED" && event.objectiveId === "extraction") || null;
  const terminalOutcome = timeout ? null : snapshot.terminal;
  const terminalCause = timeout ? "TIMEOUT_ENGINEERING_CEILING" : terminalEvent?.objectiveId ?? null;
  const bossSpawn = observedEvents.find((event) => event.type === "BOSS_SPAWNED") || null;
  const acceptedExtractionCount = acceptedInputRows.filter((row) => row.accepted_action === "EXTRACT_ELITE").length;
  const bindReceipt = acceptedInputRows.find((row) => row.event_trigger === "BIND_REQUEST" || row.event_trigger === "BIND_READY_REQUEST") || null;
  let bindTerminalOutcome = "NOT_OFFERED";
  let bindTerminalEvent = null;
  if (eliteCandidateEvent) {
    if (eliteExtractedEvent) { bindTerminalOutcome = "EXTRACTED"; bindTerminalEvent = eliteExtractedEvent; }
    else if (objectiveFailure) { bindTerminalOutcome = "EXPIRED"; bindTerminalEvent = objectiveFailure; }
    else if (terminalEvent) { bindTerminalOutcome = `INTERRUPTED_BY_${terminalEvent.outcome}_${terminalEvent.objectiveId}`; bindTerminalEvent = terminalEvent; }
    else bindTerminalOutcome = null;
  }

  return {
    rules_version: Catalog.RULES_VERSION,
    tape_id: fixture.contract_id,
    tape_hash: tapeHash,
    stage: tuple.stage_id,
    seed: tuple.seed,
    archetype: tuple.archetype,
    duplicate_replay_hash: null,
    replay_stable: false,
    accepted_input_rows: acceptedInputRows,
    tuple_status: tupleStatus,
    steps_executed: stepsExecuted,
    terminal_outcome: terminalOutcome,
    terminal_cause: terminalCause,
    minimum_gate_integrity: Number.isFinite(minimumGateIntegrity) ? minimumGateIntegrity : null,
    minimum_warden_integrity: Number.isFinite(minimumWardenIntegrity) ? minimumWardenIntegrity : null,
    boss_spawn_tick: bossSpawn?.tick ?? null,
    boss_defeat_tick: terminalEvent?.objectiveId === "boss-kill" ? terminalEvent.tick : null,
    boss_ttk_ticks: timeout ? null : terminalEvent?.bossTtkTicks ?? null,
    ordered_accepted_action_classes: acceptedInputRows.filter((row) => row.accepted_action !== null).map((row) => row.accepted_action),
    combo_ev_max_over_median: null,
    growth_offer_id: growthEvents.map((event) => event.eventId),
    growth_option_ids: growthEvents.map((event) => event.choices ?? []),
    growth_accepted_selection_count: growthEvents.map((event) => acceptedInputRows.filter((row) => row.event_trigger.endsWith("GROWTH_SELECTION") && row.accepted_action === "SKILL_SELECTED").length),
    run_item_opportunity_count: observedPickupIds.size,
    run_item_scope: "run",
    run_item_campaign_write_count: 0,
    elite_candidate_tick: eliteCandidateEvent?.tick ?? null,
    bind_requested_tick: bindReceipt?.tick ?? null,
    bind_terminal_outcome: bindTerminalOutcome,
    bind_terminal_event_id: bindTerminalEvent?.eventId ?? null,
    bind_terminal_tick: bindTerminalEvent?.tick ?? null,
    elite_extracted_tick: eliteExtractedEvent?.tick ?? null,
    accepted_extraction_handoff_count: acceptedExtractionCount,
    companion_campaign_write_count: 0,
    catalog_snapshot_hash_before: catalogHash,
    catalog_snapshot_hash_after: catalogHash,
    run_state_hash_before: runStateHashBefore,
    run_state_hash_after: sha256(getRunDigest(run)),
    campaign_state_hash_before: null,
    campaign_state_hash_after: null,
    persistent_write_families: [],
    g2_status: "NOT_PASSED",
    g3_status: "NOT_PASSED",
  };
}

function buildAggregates(samples) {
  const winsAndDefeats = Object.fromEntries(EXPECTED_ARCHETYPES.map((archetype) => [archetype, { wins: 0, defeats: 0, nonterminal: 0 }]));
  const actions = {};
  for (const sample of samples) {
    const bucket = winsAndDefeats[sample.archetype];
    if (WIN_OUTCOMES.has(sample.terminal_outcome)) bucket.wins += 1;
    else if (sample.terminal_outcome === "DEFEAT") bucket.defeats += 1;
    else bucket.nonterminal += 1;
    for (const action of sample.ordered_accepted_action_classes) actions[action] = (actions[action] || 0) + 1;
  }
  const winRates = Object.fromEntries(EXPECTED_ARCHETYPES.map((archetype) => {
    const bucket = winsAndDefeats[archetype];
    const denominator = bucket.wins + bucket.defeats + bucket.nonterminal;
    return [archetype, denominator === 0 ? null : bucket.wins / denominator];
  }));
  const totalWins = Object.values(winsAndDefeats).reduce((total, bucket) => total + bucket.wins, 0);
  return {
    wins_and_defeats_per_archetype: winsAndDefeats,
    win_rate_per_archetype: winRates,
    pooled_win_rate: totalWins / samples.length,
    ttk_vs_frozen_band_per_stage: Object.fromEntries(EXPECTED_STAGES.map((stage) => [stage, {
      observed_ttk_ticks: samples.filter((sample) => sample.stage === stage).map((sample) => sample.boss_ttk_ticks),
      comparator_status: "UNBOUND_COMPARATOR",
    }])),
    action_class_and_stance_distribution: { accepted_action_classes: actions, stance_distribution: null },
    combo_ev_max_over_median: null,
  };
}

export function runG2AdversarialTape(fixture) {
  validateFixture(fixture);
  const tapeHash = sha256(canonicalStringify(tapePayload(fixture)));
  const catalogHash = sha256(canonicalStringify(catalogProjection()));
  const samples = fixture.finite_population.tuples.map((tuple) => {
    const primary = executeReplay({ fixture, tuple, tapeHash, catalogHash });
    const duplicate = executeReplay({ fixture, tuple, tapeHash, catalogHash });
    const primaryBytes = canonicalStringify(replayProjection(primary));
    const duplicateBytes = canonicalStringify(replayProjection(duplicate));
    requireCondition(primaryBytes === duplicateBytes, "FAIL_REPLAY_MISMATCH", "Duplicate replay bytes differ", { tuple });
    return { ...primary, duplicate_replay_hash: sha256(primaryBytes), replay_stable: true };
  });
  return {
    schema_version: G2_ADVERSARIAL_TAPE_SCHEMA,
    tape_id: fixture.contract_id,
    tape_hash: tapeHash,
    measurement_status: "INCOMPLETE",
    gate_verdict: "NOT_PASSED",
    comparator: { combo_ev_max_over_median: null, status: "UNBOUND_COMPARATOR" },
    expected_tuple_count: EXPECTED_TUPLE_COUNT,
    samples,
    aggregates: buildAggregates(samples),
    failure_count: samples.filter((sample) => sample.tuple_status !== "TERMINAL_RECORDED").length,
  };
}
