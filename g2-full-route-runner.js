import { createHash, verify as verifySignature } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TICK_RATE,
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "./defense-run-simulation.js";

export const RUNNER_SCHEMA_VERSION = "g2-full-route-runner-v1";
export const REPLAY_PROTOCOL_VERSION = "g2-full-route-replay-v1";
export const CANONICAL_SERIALIZER_VERSION = "g2-canonical-json-sha256-v1";
export const MEASUREMENT_STATUS = "INCOMPLETE";
export const GATE_VERDICT = "NOT_PASSED";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const CANONICAL_PATHS = Object.freeze({
  seedRegister: "qa/g2-full-route-seed-register-v1.json",
  inputTapeRegister: "qa/g2-input-tape-register-v1.json",
  expectedTuples: "g2-expected-tuples-v1.json",
});
const SOURCE_PATHS = Object.freeze({
  assessmentUnits: "design/g2-assessment-units-v1.json",
  comboComparator: "pm/g2-combo-comparator-register-v1.json",
  ttkCohorts: "design/g2-ttk-cohort-register-v1.json",
});
const RUNTIME_SOURCE_PATHS = Object.freeze({
  "defense-catalog.js": resolve(MODULE_DIRECTORY, "defense-catalog.js"),
  "defense-run-simulation.js": resolve(MODULE_DIRECTORY, "defense-run-simulation.js"),
  "g2-full-route-runner.js": fileURLToPath(import.meta.url),
});
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const REQUIRED_ADMISSION_ROLES = Object.freeze([
  "game-designer",
  "game-qa",
  "game-programmer",
  "game-pm",
  "game-production-director",
]);
const REQUIRED_ADMISSION_STATUS = "SIGNED_COLLECTION_ADMISSION";

const usedAdmissionNonces = new Set();

