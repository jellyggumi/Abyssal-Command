import { AUDIO_CUES } from "./defense-catalog.js";

const MAX_AUDIO_NODES = 64;
const MAX_TRANSIENT_NODES = 48;
const MAX_ACTIVE_VOICES = 12;
const MASTER_GAIN = 0.055;
const SILENCE = 0.0001;
const MAX_FEEDBACK_EVENT_KEYS = 128;
const MAX_NARRATION_CHARS = 240;
const MAX_STORY_NARRATION_CHARS = 96;
const STORY_NARRATION_PRIORITY = 76;
const AMBIENT_NARRATION_PRIORITY = 45;
const CRITICAL_AUDIO_PRIORITY = 80;
const MAX_ACTIVE_NARRATIONS = 8;
const MAX_STORY_NARRATION_KEYS = 32;

const tone = (waveform, frequency, endFrequency, duration, gain, delay = 0, attack = 0.008) =>
  Object.freeze({ waveform, frequency, endFrequency, duration, gain, delay, attack });

const syntheticCue = (id, waveform, frequency, duration) =>
  Object.freeze({ id, waveform, frequency, duration, synthesized: true });

const SYNTHETIC_CUES = Object.freeze({
  inputAccepted: syntheticCue("input-accepted", "sine", 360, 0.08),
  inputRejected: syntheticCue("input-rejected", "square", 110, 0.09),
  attackWindup: syntheticCue("attack-windup", "sawtooth", 180, 0.11),
  blockContact: syntheticCue("block-contact", "triangle", 140, 0.1),
  attackMiss: syntheticCue("attack-miss", "sine", 190, 0.08),
  interruptAlert: syntheticCue("interrupt-alert", "square", 92, 0.13),
  warningPulse: syntheticCue("warning-pulse", "sawtooth", 170, 0.2),
  objectiveWaypoint: syntheticCue("objective-waypoint", "sine", 300, 0.24),
  objectiveComplete: syntheticCue("objective-complete", "triangle", 260, 0.28),
  bossPhase: syntheticCue("boss-phase", "sawtooth", 82, 0.42),
  deathRetry: syntheticCue("death-retry", "triangle", 146, 0.34),
});

const byId = Object.freeze(Object.fromEntries(
  [...Object.values(AUDIO_CUES), ...Object.values(SYNTHETIC_CUES)].map((cue) => [cue.id, cue]),
));

const NARRATION_VOICE_HINTS = Object.freeze(["ko-KR", "ko_KR", "Korean"]);
const NARRATION_VOICE_PROFILES = Object.freeze({
  narrator: Object.freeze({
    hints: Object.freeze([]),
    settings: Object.freeze({ rate: 0.92, pitch: 0.88, volume: 0.86 }),
  }),
  keeper: Object.freeze({
    hints: Object.freeze(["sora", "sunhi", "yuna", "female"]),
    settings: Object.freeze({ rate: 0.86, pitch: 0.98, volume: 0.84 }),
  }),
  antagonist: Object.freeze({
    hints: Object.freeze(["minsu", "inhyeok", "male"]),
    settings: Object.freeze({ rate: 0.82, pitch: 0.72, volume: 0.9 }),
  }),
  warden: Object.freeze({
    hints: Object.freeze(["minsu", "hyun", "male"]),
    settings: Object.freeze({ rate: 0.88, pitch: 0.82, volume: 0.88 }),
  }),
});
const NARRATION_STAGE_TUNING = Object.freeze({
  "cinder-span": Object.freeze({ rate: 0.02, pitch: 0.02 }),
  "abyss-chancel": Object.freeze({ rate: -0.02, pitch: -0.02 }),
  "echo-throne": Object.freeze({ rate: -0.04, pitch: -0.04 }),
});
const koreanVoice = (voice) => NARRATION_VOICE_HINTS.some((hint) =>
  `${voice?.lang || ""} ${voice?.name || ""}`.includes(hint)
) || String(voice?.lang || "").toLowerCase().startsWith("ko");
const pickNarrationVoice = (voices = [], hints = []) => {
  const preferred = voices.filter(koreanVoice);
  const roleVoice = preferred.find((voice) => hints.some((hint) =>
    String(voice?.name || "").toLowerCase().includes(hint)
  ));
  return roleVoice || preferred[0] || voices[0] || null;
};

