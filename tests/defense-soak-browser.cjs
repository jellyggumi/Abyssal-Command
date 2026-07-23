const fs = require("node:fs");
const { createHash } = require("node:crypto");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RELEASE_DURATION_MS = 1_800_000;
const RELEASE_SAMPLE_INTERVAL_MS = 10_000;
const ACTION_INTERVAL_MS = 250;
const FIVE_MINUTES_MS = 300_000;
const MIB = 2 ** 20;
const THRESHOLDS = Object.freeze({
  frameP95Ms: 16.7,
  longFrameMs: 33.4,
  longFrameRatio: 0.005,
  inputP95Ms: 100,
  inputMaxMs: 100,
  maxDomNodesExclusive: 5000,
  heapMedianGrowth: "max(8 MiB, 10%)",
  heapSlopeMiBPerMinute: 0.5,
  errorCount: 0,
});
const RUNTIME_PATHS = Object.freeze([
  "index.html", "app.js", "defense-viewport.js", "defense-catalog.js", "defense-run-simulation.js",
  "campaign-state.js", "defense-storage.js", "defense-audio.js", "defense-cutscene.js", "defense-telemetry.js",
  "battle-realtime-three.js", "battle-visualizer.js", "styles.css", "react-game-ui.css", "sw.js", "manifest.json",
  "icon.svg", "privacy.html", "assets/icons/icon-192.png", "assets/icons/icon-512.png",
  "assets/images/battle/dusk-warden-frame-00.png", "assets/images/battle/dusk-warden-frame-01.png",
  "assets/images/battle/dusk-warden-frame-02.png", "assets/images/battle/dusk-warden-frame-03.png",
  "assets/images/battle/echo-rusher-frame-00.png", "assets/images/battle/echo-rusher-frame-01.png",
  "assets/images/battle/echo-rusher-frame-02.png", "assets/images/battle/echo-rusher-frame-03.png",
]);

function configuration() {
  const revision = process.env.SOAK_REVISION;
  const durationRaw = process.env.SOAK_MS;
  const testMode = process.env.SOAK_TEST_MODE === "1";
  const selfHost = process.env.SOAK_SELF_HOST === "1";

  if (!revision) throw new Error("SOAK_REVISION is required");
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("SOAK_REVISION must be a full lowercase 40-character Git SHA");
  if (!durationRaw) throw new Error("SOAK_MS is required");
  const durationMs = Number(durationRaw);
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new Error("SOAK_MS must be a positive integer");
  if (!testMode && durationMs !== RELEASE_DURATION_MS) {
    throw new Error(`release soak requires SOAK_MS=${RELEASE_DURATION_MS}`);
  }
  if (testMode && (durationMs < 1000 || durationMs > 60_000)) {
    throw new Error("SOAK_TEST_MODE permits only an explicit 1,000-60,000ms smoke duration");
  }
  if (selfHost && !testMode) throw new Error("SOAK_SELF_HOST is test-mode only");

  const configuredBaseUrl = process.env.SOAK_BASE_URL || "http://127.0.0.1:4173";
  if (!selfHost) {
    const parsed = new URL(configuredBaseUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("SOAK_BASE_URL must use http or https");
  }

  return {
    revision,
    durationMs,
    testMode,
    selfHost,
    configuredBaseUrl,
    outputPath: path.resolve(process.env.SOAK_OUTPUT || `results/defense-soak-${revision}.json`),
    sampleIntervalMs: testMode ? Math.max(500, Math.min(1000, Math.floor(durationMs / 3))) : RELEASE_SAMPLE_INTERVAL_MS,
  };
}

function contentType(file) {
  const extension = path.extname(file);
  return extension === ".js" || extension === ".mjs" ? "text/javascript"
    : extension === ".css" ? "text/css"
      : extension === ".json" ? "application/json"
        : extension === ".svg" ? "image/svg+xml"
          : extension === ".png" ? "image/png"
            : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
              : extension === ".ico" ? "image/x-icon"
                : "text/html";
}

async function runtimeCandidate() {
  const files = [];
  for (const relativePath of RUNTIME_PATHS) {
    const bytes = await fs.promises.readFile(path.resolve(ROOT, relativePath));
    files.push({
      path: relativePath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.byteLength,
    });
  }
  return {
    schema: "abyssal-pages-runtime-candidate/v1",
    sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
    files,
  };
}

function startTestServer() {
  const host = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.resolve(ROOT, `.${decodeURIComponent(pathname)}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType(file) });
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    host.listen(0, "127.0.0.1", () => resolve({
      host,
      baseUrl: `http://127.0.0.1:${host.address().port}`,
    })).on("error", reject);
  });
}

