// Snapshot-only presentation adapter for the defense session, backed by a
// real Three.js/WebGL scene graph. It deliberately owns neither time nor
// game input; the session supplies snapshots via renderSnapshot() and this
// module never drives its own animation loop or wires up DOM listeners of
// its own, and never imports campaign state -- verified by
// tests/defense-renderer-contract.test.mjs's "no loop/input/campaign/outcome
// ownership" check.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import * as SkeletonUtils from "./vendor/utils/SkeletonUtils.js";
import { REWARDS, STAGE_PRESENTATION_BY_ID, STAGES } from "./defense-catalog.js";
import { stageWorldFor } from "./stage-world-catalog.js";

const MAX_VISUAL_EFFECTS = 24;
const SIM_TICK_RATE = 60;
const MAX_ANIMATION_TICK_DELTA = 6;
const MAX_VISUAL_EVENT_KEYS = 128;
const MAX_PENDING_STAGE_NPC_BEATS = 4;
// Software rasterizers (SwiftShader/llvmpipe) make fragment cost dominate the
// frame. Bound their drawn backbuffer while preserving the logical CSS viewport;
// real GPUs remain full resolution.
const SOFTWARE_MAX_BACKBUFFER_PX = 180000;

function detectSoftwareWebGL() {
  try {
    const probe = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const gl = probe?.getContext?.("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext?.();
    return /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(name);
  } catch {
    return false;
  }
}


// Actor-space is normalized to [-1, 1] by app.js's projected() (both axes
// independently, since ARENA is 24000x12000 and each axis divides by its
// own dimension) -- WORLD_SCALE maps that into world units for the 3D
// ground plane. Kept square (not 2:1) intentionally: these are symbolic
// stage dioramas (matching the "anime-anisotropic 2.5D" concept-pack art
// direction), not a literal top-down arena reconstruction.
const WORLD_SCALE = 14;
// Terrain GLBs are small self-contained dioramas authored at varying native
// scales (footprints from ~1 to ~2.6 units across different stages -- see
// build-world-content-pack.py). Auto-fit every terrain model's horizontal
// footprint to this half-extent on load so stage art always reads at a
// consistent size relative to the actor-space play area, regardless of how
// large the stage was originally modeled.
const TERRAIN_TARGET_HALF_EXTENT = WORLD_SCALE * 1.15;
const STAGE_VFX_GROUND_LIFT = 0.04;
// Per-actor-kind target world height (Y-axis extent after uniform scale).
// Bosses remain the largest silhouette; the commander deliberately reads
// smaller than a normal enemy so friendly attachments do not obscure combat.
const TARGET_HEIGHT = Object.freeze({
  commander: 1.55,
  boss: 4.5,
  elite: 2.2,
  enemy: 1.7,
  companion: 1.3,
  stageNpc: 1.8,
  pickup: 0.7,
});
// Imported ambient rigs use a local-X arm swing. Keep their idle silhouette guarded
// after the mixer writes its authored horizontal pose each frame.
const STAGE_NPC_GUARD_OFFSETS = Object.freeze({
  left: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(50)),
  right: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-100)),
});

// Camera framing contract (camera-vfx-direction.md §§1-2). The six phase
// targets are renderer-world distances at the fixed 55° base pitch. Manual
// pinch zoom is layered on top and remains within ±10% of the active tier.
const MIN_ORBIT_PITCH = THREE.MathUtils.degToRad(30);
const MAX_ORBIT_PITCH = THREE.MathUtils.degToRad(85);
const ORBIT_ZOOM_DEFAULT = 20.8;
const MANUAL_ZOOM_RATIO_MIN = 0.9;
const MANUAL_ZOOM_RATIO_MAX = 1.1;
const MIN_ORBIT_DISTANCE = ORBIT_ZOOM_DEFAULT * 0.5;
const MAX_ORBIT_DISTANCE = ORBIT_ZOOM_DEFAULT * 2;
export const CAMERA_POSITION_LAMBDA = 6;
export const CAMERA_LOOK_LAMBDA = 11;
export const CAMERA_TIER_TRANSITION_TICKS = 90;
export const CAMERA_PHASE_TIERS = Object.freeze({
  DESCENT: Object.freeze({ zoomFactor: 20.8, boundaryDepth: 23.0 }),
  SKIRMISH: Object.freeze({ zoomFactor: 26.0, boundaryDepth: 28.7 }),
  SURGE: Object.freeze({ zoomFactor: 33.0, boundaryDepth: 36.5 }),
  MIDBOSS: Object.freeze({ zoomFactor: 38.0, boundaryDepth: 42.0 }),
  BIGWAVE: Object.freeze({ zoomFactor: 41.5, boundaryDepth: 45.9 }),
  FINALE: Object.freeze({ zoomFactor: 41.5, boundaryDepth: 45.9 }),
});
export const CAMERA_PHASES = Object.freeze(Object.keys(CAMERA_PHASE_TIERS));
const DEFAULT_CAMERA_PHASE = "DESCENT";
const CAMERA_TRANSITION_CURVE = 3;

export function cameraTierTarget(phase = DEFAULT_CAMERA_PHASE) {
  return (CAMERA_PHASE_TIERS[phase] ?? CAMERA_PHASE_TIERS[DEFAULT_CAMERA_PHASE]).zoomFactor;
}

export function exponentialSmoothingFactor(lambda, deltaSeconds) {
  const safeLambda = Math.max(0, finite(lambda, 0));
  const safeDelta = Math.max(0, finite(deltaSeconds, 0));
  return 1 - Math.exp(-safeLambda * safeDelta);
}

// A normalized exponential curve gives the transition the authored easing
// while still landing exactly on its target at tick 90.
export function exponentialTransitionValue(
  from,
  to,
  elapsedTicks,
  durationTicks = CAMERA_TIER_TRANSITION_TICKS,
) {
  const start = finite(from, 0);
  const end = finite(to, start);
  const duration = Math.max(1, finite(durationTicks, CAMERA_TIER_TRANSITION_TICKS));
  const progress = THREE.MathUtils.clamp(finite(elapsedTicks, 0) / duration, 0, 1);
  if (progress >= 1) return end;
  const alpha = (1 - Math.exp(-CAMERA_TRANSITION_CURVE * progress))
    / (1 - Math.exp(-CAMERA_TRANSITION_CURVE));
  return THREE.MathUtils.lerp(start, end, alpha);
}
// Camera-relative rim light (stage-composition-20260725.md §1.2, D22
// 판정 9): a DirectionalLight's illumination is direction-only (distance
// doesn't affect its intensity), so a fixed distance/pitch -- independent
// of the live zoomFactor/orbitPitch -- is sufficient to encode "opposite
// side of the orbit, elevated" without needing to track the camera's
// exact distance. Distance is arbitrary (any value produces the same
// lighting direction once normalized by the light's target); pitch 35°
// keeps the light source above the horizon, similar in feel to the
// legacy fixed rim position (-8, 5, -6), which also always had a
// meaningfully positive Y.
const RIM_LIGHT_DISTANCE = 20;
const RIM_LIGHT_PITCH = THREE.MathUtils.degToRad(35);

// Runtime motion GLBs are the only actor assets that ship the canonical
// 11-action library. Asset IDs stay stable across gameplay routing, review
// manifests, and the public resource registry.
export const MOTION_MODELS = Object.freeze({
  "broken-court-monarch-boss": "assets/motion/ingame/characters/broken-court-monarch-boss/model.glb",
  "broken-court-monarch-v04": "assets/motion/ingame/characters/broken-court-monarch-v04/model.glb",
  "ember-cohort": "assets/motion/ingame/characters/ember-cohort/model.glb",
  guard: "assets/motion/ingame/characters/guard/model.glb",
  "human-command-boss": "assets/motion/ingame/characters/human-command-boss/model.glb",
  "lantern-reaver": "assets/motion/ingame/characters/lantern-reaver/model.glb",
  possessed: "assets/motion/ingame/characters/possessed/model.glb",
  scout: "assets/motion/ingame/characters/scout/model.glb",
  shade: "assets/motion/ingame/characters/shade/model.glb",
  "shadow-commander-boss": "assets/motion/ingame/characters/shadow-commander-boss/model.glb",
  "shadow-soldier-v04": "assets/motion/ingame/characters/shadow-soldier-v04/model.glb",
});

export function meshRootForMotionCharacter(assetId) {
  return Object.hasOwn(MOTION_MODELS, assetId) ? MOTION_MODELS[assetId] : null;
}

const PLAYER_SOURCE_MESH = "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb";
const PLAYER_RUNTIME_MOTION_MESH = MOTION_MODELS["lantern-reaver"];
const PLAYER_MESH = PLAYER_RUNTIME_MOTION_MESH;
const PROP_BLADE_MESH = "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb";
const PROP_RELIC_MESH = "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb";

// `bossId` is emitted directly by the simulation. Stage bosses without an
// explicit motionAssetId retain their supplied static campaign mesh.
const BOSS_MODELS = Object.freeze({
  "s1-cinder-warden": "assets/mesh/boss/s1-cinder-warden/glb/base_basic_pbr.glb",
  "s2-veil-tactician": "assets/mesh/boss/s2-veil-tactician/glb/base_basic_pbr.glb",
  "s3-gate-sovereign": "assets/mesh/boss/s3-gate-sovereign/glb/base_basic_pbr.glb",
});

const ENEMY_MODELS = Object.freeze({
  rusher: MOTION_MODELS.scout,
  flanker: MOTION_MODELS.shade,
  guardian: MOTION_MODELS["shadow-soldier-v04"],
  ranged: MOTION_MODELS.possessed,
});

const COMPANION_MODELS = Object.freeze(Object.fromEntries([
  "ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo",
  "dawnless-crown", "pack-warden", "lantern-reaver", "requiem-warden",
].map((id) => [id, MOTION_MODELS[id] ?? PLAYER_MESH])));

const COMMANDER_MODEL = MOTION_MODELS["human-command-boss"];

// Companion rewards and roster cards resolve through the same promoted model
// selected for that companion in battle; unmapped companions use Lantern Reaver.
export function meshRootForCompanion(companionId) {
  return Object.hasOwn(COMPANION_MODELS, companionId) ? COMPANION_MODELS[companionId] : null;
}


// Looks up the stage's authored boss id (defense-catalog.js STAGES) and
// resolves it through BOSS_MODELS -- returns null if the stage or its boss
// model isn't found, so callers fall back to a glyph/text portrait.
export function meshRootForStageBoss(stageId) {
  const bossId = STAGES.find((entry) => entry.id === stageId)?.boss;
  return bossId ? (BOSS_MODELS[bossId] ?? null) : null;
}

// Looks up a REWARDS catalog id's 3D portrait: PROP_MODELS for authored
// modifier props (stillwater-hourglass/bulwark-brand/abyssal-banner/
// warden-lantern/choir-ward-crystal), or -- for "kind":"companion" legacy
// rewards -- the SAME character mesh meshRootForCompanion() would resolve
// for that companionId (a captured elite's reward card and its eventual
// companion-roster card show the identical portrait). "archive"/"record"
// kind rewards and any id without a mapped prop return null, so callers
// fall back to their existing text/glyph card exactly as before this
// function existed.
export function meshRootForReward(rewardId) {
  if (PROP_MODELS[rewardId]) return PROP_MODELS[rewardId];
  const companionId = REWARDS[rewardId]?.companionId;
  return companionId ? meshRootForCompanion(companionId) : null;
}

// rpg-catalog.js EQUIPMENT_TIERS[].id ("T1".."T5") -> its 3D tier-gem
// portrait. Returns null for an unrecognized tier id so callers keep their
// existing .tier-icon CSS-shape fallback.
export function meshRootForEquipmentTier(tierId) {
  return EQUIPMENT_TIER_MODELS[tierId] ?? null;
}

export const COMMANDER_MESH_ROOT = COMMANDER_MODEL;

// Event type -> one-shot VFX GLB + lifetime (ticks @ 60Hz). Reuses the
// three authored stage effects from `assets/motion/`; there is no image-lane
// fallback for combat feedback.
const VFX_MODELS = Object.freeze({
  INPUT_ACCEPTED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  INPUT_REJECTED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  PICKUP_DENIED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  ECHO_DENIED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  EXTRACTION_REJECTED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  OBJECTIVE_FAILED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  ENCOUNTER_OBJECTIVE_FAILED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  PROJECTILE_BLOCKED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  PROJECTILE_EXPIRED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  BOSS_ATTACK_CANCELLED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  CRITICAL_HIT: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  MELEE_IMPACT: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  PROJECTILE_IMPACT: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  SKILL_RESOLVED_DAMAGE: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  COMMANDER_DAMAGED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  COMPANION_DAMAGED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  ITEM_COLLECTED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  OBJECTIVE_PHASE_CHANGED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  ENCOUNTER_OBJECTIVE_STARTED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  OBJECTIVE_COMPLETED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  ENCOUNTER_OBJECTIVE_COMPLETED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  WAVE_CLEARED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  EXTRACTION_WINDOW_OPENED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  OCCUPATION_CAPTURED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  EXTRACTION_COMPLETED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  BOSS_ATTACK_TELEGRAPHED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  BOSS_SPAWNED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  BOSS_RALLY_WINDOW: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  GATE_BREACHED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  WARDENS_WARD_TRIGGERED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  ECHO_WARDEN_AWAKENING_TRIGGERED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  COMPANION_DOWNED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  TERMINAL: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
});
const SKILL_VFX_MODELS = Object.freeze({
  "rift-bolt": "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  "soul-lance": "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  "grave-pulse": "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  "void-aegis": "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  "shadow-step": "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
});

const SKILL_VFX_SILHOUETTES = Object.freeze({
  "soul-lance": Object.freeze({ x: 0.42, y: 0.42, z: 1.9 }),
  "rift-bolt": Object.freeze({ x: 0.5, y: 0.5, z: 1.65 }),
  "grave-pulse": Object.freeze({ x: 1.65, y: 0.42, z: 1.65 }),
  "shadow-step": Object.freeze({ x: 0.55, y: 0.9, z: 1.45 }),
  "void-aegis": Object.freeze({ x: 1.25, y: 1.7, z: 1.25 }),
});

function semanticVfxIdForEvent(event) {
  if (event?.type === "SKILL_CAST") return event.vfx || event.skillId || "skill-cast";
  switch (event?.type) {
    case "ENCOUNTER_OBJECTIVE_STARTED": return "objective-phase-changed";
    case "ENCOUNTER_OBJECTIVE_COMPLETED": return "objective-completed";
    case "ENCOUNTER_OBJECTIVE_FAILED": return "objective-failed";
    case "CRITICAL_HIT": return "critical-hit";
    case "BOSS_RALLY_WINDOW": return "boss-warning";
    case "GATE_BREACHED": return "gate-breach";
    case "WARDENS_WARD_TRIGGERED": return "void-aegis";
    case "ECHO_WARDEN_AWAKENING_TRIGGERED": return "boss-warning";
    case "COMPANION_DOWNED": return "ally-down";
    default: return event?.type ? event.type.toLowerCase().replaceAll("_", "-") : null;
  }
}

// Reward and equipment card previews use the same authored prop meshes that
// appear in the live world. Text/glyph fallbacks remain for semantic reward
// kinds without an authored prop.
const PROP_MODELS = Object.freeze({
  "stillwater-hourglass": PROP_RELIC_MESH,
  "bulwark-brand": PROP_BLADE_MESH,
  "abyssal-banner": PROP_RELIC_MESH,
  "warden-lantern": PROP_BLADE_MESH,
  "choir-ward-crystal": PROP_RELIC_MESH,
});
const EQUIPMENT_TIER_MODELS = Object.freeze({
  T1: PROP_BLADE_MESH,
  T2: PROP_RELIC_MESH,
  T3: PROP_BLADE_MESH,
  T4: PROP_RELIC_MESH,
  T5: PROP_BLADE_MESH,
});
const VFX_LIFETIME_TICKS = Object.freeze({
  INPUT_ACCEPTED: 12,
  INPUT_REJECTED: 18,
  OBJECTIVE_FAILED: 18,
  ENCOUNTER_OBJECTIVE_FAILED: 18,
  PROJECTILE_BLOCKED: 18,
  PROJECTILE_EXPIRED: 12,
  CRITICAL_HIT: 18,
  MELEE_IMPACT: 8,
  PROJECTILE_IMPACT: 8,
  SKILL_RESOLVED_DAMAGE: 10,
  COMMANDER_DAMAGED: 12,
  COMPANION_DAMAGED: 12,
  ITEM_COLLECTED: 24,
  OBJECTIVE_PHASE_CHANGED: 36,
  ENCOUNTER_OBJECTIVE_STARTED: 36,
  OBJECTIVE_COMPLETED: 72,
  ENCOUNTER_OBJECTIVE_COMPLETED: 42,
  WAVE_CLEARED: 36,
  EXTRACTION_WINDOW_OPENED: 60,
  OCCUPATION_CAPTURED: 48,
  EXTRACTION_COMPLETED: 60,
  BOSS_ATTACK_TELEGRAPHED: 45,
  BOSS_SPAWNED: 90,
  BOSS_RALLY_WINDOW: 90,
  GATE_BREACHED: 36,
  WARDENS_WARD_TRIGGERED: 60,
  ECHO_WARDEN_AWAKENING_TRIGGERED: 120,
  COMPANION_DOWNED: 48,
  TERMINAL: 90,
});
const CRITICAL_VFX_EVENT_TYPES = Object.freeze([
  "CRITICAL_HIT",
  "BOSS_ATTACK_TELEGRAPHED",
  "BOSS_RALLY_WINDOW",
  "BOSS_SPAWNED",
  "EXTRACTION_WINDOW_OPENED",
  "GATE_BREACHED",
  "WARDENS_WARD_TRIGGERED",
  "ECHO_WARDEN_AWAKENING_TRIGGERED",
  "COMPANION_DOWNED",
  "OBJECTIVE_PHASE_CHANGED",
  "ENCOUNTER_OBJECTIVE_STARTED",
  "OBJECTIVE_COMPLETED",
  "ENCOUNTER_OBJECTIVE_COMPLETED",
  "OCCUPATION_CAPTURED",
  "OBJECTIVE_FAILED",
  "ENCOUNTER_OBJECTIVE_FAILED",
  "TERMINAL",
]);
const QUEST_VFX_PRESENTATIONS = Object.freeze({
  OBJECTIVE_PHASE_CHANGED: Object.freeze({
    intent: "telegraph", role: "route-objective", color: new THREE.Color(0x5de6ff), scale: 0.9, lifetime: 36,
  }),
  ENCOUNTER_OBJECTIVE_STARTED: Object.freeze({
    intent: "telegraph", role: "route-objective", color: new THREE.Color(0x5de6ff), scale: 0.9, lifetime: 36,
  }),
  ENCOUNTER_OBJECTIVE_COMPLETED: Object.freeze({
    intent: "success", role: "route-objective", color: new THREE.Color(0x66f0bd), scale: 1.1, lifetime: 42,
  }),
  OCCUPATION_CAPTURED: Object.freeze({
    intent: "contact", role: "occupation-focus", color: new THREE.Color(0xa06bff), scale: 1.2, lifetime: 48,
  }),
  BOSS_SPAWNED: Object.freeze({
    intent: "boss", role: "boss-threshold", color: new THREE.Color(0xffa43a), scale: 1.45, lifetime: 90,
  }),
  OBJECTIVE_COMPLETED: Object.freeze({
    intent: "completion", role: "extraction-beacon", color: new THREE.Color(0xffd66b), scale: 1.35, lifetime: 72,
  }),
});

function questVfxPresentationForEvent(event) {
  return QUEST_VFX_PRESENTATIONS[event?.type] ?? null;
}

// Rigged character GLBs embed the canonical 11-clip action library named
// "<assetId>::<action>::v01". The commander additionally authors exact
// attack_melee / attack_ranged delivery clips; other actors may omit those
// two and deterministically fall back to attack / critical. Terrain GLBs carry
// no actions; authored stage VFX GLBs carry a named loop clip, while other
// unrigged models simply skip animation.
const RIG_ACTION_KEYS = Object.freeze([
  "idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show",
  "attack_melee", "attack_ranged",
]);
const STAGE_NPC_STORY_ACTIONS = Object.freeze({
  questAcquisition: Object.freeze(["show"]),
  occupationReversal: Object.freeze(["bighit", "defence"]),
  bossEntry: Object.freeze(["defence"]),
  questCompletion: Object.freeze(["show"]),
});
const LOCOMOTION_ACTION_KEYS = Object.freeze(["idle", "move", "run"]);
const RANGED_COMBAT_IDENTITIES = Object.freeze(["ranged", "support"]);
const MELEE_COMBAT_IDENTITIES = Object.freeze(["rusher", "flanker", "guardian", "vanguard", "striker"]);
const COMBAT_PRESENTATION_MODELS = Object.freeze({
  melee: Object.freeze({
    weapon: PROP_BLADE_MESH,
    effects: Object.freeze(["assets/motion/stage-vfx/cinder-span-ember-wake.glb"]),
  }),
  ranged: Object.freeze({
    weapon: PROP_RELIC_MESH,
    effects: Object.freeze([
      "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
      "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
    ]),
  }),
});
const PROJECTILE_PRESENTATIONS = Object.freeze({
  orb: Object.freeze({
    family: "orb",
    geometry: "faceted-orb-ring",
    material: "cyan-additive",
    motion: "hover-pulse-orbit",
  }),
  bolt: Object.freeze({
    family: "bolt",
    geometry: "tapered-bolt",
    material: "amber-additive",
    motion: "forward-spin-stretch",
  }),
  slash: Object.freeze({
    family: "slash",
    geometry: "crescent-arc",
    material: "violet-additive",
    motion: "corkscrew-wave",
  }),
});
const PROJECTILE_ROLE_FAMILY = Object.freeze({
  support: "orb",
  ranged: "bolt",
  striker: "bolt",
  vanguard: "slash",
  guardian: "slash",
  flanker: "slash",
  rusher: "slash",
});
const PROJECTILE_OWNER_FAMILY = Object.freeze({
  "throne-echo": "orb",
  "dawnless-crown": "orb",
  "requiem-warden": "orb",
  "ember-cohort": "bolt",
  "rift-lens": "bolt",
  "lantern-reaver": "bolt",
  "anchor-shard": "slash",
  "veil-vanguard": "slash",
  "pack-warden": "slash",
});
const PROJECTILE_FAMILIES = Object.freeze(["orb", "bolt", "slash"]);
const PROJECTILE_HEIGHT = Object.freeze({ orb: 0.62, bolt: 0.48, slash: 0.58 });
const PROJECTILE_ARC_HEIGHT = Object.freeze({ orb: 0.34, bolt: 0.08, slash: 0.2 });
// A repeated combat beat restarts its clip instead of being swallowed, so a
// fast combo reads as N hits rather than one long hit. The restart is floored
// by one frame of the clip's OWN elapsed time (AnimationAction#time), so a
// snapshot carrying several same-beat events cannot pin the clip at frame 0.
// Using the action's clock keeps this free of any parallel timer.
const ONE_SHOT_RESTART_MIN_ELAPSED_SECONDS = 1 / 60;
// Presentation weight of each one-shot beat. Reactions outrank actions: a
// flinch, guard, dodge, or stagger tells the player what just happened to them,
// while a repeated swing is re-announced by the next fire event anyway. The
// queue keeps ONE slot -- a deeper queue would replay stale reactions seconds
// after the hit that caused them -- so the highest-priority beat wins and ties
// go to the freshest event.
const BEAT_PRIORITY = Object.freeze({
  die: 100,
  bighit: 60,
  defence: 50,
  avoid: 50,
  hit: 40,
  critical: 30,
  attack: 30,
  attack_melee: 30,
  attack_ranged: 30,
  show: 10,
});
const DEFAULT_BEAT_PRIORITY = 20;
// Impact must land on the first frame, so heavy beats snap in; an entrance is
// the one beat that should ease in instead of popping.
const ONE_SHOT_ENTRY_FADE_SECONDS = Object.freeze({
  bighit: 0.03,
  hit: 0.05,
  avoid: 0.06,
  defence: 0.06,
  attack: 0.08,
  attack_melee: 0.08,
  attack_ranged: 0.08,
  critical: 0.08,
  show: 0.2,
});
const DEFAULT_ONE_SHOT_ENTRY_FADE_SECONDS = 0.08;
// Returning to locomotion carries the beat's weight: a stagger drains back
// slowly, a swing snaps back so the next swing reads as its own beat.
const LOCOMOTION_RECOVERY_FADE_SECONDS = Object.freeze({
  bighit: 0.28,
  defence: 0.2,
  show: 0.2,
  avoid: 0.18,
  hit: 0.15,
  attack: 0.12,
  attack_melee: 0.12,
  attack_ranged: 0.12,
  critical: 0.12,
});
const DEFAULT_LOCOMOTION_RECOVERY_FADE_SECONDS = 0.15;