const CUE_PROFILES = Object.freeze({
  "stage-start": Object.freeze([
    tone("sine", 220, 330, 0.18, 0.16),
    tone("triangle", 330, 440, 0.22, 0.08, 0.045),
  ]),
  "enemy-defeated": Object.freeze([
    tone("triangle", 160, 72, 0.08, 0.13),
    tone("square", 82, 48, 0.055, 0.04),
  ]),
  "elite-extracted": Object.freeze([
    tone("sine", 420, 840, 0.32, 0.12),
    tone("triangle", 210, 420, 0.28, 0.07, 0.035),
    tone("sine", 630, 945, 0.22, 0.045, 0.11),
  ]),
  "item-collected": Object.freeze([
    tone("sine", 560, 780, 0.2, 0.11),
    tone("triangle", 840, 1120, 0.14, 0.055, 0.04),
  ]),
  "growth-offer": Object.freeze([
    tone("triangle", 320, 400, 0.24, 0.1),
    tone("sine", 480, 640, 0.2, 0.055, 0.055),
  ]),
  "skill-cast": Object.freeze([
    tone("sawtooth", 260, 92, 0.14, 0.085),
    tone("square", 520, 260, 0.075, 0.035, 0.012),
  ]),
  "boss-spawned": Object.freeze([
    tone("sawtooth", 90, 45, 0.5, 0.085, 0, 0.025),
    tone("triangle", 135, 67.5, 0.56, 0.065, 0.035, 0.025),
    tone("sine", 45, 36, 0.62, 0.07, 0.08, 0.03),
  ]),
  terminal: Object.freeze([
    tone("sine", 120, 60, 0.5, 0.1, 0, 0.02),
    tone("triangle", 180, 90, 0.42, 0.055, 0.05, 0.02),
  ]),
  "movement-step": Object.freeze([
    tone("triangle", 92, 72, 0.045, 0.035, 0, 0.004),
  ]),
  "weapon-fire": Object.freeze([
    tone("square", 310, 155, 0.055, 0.045, 0, 0.004),
    tone("triangle", 465, 232.5, 0.04, 0.025, 0.008, 0.003),
  ]),
  "impact-hit": Object.freeze([
    tone("sawtooth", 118, 52, 0.07, 0.075, 0, 0.004),
    tone("square", 59, 42, 0.045, 0.035),
  ]),
  "critical-hit": Object.freeze([
    tone("square", 480, 720, 0.12, 0.09, 0, 0.004),
    tone("sine", 720, 960, 0.1, 0.045, 0.025, 0.004),
  ]),
  "extraction-ready": Object.freeze([
    tone("sine", 360, 540, 0.22, 0.08),
    tone("triangle", 180, 270, 0.18, 0.04, 0.04),
  ]),
  "occupation-captured": Object.freeze([
    tone("triangle", 240, 360, 0.18, 0.075),
    tone("sine", 120, 240, 0.2, 0.04, 0.035),
  ]),
  // Free-orbit camera boundary tick (control-feel-20260725.md §3.3 item 2 /
  // §3.5): a single very short, low-volume descending click that says "you
  // hit the wall" without demanding a visual overlay over the moving 3D
  // world. Gain 0.03 is deliberately below impact-hit's 0.075 so a boundary
  // push never competes with combat feedback for attention.
  "camera-clamp": Object.freeze([
    tone("sawtooth", 90, 60, 0.035, 0.03, 0, 0.004),
  ]),
  "input-accepted": Object.freeze([
    tone("sine", 360, 480, 0.08, 0.04, 0, 0.004),
  ]),
  "input-rejected": Object.freeze([
    tone("square", 110, 70, 0.09, 0.045, 0, 0.004),
  ]),
  "attack-windup": Object.freeze([
    tone("sawtooth", 180, 260, 0.11, 0.045, 0, 0.006),
  ]),
  "block-contact": Object.freeze([
    tone("triangle", 140, 92, 0.1, 0.05, 0, 0.004),
  ]),
  "attack-miss": Object.freeze([
    tone("sine", 190, 120, 0.08, 0.026, 0, 0.004),
  ]),
  "interrupt-alert": Object.freeze([
    tone("square", 92, 54, 0.13, 0.055, 0, 0.006),
    tone("triangle", 184, 92, 0.1, 0.028, 0.02, 0.004),
  ]),
  "warning-pulse": Object.freeze([
    tone("sawtooth", 170, 85, 0.2, 0.055, 0, 0.012),
    tone("sine", 255, 127.5, 0.16, 0.025, 0.035, 0.008),
  ]),
  "objective-waypoint": Object.freeze([
    tone("sine", 300, 450, 0.24, 0.065),
    tone("triangle", 450, 600, 0.18, 0.032, 0.045),
  ]),
  "objective-complete": Object.freeze([
    tone("triangle", 260, 520, 0.28, 0.075),
    tone("sine", 390, 780, 0.22, 0.038, 0.05),
  ]),
  "boss-phase": Object.freeze([
    tone("sawtooth", 82, 55, 0.42, 0.065, 0, 0.02),
    tone("triangle", 123, 82, 0.38, 0.038, 0.045, 0.018),
  ]),
  "death-retry": Object.freeze([
    tone("triangle", 146, 219, 0.34, 0.065),
    tone("sine", 219, 328.5, 0.28, 0.032, 0.055),
  ]),
});

const CUE_VARIANTS = Object.freeze({
  "growth-offer:SKILL_SELECTED": Object.freeze([
    tone("triangle", 400, 600, 0.18, 0.1),
    tone("sine", 600, 800, 0.16, 0.05, 0.035),
  ]),
  "extraction-ready:EXTRACTION_PROGRESS": Object.freeze([
    tone("sine", 280, 320, 0.09, 0.04),
  ]),
  "occupation-captured:OCCUPATION_PROGRESS": Object.freeze([
    tone("triangle", 180, 210, 0.09, 0.035),
  ]),
  "impact-hit:PICKUP_DENIED": Object.freeze([
    tone("square", 76, 42, 0.08, 0.045),
  ]),
  // STANCE_SWITCH_BLOCKED reuses PICKUP_DENIED's exact profile — same "action rejected" semantic
  // (control-feel-20260725.md §2.1: "의미가 동일하다 — '지금은 안 됨'").
  "impact-hit:STANCE_SWITCH_BLOCKED": Object.freeze([
    tone("square", 76, 42, 0.08, 0.045),
  ]),
  "terminal:REWARD_SELECTED": Object.freeze([
    tone("sine", 240, 480, 0.2, 0.095),
    tone("triangle", 360, 720, 0.16, 0.045, 0.035),
  ]),
  "terminal:TERMINAL:DEFEAT": Object.freeze([
    tone("sawtooth", 110, 41, 0.55, 0.08, 0, 0.025),
    tone("sine", 55, 34, 0.62, 0.065, 0.04, 0.025),
  ]),
  "terminal:TERMINAL:VICTORY": Object.freeze([
    tone("sine", 120, 240, 0.46, 0.1),
    tone("triangle", 180, 360, 0.4, 0.055, 0.055),
  ]),
  "terminal:TERMINAL:FINAL_COMPLETION": Object.freeze([
    tone("sine", 120, 480, 0.58, 0.1),
    tone("triangle", 180, 720, 0.52, 0.055, 0.055),
    tone("sine", 240, 960, 0.46, 0.035, 0.11),
  ]),
});

const feedbackPolicy = (cueId, priority, category) =>
  Object.freeze({ cueId, priority, category, intentionalSilence: false });
const silentPolicy = (category) =>
  Object.freeze({ cueId: null, priority: 0, category, intentionalSilence: true });

