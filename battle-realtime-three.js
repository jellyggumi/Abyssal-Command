// Snapshot-only presentation adapter for the defense session, backed by a
// real Three.js/WebGL scene graph. It deliberately owns neither time nor
// game input; the session supplies snapshots via renderSnapshot() and this
// module never drives its own animation loop or wires up DOM listeners of
// its own, and never imports campaign state -- verified by
// tests/defense-renderer-contract.test.mjs's "no loop/input/campaign/outcome
// ownership" check.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { OBJLoader } from "./vendor/loaders/OBJLoader.js";
import * as SkeletonUtils from "./vendor/utils/SkeletonUtils.js";
import { REWARDS, STAGE_PRESENTATION_BY_ID, STAGES } from "./defense-catalog.js";
import { stageWorldFor } from "./stage-world-catalog.js";

const MAX_VISUAL_EFFECTS = 24;
const SIM_TICK_RATE = 60;
const MAX_ANIMATION_TICK_DELTA = 6;
const MAX_VISUAL_EVENT_KEYS = 128;
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
// Chosen to preserve the same relative size relationships the Canvas2D
// fallback encodes via pixel radius (presentationRadius() in app.js: boss
// far > commander/enemy > companion > pickup/projectile).
const TARGET_HEIGHT = Object.freeze({
  commander: 2.9,
  boss: 4.5,
  elite: 2.2,
  enemy: 1.7,
  companion: 1.3,
  stageNpc: 1.8,
});
// Imported ambient rigs use a local-X arm swing. Keep their idle silhouette guarded
// after the mixer writes its authored horizontal pose each frame.
const STAGE_NPC_GUARD_OFFSETS = Object.freeze({
  left: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(50)),
  right: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-100)),
});

