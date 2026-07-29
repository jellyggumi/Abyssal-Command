import { ARENA, STAGES } from "./defense-catalog.js";

/**
 * Immutable world-composition data shared by simulation and presentation.
 * Coordinates use the canonical 24000 x 12000 simulation arena. Geometry here
 * is descriptive only: collision and elevation resolution remain simulation-owned.
 */
const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

const bounds = (minX, maxX, minY, maxY) => ({ minX, maxX, minY, maxY });
const obstacle = (id, x, y, radius, elevation = 0) => ({
  id,
  shape: "circle",
  footprint: { x, y, radius },
  elevation,
});
const surface = (id, type, minX, maxX, minY, maxY, axis, atMin, atMax) => ({
  id,
  type,
  bounds: bounds(minX, maxX, minY, maxY),
  elevation: { axis, atMin, atMax },
});
const meshCollider = (id, triangles) => ({ id, triangles });
const triangle = (ax, ay, ae, bx, by, be, cx, cy, ce) => ([
  { x: ax, y: ay, elevation: ae },
  { x: bx, y: by, elevation: be },
  { x: cx, y: cy, elevation: ce },
]);
const landmark = (id, label, x, y, elevation, propId) => ({
  id,
  label,
  placement: { x, y, elevation },
  propId,
});
const prop = (id, modelPath, role, x, y, elevation, yawRadians, footprintRadius) => ({
  id,
  modelPath,
  role,
  placement: { x, y, elevation, yawRadians },
  footprintRadius,
});
const vfxCue = (stageId, id, effectId, x, y, elevation, yawRadians) => ({
  id,
  effectId,
  role: "stage-ambient",
  modelPath: `assets/motion/stage-vfx/${effectId}.glb`,
  clip: `stage-vfx::${stageId}::loop::v01`,
  placement: { x, y, elevation, yawRadians },
  qualityGroups: { core: "vfx-core", detail: "vfx-detail", decor: "vfx-decor" },
  reducedMotion: "core-static",
});
const lookout = (id, x, y, elevation, yawRadians, lookAtX, lookAtY, cue) => ({
  id,
  role: "lookout",
  actorId: "lantern-reaver",
  modelPath: "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb",
  placement: { x, y, elevation, yawRadians },
  presentationCue: {
    idleClip: "idle",
    posture: "watchful",
    attention: cue,
    lookAt: { x: lookAtX, y: lookAtY },
  },
});
const editorial = (order, title, summary, rewardHint) => ({
  showcase: true,
  order,
  spoilerSafe: {
    title,
    status: "available-when-unlocked",
    summary,
    rewardHint,
  },
});

const PROPS = Object.freeze({
  blade: "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb",
  relic: "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb",
});

