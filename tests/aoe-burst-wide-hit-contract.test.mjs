import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "../vendor/three.module.js";
import { SKILLS } from "../defense-catalog.js";
import {
  createDefenseRun,
  advanceDefenseRun,
  queueInput,
  getRunSnapshot,
} from "../defense-run-simulation.js";
import {
  AOE_BURST_BUDGET,
  aoeDensityFactor,
  aoeWorldRadiusFor,
  attachAoeBurst,
  advanceAoeBurst,
  RealtimeBattle,
} from "../battle-realtime-three.js";

// Sim->world for a length: worldPointInto() scales x by (2 * WORLD_SCALE / WORLD_WIDTH).
const WORLD_SCALE = 14;
const WORLD_WIDTH = 24000;
const simRadiusToWorld = (radius) => radius * 2 * WORLD_SCALE / WORLD_WIDTH;

const AOE_SKILL_IDS = ["grave-pulse", "shadow-step", "ash-nova", "regents-verdict"];

test("aoe-burst skills exist with the authored 원형 360° radii and category", () => {
  for (const id of ["ash-nova", "regents-verdict"]) {
    const skill = SKILLS[id];
    assert.ok(skill, `${id} missing from SKILLS`);
    assert.equal(skill.kind, "active");
    assert.equal(skill.category, "aoe-burst");
    assert.ok(skill.radius > 0, `${id} must be an area skill`);
  }
  // design/skill-and-growth-spec.md §2.2 authored values.
  assert.equal(SKILLS["ash-nova"].radius, 3600);
  assert.equal(SKILLS["ash-nova"].damage, 1400);
  assert.equal(SKILLS["ash-nova"].cooldown, 480);
  assert.equal(SKILLS["regents-verdict"].radius, 5000);
  assert.equal(SKILLS["regents-verdict"].cooldown, 900);
  assert.equal(SKILLS["regents-verdict"].damagePerTarget, 400);
  assert.equal(SKILLS["regents-verdict"].targetCap, 12);
  // Density-scaled by construction: a flat base would make it a worse ash-nova.
  assert.equal(SKILLS["regents-verdict"].damage, 0);
});

test("the drawn AoE footprint equals the simulation's own damage radius", () => {
  for (const id of AOE_SKILL_IDS) {
    const expected = simRadiusToWorld(SKILLS[id].radius);
    assert.ok(
      Math.abs(aoeWorldRadiusFor(id) - expected) < 1e-9,
      `${id} footprint ${aoeWorldRadiusFor(id)} != true damage radius ${expected}`,
    );
  }
  // Regression guard on the exact defect this replaced: the old fixed glows drew
  // 1.75 for a true 3.50 (50%) and 0.80 for a true 5.25 (15%).
  assert.ok(Math.abs(aoeWorldRadiusFor("grave-pulse") - 3.5) < 1e-9);
  assert.ok(Math.abs(aoeWorldRadiusFor("shadow-step") - 5.25) < 1e-9);
  // Single-target skills must NOT get an area footprint.
  for (const id of ["rift-bolt", "soul-lance", "void-aegis"]) {
    assert.equal(aoeWorldRadiusFor(id), 0, `${id} is single-target and must have no footprint`);
  }
  assert.equal(aoeWorldRadiusFor("not-a-skill"), 0);
});

test("the burst ring geometry is built at the authoritative radius, not a scaled guess", () => {
  const host = new THREE.Group();
  const radius = aoeWorldRadiusFor("regents-verdict");
  const descriptor = attachAoeBurst(host, "regents-verdict", radius, 12, AOE_BURST_BUDGET.full);
  assert.ok(descriptor, "regents-verdict must produce a burst descriptor");
  assert.equal(descriptor.worldRadius, radius);
  assert.equal(descriptor.implode, true);

  const ring = host.children.find((child) => child.name === "aoe-burst-ring");
  assert.ok(ring, "burst must draw a ground ring");
  ring.geometry.computeBoundingSphere();
  // At rest scale the ring's outer edge IS the damage boundary.
  assert.ok(
    Math.abs(ring.geometry.boundingSphere.radius - radius) < 1e-6,
    `ring outer edge ${ring.geometry.boundingSphere.radius} != damage radius ${radius}`,
  );
  // Annulus, never a filled disc: fill cost must stay bounded at large radii.
  const positions = ring.geometry.getAttribute("position");
  let minRadial = Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    minRadial = Math.min(minRadial, Math.hypot(positions.getX(index), positions.getZ(index)));
  }
  assert.ok(minRadial > radius * 0.85, `ring must be a thin annulus, inner edge was ${minRadial}`);
});