export function canonicalStringify(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not permit non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalStringify(entry)).join(",")}]`;
  if (typeof value !== "object" || Object.prototype.toString.call(value) !== "[object Object]") {
    throw new TypeError("Canonical JSON requires JSON values only");
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function checksumRecord(record) {
  const { record_checksum: _ignored, ...unsignedRecord } = record;
  return sha256(canonicalStringify(unsignedRecord));
}

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isSha256(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function pathEscapesRoot(root, candidate) {
  const relation = relative(root, candidate);
  return relation === "" || relation === ".." || relation.startsWith(`..${String.fromCharCode(47)}`);
}

function admitPathWithinRoot(root, candidate, details) {
  let admittedPath;
  try {
    admittedPath = realpathSync(candidate);
  } catch {
    throw fail("FAIL_REGISTER_PATH_INVALID", "Canonical register path could not be resolved", details);
  }
  if (pathEscapesRoot(root, admittedPath)) {
    throw fail("FAIL_REGISTER_PATH_INVALID", "Canonical register path escapes real register root", details);
  }
  return admittedPath;
}

function canonicalPathFor(registerRoot, canonicalRelativePath) {
  const candidate = resolve(registerRoot, canonicalRelativePath);
  if (pathEscapesRoot(registerRoot, candidate)) {
    throw fail("FAIL_REGISTER_PATH_INVALID", "Canonical register path escapes register root", { canonical_relative_path: canonicalRelativePath });
  }
  return admitPathWithinRoot(registerRoot, candidate, { canonical_relative_path: canonicalRelativePath, candidate_path: candidate });
}

function requireExactPath(optionName, suppliedPath, canonicalPath, registerRoot) {
  if (suppliedPath === undefined) return canonicalPath;
  const lexicalPath = resolve(suppliedPath);
  const admittedPath = admitPathWithinRoot(registerRoot, lexicalPath, { option: optionName, candidate_path: lexicalPath });
  if (admittedPath !== canonicalPath) {
    throw fail("FAIL_REGISTER_PATH_NONCANONICAL", `${optionName} must name its canonical path`, {
      option: optionName,
      expected_path: canonicalPath,
      actual_path: admittedPath,
    });
  }
  return admittedPath;
}

export function resolveCanonicalRegisterPaths({ registerRoot, seedRegister, inputTapeRegister, expectedTuples }) {
  if (!isNonEmptyString(registerRoot)) throw fail("FAIL_REGISTER_ROOT_REQUIRED", "--register-root is required");
  let root;
  try {
    root = realpathSync(resolve(registerRoot));
  } catch {
    throw fail("FAIL_REGISTER_ROOT_INVALID", "--register-root must resolve to an existing directory");
  }
  const canonical = Object.fromEntries(Object.entries(CANONICAL_PATHS).map(([name, relativePath]) => [name, canonicalPathFor(root, relativePath)]));
  return {
    registerRoot: root,
    seedRegister: requireExactPath("--seed-register", seedRegister, canonical.seedRegister, root),
    inputTapeRegister: requireExactPath("--input-tape-register", inputTapeRegister, canonical.inputTapeRegister, root),
    expectedTuples: requireExactPath("--expected-tuples", expectedTuples, canonical.expectedTuples, root),
    canonical,
  };
}

function withoutSelfDigest(value) {
  const { canonical_payload_sha256: _ignored, ...payload } = value;
  return payload;
}

function schemaIssue(registerName, field, message) {
  return { failure_code: "FAIL_REGISTER_SCHEMA_INVALID", register: registerName, field, message };
}

function validateCommonRegister(registerName, document, expectedSchemaVersion, expectedRegisterId) {
  const issues = [];
  if (!isPlainObject(document)) return [schemaIssue(registerName, "", "register root must be a JSON object")];
  if (document.schema_version !== expectedSchemaVersion) issues.push(schemaIssue(registerName, "schema_version", `expected ${expectedSchemaVersion}`));
  if (document.register_id !== expectedRegisterId) issues.push(schemaIssue(registerName, "register_id", `expected ${expectedRegisterId}`));
  if (!isSha256(document.canonical_payload_sha256)) issues.push(schemaIssue(registerName, "canonical_payload_sha256", "must be sha256:<64 lowercase hex characters>"));
  const serialization = document.canonical_serialization;
  if (!isPlainObject(serialization)
    || serialization.checksum_scope !== "all top-level fields except canonical_payload_sha256"
    || serialization.encoding !== "UTF-8"
    || serialization.object_key_order !== "lexicographic"
    || !Array.isArray(serialization.separators)
    || serialization.separators.length !== 2
    || serialization.separators[0] !== ","
    || serialization.separators[1] !== ":") {
    issues.push(schemaIssue(registerName, "canonical_serialization", "must declare canonical UTF-8 lexicographic serialization"));
  }
  return issues;
}

function validateSeedRegister(document) {
  const issues = validateCommonRegister("seed_register", document, "g2-full-route-seed-register-v1", "g2-full-route-seed-register-v1");
  const seeds = document?.full_route_seed_set?.seed_ids;
  if (!Array.isArray(seeds) || seeds.length === 0 || seeds.some((seed) => !Number.isInteger(seed))) {
    issues.push(schemaIssue("seed_register", "full_route_seed_set.seed_ids", "must be a non-empty integer array"));
  }
  if (!Array.isArray(document?.critical_distribution_seed_set?.seed_ids) || document.critical_distribution_seed_set.seed_ids.some((seed) => !Number.isInteger(seed))) {
    issues.push(schemaIssue("seed_register", "critical_distribution_seed_set.seed_ids", "must be an integer array"));
  }
  if (!Array.isArray(document?.profiles) || document.profiles.length === 0 || document.profiles.some((profile) => !isPlainObject(profile) || !isNonEmptyString(profile.profile_id))) {
    issues.push(schemaIssue("seed_register", "profiles", "must contain named profiles"));
  }
  return issues;
}

function validateInputTapeRegister(document) {
  const issues = validateCommonRegister("input_tape_register", document, "g2-input-tape-register-v1", "g2-input-tape-register-v1");
  const tapes = document?.input_tapes;
  if (!Array.isArray(tapes) || tapes.length === 0 || tapes.some((tape) => !isPlainObject(tape)
    || !isNonEmptyString(tape.input_tape_id) || !isNonEmptyString(tape.input_policy_id) || !Array.isArray(tape.events))) {
    issues.push(schemaIssue("input_tape_register", "input_tapes", "must contain named normalized input tapes"));
  }
  return issues;
}

function validateExpectedTuples(document) {
  const issues = validateCommonRegister("expected_tuples", document, "g2-expected-tuples-v1", "g2-expected-tuples-v1");
  if (!isPlainObject(document)) return issues;
  if (!isPlainObject(document.cross_register_references)) issues.push(schemaIssue("expected_tuples", "cross_register_references", "must be an object"));
  if (!isPlainObject(document.expected_tuples)) issues.push(schemaIssue("expected_tuples", "expected_tuples", "must be an object"));
  const rows = flattenExpectedTuples(document);
  const ids = new Set();
  for (const row of rows) {
    if (!isPlainObject(row) || !isNonEmptyString(row.expected_tuple_id) || !isNonEmptyString(row.matrix_id)) {
      issues.push(schemaIssue("expected_tuples", "expected_tuples", "every row needs expected_tuple_id and matrix_id"));
      continue;
    }
    if (ids.has(row.expected_tuple_id)) issues.push(schemaIssue("expected_tuples", "expected_tuples", `duplicate expected_tuple_id ${row.expected_tuple_id}`));
    ids.add(row.expected_tuple_id);
  }
  const declaredCounts = document.expected_row_counts;
  if (!isPlainObject(declaredCounts)) {
    issues.push(schemaIssue("expected_tuples", "expected_row_counts", "must declare the closed matrix cardinalities"));
  } else {
    const matrixToCountKey = {
      M1: "M1_full_route_outcomes",
      M2: "M2_observer_invariance",
      M3: "M3_cooldown_boundaries",
      M4: "M4_recovery_fallback",
      M5: "M5_ttk_cohorts",
      M6: "M6_combo_ev_admissible_rows",
      M7: "M7_critical_distribution_execution_cells",
    };
    for (const [matrixId, countKey] of Object.entries(matrixToCountKey)) {
      if (!Array.isArray(document.expected_tuples[matrixId]) || document.expected_tuples[matrixId].length !== declaredCounts[countKey]) {
        issues.push(schemaIssue("expected_tuples", `expected_row_counts.${countKey}`, `must equal the closed ${matrixId} tuple count`));
      }
    }
    if (rows.length !== declaredCounts.total_admissible_expected_tuple_ids) {
      issues.push(schemaIssue("expected_tuples", "expected_row_counts.total_admissible_expected_tuple_ids", "must equal the complete closed tuple count"));
    }
  }
  const dimensions = document.finite_dimensions;
  if (!isPlainObject(dimensions) || !Array.isArray(dimensions.observer_cells) || !Array.isArray(dimensions.harness_cadences_hz)
    || !Array.isArray(dimensions.recovery_cases) || dimensions.recovery_cases.length !== 4) {
    issues.push(schemaIssue("expected_tuples", "finite_dimensions", "must bind finite observer/cadence dimensions and four M4 recovery cases"));
  }
  return issues;
}

function registerDigestCheck(registerName, declaredPayloadDigest, actualPayloadDigest) {
  if (declaredPayloadDigest === null || actualPayloadDigest === null || actualPayloadDigest === declaredPayloadDigest) return null;
  return { failure_code: "FAIL_REGISTER_SELF_DIGEST_MISMATCH", register: registerName, expected_digest: declaredPayloadDigest, actual_digest: actualPayloadDigest };
}

async function loadRegister(registerName, path, validate) {
  try {
    const document = JSON.parse(await readFile(path, "utf8"));
    const declaredPayloadDigest = isPlainObject(document) && isSha256(document.canonical_payload_sha256) ? document.canonical_payload_sha256 : null;
    const actualPayloadDigest = isPlainObject(document) ? sha256(canonicalStringify(withoutSelfDigest(document))) : null;
    const schemaIssues = validate(document);
    return {
      register: registerName,
      path,
      document,
      schemaIssues,
      selfDigestIssue: registerDigestCheck(registerName, declaredPayloadDigest, actualPayloadDigest),
      declaredPayloadDigest,
      actualPayloadDigest,
    };
  } catch (error) {
    return {
      register: registerName,
      path,
      document: null,
      schemaIssues: [{ failure_code: "FAIL_REGISTER_PARSE", register: registerName, message: error instanceof SyntaxError ? "invalid JSON" : "register could not be read" }],
      selfDigestIssue: null,
      declaredPayloadDigest: null,
      actualPayloadDigest: null,
    };
  }
}

function flattenExpectedTuples(document) {
  if (!isPlainObject(document?.expected_tuples)) return [];
  return Object.keys(document.expected_tuples).sort().flatMap((matrixId) => Array.isArray(document.expected_tuples[matrixId]) ? document.expected_tuples[matrixId] : []);
}

function makeRecord(sequence, recordType, fields) {
  const record = {
    schema_version: RUNNER_SCHEMA_VERSION,
    record_type: recordType,
    run_id: "g2-collection-admission",
    candidate_tuple_digest: null,
    sequence,
    measurement_status: MEASUREMENT_STATUS,
    gate_verdict: GATE_VERDICT,
    ...fields,
  };
  record.record_checksum = checksumRecord(record);
  return record;
}

function toRelativePath(registerRoot, path) {
  return relative(registerRoot, path).split("\\").join("/");
}

function collectAdmissionFailures(paths, registers) {
  const failures = [];
  for (const register of Object.values(registers)) {
    failures.push(...register.schemaIssues);
    if (register.selfDigestIssue) failures.push(register.selfDigestIssue);
  }
  const crossReferences = registers.expectedTuples.document?.cross_register_references;
  const linkedRegisters = [
    ["input_tape_register", "inputTapeRegister", "qa/g2-input-tape-register-v1.json"],
    ["seed_register", "seedRegister", "qa/g2-full-route-seed-register-v1.json"],
  ];
  if (isPlainObject(crossReferences)) {
    for (const [referenceName, registerName, expectedPath] of linkedRegisters) {
      const reference = crossReferences[referenceName];
      const actualRegister = registers[registerName];
      const actualPath = toRelativePath(paths.registerRoot, actualRegister.path);
      if (!isPlainObject(reference) || !isSha256(reference.digest) || reference.path !== expectedPath) {
        failures.push({
          failure_code: "FAIL_REGISTER_PROVENANCE_MISSING",
          register: registerName,
          expected_path: expectedPath,
          actual_path: actualPath,
          expected_digest: isPlainObject(reference) ? reference.digest ?? null : null,
          actual_digest: actualRegister.actualPayloadDigest,
          missing_field: !isPlainObject(reference) ? `cross_register_references.${referenceName}` : !isSha256(reference.digest) ? `cross_register_references.${referenceName}.digest` : `cross_register_references.${referenceName}.path`,
        });
      } else if (reference.digest !== actualRegister.actualPayloadDigest || reference.path !== actualPath) {
        failures.push({ failure_code: "FAIL_REGISTER_PROVENANCE_MISMATCH", register: registerName, expected_path: reference.path, actual_path: actualPath, expected_digest: reference.digest, actual_digest: actualRegister.actualPayloadDigest });
      }
    }
  }
  return failures.sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right)));
}

function admissionStop(failure) {
  return {
    failure_code: failure.failure_code,
    register: failure.register ?? "collection",
    expected_path: failure.expected_path ?? null,
    actual_path: failure.actual_path ?? null,
    expected_digest: failure.expected_digest ?? null,
    actual_digest: failure.actual_digest ?? null,
    missing_field: failure.missing_field ?? failure.field ?? null,
    message: failure.message ?? null,
  };
}

function makeBlockedResult(paths, registers, expectedTuples, failures, collectionMode) {
  const sourceHashes = Object.fromEntries(Object.entries(registers)
    .map(([, register]) => [toRelativePath(paths.registerRoot, register.path), register.actualPayloadDigest])
    .sort(([left], [right]) => left.localeCompare(right)));
  const manifest = makeRecord(0, "manifest", {
    runner_schema_version: RUNNER_SCHEMA_VERSION,
    replay_protocol_version: REPLAY_PROTOCOL_VERSION,
    canonical_serializer_version: CANONICAL_SERIALIZER_VERSION,
    canonical_tuple_list_digest: registers.expectedTuples.document ? sha256(canonicalStringify(registers.expectedTuples.document.expected_tuples)) : null,
    expected_tuple_count: expectedTuples.length,
    canonical_register_paths: Object.fromEntries(Object.entries(paths.canonical).map(([name, path]) => [name, toRelativePath(paths.registerRoot, path)]).sort(([left], [right]) => left.localeCompare(right))),
    source_hashes: sourceHashes,
    command: "node scripts/run-g2-full-route.mjs --register-root <register-root> --output <output>",
    collection_mode: collectionMode,
  });
  const stopped = failures.map((failure, index) => makeRecord(index + 1, "run_stopped", {
    stop_code: failure.failure_code,
    failure_code: failure.failure_code,
    last_checkpoint: null,
    signed_terminal_tick_ceiling: null,
    first_missing_required_fact: failure.missing_field ?? null,
    rejected_provenance: {
      register: failure.register,
      expected_path: failure.expected_path ?? null,
      actual_path: failure.actual_path ?? null,
      expected_digest: failure.expected_digest ?? null,
      actual_digest: failure.actual_digest ?? null,
      field: failure.field ?? null,
      message: failure.message ?? null,
    },
  }));
  const summary = makeRecord(stopped.length + 1, "summary", {
    expected_tuple_count: expectedTuples.length,
    started_run_count: 0,
    terminal_run_count: 0,
    stopped_run_count: stopped.length,
    invalid_run_count: stopped.length,
    missing_run_count: expectedTuples.length,
    first_falsifier_sequence: stopped[0]?.sequence ?? null,
    failure_codes: stopped.map((record) => record.failure_code),
    collection_started: false,
  });
  return { records: [manifest, ...stopped, summary], failed: true };
}

function manifestFailure(field, message, details = {}) {
  return { failure_code: "FAIL_ADMISSION_MANIFEST_INVALID", register: "admission_manifest", field, message, ...details };
}

async function loadAdmissionManifest(paths, suppliedPath) {
  if (!isNonEmptyString(suppliedPath)) return { manifest: null, failure: null, path: null };
  let admittedPath;
  try {
    admittedPath = admitPathWithinRoot(paths.registerRoot, resolve(suppliedPath), { option: "--admission-manifest", candidate_path: resolve(suppliedPath) });
    const manifest = JSON.parse(await readFile(admittedPath, "utf8"));
    return { manifest, failure: null, path: admittedPath };
  } catch (error) {
    return {
      manifest: null,
      path: null,
      failure: manifestFailure("--admission-manifest", error instanceof SyntaxError ? "must be valid JSON" : "must resolve within register root"),
    };
  }
}

async function loadSourceContract(paths, name, expectedReference) {
  const relativePath = SOURCE_PATHS[name];
  const path = canonicalPathFor(paths.registerRoot, relativePath);
  try {
    const text = await readFile(path, "utf8");
    const document = JSON.parse(text);
    const digest = sha256(text);
    if (!isPlainObject(expectedReference) || expectedReference.path !== relativePath || expectedReference.digest_kind !== "file_sha256" || expectedReference.digest !== digest) {
      return { failure: { failure_code: "FAIL_SOURCE_CONTRACT_PROVENANCE_MISMATCH", register: name, expected_path: relativePath, actual_path: toRelativePath(paths.registerRoot, path), expected_digest: expectedReference?.digest ?? null, actual_digest: digest, missing_field: `cross_register_references.${name}` } };
    }
    return { name, path, document, digest, failure: null };
  } catch {
    return { failure: { failure_code: "FAIL_SOURCE_CONTRACT_UNAVAILABLE", register: name, expected_path: relativePath, actual_path: null, expected_digest: expectedReference?.digest ?? null, actual_digest: null, missing_field: `cross_register_references.${name}` } };
  }
}

function signedAdmissionPayload(manifest) {
  const { signature: _authorizationSignature, signed_payload_sha256: _payloadDigest, role_attestations: roleAttestations, ...payload } = manifest;
  return {
    ...payload,
    role_attestations: Array.isArray(roleAttestations)
      ? roleAttestations.map(({ signature: _roleSignature, ...attestation }) => attestation)
      : roleAttestations,
  };
}

function trustedAdmissionKey(trustRegistry, role, keyId) {
  return trustRegistry?.keys?.find((key) => key?.role === role
    && key?.key_id === keyId
    && key?.algorithm === "ed25519"
    && key?.status === "ACTIVE"
    && isNonEmptyString(key?.public_key_pem)) ?? null;
}

function verifyAdmissionSignature(signature, role, payloadDigest, trustRegistry) {
  if (!isPlainObject(signature) || signature.algorithm !== "ed25519"
    || !isNonEmptyString(signature.key_id) || !isNonEmptyString(signature.value)
    || signature.signed_payload_sha256 !== payloadDigest) return false;
  const key = trustedAdmissionKey(trustRegistry, role, signature.key_id);
  if (!key) return false;
  try {
    return verifySignature(null, Buffer.from(payloadDigest, "utf8"), key.public_key_pem, Buffer.from(signature.value, "base64"));
  } catch {
    return false;
  }
}

async function runtimeSourceDigests() {
  return Object.fromEntries(await Promise.all(Object.entries(RUNTIME_SOURCE_PATHS).map(async ([name, path]) => [name, sha256(await readFile(path, "utf8"))])));
}

function validateAdmissionManifest(manifest, expectedTuples, registers, sources, runtimeDigests) {
  const failures = [];
  if (!isPlainObject(manifest)) return [manifestFailure("root", "must be an object")];
  const trustRegistry = registers.expectedTuples.document?.admission_trust_registry;
  const signedPayloadDigest = sha256(canonicalStringify(signedAdmissionPayload(manifest)));
  if (!isPlainObject(trustRegistry) || trustRegistry.registry_id !== "g2-local-admission-trust-registry-v1"
    || trustRegistry.algorithm !== "ed25519" || !Array.isArray(trustRegistry.keys)) {
    failures.push(manifestFailure("admission_trust_registry", "requires the canonical local ed25519 key/role registry"));
  }
  if (manifest.schema_version !== "g2-collection-admission-manifest-v1") failures.push(manifestFailure("schema_version", "expected g2-collection-admission-manifest-v1"));
  if (!isNonEmptyString(manifest.manifest_id)) failures.push(manifestFailure("manifest_id", "must be a non-empty string"));
  if (!isNonEmptyString(manifest.admission_nonce)) failures.push(manifestFailure("admission_nonce", "must be a non-empty one-use nonce"));
  if (!isNonEmptyString(manifest.expires_at) || !Number.isFinite(Date.parse(manifest.expires_at)) || Date.parse(manifest.expires_at) <= Date.now()) {
    failures.push(manifestFailure("expires_at", "must be a future ISO-8601 expiration"));
  }
  if (manifest.authorization !== "SIGNED_G2_FULL_ROUTE_COLLECTION") failures.push(manifestFailure("authorization", "must equal SIGNED_G2_FULL_ROUTE_COLLECTION"));
  if (manifest.signed_payload_sha256 !== signedPayloadDigest) failures.push(manifestFailure("signed_payload_sha256", "must equal the canonical authorization payload digest"));
  if (!verifyAdmissionSignature(manifest.signature, "collection-admission", signedPayloadDigest, trustRegistry)) {
    failures.push(manifestFailure("signature", "requires a valid trusted local ed25519 collection-admission signature"));
  }
  const roleRecords = Array.isArray(manifest.role_attestations) ? manifest.role_attestations : [];
  for (const role of REQUIRED_ADMISSION_ROLES) {
    const records = roleRecords.filter((record) => record?.role === role && record?.status === REQUIRED_ADMISSION_STATUS);
    if (records.length !== 1 || !verifyAdmissionSignature(records[0].signature, role, signedPayloadDigest, trustRegistry)) {
      failures.push(manifestFailure(`role_attestations.${role}`, "requires exactly one valid trusted local ed25519 role signature over the canonical payload digest"));
    }
  }
  const expectedDigest = registers.expectedTuples.actualPayloadDigest;
  const expectedTupleDigest = sha256(canonicalStringify(registers.expectedTuples.document?.expected_tuples));
  const closure = manifest.execution_closure;
  if (!isPlainObject(closure) || closure.expected_tuple_manifest_digest !== expectedTupleDigest || closure.expected_tuple_count !== expectedTuples.length
    || !Array.isArray(closure.admitted_tuple_ids)) {
    failures.push(manifestFailure("execution_closure", "must bind the exact canonical expected tuple digest, count, and ID list"));
  } else {
    const expectedIds = expectedTuples.map((row) => row.expected_tuple_id).sort();
    const admittedIds = [...closure.admitted_tuple_ids].sort();
    if (canonicalStringify(admittedIds) !== canonicalStringify(expectedIds)) failures.push(manifestFailure("execution_closure.admitted_tuple_ids", "must be the exact complete canonical expected tuple population"));
  }
  const registerDigests = manifest.canonical_register_digests;
  const expectedRegisterDigests = {
    "g2-expected-tuples-v1.json": expectedDigest,
    "qa/g2-full-route-seed-register-v1.json": registers.seedRegister.actualPayloadDigest,
    "qa/g2-input-tape-register-v1.json": registers.inputTapeRegister.actualPayloadDigest,
    "design/g2-assessment-units-v1.json": sources.assessmentUnits?.digest,
    "design/g2-ttk-cohort-register-v1.json": sources.ttkCohorts?.digest,
    "pm/g2-combo-comparator-register-v1.json": sources.comboComparator?.digest,
  };
  for (const [path, digest] of Object.entries(expectedRegisterDigests)) {
    if (!isSha256(digest) || !isPlainObject(registerDigests) || registerDigests[path] !== digest) {
      failures.push(manifestFailure(`canonical_register_digests.${path}`, "must equal the admitted canonical register digest", { expected_path: path, expected_digest: digest ?? null, actual_digest: registerDigests?.[path] ?? null }));
    }
  }
  const identity = manifest.runtime_identity;
  if (!isPlainObject(identity) || !isNonEmptyString(identity.rules_source_revision)) failures.push(manifestFailure("runtime_identity.rules_source_revision", "must be an immutable non-empty source revision"));
  if (!isPlainObject(identity?.source_hashes)) {
    failures.push(manifestFailure("runtime_identity.source_hashes", "must contain actual runtime source hashes"));
  } else {
    for (const [path, digest] of Object.entries(runtimeDigests)) {
      if (identity.source_hashes[path] !== digest) failures.push(manifestFailure(`runtime_identity.source_hashes.${path}`, "must equal the local immutable runtime source", { expected_path: path, expected_digest: digest, actual_digest: identity.source_hashes[path] ?? null }));
    }
  }
  if (identity?.rules_catalog_digest !== runtimeDigests["defense-catalog.js"]) failures.push(manifestFailure("runtime_identity.rules_catalog_digest", "must equal the local catalog source digest"));
  if (identity?.runner_build_hash !== runtimeDigests["g2-full-route-runner.js"]) failures.push(manifestFailure("runtime_identity.runner_build_hash", "must equal the local runner source digest"));
  if (identity?.canonical_serializer_build_hash !== runtimeDigests["g2-full-route-runner.js"]) failures.push(manifestFailure("runtime_identity.canonical_serializer_build_hash", "must equal the local runner source digest"));
  if (!isPlainObject(identity?.observer_implementation_hashes)) failures.push(manifestFailure("runtime_identity.observer_implementation_hashes", "must bind every observer implementation"));
  if (!failures.length && usedAdmissionNonces.has(manifest.admission_nonce)) failures.push(manifestFailure("admission_nonce", "replayed admission nonce is already consumed"));
  return failures.sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right)));
}

function conditionMap(assessmentUnits) {
  return new Map((assessmentUnits?.assessment_conditions || []).map((condition) => [condition.assessment_condition_id, condition]));
}

function tapeMap(inputTapeRegister) {
  return new Map((inputTapeRegister?.input_tapes || []).map((tape) => [tape.input_tape_id, tape]));
}

function materializeExpectedTuple(tuple, expectedDocument) {
  const contracts = expectedDocument?.source_contract_bindings;
  if (!isPlainObject(contracts)) throw fail("FAIL_SOURCE_CONTRACT_BINDING_MISSING", "Expected tuple register lacks source contract bindings");
  const inputBinding = (contracts.input_policy_bindings || []).find((entry) => entry.expected_tuple_input_policy_id === tuple.input_policy_id);
  if (["M1", "M2", "M3", "M4", "M5"].includes(tuple.matrix_id)) {
    const binding = (contracts.assessment_unit_bindings || []).find((entry) => entry.assessment_unit_id === tuple.assessment_unit_id);
    if (!binding || !inputBinding) throw fail("FAIL_SOURCE_CONTRACT_BINDING_MISSING", "Expected tuple lacks a finite source binding");
    return { ...tuple, ...binding, input_tape_id: inputBinding.input_tape_id, input_policy_id: inputBinding.canonical_input_policy_id, source_input_policy_id: tuple.input_policy_id };
  }
  if (tuple.matrix_id === "M6") {
    if (!inputBinding || !isNonEmptyString(tuple.input_tape_id)) throw fail("FAIL_SOURCE_CONTRACT_BINDING_MISSING", "M6 tuple lacks a canonical input tape binding");
    return { ...tuple, input_policy_id: inputBinding.canonical_input_policy_id, source_input_policy_id: tuple.input_policy_id };
  }
  if (tuple.matrix_id === "M7") {
    const binding = contracts.m7_runtime_binding;
    if (!isPlainObject(binding)) throw fail("FAIL_SOURCE_CONTRACT_BINDING_MISSING", "M7 runtime binding is absent");
    return {
      ...tuple,
      ...binding,
      measurement_profile_id: tuple.profile_id,
      profile_id: tuple.profile_id,
    };
  }
  return tuple;
}

function materializeExpectedTuples(expectedTuples, expectedDocument) {
  const materialized = [];
  const failures = [];
  for (const tuple of expectedTuples) {
    try {
      materialized.push(materializeExpectedTuple(tuple, expectedDocument));
    } catch (error) {
      failures.push({
        failure_code: error.code ?? "FAIL_SOURCE_CONTRACT_BINDING_MISSING",
        register: "expected_tuples",
        missing_field: tuple.expected_tuple_id ?? null,
        message: error.message,
      });
    }
  }
  return { materialized, failures };
}

function validateCanonicalTupleBindings(expectedTuples, registers, sources) {
  const failures = [];
  const conditions = conditionMap(sources.assessmentUnits.document);
  const tapes = tapeMap(registers.inputTapeRegister.document);
  const fullRouteSeeds = new Set(registers.seedRegister.document?.full_route_seed_set?.seed_ids || []);
  const criticalSeeds = new Set(registers.seedRegister.document?.critical_distribution_seed_set?.seed_ids || []);
  const comparator = sources.comboComparator.document;
  const m6Population = comparator?.finite_comparator_population;
  const m6Signature = comparator?.signature_registry?.entries?.[0];
  const ttkMappings = sources.ttkCohorts.document?.cohort_mappings || [];
  const ttkByCondition = new Map(ttkMappings.map((mapping) => [mapping.assessment_condition_id, mapping]));
  const dimensions = registers.expectedTuples.document?.finite_dimensions;
  const observerIds = new Set((dimensions?.observer_cells || []).map((cell) => cell.observer_cell_id));
  const cadences = new Set(dimensions?.harness_cadences_hz || []);
  for (const tuple of expectedTuples) {
    const matrix = tuple.matrix_id;
    if (!isNonEmptyString(tuple.expected_tuple_id)) {
      failures.push({ failure_code: "FAIL_EXPECTED_TUPLE_INVALID", register: "expected_tuples", missing_field: "expected_tuple_id" });
      continue;
    }
    if (["M1", "M2", "M3", "M4", "M5"].includes(matrix)) {
      const condition = conditions.get(tuple.assessment_condition_id);
      if (!condition || tuple.stage_id !== condition.stage_id || tuple.map_plan_id !== condition.map_plan_id || tuple.wave_plan_id !== condition.wave_plan_id
        || tuple.m4_plan_id !== condition.m4_plan_id || tuple.terminal_binding !== condition.terminal_binding) {
        failures.push({ failure_code: "FAIL_PLAN_TERMINAL_MAPPING_MISMATCH", register: "assessment_units", missing_field: tuple.expected_tuple_id });
      }
      if (!fullRouteSeeds.has(tuple.seed_id)) failures.push({ failure_code: "FAIL_SEED_BINDING_MISMATCH", register: "seed_register", missing_field: tuple.expected_tuple_id });
      if (!tapes.has(tuple.input_tape_id) || tuple.input_policy_id !== tapes.get(tuple.input_tape_id)?.input_policy_id) {
        failures.push({ failure_code: "FAIL_INPUT_TAPE_BINDING_MISMATCH", register: "input_tape_register", missing_field: tuple.expected_tuple_id });
      }
      if (["M2", "M3", "M4"].includes(matrix) && (!observerIds.has(tuple.observer_cell_id) || !cadences.has(tuple.harness_cadence_hz) || tuple.simulation_hz !== TICK_RATE)) {
        failures.push({ failure_code: "FAIL_OBSERVER_CONFIGURATION_MISMATCH", register: "expected_tuples", missing_field: tuple.expected_tuple_id });
      }
      if (matrix === "M5") {
        const mapping = ttkByCondition.get(tuple.assessment_condition_id);
        if (!mapping || mapping.stage_id !== tuple.stage_id || mapping.map_plan_id !== tuple.map_plan_id || mapping.wave_plan_id !== tuple.wave_plan_id
          || mapping.target_cohort_id !== tuple.target_cohort_id || mapping.pressure_band_id !== tuple.pressure_band_id
          || !isNonEmptyString(tuple.source_m1_expected_tuple_id)) {
          failures.push({ failure_code: "FAIL_TTK_COHORT_BINDING_MISMATCH", register: "ttk_cohorts", missing_field: tuple.expected_tuple_id });
        }
      }
    } else if (matrix === "M6") {
      if (!m6Population || !m6Signature || tuple.fixture_id !== m6Signature.fixture_id || tuple.signature_id !== m6Signature.signature_id
        || canonicalStringify(tuple.ordered_ability_ids) !== canonicalStringify(m6Signature.ordered_ability_ids)
        || tuple.assessment_condition_id !== m6Signature.assessment_condition_id || tuple.target_cohort_id !== m6Signature.target_cohort_id
        || tuple.pressure_band_id !== m6Signature.pressure_band_id
        || !m6Population.seed_ids?.includes(tuple.seed_id) || !m6Population.crit_or_deck_position_ids?.includes(tuple.crit_or_deck_position_id)
        || tuple.source_input_policy_id !== m6Population.input_policy_id || tuple.stage_id !== m6Signature.stage_id || tuple.map_plan_id !== m6Signature.map_plan_id
        || tuple.wave_plan_id !== m6Signature.wave_plan_id || tuple.m4_plan_id !== m6Signature.m4_plan_id) {
        failures.push({ failure_code: "FAIL_M6_COMPARATOR_MAPPING_MISMATCH", register: "combo_comparator", missing_field: tuple.expected_tuple_id });
      }
      if (!tapes.has(tuple.input_tape_id) || tuple.input_policy_id !== tapes.get(tuple.input_tape_id)?.input_policy_id) {
        failures.push({ failure_code: "FAIL_INPUT_TAPE_BINDING_MISMATCH", register: "input_tape_register", missing_field: tuple.expected_tuple_id });
      }
    } else if (matrix === "M7") {
      if (!criticalSeeds.has(tuple.seed_id) || !isNonEmptyString(tuple.measurement_profile_id) || !isNonEmptyString(tuple.stage_id)
        || !isNonEmptyString(tuple.map_plan_id) || !isNonEmptyString(tuple.wave_plan_id) || !isNonEmptyString(tuple.m4_plan_id)) {
        failures.push({ failure_code: "FAIL_M7_SOURCE_BINDING_MISMATCH", register: "seed_register", missing_field: tuple.expected_tuple_id });
      }
    } else {
      failures.push({ failure_code: "FAIL_EXPECTED_TUPLE_INVALID", register: "expected_tuples", missing_field: tuple.expected_tuple_id });
    }
  }
  return failures.sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right)));
}

function validateExecutionPreflight(expectedTuples, manifest, inputTapeRegister, expectedDocument) {
  const failures = [];
  const tapes = tapeMap(inputTapeRegister);
  const schedule = expectedDocument?.source_contract_bindings?.required_checkpoint_schedule;
  if (!isPlainObject(schedule) || !isNonEmptyString(schedule.schedule_id) || !Array.isArray(schedule.required_ticks)
    || !schedule.required_ticks.includes(0) || !Number.isInteger(schedule.periodic_interval_ticks) || schedule.periodic_interval_ticks <= 0) {
    failures.push({ failure_code: "FAIL_CHECKPOINT_SCHEDULE_UNBOUND", register: "expected_tuples", missing_field: "source_contract_bindings.required_checkpoint_schedule" });
  }
  for (const tuple of expectedTuples) {
    if (!tupleTerminalCeiling(manifest, tuple)) {
      failures.push({
        failure_code: "FAIL_TERMINAL_CEILING_UNBOUND",
        register: "admission_manifest",
        missing_field: tuple.expected_tuple_id,
      });
    }
    if (!tuple.input_tape_id) continue;
    try {
      normalizeCanonicalTape(tapes.get(tuple.input_tape_id));
    } catch (error) {
      failures.push({
        failure_code: error.code ?? "FAIL_INPUT_TAPE_BINDING_MISMATCH",
        register: "input_tape_register",
        missing_field: tuple.expected_tuple_id,
        message: error.message,
      });
    }
  }
  return failures.sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right)));
}

function q15ToOctant(x, y) {
  if (x === 0 && y === 0) return "IDLE";
  const horizontal = Math.abs(x);
  const vertical = Math.abs(y);
  if (horizontal * 2 < vertical) return y < 0 ? "N" : "S";
  if (vertical * 2 < horizontal) return x < 0 ? "W" : "E";
  if (x >= 0 && y < 0) return "NE";
  if (x >= 0 && y >= 0) return "SE";
  if (x < 0 && y >= 0) return "SW";
  return "NW";
}

export function normalizeCanonicalTape(tape) {
  if (!isPlainObject(tape) || !Array.isArray(tape.events)) throw fail("FAIL_INPUT_TAPE_BINDING_MISMATCH", "Canonical tape must contain events");
  const events = [...tape.events].sort((left, right) => left.sim_tick - right.sim_tick || left.ordinal - right.ordinal);
  const normalized = [];
  let priorTick = -1;
  let priorOrdinal = -1;
  for (const event of events) {
    if (!Number.isInteger(event.sim_tick) || !Number.isInteger(event.ordinal) || event.sim_tick < 0 || event.ordinal < 0
      || event.sim_tick < priorTick || (event.sim_tick === priorTick && event.ordinal <= priorOrdinal)) {
      throw fail("FAIL_INPUT_TAPE_BINDING_MISMATCH", "Canonical tape ordering is invalid");
    }
    priorTick = event.sim_tick;
    priorOrdinal = event.ordinal;
    if (event.action === "move" && Number.isInteger(event.x_q15) && Number.isInteger(event.y_q15)
      && event.x_q15 >= -32768 && event.x_q15 <= 32767 && event.y_q15 >= -32768 && event.y_q15 <= 32767) {
      normalized.push({ ordinal: event.ordinal, tape_sim_tick: event.sim_tick, public_type: "MOVE", public_payload: { octant: q15ToOctant(event.x_q15, event.y_q15) } });
    } else if (event.action === "ability" && Number.isInteger(event.slot) && event.slot >= 1) {
      normalized.push({ ordinal: event.ordinal, tape_sim_tick: event.sim_tick, public_type: "SKILL_CAST", public_payload: { slot: event.slot } });
    } else if (event.action === "growth_offer_selection" && isNonEmptyString(event.skill_id)) {
      normalized.push({ ordinal: event.ordinal, tape_sim_tick: event.sim_tick, public_type: "GROWTH_OFFER_SELECTED", public_payload: { skillId: event.skill_id } });
    } else {
      throw fail("FAIL_INPUT_TAPE_BINDING_MISMATCH", "Canonical tape contains an unsupported action");
    }
  }
  return normalized;
}

function nextSequence(records) {
  return records.length;
}

function ruleEvents(records, runId, candidateDigest, snapshot) {
  for (const event of snapshot.events) {
    records.push(makeRecord(nextSequence(records), "rule_event", {
      run_id: runId,
      candidate_tuple_digest: candidateDigest,
      sim_tick: snapshot.tick,
      event_id: event.eventId ?? null,
      event_sequence: event.eventSequence ?? null,
      event: JSON.parse(JSON.stringify(event)),
    }));
    if (event.type === "INPUT_ACCEPTED" || event.type === "INPUT_REJECTED") {
      records.push(makeRecord(nextSequence(records), "input_disposition", {
        run_id: runId,
        candidate_tuple_digest: candidateDigest,
        sim_tick: snapshot.tick,
        input_id: event.inputId ?? null,
        public_input_type: event.inputType ?? null,
        accepted: event.type === "INPUT_ACCEPTED",
        rejection_reason: event.reason ?? null,
      }));
    }
  }
}

function checkpoint(records, runId, candidateDigest, snapshot, reason, inputCursor) {
  records.push(makeRecord(nextSequence(records), "checkpoint", {
    run_id: runId,
    candidate_tuple_digest: candidateDigest,
    checkpoint_reason: reason,
    checkpoint_tick: snapshot.tick,
    canonical_state_digest: sha256(canonicalStringify(snapshot)),
    run_digest: getRunDigestFromSnapshot(snapshot),
    plan: snapshot.plan,
    terminal: snapshot.terminal,
    input_cursor: inputCursor,
    resolved_event_id_digest: sha256(canonicalStringify(snapshot.events.map((event) => event.eventId ?? null))),
  }));
}

function getRunDigestFromSnapshot(snapshot) {
  return sha256(canonicalStringify(snapshot));
}

function publicSkillId(snapshot, slot) {
  const skill = snapshot.commander?.skills?.[slot - 1];
  return typeof skill === "string" ? skill : null;
}

function buildM3Overlay(tuple, inputTapeRegister) {
  if (tuple.matrix_id !== "M3") return [];
  const probe = (inputTapeRegister.cooldown_target_probe_population || []).find((entry) => entry.probe_id === tuple.cooldown_probe_id);
  if (!probe) throw fail("FAIL_INPUT_TAPE_BINDING_MISMATCH", "M3 tuple has no canonical cooldown probe");
  const targetTransitions = probe.target_case === "target-loss-reacquire"
    ? [
      { ordinal: `m3:${probe.probe_id}:loss`, tape_sim_tick: probe.target_loss_tick, public_type: "M3_TARGET_PROBE", public_payload: { phase: "LOSS", probeId: probe.probe_id }, overlay: "M3_TARGET_LOSS" },
      { ordinal: `m3:${probe.probe_id}:reacquire`, tape_sim_tick: probe.target_reacquire_tick, public_type: "M3_TARGET_PROBE", public_payload: { phase: "REACQUIRE", probeId: probe.probe_id }, overlay: "M3_TARGET_REACQUIRE" },
    ]
    : [];
  return [
    { ordinal: `m3:${probe.probe_id}:initial`, tape_sim_tick: probe.initial_cast_tick, public_type: "SKILL_CAST", public_payload: { slot: 1 }, overlay: "M3_INITIAL_CAST" },
    { ordinal: `m3:${probe.probe_id}:probe`, tape_sim_tick: probe.probe_tick, public_type: "SKILL_CAST", public_payload: { slot: 1 }, overlay: "M3_BOUNDARY_PROBE" },
    ...targetTransitions,
  ];
}

function buildM4Overlay(tuple) {
  if (tuple.matrix_id !== "M4") return [];
  if (tuple.recovery_case_id === "relief-v1") return [{ ordinal: "m4:relief", tape_sim_tick: 0, public_type: "M4_CARD_DECISION", public_payload: { decision: "SELECT", cardIndex: 0 }, overlay: "M4_RELIEF" }];
  if (tuple.recovery_case_id === "decline-then-select-v1") return [
    { ordinal: "m4:decline-select:0", tape_sim_tick: 0, public_type: "M4_CARD_DECISION", public_payload: { decision: "DECLINE", cardIndex: 0 }, overlay: "M4_DECLINE_THEN_SELECT" },
    { ordinal: "m4:decline-select:1", tape_sim_tick: 1, public_type: "M4_CARD_DECISION", public_payload: { decision: "SELECT", cardIndex: 1 }, overlay: "M4_DECLINE_THEN_SELECT" },
  ];
  if (tuple.recovery_case_id === "card-exhaustion-v1") return [
    { ordinal: "m4:exhaustion:0", tape_sim_tick: 0, public_type: "M4_CARD_DECISION", public_payload: { decision: "DECLINE", cardIndex: 0 }, overlay: "M4_CARD_EXHAUSTION" },
    { ordinal: "m4:exhaustion:1", tape_sim_tick: 1, public_type: "M4_CARD_DECISION", public_payload: { decision: "DECLINE", cardIndex: 1 }, overlay: "M4_CARD_EXHAUSTION" },
  ];
  if (tuple.recovery_case_id === "invalid-card-v1") return [{ ordinal: "m4:invalid", tape_sim_tick: 0, public_type: "M4_CARD_DECISION", public_payload: { decision: "SELECT", cardId: "unregistered-card" }, overlay: "M4_INVALID_CARD" }];
  throw fail("FAIL_PLAN_TERMINAL_MAPPING_MISMATCH", "M4 tuple has an unregistered recovery case");
}

function buildM6Overlay(tuple) {
  if (tuple.matrix_id !== "M6") return [];
  return [
    { ordinal: "m6:ordered-skill:0", tape_sim_tick: 60, public_type: "SKILL_CAST", public_payload: { slot: 1 }, overlay: "M6_ORDERED_SKILL" },
    { ordinal: "m6:ordered-skill:1", tape_sim_tick: 61, public_type: "SKILL_CAST", public_payload: { slot: 2 }, overlay: "M6_ORDERED_SKILL" },
  ];
}

function normalizeOverlayPayload(action, snapshot) {
  if (action.public_type === "SKILL_CAST") {
    const skillId = publicSkillId(snapshot, action.public_payload.slot);
    return skillId ? { type: "SKILL_CAST", payload: { skillId } } : null;
  }
  if (action.public_type === "M4_CARD_DECISION") {
    const cardId = action.public_payload.cardId ?? snapshot.m4?.inventory?.[action.public_payload.cardIndex];
    return cardId ? { type: "M4_CARD_DECISION", payload: { decision: action.public_payload.decision, cardId } } : null;
  }
  return { type: action.public_type, payload: action.public_payload };
}

function observerConfiguration(tuple, expectedDocument) {
  const cell = expectedDocument?.finite_dimensions?.observer_cells?.find((entry) => entry.observer_cell_id === tuple.observer_cell_id);
  const cadence = tuple.harness_cadence_hz;
  if (!cell || !Number.isInteger(cadence) || ![30, 60, 120].includes(cadence)) return null;
  return {
    observer_cell_id: cell.observer_cell_id,
    observer_implementation_id: cell.observer_implementation_id,
    observer_build_hash: cell.observer_build_hash,
    presentation_mode: cell.presentation_mode,
    harness_cadence_hz: cadence,
  };
}

function observeCanonicalSnapshot(records, runId, candidateDigest, snapshot, observer, priorFrame) {
  if (!observer) return priorFrame;
  const frame = Math.floor(snapshot.tick * observer.harness_cadence_hz / TICK_RATE);
  if (frame === priorFrame) return priorFrame;
  records.push(makeRecord(nextSequence(records), "observer_checkpoint", {
    run_id: runId,
    candidate_tuple_digest: candidateDigest,
    observer_configuration: observer,
    observer_frame: frame,
    sim_tick: snapshot.tick,
    canonical_state_digest: getRunDigestFromSnapshot(snapshot),
  }));
  return frame;
}

function tupleTerminalCeiling(manifest, tuple) {
  const ceiling = manifest.terminal_tick_ceilings?.[tuple.assessment_condition_id ?? tuple.matrix_id];
  return Number.isInteger(ceiling) && ceiling > 0 ? ceiling : null;
}

function m6LinkedDamage(records, tuple, comparator) {
  if (tuple.matrix_id !== "M6") return { valid: true, damage: null };
  const signature = comparator?.signature_registry?.entries?.find((entry) => entry.signature_id === tuple.signature_id);
  const required = signature?.ordered_ability_ids;
  const resolved = records
    .filter((record) => record.record_type === "rule_event" && record.event?.type === "SKILL_RESOLVED_DAMAGE")
    .map((record) => ({ event: record.event, tick: record.sim_tick }))
    .filter(({ event }) => required?.includes(event.skillId)
      && isNonEmptyString(event.eventId) && isNonEmptyString(event.castInstanceId) && isNonEmptyString(event.causalRootId)
      && isNonEmptyString(event.targetId) && isNonEmptyString(event.targetSpawnEventId) && Number.isFinite(event.finalDamage));
  const ordered = required?.map((skillId, index) => resolved.find(({ event, tick }) => event.skillId === skillId
    && (index === 0 || tick >= resolved.find(({ event: prior }) => prior.skillId === required[index - 1])?.tick))).filter(Boolean);
  if (!signature || !ordered || ordered.length !== required.length || ordered.at(-1).tick - ordered[0].tick > comparator.signature_definition.linked_event_interval_max_simulation_ticks) {
    return { valid: false, failure_code: "FAIL_M6_COMPARATOR_MAPPING_MISMATCH", missing_field: tuple.expected_tuple_id };
  }
  const damage = ordered.reduce((sum, entry) => sum + entry.event.finalDamage, 0);
  return Number.isFinite(damage) && damage > 0
    ? { valid: true, damage, first_event_id: ordered[0].event.eventId, last_event_id: ordered.at(-1).event.eventId, target_instance_id: ordered.at(-1).event.targetId }
    : { valid: false, failure_code: "NOT_OBSERVED_ZERO_DENOMINATOR", missing_field: tuple.expected_tuple_id };
}

function terminalMapping(assessmentUnits, outcome) {
  const mapping = (assessmentUnits.terminal_outcome_mapping || []).find((entry) => entry.mapped_outcome === outcome);
  return mapping?.mapped_outcome ?? null;
}

function tupleRunId(tuple) {
  return `g2:${tuple.expected_tuple_id}`;
}

function captureTuple(tuple, manifest, registers, sources) {
  const records = [];
  const runId = tupleRunId(tuple);
  const candidateDigest = sha256(canonicalStringify(tuple));
  const tape = tuple.input_tape_id ? tapeMap(registers.inputTapeRegister.document).get(tuple.input_tape_id) : null;
  const terminalTickCeiling = tupleTerminalCeiling(manifest, tuple);
  const observer = observerConfiguration(tuple, registers.expectedTuples.document);
  if (["M2", "M3", "M4"].includes(tuple.matrix_id) && !observer) {
    records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: "FAIL_OBSERVER_CONFIGURATION_MISMATCH", stop_code: "FAIL_OBSERVER_CONFIGURATION_MISMATCH", signed_terminal_tick_ceiling: terminalTickCeiling, last_checkpoint: null, first_missing_required_fact: tuple.expected_tuple_id }));
    return { records, completed: false, terminal: false, fingerprint: null };
  }
  if (!terminalTickCeiling) {
    records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: "FAIL_TERMINAL_CEILING_UNBOUND", stop_code: "FAIL_TERMINAL_CEILING_UNBOUND", signed_terminal_tick_ceiling: null, last_checkpoint: null, first_missing_required_fact: tuple.assessment_condition_id ?? tuple.matrix_id }));
    return { records, completed: false, terminal: false, fingerprint: null };
  }
  let normalized;
  try {
    normalized = tape ? normalizeCanonicalTape(tape) : [];
    normalized.push(...buildM3Overlay(tuple, registers.inputTapeRegister.document), ...buildM4Overlay(tuple), ...buildM6Overlay(tuple));
    normalized.sort((left, right) => left.tape_sim_tick - right.tape_sim_tick || String(left.ordinal).localeCompare(String(right.ordinal)));
  } catch (error) {
    records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: error.code ?? "FAIL_INPUT_TAPE_BINDING_MISMATCH", stop_code: error.code ?? "FAIL_INPUT_TAPE_BINDING_MISMATCH", signed_terminal_tick_ceiling: terminalTickCeiling, last_checkpoint: null, first_missing_required_fact: error.message }));
    return { records, completed: false, terminal: false, fingerprint: null };
  }
  const measurementProfileId = tuple.measurement_profile_id ?? tuple.profile_id;
  let run;
  try {
    run = createDefenseRun({ stageId: tuple.stage_id, seed: tuple.seed_id, companionLoadout: [], rewardIds: [], measurementProfileId });
  } catch (error) {
    records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: "FAIL_RUNTIME_START_REJECTED", stop_code: "FAIL_RUNTIME_START_REJECTED", signed_terminal_tick_ceiling: terminalTickCeiling, last_checkpoint: null, first_missing_required_fact: error.message }));
    return { records, completed: false, terminal: false, fingerprint: null };
  }
  let snapshot = getRunSnapshot(run);
  if (snapshot.plan?.mapPlanId !== tuple.map_plan_id || snapshot.plan?.wavePlanId !== tuple.wave_plan_id || snapshot.plan?.m4PlanId !== tuple.m4_plan_id) {
    records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: "FAIL_RUNTIME_PLAN_IDENTITY_MISMATCH", stop_code: "FAIL_RUNTIME_PLAN_IDENTITY_MISMATCH", signed_terminal_tick_ceiling: terminalTickCeiling, last_checkpoint: null, first_missing_required_fact: tuple.expected_tuple_id }));
    return { records, completed: false, terminal: false, fingerprint: null };
  }
  records.push(makeRecord(nextSequence(records), "run_started", {
    run_id: runId,
    candidate_tuple_digest: candidateDigest,
    candidate_tuple: tuple,
    simulation_tick_rate_hz: TICK_RATE,
    resolved_start_state_digest: getRunDigest(run),
    plan: snapshot.plan,
    input_tape_id: tuple.input_tape_id ?? null,
    signed_terminal_tick_ceiling: terminalTickCeiling,
    observer_configuration: observer,
  }));
  ruleEvents(records, runId, candidateDigest, snapshot);
  let inputCursor = 0;
  checkpoint(records, runId, candidateDigest, snapshot, "tick-0", inputCursor);
  let observerFrame = observeCanonicalSnapshot(records, runId, candidateDigest, snapshot, observer, -1);
  const checkpoints = new Map([[0, getRunDigestFromSnapshot(snapshot)]]);
  while (!isTerminalRun(run) && snapshot.tick < terminalTickCeiling) {
    while (inputCursor < normalized.length && normalized[inputCursor].tape_sim_tick <= snapshot.tick) {
      const normalizedInput = normalizeOverlayPayload(normalized[inputCursor], snapshot);
      if (!normalizedInput) {
        records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: "FAIL_PUBLIC_INPUT_UNAVAILABLE", stop_code: "FAIL_PUBLIC_INPUT_UNAVAILABLE", signed_terminal_tick_ceiling: terminalTickCeiling, last_checkpoint: snapshot.tick, first_missing_required_fact: String(normalized[inputCursor].ordinal) }));
        return { records, completed: false, terminal: false, fingerprint: null };
      }
      run = queueInput(run, normalizedInput.type, normalizedInput.payload);
      records.push(makeRecord(nextSequence(records), "input_queued", {
        run_id: runId,
        candidate_tuple_digest: candidateDigest,
        tape_ordinal: normalized[inputCursor].ordinal,
        tape_sim_tick: normalized[inputCursor].tape_sim_tick,
        queued_for_tick: snapshot.tick + 1,
        public_input_type: normalizedInput.type,
        normalized_input: normalizedInput.payload,
        overlay: normalized[inputCursor].overlay ?? null,
      }));
      inputCursor += 1;
    }
    run = advanceDefenseRun(run, 1);
    snapshot = getRunSnapshot(run);
    ruleEvents(records, runId, candidateDigest, snapshot);
    checkpoint(records, runId, candidateDigest, snapshot, "per-tick", inputCursor);
    checkpoints.set(snapshot.tick, getRunDigestFromSnapshot(snapshot));
    observerFrame = observeCanonicalSnapshot(records, runId, candidateDigest, snapshot, observer, observerFrame);
    if (snapshot.growthOffer && !normalized.slice(inputCursor).some((action) => action.public_type === "GROWTH_OFFER_SELECTED" && action.tape_sim_tick >= snapshot.tick)) {
      records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: "FAIL_INCOMPLETE_ROUTE", stop_code: "FAIL_INCOMPLETE_ROUTE", signed_terminal_tick_ceiling: terminalTickCeiling, last_checkpoint: snapshot.tick, first_missing_required_fact: "exact public growth-offer selection input" }));
      return { records, completed: false, terminal: false, fingerprint: null };
    }
  }
  if (!isTerminalRun(run)) {
    records.push(makeRecord(nextSequence(records), "run_stopped", { run_id: runId, candidate_tuple_digest: candidateDigest, failure_code: "FAIL_INCOMPLETE_ROUTE", stop_code: "FAIL_INCOMPLETE_ROUTE", signed_terminal_tick_ceiling: terminalTickCeiling, last_checkpoint: snapshot.tick, first_missing_required_fact: "terminal event before signed ceiling" }));
    return { records, completed: false, terminal: false, fingerprint: null };
  }
  const mappedOutcome = terminalMapping(sources.assessmentUnits.document, snapshot.terminal);
  const expectedOutcome = tuple.terminal_binding;
  const m6 = m6LinkedDamage(records, tuple, sources.comboComparator.document);
  let completionFailure = !mappedOutcome || (expectedOutcome && mappedOutcome !== expectedOutcome) ? "FAIL_TERMINAL_MAPPING_MISMATCH" : null;
  if (!m6.valid) completionFailure = m6.failure_code;
  if (tuple.matrix_id === "M6") {
    records.push(makeRecord(nextSequence(records), "m6_linkage", {
      run_id: runId,
      candidate_tuple_digest: candidateDigest,
      signature_id: tuple.signature_id,
      fixture_id: tuple.fixture_id,
      ordered_ability_ids: tuple.ordered_ability_ids,
      linked_final_damage: m6.damage ?? null,
      first_resolved_event_id: m6.first_event_id ?? null,
      last_resolved_event_id: m6.last_event_id ?? null,
      target_instance_id: m6.target_instance_id ?? null,
      failure_code: m6.valid ? null : m6.failure_code,
      first_missing_required_fact: m6.missing_field ?? null,
    }));
  }
  records.push(makeRecord(nextSequence(records), "run_terminal", {
    run_id: runId,
    candidate_tuple_digest: candidateDigest,
    terminal_tick: snapshot.tick,
    terminal_outcome: snapshot.terminal,
    mapped_outcome: mappedOutcome ?? "NOT_OBSERVED",
    expected_terminal_binding: expectedOutcome ?? null,
    terminal_canonical_state_digest: getRunDigestFromSnapshot(snapshot),
    plan: snapshot.plan,
    input_cursor: inputCursor,
    completion_status: completionFailure ? "INCOMPLETE" : "COMPLETE",
    failure_code: completionFailure,
  }));
  return {
    records,
    completed: !completionFailure,
    terminal: true,
    fingerprint: { runId, candidateDigest, checkpoints, terminalDigest: getRunDigestFromSnapshot(snapshot), tuple, m6 },
  };
}

function compareM2Runs(fingerprints) {
  const records = [];
  const groups = new Map();
  for (const fingerprint of fingerprints.filter(Boolean)) {
    if (fingerprint.tuple.matrix_id !== "M2") continue;
    const family = fingerprint.tuple.base_tuple_family_id;
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(fingerprint);
  }
  for (const [family, members] of groups) {
    const baseline = members.find((entry) => entry.tuple.observer_cell_id === "normal-A" && entry.tuple.harness_cadence_hz === 60);
    if (!baseline) {
      records.push({ failure_code: "FAIL_OBSERVER_BASELINE_MISSING", family });
      continue;
    }
    for (const comparison of members) {
      const ticks = [...new Set([...baseline.checkpoints.keys(), ...comparison.checkpoints.keys()])].sort((left, right) => left - right);
      const firstTick = ticks.find((tick) => baseline.checkpoints.get(tick) !== comparison.checkpoints.get(tick));
      const terminalEqual = baseline.terminalDigest === comparison.terminalDigest;
      const equality = firstTick === undefined && terminalEqual;
      records.push({
        family,
        baseline,
        comparison,
        equality,
        first_divergence_tick: firstTick ?? null,
        first_divergence_path: equality ? null : firstTick === undefined ? "terminal_canonical_state_digest" : "checkpoint.canonical_state_digest",
      });
    }
  }
  return records;
}

function appendReplayRecords(records, comparisonResults) {
  for (const result of comparisonResults) {
    if (result.failure_code) {
      records.push(makeRecord(nextSequence(records), "run_stopped", { stop_code: result.failure_code, failure_code: result.failure_code, signed_terminal_tick_ceiling: null, last_checkpoint: null, first_missing_required_fact: result.family }));
      continue;
    }
    records.push(makeRecord(nextSequence(records), "replay_comparison", {
      run_id: result.comparison.runId,
      candidate_tuple_digest: result.comparison.candidateDigest,
      base_tuple_family_id: result.family,
      baseline_run_id: result.baseline.runId,
      baseline_candidate_tuple_digest: result.baseline.candidateDigest,
      comparison_run_id: result.comparison.runId,
      comparison_candidate_tuple_digest: result.comparison.candidateDigest,
      mode_delta: {
        observer_cell_id: result.comparison.tuple.observer_cell_id,
        harness_cadence_hz: result.comparison.tuple.harness_cadence_hz,
      },
      equality: result.equality,
      first_divergence_tick: result.first_divergence_tick,
      first_divergence_path: result.first_divergence_path,
      failure_code: result.equality ? null : "FAIL_CLOCK_OR_OBSERVER_DIVERGENCE",
    }));
  }
}

function appendM6ComparatorRecords(records, fingerprints, comparator) {
  const members = fingerprints.filter((fingerprint) => fingerprint?.tuple.matrix_id === "M6" && fingerprint.m6?.valid && Number.isFinite(fingerprint.m6.damage));
  let failures = 0;
  for (const candidate of members) {
    const comparatorValues = members.filter((member) => member !== candidate).map((member) => member.m6.damage).sort((left, right) => left - right);
    const middle = Math.floor(comparatorValues.length / 2);
    const median = comparatorValues.length % 2 ? comparatorValues[middle] : (comparatorValues[middle - 1] + comparatorValues[middle]) / 2;
    const valid = comparatorValues.length > 0 && Number.isFinite(median) && median > 0;
    const ratio = valid ? candidate.m6.damage / median : null;
    const failureCode = !valid || !Number.isFinite(ratio) ? "NOT_OBSERVED_ZERO_DENOMINATOR" : null;
    if (failureCode) failures += 1;
    records.push(makeRecord(nextSequence(records), "m6_comparator", {
      run_id: candidate.runId,
      candidate_tuple_digest: candidate.candidateDigest,
      comparator_member_count: comparatorValues.length,
      comparator_median_final_damage: valid ? median : null,
      combo_final_damage: candidate.m6.damage,
      ratio,
      ratio_disposition: failureCode ? "NOT_OBSERVED" : ratio > comparator.comparator_contract.ratio_policy.maximum_inclusive_ratio ? "MEASURED_THRESHOLD_VIOLATION_PENDING_INDEPENDENT_REVIEW" : "MEASURED_WITHIN_BOUND_PENDING_INDEPENDENT_REVIEW",
      failure_code: failureCode,
    }));
  }
  return failures;
}

export async function runG2FullRoute(options) {
  const paths = resolveCanonicalRegisterPaths(options);
  const registers = {
    seedRegister: await loadRegister("seed_register", paths.seedRegister, validateSeedRegister),
    inputTapeRegister: await loadRegister("input_tape_register", paths.inputTapeRegister, validateInputTapeRegister),
    expectedTuples: await loadRegister("expected_tuples", paths.expectedTuples, validateExpectedTuples),
  };
  const expectedTuples = flattenExpectedTuples(registers.expectedTuples.document);
  const baseFailures = collectAdmissionFailures(paths, registers);
  const admission = await loadAdmissionManifest(paths, options.admissionManifest);
  if (!options.admissionManifest) {
    return makeBlockedResult(paths, registers, expectedTuples, [...baseFailures, { failure_code: "FAIL_COLLECTION_NOT_AUTHORIZED", register: "collection", missing_field: "signed collection authorization" }], "headless-admission-only");
  }
  if (baseFailures.length || admission.failure) {
    return makeBlockedResult(paths, registers, expectedTuples, [...baseFailures, ...(admission.failure ? [admission.failure] : [])], "headless-admission-rejected");
  }
  const expectedReferences = registers.expectedTuples.document.cross_register_references;
  const assessmentUnits = await loadSourceContract(paths, "assessmentUnits", expectedReferences.assessment_units);
  const ttkCohorts = await loadSourceContract(paths, "ttkCohorts", expectedReferences.ttk_cohorts);
  const comboComparator = await loadSourceContract(paths, "comboComparator", expectedReferences.combo_comparator);
  const sources = { assessmentUnits, ttkCohorts, comboComparator };
  const sourceFailures = [assessmentUnits.failure, ttkCohorts.failure, comboComparator.failure].filter(Boolean);
  const runtimeDigests = await runtimeSourceDigests();
  const admissionFailures = validateAdmissionManifest(admission.manifest, expectedTuples, registers, sources, runtimeDigests);
  const materialization = sourceFailures.length ? { materialized: [], failures: [] } : materializeExpectedTuples(expectedTuples, registers.expectedTuples.document);
  const tupleFailures = sourceFailures.length ? [] : validateCanonicalTupleBindings(materialization.materialized, registers, sources);
  const preflightFailures = sourceFailures.length || materialization.failures.length || tupleFailures.length
    ? []
    : validateExecutionPreflight(materialization.materialized, admission.manifest, registers.inputTapeRegister.document, registers.expectedTuples.document);
  if (sourceFailures.length || admissionFailures.length || materialization.failures.length || tupleFailures.length || preflightFailures.length) {
    return makeBlockedResult(paths, registers, expectedTuples, [...sourceFailures, ...admissionFailures, ...materialization.failures, ...tupleFailures, ...preflightFailures], "headless-admission-rejected");
  }
  usedAdmissionNonces.add(admission.manifest.admission_nonce);
  const manifest = makeRecord(0, "manifest", {
    runner_schema_version: RUNNER_SCHEMA_VERSION,
    replay_protocol_version: REPLAY_PROTOCOL_VERSION,
    canonical_serializer_version: CANONICAL_SERIALIZER_VERSION,
    canonical_tuple_list_digest: sha256(canonicalStringify(registers.expectedTuples.document.expected_tuples)),
    expected_tuple_count: expectedTuples.length,
    canonical_register_digests: admission.manifest.canonical_register_digests,
    runtime_identity: admission.manifest.runtime_identity,
    admission_manifest_id: admission.manifest.manifest_id,
    admission_manifest_path: toRelativePath(paths.registerRoot, admission.path),
    collection_mode: "headless-admitted-deterministic-collection",
  });
  const records = [manifest];
  const fingerprints = [];
  let terminalRunCount = 0;
  let stoppedRunCount = 0;
  let invalidRunCount = 0;
  for (const tuple of materialization.materialized) {
    const result = captureTuple(tuple, admission.manifest, registers, sources);
    const offset = records.length;
    for (const record of result.records) {
      const { sequence: _ignored, record_checksum: _checksum, ...fields } = record;
      records.push(makeRecord(offset + records.length - offset, record.record_type, fields));
    }
    fingerprints.push(result.fingerprint);
    terminalRunCount += result.terminal ? 1 : 0;
    stoppedRunCount += result.terminal ? 0 : 1;
    invalidRunCount += result.completed ? 0 : 1;
  }
  appendReplayRecords(records, compareM2Runs(fingerprints));
  const m6Failures = appendM6ComparatorRecords(records, fingerprints, sources.comboComparator.document);
  const comparisonFailures = records.filter((record) => record.record_type === "replay_comparison" && !record.equality).length;
  const summary = makeRecord(records.length, "summary", {
    expected_tuple_count: expectedTuples.length,
    started_run_count: expectedTuples.length - stoppedRunCount,
    terminal_run_count: terminalRunCount,
    stopped_run_count: stoppedRunCount,
    invalid_run_count: invalidRunCount + comparisonFailures + m6Failures,
    missing_run_count: 0,
    first_falsifier_sequence: records.find((record) => record.failure_code)?.sequence ?? null,
    failure_codes: [...new Set(records.map((record) => record.failure_code).filter(Boolean))].sort(),
    collection_started: true,
  });
  records.push(summary);
  return { records, failed: invalidRunCount > 0 || stoppedRunCount > 0 || comparisonFailures > 0 || m6Failures > 0 };
}

export function toJsonLines(records) {
  return `${records.map((record) => canonicalStringify(record)).join("\n")}\n`;
}
