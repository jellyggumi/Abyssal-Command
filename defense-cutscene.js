import { audioCueForEvent } from "./defense-audio.js";

/**
 * Renderer-neutral presentation adapter for authored defense cutscenes.
 * It observes simulation events only; it never changes run or campaign state.
 */
const EVENT_TITLES = Object.freeze({
  STAGE_STARTED: "봉쇄선 진입",
  ELITE_CANDIDATE_AVAILABLE: "정예 잔향",
  TERMINAL: "전투 기록",
  LORE_SURPRISE_RESOLVED: "심연 기록",
});

const CAPTION_MODES = Object.freeze({
  dialogue: "dialogue",
  narration: "narration",
});
const RELAY_GAP_MS = 180;
const EXIT_HOLD_MS = 500;

const lineDurationMs = (text, captionMode) => {
  const narration = captionMode === CAPTION_MODES.narration;
  const duration = (narration ? 1800 : 1600) + text.length * (narration ? 60 : 55);
  return Math.min(narration ? 4800 : 3600, Math.max(narration ? 2800 : 2200, duration));
};

const relayMetadata = (index, lineCount, captionMode) => {
  const sequence = index + 1;
  const narration = captionMode === CAPTION_MODES.narration;
  const cue = `${narration ? "narration" : "relay"}-${sequence}`;
  return Object.freeze({
    sequence,
    cue,
    speaker: narration ? "narrator" : `speaker-${index % 2 === 0 ? "a" : "b"}`,
    previousCue: sequence > 1 ? `${narration ? "narration" : "relay"}-${sequence - 1}` : null,
    nextCue: sequence < lineCount ? `${narration ? "narration" : "relay"}-${sequence + 1}` : null,
  });
};

const presentationBeats = (lines, event, captionMode) => {
  const eventAudioCue = audioCueForEvent(event);
  let cursorMs = 0;
  return Object.freeze(lines.map((text, index) => {
    const relay = relayMetadata(index, lines.length, captionMode);
    const durationMs = lineDurationMs(text, captionMode);
    const startMs = cursorMs;
    const endMs = startMs + durationMs;
    cursorMs = endMs + (index < lines.length - 1 && captionMode === CAPTION_MODES.dialogue ? RELAY_GAP_MS : 0);
    const timing = Object.freeze({ startMs, endMs, durationMs });
    const boundaries = Object.freeze({
      start: Object.freeze({
        id: `${relay.cue}:start`,
        phase: "start",
        atMs: startMs,
        audio: index === 0 ? eventAudioCue : null,
        visual: Object.freeze({ action: "show-caption", captionMode, speaker: relay.speaker }),
      }),
      end: Object.freeze({
        id: `${relay.cue}:end`,
        phase: "end",
        atMs: endMs,
        audio: null,
        visual: Object.freeze({ action: "hide-caption", captionMode, speaker: relay.speaker }),
      }),
    });
    return Object.freeze({ index, text, captionMode, relay, timing, boundaries });
  }));
};

export function cutsceneLines(cutscene) {
  const values = Array.isArray(cutscene) ? cutscene : [cutscene];
  return values
    .filter((line) => typeof line === "string")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function cutsceneFromEvent(event) {
  const authoredLines = cutsceneLines(event?.cutscene);
  const loreLines = event?.type === "LORE_SURPRISE_RESOLVED" ? cutsceneLines(event.text) : [];
  const lines = Object.freeze(authoredLines.length ? authoredLines : loreLines);
  if (!lines.length) return null;
  const captionMode = event?.type === "LORE_SURPRISE_RESOLVED"
    ? CAPTION_MODES.narration
    : CAPTION_MODES.dialogue;
  const beats = presentationBeats(lines, event, captionMode);
  const durationMs = beats.at(-1)?.timing.endMs ?? 0;
  return Object.freeze({
    eventType: event.type,
    title: EVENT_TITLES[event.type] ?? "심연 기록",
    lines,
    captionMode,
    beats,
    timing: Object.freeze({
      durationMs,
      dismissAfterMs: durationMs + EXIT_HOLD_MS,
      relayGapMs: captionMode === CAPTION_MODES.dialogue ? RELAY_GAP_MS : 0,
    }),
  });
}

export function cutsceneEventKey(event) {
  if (!event?.type || !cutsceneFromEvent(event)) return null;
  return [
    event.type,
    event.tick ?? 0,
    event.stageId ?? event.eliteId ?? event.enemyId ?? event.outcomeId ?? event.tableId ?? event.outcome ?? event.text ?? "",
  ].join(":");
}
