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

const MAX_VISUAL_EFFECTS = 24;
const MAX_VISUAL_EVENT_KEYS = 128;

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

// Generator pipeline (scripts/export-battle-glb.py) currently writes every
// object flat into assets/images/battle/glb/ (co-located with this cycle's
// PNG thumbnail previews). The prior assets/models/battle/ category-
// subdirectory tree was intentionally removed from this worktree -- build
// against the current pipeline output, not the retired one.
const MODEL_ROOT = "./assets/images/battle/glb/";

// Stage id -> terrain GLB. Stages 1-3 use the canonical resource pack's
// existing terrain sets (echo-throne-steps is the walkable terrain; the
// echo-throne collection itself is a standalone decorative throne prop,
// not used as a stage terrain root). Stages 4-10 use this cycle's new
// world-content-pack terrain.
const TERRAIN_MODELS = Object.freeze({
  "cinder-span": "terrain/cinder-span.glb",
  "veil-citadel": "terrain/veil-citadel.glb",
  "echo-throne": "terrain/echo-throne-steps.glb",
  "sunken-bastion": "terrain/sunken-bastion.glb",
  "howling-sprawl": "terrain/howling-sprawl.glb",
  "glass-necropolis": "terrain/glass-necropolis.glb",
  "starless-canal": "terrain/starless-canal.glb",
  "shattered-causeway": "terrain/shattered-causeway.glb",
  "abyss-chancel": "terrain/abyss-chancel.glb",
  "gate-zenith": "terrain/gate-zenith.glb",
});

// Boss actor's own `bossId` field (set verbatim from BOSSES[stage.boss].id
// in spawnBoss(), defense-run-simulation.js) is the exact key -- no need to
// cross-reference STAGES here.
const BOSS_MODELS = Object.freeze({
  "s1-cinder-warden": "bosses/cinder-warden.glb",
  "s2-veil-tactician": "bosses/veil-tactician.glb",
  "s3-gate-sovereign": "bosses/gate-sovereign.glb",
  "s4-tide-warden": "bosses/tide-warden.glb",
  "s5-pack-herald": "bosses/pack-herald.glb",
  "s6-requiem-choir": "bosses/requiem-choir.glb",
  "s7-lantern-tyrant": "bosses/lantern-tyrant.glb",
  "s8-bridge-colossus": "bosses/bridge-colossus.glb",
  "s9-veiled-concordat": "bosses/veiled-concordat.glb",
  "s10-abyss-regent": "bosses/abyss-regent.glb",
});

// Regular (non-boss) enemy actor's `kind` field is one of these 4
// archetypes (ENEMIES catalog in defense-catalog.js), reusing the canonical
// resource pack's 4 enemy models -- verified present, never had dedicated
// per-archetype art before this session.
const ENEMY_MODELS = Object.freeze({
  rusher: "enemies/scout.glb",
  flanker: "enemies/shade.glb",
  guardian: "enemies/guard.glb",
  ranged: "enemies/possessed.glb",
});

// Companion actor's `companionId` field selects its model.
const COMPANION_MODELS = Object.freeze({
  "ember-cohort": "companions/ember-cohort.glb",
  "rift-lens": "companions/rift-lens.glb",
  "veil-vanguard": "companions/veil-vanguard.glb",
  "anchor-shard": "companions/anchor-shard.glb",
  "throne-echo": "companions/throne-echo.glb",
  "dawnless-crown": "companions/dawnless-crown.glb",
  "pack-warden": "companions/pack-warden.glb",
  "lantern-reaver": "companions/lantern-reaver.glb",
  "requiem-warden": "companions/requiem-warden.glb",
});

const COMMANDER_MODEL = "commander/dusk-warden.glb";

