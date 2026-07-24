// Snapshot-only presentation adapter for the defense session, backed by a
// real Three.js/WebGL scene graph. It deliberately owns neither time nor
// game input; the session supplies snapshots via renderSnapshot() and this
// module never drives its own animation loop or wires up DOM listeners of
// its own, and never imports campaign state -- verified by
// tests/defense-renderer-contract.test.mjs's "no loop/input/campaign/outcome
// ownership" check.
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { STAGES } from "./defense-catalog.js";

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
  "cinder-span": "cinder-span.glb",
  "veil-citadel": "veil-citadel.glb",
  "echo-throne": "echo-throne-steps.glb",
  "sunken-bastion": "sunken-bastion.glb",
  "howling-sprawl": "howling-sprawl.glb",
  "glass-necropolis": "glass-necropolis.glb",
  "starless-canal": "starless-canal.glb",
  "shattered-causeway": "shattered-causeway.glb",
  "abyss-chancel": "abyss-chancel.glb",
  "gate-zenith": "gate-zenith.glb",
});

// Boss actor's own `bossId` field (set verbatim from BOSSES[stage.boss].id
// in spawnBoss(), defense-run-simulation.js) is the exact key -- no need to
// cross-reference STAGES here.
const BOSS_MODELS = Object.freeze({
  "s1-cinder-warden": "cinder-warden.glb",
  "s2-veil-tactician": "veil-tactician.glb",
  "s3-gate-sovereign": "gate-sovereign.glb",
  "s4-tide-warden": "tide-warden.glb",
  "s5-pack-herald": "pack-herald.glb",
  "s6-requiem-choir": "requiem-choir.glb",
  "s7-lantern-tyrant": "lantern-tyrant.glb",
  "s8-bridge-colossus": "bridge-colossus.glb",
  "s9-veiled-concordat": "veiled-concordat.glb",
  "s10-abyss-regent": "abyss-regent.glb",
});

// Regular (non-boss) enemy actor's `kind` field is one of these 4
// archetypes (ENEMIES catalog in defense-catalog.js), reusing the canonical
// resource pack's 4 enemy models -- verified present, never had dedicated
// per-archetype art before this session.
const ENEMY_MODELS = Object.freeze({
  rusher: "scout.glb",
  flanker: "shade.glb",
  guardian: "guard.glb",
  ranged: "possessed.glb",
});

// Companion actor's `companionId` field selects its model.
const COMPANION_MODELS = Object.freeze({
  "ember-cohort": "ember-cohort.glb",
  "rift-lens": "rift-lens.glb",
  "veil-vanguard": "veil-vanguard.glb",
  "anchor-shard": "anchor-shard.glb",
  "throne-echo": "throne-echo.glb",
  "dawnless-crown": "dawnless-crown.glb",
  "pack-warden": "pack-warden.glb",
  "lantern-reaver": "lantern-reaver.glb",
  "requiem-warden": "requiem-warden.glb",
});

const COMMANDER_MODEL = "dusk-warden.glb";

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

export const COMMANDER_MESH_ROOT = COMMANDER_MODEL;

// Event type -> one-shot VFX GLB + lifetime (ticks @ 60Hz). These 5 RPG-
// layer telemetry events (defense-run-simulation.js) had zero visual
// representation anywhere in the runtime before this session; wired here
// against the exact event-type strings verified against the emit() call
// sites (grepped this session, not assumed).
const VFX_MODELS = Object.freeze({
  CRITICAL_HIT: "critical-hit-burst.glb",
  BOSS_RALLY_WINDOW: "boss-rally-aura.glb",
  GATE_BREACHED: "gate-breach-shockwave.glb",
  WARDENS_WARD_TRIGGERED: "wardens-ward-shield.glb",
  ECHO_WARDEN_AWAKENING_TRIGGERED: "echo-warden-awakening.glb",
  COMPANION_DOWNED: "companion-downed-fade.glb",
});
const VFX_LIFETIME_TICKS = Object.freeze({
  CRITICAL_HIT: 18,
  BOSS_RALLY_WINDOW: 90,
  GATE_BREACHED: 36,
  WARDENS_WARD_TRIGGERED: 60,
  ECHO_WARDEN_AWAKENING_TRIGGERED: 120,
  COMPANION_DOWNED: 48,
});

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

async function instantiateActorModel(relPath, targetHeight) {
  const gltf = await loadGltf(relPath);
  const instance = gltf.scene.clone(true);
  fitHeight(instance, targetHeight);
  return instance;
}

