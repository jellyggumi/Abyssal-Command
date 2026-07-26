// QA visual verification harness (run-id 20260725-wellmade-verification).
//
// Measurement-only. Boots the REAL index.html against a local static server,
// destroys any service-worker registration + Cache Storage entry BEFORE the
// measured pass (the repeated trap logged in decision-log D19/Cycle-4:
// a stale SW keeps serving pre-rig GLBs and makes a verification pass lie),
// then drives a real playthrough and records:
//   - screenshots of lobby / battle entry / mid-battle / boss / defeat
//   - every HTTP request the page made, with status (404 audit)
//   - console + pageerror output
//   - input -> visible-feedback latency, measured from a real keydown to the
//     first renderSnapshot() that moved the commander, plus the rAF that
//     follows that render (presentation upper bound)
//   - proof that animation is PLAYING: frame-to-frame bone quaternion deltas
//     sampled off live actors in the real scene
//
// Usage: node scripts/qa-visual-verification.mjs
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "_workspace/20260725-wellmade-verification/qa/evidence");
const SHOTS = path.join(OUT, "screens");
const DATA = path.join(OUT, "data");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const MIME = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html",
  ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".glb": "model/gltf-binary", ".woff2": "font/woff2",
};

const served = [];
function startServer() {
  const host = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = path.resolve(ROOT, `.${rel}`);
    if (!file.startsWith(ROOT + path.sep)) { served.push({ rel, status: 403 }); return res.writeHead(403).end(); }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { served.push({ rel, status: 404 }); return res.writeHead(404).end(); }
      served.push({ rel, status: 200, bytes: stat.size });
      res.writeHead(200, { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => host.listen(0, "127.0.0.1", () => resolve({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", reject));
}

// Instrumentation injected before any page script runs. Patches the
// RealtimeBattle prototype (same module instance app.js imports -- ES module
// map is keyed by resolved URL) so we observe the REAL renderer the game
// mounts, never a second one we constructed ourselves.
const INSTRUMENT = () => {
  window.__qa = {
    frames: 0, lastSnapshot: null, live: null, renderMarks: [], keyMarks: [], boot: performance.now(),
  };
  window.addEventListener("keydown", (e) => {
    window.__qa.keyMarks.push({ key: e.key, at: performance.now() });
  }, true);
  import("/battle-realtime-three.js").then((mod) => {
    const proto = mod.RealtimeBattle.prototype;
    const original = proto.renderSnapshot;
    proto.renderSnapshot = function patched(snapshot, frame) {
      const out = original.call(this, snapshot, frame);
      const qa = window.__qa;
      qa.live = this;
      qa.frames += 1;
      const commander = this.actors?.get("commander");
      qa.lastSnapshot = {
        tick: snapshot?.tick ?? null,
        enemies: (snapshot?.enemies ?? []).length,
        boss: (snapshot?.enemies ?? []).some((e) => e.class === "boss"),
        companions: (snapshot?.companions ?? []).length,
        actorCount: this.actors?.size ?? 0,
        commanderX: commander?.root?.position?.x ?? null,
        commanderZ: commander?.root?.position?.z ?? null,
        at: performance.now(),
      };
      if (qa.armed) {
        const rec = qa.lastSnapshot;
        const moved = qa.armed.baseX !== null && rec.commanderX !== null
          && Math.hypot(rec.commanderX - qa.armed.baseX, rec.commanderZ - qa.armed.baseZ) > 1e-4;
        if (moved) {
          const renderedAt = performance.now();
          const armed = qa.armed;
          qa.armed = null;
          requestAnimationFrame(() => {
            qa.renderMarks.push({
              key: armed.key, keyAt: armed.keyAt, renderedAt,
              presentedAt: performance.now(), tick: rec.tick,
            });
          });
        }
      }
      return out;
    };
    window.__qa.THREE = mod;
    window.__qa.patched = true;
  });

  // DEFECT B probe, run against the LIVE scene at the real gameplay camera:
  // for every actor, isolate it (hide every other actor + terrain + vfx),
  // render one frame, and readPixels the drawing buffer. That yields the
  // actor's true rendered silhouette area and its mean rendered colour --
  // lighting, environment map, camera distance and all -- which is exactly
  // what a player's eye receives. Restores visibility synchronously.
  window.__qaSceneReadout = async () => {
    const qa = window.__qa;
    const live = qa.live;
    if (!live?.renderer || !live.scene || !live.camera) return { error: "no live webgl scene" };
    const THREE = await import("/vendor/three.module.js");
    const gl = live.renderer.getContext();
    const W = live.renderer.domElement.width;
    const H = live.renderer.domElement.height;
    const buf = new Uint8Array(W * H * 4);

    const roots = [];
    for (const [id, rec] of live.actors) if (rec.root) roots.push({ id, rec });
    const groups = [live.terrainGroup, live.vfxGroup].filter(Boolean);

    const prevVisible = new Map();
    const setAll = (value) => {
      for (const { id, rec } of roots) { if (!prevVisible.has(id)) prevVisible.set(id, rec.root.visible); rec.root.visible = value; }
      for (const g of groups) g.visible = value;
    };
    const gateVisible = live.gateMesh ? live.gateMesh.visible : null;

    const shoot = () => {
      live.renderer.render(live.scene, live.camera);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    };

    // background plate: everything hidden
    setAll(false);
    if (live.gateMesh) live.gateMesh.visible = false;
    const bg = shoot().slice();

    const out = [];
    for (const { id, rec } of roots) {
      setAll(false);
      if (live.gateMesh) live.gateMesh.visible = false;
      rec.root.visible = true;
      const px = shoot();
      let n = 0, r = 0, g2 = 0, b = 0;
      let minX = W, maxX = -1, minY = H, maxY = -1;
      for (let i = 0; i < W * H; i += 1) {
        const o = i * 4;
        const dr = px[o] - bg[o], dg = px[o + 1] - bg[o + 1], db = px[o + 2] - bg[o + 2];
        if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) < 12) continue;
        n += 1; r += px[o]; g2 += px[o + 1]; b += px[o + 2];
        const x = i % W, y = (i / W) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      // world-space size for cross-check
      const box = new THREE.Box3().setFromObject(rec.root);
      const size = box.getSize(new THREE.Vector3());
      out.push({
        id, kind: rec.kind, modelPath: rec.modelPath, action: rec.activeActionKey,
        silhouettePx: n,
        meanRgb: n ? [Math.round(r / n), Math.round(g2 / n), Math.round(b / n)] : null,
        bboxPx: n ? { w: maxX - minX + 1, h: maxY - minY + 1 } : null,
        worldHeight: size.y, worldWidth: Math.max(size.x, size.z),
      });
    }
    for (const { id, rec } of roots) rec.root.visible = prevVisible.get(id) ?? true;
    for (const g of groups) g.visible = true;
    if (live.gateMesh && gateVisible !== null) live.gateMesh.visible = gateVisible;
    return { canvas: { w: W, h: H }, dpr: window.devicePixelRatio, actors: out };
  };
};

async function clearServiceWorkerAndCaches(page) {
  // Trap guard, run BEFORE the measured pass. Reported verbatim in the QA doc.
  const before = await page.evaluate(async () => ({
    registrations: (await navigator.serviceWorker?.getRegistrations?.() ?? []).length,
    caches: (await caches?.keys?.() ?? []).length,
    cacheNames: await caches?.keys?.() ?? [],
  }));
  await page.evaluate(async () => {
    for (const reg of await navigator.serviceWorker?.getRegistrations?.() ?? []) await reg.unregister();
    for (const name of await caches?.keys?.() ?? []) await caches.delete(name);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.clearBrowserCache").catch(() => {});
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true }).catch(() => {});
  const after = await page.evaluate(async () => ({
    registrations: (await navigator.serviceWorker?.getRegistrations?.() ?? []).length,
    caches: (await caches?.keys?.() ?? []).length,
  }));
  return { before, after };
}

function attachDiagnostics(page, sink) {
  page.on("pageerror", (e) => sink.errors.push({ kind: "pageerror", message: e.message }));
  page.on("console", (m) => {
    if (m.type() === "error") sink.errors.push({ kind: "console", message: m.text() });
    if (m.type() === "warning") sink.warnings.push(m.text());
  });
  page.on("requestfailed", (r) => sink.requestFailures.push({ url: r.url(), failure: r.failure()?.errorText }));
  page.on("response", (r) => {
    const u = new URL(r.url());
    sink.responses.push({ path: u.pathname, status: r.status() });
  });
}

async function shoot(page, name, note) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, animations: "allow" });
  const rel = path.relative(ROOT, file);
  console.log(`  shot ${name} -> ${rel}${note ? ` (${note})` : ""}`);
  return rel;
}

// Samples every live actor's skeleton across frames: for each frame we record
// each bone's world quaternion, then report the max/mean angular delta between
// consecutive samples. A static T-pose yields all-zero deltas; this is the only
// way to PROVE motion rather than assert it.
const BONE_SAMPLER = async (frames, gapMs) => {
  const qa = window.__qa;
  const readAll = () => {
    const out = {};
    for (const [id, rec] of qa.live.actors) {
      if (!rec.root) continue;
      const bones = [];
      rec.root.traverse((n) => { if (n.isBone) bones.push(n); });
      if (!bones.length) continue;
      out[id] = {
        kind: rec.kind, modelPath: rec.modelPath, action: rec.activeActionKey,
        hasMixer: Boolean(rec.mixer), boneCount: bones.length,
        q: bones.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]),
        names: bones.map((b) => b.name),
      };
    }
    return out;
  };
  const samples = [];
  for (let i = 0; i < frames; i += 1) {
    samples.push({ at: performance.now(), actors: readAll() });
    await new Promise((r) => setTimeout(r, gapMs));
  }
  // angle between quaternions: 2*acos(|dot|)
  const ang = (a, b) => {
    const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
    return 2 * Math.acos(d);
  };
  const report = {};
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1], cur = samples[i];
    for (const id of Object.keys(cur.actors)) {
      if (!prev.actors[id]) continue;
      const a = prev.actors[id].q, b = cur.actors[id].q;
      if (a.length !== b.length) continue;
      const deltas = a.map((q, k) => ang(q, b[k]));
      const maxD = Math.max(...deltas);
      const meanD = deltas.reduce((s, v) => s + v, 0) / deltas.length;
      const movedBones = deltas.filter((d) => d > 1e-4).length;
      const r = report[id] ??= {
        kind: cur.actors[id].kind, modelPath: cur.actors[id].modelPath,
        boneCount: cur.actors[id].boneCount, hasMixer: cur.actors[id].hasMixer,
        actions: new Set(), samples: 0, maxDelta: 0, sumMean: 0, maxMovedBones: 0, dtSum: 0,
      };
      r.actions.add(cur.actors[id].action);
      r.samples += 1;
      r.maxDelta = Math.max(r.maxDelta, maxD);
      r.sumMean += meanD;
      r.maxMovedBones = Math.max(r.maxMovedBones, movedBones);
      r.dtSum += cur.at - prev.at;
    }
  }
  return Object.fromEntries(Object.entries(report).map(([id, r]) => [id, {
    kind: r.kind, modelPath: r.modelPath, boneCount: r.boneCount, hasMixer: r.hasMixer,
    actions: [...r.actions], samples: r.samples,
    maxDeltaRad: r.maxDelta, meanDeltaRad: r.sumMean / r.samples,
    maxMovedBones: r.maxMovedBones, meanGapMs: r.dtSum / r.samples,
    moving: r.maxDelta > 1e-4,
  }]));
};

