import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evaluatorPath = join(repositoryRoot, "scripts", "evaluate-stage1b-gates.mjs");
const CLI_TIMEOUT_MS = 180_000;
const CANONICAL_SEEDS = [401, 402, 403, 404, 405];
const ARCHETYPES = ["anchor", "burst", "control", "sustain", "tempo"];
const FULLAPP_TIERS = [
  "desktop-m2pro-dsf1",
  "shipped-mobile-dsf2",
  "midtier-mobile-proxy-dsf2-cpu4x",
  "low-mobile-proxy-dsf2-cpu6x",
];
const BUILD_SHA = "b".repeat(40);
const EVIDENCE_SHA256 = "c".repeat(64);
const G7_EVENT_TYPES = [
  "ELITE_PROMPT_VISIBLE",
  "MOVEMENT_INTO_EXTRACTION_ZONE",
  "HOLD_PROGRESS_COMPLETED",
  "EXTRACT_ELITE_ACCEPTED",
  "ELITE_EXTRACTED_VISIBLE",
  "EMBER_COHORT_PERSISTED_VISIBLE",
  "STAGING_RETURN_VISIBLE",
  "VOLUNTARY_REENTRY_DECISION",
];
const G8_EVENT_TYPES = [
  "ELITE_PROMPT_VISIBLE",
  "OCCUPATION_HOLD_OBSERVED",
  "EXTRACTION_HOLD_OBSERVED",
  "EXTRACTION_CHOICE_OBSERVED",
  "RESULT_VISIBLE",
  "EMBER_COHORT_PERSISTENCE_OBSERVED",
  "STAGING_RETURN_VISIBLE",
  "RAW_IMPRESSION_SCORE_RECORDED",
];
const G8_TITLES = ["Arknights", "Kingdom Rush", "Dungeon Warfare 2", "Vampire Survivors", "Hades"];
const G6_PROVENANCE_FIXTURES = {
  telemetryContract: {
    status: "TESTED",
    fileName: "telemetry.json",
    raw: `${JSON.stringify({ contract: "telemetry", status: "TESTED" })}\n`,
  },
  rollbackRunbook: {
    status: "TESTED",
    fileName: "rollback.json",
    raw: `${JSON.stringify({ contract: "rollback", status: "TESTED" })}\n`,
  },
  releaseReadiness: {
    status: "PASS",
    fileName: "release.json",
    raw: `${JSON.stringify({ contract: "release-readiness", status: "PASS" })}\n`,
  },
  uiBrowserGate: {
    status: "TESTED",
    fileName: "ui-browser.json",
    raw: `${JSON.stringify({ contract: "ui-browser", status: "TESTED" })}\n`,
  },
};

