import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "../vendor/three.module.js";
import {
  CAMERA_LOOK_LAMBDA,
  CAMERA_PHASES,
  CAMERA_POSITION_LAMBDA,
  CAMERA_TIER_TRANSITION_TICKS,
  RealtimeBattle,
  cameraTierTarget,
  exponentialSmoothingFactor,
  stageFogRange,
} from "../battle-realtime-three.js";

const PHASE_TARGETS = Object.freeze({
  DESCENT: 20.8,
  SKIRMISH: 26,
  SURGE: 33,
  MIDBOSS: 38,
  BIGWAVE: 41.5,
  FINALE: 41.5,
});
const PHASE_DEPTHS = Object.freeze({
  DESCENT: 23,
  SKIRMISH: 28.7,
  SURGE: 36.5,
  MIDBOSS: 42,
  BIGWAVE: 45.9,
  FINALE: 45.9,
});
const STAGE_BASE_FOG = Object.freeze({
  "cinder-span": Object.freeze({ near: 22.4, far: 50.4 }),
  "abyss-chancel": Object.freeze({ near: 21, far: 46.2 }),
  "echo-throne": Object.freeze({ near: 19.6, far: 42 }),
});

function assertNear(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected} ±${tolerance}, got ${actual}`);
}

function cameraHarness({ reducedMotion = false } = {}) {
  const adapter = new RealtimeBattle({ reducedMotion });
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

function phaseSnapshot(phase, tick, commander = { x: 12000, y: 6000 }) {
  return { tick, commander, objectives: { phase } };
}

function smoothedValue({ initial, target, lambda, deltaSeconds, steps }) {
  let value = initial;
  for (let index = 0; index < steps; index += 1) {
    value += (target - value) * exponentialSmoothingFactor(lambda, deltaSeconds);
  }
  return value;
}

test("cam-tier-zoom exposes every phase target inside the authored orbit clamp", () => {
  assert.deepEqual(CAMERA_PHASES, Object.keys(PHASE_TARGETS));
  for (const phase of CAMERA_PHASES) {
    const target = cameraTierTarget(phase);
    assertNear(target, PHASE_TARGETS[phase], 1e-12, `${phase} tier target`);
    assert.ok(target >= 10.39 && target <= 41.58, `${phase} target ${target} must stay inside [10.39, 41.58]`);
  }
  assert.equal(cameraTierTarget(), PHASE_TARGETS.DESCENT, "the public default remains safe for legacy callers");
  assert.equal(cameraTierTarget("unknown"), PHASE_TARGETS.DESCENT, "unknown phases fail closed to DESCENT");
});

test("cam-fog-clarity keeps all canonical stage-phase boundaries at or above 0.75 clarity", () => {
  for (const stageId of Object.keys(STAGE_BASE_FOG)) {
    for (const phase of CAMERA_PHASES) {
      const { near, far } = stageFogRange(stageId, phase);
      const clarity = (far - PHASE_DEPTHS[phase]) / (far - near);
      assert.ok(clarity >= 0.75 - 1e-12, `${stageId}/${phase} boundary clarity ${clarity} must be >= 0.75`);
    }
  }
});

test("cam-fog-never-thicker never reduces an authored stage far plane", () => {
  for (const [stageId, authored] of Object.entries(STAGE_BASE_FOG)) {
    for (const phase of CAMERA_PHASES) {
      const { far } = stageFogRange(stageId, phase);
      assert.ok(far >= authored.far - 1e-12, `${stageId}/${phase} far ${far} must not be below authored ${authored.far}`);
    }
  }
});

test("cam-fog-near-preserved keeps the authored near plane through every phase", () => {
  for (const [stageId, authored] of Object.entries(STAGE_BASE_FOG)) {
    for (const phase of CAMERA_PHASES) {
      assertNear(stageFogRange(stageId, phase).near, authored.near, 1e-12, `${stageId}/${phase} near plane`);
    }
  }
});

test("cam-fog-within-far stays below camera far 200 and the runtime consumes same-stage phase fog", () => {
  for (const stageId of Object.keys(STAGE_BASE_FOG)) {
    for (const phase of CAMERA_PHASES) {
      assert.ok(stageFogRange(stageId, phase).far < 200, `${stageId}/${phase} fog must remain before camera far 200`);
    }
  }

  const adapter = cameraHarness();
  adapter.applyStagePalette("echo-throne", "DESCENT", 0);
  assertNear(adapter.scene.fog.far, stageFogRange("echo-throne", "DESCENT").far, 1e-12, "runtime DESCENT fog");
  adapter.applyStagePalette("echo-throne", "BIGWAVE", 1);
  adapter.applyStagePalette("echo-throne", "BIGWAVE", 1 + CAMERA_TIER_TRANSITION_TICKS);
  assertNear(adapter.scene.fog.far, stageFogRange("echo-throne", "BIGWAVE").far, 1e-9, "runtime BIGWAVE fog after 90 ticks");
});

test("cam-tier-transition moves SURGE to MIDBOSS without a cut and settles on tick 90", () => {
  const adapter = cameraHarness();
  adapter.updateCamera(phaseSnapshot("SURGE", 0));
  const surgeDistance = adapter.camera.position.distanceTo(adapter.cameraTarget);

  adapter.updateCamera(phaseSnapshot("MIDBOSS", 1));
  const firstTransitionDistance = adapter.camera.position.distanceTo(adapter.cameraTarget);
  assert.ok(firstTransitionDistance >= surgeDistance && firstTransitionDistance < PHASE_TARGETS.MIDBOSS, "first transition tick must move forward without cutting to MIDBOSS");

  adapter.updateCamera(phaseSnapshot("MIDBOSS", 45));
  const midpointDistance = adapter.camera.position.distanceTo(adapter.cameraTarget);
  assert.ok(midpointDistance > firstTransitionDistance && midpointDistance < PHASE_TARGETS.MIDBOSS, "mid-transition distance must remain between endpoints");

  adapter.updateCamera(phaseSnapshot("MIDBOSS", 90));
  const settledDistance = adapter.camera.position.distanceTo(adapter.cameraTarget);
  assert.equal(CAMERA_TIER_TRANSITION_TICKS, 90);
  assertNear(settledDistance, PHASE_TARGETS.MIDBOSS, PHASE_TARGETS.MIDBOSS * 0.02, "tick-90 MIDBOSS distance");
});

test("cam-frame-independence gives position and look smoothing the same result at 60fps and 30fps", () => {
  assert.equal(CAMERA_POSITION_LAMBDA, 6);
  assert.equal(CAMERA_LOOK_LAMBDA, 11);
  for (const [label, lambda, target] of [
    ["position", CAMERA_POSITION_LAMBDA, 37],
    ["look", CAMERA_LOOK_LAMBDA, -19],
  ]) {
    const at60fps = smoothedValue({ initial: 3, target, lambda, deltaSeconds: 1 / 60, steps: 90 });
    const at30fps = smoothedValue({ initial: 3, target, lambda, deltaSeconds: 1 / 30, steps: 45 });
    assertNear(at60fps, at30fps, 1e-12, `${label} after equal 1.5-second intervals`);
  }
});

test("cam-corner clamps the authoritative target to the arena at both extreme corners", () => {
  const adapter = cameraHarness({ reducedMotion: true });
  adapter.updateCamera(phaseSnapshot("DESCENT", 0, { x: -99999, y: 99999 }));
  assert.deepEqual(adapter.cameraTarget.toArray(), [-14, 0, 14]);

  adapter.updateCamera(phaseSnapshot("DESCENT", 1, { x: 99999, y: -99999 }));
  assert.deepEqual(adapter.cameraTarget.toArray(), [14, 0, -14]);
});
