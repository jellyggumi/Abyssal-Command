import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";
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
import {
  STAGES as RUNTIME_STAGES,
  STAGE_PRESENTATION_BY_ID,
} from "../defense-catalog.js";
import { STAGE_SHOWCASE_IDS } from "../stage-world-catalog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORAGE_KEY = "abyssal-command-defense";
const NOW = 2_000_000;
const SHOWCASE_COUNT = 3;
const VIEWPORTS = [
  { name: "mobile portrait", width: 390, height: 844 },
  { name: "compact landscape", width: 844, height: 390 },
];

let browser;
let host;
let baseURL;
let unlockedCampaign;

function mimeType(file) {
  return {
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
  }[path.extname(file)] ?? "application/octet-stream";
}

async function startServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = path.resolve(ROOT, `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    try {
      const info = await stat(file);
      if (!info.isFile()) return response.writeHead(404).end();
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mimeType(file) });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  return server;
}

function storedCampaign(campaign) {
  const payload = serializeCampaign(campaign);
  payload.idleReturn.lastSettledAt = NOW;
  const text = JSON.stringify(payload);
  return JSON.stringify({
    version: RULES_VERSION,
    hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
    payload,
  });
}

function fullyUnlockedCampaign() {
  let campaign = createCampaign({ campaignId: "lobby-guide-disclosure", resetEpoch: 3 });
  for (const stage of CAMPAIGN_STAGES.slice(0, -1)) {
    campaign = startRun(campaign, stage.id);
    campaign = applyCampaignRunResult(campaign, { outcome: "victory", stageId: stage.id });
  }
  return storedCampaign(campaign);
}

/**
 * Opens the page and reveals the 출정 dock panel, which is where the editorial showcase,
 * the spoiler-free progression control and the guide launcher live since the unified
 * dock shell replaced the full-viewport lobby screen. There is no longer a
 * `#defense-app.defense-lobby` screen to wait for: the battle surface is mounted from
 * first paint and the outgame UI is a dock peeked open over it. Everything these tests
 * assert about disclosure is unchanged -- only the navigation to reach it is.
 */
async function openLobby(viewport = VIEWPORTS[0], { campaign = unlockedCampaign, touch = false } = {}) {
  const context = await browser.newContext({
    baseURL,
    hasTouch: touch,
    isMobile: touch,
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript(({ campaign, now, storageKey }) => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    Date.now = () => now;
    localStorage.setItem(storageKey, campaign);
  }, { campaign, now: NOW, storageKey: STORAGE_KEY });
  await page.goto("/campaign.html", { waitUntil: "networkidle" });
  await page.locator('#defense-battle-surface[data-defense-ready="true"]').waitFor();
  await assertOpsDeckMountedWithoutInteraction(page);
  return { context, errors, page };
}

/** Asserts the right command deck's 출정 surface is present with ZERO prior interaction.
 *  The slide-open dock this replaced needed a rail tap when its panel happened to be closed,
 *  so the old helper clicked conditionally. Nothing is clicked here on purpose: a future
 *  change that puts a disclosure gesture back in front of stage selection fails here instead
 *  of being silently clicked through. */
async function assertOpsDeckMountedWithoutInteraction(page) {
  const progression = page.locator("#command-deck-right [data-stage-progress]");
  await progression.waitFor({ state: "visible" });
  assert.equal(await progression.count(), 1, "stage progression must be mounted in the right command deck without any interaction");
}

function normalized(value) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function spoilerTerms(stage) {
  const presentation = STAGE_PRESENTATION_BY_ID[stage.id];
  const enemyKinds = new Set([stage.eliteKind, ...stage.waves.map(([, enemy]) => enemy)]);
  return [
    stage.bossName,
    stage.boss,
    stage.eliteId,
    ...enemyKinds,
    presentation.terrain.label,
    presentation.mapLabels.chokepath,
    presentation.mapLabels.elevation,
    presentation.mapLabels.hazard,
    presentation.mapLabels.occupation,
    presentation.mapLabels.extraction,
    presentation.mapLabels.objective,
  ].filter(Boolean);
}

before(async () => {
  unlockedCampaign = fullyUnlockedCampaign();
  host = await startServer();
  baseURL = `http://127.0.0.1:${host.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (host) await new Promise((resolve) => host.close(resolve));
});

test("lobby renders exactly three named editorial showcase stage cards", async () => {
  const { context, errors, page } = await openLobby();
  try {
    const cards = page.locator('[data-stage-showcase]');
    assert.equal(await cards.count(), SHOWCASE_COUNT, "the editorial showcase must contain exactly three stage cards");

    const ids = [];
    for (let index = 0; index < SHOWCASE_COUNT; index += 1) {
      const card = cards.nth(index);
      const stageId = await card.getAttribute("data-stage-showcase");
      const stage = RUNTIME_STAGES.find(({ id }) => id === stageId);
      assert.ok(stage, `showcase card ${index + 1} must identify a real stage`);
      assert.equal(await card.evaluate((node) => node.matches("button")), true, `${stage.name} showcase entry must be a native button`);
      assert.match(await card.getAttribute("aria-label") ?? await card.textContent() ?? "", new RegExp(stage.name, "i"), `${stage.name} showcase card must have an accessible stage name`);
      ids.push(stageId);
    }
    assert.deepEqual(ids, STAGE_SHOWCASE_IDS, "minimap nodes must preserve the three canonical showcase IDs and order");
    const map = page.locator("[data-stage-map]");
    assert.equal(await map.getAttribute("data-revealed-count"), String(SHOWCASE_COUNT), "a fully unlocked route must report all three revealed nodes");
    assert.match(await map.getAttribute("aria-label") ?? "", /3개\s*스테이지\s*밝혀짐/u, "the minimap accessible name must announce the revealed count");
    const firstCard = cards.first();
    const firstStageId = await firstCard.getAttribute("data-stage-showcase");
    await firstCard.focus();
    await page.keyboard.press("Enter");
    await page.locator(`#defense-app[data-stage-id="${firstStageId}"]`).waitFor();
    assert.equal(await page.locator('[data-stage-showcase][aria-pressed="true"]').count(), 1, "keyboard selection must disclose exactly one active showcase card");
    assert.deepEqual(errors, [], "showcase lobby emitted browser errors");
  } finally {
    await context.close();
  }
});

test("progressive minimap keeps unrevealed canonical nodes disabled and obscured", async () => {
  const campaign = storedCampaign(createCampaign({ campaignId: "lobby-minimap-locked", resetEpoch: 1 }));
  const { context, errors, page } = await openLobby(VIEWPORTS[0], { campaign });
  try {
    const map = page.locator("[data-stage-map]");
    const nodes = map.locator("[data-stage-showcase]");
    assert.equal(await nodes.count(), SHOWCASE_COUNT, "the minimap must retain exactly three canonical nodes while progression is locked");
    assert.deepEqual(
      await nodes.evaluateAll((entries) => entries.map(({ dataset }) => dataset.stageShowcase)),
      STAGE_SHOWCASE_IDS,
      "locked progression must not add, remove, or reorder canonical minimap nodes",
    );
    assert.equal(await map.getAttribute("data-revealed-count"), "1", "a fresh campaign must disclose only its first showcase stage");
    assert.match(await map.getAttribute("aria-label") ?? "", /1개\s*스테이지\s*밝혀짐/u, "the minimap accessible name must announce one revealed stage");

    const revealed = map.locator("[data-stage-showcase].is-revealed");
    const locked = map.locator("[data-stage-showcase].is-locked");
    assert.equal(await revealed.count(), 1, "only the currently unlocked node may be revealed");
    assert.equal(await locked.count(), 2, "the two future showcase nodes must remain visually obscured");
    assert.equal(await locked.evaluateAll((entries) => entries.every((entry) => entry.disabled)), true, "every locked minimap node must be natively disabled");
    for (let index = 0; index < await locked.count(); index += 1) {
      const node = locked.nth(index);
      assert.match(await node.getAttribute("aria-label") ?? "", /잠김/u, "locked node accessibility text must announce its state");
      assert.equal(
        normalized(await node.locator(".stage-map-copy span").textContent() ?? ""),
        normalized("등불을 전진시켜 이 구역을 밝히세요."),
        "locked node detail must remain behind the shared spoiler-safe obscuring copy",
      );
    }

    const selectedStageBefore = await page.locator("#defense-app").getAttribute("data-stage-id");
    await locked.first().evaluate((node) => node.click());
    assert.equal(await page.locator("#defense-app").getAttribute("data-stage-id"), selectedStageBefore, "a disabled future node cannot change stage selection");
    assert.equal(await page.locator('[data-stage-showcase][aria-pressed="true"]').count(), 1, "the existing data-stage-showcase selection contract must keep one active node");
    assert.deepEqual(errors, [], "progressive minimap emitted browser errors");
  } finally {
    await context.close();
  }
});

test("compact progression exposes every unlocked stage without spoiler details and keeps each launch-selectable", async () => {
  const { context, errors, page } = await openLobby();
  try {
    const control = page.locator('[data-stage-progress]');
    assert.equal(await control.count(), 1, "lobby must expose one compact progression control");
    assert.equal(await control.evaluate((node) => node.matches("select")), true, "progression must use the native keyboard/touch-selectable control");
    assert.match(await control.getAttribute("aria-label") ?? "", /전선|스테이지|작전|진행/i, "progression control must have an accessible purpose label");

    const entries = control.locator("option:not([disabled])[data-stage-id]");
    assert.equal(await entries.count(), CAMPAIGN_STAGES.length, "every unlocked campaign stage must have an enabled launch entry");
    const entryIds = await entries.evaluateAll((nodes) => nodes.map((node) => node.dataset.stageId));
    assert.deepEqual(entryIds, CAMPAIGN_STAGES.map(({ id }) => id), "progression entries must preserve canonical campaign order and IDs");

    const showcaseIds = new Set(await page.locator('[data-stage-showcase]').evaluateAll((nodes) => nodes.map((node) => node.dataset.stageShowcase)));
    for (const stage of RUNTIME_STAGES.filter(({ id }) => !showcaseIds.has(id))) {
      const entry = control.locator(`option[data-stage-id="${stage.id}"]`);
      const disclosure = normalized([
        await entry.textContent() ?? "",
        await entry.getAttribute("aria-label") ?? "",
        await entry.getAttribute("title") ?? "",
      ].join(" "));
      assert.match(disclosure, new RegExp(stage.name, "i"), `${stage.name} progression entry must disclose the stage name`);
      for (const term of spoilerTerms(stage)) {
        assert.equal(disclosure.includes(normalized(term)), false, `${stage.name} progression entry must not leak ${term}`);
      }
    }

    for (const stage of CAMPAIGN_STAGES) {
      await page.locator('[data-stage-progress]').selectOption(stage.id);
      await page.locator(`#defense-app[data-stage-id="${stage.id}"]`).waitFor();
      assert.match(await page.locator("#start-defense").textContent() ?? "", new RegExp(stage.name, "i"), `${stage.name} selection must update the launch action`);
      const runtimeStage = RUNTIME_STAGES.find(({ id }) => id === stage.id);
      if (!showcaseIds.has(stage.id)) {
        assert.equal(await page.locator('[data-stage-atlas="selected"], [data-stage-map-context="terrain"], [data-stage-briefing="selected"]').count(), 0, `${stage.name} must not render showcase terrain or briefing structures`);
        const safeDisclosure = page.locator('[data-stage-disclosure="safe"]');
        assert.ok(await safeDisclosure.count() >= 1, `${stage.name} must render a spoiler-safe launch disclosure`);
        const safeText = normalized(await page.locator(".hero-copy, [data-stage-disclosure=\"safe\"], .stage-progression-summary").allTextContents().then((parts) => parts.join(" ")));
        for (const term of spoilerTerms(runtimeStage)) {
          assert.equal(safeText.includes(normalized(term)), false, `${stage.name} launch disclosure must not leak ${term}`);
        }
      }
    }

    const finalStage = CAMPAIGN_STAGES.at(-1);
    await page.locator("#start-defense").click();
    const surface = page.locator('[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    assert.equal(await surface.getAttribute("data-stage-id"), finalStage.id, "the non-showcase progression selection must launch its canonical stage");
    assert.deepEqual(errors, [], "progression launch emitted browser errors");
  } finally {
    await context.close();
  }
});

test("battle controls, companion, extraction, and skill guides are labelled, discoverable, and keyboard operable", async () => {
  const { context, errors, page } = await openLobby();
  try {
    const opener = page.locator('[data-guide-open]');
    assert.equal(await opener.count(), 1, "lobby must expose one guide entry point");
    assert.match(await opener.getAttribute("aria-label") ?? await opener.textContent() ?? "", /가이드|도움|안내/i, "guide entry point must have an accessible name");
    assert.equal(await opener.evaluate((node) => node.matches("button")), true, "guide entry point must be a native keyboard button");

    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /가이드|도움|안내/i });
    await dialog.waitFor({ state: "visible" });
    assert.ok(await dialog.getAttribute("aria-labelledby"), "guide dialog must reference its visible title");

    const guideText = normalized(await dialog.textContent() ?? "");
    assert.match(guideText, /(?:손가락\s*(?:1|한)\s*개|한\s*손가락|one[- ]finger).{0,40}(?:드래그|drag)|(?:드래그|drag).{0,40}(?:손가락\s*(?:1|한)\s*개|한\s*손가락|one[- ]finger)/i, "guide must identify one-finger drag as the battlefield gesture");
    assert.match(guideText, /(?:전장|전투\s*화면|battlefield).{0,40}(?:드래그|drag)|(?:드래그|drag).{0,40}(?:전장|전투\s*화면|battlefield)/i, "guide must identify the battlefield as the drag surface");
    assert.match(guideText, /(?:카메라|시야|camera).{0,30}(?:오비트|회전|돌리|orbit)|(?:오비트|orbit).{0,30}(?:카메라|시야|camera)/i, "guide must say battlefield drag orbits the camera");
    assert.match(guideText, /(?:지휘관|커맨더|commander)/i, "guide must name the commander as the movement target");
    assert.match(guideText, /(?:이동|움직|move)/i, "guide must explain commander movement");
    assert.match(guideText, /(?:화면|온스크린|on-screen).{0,20}(?:방향\s*(?:버튼|패드|컨트롤)|d-?pad)/i, "guide must identify the on-screen direction controls");
    assert.match(guideText, /wasd/i, "guide must disclose WASD movement");
    assert.match(guideText, /화살표\s*(?:키|방향)|arrow\s*keys?/i, "guide must disclose arrow-key movement");
    assert.doesNotMatch(
      guideText,
      /(?:드래그|drag)(?:하면|해|하여|로|ging)?\s*(?:지휘관|커맨더|commander)(?:을|이|가)?\s*(?:이동|움직|move)|(?:지휘관|커맨더|commander).{0,16}(?:드래그|drag)(?:로|해|하여)?\s*(?:이동|움직|move)/i,
      "guide must never claim battlefield drag moves the commander",
    );

    const guideContracts = [
      { id: "companion", heading: /동료/i, required: [/편성/i, /자동|자율|동료/i] },
      { id: "extraction", heading: /추출/i, required: [/정예/i, /처치/i, /추출/i] },
      { id: "skills", heading: /스킬/i, required: [/스킬/i, /쿨다운|재사용/i, /사용|누르/i] },
    ];
    for (const contract of guideContracts) {
      const section = dialog.locator(`[data-guide-section="${contract.id}"]`);
      assert.equal(await section.count(), 1, `${contract.id} guide must be discoverable as its own section`);
      assert.equal(await section.getByRole("heading", { name: contract.heading }).count(), 1, `${contract.id} guide must have a named heading`);
      const steps = section.locator("ol > li");
      assert.ok(await steps.count() >= 2, `${contract.id} guide must provide at least two ordered actions`);
      const text = normalized(await section.textContent() ?? "");
      for (const phrase of contract.required) assert.match(text, phrase, `${contract.id} guide must explain ${phrase}`);
    }

    const close = dialog.locator('[data-guide-close]');
    assert.equal(await close.evaluate((node) => node.matches("button")), true, "guide close action must be a native keyboard button");
    assert.match(await close.getAttribute("aria-label") ?? await close.textContent() ?? "", /닫기|close/i, "guide close action must be named");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(errors, [], "keyboard guide flow emitted browser errors");
  } finally {
    await context.close();
  }
});

