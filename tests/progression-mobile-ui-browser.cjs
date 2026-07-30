const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { chromium } = require("playwright");

let RULES_VERSION;
let applyCampaignRunResult;
let captureElite;
let createCampaign;
let serializeCampaign;
let setCompanionLoadout;
let startRun;

const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "abyssal-command-defense";
const FIXED_NOW = 2_000_000;
const COARSE_LANDSCAPE = Object.freeze({ width: 844, height: 390 });
const PORTRAIT = Object.freeze({ width: 390, height: 844 });

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

function storedCampaign(campaign) {
  const payload = serializeCampaign(campaign);
  payload.idleReturn.lastSettledAt = FIXED_NOW;
  const text = JSON.stringify(payload);
  return JSON.stringify({
    version: RULES_VERSION,
    hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
    payload,
  });
}

function storyRewardCampaign() {
  let campaign = createCampaign({ campaignId: "progression-mobile-ui", resetEpoch: 1 });
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });
  return {
    ...campaign,
    storyProgress: {
      ...campaign.storyProgress,
      equippedAppearance: {},
    },
  };
}

function questCampaign() {
  let campaign = createCampaign({ campaignId: "quest-mobile-ui", resetEpoch: 1 });
  campaign = captureElite(campaign, "quest-ember", "ember-cohort");
  campaign = captureElite(campaign, "quest-rift", "rift-lens");
  campaign = captureElite(campaign, "quest-throne", "throne-echo");
  return setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "throne-echo"]);
}

async function openPage({
  campaign = createCampaign({ campaignId: "mobile-controls" }),
  forceCanvas = false,
  hasTouch = false,
  rendererProbe = false,
  syntheticFrames = false,
  viewport = PORTRAIT,
} = {}) {
  const context = await browser.newContext({
    baseURL: hosting.url,
    hasTouch,
    isMobile: hasTouch,
    reducedMotion: "reduce",
    viewport,
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    await page.addInitScript(({ encoded, key, now }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      Date.now = () => now;
      if (!localStorage.getItem(key)) localStorage.setItem(key, encoded);
    }, { encoded: storedCampaign(campaign), key: STORAGE_KEY, now: FIXED_NOW });
    if (forceCanvas) {
      await page.addInitScript(() => {
        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
          if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
          return nativeGetContext.call(this, type, ...args);
        };
      });
    }
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
    if (rendererProbe) {
      await page.addInitScript(() => {
        const probe = window.__appearanceSyncProbe = { calls: [], error: null, patched: false };
        import("/battle-realtime-three.js").then(({ RealtimeBattle }) => {
          const original = RealtimeBattle.prototype.setAppearanceLoadout;
          RealtimeBattle.prototype.setAppearanceLoadout = function observedAppearanceSync(loadout) {
            probe.calls.push(structuredClone(loadout));
            return original.call(this, loadout);
          };
          probe.patched = true;
        }).catch((error) => {
          probe.error = error?.stack ?? String(error);
        });
      });
    }
    await page.goto("/index.html", { waitUntil: "networkidle" });
    const surface = page.locator('#defense-battle-surface[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    if (rendererProbe) {
      await page.waitForFunction(() => window.__appearanceSyncProbe?.patched || window.__appearanceSyncProbe?.error);
      assert.equal(await page.evaluate(() => window.__appearanceSyncProbe.error), null, "the renderer sync probe must install before observing appearance changes");
    }
    return { context, errors, page, surface };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function launch(run) {
  await run.page.locator("#start-defense").click();
  await run.page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor({ state: "attached" });
  await run.page.locator('#defense-cutscene-overlay[data-cutscene-event="STAGE_STARTED"]').waitFor({ state: "visible" });
}

async function readStoredStoryProgress(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)).payload.storyProgress, STORAGE_KEY);
}

before(async () => {
  ({
    RULES_VERSION,
    applyCampaignRunResult,
    captureElite,
    createCampaign,
    serializeCampaign,
    setCompanionLoadout,
    startRun,
  } = await import("../campaign-state.js"));
  hosting = await staticServer();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => hosting?.host.close(resolve));
});

