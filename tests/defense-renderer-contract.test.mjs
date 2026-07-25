import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as THREE from "../vendor/three.module.js";
import { RealtimeBattle } from "../battle-realtime-three.js";
import { BattleVisualizer } from "../battle-visualizer.js";
import { STAGES } from "../defense-catalog.js";

// RealtimeBattle (primary, WebGL/Three.js) and BattleVisualizer (fallback,
// Canvas2D) are no longer parallel implementations of the same drawing
// calls -- app.js's mount-RealtimeBattle-then-catch-and-fall-back-to-
// BattleVisualizer pattern (verified by the WebGL-context-failure test
// below) means only the passive method surface and no-ownership source
// scan can be asserted identically across both. Canvas2D-drawing-specific
// behavior stays scoped to BattleVisualizer; RealtimeBattle's real Three.js
// scene-graph reconciliation is exercised directly against its actual
// scene/camera/groups (constructed here without going through mount(),
// which requires a real WebGL-capable canvas -- see webglTestCanvas()).
const ADAPTERS = [RealtimeBattle, BattleVisualizer];
const SOURCES = ["battle-realtime-three.js", "battle-visualizer.js"];

function mockCanvas() {
  const calls = [];
  const gradient = { addColorStop(...args) { calls.push(["stop", ...args]); } };
  const context = {
    beginPath() { calls.push(["begin"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    clearRect(...args) { calls.push(["clear", ...args]); },
    fill() { calls.push(["fill"]); },
    fillRect(...args) { calls.push(["rect", ...args]); },
    stroke() { calls.push(["stroke"]); },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    set fillStyle(value) { calls.push(["fillStyle", value]); },
    set strokeStyle(value) { calls.push(["strokeStyle", value]); },
    set lineWidth(value) { calls.push(["lineWidth", value]); },
  };
  return { width: 640, height: 360, calls, getContext: () => context };
}
function cameraCanvas() {
  const calls = [];
  const gradient = { addColorStop(...args) { calls.push(["stop", ...args]); } };
  const context = new Proxy({
    clearRect(...args) { calls.push(["clear", ...args]); },
    fillRect(...args) { calls.push(["rect", ...args]); },
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    translate(...args) { calls.push(["translate", ...args]); },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
  }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => calls.push([String(name), ...args]);
    },
    set(_target, name, value) {
      calls.push([String(name), value]);
      return true;
    },
  });
  return { width: 640, height: 360, calls, getContext: () => context };
}

// A canvas shaped like the DOM's HTMLCanvasElement enough for
// THREE.WebGLRenderer's constructor to reach actual WebGL context creation
// (it needs addEventListener for its context-lost/restored listeners) --
// but getContext() still returns null, since no real GL implementation is
// available under plain `node --test`. This is not a workaround: it proves
// the exact failure path app.js's try/catch depends on for its
// RealtimeBattle-then-BattleVisualizer fallback.
function webglTestCanvas() {
  return {
    width: 640,
    height: 360,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => null,
  };
}

// Constructs a RealtimeBattle wired directly to real (not mocked)
// THREE.Scene/Camera/Group instances, the same objects mount() itself
// would create -- bypassing only THREE.WebGLRenderer, the one piece that
// requires an actual GL implementation. Every method under test
// (reconcileActors, updateCamera, ensureStageTerrain, dispose) runs its
// real, unmodified implementation against this scene graph. Includes
// scene.fog/ambientLight/keyLight/rimLight/rimLightTarget -- the same
// objects mount() itself creates (battle-realtime-three.js mount()) --
// since applyStagePalette()/updateCamera() now read/write them directly.
function realtimeBattleHarness() {
  const adapter = new RealtimeBattle();
  adapter.disposed = false;
  adapter.scene = new THREE.Scene();
  adapter.scene.fog = new THREE.Fog(0x030712, 1, 100);
  adapter.camera = new THREE.PerspectiveCamera(42, 640 / 360, 0.1, 200);
  adapter.terrainGroup = new THREE.Group();
  adapter.actorGroup = new THREE.Group();
  adapter.vfxGroup = new THREE.Group();
  adapter.scene.add(adapter.terrainGroup, adapter.actorGroup, adapter.vfxGroup);
  adapter.gateMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.08, 12, 32),
    new THREE.MeshStandardMaterial(),
  );
  adapter.gateMesh.visible = false;
  adapter.scene.add(adapter.gateMesh);
  adapter.ambientLight = new THREE.AmbientLight(0x33445a, 1.1);
  adapter.keyLight = new THREE.DirectionalLight(0xfff0d8, 1.6);
  adapter.rimLight = new THREE.DirectionalLight(0x6ea8ff, 0.6);
  adapter.rimLightTarget = new THREE.Object3D();
  adapter.rimLight.target = adapter.rimLightTarget;
  adapter.scene.add(adapter.ambientLight, adapter.keyLight, adapter.rimLight, adapter.rimLightTarget);
  return adapter;
}