async function instantiateTerrainModel(relPath) {
  const gltf = await loadGltf(relPath);
  const instance = gltf.scene.clone(true);
  fitFootprint(instance, TERRAIN_TARGET_HALF_EXTENT);
  return instance;
}

async function instantiateVfxModel(relPath) {
  const gltf = await loadGltf(relPath);
  const instance = gltf.scene.clone(true);
  fitHeight(instance, 1.2);
  instance.position.y = 0.6;
  return instance;
}

function disposeObject3D(root) {
  root.traverse((node) => {
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

    this.actors = new Map(); // entity.id -> { root, kind, modelPath, loading }
    this.vfxInstances = []; // { root, untilTick }
    this.cameraTarget = new THREE.Vector3();
    this.cameraFollowInit = false;

    this.loadedStageId = null;
    this.loadingStageId = null;

    this.lastFeedback = null;
    this.pendingInputFeedback = null;
    this.visualEventKeys = new Set();
    this.pendingVfx = [];
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

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(COLORS.backgroundBottom, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(COLORS.backgroundBottom, WORLD_SCALE * 1.8, WORLD_SCALE * 4.2);

    const { width, height } = bounds(this.canvas, this.viewport);
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);

    const ambient = new THREE.AmbientLight(COLORS.ambient, 1.1);
    const key = new THREE.DirectionalLight(COLORS.key, 1.6);
    key.position.set(6, 10, 4);
    const rim = new THREE.DirectionalLight(COLORS.rim, 0.6);
    rim.position.set(-8, 5, -6);
    this.scene.add(ambient, key, rim);

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

  ensureActor(entity, kind) {
    if (!entity?.id || this.disposed) return;
    const existing = this.actors.get(entity.id);
    if (existing) return existing;
    const modelPath = actorModelPath(entity) ?? (kind === "companion" ? null : null);
    const record = { root: null, kind, modelPath, loading: Boolean(modelPath) };
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
      .then((instance) => {
        record.root = instance;
        record.loading = false;
        if (this.disposed || !this.actors.has(entity.id) || this.actors.get(entity.id) !== record) {
          disposeObject3D(instance);
          return;
        }
        this.actorGroup.add(instance);
      })
      .catch(() => {
        record.loading = false;
      });
    return record;
  }

  syncActorPosition(record, entity) {
    if (!record.root) return;
    const p = worldPoint(entity);
    record.root.position.x = p.x;
    record.root.position.z = p.z;
  }

  retireActor(id) {
    const record = this.actors.get(id);
    if (!record) return;
    this.actors.delete(id);
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
      if (record.root) record.root.visible = companion.status !== "DOWNED";
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

  updateCamera(snapshot) {
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
    const offset = new THREE.Vector3(0, WORLD_SCALE * 1.05, WORLD_SCALE * 1.05);
    this.camera.position.set(this.cameraTarget.x + offset.x, offset.y, this.cameraTarget.z + offset.z);
    this.camera.lookAt(this.cameraTarget.x, 0.6, this.cameraTarget.z);
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

  collectFeedback(snapshot) {
    const tick = finite(snapshot?.tick, 0);
    for (const record of this.vfxInstances) {
      if (record.untilTick <= tick) {
        this.vfxGroup.remove(record.root);
        disposeObject3D(record.root);
      }
    }
    this.vfxInstances = this.vfxInstances.filter((record) => record.untilTick > tick);

    for (const event of Array.isArray(snapshot?.events) ? snapshot.events : []) {
      if (!VFX_MODELS[event?.type]) continue;
      const key = feedbackKey(event);
      if (this.rememberVisualEvent(key)) this.spawnVfx(snapshot, event, tick);
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
    this.reconcileActors(snapshot);
    this.updateCamera(snapshot);
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
      if (record.root) disposeObject3D(record.root);
    }
    this.actors.clear();
    for (const record of this.vfxInstances) {
      disposeObject3D(record.root);
    }
    this.vfxInstances = [];
    if (this.gateMesh) disposeObject3D(this.gateMesh);
    this.gateMesh = null;

    this.scene = null;
    this.camera = null;
    this.terrainGroup = null;
    this.actorGroup = null;
    this.vfxGroup = null;
    this.cameraFollowInit = false;

    this.renderer?.dispose();
    this.renderer = null;
    this.canvas = null;
    this.viewport = null;
    this.pendingInputFeedback = null;
    this.visualEventKeys.clear();
    this.loadedStageId = null;
    this.loadingStageId = null;
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
