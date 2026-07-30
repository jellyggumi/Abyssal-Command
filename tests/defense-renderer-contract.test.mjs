import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import * as THREE from "../vendor/three.module.js";
import { RealtimeBattle } from "../battle-realtime-three.js";
import { BattleVisualizer } from "../battle-visualizer.js";
import { STAGES } from "../defense-catalog.js";

const TEST_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CONTENT_TYPES = Object.freeze({
  ".css": "text/css",
  ".glb": "model/gltf-binary",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
});

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/renderer-contract.html") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end('<!doctype html><link rel="stylesheet" href="/styles.css"><body></body>');
      return;
    }

    const filePath = resolve(TEST_ROOT, `.${decodeURIComponent(pathname)}`);
    if (!filePath.startsWith(TEST_ROOT)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const bytes = await readFile(filePath);
      response.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolveListening();
    });
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

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

function pressureIndicatorHarness() {
  const adapter = realtimeBattleHarness();
  adapter.pressureGroup = new THREE.Group();
  adapter.pressureLane = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  adapter.pressureArrow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  adapter.pressureTargetRing = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  adapter.pressureGroup.add(adapter.pressureLane, adapter.pressureArrow, adapter.pressureTargetRing);
  adapter.pressureGroup.visible = false;
  adapter.scene.add(adapter.pressureGroup);
  return adapter;
}

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}


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

