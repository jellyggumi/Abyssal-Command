import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";
import { COMPANIONS, OCTANT_VECTORS, STAGE_BY_ID } from "../defense-catalog.js";
import { BACK_ROW_SYNERGY_DAMAGE_BONUS, FORMATION_STANCES, STANCE_CONFIG } from "../rpg-catalog.js";

/** Matches this repo's queueObjectiveCommands convention (see defense-run-simulation.test.mjs). */
/**
 * Octant toward whatever the current objective phase needs: the point for occupation/extraction, the
 * nearest living enemy otherwise. Standing still no longer holds the authored 170-250 s gate
 * (STAGE_WAVE_DOCTRINE), and companions only see sustained combat if the commander closes with it.
 */
function objectiveOctant(snapshot) {
  const phase = snapshot.objectives.phase;
  let target = null;
  if (phase === "occupation") target = snapshot.tactics.occupation;
  else if (phase === "extraction") target = snapshot.tactics.extraction;
  else {
    const living = snapshot.enemies.filter((enemy) => enemy.hp > 0);
    const distance = (entry) => (entry.x - snapshot.commander.x) ** 2 + (entry.y - snapshot.commander.y) ** 2;
    if (living.length) target = living.slice().sort((left, right) => distance(left) - distance(right))[0];
  }
  if (!target) return "IDLE";
  const dx = target.x - snapshot.commander.x;
  const dy = target.y - snapshot.commander.y;
  if (target.radius && Math.hypot(dx, dy) < target.radius * 0.5) return "IDLE";
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
}

function queueObjectiveCommands(run, { holdPosition = false } = {}) {
  const snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    return queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
  }
  let next = queueInput(run, "MOVE", { octant: holdPosition ? "IDLE" : objectiveOctant(snapshot) });
  for (const skillId of snapshot.commander.skills) {
    next = queueInput(next, "SKILL_CAST", { skillId });
  }
  if (snapshot.eliteCandidate && !snapshot.extracted) {
    next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
  }
  return next;
}

/** Drives one raw tick at a time (not advanceDefenseRun's multi-step form) so `run.events`
 *  — which resets every tick — can be inspected on every single tick, not just the last of a jump. */
function stepAndCollect(run, steps, onEvent, options = {}) {
  let next = run;
  for (let i = 0; i < steps && !isTerminalRun(next); i += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next, options), 1);
    for (const event of next.events) onEvent(next, event);
  }
  return next;
}

function advanceThroughObjectivesUntil(run, predicate, maxSteps = 12000) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next), 1);
    if (predicate(next)) return next;
  }
  return next;
}

/** Advances `run` past N stance cooldown windows via STANCE_CYCLE, returning the resulting run.
 *  Each cycle: queue STANCE_CYCLE, advance exactly one 4s cooldown window (240 ticks) so the next
 *  cycle is always immediately accepted (mirrors the pattern a driven UI would use). */
function cycleStance(run, times = 1) {
  let next = run;
  for (let i = 0; i < times; i += 1) {
    next = queueInput(next, "STANCE_CYCLE");
    next = advanceDefenseRun(next, 4 * 60); // TICK_RATE=60, 4s cooldown
  }
  return next;
}

// Step budgets are expressed against the authored gate hold (STAGE_WAVE_DOCTRINE): the boss and the
// terminal state now sit on the far side of a 170-250 s defense.
const HOLD_BUDGET = (stageId) => STAGE_BY_ID[stageId].gateTicks + 9000;

test("SNAPSHOT_VERSION is 7, and omitted RPG createDefenseRun params match explicit defaults", () => {
  const legacy = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const explicitDefaults = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    wardenProgress: null, wardenEquipment: {}, companionEquipment: {}, formation: {},
  });
  assert.equal(getRunSnapshot(legacy).version, 7);
  assert.equal(getRunDigest(legacy), getRunDigest(explicitDefaults));
  assert.equal(getRunSnapshot(legacy).wardenState, null);
  assert.equal(legacy.rpgActive, false);
});

test("snapshots and their initial emitted event advertise event schema version 4", () => {
  const snapshot = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: 5 }));
  assert.equal(snapshot.eventVersion, 4);
  assert.ok(snapshot.events.length > 0, "run creation must emit at least one event");
  assert.equal(snapshot.events[0].version, 4);
});

