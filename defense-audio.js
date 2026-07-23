import { AUDIO_CUES } from "./defense-catalog.js";

const byId = Object.freeze(Object.fromEntries(Object.values(AUDIO_CUES).map((cue) => [cue.id, cue])));

const MAX_AUDIO_NODES = 64;
const MAX_TRANSIENT_NODES = 48;
const SILENCE = 0.0001;
const MAX_FEEDBACK_EVENT_KEYS = 128;
const MAX_NARRATION_CHARS = 240;

const tone = (waveform, frequency, endFrequency, duration, gain, delay = 0, attack = 0.008) =>
  Object.freeze({ waveform, frequency, endFrequency, duration, gain, delay, attack });

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

const EVENT_CUE_IDS = Object.freeze({
  STAGE_STARTED: "stage-start",
  MOVE: "movement-step",
  WEAPON_FIRED: "weapon-fire",
  PROJECTILE_IMPACT: "impact-hit",
  ENEMY_ATTACK: "weapon-fire",
  CRITICAL_HIT: AUDIO_CUES.criticalHit.id,
  GATE_BREACHED: "impact-hit",
  OCCUPATION_CAPTURED: "occupation-captured",
  OCCUPATION_PROGRESS: "occupation-captured",
  OCCUPATION_INTERRUPTED: "impact-hit",
  EXTRACTION_PROGRESS: "extraction-ready",
  EXTRACTION_COMPLETED: "elite-extracted",
  EXTRACTION_REJECTED: "impact-hit",
  EXTRACTION_INTERRUPTED: "impact-hit",
  HAZARD_DAMAGE: "impact-hit",
  COMMANDER_DAMAGED: "impact-hit",
  PICKUP_DENIED: "impact-hit",
  ECHO_DENIED: "impact-hit",
  OBJECTIVE_FAILED: "impact-hit",
  ENEMY_DEFEATED: "enemy-defeated",
  ELITE_CANDIDATE_AVAILABLE: "extraction-ready",
  ELITE_EXTRACTED: "elite-extracted",
  ITEM_COLLECTED: "item-collected",
  TERRAIN_RECOVERY: "item-collected",
  GROWTH_OFFER: "growth-offer",
  SKILL_SELECTED: "growth-offer",
  SKILL_CAST: "skill-cast",
  BOSS_SPAWNED: "boss-spawned",
  TERMINAL: "terminal",
  REWARD_SELECTED: "terminal",
});

