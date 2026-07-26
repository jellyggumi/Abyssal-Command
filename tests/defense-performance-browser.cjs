const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const allowMissing = process.argv.includes("--allow-missing-browser");
let playwright;
try {
  playwright = require("playwright");
} catch {
  if (!allowMissing) throw new Error('require("playwright") failed; install the lock-backed browser dependency.');
  console.log("DEFENSE_PERFORMANCE_BROWSER_SKIPPED missing Playwright");
}
const ROOT = path.resolve(__dirname, "..");

function serve() {
  const host = http.createServer((req, res) => {
    const u = new URL(req.url, "http://localhost");
    const file = path.resolve(ROOT, `.${decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname)}`);
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return res.writeHead(404).end();
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": path.extname(file) === ".js" ? "text/javascript" : path.extname(file) === ".css" ? "text/css" : "text/html",
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    host.listen(0, "127.0.0.1", () => resolve({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", reject);
  });
}

async function sample(page) {
  await page.bringToFront().catch(() => {});
  await page.goto("/index.html", { waitUntil: "networkidle" });
  await page.locator("#start-defense").click();
  await page.locator('[data-defense-ready="true"]').waitFor();
  const probe = page.evaluate(async () => {
    const WARMUP_DEADLINE_MS = 10000;
    const SAMPLE_DEADLINE_MS = 5000;
    const collect = (deadlineMs, done) =>
      new Promise((resolve) => {
        const startedAt = performance.now();
        const intervals = [];
        let previous;
        let finished = false;
        const finish = (timedOut) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          resolve({ intervals, elapsedMs: performance.now() - startedAt, timedOut });
        };
        const timer = setTimeout(() => finish(true), deadlineMs + 250);
        const frame = (now) => {
          if (previous !== undefined) intervals.push(now - previous);
          previous = now;
          const expired = now - startedAt >= deadlineMs;
          const complete = !expired && done(intervals);
          if (complete) finish(false);
          else if (expired) finish(true);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    const visibility = () => ({ visibilityState: document.visibilityState, hidden: document.hidden });
    const surface = document.querySelector("#defense-battle-surface");
    const canvas = document.querySelector("#defense-canvas");
    const renderer = surface?.dataset.defenseRenderer ?? null;
    const renderScale = Number.parseFloat(canvas?.dataset.renderScale ?? "1");
    const softwareRenderer = renderer === "webgl" && Number.isFinite(renderScale) && renderScale < 1;
    const warmup = await collect(
      WARMUP_DEADLINE_MS,
      (intervals) => intervals.length >= 8 && Math.max(...intervals.slice(-8)) < 80,
    );
    const sampleDeadlineMs = SAMPLE_DEADLINE_MS;
    const sampleIntervalTarget = softwareRenderer ? 20 : 60;
    const cadenceMode = softwareRenderer ? "software-webgl-backbuffer" : "full-resolution";
    const cadenceReason = softwareRenderer
      ? `renderScale=${renderScale} indicates a software-WebGL backbuffer`
      : `renderer=${renderer ?? "unknown"} renderScale=${renderScale}`;
    const rafBudgetMs = softwareRenderer ? 200 : 100;
    const maxIntervalMs = 500;
    const measured = await collect(sampleDeadlineMs, (intervals) => intervals.length >= sampleIntervalTarget);
    const measurement = {
      ...visibility(),
      renderer,
      renderScale,
      softwareRenderer,
      cadenceMode,
      cadenceReason,
      rafBudgetMs,
      maxIntervalMs,
      sampleIntervalTarget,
      warmupIntervalsMs: warmup.intervals,
      warmupElapsedMs: warmup.elapsedMs,
      warmupTimedOut: warmup.timedOut,
      rafIntervalsMs: measured.intervals,
      rafMeanMs: measured.intervals.length
        ? measured.intervals.reduce((sum, value) => sum + value, 0) / measured.intervals.length
        : null,
      rafMaxMs: measured.intervals.length ? Math.max(...measured.intervals) : null,
      sampleElapsedMs: measured.elapsedMs,
      sampleTimedOut: measured.timedOut,
      domNodes: document.querySelectorAll("*").length,
      inputLatencyMs: [],
      seqBefore: surface?.dataset.defenseInputSeq ?? null,
      seqAfter: surface?.dataset.defenseInputSeq ?? null,
    };
    const before = surface.dataset.defenseInputSeq;
    const latencies = [];
    const listener = (event) => latencies.push(performance.now() - event.detail.admittedAt);
    window.addEventListener("abyssal:defense-input-feedback", listener);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
    window.removeEventListener("abyssal:defense-input-feedback", listener);
    return {
      ...measurement,
      inputLatencyMs: latencies,
      seqBefore: before,
      seqAfter: surface.dataset.defenseInputSeq,
    };
  });
  let watchdog;
  return Promise.race([
    probe,
    new Promise((_, reject) => {
      watchdog = setTimeout(() => reject(new Error("performance probe exceeded 30s watchdog")), 30000);
    }),
  ]).finally(() => clearTimeout(watchdog));
}

async function run() {
  const hosting = await serve();
  let browser;
  const results = [];
  const failures = [];
  try {
    browser = await playwright.chromium.launch({ headless: true });
    for (const [width, height] of [[844, 390], [2056, 1082]]) {
      const viewport = `${width}x${height}`;
      let context;
      let measured = null;
      const errors = [];
      try {
        context = await browser.newContext({ baseURL: hosting.url, viewport: { width, height } });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        measured = await sample(page);
        const warmupStabilized =
          measured.warmupTimedOut === false &&
          measured.warmupIntervalsMs.length >= 8 &&
          measured.warmupIntervalsMs
            .slice(-8)
            .every((interval) => Number.isFinite(interval) && interval > 0 && interval < 80);
        assert.ok(
          warmupStabilized || (measured.softwareRenderer && measured.warmupTimedOut),
          `${viewport} ${measured.cadenceMode} rAF warmup must stabilize, or explicitly report a software-WebGL timeout`,
        );
        assert.equal(
          measured.sampleTimedOut,
          false,
          `${viewport} ${measured.cadenceMode} rAF sample did not collect ${measured.sampleIntervalTarget} intervals within 5s`,
        );
        assert.notEqual(measured.seqBefore, measured.seqAfter, `${viewport} input feedback sequence must advance`);
        assert.ok(measured.domNodes < 5000, `${viewport} local active battle DOM must remain lightweight`);
        assert.ok(
          measured.rafMeanMs < measured.rafBudgetMs,
          `${viewport} ${measured.cadenceMode} rAF mean must remain below ${measured.rafBudgetMs}ms`,
        );
        assert.ok(
          measured.rafMaxMs < measured.maxIntervalMs,
          `${viewport} ${measured.cadenceMode} rAF intervals must remain below ${measured.maxIntervalMs}ms`,
        );
        assert.ok(
          measured.inputLatencyMs.length > 0 && Math.max(...measured.inputLatencyMs) < 100,
          `${viewport} input feedback event must be synchronously observable`,
        );
        assert.deepEqual(errors, [], `${viewport} page emitted unexpected errors`);
        results.push({ viewport, ...measured });
      } catch (error) {
        failures.push({ viewport, error: error.stack || String(error), measured, errors });
      } finally {
        if (context) {
          try {
            await context.close();
          } catch (error) {
            failures.push({ viewport, error: `context close failed: ${error.stack || error}`, measured, errors });
          }
        }
      }
    }
  } catch (error) {
    failures.push({ scope: "browser-run", error: error.stack || String(error) });
  } finally {
    try {
      if (browser) await browser.close();
    } catch (error) {
      failures.push({ scope: "browser-close", error: error.stack || String(error) });
    }
    try {
      await new Promise((resolve) => hosting.host.close(resolve));
    } catch (error) {
      failures.push({ scope: "server-close", error: error.stack || String(error) });
    }
    console.log(
      JSON.stringify(
        {
          pass: failures.length === 0,
          limits: {
            domNodes: "<5000",
            rafMeanMs: { fullResolution: "<100", softwareWebgl: "<200" },
            rafMaxMs: "<500",
            inputFeedbackMs: "<100",
          },
          results,
          failures,
        },
        null,
        2,
      ),
    );
    if (failures.length) process.exitCode = 1;
  }
}

if (playwright) run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