const profiles = [
  {
    stageId: "cinder-span",
    sequence: 1,
    name: "Cinder Span",
    terrainGlbPath: "assets/mesh/terrain/terrain-cinder-span/terrain-cinder-span-object/object/obj/base.obj",
    gameplay: {
      bounds: bounds(600, 23400, 800, 11200),
      obstacles: [
        obstacle("cinder-span:drowned-forge-arch", 12600, 2800, 850),
        obstacle("cinder-span:collapsed-parapet", 13200, 9300, 900),
      ],
      surfaces: [
        surface("cinder-span:overlook-ramp", "ramp", 15000, 16600, 2100, 3300, "x", 0, 420),
        surface("cinder-span:overlook-platform", "platform", 16600, 17900, 1900, 3400, "x", 420, 420),
      ],
      meshColliders: [meshCollider("cinder-span:walkable-support", [
        triangle(600, 800, 0, 23400, 800, 0, 23400, 11200, 0),
        triangle(600, 800, 0, 23400, 11200, 0, 600, 11200, 0),
      ])],
    },
    presentation: {
      palette: { surface: "surface-cinder-ash", contour: "contour-ember", landmark: "landmark-forge", hazard: "hazard-ash", objective: "objective-seal", accent: "#f3592c" },
      atmosphere: { descriptor: "Ash wind combs the bridge blockade.", motif: "embers moving through ash", fogNear: 22.4, fogFar: 50.4 },
      cinematic: { intro: { durationTicks: 90, from: { distance: 6, azimuth: -0.24, polar: -0.34 }, to: { distance: 0, azimuth: 0, polar: 0 } } },
      landmarks: [
        landmark("landmark.ember-relay-spire", "Ember Relay Spire", 17600, 6000, 0, "cinder-span:seal-brand"),
        landmark("landmark.drowned-forge-arch", "Drowned Forge Arch", 12600, 2800, 0, "cinder-span:forge-relic"),
      ],
      props: [
        prop("cinder-span:seal-brand", PROPS.blade, "gate-choke", 17600, 6000, 0, 0, 180),
        prop("cinder-span:forge-relic", PROPS.relic, "extraction-beacon", 15400, 6000, 0, 1.5708, 140),
      ],
      vfxCues: [vfxCue("cinder-span", "cinder-span:ember-wake", "cinder-span-ember-wake", 15400, 6000, 0, 0)],
      npcs: [lookout("cinder-span:ember-lookout", 17100, 2700, 420, 3.1416, 8000, 6000, "watch-western-ingress")],
    },
    editorial: editorial(1, "Cinder Span", "Hold the ash bridge and learn the first binding route.", "A recoverable Echo answers a successful extraction."),
  },
  {
    stageId: "abyss-chancel",
    sequence: 2,
    name: "Abyss Chancel",
    terrainGlbPath: "assets/mesh/terrain/terrain-abyss-chancel/textured-candidate/terrain/terrain-abyss-chancel-textured-cleaned.glb",
    gameplay: {
      bounds: bounds(600, 23400, 700, 11300),
      obstacles: [
        obstacle("abyss-chancel:oath-apse", 14000, 8750, 880),
        obstacle("abyss-chancel:nave-seal", 12200, 3150, 820),
      ],
      surfaces: [
        surface("abyss-chancel:apse-ramp", "ramp", 15700, 17200, 7600, 9100, "y", 0, 460),
        surface("abyss-chancel:apse-platform", "platform", 17200, 18800, 7600, 9100, "y", 460, 460),
      ],
      meshColliders: [meshCollider("abyss-chancel:walkable-nave", [
        triangle(600, 700, 0, 23400, 700, 0, 23400, 11300, 0),
        triangle(600, 700, 0, 23400, 11300, 0, 600, 11300, 0),
      ])],
    },
    presentation: {
      palette: { surface: "surface-chancel-abyss", contour: "contour-oath", landmark: "landmark-apse", hazard: "hazard-oath", objective: "objective-oath", accent: "#8f67ff" },
      atmosphere: { descriptor: "The chancel oath bends sight toward its sealed apse.", motif: "oath rings and violet static", fogNear: 24, fogFar: 54 },
      cinematic: { intro: { durationTicks: 96, from: { distance: 6.4, azimuth: 0.3, polar: -0.3 }, to: { distance: 0, azimuth: 0, polar: 0 } } },
      landmarks: [
        landmark("landmark.chancel-apse", "Chancel Apse", 18000, 8350, 460, "abyss-chancel:oath-relic"),
        landmark("landmark.chancel-nave", "Chancel Nave", 12200, 3150, 0, "abyss-chancel:nave-blade"),
      ],
      props: [
        prop("abyss-chancel:oath-relic", PROPS.relic, "oath-anchor", 18000, 8350, 460, 0.4, 190),
        prop("abyss-chancel:nave-blade", PROPS.blade, "flank-marker", 12200, 3150, 0, 1.5708, 150),
      ],
      vfxCues: [vfxCue("abyss-chancel", "abyss-chancel:mirror-static", "abyss-chancel-mirror-static", 14200, 6000, 0, 0)],
      npcs: [lookout("abyss-chancel:veil-lookout", 17300, 7850, 460, 3.1416, 9000, 6000, "watch-the-apse")],
    },
    editorial: editorial(2, "Abyss Chancel", "Break the oath rings before the tactician closes the nave.", "The second binding changes the squad's reach."),
  },
  {
    stageId: "echo-throne",
    sequence: 3,
    name: "Echo Throne",
    terrainGlbPath: "assets/mesh/terrain/terrain-echo-throne/textured-candidate/terrain/terrain-echo-throne-textured.glb",
    gameplay: {
      bounds: bounds(600, 23400, 600, 11400),
      obstacles: [
        obstacle("echo-throne:fractured-dais", 15400, 8600, 900),
        obstacle("echo-throne:echo-aisle", 11800, 3000, 800),
      ],
      surfaces: [
        surface("echo-throne:dais-ramp", "ramp", 15900, 17500, 7600, 9200, "x", 0, 540),
        surface("echo-throne:dais-platform", "platform", 17500, 19100, 7600, 9200, "x", 540, 540),
      ],
      meshColliders: [meshCollider("echo-throne:walkable-court", [
        triangle(600, 600, 0, 23400, 600, 0, 23400, 11400, 0),
        triangle(600, 600, 0, 23400, 11400, 0, 600, 11400, 0),
      ])],
    },
    presentation: {
      palette: { surface: "surface-throne-stone", contour: "contour-echo", landmark: "landmark-dais", hazard: "hazard-rift", objective: "objective-domain", accent: "#72c8ff" },
      atmosphere: { descriptor: "A fractured throne court repeats every strike across its aisle.", motif: "echo fractures and cold blue glass", fogNear: 23, fogFar: 55 },
      cinematic: { intro: { durationTicks: 102, from: { distance: 6.8, azimuth: -0.4, polar: -0.28 }, to: { distance: 0, azimuth: 0, polar: 0 } } },
      landmarks: [
        landmark("landmark.throne-dais", "Fractured Throne Dais", 18300, 8400, 540, "echo-throne:dais-relic"),
        landmark("landmark.throne-aisle", "Echo Aisle", 11800, 3000, 0, "echo-throne:aisle-blade"),
      ],
      props: [
        prop("echo-throne:dais-relic", PROPS.relic, "boss-sightline", 18300, 8400, 540, 0, 190),
        prop("echo-throne:aisle-blade", PROPS.blade, "recovery-marker", 11800, 3000, 0, 1.5708, 150),
      ],
      vfxCues: [vfxCue("echo-throne", "echo-throne:fracture-echo", "echo-throne-fracture-echo", 15400, 6000, 0, 0)],
      npcs: [lookout("echo-throne:throne-lookout", 17800, 8100, 540, 3.1416, 9200, 6000, "watch-the-court")],
    },
    editorial: editorial(3, "Echo Throne", "Turn the sovereign's own echo against the final court.", "The third binding resolves the current campaign."),
  },
];

