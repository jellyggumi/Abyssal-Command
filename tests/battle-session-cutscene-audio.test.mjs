import assert from "node:assert/strict";
import test from "node:test";

import { createDefenseRun, getRunSnapshot } from "../defense-run-simulation.js";
import { TICK_RATE } from "../defense-catalog.js";
import { cutsceneFromEvent } from "../defense-cutscene.js";

function noop() {}

class TestElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = { setProperty: noop };
    this.classList = { add: noop, remove: noop, toggle: noop };
    this.listeners = new Map();
    this.parentNode = null;
    this.id = "";
    this.className = "";
    this.textContent = "";
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...children);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  querySelector(selector) {
    const matches = selector.startsWith("#")
      ? (node) => node.id === selector.slice(1)
      : selector === '[data-cutscene-dismiss="true"]'
        ? (node) => node.dataset.cutsceneDismiss === "true"
        : () => false;
    const pending = [...this.children];
    while (pending.length) {
      const node = pending.shift();
      if (matches(node)) return node;
      pending.unshift(...node.children);
    }
    return null;
  }

  querySelectorAll() {
    return [];
  }

  focus() {}
}

class AppRoot extends TestElement {
  querySelector(selector) {
    return super.querySelector(selector) ?? new TestElement();
  }
}

let battleSessionPromise;

async function loadBattleSession() {
  if (battleSessionPromise) return battleSessionPromise;
  const appRoot = new AppRoot();
  const documentElement = new TestElement("html");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener: noop,
      removeEventListener: noop,
      body: new TestElement("body"),
      documentElement,
      createElement: (tagName) => new TestElement(tagName),
      get hidden() { return false; },
      querySelector: (selector) => selector === "#defense-app" ? appRoot : null,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: noop,
      innerHeight: 720,
      innerWidth: 1280,
      matchMedia: () => ({ addEventListener: noop, matches: false, removeEventListener: noop }),
    },
  });
  globalThis.CustomEvent ??= class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = noop;
  battleSessionPromise = import("../app.js").then(({ BattleSession }) => BattleSession);
  return battleSessionPromise;
}

function countAudioEvents(calls, type) {
  return calls.flat().filter((event) => event.type === type).length;
}

function stopAndDismissCutscenes(session) {
  session.stopped = true;
  session.cutsceneQueue.length = 0;
  session.dismissCutscene();
}

