#!/usr/bin/env node
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve, dirname, relative } = require("node:path");


const REQUIRED_FILES = [
  "index.html",
  "campaign.html",
  "version.json",
  "sprite-2-5d.html",
  "sprite-2-5d.css",
  "sprite-2-5d.js",
  "sealbound.html",
  "sealbound.css",
  "sealbound.js",
  "app.js",
  "rpg-catalog.js",
  "stage-world-catalog.js",
  "stage-story-catalog.js",
  "defense-viewport.js",
  "defense-catalog.js",
  "defense-run-simulation.js",
  "campaign-state.js",
  "defense-storage.js",
  "defense-cutscene.js",
  "defense-speech-bubble.js",
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
  "abyssal-oneline.html",
  "abbysal-oneline.html",
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
  "assets/images/battle/ui/stages/cinder-span.png",
  "assets/images/battle/ui/stages/abyss-chancel.png",
  "assets/images/battle/ui/stages/echo-throne-steps.png",
  "assets/images/sprite-2-5d/cinder-court-backdrop.png",
  "assets/images/sprite-2-5d/warden/manifest.json",
  "assets/images/sprite-2-5d/warden/sprite-sheet.png",
  "assets/images/sprite-2-5d/ember-cohort/manifest.json",
  "assets/images/sprite-2-5d/ember-cohort/sprite-sheet.png",
  // Cycle 10: the composed slab floors are what the runtime loads for gameplay ground.
  // The retained diorama and textured candidates stay listed as offline provenance.
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
  "assets/motion/ingame/characters/lantern-reaver/model.glb",
  "assets/motion/ingame/unarmed-core.glb",
  "assets/motion/ingame/manifest.json",
  "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  "assets/motion/stage-vfx/drop-beacon-pillar.glb",
  "assets/motion/stage-vfx/arrival-breach-gate.glb",
  "assets/motion/stage-vfx/deform-fracture-seam.glb",
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
  const oneline = readFileSync(resolve(root, "abyssal-oneline.html"), "utf8");
  const markup = oneline.replace(/<!--[\s\S]*?-->/g, "");
  const openingTags = [...markup.matchAll(/<([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)];

  assert.ok(
    openingTags.some(([tag, name]) => name.toLowerCase() === "html"
      && /\blang\s*=\s*(?:"ko(?:-[a-z]{2,4})?"|'ko(?:-[a-z]{2,4})?'|ko(?:-[a-z]{2,4})?(?=[\s/>]))/i.test(tag)),
    "abyssal-oneline.html must declare Korean content",
  );
  assert.ok(
    !openingTags.some(([, name]) => name.toLowerCase() === "script"),
    "abyssal-oneline.html must not include scripts",
  );
  assert.ok(
    !openingTags.some(([, name]) => name.toLowerCase() === "base"),
    "abyssal-oneline.html must not include a base element",
  );
  assert.ok(
    !openingTags.some(([tag]) => /\son[\w:-]*/i.test(tag.replace(/"[^"]*"|'[^']*'/g, ""))),
    "abyssal-oneline.html must not include inline event handlers",
  );
  // The campaign CTA points at campaign.html, not index.html. index.html became
  // the sprite arena when the Three.js campaign moved to its own entry, and
  // abyssal-oneline.html was repointed with it — this assertion was left behind
  // and failed the Pages artifact gate on the already-correct markup.
  const campaignCtas = openingTags.filter(([tag, name]) => name.toLowerCase() === "a"
    && /\bhref\s*=\s*(?:"campaign\.html"|'campaign\.html'|campaign\.html(?=[\s/>]))/i.test(tag));
  assert.equal(
    campaignCtas.length,
    1,
    "abyssal-oneline.html must have exactly one campaign CTA to campaign.html",
  );
  assert.match(
    markup,
    /<a\b[^>]*\bhref\s*=\s*(?:"campaign\.html"|'campaign\.html'|campaign\.html(?=[\s/>]))[^>]*>[\s\S]*?현재 전선 작전 로비 열기[\s\S]*?<\/a>/i,
    "abyssal-oneline.html must label the campaign CTA as opening the current-front lobby",
  );
  const lockedReels = [...markup.matchAll(
    /<li\b[^>]*\bcampaign-entry__reel--locked\b[^>]*>[\s\S]*?<\/li>/gi,
  )];
  assert.equal(lockedReels.length, 2, "abyssal-oneline.html must keep exactly two locked campaign reels");
  assert.ok(
    lockedReels.every(([reel]) => !/<img\b/i.test(reel)),
    "locked campaign reels must not expose stage thumbnails",
  );
  assert.match(
    oneline,
    /\.campaign-entry__reel--locked::before\s*\{[^}]*\bbackground\s*:/i,
    "locked campaign reels must have a spoiler-safe background treatment",
  );
  assert.doesNotMatch(
    oneline,
    /\.campaign-entry__reel--(?:abyss|throne)\b/i,
    "abyssal-oneline.html must not retain deprecated future-stage reel styles",
  );
  assert.match(oneline, /Cinder Span/i, "abyssal-oneline.html must name the first campaign stage");
  assert.doesNotMatch(oneline, /Abyss Chancel/i, "abyssal-oneline.html must not reveal the second stage");
  assert.doesNotMatch(oneline, /Echo Throne/i, "abyssal-oneline.html must not reveal the third stage");
  assert.doesNotMatch(
    oneline,
    /assets\/images\/battle\/ui\/stages\/abyss-chancel\.png/i,
    "abyssal-oneline.html must not load the second-stage thumbnail",
  );
  assert.doesNotMatch(
    oneline,
    /assets\/images\/battle\/ui\/stages\/echo-throne-steps\.png/i,
    "abyssal-oneline.html must not load the third-stage thumbnail",
  );

  const legacyOneline = readFileSync(resolve(root, "abbysal-oneline.html"), "utf8");
  assert.match(
    legacyOneline,
    /<meta\b[^>]*\bhttp-equiv\s*=\s*(?:"refresh"|'refresh'|refresh(?=[\s/>]))[^>]*\bcontent\s*=\s*(?:"0\s*;\s*url\s*=\s*abyssal-oneline\.html"|'0\s*;\s*url\s*=\s*abyssal-oneline\.html'|0\s*;\s*url\s*=\s*abyssal-oneline\.html(?=[\s/>]))[^>]*>/i,
    "abbysal-oneline.html must redirect to abyssal-oneline.html",
  );
  assert.doesNotMatch(legacyOneline, /<script\b/i, "abbysal-oneline.html must not include scripts");
  assert.doesNotMatch(
    legacyOneline,
    /<title\b[^>]*>[\s\S]*?abbysal-oneline/i,
    "abbysal-oneline.html must not expose the typo in its document title",
  );

  const allowedDependencies = new Set(REQUIRED_FILES);
  for (const [tag, name] of openingTags) {
    for (const [, attribute, doubleQuoted, singleQuoted, unquoted] of tag.matchAll(
      /\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    )) {
      const value = doubleQuoted ?? singleQuoted ?? unquoted;
      if (value.startsWith("#")) continue;
      const dependency = value.split(/[?#]/, 1)[0];
      assert.ok(
        allowedDependencies.has(dependency),
        `abyssal-oneline.html has unexpected ${attribute.toLowerCase()} dependency on <${name}>: ${value}`,
      );
    }
  }
  for (const module of REQUIRED_FILES.filter((file) => file.endsWith(".js"))) {
    verifyModuleClosure(root, resolve(root, module));
  }
}

main();