const byId = Object.fromEntries(profiles.map((profile) => [profile.stageId, profile]));
const inside = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const assertFiniteNumbers = (value, path) => {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`Non-finite stage world value at ${path}`);
  if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => assertFiniteNumbers(entry, `${path}.${key}`));
};

const validateProfile = (profile) => {
  const { minX, maxX, minY, maxY } = profile.gameplay.bounds;
  assertFiniteNumbers(profile, profile.stageId);
  if (!(inside(minX, 0, ARENA.width) && inside(maxX, 0, ARENA.width) && minX < maxX
    && inside(minY, 0, ARENA.height) && inside(maxY, 0, ARENA.height) && minY < maxY)) throw new Error(`Invalid walkable bounds for stage world: ${profile.stageId}`);
  if (ARENA.gateX - 900 < minX || ARENA.gateX + 900 > maxX || ARENA.gateY - 900 < minY || ARENA.gateY + 900 > maxY) throw new Error(`Stage world excludes canonical gate geometry: ${profile.stageId}`);
  if (!profile.terrainGlbPath.startsWith("assets/mesh/terrain/")) throw new Error(`Stage terrain must use the retained mesh lane: ${profile.stageId}`);

  const ids = new Set();
  const claimId = (entry) => {
    if (!entry.id || ids.has(entry.id)) throw new Error(`Duplicate or missing world id in ${profile.stageId}: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.id.startsWith(`${profile.stageId}:`) && !entry.id.startsWith("landmark.")) throw new Error(`World id must be stage-scoped: ${entry.id}`);
  };
  profile.gameplay.obstacles.forEach((entry) => {
    claimId(entry);
    const { x, y, radius } = entry.footprint;
    if (!(radius > 0 && Number.isFinite(entry.elevation) && entry.elevation >= 0 && inside(x - radius, minX, maxX) && inside(x + radius, minX, maxX) && inside(y - radius, minY, maxY) && inside(y + radius, minY, maxY))) throw new Error(`Obstacle footprint leaves walkable bounds: ${entry.id}`);
    if (Math.hypot(x - ARENA.gateX, y - ARENA.gateY) < radius + 900) throw new Error(`Obstacle blocks canonical gate geometry: ${entry.id}`);
  });
  profile.gameplay.surfaces.forEach((entry) => {
    claimId(entry);
    const area = entry.bounds;
    if (!( ["ramp", "platform"].includes(entry.type) && inside(area.minX, minX, maxX) && inside(area.maxX, minX, maxX) && area.minX < area.maxX && inside(area.minY, minY, maxY) && inside(area.maxY, minY, maxY) && area.minY < area.maxY && ["x", "y"].includes(entry.elevation.axis) && Number.isInteger(entry.elevation.atMin) && Number.isInteger(entry.elevation.atMax) && entry.elevation.atMin >= 0 && entry.elevation.atMax >= 0 && (entry.type !== "ramp" || entry.elevation.atMin !== entry.elevation.atMax) && (entry.type !== "platform" || entry.elevation.atMin === entry.elevation.atMax))) throw new Error(`Invalid elevation surface: ${entry.id}`);
  });
  if (profile.gameplay.surfaces.filter(({ type }) => type === "ramp").length !== 1 || profile.gameplay.surfaces.filter(({ type }) => type === "platform").length !== 1) throw new Error(`Stage world requires one ramp and one platform: ${profile.stageId}`);
  const meshColliders = profile.gameplay.meshColliders ?? [];
  if (!Array.isArray(meshColliders) || meshColliders.length === 0) throw new Error(`Stage world requires an authored walkable support mesh: ${profile.stageId}`);
  meshColliders.forEach((collider) => {
    claimId(collider);
    if (!Array.isArray(collider.triangles) || collider.triangles.length === 0) throw new Error(`Mesh collider requires triangles: ${collider.id}`);
    collider.triangles.forEach((vertices, index) => {
      if (!Array.isArray(vertices) || vertices.length !== 3) throw new Error(`Mesh collider triangle must have three vertices: ${collider.id}[${index}]`);
      const validVertex = (vertex) => vertex && inside(vertex.x, minX, maxX) && inside(vertex.y, minY, maxY) && Number.isFinite(vertex.elevation) && vertex.elevation >= 0;
      if (!vertices.every(validVertex)) throw new Error(`Invalid mesh collider triangle: ${collider.id}[${index}]`);
      const [first, second, third] = vertices;
      if (!Number.isFinite((second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x)) || ((second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x)) === 0) throw new Error(`Degenerate mesh collider triangle: ${collider.id}[${index}]`);
    });
  });
  for (const entry of [...profile.presentation.props, ...(profile.presentation.vfxCues ?? []), ...profile.presentation.npcs, ...profile.presentation.landmarks]) claimId(entry);
  if (profile.presentation.props.some(({ modelPath }) => !modelPath.startsWith("assets/mesh/prop/"))) throw new Error(`Stage prop must use the retained mesh lane: ${profile.stageId}`);
  if (profile.presentation.vfxCues.some((entry) => entry.modelPath !== `assets/motion/stage-vfx/${entry.effectId}.glb` || entry.clip !== `stage-vfx::${profile.stageId}::loop::v01`)) throw new Error(`Invalid stage VFX cue: ${profile.stageId}`);
  if (profile.presentation.npcs.some(({ modelPath }) => modelPath !== "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb")) throw new Error(`Stage NPC must use Lantern Reaver mesh: ${profile.stageId}`);
  const propIds = new Set(profile.presentation.props.map(({ id }) => id));
  if (profile.presentation.landmarks.some(({ propId }) => !propIds.has(propId))) throw new Error(`Landmark requires a stage prop: ${profile.stageId}`);
  const intro = profile.presentation.cinematic?.intro;
  if (!intro || !Number.isInteger(intro.durationTicks) || intro.durationTicks <= 0 || intro.durationTicks > 300) throw new Error(`Invalid cinematic profile: ${profile.stageId}`);
};

const canonicalStageIds = STAGES.map(({ id }) => id);
if (profiles.length !== canonicalStageIds.length || new Set(profiles.map(({ stageId }) => stageId)).size !== canonicalStageIds.length || canonicalStageIds.some((stageId) => !Object.hasOwn(byId, stageId)) || Object.keys(byId).some((stageId) => !canonicalStageIds.includes(stageId))) throw new Error("Stage world catalog must cover every canonical stage exactly once.");
profiles.forEach(validateProfile);

export const STAGE_WORLD_PROFILES = freeze(byId);
export const STAGE_SHOWCASE_IDS = freeze(profiles.sort((left, right) => left.editorial.order - right.editorial.order).map(({ stageId }) => stageId));
if (STAGE_SHOWCASE_IDS.length !== 3) throw new Error("Stage world catalog must expose exactly three editorial showcases.");

/** Returns the canonical frozen profile for a stage id, or null when unknown. */
export function stageWorldFor(stageId) {
  return typeof stageId === "string" ? (STAGE_WORLD_PROFILES[stageId] ?? null) : null;
}