test("modality tabs keep one roving stop and switch their selected panel with Arrow, Home, and End", async () => {
  const { context, errors, page } = await openLobby();
  try {
    const opener = page.locator("[data-guide-open]");
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /가이드|도움|안내/i });
    await dialog.waitFor({ state: "visible" });

    const modalityState = () => dialog.evaluate((node) => ({
      activeId: document.activeElement?.id ?? "",
      panels: [...node.querySelectorAll('[role="tabpanel"]')].map((panel) => ({
        hidden: panel.hidden,
        id: panel.id,
      })),
      tabs: [...node.querySelectorAll('[role="tab"]')].map((tab) => ({
        id: tab.id,
        selected: tab.getAttribute("aria-selected"),
        tabIndex: tab.tabIndex,
      })),
    }));
    const assertSelected = async (modality) => {
      const state = await modalityState();
      const selectedId = `modality-tab-${modality}`;
      const panelId = `modality-panel-${modality}`;
      assert.deepEqual(
        state.tabs.filter(({ selected }) => selected === "true").map(({ id }) => id),
        [selectedId],
        `${modality} must be the only selected modality tab`,
      );
      assert.deepEqual(
        state.tabs.filter(({ tabIndex }) => tabIndex === 0).map(({ id }) => id),
        [selectedId],
        `${modality} must own the only tab stop`,
      );
      assert.deepEqual(
        state.panels.filter(({ hidden }) => !hidden).map(({ id }) => id),
        [panelId],
        `${modality} must expose only its associated panel`,
      );
      assert.equal(state.activeId, selectedId, `${modality} keyboard selection must retain focus on the selected tab`);
    };

    const keyboardTab = dialog.locator("#modality-tab-keyboard");
    await keyboardTab.focus();
    await assertSelected("keyboard");
    await page.keyboard.press("ArrowRight");
    await assertSelected("pointer");
    await page.keyboard.press("End");
    await assertSelected("touch");
    await page.keyboard.press("Home");
    await assertSelected("keyboard");
    assert.deepEqual(errors, [], "modality tab keyboard navigation emitted browser errors");
  } finally {
    await context.close();
  }
});