test("burst weight scales with the density the cast actually caught", () => {
  assert.equal(aoeDensityFactor(0), 0);
  assert.equal(aoeDensityFactor(12), 1);
  assert.equal(aoeDensityFactor(40), 1, "density saturates rather than growing without bound");
  assert.ok(aoeDensityFactor(6) > 0 && aoeDensityFactor(6) < 1);

  const arcsFor = (targetCount) => {
    const host = new THREE.Group();
    attachAoeBurst(host, "regents-verdict", aoeWorldRadiusFor("regents-verdict"), targetCount, AOE_BURST_BUDGET.full);
    return host.children.filter((child) => child.name === "aoe-burst-arc").length;
  };
  const sparse = arcsFor(1);
  const dense = arcsFor(12);
  assert.ok(dense > sparse, `a wave-clearing cast must read heavier: ${dense} arcs vs ${sparse}`);
  assert.ok(dense <= AOE_BURST_BUDGET.full.maxArcs, "arc count must respect the fill budget");
});

test("software WebGL keeps the radius read and drops the fill-heavy extras", () => {
  const host = new THREE.Group();
  const descriptor = attachAoeBurst(host, "ash-nova", aoeWorldRadiusFor("ash-nova"), 12, AOE_BURST_BUDGET.software);
  assert.ok(descriptor.ring, "the ring states the radius and must survive on software WebGL");
  assert.equal(descriptor.arcs.length, 0);
  assert.equal(descriptor.core, null);
});

test("implode sweep collapses before it detonates, and reduced motion holds the true radius", () => {
  const host = new THREE.Group();
  const radius = aoeWorldRadiusFor("regents-verdict");
  const descriptor = attachAoeBurst(host, "regents-verdict", radius, 8, AOE_BURST_BUDGET.full);

  advanceAoeBurst(descriptor, 0.0, false);
  const atStart = descriptor.ring.scale.x;
  advanceAoeBurst(descriptor, 0.34, false);
  const atCollapse = descriptor.ring.scale.x;
  advanceAoeBurst(descriptor, 0.9, false);
  const atBurst = descriptor.ring.scale.x;
  assert.ok(atCollapse < atStart, "implode must contract first");
  assert.ok(atBurst > atCollapse, "then detonate outward");

  // Reduced motion: the boundary is information, so it holds at true radius.
  advanceAoeBurst(descriptor, 0.5, true);
  assert.equal(descriptor.ring.scale.x, 1);
  assert.ok(descriptor.ring.material.opacity > 0, "the footprint must stay visible, not animate away");
});

test("non-imploding nova reaches its boundary early and holds it", () => {
  const host = new THREE.Group();
  const descriptor = attachAoeBurst(host, "ash-nova", aoeWorldRadiusFor("ash-nova"), 6, AOE_BURST_BUDGET.full);
  advanceAoeBurst(descriptor, 0.45, false);
  assert.ok(Math.abs(descriptor.ring.scale.x - 1) < 1e-9, "boundary must be stated by 45% of the cast");
  advanceAoeBurst(descriptor, 0.1, false);
  assert.ok(descriptor.ring.scale.x < 1, "and grow into it, not start there");
});

