import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DefenseAudio } from "../defense-audio.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.ramps = [];
  }

  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; this.ramps.push(value); }
  exponentialRampToValueAtTime(value) { this.value = value; this.ramps.push(value); }
}

class FakeAudioNode {
  constructor(kind) {
    this.kind = kind;
  }

  connect(destination) { return destination; }
  disconnect() {}
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
    this.startCount = 0;
  }

  addEventListener() {}
  start() { this.startCount += 1; }
  stop() {}
}

class FakeBufferSourceNode extends FakeAudioNode {
  constructor() {
    super("buffer-source");
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new FakeAudioParam(1);
    this.startCount = 0;
    this.stopCount = 0;
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
    this.decoded = 0;
    FakeAudioContext.instances.push(this);
  }

  createGain() { return new FakeGainNode(); }
  createOscillator() { return new FakeOscillatorNode(); }
  createBufferSource() { return new FakeBufferSourceNode(); }

  decodeAudioData(arrayBuffer) {
    this.decoded += 1;
    return Promise.resolve({ duration: 1, byteLength: arrayBuffer?.byteLength ?? 0 });
  }

  resume() { this.state = "running"; return Promise.resolve(); }
  suspend() { this.state = "suspended"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}

function replaceGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
}

const SAMPLE_MAP = {
  cues: {
    "impact-hit": { url: "assets/audio/elevenlabs/sfx/impact-hit.mp3", gain: 0.85 },
    "terminal:TERMINAL:VICTORY": { url: "assets/audio/elevenlabs/sfx/terminal--victory.mp3", gain: 0.95 },
  },
  loops: {
    "ambience:cinder-span": { url: "assets/audio/elevenlabs/loops/ambience--cinder-span.mp3", gain: 0.5 },
    "music:cinder-span": { url: "assets/audio/elevenlabs/loops/music--cinder-span.mp3", gain: 0.45 },
    "music:abyss-chancel": { url: "assets/audio/elevenlabs/loops/music--abyss-chancel.mp3", gain: 0.45 },
  },
};

function installFetch(t, map = SAMPLE_MAP) {
  const requested = [];
  replaceGlobal(t, "fetch", (url) => {
    requested.push(String(url));
    if (String(url).endsWith("index.json")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(map) });
    }
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  });
  return requested;
}

function startSampleAudio(t, { reducedMotion = true } = {}) {
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const requested = installFetch(t);
  const audio = new DefenseAudio({ reducedMotion, sampleMapUrl: "assets/audio/elevenlabs/index.json" });
  assert.equal(audio.start(), true);
  return { audio, context: FakeAudioContext.instances[0], requested };
}

test("default construction never touches the network (procedural contract preserved)", (t) => {
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  let fetchCalls = 0;
  replaceGlobal(t, "fetch", () => { fetchCalls += 1; return Promise.reject(new Error("unexpected")); });

  const audio = new DefenseAudio({ reducedMotion: true });
  assert.equal(audio.start(), true);
  assert.equal(audio.play("impact-hit"), true);
  assert.equal(fetchCalls, 0);
  assert.equal(audio.debugMetrics().sampleMode, false);
  audio.stop();
});

test("sample map loads after start and play() prefers the decoded buffer", async (t) => {
  const { audio, requested } = startSampleAudio(t);
  assert.equal(await audio.loadSamples(), true);
  assert.ok(requested.some((url) => url.endsWith("index.json")));
  assert.equal(audio.debugMetrics().sampleCues, 2);

  assert.equal(audio.play("impact-hit"), true);
  const voice = [...audio.activeVoices][0];
  assert.equal(voice.nodes[0].kind, "buffer-source");
  assert.equal(voice.nodes[0].buffer.duration, 1);
  assert.equal(voice.nodes[1].gain.value, 0.85);
  audio.stop();
});

test("variant keys resolve dedicated samples and unmapped cues stay procedural", async (t) => {
  const { audio } = startSampleAudio(t);
  await audio.loadSamples();

  assert.equal(audio.play("terminal", { type: "TERMINAL", outcome: "VICTORY" }), true);
  const victory = [...audio.activeVoices].at(-1);
  assert.equal(victory.nodes[0].kind, "buffer-source");

  assert.equal(audio.play("item-collected"), true);
  const procedural = [...audio.activeVoices].at(-1);
  assert.equal(procedural.nodes[0].kind, "oscillator");
  audio.stop();
});