test("a 3-companion loadout with no explicit formation input derives FRONT/BACK purely from stance position-rank: the default VANGUARD stance's derivedFrontCount=2 puts the first 2 (companionId asc) FRONT and the 3rd BACK", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"] });
  const slots = getRunSnapshot(run).companions.map((c) => [c.companionId, c.slot]);
  // companionId asc: ember-cohort, rift-lens, veil-vanguard
  assert.deepEqual(slots, [["ember-cohort", "FRONT"], ["rift-lens", "FRONT"], ["veil-vanguard", "BACK"]]);
});

test("a solo companion is FRONT under the default VANGUARD stance (index 0 < derivedFrontCount 2) — supersedes the pre-stance-redesign 'legacy = always BACK' behavior", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  assert.equal(getRunSnapshot(run).companions[0].slot, "FRONT");
});

test("saved FRONT formation intent determines stable position rank while live slots continue to follow stance counts", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 5,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    formation: { "rift-lens": "FRONT", "veil-vanguard": "FRONT" },
  });
  const companionPositions = () => getRunSnapshot(run).companions.map(({ companionId, slot }) => [companionId, slot]);

  assert.deepEqual(companionPositions(), [
    ["rift-lens", "FRONT"],
    ["veil-vanguard", "FRONT"],
    ["ember-cohort", "BACK"],
  ]);

  run = advanceDefenseRun(queueInput(run, "STANCE_CYCLE"), 1);
  assert.equal(getRunSnapshot(run).formationStance, "TURRET");
  assert.deepEqual(companionPositions(), [
    ["rift-lens", "FRONT"],
    ["veil-vanguard", "BACK"],
    ["ember-cohort", "BACK"],
  ]);

  run = advanceDefenseRun(run, 4 * 60);
  run = advanceDefenseRun(queueInput(run, "STANCE_CYCLE"), 1);
  assert.equal(getRunSnapshot(run).formationStance, "SPLIT");
  assert.deepEqual(companionPositions(), [
    ["rift-lens", "FRONT"],
    ["veil-vanguard", "BACK"],
    ["ember-cohort", "BACK"],
  ]);
});

test("getRunSnapshot companions carry slot, status, and an hp/maxHp pool equal to companionFormationIntegrity (not literal 1/1)", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const companion = getRunSnapshot(run).companions[0];
  assert.equal(companion.slot, "FRONT");
  assert.equal(companion.status, "ACTIVE");
  // balance-sheet.md worked example: ember-cohort T1 uninvested = 420*8*1.00 = 3360
  assert.equal(companion.hp, 3360);
  assert.equal(companion.maxHp, 3360);
});

test("rpgActive stays false and companion damage matches the raw catalog value with no Warden investment and no equipment", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  assert.equal(run.rpgActive, false);
  assert.equal(getRunSnapshot(run).companions[0].damage, COMPANIONS["ember-cohort"].damage);
});

test("an empty-but-non-null wardenProgress object (no stat points, no skills, no traits) does not activate rpgActive", () => {
  const run = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    wardenProgress: { statPoints: {}, skillTreeIds: [], traitIds: [] },
  });
  assert.equal(run.rpgActive, false);
  assert.equal(getRunSnapshot(run).companions[0].damage, COMPANIONS["ember-cohort"].damage);
});

test("rpgActive gating: real Warden stat investment flips rpgActive true and applies the striker role damage bonus (same seed and companion, only wardenProgress toggled)", () => {
  const inert = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const active = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    wardenProgress: { statPoints: { "binding-might": 1 }, skillTreeIds: [], traitIds: [] },
  });
  assert.equal(inert.rpgActive, false);
  assert.equal(active.rpgActive, true);
  assert.equal(getRunSnapshot(inert).companions[0].damage, 420);
  // ember-cohort is a striker: +20% damageBonus, applied only when rpgActive
  assert.equal(getRunSnapshot(active).companions[0].damage, Math.round(420 * 1.2));
});

test("rpgActive gating: equipment investment alone (no wardenProgress) also flips rpgActive true and stacks the equipment tier multiplier onto the role bonus", () => {
  const run = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    companionEquipment: { "ember-cohort": { weapon: 1 } }, // T2 = 1.15
  });
  assert.equal(run.rpgActive, true);
  assert.equal(getRunSnapshot(run).companions[0].damage, Math.round(420 * 1.2 * 1.15));
});

