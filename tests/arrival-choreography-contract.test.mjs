// Contract tests for arrival choreography (prompts/approved/11-arrival-choreography.md).
//
// The claim under test is NOT "formations exist". It is the four properties that make them
// shippable:
//   1. the derived `arrivalRng` stream does not shift the wave-schedule stream
//   2. `lane` is byte-identical to the pre-formation runtime
//   3. a body that arrives inside the commander's space is FAIR: far enough away to see, and
//      locked out of every damage path for exactly the telegraph it advertises
//   4. the worst case stays inside the renderer's 4-slot `spawn` VFX family budget
//
// Every budget is IMPORTED, never restated, so a moved authored value fails here instead of
// silently invalidating the assertion.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARRIVAL_FORMATIONS,
  ARRIVAL_GRADES,
  ARRIVAL_NEAR_CAP,
  ARRIVAL_NEAR_FORMATIONS,
  ARRIVAL_NEAR_RADIUS_MAX,
  ARRIVAL_NEAR_RADIUS_MIN,
  ARRIVAL_TELEGRAPH_TICKS,
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

const STAGES = ["cinder-span", "abyss-chancel", "echo-throne"];
const SEEDS = [1, 7, 42];
/**
 * Long enough to enqueue enough waves for every formation to appear.
 *
 * 3600 was not: it reached only ~4 waves per run, and a near-player formation additionally
 * requires the wave to contain a player-facing body (~half of waves) -- so the sample was
 * routinely all-`lane` and the coverage guards below fired. Measured at 9000, the same nine
 * windows enqueue 84 waves.
 */
const WINDOW_TICKS = 9000;

/**
 * Drives a run, answering growth offers so the window reaches later waves.
 *
 * A bare `advanceDefenseRun(run, n)` STOPS at the first growth offer, around tick 460-830 on
 * these stages, which is before wave 1 spawns. A test built on that would never reach a
 * formation and would pass against a completely unwired feature.
 */
function driveCollectingSpawns(stageId, seed, ticks) {
  let run = createDefenseRun({ stageId, seed });
  const spawns = [];
  // De-duped by entity id. While a growth offer holds the run, `advanceDefenseRun` returns
  // without advancing and the SAME ENEMY_SPAWNED event stays on the snapshot across loop
  // iterations. Re-reading it pairs one spawn with a commander position from a later tick, which
  // silently manufactures fairness-floor violations that never happened -- one such phantom
  // measured 857 against bodies the simulation had actually placed at 1440+.
  const seen = new Set();
  for (let step = 0; step < ticks && !isTerminalRun(run); step += 1) {
    const before = getRunSnapshot(run);
    if (before.growthOffer) run = queueInput(run, "SKILL_SELECTED", { skillId: before.growthOffer.choices[0] });
    run = advanceDefenseRun(run, 1);
    const after = getRunSnapshot(run);
    for (const event of after.events) {
      if (event.type !== "ENEMY_SPAWNED" || seen.has(event.entityId)) continue;
      seen.add(event.entityId);
      const body = after.enemies.find((enemy) => enemy.id === event.entityId) ?? null;
      // The commander is read from the SAME snapshot the spawn was announced in, so the distance
      // is measured against where the player actually was when the body was placed.
      spawns.push({ event, body, commander: { x: after.commander.x, y: after.commander.y }, tick: after.tick });
    }
  }
  return { run, spawns };
}

function allSpawns() {
  const out = [];
  for (const stageId of STAGES) {
    for (const seed of SEEDS) {
      for (const spawn of driveCollectingSpawns(stageId, seed, WINDOW_TICKS).spawns) {
        out.push({ ...spawn, stageId, seed });
      }
    }
  }
  return out;
}

const SPAWNS = allSpawns();

test("the arrival window actually exercises every authored formation", () => {
  // Guard the whole file: without this, a regression that quietly pinned every wave to `lane`
  // would leave every assertion below vacuously true.
  assert.ok(SPAWNS.length > 0, "window produced no spawns at all");
  const seen = new Set(SPAWNS.map((spawn) => spawn.event.arrivalFormation));
  for (const formation of ARRIVAL_FORMATIONS) {
    assert.ok(seen.has(formation), `no ${formation} arrival observed across ${STAGES.length}x${SEEDS.length} windows`);
  }
});

