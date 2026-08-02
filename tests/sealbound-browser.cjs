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
const REQUIRED_REQUESTS = Object.freeze([
  "/sealbound.html",
  "/sealbound.css",
  "/sealbound.js",
  "/assets/images/battle/ui/stages/cinder-span.png",
  "/assets/images/battle/ui/stages/abyss-chancel.png",
  "/assets/images/battle/ui/stages/echo-throne-steps.png",
  "/assets/images/sprite-2-5d/warden/sprite-sheet.png",
  "/assets/images/sprite-2-5d/ember-cohort/sprite-sheet.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
]);
const PRESENTATION_REQUESTS = Object.freeze(REQUIRED_REQUESTS.slice(0, 8));

function startServer() {
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
              : extension === ".png"
                ? "image/png"
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

function installDeterministicAnimationClock() {
  let now = 0;
  let nextId = 1;
  let pending = new Map();
  let scheduled = 0;
  let canceled = 0;
  let callbacksRun = 0;

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
  Object.defineProperty(window, "__sealboundTestClock", {
    configurable: false,
    value: Object.freeze({
      advance,
      snapshot: () => ({ now, scheduled, canceled, callbacksRun, pending: pending.size }),
    }),
  });
}

function collectFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  return failures;
}

async function waitForRunning(page, label, failures) {
  try {
    await page.locator('body[data-game-state="running"]').waitFor({ state: "attached" });
  } catch (error) {
    const state = await page.locator("body").getAttribute("data-game-state").catch(() => null);
    assert.fail(`${label} must reach body[data-game-state=running]; observed ${String(state)} (${failures.join("; ") || error.message})`);
  }
}

async function snapshot(page) {
  return page.evaluate(() => window.__SEALBOUND_TEST__.snapshot());
}

async function openRunningPage(context, hosting, { deterministicClock = false } = {}) {
  const page = await context.newPage();
  const failures = collectFailures(page);
  const responses = new Map();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === hosting.url) responses.set(url.pathname, response.status());
  });
  if (deterministicClock) await page.addInitScript(installDeterministicAnimationClock);
  const routeResponse = await page.goto("/sealbound.html", { waitUntil: "load" });
  assert(routeResponse?.ok(), `Sealbound route must return 200, received ${routeResponse?.status() ?? "no response"}`);
  await waitForRunning(page, "Sealbound route", failures);
  return { page, failures, responses };
}

async function verifyRequiredAssets(page, hosting, responses, viewport) {
  for (const pathname of REQUIRED_REQUESTS) {
    const response = await page.request.get(new URL(pathname, hosting.url).href);
    assert.equal(response.status(), 200, `${viewport.width}x${viewport.height} required asset ${pathname} must return 200`);
  }
  for (const pathname of PRESENTATION_REQUESTS) {
    assert.equal(responses.get(pathname), 200, `${viewport.width}x${viewport.height} route must request ${pathname} successfully`);
  }
}

