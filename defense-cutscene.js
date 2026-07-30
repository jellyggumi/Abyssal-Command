import { audioCueForEvent } from "./defense-audio.js";

/**
 * Renderer-neutral presentation adapter for authored defense cutscenes.
 * It observes simulation events only; it never changes run or campaign state.
 */
const CAPTION_MODES = Object.freeze({
  dialogue: "dialogue",
  narration: "narration",
});
const EVENT_PRESENTATION = Object.freeze({
  STAGE_STARTED: Object.freeze({ title: "봉쇄선 진입", captionMode: CAPTION_MODES.dialogue }),
  ELITE_CANDIDATE_AVAILABLE: Object.freeze({ title: "정예 잔향", captionMode: CAPTION_MODES.dialogue }),
  OCCUPATION_CAPTURED: Object.freeze({ title: "점령 역전", captionMode: CAPTION_MODES.dialogue }),
  BOSS_SPAWNED: Object.freeze({ title: "심연 지휘관 출현", captionMode: CAPTION_MODES.dialogue }),
  OBJECTIVE_COMPLETED: Object.freeze({ title: "목표 달성", captionMode: CAPTION_MODES.dialogue }),
  TERMINAL: Object.freeze({ title: "전투 기록", captionMode: CAPTION_MODES.dialogue }),
  LORE_SURPRISE_RESOLVED: Object.freeze({ title: "심연 기록", captionMode: CAPTION_MODES.narration }),
});
const RELAY_GAP_MS = 180;
const EXIT_HOLD_MS = 500;

const lineDurationMs = (text, captionMode) => {
  const narration = captionMode === CAPTION_MODES.narration;
  const duration = (narration ? 1800 : 1600) + text.length * (narration ? 60 : 55);
  return Math.min(narration ? 4800 : 3600, Math.max(narration ? 2800 : 2200, duration));
};

const relayMetadata = (index, lineCount, captionMode, authoredSpeaker = null) => {
  const sequence = index + 1;
  const narration = captionMode === CAPTION_MODES.narration;
  const cue = `${narration ? "narration" : "relay"}-${sequence}`;
  return Object.freeze({
    sequence,
    cue,
    speaker: narration ? "narrator" : (authoredSpeaker ?? `speaker-${index % 2 === 0 ? "a" : "b"}`),
    previousCue: sequence > 1 ? `${narration ? "narration" : "relay"}-${sequence - 1}` : null,
    nextCue: sequence < lineCount ? `${narration ? "narration" : "relay"}-${sequence + 1}` : null,
  });
};

const authoredSpeakerForLine = (event, text) => {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) return null;
  const acquisitionDialogue = Array.isArray(event?.quest?.acquisitionDialogue)
    ? event.quest.acquisitionDialogue
    : [];
  const dialogueEntries = acquisitionDialogue.concat(event?.storyBeat?.dialogue ?? []);
  for (const dialogue of dialogueEntries) {
    if (typeof dialogue?.text !== "string" || dialogue.text.trim() !== normalizedText) continue;
    if (typeof dialogue.speaker !== "string") continue;
    const speaker = dialogue.speaker.trim();
    if (speaker) return speaker;
  }
  return null;
};

const presentationBeats = (lines, event, captionMode) => {
  const eventAudioCue = audioCueForEvent(event);
  let cursorMs = 0;
  return Object.freeze(lines.map((text, index) => {
    const relay = relayMetadata(index, lines.length, captionMode, authoredSpeakerForLine(event, text));
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
  const baseLines = authoredLines.length ? authoredLines : loreLines;
  const acquisitionDialogue = Array.isArray(event?.quest?.acquisitionDialogue)
    ? event.quest.acquisitionDialogue
    : [];
  const acquisitionLines = acquisitionDialogue.flatMap((dialogue) => cutsceneLines(dialogue?.text));
  const storyBeatLines = cutsceneLines(event?.storyBeat?.dialogue?.text);
  const knownLines = new Set();
  const lines = Object.freeze(baseLines.concat(acquisitionLines, storyBeatLines).filter((line) => {
    if (knownLines.has(line)) return false;
    knownLines.add(line);
    return true;
  }));
  if (!lines.length) return null;
  const presentation = EVENT_PRESENTATION[event?.type];
  const captionMode = presentation?.captionMode ?? CAPTION_MODES.dialogue;
  const beats = presentationBeats(lines, event, captionMode);
  const durationMs = beats.at(-1)?.timing.endMs ?? 0;
  return Object.freeze({
    eventType: event.type,
    title: presentation?.title ?? "심연 기록",
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
