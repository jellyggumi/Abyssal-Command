// QA actor readability + motion probe (run-id 20260725-wellmade-verification).
//
// Measurement-only. Mounts the REAL RealtimeBattle against real WebGL and
// feeds it synthetic snapshots, so every number below comes out of the exact
// code path the shipping game uses -- real fitHeight(), real TARGET_HEIGHT,
// real camera (PerspectiveCamera 42deg + orbit default), real lighting, real
// PMREM environment, real SkeletonUtils clone + AnimationMixer.
//
// Answers, per character:
//   D2 size    -- rendered BODY height vs the class height it was authored to,
//                 with the plinth's contribution to fitHeight()'s Box3 isolated
//   D6 colour  -- mean rendered RGB of the isolated silhouette at gameplay
//                 camera distance, plus CIEDE2000 separation between classes
//   D4 motion  -- per-frame bone angular step and angular ACCELERATION across a
//                 full clip, driving the real mixer at a fixed 60Hz. Sparse
//                 clips concentrate direction changes into few large spikes.
//
// Usage: node scripts/qa-actor-readability-probe.mjs
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

const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary" };
const served = [];
function startServer() {
  const host = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(ROOT, `.${rel === "/" ? "/index.html" : rel}`);
    if (!file.startsWith(ROOT + path.sep)) { served.push({ rel, status: 403 }); return res.writeHead(403).end(); }
    fs.stat(file, (e, st) => {
      if (e || !st.isFile()) { served.push({ rel, status: 404 }); return res.writeHead(404).end(); }
      served.push({ rel, status: 200, bytes: st.size });
      res.writeHead(200, { "Cache-Control": "no-store, no-cache, must-revalidate", "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((r, j) => host.listen(0, "127.0.0.1", () => r({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", j));
}

// --- the whole probe body runs inside the page ---------------------------
const PROBE = async () => {
  const THREE = await import("/vendor/three.module.js");
  const { RealtimeBattle } = await import("/battle-realtime-three.js");

  const W = 1280, H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  document.body.appendChild(canvas);
  const rb = new RealtimeBattle().mount({ canvas, viewport: canvas });
  if (rb.usingFallback || !rb.renderer) return { error: "no real WebGL2 -- probe cannot run" };

  // Every character the game can put on screen, with the exact entity shape
  // actorModelPath()/actorTargetHeight() branch on.
  // Verified verbatim against defense-catalog.js BOSSES (an earlier pass used
  // guessed ids and produced three magenta fallback markers that were MY error,
  // not a game defect -- do not re-introduce).
  const BOSSES = ["s1-cinder-warden", "s2-veil-tactician", "s3-gate-sovereign", "s4-tide-warden",
    "s5-pack-herald", "s6-requiem-choir", "s7-lantern-tyrant", "s8-bridge-colossus",
    "s9-veiled-concordat", "s10-abyss-regent"];
  const ENEMY_KINDS = ["rusher", "flanker", "ranged", "guardian"];
  const COMPANIONS = ["ember-cohort", "rift-lens", "throne-echo", "veil-vanguard", "lantern-reaver",
    "anchor-shard", "pack-warden", "requiem-warden", "dawnless-crown"];

  const entities = [];
  entities.push({ id: "commander", kind: "commander", x: 0, y: 0, hp: 100, normalized: true });
  BOSSES.forEach((bossId, i) => entities.push({ id: `boss-${i}`, class: "boss", bossId, kind: "boss", x: 0, y: 0, hp: 100, normalized: true }));
  ENEMY_KINDS.forEach((kind, i) => entities.push({ id: `enemy-${i}`, kind, x: 0, y: 0, hp: 100, normalized: true }));
  COMPANIONS.forEach((companionId, i) => entities.push({ id: `comp-${i}`, kind: "companion", companionId, x: 0, y: 0, hp: 100, normalized: true }));

  const mkSnapshot = (list) => ({
    tick: 1, presentation: { stageId: "cinder-span" },
    commander: list.find((e) => e.id === "commander") ?? { id: "commander", x: 0, y: 0, normalized: true },
    enemies: list.filter((e) => e.id !== "commander" && e.kind !== "companion"),
    companions: list.filter((e) => e.kind === "companion"),
    projectiles: [], pickups: [], events: [],
    gate: { id: "gate", x: 0, y: -0.9, normalized: true },
  });

  // Mount everything at the origin; isolation rendering means overlap is fine.
  rb.renderSnapshot(mkSnapshot(entities), {});
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const pending = [...rb.actors.values()].filter((r) => r.loading).length;
    if (!pending && rb.actors.size >= entities.length) break;
    await new Promise((r) => setTimeout(r, 100));
    rb.renderSnapshot(mkSnapshot(entities), {});
  }
  rb.renderSnapshot(mkSnapshot(entities), {});

  const gl = rb.renderer.getContext();
  const px = new Uint8Array(W * H * 4);
  const shoot = () => { rb.renderer.render(rb.scene, rb.camera); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };

  const roots = [...rb.actors.entries()].filter(([, r]) => r.root);
  const setVisible = (v) => {
    for (const [, r] of roots) r.root.visible = v;
    rb.terrainGroup.visible = v; rb.vfxGroup.visible = v;
    if (rb.gateMesh) rb.gateMesh.visible = v;
  };

  setVisible(false);
  const bg = shoot().slice();

  // --- sRGB -> Lab -> CIEDE2000 -------------------------------------------
  const toLab = ([R, G, B]) => {
    const f = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = [f(R), f(G), f(B)];
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [k(x), k(y), k(z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const ciede2000 = (L1ab, L2ab) => {
    const [L1, a1, b1] = L1ab, [L2, a2, b2] = L2ab;
    const kL = 1, kC = 1, kH = 1;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
    const Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const h = (ap, bp) => { if (ap === 0 && bp === 0) return 0; const d = Math.atan2(bp, ap) * 180 / Math.PI; return d >= 0 ? d : d + 360; };
    const h1p = h(a1p, b1), h2p = h(a2p, b2);
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI / 180) / 2);
    const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
    let hbp = h1p + h2p;
    if (C1p * C2p !== 0) {
      if (Math.abs(h1p - h2p) > 180) hbp += (h1p + h2p < 360) ? 360 : -360;
      hbp /= 2;
    }
    const T = 1 - 0.17 * Math.cos((hbp - 30) * Math.PI / 180) + 0.24 * Math.cos((2 * hbp) * Math.PI / 180)
      + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hbp - 63) * Math.PI / 180);
    const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
    const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
    const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
    const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin((2 * dTh) * Math.PI / 180) * Rc;
    return Math.sqrt((dLp / (kL * Sl)) ** 2 + (dCp / (kC * Sc)) ** 2 + (dHp / (kH * Sh)) ** 2
      + Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)));
  };

  // --- per-actor geometry + isolated render -------------------------------
  const box = new THREE.Box3(), v3 = new THREE.Vector3();
  const actors = [];
  for (const [id, rec] of roots) {
    setVisible(false);
    rec.root.visible = true;
    const buf = shoot();
    let n = 0, r = 0, g = 0, b = 0, minX = W, maxX = -1, minY = H, maxY = -1;
    for (let i = 0; i < W * H; i += 1) {
      const o = i * 4;
      if (Math.abs(buf[o] - bg[o]) + Math.abs(buf[o + 1] - bg[o + 1]) + Math.abs(buf[o + 2] - bg[o + 2]) < 12) continue;
      n += 1; r += buf[o]; g += buf[o + 1]; b += buf[o + 2];
      const x = i % W, y = (i / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }

    // Geometry decomposition. fitHeight() scaled the WHOLE root (body+plinth)
    // to the class target, so measure each named mesh separately to recover
    // what fraction of the on-screen height is actual character.
    rec.root.updateWorldMatrix(true, true);
    const total = box.setFromObject(rec.root).clone();
    const meshes = [];
    rec.root.traverse((node) => {
      if (!node.isMesh && !node.isSkinnedMesh) return;
      const mb = new THREE.Box3().setFromObject(node);
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      meshes.push({
        name: node.name, skinned: Boolean(node.isSkinnedMesh),
        y0: mb.min.y, y1: mb.max.y, h: mb.max.y - mb.min.y,
        tris: node.geometry?.index ? node.geometry.index.count / 3 : (node.geometry?.attributes?.position?.count ?? 0) / 3,
        materials: mats.filter(Boolean).map((m) => ({
          color: m.color ? `#${m.color.getHexString()}` : null,
          map: Boolean(m.map), metalness: m.metalness ?? null, roughness: m.roughness ?? null,
        })),
      });
    });
    const pedestals = meshes.filter((m) => /pedestal|plinth|base_slab/i.test(m.name));
    const bodies = meshes.filter((m) => !/pedestal|plinth|base_slab/i.test(m.name));
    const bodyY0 = bodies.length ? Math.min(...bodies.map((m) => m.y0)) : total.min.y;
    const bodyY1 = bodies.length ? Math.max(...bodies.map((m) => m.y1)) : total.max.y;
    const totalH = total.max.y - total.min.y;

    actors.push({
      id, kind: rec.kind, modelPath: rec.modelPath, action: rec.activeActionKey,
      silhouettePx: n, meanRgb: n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null,
      bboxPx: n ? { w: maxX - minX + 1, h: maxY - minY + 1 } : null,
      totalWorldHeight: totalH,
      bodyWorldHeight: bodyY1 - bodyY0,
      bodyFraction: totalH > 0 ? (bodyY1 - bodyY0) / totalH : null,
      pedestalCount: pedestals.length,
      pedestalHeight: pedestals.length ? Math.max(...pedestals.map((m) => m.y1)) - Math.min(...pedestals.map((m) => m.y0)) : 0,
      pedestalTris: pedestals.reduce((s, m) => s + m.tris, 0),
      bodyTris: bodies.reduce((s, m) => s + m.tris, 0),
      meshNames: meshes.map((m) => m.name),
      materials: [...new Set(meshes.flatMap((m) => m.materials.map((x) => x.color)))],
      anyTextureMap: meshes.some((m) => m.materials.some((x) => x.map)),
      boneCount: (() => { let c = 0; rec.root.traverse((nd) => { if (nd.isBone) c += 1; }); return c; })(),
      clips: Object.keys(rec.actions ?? {}),
    });
  }
  setVisible(true);

  // pairwise CIEDE2000 between rendered mean colours
  const withColor = actors.filter((a) => a.meanRgb);
  const labs = new Map(withColor.map((a) => [a.id, toLab(a.meanRgb)]));
  const pairs = [];
  for (let i = 0; i < withColor.length; i += 1) {
    for (let j = i + 1; j < withColor.length; j += 1) {
      pairs.push({ a: withColor[i].id, aKind: withColor[i].kind, b: withColor[j].id, bKind: withColor[j].kind,
        de: ciede2000(labs.get(withColor[i].id), labs.get(withColor[j].id)) });
    }
  }

  // --- motion: drive the REAL mixer at fixed 60Hz and read bone quaternions
  const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
  const motion = {};
  for (const [id, rec] of roots) {
    if (!rec.mixer) { motion[id] = { error: "no mixer" }; continue; }
    const bones = [];
    rec.root.traverse((n) => { if (n.isBone) bones.push(n); });
    motion[id] = { modelPath: rec.modelPath, boneCount: bones.length, clips: {} };
    for (const clipKey of ["idle", "move", "attack"]) {
      const action = rec.actions?.[clipKey];
      if (!action) { motion[id].clips[clipKey] = { error: "missing clip" }; continue; }
      rec.mixer.stopAllAction();
      action.reset();
      action.setEffectiveWeight(1);
      action.enabled = true;
      action.play();
      rec.activeActionKey = clipKey;
      const duration = action.getClip().duration;
      const dt = 1 / 60;
      const frames = Math.min(360, Math.max(30, Math.round(duration * 60)));
      rec.mixer.update(0);
      let prev = bones.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]);
      const stepSeries = [];
      for (let f = 0; f < frames; f += 1) {
        rec.mixer.update(dt);
        const cur = bones.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]);
        const per = cur.map((q, k) => angleBetween(prev[k], q));
        stepSeries.push(per.reduce((s, x) => s + x, 0) / per.length);
        prev = cur;
      }
      const deg = (x) => x * 180 / Math.PI;
      const accel = stepSeries.slice(1).map((x, i) => Math.abs(x - stepSeries[i]));
      const maxStep = Math.max(...stepSeries);
      const meanStep = stepSeries.reduce((s, x) => s + x, 0) / stepSeries.length;
      const maxAccel = Math.max(...accel);
      const meanAccel = accel.reduce((s, x) => s + x, 0) / (accel.length || 1);
      // A sparse, linearly-interpolated clip holds a constant velocity inside
      // each keyframe span and changes it abruptly at every key. Counting the
      // frames whose acceleration exceeds 25% of the clip's peak therefore
      // counts CORNERS, and corners-per-second tracks authored keyframe rate.
      const corners = accel.filter((x) => x > 0.25 * maxAccel).length;
      motion[id].clips[clipKey] = {
        durationSec: duration, frames,
        totalTravelDeg: deg(stepSeries.reduce((s, x) => s + x, 0)),
        meanStepDeg: deg(meanStep), maxStepDeg: deg(maxStep),
        meanAccelDeg: deg(meanAccel), maxAccelDeg: deg(maxAccel),
        cornerFrames: corners, cornersPerSec: corners / duration,
        // fraction of frames with essentially no motion -- a sparse clip that
        // holds a pose reads as "frozen then snap"
        stillFrameRatio: stepSeries.filter((x) => x < 1e-5).length / stepSeries.length,
        moving: maxStep > 1e-5,
      };
      rec.mixer.stopAllAction();
    }
    const idle = rec.actions?.idle;
    if (idle) { idle.reset().play(); rec.activeActionKey = "idle"; }
  }

  // --- G8 support for DesignG7G8: is the 3-stance formation distinguishable
  // on screen from companion placement alone? Uses the REAL STANCE_CONFIG
  // offsets and the REAL ARENA scaling app.js's projected() applies, then
  // measures each companion's isolated on-screen centroid in device pixels.
  const { STANCE_CONFIG } = await import("/rpg-catalog.js");
  const { ARENA } = await import("/defense-catalog.js");
  const COMPANION_IDS = ["ember-cohort", "rift-lens", "throne-echo"];
  const stances = {};
  for (const [stanceName, cfg] of Object.entries(STANCE_CONFIG)) {
    for (const id of [...rb.actors.keys()]) rb.retireActor(id);
    // Commander at arena centre; companions at commander + stance offset,
    // mapped through the same normalisation app.js uses.
    const cx = ARENA.width / 2, cy = ARENA.height / 2;
    const norm = (x, y) => ({ x: (x / ARENA.width) * 2 - 1, y: (y / ARENA.height) * 2 - 1, normalized: true });
    const commander = { id: "commander", kind: "commander", hp: 100, ...norm(cx, cy) };
    const comps = cfg.offsets.map((off, i) => ({
      id: `stance-comp-${i}`, kind: "companion", companionId: COMPANION_IDS[i], hp: 100,
      slot: i < cfg.derivedFrontCount ? "FRONT" : "BACK",
      ...norm(cx + off.x, cy + off.y),
    }));
    const snap = {
      tick: 3, presentation: { stageId: "cinder-span" }, commander,
      enemies: [], companions: comps, projectiles: [], pickups: [], events: [],
      gate: { id: "gate", ...norm(cx, cy * 0.1) },
    };
    rb.renderSnapshot(snap, {});
    const dl = Date.now() + 30000;
    while (Date.now() < dl && [...rb.actors.values()].some((r) => r.loading)) {
      await new Promise((r) => setTimeout(r, 60)); rb.renderSnapshot(snap, {});
    }
    for (let i = 0; i < 20; i += 1) rb.renderSnapshot(snap, {});
    const live = [...rb.actors.entries()].filter(([, r]) => r.root);
    const hideAll = (v) => {
      for (const [, r] of live) r.root.visible = v;
      rb.terrainGroup.visible = v; rb.vfxGroup.visible = v;
      if (rb.gateMesh) rb.gateMesh.visible = v;
    };
    hideAll(false);
    const plate = shoot().slice();
    const marks = [];
    for (const [id, rec] of live) {
      hideAll(false); rec.root.visible = true;
      const buf = shoot();
      let n = 0, sx = 0, sy = 0;
      for (let i = 0; i < W * H; i += 1) {
        const o = i * 4;
        if (Math.abs(buf[o] - plate[o]) + Math.abs(buf[o + 1] - plate[o + 1]) + Math.abs(buf[o + 2] - plate[o + 2]) < 12) continue;
        n += 1; sx += i % W; sy += (i / W) | 0;
      }
      const ent = [commander, ...comps].find((e) => e.id === id);
      marks.push({ id, kind: rec.kind, slot: ent?.slot ?? null, px: n,
        centroid: n ? { x: sx / n, y: H - sy / n } : null });
    }
    hideAll(true);
    const comp = marks.filter((m) => m.kind === "companion" && m.centroid);
    let maxSep = 0, spanX = 0, spanY = 0;
    if (comp.length > 1) {
      const xs = comp.map((m) => m.centroid.x), ys = comp.map((m) => m.centroid.y);
      spanX = Math.max(...xs) - Math.min(...xs);
      spanY = Math.max(...ys) - Math.min(...ys);
      for (let i = 0; i < comp.length; i += 1) for (let j = i + 1; j < comp.length; j += 1) {
        maxSep = Math.max(maxSep, Math.hypot(comp[i].centroid.x - comp[j].centroid.x, comp[i].centroid.y - comp[j].centroid.y));
      }
    }
    stances[stanceName] = {
      derivedFrontCount: cfg.derivedFrontCount, offsets: cfg.offsets,
      marks, spreadPx: { x: spanX, y: spanY }, maxPairSeparationPx: maxSep,
      frontBackMeanRgbSame: null,
    };
  }

  window.__probeRbHandle = rb;
  return { canvas: { W, H }, actors, pairs, motion, stances, camera: { fov: rb.camera.fov, pos: rb.camera.position.toArray() } };
};

