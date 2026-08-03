const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { after, afterEach, before, test } = require("node:test");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const PHONE_VIEWPORT = Object.freeze({ width: 390, height: 844 });
const COMPACT_PHONE_VIEWPORT = Object.freeze({ width: 320, height: 568 });
const DESKTOP_VIEWPORT = Object.freeze({ width: 1440, height: 900 });
const MIN_PHONE_PANEL_WIDTH = 144;
const MAX_PHONE_TOP_RATIO = 0.38;

let browser;
let hosting;

function staticServer() {
  const host = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).slice(1);
    const file = path.resolve(ROOT, relativePath);
    if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      const extension = path.extname(file);
      const contentType = extension === ".js" || extension === ".mjs"
        ? "text/javascript"
        : extension === ".css"
          ? "text/css"
          : extension === ".json"
            ? "application/json"
            : extension === ".html"
              ? "text/html"
              : "application/octet-stream";
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType });
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host,
    url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

async function openUi(viewport, { forceCanvasMotionProbe = false, reducedMotion = "reduce", syntheticFrames = false } = {}) {
  const context = await browser.newContext({ baseURL: hosting.url, reducedMotion, viewport });
  // Every CI failure in this file has been a 30000 ms timeout -- Playwright's DEFAULT, never an
  // assertion. Runs #14 and #15 lost test 10, run #16 lost test 3: a different test each time,
  // which is a suite racing the clock rather than three separate bugs. The runner measures
  // rafMean ~95.8 ms against ~16 ms locally (~6x slower, ~10 fps), and this suite took 253 s for
  // 12 tests in #15. Tests that wait on `dataset.defenseMove` / `defenseState` need input to
  // round-trip through the simulation tick, so they starve first.
  //
  // 90 s restores the original headroom at that measured slowdown without making a genuine hang
  // invisible. Set on the context so it covers all nine waitForFunction sites and every locator
  // auto-wait at once. The explicit `{ timeout: 2400 }` at the feedback-clear probe is a
  // deliberate tight bound and is preserved -- an explicit timeout wins over the default.
  context.setDefaultTimeout(90_000);
  try {
    const page = await context.newPage();
    if (forceCanvasMotionProbe) {
      await page.addInitScript(() => {
        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
          if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
          return nativeGetContext.call(this, type, ...args);
        };
        const nativeMediaQueryListener = MediaQueryList.prototype.addEventListener;
        MediaQueryList.prototype.addEventListener = function addEventListener(type, listener, options) {
          if (type === "change" && this.media === "(prefers-reduced-motion: reduce)") {
            window.__appReducedMotionQuery = this;
          }
          return nativeMediaQueryListener.call(this, type, listener, options);
        };
        const nativeSetLineDash = CanvasRenderingContext2D.prototype.setLineDash;
        window.__canvasLineDashCalls = [];
        CanvasRenderingContext2D.prototype.setLineDash = function setLineDash(segments) {
          window.__canvasLineDashCalls.push([...segments]);
          if (window.__canvasLineDashCalls.length > 64) window.__canvasLineDashCalls.shift();
          return nativeSetLineDash.call(this, segments);
        };
      });
    }
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });

    if (syntheticFrames) {
      await page.addInitScript(() => {
        const callbacks = new Map();
        let nextId = 1;
        let now = 0;
        window.requestAnimationFrame = (callback) => {
          const id = nextId++;
          callbacks.set(id, callback);
          return id;
        };
        window.cancelAnimationFrame = (id) => callbacks.delete(id);
        window.__pumpDefenseFrame = (deltaMs) => {
          now += deltaMs;
          const pending = [...callbacks.values()];
          callbacks.clear();
          pending.forEach((callback) => callback(now));
          return now;
        };
      });
    }
    // `domcontentloaded`, not `networkidle`: app.js:4347 registers the service worker with
    // `updateViaCache: "none"`, so loads revalidate over the network while a continuous WebGL
    // RAF loop keeps the page busy; on a slow CI runner the 500 ms quiet window may never open.
    // This file failed in BOTH run #15 (test 10) and run #16 (test 3) -- different assertions
    // each time, which is the signature of a fragile wait rather than a broken contract.
    // The next line waits on `[data-defense-ready="true"]`, the app's explicit readiness signal.
    // `load`, not `domcontentloaded`: this suite measures STYLED geometry (control rects,
    // heading columns, 44px targets), and DCL does not wait for stylesheets. That gap cost
    // runs #17 and #18 in progression-mobile-ui-browser.cjs -- see its goto for the full
    // reasoning. `load` is a strict superset of DCL, so it cannot regress a passing test
    // except by timeout, and setDefaultTimeout(90_000) covers that.
    await page.goto("/index.html", { waitUntil: "load" });
    const surface = page.locator('#defense-battle-surface[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    assert.equal(await surface.getAttribute("data-stage-id"), "cinder-span", "a fresh browser must select Cinder Span");
    return { browserErrors, context, page, surface };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function launchCinder(viewport, options) {
  const run = await openUi(viewport, options);
  try {
    await run.page.locator("#start-defense").click();
    await run.surface.evaluate((node) => {
      if (node.dataset.defenseStarted !== "true") throw new Error("the launch control did not start the run");
    });

    const overlay = run.page.locator("#defense-cutscene-overlay");
    await overlay.waitFor({ state: "visible" });
    const dismissedCutscenes = [];
    for (let index = 0; index < 4; index += 1) {
      const dismiss = run.page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
      if (await dismiss.count() === 0 || !(await dismiss.isVisible())) break;
      dismissedCutscenes.push(await overlay.getAttribute("data-cutscene-event"));
      await dismiss.click();
      await run.page.waitForTimeout(25);
    }
    await overlay.waitFor({ state: "detached" });
    assert.equal(dismissedCutscenes[0], "STAGE_STARTED", "the Cinder opening cutscene must be explicitly dismissed");

    return { ...run, dismissedCutscenes };
  } catch (error) {
    await run.context.close();
    throw error;
  }
}

async function measureHud(page) {
  return page.evaluate(() => {
    const required = (selector) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`missing HUD node: ${selector}`);
      return node;
    };
    const box = (node) => {
      const bounds = node.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        height: bounds.height,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      };
    };
    const isVisible = (node) => {
      const style = getComputedStyle(node);
      const bounds = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && bounds.width > 0 && bounds.height > 0;
    };
    const heading = (selector) => {
      const node = required(selector);
      const style = getComputedStyle(node);
      const range = document.createRange();
      range.selectNodeContents(node);
      const lineTops = [...range.getClientRects()].map(({ top }) => Math.round(top * 10) / 10);
      // Column room is a LAYOUT property, so it is measured from the space the heading is given,
      // not from the width of whatever string happens to be rendered at that instant. These
      // headings are inline elements whose own box is exactly their text: measuring that made the
      // assertion depend on which label the run had reached -- "작전 개시 · 관문 방어" (11 glyphs)
      // early, "관문 방어" (4) a few seconds later -- so the same layout passed or failed purely on
      // timing. The container's content box is the room the label actually has.
      const container = node.parentElement ?? node;
      const containerStyle = getComputedStyle(container);
      const containerWidth = container.getBoundingClientRect().width
        - Number.parseFloat(containerStyle.paddingLeft || "0")
        - Number.parseFloat(containerStyle.paddingRight || "0");
      return {
        box: box(node),
        characterColumns: containerWidth / Number.parseFloat(style.fontSize),
        textColumns: node.getBoundingClientRect().width / Number.parseFloat(style.fontSize),
        fontSize: Number.parseFloat(style.fontSize),
        lineCount: new Set(lineTops).size,
        text: node.textContent.trim(),
        visible: isVisible(node),
      };
    };

    const surface = required("#defense-battle-surface");
    const canvas = required("#defense-canvas");
    const top = required(".defense-top");
    const bottom = required(".defense-bottom");
    const mission = required(".hud-mission");
    const runState = required(".hud-loop-state");
    const objective = required(".objective-chip");
    const movement = required("#movement-actions");
    const health = required(".gate-panel");
    const combat = required("#combat-input-cluster");
    const actions = required("#battle-actions");
    const panelBoxes = {
      mission: box(mission),
      objective: box(objective),
      runState: box(runState),
    };
    const topValues = Object.values(panelBoxes).map(({ top: panelTop }) => panelTop);
    const topBox = box(top);
    const bottomBox = box(bottom);
    const exposedPoint = {
      x: window.innerWidth / 2,
      y: topBox.bottom + Math.max(0, bottomBox.top - topBox.bottom) / 2,
    };
    const exposedNode = document.elementFromPoint(exposedPoint.x, exposedPoint.y);
    const bottomButtons = [...bottom.querySelectorAll("button")].map((node) => ({
      box: box(node),
      label: node.getAttribute("aria-label") || node.textContent.trim(),
      visible: isVisible(node),
    }));

    return {
      battlefield: {
        bottom: bottomBox,
        canvas: box(canvas),
        exposedHeight: bottomBox.top - topBox.bottom,
        exposedPoint: {
          ...exposedPoint,
          hit: exposedNode?.id || exposedNode?.className || exposedNode?.tagName || null,
          hitsHud: Boolean(exposedNode?.closest("#defense-edge-hud")),
          hitsSurface: Boolean(exposedNode && surface.contains(exposedNode)),
        },
        surface: box(surface),
      },
      bottomControls: {
        box: bottomBox,
        buttons: bottomButtons,
        movement: box(movement),
        movementButtonCount: movement.querySelectorAll("[data-move]").length,
        requiredControls: Object.fromEntries(["#manual-attack", "#stance-cycle", "#toggle-pause"]
          .map((selector) => [selector, document.querySelectorAll(selector).length])),
        joystickVisible: Boolean(movement.querySelector("[data-joystick]"))
          && isVisible(movement.querySelector("[data-joystick]")),
        joystickSize: (() => {
          const rect = movement.querySelector("[data-joystick]")?.getBoundingClientRect();
          return rect ? Math.min(rect.width, rect.height) : 0;
        })(),
        visible: isVisible(bottom) && isVisible(movement),
      },
      zones: {
        actions: box(actions),
        combat: box(combat),
        health: box(health),
        movement: box(movement),
        objective: box(objective),
      },
      document: {
        clientHeight: document.documentElement.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      },
      headings: {
        mission: heading("#battle-stage"),
        objective: heading("#battle-objective"),
        runState: heading("#battle-loop-phase"),
      },
      panels: {
        allShareOneRow: Math.max(...topValues) - Math.min(...topValues) < 4,
        boxes: panelBoxes,
        top: topBox,
      },
      stageId: surface.dataset.stageId,
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
  });
}

