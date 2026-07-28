// Candidate-only browser QA for UV-baked procedural GLBs.
//
// This intentionally hosts the inert privacy.html rather than index.html: the
// production entry point owns a renderer and requestAnimationFrame loop, which
// would make a second WebGL test renderer non-deterministic.
//
// Usage: node scripts/qa-textured-candidates.mjs
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANE = path.join(ROOT, "_workspace/current/engineering/asset-pipeline/ingame-mesh/textured");
const MANIFEST = path.join(LANE, "textured-procedural-resources.manifest.json");
const REPORT = path.join(LANE, "textured-candidate-browser-qa.json");
const MIME = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".json": "application/json",
  ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary",
};
const served = [];

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const relative = decodeURIComponent(url.pathname === "/" ? "/privacy.html" : url.pathname);
    const file = path.resolve(ROOT, `.${relative}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) {
      served.push({ path: relative, status: 403 });
      res.writeHead(403).end();
      return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        served.push({ path: relative, status: 404 });
        res.writeHead(404).end();
        return;
      }
      served.push({ path: relative, status: 200, bytes: stat.size });
      res.writeHead(200, {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
    server.on("error", reject);
  });
}

async function inspectCandidates(page, hosting) {
  await page.goto(`${hosting.url}/privacy.html`, { waitUntil: "domcontentloaded" });
  const scriptCount = await page.evaluate(() => document.scripts.length);
  if (scriptCount !== 0) throw new Error(`inert QA host unexpectedly contains ${scriptCount} script tags`);

  return page.evaluate(async (manifestPath) => {
    const THREE = await import("/vendor/three.module.js");
    const { GLTFLoader } = await import("/vendor/loaders/GLTFLoader.js");
    const manifestResponse = await fetch(manifestPath);
    if (!manifestResponse.ok) throw new Error(`manifest HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    if (manifest.runtimeEligible !== false) throw new Error("candidate manifest lost runtime guard");

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    canvas.style.width = "128px";
    canvas.style.height = "128px";
    document.body.replaceChildren(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(128, 128, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101820);
    scene.add(new THREE.HemisphereLight(0xc7edff, 0x132033, 2.2));
    const key = new THREE.DirectionalLight(0xfff4dc, 2.8);
    key.position.set(3, 5, 4);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    const loader = new GLTFLoader();
    const rows = [];

    for (const row of manifest.rows) {
      const response = await fetch(`/${row.output}`);
      if (!response.ok) throw new Error(`${row.assetId}: HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      const gltf = await new Promise((resolve, reject) => loader.parse(data, "/", resolve, reject));
      const root = gltf.scene;
      let meshCount = 0;
      let mappedPrimitiveCount = 0;
      let mipmappedTextureCount = 0;
      root.traverse((node) => {
        if (!node.isMesh) return;
        meshCount += 1;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (!material?.map?.isTexture) continue;
          mappedPrimitiveCount += 1;
          if (material.map.minFilter === THREE.LinearMipmapLinearFilter) mipmappedTextureCount += 1;
        }
      });
      if (meshCount !== row.textureArtifacts.length) {
        throw new Error(`${row.assetId}: ${meshCount} meshes but ${row.textureArtifacts.length} recorded texture artifacts`);
      }
      if (mappedPrimitiveCount !== meshCount || mipmappedTextureCount !== meshCount) {
        throw new Error(`${row.assetId}: only ${mappedPrimitiveCount}/${meshCount} meshes received mipmapped texture maps`);
      }

      scene.add(root);
      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.5, 0.1);
      camera.position.copy(center).add(new THREE.Vector3(radius * 3.0, radius * 2.0, radius * 3.0));
      camera.lookAt(center);
      renderer.render(scene, camera);
      const pixels = new Uint8Array(128 * 128 * 4);
      const gl = renderer.getContext();
      gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let litPixels = 0;
      let litRgbTotal = 0;
      let peakRgb = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const rgb = pixels[index] + pixels[index + 1] + pixels[index + 2];
        if (rgb <= 80) continue;
        litPixels += 1;
        litRgbTotal += rgb;
        peakRgb = Math.max(peakRgb, rgb);
      }
      if (litPixels === 0) throw new Error(`${row.assetId}: small-camera render produced no lit pixels`);
      scene.remove(root);
      rows.push({
        assetId: row.assetId,
        status: response.status,
        meshCount,
        mappedPrimitiveCount,
        mipmappedTextureCount,
        litPixels,
        meanLitRgb: Number((litRgbTotal / litPixels).toFixed(3)),
        peakRgb,
      });
    }
    renderer.dispose();
    return { atlasSize: manifest.atlasSize, assetCount: rows.length, textureCount: manifest.textureCount, candidateGlbBytes: manifest.candidateGlbBytes, textureBytes: manifest.textureBytes, rows };
  }, "/_workspace/current/engineering/asset-pipeline/ingame-mesh/textured/textured-procedural-resources.manifest.json");
}

async function main() {
  if (!fs.existsSync(MANIFEST)) throw new Error(`candidate texture manifest missing: ${MANIFEST}`);
  const hosting = await startServer();
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 160, height: 160 }, deviceScaleFactor: 1 });
  const report = { runId: "textured-candidate-browser-qa", startedAt: new Date().toISOString(), host: "privacy.html" };
  try {
    Object.assign(report, await inspectCandidates(page, hosting));
  } finally {
    await browser.close();
    await new Promise((resolve) => hosting.server.close(resolve));
  }
  report.served = served;
  report.non200 = served.filter((entry) => entry.status !== 200);
  report.ok = report.non200.length === 0 && report.rows.every((row) => row.meshCount === row.mappedPrimitiveCount && row.meshCount === row.mipmappedTextureCount && row.litPixels > 0);
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, assets: report.assetCount, textures: report.textureCount, non200: report.non200.length, report: path.relative(ROOT, REPORT), sha256: createHash("sha256").update(fs.readFileSync(REPORT)).digest("hex") }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