// Public companion/boss/commander model-path lookups, for UI code (app.js
// portrait cards) that has a prototype/stage id but no live simulation
// "entity" object. Reuses the SAME maps the battle renderer itself
// consumes, so results are always consistent with what would actually be
// drawn in battle for that id.
export function meshRootForCompanion(companionId) {
  return COMPANION_MODELS[companionId] ?? null;
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

// Event type -> one-shot VFX GLB + lifetime (ticks @ 60Hz). These 5 RPG-
// layer telemetry events (defense-run-simulation.js) had zero visual
// representation anywhere in the runtime before this session; wired here
// against the exact event-type strings verified against the emit() call
// sites (grepped this session, not assumed).
const VFX_MODELS = Object.freeze({
  CRITICAL_HIT: "vfx/critical-hit-burst.glb",
  BOSS_RALLY_WINDOW: "vfx/boss-rally-aura.glb",
  GATE_BREACHED: "vfx/gate-breach-shockwave.glb",
  WARDENS_WARD_TRIGGERED: "vfx/wardens-ward-shield.glb",
  ECHO_WARDEN_AWAKENING_TRIGGERED: "vfx/echo-warden-awakening.glb",
  COMPANION_DOWNED: "vfx/companion-downed-fade.glb",
});

// REWARDS catalog entry id -> its 3D prop model, for reward cards (app.js
// portrait wiring). Built by scripts/build-world-content-pack.py alongside
// the character/terrain collections (same canon material palette) but
// exported separately this session -- these 5 "kind":"modifier" REWARDS ids
// (verified against defense-catalog.js REWARDS, not assumed) are the only
// ones with an authored 3D prop; "*-legacy" reward kinds instead reuse
// their companionId's existing character portrait (see meshRootForReward()
// below), and "*-archive"/"*-record" kinds have no prop and keep their
// existing text/glyph card.
const PROP_MODELS = Object.freeze({
  "stillwater-hourglass": "props/stillwater-hourglass.glb",
  "bulwark-brand": "props/bulwark-brand.glb",
  "abyssal-banner": "props/abyssal-banner.glb",
  "warden-lantern": "props/warden-lantern.glb",
  "choir-ward-crystal": "props/choir-ward-crystal.glb",
});

// rpg-catalog.js EQUIPMENT_TIERS[].id -> its 3D tier-gem model, one file per
// tier (T3 merges the top+bottom cone halves the source collection authors
// as two separate objects). Growth-panel equipment slots (app.js
// renderEquipmentSlots) currently encode tier via the CSS .tier-icon
// clip-path polygon (vertexCount 0/3/4/5/6) -- these give the same 5 tiers
// an alternate 3D-rendered portrait for surfaces that want a mesh instead
// of a flat CSS shape (e.g. an equipment-purchase card), without replacing
// the existing accessible shape+text encoding.
const EQUIPMENT_TIER_MODELS = Object.freeze({
  T1: "props/tiers/tier-t1.glb",
  T2: "props/tiers/tier-t2.glb",
  T3: "props/tiers/tier-t3.glb",
  T4: "props/tiers/tier-t4.glb",
  T5: "props/tiers/tier-t5.glb",
});
const VFX_LIFETIME_TICKS = Object.freeze({
  CRITICAL_HIT: 18,
  BOSS_RALLY_WINDOW: 90,
  GATE_BREACHED: 36,
  WARDENS_WARD_TRIGGERED: 60,
  ECHO_WARDEN_AWAKENING_TRIGGERED: 120,
  COMPANION_DOWNED: 48,
});

// Rigged character GLBs (scripts/rig-character-asset-blender.py) embed an
// 11-clip action library per asset, named "<assetId>::<action>::v01" in the
// glTF `animations` array -- idle/move/run/hit/bighit/attack/critical/
// avoid/defence/die/show (design/previs-rigging-guide.md). Every character
// model in BOSS_MODELS / ENEMY_MODELS / COMPANION_MODELS / COMMANDER_MODEL
// carries the full set; VFX and terrain GLBs carry none. RIG_ACTION_KEYS lets
// loadActions() detect which clips (if any) a given loaded model actually has,
// so unrigged models simply skip animation without special-casing.
const RIG_ACTION_KEYS = Object.freeze([
  "idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show",
]);
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
// Verified event field shapes (defense-run-simulation.js emit() call
// sites), not inferred: WEAPON_FIRED.entityId is the shooter (commander or
// companion) on every ranged auto-attack; ENEMY_ATTACK.entityId is the
// attacking enemy/boss and .targetId is whoever it hit (commander id,
// companion entity id, or "gate" -- gate has no actor mesh so a lookup miss
// is a silent no-op, not a bug). One shared rule set drives both sides of
// every attack without special-casing attacker kind.
const ATTACKER_EVENT_ACTION = Object.freeze({ WEAPON_FIRED: "entityId", ENEMY_ATTACK: "entityId" });
const TARGET_HIT_EVENT = "ENEMY_ATTACK";

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

// Stage id -> single accent tint, mapping each stage's authored
// STAGE_PRESENTATION_BY_ID palette (defense-catalog.js, semantic tokens
// like "contour-ember"/"hazard-flood" -- design words, not colors) onto
// this repo's already-shipped canon material palette (styles.css
// --canon-* custom properties, measured from the actual GLB material
// table per decision-log.md D15/D19) so stage lighting stays in the same
// authored color language as the character/terrain art it lights, rather
// than inventing a parallel palette. One tint per stage is intentionally
// coarse (stage-composition-20260725.md §1.1 asks only for "at least
// chromatically consistent" fog/light/envmap, not a full multi-color
// re-lit scene) -- applyStagePalette() blends this single accent into the
// existing fog/key/ambient/envmap base tones rather than replacing them
// outright, so the overall lighting DIRECTION established by mount()
// stays intact and only its color cast shifts per stage.
const STAGE_PALETTE_TINTS = Object.freeze({
  "cinder-span": 0xf3592c, // canon-cinder-ember -- "불씨와 재의 흐름" ember/ash motif
  "veil-citadel": 0x2cadd6, // canon-cyan-rift -- "거울빛 장막" mirror-light motif
  "echo-throne": 0x3c2c5b, // canon-void-obsidian -- moonless-court void motif
  "sunken-bastion": 0x2cadd6, // canon-cyan-rift -- flood/tide waterline motif
  "howling-sprawl": 0xddc869, // canon-zenith-gold -- dust/wind wasteland motif
  "glass-necropolis": 0x2cadd6, // canon-cyan-rift -- crystal/shard reflective motif (see §3.6 mitigation note below)
  "starless-canal": 0x737990, // canon-cold-steel -- moonless dark-water motif
  "shattered-causeway": 0xf3592c, // canon-cinder-ember -- collapse/rubble dust motif
  "abyss-chancel": 0x3c2c5b, // canon-void-obsidian -- oath/pressure heavy-fog motif
  "gate-zenith": 0xddc869, // canon-zenith-gold -- threshold-rays open-vista motif
});

// Per-stage fog DEPTH (near/far as WORLD_SCALE multiples). applyStagePalette()
// already retints fog COLOR per stage, but near/far distance stayed a single
// global constant (mount(): WORLD_SCALE*1.8 / *4.2), so every stage read at the
// same atmospheric depth regardless of its authored motif -- the exact
// "스테이지마다 시각적 차별점이 있는가" gap this axis targets. This table gives
// each stage its own openness, grounded in stage-composition-20260725.md §3:
//   - heavy/close fog for void & night motifs so low silhouettes stay veiled:
//     Echo Throne (§3.3 "가장 짙게 ... 저해상도 지오메트리 은폐"), Starless
//     Canal (§3.7 "안개색을 가장 어둡게"), Abyss Chancel (§3.9 "안개를 무겁게"),
//     Veil Citadel (§3.2 "장막이 신호와 시야를 삼킨다").
//   - open/far fog for the two vista stages whose identity IS a readable long
//     silhouette: Howling Sprawl (§3.5 "안개를 가장 옅게 ... 능선의 실루엣이
//     원거리에서도 읽혀야"), Gate Zenith (§3.10 "안개를 가장 옅게 ... 가장 멀리,
//     가장 넓게 본다").
//   - tight fog for the bridge stage so its ends "fade into fog" instead of
//     snapping off a card-flat bbox: Cinder Span (§3.1 "다리 양 끝단이 항상
//     안개에 잠기도록 ... 안개 속으로 사라진다").
// Unlisted stages fall back to STAGE_FOG_BASE (the mount() baseline). Pure
// render values -- fog never feeds the snapshot or getRunDigest, so the
// renderer-one-way / determinism contracts are untouched. Every listed near <
// its far, and every near stays within ~±0.5 of the shipped 1.8 baseline so
// the near-plane never crosses the character/gate the player is tracking
// (§1.4's "안개 근거리가 지형 가장자리를 가리도록" concern only bounds how FAR
// near may drift outward, which the two vista stages do intentionally so their
// terrain silhouette reads -- exactly what §3.5/§3.10 ask for).
const STAGE_FOG_BASE = Object.freeze({ near: 1.8, far: 4.2 });
const STAGE_FOG_MULTIPLIERS = Object.freeze({
  "cinder-span": { near: 1.6, far: 3.6 },
  "veil-citadel": { near: 1.5, far: 3.4 },
  "echo-throne": { near: 1.4, far: 3.0 },
  "sunken-bastion": { near: 1.8, far: 4.0 },
  "howling-sprawl": { near: 2.2, far: 5.4 },
  "glass-necropolis": { near: 1.9, far: 4.4 },
  "starless-canal": { near: 1.4, far: 3.1 },
  "shattered-causeway": { near: 1.7, far: 3.9 },
  "abyss-chancel": { near: 1.5, far: 3.3 },
  "gate-zenith": { near: 2.3, far: 5.6 },
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
function worldPoint(entity) {
  const x = finite(entity?.x, 0);
  const y = finite(entity?.y, 0);
  if (entity?.normalized === true || (Math.abs(x) <= 1 && Math.abs(y) <= 1)) {
    return { x: x * WORLD_SCALE, z: y * WORLD_SCALE };
  }
  return {
    x: (x / WORLD_WIDTH * 2 - 1) * WORLD_SCALE,
    z: (y / WORLD_HEIGHT * 2 - 1) * WORLD_SCALE,
  };
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

function actorModelPath(entity) {
  if (!entity) return null;
  if (entity.id === "commander") return COMMANDER_MODEL;
  if (entity.class === "boss") return entity.bossId ? BOSS_MODELS[entity.bossId] ?? null : null;
  if (entity.kind === "companion") return entity.companionId ? COMPANION_MODELS[entity.companionId] ?? null : null;
  if (typeof entity.kind === "string" && ENEMY_MODELS[entity.kind]) return ENEMY_MODELS[entity.kind];
  return null;
}

function actorTargetHeight(entity) {
  if (!entity) return TARGET_HEIGHT.enemy;
  if (entity.id === "commander") return TARGET_HEIGHT.commander;
  if (entity.class === "boss") return TARGET_HEIGHT.boss;
  if (entity.kind === "companion") return TARGET_HEIGHT.companion;
  if (entity.elite) return TARGET_HEIGHT.elite;
  return TARGET_HEIGHT.enemy;
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

// --- GLTF loading: one shared loader + promise cache across every mounted
// instance (pure asset-data caching, not per-instance scene state -- safe
// to share, and avoids re-fetching the same 42 files if multiple sessions
// mount in sequence). ---
const gltfLoader = new GLTFLoader();
const gltfCache = new Map();
// SkeletonUtils.clone() gives each rendered instance an owned skeleton; this
// identity set keeps repeated disposal idempotent when roots overlap.
const disposedSkeletons = new WeakSet();

function loadGltf(relPath) {
  if (!gltfCache.has(relPath)) {
    gltfCache.set(
      relPath,
      new Promise((resolve, reject) => {
        gltfLoader.load(MODEL_ROOT + relPath, resolve, undefined, reject);
      }),
    );
  }
  return gltfCache.get(relPath);
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
function buildActions(mixer, clips) {
  const actions = {};
  for (const clip of clips) {
    const key = actionKeyFromClipName(clip.name);
    if (!key || actions[key]) continue;
    const action = mixer.clipAction(clip);
    if (key === "idle" || key === "move" || key === "run") {
      action.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
  }
  return actions;
}

async function instantiateActorModel(relPath, targetHeight) {
  const gltf = await loadGltf(relPath);
  // SkeletonUtils.clone() (not gltf.scene.clone()) so a SkinnedMesh instance
  // gets bound to ITS OWN cloned skeleton -- plain Object3D#clone() copies
  // the mesh but leaves every clone bound to the ORIGINAL shared skeleton,
  // so multiple live instances of the same rigged GLB (e.g. two "scout"
  // enemies on screen at once) would corrupt each other's pose every frame.
  // No-op for non-skinned nodes (terrain/VFX never hit this path), so this
  // is safe for every actor kind uniformly.
  const instance = SkeletonUtils.clone(gltf.scene);
  fitHeight(instance, targetHeight);
  let mixer = null;
  let actions = {};
  if (Array.isArray(gltf.animations) && gltf.animations.length) {
    // AnimationClip keyframe tracks address bones/nodes by NAME, not object
    // reference, and SkeletonUtils.clone() preserves every name -- binding
    // the mixer to `instance` (the clone) makes clipAction() resolve tracks
    // against the clone's own bones, standard three.js multi-instance
    // pattern, one mixer per instance sharing the same immutable clip data.
    mixer = new THREE.AnimationMixer(instance);
    actions = buildActions(mixer, gltf.animations);
  }
  return { instance, mixer, actions };
}

async function instantiateTerrainModel(relPath) {
  const gltf = await loadGltf(relPath);
  const instance = SkeletonUtils.clone(gltf.scene);
  fitFootprint(instance, TERRAIN_TARGET_HALF_EXTENT);
  return instance;
}

async function instantiateVfxModel(relPath) {
  const gltf = await loadGltf(relPath);
  const instance = SkeletonUtils.clone(gltf.scene);
  fitHeight(instance, 1.2);
  instance.position.y = 0.6;
  return instance;
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

    this.actors = new Map(); // entity.id -> { root, kind, modelPath, loading }
    this.vfxInstances = []; // { root, untilTick } -- also holds death echoes: { root, untilTick, mixer }
    this.cameraTarget = new THREE.Vector3();
    this.cameraFollowInit = false;
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
    this.pendingVfx = [];
    this.pendingDeathEchoes = []; // captureDeathEchoes()-collected { modelPath, x, z }, drained by collectFeedback()
    // Wall-clock delta for AnimationMixer stepping, derived from the same
    // performance.now() timestamp updateAnimations() already receives for
    // one-shot expiry -- deliberately NOT tied to snapshot.tick (60Hz sim
    // ticks can batch/skip on a slow frame or a paused/backgrounded tab).
    this.lastAnimMs = null;
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

    const webgl2 = this.canvas.getContext?.("webgl2", { alpha: false, antialias: true, failIfMajorPerformanceCaveat: false });
    if (!webgl2) throw new Error("WebGL2 context unavailable");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context: webgl2, antialias: true, alpha: false });
    this.renderer.setClearColor(COLORS.backgroundBottom, 1);
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

    this.disposed = false;
    return this;
  }

  ensureStageTerrain(stageId) {
    if (!stageId || this.disposed) return;
    if (this.loadedStageId === stageId || this.loadingStageId === stageId) return;
    // First resolution of a NEW stage id for this session (the dedup guard
    // above already ruled out "same stage as last frame") -- the correct
    // hook point for stage-scoped presentation, independent of whether the
    // terrain GLB itself is found/loads successfully below (stage-
    // composition-20260725.md §1.1, D22 판정 10).
    this.applyStagePalette(stageId);
    const relPath = TERRAIN_MODELS[stageId];
    if (!relPath) return;
    this.loadingStageId = stageId;
    instantiateTerrainModel(relPath)
      .then((instance) => {
        if (this.disposed || this.loadingStageId !== stageId) {
          disposeObject3D(instance);
          return;
        }
        while (this.terrainGroup.children.length) {
          const child = this.terrainGroup.children[0];
          this.terrainGroup.remove(child);
          disposeObject3D(child);
        }
        this.terrainGroup.add(instance);
        this.loadedStageId = stageId;
        this.loadingStageId = null;
      })
      .catch(() => {
        if (this.loadingStageId === stageId) this.loadingStageId = null;
      });
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
      this.renderer.setClearColor(backgroundTint, 1);
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
    const modelPath = actorModelPath(entity) ?? (kind === "companion" ? null : null);
    const record = {
      root: null, kind, modelPath, loading: Boolean(modelPath),
      mixer: null, actions: {}, activeActionKey: null, targetHeight: actorTargetHeight(entity),
      oneShotUntilMs: 0, moving: false, lastX: null, lastZ: null,
      // Facing state (D23 Phase 1). `yaw` is the rendered angle, eased
      // toward `targetYaw` in updateAnimations(); both stay null until the
      // actor's first real movement, so a freshly spawned actor keeps its
      // authored orientation instead of snapping to an arbitrary default.
      yaw: null, targetYaw: null,
      // Simulation-exact position, kept alongside the rendered one so a
      // companion's render trail (updateActorFollow) always has an
      // authoritative target to converge on.
      goalX: null, goalZ: null,
    };
    this.actors.set(entity.id, record);
    if (!modelPath) {
      // No dedicated model (shouldn't normally happen for known kinds, but
      // degrade gracefully instead of leaving a silent gap): a small
      // emissive marker keeps the entity visible.
      const marker = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3, 0),
        new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.5 }),
      );
      record.root = marker;
      record.loading = false;
      this.actorGroup.add(marker);
      return record;
    }
    instantiateActorModel(modelPath, actorTargetHeight(entity))
      .then(({ instance, mixer, actions }) => {
        record.root = instance;
        record.mixer = mixer;
        record.actions = actions;
        record.loading = false;
        if (this.disposed || !this.actors.has(entity.id) || this.actors.get(entity.id) !== record) {
          disposeObject3D(instance);
          return;
        }
        this.actorGroup.add(instance);
        // Start in idle immediately (no fade-in needed for a freshly
        // mounted actor -- there is no prior pose to blend from).
        const idle = actions.idle;
        if (idle) {
          idle.reset().play();
          record.activeActionKey = "idle";
        }
      })
      .catch(() => {
        record.loading = false;
      });
    return record;
  }

  // Crossfades record's currently-playing action to `key` over `fadeSeconds`.
  // No-op if the actor has no clip for `key` (some models are unrigged, see
  // RIG_ACTION_KEYS doc comment) or is already playing it.
  crossfadeToAction(record, key, fadeSeconds = 0.2) {
    const next = record.actions?.[key];
    if (!next || record.activeActionKey === key) return false;
    const previous = record.activeActionKey ? record.actions[record.activeActionKey] : null;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.reset().fadeIn(fadeSeconds).play();
    if (previous && previous !== next) previous.fadeOut(fadeSeconds);
    record.activeActionKey = key;
    return true;
  }

  // Plays a one-shot combat beat (attack/hit/bighit/critical/die/...) on top
  // of locomotion, holding it for its authored clip duration before
  // updateAnimations() lets locomotion resume. Silently ignored for actors
  // without that clip or without a mixer (unrigged models) -- combat still
  // functions identically, just without the visual flourish.
  triggerAction(record, key, nowMs) {
    if (!record?.mixer) return;
    const action = record.actions?.[key];
    if (!action) return;
    const played = this.crossfadeToAction(record, key, 0.08);
    if (!played) return;
    const clip = action.getClip();
    record.oneShotUntilMs = nowMs + (Number.isFinite(clip?.duration) ? clip.duration * 1000 : 600);
  }

  // Writes the actor's rendered position and derives its heading. `record`
  // keeps two positions: the simulation's exact one (goalX/goalZ) and the
  // rendered one (root.position), which for companions trails slightly --
  // see updateActorFollow(). Facing is derived from the RENDERED delta so a
  // trailing companion faces where it is visibly going, not where the
  // simulation already teleported it.
  syncActorPosition(record, entity) {
    if (!record.root) return;
    const p = worldPoint(entity);
    record.goalX = p.x;
    record.goalZ = p.z;
    // Commander and everything that is not a companion render exactly on
    // the simulation position. The commander especially: it answers direct
    // player input, and smoothing it would read as input lag.
    if (record.kind !== "companion" || this.reducedMotion || record.lastX === null) {
      record.root.position.x = p.x;
      record.root.position.z = p.z;
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
      return;
    }
    const t = 1 - Math.exp(-FOLLOW_CATCHUP_RATE * deltaSeconds);
    record.root.position.x += (record.goalX - record.root.position.x) * t;
    record.root.position.z += (record.goalZ - record.root.position.z) * t;
  }

  retireActor(id) {
    const record = this.actors.get(id);
    if (!record) return;
    this.actors.delete(id);
    if (record.mixer) record.mixer.stopAllAction();
    if (record.root) {
      this.actorGroup.remove(record.root);
      disposeObject3D(record.root);
    }
  }

  reconcileActors(snapshot) {
    const seen = new Set();

    const commander = snapshot?.commander ?? snapshot?.player;
    if (commander?.id) {
      seen.add(commander.id);
      const record = this.ensureActor(commander, "commander");
      this.syncActorPosition(record, commander);
    }

    for (const enemy of list(snapshot, "enemies", "hostiles")) {
      if (!enemy?.id) continue;
      seen.add(enemy.id);
      const kind = enemy.class === "boss" ? "boss" : "enemy";
      const record = this.ensureActor(enemy, kind);
      this.syncActorPosition(record, enemy);
    }

    for (const companion of list(snapshot, "companions", "allies")) {
      if (!companion?.id) continue;
      seen.add(companion.id);
      const record = this.ensureActor(companion, "companion");
      this.syncActorPosition(record, companion);
      const isDowned = companion.status === "DOWNED";
      if (record.root) {
        if (isDowned && record.prevStatus !== "DOWNED") {
          // Just went down this frame: play the die clip once before
          // hiding, instead of vanishing instantly -- triggerAction() is a
          // no-op if this actor has no "die" clip, so unrigged companions
          // fall through to the immediate-hide branch below exactly as
          // before this session's change.
          const hasDie = Boolean(record.actions?.die);
          if (hasDie) {
            this.triggerAction(record, "die", performance.now());
            record.root.visible = true;
            record.dieHideAtMs = record.oneShotUntilMs;
          } else {
            record.root.visible = false;
          }
        } else if (isDowned) {
          // Already down (not this frame): stay in whatever the die-timer
          // decided -- updateAnimations() flips visible=false once the die
          // clip's duration elapses, never re-shown while still DOWNED.
        } else {
          record.root.visible = true;
        }
      }
      record.prevStatus = companion.status;
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
      let record = this.actors.get(projectile.id);
      if (!record) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshStandardMaterial({ color: COLORS.projectile, emissive: COLORS.projectile, emissiveIntensity: 1 }),
        );
        record = { root: mesh, kind: "projectile", modelPath: null, loading: false };
        this.actors.set(projectile.id, record);
        this.actorGroup.add(mesh);
      }
      this.syncActorPosition(record, projectile);
    }

    for (const id of [...this.actors.keys()]) {
      if (!seen.has(id)) this.retireActor(id);
    }

    const gate = snapshot?.gate ?? snapshot?.base;
    if (gate && this.gateMesh) {
      this.gateMesh.visible = true;
      const p = worldPoint(gate);
      this.gateMesh.position.set(p.x, 1, p.z);
    }
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

  updateCamera(snapshot) {
    // --- Section 1: pan target (cameraTarget) -- BYTE-IDENTICAL to the
    // pre-orbit implementation (camera-orbit-implementation-plan-
    // 20260725.md §4.2/§4.3 director decision, D21 발견 2 / D22 판정 5):
    // auto-follow only ever moves the orbit CENTER, never the viewing
    // angle the player chose via orbit()/zoom() -- those are entirely
    // separate fields, written only by orbit()/zoom() above, never here.
    const commander = snapshot?.commander ?? snapshot?.player;
    const commanderPoint = worldPoint(commander ?? {});
    const targetX = commanderPoint.x;
    const targetZ = commanderPoint.z;
    if (!this.cameraFollowInit) {
      this.cameraTarget.set(targetX, 0, targetZ);
      this.cameraFollowInit = true;
    } else if (!this.reducedMotion) {
      this.cameraTarget.x += (targetX - this.cameraTarget.x) * 0.18;
      this.cameraTarget.z += (targetZ - this.cameraTarget.z) * 0.18;
    } else {
      this.cameraTarget.set(targetX, 0, targetZ);
    }

    // --- Section 2: orbit position -- spherical coordinates around
    // cameraTarget, replacing the legacy fixed offset (§4.2). orbitYaw=0
    // looks from the +Z side, matching the legacy offset's viewing
    // direction (offset.z > 0, offset.x = 0) for continuity at defaults.
    const horizontalRadius = this.zoomFactor * Math.cos(this.orbitPitch);
    const height = this.zoomFactor * Math.sin(this.orbitPitch);
    const offsetX = horizontalRadius * Math.sin(this.orbitYaw);
    const offsetZ = horizontalRadius * Math.cos(this.orbitYaw);
    this.camera.position.set(
      this.cameraTarget.x + offsetX,
      this.cameraTarget.y + height, // cameraTarget.y is always 0 -- Section 1 never sets it otherwise
      this.cameraTarget.z + offsetZ,
    );
    this.camera.lookAt(this.cameraTarget.x, 0.6, this.cameraTarget.z); // lookAt height offset unchanged

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
    const rimYaw = this.orbitYaw + Math.PI;
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
   * NDC projection of a tracked actor's GROUND anchor -- every actor mesh
   * sits at y=0 (syncActorPosition only ever writes x/z), so this is the
   * feet position, not the head.
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
   * NDC projection of a fixed ground point given in the simulation's
   * normalized [-1,1] space (callers divide an ARENA coordinate by
   * ARENA.width/height and rescale -- see app.js:1373 and :1448).
   *
   * Uses the same normalized->world mapping worldPoint() applies to
   * entities, so a static marker and an actor standing on it project to the
   * same pixel. See projectEntityToScreen() for why there is no world-unit
   * height offset.
   */
  projectStaticPoint(normalizedX, normalizedY) {
    if (this.disposed || !this.camera) return null;
    return this.worldToNDC(
      new THREE.Vector3(finite(normalizedX, 0) * WORLD_SCALE, 0, finite(normalizedY, 0) * WORLD_SCALE),
    );
  }

  rememberVisualEvent(key) {
    if (this.visualEventKeys.has(key)) return false;
    this.visualEventKeys.add(key);
    if (this.visualEventKeys.size > MAX_VISUAL_EVENT_KEYS) {
      this.visualEventKeys.delete(this.visualEventKeys.values().next().value);
    }
    return true;
  }

  spawnVfx(snapshot, event, tick) {
    const relPath = VFX_MODELS[event?.type];
    if (!relPath) return;
    const anchor = effectAnchor(snapshot, event);
    if (!anchor) return;
    const lifetime = VFX_LIFETIME_TICKS[event.type] ?? 30;
    const untilTick = tick + lifetime;
    const placeholder = new THREE.Group();
    const p = worldPoint(anchor);
    placeholder.position.set(p.x, 0.6, p.z);
    this.vfxGroup.add(placeholder);
    const record = { root: placeholder, untilTick, loaded: false };
    this.vfxInstances.push(record);
    if (this.vfxInstances.length > MAX_VISUAL_EFFECTS) {
      const stale = this.vfxInstances.shift();
      this.vfxGroup.remove(stale.root);
      disposeObject3D(stale.root);
    }
    instantiateVfxModel(relPath).then((instance) => {
      if (!this.vfxInstances.includes(record)) {
        disposeObject3D(instance);
        return;
      }
      placeholder.add(instance);
      record.loaded = true;
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
        z: record.root.position.z,
        targetHeight: record.targetHeight ?? TARGET_HEIGHT.enemy,
      });
    }
  }

  spawnDeathEcho(echo, tick) {
    instantiateActorModel(echo.modelPath, echo.targetHeight)
      .then(({ instance, mixer, actions }) => {
        if (this.disposed) {
          disposeObject3D(instance);
          return;
        }
        instance.position.set(echo.x, 0, echo.z);
        this.vfxGroup.add(instance);
        const action = actions.die;
        let untilTick = tick + 72; // DEFAULT_BUDGETS.die.targetFrames @ 60fps, scripts/rig-character-asset-blender.py
        if (action) {
          action.reset().play();
          const clip = action.getClip();
          if (Number.isFinite(clip?.duration)) untilTick = tick + Math.ceil(clip.duration * 60);
        }
        this.vfxInstances.push({ root: instance, untilTick, mixer, loaded: true });
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

  // Steps every live actor's AnimationMixer by real elapsed time and returns
  // one-shot combat beats (attack/hit/die/...) to locomotion (idle/move)
  // once their clip finishes -- called once per renderSnapshot() after
  // positions/state are reconciled for this frame, deliberately NOT tied to
  // the 60Hz sim tick (see lastAnimMs field comment).
  updateAnimations(nowMs) {
    const delta = Math.min((nowMs - (this.lastAnimMs ?? nowMs)) / 1000, 0.1);
    this.lastAnimMs = nowMs;
    for (const record of this.actors.values()) {
      if (record.mixer) record.mixer.update(delta);
      this.updateActorFollow(record, delta);
      this.updateActorFacing(record, delta);
      if (record.oneShotUntilMs && nowMs >= record.oneShotUntilMs) {
        record.oneShotUntilMs = 0;
        this.crossfadeToAction(record, record.moving ? "move" : "idle", 0.15);
      } else if (!record.oneShotUntilMs && record.mixer) {
        // No one-shot in flight: keep locomotion honest every frame (a
        // companion/enemy that starts moving mid-idle, or stops mid-walk,
        // switches immediately rather than waiting for the next combat
        // beat to resync it).
        this.crossfadeToAction(record, record.moving ? "move" : "idle", 0.15);
      }
      if (record.dieHideAtMs && nowMs >= record.dieHideAtMs) {
        record.dieHideAtMs = 0;
        if (record.root) record.root.visible = false;
      }
    }
    for (const echo of this.vfxInstances) {
      if (echo.mixer) echo.mixer.update(delta);
    }
  }


  // Consumes WEAPON_FIRED (commander/companion ranged auto-attack) and
  // ENEMY_ATTACK (enemy/boss attacking commander, a companion, or "gate")
  // events to trigger the attack/hit clips on whichever live actors they
  // name -- verified event field shapes, see ATTACKER_EVENT_ACTION/
  // TARGET_HIT_EVENT doc comment above. A miss (id not in this.actors, e.g.
  // "gate" which has no actor mesh) is a silent no-op by design.
  triggerCombatActions(event, nowMs) {
    const attackerId = ATTACKER_EVENT_ACTION[event?.type];
    if (attackerId) {
      const attacker = this.actors.get(event[attackerId]);
      if (attacker) this.triggerAction(attacker, "attack", nowMs);
    }
    if (event?.type === TARGET_HIT_EVENT) {
      const target = this.actors.get(event.targetId);
      if (target) this.triggerAction(target, "hit", nowMs);
    }
  }

  collectFeedback(snapshot) {
    const tick = finite(snapshot?.tick, 0);
    for (const record of this.vfxInstances) {
      if (record.untilTick <= tick) {
        this.vfxGroup.remove(record.root);
        disposeObject3D(record.root);
      }
    }
    this.vfxInstances = this.vfxInstances.filter((record) => record.untilTick > tick);

    const nowMs = performance.now();
    for (const event of Array.isArray(snapshot?.events) ? snapshot.events : []) {
      if (VFX_MODELS[event?.type]) {
        const key = feedbackKey(event);
        if (this.rememberVisualEvent(key)) this.spawnVfx(snapshot, event, tick);
      }
      this.triggerCombatActions(event, nowMs);
    }
    for (const echo of this.pendingDeathEchoes.splice(0)) {
      this.spawnDeathEcho(echo, tick);
    }
    this.pendingInputFeedback = null;
  }


  renderSnapshot(snapshot = {}, frame = {}) {
    if (this.disposed || !this.renderer || !this.camera || !this.scene) return;
    const { width, height } = bounds(this.canvas, this.viewport ?? frame?.viewport);
    if (this.canvas.width !== Math.round(width) || this.canvas.height !== Math.round(height)) {
      this.renderer.setSize(width, height, false);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.ensureStageTerrain(resolveStageId(snapshot));
    this.captureDeathEchoes(snapshot);
    this.reconcileActors(snapshot);
    this.updateCamera(snapshot);
    this.updateAnimations(performance.now());
    this.collectFeedback(snapshot);

    this.renderer.render(this.scene, this.camera);
  }

  onVisualFeedback(inputSeq) {
    this.lastFeedback = inputSeq;
    this.pendingInputFeedback = inputSeq;
  }

  dispose() {
    if (this.terrainGroup) {
      while (this.terrainGroup.children.length) {
        const child = this.terrainGroup.children[0];
        this.terrainGroup.remove(child);
        disposeObject3D(child);
      }
    }
    for (const record of this.actors.values()) {
      record.mixer?.stopAllAction();
      if (record.root) disposeObject3D(record.root);
    }
    this.actors.clear();
    for (const record of this.vfxInstances) {
      record.mixer?.stopAllAction();
      disposeObject3D(record.root);
    }
    this.vfxInstances = [];
    this.pendingDeathEchoes = [];
    if (this.gateMesh) disposeObject3D(this.gateMesh);
    this.gateMesh = null;
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
    this.canvas = null;
    this.viewport = null;
    this.pendingInputFeedback = null;
    this.visualEventKeys.clear();
    this.loadedStageId = null;
    this.loadingStageId = null;
    this.lastAnimMs = null;
    this.disposed = true;
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