async function verifyViewport(browser, hosting, viewport) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport });
  try {
    const { page, failures, responses } = await openRunningPage(context, hosting);
    await verifyRequiredAssets(page, hosting, responses, viewport);

    const publicContract = await page.evaluate(() => {
      const fronts = [...document.querySelectorAll("[data-front-index]")];
      const abilities = [...document.querySelectorAll("[data-ability]")];
      const restart = document.querySelector("#sealbound-restart");
      const status = document.querySelector("#sealbound-status");
      const frontScenes = [...document.querySelectorAll("[data-front-scene]")];
      const spriteCells = ["warden", "ember-cohort"].map((id) => {
        const cell = document.querySelector(`[data-sprite="${id}"] .sprite-cell`);
        const sheet = cell?.querySelector(".sprite-sheet");
        return {
          id,
          overflow: cell && getComputedStyle(cell).overflow,
          backgroundImage: sheet && getComputedStyle(sheet).backgroundImage,
        };
      });
      return {
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
        fronts: fronts.map((button) => ({
          index: button.getAttribute("data-front-index"),
          tagName: button.tagName,
          type: button.getAttribute("type"),
        })),
        abilities: abilities.map((button) => ({
          id: button.getAttribute("data-ability"),
          tagName: button.tagName,
          type: button.getAttribute("type"),
        })),
        restart: restart && { tagName: restart.tagName, type: restart.getAttribute("type") },
        status: status && {
          role: status.getAttribute("role"),
          live: status.getAttribute("aria-live"),
          text: status.textContent?.trim(),
        },
        meters: document.querySelectorAll('meter, [role="progressbar"]').length,
        frontScenes: frontScenes.map((scene) => ({
          id: scene.getAttribute("data-front-scene"),
          active: scene.classList.contains("is-active"),
          backgroundImage: getComputedStyle(scene).backgroundImage,
        })),
        spriteCells,
        canvasCount: document.querySelectorAll("canvas").length,
      };
    });
    assert.equal(publicContract.horizontalOverflow, false, `${viewport.width}x${viewport.height} must not overflow horizontally`);
    assert.deepEqual(publicContract.fronts, [
      { index: "0", tagName: "BUTTON", type: "button" },
      { index: "1", tagName: "BUTTON", type: "button" },
      { index: "2", tagName: "BUTTON", type: "button" },
    ], "all three fronts must be semantic pointer controls");
    assert.deepEqual(publicContract.abilities, [
      { id: "crescent", tagName: "BUTTON", type: "button" },
      { id: "rift-lance", tagName: "BUTTON", type: "button" },
      { id: "bind-seal", tagName: "BUTTON", type: "button" },
    ], "all three abilities must be semantic controls");
    assert.deepEqual(publicContract.restart, { tagName: "BUTTON", type: "button" }, "restart must be a semantic button");
    assert.deepEqual(
      { role: publicContract.status?.role, live: publicContract.status?.live },
      { role: "status", live: "polite" },
      "combat status must be a polite live region",
    );
    assert.ok(publicContract.status?.text, "combat status must expose player-readable text");
    assert.ok(publicContract.meters >= 2, "integrity and energy must be exposed as semantic meters");
    assert.deepEqual(
      publicContract.frontScenes.map(({ id, active }) => ({ id, active })),
      [
        { id: "cinder-span", active: true },
        { id: "abyss-chancel", active: false },
        { id: "echo-throne", active: false },
      ],
      "the three authored front scenes must mount with Cinder Span initially active",
    );
    for (const [index, assetName] of ["cinder-span.png", "abyss-chancel.png", "echo-throne-steps.png"].entries()) {
      assert.ok(publicContract.frontScenes[index].backgroundImage.includes(assetName), `${assetName} must drive its DOM/CSS front layer`);
    }
    assert.deepEqual(
      publicContract.spriteCells.map(({ id, overflow }) => ({ id, overflow })),
      [
        { id: "warden", overflow: "hidden" },
        { id: "ember-cohort", overflow: "hidden" },
      ],
      "both sprite sheets must render through clipped DOM cells",
    );
    assert.ok(publicContract.spriteCells[0].backgroundImage.includes("/warden/sprite-sheet.png"), "the Warden sprite cell must use its generated sheet");
    assert.ok(publicContract.spriteCells[1].backgroundImage.includes("/ember-cohort/sprite-sheet.png"), "the Ember Cohort sprite cell must use its generated sheet");
    assert.equal(publicContract.canvasCount, 0, "Sealbound must remain a DOM/CSS image composition without a canvas renderer");

    for (const index of [1, 2, 0]) {
      await page.locator(`[data-front-index="${index}"]`).click();
      assert.equal((await snapshot(page)).selectedFront, index, `pointer input must select front ${index + 1}`);
    }
    for (let index = 0; index < 3; index += 1) {
      await page.keyboard.press(String(index + 1));
      assert.equal((await snapshot(page)).selectedFront, index, `key ${index + 1} must select front ${index + 1}`);
    }

    assert.deepEqual(failures, [], `${viewport.width}x${viewport.height} viewport must not emit page, console, or request errors`);
  } finally {
    await context.close();
  }
}

