// Contract tests for the ooo-spec refinement slice:
//   - per-stage-camera-framing-addendum.md §§1,3,4 (zoom clamp, pitch floor,
//     FINALE look-at offset)
//   - _workspace/current/refinement-prompts/README.md §2 (direction x level hit
//     reaction routing) and §5.1 (mesh-size-aware motion profile)
import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "../vendor/three.module.js";
import {
  CAMERA_PHASES,
  HIT_REACTION_DIRECTIONS,
  MOTION_PROFILE_REFERENCE_HEIGHT,
  RealtimeBattle,
  STAGE_CAMERA_ENVELOPES,
  cameraTierTarget,
  hitReactionDirection,
  hitReactionKey,
  comboAttackKey,
  castActionKey,
  motionPlaybackRate,
  motionProfileFor,
  stageFinaleLookOffset,
  stagePitchRange,
  stageZoomClamp,
} from "../battle-realtime-three.js";

const GLOBAL_ZOOM = Object.freeze({ min: 10.4, max: 41.6 });
const GLOBAL_PITCH = Object.freeze({
  min: THREE.MathUtils.degToRad(30),
  max: THREE.MathUtils.degToRad(85),
});
const STAGES = Object.keys(STAGE_CAMERA_ENVELOPES);

function cameraHarness() {
  const adapter = new RealtimeBattle({ reducedMotion: false });
  adapter.disposed = false;
  adapter.scene = new THREE.Scene();
  adapter.scene.fog = new THREE.Fog(0x030712, 1, 100);
  adapter.camera = new THREE.PerspectiveCamera(42, 640 / 360, 0.1, 200);
  adapter.ambientLight = new THREE.AmbientLight(0x33445a, 1.1);
  adapter.keyLight = new THREE.DirectionalLight(0xfff0d8, 1.6);
  adapter.rimLight = new THREE.DirectionalLight(0x6ea8ff, 0.6);
  adapter.rimLightTarget = new THREE.Object3D();
  adapter.rimLight.target = adapter.rimLightTarget;
  adapter.scene.add(adapter.ambientLight, adapter.keyLight, adapter.rimLight, adapter.rimLightTarget);
  return adapter;
}

function snapshot(stageId, phase, tick, commander = { x: 12000, y: 6000 }) {
  return { tick, commander, stageId, objectives: { phase } };
}

test("cam-per-stage-zoom keeps every stage clamp inside the global orbit envelope", () => {
  for (const stageId of STAGES) {
    const clamp = stageZoomClamp(stageId);
    assert.ok(clamp.min >= GLOBAL_ZOOM.min - 1e-9, `${stageId} min ${clamp.min} escapes global`);
    assert.ok(clamp.max <= GLOBAL_ZOOM.max + 1e-9, `${stageId} max ${clamp.max} escapes global`);
    assert.ok(clamp.min < clamp.max, `${stageId} clamp is degenerate`);
  }
  // abyss-chancel is the one stage that actually narrows the band.
  assert.deepEqual({ ...stageZoomClamp("abyss-chancel") }, { min: 12, max: 36 });
  assert.deepEqual({ ...stageZoomClamp("cinder-span") }, { ...GLOBAL_ZOOM });
  // An unknown stage falls back to the full global envelope.
  assert.deepEqual({ ...stageZoomClamp("not-a-stage") }, { ...GLOBAL_ZOOM });
});

test("cam-per-stage-zoom lets a phase tier outside the stage clamp still win", () => {
  const adapter = cameraHarness();
  // FINALE tier is 41.5, above abyss-chancel's manual ceiling of 36. A tickless
  // snapshot commits the tier immediately instead of easing over 90 ticks.
  adapter.updateCamera({ ...snapshot("abyss-chancel", "FINALE", 0), tick: undefined }, 0);
  assert.equal(adapter.phaseZoomFactor, cameraTierTarget("FINALE"));
  adapter.zoom(50);
  assert.ok(
    adapter.zoomFactor >= cameraTierTarget("FINALE") - 1e-9,
    `tier target must survive the stage clamp, got ${adapter.zoomFactor}`,
  );
  // Inside a tier the stage clamp still binds: DESCENT (20.8) pinches to >= 12.
  adapter.updateCamera({ ...snapshot("abyss-chancel", "DESCENT", 1), tick: undefined }, 16);
  adapter.zoom(-100);
  assert.ok(adapter.zoomFactor >= 12 - 1e-9, `stage floor must bind, got ${adapter.zoomFactor}`);
});