function overlapArea(left, right) {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
    * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
}

function assertPhoneZonesDoNotOverlap(report) {
  const pairs = [
    ["objective", "health"],
    ["objective", "movement"],
    ["objective", "combat"],
    ["objective", "actions"],
    ["health", "movement"],
    ["health", "combat"],
    ["health", "actions"],
    ["movement", "combat"],
    ["movement", "actions"],
    ["combat", "actions"],
  ];
  for (const [leftName, rightName] of pairs) {
    assert.ok(
      overlapArea(report.zones[leftName], report.zones[rightName]) <= 1,
      `phone ${leftName} and ${rightName} zones must not overlap`,
    );
  }
}

function assertPhonePanelReflow(report) {
  for (const [name, panel] of Object.entries(report.panels.boxes)) {
    assert.ok(
      panel.width >= MIN_PHONE_PANEL_WIDTH,
      `phone HUD panel width must prevent ultra-narrow text columns: ${name} measured ${panel.width.toFixed(1)}px`,
    );
  }
  assert.equal(report.panels.allShareOneRow, false, "phone HUD must reflow instead of keeping all three panels side by side");
}

function assertPhoneContract(report, viewport) {
  assert.deepEqual(report.viewport, viewport, `the phone contract must execute at exactly ${viewport.width}x${viewport.height}`);
  assert.equal(report.stageId, "cinder-span");
  assertPhonePanelReflow(report);
  assertPhoneZonesDoNotOverlap(report);

  for (const [name, heading] of Object.entries(report.headings)) {
    assert.equal(heading.visible, true, `${name} heading must remain visible`);
    assert.ok(
      heading.characterColumns >= 5,
      `${name} heading must be given room for at least five character columns, got ${heading.characterColumns.toFixed(1)}`,
    );
    assert.ok(
      heading.textColumns <= heading.characterColumns + 0.5,
      `${name} heading text (${heading.textColumns.toFixed(1)} cols) must fit the room it is given (${heading.characterColumns.toFixed(1)} cols)`,
    );
    assert.ok(heading.lineCount <= 3, `${name} heading must not wrap into a ${heading.lineCount}-line one/two-character column`);
  }

  assert.ok(
    report.panels.top.height <= viewport.height * MAX_PHONE_TOP_RATIO,
    `phone top HUD must stay within ${MAX_PHONE_TOP_RATIO * 100}% of viewport height, got ${report.panels.top.height.toFixed(1)}px`,
  );
  assert.ok(report.battlefield.exposedHeight >= 180, `phone HUD must leave a visible battlefield band, got ${report.battlefield.exposedHeight.toFixed(1)}px`);
  assert.equal(report.battlefield.exposedPoint.hitsSurface, true, "the exposed center band must hit the battlefield surface");
  assert.equal(report.battlefield.exposedPoint.hitsHud, false, "the exposed center band must not be covered by HUD controls");

  assert.equal(report.bottomControls.visible, true, "phone bottom controls must be rendered and visible");
  // KEYPAD RETIRED: the five [data-move] buttons are gone. What must be rendered and reachable at
  // phone sizes is the drag stick itself — that is the movement control now.
  assert.equal(report.bottomControls.movementButtonCount, 0,
    "the retired [data-move] keypad must not be rendered");
  assert.equal(report.bottomControls.joystickVisible, true,
    "the drag stick must be rendered and visible at phone sizes");
  assert.ok(report.bottomControls.joystickSize >= 44,
    `the drag stick must stay a reachable target, got ${report.bottomControls.joystickSize}px`);
  // The floor was 7 when five of those were the retired [data-move] ring. Movement is no longer a
  // button at all, so the meaningful assertion is that the combat/stance/pause controls survive —
  // named, not counted.
  assert.ok(report.bottomControls.buttons.length >= 2,
    `combat, stance and pause controls must remain available, got ${report.bottomControls.buttons.length}`);
  assert.deepEqual(report.bottomControls.requiredControls, {
    "#manual-attack": 1, "#stance-cycle": 1, "#toggle-pause": 1,
  }, "combat, stance and pause controls must each remain a single reachable phone control");
  for (const control of report.bottomControls.buttons) {
    assert.equal(control.visible, true, `bottom control ${control.label} must be visible`);
    assert.ok(control.box.width >= 44 && control.box.height >= 44, `bottom control ${control.label} must retain a 44px target`);
    assert.ok(control.box.left >= -0.5 && control.box.right <= viewport.width + 0.5, `bottom control ${control.label} must stay within the phone width`);
    assert.ok(control.box.top >= -0.5 && control.box.bottom <= viewport.height + 0.5, `bottom control ${control.label} must stay within the phone height`);
  }
  assert.ok(report.document.scrollWidth <= report.document.clientWidth && report.document.scrollHeight <= report.document.clientHeight, "the phone battle document must not overflow");
}

function assertDesktopContract(report) {
  assert.deepEqual(report.viewport, DESKTOP_VIEWPORT, "the desktop contract must execute at exactly 1440x900");
  assert.equal(report.panels.allShareOneRow, true, "desktop must retain the three-panel top HUD row");
  const { mission, objective, runState } = report.panels.boxes;
  assert.ok(mission.left < runState.left && runState.left < objective.left, "desktop panels must retain mission → run state → objective order");
  assert.ok(mission.right <= runState.left + 1 && runState.right <= objective.left + 1, "desktop three-panel arrangement must not overlap");
  assert.ok(report.battlefield.exposedHeight >= 400, "desktop HUD must leave the battlefield visible");
  assert.ok(report.document.scrollWidth <= report.document.clientWidth, "the desktop battle document must not overflow horizontally");
}

