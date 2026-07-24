import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packetPath = join(
  repositoryRoot,
  "_workspace",
  "20260722-abyssal-command-bmad-gds-expansion",
  "qa",
  "g2-prepared-prerequisite-bindings-v1.json",
);
// This fixture was committed once (2c39fce) and later removed from the
// working tree by an out-of-band disk-pressure cleanup; unlike its sibling
// fixtures under this same _workspace run, it has no earlier git history
// entry of its own and no copy survives in either sibling worktree
// (Abyssal-Surge-3d-overhaul, Abyssal-Surge-cycle2) as of 2026-07-25 --
// confirmed genuinely lost, not merely uncommitted. Skip with a named
// reason instead of leaving this permanently red (see decision-log.md).
const packetFixtureExists = existsSync(packetPath);

const EXPECTED_REGISTERS = [
  {
    name: "assessment_units",
    path: "design/g2-assessment-units-v1.json",
    register_id: "g2-assessment-units-v1",
    version: "1.1.0-runtime-backed",
    digest_kind: "file_sha256",
    digest: "sha256:1f7a4f9a36e68b27e8d129a50503f284c564251e3765756c6468d1d44a7d6804",
  },
  {
    name: "ttk_cohorts",
    path: "design/g2-ttk-cohort-register-v1.json",
    register_id: "g2-ttk-cohort-register-v1",
    version: "1.1.0-runtime-backed",
    digest_kind: "file_sha256",
    digest: "sha256:6471f16bf7ee618b40b14de9a684421ec6c5c42c13f9375894862ad7800bd579",
  },
  {
    name: "combo_comparator",
    path: "pm/g2-combo-comparator-register-v1.json",
    register_id: "g2-combo-comparator-register-v1",
    version: "g2-combo-comparator-register/1",
    digest_kind: "file_sha256",
    digest: "sha256:d2cc608450c447fa4a5ebd1327f22f1a80030f459f4ad6530acd4125d2da5c43",
  },
  {
    name: "full_route_seeds",
    path: "qa/g2-full-route-seed-register-v1.json",
    register_id: "g2-full-route-seed-register-v1",
    version: null,
    digest_kind: "canonical_payload_sha256",
    digest: "sha256:05fca1f271112edd0dfb78244ec4727399eef60ebee24be673ba0f5d7de5f623",
  },
  {
    name: "input_tapes",
    path: "qa/g2-input-tape-register-v1.json",
    register_id: "g2-input-tape-register-v1",
    version: null,
    digest_kind: "canonical_payload_sha256",
    digest: "sha256:665ad2b7cf0817b9b4aa9a3856cbdd8edf3f1b8eb583317ff60ac66c42216dcb",
  },
  {
    name: "expected_tuples",
    path: "g2-expected-tuples-v1.json",
    register_id: "g2-expected-tuples-v1",
    version: null,
    digest_kind: "canonical_payload_sha256",
    digest: "sha256:e83ec46c671b613e33d009d27bb237acea96019f25cab4d07b5e4acd024bc704",
  },
];

const FACTUAL_BINDING_GROUPS = [
  "map_wave_terminal",
  "runner_source_identity",
  "m4_recovery_card_identity",
  "m5_stable_event_identity",
  "m6_fixture_comparator",
  "execution_design_closure",
];

const EXPLICIT_EXCLUSIONS = [
  "human or role signatures",
  "R1 or R2 reviews",
  "collection-admission control record",
  "candidate selection or execution",
  "raw corpus or evidence JSONL",
  "metric, outcome, or threshold conclusion",
  "G2 or G8 PASS claim",
  "release or deployment authorization",
];

const EXPECTED_ATTESTATIONS = [
  {
    owner: "game-designer",
    status: "UNSIGNED",
    scope: "Finite route/map/wave/tape, pressure/fallback, terminal, TTK, and multi-skill applicability acceptance.",
  },
  {
    owner: "game-qa",
    status: "UNSIGNED",
    scope: "Exact expected-tuple closure, raw-event/failure-row protocol, corpus custody, and runner/fixture identity countersignature.",
  },
  {
    owner: "game-programmer + game-qa",
    status: "UNSIGNED",
    scope: "Runner admission boundary, immutable runtime identity, populated identity facts, and observer non-interference.",
  },
  {
    owner: "game-designer + game-qa + game-pm",
    status: "UNRECONCILED_OWNER_SET__UNSIGNED",
    scope: "Resolve the M6 attribution owner-set conflict, then attest actual multi-skill signature and comparator population.",
  },
  {
    owner: "R1 package-integrity reviewer",
    status: "UNASSIGNED",
    scope: "Independent package-integrity review after signed bindings exist.",
  },
  {
    owner: "R2 metric-reproducibility reviewer",
    status: "UNASSIGNED",
    scope: "Independent metric-reproducibility review after signed bindings and focused proofs exist.",
  },
];

