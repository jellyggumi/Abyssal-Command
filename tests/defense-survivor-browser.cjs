const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const allowMissing = process.argv.includes("--allow-missing-browser");
let playwright;
try { playwright = require("playwright"); } catch {
  if (!allowMissing) throw new Error("require('playwright') failed; install the lock-backed browser dependency.");
  console.log("DEFENSE_SURVIVOR_BROWSER_SKIPPED missing Playwright");
}
const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "abyssal-command-defense";

function startServer() {
  const host = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = path.resolve(ROOT, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return res.writeHead(404).end();
      const mimeTypes = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".mp4": "video/mp4", ".glb": "model/gltf-binary" };
      res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", reject));
}

/**
 * Cycle 3 Track 3 World HUD regression fixtures (see repo handoff notes for the
 * three real bugs found + fixed during manual verification):
 *
 * Bug #1: projectEntityToScreen()/projectStaticPoint() used to accept a
 *   world-unit heightOffset that got added before projecting to NDC. This
 *   scene's world-space half-extent can be under 1 unit (STAGE_WORLD
 *   "cinder-span" halfX=0.85/halfZ=0.47), so a meter-scale-guessed offset like
 *   2.3 was ~2.5x the entire scene height, pushing NDC y outside [-1,1] and
 *   making `visible` false for genuinely on-screen entities -- nameplates and
 *   damage numbers silently never rendered. Fixed: projection now always uses
 *   the entity's raw ground anchor; callers apply a fixed SCREEN-SPACE PIXEL
 *   offset after projecting (WORLD_NAMEPLATE_LIFT_PX etc. in app.js).
 *
 * Bug #2: the original single .world-damage-number element carried BOTH an
 *   inline JS-computed position transform AND a CSS keyframe animation that
 *   also set `transform`. A CSS animation replaces the entire computed value
 *   for an animated property -- it does not compose with an inline value --
 *   so every damage number's rendered (computed) transform was pinned to the
 *   overlay's top-left corner regardless of the real hit location. Fixed: an
 *   outer .world-damage-number holds ONLY the static inline position
 *   transform; a nested .world-damage-number-rise span carries the
 *   rise+fade keyframe animation.
 *
 * Bug #3 (more severe, pre-existing before this session): getRunSnapshot()
 *   has no top-level `boss` field -- the boss only ever appears as an entry
 *   in snapshot.enemies with class==="boss". The renderer's old code checked
 *   `if (snapshot.boss ...)` (permanently unreachable dead code) and
 *   separately meshNameFor() deliberately returns null for class==="boss"
 *   entities, expecting a caller to substitute the stage's boss GLB mesh
 *   root name -- no caller ever did. Net effect: the boss rendered with ZERO
 *   mesh in real WebGL for the entire life of this renderer. Fixed: the
 *   enemies loop now resolves `world.boss` (STAGE_WORLD[stageId].boss) as
 *   the mesh root name whenever enemy.class === "boss".
 *
 * Seeds a real companion loadout via campaign-state.js + defense-storage.js's
 * own localStorage envelope format (indexedDB disabled so the app's real
 * boot sequence falls back to localStorage), then drives a real battle
 * against real WebGL in a fresh browser context.
 */
async function seededWorldHudCampaign() {
  const [campaignState, rpgCatalog, stageStoryCatalog] = await Promise.all([
    import("../campaign-state.js"),
    import("../rpg-catalog.js"),
    import("../stage-story-catalog.js"),
  ]);
  let campaign = campaignState.createCampaign({ campaignId: "defense-0-1", resetEpoch: 0 });
  campaign = campaignState.captureElite(campaign, "s1-ember-hunter", "ember-cohort");
  campaign = campaignState.captureElite(campaign, "s2-veil-sentinel", "rift-lens");
  campaign = campaignState.captureElite(campaign, "s3-throne-wraith", "throne-echo");
  campaign = campaignState.setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "throne-echo"]);
  const payload = campaignState.serializeCampaign(campaign);
  const text = JSON.stringify(payload);
  const companionLoadout = campaign.companionLoadout.prototypeIds;
  const equipTiers = (ownerId) => Object.fromEntries(
    rpgCatalog.EQUIPMENT_SLOTS.map((slot) => [slot, campaignState.equipmentTierIndexFor(campaign, ownerId, slot)]),
  );
  const stableRunSeed = (stageId) => {
    const attempt = campaign.attemptsByStage[stageId] ?? 0;
    const source = `${campaign.campaignId}:${campaign.resetEpoch}:${stageId}:${attempt}`;
    let hash = 0x811c9dc5;
    for (const character of source) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0) || 1;
  };
  const stageId = "cinder-span";
  const cinderStarterSkillId = stageStoryCatalog.stageStoryFor(stageId)?.extractionReward?.skillId ?? null;
  const runOptions = {
    stageId,
    seed: stableRunSeed(stageId),
    abyssDepth: 0,
    companionLoadout,
    rewardIds: campaign.rewardIds ?? [],
    wardenProgress: campaign.wardenProgress,
    wardenEquipment: equipTiers("warden"),
    companionEquipment: Object.fromEntries(companionLoadout.map((id) => [id, equipTiers(id)])),
    extractedSkillRanks: Object.fromEntries(
      (campaign.storyProgress?.activeSkillLoadout ?? []).map((skillId) => [
        skillId,
        campaign.storyProgress?.extractedSkillLevels?.[skillId] ?? 1,
      ]),
    ),
    initialSkillIds: stageId === "cinder-span" && campaign.resolvedIds.length === 0
      ? [cinderStarterSkillId]
      : [],
    formation: campaign.companionFormation,
    carryOver: campaign.stageCarryOver ?? null,
  };
  return {
    encoded: JSON.stringify({
      version: campaignState.RULES_VERSION,
      hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
      payload,
    }),
    runOptions,
  };
}

async function dismissCutsceneAsPlayer(page, deadline) {
  const overlay = page.locator("#defense-cutscene-overlay");
  const dismiss = overlay.locator("[data-cutscene-dismiss]");
  const diagnostics = { cutsceneEvent: null, line: null, status: null };
  const remaining = (operation) => {
    const milliseconds = deadline - Date.now();
    assert.ok(
      milliseconds > 0,
      `cutscene dismissal deadline exhausted before ${operation}; cutscene state: ${JSON.stringify(diagnostics)}`,
    );
    return milliseconds;
  };
  try {
    if (!(await dismiss.isVisible())) return null;

    const overlayNode = await overlay.elementHandle({ timeout: remaining("capturing overlay") });
    assert(overlayNode, "a visible cutscene must have a live overlay");
    diagnostics.cutsceneEvent = await overlay.getAttribute(
      "data-cutscene-event",
      { timeout: remaining("reading cutscene event") },
    );
    diagnostics.line = (
      await overlay.locator(".cutscene-line").textContent({
        timeout: remaining("reading cutscene line"),
      }) ?? ""
    ).trim();
    diagnostics.status = (
      await page.locator("#battle-status").textContent({
        timeout: remaining("reading battle status"),
      }) ?? ""
    ).trim();
    assert.match(diagnostics.line, /\S/, "a visible cutscene must present dialogue or narration before dismissal");
    await dismiss.press("Enter", { timeout: remaining("activating cutscene dismissal") });
    await page.waitForFunction(
      (node) => !node.isConnected,
      overlayNode,
      { timeout: remaining("waiting for captured overlay to detach") },
    );
    return diagnostics;
  } catch (error) {
    error.message = `${error.message}; cutscene state: ${JSON.stringify(diagnostics)}`;
    throw error;
  }
}

async function waitForGrowthOfferThroughCutscenes(page, report, {
  noProgressTimeout,
  overallTimeout,
}) {
  assert.ok(noProgressTimeout > 0, "growth journey no-progress timeout must be positive");
  assert.ok(overallTimeout > noProgressTimeout, "growth journey overall timeout must exceed its no-progress timeout");
  const growthOffer = page.locator("#defense-growth-offer");
  const terminalStates = ["victory", "defeat", "final_completion"];
  const startedAt = Date.now();
  const overallDeadline = startedAt + overallTimeout;

  let state = null;
  let lastSimulationSecond = null;
  let lastProgressAt = startedAt;
  const readState = (timeout) => page.locator("html").evaluate(() => {
    const status = (document.querySelector("#battle-status")?.textContent ?? "").trim();
    const simulationSecondMatch = status.match(/시간\s+(\d+)초/);
    const offer = document.querySelector("#defense-growth-offer");
    const offerStyle = offer ? getComputedStyle(offer) : null;
    const offerVisible = Boolean(
      offer
      && offer.getClientRects().length > 0
      && offerStyle?.display !== "none"
      && offerStyle?.visibility !== "hidden",
    );
    const growthChoices = [...offer?.querySelectorAll("button[data-pick]") ?? []]
      .filter((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true")
      .map((button) => button.dataset.pick ?? "");
    const cutscene = document.querySelector("#defense-cutscene-overlay");
    const dismiss = cutscene?.querySelector("[data-cutscene-dismiss]");
    const dismissStyle = dismiss ? getComputedStyle(dismiss) : null;
    return {
      hidden: document.hidden,
      surface: { ...document.querySelector("#defense-battle-surface")?.dataset },
      status,
      simulationSecond: simulationSecondMatch ? Number(simulationSecondMatch[1]) : null,
      xp: document.querySelector("#battle-xp-label")?.textContent,
      enemies: document.querySelector("#battle-enemies")?.textContent,
      formation: document.querySelector("#battle-formation-state")?.textContent,
      cutscene: cutscene?.dataset.cutsceneEvent,
      cutsceneLine: cutscene?.querySelector(".cutscene-line")?.textContent,
      cutsceneDismissVisible: Boolean(
        dismiss
        && dismiss.getClientRects().length > 0
        && dismissStyle?.display !== "none"
        && dismissStyle?.visibility !== "hidden",
      ),
      growthOffer: Boolean(offer),
      growthOfferVisible: offerVisible,
      growthChoices,
    };
  }, undefined, { timeout });
  const failWithState = (reason, currentState, progressAt) => {
    assert.fail(
      `${reason}; wall elapsed ${Date.now() - startedAt}ms, time since last observable simulation progress ${Date.now() - progressAt}ms, `
      + `last observed simulation second ${String(lastSimulationSecond)}; `
      + `journey bounds ${JSON.stringify({ noProgressTimeout, overallTimeout })}; last state: ${JSON.stringify(currentState)}`,
    );
  };
  // Reports what actually owns the pointer over a control, so a blocked press
  // names the blocking element instead of leaving a bare Playwright timeout.
  //
  // Retained from 887e5df / dd94ba0. That investigation established the blocker
  // over the D-pad is the run's outcome card (section.edge-card.defense-result,
  // appended into #defense-edge-hud), which exists ONLY once the run has ended.
  // The patrol those commits guarded is gone from this function -- it was a
  // proven no-op (a click emits MOVE W and MOVE IDLE in one event turn), and its
  // press deterministically lost the run, so the blocked cleanup click was a
  // symptom of a dead run rather than a cause. The held-movement contract in
  // verifyPlaythroughJourney replaces it. This helper stays because the same
  // diagnosis applies wherever a real player press must hit-test a control.
  const pointerOwner = async (selector) => page
    .locator(selector)
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (!top || top === element || element.contains(top)) return null;
      return {
        tag: top.tagName,
        id: top.id || null,
        className: typeof top.className === "string" ? top.className.slice(0, 80) : null,
        text: (top.textContent ?? "").trim().slice(0, 60),
      };
    })
    .catch(() => null);
  const failReason = (progressDeadline) => progressDeadline <= overallDeadline
    ? "live battle stopped advancing before a selectable growth offer appeared"
    : "live battle exceeded the overall growth-journey safety bound";

  state = await readState(Math.max(1, Math.min(noProgressTimeout, overallDeadline - Date.now())));
  lastSimulationSecond = state.simulationSecond;
  lastProgressAt = Date.now();

  while (Date.now() < overallDeadline) {
    if (terminalStates.includes(state.surface?.defenseState)) {
      failWithState("live battle became terminal before a selectable growth offer appeared", state, lastProgressAt);
    }
    if (state.growthOfferVisible && state.growthChoices.length > 0) {
      return growthOffer;
    }

    const progressDeadline = lastProgressAt + noProgressTimeout;
    const operationDeadline = Math.min(progressDeadline, overallDeadline);
    if (Date.now() >= operationDeadline) {
      failWithState(failReason(progressDeadline), state, lastProgressAt);
    }

    const dismissed = await dismissCutsceneAsPlayer(page, operationDeadline);
    if (dismissed) {
      report.events.push({ event: "cutscene-dismissed-before-growth", ...dismissed });
      state = await readState(Math.max(1, operationDeadline - Date.now()));
      continue;
    }
    const advancedByPump = await page.evaluate(() => {
      if (typeof window.__pumpFrame !== "function") return false;
      window.__pumpFrame(100);
      return true;
    });
    if (advancedByPump) {
      await page.waitForTimeout(0);
      state = await readState(Math.max(1, Math.min(progressDeadline, overallDeadline) - Date.now()));
      if (
        state.simulationSecond !== null
        && (lastSimulationSecond === null || state.simulationSecond > lastSimulationSecond)
      ) {
        lastSimulationSecond = state.simulationSecond;
        lastProgressAt = Date.now();
      }
      continue;
    }
    const signalTimeout = Math.max(1, Math.min(progressDeadline, overallDeadline) - Date.now());
    try {
      await page.waitForFunction(({ previousSimulationSecond, terminalStates }) => {
        const offer = document.querySelector("#defense-growth-offer");
        const offerStyle = offer ? getComputedStyle(offer) : null;
        const offerReady = Boolean(
          offer
          && offer.getClientRects().length > 0
          && offerStyle?.display !== "none"
          && offerStyle?.visibility !== "hidden"
          && [...offer.querySelectorAll("button[data-pick]")].some(
            (button) => !button.disabled && button.getAttribute("aria-disabled") !== "true",
          )
        );
        const dismiss = document.querySelector("#defense-cutscene-overlay [data-cutscene-dismiss]");
        const dismissStyle = dismiss ? getComputedStyle(dismiss) : null;
        const dismissReady = Boolean(
          dismiss
          && dismiss.getClientRects().length > 0
          && dismissStyle?.display !== "none"
          && dismissStyle?.visibility !== "hidden",
        );
        const surfaceState = document.querySelector("#defense-battle-surface")?.dataset.defenseState;
        const terminal = terminalStates.includes(surfaceState);
        const status = document.querySelector("#battle-status")?.textContent ?? "";
        const match = status.match(/시간\s+(\d+)초/);
        const simulationSecond = match ? Number(match[1]) : null;
        const simulationAdvanced = simulationSecond !== null
          && (previousSimulationSecond === null || simulationSecond > previousSimulationSecond);
        return terminal || offerReady || dismissReady || simulationAdvanced;
      }, { previousSimulationSecond: lastSimulationSecond, terminalStates }, { timeout: signalTimeout });
      state = await readState(Math.max(1, Math.min(progressDeadline, overallDeadline) - Date.now()));
    } catch (error) {
      if (error?.name !== "TimeoutError") throw error;
      try {
        state = await readState(Math.min(2000, Math.max(1, overallDeadline - Date.now())));
      } catch {
        // Preserve the last readable public state when the page itself is unresponsive.
      }
      const stateIsTerminal = terminalStates.includes(state?.surface?.defenseState);
      const simulationAdvanced = state?.simulationSecond !== null
        && (lastSimulationSecond === null || state.simulationSecond > lastSimulationSecond);
      if (simulationAdvanced) {
        lastSimulationSecond = state.simulationSecond;
        lastProgressAt = Date.now();
      }
      if (stateIsTerminal || state?.growthOfferVisible || state?.cutsceneDismissVisible || simulationAdvanced) {
        continue;
      }
      failWithState(failReason(progressDeadline), state, lastProgressAt);
    }

    if (
      state.simulationSecond !== null
      && (lastSimulationSecond === null || state.simulationSecond > lastSimulationSecond)
    ) {
      lastSimulationSecond = state.simulationSecond;
      lastProgressAt = Date.now();
    }
  }

  failWithState("live battle exceeded the overall growth-journey safety bound", state, lastProgressAt);
}

