/**
 * 레벨링 & 등급 조합 시스템 — Leveling & Grade Combination for 그림자군단
 *
 * 레벨링 for companions and equipment.
 * Grade tiers: BASIC → UNCOMMON → RARE → EPIC → LEGENDARY
 * Combination: 3 same-grade entities → 1 next-grade (25% stat bonus).
 * Level injection: spend XP pool to level up entities.
 *
 * [TARGET] All balance values subject to QA simulation pass.
 */

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

// ── Grade Tiers ────────────────────────────────────────────────────────────
export const GRADE_TIERS = freeze({
  BASIC:     { id: "BASIC",     index: 0, name: "기본",   color: "#aaaaaa" },
  UNCOMMON:  { id: "UNCOMMON",  index: 1, name: "고급",   color: "#4caf50" },
  RARE:      { id: "RARE",      index: 2, name: "희귀",   color: "#2196f3" },
  EPIC:      { id: "EPIC",      index: 3, name: "영웅",   color: "#9c27b0" },
  LEGENDARY: { id: "LEGENDARY", index: 4, name: "전설",   color: "#ff9800" },
});

/** Canonical companion grade order used for validation and deterministic progression. */
const COMBINABLE_GRADE_ORDER = freeze(["BASIC", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]);

/** Companion grades that are not part of player grade combination flow (enemy extraction only). */
const ENEMY_ORIGIN_GRADE_ORDER = freeze(["SHADOW", "BOSS"]);

/** Complete grade vocabulary for companion-derived entities. */
const COMPANION_GRADE_ORDER = freeze([...COMBINABLE_GRADE_ORDER, ...ENEMY_ORIGIN_GRADE_ORDER]);

/** Multipliers are explicit per grade:
 * BASIC=1.0, UNCOMMON=1.25, RARE=1.5625, EPIC=1.953, LEGENDARY=2.441,
 * SHADOW=1.8, BOSS=2.0.
 */
const COMPANION_GRADE_MULTIPLIERS = freeze({
  BASIC: 1,
  UNCOMMON: 1.25,
  RARE: 1.5625,
  EPIC: 1.953125,
  LEGENDARY: 2.44140625,
  SHADOW: 1.8,
  BOSS: 2,
});

/** Combinable grade transitions, other grades are explicit terminal states. */
const COMBINABLE_GRADE_TO_NEXT = freeze({
  BASIC: "UNCOMMON",
  UNCOMMON: "RARE",
  RARE: "EPIC",
  EPIC: "LEGENDARY",
  LEGENDARY: null,
});

function resolveCompanionGrade(grade) {
  if (typeof grade !== "string") return null;
  return COMPANION_GRADE_ORDER.includes(grade) ? grade : null;
}

function getCompanionGradeMultiplier(grade) {
  const resolved = resolveCompanionGrade(grade);
  if (!resolved) {
    throw new Error(`알 수 없는 동료 등급: ${String(grade)}`);
  }
  return COMPANION_GRADE_MULTIPLIERS[resolved];
}

function assertCombinableGrade(grade) {
  const resolved = resolveCompanionGrade(grade);
  if (!resolved) {
    return { ok: false, error: `알 수 없는 동료 등급: ${String(grade)}` };
  }
  const next = COMBINABLE_GRADE_TO_NEXT[resolved];
  if (!next) {
    return { ok: false, error: `${resolved} 등급은 더 이상 조합할 수 없습니다` };
  }
  return { ok: true, grade: resolved, next };
}

function getMaxLevelForGrade(grade) {
  const resolved = resolveCompanionGrade(grade);
  if (!resolved) return null;
  return MAX_LEVELS[resolved];
}

// ── Max Levels Per Grade ───────────────────────────────────────────────────
export const MAX_LEVELS = freeze({
  BASIC:     30,
  UNCOMMON:  35,
  RARE:      40,
  EPIC:      50,
  LEGENDARY: 60,
  // Enemy-origin grades
  SHADOW:    50,
  BOSS:      70,
});

let companionCombinationSeq = 0;
let equipmentCombinationSeq = 0;

// ── XP Table ───────────────────────────────────────────────────────────────
/**
 * XP required to reach a given level (1-indexed). Level 1 costs 0.
 */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(1.12, level - 1));
}

/** Pre-computed cumulative XP table up to level 70. */
export const XP_TABLE = freeze(
  Array.from({ length: 71 }, (_, i) => {
    let total = 0;
    for (let l = 1; l <= i; l++) total += xpForLevel(l);
    return total;
  })
);

// ── Growth Rates (per level) ───────────────────────────────────────────────
export const GROWTH_RATES = freeze({
  companion: {
    damage:    0.03,   // +3% per level
    hp:        0.04,   // +4% per level
    fireTicks: -0.005, // -0.5% per level (faster, floor at 50% of base)
    range:     0.01,   // +1% per level (cap at +30%)
  },
  equipment: {
    primaryStat:   0.05,  // +5% per enhance level
    secondaryStat: 0.02,  // +2% per enhance level
  },
});