async function assertReadOnlyHook(page) {
  const contract = await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "__SEALBOUND_TEST__");
    const hook = descriptor?.value;
    const original = hook;
    const replacementAccepted = Reflect.set(window, "__SEALBOUND_TEST__", { broken: true });
    return {
      exists: Boolean(hook),
      frozen: Object.isFrozen(hook),
      configurable: descriptor?.configurable,
      enumerable: descriptor?.enumerable,
      writable: descriptor?.writable,
      replacementAccepted,
      identityPreserved: window.__SEALBOUND_TEST__ === original,
      methods: hook && Object.keys(hook).sort(),
    };
  });
  assert.deepEqual(contract, {
    exists: true,
    frozen: true,
    configurable: false,
    enumerable: false,
    writable: false,
    replacementAccepted: false,
    identityPreserved: true,
    methods: ["restart", "selectFront", "snapshot", "step", "useAbility"],
  }, "window.__SEALBOUND_TEST__ must be a frozen, non-writable public contract with only the documented methods");
}

async function restartWithHook(page) {
  await page.evaluate(() => window.__SEALBOUND_TEST__.restart());
  return snapshot(page);
}

async function rechargeTo(page, targetEnergy) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = await snapshot(page);
    if (current.energy >= targetEnergy) return current;
    assert.equal(current.mode, "running", `energy recharge must remain playable (integrity ${current.integrity})`);
    await page.evaluate(() => window.__SEALBOUND_TEST__.step(0.5));
  }
  assert.fail(`energy failed to reach ${targetEnergy} through deterministic stepping`);
}

async function clearAllFrontsWithHook(page) {
  await restartWithHook(page);
  for (let frontIndex = 0; frontIndex < 3; frontIndex += 1) {
    await page.evaluate((index) => window.__SEALBOUND_TEST__.selectFront(index), frontIndex);
    assert.equal((await snapshot(page)).selectedFront, frontIndex, `test hook must select front ${frontIndex + 1}`);
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const current = await snapshot(page);
      if (current.fronts[frontIndex].cleared) break;
      assert.equal(current.mode, "running", `front ${frontIndex + 1} must clear before integrity reaches zero`);
      if (current.energy >= 2) {
        const accepted = await page.evaluate(() => window.__SEALBOUND_TEST__.useAbility("rift-lance"));
        assert.equal(accepted, true, `Rift Lance must be accepted while front ${frontIndex + 1} is uncleared with sufficient energy`);
      } else if (current.energy >= 1) {
        const accepted = await page.evaluate(() => window.__SEALBOUND_TEST__.useAbility("crescent"));
        assert.equal(accepted, true, `Crescent must be accepted while front ${frontIndex + 1} is uncleared with sufficient energy`);
      } else {
        await page.evaluate(() => window.__SEALBOUND_TEST__.step(0.5));
      }
    }
    assert.equal((await snapshot(page)).fronts[frontIndex].cleared, true, `front ${frontIndex + 1} must clear through public hook combat`);
  }
  const cleared = await snapshot(page);
  assert.ok(cleared.fronts.every((front) => front.cleared), "all three fronts must be cleared");
  assert.ok(cleared.fronts.every((front) => front.sealState === "exposed"), "clearing all three fronts must expose every seal");
  return cleared;
}

