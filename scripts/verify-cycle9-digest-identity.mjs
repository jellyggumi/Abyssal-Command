#!/usr/bin/env node
/**
 * Cycle-9 digest identity gate.
 *
 * Re-runs the exact probe that produced `_workspace/current/qa/cycle9-digest-baseline.json`
 * against the CURRENT source and fails if depth-0 / octant-only byte-identity broke.
 *
 * Why this exists: `getRunSnapshot()` serialises the ENTIRE commander object
 * (`defense-run-simulation.js`, `commander: run.commander`), so any unconditionally-added
 * field enters `getRunDigest()` and silently breaks PR #10's depth-0 identity contract plus
 * every stored replay fixture. Cycle 9 adds `moveAnalog` / `aimX` / `aimY` / corpse state,
 * all of which MUST be conditionally present.
 *
 * Usage:
 *   node scripts/verify-cycle9-digest-identity.mjs
 *   node scripts/verify-cycle9-digest-identity.mjs --json
 *
 * Exit 0 = identity held. Exit 1 = identity broken (or baseline missing/malformed).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  createDefenseRun,
  advanceDefenseRun,
  queueInput,
  getRunDigest,
} from "../defense-run-simulation.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(HERE, "../_workspace/current/qa/cycle9-digest-baseline.json");
const asJson = process.argv.includes("--json");

function loadBaseline() {
  let raw;
  try {
    raw = readFileSync(BASELINE_PATH, "utf8");
  } catch (error) {
    throw new Error(`baseline not readable at ${BASELINE_PATH}: ${error.message}`);
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.baseline) || parsed.baseline.length === 0) {
    throw new Error("baseline.baseline must be a non-empty array");
  }
  if (!Array.isArray(parsed.commanderKeysAtBaseline) || parsed.commanderKeysAtBaseline.length === 0) {
    throw new Error("baseline.commanderKeysAtBaseline must be a non-empty array");
  }
  return parsed;
}

/**
 * Reproduces one baseline row. Uses the LEGACY STRING move payload exclusively —
 * never the `{ octant, analog }` object form — because the whole point is to prove
 * that a run which never supplies analog input serialises exactly as it did before
 * analog existed.
 */
function probe(seed, moveScript, ticksPerMove, stageId, abyssDepth) {
  let run = createDefenseRun({ stageId, seed, abyssDepth });
  for (const move of moveScript) {
    run = queueInput(run, "MOVE", move); // string payload, legacy form
    run = advanceDefenseRun(run, ticksPerMove);
  }
  const digest = getRunDigest(run);
  return {
    tick: run.tick,
    sha256: createHash("sha256").update(digest).digest("hex"),
    bytes: digest.length,
    commanderKeys: Object.keys(JSON.parse(digest).commander).sort(),
  };
}

function main() {
  const baseline = loadBaseline();
  const { moveScript, ticksPerMove, stageId } = baseline.method;
  const expectedKeys = [...baseline.commanderKeysAtBaseline].sort();

  const results = [];
  for (const row of baseline.baseline) {
    const observed = probe(row.seed, moveScript, ticksPerMove, stageId, row.abyssDepth ?? 0);

    const extraKeys = observed.commanderKeys.filter((key) => !expectedKeys.includes(key));
    const missingKeys = expectedKeys.filter((key) => !observed.commanderKeys.includes(key));

    const failures = [];
    if (observed.sha256 !== row.sha256) {
      failures.push(`sha256 mismatch: expected ${row.sha256}, observed ${observed.sha256}`);
    }
    if (observed.bytes !== row.bytes) {
      failures.push(`byte length changed: expected ${row.bytes}, observed ${observed.bytes}`);
    }
    if (observed.tick !== row.tick) {
      failures.push(`tick mismatch: expected ${row.tick}, observed ${observed.tick}`);
    }
    if (extraKeys.length) {
      failures.push(
        `commander gained ${extraKeys.length} field(s) on an octant-only run: ${extraKeys.join(", ")}`
        + " — conditional-presence contract violated (spec defect D4)",
      );
    }
    if (missingKeys.length) {
      failures.push(`commander lost field(s): ${missingKeys.join(", ")}`);
    }

    results.push({ seed: row.seed, abyssDepth: row.abyssDepth ?? 0, ok: failures.length === 0, failures, observed });
  }

  const ok = results.every((entry) => entry.ok);

  if (asJson) {
    console.log(JSON.stringify({
      ok,
      baselinePath: BASELINE_PATH,
      capturedAgainstCommit: baseline.capturedAgainstCommit ?? null,
      results: results.map(({ seed, abyssDepth, ok: rowOk, failures, observed }) => ({
        seed,
        abyssDepth,
        ok: rowOk,
        failures,
        sha256: observed.sha256,
        bytes: observed.bytes,
        commanderKeyCount: observed.commanderKeys.length,
      })),
    }, null, 2));
  } else {
    console.log(`cycle-9 digest identity gate — baseline ${baseline.capturedAgainstCommit ?? "(unknown commit)"}`);
    for (const entry of results) {
      const label = `  seed ${String(entry.seed).padStart(4)} depth ${entry.abyssDepth}`;
      if (entry.ok) {
        console.log(`${label}: OK  sha256 ${entry.observed.sha256.slice(0, 16)}…  ${entry.observed.bytes} bytes  ${entry.observed.commanderKeys.length} commander keys`);
      } else {
        console.log(`${label}: FAIL`);
        for (const failure of entry.failures) console.log(`      - ${failure}`);
      }
    }
    console.log(ok
      ? "\nPASS — depth-0 octant-only byte-identity held."
      : "\nFAIL — identity broken. Fix the implementation; do NOT edit the baseline.");
  }

  process.exit(ok ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error(`cycle-9 digest gate could not run: ${error.message}`);
  process.exit(1);
}
