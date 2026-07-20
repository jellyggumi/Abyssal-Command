/**
 * Shared Stage Identity Configurations for Campaign Stages 4-10.
 * Consumed by both WebGL (battle-realtime-three.js) and Canvas2D (battle-visualizer.js) renderers.
 */

export const STAGE_MOTIFS = Object.freeze({
  4: Object.freeze({
    id: "tide",
    name: "Tide",
    bossMotif: "breakwater",
    environment: "fog-tower",
    primary: "#0ea5e9", // Sky Blue
    secondary: "#0284c7", // Darker Blue
    landmarks: Object.freeze([
      Object.freeze({ x: 6, y: 1 }),
      Object.freeze({ x: 11, y: 2 }),
      Object.freeze({ x: 18, y: 3 })
    ])
  }),
  5: Object.freeze({
    id: "howl",
    name: "Howl",
    bossMotif: "rib-sprawl",
    environment: "cave-defense",
    primary: "#ef4444", // Red
    secondary: "#991b1b", // Dark Red
    landmarks: Object.freeze([
      Object.freeze({ x: 7, y: 1 }),
      Object.freeze({ x: 10, y: 1 }),
      Object.freeze({ x: 17, y: 3 })
    ])
  }),
  6: Object.freeze({
    id: "glass",
    name: "Glass",
    bossMotif: "crystal",
    environment: "black-swamp",
    primary: "#d946ef", // Magenta
    secondary: "#a21caf", // Darker Magenta
    landmarks: Object.freeze([
      Object.freeze({ x: 8, y: 1 }),
      Object.freeze({ x: 9, y: 2 }),
      Object.freeze({ x: 18, y: 4 })
    ])
  }),
  7: Object.freeze({
    id: "canal",
    name: "Canal",
    bossMotif: "lantern",
    environment: "castle-siege",
    primary: "#f59e0b", // Amber
    secondary: "#d97706", // Dark Amber
    landmarks: Object.freeze([
      Object.freeze({ x: 6, y: 1 }),
      Object.freeze({ x: 10, y: 2 }),
      Object.freeze({ x: 18, y: 3 })
    ])
  }),
  8: Object.freeze({
    id: "causeway",
    name: "Causeway",
    bossMotif: "keystone",
    environment: "cathedral-relic",
    primary: "#8b5cf6", // Purple
    secondary: "#6d28d9", // Dark Purple
    landmarks: Object.freeze([
      Object.freeze({ x: 7, y: 2 }),
      Object.freeze({ x: 11, y: 1 }),
      Object.freeze({ x: 17, y: 4 })
    ])
  }),
  9: Object.freeze({
    id: "chancel",
    name: "Chancel",
    bossMotif: "rite",
    environment: "soul-altar",
    primary: "#ec4899", // Pink
    secondary: "#be185d", // Dark Pink
    landmarks: Object.freeze([
      Object.freeze({ x: 8, y: 1 }),
      Object.freeze({ x: 10, y: 1 }),
      Object.freeze({ x: 18, y: 2 })
    ])
  }),
  10: Object.freeze({
    id: "zenith",
    name: "Zenith",
    bossMotif: "crown",
    environment: "final-battle",
    primary: "#eab308", // Yellow
    secondary: "#ca8a04", // Dark Yellow
    landmarks: Object.freeze([
      Object.freeze({ x: 7, y: 1 }),
      Object.freeze({ x: 11, y: 1 }),
      Object.freeze({ x: 17, y: 3 })
    ])
  })
});

/**
 * Returns the motif details for a given stage number, or null if stage has no custom motif.
 * @param {number} stageNumber - The active stage number (1-10)
 * @returns {Object|null} The motif config object, or null for stages 1-3.
 */
export function getStageMotif(stageNumber) {
  if (typeof stageNumber !== 'number' || !Number.isFinite(stageNumber) || !Number.isInteger(stageNumber)) {
    return null;
  }
  if (stageNumber >= 4 && stageNumber <= 10) {
    return STAGE_MOTIFS[stageNumber];
  }
  return null;
}
