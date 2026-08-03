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
      playerAttackId: player.attackId,
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
function installLiveDprMediaQueryFake() {
  let devicePixelRatio = 1;
  const mediaQueries = new Set();
  const resolutionPattern = /^\(resolution:\s*([0-9]+(?:\.[0-9]+)?)dppx\)$/;

  const matches = (media) => {
    const match = resolutionPattern.exec(media);
    return match ? Number(match[1]) === devicePixelRatio : false;
  };

  const createMediaQueryList = (media) => {
    let currentMatches = matches(media);
    let onchange = null;
    const listeners = new Set();
    const mediaQueryList = {
      media,
      get matches() {
        return currentMatches;
      },
      get onchange() {
        return onchange;
      },
      set onchange(listener) {
        onchange = typeof listener === "function" ? listener : null;
      },
      addEventListener(type, listener) {
        if (type === "change" && typeof listener === "function") listeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type === "change") listeners.delete(listener);
      },
      addListener(listener) {
        if (typeof listener === "function") listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
      notifyIfChanged() {
        const nextMatches = matches(media);
        if (nextMatches === currentMatches) return;
        currentMatches = nextMatches;
        const event = new Event("change");
        Object.defineProperties(event, {
          matches: { value: currentMatches },
          media: { value: media },
        });
        for (const listener of [...listeners]) listener.call(mediaQueryList, event);
        if (onchange) onchange.call(mediaQueryList, event);
      },
    };
    mediaQueries.add(mediaQueryList);
    return mediaQueryList;
  };

  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    get: () => devicePixelRatio,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (media) => createMediaQueryList(String(media)),
  });
  Object.defineProperty(window, "__spriteLiveDpr", {
    configurable: false,
    value: Object.freeze({
      set(nextDevicePixelRatio) {
        devicePixelRatio = nextDevicePixelRatio;
        for (const mediaQueryList of [...mediaQueries]) mediaQueryList.notifyIfChanged();
      },
    }),
  });
}


