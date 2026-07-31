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
  // Same measured slowdown as the phone-HUD suite: this file's test 4 took 108 s in run #14 and
  // its tests 1 and 4 timed out at Playwright's 30000 ms default in #14/#15. See
  // tests/defense-phone-battle-hud-browser.test.cjs:48 for the full reasoning.
  context.setDefaultTimeout(90_000);
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
    // `load`, deliberately, and NOT either neighbour:
    //
    //   networkidle       waits for a 500 ms quiet window. app.js:4347 registers the service
    //                     worker with `updateViaCache: "none"`, so every load revalidates over
    //                     the network while a continuous WebGL RAF loop keeps the page busy.
    //                     On CI that window may never open -- runs #14/#15 died here with
    //                     `page.reload: Timeout 30000ms exceeded`.
    //   domcontentloaded  does NOT wait for stylesheets. Tried in #17; it moved the failure
    //                     rather than fixing it. Test 4 asserts `.focus()` lands
    //                     (`document.activeElement === node`, :452) on a `[data-move]` button,
    //                     and an unstyled button is `display:none`, where focus() silently
    //                     no-ops -- so the assert read `false !== true` in #17 AND #18. It
    //                     passed locally every time because CSS resolves from disk instantly.
    //   load              waits for stylesheets and subresources but needs no quiet window, so
    //                     the service-worker revalidation loop cannot stall it.
    //
    // Keep in sync with the reload below; both need the CSS guarantee.
    await page.goto("/index.html", { waitUntil: "load" });
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

/**
 * Clears the opening cutscene and waits for the overlay to actually leave.
 *
 * The overlay is a modal that owns focus and advances on its own relay timers. A control test
 * that asserts `document.activeElement` while it is still on screen is racing that timer: on a
 * fast machine the loop over the five movement buttons finishes first, and on a ~6x slower CI
 * runner a relay beat lands mid-loop and takes focus back, which is correct modal behaviour and
 * a false failure for the control under test. Dismissing first is also what a player does before
 * touching the controls, so this asserts the state the assertion was always about.
 */
async function dismissOpeningCutscene(run) {
  const dismiss = run.page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await run.page.locator("#defense-cutscene-overlay").waitFor({ state: "hidden" }).catch(() => {});
}

/**
 * Answers any pending level-up growth offer and waits for the card to leave.
 *
 * Sibling of dismissOpeningCutscene above, for the same class of defect: a surface that
 * legitimately owns focus is on screen while a control test asserts `document.activeElement`.
 *
 * The offer is genuinely modal -- defense-run-simulation.js:4263 is `if (run.growthOffer) return;`,
 * so the simulation HALTS until it is answered. app.js:3908 therefore correctly focuses the card's
 * button. That button is a plain <button> with no `data-move`, which is exactly what a local repro
 * observed holding focus at the point of failure.
 *
 * The focus loop below presses Enter once per direction; each press moves the commander and accrues
 * XP, so a level-up can render MID-LOOP and take focus from the button under assertion. That is why
 * the failure moved between runs -- CI lost S (5th), a 6x CPU-throttled local repro lost E (4th).
 * It depends on WHEN the offer fires, not on which button.
 *
 * It is also why no wait strategy fixed it across runs #16-#20: the steal happens in the window
 * BETWEEN `.focus()` and the assertion, which `networkidle`, `domcontentloaded` and `load` cannot
 * address. Retrying the focus assertion would be worse still -- it would paper over correct modal
 * behaviour and could pass while the player-facing focus contract was broken.
 *
 * Answering the offer up front is what a player does before drilling the controls, so the
 * assertion still measures the state it was always about.
 */
