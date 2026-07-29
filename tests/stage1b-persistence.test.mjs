import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { buildPayload } from "../scripts/run-stage1b-persistence-scenarios.mjs";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { canonicalStringify } from "../g2-full-route-runner.js";
import { dirname, resolve } from "node:path";

import { fileURLToPath } from "node:url";
const sourceRevision = "stage1b-persistence-test-revision";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const persistenceExporter = resolve(repositoryRoot, "scripts/export-stage1b-persistence-scenarios.mjs");
const persistenceOutput = resolve(repositoryRoot, "qa/evidence/gates/G7/stage1b-persistence-scenarios.json");
const persistenceReceipt = resolve(repositoryRoot, "qa/evidence/gates/G7/stage1b-persistence-scenarios.json.receipt.json");

const EXPECTED_SCENARIOS = [
  { scenario: "victory", seed: 901, acceptedEliteExtractCount: 1, terminalPattern: /^(VICTORY|FINAL_COMPLETION|DEFEAT)$/ },
  { scenario: "defeat-before-acceptance", seed: 902, acceptedEliteExtractCount: 0, terminal: "DEFEAT" },
  { scenario: "defeat-after-acceptance", seed: 901, acceptedEliteExtractCount: 1, terminal: "DEFEAT" },
];

const EXPECTED_INPUT_TYPES = new Set(["MOVE", "SKILL_CAST", "SKILL_SELECTED", "EXTRACT_ELITE"]);

function runPersistenceScript() {
  const payload = buildPayload(sourceRevision);
  const raw = Buffer.from(`${canonicalStringify(payload)}\n`, "utf8");
  return {
    payload,
    raw,
    result: { status: 0, stderr: "" },
    cleanup: async () => {},
  };
}

function byScenario(payload) {
  return new Map(payload.scenarios.map((scenario) => [scenario.scenario, scenario]));
}

function diffSegments(rows) {
  const bySegment = Object.create(null);
  for (const row of rows) {
    const segment = row?.segment ?? "_UNKNOWN";
    bySegment[segment] = (bySegment[segment] ?? 0) + 1;
  }
  return bySegment;
}

function schemaFromScenario(scenario) {
  return scenario.campaign?.schema ?? scenario.campaignSchema;
}

function acceptedExtractionInputIndex(inputs) {
  return inputs.findIndex((input) => input.inputType === "EXTRACT_ELITE" && input.accepted);
}



