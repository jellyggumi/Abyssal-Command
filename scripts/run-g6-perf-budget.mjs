#!/usr/bin/env node
/**
 * G6 perf-budget protocol runner (formal, cycle 20260725-wellmade-verification).
 *
 * Measures the REAL cost of the current WebGL path -- rigged GLB actors with
 * one THREE.AnimationMixer per actor over SkeletonUtils.clone()'d 24-joint
 * skeletons -- during an ACTIVE boss battle, and reports it as a delta against
 * the Canvas2D BattleVisualizer fallback replaying the identical seeded
 * simulation.
 *
 * Read-only with respect to game code: this script imports the shipping
 * modules unmodified and never writes to them.
 *
 * Modes (positional arg):
 *   scenario  - boss-active frame timing, 3D vs Canvas2D, draw calls, orbit cost
 *   leak      - actor spawn/despawn cycles, GPU texture + JS heap trend
 *   soak      - long-duration live battle, heap slope + long-frame ratio
 *
 * Env:
 *   G6_FRAMES     frame sample count for scenario mode (default 900)
 *   G6_SOAK_MS    soak duration ms (default 600000)
 *   G6_OUT        output JSON path
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODE = process.argv[2] ?? "scenario";
const FRAMES = Number(process.env.G6_FRAMES ?? 900);
const STAGE = process.env.G6_STAGE ?? "gate-zenith";
const SEED = Number(process.env.G6_SEED ?? 2962819252);
const SOAK_MS = Number(process.env.G6_SOAK_MS ?? 600_000);

const CONTENT_TYPE = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".glb": "model/gltf-binary", ".ico": "image/x-icon", ".wav": "audio/wav",
};

function serve() {
  const host = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.resolve(ROOT, `.${decodeURIComponent(pathname)}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return res.writeHead(403).end();
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) return res.writeHead(404).end();
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": CONTENT_TYPE[path.extname(file)] ?? "text/html",
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((ok, bad) => host.listen(0, "127.0.0.1", () =>
    ok({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", bad));
}

/**
 * Shared page-side preamble: drives the real defense-run-simulation.js to a
 * live-boss state with a full 3-companion loadout, and exposes helpers.
 * Installed as a page function so both renderers replay identical sim input.
 */
