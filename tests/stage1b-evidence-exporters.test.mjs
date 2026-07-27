import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { buildPayload as buildPressurePayload } from "../scripts/run-stage1b-pressure-packets.mjs";
import { buildPayload as buildPersistencePayload } from "../scripts/run-stage1b-persistence-scenarios.mjs";

const repositoryRoot = resolve(".");
const g3Script = resolve(repositoryRoot, "scripts/run-g3-stance-events.mjs");
const g3TestOutput = resolve(repositoryRoot, "qa/evidence/gates/G3/.stage1b-g3-exporter-test.json");
const g3Exporter = resolve(repositoryRoot, "scripts/export-stage1b-formation-attribution.mjs");
const g3CanonicalOutput = resolve(repositoryRoot, "qa/evidence/gates/G3/stage1b-formation-attribution.json");
const g3CanonicalReceipt = resolve(repositoryRoot, "qa/evidence/gates/G3/stage1b-formation-attribution.json.receipt.json");
const g2Exporter = resolve(repositoryRoot, "scripts/export-stage1b-pressure-packets.mjs");
const g2CanonicalOutput = resolve(repositoryRoot, "qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json");
const g2CanonicalReceipt = resolve(repositoryRoot, "qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json.receipt.json");

async function runG3ForTest() {
  const result = spawnSync(process.execPath, [g3Script, "--output", g3TestOutput, "--seeds", "401"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: 600_000,
  });
  assert.equal(result.status, 0, `${g3Script} must finish successfully\n${result.stderr}`);
  try {
    return JSON.parse(await readFile(g3TestOutput, "utf8"));
  } finally {
    await rm(g3TestOutput, { force: true });
  }
}

function orderedEvents(events, context) {
  assert.ok(Array.isArray(events), `${context} must retain raw events`);
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(events[index - 1].eventSequence < events[index].eventSequence, `${context} event order must be stable`);
    assert.ok(events[index - 1].tick <= events[index].tick, `${context} tick order must be stable`);
  }
}

test("Stage1b pressure exporter retains composite-net ledger evidence", () => {
  const payload = buildPressurePayload([401], ["VANGUARD"], "stage1b-test-revision");
  assert.equal(payload.controller.kind, "synthetic");
  assert.equal(payload.rows.length, 1);
  const row = payload.rows[0];
  assert.equal(row.bossTtkStatus, "MEASURED");
  assert.ok(row.pressurePackets.length > 0);
  for (const packet of row.pressurePackets) {
    assert.ok(packet.toTick > packet.fromTick);
    assert.ok(Array.isArray(packet.integrityLedger));
    assert.equal(packet.controller.kind, "synthetic");
    for (const record of packet.integrityLedger) {
      assert.ok(record.target === "gate" || record.target === "commander");
      assert.equal(record.appliedDelta, record.to - record.from);
      assert.ok(record.sourcePacketIndex === null || Number.isInteger(record.sourcePacketIndex));
      assert.ok(Array.isArray(record.sourcePacketIndices));
    }
  }
});

test("Stage1b G3 exporter anchors conversion phases at accepted switch and preserves NOT_EXPOSED", async () => {
  const payload = await runG3ForTest();
  assert.equal(payload.controller.kind, "synthetic");
  assert.equal(payload.formationTransitions.length, 50);
  assert.equal(payload.controlRuns.length, 100);
  assert.equal(payload.summary.exposureCounts.NOT_EXPOSED, 50);
  for (const transition of payload.formationTransitions) {
    orderedEvents(transition.events, transition.runId);
    const accepted = transition.events.find((event) => event.eventSequence === transition.switchEventSequence);
    assert.equal(accepted?.type, "INPUT_ACCEPTED");
    assert.equal(accepted?.inputType, "STANCE_CYCLE");
    assert.equal(transition.stanceAfter, "TURRET");
    if (!transition.pressureContext.nonBossPressureActive) assert.equal(transition.exposureStatus, "NOT_EXPOSED");
  }
});