const CUE_REFRACTORY_SECONDS = Object.freeze({
  "movement-step": 0.07,
  "weapon-fire": 0.025,
  "impact-hit": 0.025,
  "extraction-ready": 0.12,
  "occupation-captured": 0.12,
  "critical-hit": 0.1,
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

const prefersReducedMotion = () => {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
};

const safePromise = (value) => value?.catch?.(() => undefined);

const FEEDBACK_EVENT_TYPES = new Set(["CRITICAL_HIT", "LORE_SURPRISE_RESOLVED"]);

const feedbackEventKey = (event) => {
  if (!FEEDBACK_EVENT_TYPES.has(event?.type)) return null;
  return [
    event.type,
    event.tick ?? 0,
    event.entityId ?? "",
    event.targetId ?? "",
    event.tableId ?? "",
    event.outcomeId ?? "",
    event.source ?? "",
    event.damage ?? "",
    event.text ?? "",
  ].join(":");
};

const narrationText = (event) => {
  if (event?.type !== "LORE_SURPRISE_RESOLVED" || typeof event.text !== "string") return "";
  return event.text.trim().slice(0, MAX_NARRATION_CHARS);
};

const variantKey = (cueId, event) => {
  if (event?.type === "TERMINAL" && event.outcome) return `${cueId}:TERMINAL:${event.outcome}`;
  return event?.type ? `${cueId}:${event.type}` : "";
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
  constructor({ reducedMotion = prefersReducedMotion() } = {}) {
    this.context = null;
    this.master = null;
    this.sfxBus = null;
    this.ambienceBus = null;
    this.musicBus = null;
    this.started = false;
    this.reducedMotion = Boolean(reducedMotion);
    this.nodes = new Set();
    this.transientNodes = new Set();
    this.stoppableNodes = new Set();
    this.activeVoices = new Set();
    this.ambienceVoices = [];
    this.musicVoices = [];
    this.lastCueAt = new Map();
    this.feedbackEventKeys = new Set();
    this.activeNarrations = new Set();
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
    if (this.started) return true;
    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) return false;
    try {
      this.context = new AudioContextCtor();
      this.master = this.register(this.context.createGain());
      this.master.gain.value = 0.055;
      this.master.connect(this.context.destination);
      this.sfxBus = this.createBus(1, this.master);
      this.ambienceBus = this.createBus(0.32, this.master);
      this.musicBus = this.createBus(0.26, this.master);
      this.started = true;
      safePromise(this.context.resume?.());
      if (!this.reducedMotion) {
        this.startAmbience();
        this.startBattleMusic();
      }
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  startPersistentLayer(layer, destination) {
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
      return { oscillator, gain };
    } catch {
      stopNode(oscillator);
      this.release(oscillator);
      this.release(gain);
      return null;
    }
  }

  startAmbience() {
    if (!this.started || this.reducedMotion || this.ambienceVoices.length) return;
    AMBIENCE_LAYERS.forEach((layer) => {
      try {
        const voice = this.startPersistentLayer(layer, this.ambienceBus);
        if (voice) this.ambienceVoices.push(voice);
      } catch {
        // A partial ambience layer must never block the battle.
      }
    });
  }

  startBattleMusic() {
    if (!this.started || this.reducedMotion || this.musicVoices.length) return;
    MUSIC_LAYERS.forEach((layer) => {
      try {
        const voice = this.startPersistentLayer(layer, this.musicBus);
        if (voice) this.musicVoices.push(voice);
      } catch {
        // Battle music is optional and may fail independently of micro-cues.
      }
    });
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

  lookup(cueId, event = null) {
    const cue = byId[cueId];
    if (!cue) return null;
    const profile = CUE_VARIANTS[variantKey(cueId, event)] || CUE_PROFILES[cueId] || fallbackProfile(cue);
    return { cue, profile };
  }

  play(cueId, event = null) {
    const resolved = this.lookup(cueId, event);
    if (!resolved || !this.context || !this.sfxBus || this.context.state === "closed") return false;
    const now = this.context.currentTime;
    const refractory = CUE_REFRACTORY_SECONDS[cueId] || 0;
    const lastPlayedAt = this.lastCueAt.get(cueId);
    if (refractory && Number.isFinite(lastPlayedAt) && now - lastPlayedAt < refractory) return false;
    const requiredNodes = resolved.profile.length * 2;
    if (
      requiredNodes > MAX_TRANSIENT_NODES
      || this.transientNodes.size + requiredNodes > MAX_TRANSIENT_NODES
      || this.nodes.size + requiredNodes > MAX_AUDIO_NODES
    ) return false;

    const voice = { remaining: resolved.profile.length, nodes: [] };
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
          this.release(oscillator);
          this.release(gain);
          voice.remaining -= 1;
          if (voice.remaining <= 0) this.activeVoices.delete(voice);
        }, { once: true });
        oscillator.start(begins);
        oscillator.stop(ends);
      });
      this.activeVoices.add(voice);
      this.lastCueAt.set(cueId, now);
      safePromise(this.context.resume?.());
      return true;
    } catch {
      voice.nodes.forEach((node) => {
        stopNode(node);
        this.release(node);
      });
      this.activeVoices.delete(voice);
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

  narrate(event) {
    const text = narrationText(event);
    const speech = globalThis.speechSynthesis;
    const Utterance = globalThis.SpeechSynthesisUtterance;
    if (
      !text
      || typeof speech?.speak !== "function"
      || typeof Utterance !== "function"
      || speech.speaking
      || speech.pending
      || this.activeNarrations.size
    ) return false;
    try {
      const utterance = new Utterance(text);
      const release = () => this.activeNarrations.delete(utterance);
      utterance.onend = release;
      utterance.onerror = release;
      this.activeNarrations.add(utterance);
      speech.speak(utterance);
      return true;
    } catch {
      this.activeNarrations.clear();
      return false;
    }
  }

  stopNarration() {
    if (!this.activeNarrations.size) return;
    try { globalThis.speechSynthesis?.cancel?.(); } catch { /* optional speech synthesis failure */ }
    this.activeNarrations.clear();
  }

  consume(events = []) {
    if (!Array.isArray(events)) return;
    events.forEach((event) => {
      if (!this.rememberFeedbackEvent(event)) return;
      if (event?.type === "LORE_SURPRISE_RESOLVED") {
        this.narrate(event);
        return;
      }
      const cueId = event?.type === "CRITICAL_HIT"
        ? AUDIO_CUES.criticalHit.id
        : EVENT_CUE_IDS[event?.type] || event?.cue;
      if (cueId) this.play(cueId, event);
    });
  }

  stop() {
    this.stopNarration();
    this.stopBattleMusic();
    this.stopAmbience();
    [...this.stoppableNodes].forEach(stopNode);
    [...this.nodes].forEach(disconnectNode);
    try { safePromise(this.context?.close?.()); } catch { /* already closed */ }
    this.activeVoices.clear();
    this.lastCueAt.clear();
    this.feedbackEventKeys.clear();
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
  }

  debugMetrics() {
    return {
      nodes: this.nodes.size,
      transientNodes: this.transientNodes.size,
      voices: this.activeVoices.size,
      started: this.started,
      reducedMotion: this.reducedMotion,
      maxNodes: MAX_AUDIO_NODES,
      feedbackEvents: this.feedbackEventKeys.size,
      narrations: this.activeNarrations.size,
    };
  }
}