test("every arrival emits the grade and telegraph the renderer already branches on", () => {
  // Before this feature ENEMY_SPAWNED carried neither field, so isCriticalVfxEvent()'s SHADOW
  // branch and resolveVfxLifetimeTicks()'s 60-tick arrival fallback were unreachable in
  // production and every arrival silently resolved to the 30-tick table value.
  for (const { event, stageId, seed } of SPAWNS) {
    const label = `${stageId}/${seed}/${event.entityId}`;
    assert.ok(ARRIVAL_FORMATIONS.includes(event.arrivalFormation), `${label}: unknown formation ${event.arrivalFormation}`);
    assert.equal(event.grade, ARRIVAL_GRADES[event.arrivalFormation], `${label}: grade must follow the formation`);
    assert.equal(
      event.telegraphTicks,
      ARRIVAL_TELEGRAPH_TICKS[event.arrivalFormation],
      `${label}: telegraphTicks must follow the formation`,
    );
    assert.ok(Number.isInteger(event.telegraphTicks) && event.telegraphTicks > 0, `${label}: telegraph must be a positive integer`);
  }
});

test("only a near-player arrival is graded SHADOW, so the 40-slot pool is not starved", () => {
  // Exempting an edge walk-in from eviction would make every arrival un-evictable.
  for (const { event } of SPAWNS) {
    const near = ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation);
    assert.equal(event.grade === "SHADOW", near, `${event.arrivalFormation} graded ${event.grade}`);
  }
});

test("only a body that came for the player may arrive on top of the player", () => {
  // A gate-bound body dropped next to the commander skips the approach the defense loop is built
  // on -- and when the commander happens to be standing near the gate, it arrives at its objective
  // for free. `gate-pressure` must walk its lane, `flank` must take its authored flank route,
  // `resource-denial` must reach an echo, and `elite-escort` must stay with its leader.
  const offenders = SPAWNS.filter(({ event, body }) => ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation)
    && body
    && !["player-pursuit", "low-hp-focus", "resource-denial"].includes(body.policyId));
  assert.deepEqual(
    offenders.map(({ event, body }) => `${body.policyId}/${event.arrivalFormation}`),
    [],
    "a non-player-facing policy arrived inside the commander's space",
  );
});

test("a near-player arrival is placed far enough away to be seen and answered", () => {
  // The fairness floor. Contact range tops out at guardian 540 + commander 360 = 900, so the
  // minimum radius is more than double the largest range at which anything can touch the player.
  let checked = 0;
  for (const { event, stageId, seed } of SPAWNS) {
    if (!ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation)) continue;
    // `arrivalDistance` is measured at PLACEMENT. Reading the body's live position instead
    // measures how far it has already closed since arriving -- one skydrop that was placed at a
    // correct 1863 read as 857 a few ticks later, which is the ambush working, not a violation.
    // The floor is asserted exactly, with no tolerance, because placement is fully controlled.
    assert.ok(
      Number.isInteger(event.arrivalDistance),
      `${stageId}/${seed}: ENEMY_SPAWNED must state the arrival distance`,
    );
    // `arrivalPoint` places on the floor exactly; `placeOnTerrain` may then nudge the body off an
    // obstacle, and it must be allowed to -- fighting it would drop bodies inside geometry. The
    // allowance is one commander radius (360). That is wide enough for obstacle resolution and far
    // too narrow to hide the failure class this guards: the arena clamp collapsing the ring onto a
    // wall, which produced 808 against a floor of 1800 before `arrivalPoint` learned to re-project.
    const TERRAIN_NUDGE_ALLOWANCE = 360;
    assert.ok(
      event.arrivalDistance >= ARRIVAL_NEAR_RADIUS_MIN - TERRAIN_NUDGE_ALLOWANCE,
      `${stageId}/${seed}/${event.arrivalFormation}: placed ${event.arrivalDistance} from the commander, more than ${TERRAIN_NUDGE_ALLOWANCE} inside the ${ARRIVAL_NEAR_RADIUS_MIN} fairness floor`,
    );
    checked += 1;
  }
  assert.ok(checked > 0, "no near-player arrival was observed, so the fairness floor was never tested");
});

test("a near-player arrival cannot damage anything for the whole telegraph it advertises", () => {
  // The arming window is the ONLY thing that makes an ambush fair. It is asserted on the live
  // body's cooldowns, both of them, because a melee lockout alone would leave a ranged body free
  // to open fire from inside the ring the instant it appeared.
  let checked = 0;
  for (const { event, body, stageId, seed } of SPAWNS) {
    if (!ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation)) continue;
    const label = `${stageId}/${seed}/${event.arrivalFormation}/${event.entityId}`;
    // The body is read on the tick it spawned, so the cooldown has been decremented at most once.
    assert.ok(
      body.attackCooldown >= event.telegraphTicks - 1,
      `${label}: melee lockout ${body.attackCooldown} shorter than the advertised ${event.telegraphTicks}`,
    );
    assert.ok(
      body.rangedCooldown >= event.telegraphTicks - 1,
      `${label}: ranged lockout ${body.rangedCooldown} shorter than the advertised ${event.telegraphTicks}`,
    );
    checked += 1;
  }
  assert.ok(checked > 0, "no near-player arrival was observed, so the arming window was never tested");
});

