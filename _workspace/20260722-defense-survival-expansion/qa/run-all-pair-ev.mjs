#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SKILLS, STAGES } from "../../../defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../../../defense-run-simulation.js";

const MODE = process.argv[2];
const MANIFEST_PATH = resolve(process.argv[3] || "_workspace/20260722-defense-survival-expansion/qa/all-pair-ev-manifest.json");
const OUTPUT_PATH = resolve(process.argv[4] || "_workspace/20260722-defense-survival-expansion/qa/all-pair-ev-result.json");
const MAX_SEED = 10_000;
const MAX_TICKS = 18_000;
const ACTIVE_SKILLS = Object.values(SKILLS).filter((skill) => skill.kind === "active").map((skill) => skill.id).sort();
const FULL_LOADOUT = Object.freeze(["ember-cohort", "rift-lens", "veil-vanguard"]);
const FULL_REWARDS = Object.freeze(["abyssal-banner", "bulwark-brand", "stillwater-hourglass"]);
const CONTROLLERS = Object.freeze([
  Object.freeze({
    id: "Hunter65",
    offerPriority: Object.freeze(["rift-bolt", "soul-lance", "eclipse-edge", "shadow-step", "grave-pulse", "void-aegis", "soul-magnet", "ward-binder"]),
    rewardPriority: Object.freeze(["stillwater-hourglass", "abyssal-banner", "bulwark-brand"]),
  }),
  Object.freeze({
    id: "Generalist",
    offerPriority: Object.freeze(["eclipse-edge", "grave-pulse", "void-aegis", "rift-bolt", "soul-magnet", "ward-binder", "shadow-step", "soul-lance"]),
    rewardPriority: Object.freeze(["abyssal-banner", "bulwark-brand", "stillwater-hourglass"]),
  }),
]);
const AXES = Object.freeze(["damagePerTick", "castsPer1000Ticks", "targetsPerCast", "integrityPer1000Ticks", "itemCompanionPerRun", "occupationPerRun", "bossEfficiency", "completionAction"]);
const hash = (value) => createHash("sha256").update(typeof value === "string" || value instanceof Uint8Array ? value : JSON.stringify(value)).digest("hex");
const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const nearest = (origin, entries) => [...entries].sort((a, b) => squaredDistance(origin, a) - squaredDistance(origin, b) || String(a.id).localeCompare(String(b.id)))[0] || null;
const choose = (choices, priorities) => priorities.find((id) => choices.includes(id)) || choices[0];

function pairsOf(values) {
  const pairs = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) pairs.push([values[left], values[right]]);
  }
  return pairs;
}

function octantToward(origin, target, holdRadius = 0) {
  if (!target) return "IDLE";
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  if (Math.hypot(dx, dy) <= Math.max(0, holdRadius - 80)) return "IDLE";
  const horizontal = Math.abs(dx) < 300 ? "" : dx > 0 ? "E" : "W";
  const vertical = Math.abs(dy) < 300 ? "" : dy > 0 ? "S" : "N";
  return `${vertical}${horizontal}` || "IDLE";
}

function tacticalPoint(snapshot, key) {
  const layout = snapshot.stageLayout;
  if (key === "chokepath") return layout.chokepath ? { x: layout.chokepath.x, y: snapshot.gate.y, radius: layout.chokepath.halfWidth || 500, id: layout.chokepath.id } : null;
  return layout[key] || null;
}

function combatTarget(snapshot, controller, hunterRetreatLocked) {
  if (controller.id === "Hunter65" && hunterRetreatLocked) return { ...snapshot.gate, radius: 1200 };
  if (controller.id === "Hunter65") {
    const priorities = ["boss", "elite", "ranged", "guardian", "flanker", "rusher"];
    return [...snapshot.enemies].sort((a, b) => priorities.indexOf(a.class) - priorities.indexOf(b.class) || a.hp - b.hp || squaredDistance(snapshot.commander, a) - squaredDistance(snapshot.commander, b))[0] || tacticalPoint(snapshot, "chokepath");
  }
  return Math.floor(snapshot.tick / 240) % 2 ? tacticalPoint(snapshot, "chokepath") : { ...snapshot.gate, radius: 1500 };
}

