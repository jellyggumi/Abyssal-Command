import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = join(repositoryRoot, "scripts", "run-g2-adversarial-tape.mjs");
const FIXTURE_PATH = join(repositoryRoot, "qa/fixtures/g2-adversarial-tape-fixture-v1.json");
const OUTPUT_PATH = join(repositoryRoot, "qa/evidence/gates/G2/g2-adversarial-tape-evidence.json");
const RECEIPT_PATH = join(repositoryRoot, "qa/evidence/gates/G2/g2-adversarial-tape-evidence.receipt.json");
const SOURCE_REVISION = "g2-adversarial-tape-test-revision";
const FIXTURE_LENGTH = 53146;
const FIXTURE_RAW_SHA256 = "sha256:8869964ba710ba09be1784650d71e875f5d7c8094971236e152bc719a2daa2f9";
const FIXTURE_BLOB_SHA1 = "3bcf35a0be2777b2156f736f7753683c15c6541c";
const SHA256 = /^sha256:[a-f0-9]{64}$/;

const REQUIRED_SAMPLE_FIELDS = [
  "rules_version",
  "tape_id",
  "tape_hash",
  "stage",
  "seed",
  "archetype",
  "duplicate_replay_hash",
  "replay_stable",
  "accepted_input_rows",
  "tuple_status",
  "steps_executed",
  "terminal_outcome",
  "terminal_cause",
  "minimum_gate_integrity",
  "minimum_warden_integrity",
  "boss_spawn_tick",
  "boss_defeat_tick",
  "boss_ttk_ticks",
  "ordered_accepted_action_classes",
  "combo_ev_max_over_median",
  "growth_offer_id",
  "growth_option_ids",
  "growth_accepted_selection_count",
  "run_item_opportunity_count",
  "run_item_scope",
  "run_item_campaign_write_count",
  "elite_candidate_tick",
  "bind_requested_tick",
  "bind_terminal_outcome",
  "bind_terminal_event_id",
  "bind_terminal_tick",
  "elite_extracted_tick",
  "accepted_extraction_handoff_count",
  "companion_campaign_write_count",
  "catalog_snapshot_hash_before",
  "catalog_snapshot_hash_after",
  "run_state_hash_before",
  "run_state_hash_after",
  "campaign_state_hash_before",
  "campaign_state_hash_after",
  "persistent_write_families",
];

const REQUIRED_RECEIPT_FIELDS = [
  "tick",
  "event_trigger",
  "requested_action",
  "accepted_action",
  "rejection_reason",
  "position_or_target_directive",
];

const REQUIRED_INPUT_DIGEST_PATHS = Object.freeze([
  "scripts/run-g2-adversarial-tape.mjs",
  "g2-adversarial-tape-runner.js",
  "g2-full-route-runner.js",
  "defense-run-simulation.js",
  "defense-catalog.js",
  "rpg-catalog.js",
  "qa/fixtures/g2-adversarial-tape-fixture-v1.json",
]);

function tupleKey({ archetype, stage, stage_id: stageId, seed }) {
  return `${archetype}/${stage ?? stageId}/${seed}`;
}

function canonicalSha256(raw) {
  return `sha256:${createHash("sha256").update(raw, "utf8").digest("hex")}`;
}