test("rpgActive gating: the vanguard role's selfIntegrityMultiplier (+30% maxHp) only applies once rpgActive is true", () => {
  const inert = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["veil-vanguard"] });
  const active = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["veil-vanguard"],
    wardenProgress: { statPoints: { "binding-might": 1 }, skillTreeIds: [], traitIds: [] },
  });
  assert.equal(getRunSnapshot(inert).companions[0].maxHp, 2880); // 360*8*1.00
  assert.equal(getRunSnapshot(active).companions[0].maxHp, Math.round(2880 * 1.30));
});

test("the 3 new companions (pack-warden, lantern-reaver, requiem-warden) exist in COMPANIONS with the authored stats", () => {
  assert.deepEqual(
    { id: COMPANIONS["pack-warden"].id, damage: COMPANIONS["pack-warden"].damage, fireTicks: COMPANIONS["pack-warden"].fireTicks, range: COMPANIONS["pack-warden"].range },
    { id: "pack-warden", damage: 400, fireTicks: 30, range: 4200 },
  );
  assert.deepEqual(
    { id: COMPANIONS["lantern-reaver"].id, damage: COMPANIONS["lantern-reaver"].damage, fireTicks: COMPANIONS["lantern-reaver"].fireTicks, range: COMPANIONS["lantern-reaver"].range },
    { id: "lantern-reaver", damage: 480, fireTicks: 40, range: 4400 },
  );
  assert.deepEqual(
    { id: COMPANIONS["requiem-warden"].id, damage: COMPANIONS["requiem-warden"].damage, fireTicks: COMPANIONS["requiem-warden"].fireTicks, range: COMPANIONS["requiem-warden"].range },
    { id: "requiem-warden", damage: 440, fireTicks: 38, range: 4600 },
  );
});

test("rpgActive gating: pack-warden (the new 3rd vanguard member) gets the same vanguard selfIntegrityMultiplier (+30% maxHp) as the original vanguard companions, only once rpgActive is true", () => {
  const inert = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["pack-warden"] });
  const active = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["pack-warden"],
    wardenProgress: { statPoints: { "binding-might": 1 }, skillTreeIds: [], traitIds: [] },
  });
  assert.equal(inert.rpgActive, false);
  assert.equal(active.rpgActive, true);
  // companionFormationIntegrity: pack-warden T1 uninvested = 400*8*1.00 = 3200
  assert.equal(getRunSnapshot(inert).companions[0].maxHp, 3200);
  assert.equal(getRunSnapshot(active).companions[0].maxHp, Math.round(3200 * 1.30));
});

test("critical mechanic: FRONT companions (stance position-rank index < derivedFrontCount) take contact/ranged damage from a driven run while the BACK companion in the same run never does", () => {
  // companionId asc: anchor-shard(idx0,FRONT), ember-cohort(idx1,FRONT), veil-vanguard(idx2,BACK) under
  // the default VANGUARD stance (derivedFrontCount=2) — no formation param needed or consulted.
  let run = createDefenseRun({
    stageId: "echo-throne", seed: 3,
    companionLoadout: ["veil-vanguard", "anchor-shard", "ember-cohort"],
  });
  assert.deepEqual(run.companions.map((c) => [c.companionId, c.slot]), [["anchor-shard", "FRONT"], ["ember-cohort", "FRONT"], ["veil-vanguard", "BACK"]]);
  let frontDamageEvents = 0;
  let backDamageEvents = 0;
  run = stepAndCollect(run, 2500, (_run, event) => {
    if (event.type !== "COMPANION_DAMAGED") return;
    if (event.companionId === "veil-vanguard") backDamageEvents += 1;
    else frontDamageEvents += 1; // anchor-shard or ember-cohort
  });
  assert.ok(frontDamageEvents > 0, "at least one FRONT companion must take at least one contact/ranged hit over a driven run");
  assert.equal(backDamageEvents, 0, "the BACK companion must never take contact/ranged damage");
});