function beatPriority(key) {
  return BEAT_PRIORITY[key] ?? DEFAULT_BEAT_PRIORITY;
}

function oneShotEntryFadeSeconds(key) {
  return ONE_SHOT_ENTRY_FADE_SECONDS[key] ?? DEFAULT_ONE_SHOT_ENTRY_FADE_SECONDS;
}

function locomotionRecoveryFadeSeconds(key) {
  return LOCOMOTION_RECOVERY_FADE_SECONDS[key] ?? DEFAULT_LOCOMOTION_RECOVERY_FADE_SECONDS;
}
const AMBIENT_BREATH_CYCLE_SECONDS = 4.2;
const AMBIENT_WEIGHT_CYCLE_SECONDS = 6.4;
const AMBIENT_LOOK_CYCLE_SECONDS = 11;
const AMBIENT_BREATH_SCALE = 0.012;
const AMBIENT_WEIGHT_ROLL = THREE.MathUtils.degToRad(1.15);
const AMBIENT_LOOK_YAW = THREE.MathUtils.degToRad(8);
// Commander/boss records have no authored combat role. Their delivery is
// classified from the live source-target separation instead: one largest
// authored actor silhouette is the presentation-space close-contact bound.
const MELEE_PRESENTATION_DISTANCE = TARGET_HEIGHT.boss;
// --- Impact feel constants (presentation-only) ---------------------------
// Normal contact is cyan. Critical contact keeps a purple emissive core with
// a gold albedo edge, so the distinction survives bright stage lighting.
const IMPACT_FLASH_COLOR = new THREE.Color(0x5de6ff);
const IMPACT_FLASH_HEAVY_COLOR = new THREE.Color(0xa06bff);
const IMPACT_FLASH_CRITICAL_ACCENT = new THREE.Color(0xffd66b);
const IMPACT_FLASH_MS = 180;
const IMPACT_FLASH_HEAVY_MS = 320;
const IMPACT_FLASH_PEAK = 0.55;
const IMPACT_FLASH_HEAVY_PEAK = 1.1;
const IMPACT_CONTACT_STAGGER_MS = 34;
const MAX_IMPACT_STAGGER_TARGETS = 5;
// Knockback is a render-space offset in world units along the attacker to
// target axis; updateActorFollow() pulls the root back to the authoritative
// position every frame, so these stay well under one actor width.
const IMPACT_KNOCKBACK_MS = 160;
const IMPACT_KNOCKBACK_HEAVY_MS = 260;
const IMPACT_KNOCKBACK_DISTANCE = 0.12;
const IMPACT_KNOCKBACK_HEAVY_DISTANCE = 0.26;
// Camera impulse is admitted only for heavy, critical, or boss contacts and
// is bounded so it cannot disturb the authored orbit framing.
const IMPACT_SHAKE_MS = 220;
const IMPACT_SHAKE_AMPLITUDE = 0.07;
const IMPACT_SHAKE_BOSS_AMPLITUDE = 0.13;
const IMPACT_SHAKE_MAX_AMPLITUDE = 0.13;
const IMPACT_SHAKE_FREQUENCY = 38;
// Each entry maps an emitted contact event to its presentation participants.
// Windup/fire events are deliberately absent: they are not authoritative hits.
const IMPACT_FEEDBACK_SOURCES = Object.freeze({
  MELEE_IMPACT: (event) => ({
    attackerId: event?.sourceId ?? event?.entityId,
    targetId: event?.targetId,
    heavy: event?.heavy === true,
    critical: event?.critical === true,
  }),
  SKILL_RESOLVED_DAMAGE: (event) => ({
    attackerId: event?.sourceId,
    targetId: event?.targetId,
    heavy: event?.heavy === true || event?.critical === true,
    critical: event?.critical === true,
  }),
  CRITICAL_HIT: (event) => ({
    attackerId: event?.entityId,
    targetId: event?.targetId,
    heavy: true,
    critical: true,
  }),
  ENEMY_ATTACK: (event) =>
    finite(event?.damage, 0) > 0
      ? { attackerId: event.entityId, targetId: event.targetId, heavy: event?.heavy === true, critical: false }
      : null,
  PROJECTILE_IMPACT: (event) =>
    event?.hit === false
      ? null
      : {
        attackerId: event?.sourceId ?? event?.ownerId,
        targetId: event?.targetId,
        heavy: event?.heavy === true,
        critical: event?.critical === true,
      },
  COMMANDER_DAMAGED: (event) => ({
    attackerId: event?.sourceId ?? event?.entityId,
    targetId: "commander",
    heavy: event?.heavy === true,
    critical: event?.critical === true,
  }),
  COMPANION_DAMAGED: (event) => ({
    attackerId: event?.sourceId,
    targetId: event?.entityId,
    heavy: event?.heavy === true,
    critical: event?.critical === true,
  }),
});
// Movement in this simulation is continuous position sync (app.js's
// projected() feeds ARENA-scale x/y every tick), not a discrete "moving"
// flag -- MOVE_EPSILON is the per-frame world-unit position delta above
// which an actor is considered to be walking rather than idle. Tuned well
// below the commander's per-tick displacement at the slowest authored
// movement speed (defense-run-simulation.js COMMANDER.speed), scaled into
// WORLD_SCALE world units, so idle jitter from camera-relative rounding
// never falsely reads as "move".
const MOVE_EPSILON = 0.01;

// --- Presentation-layer facing rotation (D23 Phase 1) ---------------------
// Actors turn to face the direction they are travelling. This is PURELY a
// render-side read of consecutive snapshot positions: nothing here is ever
// written back into the simulation, so getRunDigest() cannot observe it
// (D23's hard constraint -- the renderer may only read a frozen snapshot).
//
// MODEL_FORWARD_YAW_OFFSET compensates for the authored forward axis of the
// GLB library. Measured, not assumed: rendering companions/ember-cohort.glb
// from 4 cardinal angles under even 4-way lighting puts the face, chest
// armour and forward-held weapon at Blender -Y, which the glTF importer's
// Y-up conversion maps to +Z in three.js space -- so yaw 0 already aims the
// model along +Z and no correction is needed. Every character comes from one
// rig batch (scripts/rig-character-asset-blender.py), so this is a
// library-wide constant rather than a per-asset table; a future batch authored
// to a different axis is corrected here alone.
const MODEL_FORWARD_YAW_OFFSET = 0;
// Radians per second. Fast enough that a full reversal completes in ~0.26s
// (visible as a turn, not a slide), slow enough that the turn reads as
// motion at all -- an instant snap loses the cue entirely.
const FACING_TURN_RATE = 12;
// Per-second catch-up rate for the companion follow trail (see
// updateActorFollow()). At 30/s the render position closes ~93% of its gap
// in 90ms: enough softness to read as "following", short enough that a
// companion never appears to be somewhere it is not.
const FOLLOW_CATCHUP_RATE = 30;

const COLORS = Object.freeze({
  backgroundTop: 0x0a0f1d,
  backgroundBottom: 0x030712,
  gate: 0x00f0ff,
  projectile: 0x00f0ff,
  pickup: 0xffaa00,
  ambient: 0x33445a,
  key: 0xfff0d8,
  rim: 0x6ea8ff,
});

// Three canonical mesh-first stages use their authored accents for fog, key,
// ambient, and environment tint. These values are presentation-only and never
// feed the deterministic simulation.
const STAGE_PALETTE_TINTS = Object.freeze({
  "cinder-span": 0xf3592c,
  "abyss-chancel": 0x8f67ff,
  "echo-throne": 0x72c8ff,
});

// Authored near/far values stay stage-specific. Phase escalation may only
// increase far enough to keep the worst boundary threat at clarity >= 0.75;
// near is never changed and far is never reduced below the authored value.
const STAGE_FOG_BASE = Object.freeze({ near: 1.8, far: 4.2 });
const STAGE_FOG_MULTIPLIERS = Object.freeze({
  "cinder-span": Object.freeze({ near: 1.6, far: 3.6 }),
  "abyss-chancel": Object.freeze({ near: 1.5, far: 3.3 }),
  "echo-throne": Object.freeze({ near: 1.4, far: 3.0 }),
});
const MIN_BOUNDARY_CLARITY = 0.75;

// A stage-only fog query describes the first playable encounter tier. Camera
// motion still opens at DESCENT, while the encounter state enters SKIRMISH as
// soon as objective zero is active; explicit phase callers retain the authored
// DESCENT range for cutscenes.
export function stageFogRange(stageId, phase = "SKIRMISH") {
  const authored = STAGE_FOG_MULTIPLIERS[stageId] ?? STAGE_FOG_BASE;
  const phaseTier = CAMERA_PHASE_TIERS[phase] ?? CAMERA_PHASE_TIERS[DEFAULT_CAMERA_PHASE];
  const near = WORLD_SCALE * authored.near;
  const authoredFar = WORLD_SCALE * authored.far;
  const requiredFar = (phaseTier.boundaryDepth - MIN_BOUNDARY_CLARITY * near)
    / (1 - MIN_BOUNDARY_CLARITY);
  return { near, far: Math.max(authoredFar, requiredFar) };
}

function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function list(snapshot, ...names) {
  for (const name of names) {
    const value = snapshot?.[name];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function bounds(canvas, viewport) {
  const width = Math.max(1, finite(canvas?.clientWidth, finite(viewport?.width, canvas?.width)) || canvas?.width || 1);
  const height = Math.max(1, finite(canvas?.clientHeight, finite(viewport?.height, canvas?.height)) || canvas?.height || 1);
  return { width, height };
}

const WORLD_WIDTH = 24000;
const WORLD_HEIGHT = 12000;

// Dual-mode coordinate resolver, matching the pre-existing Canvas2D
// renderer's contract exactly (screenPoint()/terrainPoint() in the prior
// implementation): entities are normalized to [-1, 1] by app.js's
// projected() in the live app, but the renderer-contract test suite feeds
// raw ARENA-scale coordinates (0..24000 / 0..12000) directly. Detect by
// the same heuristic the old code used (`entity.normalized === true` or
// both axes within [-1, 1]) and map either to world units centered on the
// WORLD_SCALE-sized ground plane.
function worldPointInto(target, entity) {
  const x = finite(entity?.x, 0);
  const y = finite(entity?.y, 0);
  if (entity?.normalized === true || (Math.abs(x) <= 1 && Math.abs(y) <= 1)) {
    target.x = x * WORLD_SCALE;
    target.z = y * WORLD_SCALE;
  } else {
    target.x = (x / WORLD_WIDTH * 2 - 1) * WORLD_SCALE;
    target.z = (y / WORLD_HEIGHT * 2 - 1) * WORLD_SCALE;
  }
  target.y = finite(entity?.elevation, 0) * WORLD_SCALE / (WORLD_WIDTH / 2);
  return target;
}

function worldPoint(entity) {
  return worldPointInto({}, entity);
}

// Numeric-hygiene wrap for orbitYaw, which accumulates without limit
// across a session (camera-orbit-implementation-plan-20260725.md §3.1) --
// a full 2*PI revolution is visually identical to no rotation at all, so
// this only prevents unbounded float growth over a long play session, it
// never changes the rendered camera angle.
function wrapAngle(radians) {
  const twoPi = Math.PI * 2;
  return ((radians % twoPi) + twoPi + Math.PI) % twoPi - Math.PI;
}

function stableStringHash(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function projectilePresentationFor(projectile = {}, sourceEntity = null) {
  const identity = sourceEntity?.role ?? sourceEntity?.kind ?? null;
  let family = PROJECTILE_ROLE_FAMILY[identity] ?? PROJECTILE_OWNER_FAMILY[projectile?.owner];
  if (!family && projectile?.owner === "commander") family = "orb";
  if (!family && (sourceEntity?.class === "boss" || sourceEntity?.kind === "ranged")) family = "bolt";
  if (!family) {
    const stableIdentity = projectile?.owner ?? projectile?.sourceId ?? projectile?.id ?? "";
    family = PROJECTILE_FAMILIES[stableStringHash(stableIdentity) % PROJECTILE_FAMILIES.length];
  }
  return PROJECTILE_PRESENTATIONS[family];
}

function resolveStageId(snapshot) {
  return snapshot?.presentation?.stageId ?? (typeof snapshot?.stageId === "string" ? snapshot.stageId : null);
}

// The simulation may expose either an accepted camera tier, this tick's
// immutable presentation events, or stable objective state. Resolve those
// sources in that order without inventing a renderer-owned phase enum.
function resolveCameraPhase(snapshot) {
  const phase = snapshot?.objectives?.phase;
  if (Object.hasOwn(CAMERA_PHASE_TIERS, phase)) return phase;

  const tick = snapshot?.tick;
  let eventTier = null;
  let eventTierRank = 0;
  if (Number.isInteger(tick) && Array.isArray(snapshot?.events)) {
    for (const event of snapshot.events) {
      if (event?.tick !== tick) continue;
      let tier = null;
      let rank = 0;
      switch (event.type) {
        case "BOSS_SPAWNED":
          tier = "FINALE";
          rank = 5;
          break;
        case "MIDBOSS_SPAWNED":
          tier = "MIDBOSS";
          rank = 4;
          break;
        case "WAVE_VARIANT_STARTED":
          if (event.kind === "big") {
            tier = "BIGWAVE";
            rank = 3;
          } else if (event.kind === "normal") {
            tier = "SKIRMISH";
            rank = 2;
          }
          break;
        case "ENCOUNTER_OBJECTIVE_STARTED":
          if (Number.isInteger(event.objectiveIndex) && event.objectiveIndex >= 0) {
            tier = event.objectiveIndex === 0 ? "SKIRMISH" : "SURGE";
            rank = 1;
          }
          break;
        default:
          break;
      }
      if (rank > eventTierRank) {
        eventTier = tier;
        eventTierRank = rank;
      }
    }
  }
  if (eventTier) return eventTier;

  const encounterObjectiveId = snapshot?.encounter?.objectiveId;
  if (phase === "boss-kill" || encounterObjectiveId === "boss-kill") return "FINALE";
  if (
    phase === "extraction"
    || phase === "complete"
    || encounterObjectiveId === "extraction"
    || snapshot?.objectives?.bossKill?.completed === true
    || snapshot?.extracted === true
  ) {
    return "SURGE";
  }
  const encounterObjectiveIndex = snapshot?.encounter?.objectiveIndex;
  if (Number.isInteger(encounterObjectiveIndex) && encounterObjectiveIndex >= 0) {
    return encounterObjectiveIndex === 0 ? "SKIRMISH" : "SURGE";
  }
  return DEFAULT_CAMERA_PHASE;
}

function standardActorModelPath(entity) {
  if (!entity) return null;
  if (entity.id === "commander") return COMMANDER_MODEL;
  if (entity.class === "boss") {
    return entity.bossId && Object.hasOwn(BOSS_MODELS, entity.bossId)
      ? BOSS_MODELS[entity.bossId]
      : null;
  }
  if (entity.kind === "companion") return meshRootForCompanion(entity.companionId);
  if (typeof entity.kind === "string" && Object.hasOwn(ENEMY_MODELS, entity.kind)) {
    return ENEMY_MODELS[entity.kind];
  }
  return null;
}

function fallbackActorModelPath(entity) {
  if (!entity) return null;
  if (entity.class === "boss") {
    return entity.bossId && Object.hasOwn(BOSS_MODELS, entity.bossId)
      ? BOSS_MODELS[entity.bossId]
      : null;
  }
  if (entity.id === "commander" || entity.kind === "companion") {
    return PLAYER_SOURCE_MESH;
  }
  if (typeof entity.kind === "string" && Object.hasOwn(ENEMY_MODELS, entity.kind)) {
    const standardPath = ENEMY_MODELS[entity.kind];
    const explicitPath = meshRootForMotionCharacter(entity.motionAssetId);
    return explicitPath === standardPath ? PLAYER_SOURCE_MESH : standardPath;
  }
  return null;
}

function actorModelPath(entity) {
  const explicitMotionModel = meshRootForMotionCharacter(entity?.motionAssetId);
  return explicitMotionModel ?? standardActorModelPath(entity);
}

function actorTargetHeight(entity) {
  if (!entity) return TARGET_HEIGHT.enemy;
  if (entity.id === "commander") return TARGET_HEIGHT.commander;
  if (entity.class === "boss") return TARGET_HEIGHT.boss;
  if (entity.kind === "companion") return TARGET_HEIGHT.companion;
  if (entity.elite) return TARGET_HEIGHT.elite;
  return TARGET_HEIGHT.enemy;
}

function createMissingActorMarker() {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 0.5,
    }),
  );
}

function attachMissingActorMarker(record, actorGroup) {
  const marker = createMissingActorMarker();
  record.root = marker;
  record.restScale = marker.scale.clone();
  record.restYaw = marker.rotation.y;
  record.restRoll = marker.rotation.z;
  record.restGroundY = marker.position.y;
  record.loading = false;
  actorGroup.add(marker);
  return marker;
}

function feedbackKey(event) {
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
    event?.text ?? "",
  ]);
}

function questPointForEvent(snapshot, event) {
  const presentation = questVfxPresentationForEvent(event);
  if (!presentation) return null;
  const profile = stageWorldFor(resolveStageId(snapshot) ?? event?.stageId);
  const points = profile?.presentation?.questPoints;
  if (!Array.isArray(points)) return null;
  const questId = event?.quest?.questId ?? event?.storyBeat?.questId;
  const bindingType = event?.type === "ENCOUNTER_OBJECTIVE_STARTED"
    || event?.type === "OBJECTIVE_PHASE_CHANGED"
    ? "ENCOUNTER_OBJECTIVE_COMPLETED"
    : event?.type;
  const bindingSources = [event, event?.quest, event?.storyBeat?.event];
  const mayUseRoleFallback = (event?.type === "ENCOUNTER_OBJECTIVE_STARTED"
    || event?.type === "OBJECTIVE_PHASE_CHANGED")
    && Boolean(questId || event?.storyBeat);
  let hasBindingData = false;
  let roleFallback = null;
  for (const point of points) {
    if (questId && point.questId !== questId) continue;
    if (mayUseRoleFallback && point.visualRole === presentation.role) roleFallback = point;
    const binding = point.eventBinding;
    if (binding?.type !== bindingType) continue;
    let matchedFields = 0;
    let exact = true;
    for (const [key, value] of Object.entries(binding)) {
      if (key === "type") continue;
      matchedFields += 1;
      const fieldPresent = bindingSources.some((source) => source?.[key] !== undefined);
      hasBindingData ||= fieldPresent;
      if (!bindingSources.some((source) => source?.[key] === value)) exact = false;
    }
    if (matchedFields > 0 && exact) return point;
  }
  return mayUseRoleFallback && !hasBindingData ? roleFallback : null;
}

function effectAnchor(snapshot, event) {
  const questPresentation = questVfxPresentationForEvent(event);
  const questPoint = questPresentation ? questPointForEvent(snapshot, event) : null;
  if (questPoint) return questPoint.placement;
  const targetId = event?.targetId ?? event?.entityId ?? event?.enemyId ?? event?.bossId ?? "";
  if (targetId === "gate" || event?.type === "GATE_BREACHED") return snapshot?.gate ?? snapshot?.base ?? null;
  const target = snapshotEntityById(snapshot, targetId);
  if (target) return target;
  const authoredAnchor = event?.anchor ?? event?.position ?? event?.point;
  if (authoredAnchor && Number.isFinite(authoredAnchor.x) && Number.isFinite(authoredAnchor.y)) {
    return authoredAnchor;
  }
  switch (event?.type) {
    case "INPUT_ACCEPTED":
    case "INPUT_REJECTED":
    case "WARDENS_WARD_TRIGGERED":
    case "COMMANDER_DAMAGED":
      return snapshot?.commander ?? snapshot?.player ?? null;
    default:
      return null;
  }
}

function snapshotEntityById(snapshot, entityId) {
  if (!entityId) return null;
  const commander = snapshot?.commander ?? snapshot?.player;
  if (commander?.id === entityId) return commander;
  const gate = snapshot?.gate ?? snapshot?.base;
  if (gate?.id === entityId || entityId === "gate") return gate;
  for (const entity of list(snapshot, "enemies", "hostiles")) {
    if (entity?.id === entityId || entity?.bossId === entityId) return entity;
  }
  for (const entity of list(snapshot, "companions", "allies")) {
    if (entity?.id === entityId) return entity;
  }
  return null;
}

// Shared loaders and promise caches preserve immutable source data while each
// mounted scene owns its cloned renderables. All runtime assets are GLB.
const gltfLoader = new GLTFLoader();
const gltfCache = new Map();
const meshIntegrityCache = new Map();

// SkeletonUtils.clone() gives each rendered instance an owned skeleton; this
// identity set keeps repeated disposal idempotent when roots overlap.
const disposedSkeletons = new WeakSet();


function modelUrl(path) {
  if (typeof path !== "string" || !path) return null;
  if (path.startsWith("./") || path.startsWith("../") || path.startsWith("/")) return path;
  if (path.startsWith("assets/")) return `./${path}`;
  return null;
}

function loadGltf(path) {
  const url = modelUrl(path);
  if (!url) return Promise.reject(new TypeError("Missing GLB model path"));
  if (!gltfCache.has(url)) {
    const request = new Promise((resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    }).catch((error) => {
      if (gltfCache.get(url) === request) gltfCache.delete(url);
      throw error;
    });
    gltfCache.set(url, request);
  }
  return gltfCache.get(url);
}

// Overlay animation system — 9-clip unarmed motion pack (rest-relative
// quaternion deltas) retargeted onto any DEF-humanoid-v1 character at runtime.
// Design: _workspace/current/overlay-architecture.md
// Contract: RUNTIME_ANIMATION_CONTRACT.md §5
const OVERLAY_ANIMATION_PATH = "assets/motion/ingame/unarmed-core.glb";
// (overlay action keys: idle, move, run, hit, bighit, attack, critical, avoid, defence)
let warnedOverlayLoadFailure = false;
let overlayDeltaEntriesPromise = null;
const adaptedOverlayEntriesByModel = new Map();

function loadOverlayDeltaEntries() {
  if (overlayDeltaEntriesPromise) return overlayDeltaEntriesPromise;
  overlayDeltaEntriesPromise = loadGltf(OVERLAY_ANIMATION_PATH).then((gltf) => {
    const clips = (gltf.animations ?? []).filter((clip) => clip.tracks.length > 0);
    clips.forEach(normalizeOverlayDeltaClip);
    return clips;
  }).catch((err) => {
    if (!warnedOverlayLoadFailure) {
      console.warn("overlay delta pack load failed:", err.message || err);
      warnedOverlayLoadFailure = true;
    }
    return null;
  });
  return overlayDeltaEntriesPromise;
}

function normalizeOverlayDeltaClip(clip) {
  // For each quaternion track, ensure shortest-path continuity: detect and
  // correct flipped (>180°) quaternion sign jumps between adjacent keyframes.
  for (const track of clip.tracks) {
    if (track.ValueTypeName !== "quaternion") continue;
    const values = track.values;
    if (values.length < 8) continue;
    let prevW = values[3];
    for (let i = 4; i < values.length; i += 4) {
      const w = values[i + 3];
      // Negate the entire quaternion if the dot product with the previous
      // quaternion is negative (sign flip > 90° indicates a wraparound).
      if (w * prevW < 0) {
        const d = values[i] * values[i] + values[i + 1] * values[i + 1] + values[i + 2] * values[i + 2] + w * w;
        if (d > 1e-6) {
          values[i] = -values[i];
          values[i + 1] = -values[i + 1];
          values[i + 2] = -values[i + 2];
          values[i + 3] = -w;
        }
      }
      prevW = values[i + 3];
    }
  }
}

function restQuatsFromInstance(instance) {
  // Extract DEF-* bone rest pose quaternions from the cloned scene instance.
  // Immediately after SkeletonUtils.clone() before any animation ticks, every
  // Bone.quaternion holds its rest (bind) pose rotation.
  const restQuats = {};
  instance.traverse((node) => {
    if (node.isBone && node.name.startsWith("DEF-")) {
      restQuats[node.name] = node.quaternion.clone();
    }
  });
  return restQuats;
}

function boneNameFromTrackName(trackName) {
  // Track names follow pattern: "path/to/node.property"
  // or "bone_name.quaternion" / "bone_name.rotation"
  // Strip .quaternion, .rotation, ._quaternion suffixes
  const dot = trackName.lastIndexOf(".");
  if (dot === -1) return trackName;
  const prop = trackName.slice(dot + 1);
  if (prop === "quaternion" || prop === "rotation" || prop === "_quaternion") {
    // Bone name is everything before the last dot
    return trackName.slice(0, dot);
  }
  return trackName;
}

