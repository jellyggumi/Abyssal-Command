const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
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
const STORAGE_KEY = "abyssal-command-defense";
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

async function seededIdleCampaign() {
  const campaignState = await import("../campaign-state.js");
  let campaign = campaignState.createCampaign({ campaignId: "browser-idle", resetEpoch: 3 });
  for (const stage of campaignState.STAGES.slice(0, -1)) {
    campaign = campaignState.startRun(campaign, stage.id);
    campaign = campaignState.applyCampaignRunResult(campaign, { stageId: stage.id, outcome: "victory" });
  }
  const payload = campaignState.serializeCampaign(campaign);
  payload.idleReturn.lastSettledAt = NOW - 2 * campaignState.IDLE_RETURN_INTERVAL_MS;
  const text = JSON.stringify(payload);
  return {
    encoded: JSON.stringify({
      version: campaignState.RULES_VERSION,
      hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
      payload,
    }),
    payload,
    expectedAward: payload.resolvedIds.length * 2,
  };
}

async function run() {
  const [hosting, campaign, catalog] = await Promise.all([
    startServer(),
    seededIdleCampaign(),
    import("../defense-catalog.js"),
  ]);
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    await page.addInitScript(({ encoded, now, key }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      Date.now = () => now;
      if (!localStorage.getItem(key)) localStorage.setItem(key, encoded);
    }, { encoded: campaign.encoded, now: NOW, key: STORAGE_KEY });

    await page.goto("/index.html", { waitUntil: "networkidle" });
    const idleSummary = page.locator("#idle-return-summary");
    await idleSummary.waitFor({ state: "visible" });
    assert.equal(await idleSummary.getAttribute("data-idle-return-outcome"), "SETTLED", "initialization must visibly settle a due offline return");
    assert.equal(await idleSummary.getAttribute("data-idle-return-total"), String(campaign.expectedAward), "the lobby must expose the durable canonical idle total");
    assert.match(await idleSummary.textContent() ?? "", new RegExp(String(campaign.expectedAward)), "the settlement acknowledgement must state the awarded durable total");

    await page.locator('[data-stage="gate-zenith"]').click();
    const narrative = page.locator("#briefing-stage-narrative");
    assert.equal(await narrative.getAttribute("data-stage-id"), "gate-zenith", "the briefing must identify the selected authored stage");
    assert.match(await narrative.textContent() ?? "", new RegExp(catalog.CUTSCENES["gate-zenith"].intro.at(-1)), "a later stage briefing must retain its authored narrative instead of generic fallback copy");

    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });
    const expectedIntegrity = `${catalog.COMMANDER.integrity}/${catalog.COMMANDER.maxIntegrity}`;
    const expectedGateMaximum = campaign.payload.rewardIds.reduce(
      (maximum, rewardId) => maximum + (catalog.REWARDS[rewardId]?.integrity ?? 0),
      catalog.GATE.maxIntegrity,
    );
    const expectedGateIntegrity = `${expectedGateMaximum}/${expectedGateMaximum}`;
    const commanderIntegrity = page.locator("#battle-commander-integrity");
    const gateIntegrity = page.locator("#battle-integrity");
    assert.equal(await commanderIntegrity.getAttribute("data-integrity-current"), String(catalog.COMMANDER.integrity), "the battle UI must project the commander’s current integrity");
    assert.equal(await commanderIntegrity.getAttribute("data-integrity-max"), String(catalog.COMMANDER.maxIntegrity), "the battle UI must project the commander’s maximum integrity");
    assert.match(await commanderIntegrity.textContent() ?? "", new RegExp(expectedIntegrity), "the battle UI must expose the commander’s current and maximum integrity");
    assert.equal(await gateIntegrity.getAttribute("data-integrity-current"), String(expectedGateMaximum), "the battle UI must project the Gate’s current integrity");
    assert.equal(await gateIntegrity.getAttribute("data-integrity-max"), String(expectedGateMaximum), "the battle UI must project the Gate’s maximum integrity");
    assert.match(await gateIntegrity.textContent() ?? "", new RegExp(expectedGateIntegrity), "the battle UI must expose the Gate’s current and maximum integrity");
    await page.reload({ waitUntil: "networkidle" });
    await idleSummary.waitFor({ state: "visible" });
    assert.notEqual(await idleSummary.getAttribute("data-idle-return-outcome"), "SETTLED", "reloading the same returned interval must not claim it again");
    assert.equal(await idleSummary.getAttribute("data-idle-return-total"), String(campaign.expectedAward), "a duplicate return check must preserve the settled canonical total");
    assert.deepEqual(errors, [], "the user-visible contract journey must not emit page or console errors");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
