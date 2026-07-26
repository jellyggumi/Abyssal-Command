import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(repositoryRoot, "_workspace", "20260725-defense-rpg-development");
const FIXTURE_PATH = "qa/g2-adversarial-tape-fixture-v1.json";
const SCRIPT_PATH = join(repositoryRoot, "scripts", "run-g2-adversarial-tape.mjs");
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

function tupleKey({ archetype, stage, stage_id: stageId, seed }) {
  return `${archetype}/${stage ?? stageId}/${seed}`;
}

function runCli(outputPath) {
  const result = spawnSync(process.execPath, [
    SCRIPT_PATH,
    "--fixture", FIXTURE_PATH,
    "--output", outputPath,
  ], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `adversarial-tape CLI must complete the authorized measurement: ${result.stderr || result.stdout}`,
  );
  assert.equal(result.signal, null, "adversarial-tape CLI must not terminate by signal");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("G2 adversarial-tape CLI emits the signed 150-tuple, input-only, fail-closed measurement receipt", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-adversarial-tape-cli-"));
  const outputPath = join(temporaryDirectory, "receipt.json");

  try {
    const fixture = await readJson(join(fixtureRoot, FIXTURE_PATH));
    const expectedTuples = fixture.finite_population.tuples;
    const expectedTupleKeys = expectedTuples.map(tupleKey).sort();

    assert.equal(fixture.fixture_id, "g2-adversarial-tape-fixture-v1");
    assert.equal(fixture.contract_id, "g2-adversarial-tape-v1");
    assert.equal(fixture.finite_population.tuple_count, 150);
    assert.equal(expectedTuples.length, 150, "the frozen fixture must enumerate all 150 tuples explicitly");
    assert.equal(new Set(expectedTupleKeys).size, 150, "the frozen fixture must not contain duplicate tuple identities");

    runCli(outputPath);

    const evidence = await readJson(outputPath);
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

    const observedTupleKeys = evidence.samples.map(tupleKey).sort();
    assert.deepEqual(observedTupleKeys, expectedTupleKeys, "the receipt must preserve the exact frozen tuple matrix");
    assert.equal(new Set(observedTupleKeys).size, 150, "each frozen tuple must appear exactly once in the receipt");

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
      assert.equal(sample.run_item_campaign_write_count, 0, `${sampleKey} must not write run items to campaign state`);
      assert.equal(sample.companion_campaign_write_count, 0, `${sampleKey} must not write companions to campaign state`);
      assert.equal(sample.run_item_scope, "run", `${sampleKey} must keep run-item opportunities run-local`);

      assert.ok(Array.isArray(sample.accepted_input_rows), `${sampleKey} must expose public-queue input receipts`);
      for (const receipt of sample.accepted_input_rows) {
        for (const field of REQUIRED_RECEIPT_FIELDS) {
          assert.ok(field in receipt, `${sampleKey} receipt must retain ${field}, including explicit null values`);
        }
        assert.ok(
          fixture.public_api_only.queueable_input_types.includes(receipt.requested_action),
          `${sampleKey} may request only an authorized public queue input`,
        );
        if (receipt.accepted_action !== null) {
          assert.ok(
            fixture.public_api_only.queueable_input_types.includes(receipt.accepted_action),
            `${sampleKey} may accept only an authorized public queue input`,
          );
        }
      }
      assert.ok(
        sample.accepted_input_rows.some(({ event_trigger: trigger }) => trigger === expectedPolicyReceipts[sample.archetype]),
        `${sampleKey} must retain the policy-specific public receipt that distinguishes ${sample.archetype}`,
      );

      const timedOut = sample.tuple_status === "INVALID_TIMEOUT";
      const reachedEngineeringCeilingWithoutTerminal = sample.steps_executed === 20000 && sample.terminal_outcome === null;
      assert.equal(
        timedOut,
        reachedEngineeringCeilingWithoutTerminal,
        `${sampleKey} must classify exactly a 20,000-step missing terminal as INVALID_TIMEOUT`,
      );
      if (timedOut) {
        assert.equal(sample.terminal_outcome, null, `${sampleKey} timeout must not become a win`);
        assert.equal(sample.terminal_cause, "TIMEOUT_ENGINEERING_CEILING");
        assert.equal(sample.boss_defeat_tick, null, `${sampleKey} timeout has no boss defeat tick`);
        assert.equal(sample.boss_ttk_ticks, null, `${sampleKey} timeout has no valid TTK`);
        assert.equal(sample.g2_status, "NOT_PASSED", `${sampleKey} timeout must not pass G2`);
        assert.equal(sample.g3_status, "NOT_PASSED", `${sampleKey} timeout must not pass G3`);
      }
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
