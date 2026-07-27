// Regression guard for the lobby system status window (#monarch-status):
// the shadow-mana gauge must be driven by the real Echo Core numbers, the
// legion counters must agree with the 군단 tab, and the panel must not break
// the lobby's no-horizontal-overflow contract on phone viewports.
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

test("the lobby system window reports the real warden/legion state", async () => {
  const context = await browser.newContext({ baseURL: hosting.url, reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    await page.goto("/index.html", { waitUntil: "networkidle" });
    await page.locator("#monarch-status").waitFor({ state: "visible" });

    const observed = await page.evaluate(() => {
      const stats = {};
      for (const row of document.querySelectorAll("#monarch-status .monarch-stat-grid > div")) {
        stats[row.querySelector("dt").textContent.trim()] = row.querySelector("dd").textContent.trim();
      }
      return {
        rank: document.querySelector("#monarch-status .rank-badge")?.textContent ?? "",
        readout: document.querySelector("#monarch-mana-readout")?.textContent ?? "",
        fillWidth: document.querySelector("#monarch-mana-fill")?.style.width ?? "",
        gaugePercent: document.querySelector("#monarch-status .monarch-gauge")?.dataset.monarchManaPercent ?? "",
        gaugeLabel: document.querySelector("#monarch-status .monarch-gauge-track")?.getAttribute("aria-label") ?? "",
        chip: document.querySelector(".monarch-arise-chip")?.textContent ?? "",
        stats,
        beforeIdleBanner: document.querySelector("#monarch-status")?.nextElementSibling?.id ?? "",
      };
    });

    assert.match(observed.rank, /^RANK [ESABCD]$/, `rank badge must expose a system rank, got ${observed.rank}`);
    const readout = observed.readout.match(/^(\d+) \/ (\d+) EC$/);
    assert.ok(readout, `mana read-out must report remaining/earned Echo Core, got ${observed.readout}`);
    const [, remaining, earned] = readout.map(Number);
    assert.ok(remaining <= earned, "remaining shadow mana can never exceed the earned total");
    const expectedPercent = earned > 0 ? Math.round(Math.min(1, remaining / earned) * 100) : 0;
    assert.equal(observed.gaugePercent, String(expectedPercent), "gauge data attribute must match the Echo Core ratio");
    assert.equal(observed.fillWidth, `${expectedPercent}%`, "gauge fill width must be driven by the Echo Core ratio");
    assert.equal(observed.gaugeLabel, `그림자 마력 잔량 ${expectedPercent}%`, "gauge must expose the same ratio to assistive tech");
    assert.equal(observed.chip.trim(), "ARISE", "the extraction hint chip must be present");
    assert.equal(observed.beforeIdleBanner, "idle-return-summary", "the status window must sit directly above the idle-return banner");

    assert.match(observed.stats["저지 레벨"] ?? "", /^Lv \d+$/, "warden level must be reported");
    assert.match(observed.stats["군단 정원"] ?? "", /^[0-3]\/3$/, "legion capacity must be reported as n/3");

    await page.locator('[data-command-tab="companions"]').click();
    const roster = await page.evaluate(() => ({
      cards: document.querySelectorAll(".companion-grid .companion-card").length,
      filledSlots: document.querySelectorAll(".loadout-slot.is-filled").length,
    }));
    await page.locator('[data-command-tab="sortie"]').click();
    await page.locator("#monarch-status").waitFor({ state: "visible" });

    assert.equal(observed.stats["결속 병력"], String(roster.cards), "bonded-troop count must match the 군단 tab collection");
    assert.equal(observed.stats["군단 정원"], `${roster.filledSlots}/3`, "legion capacity must match the filled loadout slots");
    assert.ok(Number(observed.stats["추출 기록"]) >= 0, "extraction record must be a non-negative count");
    assert.deepEqual(errors, [], "the lobby system window must not raise browser errors");
  } finally {
    await context.close();
  }
});

test("the lobby system window keeps phone viewports free of horizontal overflow", async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ baseURL: hosting.url, reducedMotion: "reduce", viewport });
    try {
      const page = await context.newPage();
      await page.goto("/index.html", { waitUntil: "networkidle" });
      await page.locator("#monarch-status").waitFor({ state: "visible" });
      const measured = await page.evaluate(() => {
        const panel = document.querySelector("#monarch-status").getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          panelRight: panel.right,
          panelWidth: panel.width,
          panelHeight: panel.height,
        };
      });
      assert.ok(measured.scrollWidth <= measured.clientWidth, `${viewport.width}x${viewport.height}: lobby must not scroll horizontally (${measured.scrollWidth} > ${measured.clientWidth})`);
      assert.ok(measured.panelRight <= measured.clientWidth + 1, `${viewport.width}x${viewport.height}: status window must stay inside the viewport`);
      assert.ok(measured.panelWidth > 40 && measured.panelHeight > 20, `${viewport.width}x${viewport.height}: status window must be laid out, got ${measured.panelWidth}x${measured.panelHeight}`);
    } finally {
      await context.close();
    }
  }
});
