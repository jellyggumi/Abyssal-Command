#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPayload,
  DEFAULT_SEEDS,
  DEFAULT_STANCES,
} from "./run-stage1b-pressure-packets.mjs";
import { canonicalStringify } from "../g2-full-route-runner.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_RELATIVE = "qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json";
const RECEIPT_RELATIVE = "qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json.receipt.json";
const OUTPUT_PATH = resolve(REPOSITORY_ROOT, OUTPUT_RELATIVE);
const RECEIPT_PATH = resolve(REPOSITORY_ROOT, RECEIPT_RELATIVE);

function bytes(value) {
  return `${canonicalStringify(value)}\n`;
}

function digest(raw) {
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

function fail(message) {
  throw new Error(`stage1b-pressure: ${message}`);
}

function parseArgs(argv) {
  const options = {
    output: OUTPUT_PATH,
    sourceRevision: null,
    seeds: [...DEFAULT_SEEDS],
    stances: [...DEFAULT_STANCES],
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (["--output", "--source-revision", "--seeds", "--stances"].includes(flag)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
      if (flag === "--output") options.output = resolve(value);
      else if (flag === "--source-revision") options.sourceRevision = value;
      else if (flag === "--seeds") options.seeds = value.split(",").map((entry) => Number(entry.trim()));
      else options.stances = value.split(",").map((entry) => entry.trim().toUpperCase());
      index += 1;
      continue;
    }
    if (flag === "--check") {
      options.check = true;
      continue;
    }
    fail(`unknown argument ${flag}`);
  }
  if (options.output !== OUTPUT_PATH) fail(`--output must use ${OUTPUT_RELATIVE}`);
  if (JSON.stringify(options.seeds) !== JSON.stringify(DEFAULT_SEEDS) || JSON.stringify(options.stances) !== JSON.stringify(DEFAULT_STANCES)) {
    fail("canonical exporter requires the exact 15-row population");
  }
  if (!options.sourceRevision) fail("--source-revision is required");
  return options;
}

function inputDigests() {
  const paths = [
    "scripts/export-stage1b-pressure-packets.mjs",
    "scripts/run-stage1b-pressure-packets.mjs",
    "defense-run-simulation.js",
    "defense-catalog.js",
    "rpg-catalog.js",
    "_workspace/archive/20260726-stage1b-cinder-pressure-agency/engineering/instrumentation-contract.md",
  ].sort();
  return Object.fromEntries(paths.map((relativePath) => [
    relativePath,
    digest(readFileSync(resolve(REPOSITORY_ROOT, relativePath))),
  ]));
}

function receiptFor(options, outputBytes, digests) {
  return {
    schemaVersion: 1,
    artifactPath: OUTPUT_RELATIVE,
    sourceRevision: options.sourceRevision,
    inputDigests: digests,
    outputSha256: digest(outputBytes),
    outputByteLength: Buffer.byteLength(outputBytes, "utf8"),
    command: [
      "node",
      "scripts/export-stage1b-pressure-packets.mjs",
      "--output",
      OUTPUT_RELATIVE,
      "--source-revision",
      options.sourceRevision,
    ],
  };
}

function makePayload(options) {
  return buildPayload(options.seeds, options.stances, options.sourceRevision);
}

function check(options) {
  const actualBytes = readFileSync(OUTPUT_PATH, "utf8");
  const payload = JSON.parse(actualBytes);
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, "utf8"));
  const digests = inputDigests();
  if (payload.sourceRevision !== options.sourceRevision) fail("--check output source revision mismatch");
  if (receipt.schemaVersion !== 1 || receipt.artifactPath !== OUTPUT_RELATIVE || receipt.sourceRevision !== options.sourceRevision) fail("--check receipt metadata mismatch");
  if (JSON.stringify(receipt.inputDigests) !== JSON.stringify(digests)) fail("--check input digest mismatch");
  if (receipt.outputSha256 !== digest(actualBytes)) fail("--check output digest mismatch");
  if (receipt.outputByteLength !== Buffer.byteLength(actualBytes, "utf8")) fail("--check output byte length mismatch");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.check) {
    check(options);
    return;
  }
  const outputBytes = bytes(makePayload(options));
  const digests = inputDigests();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, outputBytes, "utf8");
  writeFileSync(RECEIPT_PATH, bytes(receiptFor(options, outputBytes, digests)), "utf8");
  process.stdout.write(`stage1b-pressure: wrote ${OUTPUT_RELATIVE}\n`);
}

main();
