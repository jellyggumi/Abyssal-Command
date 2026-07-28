#!/usr/bin/env node
/**
 * Stage playtime + wave-composition instrumentation (game-studio harness,
 * run-id 20260728-stage-playtime-doctrine).
 *
 * MEASUREMENT ONLY — imports the shipped simulation unmodified and observes it. Drives an
 * objective-seeking bot (the same "always repositioning toward the current objective" policy
 * `scripts/measure-g7-core-loop.mjs` uses) and reports, per stage:
 *
 *   - terminal outcome + run length in seconds     -> the 180-360 s playtime target
 *   - wave count by kind (normal / big / mid)      -> authored pacing actually reached the run
 *   - mid-boss spawns and their kill ticks         -> mid-wave spike landed and was resolvable
 *   - growth offers / skill ranks                  -> level-up cadence over the longer stage
 *
 * Usage:
 *   node scripts/measure-stage-playtime.mjs [--output <path.json>] [--seeds 3] [--stages a,b]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  createDefenseRun, advanceDefenseRun, isTerminalRun, queueInput, getRunSnapshot, TICK_RATE,
} from "../defense-run-simulation.js";
import { STAGES, OCTANT_VECTORS, SKILLS } from "../defense-catalog.js";

const PLAYTIME_TARGET_SECONDS = Object.freeze({ min: 180, max: 360 });
const MAX_TICKS = 60 * 60 * 8; // 8 minutes of simulated time is a hard runaway guard.

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const outputPath = argValue("--output", null);
const seedCount = Number(argValue("--seeds", "3"));
const stageFilter = argValue("--stages", null)?.split(",").map((value) => value.trim()).filter(Boolean) ?? null;

const octantFor = (dx, dy) => {
  let best = "IDLE";
  let bestDot = -Infinity;
  const length = Math.hypot(dx, dy) || 1;
  for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
    if (name === "IDLE") continue;
    const vectorLength = Math.hypot(vector.x, vector.y) || 1;
    const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
    if (dot > bestDot) { bestDot = dot; best = name; }
  }
  return best;
};

/** Objective-seeking target: fight the nearest enemy, then walk the objective point of the phase. */
function botTarget(snapshot) {
  const phase = snapshot.objectives.phase;
  const living = snapshot.enemies.filter((enemy) => enemy.hp > 0);
  if (phase === "occupation" && snapshot.tactics?.occupation) return snapshot.tactics.occupation;
  if (phase === "extraction" && snapshot.tactics?.extraction) return snapshot.tactics.extraction;
  if (!living.length) return null;
  const commander = snapshot.commander;
  return living.slice().sort((left, right) =>
    ((left.x - commander.x) ** 2 + (left.y - commander.y) ** 2)
    - ((right.x - commander.x) ** 2 + (right.y - commander.y) ** 2))[0];
}

function measureRun(stageId, seed) {
  let run = createDefenseRun({ stageId, seed });
  const wavesByKind = { normal: 0, big: 0, mid: 0 };
  const midbossSpawns = [];
  const midbossKills = [];
  let growthOffers = 0;
  let skillSelections = 0;
  let rankUps = 0;
  let lastOctant = null;
  let ticks = 0;

  while (!isTerminalRun(run) && ticks < MAX_TICKS) {
    const snapshot = getRunSnapshot(run);
    for (const event of snapshot.events) {
      if (event.type === "WAVE_VARIANT_STARTED") wavesByKind[event.kind ?? "normal"] += 1;
      if (event.type === "MIDBOSS_SPAWNED") midbossSpawns.push({ tick: snapshot.tick, midbossId: event.midbossId });
      if (event.type === "ENEMY_DEFEATED" && event.midbossId) midbossKills.push({ tick: snapshot.tick, midbossId: event.midbossId });
      if (event.type === "GROWTH_OFFER") growthOffers += 1;
      if (event.type === "SKILL_SELECTED") {
        skillSelections += 1;
        if ((event.rank ?? 1) > 1) rankUps += 1;
      }
    }
    if (snapshot.growthOffer) {
      run = queueInput(run, "GROWTH_OFFER_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    } else {
      const activeReady = snapshot.commander.skills
        .filter((skillId) => SKILLS[skillId]?.kind === "active" && (snapshot.commander.cooldowns?.[skillId] ?? 0) === 0);
      if (activeReady.length && snapshot.enemies.some((enemy) => enemy.hp > 0)) {
        run = queueInput(run, "SKILL_CAST", { skillId: activeReady[0] });
      }
      if (snapshot.eliteCandidate) run = queueInput(run, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
    }
    const target = botTarget(snapshot);
    if (target) {
      // Standing INSIDE an objective point is what occupation/extraction require; walking past it
      // forever is the classic bot failure, so hold position once inside half the point radius.
      const distance = Math.hypot(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
      const octant = target.radius && distance < target.radius * 0.5
        ? "IDLE"
        : octantFor(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
      if (octant !== lastOctant) {
        run = queueInput(run, "MOVE", { octant });
        lastOctant = octant;
      }
    }
    run = advanceDefenseRun(run, 1);
    ticks += 1;
  }

  const snapshot = getRunSnapshot(run);
  return {
    stageId,
    seed,
    terminal: snapshot.terminal ?? "TIMEOUT",
    ticks,
    seconds: Number((ticks / TICK_RATE).toFixed(2)),
    withinTarget: snapshot.terminal !== null
      && ticks / TICK_RATE >= PLAYTIME_TARGET_SECONDS.min
      && ticks / TICK_RATE <= PLAYTIME_TARGET_SECONDS.max,
    wavesByKind,
    midbossSpawns: midbossSpawns.length,
    midbossKills: midbossKills.length,
    growthOffers,
    skillSelections,
    rankUps,
    finalLevel: snapshot.commander.level,
    gateIntegrity: snapshot.gate.integrity,
  };
}

const stageIds = (stageFilter ?? STAGES.map((stage) => stage.id));
const seeds = Array.from({ length: seedCount }, (unused, index) => 101 + index * 37);
const runs = [];
for (const stageId of stageIds) {
  for (const seed of seeds) runs.push(measureRun(stageId, seed));
}
const summaries = stageIds.map((stageId) => {
  const stageRuns = runs.filter((run) => run.stageId === stageId);
  const secondsList = stageRuns.map((run) => run.seconds).sort((left, right) => left - right);
  return {
    stageId,
    runs: stageRuns.length,
    victories: stageRuns.filter((run) => run.terminal === "VICTORY" || run.terminal === "FINAL_COMPLETION").length,
    medianSeconds: secondsList[Math.floor(secondsList.length / 2)],
    minSeconds: secondsList[0],
    maxSeconds: secondsList.at(-1),
    withinTarget: stageRuns.filter((run) => run.withinTarget).length,
    midbossSpawns: stageRuns.reduce((sum, run) => sum + run.midbossSpawns, 0),
  };
});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  runId: "20260728-stage-playtime-doctrine",
  method: "objective-seeking bot, shipped simulation imported unmodified",
  tickRate: TICK_RATE,
  playtimeTargetSeconds: PLAYTIME_TARGET_SECONDS,
  seeds,
  summaries,
  runs,
};

if (outputPath) {
  const absolute = resolve(process.cwd(), outputPath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
for (const summary of summaries) {
  console.log(
    `${summary.stageId.padEnd(20)} victories=${summary.victories}/${summary.runs}`
    + ` median=${summary.medianSeconds}s range=${summary.minSeconds}-${summary.maxSeconds}s`
    + ` inTarget=${summary.withinTarget}/${summary.runs} midboss=${summary.midbossSpawns}`,
  );
}
