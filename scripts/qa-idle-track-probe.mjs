// QA idle-track probe (run-id 20260725-wellmade-verification). Measurement-only.
// Dumps the raw keyframe VALUES of the idle clip for one cohort-A boss and one
// cohort-B boss, so "cohort A idle produces zero motion" is proven from the
// authored data, not inferred from a playback sample.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "_workspace/20260725-wellmade-verification/qa/evidence/data");
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

const PROBE = async () => {
  const { GLTFLoader } = await import("/vendor/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  const load = (p) => new Promise((res, rej) => loader.load(`./assets/images/battle/glb/${p}`, res, undefined, rej));
  const targets = {
    "gate-sovereign (cohort A)": "bosses/gate-sovereign.glb",
    "tide-warden (cohort A)": "bosses/tide-warden.glb",
    "cinder-warden (cohort B)": "bosses/cinder-warden.glb",
    "abyss-regent (cohort B)": "bosses/abyss-regent.glb",
  };
  const out = {};
  for (const [label, rel] of Object.entries(targets)) {
    const gltf = await load(rel);
    const idle = gltf.animations.find((c) => /::idle::|^idle$/.test(c.name));
    const move = gltf.animations.find((c) => /::move::|^move$/.test(c.name));
    const describe = (clip) => {
      if (!clip) return null;
      let constantTracks = 0, varyingTracks = 0, maxSpread = 0, totalKeys = 0;
      const keyCounts = [];
      const varying = [];
      for (const track of clip.tracks) {
        const stride = track.values.length / track.times.length;
        totalKeys += track.times.length;
        keyCounts.push(track.times.length);
        let spread = 0;
        for (let c = 0; c < stride; c += 1) {
          let lo = Infinity, hi = -Infinity;
          for (let k = 0; k < track.times.length; k += 1) {
            const v = track.values[k * stride + c];
            if (v < lo) lo = v; if (v > hi) hi = v;
          }
          spread = Math.max(spread, hi - lo);
        }
        if (spread < 1e-7) constantTracks += 1;
        else { varyingTracks += 1; varying.push({ track: track.name, keys: track.times.length, spread }); }
        maxSpread = Math.max(maxSpread, spread);
      }
      const bones = new Set(clip.tracks.map((t) => t.name.split(".")[0]));
      varying.sort((a, b) => b.spread - a.spread);
      return {
        name: clip.name, duration: clip.duration, tracks: clip.tracks.length,
        animatedBones: bones.size, totalKeys,
        keysPerTrackMin: Math.min(...keyCounts), keysPerTrackMax: Math.max(...keyCounts),
        keysPerBonePerSec: totalKeys / bones.size / clip.duration,
        constantTracks, varyingTracks, maxValueSpread: maxSpread,
        varyingTrackList: varying.slice(0, 25),
      };
    };
    out[label] = { idle: describe(idle), move: describe(move), clipNames: gltf.animations.map((c) => c.name) };
  }
  return out;
};

async function main() {
  const hosting = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await (await browser.newContext({ baseURL: hosting.url })).newPage();
  try {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      for (const r of await navigator.serviceWorker?.getRegistrations?.() ?? []) await r.unregister();
      for (const n of await caches?.keys?.() ?? []) await caches.delete(n);
    });
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { document.body.innerHTML = ""; });
    const out = await page.evaluate(PROBE);
    fs.writeFileSync(path.join(DATA, "idle-tracks.json"), JSON.stringify(out, null, 2));
    for (const [k, v] of Object.entries(out)) {
      console.log(`${k}`);
      for (const c of ["idle", "move"]) {
        const d = v[c];
        if (!d) { console.log(`  ${c}: MISSING`); continue; }
        console.log(`  ${c}: dur=${d.duration}s tracks=${d.tracks} keys/track=${d.keysPerTrack} constant=${d.constantTracks} varying=${d.varyingTracks} maxSpread=${d.maxValueSpread.toExponential(3)}`);
      }
    }
  } finally {
    await browser.close();
    await new Promise((r) => hosting.host.close(r));
  }
}
main().catch((e) => { console.error(e.stack || String(e)); process.exitCode = 1; });
