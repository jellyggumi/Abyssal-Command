#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { SKILLS, STAGES, TICK_RATE } from "../../../defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../../../defense-run-simulation.js";

const OUTPUT = resolve(process.argv[2] || "results/defense-final-qa-seed17.json");
const SEED = 17;
const MAX_TICKS = 18_000;
const ACTIVE_SKILLS = Object.values(SKILLS).filter((skill) => skill.kind === "active").map((skill) => skill.id).sort();
const FULL_LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const FULL_REWARDS = ["abyssal-banner", "bulwark-brand", "stillwater-hourglass"];
const REQUIRED_PHASES = ["gate-defense", "echo-recovery", "growth", "occupation", "extraction", "boss-kill", "complete"];
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

const ARCHETYPES = Object.freeze([
  {
    id: "Gatekeeper",
    offerPriority: ["void-aegis", "ward-binder", "grave-pulse", "eclipse-edge", "soul-magnet", "shadow-step", "rift-bolt", "soul-lance"],
    rewardPriority: ["bulwark-brand", "anchor-shard-archive", "stillwater-hourglass", "abyssal-banner"],
    combat: "hold Gate, prioritize integrity/area control",
  },
  {
    id: "Hunter",
    offerPriority: ["rift-bolt", "soul-lance", "eclipse-edge", "shadow-step", "grave-pulse", "void-aegis", "soul-magnet", "ward-binder"],
    rewardPriority: ["stillwater-hourglass", "abyssal-banner", "bulwark-brand"],
    combat: "pursue boss/elite/lowest-HP priority targets until the 65% low-health HUD boundary; once crossed, retreat to Gate for the rest of the run",
  },
  {
    id: "Collector",
    offerPriority: ["soul-magnet", "grave-pulse", "eclipse-edge", "void-aegis", "shadow-step", "rift-bolt", "soul-lance", "ward-binder"],
    rewardPriority: ["abyssal-banner", "rift-lens-archive", "throne-echo-record"],
    combat: "circulate through pickups and tactical resource points above 50% integrity; at 50% or below retreat to defend Gate",
  },
  {
    id: "Skirmisher",
    offerPriority: ["shadow-step", "stillwater-hourglass", "grave-pulse", "eclipse-edge", "rift-bolt", "soul-lance", "void-aegis", "ward-binder", "soul-magnet"],
    rewardPriority: ["stillwater-hourglass", "veil-vanguard-legacy", "abyssal-banner"],
    combat: "commit to the authored flank for 120 ticks, then return to Gate defense for 240 ticks",
  },
  {
    id: "Generalist",
    offerPriority: ["eclipse-edge", "grave-pulse", "void-aegis", "rift-bolt", "soul-magnet", "ward-binder", "shadow-step", "soul-lance"],
    rewardPriority: ["abyssal-banner", "bulwark-brand", "stillwater-hourglass"],
    combat: "alternate conservative Gate/chokepath positioning with balanced offers",
  },
]);

const hash = (value) => createHash("sha256").update(typeof value === "string" || value instanceof Uint8Array ? value : JSON.stringify(value)).digest("hex");
const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const nearest = (origin, entries) => [...entries].sort((a, b) => squaredDistance(origin, a) - squaredDistance(origin, b) || String(a.id).localeCompare(String(b.id)))[0] || null;
const choose = (choices, priorities) => priorities.find((id) => choices.includes(id)) || choices[0];

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
  if (key === "flank") return layout.flank ? { x: layout.flank.entryX, y: layout.flank.entryY, radius: 500, id: layout.flank.id } : null;
  if (key === "chokepath") return layout.chokepath ? { x: layout.chokepath.x, y: snapshot.gate.y, radius: layout.chokepath.halfWidth || 500, id: layout.chokepath.id } : null;
  return layout[key] || null;
}

