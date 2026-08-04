"use strict";
// Playwright verification of the CORE question: in the arena, does killing an enemy drop an item?
//
// Runs the REAL game loop deterministically (installDeterministicAnimationClock overrides RAF so
// frames advance on demand — the headless RAF-throttle that freezes a hidden tab cannot apply),
// spawns a wave, kills one enemy through the game's own damageEnemy(), and asserts state.pickups
// gains a drop of a real item kind. Then confirms the drop is collectable (walk-to within
// PICKUP_MAGNET_RADIUS heals/charges/scores). This exercises spawnPickup -> updatePickups ->
// collectPickup end to end, in the loop, not by injecting a synthetic snapshot.
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

// Appended to the served sprite-2-5d.js — runs in module scope, so `state`, `player`,
// `damageEnemy`, `ITEM_KINDS`, `PICKUP_MAGNET_RADIUS`, `dismissBriefing` are all in scope.
const INSTRUMENTATION = `
Object.defineProperty(window, "__itemDropProbe", {
  configurable: false,
  value: Object.freeze({
    dismissBriefing: () => { if (typeof dismissBriefing === "function") dismissBriefing(); },
    mode: () => state.mode,
    livingEnemies: () => state.enemies.filter((e) => !e.dead).length,
    pickupState: () => ({
      count: state.pickups.length,
      kinds: state.pickups.map((p) => p.kind),
      kills: state.kills,
      relics: state.relics,
      health: player.health,
      charge: state.charge,
    }),
    itemKinds: () => Object.keys(ITEM_KINDS),
    // Deterministically kill the nearest living enemy through the real damage path,
    // which triggers spawnPickup() on death. Returns the pickup count just AFTER the kill,
    // before any collection tick runs.
    killNearestEnemy: () => {
      const living = state.enemies.filter((e) => !e.dead);
      if (!living.length) return { killed: false };
      let best = living[0];
      let bestDist = Infinity;
      for (const e of living) {
        const dx = e.x - player.x; const dy = (e.y - player.y) * 1.42;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = e; }
      }
      const beforeCount = state.pickups.length;
      damageEnemy(best, 999999);
      const dropped = state.pickups[state.pickups.length - 1];
      return {
        killed: true,
        beforeCount,
        afterCount: state.pickups.length,
        droppedKind: dropped ? dropped.kind : null,
        dropX: dropped ? dropped.x : null,
        dropY: dropped ? dropped.y : null,
      };
    },
    // Teleport the player onto a field pickup and report whether a collection effect fires.
    collectFieldPickup: () => {
      const pickup = state.pickups.find((p) => p.life > 0);
      if (!pickup) return { hadPickup: false };
      const before = { relics: state.relics, health: player.health, charge: state.charge, count: state.pickups.length, kind: pickup.kind };
      player.x = pickup.x; player.y = pickup.y; // within magnet radius (distance 0)
      return { hadPickup: true, before };
    },
  }),
});
`;

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
        : extension === ".css" ? "text/css"
          : extension === ".json" ? "application/json"
            : extension === ".html" ? "text/html"
              : extension === ".png" ? "image/png" : "application/octet-stream";
      const headers = { "Cache-Control": "no-store", "Content-Type": contentType };
      if (relativePath === "sprite-2-5d.js") {
        return fs.readFile(file, "utf8", (readError, source) => {
          if (readError) return response.writeHead(500).end();
          response.writeHead(200, headers);
          response.end(`${source}\n${INSTRUMENTATION}`);
        });
      }
      response.writeHead(200, headers);
      fs.createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({
    host, url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

// Deterministic RAF: game frames advance only when we call __step(n).
const DETERMINISTIC_CLOCK = () => {
  let now = 0;
  let pending = new Map();
  let nextId = 1;
  window.requestAnimationFrame = (cb) => { const id = nextId++; pending.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { pending.delete(id); };
  window.__step = (count) => {
    for (let i = 0; i < count; i += 1) {
      now += 1000 / 60;
      const callbacks = pending; pending = new Map();
      for (const cb of callbacks.values()) cb(now);
    }
  };
};

async function main() {
  const { host, url } = await startServer();
  const browser = await playwright.chromium.launch();
  const failures = [];
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const page = await context.newPage();
    page.on("console", (m) => { if (m.type() === "error") failures.push(`console: ${m.text()}`); });
    page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
    await page.addInitScript(DETERMINISTIC_CLOCK);
    await page.goto(`${url}/`, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.__itemDropProbe), null, { timeout: 15000 });

    const itemKinds = await page.evaluate(() => window.__itemDropProbe.itemKinds());
    assert.ok(itemKinds.length >= 1, "the arena must define item kinds");

    // Start the run and pump frames until enemies spawn.
    await page.evaluate(() => window.__itemDropProbe.dismissBriefing());
    let living = 0;
    for (let i = 0; i < 240 && living === 0; i += 1) {
      await page.evaluate(() => window.__step(1));
      living = await page.evaluate(() => window.__itemDropProbe.livingEnemies());
    }
    assert.ok(living > 0, `enemies must spawn in the running loop (saw ${living})`);

    // THE CORE CHECK: kill an enemy -> an item drops.
    const kill = await page.evaluate(() => window.__itemDropProbe.killNearestEnemy());
    assert.equal(kill.killed, true, "a living enemy must be killable");
    assert.equal(kill.afterCount, kill.beforeCount + 1, `killing an enemy must drop exactly one item (before ${kill.beforeCount}, after ${kill.afterCount})`);
    assert.ok(itemKinds.includes(kill.droppedKind), `the dropped item must be a real kind (got ${kill.droppedKind})`);

    // The drop is collectable: keep the player on it and pump frames until updatePickups runs.
    // Kind-agnostic proof: the pickup count must drop (an oil-flask at max charge still leaves
    // the field even though no resource visibly changes).
    const staged = await page.evaluate(() => window.__itemDropProbe.collectFieldPickup());
    assert.equal(staged.hadPickup, true, "a field pickup must be present to collect");
    let after = staged.before;
    for (let i = 0; i < 10; i += 1) {
      // Re-place each frame so player movement/knockback cannot drift it off the pickup.
      await page.evaluate(() => window.__itemDropProbe.collectFieldPickup());
      await page.evaluate(() => window.__step(1));
      after = await page.evaluate(() => window.__itemDropProbe.pickupState());
      if (after.count < staged.before.count) break;
    }
    const collected = after.count < staged.before.count
      || after.relics > staged.before.relics
      || after.health > staged.before.health
      || after.charge > staged.before.charge;
    assert.ok(collected, `walking onto the drop must collect it (kind ${staged.before.kind}; before ${JSON.stringify(staged.before)}, after ${JSON.stringify(after)})`);

    assert.deepEqual(failures, [], "the item-drop route must not emit console or page errors");
    await context.close();
    console.log(JSON.stringify({
      ok: true,
      droppedKind: kill.droppedKind,
      dropAt: { x: Math.round(kill.dropX), y: Math.round(kill.dropY) },
      collectedKind: staged.before.kind,
      checks: ["enemies-spawn", "kill-drops-item", "item-is-real-kind", "drop-collectable"],
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
