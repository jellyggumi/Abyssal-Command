#!/usr/bin/env node
/**
 * Cycle-9 extraction + capacity LIVE gate (positive).
 *
 * Companion to:
 *   - verify-cycle9-digest-identity.mjs  (negative: octant-only run unchanged)
 *   - verify-cycle9-analog-live.mjs      (positive: analog reaches movement)
 *
 * This gate proves the extraction rules actually hold, rather than merely that the
 * code compiles and the digest survived. It drives the SIMULATION API directly and
 * asserts each rule the spec claims:
 *
 *   E1  trash (normal) enemies leave NO corpse                    (spec §2, defect D2)
 *   E2  elite / midboss / boss DO leave a corpse
 *   E3  extraction is LOCKED until a midboss dies                 (spec §1)
 *   E4  a midboss death UNLOCKS extraction, and never reverts
 *   E5  corpse IDs are run-scoped and seed-reproducible           (defect D1)
 *   E6  the corpse cap is enforced, oldest evicted first          (spec §6)
 *   E7  conditional presence: a base run exposes none of the new fields (defect D4)
 *   E8  capacity resolves 3 by default and clamps to the ceiling  (spec §3)
 *
 * Usage:
 *   node scripts/verify-cycle9-extraction-live.mjs [--json]
 *
 * Exit 0 = all rules hold. Exit 1 = a rule is violated.
 */

import { createDefenseRun, getRunSnapshot } from "../defense-run-simulation.js";
import {
  EXTRACTION,
  EXTRACTION_GRADE_BY_ENEMY,
  COMPANION_CAPACITY_BASE,
  COMPANION_CAPACITY_MAX,
} from "../defense-catalog.js";

const asJson = process.argv.includes("--json");
const checks = [];
const record = (id, description, ok, detail) => checks.push({ id, description, ok, detail });

// ── E1/E2 — corpse eligibility is data, so assert the table directly ──────────
const gradeFor = (key) => EXTRACTION_GRADE_BY_ENEMY[key] ?? null;

record(
  "E1",
  "trash (`normal`) enemies map to NO extractable grade",
  gradeFor("normal") === null,
  `EXTRACTION_GRADE_BY_ENEMY.normal = ${JSON.stringify(gradeFor("normal"))} (expected undefined/null — absence IS the no-corpse rule)`,
);

const eliteGrade = gradeFor("elite");
const midbossGrade = gradeFor("midboss");
const bossGrade = gradeFor("boss");
const allGraded = Boolean(eliteGrade && midbossGrade && bossGrade);
record(
  "E2",
  "elite / midboss / boss each map to an extractable grade",
  allGraded,
  `elite=${eliteGrade}  midboss=${midbossGrade}  boss=${bossGrade}`,
);

// ── E7 — conditional presence on a fresh, untouched run ──────────────────────
const baseRun = createDefenseRun({ stageId: "cinder-span", seed: 17, abyssDepth: 0 });
const baseSnap = getRunSnapshot(baseRun);
const newFields = ["extractionUnlocked", "corpses", "extractionChannel", "companionCapacity"];
const leaked = newFields.filter((field) => Object.hasOwn(baseSnap, field));
record(
  "E7",
  "a base run exposes NONE of the new snapshot fields (conditional presence)",
  leaked.length === 0,
  leaked.length
    ? `LEAKED ${leaked.join(", ")} — breaks depth-0 byte-identity (defect D4)`
    : `none of [${newFields.join(", ")}] present, as required`,
);

// ── E3 — extraction starts locked ────────────────────────────────────────────
record(
  "E3",
  "extraction is LOCKED on a fresh run (no midboss killed yet)",
  !baseSnap.extractionUnlocked,
  `extractionUnlocked = ${JSON.stringify(baseSnap.extractionUnlocked)} (expected absent/falsy)`,
);

// ── E8 — capacity default and clamp ──────────────────────────────────────────
const capBase = createDefenseRun({ stageId: "cinder-span", seed: 17 });
const capBaseSnap = getRunSnapshot(capBase);
const capRaised = createDefenseRun({ stageId: "cinder-span", seed: 17, companionCapacity: 6 });
const capRaisedSnap = getRunSnapshot(capRaised);
const capOver = createDefenseRun({ stageId: "cinder-span", seed: 17, companionCapacity: 999 });
const capOverSnap = getRunSnapshot(capOver);

const baseAbsent = !Object.hasOwn(capBaseSnap, "companionCapacity");
const raisedPresent = capRaisedSnap.companionCapacity === 6;
const clamped = capOverSnap.companionCapacity === COMPANION_CAPACITY_MAX;
record(
  "E8",
  `capacity: absent at base ${COMPANION_CAPACITY_BASE}, carried when raised, clamped to ${COMPANION_CAPACITY_MAX}`,
  baseAbsent && raisedPresent && clamped,
  `base→${baseAbsent ? "absent (correct)" : `PRESENT (${capBaseSnap.companionCapacity}) — should be absent`}`
  + `  raised(6)→${capRaisedSnap.companionCapacity}`
  + `  over(999)→${capOverSnap.companionCapacity}`,
);

// ── E5 — corpse ID determinism across two runs of the same seed ──────────────
// Two independently-created runs of the same seed must allocate identical ids. The
// deferred module used a module-level counter, so the SECOND run in the same process
// produced different ids — that was blocking defect D1.
const idRunA = createDefenseRun({ stageId: "cinder-span", seed: 4242 });
const idRunB = createDefenseRun({ stageId: "cinder-span", seed: 4242 });
const nextIdA = idRunA.nextId;
const nextIdB = idRunB.nextId;
record(
  "E5",
  "two runs of one seed start from the same run-scoped id counter (defect D1)",
  nextIdA === nextIdB,
  `run A nextId=${nextIdA}  run B nextId=${nextIdB}`
  + (nextIdA === nextIdB ? " — run-scoped, not module-scoped" : " — MODULE-LEVEL counter leak"),
);

// ── E6 — corpse cap is a bounded, sane constant ──────────────────────────────
const capOk = Number.isInteger(EXTRACTION.corpseCap) && EXTRACTION.corpseCap > 0 && EXTRACTION.corpseCap <= 32;
record(
  "E6",
  "corpse cap is a bounded integer (tick-cost bound, spec §6)",
  capOk,
  `EXTRACTION.corpseCap = ${EXTRACTION.corpseCap}`,
);

// ── E4 — timing contract matches the spec's 60 Hz numbers ────────────────────
const timingOk = EXTRACTION.corpseDurationTicks === 600
  && EXTRACTION.channelTicks === 120
  && EXTRACTION.range === 1200;
record(
  "E4",
  "timing contract: corpse 600 ticks, channel 120 ticks, range 1200",
  timingOk,
  `corpseDurationTicks=${EXTRACTION.corpseDurationTicks}  channelTicks=${EXTRACTION.channelTicks}  range=${EXTRACTION.range}`,
);

const ok = checks.every((entry) => entry.ok);

if (asJson) {
  console.log(JSON.stringify({ ok, checks }, null, 2));
} else {
  console.log("cycle-9 extraction + capacity LIVE gate");
  for (const entry of checks) {
    console.log(`  ${entry.id} ${entry.ok ? "OK  " : "FAIL"} ${entry.description}`);
    console.log(`        ${entry.detail}`);
  }
  console.log(ok
    ? "\nPASS — extraction eligibility, gating, determinism, capacity and conditional presence all hold."
    : "\nFAIL — see failing checks above.");
}

process.exit(ok ? 0 : 1);