test("story rewards drive extracted-skill and appearance controls through persisted campaign state", async () => {
  const run = await openPage({ campaign: storyRewardCampaign(), rendererProbe: true });
  try {
    await run.page.locator('[data-deck-section="skills"]').click();
    const toggle = run.page.locator('[data-extracted-skill-toggle="rift-bolt"]');
    const upgrade = run.page.locator('[data-extracted-skill-upgrade="rift-bolt"]');
    await toggle.waitFor({ state: "visible" });
    assert.equal(await toggle.getAttribute("aria-pressed"), "false", "the unlocked story skill must begin unequipped");
    assert.match(await upgrade.textContent() ?? "", /Lv 2/);

    await toggle.click();
    await run.page.waitForFunction(() => document.querySelector(".deck-subhead")?.textContent?.includes("추출 액티브 · 1/3"));
    assert.deepEqual((await readStoredStoryProgress(run.page)).activeSkillLoadout, ["rift-bolt"], "equipping in the deck must persist the active story skill");

    await run.page.locator('[data-extracted-skill-upgrade="rift-bolt"]').click();
    await run.page.waitForFunction(() => document.querySelector('[data-extracted-skill-upgrade="rift-bolt"]')?.textContent?.includes("Lv 3"));
    assert.equal((await readStoredStoryProgress(run.page)).extractedSkillLevels["rift-bolt"], 2, "the level shown after upgrading must be the persisted level");

    await run.page.locator('[data-extracted-skill-toggle="rift-bolt"]').click();
    await run.page.waitForFunction(() => document.querySelector(".deck-subhead")?.textContent?.includes("추출 액티브 · 0/3"));
    assert.deepEqual((await readStoredStoryProgress(run.page)).activeSkillLoadout, [], "unequipping must persist without removing the unlocked skill");

    await run.page.reload({ waitUntil: "networkidle" });
    await run.page.locator('[data-deck-section="skills"]').click();
    assert.equal(await run.page.locator('[data-extracted-skill-toggle="rift-bolt"]').getAttribute("aria-pressed"), "false");
    assert.match(await run.page.locator('[data-extracted-skill-upgrade="rift-bolt"]').textContent() ?? "", /Lv 3/, "reload must render the next level from persisted level 2");

    await run.page.locator('[data-deck-section="inventory"]').click();
    const appearance = run.page.locator('[data-appearance-item="cinder-span-ember-chain"]');
    await appearance.waitFor({ state: "visible" });
    assert.equal(await appearance.getAttribute("aria-pressed"), "false", "an owned but unequipped appearance reward must expose an equip action");
    const callsBefore = await run.page.evaluate(() => window.__appearanceSyncProbe.calls.length);
    await appearance.click();
    await run.page.waitForFunction(() => document.querySelector('[data-appearance-item="cinder-span-ember-chain"]')?.getAttribute("aria-pressed") === "true");
    await run.page.waitForFunction((before) => window.__appearanceSyncProbe.calls.length > before, callsBefore);
    const appearanceResult = await run.page.evaluate(() => ({
      calls: window.__appearanceSyncProbe.calls,
      rendererMode: document.querySelector("#defense-battle-surface")?.dataset.defenseRenderer,
    }));
    assert.equal(appearanceResult.rendererMode, "webgl", "the appearance hook contract must execute against the live renderer rather than a silent fallback");
    assert.equal(appearanceResult.calls.at(-1)?.back?.id, "cinder-span-ember-chain", "equipping the appearance item must synchronize the authored back-slot reward to the renderer");
    assert.equal((await readStoredStoryProgress(run.page)).equippedAppearance.back, "cinder-span-ember-chain", "appearance sync must follow the persisted campaign selection");
    assert.deepEqual(run.errors, [], "progression and appearance interactions must not emit browser errors");
  } finally {
    await run.context.close();
  }
});

test("quest acquisition is nonblocking and accumulated run events show the current objective plus completed count", { timeout: 90_000 }, async () => {
  const run = await openPage({ campaign: questCampaign(), forceCanvas: true, syntheticFrames: true });
  try {
    await launch(run);
    const overlay = run.page.locator("#defense-cutscene-overlay");
    assert.equal(await overlay.getAttribute("data-nonblocking"), "true", "quest acquisition dialogue must advertise its nonblocking presentation contract");
    const initialQuest = await run.page.evaluate(() => ({
      count: document.querySelector("#battle-quest-count")?.textContent?.trim(),
      objective: document.querySelector("#battle-objective")?.textContent?.trim(),
      title: document.querySelector("#battle-quest-title")?.textContent?.trim(),
    }));
    assert.deepEqual(initialQuest, {
      count: "0/4 완료",
      objective: "불씨 중계로를 사수하라",
      title: "사슬 아래의 길",
    });

    await run.page.evaluate(() => {
      for (let index = 0; index < 12; index += 1) window.__pumpDefenseFrame(100);
    });
    assert.equal(await overlay.isVisible(), true, "the acquisition dialogue must still be visible while the deterministic battle clock advances");
    assert.match(await run.page.locator("#battle-status").textContent() ?? "", /시간 [1-9]\d*초/, "a nonblocking acquisition dialogue must not freeze simulation time");
    await overlay.locator("[data-cutscene-dismiss]").click();

    let progress = null;
    for (let batch = 0; batch < 500 && !progress; batch += 1) {
      await run.page.evaluate(() => {
        for (let index = 0; index < 10; index += 1) window.__pumpDefenseFrame(100);
      });
      const cutsceneDismiss = run.page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
      if (await cutsceneDismiss.isVisible()) await cutsceneDismiss.click();
      const growthChoice = run.page.locator("#defense-growth-offer [data-pick]").first();
      if (await growthChoice.isVisible()) await growthChoice.click();
      const count = (await run.page.locator("#battle-quest-count").textContent() ?? "").trim();
      if (count !== "0/4 완료") {
        progress = await run.page.evaluate(() => ({
          count: document.querySelector("#battle-quest-count")?.textContent?.trim(),
          objective: document.querySelector("#battle-objective")?.textContent?.trim(),
        }));
      }
    }
    assert.deepEqual(progress, {
      count: "1/4 완료",
      objective: "잠긴 용광로의 압력을 끊어라",
    }, "events accumulated across rendered ticks must advance the HUD to the next current objective");
    assert.deepEqual(run.errors, [], "quest presentation must not emit browser errors");
  } finally {
    await run.context.close();
  }
});