async function verifyPlaythroughJourney(browser, hosting, campaign) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 390, height: 844 }, hasTouch: true });
  // The CI runner measures rafMean ~95.8 ms against ~16 ms locally -- about 6x slower, ~10 fps
  // -- which `defense-phone-battle-hud-browser.test.cjs:48-59` documents and answers with
  // `setDefaultTimeout(90_000)`; `progression-mobile-ui-browser.cjs:104` does the same. This
  // file was never given that treatment and still runs on Playwright's stock 30 s, so the
  // `defenseFeedback === "lore"` wait below -- which needs input to round-trip through a
  // simulation tick, exactly the kind that starves first -- timed out at 30000 ms on
  // `1a91effc` while both hardened suites passed. Same reasoning, same value.
  context.setDefaultTimeout(90_000);
  const page = await context.newPage();
  const report = { events: [], errors: [] };
  page.on("pageerror", (error) => report.errors.push({ kind: "page", message: error.message }));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push({ kind: "console", message: message.text() }); });
  try {
    await page.addInitScript(({ encoded, key }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      localStorage.setItem(key, encoded);
    }, { encoded: campaign.encoded, key: STORAGE_KEY });
    await page.addInitScript(() => {
      const queue = new Map();
      let nextId = 1;
      let syntheticNow = 0;
      window.requestAnimationFrame = (callback) => {
        const id = nextId++;
        queue.set(id, callback);
        return id;
      };
      window.cancelAnimationFrame = (id) => { queue.delete(id); };
      window.__pumpFrame = (deltaMs) => {
        syntheticNow += deltaMs;
        const pending = [...queue.values()];
        queue.clear();
        for (const callback of pending) callback(syntheticNow);
        return syntheticNow;
      };
    });
    await page.goto("/campaign.html", { waitUntil: "domcontentloaded" });
    await page.locator("#start-defense").waitFor();
    assert.equal(await page.locator("#start-defense").isVisible(), true, "lobby must expose a live departure action");
    report.events.push("lobby-visible");
    await page.locator("#start-defense").click();
    const surface = page.locator('#defense-battle-surface[data-defense-started="true"]');
    await surface.waitFor({ state: "attached" });
    // LORE FEEDBACK IS A SINGLE-SHOT PUBLICATION ON A SYNTHETIC CLOCK, REVOKED ON A REAL ONE.
    // `LORE_SURPRISE_RESOLVED` is emitted once, at run creation (defense-run-simulation.js:5484,
    // tick 0), so renderEventFeedback() publishes data-defense-feedback="lore" on the FIRST frame
    // that renders tick-0 events and never again -- its per-tick key dedupe (app.js:3110-3115)
    // swallows every repeat. That publication is then revoked by a real-time setTimeout(..., 1800)
    // (app.js:3124-3130) which the synthetic rAF clock installed above does NOT control: page
    // frames advance only when __pumpFrame() is called, but the revoke runs on wall time.
    // A bare `waitForFunction` here hung for the full 90 s on CI run 30801125333, two ways. Its
    // polling is alive -- measured: Playwright polls off a pristine rAF, not this page's hijacked
    // one -- but (1) if the single pumped frame rendered nothing (e.g. the session had not
    // registered its loop rAF callback yet, so the pump drained an empty queue), no later frame
    // ever runs and the predicate polls forever against a frozen page; and (2) if the attribute
    // WAS set, the 1800 ms revoke deletes it and nothing can set it again -- no frames advance and
    // the tick-0 event is already deduped -- so the poll spins on state that will never return.
    // #battle-event-feedback had the same exposure, being read AFTER the wait.
    // So: latch the observation the instant it happens (an attribute observer, whose callback is a
    // microtask and therefore always ahead of the 1800 ms macrotask revoke) and drive the wait by
    // pumping it forward instead of assuming one frame was enough.
    await page.evaluate(() => {
      const captureLoreFeedback = () => {
        if (window.__loreFeedbackLatch) return;
        const surfaceNode = document.querySelector("#defense-battle-surface");
        if (surfaceNode?.dataset.defenseFeedback !== "lore") return;
        const feedbackNode = document.querySelector("#battle-event-feedback");
        window.__loreFeedbackLatch = {
          surfaceFeedback: surfaceNode.dataset.defenseFeedback,
          feedback: feedbackNode?.dataset.feedback ?? null,
          text: feedbackNode?.textContent ?? "",
        };
      };
      window.__loreFeedbackLatch = null;
      window.__captureLoreFeedback = captureLoreFeedback;
      // #defense-battle-surface and #battle-event-feedback are mounted exactly once for the whole
      // page lifetime (app.js:1183-1187, 1868-1881), so this observer can never be orphaned.
      new MutationObserver(captureLoreFeedback).observe(document.querySelector("#defense-battle-surface"), {
        attributes: true,
        attributeFilter: ["data-defense-feedback"],
      });
      captureLoreFeedback();
    });
    await page.evaluate(() => window.__pumpFrame(100));
    report.events.push("battle-visible");
    // Bounded by construction: at most LORE_FEEDBACK_MAX_PUMPS synthetic frames (100 ms of game
    // time each), one evaluate round trip apiece, checking before every pump so the common case
    // where the frame above already published costs zero extra frames. This cannot hang -- it
    // latches or it fails with the pump count -- and it is not a wait that cannot fail: a run that
    // never publishes lore feedback still fails, just promptly and with a diagnosis.
    const LORE_FEEDBACK_MAX_PUMPS = 240;
    let loreFeedback = null;
    let loreFeedbackPumps = 0;
    while (!loreFeedback) {
      loreFeedback = await page.evaluate(() => {
        window.__captureLoreFeedback();
        return window.__loreFeedbackLatch;
      });
      if (loreFeedback || loreFeedbackPumps >= LORE_FEEDBACK_MAX_PUMPS) break;
      await page.evaluate(() => window.__pumpFrame(100));
      loreFeedbackPumps += 1;
    }
    assert.ok(
      loreFeedback,
      `lore feedback never reached #defense-battle-surface within ${LORE_FEEDBACK_MAX_PUMPS} pumped frames`,
    );
    report.events.push({ event: "lore-feedback-latched", pumps: loreFeedbackPumps });
    assert.equal(loreFeedback.feedback, "lore");
    assert.match(
      loreFeedback.text,
      /\S/,
      "lore feedback must render safe snapshot-derived text through the live status region",
    );
    const cutscene = page.locator("#defense-cutscene-overlay");
    await cutscene.waitFor({ state: "visible" });
    assert.ok(
      ["STAGE_STARTED", "LORE_SURPRISE_RESOLVED"].includes(await surface.getAttribute("data-defense-cutscene")),
      "stage entry must present authored stage or resolved-lore snapshot copy",
    );
    const duringCutscene = await surface.getAttribute("data-defense-input-seq");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, duringCutscene);
    report.events.push("keyboard-movement-during-cutscene");
    assert.equal(await surface.getAttribute("data-defense-move"), "IDLE", "keyboard release must leave the public movement state idle");
    const accessibility = await page.locator("#defense-battle-surface").evaluate((surface) => ({
      label: surface.getAttribute("aria-label"),
      canvasLabel: surface.querySelector("#defense-canvas")?.getAttribute("aria-label"),
      statusLive: surface.querySelector("#battle-status")?.getAttribute("aria-live"),
      movement: {
        role: surface.querySelector("#movement-actions")?.getAttribute("role"),
        label: surface.querySelector("#movement-actions")?.getAttribute("aria-label"),
        // KEYPAD RETIRED: the five [data-move] ring buttons are gone. What must stay exposed is the
        // drag stick itself plus the hint that names the keyboard path, since keyboard movement
        // (KEY_DIRECTIONS in app.js) is now the sole non-pointer modality.
        joystick: {
          present: Boolean(surface.querySelector("#movement-actions [data-joystick]")),
          role: surface.querySelector("#movement-actions [data-joystick]")?.getAttribute("role"),
          label: surface.querySelector("#movement-actions [data-joystick]")?.getAttribute("aria-label"),
          describedBy: surface.querySelector("#movement-actions [data-joystick]")?.getAttribute("aria-describedby"),
        },
        hint: surface.querySelector("#movement-hint")?.textContent?.trim() ?? null,
        legacyKeypadButtons: surface.querySelectorAll("#movement-actions [data-move]").length,
      },
    }));
    assert.match(accessibility.label ?? "", /\S/, "battle surface must expose an accessible name");
    assert.match(accessibility.canvasLabel ?? "", /\S/, "battle canvas must expose an accessible name");
    assert.equal(accessibility.statusLive, "polite", "battle status must announce snapshot changes");
    assert.equal(accessibility.movement.role, "group", "movement controls must stay a labelled group");
    assert.equal(accessibility.movement.label, "한 손 이동 조작", "movement group must keep its accessible name");
    assert.equal(accessibility.movement.legacyKeypadButtons, 0,
      "the retired [data-move] keypad must not come back — it sat on top of the pad and swallowed edge-started drags");
    assert.deepEqual(
      {
        present: accessibility.movement.joystick.present,
        role: accessibility.movement.joystick.role,
        label: accessibility.movement.joystick.label,
        describedBy: accessibility.movement.joystick.describedBy,
      },
      { present: true, role: "application", label: "이동 스틱", describedBy: "movement-hint" },
      "the drag stick must be the labelled, described movement control",
    );
    assert.match(accessibility.movement.hint ?? "", /WASD|방향키/,
      "the movement hint must name the keyboard path, now the only non-pointer modality");
    assert.equal(
      await cutscene.isVisible(),
      true,
      "cutscene must remain visible until the test dismisses it; it auto-dismissed before dismissal interaction",
    );
    const openingCutscenes = [];
    const openingCutsceneDeadline = Date.now() + 30000;
    for (let index = 0; index < 8 && await cutscene.isVisible(); index += 1) {
      const dismissed = await dismissCutsceneAsPlayer(page, openingCutsceneDeadline);
      assert(dismissed, "each visible opening cutscene must expose a player dismissal action");
      openingCutscenes.push(dismissed);
    }
    assert.ok(openingCutscenes.length > 0, "the player must dismiss the opening cutscene");
    assert.equal(await cutscene.isVisible(), false, "all queued opening dialogue and narration must be dismissed");
    assert.equal(await surface.getAttribute("data-defense-cutscene"), null, "cutscene dismissal must not leave stale presentation state");
    report.events.push(...openingCutscenes.map((entry) => ({ event: "opening-cutscene-dismissed", ...entry })));
    // Keyboard movement without the retired keypad: KEY_DIRECTIONS handles the key directly, so
    // this is the same public contract (data-defense-move === "E") reached through the modality
    // that actually survives — no focus target required.
    const beforeControlKeyboard = await surface.getAttribute("data-defense-input-seq");
    // HOLD, not press: a keyup returns movement to IDLE, so a press/release pair would race the
    // assertion. This mirrors how a player actually holds a direction.
    await page.keyboard.down("d");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, beforeControlKeyboard);
    assert.equal(await surface.getAttribute("data-defense-move"), "E", "keyboard movement must queue the public east movement command");
    await page.keyboard.up("d");
    await page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseMove === "IDLE");
    report.events.push("stage-cutscene-dismissed");
    const before = await surface.getAttribute("data-defense-input-seq");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, before);
    report.events.push("keyboard-movement-after-cutscene");
    // Cycle 3 / D17: canvas touch/drag now orbits the free camera, never
    // movement — a tap (zero-distance touchstart/touchend, no intermediate
    // move) produces no orbit delta and must NOT queue any movement input or
    // advance data-defense-input-seq. Movement stays exclusively D-pad/keyboard.
    const box = await page.locator("#defense-canvas").boundingBox();
    assert(box, "canvas must have bounds");
    const beforeTouch = Number(await surface.getAttribute("data-defense-input-seq"));
    const moveBeforeTouch = await surface.getAttribute("data-defense-move");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.waitForTimeout(100);
    assert.equal(Number(await surface.getAttribute("data-defense-input-seq")), beforeTouch, "canvas taps must not queue movement input (orbit/movement decoupled, D17)");
    assert.equal(await surface.getAttribute("data-defense-move"), moveBeforeTouch, "canvas taps must leave the public movement state unaffected");
    report.events.push("touch-canvas-no-movement");
    // Advance by the public battle clock rather than wall time: software WebGL
    // can render slowly in CI, while a frozen clock still fails promptly.
    const growthOffer = await waitForGrowthOfferThroughCutscenes(page, report, {
      noProgressTimeout: 15000,
      overallTimeout: 180000,
    });
    const selectedGrowthSkills = new Set();
    const maxImmediateGrowthSelections = 8;
    let growthOfferClosed = false;
    for (let selection = 0; selection < maxImmediateGrowthSelections; selection += 1) {
      const choices = await growthOffer.locator("button[data-pick]").evaluateAll((buttons) => buttons.map((button) => button.dataset.pick ?? ""));
      assert.ok(choices.length > 0, "a visible growth offer must contain a selectable real skill");
      assert.equal(new Set(choices).size, choices.length, "a growth offer must not repeat a selectable skill");
      choices.forEach((skill) => assert.match(skill, /\S/, "each growth choice must identify a real skill"));
      const skill = choices[0];
      assert.equal(selectedGrowthSkills.has(skill), false, "a selected growth skill must not be offered again");
      const offerKey = choices.join(",");
      await growthOffer.locator(`button[data-pick="${skill}"]`).click();
      selectedGrowthSkills.add(skill);
      report.events.push({ event: "growth-selected", skill });
      await page.evaluate(() => window.__pumpFrame?.(100));
      await page.waitForTimeout(0);
      await page.waitForFunction(({ offerKey, skill }) => {
        const status = document.querySelector("#battle-status")?.textContent ?? "";
        if (!status.includes("성장 선택 중")) return true;
        const nextOffer = document.querySelector("#defense-growth-offer");
        const nextChoices = [...nextOffer?.querySelectorAll("button[data-pick]") ?? []]
          .map((button) => button.dataset.pick ?? "");
        return Boolean(nextOffer) && (
          nextChoices.length === 0
          || (nextChoices.join(",") !== offerKey && !nextChoices.includes(skill))
        );
      }, { offerKey, skill });
      if (await growthOffer.isHidden()) {
        growthOfferClosed = true;
        break;
      }
      const nextChoices = await growthOffer.locator("button[data-pick]").count();
      if (nextChoices === 0) {
        assert.equal(selectedGrowthSkills.size, maxImmediateGrowthSelections, "an empty growth offer is valid only after every skill is owned");
        await growthOffer.waitFor({ state: "hidden" });
        growthOfferClosed = true;
        break;
      }
    }
    assert.equal(growthOfferClosed, true, "growth selections must settle without leaving an unresolved offer");
    // Held-movement contract. Deliberately placed AFTER the growth journey.
    //
    // What it defends: app.js binds pointerdown/pointerup on #movement-actions.
    // onMoveControlDown sends MOVE <dir> and captures the pointer on the button,
    // onMoveControlEnd sends MOVE IDLE on pointerup, and onMoveControlClick
    // ignores anything with event.detail !== 0. A click() therefore emits MOVE W
    // and MOVE IDLE inside one event turn and holds nothing -- it cannot
    // distinguish a working held input from a broken one.
    //
    // The press uses hover() so it must land on a genuinely reachable control;
    // pressing "through" an overlay would not be a player action. The RELEASE is
    // a raw mouse.up(): the pressed button holds pointer capture, so pointerup
    // retargets to it and bubbles to #movement-actions without hit-testing a
    // control that may have been covered or reflowed out from under the cursor.
    //
    // WHY AFTER THE JOURNEY -- do not move this back above it. Holding W walks
    // the commander off the gate. The growth offer requires every normal enemy
    // dead (defense-run-simulation.js:1579-1583), which lets the elite spawn
    // (:1886-1889), whose death sets echoRecovery.completed (:1314); the offer
    // needs both (:2004-2009). Lose the gate and no offer is ever created, so
    // the journey fails with the offer ABSENT rather than late -- no timeout
    // increase can fix that. A headless sweep on the seed this test uses
    // (2962819252) reached the offer at tick 2166 with no press, and produced no
    // offer at all for any of 21 press alignments across the first 10 simulation
    // seconds. Down here the offer has already been produced and consumed, so
    // the press has no downstream consumer and its tick alignment cannot matter.
    const readHeldMovement = () => surface.evaluate((node) => {
      const status = document.querySelector("#battle-status")?.textContent ?? "";
      const simulationSecondMatch = status.match(/시간\s+(\d+)초/);
      return {
        inputSeq: node.dataset.defenseInputSeq ?? null,
        move: node.dataset.defenseMove ?? null,
        simulationSecond: simulationSecondMatch ? Number(simulationSecondMatch[1]) : null,
        defenseState: node.dataset.defenseState ?? null,
      };
    });
    const beforePress = await readHeldMovement();
    assert.notEqual(beforePress.simulationSecond, null, "the public battle clock must be readable before a held movement command");
    // app.js send() early-returns once the run is terminal, which freezes both
    // the input sequence and the clock. Without this the hold below would
    // surface as an unexplained timeout instead of naming the real cause.
    assert.ok(
      !["victory", "defeat", "final_completion"].includes(beforePress.defenseState),
      `the held-movement contract needs a live battle; public state was ${String(beforePress.defenseState)}`,
    );
    // Held movement without the keypad: press and HOLD a west drag on the stick. The button that
    // used to be hovered here is retired, and the stick is the control that owns a held direction —
    // pointer capture keeps the hold alive exactly as the button press did.
    const padBox = await page.locator("#movement-actions [data-joystick]").boundingBox();
    assert(padBox, "the drag stick must have bounds before a held movement command");
    const padCentre = { x: padBox.x + padBox.width / 2, y: padBox.y + padBox.height / 2 };
    await page.mouse.move(padCentre.x, padCentre.y);
    await page.mouse.down();
    await page.mouse.move(padCentre.x - padBox.width * 0.36, padCentre.y, { steps: 4 });
    let heldMovement = null;
    try {
      await page.waitForFunction(
        (previousInputSequence) => {
          const dataset = document.querySelector("#defense-battle-surface")?.dataset;
          return dataset?.defenseInputSeq !== previousInputSequence && dataset?.defenseMove === "W";
        },
        beforePress.inputSeq,
        { timeout: 5000 },
      );
      const afterPress = await readHeldMovement();
      await page.evaluate(() => {
        for (let index = 0; index < 12; index += 1) window.__pumpFrame?.(100);
      });
      // Hold past a public simulation-second boundary. The predicate runs in the
      // page (per animation frame), so the hold cannot overshoot by whatever a
      // Node-side observation gap happens to be on a slow runner.
      await page.waitForFunction(
        (target) => {
          const status = document.querySelector("#battle-status")?.textContent ?? "";
          const match = status.match(/시간\s+(\d+)초/);
          return Boolean(match) && Number(match[1]) >= target;
        },
        afterPress.simulationSecond + 1,
        { timeout: 15000 },
      );
      const duringHold = await readHeldMovement();
      // The command must SURVIVE the boundary: this is what a click() cannot do.
      assert.equal(duringHold.move, "W", "a held direction must still be the public movement command after a simulation-second boundary");
      assert.equal(
        duringHold.inputSeq,
        afterPress.inputSeq,
        "holding a direction must not re-queue input; the original command stays in force until release",
      );
      heldMovement = { afterPress, duringHold };
    } finally {
      await page.mouse.up();
    }
    await page.waitForFunction(
      (previousInputSequence) => {
        const dataset = document.querySelector("#defense-battle-surface")?.dataset;
        return dataset?.defenseInputSeq !== previousInputSequence && dataset?.defenseMove === "IDLE";
      },
      heldMovement.duringHold.inputSeq,
      { timeout: 5000 },
    );
    const afterRelease = await readHeldMovement();
    assert.equal(afterRelease.move, "IDLE", "releasing a held direction must return the public movement state to idle");
    report.events.push({
      event: "held-movement-command",
      move: "W",
      pressedAtSimulationSecond: heldMovement.afterPress.simulationSecond,
      releasedAtSimulationSecond: afterRelease.simulationSecond,
      heldSimulationSeconds: afterRelease.simulationSecond - heldMovement.afterPress.simulationSecond,
      inputSeq: {
        beforePress: beforePress.inputSeq,
        afterPress: heldMovement.afterPress.inputSeq,
        afterRelease: afterRelease.inputSeq,
      },
    });
    // This test (unlike the portrait/landscape .cjs tests, which deliberately
    // force the Canvas2D fallback to test that path) does NOT stub WebGL2 —
    // by this point in the playthrough many real frames have rendered.
    // app.js's render() try/catch means a WebGL renderer that throws on ANY
    // frame silently swaps to BattleVisualizer with no visible test failure;
    // this is the one automated check that the real three.js WebGL path
    // actually rendered a live playthrough without crashing, not just that
    // getContext("webgl2") succeeded at mount time.
    assert.equal(await surface.getAttribute("data-defense-renderer"), "webgl", "the real WebGL renderer must survive a full playthrough without silently failing over to the Canvas2D fallback");
    report.events.push("webgl-renderer-confirmed-active");
    assert.deepEqual(report.errors, [], "visible journey emitted unexpected page or console errors");
    return report;
  } finally {
    await context.close();
  }
}

