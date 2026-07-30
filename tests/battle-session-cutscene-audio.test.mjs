// BattleSession fixtures below carry `started: true`. Since the unified dock shell landed,
// the frame loop only advances simulation ticks for a run the player actually committed via
// BattleSession.beginRun() -- the persistent battle surface otherwise sits frozen at tick 0
// behind the lobby docks. These tests assert cutscene pause/resume tick semantics, which
// presuppose a live run, so the fixtures declare that state explicitly.
import assert from "node:assert/strict";
import test from "node:test";

import { advanceDefenseRun, createDefenseRun, getRunSnapshot } from "../defense-run-simulation.js";
import { TICK_RATE } from "../defense-catalog.js";
import { cutsceneFromEvent } from "../defense-cutscene.js";
import { DefenseAudio } from "../defense-audio.js";

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

  getBoundingClientRect() {
    return { bottom: 360, height: 360, left: 0, right: 640, top: 0, width: 640, x: 0, y: 0 };
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
  // app.js's module-level initialize() now mounts the persistent battle surface (and with it
  // BattleSession.start() -> resize()) as soon as the module is imported, instead of waiting
  // for a lobby "작전 개시" click. resize() reads the --defense-logical-* custom properties,
  // so this DOM double has to answer getComputedStyle or import raises asynchronously.
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
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

test("BattleSession defers opening cutscenes until beginRun synchronously renders the committed run", async (t) => {
  const BattleSession = await loadBattleSession();
  const audioCalls = [];
  const surface = new TestElement("main");
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    run: createDefenseRun({ stageId: "cinder-span", seed: 1 }),
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
    // The boss-entrance band is constructor state the remount path clears; assembling it here
    // keeps this fixture exercising the real teardown instead of a shape the app never has.
    bossIntroKeys: new Set(),
    bossIntroTimer: null,
    started: false,
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

  const openingEvents = getRunSnapshot(session.run).events;
  const stageStarted = openingEvents.find((event) => event.type === "STAGE_STARTED");
  const loreResolved = openingEvents.find((event) => event.type === "LORE_SURPRISE_RESOLVED");
  assert(stageStarted, "the deterministic opening snapshot must contain authored stage dialogue");
  assert(loreResolved, "the deterministic opening snapshot must contain authored lore");
  const impact = Object.freeze({
    type: "PROJECTILE_IMPACT",
    tick: 0,
    eventId: "impact:0:1",
    targetId: "enemy-1",
  });

  session.render([...openingEvents, impact]);

  assert.equal(surface.querySelector("#defense-cutscene-overlay"), null, "lobby render must not present opening cutscenes");
  assert.equal(session.cutsceneEventKeys.size, 0, "lobby render must not mark opening cutscenes seen");
  assert.equal(countAudioEvents(audioCalls, "PROJECTILE_IMPACT"), 1, "other pre-run event audio remains unchanged");

  await new Promise(setImmediate);
  assert.equal(surface.querySelector("#defense-cutscene-overlay"), null, "the lobby must remain free of opening overlays after deferred startup work");
  assert.equal(session.cutsceneEventKeys.size, 0, "deferred startup work must not mark lobby cutscenes seen");

  session.beginRun();

  assert.equal(surface.querySelector("#defense-cutscene-overlay")?.dataset.cutsceneEvent, "STAGE_STARTED");
  assert.equal(surface.dataset.defenseCutscene, "STAGE_STARTED");
  assert.equal(session.cutsceneEventKeys.size, 2, "beginRun must synchronously key the authored stage and lore cutscenes");
  assert.equal(session.cutsceneQueue.length, 1, "authored lore must queue behind the visible stage dialogue");
  assert.equal(session.cutsceneQueue[0]?.event?.eventId, loreResolved.eventId, "the queued entry must be the real run's authored lore event");
  assert.equal(countAudioEvents(audioCalls, "STAGE_STARTED"), 1, "the stage story event must reach the frame audio batch once");
  assert.equal(countAudioEvents(audioCalls, "PROJECTILE_IMPACT"), 1, "ordinary SFX remains frame-batch-driven");
  assert.equal(countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED"), 1, "queued authored lore must reach the frame audio batch once");

  const queuedLoreEntry = session.cutsceneQueue[0];
  session.consumeCutscenes([loreResolved]);
  assert.equal(session.cutsceneEventKeys.size, 2, "duplicate lore must not create another cutscene key");
  assert.equal(session.cutsceneQueue.length, 1, "duplicate lore must not create another queued entry");
  assert.equal(session.cutsceneQueue[0], queuedLoreEntry, "duplicate lore must preserve the original queued entry");
  assert.equal(countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED"), 1, "cutscene queueing must not replay lore audio");

  session.dismissCutscene();

  assert.equal(surface.querySelector("#defense-cutscene-overlay")?.dataset.cutsceneEvent, "LORE_SURPRISE_RESOLVED");
  assert.equal(surface.dataset.defenseCutscene, "LORE_SURPRISE_RESOLVED");
  assert.equal(countAudioEvents(audioCalls, "LORE_SURPRISE_RESOLVED"), 1, "presenting queued lore must not start a second audio batch");

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

test("BattleSession batches same-frame critical and story audio before presenting the cutscene", async (t) => {
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
    audio: {
      consume(events) {
        audioCalls.push({
          eventIds: events.map((event) => event.eventId),
          overlayVisible: surface.querySelector("#defense-cutscene-overlay") !== null,
        });
      },
    },
    audioTick: null,
    audioEventKeys: new Set(),
    recordedEliteIds: new Set(),
    cutsceneEventKeys: new Set(),
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    started: true,
    stopped: false,
    rallyAcknowledgedBossIds: new Set(),
    motionQuery: { matches: false },
    lastStanceBlockEventId: null,
    lastStanceSwitchEventId: null,
    userPaused: false,
    terminalHandled: false,
    camera: { x: 0, y: 0 },
    questEvents: [],
  });
  session.projected = (snapshot) => snapshot;
  session.updateCamera = () => ({ x: 0, y: 0 });
  session.renderControls = noop;
  session.renderPauseOverlay = noop;
  session.renderWorldHud = noop;
  session.renderEventFeedback = noop;
  t.after(() => stopAndDismissCutscenes(session));

  const criticalHit = Object.freeze({
    type: "CRITICAL_HIT",
    tick: 0,
    eventId: "critical:0:warden",
    targetId: "enemy-1",
  });
  const stageStarted = Object.freeze({
    type: "STAGE_STARTED",
    tick: 0,
    eventId: "stage:0:cinder-span",
    stageId: "cinder-span",
    cutscene: Object.freeze(["봉쇄선 진입"]),
    storyBeat: Object.freeze({
      id: "cinder-span:opening",
      dialogue: Object.freeze({
        speaker: "감시관",
        text: "바람의 방향이 바뀌었다.",
      }),
    }),
  });
  const firstObjective = Object.freeze({
    type: "OBJECTIVE_COMPLETED",
    tick: 0,
    eventId: "objective:0:hold-gate",
    objectiveId: "hold-gate",
  });
  const secondObjective = Object.freeze({
    type: "OBJECTIVE_COMPLETED",
    tick: 0,
    eventId: "objective:0:defeat-boss",
    objectiveId: "defeat-boss",
  });

  session.render([criticalHit, stageStarted, firstObjective, secondObjective]);

  assert.deepEqual(
    audioCalls,
    [{
      eventIds: [
        criticalHit.eventId,
        stageStarted.eventId,
        firstObjective.eventId,
        secondObjective.eventId,
      ],
      overlayVisible: false,
    }],
    "one frame must deliver critical, story, and distinct same-tick objectives in one audio batch before cutscene presentation",
  );
  assert.equal(
    surface.querySelector("#defense-cutscene-overlay")?.dataset.cutsceneEvent,
    "STAGE_STARTED",
    "the story cutscene must still be presented after its audio batch",
  );

  session.dismissCutscene();

  assert.equal(surface.querySelector("#defense-cutscene-overlay"), null, "the story overlay must remain dismissible");
  assert.equal(audioCalls.length, 1, "dismissing the cutscene must not create a second audio consume call");
});

test("BattleSession same-stage remount resets audio before the tick-zero preview", async (t) => {
  const BattleSession = await loadBattleSession();
  const surface = new TestElement("main");
  const playback = [];
  const audio = new DefenseAudio({ reducedMotion: true });
  audio.play = (cueId, event) => {
    playback.push({ method: "play", cueId, eventId: event?.eventId });
    return true;
  };
  audio.narrate = (event) => {
    playback.push({ method: "narrate", eventId: event?.eventId });
    return true;
  };
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    surface,
    canvas: { height: 360, width: 640 },
    statusNode: new TestElement(),
    renderer: { renderSnapshot: noop },
    audio,
    audioTick: null,
    audioEventKeys: new Set(),
    recordedEliteIds: new Set(),
    extractionEvents: [],
    questEvents: [],
    questEventKeys: new Set(),
    questEventKeyGroups: [],
    cutsceneEventKeys: new Set(),
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    cutsceneActive: false,
    feedbackTimer: null,
    started: false,
    stopped: false,
    rallyAcknowledgedBossIds: new Set(),
    motionQuery: { matches: true },
    lastStanceBlockEventId: null,
    lastStanceSwitchEventId: null,
    userPaused: false,
    terminalHandled: false,
    camera: { x: 0, y: 0 },
  });
  session.run = session.createRunForStage(session.stageId);
  session.projected = (snapshot) => snapshot;
  session.updateCamera = () => ({ x: 0, y: 0 });
  session.renderControls = noop;
  session.renderPauseOverlay = noop;
  session.renderWorldHud = noop;
  session.renderEventFeedback = noop;
  session.resetCamera = noop;
  session.resetLobbyShowcase = noop;
  session.syncAppearanceLoadout = noop;
  t.after(() => stopAndDismissCutscenes(session));

  const openingStory = session.run.events.find((event) => event.type === "STAGE_STARTED");
  assert(openingStory, "the stable Cinder run must expose its tick-zero stage story");
  session.run = advanceDefenseRun(session.run, TICK_RATE * 90);
  const highTick = session.run.tick;
  session.render([
    Object.freeze({ ...openingStory, tick: highTick }),
    Object.freeze({
      type: "PROJECTILE_IMPACT",
      tick: highTick,
      eventId: "impact:high:enemy-1",
      targetId: "enemy-1",
    }),
  ]);
  assert.equal(
    playback.filter(({ method, eventId }) => method === "narrate" && eventId === openingStory.eventId).length,
    1,
    "the first run must establish the same-stage story narration identity",
  );

  playback.length = 0;
  session.remountForStage("cinder-span");
  const remountedStory = session.run.events.find((event) => event.type === "STAGE_STARTED");

  assert.equal(remountedStory?.eventId, openingStory.eventId, "same-stage remount must preserve the deterministic story identity");
  assert.equal(
    playback.filter(({ method, eventId }) => method === "narrate" && eventId === openingStory.eventId).length,
    1,
    "the remounted tick-zero preview must narrate the stable story identity again",
  );

  const lowTickImpact = Object.freeze({
    type: "PROJECTILE_IMPACT",
    tick: 0,
    eventId: "impact:low:enemy-2",
    targetId: "enemy-2",
  });
  session.render([lowTickImpact]);

  assert.equal(
    playback.filter(({ method, eventId }) => method === "play" && eventId === lowTickImpact.eventId).length,
    1,
    "a low-tick ordinary cue must remain eligible after the high-tick run remounts",
  );
});

test("BattleSession retains authored stage intro and story dialogue through queued live presentation", async (t) => {
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
    started: true,
    stopped: false,
  });
  t.after(() => stopAndDismissCutscenes(session));

  const openingLore = Object.freeze({
    type: "LORE_SURPRISE_RESOLVED",
    tick: 0,
    tableId: "cinder-span-surprise",
    outcomeId: "ash-echo-whisper",
    text: "옛 교량의 재가 바람에 흩어진다.",
  });
  const stageStarted = Object.freeze({
    type: "STAGE_STARTED",
    tick: 0,
    stageId: "cinder-span",
    cutscene: Object.freeze(["봉쇄선 진입"]),
    storyBeat: Object.freeze({
      dialogue: Object.freeze({
        speaker: "감시관",
        text: "바람의 방향이 바뀌었다.",
      }),
    }),
  });
  const originalStageStarted = structuredClone(stageStarted);

  session.presentCutscene(openingLore);
  session.presentCutscene(stageStarted);

  assert.equal(session.cutsceneQueue.length, 1, "the authored stage event must queue behind the active cutscene");
  assert.equal(session.cutsceneQueue[0]?.event, stageStarted, "the queue must retain the original stage event object");
  assert.deepEqual(stageStarted, originalStageStarted, "queueing must not mutate the authored stage event");

  const queuedStageCutscene = session.cutsceneQueue[0].cutscene;
  assert.deepEqual(
    queuedStageCutscene.lines,
    ["봉쇄선 진입", "바람의 방향이 바뀌었다."],
    "the live BattleSession entry must retain the stage intro and structured story dialogue",
  );

  session.dismissCutscene();
  const overlay = surface.querySelector("#defense-cutscene-overlay");
  const visibleCutsceneLine = () => {
    const pending = [overlay];
    while (pending.length) {
      const node = pending.shift();
      if (node.className === "cutscene-line") return node.textContent;
      pending.unshift(...node.children);
    }
    return null;
  };
  const renderedLines = [visibleCutsceneLine()];
  const storyBeat = queuedStageCutscene.beats[1];
  t.mock.timers.tick(storyBeat.timing.startMs);
  renderedLines.push(visibleCutsceneLine());

  assert.deepEqual(
    renderedLines,
    ["봉쇄선 진입", "바람의 방향이 바뀌었다."],
    "the live overlay must render the intro and story dialogue in sequence",
  );
  assert.equal(renderedLines.filter((line) => line === "봉쇄선 진입").length, 1, "the intro must render once");
  assert.equal(
    renderedLines.filter((line) => line === "바람의 방향이 바뀌었다.").length,
    1,
    "the structured story dialogue must render once",
  );
  assert.deepEqual(stageStarted, originalStageStarted, "live presentation must not mutate the queued source event");
});

test("BattleSession pauses simulation across queued dialogue and narration, then resumes one tick on the next frame", async (t) => {
  const BattleSession = await loadBattleSession();
  const surface = new TestElement("main");
  const session = Object.create(BattleSession.prototype);
  Object.assign(session, {
    stageId: "cinder-span",
    run: createDefenseRun({ stageId: "cinder-span", seed: 73 }),
    runEvents: [],
    surface,
    audio: { consume: noop },
    cutsceneEventKeys: new Set(),
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    started: true,
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
    runEvents: [],
    surface,
    audio: { consume: noop },
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    started: true,
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
    started: true,
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
    runEvents: [],
    surface,
    audio: { consume: noop },
    cutsceneTimer: null,
    cutsceneRelayTimers: [],
    cutsceneQueue: [],
    started: true,
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
