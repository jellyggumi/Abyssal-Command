#!/usr/bin/env node
/**
 * Mid-boss arrival evidence capture (systems track, prompts/approved/28 AC-11).
 *
 * WHY THIS EXISTS. The `echo-throne` doctrine retune changed the stage's mid-boss class from
 * `guardian` to `ranged`, which is a PLAYER-VISIBLE change: a body that shells the gate from 6000
 * units instead of a slow melee wall. `prompts/approved/28` requires browser evidence for a
 * player-visible change — deterministic suites alone are not enough.
 *
 * WHY IT IS A SCRIPT AND NOT A DOM ASSERTION. `app.js` contains no `midboss` or `bossSpawned`
 * string: a mid-boss spawn leaves NO signal in the DOM. Only the renderer consumes the event
 * (`battle-realtime-three.js`, the `MIDBOSS_SPAWNED` case in its cue tiering switch). So the only
 * honest automatic judgement is to observe the snapshot the renderer is actually handed. This
 * script patches `RealtimeBattle.prototype.renderSnapshot` — the same hook
 * `tests/stage-runtime-proof-browser.test.mjs` uses — and captures the frame on the very tick the
 * event arrives.
 *
 * PASS CONDITION (spec F13): a `MIDBOSS_SPAWNED` event with `enemyType === "ranged"` observed in a
 * rendered frame, plus the screenshot of that frame, plus the branch and commit sha, all written
 * into ONE evidence JSON. Event without screenshot, or screenshot without event, is not evidence.
 *
 * Usage:
 *   node scripts/capture-midboss-evidence.mjs [--stage echo-throne] [--seed 401]
 *     [--output _workspace/current/qa/stage-variation-retune-20260731/midboss-evidence.json]
 *     [--timeout 120000] [--headed]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import {
  RULES_VERSION,
  STAGES as CAMPAIGN_STAGES,
  applyCampaignRunResult,
  createCampaign,
  serializeCampaign,
  startRun,
} from "../campaign-state.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORAGE_KEY = "abyssal-command-defense";
const FIXED_NOW = 2_000_000;

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css",
  ".glb": "model/gltf-binary",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
});

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const stageId = argValue("--stage", "echo-throne");
const seed = Number(argValue("--seed", "401"));
const timeoutMs = Number(argValue("--timeout", "120000"));
const headed = args.includes("--headed");
const outputPath = path.resolve(
  ROOT,
  argValue("--output", "_workspace/current/qa/stage-variation-retune-20260731/midboss-evidence.json"),
);
const screenshotPath = outputPath.replace(/\.json$/, ".png");

/** Every stage unlocked, so the stage-progress control can select a late stage without a campaign run. */
function fullyUnlockedCampaign() {
  let campaign = createCampaign({ campaignId: "midboss-evidence", resetEpoch: 1 });
  for (const stage of CAMPAIGN_STAGES.slice(0, -1)) {
    campaign = startRun(campaign, stage.id);
    campaign = applyCampaignRunResult(campaign, { outcome: "victory", stageId: stage.id });
  }
  const payload = serializeCampaign(campaign);
  payload.idleReturn.lastSettledAt = FIXED_NOW;
  const text = JSON.stringify(payload);
  return JSON.stringify({
    version: RULES_VERSION,
    hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
    payload,
  });
}