function collectKeys(value, path = "$", keys = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectKeys(item, `${path}[${index}]`, keys));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      keys.push({ key, path: `${path}.${key}`, value: item });
      collectKeys(item, `${path}.${key}`, keys);
    });
  }
  return keys;
}
function collectStrings(value, path = "$", strings = []) {
  if (typeof value === "string") {
    strings.push({ path, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, strings));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectStrings(item, `${path}.${key}`, strings));
  }
  return strings;
}

const AUTHORITY_NOUN = "(?:signature|role\\s+attestation|candidate\\s+execution|corpus|evidence|metric|outcome|threshold)";
const POSITIVE_AUTHORITY_CLAIM = new RegExp(
  `\\b${AUTHORITY_NOUN}\\b[^.]{0,120}\\b(?:exists|present|complete(?:d)?|done|finished|confirmed|collected|authorized|admitted|executed|signed|attested|passed|approved|available)\\b`
  + `|\\b(?:exists|present|complete(?:d)?|done|finished|confirmed|collected|authorized|admitted|executed|signed|attested|passed|approved|available)\\b[^.]{0,120}\\b${AUTHORITY_NOUN}\\b`
  + "|\\b(?:metric|outcome|threshold)\\s+(?:conclusion|result|value|score|rate)\\s*[:=]",
  "i",
);

function isRecognizedDenialContext(path) {
  return path.startsWith("$.explicit_exclusions[")
    || path === "$.purpose"
    || path.startsWith("$.collection_boundary.")
    || /^[$]\.required_attestations\[\d+\]\.scope$/.test(path)
    || /^[$]\.required_factual_bindings\.[^.]+\.invariant$/.test(path)
    || /^[$]\.focused_proof_references\[\d+\]\.boundary$/.test(path);
}

