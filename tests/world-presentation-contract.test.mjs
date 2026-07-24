import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "../vendor/three.module.js";
import { BattleVisualizer } from "../battle-visualizer.js";
import { RealtimeBattle } from "../battle-realtime-three.js";
import { ARENA, STAGES, STAGE_PRESENTATION_BY_ID } from "../defense-catalog.js";
import { advanceDefenseRun, createDefenseRun, getRunDigest, getRunSnapshot } from "../defense-run-simulation.js";

// RealtimeBattle (primary, real WebGL/Three.js) can't mount against the
// Canvas2D-shaped mocks below -- THREE.WebGLRenderer requires a real
// GL-capable canvas, unavailable under plain `node --test` (see
// defense-renderer-contract.test.mjs for that specific contract). Where a
// test needs RealtimeBattle's actual reconciliation behavior, this harness
// wires it directly to real THREE.Scene/Camera/Group instances -- the same
// objects mount() itself creates -- bypassing only WebGLRenderer.
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

function noop() {}

function fakeNode() {
  return {
    classList: { add: noop, remove: noop },
    dataset: {},
    style: { setProperty: noop },
    addEventListener: noop,
    removeEventListener: noop,
    append: noop,
    focus: noop,
    remove: noop,
    querySelector: () => fakeNode(),
    querySelectorAll: () => [],
    setAttribute: noop,
  };
}

let battleSessionPromise;

async function loadBattleSession() {
  if (battleSessionPromise) return battleSessionPromise;
  const root = fakeNode();
  const documentElement = fakeNode();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener: noop,
      documentElement,
      body: fakeNode(),
      get hidden() { return false; },
      querySelector: () => root,
      removeEventListener: noop,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: noop,
      dispatchEvent: noop,
      innerHeight: 720,
      innerWidth: 1280,
      matchMedia: () => ({ addEventListener: noop, matches: false, removeEventListener: noop }),
      removeEventListener: noop,
    },
  });
  globalThis.CustomEvent ??= class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = noop;
  battleSessionPromise = import("../app.js").then(({ BattleSession }) => BattleSession);
  return battleSessionPromise;
}
function mockCanvas() {
  const calls = [];
  const gradient = { addColorStop(...args) { calls.push(["gradient-stop", ...args]); } };
  const context = new Proxy({}, {
    get(_target, name) {
      if (name === "createLinearGradient" || name === "createRadialGradient") return () => gradient;
      return (...args) => calls.push([String(name), ...args]);
    },
    set(_target, name, value) {
      calls.push([String(name), value]);
      return true;
    },
  });
  return { calls, getContext: () => context, height: 360, width: 640 };
}
function artworkImage(available) {
  return class ArtworkImage {
    constructor() {
      this.complete = false;
      this.naturalWidth = 0;
    }

    set src(value) {
      if (!available) throw new Error(`unavailable artwork: ${value}`);
      this._src = value;
      this.complete = true;
      this.naturalWidth = 1;
    }

    get src() {
      return this._src;
    }
  };
}

function worldTextCanvas() {
  const calls = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    save() {
      stack.push([...matrix]);
      calls.push(["save"]);
    },
    restore() {
      matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      calls.push(["restore"]);
    },
    translate(x, y) {
      matrix[4] += matrix[0] * x + matrix[2] * y;
      matrix[5] += matrix[1] * x + matrix[3] * y;
      calls.push(["translate", x, y]);
    },
    rotate(angle) {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      matrix = [
        matrix[0] * cosine + matrix[2] * sine,
        matrix[1] * cosine + matrix[3] * sine,
        matrix[2] * cosine - matrix[0] * sine,
        matrix[3] * cosine - matrix[1] * sine,
        matrix[4],
        matrix[5],
      ];
      calls.push(["rotate", angle]);
    },
    fillText(label, x, y) {
      calls.push(["fillText", label, x, y, [...matrix]]);
    },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
  }, {
    get(target, name) {
      if (name in target) return target[name];
      return () => {};
    },
  });
  return { calls, getContext: () => context, height: 360, width: 640 };
}

