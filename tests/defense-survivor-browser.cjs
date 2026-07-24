const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const allowMissing = process.argv.includes("--allow-missing-browser");
let playwright;
try { playwright = require("playwright"); } catch {
  if (!allowMissing) throw new Error("require('playwright') failed; install the lock-backed browser dependency.");
  console.log("DEFENSE_SURVIVOR_BROWSER_SKIPPED missing Playwright");
}
const ROOT = path.resolve(__dirname, "..");

function startServer() {
  const host = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = path.resolve(ROOT, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return res.writeHead(404).end();
      const mimeTypes = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".mp4": "video/mp4" };
      res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", reject));
}

async function seededWorldHudCampaign() {
  const campaignState = await import("../campaign-state.js");
  let campaign = campaignState.createCampaign({ campaignId: "world-hud-regression" });
  campaign = campaignState.captureElite(campaign, "s1-ember-hunter", "ember-cohort");
  campaign = campaignState.setCompanionLoadout(campaign, ["ember-cohort"]);
  const payload = campaignState.serializeCampaign(campaign);
  const text = JSON.stringify(payload);
  return JSON.stringify({
    version: campaignState.RULES_VERSION,
    hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
    payload,
  });
}

// Parses the leading `translate(<x>px, <y>px)` off an inline/style transform
// string (nameplates/damage numbers chain a second centering translate()
// after this one -- only the first, JS-computed pair is the real screen
// position under test).
function parseLeadingTranslatePx(transformString) {
  const match = /^translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(transformString ?? "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

// Parses the translation component (e, f) out of a computed 2D
// `matrix(a, b, c, d, e, f)` transform string.
function parseMatrixTranslate(transformString) {
  const match = /matrix\(([^)]+)\)/.exec(transformString ?? "");
  if (!match) return null;
  const parts = match[1].split(",").map(Number);
  if (parts.length !== 6 || parts.some((value) => Number.isNaN(value))) return null;
  return { x: parts[4], y: parts[5] };
}

/**
 * Regression coverage for Cycle 3 Track 3's world-space HUD (DOM-overlay
 * companion nameplates + floating damage numbers, positioned every frame via
 * RealtimeBattle.projectEntityToScreen() against the real WebGL camera).
 * Guards two real bugs found and fixed during manual verification:
 *   (1) a world-unit height offset inside the projection API could push the
 *       projected NDC far outside [-1,1] for an on-screen entity, silently
 *       making nameplates/damage numbers never render (visible:false).
 *   (2) a CSS keyframe animation living on the same element as the
 *       JS-computed position transform replaces the WHOLE computed
 *       transform value for that element, so co-animating position and
 *       rise/fade on one node silently pins every damage number to the
 *       overlay's top-left origin regardless of the real hit location.
 * Seeds a real companion loadout via campaign-state.js + defense-storage.js's
 * own localStorage envelope format (indexedDB disabled so the app's real
 * boot sequence falls back to localStorage), then drives a real battle
 * against real WebGL in a fresh browser context.
 */
async function verifyWorldHud(browser, hosting, campaignEnvelope) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript((envelope) => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    localStorage.setItem("abyssal-command-defense", envelope);
  }, campaignEnvelope);
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.locator("#defense-app.defense-lobby").waitFor();
  await page.locator("#start-defense").click();
  await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });
  await page.locator("#world-hud-overlay").waitFor({ state: "attached" });

  // Instrument the overlay before sampling: capture each new
  // .world-damage-number's transform at insertion (set once, never
  // animated per the bug #2 fix) and again ~400ms later while its inner
  // .world-damage-number-rise is mid rise/fade animation -- if bug #2
  // regressed (the animation living on the SAME element as the position
  // transform), the outer element's own computed transform would drift
  // away from its inline value once the animation started. Also polls the
  // companion nameplate's presence/transform every 250ms -- if bug #1
  // regressed (projection visible:false for an on-screen entity), the
  // nameplate would never render at all across the sampled window.
  await page.evaluate(() => {
    window.__worldHudDamageSamples = [];
    window.__worldHudNameplateSamples = [];
    const overlay = document.querySelector("#world-hud-overlay");
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement) || !node.classList.contains("world-damage-number")) continue;
          const rise = node.querySelector(".world-damage-number-rise");
          const sample = {
            inlineTransform: node.style.transform,
            riseText: rise ? rise.textContent : null,
            riseIsCrit: rise ? rise.classList.contains("is-crit") : null,
            computedDuringAnimation: null,
          };
          window.__worldHudDamageSamples.push(sample);
          setTimeout(() => {
            sample.computedDuringAnimation = getComputedStyle(node).transform;
          }, 400);
        }
      }
    });
    observer.observe(overlay, { childList: true });
    window.__worldHudObserver = observer;
    window.__worldHudNameplateTimer = setInterval(() => {
      const node = document.querySelector("[data-world-nameplate]");
      window.__worldHudNameplateSamples.push(node ? {
        present: true,
        transform: node.style.transform,
        label: node.querySelector("strong")?.textContent ?? null,
        barWidth: node.querySelector(".world-nameplate-bar i")?.style.width ?? null,
      } : { present: false });
    }, 250);
  });

  await page.waitForFunction(() => {
    const nameplateSamples = window.__worldHudNameplateSamples ?? [];
    let longestPresentRun = 0;
    let currentRun = 0;
    for (const sample of nameplateSamples) {
      currentRun = sample.present ? currentRun + 1 : 0;
      longestPresentRun = Math.max(longestPresentRun, currentRun);
    }
    const settledDamageSamples = (window.__worldHudDamageSamples ?? []).filter((sample) => sample.computedDuringAnimation !== null);
    return longestPresentRun >= 8 && settledDamageSamples.length >= 2;
  }, { timeout: 30000, polling: 250 });

  const state = await page.evaluate(() => {
    clearInterval(window.__worldHudNameplateTimer);
    window.__worldHudObserver.disconnect();
    return {
      nameplateSamples: window.__worldHudNameplateSamples,
      damageSamples: window.__worldHudDamageSamples,
    };
  });
  await context.close();

  assert.deepEqual(errors, [], "world HUD regression check must not emit browser errors");

  const presentSamples = state.nameplateSamples.filter((sample) => sample.present);
  assert.ok(presentSamples.length > 0, "companion nameplate must appear at least once during the sampled playthrough");
  let longestPresentRun = 0;
  let currentRun = 0;
  for (const sample of state.nameplateSamples) {
    currentRun = sample.present ? currentRun + 1 : 0;
    longestPresentRun = Math.max(longestPresentRun, currentRun);
  }
  assert.ok(
    longestPresentRun >= 8,
    `companion nameplate must stay visible across a sustained window, not silently never-render -- regression guard for the world-unit height-offset/visibility bug (longest consecutive present run: ${longestPresentRun}/${state.nameplateSamples.length} samples)`,
  );
  for (const sample of presentSamples) {
    assert.equal(sample.label, "Ember Cohort", "nameplate must label the seeded loadout companion");
    const parsed = parseLeadingTranslatePx(sample.transform);
    assert.ok(parsed, `a present nameplate sample must carry a real px screen-position transform, got: ${JSON.stringify(sample.transform)}`);
    assert.ok(Number.isFinite(parsed.x) && Number.isFinite(parsed.y), "nameplate translate must be finite (a real on-screen projection, not NaN/Infinity from a broken projection)");
    assert.match(sample.barWidth ?? "", /^\d+(\.\d+)?%$/, "nameplate HP bar must render a real percentage width");
  }

  assert.ok(state.damageSamples.length >= 2, `at least two floating damage numbers must render during the sampled playthrough, got ${state.damageSamples.length}`);
  const distinctPositions = new Set();
  for (const sample of state.damageSamples) {
    assert.match(sample.riseText ?? "", /^-\d+$/, `damage number inner rise span must carry the "-<damage>" text, got: ${JSON.stringify(sample.riseText)}`);
    const inline = parseLeadingTranslatePx(sample.inlineTransform);
    assert.ok(inline, `damage number outer element must carry a real px screen-position inline transform, got: ${JSON.stringify(sample.inlineTransform)}`);
    assert.ok(
      Math.abs(inline.x) > 0.5 || Math.abs(inline.y) > 0.5,
      `damage number must not be pinned to the overlay origin (0,0) -- regression guard for the CSS-animation-clobbers-inline-transform bug, got: ${JSON.stringify(inline)}`,
    );
    const computedDuringAnimation = parseMatrixTranslate(sample.computedDuringAnimation);
    assert.ok(computedDuringAnimation, `damage number outer element's computed transform must resolve to a real matrix translate while its inner span animates, got: ${JSON.stringify(sample.computedDuringAnimation)}`);
    assert.ok(
      Math.abs(computedDuringAnimation.x - inline.x) < 1 && Math.abs(computedDuringAnimation.y - inline.y) < 1,
      `damage number outer element's rendered position must still match its JS-computed inline position while the inner rise animation plays -- if a CSS animation on THIS element replaced the computed transform (bug #2), these would diverge (inline: ${JSON.stringify(inline)}, computed during animation: ${JSON.stringify(computedDuringAnimation)})`,
    );
    distinctPositions.add(`${Math.round(inline.x)},${Math.round(inline.y)}`);
  }
  assert.ok(
    distinctPositions.size >= 2,
    `distinct damage events must render at distinct real screen positions, not all collapsed onto one point -- regression guard for the CSS-animation-clobbers-inline-transform bug, got ${distinctPositions.size} distinct position(s) across ${state.damageSamples.length} samples`,
  );

  return {
    nameplateSamples: state.nameplateSamples.length,
    longestNameplatePresentRun: longestPresentRun,
    damageSamples: state.damageSamples.length,
    distinctDamagePositions: distinctPositions.size,
  };
}

