#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILLS, STAGES } from "../../../defense-catalog.js";
import { play, sourceHashes } from "./run-all-pair-ev.mjs";

const MODE = process.argv[2];
const MANIFEST_PATH = resolve(process.argv[3] || "_workspace/20260722-defense-survival-expansion/qa/reference-ttk-manifest.json");
const OUTPUT_PATH = resolve(process.argv[4] || "_workspace/20260722-defense-survival-expansion/qa/reference-ttk-result.json");
const PROBE_PATH = fileURLToPath(import.meta.url);
const PAIR_RUNNER_PATH = resolve("_workspace/20260722-defense-survival-expansion/qa/run-all-pair-ev.mjs");
const SEED_LIMIT = 10_000;
const REQUIRED_PHASES = Object.freeze(["gate-defense", "echo-recovery", "growth", "occupation", "extraction", "boss-kill"]);
const REFERENCE_SKILL = "shadow-step";
const CONTROLLER = Object.freeze({
  id: "ReferenceSingleBossR3",
  offerPriority: Object.freeze(["shadow-step", "void-aegis", "ward-binder", "soul-magnet"]),
  rewardPriority: Object.freeze(["stillwater-hourglass", "abyssal-banner", "bulwark-brand", "anchor-shard-archive"]),
});
const TTK_TARGETS = Object.freeze({
  "cinder-span": { target: 656, lower: 558, upper: 754 },
  "veil-citadel": { target: 853, lower: 725, upper: 981 },
  "echo-throne": { target: 1009, lower: 858, upper: 1160 },
  "sunken-bastion": { target: 1267, lower: 1077, upper: 1457 },
  "howling-sprawl": { target: 1407, lower: 1196, upper: 1618 },
  "glass-necropolis": { target: 1862, lower: 1583, upper: 2141 },
  "starless-canal": { target: 2214, lower: 1882, upper: 2546 },
  "shattered-causeway": { target: 2581, lower: 2194, upper: 2968 },
  "abyss-chancel": { target: 2800, lower: 2380, upper: 3220 },
  "gate-zenith": { target: 4048, lower: 3441, upper: 4655 },
});
const REFERENCE_INITIAL_LOADOUTS = Object.freeze({
  "cinder-span": Object.freeze([]),
  "veil-citadel": Object.freeze(["ember-cohort"]),
  "echo-throne": Object.freeze(["ember-cohort", "rift-lens"]),
  "sunken-bastion": Object.freeze(["ember-cohort", "rift-lens", "throne-echo"]),
  "howling-sprawl": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "glass-necropolis": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "starless-canal": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "shattered-causeway": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "abyss-chancel": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "gate-zenith": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
});
const REFERENCE_FINAL_LOADOUTS = Object.freeze({
  "cinder-span": Object.freeze(["ember-cohort"]),
  "veil-citadel": Object.freeze(["ember-cohort", "rift-lens"]),
  "echo-throne": Object.freeze(["ember-cohort", "rift-lens", "throne-echo"]),
  "sunken-bastion": Object.freeze(["ember-cohort", "rift-lens", "throne-echo"]),
  "howling-sprawl": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "glass-necropolis": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "starless-canal": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "shattered-causeway": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "abyss-chancel": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
  "gate-zenith": Object.freeze(["ember-cohort", "throne-echo", "veil-vanguard"]),
});

const hash = (value) => createHash("sha256").update(typeof value === "string" || value instanceof Uint8Array ? value : JSON.stringify(value)).digest("hex");
const sorted = (values) => [...values].sort();
const sameValues = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

async function evidenceHashes() {
  return {
    ...(await sourceHashes()),
    pairRunnerSha256: hash(await readFile(PAIR_RUNNER_PATH)),
    probeSha256: hash(await readFile(PROBE_PATH)),
  };
}

