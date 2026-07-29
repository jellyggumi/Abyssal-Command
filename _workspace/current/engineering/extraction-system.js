/**
 * 추출 & 소환 시스템 — Extraction & Companion Summon System for 그림자군단
 *
 * When any enemy (basic, shadow/mid-boss, boss) is defeated:
 *   1. A corpse entity persists at the death location for 10 seconds (600 ticks).
 *   2. Player (or ally) within extraction range can channel extraction (2 seconds).
 *   3. On completion the corpse is consumed and a companion entity is created.
 *   4. Extracted companion inherits grade, scaled stats, and becomes a permanent ally.
 *
 * ALL enemy types are extractable — basic, mid-boss (SHADOW), and boss (BOSS).
 *
 * [TARGET] All balance values subject to QA simulation pass.
 */

import { TICK_RATE } from "../../../defense-catalog.js";


const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

// ── Constants ──────────────────────────────────────────────────────────────
/** Corpse persists for 10 seconds at 60 Hz. */
export const CORPSE_DURATION_TICKS = TICK_RATE * 10; // 600

/** Player/ally must be within this range (world units) to begin extraction. */
export const EXTRACTION_RANGE = 1200;

/** Extraction channel time: 2 seconds at 60 Hz. */
export const EXTRACTION_CHANNEL_TICKS = TICK_RATE * 2; // 120

/** Stat multipliers when converting defeated enemy → companion, keyed by grade. */
export const GRADE_COMPANION_MULTIPLIERS = freeze({
  BASIC: {
    damageMultiplier: 1.5,
    fireTicksMultiplier: 0.8,
    hpInheritFraction: 0.3,
    defaultRange: 4000,
    loyaltyBase: 100,
  },
  SHADOW: {
    damageMultiplier: 1.8,
    fireTicksMultiplier: 0.75,
    hpInheritFraction: 0.4,
    defaultRange: 4600,
    loyaltyBase: 120,
  },
  BOSS: {
    damageMultiplier: 2.0,
    fireTicksMultiplier: 0.7,
    hpInheritFraction: 0.5,
    defaultRange: 5200,
    loyaltyBase: 150,
  },
});

// ── Corpse Entity ──────────────────────────────────────────────────────────
let corpseSeq = 0;

/**
 * Create a corpse entity from a defeated enemy.
 * @param {object} defeatedEnemy — must have: id, kind/grade, x, y, elevation, hp (maxHp), damage, attackTicks, radius, projectileRange?
 * @param {number} tick — simulation tick at time of death
 * @returns {object} mutable corpse entity; live fields are mutable for extraction/update flow, `sourceStats` is frozen
 */
export function createCorpse(defeatedEnemy, tick) {
  corpseSeq += 1;
  return {
    id: `corpse-${defeatedEnemy.id}-${corpseSeq}`,
    sourceEnemyId: defeatedEnemy.id,
    sourceKind: defeatedEnemy.kind || "enemy",
    sourceGrade: defeatedEnemy.grade || "BASIC",
    sourceStats: freeze({
      damage: defeatedEnemy.damage || 0,
      maxHp: defeatedEnemy.maxHp || defeatedEnemy.hp || 1,
      attackTicks: defeatedEnemy.attackTicks || 60,
      radius: defeatedEnemy.radius || 300,
      projectileRange: defeatedEnemy.projectileRange || 0,
    }),
    x: defeatedEnemy.x,
    y: defeatedEnemy.y,
    elevation: defeatedEnemy.elevation || 0,
    createdTick: tick,
    expiryTick: tick + CORPSE_DURATION_TICKS,
    remainingTicks: CORPSE_DURATION_TICKS,
    extractable: true,
  };
}

/**
 * Tick down corpse timers, return only still-valid corpses.
 * @param {Array} corpses — mutable array of corpse entities
 * @param {number} tick — current simulation tick
 * @returns {Array} surviving corpses (extractable or not yet expired)
 */
export function updateCorpses(corpses, tick) {
  return corpses.filter((c) => {
    if (tick >= c.expiryTick) return false;
    // Rebuild as mutable for remaining ticks (caller owns the array)
    c.remainingTicks = c.expiryTick - tick;
    return true;
  });
}

/**
 * Query corpses within extraction range of a point.
 * @param {Array} corpses
 * @param {number} x
 * @param {number} y
 * @param {number} [range=EXTRACTION_RANGE]
 * @returns {Array} extractable corpses within range
 */
