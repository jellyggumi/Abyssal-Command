#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalStringify } from "../g2-full-route-runner.js";
import { runG2AdversarialTape } from "../g2-adversarial-tape-runner.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_PATH = resolve(REPOSITORY_ROOT, "qa/fixtures/g2-adversarial-tape-fixture-v1.json");
const OUTPUT_PATH = resolve(REPOSITORY_ROOT, "qa/evidence/gates/G2/g2-adversarial-tape-evidence.json");
const RECEIPT_PATH = resolve(REPOSITORY_ROOT, "qa/evidence/gates/G2/g2-adversarial-tape-evidence.receipt.json");
const FIXTURE_RECEIPT_PATH = resolve(REPOSITORY_ROOT, "qa/evidence/gates/G2/g2-adversarial-tape-fixture.receipt.json");

const FIXTURE_EXPECTED_LENGTH = 53146;
const FIXTURE_EXPECTED_RAW_SHA = "sha256:8869964ba710ba09be1784650d71e875f5d7c8094971236e152bc719a2daa2f9";
const FIXTURE_EXPECTED_BLOB_SHA = "3bcf35a0be2777b2156f736f7753683c15c6541c";
const RECEIPT_SCHEMA_VERSION = "g2-adversarial-tape-evidence-receipt/1";

const RECEIPT_PATH_RELATIVE = "qa/evidence/gates/G2/g2-adversarial-tape-evidence.receipt.json";
const OUTPUT_PATH_RELATIVE = "qa/evidence/gates/G2/g2-adversarial-tape-evidence.json";
const FIXTURE_PATH_RELATIVE = "qa/fixtures/g2-adversarial-tape-fixture-v1.json";
const FIXTURE_RECEIPT_PATH_RELATIVE = "qa/evidence/gates/G2/g2-adversarial-tape-fixture.receipt.json";
const INPUT_PATHS = Object.freeze([
  "scripts/run-g2-adversarial-tape.mjs",
  "g2-adversarial-tape-runner.js",
  "g2-full-route-runner.js",
  "defense-run-simulation.js",
  "defense-catalog.js",
  "rpg-catalog.js",
  FIXTURE_PATH_RELATIVE,
]);

function fail(code, message, details = {}) {
  const error = new Error(`g2-adversarial-tape: ${message}`);
  error.code = code;
  error.details = details;
  return error;
}

function hashBytes(raw) {
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

function canonicalBytes(value) {
  return `${canonicalStringify(value)}\n`;
}

function readTextFromPath(path) {
  return readFile(path, "utf8");
}

function usage() {
  return "Usage: node scripts/run-g2-adversarial-tape.mjs --fixture qa/fixtures/g2-adversarial-tape-fixture-v1.json --output qa/evidence/gates/G2/g2-adversarial-tape-evidence.json --source-revision <revision> [--check]";
}

function parseArguments(argv) {
  const parsed = {
    fixture: FIXTURE_PATH,
    output: OUTPUT_PATH,
    sourceRevision: null,
    check: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--fixture" || flag === "--output" || flag === "--source-revision") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${usage()}: ${flag} requires a value`);
      }
      if (flag === "--fixture") parsed.fixture = resolve(value);
      else if (flag === "--output") parsed.output = resolve(value);
      else parsed.sourceRevision = value;
      index += 1;
      continue;
    }
    if (flag === "--check") {
      parsed.check = true;
      continue;
    }
    throw new Error(`${usage()}\nUnknown argument: ${flag}`);
  }

  if (!parsed.sourceRevision) throw new Error(`${usage()}: --source-revision is required`);
  if (parsed.fixture !== FIXTURE_PATH) throw new Error(`${usage()}: --fixture must use ${FIXTURE_PATH_RELATIVE}`);
  if (parsed.output !== OUTPUT_PATH) throw new Error(`${usage()}: --output must use ${OUTPUT_PATH_RELATIVE}`);
  return parsed;
}