test("an edge arrival keeps the original zero-cooldown entry", () => {
  // The byte-identity half of `lane`: an edge walk-in must be exactly what it always was.
  for (const { event, body } of SPAWNS) {
    if (ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation)) continue;
    if (!body) continue;
    assert.equal(body.attackCooldown, 0, `${event.arrivalFormation} must not carry an arming window`);
    assert.equal(body.rangedCooldown, 0, `${event.arrivalFormation} must not carry an arming window`);
  }
});

test("no wave puts more bodies inside the commander's space than the renderer spawn family admits", () => {
  // NEW_VFX_FAMILY_LIVE_BUDGET.spawn is 4. A wave that exceeded it would silently drop cues,
  // and spawnVfx() hard-returns without a warning, so the loss would be invisible in production.
  const perWave = new Map();
  for (const { event, stageId, seed } of SPAWNS) {
    if (!ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation)) continue;
    const key = `${stageId}/${seed}/${event.waveIndex}`;
    perWave.set(key, (perWave.get(key) || 0) + 1);
  }
  assert.ok(perWave.size > 0, "no near-player wave observed, so the budget was never tested");
  for (const [key, count] of perWave) {
    assert.ok(count <= ARRIVAL_NEAR_CAP, `${key}: ${count} near arrivals exceeds the spawn family budget of ${ARRIVAL_NEAR_CAP}`);
  }
});

test("the opening wave never ambushes, so the stage intro is never fought through", () => {
  for (const { event, stageId, seed } of SPAWNS) {
    if (event.waveIndex !== 0) continue;
    assert.equal(
      ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation),
      false,
      `${stageId}/${seed}: wave 0 used the near-player formation ${event.arrivalFormation}`,
    );
  }
});

test("a near-player arrival has consumed its route instead of walking back to an entry waypoint", () => {
  // A body that materialised past its approach must not treat a west entry waypoint as a goal.
  let checked = 0;
  for (const { event, body, stageId, seed } of SPAWNS) {
    if (!ARRIVAL_NEAR_FORMATIONS.includes(event.arrivalFormation)) continue;
    assert.ok(
      body.waypointIndex >= body.route.length,
      `${stageId}/${seed}/${event.entityId}: waypointIndex ${body.waypointIndex} still inside a ${body.route.length}-waypoint route`,
    );
    // The authored route itself is preserved, both on the body and on the event, so the
    // encounter contract still sees the path the wave was authored with.
    assert.deepEqual(event.route, body.route, "the emitted route must match the body's authored route");
    checked += 1;
  }
  assert.ok(checked > 0, "no near-player arrival was observed, so route consumption was never tested");
});

test("the arrival stream is derived, so drawing formations never moves the wave schedule", () => {
  // The load-bearing determinism claim. `defense-run-simulation.js` warns that `run.rng` is
  // positional and one extra draw on it shifts wave composition, timing jitter, lane offset,
  // spawn direction, policy selection and every growth offer. `arrivalRng` exists so arrival
  // choreography cannot do that.
  for (const stageId of STAGES) {
    for (const seed of SEEDS) {
      const fresh = createDefenseRun({ stageId, seed });
      const driven = driveCollectingSpawns(stageId, seed, WINDOW_TICKS).run;
      assert.notEqual(
        driven.arrivalRng,
        fresh.arrivalRng,
        `${stageId}/${seed}: arrivalRng must advance, otherwise no formation was ever drawn and this proves nothing`,
      );
      assert.equal(
        getRunSnapshot(driven).plan.waveVariantId,
        getRunSnapshot(fresh).plan.waveVariantId,
        `${stageId}/${seed}: the wave variant must not move when arrivals are drawn`,
      );
    }
  }
});

test("a rehydrated legacy save without arrivalRng resolves to the fresh-run stream", () => {
  // Same guard shape `combatRng` and `dropRng` already carry for pre-feature saves.
  const fresh = createDefenseRun({ stageId: "cinder-span", seed: 71 });
  const legacy = { ...fresh };
  delete legacy.arrivalRng;
  const rehydrated = advanceDefenseRun(legacy, 0);
  assert.equal(rehydrated.arrivalRng, fresh.arrivalRng);
});

test("authored arrival budgets stay internally consistent", () => {
  assert.ok(ARRIVAL_NEAR_RADIUS_MIN < ARRIVAL_NEAR_RADIUS_MAX, "the near band must be a band");
  // 900 is the largest contact range in the catalog (guardian 540 + commander 360). The floor is
  // authored at exactly twice that. Pinning it as `>=` rather than `>` states the real design:
  // anything less would let a body arrive already inside the reach of what it came to fight.
  assert.ok(ARRIVAL_NEAR_RADIUS_MIN >= 900 * 2, "the fairness floor must be at least twice the largest contact range");
  for (const formation of ARRIVAL_FORMATIONS) {
    assert.ok(Number.isInteger(ARRIVAL_TELEGRAPH_TICKS[formation]), `${formation} has no authored telegraph`);
    assert.ok(["BASIC", "SHADOW"].includes(ARRIVAL_GRADES[formation]), `${formation} has no authored grade`);
  }
  for (const formation of ARRIVAL_NEAR_FORMATIONS) {
    assert.ok(
      ARRIVAL_TELEGRAPH_TICKS[formation] > ARRIVAL_TELEGRAPH_TICKS.lane,
      `${formation} must warn longer than an edge walk-in`,
    );
  }
});