export const AUDIO_EVENT_POLICY = Object.freeze({
  STAGE_STARTED: feedbackPolicy("stage-start", 72, "stage"),
  INPUT_ACCEPTED: feedbackPolicy("input-accepted", 34, "input"),
  INPUT_REJECTED: feedbackPolicy("input-rejected", 48, "input"),
  MOVE: silentPolicy("movement"),
  BASIC_ATTACK: feedbackPolicy("attack-windup", 34, "windup"),
  WEAPON_FIRED: feedbackPolicy("attack-windup", 32, "windup"),
  MELEE_SWEEP: feedbackPolicy("attack-windup", 35, "windup"),
  MIDBOSS_SPAWNED: feedbackPolicy("warning-pulse", 82, "boss"),
  SKILL_CAST: feedbackPolicy("skill-cast", 42, "windup"),
  BOSS_ATTACK_TELEGRAPHED: feedbackPolicy("warning-pulse", 86, "warning"),
  BOSS_ATTACK_CANCELLED: feedbackPolicy("attack-miss", 44, "miss"),
  ENEMY_ATTACK: feedbackPolicy("impact-hit", 46, "contact"),
  PROJECTILE_IMPACT: feedbackPolicy("impact-hit", 45, "contact"),
  MELEE_IMPACT: feedbackPolicy("impact-hit", 47, "contact"),
  PROJECTILE_BLOCKED: feedbackPolicy("block-contact", 52, "block"),
  PROJECTILE_EXPIRED: feedbackPolicy("attack-miss", 28, "miss"),
  CRITICAL_HIT: feedbackPolicy(AUDIO_CUES.criticalHit.id, 82, "damage"),
  SKILL_RESOLVED_DAMAGE: feedbackPolicy("impact-hit", 58, "damage"),
  COMMANDER_DAMAGED: feedbackPolicy("impact-hit", 74, "damage"),
  COMPANION_DAMAGED: feedbackPolicy("impact-hit", 70, "damage"),
  GATE_BREACHED: feedbackPolicy("impact-hit", 76, "damage"),
  HAZARD_DAMAGE: feedbackPolicy("impact-hit", 72, "damage"),
  COMPANION_DOWNED: feedbackPolicy("interrupt-alert", 78, "interrupt"),
  COMMANDER_DOWNED: feedbackPolicy("terminal", 98, "death"),
  OCCUPATION_INTERRUPTED: feedbackPolicy("interrupt-alert", 74, "interrupt"),
  EXTRACTION_INTERRUPTED: feedbackPolicy("interrupt-alert", 76, "interrupt"),
  EXTRACTION_REJECTED: feedbackPolicy("input-rejected", 62, "interrupt"),
  PICKUP_DENIED: feedbackPolicy("input-rejected", 50, "block"),
  ECHO_DENIED: feedbackPolicy("input-rejected", 50, "block"),
  OBJECTIVE_FAILED: feedbackPolicy("interrupt-alert", 84, "warning"),
  ENCOUNTER_OBJECTIVE_FAILED: feedbackPolicy("interrupt-alert", 84, "warning"),
  OBJECTIVE_PRESSURE_PULSE: feedbackPolicy("warning-pulse", 80, "warning"),
  OBJECTIVE_PRESSURE_DEADLINE: feedbackPolicy("warning-pulse", 88, "warning"),
  WAVE_VARIANT_STARTED: feedbackPolicy("warning-pulse", 64, "warning"),
  ITEM_COLLECTED: feedbackPolicy("item-collected", 56, "pickup"),
  TERRAIN_RECOVERY: feedbackPolicy("item-collected", 54, "pickup"),
  ENEMY_DEFEATED: feedbackPolicy("enemy-defeated", 36, "contact"),
  ELITE_CANDIDATE_AVAILABLE: feedbackPolicy("extraction-ready", 66, "objective"),
  EXTRACTION_WINDOW_OPENED: feedbackPolicy("objective-waypoint", 68, "objective"),
  OCCUPATION_PROGRESS: feedbackPolicy("occupation-captured", 40, "objective"),
  OCCUPATION_CAPTURED: feedbackPolicy("occupation-captured", 64, "objective"),
  EXTRACTION_PROGRESS: feedbackPolicy("extraction-ready", 42, "objective"),
  EXTRACTION_COMPLETED: feedbackPolicy("elite-extracted", 72, "objective"),
  ELITE_EXTRACTED: feedbackPolicy("elite-extracted", 74, "objective"),
  OBJECTIVE_PHASE_CHANGED: feedbackPolicy("objective-waypoint", 60, "waypoint"),
  ENCOUNTER_OBJECTIVE_STARTED: feedbackPolicy("objective-waypoint", 60, "waypoint"),
  OBJECTIVE_COMPLETED: feedbackPolicy("objective-complete", 64, "objective"),
  ENCOUNTER_OBJECTIVE_COMPLETED: feedbackPolicy("objective-complete", 64, "objective"),
  WAVE_CLEARED: feedbackPolicy("objective-complete", 58, "objective"),
  GROWTH_OFFER: feedbackPolicy("growth-offer", 58, "pickup"),
  SKILL_SELECTED: feedbackPolicy("growth-offer", 56, "input"),
  STANCE_SWITCHED: feedbackPolicy("occupation-captured", 52, "input"),
  STANCE_SWITCH_BLOCKED: feedbackPolicy("input-rejected", 54, "input"),
  REWARD_SELECTED: feedbackPolicy("terminal", 70, "input"),
  BOSS_SPAWNED: feedbackPolicy("boss-spawned", 90, "boss"),
  BOSS_RALLY_WINDOW: feedbackPolicy("boss-phase", 88, "boss"),
  RETRY_STARTED: feedbackPolicy("death-retry", 94, "retry"),
  RUN_RETRIED: feedbackPolicy("death-retry", 94, "retry"),
  TERMINAL: feedbackPolicy("terminal", 100, "terminal"),
  ENEMY_SPAWNED: silentPolicy("spawn"),
  ENEMY_POLICY_SELECTED: silentPolicy("policy"),
  SKILL_COOLDOWN_SET: silentPolicy("cooldown"),
  SKILL_COOLDOWN_READY: silentPolicy("cooldown"),
  ESCORT_LEADER_ACQUIRED: silentPolicy("policy"),
  ENEMY_PRESSURE_DELAYED: silentPolicy("policy"),
});


const CUE_REFRACTORY_SECONDS = Object.freeze({
  "movement-step": 0.07,
  "weapon-fire": 0.04,
  "impact-hit": 0.045,
  "enemy-defeated": 0.06,
  "item-collected": 0.08,
  "extraction-ready": 0.12,
  "occupation-captured": 0.12,
  "critical-hit": 0.1,
  // 0.15s keeps a continuous pitch/zoom push against the clamp from
  // buzzing (onPointerMove fires many times per second) while still giving
  // a crisp single tick on first contact (control-feel-20260725.md §3.3).
  "camera-clamp": 0.15,
  "input-accepted": 0.06,
  "input-rejected": 0.1,
  "attack-windup": 0.12,
  "block-contact": 0.05,
  "attack-miss": 0.08,
  "interrupt-alert": 0.12,
  "warning-pulse": 0.35,
  "objective-waypoint": 0.3,
  "objective-complete": 0.2,
  "boss-phase": 0.5,
  "death-retry": 0.5,
});

const AMBIENCE_LAYERS = Object.freeze([
  Object.freeze({ waveform: "sine", frequency: 29, gain: 0.055 }),
  Object.freeze({ waveform: "triangle", frequency: 43.5, gain: 0.018 }),
]);

const MUSIC_LAYERS = Object.freeze([
  Object.freeze({ waveform: "sine", frequency: 55, gain: 0.045 }),
  Object.freeze({ waveform: "triangle", frequency: 82.41, gain: 0.022 }),
  Object.freeze({ waveform: "sine", frequency: 123.47, gain: 0.012 }),
]);

