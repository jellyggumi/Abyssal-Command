import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import test from "node:test";
import { chromium } from "playwright";

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
  await page.locator("#start-defense").click();
  await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });
  const cutscene = page.locator("#defense-cutscene-overlay");
  if (await cutscene.isVisible()) {
    await page.keyboard.press("Enter");
    await cutscene.waitFor({ state: "hidden" });
  }

  const offer = page.locator("#defense-growth-offer");
  await offer.waitFor({ state: "visible", timeout: 30_000 });
  const choices = await offer.locator("button[data-pick]").evaluateAll((buttons) => buttons.map((button) => ({
    skillId: button.dataset.pick,
    label: button.querySelector("span")?.textContent?.trim() ?? "",
  })));

  assert.equal(choices.length, 3, "a growth decision must present three comparable deltas");
  for (const { skillId, label } of choices) {
    assert.ok(skillId, "each visible delta must identify the skill it upgrades");
    const rankDelta = label.match(/등급\s+(\d+)\s+→\s+(\d+)/);
    assert.ok(rankDelta, `${skillId} must show its current and upgraded rank: ${label}`);
    assert.equal(Number(rankDelta[2]), Number(rankDelta[1]) + 1, `${skillId} must show a one-rank upgrade`);
  }
  assert.deepEqual(errors, []);
});
