import assert from "node:assert/strict";
import test from "node:test";

import { BattleVisualizer } from "../battle-visualizer.js";
import { AUDIO_CUES, COMMANDER, MEASUREMENT_PROFILES, SKILLS } from "../defense-catalog.js";
import { DefenseAudio } from "../defense-audio.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  queueInput,
} from "../defense-run-simulation.js";
import { DefenseTelemetry, TELEMETRY_SCHEMA_VERSION } from "../defense-telemetry.js";

function mockCanvas() {
  const gradient = { addColorStop() {} };
  const context = {
    beginPath() {},
    arc() {},
    clearRect() {},
    fill() {},
    fillRect() {},
    stroke() {},
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    set fillStyle(_value) {},
    set strokeStyle(_value) {},
    set lineWidth(_value) {},
  };
  return { width: 640, height: 360, getContext: () => context };
}

class FakeAudioParam {
  constructor() {
    this.value = 0;
  }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeAudioNode {
  constructor(kind) {
    this.kind = kind;
    this.disconnectCount = 0;
  }
  connect(destination) {
    return destination;
  }
  disconnect() {
    this.disconnectCount += 1;
  }
}

class FakeGainNode extends FakeAudioNode {
  constructor() {
    super("gain");
    this.gain = new FakeAudioParam();
  }
}

class FakeOscillatorNode extends FakeAudioNode {
  constructor() {
    super("oscillator");
    this.frequency = new FakeAudioParam();
    this.stopCount = 0;
    this.startCount = 0;
  }
  addEventListener() {}
  start() { this.startCount += 1; }
  stop() { this.stopCount += 1; }
}

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.currentTime = 10;
    this.state = "running";
    this.destination = new FakeAudioNode("destination");
    this.created = [];
    this.closeCount = 0;
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const node = new FakeGainNode();
    this.created.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeOscillatorNode();
    this.created.push(node);
    return node;
  }
  resume() { return Promise.resolve(); }
  close() {
    this.closeCount += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

function replaceGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
}

function snapshotWithCriticalHit() {
  for (let seed = 1; seed <= 16; seed += 1) {
    let run = createDefenseRun({ stageId: "cinder-span", seed });
    for (let tick = 0; tick < 600; tick += 1) {
      run = advanceDefenseRun(run, 1);
      const snapshot = getRunSnapshot(run);
      if (snapshot.events.some(({ type }) => type === "CRITICAL_HIT")) return snapshot;
    }
  }
  return null;
}

test("telemetry exports the versioned offline schema and preserves objective, policy, spawn, recovery, delta, and TTK fields", () => {
  const telemetry = new DefenseTelemetry({ maxRecords: 8, now: () => 42.125 });
  telemetry.startRun({ stageId: "cinder-span", seed: -1, rulesVersion: "contract-v3", reducedMotion: true });
  const source = {
    type: "OBJECTIVE_UPDATED",
    tick: 240,
    objectiveId: "hold-cinder-seal",
    occupationPointId: "cinder-seal",
    hazardId: "ash-surge",
    policyId: "resource-denial",
    spawnDirection: "SW",
    recovery: 4,
    bossTtkTicks: 360,
    currentValue: 2,
    upgradedValue: 3,
    privateImplementationDetail: "must not escape",
  };
  telemetry.recordSimulationEvents([source]);
  source.objectiveId = "mutated-after-recording";

  const exported = telemetry.exportObject();
  assert.equal(exported.format, "abyssal-defense-telemetry");
  assert.equal(exported.schemaVersion, TELEMETRY_SCHEMA_VERSION);
  assert.equal(exported.scope, "offline-local-debug");
  assert.deepEqual(exported.privacy, {
    playerIdentifiers: false,
    networkTransport: false,
    persistentStorage: false,
  });
  assert.deepEqual(exported.records[0].payload, {
    stageId: "cinder-span",
    seed: 0xffff_ffff,
    rulesVersion: "contract-v3",
    tickRate: 60,
    reducedMotion: true,
  });
  assert.deepEqual(exported.records[1].payload, {
    tick: 240,
    objectiveId: "hold-cinder-seal",
    occupationPointId: "cinder-seal",
    hazardId: "ash-surge",
    policyId: "resource-denial",
    spawnDirection: "SW",
    recovery: 4,
    bossTtkTicks: 360,
    currentValue: 2,
    upgradedValue: 3,
  });
  assert.equal(exported.records.every((record) => record.schemaVersion === TELEMETRY_SCHEMA_VERSION), true);
  assert.deepEqual(JSON.parse(telemetry.exportJson()), exported);
});

