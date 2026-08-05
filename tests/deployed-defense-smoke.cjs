const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const allowMissing = process.argv.includes("--allow-missing-browser");
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};
const baseUrl = option("--url");
const sha = option("--sha");
const rulesVersion = option("--rules-version");

if (!baseUrl || !sha || !rulesVersion) {
  throw new Error("Usage: node tests/deployed-defense-smoke.cjs --url <deployment-url> --sha <candidate-sha> --rules-version <rules-version>");
}

let playwright;
try {
  playwright = require("playwright");
} catch {
  if (!allowMissing) throw new Error("require(\"playwright\") failed; install the lock-backed browser dependency.");
  console.log("DEPLOYED_DEFENSE_SMOKE_SKIPPED missing Playwright");
}

const cacheBust = () => `cb=${encodeURIComponent(`${sha}-${Date.now()}`)}`;
const absolute = (pathname) => new URL(`${pathname}?${cacheBust()}`, baseUrl).href;
const SPRITE_RUNTIME_ASSETS = Object.freeze([
  "assets/images/sprite-2-5d/cinder-court-backdrop.png",
  "assets/images/sprite-2-5d/warden/manifest.json",
  "assets/images/sprite-2-5d/warden/sprite-sheet.png",
  "assets/images/sprite-2-5d/ember-cohort/manifest.json",
  "assets/images/sprite-2-5d/ember-cohort/sprite-sheet.png",
]);

async function run() {
  const results = {
    url: baseUrl,
    sha,
    rulesVersion,
    startedAt: new Date().toISOString(),
    sessions: [],
    errors: [],
    pass: false,
  };
  let browser;
  try {
    const versionResponse = await fetch(absolute("version.json"), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    assert.equal(versionResponse.ok, true, `version.json response must succeed; received ${versionResponse.status}`);
    const version = await versionResponse.json();
    assert.equal(version.candidate_sha, sha, "version.json candidate_sha must match --sha");
    assert.equal(version.rules_version, rulesVersion, "version.json rules_version must match --rules-version");
    results.version = version;

    results.spriteRequests = {};
    for (const pathname of ["index.html", ...SPRITE_RUNTIME_ASSETS]) {
      const assetResponse = await fetch(absolute(pathname), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      assert.equal(assetResponse.ok, true, `${pathname} response must succeed; received ${assetResponse.status}`);
      results.spriteRequests[pathname] = assetResponse.status;
    }

    browser = await playwright.chromium.launch({ headless: true });
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });

      const response = await page.goto(absolute("campaign.html"), { waitUntil: "networkidle" });
      assert(response?.ok(), `${width}x${height} app response must succeed`);
      await page.locator("#start-defense").click();
      const surface = page.locator('#defense-battle-surface[data-defense-started="true"]');
      await surface.waitFor({ state: "attached", timeout: 15_000 });
      const startupCutscenes = [];
      for (let dismissal = 0; dismissal < 4; dismissal += 1) {
        const dismiss = page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]").first();
        if (!await dismiss.isVisible().catch(() => false)) break;
        startupCutscenes.push(await page.locator("#defense-cutscene-overlay").getAttribute("data-cutscene-event"));
        await dismiss.click();
      }
      assert.equal(
        await page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]").first().isVisible().catch(() => false),
        false,
        "visible startup cutscenes must be dismissed before direct input",
      );
      const activeSurface = page.locator('#defense-battle-surface[data-defense-state="active"]');
      await activeSurface.waitFor({ state: "attached", timeout: 15_000 });
      const lightControl = page.locator('#manual-attack[data-combat-verb="ATTACK_LIGHT"]');
      await lightControl.waitFor({ state: "visible", timeout: 15_000 });
      assert.equal(await lightControl.count(), 1, "the public direct-light control must be unique");
      const inputBefore = Number(await activeSurface.getAttribute("data-defense-input-seq"));
      assert.equal(Number.isInteger(inputBefore), true, "active battle must expose an integer public input sequence");
      const expectedInputSeq = inputBefore + 1;
      await lightControl.click();
      await page.waitForFunction(
        ({ expected }) => Number(document.querySelector("#defense-battle-surface")?.dataset.defenseInputSeq) === expected,
        { expected: expectedInputSeq },
        { timeout: 15_000 },
      );
      const directLight = await page.evaluate((expected) => {
        const battleSurface = document.querySelector("#defense-battle-surface");
        return {
          attackSeq: Number(battleSurface?.dataset.defenseAttack),
          combatVerb: battleSurface?.dataset.defenseCombatVerb,
          inputSeq: Number(battleSurface?.dataset.defenseInputSeq),
          expectedInputSeq: expected,
        };
      }, expectedInputSeq);
      assert.deepEqual(
        directLight,
        {
          attackSeq: expectedInputSeq,
          combatVerb: "ATTACK_LIGHT",
          inputSeq: expectedInputSeq,
          expectedInputSeq,
        },
        "the native light control must advance exactly one public input and route ATTACK_LIGHT",
      );
      const invariant = await page.evaluate(() => ({
        surface: Boolean(document.querySelector("#defense-battle-surface")),
        canvas: Boolean(document.querySelector("#defense-canvas")),
        overflow: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
        state: document.querySelector("#defense-battle-surface")?.dataset.defenseState,
      }));
      assert.equal(invariant.surface, true, "battle surface must exist");
      assert.equal(invariant.canvas, true, "battle canvas must exist");
      assert.equal(invariant.overflow, true, "battle must not overflow viewport");
      const spriteResponse = await page.goto(absolute("index.html"), { waitUntil: "load" });
      assert(spriteResponse?.ok(), `${width}x${height} sprite route response must succeed`);
      await page.locator('#sprite-2-5d-briefing[data-visible], #sprite-2-5d-briefing:not([hidden])').first().waitFor({ state: "visible", timeout: 15_000 });
      await page.locator('#sprite-2-5d-briefing-start').click();
      await page.locator('body[data-game-state="running"]').waitFor({ state: "attached", timeout: 15_000 });
      const spriteInvariant = await page.evaluate(() => ({
        runtime: document.querySelector("#sprite-2-5d-game")?.dataset.runtime,
        canvas: {
          width: document.querySelector("#sprite-2-5d-canvas")?.width,
          height: document.querySelector("#sprite-2-5d-canvas")?.height,
        },
        controlsEnabled: [...document.querySelectorAll("[data-control]")].every((control) => !control.disabled),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(spriteInvariant.runtime, "running", "deployed sprite game root must expose the running state");
      assert.deepEqual(spriteInvariant.canvas, { width: 1536, height: 1024 }, "deployed sprite canvas must expose its authored render resolution");
      assert.equal(spriteInvariant.controlsEnabled, true, "deployed sprite controls must enable after asset validation");
      assert.equal(spriteInvariant.horizontalOverflow, false, "deployed sprite route must not overflow horizontally");
      assert.deepEqual(errors, [], "deployed browser emitted errors");
      results.sessions.push({
        viewport: `${width}x${height}`,
        ...invariant,
        startupCutscenes,
        directLight,
        sprite: spriteInvariant,
      });
      await context.close();
    }
    results.pass = true;
  } catch (error) {
    results.errors.push(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    results.finishedAt = new Date().toISOString();
    await fs.mkdir(path.resolve("results"), { recursive: true });
    await fs.writeFile(path.resolve("results/deployed-smoke.json"), `${JSON.stringify(results, null, 2)}\n`);
    console.log(JSON.stringify(results, null, 2));
  }
}

if (playwright) {
  run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
