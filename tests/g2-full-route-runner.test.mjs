import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign as signPayload } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runG2FullRoute } from "../g2-full-route-runner.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalSourceRoot = join(repositoryRoot, "_workspace", "20260722-abyssal-command-bmad-gds-expansion");
const SCRIPT_PATH = "scripts/run-g2-full-route.mjs";
const CANONICAL_PATHS = {
  expectedTuples: "g2-expected-tuples-v1.json",
  inputTapeRegister: "qa/g2-input-tape-register-v1.json",
  seedRegister: "qa/g2-full-route-seed-register-v1.json",
};

const ROOT_ONLY_REGISTER_PATHS = [
  "g2-full-route-seed-register-v1.json",
  "g2-input-tape-register-v1.json",
];
const SOURCE_CONTRACT_PATHS = [
  "design/g2-assessment-units-v1.json",
  "design/g2-ttk-cohort-register-v1.json",
  "pm/g2-combo-comparator-register-v1.json",
];
const REQUIRED_ADMISSION_ROLES = [
  "game-designer",
  "game-qa",
  "game-programmer",
  "game-pm",
  "game-production-director",
];
const RUNTIME_SOURCE_PATHS = [
  "defense-catalog.js",
  "defense-run-simulation.js",
  "g2-full-route-runner.js",
];

function canonicalStringify(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
}

function checksumFor(record) {
  const { record_checksum: _checksum, ...unsignedRecord } = record;
  return `sha256:${createHash("sha256").update(canonicalStringify(unsignedRecord), "utf8").digest("hex")}`;
}

function payloadDigestFor(document) {
  const { canonical_payload_sha256: _digest, ...payload } = document;
  return `sha256:${createHash("sha256").update(canonicalStringify(payload), "utf8").digest("hex")}`;
}

function parseJsonl(content) {
  return content.trim().split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`JSONL line ${index + 1} is invalid: ${error.message}`);
    }
  });
}

async function copyCanonicalRegisters(registerRoot) {
  await Promise.all(["qa", "design", "pm"].map((path) => mkdir(join(registerRoot, path), { recursive: true })));
  await Promise.all([
    ...Object.values(CANONICAL_PATHS).map((path) => copyFile(
      join(canonicalSourceRoot, path),
      join(registerRoot, path),
    )),
    ...ROOT_ONLY_REGISTER_PATHS.map((path) => copyFile(
      join(canonicalSourceRoot, path),
      join(registerRoot, path),
    )),
    ...SOURCE_CONTRACT_PATHS.map((path) => copyFile(
      join(canonicalSourceRoot, path),
      join(registerRoot, path),
    )),
  ]);
  await Promise.all(ROOT_ONLY_REGISTER_PATHS.map((path) => writeFile(
    join(registerRoot, path),
    "This root-level register decoy must never be read.",
    "utf8",
  )));
}

