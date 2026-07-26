#!/usr/bin/env node
/**
 * Stage 1b formation-agency measurement.
 *
 * Measurement only: drives the shipped deterministic simulation without changing
 * catalog or balance values. Every explicit FRONT/BACK intent is paired against
 * the no-intent baseline with the same stage, seed, loadout, and input policy.
 *
 * Usage:
 *   node scripts/run-formation-agency-measurements.mjs --output <path.json> [--seeds 401,402]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

const LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];

function queueObjectiveCommands(run) {
  if (run.growthOffer) return queueInput(run, "SKILL_SELECTED", { skillId: run.growthOffer.choices[0] });
  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of run.commander.skills) next = queueInput(next, "SKILL_CAST", { skillId });
  if (run.eliteCandidate && !run.extracted) {
    next = queueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId });
  }
  return next;
}

function measure({ seed, formation = {}, maxTicks = 20000 }) {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed,
    companionLoadout: LOADOUT,
    formation,
  });
  const committed = getRunSnapshot(run).companions.map(({ companionId, slot }, index) => ({
    positionRank: index + 1,
    companionId,
    slot,
  }));
  const damageTaken = Object.fromEntries(LOADOUT.map((id) => [id, 0]));
  let companionDamageDealt = 0;
  let gateDamageTaken = 0;
  let stanceTransitions = 0;
  let eventSequence = 0;

  while (!isTerminalRun(run) && run.tick < maxTicks) {
    run = advanceDefenseRun(queueObjectiveCommands(run), 1);
    for (const event of run.events) {
      if ((event.eventSequence ?? 0) <= eventSequence) continue;
      eventSequence = Math.max(eventSequence, event.eventSequence ?? 0);
      if (event.type === "COMPANION_DAMAGED" && damageTaken[event.companionId] !== undefined) {
        damageTaken[event.companionId] += event.damage ?? 0;
      } else if (event.type === "WEAPON_FIRED" && String(event.entityId ?? "").startsWith("companion")) {
        companionDamageDealt += event.damage ?? 0;
      } else if (event.type === "GATE_BREACHED") {
        gateDamageTaken += event.damage ?? 0;
      } else if (event.type === "STANCE_CHANGED") {
        stanceTransitions += 1;
      }
    }
  }

  const snapshot = getRunSnapshot(run);
  return {
    seed,
    formation,
    committed,
    terminal: snapshot.terminal,
    ticksUsed: snapshot.tick,
    gateIntegrity: snapshot.gate.integrity,
    commanderIntegrity: snapshot.commander.integrity,
    companionDamageTaken: damageTaken,
    companionDamageDealt,
    gateDamageTaken,
    stanceTransitions,
  };
}

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const output = outputIndex === -1 ? null : args[outputIndex + 1];
const seedsIndex = args.indexOf("--seeds");
const seeds = seedsIndex === -1
  ? [401, 402, 403, 404, 405]
  : args[seedsIndex + 1].split(",").map((value) => Number(value.trim()));

if (!output || output.startsWith("-") || seeds.some((seed) => !Number.isInteger(seed))) {
  console.error("Usage: node scripts/run-formation-agency-measurements.mjs --output <path.json> [--seeds 401,402]");
  process.exit(1);
}

const profiles = [];
for (let mask = 1; mask < (1 << LOADOUT.length) - 1; mask += 1) {
  const formation = Object.fromEntries(LOADOUT.map((id, index) => [id, mask & (1 << index) ? "FRONT" : "BACK"]));
  profiles.push({ id: `front-mask-${mask}`, formation });
}

const pairs = [];
const startedAt = Date.now();
for (const seed of seeds) {
  const baseline = measure({ seed });
  for (const profile of profiles) {
    const candidate = measure({ seed, formation: profile.formation });
    pairs.push({
      stageId: "cinder-span",
      seed,
      profileId: profile.id,
      baseline,
      candidate,
      delta: {
        ticksUsed: candidate.ticksUsed - baseline.ticksUsed,
        gateIntegrity: candidate.gateIntegrity - baseline.gateIntegrity,
        commanderIntegrity: candidate.commanderIntegrity - baseline.commanderIntegrity,
        companionDamageDealt: candidate.companionDamageDealt - baseline.companionDamageDealt,
        gateDamageTaken: candidate.gateDamageTaken - baseline.gateDamageTaken,
      },
    });
  }
}

const payload = {
  schemaVersion: 1,
  classification: "deterministic-scripted-measurement-not-human-playtest",
  stageId: "cinder-span",
  loadout: LOADOUT,
  seeds,
  profiles: profiles.map(({ id, formation }) => ({ id, formation })),
  pairCount: pairs.length,
  pairs,
};
const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(payload), "utf8");
console.log(`formation-agency: ${pairs.length} paired runs in ${Date.now() - startedAt}ms, wrote ${outputPath}`);