const CINDER_SPAN_WORLD_ASSETS = [
  "./assets/images/battle/world/cinder-span-topdown-plate.webp",
  "./assets/images/battle/world/cinder-span-tactical-paper-plate.webp",
];

let rendererImportNonce = 0;

function cinderSpanSnapshot() {
  return {
    tick: 5,
    presentation: {
      stageId: "cinder-span",
      stagePresentation: {
        palette: { contour: "contour", hazard: "hazard", objective: "objective", surface: "surface" },
        terrain: { patternId: "cinder-span" },
      },
      terrain: { tactics: {} },
    },
  };
}

function unavailableImage() {
  return class UnavailableImage {
    set src(_value) {
      throw new Error("image unavailable");
    }
  };
}

function loadedImage() {
  return class LoadedImage {
    constructor() {
      this.complete = false;
      this.naturalHeight = 0;
      this.naturalWidth = 0;
    }

    set src(value) {
      this._src = value;
      this.complete = true;
      this.naturalHeight = 1;
      this.naturalWidth = 1;
    }

    get src() {
      return this._src;
    }
  };
}

function replaceImage(t, Image) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Image");
  Object.defineProperty(globalThis, "Image", { configurable: true, value: Image });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "Image", original);
    else delete globalThis.Image;
  });
}

async function freshAdapters() {
  const query = `?renderer-contract=${rendererImportNonce += 1}`;
  const [{ RealtimeBattle: Primary }, { BattleVisualizer: Fallback }] = await Promise.all([
    import(`../battle-realtime-three.js${query}`),
    import(`../battle-visualizer.js${query}`),
  ]);
  return [Primary, Fallback];
}


const snapshot = {
  gate: { x: 320, y: 300, radius: 32 },
  commander: { x: 300, y: 260 },
  enemies: [{ x: 120, y: 80 }],
  boss: { x: 500, y: 120 },
  projectiles: [{ x: 220, y: 140 }],
  pickups: [{ x: 250, y: 220 }],
  companions: [{ x: 350, y: 230 }],
};

test("defense renderer adapters expose the passive snapshot surface", () => {
  for (const Adapter of ADAPTERS) {
    const adapter = new Adapter();
    for (const method of ["mount", "renderSnapshot", "dispose", "onVisualFeedback", "debugMetrics"]) {
      assert.equal(typeof adapter[method], "function", `${Adapter.name}.${method}`);
    }
    assert.deepEqual(Object.keys(adapter.debugMetrics()).sort(), ["geometries", "programs", "textures"]);
    for (const value of Object.values(adapter.debugMetrics())) assert.equal(typeof value, "number");
  }
});

test("RealtimeBattle throws on WebGL context creation failure, matching app.js's fallback contract", () => {
  const adapter = new RealtimeBattle();
  assert.equal(adapter.disposed, true, "a fresh, unmounted adapter reports disposed");
  assert.throws(
    () => adapter.mount({ canvas: webglTestCanvas(), viewport: { width: 640, height: 360 } }),
    /WebGL/,
    "mount() must throw when WebGL context creation fails, so app.js's try/catch can fall back to BattleVisualizer",
  );
  assert.deepEqual(adapter.debugMetrics(), { geometries: 0, textures: 0, programs: 0 }, "debugMetrics is a safe zero-value no-op without a renderer");
  assert.doesNotThrow(() => adapter.renderSnapshot(snapshot), "renderSnapshot is a safe no-op without a mounted renderer");
  assert.doesNotThrow(() => adapter.dispose(), "dispose is a safe no-op on a never-mounted adapter");
  assert.doesNotThrow(() => adapter.dispose(), "dispose remains idempotent");
});