test("regents-verdict damage is min(targets, cap) x 400 per target, live in the simulation", () => {
  const inRange = (snapshot, radius) => {
    const commander = snapshot.commander;
    return snapshot.enemies.filter((enemy) => enemy.hp > 0
      && (enemy.x - commander.x) ** 2 + (enemy.y - commander.y) ** 2 <= radius ** 2).length;
  };
  const directions = ["E", "N", "W", "S", "NE", "SW"];
  const samples = [];
  for (const seed of [7, 23, 404]) {
    let run = createDefenseRun({
      stageId: "cinder-span",
      seed,
      abyssDepth: 4,
      extractedSkillRanks: { "regents-verdict": 1 },
    });
    for (let step = 0; step < 6000; step += 1) {
      let snapshot = getRunSnapshot(run);
      if (snapshot.terminal) break;
      if (step % 30 === 0) run = queueInput(run, "MOVE", directions[Math.floor(step / 30) % directions.length]);
      const ready = (snapshot.commander.cooldowns["regents-verdict"] ?? 0) === 0;
      if (ready && inRange(snapshot, SKILLS["regents-verdict"].radius) >= 2) {
        run = queueInput(run, "SKILL_CAST", { skillId: "regents-verdict" });
      }
      run = advanceDefenseRun(run, 1);
      snapshot = getRunSnapshot(run);
      const hits = snapshot.events.filter((event) => event.type === "SKILL_RESOLVED_DAMAGE"
        && event.skillId === "regents-verdict");
      if (hits.length) {
        const perTarget = [...new Set(hits.map((hit) => hit.baseDamage))];
        assert.equal(perTarget.length, 1, "every target in one cast takes the same count-scaled damage");
        samples.push({ targets: hits.length, perTarget: perTarget[0], castInstanceId: hits[0].castInstanceId });
        // Order independence: the count is resolved once, so no id-sort can change it.
        assert.ok(hits.every((hit) => hit.castInstanceId === samples.at(-1).castInstanceId));
      }
    }
  }
  assert.ok(samples.length > 0, "the probe must land at least one multi-target cast");
  for (const { targets, perTarget } of samples) {
    assert.equal(perTarget, 400 * Math.min(targets, 12), `density rule broke at ${targets} targets`);
  }
  assert.ok(samples.some(({ targets }) => targets >= 2), "must observe genuine multi-target density");
});

test("ash-nova stays flat regardless of density, so the two aoe slots are not the same skill", () => {
  const directions = ["E", "N", "W", "S"];
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 7,
    abyssDepth: 4,
    extractedSkillRanks: { "ash-nova": 1 },
  });
  const observed = [];
  for (let step = 0; step < 6000 && observed.length < 3; step += 1) {
    let snapshot = getRunSnapshot(run);
    if (snapshot.terminal) break;
    if (step % 30 === 0) run = queueInput(run, "MOVE", directions[Math.floor(step / 30) % directions.length]);
    if ((snapshot.commander.cooldowns["ash-nova"] ?? 0) === 0) {
      run = queueInput(run, "SKILL_CAST", { skillId: "ash-nova" });
    }
    run = advanceDefenseRun(run, 1);
    snapshot = getRunSnapshot(run);
    const hits = snapshot.events.filter((event) => event.type === "SKILL_RESOLVED_DAMAGE"
      && event.skillId === "ash-nova");
    if (hits.length) observed.push({ targets: hits.length, perTarget: hits[0].baseDamage });
  }
  assert.ok(observed.length > 0, "ash-nova must land");
  for (const { perTarget } of observed) {
    assert.equal(perTarget, 1400, "ash-nova is flat-damage: density must not change it");
  }
});

// --- Regression: SKILL_CAST anchoring -------------------------------------
// SKILL_CAST carries no target/entity id, so effectAnchor() fell through to
// `default: null` and spawnVfx() returned before allocating anything. Every
// skill's authored VFX tables were unreachable. These lock the fix.

function vfxHarness() {
  const battle = new RealtimeBattle();
  battle.disposed = false;
  battle.vfxGroup = new THREE.Group();
  battle.softwareRenderer = false;
  battle.reducedMotion = false;
  return battle;
}

const COMMANDER = { id: "commander", x: 12000, y: 6000 };
const enemyAt = (index) => ({ id: `e${index}`, x: 12000 + 200 * index, y: 6000, hp: 100 });

