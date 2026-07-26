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
  const campaignState = await import("../campaign-state.js");
  let campaign = campaignState.createCampaign({ campaignId: "defense-0-1", resetEpoch: 0 });
  campaign = campaignState.captureElite(campaign, "s1-ember-hunter", "ember-cohort");
  campaign = campaignState.captureElite(campaign, "s2-veil-sentinel", "rift-lens");
  campaign = campaignState.captureElite(campaign, "s3-throne-wraith", "throne-echo");
  campaign = campaignState.setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "throne-echo"]);
  const payload = campaignState.serializeCampaign(campaign);
  const text = JSON.stringify(payload);
  return {
    encoded: JSON.stringify({
      version: campaignState.RULES_VERSION,
      hash: `sha256-${createHash("sha256").update(text).digest("hex")}`,
      payload,
    }),
  };
}

async function verifyPlaythroughJourney(browser, hosting, campaign) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const report = { events: [], errors: [] };
  page.on("pageerror", (error) => report.errors.push({ kind: "page", message: error.message }));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push({ kind: "console", message: message.text() }); });
  try {
    await page.addInitScript(({ encoded, key }) => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      localStorage.setItem(key, encoded);
    }, { encoded: campaign.encoded, key: STORAGE_KEY });
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    assert.equal(await page.locator("#start-defense").isVisible(), true, "lobby must expose a live departure action");
    report.events.push("lobby-visible");
    await page.locator("#start-defense").click();
    const surface = page.locator('[data-defense-ready="true"]');
    await surface.waitFor({ state: "visible" });
    report.events.push("battle-visible");
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
        buttons: [...surface.querySelectorAll("#movement-actions [data-move]")].map((button) => ({
          move: button.dataset.move,
          label: button.getAttribute("aria-label"),
        })),
      },
    }));
    assert.match(accessibility.label ?? "", /\S/, "battle surface must expose an accessible name");
    assert.match(accessibility.canvasLabel ?? "", /\S/, "battle canvas must expose an accessible name");
    assert.equal(accessibility.statusLive, "polite", "battle status must announce snapshot changes");
    assert.deepEqual(accessibility.movement, {
      role: "group",
      label: "한 손 이동 조작",
      buttons: [
        { move: "N", label: "위로 이동" },
        { move: "W", label: "왼쪽으로 이동" },
        { move: "IDLE", label: "이동 정지" },
        { move: "E", label: "오른쪽으로 이동" },
        { move: "S", label: "아래로 이동" },
      ],
    }, "one-thumb directions must expose stable, labeled public controls");
    await page.locator('[data-move="E"]').focus();
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.move),
      "E",
      "a one-thumb direction must remain keyboard focusable",
    );
    await page.waitForFunction(() => document.querySelector("#defense-battle-surface")?.dataset.defenseFeedback === "lore");
    assert.equal(await page.locator("#battle-event-feedback").getAttribute("data-feedback"), "lore");
    assert.match(
      await page.locator("#battle-event-feedback").textContent() ?? "",
      /\S/,
      "lore feedback must render safe snapshot-derived text through the live status region",
    );
    assert.equal(
      await cutscene.isVisible(),
      true,
      "cutscene must remain visible until the test dismisses it; it auto-dismissed before dismissal interaction",
    );
    await cutscene.locator("[data-cutscene-dismiss]").focus();
    await page.keyboard.press("Enter");
    await cutscene.waitFor({ state: "hidden" });
    assert.equal(await surface.getAttribute("data-defense-cutscene"), null, "cutscene dismissal must not leave stale presentation state");
    const beforeControlKeyboard = await surface.getAttribute("data-defense-input-seq");
    await page.locator('[data-move="E"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((value) => document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq !== value, beforeControlKeyboard);
    assert.equal(await surface.getAttribute("data-defense-move"), "E", "keyboard activation must queue the public east movement command");
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
    const growthOffer = page.locator("#defense-growth-offer");
    const selectedGrowthSkills = new Set();
    const maxImmediateGrowthSelections = 8;
    let growthOfferClosed = false;
    // Real WebGL startup and the stage route can exceed 30s on hosted runners.
    // Keep this presentation-only wait above the observed ~29.5s full journey
    // without weakening any later growth-choice assertions.
    await growthOffer.waitFor({ state: "visible", timeout: 60000 });
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
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });

    // Drive the live loop entirely inside the page: repeatedly dismiss the
    // stage-entry cutscene and click through growth offers (both otherwise
    // block real-time tick advancement — see advanceDefenseRun()'s
    // `if (next.growthOffer) { ...; break; }`) while a MutationObserver
    // records every .world-damage-number's real rendered (computed, not
    // inline) transform + its .world-damage-number-rise text at the moment
    // each is inserted — reading computed style is what actually would have
    // caught Bug #2 (a co-animated transform silently replaces the whole
    // computed value; the inline style string alone would look correct even
    // under the bug).
    const drive = await page.evaluate(async () => {
      const overlay = document.querySelector("#world-hud-overlay");
      const damageSamples = [];
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement) || !node.classList.contains("world-damage-number")) continue;
            const rise = node.querySelector(".world-damage-number-rise");
            damageSamples.push({
              computedTransform: getComputedStyle(node).transform,
              inlineTransform: node.style.transform,
              riseText: rise?.textContent ?? null,
            });
          }
        }
      });
      observer.observe(overlay, { childList: true });

      // Deterministic frame-pump drive (see the controllable rAF init script
      // above). Each __pumpFrame(100) advances EXACTLY 100 ms of GAME-time
      // (elapsed = min(100, frameDuration), frameDuration pinned to 100), so the
      // elite-candidate state — reached only after the gate-defense ->
      // echo-recovery objective chain defeats the stage-1 elite, ~17-18 s of
      // game-time — is a pure function of pump COUNT, never of the CI runner's
      // real frame rate. The old fixed 32 s WALL-CLOCK budget failed in CI
      // precisely because loop() clamps game-time to min(100, frameDuration) per
      // frame: on a slow software-WebGL runner a frame takes far longer than
      // 100 ms, so 32 s of wall-clock yielded well under 18 s of game-time and
      // the capture prompt never appeared. Pumping decouples the two entirely.
      // Pumping ~6 sim ticks/frame (100 ms / STEP_MS, STEP_MS = 1000/60) also
      // deliberately drives loop()'s multi-tick catch-up + frameEvents path —
      // the exact slow-frame path CI hits — so this is MORE faithful to the CI
      // scenario, not less.
      const FRAME_MS = 100;
      // Elite candidate needs ~17-18 s game-time (~1062 ticks) => ~180 pumps at
      // 100 ms each. This cap is 200 s of GAME-time (>10x margin) — a game-time
      // bound, not a wall-clock bound, so no runner slowness can defeat it:
      // 2000 pumps is always exactly 200 s of game-time. It only trips if the
      // capture prompt genuinely never renders (a real Bug #4 regression),
      // which is exactly what the assertion below is here to catch.
      const MAX_PUMPS = 2000;
      let initialCapturePromptText = null;
      let initialCapturePromptState = null;
      let extractionReadyPromptText = null;
      let holdingCapturePromptText = null;
      let extractionReadyPromptState = null;
      let bindStarted = false;
      let nameplateTransform = null;
      const clickedOfferKeys = new Set();
      let pumps = 0;
      while (pumps < MAX_PUMPS) {
        const cutsceneDismiss = document.querySelector("#defense-cutscene-overlay [data-cutscene-dismiss]");
        if (cutsceneDismiss) cutsceneDismiss.click();
        const growthOffer = document.querySelector("#defense-growth-offer");
        if (growthOffer) {
          const offerKey = growthOffer.dataset.offer ?? "";
          const button = growthOffer.querySelector("button[data-pick]");
          if (button && !clickedOfferKeys.has(offerKey)) {
            clickedOfferKeys.add(offerKey);
            button.click();
          }
        }
        if (nameplateTransform === null) {
          const nameplate = overlay.querySelector("[data-world-nameplate]");
          if (nameplate && nameplate.style.transform) nameplateTransform = nameplate.style.transform;
        }
        const prompt = overlay.querySelector(".world-capture-prompt");
        const promptText = prompt?.textContent?.trim();
        if (promptText) {
          const extractAction = document.querySelector("#extract-elite");
          const promptState = extractAction
            ? {
              disabled: extractAction.disabled,
              ariaDisabled: extractAction.getAttribute("aria-disabled"),
            }
            : null;
          if (initialCapturePromptText === null) {
            initialCapturePromptText = promptText;
            initialCapturePromptState = promptState;
          }
          if (!bindStarted && promptText.startsWith("Bind 대기") && extractAction && !extractAction.disabled && extractAction.getAttribute("aria-disabled") === "false") {
            extractAction.click();
            bindStarted = true;
          }
          if (promptText.startsWith("결속 홀드")) holdingCapturePromptText = holdingCapturePromptText ?? promptText;
          if (promptText.startsWith("추출 가능")) {
            extractionReadyPromptText = promptText;
            extractionReadyPromptState = promptState;
          }
        }
        if (nameplateTransform !== null && damageSamples.length >= 4 && extractionReadyPromptText !== null) break;
        window.__pumpFrame(FRAME_MS);
        pumps += 1;
        // Yield a macrotask so the childList MutationObserver microtask (which
        // records each damage number's COMPUTED transform at insertion) and any
        // pending style/layout work settle before the next iteration reads DOM.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      observer.disconnect();
      return { nameplateTransform, damageSamples, initialCapturePromptText, initialCapturePromptState, holdingCapturePromptText, extractionReadyPromptText, extractionReadyPromptState, bindStarted, pumps, gameTimeMs: pumps * FRAME_MS };
    });

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
    assert.ok(drive.initialCapturePromptText, "the elite capture prompt must appear once an elite candidate and extraction zone exist (Bug #4 guard)");
    assert.match(drive.initialCapturePromptText, /^(?:Bind 대기|결속 홀드 \d+\/\d+초|추출 가능) · Ember Cohort$/, "the initial capture prompt must expose the real companion name and an explicit bind/extraction state");
    assert.ok(drive.initialCapturePromptState, "the initial capture prompt must have a matching extraction action");
    const initiallyReady = drive.initialCapturePromptText.startsWith("추출 가능");
    assert.equal(drive.initialCapturePromptState.disabled, false, "the extraction route CTA must be enabled before Bind starts or once extraction is ready");
    assert.equal(drive.initialCapturePromptState.ariaDisabled, "false", "the extraction route CTA aria-disabled state must be false before Bind starts or once extraction is ready");
    if (!initiallyReady) assert.equal(drive.bindStarted, true, "the enabled Bind CTA must be activated exactly once before waiting for extraction readiness");
    assert.ok(drive.holdingCapturePromptText, "the elite capture prompt must expose the active hold state after the Bind route starts");
    assert.match(drive.holdingCapturePromptText, /^결속 홀드 \d+\/\d+초 · Ember Cohort$/, "the active hold prompt must expose deterministic progress and the real companion name");
    assert.ok(drive.extractionReadyPromptText, "the elite extraction-ready prompt must appear after the Bind hold completes (Bug #4 guard)");
    assert.match(drive.extractionReadyPromptText, /^추출 가능 · Ember Cohort$/, "the elite capture prompt must reach the concrete Korean extraction-ready CTA with the real companion name");
    assert.ok(drive.extractionReadyPromptState, "the extraction-ready prompt must have a matching extraction action");
    assert.equal(drive.extractionReadyPromptState.disabled, false, "the extraction-ready CTA must remain enabled");
    assert.equal(drive.extractionReadyPromptState.ariaDisabled, "false", "the extraction-ready CTA aria-disabled state must be false");

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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  try {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async () => {
      const sim = await import("/defense-run-simulation.js");
      const { ARENA } = await import("/defense-catalog.js");
      const { RealtimeBattle } = await import("/battle-realtime-three.js");
      const { createDefenseRun, advanceDefenseRun, getRunSnapshot, isTerminalRun, queueInput } = sim;

      function step(run) {
        const offer = getRunSnapshot(run).growthOffer;
        let next = offer ? queueInput(run, "SKILL_SELECTED", { skillId: offer.choices[0] }) : run;
        const snapshot = getRunSnapshot(next);
        next = queueInput(next, "MOVE", { octant: "IDLE" });
        if (snapshot.eliteCandidate && !snapshot.extracted) next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
        return advanceDefenseRun(next, 1);
      }

      let run = createDefenseRun({ stageId: "cinder-span", seed: 2962819252, companionLoadout: ["ember-cohort"] });
      let snapshot = getRunSnapshot(run);
      let boss = null;
      for (let i = 0; i < 3000 && !isTerminalRun(run); i += 1) {
        run = step(run);
        snapshot = getRunSnapshot(run);
        boss = snapshot.enemies.find((enemy) => enemy.class === "boss");
        if (boss) break;
      }
      if (!boss) return { error: `no live boss appeared within the simulated tick budget (final tick ${snapshot.tick}, terminal=${String(isTerminalRun(run))})` };

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

      const expectedModelPath = "bosses/cinder-warden.glb";
      const expectedGlbPath = "assets/images/battle/glb/bosses/cinder-warden.glb";
      const actorKeys = () => (renderer.actors && typeof renderer.actors.keys === "function" ? [...renderer.actors.keys()] : []);
      const entry = await new Promise((resolve) => {
        const deadline = performance.now() + 10000;
        const poll = () => {
          const candidate = renderer.actors?.get?.(boss.id);
          if ((candidate?.loading === false && candidate.root) || performance.now() >= deadline) {
            resolve(candidate ?? null);
            return;
          }
          setTimeout(poll, 25);
        };
        poll();
      });
      if (!entry || entry.loading || !entry.root) {
        return {
          error: `renderer.actors has no loaded root for live boss id ${boss.id} within 10000ms -- expected GLB ${expectedGlbPath}`,
          bossId: boss.id,
          bossHp: boss.hp,
          bossTick: snapshot.tick,
          actorKeys: actorKeys(),
          expectedModelPath,
          modelPath: entry?.modelPath ?? null,
          rootName: entry?.root?.name ?? null,
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
        modelPath: entry.modelPath,
        rootName: entry.root.name,
        meshDescendantCount,
        expectedModelPath,
        expectedGlbPath,
      };
    });

    assert.equal(result.error, undefined, `boss mesh regression check failed: ${result.error}`);
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
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });

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
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });

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
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#defense-app.defense-lobby").waitFor();
    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });

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
