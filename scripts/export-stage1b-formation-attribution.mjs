#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalStringify } from "../g2-full-route-runner.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_RELATIVE = "qa/evidence/gates/G3/stage1b-formation-attribution.json";
const RECEIPT_RELATIVE = "qa/evidence/gates/G3/stage1b-formation-attribution.json.receipt.json";
const GENERATOR_RELATIVE = "qa/evidence/gates/G3/.stage1b-formation-attribution-generator.json";
const OUTPUT_PATH = resolve(REPOSITORY_ROOT, OUTPUT_RELATIVE);
const RECEIPT_PATH = resolve(REPOSITORY_ROOT, RECEIPT_RELATIVE);
const GENERATOR_PATH = resolve(REPOSITORY_ROOT, GENERATOR_RELATIVE);
const SEED_ANCHORS = [401];

function canonicalBytes(value) {
  return `${canonicalStringify(value)}\n`;
}

function hash(raw) {
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

function fail(message) {
  throw new Error(`stage1b-formation-attribution: ${message}`);
}

function parseArgs(argv) {
  const result = {
    output: OUTPUT_PATH,
    sourceRevision: null,
    seeds: [...SEED_ANCHORS],
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--output" || flag === "--source-revision" || flag === "--seeds") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
      if (flag === "--output") result.output = resolve(value);
      else if (flag === "--source-revision") result.sourceRevision = value;
      else result.seeds = value.split(",").map((entry) => Number(entry.trim()));
      index += 1;
      continue;
    }
    if (flag === "--check") {
      result.check = true;
      continue;
    }
    fail(`unknown argument ${flag}`);
  }
  if (result.output !== OUTPUT_PATH) fail(`--output must use ${OUTPUT_RELATIVE}`);
  if (!result.seeds.length || result.seeds.some((seed) => !Number.isInteger(seed) || seed < 0)) fail("--seeds must contain integer seed anchors");
  if (!result.sourceRevision) fail("--source-revision is required");
  return result;
}

function inputPaths() {
  return [
    "scripts/export-stage1b-formation-attribution.mjs",
    "scripts/run-g3-stance-events.mjs",
    "defense-run-simulation.js",
    "defense-catalog.js",
    "rpg-catalog.js",
    "_workspace/archive/20260726-stage1b-cinder-pressure-agency/engineering/instrumentation-contract.md",
  ];
}

function inputDigests() {
  return Object.fromEntries(inputPaths().sort().map((relativePath) => {
    const raw = readFileSync(resolve(REPOSITORY_ROOT, relativePath));
    return [relativePath, hash(raw)];
  }));
}

function generate(seeds) {
  mkdirSync(dirname(GENERATOR_PATH), { recursive: true });
  try {
    execFileSync(process.execPath, [
      resolve(REPOSITORY_ROOT, "scripts/run-g3-stance-events.mjs"),
      "--output",
      GENERATOR_PATH,
      "--seeds",
      seeds.join(","),
    ], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      timeout: 1_800_000,
    });
    return JSON.parse(readFileSync(GENERATOR_PATH, "utf8"));
  } catch (error) {
    fail(error?.message ?? String(error));
  } finally {
    rmSync(GENERATOR_PATH, { force: true });
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`);
  }
}

function receiptFor(sourceRevision, outputBytes, digests) {
  return {
    schemaVersion: 1,
    artifactPath: OUTPUT_RELATIVE,
    sourceRevision,
    inputDigests: digests,
    outputSha256: hash(outputBytes),
    outputByteLength: Buffer.byteLength(outputBytes, "utf8"),
    command: [
      "node",
      "scripts/export-stage1b-formation-attribution.mjs",
      "--output",
      OUTPUT_RELATIVE,
      "--source-revision",
      sourceRevision,
    ],
  };
}

function check(options) {
  const existing = readFileSync(OUTPUT_PATH, "utf8");
  JSON.parse(existing);
  const receipt = readJson(RECEIPT_PATH);
  const digests = inputDigests();
  if (receipt.schemaVersion !== 1 || receipt.artifactPath !== OUTPUT_RELATIVE || receipt.sourceRevision !== options.sourceRevision) fail("--check receipt metadata mismatch");
  if (JSON.stringify(receipt.inputDigests) !== JSON.stringify(digests)) fail("--check input digest mismatch");
  if (receipt.outputSha256 !== hash(existing)) fail("--check output digest mismatch");
  if (receipt.outputByteLength !== Buffer.byteLength(existing, "utf8")) fail("--check output byte length mismatch");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.check) {
    check(options);
    return;
  }
  const payload = generate(options.seeds);
  const outputBytes = canonicalBytes(payload);
  const digests = inputDigests();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, outputBytes, "utf8");
  writeFileSync(RECEIPT_PATH, canonicalBytes(receiptFor(options.sourceRevision, outputBytes, digests)), "utf8");
  process.stdout.write(`stage1b-formation-attribution: wrote ${OUTPUT_RELATIVE}\n`);
}

main();