function closeServer(host) {
  return new Promise((resolve) => host.close(resolve));
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function median(values) {
  return percentile(values, 0.5);
}

function leastSquaresSlope(samples) {
  if (samples.length < 2) return null;
  const meanX = samples.reduce((sum, sample) => sum + sample.elapsedMs, 0) / samples.length;
  const meanY = samples.reduce((sum, sample) => sum + sample.usedBytes, 0) / samples.length;
  const denominator = samples.reduce((sum, sample) => sum + (sample.elapsedMs - meanX) ** 2, 0);
  if (denominator === 0) return null;
  return samples.reduce(
    (sum, sample) => sum + (sample.elapsedMs - meanX) * (sample.usedBytes - meanY),
    0,
  ) / denominator;
}

async function clickVisible(locator) {
  if (!await locator.isVisible().catch(() => false)) return false;
  return locator.click({ timeout: 1000 }).then(() => true, () => false);
}

async function markInputSource(page, source) {
  await page.evaluate((value) => {
    if (globalThis.__defenseSoak) globalThis.__defenseSoak.pendingInputSource = value;
  }, source);
}

async function issueMovement(page, actions, iteration) {
  if (iteration % 4 === 3) {
    const canvas = page.locator("#defense-canvas");
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      const points = [[0.72, 0.5], [0.5, 0.28], [0.28, 0.5], [0.5, 0.72]];
      const [x, y] = points[Math.floor(iteration / 4) % points.length];
      await markInputSource(page, "touch");
      await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * y);
      actions.touchMoves += 1;
      return "touch-move";
    }
  }

  const directions = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"];
  await markInputSource(page, "keyboard");
  await page.keyboard.press(directions[iteration % directions.length]);
  actions.keyboardMoves += 1;
  return "keyboard-move";
}

async function performPublicAction(page, actions, iteration) {
  if (await clickVisible(page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]").first())) {
    actions.cutscenesDismissed += 1;
    return "dismiss-cutscene";
  }
  if (await clickVisible(page.locator("#defense-growth-offer [data-pick]").first())) {
    actions.growthSelections += 1;
    return "select-growth";
  }
  if (await clickVisible(page.locator("#extract-elite").first())) {
    actions.extractionRequests += 1;
    return "route-occupation-extraction";
  }
  if (await clickVisible(page.locator("[data-reward]").first())) {
    actions.rewardSelections += 1;
    return "select-reward";
  }
  if (await clickVisible(page.locator("#result-action").first())) {
    actions.resultActions += 1;
    return "restart-or-advance-run";
  }
  if (await clickVisible(page.locator("#start-defense").first())) {
    actions.departures += 1;
    return "start-run";
  }
  if (await clickVisible(page.locator("#skill-actions [data-cast]:not([disabled])").first())) {
    actions.skillCasts += 1;
    return "cast-skill";
  }
  return issueMovement(page, actions, iteration);
}