test("defense renderer fallback adapter projects a supplied snapshot to a mocked Canvas2D context", () => {
  const canvas = mockCanvas();
  const adapter = new BattleVisualizer();
  assert.equal(adapter.mount({ canvas, handoff: { ignored: true }, viewport: { width: 640, height: 360 } }), adapter);
  assert.doesNotThrow(() => adapter.renderSnapshot(snapshot, { index: 4 }));
  assert.ok(canvas.calls.some(([name]) => name === "rect"), "BattleVisualizer paints its background");
  assert.ok(canvas.calls.filter(([name]) => name === "arc").length >= 7, "BattleVisualizer paints game entities");
  adapter.onVisualFeedback(17);
  assert.doesNotThrow(() => adapter.dispose());
  assert.doesNotThrow(() => adapter.dispose());
  assert.doesNotThrow(() => adapter.renderSnapshot(snapshot));
});

test("RealtimeBattle reconciles a supplied snapshot into its real Three.js scene graph without mutation", () => {
  const adapter = realtimeBattleHarness();
  // Shaped like the real simulation's snapshot contract (defense-run-
  // simulation.js): every actor carries `.id` (RealtimeBattle tracks
  // actors by id, unlike the legacy Canvas2D renderer which drew straight
  // from array position) and a boss is an enemy with `class: "boss"`, not
  // a separate top-level field.
  const idSnapshot = {
    tick: 12,
    gate: { id: "gate", x: 22000, y: 6000, radius: 900 },
    commander: { id: "commander", x: 19000, y: 6000 },
    enemies: [
      { id: "enemy-1", x: 3940, y: 9987, kind: "rusher" },
      { id: "boss-1", x: 5000, y: 8000, class: "boss", bossId: "s4-tide-warden" },
    ],
    projectiles: [{ id: "projectile-1", x: 1000, y: 1000 }],
    pickups: [{ id: "pickup-1", x: 2000, y: 2000 }],
    companions: [{ id: "companion-1", x: 3000, y: 3000, companionId: "ember-cohort" }],
  };
  const before = structuredClone(idSnapshot);

  adapter.reconcileActors(idSnapshot);
  assert.deepEqual(idSnapshot, before, "reconciliation must not mutate the supplied snapshot");
  assert.equal(adapter.actors.size, 6, "commander + 2 enemies (one a boss) + projectile + pickup + companion = 6");
  assert.deepEqual(
    [...adapter.actors.values()].map((r) => r.kind).sort(),
    ["boss", "commander", "companion", "enemy", "pickup", "projectile"],
  );
  assert.equal(adapter.gateMesh.visible, true, "a present gate makes the gate mesh visible");

  const withoutEnemies = { ...idSnapshot, enemies: [] };
  adapter.reconcileActors(withoutEnemies);
  assert.equal(adapter.actors.size, 4, "actors absent from the next snapshot are retired");

  adapter.onVisualFeedback(9);
  assert.equal(adapter.lastFeedback, 9);

  assert.doesNotThrow(() => adapter.dispose());
  assert.equal(adapter.disposed, true);
  assert.equal(adapter.actors.size, 0, "dispose clears all tracked actors");
  assert.equal(adapter.scene, null, "dispose releases the scene reference");
});