test("Stage 1b persistence exposes exact scenario identity and deterministic source revision", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);
    assert.equal(payload.classification, "synthetic-scripted-evidence-not-human-g7-g8");
    assert.equal(payload.humanEvidenceStatus, "NOT_CLAIMED");
    assert.equal(payload.sourceRevision, sourceRevision);
    assert.equal(payload.scenarioCount, EXPECTED_SCENARIOS.length);
    assert.deepEqual(
      payload.scenarioOrder,
      EXPECTED_SCENARIOS.map(({ scenario }) => scenario),
      "scenario order must match the deterministic tape list",
    );

    const rows = byScenario(payload);
    for (const expected of EXPECTED_SCENARIOS) {
      const scenario = rows.get(expected.scenario);
      assert.ok(scenario, `payload must include scenario ${expected.scenario}`);
      assert.equal(scenario.seed, expected.seed, `scenario ${expected.scenario} must use the exact seed`);
      assert.equal(scenario.acceptedEliteExtractCount, expected.acceptedEliteExtractCount);
    }
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence controller emits only public non-monetized input controls", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);

    for (const scenario of payload.scenarios) {
      assert.ok(Array.isArray(scenario.inputs), `${scenario.scenario} should retain scripted inputs`);
      for (const input of scenario.inputs) {
        assert.equal(
          EXPECTED_INPUT_TYPES.has(input.inputType),
          true,
          `${scenario.scenario} should use only public input types`,
        );
      }
      assert.equal(scenario.invariantChecks?.noUnexpectedInputTypes, true, `${scenario.scenario} should have no unexpected input types`);
      assert.equal(scenario.rewardSelections?.length, 0, `${scenario.scenario} must not queue reward selections`);
    }
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence terminal outcomes satisfy scenario contracts", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);
    const lookup = byScenario(payload);

    for (const expected of EXPECTED_SCENARIOS) {
      const scenario = lookup.get(expected.scenario);
      assert.ok(scenario, `missing scenario ${expected.scenario}`);
      if (expected.terminal) {
        assert.equal(scenario.terminal, expected.terminal);
      } else if (expected.terminalPattern) {
        assert.match(scenario.terminal, expected.terminalPattern);
      }
      assert.equal(scenario.acceptedEliteExtractCount, expected.acceptedEliteExtractCount);
    }

    const afterAcceptance = lookup.get("defeat-after-acceptance");
    assert.ok(afterAcceptance);
    assert.equal(afterAcceptance.policy?.moveOnlyAfterAcceptance, true);
    assert.equal(afterAcceptance.objectivePressure.deadlineSatisfied, true);
    assert.ok(
      afterAcceptance.events.some((event) => event.type === "OBJECTIVE_PRESSURE_DEADLINE" && event.targetId === "gate"),
      "defeat-after-acceptance must terminate through the pressure deadline event",
    );
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence applies extraction reducer before campaign resolution and retains ordered diffs", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);
    const lookup = byScenario(payload);

    for (const expected of EXPECTED_SCENARIOS) {
      const scenario = lookup.get(expected.scenario);
      assert.ok(scenario, `missing scenario ${expected.scenario}`);
      assert.equal(scenario.acceptance?.extractorAppliedBeforeCampaignResult, true);

      const segments = diffSegments(scenario.campaignDiff ?? []);
      if (expected.acceptedEliteExtractCount > 0) {
        assert.ok(
          segments.POST_START_TO_POST_EXTRACTION > 0,
          `${scenario.scenario} should retain pre-final reducer diff entries when extraction is accepted`,
        );
      } else {
        assert.equal(segments.POST_START_TO_POST_EXTRACTION ?? 0, 0, `${scenario.scenario} should not mutate campaign pre-finalized`);
      }
      assert.equal(segments.POST_EXTRACTION_TO_FINAL > 0, true, `${scenario.scenario} must retain final campaign diff entries from result application`);
      assert.equal(scenario.campaignBefore, scenario.campaign?.postStart);
      assert.equal(scenario.campaignAfter, scenario.campaign?.final);
      assert.equal(scenario.acceptedHandoffs.length, expected.acceptedEliteExtractCount);
      assert.equal(scenario.writes.length, expected.acceptedEliteExtractCount);
      assert.equal(scenario.inputAcceptedEvidence.length, expected.acceptedEliteExtractCount);
    }
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence keeps MOVE-only behavior after accepted extraction", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);
    const lookup = byScenario(payload);

    const victory = lookup.get("victory");
    const defeatAfter = lookup.get("defeat-after-acceptance");
    assert.ok(victory);
    assert.ok(defeatAfter);

    const victoryAccept = acceptedExtractionInputIndex(victory.inputs);
    const defeatAccept = acceptedExtractionInputIndex(defeatAfter.inputs);
    assert.ok(victoryAccept >= 0, "victory must include an accepted extraction input");
    assert.ok(defeatAccept >= 0, "defeat-after-acceptance must include an accepted extraction input");
    assert.equal(defeatAfter.policy?.moveOnlyAfterAcceptance, true);
    assert.equal(defeatAfter.policy?.occupationAfterTick, 3700);
    assert.equal(defeatAfter.policy?.preOccupationTarget, "extraction");

    for (const input of defeatAfter.inputs.slice(defeatAccept + 1)) {
      assert.notEqual(input.inputType, "SKILL_CAST");
      assert.notEqual(input.inputType, "EXTRACT_ELITE");
      assert.equal(input.inputType, "MOVE");
    }
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence is replay-deterministic at canonical-byte level", async () => {
  const first = await runPersistenceScript();
  let second;
  try {
    assert.equal(first.result.status, 0, `first run must succeed\nstderr: ${first.result.stderr}`);
    second = await runPersistenceScript();
    assert.equal(second.result.status, 0, `second run must succeed\nstderr: ${second.result.stderr}`);

    assert.equal(
      first.raw.equals(second.raw),
      true,
      "runs with same revision and parameters should be byte-identical",
    );
    for (const scenario of first.payload.scenarios) {
      assert.equal(scenario.replay?.status, "IDENTICAL", `${scenario.scenario} should explicitly report replay identity`);
      assert.equal(typeof scenario.replay?.canonicalByteLength, "number");
      assert.equal(scenario.replay?.canonicalByteLength > 0, true);
      assert.match(scenario.replay?.canonicalSha256 ?? "", /^sha256:[0-9a-f]{64}$/);
    }
    assert.equal(first.payload.invariants?.replayMatches, true);
  } finally {
    await first.cleanup();
    if (second?.cleanup) {
      await second.cleanup();
    }
  }
});