/**
 * World HUD overlay regression coverage (Bug #1, #2, #4). Seeds a real
 * companion loadout, starts a real battle, and drives the live simulation
 * loop entirely from inside the page (clicking through growth offers and
 * dismissing the stage-entry cutscene as they appear — both otherwise pause
 * tick advancement, see defense-run-simulation.js's advanceDefenseRun()
 * growthOffer early-break) until either: (a) a companion nameplate has
 * rendered with a real on-screen transform and at least two floating damage
 * numbers with distinct computed positions have been observed (proving Bug #1
 * and Bug #2 stay fixed), and (b) the elite capture prompt has appeared once
 * an elite candidate + this stage's fixed extraction zone exist (Bug #4 /
 * "reasonably scoped" acceptance item). The prompt intentionally distinguishes
 * the pre-bind "Bind 대기" state from the actionable "추출 가능" state; the
 * action button's disabled state must agree with that copy.
 */
async function verifyWorldHudOverlay(browser, hosting, campaign) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  // Same runner slowdown `:329-335` documents (rafMean ~95.8 ms in CI against ~16 ms
  // locally, ~6x). Stock 30 s was measured failing here on `d34a3d30`:
  // `locator.click: Timeout 30000ms exceeded` at `#start-defense`. A per-suite default is
  // a property of the RUNNER, not of each function, so every context in this file carries it.
  context.setDefaultTimeout(90_000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  try {
    await page.addInitScript(({ encoded, key }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      localStorage.setItem(key, encoded);
    }, { encoded: campaign.encoded, key: STORAGE_KEY });
    // Install a controllable requestAnimationFrame BEFORE the app boots so the
    // battle loop's game-time is driven by explicit frame pumps, not the CI
    // runner's real frame rate. BattleSession.loop (app.js) is the ONLY rAF
    // consumer in the app (DefenseViewport is purely event-driven; RealtimeBattle
    // is rendered synchronously from inside loop(), never self-scheduled), and it
    // derives simulation game-time solely from the rAF-supplied timestamp,
    // clamped to elapsed = min(100, frameDuration) ms per frame. By QUEUEING rAF
    // callbacks and firing them from __pumpFrame() against a synthetic clock that
    // advances a fixed 100 ms per pump, every pump advances EXACTLY 100 ms of
    // game-time no matter how long the frame really takes to render — see the
    // drive loop below for why the old fixed 32 s wall-clock budget was
    // unreachable on a slow software-WebGL CI runner.
    await page.addInitScript(() => {
      const queue = new Map();
      let nextId = 1;
      let syntheticNow = 0;
      window.requestAnimationFrame = (callback) => {
        const id = nextId++;
        queue.set(id, callback);
        return id;
      };
      window.cancelAnimationFrame = (id) => { queue.delete(id); };
      // Snapshot + clear BEFORE invoking so a callback re-registering itself
      // (loop() does `this.frame = requestAnimationFrame(this.loop)`) lands in
      // the NEXT pump, guaranteeing exactly one loop() call per pump.
      window.__pumpFrame = (deltaMs) => {
        syntheticNow += deltaMs;
        const pending = [...queue.values()];
        queue.clear();
        for (const callback of pending) callback(syntheticNow);
        return syntheticNow;
      };
    });
    await page.goto("/campaign.html", { waitUntil: "domcontentloaded" });
    await page.locator("#start-defense").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor({ state: "attached" });

    // Drive the deterministic clock from the test, but every game command remains a
    // normal browser control interaction. Commander auto-attacks are intentionally
    // retired, so a clock-only run can no longer clear the gate-defense wave.
    await page.evaluate(() => {
      const overlay = document.querySelector("#world-hud-overlay");
      if (!overlay) throw new Error("world HUD overlay missing");
      window.__worldHudDamageSamples = [];
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement) || !node.classList.contains("world-damage-number")) continue;
            const rise = node.querySelector(".world-damage-number-rise");
            window.__worldHudDamageSamples.push({
              computedTransform: getComputedStyle(node).transform,
              inlineTransform: node.style.transform,
              riseText: rise?.textContent ?? null,
              eventId: node.dataset.defenseEventId ?? null,
              eventType: node.dataset.defenseEventType ?? null,
            });
          }
        }
      });
      observer.observe(overlay, { childList: true });
      window.__stopWorldHudDamageObserver = () => observer.disconnect();
    });
    const readWorldHud = () => page.evaluate(() => {
      const overlay = document.querySelector("#world-hud-overlay");
      const prompt = overlay?.querySelector(".world-capture-prompt");
      const extractAction = document.querySelector("#extract-elite");
      const nameplate = overlay?.querySelector("[data-world-nameplate]");
      return {
        nameplateCount: overlay?.querySelectorAll("[data-world-nameplate]").length ?? 0,
        damageSamples: window.__worldHudDamageSamples ?? [],
        nameplateTransform: nameplate?.style.transform ?? null,
        promptText: prompt?.textContent?.trim() ?? null,
        promptState: extractAction ? {
          disabled: extractAction.disabled,
          ariaDisabled: extractAction.getAttribute("aria-disabled"),
        } : null,
        battleState: document.querySelector("#defense-battle-surface")?.dataset.defenseState ?? null,
        stageId: document.querySelector("#defense-battle-surface")?.dataset.stageId ?? null,
        objectivePhase: document.querySelector("#defense-battle-surface")?.dataset.objectivePhase ?? null,
        status: document.querySelector("#battle-status")?.textContent?.trim() ?? null,
      };
    });
    // Mirror the public command stream with the same deterministic simulation.
    // The browser still owns the live run; this mirror only selects legal native
    // controls from the authored objective and exact direct-combat reach rules.
    await page.evaluate(async (runOptions) => {
      const { createDefenseRun, advanceDefenseRun, getRunSnapshot, queueInput } = await import("/defense-run-simulation.js");
      const { DIRECT_COMBAT, OCTANT_VECTORS } = await import("/defense-catalog.js");
      const nearestLivingEnemy = (snapshot) => {
        const distance = (entry) => (entry.x - snapshot.commander.x) ** 2 + (entry.y - snapshot.commander.y) ** 2;
        return snapshot.enemies.filter((enemy) => enemy.hp > 0).sort((left, right) => distance(left) - distance(right))[0] ?? null;
      };
      let bindingRoute = false;
      const objectiveTarget = (snapshot) => {
        const boss = snapshot.enemies.find((enemy) => enemy.class === "boss" && enemy.hp > 0) ?? null;
        if (boss) return boss;
        if (bindingRoute) return snapshot.tactics.extraction ?? snapshot.tactics.occupation;
        return nearestLivingEnemy(snapshot)
          ?? (snapshot.objectives.phase === "occupation" ? snapshot.tactics.occupation : null)
          ?? (snapshot.objectives.phase === "extraction" ? snapshot.tactics.extraction : null);
      };
      const objectiveOctant = (snapshot) => {
        const target = objectiveTarget(snapshot);
        if (!target) return "IDLE";
        const dx = target.x - snapshot.commander.x;
        const dy = target.y - snapshot.commander.y;
        if (target.radius && Math.hypot(dx, dy) < target.radius * 0.5) return "IDLE";
        const length = Math.hypot(dx, dy) || 1;
        let best = "IDLE";
        let bestDot = -Infinity;
        for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
          if (name === "IDLE") continue;
          const vectorLength = Math.hypot(vector.x, vector.y) || 1;
          const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
          if (dot > bestDot) { bestDot = dot; best = name; }
        }
        return best;
      };
      const canQueueDirectLight = (snapshot) => {
        if (snapshot.commander.verbState !== "IDLE") return false;
        const reach = DIRECT_COMBAT.light[0].reach;
        const boss = snapshot.enemies.find((enemy) => enemy.class === "boss" && enemy.hp > 0);
        const targets = boss ? [boss] : snapshot.enemies.filter((enemy) => enemy.hp > 0);
        return targets.some((enemy) => (enemy.x - snapshot.commander.x) ** 2 + (enemy.y - snapshot.commander.y) ** 2
          <= (snapshot.commander.radius + enemy.radius + reach) ** 2);
      };
      const canQueueDash = (snapshot) => {
        const boss = snapshot.enemies.find((enemy) => enemy.class === "boss" && enemy.hp > 0);
        if (!boss || snapshot.commander.verbState !== "IDLE" || snapshot.commander.dashCharges <= 0
          || objectiveOctant(snapshot) === "IDLE") return false;
        const reach = snapshot.commander.radius + boss.radius + DIRECT_COMBAT.light[0].reach;
        return (boss.x - snapshot.commander.x) ** 2 + (boss.y - snapshot.commander.y) ** 2 > reach ** 2;
      };
      let run = createDefenseRun(runOptions);
      const evidence = {
        acceptedDirectAttacks: 0, bossContacted: false, bossMeleeImpactEventIds: new Set(), rejectedDirectAttacks: [], rejectedDashes: [], bossIds: new Set(),
        growthSelections: [],
      };
      const inspect = () => {
        const snapshot = getRunSnapshot(run);
        for (const enemy of snapshot.enemies) {
          if (enemy.class === "boss" && enemy.hp > 0) evidence.bossIds.add(enemy.id);
        }
        return snapshot;
      };
      const queuedInputs = [];
      const extractionState = (snapshot) => {
        const extraction = snapshot.tactics.extraction ?? null;
        const liveEnemies = snapshot.enemies.filter((enemy) => enemy.hp > 0);
        const liveEnemyInZoneCount = extraction
          ? liveEnemies.filter((enemy) => (enemy.x - extraction.x) ** 2 + (enemy.y - extraction.y) ** 2 <= extraction.radius ** 2).length
          : 0;
        const progress = snapshot.extractionProgress;
        return {
          phase: snapshot.objectives.phase,
          tick: snapshot.tick,
          hold: { ticks: progress.holdTicks, maxTicks: progress.maxHoldTicks },
          ready: progress.ready,
          completed: progress.completed,
          failed: progress.failed,
          expiry: {
            tick: progress.expiresAt,
            remainingTicks: progress.expiresAt === null ? null : progress.expiresAt - snapshot.tick,
          },
          commander: { x: snapshot.commander.x, y: snapshot.commander.y },
          extraction: extraction ? {
            id: extraction.id,
            x: extraction.x,
            y: extraction.y,
            radius: extraction.radius,
          } : null,
          liveEnemyCount: liveEnemies.length,
          liveEnemyInZoneCount,
        };
      };
      const queue = (type, payload) => {
        queuedInputs.push({ type, payload });
        run = queueInput(run, type, payload);
      };
      window.__survivorObjectiveRoute = {
        decide() {
          const snapshot = inspect();
          const bossDash = canQueueDash(snapshot) ? { type: "DASH", octant: objectiveOctant(snapshot) } : null;
          return {
            octant: objectiveOctant(snapshot),
            canQueueDirectLight: canQueueDirectLight(snapshot),
            canQueueDash: Boolean(bossDash),
            bossDash,
            growthOffer: Boolean(snapshot.growthOffer),
            extraction: extractionState(snapshot),
          };
        },
        queueMove: (octant) => queue("MOVE", octant),
        queueGrowth: (skillId) => {
          const offer = inspect().growthOffer;
          if (!offer) throw new Error(`native growth selection ${skillId} had no matching mirror offer at tick ${inspect().tick}`);
          evidence.growthSelections.push({ skillId, choices: offer.choices, tick: inspect().tick });
          queue("SKILL_SELECTED", { skillId });
          return true;
        },
        queueExtraction: () => {
          const candidate = inspect().eliteCandidate;
          if (candidate) queue("EXTRACT_ELITE", { enemyId: candidate.enemyId });
        },
        beginBinding: () => { bindingRoute = true; },
        queueDash: () => {
          const snapshot = inspect();
          if (!canQueueDash(snapshot)) return false;
          queue("DASH");
          return true;
        },
        queueLight: () => {
          const snapshot = inspect();
          if (!canQueueDirectLight(snapshot)) return false;
          queue("ATTACK_LIGHT");
          return true;
        },
        advance(ticks) {
          for (let tick = 0; tick < ticks; tick += 1) {
            run = advanceDefenseRun(run, 1);
            const snapshot = inspect();
            evidence.acceptedDirectAttacks += snapshot.events.filter((event) =>
              event.type === "INPUT_ACCEPTED" && event.inputType === "ATTACK_LIGHT").length;
            evidence.rejectedDirectAttacks.push(...snapshot.events.filter((event) =>
              event.type === "INPUT_REJECTED" && event.inputType === "ATTACK_LIGHT"
              && ["STALE_DIRECT_INPUT", "DIRECT_ACTION_OUT_OF_RANGE", "DIRECT_ACTION_NO_TARGET"].includes(event.reason)));
            evidence.rejectedDashes.push(...snapshot.events.filter((event) =>
              event.type === "INPUT_REJECTED" && event.inputType === "DASH"));
            if (snapshot.events.some((event) => event.type === "MELEE_IMPACT"
              && event.sourceId === "commander" && evidence.bossIds.has(event.targetId))) {
              evidence.bossContacted = true;
              snapshot.events
                .filter((event) => event.type === "MELEE_IMPACT" && event.sourceId === "commander"
                  && evidence.bossIds.has(event.targetId) && event.eventId)
                .forEach((event) => evidence.bossMeleeImpactEventIds.add(event.eventId));
            }
          }
        },
        evidence: () => {
          const snapshot = inspect();
          return {
            acceptedDirectAttacks: evidence.acceptedDirectAttacks,
            bossContacted: evidence.bossContacted,
            bossMeleeImpactEventIds: [...evidence.bossMeleeImpactEventIds],
            rejectedDirectAttacks: evidence.rejectedDirectAttacks,
            rejectedDashes: evidence.rejectedDashes,
            growthSelections: evidence.growthSelections,
            queuedInputs,
            phase: snapshot.objectives.phase,
            tick: snapshot.tick,
            level: snapshot.commander.level,
            extraction: extractionState(snapshot),
          };
        },
      };
      window.__survivorNativeInputs = [];
      window.__survivorNativeInputObserver = (event) => window.__survivorNativeInputs.push({
        ...event.detail,
        move: document.querySelector("#defense-battle-surface")?.dataset.defenseMove ?? null,
        skill: document.querySelector("#defense-battle-surface")?.dataset.defenseSkill ?? null,
      });
      window.addEventListener("abyssal:defense-input-feedback", window.__survivorNativeInputObserver);
    }, campaign.runOptions);
    const FRAME_MS = 100;
    const TICK_FRAME_MS = FRAME_MS / 6;
    const MAX_PUMPS = 2100;
    let mirrorAccumulator = 0;
    let mirrorFrameStarted = false;
    let initialCapturePromptText = null;
    let initialCapturePromptState = null;
    let extractionReadyPromptText = null;
    let holdingCapturePromptText = null;
    let extractionReadyPromptState = null;
    let bindStarted = false;
    let firstExtractionPhasePump = null;
    let worldHud = await readWorldHud();
    let pumps = 0;
    let extractionClaimed = false;
    let issuedLegalAttacks = 0;
    let heldMovementKeys = [];
    const movementKeys = {
      IDLE: [],
      N: ["w"],
      NE: ["w", "d"],
      E: ["d"],
      SE: ["s", "d"],
      S: ["s"],
      SW: ["s", "a"],
      W: ["a"],
      NW: ["w", "a"],
    };
    const heldOctant = () => {
      const vertical = heldMovementKeys.includes("w") ? "N" : heldMovementKeys.includes("s") ? "S" : "";
      const horizontal = heldMovementKeys.includes("a") ? "W" : heldMovementKeys.includes("d") ? "E" : "";
      return `${vertical}${horizontal}` || "IDLE";
    };
    const queueHeldMovement = () => page.evaluate((octant) => window.__survivorObjectiveRoute.queueMove(octant), heldOctant());
    const setMovementDirection = async (octant) => {
      const nextKeys = movementKeys[octant];
      assert.ok(nextKeys, `objective driver produced unsupported movement octant ${String(octant)}`);
      if (heldMovementKeys.join(",") === nextKeys.join(",")) return;
      for (const key of [...heldMovementKeys]) {
        await page.keyboard.up(key);
        heldMovementKeys = heldMovementKeys.filter((held) => held !== key);
        await queueHeldMovement();
      }
      for (const key of nextKeys) {
        await page.keyboard.down(key);
        heldMovementKeys.push(key);
        await queueHeldMovement();
      }
    };
    while (pumps < MAX_PUMPS) {
      const routeDecision = await page.evaluate(() => window.__survivorObjectiveRoute.decide());
      if (routeDecision.extraction.phase === "extraction") firstExtractionPhasePump ??= pumps;
      await setMovementDirection(routeDecision.octant);
      const cutsceneDismiss = page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
      if (await cutsceneDismiss.isVisible().catch(() => false)) await cutsceneDismiss.press("Enter");
      const growthOffer = page.locator("#defense-growth-offer");
      if (await growthOffer.isVisible().catch(() => false)) {
        const button = growthOffer.locator("button[data-pick]").first();
        if (await button.isVisible().catch(() => false)) {
          const skillId = await button.getAttribute("data-pick");
          assert.ok(skillId, "a native growth button must name its selected skill");
          await button.click();
          await page.evaluate((selectedSkillId) => window.__survivorObjectiveRoute.queueGrowth(selectedSkillId), skillId);
        }
      }

      worldHud = await readWorldHud();
      if (worldHud.promptText) {
        if (initialCapturePromptText === null) {
          initialCapturePromptText = worldHud.promptText;
          initialCapturePromptState = worldHud.promptState;
        }
        if (!bindStarted && worldHud.promptText.startsWith("Bind 대기") && worldHud.promptState
          && !worldHud.promptState.disabled && worldHud.promptState.ariaDisabled === "false") {
          await page.locator("#extract-elite").click();
          await page.evaluate(() => window.__survivorObjectiveRoute.queueExtraction());
          await page.evaluate(() => window.__survivorObjectiveRoute.beginBinding());
          bindStarted = true;
        }
        if (worldHud.promptText.startsWith("결속 홀드")) holdingCapturePromptText ??= worldHud.promptText;
        if (worldHud.promptText.startsWith("추출 가능")) {
          extractionReadyPromptText = worldHud.promptText;
          extractionReadyPromptState = worldHud.promptState;
          if (!extractionClaimed) {
            await page.locator("#extract-elite").click();
            await page.evaluate(() => window.__survivorObjectiveRoute.queueExtraction());
            extractionClaimed = true;
          }
        }
      }
      if (routeDecision.bossDash) {
        const queued = await page.evaluate(() => window.__survivorObjectiveRoute.queueDash());
        if (queued) await page.locator("#manual-dash").click();
      } else if (routeDecision.canQueueDirectLight) {
        const queued = await page.evaluate(() => window.__survivorObjectiveRoute.queueLight());
        if (queued) {
          await page.locator("#manual-attack").press("Enter");
          issuedLegalAttacks += 1;
        }
      }

      if (worldHud.nameplateTransform && worldHud.damageSamples.length >= 4
        && extractionReadyPromptText !== null && worldHud.battleState === "victory") break;
      await page.evaluate((deltaMs) => window.__pumpFrame(deltaMs), FRAME_MS);
      let mirrorTicks = 0;
      if (mirrorFrameStarted) {
        mirrorAccumulator += FRAME_MS;
        while (mirrorAccumulator >= TICK_FRAME_MS) {
          mirrorAccumulator -= TICK_FRAME_MS;
          mirrorTicks += 1;
        }
      } else {
        mirrorFrameStarted = true;
      }
      await page.evaluate((ticks) => window.__survivorObjectiveRoute.advance(ticks), mirrorTicks);
      pumps += 1;
      await page.waitForTimeout(0);
    }
    worldHud = await readWorldHud();
    for (const key of [...heldMovementKeys]) {
      await page.keyboard.up(key);
      heldMovementKeys = heldMovementKeys.filter((held) => held !== key);
      if (worldHud.battleState !== "victory") await queueHeldMovement();
    }
    const journeyEvidence = await page.evaluate(() => {
      window.__stopWorldHudDamageObserver?.();
      window.removeEventListener("abyssal:defense-input-feedback", window.__survivorNativeInputObserver);
      return {
        route: window.__survivorObjectiveRoute.evidence(),
        nativeInputs: window.__survivorNativeInputs,
      };
    });
    const drive = {
      nameplateTransform: worldHud.nameplateTransform,
      damageSamples: worldHud.damageSamples,
      initialCapturePromptText,
      initialCapturePromptState,
      holdingCapturePromptText,
      extractionReadyPromptText,
      extractionReadyPromptState,
      bindStarted,
      pumps,
      gameTimeMs: pumps * FRAME_MS,
      finalPromptText: worldHud.promptText,
      finalObjectivePhase: worldHud.objectivePhase,
      route: journeyEvidence.route,
      nativeInputs: journeyEvidence.nativeInputs,
      firstExtractionPhasePump,
      extraction: journeyEvidence.route.extraction,
      issuedLegalAttacks,
      liveMeleeImpactEventIds: [...new Set(worldHud.damageSamples
        .filter((sample) => sample.eventType === "MELEE_IMPACT" && sample.eventId)
        .map((sample) => sample.eventId))],
    };
    const liveCinderMeleeImpactFeedback = {
      eventIds: drive.liveMeleeImpactEventIds,
      mirrorBossEventIds: drive.route.bossMeleeImpactEventIds,
    };
    const nativeCommandStream = drive.nativeInputs
      .filter((input) => input.type === "MOVE" || input.type === "SKILL_SELECTED" || input.type === "EXTRACT_ELITE" || input.type === "ATTACK_LIGHT" || input.type === "DASH")
      .map((input) => ({
        type: input.type,
        payload: input.type === "MOVE" ? input.move : input.type === "SKILL_SELECTED" ? { skillId: input.skill } : null,
      }));
    const mirrorCommandStream = drive.route.queuedInputs
      .filter((input) => input.type === "MOVE" || input.type === "SKILL_SELECTED" || input.type === "EXTRACT_ELITE" || input.type === "ATTACK_LIGHT" || input.type === "DASH")
      .map((input) => ({ type: input.type, payload: input.type === "EXTRACT_ELITE" ? null : input.payload ?? null }));
    assert.deepEqual(nativeCommandStream, mirrorCommandStream, "the public native and mirror command streams must stay identical");

    // Bug #1 guard: the companion nameplate must have appeared with a real
    // on-screen pixel transform (never absent/never-appears, which is what
    // the world-unit heightOffset regression produced — visible stayed false
    // forever for an on-screen entity).
    assert.ok(drive.nameplateTransform, "a seeded companion's world-nameplate must render with a real transform during a live playthrough (Bug #1 guard)");
    assert.match(drive.nameplateTransform, /translate\(-?\d+(?:\.\d+)?px,\s*-?\d+(?:\.\d+)?px\)/, "the nameplate transform must be a real pixel translate, not a stale/empty value");

    // Bug #2 guard: at least two distinct floating damage numbers must have
    // rendered at genuinely different COMPUTED screen positions. Under the
    // bug, the outer element's computed transform was always pinned to the
    // overlay's origin regardless of hit location (the co-animated CSS
    // transform replaced the whole computed value), so every sample would
    // collapse to the same computed transform string.
    assert.ok(drive.damageSamples.length >= 2, `expected at least 2 floating damage numbers during a live playthrough, saw ${drive.damageSamples.length}`);
    for (const sample of drive.damageSamples) {
      assert.notEqual(sample.computedTransform, "none", "a rendered damage number must carry a real computed transform, not the CSS initial value");
      assert.match(sample.riseText ?? "", /^-\d+$/, "the inner .world-damage-number-rise span must carry the '-<damage>' text");
    }
    const distinctComputedTransforms = new Set(drive.damageSamples.map((sample) => sample.computedTransform));
    assert.ok(
      distinctComputedTransforms.size >= 2,
      `damage numbers must render at distinct computed screen positions across different hits, saw only ${distinctComputedTransforms.size} distinct computed transform(s) across ${drive.damageSamples.length} samples: ${JSON.stringify([...distinctComputedTransforms])}`,
    );

    // Bug #4 guard: the prompt starts in an explicit pre-bind state and, after
    // the player activates that route, reaches the actionable extraction-ready
    // state. Both states must name the real seeded elite companion prototype.
    assert.ok(drive.initialCapturePromptText, `the elite capture prompt must appear once an elite candidate and extraction zone exist (Bug #4 guard); final public state: ${JSON.stringify({ stageId: worldHud.stageId, battleState: worldHud.battleState, objectivePhase: worldHud.objectivePhase, status: worldHud.status, nameplateCount: worldHud.nameplateCount, damageSamples: drive.damageSamples.length, liveMeleeImpactCount: drive.liveMeleeImpactEventIds.length, pumps: drive.pumps, firstExtractionPhasePump: drive.firstExtractionPhasePump, extraction: drive.extraction, issuedLegalAttacks: drive.issuedLegalAttacks, route: drive.route, nativeInputTypes: drive.nativeInputs.map((input) => input.type) })}`);
    assert.match(drive.initialCapturePromptText, /^(?:Bind 대기|결속 홀드 \d+\/\d+초|추출 가능) · Ember Cohort$/, "the initial capture prompt must expose the real companion name and an explicit bind/extraction state");
    assert.ok(drive.initialCapturePromptState, "the initial capture prompt must have a matching extraction action");
    const initiallyReady = drive.initialCapturePromptText.startsWith("추출 가능");
    assert.equal(drive.initialCapturePromptState.disabled, false, "the extraction route CTA must be enabled before Bind starts or once extraction is ready");
    assert.equal(drive.initialCapturePromptState.ariaDisabled, "false", "the extraction route CTA aria-disabled state must be false before Bind starts or once extraction is ready");
    if (!initiallyReady) assert.equal(drive.bindStarted, true, "the enabled Bind CTA must be activated exactly once before waiting for extraction readiness");
    assert.ok(drive.holdingCapturePromptText, "the elite capture prompt must expose the active hold state after the Bind route starts");
    assert.match(drive.holdingCapturePromptText, /^결속 홀드 \d+\/\d+초 · Ember Cohort$/, "the active hold prompt must expose deterministic progress and the real companion name");
    assert.ok(drive.extractionReadyPromptText, `the elite extraction-ready prompt must appear after the Bind hold completes (Bug #4 guard); drive: ${JSON.stringify({ initialCapturePromptText: drive.initialCapturePromptText, holdingCapturePromptText: drive.holdingCapturePromptText, finalPromptText: drive.finalPromptText, finalObjectivePhase: drive.finalObjectivePhase, pumps: drive.pumps, firstExtractionPhasePump: drive.firstExtractionPhasePump, extraction: drive.extraction })}`);
    assert.match(drive.extractionReadyPromptText, /^추출 가능 · Ember Cohort$/, "the elite capture prompt must reach the concrete Korean extraction-ready CTA with the real companion name");
    assert.ok(drive.extractionReadyPromptState, "the extraction-ready prompt must have a matching extraction action");
    assert.equal(drive.extractionReadyPromptState.disabled, false, "the extraction-ready CTA must remain enabled");
    assert.equal(drive.extractionReadyPromptState.ariaDisabled, "false", "the extraction-ready CTA aria-disabled state must be false");
    assert.equal(extractionClaimed, true, "the native extraction CTA must be activated after Bind completes");
    assert.ok(
      pumps < MAX_PUMPS || worldHud.battleState === "victory",
      `the ${MAX_PUMPS}-pump cap was exhausted without victory; final public state/route: ${JSON.stringify({ pumps, stageId: worldHud.stageId, battleState: worldHud.battleState, objectivePhase: worldHud.objectivePhase, status: worldHud.status, promptText: worldHud.promptText, route: { phase: drive.route.phase, tick: drive.route.tick, bossContacted: drive.route.bossContacted, extraction: drive.route.extraction } })}`,
    );
    assert.equal(worldHud.battleState, "victory", "the live Cinder journey must finish in victory");
    assert.ok(drive.route.acceptedDirectAttacks > 0, "the objective-aware driver must queue at least one legal direct-light attack");
    assert.equal(drive.route.bossContacted, true, "the objective-aware driver must bring the commander into direct-light contact with the Cinder boss");
    assert.deepEqual(drive.route.rejectedDirectAttacks, [], `the route must not queue stale or out-of-range direct light: ${JSON.stringify(drive.route.rejectedDirectAttacks)}`);
    assert.deepEqual(drive.route.rejectedDashes, [], `the boss-approach dashes must be legal: ${JSON.stringify(drive.route.rejectedDashes)}`);
    assert.ok(liveCinderMeleeImpactFeedback.eventIds.length > 0 && liveCinderMeleeImpactFeedback.mirrorBossEventIds.length > 0, `the live HUD must render unique MELEE_IMPACT feedback for the Cinder boss contact: ${JSON.stringify(liveCinderMeleeImpactFeedback)}`);
    assert.ok(drive.nativeInputs.some((input) => input.type === "MOVE"), "the route must use a native movement control");
    assert.ok(drive.nativeInputs.some((input) => input.type === "ATTACK_LIGHT"), "the route must use the native direct-light control");
    assert.ok(drive.nativeInputs.some((input) => input.type === "DASH"), "the route must use the native boss-approach dash control");
    assert.ok(
      drive.nativeInputs.filter((input) => input.type === "MOVE" || input.type === "ATTACK_LIGHT" || input.type === "DASH")
        .every((input) => Number.isInteger(input.inputSeq) && input.inputSeq > 0),
      "native movement, direct-light, and dash feedback must retain their public input ids",
    );

    assert.deepEqual(errors, [], "world HUD overlay journey emitted unexpected page or console errors");
    return {
      nameplateTransform: drive.nameplateTransform,
      damageSampleCount: drive.damageSamples.length,
      distinctDamagePositions: distinctComputedTransforms.size,
      initialCapturePromptText: drive.initialCapturePromptText,
      initialCapturePromptState: drive.initialCapturePromptState,
      holdingCapturePromptText: drive.holdingCapturePromptText,
      extractionReadyPromptText: drive.extractionReadyPromptText,
      extractionReadyPromptState: drive.extractionReadyPromptState,
      bindStarted: drive.bindStarted,
      pumps: drive.pumps,
      firstExtractionPhasePump: drive.firstExtractionPhasePump,
      extraction: drive.extraction,
      route: drive.route,
      gameTimeMs: drive.gameTimeMs,
    };
  } finally {
    await context.close();
  }
}

