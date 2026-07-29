/**
 * 적 등급 시스템 — Enemy Grade System for 그림자군단
 *
 * Three grades: BASIC (기본), SHADOW (중간보스), BOSS (보스)
 * Grade mapping from mesh asset folder structure.
 * Stat variance: ±17.5% (65% floor) within same grade via deterministic xorshift.
 * Higher grade → absolutely higher base multiplier (compounding per level).
 *
 * Contract: every number traces to a constant below; derive functions carry no
 * numeric literals of their own.
 */

const freeze = (value) => {
  if (value && typeof value !== "object" || Object.isFrozen(value)) return value;
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

// ── Grade Definitions ──────────────────────────────────────────────────────
export const ENEMY_GRADES = freeze({
  BASIC:  { id: "BASIC",  index: 0, name: "기본",    description: "일반 적 개체" },
  SHADOW: { id: "SHADOW", index: 1, name: "중간보스", description: "그림자 정예 개체 (shadow 오브젝트)" },
  BOSS:   { id: "BOSS",   index: 2, name: "보스",    description: "보스 등급 개체" },
});

// ── Mesh Path → Grade Mapping ──────────────────────────────────────────────
// shadow-commander-boss and shade folders → SHADOW (mid-boss, shadow objects)
// assets/mesh/boss/* → BOSS
// everything else in assets/mesh/enemy/ → BASIC
const SHADOW_ENEMY_FOLDERS = freeze([
  "shadow-commander-boss",
  "shade",
]);

export const GRADE_MESH_MAPPING = freeze({
  bossPrefix: "assets/mesh/boss/",
  enemyPrefix: "assets/mesh/enemy/",
  shadowFolders: SHADOW_ENEMY_FOLDERS,
});

/**
 * Determine grade from a mesh asset path.
 * @param {string} meshPath — e.g. "assets/mesh/boss/s1-cinder-warden/glb/base_basic_pbr.glb"
 * @returns {"BASIC"|"SHADOW"|"BOSS"}
 */
export function gradeForMeshPath(meshPath) {
  if (typeof meshPath !== "string") return "BASIC";
  if (meshPath.startsWith(GRADE_MESH_MAPPING.bossPrefix)) return "BOSS";
  if (meshPath.startsWith(GRADE_MESH_MAPPING.enemyPrefix)) {
    const afterPrefix = meshPath.slice(GRADE_MESH_MAPPING.enemyPrefix.length);
    const folder = afterPrefix.split("/")[0];
    if (SHADOW_ENEMY_FOLDERS.includes(folder)) return "SHADOW";
  }
  return "BASIC";
}

// ── Base Stat Templates Per Grade ──────────────────────────────────────────
// [TARGET] All values subject to QA balance pass.
export const GRADE_BASE_STATS = freeze({
  BASIC: {
    hp: 3000,
    speed: 2800,
    damage: 12,
    attackTicks: 60,
    xp: 10,
    radius: 300,
    defense: 0,
    critChanceBp: 500,
    critMultiplierBp: 15000,
  },
  SHADOW: {
    hp: 15000,        // 5× BASIC
    speed: 2200,
    damage: 42,       // 3.5× BASIC
    attackTicks: 75,
    xp: 80,           // 8× BASIC
    radius: 540,
    defense: 15,
    critChanceBp: 1000,
    critMultiplierBp: 17000,
  },
  BOSS: {
    hp: 45000,        // 15× BASIC
    speed: 1800,
    damage: 96,       // 8× BASIC
    attackTicks: 90,
    xp: 200,          // 20× BASIC
    radius: 900,
    defense: 40,
    critChanceBp: 1500,
    critMultiplierBp: 20000,
  },
});

// ── Per-Level Growth Rates [TARGET] ────────────────────────────────────────
const GRADE_LEVEL_GROWTH = freeze({
  BASIC:  0.08,  // +8% compounding per level
  SHADOW: 0.06,  // +6%
  BOSS:   0.05,  // +5%
});

// ── Stat Variance ──────────────────────────────────────────────────────────
// Within same grade each stat varies in [base*0.65, base*1.0].
const VARIANCE_FLOOR = 0.65;
const VARIANCE_CEILING = 1.0;

function xorshift32(seed) {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

/**
 * Apply deterministic variance to a base stat.
 * @param {number} baseStat
 * @param {number} seed — entity-specific RNG seed
 * @param {number} fieldIndex — per-field offset so each stat varies independently
 * @returns {number} integer stat in [baseStat*0.65, baseStat*1.0]
 */
export function applyVariance(baseStat, seed, fieldIndex) {
  const normalizedSeed = (Number(seed) || 0) >>> 0;
  const mixed = xorshift32((normalizedSeed ^ 0x9e3779b9) + fieldIndex * 7919);
  const t = (mixed % 10000) / 10000; // 0..1 uniform
  const multiplier = VARIANCE_FLOOR + t * (VARIANCE_CEILING - VARIANCE_FLOOR);
  return Math.max(1, Math.round(baseStat * multiplier));
}

/**
 * Grade-and-level multiplier: base * (1 + growthRate)^(level - 1).
 * @param {"BASIC"|"SHADOW"|"BOSS"} gradeId
 * @param {number} level — 1-indexed
 * @returns {number} floating-point multiplier ≥ 1
 */
export function gradeMultiplier(gradeId, level) {
  const rate = GRADE_LEVEL_GROWTH[gradeId] ?? GRADE_LEVEL_GROWTH.BASIC;
  return Math.pow(1 + rate, Math.max(0, level - 1));
}

/**
 * Generate a full stat block for an enemy.
 * @param {"BASIC"|"SHADOW"|"BOSS"} gradeId
 * @param {number} level — 1-indexed
 * @param {number} seed — deterministic variance seed
 * @returns {object} frozen stat object
 */
export function generateEnemyStats(gradeId, level, seed) {
  const base = GRADE_BASE_STATS[gradeId] ?? GRADE_BASE_STATS.BASIC;
  const mult = gradeMultiplier(gradeId, level);
  const fields = Object.keys(base);
  const stats = {};
  fields.forEach((field, i) => {
    const scaled = Math.round(base[field] * mult);
    if (field === "attackTicks") {
      stats[field] = scaled;
    } else {
      stats[field] = applyVariance(scaled, seed, i);
    }
  });
  stats.grade = gradeId;
  stats.level = level;
  return freeze(stats);
}

// ── Frozen Exports ─────────────────────────────────────────────────────────
freeze(ENEMY_GRADES);
freeze(GRADE_BASE_STATS);
freeze(GRADE_MESH_MAPPING);