function installCanvas2DRenderProbe() {
  const events = [];
  let recording = false;
  const prototype = CanvasRenderingContext2D.prototype;
  const originalDrawImage = prototype.drawImage;
  const originalEllipse = prototype.ellipse;
  const originalArc = prototype.arc;

  const transformSnapshot = (context) => {
    const transform = context.getTransform();
    return {
      a: transform.a,
      b: transform.b,
      c: transform.c,
      d: transform.d,
      e: transform.e,
      f: transform.f,
    };
  };
  const shouldRecord = (context) => recording && context.canvas?.id === "sprite-2-5d-canvas";

  prototype.drawImage = function drawImage(...args) {
    if (shouldRecord(this)) {
      const image = args[0];
      const source = image instanceof HTMLImageElement
        ? new URL(image.currentSrc || image.src, location.href).pathname
        : "";
      const hasNumericRectangles = args.length === 9
        && args.slice(1).every((value) => typeof value === "number" && Number.isFinite(value));
      events.push({
        type: "drawImage",
        argumentCount: args.length,
        source,
        sourceRect: hasNumericRectangles
          ? { x: args[1], y: args[2], width: args[3], height: args[4] }
          : null,
        destinationRect: hasNumericRectangles
          ? { x: args[5], y: args[6], width: args[7], height: args[8] }
          : null,
        sourceSize: hasNumericRectangles && image instanceof HTMLImageElement
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : null,
        transform: transformSnapshot(this),
      });
    }
    return Reflect.apply(originalDrawImage, this, args);
  };
  prototype.ellipse = function ellipse(...args) {
    if (shouldRecord(this)) {
      events.push({
        type: "ellipse",
        args: args.slice(),
        fillStyle: String(this.fillStyle),
        strokeStyle: String(this.strokeStyle),
        lineWidth: this.lineWidth,
        transform: transformSnapshot(this),
      });
    }
    return Reflect.apply(originalEllipse, this, args);
  };
  prototype.arc = function arc(...args) {
    if (shouldRecord(this)) {
      events.push({
        type: "arc",
        args: args.slice(),
        lineWidth: this.lineWidth,
        strokeStyle: String(this.strokeStyle),
        transform: transformSnapshot(this),
      });
    }
    return Reflect.apply(originalArc, this, args);
  };

  Object.defineProperty(window, "__spriteCanvas2DProbe", {
    configurable: false,
    value: Object.freeze({
      reset: () => {
        events.length = 0;
        recording = true;
      },
      take: () => {
        recording = false;
        return events.map((event) => ({
          ...event,
          args: event.args && event.args.slice(),
          sourceRect: event.sourceRect && { ...event.sourceRect },
          destinationRect: event.destinationRect && { ...event.destinationRect },
          sourceSize: event.sourceSize && { ...event.sourceSize },
          transform: { ...event.transform },
        }));
      },
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
  await page.addInitScript(installCanvas2DRenderProbe);

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

    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest?.("[data-control]"))), false, "global Space attack setup must keep focus away from game controls");
    const beforeGlobalSpace = await runtimeSnapshot(page);
    const beforeAttack = await canvasDigest(page, playerRegion);
    const strikeRegion = { x: 890, y: 530, width: 40, height: 120 };
    const beforeStrike = await canvasDigest(page, strikeRegion);
    await page.evaluate(() => window.__spriteCanvas2DProbe.reset());
    await page.keyboard.press("Space");
    let strikeRendered = false;
    let duringAttack = beforeAttack;
    for (let frame = 0; frame < 14; frame += 1) {
      await stepFrames(page, 1);
      duringAttack = await canvasDigest(page, playerRegion);
      const strikeFrame = await canvasDigest(page, strikeRegion);
      strikeRendered ||= strikeFrame.hash !== beforeStrike.hash;
    }
    const attackDrawEvents = await page.evaluate(() => window.__spriteCanvas2DProbe.take());
    const renderedAttackArcs = attackDrawEvents.filter((event) => event.type === "arc" && event.strokeStyle === "#ffb064");
    assert.ok(renderedAttackArcs.length > 0, "the keyboard attack must reach the actual Canvas2D arc draw path");
    assert.ok(
      renderedAttackArcs.every((event) => event.args[2] === 118 && event.lineWidth === 8),
      "the actual attack arc draw must preserve its fixed 118 radius and 8 line width",
    );
    assert.notEqual(duringAttack.hash, beforeAttack.hash, "the keyboard attack must visibly change the rendered combat frame");
    assert.equal(strikeRendered, true, "the keyboard attack must render visible strike feedback beyond the Warden sprite bounds");
    const afterGlobalSpace = await runtimeSnapshot(page);
    assert.equal(afterGlobalSpace.playerAttackId, beforeGlobalSpace.playerAttackId + 1, "global Space away from controls must queue exactly one player attack");

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

    await page.locator("#sprite-2-5d-restart").evaluate((button) => button.click());
    await stepFrames(page, 1);
    const beforeFocusedSpace = await runtimeSnapshot(page);
    await rightControl.focus();
    await page.keyboard.press("Space");
    await stepFrames(page, 1);
    const afterFocusedSpace = await runtimeSnapshot(page);
    assert.equal(afterFocusedSpace.playerX, beforeFocusedSpace.playerX + 34, "native Space on a focused direction control must apply one bounded nudge");
    assert.equal(afterFocusedSpace.playerY, beforeFocusedSpace.playerY, "focused direction Space must preserve the orthogonal player axis");
    assert.equal(afterFocusedSpace.playerAttackId, beforeFocusedSpace.playerAttackId, "focused direction Space must not leak into the global player attack");
    assert.notEqual(afterFocusedSpace.playerClip, "attack", "focused direction Space must not enter the attack animation");
    await stepFrames(page, 1);
    const afterFocusedSpaceSettles = await runtimeSnapshot(page);
    assert.equal(afterFocusedSpaceSettles.playerX, afterFocusedSpace.playerX, "focused direction Space must nudge once instead of becoming held movement");
    assert.equal(afterFocusedSpaceSettles.playerAttackId, beforeFocusedSpace.playerAttackId, "settling a focused direction Space nudge must not queue a delayed attack");


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
    assert.equal(afterPointerClick.playerX, afterFocusedSpaceSettles.playerX, "the detail-1 pointer click must not add a second semantic direction nudge");

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
  await page.addInitScript(installCanvas2DRenderProbe);
  const response = await page.goto("/sprite-2-5d.html", { waitUntil: "load" });
  assert(response?.ok(), "instrumented sprite route response must succeed");
  const body = page.locator("body:not([data-game-state=\"loading\"])");
  await body.waitFor({ state: "attached" });
  assert.equal(await body.getAttribute("data-game-state"), "running", `instrumented sprite route must run (${failures.join("; ")})`);
  return { page, failures };
}

async function verifyDepthPerspective(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const { page, failures } = await openRunningPage(context);
    let renderSnapshot;
    let frames = 0;
    while (frames < 120) {
      renderSnapshot = await page.evaluate(() => window.__SPRITE_2_5D_TEST__.readRenderSnapshot());
      if (renderSnapshot.actors.filter((actor) => actor.kind === "enemy").length >= 2) {
        break;
      }
      await stepFrames(page, 1);
      frames += 1;
    }

    await page.evaluate(() => window.__spriteCanvas2DProbe.reset());
    await stepFrames(page, 1);
    const frameDrawEvents = await page.evaluate(() => window.__spriteCanvas2DProbe.take());
    renderSnapshot = await page.evaluate(() => window.__SPRITE_2_5D_TEST__.readRenderSnapshot());

    const depthProof = await page.evaluate(() => {
      const canvas = document.querySelector("#sprite-2-5d-canvas");
      const context2d = canvas.getContext("2d");
      const descriptor = Object.getOwnPropertyDescriptor(window, "__SPRITE_2_5D_TEST__");
      const hook = descriptor.value;
      const firstSnapshot = hook.readRenderSnapshot();
      const secondSnapshot = hook.readRenderSnapshot();
      const firstActor = firstSnapshot.actors[0];
      const depthScales = [];
      for (let y = 334; y <= 874; y += 1) {
        depthScales.push(hook.depthScaleAtY(y));
      }
      window.__spriteDepthSnapshotBaseline = {
        snapshot: firstSnapshot,
        serialized: JSON.stringify(firstSnapshot),
      };
      return {
        hook: {
          configurable: descriptor.configurable,
          enumerable: descriptor.enumerable,
          writable: descriptor.writable,
          frozen: Object.isFrozen(hook),
        },
        snapshot: {
          frozen: Object.isFrozen(firstSnapshot),
          backingScaleReadOnly: Object.getOwnPropertyDescriptor(firstSnapshot, "backingScale")?.writable === false,
          actorsFrozen: Object.isFrozen(firstSnapshot.actors),
          actorFrozen: Object.isFrozen(firstActor),
          anchorFrozen: Object.isFrozen(firstActor.spriteAnchor),
          destinationFrozen: Object.isFrozen(firstActor.spriteDest),
          geometryFrozen: Object.isFrozen(firstActor.shadow),
          snapshotsDistinct: firstSnapshot !== secondSnapshot,
          actorsDistinct: firstSnapshot.actors !== secondSnapshot.actors,
          actorCopiesDistinct: firstActor !== secondSnapshot.actors[0],
          geometryCopiesDistinct: firstActor.shadow !== secondSnapshot.actors[0].shadow,
        },
        context: {
          isCanvas2D: context2d instanceof CanvasRenderingContext2D,
          matchesCanvasContext: canvas.getContext("2d") === context2d,
          webglUnavailable: canvas.getContext("webgl") === null,
        },
        depthScales,
        belowArenaScale: hook.depthScaleAtY(-1000),
        aboveArenaScale: hook.depthScaleAtY(2000),
      };
    });

    assert.deepEqual(depthProof.hook, {
      configurable: false,
      enumerable: false,
      writable: false,
      frozen: true,
    }, "the public render snapshot hook must remain read-only");
    assert.deepEqual(depthProof.snapshot, {
      frozen: true,
      backingScaleReadOnly: true,
      actorsFrozen: true,
      actorFrozen: true,
      anchorFrozen: true,
      destinationFrozen: true,
      geometryFrozen: true,
      snapshotsDistinct: true,
      actorsDistinct: true,
      actorCopiesDistinct: true,
      geometryCopiesDistinct: true,
    }, "render snapshots must be fresh frozen copies rather than reusable draw scratch aliases");
    assert.deepEqual(depthProof.context, {
      isCanvas2D: true,
      matchesCanvasContext: true,
      webglUnavailable: true,
    }, "the sprite route must render exclusively through its CanvasRenderingContext2D");
    assert.ok(renderSnapshot, "the read-only hook must return a render snapshot");
    assert.equal(renderSnapshot.renderer, "canvas2d", "the render snapshot must identify the Canvas2D renderer");
    assert.equal(depthProof.depthScales[0], 0.62, "far arena depth must start at scale 0.62");
    assert.equal(depthProof.depthScales.at(-1), 1, "near arena depth must end at scale 1.0");
    assert.equal(depthProof.belowArenaScale, 0.62, "depth scale must clamp below the arena");
    assert.equal(depthProof.aboveArenaScale, 1, "depth scale must clamp above the arena");
    assert.equal(new Set(depthProof.depthScales).size, 10, "arena depth must quantize to exactly 10 scale levels");
    for (let index = 1; index < depthProof.depthScales.length; index += 1) {
      assert.ok(
        depthProof.depthScales[index - 1] <= depthProof.depthScales[index],
        "quantized depth scale must be nondecreasing across every arena y",
      );
    }

    const enemies = renderSnapshot.actors.filter((actor) => actor.kind === "enemy");
    assert.ok(enemies.length >= 2, "the deterministic clock must spawn a far/near enemy pair");
    assert.deepEqual(
      renderSnapshot.actors.map((actor) => actor.drawOrder),
      renderSnapshot.actors.map((_, index) => index),
      "actor drawOrder must match painter order",
    );
    for (let index = 1; index < renderSnapshot.actors.length; index += 1) {
      assert.ok(
        renderSnapshot.actors[index - 1].y <= renderSnapshot.actors[index].y,
        "actor painter order must remain sorted from far to near by world y",
      );
    }

    const actorDrawEvents = frameDrawEvents.filter((event) => event.type === "drawImage" && event.argumentCount === 9);
    const shadowDrawEvents = frameDrawEvents.filter((event) => event.type === "ellipse" && event.fillStyle === "#020407");
    assert.equal(actorDrawEvents.length, renderSnapshot.actors.length, "one actual sprite draw must be consumed for every snapshotted actor");
    assert.equal(shadowDrawEvents.length, renderSnapshot.actors.length, "one actual shadow draw must be consumed for every snapshotted actor");
    for (let index = 0; index < renderSnapshot.actors.length; index += 1) {
      const actor = renderSnapshot.actors[index];
      const spriteDraw = actorDrawEvents[index];
      const shadowDraw = shadowDrawEvents[index];
      assert.deepEqual(
        { x: spriteDraw.transform.e, y: spriteDraw.transform.f },
        actor.spriteAnchor,
        "actual sprite draw order and translate anchor must match the y-sorted render snapshot",
      );
      assert.equal(
        Math.abs(spriteDraw.transform.a / renderSnapshot.backingScale),
        1,
        "actual Canvas2D actor transforms must retain a unit horizontal facing scale",
      );
      assert.deepEqual(
        {
          x: spriteDraw.transform.a / renderSnapshot.backingScale,
          y: spriteDraw.transform.d / renderSnapshot.backingScale,
          skewX: Math.abs(spriteDraw.transform.c),
          skewY: Math.abs(spriteDraw.transform.b),
        },
        {
          x: Math.sign(spriteDraw.transform.a),
          y: 1,
          skewX: 0,
          skewY: 0,
        },
        "actual Canvas2D actor transforms must only mirror horizontally after backing-scale normalization",
      );
      assert.deepEqual(
        spriteDraw.destinationRect,
        actor.spriteDest,
        "actual Canvas2D sprite draws must consume the snapshotted integer destination rectangle",
      );
      assert.ok(
        Object.values(spriteDraw.destinationRect).every(Number.isInteger),
        "all actual actor sprite destination coordinates and dimensions must be integer snapped",
      );
      assert.ok(
        spriteDraw.sourceRect
          && spriteDraw.sourceSize
          && spriteDraw.sourceRect.x >= 0
          && spriteDraw.sourceRect.y >= 0
          && spriteDraw.sourceRect.width > 0
          && spriteDraw.sourceRect.height > 0
          && spriteDraw.sourceRect.x + spriteDraw.sourceRect.width <= spriteDraw.sourceSize.width
          && spriteDraw.sourceRect.y + spriteDraw.sourceRect.height <= spriteDraw.sourceSize.height,
        "actual actor sprite source rectangles must stay within their image sheet bounds",
      );
      assert.deepEqual(
        shadowDraw.args.slice(0, 4),
        [actor.shadow.centerX, actor.shadow.centerY, actor.shadow.radiusX, actor.shadow.radiusY],
        "the actual Canvas2D shadow draw must consume the shared attached geometry",
      );
    }

    const farActor = enemies[0];
    const nearActor = enemies[enemies.length - 1];
    assert.ok(farActor.y < nearActor.y, "the deterministic actor pair must span distinct depth buckets");
    assert.ok(farActor.drawOrder < nearActor.drawOrder, "the far actor must draw before the near actor");
    const depthRatio = nearActor.depthScale / farActor.depthScale;
    const spriteRatio = nearActor.spriteScale / farActor.spriteScale;
    const geometryTolerance = 1e-9;
    assert.ok(
      spriteRatio > 1.1,
      `the near actor sprite must render measurably larger than the far actor sprite (ratio ${spriteRatio})`,
    );
    assert.ok(
      Math.abs(spriteRatio - depthRatio) < geometryTolerance,
      "enemy sprite scale must derive from the same quantized depth factor",
    );
    const farActorDraw = actorDrawEvents[farActor.drawOrder];
    const nearActorDraw = actorDrawEvents[nearActor.drawOrder];
    const actualSpriteRatio = nearActorDraw.destinationRect.width / farActorDraw.destinationRect.width;
    assert.ok(
      farActor.drawOrder < nearActor.drawOrder,
      "the actual Canvas2D draw sequence must paint the far actor before the near actor",
    );
    assert.ok(
      actualSpriteRatio > 1.1,
      `the actual snapped near sprite destination must exceed the far destination by 10% (ratio ${actualSpriteRatio})`,
    );

    const assertRatio = (nearValue, farValue, label) => {
      const ratio = nearValue / farValue;
      assert.ok(
        Math.abs(ratio - depthRatio) < geometryTolerance,
        `${label} must derive from the same quantized depth factor (${ratio} versus ${depthRatio})`,
      );
    };
    assertRatio(nearActor.shadow.radiusX, farActor.shadow.radiusX, "shadow width");
    assertRatio(nearActor.shadow.radiusY, farActor.shadow.radiusY, "shadow height");
    assertRatio(
      nearActor.spriteAnchor.y - nearActor.shadow.centerY,
      farActor.spriteAnchor.y - farActor.shadow.centerY,
      "shadow anchor offset",
    );
    assertRatio(nearActor.hitFlash.radiusX, farActor.hitFlash.radiusX, "hit cue width");
    assertRatio(nearActor.hitFlash.radiusY, farActor.hitFlash.radiusY, "hit cue height");
    assertRatio(nearActor.hitFlash.lineWidth, farActor.hitFlash.lineWidth, "hit cue line width");
    assertRatio(
      nearActor.spriteAnchor.y - nearActor.hitFlash.centerY,
      farActor.spriteAnchor.y - farActor.hitFlash.centerY,
      "hit cue anchor offset",
    );
    assertRatio(nearActor.healthBar.width, farActor.healthBar.width, "health cue width");
    assertRatio(nearActor.healthBar.height, farActor.healthBar.height, "health cue height");
    assertRatio(nearActor.healthBar.inset, farActor.healthBar.inset, "health cue inset");
    assertRatio(
      nearActor.spriteAnchor.y - nearActor.healthBar.y,
      farActor.spriteAnchor.y - farActor.healthBar.y,
      "health cue anchor offset",
    );
    for (const actor of renderSnapshot.actors) {
      assert.equal(actor.shadow.centerX, actor.spriteAnchor.x, "shadow must share the rounded sprite x anchor");
      assert.equal(actor.hitFlash.centerX, actor.spriteAnchor.x, "hit cue must share the rounded sprite x anchor");
      assert.ok(
        Math.abs(actor.shadow.centerY - (actor.spriteAnchor.y - 2 * actor.depthScale)) < geometryTolerance,
        "shadow must offset from the rounded sprite y anchor",
      );
      assert.ok(
        Math.abs(actor.hitFlash.centerY - (actor.spriteAnchor.y - 79 * actor.depthScale)) < geometryTolerance,
        "hit cue must offset from the rounded sprite y anchor",
      );
      if (actor.healthBar) {
        assert.ok(
          Math.abs((actor.healthBar.x + actor.healthBar.width / 2) - actor.spriteAnchor.x) < geometryTolerance,
          "health cue must stay horizontally centered on the rounded sprite anchor",
        );
        assert.ok(
          Math.abs(actor.healthBar.y - (actor.spriteAnchor.y - 176 * actor.depthScale)) < geometryTolerance,
          "health cue must offset from the rounded sprite y anchor",
        );
      }
      if (actor.groundRing) {
        assert.deepEqual(
          { x: actor.groundRing.centerX, y: actor.groundRing.centerY },
          actor.spriteAnchor,
          "ground ring must share the rounded sprite anchor",
        );
      }
      if (actor.attackArc) {
        assert.equal(actor.attackArc.centerX, actor.spriteAnchor.x, "attack cue must share the rounded sprite x anchor");
        assert.ok(
          Math.abs(actor.attackArc.centerY - (actor.spriteAnchor.y - 54 * actor.depthScale)) < geometryTolerance,
          "attack cue must offset from the rounded sprite y anchor",
        );
      }
    }
    await stepFrames(page, 1);
    const snapshotStability = await page.evaluate(() => {
      const baseline = window.__spriteDepthSnapshotBaseline;
      const current = window.__SPRITE_2_5D_TEST__.readRenderSnapshot();
      const result = {
        baselineUnchanged: JSON.stringify(baseline.snapshot) === baseline.serialized,
        currentDistinct: current !== baseline.snapshot,
        actorArrayDistinct: current.actors !== baseline.snapshot.actors,
        geometryDistinct: current.actors[0].shadow !== baseline.snapshot.actors[0].shadow,
      };
      delete window.__spriteDepthSnapshotBaseline;
      return result;
    });
    assert.deepEqual(snapshotStability, {
      baselineUnchanged: true,
      currentDistinct: true,
      actorArrayDistinct: true,
      geometryDistinct: true,
    }, "later frames must not mutate prior frozen render snapshots or reuse their geometry objects");
    assert.deepEqual(failures, [], "depth perspective verification must not emit page or console errors");
  } finally {
    await context.close();
  }
}

