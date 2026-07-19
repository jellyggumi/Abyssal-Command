import assert from "node:assert/strict";
import test from "node:test";

import { ObjectFeedbackLayer } from "../object-feedback-layer.js";

function makeContext() {
  const calls = [];
  const stack = [];
  const context = {
    calls,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    save() {
      stack.push({
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
        globalAlpha: this.globalAlpha,
      });
      calls.push({ op: "save" });
    },
    restore() {
      Object.assign(this, stack.pop());
      calls.push({ op: "restore" });
    },
    clearRect(x, y, width, height) {
      calls.push({ op: "clearRect", x, y, width, height });
    },
    scale(x, y) {
      calls.push({ op: "scale", x, y });
    },
    fillRect(x, y, width, height) {
      calls.push({ op: "fillRect", x, y, width, height, fillStyle: this.fillStyle });
    },
    fillText(text, x, y) {
      calls.push({
        op: "fillText",
        text,
        x,
        y,
        fillStyle: this.fillStyle,
        font: this.font,
        globalAlpha: this.globalAlpha,
      });
    },
    strokeText(text, x, y) {
      calls.push({
        op: "strokeText",
        text,
        x,
        y,
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
      });
    },
    measureText(text) {
      return { width: String(text).length * 6 };
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    fill() {},
    stroke() {},
    resetCalls() {
      calls.length = 0;
    },
  };
  return context;
}

function makeCanvas({ width = 320, height = 180 } = {}) {
  const context = makeContext();
  return {
    context,
    clientWidth: width,
    clientHeight: height,
    width: 0,
    height: 0,
    getContext(kind) {
      assert.equal(kind, "2d", "the shared overlay must request one 2D drawing context");
      return context;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
    },
  };
}

function makeLayer(t, {
  width = 320,
  height = 180,
  devicePixelRatio = 1,
  ...options
} = {}) {
  const priorWindow = globalThis.window;
  const addedListeners = [];
  const removedListeners = [];
  globalThis.window = {
    devicePixelRatio,
    matchMedia: () => ({ matches: false }),
    addEventListener(type, listener) {
      addedListeners.push({ type, listener });
    },
    removeEventListener(type, listener) {
      removedListeners.push({ type, listener });
    },
  };

  const canvas = makeCanvas({ width, height });
  const layer = new ObjectFeedbackLayer(canvas, options);
  t.after(() => {
    layer.destroy();
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  });
  return { layer, canvas, context: canvas.context, addedListeners, removedListeners };
}

function visibleText(context) {
  return context.calls
    .filter((call) => call.op === "fillText")
    .map((call) => call.text);
}

function projectAt(x = 160, y = 100, depth = 0) {
  return () => ({ x, y, depth, visible: true });
}

test("ObjectFeedbackLayer keeps speech and exchange storage bounded during event storms", (t) => {
  const { layer } = makeLayer(t, {
    maxSpeech: 3,
    maxExchanges: 4,
    dedupeWindow: 1,
    minSpeechInterval: 1,
  });

  for (let index = 0; index < 10; index += 1) {
    layer.emitSpeech(`speaker-${index}`, `line-${index}`, { now: index });
    layer.emitExchange("commander", `target-${index}`, index + 1, "outgoing", { now: index });
  }

  const snapshot = layer.snapshot();
  assert.deepEqual(
    snapshot.speech.map(({ text }) => text).sort(),
    ["line-7", "line-8", "line-9"],
    "a speech storm must retain only the newest records within the configured capacity",
  );
  assert.deepEqual(
    snapshot.exchanges.map(({ value }) => value).sort((left, right) => left - right),
    [7, 8, 9, 10],
    "an exchange storm must retain only the newest records within the configured capacity",
  );
});

test("ObjectFeedbackLayer culls deterministically while preserving selected, boss, and low-HP cues", (t) => {
  const { layer, context } = makeLayer(t, { maxVisible: 3 });
  layer.reconcile([
    { id: "normal-a", kind: "enemy", label: "Normal A", hp: 80, maxHp: 100 },
    { id: "selected", kind: "ally", label: "Selected", hp: 80, maxHp: 100, selected: true },
    { id: "normal-b", kind: "enemy", label: "Normal B", hp: 80, maxHp: 100, priority: 20 },
    { id: "boss", kind: "boss", label: "Boss", hp: 80, maxHp: 100 },
    { id: "low", kind: "enemy", label: "Low", hp: 30, maxHp: 100 },
  ], { silent: true });

  layer.render(projectAt(), 1000);
  const firstFrame = visibleText(context);
  context.resetCalls();
  layer.render(projectAt(), 1000);
  const secondFrame = visibleText(context);

  assert.deepEqual(
    firstFrame,
    ["LOW", "BOSS", "SELECTED"],
    "the visible budget must keep urgent combat cues and paint the highest-priority cue last",
  );
  assert.deepEqual(
    secondFrame,
    firstFrame,
    "identical projections must produce the same culling and paint order",
  );
});

test("ObjectFeedbackLayer draws a compact HP ratio and exact status abbreviations", (t) => {
  const { layer, context } = makeLayer(t);
  layer.reconcile([
    {
      id: "commander",
      kind: "commander",
      label: "Rhea",
      hp: 25,
      maxHp: 100,
      statuses: ["stunned", "shielded"],
    },
  ], { silent: true });

  layer.render(projectAt(), 1000);

  assert.deepEqual(
    visibleText(context),
    ["RHEA", "STN", "SHD"],
    "the badge must identify the anchor and render legible status chips",
  );
  assert.deepEqual(
    context.calls
      .filter((call) => call.op === "fillRect" && call.height === 4)
      .map(({ width }) => width),
    [50, 12.5],
    "the HP fill must represent 25 of 100 against the compact bar background",
  );
});

test("ObjectFeedbackLayer deduplicates repeated utterances and enforces per-object cooldowns from time zero", (t) => {
  const { layer } = makeLayer(t, {
    dedupeWindow: 1000,
    minSpeechInterval: 500,
    maxSpeech: 4,
  });

  assert.equal(layer.emitSpeech("commander", "Hold!", { now: 0 }), true);
  assert.equal(layer.emitSpeech("commander", "Hold!", { now: 100 }), false);
  assert.equal(layer.emitSpeech("commander", "Advance!", { now: 499 }), false);
  assert.equal(layer.emitSpeech("commander", "Advance!", { now: 500 }), true);
  assert.deepEqual(
    layer.snapshot().speech.map(({ text }) => text),
    ["Hold!", "Advance!"],
    "only the first utterance and the first post-cooldown utterance must remain active",
  );
});

test("ObjectFeedbackLayer distinguishes simultaneous outgoing, incoming, and healing values", (t) => {
  const { layer, context } = makeLayer(t);
  layer.reconcile([
    { id: "unit", kind: "ally", label: "Unit", hp: 70, maxHp: 100 },
  ], { silent: true });
  layer.emitExchange("commander", "unit", 17, "outgoing", { now: 1000 });
  layer.emitExchange("enemy", "unit", 9, "incoming", { now: 1000 });
  layer.emitExchange("unit", "unit", 6, "heal", { now: 1000 });

  layer.render(projectAt(), 1000);
  const values = context.calls.filter((call) => call.op === "fillText" && /^[+-]/.test(call.text));

  assert.deepEqual(
    values.map(({ text, fillStyle }) => ({ text, fillStyle })),
    [
      { text: "-17", fillStyle: "#e06156" },
      { text: "-9", fillStyle: "#b388ff" },
      { text: "+6", fillStyle: "#71d8c6" },
    ],
    "damage, incoming hits, and healing must retain distinct semantic signs and colors",
  );
  assert.deepEqual(
    values.map(({ y }) => y),
    [90, 76, 62],
    "simultaneous values on one anchor must remain individually legible",
  );
});

test("ObjectFeedbackLayer resizes and projects in CSS pixels under a clamped DPR", (t) => {
  const { layer, canvas, context } = makeLayer(t, {
    width: 240,
    height: 120,
    devicePixelRatio: 3,
    dprClamp: 2,
  });
  layer.reconcile([
    { id: "edge", kind: "enemy", label: "Edge", hp: 50, maxHp: 100 },
  ], { silent: true });

  layer.render(projectAt(3, 117), 1000);
  const [object] = layer.snapshot().objects;

  assert.deepEqual(
    { width: canvas.width, height: canvas.height },
    { width: 480, height: 240 },
    "the backing store must resize to CSS dimensions times the clamped DPR",
  );
  assert.deepEqual(
    { x: object.screenX, y: object.screenY },
    { x: 40, y: 90 },
    "projection must clamp anchors within the logical CSS-pixel viewport",
  );
  assert.deepEqual(
    context.calls.find((call) => call.op === "scale"),
    { op: "scale", x: 2, y: 2 },
    "the draw transform must map logical projection coordinates to the DPR backing store",
  );
});

test("ObjectFeedbackLayer reduced-motion mode keeps values legible without travel or fade", (t) => {
  const { layer, context } = makeLayer(t, {
    reducedMotion: true,
    speechDuration: 1000,
    exchangeDuration: 1000,
  });
  layer.reconcile([
    { id: "unit", kind: "ally", label: "Unit", hp: 80, maxHp: 100 },
  ], { silent: true });
  layer.emitSpeech("unit", "Brace", { now: 2000 });
  layer.emitExchange("enemy", "unit", 8, "incoming", { now: 2000 });

  layer.render(projectAt(), 2000);
  const firstFrame = context.calls
    .filter((call) => call.op === "fillText" && ["Brace", "-8"].includes(call.text))
    .map(({ text, y, globalAlpha }) => ({ text, y, globalAlpha }));
  context.resetCalls();
  layer.render(projectAt(), 2500);
  const secondFrame = context.calls
    .filter((call) => call.op === "fillText" && ["Brace", "-8"].includes(call.text))
    .map(({ text, y, globalAlpha }) => ({ text, y, globalAlpha }));

  assert.deepEqual(secondFrame, firstFrame, "reduced motion must suppress floating travel and fading");
  assert.deepEqual(
    secondFrame.map(({ text, globalAlpha }) => ({ text, globalAlpha })),
    [
      { text: "Brace", globalAlpha: 1 },
      { text: "-8", globalAlpha: 1 },
    ],
    "reduced motion must preserve fully legible utterance and combat values",
  );
});

test("ObjectFeedbackLayer silent reconciliation drops stale anchors and feedback without replay", (t) => {
  const { layer } = makeLayer(t);
  layer.reconcile([
    { id: "stale", kind: "enemy", label: "Stale", hp: 10, maxHp: 100 },
  ], { silent: true });
  layer.emitSpeech("stale", "Old warning", { now: 2000 });
  layer.emitExchange("commander", "stale", 12, "outgoing", { now: 2000 });

  const restoredSnapshot = [
    { id: "fresh", kind: "ally", label: "Fresh", hp: 90, maxHp: 100, statuses: ["haste"] },
  ];
  layer.reconcile(restoredSnapshot, { silent: true });
  layer.reconcile(restoredSnapshot, { silent: true });

  const snapshot = layer.snapshot();
  assert.deepEqual(
    snapshot.objects.map(({ id, hp, statuses }) => ({ id, hp, statuses })),
    [{ id: "fresh", hp: 90, statuses: ["haste"] }],
    "restore reconciliation must replace stale anchors with authoritative snapshot state",
  );
  assert.deepEqual(snapshot.speech, [], "restore reconciliation must not retain stale utterances");
  assert.deepEqual(snapshot.exchanges, [], "restore reconciliation must not retain stale combat values");
});

test("ObjectFeedbackLayer destroy is idempotent and all post-destroy operations are inert", (t) => {
  const { layer, canvas, context, addedListeners, removedListeners } = makeLayer(t);
  layer.reconcile([
    { id: "unit", kind: "ally", label: "Unit", hp: 80, maxHp: 100 },
  ], { silent: true });
  const bufferBeforeDestroy = { width: canvas.width, height: canvas.height };

  layer.destroy();
  layer.destroy();
  const callsAfterDestroy = context.calls.length;

  assert.equal(layer.emitSpeech("unit", "Ignored", { now: 1000 }), false);
  assert.equal(layer.emitExchange("unit", "unit", 5, "heal", { now: 1000 }), false);
  assert.equal(layer.reconcile([], { silent: true }), undefined);
  assert.equal(layer.resize(), undefined);
  assert.equal(layer.render(projectAt(), 1000), undefined);
  assert.equal(layer.clear(), undefined);

  assert.deepEqual(layer.snapshot(), { destroyed: true }, "destroy must expose a terminal empty state");
  assert.deepEqual(
    removedListeners,
    addedListeners,
    "destroying twice must unregister the shared resize listener exactly once",
  );
  assert.equal(context.calls.length, callsAfterDestroy, "post-destroy calls must not touch the drawing context");
  assert.deepEqual(
    { width: canvas.width, height: canvas.height },
    bufferBeforeDestroy,
    "post-destroy resize must not mutate the detached backing store",
  );
});
