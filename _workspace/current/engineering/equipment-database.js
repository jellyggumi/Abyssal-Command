/**
 * 장비 데이터베이스 — Equipment & Prop Database for 그림자군단
 *
 * Maps prop mesh objects to equippable items with stats and traits.
 * Equipment is usable by player, enemies, bosses, and companions.
 * 15 equipment traits, 3 set bonuses, rarity tiers.
 *
 * [TARGET] All stat values subject to QA balance pass.
 */

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

// ── Equipment Categories ───────────────────────────────────────────────────
export const EQUIPMENT_CATEGORIES = freeze({
  WEAPON:             { id: "WEAPON",             name: "무기" },
  ARMOR:              { id: "ARMOR",              name: "방어구" },
  ACCESSORY:          { id: "ACCESSORY",          name: "장신구" },
  CONSUMABLE:         { id: "CONSUMABLE",         name: "소모품" },
  TERRAIN_DECORATION: { id: "TERRAIN_DECORATION", name: "지형물" },
});

// ── Equipment Traits ───────────────────────────────────────────────────────
export const EQUIPMENT_TRAITS = freeze({
  "fire-damage":      { id: "fire-damage",      name: "화염피해",     description: "공격 시 추가 화염 피해",     effect: { field: "fireDamage",       value: 30 } },
  "life-steal":       { id: "life-steal",       name: "생명력흡수",   description: "피해의 일부를 HP로 회복",     effect: { field: "lifeStealPct",     value: 5 } },
  "aoe-boost":        { id: "aoe-boost",        name: "범위강화",     description: "AoE 범위 +15%",             effect: { field: "aoeRadiusPct",     value: 15 } },
  "speed-boost":      { id: "speed-boost",      name: "속도강화",     description: "이동속도 +8%",              effect: { field: "speedPct",         value: 8 } },
  "defense-pierce":   { id: "defense-pierce",   name: "방어관통",     description: "대상 방어력 20% 무시",       effect: { field: "defensePiercePct", value: 20 } },
  "crit-enhance":     { id: "crit-enhance",     name: "치명강화",     description: "치명타 확률 +300bp",        effect: { field: "critChanceBp",     value: 300 } },
  "hp-regen":         { id: "hp-regen",         name: "생명력재생",   description: "초당 HP 0.5% 재생",          effect: { field: "hpRegenPctSec",    value: 0.5 } },
  "cooldown-reduce":  { id: "cooldown-reduce",  name: "쿨다운감소",   description: "스킬 쿨다운 -8%",           effect: { field: "cooldownPct",      value: 8 } },
  "range-extend":     { id: "range-extend",     name: "사거리확장",   description: "공격 사거리 +10%",          effect: { field: "rangePct",         value: 10 } },
  "shadow-veil":      { id: "shadow-veil",      name: "그림자장막",   description: "피격 시 5% 확률 회피",       effect: { field: "evadeChancePct",   value: 5 } },
  "echo-amplify":     { id: "echo-amplify",     name: "메아리증폭",   description: "스킬 피해 +12%",            effect: { field: "skillDamagePct",   value: 12 } },
  "gate-fortify":     { id: "gate-fortify",     name: "관문강화",     description: "관문 내구 +60",             effect: { field: "gateIntegrity",    value: 60 } },
  "extraction-boost": { id: "extraction-boost", name: "추출강화",     description: "추출 시간 -20%",            effect: { field: "extractTimePct",   value: 20 } },
  "loyalty-bond":     { id: "loyalty-bond",     name: "충성결속",     description: "동료 충성도 감소 -30%",      effect: { field: "loyaltyDecayPct",  value: 30 } },
  "soul-link":        { id: "soul-link",        name: "영혼연결",     description: "추출 동료 초기 스탯 +10%",   effect: { field: "extractStatsPct",  value: 10 } },
});

