// `slabMaterialAt` is the authored slab lookup, canonically homed in defense-catalog.js beside
// STAGE_SLABS (director ruling v9 R38 — NOT stage-world-catalog.js, which has no such export).
// It is a pure read of a frozen table: no simulation state, no RNG, first-match-wins seam
// ownership. Importing it here makes per-surface footsteps live without waiting on an app.js
// injection; setSurfaceResolver() remains available to override or disable it.
import { AUDIO_CUES, slabMaterialAt } from "./defense-catalog.js";

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
// Ring buffer of presented narration text. This is the observable seam that
// replaced `speechSynthesis.utterances` when narration became visual: it is the
// only way a test can assert WHICH beats the presentation channel accepted, in
// what order. Bounded because a long run would otherwise retain every line.
const MAX_PRESENTED_NARRATIONS = 16;
// Footstep cadence. The simulation already computes this exact interval for its own `cue` field
// (defense-run-simulation.js:2886 `run.tick % 12 === 0`); deriving the gate from `event.tick`
// mirrors it without reading `event.cue`, keeping AUDIO_EVENT_POLICY the sole event->cue
// authority. 60 / 12 = 5.00 steps/s while a direction is held, frame-rate independent.
const FOOTSTEP_TICK_INTERVAL = 12;
// Presentation-derived pre-expiry warning threshold. Shared derivation with app.js's
// BUFF_WARN_TICKS: one comparison, two consumers, so the buff strip and the sting cannot disagree.
const BUFF_WARN_TICKS = 180;

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
  dodgeSlip: syntheticCue("dodge-slip", "sine", 240, 0.045),
  dropAppear: syntheticCue("drop-appear", "sine", 520, 0.14),
  dropExpire: syntheticCue("drop-expire", "sine", 300, 0.16),
  buffApply: syntheticCue("buff-apply", "triangle", 300, 0.2),
  buffRefresh: syntheticCue("buff-refresh", "triangle", 330, 0.11),
  buffExpire: syntheticCue("buff-expire", "sine", 420, 0.17),
  buffWarning: syntheticCue("buff-warning", "sine", 360, 0.09),
  shadowArrival: syntheticCue("shadow-arrival", "sawtooth", 62, 0.34),
  gimmickArm: syntheticCue("gimmick-arm", "sawtooth", 128, 0.26),
  terrainDeform: syntheticCue("terrain-deform", "sawtooth", 84, 0.42),
  gimmickMirror: syntheticCue("gimmick-mirror", "sine", 740, 0.22),
  gimmickSettle: syntheticCue("gimmick-settle", "triangle", 168, 0.14),
});

const byId = Object.freeze(Object.fromEntries(
  [...Object.values(AUDIO_CUES), ...Object.values(SYNTHETIC_CUES)].map((cue) => [cue.id, cue]),
));


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
  // Dodge (§3.3). A dodged projectile previously played impact-hit, sounding exactly like a
  // landed hit while the renderer played `avoid`. Rising slip-past then a settling tail, so it
  // differs from attack-miss in contour, layer count and onset.
  "dodge-slip": Object.freeze([
    tone("sine", 240, 380, 0.045, 0.03, 0, 0.003),
    tone("triangle", 190, 128, 0.075, 0.02, 0.03, 0.004),
  ]),
  // Drop family (§4.2). Base is the `common` reading; rarity raises layer count 1->2->3->4 via
  // CUE_VARIANTS, so tier is audible by density rather than loudness alone.
  "drop-appear": Object.freeze([
    tone("sine", 520, 660, 0.14, 0.055, 0, 0.005),
  ]),
  "drop-expire": Object.freeze([
    tone("sine", 300, 210, 0.16, 0.038, 0, 0.006),
  ]),
  // Buff family (§4.3). buff-apply rises and buff-expire falls across the same register, so gain
  // and loss are inverses and readable without the HUD. buff-refresh is a shallow 20% rise
  // against apply's 50%.
  "buff-apply": Object.freeze([
    tone("triangle", 300, 450, 0.2, 0.07, 0, 0.006),
    tone("sine", 450, 600, 0.15, 0.034, 0.04, 0.005),
  ]),
  "buff-refresh": Object.freeze([
    tone("triangle", 330, 396, 0.11, 0.04, 0, 0.006),
  ]),
  "buff-expire": Object.freeze([
    tone("sine", 420, 264, 0.17, 0.042, 0, 0.005),
  ]),
  // Presentation-only cue (§4.4): no simulation event maps to it, exactly like camera-clamp.
  "buff-warning": Object.freeze([
    tone("sine", 360, 300, 0.09, 0.026, 0, 0.005),
  ]),
  // Spawn family (§4.5). SHADOW only; BASIC stays silent because 10 concurrent BASIC spawns
  // would consume 10 of 12 voices in one tick and starve every damage cue in the same batch.
  // 31-62Hz sub register, disjoint from warning-pulse's 170-255Hz, so a midboss reads as one
  // layered arrival rather than two competing stings.
  "shadow-arrival": Object.freeze([
    tone("sawtooth", 62, 41, 0.34, 0.062, 0, 0.018),
    tone("sine", 31, 26, 0.4, 0.048, 0.03, 0.022),
  ]),
  // Gimmick family (§4.6). gimmick-arm rises, terrain-deform falls into a sub: arm and fire are
  // inverses. terrain-deform is the only registry cue with three descending layers reaching 22Hz,
  // so it cannot be confused with boss-spawned (which also reaches 36Hz but rises in layer 3).
  "gimmick-arm": Object.freeze([
    tone("sawtooth", 128, 192, 0.26, 0.052, 0, 0.02),
    tone("sine", 64, 96, 0.3, 0.03, 0.03, 0.024),
  ]),
  "terrain-deform": Object.freeze([
    tone("sawtooth", 84, 36, 0.42, 0.08, 0, 0.008),
    tone("square", 42, 28, 0.36, 0.044, 0.02, 0.01),
    tone("sine", 28, 22, 0.5, 0.052, 0.05, 0.014),
  ]),
  "gimmick-mirror": Object.freeze([
    tone("sine", 740, 494, 0.22, 0.046, 0, 0.004),
    tone("triangle", 494, 370, 0.16, 0.026, 0.03, 0.004),
  ]),
  "gimmick-settle": Object.freeze([
    tone("triangle", 168, 126, 0.14, 0.034, 0, 0.008),
  ]),
});

