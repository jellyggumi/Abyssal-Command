import assert from "node:assert/strict";
import test from "node:test";

import { BattleVisualizer } from "../battle-visualizer.js";

function makeVisualizer(t, {
  reducedMotion = false,
  setTimeout,
  clearTimeout,
  canvas = {},
  options = {},
  presentation,
} = {}) {
  const priorWindow = globalThis.window;
  globalThis.window = {
    matchMedia: () => ({ matches: reducedMotion }),
    ...(setTimeout ? { setTimeout } : {}),
    ...(clearTimeout ? { clearTimeout } : {}),
  };
  t.after(() => {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  });

  const visualizer = new BattleVisualizer(canvas, presentation, options);
  visualizer.renderStatic = () => {};
  visualizer.publishRuntimeState = () => {};
  visualizer.hasBridgeAtlas = () => false;
  return visualizer;
}

function makePointerCanvas() {
  const listeners = new Map();
  const focusCalls = [];
  return {
    style: {},
    focusCalls,
    focus(options) {
      focusCalls.push(options);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1600, height: 900 };
    },
    setPointerCapture() {},
    dispatch(type, { x = 0, y = 0, ...event } = {}) {
      listeners.get(type)?.({
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
        clientX: x,
        clientY: y,
        ...event,
      });
    },
  };
}

function clickCanvasTarget(canvas, point) {
  canvas.dispatch("pointerdown", point);
  canvas.dispatch("pointerup", point);
}

test("BattleVisualizer fallback canvas prioritizes available semantic targets over selected move orders and rejects unavailable bosses", (t) => {
  const canvas = makePointerCanvas();
  const requestedActions = [];
  let availableActions = ["materialize", "capture", "assault"];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      nodeGoal: 1,
      onActionRequest: (action) => requestedActions.push(action),
      getAvailableActions: () => availableActions,
    },
  });
  const moveOrders = [];
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.walkable = () => true;
  visualizer.unprojectToTile = () => ({ x: 2, y: 2 });
  visualizer.issueMoveOrder = (tile) => moveOrders.push(tile);
  visualizer.selection.add({ x: 1, y: 1 });
  visualizer.attachPointerHandlers();

  const screenPoint = (point) => visualizer.project(point.x, point.y);
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("portal")));
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("node")));

  assert.deepEqual(
    requestedActions,
    ["materialize", "capture"],
    "clicking available portal and node targets must dispatch their supplied campaign action callback",
  );
  assert.deepEqual(
    moveOrders,
    [],
    "an available semantic target must consume the click before a selected ally can receive a movement order",
  );

  visualizer.selection.clear();
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("boss")));
  assert.deepEqual(
    requestedActions,
    ["materialize", "capture"],
    "a hidden boss target must not dispatch Assault even when that action is otherwise available",
  );

  visualizer.bossExposed = true;
  availableActions = ["materialize", "capture"];
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("boss")));
  assert.deepEqual(
    requestedActions,
    ["materialize", "capture"],
    "an exposed boss must still reject Assault while the supplied available-action contract withholds it",
  );

  availableActions = ["materialize", "capture", "assault"];
  clickCanvasTarget(canvas, screenPoint(visualizer.actionPoint("boss")));
  assert.deepEqual(
    requestedActions,
    ["materialize", "capture", "assault"],
    "an exposed boss must dispatch Assault only after the supplied available-action contract admits it",
  );
});

test("BattleVisualizer keeps portal pointer focus and activation on the same highest-priority available action", (t) => {
  const canvas = makePointerCanvas();
  const focusedActions = [];
  const requestedActions = [];
  let availableActions = ["materialize", "domain"];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      getAvailableActions: () => availableActions,
      onActionFocus: (action) => focusedActions.push(action),
      onActionRequest: (action) => requestedActions.push(action),
    },
  });
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.attachPointerHandlers();
  const portal = visualizer.actionPoint("portal");
  const target = visualizer.project(portal.x, portal.y);

  canvas.dispatch("pointermove", target);
  clickCanvasTarget(canvas, target);

  availableActions = ["domain"];
  canvas.dispatch("pointermove", target);
  clickCanvasTarget(canvas, target);

  assert.deepEqual(
    focusedActions,
    ["materialize", "domain"],
    "portal focus must prefer Materialize while both commands are available and expose Domain only after Materialize is unavailable",
  );
  assert.deepEqual(
    requestedActions,
    ["materialize", "domain"],
    "pointerup activation must resolve the same portal action previously projected through pointer focus",
  );
});

