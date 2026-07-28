const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const allowMissing = process.argv.includes("--allow-missing-browser");
let playwright;
try { playwright = require("playwright"); } catch (error) {
  if (!allowMissing) throw new Error('require("playwright") failed; install the lock-backed browser dependency.');
  console.log("DEFENSE_HUD_RESPONSIVE_BROWSER_SKIPPED missing Playwright");
}
const ROOT = path.resolve(__dirname, "..");
const VIEWPORTS = [[390, 844], [360, 800], [844, 390], [667, 375], [2056, 1082]];

function server() {
  const host = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname === "/" ? "/index.html" : new URL(req.url, "http://localhost").pathname;
    const file = path.resolve(ROOT, `.${decodeURIComponent(pathname)}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return res.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return res.writeHead(404).end();
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": path.extname(file) === ".js" ? "text/javascript" : path.extname(file) === ".css" ? "text/css" : path.extname(file) === ".json" ? "application/json" : "text/html",
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host,
    url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

async function battle(page, { force = false } = {}) {
  await page.goto("/index.html", { waitUntil: "networkidle" });
  // D9 unified shell: #defense-battle-surface (and its data-defense-ready="true") exists
  // from page load -- the lobby/battle screens no longer swap. data-defense-started is
  // the real "a run is now ticking" signal, set only by BattleSession.beginRun().
  // force: the synthetic 200x100 backbuffer-contract viewport (verifyBackbufferContract)
  // exists only to probe canvas/DPR math -- the CTA is taller than that viewport (no CSS
  // can make it fully in-viewport there), and Playwright's mouse-coordinate `force` click
  // still no-ops when the target point falls outside the viewport, so dispatch a real
  // click event directly instead of driving synthetic mouse coordinates.
  if (force) await page.evaluate(() => document.querySelector("#start-defense").click());
  else await page.locator("#start-defense").click();
  await page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor({ state: "attached" });
}

async function inspect(page, width, height) {
  const report = await page.evaluate(() => {
    const surface = document.querySelector("#defense-battle-surface");
    const canvas = document.querySelector("#defense-canvas");
    const hud = document.querySelector("#defense-edge-hud");
    if (!surface || !canvas || !hud) throw new Error("required battle surface is absent");
    const rect = (node) => {
      const bounds = node.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const surfaceRect = rect(surface);
    const canvasRect = rect(canvas);
    const controls = [...hud.querySelectorAll("button")].map((node) => ({
      rect: rect(node),
      text: node.textContent.trim(),
    }));
    const points = [[.5, .5], [.25, .5], [.75, .5], [.5, .28], [.5, .72]].map(([x, y]) => {
      const px = canvasRect.left + canvasRect.width * x;
      const py = canvasRect.top + canvasRect.height * y;
      const hit = document.elementFromPoint(px, py);
      return { x: px, y: py, canvas: hit === canvas || canvas.contains(hit), surface: surface.contains(hit) };
    });
    return {
      surfaceRect,
      canvasRect,
      controls,
      points,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      rotateText: /rotate|회전/i.test(document.body.innerText),
      state: surface.dataset.defenseState,
    };
  });
  assert.equal(Math.round(report.surfaceRect.width), width, `${width}x${height} surface must be full bleed`);
  assert.equal(Math.round(report.surfaceRect.height), height, `${width}x${height} surface must be full bleed`);
  assert.ok(report.canvasRect.width > 0 && report.canvasRect.height > 0, "canvas must render");
  assert.ok(report.controls.every(({ rect }) => rect.width >= 44 && rect.height >= 44), "every rendered edge control must be at least 44px");
  assert.ok(report.points.every((point) => point.canvas || point.surface), "logical center grid must hit canvas or battle surface, not HUD");
  assert.ok(report.scrollWidth <= report.clientWidth && report.scrollHeight <= report.clientHeight, "battle document must not scroll or overflow");
  if (height > width) assert.equal(report.rotateText, false, "portrait fallback must not show a rotate prompt");
  return report;
}

async function verifyPortraitViewportContract(browser, hosting) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: hosting.url });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript(() => {
    const listeners = new Map();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetLeft: 0,
      offsetTop: 0,
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) {
        listeners.get(type)?.delete(listener);
      },
      emit(type) {
        for (const listener of listeners.get(type) ?? []) listener(new Event(type));
      },
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    window.__defenseFakeViewport = viewport;
  });
  try {
    await battle(page);
    const safeInsets = await page.evaluate(() => {
      const root = document.documentElement;
      root.style.setProperty("--defense-device-safe-top", "11px");
      root.style.setProperty("--defense-device-safe-right", "17px");
      root.style.setProperty("--defense-device-safe-bottom", "23px");
      root.style.setProperty("--defense-device-safe-left", "29px");
      const read = (node) => {
        const style = getComputedStyle(node);
        return {
          top: Number.parseFloat(style.top),
          right: Number.parseFloat(style.right),
          bottom: Number.parseFloat(style.bottom),
          left: Number.parseFloat(style.left),
        };
      };
      const battleCard = [...document.querySelectorAll(".edge-card")].find((node) => !node.classList.contains("defense-toast"));
      const toastCards = [...document.querySelectorAll(".edge-card.defense-toast")];
      return {
        top: read(document.querySelector(".defense-top")),
        bottom: read(document.querySelector(".defense-bottom")),
        cardTop: battleCard ? Number.parseFloat(getComputedStyle(battleCard).top) : null,
        toastTops: toastCards.map((node) => Number.parseFloat(getComputedStyle(node).top)),
      };
    });
    assert.deepEqual({ top: safeInsets.top.top, right: safeInsets.top.right, left: safeInsets.top.left }, { top: 11, right: 17, left: 29 }, "portrait top HUD must stay on physical safe edges, not rotated logical mappings");
    assert.deepEqual({ bottom: safeInsets.bottom.bottom, right: safeInsets.bottom.right, left: safeInsets.bottom.left }, { bottom: 23, right: 17, left: 29 }, "portrait bottom HUD must stay on physical safe edges, not rotated logical mappings");
    // The camera hint is intentionally transient and may expire on slow CI before layout is sampled.
    if (safeInsets.cardTop !== null) {
      assert.equal(safeInsets.cardTop, 11, "portrait battle offer/result cards must avoid the physical top cutout, not the former rotated right edge");
    }
    assert.ok(
      safeInsets.toastTops.every((top) => top >= safeInsets.top.top),
      `portrait camera/status toasts must remain below the physical safe top edge (safe top ${safeInsets.top.top}, toast tops ${safeInsets.toastTops.join(", ")})`,
    );

    const preResize = await page.evaluate(() => {
      const canvas = document.querySelector("#defense-canvas");
      return { canvasWidth: canvas.width, canvasHeight: canvas.height };
    });
    await page.evaluate(() => {
      const viewport = window.__defenseFakeViewport;
      viewport.offsetLeft = 13;
      viewport.offsetTop = 17;
      viewport.width = 360;
      viewport.height = 800;
      viewport.emit("resize");
    });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--defense-physical-width").trim() === "360px");
    const shifted = await page.evaluate(() => {
      const surface = document.querySelector("#defense-battle-surface");
      const canvas = document.querySelector("#defense-canvas");
      const bounds = surface.getBoundingClientRect();
      return {
        left: Math.round(bounds.left),
        top: Math.round(bounds.top),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        renderScale: Number.parseFloat(canvas.dataset.renderScale ?? "1"),
        ratio: Math.min(window.devicePixelRatio || 1, 2),
      };
    });
    assert.deepEqual(
      { left: shifted.left, top: shifted.top, width: shifted.width, height: shifted.height },
      { left: 13, top: 17, width: 360, height: 800 },
      "the shifted visual viewport must define the full-bleed physical battle rectangle",
    );
    const renderScale = shifted.renderScale;
    const nativeWidth = Math.round(800 * shifted.ratio);
    const nativeHeight = Math.round(360 * shifted.ratio);
    // (1) software dynamic-resolution exposes a scale in (0,1]; a real GPU reports exactly 1.
    assert.ok(Number.isFinite(renderScale) && renderScale > 0 && renderScale <= 1, `canvas renderScale must be a finite number in (0,1], got ${renderScale}`);
    // (2) original intent preserved: a visual-viewport resize must propagate to the canvas backing store.
    assert.ok(shifted.canvasWidth !== preResize.canvasWidth || shifted.canvasHeight !== preResize.canvasHeight, `visual viewport resize must change the canvas backing store from ${preResize.canvasWidth}x${preResize.canvasHeight}`);
    // (3) uniform scaling preserves the post-resize logical portrait aspect (800/360), catching aspect distortion.
    assert.ok(Math.abs(shifted.canvasWidth / shifted.canvasHeight - 800 / 360) < 0.02, `canvas backing store must preserve the 800/360 aspect, got ${shifted.canvasWidth}x${shifted.canvasHeight}`);
    // (4) never upscales past native, and software clamps the backbuffer to the 180000px cap.
    assert.ok(shifted.canvasWidth <= nativeWidth && shifted.canvasHeight <= nativeHeight, `canvas backing store must not exceed native ${nativeWidth}x${nativeHeight}, got ${shifted.canvasWidth}x${shifted.canvasHeight}`);
    if (renderScale < 1) assert.ok(shifted.canvasWidth * shifted.canvasHeight <= 180000, `software-clamped canvas must respect the strict 180000px backbuffer cap, got ${shifted.canvasWidth * shifted.canvasHeight}px`);
    // (5) on GPU / no clamp, keep the original exact native-resolution check at full strength.
    if (renderScale === 1) {
      assert.equal(shifted.canvasWidth, nativeWidth, "visual viewport resize must update logical canvas width");
      assert.equal(shifted.canvasHeight, nativeHeight, "visual viewport resize must update logical canvas height");
    }

    // Cycle 3 / D17: canvas drag now orbits the free camera, never movement
    // (movement is exclusively #movement-actions/keyboard, independent of the
    // canvas) — so a canvas drag must NOT change data-defense-move, proving
    // the decoupling holds under the portrait inverse-viewport mapping too.
    const moveBefore = await page.locator("#defense-battle-surface").getAttribute("data-defense-move");
    await page.mouse.move(193, 417);
    await page.mouse.down();
    await page.mouse.move(193, 587);
    await page.waitForTimeout(50);
    assert.equal(await page.locator("#defense-battle-surface").getAttribute("data-defense-move"), moveBefore, "portrait canvas drag must not drive movement (orbit/movement are decoupled, D17)");
    await page.mouse.up();
    // The coordinate transform the old movement assertion actually exercised
    // (physical-viewport-offset + portrait-rotation inverse mapping) is a
    // pure function independent of what the drag now drives — test it
    // directly against DefenseViewport.mapPhysicalToLogical rather than
    // through a movement side-channel that no longer exists.
    const transform = await page.evaluate(async () => {
      const { DefenseViewport } = await import("/defense-viewport.js");
      const viewport = new DefenseViewport();
      // window.__defenseFakeViewport was set to offsetLeft=13/offsetTop=17/width=360/height=800 above.
      return viewport.mapPhysicalToLogical({ clientX: 193, clientY: 587 });
    });
    assert.deepEqual(transform, { x: 570, y: 180 }, "portrait inverse map: physical (193,587) with offset(13,17) -> logical (py=570, width-px=180)");
    assert.deepEqual(errors, [], "portrait viewport contract emitted browser errors");
    return { safeInsets, shifted };
  } finally {
    await context.close();
  }
}

async function verifyBackbufferContract(browser, hosting) {
  const nativeContext = await browser.newContext({
    viewport: { width: 200, height: 100 },
    deviceScaleFactor: 2,
    baseURL: hosting.url,
  });
  const nativePage = await nativeContext.newPage();
  const nativeErrors = [];
  nativePage.on("pageerror", (error) => nativeErrors.push(`page: ${error.message}`));
  nativePage.on("console", (message) => {
    if (message.type() === "error") nativeErrors.push(`console: ${message.text()}`);
  });
  try {
    await battle(nativePage, { force: true });
    const native = await nativePage.evaluate(() => {
      const canvas = document.querySelector("#defense-canvas");
      const surface = document.querySelector("#defense-battle-surface");
      const root = getComputedStyle(document.documentElement);
      return {
        dpr: window.devicePixelRatio,
        logicalWidth: Number.parseFloat(root.getPropertyValue("--defense-logical-width")),
        logicalHeight: Number.parseFloat(root.getPropertyValue("--defense-logical-height")),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        renderScale: Number.parseFloat(canvas.dataset.renderScale ?? "NaN"),
        renderer: surface.dataset.defenseRenderer,
      };
    });
    assert.deepEqual(nativeErrors, [], "DPR=2 native-size browser contract emitted errors");
    assert.equal(native.dpr, 2, "native-size contract must run at DPR=2");
    assert.equal(native.renderer, "webgl", "native-size contract must exercise the WebGL renderer");
    assert.ok(Number.isFinite(native.renderScale) && native.renderScale > 0 && native.renderScale <= 1, `DPR=2 WebGL renderScale must be in (0,1], got ${native.renderScale}`);
    assert.ok(native.canvasWidth <= Math.round(native.logicalWidth * native.dpr), "DPR=2 WebGL canvas width must not exceed native physical pixels");
    assert.ok(native.canvasHeight <= Math.round(native.logicalHeight * native.dpr), "DPR=2 WebGL canvas height must not exceed native physical pixels");
    if (native.renderScale === 1) {
      assert.equal(native.canvasWidth, Math.round(native.logicalWidth * native.dpr), "DPR=2 hardware WebGL canvas width must preserve native physical pixels");
      assert.equal(native.canvasHeight, Math.round(native.logicalHeight * native.dpr), "DPR=2 hardware WebGL canvas height must preserve native physical pixels");
    } else {
      assert.ok(native.canvasWidth * native.canvasHeight <= 180000, `DPR=2 software WebGL backbuffer must respect the strict 180000px cap, got ${native.canvasWidth * native.canvasHeight}px`);
    }
  } finally {
    await nativeContext.close();
  }

  const softwareBrowser = await playwright.chromium.launch({
    headless: true,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const softwareContext = await softwareBrowser.newContext({
    viewport: { width: 844, height: 390 },
    baseURL: hosting.url,
  });
  const softwarePage = await softwareContext.newPage();
  const softwareErrors = [];
  softwarePage.on("pageerror", (error) => softwareErrors.push(`page: ${error.message}`));
  softwarePage.on("console", (message) => {
    if (message.type() === "error") softwareErrors.push(`console: ${message.text()}`);
  });
  try {
    await battle(softwarePage);
    const software = await softwarePage.evaluate(() => {
      const canvas = document.querySelector("#defense-canvas");
      const surface = document.querySelector("#defense-battle-surface");
      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        renderScale: Number.parseFloat(canvas.dataset.renderScale ?? "NaN"),
        renderer: surface.dataset.defenseRenderer,
      };
    });
    assert.deepEqual(softwareErrors, [], "software backbuffer browser contract emitted errors");
    assert.equal(software.renderer, "webgl", "software-cap contract must exercise software WebGL, not Canvas2D fallback");
    assert.ok(Number.isFinite(software.renderScale) && software.renderScale > 0 && software.renderScale < 1, `software WebGL renderScale must be in (0,1), got ${software.renderScale}`);
    assert.ok(software.canvasWidth * software.canvasHeight <= 180000, `software WebGL backbuffer must not exceed the strict 180000px cap, got ${software.canvasWidth * software.canvasHeight}px`);
    const lifecycle = await softwarePage.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 844;
      canvas.height = 390;
      canvas.style.width = "844px";
      canvas.style.height = "390px";
      document.body.append(canvas);
      const { RealtimeBattle } = await import(`/battle-realtime-three.js?render-scale-lifecycle=${Date.now()}`);
      const adapter = new RealtimeBattle();
      adapter.mount({ canvas, viewport: canvas });
      adapter.renderSnapshot({});
      const mounted = {
        value: Number.parseFloat(canvas.dataset.renderScale ?? "NaN"),
        present: Object.hasOwn(canvas.dataset, "renderScale"),
      };
      adapter.dispose();
      return { mounted, afterDispose: canvas.dataset.renderScale ?? null };
    });
    assert.ok(lifecycle.mounted.present && Number.isFinite(lifecycle.mounted.value), "renderScale must be publicly present after mount/render");
    assert.equal(lifecycle.afterDispose, null, "dispose must remove the public renderScale marker");
  } finally {
    await softwareContext.close();
    await softwareBrowser.close();
  }
  const fallbackContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    baseURL: hosting.url,
  });
  const fallbackPage = await fallbackContext.newPage();
  try {
    await fallbackPage.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function forcedNoWebGL(type, ...args) {
        if (type === "webgl2" || type === "webgl") return null;
        return originalGetContext.call(this, type, ...args);
      };
    });
    await battle(fallbackPage);
    const fallback = await fallbackPage.evaluate(() => {
      const canvas = document.querySelector("#defense-canvas");
      const surface = document.querySelector("#defense-battle-surface");
      return {
        renderer: surface.dataset.defenseRenderer,
        renderScale: canvas.dataset.renderScale ?? null,
      };
    });
    assert.equal(fallback.renderer, "canvas2d", "forced WebGL failure must expose the Canvas2D fallback");
    assert.equal(fallback.renderScale, null, "falling back to Canvas2D must remove any renderScale marker");
  } finally {
    await fallbackContext.close();
  }
}

async function run() {
  const hosting = await server();
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const results = [];
    for (const [width, height] of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width, height }, baseURL: hosting.url });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
      await battle(page);
      const before = await page.locator("#defense-battle-surface").getAttribute("data-defense-input-seq");
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(30);
      await page.keyboard.up("ArrowRight");
      await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, before);
      assert.deepEqual(errors, [], `${width}x${height} emitted browser errors`);
      results.push({ viewport: `${width}x${height}`, ...await inspect(page, width, height) });
      await context.close();
    }
    const portraitViewport = await verifyPortraitViewportContract(browser, hosting);
    const backbuffer = await verifyBackbufferContract(browser, hosting);
    console.log(JSON.stringify({ pass: true, results, portraitViewport, backbuffer }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}

if (playwright) run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});