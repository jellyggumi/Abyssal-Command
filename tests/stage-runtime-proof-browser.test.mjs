import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";
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
import { stageFogRange } from "../battle-realtime-three.js";
import { stageWorldFor } from "../stage-world-catalog.js";
import * as THREE from "../vendor/three.module.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORAGE_KEY = "abyssal-command-defense";
const OUTPUT_DIR = path.join(ROOT, "_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage-runtime-proof");
const SUMMARY_FILE = path.join(OUTPUT_DIR, "stage-runtime-summary.json");
const SUMMARY_PATH = path.relative(ROOT, SUMMARY_FILE);
const FIXED_NOW = 2_000_000;

const STAGE_ART_FILE_BY_ID = Object.freeze({
  "cinder-span": "cinder-span",
  "veil-citadel": "veil-citadel",
  "echo-throne": "echo-throne-steps",
  "sunken-bastion": "sunken-bastion",
  "howling-sprawl": "howling-sprawl",
  "glass-necropolis": "glass-necropolis",
  "starless-canal": "starless-canal",
  "shattered-causeway": "shattered-causeway",
  "abyss-chancel": "abyss-chancel",
  "gate-zenith": "gate-zenith",
});

const STAGE_PALETTE_TINT_BY_ID = Object.freeze({
  "cinder-span": 0xf3592c,
  "veil-citadel": 0x2cadd6,
  "echo-throne": 0x3c2c5b,
  "sunken-bastion": 0x2cadd6,
  "howling-sprawl": 0xddc869,
  "glass-necropolis": 0x2cadd6,
  "starless-canal": 0x737990,
  "shattered-causeway": 0xf3592c,
  "abyss-chancel": 0x3c2c5b,
  "gate-zenith": 0xddc869,
});

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