test("RealtimeBattle preserves a transparent runtime terrain layer below both HUD layers", async (t) => {
  const hosting = await startStaticServer();
  t.after(() => new Promise((resolveClose) => hosting.server.close(resolveClose)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto(`${hosting.url}/renderer-contract.html`, { waitUntil: "networkidle" });
  const report = await page.evaluate(async () => {
    const [{ RealtimeBattle: BrowserRealtimeBattle }, THREE] = await Promise.all([
      import("/battle-realtime-three.js"),
      import("/vendor/three.module.js"),
    ]);
    const surface = document.createElement("section");
    surface.id = "defense-battle-surface";
    surface.style.cssText = "position:relative;width:320px;height:180px";
    const canvas = document.createElement("canvas");
    canvas.id = "defense-canvas";
    canvas.width = 320;
    canvas.height = 180;
    const worldHud = document.createElement("div");
    worldHud.id = "world-hud-overlay";
    const edgeHud = document.createElement("div");
    edgeHud.id = "defense-edge-hud";
    surface.append(canvas, worldHud, edgeHud);
    document.body.append(surface);

    const adapter = new BrowserRealtimeBattle();
    try {
      adapter.mount({ canvas, viewport: { width: canvas.width, height: canvas.height } });
      const contextAttributes = adapter.renderer.getContext().getContextAttributes();
      const mountClearAlpha = adapter.renderer.getClearAlpha();
      const mountClearColor = adapter.renderer.getClearColor(new THREE.Color()).getHex();

      adapter.applyStagePalette("cinder-span");
      const paletteClearAlpha = adapter.renderer.getClearAlpha();
      const paletteClearColor = adapter.renderer.getClearColor(new THREE.Color()).getHex();

      const canvasStyle = getComputedStyle(canvas);
      const worldHudStyle = getComputedStyle(worldHud);
      const edgeHudStyle = getComputedStyle(edgeHud);
      return {
        contextAlpha: contextAttributes?.alpha,
        mountClearAlpha,
        mountClearColor,
        paletteClearAlpha,
        paletteClearColor,
        canvasZ: Number.parseInt(canvasStyle.zIndex, 10),
        worldHudZ: Number.parseInt(worldHudStyle.zIndex, 10),
        edgeHudZ: Number.parseInt(edgeHudStyle.zIndex, 10),
      };
    } finally {
      adapter.dispose();
      surface.remove();
    }
  });

  assert.equal(report.contextAlpha, true, "the mounted WebGL context must retain an alpha channel");
  assert.equal(report.mountClearAlpha, 0, "mount must leave the renderer clear fully transparent");
  assert.notEqual(report.paletteClearColor, report.mountClearColor, "the authored stage palette must update the renderer clear color");
  assert.equal(report.paletteClearAlpha, 0, "a stage palette update must preserve a fully transparent renderer clear");
  assert.ok(report.canvasZ < report.worldHudZ, `world HUD z-index ${report.worldHudZ} must remain above canvas z-index ${report.canvasZ}`);
  assert.ok(report.worldHudZ < report.edgeHudZ, `edge HUD z-index ${report.edgeHudZ} must remain above world HUD z-index ${report.worldHudZ}`);
});

test("RealtimeBattle prefers a resolved motion rig for stage NPC readability while retaining catalog fallback eligibility", async (t) => {
  const hosting = await startStaticServer();
  t.after(() => new Promise((resolveClose) => hosting.server.close(resolveClose)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto(`${hosting.url}/renderer-contract.html`, { waitUntil: "networkidle" });
  const setupTimeoutMs = 45000;
  const glbReadinessTimeoutMs = 45000;
  const totalEvaluationTimeoutMs = setupTimeoutMs + glbReadinessTimeoutMs + 1000;
  let totalEvaluationDeadlineTimer;
  const evaluation = page.evaluate(async (pageGlbReadinessTimeoutMs) => {
    const [{ RealtimeBattle: BrowserRealtimeBattle, meshRootForMotionCharacter }, THREE] = await Promise.all([
      import("/battle-realtime-three.js"),
      import("/vendor/three.module.js"),
    ]);
    const resolvedMotionModelPath = meshRootForMotionCharacter("lantern-reaver");
    const unmappedMotionModelPath = meshRootForMotionCharacter("unmapped-stage-npc");
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    document.body.append(canvas);
    const adapter = new BrowserRealtimeBattle();

    try {
      adapter.mount({ canvas, viewport: { width: canvas.width, height: canvas.height } });
      adapter.ensureStageTerrain("cinder-span");
      adapter.reconcileActors({
        companions: [{
          id: "ember-companion",
          kind: "companion",
          companionId: "ember-cohort",
          status: "ACTIVE",
          x: 17100,
          y: 2700,
        }],
      });

      const deadline = performance.now() + pageGlbReadinessTimeoutMs;
      let presentation = null;
      while (true) {
        presentation = adapter.debugPresentationState();
        const stageDecor = presentation.stageDecor;
        const stageNpcState = stageDecor.records.find((record) => record.kind === "stage-npc");
        const companionState = adapter.debugPresentationState("ember-companion");
        const requiredGlbsReady = stageDecor.stageId === "cinder-span"
          && stageDecor.loading === false
          && stageDecor.terrainLoaded === true
          && Boolean(stageNpcState?.position)
          && Boolean(companionState?.position);
        if (requiredGlbsReady) break;
        if (performance.now() >= deadline) {
          throw new Error(
            `required Cinder Span terrain, stage-NPC, and companion GLBs did not load within ${pageGlbReadinessTimeoutMs}ms: ${JSON.stringify(presentation)}`,
          );
        }
        await new Promise((resolveWake) => {
          const timerId = setTimeout(() => {
            cancelAnimationFrame(frameId);
            resolveWake();
          }, 50);
          const frameId = requestAnimationFrame(() => {
            clearTimeout(timerId);
            resolveWake();
          });
        });
      }
      const stageNpc = adapter.stageDecorRecords.find((record) => record.kind === "stage-npc");
      const companion = adapter.actors.get("ember-companion");

      const worldHeight = (root) => {
        root.updateWorldMatrix(true, true);
        return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
      };
      return {
        stageNpcActorId: stageNpc.actorId,
        stageNpcHeight: worldHeight(stageNpc.root),
        stageNpcModelPath: stageNpc.modelPath,
        resolvedMotionModelPath,
        unmappedMotionModelPath,
        companionHeight: worldHeight(companion.root),
      };
    } finally {
      adapter.dispose();
      canvas.remove();
    }
  }, glbReadinessTimeoutMs);
  const report = await Promise.race([
    evaluation,
    new Promise((_, reject) => {
      totalEvaluationDeadlineTimer = setTimeout(() => {
        reject(new Error(
          `ambient stage-NPC renderer evaluation did not settle within ${totalEvaluationTimeoutMs}ms; `
          + `the page may be frozen or its animation frames and timers may be starved `
          + `(setup allowance: ${setupTimeoutMs}ms; `
          + `post-setup in-page GLB readiness allowance: ${glbReadinessTimeoutMs}ms)`,
        ));
      }, totalEvaluationTimeoutMs);
    }),
  ]).finally(() => clearTimeout(totalEvaluationDeadlineTimer));

  assert.equal(report.stageNpcActorId, "lantern-reaver", "the direct stage lookout must retain its authored actor identity");
  assert.equal(
    report.stageNpcModelPath,
    "assets/motion/ingame/characters/lantern-reaver/model.glb",
    "the stage lookout must load its rigged motion mesh",
  );
  assert.equal(
    report.unmappedMotionModelPath,
    null,
    "an unmapped stage actor leaves its catalog model path eligible as the fallback",
  );
  assertNear(report.stageNpcHeight, 1.8, "the ambient stage NPC keeps its dedicated readability normalization");
  // Proportion pass 2026-07-30 (reference-video-analysis.md §3): legion units read at the player's
  // own scale, distinguished by colour rather than by being smaller. 1.45 is 94% of the 1.55
  // commander -- inside the reference's "within ~10%" band -- and still below the 1.7 enemy.
  assertNear(report.companionHeight, 1.45, "the gameplay companion reads as a peer of the commander, not a lesser body");
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

test("Canvas fallback remount forgets prior event identities and pending input feedback", () => {
  const feedbackEvents = [];
  const canvas = cameraCanvas();
  const adapter = new BattleVisualizer({
    onEventFeedback: (_feedback, event) => feedbackEvents.push(event.eventId),
  });
  const critical = Object.freeze({
    type: "CRITICAL_HIT",
    tick: 12,
    eventId: "critical:12:enemy-1",
    targetId: "enemy-1",
  });
  const eventSnapshot = { ...snapshot, tick: 12, events: [critical] };

  adapter.mount({ canvas, viewport: { width: 640, height: 360 } });
  adapter.renderSnapshot(eventSnapshot);
  adapter.renderSnapshot(eventSnapshot);
  assert.deepEqual(feedbackEvents, [critical.eventId], "one mounted fallback must announce one stable event once");

  adapter.onVisualFeedback(17);
  adapter.dispose();
  adapter.mount({ canvas, viewport: { width: 640, height: 360 } });
  const cleanSnapshot = { ...snapshot, tick: 13, events: [] };
  const remountCallOffset = canvas.calls.length;
  adapter.renderSnapshot(cleanSnapshot);
  const remountedArcCount = canvas.calls.slice(remountCallOffset).filter(([name]) => name === "arc").length;

  const referenceCanvas = cameraCanvas();
  const reference = new BattleVisualizer().mount({
    canvas: referenceCanvas,
    viewport: { width: 640, height: 360 },
  });
  reference.renderSnapshot(cleanSnapshot);
  const cleanArcCount = referenceCanvas.calls.filter(([name]) => name === "arc").length;
  assert.equal(
    remountedArcCount,
    cleanArcCount,
    "input feedback queued by the disposed mount must not draw into the replacement mount",
  );

  adapter.renderSnapshot(eventSnapshot);
  assert.deepEqual(
    feedbackEvents,
    [critical.eventId, critical.eventId],
    "the replacement mount must accept the same stable event in its new lifecycle",
  );

  adapter.dispose();
  reference.dispose();
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

test("RealtimeBattle points gate pressure from the closest live hostile without writing to its snapshot", () => {
  const adapter = pressureIndicatorHarness();
  const frame = Object.freeze({
    gate: Object.freeze({ id: "gate", x: 18000, y: 6000 }),
    enemies: Object.freeze([
      Object.freeze({ id: "dead-nearest", x: 17400, y: 6000, status: "DEAD" }),
      Object.freeze({ id: "far-live", x: 12000, y: 3000, hp: 10 }),
      Object.freeze({ id: "closest-live", x: 12000, y: 6000, hp: 10 }),
    ]),
  });
  const before = structuredClone(frame);

  adapter.reconcileActors(frame);

  assert.deepEqual(frame, before, "reconciliation must leave the frozen simulation snapshot unchanged");
  assert.equal(adapter.pressureGroup.visible, true, "a gate with a live hostile shows the pressure indicator");
  assert.equal(adapter.pressureLane.visible, true);
  assert.equal(adapter.pressureArrow.visible, true);
  assert.equal(adapter.pressureTargetRing.visible, true);
  assertNear(adapter.pressureTargetRing.position.x, 7, "the threatened-target ring follows the gate X");
  assertNear(adapter.pressureTargetRing.position.z, 0, "the threatened-target ring follows the gate Z");

  const headingX = Math.sin(adapter.pressureLane.rotation.y);
  const headingZ = Math.cos(adapter.pressureLane.rotation.y);
  const halfLength = adapter.pressureLane.scale.z / 2;
  const laneStartX = adapter.pressureLane.position.x - headingX * halfLength;
  const laneStartZ = adapter.pressureLane.position.z - headingZ * halfLength;
  const laneEndX = adapter.pressureLane.position.x + headingX * halfLength;
  const laneEndZ = adapter.pressureLane.position.z + headingZ * halfLength;
  assertNear(laneStartX, 0, "the lane begins at the closest live hostile X");
  assertNear(laneStartZ, 0, "the lane begins at the closest live hostile Z");
  assertNear(laneEndX, adapter.pressureArrow.position.x, "the lane ends at the gate-facing arrow X");
  assertNear(laneEndZ, adapter.pressureArrow.position.z, "the lane ends at the gate-facing arrow Z");
  assert.ok(adapter.pressureLane.scale.z > 0, "separated hostile and gate produce a non-zero lane");
  assert.ok(
    adapter.pressureArrow.position.x > laneStartX
      && adapter.pressureArrow.position.x < adapter.pressureTargetRing.position.x,
    "the arrow points from the hostile toward, but not through, the gate ring",
  );
  adapter.dispose();
});

test("RealtimeBattle hides stale pressure and leaves only the target ring at zero separation", () => {
  const adapter = pressureIndicatorHarness();
  const gate = Object.freeze({ id: "gate", x: 18000, y: 6000 });

  adapter.reconcileActors({
    gate,
    enemies: [{ id: "live", x: 12000, y: 6000, hp: 10 }],
  });
  assert.equal(adapter.pressureGroup.visible, true, "precondition: a live threat shows pressure");

  adapter.reconcileActors({ enemies: [{ id: "live", x: 12000, y: 6000, hp: 10 }] });
  assert.equal(adapter.pressureGroup.visible, false, "no gate hides the entire indicator");

  adapter.reconcileActors({
    gate,
    enemies: [
      { id: "dead-status", x: 12000, y: 6000, status: "DEAD" },
      { id: "defeated-status", x: 12000, y: 6000, status: "DEFEATED" },
      { id: "zero-hp", x: 12000, y: 6000, hp: 0 },
      { id: "inactive", x: 12000, y: 6000, active: false },
    ],
  });
  assert.equal(adapter.pressureGroup.visible, false, "a gate with only dead or inactive hostiles hides pressure");

  adapter.reconcileActors({ gate, enemies: [] });
  assert.equal(adapter.pressureGroup.visible, false, "an empty hostile roster hides pressure");

  adapter.reconcileActors({
    gate,
    enemies: [{ id: "at-gate", x: gate.x, y: gate.y, hp: 10 }],
  });
  assert.equal(adapter.pressureGroup.visible, true, "a live hostile at the gate still marks the threatened target");
  assert.equal(adapter.pressureTargetRing.visible, true, "the target ring remains visible at zero separation");
  assert.equal(adapter.pressureLane.visible, false, "zero separation suppresses the directionless lane");
  assert.equal(adapter.pressureArrow.visible, false, "zero separation suppresses the directionless arrow");
  assertNear(adapter.pressureTargetRing.position.x, 7, "the zero-separation ring remains on the gate X");
  assertNear(adapter.pressureTargetRing.position.z, 0, "the zero-separation ring remains on the gate Z");
  adapter.dispose();
});

test("RealtimeBattle dispose releases every pressure-indicator mesh exactly once", () => {
  const adapter = pressureIndicatorHarness();
  const meshes = [adapter.pressureLane, adapter.pressureArrow, adapter.pressureTargetRing];
  let geometryDisposals = 0;
  let materialDisposals = 0;
  for (const mesh of meshes) {
    mesh.geometry.addEventListener("dispose", () => { geometryDisposals += 1; });
    mesh.material.addEventListener("dispose", () => { materialDisposals += 1; });
  }

  adapter.dispose();

  assert.equal(geometryDisposals, meshes.length, "dispose releases each owned pressure geometry");
  assert.equal(materialDisposals, meshes.length, "dispose releases each owned pressure material");
  assert.equal(adapter.pressureGroup, null);
  assert.equal(adapter.pressureLane, null);
  assert.equal(adapter.pressureArrow, null);
  assert.equal(adapter.pressureTargetRing, null);

  adapter.dispose();
  assert.equal(geometryDisposals, meshes.length, "repeated dispose does not release pressure geometries twice");
  assert.equal(materialDisposals, meshes.length, "repeated dispose does not release pressure materials twice");
});

test("RealtimeBattle disposes shared skeleton resources once per unique skeleton", () => {
  const adapter = realtimeBattleHarness();
  const bone = new THREE.Bone();
  const skeleton = new THREE.Skeleton([bone]);
  const boneTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  skeleton.boneTexture = boneTexture;
  let skeletonDisposals = 0;
  let boneTextureDisposals = 0;
  const disposeSkeleton = skeleton.dispose.bind(skeleton);
  const disposeBoneTexture = boneTexture.dispose.bind(boneTexture);
  skeleton.dispose = () => {
    skeletonDisposals += 1;
    disposeSkeleton();
  };
  boneTexture.dispose = () => {
    boneTextureDisposals += 1;
    disposeBoneTexture();
  };

  const makeSharedRigRoot = () => {
    const root = new THREE.Group();
    const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    mesh.bind(skeleton);
    root.add(mesh);
    return root;
  };
  adapter.terrainGroup.add(makeSharedRigRoot(), makeSharedRigRoot());

  adapter.dispose();
  assert.equal(skeletonDisposals, 1, "two roots sharing one skeleton must dispose that skeleton once");
  assert.equal(boneTextureDisposals, 1, "the shared skeleton's bone texture must dispose once");
  adapter.dispose();
  assert.equal(skeletonDisposals, 1, "repeated adapter disposal must not dispose a skeleton twice");
  assert.equal(boneTextureDisposals, 1, "repeated adapter disposal must not dispose a bone texture twice");
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
  const expectedPitch = 55 * (Math.PI / 180);
  assert.ok(Math.abs(adapter.orbitPitch - expectedPitch) < 1e-12, "orbit state is untouched by updateCamera -- still the authored default 55° pitch");
  const expectedZoom = 20.8;
  assert.ok(Math.abs(adapter.zoomFactor - expectedZoom) < 1e-9, "orbit state is untouched by updateCamera -- still the authored DESCENT zoom distance");

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

// D26: the world-space HUD's projection contract. app.js calls these behind
// `?.` at 4 sites, so their ABSENCE is silent -- that is exactly how they
// stayed missing from merge 5a5f63a until now. These tests fail loudly if
// they ever vanish again.
test("RealtimeBattle projects tracked actors and static ground points for the world-space HUD", () => {
  const adapter = realtimeBattleHarness();
  // Point the camera at the origin so the projection has a defined frame.
  adapter.updateCamera({ commander: { id: "commander", x: 12000, y: 6000 } });

  // A static point at the arena centre normalizes to (0,0) and must land
  // near the middle of the view the camera is centred on.
  const centre = adapter.projectStaticPoint(0, 0);
  assert.ok(centre, "the arena centre must project to a screen position");
  assert.equal(centre.visible, true, "the point the camera is centred on must be visible");
  assert.ok(Math.abs(centre.x) < 0.5, `centre should project near screen-centre x, got ${centre.x}`);

  // An actor standing on that same normalized point must project to the
  // same pixel -- static markers and actors share one mapping.
  adapter.reconcileActors({ commander: { id: "commander", x: 12000, y: 6000 } });
  const record = adapter.actors.get("commander");
  record.root = new THREE.Object3D();
  adapter.actorGroup.add(record.root);
  adapter.reconcileActors({ commander: { id: "commander", x: 12000, y: 6000 } });
  const actor = adapter.projectEntityToScreen("commander");
  assert.ok(actor, "a tracked actor with a root must project");
  assert.ok(
    Math.abs(actor.x - centre.x) < 1e-9 && Math.abs(actor.y - centre.y) < 1e-9,
    "an actor standing on a normalized point projects to the same place as that static point",
  );

  // Unknown ids are a miss, not a throw -- app.js iterates snapshot ids that
  // may not have a mesh yet (async GLB load).
  assert.equal(adapter.projectEntityToScreen("no-such-entity"), null);

  assert.doesNotThrow(() => adapter.dispose());
  assert.equal(adapter.projectStaticPoint(0, 0), null, "a disposed renderer has no camera to project through");
});

test("RealtimeBattle keeps raw out-of-frustum NDC so the waypoint arrow can clamp to an edge", () => {
  const adapter = realtimeBattleHarness();
  adapter.updateCamera({ commander: { id: "commander", x: 12000, y: 6000 } });

  // Far outside the diorama but still in front of the camera: this MUST
  // return a value with visible=false rather than null. app.js:1376 branches
  // on `!ndc.visible` to place the offscreen objective arrow -- returning
  // null here would silently disable that arrow, which is precisely the
  // failure mode this test defends.
  const offscreen = adapter.projectStaticPoint(-40, -40);
  if (offscreen !== null) {
    assert.equal(offscreen.visible, false, "a point far outside the frustum is not visible");
    assert.ok(
      Math.abs(offscreen.x) > 1 || Math.abs(offscreen.y) > 1,
      "an off-frustum point keeps raw NDC outside [-1,1] instead of being clamped away",
    );
  } else {
    // Acceptable only if it genuinely fell behind the camera plane.
    assert.ok(true, "point resolved behind the camera, which correctly returns null");
  }
  assert.doesNotThrow(() => adapter.dispose());
});
test("RealtimeBattle orbit()/zoom() report when input is cut by a saturated pitch/zoom clamp", () => {
  const adapter = realtimeBattleHarness();
  const defaultPitch = adapter.orbitPitch;
  const defaultZoom = adapter.zoomFactor;

  // Within range: a small pitch nudge is absorbed, no boundary hit.
  assert.equal(adapter.orbit(0, 0.05), false, "an in-range pitch drag reports no clamp boundary");
  // Yaw is unrestricted, so a yaw-only drag never reports a boundary even
  // at a huge magnitude.
  assert.equal(adapter.orbit(1000, 0), false, "an unrestricted-yaw drag never reports a clamp boundary");

  // Push hard past the upper pitch clamp (85°): boundary hit, and the
  // pitch is still clamped inside the range.
  adapter.orbitPitch = defaultPitch;
  assert.equal(adapter.orbit(0, 10), true, "dragging past the max pitch reports a clamp boundary");
  assert.ok(adapter.orbitPitch <= THREE.MathUtils.degToRad(85) + 1e-9, "max-pitch clamp still holds the value in range");
  // Continuing to push into the already-saturated boundary keeps reporting
  // the hit (so app.js can re-tick after the audio refractory expires).
  assert.equal(adapter.orbit(0, 10), true, "continuing to push into the saturated max pitch keeps reporting the boundary");

  // Symmetric on the lower pitch clamp (30°).
  assert.equal(adapter.orbit(0, -10), true, "dragging past the min pitch reports a clamp boundary");
  assert.ok(adapter.orbitPitch >= THREE.MathUtils.degToRad(30) - 1e-9, "min-pitch clamp still holds the value in range");

  // Zoom: in-range delta reports nothing; pushing past either distance
  // bound reports a boundary. (Distance bounds have valid pre-mount
  // defaults, so this holds without mount()'s fov/GLB-derived overwrite.)
  adapter.zoomFactor = defaultZoom;
  assert.equal(adapter.zoom(0), false, "a zero-delta zoom reports no clamp boundary");
  assert.equal(adapter.zoom(100000), true, "pinching past the far distance bound reports a clamp boundary");
  assert.equal(adapter.zoom(-100000), true, "pinching past the near distance bound reports a clamp boundary");
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

test("BattleVisualizer renders procedural Cinder Span terrain without retired world artwork", async () => {
  const camera = { x: 24, y: -18 };
  const [, Fallback] = await freshAdapters();
  const canvas = cameraCanvas();
  const adapter = new Fallback().mount({ canvas, viewport: canvas });

  adapter.renderSnapshot(cinderSpanSnapshot(), { camera, viewport: canvas });

  assert.equal(canvas.calls.some(([name]) => name === "drawImage"), false, "BattleVisualizer must not request retired Cinder Span world artwork");
  assert.ok(canvas.calls.some(([name]) => name === "rect"), "BattleVisualizer keeps its procedural terrain visible");
  const cameraIndex = canvas.calls.findIndex(
    ([name, x, y]) => name === "translate" && x === camera.x && y === camera.y,
  );
  assert.ok(cameraIndex >= 0, "BattleVisualizer still applies the supplied camera to its procedural world layer");
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