const PAGE_PRELUDE = `
window.__g6 = (async () => {
  const sim = await import("/defense-run-simulation.js");
  const { ARENA } = await import("/defense-catalog.js");
  const three = await import("/battle-realtime-three.js");
  const canvas2d = await import("/battle-visualizer.js");
  const { createDefenseRun, advanceDefenseRun, getRunSnapshot, isTerminalRun, queueInput } = sim;

  const LOADOUT = ["ember-cohort", "rift-lens", "veil-vanguard"];

  function step(run, octant) {
    const offer = getRunSnapshot(run).growthOffer;
    let next = offer ? queueInput(run, "SKILL_SELECTED", { skillId: offer.choices[0] }) : run;
    const snap = getRunSnapshot(next);
    next = queueInput(next, "MOVE", { octant: octant ?? "IDLE" });
    if (snap.eliteCandidate && !snap.extracted) {
      next = queueInput(next, "EXTRACT_ELITE", { enemyId: snap.eliteCandidate.enemyId });
    }
    return advanceDefenseRun(next, 1);
  }

  const project = (e) => ({ ...e, x: (e.x / ARENA.width) * 2 - 1, y: (e.y / ARENA.height) * 2 - 1 });
  function projectSnapshot(snap, stageId) {
    return {
      ...snap,
      presentation: { stageId },
      commander: project(snap.commander),
      enemies: snap.enemies.map(project),
      companions: snap.companions.map(project),
    };
  }

  // Advance a fresh run to the tick with the MOST concurrent enemies (the
  // real worst-case actor load -- verified separately that a stage boss never
  // co-exists with a live wave, so peak concurrency and the boss fight are
  // two DIFFERENT scenarios and both must be measured).
  function driveToPeak(stageId, seed, budget) {
    let run = createDefenseRun({ stageId, seed, companionLoadout: LOADOUT });
    let best = null;
    const octs = ["E","NE","N","NW","W","SW","S","SE"];
    for (let i = 0; i < (budget ?? 6000) && !isTerminalRun(run); i += 1) {
      run = step(run, octs[i % 8]);
      const snap = getRunSnapshot(run);
      if (!best || snap.enemies.length > best.snapshot.enemies.length) {
        best = { run, snapshot: snap, tick: snap.tick };
      }
    }
    return best ?? { run, snapshot: getRunSnapshot(run), tick: getRunSnapshot(run).tick };
  }

  // Advance a fresh run until a boss is live (the heaviest on-screen state).
  function driveToBoss(stageId, seed, budget) {
    let run = createDefenseRun({ stageId, seed, companionLoadout: LOADOUT });
    for (let i = 0; i < (budget ?? 4000) && !isTerminalRun(run); i += 1) {
      run = step(run, ["E","NE","N","NW","W","SW","S","SE"][i % 8]);
      const snap = getRunSnapshot(run);
      if (snap.enemies.some((e) => e.class === "boss")) return { run, snapshot: snap, tick: snap.tick };
    }
    return { run, snapshot: getRunSnapshot(run), tick: getRunSnapshot(run).tick, noBoss: true };
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    Object.assign(c.style, { width: w + "px", height: h + "px", position: "fixed", inset: "0" });
    document.body.appendChild(c);
    return c;
  }

  const pct = (values, f) => {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(s.length * f) - 1)];
  };
  const stats = (values) => ({
    n: values.length,
    mean: values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3) : null,
    p50: values.length ? +pct(values, 0.5).toFixed(3) : null,
    p95: values.length ? +pct(values, 0.95).toFixed(3) : null,
    p99: values.length ? +pct(values, 0.99).toFixed(3) : null,
    max: values.length ? +Math.max(...values).toFixed(3) : null,
  });

  function sceneStats(rb) {
    let mixers = 0, skinned = 0, skeletons = 0, bones = 0, boneTextures = 0;
    const seenSkel = new Set();
    for (const rec of rb.actors.values()) if (rec.mixer) mixers += 1;
    for (const v of rb.vfxInstances) if (v.mixer) mixers += 1;
    rb.scene.traverse((n) => {
      if (n.isSkinnedMesh) {
        skinned += 1;
        if (n.skeleton && !seenSkel.has(n.skeleton)) {
          seenSkel.add(n.skeleton);
          skeletons += 1;
          bones += n.skeleton.bones.length;
          if (n.skeleton.boneTexture) boneTextures += 1;
        }
      }
    });
    return { mixers, skinnedMeshes: skinned, skeletons, bones, boneTextures, actors: rb.actors.size };
  }

  return { sim, three, canvas2d, ARENA, LOADOUT, step, project, projectSnapshot,
           driveToBoss, driveToPeak, makeCanvas, pct, stats, sceneStats, getRunSnapshot, isTerminalRun };
})();
`;

async function newPage(browser, hosting, opts = {}) {
  const context = await browser.newContext({
    baseURL: hosting.url,
    viewport: opts.viewport ?? { width: 844, height: 390 },
    deviceScaleFactor: opts.deviceScaleFactor ?? 1,
    hasTouch: true,
    isMobile: false,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (opts.cpuThrottle && opts.cpuThrottle > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: opts.cpuThrottle });
  }
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(PAGE_PRELUDE);
  await page.evaluate(() => window.__g6);
  return { context, page, errors, cdp };
}

// ---------------------------------------------------------------- scenario
/**
 * One measurement pass at a given device-scale-factor and CPU-throttle tier.
 * Measures TWO distinct load states, because a stage boss never co-exists
 * with a live enemy wave in this simulation (verified separately: peak
 * concurrency and boss-alive are disjoint), so they are two different
 * worst cases and both must be measured:
 *   wave-peak : the tick with the most concurrent enemies (worst actor count)
 *   boss      : boss alive (worst per-actor triangle count)
 * Each is measured HELD (the same peak snapshot replayed every frame with
 * live animation, so load stays pinned at worst case) and LIVE (sim advances,
 * load decays naturally). Held is the honest sustained-worst-case number.
 */