function movementDecision(snapshot, controller, hunterRetreatLocked) {
  const phase = snapshot.objectives.phase;
  if (phase === "occupation") {
    const target = snapshot.stageLayout.occupationPoint;
    return { octant: octantToward(snapshot.commander, target, target?.radius), routePhase: phase };
  }
  if (phase === "extraction") {
    const target = snapshot.stageLayout.extractionPoint;
    return { octant: octantToward(snapshot.commander, target, target?.radius), routePhase: phase };
  }
  if (phase === "echo-recovery") {
    const target = snapshot.enemies.find((enemy) => enemy.elite) || nearest(snapshot.commander, snapshot.enemies);
    return { octant: octantToward(snapshot.commander, target, target?.radius || 500), routePhase: phase };
  }
  if (phase === "growth" && !snapshot.growthOffer) {
    const target = nearest(snapshot.commander, snapshot.pickups) || combatTarget(snapshot, controller, hunterRetreatLocked);
    return { octant: octantToward(snapshot.commander, target, target?.radius || 500), routePhase: phase };
  }
  const target = combatTarget(snapshot, controller, hunterRetreatLocked);
  return { octant: octantToward(snapshot.commander, target, target?.radius || 500), routePhase: phase };
}

function effectiveSkillRange(snapshot, skill) {
  let range = skill.radius || 6000;
  const elevation = snapshot.stageLayout.elevation;
  if (elevation && squaredDistance(snapshot.commander, elevation) <= 2000 ** 2) range *= elevation.rangeMultiplier || 1;
  const occupation = snapshot.stageLayout.occupationPoint;
  if (snapshot.occupationProgress.captured || (occupation && squaredDistance(snapshot.commander, occupation) <= occupation.radius ** 2)) range *= occupation.effects?.rangeMultiplier || 1;
  return Math.trunc(range);
}

function predictedCast(snapshot, skillId) {
  const skill = SKILLS[skillId];
  if (!skill || skill.kind !== "active" || !snapshot.commander.skills.includes(skillId) || snapshot.commander.cooldowns[skillId] > 0) return null;
  const range = effectiveSkillRange(snapshot, skill);
  const targets = snapshot.enemies.filter((enemy) => enemy.hp > 0 && squaredDistance(snapshot.commander, enemy) <= range ** 2);
  const targetsHit = skill.integrity ? 0 : skill.radius ? targets.length : targets.length ? 1 : 0;
  return { skillId, targetsHit, damagePotential: targetsHit * skill.damage, integrityPotential: skill.integrity || 0 };
}

function blankMetrics() {
  return {
    casts: Object.fromEntries(ACTIVE_SKILLS.map((id) => [id, 0])),
    skillTargetsHit: Object.fromEntries(ACTIVE_SKILLS.map((id) => [id, 0])),
    skillDamagePotential: Object.fromEntries(ACTIVE_SKILLS.map((id) => [id, 0])),
    integrityRecoveryPotential: Object.fromEntries(ACTIVE_SKILLS.map((id) => [id, 0])),
    projectileDamage: { commander: 0, companions: 0 },
    terrainRecovery: { commander: 0, gate: 0 },
    routeVisits: { occupation: false },
    bossSpawnTick: null,
    bossTtkTicks: null,
    items: [],
  };
}