test("stage loops start buffered, remix on state change, and swap on stage change", async (t) => {
  const { audio } = startSampleAudio(t, { reducedMotion: false });
  await audio.loadSamples();

  assert.equal(audio.musicVoices.length, 1);
  assert.equal(audio.musicVoices[0].buffered, true);
  assert.equal(audio.musicVoices[0].stageId, "cinder-span");
  const firstSource = audio.musicVoices[0].source;
  assert.equal(firstSource.loop, true);

  // State-only change keeps the same buffer and re-mixes it.
  audio.setSoundscape("boss", "cinder-span");
  assert.equal(audio.musicVoices[0].source, firstSource);
  assert.equal(firstSource.playbackRate.value, 0.68);

  // Stage change swaps to the abyss-chancel music loop.
  audio.setSoundscape("boss", "abyss-chancel");
  assert.equal(audio.musicVoices.length, 1);
  assert.notEqual(audio.musicVoices[0].source, firstSource);
  assert.equal(audio.musicVoices[0].stageId, "abyss-chancel");
  assert.equal(firstSource.stopCount, 1);

  // Ambience has no abyss-chancel loop in the map -> falls back to oscillators.
  assert.equal(audio.ambienceVoices.every((voice) => !voice.buffered || voice.stageId === "cinder-span"), true);
  audio.stop();
});

test("failed sample fetch keeps every cue on the procedural path", async (t) => {
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  replaceGlobal(t, "fetch", () => Promise.resolve({ ok: false }));

  const audio = new DefenseAudio({ reducedMotion: true, sampleMapUrl: "assets/audio/elevenlabs/index.json" });
  assert.equal(audio.start(), true);
  assert.equal(await audio.loadSamples(), false);
  assert.equal(audio.play("impact-hit"), true);
  assert.equal([...audio.activeVoices][0].nodes[0].kind, "oscillator");
  audio.stop();
});

test("shipped sample index maps only real files and covers the runtime cue contract", () => {
  const indexPath = resolve(ROOT, "assets/audio/elevenlabs/index.json");
  assert.ok(existsSync(indexPath), "assets/audio/elevenlabs/index.json missing — run scripts/generate-defense-audio.mjs");
  const index = JSON.parse(readFileSync(indexPath, "utf8"));

  for (const [key, spec] of [...Object.entries(index.cues), ...Object.entries(index.loops)]) {
    const file = resolve(ROOT, spec.url);
    assert.ok(existsSync(file), `${key} -> ${spec.url} does not exist`);
    assert.ok(spec.gain > 0 && spec.gain <= 1.2, `${key} gain out of range`);
  }

  for (const cueId of [
    "stage-start", "weapon-fire", "impact-hit", "critical-hit", "enemy-defeated",
    "item-collected", "growth-offer", "skill-cast", "extraction-ready", "elite-extracted",
    "occupation-captured", "boss-spawned", "terminal", "input-accepted", "input-rejected",
    "attack-windup", "block-contact", "attack-miss", "interrupt-alert", "warning-pulse",
    "objective-waypoint", "objective-complete", "boss-phase", "death-retry",
    "terminal:TERMINAL:VICTORY", "terminal:TERMINAL:DEFEAT", "terminal:TERMINAL:FINAL_COMPLETION",
    "terminal:REWARD_SELECTED", "growth-offer:SKILL_SELECTED",
    "impact-hit:PICKUP_DENIED", "impact-hit:STANCE_SWITCH_BLOCKED",
  ]) {
    assert.ok(index.cues[cueId], `index.cues missing ${cueId}`);
  }

  for (const stageId of ["cinder-span", "abyss-chancel", "echo-throne"]) {
    assert.ok(index.loops[`ambience:${stageId}`], `missing ambience loop for ${stageId}`);
    assert.ok(index.loops[`music:${stageId}`], `missing music loop for ${stageId}`);
  }
});