function printMeasurement(label, report, extra = {}) {
  const roundedBox = (value) => Object.fromEntries(Object.entries(value).map(([key, number]) => [key, Math.round(number * 10) / 10]));
  const boxes = Object.fromEntries(Object.entries(report.panels.boxes).map(([name, value]) => [name, roundedBox(value)]));
  console.log(`${label} ${JSON.stringify({
    battlefieldExposedHeight: Math.round(report.battlefield.exposedHeight * 10) / 10,
    bottom: roundedBox(report.bottomControls.box),
    controls: Object.fromEntries(report.bottomControls.buttons.map(({ box, label }) => [label, roundedBox(box)])),
    headings: Object.fromEntries(Object.entries(report.headings).map(([name, value]) => [name, {
      characterColumns: Math.round(value.characterColumns * 10) / 10,
      textColumns: Math.round(value.textColumns * 10) / 10,
      lineCount: value.lineCount,
      width: Math.round(value.box.width * 10) / 10,
    }])),
    panels: boxes,
    top: roundedBox(report.panels.top),
    ...extra,
  })}`);
}

before(async () => {
  hosting = await staticServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  if (hosting?.host) await new Promise((resolve) => hosting.host.close(resolve));
});

afterEach(() => {
  assert.equal(browser?.contexts().length ?? 0, 0, "browser contexts must be closed after every focused case");
});