async function scenarioPass(browser, hosting, tier) {
  const { context, page, errors } = await newPage(browser, hosting, {
    deviceScaleFactor: tier.dsf,
    cpuThrottle: tier.cpuThrottle,
  });
  try {
    const gpu = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const d = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null,
        timerQuery: !!gl.getExtension("EXT_disjoint_timer_query_webgl2"),
        dpr: devicePixelRatio,
      };
    });

    const result = await page.evaluate(async ({ frames, stageId, seed }) => {
      const g = await window.__g6;
      const out = {};
      const OCT = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];

      const peak = g.driveToPeak(stageId, seed, 6000);
      const boss = g.driveToBoss(stageId, seed, 6000);
      const describe = (s) => ({
        tick: s.tick,
        enemies: s.enemies.length,
        bosses: s.enemies.filter((e) => e.class === "boss").length,
        companions: s.companions.length,
        projectiles: (s.projectiles ?? []).length,
        pickups: (s.pickups ?? []).length,
        totalActors: s.enemies.length + s.companions.length + 1,
      });
      out.stageId = stageId;
      out.wavePeakScene = describe(peak.snapshot);
      out.bossScene = describe(boss.snapshot);

      // Canvas sized exactly the way app.js sizes it (app.js:917-919):
      // CSS box * min(devicePixelRatio, 2). Anything else mis-states fill cost.
      const ratio = Math.min(devicePixelRatio || 1, 2);
      out.appliedPixelRatio = ratio;
      out.backingStore = { w: Math.round(844 * ratio), h: Math.round(390 * ratio) };

      function makeSizedCanvas() {
        const c = document.createElement("canvas");
        c.width = out.backingStore.w;
        c.height = out.backingStore.h;
        Object.assign(c.style, { width: "844px", height: "390px", position: "fixed", inset: "0" });
        document.body.appendChild(c);
        return c;
      }

      /**
       * mode "held" replays heldSnapshot every frame (load pinned at worst
       * case); mode "live" advances the real sim from startRun.
       */
      async function measure(rb, kind, { mode, heldSnapshot, startRun, orbit }) {
        let run = startRun;
        const frameDeltas = [], renderMs = [], simMs = [];
        const drawCalls = [], triangles = [], enemyCounts = [];
        let prev, done, longFrames = 0, i = 0;
        const finished = new Promise((r) => { done = r; });

        const tick = (now) => {
          if (prev !== undefined) {
            const d = now - prev;
            frameDeltas.push(d);
            if (d > 33.4) longFrames += 1;
          }
          prev = now;

          let projected;
          if (mode === "held") {
            projected = heldSnapshot;
            enemyCounts.push(heldSnapshot.enemies.length);
          } else {
            const t0 = performance.now();
            run = g.step(run, OCT[i % 8]);
            const snap = g.getRunSnapshot(run);
            simMs.push(performance.now() - t0);
            projected = g.projectSnapshot(snap, stageId);
            enemyCounts.push(snap.enemies.length);
          }

          if (orbit && rb.orbit) rb.orbit(0.01, 0.002);
          const t2 = performance.now();
          rb.renderSnapshot(projected, {});
          renderMs.push(performance.now() - t2);

          if (kind === "webgl" && rb.renderer?.info) {
            drawCalls.push(rb.renderer.info.render.calls);
            triangles.push(rb.renderer.info.render.triangles);
          }

          i += 1;
          if (i >= frames || (mode === "live" && g.isTerminalRun(run))) return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        await finished;

        return {
          framesRendered: i,
          frameDeltaMs: g.stats(frameDeltas),
          renderWorkMs: g.stats(renderMs),
          simWorkMs: simMs.length ? g.stats(simMs) : null,
          longFrameCount: longFrames,
          longFrameRatio: frameDeltas.length ? +(longFrames / frameDeltas.length).toFixed(5) : null,
          drawCalls: drawCalls.length ? g.stats(drawCalls) : null,
          triangles: triangles.length ? g.stats(triangles) : null,
          enemiesOnScreen: g.stats(enemyCounts),
        };
      }

      async function warm(rb, snapshot) {
        for (let w = 0; w < 10; w += 1) {
          rb.renderSnapshot(snapshot, {});
          await new Promise((r) => setTimeout(r, 300));
        }
        rb.renderSnapshot(snapshot, {});
      }

      // ================= WebGL: wave peak (worst actor count) =============
      {
        const canvas = makeSizedCanvas();
        const rb = new g.three.RealtimeBattle().mount({ canvas, viewport: canvas });
        const held = g.projectSnapshot({ ...peak.snapshot, events: [] }, stageId);
        await warm(rb, held);
        out.wavePeakWarmScene = g.sceneStats(rb);
        out.wavePeakWarmMemory = { ...rb.renderer.info.memory };
        out.webglWavePeakHeld = await measure(rb, "webgl", { mode: "held", heldSnapshot: held });
        out.webglWavePeakHeldOrbit = await measure(rb, "webgl", { mode: "held", heldSnapshot: held, orbit: true });
        out.webglWavePeakLive = await measure(rb, "webgl", { mode: "live", startRun: peak.run });

        const camSamples = [];
        for (let k = 0; k < 3000; k += 1) {
          rb.orbit(0.01, 0.001);
          const a = performance.now();
          rb.updateCamera(held);
          camSamples.push(performance.now() - a);
        }
        out.updateCameraMs = g.stats(camSamples);

        const animSamples = [];
        for (let k = 0; k < 3000; k += 1) {
          const a = performance.now();
          rb.updateAnimations(performance.now());
          animSamples.push(performance.now() - a);
        }
        out.updateAnimationsMs = g.stats(animSamples);
        out.mixersDuringAnimProbe = g.sceneStats(rb).mixers;

        const rawSamples = [];
        for (let k = 0; k < 1000; k += 1) {
          const a = performance.now();
          rb.renderer.render(rb.scene, rb.camera);
          rawSamples.push(performance.now() - a);
        }
        out.rawRenderMs = g.stats(rawSamples);

        rb.dispose();
        canvas.remove();
      }

      // ================= WebGL: boss alive ================================
      {
        const canvas = makeSizedCanvas();
        const rb = new g.three.RealtimeBattle().mount({ canvas, viewport: canvas });
        const held = g.projectSnapshot({ ...boss.snapshot, events: [] }, stageId);
        await warm(rb, held);
        out.bossWarmScene = g.sceneStats(rb);
        out.webglBossHeld = await measure(rb, "webgl", { mode: "held", heldSnapshot: held });
        rb.dispose();
        canvas.remove();
      }

      // ================= Canvas2D fallback, identical scenarios ===========
      {
        const canvas = makeSizedCanvas();
        const bv = new g.canvas2d.BattleVisualizer().mount({ canvas, viewport: canvas });
        const held = g.projectSnapshot({ ...peak.snapshot, events: [] }, stageId);
        for (let w = 0; w < 5; w += 1) bv.renderSnapshot(held, {});
        out.canvas2dWavePeakHeld = await measure(bv, "canvas2d", { mode: "held", heldSnapshot: held });
        out.canvas2dWavePeakLive = await measure(bv, "canvas2d", { mode: "live", startRun: peak.run });
        bv.dispose();
        canvas.remove();
      }

      return out;
    }, { frames: FRAMES, stageId: STAGE, seed: SEED });

    return { tier, gpu, ...result, errors };
  } finally {
    await context.close();
  }
}

