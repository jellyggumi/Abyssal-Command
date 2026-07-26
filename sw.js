const CACHE_PREFIX = "abyssal-command-defense-survivor-";
const CACHE_NAME = "abyssal-command-defense-survivor-__CANDIDATE_SHA__";
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
  "./assets/images/battle/dusk-warden-frame-00.png",
  "./assets/images/battle/dusk-warden-frame-01.png",
  "./assets/images/battle/dusk-warden-frame-02.png",
  "./assets/images/battle/dusk-warden-frame-03.png",
  "./assets/images/battle/echo-rusher-frame-00.png",
  "./assets/images/battle/echo-rusher-frame-01.png",
  "./assets/images/battle/echo-rusher-frame-02.png",
  "./assets/images/battle/echo-rusher-frame-03.png",
  "./assets/images/battle/world/cinder-span-tactical-paper-plate.webp",
  "./assets/images/battle/world/cinder-span-topdown-plate.webp",
  "./vendor/three.module.js",
  "./vendor/three.core.js",
  "./vendor/loaders/GLTFLoader.js",
  "./vendor/utils/BufferGeometryUtils.js",
  "./vendor/utils/SkeletonUtils.js",
  // None of the 40 battle GLBs (assets/images/battle/glb/) are precached here:
  // together they total ~29MB (grew from ~19MB once 19 of them were rigged and
  // animated), and forcing every visitor to download that before install
  // completes would block first paint on mobile. networkFirst() below still
  // caches each one into CACHE_NAME on its first real fetch (battle start),
  // so offline replay works normally after one online session -- this only
  // defers the cost off the install-blocking critical path.
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
    names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)),
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