function combatTarget(snapshot, archetype, hunterRetreatLocked = false) {
  const commander = snapshot.commander;
  if (archetype.id === "Gatekeeper") return { ...snapshot.gate, radius: 1200 };
  if (archetype.id === "Hunter" && hunterRetreatLocked) return { ...snapshot.gate, radius: 1200 };
  if (archetype.id === "Collector" && commander.integrity * 2 <= commander.maxIntegrity) return { ...snapshot.gate, radius: 1200 };
  if (archetype.id === "Hunter") {
    const priorities = ["boss", "elite", "ranged", "guardian", "flanker", "rusher"];
    return [...snapshot.enemies].sort((a, b) => priorities.indexOf(a.class) - priorities.indexOf(b.class) || a.hp - b.hp || squaredDistance(commander, a) - squaredDistance(commander, b))[0] || tacticalPoint(snapshot, "chokepath");
  }
  if (archetype.id === "Collector") return nearest(commander, snapshot.pickups) || [tacticalPoint(snapshot, "chokepath"), tacticalPoint(snapshot, "flank"), tacticalPoint(snapshot, "elevation"), snapshot.stageLayout.occupationPoint][Math.floor(snapshot.tick / 180) % 4];
  if (archetype.id === "Skirmisher") return snapshot.tick % 360 < 120 ? tacticalPoint(snapshot, "flank") : { ...snapshot.gate, radius: 1200 };
  return Math.floor(snapshot.tick / 240) % 2 ? tacticalPoint(snapshot, "chokepath") : { ...snapshot.gate, radius: 1500 };
}

function movementDecision(snapshot, archetype, hunterRetreatLocked = false) {
  const phase = snapshot.objectives.phase;
  if (phase === "occupation") {
    const target = snapshot.stageLayout.occupationPoint;
    return { octant: octantToward(snapshot.commander, target, target.radius), target: target?.id || null, routePhase: phase };
  }
  if (phase === "extraction") {
    const target = snapshot.stageLayout.extractionPoint;
    return { octant: octantToward(snapshot.commander, target, target.radius), target: target?.id || null, routePhase: phase };
  }
  if (phase === "echo-recovery") {
    const target = snapshot.enemies.find((enemy) => enemy.elite) || nearest(snapshot.commander, snapshot.enemies);
    return { octant: octantToward(snapshot.commander, target, target?.radius || 500), target: target?.id || null, routePhase: phase };
  }
  if (phase === "growth" && !snapshot.growthOffer) {
    const target = nearest(snapshot.commander, snapshot.pickups) || combatTarget(snapshot, archetype, hunterRetreatLocked);
    return { octant: octantToward(snapshot.commander, target, target?.radius || 500), target: target?.id || null, routePhase: phase };
  }
  const target = combatTarget(snapshot, archetype, hunterRetreatLocked);
  return { octant: octantToward(snapshot.commander, target, target?.radius || 500), target: target?.id || null, routePhase: phase };
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
    breaches: { count: 0, damage: 0 },
    phaseSequence: ["gate-defense"],
    phaseTicks: { "gate-defense": 0 },
    items: [], skills: [], extractions: [], rewards: [],
    policyCounts: {}, spawnDirectionCounts: {},
    movementCommands: 0, routeCommands: { occupation: 0, extraction: 0 },
    routeVisits: { occupation: false, extraction: false },
    bossSpawnTick: null, bossTtkTicks: null,
    minGateIntegrity: Infinity, minCommanderIntegrity: Infinity,
  };
}

function recordPhase(metrics, snapshot) {
  const phase = snapshot.objectives.phase;
  metrics.phaseTicks[phase] ??= snapshot.tick;
  if (metrics.phaseSequence.at(-1) !== phase) metrics.phaseSequence.push(phase);
}

function objectiveOrderReceipt(snapshot) {
  const ticks = {
    "gate-defense": snapshot.objectives.gateDefense.completedAt,
    "echo-recovery": snapshot.objectives.echoRecovery.completedAt,
    growth: snapshot.objectives.growth.completedAt,
    occupation: snapshot.occupationProgress.capturedAt,
    extraction: snapshot.extractionProgress.completedAt,
    "boss-kill": snapshot.objectives.bossKill.completedAt,
  };
  const completed = Object.entries(ticks).filter(([, tick]) => tick !== null);
  const ordered = completed.every(([, tick], index) => index === 0 || tick >= completed[index - 1][1]);
  const full = Object.values(ticks).every((tick) => tick !== null);
  return { required: REQUIRED_PHASES.slice(0, -1), ticks, completedCount: completed.length, ordered, full };
}

