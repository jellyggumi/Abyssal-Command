const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

let playwright;
try {
  playwright = require("playwright");
} catch {
  throw new Error("require('playwright') failed; install the lock-backed browser dependency.");
}

const ROOT = path.resolve(__dirname, "..");
const VIEWPORTS = Object.freeze([
  Object.freeze({ width: 390, height: 844 }),
  Object.freeze({ width: 844, height: 390 }),
]);
const EXPECTED_REQUESTS = Object.freeze([
  "/sprite-2-5d.html",
  "/sprite-2-5d.css",
  "/sprite-2-5d.js",
  "/assets/images/sprite-2-5d/cinder-court-backdrop.png",
  "/assets/images/sprite-2-5d/warden/manifest.json",
  "/assets/images/sprite-2-5d/warden/sprite-sheet.png",
  "/assets/images/sprite-2-5d/ember-cohort/manifest.json",
  "/assets/images/sprite-2-5d/ember-cohort/sprite-sheet.png",
]);

const RUNTIME_TEST_INSTRUMENTATION = `
Object.defineProperty(window, "__sprite2dRuntimeTest", {
  configurable: false,
  value: Object.freeze({
    snapshot: () => ({
      mode: state.mode,
      wave: state.wave,
      reducedMotion: state.reducedMotion,
      playerX: player.x,
      playerY: player.y,
      playerHealth: player.health,
      playerClip: player.clipName,
      loopRunning,
      animationFrameId,
    }),
    endCurrentWave: () => {
      state.pendingSpawns = 0;
      state.livingEnemies = 0;
      state.enemies.length = 0;
      state.hudDirty = true;
    },
    forceGameOver: () => {
      player.damageCooldown = 0;
      damagePlayer(PLAYER_MAX_HEALTH);
    },
  }),
});
`;

function startServer({ failPath = null, instrumentRuntime = true } = {}) {
  const host = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/sprite-2-5d-away.html") {
      response.writeHead(200, { "Content-Type": "text/html" });
      return response.end("<!doctype html><title>Away</title><p id=\"away\">Same-origin navigation target</p>");
    }
    if (pathname === failPath) return response.writeHead(404).end();
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
              : extension === ".png"
                ? "image/png"
                : "application/octet-stream";
      const headers = { "Cache-Control": "no-store", "Content-Type": contentType };
      if (instrumentRuntime && relativePath === "sprite-2-5d.js") {
        return fs.readFile(file, "utf8", (readError, source) => {
          if (readError) return response.writeHead(500).end();
          response.writeHead(200, headers);
          response.end(`${source}\n${RUNTIME_TEST_INSTRUMENTATION}`);
        });
      }
      response.writeHead(200, headers);
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host,
    url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

function installDeterministicAnimationClock() {
  let now = 0;
  let nextId = 1;
  let pending = new Map();
  let scheduled = 0;
  let canceled = 0;
  let callbacksRun = 0;
  const pageShows = [];

  window.addEventListener("pageshow", (event) => pageShows.push(event.persisted), true);
  window.requestAnimationFrame = (callback) => {
    const id = nextId;
    nextId += 1;
    scheduled += 1;
    pending.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (pending.delete(id)) canceled += 1;
  };
  const advance = (count, milliseconds = 1000 / 60) => {
    let runThisAdvance = 0;
    for (let frame = 0; frame < count; frame += 1) {
      now += milliseconds;
      const callbacks = pending;
      pending = new Map();
      for (const callback of callbacks.values()) {
        callback(now);
        callbacksRun += 1;
        runThisAdvance += 1;
      }
    }
    return runThisAdvance;
  };
  window.__spriteTestStepFrames = advance;
  window.__spriteTestClock = Object.freeze({
    advance,
    snapshot: () => ({
      now,
      scheduled,
      canceled,
      callbacksRun,
      pending: pending.size,
      pageShows: [...pageShows],
    }),
  });
}

