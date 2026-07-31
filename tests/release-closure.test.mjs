import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";
import { RETAINED_ASSET_PATHS } from "../scripts/defense-runtime-assets.mjs";

const execFileAsync = promisify(execFile);
const ROOT = new URL("../", import.meta.url);
const RULES_VERSION = "defense-survivor-v1";
const GAMEPLAY_VIDEO = "assets/video/abyssal-surge-defense-survivor-smoke.mp4";
/* Generated UI icon layer (scripts/build-ui-icon-assets.py). Ordered exactly as the
   workflow's PAGES_RUNTIME_PATHS lists them, because this list is compared as a
   sequence against that env value. */
const UI_ICON_ASSETS = Object.freeze([
  "assets/images/battle/ui/hud/control-close.webp",
  "assets/images/battle/ui/hud/control-pause.webp",
  "assets/images/battle/ui/hud/control-sortie.webp",
  "assets/images/battle/ui/hud/brand-mark.webp",
  "assets/images/battle/ui/hud/currency-bound-fragment.webp",
  "assets/images/battle/ui/hud/currency-echo-core.webp",
  "assets/images/battle/ui/hud/nav-companions.webp",
  "assets/images/battle/ui/hud/nav-growth.webp",
  "assets/images/battle/ui/hud/nav-inventory.webp",
  "assets/images/battle/ui/hud/nav-sortie.webp",
  "assets/images/battle/ui/hud/nav-stronghold.webp",
  "assets/images/battle/ui/hud/stat-commander.webp",
  "assets/images/battle/ui/hud/stat-echo-xp.webp",
  "assets/images/battle/ui/hud/stat-gate-integrity.webp",
]);
const PROMOTED_MOTION_CHARACTER_IDS = Object.freeze([
  "broken-court-monarch-boss",
  "broken-court-monarch-v04",
  "ember-cohort",
  "guard",
  "human-command-boss",
  "lantern-reaver",
  "possessed",
  "scout",
  "shade",
  "shadow-soldier-v04",
  "shadow-commander-boss",
]);
const PROMOTED_MOTION_CHARACTER_ASSETS = Object.freeze([
  ...PROMOTED_MOTION_CHARACTER_IDS.flatMap((id) => [
    `assets/motion/ingame/characters/${id}/model.glb`,
    `assets/motion/ingame/characters/${id}/manifest.json`,
  ]),
  "assets/motion/ingame/characters/registry.json",
  "assets/motion/ingame/characters/rights-receipt.json",
]);
/**
 * Sampled audio buffers, derived from the shipped index rather than restated.
 *
 * The index is the runtime's own map (`assets/audio/elevenlabs/index.json`); reading it here is
 * what makes "every cue the game will try to fetch is deployed" a checked property instead of a
 * hand-maintained parallel list that drifts the first time a cue is added.
 */
const AUDIO_SAMPLE_INDEX = JSON.parse(
  await readFile(new URL("assets/audio/elevenlabs/index.json", ROOT), "utf8"),
);
// Deduped, and that is load-bearing. This derives a list of FILES to deploy, while the index is
// keyed by CUE, and two cues deliberately share one file (`impact-hit:PICKUP_DENIED` and
// `impact-hit:STANCE_SWITCH_BLOCKED` both point at `impact-hit--pickup-denied.mp3`). A per-cue
// map therefore yielded that path twice and forced the same duplicate into the workflow's
// `PAGES_RUNTIME_PATHS` to satisfy the deepEqual below -- which broke `package_pages` on `main`,
// because that job compares `find`'s output (129 unique files) against the listed paths (130
// with the repeat) as sorted strings. A Set keeps insertion order, so the sequence contract the
// deepEqual enforces is unchanged; only the repeat is gone.
const AUDIO_SAMPLE_ASSETS = Object.freeze([...new Set([
  ...Object.values(AUDIO_SAMPLE_INDEX.cues ?? {}).map(({ url }) => url),
  ...Object.values(AUDIO_SAMPLE_INDEX.loops ?? {}).map(({ url }) => url),
])]);