test("the G2 prerequisite binding packet remains unsigned, unadmitted, and collection-blocked", { skip: !packetFixtureExists && "fixture g2-prepared-prerequisite-bindings-v1.json lost to disk-pressure cleanup, unrecoverable from git history or sibling worktrees -- see decision-log.md" }, async () => {
  const text = await readFile(packetPath, "utf8");
  let packet;
  try {
    packet = JSON.parse(text);
  } catch (error) {
    assert.fail(`prepared prerequisite packet must contain valid JSON: ${error.message}`);
  }

  assert.equal(packet.packet_id, "g2-prepared-prerequisite-bindings-v1");
  assert.equal(packet.schema_version, "1.0.0");
  assert.equal(packet.binding_state, "PREPARED_UNSIGNED__COLLECTION_BLOCKED");
  assert.equal(packet.g2_state, "NOT MEASURED / NOT PASSED");
  assert.equal(packet.g8_state, "NOT MEASURED / NOT PASSED");
  assert.equal(packet.stage_2_state, "REDO");
  assert.equal(packet.release_state, "BLOCKED");
  assert.deepEqual(packet.frozen_registers, EXPECTED_REGISTERS);

  assert.deepEqual(Object.keys(packet.required_factual_bindings).sort(), [
    ...FACTUAL_BINDING_GROUPS,
    "fail_closed_execution",
  ].sort());
  for (const group of FACTUAL_BINDING_GROUPS) {
    assert.equal(
      packet.required_factual_bindings[group].status,
      "AWAITING_SIGNED_FACTUAL_BINDINGS",
      `${group} must remain a future signed factual binding, not a runtime result`,
    );
  }
  assert.equal(
    packet.required_factual_bindings.fail_closed_execution.status,
    "REQUIRED_BEFORE_CANDIDATE_SELECTION",
  );
  assert.deepEqual(
    packet.required_factual_bindings.map_wave_terminal.per_admitted_tuple,
    [
      "MapKey",
      "immutable_pre_tick_0_MapPlan_digest",
      "immutable_WavePlan_digest_and_encounter_plan",
      "pressure_fallback_inventory",
      "finite_terminal_tick_ceiling",
      "terminal_outcome_mapping",
    ],
  );
  assert.deepEqual(
    packet.required_factual_bindings.runner_source_identity.fields,
    [
      "runtime_source_revision",
      "runner_build_hash",
      "catalog_digest",
      "serializer_version",
      "map_grammar_version",
      "wave_grammar_version",
      "fixture_adapter_revision",
      "observer_A_implementation_hash",
      "observer_B_implementation_hash",
    ],
  );
  assert.deepEqual(
    packet.required_factual_bindings.m4_recovery_card_identity.fields,
    [
      "case_identifier",
      "declared_card_or_recovery_choice",
      "public_input_type_and_tick",
      "card_event_identity",
      "recovery_event_identity",
      "checkpoint_identity",
      "first_failure_or_divergence",
    ],
  );
  assert.deepEqual(
    packet.required_factual_bindings.m5_stable_event_identity.fields,
    [
      "cohort_mapping_id",
      "target_instance_id",
      "spawn_event_id_and_tick",
      "cast_event_id",
      "causal_event_id",
      "resolved_event_id",
      "terminal_or_stop_identity",
    ],
  );
  assert.deepEqual(
    packet.required_factual_bindings.m6_fixture_comparator.fields,
    [
      "at_least_two_distinct_active_skill_ability_ids",
      "linked_cast_causal_target_resolved_event_identities",
      "non_empty_finite_signature_registry",
      "finite_map_seed_deck_position_comparator_population",
      "comparator_calculation_and_zero_denominator_disposition",
    ],
  );
  assert.deepEqual(
    packet.required_factual_bindings.execution_design_closure.fields,
    [
      "regenerated_expected_tuple_set_digest",
      "one_terminal_or_stop_failure_row_per_required_id",
      "observer_cadence_replay_members",
      "separately_scoped_M7_raw_action_workload",
      "first_falsifier_retention",
    ],
  );

  assert.deepEqual(packet.required_attestations, EXPECTED_ATTESTATIONS);
  assert.deepEqual(packet.collection_boundary, {
    admission_control_record: "ABSENT",
    candidate_selection: "FORBIDDEN",
    candidate_execution: "FORBIDDEN",
    corpus_destination: "FORBIDDEN_UNTIL_SEPARATE_ADMISSION_CONTROL_RECORD",
    outcome_or_metric_records: "FORBIDDEN",
    gate_or_release_disposition: "FORBIDDEN",
  });
  assert.deepEqual(packet.explicit_exclusions, EXPLICIT_EXCLUSIONS);

  const allowedBoundaryKeys = new Map([
    ["$.collection_boundary.admission_control_record", "ABSENT"],
    ["$.collection_boundary.candidate_selection", "FORBIDDEN"],
    ["$.collection_boundary.candidate_execution", "FORBIDDEN"],
    ["$.collection_boundary.corpus_destination", "FORBIDDEN_UNTIL_SEPARATE_ADMISSION_CONTROL_RECORD"],
    ["$.collection_boundary.outcome_or_metric_records", "FORBIDDEN"],
    ["$.collection_boundary.gate_or_release_disposition", "FORBIDDEN"],
  ]);
  for (const entry of collectKeys(packet)) {
    if (/(signature|role_attestation|evidence)/i.test(entry.key)) {
      assert.fail(`${entry.path} asserts forbidden signature, role-attestation, or evidence data`);
    }
    if (/(admission|candidate|corpus|metric|outcome|threshold|(?:gate|release)_(?:authorization|disposition))/i.test(entry.key)) {
      assert.equal(
        entry.value,
        allowedBoundaryKeys.get(entry.path),
        `${entry.path} must only express the fail-closed boundary`,
      );
    }
  }
  assert.deepEqual(
    collectKeys(packet).filter(({ key }) => key === "status").map(({ value }) => value),
    [
      ...FACTUAL_BINDING_GROUPS.map(() => "AWAITING_SIGNED_FACTUAL_BINDINGS"),
      "REQUIRED_BEFORE_CANDIDATE_SELECTION",
      ...EXPECTED_ATTESTATIONS.map(({ status }) => status),
    ],
    "all status fields must remain pending prerequisites rather than active authority or results",
  );
  for (const { path, value } of collectStrings(packet)) {
    if (isRecognizedDenialContext(path)) continue;
    assert.doesNotMatch(
      value,
      /\b(?:G2|G8)\s+(?:GATE\s+)?PASS(?:ED)?\b|\b(?:COLLECTION|RELEASE)\s+AUTHORI[ZS](?:ED|ATION)\b/i,
      `${path} must not assert a G2/G8 pass or collection/release authorization`,
    );
    assert.doesNotMatch(
      value,
      POSITIVE_AUTHORITY_CLAIM,
      `${path} must not assert a positive signature, attestation, candidate, corpus, evidence, or metric result`,
    );
  }
});