export function getExtractableBodies(corpses, x, y, range = EXTRACTION_RANGE) {
  const r2 = range * range;
  return corpses.filter((c) => {
    if (!c.extractable) return false;
    const dx = c.x - x;
    const dy = c.y - y;
    return dx * dx + dy * dy <= r2;
  });
}


// ── Extraction Channel ─────────────────────────────────────────────────────
/**
 * Active extraction channels, keyed by `${playerId}::${corpseId}`.
 * Mutable state — owned by the simulation tick loop.
 */
export function createExtractionState() {
  return { channels: new Map() };
}

/**
 * Attempt or continue an extraction channel.
 * @param {object} state — from createExtractionState
 * @param {object} player — { id, x, y }
 * @param {Array} corpses — live corpse array
 * @param {number} tick
 * @returns {{ status: "channeling"|"complete"|"no-target"|"out-of-range", corpse?: object, companion?: object, progress?: number }}
 */
export function attemptExtraction(state, player, corpses, tick) {
  // Find closest extractable corpse in range
  const inRange = getExtractableBodies(corpses, player.x, player.y);
  if (inRange.length === 0) {
    // Cancel any active channel
    for (const key of state.channels.keys()) {
      if (key.startsWith(player.id + "::")) state.channels.delete(key);
    }
    return { status: "no-target" };
  }

  // Pick closest
  let best = inRange[0];
  let bestDist = (best.x - player.x) ** 2 + (best.y - player.y) ** 2;
  for (let i = 1; i < inRange.length; i++) {
    const d = (inRange[i].x - player.x) ** 2 + (inRange[i].y - player.y) ** 2;
    if (d < bestDist) { best = inRange[i]; bestDist = d; }
  }

  const key = `${player.id}::${best.id}`;
  const existing = state.channels.get(key);

  if (existing) {
    // Continue channel — check if still in range
    const dx = best.x - player.x;
    const dy = best.y - player.y;
    if (dx * dx + dy * dy > EXTRACTION_RANGE * EXTRACTION_RANGE) {
      state.channels.delete(key);
      return { status: "out-of-range", corpse: best };
    }

    existing.elapsed += 1;
    if (existing.elapsed >= EXTRACTION_CHANNEL_TICKS) {
      // Complete!
      state.channels.delete(key);
      best.extractable = false;
      const companion = completeExtraction(best, player.level || 1);
      return { status: "complete", corpse: best, companion };
    }
    return { status: "channeling", corpse: best, progress: existing.elapsed / EXTRACTION_CHANNEL_TICKS };
  }

  // Start new channel
  state.channels.set(key, { startTick: tick, elapsed: 1, corpseId: best.id });
  return { status: "channeling", corpse: best, progress: 1 / EXTRACTION_CHANNEL_TICKS };
}

// ── Complete Extraction → Companion ────────────────────────────────────────
let companionSeq = 0;

/**
 * Create a companion entity from a consumed corpse.
 * @param {object} corpse — corpse entity
 * @param {number} playerLevel — influences companion starting stats
 * @returns {object} frozen companion entity
 */
export function completeExtraction(corpse, playerLevel) {
  companionSeq += 1;
  const grade = corpse.sourceGrade || "BASIC";
  const mult = GRADE_COMPANION_MULTIPLIERS[grade] || GRADE_COMPANION_MULTIPLIERS.BASIC;
  const src = corpse.sourceStats;

  const hasRangedSource = src.projectileRange > 0;
  const companionRange = hasRangedSource ? src.projectileRange : mult.defaultRange;

  const companion = {
    id: `extracted-${corpse.sourceEnemyId}-${companionSeq}`,
    sourceId: corpse.sourceEnemyId,
    name: `${nameFromId(corpse.sourceEnemyId)}의 잔향`,
    grade,
    damage: Math.round(src.damage * mult.damageMultiplier),
    fireTicks: Math.max(12, Math.round(src.attackTicks * mult.fireTicksMultiplier)),
    range: companionRange,
    maxHp: Math.round(src.maxHp * mult.hpInheritFraction),
    hp: Math.round(src.maxHp * mult.hpInheritFraction),
    level: 1,
    xp: 0,
    loyalty: mult.loyaltyBase,
    extractedFromGrade: grade,
    extractionOrigin: { x: corpse.x, y: corpse.y, elevation: corpse.elevation },
  };
  return freeze(companion);
}

/** Simple name generation from enemy id. */
function nameFromId(id) {
  return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