// ── Companion Stat Calculation ─────────────────────────────────────────────
/**
 * Calculate companion stats at a given level.
 * @param {object} baseStats — { damage, maxHp/hp, fireTicks, range }
 * @param {number} level — 1-indexed
 * @param {string} grade — grade tier id (BASIC, UNCOMMON, RARE, EPIC, LEGENDARY, SHADOW, BOSS)
 * @returns {object} frozen computed stats
 */
export function calculateCompanionStatsAtLevel(baseStats, level, grade) {
  const gradeKey = resolveCompanionGrade(grade);
  if (!gradeKey) {
    throw new Error(`알 수 없는 동료 등급: ${String(grade)}`);
  }
  const gradeMult = getCompanionGradeMultiplier(gradeKey);
  const lvl = Math.max(1, level);

  const damageGrowth = 1 + GROWTH_RATES.companion.damage * (lvl - 1);
  const hpGrowth = 1 + GROWTH_RATES.companion.hp * (lvl - 1);
  const fireTicksGrowth = Math.max(0.5, 1 + GROWTH_RATES.companion.fireTicks * (lvl - 1));
  const rangeGrowth = Math.min(1.3, 1 + GROWTH_RATES.companion.range * (lvl - 1));

  return freeze({
    damage: Math.round((baseStats.damage || 0) * gradeMult * damageGrowth),
    maxHp: Math.round((baseStats.maxHp || baseStats.hp || 1) * gradeMult * hpGrowth),
    fireTicks: Math.max(12, Math.round((baseStats.fireTicks || 36) * fireTicksGrowth)),
    range: Math.round((baseStats.range || 4000) * rangeGrowth),
    level: lvl,
    grade: gradeKey,
  });
}

// ── Grade Combination ──────────────────────────────────────────────────────
/**
 * Combine 3 same-grade companions into 1 next-grade companion.
 * @param {Array} companions — exactly 3 companion objects of the same grade
 * @returns {{ success: boolean, result?: object, error?: string }}
 */
export function gradeUpCompanion(companions) {
  if (!Array.isArray(companions) || companions.length !== 3) {
    return { success: false, error: "정확히 3개의 동료가 필요합니다" };
  }
  const grades = companions.map((c) => c.grade);
  if (new Set(grades).size !== 1) {
    return { success: false, error: "모든 동료의 등급이 동일해야 합니다" };
  }

  const validated = assertCombinableGrade(grades[0]);
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }

  const nextGrade = validated.next;
  const gradeMult = 1.25;

  // Average stats of inputs
  const avgDamage = Math.round(companions.reduce((s, c) => s + (c.damage || 0), 0) / 3 * gradeMult);
  const avgHp = Math.round(companions.reduce((s, c) => s + (c.maxHp || c.hp || 0), 0) / 3 * gradeMult);
  const avgFireTicks = Math.max(12, Math.round(companions.reduce((s, c) => s + (c.fireTicks || 36), 0) / 3));
  const avgRange = Math.round(companions.reduce((s, c) => s + (c.range || 4000), 0) / 3);
  const maxLevel = Math.max(...companions.map((c) => c.level || 1));
  const nextId = ++companionCombinationSeq;

  const result = freeze({
    id: `combined-${nextGrade.toLowerCase()}-${nextId}`,
    sourceIds: companions.map((c) => c.id),
    name: `${GRADE_TIERS[nextGrade].name} 동료`,
    grade: nextGrade,
    damage: avgDamage,
    maxHp: avgHp,
    hp: avgHp,
    fireTicks: avgFireTicks,
    range: avgRange,
    level: Math.max(1, Math.floor(maxLevel * 0.8)), // Retain 80% of highest level
    xp: 0,
    loyalty: 100,
  });

  return { success: true, result };
}

/**
 * Combine 3 same-grade equipment into 1 next-grade equipment.
 * @param {Array} equipment — exactly 3 equipment objects of the same rarity
 * @returns {{ success: boolean, result?: object, error?: string }}
 */