test("telemetry records policy and spawn data emitted by the live simulation", () => {
  const telemetry = new DefenseTelemetry({ maxRecords: 32, now: () => 5 });
  telemetry.startRun({ stageId: "cinder-span", seed: 17, rulesVersion: "contract-v3" });
  let run = createDefenseRun({ stageId: "cinder-span", seed: 17 });
  let waveRecord = null;

  for (let tick = 0; tick < 30 && !waveRecord; tick += 1) {
    run = advanceDefenseRun(run, 1);
    telemetry.recordSimulationEvents(getRunSnapshot(run).events);
    waveRecord = telemetry.exportObject().records.find((record) => record.type === "WAVE_VARIANT_STARTED");
  }

  assert.ok(waveRecord, "the seeded opening wave must emit a telemetry event");
  assert.equal(typeof waveRecord.payload.policyId, "string");
  assert.ok(waveRecord.payload.policyId.length > 0);
  assert.equal(typeof waveRecord.payload.spawnDirection, "string");
  assert.ok(waveRecord.payload.spawnDirection.length > 0);
});

test("telemetry retains complete active-skill payloads and distinct same-tick targets", () => {
  const telemetry = new DefenseTelemetry({ maxRecords: 16, now: () => 9 });
  telemetry.startRun({ stageId: "cinder-span", seed: 21, rulesVersion: "contract-v3" });
  const resolutions = [
    {
      type: "SKILL_RESOLVED_DAMAGE",
      tick: 180,
      sourceId: "commander",
      targetId: "enemy-4",
      skillId: "shadow-step",
      baseDamage: 900,
      finalDamage: 900,
      damage: 900,
      critical: false,
      chanceBp: 1500,
      multiplierBp: 17000,
      healthBefore: 1200,
      healthAfter: 300,
      simTick: 180,
      hit: true,
      privateImplementationDetail: "must not escape",
    },
    {
      type: "SKILL_RESOLVED_DAMAGE",
      tick: 180,
      sourceId: "commander",
      targetId: "enemy-7",
      skillId: "shadow-step",
      baseDamage: 900,
      finalDamage: 900,
      damage: 900,
      critical: false,
      chanceBp: 1500,
      multiplierBp: 17000,
      healthBefore: 1200,
      healthAfter: 300,
      simTick: 180,
      hit: true,
    },
  ];
  const cooldown = {
    type: "SKILL_COOLDOWN_SET",
    tick: 180,
    skillId: "shadow-step",
    baseCooldownTicks: 120,
    effectiveCooldownTicks: 120,
    setTick: 180,
    readyTick: 299,
    targetCount: 2,
    simTick: 180,
  };
  const expectedResolutionPayloads = resolutions.map(({ type: _type, privateImplementationDetail: _private, ...event }) => event);
  const expectedCooldownPayload = (({ type: _type, ...event }) => event)(cooldown);

  assert.equal(telemetry.recordSimulationEvents([...resolutions, cooldown]).length, 3);
  assert.equal(
    telemetry.recordSimulationEvents([...resolutions, cooldown].map((event) => ({ ...event }))).length,
    0,
    "replayed detached snapshot events must not duplicate telemetry",
  );

  const records = telemetry.exportObject().records;
  assert.deepEqual(
    records.filter((record) => record.type === "SKILL_RESOLVED_DAMAGE").map((record) => record.payload),
    expectedResolutionPayloads,
  );
  assert.deepEqual(
    records.find((record) => record.type === "SKILL_COOLDOWN_SET")?.payload,
    expectedCooldownPayload,
  );
});

