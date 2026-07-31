#!/usr/bin/env node
/**
 * Deterministic pacing measurement for a stage (prompts/approved/01-encounter-progression.md).
 *
 * Runs the same objective-seeking bot the wave-doctrine suite uses, over several seeds, and reports
 * the numbers a retune has to be argued against: clear time, peak living enemies, peak committed
 * attackers, objective attempts, and the outcome. It only reads the simulation; it never writes
 * catalog data.
 *
 *   node scripts/measure-stage-pacing.mjs cinder-span 101 71 73
 */
import { OCTANT_VECTORS, STAGE_ENCOUNTER_ROUTES, SKILLS, TICK_RATE } from "../defense-catalog.js";
import {
  advanceDefenseRun, createDefenseRun, getRunSnapshot, isTerminalRun, queueInput,
} from "../defense-run-simulation.js";

const stageId = process.argv[2] ?? "cinder-span";
const seeds = process.argv.slice(3).map(Number).filter(Number.isFinite);
const seedList = seeds.length ? seeds : [101, 71, 73];
const cap = STAGE_ENCOUNTER_ROUTES[stageId].commitmentCap;

const octantFor = (dx, dy) => {
  let best = "IDLE";
  let bestDot = -Infinity;
  const length = Math.hypot(dx, dy) || 1;
  for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
    if (name === "IDLE") continue;
    const vectorLength = Math.hypot(vector.x, vector.y) || 1;
    const dot = ((dx / length) * (vector.x / vectorLength)) + ((dy / length) * (vector.y / vectorLength));
    if (dot > bestDot) { bestDot = dot; best = name; }
  }
  return best;
};

function measure(seed) {
  let run = createDefenseRun({ stageId, seed });
  let ticks = 0;
  let lastOctant = null;
  let peakLiving = 0;
  let peakCommitted = 0;
  const attempts = new Map();
  while (!isTerminalRun(run) && ticks < TICK_RATE * 60 * 8) {
    const snapshot = getRunSnapshot(run);
    peakLiving = Math.max(peakLiving, snapshot.enemies.filter((enemy) => enemy.hp > 0).length);
    peakCommitted = Math.max(peakCommitted, snapshot.encounter?.committedAttackerCount ?? 0);
    for (const objective of Object.values(snapshot.encounter?.objectives ?? {})) {
      attempts.set(objective.id, Math.max(attempts.get(objective.id) ?? 0, objective.attempts ?? 0));
    }
    if (snapshot.growthOffer) {
      run = queueInput(run, "GROWTH_OFFER_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    } else {
      const ready = snapshot.commander.skills
        .filter((skillId) => SKILLS[skillId]?.kind === "active" && (snapshot.commander.cooldowns?.[skillId] ?? 0) === 0);
      if (ready.length) run = queueInput(run, "SKILL_CAST", { skillId: ready[0] });
      if (snapshot.eliteCandidate) run = queueInput(run, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
    }
    const phase = snapshot.objectives.phase;
    const living = snapshot.enemies.filter((enemy) => enemy.hp > 0);
    let target = null;
    if (phase === "occupation") target = snapshot.tactics.occupation;
    else if (phase === "extraction") target = snapshot.tactics.extraction;
    else if (living.length) {
      target = living.slice().sort((left, right) =>
        (((left.x - snapshot.commander.x) ** 2) + ((left.y - snapshot.commander.y) ** 2))
        - (((right.x - snapshot.commander.x) ** 2) + ((right.y - snapshot.commander.y) ** 2)))[0];
    }
    if (target) {
      const distance = Math.hypot(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
      const octant = target.radius && distance < target.radius * 0.5
        ? "IDLE"
        : octantFor(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
      if (octant !== lastOctant) {
        run = queueInput(run, "MOVE_OCTANT", { octant });
        lastOctant = octant;
      }
    }
    run = advanceDefenseRun(run, 1);
    ticks += 1;
  }
  const snapshot = getRunSnapshot(run);
  return {
    seed,
    seconds: Math.round(ticks / TICK_RATE),
    outcome: snapshot.result ?? snapshot.outcome ?? snapshot.objectives?.phase ?? (isTerminalRun(run) ? "terminal" : "timeout"),
    peakLiving,
    peakCommitted,
    cap,
    attempts: [...attempts.entries()].map(([id, count]) => `${id}:${count}`).join(" "),
  };
}

const rows = seedList.map(measure);
console.log(`stage: ${stageId}   commitment cap: ${cap}`);
console.log("| seed | seconds | outcome | peak living | peak committed | objective attempts |");
console.log("|---|---|---|---|---|---|");
for (const row of rows) {
  console.log(`| ${row.seed} | ${row.seconds} | ${row.outcome} | ${row.peakLiving} | ${row.peakCommitted} | ${row.attempts} |`);
}
const seconds = rows.map((row) => row.seconds);
console.log(`\nclear-time band: ${Math.min(...seconds)}-${Math.max(...seconds)}s (doctrine window 180-360s)`);