const DIRECT_RUNTIME_ASSETS = Object.freeze([
  // Cycle 10: the composed slab floors are the gameplay ground the runtime loads.
  // Order matters -- this list is compared with assert.deepEqual against the
  // workflow's PAGES_RUNTIME_PATHS, so these three must sit here in the same
  // position they occupy in scripts/defense-runtime-assets.mjs and static.yml.
  "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span-floor.glb",
  "assets/mesh/terrain/terrain-abyss-chancel/runtime/terrain/terrain-abyss-chancel-floor.glb",
  "assets/mesh/terrain/terrain-echo-throne/runtime/terrain/terrain-echo-throne-floor.glb",
  "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb",
  "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-features.glb",
  "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-props.glb",
  "assets/mesh/terrain/terrain-cinder-span/runtime/terrain-cinder-span-resources.manifest.json",
  "assets/mesh/terrain/terrain-abyss-chancel/textured-candidate/terrain/terrain-abyss-chancel-textured-cleaned.glb",
  "assets/mesh/terrain/terrain-echo-throne/textured-candidate/terrain/terrain-echo-throne-textured.glb",
  "assets/mesh/boss/s1-cinder-warden/glb/base_basic_pbr.glb",
  "assets/mesh/boss/s2-veil-tactician/glb/base_basic_pbr.glb",
  "assets/mesh/boss/s3-gate-sovereign/glb/base_basic_pbr.glb",
  "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb",
  "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb",
  "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb",
  ...PROMOTED_MOTION_CHARACTER_ASSETS,
  "assets/motion/ingame/unarmed-core.glb",
  "assets/motion/ingame/manifest.json",
  "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  "assets/motion/stage-vfx/manifest.json",
  // Hybrid audio (D-20260730-02): DefenseAudio fetches this index at start() and layers the
  // sampled cues over the procedural profiles. If the index is not deployed the runtime silently
  // stays procedural, so shipping the map WITHOUT the buffers it points at would be the failure
  // this list exists to prevent -- every referenced file is enumerated below with it.
  "assets/audio/elevenlabs/index.json",
  ...AUDIO_SAMPLE_ASSETS,
]);
const RUNTIME_PATHS = [
  "index.html", "app.js", "rpg-catalog.js", "stage-world-catalog.js", "stage-story-catalog.js", "defense-viewport.js", "defense-catalog.js", "defense-run-simulation.js",
  "campaign-state.js", "defense-storage.js", "defense-audio.js", "defense-cutscene.js", "defense-telemetry.js",
  "battle-canvas-text.js", "battle-realtime-three.js", "battle-visualizer.js", "lobby-cinematic.js", "styles.css", "react-game-ui.css", "sw.js", "manifest.json", "icon.svg", "privacy.html",
  "vendor/three.module.js", "vendor/three.core.js", "vendor/loaders/GLTFLoader.js", "vendor/utils/BufferGeometryUtils.js", "vendor/utils/SkeletonUtils.js",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png",
  ...UI_ICON_ASSETS,
  ...DIRECT_RUNTIME_ASSETS,
];

