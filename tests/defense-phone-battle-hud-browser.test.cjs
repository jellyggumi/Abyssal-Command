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

async function launchCinder(viewport) {
  const context = await browser.newContext({ baseURL: hosting.url, reducedMotion: "reduce", viewport });
  try {
    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });

    await page.goto("/index.html", { waitUntil: "networkidle" });
    await page.locator("#start-defense").click();
    const surface = page.locator('#defense-battle-surface[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    assert.equal(await surface.getAttribute("data-stage-id"), "cinder-span", "a fresh browser must launch Cinder Span");

    const overlay = page.locator("#defense-cutscene-overlay");
    await overlay.waitFor({ state: "visible" });
    const dismissedCutscenes = [];
    for (let index = 0; index < 4; index += 1) {
      const dismiss = page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
      if (await dismiss.count() === 0 || !(await dismiss.isVisible())) break;
      dismissedCutscenes.push(await overlay.getAttribute("data-cutscene-event"));
      await dismiss.click();
      await page.waitForTimeout(25);
    }
    await overlay.waitFor({ state: "detached" });
    assert.equal(dismissedCutscenes[0], "STAGE_STARTED", "the Cinder opening cutscene must be explicitly dismissed");

    return { browserErrors, context, dismissedCutscenes, page };
  } catch (error) {
    await context.close();
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