test("cam-per-stage-pitch raises the abyss-chancel floor to 35 degrees while pushed in", () => {
  const skirmish = stagePitchRange("abyss-chancel", "SKIRMISH");
  assert.ok(skirmish.min >= THREE.MathUtils.degToRad(35) - 1e-9);
  assert.equal(stagePitchRange("abyss-chancel", "FINALE").min, GLOBAL_PITCH.min);
  for (const stageId of ["cinder-span", "echo-throne"]) {
    for (const phase of CAMERA_PHASES) {
      assert.equal(stagePitchRange(stageId, phase).min, GLOBAL_PITCH.min, `${stageId}/${phase}`);
    }
  }

  const adapter = cameraHarness();
  adapter.updateCamera(snapshot("abyss-chancel", "SKIRMISH", 0), 0);
  const cut = adapter.orbit(0, -Math.PI);
  assert.equal(cut, true, "dragging past the raised floor must report a clamped input");
  assert.ok(
    adapter.orbitPitch >= THREE.MathUtils.degToRad(35) - 1e-9,
    `orbit pitch ${adapter.orbitPitch} fell below the stage floor`,
  );
});

test("cam-boss-look-offset biases the FINALE look target per stage and nowhere else", () => {
  assert.deepEqual({ ...stageFinaleLookOffset("cinder-span", "SKIRMISH") }, { x: 0, z: 0 });
  assert.deepEqual({ ...stageFinaleLookOffset("echo-throne", "FINALE") }, { x: 0, z: 0 });
  const cinder = stageFinaleLookOffset("cinder-span", "FINALE");
  const chancel = stageFinaleLookOffset("abyss-chancel", "FINALE");
  assert.ok(cinder.z > 0, "cinder-span pushes up-corridor");
  assert.ok(chancel.z < 0, "abyss-chancel pulls down-nave");

  const adapter = cameraHarness();
  const commander = { x: 12000, y: 6000 };
  adapter.updateCamera(snapshot("cinder-span", "SKIRMISH", 0, commander), 0);
  const neutralZ = adapter.cameraTarget.z;
  const finale = cameraHarness();
  finale.updateCamera(snapshot("cinder-span", "FINALE", 0, commander), 0);
  assert.ok(
    Math.abs((finale.cameraTarget.z - neutralZ) - cinder.z) < 1e-6,
    `FINALE look target must carry exactly the authored offset (${finale.cameraTarget.z - neutralZ} vs ${cinder.z})`,
  );
});

test("motion profile derives speed and reaction arc from mesh size, not from a per-kind constant", () => {
  const reference = motionProfileFor(MOTION_PROFILE_REFERENCE_HEIGHT);
  assert.equal(reference.heightRatio, 1);
  assert.equal(reference.locomotionRate, 1);
  assert.equal(reference.oneShotRate, 1);

  const boss = motionProfileFor(4.5);
  const companion = motionProfileFor(1.3);
  assert.ok(boss.locomotionRate < reference.locomotionRate, "a boss strides slower than a standard enemy");
  assert.ok(companion.locomotionRate > reference.locomotionRate, "a companion strides faster");
  assert.ok(boss.oneShotRate < companion.oneShotRate, "a boss winds up slower than a companion");
  assert.ok(boss.reactionArcScale < 1 && companion.reactionArcScale > 1);

  // Monotonic in mesh size across the authored silhouette range.
  const heights = [1.3, 1.55, 1.7, 2.2, 4.5];
  for (let i = 1; i < heights.length; i += 1) {
    assert.ok(
      motionProfileFor(heights[i]).locomotionRate <= motionProfileFor(heights[i - 1]).locomotionRate,
      `locomotion rate must not rise with mesh height at ${heights[i]}`,
    );
  }

  // Bounded: even a degenerate input stays inside a playable band.
  for (const height of [0, -12, Number.NaN, 1e6]) {
    const profile = motionProfileFor(height);
    assert.ok(profile.locomotionRate >= 0.7 && profile.locomotionRate <= 1.2, `height ${height}`);
    assert.ok(profile.oneShotRate >= 0.72 && profile.oneShotRate <= 1.15, `height ${height}`);
  }

  // Locomotion and one-shot beats read different lanes of the same profile.
  assert.equal(motionPlaybackRate(boss, "idle"), boss.locomotionRate);
  assert.equal(motionPlaybackRate(boss, "run"), boss.locomotionRate);
  assert.equal(motionPlaybackRate(boss, "attack"), boss.oneShotRate);
  assert.equal(motionPlaybackRate(boss, "bighit_left"), boss.oneShotRate);
  // A record without a profile still plays at authored speed.
  assert.equal(motionPlaybackRate(null, "idle"), 1);
});