async function verifyGameplayContract(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const { page, failures } = await openRunningPage(context, hosting, { deterministicClock: true });
    await assertReadOnlyHook(page);

    const baseline = await snapshot(page);
    assert.equal(baseline.mode, "running", "baseline mode must be running");
    assert.equal(baseline.selectedFront, 0, "baseline must select Cinder Span");
    assert.equal(baseline.integrity, 100, "baseline integrity must be full");
    assert.equal(baseline.energy, 3, "baseline energy must start at three");
    assert.equal(baseline.sealsCaptured, 0, "baseline must have no captured seals");
    assert.equal(baseline.tick, 0, "baseline deterministic tick must start at zero");
    assert.equal(baseline.loopRunning, true, "baseline animation loop must be running");
    assert.equal(baseline.fronts.length, 3, "snapshot must expose all three fronts");

    await page.keyboard.press("KeyQ");
    const afterQ = await snapshot(page);
    assert.equal(afterQ.energy, baseline.energy - 1, "Q Crescent must spend exactly one energy");
    assert.equal(afterQ.fronts[0].enemyHealth, baseline.fronts[0].enemyHealth - 26, "Q Crescent must deal its deterministic 26 damage");

    await page.keyboard.press("KeyR");
    assert.deepEqual(await snapshot(page), baseline, "R must restore the complete deterministic baseline");

    await page.keyboard.press("KeyW");
    const afterW = await snapshot(page);
    assert.equal(afterW.energy, baseline.energy - 2, "W Rift Lance must spend exactly two energy");
    assert.equal(afterW.fronts[0].enemyHealth, baseline.fronts[0].enemyHealth - 58, "W Rift Lance must deal its deterministic 58 damage");

    await page.locator("#sealbound-restart").click();
    assert.deepEqual(await snapshot(page), baseline, "the semantic restart button must restore the complete deterministic baseline");

    await clearAllFrontsWithHook(page);
    await page.evaluate(() => window.__SEALBOUND_TEST__.selectFront(0));
    await rechargeTo(page, 3);
    const beforeKeyboardE = await snapshot(page);
    await page.keyboard.press("KeyE");
    const afterKeyboardE = await snapshot(page);
    assert.equal(afterKeyboardE.sealsCaptured, beforeKeyboardE.sealsCaptured + 1, "E Bind Seal must capture one exposed seal");
    assert.equal(afterKeyboardE.fronts[0].captured, true, "E Bind Seal must capture the selected exposed front");
    assert.equal(afterKeyboardE.energy, beforeKeyboardE.energy - 3, "E Bind Seal must spend exactly three energy");

    await clearAllFrontsWithHook(page);
    for (let frontIndex = 0; frontIndex < 3; frontIndex += 1) {
      await page.evaluate((index) => window.__SEALBOUND_TEST__.selectFront(index), frontIndex);
      assert.equal((await snapshot(page)).selectedFront, frontIndex, `hook must select exposed front ${frontIndex + 1}`);
      await rechargeTo(page, 3);
      const beforeCapture = await snapshot(page);
      assert.equal(await page.evaluate(() => window.__SEALBOUND_TEST__.useAbility("bind-seal")), true, `hook must capture exposed seal ${frontIndex + 1}`);
      const afterCapture = await snapshot(page);
      assert.equal(afterCapture.sealsCaptured, beforeCapture.sealsCaptured + 1, `hook capture ${frontIndex + 1} must increment the seal count exactly once`);
      assert.equal(afterCapture.fronts[frontIndex].captured, true, `hook capture ${frontIndex + 1} must mark its front captured`);
    }
    const victory = await snapshot(page);
    assert.equal(victory.mode, "victory", "capturing all three seals through the public hook must win");
    assert.equal(victory.sealsCaptured, 3, "victory must retain all three captured seals");
    assert.equal(victory.loopRunning, false, "victory must stop the animation loop");
    await page.locator('body[data-game-state="victory"]').waitFor({ state: "attached" });
    assert.equal(await page.locator("#sealbound-outcome").isVisible(), true, "victory must expose the outcome panel");
    assert.equal((await page.locator("#sealbound-outcome-title").textContent())?.trim(), "All seals bound", "victory must be observable in player-facing copy");

    await page.keyboard.press("KeyR");
    assert.deepEqual(await snapshot(page), baseline, "R must restart from a terminal victory");
    await page.evaluate(() => window.__SEALBOUND_TEST__.step(600));
    const gameover = await snapshot(page);
    assert.equal(gameover.mode, "gameover", "deterministic pressure must be able to force a loss");
    assert.equal(gameover.integrity, 0, "forced loss must exhaust integrity");
    assert.equal(gameover.loopRunning, false, "forced loss must stop the animation loop");
    await page.locator('body[data-game-state="gameover"]').waitFor({ state: "attached" });
    assert.equal((await page.locator("#sealbound-outcome-title").textContent())?.trim(), "The lantern is extinguished", "forced loss must be observable in player-facing copy");
    const stoppedTick = gameover.tick;
    await page.evaluate(() => window.__SEALBOUND_TEST__.step(1));
    assert.equal((await snapshot(page)).tick, stoppedTick, "a terminal loss must reject further deterministic simulation steps");

    await page.locator("#sealbound-restart").click();
    assert.deepEqual(await snapshot(page), baseline, "semantic restart must restore baseline after a forced loss");
    assert.deepEqual(failures, [], "gameplay, victory, restart, and loss checks must not emit page, console, or request errors");
  } finally {
    await context.close();
  }
}