const DEFAULT_SOUNDSCAPE_STAGE = "cinder-span";
const SOUNDSCAPE_RAMP_SECONDS = 0.35;
const STAGE_SOUNDSCAPES = Object.freeze({
  "cinder-span": Object.freeze({
    ambience: Object.freeze([
      Object.freeze({ waveform: "sawtooth", frequency: 29 }),
      Object.freeze({ waveform: "triangle", frequency: 43.5 }),
    ]),
    music: Object.freeze([
      Object.freeze({ waveform: "sawtooth", frequency: 55 }),
      Object.freeze({ waveform: "square", frequency: 82.41 }),
      Object.freeze({ waveform: "triangle", frequency: 123.47 }),
    ]),
  }),
  "abyss-chancel": Object.freeze({
    ambience: Object.freeze([
      Object.freeze({ waveform: "sine", frequency: 36.71 }),
      Object.freeze({ waveform: "sine", frequency: 55 }),
    ]),
    music: Object.freeze([
      Object.freeze({ waveform: "sine", frequency: 73.42 }),
      Object.freeze({ waveform: "triangle", frequency: 110 }),
      Object.freeze({ waveform: "sine", frequency: 164.81 }),
    ]),
  }),
  "echo-throne": Object.freeze({
    ambience: Object.freeze([
      Object.freeze({ waveform: "sine", frequency: 24.5 }),
      Object.freeze({ waveform: "sawtooth", frequency: 36.71 }),
    ]),
    music: Object.freeze([
      Object.freeze({ waveform: "sine", frequency: 49 }),
      Object.freeze({ waveform: "sawtooth", frequency: 73.42 }),
      Object.freeze({ waveform: "triangle", frequency: 98 }),
    ]),
  }),
});
const SOUNDSCAPE_STATES = Object.freeze({
  descent: Object.freeze({ ambienceGain: 0.72, musicGain: 0.42, pitch: 0.82 }),
  "active-wave": Object.freeze({ ambienceGain: 1, musicGain: 1, pitch: 1 }),
  "objective-pressure": Object.freeze({ ambienceGain: 1.12, musicGain: 1.18, pitch: 1.12 }),
  boss: Object.freeze({ ambienceGain: 0.86, musicGain: 1.36, pitch: 0.68 }),
  victory: Object.freeze({ ambienceGain: 0.5, musicGain: 0.72, pitch: 1.5 }),
  defeat: Object.freeze({ ambienceGain: 0.38, musicGain: 0.5, pitch: 0.55 }),
});

export function audioSoundscapeForEvent(
  event,
  currentState = "descent",
  currentStageId = DEFAULT_SOUNDSCAPE_STAGE,
) {
  const stageId = Object.hasOwn(STAGE_SOUNDSCAPES, event?.stageId)
    ? event.stageId
    : currentStageId;
  switch (event?.type) {
    case "STAGE_STARTED":
    case "RETRY_STARTED":
    case "RUN_RETRIED":
      return Object.freeze({ stageId, state: "descent" });
    case "TERMINAL":
      return Object.freeze({
        stageId,
        state: event.outcome === "DEFEAT" ? "defeat" : "victory",
      });
    case "BOSS_SPAWNED":
    case "BOSS_RALLY_WINDOW":
      return Object.freeze({ stageId, state: "boss" });
    case "OBJECTIVE_PHASE_CHANGED":
      return Object.freeze({
        stageId,
        state: event.objectiveId === "boss-kill" ? "boss" : "active-wave",
      });
    case "OBJECTIVE_PRESSURE_PULSE":
    case "OBJECTIVE_PRESSURE_DEADLINE":
    case "OBJECTIVE_FAILED":
      if (currentState === "boss" || currentState === "victory" || currentState === "defeat") return null;
      return Object.freeze({ stageId, state: "objective-pressure" });
    case "ENEMY_SPAWNED":
    case "WAVE_VARIANT_STARTED":
      if (currentState !== "descent" && currentState !== "active-wave") return null;
      return Object.freeze({ stageId, state: "active-wave" });
    case "WAVE_CLEARED":
    case "OBJECTIVE_COMPLETED":
      if (currentState !== "objective-pressure") return null;
      return Object.freeze({ stageId, state: "active-wave" });
    default:
      return null;
  }
}

const persistentLayerTarget = (kind, index, stageId, state) => {
  const stage = STAGE_SOUNDSCAPES[stageId] ?? STAGE_SOUNDSCAPES[DEFAULT_SOUNDSCAPE_STAGE];
  const stateMix = SOUNDSCAPE_STATES[state] ?? SOUNDSCAPE_STATES.descent;
  const baseLayers = kind === "ambience" ? AMBIENCE_LAYERS : MUSIC_LAYERS;
  const stageLayer = stage[kind][index] ?? stage[kind][0];
  const baseLayer = baseLayers[index] ?? baseLayers[0];
  const gainScale = kind === "ambience" ? stateMix.ambienceGain : stateMix.musicGain;
  return {
    waveform: stageLayer.waveform,
    frequency: Math.max(20, stageLayer.frequency * stateMix.pitch),
    gain: baseLayer.gain * gainScale,
  };
};

const prefersReducedMotion = () => {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
};

const safePromise = (value) => value?.catch?.(() => undefined);

const STORY_NARRATION_EVENT_TYPES = new Set([
  "STAGE_STARTED",
  "OCCUPATION_CAPTURED",
  "BOSS_SPAWNED",
  "OBJECTIVE_COMPLETED",
  "EXTRACTION_COMPLETED",
  "TERMINAL",
]);
const FEEDBACK_EVENT_TYPES = new Set(["LORE_SURPRISE_RESOLVED", ...Object.keys(AUDIO_EVENT_POLICY)]);

const storyNarrationEligible = (event) => STORY_NARRATION_EVENT_TYPES.has(event?.type)
  && (event.type !== "OBJECTIVE_COMPLETED"
    || event.objectiveId === "boss-kill"
    || event.storyBeat?.kind === "questCompletion");

const conciseKoreanLine = (value) => {
  if (typeof value !== "string") return "";
  const lines = value.split(/\r?\n/);
  for (const source of lines) {
    let line = source
      .replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    const speakerDivider = line.search(/[:：]/u);
    if (speakerDivider > 0 && speakerDivider < 40) line = line.slice(speakerDivider + 1).trim();
    if (!/[가-힣]/u.test(line)) continue;
    const sentenceEnd = line.search(/[.!?。！？](?:\s|$)/u);
    const sentence = sentenceEnd >= 0 ? line.slice(0, sentenceEnd + 1) : line;
    return sentence.slice(0, MAX_STORY_NARRATION_CHARS).trim();
  }
  return "";
};

const narrationLineFrom = (value, seen = new Set()) => {
  if (typeof value === "string") return conciseKoreanLine(value);
  if (!value || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const line = narrationLineFrom(entry, seen);
      if (line) return line;
    }
    return "";
  }
  for (const key of ["voiceLine", "text", "line", "dialogue", "lines"]) {
    const line = narrationLineFrom(value[key], seen);
    if (line) return line;
  }
  return "";
};

const storyNarrationText = (event) => {
  if (!storyNarrationEligible(event)) return "";
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
    const line = narrationLineFrom(source);
    if (line) return line;
  }
  return "";
};

const narrationText = (event) => {
  const storyLine = storyNarrationText(event);
  if (storyLine) return storyLine;
  if (event?.type !== "LORE_SURPRISE_RESOLVED" || typeof event.text !== "string") return "";
  return event.text.trim().slice(0, MAX_NARRATION_CHARS);
};