test("Stage1b persistence exporter proves victory, defeat-before, and defeat-after acceptance", () => {
  const payload = buildPersistencePayload("stage1b-test-revision");
  assert.equal(payload.scenarioCount, 3);
  assert.deepEqual(payload.scenarioOrder, ["victory", "defeat-before-acceptance", "defeat-after-acceptance"]);
  const scenarios = new Map(payload.scenarios.map((scenario) => [scenario.scenario, scenario]));
  assert.equal(scenarios.get("victory").seed, 901);
  assert.equal(scenarios.get("defeat-before-acceptance").seed, 902);
  assert.equal(scenarios.get("defeat-after-acceptance").seed, 901);
  assert.equal(scenarios.get("victory").acceptedEliteExtractCount, 1);
  assert.equal(scenarios.get("defeat-before-acceptance").acceptedEliteExtractCount, 0);
  assert.equal(scenarios.get("defeat-after-acceptance").acceptedEliteExtractCount, 1);
  assert.equal(scenarios.get("defeat-after-acceptance").policy.moveOnlyAfterAcceptance, true);
  assert.equal(scenarios.get("defeat-after-acceptance").policy.occupationAfterTick, 3700);
  for (const scenario of payload.scenarios) {
    orderedEvents(scenario.events, scenario.scenario);
    assert.ok(Array.isArray(scenario.campaignDiff));
    assert.equal(scenario.invariants.writesWithoutAcceptedExtract, 0);
    assert.ok(Object.values(scenario.invariantChecks).every(Boolean));
  }
  assert.ok(Object.values(payload.invariants).every(Boolean));
});
test("Stage1b G3 canonical exporter exercises real CLI and fails closed", async () => {
  const maybeRead = async (path) => {
    try {
      return await readFile(path);
    } catch {
      return null;
    }
  };
  const savedOutput = await maybeRead(g3CanonicalOutput);
  const savedReceipt = await maybeRead(g3CanonicalReceipt);
  const run = (...args) => spawnSync(process.execPath, [g3Exporter, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 600_000,
  });
  const canonicalArgs = [
    "--output",
    "qa/evidence/gates/G3/stage1b-formation-attribution.json",
    "--source-revision",
    "stage1b-g3-cli-test-revision",
  ];
  try {
    let result = run(...canonicalArgs);
    assert.equal(result.status, 0, `real G3 exporter must succeed: ${result.stderr}`);
    result = run(...canonicalArgs, "--check");
    assert.equal(result.status, 0, `real G3 exporter --check must succeed: ${result.stderr}`);

    const outputBeforeTamper = await readFile(g3CanonicalOutput);
    await writeFile(g3CanonicalOutput, Buffer.concat([outputBeforeTamper, Buffer.from("tampered")]));
    result = run(...canonicalArgs, "--check");
    assert.notEqual(result.status, 0, "tampered G3 output must fail closed");
    await writeFile(g3CanonicalOutput, outputBeforeTamper);

    const receiptBeforeTamper = JSON.parse(await readFile(g3CanonicalReceipt, "utf8"));
    receiptBeforeTamper.sourceRevision = "tampered-source-revision";
    await writeFile(g3CanonicalReceipt, `${JSON.stringify(receiptBeforeTamper, null, 2)}\n`, "utf8");
    result = run(...canonicalArgs, "--check");
    assert.notEqual(result.status, 0, "tampered G3 receipt must fail closed");

    result = run("--output", "qa/evidence/gates/G3/stage1b-formation-attribution.json");
    assert.notEqual(result.status, 0, "missing G3 --source-revision must fail closed");
  } finally {
    if (savedOutput === null) await rm(g3CanonicalOutput, { force: true });
    else await writeFile(g3CanonicalOutput, savedOutput);
    if (savedReceipt === null) await rm(g3CanonicalReceipt, { force: true });
    else await writeFile(g3CanonicalReceipt, savedReceipt);
  }
});
test("Stage1b G2 canonical pressure exporter exercises real CLI and fails closed", async () => {
  const maybeRead = async (path) => {
    try {
      return await readFile(path);
    } catch {
      return null;
    }
  };
  const savedOutput = await maybeRead(g2CanonicalOutput);
  const savedReceipt = await maybeRead(g2CanonicalReceipt);
  const run = (...args) => spawnSync(process.execPath, [g2Exporter, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 600_000,
  });
  const canonicalArgs = [
    "--output",
    "qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json",
    "--source-revision",
    "stage1b-g2-cli-test-revision",
  ];
  try {
    let result = run(...canonicalArgs);
    assert.equal(result.status, 0, `real G2 exporter must succeed: ${result.stderr}`);
    result = run(...canonicalArgs, "--check");
    assert.equal(result.status, 0, `real G2 exporter --check must succeed: ${result.stderr}`);

    const outputBeforeTamper = await readFile(g2CanonicalOutput);
    await writeFile(g2CanonicalOutput, Buffer.concat([outputBeforeTamper, Buffer.from("tampered")]));
    result = run(...canonicalArgs, "--check");
    assert.notEqual(result.status, 0, "tampered G2 output must fail closed");
    await writeFile(g2CanonicalOutput, outputBeforeTamper);

    const receiptBeforeTamper = JSON.parse(await readFile(g2CanonicalReceipt, "utf8"));
    receiptBeforeTamper.sourceRevision = "tampered-source-revision";
    await writeFile(g2CanonicalReceipt, `${JSON.stringify(receiptBeforeTamper, null, 2)}\n`, "utf8");
    result = run(...canonicalArgs, "--check");
    assert.notEqual(result.status, 0, "tampered G2 receipt must fail closed");

    result = run("--output", "qa/evidence/gates/G2/not-canonical.json", "--source-revision", "stage1b-g2-cli-test-revision");
    assert.notEqual(result.status, 0, "non-canonical G2 output path must fail closed");
    result = run("--output", "qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json");
    assert.notEqual(result.status, 0, "missing G2 --source-revision must fail closed");
  } finally {
    if (savedOutput === null) await rm(g2CanonicalOutput, { force: true });
    else await writeFile(g2CanonicalOutput, savedOutput);
    if (savedReceipt === null) await rm(g2CanonicalReceipt, { force: true });
    else await writeFile(g2CanonicalReceipt, savedReceipt);
  }
});