function worldPresentationSnapshot() {
  return {
    tick: 0,
    presentation: {
      stageId: "world-text-contract",
      stagePresentation: {
        atmosphere: { motif: "ATMOSPHERE" },
        landmarks: [{ id: "landmark", label: "LANDMARK" }],
        mapLabels: {
          chokepath: "CHOKE",
          elevation: "ELEVATION",
          extraction: "EXTRACTION",
          flank: "FLANK",
          hazard: "HAZARD",
          occupation: "OCCUPATION",
        },
        palette: { contour: "contour", hazard: "hazard", objective: "objective", surface: "surface" },
        terrain: { patternId: "terrain" },
      },
      terrain: {
        tactics: {
          chokepath: { id: "choke", x: 0, y: 0, halfWidth: 0.1 },
          elevation: { id: "elevation", x: 0.35, y: -0.2 },
          extraction: { id: "extraction", x: -0.3, y: 0.45 },
          flank: { id: "flank", x: -0.45, y: -0.4 },
          hazard: { id: "hazard", radius: 0.1, x: -0.2, y: 0.2 },
          occupation: { id: "occupation", radius: 0.1, x: 0.3, y: 0.3 },
        },
      },
    },
  };
}

function renderedWorldText(canvas) {
  return canvas.calls
    .filter(([name]) => name === "fillText")
    .map(([, label, x, y, matrix]) => ({ label, matrix, x, y }));
}

function actorSnapshot() {
  return {
    stageId: "cinder-span",
    tick: 10,
    gate: { id: "gate", x: 30000, y: 9000, radius: 30 },
    commander: { id: "commander", x: 19000, y: 9000, radius: 11 },
    enemies: [
      { id: "common", x: 10000, y: 4000, radius: 8 },
      { id: "elite", x: 12000, y: 4500, radius: 14, elite: true },
      { id: "boss", x: 16000, y: 5000, radius: 25, class: "boss" },
    ],
    projectiles: [{ id: "projectile", x: 18000, y: 6000, radius: 3, kind: "projectile" }],
    pickups: [{ id: "pickup", x: 20000, y: 7000, radius: 5, kind: "pickup" }],
    companions: [{ id: "companion", x: 21000, y: 8000, radius: 9, kind: "companion" }],
    events: [],
  };
}

test("every authored stage exposes one frozen world-presentation profile", () => {
  assert.equal(STAGES.length, 10);
  assert.deepEqual(Object.keys(STAGE_PRESENTATION_BY_ID).sort(), STAGES.map(({ id }) => id).sort());
  assert.ok(Object.isFrozen(STAGE_PRESENTATION_BY_ID));
  for (const stage of STAGES) {
    const profile = STAGE_PRESENTATION_BY_ID[stage.id];
    assert.ok(Object.isFrozen(profile), `${stage.id} profile must be immutable`);
    assert.equal(typeof profile.terrain.patternId, "string", `${stage.id} has terrain identity`);
    assert.equal(typeof profile.terrain.label, "string", `${stage.id} has terrain label`);
    assert.equal(profile.landmarks.length >= 2, true, `${stage.id} has authored landmarks`);
    for (const key of ["title", "domain", "chokepath", "flank", "elevation", "hazard", "occupation", "extraction", "objective"]) {
      assert.equal(typeof profile.mapLabels[key], "string", `${stage.id} maps ${key} to catalog-backed copy`);
      assert.notEqual(profile.mapLabels[key].trim(), "", `${stage.id} maps ${key} to non-empty catalog-backed copy`);
    }
  }
});

test("BattleSession projects exactly the allowed 2.5x actor categories and leaves canonical data unchanged", async (t) => {
  const originalRatio = globalThis.devicePixelRatio;
  Object.defineProperty(globalThis, "devicePixelRatio", { configurable: true, value: 1 });
  t.after(() => {
    if (originalRatio === undefined) delete globalThis.devicePixelRatio;
    else Object.defineProperty(globalThis, "devicePixelRatio", { configurable: true, value: originalRatio });
  });
  const BattleSession = await loadBattleSession();
  const source = actorSnapshot();
  const before = structuredClone(source);
  const session = Object.create(BattleSession.prototype);
  session.stageId = source.stageId;
  const projection = session.projected(source);

  assert.deepEqual(source, before, "projection must not mutate canonical snapshot data");
  assert.deepEqual(
    [projection.commander.radius, ...projection.enemies.map(({ radius }) => radius)],
    [27.5, 20, 35, 62.5],
    "commander, common, elite, and boss silhouettes must scale by exactly 2.5x before DPR",
  );
  assert.deepEqual(
    [projection.gate.radius, projection.companions[0].radius, projection.projectiles[0].radius, projection.pickups[0].radius],
    [30, 9, 3, 5],
    "Gate, companion, projectile, and pickup presentation radii must remain 1.0x",
  );
  assert.deepEqual(
    [projection.commander, ...projection.enemies].flatMap(({ x, y }) => [x, y]),
    [source.commander, ...source.enemies].flatMap(({ x, y }) => [x / ARENA.width * 2 - 1, y / ARENA.height * 2 - 1]),
    "projection must preserve the canonical normalized-coordinate mapping",
  );
  assert.equal(projection.presentation.stagePresentation, STAGE_PRESENTATION_BY_ID[source.stageId]);
  assert.equal(projection.presentation.terrain.patternId, STAGE_PRESENTATION_BY_ID[source.stageId].terrain.patternId);
});