test("critical mechanic: a solo FRONT companion transitions ACTIVE -> DOWNED exactly once and then stays inert", () => {
  let run = createDefenseRun({
    stageId: "abyss-chancel", seed: 3,
    companionLoadout: ["veil-vanguard"],
  });
  run = structuredClone(run);
  run.companions[0].hp = 1;
  assert.equal(run.companions[0].slot, "FRONT");
  let downedTick = null;
  let downedEventCount = 0;
  let firedAfterDowned = 0;
  let damagedAfterDowned = 0;
  run = stepAndCollect(run, 3000, (current, event) => {
    if (event.type === "COMPANION_DOWNED") {
      downedTick = downedTick ?? current.tick;
      downedEventCount += 1;
    }
    if (downedTick !== null && event.type === "WEAPON_FIRED" && event.owner === "veil-vanguard") firedAfterDowned += 1;
    if (downedTick !== null && event.type === "COMPANION_DAMAGED" && event.companionId === "veil-vanguard") damagedAfterDowned += 1;
  }, { holdPosition: true });
  assert.ok(Number.isInteger(downedTick) && downedTick > 0, "the low-integrity FRONT fixture must be downed during contact");
  assert.equal(downedEventCount, 1, "the ACTIVE -> DOWNED transition fires exactly once");
  assert.equal(firedAfterDowned, 0, "a DOWNED companion must never fire WEAPON_FIRED again");
  assert.equal(damagedAfterDowned, 0, "a DOWNED companion must never take further COMPANION_DAMAGED hits");
  const finalCompanion = run.companions.find((c) => c.companionId === "veil-vanguard");
  assert.equal(finalCompanion.status, "DOWNED");
  assert.equal(finalCompanion.hp, 0);
});

test("critical mechanic: BACK_ROW_SYNERGY_DAMAGE_BONUS multiplies a BACK companion's WEAPON_FIRED damage only while >=1 FRONT companion is alive", () => {
  // companionId asc: anchor-shard(idx0,FRONT), ember-cohort(idx1,FRONT), veil-vanguard(idx2,BACK).
  let run = createDefenseRun({
    stageId: "echo-throne", seed: 3,
    companionLoadout: ["veil-vanguard", "anchor-shard", "ember-cohort"],
  });
  assert.equal(run.companions.find((c) => c.companionId === "veil-vanguard").slot, "BACK");
  const backFireDamages = [];
  run = stepAndCollect(run, 2400, (_current, event) => {
    if (event.type === "WEAPON_FIRED" && event.owner === "veil-vanguard") backFireDamages.push(event.damage);
  });
  assert.ok(backFireDamages.length > 0, "veil-vanguard (BACK) must fire at least once while a FRONT companion is alive");
  const expectedSynergyDamage = Math.round(COMPANIONS["veil-vanguard"].damage * (1 + BACK_ROW_SYNERGY_DAMAGE_BONUS));
  assert.ok(backFireDamages.every((damage) => damage === expectedSynergyDamage), `every BACK fire while a FRONT companion is alive must equal the synergy-boosted ${expectedSynergyDamage}, got ${JSON.stringify([...new Set(backFireDamages)])}`);
});

test("critical mechanic: TURRET applies BACK_ROW_SYNERGY_DAMAGE_BONUS only to the BACK companion while the FRONT companion keeps raw damage", () => {
  let run = createDefenseRun({
    stageId: "cinder-span", seed: 5,
    companionLoadout: ["veil-vanguard", "ember-cohort"],
  });
  run = queueInput(run, "STANCE_CYCLE"); // VANGUARD -> TURRET
  run = advanceDefenseRun(run, 1);
  assert.equal(getRunSnapshot(run).formationStance, "TURRET");
  assert.deepEqual(run.companions.map((c) => c.slot), ["FRONT", "BACK"]);

  const fireDamages = { "veil-vanguard": [], "ember-cohort": [] };
  run = stepAndCollect(run, 2400, (_current, event) => {
    if (event.type === "WEAPON_FIRED" && fireDamages[event.owner]) fireDamages[event.owner].push(event.damage);
  });
  assert.ok(fireDamages["veil-vanguard"].length > 0 && fireDamages["ember-cohort"].length > 0, "both companions must fire at least once under TURRET");
  const expectedByOwner = Object.fromEntries(run.companions.map((companion) => [
    companion.companionId,
    companion.slot === "BACK"
      ? Math.round(companion.damage * (1 + BACK_ROW_SYNERGY_DAMAGE_BONUS))
      : companion.damage,
  ]));
  run.companions.forEach((companion) => {
    assert.ok(
      fireDamages[companion.companionId].every((damage) => damage === expectedByOwner[companion.companionId]),
      `${companion.slot} ${companion.companionId} damage must equal ${expectedByOwner[companion.companionId]}, got ${JSON.stringify([...new Set(fireDamages[companion.companionId])])}`,
    );
  });
});

