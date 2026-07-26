import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.PYTHON ?? "python3";

function runPython(script, args, options = {}) {
  const result = spawnSync(python, [script, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
  return result;
}

function parseJsonOutput(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

async function writeFixture(path, content = "fixture") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

test("asset lane validator accepts the clean repository baseline with missing candidates allowed", () => {
  const result = runPython("scripts/validate-asset-lanes.py", ["--json", "--allow-missing-candidates"]);
  const report = parseJsonOutput(result);

  assert.equal(report.ok, true);
  assert.equal(report.violationCount, 0);
  assert.deepEqual(report.violations, []);
  assert.ok(report.filesScanned > 0);
});

test("asset lane validator rejects concept material placed under the runtime GLB lane", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "asset-lane-runtime-concept-"));
  try {
    const misplacedConcept = join(fixtureRoot, "assets/images/battle/glb/concept-forbidden.png");
    await writeFixture(misplacedConcept, "not a deployable runtime image");

    const result = runPython("scripts/validate-asset-lanes.py", ["--json", "--allow-missing-candidates", fixtureRoot]);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);

    assert.equal(report.ok, false);
    assert.ok(report.violations.some((item) => item.code === "runtime_concept_asset"));
    assert.ok(report.violations.some((item) => item.path.endsWith("concept-forbidden.png")));
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("asset lane validator rejects a generated candidate without its provenance sidecar", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "asset-lane-candidate-sidecar-"));
  try {
    const candidate = join(
      fixtureRoot,
      "_workspace/20260726-tpose-rig-animation/runtime-candidates/dusk-warden.glb",
    );
    await writeFixture(candidate, "candidate glb bytes");

    const result = runPython("scripts/validate-asset-lanes.py", ["--json", fixtureRoot]);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);

    assert.equal(report.ok, false);
    assert.ok(report.violations.some((item) => item.code === "candidate_sidecar_missing"));
    assert.ok(report.violations.some((item) => item.path.endsWith("dusk-warden.glb")));
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("cartoon texture dry-run reports a candidate that is not runtime eligible", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "cartoon-texture-dry-run-"));
  try {
    const source = join(fixtureRoot, "source.glb");
    const texture = join(fixtureRoot, "concept.png");
    const output = join(fixtureRoot, "candidate.glb");
    const reportPath = join(fixtureRoot, "candidate.json");
    await writeFixture(source, "source glb bytes");
    await writeFixture(texture, "concept texture bytes");
    await writeFile(
      `${texture}.provenance.json`,
      JSON.stringify({
        runtimeEligible: false,
        source: "temporary concept fixture",
        generator: "asset-lane-separation.test.mjs",
        output: "temporary candidate fixture",
        rightsReceipt: "fixture-only",
        runtimeReceipt: "not-promoted",
      }),
    );

    const result = runPython("scripts/apply-cartoon-texture-blender.py", [
      "--glb",
      source,
      "--texture",
      texture,
      "--asset-id",
      "dusk-warden",
      "--out",
      output,
      "--report",
      reportPath,
      "--dry-run",
    ]);
    const stdoutReport = parseJsonOutput(result);
    const writtenReport = JSON.parse(await readFile(reportPath, "utf8"));

    for (const report of [stdoutReport, writtenReport]) {
      assert.equal(report.assetLane, "candidate");
      assert.equal(report.runtimeEligible, false);
      assert.equal(report.dryRun, true);
      assert.equal(report.output.candidate, true);
      assert.equal(report.output.wouldWrite, false);
    }
    assert.equal(existsSync(output), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("motion prompt batch emits the eleven runtime action prompts without a runtime handoff", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "motion-prompt-batch-"));
  try {
    const output = join(fixtureRoot, "dusk-warden-motion-prompts.json");
    const result = runPython("scripts/build-motion-prompt-batch.py", [
      "--asset-id",
      "dusk-warden",
      "--out",
      output,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const packet = JSON.parse(await readFile(output, "utf8"));
    const expectedActions = [
      "idle",
      "move",
      "run",
      "hit",
      "bighit",
      "attack",
      "critical",
      "avoid",
      "defence",
      "die",
      "show",
    ];

    assert.equal(packet.prompts.length, 11);
    assert.deepEqual(packet.prompts.map((prompt) => prompt.action), expectedActions);
    assert.deepEqual(packet.productionContract.actionIds, expectedActions);
    assert.equal(packet.runtimeHandoff.runtimeEligible, false);
    assert.equal(packet.candidateArtifacts.runtimeEligible, false);
    assert.equal(packet.candidateArtifacts.shipped, false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("Rodin static lane planning identifies candidate paths without touching deployed GLBs", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "rodin-static-lane-"));
  try {
    const probe = `
import importlib.util
import json
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("rodin_tpose_regen", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
args = module.parse_args(["--plan-only", "--candidate-root", sys.argv[2], "--concept-root", sys.argv[3]])
lanes = module.lane_paths(args)
print(json.dumps({key: str(value) for key, value in lanes.items()}))
`;
    const result = spawnSync(python, ["-c", probe, join(repositoryRoot, "scripts/rodin-tpose-regen.py"), fixtureRoot, fixtureRoot], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    const lanes = parseJsonOutput(result);
    const deployedRuntime = resolve(repositoryRoot, "assets/images/battle/glb");

    assert.equal(resolve(lanes.candidateRoot), resolve(fixtureRoot));
    assert.equal(resolve(lanes.runtimeRoot), resolve(fixtureRoot));
    assert.notEqual(resolve(lanes.candidateRoot), deployedRuntime);
    assert.notEqual(resolve(lanes.conditionDir), deployedRuntime);
    assert.notEqual(resolve(lanes.conceptInputDir), deployedRuntime);
    assert.equal(existsSync(deployedRuntime), true);
    assert.equal(existsSync(join(deployedRuntime, "__asset_lane_test_should_not_exist__.glb")), false);
    assert.deepEqual(await readdir(fixtureRoot), []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
