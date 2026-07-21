import assert from "node:assert/strict";
import test from "node:test";

import { BattleVisualizer } from "../battle-visualizer.js";

// Harness mirrors tests/battle-visualizer.test.mjs's makeVisualizer(): stub
// out window.matchMedia (reducedMotion gate) and restore globalThis.window
// afterward so tests stay isolated from one another.
function makeVisualizer(t, { reducedMotion = false, canvas = {}, options = {}, presentation } = {}) {
  const priorWindow = globalThis.window;
  globalThis.window = {
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener() {},
    removeEventListener() {},
  };
  t.after(() => {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  });

  const visualizer = new BattleVisualizer(canvas, presentation, options);
  visualizer.renderStatic = () => {};
  visualizer.publishRuntimeState = () => {};
  visualizer.hasBridgeAtlas = () => false;
  return visualizer;
}

// Sets up a live boss (hp > 0, not defeated) with a declared bossPattern
// latched via applyCampaignState — the same path battle-realtime-three.js's
// twin uses (stage.bossPattern), matching production wiring instead of
// poking this.bossPattern directly.
function armBoss(visualizer, { stageId = "cinder-span", triggerRange = 4.5, cooldownSeconds = 1, damage = 1, type = "melee" } = {}) {
  visualizer.applyCampaignState({
    campaign: { stageId, stage: { bossHealth: 10, deployments: [] } },
    stage: { id: stageId, bossPattern: { type, triggerRange, cooldownSeconds, damage } },
    state: { bossHealth: 10, bossMaxHealth: 10, deployments: [] },
  });
  return visualizer.navigation.anchors.boss;
}

test("commander lingering inside triggerRange for a full cooldown window fires onEncounterEvent boss-strike", (t) => {
  const events = [];
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
    options: { onEncounterEvent: (event) => events.push(event) },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};

  const bossTile = armBoss(visualizer, { cooldownSeconds: 1 });

  // Start out of range so the very first in-range tick isn't racing the
  // renderer's cooldown-starts-at-zero default (that default is intentional
  // parity with battle-realtime-three.js, not something this test should
  // depend on): stepping out first relaxes the cooldown to cooldownSeconds*0.5,
  // giving the wind-up an actual window to observe below.
  visualizer.commanderPosition = { x: bossTile.x + 50, y: bossTile.y + 50 };
  visualizer.updateBossStrike(0.1);
  assert.equal(visualizer.bossStrikeCooldownRemaining, 0.5, "stepping out first must relax the cooldown to cooldownSeconds*0.5");

  visualizer.commanderPosition = { x: bossTile.x, y: bossTile.y };
  visualizer.updateBossStrike(0.2);
  assert.equal(events.length, 0, "boss-strike must not fire before the full wind-up elapses");
  assert.equal(visualizer.bossStrikeArmed, true, "standing inside triggerRange must arm the wind-up");

  visualizer.updateBossStrike(0.2);
  assert.equal(events.length, 0, "0.4s of a 0.5s remaining wind-up must still be short");

  visualizer.updateBossStrike(0.2);
  assert.equal(events.length, 1, "crossing the wind-up threshold must fire exactly one boss-strike");
  assert.deepEqual(events[0], { type: "boss-strike", stageId: "cinder-span" });
  assert.ok(visualizer.bossStrikeCooldownRemaining > 0, "firing must reset the cooldown, not leave it at/below zero");
});

test("commander outside triggerRange never fires boss-strike and relaxes the cooldown instead", (t) => {
  const events = [];
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
    options: { onEncounterEvent: (event) => events.push(event) },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};

  const bossTile = armBoss(visualizer, { triggerRange: 4.5, cooldownSeconds: 5 });
  // Far outside the 4.5-unit triggerRange.
  visualizer.commanderPosition = { x: bossTile.x + 50, y: bossTile.y + 50 };

  for (let i = 0; i < 20; i += 1) visualizer.updateBossStrike(1);

  assert.equal(events.length, 0, "standing outside triggerRange must never fire a boss-strike");
  assert.equal(visualizer.bossStrikeArmed, false, "out-of-range must not read as armed");
  assert.equal(
    visualizer.bossStrikeCooldownRemaining,
    2.5,
    "out-of-range ticks must relax the cooldown to cooldownSeconds*0.5, not let it keep draining toward 0",
  );
});

test("a defeated or dead boss never fires boss-strike even while the commander stands in range", (t) => {
  const events = [];
  const visualizer = makeVisualizer(t, {
    presentation: { stageNumber: 1 },
    options: { onEncounterEvent: (event) => events.push(event) },
  });
  visualizer.burst = () => {};
  visualizer.playSpatial = () => {};

  const bossTile = armBoss(visualizer, { cooldownSeconds: 1 });
  visualizer.commanderPosition = { x: bossTile.x, y: bossTile.y };

  // Defeat the boss via the same authoritative-state path applyCampaignState
  // uses (bossHealth <= 0 flips this.boss.defeated), not a direct field poke.
  visualizer.applyCampaignState({
    campaign: { stageId: "cinder-span", stage: { bossHealth: 0, deployments: [] } },
    stage: { id: "cinder-span", bossPattern: { type: "melee", triggerRange: 4.5, cooldownSeconds: 1, damage: 1 } },
    state: { bossHealth: 0, bossMaxHealth: 10, deployments: [] },
  });
  assert.equal(visualizer.boss.defeated, true, "zero boss health must flip defeated via the authoritative sync path");

  for (let i = 0; i < 5; i += 1) visualizer.updateBossStrike(1);

  assert.equal(events.length, 0, "a defeated boss must never fire boss-strike regardless of commander proximity");
  assert.equal(visualizer.bossStrikeArmed, false, "a defeated boss must never read as armed");
});

test("drawBossThreatRing only touches the canvas context while bossExposed is true", (t) => {
  const visualizer = makeVisualizer(t, { presentation: { stageNumber: 1 } });
  let ctxCalls = 0;
  visualizer.ctx = {
    save() { ctxCalls += 1; },
    restore() { ctxCalls += 1; },
    beginPath() { ctxCalls += 1; },
    moveTo() { ctxCalls += 1; },
    lineTo() { ctxCalls += 1; },
    stroke() { ctxCalls += 1; },
  };

  const bossTile = armBoss(visualizer, { triggerRange: 4.5, cooldownSeconds: 5 });
  visualizer.commanderPosition = { x: bossTile.x, y: bossTile.y };

  visualizer.bossExposed = false;
  visualizer.drawBossThreatRing();
  assert.equal(ctxCalls, 0, "the threat ring must not touch the canvas context while the boss is not exposed");

  visualizer.bossExposed = true;
  visualizer.drawBossThreatRing();
  assert.ok(ctxCalls > 0, "the threat ring must draw once the boss becomes exposed");
});
