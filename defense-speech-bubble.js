/**
 * World-space speech bubbles — the visual replacement for spoken narration.
 *
 * Narration used to reach the player through `speechSynthesis` inside
 * defense-audio.js. That path was inaudible under a muted tab, unavailable
 * without a Korean system voice, and impossible to attach to the speaker's body
 * in the 3D scene. This module owns the same *editorial* contract (which events
 * speak, in what order, deduplicated how, preempted by what) but resolves each
 * beat to `{ text, speaker, anchor }` so app.js can draw it as a bubble over the
 * actual actor instead.
 *
 * Two layers, deliberately split:
 *
 *  - Pure resolvers (`speechBubbleTextFor`, `speechBubbleSpeakerFor`,
 *    `speechBubbleFor`) — no DOM, no clock, no audio. Testable in plain Node and
 *    reusable by any presenter.
 *  - `SpeechBubbleDirector` — the queue: priority, dedup, concurrency cap, hold
 *    timing. Owns *when* a bubble is live; owns nothing about how it looks.
 *
 * Why this is not a method on DefenseAudio: bubbles have the inverse lifecycle
 * to speech. Muting audio must NOT hide a bubble — a muted player needs the text
 * more, not less — while pausing must freeze bubbles rather than discard them.
 * Hanging them off `narrate()` would have inherited exactly the wrong gates.
 */

const MAX_BUBBLE_CHARS = 140;
const MAX_ACTIVE_BUBBLES = 3;
const MIN_HOLD_MS = 2200;
const MAX_HOLD_MS = 5200;
const HOLD_PER_CHAR_MS = 58;
const HOLD_BASE_MS = 1500;

/**
 * Story milestones that carry authored dialogue. Mirrors
 * defense-audio.js's STORY_NARRATION_EVENT_TYPES: the two sets must stay equal
 * so a beat can never earn a voice cue without also earning a bubble.
 */
export const SPEECH_BUBBLE_EVENT_TYPES = Object.freeze(new Set([
  "STAGE_STARTED",
  "OCCUPATION_CAPTURED",
  "BOSS_SPAWNED",
  "OBJECTIVE_COMPLETED",
  "EXTRACTION_COMPLETED",
  "TERMINAL",
]));

export const SPEECH_BUBBLE_PRIORITY = Object.freeze({ story: 76, ambient: 45 });

/**
 * Role → visual identity. `anchorKind` tells the presenter which projection to
 * use, because the three anchor classes live in three different renderer
 * collections (see resolveAnchor below).
 */
const SPEAKER_ROLES = Object.freeze({
  narrator: Object.freeze({ role: "narrator", label: "심연의 기록", anchorKind: "none" }),
  keeper: Object.freeze({ role: "keeper", label: "감시자", anchorKind: "stage-npc" }),
  antagonist: Object.freeze({ role: "antagonist", label: "적", anchorKind: "entity" }),
  warden: Object.freeze({ role: "warden", label: "황혼의 파수꾼", anchorKind: "commander" }),
});

export const speechBubbleEligible = (event) => SPEECH_BUBBLE_EVENT_TYPES.has(event?.type)
  && (event.type !== "OBJECTIVE_COMPLETED"
    || event.objectiveId === "boss-kill"
    || event.storyBeat?.kind === "questCompletion");

/**
 * Normalize an authored line for display.
 *
 * Differs from the speech path's `conciseKoreanLine` in two deliberate ways:
 * the `speaker:` prefix is *returned* rather than discarded (a bubble labels its
 * speaker instead of impersonating one), and the whole line survives instead of
 * being truncated at the first sentence — a bubble can hold two sentences that
 * a synthesized voice could not without dragging.
 */
export const speechBubbleLine = (value) => {
  if (typeof value !== "string") return null;
  for (const source of value.split(/\r?\n/)) {
    const line = source
      .replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (!line) continue;
    const divider = line.search(/[:：]/u);
    const hasPrefix = divider > 0 && divider < 40;
    const prefix = hasPrefix ? line.slice(0, divider).trim() : "";
    const body = hasPrefix ? line.slice(divider + 1).trim() : line;
    if (!/[가-힣]/u.test(body)) continue;
    return { speaker: prefix || null, text: body.slice(0, MAX_BUBBLE_CHARS).trim() };
  }
  return null;
};

/**
 * Depth-first walk for the first displayable line. Mirrors the key order the
 * audio extractor used (`voiceLine`, `text`, `line`, `dialogue`, `lines`) so
 * both paths select the same line out of the same authored beat, but carries the
 * authored `speaker` sibling out with it.
 */
