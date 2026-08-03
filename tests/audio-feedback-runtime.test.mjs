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

// Narration is presented, not spoken: `narrate()` no longer drives the browser
// speech API, so there is nothing to observe there and no end-of-speech callback.
// A beat holds the presentation channel for its own reading duration and is
// released by a real `setTimeout`, so releasing a beat means advancing a clock.
// Mock timers make that instantaneous and exact, which is what lets a test say
// "the first beat released while the second still holds" without a wall-clock wait.
const NARRATION_HOLD_CEILING_MS = 5200;

// Mirrors defense-audio.js `narrationHoldMs`. Duplicated deliberately and only
// here: a test that advances a clock has to know the instant a beat is due, and
// pinning it means a change to the hold curve surfaces as a failure rather than
// as a silently vacuous tick.
const narrationHoldMs = (text) =>
  Math.min(NARRATION_HOLD_CEILING_MS, Math.max(2200, 1500 + text.length * 58));

function useNarrationClock(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  return {
    advance: (ms) => t.mock.timers.tick(ms),
    // Past the hold ceiling, so every outstanding beat is due.
    releaseAll: () => t.mock.timers.tick(NARRATION_HOLD_CEILING_MS),
  };
}

const event = (type, eventSequence, extra = {}) => ({
  type,
  tick: 20,
  eventSequence,
  eventId: `audio:${type}:${eventSequence}`,
  ...extra,
});

test("authored story milestones present one Korean line and retain their established cue", (t) => {
  const clock = useNarrationClock(t);
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
    const presentedBefore = audio.presentedNarrations.length;
    audio.consume([source]);
    assert.equal(
      audio.presentedNarrations.length,
      presentedBefore + 1,
      `${name} must present exactly one narration beat`,
    );
    assert.equal(
      audio.presentedNarrations.at(-1),
      spoken,
      `${name} must present only the first Korean story line, not direction or metadata`,
    );
    assert.equal(
      audio.debugMetrics().narrations,
      1,
      `${name} must hold the presentation channel with exactly one beat`,
    );
    clock.releaseAll();
    assert.equal(
      audio.debugMetrics().narrations,
      0,
      `${name} must release the channel once its reading hold ends`,
    );
  }
});

test("story narration outranks lore when both arrive in one event batch", (t) => {
  useNarrationClock(t);
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
    [...audio.presentedNarrations],
    ["봉쇄선이 열렸다."],
    "lower-priority lore must not displace or queue behind active story narration",
  );
  assert.equal(
    audio.debugMetrics().narrations,
    1,
    "only the authored story may hold the presentation channel",
  );
});