// Buff stat differentiation (§4.3). Seven stats with one cue would be undifferentiated; rather
// than seven cue ids, buff-apply and buff-expire take a base-frequency scalar per stat. This table
// is the single source of truth — the 14 variant profiles below are derived from it, so a retune
// changes one number, not fourteen frozen arrays. That derivation is what made the defect below
// findable: hand-copied constants would have hidden a wrong scalar as a plausible number.
//
// moveSpeedBp is 1.53 and critChanceBp 1.72, which look arbitrary and are not. The originally
// authored 1.50 / 1.68 broke the design rule that adjacent scalars stay >= 12% apart:
// 1.50/1.35 = +11.11% was a real violation, and 1.68/1.50 is exactly +12% in decimal but
// 1.1199999999999999 in IEEE754, so even a literal `>= 1.12` check fails it. The remedy moved the
// NUMBERS to satisfy the rule rather than lowering the rule to fit the numbers, and deliberately
// kept basicDamage at exactly x1.00 as the reference — a clean equal-ratio ladder across all seven
// would have displaced it, which is worth more than uniform spacing. Minimum adjacent gap is now
// +12.42%. Any test on this table must use an epsilon (`>= 1.12 - 1e-9`), never a bare literal.
const BUFF_STAT_PITCH = Object.freeze({
  basicDamage: 1,
  gateMaxIntegrity: 0.75,
  pickupRange: 1.2,
  cooldownScaleBp: 1.35,
  moveSpeedBp: 1.53,
  critChanceBp: 1.72,
  incomingDamageBp: 0.85,
});

// Pitch-scales every layer of a profile while preserving envelope shape (duration, gain, delay,
// attack). Timbre and density carry meaning; only the register moves.
const pitchScaledProfile = (layers, scalar) => Object.freeze(layers.map((layer) => tone(
  layer.waveform,
  layer.frequency * scalar,
  layer.endFrequency * scalar,
  layer.duration,
  layer.gain,
  layer.delay,
  layer.attack,
)));

