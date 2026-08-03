// Regression guard for the legion HUD layer added on top of the battle HUD:
// the shadow-mana gauge, the roster chips and the defense/offense stance chip
// must be populated from the live snapshot (they were inert markup before),
// and the ARISE banner must stay hidden until an extraction fires.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
let browser;
let hosting;

function staticServer() {
  const host = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = path.resolve(ROOT, pathname === "/" ? "index.html" : decodeURIComponent(pathname).slice(1));
    if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      const extension = path.extname(file);
      const contentType = extension === ".js" || extension === ".mjs"
        ? "text/javascript"
        : extension === ".css"
          ? "text/css"
          : extension === ".json"
            ? "application/json"
            : extension === ".html"
              ? "text/html"
              : "application/octet-stream";
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType });
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host,
    url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

before(async () => {
  hosting = await staticServer();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  hosting?.host.close();
});

test("the legion HUD panel is populated from the live run snapshot", async () => {
  const context = await browser.newContext({ baseURL: hosting.url, reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    await page.goto("/campaign.html", { waitUntil: "networkidle" });
    await page.locator("#start-defense").click();
    await page.locator('#defense-battle-surface[data-defense-ready="true"]').waitFor({ state: "visible" });
    for (let index = 0; index < 4; index += 1) {
      const dismiss = page.locator("#defense-cutscene-overlay [data-cutscene-dismiss]");
      if (await dismiss.count() === 0 || !(await dismiss.isVisible())) break;
      await dismiss.click();
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(1200);

    const observed = await page.evaluate(() => {
      const box = document.querySelector(".hud-legion")?.getBoundingClientRect() ?? { width: 0, height: 0 };
      return {
        manaLabel: document.querySelector("#battle-legion-mana-label")?.textContent ?? "",
        manaWidth: document.querySelector("#battle-legion-mana-fill")?.style.width ?? "",
        rosterChips: document.querySelectorAll("#battle-legion-roster .legion-roster-unit").length,
        stanceText: document.querySelector("#battle-stance-mode")?.textContent ?? "",
        stanceMode: document.querySelector("#battle-stance-mode")?.dataset.stanceMode ?? "",
        ariseActive: document.querySelector("#battle-arise-banner")?.dataset.active ?? "",
        panelWidth: box.width,
        panelHeight: box.height,
      };
    });

    assert.ok(observed.panelWidth > 40 && observed.panelHeight > 20, `legion panel must be laid out on desktop, got ${observed.panelWidth}x${observed.panelHeight}`);
    assert.match(observed.manaLabel, /그림자 마력 \d{1,3}% · 군단 \d+\/\d+/, "shadow-mana read-out must report percent and legion headcount");
    assert.match(observed.manaWidth, /^\d{1,3}%$/, "shadow-mana gauge fill must be driven as a percentage width");
    assert.ok(observed.rosterChips >= 1, "roster must render at least one chip (an empty-legion chip when nothing is deployed)");
    assert.match(observed.stanceText, /OFFENSE|DEFENSE/, "stance chip must expose the offense/defense mode");
    assert.ok(["offense", "defense"].includes(observed.stanceMode), `stance chip must carry a themed mode, got ${observed.stanceMode}`);
    assert.equal(observed.ariseActive, "false", "the ARISE banner must stay hidden until an extraction fires");
    assert.deepEqual(errors, [], "the legion HUD must not raise browser errors");
  } finally {
    await context.close();
  }
});