test("primary and fallback adapters observe the same presentation projection without changing deterministic outcome", async () => {
  const BattleSession = await loadBattleSession();
  const run = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 71 }), 30);
  const digest = getRunDigest(run);
  const snapshot = getRunSnapshot(run);
  const canonical = structuredClone(snapshot);
  const session = Object.create(BattleSession.prototype);
  session.stageId = snapshot.stageId;
  const projection = session.projected(snapshot);
  const projectedBeforeRender = structuredClone(projection);
  const alternateSnapshot = { ...snapshot, stageId: "gate-zenith" };
  const alternateSession = Object.create(BattleSession.prototype);
  alternateSession.stageId = alternateSnapshot.stageId;
  const alternateProjection = alternateSession.projected(alternateSnapshot);
  assert.notEqual(
    alternateProjection.presentation.stagePresentation,
    projection.presentation.stagePresentation,
    "different authored stages must resolve distinct renderer presentation profiles",
  );

  {
    const canvas = mockCanvas();
    const alternateCanvas = mockCanvas();
    const adapter = new BattleVisualizer();
    const alternateAdapter = new BattleVisualizer();
    adapter.mount({ canvas, viewport: { width: canvas.width, height: canvas.height } });
    alternateAdapter.mount({ canvas: alternateCanvas, viewport: { width: alternateCanvas.width, height: alternateCanvas.height } });
    assert.doesNotThrow(() => adapter.renderSnapshot(projection, { viewport: canvas }));
    assert.doesNotThrow(() => alternateAdapter.renderSnapshot(alternateProjection, { viewport: alternateCanvas }));
    assert.ok(canvas.calls.length > 0, "BattleVisualizer must render the supplied presentation projection");
    assert.notDeepEqual(
      alternateCanvas.calls,
      canvas.calls,
      "BattleVisualizer must render distinct data-driven terrain/objective overlays for distinct stage projections",
    );
    adapter.dispose();
    alternateAdapter.dispose();
  }

  {
    // RealtimeBattle's equivalent of "distinct data-driven terrain per
    // stage projection" is resolving a distinct terrain GLB per stageId
    // (cinder-span vs gate-zenith), and reconciling the projected actors
    // into its real scene graph without throwing or mutating input.
    const adapter = realtimeBattleHarness();
    const alternateAdapter = realtimeBattleHarness();
    assert.doesNotThrow(() => adapter.reconcileActors(projection));
    assert.doesNotThrow(() => adapter.ensureStageTerrain(projection.presentation.stageId));
    assert.doesNotThrow(() => alternateAdapter.reconcileActors(alternateProjection));
    assert.doesNotThrow(() => alternateAdapter.ensureStageTerrain(alternateProjection.presentation.stageId));
    assert.ok(adapter.actors.size > 0, "RealtimeBattle must reconcile the supplied presentation projection into tracked actors");
    assert.notEqual(
      adapter.loadingStageId,
      alternateAdapter.loadingStageId,
      "RealtimeBattle must resolve distinct terrain models for distinct stage projections",
    );
    adapter.dispose();
    alternateAdapter.dispose();
  }

  assert.deepEqual(snapshot, canonical, "adapter observation must not mutate the canonical snapshot");
  assert.deepEqual(projection, projectedBeforeRender, "adapter observation must not mutate the presentation projection");
  assert.equal(getRunDigest(run), digest, "presentation observers must not alter deterministic outcome state");
  assert.deepEqual(getRunSnapshot(run), canonical, "presentation observers must leave the run snapshot byte-for-byte equivalent");
});