test("RealtimeBattle eases its commander-follow camera and snaps immediately under reduced motion", () => {
  const adapter = realtimeBattleHarness();

  adapter.updateCamera({ commander: { x: 19000, y: 6000 } });
  assert.equal(adapter.cameraFollowInit, true, "first update initializes the follow camera directly, without easing");
  const initialTargetX = adapter.cameraTarget.x;
  assert.ok(Math.abs(initialTargetX) > 0, "camera target tracks a non-origin commander position");

  adapter.updateCamera({ commander: { x: 22000, y: 6000 } });
  assert.notEqual(adapter.cameraTarget.x, initialTargetX, "a moved commander eases the camera target toward the new position");
  const easedDelta = Math.abs(adapter.cameraTarget.x - initialTargetX);
  assert.ok(easedDelta > 0 && easedDelta < 10, "normal-motion easing moves partially, not instantly, toward the target");

  adapter.reducedMotion = true;
  adapter.updateCamera({ commander: { x: 19000, y: 6000 } });
  assert.ok(
    Math.abs(adapter.cameraTarget.x - initialTargetX) < 1e-9,
    "reduced motion snaps the camera target directly back to the commander position",
  );

  // Fixed-elevation assertion superseded by the free-orbit camera
  // (camera-orbit-implementation-plan-20260725.md §5.2, decision-log.md
  // D22 판정 6/판정 11): "camera keeps a fixed elevation offset" is no
  // longer a true invariant once orbit()/zoom() exist. What must hold
  // instead is "the current orbit state (orbitYaw/orbitPitch/zoomFactor)
  // is reflected deterministically in camera.position via the spherical-
  // coordinate formula" -- verified here against the DEFAULT orbit state
  // (adapter.updateCamera() was never given an orbit()/zoom() call above,
  // so orbitYaw/orbitPitch/zoomFactor are still at their constructor
  // defaults) using an independently-computed expectation, not by calling
  // back into the implementation under test.
  assert.equal(adapter.orbitYaw, 0, "orbit state is untouched by updateCamera -- still the default yaw");
  const expectedPitch = 65 * (Math.PI / 180);
  assert.ok(Math.abs(adapter.orbitPitch - expectedPitch) < 1e-12, "orbit state is untouched by updateCamera -- still the default 65° pitch");
  const expectedZoom = Math.hypot(14.7, 14.7);
  assert.ok(Math.abs(adapter.zoomFactor - expectedZoom) < 1e-9, "orbit state is untouched by updateCamera -- still the default zoom distance");

  const expectedHorizontalRadius = expectedZoom * Math.cos(expectedPitch);
  const expectedHeight = expectedZoom * Math.sin(expectedPitch);
  const expectedX = adapter.cameraTarget.x + expectedHorizontalRadius * Math.sin(adapter.orbitYaw);
  const expectedZ = adapter.cameraTarget.z + expectedHorizontalRadius * Math.cos(adapter.orbitYaw);
  assert.ok(Math.abs(adapter.camera.position.y - expectedHeight) < 1e-9, "camera elevation is the default orbit state's zoomFactor*sin(orbitPitch), not a hardcoded constant");
  assert.ok(Math.abs(adapter.camera.position.x - expectedX) < 1e-9, "camera X position matches the default orbit state's spherical-coordinate formula");
  assert.ok(Math.abs(adapter.camera.position.z - expectedZ) < 1e-9, "camera Z position matches the default orbit state's spherical-coordinate formula");
});

// D23 Phase 1: actors turn to face the direction they travel. These assert
// the OBSERVABLE result (root.rotation.y) rather than the easing internals,
// so a future re-tuning of FACING_TURN_RATE stays green while an actor that
// silently stops turning fails.
function facingActor(adapter, id) {
  const record = adapter.actors.get(id);
  // ensureActor() defers the real GLB load, so the harness stands in a bare
  // Object3D root -- the facing code only ever touches root.rotation.y, so
  // this exercises the identical path a loaded model takes.
  record.root = new THREE.Object3D();
  adapter.actorGroup.add(record.root);
  return record;
}

test("RealtimeBattle turns an actor to face its direction of travel", () => {
  const adapter = realtimeBattleHarness();
  // ARENA-space coordinates (defense-run-simulation.js ARENA: 24000x12000),
  // matching what getRunSnapshot() actually emits.
  const at = (x, y) => ({ commander: { id: "commander", x, y } });

  adapter.reconcileActors(at(12000, 6000));
  const record = facingActor(adapter, "commander");
  // Seed lastX/lastZ so the next sync produces a real delta.
  adapter.reconcileActors(at(12000, 6000));

  // Travel +y in ARENA space, which worldPoint() maps to +z in world space.
  adapter.reconcileActors(at(12000, 9000));
  assert.equal(record.moving, true, "a large position delta must read as movement");
  assert.ok(record.targetYaw !== null, "movement must produce a facing target");
  // atan2(dx=0, dz=+) === 0: +z is the model's authored forward.
  assert.ok(Math.abs(record.targetYaw) < 1e-9, "travelling +z aims at yaw 0");
  assert.ok(Math.abs(record.root.rotation.y) < 1e-9, "first movement adopts the heading outright rather than easing from an unfaced default");

  // Travel +x, which must aim at +90 degrees.
  adapter.reconcileActors(at(18000, 9000));
  assert.ok(
    Math.abs(record.targetYaw - Math.PI / 2) < 1e-9,
    `travelling +x aims at +PI/2, got ${record.targetYaw}`,
  );

  // Easing is time-based: a generous step must converge on the target.
  adapter.updateActorFacing(record, 1.0);
  assert.ok(
    Math.abs(record.root.rotation.y - Math.PI / 2) < 1e-3,
    `a full second of easing must land on the target heading, got ${record.root.rotation.y}`,
  );
  assert.doesNotThrow(() => adapter.dispose());
});

