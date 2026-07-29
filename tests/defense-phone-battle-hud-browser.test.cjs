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
    await page.goto("/index.html", { waitUntil: "networkidle" });
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
      return {
        box: box(node),
        characterColumns: node.getBoundingClientRect().width / Number.parseFloat(style.fontSize),
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
        movementButtonCount: movement.querySelectorAll("button").length,
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
    assert.ok(heading.characterColumns >= 5, `${name} heading must fit at least five character columns, got ${heading.characterColumns.toFixed(1)}`);
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
  assert.equal(report.bottomControls.movementButtonCount, 5, "all five movement controls must remain rendered");
  assert.ok(report.bottomControls.buttons.length >= 7, "movement, stance, and pause controls must remain available");
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

test("stable combat control IDs remain unique and their native keyboard activation reaches live handlers", async () => {
  const run = await launchCinder(PHONE_VIEWPORT);
  try {
    for (const selector of [
      "#movement-actions",
      "#manual-attack",
      "#skill-actions",
      "#battle-actions",
      "#stance-cycle",
      "#toggle-pause",
    ]) {
      assert.equal(await run.page.locator(selector).count(), 1, `${selector} must remain a unique public control hook`);
    }

    const activateAndWaitForInput = async (selector, key) => {
      const control = run.page.locator(selector);
      await control.focus();
      assert.equal(await control.evaluate((node) => document.activeElement === node), true, `${selector} must accept keyboard focus`);
      const previous = Number(await run.surface.getAttribute("data-defense-input-seq"));
      await run.page.keyboard.press(key);
      await run.page.waitForFunction(
        ({ prior }) => Number(document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq) > prior,
        { prior: previous },
      );
    };

    await activateAndWaitForInput("#manual-attack", "Enter");
    await activateAndWaitForInput('#movement-actions [data-move="E"]', "Enter");
    await run.page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseMove === "E");
    await activateAndWaitForInput("#stance-cycle", "Enter");

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
    await run.page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseState === "active");
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

    let criticalVisible = false;
    for (let frame = 0; frame < 180 && !criticalVisible; frame += 1) {
      await run.page.evaluate(() => window.__pumpDefenseFrame(100));
      const dismiss = run.page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
      if (await dismiss.isVisible()) await dismiss.click();
      const choice = run.page.locator("#defense-growth-offer [data-pick]").first();
      if (await choice.isVisible()) await choice.click();
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
