import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(repositoryRoot, "scripts/rig-character-asset-blender.py");
const python = process.env.PYTHON ?? "python3";

const parseArmFit = `
import importlib.util
import sys

spec = importlib.util.spec_from_file_location("rig_character_asset_blender", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
argv = ["blender", "--background", "--", *sys.argv[2:]]
args = module.parse_args(module.script_args(argv))
print(args.arm_fit)
`;

function runArmFit(value) {
  return spawnSync(python, [
    "-c",
    parseArmFit,
    scriptPath,
    "--glb", "source.glb",
    "--asset-id", "player-core",
    "--category", "commander",
    "--out", "rigged.glb",
    "--arm-fit", value,
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

test("rig CLI accepts an already-T-posed source fit", () => {
  const result = runArmFit("tpose");

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "tpose");
});

test("rig CLI rejects an unknown arm fit before rigging", () => {
  const result = runArmFit("sideways");

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /argument --arm-fit: invalid choice: 'sideways'/);
});