function composeDeltaWithRestPose(clip, restQuats) {
  // For each quaternion track in the clip, pre-multiply every keyframe delta
  // by the character's rest pose quaternion:  adapted = C_rest * delta
  // Mutates clip tracks in place (no new allocation).
  for (const track of clip.tracks) {
    if (track.ValueTypeName !== "quaternion") continue;
    const boneName = boneNameFromTrackName(track.name);
    const restQ = restQuats[boneName];
    if (!restQ) continue;
    const values = track.values;
    const deltaQ = new THREE.Quaternion();
    for (let i = 0; i < values.length; i += 4) {
      deltaQ.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
      deltaQ.premultiply(restQ);
      values[i] = deltaQ.x;
      values[i + 1] = deltaQ.y;
      values[i + 2] = deltaQ.z;
      values[i + 3] = deltaQ.w;
    }
  }
  return clip;
}

function adaptOverlayEntries(modelPath, instance, deltaEntries) {
  if (adaptedOverlayEntriesByModel.has(modelPath)) {
    return adaptedOverlayEntriesByModel.get(modelPath);
  }
  const restQuats = restQuatsFromInstance(instance);
  // Deep-clone each clip so the cached delta entries remain reusable across
  // multiple instances of the same model (no cross-instance mutation).
  const adapted = deltaEntries.map((clip) => ({
    clip: composeDeltaWithRestPose(clip.clone(), restQuats),
    source: "overlay",
  }));
  adaptedOverlayEntriesByModel.set(modelPath, adapted);
  return adapted;
}

function stageNpcFacingYaw(npc, sourcePoint) {
  const target = npc?.attentionTarget
    ?? npc?.presentationCue?.attentionTarget
    ?? npc?.presentationCue?.lookAt;
  if (Number.isFinite(target?.x) && Number.isFinite(target?.y)) {
    const targetPoint = worldPoint(target);
    const dx = targetPoint.x - sourcePoint.x;
    const dz = targetPoint.z - sourcePoint.z;
    if (dx !== 0 || dz !== 0) {
      return wrapAngle(Math.atan2(dx, dz) + MODEL_FORWARD_YAW_OFFSET);
    }
  }
  return finite(npc?.placement?.yawRadians, 0);
}

function fitHeight(object3d, targetHeight) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 1e-6) {
    const scale = targetHeight / size.y;
    object3d.scale.setScalar(scale);
  }
  // Re-measure after scaling and drop the model so its lowest point sits on
  // the ground plane (y=0) -- authored "stand point" per this pack's
  // convention is the root EMPTY near world origin, not necessarily y=0
  // after non-uniform per-part scaling upstream.
  const rescan = new THREE.Box3().setFromObject(object3d);
  object3d.position.y -= rescan.min.y;
}

function fitFootprint(object3d, targetHalfExtent) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  const maxHorizontal = Math.max(size.x, size.z, 1e-6);
  const scale = (targetHalfExtent * 2) / maxHorizontal;
  object3d.scale.setScalar(scale);
}

const OWNED_TEXTURE_KEYS = Object.freeze(["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"]);

function ownRenderableResources(root) {
  const geometries = new Map();
  const materials = new Map();
  const textures = new Map();
  const ownTexture = (texture) => {
    if (!texture?.isTexture) return texture;
    if (!textures.has(texture)) textures.set(texture, texture.clone());
    return textures.get(texture);
  };
  const ownMaterial = (material) => {
    if (!material) return material;
    if (!materials.has(material)) {
      const owned = material.clone();
      for (const key of OWNED_TEXTURE_KEYS) owned[key] = ownTexture(material[key]);
      materials.set(material, owned);
    }
    return materials.get(material);
  };
  root.traverse((node) => {
    if (!node.isMesh) return;
    if (node.geometry) {
      if (!geometries.has(node.geometry)) geometries.set(node.geometry, node.geometry.clone());
      node.geometry = geometries.get(node.geometry);
    }
    node.material = Array.isArray(node.material)
      ? node.material.map(ownMaterial)
      : ownMaterial(node.material);
  });
  return root;
}

// Extracts "<action>" from a clip named "<assetId>::<action>::v01" (the rig
// pipeline's naming convention) -- tolerant of a bare/unnamespaced clip name
// too so a non-pipeline-authored GLB with a plain "idle"/"attack" clip still
// works.
function actionKeyFromClipName(name) {
  const parts = typeof name === "string" ? name.split("::") : [];
  const candidate = parts.length >= 2 ? parts[1] : parts[0];
  return RIG_ACTION_KEYS.includes(candidate) ? candidate : null;
}

// Builds an { actionKey -> AnimationAction } map for every rig-pipeline clip
// present on this GLB's animations array (RIG_ACTION_KEYS doc comment above
// explains why not every model has any). idle/move/run loop; every other
// action is a one-shot combat beat that holds its last pose instead of
// snapping back to frame 0.
function buildActions(mixer, clipEntries) {
  const actions = {};
  const actionSources = {};
  for (const entry of clipEntries) {
    const clip = entry?.clip ?? entry;
    const source = entry?.source ?? "base";
    const key = actionKeyFromClipName(clip.name);
    if (!key || actions[key]) continue;
    const action = mixer.clipAction(clip);
    if (LOCOMOTION_ACTION_KEYS.includes(key)) {
      action.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
    actionSources[key] = source;
  }
  return { actions, actionSources };
}

// Heavy instantiation (SkeletonUtils.clone of a rigged GLB plus its bounding
// passes) is serialized across frames. Several actors can spawn on one
// simulation tick, and cloning them back to back inside one frame starves the
// main thread long enough that a software-WebGL device stops answering input.
// Work still starts as soon as the previous unit finishes, so this costs a
// frame of latency, never a dropped actor.
let instantiationQueue = Promise.resolve();
let instantiationBusy = false;

function serializeInstantiation(work) {
  // Nothing in flight: run now. A lone spawn must not pay a frame of latency
  // just because a burst is possible.
  if (!instantiationBusy) {
    instantiationBusy = true;
    const immediate = (async () => work())();
    const settle = () => { instantiationBusy = false; };
    instantiationQueue = immediate.then(settle, settle);
    return immediate;
  }
  // Contended: yield to the compositor so a tick that spawns several actors
  // cannot clone them all inside one frame.
  const scheduled = instantiationQueue.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return work();
  });
  instantiationQueue = scheduled.then(() => {}, () => {});
  return scheduled;
}

// The character pipeline stamps `celShadowBands: 3` and
// `celRampPolicy: "runtime-lighting"` on every authored toon material and then
// stops: the banding is deliberately left to the renderer, because a baked ramp
// would fight the per-stage palette. Nothing implemented it, so the cast shipped
// as smooth PBR.
//
// The albedo half of that problem is fixed upstream now:
// scripts/bake-character-albedo.py bakes a per-character cartoon atlas into each
// character's own UV unwrap, so the diffuse term has authored banding to shade
// instead of one shared 256 px detail tile times a flat baseColorFactor.

//
// A 3-step gradient ramp with nearest filtering turns the diffuse term into hard
// bands, which is what makes a flat tint read as cel shading. MeshToonMaterial
// also drops the PBR environment work, so this is cheaper than what it replaces.
const CEL_SHADOW_BANDS = 3;
let celGradientMap = null;

function celGradient() {
  if (celGradientMap) return celGradientMap;
  const steps = new Uint8Array(CEL_SHADOW_BANDS);
  for (let index = 0; index < CEL_SHADOW_BANDS; index += 1) {
    // Lift the darkest band off zero so shadowed sides stay readable silhouettes
    // rather than collapsing into the background.
    steps[index] = Math.round(70 + (185 * index) / (CEL_SHADOW_BANDS - 1));
  }
  celGradientMap = new THREE.DataTexture(steps, CEL_SHADOW_BANDS, 1, THREE.RedFormat);
  celGradientMap.minFilter = THREE.NearestFilter;
  celGradientMap.magFilter = THREE.NearestFilter;
  celGradientMap.generateMipmaps = false;
  celGradientMap.needsUpdate = true;
  return celGradientMap;
}

function toonMaterial(material) {
  if (!material || material.isMeshToonMaterial) return material;
  const toon = new THREE.MeshToonMaterial({
    name: material.name,
    color: material.color ? material.color.clone() : undefined,
    map: material.map ?? null,
    normalMap: material.normalMap ?? null,
    normalScale: material.normalScale ? material.normalScale.clone() : undefined,
    emissive: material.emissive ? material.emissive.clone() : undefined,
    emissiveMap: material.emissiveMap ?? null,
    emissiveIntensity: material.emissiveIntensity ?? 1,
    alphaMap: material.alphaMap ?? null,
    transparent: material.transparent ?? false,
    opacity: material.opacity ?? 1,
    alphaTest: material.alphaTest ?? 0,
    side: material.side,
    gradientMap: celGradient(),
  });
  toon.userData = { ...material.userData, celShadowBands: CEL_SHADOW_BANDS };
  return toon;
}

function applyCelShading(root) {
  const converted = new Map();
  root.traverse((node) => {
    if (!node.isMesh) return;
    const convert = (material) => {
      if (!converted.has(material)) converted.set(material, toonMaterial(material));
      return converted.get(material);
    };
    node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
  });
  return root;
}

async function instantiateActorModel(relPath, targetHeight) {
  // Load the character GLB and overlay delta pack in parallel.
  // If overlay fails to load, overlayDeltaEntries is null — fall back to base clips.
  const [gltf, overlayDeltaEntries] = await Promise.all([
    loadGltf(relPath),
    loadOverlayDeltaEntries(),
  ]);
  return serializeInstantiation(() => {
    // SkeletonUtils.clone() (not gltf.scene.clone()) so a SkinnedMesh instance
    // gets bound to its own cloned skeleton.
    const instance = SkeletonUtils.clone(gltf.scene);
    fitHeight(instance, targetHeight);
    applyCelShading(instance);
    const baseEntries = (gltf.animations ?? []).map((clip) => ({ clip, source: "base" }));
    if (!baseEntries.length) return { instance, mixer: null, actions: {}, actionSources: {} };
    const mixer = new THREE.AnimationMixer(instance);
    let allEntries = baseEntries;
    if (overlayDeltaEntries) {
      const adapted = adaptOverlayEntries(relPath, instance, overlayDeltaEntries);
      if (adapted.length) {
        // Overlay entries appear before base entries. buildActions() first-match
        // wins on duplicate action keys, so the overlay registration
        // for a key wins over the base registration that follows. Nine overlay
        // keys replace base; the 4 fallback-only keys (die, show, attack_melee,
        // attack_ranged) have no overlay entry and fall through to base.
        allEntries = [...adapted, ...baseEntries];
      }
    }
    const { actions, actionSources } = buildActions(mixer, allEntries);
    return { instance, mixer, actions, actionSources };
  });
}

function inspectMeshIntegrity(root, label) {
  let meshCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  let invalidVertexCount = 0;
  let invalidIndexCount = 0;
  root.updateWorldMatrix(true, true);
  root.traverse((node) => {
    if (!node.isMesh) return;
    meshCount += 1;
    const position = node.geometry?.getAttribute?.("position");
    if (!position || position.count < 3) {
      invalidVertexCount += 1;
      return;
    }
    vertexCount += position.count;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) invalidVertexCount += 1;
    }
    const indices = node.geometry?.index;
    triangleCount += Math.floor((indices?.count ?? position.count) / 3);
    if (!indices) return;
    for (let index = 0; index < indices.count; index += 1) {
      const value = indices.getX(index);
      if (!Number.isInteger(value) || value < 0 || value >= position.count) invalidIndexCount += 1;
    }
  });
  const bounds = new THREE.Box3().setFromObject(root);
  const finiteBounds = !bounds.isEmpty()
    && Number.isFinite(bounds.min.x) && Number.isFinite(bounds.min.y) && Number.isFinite(bounds.min.z)
    && Number.isFinite(bounds.max.x) && Number.isFinite(bounds.max.y) && Number.isFinite(bounds.max.z);
  const report = Object.freeze({
    meshCount,
    vertexCount,
    triangleCount,
    invalidVertexCount,
    invalidIndexCount,
    finiteBounds,
  });
  if (meshCount === 0 || vertexCount === 0 || triangleCount === 0
    || invalidVertexCount > 0 || invalidIndexCount > 0 || !finiteBounds) {
    throw new Error(`Invalid render mesh ${label}: ${JSON.stringify(report)}`);
  }
  return report;
}

function inspectMeshIntegrityOnce(root, cacheKey, label = cacheKey) {
  if (!cacheKey) return inspectMeshIntegrity(root, label);
  let topology = meshIntegrityCache.get(cacheKey);
  if (!topology) {
    topology = inspectMeshIntegrity(root, label);
    meshIntegrityCache.set(cacheKey, topology);
  }
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const finiteBounds = !bounds.isEmpty()
    && Number.isFinite(bounds.min.x) && Number.isFinite(bounds.min.y) && Number.isFinite(bounds.min.z)
    && Number.isFinite(bounds.max.x) && Number.isFinite(bounds.max.y) && Number.isFinite(bounds.max.z);
  const report = Object.freeze({ ...topology, finiteBounds });
  if (!finiteBounds) throw new Error(`Invalid render mesh ${label}: ${JSON.stringify(report)}`);
  return report;
}

function groundObjectOnPlane(root, groundY, label) {
  root.updateWorldMatrix(true, true);
  const before = new THREE.Box3().setFromObject(root);
  if (before.isEmpty() || !Number.isFinite(before.min.y)) throw new Error(`Cannot ground empty render mesh ${label}`);
  root.position.y += groundY - before.min.y;
  root.updateWorldMatrix(true, true);
  const after = new THREE.Box3().setFromObject(root);
  if (after.isEmpty() || !Number.isFinite(after.min.y) || Math.abs(after.min.y - groundY) > 1e-4) {
    throw new Error(`Render mesh penetrates support plane ${label}: ${after.min.y}`);
  }
  return after.min.y;
}

/**
 * Promoted terrain GLBs are cloned and inspected once before attachment.
 */
async function instantiateTerrainModel(relPath) {
  const gltf = await loadGltf(relPath);
  const instance = SkeletonUtils.clone(gltf.scene);
  ownRenderableResources(instance);
  fitFootprint(instance, TERRAIN_TARGET_HALF_EXTENT);
  instance.userData.meshIntegrity = inspectMeshIntegrityOnce(instance, `terrain:${relPath}`, relPath);
  instance.userData.terrainSource = "promoted-glb";
  return instance;
}

function instantiateProceduralTerrain(profile) {
  const min = worldPoint({ x: profile.gameplay.bounds.minX, y: profile.gameplay.bounds.minY, elevation: 0 });
  const max = worldPoint({ x: profile.gameplay.bounds.maxX, y: profile.gameplay.bounds.maxY, elevation: 0 });
  const geometry = new THREE.PlaneGeometry(max.x - min.x, max.z - min.z, 12, 6);
  geometry.rotateX(-Math.PI / 2);
  const tint = STAGE_PALETTE_TINTS[profile.stageId] ?? STAGE_PALETTE_TINTS["cinder-span"];
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x05070d).lerp(new THREE.Color(tint), 0.08),
    roughness: 0.94,
    metalness: 0.03,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((min.x + max.x) / 2, 0, (min.z + max.z) / 2);
  mesh.receiveShadow = false;
  const root = new THREE.Group();
  root.name = `procedural-terrain:${profile.stageId}`;
  root.add(mesh);
  ownRenderableResources(root);
  root.userData.meshIntegrity = inspectMeshIntegrityOnce(root, `procedural-terrain:${profile.stageId}`, root.name);
  root.userData.terrainSource = profile.terrainFallback?.kind ?? "procedural-flat-support";
  return root;
}

async function instantiatePickupModel(relPath) {
  const gltf = await loadGltf(relPath);
  const instance = SkeletonUtils.clone(gltf.scene);
  ownRenderableResources(instance);
  fitHeight(instance, TARGET_HEIGHT.pickup);
  instance.userData.meshIntegrity = inspectMeshIntegrityOnce(instance, `pickup:${relPath}`, relPath);
  instance.userData.groundedMinY = groundObjectOnPlane(instance, 0, relPath);
  return instance;
}

async function instantiatePresentationModel(relPath, targetHeight) {
  const gltf = await loadGltf(relPath);
  const instance = SkeletonUtils.clone(gltf.scene);
  ownRenderableResources(instance);
  fitHeight(instance, targetHeight);
  const clip = gltf.animations?.find(({ name }) => /::loop::/i.test(name)) ?? gltf.animations?.[0] ?? null;
  const mixer = clip ? new THREE.AnimationMixer(instance) : null;
  const action = mixer?.clipAction(clip) ?? null;
  action?.setLoop(THREE.LoopRepeat, Infinity).reset().play();
  return { instance, mixer, action };
}
async function instantiateAppearanceModel(reward) {
  const gltf = await loadGltf(reward.modelPath);
  const instance = SkeletonUtils.clone(gltf.scene);
  ownRenderableResources(instance);
  const scale = finite(reward.scale, 1);
  instance.scale.setScalar(scale);
  instance.position.set(
    finite(reward.offset?.x, 0),
    finite(reward.offset?.y, 0),
    finite(reward.offset?.z, 0),
  );
  instance.rotation.y = finite(reward.yaw, 0);
  instance.name = `appearance-prop:${reward.slot}:${reward.id ?? "equipped"}`;
  instance.userData.appearanceSlot = reward.slot;
  instance.userData.appearanceItemId = reward.id ?? null;
  return instance;
}


async function instantiateStageProp(prop) {
  const gltf = await loadGltf(prop.modelPath);
  const selectedNode = prop.modelNode ? gltf.scene.getObjectByName(prop.modelNode) : null;
  if (prop.modelNode && !selectedNode) {
    throw new Error(`Stage prop node not found: ${prop.modelPath}#${prop.modelNode}`);
  }
  const source = selectedNode ?? gltf.scene;
  source.updateWorldMatrix(true, true);
  const instance = SkeletonUtils.clone(source);
  if (prop.modelNode) source.matrixWorld.decompose(instance.position, instance.quaternion, instance.scale);
  ownRenderableResources(instance);
  const radius = finite(prop.footprintRadius, 180) * WORLD_SCALE / (WORLD_WIDTH / 2);
  fitFootprint(instance, radius);
  const integrityKey = `prop:${prop.modelPath}#${prop.modelNode ?? "scene"}`;
  const integrity = inspectMeshIntegrityOnce(instance, integrityKey, integrityKey);
  const point = worldPoint(prop.placement);
  instance.position.set(point.x, point.y, point.z);
  instance.rotation.y = finite(prop.placement?.yawRadians, 0);
  const groundedMinY = groundObjectOnPlane(instance, point.y, prop.id);
  instance.name = `stage-prop:${prop.id}`;
  instance.userData.stageDecorId = prop.id;
  instance.userData.stageDecorKind = "prop";
  instance.userData.meshIntegrity = integrity;
  instance.userData.groundedMinY = groundedMinY;
  return {
    id: prop.id,
    kind: "prop",
    role: prop.role,
    modelPath: prop.modelPath,
    modelNode: prop.modelNode ?? null,
    placement: prop.placement,
    root: instance,
    mixer: null,
    actions: {},
  };
}
async function instantiateStageVfx(cue, { reducedMotion = false, lowQuality = false } = {}) {
  const gltf = await loadGltf(cue.modelPath);
  const instance = SkeletonUtils.clone(gltf.scene);
  ownRenderableResources(instance);
  const point = worldPoint(cue.placement);
  instance.position.set(point.x, point.y + STAGE_VFX_GROUND_LIFT, point.z);
  instance.rotation.y = finite(cue.placement?.yawRadians, 0);
  instance.name = `stage-vfx:${cue.id}`;
  instance.userData.stageDecorId = cue.id;
  instance.userData.stageDecorKind = "stage-vfx";

  const clip = gltf.animations.find(({ name }) => name === cue.clip) ?? null;
  const mixer = clip ? new THREE.AnimationMixer(instance) : null;
  const loopAction = mixer ? mixer.clipAction(clip) : null;
  loopAction?.setLoop(THREE.LoopRepeat, Infinity);
  const record = {
    id: cue.id,
    effectId: cue.effectId,
    kind: "stage-vfx",
    role: cue.role,
    modelPath: cue.modelPath,
    placement: cue.placement,
    root: instance,
    mixer,
    actions: loopAction ? { loop: loopAction } : {},
    activeActionKey: null,
    activeActionClip: clip?.name ?? null,
    quality: "full",
    lowQuality,
    detailGroup: instance.getObjectByName(cue.qualityGroups.detail) ?? null,
    decorGroup: instance.getObjectByName(cue.qualityGroups.decor) ?? null,
    loopAction,
  };
  applyStageVfxPolicy(record, reducedMotion);
  return record;
}
function applyStageVfxPolicy(record, reducedMotion) {
  const simplified = reducedMotion || record.lowQuality;
  if (record.detailGroup) record.detailGroup.visible = !simplified;
  if (record.decorGroup) record.decorGroup.visible = !simplified;
  if (reducedMotion) {
    record.loopAction?.stop();
    record.activeActionKey = null;
  } else {
    record.loopAction?.reset().play();
    record.activeActionKey = record.loopAction ? "loop" : null;
  }
  record.quality = reducedMotion ? "reduced-motion" : (record.lowQuality ? "low" : "full");
}

function applyTransientVfxPolicy(record, reducedMotion) {
  if (!record?.action) return;
  if (reducedMotion) record.action.stop();
  else record.action.reset().play();
}

function applySkillVfxSilhouette(instance, semanticVfxId) {
  const silhouette = SKILL_VFX_SILHOUETTES[semanticVfxId];
  if (!instance || !silhouette) return;
  instance.scale.set(
    instance.scale.x * silhouette.x,
    instance.scale.y * silhouette.y,
    instance.scale.z * silhouette.z,
  );
  instance.userData.semanticVfxId = semanticVfxId;
}
function applyQuestVfxPresentation(instance, presentation, reducedMotion) {
  if (!instance || !presentation) return;
  instance.scale.multiplyScalar(presentation.scale);
  instance.userData.questVfxIntent = presentation.intent;
  instance.userData.motionPolicy = reducedMotion ? "held-core" : "animated";
  instance.traverse((node) => {
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of materials) {
      if (material.color) material.color.lerp(presentation.color, reducedMotion ? 0.42 : 0.22);
      if (material.emissive) {
        material.emissive.copy(presentation.color);
        material.emissiveIntensity = Math.max(finite(material.emissiveIntensity, 1), reducedMotion ? 1.25 : 0.9);
      }
    }
  });
}


function stageNpcGuardBones(root) {
  const bones = { left: null, right: null };
  root.traverse((node) => {
    if (!node.isBone) return;
    const normalized = node.name.replace(/[._-]/g, "").toLowerCase();
    if (normalized.endsWith("upperarml")) bones.left = node;
    if (normalized.endsWith("upperarmr")) bones.right = node;
  });
  return bones;
}

function applyStageNpcGuardPose(record) {
  if (record.oneShotAction || record.activeActionKey !== "idle") return;
  record.guardBones.left?.quaternion.multiply(STAGE_NPC_GUARD_OFFSETS.left);
  record.guardBones.right?.quaternion.multiply(STAGE_NPC_GUARD_OFFSETS.right);
}