test("guide controls remain touch operable without horizontal overflow in portrait and compact landscape", async () => {
  for (const viewport of VIEWPORTS) {
    const { context, errors, page } = await openLobby(viewport, { touch: true });
    try {
      const opener = page.locator('[data-guide-open]');
      const openerBox = await opener.boundingBox();
      assert.ok(openerBox && openerBox.width >= 44 && openerBox.height >= 44, `${viewport.name} guide opener must be at least 44px square`);
      await opener.tap();

      const dialog = page.getByRole("dialog", { name: /가이드|도움|안내/i });
      await dialog.waitFor({ state: "visible" });
      const close = dialog.locator('[data-guide-close]');
      const closeBox = await close.boundingBox();
      assert.ok(closeBox && closeBox.width >= 44 && closeBox.height >= 44, `${viewport.name} guide close control must be at least 44px square`);
      const structure = await page.evaluate(() => {
        const dialog = document.querySelector("#lobby-guide-dialog");
        const rect = dialog?.getBoundingClientRect();
        return {
          clientWidth: document.documentElement.clientWidth,
          dialogLeft: rect?.left,
          dialogRight: rect?.right,
          guideSections: dialog?.querySelectorAll("[data-guide-section]").length ?? 0,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      assert.equal(structure.guideSections, 3, `${viewport.name} dialog must retain all three guide sections`);
      assert.equal(structure.scrollWidth <= structure.clientWidth, true, `${viewport.name} lobby must not overflow horizontally`);
      assert.ok(structure.dialogLeft >= 0 && structure.dialogRight <= structure.clientWidth, `${viewport.name} dialog must remain within the physical viewport width`);
      await close.tap();
      await dialog.waitFor({ state: "hidden" });
      assert.deepEqual(errors, [], `${viewport.name} touch guide flow emitted browser errors`);
    } finally {
      await context.close();
    }
  }
});