test("BattleSession starts queued cutscene audio only when its overlay becomes visible", async (t) => {
  const BattleSession = await loadBattleSession();
  const audioCalls = [];
  const surface = new TestElement("main");
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    run: createDefenseRun({ stageId: "cinder-span", seed: 73 }),
    surface,
    canvas: { height: 360, width: 640 },
    statusNode: new TestElement(),
    renderer: { renderSnapshot: noop },
    audio: { consume: (events) => audioCalls.push([...events]) },
    audioTick: null,
    audioEventKeys: new Set(),
    recordedEliteIds: new Set(),
    cutsceneEventKeys: new Set(),
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    stopped: false,
    rallyAcknowledgedBossIds: new Set(),
    motionQuery: { matches: false },
    lastStanceBlockEventId: null,
    lastStanceSwitchEventId: null,
    userPaused: false,
    terminalHandled: false,
    camera: { x: 0, y: 0 },
  });
  session.projected = (snapshot) => snapshot;
  session.updateCamera = () => ({ x: 0, y: 0 });
  session.renderControls = noop;
  session.renderPauseOverlay = noop;
  session.renderWorldHud = noop;
  session.renderEventFeedback = noop;
  t.after(() => stopAndDismissCutscenes(session));

  const stageStarted = Object.freeze({
    type: "STAGE_STARTED",
    tick: 0,
    stageId: "cinder-span",
    cutscene: ["봉쇄선 진입"],
  });
  const loreResolved = Object.freeze({
    type: "LORE_SURPRISE_RESOLVED",
    tick: 0,
    tableId: "cinder-span-surprise",
    outcomeId: "ash-echo-whisper",
    text: "옛 교량의 재가 바람에 흩어진다.",
  });
  const impact = Object.freeze({
    type: "PROJECTILE_IMPACT",
    tick: 0,
    eventId: "impact:0:1",
    targetId: "enemy-1",
  });

  session.render([stageStarted, loreResolved, impact, loreResolved, stageStarted]);

  assert.equal(surface.querySelector("#defense-cutscene-overlay")?.dataset.cutsceneEvent, "STAGE_STARTED");
  assert.equal(surface.dataset.defenseCutscene, "STAGE_STARTED");
  assert.equal(countAudioEvents(audioCalls, "STAGE_STARTED"), 1, "visible stage dialogue starts its audio once");
  assert.equal(countAudioEvents(audioCalls, "PROJECTILE_IMPACT"), 1, "ordinary SFX remains frame-batch-driven");
  assert.equal(countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED"), 0, "queued lore remains silent behind stage dialogue");

  session.dismissCutscene();

  assert.equal(surface.querySelector("#defense-cutscene-overlay")?.dataset.cutsceneEvent, "LORE_SURPRISE_RESOLVED");
  assert.equal(surface.dataset.defenseCutscene, "LORE_SURPRISE_RESOLVED");
  assert.equal(countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED"), 1, "lore narration starts at its visual boundary exactly once");

  session.consumeCutscenes([loreResolved, loreResolved, stageStarted]);
  session.dismissCutscene();

  assert.equal(surface.querySelector("#defense-cutscene-overlay"), null);
  assert.equal(countAudioEvents(audioCalls, "STAGE_STARTED"), 1, "duplicate stage cutscenes do not replay audio");
  assert.equal(countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED"), 1, "duplicate lore cutscenes do not replay narration");

  session.cutsceneEventKeys.clear();
  session.stopped = false;
  session.presentCutscene(stageStarted);
  session.presentCutscene(loreResolved);
  const loreAudioBeforeStop = countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED");

  session.stopped = true;
  session.dismissCutscene();

  assert.equal(surface.querySelector("#defense-cutscene-overlay"), null);
  assert.equal(
    countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED"),
    loreAudioBeforeStop,
    "stopped sessions discard queued cutscenes without starting their audio",
  );
});

test("BattleSession pauses simulation across queued dialogue and narration, then resumes one tick on the next frame", async (t) => {
  const BattleSession = await loadBattleSession();
  const surface = new TestElement("main");
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    run: createDefenseRun({ stageId: "cinder-span", seed: 73 }),
    surface,
    audio: { consume: noop },
    cutsceneEventKeys: new Set(),
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    stopped: false,
    userPaused: false,
    lastFrameAt: 0,
    accumulator: 0,
    frame: 0,
  });
  session.render = noop;
  t.after(() => stopAndDismissCutscenes(session));

  const stageStarted = Object.freeze({
    type: "STAGE_STARTED",
    tick: 0,
    stageId: "cinder-span",
    cutscene: ["봉쇄선 진입"],
  });
  const loreResolved = Object.freeze({
    type: "LORE_SURPRISE_RESOLVED",
    tick: 0,
    tableId: "cinder-span-surprise",
    outcomeId: "ash-echo-whisper",
    text: "옛 교량의 재가 바람에 흩어진다.",
  });
  const tick = () => getRunSnapshot(session.run).tick;

  session.presentCutscene(stageStarted);
  session.presentCutscene(loreResolved);
  session.loop(1_000);
  const openingTick = tick();

  assert.equal(surface.querySelector("#defense-cutscene-overlay")?.dataset.captionMode, "dialogue");
  session.loop(1_067);
  assert.equal(tick(), openingTick, "visible stage dialogue must pause every simulation tick");

  session.dismissCutscene();
  assert.equal(
    surface.querySelector("#defense-cutscene-overlay")?.dataset.captionMode,
    "narration",
    "dismissing dialogue must continue directly into its queued narration",
  );
  session.loop(1_134);
  assert.equal(tick(), openingTick, "queued narration must keep the simulation paused");

  session.dismissCutscene();
  assert.equal(surface.querySelector("#defense-cutscene-overlay"), null);
  session.loop(1_134 + (1_000 / TICK_RATE) + 0.001);
  assert.equal(tick(), openingTick + 1, "the first frame after the final overlay must advance exactly one tick");
});