function fullyUnlockedCampaign() {
  let campaign = createCampaign({ campaignId: "stage-runtime-proof", resetEpoch: 1 });
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

const INSTALL_RUNTIME_PROBE = ({ campaign, fixedNow, storageKey }) => {
  Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
  Date.now = () => fixedNow;
  localStorage.setItem(storageKey, campaign);

  const qa = { frames: 0, live: null, patchError: null, patched: false };
  window.__stageRuntimeQa = qa;
  import("/battle-realtime-three.js").then(({ RealtimeBattle }) => {
    const prototype = RealtimeBattle.prototype;
    const originalMount = prototype.mount;
    const originalRenderSnapshot = prototype.renderSnapshot;
    prototype.mount = function stageRuntimeProofMount(...args) {
      const mounted = originalMount.apply(this, args);
      qa.live = this;
      return mounted;
    };
    prototype.renderSnapshot = function stageRuntimeProofRenderSnapshot(...args) {
      qa.live = this;
      qa.frames += 1;
      return originalRenderSnapshot.apply(this, args);
    };
    qa.patched = true;
  }).catch((error) => {
    qa.patchError = error?.stack ?? String(error);
  });
};

function expectedClearColor(stageId) {
  const tint = STAGE_PALETTE_TINT_BY_ID[stageId];
  return `#${new THREE.Color(0x030712).lerp(new THREE.Color(tint), 0.22).getHexString()}`;
}

function errorText(error) {
  return error?.stack ?? error?.message ?? String(error);
}

function sortedRecords(records) {
  return [...records].sort((left, right) => left.id.localeCompare(right.id));
}

async function verifyStage(browser, baseURL, campaign, stage, index) {
  const profile = stageWorldFor(stage.id);
  const expectedArtPath = `assets/images/battle/ui/stages/${STAGE_ART_FILE_BY_ID[stage.id]}.png`;
  const expectedPropRecords = sortedRecords(profile.presentation.props.map(({ id, modelPath }) => ({ id, modelPath })));
  const expectedNpcRecords = sortedRecords(profile.presentation.npcs.map(({ id, modelPath }) => ({ id, modelPath })));
  const expectedModelPaths = [
    profile.terrainGlbPath,
    ...expectedPropRecords.map(({ modelPath }) => modelPath),
    ...expectedNpcRecords.map(({ modelPath }) => modelPath),
  ];
  const screenshotFile = path.join(OUTPUT_DIR, `${String(index + 1).padStart(2, "0")}-${stage.id}.png`);
  const screenshotPath = path.relative(ROOT, screenshotFile);
  const entry = {
    stageId: stage.id,
    pass: false,
    expected: {
      conceptBackplatePath: expectedArtPath,
      terrainGlbPath: profile.terrainGlbPath,
      propRecords: expectedPropRecords,
      npcRecords: expectedNpcRecords,
      palette: {
        authored: profile.presentation.palette,
        clearColor: expectedClearColor(stage.id),
        fogNear: stageFogRange(stage.id).near,
        fogFar: stageFogRange(stage.id).far,
      },
    },
    observed: null,
    diagnostics: { consoleErrors: [], pageErrors: [], runtimeAssetResponses: [] },
    artifactPaths: { screenshot: screenshotPath, summary: SUMMARY_PATH },
  };

  const context = await browser.newContext({
    baseURL,
    serviceWorkers: "block",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const assetResponses = [];
  page.on("pageerror", (error) => entry.diagnostics.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") entry.diagnostics.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    const pathname = decodeURIComponent(new URL(response.url()).pathname).replace(/^\//, "");
    if (pathname.endsWith(".glb") || pathname.endsWith(".png")) {
      assetResponses.push({ path: pathname, status: response.status() });
    }
  });

  let screenshotWritten = false;
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.addInitScript(INSTALL_RUNTIME_PROBE, { campaign, fixedNow: FIXED_NOW, storageKey: STORAGE_KEY });
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    await page.waitForFunction(() => window.__stageRuntimeQa?.patched || window.__stageRuntimeQa?.patchError, null, { timeout: 15000 });
    const probeState = await page.evaluate(() => ({
      patchError: window.__stageRuntimeQa?.patchError ?? null,
      patched: window.__stageRuntimeQa?.patched === true,
    }));
    assert.equal(probeState.patchError, null, `${stage.id} runtime probe import must succeed`);
    assert.equal(probeState.patched, true, `${stage.id} runtime renderer must be observable before launch`);

    await page.locator("[data-stage-progress]").selectOption(stage.id);
    await page.locator(`#defense-app[data-stage-id="${stage.id}"]`).waitFor();
    const lobbySelection = await page.evaluate(() => ({
      appStageId: document.querySelector("#defense-app")?.dataset.stageId ?? null,
      selectStageId: document.querySelector("[data-stage-progress]")?.value ?? null,
    }));
    assert.equal(lobbySelection.appStageId, stage.id, `${stage.id} UI selection must update the app stage`);
    assert.equal(lobbySelection.selectStageId, stage.id, `${stage.id} UI selection must remain selected in the canonical control`);

    await page.locator("#start-defense").click();
    const surface = page.locator('[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    assert.equal(await surface.getAttribute("data-stage-id"), stage.id, `${stage.id} launch must preserve the UI-selected stage`);
    await page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseRenderer === "webgl", null, { timeout: 15000 });

    const cutscene = page.locator("#defense-cutscene-overlay");
    await cutscene.waitFor({ state: "visible", timeout: 15000 });
    await cutscene.locator("[data-cutscene-dismiss]").click();
    await cutscene.waitFor({ state: "hidden", timeout: 15000 });
    assert.equal(await surface.getAttribute("data-defense-cutscene"), null, `${stage.id} opening cinematic dismissal must clear presentation state`);

    await page.waitForFunction(({ expectedNpcCount, expectedPropCount, stageId }) => {
      const live = window.__stageRuntimeQa?.live;
      const decor = live?.debugPresentationState?.().stageDecor;
      return window.__stageRuntimeQa?.frames > 0
        && live?.loadedStageId === stageId
        && live?.stageTerrainRecord?.modelPath
        && decor?.stageId === stageId
        && decor.loading === false
        && decor.terrainLoaded === true
        && decor.propCount === expectedPropCount
        && decor.npcCount === expectedNpcCount
        && decor.records.length === expectedPropCount + expectedNpcCount;
    }, {
      expectedNpcCount: profile.presentation.npcs.length,
      expectedPropCount: profile.presentation.props.length,
      stageId: stage.id,
    }, { timeout: 45000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const observed = await page.evaluate(({ selectedStageId }) => {
      const qa = window.__stageRuntimeQa;
      const live = qa.live;
      const stageArt = document.querySelector(".battle-stage-art");
      const surfaceNode = document.querySelector("#defense-battle-surface");
      const decor = live.debugPresentationState().stageDecor;
      const colorTarget = live.scene.fog.color.clone();
      const palette = {
        stagePaletteId: live.stagePaletteId,
        fogColor: `#${live.scene.fog.color.getHexString()}`,
        fogNear: live.scene.fog.near,
        fogFar: live.scene.fog.far,
        clearColor: `#${live.renderer.getClearColor(colorTarget).getHexString()}`,
        clearAlpha: live.renderer.getClearAlpha(),
      };
      return {
        selectedStageId,
        surfaceStageId: surfaceNode?.dataset.stageId ?? null,
        loadedStageId: live.loadedStageId,
        renderer: surfaceNode?.dataset.defenseRenderer ?? null,
        renderedFrames: qa.frames,
        conceptBackplateCssUrl: getComputedStyle(stageArt).backgroundImage,
        conceptBackplateCustomProperty: getComputedStyle(surfaceNode).getPropertyValue("--stage-art").trim(),
        terrainLoaded: decor.terrainLoaded,
        terrainGlbPath: live.stageTerrainRecord?.modelPath ?? null,
        palette,
        propRecords: decor.records
          .filter(({ kind }) => kind === "prop")
          .map(({ id, modelPath }) => ({ id, modelPath })),
        npcRecords: decor.records
          .filter(({ kind }) => kind === "stage-npc")
          .map(({ id, modelPath }) => ({ id, modelPath })),
      };
    }, { selectedStageId: lobbySelection.appStageId });
    observed.propRecords = sortedRecords(observed.propRecords);
    observed.npcRecords = sortedRecords(observed.npcRecords);
    entry.observed = observed;

    assert.equal(observed.renderer, "webgl", `${stage.id} must remain on the real WebGL renderer`);
    assert.equal(observed.selectedStageId, stage.id, `${stage.id} proof must identify the UI-selected stage`);
    assert.equal(observed.surfaceStageId, stage.id, `${stage.id} battle surface must identify the selected stage`);
    assert.equal(observed.loadedStageId, observed.selectedStageId, `${stage.id} selected stage must match loadedStageId`);
    assert.equal(observed.terrainLoaded, true, `${stage.id} terrain must finish loading`);
    assert.equal(observed.terrainGlbPath, profile.terrainGlbPath, `${stage.id} must load its authored terrain GLB`);
    assert.ok(observed.conceptBackplateCssUrl.includes(expectedArtPath), `${stage.id} computed backplate CSS must contain ${expectedArtPath}`);
    assert.ok(observed.conceptBackplateCustomProperty.includes(expectedArtPath), `${stage.id} battle surface must retain its authored backplate URL`);
    assert.deepEqual(observed.propRecords, expectedPropRecords, `${stage.id} must publish every authored prop runtime record/model path`);
    assert.deepEqual(observed.npcRecords, expectedNpcRecords, `${stage.id} must publish every authored NPC runtime record/model path`);
    assert.equal(observed.palette.stagePaletteId, stage.id, `${stage.id} must apply its stage-specific palette`);
    assert.equal(observed.palette.clearColor, expectedClearColor(stage.id), `${stage.id} WebGL clear color must use its authored palette tint`);
    assert.equal(observed.palette.fogColor, expectedClearColor(stage.id), `${stage.id} fog color must use its authored palette tint`);
    assert.equal(observed.palette.clearAlpha, 0, `${stage.id} palette must preserve the concept backplate through transparent WebGL`);
    assert.equal(observed.palette.fogNear, stageFogRange(stage.id).near, `${stage.id} must apply its stage-specific near fog range`);
    assert.equal(observed.palette.fogFar, stageFogRange(stage.id).far, `${stage.id} must apply its stage-specific far fog range`);

    const successfulResponses = new Set(assetResponses.filter(({ status }) => status === 200).map(({ path: assetPath }) => assetPath));
    for (const modelPath of expectedModelPaths) {
      assert.ok(successfulResponses.has(modelPath), `${stage.id} browser must fetch ${modelPath} successfully`);
    }
    assert.ok(successfulResponses.has(expectedArtPath), `${stage.id} browser must fetch ${expectedArtPath} successfully`);

    await page.screenshot({ path: screenshotFile, animations: "allow" });
    screenshotWritten = true;
    entry.pass = true;
  } catch (error) {
    entry.error = errorText(error);
    if (!screenshotWritten) {
      try {
        await page.screenshot({ path: screenshotFile, animations: "allow" });
        screenshotWritten = true;
      } catch (screenshotError) {
        entry.screenshotError = errorText(screenshotError);
      }
    }
  } finally {
    entry.diagnostics.runtimeAssetResponses = [...new Map(
      assetResponses.map((response) => [`${response.path}:${response.status}`, response]),
    ).values()].sort((left, right) => left.path.localeCompare(right.path));
    entry.artifactPaths.screenshotWritten = screenshotWritten;
    await context.close();
  }
  return entry;
}

test("all ten canonical stages load their authored runtime world in isolated real-WebGL sessions", { timeout: 360000 }, async () => {
  assert.equal(CAMPAIGN_STAGES.length, 10, "the browser proof must cover exactly ten canonical stages");
  assert.deepEqual(Object.keys(STAGE_ART_FILE_BY_ID), CAMPAIGN_STAGES.map(({ id }) => id), "the proof must name the authored backplate for every canonical stage in order");
  assert.deepEqual(Object.keys(STAGE_PALETTE_TINT_BY_ID), CAMPAIGN_STAGES.map(({ id }) => id), "the proof must name the authored palette tint for every canonical stage in order");

  await mkdir(OUTPUT_DIR, { recursive: true });
  const hosting = await startServer();
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
  });
  const campaign = fullyUnlockedCampaign();
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    canonicalStageIds: CAMPAIGN_STAGES.map(({ id }) => id),
    isolation: "fresh BrowserContext per stage; service workers blocked; Chromium cache disabled",
    summaryArtifactPath: SUMMARY_PATH,
    stages: [],
  };

  try {
    for (const [index, stage] of CAMPAIGN_STAGES.entries()) {
      summary.stages.push(await verifyStage(browser, hosting.url, campaign, stage, index));
    }
  } finally {
    summary.pass = summary.stages.length === CAMPAIGN_STAGES.length && summary.stages.every(({ pass }) => pass);
    summary.finishedAt = new Date().toISOString();
    await writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`);
    await browser.close();
    await new Promise((resolve) => hosting.server.close(resolve));
  }

  assert.equal(summary.stages.length, CAMPAIGN_STAGES.length, "the summary must contain one isolated browser result per canonical stage");
  assert.deepEqual(summary.stages.map(({ stageId }) => stageId), CAMPAIGN_STAGES.map(({ id }) => id), "the summary must preserve every canonical stage ID");
  assert.equal(
    summary.pass,
    true,
    `stage runtime proof failures:\n${summary.stages.filter(({ pass }) => !pass).map(({ stageId, error }) => `${stageId}: ${error}`).join("\n")}`,
  );
});
