/**
 * 무기 & 아이탬 시스템 — Item/Weapon Catalog for 그림자군단
 *
 * Three weapon range categories: MELEE (근거리), MID_RANGE (중거리), RANGED (원거리).
 * All attacks are non-targeting (논타겟팅 / 범위공격) AoE patterns.
 * Each weapon defines its own AoE shape, reach, hit style, and max targets.
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

// ── Range Categories ───────────────────────────────────────────────────────
export const WEAPON_RANGE_CATEGORIES = freeze({
  MELEE:     { id: "MELEE",     name: "근거리", reach: 900,  description: "전방 호형 범위 공격" },
  MID_RANGE: { id: "MID_RANGE", name: "중거리", reach: 3000, description: "관통/연쇄 범위 공격" },
  RANGED:    { id: "RANGED",    name: "원거리", reach: 6000, description: "투사체 폭발 범위 공격" },
});

// ── AoE Patterns ───────────────────────────────────────────────────────────
export const AOE_PATTERNS = freeze({
  FRONTAL_ARC:   { id: "FRONTAL_ARC",   type: "cone",      angleDeg: 180, description: "전방 반원 범위" },
  NARROW_CONE:   { id: "NARROW_CONE",   type: "cone",      angleDeg: 60,  description: "좁은 전방 원뿔" },
  PIERCING_LINE: { id: "PIERCING_LINE", type: "line",      widthWu: 400,  description: "관통 직선" },
  EXPLOSION:     { id: "EXPLOSION",     type: "circle",    radiusWu: 1200, description: "폭발 원형 범위" },
  CHAIN:         { id: "CHAIN",         type: "chain",     bounces: 3,    description: "연쇄 타격" },
});

// ── Hit Styles ─────────────────────────────────────────────────────────────
export const HIT_STYLES = freeze({
  SLASH:   { id: "SLASH",   name: "참격",   description: "베기 피격 효과" },
  SMASH:   { id: "SMASH",   name: "강타",   description: "내려찍기 피격 효과" },
  THRUST:  { id: "THRUST",  name: "찌르기", description: "관통 피격 효과" },
  CHAIN:   { id: "CHAIN",   name: "연쇄",   description: "연쇄 전이 피격 효과" },
  BLAST:   { id: "BLAST",   name: "폭발",   description: "폭발 충격 피격 효과" },
  PIERCE:  { id: "PIERCE",  name: "관통",   description: "꿰뚫기 피격 효과" },
});

// ── Equipment Slots ────────────────────────────────────────────────────────
export const EQUIPMENT_SLOTS = freeze({
  weapon:     { id: "weapon",     name: "무기",      max: 1 },
  head:       { id: "head",       name: "머리",      max: 1 },
  body:       { id: "body",       name: "몸통",      max: 1 },
  hands:      { id: "hands",      name: "손",        max: 1 },
  feet:       { id: "feet",       name: "발",        max: 1 },
  accessory1: { id: "accessory1", name: "장신구1",   max: 1 },
  accessory2: { id: "accessory2", name: "장신구2",   max: 1 },
});

// ── Item Types ─────────────────────────────────────────────────────────────
export const ITEM_TYPES = freeze({
  WEAPON:     { id: "WEAPON",     name: "무기" },
  ARMOR:      { id: "ARMOR",      name: "방어구" },
  ACCESSORY:  { id: "ACCESSORY",  name: "장신구" },
  CONSUMABLE: { id: "CONSUMABLE", name: "소모품" },
});

// ── Weapon Definitions ─────────────────────────────────────────────────────
// 12 weapons: 4 per range category. [TARGET] balance values.
export const WEAPONS = freeze({
  // ─── MELEE (근거리) ───
  "shadow-blade": {
    id: "shadow-blade", name: "그림자검", rangeCategory: "MELEE",
    baseDamage: 140, attackSpeedTicks: 30, reach: 900,
    aoePattern: { type: "cone", angleDeg: 180, maxTargets: 5 },
    hitStyle: "SLASH", equipSlot: "weapon",
    modelHint: "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb",
  },
  "ember-axe": {
    id: "ember-axe", name: "불씨도끼", rangeCategory: "MELEE",
    baseDamage: 180, attackSpeedTicks: 42, reach: 900,
    aoePattern: { type: "cone", angleDeg: 180, maxTargets: 5 },
    hitStyle: "SMASH", equipSlot: "weapon",
    modelHint: null,
  },
  "void-mace": {
    id: "void-mace", name: "공허철퇴", rangeCategory: "MELEE",
    baseDamage: 200, attackSpeedTicks: 48, reach: 900,
    aoePattern: { type: "cone", angleDeg: 180, maxTargets: 4 },
    hitStyle: "SMASH", equipSlot: "weapon",
    modelHint: null,
  },
  "abyss-fang": {
    id: "abyss-fang", name: "심연송곳니", rangeCategory: "MELEE",
    baseDamage: 120, attackSpeedTicks: 24, reach: 900,
    aoePattern: { type: "cone", angleDeg: 180, maxTargets: 6 },
    hitStyle: "SLASH", equipSlot: "weapon",
    modelHint: null,
  },

  // ─── MID_RANGE (중거리) ───
  "chain-lance": {
    id: "chain-lance", name: "쇄사창", rangeCategory: "MID_RANGE",
    baseDamage: 160, attackSpeedTicks: 36, reach: 3000,
    aoePattern: { type: "line", widthWu: 400, maxTargets: 3 },
    hitStyle: "THRUST", equipSlot: "weapon",
    modelHint: null,
  },
  "echo-whip": {
    id: "echo-whip", name: "메아리채찍", rangeCategory: "MID_RANGE",
    baseDamage: 130, attackSpeedTicks: 30, reach: 3000,
    aoePattern: { type: "chain", bounces: 3, maxTargets: 3 },
    hitStyle: "CHAIN", equipSlot: "weapon",
    modelHint: null,
  },
  "rift-halberd": {
    id: "rift-halberd", name: "균열미늘창", rangeCategory: "MID_RANGE",
    baseDamage: 190, attackSpeedTicks: 44, reach: 3000,
    aoePattern: { type: "cone", angleDeg: 60, maxTargets: 3 },
    hitStyle: "THRUST", equipSlot: "weapon",
    modelHint: null,
  },
  "veil-glaive": {
    id: "veil-glaive", name: "장막언월도", rangeCategory: "MID_RANGE",
    baseDamage: 150, attackSpeedTicks: 36, reach: 3000,
    aoePattern: { type: "cone", angleDeg: 60, maxTargets: 4 },
    hitStyle: "SLASH", equipSlot: "weapon",
    modelHint: null,
  },

  // ─── RANGED (원거리) ───
  "soul-bow": {
    id: "soul-bow", name: "혼궁", rangeCategory: "RANGED",
    baseDamage: 110, attackSpeedTicks: 30, reach: 6000,
    aoePattern: { type: "circle", radiusWu: 800, maxTargets: 6 },
    hitStyle: "PIERCE", equipSlot: "weapon",
    modelHint: null,
  },
  "grave-staff": {
    id: "grave-staff", name: "묘지팡이", rangeCategory: "RANGED",
    baseDamage: 170, attackSpeedTicks: 48, reach: 6000,
    aoePattern: { type: "circle", radiusWu: 1200, maxTargets: 8 },
    hitStyle: "BLAST", equipSlot: "weapon",
    modelHint: "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb",
  },
  "storm-crossbow": {
    id: "storm-crossbow", name: "폭풍쇠뇌", rangeCategory: "RANGED",
    baseDamage: 140, attackSpeedTicks: 36, reach: 6000,
    aoePattern: { type: "line", widthWu: 300, maxTargets: 5 },
    hitStyle: "PIERCE", equipSlot: "weapon",
    modelHint: null,
  },
  "dawn-cannon": {
    id: "dawn-cannon", name: "여명포", rangeCategory: "RANGED",
    baseDamage: 220, attackSpeedTicks: 60, reach: 6000,
    aoePattern: { type: "circle", radiusWu: 1500, maxTargets: 10 },
    hitStyle: "BLAST", equipSlot: "weapon",
    modelHint: null,
  },
});

/**
 * Filter weapons by range category.
 * @param {"MELEE"|"MID_RANGE"|"RANGED"} category
 * @returns {object[]} frozen array of matching weapon entries
 */
export function weaponsByRange(category) {
  return freeze(Object.values(WEAPONS).filter((w) => w.rangeCategory === category));
}
