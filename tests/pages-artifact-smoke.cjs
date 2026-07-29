#!/usr/bin/env node
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve, dirname, relative } = require("node:path");


const REQUIRED_FILES = [
  "index.html",
  "version.json",
  "app.js",
  "rpg-catalog.js",
  "stage-world-catalog.js",
  "defense-viewport.js",
  "defense-catalog.js",
  "defense-run-simulation.js",
  "campaign-state.js",
  "defense-storage.js",
  "defense-cutscene.js",
  "defense-telemetry.js",
  "defense-audio.js",
  "battle-canvas-text.js",
  "battle-realtime-three.js",
  "battle-visualizer.js",
  "lobby-cinematic.js",
  "styles.css",
  "react-game-ui.css",
  "sw.js",
  "manifest.json",
  "icon.svg",
  "privacy.html",
  "vendor/three.module.js",
  "vendor/three.core.js",
  "vendor/loaders/GLTFLoader.js",
  "vendor/utils/BufferGeometryUtils.js",
  "vendor/utils/SkeletonUtils.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
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
  "assets/motion/ingame/characters/lantern-reaver/model.glb",
  "assets/motion/ingame/unarmed-core.glb",
  "assets/motion/ingame/manifest.json",
  "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  "assets/motion/stage-vfx/manifest.json",
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
