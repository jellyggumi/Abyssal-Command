#!/usr/bin/env node
// Stage2 QA G3 stance-event probe (run-id 20260725-wellmade-verification).
//
// Counts the two FRONT>=1-gated mechanics the prior cycle flagged as structurally excluding TURRET:
//   1. BOSS_RALLY_WINDOW  (rpg-catalog.js BOSS_RALLY_COOLDOWN_REDUCTION, fires only with >=1 living FRONT)
//   2. BACK_ROW_SYNERGY_DAMAGE_BONUS (+25% to BACK companions, also gated on >=1 living FRONT)
// and records whether companion damage-taken ever converts into an actual COMPANION_DOWNED.
//
// Measurement-only: imports the shipped simulation, asserts nothing, changes no game numbers.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDefenseRun, advanceDefenseRun, isTerminalRun, queueInput, getRunSnapshot } from "../defense-run-simulation.js";
import { STAGES } from "../campaign-state.js";
import { FORMATION_STANCES, BACK_ROW_SYNERGY_DAMAGE_BONUS } from "../rpg-catalog.js";
import { COMPANIONS } from "../defense-catalog.js";

function queueObjectiveCommands(run) {
  if (run.growthOffer) return queueInput(run, "SKILL_SELECTED", { skillId: run.growthOffer.choices[0] });
  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of run.commander.skills) next = queueInput(next, "SKILL_CAST", { skillId });
  if (run.eliteCandidate && !run.extracted) next = queueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId });
  return next;
}

function probe({ stageId, seed, companionLoadout, stance, maxSteps = 20000 }) {
  let run = createDefenseRun({ stageId, seed, companionLoadout });
  for (let i = 0; i < FORMATION_STANCES.indexOf(stance); i += 1) {
    run = advanceDefenseRun(queueInput(run, "STANCE_CYCLE"), 1);
    run = advanceDefenseRun(run, 4 * 60);
  }
  let rally = 0, downed = 0, taken = 0, dealt = 0, synergyShots = 0, rawShots = 0;
  // A BACK companion firing with the synergy active deals round(base * 1.25); without it, round(base).
  // Comparing each companion shot against its own catalog base damage separates the two populations
  // without instrumenting the simulation.
  const synergyDamageFor = (cid) => Math.round(COMPANIONS[cid].damage * (1 + BACK_ROW_SYNERGY_DAMAGE_BONUS));
  const idToCompanion = new Map();
  for (const c of getRunSnapshot(run).companions) idToCompanion.set(c.id ?? c.entityId, c.companionId);
  for (let step = 0; step < maxSteps && !isTerminalRun(run); step += 1) {
    run = advanceDefenseRun(queueObjectiveCommands(run), 1);
    for (const e of run.events) {
      if (e.type === "BOSS_RALLY_WINDOW") rally += 1;
      else if (e.type === "COMPANION_DOWNED") downed += 1;
      else if (e.type === "COMPANION_DAMAGED") taken += e.damage ?? 0;
      else if (e.type === "WEAPON_FIRED" && typeof e.entityId === "string" && e.entityId.startsWith("companion")) {
        dealt += e.damage ?? 0;
        const cid = idToCompanion.get(e.entityId) ?? run.companions.find((c) => c.id === e.entityId)?.companionId;
        if (cid && COMPANIONS[cid]) {
          if ((e.baseDamage ?? e.damage) === synergyDamageFor(cid)) synergyShots += 1;
          else if ((e.baseDamage ?? e.damage) === COMPANIONS[cid].damage) rawShots += 1;
        }
      }
    }
  }
  return {
    stageId, seed, stance, terminal: run.terminal, ticksUsed: run.tick,
    bossRallyWindows: rally, companionsDowned: downed, companionDamageTaken: taken,
    companionDamageDealt: dealt, synergyBuffedShots: synergyShots, rawShots,
    frontCount: getRunSnapshot(run).companions.filter((c) => c.slot === "FRONT").length,
  };
}

const args = process.argv.slice(2);
const outIdx = args.indexOf("--output");
const output = outIdx === -1 ? null : args[outIdx + 1];
const seedsIdx = args.indexOf("--seeds");
const seeds = seedsIdx === -1 ? [301, 302, 303, 304, 305] : args[seedsIdx + 1].split(",").map((s) => Number(s.trim()));
if (!output || output.startsWith("-")) {
  console.error("Usage: node run-g3-stance-events.mjs --output <path.json> [--seeds 301,...]");
  process.exit(1);
}

const loadout = ["ember-cohort", "rift-lens", "veil-vanguard"];
const t0 = Date.now();
const results = [];
for (const stance of FORMATION_STANCES) {
  for (const stage of STAGES) {
    for (const seed of seeds) {
      results.push(probe({ stageId: stage.id, seed: seed * 1000 + STAGES.findIndex((s) => s.id === stage.id), companionLoadout: loadout, stance }));
    }
  }
}
const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(results), "utf8");
console.log(`g3-stance-events: ${results.length} runs in ${Date.now() - t0}ms, wrote ${outputPath}`);