async function bootLobby(browser, hosting, viewport) {
  const context = await browser.newContext({ baseURL: hosting.url, viewport, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const sink = { errors: [], warnings: [], requestFailures: [], responses: [] };
  attachDiagnostics(page, sink);
  await page.addInitScript(INSTRUMENT);
  // First load: registers the SW (this is what a returning player has).
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const swHygiene = await clearServiceWorkerAndCaches(page);
  // Measured pass starts here, on a guaranteed cache-free client.
  served.length = 0;
  sink.responses.length = 0;
  sink.requestFailures.length = 0;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#defense-app.defense-lobby").waitFor();
  await page.waitForTimeout(1500);
  return { context, page, sink, swHygiene };
}

async function runVictoryRoute(browser, hosting) {
  const shots = {};
  const { context, page, sink, swHygiene } = await bootLobby(browser, hosting, { width: 844, height: 390 });
  const result = { swHygiene, shots, sink, latency: [], bones: {}, timeline: [] };
  try {
    shots.lobby = await shoot(page, "01-lobby", "landscape 844x390 @2x");

    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });
    await page.waitForTimeout(700);
    shots.battleEntry = await shoot(page, "02-battle-entry-cutscene");

    const cutscene = page.locator("#defense-cutscene-overlay");
    if (await cutscene.isVisible().catch(() => false)) {
      await cutscene.locator("[data-cutscene-dismiss]").click().catch(() => {});
      await cutscene.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    }
    await page.waitForFunction(() => window.__qa?.patched === true, null, { timeout: 15000 });
    await page.waitForFunction(() => (window.__qa?.lastSnapshot?.actorCount ?? 0) > 1, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    shots.battleOpen = await shoot(page, "03-battle-open");

    // ---- latency probe -------------------------------------------------
    // The growth offer PAUSES the sim ("성장 선택 중 · 전투 정지"), so a keydown
    // taken while it is open can never move the commander. Clear every offer
    // and confirm the sim is actually ticking before arming.
    const clearOffers = () => page.evaluate(() => {
      const offer = document.querySelector("#defense-growth-offer");
      const btn = offer?.querySelector("button[data-pick]");
      if (btn) { btn.click(); return true; }
      return false;
    });
    for (let i = 0; i < 12; i += 1) { if (!await clearOffers()) break; await page.waitForTimeout(120); }
    await page.waitForFunction(() => {
      const qa = window.__qa;
      const t0 = qa.lastSnapshot?.tick;
      return new Promise((r) => setTimeout(() => r(qa.lastSnapshot?.tick > t0), 200));
    }, null, { timeout: 20000 }).catch(() => {});
    result.simTicking = await page.evaluate(async () => {
      const t0 = window.__qa.lastSnapshot?.tick;
      await new Promise((r) => setTimeout(r, 300));
      return { t0, t1: window.__qa.lastSnapshot?.tick };
    });

    for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft"]) {
      await clearOffers();
      // Wait for the commander to be stationary so the first observed movement
      // is attributable to OUR key, not to an auto-route already in progress.
      await page.waitForFunction(() => {
        const qa = window.__qa;
        const a = qa.lastSnapshot;
        if (!a) return false;
        return new Promise((r) => setTimeout(() => {
          const b = qa.lastSnapshot;
          r(b && Math.hypot(b.commanderX - a.commanderX, b.commanderZ - a.commanderZ) < 1e-5);
        }, 120));
      }, null, { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => {
        const qa = window.__qa;
        qa.armed = { key: null, keyAt: null, baseX: qa.lastSnapshot?.commanderX ?? null, baseZ: qa.lastSnapshot?.commanderZ ?? null };
        qa.armedAt = performance.now();
      });
      await page.keyboard.down(key);
      await page.evaluate((key) => {
        const qa = window.__qa;
        const mark = [...qa.keyMarks].reverse().find((m) => m.at >= qa.armedAt);
        if (qa.armed) { qa.armed.key = key; qa.armed.keyAt = mark?.at ?? qa.armedAt; qa.armed.sawKeyEvent = Boolean(mark); }
      }, key);
      await page.waitForFunction((n) => window.__qa.renderMarks.length > n, result.latency.length, { timeout: 6000 }).catch(() => {});
      await page.keyboard.up(key);
      await page.waitForTimeout(300);
      result.latency = await page.evaluate(() => window.__qa.renderMarks);
    }
    result.keyEventsSeen = await page.evaluate(() => window.__qa.keyMarks.length);
    result.timeline.push({ phase: "latency-probe-done", marks: result.latency.length });

    // ---- animation proof: bone quaternion deltas on live actors
    result.bones.earlyBattle = await page.evaluate(BONE_SAMPLER, [24, 40]);
    shots.midBattle = await shoot(page, "04-mid-battle-engaged");

    // ---- bot loop toward the boss. Everything runs INSIDE one evaluate per
    // poll: Playwright locator actionability retries on a per-frame-rebuilt
    // button cost ~400ms/iteration in the prior pass and the boss (alive for
    // ~11s) came and went unobserved.
    const deadline = Date.now() + 180000;
    let bossSeen = false, midShotDone = false;
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => {
        document.querySelector("#defense-growth-offer button[data-pick]")?.click();
        document.querySelector("#extract-elite")?.click();
        return {
          snap: window.__qa.lastSnapshot,
          done: Boolean(document.querySelector(".defense-result")),
        };
      }).catch(() => null);
      if (!state) break;
      if (state.snap?.boss) { bossSeen = true; break; }
      if (!midShotDone && (state.snap?.enemies ?? 0) >= 3) {
        shots.midBattleEnemies = await shoot(page, "05-mid-battle-multi-enemy", `enemies=${state.snap.enemies}`);
        midShotDone = true;
      }
      if (state.done) break;
      await page.waitForTimeout(80);
    }
    result.bossSeen = bossSeen;
    if (bossSeen) {
      await page.waitForTimeout(600);
      shots.boss = await shoot(page, "06-boss-encounter");
      result.bones.bossFight = await page.evaluate(BONE_SAMPLER, [24, 40]);
      await page.waitForTimeout(1500);
      shots.bossFight = await shoot(page, "07-boss-engaged");
      // Per-actor on-screen size + rendered colour, read straight off the live
      // scene at the REAL gameplay camera -- the DEFECT B readability question.
      result.sceneReadout = await page.evaluate(() => window.__qaSceneReadout()).catch((e) => ({ error: String(e) }));
    }
    // terminal / result card
    await page.waitForSelector(".defense-result", { timeout: 90000 }).catch(() => {});
    if (await page.locator(".defense-result").count()) {
      await page.waitForTimeout(400);
      shots.outcome = await shoot(page, "08-run-outcome");
    }
    result.finalSnapshot = await page.evaluate(() => window.__qa.lastSnapshot).catch(() => null);
    result.frames = await page.evaluate(() => window.__qa.frames).catch(() => null);
    result.rendererMode = await page.locator("#defense-battle-surface").getAttribute("data-defense-renderer").catch(() => null);
    return result;
  } finally {
    result.servedLog = served.slice();
    await context.close();
  }
}

