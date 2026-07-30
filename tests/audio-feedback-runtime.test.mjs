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

class FakeSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.onend = null;
    this.onerror = null;
  }
}

function installSpeechSynthesis(t) {
  const speech = {
    cancelCount: 0,
    current: null,
    finishedCount: 0,
    pending: false,
    speaking: false,
    utterances: [],
    cancel() {
      this.cancelCount += 1;
      this.current = null;
      this.finishedCount = this.utterances.length;
      this.pending = false;
      this.speaking = false;
    },
    finish() {
      const utterance = this.current;
      if (!utterance) return;
      this.finishedCount += 1;
      this.current = this.utterances[this.finishedCount] ?? null;
      this.speaking = Boolean(this.current);
      this.pending = this.utterances.length - this.finishedCount > 1;
      utterance.onend?.();
    },
    getVoices() {
      return [];
    },
    speak(utterance) {
      this.utterances.push(utterance);
      if (!this.speaking && !this.current) {
        this.current = utterance;
        this.speaking = true;
        this.pending = false;
      } else {
        this.pending = true;
      }
    },
  };
  replaceGlobal(t, "speechSynthesis", speech);
  replaceGlobal(t, "SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);
  return speech;
}

const event = (type, eventSequence, extra = {}) => ({
  type,
  tick: 20,
  eventSequence,
  eventId: `audio:${type}:${eventSequence}`,
  ...extra,
});

test("authored story milestones speak one Korean line and retain their established cue", (t) => {
  const speech = installSpeechSynthesis(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  const cases = [
    {
      name: "stage start",
      source: event("STAGE_STARTED", 1, {
        stageId: "cinder-span",
        storyBeat: {
          voiceLine: {
            text: "[숨죽여] 감시자: 재의 봉쇄선을 넘어라. 다음 명령은 기다려라.",
            direction: "낮고 은밀하게",
            speaker: "감시자",
          },
        },
      }),
      cueId: AUDIO_CUES.stageStart.id,
      spoken: "재의 봉쇄선을 넘어라.",
    },
    {
      name: "occupation captured",
      source: event("OCCUPATION_CAPTURED", 2, {
        storyBeat: { dialogue: { text: "봉인이 뒤집혔다. 점령지를 사수하라." } },
      }),
      cueId: AUDIO_CUES.occupationCaptured.id,
      spoken: "봉인이 뒤집혔다.",
    },
    {
      name: "boss spawned",
      source: event("BOSS_SPAWNED", 3, {
        bossId: "ash-monarch",
        voiceLine: "재의 군주가 강림한다.\n대형을 유지하라.",
      }),
      cueId: AUDIO_CUES.bossSpawned.id,
      spoken: "재의 군주가 강림한다.",
    },
    {
      name: "boss objective completed",
      source: event("OBJECTIVE_COMPLETED", 4, {
        objectiveId: "boss-kill",
        storyBeat: { voiceLine: "재의 군주가 쓰러졌다.\n결속 지점으로 이동하라." },
      }),
      cueId: "objective-complete",
      spoken: "재의 군주가 쓰러졌다.",
    },
    {
      name: "extraction completed",
      source: event("EXTRACTION_COMPLETED", 5, {
        storyDialogue: "결속이 완성됐다.\n퇴로를 확보하라.",
      }),
      cueId: AUDIO_CUES.eliteExtracted.id,
      spoken: "결속이 완성됐다.",
    },
    {
      name: "terminal",
      source: event("TERMINAL", 6, {
        outcome: "VICTORY",
        cutscene: ["귀환로가 열렸다.", "모든 생존자가 돌아온다."],
      }),
      cueId: AUDIO_CUES.terminal.id,
      spoken: "귀환로가 열렸다.",
    },
  ];

  for (const { name, source, cueId, spoken } of cases) {
    const cue = audioCueForEvent(source);
    assert.deepEqual(
      { method: cue?.method, cueId: cue?.cueId, priority: cue?.priority },
      { method: "narrate", cueId, priority: 76 },
      `${name} must add narration without replacing its established cue`,
    );
    const spokenBefore = speech.utterances.length;
    audio.consume([source]);
    assert.equal(speech.utterances.length, spokenBefore + 1, `${name} must start one utterance`);
    assert.equal(
      speech.utterances.at(-1).text,
      spoken,
      `${name} must speak only the first Korean story line, not direction or metadata`,
    );
    speech.finish();
  }
});

test("story narration outranks lore when both arrive in one event batch", (t) => {
  const speech = installSpeechSynthesis(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  const lore = event("LORE_SURPRISE_RESOLVED", 1, {
    outcomeId: "ash-echo-whisper",
    text: "옛 교량의 재가 바람에 흩어진다.",
  });
  const story = event("STAGE_STARTED", 2, {
    stageId: "cinder-span",
    voiceLine: "봉쇄선이 열렸다.",
  });

  assert.ok(
    audioCueForEvent(story).priority > audioCueForEvent(lore).priority,
    "authored story must retain priority over ambient lore",
  );
  audio.consume([lore, story]);

  assert.deepEqual(
    speech.utterances.map(({ text }) => text),
    ["봉쇄선이 열렸다."],
    "lower-priority lore must not displace or queue behind active story narration",
  );
});

test("same-batch authored stories use the native queue once in arrival order", (t) => {
  const speech = installSpeechSynthesis(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  const firstStory = event("STAGE_STARTED", 10, {
    tick: 0,
    stageId: "cinder-span",
    voiceLine: "첫 번째 봉쇄 명령이다.",
  });
  const secondStory = event("OBJECTIVE_COMPLETED", 11, {
    tick: 0,
    objectiveId: "boss-kill",
    storyBeat: { voiceLine: "두 번째 귀환 명령이다." },
  });

  audio.consume([firstStory, secondStory]);

  assert.deepEqual(
    speech.utterances.map(({ text }) => text),
    ["첫 번째 봉쇄 명령이다.", "두 번째 귀환 명령이다."],
    "both authored stories must enter the native speech queue once in arrival order",
  );
  assert.equal(speech.current?.text, "첫 번째 봉쇄 명령이다.", "the first story must speak immediately");
  assert.equal(speech.pending, true, "the second story must remain pending behind the first");
  assert.equal(audio.debugMetrics().narrations, 2, "both native-queued utterances must be tracked");
  assert.equal(audio.debugMetrics().narrationQueue, 1, "the second authored story must be queued");

  speech.finish();

  assert.equal(
    speech.current?.text,
    "두 번째 귀환 명령이다.",
    "ending the first utterance must automatically promote the second native-queued story",
  );
  assert.equal(audio.debugMetrics().narrations, 1, "only the promoted second utterance remains tracked");
  assert.equal(audio.debugMetrics().narrationQueue, 0, "the native queue must be drained");

  speech.finish();
  audio.consume([firstStory, secondStory]);

  assert.deepEqual(
    speech.utterances.map(({ text }) => text),
    ["첫 번째 봉쇄 명령이다.", "두 번째 귀환 명령이다."],
    "immediately replaying the same tick-zero authored events must not duplicate narration",
  );
});

test("authored story narration joins an already-pending native speech queue once", (t) => {
  const speech = installSpeechSynthesis(t);
  speech.speaking = true;
  speech.pending = true;
  const audio = new DefenseAudio({ reducedMotion: true });
  const story = event("STAGE_STARTED", 12, {
    stageId: "cinder-span",
    voiceLine: "외부 음성 뒤에도 이 명령을 보존하라.",
  });

  audio.consume([story]);
  audio.consume([story]);

  assert.deepEqual(
    speech.utterances.map(({ text }) => text),
    ["외부 음성 뒤에도 이 명령을 보존하라."],
    "external pending speech must not drop or duplicate authored story narration",
  );
  assert.equal(audio.debugMetrics().narrations, 1, "the accepted authored utterance must be tracked");
  audio.stop();
});

test("critical feedback preempts active story narration", (t) => {
  const speech = installSpeechSynthesis(t);
  const { audio } = startAudio(t);
  audio.consume([
    event("STAGE_STARTED", 1, {
      stageId: "cinder-span",
      voiceLine: "봉쇄선을 사수하라.",
    }),
  ]);

  assert.equal(audio.debugMetrics().narrations, 1);
  assert.equal(
    audio.play(AUDIO_CUES.criticalHit.id, event("CRITICAL_HIT", 2)),
    true,
    "critical feedback must remain audible during narration",
  );
  assert.equal(speech.cancelCount, 1, "critical feedback must cancel the displaced narration");
  assert.equal(audio.debugMetrics().narrations, 0);
  assert.equal(audio.debugMetrics().voices, 2, "the story cue and critical cue both remain bounded voices");
  audio.stop();
});

test("a completed story utterance is not replayed for the same event key", (t) => {
  const speech = installSpeechSynthesis(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  const stageStarted = event("STAGE_STARTED", 1, {
    stageId: "cinder-span",
    voiceLine: "봉쇄선을 사수하라.",
  });

  audio.consume([stageStarted]);
  speech.finish();
  audio.consume([{ ...stageStarted, voiceLine: "중복 재생되면 안 된다." }]);

  assert.deepEqual(
    speech.utterances.map(({ text }) => text),
    ["봉쇄선을 사수하라."],
    "deduplication must hold after the first utterance has ended",
  );
});

test("mute, pause, background suspension, and stop dispose active and queued narration", (t) => {
  const speech = installSpeechSynthesis(t);
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const cases = [
    ["mute", (audio) => audio.setMuted(true), (audio) => audio.setMuted(false)],
    ["pause", (audio) => audio.pause(), (audio) => audio.resume()],
    ["background", (audio) => audio.suspendForBackground(), (audio) => audio.resumeFromBackground()],
    ["stop/dispose", (audio) => audio.stop(), (audio) => audio.start()],
  ];

  for (const [index, [name, cancel, restore]] of cases.entries()) {
    const audio = new DefenseAudio({ reducedMotion: true });
    assert.equal(audio.start(), true);
    const utterancesBefore = speech.utterances.length;
    audio.consume([
      event("STAGE_STARTED", index * 2 + 20, {
        stageId: "cinder-span",
        voiceLine: `${name} 전 첫 번째 명령.`,
      }),
      event("OBJECTIVE_COMPLETED", index * 2 + 21, {
        objectiveId: "boss-kill",
        storyBeat: { voiceLine: `${name} 뒤 재생되면 안 되는 대기 명령.` },
      }),
    ]);
    assert.equal(
      speech.utterances.length,
      utterancesBefore + 2,
      `${name} setup must submit the active and native-queued narrations`,
    );
    assert.equal(audio.debugMetrics().narrations, 2, `${name} setup must track both narrations`);
    assert.equal(audio.debugMetrics().narrationQueue, 1, `${name} setup must queue the second narration`);
    const activeUtterances = speech.utterances.slice(-2);
    const cancellationsBefore = speech.cancelCount;

    cancel(audio);

    assert.equal(speech.cancelCount, cancellationsBefore + 1, `${name} must cancel speech synthesis`);
    assert.equal(audio.debugMetrics().narrations, 0, `${name} must release narration ownership`);
    assert.equal(audio.debugMetrics().narrationQueue, 0, `${name} must clear queued narration`);
    assert.equal(speech.speaking, false, `${name} must leave no speech playing`);

    restore(audio);
    const restored = audio.debugMetrics();
    assert.deepEqual(
      [restored.started, restored.muted, restored.paused, restored.backgrounded],
      [true, false, false, false],
      `${name} setup must become eligible for audio again`,
    );
    for (const utterance of activeUtterances) {
      utterance.onend?.();
      utterance.onerror?.();
    }

    assert.equal(
      speech.utterances.length,
      utterancesBefore + 2,
      `${name} must clear tracked narration so stale callbacks cannot revive it`,
    );
    audio.stop();
  }
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
  assert.ok(
    audio.debugMetrics().nodes <= audio.debugMetrics().maxNodes,
    "rejected rapid cues must not allocate past the public node cap",
  );
  audio.stop();
  assert.equal(audio.debugMetrics().nodes, 0, "stop must release every bounded node");
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

test("resetRun clears run-local audio while preserving the live soundscape graph", (t) => {
  const speech = installSpeechSynthesis(t);
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const audio = new DefenseAudio({ reducedMotion: false, muted: false, volume: 0.37 });

  assert.equal(audio.start(), true);
  const context = FakeAudioContext.instances[0];
  const persistentNodes = audio.debugMetrics().nodes;
  const persistentOscillators = context.created.filter(({ kind }) => kind === "oscillator");
  const ordinary = event("OBJECTIVE_PHASE_CHANGED", 70, {
    tick: 70,
    eventId: "reset:objective:stable",
    objectiveId: "occupation",
  });
  const firstStory = event("STAGE_STARTED", 71, {
    tick: 70,
    eventId: "reset:story:stable",
    stageId: "cinder-span",
    voiceLine: "재설정 전 첫 번째 명령.",
  });
  const secondStory = event("OBJECTIVE_COMPLETED", 72, {
    tick: 70,
    eventId: "reset:story:queued",
    objectiveId: "boss-kill",
    storyBeat: { voiceLine: "재설정 전 대기 명령." },
  });

  audio.consume([ordinary, firstStory, secondStory]);
  audio.setSoundscape("boss", "echo-throne");
  const beforeReset = audio.debugMetrics();
  const staleUtterances = speech.utterances.slice(-2);

  assert.ok(beforeReset.voices > 0, "setup must own transient feedback voices");
  assert.equal(beforeReset.feedbackEvents, 1, "setup must remember the ordinary event");
  assert.equal(beforeReset.storyNarrations, 2, "setup must remember both authored stories");
  assert.equal(beforeReset.narrations, 2, "setup must track active and native-pending narration");
  assert.equal(beforeReset.narrationQueue, 1, "setup must expose one native-pending narration");
  assert.equal(speech.pending, true, "setup must leave the second story pending");

  const cancellationsBefore = speech.cancelCount;
  assert.equal(audio.resetRun(), true);

  const reset = audio.debugMetrics();
  assert.deepEqual(
    {
      started: reset.started,
      muted: reset.muted,
      volume: reset.volume,
      soundscapeStageId: reset.soundscapeStageId,
      soundscapeState: reset.soundscapeState,
    },
    {
      started: true,
      muted: false,
      volume: 0.37,
      soundscapeStageId: "echo-throne",
      soundscapeState: "boss",
    },
    "resetRun must preserve live configuration and soundscape state",
  );
  assert.equal(reset.nodes, persistentNodes, "resetRun must retain only the persistent audio graph");
  assert.equal(reset.transientNodes, 0, "resetRun must release every transient node");
  assert.equal(reset.voices, 0, "resetRun must release every transient voice");
  assert.equal(reset.feedbackEvents, 0, "resetRun must clear general event deduplication");
  assert.equal(reset.storyNarrations, 0, "resetRun must clear story deduplication");
  assert.equal(reset.narrations, 0, "resetRun must clear tracked narration");
  assert.equal(reset.narrationQueue, 0, "resetRun must clear native-pending narration");
  assert.equal(speech.cancelCount, cancellationsBefore + 1, "resetRun must cancel native speech once");
  assert.equal(speech.speaking, false, "resetRun must leave no active native speech");
  assert.equal(speech.pending, false, "resetRun must leave no pending native speech");
  assert.equal(context.closeCount, 0, "resetRun must not close the live audio context");
  assert.equal(
    persistentOscillators.every(({ stopCount, disconnectCount }) =>
      stopCount === 0 && disconnectCount === 0
    ),
    true,
    "resetRun must not stop or disconnect persistent soundscape layers",
  );

  for (const utterance of staleUtterances) {
    utterance.onend?.();
    utterance.onerror?.();
  }
  const lowTickOrdinary = { ...ordinary, tick: 1 };
  const stableTickZeroStory = { ...firstStory, tick: 0 };

  audio.consume([lowTickOrdinary, stableTickZeroStory]);
  audio.consume([lowTickOrdinary, stableTickZeroStory]);

  assert.deepEqual(
    speech.utterances.map(({ text }) => text),
    ["재설정 전 첫 번째 명령.", "재설정 전 대기 명령.", "재설정 전 첫 번째 명령."],
    "the stable tick-zero story must be accepted once after reset and then deduplicated",
  );
  assert.equal(audio.debugMetrics().feedbackEvents, 1, "the low-tick ordinary cue must be accepted once");
  assert.equal(audio.debugMetrics().storyNarrations, 1, "the stable story key must be remembered once");
  assert.equal(
    audio.debugMetrics().voices,
    2,
    "cleared tick and refractory state must allow one low-tick cue plus its story cue",
  );

  audio.stop();
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