function ttkReceipt(stageId, actual) {
  const frozen = TTK_TARGETS[stageId];
  if (actual === null) return { ...frozen, actual: null, status: "MISSING" };
  return { ...frozen, actual, status: actual >= frozen.lower && actual <= frozen.upper ? "IN_BAND" : "OUT_OF_BAND" };
}

function observe(metrics, before, after, predictedCasts, decision) {
  metrics.minGateIntegrity = Math.min(metrics.minGateIntegrity, after.gate.integrity);
  metrics.minCommanderIntegrity = Math.min(metrics.minCommanderIntegrity, after.commander.integrity);
  metrics.movementCommands += 1;
  if (decision.routePhase === "occupation") metrics.routeCommands.occupation += 1;
  if (decision.routePhase === "extraction") metrics.routeCommands.extraction += 1;
  const occupation = after.stageLayout.occupationPoint;
  const extraction = after.stageLayout.extractionPoint;
  if (occupation && squaredDistance(after.commander, occupation) <= occupation.radius ** 2) metrics.routeVisits.occupation = true;
  if (extraction && squaredDistance(after.commander, extraction) <= extraction.radius ** 2) metrics.routeVisits.extraction = true;
  recordPhase(metrics, before);
  recordPhase(metrics, after);

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
    } else if (event.type === "GATE_BREACHED") {
      metrics.breaches.count += 1;
      metrics.breaches.damage += event.damage || 0;
    } else if (event.type === "ITEM_COLLECTED") metrics.items.push({ tick: after.tick, itemId: event.itemId });
    else if (event.type === "SKILL_SELECTED" && !metrics.skills.some((entry) => entry.tick === after.tick && entry.skillId === event.skillId)) metrics.skills.push({ tick: after.tick, skillId: event.skillId });
    else if (event.type === "ELITE_EXTRACTED") metrics.extractions.push({ tick: after.tick, companionId: event.companionId, extractionPointId: event.extractionPointId });
    else if (event.type === "REWARD_SELECTED") metrics.rewards.push({ tick: after.tick, rewardId: event.rewardId, alreadyOwned: event.alreadyOwned });
    else if (event.type === "WAVE_VARIANT_STARTED") {
      metrics.policyCounts[event.policyId] = (metrics.policyCounts[event.policyId] || 0) + event.count;
      metrics.spawnDirectionCounts[event.spawnDirection] = (metrics.spawnDirectionCounts[event.spawnDirection] || 0) + event.count;
    } else if (event.type === "BOSS_SPAWNED") metrics.bossSpawnTick = after.tick;
    else if (event.type === "TERMINAL" && event.bossTtkTicks !== undefined) metrics.bossTtkTicks = event.bossTtkTicks;
  }
}

