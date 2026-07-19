import assert from "node:assert/strict";
import test from "node:test";

import { setLanguage, translate } from "../i18n.js";
import { TacticalMinimap } from "../tactical-minimap.js";

class TestElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this._textContent = "";
    this.type = "";
    this.id = "";
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return this.parentNode.children[index + 1] ?? null;
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
    this.replaceChildren();
  }

  set className(value) {
    this.setAttribute("class", value);
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

  set innerHTML(value) {
    if (value !== "") throw new Error("The minimap harness only supports clearing innerHTML.");
    this._textContent = "";
    this.replaceChildren();
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, reference) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = reference == null ? -1 : this.children.indexOf(reference);
    child.parentNode = this;
    if (index === -1) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index === -1) throw new Error("Cannot remove a node that is not a child.");
    this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    for (const child of children) this.appendChild(child);
  }

  setAttribute(name, value) {
    const text = String(value);
    this.attributes.set(name, text);
    if (name === "id") this.id = text;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type);
    listeners?.delete(listener);
    if (listeners?.size === 0) this.listeners.delete(type);
  }

  dispatch(type, init = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...init,
    };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    return event;
  }

  click(init = {}) {
    return this.dispatch("click", init);
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.dispatch("focus");
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class RecordingContext2D {
  constructor() {
    this.arcs = [];
    this.fillRects = [];
    this.strokeRects = [];
    this.scales = [];
  }

  save() {}
  restore() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  fill() {}
  stroke() {}

  scale(x, y) {
    this.scales.push({ x, y });
  }

  arc(x, y, radius, start, end) {
    this.arcs.push({ x, y, radius, start, end });
  }

  fillRect(x, y, width, height) {
    this.fillRects.push({ x, y, width, height });
  }

  strokeRect(x, y, width, height) {
    this.strokeRects.push({ x, y, width, height });
  }

  resetGeometry() {
    this.arcs = [];
    this.fillRects = [];
    this.strokeRects = [];
    this.scales = [];
  }
}

class TestCanvas extends TestElement {
  constructor(ownerDocument, context) {
    super("canvas", ownerDocument);
    this.context = context;
    this.width = 0;
    this.height = 0;
    this.rect = { left: 0, top: 0, width: 240, height: 120 };
  }

  getContext(kind) {
    assert.equal(kind, "2d");
    return this.context;
  }

  getBoundingClientRect() {
    return { ...this.rect };
  }
}

function descendants(root) {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

function createHarness({ dpr = 1, width = 240, height = 120, left = 0, top = 0 } = {}) {
  const context = new RecordingContext2D();
  const document = {
    activeElement: null,
    documentElement: { lang: "" },
    createElement(tagName) {
      return new TestElement(tagName, document);
    },
    getElementById(id) {
      return [root, ...descendants(root)].find((element) => element.id === id) ?? null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  const root = new TestElement("section", document);
  const canvas = new TestCanvas(document, context);
  canvas.rect = { left, top, width, height };
  const hint = new TestElement("p", document);
  hint.setAttribute("id", "battle-minimap-hint");
  root.appendChild(canvas);
  root.appendChild(hint);

  const observers = [];
  class TestResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = new Set();
      this.disconnected = false;
      observers.push(this);
    }

    observe(element) {
      this.observed.add(element);
    }

    disconnect() {
      this.disconnected = true;
      this.observed.clear();
    }

    trigger() {
      if (!this.disconnected) this.callback();
    }
  }

  const storage = new Map();
  const window = {
    devicePixelRatio: dpr,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    matchMedia: () => ({ matches: false }),
    dispatchEvent() {},
  };

  const names = ["document", "window", "ResizeObserver", "CustomEvent"];
  const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperties(globalThis, {
    document: { configurable: true, writable: true, value: document },
    window: { configurable: true, writable: true, value: window },
    ResizeObserver: { configurable: true, writable: true, value: TestResizeObserver },
    CustomEvent: {
      configurable: true,
      writable: true,
      value: class CustomEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      },
    },
  });

  return {
    canvas,
    context,
    document,
    hint,
    observers,
    root,
    window,
    restore() {
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

function snapshot({ anchors = {}, deployments = [], focus = null } = {}) {
  return {
    navigation: {
      cells: [],
      anchors,
      routes: [],
      zones: [],
    },
    deployments,
    focus,
    units: [],
  };
}

function overlayButtons(root) {
  return descendants(root).filter((element) => element.tagName === "BUTTON");
}

function landmarkSnapshot() {
  return snapshot({
    anchors: {
      portal: { x: 1.9, y: 2.1 },
      boss: { x: 22, y: 10 },
      extractor: { x: 8, y: 4 },
      nodes: [{ x: 5, y: 6 }, { x: 6.8, y: 7.2 }],
    },
    deployments: [
      { kind: "tower", cell: { x: 3.9, y: 9.1 } },
      { kind: "barricade", x: 14.2, y: 1.8 },
    ],
  });
}

test("TacticalMinimap rejects anything other than a canvas", () => {
  assert.throws(
    () => new TacticalMinimap(null),
    /TacticalMinimap requires a valid canvas element\./,
  );
  assert.throws(
    () => new TacticalMinimap({ tagName: "DIV" }),
    /TacticalMinimap requires a valid canvas element\./,
  );
});

test("keyboard arrows clamp to the 24x12 grid and Enter or Space requests the clamped cell", () => {
  const harness = createHarness();
  const requests = [];
  const minimap = new TacticalMinimap(harness.canvas, {
    reducedMotion: true,
    onFocusRequest: (cell) => requests.push(cell),
  });

  try {
    for (let index = 0; index < 30; index += 1) {
      harness.canvas.dispatch("keydown", { key: "ArrowLeft" });
      harness.canvas.dispatch("keydown", { key: "ArrowUp" });
    }
    const enter = harness.canvas.dispatch("keydown", { key: "Enter" });

    for (let index = 0; index < 30; index += 1) {
      harness.canvas.dispatch("keydown", { key: "ArrowRight" });
      harness.canvas.dispatch("keydown", { key: "ArrowDown" });
    }
    const space = harness.canvas.dispatch("keydown", { key: " " });

    assert.deepEqual(requests, [{ x: 0, y: 0 }, { x: 23, y: 11 }]);
    assert.equal(enter.defaultPrevented, true, "Enter must not leak its native activation behavior");
    assert.equal(space.defaultPrevented, true, "Space must not scroll the page while activating the cell");
  } finally {
    minimap.destroy();
    harness.restore();
  }
});

test("canvas clicks convert pointer coordinates to grid cells and clamp outside clicks", () => {
  const harness = createHarness({ left: 40, top: 30 });
  const requests = [];
  const minimap = new TacticalMinimap(harness.canvas, {
    reducedMotion: true,
    onFocusRequest: (cell) => requests.push(cell),
  });

  try {
    harness.canvas.click({ clientX: 115, clientY: 65 });
    harness.canvas.click({ clientX: 1_000, clientY: 1_000 });

    assert.deepEqual(requests, [{ x: 7, y: 3 }, { x: 23, y: 11 }]);
  } finally {
    minimap.destroy();
    harness.restore();
  }
});

test("canvas focus announces the active cell and landmark only in the active locale", () => {
  for (const localeCase of [
    {
      locale: "ko",
      message: "초점 칸: X 12, Y 5 · 아군 차원문",
      wrongLocale: /Focus cell|Allied Portal/,
    },
    {
      locale: "en",
      message: "Focus cell: X 12, Y 5 · Allied Portal",
      wrongLocale: /초점 칸|아군 차원문/,
    },
  ]) {
    const harness = createHarness();
    setLanguage(localeCase.locale);
    const minimap = new TacticalMinimap(harness.canvas, { reducedMotion: true });

    try {
      minimap.update(snapshot({ anchors: { portal: { x: 12, y: 5 } } }));
      harness.canvas.focus();
      const liveStatus = descendants(harness.root).find(
        (element) => element.getAttribute("aria-live") === "polite",
      );

      assert.equal(liveStatus?.textContent, localeCase.message);
      assert.equal(liveStatus?.getAttribute("aria-atomic"), "true");
      assert.equal(
        harness.hint.textContent,
        `${translate("battle.minimapHint", localeCase.locale)} (${localeCase.message})`,
      );
      assert.doesNotMatch(liveStatus.textContent, localeCase.wrongLocale);
    } finally {
      minimap.destroy();
      harness.restore();
    }
  }
});

test("reduced motion keeps the exact focus reticle but omits animated pulse geometry", () => {
  const harness = createHarness();
  const minimap = new TacticalMinimap(harness.canvas, { reducedMotion: true });

  try {
    minimap.update(snapshot({ focus: { x: 2, y: 3 } }));

    const staticReticle = harness.context.strokeRects.find(
      (rect) => rect.x === 20 && rect.y === 30 && rect.width === 10 && rect.height === 10,
    );
    const expandingPulse = harness.context.strokeRects.find(
      (rect) => rect.x < 20 || rect.y < 30 || rect.width > 10 || rect.height > 10,
    );
    assert.deepEqual(staticReticle, { x: 20, y: 30, width: 10, height: 10 });
    assert.equal(expandingPulse, undefined, "reduced motion must not draw the time-varying outer pulse");
  } finally {
    minimap.destroy();
    harness.restore();
  }
});

test("resize applies measured CSS size and DPR while preserving the 24x12 projection", () => {
  const harness = createHarness({ dpr: 2, width: 300, height: 120 });
  const minimap = new TacticalMinimap(harness.canvas, { reducedMotion: true });

  try {
    assert.deepEqual(
      {
        bitmap: [harness.canvas.width, harness.canvas.height],
        css: [harness.canvas.style.width, harness.canvas.style.height],
        firstCellCenter: minimap.gridToMinimap(0, 0),
      },
      {
        bitmap: [600, 240],
        css: ["300px", "120px"],
        firstCellCenter: { x: 35, y: 5 },
      },
    );

    harness.canvas.rect = { left: 0, top: 0, width: 480, height: 240 };
    harness.window.devicePixelRatio = 1.5;
    harness.observers[0].trigger();

    assert.deepEqual(
      {
        bitmap: [harness.canvas.width, harness.canvas.height],
        css: [harness.canvas.style.width, harness.canvas.style.height],
        firstCellCenter: minimap.gridToMinimap(0, 0),
      },
      {
        bitmap: [720, 360],
        css: ["480px", "240px"],
        firstCellCenter: { x: 10, y: 10 },
      },
    );
  } finally {
    minimap.destroy();
    harness.restore();
  }
});

test("snapshot updates replace stale accessible landmarks and redraw new landmark geometry", () => {
  const harness = createHarness();
  setLanguage("en");
  const minimap = new TacticalMinimap(harness.canvas, { reducedMotion: true });

  try {
    minimap.update(snapshot({ anchors: { portal: { x: 2, y: 1 } } }));
    const staleButton = overlayButtons(harness.root)[0];
    assert.equal(staleButton.textContent, "Allied Portal (X: 2, Y: 1)");

    harness.context.resetGeometry();
    minimap.update(snapshot({ anchors: { boss: { x: 20, y: 10 } } }));
    const currentButtons = overlayButtons(harness.root);

    assert.equal(staleButton.parentNode, null, "replaced snapshot controls must leave the accessibility tree");
    assert.deepEqual(currentButtons.map((button) => button.textContent), ["Enemy Boss (X: 20, Y: 10)"]);
    assert.deepEqual(harness.context.arcs.at(-1), {
      x: 205,
      y: 105,
      radius: 5,
      start: 0,
      end: Math.PI * 2,
    });
  } finally {
    minimap.destroy();
    harness.restore();
  }
});

test("destroy removes events, disconnects resize observation, and removes generated DOM", () => {
  const harness = createHarness();
  setLanguage("en");
  const requests = [];
  const minimap = new TacticalMinimap(harness.canvas, {
    reducedMotion: true,
    onFocusRequest: (cell) => requests.push(cell),
  });
  minimap.update(snapshot({ anchors: { portal: { x: 1, y: 1 } } }));
  harness.canvas.focus();
  const generated = harness.root.children.filter((element) => element !== harness.canvas && element !== harness.hint);
  const observer = harness.observers[0];

  try {
    assert.equal(generated.length, 2, "update and focus must create overlay and live-status DOM before cleanup");
    minimap.destroy();

    assert.equal(observer.disconnected, true);
    assert.deepEqual(harness.root.children, [harness.canvas, harness.hint]);
    assert.ok(generated.every((element) => element.parentNode === null));
    assert.deepEqual(
      ["keydown", "click", "focus"].map((type) => harness.canvas.listenerCount(type)),
      [0, 0, 0],
    );

    harness.canvas.click({ clientX: 15, clientY: 15 });
    harness.canvas.dispatch("keydown", { key: "Enter" });
    observer.trigger();
    assert.deepEqual(requests, [], "destroyed minimaps must not respond to former input or resize sources");
  } finally {
    minimap.destroy();
    harness.restore();
  }
});

test("accessible overlay exposes every landmark and deployment as working English buttons", () => {
  const harness = createHarness();
  setLanguage("en");
  const requests = [];
  const minimap = new TacticalMinimap(harness.canvas, {
    reducedMotion: true,
    onFocusRequest: (cell) => requests.push(cell),
  });

  try {
    minimap.update(landmarkSnapshot());
    const buttons = overlayButtons(harness.root);
    const labels = buttons.map((button) => button.textContent);
    const expectedLabels = [
      "Allied Portal (X: 1, Y: 2)",
      "Enemy Boss (X: 22, Y: 10)",
      "Resource Extractor (X: 8, Y: 4)",
      "Tactical Node 1 (X: 5, Y: 6)",
      "Tactical Node 2 (X: 6, Y: 7)",
      "Defense Tower at (X: 3, Y: 9)",
      "Barricade at (X: 14, Y: 1)",
    ];

    assert.deepEqual(labels, expectedLabels);
    assert.ok(buttons.every((button) => button.type === "button"));
    assert.ok(labels.every((label) => !/[가-힣]/u.test(label)), "English controls must not expose Korean labels");

    for (const button of buttons) button.click();
    assert.deepEqual(requests, [
      { x: 1, y: 2 },
      { x: 22, y: 10 },
      { x: 8, y: 4 },
      { x: 5, y: 6 },
      { x: 6, y: 7 },
      { x: 3, y: 9 },
      { x: 14, y: 1 },
    ]);
    assert.strictEqual(harness.document.activeElement, harness.canvas);
  } finally {
    minimap.destroy();
    harness.restore();
  }
});

test("accessible overlay exposes every landmark and deployment only in Korean when Korean is active", () => {
  const harness = createHarness();
  setLanguage("ko");
  const minimap = new TacticalMinimap(harness.canvas, { reducedMotion: true });

  try {
    minimap.update(landmarkSnapshot());
    const labels = overlayButtons(harness.root).map((button) => button.textContent);
    const expectedLabels = [
      "아군 차원문 (X: 1, Y: 2)",
      "적 보스 (X: 22, Y: 10)",
      "자원 추출기 (X: 8, Y: 4)",
      "전술 거점 1 (X: 5, Y: 6)",
      "전술 거점 2 (X: 6, Y: 7)",
      "방어 타워 위치 (X: 3, Y: 9)",
      "바리케이드 위치 (X: 14, Y: 1)",
    ];

    assert.deepEqual(labels, expectedLabels);
    assert.ok(
      labels.every((label) => !/Allied Portal|Enemy Boss|Resource Extractor|Tactical Node|Defense Tower|Barricade/.test(label)),
      "Korean controls must not expose English labels",
    );
  } finally {
    minimap.destroy();
    harness.restore();
  }
});
