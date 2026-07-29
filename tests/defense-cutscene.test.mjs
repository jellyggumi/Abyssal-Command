import test from "node:test";
import assert from "node:assert/strict";
import { audioCueForEvent } from "../defense-audio.js";
import { cutsceneEventKey, cutsceneFromEvent, cutsceneLines } from "../defense-cutscene.js";

function assertDeepFrozen(value, path = "cutscene") {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) {
    assertDeepFrozen(nested, `${path}.${key}`);
  }
}

function assertCinematicContract(cutscene, audioCue) {
  assertDeepFrozen(cutscene);
  for (const [index, beat] of cutscene.beats.entries()) {
    const previousCue = cutscene.beats[index - 1]?.relay.cue ?? null;
    const nextCue = cutscene.beats[index + 1]?.relay.cue ?? null;
    assert.equal(beat.relay.previousCue, previousCue, `beat ${index} must link to its predecessor`);
    assert.equal(beat.relay.nextCue, nextCue, `beat ${index} must link to its successor`);
    assert.deepEqual(beat.boundaries.start, {
      id: `${beat.relay.cue}:start`,
      phase: "start",
      atMs: beat.timing.startMs,
      audio: index === 0 ? audioCue : null,
      visual: {
        action: "show-caption",
        captionMode: beat.captionMode,
        speaker: beat.relay.speaker,
      },
    });
    assert.deepEqual(beat.boundaries.end, {
      id: `${beat.relay.cue}:end`,
      phase: "end",
      atMs: beat.timing.endMs,
      audio: null,
      visual: {
        action: "hide-caption",
        captionMode: beat.captionMode,
        speaker: beat.relay.speaker,
      },
    });
  }
  assert.equal(cutscene.timing.durationMs, cutscene.beats.at(-1).timing.endMs);
}

test("cutscene adapter normalizes authored stage copy without mutating the event", () => {
  const event = Object.freeze({ type: "STAGE_STARTED", tick: 0, stageId: "cinder-span", cutscene: ["  첫 줄  ", "둘째 줄", ""] });
  const cutscene = cutsceneFromEvent(event);

  assert.deepEqual(cutscene, {
    eventType: "STAGE_STARTED",
    title: "봉쇄선 진입",
    lines: ["첫 줄", "둘째 줄"],
    captionMode: "dialogue",
    beats: [
      {
        index: 0,
        text: "첫 줄",
        captionMode: "dialogue",
        relay: {
          sequence: 1,
          cue: "relay-1",
          speaker: "speaker-a",
          previousCue: null,
          nextCue: "relay-2",
        },
        timing: {
          startMs: 0,
          endMs: 2200,
          durationMs: 2200,
        },
        boundaries: {
          start: {
            id: "relay-1:start",
            phase: "start",
            atMs: 0,
            audio: audioCueForEvent(event),
            visual: {
              action: "show-caption",
              captionMode: "dialogue",
              speaker: "speaker-a",
            },
          },
          end: {
            id: "relay-1:end",
            phase: "end",
            atMs: 2200,
            audio: null,
            visual: {
              action: "hide-caption",
              captionMode: "dialogue",
              speaker: "speaker-a",
            },
          },
        },
      },
      {
        index: 1,
        text: "둘째 줄",
        captionMode: "dialogue",
        relay: {
          sequence: 2,
          cue: "relay-2",
          speaker: "speaker-b",
          previousCue: "relay-1",
          nextCue: null,
        },
        timing: {
          startMs: 2380,
          endMs: 4580,
          durationMs: 2200,
        },
        boundaries: {
          start: {
            id: "relay-2:start",
            phase: "start",
            atMs: 2380,
            audio: null,
            visual: {
              action: "show-caption",
              captionMode: "dialogue",
              speaker: "speaker-b",
            },
          },
          end: {
            id: "relay-2:end",
            phase: "end",
            atMs: 4580,
            audio: null,
            visual: {
              action: "hide-caption",
              captionMode: "dialogue",
              speaker: "speaker-b",
            },
          },
        },
      },
    ],
    timing: {
      durationMs: 4580,
      dismissAfterMs: 5080,
      relayGapMs: 180,
    },
  });
  assertCinematicContract(cutscene, audioCueForEvent(event));
  assert.deepEqual(cutscene.beats.map(({ relay }) => relay.speaker), ["speaker-a", "speaker-b"]);
  assert.equal(cutsceneEventKey(event), "STAGE_STARTED:0:cinder-span");
  assert.deepEqual(event.cutscene, ["  첫 줄  ", "둘째 줄", ""]);
});