function objectiveOrder(run) {
  const ticks = {
    "gate-defense": run.objectives.gateDefense.completedAt,
    "echo-recovery": run.objectives.echoRecovery.completedAt,
    growth: run.objectives.growth.completedAt,
    occupation: run.occupationProgress.capturedAt,
    extraction: run.extractionProgress.completedAt,
    "boss-kill": run.objectives.bossKill.completedAt,
  };
  const values = REQUIRED_PHASES.map((phase) => ticks[phase]);
  return {
    required: REQUIRED_PHASES,
    ticks,
    full: values.every((tick) => Number.isInteger(tick)),
    ordered: values.every((tick, index) => index === 0 || tick >= values[index - 1]),
  };
}

function referenceChecks(run) {
  const damagingActives = run.finalSkillIds.filter((id) => SKILLS[id]?.kind === "active" && (SKILLS[id]?.damage || 0) > 0);
  const optionalDamageSkills = run.finalSkillIds.filter((id) => id !== REFERENCE_SKILL && ((SKILLS[id]?.damage || 0) > 0 || (SKILLS[id]?.basicDamage || 0) > 0));
  const order = objectiveOrder(run);
  const expectedLoadout = REFERENCE_FINAL_LOADOUTS[run.stageId];
  return {
    victory: run.terminal === "VICTORY",
    exactReferenceActive: damagingActives.length === 1 && damagingActives[0] === REFERENCE_SKILL,
    noOptionalDamageSkill: optionalDamageSkills.length === 0,
    referenceLoadoutMatched: sameValues(run.finalCompanionIds, expectedLoadout),
    authoredItemAcquired: run.finalItemIds.length > 0,
    fullMandatoryOrder: order.full && order.ordered,
    bossTtkObserved: Number.isInteger(run.metrics.bossTtkTicks) && run.metrics.bossTtkTicks > 0,
    order,
    damagingActives,
    optionalDamageSkills,
  };
}

function runStage(stageId, seed) {
  return play({
    stageId,
    controller: CONTROLLER,
    pair: [REFERENCE_SKILL],
    seed,
    companionLoadout: REFERENCE_INITIAL_LOADOUTS[stageId],
    rewardIds: [],
  });
}

function accepted(run) {
  return Object.entries(referenceChecks(run)).filter(([, value]) => typeof value === "boolean").every(([, value]) => value);
}

