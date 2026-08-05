"use strict";
// Playwright verification of the campaign's CORE drop question, in the browser, against the
// SERVED bytes: does driving a real run and killing enemies spawn collectable item drops?
//
// Runs defense-run-simulation.js + defense-catalog.js exactly as campaign.html loads them
// (dynamic import of the served files), drives a run (steer at the nearest enemy, attack on
// cadence, resolve growth offers), and asserts DROP_SPAWNED fires, a buff pickup lands in
// snapshot.pickups, and it is collected (ITEM_COLLECTED). Complements campaign-item-image-
// browser.cjs (which proves the renderer draws that pickup as the crystal Sprite).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

let playwright;
try {
  playwright = require("playwright");
} catch {
  throw new Error("require('playwright') failed; install the lock-backed browser dependency.");
}

const ROOT = path.resolve(__dirname, "..");

function startServer() {
  const host = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).slice(1);
    const file = path.resolve(ROOT, relativePath);
    if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      const extension = path.extname(file);
      const contentType = extension === ".js" || extension === ".mjs" ? "text/javascript"
        : extension === ".json" ? "application/json"
          : extension === ".html" ? "text/html"
            : extension === ".png" ? "image/png" : "application/octet-stream";
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType });
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host, url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

// Runs entirely in the page: imports the served sim + catalog, drives a run, tallies drops.
const DRIVE = async () => {
  const sim = await import("/defense-run-simulation.js");
  const cat = await import("/defense-catalog.js");
  const { createDefenseRun, advanceDefenseRun, queueInput, getRunSnapshot } = sim;
  const TICK_RATE = cat.TICK_RATE;
  const OCT = [[0, -1, "UP"], [1, -1, "UP_RIGHT"], [1, 0, "RIGHT"], [1, 1, "DOWN_RIGHT"], [0, 1, "DOWN"], [-1, 1, "DOWN_LEFT"], [-1, 0, "LEFT"], [-1, -1, "UP_LEFT"]];
  const oct = (dx, dy) => {
    const a = Math.atan2(dy, dx);
    let bi = 0; let bd = Infinity;
    for (let i = 0; i < 8; i += 1) {
      const oa = Math.atan2(OCT[i][1], OCT[i][0]);
      let d = Math.abs(a - oa); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < bd) { bd = d; bi = i; }
    }
    return OCT[bi][2];
  };
  let game = createDefenseRun({ stageId: "cinder-span", seed: 17, abyssDepth: 0 });
  let spawn = 0; let collect = 0; let kills = 0; let lastMove = null; let ticks = 0; let maxOnField = 0;
  const MAX = TICK_RATE * 60 * 6;
  let firstDropSample = null;
  while (ticks < MAX) {
    const snap = getRunSnapshot(game);
    for (const e of snap.events ?? []) {
      if (e.type === "DROP_SPAWNED") { spawn += 1; if (!firstDropSample) firstDropSample = { itemId: e.itemId, rarity: e.rarity, grade: e.grade }; }
      if (e.type === "ITEM_COLLECTED") collect += 1;
      if (e.type === "ENEMY_DEFEATED") kills += 1;
    }
    maxOnField = Math.max(maxOnField, (snap.pickups ?? []).filter((p) => p.kind === "buff").length);
    if (snap.terminal) break;
    if (snap.growthOffer) {
      const c = snap.growthOffer.choices?.[0];
      if (c) { game = queueInput(game, "GROWTH_OFFER_SELECTED", c); game = advanceDefenseRun(game, 1); ticks += 1; continue; }
      break;
    }
    let desired = "IDLE";
    const cmd = snap.commander;
    if (cmd) {
      let t = null; let bd = Infinity;
      for (const en of snap.enemies ?? []) {
        if (!(en.hp > 0)) continue;
        const d = (en.x - cmd.x) ** 2 + (en.y - cmd.y) ** 2;
        if (d < bd) { bd = d; t = en; }
      }
      if (t) desired = oct(t.x - cmd.x, t.y - cmd.y);
    }
    if (desired !== lastMove) { game = queueInput(game, "MOVE", desired); lastMove = desired; }
    if (ticks % 10 === 0) game = queueInput(game, "ATTACK", null);
    game = advanceDefenseRun(game, 1); ticks += 1;
  }
  return { kills, spawn, collect, maxOnField, firstDropSample, dropChanceBasic: cat.DROP_CHANCE_BP["cinder-span"].BASIC };
};

async function main() {
  const { host, url } = await startServer();
  const browser = await playwright.chromium.launch();
  const failures = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("console", (m) => { if (m.type() === "error") failures.push(`console: ${m.text()}`); });
    page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
    // A blank same-origin document so the dynamic import()s resolve against the server root.
    await page.goto(`${url}/campaign.html`, { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(DRIVE);

    assert.ok(result.kills > 0, `the driven run must kill enemies (killed ${result.kills})`);
    assert.ok(result.spawn > 0, `killing enemies must spawn item drops (DROP_SPAWNED=${result.spawn} over ${result.kills} kills at BASIC ${result.dropChanceBasic}bp)`);
    assert.ok(result.maxOnField >= 1, `at least one buff drop must exist on the field at once (maxOnField=${result.maxOnField})`);
    assert.ok(result.collect > 0, `the commander must collect at least one drop (ITEM_COLLECTED=${result.collect})`);
    assert.ok(result.firstDropSample && result.firstDropSample.itemId, "a spawned drop must carry a real itemId");
    assert.deepEqual(failures, [], "the campaign sim drive must not emit console or page errors");
    await context.close();
    console.log(JSON.stringify({
      ok: true,
      kills: result.kills,
      dropsSpawned: result.spawn,
      dropsCollected: result.collect,
      maxOnField: result.maxOnField,
      firstDrop: result.firstDropSample,
      checks: ["run-kills-enemies", "kills-spawn-drops", "drop-on-field", "drop-collected"],
    }));
  } finally {
    await browser.close();
    host.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