// ── Equipment Set Bonuses ──────────────────────────────────────────────────
export const EQUIPMENT_SETS = freeze({
  "shadow-set": {
    id: "shadow-set", name: "그림자 세트",
    pieces: ["shadow-helm", "shadow-plate", "shadow-ring"],
    bonuses: {
      2: { description: "피해 +10%", effect: { damagePct: 10 } },
      3: { description: "그림자 범위 공격 추가 발동", effect: { shadowAoe: true, damagePct: 10 } },
    },
  },
  "echo-set": {
    id: "echo-set", name: "메아리 세트",
    pieces: ["echo-crown", "echo-gauntlets", "echo-amulet"],
    bonuses: {
      2: { description: "사거리 +15%", effect: { rangePct: 15 } },
      3: { description: "메아리 연쇄타 추가", effect: { echoChain: true, rangePct: 15 } },
    },
  },
  "gate-set": {
    id: "gate-set", name: "관문 세트",
    pieces: ["gate-boots", "gate-cape", "gate-sigil"],
    bonuses: {
      2: { description: "방어력 +20%", effect: { defensePct: 20 } },
      3: { description: "관문 강화 주기적 발동", effect: { gateFortify: true, defensePct: 20 } },
    },
  },
});

// ── Equipment Database ─────────────────────────────────────────────────────
export const EQUIPMENT_DB = freeze({
  // ─── Weapons (from prop meshes + authored) ───
  "cinder-blade": {
    id: "cinder-blade", name: "잿빛 칼날", category: "WEAPON", subcategory: "sword",
    meshPath: "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb",
    stats: { attack: 140, defense: 0, hp: 0, speed: 0, critChanceBp: 200, critMultiplierBp: 15000, range: 900 },
    traits: ["fire-damage"], equipSlot: "weapon",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "common", level: 1,
  },
  "abyss-relic-staff": {
    id: "abyss-relic-staff", name: "심연 유물 지팡이", category: "WEAPON", subcategory: "staff",
    meshPath: "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb",
    stats: { attack: 170, defense: 0, hp: 0, speed: 0, critChanceBp: 300, critMultiplierBp: 17000, range: 6000 },
    traits: ["echo-amplify"], equipSlot: "weapon",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "uncommon", level: 5,
  },
  "void-cleaver": {
    id: "void-cleaver", name: "공허의 대검", category: "WEAPON", subcategory: "greatsword",
    meshPath: null,
    stats: { attack: 200, defense: 5, hp: 0, speed: -100, critChanceBp: 400, critMultiplierBp: 18000, range: 900 },
    traits: ["defense-pierce"], equipSlot: "weapon",
    gradeRequirement: "SHADOW", equippableBy: ["player", "boss", "companion"],
    rarity: "rare", level: 10,
  },
  "echo-lance": {
    id: "echo-lance", name: "메아리 창", category: "WEAPON", subcategory: "lance",
    meshPath: null,
    stats: { attack: 160, defense: 0, hp: 0, speed: 50, critChanceBp: 250, critMultiplierBp: 16000, range: 3000 },
    traits: ["range-extend"], equipSlot: "weapon",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "uncommon", level: 5,
  },
  "sovereign-edge": {
    id: "sovereign-edge", name: "군주의 칼날", category: "WEAPON", subcategory: "sword",
    meshPath: null,
    stats: { attack: 280, defense: 10, hp: 0, speed: 0, critChanceBp: 600, critMultiplierBp: 20000, range: 900 },
    traits: ["fire-damage", "crit-enhance"], equipSlot: "weapon",
    gradeRequirement: "BOSS", equippableBy: ["player", "boss"],
    rarity: "legendary", level: 20,
  },

  // ─── Armor ───
  "shadow-helm": {
    id: "shadow-helm", name: "그림자 투구", category: "ARMOR", subcategory: "helmet",
    meshPath: null,
    stats: { attack: 0, defense: 25, hp: 200, speed: 0, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["shadow-veil"], equipSlot: "head",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "uncommon", level: 3,
  },
  "shadow-plate": {
    id: "shadow-plate", name: "그림자 흉갑", category: "ARMOR", subcategory: "chestplate",
    meshPath: null,
    stats: { attack: 0, defense: 45, hp: 500, speed: -80, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["shadow-veil", "hp-regen"], equipSlot: "body",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "rare", level: 8,
  },
  "echo-crown": {
    id: "echo-crown", name: "메아리 왕관", category: "ARMOR", subcategory: "helmet",
    meshPath: null,
    stats: { attack: 20, defense: 15, hp: 150, speed: 0, critChanceBp: 200, critMultiplierBp: 0, range: 0 },
    traits: ["echo-amplify"], equipSlot: "head",
    gradeRequirement: null, equippableBy: ["player", "companion"],
    rarity: "rare", level: 10,
  },
  "gate-boots": {
    id: "gate-boots", name: "관문 장화", category: "ARMOR", subcategory: "boots",
    meshPath: null,
    stats: { attack: 0, defense: 20, hp: 100, speed: 200, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["speed-boost"], equipSlot: "feet",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "common", level: 1,
  },
  "echo-gauntlets": {
    id: "echo-gauntlets", name: "메아리 건틀릿", category: "ARMOR", subcategory: "gauntlets",
    meshPath: null,
    stats: { attack: 30, defense: 18, hp: 80, speed: 0, critChanceBp: 150, critMultiplierBp: 0, range: 200 },
    traits: ["aoe-boost"], equipSlot: "hands",
    gradeRequirement: null, equippableBy: ["player", "enemy", "companion"],
    rarity: "uncommon", level: 5,
  },
  "warden-cuirass": {
    id: "warden-cuirass", name: "수호자 갑옷", category: "ARMOR", subcategory: "chestplate",
    meshPath: null,
    stats: { attack: 0, defense: 60, hp: 800, speed: -150, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["hp-regen", "gate-fortify"], equipSlot: "body",
    gradeRequirement: "SHADOW", equippableBy: ["player", "boss"],
    rarity: "epic", level: 15,
  },
  "cinder-greaves": {
    id: "cinder-greaves", name: "잿빛 경갑", category: "ARMOR", subcategory: "boots",
    meshPath: null,
    stats: { attack: 0, defense: 30, hp: 120, speed: 150, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["fire-damage", "speed-boost"], equipSlot: "feet",
    gradeRequirement: null, equippableBy: ["player", "enemy", "companion"],
    rarity: "rare", level: 8,
  },
  "abyss-gauntlets": {
    id: "abyss-gauntlets", name: "심연 건틀릿", category: "ARMOR", subcategory: "gauntlets",
    meshPath: null,
    stats: { attack: 50, defense: 22, hp: 60, speed: 0, critChanceBp: 300, critMultiplierBp: 16000, range: 0 },
    traits: ["crit-enhance", "defense-pierce"], equipSlot: "hands",
    gradeRequirement: "SHADOW", equippableBy: ["player", "boss", "companion"],
    rarity: "epic", level: 12,
  },

  // ─── Accessories ───
  "shadow-ring": {
    id: "shadow-ring", name: "그림자 반지", category: "ACCESSORY", subcategory: "ring",
    meshPath: null,
    stats: { attack: 15, defense: 8, hp: 50, speed: 0, critChanceBp: 200, critMultiplierBp: 15000, range: 0 },
    traits: ["shadow-veil"], equipSlot: "accessory1",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "common", level: 1,
  },
  "echo-amulet": {
    id: "echo-amulet", name: "메아리 목걸이", category: "ACCESSORY", subcategory: "amulet",
    meshPath: null,
    stats: { attack: 25, defense: 5, hp: 80, speed: 0, critChanceBp: 100, critMultiplierBp: 0, range: 300 },
    traits: ["echo-amplify", "cooldown-reduce"], equipSlot: "accessory1",
    gradeRequirement: null, equippableBy: ["player", "companion"],
    rarity: "rare", level: 8,
  },
  "gate-cape": {
    id: "gate-cape", name: "관문 망토", category: "ACCESSORY", subcategory: "cape",
    meshPath: null,
    stats: { attack: 0, defense: 35, hp: 300, speed: 100, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["gate-fortify", "hp-regen"], equipSlot: "accessory2",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "uncommon", level: 5,
  },
  "gate-sigil": {
    id: "gate-sigil", name: "관문 인장", category: "ACCESSORY", subcategory: "sigil",
    meshPath: null,
    stats: { attack: 10, defense: 20, hp: 150, speed: 0, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["gate-fortify"], equipSlot: "accessory2",
    gradeRequirement: null, equippableBy: ["player", "enemy", "boss", "companion"],
    rarity: "common", level: 1,
  },
  "extractor-charm": {
    id: "extractor-charm", name: "추출자의 부적", category: "ACCESSORY", subcategory: "charm",
    meshPath: null,
    stats: { attack: 0, defense: 0, hp: 40, speed: 0, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["extraction-boost", "soul-link"], equipSlot: "accessory1",
    gradeRequirement: null, equippableBy: ["player"],
    rarity: "rare", level: 6,
  },
  "loyalty-pendant": {
    id: "loyalty-pendant", name: "충성의 펜던트", category: "ACCESSORY", subcategory: "amulet",
    meshPath: null,
    stats: { attack: 0, defense: 10, hp: 100, speed: 0, critChanceBp: 0, critMultiplierBp: 0, range: 0 },
    traits: ["loyalty-bond", "soul-link"], equipSlot: "accessory2",
    gradeRequirement: null, equippableBy: ["player", "companion"],
    rarity: "uncommon", level: 4,
  },

  // ─── Terrain Decorations (non-equippable) ───
  "seal-brand-landmark": {
    id: "seal-brand-landmark", name: "봉인 각인", category: "TERRAIN_DECORATION", subcategory: "landmark",
    meshPath: "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb",
    stats: null, traits: [], equipSlot: null,
    gradeRequirement: null, equippableBy: [],
    rarity: "common", level: 0,
  },
  "forge-relic-landmark": {
    id: "forge-relic-landmark", name: "용광로 유물", category: "TERRAIN_DECORATION", subcategory: "relic",
    meshPath: "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb",
    stats: null, traits: [], equipSlot: null,
    gradeRequirement: null, equippableBy: [],
    rarity: "common", level: 0,
  },
});

// ── Lookup Helpers ─────────────────────────────────────────────────────────
const _byId = Object.freeze(Object.fromEntries(Object.values(EQUIPMENT_DB).map((e) => [e.id, e])));

export function equipmentById(id) { return _byId[id] || null; }

export function equipmentBySlot(slot) {
  return freeze(Object.values(EQUIPMENT_DB).filter((e) => e.equipSlot === slot));
}

export function equipmentByCategory(cat) {
  return freeze(Object.values(EQUIPMENT_DB).filter((e) => e.category === cat));
}

/**
 * Calculate combined stat block from an array of equipped items.
 * @param {Array|null} equippedItems — array of equipment entries from EQUIPMENT_DB
 * @returns {object} aggregated stats
 */
export function calculateEquipmentStats(equippedItems) {
  const totals = { attack: 0, defense: 0, hp: 0, speed: 0, critChanceBp: 0, critMultiplierBp: 0, range: 0 };
  const traitEffects = {};

  const equipped = Array.isArray(equippedItems) ? equippedItems : [];
  const additiveStats = ["attack", "defense", "hp", "speed", "critChanceBp", "range"];
  let critMultiplierBpFromWeapon = 0;
  let critMultiplierBpFromOther = 0;

  for (const item of equipped) {
    if (!item || !item.stats) continue;

    for (const key of additiveStats) {
      totals[key] += item.stats[key] || 0;
    }

    const critMultiplierBp = item.stats.critMultiplierBp || 0;
    if (critMultiplierBp > 0) {
      if (item.equipSlot === "weapon") {
        critMultiplierBpFromWeapon = Math.max(critMultiplierBpFromWeapon, critMultiplierBp);
      } else {
        critMultiplierBpFromOther = Math.max(critMultiplierBpFromOther, critMultiplierBp);
      }
    }

    for (const traitId of (item.traits || [])) {
      const trait = EQUIPMENT_TRAITS[traitId];
      if (trait) {
        const f = trait.effect.field;
        traitEffects[f] = (traitEffects[f] || 0) + trait.effect.value;
      }
    }
  }

  // Crit multiplier is a full-scale stat. Keep one active base multiplier only:
  // weapon slot first (primary scaling source), then highest non-weapon fallback.
  totals.critMultiplierBp = critMultiplierBpFromWeapon || critMultiplierBpFromOther;

  // Check set bonuses
  const activeSets = {};
  for (const set of Object.values(EQUIPMENT_SETS)) {
    const count = set.pieces.filter((pid) => equipped.some((e) => e && e.id === pid)).length;
    if (count >= 2) activeSets[set.id] = { count, bonuses: {} };
    for (const [threshold, bonus] of Object.entries(set.bonuses)) {
      if (count >= Number(threshold) && activeSets[set.id]) {
        Object.assign(activeSets[set.id].bonuses, bonus.effect);
      }
    }
  }

  return freeze({ stats: totals, traitEffects, activeSets });
}