test("cutscene adapter accepts terminal and elite copy but rejects empty presentation events", () => {
  assert.deepEqual(cutsceneLines("승리 기록"), ["승리 기록"]);
  assert.equal(cutsceneFromEvent({ type: "ITEM_COLLECTED", tick: 10 }), null);
  assert.equal(cutsceneEventKey({ type: "ITEM_COLLECTED", tick: 10 }), null);
  const event = { type: "TERMINAL", tick: 72, outcome: "VICTORY", cutscene: "관문이 유지됐다." };
  const cutscene = cutsceneFromEvent(event);
  assert.deepEqual(cutscene, {
    eventType: "TERMINAL",
    title: "전투 기록",
    lines: ["관문이 유지됐다."],
    captionMode: "dialogue",
    beats: [
      {
        index: 0,
        text: "관문이 유지됐다.",
        captionMode: "dialogue",
        relay: {
          sequence: 1,
          cue: "relay-1",
          speaker: "speaker-a",
          previousCue: null,
          nextCue: null,
        },
        timing: {
          startMs: 0,
          endMs: 2200,
          durationMs: 2200,
        },
        boundaries: {
          start: {
            id: "relay-1:start",
            phase: "start",
            atMs: 0,
            audio: audioCueForEvent(event),
            visual: {
              action: "show-caption",
              captionMode: "dialogue",
              speaker: "speaker-a",
            },
          },
          end: {
            id: "relay-1:end",
            phase: "end",
            atMs: 2200,
            audio: null,
            visual: {
              action: "hide-caption",
              captionMode: "dialogue",
              speaker: "speaker-a",
            },
          },
        },
      },
    ],
    timing: {
      durationMs: 2200,
      dismissAfterMs: 2700,
      relayGapMs: 180,
    },
  });
  assertCinematicContract(cutscene, audioCueForEvent(event));
  assert.equal(cutsceneEventKey(event), "TERMINAL:72:VICTORY");
});

test("lore surprise projects its authored snapshot text locally without a provider", (t) => {
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    providerCalls += 1;
    throw new Error("presentation must not call a provider");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const event = Object.freeze({
    type: "LORE_SURPRISE_RESOLVED",
    tick: 0,
    tableId: "cinder-span-surprise",
    outcomeId: "ash-echo-whisper",
    text: "옛 교량의 재가 바람에 흩어진다.",
  });
  const cutscene = cutsceneFromEvent(event);

  assert.deepEqual(cutscene, {
    eventType: "LORE_SURPRISE_RESOLVED",
    title: "심연 기록",
    lines: ["옛 교량의 재가 바람에 흩어진다."],
    captionMode: "narration",
    beats: [
      {
        index: 0,
        text: "옛 교량의 재가 바람에 흩어진다.",
        captionMode: "narration",
        relay: {
          sequence: 1,
          cue: "narration-1",
          speaker: "narrator",
          previousCue: null,
          nextCue: null,
        },
        timing: {
          startMs: 0,
          endMs: 2880,
          durationMs: 2880,
        },
        boundaries: {
          start: {
            id: "narration-1:start",
            phase: "start",
            atMs: 0,
            audio: audioCueForEvent(event),
            visual: {
              action: "show-caption",
              captionMode: "narration",
              speaker: "narrator",
            },
          },
          end: {
            id: "narration-1:end",
            phase: "end",
            atMs: 2880,
            audio: null,
            visual: {
              action: "hide-caption",
              captionMode: "narration",
              speaker: "narrator",
            },
          },
        },
      },
    ],
    timing: {
      durationMs: 2880,
      dismissAfterMs: 3380,
      relayGapMs: 0,
    },
  });
  assertCinematicContract(cutscene, audioCueForEvent(event));
  assert.equal(cutscene.captionMode, "narration");
  assert.deepEqual(cutscene.beats.map(({ relay }) => relay.speaker), ["narrator"]);
  assert.equal(cutsceneEventKey(event), "LORE_SURPRISE_RESOLVED:0:ash-echo-whisper");
  assert.equal(providerCalls, 0);
  assert.equal(event.text, "옛 교량의 재가 바람에 흩어진다.", "presentation must not mutate the snapshot event");
});
