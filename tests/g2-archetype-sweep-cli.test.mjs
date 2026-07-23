import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = "scripts/run-g2-archetype-sweep.mjs";
const PROFILES = ["bulwark", "striker", "gambit", "conductor", "rift"];
const SEEDS = [17, 18, 19];

function checksumFor(record) {
  const { checksum, ...withoutChecksum } = record;
  return createHash("sha256").update(JSON.stringify(withoutChecksum)).digest("hex");
}

function parseJsonl(content) {
  return content
    .trim()
    .split("\n")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`JSONL line ${index + 1} is invalid: ${error.message}`);
      }
    });
}

test("G2 archetype sweep CLI emits a bounded, checksummed diagnostic package with accumulated combat facts", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "g2-archetype-sweep-"));
  const outputPath = join(temporaryDirectory, "g2-archetype-and-combat-sweep.jsonl");

  try {
    execFileSync(process.execPath, [SCRIPT_PATH, "--output", outputPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: "pipe",
    });

    const records = parseJsonl(await readFile(outputPath, "utf8"));
    const manifests = records.filter(({ record_type: recordType }) => recordType === "manifest");
    const runs = records.filter(({ record_type: recordType }) => recordType === "run");
    const summaries = records.filter(({ record_type: recordType }) => recordType === "summary");

    assert.equal(records.length, 17, "the package must contain one manifest, 15 runs, and one summary");
    assert.equal(manifests.length, 1, "the package must contain exactly one manifest");
    assert.equal(runs.length, 15, "the package must cover every 5-profile × 3-seed tuple");
    assert.equal(summaries.length, 1, "the package must contain exactly one summary");
    assert.equal(records[0], manifests[0], "the manifest must lead the JSONL package");
    assert.equal(records.at(-1), summaries[0], "the summary must close the JSONL package");

    for (const record of records) {
      assert.match(record.checksum, /^[a-f0-9]{64}$/, `${record.record_type} must expose a SHA-256 checksum`);
      assert.equal(record.checksum, checksumFor(record), `${record.record_type} checksum must cover its public record`);
    }

    const [manifest] = manifests;
    assert.equal(manifest.measurement_status, "INCOMPLETE");
    assert.equal(manifest.gate_verdict, "NOT_PASSED");
    assert.deepEqual(manifest.scope.profiles, PROFILES);
    assert.deepEqual(manifest.scope.seeds, SEEDS);
    assert.equal(manifest.scope.expected_run_count, 15);
    assert.deepEqual(
      manifest.scope.expected_profile_seed_tuples,
      PROFILES.flatMap((profileId) => SEEDS.map((seed) => ({ profile_id: profileId, seed }))),
    );
    assert.equal(manifest.provenance.event_capture, "Detached public snapshot events captured after each one-tick advance.");
    assert.match(manifest.note, /not a complete G2 gate contract/i);

    const observedTuples = runs.map(({ fixture_id: fixtureId, seed }) => `${fixtureId}/${seed}`).sort();
    const expectedTuples = PROFILES.flatMap((profileId) => SEEDS.map((seed) => `${profileId}/${seed}`)).sort();
    assert.deepEqual(observedTuples, expectedTuples, "every expected profile/seed pair must appear exactly once");

    for (const run of runs) {
      assert.equal(run.catalog_digest, manifest.provenance.catalog_digest);
      assert.equal(run.digest, run.repeat_digest, `${run.fixture_id}/${run.seed} must replay deterministically`);
      assert.equal(run.digest_matched, true, `${run.fixture_id}/${run.seed} must report a matching replay digest`);
      assert.match(run.input_tape_digest, /^[a-f0-9]{64}$/);
    }

    const striker17 = runs.find(({ fixture_id: fixtureId, seed }) => fixtureId === "striker" && seed === 17);
    assert.ok(striker17, "striker/17 must be part of the public 5 × 3 sweep");
    assert.equal(striker17.metrics.active_skill_metrics.skillId, "soul-lance");
    assert.equal(
      striker17.metrics.active_skill_metrics.casts,
      2,
      "striker/17 must retain both casts across the 360-tick window, not only final-tick events",
    );
    assert.equal(
      striker17.metrics.basic_attack_metrics.fires,
      5,
      "striker/17 must retain basic fires across the window, not only the final tick",
    );
    assert.equal(striker17.metrics.cooldown_metrics.setCount, 2);
    assert.equal(striker17.metrics.cooldown_metrics.readyCount, 1);
    assert.equal(striker17.metrics.cooldown_metrics.boundaryMismatchesCount, 0);
    assert.equal(striker17.metrics.cooldown_metrics.cycles.length, 2);

    const [summary] = summaries;
    assert.equal(summary.measurement_status, "INCOMPLETE");
    assert.equal(summary.gate_verdict, "NOT_PASSED");
    assert.equal(summary.total_runs, 15);
    assert.equal(summary.completed_runs, 15);
    assert.equal(summary.digest_mismatches, 0);
    assert.deepEqual(summary.profiles_evaluated, PROFILES);
    assert.deepEqual(summary.seeds_evaluated, SEEDS);
    assert.ok(summary.unavailable_metrics_summary.includes("route_win_rate"));
    assert.match(summary.note, /does not satisfy full G2 gate thresholds/i);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