function sha256(raw) {
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

function outcome(totalDamageDealt, reference) {
  return {
    digestSha256: `${reference}-digest`,
    digestMatched: true,
    terminal: "VICTORY",
    totalDamageDealt,
    endIntegrity: { commander: 100, gate: 100 },
    tick: 100,
  };
}

function makeSymmetricEvidence() {
  const budgetId = "stage1b-equal-budget";
  const valueBudgetFingerprint = "equal-budget-fingerprint";
  const rows = [];
  const outcomeRecords = {};

  for (const archetypeId of ARCHETYPES) {
    let ownRowIndex = 0;
    for (const counterProfileId of ARCHETYPES) {
      if (counterProfileId === archetypeId) continue;
      for (const seed of CANONICAL_SEEDS) {
        const rowId = `${archetypeId}-${counterProfileId}-${seed}`;
        const archetypeRef = `${rowId}-archetype`;
        const counterRef = `${rowId}-counter`;
        const result = ownRowIndex < 11 ? "ARCHETYPE" : ownRowIndex === 11 ? "TIE" : "COUNTER";
        const archetypeDamage = result === "COUNTER" ? 100 : 200;
        const counterDamage = result === "ARCHETYPE" ? 100 : 200;
        outcomeRecords[archetypeRef] = outcome(archetypeDamage, archetypeRef);
        outcomeRecords[counterRef] = outcome(counterDamage, counterRef);
        rows.push({
          archetypeId,
          counterProfileId,
          seed,
          valueBudgetFingerprint,
          pairedEntries: [archetypeRef, counterRef].map((outcomeRef) => ({
            valueBudgetFingerprint,
            budgetId,
            outcomeRef,
            digestSha256: outcomeRecords[outcomeRef].digestSha256,
          })),
          rawOutcomes: {
            archetype: { outcomeRef: archetypeRef, digestSha256: outcomeRecords[archetypeRef].digestSha256 },
            counter: { outcomeRef: counterRef, digestSha256: outcomeRecords[counterRef].digestSha256 },
          },
          winner: result === "ARCHETYPE" ? archetypeId : result === "COUNTER" ? counterProfileId : "TIE",
        });
        ownRowIndex += 1;
      }
    }
  }

  const legalComboRows = CANONICAL_SEEDS.map((seed) => {
    const outcomeRef = `legal-combo-${seed}`;
    outcomeRecords[outcomeRef] = {
      ...outcome(100, outcomeRef),
      damageEvents: [
        { skillId: "ability-a", finalDamage: 40, tick: 10, eventSequence: 1 },
        { skillId: "ability-b", finalDamage: 60, tick: 20, eventSequence: 2 },
      ],
    };
    return {
      seed,
      legal: true,
      orderedAbilityIds: ["ability-a", "ability-b"],
      rawOutcome: { outcomeRef, digestSha256: outcomeRecords[outcomeRef].digestSha256 },
    };
  });

  return {
    schemaVersion: "stage1b-symmetric-trials-v1",
    classification: "deterministic-scripted-measurement-not-human-playtest",
    controller: { kind: "synthetic" },
    provenance: { stageId: "cinder-span" },
    status: "COMPLETE",
    failures: [],
    trialPlan: {
      archetypes: ARCHETYPES,
      seeds: CANONICAL_SEEDS,
      pairsPerArchetype: 20,
      expectedRowCount: 100,
      valueBudgetFingerprint,
      valueBudget: { budgetId },
    },
    execution: {
      mode: "CANONICAL",
      symmetricCoverage: "COMPLETE_ORDERED_REVERSE_PAIRS",
      rowCount: 100,
    },
    rows,
    legalComboEv: { rows: legalComboRows },
    outcomeRecords,
  };
}

function mutateFirstSymmetricOutcome(evidence, mutate) {
  const symmetric = evidence["--symmetric"];
  const [outcomeRef, outcomeRecord] = Object.entries(symmetric.outcomeRecords)[0];
  mutate(outcomeRecord);

  const digestPayload = {
    ...outcomeRecord,
    digestSha256: undefined,
    digestMatched: undefined,
  };
  const updatedDigest = sha256(`${JSON.stringify(digestPayload)}\n`);
  outcomeRecord.digestSha256 = updatedDigest;
  outcomeRecord.digestMatched = true;

  for (const row of symmetric.rows) {
    for (const link of row.pairedEntries) {
      if (link.outcomeRef === outcomeRef) link.digestSha256 = updatedDigest;
    }
    for (const link of Object.values(row.rawOutcomes)) {
      if (link.outcomeRef === outcomeRef) link.digestSha256 = updatedDigest;
    }
  }
  for (const row of symmetric.legalComboEv.rows) {
    if (row.rawOutcome.outcomeRef === outcomeRef) row.rawOutcome.digestSha256 = updatedDigest;
  }
}

function makeG3Evidence() {
  const formationTransitions = Array.from({ length: 50 }, (_, index) => ({
    seed: CANONICAL_SEEDS[index % CANONICAL_SEEDS.length],
    runId: `transition-${index}`,
    mode: "rally-then-turret",
    targetStance: "TURRET",
    acceptedSwitchTick: 10,
    switchEventSequence: 2,
    stanceSwitchEventSequence: 1,
    exposureStatus: "NOT_EXPOSED",
    frontAfter: ["companion-a"],
    pressureContext: { nonGracePressureEventCount: 0 },
    companionDamageByPhase: { before: 0, switchTick: 0, after: 1 },
    downsByPhase: { before: 0, switchTick: 0, after: 0 },
    events: [
      { type: "STANCE_SWITCHED", stance: "TURRET", tick: 10, eventSequence: 1, phase: "after" },
      { type: "INPUT_ACCEPTED", inputType: "STANCE_CYCLE", tick: 10, eventSequence: 2, phase: "after" },
      { type: "BOSS_RALLY_WINDOW", cooldownReductionBp: 0, tick: 11, eventSequence: 3, phase: "after" },
      { type: "COMPANION_DAMAGED", damage: 1, tick: 11, eventSequence: 4, phase: "after" },
    ],
  }));
  const controlRuns = ["VANGUARD", "SPLIT"].flatMap((targetStance, stanceIndex) =>
    Array.from({ length: 50 }, (_, index) => ({
      seed: 10_000 * (stanceIndex + 1) + index,
      mode: "control",
      targetStance,
      companionDamageTaken: index === 0 && stanceIndex === 0 ? 1 : 0,
      companionsDowned: index === 0 && stanceIndex === 0 ? 1 : 0,
      defeatCount: 0,
      terminal: "VICTORY",
      events: index === 0 && stanceIndex === 0 ? [{ type: "COMPANION_DOWNED" }] : [],
    })),
  );

  return {
    schemaVersion: "stage1b-g3-formation-transition-v1",
    controller: { kind: "synthetic" },
    samplePlan: { stageId: "cinder-span" },
    summary: { status: "COMPLETE" },
    formationTransitions,
    controlRuns,
  };
}

function makePressureEvidence() {
  let rowsCreated = 0;
  const rows = ["VANGUARD", "TURRET", "SPLIT"].flatMap((stance) =>
    CANONICAL_SEEDS.map((seed, seedIndex) => {
      const rowIndex = rowsCreated++;
      return {
        stance,
        seed,
        stageId: "cinder-span",
        gateMinPct: rowIndex % 2 === 0 ? 55 : 80,
        terminal: rowIndex < 3 ? "DEFEAT" : "VICTORY",
        terminalReason: rowIndex < 3 ? "gate-lost" : "boss-defeated",
        bossTtkStatus: "MEASURED",
        bossTtkSeconds: seedIndex % 2 === 0 ? 5.95 : 8.05,
        bossGrace: {},
        terminalPressureSeparation: {},
        aggregate: {},
        pressurePackets: Array.from({ length: 3 }, (_, packetIndex) => ({
          packetIndex,
          authoredBoundary: {},
          arrivalEvents: [{}],
          pressureEvents: [],
          terminalPressureEvents: [],
          recoveryEvents: [],
          agencyWindows: [],
          bossGrace: {},
          gateIntegrityBefore: 100,
          gateIntegrityAfter: 90,
          commanderIntegrityBefore: 100,
          commanderIntegrityAfter: 90,
        })),
      };
    }),
  );

  return {
    schemaVersion: 1,
    controller: { kind: "synthetic" },
    classification: "deterministic-synthetic-scripted-measurement-not-human-g7-or-g8-evidence",
    samplePlan: {
      stageId: "cinder-span",
      seeds: CANONICAL_SEEDS,
      stances: ["VANGUARD", "TURRET", "SPLIT"],
      expectedRunCount: 15,
    },
    rows,
  };
}


function makePersistenceEvidence() {
  const scenarios = ["victory", "defeat-after-acceptance", "defeat-before-acceptance"].map((scenario) => {
    const accepted = scenario === "defeat-before-acceptance" ? 0 : 1;
    return {
      scenario,
      realizationStatus: "REALIZED",
      eventTraceStatus: "RETAINED",
      events: [{ eventSequence: 1 }],
      campaignDiff: [{ path: "companions" }],
      campaignBefore: {},
      campaignAfter: {},
      acceptedHandoffs: Array.from({ length: accepted }, () => ({})),
      writes: Array.from({ length: accepted }, () => ({})),
      acceptedEliteExtractCount: accepted,
      invariantChecks: { stateDiffMatches: true },
    };
  });
  return {
    schemaVersion: 1,
    controller: { kind: "synthetic" },
    classification: "synthetic-scripted-evidence-not-human-g7-g8",
    humanEvidenceStatus: "NOT_CLAIMED",
    invariants: { noPreAcceptanceWrite: true, acceptedWritePersists: true },
    stageId: "cinder-span",
    scenarios,
  };
}

function makeG6Provenance() {
  return {
    schemaVersion: 1,
    gate: "G6",
    classification: "machine-measured-provenance-not-human-evidence",
    requirements: Object.fromEntries(
      Object.entries(G6_PROVENANCE_FIXTURES).map(([field, fixture]) => [
        field,
        {
          status: fixture.status,
          path: fixture.fileName,
          digest: sha256(fixture.raw),
        },
      ]),
    ),
  };
}

function makeG6Scenario() {
  return {
    mode: "scenario",
    passes: ["desktop", "mobile", "low-mobile"].map((label) => ({ tier: { label }, errors: [] })),
  };
}

function makeG6Fullapp() {
  return {
    mode: "fullapp",
    isolatedMeasurement: true,
    passes: FULLAPP_TIERS.map((label) => ({
      tier: { label },
      frameDeltaMs: { p95: 16.7 },
      longFrameRatio: 0.0049,
      inputLatencyMs: { p95: 100 },
      domNodes: 4_999,
      errors: [],
    })),
  };
}

function makeG6Soak() {
  return {
    mode: "soak",
    isolatedMeasurement: true,
    actualDurationMs: 1_800_000,
    frameDeltaMs: { p95: 16.7 },
    longFrameRatio: 0.0049,
    inputLatencyMs: { p95: 100 },
    heapSlopeMiBPerMin: 0,
    errors: [],
  };
}

function makeParticipant(prefix, index, impression = false) {
  return {
    participant_id: `${prefix}-P${String(index + 1).padStart(2, "0")}`,
    human_confirmed: true,
    consent_to_record_confirmed: true,
    ...(impression ? { first_exposure_confirmed: true } : {}),
    unique_for_build_confirmed: true,
    controls_accessible_confirmed: true,
    included: true,
  };
}

function makeEvidenceEvents(eventTypes, participantId, sortieSequence) {
  return eventTypes.map((eventType, index) => ({
    event_sequence: index + 1,
    event_type: eventType,
    occurred: true,
    visible_in_rendered_build: true,
    captured_at_recording_ms: index * 1_000,
    evidence_file_name: `${BUILD_SHA}__${participantId}__s${String(sortieSequence).padStart(2, "0")}__e${String(index + 1).padStart(3, "0")}__event-${index + 1}.json`,
    evidence_sha256: EVIDENCE_SHA256,
  }));
}

function makeG7Evidence(artifactStatus = "PASS") {
  const participants = Array.from({ length: 10 }, (_, index) => makeParticipant("G7", index));
  const decisions = participants.flatMap(({ participant_id: participantId }, participantIndex) =>
    [1, 2].map((sortieSequence) => {
      const decisionIndex = participantIndex * 2 + sortieSequence - 1;
      const circuitDurationSeconds = sortieSequence === 1 ? 30 : 180;
      return {
        build_sha: BUILD_SHA,
        participant_id: participantId,
        sortie_sequence: sortieSequence,
        rendered_build_confirmed: true,
        synthetic_controller: false,
        screen_recording_file_name: `${BUILD_SHA}__${participantId}__s${String(sortieSequence).padStart(2, "0")}__e000__session-recording.webm`,
        screen_recording_sha256: EVIDENCE_SHA256,
        timing_start_recording_ms: 10_000,
        timing_end_recording_ms: 10_000 + circuitDurationSeconds * 1_000,
        circuit_duration_seconds: circuitDurationSeconds,
        timing_start_definition_confirmed: true,
        timing_end_definition_confirmed: true,
        route_outcome: "EXTRACTION_SUCCESS",
        player_action_ids: ["MOVE_TO_PRESSURE", "CHOOSE_FORMATION", "HOLD_AND_EXTRACT_ELITE"],
        reward_event_ids: ["ELITE_EXTRACTED"],
        reached_post_result_staging_choice: true,
        eligible_decision: true,
        facilitator_prompted_reentry: false,
        facilitator_selected_player_action: false,
        voluntary_reentry: decisionIndex < 14,
        evidence_events: makeEvidenceEvents(G7_EVENT_TYPES, participantId, sortieSequence),
        observer_id: "observer-g7",
        observer_signed_at_utc: "2026-07-26T12:00:00Z",
      };
    }),
  );

  return {
    schema_version: "1.0.0",
    gate: "G7",
    study_id: "g7-inclusive-boundary",
    artifact_status: artifactStatus,
    build_sha: BUILD_SHA,
    collected_at_utc: "2026-07-26T12:00:00Z",
    participants,
    exclusions: [],
    decisions,
    calculation: {
      included_participant_count: 10,
      eligible_decision_count: 20,
      voluntary_reentry_count: 14,
      voluntary_reentry_rate: 0.7,
      all_participants_have_two_decisions: true,
      all_decisions_match_build_sha: true,
      all_event_sequences_complete_and_ordered: true,
      all_required_events_occurred_and_visible: true,
      all_circuit_durations_in_30_to_180_seconds: true,
      formula_version: "G7-v1",
      verdict: artifactStatus === "BLOCKED" ? "BLOCKED" : "PASS",
    },
  };
}

function makeG8SurveyEvidence(artifactStatus = "PASS") {
  const rows = G8_TITLES.map((title, index) => {
    const direct = index < 2;
    const criterion = direct ? "PRESENT" : "ABSENT";
    return {
      title,
      sources: [{
        source_url: `https://example.com/reference/${index + 1}`,
        source_title: `${title} primary reference`,
        source_kind: "OFFICIAL_DOCUMENTATION",
        accessed_date: "2026-07-26",
        exact_quote_or_mechanical_evidence: `Source-backed mechanic description for ${title}`,
      }],
      review_date: "2026-07-26",
      reviewer_id: "reviewer-g8",
      live_pve_player_choice: criterion,
      spatial_or_time_commitment_under_active_pressure: criterion,
      persistent_ally_or_companion_into_later_play: criterion,
      taxonomy: direct ? "DIRECT" : "ABSENT",
      exact_feature_present: direct,
      derivation_confirmed: true,
      uncertainty_note: "",
    };
  });

  return {
    schema_version: "1.0.0",
    gate: "G8",
    candidate_id: "pressure-bound-elite-extraction",
    artifact_status: artifactStatus,
    expected_titles: G8_TITLES,
    rows,
    calculation: {
      completed_unique_title_count: 5,
      all_expected_titles_present_once: true,
      all_rows_source_backed: true,
      all_rows_have_date_and_reviewer: true,
      all_taxonomies_match_three_criteria: true,
      direct_feature_count: 2,
      direct_feature_frequency: 0.4,
      formula_version: "G8-SURVEY-v1",
      survey_verdict: artifactStatus === "BLOCKED" ? "BLOCKED" : "PASS",
    },
  };
}

function makeG8ImpressionEvidence(artifactStatus = "PASS") {
  const scores = [3, 3, 3, 4, 4, 4, 4, 5, 5, 5];
  const participants = Array.from({ length: 10 }, (_, index) => makeParticipant("G8", index, true));
  const sessions = participants.map(({ participant_id: participantId }, index) => ({
    build_sha: BUILD_SHA,
    participant_id: participantId,
    sortie_sequence: 1,
    rendered_build_confirmed: true,
    synthetic_controller: false,
    first_exposure_confirmed: true,
    screen_recording_file_name: `${BUILD_SHA}__${participantId}__s01__e000__session-recording.webm`,
    screen_recording_sha256: EVIDENCE_SHA256,
    route_outcome: "EXTRACTION_COMPLETED",
    first_extraction_opportunity_observed: true,
    choice_visible_to_participant: true,
    choice_comprehended: true,
    unresolved_comprehension_failure: false,
    question_asked_verbatim: true,
    raw_score: scores[index],
    evidence_events: makeEvidenceEvents(G8_EVENT_TYPES, participantId, 1),
    quoted_confusion: null,
    moderator_id: "moderator-g8",
    observer_id: "observer-g8",
    recorded_at_utc: "2026-07-26T12:00:00Z",
  }));

  return {
    schema_version: "1.0.0",
    gate: "G8",
    study_id: "g8-inclusive-boundary",
    candidate_id: "pressure-bound-elite-extraction",
    artifact_status: artifactStatus,
    build_sha: BUILD_SHA,
    question: "How distinctive and memorable was choosing to leave the fight to bind this elite for future runs?",
    scale: {
      minimum: 1,
      maximum: 5,
      minimum_label: "not distinctive",
      maximum_label: "very distinctive",
    },
    collected_at_utc: "2026-07-26T12:00:00Z",
    participants,
    exclusions: [],
    sessions,
    calculation: {
      included_participant_count: 10,
      scored_session_count: 10,
      all_sessions_match_build_sha: true,
      all_sessions_first_exposure: true,
      all_raw_scores_are_integers_1_to_5: true,
      all_recordings_and_event_sequences_complete: true,
      unresolved_comprehension_failure_count: 0,
      raw_scores_in_participant_order: scores,
      sorted_raw_scores: scores,
      median: 4,
      formula_version: "G8-IMPRESSION-v1",
      impression_verdict: artifactStatus === "BLOCKED" ? "BLOCKED" : "PASS",
    },
  };
}

function makeHumanEvidence(artifactStatus = "PASS") {
  return {
    "--g7": makeG7Evidence(artifactStatus),
    "--g8-survey": makeG8SurveyEvidence(artifactStatus),
    "--g8-impression": makeG8ImpressionEvidence(artifactStatus),
  };
}

function makeMachineEvidence() {
  return {
    "--symmetric": makeSymmetricEvidence(),
    "--g3": makeG3Evidence(),
    "--pressure": makePressureEvidence(),
    "--persistence": makePersistenceEvidence(),
    "--g6-provenance": makeG6Provenance(),
    "--g6-scenario": makeG6Scenario(),
    "--g6-fullapp": makeG6Fullapp(),
    "--g6-soak": makeG6Soak(),
  };
}

async function runEvaluator(artifacts, invocationCount = 1) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "stage1b-gate-evaluator-"));
  const outputPath = join(temporaryDirectory, "verdict.json");
  const flags = [];

  try {
    const materializedArtifacts = structuredClone(artifacts);
    const provenance = materializedArtifacts["--g6-provenance"];
    for (const [field, fixture] of Object.entries(G6_PROVENANCE_FIXTURES)) {
      const claim = provenance?.requirements?.[field];
      if (claim?.path !== fixture.fileName) continue;
      const referencedPath = join(temporaryDirectory, fixture.fileName);
      await writeFile(referencedPath, fixture.raw, "utf8");
      claim.path = referencedPath;
    }

    let artifactIndex = 0;
    for (const [flag, artifact] of Object.entries(materializedArtifacts)) {
      const artifactPath = join(temporaryDirectory, `artifact-${artifactIndex}.json`);
      await writeFile(artifactPath, `${JSON.stringify(artifact)}\n`, "utf8");
      flags.push(flag, artifactPath);
      artifactIndex += 1;
    }

    const outputs = [];
    for (let invocation = 0; invocation < invocationCount; invocation += 1) {
      const result = spawnSync(process.execPath, [evaluatorPath, ...flags, "--output", outputPath], {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: CLI_TIMEOUT_MS,
      });
      assert.equal(
        result.error,
        undefined,
        `evaluator must finish within ${CLI_TIMEOUT_MS}ms: ${result.error?.message ?? "unknown spawn error"}`,
      );
      assert.equal(
        result.status,
        0,
        `evaluator must exit successfully\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
      outputs.push(await readFile(outputPath, "utf8"));
    }
    return outputs;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function evaluate(artifacts) {
  const [raw] = await runEvaluator(artifacts);
  return JSON.parse(raw);
}

test("fully shaped machine evidence produces explicit gate verdicts", async () => {
  const payload = await evaluate(makeMachineEvidence());

  assert.equal(payload.schemaVersion, "stage1b-gate-verdict-v1");
  assert.deepEqual(
    Object.fromEntries(Object.entries(payload.readiness).map(([id, result]) => [id, result.verdict])),
    { pressureInstrumentation: "PASS", persistenceInstrumentation: "PASS" },
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(payload.gates).map(([id, result]) => [id, result.verdict])),
    { G2: "PASS", G3: "PASS", G5: "N_A", G6: "PASS", G7: "BLOCKED", G8: "BLOCKED" },
  );
  assert.equal(payload.gates.G2.observed.pressure.defeats, 3);
  assert.equal(payload.gates.G2.observed.pressure.measuredBossTtks, 15);
  assert.equal(payload.gates.G6.observed.soak.actualDurationMs, 1_800_000);
  assert.equal(payload.overallDisposition, "BLOCKED");
});

test("identical CLI invocations produce byte-identical output", async () => {
  const [first, second] = await runEvaluator(makeMachineEvidence(), 2);

  assert.equal(second, first);
});

test("G2 reports ties separately instead of crediting them as archetype wins", async () => {
  const payload = await evaluate(makeMachineEvidence());

  assert.equal(payload.gates.G2.verdict, "PASS");
  assert.deepEqual(
    payload.gates.G2.observed.archetypes.map(({ explicitWins, ties, denominator }) => ({ explicitWins, ties, denominator })),
    ARCHETYPES.map(() => ({ explicitWins: 11, ties: 1, denominator: 20 })),
  );
});

test("missing and blank human-study records block G7 and both G8 components", async () => {
  const cases = [
    { name: "missing", humanEvidence: {} },
    {
      name: "blank",
      humanEvidence: { "--g7": {}, "--g8-survey": {}, "--g8-impression": {} },
    },
  ];

  for (const { name, humanEvidence } of cases) {
    const payload = await evaluate({ ...makeMachineEvidence(), ...humanEvidence });
    assert.equal(payload.gates.G7.verdict, "BLOCKED", `${name} G7 evidence must block`);
    assert.equal(payload.gates.G8.verdict, "BLOCKED", `${name} G8 evidence must block`);
    assert.deepEqual(
      payload.gates.G8.components,
      { survey: "BLOCKED", impression: "BLOCKED" },
      `${name} G8 components must both block`,
    );
  }
});

test("G6 remains blocked when passing measurements lack one required provenance claim", async () => {
  const evidence = makeMachineEvidence();
  delete evidence["--g6-provenance"].requirements.uiBrowserGate;

  const payload = await evaluate(evidence);

  assert.equal(payload.gates.G6.verdict, "BLOCKED");
  assert.equal(payload.gates.G6.observed.fullappTiers.length, 4);
  assert.equal(payload.gates.G6.observed.soak.actualDurationMs, 1_800_000);
  assert.equal(payload.gates.G6.rawEvidenceReferences.length, 3);
});

test("valid JSON with out-of-range numeric evidence fails rather than passing or blocking", async () => {
  const evidence = makeMachineEvidence();
  evidence["--pressure"].rows[0].gateMinPct = 54.99;
  evidence["--g6-fullapp"].passes[0].longFrameRatio = 0.005;

  const payload = await evaluate(evidence);

  assert.equal(payload.readiness.pressureInstrumentation.verdict, "PASS");
  assert.equal(payload.gates.G2.verdict, "FAIL");
  assert.equal(payload.gates.G2.observed.pressure.gateMinPctRange[0], 55);
  assert.equal(payload.gates.G6.verdict, "FAIL");
  assert.equal(payload.gates.G6.observed.fullappTiers[0].longFrameRatio, 0.005);
});

test("fully shaped BLOCKED human artifacts remain blocked", async () => {
  const payload = await evaluate({ ...makeMachineEvidence(), ...makeHumanEvidence("BLOCKED") });

  assert.equal(payload.gates.G7.verdict, "BLOCKED");
  assert.equal(payload.gates.G8.verdict, "BLOCKED");
  assert.deepEqual(payload.gates.G8.components, { survey: "BLOCKED", impression: "BLOCKED" });
});

test("G6 provenance requires existing files whose exact bytes match the claimed SHA-256", async (t) => {
  await t.test("exact existing-file references pass", async () => {
    const payload = await evaluate(makeMachineEvidence());

    assert.equal(payload.gates.G6.verdict, "PASS");
    assert.equal(payload.gates.G6.rawEvidenceReferences.length, 4);
  });

  await t.test("a missing referenced file cannot pass", async () => {
    const evidence = makeMachineEvidence();
    evidence["--g6-provenance"].requirements.telemetryContract.path = "missing-telemetry.json";

    const payload = await evaluate(evidence);

    assert.notEqual(payload.gates.G6.verdict, "PASS");
  });

  await t.test("a digest that does not match the referenced bytes cannot pass", async () => {
    const evidence = makeMachineEvidence();
    evidence["--g6-provenance"].requirements.telemetryContract.digest = `sha256:${"0".repeat(64)}`;

    const payload = await evaluate(evidence);

    assert.notEqual(payload.gates.G6.verdict, "PASS");
  });
});

test("negative G6 performance and soak measurements cannot pass", async (t) => {
  const cases = [
    {
      name: "full-app frame p95",
      mutate: (evidence) => { evidence["--g6-fullapp"].passes[0].frameDeltaMs.p95 = -1; },
    },
    {
      name: "full-app long-frame ratio",
      mutate: (evidence) => { evidence["--g6-fullapp"].passes[0].longFrameRatio = -0.001; },
    },
    {
      name: "full-app input p95",
      mutate: (evidence) => { evidence["--g6-fullapp"].passes[0].inputLatencyMs.p95 = -1; },
    },
    {
      name: "full-app DOM count",
      mutate: (evidence) => { evidence["--g6-fullapp"].passes[0].domNodes = -1; },
    },
    {
      name: "soak duration",
      mutate: (evidence) => { evidence["--g6-soak"].actualDurationMs = -1; },
    },
    {
      name: "soak frame p95",
      mutate: (evidence) => { evidence["--g6-soak"].frameDeltaMs.p95 = -1; },
    },
    {
      name: "soak long-frame ratio",
      mutate: (evidence) => { evidence["--g6-soak"].longFrameRatio = -0.001; },
    },
    {
      name: "soak input p95",
      mutate: (evidence) => { evidence["--g6-soak"].inputLatencyMs.p95 = -1; },
    },
  ];

  for (const { name, mutate } of cases) {
    await t.test(name, async () => {
      const evidence = makeMachineEvidence();
      mutate(evidence);

      const payload = await evaluate(evidence);

      assert.notEqual(payload.gates.G6.verdict, "PASS");
    });
  }
});

test("explicit soak memory instability cannot be overridden by favorable derived signals", async () => {
  const evidence = makeMachineEvidence();
  evidence["--g6-soak"].memoryStable = false;
  evidence["--g6-soak"].memoryStatus = "PASS";
  evidence["--g6-soak"].heapSlopeMiBPerMin = -1;

  const payload = await evaluate(evidence);

  assert.notEqual(payload.gates.G6.verdict, "PASS");
});

test("fully shaped human evidence passes at every inclusive endpoint", async () => {
  const payload = await evaluate({ ...makeMachineEvidence(), ...makeHumanEvidence() });

  assert.equal(payload.gates.G7.verdict, "PASS");
  assert.equal(payload.gates.G7.observed.voluntaryReentries, 14);
  assert.equal(payload.gates.G7.observed.eligibleDecisions, 20);
  assert.equal(payload.gates.G8.verdict, "PASS");
  assert.deepEqual(payload.gates.G8.components, { survey: "PASS", impression: "PASS" });
  assert.equal(payload.gates.G8.observed.survey.directFeatureCount, 2);
  assert.equal(payload.gates.G8.observed.impression.median, 4);
});

test("G7 blocks circuits outside 30–180 seconds or missing action and reward minimums", async (t) => {
  const cases = [
    {
      name: "29.999-second circuit",
      mutate: (decision) => {
        decision.timing_end_recording_ms = decision.timing_start_recording_ms + 29_999;
        decision.circuit_duration_seconds = 29.999;
      },
    },
    {
      name: "180.001-second circuit",
      mutate: (decision) => {
        decision.timing_end_recording_ms = decision.timing_start_recording_ms + 180_001;
        decision.circuit_duration_seconds = 180.001;
      },
    },
    {
      name: "fewer than three player actions",
      mutate: (decision) => {
        decision.player_action_ids = ["MOVE_TO_PRESSURE", "HOLD_AND_EXTRACT_ELITE"];
      },
    },
    {
      name: "duplicate player actions",
      mutate: (decision) => {
        decision.player_action_ids = ["MOVE_TO_PRESSURE", "MOVE_TO_PRESSURE", "HOLD_AND_EXTRACT_ELITE"];
      },
    },
    {
      name: "unsupported player action",
      mutate: (decision) => {
        decision.player_action_ids[0] = "UNRECOGNIZED_ACTION";
      },
    },
    {
      name: "zero reward events",
      mutate: (decision) => {
        decision.reward_event_ids = [];
      },
    },
    {
      name: "duplicate reward events",
      mutate: (decision) => {
        decision.reward_event_ids = ["ELITE_EXTRACTED", "ELITE_EXTRACTED"];
      },
    },
    {
      name: "unsupported reward event",
      mutate: (decision) => {
        decision.reward_event_ids = ["UNRECOGNIZED_REWARD"];
      },
    },
  ];

  for (const { name, mutate } of cases) {
    await t.test(name, async () => {
      const human = makeHumanEvidence();
      mutate(human["--g7"].decisions[0]);

      const payload = await evaluate({ ...makeMachineEvidence(), ...human });

      assert.equal(payload.gates.G7.verdict, "BLOCKED");
    });
  }
});

test("missing route outcomes and cross-session recording names block human evidence", async (t) => {
  const cases = [
    {
      name: "G7 route_outcome",
      mutate: (human) => { delete human["--g7"].decisions[0].route_outcome; },
      verdict: (payload) => payload.gates.G7.verdict,
    },
    {
      name: "G7 recording participant binding",
      mutate: (human) => {
        human["--g7"].decisions[0].screen_recording_file_name =
          `${BUILD_SHA}__G7-P02__s01__e000__session-recording.webm`;
      },
      verdict: (payload) => payload.gates.G7.verdict,
    },
    {
      name: "G8 route_outcome",
      mutate: (human) => { delete human["--g8-impression"].sessions[0].route_outcome; },
      verdict: (payload) => payload.gates.G8.components.impression,
    },
    {
      name: "G8 recording participant binding",
      mutate: (human) => {
        human["--g8-impression"].sessions[0].screen_recording_file_name =
          `${BUILD_SHA}__G8-P02__s01__e000__session-recording.webm`;
      },
      verdict: (payload) => payload.gates.G8.components.impression,
    },
  ];

  for (const { name, mutate, verdict } of cases) {
    await t.test(name, async () => {
      const human = makeHumanEvidence();
      mutate(human);

      const payload = await evaluate({ ...makeMachineEvidence(), ...human });

      assert.equal(verdict(payload), "BLOCKED");
    });
  }
});

test("G8 impression canonical question, scale, and collection timestamp fail closed", async (t) => {
  const cases = [
    {
      name: "missing canonical question",
      mutate: (impression) => { delete impression.question; },
    },
    {
      name: "arbitrary question",
      mutate: (impression) => { impression.question = "Was this feature memorable?"; },
    },
    {
      name: "mutated response scale",
      mutate: (impression) => { impression.scale.maximum = 10; },
    },
    {
      name: "invalid collected_at_utc",
      mutate: (impression) => { impression.collected_at_utc = "not-a-timestamp"; },
    },
    {
      name: "missing collected_at_utc",
      mutate: (impression) => { delete impression.collected_at_utc; },
    },
  ];

  for (const { name, mutate } of cases) {
    await t.test(name, async () => {
      const human = makeHumanEvidence();
      mutate(human["--g8-impression"]);

      const payload = await evaluate({ ...makeMachineEvidence(), ...human });

      assert.equal(payload.gates.G8.components.impression, "BLOCKED");
    });
  }
});

test("G8 survey rejects unsupported source kinds", async () => {
  const human = makeHumanEvidence();
  human["--g8-survey"].rows[0].sources[0].source_kind = "COMMUNITY_WIKI";

  const payload = await evaluate({ ...makeMachineEvidence(), ...human });

  assert.equal(payload.gates.G8.components.survey, "BLOCKED");
});

test("malformed symmetric outcomes cannot pass G2", async (t) => {
  const cases = [
    {
      name: "unknown terminal",
      mutate: (outcomeRecord) => { outcomeRecord.terminal = "UNKNOWN"; },
    },
    {
      name: "negative total damage",
      mutate: (outcomeRecord) => { outcomeRecord.totalDamageDealt = -1; },
    },
    {
      name: "negative commander integrity",
      mutate: (outcomeRecord) => { outcomeRecord.endIntegrity.commander = -1; },
    },
    {
      name: "negative gate integrity",
      mutate: (outcomeRecord) => { outcomeRecord.endIntegrity.gate = -1; },
    },
    {
      name: "negative terminal tick",
      mutate: (outcomeRecord) => { outcomeRecord.tick = -1; },
    },
  ];

  for (const { name, mutate } of cases) {
    await t.test(name, async () => {
      const evidence = makeMachineEvidence();
      mutateFirstSymmetricOutcome(evidence, mutate);

      const payload = await evaluate(evidence);

      assert.notEqual(payload.gates.G2.verdict, "PASS");
    });
  }
});
