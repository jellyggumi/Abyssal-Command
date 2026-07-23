const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const playwright = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const NOW = 2_000_000;

function startServer() {
  const host = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const file = path.resolve(ROOT, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      const mime = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".mp4": "video/mp4" };
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host,
    url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

async function seededCampaign() {
  const campaignState = await import("../campaign-state.js");
  let campaign = campaignState.createCampaign({ campaignId: "browser-idle", resetEpoch: 3 });
  for (const stage of campaignState.STAGES.slice(0, -1)) {
    campaign = campaignState.startRun(campaign, stage.id);
    campaign = campaignState.applyCampaignRunResult(campaign, { stageId: stage.id, outcome: "victory" });
  }
  const payload = campaignState.serializeCampaign(campaign);
  payload.idleReturn.lastSettledAt = NOW - 2 * campaignState.IDLE_RETURN_INTERVAL_MS;
  const text = JSON.stringify(payload);
  return JSON.stringify({
    version: campaignState.RULES_VERSION,
    hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
    payload,
  });
}


async function openLobby(browser, hosting, campaign, reducedMotion = "no-preference") {
  const context = await browser.newContext({
    baseURL: hosting.url,
    reducedMotion,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript(({ campaign, now }) => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    Date.now = () => now;
    localStorage.setItem("abyssal-command-defense", campaign);
  }, { campaign, now: NOW });
  await page.goto("/index.html", { waitUntil: "networkidle" });
  return { context, errors, page };
}

async function atlasSnapshot(page, stage, profile) {
  await page.locator(`[data-stage="${stage.id}"]`).click();
  const atlas = page.locator('[data-stage-atlas="selected"]');
  await atlas.waitFor({ state: "visible" });
  assert.equal(await atlas.getAttribute("data-stage-id"), stage.id, `${stage.id} atlas must identify its selected authored stage`);
  assert.equal(await atlas.getAttribute("data-terrain-pattern"), profile.terrain.patternId, `${stage.id} atlas must use its catalog terrain profile`);
  const mapContext = page.locator('[data-stage-map-context="terrain"]');
  const briefing = page.locator('[data-stage-briefing="selected"]');
  assert.equal(await briefing.getAttribute("data-stage-id"), stage.id, `${stage.id} briefing must remain attached to the selected stage`);
  const [atlasText, mapText] = await Promise.all([
    atlas.textContent(),
    mapContext.textContent(),
  ]);
  assert.match((atlasText ?? "").replace(/\s+/g, " "), new RegExp(profile.mapLabels.title), `${stage.id} atlas must expose its catalog title`);
  assert.match((atlasText ?? "").replace(/\s+/g, " "), new RegExp(profile.mapLabels.domain), `${stage.id} atlas must expose its catalog domain`);
  const text = (mapText ?? "").replace(/\s+/g, " ");
  for (const label of [profile.terrain.label, profile.mapLabels.chokepath, profile.mapLabels.hazard, profile.mapLabels.occupation, profile.mapLabels.extraction, ...profile.landmarks.map(({ label }) => label)]) {
    assert.match(text, new RegExp(label), `${stage.id} map context must expose its catalog ${label} label`);
  }
}

async function battleSnapshot(page, stage, profile) {
  await page.locator("#start-defense").click();
  const surface = page.locator("#defense-battle-surface");
  await surface.waitFor({ state: "visible" });
  assert.equal(await surface.getAttribute("data-stage-id"), stage.id, "battle surface must retain selected stage identity");
  assert.equal(await surface.getAttribute("data-terrain-pattern"), profile.terrain.patternId, "battle surface must retain selected terrain identity");
  assert.equal(await surface.getAttribute("data-visual-scale"), "2.5", "battle surface must disclose the visual-only actor scale");
  const context = page.locator('[data-stage-hud-context="current"]');
  const contextText = (await context.textContent() ?? "").replace(/\s+/g, " ");
  for (const label of [profile.mapLabels.title, profile.mapLabels.domain, profile.terrain.label]) {
    assert.match(contextText, new RegExp(label), `battle HUD must retain ${label} without animation-dependent meaning`);
  }
  const report = await page.evaluate(() => {
    const surface = document.querySelector("#defense-battle-surface");
    const controls = [...document.querySelectorAll("#movement-actions button")].map((node) => {
      const rect = node.getBoundingClientRect();
      return { height: rect.height, width: rect.width, name: node.getAttribute("aria-label") || node.textContent.trim() };
    });
    return {
      controls,
      domain: document.querySelector("#battle-domain")?.textContent?.trim(),
      objective: document.querySelector("#battle-objective")?.textContent?.trim(),
      terrain: document.querySelector("#battle-terrain-context")?.textContent?.trim(),
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      surfaceLabel: surface?.getAttribute("aria-label"),
    };
  });
  assert.ok(report.controls.length >= 4, "mobile battle must retain directional controls");
  assert.ok(report.controls.every(({ width, height }) => width >= 44 && height >= 44), "mobile controls must remain at least 44px in both dimensions");
  assert.ok(report.controls.every(({ name }) => name), "mobile controls must remain named");
  assert.equal(report.scrollWidth <= report.viewportWidth, true, "mobile world presentation must not cause horizontal overflow");
  assert.match(report.domain ?? "", new RegExp(profile.mapLabels.domain));
  assert.match(report.terrain ?? "", new RegExp(profile.terrain.label));
  assert.ok(report.objective, "battle objective remains readable");
  assert.ok(report.surfaceLabel, "battle surface remains named for assistive technology");
  return { contextText, report };
}

async function run() {
  const [hosting, campaign, catalog] = await Promise.all([startServer(), seededCampaign(), import("../defense-catalog.js")]);
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const stage = catalog.STAGES.at(-1);
    const profile = catalog.STAGE_PRESENTATION_BY_ID[stage.id];
    const normal = await openLobby(browser, hosting, campaign);
    try {
      await atlasSnapshot(normal.page, stage, profile);
      const normalBattle = await battleSnapshot(normal.page, stage, profile);
      assert.deepEqual(normal.errors, [], "normal-motion world presentation must not emit browser errors");

      const reduced = await openLobby(browser, hosting, campaign, "reduce");
      try {
        await atlasSnapshot(reduced.page, stage, profile);
        const reducedBattle = await battleSnapshot(reduced.page, stage, profile);
        assert.equal(reducedBattle.contextText, normalBattle.contextText, "reduced motion must retain the same static world-map semantics");
        assert.equal(reducedBattle.report.domain, normalBattle.report.domain, "reduced motion must retain world domain context");
        assert.equal(reducedBattle.report.terrain, normalBattle.report.terrain, "reduced motion must retain terrain context");
        assert.equal(reducedBattle.report.controls.length, normalBattle.report.controls.length, "reduced motion must retain mobile controls");
        assert.deepEqual(reduced.errors, [], "reduced-motion world presentation must not emit browser errors");
      } finally {
        await reduced.context.close();
      }
    } finally {
      await normal.context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
