#!/usr/bin/env node
/**
 * Cycle-9 analog-input LIVE gate (positive counterpart to verify-cycle9-digest-identity.mjs).
 *
 * The digest-identity gate is deliberately NEGATIVE: it drives octant-only input and
 * asserts nothing changed. That is necessary but it cannot tell a working analog
 * implementation from one that was never wired — a no-op `moveAnalog` scores a
 * perfect green there.
 *
 * This gate is POSITIVE. It proves the analog vector actually reaches movement.
 *
 * The load-bearing check is A3: the most natural partial implementation accepts the
 * `{ octant, analog }` object payload, stores `analog`, and then still moves via
 * `OCTANT_VECTORS[octant]`. That defect passes "field is present" AND "digest
 * differs" — only a position comparison across deflection magnitudes catches it.
 *
 * Usage:
 *   node scripts/verify-cycle9-analog-live.mjs
 *   node scripts/verify-cycle9-analog-live.mjs --json
 *
 * Exit 0 = analog is live and correct. Exit 1 = analog missing, inert, or wrong.
 */

import { createHash } from "node:crypto";

import {
  createDefenseRun,
  advanceDefenseRun,
  queueInput,
  getRunDigest,
  getRunSnapshot,
} from "../defense-run-simulation.js";

const asJson = process.argv.includes("--json");
const STAGE_ID = "cinder-span";
const SEED = 17;
const TICKS = 60;

const sha = (value) => createHash("sha256").update(value).digest("hex");

/** Drives `payload` for `ticks`, then reports the commander's end state. */
function drive(payload, ticks = TICKS, seed = SEED) {
  let run = createDefenseRun({ stageId: STAGE_ID, seed, abyssDepth: 0 });
  run = queueInput(run, "MOVE", payload);
  run = advanceDefenseRun(run, ticks);
  const snapshot = getRunSnapshot(run);
  const commander = snapshot.commander;
  return {
    x: commander.x,
    y: commander.y,
    keys: Object.keys(commander).sort(),
    hasMoveAnalog: Object.hasOwn(commander, "moveAnalog"),
    digestSha: sha(getRunDigest(run)),
    startedFrom: null,
  };
}

/** Distance travelled from the run's own spawn point, so we compare motion not absolute position. */
function travelled(result, origin) {
  return Math.round(Math.hypot(result.x - origin.x, result.y - origin.y));
}

function main() {
  const checks = [];
  const record = (id, description, ok, detail) => checks.push({ id, description, ok, detail });

  // Spawn origin: zero-input run, so every travel figure below is relative to the real spawn.
  const origin = drive("IDLE");

  // Baseline: legacy octant string, full cardinal east.
  const octantE = drive("E");
  const octantTravel = travelled(octantE, origin);

  // A1 — analog payload is accepted AND surfaces moveAnalog (conditional presence works
  // in the positive direction, not only as absence).
  const analogFull = drive({ octant: "E", analog: { x: 1000, y: 0 } });
  record(
    "A1",
    "object payload { octant, analog } accepted and commander.moveAnalog present",
    analogFull.hasMoveAnalog,
    analogFull.hasMoveAnalog
      ? "moveAnalog present as expected"
      : `moveAnalog ABSENT — analog payload was ignored or dropped. commander keys: ${analogFull.keys.join(", ")}`,
  );

  // A2 — an analog run must not serialise identically to the octant run, otherwise the
  // field never entered state at all.
  record(
    "A2",
    "analog run digest differs from octant-only run digest (same seed)",
    analogFull.digestSha !== octantE.digestSha,
    analogFull.digestSha === octantE.digestSha
      ? `identical digest ${analogFull.digestSha.slice(0, 16)}… — analog left no trace in run state`
      : `octant ${octantE.digestSha.slice(0, 12)}… vs analog ${analogFull.digestSha.slice(0, 12)}…`,
  );

  // A3 — THE LOAD-BEARING CHECK. Deflection magnitude must change distance travelled.
  // If the implementation stores `analog` but still moves via OCTANT_VECTORS[octant],
  // every deflection travels the same distance and A1/A2 still pass.
  const analogHalf = drive({ octant: "E", analog: { x: 500, y: 0 } });
  const analogQuarter = drive({ octant: "E", analog: { x: 250, y: 0 } });
  const fullTravel = travelled(analogFull, origin);
  const halfTravel = travelled(analogHalf, origin);
  const quarterTravel = travelled(analogQuarter, origin);

  const monotonic = fullTravel > halfTravel && halfTravel > quarterTravel;
  record(
    "A3",
    "deflection magnitude scales distance travelled (full > half > quarter)",
    monotonic,
    `full(1000)=${fullTravel}  half(500)=${halfTravel}  quarter(250)=${quarterTravel}`
      + (monotonic
        ? "  — magnitude reaches movement"
        : "  — INERT: analog stored but movement still octant-driven, or clamped"),
  );

  // A4 — full analog deflection should travel about the same as the equivalent octant,
  // confirming analog is a generalisation of the octant table rather than a rescale.
  const fullVsOctant = octantTravel === 0
    ? false
    : Math.abs(fullTravel - octantTravel) / octantTravel <= 0.02;
  record(
    "A4",
    "full analog deflection ≈ equivalent octant distance (within 2%)",
    fullVsOctant,
    `octant E=${octantTravel}  analog(1000,0)=${fullTravel}`,
  );

  // A5 — a sub-dead-zone deflection must not move the commander. Guards the documented
  // 0.22 dead zone and the integer-truncation floor.
  const analogTiny = drive({ octant: "IDLE", analog: { x: 10, y: 0 } });
  const tinyTravel = travelled(analogTiny, origin);
  record(
    "A5",
    "sub-dead-zone deflection (10 millis) produces no travel",
    tinyTravel === 0,
    `travel=${tinyTravel} (expected 0)`,
  );

  // A6 — an off-axis analog heading must be reachable, i.e. not snapped to an octant.
  // 30 degrees is deliberately NOT a multiple of 45.
  const rad = 30 * Math.PI / 180;
  const analogOffAxis = drive({
    octant: "NE",
    analog: { x: Math.round(1000 * Math.cos(rad)), y: -Math.round(1000 * Math.sin(rad)) },
  });
  const analogNe = drive({ octant: "NE", analog: { x: 707, y: -707 } });
  const offAxisDistinct = analogOffAxis.x !== analogNe.x || analogOffAxis.y !== analogNe.y;
  record(
    "A6",
    "off-axis heading (30°) resolves distinctly from the 45° octant",
    offAxisDistinct,
    `30° end=(${analogOffAxis.x},${analogOffAxis.y})  45° end=(${analogNe.x},${analogNe.y})`
      + (offAxisDistinct ? "" : "  — heading was quantised to an octant"),
  );

  const ok = checks.every((entry) => entry.ok);

  if (asJson) {
    console.log(JSON.stringify({ ok, seed: SEED, ticks: TICKS, stageId: STAGE_ID, checks }, null, 2));
  } else {
    console.log(`cycle-9 analog LIVE gate — stage ${STAGE_ID}, seed ${SEED}, ${TICKS} ticks per case`);
    for (const entry of checks) {
      console.log(`  ${entry.id} ${entry.ok ? "OK  " : "FAIL"} ${entry.description}`);
      console.log(`        ${entry.detail}`);
    }
    console.log(ok
      ? "\nPASS — analog input is live: payload accepted, state recorded, magnitude and heading both reach movement."
      : "\nFAIL — analog input is not correctly wired. See failing checks above.");
  }

  process.exit(ok ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error(`cycle-9 analog gate could not run: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
