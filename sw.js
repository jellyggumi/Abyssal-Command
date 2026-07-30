// Renamed with the game title (Abyssal Command -> Abyssal Lantern). This prefix is
// CI-coupled: `.github/workflows/static.yml` greps for
// "abyssal-lantern-defense-survivor-$RESOLVED_SHA" in the deployed sw.js, so the two
// MUST change together or the Pages deploy fails its own verification step. Rotating the
// prefix also means `activate` below no longer recognises caches from the old name, so a
// returning client keeps one stale cache until the browser evicts it -- acceptable once,
// and the alternative (matching both prefixes forever) carries the old name indefinitely.
const CACHE_PREFIX = "abyssal-lantern-defense-survivor-";
const CACHE_NAME = "abyssal-lantern-defense-survivor-__CANDIDATE_SHA__";
// The release workflow rewrites the suffix above into the deployed commit SHA
// (.github/workflows/static.yml), which rotates CACHE_NAME and lets `activate`
// drop the previous release's cache. Served locally the suffix stays the
// literal placeholder, so the cache never rotates -- and because binaries are
// cache-first below, a rebuilt asset stays invisible forever: the browser
// keeps replaying the copy it cached on some earlier run. That is a
// development-only trap (rebuilding all 24 character GLBs changed nothing on
// screen until the cache was cleared by hand), so detect the unstamped suffix
// and fall back to network-first for everything. Deployed builds always have a
// hex SHA here and keep the cache-first binary path intact.
const IS_RELEASE_BUILD = /^[0-9a-f]{7,40}$/i.test(CACHE_NAME.slice(CACHE_PREFIX.length));
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./rpg-catalog.js",
  "./defense-viewport.js",
  "./defense-catalog.js",
  "./defense-run-simulation.js",
  "./campaign-state.js",
  "./defense-storage.js",
  "./battle-canvas-text.js",
  "./battle-realtime-three.js",
  "./battle-visualizer.js",
  "./defense-audio.js",
  "./defense-cutscene.js",
  "./defense-telemetry.js",
  // app.js statically imports both of these, so a cold offline load fails on a
  // module-resolution error without them in the install-time precache.
  "./lobby-cinematic.js",
  "./stage-world-catalog.js",
  // Generated UI icon layer (scripts/build-ui-icon-assets.py). These ARE precached,
  // unlike the battle GLBs below: all 16 together are ~440KB and they paint the
  // dock rail, brand, currency chips, and HUD glyphs on first frame, so deferring
  // them would show an empty shell on a cold offline load.
  "./assets/images/battle/ui/hud/control-close.webp",
  "./assets/images/battle/ui/hud/control-pause.webp",
  "./assets/images/battle/ui/hud/control-sortie.webp",
  "./assets/images/battle/ui/hud/brand-mark.webp",
  "./assets/images/battle/ui/hud/currency-bound-fragment.webp",
  "./assets/images/battle/ui/hud/currency-echo-core.webp",
  "./assets/images/battle/ui/hud/nav-companions.webp",
  "./assets/images/battle/ui/hud/nav-growth.webp",
  "./assets/images/battle/ui/hud/nav-inventory.webp",
  "./assets/images/battle/ui/hud/nav-sortie.webp",
  "./assets/images/battle/ui/hud/nav-stronghold.webp",
  "./assets/images/battle/ui/hud/stat-commander.webp",
  "./assets/images/battle/ui/hud/stat-echo-xp.webp",
  "./assets/images/battle/ui/hud/stat-gate-integrity.webp",
  "./vendor/three.module.js",
  "./vendor/three.core.js",
  "./vendor/loaders/GLTFLoader.js",
  "./vendor/utils/BufferGeometryUtils.js",
  "./vendor/utils/SkeletonUtils.js",
  // Stage meshes, actor rigs, props, and motion GLBs are intentionally
  // network-first: forcing the complete three-stage world at install would
  // delay first paint. A fetched binary is cached for offline replay.
  "./styles.css",
  "./react-game-ui.css",
  "./manifest.json",
  "./icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

const APP_SHELL_PATHS = new Set(
  CORE_ASSETS
    .filter((asset) => asset === "./index.html" || asset === "./manifest.json" || /\.(?:js|css)$/.test(asset))
    .map((asset) => new URL(asset, self.registration.scope).pathname),
);

function isAppShellRequest(request, url) {
  return request.mode === "navigate" || APP_SHELL_PATHS.has(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    // Release: drop only previous-SHA caches (keep the current one). Local/dev: the suffix is the
    // unstamped placeholder so the cache name never rotates -- purge EVERY cache on activate so a
    // rebuilt asset (JS/CSS/GLB) can never be replayed from a stale copy. Fixes "my change didn't
    // apply": once this SW activates, dev is always network-fresh (networkFirst below) + clean.
    names.filter((name) => !IS_RELEASE_BUILD || (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)).map((name) => caches.delete(name)),
  )).then(() => self.clients.claim()));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) ?? caches.match("./index.html");
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (isAppShellRequest(event.request, url) || !IS_RELEASE_BUILD) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached ?? networkFirst(event.request)));
});