test("RealtimeBattle holds an idle actor's facing steady and snaps it under reduced motion", () => {
  const adapter = realtimeBattleHarness();
  const at = (x, y) => ({ commander: { id: "commander", x, y } });

  adapter.reconcileActors(at(12000, 6000));
  const record = facingActor(adapter, "commander");
  adapter.reconcileActors(at(12000, 6000));
  adapter.reconcileActors(at(18000, 6000)); // travel +x -> yaw +PI/2
  const aimed = record.targetYaw;

  // Standing still must not re-aim: sub-epsilon jitter has no meaningful
  // direction, and re-aiming on it would make a stationary actor spin.
  adapter.reconcileActors(at(18000, 6000));
  assert.equal(record.moving, false, "no movement between identical positions");
  assert.equal(record.targetYaw, aimed, "an idle actor keeps its last heading instead of re-aiming on noise");

  // Reduced motion keeps the information (final heading) but drops the
  // animated sweep -- same treatment updateCamera() gives the follow-pan.
  const reduced = realtimeBattleHarness();
  reduced.reducedMotion = true;
  reduced.reconcileActors(at(12000, 6000));
  const rr = facingActor(reduced, "commander");
  reduced.reconcileActors(at(12000, 6000));
  reduced.reconcileActors(at(12000, 9000)); // yaw 0
  reduced.reconcileActors(at(18000, 9000)); // yaw +PI/2
  reduced.updateActorFacing(rr, 1 / 60);    // one frame only
  assert.ok(
    Math.abs(rr.root.rotation.y - Math.PI / 2) < 1e-9,
    "reduced motion applies the new heading within a single frame instead of easing",
  );
  assert.doesNotThrow(() => adapter.dispose());
  assert.doesNotThrow(() => reduced.dispose());
});

test("RealtimeBattle trails companions behind their simulation position but never the commander", () => {
  const adapter = realtimeBattleHarness();
  // The simulation hard-snaps companions to commander+offset every tick;
  // the renderer softens that. The commander itself must stay exact --
  // smoothing direct player input would read as input lag.
  const snapshot = (cx, cy, kx, ky) => ({
    commander: { id: "commander", x: cx, y: cy },
    companions: [{ id: "ally-1", x: kx, y: ky, status: "ACTIVE" }],
  });

  adapter.reconcileActors(snapshot(12000, 6000, 12000, 6000));
  const cmd = facingActor(adapter, "commander");
  const ally = facingActor(adapter, "ally-1");
  // Second pass seeds both records' rendered position at the start point.
  adapter.reconcileActors(snapshot(12000, 6000, 12000, 6000));
  const allyStartX = ally.root.position.x;

  // Both jump the same distance in one tick.
  adapter.reconcileActors(snapshot(18000, 6000, 18000, 6000));

  assert.ok(
    Math.abs(cmd.root.position.x - cmd.goalX) < 1e-9,
    "the commander renders exactly on its simulation position, never trailed",
  );
  assert.equal(
    ally.root.position.x, allyStartX,
    "a companion's rendered position does not teleport with the simulation on the same frame",
  );
  assert.ok(ally.goalX > allyStartX, "the companion's goal position did advance");

  // The trail converges: enough elapsed time must close the gap.
  adapter.updateActorFollow(ally, 1.0);
  assert.ok(
    Math.abs(ally.root.position.x - ally.goalX) < 1e-3,
    `the companion catches up to its simulation position, got ${ally.root.position.x} vs goal ${ally.goalX}`,
  );

  // Reduced motion removes the trail entirely.
  const reduced = realtimeBattleHarness();
  reduced.reducedMotion = true;
  reduced.reconcileActors(snapshot(12000, 6000, 12000, 6000));
  const rAlly = facingActor(reduced, "ally-1");
  reduced.reconcileActors(snapshot(12000, 6000, 12000, 6000));
  reduced.reconcileActors(snapshot(18000, 6000, 18000, 6000));
  assert.ok(
    Math.abs(rAlly.root.position.x - rAlly.goalX) < 1e-9,
    "reduced motion renders companions exactly on the simulation position",
  );
  assert.doesNotThrow(() => adapter.dispose());
  assert.doesNotThrow(() => reduced.dispose());
});