test("BattleVisualizer focuses the fallback canvas before reporting pointerdown spatial focus", (t) => {
  const canvas = makePointerCanvas();
  const reportedFocus = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      getAvailableActions: () => ["materialize"],
      onActionFocus: (action) => {
        reportedFocus.push({ action, focusCallCount: canvas.focusCalls.length });
      },
    },
  });
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.attachPointerHandlers();
  const portal = visualizer.actionPoint("portal");

  canvas.dispatch("pointerdown", {
    ...visualizer.project(portal.x, portal.y),
    pointerType: "touch",
  });

  assert.deepEqual(
    canvas.focusCalls,
    [{ preventScroll: true }],
    "pointerdown must move keyboard ownership to the fallback canvas without scrolling the command UI",
  );
  assert.deepEqual(
    reportedFocus,
    [{ action: "materialize", focusCallCount: 1 }],
    "the canvas must already be focused before pointer/touch spatial focus is projected to the DOM",
  );
});

test("BattleVisualizer projects pointer focus and clears it on hover exit, cancellation, and canvas blur", (t) => {
  const runFocusSequence = (exit) => {
    const canvas = makePointerCanvas();
    const focusedActions = [];
    const visualizer = makeVisualizer(t, {
      canvas,
      options: {
        getAvailableActions: () => ["materialize"],
        onActionFocus: (action) => focusedActions.push(action),
      },
    });
    visualizer.view.scale = 100;
    visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
    visualizer.elevationAt = () => 0;
    visualizer.attachPointerHandlers();
    const portal = visualizer.actionPoint("portal");
    const target = visualizer.project(portal.x, portal.y);

    if (exit === "pointercancel") {
      canvas.dispatch("pointerdown", target);
    } else {
      canvas.dispatch("pointermove", target);
    }
    canvas.dispatch(exit, exit === "pointercancel" ? { pointerId: 1 } : {});
    return focusedActions;
  };

  const canvas = makePointerCanvas();
  const passiveFocus = [];
  const visualizer = makeVisualizer(t, {
    canvas,
    options: {
      getAvailableActions: () => ["materialize"],
      onActionFocus: (action) => passiveFocus.push(action),
    },
  });
  visualizer.view.scale = 100;
  visualizer.project = (x, y) => ({ x: x * 100, y: y * 100 });
  visualizer.elevationAt = () => 0;
  visualizer.attachPointerHandlers();
  const portal = visualizer.actionPoint("portal");
  canvas.dispatch("pointermove", visualizer.project(portal.x, portal.y));
  canvas.dispatch("pointermove", { x: 1500, y: 850 });

  assert.deepEqual(
    {
      passiveHover: passiveFocus,
      pointerleave: runFocusSequence("pointerleave"),
      pointercancel: runFocusSequence("pointercancel"),
      blur: runFocusSequence("blur"),
    },
    {
      passiveHover: ["materialize", null],
      pointerleave: ["materialize", null],
      pointercancel: ["materialize", null],
      blur: ["materialize", null],
    },
    "every canvas focus exit must clear the command/dossier projection after exposing the matching available action",
  );
});

test("BattleVisualizer previewAction and clearActionPreview expose a controlled DOM preview seam", (t) => {
  const visualizer = makeVisualizer(t);
  const semantic = Object.freeze({ action: "hunt", source: "portal", target: "extractor", actor: "commander", clip: "Special" });
  let renders = 0;
  visualizer.renderStatic = () => {
    renders += 1;
  };

  visualizer.previewAction(semantic);
  assert.strictEqual(visualizer.actionPreview, semantic, "DOM hover or keyboard focus must project the exact action-enriched semantic supplied by the app bridge");
  assert.equal(renders, 1, "starting a DOM preview must redraw the fallback battlefield");

  visualizer.clearActionPreview();
  assert.equal(visualizer.actionPreview, null, "DOM pointerout or blur must clear the projected renderer preview");
  assert.equal(renders, 2, "clearing a DOM preview must redraw the fallback battlefield");
});