/**
 * Bug #3 guard (boss mesh resolution): direct scene-graph inspection, not a
 * weaker DOM/event proxy. app.js exposes no debug hook for its live
 * BattleSession/RealtimeBattle instance, so this constructs an independent
 * RealtimeBattle against a fresh off-DOM canvas inside the SAME page/origin
 * (so the "three" import-map specifier and the real GLB asset resolve
 * correctly), drives the real defense-run-simulation.js state machine
 * headlessly (pure computation, no wall-clock wait) until a live boss
 * enemy exists, feeds that real simulation-produced snapshot through the
 * exact renderSnapshot()/reconcileActors() code path the bug lived in, and
 * inspects renderer.actors directly for the loaded boss record. The guard
 * verifies the real boss model path and that its GLTF scene root contains mesh
 * geometry, which catches a missing or fallback actor without assuming an
 * authored node name. This is strictly stronger evidence than any DOM/event
 * signal could give, and was chosen over driving a full live UI playthrough to
 * the boss, which requires completing a two-phase occupation+extraction hold
 * sequence without additional coverage of the actual bug.
 */
async function verifyBossMeshRegression(browser, hosting) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  // Same runner slowdown `:329-335` documents (rafMean ~95.8 ms in CI against ~16 ms
  // locally, ~6x). Stock 30 s was measured failing here on `d34a3d30`:
  // `locator.click: Timeout 30000ms exceeded` at `#start-defense`. A per-suite default is
  // a property of the RUNNER, not of each function, so every context in this file carries it.
  context.setDefaultTimeout(90_000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  try {
    await page.goto("/campaign.html", { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async () => {
      const sim = await import("/defense-run-simulation.js");
      const { ARENA, DIRECT_COMBAT, OCTANT_VECTORS } = await import("/defense-catalog.js");
      const { RealtimeBattle } = await import("/battle-realtime-three.js");
      const { createDefenseRun, advanceDefenseRun, getRunSnapshot, isTerminalRun, queueInput } = sim;

      function nearestLivingEnemy(snapshot) {
        const distance = (entry) => (entry.x - snapshot.commander.x) ** 2 + (entry.y - snapshot.commander.y) ** 2;
        return snapshot.enemies
          .filter((enemy) => enemy.hp > 0)
          .sort((left, right) => distance(left) - distance(right))[0] ?? null;
      }

      function objectiveTarget(snapshot) {
        const living = nearestLivingEnemy(snapshot);
        if (living) return living;
        if (snapshot.objectives.phase === "occupation") return snapshot.tactics.occupation;
        if (snapshot.objectives.phase === "extraction") return snapshot.tactics.extraction;
        return null;
      }

      function objectiveOctant(snapshot) {
        const target = objectiveTarget(snapshot);
        if (!target) return "IDLE";
        const dx = target.x - snapshot.commander.x;
        const dy = target.y - snapshot.commander.y;
        if (target.radius && Math.hypot(dx, dy) < target.radius * 0.5) return "IDLE";
        let best = "IDLE";
        let bestDot = -Infinity;
        const length = Math.hypot(dx, dy) || 1;
        for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
          if (name === "IDLE") continue;
          const vectorLength = Math.hypot(vector.x, vector.y) || 1;
          const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
          if (dot > bestDot) { bestDot = dot; best = name; }
        }
        return best;
      }

      function canQueueDirectLight(snapshot) {
        if (snapshot.commander.verbState !== "IDLE") return false;
        const reach = DIRECT_COMBAT.light[0].reach;
        return snapshot.enemies.some((enemy) => {
          if (enemy.hp <= 0) return false;
          const contactDistance = snapshot.commander.radius + enemy.radius + reach;
          return (enemy.x - snapshot.commander.x) ** 2 + (enemy.y - snapshot.commander.y) ** 2 <= contactDistance ** 2;
        });
      }

      function step(run) {
        const snapshot = getRunSnapshot(run);
        if (snapshot.growthOffer) {
          return advanceDefenseRun(queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] }), 1);
        }
        let next = queueInput(run, "MOVE", { octant: objectiveOctant(snapshot) });
        if (canQueueDirectLight(snapshot)) next = queueInput(next, "ATTACK_LIGHT");
        if (snapshot.eliteCandidate && !snapshot.extracted) next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
        return advanceDefenseRun(next, 1);
      }

      const MAX_BOSS_TICKS = 24000;
      let run = createDefenseRun({ stageId: "cinder-span", seed: 2962819252, companionLoadout: ["ember-cohort"] });
      let snapshot = getRunSnapshot(run);
      let boss = null;
      let acceptedDirectAttacks = 0;
      let meleeImpacts = 0;
      let rejectedDirectAttacks = [];
      for (let i = 0; i < MAX_BOSS_TICKS && !isTerminalRun(run); i += 1) {
        run = step(run);
        snapshot = getRunSnapshot(run);
        acceptedDirectAttacks += snapshot.events.filter((event) =>
          event.type === "INPUT_ACCEPTED" && event.inputType === "ATTACK_LIGHT").length;
        meleeImpacts += snapshot.events.filter((event) => event.type === "MELEE_IMPACT").length;
        rejectedDirectAttacks.push(...snapshot.events.filter((event) =>
          event.type === "INPUT_REJECTED" && event.inputType === "ATTACK_LIGHT"
          && ["STALE_DIRECT_INPUT", "DIRECT_ACTION_OUT_OF_RANGE", "DIRECT_ACTION_NO_TARGET"].includes(event.reason)));
        boss = snapshot.enemies.find((enemy) => enemy.class === "boss" && enemy.hp > 0);
        if (boss) break;
      }
      if (!boss) return { error: `no active boss appeared within the ${MAX_BOSS_TICKS}-tick simulated budget (final tick ${snapshot.tick}, terminal=${String(isTerminalRun(run))})` };

      const project = (entity) => ({ ...entity, x: (entity.x / ARENA.width) * 2 - 1, y: (entity.y / ARENA.height) * 2 - 1 });
      const projected = {
        ...snapshot,
        presentation: { stageId: "cinder-span" },
        commander: project(snapshot.commander),
        enemies: snapshot.enemies.map(project),
        companions: snapshot.companions.map(project),
      };

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      document.body.appendChild(canvas);
      const renderer = new RealtimeBattle().mount({ canvas, viewport: canvas });
      if (!renderer.renderer) return { error: "RealtimeBattle did not expose a WebGL renderer after mount -- cannot exercise the GLB mesh-resolution code path" };
      renderer.renderSnapshot(projected, {});

      const expectedModelPath = "assets/mesh/boss/s1-cinder-warden/glb/base_basic_pbr.glb";
      const expectedGlbPath = "assets/mesh/boss/s1-cinder-warden/glb/base_basic_pbr.glb";
      const actorKeys = () => (renderer.actors && typeof renderer.actors.keys === "function" ? [...renderer.actors.keys()] : []);
      // Wait on the record's own SETTLED state, not on the clock. ensureActor()
      // clears `loading` on BOTH the success path (root assigned in the same
      // synchronous .then() block) and the failure path (.catch() leaves root
      // null), so `loading === false` is a real readiness signal and `root`
      // discriminates success from failure. A genuinely missing/404/corrupt GLB
      // therefore fails in tens of milliseconds (measured: 26ms for 404 and for
      // a corrupt body, 45ms for an aborted request) instead of burning the
      // whole budget -- the deadline below is only a backstop for a fetch that
      // never settles at all.
      //
      // That backstop is renderer-aware, following tests/defense-performance-browser.cjs's
      // precedent of branching budgets on software-WebGL detection. Under
      // SwiftShader/llvmpipe the GLTF parse, texture decode and material
      // compile all contend with software rasterization on the one main
      // thread, so this 4MB boss GLB is legitimately slower to become
      // renderable: measured ~0.13s on hardware vs ~2.9s under SwiftShader
      // unthrottled, and ~1.5s vs ~14.9s with the main thread throttled 4x to
      // model a 2-core CI runner (~16.9s at 8x). The hardware bound stays at
      // 10s so a real regression on a normal GPU still fails fast; the
      // software bound clears the worst measured cost with margin. Detection
      // reads the renderer instance's own `softwareRenderer` field (set from
      // detectSoftwareWebGL() at mount) rather than the canvas renderScale
      // proxy the performance gate uses -- this off-DOM 320x180 canvas is
      // below SOFTWARE_MAX_BACKBUFFER_PX, so its renderScale stays 1 (and is
      // in fact never set) even under SwiftShader.
      const softwareRenderer = renderer.softwareRenderer === true;
      const readinessBudgetMs = softwareRenderer ? 45000 : 10000;
      const startedAt = performance.now();
      const entry = await new Promise((resolve) => {
        const deadline = startedAt + readinessBudgetMs;
        const poll = () => {
          const candidate = renderer.actors?.get?.(boss.id);
          if (candidate?.loading === false || performance.now() >= deadline) {
            resolve(candidate ?? null);
            return;
          }
          setTimeout(poll, 25);
        };
        poll();
      });
      const readyMs = Math.round(performance.now() - startedAt);
      if (!entry || entry.loading || !entry.root) {
        const settled = entry?.loading === false;
        const cause = settled
          ? `its GLB load settled without producing a root after ${readyMs}ms (fetch/parse failed)`
          : `its GLB load never settled within the ${readinessBudgetMs}ms ${softwareRenderer ? "software-WebGL" : "hardware-WebGL"} backstop (${readyMs}ms elapsed)`;
        return {
          error: `renderer.actors has no loaded root for live boss id ${boss.id} -- ${cause}; expected GLB ${expectedGlbPath}`,
          bossId: boss.id,
          bossHp: boss.hp,
          bossTick: snapshot.tick,
          actorKeys: actorKeys(),
          expectedModelPath,
          modelPath: entry?.modelPath ?? null,
          rootName: entry?.root?.name ?? null,
          softwareRenderer,
          readinessBudgetMs,
          readyMs,
          settled,
        };
      }
      let meshDescendantCount = 0;
      entry.root.traverse((node) => {
        if (node.isMesh || node.isSkinnedMesh) meshDescendantCount += 1;
      });
      return {
        bossId: boss.id,
        bossHp: boss.hp,
        bossTick: snapshot.tick,
        bossActive: boss.hp > 0,
        terminalAtBoss: isTerminalRun(run),
        acceptedDirectAttacks,
        meleeImpacts,
        rejectedDirectAttacks,
        modelPath: entry.modelPath,
        rootName: entry.root.name,
        meshDescendantCount,
        expectedModelPath,
        expectedGlbPath,
        softwareRenderer,
        readinessBudgetMs,
        readyMs,
      };
    });

    assert.equal(result.error, undefined, `boss mesh regression check failed: ${result.error}`);
    assert.equal(result.bossActive, true, "the fixture must reach a living boss rather than merely exhaust its tick budget");
    assert.equal(result.terminalAtBoss, false, "the fixture must reach the boss before the run becomes terminal");
    assert.ok(
      result.acceptedDirectAttacks > 0 || result.meleeImpacts > 0,
      `the isolated progression driver must resolve at least one legal direct-light contact, saw ${result.acceptedDirectAttacks} accepted inputs and ${result.meleeImpacts} MELEE_IMPACT events`,
    );
    assert.deepEqual(
      result.rejectedDirectAttacks,
      [],
      `the isolated progression driver must not queue stale or out-of-range direct-light input: ${JSON.stringify(result.rejectedDirectAttacks)}`,
    );
    assert.equal(result.modelPath, result.expectedModelPath, "the boss must resolve its model path from the authored BOSS_MODELS table");
    assert.ok(result.meshDescendantCount > 0, `the boss's cloned scene-graph object must contain real mesh geometry, found ${result.meshDescendantCount} mesh descendants`);
    assert.deepEqual(errors, [], "boss mesh regression check emitted unexpected page or console errors");
    return result;
  } finally {
    await context.close();
  }
}