function play({ stageId, archetype, pairPriority = null, loadout = [], rewardIds = [] }) {
  let run = createDefenseRun({ stageId, seed: SEED, companionLoadout: loadout, rewardIds });
  const metrics = blankMetrics();
  const actionLog = [];
  const priorities = pairPriority ? [...pairPriority, ...archetype.offerPriority.filter((id) => !pairPriority.includes(id))] : archetype.offerPriority;
  let hunterRetreatLocked = false;

  for (let step = 0; step < MAX_TICKS && !isTerminalRun(run); step += 1) {
    const before = getRunSnapshot(run);
    if (before.growthOffer) {
      const skillId = choose(before.growthOffer.choices, priorities);
      actionLog.push([before.tick, "SKILL_SELECTED", skillId]);
      metrics.skills.push({ tick: before.tick, skillId });
      run = queueInput(run, "SKILL_SELECTED", { skillId });
    }
    const ready = getRunSnapshot(run);
    if (archetype.id === "Hunter" && !hunterRetreatLocked && ready.commander.integrity * 100 <= ready.commander.maxIntegrity * 65) {
      hunterRetreatLocked = true;
      actionLog.push([ready.tick, "HUNTER_RETREAT_LOCKED", ready.commander.integrity, ready.commander.maxIntegrity]);
    }
    const decision = movementDecision(ready, archetype, hunterRetreatLocked);
    actionLog.push([ready.tick, "MOVE", decision.octant, decision.target, decision.routePhase]);
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
    observe(metrics, ready, after, predictedCasts, decision);
  }

  let snapshot = getRunSnapshot(run);
  if (snapshot.rewardOffer) {
    const rewardId = choose(snapshot.rewardOffer.choices, archetype.rewardPriority);
    actionLog.push([snapshot.tick, "REWARD_SELECTED", rewardId]);
    run = queueInput(run, "REWARD_SELECTED", { rewardId });
    run = advanceDefenseRun(run, 1);
    const afterReward = getRunSnapshot(run);
    observe(metrics, snapshot, afterReward, [], { routePhase: "complete" });
    snapshot = afterReward;
  }

  return {
    stageId,
    archetype: archetype.id,
    seed: SEED,
    terminal: snapshot.terminal,
    terminalTick: snapshot.tick,
    finalPhase: snapshot.objectives.phase,
    objectives: snapshot.objectives,
    objectiveOrder: objectiveOrderReceipt(snapshot),
    bossTtk: ttkReceipt(stageId, metrics.bossTtkTicks),
    gate: { integrity: snapshot.gate.integrity, maxIntegrity: snapshot.gate.maxIntegrity, minimum: metrics.minGateIntegrity },
    commander: { integrity: snapshot.commander.integrity, maxIntegrity: snapshot.commander.maxIntegrity, minimum: metrics.minCommanderIntegrity },
    progress: snapshot.progress,
    finalItemIds: snapshot.itemIds,
    finalSkillIds: snapshot.commander.skills,
    finalCompanionIds: snapshot.companions.map((entry) => entry.companionId),
    finalRewardIds: snapshot.rewardIds,
    metrics,
    actionDigest: hash(actionLog),
    finalDigest: hash(getRunDigest(run)),
  };
}

function replayProof(options, primary) {
  const replay = play(options);
  return {
    match: replay.finalDigest === primary.finalDigest && replay.actionDigest === primary.actionDigest,
    primaryFinalDigest: primary.finalDigest,
    replayFinalDigest: replay.finalDigest,
    primaryActionDigest: primary.actionDigest,
    replayActionDigest: replay.actionDigest,
  };
}

function summarizeTtk(runs) {
  return STAGES.map((stage) => {
    const frozen = TTK_TARGETS[stage.id];
    const samples = runs.filter((run) => run.stageId === stage.id && run.bossTtk.actual !== null);
    const inBand = samples.filter((run) => run.bossTtk.status === "IN_BAND");
    return {
      stageId: stage.id,
      ...frozen,
      expectedRuns: ARCHETYPES.length,
      sampleCount: samples.length,
      missingCount: ARCHETYPES.length - samples.length,
      inBandCount: inBand.length,
      outOfBandCount: samples.length - inBand.length,
      actuals: samples.map((run) => ({ archetype: run.archetype, ticks: run.bossTtk.actual, status: run.bossTtk.status })),
    };
  });
}