test("Cinder Span artwork availability remains passive to canonical simulation state", async (t) => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  t.after(() => {
    if (originalImage) Object.defineProperty(globalThis, "Image", originalImage);
    else delete globalThis.Image;
  });

  const BattleSession = await loadBattleSession();
  const run = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 211 }), 30);
  const digest = getRunDigest(run);
  const snapshot = getRunSnapshot(run);
  const canonical = structuredClone(snapshot);
  const session = Object.create(BattleSession.prototype);
  session.stageId = snapshot.stageId;
  const projection = session.projected(snapshot);
  const projectionBeforeRender = structuredClone(projection);

  for (const available of [false, true]) {
    Object.defineProperty(globalThis, "Image", { configurable: true, value: artworkImage(available) });
    const canvas = mockCanvas();
    const adapter = new BattleVisualizer().mount({ canvas, viewport: canvas });
    assert.doesNotThrow(
      () => adapter.renderSnapshot(projection, { camera: { x: 24, y: -18 }, viewport: canvas }),
      `BattleVisualizer accepts ${available ? "available" : "unavailable"} passive artwork`,
    );
    adapter.dispose();

    // RealtimeBattle doesn't use the Image global at all (terrain loads
    // through GLTFLoader/fetch); its passivity contract is that stage
    // terrain resolution never mutates the projection or canonical
    // snapshot it was derived from, regardless of artwork availability.
    const realtimeAdapter = realtimeBattleHarness();
    assert.doesNotThrow(
      () => realtimeAdapter.ensureStageTerrain(projection.presentation.stageId),
      `RealtimeBattle accepts stage terrain resolution regardless of artwork availability=${available}`,
    );
    realtimeAdapter.dispose();

    assert.deepEqual(projection, projectionBeforeRender, `artwork availability=${available} does not mutate projection data`);
    assert.deepEqual(snapshot, canonical, `artwork availability=${available} does not mutate the canonical snapshot`);
    assert.equal(getRunDigest(run), digest, `artwork availability=${available} does not alter the deterministic run digest`);
  }
});
test("commander-follow camera is bounded transient frame state and snaps or resets without touching simulation state", async () => {
  const BattleSession = await loadBattleSession();
  const run = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 97 }), 30);
  const digest = getRunDigest(run);
  const snapshot = getRunSnapshot(run);
  const canonical = structuredClone(snapshot);
  const session = Object.create(BattleSession.prototype);
  session.stageId = snapshot.stageId;
  session.canvas = { height: 360, width: 640 };
  session.camera = { x: 0, y: 0 };
  session.motionQuery = { matches: false };
  const projection = session.projected(snapshot);
  const projectionBeforeCamera = structuredClone(projection);

  const eased = session.updateCamera(projection.commander);
  assert.ok(Math.abs(eased.x) <= session.canvas.width * 0.18, "normal-motion camera x remains inside its follow bound");
  assert.ok(Math.abs(eased.y) <= session.canvas.height * 0.14, "normal-motion camera y remains inside its follow bound");

  session.motionQuery.matches = true;
  const snapped = session.updateCamera({ x: 1, y: -1 });
  assert.equal(snapped.x, -session.canvas.width * 0.18, "reduced motion snaps directly to the bounded horizontal target");
  assert.equal(snapped.y, session.canvas.height * 0.14, "reduced motion snaps directly to the bounded vertical target");
  session.resetCamera();
  assert.deepEqual(session.camera, { x: 0, y: 0 }, "lifecycle resets clear the transient camera frame");

  assert.deepEqual(projection, projectionBeforeCamera, "camera derivation must not be added to the presentation projection");
  assert.deepEqual(snapshot, canonical, "camera derivation must not mutate the canonical snapshot");
  assert.equal(getRunDigest(run), digest, "camera derivation must not alter the deterministic run digest");
  assert.deepEqual(getRunSnapshot(run), canonical, "camera derivation must leave the canonical simulation snapshot unchanged");
});


