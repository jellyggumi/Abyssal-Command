#!/usr/bin/env node
// Arrival-choreography digest baseline.
//
// prompts/approved/11-arrival-choreography.md requires getRunDigest() to be reported
// before and after any change that draws from the seeded RNG. This script is that
// report, so the "before" and "after" runs are provably the same procedure rather than
// two hand-typed loops.
//
// advanceDefenseRun() is IMMUTABLE -- it returns the next run and leaves its argument
// alone. A loop that ignores the return value silently measures tick 0 forever, which
// is exactly the way this measurement gets faked by accident.
//
// Usage:
//   node scripts/qa-arrival-digest-baseline.mjs                     # print the table
//   node scripts/qa-arrival-digest-baseline.mjs --json <path>       # also write JSON
//   node scripts/qa-arrival-digest-baseline.mjs --compare <path>    # diff against a prior JSON
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  createDefenseRun,
  advanceDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

const STAGES = ["cinder-span", "abyss-chancel", "echo-throne"];
const SEEDS = [1, 7, 42];
// Matches WINDOW_TICKS in tests/arrival-choreography-contract.test.mjs. 3600 reaches only ~4
// waves, and a near-player formation additionally needs a wave carrying a player-facing body, so
// the shorter window systematically under-reports the very thing this harness measures.
const TICKS = 9000;

const args = process.argv.slice(2);
const jsonIndex = args.indexOf("--json");
const compareIndex = args.indexOf("--compare");
const JSON_OUT = jsonIndex >= 0 ? args[jsonIndex + 1] : null;
const COMPARE = compareIndex >= 0 ? args[compareIndex + 1] : null;

function sha(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Drives `ticks` ticks, answering every growth offer with its first choice.
 *
 * A bare `advanceDefenseRun(run, ticks)` STOPS at the first growth offer -- around tick 460-830
 * on these stages -- which is BEFORE wave 1 spawns (~980-1050). A digest comparison built on that
 * measures only wave 0 and would report "no change" for an arrival feature it never reached. The
 * offer has to be answered for the window to contain a wave that draws a formation at all.
 *
 * Chains the returned run because advanceDefenseRun does not mutate its argument.
 */
function runTo(stageId, seed, ticks) {
  let run = createDefenseRun({ stageId, seed });
  // Census collected in the SAME pass. A second identical drive doubled an already slow harness
  // for a number the first pass could have produced.
  const census = new Map();
  const seen = new Set();
  for (let step = 0; step < ticks && !isTerminalRun(run); step += 1) {
    const before = getRunSnapshot(run);
    if (before.growthOffer) run = queueInput(run, "SKILL_SELECTED", { skillId: before.growthOffer.choices[0] });
    run = advanceDefenseRun(run, 1);
    for (const event of getRunSnapshot(run).events) {
      // De-duped by entity: while a growth offer holds the run, the same spawn event stays on the
      // snapshot across iterations and would be counted repeatedly.
      if (event.type !== "ENEMY_SPAWNED" || seen.has(event.entityId)) continue;
      seen.add(event.entityId);
      const key = event.arrivalFormation ?? "absent";
      census.set(key, (census.get(key) || 0) + 1);
    }
  }
  return { run, census };
}

const rows = [];
for (const stageId of STAGES) {
  for (const seed of SEEDS) {
    const { run, census } = runTo(stageId, seed, TICKS);
    const digest = getRunDigest(run);
    const snapshot = JSON.parse(digest);
    rows.push({
      stageId,
      seed,
      ticks: TICKS,
      digestSha256_16: sha(digest),
      digestBytes: digest.length,
      tick: snapshot.tick,
      waveVariantId: snapshot.plan?.waveVariantId ?? null,
      waveVariantSha256_16: sha(String(snapshot.plan?.waveVariantId ?? "")),
      enemyCount: Array.isArray(snapshot.enemies) ? snapshot.enemies.length : null,
      terminal: snapshot.terminal ?? null,
      arrivals: Object.fromEntries([...census].sort()),
    });
  }
}

const report = { generatedAt: new Date().toISOString(), ticks: TICKS, stages: STAGES, seeds: SEEDS, rows };

const pad = (value, width) => String(value).padEnd(width);
console.log(`${pad("stage", 15)} ${pad("seed", 5)} ${pad("tick", 6)} ${pad("digest", 18)} ${pad("waveVariant", 18)} ${pad("enemies", 8)} arrivals`);
for (const row of rows) {
  const arrivals = Object.entries(row.arrivals).map(([key, count]) => `${key}x${count}`).join(" ") || "NONE";
  console.log(
    `${pad(row.stageId, 15)} ${pad(row.seed, 5)} ${pad(row.tick, 6)} ${pad(row.digestSha256_16, 18)} ` +
    `${pad(row.waveVariantSha256_16, 18)} ${pad(row.enemyCount, 8)} ${arrivals}`,
  );
}
// A window whose census is only `lane` proves nothing about formations: say so rather than let a
// green "no change" stand in for coverage the run never had.
const exercised = rows.filter((row) => Object.keys(row.arrivals).some((key) => key !== "lane" && key !== "absent"));
console.log(`\n${exercised.length}/${rows.length} windows actually reached a non-lane formation.`);

if (JSON_OUT) {
  mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nwrote ${JSON_OUT}`);
}

if (COMPARE) {
  const prior = JSON.parse(readFileSync(COMPARE, "utf8"));
  const priorByKey = new Map(prior.rows.map((row) => [`${row.stageId}:${row.seed}`, row]));
  let moved = 0;
  let waveMoved = 0;
  console.log(`\ncompared against ${COMPARE} (generated ${prior.generatedAt})`);
  for (const row of rows) {
    const before = priorByKey.get(`${row.stageId}:${row.seed}`);
    if (!before) {
      console.log(`  ${row.stageId} seed=${row.seed}: NEW ROW (absent in baseline)`);
      moved += 1;
      continue;
    }
    const digestMoved = before.digestSha256_16 !== row.digestSha256_16;
    const variantMoved = before.waveVariantSha256_16 !== row.waveVariantSha256_16;
    if (digestMoved) moved += 1;
    if (variantMoved) waveMoved += 1;
    console.log(
      `  ${pad(row.stageId, 15)} seed=${pad(row.seed, 3)} digest ${before.digestSha256_16} -> ${row.digestSha256_16}` +
      `${digestMoved ? "  MOVED" : "  same"}   waveVariant${variantMoved ? " MOVED" : " same"}`,
    );
  }
  console.log(`\n${moved}/${rows.length} digests moved; ${waveMoved}/${rows.length} wave variants moved.`);
  console.log(
    waveMoved === 0
      ? "Wave composition/timing/lane/direction are UNCHANGED: the change did not shift the wave RNG stream."
      : "Wave composition shifted: the change consumed RNG ahead of wave planning. Re-baseline the doctrine suites.",
  );
}