async function clockSnapshot(page) {
  return page.evaluate(() => window.__sealboundTestClock.snapshot());
}

async function verifyLifecycle(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const { page, failures } = await openRunningPage(context, hosting, { deterministicClock: true });
    assert.equal((await snapshot(page)).loopRunning, true, "running route must own an active loop");
    assert.equal((await clockSnapshot(page)).pending, 1, "running route must own exactly one pending animation frame");

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    assert.equal((await snapshot(page)).loopRunning, false, "pagehide must stop the loop");
    assert.equal((await clockSnapshot(page)).pending, 0, "pagehide must cancel the pending frame");

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    const resumedClock = await clockSnapshot(page);
    assert.equal((await snapshot(page)).loopRunning, true, "pageshow must resume the loop");
    assert.equal(resumedClock.pending, 1, "pageshow must resume exactly one animation frame");

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    const duplicatePageShowClock = await clockSnapshot(page);
    assert.equal(duplicatePageShowClock.pending, 1, "repeated pageshow must not create a duplicate animation frame");
    assert.equal(duplicatePageShowClock.scheduled, resumedClock.scheduled, "repeated pageshow must not schedule a duplicate loop");
    const tickBeforeResume = (await snapshot(page)).tick;
    assert.equal(await page.evaluate(() => window.__sealboundTestClock.advance(2)), 2, "two resumed frames must execute exactly two callbacks");
    assert.equal((await snapshot(page)).tick, tickBeforeResume + 1, "the second resumed callback must advance one fixed simulation tick");
    assert.equal((await clockSnapshot(page)).pending, 1, "two resumed callbacks must retain exactly one successor");

    assert.deepEqual(failures, [], "page lifecycle checks must not emit page, console, or request errors");
  } finally {
    await context.close();
  }
}

async function measureRafPartition(browser, hosting, partitions, label) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const { page, failures } = await openRunningPage(context, hosting, { deterministicClock: true });
    assert.equal((await snapshot(page)).tick, 0, `${label} must start at deterministic tick zero`);
    assert.equal(
      await page.evaluate(() => window.__sealboundTestClock.advance(1, 1000 / 60)),
      1,
      `${label} timestamp anchor must execute exactly one callback`,
    );
    assert.equal((await snapshot(page)).tick, 0, `${label} first callback must only establish the RAF timestamp`);
    for (const [count, milliseconds] of partitions) {
      assert.equal(
        await page.evaluate(
          ({ frameCount, frameMilliseconds }) => window.__sealboundTestClock.advance(frameCount, frameMilliseconds),
          { frameCount: count, frameMilliseconds: milliseconds },
        ),
        count,
        `${label} must execute one callback for each requested frame`,
      );
    }
    assert.equal((await clockSnapshot(page)).pending, 1, `${label} must retain exactly one pending frame`);
    assert.deepEqual(failures, [], `${label} must not emit page, console, or request errors`);
    return await snapshot(page);
  } finally {
    await context.close();
  }
}