export function gradeUpEquipment(equipment) {
  if (!Array.isArray(equipment) || equipment.length !== 3) {
    return { success: false, error: "정확히 3개의 장비가 필요합니다" };
  }

  const rarities = equipment.map((e) => e.rarity);
  if (new Set(rarities).size !== 1) {
    return { success: false, error: "모든 장비의 등급이 동일해야 합니다" };
  }

  const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"];
  const currentIdx = rarityOrder.indexOf(rarities[0]);
  if (currentIdx < 0 || currentIdx >= rarityOrder.length - 1) {
    return { success: false, error: `${rarities[0]} 등급은 더 이상 조합할 수 없습니다` };
  }

  const nextRarity = rarityOrder[currentIdx + 1];
  const highestEnhance = Math.max(...equipment.map((e) => e.enhanceLevel || 0));

  // Base on first item, boost primary stat by 50%
  const base = equipment[0];
  const newStats = base.stats ? { ...base.stats } : {};
  const statKeys = Object.keys(newStats);
  if (statKeys.length > 0) {
    // Find primary stat
    let primaryKey = statKeys[0];
    let primaryVal = 0;
    for (const k of statKeys) {
      if (Math.abs(newStats[k] || 0) > primaryVal) {
        primaryVal = Math.abs(newStats[k] || 0);
        primaryKey = k;
      }
    }
    newStats[primaryKey] = Math.round((newStats[primaryKey] || 0) * 1.5);
  }

  // Merge all unique traits
  const allTraits = [...new Set(equipment.flatMap((e) => e.traits || []))];

  const result = freeze({
    id: `combined-${nextRarity}-${++equipmentCombinationSeq}`,
    sourceIds: equipment.map((e) => e.id),
    name: `${base.name} [${GRADE_TIERS[nextRarity.toUpperCase()]?.name || nextRarity}]`,
    category: base.category,
    subcategory: base.subcategory,
    meshPath: base.meshPath,
    stats: freeze(newStats),
    traits: freeze(allTraits),
    equipSlot: base.equipSlot,
    gradeRequirement: base.gradeRequirement,
    equippableBy: base.equippableBy,
    rarity: nextRarity,
    level: base.level,
    enhanceLevel: highestEnhance,
  });

  return { success: true, result };
}

// ── Equipment Stat Calculation ─────────────────────────────────────────────
/**
 * Equipment enhancement success rates.
 * @param {number} enhanceLevel — target enhance level (1-20)
 * @returns {number} success rate 0..1
 */
export function enhanceSuccessRate(enhanceLevel) {
  if (enhanceLevel <= 10) return 1.0;
  if (enhanceLevel <= 15) return 0.9;
  if (enhanceLevel <= 18) return 0.7;
  return 0.5; // 19-20
}

/**
 * Enhancement cost in currency units.
 * @param {number} enhanceLevel — target level
 * @returns {number}
 */
export function enhanceCost(enhanceLevel) {
  return enhanceLevel * 50 + Math.floor(enhanceLevel * enhanceLevel * 2);
}

/**
 * Calculate equipment stats at a given enhance level.
 * @param {object} baseStats — { attack, defense, hp, speed, critChanceBp, critMultiplierBp, range }
 * @param {number} level — item base level
 * @param {number} enhanceLevel — 0-20
 * @returns {object} frozen computed stats
 */
export function calculateEquipmentStatsAtLevel(baseStats, level, enhanceLevel) {
  if (!baseStats) return freeze({ level, enhanceLevel });
  const enh = Math.max(0, Math.min(20, enhanceLevel));
  const primaryMult = 1 + GROWTH_RATES.equipment.primaryStat * enh;
  const secondaryMult = 1 + GROWTH_RATES.equipment.secondaryStat * enh;

  // Determine primary stat (highest base value)
  const statKeys = ["attack", "defense", "hp", "speed", "critChanceBp", "critMultiplierBp", "range"];
  let primaryKey = "attack";
  let primaryVal = 0;
  for (const k of statKeys) {
    const v = Math.abs(baseStats[k] || 0);
    if (v > primaryVal) { primaryVal = v; primaryKey = k; }
  }

  const result = { level, enhanceLevel: enh };
  for (const k of statKeys) {
    const base = baseStats[k] || 0;
    const mult = k === primaryKey ? primaryMult : secondaryMult;
    result[k] = Math.round(base * mult);
  }
  return freeze(result);
}

// ── Level Injection ────────────────────────────────────────────────────────
/**
 * Spend XP from a pool to level up an entity.
 * @param {object} entity — mutable entity with { level, xp, grade }
 * @param {number} targetLevel — desired level
 * @param {number} xpPool — available XP to spend
 * @returns {{ levelsGained: number, xpSpent: number, remainingPool: number }}
 */
export function injectLevels(entity, targetLevel, xpPool) {
  const maxLvl = getMaxLevelForGrade(entity.grade);
  if (maxLvl == null) {
    throw new Error(`알 수 없는 동료 등급: ${String(entity.grade)}`);
  }
  const cap = Math.min(targetLevel, maxLvl);
  let spent = 0;
  let gained = 0;

  while (entity.level < cap && xpPool > 0) {
    const needed = xpForLevel(entity.level + 1) - (entity.xp || 0);
    if (needed <= 0) {
      entity.level += 1;
      entity.xp = 0;
      gained += 1;
      continue;
    }
    if (xpPool >= needed) {
      xpPool -= needed;
      spent += needed;
      entity.level += 1;
      entity.xp = 0;
      gained += 1;
    } else {
      entity.xp = (entity.xp || 0) + xpPool;
      spent += xpPool;
      xpPool = 0;
    }
  }

  return { levelsGained: gained, xpSpent: spent, remainingPool: xpPool };
}