// Free-orbit camera bounds (camera-orbit-implementation-plan-20260725.md
// §3.3, decision-log.md D22 judgment 6): pitch is a fixed angular clamp,
// while the orbit distance clamp (MIN/MAX_ORBIT_DISTANCE) is derived
// analytically from these already-deterministic scene constants (never
// measured from a live GLB bounding box -- fitFootprint()/fitHeight()
// already normalize every terrain/actor to a fixed size on load, so the
// "true" bound is knowable before any model finishes loading). Distance
// constants are populated once mount() creates `this.camera` (their
// formula reads camera.fov live rather than duplicating the literal 42).
const MIN_ORBIT_PITCH = THREE.MathUtils.degToRad(30);
const MAX_ORBIT_PITCH = THREE.MathUtils.degToRad(85);
// Worst-case exposed terrain radius at any yaw: camera looking at a
// footprint corner (not an edge midpoint) of the square TERRAIN_TARGET_
// HALF_EXTENT diorama.
const TERRAIN_CORNER_RADIUS = TERRAIN_TARGET_HALF_EXTENT * Math.SQRT2;
// Largest actor silhouette (boss) that must never clip the near plane at
// the steepest (most oblique) permitted pitch.
const BOSS_RADIUS = TARGET_HEIGHT.boss / 2;
// zoomFactor default: matches the legacy fixed offset's camera-to-target
// Euclidean distance (hypot(WORLD_SCALE*1.05, WORLD_SCALE*1.05)) so the
// first rendered frame starts at the same "how far away" feel as the
// pre-orbit camera -- only the viewing ANGLE changes to the new
// presentation-spec default (65° pitch vs the legacy 45° isometric).
const ORBIT_ZOOM_DEFAULT = Math.hypot(WORLD_SCALE * 1.05, WORLD_SCALE * 1.05);
// Pre-mount fallback bounds bracketing ORBIT_ZOOM_DEFAULT so zoom() has a
// valid clamp range before mount() computes the precise fov/GLB-derived
// values below. mount() always overwrites both before the first real
// zoom() call, so this changes no production behavior -- it only keeps a
// pre-mount zoom() (constructed-but-not-mounted, e.g. under test) from
// clamping against null (which coerces to 0 and corrupts zoomFactor).
let MIN_ORBIT_DISTANCE = ORBIT_ZOOM_DEFAULT * 0.5;
let MAX_ORBIT_DISTANCE = ORBIT_ZOOM_DEFAULT * 2;
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
  CRITICAL_HIT: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  BOSS_RALLY_WINDOW: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  GATE_BREACHED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  WARDENS_WARD_TRIGGERED: "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  ECHO_WARDEN_AWAKENING_TRIGGERED: "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  COMPANION_DOWNED: "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
});
const SKILL_VFX_MODELS = Object.freeze({
  "rift-bolt": "assets/motion/stage-vfx/cinder-span-ember-wake.glb",
  "soul-lance": "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
  "grave-pulse": "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  "void-aegis": "assets/motion/stage-vfx/abyss-chancel-mirror-static.glb",
  "shadow-step": "assets/motion/stage-vfx/echo-throne-fracture-echo.glb",
});

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
  CRITICAL_HIT: 18,
  BOSS_RALLY_WINDOW: 90,
  GATE_BREACHED: 36,
  WARDENS_WARD_TRIGGERED: 60,
  ECHO_WARDEN_AWAKENING_TRIGGERED: 120,
  COMPANION_DOWNED: 48,
});

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
// Neon blue for a normal connect, shadow-violet for a heavy/critical one, to
// match the Solo-Leveling system-window palette used by the DOM HUD.
const IMPACT_FLASH_COLOR = new THREE.Color(0x5de6ff);
const IMPACT_FLASH_HEAVY_COLOR = new THREE.Color(0xa06bff);
const IMPACT_FLASH_MS = 180;
const IMPACT_FLASH_HEAVY_MS = 320;
const IMPACT_FLASH_PEAK = 0.55;
const IMPACT_FLASH_HEAVY_PEAK = 1.1;
// Knockback is a render-space offset in world units along the attacker to
// target axis; updateActorFollow() pulls the root back to the authoritative
// position every frame, so these stay well under one actor width.
const IMPACT_KNOCKBACK_MS = 160;
const IMPACT_KNOCKBACK_HEAVY_MS = 260;
const IMPACT_KNOCKBACK_DISTANCE = 0.12;
const IMPACT_KNOCKBACK_HEAVY_DISTANCE = 0.26;
// Camera shake fires only on heavy hits and is bounded so the orbit framing
// stays readable; it is skipped entirely under prefers-reduced-motion.
const IMPACT_SHAKE_MS = 220;
const IMPACT_SHAKE_AMPLITUDE = 0.07;
const IMPACT_SHAKE_BOSS_AMPLITUDE = 0.13;
const IMPACT_SHAKE_FREQUENCY = 38;
// Each entry maps one public snapshot event to { attackerId, targetId, heavy }
// or null when that event did not actually land damage.
const IMPACT_FEEDBACK_SOURCES = Object.freeze({
  WEAPON_FIRED: (event) =>
    event?.critical === true ? { attackerId: event.entityId, targetId: event.targetId, heavy: true } : null,
  SKILL_RESOLVED_DAMAGE: (event) => ({
    attackerId: event?.sourceId,
    targetId: event?.targetId,
    heavy: event?.critical === true,
  }),
  CRITICAL_HIT: (event) => ({ attackerId: event?.entityId, targetId: event?.targetId, heavy: true }),
  ENEMY_ATTACK: (event) =>
    finite(event?.damage, 0) > 0 ? { attackerId: event.entityId, targetId: event.targetId, heavy: false } : null,
  PROJECTILE_IMPACT: (event) =>
    event?.hit === false
      ? null
      : { attackerId: event?.sourceId ?? event?.ownerId, targetId: event?.targetId, heavy: false },
  COMMANDER_DAMAGED: (event) => ({ attackerId: event?.sourceId ?? event?.entityId, targetId: "commander", heavy: false }),
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

// Near/far fog stays stage-specific so the three supplied terrain meshes read
// as distinct spaces while the near plane remains clear of tracked actors.
const STAGE_FOG_BASE = Object.freeze({ near: 1.8, far: 4.2 });
const STAGE_FOG_MULTIPLIERS = Object.freeze({
  "cinder-span": { near: 1.6, far: 3.6 },
  "abyss-chancel": { near: 1.5, far: 3.3 },
  "echo-throne": { near: 1.4, far: 3.0 },
});

// Resolves a stage id to concrete world-unit fog near/far. Exported as the
// single source of truth so world-presentation-contract.test.mjs can assert
// applyStagePalette() actually wrote these values (not a render-layer
// fabrication), the same oracle pattern the HUD tests use.
export function stageFogRange(stageId) {
  const m = STAGE_FOG_MULTIPLIERS[stageId] ?? STAGE_FOG_BASE;
  return { near: WORLD_SCALE * m.near, far: WORLD_SCALE * m.far };
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

// Orbit distance that frames a sphere of `radius` under `camera`'s live
// FOV with `margin` headroom -- same bounding-sphere-fit formula
// MeshThumbnailService already uses (battle-realtime-three.js:535), reused
// here for the free-orbit zoom clamp instead of a portrait-crop shot.
// Reads camera.fov live (fixed at construction, but this avoids a second
// hardcoded "42") rather than reading it once and caching -- see mount().
function orbitDistanceForRadius(camera, radius, margin) {
  return (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * margin;
}

function resolveStageId(snapshot) {
  return snapshot?.presentation?.stageId ?? (typeof snapshot?.stageId === "string" ? snapshot.stageId : null);
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
  return event?.eventId ?? `${event?.type ?? "?"}:${event?.tick ?? "?"}:${event?.entityId ?? event?.targetId ?? event?.enemyId ?? ""}`;
}

function effectAnchor(snapshot, event) {
  const targetId = event?.targetId ?? event?.entityId ?? event?.enemyId ?? "";
  if (targetId === "gate" || event?.type === "GATE_BREACHED") return snapshot?.gate ?? snapshot?.base;
  if (targetId === "commander") return snapshot?.commander ?? snapshot?.player;
  for (const entity of [...list(snapshot, "enemies", "hostiles"), ...list(snapshot, "companions", "allies")]) {
    if (entity?.id === targetId) return entity;
  }
  return snapshot?.commander ?? snapshot?.player ?? snapshot?.gate ?? snapshot?.base;
}

function snapshotEntityById(snapshot, entityId) {
  if (!entityId) return null;
  const commander = snapshot?.commander ?? snapshot?.player;
  if (commander?.id === entityId) return commander;
  const gate = snapshot?.gate ?? snapshot?.base;
  if (gate?.id === entityId || entityId === "gate") return gate;
  for (const entity of list(snapshot, "enemies", "hostiles")) {
    if (entity?.id === entityId) return entity;
  }
  for (const entity of list(snapshot, "companions", "allies")) {
    if (entity?.id === entityId) return entity;
  }
  return null;
}

// Shared loaders and promise caches preserve immutable source data while each
// mounted scene owns its cloned renderables. Terrain may be a supplied OBJ;
// actor, prop, and VFX assets remain GLB.
const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const gltfCache = new Map();
const objCache = new Map();
const CINDER_TERRAIN_TEXTURE_ROOT = "assets/mesh/terrain/terrain-cinder-span/terrain-cinder-span-object/object/textureBasicPack";
let cinderTerrainMapsPromise = null;
// Last terrain decomposition, for the runtime proof that the split is lossless. Read by
// tests/stage-runtime-proof-browser.test.mjs through the export below rather than by scraping
// the scene graph, so the assertion sees the same numbers the offline splitter reports.
let lastTerrainSplitStats = null;

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

function loadObj(path) {
  const url = modelUrl(path);
  if (!url) return Promise.reject(new TypeError("Missing OBJ model path"));
  if (!objCache.has(url)) {
    const request = new Promise((resolve, reject) => {
      objLoader.load(url, resolve, undefined, reject);
    }).catch((error) => {
      if (objCache.get(url) === request) objCache.delete(url);
      throw error;
    });
    objCache.set(url, request);
  }
  return objCache.get(url);
}

function loadTexture(path) {
  const url = modelUrl(path);
  if (!url) return Promise.reject(new TypeError("Missing terrain texture path"));
  const loader = new THREE.TextureLoader();
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function cinderTerrainMaps() {
  if (!cinderTerrainMapsPromise) {
    cinderTerrainMapsPromise = Promise.all([
      loadTexture(`${CINDER_TERRAIN_TEXTURE_ROOT}/texture_diffuse.png`),
      loadTexture(`${CINDER_TERRAIN_TEXTURE_ROOT}/texture_normal.png`),
      loadTexture(`${CINDER_TERRAIN_TEXTURE_ROOT}/texture_roughness.png`),
      loadTexture(`${CINDER_TERRAIN_TEXTURE_ROOT}/texture_metallic.png`),
    ]).then(([map, normalMap, roughnessMap, metalnessMap]) => {
      map.colorSpace = THREE.SRGBColorSpace;
      return { map, normalMap, roughnessMap, metalnessMap };
    }).catch((error) => {
      console.warn("Cinder Span terrain textures unavailable; using neutral PBR material.", error);
      cinderTerrainMapsPromise = null;
      return null;
    });
  }
  return cinderTerrainMapsPromise;
}

async function applyObjTerrainMaterials(instance) {
  const maps = await cinderTerrainMaps();
  // ONE material shared across every mesh in the instance, not one per mesh. The instance is
  // now a group of independently-placed parts (see splitObjIntoPlaceableParts), so per-mesh
  // materials would mint ~89 identical MeshStandardMaterials and defeat batching. Sharing is
  // safe with ownRenderableResources(), which dedupes by identity when it clones for ownership.
  const material = new THREE.MeshStandardMaterial({
    map: maps?.map ?? null,
    normalMap: maps?.normalMap ?? null,
    roughnessMap: maps?.roughnessMap ?? null,
    metalnessMap: maps?.metalnessMap ?? null,
    roughness: 1,
    metalness: 0,
  });
  instance.traverse((node) => {
    if (node.isMesh) node.material = material;
  });
}

// Below this TRIANGLE count a component is scenery grit, not a placeable piece. Note the unit:
// this runs after OBJLoader triangulates, so it counts triangles, while the offline splitter's
// --min-faces counts authored faces (the source is 19630 quads + 130 tris). The same numeric 20
// is therefore a different bar in each, and the runtime keeps some pieces the offline pass bins
// as debris. Nothing is discarded either way -- sub-threshold components are merged into one
// debris mesh rather than dropped.
const TERRAIN_PART_MIN_FACES = 20;
// Position quantum for welding coincident corners. OBJLoader expands faces to a non-indexed
// buffer, so the shared corner between two adjacent triangles arrives as two distinct vertices
// with bit-identical coordinates; without welding, every triangle would read as its own island.
const TERRAIN_WELD_QUANTUM = 1e-4;

/**
 * Splits a loaded OBJ into its connected components so each becomes an independently
 * transformable, independently frustum-culled child.
 *
 * Why this exists: the shipped Cinder Span terrain is one welded mesh placed as ONE object, so
 * no piece can be moved, hidden, LOD-swapped, or culled on its own, and the whole span renders
 * whenever any corner of it is on screen.
 *
 * Why at runtime rather than as separate files on disk: the split is derivable from bytes
 * already fetched. Shipping the parts separately would cost ~88 extra HTTP requests on a
 * mobile-first game and ~267 service-worker/manifest/allowlist entries, to reach the same scene
 * graph this produces from one fetch and zero new assets.
 *
 * `scripts/split-terrain-obj-parts.py` is NOT a check on this function, and the two are not
 * expected to agree on component count. It unions faces by shared authored vertex INDEX; this
 * unions by quantized POSITION. Position adjacency is strictly coarser -- two faces authored
 * with duplicate `v` entries at the same coordinate are two components offline and one here --
 * so runtime components are always <= offline components by construction (measured: 108 vs 160).
 * Position is the better rule for "placeable piece", since a duplicate-vertex authoring artifact
 * should not split one bridge rib into two objects. The only invariant that holds across both
 * rules is face conservation, which is what `partFaces === faces` asserts; component count is
 * rule-dependent and must never be asserted against the offline figure.
 *
 * Geometry is rebased so each part's vertices are relative to its own centroid, with the
 * centroid restored as the part's position. The assembled render is therefore identical to the
 * merged original, while each part gains a meaningful transform origin and a tight bounding
 * sphere. Face count is conserved exactly -- this is a regrouping, not a simplification.
 */
export function splitObjIntoPlaceableParts(root) {
  const stats = { sourceMeshes: 0, faces: 0, components: 0, parts: 0, partFaces: 0, debrisFaces: 0 };
  const sources = [];
  root.traverse((node) => {
    if (node.isMesh && node.geometry?.attributes?.position) sources.push(node);
  });
  if (!sources.length) return { root, stats };

  for (const mesh of sources) {
    stats.sourceMeshes += 1;
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const position = geometry.attributes.position;
    const faceCount = Math.floor(position.count / 3);
    stats.faces += faceCount;

    // Weld coincident corners: quantized position -> canonical vertex id.
    const canonical = new Map();
    const vertexId = new Int32Array(position.count);
    for (let v = 0; v < position.count; v += 1) {
      const key = `${Math.round(position.getX(v) / TERRAIN_WELD_QUANTUM)},`
        + `${Math.round(position.getY(v) / TERRAIN_WELD_QUANTUM)},`
        + `${Math.round(position.getZ(v) / TERRAIN_WELD_QUANTUM)}`;
      let id = canonical.get(key);
      if (id === undefined) {
        id = canonical.size;
        canonical.set(key, id);
      }
      vertexId[v] = id;
    }

    // Union-find over welded vertices; faces sharing any corner join one component.
    const parent = new Int32Array(canonical.size);
    for (let i = 0; i < parent.length; i += 1) parent[i] = i;
    const find = (x) => {
      let r = x;
      while (parent[r] !== r) r = parent[r];
      while (parent[x] !== r) { const next = parent[x]; parent[x] = r; x = next; }
      return r;
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };
    for (let f = 0; f < faceCount; f += 1) {
      const a = vertexId[f * 3];
      union(a, vertexId[f * 3 + 1]);
      union(a, vertexId[f * 3 + 2]);
    }

    const byComponent = new Map();
    for (let f = 0; f < faceCount; f += 1) {
      const key = find(vertexId[f * 3]);
      let faces = byComponent.get(key);
      if (!faces) byComponent.set(key, faces = []);
      faces.push(f);
    }
    stats.components += byComponent.size;

    // Substantial components become their own part; the remainder pools into one debris mesh.
    const groups = [];
    const debris = [];
    for (const faces of byComponent.values()) {
      if (faces.length >= TERRAIN_PART_MIN_FACES) groups.push(faces);
      else debris.push(...faces);
    }
    groups.sort((a, b) => b.length - a.length);
    if (debris.length) {
      stats.debrisFaces += debris.length;
      groups.push(debris);
    }

    const container = new THREE.Group();
    container.name = `${mesh.name || "terrain"}_parts`;
    groups.forEach((faces, index) => {
      const part = buildTerrainPartMesh(geometry, faces, mesh, index, faces === debris);
      // Cheap smoke stat only. `partFaces === faces` is a TAUTOLOGY -- every face index lands in
      // exactly one bucket and every bucket becomes a group, both read from the same in-memory
      // arrays -- so it can never fail and must not be treated as the correctness check. It also
      // never observes buildTerrainPartMesh: that buffer is allocated at faces.length*3, so a
      // botched copy writes zeros into untouched slots rather than changing any count. The check
      // with teeth is spatial: the union of part world bboxes against the pre-split root bbox,
      // which catches wrong vertices, dropped corners, and centroid-rebase sign errors.
      stats.partFaces += faces.length;
      container.add(part);
    });
    stats.parts += groups.length;

    mesh.parent?.add(container);
    container.position.copy(mesh.position);
    container.quaternion.copy(mesh.quaternion);
    container.scale.copy(mesh.scale);
    mesh.parent?.remove(mesh);
    if (geometry !== mesh.geometry) mesh.geometry.dispose();
  }
  return { root, stats };
}

/** Extracts `faces` from `geometry` into a standalone mesh rebased on its own centroid. */
function buildTerrainPartMesh(geometry, faces, sourceMesh, index, isDebris) {
  const source = geometry.attributes;
  const vertexCount = faces.length * 3;
  const positions = new Float32Array(vertexCount * 3);
  const normals = source.normal ? new Float32Array(vertexCount * 3) : null;
  const uvs = source.uv ? new Float32Array(vertexCount * 2) : null;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < faces.length; i += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const src = faces[i] * 3 + corner;
      const dst = i * 3 + corner;
      const x = source.position.getX(src);
      const y = source.position.getY(src);
      const z = source.position.getZ(src);
      positions[dst * 3] = x;
      positions[dst * 3 + 1] = y;
      positions[dst * 3 + 2] = z;
      cx += x; cy += y; cz += z;
      if (normals) {
        normals[dst * 3] = source.normal.getX(src);
        normals[dst * 3 + 1] = source.normal.getY(src);
        normals[dst * 3 + 2] = source.normal.getZ(src);
      }
      if (uvs) {
        uvs[dst * 2] = source.uv.getX(src);
        uvs[dst * 2 + 1] = source.uv.getY(src);
      }
    }
  }
  cx /= vertexCount; cy /= vertexCount; cz /= vertexCount;
  // Rebase onto the centroid, then restore it as the mesh position: same render, own origin.
  for (let v = 0; v < vertexCount; v += 1) {
    positions[v * 3] -= cx;
    positions[v * 3 + 1] -= cy;
    positions[v * 3 + 2] -= cz;
  }

  const partGeometry = new THREE.BufferGeometry();
  partGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (normals) partGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  else partGeometry.computeVertexNormals();
  if (uvs) partGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  partGeometry.computeBoundingSphere();

  const part = new THREE.Mesh(partGeometry, sourceMesh.material);
  part.name = isDebris ? "terrain_part_debris" : `terrain_part_${String(index).padStart(3, "0")}`;
  part.position.set(cx, cy, cz);
  part.castShadow = sourceMesh.castShadow;
  part.receiveShadow = sourceMesh.receiveShadow;
  part.userData.terrainPartFaces = faces.length;
  return part;
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
  const gltf = await loadGltf(relPath);
  return serializeInstantiation(() => {
    // SkeletonUtils.clone() (not gltf.scene.clone()) so a SkinnedMesh instance
    // gets bound to its own cloned skeleton.
    const instance = SkeletonUtils.clone(gltf.scene);
    fitHeight(instance, targetHeight);
    applyCelShading(instance);
    const baseEntries = (gltf.animations ?? []).map((clip) => ({ clip, source: "base" }));
    if (!baseEntries.length) return { instance, mixer: null, actions: {}, actionSources: {} };
    const mixer = new THREE.AnimationMixer(instance);
    const { actions, actionSources } = buildActions(mixer, baseEntries);
    return { instance, mixer, actions, actionSources };
  });
}

/**
 * Per-part terrain placement is OFF by default, and the reason is measured, not assumed.
 *
 * `splitObjIntoPlaceableParts()` works and is pixel-exact (bbox delta ~1e-9 across all three
 * axes), but three.js issues one draw call per Mesh -- only InstancedMesh/BatchedMesh batch, and
 * neither applies here: InstancedMesh needs repeated identical geometry, and the vendored build
 * has no BatchedMesh. A shared material saves shader and uniform rebinds, not draw calls.
 *
 * Measured on the Cinder Span terrain (39390 triangles after triangulation), 1280x800:
 *
 *   framing            merged            split (95 parts)
 *   whole span         1 call, 0.007ms   95 calls, 0.180ms   (25x)
 *   game-like camera   1 call, 0.005ms   33 calls, 0.087ms   (17x)
 *
 * Frustum culling does work -- the game-like framing submits 16043 of 39390 triangles, 59%
 * culled -- but at this asset's scale the triangles it saves are worth less than the draw calls
 * it adds. 39k triangles is small; the CPU-side per-call cost dominates.
 *
 * So the split stays available and unused until a consumer actually needs per-piece transforms
 * (moving a collapsing rib, hiding a section, per-part LOD). Turning it on today would buy an
 * identical picture for 17x the frame time, which is the same mobile-first cost that made
 * shipping 89 separate .obj files the wrong answer -- re-entering through a different door.
 * Callers opt in explicitly; when a real consumer arrives, re-measure with its framing.
 */
const TERRAIN_SPLIT_PARTS_DEFAULT = false;

async function instantiateTerrainModel(relPath, { splitParts = TERRAIN_SPLIT_PARTS_DEFAULT } = {}) {
  const isObj = relPath.endsWith(".obj");
  const source = isObj ? await loadObj(relPath) : (await loadGltf(relPath)).scene;
  const instance = isObj ? source.clone(true) : SkeletonUtils.clone(source);
  if (isObj) {
    if (splitParts) {
      // Split before materials and before fitFootprint: the split must see the raw merged mesh,
      // and fitFootprint() reads a Box3 of the whole subtree, so it scales the assembled parts
      // as one unit exactly as it did the single mesh. Order matters -- splitting after the fit
      // would rebase each part's geometry against an already-scaled parent.
      lastTerrainSplitStats = splitObjIntoPlaceableParts(instance).stats;
    }
    await applyObjTerrainMaterials(instance);
  }
  ownRenderableResources(instance);
  fitFootprint(instance, TERRAIN_TARGET_HALF_EXTENT);
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

async function instantiateStageProp(prop) {
  const gltf = await loadGltf(prop.modelPath);
  const source = prop.modelNode ? gltf.scene.getObjectByName(prop.modelNode) : gltf.scene;
  if (!source) throw new Error(`Stage prop node not found: ${prop.modelPath}#${prop.modelNode}`);
  source.updateWorldMatrix(true, true);
  const instance = SkeletonUtils.clone(source);
  if (prop.modelNode) source.matrixWorld.decompose(instance.position, instance.quaternion, instance.scale);
  ownRenderableResources(instance);
  const radius = finite(prop.footprintRadius, 180) * WORLD_SCALE / (WORLD_WIDTH / 2);
  fitFootprint(instance, radius);
  const rescan = new THREE.Box3().setFromObject(instance);
  instance.position.y -= rescan.min.y;
  const groundOffset = instance.position.y;
  const point = worldPoint(prop.placement);
  instance.position.set(point.x, point.y + groundOffset, point.z);
  instance.rotation.y = finite(prop.placement?.yawRadians, 0);
  instance.name = `stage-prop:${prop.id}`;
  instance.userData.stageDecorId = prop.id;
  instance.userData.stageDecorKind = "prop";
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
  const { instance, mixer, actions, actionSources } = await instantiateActorModel(npc.modelPath, TARGET_HEIGHT.stageNpc);
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
    modelPath: npc.modelPath,
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
    dead: false,
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

async function instantiateVfxModel(relPath) {
  const gltf = await loadGltf(relPath);
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
 * Decomposition counts from the most recent OBJ terrain instantiation, or null if none has run.
 * Exists so the split is provable from outside: face conservation is the correctness property
 * (a regrouping must not lose or duplicate a triangle), and it cannot be observed by counting
 * scene-graph children.
 */
export function lastTerrainDecomposition() {
  return lastTerrainSplitStats ? { ...lastTerrainSplitStats } : null;
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
    this.stageDecorRecords = [];
    this.stageLoadToken = 0;
    this.cameraTarget = new THREE.Vector3();
    this.cameraFollowInit = false;
    this.pressureGatePoint = new THREE.Vector3();
    this.pressureEnemyPoint = new THREE.Vector3();
    this.pressureCandidatePoint = new THREE.Vector3();
    // Free-orbit camera state (D17/D21/D22, presentation-spec.md:18-25).
    // orbitYaw accumulates unrestricted (wrapped for float precision only,
    // never clamped -- see wrapAngle()). orbitPitch and zoomFactor are
    // clamped on every orbit()/zoom() call. Persisted across frames and
    // across auto-follow re-acquisition (updateCamera() Section 1 only
    // ever touches cameraTarget, never these three fields -- director
    // decision, D21 발견 2/D22 판정 5); dispose() resets these to their
    // mount-time defaults as a SESSION-boundary reset only, not a
    // per-drag-release reset.
    this.orbitYaw = 0;
    this.orbitPitch = THREE.MathUtils.degToRad(65);
    this.zoomFactor = ORBIT_ZOOM_DEFAULT;
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
    this.pendingVfx = [];
    this.pendingDeathEchoes = []; // captureDeathEchoes()-collected { modelPath, x, y, z }, drained by collectFeedback()
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
    // Orbit zoom clamp (camera-orbit-implementation-plan-20260725.md §3.3,
    // D22 판정 6): analytically derived from this.camera.fov (fixed at
    // construction, but read live here rather than hardcoding "42" a
    // second time) plus the already-deterministic TERRAIN_TARGET_HALF_
    // EXTENT/TARGET_HEIGHT.boss constants -- no async GLB measurement.
    MIN_ORBIT_DISTANCE = orbitDistanceForRadius(this.camera, BOSS_RADIUS, 1.2);
    MAX_ORBIT_DISTANCE = orbitDistanceForRadius(this.camera, TERRAIN_CORNER_RADIUS, 1.1);

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
    this.stageTerrainRecord = null;
    if (!this.terrainGroup) return;
    while (this.terrainGroup.children.length) {
      const child = this.terrainGroup.children[0];
      this.terrainGroup.remove(child);
      disposeObject3D(child);
    }
  }

  ensureStageTerrain(stageId) {
    if (!stageId || this.disposed) return;
    if (this.loadedStageId === stageId || this.loadingStageId === stageId) return;
    const profile = stageWorldFor(stageId);
    if (!profile?.terrainGlbPath) return;

    this.applyStagePalette(stageId);
    this.loadingStageId = stageId;
    this.loadedStageId = null;
    const loadToken = ++this.stageLoadToken;
    this.clearStageWorld();
    // Warm the stage boss's GLB while the player is still in the opening
    // cutscene. It is 4 MB of authored rig that otherwise starts downloading
    // only when the boss spawns mid-fight, which pops the boss in late on a
    // slow connection or a software renderer. loadGltf() caches by path, so
    // the spawn then costs a clone instead of a fetch plus parse.
    const bossModelPath = meshRootForStageBoss(stageId);
    if (bossModelPath) loadGltf(bossModelPath).catch(() => {});

    const terrainRequest = instantiateTerrainModel(profile.terrainGlbPath).then((root) => ({
      id: `${stageId}:terrain`,
      kind: "terrain",
      modelPath: profile.terrainGlbPath,
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
        this.loadingStageId = null;
      },
      () => {
        if (this.disposed || this.stageLoadToken !== loadToken) return;
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
  applyStagePalette(stageId) {
    if (this.disposed || this.stagePaletteId === stageId) return;
    this.stagePaletteId = stageId;
    const presentation = STAGE_PRESENTATION_BY_ID[stageId];
    const tint = presentation ? STAGE_PALETTE_TINTS[stageId] ?? null : null;
    if (tint === null) return; // unknown stage id -- keep the existing global defaults rather than blank the scene

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
      // Per-stage atmospheric depth (see STAGE_FOG_MULTIPLIERS). Overrides the
      // single global near/far mount() set so each stage's openness matches its
      // authored motif; pure render state, no snapshot/digest coupling.
      const fogRange = stageFogRange(stageId);
      this.scene.fog.near = fogRange.near;
      this.scene.fog.far = fogRange.far;
    }
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
    const record = {
      root: null, kind, modelPath, fallbackModelPath, loading: Boolean(modelPath),
      entityKind: entity.kind ?? null, role: entity.role ?? null, moveState: entity.move ?? null,
      mixer: null, actions: {}, actionSources: {}, activeActionKey: null, targetHeight: actorTargetHeight(entity),
      activeActionSource: null, activeActionClip: null,
      oneShotAction: null, oneShotActionKey: null,
      queuedAction: { key: "show", presentation: null },
      dead: false, hideAfterDeath: false,
      presentationToken: 0, presentationRoots: [], presentationMixers: [],
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
    const status = entity.status;
    const dead = status === "DOWNED" || status === "DEAD" || status === "DEFEATED"
      || (Number.isFinite(entity.hp) && entity.hp <= 0)
      || (Number.isFinite(entity.integrity) && entity.integrity <= 0);
    if (!dead || record.dead) return;
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
      let record = this.actors.get(pickup.id);
      if (!record) {
        const mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14, 0),
          new THREE.MeshStandardMaterial({ color: COLORS.pickup, emissive: COLORS.pickup, emissiveIntensity: 0.8 }),
        );
        record = { root: mesh, kind: "pickup", modelPath: null, loading: false };
        this.actors.set(pickup.id, record);
        this.actorGroup.add(mesh);
      }
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
    const desired = this.zoomFactor + delta;
    this.zoomFactor = THREE.MathUtils.clamp(desired, MIN_ORBIT_DISTANCE, MAX_ORBIT_DISTANCE);
    return Math.abs(desired - this.zoomFactor) > 1e-9;
  }
  // App-owned accessibility observers call this whenever the system
  // preference changes. The renderer keeps only its local presentation
  // policy; enabling reduced motion cancels rather than pauses an intro so
  // disabling it cannot resume a partially completed dolly.
  setReducedMotion(reducedMotion) {
    this.reducedMotion = reducedMotion === true;
    if (this.reducedMotion) this.stageIntro = null;
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
  // session run, even when the event keeps its deterministic id. Clear
  // animation keys before the confirming frame so its intro can replay, but
  // retain visual keys until that batch has filtered its existing VFX.
  resetPresentationEventDeduplicationForNewRun(startsStageAtTickZero) {
    if (!startsStageAtTickZero || !(this.lastAnimTick > 0)) return false;
    this.animationEventKeys.clear();
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
  }

  stageIntroOffsets(tick) {
    const intro = this.stageIntro;
    if (!intro || this.reducedMotion || !Number.isInteger(tick)) return null;
    const progress = THREE.MathUtils.clamp((tick - intro.startTick) / intro.durationTicks, 0, 1);
    if (progress >= 1) {
      this.stageIntro = null;
      return null;
    }
    return {
      distance: THREE.MathUtils.lerp(intro.from.distance, intro.to.distance, progress),
      azimuth: THREE.MathUtils.lerp(intro.from.azimuth, intro.to.azimuth, progress),
      polar: THREE.MathUtils.lerp(intro.from.polar, intro.to.polar, progress),
    };
  }

  updateCamera(snapshot) {
    // Auto-follow moves only the orbit center, including authoritative
    // terrain elevation. It never changes the viewing angle selected
    // through orbit()/zoom().
    const commander = snapshot?.commander ?? snapshot?.player;
    const commanderPoint = worldPoint(commander ?? {});
    const targetX = commanderPoint.x;
    const targetY = commanderPoint.y;
    const targetZ = commanderPoint.z;
    if (!this.cameraFollowInit) {
      this.cameraTarget.set(targetX, targetY, targetZ);
      this.cameraFollowInit = true;
    } else if (!this.reducedMotion) {
      this.cameraTarget.x += (targetX - this.cameraTarget.x) * 0.18;
      this.cameraTarget.y += (targetY - this.cameraTarget.y) * 0.18;
      this.cameraTarget.z += (targetZ - this.cameraTarget.z) * 0.18;
    } else {
      this.cameraTarget.set(targetX, targetY, targetZ);
    }

    // --- Section 2: orbit position -- cinematic offsets are calculated
    // locally, so player-selected orbit state remains the unmodified base.
    const intro = this.stageIntroOffsets(snapshot?.tick);
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
    const offsetX = horizontalRadius * Math.sin(cameraYaw);
    const offsetZ = horizontalRadius * Math.cos(cameraYaw);
    this.camera.position.set(
      this.cameraTarget.x + offsetX,
      this.cameraTarget.y + height,
      this.cameraTarget.z + offsetZ,
    );
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y + 0.6, this.cameraTarget.z);

    // --- Section 3: camera-relative rim light (stage-composition-
    // 20260725.md §1.2, D22 판정 9). A world-fixed rim light loses its
    // backlight/silhouette function once the camera can orbit freely --
    // it only reads as "rim" light when it's roughly opposite the camera
    // across the subject. Reuses Section 2's yaw/sin/cos convention,
    // offset by PI so it lands on the opposite azimuth from wherever the
    // camera currently is, independent of zoom distance (a directional
    // light's falloff is distance-independent, so its position only needs
    // to encode DIRECTION via rimLightTarget, not an accurately-scaled
    // distance).
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

  spawnVfx(snapshot, event, tick) {
    const relPath = event?.type === "SKILL_CAST"
      ? SKILL_VFX_MODELS[event?.vfx || event?.skillId]
      : VFX_MODELS[event?.type];
    if (!relPath) return;
    const anchor = effectAnchor(snapshot, event);
    if (!anchor) return;
    const lifetime = VFX_LIFETIME_TICKS[event.type] ?? 30;
    const untilTick = tick + lifetime;
    const placeholder = new THREE.Group();
    const p = worldPoint(anchor);
    placeholder.position.set(p.x, p.y + 0.6, p.z);
    this.vfxGroup.add(placeholder);
    const record = { root: placeholder, untilTick, loaded: false };
    this.vfxInstances.push(record);
    if (this.vfxInstances.length > MAX_VISUAL_EFFECTS) {
      const stale = this.vfxInstances.shift();
      this.vfxGroup.remove(stale.root);
      stale.mixer?.stopAllAction();
      disposeObject3D(stale.root);
    }
    instantiateVfxModel(relPath).then(({ instance, mixer, action }) => {
      if (!this.vfxInstances.includes(record)) {
        mixer?.stopAllAction();
        disposeObject3D(instance);
        return;
      }
      placeholder.add(instance);
      record.mixer = mixer;
      record.action = action;
      record.loaded = true;
      applyTransientVfxPolicy(record, this.reducedMotion);
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
    instantiateActorModel(echo.modelPath, echo.targetHeight)
      .then(({ instance, mixer, actions }) => {
        if (this.disposed) {
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
        const record = { root: instance, untilTick, mixer, action, loaded: true };
        this.vfxInstances.push(record);
        applyTransientVfxPolicy(record, this.reducedMotion);
      })
      .catch(() => {});
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

  registerImpactFeedback(event, nowMs) {
    const impact = IMPACT_FEEDBACK_SOURCES[event?.type]?.(event);
    if (!impact?.targetId) return;
    const targetRecord = this.actors.get(impact.targetId) ?? this.combatTarget(impact.targetId);
    if (!targetRecord?.root) return;
    const heavy = impact.heavy === true;
    this.hitFlashes.set(impact.targetId, {
      startMs: nowMs,
      untilMs: nowMs + (heavy ? IMPACT_FLASH_HEAVY_MS : IMPACT_FLASH_MS),
      color: heavy ? IMPACT_FLASH_HEAVY_COLOR : IMPACT_FLASH_COLOR,
      peak: heavy ? IMPACT_FLASH_HEAVY_PEAK : IMPACT_FLASH_PEAK,
      record: targetRecord,
    });
    if (this.reducedMotion) return;

    const attacker = impact.attackerId ? this.actors.get(impact.attackerId) : null;
    let dx = 0;
    let dz = 0;
    if (attacker?.root) {
      dx = targetRecord.root.position.x - attacker.root.position.x;
      dz = targetRecord.root.position.z - attacker.root.position.z;
    }
    const length = Math.hypot(dx, dz);
    if (length > 1e-4) {
      this.knockbacks.set(impact.targetId, {
        startMs: nowMs,
        untilMs: nowMs + (heavy ? IMPACT_KNOCKBACK_HEAVY_MS : IMPACT_KNOCKBACK_MS),
        dx: dx / length,
        dz: dz / length,
        distance: heavy ? IMPACT_KNOCKBACK_HEAVY_DISTANCE : IMPACT_KNOCKBACK_DISTANCE,
      });
    }
    if (!heavy) return;
    this.impactShakeSeed = (this.impactShakeSeed + 1) % 1024;
    this.cameraShake = {
      startMs: nowMs,
      untilMs: nowMs + IMPACT_SHAKE_MS,
      amplitude: targetRecord.kind === "boss" ? IMPACT_SHAKE_BOSS_AMPLITUDE : IMPACT_SHAKE_AMPLITUDE,
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
      const progress = (nowMs - flash.startMs) / span;
      const done = progress >= 1;
      const strength = done ? 0 : flash.peak * (1 - progress) * (1 - progress);
      root.traverse((node) => {
        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
        for (const material of materials) {
          if (!material?.emissive) continue;
          if (!material.userData.impactBaseEmissive) {
            material.userData.impactBaseEmissive = material.emissive.clone();
            material.userData.impactBaseEmissiveIntensity = finite(material.emissiveIntensity, 1);
          }
          const base = material.userData.impactBaseEmissive;
          if (done) {
            material.emissive.copy(base);
            material.emissiveIntensity = material.userData.impactBaseEmissiveIntensity;
            continue;
          }
          material.emissive.copy(base).lerp(flash.color, Math.min(1, strength));
          material.emissiveIntensity = material.userData.impactBaseEmissiveIntensity + strength;
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
      const progress = (nowMs - knockback.startMs) / span;
      if (progress >= 1) {
        this.knockbacks.delete(entityId);
        continue;
      }
      const eased = Math.sin(Math.PI * (1 - progress)) * (1 - progress);
      record.root.position.x += knockback.dx * knockback.distance * eased;
      record.root.position.z += knockback.dz * knockback.distance * eased;
    }
  }

  // Decaying positional jitter applied after updateCamera() has committed the
  // orbit position, so the orbit state itself (yaw/pitch/zoom) is never
  // perturbed and the shake fully cancels when it expires.
  applyCameraShake(nowMs) {
    const shake = this.cameraShake;
    if (!shake || !this.camera) return;
    const span = Math.max(1, shake.untilMs - shake.startMs);
    const progress = (nowMs - shake.startMs) / span;
    if (progress >= 1) {
      this.cameraShake = null;
      return;
    }
    const decay = (1 - progress) * (1 - progress);
    const phase = shake.seed * 1.7 + progress * IMPACT_SHAKE_FREQUENCY;
    this.camera.position.x += Math.sin(phase) * shake.amplitude * decay;
    this.camera.position.y += Math.sin(phase * 1.37 + 1.1) * shake.amplitude * decay * 0.6;
    this.camera.position.z += Math.cos(phase * 0.91 + 0.4) * shake.amplitude * decay;
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
    this.registerImpactFeedback(event, nowMs);
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
    for (const record of this.vfxInstances) {
      if (record.untilTick <= tick) {
        this.vfxGroup.remove(record.root);
        record.mixer?.stopAllAction();
        disposeObject3D(record.root);
      }
    }
    this.vfxInstances = this.vfxInstances.filter((record) => record.untilTick > tick);

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
    const currentSize = this.renderer.getSize(new THREE.Vector2());
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
    this.ensureStageTerrain(resolveStageId(snapshot));
    this.captureDeathEchoes(snapshot);
    this.reconcileActors(snapshot);
    this.collectFeedback(snapshot);
    if (resetVisualEventDeduplication) this.visualEventKeys.clear();
    this.updateCamera(snapshot);
    this.updateAnimations(performance.now(), snapshot?.tick, startsStageAtTickZero);
    // Impact feel runs last: the flash/knockback/shake it applies must land on
    // top of the camera and actor placement committed above.
    this.updateImpactFeedback(performance.now());

    this.renderer.render(this.scene, this.camera);
  }

  onVisualFeedback(inputSeq) {
    this.lastFeedback = inputSeq;
    this.pendingInputFeedback = inputSeq;
  }

  dispose() {
    this.stageLoadToken += 1;
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
    // Session-boundary reset only (camera-orbit-implementation-plan-
    // 20260725.md §2): a fresh mount() should start at the documented
    // defaults, matching the "디폴트: yaw=0, pitch=65°, zoom=1.0" (this
    // repo's zoomFactor is a world-unit distance, not a 0..1 ratio -- see
    // ORBIT_ZOOM_DEFAULT) requirement. This is NOT the drag-release/auto-
    // follow-reacquisition reset the director explicitly rejected (D21
    // 발견 2 / D22 판정 5) -- those never touch these three fields at all,
    // by construction (updateCamera() Section 1 only writes cameraTarget).
    this.orbitYaw = 0;
    this.orbitPitch = THREE.MathUtils.degToRad(65);
    this.zoomFactor = ORBIT_ZOOM_DEFAULT;
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
        hasMixer: Boolean(record.mixer),
        actionCount: Object.keys(record.actions ?? {}).length,
      };
    };
    const describeStageDecor = (record) => ({
      id: record.id,
      kind: record.kind,
      role: record.role ?? null,
      actorId: record.actorId ?? null,
      modelPath: record.modelPath,
      modelNode: record.modelNode ?? null,
      source: record.placement ?? null,
      effectId: record.effectId ?? null,
      clip: record.activeActionClip ?? null,
      quality: record.quality ?? null,
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
    const actors = [];
    for (const [entityId, record] of this.actors) {
      const state = describe(entityId, record);
      if (record.kind === "projectile") projectiles.push(state);
      else if (["commander", "enemy", "boss", "companion"].includes(record.kind)) actors.push(state);
    }
    const stageDecorRecords = this.stageDecorRecords.map(describeStageDecor);
    const stageDecor = {
      stageId: this.loadedStageId ?? this.loadingStageId,
      loading: this.loadingStageId !== null,
      terrainLoaded: Boolean(this.stageTerrainRecord),
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
      mixerCount: actors.reduce((count, actor) => count + (actor.hasMixer ? 1 : 0), 0),
      actionCount: actors.reduce((count, actor) => count + actor.actionCount, 0),
      stageDecor,
      projectiles,
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