/**
 * Stance-switch feedback coverage (control-feel-20260725.md §2.2/§2.3). The
 * 3-stance selector IS the defense↔offense transition — the player's single
 * most important real-time decision. A REJECTED (cooldown) tap has long shown a
 * visible shake (.is-blocked), but a SUCCESSFUL switch landed with only the
 * STANCE_SWITCHED audio cue + a silent glyph swap; this pass adds a static held
 * glow (.is-switched) so success gets at least equal feedback. Both feedback
 * paths are pure app.js render() reactions to sim-emitted STANCE_SWITCHED /
 * STANCE_SWITCH_BLOCKED events — this exercises that real render path end to
 * end (click -> queued input -> sim tick -> event -> DOM class), which no
 * node-only test can (the class is set from performance.now() deadlines in the
 * live render loop). Uses the same deterministic frame-pump harness as
 * verifyWorldHudOverlay so tick advancement is a function of pump count, not
 * the CI runner's real frame rate.
 */
async function verifyStanceSwitchFeedback(browser, hosting, campaign) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  // Same runner slowdown `:329-335` documents (rafMean ~95.8 ms in CI against ~16 ms
  // locally, ~6x). Stock 30 s was measured failing here on `d34a3d30`:
  // `locator.click: Timeout 30000ms exceeded` at `#start-defense`. A per-suite default is
  // a property of the RUNNER, not of each function, so every context in this file carries it.
  context.setDefaultTimeout(90_000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  try {
    await page.addInitScript(({ encoded, key }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      localStorage.setItem(key, encoded);
    }, { encoded: campaign.encoded, key: STORAGE_KEY });
    await page.addInitScript(() => {
      const queue = new Map();
      let nextId = 1;
      let syntheticNow = 0;
      window.requestAnimationFrame = (callback) => { const id = nextId++; queue.set(id, callback); return id; };
      window.cancelAnimationFrame = (id) => { queue.delete(id); };
      window.__pumpFrame = (deltaMs) => {
        syntheticNow += deltaMs;
        const pending = [...queue.values()];
        queue.clear();
        for (const callback of pending) callback(syntheticNow);
        return syntheticNow;
      };
    });
    await page.goto("/campaign.html", { waitUntil: "domcontentloaded" });
    await page.locator("#start-defense").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor({ state: "attached" });

    // Drive to a "quiet" battle frame (cutscene dismissed, no growth offer up —
    // both pause tick advancement, so a queued STANCE_CYCLE would never process
    // while either is present), then exercise the two feedback paths. Real
    // wall-clock waits (setTimeout) drive the performance.now()-based confirm
    // (520 ms) / shake (260 ms) deadlines, which the synthetic rAF clock does
    // NOT touch (performance.now() is left real under the pump harness).
    const pumpQuiet = async () => {
      // Advance one frame while clearing anything that would pause ticks.
      await page.evaluate(() => {
        document.querySelector("#defense-cutscene-overlay [data-cutscene-dismiss]")?.click();
        const offer = document.querySelector("#defense-growth-offer");
        offer?.querySelector("button[data-pick]")?.click();
        window.__pumpFrame(100);
      });
      await page.waitForTimeout(0);
    };
    const stanceState = () => page.evaluate(() => {
      const button = document.querySelector("#stance-cycle");
      return {
        exists: Boolean(button),
        classes: button ? [...button.classList] : [],
        glyph: button?.querySelector(".stance-glyph")?.textContent ?? null,
        clean: !document.querySelector("#defense-growth-offer") && !document.querySelector("#defense-cutscene-overlay [data-cutscene-dismiss]"),
      };
    });

    // Phase A: reach a clean, actionable frame with the stance button present.
    let ready = null;
    for (let i = 0; i < 60; i += 1) {
      await pumpQuiet();
      const state = await stanceState();
      if (state.exists && state.clean && state.glyph) { ready = state; break; }
    }
    assert.ok(ready, "the live battle must reach a clean frame exposing the #stance-cycle button");
    const initialGlyph = ready.glyph;

    // Phase B: a successful switch must add .is-switched and advance the glyph.
    await page.evaluate(() => document.querySelector("#stance-cycle")?.click());
    let switched = null;
    for (let i = 0; i < 20; i += 1) {
      await pumpQuiet();
      const state = await stanceState();
      if (state.glyph && state.glyph !== initialGlyph) { switched = state; break; }
    }
    assert.ok(switched, "clicking #stance-cycle must advance the formation stance (glyph changes)");
    assert.ok(switched.classes.includes("is-switched"), `a successful stance switch must carry the .is-switched confirmation glow; saw classes ${JSON.stringify(switched.classes)}`);
    assert.ok(!switched.classes.includes("is-blocked"), "a successful switch must not also carry the rejection shake class");

    // Phase C: a second tap DURING the 4 s cooldown must be rejected — glyph
    // frozen, .is-blocked shake shown (previously untested), no new switch.
    await page.evaluate(() => document.querySelector("#stance-cycle")?.click());
    let blocked = null;
    for (let i = 0; i < 20; i += 1) {
      await pumpQuiet();
      const state = await stanceState();
      if (state.classes.includes("is-blocked")) { blocked = state; break; }
    }
    assert.ok(blocked, "a cooldown-rejected stance tap must carry the .is-blocked shake class");
    assert.equal(blocked.glyph, switched.glyph, "a rejected tap must not advance the formation stance");

    // Phase D: after the confirm window elapses (520 ms real-time), the glow
    // must clear (the class is a transient held state, not permanent).
    await page.waitForTimeout(650);
    await pumpQuiet();
    const cleared = await stanceState();
    assert.ok(!cleared.classes.includes("is-switched"), `the .is-switched glow must clear after its window; saw classes ${JSON.stringify(cleared.classes)}`);

    assert.deepEqual(errors, [], "stance-switch feedback journey emitted unexpected page or console errors");
    return { initialGlyph, switchedGlyph: switched.glyph, sawSwitched: true, sawBlocked: true, clearedAfterWindow: true };
  } finally {
    await context.close();
  }
}

