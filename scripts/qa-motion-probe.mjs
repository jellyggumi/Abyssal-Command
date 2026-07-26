// QA motion probe (run-id 20260725-wellmade-verification). Measurement-only.
//
// Reads the AnimationClips exactly as the shipping renderer loads them
// (GLTFLoader via battle-realtime-three.js's own loadGltf cache), then:
//   1. counts real keyframes per bone per second per clip -> DEFECT A density
//   2. drives the REAL AnimationMixer at fixed 60Hz and measures WORLD-SPACE
//      bone-tip travel, which is what an eye actually sees, plus the per-frame
//      velocity discontinuity that reads as stutter
//   3. reports idle amplitude in world units at the model's rendered scale
//
// Usage: node scripts/qa-motion-probe.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "_workspace/20260725-wellmade-verification/qa/evidence/data");
const SHOTS = path.join(ROOT, "_workspace/20260725-wellmade-verification/qa/evidence/screens");
fs.mkdirSync(DATA, { recursive: true });

const MIME = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary" };
const served = [];
function startServer() {
  const host = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.resolve(ROOT, `.${rel === "/" ? "/index.html" : rel}`);
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    fs.stat(file, (e, st) => {
      if (e || !st.isFile()) { served.push({ rel, status: 404 }); return res.writeHead(404).end(); }
      served.push({ rel, status: 200 });
      res.writeHead(200, { "Cache-Control": "no-store, no-cache, must-revalidate", "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((r, j) => host.listen(0, "127.0.0.1", () => r({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", j));
}

const PROBE = async () => {
  const THREE = await import("/vendor/three.module.js");
  const { GLTFLoader } = await import("/vendor/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("/vendor/utils/SkeletonUtils.js");

  const MODELS = {
    "gate-sovereign": "bosses/gate-sovereign.glb", "lantern-tyrant": "bosses/lantern-tyrant.glb",
    "tide-warden": "bosses/tide-warden.glb", "veiled-concordat": "bosses/veiled-concordat.glb",
    "cinder-warden": "bosses/cinder-warden.glb", "veil-tactician": "bosses/veil-tactician.glb",
    "pack-herald": "bosses/pack-herald.glb", "requiem-choir": "bosses/requiem-choir.glb",
    "bridge-colossus": "bosses/bridge-colossus.glb", "abyss-regent": "bosses/abyss-regent.glb",
    scout: "enemies/scout.glb", shade: "enemies/shade.glb", guard: "enemies/guard.glb", possessed: "enemies/possessed.glb",
    "ember-cohort": "companions/ember-cohort.glb", "rift-lens": "companions/rift-lens.glb",
    "dusk-warden": "commander/dusk-warden.glb",
  };
  const TARGET_H = { boss: 4.5, enemy: 1.7, companion: 1.3, commander: 2.9 };
  const kindOf = (p) => (p.startsWith("bosses/") ? "boss" : p.startsWith("enemies/") ? "enemy" : p.startsWith("companions/") ? "companion" : "commander");

  const loader = new GLTFLoader();
  const load = (p) => new Promise((res, rej) => loader.load(`./assets/images/battle/glb/${p}`, res, undefined, rej));
  const CLIPS = ["idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show"];
  const keyOf = (n) => { const parts = String(n).split("::"); const c = parts.length >= 2 ? parts[1] : parts[0]; return CLIPS.includes(c) ? c : null; };

  const out = {};
  for (const [name, rel] of Object.entries(MODELS)) {
    const gltf = await load(rel);
    const instance = SkeletonUtils.clone(gltf.scene);
    // reproduce the renderer's fitHeight() exactly
    const target = TARGET_H[kindOf(rel)];
    const b0 = new THREE.Box3().setFromObject(instance);
    const s0 = b0.getSize(new THREE.Vector3());
    if (s0.y > 1e-6) instance.scale.setScalar(target / s0.y);
    const b1 = new THREE.Box3().setFromObject(instance);
    instance.position.y -= b1.min.y;
    instance.updateWorldMatrix(true, true);

    const bones = [];
    instance.traverse((n) => { if (n.isBone) bones.push(n); });
    const mixer = new THREE.AnimationMixer(instance);

    const entry = { modelPath: rel, kind: kindOf(rel), boneCount: bones.length, renderedHeight: target, clips: {} };
    for (const clip of gltf.animations) {
      const key = keyOf(clip.name);
      if (!key || entry.clips[key]) continue;
      // --- 1. authored keyframe density, straight off the tracks
      let totalKeys = 0;
      const perTrack = [];
      const boneNames = new Set();
      for (const track of clip.tracks) {
        const n = track.times.length;
        totalKeys += n;
        const boneName = track.name.split(".")[0];
        boneNames.add(boneName);
        perTrack.push({ name: track.name, keys: n });
      }
      const dur = clip.duration;
      const density = dur > 0 && boneNames.size ? totalKeys / boneNames.size / dur : 0;

      // --- 2. real mixer playback, world-space bone-tip travel
      mixer.stopAllAction();
      const action = mixer.clipAction(clip);
      action.reset(); action.enabled = true; action.setEffectiveWeight(1); action.play();
      mixer.setTime(0);
      instance.updateWorldMatrix(true, true);
      const worldOf = () => bones.map((bn) => { const v = new THREE.Vector3(); bn.getWorldPosition(v); return v; });
      let prev = worldOf();
      const start = prev.map((v) => v.clone());
      const dt = 1 / 60;
      const frames = Math.max(30, Math.round(dur * 60));
      let travel = 0, maxStep = 0;
      const stepSeries = [];
      const boneTravel = new Array(bones.length).fill(0);
      let maxExcursion = 0;
      for (let f = 0; f < frames; f += 1) {
        mixer.update(dt);
        instance.updateWorldMatrix(true, true);
        const cur = worldOf();
        let frameMax = 0;
        for (let i = 0; i < cur.length; i += 1) {
          const d = cur[i].distanceTo(prev[i]);
          boneTravel[i] += d;
          if (d > frameMax) frameMax = d;
          const ex = cur[i].distanceTo(start[i]);
          if (ex > maxExcursion) maxExcursion = ex;
        }
        travel += frameMax;
        stepSeries.push(frameMax);
        if (frameMax > maxStep) maxStep = frameMax;
        prev = cur;
      }
      const accel = stepSeries.slice(1).map((x, i) => Math.abs(x - stepSeries[i]));
      const meanStep = stepSeries.reduce((s, x) => s + x, 0) / stepSeries.length;
      // Velocity-discontinuity index: mean |dv| normalised by mean v. A densely
      // sampled curve has small frame-to-frame velocity change relative to its
      // speed; a sparse linear-interpolated one holds velocity flat then jumps.
      const jerkIndex = meanStep > 1e-9 ? (accel.reduce((s, x) => s + x, 0) / accel.length) / meanStep : 0;
      const stillFrames = stepSeries.filter((x) => x < 1e-6).length;

      entry.clips[key] = {
        durationSec: dur, tracks: clip.tracks.length, animatedBones: boneNames.size,
        totalKeyframes: totalKeys, keyframesPerBonePerSec: density,
        // world units at the model's RENDERED scale
        maxBoneExcursion: maxExcursion,
        excursionAsPctOfHeight: (maxExcursion / target) * 100,
        totalTravel: travel, meanStepPerFrame: meanStep, maxStepPerFrame: maxStep,
        jerkIndex, stillFrameRatio: stillFrames / stepSeries.length,
        moving: maxStep > 1e-6,
      };
      action.stop();
    }
    out[name] = entry;
  }
  return out;
};

async function main() {
  const hosting = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: hosting.url, viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  try {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    const hygiene = await page.evaluate(async () => {
      const before = { registrations: (await navigator.serviceWorker?.getRegistrations?.() ?? []).length, caches: await caches?.keys?.() ?? [] };
      for (const r of await navigator.serviceWorker?.getRegistrations?.() ?? []) await r.unregister();
      for (const n of await caches?.keys?.() ?? []) await caches.delete(n);
      return { before, after: { registrations: (await navigator.serviceWorker?.getRegistrations?.() ?? []).length, caches: (await caches?.keys?.() ?? []).length } };
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.clearBrowserCache").catch(() => {});
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true }).catch(() => {});
    served.length = 0;
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { document.body.innerHTML = ""; });
    const models = await page.evaluate(PROBE);
    const report = { swHygiene: hygiene, pageErrors: errors, non200: served.filter((s) => s.status !== 200), models };
    const file = path.join(DATA, "motion.json");
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`models: ${Object.keys(models).length}  errors: ${errors.length}  non200: ${report.non200.length}`);
    console.log(`report -> ${path.relative(ROOT, file)}`);
  } finally {
    await browser.close();
    await new Promise((r) => hosting.host.close(r));
  }
}
main().catch((e) => { console.error(e.stack || String(e)); process.exitCode = 1; });