function summarizeMatrix(runs) {
  const perArchetype = ARCHETYPES.map(({ id, combat, offerPriority, rewardPriority }) => {
    const own = runs.filter((run) => run.archetype === id);
    const victories = own.filter((run) => run.terminal === "VICTORY" || run.terminal === "FINAL_COMPLETION").length;
    return {
      archetype: id, combat, offerPriority, rewardPriority,
      runs: own.length, terminalRuns: own.filter((run) => run.terminal).length,
      victories, winRate: victories / own.length,
      inBand: victories / own.length >= 0.45 && victories / own.length <= 0.55,
      occupationVisits: own.filter((run) => run.metrics.routeVisits.occupation).length,
      extractionVisits: own.filter((run) => run.metrics.routeVisits.extraction).length,
      extractions: own.reduce((sum, run) => sum + run.metrics.extractions.length, 0),
      items: own.reduce((sum, run) => sum + run.metrics.items.length, 0),
      skills: own.reduce((sum, run) => sum + run.metrics.skills.length, 0),
      orderedFullObjectiveRuns: own.filter((run) => run.objectiveOrder.full && run.objectiveOrder.ordered).length,
    };
  });
  const victories = runs.filter((run) => run.terminal === "VICTORY" || run.terminal === "FINAL_COMPLETION").length;
  return {
    runCount: runs.length,
    terminalRunCount: runs.filter((run) => run.terminal).length,
    unresolvedRunCount: runs.filter((run) => !run.terminal).length,
    replayMatches: runs.filter((run) => run.replay.match).length,
    victories,
    winRate: victories / runs.length,
    aggregateInBand: victories / runs.length >= 0.45 && victories / runs.length <= 0.55,
    viableArchetypes: perArchetype.filter((entry) => entry.inBand).length,
    perArchetype,
    ttkByStage: summarizeTtk(runs),
    ttkSampleCount: runs.filter((run) => run.bossTtk.actual !== null).length,
    ttkInBandCount: runs.filter((run) => run.bossTtk.status === "IN_BAND").length,
    orderedFullObjectiveRuns: runs.filter((run) => run.objectiveOrder.full && run.objectiveOrder.ordered).length,
    bossTtkTicks: runs.filter((run) => run.metrics.bossTtkTicks !== null).map((run) => ({ stageId: run.stageId, archetype: run.archetype, ticks: run.metrics.bossTtkTicks })),
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeAxes(pairs) {
  const axisNames = ["damagePerTick", "castsPer1000Ticks", "targetsPerCast", "integrityPer1000Ticks", "itemCompanionPerRun", "occupationPerRun", "bossEfficiency", "completionAction"];
  const medians = Object.fromEntries(axisNames.map((name) => [name, median(pairs.map((pair) => pair.axes[name]))]));
  for (const pair of pairs) {
    pair.normalizedAxes = Object.fromEntries(axisNames.map((name) => [name, medians[name] > 0 ? pair.axes[name] / medians[name] : pair.axes[name] === 0 ? 1 : 0]));
    pair.encounterEv = axisNames.reduce((sum, name) => sum + pair.normalizedAxes[name], 0) / axisNames.length;
  }
  const encounterMedian = median(pairs.map((pair) => pair.encounterEv));
  const encounterMaximum = Math.max(...pairs.map((pair) => pair.encounterEv));
  return { axisMedians: medians, encounterMedian, encounterMaximum, maxToMedianRatio: encounterMaximum / encounterMedian };
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
  const raw = pair.reduce((sum, id) => sum + SKILLS[id].damage / SKILLS[id].cooldown, 0);
  return {
    pair,
    encounterSamples: runs.length,
    terminalSamples: runs.filter((run) => run.terminal).length,
    pairAcquiredSamples: runs.filter((run) => pair.every((id) => run.finalSkillIds.includes(id))).length,
    rawProxy: raw,
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

const matrixRuns = [];
for (const archetype of ARCHETYPES) {
  for (const stage of STAGES) {
    const options = { stageId: stage.id, archetype };
    const primary = play(options);
    primary.replay = replayProof(options, primary);
    matrixRuns.push(primary);
  }
}

const pairs = [];
for (let left = 0; left < ACTIVE_SKILLS.length; left += 1) {
  for (let right = left + 1; right < ACTIVE_SKILLS.length; right += 1) pairs.push([ACTIVE_SKILLS[left], ACTIVE_SKILLS[right]]);
}
const pairEvidence = pairs.map((pair) => {
  const runs = STAGES.map((stage) => {
    const result = play({ stageId: stage.id, archetype: ARCHETYPES[4], pairPriority: pair, loadout: FULL_LOADOUT, rewardIds: FULL_REWARDS });
    return { ...result, occupationCaptured: result.objectives.occupation.completed };
  });
  return summarizePair(pair, runs);
});
const normalized = normalizeAxes(pairEvidence);
const rawMedian = median(pairEvidence.map((entry) => entry.rawProxy));
const rawMaximum = Math.max(...pairEvidence.map((entry) => entry.rawProxy));
const allPairsAcquired = pairEvidence.every((entry) => entry.pairAcquiredSamples > 0);
pairEvidence.forEach((entry) => {
  entry.normalizedEvidenceStatus = entry.pairAcquiredSamples > 0 ? "MEASURED" : "MISSING_PAIR_ACQUISITION";
});

const simulationHash = hash(await readFile(resolve("defense-run-simulation.js")));
const catalogHash = hash(await readFile(resolve("defense-catalog.js")));
const report = {
  schema: "abyssal-final-qa-v1",
  generatedAt: new Date().toISOString(),
  evidenceBoundary: "Deterministic automation using only exported createDefenseRun/getRunSnapshot/queueInput/advanceDefenseRun/isTerminalRun/getRunDigest APIs and public catalog constants; not human feedback.",
  exactCommand: `node _workspace/20260722-defense-survival-expansion/qa/run-final-matrix.mjs ${OUTPUT}`,
  inputs: { seed: SEED, maxTicks: MAX_TICKS, tickRate: TICK_RATE, stages: STAGES.map((stage) => stage.id), activeSkills: ACTIVE_SKILLS, requiredPhases: REQUIRED_PHASES, simulationSha256: simulationHash, catalogSha256: catalogHash },
  ttkTargetContract: {
    source: "_workspace/20260722-defense-survival-expansion/design/balance-sheet.md#frozen-pre-measurement-boss-ttk-targets",
    frozenBeforeActualInspection: true,
    grading: "Boss spawn-to-defeat ticks only; absent spawn/defeat is MISSING, never in-band.",
    targets: TTK_TARGETS,
  },
  controllerContract: ARCHETYPES,
  matrix: { summary: null, runs: matrixRuns },
  comboEncounterEv: {
    formula: "For each active pair over identical seed-17 ten-stage public-API probes: equal-weight arithmetic mean of eight axes normalized to the across-pair median: total observed/potential damage per tick; casts per 1000 ticks; targets per cast; integrity plus terrain recovery per 1000 ticks; item/companion count plus companion impact contribution per run; occupation visits/captures plus recovery per run; inverse median winning boss TTK; completion plus completed-objective action score. Raw proxy remains sum(damage/cooldownTicks), with void-aegis damage=0 and no area inflation.",
    identicalProbeInputs: { seed: SEED, stages: STAGES.map((stage) => stage.id), controller: "Generalist", companionLoadout: FULL_LOADOUT, rewardIds: FULL_REWARDS },
    raw: { median: rawMedian, maximum: rawMaximum, maxToMedianRatio: rawMaximum / rawMedian, cap: 1.30, pass: rawMaximum / rawMedian <= 1.30 },
    normalized: {
      ...normalized,
      cap: 1.30,
      allPairsAcquired,
      measuredPairCount: pairEvidence.filter((entry) => entry.pairAcquiredSamples > 0).length,
      requiredPairCount: pairEvidence.length,
      status: allPairsAcquired ? "MEASURED" : "BLOCKED",
      pass: allPairsAcquired ? normalized.maxToMedianRatio <= 1.30 : null,
    },
    pairs: pairEvidence,
  },
};
report.matrix.summary = summarizeMatrix(matrixRuns);
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ output: OUTPUT, matrix: report.matrix.summary, comboRaw: report.comboEncounterEv.raw, comboNormalized: report.comboEncounterEv.normalized }, null, 2)}\n`);
if (report.matrix.summary.runCount !== 50 || report.matrix.summary.terminalRunCount !== 50 || report.matrix.summary.replayMatches !== 50) process.exitCode = 1;