const buffStatVariants = (cueId, eventType) => Object.fromEntries(
  Object.entries(BUFF_STAT_PITCH).map(([stat, scalar]) => [
    `${cueId}:${eventType}:${stat}`,
    pitchScaledProfile(CUE_PROFILES[cueId], scalar),
  ]),
);

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
  // Damage-taken differentiation (§3.3). Four meanings previously shared one timbre. These are
  // variants on the existing impact-hit id, not new cues, so they add zero voices inside the
  // shared impact-hit:hit refractory family. COMPANION_DAMAGED deliberately keeps the base
  // profile, so the commander's own damage is distinguishable from an ally's.
  "impact-hit:COMMANDER_DAMAGED": Object.freeze([
    tone("sawtooth", 104, 46, 0.085, 0.078, 0, 0.004),
    tone("square", 52, 38, 0.055, 0.036, 0.01, 0.003),
  ]),
  "impact-hit:GATE_BREACHED": Object.freeze([
    tone("sawtooth", 76, 34, 0.11, 0.075, 0, 0.006),
    tone("sine", 38, 30, 0.13, 0.04, 0.02, 0.008),
  ]),
  "impact-hit:HAZARD_DAMAGE": Object.freeze([
    tone("triangle", 132, 58, 0.07, 0.07, 0, 0.005),
    tone("sawtooth", 66, 44, 0.05, 0.03, 0.012, 0.004),
  ]),
  // Per-surface footsteps (§2.2). Nine slab materials across twelve slabs; abyss-chancel
  // slab-01/02 share flagstone-oath and echo-throne 02/04 share fracture-glass (exact mirrors
  // about y=6000), so the timbre table is 9 entries, not 12 — a player crossing either mirrored
  // gallery must hear the same floor, because it is the same floor reflected.
  // All single-layer, all gain <= 0.040, all duration <= 0.060s: timbre carries the surface,
  // loudness never does. Adjacent materials within a stage differ in waveform AND by >= 25% in
  // base frequency, so a slab transition is audible without a visual cue.
  "movement-step:MOVE:basalt-ember": Object.freeze([
    tone("triangle", 92, 72, 0.045, 0.035, 0, 0.004),
  ]),
  "movement-step:MOVE:ash-drift": Object.freeze([
    tone("sine", 74, 58, 0.058, 0.026, 0, 0.01),
  ]),
  "movement-step:MOVE:forge-plate": Object.freeze([
    tone("square", 138, 104, 0.038, 0.032, 0, 0.003),
  ]),
  "movement-step:MOVE:flagstone-oath": Object.freeze([
    tone("triangle", 104, 80, 0.048, 0.034, 0, 0.004),
  ]),
  "movement-step:MOVE:oath-inlay": Object.freeze([
    tone("sine", 156, 117, 0.052, 0.028, 0, 0.006),
  ]),
  "movement-step:MOVE:vestry-tile": Object.freeze([
    tone("triangle", 124, 88, 0.04, 0.03, 0, 0.003),
  ]),
  "movement-step:MOVE:polished-echo": Object.freeze([
    tone("sine", 116, 92, 0.056, 0.032, 0, 0.005),
  ]),
  "movement-step:MOVE:gilt-compass": Object.freeze([
    tone("square", 174, 130, 0.036, 0.03, 0, 0.003),
  ]),
  "movement-step:MOVE:fracture-glass": Object.freeze([
    tone("sawtooth", 208, 148, 0.044, 0.028, 0, 0.002),
  ]),
  // Drop rarity (§4.2). Layer count rises 1->2->3->4 with tier, so rarity is audible by density
  // rather than by loudness. relic is the only drop cue carrying a sub octave. At 4 layers the
  // relic cue costs 8 nodes / 1 voice, well inside MAX_TRANSIENT_NODES.
  "drop-appear:DROP_SPAWNED:common": Object.freeze([
    tone("sine", 520, 660, 0.14, 0.055, 0, 0.005),
  ]),
  "drop-appear:DROP_SPAWNED:rare": Object.freeze([
    tone("sine", 560, 760, 0.17, 0.062, 0, 0.005),
    tone("triangle", 840, 1020, 0.11, 0.03, 0.035, 0.005),
  ]),
  "drop-appear:DROP_SPAWNED:resonant": Object.freeze([
    tone("sine", 620, 880, 0.21, 0.068, 0, 0.005),
    tone("triangle", 930, 1240, 0.14, 0.034, 0.04, 0.005),
    tone("sine", 1240, 1560, 0.09, 0.018, 0.085, 0.005),
  ]),
  "drop-appear:DROP_SPAWNED:relic": Object.freeze([
    tone("sine", 660, 990, 0.26, 0.072, 0, 0.006),
    tone("triangle", 990, 1480, 0.18, 0.038, 0.045, 0.006),
    tone("sine", 1480, 1980, 0.12, 0.02, 0.095, 0.006),
    tone("sawtooth", 330, 495, 0.22, 0.022, 0.01, 0.006),
  ]),
  // Collection rarity. §4.2 authorises "add rarity variants" on the existing item-collected id
  // without fixing values, so these are derived from its base profile using drop-appear's density
  // rule: common sheds the upper layer, rare is the authored base, resonant adds a ringing
  // partial, relic alone adds the sub octave. Pitches stay on the base's own register so a
  // collection never sounds like a spawn.
  "item-collected:ITEM_COLLECTED:common": Object.freeze([
    tone("sine", 560, 780, 0.2, 0.11),
  ]),
  "item-collected:ITEM_COLLECTED:rare": Object.freeze([
    tone("sine", 560, 780, 0.2, 0.11),
    tone("triangle", 840, 1120, 0.14, 0.055, 0.04),
  ]),
  "item-collected:ITEM_COLLECTED:resonant": Object.freeze([
    tone("sine", 560, 780, 0.2, 0.11),
    tone("triangle", 840, 1120, 0.14, 0.055, 0.04),
    tone("sine", 1120, 1400, 0.1, 0.026, 0.085, 0.005),
  ]),
  "item-collected:ITEM_COLLECTED:relic": Object.freeze([
    tone("sine", 560, 780, 0.2, 0.11),
    tone("triangle", 840, 1120, 0.14, 0.055, 0.04),
    tone("sine", 1120, 1400, 0.1, 0.026, 0.085, 0.005),
    tone("sawtooth", 280, 390, 0.22, 0.02, 0.012, 0.006),
  ]),
  ...buffStatVariants("buff-apply", "BUFF_APPLIED"),
  ...buffStatVariants("buff-expire", "BUFF_EXPIRED"),
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
  // C-1 (§3.2): these events ARE the release, not the windup — the simulation labels them
  // `cue: eventCue("weaponFire")` itself. Pointing them at attack-windup made the release of a
  // weapon sound identical to its wind-up and left the authored weapon-fire profile unreachable.
  WEAPON_FIRED: feedbackPolicy("weapon-fire", 32, "windup"),
  MELEE_SWEEP: feedbackPolicy("weapon-fire", 35, "windup"),
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
  // --- Cycle 10 stage-dungeon moments. Event types are ruled vocabulary (director v1/v2/v3);
  // no name is coined here, and audio binds the same type VfxCueDesign binds.
  // Drop family (§4.2). DROP_SPAWNED sits deliberately above ENEMY_DEFEATED 36 so the reward
  // reads over the kill that produced it, while staying under every damage cue.
  DROP_SPAWNED: feedbackPolicy("drop-appear", 38, "pickup"),
  DROP_EXPIRED: feedbackPolicy("drop-expire", 30, "pickup"),
  // DROP_DENIED is intentionally silent: it reports a system-side cap (reason "FIELD_CAP") on a
  // roll the player never acted on. Sounding it would fire on every over-cap wave clear and
  // collide semantically with PICKUP_DENIED 50, which reports a genuine rejected player action.
  DROP_DENIED: silentPolicy("pickup"),
  // Buff family (§4.3). BUFF_APPLIED sits just under ITEM_COLLECTED 56 — collecting is the act,
  // gaining the buff is its consequence, and both arrive in the same batch.
  BUFF_APPLIED: feedbackPolicy("buff-apply", 54, "pickup"),
  BUFF_REFRESHED: feedbackPolicy("buff-refresh", 44, "pickup"),
  // Registry entry is the TIMEOUT reading; every other reason resolves silent in
  // resolveEventPolicy(). MAX_ACTIVE_BUFFS = 6, so an ungated sweep would fire 6 stings — half
  // the 12-voice pool — in the single tick a wipe or objective retry clears every buff.
  BUFF_EXPIRED: feedbackPolicy("buff-expire", 40, "pickup"),
  // Gimmick family (§4.6). GIMMICK_TRIGGERED's registry entry is the `deformation` reading and
  // the unknown-class fallback; hazard/gate/mirror re-resolve in resolveEventPolicy().
  GIMMICK_ARMED: feedbackPolicy("gimmick-arm", 72, "warning"),
  GIMMICK_TRIGGERED: feedbackPolicy("terrain-deform", 76, "warning"),
  GIMMICK_RESOLVED: feedbackPolicy("gimmick-settle", 34, "objective"),
  // Pacing blocks are BGM-only (§4.7): they are state transitions, not moments, and the moments
  // inside them already sound. A policy may be silent for SFX while still steering the
  // soundscape, because consume() runs audioSoundscapeForEvent() on every fresh event
  // independently of `method`.
  PACING_BLOCK_STARTED: silentPolicy("pacing"),
  PACING_BLOCK_CLEARED: silentPolicy("pacing"),
});