test("hit reactions resolve direction in the target frame and fall back to the flat clip", () => {
  const facingNorth = 0; // target looks toward +Z
  assert.equal(hitReactionDirection(0, facingNorth), "front");
  assert.equal(hitReactionDirection(Math.PI, facingNorth), "back");
  assert.equal(hitReactionDirection(Math.PI / 2, facingNorth), "right");
  assert.equal(hitReactionDirection(-Math.PI / 2, facingNorth), "left");
  // Rotating the target rotates the resolved direction with it.
  assert.equal(hitReactionDirection(Math.PI / 2, Math.PI / 2), "front");
  // Malformed input never invents a direction.
  assert.equal(hitReactionDirection(Number.NaN, 0), "front");
  assert.equal(hitReactionDirection(0, null), "front");

  const flatRig = { hit: {}, bighit: {} };
  for (const direction of HIT_REACTION_DIRECTIONS) {
    assert.equal(hitReactionKey(flatRig, direction, false), "hit");
    assert.equal(hitReactionKey(flatRig, direction, true), "bighit");
  }
  const directionalRig = { hit: {}, bighit: {}, hit_left: {}, bighit_back: {} };
  assert.equal(hitReactionKey(directionalRig, "left", false), "hit_left");
  assert.equal(hitReactionKey(directionalRig, "back", true), "bighit_back");
  // Level and direction are independent: no bighit_left clip means bighit.
  assert.equal(hitReactionKey(directionalRig, "left", true), "bighit");
  assert.equal(hitReactionKey(directionalRig, "up", false), "hit");
});

test("combo and cast beats resolve to the richer clip only when the rig carries it", () => {
  // HongT CinderActor parity: attack2/attack3 escalate the light-combo chain, cast is the
  // caster beat. A rig without the retargeted clips falls back to what it always had.
  const flatRig = { attack: {}, critical: {} };
  assert.equal(comboAttackKey(flatRig, 1), "attack");
  assert.equal(comboAttackKey(flatRig, 2), "attack");
  assert.equal(comboAttackKey(flatRig, 3), "attack");

  const comboRig = { attack: {}, attack2: {}, attack3: {}, critical: {} };
  assert.equal(comboAttackKey(comboRig, 1), "attack");
  assert.equal(comboAttackKey(comboRig, 2), "attack2");
  assert.equal(comboAttackKey(comboRig, 3), "attack3");
  // Steps beyond the authored chain clamp to the top tier, never off the end.
  assert.equal(comboAttackKey(comboRig, 4), "attack3");
  // Malformed step never invents a beat: it opens the chain.
  assert.equal(comboAttackKey(comboRig, Number.NaN), "attack");
  assert.equal(comboAttackKey(comboRig, undefined), "attack");

  // A rig with attack2 but no attack3 escalates only as far as it can.
  const partialRig = { attack: {}, attack2: {}, critical: {} };
  assert.equal(comboAttackKey(partialRig, 3), "attack");

  // Cast prefers the dedicated beat, then the sim-authored hint, then flat critical.
  assert.equal(castActionKey({ cast: {}, critical: {} }, "attack"), "cast");
  assert.equal(castActionKey({ critical: {}, attack: {} }, "attack"), "attack");
  assert.equal(castActionKey({ critical: {} }, "attack"), "critical");
  assert.equal(castActionKey({ critical: {} }, undefined), "critical");
  assert.equal(castActionKey(null, "attack"), "critical");
});

