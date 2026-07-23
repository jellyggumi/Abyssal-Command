# Performance budget

**Audience:** release engineer, gameplay programmer, and QA.  
**Evidence snapshot:** Git `dd49f9e13f081bf4390e1c47f836eda24b751fae` on 2026-07-22. The worktree is still changing; every worktree-derived check below remains mutable until the integration revision is frozen.

## Gate G6 thresholds

| metric | release threshold | current evidence | status |
|---|---:|---|---|
| frame interval p95 | ≤16.7 ms over the full 30-minute sample | short 60-interval headless samples were approximately 16.7 ms; not a soak | FIX |
| long-frame ratio | <0.5%, where a long frame is >33.4 ms | earlier 2/60 count used 16.8 ms as “long” and is not comparable to this definition | FIX |
| JS heap drift | last 5-minute median ≤ first 5-minute median + max(8 MiB, 10%), and least-squares slope ≤0.5 MiB/min | no 30-minute heap series | BLOCKED |
| input → visible feedback | p95 and maximum ≤100 ms for admitted keyboard/touch movement | short probes reported <1 ms; target-device soak absent | FIX |
| active DOM | <5,000 nodes at every sample | 33 nodes in the earlier short probe | PASS |
| runtime errors | 0 uncaught page errors and 0 error-level console messages | short browser probes reported 0 | PASS |
| deterministic 60 Hz reference | targeted deterministic/release suites fail 0 | earlier reference suites and strict 30-stage/3-seed simulation passed | PASS |
| active-worktree deterministic health | all directly affected tests pass before soak | latest QA run failed 9/23 simulation/campaign tests; integrated candidate is not frozen | FIX |

The long-frame threshold measures missed two-refresh windows, not tiny timer quantization above 16.7 ms. The p95 row still enforces the single-frame 60 Hz budget. A soak passes only when every row marked as a soak metric passes in the same captured run.

## Short, read-only probes

Run from the repository root:

```sh
node tests/defense-performance-browser.cjs > results/defense-performance-browser.json
node tests/defense-survivor-browser.cjs > results/defense-survivor-browser.json
```

These commands establish local responsiveness and input admission only. They do not satisfy the 30-minute gate.

## Exact 30-minute soak

Run only after the integration commit is frozen and `git status --short` is empty. Record the full SHA before launching:

```sh
export SOAK_REVISION="$(git rev-parse HEAD)"
export SOAK_MS=1800000
mkdir -p results
python3 -m http.server 4173 --bind 127.0.0.1 >"results/soak-server-${SOAK_REVISION}.log" 2>&1 &
export SOAK_SERVER_PID=$!
trap 'kill "$SOAK_SERVER_PID"' EXIT
```

In the same shell, after the server is listening, run:

```sh
node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const revision = process.env.SOAK_REVISION;
const durationMs = Number(process.env.SOAK_MS);
assert.match(revision, /^[0-9a-f]{40}$/);
assert.equal(durationMs, 1_800_000);
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-precise-memory-info"],
});
const context = await browser.newContext({
  baseURL: "http://127.0.0.1:4173",
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
await page.goto("/index.html", { waitUntil: "networkidle" });
await page.locator("#start-defense").click();
await page.locator('[data-defense-ready="true"]').waitFor();
await page.evaluate(() => {
  const sample = globalThis.__defenseSoak = {
    frames: [],
    inputs: [],
    startedAt: performance.now(),
  };
  let previous;
  const frame = (now) => {
    if (previous !== undefined) sample.frames.push(now - previous);
    previous = now;
    requestAnimationFrame(frame);
  };
  addEventListener("abyssal:defense-input-feedback", (event) => {
    sample.inputs.push(event.detail.displayedAt - event.detail.admittedAt);
  });
  requestAnimationFrame(frame);
});
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
const heaps = [];
const deadline = Date.now() + durationMs;
let nextHeapAt = 0;
while (Date.now() < deadline) {
  const growth = page.locator("#defense-growth-offer [data-pick]").first();
  const extraction = page.locator("#extract-elite");
  const reward = page.locator("[data-reward]").first();
  const result = page.locator("#result-action");
  if (await growth.isVisible().catch(() => false)) await growth.click();
  else if (await extraction.isVisible().catch(() => false)) await extraction.click();
  else if (await reward.isVisible().catch(() => false)) await reward.click();
  else if (await result.isVisible().catch(() => false)) await result.click();
  else await page.keyboard.press("ArrowRight");
  if (Date.now() >= nextHeapAt) {
    const metrics = await cdp.send("Performance.getMetrics");
    const used = metrics.metrics.find(({ name }) => name === "JSHeapUsedSize")?.value;
    heaps.push({ elapsedMs: durationMs - (deadline - Date.now()), usedBytes: used });
    nextHeapAt = Date.now() + 10_000;
  }
  await page.waitForTimeout(250);
}
const raw = await page.evaluate(() => globalThis.__defenseSoak);
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};
const median = (values) => percentile(values, 0.5);
const first = heaps.filter(({ elapsedMs }) => elapsedMs <= 300_000).map(({ usedBytes }) => usedBytes);
const last = heaps.filter(({ elapsedMs }) => elapsedMs >= durationMs - 300_000).map(({ usedBytes }) => usedBytes);
const meanX = heaps.reduce((sum, value) => sum + value.elapsedMs, 0) / heaps.length;
const meanY = heaps.reduce((sum, value) => sum + value.usedBytes, 0) / heaps.length;
const slopeBytesPerMs = heaps.reduce((sum, value) =>
  sum + (value.elapsedMs - meanX) * (value.usedBytes - meanY), 0) /
  heaps.reduce((sum, value) => sum + (value.elapsedMs - meanX) ** 2, 0);
const summary = {
  frameP95Ms: percentile(raw.frames, 0.95),
  longFrameRatio: raw.frames.filter((value) => value > 33.4).length / raw.frames.length,
  inputP95Ms: percentile(raw.inputs, 0.95),
  inputMaxMs: Math.max(...raw.inputs),
  firstHeapMedianBytes: median(first),
  lastHeapMedianBytes: median(last),
  heapSlopeMiBPerMinute: slopeBytesPerMs * 60_000 / 2 ** 20,
  errorCount: errors.length,
  durationMs,
};
const allowedHeapGrowth = Math.max(8 * 2 ** 20, summary.firstHeapMedianBytes * 0.10);
const pass = summary.frameP95Ms <= 16.7
  && summary.longFrameRatio < 0.005
  && summary.inputP95Ms <= 100
  && summary.inputMaxMs <= 100
  && summary.lastHeapMedianBytes <= summary.firstHeapMedianBytes + allowedHeapGrowth
  && summary.heapSlopeMiBPerMinute <= 0.5
  && summary.errorCount === 0;
const report = {
  schema: "abyssal-defense-soak",
  version: 1,
  revision,
  startedAt: new Date(Date.now() - durationMs).toISOString(),
  finishedAt: new Date().toISOString(),
  thresholds: {
    frameP95Ms: 16.7,
    longFrameRatio: 0.005,
    inputP95Ms: 100,
    inputMaxMs: 100,
    heapMedianGrowth: "max(8 MiB, 10%)",
    heapSlopeMiBPerMinute: 0.5,
    errorCount: 0,
  },
  summary,
  errors,
  heaps,
  pass,
};
await writeFile(`results/defense-soak-${revision}.json`, `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
assert.equal(pass, true, JSON.stringify(summary));
NODE
```

The resulting `results/defense-soak-<full-sha>.json` is acceptable only when `durationMs` is exactly `1800000`, `revision` equals the frozen candidate, `pass` is `true`, and the server log contains no unexplained request failures. This soak is deliberately **pending** while implementation lanes are active.

## Rendering and movement policy

Cull or distance-limit decorative effects before reducing command, danger, pickup, extraction, or confirmation signals. Keep simulation at deterministic 60 Hz; presentation may interpolate but must not become a second rules authority. Reduced-motion mode removes camera/effect motion without removing state labels or input feedback.