test("BattleVisualizer action feedback remains presentation-only while preserving semantic source-to-target gestures", (t) => {
  const visualizer = makeVisualizer(t);
  const ally = { x: 3, y: 2, isPossessed: false };
  const enemy = { x: 11, y: 5, archetype: "scout" };
  const nodes = [{ x: 5, y: 4 }];
  const encounter = Object.freeze({ config: Object.freeze({ waves: [] }), state: Object.freeze({ activeWaveId: null }) });
  const spatialCalls = [];
  const reconcileCalls = [];
  const spawnAllyCalls = [];
  const spawnEnemyCalls = [];
  visualizer.allies = [ally];
  visualizer.enemies = [enemy];
  visualizer.nodes = nodes;
  visualizer.encounter = encounter;
  visualizer.authoritativeLegion = 1;
  visualizer.bossExposed = false;
  visualizer.reconcileAllies = (...args) => reconcileCalls.push(args);
  visualizer.spawnAlly = (...args) => spawnAllyCalls.push(args);
  visualizer.spawnEnemy = (...args) => spawnEnemyCalls.push(args);
  visualizer.playSpatial = (...args) => spatialCalls.push(args);

  const portal = visualizer.actionPoint("portal");
  const extractor = visualizer.actionPoint("extractor");
  visualizer.triggerAction({
    action: "materialize",
    source: "portal",
    target: "portal",
    sourceAsset: "rift-portal",
    clip: "Activate",
  });
  visualizer.triggerAction({
    action: "extract",
    source: "extractor",
    target: "portal",
    sourceAsset: "soul-extractor",
    clip: "Activate",
  });

  assert.deepEqual(
    visualizer.actionFx.map(({ action, source, target }) => ({ action, source, target })),
    [
      { action: "materialize", source: portal, target: portal },
      { action: "extract", source: extractor, target: portal },
    ],
    "motion-enabled fallback feedback must retain each command's semantic source and target overlay",
  );
  assert.deepEqual(
    spatialCalls.map(([x, y, options]) => ({ x, y, delay: options.delay ?? 0 })),
    [
      { x: portal.x, y: portal.y, delay: 0 },
      { x: extractor.x, y: extractor.y, delay: 0 },
      { x: portal.x, y: portal.y, delay: 0.075 },
    ],
    "a same-endpoint materialize gesture must play once, while Extract must confirm its distinct target after the source cue",
  );
  assert.deepEqual(reconcileCalls, [], "renderer-local actions must not reconcile campaign-authoritative allies");
  assert.deepEqual(spawnAllyCalls, [], "renderer-local actions must not spawn allies");
  assert.deepEqual(spawnEnemyCalls, [], "renderer-local actions must not spawn or remove enemies");
  assert.deepEqual(visualizer.allies, [ally], "renderer-local actions must preserve ally topology");
  assert.deepEqual(visualizer.enemies, [enemy], "renderer-local actions must preserve enemy topology");
  assert.equal(visualizer.nodes, nodes, "renderer-local actions must preserve node topology/configuration");
  assert.equal(visualizer.encounter, encounter, "renderer-local actions must preserve the authoritative encounter");
  assert.equal(visualizer.authoritativeLegion, 1, "renderer-local actions must not change the authoritative legion");
  assert.equal(visualizer.bossExposed, false, "renderer-local actions must not change domain or assault state");
  assert.equal(ally.isPossessed, false, "renderer-local actions must not mutate possession state");
});