async function instantiateStageNpc(npc) {
  const motionModelPath = meshRootForMotionCharacter(npc.actorId) ?? npc.modelPath;
  const { instance, mixer, actions, actionSources } = await instantiateActorModel(
    motionModelPath,
    TARGET_HEIGHT.stageNpc,
  );
  ownRenderableResources(instance);
  const point = worldPoint(npc.placement);
  const restGroundY = instance.position.y;
  instance.position.set(point.x, point.y + restGroundY, point.z);
  instance.rotation.y = stageNpcFacingYaw(npc, point);
  instance.name = `stage-npc:${npc.id}`;
  instance.userData.stageDecorId = npc.id;
  instance.userData.stageDecorKind = "npc";
  instance.userData.stageActorId = npc.actorId;
  const idleKey = npc.presentationCue?.idleClip ?? "idle";
  const idleAction = actions[idleKey] ?? actions.idle ?? null;
  if (idleAction) idleAction.reset().play();
  return {
    id: npc.id,
    kind: "stage-npc",
    role: npc.role,
    actorId: npc.actorId,
    questId: npc.questId ?? null,
    questRole: npc.questRole ?? null,
    modelPath: motionModelPath,
    sourceModelPath: npc.modelPath,
    placement: npc.placement,
    presentationCue: npc.presentationCue,
    root: instance,
    mixer,
    actions,
    actionSources,
    activeActionSource: idleAction ? (actionSources[actions[idleKey] ? idleKey : "idle"] ?? "base") : null,
    activeActionClip: idleAction?.getClip()?.name ?? null,
    guardBones: stageNpcGuardBones(instance),
    activeActionKey: idleAction ? (actions[idleKey] ? idleKey : "idle") : null,
    oneShotAction: null,
    oneShotActionKey: null,
    queuedAction: null,
    storyBeatQueue: [],
    presentationToken: 0,
    presentationRoots: [],
    presentationMixers: [],
    loading: false,
    dead: false,
    hideAfterDeath: false,
    moving: false,
    yaw: null,
    targetYaw: null,
    ambientPhase: stableStringHash(npc.id) / 0xffffffff * Math.PI * 2,
    ambientState: "suppressed",
    ambientActive: false,
    ambientOffsets: { breath: 0, weight: 0, look: 0 },
    restScale: instance.scale.clone(),
    restYaw: instance.rotation.y,
    restRoll: instance.rotation.z,
    restGroundY,
  };
}

function disposeStageRecord(record) {
  record?.mixer?.stopAllAction();
  if (record?.root) disposeObject3D(record.root);
}

function projectileMaterial(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    blending: THREE.AdditiveBlending,
  });
}

function projectileMesh(name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

function createProjectileVisual(presentation) {
  const root = new THREE.Group();
  root.name = `projectile-${presentation.family}`;
  root.userData.projectileFamily = presentation.family;
  root.userData.projectilePresentation = presentation;

  const effectRoot = new THREE.Group();
  effectRoot.name = "projectile-effect";
  root.add(effectRoot);

  if (presentation.family === "orb") {
    const core = projectileMesh(
      "projectile-core",
      new THREE.IcosahedronGeometry(0.13, 1),
      projectileMaterial(0x9af7ff),
    );
    const ring = projectileMesh(
      "projectile-ring",
      new THREE.TorusGeometry(0.19, 0.022, 4, 12),
      projectileMaterial(0x5de6ff, 0.78),
    );
    ring.rotation.x = Math.PI / 2;
    const trail = projectileMesh(
      "projectile-trail",
      new THREE.ConeGeometry(0.11, 0.36, 6, 1, true),
      projectileMaterial(0x39bde7, 0.34),
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.z = -0.24;
    effectRoot.add(core, ring, trail);
  } else if (presentation.family === "bolt") {
    const core = projectileMesh(
      "projectile-core",
      new THREE.CylinderGeometry(0.045, 0.075, 0.5, 6),
      projectileMaterial(0xffd36a),
    );
    core.rotation.x = Math.PI / 2;
    const tip = projectileMesh(
      "projectile-tip",
      new THREE.ConeGeometry(0.075, 0.18, 6),
      projectileMaterial(0xffffff),
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.33;
    const trail = projectileMesh(
      "projectile-trail",
      new THREE.ConeGeometry(0.1, 0.5, 6, 1, true),
      projectileMaterial(0xff8d35, 0.4),
    );
    trail.rotation.x = -Math.PI / 2;
    trail.position.z = -0.43;
    effectRoot.add(core, tip, trail);
  } else {
    const core = projectileMesh(
      "projectile-core",
      new THREE.TorusGeometry(0.23, 0.045, 4, 14, Math.PI * 1.35),
      projectileMaterial(0xf2a4ff),
    );
    const trail = projectileMesh(
      "projectile-trail",
      new THREE.TorusGeometry(0.3, 0.025, 3, 12, Math.PI * 1.2),
      projectileMaterial(0x9d57ff, 0.34),
    );
    trail.position.z = -0.12;
    trail.rotation.z = -0.18;
    effectRoot.add(core, trail);
  }

  return { root, effectRoot };
}
function weaponSocket(root) {
  let fallback = null;
  let socket = null;
  root?.traverse((node) => {
    if (!node.isBone || socket) return;
    const name = String(node.name || "");
    if (/hand[._-]?r|right[._-]?hand/i.test(name)) socket = node;
    else if (!fallback && /hand/i.test(name)) fallback = node;
  });
  return socket ?? fallback ?? root;
}

const APPEARANCE_SLOT_NAMES = Object.freeze(["head", "back", "ward"]);
const COMPANION_LOCOMOTION_STATES = new Set(["FOLLOW", "RETURN", "COLLECT"]);

function appearanceSocket(root, slot) {
  const patterns = {
    head: /head|neck/i,
    back: /back|spine|chest|upper[._-]?body/i,
    ward: /hand[._-]?[l]|left[._-]?hand/i,
  };
  const pattern = patterns[slot];
  let fallback = null;
  let socket = null;
  root?.traverse((node) => {
    if (!node.isBone || socket) return;
    const name = String(node.name || "");
    if (pattern?.test(name)) socket = node;
    else if (!fallback && /spine|chest|hand|head/i.test(name)) fallback = node;
  });
  return socket ?? fallback ?? root;
}

function normalizeAppearanceDescriptor(slot, value) {
  if (!APPEARANCE_SLOT_NAMES.includes(slot) || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const modelPath = typeof value.modelPath === "string" ? value.modelPath.trim() : "";
  if (!id || !modelUrl(modelPath) || !/\.glb(?:[?#].*)?$/i.test(modelPath)) return null;
  const scale = Number(value.scale);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 20) return null;
  const offset = value.offset && typeof value.offset === "object" && !Array.isArray(value.offset)
    ? value.offset
    : {};
  const boundedOffset = (axis) => {
    const coordinate = Number(offset[axis]);
    return Number.isFinite(coordinate) ? THREE.MathUtils.clamp(coordinate, -10, 10) : 0;
  };
  const yaw = Number(value.yaw);
  return Object.freeze({
    slot,
    id,
    modelPath,
    scale,
    offset: Object.freeze({
      x: boundedOffset("x"),
      y: boundedOffset("y"),
      z: boundedOffset("z"),
    }),
    yaw: Number.isFinite(yaw) ? THREE.MathUtils.euclideanModulo(yaw + Math.PI, Math.PI * 2) - Math.PI : 0,
  });
}

function normalizeAppearanceLoadout(loadout) {
  const entries = Array.isArray(loadout)
    ? loadout.map((value) => [value?.slot, value])
    : Object.entries(loadout && typeof loadout === "object" ? loadout : {});
  const bySlot = new Map();
  for (const [slot, value] of entries) {
    const descriptor = normalizeAppearanceDescriptor(slot, value);
    if (descriptor) bySlot.set(slot, descriptor);
  }
  return [...bySlot.values()].sort(
    (left, right) => APPEARANCE_SLOT_NAMES.indexOf(left.slot) - APPEARANCE_SLOT_NAMES.indexOf(right.slot),
  );
}

async function instantiateVfxModel(relPath, isCurrent = null) {
  const gltf = await loadGltf(relPath);
  if (typeof isCurrent === "function" && !isCurrent()) return null;
  const instance = SkeletonUtils.clone(gltf.scene);
  ownRenderableResources(instance);
  fitHeight(instance, 1.2);
  instance.position.y = 0.6;
  const clip = gltf.animations?.find(({ name }) => /::loop::/i.test(name)) ?? gltf.animations?.[0] ?? null;
  const mixer = clip ? new THREE.AnimationMixer(instance) : null;
  const action = mixer?.clipAction(clip) ?? null;
  action?.setLoop(THREE.LoopRepeat, Infinity).reset().play();
  return { instance, mixer, action };
}

function disposeObject3D(root) {
  const skeletons = new Set();
  root.traverse((node) => {
    if (node.skeleton) skeletons.add(node.skeleton);
    if (!node.isMesh) return;
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"]) {
        material[key]?.dispose?.();
      }
      material.dispose();
    }
  });
  for (const skeleton of skeletons) {
    if (disposedSkeletons.has(skeleton)) continue;
    disposedSkeletons.add(skeleton);
    skeleton.dispose?.();
  }
}


/**
 * Standalone offscreen WebGL renderer that turns a single per-object GLB
 * (companion/boss/commander -- resolved via meshRootForCompanion() /
 * meshRootForStageBoss() / COMMANDER_MESH_ROOT above) into a cached 2D
 * portrait (PNG data URL) for UI cards. Reuses the SAME shared
 * loadGltf()/gltfCache RealtimeBattle draws from (no duplicate fetch of a
 * file already in flight or cached) but owns its own renderer/scene/camera,
 * independent of any battle session's lifecycle: lobby screens need
 * portraits before any RealtimeBattle instance exists, and portraits must
 * survive battle start/stop/dispose. Degrades to null (caller falls back to
 * text/glyph, same posture as the rest of this adapter's "never throw
 * mid-render" contract) on WebGL2 unavailability or a model-load failure.
 */
export class MeshThumbnailService {
  constructor() {
    this.cache = new Map(); // relPath -> data URL, or null if permanently unavailable
    this.pending = new Map(); // relPath -> in-flight render Promise (de-dupes concurrent card renders)
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.unavailable = false;
  }

  ensureReady() {
    if (this.unavailable) return false;
    if (this.renderer) return true;
    const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : (typeof document !== "undefined" ? document.createElement("canvas") : null);
    const gl = canvas?.getContext?.("webgl2", { alpha: true, antialias: true, failIfMajorPerformanceCaveat: false });
    if (!(typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext)) {
      this.unavailable = true;
      return false;
    }
    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
    this.scene.add(new THREE.HemisphereLight(0xfff2d6, 0x140a06, 1.1));
    const sun = new THREE.DirectionalLight(0xffd9a8, 1.6);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    return true;
  }

  /** Render relPath (a MODEL_ROOT-relative GLB path, e.g. from meshRootForCompanion())
   * to a cached square PNG data URL, or null if unavailable/unknown. Concurrent calls
   * for the same path share one render. */
  async render(relPath, size = 256) {
    if (this.cache.has(relPath)) return this.cache.get(relPath);
    if (this.pending.has(relPath)) return this.pending.get(relPath);
    const job = this.renderNow(relPath, size).finally(() => this.pending.delete(relPath));
    this.pending.set(relPath, job);
    return job;
  }

  async renderNow(relPath, size) {
    if (!this.ensureReady()) {
      this.cache.set(relPath, null);
      return null;
    }
    let gltf;
    try {
      gltf = await loadGltf(relPath);
    } catch {
      this.cache.set(relPath, null);
      return null;
    }
    const object = gltf.scene.clone(true);
    this.scene.add(object);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const dims = box.getSize(new THREE.Vector3());
    const radius = Math.max(dims.x, dims.y, dims.z) / 2 || 1;
    // 3/4 portrait angle (not top-down): distance derived from the camera's own
    // FOV so the full bounding sphere fits with a small margin, at ANY GLB scale.
    const distance = (radius / Math.sin((this.camera.fov / 2) * (Math.PI / 180))) * 1.35;
    this.camera.position.set(center.x + distance * 0.55, center.y + dims.y * 0.12, center.z + distance * 0.83);
    this.camera.lookAt(center.x, center.y + dims.y * 0.05, center.z);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size, size, false);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    let dataUrl = null;
    try {
      const canvasEl = this.renderer.domElement;
      dataUrl = canvasEl.convertToBlob
        ? await canvasEl.convertToBlob({ type: "image/png" }).then((blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }))
        : canvasEl.toDataURL("image/png");
    } catch {
      dataUrl = null;
    }
    this.scene.remove(object);
    disposeObject3D(object);
    this.cache.set(relPath, dataUrl);
    return dataUrl;
  }

  dispose() {
    this.cache.clear();
    this.pending.clear();
    if (this.scene) this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }
}

// Bakes a small procedural "room" into a PMREM environment map so PBR
// materials (metallic/roughness authored by build-world-content-pack.py --
// see decision-log.md D15/D19 canon material table) actually show directional
// specular reflections instead of reading flat/grey under ambient+directional
// lights alone (three.js's PBR BSDF needs an environment for its specular IBL
// term; without one, metallic surfaces have nothing to reflect and read as
// dull diffuse regardless of authored roughness/metalness). Self-lit
// MeshBasicMaterial box faces (no separate lights needed in this bake scene)
// tinted from the SAME COLORS palette the live scene's directional lights
// already use, so the reflected environment reads as an extension of the
// existing lighting direction/color rather than an unrelated HDRI.
//
// `tintColor` (optional): blends a per-stage accent into every face
// (stage-composition-20260725.md §1.1/§3.6, decision-log.md D22 judgment
// 8/10) so the environment reflection at least reads as chromatically
// consistent with the current stage instead of the same fixed 6-color
// cube for all 10 stages. This is explicitly a mitigation, not a real
// fix -- a genuinely dynamic per-stage cubemap that actually reflects
// each stage's own terrain/landmark geometry (most relevant for Glass
// Necropolis's "reflective" stage identity, §3.6) is out of scope for
// this cycle and deferred, per D22 judgment 8.
function buildEnvironmentMap(renderer, tintColor = null) {
  const bakeScene = new THREE.Scene();
  const faceColors = [
    COLORS.rim, COLORS.rim, // +X / -X: cool rim tone on the sides
    COLORS.key, COLORS.backgroundBottom, // +Y / -Y: warm key overhead, dark underfoot
    COLORS.ambient, COLORS.ambient, // +Z / -Z: neutral ambient tone front/back
  ];
  const faceIntensity = [1.4, 1.4, 2.6, 0.3, 0.9, 0.9];
  const tint = tintColor === null ? null : new THREE.Color(tintColor);
  const materials = faceColors.map((color, i) => {
    const c = new THREE.Color(color);
    if (tint) c.lerp(tint, 0.35);
    c.multiplyScalar(faceIntensity[i]);
    return new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide });
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50), materials);
  bakeScene.add(box);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const renderTarget = pmrem.fromScene(bakeScene, 0.04);
  pmrem.dispose();
  box.geometry.dispose();
  for (const m of materials) m.dispose();
  return renderTarget.texture;
}

/**
 * Real WebGL RealtimeBattle -- a Three.js scene graph reconciled every
 * renderSnapshot() call against the supplied (renderer-neutral) snapshot.
 * Retains the legacy primary export name and the full method contract
 * (mount/renderSnapshot/dispose/onVisualFeedback/debugMetrics) so app.js's
 * try-RealtimeBattle-then-fall-back-to-BattleVisualizer pattern keeps
 * working unchanged; the Canvas2D BattleVisualizer remains the fallback for
 * any environment where WebGL context creation fails.
 */
export class RealtimeBattle {
  constructor(options = {}) {
    this.options = options;
    this.canvas = null;
    this.viewport = null;
    this.reducedMotion = options.reducedMotion ?? prefersReducedMotion();
    this.disposed = true;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.terrainGroup = null;
    this.actorGroup = null;
    this.vfxGroup = null;
    this.environmentTexture = null;
    this.pressureGroup = null;
    this.pressureLane = null;
    this.pressureArrow = null;
    this.pressureTargetRing = null;

    this.actors = new Map(); // entity.id -> { root, kind, modelPath, loading }
    this.vfxInstances = []; // { root, untilTick } -- also holds death echoes: { root, untilTick, mixer }
    this.stageTerrainRecord = null;
    this.stageTerrainError = null;
    this.stageTerrainFailedId = null;
    this.stageDecorRecords = [];
    this.stageLoadToken = 0;
    this.cameraTarget = new THREE.Vector3();
    this.cameraFollowInit = false;
    this.pressureGatePoint = new THREE.Vector3();
    this.pressureEnemyPoint = new THREE.Vector3();
    this.pressureCandidatePoint = new THREE.Vector3();
    // User orbit selection is presentation-only. Phase distance is stored as a
    // numeric transition value, not as duplicate phase state; the authoritative
    // phase is read from every snapshot in updateCamera().
    this.orbitYaw = 0;
    this.orbitPitch = THREE.MathUtils.degToRad(55);
    this.phaseZoomFactor = ORBIT_ZOOM_DEFAULT;
    this.manualZoomRatio = 1;
    this.zoomFactor = ORBIT_ZOOM_DEFAULT;
    this.cameraTierTransition = null;
    this.cameraLastTick = null;
    this.cameraLastMs = null;
    this.fogFarTransition = null;
    // Populated by mount(); updateCamera() repositions rimLight every
    // frame relative to the live camera orbit (stage-composition-
    // 20260725.md §1.2, D22 판정 9). ambientLight/keyLight are kept as
    // instance fields so applyStagePalette() can retint them per stage.
    this.softwareRenderer = false;
    this.pixelRatio = 1;
    this.ambientLight = null;
    this.keyLight = null;
    this.rimLight = null;
    this.rimLightTarget = null;
    this.stagePaletteId = null; // last stageId applyStagePalette() was run for -- avoids redundant PMREM rebakes

    this.loadedStageId = null;
    this.loadingStageId = null;

    this.lastFeedback = null;
    this.pendingInputFeedback = null;
    this.visualEventKeys = new Set();
    this.animationEventKeys = new Set();
    this.pendingVfxLoads = new Set();
    this.pendingDeathEchoLoads = new Set();
    this.pendingDeathEchoes = []; // captureDeathEchoes()-collected { modelPath, x, y, z }, drained by collectFeedback()
    this.vfxGeneration = 0;
    this.pendingStageNpcBeats = new Map();
    this.appearanceLoadout = [];
    this.appearanceGeneration = 0;
    // Tick-bearing snapshots advance mixers, follow, and facing from the
    // authoritative 60 Hz simulation timeline. Utility callers that omit a
    // tick retain the wall-clock path below.
    this.lastAnimMs = null;
    this.lastAnimTick = null;
    // Renderer-local camera offsets authored by a consumed STAGE_STARTED
    // event. They never feed back into user orbit state or simulation.
    this.stageIntro = null;
    // Impact feel (presentation-only). Every entry is keyed by entity id and
    // expires on wall-clock time; nothing here is read back into the
    // snapshot, so getRunDigest() inputs stay untouched.
    this.hitFlashes = new Map(); // entityId -> { startMs, untilMs, color, peak }
    this.knockbacks = new Map(); // entityId -> { startMs, untilMs, dx, dz, distance }
    this.cameraShake = null; // { startMs, untilMs, amplitude, seed }
    this.cameraShakeOffset = new THREE.Vector3();
    this.rendererSize = new THREE.Vector2();
    this.impactShakeSeed = 0;
  }

  mount({ canvas, handoff, viewport } = {}) {
    void handoff;
    this.dispose();
    this.canvas = canvas ?? null;
    this.viewport = viewport ?? null;
    if (!this.canvas) {
      this.disposed = true;
      return this;
    }

    // The context attributes are immutable after creation, so detect the
    // software renderer before opening the real session context.
    this.softwareRenderer = detectSoftwareWebGL();
    const { width: mountWidth, height: mountHeight } = bounds(this.canvas, this.viewport);
    const canvasRatio = Math.min(
      2,
      Math.max(
        1,
        finite(this.canvas.width, 0) / Math.max(1, mountWidth),
        finite(this.canvas.height, 0) / Math.max(1, mountHeight),
      ),
    );
    this.pixelRatio = canvasRatio;
    const webgl2 = this.canvas.getContext?.("webgl2", {
      alpha: true,
      antialias: !this.softwareRenderer,
      failIfMajorPerformanceCaveat: false,
    });
    if (!(typeof WebGL2RenderingContext !== "undefined" && webgl2 instanceof WebGL2RenderingContext)) {
      throw new Error("WebGL2 context unavailable");
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context: webgl2,
      antialias: !this.softwareRenderer,
      alpha: true,
    });
    this.renderer.setClearColor(COLORS.backgroundBottom, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    // envMap (not envMapIntensity=0 default): every actor/terrain/gate
    // MeshStandardMaterial in this scene picks this up automatically via
    // scene.environment (three.js's implicit-IBL-source behavior) -- no
    // per-material wiring needed. Owns its own render-target texture,
    // disposed alongside the rest of this session's GPU resources.
    this.environmentTexture = buildEnvironmentMap(this.renderer);
    this.scene.environment = this.environmentTexture;
    this.scene.fog = new THREE.Fog(COLORS.backgroundBottom, WORLD_SCALE * 1.8, WORLD_SCALE * 4.2);

    const { width, height } = bounds(this.canvas, this.viewport);
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);

    this.ambientLight = new THREE.AmbientLight(COLORS.ambient, 1.1);
    this.keyLight = new THREE.DirectionalLight(COLORS.key, 1.6);
    this.keyLight.position.set(6, 10, 4);
    // rimLight starts at the legacy fixed world position; updateCamera()
    // repositions it every frame relative to the live camera orbit once
    // rendering begins (stage-composition-20260725.md §1.2, D22 판정 9) --
    // this initial value only matters for the zero-frames-rendered window.
    this.rimLight = new THREE.DirectionalLight(COLORS.rim, 0.6);
    this.rimLight.position.set(-8, 5, -6);
    this.rimLightTarget = new THREE.Object3D();
    this.scene.add(this.ambientLight, this.keyLight, this.rimLight, this.rimLightTarget);
    this.rimLight.target = this.rimLightTarget;

    this.terrainGroup = new THREE.Group();
    this.actorGroup = new THREE.Group();
    this.vfxGroup = new THREE.Group();
    this.scene.add(this.terrainGroup, this.actorGroup, this.vfxGroup);

