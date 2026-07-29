import { ARENA, STAGES } from "./defense-catalog.js";

/**
 * Immutable world-composition data shared by simulation and presentation.
 *
 * Coordinates use the canonical 24000 x 12000 simulation arena. This module
 * intentionally contains no collision or elevation-resolution behavior: it
 * only describes authored geometry and presentation cues.
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
const lookout = (id, actorId, modelPath, x, y, elevation, yawRadians, lookAtX, lookAtY, cue) => ({
  id,
  role: "lookout",
  actorId,
  modelPath,
  placement: { x, y, elevation, yawRadians },
  presentationCue: {
    idleClip: "idle",
    posture: "watchful",
    attention: cue,
    lookAt: { x: lookAtX, y: lookAtY },
  },
});
const editorial = (showcase, order, title, summary, rewardHint) => ({
  showcase,
  order,
  spoilerSafe: {
    title,
    status: "available-when-unlocked",
    summary,
    rewardHint,
  },
});

const profiles = [
  {
    stageId: "cinder-span",
    sequence: 1,
    name: "Cinder Span",
    terrainGlbPath: "assets/images/battle/glb/terrain/cinder-span.glb",
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
      meshColliders: [
        meshCollider("cinder-span:walkable-support", [
          triangle(600, 800, 0, 23400, 800, 0, 23400, 11200, 0),
          triangle(600, 800, 0, 23400, 11200, 0, 600, 11200, 0),
          triangle(15000, 2100, 0, 16600, 2100, 420, 16600, 3300, 420),
          triangle(15000, 2100, 0, 16600, 3300, 420, 15000, 3300, 0),
          triangle(16600, 1900, 420, 17900, 1900, 420, 17900, 3400, 420),
          triangle(16600, 1900, 420, 17900, 3400, 420, 16600, 3400, 420),
        ]),
      ],
    },
    presentation: {
      palette: { surface: "surface-cinder-ash", contour: "contour-ember", landmark: "landmark-forge", hazard: "hazard-ash", objective: "objective-seal", accent: "#f3592c" },
      atmosphere: { descriptor: "Ash wind combs the bridge blockade.", motif: "embers moving through ash", fogNear: 22.4, fogFar: 50.4 },
      cinematic: {
        intro: {
          durationTicks: 90,
          from: { distance: 6, azimuth: -0.24, polar: -0.34 },
          to: { distance: 0, azimuth: 0, polar: 0 },
        },
      },
      landmarks: [
        landmark("landmark.ember-relay-spire", "Ember Relay Spire", 17600, 6000, 0, "cinder-span:seal-brand"),
        landmark("landmark.drowned-forge-arch", "Drowned Forge Arch", 12600, 2800, 0, "cinder-span:forge-lantern"),
      ],
      props: [
        prop("cinder-span:seal-brand", "assets/images/battle/glb/props/bulwark-brand.glb", "gate-choke", 17600, 6000, 0, 0, 180),
        prop("cinder-span:forge-lantern", "assets/images/battle/glb/props/warden-lantern.glb", "extraction-beacon", 15400, 6000, 0, 1.5708, 140),
      ],
      npcs: [
        lookout("cinder-span:ember-lookout", "ember-cohort", "assets/images/battle/glb/companions/ember-cohort.glb", 17100, 2700, 420, 3.1416, 8000, 6000, "watch-western-ingress"),
      ],
    },
    editorial: editorial(true, 1, "Cinder Span", "Hold the ash bridge and learn the first binding route.", "A recoverable Echo answers a successful extraction."),
  },
  {
    stageId: "veil-citadel",
    sequence: 2,
    name: "Veil Citadel",
    terrainGlbPath: "assets/images/battle/glb/terrain/veil-citadel.glb",
    gameplay: {
      bounds: bounds(600, 23400, 600, 11400),
      obstacles: [
        obstacle("veil-citadel:north-mirror-pylon", 13600, 8800, 760),
        obstacle("veil-citadel:south-mirror-pylon", 14200, 2400, 760),
      ],
      surfaces: [
        surface("veil-citadel:rampart-ramp", "ramp", 15400, 16900, 2300, 3600, "x", 0, 480),
        surface("veil-citadel:rampart-platform", "platform", 16900, 18300, 2100, 3800, "x", 480, 480),
      ],
    },
    presentation: {
      palette: { surface: "surface-veil-stone", contour: "contour-veil", landmark: "landmark-rampart", hazard: "hazard-static", objective: "objective-signal", accent: "#2cadd6" },
      atmosphere: { descriptor: "The citadel veil consumes signal and sight.", motif: "mirror light and static", fogNear: 21, fogFar: 47.6 },
      landmarks: [
        landmark("landmark.veil-rampart", "Veil Rampart", 17600, 2900, 480, "veil-citadel:signal-banner"),
        landmark("landmark.veil-twins", "Twin Veils", 18000, 4200, 0, "veil-citadel:bind-hourglass"),
      ],
      props: [
        prop("veil-citadel:signal-banner", "assets/images/battle/glb/props/abyssal-banner.glb", "elevation-signal", 17600, 2900, 480, 0, 160),
        prop("veil-citadel:bind-hourglass", "assets/images/battle/glb/props/stillwater-hourglass.glb", "extraction-beacon", 15800, 3400, 0, 0.7854, 140),
      ],
      npcs: [
        lookout("veil-citadel:rift-lookout", "rift-lens", "assets/images/battle/glb/companions/rift-lens.glb", 17400, 2900, 480, 3.1416, 8400, 3000, "scan-through-the-veil"),
      ],
    },
    editorial: editorial(true, 2, "Veil Citadel", "Break the mirror-static sightline without surrendering the signal.", "A bound scout can turn the veil into allied range."),
  },
  {
    stageId: "echo-throne",
    sequence: 3,
    name: "Echo Throne",
    terrainGlbPath: "assets/images/battle/glb/terrain/echo-throne-steps.glb",
    gameplay: {
      bounds: bounds(800, 23400, 700, 11300),
      obstacles: [
        obstacle("echo-throne:broken-column-north", 14600, 2600, 820),
        obstacle("echo-throne:broken-column-south", 14600, 9400, 820),
      ],
      surfaces: [
        surface("echo-throne:dais-ramp", "ramp", 16600, 18100, 5200, 6800, "x", 0, 520),
        surface("echo-throne:dais-platform", "platform", 18100, 19600, 4800, 7200, "x", 520, 520),
      ],
    },
    presentation: {
      palette: { surface: "surface-throne-stone", contour: "contour-echo", landmark: "landmark-dais", hazard: "hazard-rift", objective: "objective-domain", accent: "#3c2c5b" },
      atmosphere: { descriptor: "A moonless court echoes along the throne aisle.", motif: "echoes and fractures", fogNear: 19.6, fogFar: 42 },
      landmarks: [
        landmark("landmark.throne-beacon", "Tide-Lock Beacon", 18600, 6000, 520, "echo-throne:tide-lock-beacon"),
        landmark("landmark.throne-aisle", "Throne Aisle", 16200, 7600, 0, "echo-throne:aisle-lantern"),
      ],
      props: [
        prop("echo-throne:tide-lock-beacon", "assets/images/battle/glb/props/tide-lock-beacon-rodin.glb", "throne-beacon", 18600, 6000, 520, 0, 170),
        prop("echo-throne:aisle-lantern", "assets/images/battle/glb/props/warden-lantern.glb", "extraction-beacon", 16200, 7600, 0, -0.7854, 140),
      ],
      npcs: [
        lookout("echo-throne:throne-lookout", "throne-echo", "assets/images/battle/glb/companions/throne-echo.glb", 18900, 6500, 520, 3.1416, 9200, 6000, "listen-down-the-throne-aisle"),
      ],
    },
    editorial: editorial(true, 3, "Echo Throne", "Climb the court steps and bind the domain before it answers.", "The court yields an Echo suited to disciplined formations."),
  },
  {
    stageId: "sunken-bastion",
    sequence: 4,
    name: "Sunken Bastion",
    terrainGlbPath: "assets/images/battle/glb/terrain/sunken-bastion.glb",
    gameplay: {
      bounds: bounds(700, 23400, 700, 11300),
      obstacles: [
        obstacle("sunken-bastion:north-anchor-post", 13600, 3000, 840),
        obstacle("sunken-bastion:south-anchor-post", 14000, 9100, 840),
      ],
      surfaces: [
        surface("sunken-bastion:anchor-ramp", "ramp", 15800, 17300, 2100, 3500, "x", 0, 360),
        surface("sunken-bastion:anchor-platform", "platform", 17300, 18700, 1900, 3700, "x", 360, 360),
      ],
    },
    presentation: {
      palette: { surface: "surface-bastion-flood", contour: "contour-tide", landmark: "landmark-anchor", hazard: "hazard-flood", objective: "objective-pump", accent: "#258f9e" },
      atmosphere: { descriptor: "Tide pushes through the flooded bastion gates.", motif: "flood lines and anchor resonance", fogNear: 21, fogFar: 46.2 },
      landmarks: [
        landmark("landmark.bastion-anchor", "Bastion Anchor", 18000, 2800, 360, "sunken-bastion:anchor-brand"),
        landmark("landmark.bastion-floodgate", "Floodgate", 17800, 7600, 0, "sunken-bastion:pump-lantern"),
      ],
      props: [
        prop("sunken-bastion:anchor-brand", "assets/images/battle/glb/props/bulwark-brand.glb", "anchor-focus", 18000, 2800, 360, 0, 180),
        prop("sunken-bastion:pump-lantern", "assets/images/battle/glb/props/warden-lantern.glb", "pump-beacon", 17800, 7600, 0, 1.5708, 140),
      ],
      npcs: [
        lookout("sunken-bastion:anchor-lookout", "anchor-shard", "assets/images/battle/glb/companions/anchor-shard.glb", 17800, 3000, 360, 3.1416, 8600, 7600, "track-the-rising-tide"),
      ],
    },
    editorial: editorial(false, 0, "Sunken Bastion", "A flooded defense line waits beyond the known court.", "Secure the route to reveal its recoverable Echo."),
  },
  {
    stageId: "howling-sprawl",
    sequence: 5,
    name: "Howling Sprawl",
    terrainGlbPath: "assets/images/battle/glb/terrain/howling-sprawl.glb",
    gameplay: {
      bounds: bounds(500, 23400, 500, 11500),
      obstacles: [
        obstacle("howling-sprawl:north-windrock", 13200, 2500, 920),
        obstacle("howling-sprawl:south-windrock", 13900, 8800, 820),
        obstacle("howling-sprawl:center-windrock", 15400, 7600, 620),
      ],
      surfaces: [
        surface("howling-sprawl:ridge-ramp", "ramp", 15000, 16700, 1600, 3000, "x", 0, 300),
        surface("howling-sprawl:ridge-platform", "platform", 16700, 18100, 1400, 3200, "x", 300, 300),
      ],
    },
    presentation: {
      palette: { surface: "surface-sprawl-dust", contour: "contour-wind", landmark: "landmark-ridge", hazard: "hazard-gust", objective: "objective-beacon", accent: "#c5a56a" },
      atmosphere: { descriptor: "Crosswinds tear open the wasteland flank.", motif: "crosswind and ridge hollows", fogNear: 28, fogFar: 61.6 },
      landmarks: [
        landmark("landmark.sprawl-ridge", "Sprawl Ridge", 17400, 2400, 300, "howling-sprawl:ridge-banner"),
        landmark("landmark.sprawl-funnel", "Wind Funnel", 15000, 5000, 0, "howling-sprawl:funnel-lantern"),
      ],
      props: [
        prop("howling-sprawl:ridge-banner", "assets/images/battle/glb/props/abyssal-banner.glb", "ridge-marker", 17400, 2400, 300, 0, 160),
        prop("howling-sprawl:funnel-lantern", "assets/images/battle/glb/props/warden-lantern.glb", "crosswind-marker", 15000, 5000, 0, 1.5708, 140),
      ],
      npcs: [
        lookout("howling-sprawl:pack-lookout", "pack-warden", "assets/images/battle/glb/companions/pack-warden.glb", 17300, 2550, 300, 3.1416, 7600, 5000, "read-the-crosswind"),
      ],
    },
    editorial: editorial(false, 0, "Howling Sprawl", "A wind-cut approach opens after the bastion is secured.", "Its Echo favors mobile interception."),
  },
  {
    stageId: "glass-necropolis",
    sequence: 6,
    name: "Glass Necropolis",
    terrainGlbPath: "assets/images/battle/glb/terrain/glass-necropolis.glb",
    gameplay: {
      bounds: bounds(800, 23400, 700, 11300),
      obstacles: [
        obstacle("glass-necropolis:north-glass-panel", 14500, 3000, 760),
        obstacle("glass-necropolis:south-glass-panel", 15100, 8900, 760),
      ],
      surfaces: [
        surface("glass-necropolis:spire-ramp", "ramp", 15800, 17500, 1500, 2900, "x", 0, 600),
        surface("glass-necropolis:spire-platform", "platform", 17500, 18900, 1300, 3200, "x", 600, 600),
      ],
    },
    presentation: {
      palette: { surface: "surface-glass-crypt", contour: "contour-glass", landmark: "landmark-spire", hazard: "hazard-shard", objective: "objective-choir", accent: "#b6dce5" },
      atmosphere: { descriptor: "Reflective tomb planes split elevation from sightline.", motif: "shard-light and choir resonance", fogNear: 23.8, fogFar: 53.2 },
      landmarks: [
        landmark("landmark.glass-spire", "Glass Spire", 18200, 2200, 600, "glass-necropolis:choir-crystal"),
        landmark("landmark.glass-crypt", "Glass Crypt", 16000, 3600, 0, "glass-necropolis:record-hourglass"),
      ],
      props: [
        prop("glass-necropolis:choir-crystal", "assets/images/battle/glb/props/choir-ward-crystal.glb", "spire-focus", 18200, 2200, 600, 0, 170),
        prop("glass-necropolis:record-hourglass", "assets/images/battle/glb/props/stillwater-hourglass.glb", "record-beacon", 16000, 3600, 0, 0.7854, 140),
      ],
      npcs: [
        lookout("glass-necropolis:requiem-lookout", "requiem-warden", "assets/images/battle/glb/companions/requiem-warden.glb", 18000, 2350, 600, 3.1416, 9000, 6200, "watch-reflected-sightlines"),
      ],
    },
    editorial: editorial(false, 0, "Glass Necropolis", "A reflective high ground remains sealed in the archive.", "Its Echo answers careful sightline control."),
  },
  {
    stageId: "starless-canal",
    sequence: 7,
    name: "Starless Canal",
    terrainGlbPath: "assets/images/battle/glb/terrain/starless-canal.glb",
    gameplay: {
      bounds: bounds(600, 23400, 900, 11100),
      obstacles: [
        obstacle("starless-canal:north-lock-pier", 13400, 3000, 900),
        obstacle("starless-canal:south-lock-pier", 13400, 9000, 900),
        obstacle("starless-canal:floodgate-wheel", 15800, 6000, 680),
      ],
      surfaces: [
        surface("starless-canal:towpath-ramp", "ramp", 15100, 16900, 2300, 3500, "x", 0, 280),
        surface("starless-canal:towpath-platform", "platform", 16900, 18400, 2100, 3700, "x", 280, 280),
      ],
    },
    presentation: {
      palette: { surface: "surface-canal-ink", contour: "contour-lock", landmark: "landmark-towpath", hazard: "hazard-undertow", objective: "objective-toll", accent: "#16233f" },
      atmosphere: { descriptor: "A starless undertow pulls against the towpath.", motif: "locks and dark water", fogNear: 19.6, fogFar: 40.6 },
      landmarks: [
        landmark("landmark.canal-towpath", "Canal Towpath", 17600, 3000, 280, "starless-canal:towpath-lantern"),
        landmark("landmark.canal-lock", "Sealed Lock", 17600, 7600, 0, "starless-canal:lock-caster"),
      ],
      props: [
        prop("starless-canal:towpath-lantern", "assets/images/battle/glb/props/warden-lantern.glb", "towpath-marker", 17600, 3000, 280, 0, 140),
        prop("starless-canal:lock-caster", "assets/images/battle/glb/props/arc-caster.glb", "lock-control", 17600, 7600, 0, 1.5708, 180),
      ],
      npcs: [
        lookout("starless-canal:lantern-lookout", "lantern-reaver", "assets/images/battle/glb/companions/lantern-reaver.glb", 17400, 3150, 280, 3.1416, 7600, 8000, "count-the-lock-pulses"),
      ],
    },
    editorial: editorial(false, 0, "Starless Canal", "The archive withholds the route beneath the dark waterline.", "A recovered Echo can contest the undertow."),
  },
  {
    stageId: "shattered-causeway",
    sequence: 8,
    name: "Shattered Causeway",
    terrainGlbPath: "assets/images/battle/glb/terrain/shattered-causeway.glb",
    gameplay: {
      bounds: bounds(700, 23400, 1100, 10900),
      obstacles: [
        obstacle("shattered-causeway:north-collapse-shard", 14800, 3100, 880),
        obstacle("shattered-causeway:south-collapse-shard", 15100, 8700, 880),
      ],
      surfaces: [
        surface("shattered-causeway:keystone-ramp", "ramp", 16000, 17700, 1900, 3200, "x", 0, 460),
        surface("shattered-causeway:keystone-platform", "platform", 17700, 19100, 1700, 3400, "x", 460, 460),
      ],
    },
    presentation: {
      palette: { surface: "surface-causeway-rubble", contour: "contour-fracture", landmark: "landmark-keystone", hazard: "hazard-collapse", objective: "objective-brace", accent: "#8a674f" },
      atmosphere: { descriptor: "The broken causeway trembles before the Gate.", motif: "collapse lines and keystone mass", fogNear: 22.4, fogFar: 49 },
      landmarks: [
        landmark("landmark.causeway-keystone", "Causeway Keystone", 18400, 2600, 460, "shattered-causeway:brace-brand"),
        landmark("landmark.causeway-gap", "Broken Causeway", 16400, 4000, 0, "shattered-causeway:gap-blade"),
      ],
      props: [
        prop("shattered-causeway:brace-brand", "assets/images/battle/glb/props/bulwark-brand.glb", "keystone-brace", 18400, 2600, 460, 0, 180),
        prop("shattered-causeway:gap-blade", "assets/images/battle/glb/props/abyss-blade.glb", "collapse-warning", 16400, 4000, 0, -0.7854, 160),
      ],
      npcs: [
        lookout("shattered-causeway:ember-lookout", "ember-cohort", "assets/images/battle/glb/companions/ember-cohort.glb", 18200, 2750, 460, 3.1416, 8600, 6000, "watch-the-broken-span"),
      ],
    },
    editorial: editorial(false, 0, "Shattered Causeway", "Only the outline of a broken crossing is safe to disclose.", "The sealed record contains a defensive Echo."),
  },
  {
    stageId: "abyss-chancel",
    sequence: 9,
    name: "Abyss Chancel",
    terrainGlbPath: "assets/images/battle/glb/terrain/abyss-chancel.glb",
    gameplay: {
      bounds: bounds(800, 23400, 700, 11300),
      obstacles: [
        obstacle("abyss-chancel:north-transept-pillar", 14400, 3000, 780),
        obstacle("abyss-chancel:south-transept-pillar", 14400, 9000, 780),
        obstacle("abyss-chancel:nave-pillar", 16000, 8600, 720),
      ],
      surfaces: [
        surface("abyss-chancel:apse-ramp", "ramp", 16200, 17900, 1900, 3300, "x", 0, 540),
        surface("abyss-chancel:apse-platform", "platform", 17900, 19300, 1700, 3500, "x", 540, 540),
      ],
    },
    presentation: {
      palette: { surface: "surface-chancel-abyss", contour: "contour-oath", landmark: "landmark-apse", hazard: "hazard-oath", objective: "objective-oath", accent: "#6f4e8b" },
      atmosphere: { descriptor: "Oath-pressure hangs above the chancel nave.", motif: "oath rings and veiled signatures", fogNear: 19.6, fogFar: 42 },
      landmarks: [
        landmark("landmark.chancel-apse", "Chancel Apse", 18600, 2600, 540, "abyss-chancel:oath-crystal"),
        landmark("landmark.chancel-nave", "Chancel Nave", 16000, 7000, 0, "abyss-chancel:nave-banner"),
      ],
      props: [
        prop("abyss-chancel:oath-crystal", "assets/images/battle/glb/props/choir-ward-crystal.glb", "oath-focus", 18600, 2600, 540, 0, 170),
        prop("abyss-chancel:nave-banner", "assets/images/battle/glb/props/abyssal-banner.glb", "nave-marker", 16000, 7000, 0, 1.5708, 160),
      ],
      npcs: [
        lookout("abyss-chancel:requiem-lookout", "requiem-warden", "assets/images/battle/glb/companions/requiem-warden.glb", 18400, 2750, 540, 3.1416, 8200, 7000, "hold-the-oathline"),
      ],
    },
    editorial: editorial(false, 0, "Abyss Chancel", "The final oath-line remains redacted until its approach is earned.", "Its recoverable Echo is disclosed only after contact."),
  },
  {
    stageId: "gate-zenith",
    sequence: 10,
    name: "Gate Zenith",
    terrainGlbPath: "assets/images/battle/glb/terrain/gate-zenith.glb",
    gameplay: {
      bounds: bounds(900, 23400, 800, 11200),
      obstacles: [
        obstacle("gate-zenith:north-sigil-spike", 15100, 3100, 820),
        obstacle("gate-zenith:south-sigil-spike", 15100, 8900, 820),
      ],
      surfaces: [
        surface("gate-zenith:crown-ramp", "ramp", 16600, 18300, 1500, 2900, "x", 0, 680),
        surface("gate-zenith:crown-platform", "platform", 18300, 19800, 1300, 3200, "x", 680, 680),
      ],
    },
    presentation: {
      palette: { surface: "surface-zenith-void", contour: "contour-threshold", landmark: "landmark-crown", hazard: "hazard-command", objective: "objective-last-seal", accent: "#d5ae58" },
      atmosphere: { descriptor: "At the Zenith, the command network touches the abyss.", motif: "threshold rays and the last seal", fogNear: 29.4, fogFar: 64.4 },
      landmarks: [
        landmark("landmark.zenith-crown", "Zenith Crown", 19000, 2200, 680, "gate-zenith:crown-banner"),
        landmark("landmark.zenith-threshold", "Gate Threshold", 18800, 6000, 0, "gate-zenith:threshold-lantern"),
      ],
      props: [
        prop("gate-zenith:crown-banner", "assets/images/battle/glb/props/abyssal-banner.glb", "crown-marker", 19000, 2200, 680, 0, 160),
        prop("gate-zenith:threshold-lantern", "assets/images/battle/glb/props/warden-lantern.glb", "last-seal-beacon", 18800, 6000, 0, 1.5708, 140),
      ],
      npcs: [
        lookout("gate-zenith:crown-lookout", "dawnless-crown", "assets/images/battle/glb/companions/dawnless-crown.glb", 18800, 2350, 680, 3.1416, 7600, 6000, "watch-the-final-threshold"),
      ],
    },
    editorial: editorial(false, 0, "Gate Zenith", "The last seal is named, but its opposition remains redacted.", "Final-route records reveal rewards only after resolution."),
  },
];

const byId = Object.fromEntries(profiles.map((profile) => [profile.stageId, profile]));

const inside = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const assertFiniteNumbers = (value, path) => {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`Non-finite stage world value at ${path}`);
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => assertFiniteNumbers(entry, `${path}.${key}`));
  }
};

const validateProfile = (profile) => {
  const { minX, maxX, minY, maxY } = profile.gameplay.bounds;
  assertFiniteNumbers(profile, profile.stageId);
  if (!(inside(minX, 0, ARENA.width) && inside(maxX, 0, ARENA.width) && minX < maxX
    && inside(minY, 0, ARENA.height) && inside(maxY, 0, ARENA.height) && minY < maxY)) {
    throw new Error(`Invalid walkable bounds for stage world: ${profile.stageId}`);
  }
  if (ARENA.gateX - 900 < minX || ARENA.gateX + 900 > maxX || ARENA.gateY - 900 < minY || ARENA.gateY + 900 > maxY) {
    throw new Error(`Stage world excludes canonical gate geometry: ${profile.stageId}`);
  }

  const ids = new Set();
  const claimId = (entry) => {
    if (!entry.id || ids.has(entry.id)) throw new Error(`Duplicate or missing world id in ${profile.stageId}: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.id.startsWith(`${profile.stageId}:`) && !entry.id.startsWith("landmark.")) {
      throw new Error(`World id must be stage-scoped: ${entry.id}`);
    }
  };

  profile.gameplay.obstacles.forEach((entry) => {
    claimId(entry);
    const { x, y, radius } = entry.footprint;
    if (!(radius > 0 && Number.isFinite(entry.elevation) && entry.elevation >= 0
      && inside(x - radius, minX, maxX) && inside(x + radius, minX, maxX)
      && inside(y - radius, minY, maxY) && inside(y + radius, minY, maxY))) {
      throw new Error(`Obstacle footprint leaves walkable bounds: ${entry.id}`);
    }
    if (Math.hypot(x - ARENA.gateX, y - ARENA.gateY) < radius + 900) {
      throw new Error(`Obstacle blocks canonical gate geometry: ${entry.id}`);
    }
  });

  profile.gameplay.surfaces.forEach((entry) => {
    claimId(entry);
    const area = entry.bounds;
    if (!(["ramp", "platform"].includes(entry.type)
      && inside(area.minX, minX, maxX) && inside(area.maxX, minX, maxX) && area.minX < area.maxX
      && inside(area.minY, minY, maxY) && inside(area.maxY, minY, maxY) && area.minY < area.maxY
      && ["x", "y"].includes(entry.elevation.axis)
      && Number.isInteger(entry.elevation.atMin) && Number.isInteger(entry.elevation.atMax)
      && entry.elevation.atMin >= 0 && entry.elevation.atMax >= 0
      && (entry.type !== "ramp" || entry.elevation.atMin !== entry.elevation.atMax)
      && (entry.type !== "platform" || entry.elevation.atMin === entry.elevation.atMax))) {
      throw new Error(`Invalid elevation surface: ${entry.id}`);
    }
  });
  if (profile.gameplay.surfaces.filter(({ type }) => type === "ramp").length !== 1
    || profile.gameplay.surfaces.filter(({ type }) => type === "platform").length !== 1) {
    throw new Error(`Stage world requires one ramp and one platform: ${profile.stageId}`);
  }
  const meshColliders = profile.gameplay.meshColliders ?? [];
  if (!Array.isArray(meshColliders)) throw new Error(`Invalid mesh collider collection: ${profile.stageId}`);
  meshColliders.forEach((collider) => {
    claimId(collider);
    if (!Array.isArray(collider.triangles) || collider.triangles.length === 0) {
      throw new Error(`Mesh collider requires triangles: ${collider.id}`);
    }
    collider.triangles.forEach((vertices, index) => {
      if (!Array.isArray(vertices) || vertices.length !== 3) {
        throw new Error(`Mesh collider triangle must have three vertices: ${collider.id}[${index}]`);
      }
      const [first, second, third] = vertices;
      const validVertex = (vertex) => vertex && inside(vertex.x, minX, maxX)
        && inside(vertex.y, minY, maxY) && Number.isFinite(vertex.elevation) && vertex.elevation >= 0;
      if (!(validVertex(first) && validVertex(second) && validVertex(third))) {
        throw new Error(`Invalid mesh collider triangle: ${collider.id}[${index}]`);
      }
      const twiceArea = (second.x - first.x) * (third.y - first.y)
        - (second.y - first.y) * (third.x - first.x);
      if (!(Number.isFinite(twiceArea) && twiceArea !== 0)) {
        throw new Error(`Degenerate mesh collider triangle: ${collider.id}[${index}]`);
      }
    });
  });
  if (profile.stageId === "cinder-span" && meshColliders.length === 0) {
    throw new Error("Cinder Span requires an authored walkable support mesh.");
  }



  for (const entry of profile.presentation.props) {
    claimId(entry);
    const { x, y, elevation, yawRadians } = entry.placement;
    if (!(inside(x, minX, maxX) && inside(y, minY, maxY)
      && Number.isFinite(elevation) && elevation >= 0 && Number.isFinite(yawRadians)
      && Number.isFinite(entry.footprintRadius) && entry.footprintRadius > 0
      && inside(x - entry.footprintRadius, minX, maxX) && inside(x + entry.footprintRadius, minX, maxX)
      && inside(y - entry.footprintRadius, minY, maxY) && inside(y + entry.footprintRadius, minY, maxY))) {
      throw new Error(`Prop placement leaves walkable bounds: ${entry.id}`);
    }
  }

  for (const entry of profile.presentation.npcs) {
    claimId(entry);
    const { x, y, elevation, yawRadians } = entry.placement;
    const target = entry.presentationCue.lookAt;
    if (!(inside(x, minX, maxX) && inside(y, minY, maxY)
      && Number.isFinite(elevation) && elevation >= 0 && Number.isFinite(yawRadians)
      && inside(target.x, minX, maxX) && inside(target.y, minY, maxY))) {
      throw new Error(`NPC presentation cue leaves walkable bounds: ${entry.id}`);
    }
  }
  const intro = profile.presentation.cinematic?.intro;
  if (profile.presentation.cinematic && !intro) {
    throw new Error(`Invalid cinematic profile: ${profile.stageId}`);
  }
  if (intro) {
    const validOffset = (offset) => offset && Number.isFinite(offset.distance)
      && Number.isFinite(offset.azimuth) && Number.isFinite(offset.polar);
    if (!(Number.isInteger(intro.durationTicks) && intro.durationTicks > 0 && intro.durationTicks <= 300
      && validOffset(intro.from) && validOffset(intro.to))) {
      throw new Error(`Invalid intro dolly profile: ${profile.stageId}`);
    }
  }
  if (profile.stageId === "cinder-span" && !intro) {
    throw new Error("Cinder Span requires an intro dolly profile.");
  }


  const propIds = new Set(profile.presentation.props.map(({ id }) => id));
  profile.presentation.landmarks.forEach((entry) => {
    claimId(entry);
    const { x, y, elevation } = entry.placement;
    if (!(inside(x, minX, maxX) && inside(y, minY, maxY)
      && Number.isFinite(elevation) && elevation >= 0 && propIds.has(entry.propId))) {
      throw new Error(`Landmark placement leaves walkable bounds: ${entry.id}`);
    }
  });
};

const canonicalStageIds = STAGES.map(({ id }) => id);
if (profiles.length !== canonicalStageIds.length
  || new Set(profiles.map(({ stageId }) => stageId)).size !== canonicalStageIds.length
  || canonicalStageIds.some((stageId) => !Object.hasOwn(byId, stageId))
  || Object.keys(byId).some((stageId) => !canonicalStageIds.includes(stageId))) {
  throw new Error("Stage world catalog must cover every canonical stage exactly once.");
}
profiles.forEach(validateProfile);

export const STAGE_WORLD_PROFILES = freeze(byId);
export const STAGE_SHOWCASE_IDS = freeze(
  profiles
    .filter(({ editorial: entry }) => entry.showcase)
    .sort((left, right) => left.editorial.order - right.editorial.order)
    .map(({ stageId }) => stageId),
);
if (STAGE_SHOWCASE_IDS.length !== 3) throw new Error("Stage world catalog must expose exactly three editorial showcases.");

/** Returns the canonical frozen profile for a stage id, or null when unknown. */
export function stageWorldFor(stageId) {
  return typeof stageId === "string" ? (STAGE_WORLD_PROFILES[stageId] ?? null) : null;
}