function observe(metrics, before, after, predictedCasts) {
  const occupation = after.stageLayout.occupationPoint;
  if (occupation && squaredDistance(after.commander, occupation) <= occupation.radius ** 2) metrics.routeVisits.occupation = true;
  for (const event of after.events) {
    if (event.type === "SKILL_CAST") {
      metrics.casts[event.skillId] += 1;
      const predicted = predictedCasts.find((entry) => entry.skillId === event.skillId);
      if (predicted) {
        metrics.skillTargetsHit[event.skillId] += predicted.targetsHit;
        metrics.skillDamagePotential[event.skillId] += predicted.damagePotential;
        metrics.integrityRecoveryPotential[event.skillId] += Math.min(predicted.integrityPotential, Math.max(0, after.commander.integrity - before.commander.integrity));
      }
    } else if (event.type === "PROJECTILE_IMPACT" && event.hit) {
      if (event.owner === "commander") metrics.projectileDamage.commander += event.damage;
      else metrics.projectileDamage.companions += event.damage;
    } else if (event.type === "TERRAIN_RECOVERY") {
      metrics.terrainRecovery.commander += event.commanderRecovery || 0;
      metrics.terrainRecovery.gate += event.gateRecovery || 0;
    } else if (event.type === "ITEM_COLLECTED") metrics.items.push(event.itemId);
    else if (event.type === "BOSS_SPAWNED") metrics.bossSpawnTick = after.tick;
    else if (event.type === "TERMINAL" && event.bossTtkTicks !== undefined) metrics.bossTtkTicks = event.bossTtkTicks;
  }
}