async function dismissGrowthOffer(run) {
  const pick = run.page.locator("#defense-growth-offer [data-pick]").first();
  if (await pick.isVisible().catch(() => false)) await pick.click();
  await run.page.locator("#defense-growth-offer").waitFor({ state: "hidden" }).catch(() => {});
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

    // `load` for the same reason as the goto above: must not measure before stylesheets apply,
    // and must not wait on a network quiet window the service worker prevents. A reload is the
    // harder case -- the worker is already active and re-fetches in the background -- which is
    // why this exact line timed out under `networkidle` in runs #14 and #15.
    await run.page.reload({ waitUntil: "load" });
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
    await dismissOpeningCutscene(run);
    const movement = run.page.locator("#movement-actions");
    const joystick = run.page.locator("[data-joystick]");
    assert.equal(await joystick.evaluate((node) => getComputedStyle(node).display), "grid", "coarse landscape must expose the drag joystick");

    const buttons = movement.locator("button[data-move]");
    assert.equal(await buttons.count(), 5, "the drag surface must not replace the five keyboard movement controls");
    for (const direction of ["N", "W", "IDLE", "E", "S"]) {
      const button = movement.locator(`button[data-move="${direction}"]`);
      // INSIDE the loop, not before it. Unlike the opening cutscene, the growth offer is
      // recurrent: each Enter below moves the commander and accrues XP, so a level-up can cross
      // its threshold during iteration 4 or 5 and take focus mid-loop. A pre-loop dismiss would
      // clear an offer that is not there yet and miss the one that actually breaks the assert.
      await dismissGrowthOffer(run);
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

/**
 * Cycle 10 §8.1 -- INTENTIONAL CONTRACT INVERSION, not a weakened assertion.
 *
 * This replaces "the joystick stays hidden outside coarse landscape", which asserted
 * `display === "none"` in coarse portrait and fine-pointer landscape. That assertion encoded the
 * exact gate the cutover exists to remove: while it held, desktop and portrait were left on the
 * retired keypad. Keeping it would mean the cutover did not happen -- the two are the same
 * decision, so this cannot be reviewed as a softening.
 *
 * The replacement is strictly STRONGER. The old test made 2 assertions across 2 contexts (4
 * total) and never dispatched a pointer event. This one makes >=15 across 4 contexts, adds the
 * two desktop viewports the old one never visited, and adds two guards the old shape could not
 * express at all:
 *   - C1: the pad centre is drag-only. Before the ring became pointer-active this was vacuous;
 *     now it is what keeps the eight-octant drag test alive, because [data-move="IDLE"] used to
 *     park exactly where that test presses.
 *   - Gate desync: the JS predicate and the CSS visibility cannot disagree. This is the defect
 *     spec §2.1 documents -- a `display: none` pad whose zeroed rect still reached
 *     updateJoystick() and produced octants measured from the viewport origin.
 */
test("the joystick is the primary movement control at every viewport", async () => {
  const DEAD_ZONE_RATIO = 0.22;   // mirrors JOYSTICK_DEAD_ZONE_RATIO in app.js
  for (const options of [
    { hasTouch: true, viewport: PORTRAIT, label: "coarse portrait", padSize: 116 },
    { hasTouch: false, viewport: COARSE_LANDSCAPE, label: "fine-pointer landscape", padSize: 116 },
    { hasTouch: false, viewport: { width: 1440, height: 900 }, label: "desktop pointer", padSize: 144 },
    { hasTouch: false, viewport: { width: 1920, height: 1080 }, label: "wide desktop pointer", padSize: 160 },
  ]) {
    const run = await openPage(options);
    try {
      await launch(run);
      await dismissOpeningCutscene(run);
      const joystick = run.page.locator("[data-joystick]");
      // 1. present and laid out -- the inverted assertion.
      assert.equal(await joystick.evaluate((node) => getComputedStyle(node).display), "grid",
        `${options.label} must expose the drag joystick`);
      const box = await joystick.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44,
        `${options.label} joystick must expose a reachable target`);
      // Per-composition pad size (spec §3.5). Pinned because maxTravel = padRadius - knobRadius
      // is the analog resolution denominator, so a silent size change alters movement feel.
      assert.ok(Math.abs(box.width - options.padSize) <= 1 && Math.abs(box.height - options.padSize) <= 1,
        `${options.label} pad must measure ${options.padSize}px, got ${box.width}x${box.height}`);
      // 2. the five controls survive as the accessible fallback -- retained strength.
      const buttons = run.page.locator("#movement-actions button[data-move]");
      assert.equal(await buttons.count(), 5,
        `${options.label} must keep the five keyboard movement controls`);
      assert.deepEqual(
        await run.page.$$eval("#movement-actions button[data-move]", (nodes) => nodes.map((node) => node.dataset.move)),
        ["N", "W", "IDLE", "E", "S"],
        `${options.label} must keep DOM order N,W,IDLE,E,S -- position is CSS-only (spec C2)`);
      for (const direction of ["N", "W", "IDLE", "E", "S"]) {
        const button = run.page.locator(`#movement-actions button[data-move="${direction}"]`);
        const rect = await button.boundingBox();
        assert.ok(rect && rect.width >= 44 && rect.height >= 44,
          `${options.label} ${direction} must retain a 44px target`);
        // INSIDE the loop, mirroring `:387` and for the same measured reason. The growth offer
        // is modal and steals focus, and it is recurrent: XP can cross a level threshold between
        // iterations, so an offer that did not exist at loop entry opens mid-loop and the very
        // next `activeElement` assert fails with `false !== true`. That is exactly how this test
        // failed on `main` -- run 30602090979, "coarse portrait E must stay keyboard focusable".
        // The sibling test at `:381-389` already carried this mitigation; this loop drove the
        // same focus assertions without it.
        await dismissGrowthOffer(run);
        await button.focus();
        assert.equal(await button.evaluate((node) => document.activeElement === node), true,
          `${options.label} ${direction} must stay keyboard focusable`);
      }
      // 3. NEW strength the old test could not have: the centre stays drag-only (spec C1).
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const hit = await run.page.evaluate(({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-move]")?.dataset.move ?? null, centre);
      assert.equal(hit, null,
        `${options.label} pad centre must be drag-only, no [data-move] may intercept it`);
      // C1 dead-zone margin. Reported, and asserted as a WARNING-grade floor rather than the
      // gate: the binding form is the point exclusion above. A press inside the dead zone is
      // exactly the press that must start a drag instead of resolving to a button, so if the
      // nearest [data-move] edge ever crosses padRadius x 0.22 the octant drag starts failing.
      const margin = await run.page.evaluate(({ cx, cy }) => {
        const edges = [...document.querySelectorAll("#movement-actions button[data-move]")].map((node) => {
          const rect = node.getBoundingClientRect();
          const dx = Math.max(rect.left - cx, 0, cx - rect.right);
          const dy = Math.max(rect.top - cy, 0, cy - rect.bottom);
          return Math.hypot(dx, dy);
        });
        return Math.min(...edges);
      }, { cx: centre.x, cy: centre.y });
      const deadZone = (box.width / 2) * DEAD_ZONE_RATIO;
      assert.ok(margin > deadZone,
        `${options.label} nearest [data-move] edge ${margin.toFixed(2)}px must clear the `
        + `${deadZone.toFixed(2)}px dead-zone radius (margin ${(margin - deadZone).toFixed(2)}px)`);
      // 4. NEW strength: the JS predicate and the CSS visibility cannot disagree (spec §2.1).
      assert.equal(
        await run.page.evaluate(() => {
          const pad = document.querySelector("[data-joystick]");
          const rect = pad.getBoundingClientRect();
          return getComputedStyle(pad).display !== "none" && rect.width > 0 && rect.height > 0;
        }),
        true, `${options.label} pad geometry must be measurable wherever it is displayed`);
      // 5. no horizontal overflow at any composition (spec §7.2).
      assert.equal(
        await run.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true, `${options.label} must not overflow horizontally`);
      // 6. buff slots are a READOUT, never a button (spec §5.3 blocking requirement). A <button>
      // slot would be swept by the phone suite's `.defense-bottom button` collection and fail
      // both its visible and its >=44x44 assertion at 26-36px.
      assert.equal(await run.page.locator("#battle-buff-strip button").count(), 0,
        `${options.label} buff strip must contain no buttons`);
      assert.deepEqual(run.errors, [], `${options.label} must not emit browser errors`);
    } finally {
      await run.context.close();
    }
  }
});