async function stepFrames(page, count) {
  const callbacksRun = await page.evaluate((frameCount) => window.__spriteTestStepFrames(frameCount), count);
  assert.equal(callbacksRun, count, `the game loop must schedule one animation callback per deterministic frame (${count} requested)`);
}

async function advanceFrames(page, count) {
  return page.evaluate((frameCount) => window.__spriteTestClock.advance(frameCount), count);
}

async function clockSnapshot(page) {
  return page.evaluate(() => window.__spriteTestClock.snapshot());
}

async function runtimeSnapshot(page) {
  return page.evaluate(() => window.__sprite2dRuntimeTest.snapshot());
}

async function canvasDigest(page, rect = { x: 0, y: 0, width: 1536, height: 1024 }) {
  return page.evaluate(({ x, y, width, height }) => {
    const canvas = document.querySelector("#sprite-2-5d-canvas");
    const pixels = canvas.getContext("2d").getImageData(x, y, width, height).data;
    let hash = 2166136261;
    for (let index = 0; index < pixels.length; index += 4) {
      hash ^= pixels[index];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 1];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 2];
      hash = Math.imul(hash, 16777619);
    }
    return { hash: hash >>> 0 };
  }, rect);
}

async function verifyViewport(browser, hosting, viewport) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport });
  const page = await context.newPage();
  const failures = [];
  const responses = new Map();

  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== hosting.url) return;
    responses.set(url.pathname, response.status());
    if (!response.ok()) failures.push(`response: ${url.pathname} ${response.status()}`);
  });
  await page.addInitScript(installDeterministicAnimationClock);

  try {
    const routeResponse = await page.goto("/sprite-2-5d.html", { waitUntil: "load" });
    assert(routeResponse?.ok(), `${viewport.width}x${viewport.height} sprite route response must succeed`);
    const body = page.locator("body:not([data-game-state=\"loading\"])");
    await body.waitFor({ state: "attached" });
    assert.equal(await body.getAttribute("data-game-state"), "running", `sprite route must finish asset validation (${failures.join("; ")})`);

    for (const pathname of EXPECTED_REQUESTS) {
      assert.equal(responses.get(pathname), 200, `${viewport.width}x${viewport.height} must load ${pathname}`);
    }

    const contract = await page.evaluate(() => {
      const canvas = document.querySelector("#sprite-2-5d-canvas");
      const controls = [...document.querySelectorAll("[data-control]")];
      const health = document.querySelector("#sprite-2-5d-health");
      return {
        runtime: document.querySelector("#sprite-2-5d-game")?.dataset.runtime,
        status: document.querySelector("#sprite-2-5d-status")?.textContent?.trim(),
        canvas: canvas && { width: canvas.width, height: canvas.height },
        hud: {
          wave: document.querySelector("#sprite-2-5d-wave")?.textContent,
          score: document.querySelector("#sprite-2-5d-score")?.textContent,
          enemies: document.querySelector("#sprite-2-5d-enemies")?.textContent,
          health: health?.getAttribute("aria-valuenow"),
          healthMax: health?.getAttribute("aria-valuemax"),
          healthText: document.querySelector("#sprite-2-5d-health-value")?.textContent,
          canvasWave: canvas?.dataset.wave,
          canvasScore: canvas?.dataset.score,
          canvasEnemies: canvas?.dataset.enemies,
          canvasHealth: canvas?.dataset.playerHealth,
        },
        controls: controls.map((control) => ({ name: control.dataset.control, disabled: control.disabled })),
        restartLabel: document.querySelector("#sprite-2-5d-restart")?.textContent?.replace(/\s+/g, " ").trim(),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(contract.runtime, "running", "the public game root must expose the running runtime state");
    const statusMatch = /^Wave (\d+)\. (\d+) Ember Cohort signatures entering the court\.$/.exec(contract.status ?? "");
    assert.ok(statusMatch, "the live status must announce the started wave and hostile count");
    assert.deepEqual(
      {
        wave: contract.hud.wave,
        score: contract.hud.score,
        enemies: contract.hud.enemies,
        health: contract.hud.health,
      },
      {
        wave: contract.hud.canvasWave,
        score: contract.hud.canvasScore,
        enemies: contract.hud.canvasEnemies,
        health: contract.hud.canvasHealth,
      },
      "the visible HUD and canvas state hooks must agree",
    );
    assert.equal(statusMatch[1], contract.hud.wave, "the status announcement and wave HUD must agree");
    assert.equal(statusMatch[2], contract.hud.enemies, "the status announcement and hostile HUD must agree");
    assert.equal(contract.hud.healthText, `${contract.hud.health} / ${contract.hud.healthMax}`, "the health meter and visible health output must agree");
    assert.deepEqual(contract.canvas, { width: 1536, height: 1024 }, "the arena canvas must expose its authored render resolution");
    assert.deepEqual(contract.controls, [
      { name: "up", disabled: false },
      { name: "left", disabled: false },
      { name: "right", disabled: false },
      { name: "down", disabled: false },
      { name: "attack", disabled: false },
    ], "the five public controls must be enabled when the route is running");
    assert.match(contract.restartLabel ?? "", /^Rekindle R$/, "the restart hook must retain its player-facing action");
    assert.equal(contract.horizontalOverflow, false, `${viewport.width}x${viewport.height} must not overflow horizontally`);

    await stepFrames(page, 1);
    const playerRegion = { x: 620, y: 420, width: 360, height: 360 };
    const idleFrameZero = await canvasDigest(page, playerRegion);
    await stepFrames(page, 11);
    const idleFrameOne = await canvasDigest(page, playerRegion);
    assert.notEqual(idleFrameOne.hash, idleFrameZero.hash, "manifest-driven idle frames must visibly animate on the canvas");

    const beforeMovement = await canvasDigest(page, playerRegion);
    await page.keyboard.down("ArrowRight");
    await stepFrames(page, 5);
    await page.keyboard.up("ArrowRight");
    const afterMovement = await canvasDigest(page, playerRegion);
    assert.notEqual(afterMovement.hash, beforeMovement.hash, "holding a movement key must visibly move the rendered Warden");

    const beforeAttack = await canvasDigest(page, playerRegion);
    const strikeRegion = { x: 890, y: 530, width: 40, height: 120 };
    const beforeStrike = await canvasDigest(page, strikeRegion);
    await page.keyboard.press("Space");
    let strikeRendered = false;
    let duringAttack = beforeAttack;
    for (let frame = 0; frame < 14; frame += 1) {
      await stepFrames(page, 1);
      duringAttack = await canvasDigest(page, playerRegion);
      const strikeFrame = await canvasDigest(page, strikeRegion);
      strikeRendered ||= strikeFrame.hash !== beforeStrike.hash;
    }
    assert.notEqual(duringAttack.hash, beforeAttack.hash, "the keyboard attack must visibly change the rendered combat frame");
    assert.equal(strikeRendered, true, "the keyboard attack must render visible strike feedback beyond the Warden sprite bounds");

    await page.locator("#sprite-2-5d-restart").evaluate((button) => button.click());
    await stepFrames(page, 1);
    const attackControl = page.locator('[data-control="attack"]');
    const semanticStrikeRegion = { x: 860, y: 530, width: 32, height: 120 };
    const beforeSemanticStrike = await canvasDigest(page, semanticStrikeRegion);
    await attackControl.focus();
    await page.keyboard.press("Enter");
    let semanticStrikeRendered = false;
    for (let frame = 0; frame < 14; frame += 1) {
      await stepFrames(page, 1);
      const strikeFrame = await canvasDigest(page, semanticStrikeRegion);
      semanticStrikeRendered ||= strikeFrame.hash !== beforeSemanticStrike.hash;
    }
    assert.equal(semanticStrikeRendered, true, "focused Attack activated with Enter must render the same visible strike feedback");

    await page.locator("#sprite-2-5d-restart").evaluate((button) => button.click());
    await stepFrames(page, 1);
    const rightControl = page.locator('[data-control="right"]');
    const beforeSemanticNudge = await runtimeSnapshot(page);
    await rightControl.focus();
    await page.keyboard.press("Enter");
    await stepFrames(page, 1);
    const afterSemanticNudge = await runtimeSnapshot(page);
    assert.equal(afterSemanticNudge.playerX, beforeSemanticNudge.playerX + 34, "detail-0 direction activation must apply one discrete movement nudge");
    await stepFrames(page, 1);
    const afterNudgeSettles = await runtimeSnapshot(page);
    assert.equal(afterNudgeSettles.playerX, afterSemanticNudge.playerX, "a semantic direction nudge must not become held movement");


    await rightControl.scrollIntoViewIfNeeded();
    const controlBox = await rightControl.boundingBox();
    assert.ok(controlBox, "the pointer movement control must have a rendered hit target");
    await page.mouse.move(controlBox.x + controlBox.width / 2, controlBox.y + controlBox.height / 2);
    await page.mouse.down();
    assert.equal(await rightControl.evaluate((control) => control.classList.contains("is-active")), true, "pointerdown must visibly activate the movement control");
    await page.mouse.up();
    assert.equal(await rightControl.evaluate((control) => control.classList.contains("is-active")), false, "pointerup must release the movement control");
    await stepFrames(page, 1);
    const afterPointerClick = await runtimeSnapshot(page);
    assert.equal(afterPointerClick.playerX, afterNudgeSettles.playerX, "the detail-1 pointer click must not add a second semantic direction nudge");

    await page.locator("#sprite-2-5d-restart").evaluate((button) => button.click());
    await stepFrames(page, 1);
    const restartedCanvas = await canvasDigest(page, playerRegion);
    const restartedState = await page.evaluate(() => {
      const canvas = document.querySelector("#sprite-2-5d-canvas");
      const health = document.querySelector("#sprite-2-5d-health");
      return {
        state: document.body.dataset.gameState,
        runtime: document.querySelector("#sprite-2-5d-game")?.dataset.runtime,
        controlsActive: document.querySelectorAll("[data-control].is-active").length,
        hud: {
          wave: document.querySelector("#sprite-2-5d-wave")?.textContent,
          score: document.querySelector("#sprite-2-5d-score")?.textContent,
          enemies: document.querySelector("#sprite-2-5d-enemies")?.textContent,
          health: health?.getAttribute("aria-valuenow"),
          healthMax: health?.getAttribute("aria-valuemax"),
          healthText: document.querySelector("#sprite-2-5d-health-value")?.textContent,
          canvasWave: canvas?.dataset.wave,
          canvasScore: canvas?.dataset.score,
          canvasEnemies: canvas?.dataset.enemies,
          canvasHealth: canvas?.dataset.playerHealth,
        },
      };
    });
    await page.locator("#sprite-2-5d-restart").evaluate((button) => button.click());
    await stepFrames(page, 1);
    const repeatedRestartCanvas = await canvasDigest(page, playerRegion);
    assert.deepEqual({
      state: restartedState.state,
      runtime: restartedState.runtime,
      controlsActive: restartedState.controlsActive,
    }, {
      state: "running",
      runtime: "running",
      controlsActive: 0,
    }, "restart must restore the running mode and release input state");
    assert.deepEqual(restartedState.hud, contract.hud, "restart must restore the launch HUD and canvas state");
    assert.equal(repeatedRestartCanvas.hash, restartedCanvas.hash, "repeated restart activation must deterministically return the Warden to the same rendered start state");
    assert.deepEqual(failures, [], `${viewport.width}x${viewport.height} route must not emit request, console, or page errors`);
  } finally {
    await context.close();
  }
}

async function openRunningPage(context) {
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  await page.addInitScript(installDeterministicAnimationClock);
  const response = await page.goto("/sprite-2-5d.html", { waitUntil: "load" });
  assert(response?.ok(), "instrumented sprite route response must succeed");
  const body = page.locator("body:not([data-game-state=\"loading\"])");
  await body.waitFor({ state: "attached" });
  assert.equal(await body.getAttribute("data-game-state"), "running", `instrumented sprite route must run (${failures.join("; ")})`);
  return { page, failures };
}

async function verifyLifecycleResume(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const { page, failures } = await openRunningPage(context);
    await stepFrames(page, 1);
    assert.equal((await clockSnapshot(page)).pending, 1, "the running route must own one pending animation frame before navigation");

    await page.goto("/sprite-2-5d-away.html", { waitUntil: "load" });
    await page.locator("#away").waitFor();
    await page.goBack({ waitUntil: "load" });
    const body = page.locator("body:not([data-game-state=\"loading\"])");
    await body.waitFor({ state: "attached" });
    assert.equal(await body.getAttribute("data-game-state"), "running", "same-origin back navigation must restore a running sprite route");
    assert.equal((await runtimeSnapshot(page)).loopRunning, true, "the animation loop must resume after same-origin back navigation");
    assert.equal((await clockSnapshot(page)).pending, 1, "back navigation must restore exactly one pending animation frame");

    const resumedBefore = await canvasDigest(page, { x: 620, y: 420, width: 360, height: 360 });
    await stepFrames(page, 11);
    const resumedAfter = await canvasDigest(page, { x: 620, y: 420, width: 360, height: 360 });
    assert.notEqual(resumedAfter.hash, resumedBefore.hash, "the restored route must resume manifest-driven canvas animation");

    const persisted = (await clockSnapshot(page)).pageShows.includes(true);
    if (!persisted) {
      for (let cycle = 0; cycle < 2; cycle += 1) {
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
        assert.equal((await runtimeSnapshot(page)).loopRunning, false, `synthetic persisted pagehide ${cycle + 1} must stop the loop`);
        assert.equal((await clockSnapshot(page)).pending, 0, `synthetic persisted pagehide ${cycle + 1} must cancel the pending frame`);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        assert.equal((await runtimeSnapshot(page)).loopRunning, true, `synthetic persisted pageshow ${cycle + 1} must resume the loop`);
        assert.equal((await clockSnapshot(page)).pending, 1, `synthetic persisted pageshow ${cycle + 1} must schedule exactly one frame`);
        await stepFrames(page, 1);
      }
    }
    assert.deepEqual(failures, [], "navigation and lifecycle restoration must not emit page or console errors");
  } finally {
    await context.close();
  }
}

async function verifyTerminalLoopStates(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const { page, failures } = await openRunningPage(context);
    await stepFrames(page, 1);
    const canvasBeforeGameOver = await canvasDigest(page, { x: 620, y: 420, width: 360, height: 360 });
    const clockBeforeGameOver = await clockSnapshot(page);
    await page.evaluate(() => window.__sprite2dRuntimeTest.forceGameOver());
    assert.equal((await runtimeSnapshot(page)).mode, "gameover", "the deterministic terminal fixture must enter gameover");
    assert.equal((await clockSnapshot(page)).pending, 1, "gameover must leave the current frame available for one final render");
    assert.equal(await advanceFrames(page, 1), 1, "gameover must execute its final scheduled render frame");
    const stoppedClock = await clockSnapshot(page);
    assert.equal(stoppedClock.pending, 0, "gameover must not schedule another frame after the final render");
    assert.equal((await runtimeSnapshot(page)).loopRunning, false, "gameover must mark the animation loop stopped");
    assert.equal(await advanceFrames(page, 3), 0, "advancing the deterministic clock after gameover must run no callbacks");
    const canvasAfterGameOver = await canvasDigest(page, { x: 620, y: 420, width: 360, height: 360 });
    assert.notEqual(canvasAfterGameOver.hash, canvasBeforeGameOver.hash, "the final gameover frame must render the terminal player feedback");
    assert.equal(await page.locator("#sprite-2-5d-game-over").isVisible(), true, "the stopped gameover loop must leave Rekindle visible");

    await page.locator("#sprite-2-5d-restart").click();
    const restartedClock = await clockSnapshot(page);
    assert.equal(restartedClock.scheduled, stoppedClock.scheduled + 1, "Rekindle must schedule one new animation frame");
    assert.equal(restartedClock.pending, 1, "Rekindle must resume exactly one pending loop");
    assert.equal((await runtimeSnapshot(page)).loopRunning, true, "Rekindle must mark the loop running");
    await page.locator("#sprite-2-5d-restart").evaluate((button) => button.click());
    const repeatedRestartClock = await clockSnapshot(page);
    assert.equal(repeatedRestartClock.scheduled, restartedClock.scheduled, "restarting while the loop is active must not schedule a duplicate loop");
    assert.equal(repeatedRestartClock.pending, 1, "repeated restart must retain exactly one pending frame");
    assert.equal(await advanceFrames(page, 1), 1, "the resumed loop must execute one callback per deterministic frame");
    assert.equal((await clockSnapshot(page)).pending, 1, "the resumed callback must schedule exactly one successor");
    assert.deepEqual(failures, [], "gameover and Rekindle must not emit page or console errors");
  } finally {
    await context.close();
  }
}