// Conditional policies. Each is an ordinary frozen policy object built by the EXISTING
// feedbackPolicy factory, with the same six keys as every registry entry — no new policy field is
// introduced, because audio-feedback-runtime.test.mjs's silent-shape assertion enumerates exactly
// six keys and would red on a seventh.
//
// Footsteps (§2.3): AUDIO_EVENT_POLICY.MOVE stays silentPolicy("movement") verbatim. That entry
// remains the truthful default for the MOVE event CLASS — up to 60 emits/s across every actor, of
// which at most 5/s are commander footsteps. The step is resolved beside the registry rather than
// by re-pointing it, which is what keeps the off-cadence silent shape byte-identical.
//
// Priority 5 is a provable mix guarantee, not a tuning hope: makeRoomForVoice() evicts only when
// `candidate.priority < priority`, and the lowest priority any other voice can hold is 5
// (camera-clamp) while every policy-driven cue is >= 28. A footstep therefore can never evict any
// voice — it is dropped instead. Traversal yields to everything.
const MOVEMENT_FOOTSTEP_POLICY = feedbackPolicy("movement-step", 5, "movement");
// A dodged projectile previously sounded exactly like a landed hit while the renderer played
// `avoid`. 50 puts it in the block/input band: a dodge is a player-relevant outcome, above raw
// contact but below damage.
const DODGE_SLIP_POLICY = feedbackPolicy("dodge-slip", 50, "contact");
// Guarded contact keeps the event's OWN priority (45/47) rather than dropping to
// PROJECTILE_BLOCKED's 52: damage is still dealt, only reduced, so it stays in the contact band.
const GUARDED_IMPACT_POLICY = Object.freeze({
  PROJECTILE_IMPACT: feedbackPolicy("block-contact", 45, "contact"),
  MELEE_IMPACT: feedbackPolicy("block-contact", 47, "contact"),
});
const SHADOW_ARRIVAL_POLICY = feedbackPolicy("shadow-arrival", 68, "spawn");
// Non-TIMEOUT buff expiry. Its own constant rather than borrowing another event's silent policy:
// the shape is identical, but a reader must not have to know that DROP_DENIED and BUFF_EXPIRED
// happen to share a category to understand why this is silent.
const BUFF_EXPIRED_SILENT_POLICY = silentPolicy("pickup");
const GIMMICK_TRIGGERED_POLICY = Object.freeze({
  deformation: feedbackPolicy("terrain-deform", 76, "warning"),
  hazard: feedbackPolicy("warning-pulse", 78, "warning"),
  gate: feedbackPolicy("occupation-captured", 64, "objective"),
  mirror: feedbackPolicy("gimmick-mirror", 66, "warning"),
});

// Presentation-derived cues have no simulation event, so they cannot take a priority from the
// registry. This replaces the inline `cueId === "camera-clamp" ? 5 : 40` hack in play() with a
// table; camera-clamp keeps its hard-coded 5 exactly, so the observers-contract guarantee that no
// simulation event maps to it is untouched.
//
// The movement-step row is LOAD-BEARING, and not on the path you would expect. A footstep reaches
// cuePriority() by two routes:
//
//   A. policy path — a real step tick. resolveEventPolicy() returns MOVEMENT_FOOTSTEP_POLICY, which
//      is non-silent, so cuePriority() returns the POLICY's priority and never reads this table.
//   B. presentation path — an off-cadence MOVE, or a bare play("movement-step") with no event (how
//      a presentation-side footstep would fire). No non-silent policy resolves, so this table IS
//      the priority.
//
// So the never-evict guarantee — a footstep can never evict any voice, because the weakest voice
// any other cue can hold is camera-clamp's 5 and eviction requires candidate.priority < priority —
// depends on BOTH routes agreeing on 5. Deriving the row from the policy is what makes them agree
// by construction instead of by two literals that happen to match. Measured: de-linking this row to
// 40, 22, or even 6 leaves path A at 5 while path B evicts a camera-clamp, so the guarantee would
// hold where it is easy to test and break where it is not. Do NOT inline a literal here on the
// reasoning that path A ignores the table — path A does, path B does not.
const PRESENTATION_CUE_PRIORITY = Object.freeze({
  "camera-clamp": 5,
  "movement-step": MOVEMENT_FOOTSTEP_POLICY.priority,
  "buff-warning": 26,
});

const commanderFootstepTick = (event) => typeof event?.direction === "string"
  && event.direction !== "IDLE"
  && Number.isInteger(event.tick)
  && event.tick % FOOTSTEP_TICK_INTERVAL === 0;

/**
 * Resolves the policy for an event, applying the conditional readings that branch on fields
 * already present in the public payload. Called by BOTH audioCueForEvent() and play()'s priority
 * lookup, so the resolved cue and its priority can never disagree.
 *
 * Every branch reads a ruled payload field — `direction`/`tick`, `hit`, `guardedBy`, `grade`,
 * `reason`, `gimmickClass`. None reads `event.cue`, so AUDIO_EVENT_POLICY remains the sole
 * event->cue authority and the catalog-cue fallback stays reserved for unregistered events.
 */
const resolveEventPolicy = (event) => {
  const policy = AUDIO_EVENT_POLICY[event?.type];
  if (!policy) return null;
  switch (event.type) {
    case "MOVE":
      // A MOVE carrying `direction` is a commander step; enemy MOVE emits none, so enemy
      // movement is silent without an id lookup or a snapshot read.
      return commanderFootstepTick(event) ? MOVEMENT_FOOTSTEP_POLICY : policy;
    case "PROJECTILE_IMPACT":
    case "MELEE_IMPACT":
      // Precedence: a dodge is not a block, so `hit === false` wins over `guardedBy`. Strict
      // comparisons, so an absent field leaves the ordinary contact reading untouched.
      if (event.hit === false) return DODGE_SLIP_POLICY;
      if (event.guardedBy !== null && event.guardedBy !== undefined) {
        return GUARDED_IMPACT_POLICY[event.type] ?? policy;
      }
      return policy;
    case "ENEMY_SPAWNED":
      // Reads `grade` ONLY and never re-derives it from elite/midboss. BASIC stays silent: 10
      // concurrent BASIC spawns would take 10 of 12 voices in one tick.
      return event.grade === "SHADOW" ? SHADOW_ARRIVAL_POLICY : policy;
    case "BUFF_EXPIRED":
      // TIMEOUT is the only audible reason. DEATH clears up to 6 buffs in the terminal tick and
      // EVICTED always coincides with the buff-apply that displaced it — one player action, one
      // cue. STAGE_TRANSITION is retained in the enum but unreachable today.
      return event.reason === "TIMEOUT" ? policy : BUFF_EXPIRED_SILENT_POLICY;
    case "GIMMICK_TRIGGERED":
      // One event type, four readings, branching on the ruled `gimmickClass` field. An unknown
      // class falls back to the registry's terrain-deform entry rather than throwing.
      return GIMMICK_TRIGGERED_POLICY[event.gimmickClass] ?? policy;
    default:
      return policy;
  }
};

