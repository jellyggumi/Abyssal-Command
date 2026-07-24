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
// real, unmodified implementation against this scene graph.
function realtimeBattleHarness() {
  const adapter = new RealtimeBattle();
  adapter.disposed = false;
  adapter.scene = new THREE.Scene();
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

  assert.equal(adapter.camera.position.y, 8.4, "camera keeps its fixed elevation offset above the follow target");
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