test("RealtimeBattle resolves a terrain model for every authored stage without touching the snapshot", () => {
  const adapter = realtimeBattleHarness();
  for (const stage of STAGES) {
    adapter.loadingStageId = null;
    adapter.loadedStageId = null;
    adapter.ensureStageTerrain(stage.id);
    assert.equal(adapter.loadingStageId, stage.id, `${stage.id} must resolve to a registered terrain model and begin loading it`);
  }
  assert.doesNotThrow(() => adapter.dispose());
});

test("defense renderer fallback adapter applies its bounded camera transform only after clearing the canvas", () => {
  const frame = Object.freeze({
    camera: Object.freeze({ x: 9000, y: -9000 }),
    viewport: { height: 360, width: 640 },
  });

  const canvas = cameraCanvas();
  const adapter = new BattleVisualizer().mount({ canvas, viewport: { height: canvas.height, width: canvas.width } });
  adapter.renderSnapshot(snapshot, frame);

  const cameraTransform = canvas.calls.find(([name]) => name === "translate");
  const clearIndex = canvas.calls.findIndex(([name]) => name === "clear");
  const backgroundIndex = canvas.calls.findIndex(([name]) => name === "rect");
  const transformIndex = canvas.calls.indexOf(cameraTransform);
  assert.deepEqual(
    cameraTransform,
    ["translate", canvas.width, -canvas.height],
    "BattleVisualizer bounds the shared presentation camera to the visible canvas",
  );
  assert.ok(clearIndex < transformIndex, "BattleVisualizer clears in screen space before the world camera");
  assert.ok(backgroundIndex < transformIndex, "BattleVisualizer paints the screen-space background before the world camera");
  adapter.dispose();
});

test("BattleVisualizer selects the approved Cinder Span artwork only in the camera-transformed world layer", async (t) => {
  replaceImage(t, loadedImage());
  const camera = { x: 24, y: -18 };

  const [, Fallback] = await freshAdapters();
  const canvas = cameraCanvas();
  const adapter = new Fallback().mount({ canvas, viewport: canvas });
  adapter.renderSnapshot(cinderSpanSnapshot(), { camera, viewport: canvas });

  const imageCalls = canvas.calls.filter(([name]) => name === "drawImage");
  assert.deepEqual(
    imageCalls.map(([, image]) => image.src),
    CINDER_SPAN_WORLD_ASSETS,
    "BattleVisualizer selects both approved Cinder Span images",
  );
  const cameraIndex = canvas.calls.findIndex(
    ([name, x, y]) => name === "translate" && x === camera.x && y === camera.y,
  );
  const firstImageIndex = canvas.calls.indexOf(imageCalls[0]);
  assert.ok(cameraIndex >= 0 && cameraIndex < firstImageIndex, "BattleVisualizer applies images inside the transient camera world layer");

  const beforeOtherStage = canvas.calls.length;
  adapter.renderSnapshot(
    { ...cinderSpanSnapshot(), presentation: { ...cinderSpanSnapshot().presentation, stageId: "gate-zenith" } },
    { camera, viewport: canvas },
  );
  assert.equal(
    canvas.calls.slice(beforeOtherStage).some(([name]) => name === "drawImage"),
    false,
    "BattleVisualizer does not select Cinder Span artwork for another stage",
  );
  adapter.dispose();
});

test("BattleVisualizer retains procedural Cinder Span terrain when world artwork is unavailable", async (t) => {
  replaceImage(t, unavailableImage());

  const [, Fallback] = await freshAdapters();
  const canvas = cameraCanvas();
  const adapter = new Fallback().mount({ canvas, viewport: canvas });
  assert.doesNotThrow(() => adapter.renderSnapshot(cinderSpanSnapshot(), { camera: { x: 16, y: -12 }, viewport: canvas }));
  assert.equal(canvas.calls.some(([name]) => name === "drawImage"), false, "BattleVisualizer does not paint an unavailable image");
  assert.ok(canvas.calls.some(([name]) => name === "rect"), "BattleVisualizer keeps its procedural terrain visible");
  adapter.dispose();
});

test("defense renderer modules contain no loop, input, campaign, or outcome ownership", async () => {
  for (const source of SOURCES) {
    const code = await readFile(new URL(`../${source}`, import.meta.url), "utf8");
    assert.doesNotMatch(code, /requestAnimationFrame/);
    assert.doesNotMatch(code, /addEventListener/);
    assert.doesNotMatch(code, /campaign-state/);
    assert.doesNotMatch(code, /\b(?:onBattleEnd|onOutcome|onVictory|onDefeat|resolveOutcome|emitOutcome)\b/);
  }
});