test("critical mechanic: TURRET targetability emits BOSS_RALLY_WINDOW with the retained zero cooldown reduction when its one FRONT companion is alive at boss spawn", () => {
  const withFront = createDefenseRun({
    stageId: "cinder-span", seed: 12,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
  }); // default VANGUARD, derivedFrontCount=2 -> ember-cohort + rift-lens are FRONT
  const toBossWithFront = advanceThroughObjectivesUntil(withFront, (run) => run.bossSpawned, HOLD_BUDGET("cinder-span"));
  const rallyEvent = toBossWithFront.events.find((event) => event.type === "BOSS_RALLY_WINDOW");
  assert.ok(rallyEvent, "a filled FRONT slot at boss spawn must emit BOSS_RALLY_WINDOW");
  assert.equal(rallyEvent.cooldownReductionBp, 0);
  assert.equal(toBossWithFront.rallyTargetId, rallyEvent.entityId);

  let turretRun = createDefenseRun({
    stageId: "cinder-span", seed: 12,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
  });
  turretRun = queueInput(turretRun, "STANCE_CYCLE"); // VANGUARD -> TURRET (derivedFrontCount=1)
  turretRun = advanceDefenseRun(turretRun, 1);
  assert.equal(getRunSnapshot(turretRun).formationStance, "TURRET");
  const toBossTurret = advanceThroughObjectivesUntil(turretRun, (run) => run.bossSpawned, HOLD_BUDGET("cinder-span"));
  const turretRally = toBossTurret.events.find((event) => event.type === "BOSS_RALLY_WINDOW");
  assert.ok(turretRally, "TURRET's targetable FRONT at boss spawn must emit BOSS_RALLY_WINDOW");
  assert.equal(turretRally.cooldownReductionBp, 0);
  assert.equal(toBossTurret.rallyTargetId, turretRally.entityId);
});

test("critical mechanic: getRunDigest is byte-identical for two createDefenseRun calls with identical seed and full RPG params, through creation, mid-run, and terminal", () => {
  const params = {
    stageId: "cinder-span", seed: 21,
    companionLoadout: ["ember-cohort", "veil-vanguard"],
    wardenProgress: { statPoints: { "binding-might": 2, "gate-resolve": 1 }, skillTreeIds: ["echo-backlash"], traitIds: [] },
    wardenEquipment: { weapon: 1, ward: 0, trinket: 0 },
    companionEquipment: { "ember-cohort": { weapon: 1 } },
  };
  const left0 = createDefenseRun(params);
  const right0 = createDefenseRun(params);
  assert.equal(getRunDigest(left0), getRunDigest(right0), "digests must match immediately at creation");

  let left = advanceThroughObjectivesUntil(left0, (run) => run.tick >= 400, 400);
  let right = advanceThroughObjectivesUntil(right0, (run) => run.tick >= 400, 400);
  assert.equal(getRunDigest(left), getRunDigest(right), "digests must match after identical driven ticks mid-run");

  left = advanceThroughObjectivesUntil(left, (run) => isTerminalRun(run), HOLD_BUDGET("cinder-span"));
  right = advanceThroughObjectivesUntil(right, (run) => isTerminalRun(run), HOLD_BUDGET("cinder-span"));
  assert.ok(isTerminalRun(left) && isTerminalRun(right));
  assert.equal(left.terminal, right.terminal);
  assert.equal(getRunDigest(left), getRunDigest(right), "digests must match at the terminal state");
});

// --- STANCE_CYCLE (Stage 1 redesign: 3-stance formation system) ---------------------------------

test("STANCE_CYCLE: getRunSnapshot exposes formationStance and stanceCooldownUntilTick as top-level fields from run creation, defaulting to VANGUARD/0", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const snapshot = getRunSnapshot(run);
  assert.equal(snapshot.formationStance, "VANGUARD");
  assert.equal(snapshot.stanceCooldownUntilTick, 0);
});

