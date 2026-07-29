import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { captureElite, createCampaign, setCompanionLoadout } from "../campaign-state.js";
import { DefenseStorage } from "../defense-storage.js";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const CONTENT_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function serveProject() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const file = resolve(ROOT, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!file.startsWith(`${ROOT}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      if (!(await stat(file)).isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose())),
  };
}

async function growthFixtureText() {
  let campaign = createCampaign({ campaignId: "defense-0-1" });
  campaign = captureElite(campaign, "s1-ember-hunter", "ember-cohort");
  campaign = captureElite(campaign, "s2-veil-sentinel", "rift-lens");
  campaign = captureElite(campaign, "s3-throne-wraith", "throne-echo");
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "throne-echo"]);
  const storage = new DefenseStorage({ indexedDB: null, localStorage: null, crypto: webcrypto });
  await storage.open();
  await storage.save(campaign);
  return storage.exportText();
}
test("growth choices show truthful current → upgraded values to the player", { timeout: 60_000 }, async (t) => {
  const hosting = await serveProject();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    await hosting.close();
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(`${hosting.url}/index.html`, { waitUntil: "networkidle" });
  // The persistent 전황 시트 deck inlines the 요새 record room, so #import-defense is in the
  // DOM from load and no tab hop exists (20260729-ui-dock-removal, replacing
  // component-contracts.md §1 computeDefaultDockOpen). The zero-interaction
  // #start-defense reachability that other browser tests depend on is preserved by the
  // sortie FAB, which mounts outside both decks.
  // `attached`, not visible: the input sits inside the 요새 <details>, which renders
  // collapsed. setInputFiles drives a hidden input fine -- what this defends is that no tab
  // hop is needed to reach it, which is DOM presence, not visibility.
  await page.locator("#import-defense").waitFor({ state: "attached" });
  assert.equal(
    await page.locator("#start-defense").count(),
    1,
    "#start-defense must remain reachable with zero interaction at load",
  );
  const fixtureText = await growthFixtureText();
  await page.locator("#import-defense").setInputFiles({
    name: "growth-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(fixtureText),
  });
  await page.waitForFunction(() => document.body.textContent.includes("기록을 가져왔습니다"));
  await page.locator("#start-defense").click();
  await page.locator('#defense-battle-surface[data-defense-started="true"]').waitFor({ state: "attached" });
  const cutscene = page.locator("#defense-cutscene-overlay");
  if (await cutscene.isVisible()) {
    await page.keyboard.press("Enter");
    await cutscene.waitFor({ state: "hidden" });
  }

  const offer = page.locator("#defense-growth-offer");
  await offer.waitFor({ state: "visible", timeout: 45_000 });
  const choices = await offer.locator("button[data-pick]").evaluateAll((buttons) => buttons.map((button) => ({
    skillId: button.dataset.pick,
    label: button.querySelector("span.growth-choice-copy")?.textContent?.trim() ?? "",
  })));

  assert.equal(choices.length, 3, "a growth decision must present three comparable deltas");
  for (const { skillId, label } of choices) {
    assert.ok(skillId, "each visible delta must identify the skill it upgrades");
    const rankDelta = label.match(/등급\s+(\d+)\s+→\s+(\d+)/);
    assert.ok(rankDelta, `${skillId} must show its current and upgraded rank: ${label}`);
    assert.equal(Number(rankDelta[2]), Number(rankDelta[1]) + 1, `${skillId} must show a one-rank upgrade`);
  }
  const loopHud = page.locator(".hud-loop-state");
  assert.equal(await loopHud.isVisible(), true, "the agency HUD must remain visible during growth");
  assert.match(await page.locator("#battle-loop-phase").textContent(), /성장 선택/);
  assert.match(await page.locator("#battle-growth-state").textContent(), /3개 성장 오퍼/);
  assert.equal(await page.locator("#defense-battle-surface").getAttribute("data-objective-phase"), "gate-defense");
  assert.deepEqual(errors, []);
});