async function installInstrumentation(page) {
  await page.evaluate(() => {
    const sample = globalThis.__defenseSoak = {
      battleStarts: 0,
      frames: [],
      inputs: [],
      pendingInputSource: null,
      startedAt: performance.now(),
    };
    const seenBattles = new WeakSet();
    const observeBattle = () => {
      const surface = document.querySelector('[data-defense-ready="true"]');
      if (surface && !seenBattles.has(surface)) {
        seenBattles.add(surface);
        sample.battleStarts += 1;
      }
    };
    observeBattle();
    new MutationObserver(observeBattle).observe(document.documentElement, { childList: true, subtree: true });
    let previous;
    const frame = (now) => {
      if (previous !== undefined) sample.frames.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    addEventListener("abyssal:defense-input-feedback", (event) => {
      if (event.detail?.type !== "MOVE") return;
      sample.inputs.push({
        latencyMs: event.detail.displayedAt - event.detail.admittedAt,
        source: sample.pendingInputSource || "unknown",
      });
    });
    requestAnimationFrame(frame);
  });
}

async function sampleRuntime(page, cdp, heaps, domSamples, startedAt) {
  const metrics = await cdp.send("Performance.getMetrics");
  const usedBytes = metrics.metrics.find(({ name }) => name === "JSHeapUsedSize")?.value;
  if (!Number.isFinite(usedBytes)) throw new Error("Chrome Performance metrics omitted JSHeapUsedSize");
  const elapsedMs = Date.now() - startedAt;
  heaps.push({ elapsedMs, usedBytes });
  domSamples.push({
    elapsedMs,
    nodes: await page.locator("*").count(),
  });
}

function summarize(config, raw, heaps, domSamples, errors, actions, actualDurationMs) {
  const frameValues = raw.frames.filter(Number.isFinite);
  const inputValues = raw.inputs.map(({ latencyMs }) => latencyMs).filter(Number.isFinite);
  const heapWindowMs = config.testMode
    ? Math.max(config.sampleIntervalMs, Math.floor(config.durationMs / 3))
    : FIVE_MINUTES_MS;
  const firstHeap = heaps.filter(({ elapsedMs }) => elapsedMs <= heapWindowMs).map(({ usedBytes }) => usedBytes);
  const lastHeap = heaps.filter(({ elapsedMs }) => elapsedMs >= config.durationMs - heapWindowMs).map(({ usedBytes }) => usedBytes);
  const firstHeapMedianBytes = median(firstHeap);
  const lastHeapMedianBytes = median(lastHeap);
  const slopeBytesPerMs = leastSquaresSlope(heaps);
  const allowedHeapGrowthBytes = firstHeapMedianBytes === null
    ? null
    : Math.max(8 * MIB, firstHeapMedianBytes * 0.10);
  const inputSources = raw.inputs.reduce((counts, input) => {
    counts[input.source] = (counts[input.source] || 0) + 1;
    return counts;
  }, {});

  const summary = {
    configuredDurationMs: config.durationMs,
    actualDurationMs,
    frameCount: frameValues.length,
    frameP95Ms: percentile(frameValues, 0.95),
    longFrameCount: frameValues.filter((value) => value > THRESHOLDS.longFrameMs).length,
    longFrameRatio: frameValues.length
      ? frameValues.filter((value) => value > THRESHOLDS.longFrameMs).length / frameValues.length
      : null,
    inputCount: inputValues.length,
    inputSources,
    inputP95Ms: percentile(inputValues, 0.95),
    inputMaxMs: inputValues.length ? Math.max(...inputValues) : null,
    heapSampleCount: heaps.length,
    heapSampleIntervalMs: config.sampleIntervalMs,
    heapWindowMs,
    firstHeapMedianBytes,
    lastHeapMedianBytes,
    allowedHeapGrowthBytes,
    heapSlopeMiBPerMinute: slopeBytesPerMs === null ? null : slopeBytesPerMs * 60_000 / MIB,
    domSampleCount: domSamples.length,
    maxDomNodes: domSamples.length ? Math.max(...domSamples.map(({ nodes }) => nodes)) : null,
    errorCount: errors.length,
    battleStarts: raw.battleStarts,
    actions,
  };

  const releaseChecks = {
    exactDuration: config.durationMs === RELEASE_DURATION_MS,
    frameSamplesPresent: summary.frameCount > 0,
    frameP95: summary.frameP95Ms !== null && summary.frameP95Ms <= THRESHOLDS.frameP95Ms,
    longFrameRatio: summary.longFrameRatio !== null && summary.longFrameRatio < THRESHOLDS.longFrameRatio,
    keyboardInputObserved: (summary.inputSources.keyboard || 0) > 0,
    touchInputObserved: (summary.inputSources.touch || 0) > 0,
    inputP95: summary.inputP95Ms !== null && summary.inputP95Ms <= THRESHOLDS.inputP95Ms,
    inputMaximum: summary.inputMaxMs !== null && summary.inputMaxMs <= THRESHOLDS.inputMaxMs,
    heapWindowsPresent: firstHeap.length > 0 && lastHeap.length > 0,
    heapMedianDrift: firstHeapMedianBytes !== null
      && lastHeapMedianBytes !== null
      && allowedHeapGrowthBytes !== null
      && lastHeapMedianBytes <= firstHeapMedianBytes + allowedHeapGrowthBytes,
    heapSlope: summary.heapSlopeMiBPerMinute !== null
      && summary.heapSlopeMiBPerMinute <= THRESHOLDS.heapSlopeMiBPerMinute,
    activeDom: summary.maxDomNodes !== null && summary.maxDomNodes < THRESHOLDS.maxDomNodesExclusive,
    runtimeErrors: summary.errorCount === THRESHOLDS.errorCount,
    growthRoute: actions.growthSelections > 0,
    occupationExtractionRoute: actions.extractionRequests > 0,
    rewardRoute: actions.rewardSelections > 0,
    runRestart: actions.resultActions > 0 && raw.battleStarts > 1,
  };
  const smokeChecks = {
    frameSamplesPresent: summary.frameCount > 0,
    inputSamplesPresent: summary.inputCount > 0,
    heapSamplesPresent: summary.heapSampleCount >= 2,
    domSamplesPresent: summary.domSampleCount >= 2,
    activeDom: releaseChecks.activeDom,
    runtimeErrors: releaseChecks.runtimeErrors,
  };
  const releasePass = Object.values(releaseChecks).every(Boolean);
  const smokePass = Object.values(smokeChecks).every(Boolean);

  return {
    summary,
    releaseChecks,
    smokeChecks,
    releasePass,
    smokePass,
    pass: config.testMode ? smokePass : releasePass,
  };
}

async function emitReport(config, report) {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.promises.mkdir(path.dirname(config.outputPath), { recursive: true });
  await fs.promises.writeFile(config.outputPath, json);
  process.stdout.write(json);
}

async function run() {
  const config = configuration();
  let hosting;
  const candidateStart = await runtimeCandidate();
  let browser;
  let context;
  const errors = [];
  const heaps = [];
  const domSamples = [];
  const actions = {
    cutscenesDismissed: 0,
    departures: 0,
    growthSelections: 0,
    extractionRequests: 0,
    rewardSelections: 0,
    resultActions: 0,
    skillCasts: 0,
    keyboardMoves: 0,
    touchMoves: 0,
  };

  try {
    if (config.selfHost) hosting = await startTestServer();
    const baseUrl = hosting?.baseUrl || config.configuredBaseUrl;
    const { chromium } = require("playwright");
    browser = await chromium.launch({
      headless: true,
      args: ["--enable-precise-memory-info"],
    });
    context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1280, height: 720 },
      hasTouch: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push({ kind: "page", message: error.message }));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push({ kind: "console", message: message.text() });
    });
    page.on("requestfailed", (request) => errors.push({
      kind: "request",
      message: `${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`,
    }));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push({
        kind: "http",
        message: `${response.status()} ${response.request().method()} ${response.url()}`,
      });
    });

    await page.goto("/index.html", { waitUntil: "networkidle" });
    if (!await clickVisible(page.locator("#start-defense"))) throw new Error("lobby did not expose #start-defense");
    actions.departures += 1;
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });
    await installInstrumentation(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const startedWall = Date.now();
    const startedAt = new Date(startedWall).toISOString();

    const deadline = startedWall + config.durationMs;
    let nextSampleAt = startedWall;
    let iteration = 0;
    while (Date.now() < deadline) {
      await performPublicAction(page, actions, iteration);
      iteration += 1;
      const now = Date.now();
      if (now >= nextSampleAt) {
        await sampleRuntime(page, cdp, heaps, domSamples, startedWall);
        do nextSampleAt += config.sampleIntervalMs; while (nextSampleAt <= now);
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await page.waitForTimeout(Math.min(ACTION_INTERVAL_MS, remaining));
    }
    if (!heaps.length || Date.now() - startedWall - heaps.at(-1).elapsedMs >= config.sampleIntervalMs / 2) {
      await sampleRuntime(page, cdp, heaps, domSamples, startedWall);
    }

    const raw = await page.evaluate(() => globalThis.__defenseSoak);
    const actualDurationMs = Date.now() - startedWall;
    const candidateEnd = await runtimeCandidate();
    const candidateStable = candidateStart.sha256 === candidateEnd.sha256;
    const verdict = summarize(config, raw, heaps, domSamples, errors, actions, actualDurationMs);
    verdict.releaseChecks.candidateStable = candidateStable;
    verdict.smokeChecks.candidateStable = candidateStable;
    verdict.releasePass = Object.values(verdict.releaseChecks).every(Boolean);
    verdict.smokePass = Object.values(verdict.smokeChecks).every(Boolean);
    verdict.pass = config.testMode ? verdict.smokePass : verdict.releasePass;
    const report = {
      schema: "abyssal-defense-soak",
      version: 1,
      mode: config.testMode ? "test" : "release",
      releaseEligible: !config.testMode && config.durationMs === RELEASE_DURATION_MS,
      revision: config.revision,
      baseUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      thresholds: THRESHOLDS,
      candidate: candidateStart,
      candidateEndSha256: candidateEnd.sha256,
      ...verdict,
      errors,
      heaps,
      domSamples,
    };
    await emitReport(config, report);
    if (!report.pass) process.exitCode = 1;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (hosting) await closeServer(hosting.host);
  }
}

run().catch(async (error) => {
  const failure = {
    schema: "abyssal-defense-soak",
    version: 1,
    pass: false,
    error: error instanceof Error ? error.message : String(error),
  };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
});