const cuePriority = (cueId, event) => {
  const policy = resolveEventPolicy(event);
  if (policy && !policy.intentionalSilence) return policy.priority;
  return PRESENTATION_CUE_PRIORITY[cueId] ?? policy?.priority ?? 40;
};


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
  "dodge-slip": 0.09,
  "drop-appear": 0.09,
  "drop-expire": 0.14,
  "buff-apply": 0.1,
  "buff-refresh": 0.12,
  "buff-expire": 0.12,
  "buff-warning": 0.25,
  "shadow-arrival": 0.6,
  "gimmick-arm": 0.4,
  "terrain-deform": 0.45,
  "gimmick-mirror": 0.3,
  "gimmick-settle": 0.25,
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
  // Cycle 10 (§5.3). The eight ruled pacing blocks previously collapsed midboss/occupation/
  // extraction into active-wave or objective-pressure, which is why the middle of a dungeon read
  // flat. These are graded interpolations on the same three scalars, so per-stage tonal identity
  // is preserved — `pitch` is a SCALAR on each stage's own frequencies, never a borrowed interval
  // structure. Every new state's pitch is >= 4% from its nearest neighbour so the 0.35s frequency
  // ramp is audible.
  //
  // midboss sits strictly interior to active-wave and boss on every axis: music louder, pitch
  // dropping — the floor is tilting but has not fallen.
  midboss: Object.freeze({ ambienceGain: 0.94, musicGain: 1.26, pitch: 0.84 }),
  // occupation is held ground: alert, pitch slightly up, and below objective-pressure on all
  // three axes so a pressure pulse during occupation still reads as an escalation.
  occupation: Object.freeze({ ambienceGain: 1.06, musicGain: 1.1, pitch: 1.06 }),
  // extraction inverts the boss shape — ambience down, pitch up: the world thins out and lifts as
  // you leave. The only non-victory state with pitch > 1.12.
  extraction: Object.freeze({ ambienceGain: 0.8, musicGain: 1.14, pitch: 1.22 }),
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
      // `extraction` joins the block list: an extraction pressure pulse must not drop pitch from
      // 1.22 back to 1.12 mid-exfil. `midboss` and `occupation` are deliberately absent — a
      // pressure pulse there SHOULD still escalate.
      if (currentState === "boss" || currentState === "victory" || currentState === "defeat"
        || currentState === "extraction") return null;
      return Object.freeze({ stageId, state: "objective-pressure" });
    case "ENEMY_SPAWNED":
    case "WAVE_VARIANT_STARTED":
      if (currentState !== "descent" && currentState !== "active-wave") return null;
      return Object.freeze({ stageId, state: "active-wave" });
    case "WAVE_CLEARED":
    case "OBJECTIVE_COMPLETED":
      if (currentState !== "objective-pressure") return null;
      return Object.freeze({ stageId, state: "active-wave" });
    case "PACING_BLOCK_STARTED":
      // Never pre-empt a terminal outcome state; `resolution` is the terminal BLOCK but the
      // victory/defeat OUTCOME belongs to TERMINAL, and keying an outcome off a block id would
      // give one moment two authorities.
      if (currentState === "victory" || currentState === "defeat") return null;
      switch (event.blockId) {
        case "ingress":
          return Object.freeze({ stageId, state: "descent" });
        case "objective-1":
        case "objective-2":
          // Do not downgrade an active pressure overlay.
          return currentState === "objective-pressure"
            ? null
            : Object.freeze({ stageId, state: "active-wave" });
        case "midboss":
          return Object.freeze({ stageId, state: "midboss" });
        case "occupation":
          return Object.freeze({ stageId, state: "occupation" });
        case "boss":
          return Object.freeze({ stageId, state: "boss" });
        case "extraction":
          return Object.freeze({ stageId, state: "extraction" });
        case "resolution":
        default:
          return null;
      }
    case "PACING_BLOCK_CLEARED":
      // A cleared block returns to the neutral bed unless a heavier state owns the mix.
      if (currentState === "boss" || currentState === "victory" || currentState === "defeat") return null;
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

/**
 * How long a narration beat holds the presentation channel.
 *
 * Speech used to define this implicitly: the channel was busy until the
 * utterance finished. With narration presented as a bubble, the duration has to
 * be stated, and it must be the READING time of the line rather than a fixed
 * interval, or a long beat is preempted before it can be read.
 *
 * Kept numerically in step with defense-speech-bubble.js's `speechBubbleHoldMs`
 * so the audio channel and the visible bubble release together; the bubble module
 * owns the presentation, this owns the preemption channel, and a disagreement
 * would let a cue preempt a beat still on screen.
 */
