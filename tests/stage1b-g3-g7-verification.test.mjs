import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceDefenseRun,
  createDefenseRun,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";
import { SKILLS } from "../defense-catalog.js";

const LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];
const ACTIVE_SKILL_IDS = new Set(
  Object.values(SKILLS).filter((skill) => skill.kind === "active").map((skill) => skill.id),
);
const MACRO_REWARD_TYPES = new Set([
  "GROWTH_OFFER",
  "SKILL_SELECTED",
  "ELITE_CANDIDATE_AVAILABLE",
  "EXTRACTION_WINDOW_OPENED",
  "EXTRACTION_COMPLETED",
  "ELITE_EXTRACTED",
]);

function collectSample({ seed = 401, switchAfterRally = false } = {}) {
  let run = createDefenseRun({ stageId: "cinder-span", seed, companionLoadout: LOADOUT });
  let seenEventSequence = -1;
  let switchRequested = false;
  const events = [];

  for (let step = 0; step < 20_000 && !isTerminalRun(run); step += 1) {
    let next = run;
    if (run.growthOffer) {
      next = queueInput(next, "SKILL_SELECTED", { skillId: run.growthOffer.choices[0] });
    } else {
      next = queueInput(next, "MOVE", { octant: "IDLE" });
      for (const skillId of run.commander.skills) {
        if (ACTIVE_SKILL_IDS.has(skillId) && (run.commander.cooldowns[skillId] ?? 0) <= 0) {
          next = queueInput(next, "SKILL_CAST", { skillId });
        }
      }
      if (run.eliteCandidate && !run.extracted) {
        next = queueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId });
      }
      if (
        switchAfterRally
        && !switchRequested
        && run.events.some((event) => event.type === "BOSS_RALLY_WINDOW")
        && run.formationStance !== "TURRET"
        && run.tick >= (run.stanceCooldownUntilTick ?? 0)
      ) {
        next = queueInput(next, "STANCE_CYCLE", {});
        switchRequested = true;
      }
    }

    run = advanceDefenseRun(next, 1);
    for (const event of run.events) {
      if (event.eventSequence > seenEventSequence) {
        seenEventSequence = event.eventSequence;
        events.push(event);
      }
    }
  }

  assert.ok(isTerminalRun(run), `seed ${seed} must reach a terminal run`);
  return { run, events };
}

function dedupeMacroRewardBoundaries(events) {
  const boundaries = [];
  for (const reward of events.filter((event) => MACRO_REWARD_TYPES.has(event.type))) {
    const previous = boundaries.at(-1);
    const sameTickType = previous && previous.tick === reward.tick && previous.type === reward.type;
    const growthSelectionPair = previous?.type === "GROWTH_OFFER" && reward.type === "SKILL_SELECTED";
    if (sameTickType || growthSelectionPair) continue;
    boundaries.push(reward);
  }
  return boundaries;
}

test("G3 accepted stance attribution precedes INPUT_ACCEPTED and preserves boss-grace NOT_EXPOSED", () => {
  const { events } = collectSample({ seed: 401, switchAfterRally: true });
  const bossSpawned = events.find((event) => event.type === "BOSS_SPAWNED");
  const accepted = events.find((event) => event.type === "INPUT_ACCEPTED" && event.inputType === "STANCE_CYCLE");
  const switched = events.find((event) => event.type === "STANCE_SWITCHED" && event.tick === accepted?.tick);

  assert.ok(bossSpawned, "the G3 sample must observe a boss arrival");
  assert.ok(accepted, "the G3 sample must observe an accepted stance switch");
  assert.ok(switched, "the accepted switch must have a same-tick STANCE_SWITCHED event");
  assert.equal(switched.tick, accepted.tick);
  assert.ok(switched.eventSequence < accepted.eventSequence, "STANCE_SWITCHED is the causal transition anchor");

  const gracePressure = events.filter((event) => (
    event.tick >= accepted.tick
    && event.tick < bossSpawned.tick + 1_800
    && (event.type === "COMPANION_DAMAGED" || event.type === "COMPANION_DOWNED")
  ));
  assert.equal(gracePressure.length, 0, "boss-grace pressure must not be treated as exposure");
});

test("G7 shipped controller casts active skills only and reaches accepted extraction", () => {
  const { run, events } = collectSample({ seed: 401 });
  const skillCasts = events.filter((event) => event.type === "SKILL_CAST");
  assert.ok(skillCasts.length > 0, "the sample must exercise skill casting");
  assert.ok(skillCasts.every((event) => ACTIVE_SKILL_IDS.has(event.skillId)), "passive skills must never be SKILL_CAST");
  assert.ok(events.some((event) => event.type === "GROWTH_OFFER"), "growth must be observable");
  assert.ok(events.some((event) => event.type === "EXTRACTION_WINDOW_OPENED"), "extraction hold must be observable");
  assert.ok(events.some((event) => event.type === "ELITE_EXTRACTED"), "accepted extraction must be observable");
  assert.equal(run.terminal, "VICTORY");
});

test("G7 macro boundary dedupe treats growth selection and duplicate records as one boundary", () => {
  const boundaries = dedupeMacroRewardBoundaries([
    { type: "GROWTH_OFFER", tick: 10 },
    { type: "SKILL_SELECTED", tick: 10 },
    { type: "SKILL_SELECTED", tick: 10 },
    { type: "ELITE_CANDIDATE_AVAILABLE", tick: 20 },
    { type: "ELITE_CANDIDATE_AVAILABLE", tick: 20 },
    { type: "EXTRACTION_COMPLETED", tick: 30 },
  ]);

  assert.deepEqual(
    boundaries.map(({ type, tick }) => `${type}@${tick}`),
    ["GROWTH_OFFER@10", "ELITE_CANDIDATE_AVAILABLE@20", "EXTRACTION_COMPLETED@30"],
  );
});
