#!/usr/bin/env node
// Capture the NAN 2026 submission play video for the Cinder Court route.
//
// Every frame in the output is a frame the browser actually rendered while the
// game was actually running. The driver sends real key events through the
// Chrome DevTools Protocol input domain - the same path a physical keyboard
// takes - and Playwright encodes the resulting page frames. Nothing is
// composited, retimed, interpolated, or generated.
//
//   node scripts/capture-cinder-court-play.mjs [--seconds 50] [--out <path>]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".glb": "model/gltf-binary", ".wasm": "application/wasm",
};

function parseArgs(argv) {
  const args = { seconds: 50, out: "assets/video/nan2026-cinder-court-play.mp4" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--seconds") args.seconds = Number(argv[++i]);
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

const ATTACK_RANGE = 160;
const NOVA_RADIUS = 250;
// The Warden outranges the Cohort (160 vs 76), so competent play holds a
// stand-off band: close enough to strike, far enough to never be struck.
const ENGAGE_MAX = 146;
const ENGAGE_MIN = 102;
const DIRS = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { server, port } = await serve();
  const videoDir = fs.mkdtempSync(path.join(ROOT, "tmp", "cc-capture-"));

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.body.dataset.gameState === "running", null, { timeout: 30000 },
  );
  await page.waitForTimeout(800);
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(1000);

  const held = new Set();
  const hold = async (dirs) => {
    for (const d of Object.keys(DIRS)) {
      const want = dirs.includes(d);
      if (want && !held.has(d)) { await page.keyboard.down(DIRS[d]); held.add(d); }
      if (!want && held.has(d)) { await page.keyboard.up(DIRS[d]); held.delete(d); }
    }
  };
  const releaseAll = async () => {
    for (const d of [...held]) { await page.keyboard.up(DIRS[d]); held.delete(d); }
  };

  const readState = () => page.evaluate(() => {
    const snap = window.__SPRITE_2_5D_TEST__.readRenderSnapshot();
    const actors = snap.actors.map((a) => ({
      kind: a.kind, x: a.spriteAnchor.x, y: a.spriteAnchor.y,
    }));
    const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? "";
    const num = (sel) => Number(text(sel).replace(/[^\d.-]/g, "").split(/(?=\/)/)[0]) || 0;
    return {
      mode: document.body.dataset.gameState,
      player: actors.find((a) => a.kind === "player") ?? null,
      enemies: actors.filter((a) => a.kind === "enemy"),
      health: Number(text("#sprite-2-5d-health-value").split("/")[0]) || 0,
      oil: Number(text("#sprite-2-5d-charge-value").split("/")[0]) || 0,
      wave: num("#sprite-2-5d-wave"),
      score: Number(text("#sprite-2-5d-score").replace(/\D/g, "")) || 0,
      relics: num("#sprite-2-5d-relics"),
      novaReady: /ready/i.test(text("#sprite-2-5d-skill-nova-cooldown")),
      wardReady: /ready/i.test(text("#sprite-2-5d-skill-ward-cooldown")),
    };
  });

  const started = Date.now();
  const log = { attacks: 0, nova: 0, ward: 0, restarts: 0, waves: new Set(), beats: [] };
  let lastAttack = 0;
  const at = () => Number(((Date.now() - started) / 1000).toFixed(1));

  while (Date.now() - started < args.seconds * 1000) {
    const s = await readState();
    log.waves.add(s.wave);

    if (s.mode !== "running" && s.mode !== "wave-clear") {
      await releaseAll();
      await page.keyboard.press("KeyR");
      log.restarts += 1;
      log.beats.push({ t: at(), beat: "restart" });
      await page.waitForTimeout(1400);
      continue;
    }
    if (!s.player || s.enemies.length === 0) {
      await hold([]);
      await page.waitForTimeout(80);
      continue;
    }

    // The arena is isometric: every combat check in the build weights the y
    // axis by 1.42, so the driver has to measure the same way the game does.
    const combatDistance = (e) => Math.hypot(e.x - s.player.x, (e.y - s.player.y) * 1.42);
    let target = null;
    let best = Infinity;
    for (const e of s.enemies) {
      const d = combatDistance(e);
      if (d < best) { best = d; target = e; }
    }
    const ringed = s.enemies.filter((e) => combatDistance(e) <= NOVA_RADIUS).length;

    if (s.novaReady && s.oil >= 45 && ringed >= 2) {
      await page.keyboard.press("KeyQ");
      log.nova += 1;
      log.beats.push({ t: at(), beat: "ember-nova", ringed });
      await page.waitForTimeout(260);
      continue;
    }
    if (s.wardReady && s.oil >= 30 && (s.health <= 72 || (best < ENGAGE_MIN && ringed >= 2))) {
      await page.keyboard.press("KeyE");
      log.ward += 1;
      log.beats.push({ t: at(), beat: "lantern-ward", health: s.health });
      await page.waitForTimeout(240);
      continue;
    }

    const dx = target.x - s.player.x;
    const dy = target.y - s.player.y;
    const dirs = [];

    // A strike only lands when the target sits on the Warden's facing side
    // (dx * facing >= -18), and facing is owned by horizontal input. So the
    // driver always leans toward the target on x and spaces the fight on y.
    if (Math.abs(dx) > 12) dirs.push(dx > 0 ? "right" : "left");
    if (best > ENGAGE_MAX) {
      if (Math.abs(dy) > 14) dirs.push(dy > 0 ? "down" : "up");
    } else if (best < ENGAGE_MIN) {
      dirs.push(dy > 0 ? "up" : "down");
    }
    await hold(dirs);

    if (best <= ATTACK_RANGE * 0.95 && Date.now() - lastAttack > 300) {
      await page.keyboard.press("Space");
      log.attacks += 1;
      lastAttack = Date.now();
    }
    await page.waitForTimeout(65);
  }

  await releaseAll();
  await page.waitForTimeout(600);
  const final = await readState();

  const video = page.video();
  await context.close();
  await browser.close();
  server.close();

  const raw = await video.path();
  const outPath = path.join(ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.copyFileSync(raw, outPath);
  fs.rmSync(videoDir, { recursive: true, force: true });

  console.log(JSON.stringify({
    output: args.out,
    requestedSeconds: args.seconds,
    attacks: log.attacks,
    emberNovaCasts: log.nova,
    lanternWardCasts: log.ward,
    restarts: log.restarts,
    wavesReached: [...log.waves].sort((a, b) => a - b),
    final: {
      wave: final.wave, score: final.score, relics: final.relics,
      health: final.health, oil: final.oil, mode: final.mode,
    },
    pageErrors,
    beats: log.beats,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