test("triggerHitReaction picks the directional clip for a blow from behind", () => {
  const adapter = cameraHarness();
  const played = [];
  adapter.triggerAction = (record, key) => {
    played.push(key);
    return true;
  };
  const target = {
    root: new THREE.Object3D(),
    yaw: 0, // facing +Z
    actions: { hit: {}, bighit: {}, hit_back: {} },
  };
  const attacker = { root: new THREE.Object3D() };
  attacker.root.position.set(0, 0, -5); // behind the target
  adapter.triggerHitReaction(target, attacker, false, 0);
  assert.deepEqual(played, ["hit_back"]);

  // Without a known attacker the reaction stays the flat front clip.
  played.length = 0;
  adapter.triggerHitReaction(target, null, true, 0);
  assert.deepEqual(played, ["bighit"]);

  // A missing target record is a no-op, never a thrown frame.
  assert.equal(adapter.triggerHitReaction(undefined, attacker, false, 0), false);
});

// The combination neither side of the cycle-10 merge tested. Upstream authored the eight
// directional clips into `unarmed-core.glb` (24 clips, so `hitReactionKey` now genuinely
// resolves `hit_left` instead of always falling back to flat `hit`), while the facing change
// redefined `record.yaw` from LAST-MOVEMENT heading to AIM heading. Directional routing reads
// that same `yaw` as its second operand, so the resolved clip now depends on where the target
// is AIMING rather than where it last walked. The test above uses `yaw: 0`, which is
// indistinguishable from an unfaced default, so it cannot tell the two readings apart.
//
// SCOPE, stated precisely: this test hand-sets a non-zero `yaw` exactly as the one above does.
// It pins that quadrant routing resolves correctly against an aim-derived yaw, and that the
// stale-walk-heading answer is wrong. It does NOT drive `snapshotFacingYaw`, so it would still
// pass if the `facingX`/`facingY` -> `record.yaw` conversion regressed. The end-to-end link
// from published facing through yaw to the resolved `hit_*` key is covered separately in
// `tests/defense-renderer-contract.test.mjs`, which has the `reconcileActors` harness.
test("directional hit routing resolves against AIM yaw, not the last-movement heading", () => {
  const adapter = cameraHarness();
  const played = [];
  adapter.triggerAction = (record, key) => { played.push(key); return true; };

  // A target that walked toward +Z, then turned to aim at +X without moving. Under the old
  // movement-only yaw these are indistinguishable -- both leave yaw at the +Z walk heading.
  const target = {
    root: new THREE.Object3D(),
    yaw: Math.PI / 2, // aiming +X
    actions: { hit: {}, bighit: {}, hit_front: {}, hit_back: {}, hit_left: {}, hit_right: {} },
  };
  const attacker = { root: new THREE.Object3D() };

  // Blow arrives from +X -- the exact direction the target is aiming, so it is a FRONT hit.
  // Against the stale +Z walk heading the same blow would have resolved as `hit_right`.
  attacker.root.position.set(5, 0, 0);
  adapter.triggerHitReaction(target, attacker, false, 0);
  assert.deepEqual(played, ["hit_front"], "a blow from the aim direction is a front hit");

  // Blow from -X, directly behind the aim.
  played.length = 0;
  attacker.root.position.set(-5, 0, 0);
  adapter.triggerHitReaction(target, attacker, false, 0);
  assert.deepEqual(played, ["hit_back"], "a blow opposite the aim is a back hit");

  // Blow from +Z, which is 90 degrees off the aim. This is the row that proves the routing
  // follows aim: +Z is where the target USED to be heading, and a movement-driven yaw would
  // have called this `hit_front`.
  played.length = 0;
  attacker.root.position.set(0, 0, 5);
  adapter.triggerHitReaction(target, attacker, false, 0);
  assert.equal(played.length, 1);
  assert.notEqual(played[0], "hit_front", "the old walk heading must not resolve as front");
  assert.ok(
    played[0] === "hit_left" || played[0] === "hit_right",
    `a blow 90 degrees off the aim is lateral, got ${played[0]}`,
  );
});