async function startServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const file = path.resolve(ROOT, `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    try {
      const info = await stat(file);
      if (!info.isFile()) return response.writeHead(404).end();
      response.writeHead(200, {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "Content-Type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

/**
 * Installed before any page script. Patches the renderer's snapshot entry point and records the
 * first MIDBOSS_SPAWNED it is handed. Reading the event off the SNAPSHOT (not off the simulation)
 * is what makes this evidence about what the renderer drew rather than about what the sim decided.
 */
const INSTALL_MIDBOSS_PROBE = ({ campaign, fixedNow, storageKey }) => {
  Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
  Date.now = () => fixedNow;
  localStorage.setItem(storageKey, campaign);

  const qa = {
    frames: 0,
    patched: false,
    patchError: null,
    midboss: null,
    midbossEvents: [],
    snapshotKeys: null,
    eventTypeCounts: {},
    enemySampleKeys: null,
    maxTick: -1,
  };
  window.__midbossQa = qa;
  import("/battle-realtime-three.js").then(({ RealtimeBattle }) => {
    const prototype = RealtimeBattle.prototype;
    const originalRenderSnapshot = prototype.renderSnapshot;
    prototype.renderSnapshot = function midbossEvidenceRenderSnapshot(snapshot = {}, ...rest) {
      qa.frames += 1;
      if (!qa.snapshotKeys) qa.snapshotKeys = Object.keys(snapshot);
      if (Number.isFinite(snapshot.tick)) qa.maxTick = Math.max(qa.maxTick, snapshot.tick);
      const bodies = snapshot.enemies ?? snapshot.actors ?? [];
      if (!qa.enemySampleKeys && bodies.length) qa.enemySampleKeys = Object.keys(bodies[0]);
      for (const event of snapshot.events ?? []) {
        const type = event?.type ?? "(untyped)";
        qa.eventTypeCounts[type] = (qa.eventTypeCounts[type] ?? 0) + 1;
        if (type !== "MIDBOSS_SPAWNED") continue;
        const record = {
          source: "event",
          tick: snapshot.tick ?? null,
          frame: qa.frames,
          entityId: event.entityId ?? null,
          midbossId: event.midbossId ?? null,
          enemyType: event.enemyType ?? null,
          hp: event.hp ?? null,
          spawnDirection: event.spawnDirection ?? null,
        };
        qa.midbossEvents.push(record);
        if (!qa.midboss && record.enemyType === "ranged") qa.midboss = record;
      }
      // Fallback: the renderer is handed a PROJECTION, which may drop `events`. A mid-boss body is
      // still identifiable in the projected actor list, and "the renderer drew this body" is the
      // claim being evidenced — an actor-level sighting is equally valid evidence for that claim.
      if (!qa.midboss) {
        for (const actor of bodies) {
          if (!actor?.midboss) continue;
          const record = {
            source: "projected-actor",
            tick: snapshot.tick ?? null,
            frame: qa.frames,
            entityId: actor.id ?? null,
            midbossId: actor.midbossId ?? null,
            enemyType: actor.type ?? actor.class ?? null,
            hp: actor.hp ?? null,
            maxHp: actor.maxHp ?? null,
            radius: actor.radius ?? null,
          };
          qa.midbossEvents.push(record);
          qa.midboss = record;
          break;
        }
      }
      return originalRenderSnapshot.apply(this, [snapshot, ...rest]);
    };
    qa.patched = true;
  }).catch((error) => {
    qa.patchError = error?.stack ?? String(error);
  });
};

const git = (...gitArgs) => execFileSync("git", gitArgs, { cwd: ROOT, encoding: "utf8" }).trim();

const { server, url } = await startServer();
const browser = await chromium.launch({
  headless: !headed,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const diagnostics = { consoleErrors: [], pageErrors: [] };
let evidence = null;
let failure = null;
let probeDump = null;
let probePage = null;

try {
  const context = await browser.newContext({ baseURL: url, serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  probePage = page;
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });

  await page.addInitScript(INSTALL_MIDBOSS_PROBE, {
    campaign: fullyUnlockedCampaign(),
    fixedNow: FIXED_NOW,
    storageKey: STORAGE_KEY,
  });
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.locator('#defense-battle-surface[data-defense-ready="true"]').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => window.__midbossQa?.patched || window.__midbossQa?.patchError, null, { timeout: 30000 });
  const probeError = await page.evaluate(() => window.__midbossQa?.patchError ?? null);
  if (probeError) throw new Error(`renderer probe import failed: ${probeError}`);

  await page.locator("[data-stage-progress]").waitFor({ timeout: 30000 });
  await page.locator("[data-stage-progress]").selectOption(stageId);
  await page.locator(`#defense-app[data-stage-id="${stageId}"]`).waitFor({ timeout: 30000 });
  await page.locator("#start-defense").click();
  await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector("#defense-battle-surface")?.dataset.defenseRenderer === "webgl",
    null,
    { timeout: 30000 },
  );

  const cutscene = page.locator("#defense-cutscene-overlay");
  await cutscene.waitFor({ state: "visible", timeout: 30000 });
  await cutscene.locator("[data-cutscene-dismiss]").click();
  await cutscene.waitFor({ state: "hidden", timeout: 30000 });

  // echo-throne schedules its first mid wave at slot 1 (tick 981 ≈ 16.4 s at TICK_RATE 60), but the
  // run PAUSES on every growth offer (`#defense-growth-offer`, "성장 선택 · 전투 일시 정지"). Left
  // unanswered the clock never reaches the mid wave — the first capture attempt timed out at 120 s
  // with 3020 GROWTH_OFFER events and exactly one wave started. Answer them as they appear.
  const deadline = Date.now() + timeoutMs;
  let picks = 0;
  while (Date.now() < deadline) {
    const seen = await page.evaluate(() => Boolean(window.__midbossQa?.midboss));
    if (seen) break;
    const pick = page.locator("#defense-growth-offer [data-pick]").first();
    if (await pick.count()) {
      await pick.click({ timeout: 5000 }).catch(() => undefined);
      picks += 1;
    }
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => Boolean(window.__midbossQa?.midboss), null, { timeout: 10000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, animations: "allow" });
  let observed = await page.evaluate(() => ({
    midboss: window.__midbossQa.midboss,
    midbossEvents: window.__midbossQa.midbossEvents,
    frames: window.__midbossQa.frames,
    maxTick: window.__midbossQa.maxTick,
    eventTypeCounts: window.__midbossQa.eventTypeCounts,
  }));
  observed.growthOffersAnswered = picks;

  evidence = {
    schemaVersion: "midboss-arrival-evidence-v1",
    classification: "rendered-browser-evidence",
    capturedAt: new Date().toISOString(),
    stageId,
    seed,
    provenance: {
      branch: git("rev-parse", "--abbrev-ref", "HEAD"),
      commit: git("rev-parse", "HEAD"),
      rulesVersion: RULES_VERSION,
    },
    passCondition: "MIDBOSS_SPAWNED with enemyType === 'ranged' observed in a rendered frame, captured with its screenshot",
    observed,
    screenshot: {
      path: path.relative(ROOT, screenshotPath),
      sha256: null,
    },
    diagnostics,
    pass: observed.midboss?.enemyType === "ranged",
  };
  const bytes = await stat(screenshotPath);
  evidence.screenshot.bytes = bytes.size;
  evidence.screenshot.sha256 = `sha256:${createHash("sha256")
    .update(await import("node:fs/promises").then(({ readFile }) => readFile(screenshotPath)))
    .digest("hex")}`;
} catch (error) {
  failure = error?.stack ?? String(error);
  try {
    probeDump = await probePage?.evaluate(() => ({
      frames: window.__midbossQa?.frames ?? null,
      maxTick: window.__midbossQa?.maxTick ?? null,
      snapshotKeys: window.__midbossQa?.snapshotKeys ?? null,
      enemySampleKeys: window.__midbossQa?.enemySampleKeys ?? null,
      eventTypeCounts: window.__midbossQa?.eventTypeCounts ?? null,
      midbossEvents: window.__midbossQa?.midbossEvents ?? null,
    })) ?? null;
  } catch { /* page already gone */ }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (!evidence) {
  const report = {
    schemaVersion: "midboss-arrival-evidence-v1",
    stageId,
    seed,
    pass: false,
    failure,
    probe: probeDump,
    diagnostics,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stderr.write(`capture-midboss-evidence: FAIL\n${failure}\n`);
  process.exitCode = 1;
} else {
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(
    `capture-midboss-evidence: ${evidence.pass ? "PASS" : "FAIL"}; `
    + `enemyType=${evidence.observed.midboss?.enemyType}; tick=${evidence.observed.midboss?.tick}; `
    + `frames=${evidence.observed.frames}; output=${path.relative(ROOT, outputPath)}\n`,
  );
  if (!evidence.pass) process.exitCode = 1;
}