function play({
  stageId,
  controller,
  pair,
  seed,
  stopOnAcquisition = false,
  companionLoadout = FULL_LOADOUT,
  rewardIds = FULL_REWARDS,
}) {
  let run = createDefenseRun({ stageId, seed, companionLoadout, rewardIds });
  const metrics = blankMetrics();
  const actionLog = [];
  const priorities = [...pair, ...controller.offerPriority.filter((id) => !pair.includes(id))];
  let hunterRetreatLocked = false;

  for (let step = 0; step < MAX_TICKS && !isTerminalRun(run); step += 1) {
    const before = getRunSnapshot(run);
    if (before.growthOffer) {
      const skillId = choose(before.growthOffer.choices, priorities);
      actionLog.push([before.tick, "SKILL_SELECTED", skillId]);
      run = queueInput(run, "SKILL_SELECTED", { skillId });
    }
    const ready = getRunSnapshot(run);
    if (controller.id === "Hunter65" && !hunterRetreatLocked && ready.commander.integrity * 100 <= ready.commander.maxIntegrity * 65) {
      hunterRetreatLocked = true;
      actionLog.push([ready.tick, "HUNTER_RETREAT_LOCKED", ready.commander.integrity, ready.commander.maxIntegrity]);
    }
    const decision = movementDecision(ready, controller, hunterRetreatLocked);
    actionLog.push([ready.tick, "MOVE", decision.octant, decision.routePhase]);
    run = queueInput(run, "MOVE", { octant: decision.octant });
    const predictedCasts = [];
    for (const skillId of ready.commander.skills) {
      const predicted = predictedCast(ready, skillId);
      if (predicted) predictedCasts.push(predicted);
      actionLog.push([ready.tick, "SKILL_CAST_ATTEMPT", skillId]);
      run = queueInput(run, "SKILL_CAST", { skillId });
    }
    run = advanceDefenseRun(run, 1);
    const after = getRunSnapshot(run);
    observe(metrics, ready, after, predictedCasts);
    if (stopOnAcquisition && pair.every((id) => after.commander.skills.includes(id))) {
      return { acquired: true, acquiredTick: after.tick, terminal: after.terminal, actionDigest: hash(actionLog) };
    }
  }

  let snapshot = getRunSnapshot(run);
  if (snapshot.rewardOffer) {
    const rewardId = choose(snapshot.rewardOffer.choices, controller.rewardPriority);
    actionLog.push([snapshot.tick, "REWARD_SELECTED", rewardId]);
    run = queueInput(run, "REWARD_SELECTED", { rewardId });
    run = advanceDefenseRun(run, 1);
    const afterReward = getRunSnapshot(run);
    observe(metrics, snapshot, afterReward, []);
    snapshot = afterReward;
  }
  return {
    acquired: pair.every((id) => snapshot.commander.skills.includes(id)),
    stageId,
    controller: controller.id,
    seed,
    terminal: snapshot.terminal,
    terminalTick: snapshot.tick,
    finalSkillIds: snapshot.commander.skills,
    finalItemIds: snapshot.itemIds,
    finalRewardIds: snapshot.rewardIds,
    finalCompanionIds: snapshot.companions.map((entry) => entry.companionId),
    objectives: snapshot.objectives,
    occupationCaptured: snapshot.occupationProgress.captured,
    occupationProgress: snapshot.occupationProgress,
    extractionProgress: snapshot.extractionProgress,
    metrics,
    actionDigest: hash(actionLog),
    finalDigest: hash(getRunDigest(run)),
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizePair(pair, runs) {
  const totalTicks = runs.reduce((sum, run) => sum + run.terminalTick, 0);
  const castCount = runs.reduce((sum, run) => sum + pair.reduce((pairSum, id) => pairSum + run.metrics.casts[id], 0), 0);
  const targets = runs.reduce((sum, run) => sum + pair.reduce((pairSum, id) => pairSum + run.metrics.skillTargetsHit[id], 0), 0);
  const skillDamage = runs.reduce((sum, run) => sum + pair.reduce((pairSum, id) => pairSum + run.metrics.skillDamagePotential[id], 0), 0);
  const basicDamage = runs.reduce((sum, run) => sum + run.metrics.projectileDamage.commander, 0);
  const companionDamage = runs.reduce((sum, run) => sum + run.metrics.projectileDamage.companions, 0);
  const integrity = runs.reduce((sum, run) => sum + pair.reduce((pairSum, id) => pairSum + run.metrics.integrityRecoveryPotential[id], 0) + run.metrics.terrainRecovery.commander + run.metrics.terrainRecovery.gate, 0);
  const itemsCompanions = runs.reduce((sum, run) => sum + run.metrics.items.length + Math.max(0, run.finalCompanionIds.length - FULL_LOADOUT.length) + run.metrics.projectileDamage.companions / 10_000, 0);
  const occupation = runs.reduce((sum, run) => sum + Number(run.metrics.routeVisits.occupation) + Number(run.occupationCaptured) + (run.metrics.terrainRecovery.commander + run.metrics.terrainRecovery.gate) / 100, 0);
  const ttks = runs.map((run) => run.metrics.bossTtkTicks).filter((value) => value !== null && value > 0);
  const completions = runs.filter((run) => run.terminal === "VICTORY" || run.terminal === "FINAL_COMPLETION").length;
  const actionObjectives = runs.reduce((sum, run) => sum + Object.values(run.objectives).filter((value) => value && typeof value === "object" && value.completed === true).length, 0);
  return {
    pair,
    encounterSamples: runs.length,
    terminalSamples: runs.filter((run) => run.terminal).length,
    pairAcquiredSamples: runs.filter((run) => pair.every((id) => run.finalSkillIds.includes(id))).length,
    rawProxy: pair.reduce((sum, id) => sum + SKILLS[id].damage / SKILLS[id].cooldown, 0),
    observed: { totalTicks, castCount, targets, skillDamagePotential: skillDamage, commanderProjectileDamage: basicDamage, companionProjectileDamage: companionDamage, integrityAndRecovery: integrity, itemsCompanions, occupation, bossTtkSamples: ttks.length, medianBossTtkTicks: ttks.length ? median(ttks) : null, completions, actionObjectives },
    axes: {
      damagePerTick: (skillDamage + basicDamage + companionDamage) / Math.max(1, totalTicks),
      castsPer1000Ticks: castCount * 1000 / Math.max(1, totalTicks),
      targetsPerCast: targets / Math.max(1, castCount),
      integrityPer1000Ticks: integrity * 1000 / Math.max(1, totalTicks),
      itemCompanionPerRun: itemsCompanions / runs.length,
      occupationPerRun: occupation / runs.length,
      bossEfficiency: ttks.length ? 1000 / median(ttks) : 0,
      completionAction: (completions + actionObjectives / 6) / runs.length,
    },
  };
}

function normalizeAxes(pairEvidence) {
  const axisMedians = Object.fromEntries(AXES.map((name) => [name, median(pairEvidence.map((pair) => pair.axes[name]))]));
  for (const pair of pairEvidence) {
    pair.normalizedAxes = Object.fromEntries(AXES.map((name) => [name, axisMedians[name] > 0 ? pair.axes[name] / axisMedians[name] : pair.axes[name] === 0 ? 1 : 0]));
    pair.encounterEv = AXES.reduce((sum, name) => sum + pair.normalizedAxes[name], 0) / AXES.length;
  }
  const encounterMedian = median(pairEvidence.map((pair) => pair.encounterEv));
  const encounterMaximum = Math.max(...pairEvidence.map((pair) => pair.encounterEv));
  return { axisMedians, encounterMedian, encounterMaximum, maxToMedianRatio: encounterMaximum / encounterMedian };
}

async function sourceHashes() {
  return {
    simulationSha256: hash(await readFile(resolve("defense-run-simulation.js"))),
    catalogSha256: hash(await readFile(resolve("defense-catalog.js"))),
    runnerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  };
}

async function buildManifest() {
  const pairs = pairsOf(ACTIVE_SKILLS);
  const entries = [];
  const blockers = [];
  for (const pair of pairs) {
    for (const stage of STAGES) {
      for (const controller of CONTROLLERS) {
        let accepted = null;
        for (let seed = 1; seed <= MAX_SEED; seed += 1) {
          const probe = play({ stageId: stage.id, controller, pair, seed, stopOnAcquisition: true });
          if (probe.acquired) {
            accepted = { pair, stageId: stage.id, controller: controller.id, seed, acquiredTick: probe.acquiredTick, acquisitionActionDigest: probe.actionDigest };
            break;
          }
        }
        if (accepted) entries.push(accepted);
        else blockers.push({ pair, stageId: stage.id, controller: controller.id, scannedSeeds: [1, MAX_SEED] });
      }
    }
  }
  const hashes = await sourceHashes();
  const manifest = {
    schema: "abyssal-all-pair-ev-manifest-v1",
    generatedAt: new Date().toISOString(),
    exactCommand: `node _workspace/20260722-defense-survival-expansion/qa/run-all-pair-ev.mjs manifest ${MANIFEST_PATH}`,
    evidenceBoundary: "Only exported createDefenseRun/getRunSnapshot/queueInput/advanceDefenseRun/isTerminalRun/getRunDigest APIs and public catalog constants are used.",
    inputs: { seedScan: [1, MAX_SEED], maxTicks: MAX_TICKS, stages: STAGES.map((stage) => stage.id), controllers: CONTROLLERS.map((controller) => controller.id), activeSkills: ACTIVE_SKILLS, companionLoadout: FULL_LOADOUT, rewardIds: FULL_REWARDS, ...hashes },
    requiredEntries: pairs.length * STAGES.length * CONTROLLERS.length,
    acceptedEntries: entries.length,
    blockers,
    status: blockers.length ? "BLOCKED" : "READY",
    entries,
  };
  manifest.acceptedSeedManifestSha256 = hash(entries);
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ path: MANIFEST_PATH, status: manifest.status, acceptedEntries: entries.length, blockers: blockers.length, manifestSha256: manifest.acceptedSeedManifestSha256 }, null, 2)}\n`);
  if (blockers.length) process.exitCode = 1;
}

async function measureManifest() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const hashes = await sourceHashes();
  if (manifest.status !== "READY" || manifest.acceptedEntries !== manifest.requiredEntries) throw new Error("manifest is not complete");
  if (manifest.inputs.simulationSha256 !== hashes.simulationSha256 || manifest.inputs.catalogSha256 !== hashes.catalogSha256) throw new Error("source/catalog hash changed after manifest freeze");
  if (hash(manifest.entries) !== manifest.acceptedSeedManifestSha256) throw new Error("accepted seed manifest hash mismatch");
  const controllerById = Object.fromEntries(CONTROLLERS.map((controller) => [controller.id, controller]));
  const measuredRuns = [];
  let replayMatches = 0;
  for (const entry of manifest.entries) {
    const options = { stageId: entry.stageId, controller: controllerById[entry.controller], pair: entry.pair, seed: entry.seed };
    const primary = play(options);
    const replay = play(options);
    const replayMatch = primary.finalDigest === replay.finalDigest && primary.actionDigest === replay.actionDigest;
    if (replayMatch) replayMatches += 1;
    measuredRuns.push({ ...primary, pair: entry.pair, replayMatch });
  }
  const pairs = pairsOf(ACTIVE_SKILLS);
  const pairEvidence = pairs.map((pair) => summarizePair(pair, measuredRuns.filter((run) => run.pair[0] === pair[0] && run.pair[1] === pair[1])));
  const normalized = normalizeAxes(pairEvidence);
  const rawMedian = median(pairEvidence.map((entry) => entry.rawProxy));
  const rawMaximum = Math.max(...pairEvidence.map((entry) => entry.rawProxy));
  const allPairsAcquired = pairEvidence.every((entry) => entry.pairAcquiredSamples === STAGES.length * CONTROLLERS.length);
  const report = {
    schema: "abyssal-all-pair-ev-v1",
    generatedAt: new Date().toISOString(),
    exactCommands: [manifest.exactCommand, `node _workspace/20260722-defense-survival-expansion/qa/run-all-pair-ev.mjs measure ${MANIFEST_PATH} ${OUTPUT_PATH}`],
    formula: "For each active pair over the identical ten-stage, Hunter65+Generalist, full-loadout/full-reward public-API distribution: equal-weight arithmetic mean of eight axes normalized to the across-pair median: total observed/potential damage per tick; casts per 1000 ticks; targets per cast; integrity plus terrain recovery per 1000 ticks; item/companion count plus companion impact contribution per run; occupation visits/captures plus recovery per run; inverse median winning boss TTK; completion plus completed-objective action score. Raw proxy is sum(damage/cooldownTicks), with void-aegis damage=0 and no area inflation.",
    inputs: { ...manifest.inputs, acceptedSeedManifestPath: MANIFEST_PATH, acceptedSeedManifestSha256: manifest.acceptedSeedManifestSha256, samplesPerPair: STAGES.length * CONTROLLERS.length, ...hashes },
    acquisition: { requiredPairs: pairs.length, measuredPairs: pairEvidence.filter((entry) => entry.pairAcquiredSamples === STAGES.length * CONTROLLERS.length).length, requiredSamplesPerPair: STAGES.length * CONTROLLERS.length, allPairsAcquired },
    replay: { samples: measuredRuns.length, matches: replayMatches, pass: replayMatches === measuredRuns.length },
    raw: { median: rawMedian, maximum: rawMaximum, maxToMedianRatio: rawMaximum / rawMedian, cap: 1.30, pass: rawMaximum / rawMedian <= 1.30 },
    normalized: { ...normalized, cap: 1.30, status: allPairsAcquired ? "MEASURED" : "BLOCKED", pass: allPairsAcquired ? normalized.maxToMedianRatio <= 1.30 : null },
    pairs: pairEvidence,
    grade: allPairsAcquired && replayMatches === measuredRuns.length && normalized.maxToMedianRatio <= 1.30 ? "PASS" : "FIX",
    limitation: "Deterministic automation, not human feedback. Potential skill damage/targets are observed from public snapshots at cast time, matching the frozen eight-axis formula; no hidden actor injection or post-result weighting is used.",
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ path: OUTPUT_PATH, grade: report.grade, pairs: report.acquisition.measuredPairs, replay: report.replay, raw: report.raw, normalized: report.normalized, manifestSha256: manifest.acceptedSeedManifestSha256 }, null, 2)}\n`);
  if (report.grade !== "PASS") process.exitCode = 1;
}

export { ACTIVE_SKILLS, CONTROLLERS, hash, play, sourceHashes };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (MODE === "manifest") await buildManifest();
  else if (MODE === "measure") await measureManifest();
  else throw new Error("usage: run-all-pair-ev.mjs manifest <manifest-path> | measure <manifest-path> <output-path>");
}