async function verifyPixelStableDpr(browser, hosting) {
  const requestedDprs = [1, 1.5, 2];
  let baselineActors = null;

  for (const requestedDpr of requestedDprs) {
    const context = await browser.newContext({
      baseURL: hosting.url,
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: requestedDpr,
    });
    try {
      const { page, failures } = await openRunningPage(context);
      let renderSnapshot;
      let frames = 0;
      while (frames < 120) {
        renderSnapshot = await page.evaluate(() => window.__SPRITE_2_5D_TEST__.readRenderSnapshot());
        if (renderSnapshot.actors.filter((actor) => actor.kind === "enemy").length >= 2) {
          break;
        }
        await stepFrames(page, 1);
        frames += 1;
      }
      assert.ok(
        renderSnapshot.actors.filter((actor) => actor.kind === "enemy").length >= 2,
        `DPR ${requestedDpr} must reach the deterministic far/near actor fixture`,
      );

      await page.evaluate(() => window.__spriteCanvas2DProbe.reset());
      await stepFrames(page, 1);
      const dprProof = await page.evaluate(() => {
        const canvas = document.querySelector("#sprite-2-5d-canvas");
        const snapshot = window.__SPRITE_2_5D_TEST__.readRenderSnapshot();
        return {
          effectiveDpr: window.devicePixelRatio,
          backingCanvas: { width: canvas.width, height: canvas.height },
          imageRendering: getComputedStyle(canvas).imageRendering,
          snapshot: {
            backingScale: snapshot.backingScale,
            frozen: Object.isFrozen(snapshot),
            backingScaleReadOnly: Object.getOwnPropertyDescriptor(snapshot, "backingScale")?.writable === false,
            destinationsFrozen: snapshot.actors.every((actor) => Object.isFrozen(actor.spriteDest)),
            actors: snapshot.actors,
          },
          drawEvents: window.__spriteCanvas2DProbe.take(),
        };
      });

      assert.equal(dprProof.effectiveDpr, requestedDpr, `the DPR ${requestedDpr} browser context must be active`);
      assert.deepEqual(
        dprProof.backingCanvas,
        { width: 1536 * requestedDpr, height: 1024 * requestedDpr },
        `DPR ${requestedDpr} must scale the canvas backing store without changing logical coordinates`,
      );
      assert.deepEqual(
        {
          backingScale: dprProof.snapshot.backingScale,
          frozen: dprProof.snapshot.frozen,
          backingScaleReadOnly: dprProof.snapshot.backingScaleReadOnly,
          destinationsFrozen: dprProof.snapshot.destinationsFrozen,
        },
        {
          backingScale: dprProof.effectiveDpr,
          frozen: true,
          backingScaleReadOnly: true,
          destinationsFrozen: true,
        },
        `DPR ${requestedDpr} must publish an immutable effective backing scale with immutable snapped destinations`,
      );
      assert.equal(
        dprProof.imageRendering,
        "pixelated",
        `DPR ${requestedDpr} must preserve nearest-neighbor CSS image rendering`,
      );

      const actorDrawEvents = dprProof.drawEvents.filter((event) => event.type === "drawImage" && event.argumentCount === 9);
      assert.equal(
        actorDrawEvents.length,
        dprProof.snapshot.actors.length,
        `DPR ${requestedDpr} must emit one nine-argument actor draw for every snapshot actor`,
      );
      for (let index = 0; index < dprProof.snapshot.actors.length; index += 1) {
        const actor = dprProof.snapshot.actors[index];
        const spriteDraw = actorDrawEvents[index];
        assert.deepEqual(
          spriteDraw.destinationRect,
          actor.spriteDest,
          `DPR ${requestedDpr} actor ${actor.id} must draw its snapshotted destination rectangle`,
        );
        assert.ok(
          Object.values(spriteDraw.destinationRect).every(Number.isInteger),
          `DPR ${requestedDpr} actor ${actor.id} must use integer destination coordinates and dimensions`,
        );
        assert.equal(
          Math.abs(spriteDraw.transform.a / dprProof.snapshot.backingScale),
          1,
          `DPR ${requestedDpr} actor ${actor.id} must retain a unit horizontal facing scale`,
        );
        assert.deepEqual(
          {
            x: spriteDraw.transform.a / dprProof.snapshot.backingScale,
            y: spriteDraw.transform.d / dprProof.snapshot.backingScale,
            skewX: Math.abs(spriteDraw.transform.c),
            skewY: Math.abs(spriteDraw.transform.b),
          },
          {
            x: Math.sign(spriteDraw.transform.a),
            y: 1,
            skewX: 0,
            skewY: 0,
          },
          `DPR ${requestedDpr} actor ${actor.id} must use a unit facing-only transform`,
        );
      }

      if (baselineActors === null) {
        baselineActors = dprProof.snapshot.actors;
      } else {
        assert.deepEqual(
          dprProof.snapshot.actors,
          baselineActors,
          `DPR ${requestedDpr} must preserve the DPR 1 logical actor snapshots and snapped destinations`,
        );
      }
      assert.deepEqual(failures, [], `DPR ${requestedDpr} pixel-stability verification must not emit page or console errors`);
    } finally {
      await context.close();
    }
  }
}

