import assert from "node:assert/strict";
import test from "node:test";

import { AUDIO_CUES } from "../defense-catalog.js";
import { AUDIO_EVENT_POLICY, DefenseAudio, audioCueForEvent } from "../defense-audio.js";

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

  connect(destination) { return destination; }
  disconnect() { this.disconnectCount += 1; }
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
    this.listeners = new Map();
    this.startCount = 0;
    this.stopCount = 0;
  }

  addEventListener(type, listener, options = {}) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ listener, once: options.once === true });
    this.listeners.set(type, listeners);
  }

  emit(type) {
    const listeners = [...(this.listeners.get(type) ?? [])];
    this.listeners.set(type, listeners.filter(({ once }) => !once));
    listeners.forEach(({ listener }) => listener());
  }

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
    this.resumeCount = 0;
    this.suspendCount = 0;
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

  resume() {
    this.resumeCount += 1;
    this.state = "running";
    return Promise.resolve();
  }

  suspend() {
    this.suspendCount += 1;
    this.state = "suspended";
    return Promise.resolve();
  }

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

function startAudio(t) {
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const audio = new DefenseAudio({ reducedMotion: true });
  assert.equal(audio.start(), true);
  return { audio, context: FakeAudioContext.instances[0] };
}

const event = (type, eventSequence, extra = {}) => ({
  type,
  tick: 20,
  eventSequence,
  eventId: `audio:${type}:${eventSequence}`,
  ...extra,
});

test("public event policy maps objective, boss, death, retry, and completion semantics", () => {
  const mappings = [
    [event("OBJECTIVE_PHASE_CHANGED", 1, { objectiveId: "occupation" }), "objective-waypoint", 60],
    [event("OBJECTIVE_COMPLETED", 2, { objectiveId: "boss-kill" }), "objective-complete", 64],
    [event("BOSS_SPAWNED", 3, { bossId: "ash-monarch" }), AUDIO_CUES.bossSpawned.id, 90],
    [event("BOSS_RALLY_WINDOW", 4, { bossId: "ash-monarch" }), "boss-phase", 88],
    [event("BOSS_ATTACK_TELEGRAPHED", 5, { bossId: "ash-monarch" }), "warning-pulse", 86],
    [event("COMPANION_DOWNED", 6, { companionId: "ember-cohort" }), "interrupt-alert", 78],
    [event("COMMANDER_DOWNED", 7), AUDIO_CUES.terminal.id, 98],
    [event("RETRY_STARTED", 8), "death-retry", 94],
    [event("TERMINAL", 9, { outcome: "DEFEAT" }), AUDIO_CUES.terminal.id, 100],
    [event("TERMINAL", 10, { outcome: "VICTORY" }), AUDIO_CUES.terminal.id, 100],
    [event("TERMINAL", 11, { outcome: "FINAL_COMPLETION" }), AUDIO_CUES.terminal.id, 100],
  ];

  for (const [source, expectedCueId, priority] of mappings) {
    const cue = audioCueForEvent(source);
    assert.deepEqual(
      { eventType: cue?.eventType, method: cue?.method, cueId: cue?.cueId },
      { eventType: source.type, method: "play", cueId: expectedCueId },
    );
    assert.equal(cue?.priority, priority);
    assert.equal(AUDIO_EVENT_POLICY[source.type].priority, priority);
  }

  assert.ok(
    AUDIO_EVENT_POLICY.TERMINAL.priority > AUDIO_EVENT_POLICY.BOSS_SPAWNED.priority
      && AUDIO_EVENT_POLICY.BOSS_SPAWNED.priority > AUDIO_EVENT_POLICY.OBJECTIVE_PHASE_CHANGED.priority,
    "terminal feedback must outrank boss arrival, which must outrank waypoint guidance",
  );
});

test("terminal defeat, victory, and final completion resolve distinct public cue profiles", () => {
  const audio = new DefenseAudio({ reducedMotion: true });
  const defeat = audio.lookup(AUDIO_CUES.terminal.id, event("TERMINAL", 1, { outcome: "DEFEAT" }));
  const victory = audio.lookup(AUDIO_CUES.terminal.id, event("TERMINAL", 2, { outcome: "VICTORY" }));
  const completion = audio.lookup(AUDIO_CUES.terminal.id, event("TERMINAL", 3, { outcome: "FINAL_COMPLETION" }));

  assert.notDeepEqual(defeat?.profile, victory?.profile);
  assert.notDeepEqual(victory?.profile, completion?.profile);
  assert.notDeepEqual(defeat?.profile, completion?.profile);
});