const lineFrom = (value, seen = new Set()) => {
  if (typeof value === "string") return speechBubbleLine(value);
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = lineFrom(entry, seen);
      if (found) return found;
    }
    return null;
  }
  for (const key of ["voiceLine", "text", "line", "dialogue", "lines"]) {
    const found = lineFrom(value[key], seen);
    if (found) {
      // An authored `speaker` sibling outranks a prefix parsed out of the text.
      const authored = typeof value.speaker === "string" ? value.speaker.trim() : "";
      return authored ? { ...found, speaker: authored } : found;
    }
  }
  return null;
};

export const speechBubbleTextFor = (event) => {
  if (!speechBubbleEligible(event)) {
    if (event?.type !== "LORE_SURPRISE_RESOLVED" || typeof event.text !== "string") return null;
    const line = speechBubbleLine(event.text);
    return line ? { ...line, speaker: line.speaker, story: false } : null;
  }
  const sources = [
    event?.storyBeat?.voiceLine,
    event?.storyBeat?.dialogue,
    event?.storyBeat?.cutscene,
    event?.voiceLine,
    event?.dialogue,
    event?.storyDialogue,
    event?.cutscene,
    event?.type === "STAGE_STARTED" ? event?.quest?.acquisitionDialogue : null,
  ];
  for (const source of sources) {
    const line = lineFrom(source);
    if (line) return { ...line, story: true };
  }
  return null;
};

/**
 * Role classification. Reuses the audio profile's regex ladder verbatim so a
 * bubble and its (now removed) voice would always have agreed on who is
 * speaking; keeping them identical means the ladder has one definition to audit.
 */
export const speechBubbleSpeakerFor = (event, authoredSpeaker = null) => {
  const beat = event?.storyBeat;
  const voiced = beat?.voiceLine && typeof beat.voiceLine === "object" ? beat.voiceLine : null;
  const dialogue = beat?.dialogue && typeof beat.dialogue === "object" ? beat.dialogue : null;
  const metadata = [
    event?.voiceRole,
    event?.speakerRole,
    voiced?.role,
    voiced?.speaker,
    dialogue?.role,
    dialogue?.speaker,
    authoredSpeaker,
    beat?.kind,
  ].filter((value) => typeof value === "string").join(" ").toLowerCase();

  let role = "narrator";
  if (/dusk warden|commander|player|황혼/u.test(metadata)) {
    role = "warden";
  } else if (/questacquisition|lookout|keeper|quest.?giver|감시/u.test(metadata)) {
    role = "keeper";
  } else if (/bossentry|occupationreversal|antagonist|tactician|sovereign|cinder warden|boss/u.test(metadata)) {
    role = "antagonist";
  } else if (speechBubbleEligible(event)
    && ["OBJECTIVE_COMPLETED", "EXTRACTION_COMPLETED", "TERMINAL"].includes(event?.type)) {
    role = "warden";
  }
  const profile = SPEAKER_ROLES[role];
  return Object.freeze({
    role,
    label: authoredSpeaker || profile.label,
    anchorKind: profile.anchorKind,
  });
};

/**
 * Which body the bubble hangs off.
 *
 * Three anchor classes because the renderer keeps its subjects in three places:
 * the commander and every combat entity are in `actors` (projectable by id),
 * stage NPCs are in `stageDecorRecords` (a separate collection — the reason
 * projectStageDecorToScreen exists), and the narrator has no body at all and
 * must fall back to the caption strip.
 *
 * The stage-NPC branch mirrors battle-realtime-three.js's own
 * `triggerStageNpcStoryBeat` lookup — same `npcId`-or-`questId` disjunction — so
 * a bubble and the NPC's story animation can never disagree about which body
 * they mean.
 */
const resolveAnchor = (event, speaker) => {
  if (speaker.anchorKind === "commander") return { kind: "entity", id: "commander" };
  if (speaker.anchorKind === "stage-npc") {
    const npcId = event?.quest?.questGiverNpcId ?? event?.quest?.giverNpcId ?? null;
    const questId = event?.quest?.questId ?? event?.quest?.id ?? null;
    if (npcId || questId) return { kind: "stage-npc", id: npcId, questId };
    return { kind: "none", id: null };
  }
  if (speaker.anchorKind === "entity") {
    // BOSS_SPAWNED carries the live boss id; other antagonist beats (a captured
    // occupation point taunting back, say) have no body on screen.
    const id = typeof event?.entityId === "string" ? event.entityId
      : typeof event?.bossId === "string" ? event.bossId
      : null;
    return id ? { kind: "entity", id } : { kind: "none", id: null };
  }
  return { kind: "none", id: null };
};

export const speechBubbleHoldMs = (text) => {
  const length = typeof text === "string" ? text.length : 0;
  return Math.min(MAX_HOLD_MS, Math.max(MIN_HOLD_MS, HOLD_BASE_MS + length * HOLD_PER_CHAR_MS));
};