async function verifyLiveDprMediaQueryRebind(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.addInitScript(installLiveDprMediaQueryFake);
    await page.addInitScript(installDeterministicAnimationClock);
    await page.addInitScript(installCanvas2DRenderProbe);
    const response = await page.goto("/sprite-2-5d.html", { waitUntil: "load" });
    assert(response?.ok(), "live-DPR sprite route response must succeed");
    const body = page.locator("body:not([data-game-state=\"loading\"])");
    await body.waitFor({ state: "attached" });
    assert.equal(await body.getAttribute("data-game-state"), "running", "live-DPR sprite route must run");

    for (const { dpr, width, height } of [
      { dpr: 1, width: 1536, height: 1024 },
      { dpr: 1.5, width: 2304, height: 1536 },
      { dpr: 2, width: 3072, height: 2048 },
    ]) {
      if (dpr !== 1) {
        await page.evaluate((nextDpr) => window.__spriteLiveDpr.set(nextDpr), dpr);
      }
      const proof = await page.evaluate(() => {
        const canvas = document.querySelector("#sprite-2-5d-canvas");
        const snapshot = window.__SPRITE_2_5D_TEST__.readRenderSnapshot();
        return {
          canvas: { width: canvas.width, height: canvas.height },
          snapshot: {
            backingScale: snapshot.backingScale,
            frozen: Object.isFrozen(snapshot),
            backingScaleReadOnly: Object.getOwnPropertyDescriptor(snapshot, "backingScale")?.writable === false,
          },
        };
      });
      assert.deepEqual(
        proof,
        {
          canvas: { width, height },
          snapshot: {
            backingScale: dpr,
            frozen: true,
            backingScaleReadOnly: true,
          },
        },
        `DPR media-query transition to ${dpr} must update the physical backing store and immutable snapshot without resize`,
      );
    }
    assert.deepEqual(failures, [], "live DPR media-query transitions must not emit page or console errors");
  } finally {
    await context.close();
  }
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
    await verifyDepthPerspective(browser, hosting);
    await verifyPixelStableDpr(browser, hosting);
    await verifyLiveDprMediaQueryRebind(browser, hosting);
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