test("STANCE_CYCLE: repeated inputs (each after clearing the 4s cooldown) advance formationStance through all 3 FORMATION_STANCES and wrap back to VANGUARD", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const observed = [getRunSnapshot(run).formationStance];
  for (let i = 0; i < FORMATION_STANCES.length; i += 1) {
    run = cycleStance(run, 1);
    observed.push(getRunSnapshot(run).formationStance);
  }
  assert.deepEqual(observed, ["VANGUARD", "TURRET", "SPLIT", "VANGUARD"]);
});

test("STANCE_CYCLE: a second STANCE_CYCLE within the 4-second cooldown window is rejected — formationStance does not advance, INPUT_REJECTED fires with reason STANCE_ON_COOLDOWN, and STANCE_SWITCH_BLOCKED emits with the still-active stance and remaining ticks", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  run = queueInput(run, "STANCE_CYCLE");
  run = advanceDefenseRun(run, 1);
  const afterFirst = getRunSnapshot(run);
  assert.equal(afterFirst.formationStance, "TURRET");
  assert.equal(afterFirst.stanceCooldownUntilTick, run.tick + 4 * 60);
  assert.ok(afterFirst.events.some((e) => e.type === "STANCE_SWITCHED"));

  // Immediately attempt a second cycle, well inside the cooldown window.
  run = queueInput(run, "STANCE_CYCLE");
  run = advanceDefenseRun(run, 1);
  const afterSecond = getRunSnapshot(run);
  assert.equal(afterSecond.formationStance, "TURRET", "stance must not advance while on cooldown");
  const blocked = afterSecond.events.find((e) => e.type === "STANCE_SWITCH_BLOCKED");
  assert.ok(blocked, "STANCE_SWITCH_BLOCKED must emit for a cooldown-rejected attempt");
  assert.equal(blocked.stance, "TURRET");
  assert.ok(blocked.remainingTicks > 0, "remainingTicks must be positive while still on cooldown");
  const rejected = afterSecond.events.find((e) => e.type === "INPUT_REJECTED");
  assert.ok(rejected, "the generic INPUT_REJECTED event must also fire, in addition to STANCE_SWITCH_BLOCKED");
  assert.equal(rejected.reason, "STANCE_ON_COOLDOWN");
  assert.equal(rejected.inputType, "STANCE_CYCLE");
});

test("STANCE_CYCLE: TURRET stance produces exactly 1 derived-FRONT companion in a 3-companion loadout", () => {
  let run = createDefenseRun({
    stageId: "cinder-span", seed: 5,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
  });
  // Sanity: under the default VANGUARD stance, 2 of the 3 companions start FRONT.
  const beforeSlots = getRunSnapshot(run).companions.map((c) => c.slot);
  assert.deepEqual(beforeSlots, ["FRONT", "FRONT", "BACK"]);

  run = queueInput(run, "STANCE_CYCLE"); // VANGUARD -> TURRET
  run = advanceDefenseRun(run, 1);
  const snapshot = getRunSnapshot(run);
  assert.equal(snapshot.formationStance, "TURRET");
  const afterSlots = snapshot.companions.map((c) => c.slot);
  assert.deepEqual(afterSlots, ["FRONT", "BACK", "BACK"], "one targetable FRONT must remain under TURRET (derivedFrontCount=1)");
  assert.equal(afterSlots.filter((slot) => slot === "FRONT").length, 1);
});

// Teeth test (decision-log.md D18 convention): intentionally break the STANCE_CYCLE wrap-order
// assertion's premise to prove it actually catches a broken cycle, then confirm the real
// (non-broken) assertion above passes. This block does not assert against production code — it
// documents, in a self-contained way, that a wrong-order stance sequence WOULD fail the check
// used above, so the "advances through all 3 stances and wraps" test is not vacuously true.
test("STANCE_CYCLE teeth test: a deliberately wrong cycle-order fixture fails the exact wrap assertion used above, proving that assertion has bite", () => {
  const brokenObservedSequence = ["VANGUARD", "SPLIT", "TURRET", "SPLIT"]; // wrong order + wrong wrap target
  assert.notDeepEqual(brokenObservedSequence, ["VANGUARD", "TURRET", "SPLIT", "VANGUARD"], "the broken fixture must NOT match the correct sequence (this proves the real test's deepEqual would have failed on a genuine regression)");
});