const narrationVoiceProfile = (event) => {
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
    beat?.kind,
  ].filter((value) => typeof value === "string").join(" ").toLowerCase();
  let name = "narrator";
  if (/dusk warden|commander|player|황혼/u.test(metadata)) {
    name = "warden";
  } else if (/questacquisition|lookout|keeper|quest.?giver|감시/u.test(metadata)) {
    name = "keeper";
  } else if (/bossentry|occupationreversal|antagonist|tactician|sovereign|cinder warden|boss/u.test(metadata)) {
    name = "antagonist";
  } else if (storyNarrationText(event)
    && ["OBJECTIVE_COMPLETED", "EXTRACTION_COMPLETED", "TERMINAL"].includes(event?.type)) {
    name = "warden";
  }
  const profile = NARRATION_VOICE_PROFILES[name];
  const storyStageId = typeof beat?.id === "string" ? beat.id.split(":")[0] : null;
  const stageId = event?.stageId || beat?.event?.stageId || storyStageId;
  const tuning = NARRATION_STAGE_TUNING[stageId] || {};
  return Object.freeze({
    name,
    hints: profile.hints,
    settings: Object.freeze({
      rate: Math.max(0.7, Math.min(1.1, profile.settings.rate + (tuning.rate || 0))),
      pitch: Math.max(0.55, Math.min(1.15, profile.settings.pitch + (tuning.pitch || 0))),
      volume: profile.settings.volume,
    }),
  });
};

const feedbackEventKey = (event) => {
  if (!FEEDBACK_EVENT_TYPES.has(event?.type) && !byId[event?.cue]) return null;
  if (event?.eventId) return `event:${event.eventId}`;
  return JSON.stringify([
    event?.version ?? "",
    event?.tick ?? "",
    event?.eventSequence ?? "",
    event?.type ?? "",
    event?.inputId ?? "",
    event?.entityId ?? "",
    event?.enemyId ?? "",
    event?.sourceId ?? "",
    event?.targetId ?? "",
    event?.projectileId ?? "",
    event?.itemId ?? "",
    event?.rewardId ?? "",
    event?.skillId ?? "",
    event?.objectiveId ?? "",
    event?.bossId ?? "",
    event?.companionId ?? "",
    event?.pickupId ?? "",
    event?.tableId ?? "",
    event?.outcomeId ?? "",
    event?.outcome ?? "",
    event?.phase ?? "",
    event?.policyId ?? "",
    event?.source ?? "",
    event?.reason ?? "",
    event?.damage ?? "",
    event?.pulse ?? "",
    event?.storyBeat?.id ?? "",
    event?.quest?.questId ?? "",
    narrationText(event),
  ]);
};

export function audioCueForEvent(event) {
  const policy = AUDIO_EVENT_POLICY[event?.type];
  const storyText = storyNarrationText(event);
  if (storyText) {
    return Object.freeze({
      eventType: event.type,
      method: "narrate",
      cueId: policy?.intentionalSilence ? null : policy?.cueId ?? null,
      priority: STORY_NARRATION_PRIORITY,
      category: "story-narration",
      intentionalSilence: false,
    });
  }
  if (event?.type === "LORE_SURPRISE_RESOLVED") {
    return Object.freeze({
      eventType: event.type,
      method: "narrate",
      cueId: null,
      priority: AMBIENT_NARRATION_PRIORITY,
      category: "narration",
      intentionalSilence: false,
    });
  }
  if (policy) {
    return Object.freeze({
      eventType: event.type,
      method: policy.intentionalSilence ? "silent" : "play",
      ...policy,
    });
  }
  const catalogCue = typeof event?.cue === "string" && byId[event.cue] ? event.cue : null;
  return catalogCue
    ? Object.freeze({
      eventType: event?.type ?? null,
      method: "play",
      cueId: catalogCue,
      priority: 40,
      category: "catalog",
      intentionalSilence: false,
    })
    : null;
}

const variantKey = (cueId, event) => {
  if (event?.type === "TERMINAL" && event.outcome) return `${cueId}:TERMINAL:${event.outcome}`;
  return event?.type ? `${cueId}:${event.type}` : "";
};

const cueRefractoryKey = (cueId, event) => {
  const category = AUDIO_EVENT_POLICY[event?.type]?.category || event?.type || "catalog";
  const family = cueId === "impact-hit" && (category === "contact" || category === "damage")
    ? "hit"
    : category;
  return `${cueId}:${family}`;
};

const fallbackProfile = (cue) => Object.freeze([
  tone(cue.waveform || "sine", cue.frequency || 220, Math.max(20, (cue.frequency || 220) * 0.75), cue.duration || 0.1, 0.08),
]);

const setParam = (param, method, value, at) => {
  if (typeof param?.[method] === "function") param[method](value, at);
  else if (param) param.value = value;
};

const stopNode = (node) => {
  try { node?.stop?.(); } catch { /* oscillator already stopped */ }
  try { node?.disconnect?.(); } catch { /* optional Web Audio failure */ }
};

const disconnectNode = (node) => {
  try { node?.disconnect?.(); } catch { /* optional Web Audio failure */ }
};


export class DefenseAudio {
  constructor({
    reducedMotion = prefersReducedMotion(),
    muted = false,
    volume = 1,
  } = {}) {
    this.context = null;
    this.master = null;
    this.sfxBus = null;
    this.ambienceBus = null;
    this.musicBus = null;
    this.started = false;
    this.reducedMotion = Boolean(reducedMotion);
    this.muted = Boolean(muted);
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    this.paused = false;
    this.backgrounded = false;
    this.nodes = new Set();
    this.transientNodes = new Set();
    this.stoppableNodes = new Set();
    this.activeVoices = new Set();
    this.ambienceVoices = [];
    this.musicVoices = [];
    this.lastCueAt = new Map();
    this.feedbackEventKeys = new Set();
    this.lastFeedbackTick = null;
    this.activeNarrations = new Set();
    this.narrationPriorities = new Map();
    this.activeNarrationPriority = 0;
    this.storyNarrationKeys = new Set();
    this.visibilityTarget = null;
    this.windowTarget = null;
    this.onVisibilityChange = () => {
      const hidden = this.visibilityTarget?.hidden === true
        || this.visibilityTarget?.visibilityState === "hidden";
      if (hidden) this.suspendForBackground();
      else this.resumeFromBackground();
    };
    this.onWindowBlur = () => this.suspendForBackground();
    this.onWindowFocus = () => {
      const hidden = this.visibilityTarget?.hidden === true
        || this.visibilityTarget?.visibilityState === "hidden";
      if (!hidden) this.resumeFromBackground();
    };
    this.onUserGesture = () => this.unlock();
    this.soundscapeStageId = DEFAULT_SOUNDSCAPE_STAGE;
    this.soundscapeState = "descent";
  }
  applyMasterGain() {
    if (!this.master?.gain) return;
    const value = this.muted ? 0 : MASTER_GAIN * this.volume;
    setParam(this.master.gain, "setValueAtTime", value, this.context?.currentTime ?? 0);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.applyMasterGain();
    if (this.muted) {
      this.stopTransientVoices();
      this.stopNarration();
    } else {
      this.unlock();
    }
    return this.muted;
  }