test("Stage 1b persistence has no second extraction and keeps acceptance boundaries", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);

    for (const scenario of payload.scenarios) {
      const extractInputs = scenario.inputs.filter((input) => input.inputType === "EXTRACT_ELITE");
      const acceptedExtractInputs = extractInputs.filter((input) => input.accepted);
      assert.equal(extractInputs.length <= 2, true, `${scenario.scenario} may request a route and one accepted EXTRACT_ELITE handoff`);
      assert.equal(scenario.invariantChecks?.acceptanceConsistent, true, `${scenario.scenario} should maintain accepted handoff consistency`);
      assert.equal(scenario.invariantChecks?.acceptanceConsistentWithEvents, true);
      assert.equal(scenario.acceptance?.inputAcceptedCount, scenario.acceptedEliteExtractCount);
      assert.equal(acceptedExtractInputs.length, scenario.acceptedEliteExtractCount, `${scenario.scenario} must retain exactly its accepted extraction inputs`);
      if (scenario.scenario === "defeat-before-acceptance") {
        assert.equal(scenario.acceptedEliteExtractCount, 0);
      }
      if (scenario.acceptedEliteExtractCount > 0) {
        assert.equal(acceptedExtractInputs.length, 1, `${scenario.scenario} must accept exactly one extraction handoff`);
        assert.equal(extractInputs.length, 2, `${scenario.scenario} must record the rejected route request before its accepted handoff`);
      }
    }
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence has stable campaign schema and no campaign schema mutation", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);

    for (const scenario of payload.scenarios) {
      const schema = schemaFromScenario(scenario);
      assert.ok(schema);
      const schemaSets = [schema.initial, schema.postStart, schema.postExtraction, schema.final];
      for (const set of schemaSets) {
        assert.ok(Array.isArray(set), `${scenario.scenario} must expose fixed campaign schema arrays`);
      }

      const baselineKeys = schemaSets[0];
      for (const keys of schemaSets.slice(1)) {
        assert.equal(keys.length, baselineKeys.length, `${scenario.scenario} should preserve campaign top-level key count`);
        assert.deepEqual(keys, baselineKeys, `${scenario.scenario} should not mutate campaign schema keys`);
      }
    }
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence never emits monetization paths", async () => {
  const { payload, result, cleanup } = await runPersistenceScript();
  try {
    assert.equal(result.status, 0, `script exit status must be 0\nstderr: ${result.stderr}`);

    for (const scenario of payload.scenarios) {
      assert.equal(
        scenario.inputs.some((input) => input.inputType === "REWARD_SELECTED"),
        false,
        `${scenario.scenario} must not queue reward inputs`,
      );
      assert.equal(scenario.invariantChecks?.noMonetizationInputs, true, `${scenario.scenario} invariants must exclude monetization inputs`);
      assert.equal(scenario.rewardSelections?.length ?? 0, 0);
      assert.equal(
        scenario.writes.every((write) => write.acceptedExtract),
        true,
        `${scenario.scenario} writes must be accepted writes only`,
      );
    }
  } finally {
    await cleanup();
  }
});

test("Stage 1b persistence payload generation is in-memory and side-effect free", () => {
  const first = runPersistenceScript();
  const second = runPersistenceScript();
  assert.equal(first.raw.equals(second.raw), true);
  assert.equal(first.payload.invariants?.replayMatches, true);
});
test("Stage 1b persistence exporter exercises the real CLI and fails closed on missing or tampered inputs", () => {
  const savedOutput = existsSync(persistenceOutput) ? readFileSync(persistenceOutput) : null;
  const savedReceipt = existsSync(persistenceReceipt) ? readFileSync(persistenceReceipt) : null;
  const run = (...args) => spawnSync(process.execPath, [persistenceExporter, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const canonicalArgs = [
    "--output",
    "qa/evidence/gates/G7/stage1b-persistence-scenarios.json",
    "--source-revision",
    "stage1b-cli-test-revision",
  ];
  try {
    let result = run(...canonicalArgs);
    assert.equal(result.status, 0, `real exporter must succeed: ${result.stderr}`);
    result = run(...canonicalArgs, "--check");
    assert.equal(result.status, 0, `real exporter --check must succeed: ${result.stderr}`);

    const outputBeforeTamper = readFileSync(persistenceOutput, "utf8");
    writeFileSync(persistenceOutput, `${outputBeforeTamper}tampered`, "utf8");
    result = run(...canonicalArgs, "--check");
    assert.notEqual(result.status, 0, "tampered persistence output must fail closed");
    writeFileSync(persistenceOutput, outputBeforeTamper, "utf8");

    const receiptBeforeTamper = JSON.parse(readFileSync(persistenceReceipt, "utf8"));
    receiptBeforeTamper.sourceRevision = "tampered-source-revision";
    writeFileSync(persistenceReceipt, `${JSON.stringify(receiptBeforeTamper, null, 2)}\n`, "utf8");
    result = run(...canonicalArgs, "--check");
    assert.notEqual(result.status, 0, "tampered persistence receipt must fail closed");

    result = run(
      "--output",
      "qa/evidence/gates/G7/stage1b-persistence-scenarios.json",
    );
    assert.notEqual(result.status, 0, "missing --source-revision must fail closed");
  } finally {
    if (savedOutput === null) unlinkSync(persistenceOutput);
    else writeFileSync(persistenceOutput, savedOutput);
    if (savedReceipt === null) unlinkSync(persistenceReceipt);
    else writeFileSync(persistenceReceipt, savedReceipt);
  }
});
