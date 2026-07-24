import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RealtimeBattle } from "../battle-realtime-three.js";
import { BattleVisualizer } from "../battle-visualizer.js";

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

test("defense renderer adapters project a supplied snapshot to a mocked Canvas2D context", () => {
  for (const Adapter of ADAPTERS) {
    const canvas = mockCanvas();
    const adapter = new Adapter();
    assert.equal(adapter.mount({ canvas, handoff: { ignored: true }, viewport: { width: 640, height: 360 } }), adapter);
    assert.doesNotThrow(() => adapter.renderSnapshot(snapshot, { index: 4 }));
    assert.ok(canvas.calls.some(([name]) => name === "rect"), `${Adapter.name} paints its background`);
    assert.ok(canvas.calls.filter(([name]) => name === "arc").length >= 7, `${Adapter.name} paints game entities`);
    adapter.onVisualFeedback(17);
    assert.doesNotThrow(() => adapter.dispose());
    assert.doesNotThrow(() => adapter.dispose());
    assert.doesNotThrow(() => adapter.renderSnapshot(snapshot));
  }
});
// D17 (production/decision-log.md, Cycle 3 concept lock): RealtimeBattle now
// renders via real WebGL2 + a free-orbit 3D camera when available, which is
// NOT expected to produce byte-identical output to BattleVisualizer's fixed
// Canvas2D camera — that assumption was explicitly retired this cycle. What
// remains TRUE and load-bearing (asserted below): Node has no global
// WebGL2RenderingContext at all, so hasRealWebGL2()'s `typeof
// WebGL2RenderingContext !== "undefined"` check is unconditionally false in
// every Node test regardless of what the mock canvas provides — RealtimeBattle
// therefore ALWAYS composes and delegates to its own internal BattleVisualizer
// fallback here (usingFallback===true), for every adapter in this test. This
// test is really "RealtimeBattle's Canvas2D fallback path stays wired
// identically to standalone BattleVisualizer" — an important regression guard
// (a change to the fallback delegation could silently diverge the two), but it
// says NOTHING about real-WebGL output, which can only be exercised in a real
// browser (see tests/defense-survivor-browser.cjs's renderer-mode assertions,
// and tests/defense-hud-responsive-browser.cjs/defense-performance-browser.cjs
// for the actual WebGL2 rendering path this suite cannot reach).
test("RealtimeBattle's Canvas2D fallback (always active in Node, which has no WebGL2RenderingContext) stays bounded-camera-identical to standalone BattleVisualizer", () => {
  const frame = Object.freeze({
    camera: Object.freeze({ x: 9000, y: -9000 }),
    viewport: { height: 360, width: 640 },
  });
  const transforms = [];

  for (const Adapter of ADAPTERS) {
    const canvas = cameraCanvas();
    const adapter = new Adapter().mount({ canvas, viewport: { height: canvas.height, width: canvas.width } });
    if (Adapter === RealtimeBattle) assert.equal(adapter.usingFallback, true, "Node has no WebGL2RenderingContext global -> RealtimeBattle must be in its Canvas2D fallback for this assertion to be meaningful");
    adapter.renderSnapshot(snapshot, frame);

    const cameraTransform = canvas.calls.find(([name]) => name === "translate");
    const clearIndex = canvas.calls.findIndex(([name]) => name === "clear");
    const backgroundIndex = canvas.calls.findIndex(([name]) => name === "rect");
    const transformIndex = canvas.calls.indexOf(cameraTransform);
    assert.deepEqual(
      cameraTransform,
      ["translate", canvas.width, -canvas.height],
      `${Adapter.name} bounds the shared presentation camera to the visible canvas`,
    );
    assert.ok(clearIndex < transformIndex, `${Adapter.name} clears in screen space before the world camera`);
    assert.ok(backgroundIndex < transformIndex, `${Adapter.name} paints the screen-space background before the world camera`);
    transforms.push(cameraTransform);
    adapter.dispose();
  }

  assert.deepEqual(transforms[0], transforms[1], "RealtimeBattle's fallback and standalone BattleVisualizer accept the same bounded camera frame (Canvas2D-fallback-only guarantee, not a real-WebGL claim)");
});

test("both adapters select the approved Cinder Span artwork only in the camera-transformed world layer", async (t) => {
  replaceImage(t, loadedImage());
  const camera = { x: 24, y: -18 };

  for (const Adapter of await freshAdapters()) {
    const canvas = cameraCanvas();
    const adapter = new Adapter().mount({ canvas, viewport: canvas });
    adapter.renderSnapshot(cinderSpanSnapshot(), { camera, viewport: canvas });

    const imageCalls = canvas.calls.filter(([name]) => name === "drawImage");
    assert.deepEqual(
      imageCalls.map(([, image]) => image.src),
      CINDER_SPAN_WORLD_ASSETS,
      `${Adapter.name} selects both approved Cinder Span images`,
    );
    const cameraIndex = canvas.calls.findIndex(
      ([name, x, y]) => name === "translate" && x === camera.x && y === camera.y,
    );
    const firstImageIndex = canvas.calls.indexOf(imageCalls[0]);
    assert.ok(cameraIndex >= 0 && cameraIndex < firstImageIndex, `${Adapter.name} applies images inside the transient camera world layer`);

    const beforeOtherStage = canvas.calls.length;
    adapter.renderSnapshot(
      { ...cinderSpanSnapshot(), presentation: { ...cinderSpanSnapshot().presentation, stageId: "gate-zenith" } },
      { camera, viewport: canvas },
    );
    assert.equal(
      canvas.calls.slice(beforeOtherStage).some(([name]) => name === "drawImage"),
      false,
      `${Adapter.name} does not select Cinder Span artwork for another stage`,
    );
    adapter.dispose();
  }
});

test("both adapters retain procedural Cinder Span terrain when world artwork is unavailable", async (t) => {
  replaceImage(t, unavailableImage());

  for (const Adapter of await freshAdapters()) {
    const canvas = cameraCanvas();
    const adapter = new Adapter().mount({ canvas, viewport: canvas });
    assert.doesNotThrow(() => adapter.renderSnapshot(cinderSpanSnapshot(), { camera: { x: 16, y: -12 }, viewport: canvas }));
    assert.equal(canvas.calls.some(([name]) => name === "drawImage"), false, `${Adapter.name} does not paint an unavailable image`);
    assert.ok(canvas.calls.some(([name]) => name === "rect"), `${Adapter.name} keeps its procedural terrain visible`);
    adapter.dispose();
  }
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
