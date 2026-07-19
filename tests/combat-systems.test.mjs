import assert from "node:assert/strict";
import test from "node:test";

import {
  BOSS_PHASES,
  COMBAT_ALERT_CUES,
  ENEMY_PATTERNS,
  SUMMON_RECIPES,
  getCombatAlertCue,
  resolveBossPhase,
  resolveEnemyPattern,
  resolveSummonEvolution
} from "../combat-systems.js";

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value, label = "value", seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`, seen);
  }
}

function catalogEntries(catalog) {
  if (Array.isArray(catalog)) {
    return catalog.map((value, index) => [value?.id ?? value?.patternId ?? value?.recipeId ?? value?.type ?? String(index), value]);
  }
  return Object.entries(catalog);
}

function finiteRatio(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

test("combat catalogs are present, non-empty, and deeply frozen", () => {
  for (const [name, catalog] of Object.entries({ ENEMY_PATTERNS, BOSS_PHASES, SUMMON_RECIPES, COMBAT_ALERT_CUES })) {
    assert.ok(catalog && typeof catalog === "object", `${name} must be an object or array`);
    assert.ok(catalogEntries(catalog).length > 0, `${name} must not be empty`);
    assertDeepFrozen(catalog, name);
  }
});

test("enemy patterns resolve deterministically and preserve caller context", () => {
  for (const [id, definition] of catalogEntries(ENEMY_PATTERNS)) {
    const context = Object.freeze({
      stageId: "cinder-span",
      waveId: `wave-${id}`,
      targetId: "ally-portal",
      hostiles: 3
    });
    const before = copy(context);
    const first = resolveEnemyPattern(id, context);
    const second = resolveEnemyPattern(id, context);

    assert.deepEqual(first, second, `pattern ${id} must be deterministic`);
    assert.equal(first.accepted, true, `catalog pattern ${id} must resolve`);
    assert.equal(first.patternId, definition.patternId ?? definition.id ?? id);
    assert.equal(typeof first.movement, "string");
    assert.equal(typeof first.targeting, "string");
    assert.equal(first.targetId, context.targetId);
    assert.deepEqual(context, before, "pattern resolution must not mutate context");
    assertDeepFrozen(first, `resolved pattern ${id}`);
  }
});
test("enemy pattern target selection honors each pattern priority and stable ties", () => {
  const targets = [
    { id: "commander-zeta", role: "commander", distance: 4, health: 2 },
    { id: "commander-alpha", isCommander: true, distance: 4, health: 7 },
    { id: "isolated-target", isolated: true, distance: 8, health: 9 },
    { id: "objective-target", objective: true, distance: 5, health: 10 },
    { id: "ordinary-target", distance: 1, health: 1 }
  ];
  const before = copy(targets);
  const expected = {
    rusher: "commander-alpha",
    flanker: "isolated-target",
    ranged: "commander-zeta",
    guardian: "objective-target"
  };

  for (const [patternId, targetId] of Object.entries(expected)) {
    const result = resolveEnemyPattern(patternId, { targets, side: "right" });
    assert.equal(result.accepted, true);
    assert.equal(result.targetId, targetId, `${patternId} must choose its priority target`);
    assert.equal(result.targetCount, targets.length);
    assert.equal(result.targetingDirective.candidateCount, targets.length);
    if (patternId === "flanker") assert.equal(result.movementDirective.side, "right");
    assertDeepFrozen(result, `targeted ${patternId}`);
  }
  assert.deepEqual(targets, before, "target selection must not reorder or mutate caller targets");
});


test("enemy pattern resolver rejects malformed and unknown inputs without throwing", () => {
  for (const [pattern, context] of [
    [null, {}],
    [undefined, {}],
    ["not-a-pattern", {}],
    [{}, {}],
    ["scout", null],
    ["scout", { hostiles: -1 }]
  ]) {
    const result = resolveEnemyPattern(pattern, context);
    assert.equal(result.accepted, false, "malformed patterns must be rejected");
    assert.equal(result.patternId ?? null, null);
    assertDeepFrozen(result, "rejected pattern result");
  }
});
test("valid enemy patterns tolerate malformed optional context safely", () => {
  const context = Object.freeze({ targets: "not-an-array", side: 42 });
  const before = copy(context);
  const result = resolveEnemyPattern("rusher", context);
  assert.equal(result.accepted, true);
  assert.equal(result.targetId, null);
  assert.equal(result.targetCount, 0);
  assert.equal(result.targetingDirective.candidateCount, 0);
  assert.deepEqual(context, before);
  assertDeepFrozen(result, "malformed-context pattern result");
});


test("boss phase resolution clamps health and changes only at deterministic boundaries", () => {
  const phaseCount = 3;
  const full = resolveBossPhase({ health: 100, maxHealth: 100, phaseCount });
  const zero = resolveBossPhase({ health: 0, maxHealth: 100, phaseCount });
  assert.equal(full.phaseIndex, 0, "full health starts in phase zero");
  assert.equal(zero.phaseIndex, phaseCount - 1, "zero health ends in the final phase");
  assert.equal(full.normalizedHealth, 1);
  assert.equal(zero.normalizedHealth, 0);
  assert.ok(typeof full.phaseCue === "string" && full.phaseCue.length > 0);

  let prior = full.phaseIndex;
  for (const health of [100, 99.999, 67, 66.999, 34, 33.999, 1, 0]) {
    const result = resolveBossPhase({ health, maxHealth: 100, phaseCount });
    assert.ok(result.phaseIndex >= prior, `phase index must not regress at health ${health}`);
    assert.ok(finiteRatio(result.normalizedHealth));
    prior = result.phaseIndex;
  }

  assert.equal(resolveBossPhase({ health: 120, maxHealth: 100, phaseCount }).normalizedHealth, 1);
  assert.equal(resolveBossPhase({ health: -20, maxHealth: 100, phaseCount }).normalizedHealth, 0);
  assert.equal(resolveBossPhase({ health: 100, maxHealth: 100, phaseCount }), full);
});

test("four-phase bosses advance at the 75, 50, and 25 percent health boundaries without regressing", () => {
  const boundaries = [
    { health: 100, normalizedHealth: 1, phaseIndex: 0 },
    { health: 75, normalizedHealth: 0.75, phaseIndex: 1 },
    { health: 50, normalizedHealth: 0.5, phaseIndex: 2 },
    { health: 25, normalizedHealth: 0.25, phaseIndex: 3 },
    { health: 0, normalizedHealth: 0, phaseIndex: 3 }
  ];

  let priorPhaseIndex = -1;
  for (const boundary of boundaries) {
    const result = resolveBossPhase({
      health: boundary.health,
      maxHealth: 100,
      phaseCount: 4
    });
    assert.equal(result.accepted, true, `${boundary.health}% health must resolve`);
    assert.equal(result.phaseCount, 4, `${boundary.health}% health must retain the four-phase contract`);
    assert.equal(result.normalizedHealth, boundary.normalizedHealth, `${boundary.health}% health must normalize exactly`);
    assert.equal(result.phaseIndex, boundary.phaseIndex, `${boundary.health}% health must select phase ${boundary.phaseIndex}`);
    assert.ok(result.phaseIndex >= priorPhaseIndex, `phase index must not regress at ${boundary.health}% health`);
    priorPhaseIndex = result.phaseIndex;
  }
});

test("boss phase resolver rejects malformed phase configuration", () => {
  for (const input of [
    null,
    {},
    { health: 1, maxHealth: 0, phaseCount: 3 },
    { health: 1, maxHealth: 10, phaseCount: 0 },
    { health: "10", maxHealth: 10, phaseCount: 3 },
    { health: 1, maxHealth: 10, phaseCount: 3.5 }
  ]) {
    const result = resolveBossPhase(input);
    assert.equal(result.accepted, false, "malformed phase input must be rejected");
    assertDeepFrozen(result, "rejected phase result");
  }
});

test("summon evolution accepts exactly affordable unowned recipes and does not mutate ownership", () => {
  for (const [recipeId, recipe] of catalogEntries(SUMMON_RECIPES)) {
    const cost = recipe.cost;
    assert.ok(Number.isInteger(cost) && cost >= 0, `${recipeId} must expose a non-negative integer cost`);
    const input = { essence: cost, recipeId, owned: false };
    const before = copy(input);
    const accepted = resolveSummonEvolution(input);
    const repeated = resolveSummonEvolution(input);

    assert.deepEqual(accepted, repeated, `recipe ${recipeId} must be deterministic`);
    assert.equal(accepted.accepted, true, `recipe ${recipeId} should accept exact cost`);
    assert.equal(accepted.recipeId, recipe.recipeId ?? recipe.id ?? recipeId);
    assert.equal(accepted.cost, cost);
    assert.equal(accepted.owned, false);
    assert.equal(accepted.nextOwned, true);
    assert.ok(accepted.evolution && typeof accepted.evolution === "object");
    assert.deepEqual(input, before, "evolution resolution must not mutate input");
    assertDeepFrozen(accepted, `accepted recipe ${recipeId}`);

    const insufficient = resolveSummonEvolution({ essence: Math.max(0, cost - 1), recipeId, owned: false });
    assert.equal(insufficient.accepted, false, `recipe ${recipeId} must reject insufficient essence`);
    assert.equal(insufficient.nextOwned, false);

    const duplicate = resolveSummonEvolution({ essence: cost + 100, recipeId, owned: true });
    assert.equal(duplicate.accepted, false, `recipe ${recipeId} must reject duplicate ownership`);
    assert.equal(duplicate.nextOwned, true);
  }
});

test("summon evolution rejects malformed recipes without mutating caller objects", () => {
  for (const input of [
    null,
    {},
    { essence: -1, recipeId: "ember-cohort", owned: false },
    { essence: 1.5, recipeId: "ember-cohort", owned: false },
    { essence: 10, recipeId: "not-a-recipe", owned: false },
    { essence: 10, recipeId: "ember-cohort", owned: "false" }
  ]) {
    const before = copy(input);
    const result = resolveSummonEvolution(input);
    assert.equal(result.accepted, false, "malformed evolution input must be rejected");
    assert.deepEqual(input, before, "malformed evolution input must remain unchanged");
    assertDeepFrozen(result, "rejected evolution result");
  }
});

test("combat alert cues map every declared event and return immutable snapshots", () => {
  for (const [eventType, cue] of catalogEntries(COMBAT_ALERT_CUES)) {
    const event = Object.freeze({ type: eventType });
    const before = copy(event);
    const first = getCombatAlertCue(event);
    const second = getCombatAlertCue(event);

    assert.deepEqual(first, second, `alert ${eventType} must be deterministic`);
    assert.deepEqual(first, cue, `alert ${eventType} must map to its declared cue`);
    assertDeepFrozen(first, `alert cue ${eventType}`);
    assert.deepEqual(event, before, "alert lookup must not mutate event");
  }

  assert.equal(getCombatAlertCue(null), null);
  assert.equal(getCombatAlertCue({ type: "not-a-real-alert" }), null);
  assert.equal(getCombatAlertCue({}), null);
});

test("combat cue aliases resolve to canonical authored IDs without changing event semantics", () => {
  const expected = {
    "boss-phase": { id: "boss-phase-change", event: "boss-phase", severity: "critical", channel: "audio-visual", label: "Boss phase shifted" },
    "phase-change": { id: "boss-phase-change", event: "phase-change", severity: "critical", channel: "audio-visual", label: "Boss phase shifted" },
    "boss-phase-shift": { id: "boss-phase-change", event: "boss-phase-shift", severity: "critical", channel: "audio-visual", label: "Boss phase shifted" },
    "boss-low-health": { id: "boss-low-health", event: "boss-low-health", severity: "critical", channel: "audio-visual", label: "Boss integrity critical" },
    "low-health": { id: "boss-low-health", event: "low-health", severity: "critical", channel: "audio-visual", label: "Boss integrity critical" },
    "guardian-shield": { id: "guardian-shield", event: "guardian-shield", severity: "warning", channel: "audio-visual", label: "Guardian shield active" },
    "guardian-guard": { id: "guardian-shield", event: "guardian-guard", severity: "warning", channel: "audio-visual", label: "Guardian shield active" },
    "enemy-ranged-warning": { id: "enemy-ranged-warning", event: "enemy-ranged-warning", severity: "warning", channel: "audio-visual", label: "Ranged threat acquiring target" },
    "summon-evolution": { id: "summon-evolved", event: "summon-evolution", severity: "info", channel: "audio-visual", label: "Summon evolution accepted" },
    "summon-evolved": { id: "summon-evolved", event: "summon-evolved", severity: "info", channel: "audio-visual", label: "Summon evolution accepted" },
  };

  for (const [eventType, contract] of Object.entries(expected)) {
    const cue = getCombatAlertCue({ type: eventType });
    assert.deepEqual(cue, contract, `${eventType} must preserve its public event semantics`);
    assert.equal(cue.id, contract.id, `${eventType} must resolve to its canonical authored cue ID`);
    assertDeepFrozen(cue, `canonical cue ${eventType}`);
  }
});