    this.gateMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.08, 12, 32),
      new THREE.MeshStandardMaterial({ color: COLORS.gate, emissive: COLORS.gate, emissiveIntensity: 0.6, roughness: 0.3 }),
    );
    this.gateMesh.rotation.x = Math.PI / 2;
    this.gateMesh.visible = false;
    this.scene.add(this.gateMesh);

    // Snapshot-only gate-pressure readout: a tapered ground lane points
    // from the closest live hostile into a second, thicker gate ring. The
    // wedge + arrowhead + doubled target ring carry the meaning by shape;
    // emissive materials keep it legible regardless of stage lighting.
    this.pressureGroup = new THREE.Group();
    const pressureLaneGeometry = new THREE.BufferGeometry();
    pressureLaneGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.24, 0, -0.5, 0.24, 0, -0.5, 0, 0, 0.5], 3),
    );
    pressureLaneGeometry.computeVertexNormals();
    this.pressureLane = new THREE.Mesh(
      pressureLaneGeometry,
      new THREE.MeshStandardMaterial({
        color: STAGE_PALETTE_TINTS["cinder-span"],
        emissive: STAGE_PALETTE_TINTS["cinder-span"],
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.pressureArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.27, 0.68, 3),
      new THREE.MeshStandardMaterial({
        color: COLORS.pickup,
        emissive: COLORS.pickup,
        emissiveIntensity: 1.2,
        roughness: 0.25,
        depthWrite: false,
      }),
    );
    this.pressureArrow.geometry.rotateX(Math.PI / 2);
    this.pressureTargetRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.28, 0.11, 8, 32),
      new THREE.MeshStandardMaterial({
        color: COLORS.pickup,
        emissive: COLORS.pickup,
        emissiveIntensity: 1.2,
        roughness: 0.25,
        depthWrite: false,
      }),
    );
    this.pressureTargetRing.rotation.x = Math.PI / 2;
    this.pressureGroup.add(this.pressureLane, this.pressureArrow, this.pressureTargetRing);
    this.pressureGroup.visible = false;
    this.scene.add(this.pressureGroup);

    this.disposed = false;
    return this;
  }

  clearStageWorld() {
    for (const record of this.stageDecorRecords) record.mixer?.stopAllAction();
    this.stageDecorRecords = [];
    this.pendingStageNpcBeats.clear();
    this.stageTerrainRecord = null;
    if (!this.terrainGroup) return;
    while (this.terrainGroup.children.length) {
      const child = this.terrainGroup.children[0];
      this.terrainGroup.remove(child);
      disposeObject3D(child);
    }
  }

  commanderPresentationRecord() {
    for (const record of this.actors.values()) {
      if (record.kind === "commander") return record;
    }
    return null;
  }

  clearAppearanceAttachments(record = this.commanderPresentationRecord()) {
    if (!record?.appearanceRoots) return;
    for (const root of record.appearanceRoots.values()) {
      root.parent?.remove(root);
      disposeObject3D(root);
    }
    record.appearanceRoots.clear();
  }

  mountAppearanceLoadout(record = this.commanderPresentationRecord()) {
    if (!record?.root || record.kind !== "commander") return;
    this.clearAppearanceAttachments(record);
    const generation = this.appearanceGeneration;
    const stageToken = this.stageLoadToken;
    for (const reward of this.appearanceLoadout) {
      const socket = appearanceSocket(record.root, reward.slot);
      const slotRoot = new THREE.Group();
      slotRoot.name = `appearance-slot:${reward.slot}`;
      slotRoot.userData.appearanceSlot = reward.slot;
      slotRoot.userData.appearanceItemId = reward.id;
      slotRoot.userData.appearanceLoaded = false;
      socket.add(slotRoot);
      record.appearanceRoots.set(reward.slot, slotRoot);
      instantiateAppearanceModel(reward)
        .then((instance) => {
          const current = !this.disposed
            && generation === this.appearanceGeneration
            && stageToken === this.stageLoadToken
            && this.commanderPresentationRecord() === record
            && record.appearanceRoots.get(reward.slot) === slotRoot
            && slotRoot.parent === socket;
          if (!current) {
            disposeObject3D(instance);
            return;
          }
          slotRoot.userData.appearanceLoaded = true;
          slotRoot.add(instance);
        })
        .catch(() => {
          if (record.appearanceRoots.get(reward.slot) !== slotRoot) return;
          record.appearanceRoots.delete(reward.slot);
          slotRoot.parent?.remove(slotRoot);
          disposeObject3D(slotRoot);
        });
    }
  }

  setAppearanceLoadout(loadout) {
    const nextLoadout = normalizeAppearanceLoadout(loadout);
    const unchanged = nextLoadout.length === this.appearanceLoadout.length
      && nextLoadout.every((entry, index) => entry.slot === this.appearanceLoadout[index]?.slot
        && entry.id === this.appearanceLoadout[index]?.id);
    if (unchanged) return;
    this.appearanceLoadout = nextLoadout;
    this.appearanceGeneration += 1;
    this.mountAppearanceLoadout();
  }

  playStageNpcStoryBeat(record, storyBeat, nowMs) {
    const candidates = STAGE_NPC_STORY_ACTIONS[storyBeat?.kind];
    if (!record || !candidates) return false;
    if (record.oneShotAction) {
      if (record.storyBeatQueue.length >= MAX_PENDING_STAGE_NPC_BEATS) record.storyBeatQueue.shift();
      record.storyBeatQueue.push({ storyBeat, nowMs });
      return false;
    }
    for (const actionKey of candidates) {
      if (!record.actions?.[actionKey]) continue;
      if (this.triggerAction(record, actionKey, nowMs)) return true;
    }
    this.recoverLocomotion(record, 0);
    return false;
  }

  triggerStageNpcStoryBeat(event, nowMs) {
    const storyBeat = event?.storyBeat;
    if (!STAGE_NPC_STORY_ACTIONS[storyBeat?.kind]) return false;
    const npcId = event?.quest?.questGiverNpcId ?? null;
    const questId = event?.quest?.questId ?? null;
    const record = this.stageDecorRecords.find((candidate) => candidate.kind === "stage-npc"
      && ((npcId && candidate.id === npcId) || (questId && candidate.questId === questId)));
    if (record) return this.playStageNpcStoryBeat(record, storyBeat, nowMs);
    const pendingKey = npcId ?? questId;
    if (pendingKey) {
      const pending = this.pendingStageNpcBeats.get(pendingKey) ?? [];
      if (!pending.some((entry) => entry.storyBeat?.id === storyBeat.id)) {
        if (pending.length >= MAX_PENDING_STAGE_NPC_BEATS) pending.shift();
        pending.push({ storyBeat, nowMs });
      }
      this.pendingStageNpcBeats.set(pendingKey, pending);
    }
    return false;
  }

  consumePendingStageNpcBeat(record) {
    if (record?.kind !== "stage-npc") return;
    const pending = this.pendingStageNpcBeats.get(record.id)
      ?? this.pendingStageNpcBeats.get(record.questId);
    if (!pending?.length) return;
    this.pendingStageNpcBeats.delete(record.id);
    if (record.questId) this.pendingStageNpcBeats.delete(record.questId);
    for (const beat of pending) this.playStageNpcStoryBeat(record, beat.storyBeat, beat.nowMs);
  }

  ensureStageTerrain(stageId, phase = DEFAULT_CAMERA_PHASE, tick = null) {
    if (!stageId || this.disposed) return;
    // Palette fog is phase-sensitive even when terrain is already loaded.
    this.applyStagePalette(stageId, phase, tick);
    if (this.loadedStageId === stageId || this.loadingStageId === stageId || this.stageTerrainFailedId === stageId) return;
    const profile = stageWorldFor(stageId);
    if (!profile || (profile.terrainRuntimeEligible !== true
      && profile.terrainFallback?.kind !== "procedural-flat-support")) return;
    this.stageTerrainFailedId = null;
    this.loadingStageId = stageId;
    this.loadedStageId = null;
    this.stageTerrainError = null;
    const loadToken = ++this.stageLoadToken;
    this.clearStageWorld();
    this.appearanceGeneration += 1;
    this.mountAppearanceLoadout();
    // Warm the stage boss's GLB while the player is still in the opening
    // cutscene. It is 4 MB of authored rig that otherwise starts downloading
    // only when the boss spawns mid-fight, which pops the boss in late on a
    // slow connection or a software renderer. loadGltf() caches by path, so
    // the spawn then costs a clone instead of a fetch plus parse.
    const bossModelPath = meshRootForStageBoss(stageId);
    if (bossModelPath) loadGltf(bossModelPath).catch(() => {});

    const terrainRequest = Promise.resolve()
      .then(async () => {
        if (profile.terrainRuntimeEligible !== true) return instantiateProceduralTerrain(profile);
        try {
          return await instantiateTerrainModel(profile.terrainGlbPath);
        } catch (error) {
          console.warn(`Rejected stage terrain ${profile.terrainGlbPath}; using planar support:`, error);
          const fallback = instantiateProceduralTerrain(profile);
          fallback.userData.terrainFallbackReason = error instanceof Error ? error.message : String(error);
          return fallback;
        }
      })
      .then((root) => ({
        id: `${stageId}:terrain`,
        kind: "terrain",
        modelPath: root.userData.terrainSource === "promoted-glb" ? profile.terrainGlbPath : null,
        sourceCandidatePath: profile.terrainSourceCandidatePath ?? profile.terrainGlbPath,
        sourceKind: root.userData.terrainSource,
        fallbackReason: root.userData.terrainFallbackReason ?? profile.terrainFallback?.reason ?? null,
        meshIntegrity: root.userData.meshIntegrity,
        root,
        mixer: null,
        actions: {},
      }));
    terrainRequest.then(
      (record) => {
        if (this.disposed || this.stageLoadToken !== loadToken || this.loadingStageId !== stageId) {
          disposeStageRecord(record);
          return;
        }
        this.terrainGroup.add(record.root);
        this.stageTerrainRecord = record;
        this.loadedStageId = stageId;
        this.stageTerrainFailedId = null;
        this.loadingStageId = null;
      },
      (error) => {
        if (this.disposed || this.stageLoadToken !== loadToken) return;
        console.warn(`Failed to mount stage terrain ${stageId}:`, error);
        this.stageTerrainError = error instanceof Error ? error.message : String(error);
        this.stageTerrainFailedId = stageId;
        this.stageLoadToken += 1;
        this.loadingStageId = null;
        this.clearStageWorld();
      },
    );

    const decorRequests = [
      ...profile.presentation.props.map((prop) => instantiateStageProp(prop)),
      ...(profile.presentation.vfxCues ?? []).map((cue) => instantiateStageVfx(cue, {
        reducedMotion: this.reducedMotion,
        lowQuality: this.softwareRenderer,
      })),
      ...profile.presentation.npcs.map((npc) => instantiateStageNpc(npc)),
    ];
    for (const request of decorRequests) {
      request.then(
        (record) => {
          if (this.disposed || this.stageLoadToken !== loadToken) {
            disposeStageRecord(record);
            return;
          }
          if (record.kind === "stage-vfx") applyStageVfxPolicy(record, this.reducedMotion);
          this.terrainGroup.add(record.root);
          this.stageDecorRecords.push(record);
          if (record.kind === "stage-npc") this.consumePendingStageNpcBeat(record);
        },
        () => {},
      );
    }
  }

  // Maps STAGE_PRESENTATION_BY_ID[stageId]'s authored palette onto this
  // scene's fog/key/ambient/environment-map colors (rim light is handled
  // separately -- see updateCamera()'s camera-relative repositioning,
  // §1.2 -- it stays a fixed color, only its POSITION is per-frame
  // dynamic), so the 3D renderer finally reads the per-stage atmosphere
  // data the design layer already
  // completed for all 10 stages but the renderer previously never
  // consumed (stage-composition-20260725.md §1.1: "디자인 데이터는 이미
  // 스테이지별로 완비돼 있으나 3D 렌더러에 배선되지 않은 상태" -- D22
  // 판정 10 confirms this cycle's implementation scope). Idempotent per
  // stage id (stagePaletteId guard) since it rebuilds the PMREM
  // environment map, which is comparatively expensive to redo every frame.
  applyStagePalette(stageId, phase = "SKIRMISH", tick = null) {
    if (this.disposed) return;
    const stageChanged = this.stagePaletteId !== stageId;
    const presentation = STAGE_PRESENTATION_BY_ID[stageId];
    const tint = presentation ? STAGE_PALETTE_TINTS[stageId] ?? null : null;
    if (tint === null) return; // unknown stage id -- keep the existing global defaults rather than blank the scene
    this.stagePaletteId = stageId;

    const backgroundTint = new THREE.Color(COLORS.backgroundBottom).lerp(new THREE.Color(tint), 0.22);
    // scene.fog/keyLight/ambientLight are populated by mount() in normal
    // operation, but some test harnesses construct a RealtimeBattle by
    // hand-assembling a minimal scene graph without going through mount()
    // (e.g. tests/world-presentation-contract.test.mjs's own
    // realtimeBattleHarness(), which predates this cycle and only wires
    // scene/camera/terrainGroup/actorGroup/vfxGroup/gateMesh) -- guard
    // each independently so this method degrades gracefully instead of
    // throwing, same defensive pattern as the this.renderer guard below
    // and debugMetrics()'s this.renderer check.
    if (this.scene.fog) {
      this.scene.fog.color.copy(backgroundTint);
      const targetFog = stageFogRange(stageId, phase);
      this.scene.fog.near = targetFog.near;
      if (stageChanged || !Number.isInteger(tick)) {
        this.scene.fog.far = targetFog.far;
        this.fogFarTransition = null;
      } else {
        const active = this.fogFarTransition;
        if (active && Math.abs(active.to - targetFog.far) <= 1e-9) {
          // Continue the in-flight phase transition.
        } else if (Math.abs(this.scene.fog.far - targetFog.far) > 1e-9) {
          this.fogFarTransition = {
            from: this.scene.fog.far,
            to: targetFog.far,
            startTick: tick,
          };
        } else {
          this.fogFarTransition = null;
        }
        const transition = this.fogFarTransition;
        if (transition) {
          const elapsedTicks = Math.max(0, tick - transition.startTick);
          this.scene.fog.far = exponentialTransitionValue(
            transition.from,
            transition.to,
            elapsedTicks,
          );
          if (elapsedTicks >= CAMERA_TIER_TRANSITION_TICKS) this.fogFarTransition = null;
        } else {
          this.scene.fog.far = targetFog.far;
        }
      }
    }
    if (!stageChanged) return;
    if (this.keyLight) this.keyLight.color.copy(new THREE.Color(COLORS.key).lerp(new THREE.Color(tint), 0.18));
    if (this.ambientLight) this.ambientLight.color.copy(new THREE.Color(COLORS.ambient).lerp(new THREE.Color(tint), 0.3));

    // Renderer-dependent operations (clear color, PMREM environment-map
    // rebake) are guarded: this method's own scene/light/fog updates above
    // are pure THREE.js graph state and always safe, but a real WebGL
    // context (this.renderer) may not exist yet in every caller context --
    // same defensive pattern as debugMetrics() below. In production this
    // is never actually null (ensureStageTerrain(), this method's only
    // caller, only ever runs from renderSnapshot() after a successful
    // mount()).
    if (this.renderer) {
      this.renderer.setClearColor(backgroundTint, 0);
      // Environment-map re-tint (stage-composition-20260725.md §3.6, D22
      // 판정 8): buildEnvironmentMap() bakes ONE global 6-color cube
      // shared by every stage regardless of stageId -- for a stage whose
      // identity is explicitly built on reflection (Glass Necropolis:
      // "반사면이 고지와 사선을 가른다"), that global cube has no
      // relationship to this stage's actual terrain/landmark geometry. A
      // truly dynamic per-stage cubemap that reflects the real stage
      // geometry is out of scope this cycle (deferred, D22 판정 8) --
      // this re-tint is only the minimal mitigation the decision
      // explicitly asked for: at least chromatically consistent with the
      // stage's own palette, not physically accurate. Applies to every
      // stage uniformly (not special-cased to Glass Necropolis) since the
      // underlying rebuild is the same operation regardless of which
      // stage triggered it.
      const nextEnvironmentTexture = buildEnvironmentMap(this.renderer, tint);
      this.environmentTexture?.dispose();
      this.environmentTexture = nextEnvironmentTexture;
      this.scene.environment = this.environmentTexture;
    }
  }

  ensureActor(entity, kind) {
    if (!entity?.id || this.disposed) return;
    const existing = this.actors.get(entity.id);
    if (existing) return existing;
    const modelPath = actorModelPath(entity);
    const fallbackCandidate = fallbackActorModelPath(entity);
    const fallbackModelPath = fallbackCandidate && fallbackCandidate !== modelPath
      ? fallbackCandidate
      : null;
    const suppressEntranceBeat = typeof entity.presentationAction === "string"
      && LOCOMOTION_ACTION_KEYS.includes(entity.presentationAction);
    const record = {
      root: null, kind, modelPath, fallbackModelPath, loading: Boolean(modelPath),
      entityKind: entity.kind ?? null, role: entity.role ?? null, moveState: entity.move ?? null, aiState: entity.aiState ?? null,
      mixer: null, actions: {}, actionSources: {}, activeActionKey: null, targetHeight: actorTargetHeight(entity),
      activeActionSource: null, activeActionClip: null,
      oneShotAction: null, oneShotActionKey: null,
      queuedAction: suppressEntranceBeat ? null : { key: "show", presentation: null },
      presentationAction: null,
      dead: false, hideAfterDeath: false,
      presentationToken: 0, presentationRoots: [], presentationMixers: [],
      appearanceRoots: new Map(),
      moving: false, lastX: null, lastZ: null,
      // Facing state (D23 Phase 1). `yaw` is the rendered angle, eased
      // toward `targetYaw` in updateAnimations(); both stay null until the
      // actor's first real movement, so a freshly spawned actor keeps its
      // authored orientation instead of snapping to an arbitrary default.
      yaw: null, targetYaw: null,
      // Simulation-exact position, kept alongside the rendered one so a
      // companion's render trail (updateActorFollow) always has an
      // authoritative target to converge on.
      goalX: null, goalY: null, goalZ: null,
      ambientPhase: stableStringHash(entity.id) / 0xffffffff * Math.PI * 2,
      ambientState: "suppressed",
      ambientActive: false,
      ambientOffsets: { breath: 0, weight: 0, look: 0 },
      restScale: null, restYaw: 0, restRoll: 0, restGroundY: 0,
    };
    this.actors.set(entity.id, record);
    if (!modelPath) {
      // No dedicated model (shouldn't normally happen for known kinds, but
      // degrade gracefully instead of leaving a silent gap): a small
      // emissive marker keeps the entity visible.
      attachMissingActorMarker(record, this.actorGroup);
      if (kind === "commander") this.mountAppearanceLoadout(record);
      return record;
    }
    const targetHeight = actorTargetHeight(entity);
    const loadRequest = instantiateActorModel(modelPath, targetHeight)
      .catch((error) => {
        if (!record.fallbackModelPath || this.disposed || this.actors.get(entity.id) !== record) {
          throw error;
        }
        const fallback = record.fallbackModelPath;
        record.modelPath = fallback;
        record.fallbackModelPath = null;
        return instantiateActorModel(fallback, targetHeight);
      });
    loadRequest
      .then(({ instance, mixer, actions, actionSources }) => {
        record.root = instance;
        record.restScale = instance.scale.clone();
        record.restYaw = instance.rotation.y;
        record.restRoll = instance.rotation.z;
        record.restGroundY = instance.position.y;
        record.mixer = mixer;
        record.actions = actions;
        record.actionSources = actionSources;
        record.loading = false;
        if (this.disposed || !this.actors.has(entity.id) || this.actors.get(entity.id) !== record) {
          disposeObject3D(instance);
          return;
        }
        this.actorGroup.add(instance);
        if (record.kind === "commander") this.mountAppearanceLoadout(record);
        const queued = record.queuedAction;
        record.queuedAction = null;
        const startedQueued = queued
          ? this.triggerAction(record, queued.key, undefined, queued.presentation)
          : false;
        if (!startedQueued) {
          if (record.dead && record.hideAfterDeath) instance.visible = false;
          else this.recoverLocomotion(record, 0);
        }
      })
      .catch((error) => {
        record.loading = false;
        if (this.disposed || this.actors.get(entity.id) !== record) return;
        console.warn(`Failed to load actor model ${record.modelPath}:`, error);
        attachMissingActorMarker(record, this.actorGroup);
        if (record.kind === "commander") this.mountAppearanceLoadout(record);
      });
    return record;
  }

  ensurePickup(pickup) {
    if (!pickup?.id || this.disposed) return;
    const existing = this.actors.get(pickup.id);
    if (existing) return existing;
    const modelPath = pickup.kind === "item" ? PROP_BLADE_MESH : PROP_RELIC_MESH;
    const root = new THREE.Group();
    const fallback = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({ color: COLORS.pickup, emissive: COLORS.pickup, emissiveIntensity: 0.8 }),
    );
    fallback.position.y = 0.14;
    root.add(fallback);
    const record = {
      root,
      kind: "pickup",
      modelPath,
      loading: true,
      restGroundY: 0,
      goalX: null,
      goalY: null,
      goalZ: null,
      moving: false,
      lastX: null,
      lastZ: null,
      meshIntegrity: null,
      groundedMinY: 0,
    };
    this.actors.set(pickup.id, record);
    this.actorGroup.add(root);
    instantiatePickupModel(modelPath)
      .then((instance) => {
        if (this.disposed || this.actors.get(pickup.id) !== record) {
          disposeObject3D(instance);
          return;
        }
        root.remove(fallback);
        disposeObject3D(fallback);
        root.add(instance);
        record.loading = false;
        record.meshIntegrity = instance.userData.meshIntegrity;
        record.groundedMinY = instance.userData.groundedMinY;
      })
      .catch((error) => {
        record.loading = false;
        if (this.disposed || this.actors.get(pickup.id) !== record) return;
        console.warn(`Failed to load pickup model ${modelPath}:`, error);
      });
    return record;
  }

  resetAmbientIdle(record) {
    if (!record?.root || !record.restScale) return;
    record.root.scale.copy(record.restScale);
    record.root.rotation.z = record.restRoll;
    record.root.rotation.y = record.yaw ?? record.restYaw;
    record.ambientState = "suppressed";
    record.ambientActive = false;
    record.ambientOffsets.breath = 0;
    record.ambientOffsets.weight = 0;
    record.ambientOffsets.look = 0;
  }

  updateAmbientIdle(record, nowMs) {
    if (!record?.root || !["commander", "enemy", "boss", "companion", "stage-npc"].includes(record.kind)) return;
    const idle = !this.reducedMotion
      && !record.dead
      && !record.oneShotAction
      && !record.moving
      && this.locomotionActionKey(record) === "idle"
      && (!record.mixer || record.activeActionKey === "idle");
    if (!idle) {
      this.resetAmbientIdle(record);
      return;
    }

    const seconds = nowMs / 1000;
    const phase = record.ambientPhase;
    const breath = Math.sin(seconds * Math.PI * 2 / AMBIENT_BREATH_CYCLE_SECONDS + phase) * AMBIENT_BREATH_SCALE;
    const weight = Math.sin(seconds * Math.PI * 2 / AMBIENT_WEIGHT_CYCLE_SECONDS + phase * 0.7) * AMBIENT_WEIGHT_ROLL;
    const lookCycle = (seconds + phase / (Math.PI * 2) * AMBIENT_LOOK_CYCLE_SECONDS) % AMBIENT_LOOK_CYCLE_SECONDS;
    const lookWindow = lookCycle >= 4 && lookCycle <= 8
      ? Math.sin((lookCycle - 4) / 4 * Math.PI * 2)
      : 0;
    const look = lookWindow * AMBIENT_LOOK_YAW;

    record.root.scale.set(
      record.restScale.x * (1 - breath * 0.25),
      record.restScale.y * (1 + breath),
      record.restScale.z * (1 - breath * 0.25),
    );
    record.root.rotation.z = record.restRoll + weight;
    record.root.rotation.y = (record.yaw ?? record.restYaw) + look;
    record.ambientState = "idle";
    record.ambientActive = true;
    record.ambientOffsets.breath = breath;
    record.ambientOffsets.weight = weight;
    record.ambientOffsets.look = look;
  }

  locomotionActionKey(record) {
    // `commander.move` is an authoritative snapshot field. It remains stable
    // across repeated renders of the same tick, unlike a derived position
    // delta, so held player movement selects run without flickering idle.
    if (record.kind === "commander" && typeof record.moveState === "string" && record.moveState !== "IDLE") {
      return "run";
    }
    if (record.kind === "companion" && COMPANION_LOCOMOTION_STATES.has(record.aiState)) return "move";
    return record.moving ? "move" : "idle";
  }

  recoverLocomotion(record, fadeSeconds = 0.15) {
    if (!record?.mixer || record.dead || record.oneShotAction) return false;
    const preferred = this.locomotionActionKey(record);
    const key = record.actions?.[preferred]
      ? preferred
      : (preferred === "run" && record.actions?.move ? "move" : "idle");
    if (!record.actions?.[key]) return false;
    if (record.activeActionKey === key) return true;
    return this.crossfadeToAction(record, key, fadeSeconds);
  }

  // Crossfades only at locomotion boundaries or after a one-shot has
  // completed. A live one-shot cannot be cross-faded into another one-shot;
  // triggerAction() queues that beat until the mixer reports "finished".
  crossfadeToAction(record, key, fadeSeconds = 0.2) {
    const next = record.actions?.[key];
    if (!next || record.activeActionKey === key || (record.dead && key !== "die")) return false;
    if (record.oneShotAction && !LOCOMOTION_ACTION_KEYS.includes(key)) return false;
    const previous = record.activeActionKey ? record.actions[record.activeActionKey] : null;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.reset().fadeIn(fadeSeconds).play();
    if (previous && previous !== next) previous.fadeOut(fadeSeconds);
    record.activeActionKey = key;
    record.activeActionSource = record.actionSources?.[key] ?? "base";
    record.activeActionClip = next.getClip()?.name ?? null;
    return true;
  }

  clearAttackPresentation(record) {
    if (!record) return;
    record.presentationToken = (record.presentationToken ?? 0) + 1;
    for (const { mixer } of record.presentationMixers ?? []) mixer.stopAllAction();
    record.presentationMixers = [];
    for (const root of record.presentationRoots ?? []) {
      root.parent?.remove(root);
      disposeObject3D(root);
    }
    record.presentationRoots = [];
  }

  loadPresentationInto(record, anchor, relPath, targetHeight, token) {
    instantiatePresentationModel(relPath, targetHeight)
      .then(({ instance, mixer, action }) => {
        if (this.disposed || record.presentationToken !== token || !anchor.parent) {
          mixer?.stopAllAction();
          disposeObject3D(instance);
          return;
        }
        anchor.add(instance);
        if (mixer) {
          const presentation = { mixer, action };
          applyTransientVfxPolicy(presentation, this.reducedMotion);
          record.presentationMixers.push(presentation);
        }
      })
      .catch(() => {});
  }

  beginAttackPresentation(record, presentation) {
    if (!record?.root || !presentation?.delivery) return;
    const models = COMBAT_PRESENTATION_MODELS[presentation.delivery];
    if (!models) return;
    this.clearAttackPresentation(record);
    const token = record.presentationToken;
    const height = record.targetHeight ?? TARGET_HEIGHT.enemy;

    const weaponAnchor = new THREE.Group();
    const socket = weaponSocket(record.root);
    socket.add(weaponAnchor);
    if (socket === record.root) weaponAnchor.position.set(0, height * 0.55, height * 0.12);
    record.presentationRoots.push(weaponAnchor);
    this.loadPresentationInto(record, weaponAnchor, models.weapon, height * 0.42, token);

    models.effects.forEach((relPath, index) => {
      const targetRoot = presentation.target?.root;
      const isBolt = presentation.delivery === "ranged" && index === 1 && targetRoot;
      const effectAnchor = new THREE.Group();
      if (isBolt) {
        record.root.updateWorldMatrix(true, false);
        targetRoot.updateWorldMatrix(true, false);
        const source = record.root.getWorldPosition(new THREE.Vector3());
        const target = targetRoot.getWorldPosition(new THREE.Vector3());
        effectAnchor.position.set(
          (source.x + target.x) * 0.5,
          Math.max(source.y, target.y) + height * 0.55,
          (source.z + target.z) * 0.5,
        );
        effectAnchor.lookAt(target.x, target.y + height * 0.45, target.z);
        this.vfxGroup.add(effectAnchor);
      } else {
        effectAnchor.position.set(0, height * 0.55, height * (presentation.delivery === "melee" ? 0.48 : 0.28));
        record.root.add(effectAnchor);
      }
      record.presentationRoots.push(effectAnchor);
      this.loadPresentationInto(record, effectAnchor, relPath, height * 0.55, token);
    });
  }

  finishOneShot(record) {
    if (!record?.oneShotAction) return;
    const finishedKey = record.oneShotActionKey;
    record.oneShotAction = null;
    record.oneShotActionKey = null;
    this.clearAttackPresentation(record);
    if (finishedKey === "die" || record.dead) {
      record.queuedAction = null;
      if (record.hideAfterDeath && record.root) record.root.visible = false;
      return;
    }
    if (record.kind === "stage-npc" && record.storyBeatQueue?.length) {
      const nextStoryBeat = record.storyBeatQueue.shift();
      if (this.playStageNpcStoryBeat(record, nextStoryBeat.storyBeat, nextStoryBeat.nowMs)) return;
    }
    const queued = record.queuedAction;
    record.queuedAction = null;
    if (queued && this.triggerAction(record, queued.key, undefined, queued.presentation)) return;
    this.recoverLocomotion(record, locomotionRecoveryFadeSeconds(finishedKey));
  }

  // One slot, highest-priority beat wins, ties go to the freshest event. A
  // reaction the player must read never loses its slot to a lower-weight beat
  // that merely arrived later.
  queueBeat(record, key, presentation) {
    const queued = record.queuedAction ? beatPriority(record.queuedAction.key) : -1;
    if (beatPriority(key) < queued) return false;
    record.queuedAction = { key, presentation };
    return true;
  }

  // One-shots are mixer-finished, not timer-finished. A repeated request for
  // the beat already playing restarts it (a fast combo must read as N hits,
  // never one long hit) once the clip has advanced at least one frame;
  // incompatible one-shots queue, while death hard-cuts immediately, stays
  // terminal, and never restarts.
  triggerAction(record, key, nowMs, presentation = null) {
    void nowMs;
    if (!record || LOCOMOTION_ACTION_KEYS.includes(key)) return false;
    if (key === "die") {
      record.dead = true;
      record.queuedAction = null;
    } else if (record.dead) {
      return false;
    }
    this.resetAmbientIdle(record);
    const action = record.actions?.[key];
    if (!record.mixer || !action) {
      if (record.loading) this.queueBeat(record, key, presentation);
      return false;
    }
    if (record.oneShotAction) {
      if (record.oneShotAction === action || record.oneShotActionKey === key) {
        if (key === "die") return false;
        if (action.time < ONE_SHOT_RESTART_MIN_ELAPSED_SECONDS) return false;
        action.enabled = true;
        action.setEffectiveWeight(1);
        action.reset().play();
        record.activeActionKey = key;
        record.activeActionSource = record.actionSources?.[key] ?? "base";
        record.activeActionClip = action.getClip()?.name ?? null;
        record.oneShotAction = action;
        record.oneShotActionKey = key;
        // The weapon/VFX rig is NOT rebuilt here. A restart can only ever be
        // the same beat -- melee and ranged are distinct keys, so the delivery
        // cannot have changed -- and tearing down two or three GLB instances
        // per repeat is pure churn that starves the frame during a fast combo.
        return true;
      }
      if (key !== "die") {
        this.queueBeat(record, key, presentation);
        return false;
      }
      record.oneShotAction.stop();
      record.oneShotAction = null;
      record.oneShotActionKey = null;
      this.clearAttackPresentation(record);
    }
    let played;
    if (key === "die") {
      const previous = record.activeActionKey ? record.actions[record.activeActionKey] : null;
      if (previous && previous !== action) previous.stop();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.reset().play();
      record.activeActionKey = key;
      played = true;
    } else {
      played = this.crossfadeToAction(record, key, oneShotEntryFadeSeconds(key));
    }
    if (!played) return false;
    record.oneShotAction = action;
    record.oneShotActionKey = key;
    if (presentation) this.beginAttackPresentation(record, presentation);
    return true;
  }

  syncActorState(record, entity) {
    if (!record || !entity) return;
    record.entityKind = entity.kind ?? record.entityKind;
    record.role = entity.role ?? record.role;
    record.moveState = entity.move ?? null;
    record.aiState = entity.aiState ?? null;
    const requestedAction = typeof entity.presentationAction === "string"
      && RIG_ACTION_KEYS.includes(entity.presentationAction)
      ? entity.presentationAction
      : null;
    if (requestedAction !== record.presentationAction) {
      record.presentationAction = requestedAction;
      if (requestedAction && LOCOMOTION_ACTION_KEYS.includes(requestedAction)) {
        if (!record.loading) this.recoverLocomotion(record, 0);
      } else if (requestedAction && !record.dead) {
        this.triggerAction(record, requestedAction);
      }
    }
    const status = entity.status;
    const dead = status === "DOWNED" || status === "DEAD" || status === "DEFEATED"
      || (Number.isFinite(entity.hp) && entity.hp <= 0)
      || (Number.isFinite(entity.integrity) && entity.integrity <= 0);
    if (!dead) {
      if (!record.loading && !record.oneShotAction) this.recoverLocomotion(record);
      return;
    }
    if (record.dead) return;
    record.hideAfterDeath = record.kind === "companion";
    const started = this.triggerAction(record, "die");
    if (!started && !record.loading && record.hideAfterDeath && record.root) {
      record.root.visible = false;
    }
  }

  // Writes the actor's rendered position and derives its heading. `record`
  // keeps the simulation's exact x/elevation/z goal alongside the rendered
  // transform. Companions trail toward all three axes together; every other
  // actor stays exactly on the authoritative terrain surface.
  syncActorPosition(record, entity) {
    if (!record.root) return;
    const p = worldPoint(entity);
    record.goalX = p.x;
    record.goalY = record.restGroundY + p.y;
    record.goalZ = p.z;
    // Commander and everything that is not a companion render exactly on
    // the simulation position. The commander especially: it answers direct
    // player input, and smoothing it would read as input lag.
    if (record.kind !== "companion" || this.reducedMotion || record.lastX === null) {
      record.root.position.x = record.goalX;
      record.root.position.y = record.goalY;
      record.root.position.z = record.goalZ;
    }
    const rx = record.root.position.x;
    const rz = record.root.position.z;
    if (record.lastX !== null) {
      const dx = rx - record.lastX;
      const dz = rz - record.lastZ;
      record.moving = Math.hypot(dx, dz) > MOVE_EPSILON;
      // Re-aim only while actually travelling (D23 Phase 1). Below
      // MOVE_EPSILON the delta is rounding noise with no meaningful
      // direction, and re-aiming on it would make a standing actor spin;
      // reusing the locomotion threshold keeps facing and the move/idle
      // animation switch agreeing about what counts as movement.
      // atan2(dx, dz) -- not the usual (y, x) argument order -- because a
      // three.js rotation.y of T aims local +Z at (sin T, cos T), so the
      // x-component is the sine term here.
      if (record.moving) {
        record.targetYaw = wrapAngle(Math.atan2(dx, dz) + MODEL_FORWARD_YAW_OFFSET);
        // First movement: adopt the heading outright. Easing in from a
        // null/zero start would spin the actor from an arbitrary angle it
        // was never actually facing.
        if (record.yaw === null) {
          record.yaw = record.targetYaw;
          record.root.rotation.y = record.yaw;
        }
      }
    }
    record.lastX = rx;
    record.lastZ = rz;
  }

  // Eases a companion's RENDERED position toward the simulation position
  // (D23 Phase 1). The simulation hard-snaps every companion to
  // `commander + stanceOffset` each tick (defense-run-simulation.js), which
  // renders as the whole squad teleporting in lockstep with the player.
  // Trailing them slightly reads as a squad following rather than a rigid
  // formation glued to the commander.
  //
  // Presentation-only, and safe against this cycle's stance system: FRONT/
  // BACK is derived from loadout index (stanceSlotForIndex: `index <
  // derivedFrontCount`), never from live position, and all range/targeting
  // math runs on the simulation position -- so a trailing render position
  // cannot change or misreport any gameplay state.
  //
  // Same 1 - e^(-rate*dt) form as updateActorFacing(), so the catch-up takes
  // constant wall-clock time regardless of frame rate. FOLLOW_CATCHUP_RATE
  // is high enough that the trail settles in ~90ms -- visible as softness,
  // never as a companion lagging somewhere it isn't.
  updateActorFollow(record, deltaSeconds) {
    if (!record.root || record.kind !== "companion") return;
    if (record.goalX === null || record.goalX === undefined) return;
    if (this.reducedMotion) {
      record.root.position.x = record.goalX;
      record.root.position.z = record.goalZ;
      record.root.position.y = record.goalY;
      return;
    }
    const t = 1 - Math.exp(-FOLLOW_CATCHUP_RATE * deltaSeconds);
    record.root.position.x += (record.goalX - record.root.position.x) * t;
    record.root.position.y += (record.goalY - record.root.position.y) * t;
    record.root.position.z += (record.goalZ - record.root.position.z) * t;
  }

  retireActor(id) {
    const record = this.actors.get(id);
    if (!record) return;
    this.actors.delete(id);
    this.clearAttackPresentation(record);
    if (record.mixer) record.mixer.stopAllAction();
    if (record.root) {
      this.actorGroup.remove(record.root);
      disposeObject3D(record.root);
    }
  }

  syncPressureIndicator(snapshot, gate) {
    // Older/headless harnesses may assemble only the original scene groups.
    if (!this.pressureGroup || !this.pressureLane || !this.pressureArrow || !this.pressureTargetRing) return;

    const hostiles = list(snapshot, "enemies", "hostiles");
    if (!gate || hostiles.length === 0) {
      this.pressureGroup.visible = false;
      return;
    }

    worldPointInto(this.pressureGatePoint, gate);
    let closestDistanceSq = Infinity;
    let foundHostile = false;
    for (const hostile of hostiles) {
      if (!hostile || hostile.active === false || hostile.status === "DEAD" || hostile.status === "DEFEATED") continue;
      if (Number.isFinite(hostile.hp) && hostile.hp <= 0) continue;
      worldPointInto(this.pressureCandidatePoint, hostile);
      const dx = this.pressureGatePoint.x - this.pressureCandidatePoint.x;
      const dz = this.pressureGatePoint.z - this.pressureCandidatePoint.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= closestDistanceSq) continue;
      closestDistanceSq = distanceSq;
      this.pressureEnemyPoint.copy(this.pressureCandidatePoint);
      foundHostile = true;
    }
    if (!foundHostile) {
      this.pressureGroup.visible = false;
      return;
    }
    this.pressureTargetRing.position.set(
      this.pressureGatePoint.x,
      this.pressureGatePoint.y + 1.02,
      this.pressureGatePoint.z,
    );
    this.pressureTargetRing.visible = true;
    this.pressureGroup.visible = true;
    if (closestDistanceSq < 1e-6) {
      this.pressureLane.visible = false;
      this.pressureArrow.visible = false;
      return;
    }

    const distance = Math.sqrt(closestDistanceSq);
    const dx = this.pressureGatePoint.x - this.pressureEnemyPoint.x;
    const dz = this.pressureGatePoint.z - this.pressureEnemyPoint.z;
    const invDistance = 1 / distance;
    const heading = Math.atan2(dx, dz);
    const gateClearance = Math.min(1.18, distance * 0.3);
    const laneLength = Math.max(0.12, distance - gateClearance);
    const endX = this.pressureGatePoint.x - dx * invDistance * gateClearance;
    const endZ = this.pressureGatePoint.z - dz * invDistance * gateClearance;

    this.pressureLane.visible = true;
    this.pressureArrow.visible = true;
    this.pressureLane.position.set(
      (this.pressureEnemyPoint.x + endX) * 0.5,
      (this.pressureEnemyPoint.y + this.pressureGatePoint.y) * 0.5 + 0.055,
      (this.pressureEnemyPoint.z + endZ) * 0.5,
    );
    this.pressureLane.rotation.y = heading;
    this.pressureLane.scale.set(1, 1, laneLength);

    this.pressureArrow.position.set(endX, this.pressureGatePoint.y + 0.16, endZ);
    this.pressureArrow.rotation.y = heading;
  }

  syncProjectile(record, projectile, snapshot) {
    const source = record.projectileSourcePoint;
    const target = record.projectileTargetPoint;
    worldPointInto(source, projectile);
    /* None-target orbs carry their own simulated position each tick: the renderer follows the
     * simulation point and aims along the velocity instead of interpolating toward a locked
     * target id (travelling orbs have no target until they actually touch a body). */
    if (projectile.mode === "travel") {
      const family = record.projectileFamily;
      const sourceActor = this.actors.get(projectile.sourceId);
      const muzzleHeight = (sourceActor?.root?.position.y ?? source.y) + PROJECTILE_HEIGHT[family];
      record.root.position.set(source.x, muzzleHeight, source.z);
      record.travelProgress = 0;
      record.root.userData.projectileTravelProgress = 0;
      const heading = Math.hypot(finite(projectile.vx, 0), finite(projectile.vy, 0));
      if (heading > 0) {
        target.set(
          source.x + finite(projectile.vx, 0) / heading,
          muzzleHeight,
          source.z + finite(projectile.vy, 0) / heading,
        );
        record.root.lookAt(target);
      }
      return;
    }
    const targetEntity = snapshotEntityById(snapshot, projectile.targetId);
    if (targetEntity) worldPointInto(target, targetEntity);
    else target.copy(source);


    const sourceActor = this.actors.get(projectile.sourceId);
    const targetActor = this.actors.get(projectile.targetId);
    const family = record.projectileFamily;
    source.y = (sourceActor?.root?.position.y ?? source.y) + PROJECTILE_HEIGHT[family];
    target.y = targetActor?.root
      ? targetActor.root.position.y + (targetActor.targetHeight ?? PROJECTILE_HEIGHT[family]) * 0.45
      : (projectile.targetId === "gate" && this.gateMesh
        ? this.gateMesh.position.y
        : target.y + PROJECTILE_HEIGHT[family]);

    const ttl = Math.max(0, finite(projectile.ttl, record.initialTtl));
    if (ttl >= record.initialTtl) record.initialTtl = ttl + 1;
    const snapshotProgress = THREE.MathUtils.clamp(1 - ttl / record.initialTtl, 0, 0.98);
    record.travelProgress = Math.max(record.travelProgress, snapshotProgress);
    record.root.position.lerpVectors(source, target, record.travelProgress);
    record.root.position.y += Math.sin(record.travelProgress * Math.PI) * PROJECTILE_ARC_HEIGHT[family];
    record.root.userData.projectileTravelProgress = record.travelProgress;
    if (target.distanceToSquared(record.root.position) > 1e-8) record.root.lookAt(target);
  }

  updateProjectilePresentation(record, nowMs) {
    if (!record?.effectRoot) return;
    const seconds = nowMs / 1000;
    const phase = record.projectilePhase;
    if (this.reducedMotion) {
      record.effectRoot.rotation.z = 0;
      record.effectRoot.scale.set(1, 1, 1);
      return;
    }
    if (record.projectileFamily === "orb") {
      const pulse = 1 + Math.sin(seconds * 12 + phase) * 0.12;
      record.effectRoot.rotation.z = seconds * 2.4 + phase;
      record.effectRoot.scale.setScalar(pulse);
    } else if (record.projectileFamily === "bolt") {
      record.effectRoot.rotation.z = seconds * 9 + phase;
      record.effectRoot.scale.set(1, 1, 1 + Math.sin(seconds * 18 + phase) * 0.08);
    } else {
      const wave = 1 + Math.sin(seconds * 8 + phase) * 0.1;
      record.effectRoot.rotation.z = seconds * 5.5 + phase;
      record.effectRoot.scale.set(wave, wave, 1);
    }
  }

  reconcileActors(snapshot) {
    const seen = new Set();

    const commander = snapshot?.commander ?? snapshot?.player;
    if (commander?.id) {
      seen.add(commander.id);
      const record = this.ensureActor(commander, "commander");
      this.syncActorState(record, commander);
      this.syncActorPosition(record, commander);
    }

    for (const enemy of list(snapshot, "enemies", "hostiles")) {
      if (!enemy?.id) continue;
      seen.add(enemy.id);
      const kind = enemy.class === "boss" ? "boss" : "enemy";
      const record = this.ensureActor(enemy, kind);
      this.syncActorState(record, enemy);
      this.syncActorPosition(record, enemy);
    }

    for (const companion of list(snapshot, "companions", "allies")) {
      if (!companion?.id) continue;
      seen.add(companion.id);
      const record = this.ensureActor(companion, "companion");
      this.syncActorState(record, companion);
      this.syncActorPosition(record, companion);
    }

    for (const pickup of list(snapshot, "pickups", "drops")) {
      if (!pickup?.id) continue;
      seen.add(pickup.id);
      const record = this.ensurePickup(pickup);
      this.syncActorPosition(record, pickup);
    }

    for (const projectile of list(snapshot, "projectiles", "shots")) {
      if (!projectile?.id) continue;
      seen.add(projectile.id);
      const sourceEntity = snapshotEntityById(snapshot, projectile.sourceId);
      const presentation = projectilePresentationFor(projectile, sourceEntity);
      let record = this.actors.get(projectile.id);
      if (!record) {
        const { root, effectRoot } = createProjectileVisual(presentation);
        const ttl = Math.max(0, finite(projectile.ttl, 0));
        record = {
          root,
          effectRoot,
          kind: "projectile",
          modelPath: null,
          loading: false,
          projectileFamily: presentation.family,
          projectilePresentation: presentation,
          initialTtl: Math.max(1, ttl + 1),
          travelProgress: 0,
          projectilePhase: stableStringHash(projectile.id) / 0xffffffff * Math.PI * 2,
          projectileSourcePoint: new THREE.Vector3(),
          projectileTargetPoint: new THREE.Vector3(),
        };
        this.actors.set(projectile.id, record);
        this.actorGroup.add(root);
      }
      this.syncProjectile(record, projectile, snapshot);
    }


    for (const id of [...this.actors.keys()]) {
      if (!seen.has(id)) this.retireActor(id);
    }

    const gate = snapshot?.gate ?? snapshot?.base;
    if (this.gateMesh) {
      this.gateMesh.visible = Boolean(gate);
      if (gate) {
        const p = worldPoint(gate);
        this.gateMesh.position.set(p.x, p.y + 1, p.z);
      }
    }
    this.syncPressureIndicator(snapshot, gate);
  }

  // Called by app.js's onPointerMove with already-sign-adjusted, already-
  // sensitivity-scaled radians (app.js:940) -- this method does no further
  // scaling or sign flips, just accumulate + clamp
  // (camera-orbit-implementation-plan-20260725.md §3.1).
  // Returns true when this call's pitch input was cut by the clamp -- i.e.
  // the player kept dragging into an already-saturated [30°,85°] boundary.
  // app.js uses that to fire the camera-clamp boundary tick (control-feel-
  // 20260725.md §3.3). Yaw is unrestricted so it never contributes.
  orbit(dYaw, dPitch) {
    if (this.disposed) return false;
    // yaw: unrestricted, wrapped only for float hygiene over a long
    // session -- never clamped (presentation-spec.md:18-25 "yaw
    // unrestricted").
    this.orbitYaw = wrapAngle(this.orbitYaw + dYaw);
    const desiredPitch = this.orbitPitch + dPitch;
    this.orbitPitch = THREE.MathUtils.clamp(desiredPitch, MIN_ORBIT_PITCH, MAX_ORBIT_PITCH);
    return Math.abs(desiredPitch - this.orbitPitch) > 1e-9;
  }

  // Called by app.js's pinch handler with an already-sign-adjusted delta
  // (app.js:928-933) -- accumulate + clamp only, no scaling
  // (camera-orbit-implementation-plan-20260725.md §3.2). Returns true when
  // the pinch pushed against a saturated distance boundary (symmetric with
  // orbit() above -- drives the same boundary tick).
  zoom(delta) {
    if (this.disposed) return false;
    const tierDistance = Math.max(Number.EPSILON, finite(this.phaseZoomFactor, ORBIT_ZOOM_DEFAULT));
    const current = finite(this.zoomFactor, tierDistance * this.manualZoomRatio);
    const desired = current + finite(delta, 0);
    const lower = Math.max(MIN_ORBIT_DISTANCE, tierDistance * MANUAL_ZOOM_RATIO_MIN);
    const upper = Math.min(MAX_ORBIT_DISTANCE, tierDistance * MANUAL_ZOOM_RATIO_MAX);
    this.zoomFactor = THREE.MathUtils.clamp(desired, lower, upper);
    this.manualZoomRatio = this.zoomFactor / tierDistance;
    return Math.abs(desired - this.zoomFactor) > 1e-9;
  }
  // App-owned accessibility observers call this whenever the system
  // preference changes. The renderer keeps only its local presentation
  // policy; enabling reduced motion cancels rather than pauses an intro so
  // disabling it cannot resume a partially completed dolly.
  setReducedMotion(reducedMotion) {
    this.reducedMotion = reducedMotion === true;
    if (this.reducedMotion) {
      this.stageIntro = null;
      this.knockbacks.clear();
      this.clearCameraShakeOffset();
      this.cameraShake = null;
    }
    for (const flash of this.hitFlashes.values()) flash.static = this.reducedMotion;
    for (const record of this.stageDecorRecords) {
      if (record.kind === "stage-vfx") applyStageVfxPolicy(record, this.reducedMotion);
    }
    for (const record of this.vfxInstances) applyTransientVfxPolicy(record, this.reducedMotion);
    for (const actor of this.actors.values()) {
      for (const presentation of actor.presentationMixers ?? []) {
        applyTransientVfxPolicy(presentation, this.reducedMotion);
      }
    }
  }

  startsStageAtTickZero(snapshot) {
    const tick = snapshot?.tick;
    return tick === 0
      && Array.isArray(snapshot?.events)
      && snapshot.events.some((event) => event?.type === "STAGE_STARTED" && event.tick === 0);
  }
  // A second tick-zero STAGE_STARTED after a progressed timeline is a new
  // presentation run even when the stage id and deterministic event ids repeat.
  // Retire transient state before consuming the new frame so no old effect,
  // queued NPC beat, or impact pose crosses the retry boundary.
  resetPresentationEventDeduplicationForNewRun(startsStageAtTickZero) {
    if (!startsStageAtTickZero || !(this.lastAnimTick > 0)) return false;
    this.animationEventKeys.clear();
    this.visualEventKeys.clear();
    this.vfxGeneration += 1;
    for (const record of this.vfxInstances) this.retireVfxRecord(record);
    this.vfxInstances = [];
    this.pendingVfxLoads.clear();
    this.pendingDeathEchoLoads.clear();
    this.pendingDeathEchoes = [];
    this.pendingStageNpcBeats.clear();
    for (const flash of this.hitFlashes.values()) {
      flash.record?.root?.traverse((node) => {
        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
        for (const material of materials) {
          if (material?.userData?.impactBaseEmissive && material.emissive) {
            material.emissive.copy(material.userData.impactBaseEmissive);
            material.emissiveIntensity = material.userData.impactBaseEmissiveIntensity;
          }
          if (material?.userData?.impactBaseColor && material.color) {
            material.color.copy(material.userData.impactBaseColor);
          }
        }
      });
    }
    this.hitFlashes.clear();
    this.knockbacks.clear();
    this.clearCameraShakeOffset();
    this.cameraShake = null;
    for (const record of this.stageDecorRecords) {
      if (record.kind !== "stage-npc") continue;
      this.clearAttackPresentation(record);
      record.mixer?.stopAllAction();
      record.oneShotAction = null;
      record.oneShotActionKey = null;
      record.queuedAction = null;
      record.storyBeatQueue.length = 0;
      record.dead = false;
      if (record.root) record.root.visible = true;
      const idleKey = record.presentationCue?.idleClip ?? "idle";
      const idle = record.actions?.[idleKey] ?? record.actions?.idle ?? null;
      idle?.reset().play();
      record.activeActionKey = idle ? (record.actions?.[idleKey] ? idleKey : "idle") : null;
      record.activeActionSource = idle ? (record.actionSources?.[record.activeActionKey] ?? "base") : null;
      record.activeActionClip = idle?.getClip()?.name ?? null;
      this.resetAmbientIdle(record);
    }
    return true;
  }



  startStageIntro(snapshot) {
    if (this.reducedMotion || !Number.isInteger(snapshot?.tick)) return;
    const intro = stageWorldFor(resolveStageId(snapshot))?.presentation?.cinematic?.intro;
    const durationTicks = intro?.durationTicks;
    const from = intro?.from;
    const to = intro?.to;
    const offsets = [
      from?.distance, from?.azimuth, from?.polar,
      to?.distance, to?.azimuth, to?.polar,
    ];
    if (!Number.isInteger(durationTicks) || durationTicks <= 0 || !offsets.every(Number.isFinite)) return;
    this.stageIntro = {
      startTick: snapshot.tick,
      durationTicks,
      from: { distance: from.distance, azimuth: from.azimuth, polar: from.polar },
      to: { distance: to.distance, azimuth: to.azimuth, polar: to.polar },
    };
    // The event can arrive on the same authoritative tick as a preceding
    // baseline camera update. Re-seed follow once so zero delta time cannot
    // suppress the authored opening offset.
    this.cameraFollowInit = false;
  }

  stageIntroOffsets(tick) {
    const intro = this.stageIntro;
    if (!intro || this.reducedMotion || !Number.isInteger(tick)) return null;
    const progress = THREE.MathUtils.clamp((tick - intro.startTick) / intro.durationTicks, 0, 1);
    if (progress >= 1) {
      this.stageIntro = null;
      this.cameraFollowInit = false;
      return null;
    }
    return {
      distance: THREE.MathUtils.lerp(intro.from.distance, intro.to.distance, progress),
      azimuth: THREE.MathUtils.lerp(intro.from.azimuth, intro.to.azimuth, progress),
      polar: THREE.MathUtils.lerp(intro.from.polar, intro.to.polar, progress),
    };
  }

  updateCamera(snapshot, nowMs = performance.now()) {
    this.clearCameraShakeOffset();
    const tick = snapshot?.tick;
    const phaseTarget = cameraTierTarget(resolveCameraPhase(snapshot));
    if (Number.isInteger(tick)) {
      const active = this.cameraTierTransition;
      if (active && Math.abs(active.to - phaseTarget) <= 1e-9) {
        // Continue the in-flight tier transition.
      } else if (Math.abs(this.phaseZoomFactor - phaseTarget) > 1e-9) {
        this.cameraTierTransition = {
          from: this.phaseZoomFactor,
          to: phaseTarget,
          startTick: tick,
        };
      } else {
        this.cameraTierTransition = null;
      }
      const transition = this.cameraTierTransition;
      if (transition) {
        const elapsedTicks = Math.max(0, tick - transition.startTick);
        this.phaseZoomFactor = exponentialTransitionValue(
          transition.from,
          transition.to,
          elapsedTicks,
        );
        if (elapsedTicks >= CAMERA_TIER_TRANSITION_TICKS) this.cameraTierTransition = null;
      } else {
        this.phaseZoomFactor = phaseTarget;
      }
    } else {
      this.phaseZoomFactor = phaseTarget;
      this.cameraTierTransition = null;
    }

    // Manual zoom remains a relative player choice while the phase tier moves.
    this.zoomFactor = THREE.MathUtils.clamp(
      this.phaseZoomFactor * this.manualZoomRatio,
      MIN_ORBIT_DISTANCE,
      MAX_ORBIT_DISTANCE,
    );

    let deltaSeconds = 0;
    if (Number.isInteger(tick)) {
      if (this.cameraLastTick !== null && tick > this.cameraLastTick) {
        deltaSeconds = (tick - this.cameraLastTick) / SIM_TICK_RATE;
      }
      this.cameraLastTick = tick;
    } else {
      deltaSeconds = Math.max(0, (nowMs - (this.cameraLastMs ?? nowMs)) / 1000);
    }
    this.cameraLastMs = nowMs;

    // The commander is the sole authoritative target. Clamp malformed or
    // transitional coordinates to the arena plane so no outside target can
    // drag the framing beyond the authored world.
    const commander = snapshot?.commander ?? snapshot?.player;
    const commanderPoint = worldPoint(commander ?? {});
    const targetX = THREE.MathUtils.clamp(commanderPoint.x, -WORLD_SCALE, WORLD_SCALE);
    const targetY = commanderPoint.y;
    const targetZ = THREE.MathUtils.clamp(commanderPoint.z, -WORLD_SCALE, WORLD_SCALE);

    // Player-selected yaw/pitch and stage-intro offsets remain modifiers over
    // the phase tier; no phase transition blocks orbit input.
    const intro = this.stageIntroOffsets(tick);
    const cameraDistance = THREE.MathUtils.clamp(
      this.zoomFactor + (intro?.distance ?? 0),
      MIN_ORBIT_DISTANCE,
      MAX_ORBIT_DISTANCE,
    );
    const cameraYaw = wrapAngle(this.orbitYaw + (intro?.azimuth ?? 0));
    const cameraPitch = THREE.MathUtils.clamp(
      this.orbitPitch + (intro?.polar ?? 0),
      MIN_ORBIT_PITCH,
      MAX_ORBIT_PITCH,
    );
    const horizontalRadius = cameraDistance * Math.cos(cameraPitch);
    const height = cameraDistance * Math.sin(cameraPitch);
    const desiredX = targetX + horizontalRadius * Math.sin(cameraYaw);
    const desiredY = targetY + height;
    const desiredZ = targetZ + horizontalRadius * Math.cos(cameraYaw);

    if (!this.cameraFollowInit || this.reducedMotion) {
      this.camera.position.set(desiredX, desiredY, desiredZ);
      this.cameraTarget.set(targetX, targetY, targetZ);
      this.cameraFollowInit = true;
    } else {
      const positionAlpha = exponentialSmoothingFactor(CAMERA_POSITION_LAMBDA, deltaSeconds);
      const lookAlpha = exponentialSmoothingFactor(CAMERA_LOOK_LAMBDA, deltaSeconds);
      this.camera.position.x += (desiredX - this.camera.position.x) * positionAlpha;
      this.camera.position.y += (desiredY - this.camera.position.y) * positionAlpha;
      this.camera.position.z += (desiredZ - this.camera.position.z) * positionAlpha;
      this.cameraTarget.x += (targetX - this.cameraTarget.x) * lookAlpha;
      this.cameraTarget.y += (targetY - this.cameraTarget.y) * lookAlpha;
      this.cameraTarget.z += (targetZ - this.cameraTarget.z) * lookAlpha;
    }
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y + 0.6, this.cameraTarget.z);

    // Camera-relative rim light stays opposite the live orbit.
    const rimYaw = cameraYaw + Math.PI;
    const rimHorizontalRadius = RIM_LIGHT_DISTANCE * Math.cos(RIM_LIGHT_PITCH);
    const rimHeight = RIM_LIGHT_DISTANCE * Math.sin(RIM_LIGHT_PITCH);
    this.rimLight.position.set(
      this.cameraTarget.x + rimHorizontalRadius * Math.sin(rimYaw),
      this.cameraTarget.y + rimHeight,
      this.cameraTarget.z + rimHorizontalRadius * Math.cos(rimYaw),
    );
    this.rimLightTarget.position.copy(this.cameraTarget);
  }

  /**
   * Projects a world point to normalized device coordinates for the DOM
   * world-space HUD overlay (app.js renderWorldHud()).
   *
   * RESTORED (D26). This existed in the Cycle 3 renderer (9a60a49) and was
   * lost wholesale by merge 5a5f63a, which adopted the incoming
   * recovery/g2-stage2-binding renderer as canonical -- that side had never
   * carried these methods, so a `theirs` resolution silently dropped them
   * while app.js kept calling them behind `?.`, leaving every world-space
   * HUD element (companion nameplates, floating damage numbers, objective
   * waypoint arrow, extraction capture prompt) rendering nothing.
   *
   * Returns null ONLY when there is no usable 3D camera (unmounted or
   * disposed) or for points behind the camera, where no meaningful screen
   * position exists: for this camera's 0 < near < far, |ndc.z| > 1 holds
   * exactly for view-space z >= 0.
   *
   * Otherwise ALWAYS returns { x, y, visible } with RAW (unclamped) NDC.
   * `visible` is true only when both axes fall inside [-1,1]. Callers need
   * both behaviours and the distinction is load-bearing: nameplates and the
   * capture prompt hide on visible===false, while the waypoint arrow
   * deliberately consumes the out-of-range values to clamp an offscreen
   * direction indicator to the viewport edge (app.js:1376 branches on
   * `!ndc.visible`). Discarding the raw values would silently disable that
   * arrow.
   */
  worldToNDC(worldVec) {
    if (this.disposed || !this.camera) return null;
    // Vector3.project() reads camera.matrixWorldInverse, which three.js only
    // refreshes inside renderer.render(). Today app.js happens to call the
    // world-HUD pass after renderSnapshot(), so that ordering holds -- but
    // it is invisible coupling that would silently return stale (or, on a
    // never-rendered camera, identity-matrix) projections the moment a
    // caller runs this first. Refreshing here costs one matrix compose and
    // makes the method correct independent of call order.
    this.camera.updateMatrixWorld();
    const ndc = worldVec.clone().project(this.camera);
    if (ndc.z > 1 || ndc.z < -1) return null; // behind the camera
    return { x: ndc.x, y: ndc.y, visible: ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1 };
  }

  /**
   * NDC projection of a tracked actor's rendered ground anchor, including
   * authoritative terrain elevation. This is the feet position, not the
   * head.
   *
   * Callers that want a label to float above the actor apply that lift in
   * CSS screen-space pixels AFTER projecting (app.js's
   * WORLD_NAMEPLATE_LIFT_PX / WORLD_DAMAGE_NUMBER_LIFT_PX), never as a
   * world-unit y offset here. That is deliberate: this scene's world extent
   * is a fixed WORLD_SCALE diorama that a zoomed-in orbit camera can fill
   * entirely, so a world-unit height offset is not a stable "above the
   * head" distance and can push an on-screen actor's anchor outside the
   * frustum, reporting visible:false for something the player can see. A
   * screen-space pixel lift is zoom-varying by design but never breaks
   * visibility.
   *
   * Reads the RENDERED position, so a companion mid-follow-trail
   * (updateActorFollow) gets a nameplate on the body the player sees rather
   * than on the simulation position it is still easing toward.
   */
  projectEntityToScreen(entityId) {
    const record = this.actors.get(entityId);
    if (!record?.root) return null;
    return this.worldToNDC(record.root.position);
  }

  /**
   * NDC projection of a fixed ground point in normalized simulation space.
   * Optional `elevation` uses the same simulation-unit scale as actors.
   */
  projectStaticPoint(normalizedX, normalizedY, elevation = 0) {
    if (this.disposed || !this.camera) return null;
    return this.worldToNDC(new THREE.Vector3(
      finite(normalizedX, 0) * WORLD_SCALE,
      finite(elevation, 0) * WORLD_SCALE / (WORLD_WIDTH / 2),
      finite(normalizedY, 0) * WORLD_SCALE,
    ));
  }

  rememberVisualEvent(key) {
    if (this.visualEventKeys.has(key)) return false;
    this.visualEventKeys.add(key);
    if (this.visualEventKeys.size > MAX_VISUAL_EVENT_KEYS) {
      this.visualEventKeys.delete(this.visualEventKeys.values().next().value);
    }
    return true;
  }
  rememberAnimationEvent(key) {
    if (this.animationEventKeys.has(key)) return false;
    this.animationEventKeys.add(key);
    if (this.animationEventKeys.size > MAX_VISUAL_EVENT_KEYS) {
      this.animationEventKeys.delete(this.animationEventKeys.values().next().value);
    }
    return true;
  }

  retireVfxRecord(record) {
    if (!record) return;
    if (record.loadRequest) {
      this.pendingVfxLoads.delete(record.loadRequest);
      record.loadRequest = null;
    }
    this.vfxGroup?.remove(record.root);
    record.mixer?.stopAllAction();
    disposeObject3D(record.root);
  }

  trackVfxInstance(record) {
    if (!record) return false;
    this.vfxInstances.push(record);
    while (this.vfxInstances.length > MAX_VISUAL_EFFECTS) {
      const expendableIndex = this.vfxInstances.findIndex(
        (candidate) => !CRITICAL_VFX_EVENT_TYPES.includes(candidate.eventType),
      );
      const evictionIndex = expendableIndex >= 0 ? expendableIndex : 0;
      const [evicted] = this.vfxInstances.splice(evictionIndex, 1);
      this.retireVfxRecord(evicted);
    }
    return this.vfxInstances.includes(record);
  }

  spawnVfx(snapshot, event, tick) {
    const relPath = event?.type === "SKILL_CAST"
      ? SKILL_VFX_MODELS[event?.vfx || event?.skillId]
      : VFX_MODELS[event?.type];
    if (!relPath) return;
    const criticalEvent = CRITICAL_VFX_EVENT_TYPES.includes(event?.type);
    if (this.pendingVfxLoads.size >= MAX_VISUAL_EFFECTS && !criticalEvent) return;
    const generation = this.vfxGeneration;
    const anchor = effectAnchor(snapshot, event);
    if (!anchor) return;
    const questPresentation = questVfxPresentationForEvent(event);
    const lifetime = questPresentation?.lifetime ?? (event.type === "BOSS_ATTACK_TELEGRAPHED"
      ? Math.max(1, finite(event.windupTicks, VFX_LIFETIME_TICKS[event.type] ?? 30))
      : (VFX_LIFETIME_TICKS[event.type] ?? 30));
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const contactDelayTicks = Math.ceil(this.impactContactDelayMs(event, events) * SIM_TICK_RATE / 1000);
    const startTick = tick + contactDelayTicks;
    const untilTick = startTick + lifetime;
    const placeholder = new THREE.Group();
    const p = worldPoint(anchor);
    placeholder.position.set(p.x, p.y + 0.6, p.z);
    placeholder.visible = contactDelayTicks === 0;
    placeholder.userData.eventAnchor = questPresentation ? "quest-point" : "event-entity";
    placeholder.userData.questVfxIntent = questPresentation?.intent ?? null;
    this.vfxGroup.add(placeholder);
    const semanticVfxId = semanticVfxIdForEvent(event);
    const record = {
      root: placeholder,
      startTick,
      untilTick,
      loaded: false,
      semanticVfxId,
      eventType: event.type,
      questVfxIntent: questPresentation?.intent ?? null,
      loadRequest: null,
    };
    if (!this.trackVfxInstance(record)) return;
    const loadRequest = instantiateVfxModel(
      relPath,
      () => generation === this.vfxGeneration && this.vfxInstances.includes(record),
    ).then((loaded) => {
      if (!loaded) return;
      const { instance, mixer, action } = loaded;
      if (generation !== this.vfxGeneration || !this.vfxInstances.includes(record)) {
        mixer?.stopAllAction();
        disposeObject3D(instance);
        return;
      }
      placeholder.add(instance);
      applySkillVfxSilhouette(instance, semanticVfxId);
      applyQuestVfxPresentation(instance, questPresentation, this.reducedMotion);
      record.mixer = mixer;
      record.action = action;
      record.loaded = true;
      applyTransientVfxPolicy(record, this.reducedMotion);
    }).catch(() => {
      const index = this.vfxInstances.indexOf(record);
      if (index >= 0) this.vfxInstances.splice(index, 1);
      this.retireVfxRecord(record);
    });
    record.loadRequest = loadRequest;
    this.pendingVfxLoads.add(loadRequest);
    loadRequest.finally(() => {
      this.pendingVfxLoads.delete(loadRequest);
      if (record.loadRequest === loadRequest) record.loadRequest = null;
    });
  }

  // Runs BEFORE reconcileActors() retires this tick's dead enemies, so their
  // actor record (model path + last synced position) is still readable.
  // Captures just enough to spawn a standalone death-echo actor afterward
  // (collectFeedback, which runs after retirement) -- the echo is NOT the
  // same actor continuing to exist, it's a short-lived visual-only replay of
  // the die clip at the enemy's last position, same lifecycle pattern as
  // spawnVfx()'s vfxInstances pool.
  captureDeathEchoes(snapshot) {
    for (const event of Array.isArray(snapshot?.events) ? snapshot.events : []) {
      if (event?.type !== "ENEMY_DEFEATED") continue;
      const key = feedbackKey(event);
      if (!this.rememberVisualEvent(key)) continue;
      const record = this.actors.get(event.enemyId);
      if (!record?.root || !record.modelPath || !record.actions?.die) continue;
      if (this.pendingDeathEchoes.length >= MAX_VISUAL_EFFECTS) this.pendingDeathEchoes.shift();
      this.pendingDeathEchoes.push({
        modelPath: record.modelPath,
        x: record.root.position.x,
        y: record.root.position.y,
        z: record.root.position.z,
        targetHeight: record.targetHeight ?? TARGET_HEIGHT.enemy,
      });
    }
  }

  spawnDeathEcho(echo, tick) {
    if (this.pendingDeathEchoLoads.size >= MAX_VISUAL_EFFECTS) return;
    const generation = this.vfxGeneration;
    const loadRequest = instantiateActorModel(echo.modelPath, echo.targetHeight)
      .then(({ instance, mixer, actions }) => {
        if (this.disposed || generation !== this.vfxGeneration) {
          mixer?.stopAllAction();
          disposeObject3D(instance);
          return;
        }
        instance.position.set(echo.x, echo.y, echo.z);
        this.vfxGroup.add(instance);
        const action = actions.die;
        let untilTick = tick + 72; // DEFAULT_BUDGETS.die.targetFrames @ 60fps, scripts/rig-character-asset-blender.py
        if (action) {
          const clip = action.getClip();
          if (Number.isFinite(clip?.duration)) untilTick = tick + Math.ceil(clip.duration * 60);
        }
        const record = {
          root: instance,
          untilTick,
          mixer,
          action,
          loaded: true,
          semanticVfxId: "death-echo",
        };
        this.trackVfxInstance(record);
        applyTransientVfxPolicy(record, this.reducedMotion);
      })
      .catch(() => {});
    this.pendingDeathEchoLoads.add(loadRequest);
    loadRequest.finally(() => this.pendingDeathEchoLoads.delete(loadRequest));
  }

  // Eases one actor's rendered yaw toward the heading syncActorPosition()
  // derived from its travel direction (D23 Phase 1). Split out of
  // updateAnimations() so the facing rule is testable on its own and so an
  // unrigged actor (no mixer, so no animation work) still turns.
  //
  // Frame-rate independent: the per-frame factor is 1 - e^(-rate*dt), which
  // converges on the same angle in the same wall-clock time whether the
  // frame took 8ms or 33ms. A bare `yaw += diff * k` would turn faster on a
  // high-refresh display and slower on a janky frame.
  //
  // Under reduced-motion the turn is applied instantly instead of eased,
  // matching updateCamera()'s existing treatment of the follow-pan: the
  // actor still ends up facing the right way (facing is information, not
  // decoration -- suppressing it entirely would hide which way an enemy is
  // heading), only the animated sweep is removed.
  updateActorFacing(record, deltaSeconds) {
    if (!record.root || record.targetYaw === null) return;
    if (record.yaw === null) {
      record.yaw = record.targetYaw;
    } else if (this.reducedMotion) {
      record.yaw = record.targetYaw;
    } else {
      // Shortest-path delta: wrapAngle folds a +350 degree turn into -10.
      const diff = wrapAngle(record.targetYaw - record.yaw);
      const t = 1 - Math.exp(-FACING_TURN_RATE * deltaSeconds);
      record.yaw = wrapAngle(record.yaw + diff * t);
    }
    record.root.rotation.y = record.yaw;
  }

  // Tick-bearing snapshots use their monotonic 60 Hz progression. A
  // STAGE_STARTED snapshot at tick zero is a fresh timeline boundary; other
  // regressing ticks remain stale and never move the baseline backward.
  // The wall-clock path remains for direct utility callers without a tick.
  animationDelta(nowMs, tick, startsStageAtTickZero = false) {
    if (Number.isInteger(tick)) {
      let delta = 0;
      if (startsStageAtTickZero) {
        this.lastAnimTick = tick;
      } else if (this.lastAnimTick === null) {
        this.lastAnimTick = tick;
      } else if (tick > this.lastAnimTick) {
        delta = Math.min(tick - this.lastAnimTick, MAX_ANIMATION_TICK_DELTA) / SIM_TICK_RATE;
        this.lastAnimTick = tick;
      }
      this.lastAnimMs = nowMs;
      return delta;
    }
    const delta = Math.min((nowMs - (this.lastAnimMs ?? nowMs)) / 1000, 0.1);
    this.lastAnimMs = nowMs;
    return delta;
  }

  // A LoopOnce action marks itself paused when its clamped final frame is
  // reached; that boundary owns one-shot recovery while this loop keeps
  // locomotion synchronized.
  updateAnimations(nowMs, tick, startsStageAtTickZero = false) {
    const delta = this.animationDelta(nowMs, tick, startsStageAtTickZero);
    for (const record of this.actors.values()) {
      if (record.mixer) record.mixer.update(delta);
      if (record.oneShotAction?.paused) this.finishOneShot(record);
      this.updateActorFollow(record, delta);
      this.updateActorFacing(record, delta);
      if (record.kind === "projectile") this.updateProjectilePresentation(record, nowMs);
      else this.updateAmbientIdle(record, nowMs);
      if (!record.oneShotAction && !record.dead) this.recoverLocomotion(record);
      for (const presentation of record.presentationMixers ?? []) presentation.mixer.update(delta);
    }
    for (const echo of this.vfxInstances) {
      if (echo.mixer) echo.mixer.update(delta);
    }
    for (const record of this.stageDecorRecords) {
      record.mixer?.update(delta);
      if (record.kind !== "stage-npc") continue;
      if (record.oneShotAction?.paused) this.finishOneShot(record);
      if (!record.oneShotAction) this.recoverLocomotion(record);
      applyStageNpcGuardPose(record);
      this.updateAmbientIdle(record, nowMs);
    }
  }

  combatTarget(entityId) {
    const actor = this.actors.get(entityId);
    if (actor) return actor;
    return entityId === "gate" && this.gateMesh ? { root: this.gateMesh } : null;
  }

  combatDelivery(attacker, target) {
    const identity = attacker?.role ?? attacker?.entityKind;
    if (RANGED_COMBAT_IDENTITIES.includes(identity)) return "ranged";
    if (MELEE_COMBAT_IDENTITIES.includes(identity)) return "melee";
    if (!attacker?.root || !target?.root) return null;
    const dx = attacker.root.position.x - target.root.position.x;
    const dz = attacker.root.position.z - target.root.position.z;
    return Math.hypot(dx, dz) > MELEE_PRESENTATION_DISTANCE ? "ranged" : "melee";
  }

  triggerAttackDelivery(attacker, target, nowMs, charged = false) {
    if (!attacker) return false;
    const delivery = this.combatDelivery(attacker, target);
    const dedicatedKey = delivery === "melee"
      ? "attack_melee"
      : (delivery === "ranged" || charged ? "attack_ranged" : null);
    if (attacker.kind === "commander" && !dedicatedKey) return false;
    const key = dedicatedKey && (attacker.kind === "commander" || attacker.actions?.[dedicatedKey])
      ? dedicatedKey
      : (charged || delivery === "ranged" ? "critical" : "attack");
    const presentation = delivery ? { delivery, target } : null;
    return this.triggerAction(attacker, key, nowMs, presentation);
  }

  // --- Impact feel (hit flash / knockback / camera shake) -------------------
  // All three are presentation-only: they read the frozen snapshot events,
  // keep their state on the renderer instance, and are applied to owned
  // material clones, actor root offsets, and the camera AFTER updateCamera()
  // has placed it. Nothing writes back into the snapshot.

  impactContactDelayMs(event, events) {
    const impact = IMPACT_FEEDBACK_SOURCES[event?.type]?.(event);
    if (!impact?.targetId) return 0;
    const group = event?.causalRootId ?? event?.castInstanceId
      ?? `${event?.tick ?? ""}:${impact.attackerId ?? ""}:${event?.type ?? ""}`;
    let rank = 0;
    for (let index = 0; index < events.length; index += 1) {
      const candidateEvent = events[index];
      const candidate = IMPACT_FEEDBACK_SOURCES[candidateEvent?.type]?.(candidateEvent);
      if (!candidate?.targetId || candidate.targetId >= impact.targetId) continue;
      const candidateGroup = candidateEvent?.causalRootId ?? candidateEvent?.castInstanceId
        ?? `${candidateEvent?.tick ?? ""}:${candidate.attackerId ?? ""}:${candidateEvent?.type ?? ""}`;
      if (candidateGroup !== group) continue;
      let firstForTarget = true;
      for (let prior = 0; prior < index; prior += 1) {
        const priorEvent = events[prior];
        const priorImpact = IMPACT_FEEDBACK_SOURCES[priorEvent?.type]?.(priorEvent);
        const priorGroup = priorEvent?.causalRootId ?? priorEvent?.castInstanceId
          ?? `${priorEvent?.tick ?? ""}:${priorImpact?.attackerId ?? ""}:${priorEvent?.type ?? ""}`;
        if (priorImpact?.targetId === candidate.targetId && priorGroup === candidateGroup) {
          firstForTarget = false;
          break;
        }
      }
      if (firstForTarget) rank += 1;
    }
    return Math.min(rank, MAX_IMPACT_STAGGER_TARGETS) * IMPACT_CONTACT_STAGGER_MS;
  }

  registerImpactFeedback(event, nowMs, events) {
    const impact = IMPACT_FEEDBACK_SOURCES[event?.type]?.(event);
    if (!impact?.targetId) return;
    const targetRecord = this.actors.get(impact.targetId) ?? this.combatTarget(impact.targetId);
    if (!targetRecord?.root) return;
    const attacker = impact.attackerId ? this.actors.get(impact.attackerId) : null;
    const critical = impact.critical === true;
    const bossContact = attacker?.kind === "boss" || targetRecord.kind === "boss";
    const heavy = impact.heavy === true || critical;
    const startMs = nowMs + this.impactContactDelayMs(event, events);
    this.hitFlashes.set(impact.targetId, {
      startMs,
      untilMs: startMs + (heavy ? IMPACT_FLASH_HEAVY_MS : IMPACT_FLASH_MS),
      color: heavy ? IMPACT_FLASH_HEAVY_COLOR : IMPACT_FLASH_COLOR,
      accent: critical ? IMPACT_FLASH_CRITICAL_ACCENT : null,
      critical,
      static: this.reducedMotion,
      peak: heavy ? IMPACT_FLASH_HEAVY_PEAK : IMPACT_FLASH_PEAK,
      record: targetRecord,
    });
    if (this.reducedMotion) return;

    let dx = 0;
    let dz = 0;
    if (attacker?.root) {
      dx = targetRecord.root.position.x - attacker.root.position.x;
      dz = targetRecord.root.position.z - attacker.root.position.z;
    }
    const length = Math.hypot(dx, dz);
    if (length > 1e-4) {
      this.knockbacks.set(impact.targetId, {
        startMs,
        untilMs: startMs + (heavy ? IMPACT_KNOCKBACK_HEAVY_MS : IMPACT_KNOCKBACK_MS),
        dx: dx / length,
        dz: dz / length,
        distance: heavy ? IMPACT_KNOCKBACK_HEAVY_DISTANCE : IMPACT_KNOCKBACK_DISTANCE,
      });
    }
    if (!heavy && !bossContact) return;
    const amplitude = Math.min(
      IMPACT_SHAKE_MAX_AMPLITUDE,
      bossContact ? IMPACT_SHAKE_BOSS_AMPLITUDE : IMPACT_SHAKE_AMPLITUDE,
    );
    const currentShake = this.cameraShake;
    if (currentShake && currentShake.untilMs > nowMs
      && (currentShake.startMs < startMs
        || (currentShake.startMs === startMs && currentShake.amplitude >= amplitude))) return;
    this.impactShakeSeed = (this.impactShakeSeed + 1) % 1024;
    this.cameraShake = {
      startMs,
      untilMs: startMs + IMPACT_SHAKE_MS,
      amplitude,
      seed: this.impactShakeSeed,
    };
  }

  // Emissive flash on the actor's own material clones. The pre-flash emissive
  // value is captured once per material and always restored, so an actor that
  // is hit repeatedly never accumulates brightness.
  applyHitFlashes(nowMs) {
    for (const [entityId, flash] of this.hitFlashes) {
      const root = flash.record?.root;
      if (!root || !root.parent) {
        this.hitFlashes.delete(entityId);
        continue;
      }
      const span = Math.max(1, flash.untilMs - flash.startMs);
      const progress = THREE.MathUtils.clamp((nowMs - flash.startMs) / span, 0, 1);
      if (nowMs < flash.startMs) continue;
      const done = progress >= 1;
      const strength = done ? 0 : (flash.static ? flash.peak : flash.peak * (1 - progress) * (1 - progress));
      root.traverse((node) => {
        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
        for (const material of materials) {
          if (!material?.emissive) continue;
          if (!material.userData.impactBaseEmissive) {
            material.userData.impactBaseEmissive = material.emissive.clone();
            material.userData.impactBaseEmissiveIntensity = finite(material.emissiveIntensity, 1);
          }
          if (flash.critical && material.color && !material.userData.impactBaseColor) {
            material.userData.impactBaseColor = material.color.clone();
          }
          const base = material.userData.impactBaseEmissive;
          if (done) {
            material.emissive.copy(base);
            material.emissiveIntensity = material.userData.impactBaseEmissiveIntensity;
            if (material.userData.impactBaseColor && material.color) {
              material.color.copy(material.userData.impactBaseColor);
            }
            continue;
          }
          material.emissive.copy(base).lerp(flash.color, Math.min(1, strength));
          material.emissiveIntensity = material.userData.impactBaseEmissiveIntensity + strength;
          if (flash.accent && material.color) {
            material.color.copy(material.userData.impactBaseColor).lerp(flash.accent, Math.min(0.55, strength * 0.45));
          }
        }
      });
      if (done) this.hitFlashes.delete(entityId);
    }
  }

  // Render-only displacement. updateActorFollow() re-lerps the root toward the
  // authoritative goal every frame, so this offset decays on its own and can
  // never desync the actor from its snapshot position.
  applyKnockbacks(nowMs) {
    for (const [entityId, knockback] of this.knockbacks) {
      const record = this.actors.get(entityId);
      if (!record?.root) {
        this.knockbacks.delete(entityId);
        continue;
      }
      const span = Math.max(1, knockback.untilMs - knockback.startMs);
      const progress = THREE.MathUtils.clamp((nowMs - knockback.startMs) / span, 0, 1);
      if (nowMs < knockback.startMs) continue;
      if (progress >= 1) {
        this.knockbacks.delete(entityId);
        continue;
      }
      const remaining = 1 - progress;
      const eased = remaining * remaining * (3 - 2 * remaining);
      record.root.position.x += knockback.dx * knockback.distance * eased;
      record.root.position.z += knockback.dz * knockback.distance * eased;
    }
  }

  // Decaying positional jitter applied after updateCamera() has committed the
  // orbit position, so the orbit state itself (yaw/pitch/zoom) is never
  // perturbed and the shake fully cancels when it expires.
  clearCameraShakeOffset() {
    if (!this.camera || !this.cameraShakeOffset) return;
    this.camera.position.sub(this.cameraShakeOffset);
    this.cameraShakeOffset.set(0, 0, 0);
  }

  applyCameraShake(nowMs) {
    const shake = this.cameraShake;
    if (!shake || !this.camera) return;
    const span = Math.max(1, shake.untilMs - shake.startMs);
    const progress = THREE.MathUtils.clamp((nowMs - shake.startMs) / span, 0, 1);
    if (nowMs < shake.startMs) return;
    if (progress >= 1) {
      this.clearCameraShakeOffset();
      this.cameraShake = null;
      return;
    }
    const decay = (1 - progress) * (1 - progress);
    const phase = shake.seed * 1.7 + progress * IMPACT_SHAKE_FREQUENCY;
    this.cameraShakeOffset.set(
      Math.sin(phase) * shake.amplitude * decay,
      Math.sin(phase * 1.37 + 1.1) * shake.amplitude * decay * 0.6,
      Math.cos(phase * 0.91 + 0.4) * shake.amplitude * decay,
    );
    this.camera.position.add(this.cameraShakeOffset);
  }

  updateImpactFeedback(nowMs) {
    try {
      this.applyHitFlashes(nowMs);
      if (this.reducedMotion) {
        this.knockbacks.clear();
        this.cameraShake = null;
        return;
      }
      this.applyKnockbacks(nowMs);
      this.applyCameraShake(nowMs);
    } catch {
      // Impact feel is cosmetic; never let it break the render loop.
      this.hitFlashes.clear();
      this.knockbacks.clear();
      this.cameraShake = null;
    }
  }


  // Every transition is sourced from a public snapshot event field. A
  // separate bounded event-key set makes repeated renders of one sim tick
  // idempotent without mutating the frozen snapshot or restarting clips.
  triggerCombatActions(event, nowMs, snapshot) {
    if (!event?.type || !this.rememberAnimationEvent(feedbackKey(event))) return;
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    this.registerImpactFeedback(event, nowMs, events);
    this.triggerStageNpcStoryBeat(event, nowMs);
    const actor = (id) => this.actors.get(id);
    const target = (id) => this.combatTarget(id);
    switch (event.type) {
      case "STAGE_STARTED":
        this.startStageIntro(snapshot);
        this.triggerAction(actor("commander"), "show", nowMs);
        break;
      case "ENEMY_SPAWNED":
      case "BOSS_SPAWNED":
        this.triggerAction(actor(event.entityId), "show", nowMs);
        break;
      case "ECHO_WARDEN_AWAKENING_TRIGGERED":
        this.triggerAction(actor(event.entityId), "show", nowMs);
        break;
      case "WEAPON_FIRED":
        this.triggerAttackDelivery(actor(event.entityId), target(event.targetId), nowMs, event.critical === true);
        if (event.critical === true) this.triggerAction(actor(event.targetId), "bighit", nowMs);
        break;
      case "BASIC_ATTACK":
        this.triggerAttackDelivery(actor(event.entityId), target(event.targetId), nowMs, event.critical === true);
        this.triggerAction(actor(event.entityId), "attack", nowMs);
        break;
      case "SKILL_CAST":
        this.triggerAction(actor("commander"), event.motion || "critical", nowMs);
        break;
      case "SKILL_RESOLVED_DAMAGE":
        this.triggerAttackDelivery(actor(event.sourceId), target(event.targetId), nowMs, event.critical === true);
        this.triggerAction(actor(event.targetId), event.critical === true ? "bighit" : "hit", nowMs);
        break;
      case "CRITICAL_HIT":
        this.triggerAttackDelivery(actor(event.entityId), target(event.targetId), nowMs, true);
        this.triggerAction(actor(event.targetId), "bighit", nowMs);
        break;
      case "ENEMY_ATTACK":
        this.triggerAttackDelivery(actor(event.entityId), target(event.targetId), nowMs);
        if (event.damage > 0) this.triggerAction(actor(event.targetId), "hit", nowMs);
        break;
      case "MELEE_IMPACT":
        if (event.guardedBy) this.triggerAction(actor(event.guardedBy), "defence", nowMs);
        this.triggerAction(actor(event.targetId), event.critical === true ? "bighit" : "hit", nowMs);
        break;
      case "PROJECTILE_IMPACT":
        if (event.guardedBy) this.triggerAction(actor(event.guardedBy), "defence", nowMs);
        this.triggerAction(actor(event.targetId), event.hit === false ? "avoid" : "hit", nowMs);
        break;
      case "COMMANDER_DAMAGED":
        this.triggerAction(actor("commander"), "hit", nowMs);
        break;
      case "COMPANION_DAMAGED":
        this.triggerAction(actor(event.entityId), "hit", nowMs);
        break;
      case "BOSS_ATTACK_CANCELLED":
        this.triggerAction(actor(event.targetId), "avoid", nowMs);
        break;
      case "WARDENS_WARD_TRIGGERED":
        this.triggerAction(actor(event.entityId), "defence", nowMs);
        break;
      case "COMPANION_DOWNED":
        this.triggerAction(actor(event.entityId), "die", nowMs);
        break;
      default:
        break;
    }
  }

  collectFeedback(snapshot) {
    const tick = finite(snapshot?.tick, 0);
    let retainedVfxCount = 0;
    for (const record of this.vfxInstances) {
      if (record.untilTick <= tick) {
        this.retireVfxRecord(record);
        continue;
      }
      record.root.visible = !Number.isFinite(record.startTick) || record.startTick <= tick;
      this.vfxInstances[retainedVfxCount] = record;
      retainedVfxCount += 1;
    }
    this.vfxInstances.length = retainedVfxCount;

    const nowMs = performance.now();
    for (const event of Array.isArray(snapshot?.events) ? snapshot.events : []) {
      const hasVfx = Boolean(VFX_MODELS[event?.type]
        || (event?.type === "SKILL_CAST" && SKILL_VFX_MODELS[event?.vfx || event?.skillId]));
      if (hasVfx) {
        const key = feedbackKey(event);
        if (this.rememberVisualEvent(key)) this.spawnVfx(snapshot, event, tick);
      }
      this.triggerCombatActions(event, nowMs, snapshot);
    }
    for (const echo of this.pendingDeathEchoes.splice(0)) {
      this.spawnDeathEcho(echo, tick);
    }
    this.pendingInputFeedback = null;
  }


  renderSnapshot(snapshot = {}, frame = {}) {
    if (this.disposed || !this.renderer || !this.camera || !this.scene) return;
    const { width, height } = bounds(this.canvas, this.viewport ?? frame?.viewport);
    const nativeWidth = Math.max(1, Math.round(width * this.pixelRatio));
    const nativeHeight = Math.max(1, Math.round(height * this.pixelRatio));
    const targetScale = this.softwareRenderer
      ? Math.min(1, Math.sqrt(SOFTWARE_MAX_BACKBUFFER_PX / (nativeWidth * nativeHeight)))
      : 1;
    const bufferWidth = Math.max(1, Math.floor(nativeWidth * targetScale));
    const bufferHeight = Math.max(1, Math.floor(nativeHeight * targetScale));
    const bufferScale = Math.min(1, bufferWidth / nativeWidth, bufferHeight / nativeHeight);
    const currentSize = this.renderer.getSize(this.rendererSize);
    if (
      currentSize.x !== bufferWidth ||
      currentSize.y !== bufferHeight ||
      this.canvas.width !== bufferWidth ||
      this.canvas.height !== bufferHeight
    ) {
      this.renderer.setSize(bufferWidth, bufferHeight, false);
    }
    if (this.canvas.dataset) this.canvas.dataset.renderScale = String(bufferScale);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const startsStageAtTickZero = this.startsStageAtTickZero(snapshot);
    const resetVisualEventDeduplication = this.resetPresentationEventDeduplicationForNewRun(startsStageAtTickZero);
    if (resetVisualEventDeduplication) {
      // RealtimeBattle is reused for retries. A tick-zero run boundary must
      // not inherit the previous run's late-phase framing or smoothing clock.
      const phase = resolveCameraPhase(snapshot);
      this.cameraFollowInit = false;
      this.cameraLastTick = null;
      this.cameraLastMs = null;
      this.cameraTierTransition = null;
      this.phaseZoomFactor = cameraTierTarget(phase);
      this.manualZoomRatio = 1;
      this.zoomFactor = this.phaseZoomFactor;
      this.orbitYaw = 0;
      this.orbitPitch = THREE.MathUtils.degToRad(55);
      this.stageIntro = null;
      this.fogFarTransition = null;
      if (this.scene.fog) {
        const fogRange = stageFogRange(resolveStageId(snapshot), phase);
        this.scene.fog.near = fogRange.near;
        this.scene.fog.far = fogRange.far;
      }
    }
    this.ensureStageTerrain(resolveStageId(snapshot), resolveCameraPhase(snapshot), snapshot?.tick);
    this.captureDeathEchoes(snapshot);
    this.reconcileActors(snapshot);
    this.collectFeedback(snapshot);
    const nowMs = performance.now();
    this.updateCamera(snapshot, nowMs);
    this.updateAnimations(nowMs, snapshot?.tick, startsStageAtTickZero);
    // Impact feel runs last: the flash/knockback/shake it applies must land on
    // top of the camera and actor placement committed above.
    this.updateImpactFeedback(nowMs);

    this.renderer.render(this.scene, this.camera);
  }

  onVisualFeedback(inputSeq) {
    this.lastFeedback = inputSeq;
    this.pendingInputFeedback = inputSeq;
  }

  dispose() {
    this.clearCameraShakeOffset();
    this.stageLoadToken += 1;
    this.vfxGeneration += 1;
    this.appearanceGeneration += 1;
    this.clearStageWorld();
    for (const record of this.actors.values()) {
      this.clearAttackPresentation(record);
      record.mixer?.stopAllAction();
      if (record.root) disposeObject3D(record.root);
    }
    this.actors.clear();
    this.hitFlashes.clear();
    this.knockbacks.clear();
    this.cameraShake = null;
    for (const record of this.vfxInstances) {
      record.mixer?.stopAllAction();
      disposeObject3D(record.root);
    }
    this.vfxInstances = [];
    this.pendingDeathEchoes = [];
    this.pendingVfxLoads.clear();
    this.pendingDeathEchoLoads.clear();
    this.pendingStageNpcBeats.clear();
    if (this.gateMesh) disposeObject3D(this.gateMesh);
    this.gateMesh = null;
    if (this.pressureGroup) disposeObject3D(this.pressureGroup);
    this.pressureGroup = null;
    this.pressureLane = null;
    this.pressureArrow = null;
    this.pressureTargetRing = null;
    this.environmentTexture?.dispose();
    this.environmentTexture = null;

    this.scene = null;
    this.camera = null;
    this.terrainGroup = null;
    this.actorGroup = null;
    this.vfxGroup = null;
    this.cameraFollowInit = false;
    // Session-boundary reset: a fresh mount starts at the authored DESCENT
    // tier (55° pitch, 20.8 world-unit distance). Drag release and follow
    // reacquisition never reset the player's yaw or manual zoom ratio.
    this.orbitYaw = 0;
    this.orbitPitch = THREE.MathUtils.degToRad(55);
    this.phaseZoomFactor = ORBIT_ZOOM_DEFAULT;
    this.manualZoomRatio = 1;
    this.zoomFactor = ORBIT_ZOOM_DEFAULT;
    this.cameraTierTransition = null;
    this.cameraLastTick = null;
    this.cameraLastMs = null;
    this.fogFarTransition = null;
    this.ambientLight = null;
    this.keyLight = null;
    this.rimLight = null;
    this.rimLightTarget = null;
    this.stagePaletteId = null;

    this.renderer?.dispose();
    this.renderer = null;
    if (this.canvas?.dataset) delete this.canvas.dataset.renderScale;
    this.softwareRenderer = false;
    this.pixelRatio = 1;
    this.canvas = null;
    this.viewport = null;
    this.pendingInputFeedback = null;
    this.visualEventKeys.clear();
    this.animationEventKeys.clear();
    this.loadedStageId = null;
    this.loadingStageId = null;
    this.stageDecorRecords = [];
    this.stageTerrainRecord = null;
    this.stageTerrainError = null;
    this.stageTerrainFailedId = null;
    this.lastAnimMs = null;
    this.lastAnimTick = null;
    this.stageIntro = null;
    this.disposed = true;
  }

  debugPresentationState(id = null) {
    const describe = (entityId, record) => {
      const position = record.root
        ? { x: record.root.position.x, y: record.root.position.y, z: record.root.position.z }
        : null;
      if (record.kind === "projectile") {
        return {
          id: entityId,
          kind: record.kind,
          projectileFamily: record.projectileFamily,
          presentation: record.projectilePresentation,
          travelProgress: record.travelProgress,
          position,
        };
      }
      return {
        id: entityId,
        kind: record.kind,
        position,
        modelPath: record.modelPath ?? null,
        targetHeight: record.targetHeight ?? TARGET_HEIGHT.enemy,
        meshIntegrity: record.meshIntegrity ?? record.root?.userData?.meshIntegrity ?? null,
        groundedMinY: record.groundedMinY ?? record.root?.userData?.groundedMinY ?? null,
        ambient: {
          state: record.ambientState ?? "suppressed",
          active: record.ambientActive === true,
          breath: record.ambientOffsets?.breath ?? 0,
          weight: record.ambientOffsets?.weight ?? 0,
          look: record.ambientOffsets?.look ?? 0,
        },
        moving: record.moving === true,
        dead: record.dead === true,
        activeActionKey: record.activeActionKey ?? null,
        oneShotActionKey: record.oneShotActionKey ?? null,
        activeActionSource: record.activeActionSource ?? null,
        activeActionClip: record.activeActionClip ?? null,
        presentationAction: record.presentationAction ?? null,
        hasMixer: Boolean(record.mixer),
        actionCount: Object.keys(record.actions ?? {}).length,
        appearanceSlots: record.appearanceRoots ? [...record.appearanceRoots.keys()] : [],
        appearance: record.appearanceRoots
          ? [...record.appearanceRoots.entries()]
            .filter(([, root]) => root.userData.appearanceLoaded === true)
            .map(([slot, root]) => ({ slot, id: root.userData.appearanceItemId ?? null }))
            .sort((left, right) => left.slot.localeCompare(right.slot))
          : [],
      };
    };
    const describeStageDecor = (record) => ({
      id: record.id,
      kind: record.kind,
      role: record.role ?? null,
      actorId: record.actorId ?? null,
      questId: record.questId ?? null,
      questRole: record.questRole ?? null,
      modelPath: record.modelPath,
      sourceModelPath: record.sourceModelPath ?? null,
      modelNode: record.modelNode ?? null,
      source: record.placement ?? null,
      effectId: record.effectId ?? null,
      clip: record.activeActionClip ?? null,
      quality: record.quality ?? null,
      meshIntegrity: record.root?.userData?.meshIntegrity ?? null,
      groundedMinY: record.root?.userData?.groundedMinY ?? null,
      position: record.root
        ? { x: record.root.position.x, y: record.root.position.y, z: record.root.position.z }
        : null,
      yaw: record.root?.rotation.y ?? null,
      hasMixer: Boolean(record.mixer),
      actionCount: Object.keys(record.actions ?? {}).length,
      activeActionKey: record.activeActionKey ?? null,
      ambientState: record.ambientState ?? null,
    });
    if (id !== null) {
      const record = this.actors.get(id);
      return record ? describe(id, record) : null;
    }
    const projectiles = [];
    const pickups = [];
    const actors = [];
    for (const [entityId, record] of this.actors) {
      const state = describe(entityId, record);
      if (record.kind === "projectile") projectiles.push(state);
      else if (record.kind === "pickup") pickups.push(state);
      else if (["commander", "enemy", "boss", "companion"].includes(record.kind)) actors.push(state);
    }
    const stageDecorRecords = this.stageDecorRecords.map(describeStageDecor);
    const stageDecor = {
      stageId: this.loadedStageId ?? this.loadingStageId ?? this.stageTerrainFailedId,
      loading: this.loadingStageId !== null,
      terrainLoaded: Boolean(this.stageTerrainRecord),
      terrainSource: this.stageTerrainRecord?.sourceKind ?? null,
      terrainModelPath: this.stageTerrainRecord?.modelPath ?? null,
      terrainSourceCandidatePath: this.stageTerrainRecord?.sourceCandidatePath ?? null,
      terrainFallbackReason: this.stageTerrainRecord?.fallbackReason ?? this.stageTerrainError,
      terrainIntegrity: this.stageTerrainRecord?.meshIntegrity ?? null,
      propCount: stageDecorRecords.filter((record) => record.kind === "prop").length,
      npcCount: stageDecorRecords.filter((record) => record.kind === "stage-npc").length,
      vfxCount: stageDecorRecords.filter((record) => record.kind === "stage-vfx").length,
      mixerCount: stageDecorRecords.reduce((count, record) => count + (record.hasMixer ? 1 : 0), 0),
      actionCount: stageDecorRecords.reduce((count, record) => count + record.actionCount, 0),
      records: stageDecorRecords,
    };
    return {
      reducedMotion: this.reducedMotion,
      actorCount: actors.length,
      projectileCount: projectiles.length,
      pickupCount: pickups.length,
      activeVfxCount: this.vfxInstances.length,
      mixerCount: actors.reduce((count, actor) => count + (actor.hasMixer ? 1 : 0), 0),
      actionCount: actors.reduce((count, actor) => count + actor.actionCount, 0),
      stageDecor,
      projectiles,
      pickups,
      actors,
    };
  }

  debugMetrics() {
    if (!this.renderer) return { geometries: 0, textures: 0, programs: 0 };
    const info = this.renderer.info;
    return {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    };
  }
}