test("Abyssal Lantern exposes the lobby before deployment and the combat HUD only after keyboard launch", async () => {
  const run = await openUi(PHONE_VIEWPORT, { reducedMotion: "no-preference" });
  try {
    assert.match(await run.page.title(), /^Abyssal Lantern\b/, "the browser title must expose the canonical Abyssal Lantern brand");
    assert.match(
      await run.page.locator(".deck-brand").getAttribute("aria-label") ?? "",
      /\bABYSSAL LANTERN\b/i,
      "the visible lobby brand must be announced as Abyssal Lantern",
    );
    assert.equal(await run.surface.getAttribute("data-defense-started"), "false", "the initial shell must remain pre-run");
    assert.equal(await run.page.locator("#defense-canvas").isVisible(), true, "the live canvas must be visible before deployment");
    assert.equal(await run.page.locator("#lobby-cinematic").getAttribute("data-active"), "true", "the lobby presentation must be active before deployment");
    assert.equal(await run.page.locator("#command-deck-left .command-deck").isVisible(), true, "the character deck must be visible before deployment");
    assert.equal(await run.page.locator("#command-deck-right .command-deck").isVisible(), true, "the operations deck must be visible before deployment");
    assert.equal(await run.page.locator("#defense-edge-hud").isVisible(), false, "combat-only HUD must be hidden before deployment");

    const start = run.page.locator("#start-defense");
    await start.focus();
    assert.equal(await start.evaluate((node) => document.activeElement === node), true, "the launch action must accept keyboard focus");
    const startBox = await start.boundingBox();
    assert.ok(startBox && startBox.width >= 44 && startBox.height >= 44, "the lobby launch action must retain a 44px target");
    await run.page.keyboard.press("Enter");
    await run.page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor();

    assert.equal(await run.page.locator("#start-defense").count(), 0, "the lobby launch action must leave the DOM in-run");
    assert.equal(await run.page.locator("#command-deck-left").evaluate((node) => node.childElementCount), 0, "the character deck must be emptied in-run");
    assert.equal(await run.page.locator("#command-deck-right").evaluate((node) => node.childElementCount), 0, "the operations deck must be emptied in-run");
    assert.equal(await run.page.locator("#lobby-cinematic").getAttribute("data-active"), "false", "the lobby presentation must become inactive in-run");
    assert.equal(await run.page.locator("#defense-edge-hud").isVisible(), true, "the combat HUD must become visible in-run");
    assert.deepEqual(run.browserErrors, [], "the lobby-to-run keyboard journey emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("pre-run pause keys are inert and shell audio state is shared with the labelled pause controls", async () => {
  const run = await openUi(PHONE_VIEWPORT, { reducedMotion: "no-preference" });
  try {
    const inputBeforePauseKeys = await run.surface.getAttribute("data-defense-input-seq");
    await run.page.keyboard.press("p");
    await run.page.keyboard.press("Escape");
    assert.equal(await run.surface.getAttribute("data-defense-started"), "false", "pause keys before deployment must leave the preview unstarted");
    assert.equal(await run.page.locator("#defense-pause-overlay").count(), 0, "pause keys before deployment must not create a modal");
    assert.equal(
      await run.surface.getAttribute("data-defense-input-seq"),
      inputBeforePauseKeys,
      "pause keys before deployment must not admit battle input",
    );

    const shellMute = run.page.locator("#shell-audio-mute-btn");
    const shellVolume = run.page.locator("#shell-audio-volume");
    assert.equal(await shellMute.getAttribute("aria-label"), "음소거 토글", "the shell mute action must expose its purpose");
    assert.equal(await shellVolume.getAttribute("aria-labelledby"), "shell-volume-label", "the shell range must reference its visible label");
    for (const [name, control] of [["shell mute", shellMute], ["shell volume", shellVolume]]) {
      const bounds = await control.boundingBox();
      assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, `${name} must retain a 44px target`);
    }
    await shellVolume.fill("0.4");
    await shellMute.click();
    assert.equal(await shellMute.getAttribute("aria-pressed"), "true", "the shell mute action must expose the updated muted state");
    assert.match(await run.page.locator("#shell-volume-label").textContent() ?? "", /40%/, "the shell volume label must expose the updated level");

    await run.page.locator("#start-defense").click();
    await run.page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor();
    for (let index = 0; index < 4; index += 1) {
      const dismiss = run.page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
      if (await dismiss.count() === 0 || !(await dismiss.isVisible())) break;
      await dismiss.click();
    }
    await run.page.locator("#defense-cutscene-overlay").waitFor({ state: "detached" });

    await run.page.keyboard.press("p");
    const overlay = run.page.locator("#defense-pause-overlay");
    await overlay.waitFor({ state: "visible" });
    const pauseMute = run.page.locator("#pause-audio-mute-btn");
    const pauseVolume = run.page.locator("#pause-audio-volume");
    assert.equal(await pauseMute.getAttribute("aria-label"), "음소거 토글", "the pause mute action must expose its purpose");
    assert.equal(await pauseVolume.getAttribute("aria-labelledby"), "pause-volume-label", "the pause range must reference its visible label");
    assert.equal(await pauseMute.getAttribute("aria-pressed"), "true", "the pause panel must read the shell's muted state");
    assert.equal(await pauseVolume.inputValue(), "0.4", "the pause panel must read the shell's volume state");
    assert.match(await run.page.locator("#pause-volume-label").textContent() ?? "", /40%/, "the pause label must expose the shared volume level");
    for (const [name, control] of [["pause mute", pauseMute], ["pause volume", pauseVolume]]) {
      const bounds = await control.boundingBox();
      assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, `${name} must retain a 44px target`);
    }

    await pauseMute.click();
    await pauseVolume.fill("0.65");
    await run.page.keyboard.press("Escape");
    await overlay.waitFor({ state: "detached" });
    await run.page.keyboard.press("p");
    await overlay.waitFor({ state: "visible" });
    assert.equal(await run.page.locator("#pause-audio-mute-btn").getAttribute("aria-pressed"), "false", "unmuting must survive pause overlay reconstruction");
    assert.equal(await run.page.locator("#pause-audio-volume").inputValue(), "0.65", "volume changes must survive pause overlay reconstruction");
    assert.match(await run.page.locator("#pause-volume-label").textContent() ?? "", /65%/, "the rebuilt pause label must expose the shared volume level");
    assert.deepEqual(run.browserErrors, [], "the shared audio-control lifecycle emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("stable combat control IDs route light, heavy, and dash input through their selected controls", async () => {
  const run = await launchCinder(PHONE_VIEWPORT, { syntheticFrames: true });
  try {
    for (const selector of [
      "#movement-actions",
      "#manual-attack",
      "#manual-heavy",
      "#manual-dash",
      "#skill-actions",
      "#battle-actions",
      "#stance-cycle",
      "#toggle-pause",
    ]) {
      assert.equal(await run.page.locator(selector).count(), 1, `${selector} must remain a unique public control hook`);
    }

    // A fresh synthetic-clock run starts with no already-rendered combat effects. Record
    // only authoritative direct-melee feedback added after native player input. Event metadata
    // prevents projectile, commander, or companion feedback from satisfying this contract.
    await run.page.evaluate(() => {
      const overlay = document.querySelector("#world-hud-overlay");
      if (!overlay) throw new Error("world HUD overlay missing");
      window.__directControlDamageSamples = [];
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (
              !(node instanceof HTMLElement)
              || !node.classList.contains("world-damage-number")
              || node.dataset.defenseEventType !== "MELEE_IMPACT"
              || !node.dataset.defenseEventId
            ) continue;
            window.__directControlDamageSamples.push({
              computedTransform: getComputedStyle(node).transform,
              eventId: node.dataset.defenseEventId,
              inlineTransform: node.style.transform,
              text: node.querySelector(".world-damage-number-rise")?.textContent ?? "",
            });
          }
        }
      });
      observer.observe(overlay, { childList: true });
      window.__stopDirectControlDamageObserver = () => observer.disconnect();
    });

    // Sibling of the fix in progression-mobile-ui-browser.cjs. Answer any pending level-up growth
    // offer before driving a control. The offer is genuinely modal --
    // defense-run-simulation.js:4263 is `if (run.growthOffer) return;`, so the simulation HALTS
    // while one is open, and app.js:3908 correctly focuses its button. Both consequences break
    // this helper: the focus assertion can see the offer's <button> instead of the control, and
    // `data-defense-input-seq` can then never increment, burning the full timeout -- which is
    // exactly how test 3 failed with `waitForFunction: Timeout 90000ms exceeded`.
    //
    // Per activation, not once up front: each Enter moves the commander and accrues XP, so a
    // level-up can cross its threshold between calls.
    const dismissGrowthOffer = async () => {
      const pick = run.page.locator("#defense-growth-offer [data-pick]").first();
      if (await pick.isVisible().catch(() => false)) await pick.click();
      await run.page.locator("#defense-growth-offer").waitFor({ state: "hidden" }).catch(() => {});
    };

    const activateAndWaitForInput = async (selector, activate, expectedVerb = null) => {
      await dismissGrowthOffer();
      const control = run.page.locator(selector);
      await control.focus();
      assert.equal(await control.evaluate((node) => document.activeElement === node), true, `${selector} must accept keyboard focus`);
      const previous = Number(await run.surface.getAttribute("data-defense-input-seq"));
      await activate(control);
      await run.page.waitForFunction(
        ({ prior }) => Number(document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq) === prior + 1,
        { prior: previous },
      );
      if (expectedVerb) {
        assert.equal(await control.getAttribute("data-combat-verb"), expectedVerb, `${selector} must retain its selected direct verb`);
        assert.equal(await run.surface.getAttribute("data-defense-combat-verb"), expectedVerb, `${selector} must publish its selected direct verb`);
        assert.equal(await control.getAttribute("data-combat-state"), "pending", `${selector} must expose a pending direct-combat outcome`);
        assert.equal(await control.getAttribute("data-feedback"), "pending", `${selector} must not claim a resolved outcome before the simulation tick`);
        assert.match(await control.getAttribute("data-combat-input-id") ?? "", /\S+/, `${selector} must expose the authoritative pending input id`);
      }
      return control;
    };

    // The opening wave begins out of melee reach. Repeat the native player action only
    // after a full recovery window while the live wave closes naturally; rejected attempts
    // cannot create a damage number, while the first accepted contact ends the loop.
    let acceptedLightControl = null;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const control = await activateAndWaitForInput("#manual-attack", () => run.page.keyboard.press("Enter"), "ATTACK_LIGHT");
      for (let frame = 0; frame < 12; frame += 1) {
        await run.page.evaluate(() => window.__pumpDefenseFrame(100));
        await run.page.waitForTimeout(0);
        if (await control.getAttribute("data-feedback") === "true") {
          acceptedLightControl = control;
          break;
        }
      }
      if (acceptedLightControl) break;
    }
    assert.ok(acceptedLightControl, "one native light input must reach an accepted simulation outcome before its visible impact is asserted");
    const directDamageSamples = await run.page.evaluate(() => window.__directControlDamageSamples);
    assert.equal(
      directDamageSamples.length,
      1,
      `one native light action must render exactly one MELEE_IMPACT number, saw ${JSON.stringify(directDamageSamples)}`,
    );
    const [firstDirectDamage] = directDamageSamples;
    assert.match(firstDirectDamage.eventId, /\S+/, "the resolved direct hit must expose an authoritative event id");
    assert.match(firstDirectDamage.text, /^-\d+$/, "the resolved direct hit must expose player-visible damage text");
    assert.notEqual(firstDirectDamage.computedTransform, "none", "the direct-hit number must be target-anchored on screen");
    assert.match(firstDirectDamage.inlineTransform, /^translate\(-?\d+(?:\.\d+)?px, -?\d+(?:\.\d+)?px\)$/,
      "the direct-hit number must retain its target-anchored world position");
    const impactSelector = await run.page.evaluate((eventId) => (
      `.world-damage-number[data-defense-event-type="MELEE_IMPACT"][data-defense-event-id="${CSS.escape(eventId)}"]`
    ), firstDirectDamage.eventId);
    const firstImpact = run.page.locator(impactSelector);
    assert.equal(await firstImpact.count(), 1, "the resolved MELEE_IMPACT event id must map to exactly one DOM number");
    assert.equal(await firstImpact.isVisible(), true, "the resolved MELEE_IMPACT number must be visible");
    for (let frame = 0; frame < 3; frame += 1) {
      await run.page.evaluate(() => window.__pumpDefenseFrame(100));
      await run.page.waitForTimeout(0);
    }
    assert.equal(
      await firstImpact.count(),
      1,
      "re-rendering resolved MELEE_IMPACT events must not append a duplicate node with the same event id",
    );
    const resolvedDamageCount = directDamageSamples.length;

    const heavyControl = await activateAndWaitForInput("#manual-heavy", (control) => control.click(), "ATTACK_HEAVY");
    for (let frame = 0; frame < 12; frame += 1) {
      await run.page.evaluate(() => window.__pumpDefenseFrame(100));
      await run.page.waitForTimeout(0);
      if (
        await heavyControl.getAttribute("data-feedback") === "true"
        && await run.page.evaluate((count) => window.__directControlDamageSamples.length > count, resolvedDamageCount)
      ) break;
    }
    assert.equal(await heavyControl.getAttribute("data-feedback"), "true", "a valid direct heavy action must reach an accepted simulation outcome");
    assert.ok(
      await run.page.evaluate((count) => window.__directControlDamageSamples.length > count, resolvedDamageCount),
      "a valid direct heavy action must resolve into additional visible world damage feedback",
    );
    const dashControl = await activateAndWaitForInput("#manual-dash", (control) => control.click(), "DASH");
    await run.page.evaluate(() => window.__pumpDefenseFrame(100));
    await run.page.waitForTimeout(0);
    assert.equal(await dashControl.getAttribute("data-feedback"), "true", "a valid direct dash action must reach an accepted simulation outcome");
    // KEYPAD RETIRED: `#movement-actions [data-move="E"]` no longer exists, and movement is not a
    // combat CONTROL ID any more — this test is about the stable control ids and their native
    // keyboard activation, so movement simply leaves its scope. The keyboard movement contract is
    // asserted where it belongs, on the two suites that own movement:
    // progression-mobile-ui-browser (w/a/s/d + diagonals -> data-defense-move) and
    // defense-survivor-browser (held "d" -> "E" -> release -> IDLE).
    //
    // Driving a 15 s key hold from here also perturbed the very state the rest of this test
    // measures: it kept the run advancing while the pause dialog assertions below wait on
    // `data-defense-state === "active"`, which is how this test timed out at :622 on CI.
    assert.equal(await run.page.locator("#movement-actions [data-move]").count(), 0,
      "movement must no longer expose keypad control ids");
    await activateAndWaitForInput("#stance-cycle", () => run.page.keyboard.press("Enter"));

    const pause = run.page.locator("#toggle-pause");
    await pause.focus();
    await run.page.keyboard.press("Enter");
    await run.page.locator("#defense-pause-overlay").waitFor({ state: "visible" });
    const resume = run.page.locator("#pause-overlay-resume");
    assert.equal(
      await resume.evaluate((node) => document.activeElement === node),
      true,
      "opening the keyboard pause dialog must move focus to its resume action",
    );
    await run.page.keyboard.press("Space");
    await run.page.locator("#defense-pause-overlay").waitFor({ state: "detached" });
    // This wait can never terminate while a growth offer is pending, so it hangs for the full
    // 90 s rather than running slow. `app.js:3219-3229` recomputes `defenseState` from the
    // snapshot EVERY frame:
    //
    //   userPaused ? "paused" : terminal ? … : growthOffer ? "growth" : … : "active"
    //
    // so `"active"` is reachable only when no offer is pending, and the direct write of
    // `"active"` on unpause (`app.js:3984`) is overwritten by the next frame. The Enter/Space
    // pause round-trip above accrues ticks, so a level-up can surface an offer during it; the
    // simulation then returns early while the offer is open and nothing auto-clears it.
    //
    // This is the exact site the CI stack named on four consecutive red runs, with
    // `waitForFunction: Timeout 90000ms exceeded`. Identified by SYMBOL rather than line: the
    // `defenseState === "active"` wait immediately after the Enter/Space pause round-trip. This
    // file renumbered three times in two days (the stacks read `:570`, then `:586`, then `:602`),
    // so a line citation here would have rotted before the fix landed.
    //
    // Accept the offer states as terminal conditions, clear whichever appeared, and re-wait --
    // bounded by construction rather than by the timeout ceiling. The assertion after the loop
    // still fails if resume genuinely does not restore the active state.
    let clearedOffer = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await run.page.waitForFunction(() => {
        const state = document.querySelector("#defense-battle-surface")?.dataset.defenseState;
        return state === "active" || state === "growth" || state === "reward";
      });
      if (await run.surface.getAttribute("data-defense-state") === "active") break;
      const pick = run.page
        .locator("#defense-growth-offer [data-pick], #defense-reward-offer [data-pick]")
        .first();
      if (await pick.isVisible().catch(() => false)) {
        await pick.click();
        clearedOffer = true;
      }
      await run.page.locator("#defense-growth-offer").waitFor({ state: "hidden" }).catch(() => {});
    }
    assert.equal(
      await run.surface.getAttribute("data-defense-state"),
      "active",
      "resuming must return the surface to the active state once no offer is pending",
    );
    // Clearing an offer requires CLICKING its pick button, which moves focus off the pause
    // control -- so the focus claim below would then be measuring the offer's focus handling
    // rather than resume's. That is not a product defect and not something to assert around:
    // it is a destroyed precondition. Re-run the pause round-trip once on the now-clean state so
    // the assertion tests what it means to test. Observed as `'' !== 'toggle-pause'` once the
    // guard above stopped the 90 s hang -- the hang was hiding this, not preventing it.
    if (clearedOffer) {
      await pause.focus();
      await run.page.keyboard.press("Enter");
      await run.page.locator("#defense-pause-overlay").waitFor({ state: "visible" });
      await run.page.keyboard.press("Space");
      await run.page.locator("#defense-pause-overlay").waitFor({ state: "detached" });
      await run.page.waitForFunction(() => {
        const state = document.querySelector("#defense-battle-surface")?.dataset.defenseState;
        return state === "active" || state === "growth" || state === "reward";
      });
    }
    const focusedAfterResume = await run.page.evaluate(() => ({
      id: document.activeElement?.id ?? "",
      tagName: document.activeElement?.tagName ?? "",
    }));
    assert.equal(
      focusedAfterResume.id,
      "toggle-pause",
      `resuming must return focus to the live pause control, got ${focusedAfterResume.tagName}#${focusedAfterResume.id}`,
    );
    assert.deepEqual(run.browserErrors, [], "keyboard control activation emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("pause dialog traps focus, keeps background commands inert, and resumes from a focused volume range", async () => {
  const run = await launchCinder(PHONE_VIEWPORT);
  try {
    const attack = run.page.locator("#manual-attack");
    const attackBox = await attack.boundingBox();
    assert.ok(attackBox, "the live attack control must have a clickable box before pause");

    await run.page.keyboard.press("p");
    const overlay = run.page.locator("#defense-pause-overlay");
    const dialog = run.page.getByRole("dialog", { name: "전투 일시 정지" });
    await overlay.waitFor({ state: "visible" });
    assert.equal(await run.surface.getAttribute("data-defense-state"), "paused", "the pause hotkey must suspend the battle");
    const pausedInputSeq = Number(await run.surface.getAttribute("data-defense-input-seq"));
    assert.deepEqual(
      await run.page.evaluate(() => ({
        battleHud: document.querySelector("#defense-edge-hud")?.inert,
        leftDeck: document.querySelector("#command-deck-left")?.inert,
        rightDeck: document.querySelector("#command-deck-right")?.inert,
      })),
      { battleHud: true, leftDeck: true, rightDeck: true },
      "combat and shell controls behind the modal must be removed from interaction",
    );

    const resume = run.page.locator("#pause-overlay-resume");
    assert.equal(await resume.evaluate((node) => document.activeElement === node), true, "pause must initially focus its resume action");
    await run.page.keyboard.press("Shift+Tab");
    assert.equal(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
      true,
      "Shift+Tab from the first action must wrap to a control inside the pause dialog",
    );
    assert.match(await run.page.evaluate(() => document.activeElement?.id ?? ""), /^pause-tab-/, "reverse wrapping must land on the last pause tab");
    await run.page.keyboard.press("Tab");
    assert.equal(await resume.evaluate((node) => document.activeElement === node), true, "Tab from the last pause control must wrap to resume");

    const selectedPauseSegment = () => overlay.evaluate((node) => ({
      activeId: document.activeElement?.id ?? "",
      panelLabel: node.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby") ?? "",
      selectedId: node.querySelector('[role="tab"][aria-selected="true"]')?.id ?? "",
      tabStops: [...node.querySelectorAll('[role="tab"]')].filter((tab) => tab.tabIndex === 0).map((tab) => tab.id),
    }));
    const expectPauseSegment = async (segment) => {
      const id = `pause-tab-${segment}`;
      assert.deepEqual(
        await selectedPauseSegment(),
        { activeId: id, panelLabel: id, selectedId: id, tabStops: [id] },
        `${segment} must own focus, selection, the panel relationship, and the only tab stop`,
      );
    };
    await run.page.locator("#pause-tab-stats").focus();
    await expectPauseSegment("stats");
    await run.page.keyboard.press("ArrowRight");
    await expectPauseSegment("inventory");
    await run.page.keyboard.press("End");
    await expectPauseSegment("companions");
    await run.page.keyboard.press("Home");
    await expectPauseSegment("stats");
    await attack.focus();
    assert.notEqual(await run.page.evaluate(() => document.activeElement?.id), "manual-attack", "an inert combat action must reject programmatic focus");
    await run.page.mouse.click(attackBox.x + attackBox.width / 2, attackBox.y + attackBox.height / 2);
    assert.equal(
      Number(await run.surface.getAttribute("data-defense-input-seq")),
      pausedInputSeq,
      "a pointer aimed at a covered combat action must not admit gameplay input while paused",
    );

    const volume = run.page.locator("#pause-audio-volume");
    const volumeBox = await volume.boundingBox();
    assert.ok(volumeBox && volumeBox.width >= 44 && volumeBox.height >= 44, "the phone pause range itself must expose a 44px hit target");
    await volume.fill("0.35");
    await volume.focus();
    assert.equal(await run.page.evaluate(() => document.activeElement?.id), "pause-audio-volume", "the range must own focus before P resumes");
    await run.page.keyboard.press("p");
    await overlay.waitFor({ state: "detached" });
    assert.notEqual(await run.surface.getAttribute("data-defense-state"), "paused", "P must resume even when the range owns focus");
    assert.deepEqual(
      await run.page.evaluate(() => ({
        battleHud: document.querySelector("#defense-edge-hud")?.inert,
        leftDeck: document.querySelector("#command-deck-left")?.inert,
        rightDeck: document.querySelector("#command-deck-right")?.inert,
      })),
      { battleHud: false, leftDeck: false, rightDeck: false },
      "resuming must restore combat and shell interaction",
    );

    await attack.focus();
    await run.page.keyboard.press("Enter");
    await run.page.waitForFunction(
      (prior) => Number(document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq) > prior,
      pausedInputSeq,
    );

    await run.page.keyboard.press("Escape");
    await overlay.waitFor({ state: "visible" });
    const reopenedVolume = run.page.locator("#pause-audio-volume");
    assert.equal(await reopenedVolume.inputValue(), "0.35", "the public audio volume must survive a resume and pause cycle");
    await reopenedVolume.focus();
    assert.equal(await run.page.evaluate(() => document.activeElement?.id), "pause-audio-volume", "the range must own focus before Escape resumes");
    await run.page.keyboard.press("Escape");
    const afterEscape = await run.page.evaluate(() => ({
      activeId: document.activeElement?.id ?? "",
      overlayCount: document.querySelectorAll("#defense-pause-overlay").length,
      state: document.querySelector("#defense-battle-surface")?.dataset.defenseState ?? "",
    }));
    assert.equal(afterEscape.overlayCount, 0, `Escape must synchronously remove the pause dialog: ${JSON.stringify(afterEscape)}`);
    assert.notEqual(afterEscape.state, "paused", "Escape must resume even when the range owns focus");
    assert.deepEqual(run.browserErrors, [], "the pause keyboard lifecycle emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("phone critical and lore feedback are visible once and clear inside the bounded live-region window", async () => {
  const run = await launchCinder(PHONE_VIEWPORT, { syntheticFrames: true });
  try {
    const feedback = run.page.locator("#battle-event-feedback");
    await feedback.waitFor({ state: "visible" });

    const observeCurrentFeedback = () => run.page.evaluate(() => {
      const node = document.querySelector("#battle-event-feedback");
      window.__feedbackAnnouncements = [];
      const record = () => {
        const text = node?.textContent?.trim() ?? "";
        if (text) window.__feedbackAnnouncements.push(text);
      };
      record();
      window.__feedbackObserver?.disconnect();
      window.__feedbackObserver = new MutationObserver(record);
      window.__feedbackObserver.observe(node, { childList: true, characterData: true, subtree: true });
    });
    const finishObservation = () => run.page.evaluate(() => {
      window.__feedbackObserver?.disconnect();
      return [...window.__feedbackAnnouncements];
    });
    const waitForFeedbackToClear = async () => {
      const startedAt = Date.now();
      await run.page.waitForFunction(
        () => !(document.querySelector("#battle-event-feedback")?.textContent ?? "").trim(),
        null,
        { polling: 25, timeout: 2400 },
      );
      return Date.now() - startedAt;
    };

    assert.match(await feedback.getAttribute("data-feedback") ?? "", /\blore\b/, "the opening lore event must reach the live feedback region");
    const loreText = (await feedback.textContent() ?? "").trim();
    await observeCurrentFeedback();
    const loreElapsed = await waitForFeedbackToClear();
    const loreAnnouncements = await finishObservation();
    assert.ok(loreElapsed <= 2300, `lore feedback must clear within its bounded window, cleared after ${loreElapsed}ms`);
    assert.equal(loreAnnouncements.filter((text) => text === loreText).length, 1, "one lore event must produce one live-region announcement");
    assert.equal(await feedback.getAttribute("data-feedback"), null, "cleared lore feedback must not leave stale visual state");

    // Auto-attacks are intentionally absent. Drive the public light-attack control through
    // its keyboard activation path, only while the visible game is ready to take a player
    // command. Three synthetic frames clear every authored light-combo recovery window (12
    // ticks max), keeping the same bounded 180-frame observation budget that this test had
    // before player agency became required for a critical hit.
    const dismissBlockingUi = async () => {
      for (let dismissal = 0; dismissal < 4; dismissal += 1) {
        const dismiss = run.page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
        if (await dismiss.isVisible().catch(() => false)) {
          await dismiss.click();
          continue;
        }
        const pick = run.page.locator("#defense-growth-offer [data-pick], #defense-reward-offer [data-pick]").first();
        if (await pick.isVisible().catch(() => false)) {
          await pick.click();
          continue;
        }
        break;
      }
    };
    const activateReadyLightAttack = async () => {
      await dismissBlockingUi();
      assert.equal(await run.surface.getAttribute("data-defense-state"), "active", "the direct-combat driver must wait for a ready battle surface");
      const lightAttack = run.page.locator("#manual-attack");
      await lightAttack.focus();
      assert.equal(await lightAttack.evaluate((node) => document.activeElement === node), true, "the public light control must own focus before keyboard activation");
      const priorInput = Number(await run.surface.getAttribute("data-defense-input-seq"));
      await run.page.keyboard.press("Enter");
      await run.page.waitForFunction(
        ({ prior }) => Number(document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq) === prior + 1,
        { prior: priorInput },
      );
    };

    let criticalVisible = false;
    let nextLightAttackFrame = 0;
    for (let frame = 0; frame < 180 && !criticalVisible; frame += 1) {
      await dismissBlockingUi();
      if (
        frame >= nextLightAttackFrame
        && await run.surface.getAttribute("data-defense-state") === "active"
      ) {
        await activateReadyLightAttack();
        nextLightAttackFrame = frame + 3;
      }
      await run.page.evaluate(() => window.__pumpDefenseFrame(100));
      criticalVisible = /\bcritical\b/.test(await feedback.getAttribute("data-feedback") ?? "");
    }
    assert.equal(criticalVisible, true, "the deterministic phone battle must surface a critical-hit feedback event");

    const geometry = await feedback.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        bottom: rect.bottom,
        display: style.display,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        visibility: style.visibility,
        viewportHeight: innerHeight,
        viewportWidth: innerWidth,
        width: rect.width,
      };
    });
    assert.notEqual(geometry.display, "none", "active phone feedback must participate in layout");
    assert.notEqual(geometry.visibility, "hidden", "active phone feedback must be visually exposed");
    assert.ok(geometry.width >= 44 && geometry.height > 0, "active phone feedback must have a normal non-zero readable box");
    assert.ok(
      geometry.left >= 0
        && geometry.top >= 0
        && geometry.right <= geometry.viewportWidth
        && geometry.bottom <= geometry.viewportHeight,
      "active phone feedback must remain entirely inside the visible viewport",
    );

    const criticalText = (await feedback.textContent() ?? "").trim();
    await observeCurrentFeedback();
    const criticalElapsed = await waitForFeedbackToClear();
    const criticalAnnouncements = await finishObservation();
    assert.ok(criticalElapsed <= 2300, `critical feedback must clear within its bounded window, cleared after ${criticalElapsed}ms`);
    assert.equal(criticalAnnouncements.filter((text) => text === criticalText).length, 1, "one critical event must produce one live-region announcement");
    assert.equal(await run.surface.getAttribute("data-defense-feedback"), null, "cleared critical feedback must not leave stale surface state");
    assert.deepEqual(run.browserErrors, [], "the transient feedback journey emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("higher contrast removes blur from both shell and pause audio panels", async () => {
  const run = await openUi(PHONE_VIEWPORT);
  try {
    await run.page.emulateMedia({ contrast: "more" });
    assert.equal(
      await run.page.evaluate(() => matchMedia("(prefers-contrast: more)").matches),
      true,
      "the browser harness must activate higher-contrast media",
    );
    const blurState = (selector) => run.page.locator(selector).evaluate((node) => getComputedStyle(node).backdropFilter);
    assert.equal(
      await blurState(".shell-audio-settings"),
      "none",
      "the lobby audio panel must remove backdrop blur in higher contrast",
    );

    await run.page.locator("#start-defense").click();
    await run.page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor();
    await run.page.keyboard.press("p");
    await run.page.locator("#defense-pause-overlay").waitFor({ state: "visible" });
    assert.equal(
      await blurState(".pause-overlay-settings"),
      "none",
      "the pause audio panel must remove backdrop blur in higher contrast",
    );
    assert.deepEqual(run.browserErrors, [], "higher-contrast audio panels emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("reduced motion keeps the lobby in a stable authored frame and suppresses launch particles", async () => {
  const run = await openUi(PHONE_VIEWPORT);
  try {
    const lobby = run.page.locator("#lobby-cinematic");
    await run.page.waitForFunction(() => document.querySelector("#lobby-cinematic")?.dataset.framing === "mid");
    const resting = {
      dialogue: await run.page.locator("#lobby-dialogue-text").textContent(),
      framing: await lobby.getAttribute("data-framing"),
    };
    await run.page.waitForTimeout(120);
    assert.deepEqual({
      dialogue: await run.page.locator("#lobby-dialogue-text").textContent(),
      framing: await lobby.getAttribute("data-framing"),
    }, resting, "reduced motion must preserve one readable lobby frame rather than advance choreography");
    assert.equal(
      await lobby.evaluate((node) => node.getAnimations({ subtree: true }).filter(({ playState }) => playState === "running").length),
      0,
      "reduced motion must not leave lobby CSS animations running",
    );

    const start = run.page.locator("#start-defense");
    await start.focus();
    await run.page.keyboard.press("Space");
    await run.page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor();
    assert.equal(await run.page.locator(".sortie-burst-particle").count(), 0, "reduced motion must suppress the launch particle burst");
    assert.deepEqual(run.browserErrors, [], "the reduced-motion journey emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("dynamic reduced motion recomputes the live Canvas fallback through the app media listener", async () => {
  const run = await openUi(PHONE_VIEWPORT, {
    forceCanvasMotionProbe: true,
    reducedMotion: "no-preference",
  });
  try {
    assert.equal(await run.surface.getAttribute("data-defense-renderer"), "canvas2d", "the probe must exercise the Canvas fallback");
    await run.page.waitForFunction(() =>
      window.__canvasLineDashCalls.some((segments) => segments.length === 2 && segments[0] === 5 && segments[1] === 4)
    );
    await run.page.evaluate(() => { window.__canvasLineDashCalls.length = 0; });

    await run.page.emulateMedia({ reducedMotion: "reduce" });
    await run.page.waitForFunction(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    await run.page.evaluate(() => {
      if (!window.__appReducedMotionQuery) throw new Error("the app did not register its reduced-motion listener");
      window.__appReducedMotionQuery.dispatchEvent(new MediaQueryListEvent("change", {
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
      }));
    });
    const reducedMotionDashCalls = await run.page.evaluate(() => [...window.__canvasLineDashCalls]);
    assert.equal(
      reducedMotionDashCalls.some((segments) => segments.length === 2 && segments[0] === 3 && segments[1] === 5),
      true,
      `the live Canvas adapter must recompute its reduced-motion hazard pattern: ${JSON.stringify(reducedMotionDashCalls)}`,
    );

    assert.equal(
      await run.page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
      true,
      "the live media query must reflect the dynamic reduced-motion change",
    );
    assert.equal(await run.surface.getAttribute("data-defense-renderer"), "canvas2d", "the same fallback adapter must remain mounted after recomputation");
    assert.equal(await run.page.locator("#lobby-cinematic").getAttribute("data-framing"), "mid", "the app listener must also settle the lobby on its authored reduced-motion frame");
    assert.deepEqual(run.browserErrors, [], "the Canvas reduced-motion transition emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("390x844 Cinder battle HUD reflows into readable panels above visible battlefield controls", async () => {
  const run = await launchCinder(PHONE_VIEWPORT);
  try {
    const report = await measureHud(run.page);
    assertPhoneContract(report, PHONE_VIEWPORT);
    assert.deepEqual(run.browserErrors, [], "the phone battle emitted browser errors");
    printMeasurement("PHONE_HUD_MEASURED", report, { dismissedCutscenes: run.dismissedCutscenes });
  } finally {
    await run.context.close();
  }
});

test("320x568 Cinder battle HUD keeps every control usable around an exposed battlefield", async () => {
  const run = await launchCinder(COMPACT_PHONE_VIEWPORT);
  try {
    const report = await measureHud(run.page);
    assertPhoneContract(report, COMPACT_PHONE_VIEWPORT);
    assert.deepEqual(run.browserErrors, [], "the compact phone battle emitted browser errors");
    printMeasurement("COMPACT_PHONE_HUD_MEASURED", report, { dismissedCutscenes: run.dismissedCutscenes });
  } finally {
    await run.context.close();
  }
});

test("phone panel contract rejects the former side-by-side narrow-column layout", async () => {
  const run = await launchCinder(PHONE_VIEWPORT);
  try {
    await run.page.addStyleTag({ content: `
      @media (max-width: 480px) {
        .defense-top { display: flex !important; flex-flow: row nowrap !important; }
        .defense-top > .hud-mission,
        .defense-top > .hud-loop-state,
        .defense-top > .top-right-hud {
          flex: 1 1 0 !important;
          grid-area: auto !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: none !important;
        }
        .top-right-hud { display: block !important; }
        .objective-chip { width: 100% !important; min-width: 0 !important; max-width: none !important; }
      }
    ` });
    const mutated = await measureHud(run.page);
    assert.equal(mutated.panels.allShareOneRow, true, "the mutation must recreate a side-by-side three-column phone row");
    assert.ok(Object.values(mutated.panels.boxes).every(({ width }) => width < MIN_PHONE_PANEL_WIDTH), "the mutation must recreate ultra-narrow phone panels");
    let rejection;
    assert.throws(
      () => assertPhonePanelReflow(mutated),
      (error) => {
        rejection = error;
        return /phone HUD panel width|phone HUD must reflow/.test(error.message);
      },
      "the phone contract must reject the old side-by-side mutation",
    );
    printMeasurement("PHONE_HUD_MUTATION_CAUGHT", mutated, { rejectedBy: rejection.message });
  } finally {
    await run.context.close();
  }
});

test("1440 desktop retains the ordered three-panel battle HUD row", async () => {
  const run = await launchCinder(DESKTOP_VIEWPORT);
  try {
    const report = await measureHud(run.page);
    assertDesktopContract(report);
    assert.deepEqual(run.browserErrors, [], "the desktop battle emitted browser errors");
    printMeasurement("DESKTOP_HUD_MEASURED", report, { dismissedCutscenes: run.dismissedCutscenes });
  } finally {
    await run.context.close();
  }
});

test("direct control outcome feedback stays pending until the matching simulation rejection and exposes dash charges", async () => {
  const run = await launchCinder(PHONE_VIEWPORT, { syntheticFrames: true });
  try {
    const pump = async () => {
      await run.page.evaluate(() => window.__pumpDefenseFrame(100));
      await run.page.waitForTimeout(0);
    };
    const attack = run.page.locator("#manual-attack");
    const dash = run.page.locator("#manual-dash");
    const waitForCombatState = async (control, expected, message) => {
      for (let frame = 0; frame < 8 && await control.getAttribute("data-combat-state") !== expected; frame += 1) {
        await pump();
      }
      assert.equal(await control.getAttribute("data-combat-state"), expected, message);
    };
    await waitForCombatState(
      attack,
      "ready",
      "a live direct attack control must become ready before native activation",
    );
    await waitForCombatState(
      dash,
      "ready",
      "a live dash control must become ready before its charge metadata is read",
    );
    assert.equal(await attack.isDisabled(), false, "a ready direct attack control must remain available");
    assert.match(
      await dash.getAttribute("aria-label") ?? "",
      /대시 · 충전 \d+\/\d+/,
      "the dash control must publicly expose its current charge metadata",
    );

    await attack.click();
    const pendingInputId = await attack.getAttribute("data-combat-input-id");
    assert.match(pendingInputId ?? "", /:input:\d+$/, "a real direct-control click must publish the queued simulation input id");
    assert.equal(await attack.getAttribute("data-combat-state"), "pending", "click feedback must remain pending before the simulation processes its input");
    assert.equal(await attack.getAttribute("data-feedback"), "pending", "a click must not masquerade as accepted or rejected feedback");

    for (let frame = 0; frame < 8 && await attack.getAttribute("data-combat-state") !== "rejected"; frame += 1) {
      await pump();
    }
    assert.equal(await attack.getAttribute("data-combat-state"), "rejected", "the opening direct attack must resolve through simulation rejection");
    assert.equal(await attack.getAttribute("data-feedback"), "rejected", "only the matching INPUT_REJECTED outcome may resolve direct-control feedback");
    assert.equal(await attack.getAttribute("data-combat-input-id"), pendingInputId, "resolved feedback must remain correlated to the original simulation input id");
    assert.match(await attack.getAttribute("aria-label") ?? "", /거부 · (대상 없음|사거리 밖)/, "the simulation rejection reason must be visible on its originating control");
    await dash.click();
    const dashInputId = await dash.getAttribute("data-combat-input-id");
    assert.match(dashInputId ?? "", /:input:\d+$/, "a real dash click must publish its queued simulation input id");
    assert.equal(await dash.getAttribute("data-combat-state"), "pending", "dash feedback must remain pending before its simulation outcome");
    for (let frame = 0; frame < 8 && await dash.getAttribute("data-feedback") === "pending"; frame += 1) {
      await pump();
    }
    assert.equal(await dash.getAttribute("data-feedback"), "rejected", "the deterministic blocked dash must resolve only after INPUT_REJECTED");
    assert.equal(await dash.getAttribute("data-combat-input-id"), dashInputId, "dash outcome feedback must remain correlated to the original simulation input id");
    assert.deepEqual(run.browserErrors, [], "direct-control outcome feedback emitted browser errors");
  } finally {
    await run.context.close();
  }
});

test("a real Cinder defeat exposes loss state and same-stage retry restores direct combat", async () => {
  const run = await launchCinder(PHONE_VIEWPORT, { syntheticFrames: true });
  try {
    // No combat input is issued: Cinder's seeded no-action simulation deterministically reaches
    // commander defeat at tick 7210. Batch synthetic RAF callbacks rather than sleeping so this
    // stays a real session-driven terminal transition with a finite diagnostic budget.
    const frameBudget = 1_250;
    const batchSize = 20;
    for (let pumped = 0; pumped < frameBudget && await run.surface.getAttribute("data-defense-state") !== "defeat"; pumped += batchSize) {
      await run.page.evaluate((frames) => {
        for (let frame = 0; frame < frames; frame += 1) window.__pumpDefenseFrame(100);
      }, Math.min(batchSize, frameBudget - pumped));
    }
    assert.equal(
      await run.surface.getAttribute("data-defense-state"),
      "defeat",
      `a no-action Cinder run must reach real DEFEAT within ${frameBudget} synthetic frames`,
    );

    const result = run.surface.locator(".defense-result");
    await result.waitFor({ state: "visible" });
    const retry = result.locator("#result-action");
    assert.equal(await retry.isVisible(), true, "defeat must render a visible in-surface retry action");
    assert.equal(await retry.isDisabled(), false, "the focused defeat retry action must remain available");
    assert.equal(await retry.evaluate((node) => document.activeElement === node), true, "defeat must focus its in-surface retry action");
    assert.match(await result.textContent() ?? "", /등불이 꺼졌습니다/, "the terminal loss reason must remain visible in the public result card");

    const terminalIntegrity = await run.page.evaluate(() => {
      const read = (selector) => {
        const node = document.querySelector(selector);
        return {
          current: node?.dataset.integrityCurrent ?? null,
          max: node?.dataset.integrityMax ?? null,
          text: node?.textContent ?? "",
        };
      };
      return { commander: read("#battle-commander-integrity"), gate: read("#battle-integrity") };
    });
    assert.ok(
      [terminalIntegrity.commander, terminalIntegrity.gate].some(({ current, max, text }) =>
        current === "0" && text.includes(`${current}/${max}`)),
      "the public integrity readouts must visibly identify the integrity that caused defeat",
    );

    for (const selector of ["#manual-attack", "#manual-heavy", "#manual-dash"]) {
      const control = run.page.locator(selector);
      assert.equal(await control.isDisabled(), true, `${selector} must be disabled after terminal defeat`);
      assert.equal(await control.getAttribute("aria-disabled"), "true", `${selector} must expose its disabled terminal state to assistive technology`);
      assert.equal(await control.getAttribute("data-combat-state"), "unavailable", `${selector} must expose terminal unavailability`);
    }

    await retry.click();
    await result.waitFor({ state: "detached" });
    await run.page.waitForFunction(() => {
      const surface = document.querySelector("#defense-battle-surface");
      const commander = document.querySelector("#battle-commander-integrity");
      const gate = document.querySelector("#battle-integrity");
      return surface?.dataset.defenseStarted === "true"
        && commander?.dataset.integrityCurrent === commander?.dataset.integrityMax
        && gate?.dataset.integrityCurrent === gate?.dataset.integrityMax;
    });
    assert.equal(await run.surface.getAttribute("data-stage-id"), "cinder-span", "defeat retry must rebuild the same stage");
    assert.equal(await run.surface.locator(".defense-result").count(), 0, "same-stage retry must remove stale terminal UI");

    for (const selector of ["#manual-attack", "#manual-heavy", "#manual-dash"]) {
      const control = run.page.locator(selector);
      assert.equal(await control.isDisabled(), false, `${selector} must be available in the fresh retry`);
      assert.equal(await control.getAttribute("aria-disabled"), "false", `${selector} must expose fresh-run availability to assistive technology`);
      assert.equal(await control.getAttribute("data-combat-state"), "ready", `${selector} must restore its ready direct-combat state`);
    }
    const retryCutscene = run.page.locator("#defense-cutscene-overlay");
    await retryCutscene.waitFor({ state: "visible" });
    await retryCutscene.locator("[data-cutscene-dismiss]").click();
    await retryCutscene.waitFor({ state: "detached" });

    const restoredAttack = run.page.locator("#manual-attack");
    await restoredAttack.click();
    const restoredInputId = await restoredAttack.getAttribute("data-combat-input-id");
    assert.match(restoredInputId ?? "", /:input:\d+$/, "the restored public attack control must publish its queued simulation input id");
    assert.equal(await restoredAttack.getAttribute("data-combat-state"), "pending", "the restored direct attack must wait for simulation resolution");
    for (let frame = 0; frame < 8 && await restoredAttack.getAttribute("data-combat-state") === "pending"; frame += 1) {
      await run.page.evaluate(() => window.__pumpDefenseFrame(100));
    }
    assert.equal(await restoredAttack.getAttribute("data-combat-state"), "rejected", "the fresh no-target attack must resolve through matching simulation rejection");
    assert.equal(await restoredAttack.getAttribute("data-feedback"), "rejected", "only INPUT_REJECTED may resolve restored direct-control feedback");
    assert.equal(await restoredAttack.getAttribute("data-combat-input-id"), restoredInputId, "the restored control outcome must remain correlated to its own simulation input id");
    assert.deepEqual(run.browserErrors, [], "the defeat and same-stage retry lifecycle emitted browser errors");
  } finally {
    await run.context.close();
  }
});