test("BattleSession timer completion removes the overlay and resumes without paused-time catch-up", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const BattleSession = await loadBattleSession();
  const surface = new TestElement("main");
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    run: createDefenseRun({ stageId: "cinder-span", seed: 73 }),
    surface,
    audio: { consume: noop },
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    stopped: false,
    userPaused: false,
    lastFrameAt: 0,
    accumulator: 0,
    frame: 0,
  });
  session.render = noop;
  t.after(() => stopAndDismissCutscenes(session));

  const dismissAfterMs = 25;
  const tick = () => getRunSnapshot(session.run).tick;
  session.showCutscene({
    eventType: "TEST_CUTSCENE",
    title: "Timer completion",
    captionMode: "dialogue",
    lines: ["Hold the simulation."],
    timing: { dismissAfterMs },
  });
  session.loop(1_000);
  const openingTick = tick();

  session.loop(11_000);
  assert.equal(tick(), openingTick, "simulation ticks must stay fixed while the timed overlay is visible");
  assert.notEqual(
    surface.querySelector("#defense-cutscene-overlay"),
    null,
    "the overlay must remain visible before its dismissal timer expires",
  );

  t.mock.timers.tick(0);
  t.mock.timers.tick(dismissAfterMs);
  assert.equal(
    surface.querySelector("#defense-cutscene-overlay"),
    null,
    "timer completion must remove the active overlay",
  );

  session.loop(11_000 + (1_000 / TICK_RATE) + 0.001);
  assert.equal(
    tick(),
    openingTick + 1,
    "the first frame after timer completion must advance one tick without catching up paused wall-clock time",
  );
});

test("BattleSession timer completion hands off to queued narration and ignores the first overlay's stale dismissal", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const BattleSession = await loadBattleSession();
  const surface = new TestElement("main");
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    run: createDefenseRun({ stageId: "cinder-span", seed: 73 }),
    surface,
    audio: { consume: noop },
    cutsceneEventKeys: new Set(),
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    stopped: false,
    userPaused: false,
    lastFrameAt: 0,
    accumulator: 0,
    frame: 0,
  });
  session.render = noop;
  t.after(() => stopAndDismissCutscenes(session));

  const stageStarted = Object.freeze({
    type: "STAGE_STARTED",
    tick: 0,
    stageId: "cinder-span",
    cutscene: ["봉쇄선 진입"],
  });
  const loreResolved = Object.freeze({
    type: "LORE_SURPRISE_RESOLVED",
    tick: 0,
    tableId: "cinder-span-surprise",
    outcomeId: "ash-echo-whisper",
    text: "옛 교량의 재가 바람에 흩어진다.",
  });
  const tick = () => getRunSnapshot(session.run).tick;

  session.presentCutscene(stageStarted);
  session.presentCutscene(loreResolved);
  const firstOverlay = surface.querySelector("#defense-cutscene-overlay");
  const staleDismiss = firstOverlay
    .querySelector('[data-cutscene-dismiss="true"]')
    .listeners.get("click");
  const openingTick = tick();

  t.mock.timers.tick(0);
  t.mock.timers.tick(cutsceneFromEvent(stageStarted).timing.dismissAfterMs);

  assert.equal(tick(), openingTick, "timer handoff must not require or advance a simulation frame");
  assert.equal(
    surface.querySelector("#defense-cutscene-overlay")?.dataset.captionMode,
    "narration",
    "the first timer must hand off directly to the queued narration",
  );

  staleDismiss();

  assert.equal(
    surface.querySelector("#defense-cutscene-overlay")?.dataset.captionMode,
    "narration",
    "a stale callback owned by the completed overlay must not dismiss the active narration",
  );
  assert.equal(tick(), openingTick, "stale dismissal handling must not advance the simulation");
});

test("BattleSession keeps timer-completed cutscenes paused by user intent until one next-frame tick", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const BattleSession = await loadBattleSession();
  const surface = new TestElement("main");
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    run: createDefenseRun({ stageId: "cinder-span", seed: 73 }),
    surface,
    audio: { consume: noop },
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    stopped: false,
    userPaused: true,
    lastFrameAt: 0,
    accumulator: 0,
    frame: 0,
  });
  session.render = noop;
  t.after(() => stopAndDismissCutscenes(session));

  const dismissAfterMs = 25;
  const tick = () => getRunSnapshot(session.run).tick;
  session.showCutscene({
    eventType: "TEST_CUTSCENE",
    title: "Independent pause",
    captionMode: "dialogue",
    lines: ["Preserve the user's pause."],
    timing: { dismissAfterMs },
  });
  session.loop(1_000);
  const openingTick = tick();

  t.mock.timers.tick(0);
  t.mock.timers.tick(dismissAfterMs);
  assert.equal(
    surface.querySelector("#defense-cutscene-overlay"),
    null,
    "timer completion must remove the final overlay while the user pause remains active",
  );

  session.loop(11_000);
  assert.equal(tick(), openingTick, "completing the final cutscene must not override the user's pause");

  session.userPaused = false;
  session.loop(11_000 + (1_000 / TICK_RATE) + 0.001);
  assert.equal(tick(), openingTick + 1, "clearing user pause must advance exactly one tick on the next frame");
});