async function measureWaveAdvance(page) {
  await page.locator("#sprite-2-5d-restart").evaluate((button) => button.click());
  await stepFrames(page, 1);
  const startingWave = (await runtimeSnapshot(page)).wave;
  await page.evaluate(() => window.__sprite2dRuntimeTest.endCurrentWave());
  let frames = 0;
  while ((await runtimeSnapshot(page)).wave === startingWave && frames < 180) {
    await stepFrames(page, 1);
    frames += 1;
  }
  assert.notEqual((await runtimeSnapshot(page)).wave, startingWave, "the deterministic cleared-wave fixture must advance to the next wave");
  return frames;
}

async function verifyReducedMotionTiming(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 }, reducedMotion: "no-preference" });
  try {
    const { page, failures } = await openRunningPage(context);
    await stepFrames(page, 1);
    const normalFrames = await measureWaveAdvance(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => window.__sprite2dRuntimeTest.snapshot().reducedMotion);
    const reducedFrames = await measureWaveAdvance(page);
    assert.equal(reducedFrames, normalFrames, "reduced motion must preserve the normal fixed-step wave intermission duration");
    assert.deepEqual(failures, [], "reduced-motion timing verification must not emit page or console errors");
  } finally {
    await context.close();
  }
}

async function verifyAssetErrorStopsLoop(browser) {
  const failedAsset = "/assets/images/sprite-2-5d/warden/manifest.json";
  const hosting = await startServer({ failPath: failedAsset });
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.addInitScript(installDeterministicAnimationClock);
    const response = await page.goto("/sprite-2-5d.html", { waitUntil: "load" });
    assert(response?.ok(), "the error fixture route document must still load");
    const body = page.locator('body[data-game-state="error"]');
    await body.waitFor({ state: "attached" });
    const runtime = await runtimeSnapshot(page);
    const clock = await clockSnapshot(page);
    assert.equal(runtime.loopRunning, false, "asset validation failure must leave the animation loop stopped");
    assert.equal(clock.pending, 0, "asset validation failure must leave no pending animation frame");
    assert.equal(clock.scheduled, 0, "asset validation failure must never start an animation loop");
    assert.equal(await advanceFrames(page, 3), 0, "advancing the deterministic clock after an asset error must run no callbacks");
    assert.deepEqual(pageErrors, [], "the handled asset failure must not escape as a page error");
    assert.ok(consoleErrors.some((message) => message.includes("[sprite-2-5d] Asset initialization failed")), "the handled asset failure must retain its diagnostic console error");
  } finally {
    await context.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}

async function run() {
  const hosting = await startServer();
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    for (const viewport of VIEWPORTS) {
      await verifyViewport(browser, hosting, viewport);
    }
    await verifyLifecycleResume(browser, hosting);
    await verifyTerminalLoopStates(browser, hosting);
    await verifyReducedMotionTiming(browser, hosting);
    await verifyAssetErrorStopsLoop(browser);
    console.log("SPRITE_2_5D_BROWSER_OK 390x844 844x390");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