async function scenario(browser, hosting) {
  const tiers = [
    { label: "desktop-m2pro-dsf1", dsf: 1, cpuThrottle: 1 },
    { label: "shipped-mobile-dsf2", dsf: 2, cpuThrottle: 1 },
    { label: "midtier-mobile-proxy-dsf2-cpu4x", dsf: 2, cpuThrottle: 4 },
  ];
  const passes = [];
  for (const tier of tiers) passes.push(await scenarioPass(browser, hosting, tier));
  return { passes };
}

// ------------------------------------------------------------------ plinth
/**
 * A/B: what does deleting the 20 inert `<id>_pedestal` meshes actually buy in
 * frame time? Measures the SAME warm renderer twice -- once as shipped, once
 * with every `_pedestal` node removed from the live scene graph -- so the only
 * variable is the inert geometry. Answers whether the bottleneck is raw
 * triangles or per-actor skinning/mixer overhead.
 */
async function plinth(browser, hosting) {
  const tiers = [
    { label: "shipped-mobile-dsf2", dsf: 2, cpuThrottle: 1 },
    { label: "midtier-mobile-proxy-dsf2-cpu4x", dsf: 2, cpuThrottle: 4 },
  ];
  const passes = [];
  for (const tier of tiers) {
    const { context, page, errors } = await newPage(browser, hosting, {
      deviceScaleFactor: tier.dsf, cpuThrottle: tier.cpuThrottle,
    });
    try {
      const r = await page.evaluate(async ({ frames, stageId, seed }) => {
        const g = await window.__g6;
        const peak = g.driveToPeak(stageId, seed, 6000);
        const held = g.projectSnapshot({ ...peak.snapshot, events: [] }, stageId);
        const ratio = Math.min(devicePixelRatio || 1, 2);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(844 * ratio); canvas.height = Math.round(390 * ratio);
        Object.assign(canvas.style, { width: "844px", height: "390px", position: "fixed", inset: "0" });
        document.body.appendChild(canvas);
        const rb = new g.three.RealtimeBattle().mount({ canvas, viewport: canvas });
        for (let w = 0; w < 10; w += 1) {
          rb.renderSnapshot(held, {});
          await new Promise((r2) => setTimeout(r2, 300));
        }
        rb.renderSnapshot(held, {});

        async function run() {
          const work = [], draws = [], tris = [];
          let done; const fin = new Promise((r2) => { done = r2; });
          let i = 0;
          const tick = () => {
            const a = performance.now();
            rb.renderSnapshot(held, {});
            work.push(performance.now() - a);
            draws.push(rb.renderer.info.render.calls);
            tris.push(rb.renderer.info.render.triangles);
            i += 1;
            if (i >= frames) return done();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          await fin;
          return { renderWorkMs: g.stats(work), drawCalls: g.stats(draws), triangles: g.stats(tris) };
        }

        const withPlinth = await run();

        // Strip every inert plinth node from the LIVE scene graph.
        const removed = [];
        rb.scene.traverse((n) => {
          if (typeof n.name === "string" && n.name.endsWith("_pedestal")) removed.push(n);
        });
        let removedTris = 0;
        for (const n of removed) {
          n.traverse((m) => {
            const idx = m.geometry?.index;
            const pos = m.geometry?.attributes?.position;
            if (m.isMesh) removedTris += (idx ? idx.count : (pos ? pos.count : 0)) / 3;
          });
          n.parent?.remove(n);
        }
        rb.renderSnapshot(held, {});
        const withoutPlinth = await run();

        const scene = g.sceneStats(rb);
        rb.dispose(); canvas.remove();
        return {
          stageId, wavePeakTick: peak.snapshot.tick,
          actorsOnScreen: peak.snapshot.enemies.length + peak.snapshot.companions.length + 1,
          plinthNodesRemoved: removed.length,
          plinthTrianglesRemoved: Math.round(removedTris),
          withPlinth, withoutPlinth, sceneAfter: scene,
        };
      }, { frames: FRAMES, stageId: STAGE, seed: SEED });
      passes.push({ tier, ...r, errors });
    } finally {
      await context.close();
    }
  }
  return { passes };
}

// ----------------------------------------------------------------- fullapp
/**
 * Measures the REAL shipped frame: the whole BattleSession.loop (sim advance +
 * renderSnapshot + DOM/HUD reconcile + audio), not the renderer in isolation.
 * BattleSession.loop is the app's only rAF consumer (DefenseViewport is
 * event-driven; RealtimeBattle renders synchronously from inside loop() and
 * never self-schedules), so wrapping requestAnimationFrame and timing the
 * callback body yields total per-frame main-thread work -- the quantity the
 * G6 budget actually governs.
 *
 * Input latency is measured end-to-end from the real dispatched key event to
 * the app's own `abyssal:defense-input-feedback` display timestamp.
 */
async function fullappPass(browser, hosting, tier, durationMs) {
  const { context, page, errors } = await newPage(browser, hosting, {
    deviceScaleFactor: tier.dsf,
    cpuThrottle: tier.cpuThrottle,
  });
  try {
    // Instrument BEFORE the app boots so the very first frame is captured.
    await page.addInitScript(() => {
      const state = window.__frameProbe = {
        work: [], deltas: [], long: 0, inputs: [], startedAt: null,
      };
      const nativeRaf = window.requestAnimationFrame.bind(window);
      let prev;
      window.requestAnimationFrame = (cb) => nativeRaf((ts) => {
        if (state.startedAt === null) state.startedAt = performance.now();
        if (prev !== undefined) {
          const d = ts - prev;
          state.deltas.push(d);
          if (d > 33.4) state.long += 1;
        }
        prev = ts;
        const a = performance.now();
        try { cb(ts); } finally { state.work.push(performance.now() - a); }
      });
      addEventListener("abyssal:defense-input-feedback", (e) => {
        const d = e.detail ?? {};
        if (Number.isFinite(d.displayedAt) && Number.isFinite(d.admittedAt)) {
          state.inputs.push({ type: d.type, latencyMs: d.displayedAt - d.admittedAt });
        }
      });
    });
    await page.goto("/index.html", { waitUntil: "networkidle" });
    await page.locator("#start-defense").click();
    await page.locator('[data-defense-ready="true"]').waitFor({ timeout: 30_000 });

    // Let GLB streaming settle so we time steady state, not first-load.
    await page.waitForTimeout(6000);
    const rendererMode = await page.locator("#defense-battle-surface")
      .getAttribute("data-defense-renderer");
    await page.evaluate(() => {
      const s = window.__frameProbe;
      s.work.length = 0; s.deltas.length = 0; s.long = 0; s.inputs.length = 0;
    });

    // Drive real input for the whole window: movement keys + orbit drags.
    const deadline = Date.now() + durationMs;
    const dirs = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"];
    let i = 0;
    const box = await page.locator("#defense-canvas").boundingBox();
    while (Date.now() < deadline) {
      await page.keyboard.press(dirs[i % dirs.length]);
      if (box && i % 3 === 2) {
        // Real orbit drag across the battle canvas.
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 60, cy + 20, { steps: 6 });
        await page.mouse.up();
      }
      // Keep the run alive through offers/results.
      if (i % 8 === 7) {
        for (const sel of ["#defense-growth-offer [data-pick]", "[data-reward]",
                           "#result-action", "#start-defense",
                           "#defense-cutscene-overlay [data-cutscene-dismiss]"]) {
          const loc = page.locator(sel).first();
          if (await loc.isVisible().catch(() => false)) {
            await loc.click({ timeout: 800 }).catch(() => {});
            break;
          }
        }
      }
      i += 1;
      await page.waitForTimeout(200);
    }

    const report = await page.evaluate(() => {
      const s = window.__frameProbe;
      const pct = (v, f) => {
        if (!v.length) return null;
        const a = [...v].sort((x, y) => x - y);
        return +a[Math.min(a.length - 1, Math.ceil(a.length * f) - 1)].toFixed(3);
      };
      const st = (v) => ({
        n: v.length,
        mean: v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) : null,
        p50: pct(v, 0.5), p95: pct(v, 0.95), p99: pct(v, 0.99),
        max: v.length ? +Math.max(...v).toFixed(3) : null,
      });
      const lat = s.inputs.map((x) => x.latencyMs).filter(Number.isFinite);
      return {
        frameWorkMs: st(s.work),
        frameDeltaMs: st(s.deltas),
        longFrameCount: s.long,
        longFrameRatio: s.deltas.length ? +(s.long / s.deltas.length).toFixed(5) : null,
        inputLatencyMs: st(lat),
        inputSamples: s.inputs.length,
        domNodes: document.querySelectorAll("*").length,
      };
    });

    return { tier, rendererMode, durationMs, ...report, errors };
  } finally {
    await context.close();
  }
}