async function assertFixtureIntegrity() {
  let raw;
  try {
    raw = await readFile(FIXTURE_PATH);
  } catch (error) {
    const wrapped = fail("FAIL_FIXTURE_MISSING", `Unable to read fixture from ${FIXTURE_PATH}`, { path: FIXTURE_PATH, cause: error?.message ?? String(error) });
    throw wrapped;
  }
  if (raw.length !== FIXTURE_EXPECTED_LENGTH) {
    throw fail("FAIL_FIXTURE_LENGTH", "Signed fixture byte length does not match the immutable artifact", {
      expected: FIXTURE_EXPECTED_LENGTH,
      actual: raw.length,
      path: FIXTURE_PATH,
    });
  }
  const rawSha256 = hashBytes(raw);
  if (rawSha256 !== FIXTURE_EXPECTED_RAW_SHA) {
    throw fail("FAIL_FIXTURE_RAW_SHA256", "Signed fixture raw digest is not the immutable canonical hash", {
      expected: FIXTURE_EXPECTED_RAW_SHA,
      actual: rawSha256,
      path: FIXTURE_PATH,
    });
  }

  let blobSha1;
  try {
    blobSha1 = execFileSync("git", ["hash-object", FIXTURE_PATH_RELATIVE], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw fail("FAIL_FIXTURE_BLOB_HASH", "Unable to verify signed fixture blob hash", {
      path: FIXTURE_PATH,
      cause: error?.message ?? String(error),
    });
  }
  if (blobSha1 !== FIXTURE_EXPECTED_BLOB_SHA) {
    throw fail("FAIL_FIXTURE_BLOB_SHA", "Signed fixture blob digest is not the immutable canonical hash", {
      expected: FIXTURE_EXPECTED_BLOB_SHA,
      actual: blobSha1,
      path: FIXTURE_PATH,
    });
  }

  try {
    return { raw, fixture: JSON.parse(raw.toString("utf8")) };
  } catch (error) {
    throw fail("FAIL_FIXTURE_JSON", `Unable to parse fixture ${FIXTURE_PATH}: ${error.message}`, { path: FIXTURE_PATH });
  }
}


function fixtureExpectedMetadata() {
  return {
    path: FIXTURE_PATH_RELATIVE,
    rawByteLength: FIXTURE_EXPECTED_LENGTH,
    rawSha256: FIXTURE_EXPECTED_RAW_SHA,
    blobSha1: FIXTURE_EXPECTED_BLOB_SHA,
  };
}

function readSourcePaths() {
  return Object.fromEntries(INPUT_PATHS.map((relativePath) => [relativePath, resolve(REPOSITORY_ROOT, relativePath)]));
}

async function computeInputDigests() {
  const paths = readSourcePaths();
  const entries = [];

  for (const [relativePath, absolutePath] of Object.entries(paths)) {
    let raw;
    try {
      raw = await readFile(absolutePath);
    } catch (error) {
      throw fail("FAIL_INPUT_DIGEST", "Unable to read a signed source dependency", {
        path: relativePath,
        cause: error?.message ?? String(error),
      });
    }
    entries.push([relativePath, hashBytes(raw)]);
  }

  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function compareInputDigests(expected, actual) {
  const expectedKeys = Object.keys(expected || {}).sort();
  const actualKeys = Object.keys(actual || {}).sort();
  if (expectedKeys.length !== actualKeys.length) {
    throw fail("FAIL_INPUT_DIGEST", "Source dependency digest keys changed", {
      expectedKeys,
      actualKeys,
    });
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(actual, key)) {
      throw fail("FAIL_INPUT_DIGEST", `Missing source digest for ${key}`, { missing: key, actualKeys });
    }
    if (actual[key] !== expected[key]) {
      throw fail("FAIL_INPUT_DIGEST", `Source digest mismatch for ${key}`, {
        path: key,
        expected: expected[key],
        actual: actual[key],
      });
    }
  }
}

function buildReceipt({ sourceRevision, inputDigests, outputBytes }) {
  return {
    schemaVersion: 1,
    artifactPath: OUTPUT_PATH_RELATIVE,
    sourceRevision,
    inputDigests,
    outputSha256: outputBytes.sha256,
    outputByteLength: outputBytes.byteLength,
    command: [
      "node",
      "scripts/run-g2-adversarial-tape.mjs",
      "--fixture",
      FIXTURE_PATH_RELATIVE,
      "--output",
      OUTPUT_PATH_RELATIVE,
      "--source-revision",
      sourceRevision,
    ],
    schema_version: RECEIPT_SCHEMA_VERSION,
    lane: "g2-adversarial-tape",
    fixture: fixtureExpectedMetadata(),
    outputBytes,
    outputPath: OUTPUT_PATH_RELATIVE,
    receiptPath: RECEIPT_PATH_RELATIVE,
  };
}

function outputMetadata(rawOutput) {
  const canonical = canonicalBytes(rawOutput);
  return {
    path: OUTPUT_PATH_RELATIVE,
    byteLength: Buffer.byteLength(canonical, "utf8"),
    sha256: hashBytes(Buffer.from(canonical, "utf8")),
  };
}

function validateOutputBytes(receipt, outputRaw) {
  if (!receipt || !receipt.outputBytes || typeof receipt.outputBytes !== "object") {
    throw fail("FAIL_OUTPUT_BYTES", "Receipt output bytes metadata is missing or malformed");
  }
  if (receipt.outputBytes.path !== OUTPUT_PATH_RELATIVE) {
    throw fail("FAIL_OUTPUT_BYTES", "Receipt output path does not target the fixed adversarial evidence output", {
      expected: OUTPUT_PATH_RELATIVE,
      actual: receipt.outputBytes.path,
    });
  }
  if (!Number.isInteger(receipt.outputBytes.byteLength) || receipt.outputBytes.byteLength < 0) {
    throw fail("FAIL_OUTPUT_BYTES", "Receipt output byte length is invalid", { byteLength: receipt.outputBytes.byteLength });
  }
  if (typeof receipt.outputBytes.sha256 !== "string" || !receipt.outputBytes.sha256.startsWith("sha256:")) {
    throw fail("FAIL_OUTPUT_BYTES", "Receipt output digest is invalid", { sha256: receipt.outputBytes.sha256 });
  }
  const actualDigest = hashBytes(Buffer.from(outputRaw, "utf8"));
  const actualLength = Buffer.byteLength(outputRaw, "utf8");
  if (actualLength !== receipt.outputBytes.byteLength || actualDigest !== receipt.outputBytes.sha256) {
    throw fail("FAIL_OUTPUT_BYTES", "Output bytes are not equal to receipt-embedded bytes", {
      expectedLength: receipt.outputBytes.byteLength,
      actualLength,
      expectedDigest: receipt.outputBytes.sha256,
      actualDigest,
    });
  }
}

async function runCheck(sourceRevision) {
  let receiptRaw;
  try {
    receiptRaw = await readTextFromPath(RECEIPT_PATH);
  } catch (error) {
    throw fail("FAIL_RECEIPT_READ", "Receipt file is missing for check mode", { path: RECEIPT_PATH, cause: error?.message ?? String(error) });
  }
  let receipt;
  try {
    receipt = JSON.parse(receiptRaw);
  } catch (error) {
    throw fail("FAIL_RECEIPT_JSON", `Unable to parse receipt ${RECEIPT_PATH}: ${error.message}`, { path: RECEIPT_PATH });
  }
  if (receipt.schemaVersion !== 1) {
    throw fail("FAIL_RECEIPT_SCHEMA", "Receipt schemaVersion is not the canonical numeric schema version", {
      expected: 1,
      actual: receipt.schemaVersion,
    });
  }
  if (receipt.schema_version !== RECEIPT_SCHEMA_VERSION) {
    throw fail("FAIL_RECEIPT_SCHEMA", "Receipt schema version is not the fixed adversarial-receipt version", {
      expected: RECEIPT_SCHEMA_VERSION,
      actual: receipt.schema_version,
    });
  }
  if (receipt.sourceRevision !== sourceRevision) {
    throw fail("FAIL_SOURCE_REVISION", "Receipt sourceRevision does not match the caller supplied source revision", {
      expected: sourceRevision,
      actual: receipt.sourceRevision,
    });
  }

  const actualInputDigests = await computeInputDigests();
  compareInputDigests(receipt.inputDigests, actualInputDigests);
  await assertFixtureIntegrity();

  let outputRaw;
  try {
    outputRaw = await readTextFromPath(OUTPUT_PATH);
  } catch (error) {
    throw fail("FAIL_OUTPUT_MISSING", "Output evidence file is missing for check mode", {
      path: OUTPUT_PATH,
      cause: error?.message ?? String(error),
    });
  }
  validateOutputBytes(receipt, outputRaw);
  let fixtureReceiptRaw;
  try {
    fixtureReceiptRaw = await readTextFromPath(FIXTURE_RECEIPT_PATH);
  } catch (error) {
    throw fail("FAIL_FIXTURE_RECEIPT_READ", "Fixture receipt is missing for check mode", { path: FIXTURE_RECEIPT_PATH, cause: error?.message ?? String(error) });
  }
  let fixtureReceipt;
  try {
    fixtureReceipt = JSON.parse(fixtureReceiptRaw);
  } catch (error) {
    throw fail("FAIL_FIXTURE_RECEIPT_JSON", `Unable to parse fixture receipt ${FIXTURE_RECEIPT_PATH}: ${error.message}`, { path: FIXTURE_RECEIPT_PATH });
  }
  if (fixtureReceipt.sourceRevision !== sourceRevision
    || fixtureReceipt.artifactPath !== FIXTURE_PATH_RELATIVE
    || fixtureReceipt.outputSha256 !== FIXTURE_EXPECTED_RAW_SHA
    || fixtureReceipt.outputByteLength !== FIXTURE_EXPECTED_LENGTH) {
    throw fail("FAIL_FIXTURE_RECEIPT_BYTES", "Fixture receipt does not match the signed fixture bytes");
  }
}

async function runMeasurement(sourceRevision) {
  const { fixture } = await assertFixtureIntegrity();
  const inputDigests = await computeInputDigests();
  const evidence = runG2AdversarialTape(fixture);
  const evidenceBytes = canonicalBytes(evidence);
  const outputRecord = outputMetadata(evidence);
  const receipt = buildReceipt({ sourceRevision, inputDigests, outputBytes: outputRecord });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, evidenceBytes, "utf8");
  await writeFile(RECEIPT_PATH, canonicalBytes(receipt), "utf8");
  await writeFile(FIXTURE_RECEIPT_PATH, canonicalBytes({
    schemaVersion: 1,
    artifactPath: FIXTURE_PATH_RELATIVE,
    sourceRevision,
    inputDigests,
    outputSha256: FIXTURE_EXPECTED_RAW_SHA,
    outputByteLength: FIXTURE_EXPECTED_LENGTH,
    command: [
      "node",
      "scripts/run-g2-adversarial-tape.mjs",
      "--fixture",
      FIXTURE_PATH_RELATIVE,
      "--output",
      OUTPUT_PATH_RELATIVE,
      "--source-revision",
      sourceRevision,
    ],
  }), "utf8");

  return { outputBytes: evidenceBytes, receiptBytes: canonicalBytes(receipt) };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.check) {
    await runCheck(options.sourceRevision);
    return;
  }

  await runMeasurement(options.sourceRevision);
}

main().catch((error) => {
  const code = error?.code ? `[${error.code}] ` : "";
  process.stderr.write(`${code}${error?.message || String(error)}\n`);
  process.exitCode = 1;
});
