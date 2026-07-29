#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPayload } from "./run-stage1b-persistence-scenarios.mjs";
import { canonicalStringify } from "../g2-full-route-runner.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_RELATIVE = "qa/evidence/gates/G7/stage1b-persistence-scenarios.json";
const RECEIPT_RELATIVE = "qa/evidence/gates/G7/stage1b-persistence-scenarios.json.receipt.json";
const OUTPUT_PATH = resolve(REPOSITORY_ROOT, OUTPUT_RELATIVE);
const RECEIPT_PATH = resolve(REPOSITORY_ROOT, RECEIPT_RELATIVE);
const SEMANTIC_SOURCE_REVISION = "__SOURCE_REVISION__";
const EXPECTED_PAYLOAD_SEMANTIC_SHA256 = "sha256:821366a05d1726fd7370f4106001f2311346a60f68d7e30c3b872c36f22837ea";

function bytes(value) {
  return `${canonicalStringify(value)}\n`;
}

function digest(raw) {
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

function semanticPayloadDigest(payload) {
  return digest(bytes({
    ...payload,
    sourceRevision: SEMANTIC_SOURCE_REVISION,
  }));
}

function assertExpectedPayloadSemantics(payload, operation) {
  const actual = semanticPayloadDigest(payload);
  if (actual !== EXPECTED_PAYLOAD_SEMANTIC_SHA256) {
    fail(`${operation} payload semantic digest mismatch: expected ${EXPECTED_PAYLOAD_SEMANTIC_SHA256}, observed ${actual}`);
  }
}

function fail(message) {
  throw new Error(`stage1b-persistence: ${message}`);
}

function parseArgs(argv) {
  const options = {
    output: OUTPUT_PATH,
    sourceRevision: null,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--output" || flag === "--source-revision") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
      if (flag === "--output") options.output = resolve(value);
      else options.sourceRevision = value;
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
  if (!options.sourceRevision) fail("--source-revision is required");
  return options;
}

function inputDigests() {
  const paths = [
    "scripts/export-stage1b-persistence-scenarios.mjs",
    "scripts/run-stage1b-persistence-scenarios.mjs",
    "campaign-state.js",
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
      "scripts/export-stage1b-persistence-scenarios.mjs",
      "--output",
      OUTPUT_RELATIVE,
      "--source-revision",
      options.sourceRevision,
    ],
  };
}

function makePayload(sourceRevision) {
  return buildPayload(sourceRevision);
}

function check(options) {
  const actualBytes = readFileSync(OUTPUT_PATH, "utf8");
  const payload = JSON.parse(actualBytes);
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, "utf8"));
  const digests = inputDigests();
  if (payload.sourceRevision !== options.sourceRevision) fail("--check output source revision mismatch");
  assertExpectedPayloadSemantics(payload, "--check");
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
  const payload = makePayload(options.sourceRevision);
  assertExpectedPayloadSemantics(payload, "generated");
  const outputBytes = bytes(payload);
  const digests = inputDigests();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, outputBytes, "utf8");
  writeFileSync(RECEIPT_PATH, bytes(receiptFor(options, outputBytes, digests)), "utf8");
  process.stdout.write(`stage1b-persistence: wrote ${OUTPUT_RELATIVE}\n`);
}

main();