async function fullapp(browser, hosting) {
  const ms = Number(process.env.G6_FULLAPP_MS ?? 60_000);
  const tiers = [
    { label: "desktop-m2pro-dsf1", dsf: 1, cpuThrottle: 1 },
    { label: "shipped-mobile-dsf2", dsf: 2, cpuThrottle: 1 },
    { label: "midtier-mobile-proxy-dsf2-cpu4x", dsf: 2, cpuThrottle: 4 },
    { label: "low-mobile-proxy-dsf2-cpu6x", dsf: 2, cpuThrottle: 6 },
  ];
  const passes = [];
  for (const tier of tiers) passes.push(await fullappPass(browser, hosting, tier, ms));
  return { passes };
}

// -------------------------------------------------------------------- leak
async function leak(browser, hosting) {
  const { context, page, errors, cdp } = await newPage(browser, hosting, { deviceScaleFactor: 2 });
  try {
    const result = await page.evaluate(async () => {
      const g = await window.__g6;
      const canvas = g.makeCanvas(844, 390);
      const rb = new g.three.RealtimeBattle().mount({ canvas, viewport: canvas });

      // Build a synthetic snapshot with N enemies we can cycle in and out by
      // id -- this exercises ensureActor()/retireActor(), the exact
      // AnimationMixer + SkeletonUtils.clone() spawn/despawn surface.
      const base = g.driveToBoss("cinder-span", 2962819252, 4000).snapshot;
      const template = base.enemies.find((e) => e.class !== "boss") ?? base.enemies[0];
      const bossTemplate = base.enemies.find((e) => e.class === "boss");

      function snapshotWithGeneration(gen, count) {
        const enemies = [];
        for (let k = 0; k < count; k += 1) {
          enemies.push({ ...template, id: `leak-${gen}-${k}`,
            x: 6000 + k * 900, y: 4000 + (k % 3) * 1200 });
        }
        if (bossTemplate) enemies.push({ ...bossTemplate, id: `leak-boss-${gen}` });
        return g.projectSnapshot({ ...base, enemies, events: [], tick: gen * 100 }, "cinder-span");
      }

      // Warm terrain + first cohort so the GLB cache is fully populated.
      rb.renderSnapshot(snapshotWithGeneration(0, 6), {});
      await new Promise((r) => setTimeout(r, 3000));
      rb.renderSnapshot(snapshotWithGeneration(0, 6), {});

      const cycles = [];
      const GENERATIONS = 40;
      for (let gen = 1; gen <= GENERATIONS; gen += 1) {
        // Fully replace the enemy cohort -> retireActor() on all previous ids,
        // ensureActor() on all new ids.
        rb.renderSnapshot(snapshotWithGeneration(gen, 6), {});
        await new Promise((r) => setTimeout(r, 120));
        rb.renderSnapshot(snapshotWithGeneration(gen, 6), {});
        if (gen % 5 === 0) {
          const s = g.sceneStats(rb);
          cycles.push({
            generation: gen,
            actors: s.actors,
            mixers: s.mixers,
            skeletons: s.skeletons,
            boneTextures: s.boneTextures,
            rendererTextures: rb.renderer.info.memory.textures,
            rendererGeometries: rb.renderer.info.memory.geometries,
            programs: rb.renderer.info.programs?.length ?? 0,
          });
        }
      }

      // Direct probe: does retireActor() free the skeleton boneTexture?
      const probe = (() => {
        const snap = snapshotWithGeneration(999, 2);
        rb.renderSnapshot(snap, {});
        const before = rb.renderer.info.memory.textures;
        let skeletonsWithTexture = 0;
        const skels = [];
        rb.scene.traverse((n) => {
          if (n.isSkinnedMesh && n.skeleton && !skels.includes(n.skeleton)) {
            skels.push(n.skeleton);
            if (n.skeleton.boneTexture) skeletonsWithTexture += 1;
          }
        });
        // Retire everything by rendering an empty enemy list.
        rb.renderSnapshot(g.projectSnapshot({ ...base, enemies: [], events: [], tick: 99999 }, "cinder-span"), {});
        const after = rb.renderer.info.memory.textures;
        const orphaned = skels.filter((s) => s.boneTexture !== null).length;
        return { texturesBeforeRetire: before, texturesAfterRetire: after,
                 skeletonsWithTexture, skeletonsStillHoldingTextureAfterRetire: orphaned,
                 skeletonDisposeCalledByRenderer: orphaned === 0 };
      })();

      return { cycles, probe, generations: GENERATIONS };
    });

    // Heap trend via CDP, with forced GC between reads.
    const heap = [];
    for (let i = 0; i < 3; i += 1) {
      await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
      const m = await cdp.send("Performance.getMetrics");
      heap.push(m.metrics.find((x) => x.name === "JSHeapUsedSize")?.value ?? null);
      await new Promise((r) => setTimeout(r, 500));
    }
    return { ...result, heapAfterCyclesBytes: heap, errors };
  } finally {
    await context.close();
  }
}

