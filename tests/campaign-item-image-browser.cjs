"use strict";
// Playwright verification: the 3D campaign renders item drops from the unified prop
// sprite-sheet image (assets/images/sprite-2-5d/items/relic-crystal.png) as a camera-facing
// THREE.Sprite billboard — the same image the 2.5D arena uses — NOT the per-kind prop GLB.
//
// TextureLoader needs a DOM, so this can only be proven in a real browser (the node contract
// suite covers the record/metadata contract with a stubbed loader). Proof chain:
//   1. campaign.html loads and the RealtimeBattle renderer mounts (WebGL),
//   2. the item PNG is fetched over HTTP with 200,
//   3. a buff drop fed to renderSnapshot() resolves into an actor whose loaded child is a
//      THREE.Sprite carrying that texture (map.image.width === 150), with the sprite integrity
//      contract published — a regression to the GLB path would make isSprite false.
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
                : extension === ".glb" ? "model/gltf-binary"
                  : extension === ".mp4" ? "video/mp4"
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

const PROBE = () => {
  window.__campaignItemProbe = { live: null };
  import("/battle-realtime-three.js").then(({ RealtimeBattle }) => {
    const proto = RealtimeBattle.prototype;
    const originalMount = proto.mount;
    proto.mount = function patchedMount(...args) {
      const result = originalMount.apply(this, args);
      window.__campaignItemProbe.live = this;
      return result;
    };
  }).catch((error) => { window.__campaignItemProbe.error = String(error); });
};

async function main() {
  const { host, url } = await startServer();
  const browser = await playwright.chromium.launch();
  const failures = [];
  let itemPngStatus = null;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === ITEM_PNG) itemPngStatus = response.status();
    });

    await page.addInitScript(PROBE);
    await page.goto(`${url}/campaign.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__campaignItemProbe && window.__campaignItemProbe.live), null, { timeout: 20000 });

    // Feed a persistent buff drop into the live renderer until its sprite loads, then inspect it.
    const result = await page.evaluate(async () => {
      const live = window.__campaignItemProbe.live;
      const A = { width: 24000, height: 12000 };
      const n = (x, y) => ({ x: x / A.width * 2 - 1, y: y / A.height * 2 - 1, normalized: true });
      const drop = { id: "camp-item", kind: "buff", itemId: "reclaimer-pulse", modelKey: "relic", rarity: "relic", grade: "BOSS", ...n(11000, 6000), radius: 12, elevation: 0, expiresAtTick: 9e9, collectableAtTick: 9e9 };
      const cmd = { id: "cmd", kind: "commander", ...n(9000, 6000), radius: 30, hp: 1000, maxHp: 1000 };
      const mk = () => ({ tick: 10, version: 7, presentation: { stageId: "cinder-span", visualScale: 1, stagePresentation: null, terrain: null }, commander: cmd, gate: { ...n(22000, 6000), integrity: 1000, maxIntegrity: 1000 }, enemies: [], projectiles: [], companions: [], pickups: [drop], events: [] });
      let record = null;
      for (let i = 0; i < 80; i += 1) {
        live.renderSnapshot(mk(), []);
        record = live.actors?.get("camp-item");
        if (record && record.loading === false) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      let sprite = null;
      record?.root?.traverse((node) => {
        if (node.isSprite) sprite = { isSprite: true, hasMap: Boolean(node.material?.map), mapWidth: node.material?.map?.image?.width ?? null };
      });
      return {
        hasRecord: Boolean(record),
        loading: record?.loading,
        meshCount: record?.meshIntegrity?.meshCount ?? null,
        sprite,
      };
    });

    assert.equal(itemPngStatus, 200, `${ITEM_PNG} must load with 200 (got ${itemPngStatus})`);
    assert.equal(result.hasRecord, true, "the injected buff drop must produce a pickup actor");
    assert.equal(result.loading, false, "the pickup sprite must finish loading");
    assert.ok(result.sprite && result.sprite.isSprite, "the loaded pickup body must be a THREE.Sprite (unified image billboard), not a GLB mesh");
    assert.equal(result.sprite.hasMap, true, "the pickup sprite must carry a texture map");
    assert.equal(result.sprite.mapWidth, 150, `the sprite texture must be the crystal PNG (width 150, got ${result.sprite.mapWidth})`);
    assert.equal(result.meshCount, 1, "the pickup must publish the sprite meshIntegrity contract (meshCount 1)");
    assert.deepEqual(failures, [], "the campaign item-image route must not emit console or page errors");
    await context.close();
  } finally {
    await browser.close();
    host.close();
  }
  console.log(JSON.stringify({ ok: true, itemPngStatus, checks: ["png-200", "actor-created", "is-sprite", "crystal-texture", "integrity-published"] }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