/**
 * Full descriptor for one beat, or null when the event carries no displayable
 * line. This is the single function a presenter needs.
 */
export const speechBubbleFor = (event) => {
  const line = speechBubbleTextFor(event);
  if (!line?.text) return null;
  const speaker = speechBubbleSpeakerFor(event, line.speaker);
  const anchor = resolveAnchor(event, speaker);
  return Object.freeze({
    key: bubbleKey(event, line.text),
    eventType: event.type,
    text: line.text,
    speaker: speaker.label,
    role: speaker.role,
    anchor: Object.freeze(anchor),
    story: Boolean(line.story),
    priority: line.story ? SPEECH_BUBBLE_PRIORITY.story : SPEECH_BUBBLE_PRIORITY.ambient,
    holdMs: speechBubbleHoldMs(line.text),
  });
};

/**
 * Stable identity for dedup. `eventId` is unique per simulation emission, so it
 * is preferred; the composite fallback covers replayed or synthesized events
 * that carry no id, and includes the resolved text because two beats on the same
 * tick and type are only the same beat if they say the same thing.
 */
const bubbleKey = (event, text) => {
  if (event?.eventId) return `event:${event.eventId}`;
  return JSON.stringify([
    event?.type ?? "",
    event?.tick ?? "",
    event?.stageId ?? "",
    event?.storyBeat?.id ?? "",
    text,
  ]);
};

/**
 * Owns the live bubble set.
 *
 * Deliberately clock-injected rather than reading `performance.now()` directly:
 * hold expiry is the one behavior a test must be able to advance without
 * sleeping, and the same seam lets a paused simulation stop advancing bubbles
 * without the director knowing what "paused" means.
 */
export class SpeechBubbleDirector {
  constructor({ now = () => Date.now(), maxActive = MAX_ACTIVE_BUBBLES } = {}) {
    this.now = now;
    this.maxActive = maxActive;
    /** @type {Map<string, object>} live bubbles, insertion-ordered */
    this.active = new Map();
    /** @type {Set<string>} keys already shown, so a replayed snapshot is a no-op */
    this.shown = new Set();
    this.maxShownKeys = 32;
  }

  /**
   * Admit one event. Returns the bubble record if it became live, else null.
   *
   * Preemption rule matches the audio path it replaces: a strictly higher
   * priority clears lower-priority bubbles, equal priority queues behind
   * (bounded by maxActive), and lower priority is dropped rather than deferred —
   * an ambient lore line that lost its slot is stale by the time one frees up.
   */
  present(event) {
    const bubble = speechBubbleFor(event);
    if (!bubble) return null;
    if (this.shown.has(bubble.key)) return null;

    this.expire();

    if (this.active.size) {
      const highest = Math.max(...[...this.active.values()].map((entry) => entry.priority));
      if (bubble.priority > highest) {
        this.clear();
      } else if (bubble.priority < highest) {
        return null;
      }
    }
    if (this.active.size >= this.maxActive) return null;

    const record = { ...bubble, startedAt: this.now(), expiresAt: this.now() + bubble.holdMs };
    this.active.set(bubble.key, record);
    this.remember(bubble.key);
    return record;
  }

  /** Drop bubbles whose hold has elapsed. Returns the keys removed. */
  expire() {
    const nowMs = this.now();
    const dropped = [];
    for (const [key, record] of this.active) {
      if (record.expiresAt <= nowMs) {
        this.active.delete(key);
        dropped.push(key);
      }
    }
    return dropped;
  }

  /** Live bubbles, highest priority first, then oldest first. */
  list() {
    this.expire();
    return [...this.active.values()].sort((a, b) => b.priority - a.priority || a.startedAt - b.startedAt);
  }

  /**
   * Extend every live bubble by `deltaMs`. The presenter calls this while the
   * simulation is paused so a pause does not silently burn a beat's read time.
   */
  hold(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    for (const record of this.active.values()) record.expiresAt += deltaMs;
  }

  /** Dismiss everything live. Run identity memory survives, so a dismissed beat does not replay. */
  clear() {
    const dropped = [...this.active.keys()];
    this.active.clear();
    return dropped;
  }

  /** Full reset for a new run: live bubbles and the identity memory both go. */
  reset() {
    this.active.clear();
    this.shown.clear();
  }

  remember(key) {
    this.shown.add(key);
    if (this.shown.size > this.maxShownKeys) {
      const oldest = this.shown.values().next().value;
      this.shown.delete(oldest);
    }
  }

  debugMetrics() {
    this.expire();
    return {
      bubbles: this.active.size,
      bubbleKeys: this.shown.size,
      bubblePriority: this.active.size
        ? Math.max(...[...this.active.values()].map((entry) => entry.priority))
        : 0,
    };
  }
}
