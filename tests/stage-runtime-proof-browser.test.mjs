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
import { MOTION_MODELS, stageFogRange } from "../battle-realtime-three.js";
import { stageWorldFor } from "../stage-world-catalog.js";
import * as THREE from "../vendor/three.module.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORAGE_KEY = "abyssal-command-defense";
const OUTPUT_DIR = path.join(ROOT, "_workspace/current/qa/stage-runtime-proof");
const SUMMARY_FILE = path.join(OUTPUT_DIR, "stage-runtime-summary.json");
const SUMMARY_PATH = path.relative(ROOT, SUMMARY_FILE);
const FIXED_NOW = 2_000_000;

const STAGE_PALETTE_TINT_BY_ID = Object.freeze({
  "cinder-span": 0xf3592c,
  "abyss-chancel": 0x8f67ff,
  "echo-throne": 0x72c8ff,
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
    if (pathname === "/__stage-runtime-fixture.html") {
      response.writeHead(200, {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "text/html; charset=utf-8",
      });
      return response.end("<!doctype html><html><body></body></html>");
    }
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

function assertMeshIntegrity(report, label) {
  assert.ok(report && typeof report === "object", `${label}: missing mesh integrity report`);
  for (const key of ["meshCount", "vertexCount", "triangleCount"]) {
    assert.ok(Number.isFinite(report[key]) && report[key] > 0, `${label}: ${key} must be finite and nonzero`);
  }
  assert.equal(report.invalidVertexCount, 0, `${label}: mesh vertices must all be finite`);
  assert.equal(report.invalidIndexCount, 0, `${label}: mesh indices must all be valid`);
  assert.equal(report.finiteBounds, true, `${label}: rendered bounds must be finite`);
}

async function settleStageNpcAnimations(page, stageId, expectedNpcCount) {
  const deadline = Date.now() + 45_000;
  let sawShow = false;
  for (;;) {
    const timeout = deadline - Date.now();
    assert.ok(timeout > 0, `${stageId} stage NPCs must settle on idle before the proof deadline`);
    const state = await (await page.waitForFunction(({ expectedNpcCount: npcCount, stageId: expectedStageId, showAlreadySeen }) => {
      const live = window.__stageRuntimeQa?.live;
      const decor = live?.debugPresentationState?.().stageDecor;
      const npcRecords = decor?.records.filter(({ kind }) => kind === "stage-npc") ?? [];
      if (
        live?.loadedStageId !== expectedStageId
        || decor?.loading !== false
        || decor.npcCount !== npcCount
        || npcRecords.length !== npcCount
      ) return null;
      const allIdle = npcRecords.every(({ hasMixer, actionCount, activeActionKey }) => (
        hasMixer && actionCount >= 1 && activeActionKey === "idle"
      ));
      if (!showAlreadySeen && npcRecords.every(({ activeActionKey }) => activeActionKey === "show")) return "show";
      if (allIdle) return "idle";
      const offer = document.querySelector("#defense-growth-offer");
      const offerStyle = offer ? getComputedStyle(offer) : null;
      const choice = [...offer?.querySelectorAll("[data-pick]") ?? []].find((button) => (
        !button.disabled
        && button.getAttribute("aria-disabled") !== "true"
        && offerStyle?.display !== "none"
        && offerStyle?.visibility !== "hidden"
      ));
      return choice ? "growth-offer" : null;
    }, { expectedNpcCount, stageId, showAlreadySeen: sawShow }, { timeout })).jsonValue();
    if (state === "show") {
      sawShow = true;
      continue;
    }
    if (state === "idle") {
      assert.equal(sawShow, true, `${stageId} stage NPCs must enter show before returning to idle`);
      return;
    }
    const selected = await page.locator("#defense-growth-offer [data-pick]").evaluateAll((choices) => {
      const choice = choices.find((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true");
      if (!choice) return false;
      choice.click();
      return true;
    });
    assert.equal(selected, true, `${stageId} must select each available growth offer while stage NPC animation settles`);
  }
}

async function verifyStage(browser, baseURL, campaign, stage, index) {
  const profile = stageWorldFor(stage.id);
  const expectedPropRecords = sortedRecords(profile.presentation.props.map(({ id, modelPath }) => ({ id, modelPath })));
  const expectedNpcRecords = sortedRecords(profile.presentation.npcs.map(({ id, actorId, modelPath }) => ({ id, actorId, modelPath })));
  const expectedVfxRecords = sortedRecords(profile.presentation.vfxCues.map(({ id, modelPath, effectId }) => ({ id, modelPath, effectId })));
  const expectedModelPaths = [
    profile.terrainGlbPath,
    ...expectedPropRecords.map(({ modelPath }) => modelPath),
    ...expectedNpcRecords.map(({ actorId }) => MOTION_MODELS[actorId]),
    ...expectedVfxRecords.map(({ modelPath }) => modelPath),
  ].filter(Boolean);
  const screenshotFile = path.join(OUTPUT_DIR, `${String(index + 1).padStart(2, "0")}-${stage.id}.png`);
  const screenshotPath = path.relative(ROOT, screenshotFile);
  const entry = {
    stageId: stage.id,
    pass: false,
    expected: {
      terrainGlbPath: profile.terrainGlbPath,
      terrainSourceCandidatePath: profile.terrainSourceCandidatePath ?? profile.terrainGlbPath,
      terrainSource: profile.terrainRuntimeEligible ? "promoted-glb" : "procedural-flat-support",
      propRecords: expectedPropRecords,
      npcRecords: expectedNpcRecords,
      vfxRecords: expectedVfxRecords,
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
    if (pathname.endsWith(".glb") || pathname.endsWith(".obj") || pathname.endsWith(".png")) {
      assetResponses.push({ path: pathname, status: response.status() });
    }
  });

  let screenshotWritten = false;
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.addInitScript(INSTALL_RUNTIME_PROBE, { campaign, fixedNow: FIXED_NOW, storageKey: STORAGE_KEY });
    await page.goto("/campaign.html", { waitUntil: "domcontentloaded" });
    // The persistent command decks mount the battle surface AND every deck section from
    // first paint (20260729-ui-dock-removal): the stage progression control lives in the
    // right-hand 전황 시트 deck, which has no open/close state, so it is reachable with
    // zero interaction. Waiting on the surface is enough.
    await page.locator('#defense-battle-surface[data-defense-ready="true"]').waitFor();
    await page.waitForFunction(() => window.__stageRuntimeQa?.patched || window.__stageRuntimeQa?.patchError, null, { timeout: 15000 });
    const probeState = await page.evaluate(() => ({
      patchError: window.__stageRuntimeQa?.patchError ?? null,
      patched: window.__stageRuntimeQa?.patched === true,
    }));
    assert.equal(probeState.patchError, null, `${stage.id} runtime probe import must succeed`);
    assert.equal(probeState.patched, true, `${stage.id} runtime renderer must be observable before launch`);

    // No reveal step: the persistent deck mounts [data-stage-progress] at load. Asserting
    // presence without a click is what defends the zero-interaction deck contract -- a
    // conditional reveal here would silently pass again if the deck regressed to slide-open.
    await page.locator("[data-stage-progress]").waitFor();
    assert.equal(
      await page.locator("[data-stage-progress]").count(),
      1,
      "the persistent 전황 시트 deck must mount the stage progression control with zero interaction",
    );
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

    await page.waitForFunction(({ expectedNpcCount, expectedPropCount, expectedTerrainSource, expectedVfxCount, stageId }) => {
      const live = window.__stageRuntimeQa?.live;
      const decor = live?.debugPresentationState?.().stageDecor;
      const npcRecords = decor?.records.filter(({ kind }) => kind === "stage-npc") ?? [];
      return window.__stageRuntimeQa?.frames > 0
        && live?.loadedStageId === stageId
        && live?.stageTerrainRecord
        && decor?.stageId === stageId
        && decor.loading === false
        && decor.terrainLoaded === true
        && decor.terrainSource === expectedTerrainSource
        && decor.propCount === expectedPropCount
        && decor.npcCount === expectedNpcCount
        && decor.vfxCount === expectedVfxCount
        && decor.records.length === expectedPropCount + expectedNpcCount + expectedVfxCount;
    }, {
      expectedNpcCount: profile.presentation.npcs.length,
      expectedPropCount: profile.presentation.props.length,
      expectedTerrainSource: profile.terrainRuntimeEligible ? "promoted-glb" : "procedural-flat-support",
      expectedVfxCount: profile.presentation.vfxCues.length,
      stageId: stage.id,
    }, { timeout: 45000 });
    await settleStageNpcAnimations(page, stage.id, profile.presentation.npcs.length);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const observed = await page.evaluate(({ selectedStageId }) => {
      const qa = window.__stageRuntimeQa;
      const live = qa.live;
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
        terrainLoaded: decor.terrainLoaded,
        terrainGlbPath: live.stageTerrainRecord?.modelPath ?? null,
        terrainSource: decor.terrainSource,
        terrainSourceCandidatePath: decor.terrainSourceCandidatePath,
        terrainIntegrity: decor.terrainIntegrity,
        propGrounding: decor.records
          .filter(({ kind }) => kind === "prop")
          .map(({ id, groundedMinY, meshIntegrity }) => ({ id, groundedMinY, meshIntegrity })),
        palette,
        propRecords: decor.records
          .filter(({ kind }) => kind === "prop")
          .map(({ id, modelPath }) => ({ id, modelPath })),
        npcRecords: decor.records
          .filter(({ kind }) => kind === "stage-npc")
          .map(({ id, modelPath, sourceModelPath, hasMixer, actionCount, activeActionKey }) => ({
            id,
            modelPath,
            sourceModelPath,
            hasMixer,
            actionCount,
            activeActionKey,
          })),
        vfxRecords: decor.records
          .filter(({ kind }) => kind === "stage-vfx")
          .map(({ id, modelPath, effectId }) => ({ id, modelPath, effectId })),
      };
    }, { selectedStageId: lobbySelection.appStageId });
    observed.propRecords = sortedRecords(observed.propRecords);
    observed.npcRecords = sortedRecords(observed.npcRecords);
    observed.vfxRecords = sortedRecords(observed.vfxRecords);
    entry.observed = observed;

    assert.equal(observed.renderer, "webgl", `${stage.id} must remain on the real WebGL renderer`);
    assert.equal(observed.selectedStageId, stage.id, `${stage.id} proof must identify the UI-selected stage`);
    assert.equal(observed.surfaceStageId, stage.id, `${stage.id} battle surface must identify the selected stage`);
    assert.equal(observed.loadedStageId, observed.selectedStageId, `${stage.id} selected stage must match loadedStageId`);
    assert.equal(observed.terrainLoaded, true, `${stage.id} terrain must finish loading`);
    assert.equal(observed.terrainGlbPath, profile.terrainGlbPath, `${stage.id} must load its authored terrain GLB`);
    assert.equal(
      observed.terrainSource,
      profile.terrainRuntimeEligible ? "promoted-glb" : "procedural-flat-support",
      `${stage.id} must expose the selected runtime terrain strategy`,
    );
    assert.equal(
      observed.terrainSourceCandidatePath,
      profile.terrainSourceCandidatePath ?? profile.terrainGlbPath,
      `${stage.id} must preserve the source path used for promotion or rejection`,
    );
    assertMeshIntegrity(observed.terrainIntegrity, `${stage.id} terrain`);
    for (const prop of observed.propGrounding) {
      assert.ok(Math.abs(prop.groundedMinY) <= 1e-4, `${stage.id} ${prop.id} must rest on the support plane, got minY ${prop.groundedMinY}`);
      assertMeshIntegrity(prop.meshIntegrity, `${stage.id} ${prop.id}`);
    }
    assert.deepEqual(observed.vfxRecords, expectedVfxRecords, `${stage.id} must publish every authored stage VFX record/model path`);
    assert.deepEqual(observed.propRecords, expectedPropRecords, `${stage.id} must publish every authored prop runtime record/model path`);
    assert.deepEqual(
      observed.npcRecords.map(({ id }) => id),
      expectedNpcRecords.map(({ id }) => id),
      `${stage.id} must publish every authored stage NPC runtime record`,
    );
    for (const expectedNpcRecord of expectedNpcRecords) {
      const runtimeNpcRecord = observed.npcRecords.find(({ id }) => id === expectedNpcRecord.id);
      const expectedMotionModel = MOTION_MODELS[expectedNpcRecord.actorId];
      assert.ok(
        expectedMotionModel,
        `${stage.id} ${expectedNpcRecord.id} actor ${expectedNpcRecord.actorId} must resolve through the exported motion-model mapping`,
      );
      assert.equal(
        runtimeNpcRecord?.modelPath,
        expectedMotionModel,
        `${stage.id} ${expectedNpcRecord.id} must resolve to the mapped animated runtime NPC model`,
      );
      assert.equal(
        runtimeNpcRecord?.sourceModelPath,
        expectedNpcRecord.modelPath,
        `${stage.id} ${expectedNpcRecord.id} must retain its authored catalog NPC model as fallback provenance`,
      );
      assert.equal(runtimeNpcRecord?.hasMixer, true, `${stage.id} ${expectedNpcRecord.id} must retain a live animation mixer`);
      assert.ok(
        Number.isInteger(runtimeNpcRecord?.actionCount) && runtimeNpcRecord.actionCount >= 1,
        `${stage.id} ${expectedNpcRecord.id} must expose at least one usable animation action`,
      );
      assert.equal(runtimeNpcRecord?.activeActionKey, "idle", `${stage.id} ${expectedNpcRecord.id} must be playing idle`);
    }
    assert.equal(observed.palette.stagePaletteId, stage.id, `${stage.id} must apply its stage-specific palette`);
    assert.equal(observed.palette.clearColor, expectedClearColor(stage.id), `${stage.id} WebGL clear color must use its authored palette tint`);
    assert.equal(observed.palette.fogColor, expectedClearColor(stage.id), `${stage.id} fog color must use its authored palette tint`);
    assert.equal(observed.palette.clearAlpha, 0, `${stage.id} transparent WebGL output must not imply a retired image backplate`);
    assert.equal(observed.palette.fogNear, stageFogRange(stage.id).near, `${stage.id} must apply its stage-specific near fog range`);
    assert.equal(observed.palette.fogFar, stageFogRange(stage.id).far, `${stage.id} must apply its stage-specific far fog range`);

    const successfulResponses = new Set(assetResponses.filter(({ status }) => status === 200).map(({ path: assetPath }) => assetPath));
    for (const modelPath of expectedModelPaths) {
      assert.ok(successfulResponses.has(modelPath), `${stage.id} browser must fetch ${modelPath} successfully`);
    }
    if (!profile.terrainRuntimeEligible) {
      assert.equal(
        successfulResponses.has(profile.terrainSourceCandidatePath),
        false,
        `${stage.id} must not request its ineligible terrain candidate`,
      );
    }
    assert.equal(
      [...successfulResponses].some((assetPath) => assetPath.startsWith("assets/images/battle/stages/")),
      false,
      `${stage.id} runtime must not fetch a retired stage image backplate`,
    );

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

test("all three canonical stages load their authored runtime world in isolated real-WebGL sessions", { timeout: 180000 }, async () => {
  assert.deepEqual(CAMPAIGN_STAGES.map(({ id }) => id), ["cinder-span", "abyss-chancel", "echo-throne"], "the browser proof must cover the three canonical stages");
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

test("disposing after a transient terrain failure lets the same stage retry on remount", { timeout: 60000 }, async () => {
  const hosting = await startServer();
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    baseURL: hosting.url,
    serviceWorkers: "block",
    viewport: { width: 800, height: 450 },
  });
  const page = await context.newPage();
  const stageId = "cinder-span";
  const transientError = "transient terrain fixture failure";

  try {
    await page.goto("/__stage-runtime-fixture.html", { waitUntil: "domcontentloaded" });
    const lifecycle = await page.evaluate(async ({ stageId: selectedStageId, transientError: failureMessage }) => {
      const { RealtimeBattle } = await import("/battle-realtime-three.js");
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 450;
      document.body.append(canvas);

      const adapter = new RealtimeBattle({ reducedMotion: true });
      adapter.mount({ canvas, viewport: { width: 800, height: 450 } });
      adapter.stageTerrainFailedId = selectedStageId;
      adapter.stageTerrainError = failureMessage;
      adapter.ensureStageTerrain(selectedStageId);
      const failed = adapter.debugPresentationState().stageDecor;

      adapter.dispose();
      const disposed = adapter.debugPresentationState().stageDecor;

      adapter.mount({ canvas, viewport: { width: 800, height: 450 } });
      adapter.ensureStageTerrain(selectedStageId);
      window.__terrainRemountQa = { adapter, canvas };

      return {
        failed: {
          loading: failed.loading,
          stageId: failed.stageId,
          terrainFallbackReason: failed.terrainFallbackReason,
          terrainLoaded: failed.terrainLoaded,
        },
        disposed: {
          loading: disposed.loading,
          stageId: disposed.stageId,
          terrainFallbackReason: disposed.terrainFallbackReason,
          terrainLoaded: disposed.terrainLoaded,
        },
      };
    }, { stageId, transientError });

    assert.deepEqual(lifecycle.failed, {
      loading: false,
      stageId,
      terrainFallbackReason: transientError,
      terrainLoaded: false,
    }, "the fixture must begin in the poisoned same-stage failure state");
    assert.deepEqual(lifecycle.disposed, {
      loading: false,
      stageId: null,
      terrainFallbackReason: null,
      terrainLoaded: false,
    }, "dispose must clear the failed stage identity and terrain error at the mount boundary");

    await page.waitForFunction((selectedStageId) => {
      const adapter = window.__terrainRemountQa?.adapter;
      return adapter?.loadedStageId === selectedStageId && adapter?.stageTerrainRecord !== null;
    }, stageId, { timeout: 15000 });

    const retried = await page.evaluate(() => {
      const { adapter, canvas } = window.__terrainRemountQa;
      const decor = adapter.debugPresentationState().stageDecor;
      const result = {
        loading: decor.loading,
        loadedStageId: adapter.loadedStageId,
        stageId: decor.stageId,
        terrainFallbackReason: decor.terrainFallbackReason,
        terrainLoaded: decor.terrainLoaded,
        terrainSource: decor.terrainSource,
      };
      adapter.dispose();
      canvas.remove();
      delete window.__terrainRemountQa;
      return result;
    });
    assert.equal(retried.loadedStageId, stageId, "the remounted renderer must retry the same stage");
    assert.equal(retried.stageId, stageId, "the successful retry must publish the same stage identity");
    assert.equal(retried.loading, false, "the same-stage retry must settle");
    assert.equal(retried.terrainLoaded, true, "the same-stage retry must mount terrain");
    // Cycle 10 supersession: the stage now ships an eligible composed slab floor, so a
    // successful remount loads it rather than falling back to a procedural plane. Derived
    // from the profile rather than hardcoded -- matching the house style at line 214 -- so
    // a future legitimately-ineligible stage cannot re-break this test. The point of the
    // test is unchanged: a transient failure must not persist across the dispose boundary.
    const retryProfile = stageWorldFor(stageId);
    assert.equal(
      retried.terrainSource,
      retryProfile.terrainRuntimeEligible ? "promoted-glb" : "procedural-flat-support",
      "the retry must publish the loaded terrain source",
    );
    assert.notEqual(retried.terrainFallbackReason, transientError, "the remount must not retain the prior transient terrain error");
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => hosting.server.close(resolve));
  }
});