async function buildManifest() {
  const hashes = await evidenceHashes();
  const entries = [];
  const blockers = [];
  for (const stage of STAGES) {
    let found = null;
    for (let seed = 1; seed <= SEED_LIMIT; seed += 1) {
      const run = runStage(stage.id, seed);
      if (accepted(run)) {
        found = {
          stageId: stage.id,
          seed,
          initialCompanionLoadout: REFERENCE_INITIAL_LOADOUTS[stage.id],
          actionDigest: run.actionDigest,
          finalDigest: run.finalDigest,
          bossTtkTicks: run.metrics.bossTtkTicks,
          checks: referenceChecks(run),
          finalSkillIds: run.finalSkillIds,
          finalItemIds: run.finalItemIds,
          finalCompanionIds: run.finalCompanionIds,
        };
        break;
      }
    }
    if (found) entries.push(found);
    else blockers.push({ stageId: stage.id, reason: `No reference run found in seeds 1-${SEED_LIMIT}` });
    process.stdout.write(`${stage.id}: ${found ? `seed ${found.seed}, TTK ${found.bossTtkTicks}` : "BLOCKED"}\n`);
  }
  const manifest = {
    schema: "abyssal-reference-ttk-manifest/v1",
    generatedAt: new Date().toISOString(),
    evidenceBoundary: "Public createDefenseRun/getRunSnapshot/queueInput/advanceDefenseRun/isTerminalRun/getRunDigest APIs through the frozen pair-runner controller; no hidden state, direct mutation, post-result weighting, or injected boss state.",
    methodology: "Per stage, scan ascending seeds before grading and accept the first victory that completes Gate->Echo->growth->occupation->extraction->boss, acquires its authored item/extraction, carries the frozen reference companion loadout, and uses Shadow Step as the sole damaging R3 active with no optional damage skill.",
    inputContract: {
      seedRange: [1, SEED_LIMIT],
      referenceSkill: REFERENCE_SKILL,
      controller: CONTROLLER,
      initialCompanionLoadouts: REFERENCE_INITIAL_LOADOUTS,
      expectedFinalCompanionLoadouts: REFERENCE_FINAL_LOADOUTS,
      rewardIds: [],
      ttkTargets: TTK_TARGETS,
    },
    hashes,
    requiredStages: STAGES.map((stage) => stage.id),
    acceptedEntries: entries.length,
    blockers,
    status: blockers.length || entries.length !== STAGES.length ? "BLOCKED" : "READY",
    entries,
  };
  manifest.acceptedSeedManifestSha256 = hash(entries);
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ path: MANIFEST_PATH, status: manifest.status, acceptedEntries: entries.length, blockers: blockers.length, acceptedSeedManifestSha256: manifest.acceptedSeedManifestSha256 }, null, 2)}\n`);
}

async function measureManifest() {
  const manifestBytes = await readFile(MANIFEST_PATH);
  const manifest = JSON.parse(manifestBytes);
  const currentHashes = await evidenceHashes();
  const sourceUnchanged = JSON.stringify(manifest.hashes) === JSON.stringify(currentHashes);
  if (manifest.status !== "READY") throw new Error(`manifest is ${manifest.status}`);
  if (!sourceUnchanged) throw new Error(`evidence source changed: ${JSON.stringify({ frozen: manifest.hashes, current: currentHashes })}`);
  if (hash(manifest.entries) !== manifest.acceptedSeedManifestSha256) throw new Error("manifest entry digest mismatch");

  const rows = manifest.entries.map((entry) => {
    const run = runStage(entry.stageId, entry.seed);
    const checks = referenceChecks(run);
    const target = TTK_TARGETS[entry.stageId];
    const replay = run.actionDigest === entry.actionDigest && run.finalDigest === entry.finalDigest && run.metrics.bossTtkTicks === entry.bossTtkTicks;
    const inBand = run.metrics.bossTtkTicks >= target.lower && run.metrics.bossTtkTicks <= target.upper;
    return {
      stageId: entry.stageId,
      seed: entry.seed,
      target,
      actual: run.metrics.bossTtkTicks,
      deltaFromTarget: run.metrics.bossTtkTicks - target.target,
      deltaRatio: (run.metrics.bossTtkTicks - target.target) / target.target,
      inBand,
      replay,
      checks,
      terminalTick: run.terminalTick,
      finalSkillIds: run.finalSkillIds,
      finalItemIds: run.finalItemIds,
      finalCompanionIds: run.finalCompanionIds,
      actionDigest: run.actionDigest,
      finalDigest: run.finalDigest,
    };
  });
  const allChecksPass = rows.every((row) => Object.entries(row.checks).filter(([, value]) => typeof value === "boolean").every(([, value]) => value));
  const replayPass = rows.every((row) => row.replay);
  const ttkPass = rows.every((row) => row.inBand);
  const report = {
    schema: "abyssal-reference-ttk-result/v1",
    generatedAt: new Date().toISOString(),
    manifestPath: MANIFEST_PATH,
    manifestFileSha256: hash(manifestBytes),
    acceptedSeedManifestSha256: manifest.acceptedSeedManifestSha256,
    hashes: currentHashes,
    sourceUnchanged,
    stagesMeasured: rows.length,
    requiredStages: STAGES.length,
    allChecksPass,
    replayPass,
    ttkPass,
    grade: rows.length === STAGES.length && sourceUnchanged && allChecksPass && replayPass && ttkPass ? "PASS" : "FIX",
    rows,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ path: OUTPUT_PATH, grade: report.grade, stagesMeasured: report.stagesMeasured, replayPass, ttkPass, outOfBand: rows.filter((row) => !row.inBand).map((row) => row.stageId) }, null, 2)}\n`);
}

if (MODE === "manifest") await buildManifest();
else if (MODE === "measure") await measureManifest();
else throw new Error("usage: run-reference-ttk.mjs manifest <manifest-path> | measure <manifest-path> <output-path>");