test("telemetry preserves target and cooldown observations from a real measurement fixture cast", () => {
  const profile = MEASUREMENT_PROFILES.conductor;
  const telemetry = new DefenseTelemetry({ maxRecords: 64, now: () => 9 });
  telemetry.startRun({ stageId: "cinder-span", seed: 17, rulesVersion: "contract-v3" });
  const range = SKILLS[profile.activeSkillId].radius || COMMANDER.basicRange;
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 17,
    measurementProfileId: profile.id,
  });
  let castRun = null;
  let castSnapshot = null;

  for (let step = 0; step < 1200 && !castSnapshot; step += 1) {
    const snapshot = getRunSnapshot(run);
    const targetInRange = snapshot.enemies.some(
      (enemy) => (enemy.x - snapshot.commander.x) ** 2 + (enemy.y - snapshot.commander.y) ** 2 <= range ** 2,
    );
    if (!targetInRange) {
      run = advanceDefenseRun(run, 1);
      continue;
    }

    const candidate = advanceDefenseRun(queueInput(run, "SKILL_CAST", { skillId: profile.activeSkillId }), 1);
    const candidateSnapshot = getRunSnapshot(candidate);
    if (candidateSnapshot.events.some((event) => event.type === "SKILL_RESOLVED_DAMAGE")) {
      castRun = candidate;
      castSnapshot = candidateSnapshot;
    } else {
      run = candidate;
    }
  }

  assert.ok(castSnapshot, "the selected fixture must resolve its real active skill against a target");
  const resolution = castSnapshot.events.find((event) => event.type === "SKILL_RESOLVED_DAMAGE");
  const cooldownSet = castSnapshot.events.find((event) => event.type === "SKILL_COOLDOWN_SET");
  assert.ok(resolution?.targetId, "the real damage event must identify its resolved target");
  assert.ok(cooldownSet, "the real cast must publish its cooldown set event");
  telemetry.recordSimulationEvents(castSnapshot.events);

  const justBeforeReady = advanceDefenseRun(castRun, cooldownSet.effectiveCooldownTicks - 2);
  const readySnapshot = getRunSnapshot(advanceDefenseRun(justBeforeReady, 1));
  const ready = readySnapshot.events.find((event) => event.type === "SKILL_COOLDOWN_READY");
  assert.ok(ready, "the fixture cooldown must publish its ready event");
  telemetry.recordSimulationEvents(readySnapshot.events);

  const records = telemetry.exportObject().records;
  const resolvedRecord = records.find((record) => record.type === "SKILL_RESOLVED_DAMAGE");
  const setRecord = records.find((record) => record.type === "SKILL_COOLDOWN_SET");
  const readyRecord = records.find((record) => record.type === "SKILL_COOLDOWN_READY");
  assert.equal(resolvedRecord?.payload.targetId, resolution.targetId);
  assert.equal(resolvedRecord?.payload.healthBefore - resolvedRecord?.payload.healthAfter, resolution.finalDamage);
  assert.equal(setRecord?.payload.setTick, cooldownSet.setTick);
  assert.equal(setRecord?.payload.targetCount, cooldownSet.targetCount);
  assert.equal(readyRecord?.payload.readyTick, ready.readyTick);
  assert.equal(readyRecord?.payload.skillId, profile.activeSkillId);
});

test("telemetry retains only the configured newest records and reports the exact drop count", () => {
  const telemetry = new DefenseTelemetry({ maxRecords: 3, now: () => 7 });
  for (let value = 1; value <= 5; value += 1) telemetry.append("MARK", { value }, value);

  const exported = telemetry.exportObject();
  assert.deepEqual(exported.bounds, { maxRecords: 3, retainedRecords: 3, droppedRecords: 2 });
  assert.deepEqual(exported.records.map((record) => record.sequence), [3, 4, 5]);
  assert.deepEqual(exported.records.map((record) => record.payload.value), [3, 4, 5]);
});

