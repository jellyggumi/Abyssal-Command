#!/usr/bin/env node
// Stage2 QA difficulty-margin probe (game-studio-harness, run-id 20260725-wellmade-verification).
//
// WHY THIS EXISTS: `scripts/run-g2-archetype-rotation.mjs` records outcome (victory/defeat), which
// saturated at 100% in both the RPG-active and RPG-inactive arms — a ceiling-bound metric cannot
// size *how far* from defeat a run was. This probe records the non-saturated margin signals the
// rotation sweep discards: terminal gate integrity, minimum gate integrity ever observed, minimum
// commander integrity ever observed, and companion DOWNED counts.
//
// Measurement-only: imports the shipped simulation and reads its state. Changes no game numbers.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDefenseRun, advanceDefenseRun, isTerminalRun, queueInput, getRunSnapshot } from "../defense-run-simulation.js";
import { STAGES } from "../campaign-state.js";
import { FORMATION_STANCES } from "../rpg-catalog.js";

function queueObjectiveCommands(run) {
  if (run.growthOffer) return queueInput(run, "SKILL_SELECTED", { skillId: run.growthOffer.choices[0] });
  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of run.commander.skills) next = queueInput(next, "SKILL_CAST", { skillId });
  if (run.eliteCandidate && !run.extracted) next = queueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId });
  return next;
}

/** Drives one bare stage (no campaign/RPG layer) and tracks the worst state ever reached. */
function probeStage({ stageId, seed, companionLoadout, stance = "VANGUARD", maxSteps = 20000 }) {
  let run = createDefenseRun({ stageId, seed, companionLoadout });
  // Stance is only reachable through the in-run STANCE_CYCLE input (VANGUARD -> TURRET -> SPLIT),
  // each switch gated by a 4s cooldown. Cycle to the requested stance before the fight starts.
  const cycles = FORMATION_STANCES.indexOf(stance);
  for (let i = 0; i < cycles; i += 1) {
    run = advanceDefenseRun(queueInput(run, "STANCE_CYCLE"), 1);
    run = advanceDefenseRun(run, 4 * 60); // clear the 4-second switch cooldown
  }
  const reachedStance = getRunSnapshot(run).formationStance;

  let minGate = Infinity, minCmd = Infinity, downed = 0, companionDamage = 0, companionDamageTaken = 0, bossSpawnedAt = null;
  for (let step = 0; step < maxSteps && !isTerminalRun(run); step += 1) {
    run = advanceDefenseRun(queueObjectiveCommands(run), 1);
    if (run.gate.integrity < minGate) minGate = run.gate.integrity;
    if (run.commander.integrity < minCmd) minCmd = run.commander.integrity;
    if (run.bossSpawned && bossSpawnedAt === null) bossSpawnedAt = run.tick;
    // `emit()` spreads the payload flat onto the event (defense-run-simulation.js:42-52) — fields are
    // `e.damage`, not `e.payload.damage`. Companion fires tag `owner` with the *companionId*
    // (`fire(run, companion, target, dmg, companion.companionId)` at :1628), not the literal
    // string "companion", so companion shots are identified by their entityId prefix instead.
    for (const e of run.events) {
      if (e.type === "COMPANION_DOWNED") downed += 1;
      else if (e.type === "COMPANION_DAMAGED") companionDamageTaken += e.damage ?? 0;
      else if (e.type === "WEAPON_FIRED" && typeof e.entityId === "string" && e.entityId.startsWith("companion")) companionDamage += e.damage ?? 0;
    }
  }
  const snap = getRunSnapshot(run);
  return {
    stageId, seed, stance: reachedStance, terminal: run.terminal, ticksUsed: run.tick,
    bossTtkTicks: bossSpawnedAt === null ? null : run.tick - bossSpawnedAt,
    gateMax: run.gate.maxIntegrity,
    gateEnd: run.gate.integrity, gateMin: minGate === Infinity ? run.gate.integrity : minGate,
    gateMinPct: +(100 * (minGate === Infinity ? run.gate.integrity : minGate) / run.gate.maxIntegrity).toFixed(2),
    commanderMax: run.commander.maxIntegrity,
    commanderEnd: run.commander.integrity, commanderMin: minCmd === Infinity ? run.commander.integrity : minCmd,
    commanderMinPct: +(100 * (minCmd === Infinity ? run.commander.integrity : minCmd) / run.commander.maxIntegrity).toFixed(2),
    companionsDowned: downed, companionDamageDealt: companionDamage, companionDamageTaken,
    frontCount: snap.companions.filter((c) => c.slot === "FRONT").length,
  };
}

const args = process.argv.slice(2);
const outIdx = args.indexOf("--output");
const output = outIdx === -1 ? null : args[outIdx + 1];
const seedsIdx = args.indexOf("--seeds");
const seeds = seedsIdx === -1 ? [301, 302, 303, 304, 305] : args[seedsIdx + 1].split(",").map((s) => Number(s.trim()));
const stancesIdx = args.indexOf("--stances");
const stances = stancesIdx === -1 ? ["VANGUARD"] : args[stancesIdx + 1].split(",").map((s) => s.trim());
const loadoutIdx = args.indexOf("--loadout");
const loadout = loadoutIdx === -1 ? ["ember-cohort", "rift-lens", "veil-vanguard"] : args[loadoutIdx + 1].split(",").map((s) => s.trim());

if (!output || output.startsWith("-")) {
  console.error("Usage: node run-g2-margin-probe.mjs --output <path.json> [--seeds 301,...] [--stances VANGUARD,TURRET,SPLIT] [--loadout a,b,c]");
  process.exit(1);
}

const t0 = Date.now();
const results = [];
for (const stance of stances) {
  for (const stage of STAGES) {
    for (const seed of seeds) {
      results.push(probeStage({ stageId: stage.id, seed: seed * 1000 + STAGES.findIndex((s) => s.id === stage.id), companionLoadout: loadout, stance }));
    }
  }
}
const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(results), "utf8");
console.log(`margin-probe: ${results.length} runs in ${Date.now() - t0}ms, stances=${stances.join(",")}, wrote ${outputPath}`);