test("consume prioritizes critical events, preserves stable ties, and keeps silent events silent", () => {
  const audio = new DefenseAudio({ reducedMotion: true });
  const played = [];
  audio.play = (cueId, source) => {
    played.push({ cueId, type: source.type });
    return true;
  };
  const objective = event("OBJECTIVE_PHASE_CHANGED", 1, { objectiveId: "occupation" });
  const silent = event("MOVE", 2, { direction: "E" });
  const boss = event("BOSS_SPAWNED", 3, { bossId: "ash-monarch" });
  const terminalDefeat = event("TERMINAL", 4, { outcome: "DEFEAT" });
  const terminalCompletion = event("TERMINAL", 5, { outcome: "FINAL_COMPLETION" });

  audio.consume([objective, silent, boss, terminalDefeat, terminalCompletion, terminalDefeat]);

  assert.deepEqual(played, [
    { cueId: AUDIO_CUES.terminal.id, type: "TERMINAL" },
    { cueId: AUDIO_CUES.terminal.id, type: "TERMINAL" },
    { cueId: AUDIO_CUES.bossSpawned.id, type: "BOSS_SPAWNED" },
    { cueId: "objective-waypoint", type: "OBJECTIVE_PHASE_CHANGED" },
  ]);
  assert.deepEqual(audioCueForEvent(silent), {
    eventType: "MOVE",
    method: "silent",
    cueId: null,
    priority: 0,
    category: "movement",
    intentionalSilence: true,
  });
  assert.equal(audio.debugMetrics().feedbackEvents, 5, "silent and audible identities are remembered once");
});

test("critical terminal feedback preempts a capped lower-priority voice set", (t) => {
  const { audio, context } = startAudio(t);
  const maxVoices = audio.debugMetrics().maxVoices;
  const accepted = [];

  for (let index = 0; index < maxVoices; index += 1) {
    accepted.push(audio.play(AUDIO_CUES.stageStart.id, event("STAGE_STARTED", index + 1)));
  }
  assert.deepEqual(accepted, Array(maxVoices).fill(true));
  assert.equal(audio.debugMetrics().voices, maxVoices);
  assert.equal(
    audio.play(AUDIO_CUES.movementStep.id, event("MOVE", 100, { direction: "E" })),
    false,
    "an equal-or-lower-priority cue must be dropped at the cap",
  );

  const stoppedBeforeCritical = context.created
    .filter(({ kind }) => kind === "oscillator")
    .reduce((total, node) => total + node.stopCount, 0);
  assert.equal(
    audio.play(AUDIO_CUES.terminal.id, event("TERMINAL", 101, { outcome: "DEFEAT" })),
    true,
    "terminal feedback must preempt lower-priority chatter",
  );
  assert.equal(audio.debugMetrics().voices, maxVoices);
  const stoppedAfterCritical = context.created
    .filter(({ kind }) => kind === "oscillator")
    .reduce((total, node) => total + node.stopCount, 0);
  assert.ok(stoppedAfterCritical > stoppedBeforeCritical, "preemption must stop the displaced voice");

  audio.stop();
});

test("rapid repetition never exceeds the public active-voice cap", (t) => {
  const { audio } = startAudio(t);
  const maxVoices = audio.debugMetrics().maxVoices;
  const results = Array.from({ length: maxVoices + 8 }, (_, index) =>
    audio.play(AUDIO_CUES.stageStart.id, event("STAGE_STARTED", index + 1))
  );

  assert.equal(results.filter(Boolean).length, maxVoices);
  assert.equal(audio.debugMetrics().voices, maxVoices);
  audio.stop();
});

test("mute is allocation-free and unmute restores event feedback", (t) => {
  const { audio, context } = startAudio(t);
  audio.setMuted(true);
  const createdBefore = context.created.length;

  audio.consume([
    event("OBJECTIVE_PHASE_CHANGED", 1, { objectiveId: "occupation" }),
    event("BOSS_SPAWNED", 2, { bossId: "ash-monarch" }),
    event("TERMINAL", 3, { outcome: "VICTORY" }),
  ]);

  assert.equal(audio.debugMetrics().muted, true);
  assert.equal(audio.debugMetrics().voices, 0);
  assert.equal(context.created.length, createdBefore, "muted feedback must allocate no Web Audio nodes");
  assert.equal(audio.play(AUDIO_CUES.criticalHit.id, event("CRITICAL_HIT", 4)), false);

  audio.setMuted(false);
  assert.equal(audio.play(AUDIO_CUES.criticalHit.id, event("CRITICAL_HIT", 5)), true);
  audio.stop();
});