test("audio degrades to a silent observer when Web Audio is unavailable", (t) => {
  replaceGlobal(t, "AudioContext", undefined);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const audio = new DefenseAudio({ reducedMotion: false });

  assert.equal(audio.start(), false);
  audio.consume([{ type: "GATE_BREACHED" }]);
  assert.equal(audio.play("impact-hit"), false);
  const silentMetrics = audio.debugMetrics();
  assert.equal(silentMetrics.nodes, 0);
  assert.equal(silentMetrics.transientNodes, 0);
  assert.equal(silentMetrics.voices, 0);
  assert.equal(silentMetrics.started, false);
});

test("audio observer maps a simulated critical hit to its catalog-authored cue", () => {
  const snapshot = snapshotWithCriticalHit();
  assert.ok(snapshot, "a fixed Cinder Span seed must expose a public CRITICAL_HIT event");
  const criticalHit = snapshot.events.find(({ type }) => type === "CRITICAL_HIT");
  const audio = new DefenseAudio({ reducedMotion: true });
  const played = [];
  audio.play = (cueId, event) => {
    played.push({ cueId, event });
    return true;
  };

  audio.consume(snapshot.events);

  assert.deepEqual(
    played.filter(({ event }) => event === criticalHit),
    [{ cueId: AUDIO_CUES.criticalHit.id, event: criticalHit }],
    "the observer must consume the public simulation event and select the catalog-owned critical cue",
  );
});

test("audio stop tears down every created Web Audio node and is idempotent", (t) => {
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const audio = new DefenseAudio({ reducedMotion: false });

  assert.equal(audio.start(), true);
  assert.equal(audio.play("impact-hit"), true);
  const context = FakeAudioContext.instances[0];
  assert.ok(context.created.some((node) => node.kind === "oscillator"));

  audio.stop();
  assert.equal(context.closeCount, 1);
  assert.equal(context.created.every((node) => node.disconnectCount >= 1), true);
  assert.equal(
    context.created.filter((node) => node.kind === "oscillator").every((node) => node.stopCount >= 1),
    true,
  );
  const stoppedMetrics = audio.debugMetrics();
  assert.equal(stoppedMetrics.nodes, 0);
  assert.equal(stoppedMetrics.transientNodes, 0);
  assert.equal(stoppedMetrics.voices, 0);
  assert.equal(stoppedMetrics.started, false);

  audio.stop();
  assert.equal(context.closeCount, 1);
});

test("rendering, telemetry, and audio observation leave the simulation digest unchanged", (t) => {
  replaceGlobal(t, "AudioContext", undefined);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const run = advanceDefenseRun(createDefenseRun({ stageId: "cinder-span", seed: 53 }), 30);
  const snapshot = getRunSnapshot(run);
  const digest = getRunDigest(run);
  const telemetry = new DefenseTelemetry({ maxRecords: 16, now: () => 1 });
  const audio = new DefenseAudio({ reducedMotion: true });
  const renderer = new BattleVisualizer();

  renderer.mount({ canvas: mockCanvas(), viewport: { width: 640, height: 360 } });
  renderer.renderSnapshot(snapshot, { index: 1 });
  telemetry.startRun({ stageId: snapshot.stageId, seed: 53, rulesVersion: "contract-v3" });
  telemetry.recordSnapshot(snapshot);
  telemetry.recordSimulationEvents(snapshot.events);
  audio.start();
  audio.consume(snapshot.events);

  assert.equal(getRunDigest(run), digest);
  assert.deepEqual(getRunSnapshot(run), snapshot);
  renderer.dispose();
  audio.stop();
  assert.equal(getRunDigest(run), digest);
});
