"use strict";
// Playwright verification: the sprite-arena item drop is drawn from the prop sprite-sheet
// image (assets/images/sprite-2-5d/items/relic-crystal.png), NOT the procedural diamond.
//
// Proof chain:
//   1. the PNG is fetched over HTTP with 200,
//   2. the game loads it into `assets.relicItem` (naturalWidth > 0, src matches),
//   3. drawPickups() actually calls context.drawImage() with that image for a live pickup —
//      wrapped drawImage counts the calls, so a regression to the diamond path (or a failed
//      load) drops the count to 0 and reddens the test.
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
const ITEM_PNG = "/assets/images/sprite-2-5d/items/relic-crystal.png";

// Appended to the served sprite-2-5d.js: everything below runs in module scope, so `assets`,
// `state`, `context`, `render`, `dismissBriefing`, and `PICKUP_LIFETIME` are all in scope.
const INSTRUMENTATION = `
let __relicDrawCalls = 0;
const __origDrawImage = context.drawImage.bind(context);
context.drawImage = function (image, ...rest) {
  if (image === assets.relicItem) __relicDrawCalls += 1;
  return __origDrawImage(image, ...rest);
};
Object.defineProperty(window, "__itemImageProbe", {
  configurable: false,
  value: Object.freeze({
    relicLoaded: () => Boolean(assets.relicItem && assets.relicItem.naturalWidth > 0),
    relicSrc: () => (assets.relicItem ? assets.relicItem.src : null),
    dismissBriefing: () => { if (typeof dismissBriefing === "function") dismissBriefing(); },
    drawOnePickup: () => {
      state.pickups.length = 0;
      state.pickups.push({ id: state.nextPickupId++, kind: "relic-mote", x: 768, y: 604, life: PICKUP_LIFETIME, bob: 0 });
      __relicDrawCalls = 0;
      render();
      return { relicDrawCalls: __relicDrawCalls, pickupCount: state.pickups.length };
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
              : extension === ".png" ? "image/png"
                : "application/octet-stream";
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
    host,
    url: `http://127.0.0.1:${host.address().port}`,
  })).on("error", reject));
}

async function main() {
  const { host, url } = await startServer();
  const browser = await playwright.chromium.launch();
  const failures = [];
  let itemPngStatus = null;
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === ITEM_PNG) itemPngStatus = response.status();
    });

    await page.goto(`${url}/`, { waitUntil: "load" });
    // Wait until the runtime has booted and loaded its assets (probe present + relic loaded).
    await page.waitForFunction(() => Boolean(window.__itemImageProbe && window.__itemImageProbe.relicLoaded()), null, { timeout: 15000 });

    // 1. the PNG was fetched with 200
    assert.equal(itemPngStatus, 200, `${ITEM_PNG} must load with 200 (got ${itemPngStatus})`);

    // 2. the game holds it as a decoded Image with the right src
    const loaded = await page.evaluate(() => window.__itemImageProbe.relicLoaded());
    const src = await page.evaluate(() => window.__itemImageProbe.relicSrc());
    assert.equal(loaded, true, "assets.relicItem must be a decoded image (naturalWidth > 0)");
    assert.ok(src && src.endsWith(ITEM_PNG), `assets.relicItem.src must be the item PNG (got ${src})`);

    // 3. drawPickups actually draws that image for a live pickup
    await page.evaluate(() => window.__itemImageProbe.dismissBriefing());
    const draw = await page.evaluate(() => window.__itemImageProbe.drawOnePickup());
    assert.equal(draw.pickupCount, 1, "the test pickup must be on the field");
    assert.ok(draw.relicDrawCalls >= 1, `drawPickups must draw the item image (relicDrawCalls=${draw.relicDrawCalls}); a value of 0 means the diamond fallback ran`);

    assert.deepEqual(failures, [], "the item-image route must not emit console or page errors");
    await context.close();
  } finally {
    await browser.close();
    host.close();
  }
  console.log(JSON.stringify({ ok: true, itemPngStatus, checks: ["png-200", "image-decoded", "drawImage-called"] }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