async function main() {
  const hosting = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  try {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    // Kill the SW + Cache Storage BEFORE measuring (repo's recurring trap).
    const hygiene = await page.evaluate(async () => {
      const before = {
        registrations: (await navigator.serviceWorker?.getRegistrations?.() ?? []).length,
        caches: await caches?.keys?.() ?? [],
      };
      for (const r of await navigator.serviceWorker?.getRegistrations?.() ?? []) await r.unregister();
      for (const n of await caches?.keys?.() ?? []) await caches.delete(n);
      return { before, after: {
        registrations: (await navigator.serviceWorker?.getRegistrations?.() ?? []).length,
        caches: (await caches?.keys?.() ?? []).length,
      } };
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.clearBrowserCache").catch(() => {});
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true }).catch(() => {});
    served.length = 0;
    // about:blank-style clean page on the same origin (no game app running).
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { document.body.innerHTML = ""; });

    console.log("probing 24 characters (isolated render + geometry + motion)...");
    const result = await page.evaluate(PROBE);
    if (result.error) throw new Error(result.error);
    result.swHygiene = hygiene;
    result.pageErrors = errors.slice();

    // contact sheets
    await page.evaluate(() => {
      const c = [...document.querySelectorAll("canvas")].pop();
      c.style.position = "fixed"; c.style.left = "0"; c.style.top = "0"; c.style.zIndex = "9999";
    });
    const sheets = {};
    const BOSS_IDS = ["s1-cinder-warden", "s2-veil-tactician", "s3-gate-sovereign", "s4-tide-warden", "s5-pack-herald", "s6-requiem-choir", "s7-lantern-tyrant", "s8-bridge-colossus", "s9-veiled-concordat", "s10-abyss-regent"];
    const groups = {
      "11-lineup-bosses-1": BOSS_IDS.slice(0, 5).map((bossId, i) => ({ id: `L${i}`, class: "boss", bossId, kind: "boss", hp: 100 })),
      "12-lineup-bosses-2": BOSS_IDS.slice(5).map((bossId, i) => ({ id: `L${i}`, class: "boss", bossId, kind: "boss", hp: 100 })),
      "13-lineup-mixed-classes": [
        { id: "L0", class: "boss", bossId: "s5-pack-herald", kind: "boss", hp: 100 },
        { id: "L1", class: "boss", bossId: "s3-gate-sovereign", kind: "boss", hp: 100 },
        { id: "L2", kind: "rusher", hp: 100 },
        { id: "L3", kind: "guardian", hp: 100 },
        { id: "L4", kind: "companion", companionId: "ember-cohort", hp: 100 },
        { id: "L5", kind: "companion", companionId: "pack-warden", hp: 100 },
      ],
      "14-lineup-enemies-companions": [
        { id: "L0", kind: "rusher", hp: 100 }, { id: "L1", kind: "flanker", hp: 100 },
        { id: "L2", kind: "ranged", hp: 100 }, { id: "L3", kind: "guardian", hp: 100 },
        { id: "L4", kind: "companion", companionId: "rift-lens", hp: 100 },
        { id: "L5", kind: "companion", companionId: "anchor-shard", hp: 100 },
      ],
    };
    for (const [name, ids] of Object.entries(groups)) {
      await page.evaluate(async (ids) => {
        const rb = window.__probeRbHandle;
        for (const id of [...rb.actors.keys()]) rb.retireActor(id);
        // Camera targets the commander, so the lineup must share its ground
        // row or it renders behind the frame edge. Commander id must be
        // literally "commander" for actorModelPath() to resolve its mesh.
        const spread = 4.4;
        const list = ids.map((e, i) => ({ ...e, x: (i - (ids.length - 1) / 2) * spread / 14, y: 0, normalized: true }));
        const snap = {
          tick: 2, presentation: { stageId: "cinder-span" },
          commander: { id: "commander", kind: "commander", hp: 100, x: 0, y: 0.16, normalized: true },
          enemies: list.filter((e) => e.kind !== "companion"),
          companions: list.filter((e) => e.kind === "companion"),
          projectiles: [], pickups: [], events: [], gate: { id: "gate", x: 0, y: -0.95, normalized: true },
        };
        rb.renderSnapshot(snap, {});
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline && [...rb.actors.values()].some((r) => r.loading)) {
          await new Promise((r) => setTimeout(r, 80)); rb.renderSnapshot(snap, {});
        }
        for (let i = 0; i < 60; i += 1) { await new Promise((r) => requestAnimationFrame(r)); rb.renderSnapshot(snap, {}); }
      }, ids);
      const file = path.join(SHOTS, `${name}.png`);
      await page.locator("canvas").last().screenshot({ path: file });
      sheets[name] = path.relative(ROOT, file);
      console.log(`  sheet ${name}`);
    }
    // stance formation sheets, same real STANCE_CONFIG offsets the probe measured
    for (const stanceName of ["VANGUARD", "TURRET", "SPLIT"]) {
      await page.evaluate(async (stanceName) => {
        const rb = window.__probeRbHandle;
        const { STANCE_CONFIG } = await import("/rpg-catalog.js");
        const { ARENA } = await import("/defense-catalog.js");
        const cfg = STANCE_CONFIG[stanceName];
        for (const id of [...rb.actors.keys()]) rb.retireActor(id);
        const cx = ARENA.width / 2, cy = ARENA.height / 2;
        const norm = (x, y) => ({ x: (x / ARENA.width) * 2 - 1, y: (y / ARENA.height) * 2 - 1, normalized: true });
        const ids = ["ember-cohort", "rift-lens", "throne-echo"];
        const snap = {
          tick: 3, presentation: { stageId: "cinder-span" },
          commander: { id: "commander", kind: "commander", hp: 100, ...norm(cx, cy) },
          enemies: [],
          companions: cfg.offsets.map((o, i) => ({ id: `sc${i}`, kind: "companion", companionId: ids[i], hp: 100, ...norm(cx + o.x, cy + o.y) })),
          projectiles: [], pickups: [], events: [], gate: { id: "gate", ...norm(cx, cy * 0.1) },
        };
        rb.renderSnapshot(snap, {});
        const dl = Date.now() + 30000;
        while (Date.now() < dl && [...rb.actors.values()].some((r) => r.loading)) { await new Promise((r) => setTimeout(r, 80)); rb.renderSnapshot(snap, {}); }
        for (let i = 0; i < 60; i += 1) { await new Promise((r) => requestAnimationFrame(r)); rb.renderSnapshot(snap, {}); }
      }, stanceName);
      const file = path.join(SHOTS, `15-stance-${stanceName.toLowerCase()}.png`);
      await page.locator("canvas").last().screenshot({ path: file });
      sheets[`stance-${stanceName}`] = path.relative(ROOT, file);
      console.log(`  sheet stance-${stanceName}`);
    }
    result.sheets = sheets;
    result.served = served.filter((s) => s.status !== 200);
    const file = path.join(DATA, "actor-readability.json");
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    console.log(`\nactors measured: ${result.actors.length}`);
    console.log(`non-200: ${result.served.length}  pageErrors: ${errors.length}`);
    console.log(`report -> ${path.relative(ROOT, file)}`);
  } finally {
    await browser.close();
    await new Promise((r) => hosting.host.close(r));
  }
}
main().catch((e) => { console.error(e.stack || String(e)); process.exitCode = 1; });
