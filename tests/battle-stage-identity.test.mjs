import assert from "node:assert/strict";
import test from "node:test";

import { BattleVisualizer } from "../battle-visualizer.js";
import { RealtimeBattle } from "../battle-realtime-three.js";
import * as THREE from "../vendor/three.module.min.js";
import { getStageMotif } from "../battle-stage-identity.js";
import { STAGE_GRID_HEIGHT, STAGE_GRID_WIDTH } from "../stage-navigation.js";

const CUSTOM_STAGES = [4, 5, 6, 7, 8, 9, 10];
const COLOR_HEX = /^#[0-9a-f]{6}$/i;

function withCanvasVisualizer(stageNumber, callback) {
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try {
    const visualizer = new BattleVisualizer(null, { stageNumber });
    return callback(visualizer);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

function makeWebGLStageDouble(stageNumber) {
  const canvas = { removeEventListener() {} };
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.document = { removeEventListener() {} };
  globalThis.window = { removeEventListener() {} };
  globalThis.cancelAnimationFrame = () => {};

  const battle = new RealtimeBattle(canvas, {
    stageNumber,
    palette: {
      accent: "#f0a040",
      ally: "#70e5d0",
      hostile: "#ff7f79",
      background: "#101827",
    },
  });
  battle.scene = new THREE.Scene();
  battle.cloneTemplate = () => ({ root: new THREE.Group() });
  battle.registerStaticBlocker = () => {};
  battle.updateNodeVisuals = () => {};
  battle.syncBossExposure = () => {};
  battle.play = () => {};
  battle.applyBossIdentityTint = () => {};
  battle.applyCommanderIdentityTint = () => {};
  battle.clearHover = () => {};
  battle.clearActionPreview = () => {};
  battle.clearEncounterWave = () => {};
  battle.retire = () => {};
  battle.emitSelectionChange = () => {};

  return {
    battle,
    restore() {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
      if (previousCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
      else globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
    },
  };
}

test("getStageMotif leaves stages 1-3 uncustomized and gives stages 4-10 distinct complete motifs", () => {
  for (const stageNumber of [1, 2, 3]) {
    assert.equal(getStageMotif(stageNumber), null, `stage ${stageNumber} must not have a custom motif`);
  }

  const motifs = CUSTOM_STAGES.map((stageNumber) => {
    const motif = getStageMotif(stageNumber);
    assert.ok(motif, `stage ${stageNumber} must have a motif`);
    assert.match(motif.primary, COLOR_HEX, `stage ${stageNumber} primary color must be a hex color`);
    assert.match(motif.secondary, COLOR_HEX, `stage ${stageNumber} secondary color must be a hex color`);
    assert.notEqual(motif.primary.toLowerCase(), motif.secondary.toLowerCase(), `stage ${stageNumber} colors must contrast`);
    assert.equal(typeof motif.bossMotif, "string");
    assert.ok(motif.bossMotif.length > 0, `stage ${stageNumber} must identify a boss motif`);
    assert.ok(Array.isArray(motif.landmarks) && motif.landmarks.length > 0, `stage ${stageNumber} must define landmarks`);
    for (const landmark of motif.landmarks) {
      assert.ok(Number.isInteger(landmark.x) && landmark.x >= 0 && landmark.x < STAGE_GRID_WIDTH);
      assert.ok(Number.isInteger(landmark.y) && landmark.y >= 0 && landmark.y < STAGE_GRID_HEIGHT);
    }
    return motif;
  });

  assert.equal(new Set(motifs.map((motif) => motif.id)).size, CUSTOM_STAGES.length, "custom stages must not share motif ids");
  assert.equal(new Set(motifs.map((motif) => motif.bossMotif)).size, CUSTOM_STAGES.length, "custom stages must not share boss motifs");
});

test("getStageMotif rejects fractional and non-finite stage numbers", () => {
  for (const stageNumber of [4.5, "4.5", NaN, Infinity, -Infinity]) {
    assert.equal(getStageMotif(stageNumber), null, `stage ${String(stageNumber)} must not resolve a motif`);
  }
});


test("Canvas2D dynamic records enqueue every configured landmark at its tile-center coordinates", () => {
  for (const stageNumber of CUSTOM_STAGES) {
    const motif = getStageMotif(stageNumber);
    const { records, elevation } = withCanvasVisualizer(stageNumber, (visualizer) => ({
      records: visualizer.buildDynamicDrawRecords(),
      elevation: motif.landmarks.map((landmark) => visualizer.elevationAt(landmark.x + 0.5, landmark.y + 0.5)),
    }));
    const landmarks = records.filter((record) => record.render === "landmark");

    assert.equal(landmarks.length, motif.landmarks.length, `stage ${stageNumber} landmark count must match its motif`);
    assert.deepEqual(
      landmarks.map(({ id, x, y, z, landmarkIndex }) => ({ id, x, y, z, landmarkIndex })),
      motif.landmarks.map((landmark, index) => ({
        id: `landmark-${index}`,
        x: landmark.x + 0.5,
        y: landmark.y + 0.5,
        z: elevation[index],
        landmarkIndex: index,
      })),
      `stage ${stageNumber} Canvas records must preserve configured landmark coordinates`,
    );
  }
});

test("Canvas2D boss motif anchors match the fallback silhouette apex for each boss clip", () => {
  for (const [bossClip, apexOffset] of [["Idle", 52], ["Attack", 60], ["Defeat", 36]]) {
    const anchor = withCanvasVisualizer(7, (visualizer) => {
      const arcs = [];
      visualizer.ctx = {
        beginPath() {},
        closePath() {},
        ellipse() {},
        fill() {},
        lineTo() {},
        moveTo() {},
        restore() {},
        save() {},
        stroke() {},
        arc(...args) { arcs.push(args); },
      };
      visualizer.bossExposed = true;
      visualizer.bossClip = bossClip;
      visualizer.view.scale = 2;
      visualizer.project = () => ({ x: 120, y: 400 });
      visualizer.drawBridgeAtlas = () => false;
      visualizer.drawBoss();
      assert.equal(arcs.length, 1, "stage 7 lantern motif must draw one boss anchor");
      return arcs[0].slice(0, 2);
    });
    assert.deepEqual(anchor, [120, 400 - apexOffset * 2], `${bossClip} motif anchor must match fallback apex`);
  }
});

test("WebGL creates and destroys the stage identity group with a minimal renderer double", () => {
  const { battle, restore } = makeWebGLStageDouble(7);
  try {
    battle.createBattleObjects();

    assert.ok(battle.stageIdentityGroup, "custom stage creation must expose a stage identity group");
    assert.equal(battle.stageIdentityGroup.name, "stageIdentityGroup");
    assert.equal(
      battle.stageIdentityGroup.children.length,
      getStageMotif(7).landmarks.length,
      "WebGL identity group must contain one landmark group per configured landmark",
    );
    assert.ok(battle.scene.children.includes(battle.stageIdentityGroup));
    const identityResources = new Set();
    const disposedResources = new Set();
    battle.stageIdentityGroup.traverse((node) => {
      if (!node.isMesh) return;
      for (const resource of [node.geometry, node.material]) {
        if (!resource) continue;
        identityResources.add(resource);
        resource.addEventListener?.("dispose", () => disposedResources.add(resource));
      }
    });

    assert.ok(identityResources.size > 0, "stage identity landmarks must own render resources");


    battle.destroy();

    assert.equal(battle.stageIdentityGroup, null, "destroy must clear the stage identity group reference");
    assert.ok(!battle.scene.children.some((child) => child.name === "stageIdentityGroup"));
    assert.equal(
      disposedResources.size,
      identityResources.size,
      "destroy must dispose every stage identity geometry and material",
    );
    for (const resource of identityResources) {
      assert.ok(disposedResources.has(resource), "destroy must release each stage identity resource");
    }
  } finally {
    restore();
  }
});