/**
 * Pass #7 (UI/IA axis): the in-run XP-to-next-level bar (#battle-xp-fill +
 * #battle-xp-label in the top mission panel). Before this the mid-combat HUD
 * exposed only "Lv.N" text — the player had zero visibility into progress
 * toward the next growth/skill choice, the core RPG decision. Proven live via
 * the same deterministic frame-pump harness: the bar must render inside the
 * edge HUD, its cost must come from the public XP_GROWTH contract, and its
 * fill width must equal the label's xp/cost ratio (i.e. it reflects real
 * snapshot.commander data, not a static element).
 */
async function verifyXpProgressBar(browser, hosting, campaign) {
  // The public XP-growth contract (defense-catalog.js XP_GROWTH). Duplicated
  // here as an independent oracle: the label's per-level cost MUST be one of
  // these, which proves the cost is wired from the catalog and not fabricated.
  const XP_GROWTH = [30, 55, 85, 120, 160, 205, 255, 310];
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  // Same runner slowdown `:329-335` documents (rafMean ~95.8 ms in CI against ~16 ms
  // locally, ~6x). Stock 30 s was measured failing here on `d34a3d30`:
  // `locator.click: Timeout 30000ms exceeded` at `#start-defense`. A per-suite default is
  // a property of the RUNNER, not of each function, so every context in this file carries it.
  context.setDefaultTimeout(90_000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  try {
    await page.addInitScript(({ encoded, key }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      localStorage.setItem(key, encoded);
    }, { encoded: campaign.encoded, key: STORAGE_KEY });
    await page.addInitScript(() => {
      const queue = new Map();
      let nextId = 1;
      let syntheticNow = 0;
      window.requestAnimationFrame = (callback) => { const id = nextId++; queue.set(id, callback); return id; };
      window.cancelAnimationFrame = (id) => { queue.delete(id); };
      window.__pumpFrame = (deltaMs) => {
        syntheticNow += deltaMs;
        const pending = [...queue.values()];
        queue.clear();
        for (const callback of pending) callback(syntheticNow);
        return syntheticNow;
      };
    });
    await page.goto("/campaign.html", { waitUntil: "domcontentloaded" });
    await page.locator("#start-defense").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor({ state: "attached" });

    const pumpQuiet = async () => {
      await page.evaluate(() => {
        document.querySelector("#defense-cutscene-overlay [data-cutscene-dismiss]")?.click();
        const offer = document.querySelector("#defense-growth-offer");
        offer?.querySelector("button[data-pick]")?.click();
        window.__pumpFrame(100);
      });
      await page.waitForTimeout(0);
    };
    const xpState = () => page.evaluate(() => {
      const fill = document.querySelector("#battle-xp-fill");
      const label = document.querySelector("#battle-xp-label");
      return {
        exists: Boolean(fill) && Boolean(label),
        insideEdgeHud: Boolean(document.querySelector("#defense-edge-hud #battle-xp-fill")),
        widthPct: fill ? parseFloat(fill.style.width) : NaN,
        label: label?.textContent ?? "",
        clean: !document.querySelector("#defense-growth-offer") && !document.querySelector("#defense-cutscene-overlay [data-cutscene-dismiss]"),
      };
    });

    // Reach a clean, actionable battle frame where the XP bar has been rendered.
    let state = null;
    for (let i = 0; i < 60; i += 1) {
      await pumpQuiet();
      const s = await xpState();
      if (s.exists && s.clean && /^Lv\.\d+ · \d+\/\d+$/.test(s.label)) { state = s; break; }
    }
    assert.ok(state, "the live battle must render the #battle-xp progress bar with a Lv.N · xp/cost label");
    assert.ok(state.insideEdgeHud, "the XP bar must live inside #defense-edge-hud (edge-HUD constraint, no center panel)");

    const match = state.label.match(/^Lv\.(\d+) · (\d+)\/(\d+)$/);
    assert.ok(match, `XP label must read "Lv.N · xp/cost"; saw ${JSON.stringify(state.label)}`);
    const level = Number(match[1]);
    const xp = Number(match[2]);
    const cost = Number(match[3]);
    assert.ok(level >= 1, `commander level must be >= 1; saw ${level}`);
    assert.ok(XP_GROWTH.includes(cost), `level cost ${cost} must come from the XP_GROWTH contract ${JSON.stringify(XP_GROWTH)}`);
    assert.ok(xp >= 0, `xp must be non-negative; saw ${xp}`);

    // The rendered fill width must equal the clamped xp/cost ratio — proving the
    // bar reflects live snapshot data, not a placeholder.
    const expectedWidth = Math.max(0, Math.min(1, xp / cost)) * 100;
    assert.ok(Number.isFinite(state.widthPct), `fill width must be a numeric percent; saw ${state.widthPct}`);
    assert.ok(state.widthPct >= 0 && state.widthPct <= 100, `fill width must be within [0,100]; saw ${state.widthPct}`);
    assert.ok(Math.abs(state.widthPct - expectedWidth) < 0.5, `fill width ${state.widthPct}% must match xp/cost ratio ${expectedWidth}% from label ${JSON.stringify(state.label)}`);

    await page.screenshot({ path: "/tmp/xp-progress-bar.png" });
    assert.deepEqual(errors, [], "XP progress-bar journey emitted unexpected page or console errors");
    return { level, xp, cost, widthPct: state.widthPct, label: state.label, insideEdgeHud: state.insideEdgeHud };
  } finally {
    await context.close();
  }
}

/**
 * Passive-build legibility (RPG growth axis). #skill-actions renders only
 * kind==="active" skills, so before this pass the 3 passive picks left no
 * on-screen trace after the level-up toast. This drives real growth offers,
 * prefers a passive choice, and proves each acquired passive renders a
 * persistent read-only badge inside the edge HUD with exactly the catalog boon.
 */
async function verifyPassiveBadges(browser, hosting, campaign) {
  // Independent oracle: the public SKILLS passive boons (defense-catalog.js).
  // The rendered badge text MUST equal one of these, proving the value is wired
  // from the catalog and not fabricated in the render layer.
  const PASSIVE_BOONS = { "eclipse-edge": "+180 공격", "soul-magnet": "+1500 회수", "ward-binder": "+120 내구" };
  const ACTIVE_IDS = ["rift-bolt", "soul-lance", "grave-pulse", "void-aegis", "shadow-step"];
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 844, height: 390 } });
  // Same runner slowdown `:329-335` documents (rafMean ~95.8 ms in CI against ~16 ms
  // locally, ~6x). Stock 30 s was measured failing here on `d34a3d30`:
  // `locator.click: Timeout 30000ms exceeded` at `#start-defense`. A per-suite default is
  // a property of the RUNNER, not of each function, so every context in this file carries it.
  context.setDefaultTimeout(90_000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  try {
    await page.addInitScript(({ encoded, key }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      localStorage.setItem(key, encoded);
    }, { encoded: campaign.encoded, key: STORAGE_KEY });
    await page.addInitScript(() => {
      const queue = new Map();
      let nextId = 1;
      let syntheticNow = 0;
      window.requestAnimationFrame = (callback) => { const id = nextId++; queue.set(id, callback); return id; };
      window.cancelAnimationFrame = (id) => { queue.delete(id); };
      window.__pumpFrame = (deltaMs) => {
        syntheticNow += deltaMs;
        const pending = [...queue.values()];
        queue.clear();
        for (const callback of pending) callback(syntheticNow);
        return syntheticNow;
      };
    });
    await page.goto("/campaign.html", { waitUntil: "domcontentloaded" });
    await page.locator("#start-defense").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor({ state: "attached" });

    // Deterministic in-page pump drive (same controllable-rAF pattern as the
    // world-HUD test): each __pumpFrame(100) advances EXACTLY 100 ms of
    // game-time, so reaching a level-up is a pure function of pump COUNT, never
    // of the CI runner's frame rate. On each growth offer prefer a passive pick
    // (falling back to the first choice) so the passive-badge strip is exercised;
    // break as soon as a badge renders. 1200 pumps = 120 s of game-time, ample
    // margin over the first level-up (XP_GROWTH[0]=30 fires within a few seconds).
    const passiveIds = Object.keys(PASSIVE_BOONS);
    const state = await page.evaluate(async (passiveIds) => {
      const FRAME_MS = 100;
      const MAX_PUMPS = 1200;
      const clickedOfferKeys = new Set();
      const readBadges = () => [...(document.querySelectorAll("#passive-badges .passive-badge"))]
        .map((b) => ({ id: b.dataset.passive ?? "", boon: b.querySelector("small")?.textContent ?? "" }));
      let pumps = 0;
      while (pumps < MAX_PUMPS) {
        document.querySelector("#defense-cutscene-overlay [data-cutscene-dismiss]")?.click();
        const offer = document.querySelector("#defense-growth-offer");
        if (offer) {
          const key = offer.dataset.offer ?? "";
          if (!clickedOfferKeys.has(key)) {
            clickedOfferKeys.add(key);
            const picks = [...offer.querySelectorAll("button[data-pick]")];
            const passive = picks.find((b) => passiveIds.includes(b.dataset.pick));
            (passive ?? picks[0])?.click();
          }
        }
        if (readBadges().length > 0) break;
        window.__pumpFrame(FRAME_MS);
        pumps += 1;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const badges = readBadges();
      return {
        badges,
        pumps,
        insideEdgeHud: Boolean(document.querySelector("#defense-edge-hud #passive-badges")),
        activeInPassiveStrip: badges.map((b) => b.id),
      };
    }, passiveIds);
    assert.ok(state.badges.length > 0, `a passive skill must be acquirable and render at least one #passive-badges chip within the drive budget (pumped ${state.pumps})`);
    assert.ok(state.insideEdgeHud, "the passive-badge strip must live inside #defense-edge-hud (edge-HUD constraint, no center panel)");
    for (const { id, boon } of state.badges) {
      assert.ok(PASSIVE_BOONS[id], `badge ${JSON.stringify(id)} must be a real passive skill from the catalog`);
      assert.equal(boon, PASSIVE_BOONS[id], `passive ${id} badge must show its catalog boon ${PASSIVE_BOONS[id]}; saw ${JSON.stringify(boon)}`);
    }
    for (const id of state.activeInPassiveStrip) {
      assert.equal(ACTIVE_IDS.includes(id), false, `the passive strip must never render an active skill; saw ${id}`);
    }
    await page.screenshot({ path: "/tmp/passive-badges.png" });
    assert.deepEqual(errors, [], "passive-badge journey emitted unexpected page or console errors");
    return { badges: state.badges, insideEdgeHud: state.insideEdgeHud };
  } finally {
    await context.close();
  }
}

async function run() {
  const hosting = await startServer();
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const campaign = await seededWorldHudCampaign();
    const journey = await verifyPlaythroughJourney(browser, hosting, campaign);
    const worldHud = await verifyWorldHudOverlay(browser, hosting, campaign);
    const stanceFeedback = await verifyStanceSwitchFeedback(browser, hosting, campaign);
    const xpProgress = await verifyXpProgressBar(browser, hosting, campaign);
    const passiveBadges = await verifyPassiveBadges(browser, hosting, campaign);
    const bossMesh = await verifyBossMeshRegression(browser, hosting);
    console.log(JSON.stringify({ pass: true, journey, worldHud, bossMesh, stanceFeedback, xpProgress, passiveBadges }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => hosting.host.close(resolve));
  }
}
if (playwright) run().catch((error) => { console.error(error.stack || String(error)); process.exitCode = 1; });