function runCli({ check = false, sourceRevision = SOURCE_REVISION } = {}) {
  const result = spawnSync(process.execPath, [
    SCRIPT_PATH,
    "--source-revision",
    sourceRevision,
    ...(check ? ["--check"] : []),
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return result;
}

function readJson(rawPath) {
  return readFile(rawPath, "utf8").then((text) => JSON.parse(text));
}

async function cleanupArtifacts() {
  await rm(OUTPUT_PATH, { force: true });
  await rm(RECEIPT_PATH, { force: true });
}

async function withFixtureBackup(mutator, run, restore = true) {
  const original = await readFile(FIXTURE_PATH, "utf8");
  if (mutator) {
    await writeFile(FIXTURE_PATH, mutator(original), "utf8");
  }
  try {
    return await run();
  } finally {
    if (restore) await writeFile(FIXTURE_PATH, original, "utf8");
  }
}

test("G2 adversarial-tape CLI writes canonical fixed-path evidence and deterministic receipt", async () => {
  await cleanupArtifacts();
  const result = runCli();
  try {
    assert.equal(result.status, 0, `adversarial-tape CLI must complete: ${result.stderr || result.stdout}`);
    assert.equal(result.signal, null, "adversarial-tape CLI must not terminate by signal");

    const evidence = await readJson(OUTPUT_PATH);
    const receipt = await readJson(RECEIPT_PATH);

    const outputRaw = await readFile(OUTPUT_PATH, "utf8");
    assert.equal(receipt.schema_version, "g2-adversarial-tape-evidence-receipt/1");
    assert.equal(receipt.sourceRevision, SOURCE_REVISION);
    assert.equal(receipt.outputBytes.path, "qa/evidence/gates/G2/g2-adversarial-tape-evidence.json");
    assert.equal(receipt.outputBytes.byteLength, Buffer.from(outputRaw, "utf8").length);
    assert.equal(receipt.outputBytes.sha256, canonicalSha256(outputRaw));
    assert.ok(Object.hasOwn(receipt, "outputPath"), "receipt must expose fixed output path");
    assert.equal(receipt.outputPath, "qa/evidence/gates/G2/g2-adversarial-tape-evidence.json");
    assert.equal(receipt.receiptPath, "qa/evidence/gates/G2/g2-adversarial-tape-evidence.receipt.json");
    assert.equal(receipt.lane, "g2-adversarial-tape");
    for (const path of REQUIRED_INPUT_DIGEST_PATHS) {
      const digest = receipt.inputDigests?.[path];
      assert.match(digest, SHA256, `receipt must include deterministic sha256 for ${path}`);
    }
    assert.equal(receipt.fixture.path, "qa/fixtures/g2-adversarial-tape-fixture-v1.json");
    assert.equal(receipt.fixture.rawByteLength, FIXTURE_LENGTH);
    assert.equal(receipt.fixture.rawSha256, FIXTURE_RAW_SHA256);
    assert.equal(receipt.fixture.blobSha1, FIXTURE_BLOB_SHA1);
    const fixture = await readJson(FIXTURE_PATH);

    assert.equal(evidence.schema_version, "g2-adversarial-tape-evidence/1");
    assert.equal(evidence.tape_id, fixture.contract_id);
    assert.match(evidence.tape_hash, SHA256, "the receipt must identify the frozen tape by SHA-256");
    assert.equal(evidence.expected_tuple_count, 150);
    assert.equal(evidence.measurement_status, "INCOMPLETE");
    assert.equal(evidence.gate_verdict, "NOT_PASSED");
    assert.deepEqual(evidence.comparator, {
      combo_ev_max_over_median: null,
      status: "UNBOUND_COMPARATOR",
    });

    assert.ok(Array.isArray(evidence.samples), "the public receipt must expose its per-tuple samples");
    assert.equal(evidence.samples.length, 150, "the receipt must contain exactly the frozen 5 × 10 × 3 matrix");

    const expectedTupleKeys = (fixture.finite_population.tuples || []).map(tupleKey).sort();
    const observedTupleKeys = evidence.samples.map(tupleKey).sort();
    assert.deepEqual(observedTupleKeys, expectedTupleKeys, "the receipt must preserve the exact frozen tuple matrix");

    const expectedPolicyReceipts = {
      rusher: "RUSHER_STAGE_START_MOVE",
      turtle: "TURTLE_STAGE_START_MOVE",
      "economy-greed": "ECONOMY_STAGE_START_MOVE",
      "micro-optimizer": "MICRO_STAGE_START_MOVE",
      casual: "CASUAL_STAGE_START_IDLE",
    };

    for (const sample of evidence.samples) {
      const sampleKey = tupleKey(sample);
      for (const field of REQUIRED_SAMPLE_FIELDS) {
        assert.ok(field in sample, `${sampleKey} must retain ${field}, including explicit null values`);
      }
      assert.equal(sample.rules_version, "defense-survivor-v1");
      assert.equal(sample.tape_id, fixture.contract_id);
      assert.match(sample.tape_hash, SHA256, `${sampleKey} must identify the frozen tape by SHA-256`);
      assert.equal(sample.replay_stable, true, `${sampleKey} must prove its two internal replays were byte-stable`);
      assert.match(sample.duplicate_replay_hash, SHA256, `${sampleKey} must publish its byte-stable duplicate replay hash`);
      assert.equal(sample.catalog_snapshot_hash_after, sample.catalog_snapshot_hash_before, `${sampleKey} must not mutate the catalog`);
      assert.equal(sample.campaign_state_hash_before, null, `${sampleKey} has no authorized campaign-state read or write`);
      assert.equal(sample.campaign_state_hash_after, null, `${sampleKey} has no authorized campaign-state read or write`);
      assert.deepEqual(sample.persistent_write_families, [], `${sampleKey} must report no persistent write families`);
      assert.equal(sample.run_item_campaign_write_count, 0, `${sampleKey} has no authorized campaign writes`);
      assert.equal(sample.companion_campaign_write_count, 0, `${sampleKey} has no authorized companion writes`);
      assert.equal(sample.run_item_scope, "run", `${sampleKey} keeps run-item opportunities run-local`);
      assert.ok(Array.isArray(sample.accepted_input_rows), `${sampleKey} must expose public-queue input receipts`);

      for (const row of sample.accepted_input_rows) {
        for (const field of REQUIRED_RECEIPT_FIELDS) {
          assert.ok(field in row, `${sampleKey} receipt must retain ${field}, including explicit null values`);
        }
        assert.ok(fixture.public_api_only.queueable_input_types.includes(row.requested_action), `${sampleKey} may request only a public queue input`);
        if (row.accepted_action !== null) {
          assert.ok(fixture.public_api_only.queueable_input_types.includes(row.accepted_action), `${sampleKey} may accept only a public queue input`);
        }
      }
      assert.ok(sample.accepted_input_rows.some(({ event_trigger: trigger }) => trigger === expectedPolicyReceipts[sample.archetype]), `${sampleKey} must retain policy-specific public receipt`);

      const timedOut = sample.tuple_status === "INVALID_TIMEOUT";
      const reachedEngineeringCeilingWithoutTerminal = sample.steps_executed === 20000 && sample.terminal_outcome === null;
      assert.equal(timedOut, reachedEngineeringCeilingWithoutTerminal, `${sampleKey} must classify exactly a 20,000-step missing terminal as INVALID_TIMEOUT`);
      if (timedOut) {
        assert.equal(sample.terminal_outcome, null, `${sampleKey} timeout must not become a win`);
        assert.equal(sample.terminal_cause, "TIMEOUT_ENGINEERING_CEILING");
        assert.equal(sample.boss_defeat_tick, null, `${sampleKey} timeout has no boss defeat tick`);
        assert.equal(sample.boss_ttk_ticks, null, `${sampleKey} timeout has no valid TTK`);
        assert.equal(sample.g2_status, "NOT_PASSED", `${sampleKey} timeout must not pass G2`);
        assert.equal(sample.g3_status, "NOT_PASSED", `${sampleKey} timeout must not pass G3`);
      }
    }
    const checkHealthy = runCli({ check: true, sourceRevision: SOURCE_REVISION });
    assert.equal(checkHealthy.status, 0, `check mode with embedded source revision and bytes must succeed\n${checkHealthy.stderr}`);

    const originalOutput = await readFile(OUTPUT_PATH, "utf8");
    try {
      await writeFile(OUTPUT_PATH, "{}\n", "utf8");
      const checkPayloadMismatch = runCli({ check: true, sourceRevision: SOURCE_REVISION });
      assert.notEqual(checkPayloadMismatch.status, 0, "tampered output must fail check mode");
      assert.match(checkPayloadMismatch.stderr, /FAIL_OUTPUT_BYTES/, "output byte mismatch must be reported");
      await writeFile(OUTPUT_PATH, originalOutput, "utf8");

      const checkSourceRevisionMismatch = runCli({ check: true, sourceRevision: "wrong-revision" });
      assert.notEqual(checkSourceRevisionMismatch.status, 0, "sourceRevision mismatch must fail check mode");
      assert.match(checkSourceRevisionMismatch.stderr, /FAIL_SOURCE_REVISION/, "source revision mismatch must be reported");
    } finally {
      await writeFile(OUTPUT_PATH, originalOutput, "utf8");
    }
  } finally {
    await cleanupArtifacts();
  }
});

test("G2 adversarial-tape CLI fails before runner when fixture is missing", async () => {
  await cleanupArtifacts();
  const original = await readFile(FIXTURE_PATH);
  await rm(FIXTURE_PATH, { force: true });
  try {
    const result = runCli();
    assert.notEqual(result.status, 0, "missing fixture should fail");
    assert.match(result.stderr, /FAIL_FIXTURE_MISSING/, "failure must be a fixture-missing check");
    await assert.rejects(readFile(OUTPUT_PATH, "utf8"));
    await assert.rejects(readFile(RECEIPT_PATH, "utf8"));
  } finally {
    await writeFile(FIXTURE_PATH, original);
  }
});

test("G2 adversarial-tape CLI fails before runner when fixture hash is mismatched", async () => {
  await cleanupArtifacts();
  await withFixtureBackup((fixtureText) => fixtureText.replace(
    '"contract_id": "g2-adversarial-tape-v1"',
    '"contract_id": "g2-adversarial-tape-vX"',
  ), async () => {
    const result = runCli();
    assert.notEqual(result.status, 0, "mismatched fixture should fail before runner");
    assert.match(result.stderr, /FAIL_FIXTURE_RAW_SHA256|FAIL_FIXTURE_BLOB_SHA|FAIL_FIXTURE_LENGTH/, "failure should reference fixture hash verification");
    await assert.rejects(readFile(OUTPUT_PATH, "utf8"));
    await assert.rejects(readFile(RECEIPT_PATH, "utf8"));
  });
});