// RealtimeBattle's battle canvas never draws map-label text -- that
// context (atmosphere/landmarks/mapLabels) lives in the DOM/CSS atlas
// panel in the live app (app.js's "stage-atlas" section), verified by
// world-presentation-browser.cjs's real-browser atlasSnapshot() checks.
// The canvas-glyph portrait counter-rotation contract below is specific
// to BattleVisualizer's Canvas2D text rendering.
test("BattleVisualizer retains label anchors while counter-rotating every canvas glyph only in portrait", () => {
  const expectedLabels = ["ATMOSPHERE", "CHOKE", "ELEVATION", "EXTRACTION", "FLANK", "HAZARD", "LANDMARK", "OCCUPATION"].sort();

  const landscapeCanvas = worldTextCanvas();
  const portraitCanvas = worldTextCanvas();
  const landscapeAdapter = new BattleVisualizer().mount({ canvas: landscapeCanvas, viewport: landscapeCanvas });
  const portraitAdapter = new BattleVisualizer().mount({ canvas: portraitCanvas, viewport: portraitCanvas });

  landscapeAdapter.renderSnapshot(worldPresentationSnapshot(), { portrait: false, viewport: landscapeCanvas });
  portraitAdapter.renderSnapshot(worldPresentationSnapshot(), { portrait: true, viewport: portraitCanvas });

  const landscapeText = renderedWorldText(landscapeCanvas);
  const portraitText = renderedWorldText(portraitCanvas);
  assert.deepEqual(landscapeText.map(({ label }) => label).sort(), expectedLabels, "renders every world label and caption in landscape");
  assert.deepEqual(portraitText.map(({ label }) => label).sort(), expectedLabels, "renders every world label and caption in portrait");

  const landscapeByLabel = new Map(landscapeText.map((entry) => [entry.label, entry]));
  const portraitByLabel = new Map(portraitText.map((entry) => [entry.label, entry]));
  for (const label of expectedLabels) {
    const landscape = landscapeByLabel.get(label);
    const portrait = portraitByLabel.get(label);
    assert.deepEqual(
      landscape.matrix.map((value) => Math.round(value * 1e12) / 1e12),
      [1, 0, 0, 1, 0, 0],
      `leaves ${label} as a direct, unrotated landscape fillText`,
    );
    assert.notDeepEqual([landscape.x, landscape.y], [0, 0], `retains ${label}'s direct landscape anchor`);
    assert.deepEqual(
      [portrait.x, portrait.y],
      [0, 0],
      `renders ${label} at the local portrait glyph origin`,
    );
    assert.deepEqual(
      portrait.matrix.map((value) => Math.round(value * 1e12) / 1e12),
      [0, -1, 1, 0, landscape.x, landscape.y],
      `applies the local -π/2 glyph transform at ${label}'s unchanged anchor`,
    );
  }

  landscapeAdapter.dispose();
  portraitAdapter.dispose();
});
test("BattleVisualizer keeps portrait label counterrotation on the logical plane under the shared camera frame", () => {
  const expectedLabels = ["ATMOSPHERE", "CHOKE", "ELEVATION", "EXTRACTION", "FLANK", "HAZARD", "LANDMARK", "OCCUPATION"].sort();
  const camera = { x: 24, y: -18 };

  const landscapeCanvas = worldTextCanvas();
  const portraitCanvas = worldTextCanvas();
  const landscapeAdapter = new BattleVisualizer().mount({ canvas: landscapeCanvas, viewport: landscapeCanvas });
  const portraitAdapter = new BattleVisualizer().mount({ canvas: portraitCanvas, viewport: portraitCanvas });

  landscapeAdapter.renderSnapshot(worldPresentationSnapshot(), { portrait: false, viewport: landscapeCanvas });
  portraitAdapter.renderSnapshot(worldPresentationSnapshot(), { camera, portrait: true, viewport: portraitCanvas });

  const landscapeByLabel = new Map(renderedWorldText(landscapeCanvas).map((entry) => [entry.label, entry]));
  const portraitByLabel = new Map(renderedWorldText(portraitCanvas).map((entry) => [entry.label, entry]));
  assert.deepEqual(
    [...portraitByLabel.keys()].sort(),
    expectedLabels,
    "retains every portrait world label under the camera frame",
  );
  assert.deepEqual(
    portraitCanvas.calls.find(([name]) => name === "translate"),
    ["translate", camera.x, camera.y],
    "applies the shared camera in the world plane before portrait labels",
  );
  for (const label of expectedLabels) {
    const landscape = landscapeByLabel.get(label);
    const portrait = portraitByLabel.get(label);
    assert.deepEqual([portrait.x, portrait.y], [0, 0], `retains ${label}'s local portrait glyph origin`);
    assert.deepEqual(
      portrait.matrix.map((value) => Math.round(value * 1e12) / 1e12),
      [0, -1, 1, 0, landscape.x + camera.x, landscape.y + camera.y],
      `counter-rotates ${label} at its camera-shifted logical anchor`,
    );
  }

  landscapeAdapter.dispose();
  portraitAdapter.dispose();
});