const narrationHoldMs = (text) => {
  const length = typeof text === "string" ? text.length : 0;
  return Math.min(5200, Math.max(2200, 1500 + length * 58));
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
  // resolveEventPolicy() applies the conditional readings (footstep cadence, dodge/guard,
  // spawn grade, expiry reason, gimmick class). The decision is made HERE, inside the authority
  // function, which is what makes the footstep binding an explicit contract change rather than a
  // route around an intentionalSilence entry: it is not the `event.cue` fallback below, and it is
  // not a renderer-direct play().
  const policy = resolveEventPolicy(event);
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

const variantKey = (cueId, event, material = null) => {
  // Per-surface footsteps (§2.2): scoped to a single cue id, and only when a material actually
  // resolved, so a null surface falls through to the base movement-step profile.
  if (cueId === "movement-step" && material) return `movement-step:MOVE:${material}`;
  if (event?.type === "TERMINAL" && event.outcome) return `${cueId}:TERMINAL:${event.outcome}`;
  if (!event?.type) return "";
  // Rarity (§4.2) and stat (§4.3) extend the key to a third segment for their own cue ids only.
  // A missing or non-string field leaves the two-segment key untouched.
  if ((cueId === "drop-appear" || cueId === "item-collected") && typeof event.rarity === "string") {
    return `${cueId}:${event.type}:${event.rarity}`;
  }
  if ((cueId === "buff-apply" || cueId === "buff-expire") && typeof event.stat === "string") {
    return `${cueId}:${event.type}:${event.stat}`;
  }
  return `${cueId}:${event.type}`;
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
    sampleMapUrl = null,
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
    // Sample mode (opt-in): ElevenLabs-generated buffers keyed by cue/variant
    // id, loaded lazily after start(). Empty maps keep every code path on the
    // procedural oscillator profiles, so environments without fetch/decode
    // (tests, offline, blocked network) behave exactly as before.
    this.sampleMapUrl = typeof sampleMapUrl === "string" && sampleMapUrl ? sampleMapUrl : null;
    this.sampleBuffers = new Map();
    this.loopBuffers = new Map();
    this.samplesLoading = null;
    this.lastCueAt = new Map();
    this.feedbackEventKeys = new Set();
    this.lastFeedbackTick = null;
    this.activeNarrations = new Set();
    this.narrationPriorities = new Map();
    this.activeNarrationPriority = 0;
    this.storyNarrationKeys = new Set();
    this.presentedNarrations = [];
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
    // Read-only surface lookup (§2.2), defaulted to the authored slab table so all nine material
    // timbres are live without a host injection. A stage with no authored slabs, or a point
    // outside the slab rects, returns null and falls back to the base movement-step timbre — the
    // degradation path, not silence.
    this.surfaceResolver = typeof slabMaterialAt === "function" ? slabMaterialAt : null;
    // Once-per-buffId dedupe for the presentation-derived pre-expiry sting (§4.4), mirroring
    // app.js's rallyAcknowledgedBossIds pattern. Cleared by resetRun(), because buffId is
    // `buff-<n>` from a run-local counter and a re-entered stage reuses ids.
    this.buffWarnedIds = new Set();
  }

  /**
   * Injects the read-only slab surface lookup used for per-surface footstep timbre.
   *
   * @param {null|((stageId: string, x: number, y: number) => ({ slabId?: string, materialId?: string }|string|null))} resolver
   *   Contract from DungeonLevelDesign: three arguments, object return carrying `materialId`, and
   *   `null` outside stage bounds. A bare material-id string is also accepted, because app.js's
   *   guarded call site may map `?.materialId ?? null` before handing the function over.
   *
   * The resolver is READ-ONLY by contract: it derives purely from authored slab rects, never
   * writes simulation state, and never consumes RNG — so injecting it cannot move getRunDigest().
   * Its seam ownership is single-valued (ascending slab index, first match wins), which is the
   * property that keeps timbre from flickering between two materials mid-stride at 5 steps/s.
   */
  setSurfaceResolver(resolver) {
    this.surfaceResolver = typeof resolver === "function" ? resolver : null;
    return this.surfaceResolver !== null;
  }

  /** Resolves the slab material under a MOVE event's post-move position, or null. */
  surfaceMaterialFor(event) {
    if (typeof this.surfaceResolver !== "function") return null;
    const to = event?.to;
    if (!Number.isFinite(to?.x) || !Number.isFinite(to?.y)) return null;
    try {
      const resolved = this.surfaceResolver(this.soundscapeStageId, to.x, to.y);
      if (typeof resolved === "string") return resolved;
      return typeof resolved?.materialId === "string" ? resolved.materialId : null;
    } catch {
      // A resolver that throws must never break the audio frame; fall back to the base timbre.
      return null;
    }
  }

  /**
   * Presentation-derived pre-expiry warning (§4.4). There is no BUFF_EXPIRING event and one must
   * not be added — a per-tick warning would bloat run.events every tick. The caller hangs this off
   * the buff strip's EXISTING `remaining <= BUFF_WARN_TICKS` comparison, so the strip and the sting
   * are driven by one evaluation and can never disagree.
   *
   * This is an EDGE DETECTOR, not fire-once-per-id. A fire-once Set is silently broken by
   * BUFF_REFRESHED: a refresh pushes `remaining` back above BUFF_WARN_TICKS, so the buff
   * approaches expiry a second time while its id is still latched, and it never warns again.
   * Rising edge (outside window -> inside) plays; falling edge (a refresh lifting it back out)
   * clears the latch so the next approach warns again.
   *
   * @param {string} buffId Instance id, `buff-<n>`.
   * @param {boolean} [expiring=true] The caller's `remaining > 0 && remaining <= BUFF_WARN_TICKS`.
   *   Pass it through rather than recomputing, so one comparison drives strip and sting.
   * @returns {boolean} true only when this call played the sting.
   */
  signalBuffExpiring(buffId, expiring = true) {
    const key = typeof buffId === "string" && buffId ? buffId : null;
    if (!key) return false;
    if (!expiring) {
      // Falling edge: refreshed clear of the window, so re-arm for the next approach.
      this.buffWarnedIds.delete(key);
      return false;
    }
    if (this.buffWarnedIds.has(key)) return false;
    this.buffWarnedIds.add(key);
    return this.play("buff-warning");
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
    this.presentedNarrations.length = 0;
    this.lastCueAt.clear();
    // buffId is `buff-<n>` from a run-local counter, so a re-entered stage reuses ids. Clearing
    // here — the same path BattleSession takes on remount — is what lets a reused id re-warn.
    this.buffWarnedIds.clear();
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
      if (this.sampleMapUrl) safePromise(this.loadSamples());
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

  loadSamples(mapUrl = this.sampleMapUrl) {
    this.sampleMapUrl = typeof mapUrl === "string" && mapUrl ? mapUrl : null;
    if (!this.sampleMapUrl || !this.context
      || typeof globalThis.fetch !== "function"
      || typeof this.context.decodeAudioData !== "function") return Promise.resolve(false);
    if (this.samplesLoading) return this.samplesLoading;
    const loadOne = async (target, key, spec) => {
      try {
        const res = await globalThis.fetch(spec.url);
        if (!res?.ok) return;
        const buffer = await this.context.decodeAudioData(await res.arrayBuffer());
        if (buffer) target.set(key, { buffer, gain: Number.isFinite(spec.gain) ? spec.gain : 0.8 });
      } catch { /* missing or undecodable sample keeps the procedural profile */ }
    };
    this.samplesLoading = (async () => {
      try {
        const res = await globalThis.fetch(this.sampleMapUrl);
        if (!res?.ok) return false;
        const map = await res.json();
        await Promise.all([
          ...Object.entries(map?.cues ?? {}).map(([key, spec]) => loadOne(this.sampleBuffers, key, spec)),
          ...Object.entries(map?.loops ?? {}).map(([key, spec]) => loadOne(this.loopBuffers, key, spec)),
        ]);
        this.refreshPersistentLoops();
        return this.sampleBuffers.size > 0 || this.loopBuffers.size > 0;
      } catch {
        return false;
      }
    })();
    return this.samplesLoading;
  }

  sampleFor(cueId, event) {
    if (!this.sampleBuffers.size || typeof this.context?.createBufferSource !== "function") return null;
    return this.sampleBuffers.get(variantKey(cueId, event)) ?? this.sampleBuffers.get(cueId) ?? null;
  }

  refreshPersistentLoops() {
    if (!this.started || this.paused || this.backgrounded || this.reducedMotion) return;
    if (this.ambienceVoices.length && !this.ambienceVoices[0].buffered
      && this.loopBuffers.has(`ambience:${this.soundscapeStageId}`)) {
      this.stopAmbience();
      this.startAmbience();
    }
    if (this.musicVoices.length && !this.musicVoices[0].buffered
      && this.loopBuffers.has(`music:${this.soundscapeStageId}`)) {
      this.stopBattleMusic();
      this.startBattleMusic();
    }
  }

  startBufferedLoop(kind, destination) {
    if (!this.context || !destination
      || typeof this.context.createBufferSource !== "function") return null;
    const spec = this.loopBuffers.get(`${kind}:${this.soundscapeStageId}`);
    if (!spec || this.nodes.size + 2 > MAX_AUDIO_NODES) return null;
    let source = null;
    let gain = null;
    try {
      const stateMix = SOUNDSCAPE_STATES[this.soundscapeState] ?? SOUNDSCAPE_STATES.descent;
      const gainScale = kind === "ambience" ? stateMix.ambienceGain : stateMix.musicGain;
      source = this.register(this.context.createBufferSource(), { stoppable: true });
      gain = this.register(this.context.createGain());
      source.buffer = spec.buffer;
      source.loop = true;
      if (source.playbackRate) source.playbackRate.value = stateMix.pitch;
      gain.gain.value = spec.gain * gainScale;
      source.connect(gain).connect(destination);
      source.start();
      return {
        source,
        gain,
        kind,
        index: 0,
        buffered: true,
        stageId: this.soundscapeStageId,
        baseGain: spec.gain,
      };
    } catch {
      stopNode(source);
      this.release(source);
      this.release(gain);
      return null;
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
    const buffered = this.startBufferedLoop("ambience", this.ambienceBus);
    if (buffered) {
      this.ambienceVoices.push(buffered);
      return;
    }
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
    const buffered = this.startBufferedLoop("music", this.musicBus);
    if (buffered) {
      this.musicVoices.push(buffered);
      return;
    }
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
    const restartKinds = new Set();
    for (const voice of [...this.ambienceVoices, ...this.musicVoices]) {
      if (voice.buffered) {
        // A stage change swaps the loop buffer; a state change only re-mixes
        // the running loop (gain + playback rate) like the oscillator path.
        if (voice.stageId !== this.soundscapeStageId
          && this.loopBuffers.has(`${voice.kind}:${this.soundscapeStageId}`)) {
          restartKinds.add(voice.kind);
          continue;
        }
        const stateMix = SOUNDSCAPE_STATES[this.soundscapeState] ?? SOUNDSCAPE_STATES.descent;
        const gainScale = voice.kind === "ambience" ? stateMix.ambienceGain : stateMix.musicGain;
        if (voice.source.playbackRate) {
          setParam(voice.source.playbackRate, "setValueAtTime", Math.max(0.01, voice.source.playbackRate.value || 1), now);
          setParam(voice.source.playbackRate, "linearRampToValueAtTime", stateMix.pitch, end);
        }
        setParam(voice.gain.gain, "setValueAtTime", Math.max(SILENCE, voice.gain.gain.value), now);
        setParam(voice.gain.gain, "linearRampToValueAtTime", voice.baseGain * gainScale, end);
        continue;
      }
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
    if (restartKinds.has("ambience")) {
      this.stopAmbience();
      this.startAmbience();
    }
    if (restartKinds.has("music")) {
      this.stopBattleMusic();
      this.startBattleMusic();
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
    voices.splice(0).forEach((voice) => {
      const generator = voice.oscillator ?? voice.source;
      stopNode(generator);
      this.release(generator);
      this.release(voice.gain);
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
    // Footsteps alone consult the injected surface resolver, so a slab material can select a
    // timbre variant without any other cue paying for the lookup.
    const material = cueId === "movement-step" ? this.surfaceMaterialFor(event) : null;
    const profile = CUE_VARIANTS[variantKey(cueId, event, material)]
      || CUE_PROFILES[cueId]
      || fallbackProfile(cue);
    return { cue, profile };
  }

  playSampleVoice(sample, priority, now, refractoryKey) {
    const voice = {
      remaining: 1,
      nodes: [],
      priority,
      startedAt: now,
      released: false,
    };
    try {
      const source = this.register(this.context.createBufferSource(), { transient: true, stoppable: true });
      voice.nodes.push(source);
      const gain = this.register(this.context.createGain(), { transient: true });
      voice.nodes.push(gain);
      source.buffer = sample.buffer;
      gain.gain.value = sample.gain;
      source.connect(gain).connect(this.sfxBus);
      source.addEventListener?.("ended", () => {
        if (voice.released) return;
        this.release(source);
        this.release(gain);
        voice.nodes = [];
        voice.remaining = 0;
        voice.released = true;
        this.activeVoices.delete(voice);
      }, { once: true });
      source.start(now);
      this.activeVoices.add(voice);
      this.lastCueAt.set(refractoryKey, now);
      if (this.context.state === "suspended") safePromise(this.context.resume?.());
      return true;
    } catch {
      this.stopVoice(voice);
      return false;
    }
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
      // A 5Hz continuous footstep stream is an ambience-class stimulus, and reducedMotion already
      // gates exactly that class (startAmbience/startBattleMusic both return early on it).
      // Footsteps are the first transient cue that behaves like a bed, so they follow the bed's
      // rule. Discrete combat cues stay audible. Checked before any node is allocated, which is
      // what preserves the zero-allocation mute/suppress guarantee.
      || (this.reducedMotion && cueId === "movement-step")
    ) return false;
    const priority = cuePriority(cueId, event);
    if (priority >= CRITICAL_AUDIO_PRIORITY && this.activeNarrationPriority < priority) {
      this.stopNarration();
    }
    const now = this.context.currentTime;
    const refractory = CUE_REFRACTORY_SECONDS[cueId] || 0;
    const refractoryKey = cueRefractoryKey(cueId, event);
    const lastPlayedAt = this.lastCueAt.get(refractoryKey);
    if (refractory && Number.isFinite(lastPlayedAt) && now - lastPlayedAt < refractory) return false;
    const sample = this.sampleFor(cueId, event);
    const requiredNodes = sample ? 2 : resolved.profile.length * 2;
    if (!this.makeRoomForVoice(requiredNodes, priority)) return false;
    if (sample) {
      if (this.playSampleVoice(sample, priority, now, refractoryKey)) return true;
      // The buffer path failed mid-flight; fall through to the procedural
      // profile after re-checking the larger oscillator node budget.
      if (!this.makeRoomForVoice(resolved.profile.length * 2, priority)) return false;
    }

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

  /**
   * Narration presentation hand-off. Formerly this spoke `text` through
   * `speechSynthesis`; narration is now presented visually as a world-space
   * speech bubble (see defense-speech-bubble.js), so this method no longer
   * synthesizes anything.
   *
   * It is deliberately NOT deleted. Three things still depend on it:
   *
   *  - `consume()`'s narration pass (below) uses the boolean return to decide
   *    whether a story beat has been *presented*, which is what
   *    `rememberStoryNarration` keys off — dedup across a replayed snapshot is
   *    still this method's job.
   *  - `activeNarrations` / `narrationPriorities` keep expressing "a narration
   *    beat currently holds the channel", so `CRITICAL_AUDIO_PRIORITY` cues can
   *    still preempt a lower-priority beat and every lifecycle stop
   *    (visibility, background, pause, resetRun, tick-zero rerun, stop) keeps
   *    clearing it for free.
   *  - `debugMetrics()` keeps reporting the same counters, so the QA harnesses
   *    that need them do not need a parallel bubble metric to stay meaningful.
   *
   * A synthetic token stands in for the utterance object. It carries no audio,
   * and it is released on the beat's own reading duration rather than on an
   * `onend` callback, because nothing is speaking to end.
   *
   * `muted` still gates, deliberately. This method owns the *audio-side*
   * presentation channel — the thing a critical cue preempts and a lifecycle
   * stop clears — and muting that channel is coherent. The visible bubble is a
   * separate layer driven from app.js by SpeechBubbleDirector, which is NOT
   * mute-gated: a muted player still reads the beat. Keeping the gate here also
   * keeps every existing channel semantic (priority, dedup, teardown) intact
   * rather than silently redefining what mute means.
   *
   * `presentedNarrations` is the observable seam that replaced `speechSynthesis`
   * as the thing a test can assert against: the text of each beat this channel
   * accepted, in arrival order.
   */
  narrate(event, priority = AMBIENT_NARRATION_PRIORITY) {
    const text = narrationText(event);
    const story = Boolean(storyNarrationText(event));
    if (!text || this.muted || this.paused || this.backgrounded) return false;
    if (this.activeNarrations.size) {
      if (priority > this.activeNarrationPriority) {
        this.stopNarration();
      } else if (!story || priority < this.activeNarrationPriority) {
        return false;
      }
    }
    if (this.activeNarrations.size >= MAX_ACTIVE_NARRATIONS) {
      // Keep the earliest authored milestones in arrival order.
      return false;
    }
    const token = { text, story };
    this.activeNarrations.add(token);
    this.narrationPriorities.set(token, priority);
    this.presentedNarrations.push(text);
    if (this.presentedNarrations.length > MAX_PRESENTED_NARRATIONS) this.presentedNarrations.shift();
    this.updateActiveNarrationPriority();
    // Hold the channel for the beat's reading duration, then release. Guarded so
    // a synchronous re-entrant release cannot double-decrement.
    const release = () => {
      if (!this.activeNarrations.delete(token)) return;
      this.narrationPriorities.delete(token);
      this.updateActiveNarrationPriority();
    };
    const holdMs = narrationHoldMs(text);
    if (typeof globalThis.setTimeout === "function") {
      token.timer = globalThis.setTimeout(release, holdMs);
    } else {
      release();
    }
    return true;
  }

  stopNarration() {
    const hadActiveNarration = this.activeNarrations.size > 0;
    // Narration is presented as a bubble now, so there is no utterance to
    // cancel — but the hold timers must die with the beat, or a release that
    // fires after a resetRun would decrement a channel it no longer owns.
    for (const token of this.activeNarrations) {
      if (token?.timer !== undefined) clearTimeout(token.timer);
    }
    this.activeNarrations.clear();
    this.narrationPriorities.clear();
    this.activeNarrationPriority = 0;
    return hadActiveNarration;
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
      this.presentedNarrations.length = 0;
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
    this.presentedNarrations.length = 0;
    this.buffWarnedIds.clear();
    this.lastFeedbackTick = null;
    this.stoppableNodes.clear();
    this.transientNodes.clear();
    this.nodes.clear();
    this.musicVoices.length = 0;
    this.ambienceVoices.length = 0;
    this.sampleBuffers.clear();
    this.loopBuffers.clear();
    this.samplesLoading = null;
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
      sampleMode: Boolean(this.sampleMapUrl),
      sampleCues: this.sampleBuffers.size,
      sampleLoops: this.loopBuffers.size,
      maxNodes: MAX_AUDIO_NODES,
      maxVoices: MAX_ACTIVE_VOICES,
      feedbackEvents: this.feedbackEventKeys.size,
      narrations: this.activeNarrations.size,
      narrationPriority: this.activeNarrationPriority,
      narrationQueue: Math.max(0, this.activeNarrations.size - 1),
      storyNarrations: this.storyNarrationKeys.size,
      // Text of the beats this channel accepted, newest last. Replaces the
      // former `speechSynthesis.utterances` as the assertable presentation trace.
      presentedNarrations: [...this.presentedNarrations],
    };
  }
}