  setVolume(volume) {
    const numeric = Number(volume);
    if (!Number.isFinite(numeric)) return this.volume;
    this.volume = Math.max(0, Math.min(1, numeric));
    this.applyMasterGain();
    return this.volume;
  }

  attachLifecycle() {
    const target = globalThis.document;
    const windowTarget = globalThis.window;
    if (this.visibilityTarget === target && this.windowTarget === windowTarget) return;
    this.detachLifecycle();
    this.visibilityTarget = target;
    this.windowTarget = windowTarget;
    target?.addEventListener?.("visibilitychange", this.onVisibilityChange);
    target?.addEventListener?.("pointerdown", this.onUserGesture);
    target?.addEventListener?.("keydown", this.onUserGesture);
    windowTarget?.addEventListener?.("blur", this.onWindowBlur);
    windowTarget?.addEventListener?.("focus", this.onWindowFocus);
    this.onVisibilityChange();
  }

  detachLifecycle() {
    this.visibilityTarget?.removeEventListener?.("visibilitychange", this.onVisibilityChange);
    this.visibilityTarget?.removeEventListener?.("pointerdown", this.onUserGesture);
    this.visibilityTarget?.removeEventListener?.("keydown", this.onUserGesture);
    this.windowTarget?.removeEventListener?.("blur", this.onWindowBlur);
    this.windowTarget?.removeEventListener?.("focus", this.onWindowFocus);
    this.visibilityTarget = null;
    this.windowTarget = null;
  }

  unlock() {
    if (!this.started || this.muted || this.paused || this.backgrounded
      || !this.context || this.context.state === "closed") return false;
    if (this.context.state !== "suspended") return true;
    try {
      safePromise(this.context.resume?.());
      return true;
    } catch {
      return false;
    }
  }

  suspendForBackground() {
    if (this.backgrounded) {
      this.stopNarration();
      return false;
    }
    this.backgrounded = true;
    this.stopTransientVoices();
    this.stopNarration();
    try { safePromise(this.context?.suspend?.()); } catch { /* optional Web Audio failure */ }
    return true;
  }

  resumeFromBackground() {
    if (!this.backgrounded) return false;
    const hidden = this.visibilityTarget?.hidden === true
      || this.visibilityTarget?.visibilityState === "hidden";
    if (hidden) return false;
    this.backgrounded = false;
    this.unlock();
    return true;
  }

  pause() {
    if (this.paused) return true;
    this.paused = true;
    this.stopTransientVoices();
    this.stopNarration();
    try { safePromise(this.context?.suspend?.()); } catch { /* optional Web Audio failure */ }
    return true;
  }

  resume() {
    if (this.paused) this.paused = false;
    this.unlock();
    if (!this.reducedMotion && !this.backgrounded) {
      this.startAmbience();
      this.startBattleMusic();
    }
    return true;
  }

  resetRun() {
    this.stopNarration();
    this.stopTransientVoices();
    this.feedbackEventKeys.clear();
    this.storyNarrationKeys.clear();
    this.lastCueAt.clear();
    this.lastFeedbackTick = null;
    return true;
  }

  register(node, { transient = false, stoppable = false } = {}) {
    if (!node) return node;
    this.nodes.add(node);
    if (transient) this.transientNodes.add(node);
    if (stoppable) this.stoppableNodes.add(node);
    return node;
  }

  release(node) {
    this.nodes.delete(node);
    this.transientNodes.delete(node);
    this.stoppableNodes.delete(node);
    disconnectNode(node);
  }

  createBus(gainValue, destination) {
    const bus = this.register(this.context.createGain());
    bus.gain.value = gainValue;
    bus.connect(destination);
    return bus;
  }

