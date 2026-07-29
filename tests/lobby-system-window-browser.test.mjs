// Regression guard for the system status window (#monarch-status): the shadow-mana gauge
// must be driven by the real Echo Core numbers, the legion counters must agree with the
// 군단 section, and the panel must not break the no-horizontal-overflow contract on phone
// viewports.
//
// The persistent command decks (20260729-ui-dock-removal) replaced the slide-open side
// docks: the status window heads the left deck body and is visible with ZERO interaction,
// and the companion roster it is cross-checked against is mounted in the same deck at the
// same time. Every value assertion below is unchanged -- what moved is that nothing has to
// be opened first, which is a strictly stronger reachability claim than the old tab hop.
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
    await assertDeckMountedWithoutInteraction(page);

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
        firstInDeckBody: document.querySelector("#command-deck-left .deck-body")?.firstElementChild?.id ?? "",
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
    assert.equal(observed.firstInDeckBody, "monarch-status", "the status window must head the left command-deck body");

    assert.match(observed.stats["저지 레벨"] ?? "", /^Lv \d+$/, "warden level must be reported");
    assert.match(observed.stats["군단 정원"] ?? "", /^[0-3]\/3$/, "legion capacity must be reported as n/3");

    // 인벤토리 is the default section, so it is readable with ZERO interaction.
    // 스킬 / 성장 / 군단 are ONE tap away on the always-visible segment bar. That bar is not a
    // slide menu and not a scroll: every label is permanently on screen and switching is
    // instant. The deck deliberately mounts one section at a time because mounting all four
    // measured 3446px of scroll inside a 779px body -- 4.4 screens to reach 군단 -- and the
    // directive is that scrolling belongs to 인벤토리's own list and nowhere else.
    // What this asserts is therefore reachability in one tap, plus that the tap target is on
    // screen without scrolling the masthead.
    const inventoryRows = await page.locator("#deck-section-inventory .growth-equip-slot").count();
    assert.ok(inventoryRows > 0, "the 인벤토리 section must be usable with zero interaction");

    // Each entry names the selectors that prove the section actually rendered. 군단 lists two
    // because its content is fixture-dependent: with no extracted elites it renders
    // `.empty-companions` and three empty loadout slots rather than companion cards.
    // Asserting on cards alone would be asserting on fixture content, not on reachability --
    // which is what this test is for.
    for (const [sectionId, selectors, label] of [
      ["skills", ["#deck-section-skills .growth-skill-node"], "스킬"],
      ["legion", [
        "#deck-section-legion .companion-grid .companion-card",
        "#deck-section-legion .empty-companions",
      ], "군단"],
    ]) {
      const chip = page.locator(`.deck-segment-bar [data-deck-section="${sectionId}"]`);
      assert.equal(await chip.count(), 1, `${label} must have a permanently visible segment chip`);
      assert.equal(await chip.isVisible(), true, `${label}'s chip must be on screen without scrolling`);
      await chip.click();
      const counts = await Promise.all(selectors.map((selector) => page.locator(selector).count()));
      assert.ok(
        counts.some((count) => count > 0),
        `${label} must be usable one tap away (matched none of ${selectors.join(", ")})`,
      );
    }

    const roster = await page.evaluate(() => ({
      cards: document.querySelectorAll("#deck-section-legion .companion-grid .companion-card").length,
      filledSlots: document.querySelectorAll("#deck-section-legion .loadout-slot.is-filled").length,
    }));
    assert.equal(observed.stats["결속 병력"], String(roster.cards), "bonded-troop count must match the 군단 roster collection");
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
      await assertDeckMountedWithoutInteraction(page);
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

/** Asserts the left command deck carries #monarch-status with ZERO prior interaction. The
 *  slide-open dock this replaced needed a rail tap (and at compact width the left dock
 *  defaulted closed), so the old helper had to click first. Nothing is clicked here on
 *  purpose: if a future change reintroduces a disclosure gesture in front of the character
 *  sheet, this call fails instead of silently clicking through it. */
async function assertDeckMountedWithoutInteraction(page) {
  const statusWindow = page.locator("#command-deck-left #monarch-status");
  await statusWindow.waitFor({ state: "visible" });
  assert.equal(await statusWindow.count(), 1, "the status window must be mounted in the left command deck without any interaction");
  const canvas = await page.locator("#defense-canvas").boundingBox();
  assert.ok(canvas && canvas.width > 0 && canvas.height > 0, "the live battle canvas must stay laid out beside the deck");
}