test("BattleVisualizer preserves Activate source-atlas clips for non-unit action assets", (t) => {
  const visualizer = makeVisualizer(t);
  const atlasCalls = [];
  const bridgeClipCalls = [];
  visualizer.nodes = [{ x: 5, y: 4 }];
  visualizer.playSpatial = () => {};
  visualizer.hasBridgeAtlas = (asset, clip) => {
    atlasCalls.push({ asset, clip });
    return true;
  };
  visualizer.setBridgeClip = (asset, clip) => bridgeClipCalls.push({ asset, clip });

  const semantics = [
    { action: "extract", source: "extractor", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "soul-extractor", clip: "Activate" },
    { action: "materialize", source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "rift-portal", clip: "Activate" },
    { action: "capture", source: "portal", target: "node", actor: "commander", actorClip: "Special", sourceAsset: "command-obelisk", clip: "Activate" },
    { action: "domain", source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "echo-throne", clip: "Activate" },
  ];
  for (const semantic of semantics) visualizer.triggerAction(semantic);

  const expected = semantics.map(({ sourceAsset, clip }) => ({ asset: sourceAsset, clip }));
  assert.deepEqual(
    atlasCalls,
    expected,
    "source-atlas availability must retain each non-unit asset's exported Activate clip rather than substituting the commander's Special clip",
  );
  assert.deepEqual(
    bridgeClipCalls,
    expected,
    "available source atlases must receive the same Activate clip that was validated for the source asset",
  );
});

test("BattleVisualizer reduced-motion feedback keeps one static semantic overlay until its controlled clear", (t) => {
  const timers = [];
  const visualizer = makeVisualizer(t, {
    reducedMotion: true,
    setTimeout(callback, duration) {
      timers.push({ callback, duration });
      return "action-feedback-timer";
    },
    clearTimeout() {},
  });
  const ally = { x: 3, y: 2, isPossessed: false };
  const enemy = { x: 11, y: 5, archetype: "scout" };
  const nodes = [{ x: 5, y: 4 }];
  const encounter = Object.freeze({ config: Object.freeze({ waves: [] }), state: Object.freeze({ activeWaveId: null }) });
  let renders = 0;
  visualizer.allies = [ally];
  visualizer.enemies = [enemy];
  visualizer.nodes = nodes;
  visualizer.encounter = encounter;
  visualizer.authoritativeLegion = 1;
  visualizer.bossExposed = false;
  visualizer.playSpatial = () => {};
  visualizer.render = () => { renders += 1; };

  const portal = visualizer.actionPoint("portal");
  const extractor = visualizer.actionPoint("extractor");
  visualizer.triggerAction({
    action: "extract",
    source: "extractor",
    target: "portal",
    sourceAsset: "soul-extractor",
    clip: "Special",
  });

  assert.deepEqual(
    visualizer.actionFx.map(({ action, source, target }) => ({ action, source, target })),
    [{ action: "extract", source: extractor, target: portal }],
    "reduced motion must retain one static source-to-target feedback overlay instead of suppressing the command signal",
  );
  assert.deepEqual(timers.map(({ duration }) => duration), [700], "reduced-motion feedback must schedule one bounded clear");
  assert.equal(visualizer.actionFeedbackTimer, "action-feedback-timer", "the pending static-overlay timer must be retained for safe cancellation");
  assert.equal(renders, 1, "reduced-motion feedback must render its static overlay immediately");
  assert.equal(visualizer.encounter, encounter, "reduced-motion feedback must preserve the authoritative encounter");
  assert.equal(visualizer.authoritativeLegion, 1, "reduced-motion feedback must preserve the authoritative legion");
  assert.deepEqual(visualizer.allies, [ally], "reduced-motion feedback must preserve allies and possession state");
  assert.deepEqual(visualizer.enemies, [enemy], "reduced-motion feedback must preserve enemies");
  assert.equal(visualizer.nodes, nodes, "reduced-motion feedback must preserve node topology");
  assert.equal(visualizer.bossExposed, false, "reduced-motion feedback must preserve domain and assault state");

  timers[0].callback();

  assert.deepEqual(visualizer.actionFx, [], "the controlled timer must clear the static overlay safely");
  assert.equal(visualizer.actionFeedbackTimer, null, "the controlled timer must clear its own handle");
  assert.equal(renders, 2, "clearing the static overlay must render the cleared state once");
});

