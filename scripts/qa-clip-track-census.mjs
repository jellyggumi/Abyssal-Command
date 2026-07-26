// QA clip-track census (run-id 20260725-wellmade-verification). Measurement-only.
//
// For all 24 character GLBs x all 11 clips, separates two things the
// "keyframes per bone per second" aggregate conflates:
//   (a) SAMPLE RATE   -- keys per second on the tracks that actually vary
//   (b) ANIMATED-BONE COVERAGE -- how many tracks vary at all
// A constant track still contributes its 2 endpoint keys to the aggregate, so
// a model with fewer animated bones scores a lower "density" without any
// sample-rate difference existing.
//
// Usage: node scripts/qa-clip-track-census.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "_workspace/20260725-wellmade-verification/qa/evidence/data");
const GLB_DIR = path.join(ROOT, "assets/images/battle/glb");
const MIME = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".glb": "model/gltf-binary", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
function startServer() {
  const host = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.resolve(ROOT, `.${rel === "/" ? "/index.html" : rel}`);
    if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
    fs.stat(file, (e, st) => {
      if (e || !st.isFile()) return res.writeHead(404).end();
      res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((r, j) => host.listen(0, "127.0.0.1", () => r({ host, url: `http://127.0.0.1:${host.address().port}` })).on("error", j));
}

const PROBE = async (relPaths) => {
  const { GLTFLoader } = await import("/vendor/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  const load = (p) => new Promise((res, rej) => loader.load(`./assets/images/battle/glb/${p}`, res, undefined, rej));
  const CLIPS = ["idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show"];
  const keyOf = (n) => { const p = String(n).split("::"); const c = p.length >= 2 ? p[1] : p[0]; return CLIPS.includes(c) ? c : null; };
  const out = {};
  for (const rel of relPaths) {
    let gltf;
    try { gltf = await load(rel); } catch (e) { out[rel] = { error: String(e?.message ?? e) }; continue; }
    const entry = { clips: {} };
    for (const clip of gltf.animations) {
      const key = keyOf(clip.name);
      if (!key || entry.clips[key]) continue;
      let constant = 0, totalKeys = 0;
      const varyingKeyCounts = [];
      const varyingBones = new Set();
      let maxSpread = 0;
      for (const track of clip.tracks) {
        const stride = track.values.length / track.times.length;
        totalKeys += track.times.length;
        let spread = 0;
        for (let c = 0; c < stride; c += 1) {
          let lo = Infinity, hi = -Infinity;
          for (let k = 0; k < track.times.length; k += 1) {
            const v = track.values[k * stride + c];
            if (v < lo) lo = v; if (v > hi) hi = v;
          }
          spread = Math.max(spread, hi - lo);
        }
        if (spread < 1e-7) constant += 1;
        else { varyingKeyCounts.push(track.times.length); varyingBones.add(track.name.split(".")[0]); }
        maxSpread = Math.max(maxSpread, spread);
      }
      const bones = new Set(clip.tracks.map((t) => t.name.split(".")[0])).size;
      const sampleHz = varyingKeyCounts.length ? Math.max(...varyingKeyCounts) / clip.duration : 0;
      entry.clips[key] = {
        duration: clip.duration, tracks: clip.tracks.length, riggedBones: bones,
        totalKeys, aggregateKfPerBonePerSec: totalKeys / bones / clip.duration,
        constantTracks: constant, varyingTracks: varyingKeyCounts.length,
        varyingBones: varyingBones.size,
        sampleHzOnVaryingTracks: sampleHz,
        maxValueSpread: maxSpread,
      };
    }
    out[rel] = entry;
  }
  return out;
};

async function main() {
  const rels = [];
  for (const dir of ["bosses", "enemies", "companions", "commander"]) {
    for (const f of fs.readdirSync(path.join(GLB_DIR, dir))) if (f.endsWith(".glb")) rels.push(`${dir}/${f}`);
  }
  const hosting = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: hosting.url });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
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
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { document.body.innerHTML = ""; });
    const models = await page.evaluate(PROBE, rels);
    fs.writeFileSync(path.join(DATA, "clip-track-census.json"), JSON.stringify({ swHygiene: hygiene, pageErrors: errors, models }, null, 2));
    console.log(`models: ${Object.keys(models).length}  errors: ${errors.length}`);
  } finally {
    await browser.close();
    await new Promise((r) => hosting.host.close(r));
  }
}
main().catch((e) => { console.error(e.stack || String(e)); process.exitCode = 1; });