test("pause cleans transient feedback once and resume is idempotent", async (t) => {
  const { audio, context } = startAudio(t);
  assert.equal(audio.play(AUDIO_CUES.stageStart.id, event("STAGE_STARTED", 1)), true);
  assert.equal(audio.debugMetrics().voices, 1);

  await audio.pause();
  assert.equal(audio.debugMetrics().paused, true);
  assert.equal(audio.debugMetrics().voices, 0);
  assert.equal(context.suspendCount, 1);
  assert.equal(
    context.created.filter(({ kind }) => kind === "oscillator").every(({ stopCount }) => stopCount >= 1),
    true,
    "pause must stop every transient oscillator",
  );

  await audio.pause();
  assert.equal(context.suspendCount, 1, "repeated pause must not suspend or tear down twice");
  const resumesBefore = context.resumeCount;
  await audio.resume();
  await audio.resume();
  assert.equal(audio.debugMetrics().paused, false);
  assert.equal(context.resumeCount, resumesBefore + 1, "repeated resume must resume once");
  assert.equal(audio.play(AUDIO_CUES.stageStart.id, event("STAGE_STARTED", 2)), true);

  audio.stop();
  audio.stop();
  assert.equal(context.closeCount, 1, "stop remains idempotent after pause/resume");
});

test("consume emits each public event once without collapsing distinct event IDs", () => {
  const audio = new DefenseAudio({ reducedMotion: true });
  const played = [];
  audio.play = (cueId, source) => {
    played.push({ cueId, eventId: source.eventId });
    return true;
  };
  const first = event("BOSS_SPAWNED", 1, { bossId: "ash-monarch" });
  const second = event("BOSS_SPAWNED", 2, { bossId: "ash-monarch" });

  audio.consume([first, first, second]);
  audio.consume([first, second]);

  assert.deepEqual(played, [
    { cueId: AUDIO_CUES.bossSpawned.id, eventId: first.eventId },
    { cueId: AUDIO_CUES.bossSpawned.id, eventId: second.eventId },
  ]);
});

test("stop and restart forget prior event identities without letting stale voice callbacks touch the new graph", (t) => {
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const audio = new DefenseAudio({ reducedMotion: true });
  const bossArrival = event("BOSS_SPAWNED", 1, { bossId: "ash-monarch" });

  assert.equal(audio.start(), true);
  audio.consume([bossArrival]);
  const firstContext = FakeAudioContext.instances[0];
  const staleOscillators = firstContext.created.filter(({ kind }) => kind === "oscillator");
  assert.ok(staleOscillators.length > 0, "the first event must create a real transient voice");
  assert.equal(audio.debugMetrics().voices, 1);
  assert.equal(audio.debugMetrics().feedbackEvents, 1);

  audio.stop();
  assert.equal(audio.debugMetrics().nodes, 0, "stop must release every node before remount");
  assert.equal(audio.debugMetrics().voices, 0, "stop must release every active voice before remount");
  assert.equal(audio.debugMetrics().feedbackEvents, 0, "stop must forget prior event identities");

  assert.equal(audio.start(), true);
  const secondContext = FakeAudioContext.instances[1];
  audio.consume([bossArrival]);
  const liveOscillators = secondContext.created.filter(({ kind }) => kind === "oscillator");
  assert.ok(liveOscillators.length > 0, "the same public event must be eligible in the restarted graph");
  assert.equal(audio.debugMetrics().voices, 1, "restart must own one new active voice");
  assert.equal(audio.debugMetrics().feedbackEvents, 1, "restart must remember the event in its new lifecycle only");

  staleOscillators.forEach((oscillator) => oscillator.emit("ended"));
  assert.equal(audio.debugMetrics().voices, 1, "late callbacks from the stopped graph must not release the new voice");
  assert.equal(
    liveOscillators.every(({ disconnectCount }) => disconnectCount === 0),
    true,
    "late callbacks from the stopped graph must not disconnect nodes in the new graph",
  );

  audio.stop();
});