async function verifyFixedStepRaf(browser, hosting) {
  const finePartition = await measureRafPartition(browser, hosting, [[6, 1000 / 60]], "six 60 Hz RAF intervals");
  const coarsePartition = await measureRafPartition(browser, hosting, [[3, 1000 / 30]], "three 30 Hz RAF intervals");
  assert.equal(finePartition.tick, 6, "six 60 Hz RAF intervals must advance exactly six fixed ticks");
  assert.deepEqual(coarsePartition, finePartition, "equivalent elapsed RAF partitions must converge to the same deterministic state");

  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  try {
    const { page, failures } = await openRunningPage(context, hosting, { deterministicClock: true });
    assert.equal(await page.evaluate(() => window.__sealboundTestClock.advance(1, 1000 / 60)), 1, "stall fixture must establish its RAF timestamp");
    assert.equal((await snapshot(page)).tick, 0, "stall fixture timestamp anchor must not advance simulation");
    assert.equal(await page.evaluate(() => window.__sealboundTestClock.advance(1, 1000)), 1, "one stalled RAF callback must execute once");
    assert.equal((await snapshot(page)).tick, 8, "a one-second stall must clamp to the eight-step catch-up budget");
    assert.equal(await page.evaluate(() => window.__sealboundTestClock.advance(1, 1000 / 60)), 1, "post-stall RAF callback must execute once");
    assert.equal((await snapshot(page)).tick, 9, "post-stall RAF must advance only one new tick, proving excess backlog was dropped");
    assert.equal((await clockSnapshot(page)).pending, 1, "bounded catch-up must retain exactly one pending frame");
    assert.deepEqual(failures, [], "bounded RAF catch-up must not emit page, console, or request errors");
  } finally {
    await context.close();
  }
}

async function verifyReducedMotion(browser, hosting) {
  const context = await browser.newContext({
    baseURL: hosting.url,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  try {
    const { page, failures } = await openRunningPage(context, hosting, { deterministicClock: true });
    assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true, "reduced-motion context must be active");
    const before = await snapshot(page);
    await page.keyboard.press("KeyQ");
    const attackFrame = await page.evaluate(() => {
      const sheet = document.querySelector('[data-sprite="warden"] .sprite-sheet');
      const style = getComputedStyle(sheet);
      return {
        backgroundPosition: style.backgroundPosition,
        frameX: style.getPropertyValue("--frame-x").trim(),
        frameY: style.getPropertyValue("--frame-y").trim(),
      };
    });
    assert.equal(attackFrame.frameX, "-33.333333333333336%", "reduced-motion Crescent must hold the authored attack column");
    assert.equal(attackFrame.frameY, "-66.66666666666667%", "reduced-motion Crescent must hold the authored attack row");
    await page.evaluate(() => window.__SEALBOUND_TEST__.step(0.1));
    const after = await snapshot(page);
    const advancedAttackFrame = await page.evaluate(() => {
      const sheet = document.querySelector('[data-sprite="warden"] .sprite-sheet');
      const style = getComputedStyle(sheet);
      return {
        backgroundPosition: style.backgroundPosition,
        frameX: style.getPropertyValue("--frame-x").trim(),
        frameY: style.getPropertyValue("--frame-y").trim(),
      };
    });
    assert.equal(after.tick, before.tick + 6, "reduced motion must preserve the deterministic 60 Hz simulation");
    assert.ok(after.fronts[0].pressure > before.fronts[0].pressure, "reduced motion must preserve deterministic pressure advancement");
    assert.deepEqual(advancedAttackFrame, attackFrame, "reduced motion must freeze the rendered Warden attack frame while deterministic ticks advance");
    assert.deepEqual(failures, [], "reduced-motion simulation must not emit page, console, or request errors");
  } finally {
    await context.close();
  }
}

async function run() {
  const hosting = await startServer();
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    for (const viewport of VIEWPORTS) await verifyViewport(browser, hosting, viewport);
    await verifyGameplayContract(browser, hosting);
    await verifyLifecycle(browser, hosting);
    await verifyFixedStepRaf(browser, hosting);
    await verifyReducedMotion(browser, hosting);
    console.log("SEALBOUND_BROWSER_OK 390x844 844x390");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
