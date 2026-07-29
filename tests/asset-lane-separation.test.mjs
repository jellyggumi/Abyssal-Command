import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
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

test("repository baseline excludes Git-ignored lane files while fixture roots still inspect them", async () => {
  const relativeIgnoredPath = join(
    "assets",
    "images",
    "battle",
    "glb",
    ".staging",
    `concept-ignored-${process.pid}.glb`,
  );
  const repositoryIgnoredFile = join(repositoryRoot, relativeIgnoredPath);
  const fixtureRoot = await mkdtemp(join(tmpdir(), "asset-lane-ignored-file-"));
  const fixtureIgnoredFile = join(fixtureRoot, relativeIgnoredPath);
  try {
    await writeFixture(repositoryIgnoredFile, "ignored concept fixture");
    const ignoreCheck = spawnSync("git", ["check-ignore", "--quiet", "--", relativeIgnoredPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(ignoreCheck.error, undefined, ignoreCheck.error?.message);
    assert.equal(ignoreCheck.status, 0, `${relativeIgnoredPath} must be ignored by Git`);

    const repositoryReport = parseJsonOutput(
      runPython("scripts/validate-asset-lanes.py", ["--json", "--allow-missing-candidates"]),
    );
    assert.equal(repositoryReport.ok, true);
    assert.deepEqual(repositoryReport.violations, []);

    await writeFixture(fixtureIgnoredFile, "fixture-root concept material");
    const fixtureResult = runPython(
      "scripts/validate-asset-lanes.py",
      ["--json", "--allow-missing-candidates", fixtureRoot],
    );
    assert.equal(fixtureResult.status, 1, fixtureResult.stderr);
    const fixtureReport = JSON.parse(fixtureResult.stdout);
    assert.equal(fixtureReport.ok, false);
    assert.equal(fixtureReport.filesScanned, 1);
    assert.equal(fixtureReport.violationCount, 1);
    assert.ok(
      fixtureReport.violations.some(
        (item) => item.code === "runtime_concept_asset"
          && item.path === relativeIgnoredPath,
      ),
    );
  } finally {
    await rm(repositoryIgnoredFile, { force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("repository baseline includes and rejects a non-ignored untracked concept asset", async () => {
  const relativeConceptPath = join(
    "assets",
    "images",
    "battle",
    "glb",
    `concept-untracked-${process.pid}.glb`,
  );
  const repositoryConceptFile = join(repositoryRoot, relativeConceptPath);
  try {
    await writeFixture(repositoryConceptFile, "untracked concept fixture");

    const ignoreCheck = spawnSync("git", ["check-ignore", "--quiet", "--", relativeConceptPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(ignoreCheck.error, undefined, ignoreCheck.error?.message);
    assert.equal(ignoreCheck.status, 1, `${relativeConceptPath} must not be ignored by Git`);

    const untrackedCheck = spawnSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "--", relativeConceptPath],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(untrackedCheck.error, undefined, untrackedCheck.error?.message);
    assert.equal(untrackedCheck.status, 0, untrackedCheck.stderr);
    assert.equal(untrackedCheck.stdout.trim(), relativeConceptPath);

    const result = runPython(
      "scripts/validate-asset-lanes.py",
      ["--json", "--allow-missing-candidates"],
    );
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);

    assert.equal(report.ok, false);
    assert.equal(report.violationCount, 1);
    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].code, "runtime_concept_asset");
    assert.equal(report.violations[0].path, relativeConceptPath);
  } finally {
    await rm(repositoryConceptFile, { force: true });
  }
});

test("repository enumeration failure emits structured JSON without a traceback", async () => {
  const emptyPath = await mkdtemp(join(tmpdir(), "asset-lane-empty-path-"));
  try {
    const interpreterProbe = runPython("-c", ["import sys; print(sys.executable)"]);
    assert.equal(interpreterProbe.error, undefined, interpreterProbe.error?.message);
    assert.equal(interpreterProbe.status, 0, interpreterProbe.stderr);
    const absolutePython = interpreterProbe.stdout.trim();
    assert.ok(absolutePython);

    const result = spawnSync(
      absolutePython,
      ["scripts/validate-asset-lanes.py", "--json", "--allow-missing-candidates"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { ...process.env, PATH: emptyPath },
      },
    );
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /Traceback/);

    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(report.roots, [repositoryRoot]);
    assert.deepEqual(report.lanes, { concept: 0, runtime: 0, candidate: 0 });
    assert.equal(report.filesScanned, 0);
    assert.equal(report.violationCount, 1);
    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].code, "scan_failed");
    assert.equal(report.violations[0].path, repositoryRoot);
    assert.equal(typeof report.violations[0].message, "string");
    assert.ok(report.violations[0].message.startsWith("repository Git enumeration failed: "));
  } finally {
    await rm(emptyPath, { recursive: true, force: true });
  }
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
      "_workspace/current/engineering/asset-pipeline/runtime-candidates/dusk-warden.glb",
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
    const conceptInputs = [
      join(fixtureRoot, "dusk-warden-idle-gti.png"),
      join(fixtureRoot, "dusk-warden-idle-gti-refstyle.png"),
      join(fixtureRoot, "dusk-warden-cartoon-albedo.png"),
    ];
    for (const input of conceptInputs) {
      await writeFixture(input, "concept fixture");
      await writeFile(
        input.replace(/\.png$/, ".provenance.json"),
        JSON.stringify({ runtimeEligible: false }),
      );
    }
    const resolvedConceptInputs = await Promise.all(conceptInputs.map((input) => realpath(input)));
    const result = runPython("scripts/build-motion-prompt-batch.py", [
      "--asset-id",
      "dusk-warden",
      "--out",
      output,
      ...conceptInputs.flatMap((input) => ["--concept-input", input]),
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
    assert.deepEqual(packet.sourceInputs, [
      ...resolvedConceptInputs,
      "_workspace/current/engineering/asset-pipeline/action-pipeline.json",
    ]);
    assert.deepEqual(
      packet.sourceInputRecords.map(({ path }) => path),
      packet.sourceInputs,
    );
    assert.ok(packet.sourceInputRecords.slice(0, -1).every(
      ({ runtimeEligible, lane }) => runtimeEligible === false && lane === "concept/reference",
    ));
    assert.equal(packet.runtimeHandoff.runtimeEligible, false);
    assert.equal(packet.candidateArtifacts.runtimeEligible, false);
    assert.equal(packet.candidateArtifacts.shipped, false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("motion prompt batch rejects missing or runtime-eligible concept provenance", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "motion-prompt-provenance-"));
  try {
    const conceptInput = join(fixtureRoot, "concept.png");
    const output = join(fixtureRoot, "motion-prompts.json");
    await writeFixture(conceptInput, "concept fixture");

    const args = [
      "--asset-id",
      "dusk-warden",
      "--out",
      output,
      "--concept-input",
      conceptInput,
    ];
    const missingSidecar = runPython("scripts/build-motion-prompt-batch.py", args);
    assert.equal(missingSidecar.status, 2);
    assert.match(missingSidecar.stderr, /missing concept provenance sidecar/u);
    assert.equal(existsSync(output), false);

    await writeFile(
      conceptInput.replace(/\.png$/, ".provenance.json"),
      JSON.stringify({ runtimeEligible: true }),
    );
    const runtimeEligible = runPython("scripts/build-motion-prompt-batch.py", args);
    assert.equal(runtimeEligible.status, 2);
    assert.match(runtimeEligible.stderr, /not explicitly runtimeEligible=false/u);
    assert.equal(existsSync(output), false);
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