test("a textless narration event never enters the presented trace or holds the channel", (t) => {
  useNarrationClock(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  // Reachable, not hypothetical: a lore event with no `text` still resolves a
  // `narrate` cue, so `narrate()` is genuinely invoked with an empty line. If the
  // emptiness gate went, the trace would collect "" and a contentless beat would
  // hold the channel against every real beat behind it.
  const textlessLore = event("LORE_SURPRISE_RESOLVED", 40, { outcomeId: "ash-echo-silence" });

  assert.equal(
    audioCueForEvent(textlessLore)?.method,
    "narrate",
    "this event must still route through the narration channel, or the gate below is unreachable",
  );
  audio.consume([textlessLore]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    [],
    "an event with no narratable line must not be recorded as a presented beat",
  );
  assert.equal(
    audio.debugMetrics().narrations,
    0,
    "an event with no narratable line must not hold the presentation channel",
  );
});

test("same-batch authored stories are admitted once in arrival order and hold the channel together", (t) => {
  const clock = useNarrationClock(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  const firstLine = "첫 번째 봉쇄 명령이다.";
  // Deliberately longer than the first line. Each beat's hold is derived from its
  // OWN text, so unequal lengths are the only way "the first beat released while
  // the second still holds" is observable rather than an accident of one shared timer.
  const secondLine = "두 번째 귀환 명령이니 결속 지점까지 대형을 유지한 채로 후퇴하라.";
  const firstHoldMs = narrationHoldMs(firstLine);
  const secondHoldMs = narrationHoldMs(secondLine);
  const firstStory = event("STAGE_STARTED", 10, {
    tick: 0,
    stageId: "cinder-span",
    voiceLine: firstLine,
  });
  const secondStory = event("OBJECTIVE_COMPLETED", 11, {
    tick: 0,
    objectiveId: "boss-kill",
    storyBeat: { voiceLine: secondLine },
  });

  assert.ok(
    secondHoldMs > firstHoldMs,
    "the staggered-release assertions below are vacuous unless the two beats hold for different durations",
  );

  audio.consume([firstStory, secondStory]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    [firstLine, secondLine],
    "both authored stories must be admitted exactly once, in arrival order",
  );
  assert.equal(audio.debugMetrics().narrations, 2, "both admitted beats must hold the channel");
  assert.equal(
    audio.debugMetrics().narrationQueue,
    1,
    "the second authored story must be queued behind the first",
  );

  clock.advance(firstHoldMs);

  assert.equal(
    audio.debugMetrics().narrations,
    1,
    "the first beat's own reading hold must release that beat and only that beat",
  );
  assert.equal(
    audio.debugMetrics().narrationQueue,
    0,
    "the queue must drain as the first beat releases, promoting the second",
  );

  clock.advance(secondHoldMs - firstHoldMs);

  assert.equal(
    audio.debugMetrics().narrations,
    0,
    "the longer second beat must release on its own hold, not the first beat's",
  );

  audio.consume([firstStory, secondStory]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    [firstLine, secondLine],
    "immediately replaying the same tick-zero authored events must not duplicate narration",
  );
});

test("an authored story beat is admitted once while it still holds the channel", (t) => {
  useNarrationClock(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  const story = event("STAGE_STARTED", 12, {
    stageId: "cinder-span",
    voiceLine: "이 명령은 한 번만 보존하라.",
  });

  // Both consumes land inside the first beat's reading hold, so the channel is
  // still occupied by that beat when the replay arrives: dedup may not depend on
  // the beat having been released first.
  audio.consume([story]);
  audio.consume([story]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    ["이 명령은 한 번만 보존하라."],
    "a replayed story beat must not be presented again while the first is still held",
  );
  assert.equal(audio.debugMetrics().narrations, 1, "the replay must not double-count the held beat");
  assert.equal(
    audio.debugMetrics().storyNarrations,
    1,
    "the beat must be remembered under exactly one story key",
  );
  audio.stop();
});

test("critical feedback preempts active story narration", (t) => {
  useNarrationClock(t);
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
  const preempted = audio.debugMetrics();
  assert.equal(
    preempted.narrations,
    0,
    "critical feedback must release the narration channel it displaced",
  );
  assert.equal(
    preempted.narrationPriority,
    0,
    "the displaced beat must surrender its priority claim on the channel",
  );
  assert.equal(preempted.voices, 2, "the story cue and critical cue both remain bounded voices");
  assert.deepEqual(
    preempted.presentedNarrations,
    ["봉쇄선을 사수하라."],
    "preemption must release the channel without erasing what was already presented",
  );
  audio.stop();
});

test("a released story beat is not replayed for the same event key", (t) => {
  const clock = useNarrationClock(t);
  const audio = new DefenseAudio({ reducedMotion: true });
  const stageStarted = event("STAGE_STARTED", 1, {
    stageId: "cinder-span",
    voiceLine: "봉쇄선을 사수하라.",
  });

  audio.consume([stageStarted]);
  clock.releaseAll();

  assert.equal(
    audio.debugMetrics().narrations,
    0,
    "the beat must have released the channel before the replay is attempted",
  );
  audio.consume([{ ...stageStarted, voiceLine: "중복 재생되면 안 된다." }]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    ["봉쇄선을 사수하라."],
    "deduplication must key on the event, not the text, and must hold after the beat released",
  );
});

test("mute, pause, background suspension, and stop dispose active and queued narration", (t) => {
  useNarrationClock(t);
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const cases = [
    // Two separate contracts per dispose path, and clearing the channel proves
    // only the first: `stopNarration()` empties it regardless, so a dropped
    // `narrate()` gate is invisible unless a beat ARRIVES while disposed.
    // `refusesWhileDisposed` marks the paths `narrate()` actually gates on
    // (`muted` / `paused` / `backgrounded`). Stop is excluded deliberately:
    // `narrate()` has no `started` gate, so a post-stop beat is a caller error
    // rather than a channel contract, and pinning today's behaviour there would
    // fossilise it. Only stop is a run boundary, so only stop erases the trace.
    {
      name: "mute",
      dispose: (audio) => audio.setMuted(true),
      restore: (audio) => audio.setMuted(false),
      clearsPresentedTrace: false,
      refusesWhileDisposed: true,
    },
    {
      name: "pause",
      dispose: (audio) => audio.pause(),
      restore: (audio) => audio.resume(),
      clearsPresentedTrace: false,
      refusesWhileDisposed: true,
    },
    {
      name: "background",
      dispose: (audio) => audio.suspendForBackground(),
      restore: (audio) => audio.resumeFromBackground(),
      clearsPresentedTrace: false,
      refusesWhileDisposed: true,
    },
    {
      name: "stop/dispose",
      dispose: (audio) => audio.stop(),
      restore: (audio) => audio.start(),
      clearsPresentedTrace: true,
      refusesWhileDisposed: false,
    },
  ];

  for (const [index, {
    name,
    dispose,
    restore,
    clearsPresentedTrace,
    refusesWhileDisposed,
  }] of cases.entries()) {
    const audio = new DefenseAudio({ reducedMotion: true });
    assert.equal(audio.start(), true);
    const activeLine = `${name} 전 첫 번째 명령.`;
    const queuedLine = `${name} 뒤 재생되면 안 되는 대기 명령.`;
    audio.consume([
      event("STAGE_STARTED", index * 4 + 20, {
        stageId: "cinder-span",
        voiceLine: activeLine,
      }),
      event("OBJECTIVE_COMPLETED", index * 4 + 21, {
        objectiveId: "boss-kill",
        storyBeat: { voiceLine: queuedLine },
      }),
    ]);
    assert.deepEqual(
      [...audio.presentedNarrations],
      [activeLine, queuedLine],
      `${name} setup must present the active and queued narrations`,
    );
    assert.equal(audio.debugMetrics().narrations, 2, `${name} setup must track both narrations`);
    assert.equal(audio.debugMetrics().narrationQueue, 1, `${name} setup must queue the second narration`);

    dispose(audio);

    const disposed = audio.debugMetrics();
    assert.equal(disposed.narrations, 0, `${name} must release narration ownership`);
    assert.equal(disposed.narrationQueue, 0, `${name} must clear queued narration`);
    assert.equal(disposed.narrationPriority, 0, `${name} must surrender the channel's priority claim`);
    assert.deepEqual(
      disposed.presentedNarrations,
      clearsPresentedTrace ? [] : [activeLine, queuedLine],
      `${name} must ${clearsPresentedTrace ? "erase" : "preserve"} the presented narration trace`,
    );

    if (refusesWhileDisposed) {
      const refusedLine = `${name} 중 도착한 명령.`;
      const traceBeforeRefusal = [...audio.presentedNarrations];
      audio.consume([
        event("STAGE_STARTED", index * 4 + 22, { stageId: "cinder-span", voiceLine: refusedLine }),
      ]);
      assert.equal(
        audio.debugMetrics().narrations,
        0,
        `${name} must refuse a beat that arrives while the channel is disposed, not merely clear the old one`,
      );
      assert.deepEqual(
        [...audio.presentedNarrations],
        traceBeforeRefusal,
        `${name} must leave a refused beat out of the presented trace`,
      );
    }

    restore(audio);
    const restored = audio.debugMetrics();
    assert.deepEqual(
      [restored.started, restored.muted, restored.paused, restored.backgrounded],
      [true, false, false, false],
      `${name} setup must become eligible for audio again`,
    );

    // Disposal must not poison the channel: a beat arriving after restore is
    // admitted again, which is what the disposed counters would hide if they
    // leaked instead of clearing.
    const revivedLine = `${name} 복구 후 명령.`;
    audio.consume([
      event("STAGE_STARTED", index * 4 + 23, { stageId: "cinder-span", voiceLine: revivedLine }),
    ]);
    assert.equal(
      audio.debugMetrics().narrations,
      1,
      `${name} must admit narration again once the channel is restored`,
    );
    assert.equal(
      audio.presentedNarrations.at(-1),
      revivedLine,
      `${name} must present the beat that arrives after restore`,
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
  useNarrationClock(t);
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
  const presentedBeforeReset = [...audio.presentedNarrations];

  assert.ok(beforeReset.voices > 0, "setup must own transient feedback voices");
  assert.equal(beforeReset.feedbackEvents, 1, "setup must remember the ordinary event");
  assert.equal(beforeReset.storyNarrations, 2, "setup must remember both authored stories");
  assert.equal(beforeReset.narrations, 2, "setup must track the active and the queued narration");
  assert.equal(beforeReset.narrationQueue, 1, "setup must expose one queued narration");
  assert.deepEqual(
    presentedBeforeReset,
    ["재설정 전 첫 번째 명령.", "재설정 전 대기 명령."],
    "setup must have presented both authored stories",
  );

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
  assert.equal(reset.narrationQueue, 0, "resetRun must clear queued narration");
  assert.equal(reset.narrationPriority, 0, "resetRun must surrender the channel's priority claim");
  assert.deepEqual(
    reset.presentedNarrations,
    [],
    "resetRun must erase the presented narration trace so it cannot bleed into the next run",
  );
  assert.equal(context.closeCount, 0, "resetRun must not close the live audio context");
  assert.equal(
    persistentOscillators.every(({ stopCount, disconnectCount }) =>
      stopCount === 0 && disconnectCount === 0
    ),
    true,
    "resetRun must not stop or disconnect persistent soundscape layers",
  );

  const lowTickOrdinary = { ...ordinary, tick: 1 };
  const stableTickZeroStory = { ...firstStory, tick: 0 };

  audio.consume([lowTickOrdinary, stableTickZeroStory]);
  audio.consume([lowTickOrdinary, stableTickZeroStory]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    ["재설정 전 첫 번째 명령."],
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

test("stop clears the presented narration trace so it cannot leak into the next run", (t) => {
  useNarrationClock(t);
  const { audio } = startAudio(t);
  const firstRunStory = event("STAGE_STARTED", 90, {
    stageId: "cinder-span",
    voiceLine: "첫 번째 출격 명령이다.",
  });
  const secondRunStory = event("STAGE_STARTED", 91, {
    stageId: "cinder-span",
    voiceLine: "두 번째 출격 명령이다.",
  });

  audio.consume([firstRunStory]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    ["첫 번째 출격 명령이다."],
    "the first run must record the beat it presented",
  );

  audio.stop();

  assert.deepEqual(audio.presentedNarrations, [], "stop must erase the presented narration trace");
  assert.deepEqual(
    audio.debugMetrics().presentedNarrations,
    [],
    "the reported trace must be empty after stop rather than a stale copy",
  );

  assert.equal(audio.start(), true);
  audio.consume([secondRunStory]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    ["두 번째 출격 명령이다."],
    "the next run must start from an empty trace instead of inheriting the prior run's beats",
  );
  audio.stop();
});

test("a tick-zero rerun clears the presented trace, the third run boundary alongside resetRun and stop", (t) => {
  useNarrationClock(t);
  const { audio } = startAudio(t);
  const priorRunStory = event("STAGE_STARTED", 92, {
    stageId: "cinder-span",
    voiceLine: "이전 회차의 명령이다.",
  });
  // A previously unseen STAGE_STARTED at tick 0, arriving after a run has already
  // advanced, is how a re-entered stage announces itself. It is a run boundary
  // like resetRun and stop, so it owes the same guarantee: the next run may not
  // read the previous run's beats out of the trace.
  const rerunStory = event("STAGE_STARTED", 93, {
    tick: 0,
    stageId: "cinder-span",
    voiceLine: "재시작 회차의 명령이다.",
  });

  audio.consume([priorRunStory]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    ["이전 회차의 명령이다."],
    "the prior run must record the beat it presented",
  );

  audio.consume([rerunStory]);

  assert.deepEqual(
    [...audio.presentedNarrations],
    ["재시작 회차의 명령이다."],
    "a tick-zero rerun must erase the prior run's trace rather than append to it",
  );
  audio.stop();
});

test("the presented trace is bounded, dropping oldest beats instead of retaining a whole run", (t) => {
  const clock = useNarrationClock(t);
  const { audio } = startAudio(t);
  const TRACE_CAP = 16;
  const beats = 18;
  const lineFor = (index) => `${index}번째 봉쇄 명령이다.`;

  for (let index = 1; index <= beats; index += 1) {
    audio.consume([
      event("STAGE_STARTED", 200 + index, { stageId: "cinder-span", voiceLine: lineFor(index) }),
    ]);
    // Release between beats so each one is admitted on its own merits rather than
    // being refused by the active-narration cap, which would make the overflow below
    // an artifact of concurrency instead of the trace bound under test.
    clock.releaseAll();
  }

  const expected = Array.from({ length: TRACE_CAP }, (_, offset) => lineFor(beats - TRACE_CAP + offset + 1));

  assert.equal(
    audio.presentedNarrations.length,
    TRACE_CAP,
    "a run longer than the trace bound must not grow the trace past it",
  );
  assert.deepEqual(
    [...audio.presentedNarrations],
    expected,
    "the bounded trace must retain the newest beats in order and drop the oldest",
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

// ---------------------------------------------------------------------------
// Cycle 10 — stage dungeon audio. Every test below drives an event vocabulary
// that NO pre-existing test emits, so none of these branches were entered by
// the 17 tests above. Those 17 pass on this tree only because the code they
// cover is never reached from them: carried evidence, not new evidence.
// ---------------------------------------------------------------------------

// startAudio() above builds with `reducedMotion: true`, which is right for the discrete-combat
// tests it serves but structurally silences two whole subsystems: play() refuses `movement-step`
// before allocating, and startAmbience()/startBattleMusic() return early so there is no
// persistent graph to transition. Footstep and BGM contracts are unobservable through it.
function startFullAudio(t, options = {}) {
  FakeAudioContext.instances.length = 0;
  replaceGlobal(t, "AudioContext", FakeAudioContext);
  replaceGlobal(t, "webkitAudioContext", undefined);
  const audio = new DefenseAudio({ reducedMotion: false, ...options });
  assert.equal(audio.start(), true);
  return { audio, context: FakeAudioContext.instances[0] };
}

const persistentOscillators = (context) =>
  context.created.filter(({ kind }) => kind === "oscillator");

const totalStops = (context) =>
  persistentOscillators(context).reduce((total, { stopCount }) => total + stopCount, 0);

test("every cycle-10 dungeon event resolves its authored cue, priority, and category", () => {
  // One row per RESOLUTION, not per event type: the four GIMMICK_TRIGGERED classes and the three
  // ENEMY_SPAWNED grades are separate readings of one type, and each is a branch that a wrong
  // `gimmickClass`/`grade` key would silently drop to the registry default.
  const resolutions = [
    ["DROP_SPAWNED", { rarity: "rare" }, "play", "drop-appear", 38, "pickup"],
    ["DROP_EXPIRED", {}, "play", "drop-expire", 30, "pickup"],
    ["DROP_DENIED", { reason: "FIELD_CAP" }, "silent", null, 0, "pickup"],
    ["BUFF_APPLIED", { stat: "basicDamage" }, "play", "buff-apply", 54, "pickup"],
    ["BUFF_REFRESHED", { stat: "basicDamage" }, "play", "buff-refresh", 44, "pickup"],
    ["BUFF_EXPIRED", { reason: "TIMEOUT" }, "play", "buff-expire", 40, "pickup"],
    ["ENEMY_SPAWNED", { grade: "BASIC" }, "silent", null, 0, "spawn"],
    ["ENEMY_SPAWNED", { grade: "SHADOW" }, "play", "shadow-arrival", 68, "spawn"],
    ["ENEMY_SPAWNED", { grade: "BOSS" }, "silent", null, 0, "spawn"],
    ["GIMMICK_ARMED", { gimmickClass: "deformation" }, "play", "gimmick-arm", 72, "warning"],
    ["GIMMICK_TRIGGERED", { gimmickClass: "deformation" }, "play", "terrain-deform", 76, "warning"],
    ["GIMMICK_TRIGGERED", { gimmickClass: "hazard" }, "play", "warning-pulse", 78, "warning"],
    ["GIMMICK_TRIGGERED", { gimmickClass: "gate" }, "play", "occupation-captured", 64, "objective"],
    ["GIMMICK_TRIGGERED", { gimmickClass: "mirror" }, "play", "gimmick-mirror", 66, "warning"],
    ["GIMMICK_RESOLVED", { gimmickClass: "mirror" }, "play", "gimmick-settle", 34, "objective"],
    ["PACING_BLOCK_STARTED", { blockId: "midboss" }, "silent", null, 0, "pacing"],
    ["PACING_BLOCK_CLEARED", { blockId: "midboss" }, "silent", null, 0, "pacing"],
  ];

  resolutions.forEach(([type, payload, method, cueId, priority, category], index) => {
    const source = event(type, index + 1, payload);
    const label = `${type} ${JSON.stringify(payload)}`;
    assert.deepEqual(
      audioCueForEvent(source),
      {
        eventType: type,
        method,
        cueId,
        priority,
        category,
        intentionalSilence: method === "silent",
      },
      `${label} must resolve its authored cue contract`,
    );
  });

  // An unruled gimmick class must degrade to the registry entry, never throw and never fall
  // through to the catalog-cue path: a dungeon shipping a 14th class must still sound.
  assert.equal(
    audioCueForEvent(event("GIMMICK_TRIGGERED", 90, { gimmickClass: "kaleidoscope" }))?.cueId,
    "terrain-deform",
    "an unruled gimmick class must fall back to the registry reading",
  );

  // The design relationships those bare numbers encode. A priority edited in isolation reads
  // plausible on its own row and breaks one of these.
  assert.ok(
    AUDIO_EVENT_POLICY.DROP_SPAWNED.priority > AUDIO_EVENT_POLICY.ENEMY_DEFEATED.priority,
    "a drop must read over the kill that produced it",
  );
  assert.ok(
    AUDIO_EVENT_POLICY.DROP_SPAWNED.priority < AUDIO_EVENT_POLICY.COMMANDER_DAMAGED.priority,
    "no reward cue may outrank commander damage",
  );
  assert.ok(
    AUDIO_EVENT_POLICY.BUFF_APPLIED.priority < AUDIO_EVENT_POLICY.ITEM_COLLECTED.priority,
    "collecting is the act and gaining the buff is its consequence",
  );
  assert.ok(
    AUDIO_EVENT_POLICY.BUFF_REFRESHED.priority < AUDIO_EVENT_POLICY.BUFF_APPLIED.priority
      && AUDIO_EVENT_POLICY.BUFF_EXPIRED.priority < AUDIO_EVENT_POLICY.BUFF_APPLIED.priority,
    "gaining a buff must outrank refreshing or losing one",
  );
});

test("the gimmick telegraph rises and its resolution falls, so arm and fire are inverses", (t) => {
  // A player must be able to tell "the floor is about to go" from "the floor just went" with no
  // visual. The distinguishing property is contour direction, not layer count or gain: a
  // telegraph that fell would read as the collapse it is supposed to precede.
  const { audio } = startFullAudio(t);
  const contour = (cueId, source) => {
    const layers = audio.lookup(cueId, source)?.profile;
    assert.ok(layers?.length > 0, `${cueId} must resolve a real profile`);
    return layers;
  };

  const arming = contour("gimmick-arm", event("GIMMICK_ARMED", 1, { gimmickClass: "deformation" }));
  assert.equal(
    arming.every(({ frequency, endFrequency }) => endFrequency > frequency),
    true,
    "every layer of the arming telegraph must rise",
  );

  const collapsing = contour(
    "terrain-deform",
    event("GIMMICK_TRIGGERED", 2, { gimmickClass: "deformation" }),
  );
  assert.equal(
    collapsing.every(({ frequency, endFrequency }) => endFrequency < frequency),
    true,
    "every layer of the collapse must fall",
  );
  assert.equal(
    collapsing.some(({ endFrequency }) => endFrequency < Math.min(...arming.map((l) => l.endFrequency))),
    true,
    "the collapse must land below where the telegraph ended",
  );

  // The same inversion carries the buff pair: gain rises, loss falls, across one register.
  const applied = contour("buff-apply", event("BUFF_APPLIED", 3, { stat: "basicDamage" }));
  const expired = contour("buff-expire", event("BUFF_EXPIRED", 4, { stat: "basicDamage", reason: "TIMEOUT" }));
  assert.equal(
    applied.every(({ frequency, endFrequency }) => endFrequency > frequency),
    true,
    "gaining a buff must rise",
  );
  assert.equal(
    expired.every(({ frequency, endFrequency }) => endFrequency < frequency),
    true,
    "losing a buff must fall, mirroring the gain",
  );

  audio.stop();
});

test("each new dungeon cue throttles on its own authored refractory window", (t) => {
  // Behavioral rather than table-reading: each cue is driven twice inside its window and once
  // outside it. A refractory edited to any other value reddens exactly one row.
  const windows = [
    ["drop-appear", "DROP_SPAWNED", { rarity: "relic" }, 0.09],
    ["drop-expire", "DROP_EXPIRED", {}, 0.14],
    ["buff-apply", "BUFF_APPLIED", { stat: "basicDamage" }, 0.1],
    ["buff-refresh", "BUFF_REFRESHED", {}, 0.12],
    ["buff-expire", "BUFF_EXPIRED", { reason: "TIMEOUT" }, 0.12],
    ["shadow-arrival", "ENEMY_SPAWNED", { grade: "SHADOW" }, 0.6],
    ["gimmick-arm", "GIMMICK_ARMED", { gimmickClass: "gate" }, 0.4],
    ["terrain-deform", "GIMMICK_TRIGGERED", { gimmickClass: "deformation" }, 0.45],
    ["gimmick-mirror", "GIMMICK_TRIGGERED", { gimmickClass: "mirror" }, 0.3],
    ["gimmick-settle", "GIMMICK_RESOLVED", {}, 0.25],
  ];

  for (const [cueId, type, payload, refractory] of windows) {
    const { audio, context } = startFullAudio(t);
    const base = context.currentTime;
    let sequence = 0;
    const drive = () => {
      sequence += 1;
      return audio.play(
        cueId,
        event(type, sequence, { ...payload, eventId: `${cueId}:${sequence}` }),
      );
    };

    assert.equal(drive(), true, `${cueId} must sound on first arrival`);
    context.currentTime = base + refractory - 0.005;
    assert.equal(drive(), false, `${cueId} must stay throttled inside its ${refractory}s window`);
    context.currentTime = base + refractory + 0.005;
    assert.equal(drive(), true, `${cueId} must sound again once its ${refractory}s window closes`);
    audio.stop();
  }
});

test("BUFF_EXPIRED is audible on TIMEOUT alone and silent for every bookkeeping reason", () => {
  const expiry = (reason, sequence) =>
    audioCueForEvent(event("BUFF_EXPIRED", sequence, {
      reason,
      stat: "basicDamage",
      buffId: "buff-1",
    }));

  assert.deepEqual(
    expiry("TIMEOUT", 1),
    {
      eventType: "BUFF_EXPIRED",
      method: "play",
      cueId: "buff-expire",
      priority: 40,
      category: "pickup",
      intentionalSilence: false,
    },
    "a buff running out is the one expiry the player lived through and must sound",
  );

  // The three bookkeeping reasons. EVICTED coincides with the buff-apply that displaced it,
  // DEATH flushes the whole set in the terminal tick, STAGE_TRANSITION is enum-only today.
  ["EVICTED", "STAGE_TRANSITION", "DEATH"].forEach((reason, index) => {
    assert.deepEqual(
      expiry(reason, index + 2),
      {
        eventType: "BUFF_EXPIRED",
        method: "silent",
        cueId: null,
        priority: 0,
        category: "pickup",
        intentionalSilence: true,
      },
      `BUFF_EXPIRED reason=${reason} is bookkeeping and must not sound`,
    );
  });
});

test("the expiry gate keys on type AND reason, so no reason vocabulary leaks across events", () => {
  // `reason` carries four incompatible vocabularies across six emit sites, and those value sets
  // happen not to overlap TODAY — which is exactly why a bare `reason` lookup would pass review
  // and pass any test that only drives the four ruled buff reasons. Both halves below are
  // required: each one alone is satisfied by a different wrong implementation.

  // Half 1 kills a reason-keyed ALLOW-list (`reason === "TIMEOUT" -> buff-expire`). Of the seven
  // event types that carry a `reason` payload, these four are the ones owning an
  // AUDIO_EVENT_POLICY entry, so they are the four reachable inside play(). The other three
  // (M4_CARD_REJECTED, M4_FALLBACK, REWARD_SELECTION_DUPLICATE_IGNORED) have no policy at all
  // and are unreachable rather than safe-by-design — if one ever gains a policy, it lands here.
  const reachableCarriers = [
    ["PROJECTILE_EXPIRED", "attack-miss", 28],
    ["EXTRACTION_REJECTED", "input-rejected", 62],
    ["INPUT_ACCEPTED", "input-accepted", 34],
    ["INPUT_REJECTED", "input-rejected", 48],
  ];
  reachableCarriers.forEach(([type, cueId, priority], index) => {
    const cue = audioCueForEvent(event(type, index + 1, { reason: "TIMEOUT" }));
    assert.deepEqual(
      { cueId: cue?.cueId, priority: cue?.priority },
      { cueId, priority },
      `${type} carrying reason="TIMEOUT" must keep its own cue, never the buff expiry cue`,
    );
  });

  // Half 2 kills a reason-keyed DENY-list (`["EVICTED","DEATH",...].includes(reason) -> silent`),
  // which would wrongly SOUND BUFF_EXPIRED for every unlisted value. These are real values from
  // the other sites' vocabularies, plus two near-misses that pin strict equality.
  const foreignReasons = [
    "bounds",
    "range",
    "WINDOW_EXPIRED",
    "ELITE_ALREADY_EXTRACTED",
    "EXTRACTION_HOLD_INCOMPLETE",
    "NO_ECHO_CANDIDATE",
    "REWARD_ALREADY_OWNED",
    "M4_CARD_INVENTORY_EXHAUSTED",
    "M4_CARD_DECISION_INVALID",
    "INPUT_TYPE_UNSUPPORTED",
    "FIELD_CAP",
    "timeout",
    "TIMEOUT ",
  ];
  foreignReasons.forEach((reason, index) => {
    const cue = audioCueForEvent(event("BUFF_EXPIRED", index + 20, { reason }));
    assert.deepEqual(
      { method: cue?.method, cueId: cue?.cueId },
      { method: "silent", cueId: null },
      `BUFF_EXPIRED reason=${JSON.stringify(reason)} is not TIMEOUT and must stay silent`,
    );
  });

  // A null reason is not hypothetical: INPUT_ACCEPTED emits `reason: accepted ? null : ...`, so
  // null is a live payload value on a policy-owning event. `table[event.reason]` with a null key
  // is a distinct failure path from a foreign string, and both directions must hold.
  assert.equal(
    audioCueForEvent(event("INPUT_ACCEPTED", 80, { reason: null }))?.cueId,
    "input-accepted",
    "the accepted-input branch carries reason=null and must keep its own cue",
  );
  assert.equal(
    audioCueForEvent(event("BUFF_EXPIRED", 81, { reason: null }))?.method,
    "silent",
    "a null reason must not be read as TIMEOUT",
  );
  // An absent reason is the shape a partially-migrated emitter produces. Silence is the safe
  // default: a missing field must never be read as "it ran out".
  assert.equal(
    audioCueForEvent(event("BUFF_EXPIRED", 82, {}))?.method,
    "silent",
    "an absent reason must not be read as TIMEOUT",
  );
});

test("a six-buff expiry sweep spends no voices unless the buffs actually ran out", (t) => {
  // MAX_ACTIVE_BUFFS = 6, so a wipe or an objective retry clears the whole set in one tick.
  // Ungated that is six stings — half the twelve-voice pool — at the moment the mix is most
  // contested, and on top of the terminal cue that caused it.
  const sweep = (reason) =>
    Array.from({ length: 6 }, (_, index) =>
      event("BUFF_EXPIRED", index, {
        tick: 40,
        eventId: `sweep:${reason}:${index}`,
        buffId: `buff-${index}`,
        stat: "basicDamage",
        reason,
      }));

  for (const reason of ["DEATH", "EVICTED", "STAGE_TRANSITION"]) {
    const { audio } = startFullAudio(t);
    audio.consume(sweep(reason));
    assert.equal(
      audio.debugMetrics().voices,
      0,
      `a six-buff ${reason} sweep must cost the mix nothing`,
    );
    audio.stop();
  }

  const { audio } = startFullAudio(t);
  audio.consume(sweep("TIMEOUT"));
  assert.equal(
    audio.debugMetrics().voices,
    1,
    "six simultaneous TIMEOUT expiries must collapse to one voice through the refractory",
  );
  audio.stop();
});

test("a commander step tick sounds a footstep while idle and off-cadence movement stay silent", (t) => {
  const { audio } = startFullAudio(t);
  const move = (sequence, extra) =>
    event("MOVE", sequence, { to: { x: 9000, y: 1000 }, ...extra });

  // On cadence with a direction: the un-shadowed footstep. `movement-step` was a fully authored
  // profile that no policy could reach before this cycle — dead code, not a missing sound.
  const step = audioCueForEvent(move(1, { tick: 24, direction: "E" }));
  assert.deepEqual(
    step,
    {
      eventType: "MOVE",
      method: "play",
      cueId: AUDIO_CUES.movementStep.id,
      priority: 5,
      category: "movement",
      intentionalSilence: false,
    },
    "a commander MOVE on a step tick must resolve the authored footstep cue",
  );
  assert.equal(audio.play(step.cueId, move(1, { tick: 24, direction: "E" })), true);
  assert.equal(audio.debugMetrics().voices, 1, "the footstep must own a real transient voice");

  // Every silent shape must stay byte-identical to the pre-existing MOVE silence, not merely
  // "not the footstep": the un-shadowing must not have widened what MOVE resolves to.
  const silentMove = {
    eventType: "MOVE",
    method: "silent",
    cueId: null,
    priority: 0,
    category: "movement",
    intentionalSilence: true,
  };
  const silentCases = [
    ["an off-cadence tick with a held direction", { tick: 25, direction: "E" }],
    ["a step tick with no direction at all", { tick: 24 }],
    ["a step tick with an explicit IDLE direction", { tick: 24, direction: "IDLE" }],
    ["a step tick with a null direction", { tick: 24, direction: null }],
    ["a step tick with a non-string direction", { tick: 24, direction: 1 }],
    ["a fractional tick", { tick: 24.5, direction: "E" }],
    // `Number.isInteger` is load-bearing, not decoration: every value below coerces to 0 under
    // `% 12`, so a guard written as a bare modulo would sound a footstep for a malformed tick.
    ["a null tick", { tick: null, direction: "E" }],
    ["a boolean tick", { tick: false, direction: "E" }],
    ["an empty-string tick", { tick: "", direction: "E" }],
    ["an empty-array tick", { tick: [], direction: "E" }],
    ["a numeric-string tick that looks like a step", { tick: "24", direction: "E" }],
  ];
  silentCases.forEach(([label, extra], index) => {
    assert.deepEqual(
      audioCueForEvent(move(index + 10, extra)),
      silentMove,
      `${label} must stay silent`,
    );
  });

  // The cadence is exactly every 12th tick, mirroring the simulation's own emit cadence so there
  // is no parallel timer to drift out of step with it. Pinning the exact set over a contiguous
  // range kills every wrong divisor at once: a 6 would add ticks 6/18/30/42, a 4 would add 28,
  // and an 18 would drop 12. A single sampled tick cannot tell those apart.
  const stepTicks = Array.from({ length: 48 }, (_, tick) => tick).filter((tick) =>
    audioCueForEvent(move(300 + tick, { tick, direction: "E" }))?.method === "play");
  assert.deepEqual(
    stepTicks,
    [0, 12, 24, 36],
    "a held direction must sound on exactly every 12th tick across a contiguous range",
  );

  // Enemy MOVE carries no `direction`, which is what makes enemy movement silent without an id
  // lookup or a snapshot read. Sixty enemy emits in one tick must cost the mix nothing.
  const swarm = Array.from({ length: 60 }, (_, index) =>
    event("MOVE", 200 + index, { tick: 24, enemyId: `enemy-${index}`, to: { x: 9000, y: 1000 } }));
  const voicesBeforeSwarm = audio.debugMetrics().voices;
  audio.consume(swarm);
  assert.equal(
    audio.debugMetrics().voices,
    voicesBeforeSwarm,
    "enemy MOVE emits carry no direction and must never allocate a voice",
  );

  audio.stop();
});

test("the footstep refractory bounds a held direction to the authored step cadence", (t) => {
  const { audio, context } = startFullAudio(t);
  const base = context.currentTime;
  const step = (tick) =>
    event("MOVE", tick, { tick, direction: "E", to: { x: 9000, y: 1000 }, eventId: `hold:${tick}` });

  // A held direction produces a step tick every 12 ticks. Delivered inside one refractory window
  // — a stall, a batched frame, a replayed tick range — they must not machine-gun.
  audio.consume([24, 36, 48, 60, 72].map(step));
  assert.equal(
    audio.debugMetrics().voices,
    1,
    "five step ticks inside one refractory window must collapse to a single footstep",
  );

  // The window is 0.07s, and it is asserted from BOTH sides. Collapsing a same-instant batch
  // only proves the throttle exists at zero elapsed time — every positive refractory, including
  // a near-zero one that machine-guns at 5Hz, passes that alone.
  context.currentTime = base + 0.065;
  assert.equal(
    audio.play(AUDIO_CUES.movementStep.id, step(84)),
    false,
    "a step inside the 0.07s window must stay throttled",
  );

  // Past the window the next step sounds: the throttle bounds the cadence, it does not mute it.
  context.currentTime = base + 0.08;
  assert.equal(
    audio.play(AUDIO_CUES.movementStep.id, step(84)),
    true,
    "a step past the refractory window must sound",
  );
  assert.equal(audio.debugMetrics().voices, 2);

  audio.stop();
});

test("footsteps follow the reduced-motion bed rule while discrete combat cues stay audible", (t) => {
  // A 5Hz continuous step stream is an ambience-class stimulus, and reduced motion already gates
  // that class. What matters is that it gates ONLY the bed: silencing discrete combat feedback
  // under reduced motion would be an accessibility regression, not a courtesy.
  const { audio } = startAudio(t);
  const stepEvent = event("MOVE", 1, { tick: 24, direction: "E", to: { x: 9000, y: 1000 } });

  assert.equal(audio.debugMetrics().reducedMotion, true);
  assert.equal(
    audio.play(AUDIO_CUES.movementStep.id, stepEvent),
    false,
    "reduced motion must suppress the footstep bed",
  );
  assert.equal(
    audio.debugMetrics().voices,
    0,
    "a suppressed footstep must be refused before it allocates a voice",
  );
  assert.equal(
    audio.play(AUDIO_CUES.criticalHit.id, event("CRITICAL_HIT", 2)),
    true,
    "reduced motion must not silence discrete combat feedback",
  );
  audio.stop();

  const full = startFullAudio(t);
  assert.equal(
    full.audio.play(AUDIO_CUES.movementStep.id, stepEvent),
    true,
    "the identical footstep must sound once the bed rule does not apply",
  );
  full.audio.stop();
});

test("each authored slab material selects a distinct footstep timbre", (t) => {
  const { audio } = startFullAudio(t);
  const timbreAt = (stageId, x, y) => {
    audio.setSoundscape("active-wave", stageId);
    return audio.lookup(
      AUDIO_CUES.movementStep.id,
      event("MOVE", 1, { tick: 24, direction: "E", to: { x, y } }),
    )?.profile;
  };

  // All nine authored materials, resolved through the real defense-catalog.js slab rects with no
  // injected resolver — the lookup is live by default, not waiting on a host injection.
  const materials = [
    ["ash-drift", "cinder-span", 1000, 1000],
    ["basalt-ember", "cinder-span", 9000, 1000],
    ["forge-plate", "cinder-span", 18000, 1000],
    ["flagstone-oath", "abyss-chancel", 1000, 1000],
    ["oath-inlay", "abyss-chancel", 17000, 1000],
    ["vestry-tile", "abyss-chancel", 17000, 9000],
    ["polished-echo", "echo-throne", 1000, 1000],
    ["gilt-compass", "echo-throne", 7000, 5000],
    ["fracture-glass", "echo-throne", 7000, 1000],
  ];

  const resolved = materials.map(([name, stageId, x, y]) => {
    audio.setSoundscape("active-wave", stageId);
    assert.equal(
      audio.surfaceMaterialFor({ to: { x, y } }),
      name,
      `${stageId} (${x},${y}) must resolve ${name}`,
    );
    return { name, profile: timbreAt(stageId, x, y) };
  });

  assert.equal(
    new Set(resolved.map(({ profile }) => JSON.stringify(profile))).size,
    materials.length,
    "every authored material must select its own timbre, not a shared placeholder",
  );

  // Timbre carries the surface and loudness never does: a floor change must read as a change of
  // material, not as a change of volume.
  for (const { name, profile } of resolved) {
    assert.equal(profile.length, 1, `${name} must stay a single-layer step`);
    assert.ok(profile[0].gain <= 0.04, `${name} must not raise the step above the bed gain ceiling`);
  }

  // The mirrored galleries are the same floor reflected, so they must sound identical. Two slab
  // ids sharing one material is authored intent, and a per-slab timbre table would break it.
  assert.deepEqual(
    timbreAt("abyss-chancel", 1000, 1000),
    timbreAt("abyss-chancel", 9000, 1000),
    "abyss-chancel slab-01 and slab-02 share flagstone-oath and must sound the same",
  );
  assert.deepEqual(
    timbreAt("echo-throne", 7000, 1000),
    timbreAt("echo-throne", 7000, 9000),
    "echo-throne slab-02 and slab-04 share fracture-glass and must sound the same",
  );

  audio.stop();
});

test("a footstep off the authored floor falls back to the base timbre rather than going silent", (t) => {
  const { audio } = startFullAudio(t);
  audio.setSoundscape("active-wave", "cinder-span");
  const outside = event("MOVE", 1, { tick: 24, direction: "E", to: { x: -50, y: -50 } });

  // null is a reachable, correct answer: the slabs do not tile the whole arena and enemies spawn
  // off-floor. The documented degradation is the base profile, never silence.
  assert.equal(audio.surfaceMaterialFor(outside), null, "a point off the authored floor resolves null");

  const offFloor = audio.lookup(AUDIO_CUES.movementStep.id, outside)?.profile;
  audio.setSurfaceResolver(null);
  const noResolver = audio.lookup(AUDIO_CUES.movementStep.id, outside)?.profile;
  assert.deepEqual(
    offFloor,
    noResolver,
    "an unresolved surface must yield the same base profile as having no resolver at all",
  );
  assert.equal(audio.play(AUDIO_CUES.movementStep.id, outside), true, "the fallback must still sound");

  // A resolver that throws must never break the audio frame mid-run.
  audio.setSurfaceResolver(() => { throw new Error("slab lookup exploded"); });
  assert.equal(audio.surfaceMaterialFor(outside), null, "a throwing resolver must degrade, not propagate");
  assert.deepEqual(
    audio.lookup(AUDIO_CUES.movementStep.id, outside)?.profile,
    noResolver,
    "a throwing resolver must fall back to the base timbre",
  );

  // A MOVE with no post-move position cannot be placed on a slab.
  assert.equal(
    audio.surfaceMaterialFor(event("MOVE", 2, { tick: 24, direction: "E" })),
    null,
    "a MOVE with no post-move position must resolve no material",
  );

  audio.stop();
});

test("a soundscape change transitions the live graph instead of restarting it", (t) => {
  const { audio, context } = startFullAudio(t);
  const layers = persistentOscillators(context);
  assert.ok(layers.length > 0, "a full soundscape must own persistent layers to transition");
  assert.equal(
    layers.every(({ startCount }) => startCount === 1),
    true,
    "each persistent layer must be started exactly once",
  );

  const before = {
    state: audio.debugMetrics().soundscapeState,
    nodes: audio.debugMetrics().nodes,
    frequencies: layers.map(({ frequency }) => frequency.value),
  };

  assert.equal(audio.setSoundscape("boss"), true, "a new state must be accepted");
  const after = persistentOscillators(context);

  // The four properties that separate a transition from a restart.
  assert.equal(after.length, layers.length, "a transition must not create a new oscillator");
  assert.equal(audio.debugMetrics().nodes, before.nodes, "a transition must not grow the node graph");
  assert.equal(
    after.every(({ startCount, stopCount }) => startCount === 1 && stopCount === 0),
    true,
    "a transition must neither restart nor stop a persistent layer",
  );
  assert.notDeepEqual(
    after.map(({ frequency }) => frequency.value),
    before.frequencies,
    "a transition must actually move the mix, not merely leave it running",
  );
  assert.notEqual(audio.debugMetrics().soundscapeState, before.state);

  // Re-entering the state already playing must be a no-op, so a repeated event cannot re-ramp.
  const settled = after.map(({ frequency }) => frequency.value);
  assert.equal(audio.setSoundscape("boss"), false, "re-entering the live state must be refused");
  assert.deepEqual(
    persistentOscillators(context).map(({ frequency }) => frequency.value),
    settled,
    "a refused transition must leave the mix untouched",
  );

  // An unruled state name must not strand the mix in a half-applied place.
  assert.equal(audio.setSoundscape("not-a-state"), true);
  assert.equal(
    audio.debugMetrics().soundscapeState,
    "descent",
    "an unknown state must resolve to the documented default",
  );

  audio.stop();
});

test("each pacing block drives its authored soundscape state through consume", (t) => {
  // Pacing blocks are BGM-only: they carry no SFX cue and must still steer the bed, because
  // consume() runs the soundscape transition on every fresh event independently of `method`.
  const blocks = [
    ["ingress", "descent"],
    ["objective-1", "active-wave"],
    ["objective-2", "active-wave"],
    ["midboss", "midboss"],
    ["occupation", "occupation"],
    ["boss", "boss"],
    ["extraction", "extraction"],
  ];

  for (const [blockId, expected] of blocks) {
    const { audio } = startFullAudio(t);
    audio.consume([event("PACING_BLOCK_STARTED", 1, { tick: 5, blockId, eventId: `block:${blockId}` })]);
    assert.equal(
      audio.debugMetrics().soundscapeState,
      expected,
      `pacing block ${blockId} must drive the ${expected} soundscape`,
    );
    assert.equal(audio.debugMetrics().voices, 0, `pacing block ${blockId} must sound no SFX cue`);
    audio.stop();
  }

  // `resolution` is the terminal BLOCK, but the victory/defeat OUTCOME belongs to TERMINAL.
  // Keying an outcome off a block id would give one moment two authorities.
  const { audio } = startFullAudio(t);
  audio.consume([event("PACING_BLOCK_STARTED", 1, { tick: 5, blockId: "boss", eventId: "block:boss" })]);
  audio.consume([
    event("PACING_BLOCK_STARTED", 2, { tick: 6, blockId: "resolution", eventId: "block:resolution" }),
  ]);
  assert.equal(
    audio.debugMetrics().soundscapeState,
    "boss",
    "the resolution block must not claim the terminal outcome",
  );
  audio.consume([event("TERMINAL", 3, { tick: 7, outcome: "VICTORY", eventId: "block:terminal" })]);
  assert.equal(
    audio.debugMetrics().soundscapeState,
    "victory",
    "TERMINAL alone owns the outcome state",
  );
  audio.stop();
});

test("each stage keeps its own tonal identity across the same soundscape state", (t) => {
  // `pitch` is a SCALAR on each stage's own frequencies, never a borrowed interval structure, so
  // the three stages must stay distinguishable in the state where they most sound alike.
  const identities = ["cinder-span", "abyss-chancel", "echo-throne"].map((stageId) => {
    const { audio, context } = startFullAudio(t);
    audio.setSoundscape("active-wave", stageId);
    const signature = persistentOscillators(context)
      .map(({ type, frequency }) => `${type}@${frequency.value}`)
      .join("|");
    assert.equal(audio.debugMetrics().soundscapeStageId, stageId);
    audio.stop();
    return { stageId, signature };
  });

  assert.equal(
    new Set(identities.map(({ signature }) => signature)).size,
    identities.length,
    "no two stages may share a soundscape signature",
  );
  // Waveform family alone must separate them: two stages differing only in pitch would read as
  // the same room played at a different speed.
  const waveforms = identities.map(({ signature }) =>
    signature.split("|").map((layer) => layer.split("@")[0]).join(","));
  assert.equal(
    new Set(waveforms).size,
    identities.length,
    "each stage must carry its own waveform family, not just its own pitch",
  );
});

test("a footstep can never evict a voice and a crowded dungeon respects the cap", (t) => {
  const { audio, context } = startFullAudio(t);
  const maxVoices = audio.debugMetrics().maxVoices;

  // Saturate the pool with the LOWEST priority any voice can hold. If a footstep cannot displace
  // even this, it cannot displace anything: the guarantee is about the mix, not about tuning.
  let filled = 0;
  for (let index = 0; index < maxVoices; index += 1) {
    if (audio.play(AUDIO_CUES.cameraClamp.id)) filled += 1;
    context.currentTime += 0.2;
  }
  assert.equal(filled, maxVoices, "the pool must saturate with lowest-priority voices");

  const stopsBefore = totalStops(context);
  assert.equal(
    audio.play(
      AUDIO_CUES.movementStep.id,
      event("MOVE", 1, { tick: 24, direction: "E", to: { x: 9000, y: 1000 } }),
    ),
    false,
    "traversal must yield to everything: a footstep is dropped, never granted room",
  );
  assert.equal(audio.debugMetrics().voices, maxVoices, "a dropped footstep must leave the pool intact");
  assert.equal(
    totalStops(context),
    stopsBefore,
    "a dropped footstep must not have stopped anything on its way out",
  );

  // The same guarantee on the OTHER reachable path. A footstep played without an event — an
  // off-cadence MOVE, or a bare presentation-side play() — takes its priority from
  // PRESENTATION_CUE_PRIORITY rather than from the policy. A player cannot tell the two paths
  // apart, so the never-evict guarantee has to hold on both or it does not hold at all.
  assert.equal(
    audio.play(AUDIO_CUES.movementStep.id),
    false,
    "a footstep on the presentation path must yield to the same saturated pool",
  );
  assert.equal(
    totalStops(context),
    stopsBefore,
    "the presentation-path footstep must not have evicted a clamp either",
  );

  // Control: the same saturated pool DOES yield to a critical cue, so the assertion above is
  // about the footstep's priority and not about an unconditionally closed pool.
  assert.equal(
    audio.play(AUDIO_CUES.terminal.id, event("TERMINAL", 2, { outcome: "DEFEAT" })),
    true,
    "a critical cue must still preempt the same saturated pool",
  );
  assert.ok(totalStops(context) > stopsBefore, "preemption must stop the displaced voice");
  audio.stop();

  // A dungeon burst: three new families arriving in one tick, six of each. The refractory is
  // what keeps the mix affordable — one voice per family, not eighteen.
  const crowded = startFullAudio(t);
  const burst = [];
  for (let index = 0; index < 6; index += 1) {
    burst.push(event("DROP_SPAWNED", 100 + index, { tick: 30, rarity: "relic", eventId: `burst:drop:${index}` }));
    burst.push(event("GIMMICK_ARMED", 200 + index, { tick: 30, gimmickClass: "gate", eventId: `burst:arm:${index}` }));
    burst.push(event("BUFF_APPLIED", 300 + index, { tick: 30, stat: "basicDamage", eventId: `burst:buff:${index}` }));
  }
  crowded.audio.consume(burst);
  const metrics = crowded.audio.debugMetrics();
  assert.equal(metrics.voices, 3, "a same-tick burst must collapse to one voice per cue family");
  assert.ok(metrics.voices <= metrics.maxVoices, "a crowded dungeon must respect the voice cap");
  assert.ok(metrics.nodes <= metrics.maxNodes, "a crowded dungeon must respect the node cap");
  crowded.audio.stop();
});

test("rarity and stat variants stay reachable so no dungeon cue collapses to one timbre", (t) => {
  // The variant key gained a third segment this cycle. If that extension breaks, every drop and
  // every buff silently falls back to its base profile — authored-but-unreachable all over
  // again, which is the exact failure this cycle was opened to fix.
  const { audio } = startFullAudio(t);

  const dropTiers = ["common", "rare", "resonant", "relic"].map((rarity) =>
    audio.lookup("drop-appear", event("DROP_SPAWNED", 1, { rarity }))?.profile);
  assert.deepEqual(
    dropTiers.map((profile) => profile.length),
    [1, 2, 3, 4],
    "drop rarity must be audible by layer density, so tier reads without reading the HUD",
  );
  assert.equal(
    new Set(dropTiers.map((profile) => JSON.stringify(profile))).size,
    4,
    "every rarity tier must select its own profile",
  );

  const stats = [
    "basicDamage",
    "gateMaxIntegrity",
    "pickupRange",
    "cooldownScaleBp",
    "moveSpeedBp",
    "critChanceBp",
    "incomingDamageBp",
  ];
  const bases = stats.map((stat) =>
    audio.lookup("buff-apply", event("BUFF_APPLIED", 1, { stat }))?.profile[0].frequency);
  assert.equal(new Set(bases).size, stats.length, "each buffed stat must land on its own register");

  // Adjacent registers must stay far enough apart to be told apart. The floor is checked with an
  // epsilon because the authored scalars are IEEE754 values: a bare `>= 1.12` literal on this
  // ladder is precisely what failed during design.
  const ascending = [...bases].sort((left, right) => left - right);
  ascending.slice(1).forEach((frequency, index) => {
    assert.ok(
      frequency / ascending[index] >= 1.12 - 1e-9,
      `adjacent stat registers ${ascending[index]} and ${frequency} must stay >= 12% apart`,
    );
  });

  // An unruled or absent stat must fall through to the base cue rather than resolving nothing.
  const base = audio.lookup("buff-apply", event("BUFF_APPLIED", 1, {}))?.profile;
  assert.ok(base?.length > 0, "the base buff timbre must exist to fall back to");
  assert.deepEqual(
    audio.lookup("buff-apply", event("BUFF_APPLIED", 2, { stat: "unruledStat" }))?.profile,
    base,
    "an unruled stat must fall back to the base buff timbre",
  );

  audio.stop();
});