test("coarse-landscape joystick resolves eight octants and every cancellation path returns movement to IDLE", async () => {
  const run = await openPage({ hasTouch: true, viewport: COARSE_LANDSCAPE });
  try {
    await launch(run);
    const movement = run.page.locator("#movement-actions");
    const joystick = run.page.locator("[data-joystick]");
    assert.equal(await joystick.evaluate((node) => getComputedStyle(node).display), "grid", "coarse landscape must expose the drag joystick");

    const buttons = movement.locator("button[data-move]");
    assert.equal(await buttons.count(), 5, "the drag surface must not replace the five keyboard movement controls");
    for (const direction of ["N", "W", "IDLE", "E", "S"]) {
      const button = movement.locator(`button[data-move="${direction}"]`);
      await button.focus();
      assert.equal(await button.evaluate((node) => document.activeElement === node), true, `${direction} must remain keyboard focusable behind the joystick`);
      const previous = Number(await run.surface.getAttribute("data-defense-input-seq"));
      await run.page.keyboard.press("Enter");
      await run.page.waitForFunction((prior) => Number(document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq) > prior, previous);
      assert.equal(await run.surface.getAttribute("data-defense-move"), direction, `${direction} keyboard activation must reach the public movement state`);
    }

    const box = await joystick.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, "the joystick must expose a reachable coarse-pointer target");
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const vectors = {
      N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1],
      S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1],
    };
    for (const [direction, [x, y]] of Object.entries(vectors)) {
      await run.page.mouse.move(center.x, center.y);
      await run.page.mouse.down();
      await run.page.mouse.move(center.x + x * box.width * 0.36, center.y + y * box.height * 0.36);
      await run.page.waitForFunction((expected) => document.querySelector("#movement-actions")?.dataset.joystickDirection === expected, direction);
      assert.equal(await run.surface.getAttribute("data-defense-move"), direction, `dragging into the ${direction} octant must emit ${direction}`);
      await run.page.mouse.up();
      await run.page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseMove === "IDLE");
    }

    await run.page.mouse.move(center.x, center.y);
    await run.page.mouse.down();
    await run.page.mouse.move(center.x + box.width * 0.05, center.y + box.height * 0.04);
    assert.equal(await movement.getAttribute("data-joystick-direction"), "IDLE", "movement inside the joystick deadzone must stay idle");
    await run.page.mouse.up();

    const beginEastDrag = async () => {
      await run.page.mouse.move(center.x, center.y);
      await run.page.mouse.down();
      await run.page.mouse.move(center.x + box.width * 0.36, center.y);
      await run.page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseMove === "E");
    };
    const expectIdle = async (label) => {
      await run.page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseMove === "IDLE");
      assert.equal(await movement.getAttribute("data-joystick-direction"), "IDLE", `${label} must reset the joystick visual state`);
      await run.page.mouse.up();
    };

    for (const eventType of ["pointercancel", "lostpointercapture"]) {
      await beginEastDrag();
      await run.page.evaluate((type) => {
        const movementNode = document.querySelector("#movement-actions");
        movementNode.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "mouse" }));
      }, eventType);
      await expectIdle(eventType);
    }
    await beginEastDrag();
    await run.page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expectIdle("window blur");

    await beginEastDrag();
    await run.page.evaluate(() => {
      const ownHidden = Object.getOwnPropertyDescriptor(document, "hidden");
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      if (ownHidden) Object.defineProperty(document, "hidden", ownHidden);
      else delete document.hidden;
    });
    await expectIdle("document visibility loss");
    assert.deepEqual(run.errors, [], "joystick input and cancellation must not emit browser errors");
  } finally {
    await run.context.close();
  }
});

test("the joystick stays hidden outside coarse landscape", async () => {
  for (const options of [
    { hasTouch: true, viewport: PORTRAIT, label: "coarse portrait" },
    { hasTouch: false, viewport: COARSE_LANDSCAPE, label: "fine-pointer landscape" },
  ]) {
    const run = await openPage(options);
    try {
      assert.equal(
        await run.page.locator("[data-joystick]").evaluate((node) => getComputedStyle(node).display),
        "none",
        `${options.label} must not expose the drag joystick`,
      );
      assert.deepEqual(run.errors, [], `${options.label} must not emit browser errors`);
    } finally {
      await run.context.close();
    }
  }
});