test("every catalog skill cast spawns its authored effect, anchored on the caster", () => {
  for (const skillId of ["rift-bolt", "soul-lance", "grave-pulse", "void-aegis", "shadow-step", "ash-nova", "regents-verdict"]) {
    const battle = vfxHarness();
    const cast = { type: "SKILL_CAST", skillId, vfx: skillId, castInstanceId: "c", tick: 10 };
    battle.spawnVfx({ tick: 10, commander: COMMANDER, enemies: [enemyAt(1)], events: [cast] }, cast, 10);
    assert.equal(battle.vfxInstances.length, 1, `${skillId} cast produced no VFX record`);
    const anchored = battle.vfxInstances[0].root.position;
    assert.ok(Number.isFinite(anchored.x) && Number.isFinite(anchored.z), `${skillId} anchor is not a world point`);
  }
});

test("area casts attach the footprint and single-target casts do not", () => {
  const areaBattle = vfxHarness();
  const enemies = [1, 2, 3, 4, 5, 6, 7, 8].map(enemyAt);
  const areaCast = { type: "SKILL_CAST", skillId: "regents-verdict", vfx: "regents-verdict", castInstanceId: "c1", tick: 10 };
  const resolved = enemies.map((enemy) => ({
    type: "SKILL_RESOLVED_DAMAGE", skillId: "regents-verdict", castInstanceId: "c1", targetId: enemy.id, tick: 10,
  }));
  areaBattle.spawnVfx({ tick: 10, commander: COMMANDER, enemies, events: [areaCast, ...resolved] }, areaCast, 10);
  const areaRecord = areaBattle.vfxInstances[0];
  assert.ok(areaRecord.aoeBurst, "an area cast must draw its footprint");
  assert.ok(Math.abs(areaRecord.aoeBurst.worldRadius - aoeWorldRadiusFor("regents-verdict")) < 1e-9);
  assert.ok(areaRecord.root.children.some((child) => child.name === "aoe-burst-ring"));

  const boltBattle = vfxHarness();
  const boltCast = { type: "SKILL_CAST", skillId: "rift-bolt", vfx: "rift-bolt", castInstanceId: "c3", tick: 10 };
  boltBattle.spawnVfx({ tick: 10, commander: COMMANDER, enemies: [enemyAt(1)], events: [boltCast] }, boltCast, 10);
  assert.equal(boltBattle.vfxInstances[0].aoeBurst, null, "a single-target cast must not draw an area footprint");
});

test("camera impulse fires only for a genuinely dense clear", () => {
  const enemies = [1, 2, 3, 4, 5, 6, 7, 8].map(enemyAt);
  const dense = vfxHarness();
  const denseCast = { type: "SKILL_CAST", skillId: "regents-verdict", vfx: "regents-verdict", castInstanceId: "d", tick: 10 };
  dense.spawnVfx({
    tick: 10, commander: COMMANDER, enemies,
    events: [denseCast, ...enemies.map((enemy) => ({ type: "SKILL_RESOLVED_DAMAGE", skillId: "regents-verdict", castInstanceId: "d", targetId: enemy.id, tick: 10 }))],
  }, denseCast, 10);
  assert.ok(dense.cameraShake, "clearing a wave must be felt");
  assert.ok(dense.cameraShake.amplitude <= 0.13, "and must stay inside the authored orbit bound");

  const sparse = vfxHarness();
  const sparseCast = { type: "SKILL_CAST", skillId: "ash-nova", vfx: "ash-nova", castInstanceId: "s", tick: 10 };
  sparse.spawnVfx({
    tick: 10, commander: COMMANDER, enemies: [enemyAt(1)],
    events: [sparseCast, { type: "SKILL_RESOLVED_DAMAGE", skillId: "ash-nova", castInstanceId: "s", targetId: "e1", tick: 10 }],
  }, sparseCast, 10);
  assert.equal(sparse.cameraShake, null, "a one-target cast must not shake the camera");
});
