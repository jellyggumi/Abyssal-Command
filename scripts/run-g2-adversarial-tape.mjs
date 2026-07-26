#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalStringify } from "../g2-full-route-runner.js";
import { runG2AdversarialTape } from "../g2-adversarial-tape-runner.js";

function usage() {
  return "Usage: node scripts/run-g2-adversarial-tape.mjs --fixture <path> --output <path>";
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== "--fixture" && flag !== "--output") throw new Error(`${usage()}\nUnknown argument: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${usage()}\nMissing value for ${flag}`);
    if (values[flag]) throw new Error(`${usage()}\nDuplicate argument: ${flag}`);
    values[flag] = value;
    index += 1;
  }
  if (!values["--fixture"] || !values["--output"]) throw new Error(`${usage()}\nBoth --fixture and --output are required`);
  return { fixture: resolve(values["--fixture"]), output: resolve(values["--output"]) };
}

async function main() {
  const { fixture: fixturePath, output: outputPath } = parseArguments(process.argv.slice(2));
  let fixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    const wrapped = new Error(`Unable to read fixture ${fixturePath}: ${error.message}`);
    wrapped.code = "FAIL_FIXTURE_READ";
    throw wrapped;
  }
  const evidence = runG2AdversarialTape(fixture);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${canonicalStringify(evidence)}\n`, "utf8");
}

main().catch((error) => {
  const code = error?.code ? `[${error.code}] ` : "";
  process.stderr.write(`${code}${error?.message || String(error)}\n`);
  process.exitCode = 1;
});