function fakeRunningAudioContext() {
  const calls = { resume: 0, oscillators: 0, starts: 0 };
  const context = {
    state: "suspended",
    currentTime: 0,
    resume() {
      calls.resume += 1;
      this.state = "running";
      return Promise.resolve();
    },
    createOscillator() {
      calls.oscillators += 1;
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() { calls.starts += 1; },
        stop() {},
      };
    },
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    },
  };
  return { context, calls };
}

test("BattleVisualizer resumes suspended spatial audio before allocating an oscillator", async (t) => {
  const visualizer = makeVisualizer(t);
  const { context, calls } = fakeRunningAudioContext();
  const audio = { ctx: context, master: {} };
  visualizer.audio = audio;
  visualizer.ensureAudio = () => audio;
  visualizer.project = () => ({ x: 50, y: 50 });
  visualizer.elevationAt = () => 0;
  visualizer.view = { width: 100, height: 100 };

  visualizer.playSpatial(3, 2);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.resume, 1, "suspended spatial audio must request one context resume");
  assert.equal(calls.oscillators, 1, "a successfully resumed context must allocate one oscillator");
  assert.equal(calls.starts, 1, "a successfully resumed context must start the oscillator");
});

test("BattleVisualizer ignores rejected suspended-audio resumes without allocating an oscillator", async (t) => {
  const visualizer = makeVisualizer(t);
  const { context, calls } = fakeRunningAudioContext();
  context.resume = () => {
    calls.resume += 1;
    return Promise.reject(new Error("resume denied"));
  };
  const audio = { ctx: context, master: {} };
  visualizer.audio = audio;
  visualizer.ensureAudio = () => audio;
  visualizer.project = () => ({ x: 50, y: 50 });
  visualizer.elevationAt = () => 0;
  visualizer.view = { width: 100, height: 100 };

  visualizer.playSpatial(3, 2);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.resume, 1, "a rejected resume must still be attempted exactly once");
  assert.equal(calls.oscillators, 0, "a rejected resume must not allocate an oscillator");
  assert.equal(calls.starts, 0, "a rejected resume must not start an oscillator");
});

test("BattleVisualizer spawns hostile waves from the 24×12 route frontage without legacy 16×8 coordinates", (t) => {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 10 },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};

  visualizer.spawnEncounterWave({ id: "zenith-wave", hostiles: 3, hostileHealth: 4 });

  assert.equal(visualizer.enemies.length, 3, "the fallback renderer must materialize every hostile in the supplied wave");
  visualizer.enemies.forEach((enemy, routeIndex) => {
    assert.equal(enemy.routeIndex, routeIndex, `hostile ${routeIndex + 1} must use its authored route`);
    assert.equal(enemy.x, 22.5, `route ${routeIndex + 1} must spawn beyond the legacy 16-column boundary`);
    assert.equal(enemy.y, 5.5, `route ${routeIndex + 1} must spawn on the far-side deployment frontage`);
    assert.equal(
      enemy.path.length,
      visualizer.navigation.routes[routeIndex].cells.length - 1,
      `route ${routeIndex + 1} must retain every waypoint after its spawn cell`,
    );
    assert.deepEqual(
      enemy.path.at(-1),
      { x: 1.5, y: 5.5 },
      `route ${routeIndex + 1} must terminate at the portal frontage`,
    );
  });
});

test("BattleVisualizer maps Stage 1 waves to their authored models and later archetypes to the scout fallback", (t) => {
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};
  const archetypeByWave = {};

  for (const waveId of ["scout", "guard", "reinforcement", "depthguard"]) {
    visualizer.enemies = [];
    visualizer.spawnEncounterWave({ id: waveId, hostiles: 1, hostileHealth: 2 });
    archetypeByWave[waveId] = visualizer.enemies[0]?.archetype;
  }

  assert.deepEqual(
    archetypeByWave,
    {
      scout: "scout",
      guard: "guard",
      reinforcement: "reinforce",
      depthguard: "scout",
    },
    "only the three declared Stage 1 waves may select dedicated hostile art; later archetypes must retain the scout fallback",
  );
});