async function runDefeatRoute(browser, hosting) {
  const shots = {};
  const { context, page, sink } = await bootLobby(browser, hosting, { width: 844, height: 390 });
  const result = { shots, sink };
  try {
    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ state: "visible" });
    const cutscene = page.locator("#defense-cutscene-overlay");
    if (await cutscene.isVisible().catch(() => false)) {
      await cutscene.locator("[data-cutscene-dismiss]").click().catch(() => {});
      await cutscene.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    }
    // Never extract, never move: the deterministic DEFEAT route (sim-verified
    // terminal at tick 9720 == 162s wall-clock at 60Hz).
    const deadline = Date.now() + 260000;
    let lowGateShot = false;
    while (Date.now() < deadline) {
      const offer = page.locator("#defense-growth-offer");
      if (await offer.isVisible().catch(() => false)) {
        const btn = offer.locator("button[data-pick]").first();
        if (await btn.count()) await btn.click().catch(() => {});
      }
      if (await page.locator(".defense-result").count().catch(() => 0)) break;
      if (!lowGateShot) {
        const ratio = await page.evaluate(() => {
          const el = document.querySelector("#battle-gate-bar-fill");
          return el ? parseFloat(el.style.width) : 100;
        }).catch(() => 100);
        if (ratio <= 35) {
          shots.gateCritical = await shoot(page, "09-gate-critical", `gate ${ratio}%`);
          lowGateShot = true;
        }
      }
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(500);
    shots.defeat = await shoot(page, "10-defeat");
    result.resultText = await page.locator(".defense-result").textContent().catch(() => null);
    result.finalSnapshot = await page.evaluate(() => window.__qa.lastSnapshot).catch(() => null);
    return result;
  } finally {
    await context.close();
  }
}

async function main() {
  const hosting = await startServer();
  const browser = await playwright.chromium.launch({ headless: true, args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
  const report = { runId: "20260725-wellmade-verification", startedAt: new Date().toISOString() };
  try {
    console.log("[1/2] victory route");
    report.victory = await runVictoryRoute(browser, hosting);
    console.log("[2/2] defeat route");
    report.defeat = await runDefeatRoute(browser, hosting);
  } finally {
    await browser.close();
    await new Promise((r) => hosting.host.close(r));
  }
  report.servedAll = served;
  const notOk = served.filter((s) => s.status !== 200);
  report.non200 = notOk;
  const file = path.join(DATA, "visual-verification.json");
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nnon-200 responses: ${notOk.length}`);
  console.log(`report -> ${path.relative(ROOT, file)}`);
  console.log(`sha256 ${createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16)}`);
}

main().catch((e) => { console.error(e.stack || String(e)); process.exitCode = 1; });
