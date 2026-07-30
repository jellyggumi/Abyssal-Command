import { ARENA, STAGES, STAGE_ENCOUNTER_ROUTES, STAGE_TACTICS } from "./defense-catalog.js";

/**
 * Immutable placement source of truth shared by simulation and presentation.
 * Coordinates use the canonical 24000 x 12000 arena; every route, support,
 * prop, landmark, visibility anchor, and actor stays on one accessible plane.
 */
const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

const bounds = (minX, maxX, minY, maxY) => ({ minX, maxX, minY, maxY });
const obstacle = (id, x, y, radius, propId) => ({
  id,
  shape: "circle",
  footprint: { x, y, radius },
  elevation: 0,
  propId,
});
const meshCollider = (id, triangles) => ({ id, triangles });
const triangle = (ax, ay, ae, bx, by, be, cx, cy, ce) => ([
  { x: ax, y: ay, elevation: ae },
  { x: bx, y: by, elevation: be },
  { x: cx, y: cy, elevation: ce },
]);
const waypoint = (id, role, x, y) => ({
  id,
  role,
  placement: { x, y, elevation: 0 },
});
const route = (id, kind, corridorWidth, waypoints) => ({
  id,
  kind,
  corridorWidth,
  waypoints,
});
const landmark = (id, label, x, y, elevation, propId) => ({
  id,
  label,
  placement: { x, y, elevation },
  propId,
});
const prop = (id, modelPath, role, x, y, elevation, yawRadians, footprintRadius, modelNode = null) => ({
  id,
  modelPath,
  ...(modelNode ? { modelNode } : {}),
  role,
  placement: { x, y, elevation, yawRadians },
  footprintRadius,
});
const visibilityAnchor = (id, kind, x, y, radius, sourcePropId = null) => ({
  id,
  kind,
  placement: { x, y, elevation: 0 },
  radius,
  occlusionSafe: true,
  ...(sourcePropId ? { sourcePropId } : {}),
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
const lookout = (id, x, y, elevation, yawRadians, lookAtX, lookAtY, cue, questId, interactionRadius = 720) => ({
  id,
  role: "lookout",
  actorId: "lantern-reaver",
  modelPath: "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb",
  placement: { x, y, elevation, yawRadians },
  questId,
  questRole: "quest-giver",
  questCue: "quest-offer",
  interactionRadius,
  presentationCue: {
    idleClip: "idle",
    posture: "watchful",
    attention: cue,
    lookAt: { x: lookAtX, y: lookAtY },
  },
});
const questPoint = (id, questId, label, order, visualRole, x, y, eventBinding) => ({
  id,
  questId,
  label,
  order,
  visualRole,
  placement: { x, y, elevation: 0 },
  eventBinding,
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
const CINDER_RESOURCES = Object.freeze({
  features: "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-features.glb",
  props: "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-props.glb",
});

const profiles = [
  {
    stageId: "cinder-span",
    sequence: 1,
    name: "Cinder Span",
    // Cycle 10: the walkable ground is now a composed slab floor authored in renderer
    // world coordinates, so fitFootprint resolves to scale 1.0 and the floor lands
    // exactly where worldPointInto puts actors. The retained diorama stays an offline
    // source only -- it was the artifact that earned the earlier ineligible verdict.
    terrainGlbPath: "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span-floor.glb",
    terrainSourceCandidatePath: "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb",
    terrainRuntimeEligible: true,
    gameplay: {
      bounds: bounds(600, 23400, 800, 11200),
      obstacles: [
        obstacle("cinder-span:relay-debris-north", 5000, 10400, 500, "cinder-span:relay-debris-north-prop"),
        obstacle("cinder-span:drowned-forge-arch", 12600, 2800, 850, "cinder-span:forge-arch"),
        obstacle("cinder-span:collapsed-parapet", 13200, 9300, 900, "cinder-span:collapsed-parapet-prop"),
        obstacle("cinder-span:relay-debris-south", 15000, 1500, 540, "cinder-span:relay-debris-south-prop"),
        obstacle("cinder-span:west-ash-wall", 19000, 4400, 940, "cinder-span:west-ash-wall-prop"),
        obstacle("cinder-span:east-ash-wall", 20800, 9900, 700, "cinder-span:east-ash-wall-prop"),
      ],
      surfaces: [],
      meshColliders: [meshCollider("cinder-span:walkable-support", [
        triangle(600, 800, 0, 23400, 800, 0, 23400, 11200, 0),
        triangle(600, 800, 0, 23400, 11200, 0, 600, 11200, 0),
      ])],
      routes: [
        route("cinder-span:critical-route", "critical", 1400, [
          waypoint("cinder-span:ingress", "ingress", 1800, 6000),
          waypoint("cinder-span:cinder-relay-crossing", "intermediate-objective", 14600, 5200),
          waypoint("cinder-span:cinder-forge-stand", "intermediate-gate", 17400, 6400),
          waypoint("cinder-span:final-gate", "final-gate", 22000, 6000),
        ]),
        route("cinder-span:optional-detour", "optional-detour", 900, [
          waypoint("cinder-span:detour-entry", "detour-entry", 6000, 10600),
          waypoint("cinder-span:ash-cache", "detour-objective", 13200, 10700),
          waypoint("cinder-span:detour-exit", "detour-exit", 19600, 10700),
        ]),
      ],
    },
    presentation: {
      palette: { surface: "surface-cinder-ash", contour: "contour-ember", landmark: "landmark-forge", hazard: "hazard-ash", objective: "objective-seal", accent: "#f3592c" },
      atmosphere: { descriptor: "Ash wind combs the bridge blockade.", motif: "embers moving through ash", fogNear: 22.4, fogFar: 50.4 },
      cinematic: { intro: { durationTicks: 90, from: { distance: 6, azimuth: -0.24, polar: -0.34 }, to: { distance: 0, azimuth: 0, polar: 0 } } },
      silhouette: { profile: "jagged-parapet-blockade", primaryAxis: "x", skyline: "low-wide-forge-teeth" },
      camera: { arenaBounds: bounds(900, 23100, 1100, 10900), focus: { x: 13800, y: 6000, elevation: 0 }, readableMargin: 600 },
      landmarks: [
        landmark("landmark.ember-relay-spire", "Ember Relay Spire", 17600, 7400, 0, "cinder-span:seal-brand"),
        landmark("landmark.drowned-forge-arch", "Drowned Forge Arch", 12600, 2800, 0, "cinder-span:forge-arch"),
        landmark("landmark.collapsed-parapet", "Collapsed Parapet", 13200, 9300, 0, "cinder-span:collapsed-parapet-prop"),
        landmark("landmark.ash-wall", "Ash Wall", 19000, 4400, 0, "cinder-span:west-ash-wall-prop"),
        landmark("landmark.cinder-ingress-beacon", "Cinder Ingress Beacon", 3000, 1700, 0, "cinder-span:ingress-beacon-prop"),
        landmark("landmark.cinder-gate-beacon", "Cinder Gate Beacon", 22500, 10100, 0, "cinder-span:gate-beacon-prop"),
      ],
      props: [
        prop("cinder-span:seal-brand", CINDER_RESOURCES.props, "objective-beacon", 17600, 7400, 0, 0, 180, "terrain-cinder-span-prop-006"),
        prop("cinder-span:forge-relic", CINDER_RESOURCES.props, "fog-lantern", 15400, 7400, 0, 1.5708, 140, "terrain-cinder-span-prop-011"),
        prop("cinder-span:forge-arch", CINDER_RESOURCES.features, "arch", 12600, 2800, 0, 0, 850, "terrain-cinder-span-feature-016"),
        prop("cinder-span:collapsed-parapet-prop", CINDER_RESOURCES.features, "wall", 13200, 9300, 0, 1.5708, 900, "terrain-cinder-span-feature-026"),
        prop("cinder-span:west-ash-wall-prop", CINDER_RESOURCES.features, "wall", 19000, 4400, 0, 1.5708, 940, "terrain-cinder-span-feature-005"),
        prop("cinder-span:east-ash-wall-prop", CINDER_RESOURCES.features, "wall", 20800, 9900, 0, 1.5708, 700, "terrain-cinder-span-feature-008"),
        prop("cinder-span:relay-debris-north-prop", CINDER_RESOURCES.props, "debris", 5000, 10400, 0, 0.5, 500, "terrain-cinder-span-prop-033"),
        prop("cinder-span:relay-debris-south-prop", CINDER_RESOURCES.props, "debris", 15000, 1500, 0, -0.4, 540, "terrain-cinder-span-prop-044"),
        prop("cinder-span:ingress-beacon-prop", CINDER_RESOURCES.props, "route-edge-lantern", 3000, 1700, 0, -0.35, 140, "terrain-cinder-span-prop-012"),
        prop("cinder-span:south-forge-teeth-prop", CINDER_RESOURCES.features, "background-forge-teeth", 9000, 1700, 0, 1.5708, 360, "terrain-cinder-span-feature-039"),
        prop("cinder-span:north-ash-talon-prop", CINDER_RESOURCES.props, "background-parapet-talon", 2400, 10100, 0, 0.35, 260, "terrain-cinder-span-prop-030"),
        prop("cinder-span:gate-beacon-prop", CINDER_RESOURCES.props, "route-edge-lantern", 22500, 10100, 0, 2.8, 140, "terrain-cinder-span-prop-014"),
      ],
      visibilityAnchors: [
        visibilityAnchor("cinder-span:relay-light-anchor", "motivated-light", 17600, 7400, 1100, "cinder-span:seal-brand"),
        visibilityAnchor("cinder-span:forge-light-anchor", "motivated-light", 15400, 7400, 900, "cinder-span:forge-relic"),
        visibilityAnchor("cinder-span:ingress-beacon-light", "motivated-light", 3000, 1700, 760, "cinder-span:ingress-beacon-prop"),
        visibilityAnchor("cinder-span:gate-beacon-light", "motivated-light", 22500, 10100, 760, "cinder-span:gate-beacon-prop"),
        visibilityAnchor("cinder-span:central-fog-break", "fog-break", 10800, 6000, 1500),
      ],
      vfxCues: [vfxCue("cinder-span", "cinder-span:ember-wake", "cinder-span-ember-wake", 15400, 6000, 0, 0)],
      npcs: [lookout("cinder-span:ember-lookout", 17100, 2700, 0, 3.1416, 8000, 6000, "watch-western-ingress", "cinder-span:unchain-the-descent")],
      questPoints: [
        questPoint("cinder-span:quest-relay-crossing", "cinder-span:unchain-the-descent", "Ember Relay Crossing", 1, "route-objective", 14600, 5200, { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "cinder-relay-crossing" }),
        questPoint("cinder-span:quest-forge-stand", "cinder-span:unchain-the-descent", "Forge Stand", 2, "route-gate", 17400, 6000, { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "cinder-forge-stand" }),
        questPoint("cinder-span:quest-seal", "cinder-span:unchain-the-descent", "Cinder Seal", 3, "occupation-focus", 17600, 6000, { type: "OCCUPATION_CAPTURED", occupationPointId: "cinder-seal" }),
        questPoint("cinder-span:quest-bind", "cinder-span:unchain-the-descent", "Cinder Bind", 4, "extraction-beacon", 15400, 6000, { type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }),
      ],
    },
    editorial: editorial(1, "Cinder Span", "Hold the ash bridge and learn the first binding route.", "A recoverable Echo answers a successful extraction."),
  },
  {
    stageId: "abyss-chancel",
    sequence: 2,
    name: "Abyss Chancel",
    terrainGlbPath: "assets/mesh/terrain/terrain-abyss-chancel/runtime/terrain/terrain-abyss-chancel-floor.glb",
    terrainSourceCandidatePath: "assets/mesh/terrain/terrain-abyss-chancel/textured-candidate/terrain/terrain-abyss-chancel-textured-cleaned.glb",
    terrainRuntimeEligible: true,
    gameplay: {
      bounds: bounds(600, 23400, 700, 11300),
      obstacles: [
        obstacle("abyss-chancel:oath-apse", 14000, 8750, 880, "abyss-chancel:oath-apse-prop"),
        obstacle("abyss-chancel:nave-seal", 12200, 3150, 820, "abyss-chancel:nave-seal-prop"),
        obstacle("abyss-chancel:west-colonnade", 5200, 2600, 650, "abyss-chancel:west-colonnade-prop"),
        obstacle("abyss-chancel:east-colonnade", 18500, 2600, 650, "abyss-chancel:east-colonnade-prop"),
        obstacle("abyss-chancel:vestry-debris", 6000, 10300, 500, "abyss-chancel:vestry-debris-prop"),
        obstacle("abyss-chancel:apse-wing", 19100, 9400, 650, "abyss-chancel:apse-wing-prop"),
      ],
      surfaces: [],
      meshColliders: [meshCollider("abyss-chancel:walkable-nave", [
        triangle(600, 700, 0, 23400, 700, 0, 23400, 11300, 0),
        triangle(600, 700, 0, 23400, 11300, 0, 600, 11300, 0),
      ])],
      routes: [
        route("abyss-chancel:critical-route", "critical", 1000, [
          waypoint("abyss-chancel:ingress", "ingress", 1800, 6000),
          waypoint("abyss-chancel:chancel-nave-advance", "intermediate-objective", 7200, 4400),
          waypoint("abyss-chancel:chancel-transept-lock", "intermediate-gate", 14200, 6000),
          waypoint("abyss-chancel:final-gate", "final-gate", 22000, 6000),
        ]),
        route("abyss-chancel:optional-detour", "optional-detour", 700, [
          waypoint("abyss-chancel:detour-entry", "detour-entry", 5200, 7600),
          waypoint("abyss-chancel:vestry-cache", "detour-objective", 9000, 10400),
          waypoint("abyss-chancel:detour-exit", "detour-exit", 17800, 10400),
        ]),
      ],
    },
    presentation: {
      palette: { surface: "surface-chancel-abyss", contour: "contour-oath", landmark: "landmark-apse", hazard: "hazard-oath", objective: "objective-oath", accent: "#8f67ff" },
      atmosphere: { descriptor: "The chancel oath bends sight toward its sealed apse.", motif: "oath rings and violet static", fogNear: 24, fogFar: 54 },
      cinematic: { intro: { durationTicks: 96, from: { distance: 6.4, azimuth: 0.3, polar: -0.3 }, to: { distance: 0, azimuth: 0, polar: 0 } } },
      silhouette: { profile: "bent-nave-colonnade", primaryAxis: "x", skyline: "paired-apse-arches" },
      camera: { arenaBounds: bounds(900, 23100, 1000, 11000), focus: { x: 13600, y: 6000, elevation: 0 }, readableMargin: 600 },
      landmarks: [
        landmark("landmark.chancel-apse", "Chancel Apse", 18000, 7600, 0, "abyss-chancel:oath-relic"),
        landmark("landmark.chancel-nave", "Chancel Nave", 12200, 3150, 0, "abyss-chancel:nave-seal-prop"),
        landmark("landmark.west-colonnade", "West Oath Colonnade", 5200, 2600, 0, "abyss-chancel:west-colonnade-prop"),
        landmark("landmark.vestry-wing", "Veiled Vestry", 19100, 9400, 0, "abyss-chancel:apse-wing-prop"),
        landmark("landmark.chancel-processional-lamp", "West Processional Lamp", 2700, 1600, 0, "abyss-chancel:west-processional-lamp-prop"),
        landmark("landmark.chancel-vestry-screen", "Vestry Screen", 2600, 10700, 0, "abyss-chancel:vestry-screen-prop"),
      ],
      props: [
        prop("abyss-chancel:oath-relic", PROPS.relic, "oath-lantern", 18000, 7600, 0, 0.4, 190),
        prop("abyss-chancel:nave-blade", PROPS.blade, "objective-beacon", 12200, 4800, 0, 1.5708, 150),
        prop("abyss-chancel:oath-apse-prop", PROPS.relic, "arch", 14000, 8750, 0, 0, 880),
        prop("abyss-chancel:nave-seal-prop", PROPS.blade, "arch", 12200, 3150, 0, 1.5708, 820),
        prop("abyss-chancel:west-colonnade-prop", PROPS.blade, "wall", 5200, 2600, 0, 0, 650),
        prop("abyss-chancel:east-colonnade-prop", PROPS.blade, "wall", 18500, 2600, 0, 0, 650),
        prop("abyss-chancel:vestry-debris-prop", PROPS.relic, "debris", 6000, 10300, 0, -0.5, 500),
        prop("abyss-chancel:apse-wing-prop", PROPS.relic, "wall", 19100, 9400, 0, 0.5, 650),
        prop("abyss-chancel:west-processional-lamp-prop", PROPS.relic, "processional-lantern", 2700, 1600, 0, -0.2, 140),
        prop("abyss-chancel:south-nave-screen-prop", PROPS.blade, "background-nave-screen", 9400, 1200, 0, 1.5708, 360),
        prop("abyss-chancel:east-processional-lamp-prop", PROPS.relic, "processional-lantern", 22200, 1600, 0, 0.2, 140),
        prop("abyss-chancel:vestry-screen-prop", PROPS.blade, "background-vestry-screen", 2600, 10700, 0, 0, 300),
      ],
      visibilityAnchors: [
        visibilityAnchor("abyss-chancel:apse-light-anchor", "motivated-light", 18000, 7600, 1100, "abyss-chancel:oath-relic"),
        visibilityAnchor("abyss-chancel:nave-light-anchor", "motivated-light", 12200, 4800, 900, "abyss-chancel:nave-blade"),
        visibilityAnchor("abyss-chancel:west-processional-light", "motivated-light", 2700, 1600, 720, "abyss-chancel:west-processional-lamp-prop"),
        visibilityAnchor("abyss-chancel:east-processional-light", "motivated-light", 22200, 1600, 720, "abyss-chancel:east-processional-lamp-prop"),
        visibilityAnchor("abyss-chancel:nave-fog-break", "fog-break", 15000, 6000, 1500),
      ],
      vfxCues: [vfxCue("abyss-chancel", "abyss-chancel:mirror-static", "abyss-chancel-mirror-static", 14200, 6000, 0, 0)],
      npcs: [lookout("abyss-chancel:veil-lookout", 17300, 7850, 0, 3.1416, 9000, 6000, "watch-the-apse", "abyss-chancel:refuse-repeated-answer")],
      questPoints: [
        questPoint("abyss-chancel:quest-nave-advance", "abyss-chancel:refuse-repeated-answer", "Nave Advance", 1, "route-objective", 15000, 6000, { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "chancel-nave-advance" }),
        questPoint("abyss-chancel:quest-transept-lock", "abyss-chancel:refuse-repeated-answer", "Transept Lock", 2, "route-gate", 17600, 8200, { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "chancel-transept-lock" }),
        questPoint("abyss-chancel:quest-oath", "abyss-chancel:refuse-repeated-answer", "Chancel Oath", 3, "occupation-focus", 18200, 5200, { type: "OCCUPATION_CAPTURED", occupationPointId: "chancel-oath" }),
        questPoint("abyss-chancel:quest-bind", "abyss-chancel:refuse-repeated-answer", "Chancel Bind", 4, "extraction-beacon", 16000, 7000, { type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }),
      ],
    },
    editorial: editorial(2, "Abyss Chancel", "Break the oath rings before the tactician closes the nave.", "The second binding changes the squad's reach."),
  },
  {
    stageId: "echo-throne",
    sequence: 3,
    name: "Echo Throne",
    terrainGlbPath: "assets/mesh/terrain/terrain-echo-throne/runtime/terrain/terrain-echo-throne-floor.glb",
    terrainSourceCandidatePath: "assets/mesh/terrain/terrain-echo-throne/textured-candidate/terrain/terrain-echo-throne-textured.glb",
    terrainRuntimeEligible: true,
    gameplay: {
      bounds: bounds(600, 23400, 600, 11400),
      obstacles: [
        obstacle("echo-throne:fractured-dais", 15400, 8600, 900, "echo-throne:fractured-dais-prop"),
        obstacle("echo-throne:echo-aisle", 11800, 3000, 800, "echo-throne:echo-aisle-prop"),
        obstacle("echo-throne:west-fractured-wing", 5400, 9000, 650, "echo-throne:west-fractured-wing-prop"),
        obstacle("echo-throne:east-fractured-wing", 19000, 9000, 650, "echo-throne:east-fractured-wing-prop"),
        obstacle("echo-throne:gallery-debris", 6200, 1200, 500, "echo-throne:gallery-debris-prop"),
        obstacle("echo-throne:crown-shard", 19400, 2400, 600, "echo-throne:crown-shard-prop"),
      ],
      surfaces: [],
      meshColliders: [meshCollider("echo-throne:walkable-court", [
        triangle(600, 600, 0, 23400, 600, 0, 23400, 11400, 0),
        triangle(600, 600, 0, 23400, 11400, 0, 600, 11400, 0),
      ])],
      routes: [
        route("echo-throne:critical-route", "critical", 1100, [
          waypoint("echo-throne:ingress", "ingress", 1800, 6000),
          waypoint("echo-throne:throne-aisle-break", "intermediate-objective", 7600, 6000),
          waypoint("echo-throne:throne-dais-stand", "intermediate-gate", 13800, 6000),
          waypoint("echo-throne:final-gate", "final-gate", 22000, 6000),
        ]),
        route("echo-throne:optional-detour", "optional-detour", 700, [
          waypoint("echo-throne:detour-entry", "detour-entry", 5600, 4400),
          waypoint("echo-throne:gallery-cache", "detour-objective", 9000, 1600),
          waypoint("echo-throne:detour-exit", "detour-exit", 17200, 1600),
        ]),
      ],
    },
    presentation: {
      palette: { surface: "surface-throne-stone", contour: "contour-echo", landmark: "landmark-dais", hazard: "hazard-rift", objective: "objective-domain", accent: "#72c8ff" },
      atmosphere: { descriptor: "A fractured throne court repeats every strike across its aisle.", motif: "echo fractures and cold blue glass", fogNear: 23, fogFar: 55 },
      cinematic: { intro: { durationTicks: 102, from: { distance: 6.8, azimuth: -0.4, polar: -0.28 }, to: { distance: 0, azimuth: 0, polar: 0 } } },
      silhouette: { profile: "axial-crescent-court", primaryAxis: "x", skyline: "shattered-dais-crown" },
      camera: { arenaBounds: bounds(900, 23100, 900, 11100), focus: { x: 14200, y: 6000, elevation: 0 }, readableMargin: 600 },
      landmarks: [
        landmark("landmark.throne-dais", "Fractured Throne Dais", 18200, 7200, 0, "echo-throne:dais-relic"),
        landmark("landmark.throne-aisle", "Echo Aisle", 11800, 3000, 0, "echo-throne:echo-aisle-prop"),
        landmark("landmark.fractured-wing", "Fractured Court Wing", 19000, 9000, 0, "echo-throne:east-fractured-wing-prop"),
        landmark("landmark.crown-shard", "Sovereign Crown Shard", 19400, 2400, 0, "echo-throne:crown-shard-prop"),
        landmark("landmark.echo-west-crown-light", "West Crown Light", 2700, 10500, 0, "echo-throne:west-crown-light-prop"),
        landmark("landmark.echo-court-crescent", "Echo Court Crescent", 10400, 10800, 0, "echo-throne:court-crescent-prop"),
      ],
      props: [
        prop("echo-throne:dais-relic", PROPS.relic, "throne-lantern", 18200, 7200, 0, 0, 190),
        prop("echo-throne:aisle-blade", PROPS.blade, "objective-beacon", 11800, 4400, 0, 1.5708, 150),
        prop("echo-throne:fractured-dais-prop", PROPS.relic, "arch", 15400, 8600, 0, 0, 900),
        prop("echo-throne:echo-aisle-prop", PROPS.blade, "arch", 11800, 3000, 0, 1.5708, 800),
        prop("echo-throne:west-fractured-wing-prop", PROPS.blade, "wall", 5400, 9000, 0, -0.5, 650),
        prop("echo-throne:east-fractured-wing-prop", PROPS.blade, "wall", 19000, 9000, 0, 0.5, 650),
        prop("echo-throne:gallery-debris-prop", PROPS.relic, "debris", 6200, 1200, 0, 0.4, 500),
        prop("echo-throne:crown-shard-prop", PROPS.relic, "debris", 19400, 2400, 0, -0.4, 600),
        prop("echo-throne:west-crown-light-prop", PROPS.relic, "crown-lantern", 2700, 10500, 0, -0.6, 140),
        prop("echo-throne:court-crescent-prop", PROPS.blade, "background-court-crescent", 10400, 10800, 0, 0, 380),
        prop("echo-throne:east-crown-light-prop", PROPS.relic, "crown-lantern", 22200, 10500, 0, 0.6, 140),
        prop("echo-throne:south-gallery-shard-prop", PROPS.blade, "background-gallery-shard", 2800, 1200, 0, 1.1, 300),
      ],
      visibilityAnchors: [
        visibilityAnchor("echo-throne:dais-light-anchor", "motivated-light", 18200, 7200, 1100, "echo-throne:dais-relic"),
        visibilityAnchor("echo-throne:aisle-light-anchor", "motivated-light", 11800, 4400, 900, "echo-throne:aisle-blade"),
        visibilityAnchor("echo-throne:west-crown-light", "motivated-light", 2700, 10500, 780, "echo-throne:west-crown-light-prop"),
        visibilityAnchor("echo-throne:east-crown-light", "motivated-light", 22200, 10500, 780, "echo-throne:east-crown-light-prop"),
        visibilityAnchor("echo-throne:court-fog-break", "fog-break", 14800, 6000, 1600),
      ],
      vfxCues: [vfxCue("echo-throne", "echo-throne:fracture-echo", "echo-throne-fracture-echo", 15400, 6000, 0, 0)],
      npcs: [lookout("echo-throne:throne-lookout", 17800, 8100, 0, 3.1416, 9200, 6000, "watch-the-court", "echo-throne:break-the-command")],
      questPoints: [
        questPoint("echo-throne:quest-aisle-break", "echo-throne:break-the-command", "Aisle Break", 1, "route-objective", 15200, 6000, { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "throne-aisle-break" }),
        questPoint("echo-throne:quest-dais-stand", "echo-throne:break-the-command", "Dais Stand", 2, "route-gate", 18000, 6000, { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "throne-dais-stand" }),
        questPoint("echo-throne:quest-domain", "echo-throne:break-the-command", "Throne Domain", 3, "occupation-focus", 18400, 6000, { type: "OCCUPATION_CAPTURED", occupationPointId: "throne-domain" }),
        questPoint("echo-throne:quest-bind", "echo-throne:break-the-command", "Throne Bind", 4, "extraction-beacon", 16200, 7600, { type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }),
      ],
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
const pointSegmentDistance = (point, start, end) => {
  const spanX = end.x - start.x;
  const spanY = end.y - start.y;
  const spanSquared = spanX * spanX + spanY * spanY;
  const amount = spanSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * spanX + (point.y - start.y) * spanY) / spanSquared));
  return Math.hypot(point.x - (start.x + spanX * amount), point.y - (start.y + spanY * amount));
};

const validateProfile = (profile) => {
  const { minX, maxX, minY, maxY } = profile.gameplay.bounds;
  assertFiniteNumbers(profile, profile.stageId);
  if (!(inside(minX, 0, ARENA.width) && inside(maxX, 0, ARENA.width) && minX < maxX
    && inside(minY, 0, ARENA.height) && inside(maxY, 0, ARENA.height) && minY < maxY)) throw new Error(`Invalid walkable bounds for stage world: ${profile.stageId}`);
  if (ARENA.gateX - 900 < minX || ARENA.gateX + 900 > maxX || ARENA.gateY - 900 < minY || ARENA.gateY + 900 > maxY) throw new Error(`Stage world excludes canonical gate geometry: ${profile.stageId}`);
  const hasRuntimeTerrain = typeof profile.terrainGlbPath === "string" && profile.terrainGlbPath.length > 0;
  const usesPromotedTerrain = profile.terrainRuntimeEligible === true;
  const hasProceduralFallback = profile.terrainFallback?.kind === "procedural-flat-support";
  const candidatePath = profile.terrainSourceCandidatePath;
  if (usesPromotedTerrain !== hasRuntimeTerrain || usesPromotedTerrain === hasProceduralFallback) throw new Error(`Stage terrain requires one eligible runtime strategy: ${profile.stageId}`);
  if (usesPromotedTerrain && (!profile.terrainGlbPath.startsWith("assets/mesh/terrain/")
    || !profile.terrainGlbPath.includes("/runtime/")
    || profile.terrainGlbPath.includes("/textured-candidate/"))) throw new Error(`Stage terrain must use a promoted runtime mesh: ${profile.stageId}`);
  if (hasProceduralFallback && (typeof profile.terrainFallback.reason !== "string"
    || profile.terrainFallback.reason.length === 0
    || typeof candidatePath !== "string"
    || !candidatePath.startsWith("assets/mesh/terrain/"))) throw new Error(`Procedural terrain fallback requires an ineligible retained candidate: ${profile.stageId}`);

  const ids = new Set();
  const claimId = (entry) => {
    if (!entry.id || ids.has(entry.id)) throw new Error(`Duplicate or missing world id in ${profile.stageId}: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.id.startsWith(`${profile.stageId}:`) && !entry.id.startsWith("landmark.")) throw new Error(`World id must be stage-scoped: ${entry.id}`);
  };
  const pointInside = ({ x, y }) => inside(x, minX, maxX) && inside(y, minY, maxY);

  profile.gameplay.obstacles.forEach((entry) => {
    claimId(entry);
    const { x, y, radius } = entry.footprint;
    if (!(radius > 0 && entry.elevation === 0 && typeof entry.propId === "string"
      && inside(x - radius, minX, maxX) && inside(x + radius, minX, maxX)
      && inside(y - radius, minY, maxY) && inside(y + radius, minY, maxY))) throw new Error(`Obstacle footprint leaves walkable bounds: ${entry.id}`);
    if (Math.hypot(x - ARENA.gateX, y - ARENA.gateY) < radius + 900) throw new Error(`Obstacle blocks canonical gate geometry: ${entry.id}`);
  });
  if (!Array.isArray(profile.gameplay.surfaces) || profile.gameplay.surfaces.length !== 0) throw new Error(`Stage world must keep one flat accessible movement plane: ${profile.stageId}`);

  const meshColliders = profile.gameplay.meshColliders ?? [];
  if (!Array.isArray(meshColliders) || meshColliders.length !== 1) throw new Error(`Stage world requires one authored flat support mesh: ${profile.stageId}`);
  meshColliders.forEach((collider) => {
    claimId(collider);
    if (!Array.isArray(collider.triangles) || collider.triangles.length === 0) throw new Error(`Mesh collider requires triangles: ${collider.id}`);
    collider.triangles.forEach((vertices, index) => {
      if (!Array.isArray(vertices) || vertices.length !== 3) throw new Error(`Mesh collider triangle must have three vertices: ${collider.id}[${index}]`);
      const validVertex = (vertex) => vertex && inside(vertex.x, minX, maxX) && inside(vertex.y, minY, maxY) && vertex.elevation === 0;
      if (!vertices.every(validVertex)) throw new Error(`Invalid flat mesh collider triangle: ${collider.id}[${index}]`);
      const [first, second, third] = vertices;
      const area = (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
      if (!Number.isFinite(area) || area === 0) throw new Error(`Degenerate mesh collider triangle: ${collider.id}[${index}]`);
    });
  });

  const routes = profile.gameplay.routes ?? [];
  if (!Array.isArray(routes) || routes.filter(({ kind }) => kind === "critical").length !== 1
    || routes.filter(({ kind }) => kind === "optional-detour").length < 1) throw new Error(`Stage world requires one critical route and an optional detour: ${profile.stageId}`);
  routes.forEach((entry) => {
    claimId(entry);
    if (!(entry.corridorWidth >= 600 && Array.isArray(entry.waypoints) && entry.waypoints.length >= 3)) throw new Error(`Invalid navigable corridor: ${entry.id}`);
    const inset = entry.corridorWidth / 2;
    entry.waypoints.forEach((point) => {
      claimId(point);
      const placement = point.placement;
      if (!(placement.elevation === 0 && inside(placement.x, minX + inset, maxX - inset)
        && inside(placement.y, minY + inset, maxY - inset))) throw new Error(`Route waypoint leaves its navigable corridor: ${point.id}`);
    });
  });
  const criticalRoute = routes.find(({ kind }) => kind === "critical");
  if (criticalRoute.waypoints.filter(({ role }) => role.startsWith("intermediate-")).length < 2) throw new Error(`Critical route requires two intermediate waypoints: ${profile.stageId}`);
  const finalGate = criticalRoute.waypoints.find(({ role }) => role === "final-gate")?.placement;
  if (!finalGate || finalGate.x !== ARENA.gateX || finalGate.y !== ARENA.gateY) throw new Error(`Critical route must terminate at the canonical gate: ${profile.stageId}`);
  routes.forEach((authoredRoute) => {
    for (let index = 1; index < authoredRoute.waypoints.length; index += 1) {
      const start = authoredRoute.waypoints[index - 1].placement;
      const end = authoredRoute.waypoints[index].placement;
      for (const entry of profile.gameplay.obstacles) {
        if (pointSegmentDistance(entry.footprint, start, end) < entry.footprint.radius + authoredRoute.corridorWidth / 2) throw new Error(`Obstacle blocks authored route ${authoredRoute.id}: ${entry.id}`);
      }
    }
  });

  for (const entry of [...profile.presentation.props, ...(profile.presentation.visibilityAnchors ?? []),
    ...(profile.presentation.vfxCues ?? []), ...profile.presentation.npcs,
    ...(profile.presentation.questPoints ?? []), ...profile.presentation.landmarks]) claimId(entry);
  const props = profile.presentation.props;
  if (props.length < 8 || props.length > 14 || props.some(({ modelPath, placement, footprintRadius }) => !modelPath.startsWith("assets/mesh/")
    || placement.elevation !== 0 || !pointInside(placement) || !(footprintRadius > 0))) throw new Error(`Stage props must be sparse, flat, retained placements: ${profile.stageId}`);
  const propById = new Map(props.map((entry) => [entry.id, entry]));
  profile.gameplay.obstacles.forEach((entry) => {
    const source = propById.get(entry.propId);
    if (!source || source.placement.x !== entry.footprint.x || source.placement.y !== entry.footprint.y
      || source.footprintRadius !== entry.footprint.radius) throw new Error(`Obstacle requires matching visible geometry: ${entry.id}`);
  });
  routes.forEach((authoredRoute) => {
    for (let index = 1; index < authoredRoute.waypoints.length; index += 1) {
      const start = authoredRoute.waypoints[index - 1].placement;
      const end = authoredRoute.waypoints[index].placement;
      for (const entry of props) {
        if (pointSegmentDistance(entry.placement, start, end) < entry.footprintRadius + authoredRoute.corridorWidth / 2) throw new Error(`Prop blocks authored route ${authoredRoute.id}: ${entry.id}`);
      }
    }
  });
  for (let leftIndex = 0; leftIndex < props.length; leftIndex += 1) {
    const left = props[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < props.length; rightIndex += 1) {
      const right = props[rightIndex];
      if (Math.hypot(left.placement.x - right.placement.x, left.placement.y - right.placement.y)
        < left.footprintRadius + right.footprintRadius) throw new Error(`Stage prop instances overlap: ${left.id}, ${right.id}`);
    }
  }

  const propIds = new Set(props.map(({ id }) => id));
  if (profile.presentation.landmarks.length < 4 || profile.presentation.landmarks.some(({ propId, placement }) => !propIds.has(propId)
    || placement.elevation !== 0 || !pointInside(placement))) throw new Error(`Landmark requires a flat stage prop: ${profile.stageId}`);
  const camera = profile.presentation.camera;
  const cameraBounds = camera?.arenaBounds;
  if (!cameraBounds || !(inside(cameraBounds.minX, minX, maxX) && inside(cameraBounds.maxX, minX, maxX)
    && cameraBounds.minX < cameraBounds.maxX && inside(cameraBounds.minY, minY, maxY)
    && inside(cameraBounds.maxY, minY, maxY) && cameraBounds.minY < cameraBounds.maxY
    && pointInside(camera.focus) && camera.focus.elevation === 0 && camera.readableMargin >= 400)) throw new Error(`Invalid camera-readable arena bounds: ${profile.stageId}`);
  const visibilityAnchors = profile.presentation.visibilityAnchors ?? [];
  if (visibilityAnchors.filter(({ kind }) => kind === "motivated-light").length < 2
    || visibilityAnchors.filter(({ kind }) => kind === "fog-break").length < 1
    || visibilityAnchors.some((entry) => !["motivated-light", "fog-break"].includes(entry.kind)
      || entry.occlusionSafe !== true || entry.placement.elevation !== 0 || !pointInside(entry.placement) || !(entry.radius > 0)
      || profile.gameplay.obstacles.some(({ footprint }) => Math.hypot(
        entry.placement.x - footprint.x,
        entry.placement.y - footprint.y,
      ) < footprint.radius + 300)
      || (entry.kind === "motivated-light" && !propIds.has(entry.sourcePropId)))) throw new Error(`Invalid occlusion-safe visibility anchors: ${profile.stageId}`);
  visibilityAnchors.filter(({ kind }) => kind === "motivated-light").forEach((entry) => {
    const source = propById.get(entry.sourcePropId);
    if (source.placement.x !== entry.placement.x || source.placement.y !== entry.placement.y) throw new Error(`Motivated light must remain attached to its visible emitter: ${entry.id}`);
  });
  if (profile.presentation.vfxCues.some((entry) => entry.modelPath !== `assets/motion/stage-vfx/${entry.effectId}.glb` || entry.clip !== `stage-vfx::${profile.stageId}::loop::v01`)) throw new Error(`Invalid stage VFX cue: ${profile.stageId}`);
  if (profile.presentation.npcs.some(({ modelPath, placement }) => modelPath !== "assets/mesh/character/lantern-reaver-character/glb/base_basic_pbr.glb"
    || placement.elevation !== 0 || !pointInside(placement))) throw new Error(`Stage NPC must use a flat Lantern Reaver placement: ${profile.stageId}`);
  const questGivers = profile.presentation.npcs.filter(({ questRole }) => questRole === "quest-giver");
  if (questGivers.length !== 1) throw new Error(`Stage world requires exactly one quest giver: ${profile.stageId}`);
  const [questGiver] = questGivers;
  if (typeof questGiver.questId !== "string" || !questGiver.questId.startsWith(`${profile.stageId}:`)
    || questGiver.questCue !== "quest-offer" || !(questGiver.interactionRadius > 0)) throw new Error(`Invalid quest giver metadata: ${questGiver.id}`);
  const questPoints = profile.presentation.questPoints ?? [];
  if (!Array.isArray(questPoints) || questPoints.length !== 4) throw new Error(`Stage world requires exactly four quest points: ${profile.stageId}`);
  const encounterRoute = STAGE_ENCOUNTER_ROUTES[profile.stageId];
  const tactics = STAGE_TACTICS[profile.stageId];
  const [firstEncounterObjective, secondEncounterObjective] = encounterRoute?.objectives ?? [];
  const expectedQuestPoints = [
    {
      point: firstEncounterObjective?.point,
      visualRole: "route-objective",
      eventBinding: { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: firstEncounterObjective?.id },
    },
    {
      point: secondEncounterObjective?.point,
      visualRole: "route-gate",
      eventBinding: { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: secondEncounterObjective?.id },
    },
    {
      point: tactics?.occupation,
      visualRole: "occupation-focus",
      eventBinding: { type: "OCCUPATION_CAPTURED", occupationPointId: tactics?.occupation?.id },
    },
    {
      point: tactics?.extraction,
      visualRole: "extraction-beacon",
      eventBinding: { type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" },
    },
  ];
  if (new Set(questPoints.map(({ visualRole }) => visualRole)).size !== questPoints.length
    || new Set(questPoints.map(({ placement }) => `${placement.x}:${placement.y}`)).size !== questPoints.length) throw new Error(`Quest points require distinct visual roles and placements: ${profile.stageId}`);
  questPoints.forEach((entry, index) => {
    const expected = expectedQuestPoints[index];
    if (!expected?.point || entry.questId !== questGiver.questId || typeof entry.label !== "string" || entry.label.length === 0
      || entry.order !== index + 1 || entry.visualRole !== expected.visualRole
      || entry.placement.elevation !== 0 || !pointInside(entry.placement)
      || entry.placement.x !== expected.point.x || entry.placement.y !== expected.point.y
      || Object.keys(entry.eventBinding ?? {}).length !== Object.keys(expected.eventBinding).length
      || Object.entries(expected.eventBinding).some(([key, value]) => entry.eventBinding?.[key] !== value)) throw new Error(`Invalid ordered quest point: ${entry.id}`);
  });
  const intro = profile.presentation.cinematic?.intro;
  if (!intro || !Number.isInteger(intro.durationTicks) || intro.durationTicks <= 0 || intro.durationTicks > 300) throw new Error(`Invalid cinematic profile: ${profile.stageId}`);
};

const canonicalStageIds = STAGES.map(({ id }) => id);
if (profiles.length !== canonicalStageIds.length || new Set(profiles.map(({ stageId }) => stageId)).size !== canonicalStageIds.length || canonicalStageIds.some((stageId) => !Object.hasOwn(byId, stageId)) || Object.keys(byId).some((stageId) => !canonicalStageIds.includes(stageId))) throw new Error("Stage world catalog must cover every canonical stage exactly once.");
if (new Set(profiles.map(({ presentation }) => presentation.silhouette?.profile)).size !== profiles.length) throw new Error("Each stage world requires a distinct silhouette profile.");
profiles.forEach(validateProfile);

export const STAGE_WORLD_PROFILES = freeze(byId);
export const STAGE_SHOWCASE_IDS = freeze(profiles.sort((left, right) => left.editorial.order - right.editorial.order).map(({ stageId }) => stageId));
if (STAGE_SHOWCASE_IDS.length !== 3) throw new Error("Stage world catalog must expose exactly three editorial showcases.");

/** Returns the canonical frozen profile for a stage id, or null when unknown. */
export function stageWorldFor(stageId) {
  return typeof stageId === "string" ? (STAGE_WORLD_PROFILES[stageId] ?? null) : null;
}
