const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

let playwright;
try {
  playwright = require("playwright");
} catch (error) {
  if (error && error.code === "MODULE_NOT_FOUND" && /['\"]playwright['\"]/.test(error.message)) {
    console.error('PLAYWRIGHT_MISSING: require("playwright") could not resolve from tests/playtest-browser-3stage.cjs.');
    process.exitCode = 1;
  } else {
    console.error(`PLAYWRIGHT_LOAD_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const ROOT = path.resolve(__dirname, "..");
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml"
});

function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  } catch {
    return null;
  }

  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(ROOT, `.${pathname}`);
  return filePath.startsWith(`${ROOT}${path.sep}`) ? filePath : null;
}

function serveStatic(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403);
    response.end();
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": stats.size,
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).on("error", () => response.destroy()).pipe(response);
  });
}

async function startServer() {
  const server = http.createServer(serveStatic);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert(address && typeof address === "object", "Local browser-proof server did not bind an address.");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server || !server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function isOptionalMediaUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.startsWith("/assets/audio/") || pathname.startsWith("/assets/video/");
  } catch {
    return false;
  }
}

async function text(locator) {
  return (await locator.textContent() || "").trim();
}

async function assertStage(page, number, heading) {
  assert.equal(await text(page.locator("#stage-number")), `Stage ${number} of 3`, `Stage ${number} number must be visible.`);
  assert.equal(await text(page.locator("#stage-heading")), heading, `Stage ${number} heading must be visible.`);
  assert.equal(await page.locator(`#stage-select-${number}`).getAttribute("aria-current"), "step", `Stage ${number} selector must identify the active stage.`);
}
async function assertBattleVisualizationStatus(page, number) {
  const status = await text(page.locator("#campaign-status"));
  if (status.includes("Battle visualization is unavailable")) {
    assert.equal(
      status,
      "Battle visualization is unavailable; command rules remain ready.",
      `Stage ${number} must expose the explicit visualizer fallback while retaining command controls.`
    );
  }
}
const BATTLE_PRESENTATIONS = Object.freeze({
  1: Object.freeze({
    operation: "Operation: Ember Break",
    doctrine: "Open the forge lane, raise shades, then sever the Warden's hold."
  }),
  2: Object.freeze({
    operation: "Operation: Veil Breach",
    doctrine: "Hold both signal nodes before the Tactician closes the listening routes."
  }),
  3: Object.freeze({
    operation: "Operation: Thronefall",
    doctrine: "Secure the throne node, invoke the Domain, and break the Sovereign's gate."
  })
});

async function assertBattlePresentation(page, number) {
  const presentation = BATTLE_PRESENTATIONS[number];
  assert.ok(presentation, `Stage ${number} must have a player-facing battle presentation.`);

  const brief = page.locator("#battle-tactical-brief");
  await brief.waitFor({ state: "visible" });
  assert.equal(await text(page.locator("#battle-operation")), presentation.operation, `Stage ${number} must expose its operation in the visible battle brief.`);
  assert.equal(await text(page.locator("#battle-doctrine")), presentation.doctrine, `Stage ${number} must expose its doctrine in the visible battle brief.`);

  const fallback = page.locator("#battle-visual-fallback");
  if (await fallback.isVisible()) {
    assert.equal(await text(page.locator("#battle-fallback-operation")), presentation.operation, `Stage ${number} fallback must retain the current operation.`);
    assert.equal(await text(page.locator("#battle-fallback-doctrine")), presentation.doctrine, `Stage ${number} fallback must retain the current doctrine.`);
    assert.equal(
      await text(page.locator("#battle-pressure")),
      "Static tactical fallback: rendering is unavailable, but command rules remain active.",
      `Stage ${number} fallback must truthfully report static rendering rather than active visual animation.`
    );
  }
}


async function clickEnabledAction(page, selector) {
  const action = page.locator(selector);
  const timeoutAt = Date.now() + 30_000;
  let lastError;
  await action.waitFor({ state: "visible" });
  while (Date.now() < timeoutAt) {
    if (!(await action.isEnabled())) {
      await page.waitForTimeout(100);
      continue;
    }
    try {
      await action.click({ timeout: 1_000 });
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(100);
      continue;
    }
    const disabledAt = Date.now() + 5_000;
    while (await action.isEnabled()) {
      if (Date.now() >= disabledAt) {
        assert.fail(`${selector} did not enter its visible cooldown after being clicked.`);
      }
      await page.waitForTimeout(25);
    }
    return;
  }
  assert.fail(`${selector} did not become stably enabled before its visible cooldown expired.${lastError ? ` Last click error: ${lastError.message}` : ""}`);
}

async function runActions(page, selectors) {
  for (const selector of selectors) {
    await clickEnabledAction(page, selector);
  }
}

async function enterBattle(page, number, heading) {
  await assertStage(page, number, heading);
  await page.locator("#view-scenario").waitFor({ state: "visible" });
  await page.locator("#go-to-boss-spec").click();
  await page.locator("#view-boss-spec").waitFor({ state: "visible" });
  assert.equal(await page.locator("#view-scenario").isHidden(), true, `Stage ${number} scenario view must close after confronting the boss.`);
  await page.locator("#go-to-battle").click();
  await page.locator("#view-battle").waitFor({ state: "visible" });
  assert.equal(await page.locator("#view-boss-spec").isHidden(), true, `Stage ${number} boss specification view must close after entering battle.`);
  await assertBattleVisualizationStatus(page, number);
  await assertBattlePresentation(page, number);
  return text(page.locator("#integrity-value"));
}

async function assertPreparationIntegrity(page, number, entryIntegrity) {
  const actualIntegrity = Number.parseInt(await text(page.locator("#integrity-value")), 10);
  const entryIntegrityValue = Number.parseInt(entryIntegrity, 10);
  assert.ok(
    actualIntegrity >= entryIntegrityValue,
    `Stage ${number} command-preparation route must not lose integrity before intentional boss assaults.`
  );
}

async function advanceToNextScenario(page, number, heading) {
  await page.locator("#view-result").waitFor({ state: "visible" });
  await page.locator("#go-to-next-scenario").waitFor({ state: "visible" });
  await page.locator("#go-to-next-scenario").click();
  await page.locator("#view-scenario").waitFor({ state: "visible" });
  await assertStage(page, number, heading);
}

async function chooseRewardAndAdvance(page, rewardId, number, heading) {
  await page.locator(`[data-reward-id="${rewardId}"]`).click();
  await page.locator("#reward-panel").waitFor({ state: "hidden" });
  await advanceToNextScenario(page, number, heading);
}


async function runStageOne(page) {
  const entryIntegrity = await enterBattle(page, 1, "Cinder Span");
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize", "#action-capture"]);
  await assertPreparationIntegrity(page, 1, entryIntegrity);
  await runActions(page, ["#action-assault", "#action-assault", "#action-assault"]);

  await page.locator("#reward-panel").waitFor({ state: "visible" });
  const rewards = page.locator("#reward-options .reward-option");
  const rewardIds = await rewards.evaluateAll((buttons) => buttons.map((button) => button.dataset.rewardId));
  assert.equal(
    await rewards.count(),
    4,
    `Stage 1 must offer exactly four mutually exclusive rewards; observed selector IDs: ${JSON.stringify(rewardIds)}.`
  );
  assert.deepEqual(
    rewardIds,
    ["ember-cohort", "rift-lens", "stillwater-hourglass", "shadebreaker-brand"],
    "Stage 1 reward choices must expose the current ordered reward IDs."
  );

  await chooseRewardAndAdvance(page, "rift-lens", 2, "Veil Citadel");
  assert.equal(await text(page.locator("#legion-value")), "0 / 10", "Rift Lens must leave Stage 2 at the base legion capacity.");
  assert.match(await text(page.locator("#campaign-status")), /Rift Lens carries into Veil Citadel\./, "Stage 2 must visibly report the selected Stage 1 boon.");
}

async function runStageTwo(page) {
  const entryIntegrity = await enterBattle(page, 2, "Veil Citadel");
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize", "#action-capture", "#action-capture", "#action-possess"]);
  await assertPreparationIntegrity(page, 2, entryIntegrity);
  await runActions(page, ["#action-assault", "#action-assault"]);

  await page.locator("#reward-panel").waitFor({ state: "visible" });
  const rewards = page.locator("#reward-options .reward-option");
  const rewardIds = await rewards.evaluateAll((buttons) => buttons.map((button) => button.dataset.rewardId));
  assert.equal(await rewards.count(), 3, "Stage 2 must offer exactly three mutually exclusive rewards.");
  assert.deepEqual(
    rewardIds,
    ["veil-vanguard", "anchor-shard", "abyssal-banner"],
    "Stage 2 reward choices must expose the current ordered reward IDs."
  );
  await chooseRewardAndAdvance(page, "veil-vanguard", 3, "Echo Throne");
  assert.equal(await text(page.locator("#legion-value")), "4 / 10", "Veil Vanguard must carry four raised shades into Stage 3.");
  assert.match(await text(page.locator("#campaign-status")), /Veil Vanguard carries into Echo Throne\./, "Stage 3 must visibly report the selected Stage 2 boon.");
}

async function runStageThree(page) {
  const entryIntegrity = await enterBattle(page, 3, "Echo Throne");
  await runActions(page, ["#action-hunt", "#action-hunt", "#action-extract", "#action-materialize", "#action-materialize", "#action-capture", "#action-possess", "#action-domain"]);
  await assertPreparationIntegrity(page, 3, entryIntegrity);
  assert.equal(await text(page.locator("#legion-value")), "8 / 10", "Two materializations must grow the Veil Vanguard from four to eight shades.");
  await runActions(page, ["#action-assault", "#action-assault", "#action-assault"]);
  await page.locator("#reward-panel").waitFor({ state: "visible" });
  const rewards = page.locator("#reward-options .reward-option");
  assert.deepEqual(
    await rewards.evaluateAll((buttons) => buttons.map((button) => button.dataset.rewardId)),
    ["throne-echo", "dawnless-crown"],
    "Stage 3 must offer its current two terminal reward choices."
  );
  await page.locator('[data-reward-id="throne-echo"]').click();
  await page.locator("#campaign-complete").waitFor({ state: "visible" });
  assert.equal(await text(page.locator("#completion-heading")), "가라앉은 문이 침묵하다", "Terminal completion heading must be visible.");
  assert.match(await text(page.locator("#completion-summary")), /Throne Echo is claimed\. The Gate Sovereign is gone, and Abyssal Command endures\./, "Terminal completion summary must confirm the final reward and victory.");
  assert.equal(await page.locator("#reward-panel").isHidden(), true, "No reward chooser may remain after the terminal selection.");
  for (const number of [1, 2, 3]) {
    const label = await page.locator(`#stage-select-${number}`).getAttribute("aria-label") || "";
    assert.match(label, /cleared/, `Stage ${number} must be marked cleared at completion.`);
  }
}

function cleanupError(label, error) {
  return `${label}: ${error instanceof Error ? error.message : String(error)}`;
}
function currentWorkerCacheName() {
  let serviceWorkerSource;
  try {
    serviceWorkerSource = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  } catch (error) {
    assert.fail(`Cannot read sw.js to derive CACHE_NAME for the browser cache assertion: ${error instanceof Error ? error.message : String(error)}`);
  }

  const declaration = serviceWorkerSource.match(/^\s*const\s+CACHE_NAME\s*=\s*(?:"([^"]+)"|'([^']+)')\s*;?\s*$/m);

  assert.ok(
    declaration,
    "sw.js must declare CACHE_NAME as a quoted string so the browser cache assertion can verify the current worker revision."
  );

  return declaration[1] || declaration[2];
}


async function verifyWorker(page, baseUrl) {
  const expectedCacheName = currentWorkerCacheName();
  const worker = await page.evaluate(async ({ timeoutMs }) => {
    if (!("serviceWorker" in navigator)) return { supported: false };
    const registration = await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`Service worker did not become ready within ${timeoutMs} ms.`)), timeoutMs);
      navigator.serviceWorker.ready.then(
        (readyRegistration) => {
          window.clearTimeout(timeout);
          resolve(readyRegistration);
        },
        (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      );
    });
    const active = registration.active || registration.waiting || registration.installing;
    const cacheNames = await caches.keys();
    return {
      supported: true,
      cacheNames,
      scope: registration.scope,
      scriptUrl: active ? active.scriptURL : null
    };
  }, { timeoutMs: 10_000 });

  assert.equal(worker.supported, true, "The browser must expose service workers for the static campaign.");
  assert.equal(worker.scope, `${baseUrl}/`, "The service worker must be scoped to this ephemeral loopback origin.");
  assert.equal(worker.scriptUrl, `${baseUrl}/sw.js`, "The active worker must come from the current sw.js source.");
  const campaignCaches = worker.cacheNames.filter((name) => name.startsWith("abyssal-surge-static-"));
  assert.deepEqual(campaignCaches, [expectedCacheName], "Only the current static worker cache must be observable after activation.");

  return { ...worker, cacheName: campaignCaches[0] };
}