// -------------------------------------------------------------------- soak
async function soak(browser, hosting, durationMs) {
  const { context, page, errors, cdp } = await newPage(browser, hosting, { deviceScaleFactor: 2 });
  try {
    await page.evaluate(async (ms) => {
      const g = await window.__g6;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(844 * ratio); canvas.height = Math.round(390 * ratio);
      Object.assign(canvas.style, { width: "844px", height: "390px", position: "fixed", inset: "0" });
      document.body.appendChild(canvas);
      const rb = new g.three.RealtimeBattle().mount({ canvas, viewport: canvas });
      window.__soakRb = rb;
      const state = window.__soak = {
        frameDeltas: [], renderMs: [], longFrames: 0, frames: 0,
        restarts: 0, startedAt: performance.now(), endsAt: performance.now() + ms,
        inputLatencyMs: [], done: false,
      };
      let seed = 2962819252;
      let run = g.driveToPeak("gate-zenith", seed, 6000).run;
      let prev, i = 0;
      let pendingInputAt = null;

      const tick = (now) => {
        if (performance.now() >= state.endsAt) { state.done = true; return; }
        if (prev !== undefined) {
          const d = now - prev;
          state.frameDeltas.push(d);
          if (d > 33.4) state.longFrames += 1;
          if (state.frameDeltas.length > 200000) state.frameDeltas.shift();
        }
        prev = now;

        if (g.isTerminalRun(run)) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          run = g.driveToPeak("gate-zenith", seed, 6000).run;
          state.restarts += 1;
        }
        run = g.step(run, ["E", "NE", "N", "NW", "W", "SW", "S", "SE"][i % 8]);
        const snap = g.getRunSnapshot(run);

        // Input-latency probe: mark an input, measure until the frame that
        // renders it completes (the renderer's own feedback contract).
        if (i % 60 === 0) { pendingInputAt = performance.now(); rb.onVisualFeedback(i); }

        const t2 = performance.now();
        rb.renderSnapshot(g.projectSnapshot(snap, "gate-zenith"), {});
        const t3 = performance.now();
        state.renderMs.push(t3 - t2);
        if (state.renderMs.length > 200000) state.renderMs.shift();
        if (pendingInputAt !== null) { state.inputLatencyMs.push(t3 - pendingInputAt); pendingInputAt = null; }

        // Exercise the orbit camera continuously (Cycle 4 unverified surface).
        rb.orbit(0.008, 0.0015);

        state.frames += 1;
        i += 1;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, durationMs);

    const started = Date.now();
    const samples = [];
    while (Date.now() - started < durationMs + 5000) {
      const m = await cdp.send("Performance.getMetrics");
      const used = m.metrics.find((x) => x.name === "JSHeapUsedSize")?.value;
      const scene = await page.evaluate(async () => {
        const g = await window.__g6;
        const s = window.__soak;
        const rb = window.__soakRb;
        const st = g.sceneStats(rb);
        return {
          frames: s.frames, restarts: s.restarts, longFrames: s.longFrames, done: s.done,
          actors: st.actors, mixers: st.mixers, skeletons: st.skeletons,
          gpuTextures: rb.renderer.info.memory.textures,
          gpuGeometries: rb.renderer.info.memory.geometries,
        };
      });
      samples.push({ elapsedMs: Date.now() - started, usedBytes: used, ...scene });
      if (scene.done) break;
      await new Promise((r) => setTimeout(r, 10_000));
    }

    const final = await page.evaluate(async () => {
      const g = await window.__g6;
      const s = window.__soak;
      return {
        frames: s.frames, restarts: s.restarts, longFrames: s.longFrames,
        longFrameRatio: s.frameDeltas.length ? +(s.longFrames / s.frameDeltas.length).toFixed(6) : null,
        frameDeltaMs: g.stats(s.frameDeltas),
        renderWorkMs: g.stats(s.renderMs),
        inputLatencyMs: g.stats(s.inputLatencyMs),
        actualDurationMs: Math.round(performance.now() - s.startedAt),
      };
    });

    // Least-squares heap slope (MiB/min), ignoring the first sample (warmup).
    const usable = samples.filter((s) => Number.isFinite(s.usedBytes)).slice(1);
    let slopeMiBPerMin = null;
    if (usable.length >= 2) {
      const mx = usable.reduce((a, s) => a + s.elapsedMs, 0) / usable.length;
      const my = usable.reduce((a, s) => a + s.usedBytes, 0) / usable.length;
      const den = usable.reduce((a, s) => a + (s.elapsedMs - mx) ** 2, 0);
      if (den > 0) {
        const num = usable.reduce((a, s) => a + (s.elapsedMs - mx) * (s.usedBytes - my), 0);
        slopeMiBPerMin = +((num / den) * 60_000 / 2 ** 20).toFixed(4);
      }
    }
    return { ...final, heapSamples: samples, heapSlopeMiBPerMin: slopeMiBPerMin, errors };
  } finally {
    await context.close();
  }
}

async function main() {
  const hosting = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
    });
    const started = new Date().toISOString();
    let report;
    if (MODE === "scenario") report = await scenario(browser, hosting);
    else if (MODE === "fullapp") report = await fullapp(browser, hosting);
    else if (MODE === "plinth") report = await plinth(browser, hosting);
    else if (MODE === "leak") report = await leak(browser, hosting);
    else if (MODE === "soak") report = await soak(browser, hosting, SOAK_MS);
    else throw new Error(`unknown mode ${MODE}`);

    const payload = { mode: MODE, startedAt: started, finishedAt: new Date().toISOString(), ...report };
    const json = JSON.stringify(payload, null, 2);
    if (process.env.G6_OUT) {
      fs.mkdirSync(path.dirname(path.resolve(process.env.G6_OUT)), { recursive: true });
      fs.writeFileSync(path.resolve(process.env.G6_OUT), json);
    }
    console.log(json);
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => hosting.host.close(r));
  }
}

main().catch((e) => { console.error(e.stack || String(e)); process.exitCode = 1; });
