#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runG2FullRoute, toJsonLines } from "../g2-full-route-runner.js";

const OPTION_NAMES = new Set([
  "--register-root",
  "--seed-register",
  "--input-tape-register",
  "--expected-tuples",
  "--admission-manifest",
  "--output",
]);

export function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!OPTION_NAMES.has(option) || value === undefined || value.startsWith("--") || options[option] !== undefined) {
      throw new Error("Usage: node scripts/run-g2-full-route.mjs --register-root <workspace> --output <jsonl> [--seed-register <canonical-path>] [--input-tape-register <canonical-path>] [--expected-tuples <canonical-path>] [--admission-manifest <signed-path>]");
    }
    options[option] = value;
  }

  if (!options["--register-root"] || !options["--output"]) {
    throw new Error("Usage: node scripts/run-g2-full-route.mjs --register-root <workspace> --output <jsonl> [--seed-register <canonical-path>] [--input-tape-register <canonical-path>] [--expected-tuples <canonical-path>] [--admission-manifest <signed-path>]");
  }

  return {
    registerRoot: options["--register-root"],
    seedRegister: options["--seed-register"],
    inputTapeRegister: options["--input-tape-register"],
    expectedTuples: options["--expected-tuples"],
    admissionManifest: options["--admission-manifest"],
    output: options["--output"],
  };
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  const result = await runG2FullRoute(options);
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, toJsonLines(result.records), "utf8");
  process.exitCode = result.failed ? 1 : 0;
}

main().catch((error) => {
  console.error(`${error.code ?? "FAIL_G2_RUNNER"}: ${error.message}`);
  process.exitCode = 2;
});