async function run() {
  let server;
  let browser;
  let context;
  let page;
  const unexpectedErrors = [];
  const optionalMediaErrors = [];

  try {
    const hosting = await startServer();
    server = hosting.server;
    browser = await playwright.chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();

    page.on("pageerror", (error) => unexpectedErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const location = message.location();
      const sourceUrl = location.url || "";
      if (isOptionalMediaUrl(sourceUrl)) {
        optionalMediaErrors.push(`console: ${sourceUrl}`);
      } else {
        unexpectedErrors.push(`console: ${message.text()}${sourceUrl ? ` (${sourceUrl})` : ""}`);
      }
    });
    page.on("requestfailed", (request) => {
      if (isOptionalMediaUrl(request.url())) {
        optionalMediaErrors.push(`request: ${request.url()}`);
      } else {
        unexpectedErrors.push(`request: ${request.url()} (${request.failure()?.errorText || "failed"})`);
      }
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      if (isOptionalMediaUrl(response.url())) {
        optionalMediaErrors.push(`response ${response.status()}: ${response.url()}`);
      } else {
        unexpectedErrors.push(`response ${response.status()}: ${response.url()}`);
      }
    });

    await page.goto(`${hosting.baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent !== "Preparing local save…");
    const worker = await verifyWorker(page, hosting.baseUrl);

    await page.locator("#start-campaign").click();
    await page.locator("#campaign-screen").waitFor({ state: "visible" });
    await runStageOne(page);
    await runStageTwo(page);
    await runStageThree(page);

    assert.deepEqual(unexpectedErrors, [], `Unexpected browser errors:\n${unexpectedErrors.join("\n")}`);
    console.log(`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=${new URL(worker.scriptUrl).pathname} cache=${worker.cacheName} optional-media-errors=${optionalMediaErrors.length}`);
  } catch (error) {
    let screenshotPath = "";
    if (page) {
      try {
        screenshotPath = path.join(os.tmpdir(), "abyssal-surge-playtest-browser-failure.png");
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        screenshotPath = "";
      }
    }
    console.error(`PLAYTEST_BROWSER_FAIL: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    if (screenshotPath) console.error(`Failure screenshot: ${screenshotPath}`);
    process.exitCode = 1;
  } finally {
    const cleanupFailures = [];
    if (context) {
      try {
        await context.close();
      } catch (error) {
        cleanupFailures.push(cleanupError("context close", error));
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        cleanupFailures.push(cleanupError("browser close", error));
      }
    }
    if (server) {
      try {
        await closeServer(server);
      } catch (error) {
        cleanupFailures.push(cleanupError("server close", error));
      }
    }
    if (cleanupFailures.length) {
      console.error(`PLAYTEST_BROWSER_CLEANUP_FAIL: ${cleanupFailures.join("; ")}`);
      process.exitCode = 1;
    }
  }
}

if (playwright) run();