function runCli(registerRoot, outputPath, extraArgs = []) {
  return spawnSync(process.execPath, [
    SCRIPT_PATH,
    "--register-root", registerRoot,
    ...extraArgs,
    "--output", outputPath,
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

async function makeTestOnlyAdmission(registerRoot) {
  const [expectedTuples, inputTapeRegister, seedRegister] = await Promise.all(
    Object.values(CANONICAL_PATHS).map(async (path) => JSON.parse(await readFile(join(registerRoot, path), "utf8"))),
  );
  const [sourceContractTexts, runtimeDigests] = await Promise.all([
    Promise.all(SOURCE_CONTRACT_PATHS.map((path) => readFile(join(registerRoot, path), "utf8"))),
    Promise.all(RUNTIME_SOURCE_PATHS.map(async (path) => [path, `sha256:${createHash("sha256").update(await readFile(join(repositoryRoot, path), "utf8"), "utf8").digest("hex")}`])),
  ]);
  const tuples = Object.values(expectedTuples.expected_tuples).flat();
  const expectedTupleDigest = `sha256:${createHash("sha256").update(canonicalStringify(expectedTuples.expected_tuples), "utf8").digest("hex")}`;
  const sourceHashes = Object.fromEntries(runtimeDigests);
  const signature = {
    algorithm: "TEST_ONLY_NOT_A_CRYPTOGRAPHIC_SIGNATURE",
    signer: "test-fixture",
    value: "unsigned-test-fixture",
  };

  return {
    schema_version: "g2-collection-admission-manifest-v1",
    manifest_id: "test-only-unsigned-admission",
    admission_nonce: "test-only-unsigned-admission-nonce",
    expires_at: "2100-01-01T00:00:00.000Z",
    authorization: "SIGNED_G2_FULL_ROUTE_COLLECTION",
    signature,
    role_attestations: REQUIRED_ADMISSION_ROLES.map((role) => ({ role, status: "SIGNED_COLLECTION_ADMISSION", signature })),
    execution_closure: {
      expected_tuple_manifest_digest: expectedTupleDigest,
      expected_tuple_count: tuples.length,
      admitted_tuple_ids: tuples.map(({ expected_tuple_id: tupleId }) => tupleId),
    },
    canonical_register_digests: {
      "g2-expected-tuples-v1.json": payloadDigestFor(expectedTuples),
      "qa/g2-full-route-seed-register-v1.json": payloadDigestFor(seedRegister),
      "qa/g2-input-tape-register-v1.json": payloadDigestFor(inputTapeRegister),
      ...Object.fromEntries(SOURCE_CONTRACT_PATHS.map((path, index) => [
        path,
        `sha256:${createHash("sha256").update(sourceContractTexts[index], "utf8").digest("hex")}`,
      ])),
    },
    runtime_identity: {
      rules_source_revision: "test-only-untrusted-envelope",
      source_hashes: sourceHashes,
      rules_catalog_digest: sourceHashes["defense-catalog.js"],
      runner_build_hash: sourceHashes["g2-full-route-runner.js"],
      canonical_serializer_build_hash: sourceHashes["g2-full-route-runner.js"],
      observer_implementation_hashes: {},
    },
    terminal_tick_ceilings: Object.fromEntries(new Set([
      ...tuples.map((tuple) => tuple.assessment_condition_id ?? tuple.matrix_id),
      ...(expectedTuples.source_contract_bindings?.assessment_unit_bindings ?? []).map(({ assessment_condition_id: conditionId }) => conditionId),
    ]).values().map((key) => [key, 1])),
  };
}

async function writeJsonDocument(path, document) {
  document.canonical_payload_sha256 = payloadDigestFor(document);
  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function unsignedAdmissionPayload(manifest) {
  const {
    signature: _authorizationSignature,
    signed_payload_sha256: _payloadDigest,
    role_attestations: roleAttestations,
    ...payload
  } = manifest;
  return {
    ...payload,
    role_attestations: roleAttestations.map(({ signature: _roleSignature, ...attestation }) => attestation),
  };
}

function signedTestSignature(key, keyId, payloadDigest) {
  return {
    algorithm: "ed25519",
    key_id: keyId,
    signed_payload_sha256: payloadDigest,
    value: signPayload(null, Buffer.from(payloadDigest, "utf8"), key).toString("base64"),
  };
}

async function installTestOnlyTrustRegistry(registerRoot) {
  const path = join(registerRoot, CANONICAL_PATHS.expectedTuples);
  const expected = JSON.parse(await readFile(path, "utf8"));
  const roles = ["collection-admission", ...REQUIRED_ADMISSION_ROLES];
  const keyPairs = new Map(roles.map((role) => [role, generateKeyPairSync("ed25519")]));

  expected.admission_trust_registry = {
    registry_id: "g2-local-admission-trust-registry-v1",
    algorithm: "ed25519",
    keys: roles.map((role) => ({
      key_id: `test-only-${role}-key`,
      role,
      algorithm: "ed25519",
      status: "ACTIVE",
      public_key_pem: keyPairs.get(role).publicKey.export({ type: "spki", format: "pem" }),
    })),
  };
  await writeJsonDocument(path, expected);
  return keyPairs;
}

async function makeCryptographicTestAdmission(registerRoot, admissionNonce, terminalTickCeiling = null) {
  const keys = await installTestOnlyTrustRegistry(registerRoot);
  const manifest = await makeTestOnlyAdmission(registerRoot);
  manifest.manifest_id = "test-only-ed25519-admission";
  manifest.admission_nonce = admissionNonce;
  if (terminalTickCeiling) {
    for (const tuple of Object.values(JSON.parse(await readFile(join(registerRoot, CANONICAL_PATHS.expectedTuples), "utf8")).expected_tuples).flat()) {
      manifest.terminal_tick_ceilings[tuple.assessment_condition_id ?? tuple.matrix_id] = terminalTickCeiling;
    }
  }
  manifest.expires_at = "2100-01-01T00:00:00.000Z";
  manifest.role_attestations = REQUIRED_ADMISSION_ROLES.map((role) => ({
    role,
    status: "SIGNED_COLLECTION_ADMISSION",
  }));
  const payloadDigest = `sha256:${createHash("sha256").update(canonicalStringify(unsignedAdmissionPayload(manifest)), "utf8").digest("hex")}`;
  manifest.signed_payload_sha256 = payloadDigest;
  manifest.signature = signedTestSignature(keys.get("collection-admission").privateKey, "test-only-collection-admission-key", payloadDigest);
  manifest.role_attestations = manifest.role_attestations.map((attestation) => ({
    ...attestation,
    signature: signedTestSignature(keys.get(attestation.role).privateKey, `test-only-${attestation.role}-key`, payloadDigest),
  }));
  return manifest;
}

async function prepareReducedCollectionFixture(registerRoot, admissionNonce) {
  await copyCanonicalRegisters(registerRoot);
  const expectedPath = join(registerRoot, CANONICAL_PATHS.expectedTuples);
  const expected = JSON.parse(await readFile(expectedPath, "utf8"));
  const rows = expected.expected_tuples;
  const m2Baseline = rows.M2.find((tuple) => tuple.observer_cell_id === "normal-A" && tuple.harness_cadence_hz === 60);
  const m2Comparison = rows.M2.find((tuple) => tuple.base_tuple_family_id === m2Baseline?.base_tuple_family_id
    && tuple.observer_cell_id !== "normal-A" && tuple.harness_cadence_hz !== 60);
  const m3TargetLoss = rows.M3.find((tuple) => tuple.cooldown_probe_id?.includes("target-loss-reacquire"));
  const m4DeclineThenSelect = rows.M4.find((tuple) => tuple.recovery_case_id === "decline-then-select-v1");
  assert.ok(m2Baseline && m2Comparison && m3TargetLoss && m4DeclineThenSelect,
    "temporary fixture must retain the selected closed-matrix route cases");

  expected.expected_tuples = {
    M1: [],
    M2: [m2Baseline, m2Comparison],
    M3: [m3TargetLoss],
    M4: [m4DeclineThenSelect],
    M5: [],
    M6: rows.M6.slice(0, 2),
    M7: [],
  };
  expected.expected_row_counts = {
    M1_full_route_outcomes: 0,
    M2_observer_invariance: 2,
    M3_cooldown_boundaries: 1,
    M4_recovery_fallback: 1,
    M5_ttk_cohorts: 0,
    M6_combo_ev_admissible_rows: 2,
    M7_critical_distribution_execution_cells: 0,
    total_admissible_expected_tuple_ids: 6,
  };
  await writeJsonDocument(expectedPath, expected);
  const manifest = await makeCryptographicTestAdmission(registerRoot, admissionNonce, 12000);
  return { expected, manifest };
}

async function loadM6ComparatorTestHook() {
  const path = join(repositoryRoot, `.g2-m6-comparator-test-${process.pid}-${Date.now()}.mjs`);
  const source = await readFile(join(repositoryRoot, "g2-full-route-runner.js"), "utf8");
  await writeFile(path, source.replace("function appendM6ComparatorRecords(records, fingerprints, comparator) {",
    "export function appendM6ComparatorRecords(records, fingerprints, comparator) {"), "utf8");
  const module = await import(`${pathToFileURL(path).href}?${Date.now()}`);
  return {
    appendM6ComparatorRecords: module.appendM6ComparatorRecords,
    cleanup: () => unlink(path),
  };
}


test("G2 full-route CLI retains the canonical no-collection stop as deterministic fail-closed JSONL", async () => {

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-runner-"));
  const firstRoot = join(temporaryDirectory, "first-root");
  const secondRoot = join(temporaryDirectory, "second-root");
  const firstOutput = join(temporaryDirectory, "first.jsonl");
  const secondOutput = join(temporaryDirectory, "second.jsonl");

  try {
    await Promise.all([copyCanonicalRegisters(firstRoot), copyCanonicalRegisters(secondRoot)]);
    const firstResult = runCli(firstRoot, firstOutput);
    const secondResult = runCli(secondRoot, secondOutput);

    assert.equal(firstResult.status, 1, "blocked admission must make the CLI fail");
    assert.equal(secondResult.status, 1, "blocked admission must make the CLI fail in every root layout");
    assert.equal(firstResult.signal, null);
    assert.equal(secondResult.signal, null);

    const [firstJsonl, secondJsonl] = await Promise.all([readFile(firstOutput, "utf8"), readFile(secondOutput, "utf8")]);
    assert.equal(secondJsonl, firstJsonl, "absolute register-root paths must not affect checksummed evidence");

    const records = parseJsonl(firstJsonl);
    const [manifest, ...remaining] = records;
    const summary = remaining.at(-1);
    const stopped = remaining.slice(0, -1);
    assert.deepEqual(records.map(({ record_type: recordType }) => recordType), [
      "manifest",
      "run_stopped",
      "summary",
    ], "the fail-closed package must contain no collection or outcome record");

    assert.equal(manifest.record_type, "manifest");
    assert.equal(summary.record_type, "summary");
    assert.equal(manifest.measurement_status, "INCOMPLETE");
    assert.equal(summary.measurement_status, "INCOMPLETE");
    assert.equal(manifest.gate_verdict, "NOT_PASSED");
    assert.equal(summary.gate_verdict, "NOT_PASSED");
    assert.deepEqual(manifest.canonical_register_paths, CANONICAL_PATHS);
    assert.equal("register_root" in manifest, false, "absolute roots must not be emitted");
    assert.deepEqual(Object.keys(manifest.source_hashes).sort(), Object.values(CANONICAL_PATHS).sort(),
      "only the workspace expected tuples and QA seed/input registers may be provenance inputs");
    assert.equal(manifest.collection_mode, "headless-admission-only");
    assert.equal(manifest.command, "node scripts/run-g2-full-route.mjs --register-root <register-root> --output <output>");

    assert.equal(stopped.length, 1, "the authorized canonical registers stop only because collection is not authorized");
    assert.deepEqual(stopped.map(({ failure_code: code }) => code), [
      "FAIL_COLLECTION_NOT_AUTHORIZED",
    ]);
    assert.deepEqual(stopped.map(({ record_type: recordType }) => recordType), ["run_stopped"]);

    for (const [index, record] of records.entries()) {
      assert.equal(record.sequence, index, "records must remain append-only and contiguous");
      assert.equal(record.record_checksum, checksumFor(record), `${record.record_type} checksum must match canonical JSON`);
      assert.equal(record.candidate_tuple_digest, null, "collection must not admit a candidate while provenance is invalid");
      assert.equal(record.measurement_status, "INCOMPLETE");
      assert.equal(record.gate_verdict, "NOT_PASSED");
    }

    for (const record of stopped) {
      assert.equal(record.last_checkpoint, null);
      assert.equal(record.signed_terminal_tick_ceiling, null);
      assert.equal(record.failure_code, record.stop_code);
    }

    assert.equal(summary.started_run_count, 0);
    assert.equal(summary.terminal_run_count, 0);
    assert.equal(summary.collection_started, false);
    assert.equal(summary.stopped_run_count, stopped.length);
    assert.equal(summary.invalid_run_count, stopped.length);
    assert.equal(summary.first_falsifier_sequence, stopped[0].sequence);
    assert.equal(summary.missing_run_count, manifest.expected_tuple_count);
    assert.equal(records.some(({ record_type: type }) => type === "run_started" || type === "run_terminal"), false);
    assert.equal(records.some(({ outcome }) => outcome === "VICTORY" || outcome === "LOSS"), false);
    assert.equal(records.some((record) => "metrics" in record || "route_win_rate" in record || "ttk" in record), false);
    assert.equal(records.some(({ gate_verdict: verdict }) => verdict === "PASSED"), false);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("G2 full-route CLI rejects a noncanonical register override before collection", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-noncanonical-"));
  const registerRoot = join(temporaryDirectory, "canonical-root");
  const outputPath = join(temporaryDirectory, "g2-full-route.jsonl");

  try {
    await copyCanonicalRegisters(registerRoot);
    const result = runCli(registerRoot, outputPath, [
      "--expected-tuples", join(registerRoot, CANONICAL_PATHS.inputTapeRegister),
    ]);

    assert.equal(result.status, 2, "a noncanonical register path is a CLI admission error");
    assert.match(result.stderr, /FAIL_REGISTER_PATH_NONCANONICAL/);
    await assert.rejects(readFile(outputPath, "utf8"));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("G2 full-route CLI rejects a QA register symlink that escapes its temporary root", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-symlink-"));
  const registerRoot = join(temporaryDirectory, "canonical-root");
  const outputPath = join(temporaryDirectory, "g2-full-route.jsonl");
  const escapedSeedPath = join(temporaryDirectory, "outside-seed-register.json");
  const admittedSeedPath = join(registerRoot, CANONICAL_PATHS.seedRegister);

  try {
    await copyCanonicalRegisters(registerRoot);
    await copyFile(admittedSeedPath, escapedSeedPath);
    await unlink(admittedSeedPath);
    await symlink(escapedSeedPath, admittedSeedPath);

    const result = runCli(registerRoot, outputPath);

    assert.equal(result.status, 2, "a QA register symlink outside the canonical root is a CLI admission error");
    assert.match(result.stderr, /FAIL_REGISTER_PATH_INVALID/);
    await assert.rejects(readFile(outputPath, "utf8"));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("G2 full-route CLI reports the recomputed source hash when a declared self-digest is corrupt", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-self-digest-"));
  const registerRoot = join(temporaryDirectory, "canonical-root");
  const outputPath = join(temporaryDirectory, "g2-full-route.jsonl");
  const expectedTuplesPath = join(registerRoot, CANONICAL_PATHS.expectedTuples);
  const corruptDigest = `sha256:${"0".repeat(64)}`;

  try {
    await copyCanonicalRegisters(registerRoot);
    const expectedTuples = JSON.parse(await readFile(expectedTuplesPath, "utf8"));
    expectedTuples.canonical_payload_sha256 = corruptDigest;
    await writeFile(expectedTuplesPath, `${JSON.stringify(expectedTuples, null, 2)}\n`, "utf8");

    const result = runCli(registerRoot, outputPath);

    assert.equal(result.status, 1, "a corrupt declared self-digest must stop collection");
    const records = parseJsonl(await readFile(outputPath, "utf8"));
    const manifest = records[0];
    const expectedActualDigest = payloadDigestFor(expectedTuples);
    const selfDigestStop = records.find(({ failure_code: code }) => code === "FAIL_REGISTER_SELF_DIGEST_MISMATCH");

    assert.equal(manifest.source_hashes[CANONICAL_PATHS.expectedTuples], expectedActualDigest);
    assert.notEqual(manifest.source_hashes[CANONICAL_PATHS.expectedTuples], corruptDigest,
      "source hashes must report recomputed content, never a corrupt declaration");
    assert.ok(selfDigestStop, "the corrupt declaration must be surfaced as a stopped run");
    assert.equal(selfDigestStop.rejected_provenance.expected_digest, corruptDigest);
    assert.equal(selfDigestStop.rejected_provenance.actual_digest, expectedActualDigest);
    assert.equal(records.some(({ candidate_tuple_digest: digest }) => digest !== null), false);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("G2 full-route CLI rejects expected tuple schema and register ID corruption", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-schema-"));

  try {
    for (const [field, invalidValue] of [
      ["schema_version", "g2-expected-tuples-v0"],
      ["register_id", "g2-unrecognized-register"],
    ]) {
      const registerRoot = join(temporaryDirectory, field);
      const outputPath = join(temporaryDirectory, `${field}.jsonl`);
      const expectedTuplesPath = join(registerRoot, CANONICAL_PATHS.expectedTuples);

      await copyCanonicalRegisters(registerRoot);
      const expectedTuples = JSON.parse(await readFile(expectedTuplesPath, "utf8"));
      expectedTuples[field] = invalidValue;
      expectedTuples.canonical_payload_sha256 = payloadDigestFor(expectedTuples);
      await writeFile(expectedTuplesPath, `${JSON.stringify(expectedTuples, null, 2)}\n`, "utf8");

      const result = runCli(registerRoot, outputPath);

      assert.equal(result.status, 1, `${field} corruption must stop collection`);
      const records = parseJsonl(await readFile(outputPath, "utf8"));
      const schemaStops = records.filter(({ failure_code: code }) => code === "FAIL_REGISTER_SCHEMA_INVALID");

      assert.equal(schemaStops.length, 1, `${field} must emit one schema stop`);
      assert.equal(schemaStops[0].rejected_provenance.register, "expected_tuples");
      assert.equal(schemaStops[0].rejected_provenance.field, field);
      assert.equal(records.some(({ candidate_tuple_digest: digest }) => digest !== null), false);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("G2 full-route CLI rejects a self-consistent expected-tuples cross-register digest mismatch before collection", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-provenance-mismatch-"));
  const registerRoot = join(temporaryDirectory, "canonical-root");
  const outputPath = join(temporaryDirectory, "g2-full-route.jsonl");
  const expectedTuplesPath = join(registerRoot, CANONICAL_PATHS.expectedTuples);
  const inputTapePath = join(registerRoot, CANONICAL_PATHS.inputTapeRegister);
  const mismatchedDigest = `sha256:${"0".repeat(64)}`;

  try {
    await copyCanonicalRegisters(registerRoot);
    const expectedTuples = JSON.parse(await readFile(expectedTuplesPath, "utf8"));
    const inputTapeRegister = JSON.parse(await readFile(inputTapePath, "utf8"));
    expectedTuples.cross_register_references.input_tape_register.digest = mismatchedDigest;
    expectedTuples.canonical_payload_sha256 = payloadDigestFor(expectedTuples);
    await writeFile(expectedTuplesPath, `${JSON.stringify(expectedTuples, null, 2)}\n`, "utf8");

    const result = runCli(registerRoot, outputPath);

    assert.equal(result.status, 1, "a self-consistent cross-register mismatch must stop collection");
    const records = parseJsonl(await readFile(outputPath, "utf8"));
    const [manifest, ...remaining] = records;
    const summary = remaining.at(-1);
    const stopped = remaining.slice(0, -1);
    const provenanceStop = stopped.find(({ failure_code: code }) => code === "FAIL_REGISTER_PROVENANCE_MISMATCH");

    assert.equal(records[0].record_type, "manifest");
    assert.equal(summary.record_type, "summary");
    assert.ok(stopped.every(({ record_type: recordType }) => recordType === "run_stopped"));
    assert.equal(expectedTuples.canonical_payload_sha256, payloadDigestFor(expectedTuples),
      "the mutated expected-tuples register must retain a valid canonical self-digest");
    assert.equal(manifest.source_hashes[CANONICAL_PATHS.expectedTuples], payloadDigestFor(expectedTuples));
    assert.ok(provenanceStop, "the cross-register mismatch must be surfaced as a stopped run");
    assert.deepEqual(provenanceStop.rejected_provenance, {
      register: "inputTapeRegister",
      expected_path: CANONICAL_PATHS.inputTapeRegister,
      actual_path: CANONICAL_PATHS.inputTapeRegister,
      expected_digest: mismatchedDigest,
      actual_digest: payloadDigestFor(inputTapeRegister),
      field: null,
      message: null,
    });

    for (const [index, record] of records.entries()) {
      assert.equal(record.sequence, index, "records must remain append-only and contiguous");
      assert.equal(record.record_checksum, checksumFor(record), `${record.record_type} checksum must match canonical JSON`);
      assert.equal(record.candidate_tuple_digest, null, "provenance failure must block candidate admission");
      assert.equal(record.measurement_status, "INCOMPLETE");
      assert.equal(record.gate_verdict, "NOT_PASSED");
    }

    assert.equal(summary.collection_started, false);
    assert.equal(summary.started_run_count, 0);
    assert.equal(summary.terminal_run_count, 0);
    assert.equal(summary.stopped_run_count, stopped.length);
    assert.equal(summary.invalid_run_count, stopped.length);
    assert.equal(records.some(({ record_type: type }) => type === "run_started" || type === "run_terminal"), false);
    assert.equal(records.some(({ outcome }) => outcome === "VICTORY" || outcome === "LOSS"), false);
    assert.equal(records.some((record) => "metrics" in record || "route_win_rate" in record || "ttk" in record), false);
    assert.equal(records.some(({ gate_verdict: verdict }) => verdict === "PASSED"), false);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("G2 full-route CLI rejects every unsigned or incomplete admission boundary before candidate selection", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-admission-boundary-"));
  const campaignPaths = [...Object.values(CANONICAL_PATHS), ...SOURCE_CONTRACT_PATHS];
  const cases = [
    {
      name: "malformed unsigned admission",
      failureCode: "FAIL_ADMISSION_MANIFEST_INVALID",
      prepare: async (registerRoot) => {
        const manifest = await makeTestOnlyAdmission(registerRoot);
        manifest.authorization = "UNSIGNED_G2_FULL_ROUTE_COLLECTION";
        manifest.signature = null;
        manifest.role_attestations = [];
        return manifest;
      },
    },
    {
      name: "stale expected-register digest",
      failureCode: "FAIL_ADMISSION_MANIFEST_INVALID",
      failureField: "canonical_register_digests.g2-expected-tuples-v1.json",
      prepare: async (registerRoot) => {
        const manifest = await makeTestOnlyAdmission(registerRoot);
        manifest.canonical_register_digests["g2-expected-tuples-v1.json"] = `sha256:${"0".repeat(64)}`;
        return manifest;
      },
    },
    {
      name: "stale source-contract digest",
      failureCode: "FAIL_ADMISSION_MANIFEST_INVALID",
      failureField: "canonical_register_digests.design/g2-assessment-units-v1.json",
      prepare: async (registerRoot) => {
        const manifest = await makeTestOnlyAdmission(registerRoot);
        manifest.canonical_register_digests["design/g2-assessment-units-v1.json"] = `sha256:${"1".repeat(64)}`;
        return manifest;
      },
    },
    {
      name: "missing terminal ceiling",
      failureCode: "FAIL_TERMINAL_CEILING_UNBOUND",
      prepare: async (registerRoot) => {
        const manifest = await makeTestOnlyAdmission(registerRoot);
        const expected = JSON.parse(await readFile(join(registerRoot, CANONICAL_PATHS.expectedTuples), "utf8"));
        const conditionId = expected.source_contract_bindings.assessment_unit_bindings[0].assessment_condition_id;
        assert.ok(conditionId, "fixture must bind a canonical assessment condition");
        delete manifest.terminal_tick_ceilings[conditionId];
        return manifest;
      },
    },
    {
      name: "bad plan terminal mapping",
      failureCode: "FAIL_PLAN_TERMINAL_MAPPING_MISMATCH",
      prepare: async (registerRoot) => {
        const expectedPath = join(registerRoot, CANONICAL_PATHS.expectedTuples);
        const expected = JSON.parse(await readFile(expectedPath, "utf8"));
        expected.source_contract_bindings.assessment_unit_bindings[0].stage_id = "noncanonical-test-stage";
        await writeJsonDocument(expectedPath, expected);
        return makeTestOnlyAdmission(registerRoot);
      },
    },
    {
      name: "noncanonical tape mapping",
      failureCode: "FAIL_INPUT_TAPE_BINDING_MISMATCH",
      prepare: async (registerRoot) => {
        const expectedPath = join(registerRoot, CANONICAL_PATHS.expectedTuples);
        const inputTapePath = join(registerRoot, CANONICAL_PATHS.inputTapeRegister);
        const [expected, inputTape] = await Promise.all([
          readFile(expectedPath, "utf8").then(JSON.parse),
          readFile(inputTapePath, "utf8").then(JSON.parse),
        ]);
        const m6Binding = expected.source_contract_bindings.input_policy_bindings
          .find(({ expected_tuple_input_policy_id: policyId }) => Object.values(expected.expected_tuples).flat()
            .some((tuple) => tuple.matrix_id === "M6" && tuple.input_policy_id === policyId));
        assert.ok(m6Binding, "fixture must bind a finite M6 tape");
        const tape = inputTape.input_tapes.find(({ input_tape_id: tapeId }) => tapeId === m6Binding.input_tape_id);
        assert.ok(tape?.events.length, "fixture must expose a finite canonical tape");
        tape.events[0].action = "unsupported-test-action";
        await writeJsonDocument(inputTapePath, inputTape);
        expected.cross_register_references.input_tape_register.digest = payloadDigestFor(inputTape);
        await writeJsonDocument(expectedPath, expected);
        return makeTestOnlyAdmission(registerRoot);
      },
    },
    {
      name: "absent role record",
      failureCode: "FAIL_ADMISSION_MANIFEST_INVALID",
      failureField: "role_attestations.game-pm",
      prepare: async (registerRoot) => {
        const manifest = await makeTestOnlyAdmission(registerRoot);
        manifest.role_attestations = manifest.role_attestations.filter(({ role }) => role !== "game-pm");
        return manifest;
      },
    },
  ];

  try {
    const campaignBefore = await Promise.all(campaignPaths.map((path) => readFile(join(canonicalSourceRoot, path), "utf8")));

    for (const [index, fixture] of cases.entries()) {
      const registerRoot = join(temporaryDirectory, `fixture-${index}`);
      const outputPath = join(temporaryDirectory, `fixture-${index}.jsonl`);
      const admissionPath = join(registerRoot, "qa", "test-only-unsigned-admission.json");
      await copyCanonicalRegisters(registerRoot);
      const manifest = await fixture.prepare(registerRoot);
      await writeFile(admissionPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

      const result = runCli(registerRoot, outputPath, ["--admission-manifest", admissionPath]);

      assert.equal(result.status, 1, `${fixture.name} must fail before candidate selection`);
      const records = parseJsonl(await readFile(outputPath, "utf8"));
      const stopped = records.filter(({ record_type: recordType }) => recordType === "run_stopped");
      const summary = records.at(-1);
      const retainedFailure = stopped.find(({ failure_code: code }) => code === fixture.failureCode);

      assert.equal(records[0].record_type, "manifest");
      assert.equal(summary.record_type, "summary");
      assert.ok(retainedFailure, `${fixture.name} must retain its first observable failure code`);
      if (fixture.failureField) assert.ok(stopped.some(({ rejected_provenance: provenance }) => provenance.field === fixture.failureField),
        `${fixture.name} must retain its specific invalid admission field`);
      assert.equal(summary.first_falsifier_sequence, stopped[0].sequence);
      assert.equal(summary.collection_started, false);
      assert.equal(summary.started_run_count, 0);
      assert.equal(summary.terminal_run_count, 0);
      assert.equal(records.some(({ candidate_tuple_digest: digest }) => digest !== null), false);
      assert.equal(records.some(({ record_type: recordType }) => recordType === "run_started" || recordType === "run_terminal"), false);
      assert.equal(records.some(({ outcome }) => outcome === "VICTORY" || outcome === "LOSS"), false);
      assert.equal(records.some((record) => "metrics" in record || "route_win_rate" in record || "ttk" in record), false);
    }

    const campaignAfter = await Promise.all(campaignPaths.map((path) => readFile(join(canonicalSourceRoot, path), "utf8")));
    assert.deepEqual(campaignAfter, campaignBefore, "temporary fixtures must not mutate campaign register or contract sources");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("temporary Ed25519 admissions reject tampering, expiry, untrusted keys, and duplicate roles before collection", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-ed25519-rejections-"));
  const cases = [
    {
      name: "canonical payload mutation",
      field: "authorization",
      mutate: (manifest) => { manifest.authorization = "MUTATED_COLLECTION_AUTHORIZATION"; },
    },
    {
      name: "expired admission",
      field: "expires_at",
      mutate: (manifest) => { manifest.expires_at = "2000-01-01T00:00:00.000Z"; },
    },
    {
      name: "unknown trusted-role key",
      field: "role_attestations.game-pm",
      mutate: (manifest) => {
        manifest.role_attestations.find(({ role }) => role === "game-pm").signature.key_id = "test-only-unknown-key";
      },
    },
    {
      name: "duplicate role",
      field: "role_attestations.game-pm",
      mutate: (manifest) => {
        manifest.role_attestations.push(structuredClone(manifest.role_attestations.find(({ role }) => role === "game-pm")));
      },
    },
  ];

  try {
    for (const [index, fixture] of cases.entries()) {
      const registerRoot = join(temporaryDirectory, `fixture-${index}`);
      const outputPath = join(temporaryDirectory, `fixture-${index}.jsonl`);
      const admissionPath = join(registerRoot, "qa", "test-only-ed25519-admission.json");
      const { manifest } = await prepareReducedCollectionFixture(registerRoot, `test-only-invalid-nonce-${index}`);
      fixture.mutate(manifest);
      await writeFile(admissionPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

      const process = runCli(registerRoot, outputPath, ["--admission-manifest", admissionPath]);
      const records = parseJsonl(await readFile(outputPath, "utf8"));
      const summary = records.at(-1);
      const stopped = records.filter(({ record_type: type }) => type === "run_stopped");

      assert.equal(process.status, 1, `${fixture.name} must fail closed`);
      assert.ok(stopped.some(({ rejected_provenance: provenance }) => provenance.field === fixture.field),
        `${fixture.name} must retain its specific trusted-admission falsifier`);
      assert.equal(summary.collection_started, false);
      assert.equal(summary.started_run_count, 0);
      assert.equal(records.some(({ record_type: type }) => type === "run_started"), false);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
test("M6 comparator retains zero-denominator and median dispositions without collection manifests", async () => {
  const { appendM6ComparatorRecords, cleanup } = await loadM6ComparatorTestHook();
  const comparator = { comparator_contract: { ratio_policy: { maximum_inclusive_ratio: 2 } } };
  const fingerprint = (id, damage) => ({
    runId: `test-m6-${id}`,
    candidateDigest: `sha256:${id.padEnd(64, "0")}`,
    tuple: { matrix_id: "M6" },
    m6: { valid: true, damage },
  });

  try {
    const zeroRecords = [];
    const zeroFailures = appendM6ComparatorRecords(zeroRecords, [fingerprint("a", 0), fingerprint("b", 0)], comparator);
    assert.equal(zeroFailures, 2);
    assert.ok(zeroRecords.every(({ comparator_median_final_damage: median, ratio, ratio_disposition: disposition, failure_code: code }) => median === null
      && ratio === null && disposition === "NOT_OBSERVED" && code === "NOT_OBSERVED_ZERO_DENOMINATOR"));

    const medianRecords = [];
    const medianFailures = appendM6ComparatorRecords(medianRecords,
      [fingerprint("c", 6), fingerprint("d", 9), fingerprint("e", 12)], comparator);
    assert.equal(medianFailures, 0);
    assert.ok(medianRecords.every(({ comparator_member_count: count, comparator_median_final_damage: median, ratio, ratio_disposition: disposition, failure_code: code }) => count === 2
      && Number.isFinite(median) && median > 0 && Number.isFinite(ratio) && ratio > 0
      && disposition === "MEASURED_WITHIN_BOUND_PENDING_INDEPENDENT_REVIEW" && code === null));
  } finally {
    await cleanup();
  }
});


test("isolated Ed25519 admission fixture exercises the reduced G2 runtime collection route", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-full-route-cryptographic-"));
  const registerRoot = join(temporaryDirectory, "fixture");
  const admissionPath = join(registerRoot, "qa", "test-only-ed25519-admission.json");

  try {
    const { expected, manifest } = await prepareReducedCollectionFixture(registerRoot, "test-only-valid-nonce");
    await writeFile(admissionPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const result = await runG2FullRoute({ registerRoot, admissionManifest: admissionPath });
    const summary = result.records.at(-1);
    const started = result.records.filter(({ record_type: type }) => type === "run_started");
    const inputDispositions = result.records.filter(({ record_type: type }) => type === "input_disposition");
    const m4Queue = result.records.filter(({ record_type: type, run_id: runId, overlay }) => type === "input_queued"
      && runId.includes("M4~") && overlay === "M4_DECLINE_THEN_SELECT");
    const observerConfigurations = result.records.filter(({ record_type: type }) => type === "observer_checkpoint")
      .map(({ observer_configuration: configuration }) => configuration);
    const expectedObserverConfigurations = Object.values(expected.expected_tuples).flat()
      .filter(({ matrix_id: matrix }) => ["M2", "M3", "M4"].includes(matrix))
      .map(({ observer_cell_id: id, harness_cadence_hz: cadence }) => {
        const cell = expected.finite_dimensions.observer_cells.find(({ observer_cell_id: cellId }) => cellId === id);
        return {
          observer_cell_id: id,
          observer_implementation_id: cell.observer_implementation_id,
          observer_build_hash: cell.observer_build_hash,
          presentation_mode: cell.presentation_mode,
          harness_cadence_hz: cadence,
        };
      });

    assert.equal(summary.expected_tuple_count, 6);
    assert.equal(summary.collection_started, true, "valid temporary signatures must admit the collection path");
    assert.equal(result.failed, true, "an incomplete reduced capture remains failed and never passes G2");
    assert.equal(summary.gate_verdict, "NOT_PASSED");
    assert.ok(started.length > 0);
    for (const { run_id: runId } of started) {
      assert.ok(result.records.some(({ record_type: type, run_id: checkpointRunId, checkpoint_reason: reason, checkpoint_tick: tick }) => type === "checkpoint"
        && checkpointRunId === runId && reason === "tick-0" && tick === 0), `${runId} must retain tick-0`);
    }
    assert.ok(inputDispositions.length > 0);
    assert.ok(inputDispositions.every(({ public_input_type: type, accepted }) => typeof type === "string" && typeof accepted === "boolean"),
      "input dispositions must record actual public input outcomes");
    assert.deepEqual(m4Queue.map(({ tape_sim_tick: tick, normalized_input: input }) => ({ tick, input })), [
      { tick: 0, input: { decision: "DECLINE", cardId: m4Queue[0].normalized_input.cardId } },
      { tick: 1, input: { decision: "SELECT", cardId: m4Queue[1].normalized_input.cardId } },
    ]);
    assert.deepEqual([...new Set(observerConfigurations.map(canonicalStringify))].sort(),
      [...new Set(expectedObserverConfigurations.map(canonicalStringify))].sort(),
      "every declared M2/M3/M4 observer and cadence must emit checkpoints");
    const m6Linkage = result.records.filter(({ record_type: type }) => type === "m6_linkage");
    assert.equal(m6Linkage.length, 2);
    assert.ok(m6Linkage.every(({ failure_code: code, linked_final_damage: damage }) => code === "FAIL_M6_COMPARATOR_MAPPING_MISMATCH" && damage === null),
      "unlinked M6 terminal evidence must stay explicitly failed");

    const replay = await runG2FullRoute({ registerRoot, admissionManifest: admissionPath });
    assert.equal(replay.records.at(-1).collection_started, false);
    assert.ok(replay.records.some(({ rejected_provenance: provenance }) => provenance?.field === "admission_nonce"),
      "replayed temporary admission nonce must be rejected before collection");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
