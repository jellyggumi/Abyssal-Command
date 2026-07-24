#!/usr/bin/env node
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve, dirname, relative } = require("node:path");

const REQUIRED_FILES = [
  "index.html",
  "version.json",
  "app.js",
  "defense-viewport.js",
  "defense-catalog.js",
  "defense-run-simulation.js",
  "campaign-state.js",
  "defense-storage.js",
  "defense-cutscene.js",
  "defense-telemetry.js",
  "defense-audio.js",
  "battle-realtime-three.js",
  "battle-visualizer.js",
  "styles.css",
  "react-game-ui.css",
  "sw.js",
  "manifest.json",
  "assets/images/battle/dusk-warden-frame-00.png",
  "assets/images/battle/dusk-warden-frame-01.png",
  "assets/images/battle/dusk-warden-frame-02.png",
  "assets/images/battle/dusk-warden-frame-03.png",
  "assets/images/battle/echo-rusher-frame-00.png",
  "assets/images/battle/echo-rusher-frame-01.png",
  "assets/images/battle/echo-rusher-frame-02.png",
  "assets/images/battle/echo-rusher-frame-03.png",
  "assets/images/battle/world/cinder-span-topdown-plate.webp",
  "assets/images/battle/world/cinder-span-tactical-paper-plate.webp",
  "vendor/three.module.js",
  "vendor/three.core.js",
  "vendor/loaders/GLTFLoader.js",
  "vendor/utils/BufferGeometryUtils.js",
  "vendor/utils/SkeletonUtils.js",
  "assets/models/battle/terrain/cinder-span.glb",
  "assets/models/battle/terrain/veil-citadel.glb",
  "assets/models/battle/terrain/echo-throne-steps.glb",
  "assets/models/battle/terrain/echo-throne.glb",
  "assets/models/battle/terrain/sunken-bastion.glb",
  "assets/models/battle/terrain/howling-sprawl.glb",
  "assets/models/battle/terrain/glass-necropolis.glb",
  "assets/models/battle/terrain/starless-canal.glb",
  "assets/models/battle/terrain/shattered-causeway.glb",
  "assets/models/battle/terrain/abyss-chancel.glb",
  "assets/models/battle/terrain/gate-zenith.glb",
  "assets/models/battle/bosses/cinder-warden.glb",
  "assets/models/battle/bosses/veil-tactician.glb",
  "assets/models/battle/bosses/gate-sovereign.glb",
  "assets/models/battle/bosses/tide-warden.glb",
  "assets/models/battle/bosses/pack-herald.glb",
  "assets/models/battle/bosses/requiem-choir.glb",
  "assets/models/battle/bosses/lantern-tyrant.glb",
  "assets/models/battle/bosses/bridge-colossus.glb",
  "assets/models/battle/bosses/veiled-concordat.glb",
  "assets/models/battle/bosses/abyss-regent.glb",
  "assets/models/battle/enemies/scout.glb",
  "assets/models/battle/enemies/shade.glb",
  "assets/models/battle/enemies/guard.glb",
  "assets/models/battle/enemies/possessed.glb",
  "assets/models/battle/companions/ember-cohort.glb",
  "assets/models/battle/companions/rift-lens.glb",
  "assets/models/battle/companions/veil-vanguard.glb",
  "assets/models/battle/companions/anchor-shard.glb",
  "assets/models/battle/companions/throne-echo.glb",
  "assets/models/battle/companions/dawnless-crown.glb",
  "assets/models/battle/commander/dusk-warden.glb",
  "assets/models/battle/vfx/critical-hit-burst.glb",
  "assets/models/battle/vfx/boss-rally-aura.glb",
  "assets/models/battle/vfx/gate-breach-shockwave.glb",
  "assets/models/battle/vfx/wardens-ward-shield.glb",
  "assets/models/battle/vfx/echo-warden-awakening.glb",
  "assets/models/battle/vfx/companion-downed-fade.glb",
  "assets/models/battle/items/abyssal-banner.glb",
  "assets/models/battle/items/bulwark-brand.glb",
  "assets/models/battle/items/equipment-tier-gems.glb",
  "assets/models/battle/items/stillwater-hourglass.glb",
];

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function localModuleSpecifiers(source) {
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1].split(/[?#]/, 1)[0]);
}

function assertWithin(root, path) {
  assert.ok(relative(root, path) && !relative(root, path).startsWith(".."), `module import escapes artifact: ${path}`);
}

function verifyModuleClosure(root, modulePath, visited = new Set()) {
  if (visited.has(modulePath)) return;
  visited.add(modulePath);
  const source = readFileSync(modulePath, "utf8");
  for (const specifier of localModuleSpecifiers(source)) {
    const imported = resolve(dirname(modulePath), specifier);
    assertWithin(root, imported);
    assert.ok(existsSync(imported), `missing local module import ${specifier} from ${relative(root, modulePath)}`);
    verifyModuleClosure(root, imported, visited);
  }
}

function main() {
  const directory = argument("--dir");
  if (!directory) throw new Error("Usage: pages-artifact-smoke.cjs --dir <Pages artifact directory>");
  const root = resolve(directory);
  for (const file of REQUIRED_FILES) assert.ok(existsSync(resolve(root, file)), `missing Pages artifact file: ${file}`);
  for (const module of REQUIRED_FILES.filter((file) => file.endsWith(".js"))) {
    verifyModuleClosure(root, resolve(root, module));
  }
}

main();