// --- Cross-layer integration -----------------------------------------------------------
// The simulation, the renderer and the audio layer each branch on `ENEMY_SPAWNED.grade`, and for
// several cycles NONE of those branches ran in production because nothing emitted the field. It
// stayed invisible because every existing test hand-built `{ grade: "SHADOW" }` and fed it
// straight to the consumer, so all three layers were verified against a payload the simulation
// never produced.
//
// These drive a REAL run and assert the layers agree on what it actually emits. They are the
// tests that would have caught the original dead hook, and they fail if the emit is removed.

test("a real run emits arrivals the audio layer can actually sound", async () => {
  const { audioCueForEvent, AUDIO_EVENT_POLICY } = await import("../defense-audio.js");

  // ENEMY_SPAWNED is silent by default ON PURPOSE: 10 concurrent BASIC spawns would take 10 of
  // the 12 available voices in one tick. Pin that, so "arrivals are audible" can never be
  // achieved by making every arrival audible.
  assert.equal(
    AUDIO_EVENT_POLICY.ENEMY_SPAWNED.intentionalSilence,
    true,
    "the default arrival policy must stay silent",
  );

  const graded = { basic: 0, shadow: 0 };
  for (const { event } of SPAWNS) {
    const cue = audioCueForEvent(event);
    if (event.grade === "SHADOW") {
      graded.shadow += 1;
      assert.equal(cue.cueId, "shadow-arrival", `a SHADOW arrival must resolve its cue, got ${cue.cueId}`);
      assert.equal(cue.intentionalSilence, false, "a SHADOW arrival must not be silent");
      assert.equal(cue.category, "spawn", "a SHADOW arrival stays in the spawn category");
    } else {
      graded.basic += 1;
      assert.equal(cue.intentionalSilence, true, `a ${event.grade} arrival must stay silent`);
      assert.equal(cue.cueId, null, "a silent arrival must resolve no cue");
    }
  }

  // Both sides of the branch must be exercised by real emissions, or this proves only that one of
  // them happens to be reachable.
  assert.ok(graded.shadow > 0, "no SHADOW arrival was emitted, so the audible path is unproven");
  assert.ok(graded.basic > 0, "no BASIC arrival was emitted, so the silent path is unproven");
});

test("the emitted arrival payload carries every field its three consumers read", async () => {
  // One list, three consumers: `grade` gates the renderer's pool exemption AND the audio policy;
  // `telegraphTicks` gates the renderer's cue lifetime AND the entry animation length;
  // `arrivalDistance` scales the entry. A missing field is not a crash anywhere -- every consumer
  // falls back silently -- which is exactly why it has to be asserted rather than trusted.
  for (const { event, stageId, seed } of SPAWNS) {
    const label = `${stageId}/${seed}/${event.entityId}`;
    assert.ok(["BASIC", "SHADOW"].includes(event.grade), `${label}: grade must be emitted`);
    assert.ok(Number.isInteger(event.telegraphTicks) && event.telegraphTicks > 0, `${label}: telegraphTicks must be emitted`);
    assert.ok(Number.isInteger(event.arrivalDistance) && event.arrivalDistance >= 0, `${label}: arrivalDistance must be emitted`);
  }
});

test("a wave never asks the audio layer for more arrival voices than it has", async () => {
  // MAX_ACTIVE_VOICES is 12 and shadow-arrival carries priority 68, so an unbounded ambush would
  // evict lower-priority combat audio wholesale. The simulation's ARRIVAL_NEAR_CAP is what bounds
  // it, and that bound is only meaningful if it also holds per TICK -- several waves can be
  // draining their spawn queues at once.
  const perTick = new Map();
  for (const { event, tick, stageId, seed } of SPAWNS) {
    if (event.grade !== "SHADOW") continue;
    const key = `${stageId}/${seed}/${tick}`;
    perTick.set(key, (perTick.get(key) || 0) + 1);
  }
  assert.ok(perTick.size > 0, "no SHADOW arrival tick observed, so the voice bound was never tested");
  for (const [key, count] of perTick) {
    assert.ok(count <= ARRIVAL_NEAR_CAP, `${key}: ${count} audible arrivals in one tick exceeds ${ARRIVAL_NEAR_CAP}`);
  }
});