  start() {
    if (this.started) {
      this.unlock();
      return true;
    }
    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) return false;
    try {
      this.context = new AudioContextCtor();
      this.master = this.register(this.context.createGain());
      this.applyMasterGain();
      this.master.connect(this.context.destination);
      this.sfxBus = this.createBus(1, this.master);
      this.ambienceBus = this.createBus(0.32, this.master);
      this.musicBus = this.createBus(0.26, this.master);
      this.started = true;
      this.attachLifecycle();
      this.unlock();
      if (!this.reducedMotion && !this.paused && !this.backgrounded) {
        this.startAmbience();
        this.startBattleMusic();
      }
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  startPersistentLayer(layer, destination, kind, index) {
    if (!this.context || !destination || this.nodes.size + 2 > MAX_AUDIO_NODES) return null;
    let oscillator = null;
    let gain = null;
    try {
      oscillator = this.register(this.context.createOscillator(), { stoppable: true });
      gain = this.register(this.context.createGain());
      oscillator.type = layer.waveform;
      oscillator.frequency.value = layer.frequency;
      gain.gain.value = layer.gain;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      return { oscillator, gain, kind, index };
    } catch {
      stopNode(oscillator);
      this.release(oscillator);
      this.release(gain);
      return null;
    }
  }

  startAmbience() {
    if (!this.started || this.paused || this.backgrounded || this.reducedMotion || this.ambienceVoices.length) return;
    AMBIENCE_LAYERS.forEach((_, index) => {
      try {
        const layer = persistentLayerTarget("ambience", index, this.soundscapeStageId, this.soundscapeState);
        const voice = this.startPersistentLayer(layer, this.ambienceBus, "ambience", index);
        if (voice) this.ambienceVoices.push(voice);
      } catch {
        // A partial ambience layer must never block the battle.
      }
    });
  }

  startBattleMusic() {
    if (!this.started || this.paused || this.backgrounded || this.reducedMotion || this.musicVoices.length) return;
    MUSIC_LAYERS.forEach((_, index) => {
      try {
        const layer = persistentLayerTarget("music", index, this.soundscapeStageId, this.soundscapeState);
        const voice = this.startPersistentLayer(layer, this.musicBus, "music", index);
        if (voice) this.musicVoices.push(voice);
      } catch {
        // Battle music is optional and may fail independently of micro-cues.
      }
    });
  }

  applySoundscape() {
    if (!this.context || this.context.state === "closed") return;
    const now = this.context.currentTime;
    const end = now + SOUNDSCAPE_RAMP_SECONDS;
    for (const voice of [...this.ambienceVoices, ...this.musicVoices]) {
      const target = persistentLayerTarget(
        voice.kind,
        voice.index,
        this.soundscapeStageId,
        this.soundscapeState,
      );
      voice.oscillator.type = target.waveform;
      setParam(voice.oscillator.frequency, "setValueAtTime", Math.max(20, voice.oscillator.frequency.value), now);
      setParam(voice.oscillator.frequency, "exponentialRampToValueAtTime", target.frequency, end);
      setParam(voice.gain.gain, "setValueAtTime", Math.max(SILENCE, voice.gain.gain.value), now);
      setParam(voice.gain.gain, "linearRampToValueAtTime", target.gain, end);
    }
  }

  setSoundscape(state, stageId = this.soundscapeStageId) {
    const nextState = Object.hasOwn(SOUNDSCAPE_STATES, state) ? state : "descent";
    const nextStageId = Object.hasOwn(STAGE_SOUNDSCAPES, stageId)
      ? stageId
      : this.soundscapeStageId;
    if (nextState === this.soundscapeState && nextStageId === this.soundscapeStageId) return false;
    this.soundscapeState = nextState;
    this.soundscapeStageId = nextStageId;
    this.applySoundscape();
    return true;
  }

  stopVoices(voices) {
    voices.splice(0).forEach(({ oscillator, gain }) => {
      stopNode(oscillator);
      this.release(oscillator);
      this.release(gain);
    });
  }

  stopAmbience() {
    this.stopVoices(this.ambienceVoices);
  }

  stopBattleMusic() {
    this.stopVoices(this.musicVoices);
  }

  stopVoice(voice) {
    if (!voice || voice.released) return;
    voice.released = true;
    this.activeVoices.delete(voice);
    voice.nodes.splice(0).forEach((node) => {
      stopNode(node);
      this.release(node);
    });
    voice.remaining = 0;
  }

  stopTransientVoices() {
    [...this.activeVoices].forEach((voice) => this.stopVoice(voice));
  }

  makeRoomForVoice(requiredNodes, priority) {
    if (requiredNodes > MAX_TRANSIENT_NODES) return false;
    while (
      this.activeVoices.size >= MAX_ACTIVE_VOICES
      || this.transientNodes.size + requiredNodes > MAX_TRANSIENT_NODES
      || this.nodes.size + requiredNodes > MAX_AUDIO_NODES
    ) {
      const candidate = [...this.activeVoices].sort((left, right) =>
        left.priority - right.priority || left.startedAt - right.startedAt
      )[0];
      if (!candidate || candidate.priority >= priority) return false;
      this.stopVoice(candidate);
    }
    return true;
  }

  lookup(cueId, event = null) {
    const cue = byId[cueId];
    if (!cue) return null;
    const profile = CUE_VARIANTS[variantKey(cueId, event)] || CUE_PROFILES[cueId] || fallbackProfile(cue);
    return { cue, profile };
  }

  play(cueId, event = null) {
    const resolved = this.lookup(cueId, event);
    if (
      !resolved
      || !this.context
      || !this.sfxBus
      || this.context.state === "closed"
      || this.muted
      || this.paused
      || this.backgrounded
    ) return false;
    const priority = AUDIO_EVENT_POLICY[event?.type]?.priority
      ?? (cueId === "camera-clamp" ? 5 : 40);
    if (priority >= CRITICAL_AUDIO_PRIORITY && this.activeNarrationPriority < priority) {
      this.stopNarration();
    }
    const now = this.context.currentTime;
    const refractory = CUE_REFRACTORY_SECONDS[cueId] || 0;
    const refractoryKey = cueRefractoryKey(cueId, event);
    const lastPlayedAt = this.lastCueAt.get(refractoryKey);
    if (refractory && Number.isFinite(lastPlayedAt) && now - lastPlayedAt < refractory) return false;
    const requiredNodes = resolved.profile.length * 2;
    if (!this.makeRoomForVoice(requiredNodes, priority)) return false;

    const voice = {
      remaining: resolved.profile.length,
      nodes: [],
      priority,
      startedAt: now,
      released: false,
    };
    try {
      resolved.profile.forEach((layer) => {
        const oscillator = this.register(this.context.createOscillator(), { transient: true, stoppable: true });
        voice.nodes.push(oscillator);
        const gain = this.register(this.context.createGain(), { transient: true });
        voice.nodes.push(gain);
        const begins = now + layer.delay;
        const ends = begins + layer.duration;
        oscillator.type = layer.waveform;
        setParam(oscillator.frequency, "setValueAtTime", layer.frequency, begins);
        setParam(oscillator.frequency, "exponentialRampToValueAtTime", Math.max(20, layer.endFrequency), ends);
        setParam(gain.gain, "setValueAtTime", SILENCE, begins);
        setParam(gain.gain, "linearRampToValueAtTime", layer.gain, begins + Math.min(layer.attack, layer.duration / 2));
        setParam(gain.gain, "exponentialRampToValueAtTime", SILENCE, ends);
        oscillator.connect(gain).connect(this.sfxBus);
        oscillator.addEventListener?.("ended", () => {
          if (voice.released) return;
          this.release(oscillator);
          this.release(gain);
          voice.nodes = voice.nodes.filter((node) => node !== oscillator && node !== gain);
          voice.remaining -= 1;
          if (voice.remaining <= 0) {
            voice.released = true;
            this.activeVoices.delete(voice);
          }
        }, { once: true });
        oscillator.start(begins);
        oscillator.stop(ends);
      });
      this.activeVoices.add(voice);
      this.lastCueAt.set(refractoryKey, now);
      if (this.context.state === "suspended") safePromise(this.context.resume?.());
      return true;
    } catch {
      this.stopVoice(voice);
      return false;
    }
  }

  rememberFeedbackEvent(event) {
    const key = feedbackEventKey(event);
    if (!key) return true;
    if (this.feedbackEventKeys.has(key)) return false;
    this.feedbackEventKeys.add(key);
    if (this.feedbackEventKeys.size > MAX_FEEDBACK_EVENT_KEYS) {
      this.feedbackEventKeys.delete(this.feedbackEventKeys.values().next().value);
    }
    return true;
  }
  rememberStoryNarration(event) {
    const key = feedbackEventKey(event);
    if (!key) return true;
    if (this.storyNarrationKeys.has(key)) return false;
    if (this.storyNarrationKeys.size >= MAX_STORY_NARRATION_KEYS) return false;
    this.storyNarrationKeys.add(key);
    return true;
  }



  updateActiveNarrationPriority() {
    this.activeNarrationPriority = 0;
    for (const priority of this.narrationPriorities.values()) {
      this.activeNarrationPriority = Math.max(this.activeNarrationPriority, priority);
    }
  }

  narrate(event, priority = AMBIENT_NARRATION_PRIORITY) {
    const text = narrationText(event);
    const story = Boolean(storyNarrationText(event));
    const speech = globalThis.speechSynthesis;
    const Utterance = globalThis.SpeechSynthesisUtterance;
    if (!text || this.muted || this.paused || this.backgrounded
      || typeof speech?.speak !== "function" || typeof Utterance !== "function") return false;
    if (this.activeNarrations.size) {
      if (priority > this.activeNarrationPriority) {
        this.stopNarration();
      } else if (!story || priority < this.activeNarrationPriority) {
        return false;
      }
    } else if (!story && (speech.speaking || speech.pending)) {
      return false;
    }
    if (this.activeNarrations.size >= MAX_ACTIVE_NARRATIONS) {
      // Keep the earliest authored milestones in native speech order.
      return false;
    }
    let utterance = null;
    try {
      const profile = narrationVoiceProfile(event);
      utterance = new Utterance(text);
      const voices = typeof speech.getVoices === "function" ? speech.getVoices() : [];
      const voice = pickNarrationVoice(voices, profile.hints);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "ko-KR";
      utterance.rate = profile.settings.rate;
      utterance.pitch = profile.settings.pitch;
      utterance.volume = profile.settings.volume * this.volume;
      const release = () => {
        if (!this.activeNarrations.delete(utterance)) return;
        this.narrationPriorities.delete(utterance);
        this.updateActiveNarrationPriority();
      };
      utterance.onend = release;
      utterance.onerror = release;
      this.activeNarrations.add(utterance);
      this.narrationPriorities.set(utterance, priority);
      this.updateActiveNarrationPriority();
      speech.speak(utterance);
      return true;
    } catch {
      this.activeNarrations.delete(utterance);
      this.narrationPriorities.delete(utterance);
      this.updateActiveNarrationPriority();
      return false;
    }
  }

  stopNarration() {
    const hadActiveNarration = this.activeNarrations.size > 0;
    this.activeNarrations.clear();
    this.narrationPriorities.clear();
    this.activeNarrationPriority = 0;
    if (hadActiveNarration) {
      try { globalThis.speechSynthesis?.cancel?.(); } catch { /* optional speech synthesis failure */ }
    }
  }

  consume(events = []) {
    if (!Array.isArray(events)) return;
    let feedbackTick = null;
    let startsNewRunAtTickZero = false;
    for (const event of events) {
      if (Number.isFinite(event?.tick)) {
        feedbackTick = feedbackTick === null ? event.tick : Math.max(feedbackTick, event.tick);
      }
      if (event?.type === "STAGE_STARTED" && event.tick === 0) {
        const key = feedbackEventKey(event);
        startsNewRunAtTickZero ||= !key
          || (!this.feedbackEventKeys.has(key) && !this.storyNarrationKeys.has(key));
      }
    }
    const resetFeedbackDeduplication = startsNewRunAtTickZero && this.lastFeedbackTick !== null;
    if (resetFeedbackDeduplication) {
      this.stopNarration();
      this.feedbackEventKeys.clear();
      this.storyNarrationKeys.clear();
      this.lastCueAt.clear();
      this.lastFeedbackTick = null;
    }
    const batchStoryKeys = new Set();
    const fresh = events
      .map((event, index) => ({
        event,
        index,
        audioCue: audioCueForEvent(event),
        key: feedbackEventKey(event),
      }))
      .filter(({ event, audioCue, key }) => {
        if (!audioCue
          || (audioCue.category !== "story-narration"
            && Number.isFinite(event?.tick)
            && this.lastFeedbackTick !== null
            && event.tick < this.lastFeedbackTick)) return false;
        if (audioCue.category === "story-narration") {
          if (key && (this.storyNarrationKeys.has(key)
            || batchStoryKeys.has(key))) return false;
          if (key && this.storyNarrationKeys.size + batchStoryKeys.size
            >= MAX_STORY_NARRATION_KEYS) {
            return false;
          }
          if (key) batchStoryKeys.add(key);
          return true;
        }
        return this.rememberFeedbackEvent(event);
      });
    for (const { event } of fresh) {
      const transition = audioSoundscapeForEvent(
        event,
        this.soundscapeState,
        this.soundscapeStageId,
      );
      if (transition) this.setSoundscape(transition.state, transition.stageId);
    }
    const batchMaxPriority = fresh.reduce(
      (maximum, { audioCue }) => Math.max(maximum, audioCue.priority),
      0,
    );
    const ordered = fresh.sort(
      (left, right) => right.audioCue.priority - left.audioCue.priority || left.index - right.index,
    );
    ordered.forEach(({ event, audioCue }) => {
      if (audioCue.method === "play" || (audioCue.method === "narrate" && audioCue.cueId)) {
        this.play(audioCue.cueId, event);
      }
    });
    ordered.forEach(({ event, audioCue }) => {
      if (audioCue.method !== "narrate") return;
      if (batchMaxPriority < CRITICAL_AUDIO_PRIORITY
        || audioCue.priority >= batchMaxPriority) {
        const startedNarration = this.narrate(event, audioCue.priority);
        if (audioCue.category === "story-narration" && startedNarration) {
          this.rememberStoryNarration(event);
        }
      }
    });
    if (feedbackTick !== null) {
      this.lastFeedbackTick = Math.max(this.lastFeedbackTick ?? feedbackTick, feedbackTick);
    }
  }

  stop() {
    this.detachLifecycle();
    this.stopNarration();
    this.stopTransientVoices();
    this.stopBattleMusic();
    this.stopAmbience();
    [...this.stoppableNodes].forEach(stopNode);
    [...this.nodes].forEach(disconnectNode);
    try { safePromise(this.context?.close?.()); } catch { /* already closed */ }
    this.activeVoices.clear();
    this.lastCueAt.clear();
    this.feedbackEventKeys.clear();
    this.storyNarrationKeys.clear();
    this.lastFeedbackTick = null;
    this.stoppableNodes.clear();
    this.transientNodes.clear();
    this.nodes.clear();
    this.musicVoices.length = 0;
    this.ambienceVoices.length = 0;
    this.musicBus = null;
    this.ambienceBus = null;
    this.sfxBus = null;
    this.master = null;
    this.context = null;
    this.started = false;
    this.paused = false;
    this.backgrounded = false;
    this.soundscapeStageId = DEFAULT_SOUNDSCAPE_STAGE;
    this.soundscapeState = "descent";
  }

  debugMetrics() {
    return {
      nodes: this.nodes.size,
      transientNodes: this.transientNodes.size,
      voices: this.activeVoices.size,
      started: this.started,
      reducedMotion: this.reducedMotion,
      muted: this.muted,
      paused: this.paused,
      backgrounded: this.backgrounded,
      volume: this.volume,
      soundscapeStageId: this.soundscapeStageId,
      soundscapeState: this.soundscapeState,
      maxNodes: MAX_AUDIO_NODES,
      maxVoices: MAX_ACTIVE_VOICES,
      feedbackEvents: this.feedbackEventKeys.size,
      narrations: this.activeNarrations.size,
      narrationPriority: this.activeNarrationPriority,
      narrationQueue: Math.max(0, this.activeNarrations.size - 1),
      storyNarrations: this.storyNarrationKeys.size,
    };
  }
}