async function run() {
  const hosting = await startServer();
  let browser;
  const report = { events: [], errors: [] };
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push({ kind: "page", message: error.message }));
    page.on("console", (message) => { if (message.type() === "error") report.errors.push({ kind: "console", message: message.text() }); });
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    assert.equal(await page.locator("#start-defense").isVisible(), true, "lobby must expose a live departure action");
    report.events.push("lobby-visible");
    await page.locator("#start-defense").click();
    const surface = page.locator('[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    report.events.push("battle-visible");
    const accessibility = await page.locator("#defense-battle-surface").evaluate((surface) => ({
      label: surface.getAttribute("aria-label"),
      canvasLabel: surface.querySelector("#defense-canvas")?.getAttribute("aria-label"),
      statusLive: surface.querySelector("#battle-status")?.getAttribute("aria-live"),
      movement: {
        role: surface.querySelector("#movement-actions")?.getAttribute("role"),
        label: surface.querySelector("#movement-actions")?.getAttribute("aria-label"),
        buttons: [...surface.querySelectorAll("#movement-actions [data-move]")].map((button) => ({
          move: button.dataset.move,
          label: button.getAttribute("aria-label"),
        })),
      },
    }));
    assert.match(accessibility.label ?? "", /\S/, "battle surface must expose an accessible name");
    assert.match(accessibility.canvasLabel ?? "", /\S/, "battle canvas must expose an accessible name");
    assert.equal(accessibility.statusLive, "polite", "battle status must announce snapshot changes");
    assert.deepEqual(accessibility.movement, {
      role: "group",
      label: "한 손 이동 조작",
      buttons: [
        { move: "N", label: "위로 이동" },
        { move: "W", label: "왼쪽으로 이동" },
        { move: "IDLE", label: "이동 정지" },
        { move: "E", label: "오른쪽으로 이동" },
        { move: "S", label: "아래로 이동" },
      ],
    }, "one-thumb directions must expose stable, labeled public controls");
    await page.locator('[data-move="E"]').focus();
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.move),
      "E",
      "a one-thumb direction must remain keyboard focusable",
    );
    await page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseFeedback === "lore");
    assert.equal(await page.locator("#battle-event-feedback").getAttribute("data-feedback"), "lore");
    assert.match(
      await page.locator("#battle-event-feedback").textContent() ?? "",
      /\S/,
      "lore feedback must render safe snapshot-derived text through the live status region",
    );
    const cutscene = page.locator("#defense-cutscene-overlay");
    await cutscene.waitFor({ state: "visible" });
    assert.ok(
      ["STAGE_STARTED", "LORE_SURPRISE_RESOLVED"].includes(await surface.getAttribute("data-defense-cutscene")),
      "stage entry must present authored stage or resolved-lore snapshot copy",
    );
    const duringCutscene = await surface.getAttribute("data-defense-input-seq");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, duringCutscene);
    report.events.push("keyboard-movement-during-cutscene");
    assert.equal(await surface.getAttribute("data-defense-move"), "IDLE", "keyboard release must leave the public movement state idle");
    await cutscene.locator("[data-cutscene-dismiss]").focus();
    await page.keyboard.press("Enter");
    await cutscene.waitFor({ state: "hidden" });
    assert.equal(await surface.getAttribute("data-defense-cutscene"), null, "cutscene dismissal must not leave stale presentation state");
    const beforeControlKeyboard = await surface.getAttribute("data-defense-input-seq");
    await page.locator('[data-move="E"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, beforeControlKeyboard);
    assert.equal(await surface.getAttribute("data-defense-move"), "E", "keyboard activation must queue the public east movement command");
    report.events.push("stage-cutscene-dismissed");
    const before = await surface.getAttribute("data-defense-input-seq");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, before);
    report.events.push("keyboard-movement-after-cutscene");
    const box = await page.locator("#defense-canvas").boundingBox();
    assert(box, "canvas must have bounds");
    const beforeTouch = Number(await surface.getAttribute("data-defense-input-seq"));
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.waitForFunction((value) => Number(document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq) > value, beforeTouch);
    assert.equal(await surface.getAttribute("data-defense-move"), "IDLE", "completed touch input must settle the public movement state");
    report.events.push("touch-movement");
    const growthOffer = page.locator("#defense-growth-offer");
    const selectedGrowthSkills = new Set();
    const maxImmediateGrowthSelections = 8;
    let growthOfferClosed = false;
    await growthOffer.waitFor({ state: "visible", timeout: 30000 });
    for (let selection = 0; selection < maxImmediateGrowthSelections; selection += 1) {
      const choices = await growthOffer.locator("button[data-pick]").evaluateAll((buttons) => buttons.map((button) => button.dataset.pick ?? ""));
      assert.ok(choices.length > 0, "a visible growth offer must contain a selectable real skill");
      assert.equal(new Set(choices).size, choices.length, "a growth offer must not repeat a selectable skill");
      choices.forEach((skill) => assert.match(skill, /\S/, "each growth choice must identify a real skill"));
      const skill = choices[0];
      assert.equal(selectedGrowthSkills.has(skill), false, "a selected growth skill must not be offered again");
      const offerKey = choices.join(",");
      await growthOffer.locator(`button[data-pick="${skill}"]`).click();
      selectedGrowthSkills.add(skill);
      report.events.push({ event: "growth-selected", skill });
      await page.waitForFunction(({ offerKey, skill }) => {
        const status = document.querySelector("#battle-status")?.textContent ?? "";
        if (!status.includes("성장 선택 중")) return true;
        const nextOffer = document.querySelector("#defense-growth-offer");
        const nextChoices = [...nextOffer?.querySelectorAll("button[data-pick]") ?? []]
          .map((button) => button.dataset.pick ?? "");
        return Boolean(nextOffer) && (
          nextChoices.length === 0
          || (nextChoices.join(",") !== offerKey && !nextChoices.includes(skill))
        );
      }, { offerKey, skill });
      if (await growthOffer.isHidden()) {
        growthOfferClosed = true;
        break;
      }
      const nextChoices = await growthOffer.locator("button[data-pick]").count();
      if (nextChoices === 0) {
        assert.equal(selectedGrowthSkills.size, maxImmediateGrowthSelections, "an empty growth offer is valid only after every skill is owned");
        await growthOffer.waitFor({ state: "hidden" });
        growthOfferClosed = true;
        break;
      }
    }
    assert.equal(growthOfferClosed, true, "growth selections must settle without leaving an unresolved offer");
    assert.deepEqual(report.errors, [], "visible journey emitted unexpected page or console errors");
    await context.close();
    const worldHud = await verifyWorldHud(browser, hosting, await seededWorldHudCampaign());
    report.worldHud = worldHud;
    console.log(JSON.stringify({ pass: true, ...report }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}
if (playwright) run().catch((error) => { console.error(error.stack || String(error)); process.exitCode = 1; });