async function project(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

function job(workflow, name) {
  const jobs = "resolve_revision|engine_contract|release_closure|browser_contract|package_pages|artifact_smoke|deploy_pages|deployed_smoke|release_receipt";
  const match = workflow.match(new RegExp(`^  ${name}:\\n(?<body>[\\s\\S]*?)(?=^  (?:${jobs}):|(?![\\s\\S]))`, "m"));
  assert.ok(match, `workflow must define ${name}`);
  return match.groups.body;
}

function runtimePaths(workflow) {
  const match = workflow.match(/PAGES_RUNTIME_PATHS: >-\n(?<paths>(?: {4,}[^\n]+\n)+)/);
  assert.ok(match, "workflow must declare the Pages runtime allowlist");
  return match.groups.paths.trim().split(/\s+/);
}

function assertCommandsInOrder(workflow, jobName, commands) {
  const body = job(workflow, jobName);
  let previousIndex = -1;
  let previousCommand = "the start of the job";
  for (const command of commands) {
    const index = body.indexOf(command, previousIndex + 1);
    assert.ok(index > previousIndex, `${jobName} must run ${command} after ${previousCommand}`);
    previousIndex = index;
    previousCommand = command;
  }
}

test("Pages workflow preserves the defense-survivor release DAG and closure", async () => {
  const [workflow, readme] = await Promise.all([
    project(".github/workflows/static.yml"),
    project("README.md"),
  ]);
  const order = [
    "resolve_revision", "engine_contract", "release_closure", "browser_contract", "package_pages",
    "artifact_smoke", "deploy_pages", "deployed_smoke", "release_receipt",
  ];
  for (const name of order) assert.ok(job(workflow, name), `workflow must include ${name}`);

  for (const name of ["engine_contract", "release_closure", "browser_contract"]) {
    assert.match(job(workflow, name), /needs: resolve_revision/);
  }
  assert.match(job(workflow, "package_pages"), /needs: \[resolve_revision, engine_contract, release_closure, browser_contract\]/);
  assert.match(job(workflow, "artifact_smoke"), /needs: \[resolve_revision, package_pages\]/);
  assert.match(job(workflow, "deploy_pages"), /needs: \[resolve_revision, artifact_smoke\]/);
  assert.match(job(workflow, "deployed_smoke"), /needs: \[resolve_revision, deploy_pages\]/);
  assert.match(job(workflow, "deployed_smoke"), /if: needs\.deploy_pages\.result == 'success'/);
  assert.match(job(workflow, "release_receipt"), /if: always\(\)/);
  assert.match(job(workflow, "release_receipt"), /needs: \[resolve_revision, engine_contract, release_closure, browser_contract, package_pages, artifact_smoke, deploy_pages, deployed_smoke\]/);

  const pagesRuntimePaths = runtimePaths(workflow);
  assert.deepEqual(pagesRuntimePaths, RUNTIME_PATHS);
  const pagesRuntimePathSet = new Set(pagesRuntimePaths);
  const missingRetainedRuntimeAssets = RETAINED_ASSET_PATHS.filter(
    (path) => path !== "assets/defense-asset-manifest.json" && !pagesRuntimePathSet.has(path),
  );
  assert.deepEqual(
    missingRetainedRuntimeAssets,
    [],
    "every retained runtime asset must be present in the Pages runtime allowlist",
  );
  const pagesCharacterRuntimeAssets = pagesRuntimePaths.filter((path) =>
    path.startsWith("assets/motion/ingame/characters/"),
  );
  assert.deepEqual(
    pagesCharacterRuntimeAssets,
    PROMOTED_MOTION_CHARACTER_ASSETS,
    "Pages must ship the exact ordered promoted character model/manifest pairs, registry, and rights receipt",
  );
  const retainedCharacterRuntimeAssets = RETAINED_ASSET_PATHS.filter((path) =>
    path.startsWith("assets/motion/ingame/characters/"),
  );
  assert.deepEqual(
    retainedCharacterRuntimeAssets,
    PROMOTED_MOTION_CHARACTER_ASSETS,
    "retained assets must close over the exact ordered promoted character runtime contract",
  );

  for (const path of pagesRuntimePaths) {
    await execFileAsync("git", ["ls-files", "--error-unmatch", "--", path]);
  }
  assertCommandsInOrder(workflow, "engine_contract", [
    "npm ci",
    "npx --no-install playwright install --with-deps chromium",
    "tests/defense-renderer-contract.test.mjs",
  ]);
  assertCommandsInOrder(workflow, "browser_contract", [
    "npm ci",
    "npx --no-install playwright install --with-deps chromium",
  ]);
  const browserContractJob = job(workflow, "browser_contract");
  const browserLoop = browserContractJob.match(
    /^\s*for browser_contract in defense-hud-responsive-browser defense-phone-battle-hud-browser\.test progression-mobile-ui-browser defense-survivor-browser defense-performance-browser; do\n(?<body>[\s\S]*?)^\s*done$/m,
  );
  assert.ok(browserLoop, "browser_contract must iterate the exact bounded browser suite allowlist");
  assert.match(
    browserLoop.groups.body,
    /^\s*set \+e\n\s*node "tests\/\$\{browser_contract\}\.cjs" 2>&1 \| tee "\$result"\n\s*test_status=\$\{PIPESTATUS\[0\]\}\n\s*set -e\n\s*if \[ "\$test_status" -ne 0 \]; then\n\s*status=failed$/m,
    "browser_contract must run the exact templated node command and retain each suite's nonzero status",
  );
  assert.doesNotMatch(
    browserLoop.groups.body,
    /^\s*status=(?!failed\s*$)/m,
    "browser_contract must not reset an observed failure before the aggregate gate",
  );
  assert.match(
    browserContractJob.slice(browserLoop.index + browserLoop[0].length),
    /^\s*printf [^\n]+\n\s*test "\$status" = passed$/m,
    "browser_contract must fail the aggregate gate after recording every suite result",
  );
  assert.match(job(workflow, "package_pages"), /read -r -a paths <<< "\$PAGES_RUNTIME_PATHS"/);
  assert.match(job(workflow, "package_pages"), /git archive --format=tar "\$RESOLVED_SHA" -- "\$\{paths\[@\]\}"/);
  assert.match(readme, new RegExp(`\\]\\(${GAMEPLAY_VIDEO.replaceAll(".", "\\.")}\\)`), `README must link ${GAMEPLAY_VIDEO}`);
  assert.match(workflow, /"rules_version":"%s"/);
  assert.match(workflow, /node scripts\/validate-pages-version\.mjs --file "\$PAGES_ARTIFACT_DIR\/version\.json" --sha "\$RESOLVED_SHA"/);
  assert.match(workflow, /status=unsupported-no-deployed-defense-smoke/);
  assert.match(job(workflow, "release_receipt"), /for result in "\$ENGINE" "\$CLOSURE" "\$BROWSER" "\$PACKAGE" "\$ARTIFACT" "\$DEPLOY" "\$DEPLOYED"; do/);
  for (const name of ["engine_contract", "release_closure", "browser_contract", "package_pages", "artifact_smoke", "deployed_smoke"]) {
    assert.match(job(workflow, name), /actions\/setup-node@[0-9a-f]{40}/, `${name} must pin the Node runtime`);
    assert.match(job(workflow, name), /node-version: 22\.14\.0/, `${name} must use the supported Node version`);
  }
  assert.match(job(workflow, "deployed_smoke"), /npm ci/);
  assert.match(job(workflow, "deployed_smoke"), /playwright install --with-deps chromium/);
  assert.match(job(workflow, "deployed_smoke"), /--rules-version "\$RULES_VERSION"/);
  assert.match(job(workflow, "package_pages"), /include-hidden-files: true/);
  assert.match(job(workflow, "package_pages"), /name: pages-bundle[\s\S]*?if-no-files-found: error/);
  assert.match(job(workflow, "release_receipt"), /"all_gate_pass":%s/);
  assert.match(job(workflow, "release_receipt"), /test "\$all_gate_pass" = true/);
  assert.doesNotMatch(workflow.match(/PAGES_RUNTIME_PATHS: >-[\s\S]*?\n\n/)?.[0] ?? "", /react-game-ui\.js|react-shop|vendor\/react|minimap|battle-field|campaign-sync|\.blend/i);

  for (const use of workflow.matchAll(/^\s+uses: [^\n]+$/gm)) {
    assert.match(use[0], /@[0-9a-f]{40}$/, `action must be SHA-pinned: ${use[0]}`);
  }
  for (const name of order) {
    assert.match(job(workflow, name), /if: always\(\)[\s\S]*?upload-artifact/, `${name} must upload results even after failure`);
  }
});

test("version scripts enforce the exact defense rules version", async () => {
  const reader = await project("scripts/read-defense-rules-version.mjs");
  assert.match(reader, new RegExp(`RULES_VERSION = "${RULES_VERSION}"`));
  assert.match(reader, /defense-catalog\.js must export RULES_VERSION/);

  const directory = await mkdtemp(join(tmpdir(), "pages-version-"));
  const versionFile = join(directory, "version.json");
  const sha = "a".repeat(40);
  await writeFile(versionFile, JSON.stringify({ candidate_sha: sha, rules_version: RULES_VERSION }));
  await execFileAsync(process.execPath, ["scripts/validate-pages-version.mjs", "--file", versionFile, "--sha", sha]);
  await writeFile(versionFile, JSON.stringify({ candidate_sha: sha, rules_version: "wrong" }));
  const required = ["version.json", ...RUNTIME_PATHS];
  for (const file of required) {
    const target = join(directory, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file === "app.js" ? 'import "./bootstrap.js";\n' : "");
  }

  const command = new URL("tests/pages-artifact-smoke.cjs", ROOT).pathname;
  await assert.rejects(execFileAsync(process.execPath, [command, "--dir", directory]));
  await writeFile(join(directory, "bootstrap.js"), "export const boot = true;\n");
  await execFileAsync(process.execPath, [command, "--dir", directory]);
});

test("the candidate-stamped service worker precaches every runtime observer, refreshes the app shell, and preserves binary cache-first behavior", async () => {
  const candidateSha = "b".repeat(40);
  const listeners = new Map();
  const opened = [];
  const deleted = [];
  const cached = new Map();
  let precached = [];
  let installPromise;
  let activatePromise;
  let fetchHandler = async () => { throw new Error("unexpected network request"); };
  // Prefix renamed with the game title; must stay byte-identical to sw.js CACHE_PREFIX and
  // the grep in .github/workflows/static.yml -- three coupled sites, one string.
  const currentCache = `abyssal-lantern-defense-survivor-${candidateSha}`;
  const staleCache = `abyssal-lantern-defense-survivor-${"a".repeat(40)}`;
  const unrelatedCache = "another-application-cache";
  const requestKey = (request) => typeof request === "string"
    ? new URL(request, self.location.href).href
    : request.url;
  const cache = {
    addAll: async (assets) => { precached = [...assets]; },
    put: async (request, response) => { cached.set(requestKey(request), response); },
  };
  const caches = {
    open: async (name) => {
      opened.push(name);
      return cache;
    },
    keys: async () => [currentCache, staleCache, unrelatedCache],
    delete: async (name) => { deleted.push(name); return true; },
    match: async (request) => cached.get(requestKey(request)) ?? null,
  };
  const self = {
    location: {
      origin: "https://example.test",
      href: "https://example.test/Abyssal-Surge/sw.js",
    },
    registration: { scope: "https://example.test/Abyssal-Surge/" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  const artifactSource = (await project("sw.js")).replaceAll("__CANDIDATE_SHA__", candidateSha);
  runInNewContext(artifactSource, {
    URL,
    Promise,
    Request,
    Response,
    caches,
    fetch: (...args) => fetchHandler(...args),
    self,
  });

  listeners.get("install")({
    waitUntil(promise) { installPromise = promise; },
  });
  await installPromise;
  assert.deepEqual(opened, [currentCache]);
  assert.ok(precached.includes("./battle-canvas-text.js"), "the renderer text helper must be candidate-stamped with the app shell");
  assert.equal(
    precached.some((path) => /assets\/images\/battle\/world\/cinder-span-.*\.(?:png|webp)$/.test(path)),
    false,
    "the service worker must not precache retired Cinder Span world plates",
  );
  assert.ok(precached.includes("./defense-cutscene.js"));
  assert.ok(precached.includes("./stage-story-catalog.js"));
  assert.ok(precached.includes("./defense-telemetry.js"));

  listeners.get("activate")({
    waitUntil(promise) { activatePromise = promise; },
  });
  await activatePromise;
  assert.deepEqual(deleted, [staleCache]);

  const dispatchFetch = async (request) => {
    let responsePromise;
    listeners.get("fetch")({
      request,
      respondWith(promise) { responsePromise = Promise.resolve(promise); },
    });
    assert.ok(responsePromise, `service worker must respond to ${request.url}`);
    return responsePromise;
  };
  const stylesheetRequest = new Request("https://example.test/Abyssal-Surge/styles.css");
  cached.set(requestKey(stylesheetRequest), new Response("/* stale stylesheet */", { status: 200 }));
  const fetchCalls = [];
  fetchHandler = async (request, init) => {
    fetchCalls.push({ request, init });
    return new Response("/* deployed stylesheet */", { status: 200 });
  };

  const onlineStylesheet = await dispatchFetch(stylesheetRequest);
  assert.equal(await onlineStylesheet.text(), "/* deployed stylesheet */");
  assert.equal(fetchCalls.length, 1, "a cached stylesheet must still check the network");
  assert.equal(fetchCalls[0].request.url, stylesheetRequest.url);
  assert.equal(fetchCalls[0].init.cache, "no-store");
  assert.equal(await cached.get(requestKey(stylesheetRequest)).text(), "/* deployed stylesheet */");

  cached.set(requestKey(stylesheetRequest), new Response("/* offline cached stylesheet */", { status: 200 }));
  fetchHandler = async () => { throw new Error("offline"); };
  const offlineStylesheet = await dispatchFetch(stylesheetRequest);
  assert.equal(await offlineStylesheet.text(), "/* offline cached stylesheet */");

  const canvasTextRequest = new Request("https://example.test/Abyssal-Surge/battle-canvas-text.js");
  cached.set(requestKey(canvasTextRequest), new Response("/* stale text helper */", { status: 200 }));
  fetchHandler = async (request, init) => {
    fetchCalls.push({ request, init });
    return new Response("export const drawCanvasText = () => {};", { status: 200 });
  };
  const onlineCanvasText = await dispatchFetch(canvasTextRequest);
  assert.equal(await onlineCanvasText.text(), "export const drawCanvasText = () => {};");
  assert.equal(fetchCalls.length, 2, "a cached shell helper must still check the network");
  assert.equal(fetchCalls.at(-1).request.url, canvasTextRequest.url);
  assert.equal(fetchCalls.at(-1).init.cache, "no-store");
  assert.equal(await cached.get(requestKey(canvasTextRequest)).text(), "export const drawCanvasText = () => {};");

  cached.set(requestKey(canvasTextRequest), new Response("/* offline text helper */", { status: 200 }));
  fetchHandler = async () => { throw new Error("offline"); };
  const offlineCanvasText = await dispatchFetch(canvasTextRequest);
  assert.equal(await offlineCanvasText.text(), "/* offline text helper */");

  const spriteRequest = new Request(
    "https://example.test/Abyssal-Surge/assets/images/battle/dusk-warden-frame-00.png",
  );
  cached.set(requestKey(spriteRequest), new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const fetchesBeforeSprite = fetchCalls.length;
  const sprite = await dispatchFetch(spriteRequest);
  assert.deepEqual([...new Uint8Array(await sprite.arrayBuffer())], [1, 2, 3]);
  assert.equal(fetchCalls.length, fetchesBeforeSprite, "cached sprites must not require the network");
});

test("an unstamped (locally served) service worker refetches binaries instead of replaying a stale cache", async () => {
  // Deployed builds rotate CACHE_NAME per commit SHA, so cache-first binaries
  // are safe: a new release lands in a new cache and `activate` drops the old
  // one. Served straight from the repo the SHA is never stamped, the cache
  // name is frozen, and cache-first meant a rebuilt asset could never reach
  // the page -- rebuilding all 24 character GLBs changed nothing on screen
  // because the worker kept replaying the copies it had cached earlier.
  const listeners = new Map();
  const cached = new Map();
  const fetched = [];
  const requestKey = (request) => typeof request === "string"
    ? new URL(request, "https://example.test/Abyssal-Surge/").href
    : request.url;
  const cache = {
    addAll: async () => {},
    put: async (request, response) => { cached.set(requestKey(request), response); },
  };
  const self = {
    location: { origin: "https://example.test", href: "https://example.test/Abyssal-Surge/sw.js" },
    registration: { scope: "https://example.test/Abyssal-Surge/" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, listener) => listeners.set(type, listener),
  };

  // NOTE: no replaceAll here -- this is the raw, unstamped worker.
  runInNewContext(await project("sw.js"), {
    URL,
    Promise,
    Request,
    Response,
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: async (request) => cached.get(requestKey(request)) ?? null,
    },
    fetch: async (request, init) => {
      fetched.push({ url: requestKey(request), init });
      return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
    },
    self,
  });

  const dispatchFetch = async (request) => {
    let responsePromise;
    listeners.get("fetch")({
      request,
      respondWith(promise) { responsePromise = Promise.resolve(promise); },
    });
    assert.ok(responsePromise, `service worker must respond to ${request.url}`);
    return responsePromise;
  };

  const glbRequest = new Request(
    "https://example.test/Abyssal-Surge/assets/images/battle/glb/enemies/guard.glb",
  );
  cached.set(requestKey(glbRequest), new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

  const served = await dispatchFetch(glbRequest);
  assert.deepEqual(
    [...new Uint8Array(await served.arrayBuffer())],
    [9, 9, 9],
    "an unstamped worker must serve the freshly fetched binary, not the stale cached one",
  );
  assert.equal(fetched.length, 1, "the binary must actually hit the network");
  assert.equal(fetched[0].init.cache, "no-store");

  // Offline still falls back to whatever is cached, so local offline work is
  // not broken by the refetch.
  cached.set(requestKey(glbRequest), new Response(new Uint8Array([4, 5, 6]), { status: 200 }));
  const offlineListeners = listeners;
  runInNewContext(await project("sw.js"), {
    URL,
    Promise,
    Request,
    Response,
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: async (request) => cached.get(requestKey(request)) ?? null,
    },
    fetch: async () => { throw new Error("offline"); },
    self: { ...self, addEventListener: (type, listener) => offlineListeners.set(type, listener) },
  });
  const offline = await dispatchFetch(glbRequest);
  assert.deepEqual(
    [...new Uint8Array(await offline.arrayBuffer())],
    [4, 5, 6],
    "offline must still fall back to the cached binary",
  );
});
