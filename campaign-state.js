import {
  CARRY_OVER_MAX_ITEMS, CARRY_OVER_MAX_RANK, COMPANIONS, ITEMS, REWARDS, SKILLS, STAGE_REWARD_IDS,
  COMPANION_CAPACITY_BASE, COMPANION_CAPACITY_MAX, COMPANION_SLOT_UNLOCKS, companionSlotUnlockFor,
} from "./defense-catalog.js";
import {
  WARDEN_STATS, wardenStatTotalCost, WARDEN_SKILL_TREE,
  WARDEN_TRAITS, WARDEN_TRAIT_UNLOCK_SEQUENCES, wardenTraitOffersForSequence,
  EQUIPMENT_SLOTS, EQUIPMENT_TIERS, EQUIPMENT_TIER_UPGRADE_COST,
  MAX_FRONT_SLOTS, FORMATION_SLOTS, deriveWardenRuntimeStats, deriveCompanionRuntimeStats,
} from "./rpg-catalog.js";
import { STAGE_STORIES, stageStoryFor } from "./stage-story-catalog.js";

export const RULES_VERSION = "defense-survivor-v1";
export const IDLE_RETURN_VERSION = 1;
export const IDLE_RETURN_INTERVAL_MS = 60_000;
export const IDLE_RETURN_MAX_ELAPSED_MS = 8 * 60 * 60 * 1000;
export const STAGES = Object.freeze([
  Object.freeze({ id: "cinder-span", name: "Cinder Span", bossName: "Cinder Warden", sequence: 1 }),
  Object.freeze({ id: "abyss-chancel", name: "Abyss Chancel", bossName: "Veil Tactician", sequence: 2 }),
  Object.freeze({ id: "echo-throne", name: "Echo Throne", bossName: "Gate Sovereign", sequence: 3 }),
]);
const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index]));
/**
 * Legion capacity (core-loop-legion-spec.md §3). `MAX_LOADOUT_SIZE` used to be the single hard
 * bound; it is now the BASE capacity, and the effective bound is derived per campaign from the
 * unlocked-slot ladder. Re-exported so the lobby UI binds to one source of truth instead of
 * re-deriving the ladder.
 */
const MAX_LOADOUT_SIZE = COMPANION_CAPACITY_BASE;
export { COMPANION_CAPACITY_BASE, COMPANION_CAPACITY_MAX, COMPANION_SLOT_UNLOCKS };
export const MAX_EXTRACTED_SKILL_LOADOUT = 3;
export const MAX_EXTRACTED_SKILL_LEVEL = 5;
/** Warden equipment owner id — verified disjoint from every COMPANIONS prototype id. */
const WARDEN_OWNER_ID = "warden";
let campaignSequence = 0;
const fail = (message) => { throw new TypeError(message); };
const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const hasOnlyKeys = (value, keys) => Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const validIds = (ids) => Array.isArray(ids) && ids.every(isNonEmptyString) && new Set(ids).size === ids.length;
const canonicalPrototype = (prototype) => isNonEmptyString(prototype) && Object.hasOwn(COMPANIONS, prototype);
const isTimestamp = (value) => Number.isSafeInteger(value) && value >= 0;
function copyIdleReturn(idleReturn) {
  return { version: idleReturn.version, lastSettledAt: idleReturn.lastSettledAt, totalProgress: idleReturn.totalProgress };
}
function idleReceipt(outcome, { requestedAt = null, elapsedMs = 0, settledElapsedMs = 0, completedStages = 0, awardedProgress = 0, settledAt = null } = {}) {
  return Object.freeze({ outcome, requestedAt, elapsedMs, settledElapsedMs, completedStages, awardedProgress, settledAt });
}

// --- RPG layer (Solo Warden concept, `_workspace/20260723-solo-warden-rpg-concept/`) ---
const initialWardenProgress = () => ({ statPoints: {}, skillTreeIds: [], traitIds: [] });
/**
 * Stage-to-stage carry-over (스킬/아이템 효과 이어가기). A victory persists the in-run build the
 * simulation hands back through `runCarryOver()`; the next `createDefenseRun` re-applies it.
 * A defeat clears it, so carry-over is a reward for closing a stage, never a floor.
 */
export const CARRY_OVER_VERSION = 1;
const initialStageCarryOver = () => ({ version: CARRY_OVER_VERSION, stageId: null, skillRanks: {}, itemIds: [] });
export const STORY_PROGRESS_VERSION = 1;
const initialStoryProgress = (resolvedIds = []) => {
  const completedStages = new Set(resolvedIds);
  const storyProgress = {
    version: STORY_PROGRESS_VERSION,
    questCompletionsByStage: {},
    extractedSkillIds: [],
    extractedSkillLevels: {},
    activeSkillLoadout: [],
    appearanceItemIds: [],
    equippedAppearance: {},
  };
  for (const stage of STAGES) {
    if (!completedStages.has(stage.id)) continue;
    const story = stageStoryFor(stage.id);
    if (!story) continue;
    storyProgress.questCompletionsByStage[stage.id] = true;
    storyProgress.extractedSkillIds.push(story.extractionReward.skillId);
    storyProgress.extractedSkillLevels[story.extractionReward.skillId] = story.extractionReward.level;
    storyProgress.appearanceItemIds.push(story.appearanceReward.id);
    if (!storyProgress.equippedAppearance[story.appearanceReward.slot]) {
      storyProgress.equippedAppearance[story.appearanceReward.slot] = story.appearanceReward.id;
    }
  }
  storyProgress.extractedSkillIds.sort();
  storyProgress.appearanceItemIds.sort();
  return storyProgress;
};
function copyStoryProgress(storyProgress) {
  return {
    version: storyProgress.version,
    questCompletionsByStage: { ...storyProgress.questCompletionsByStage },
    extractedSkillIds: [...storyProgress.extractedSkillIds],
    extractedSkillLevels: { ...storyProgress.extractedSkillLevels },
    activeSkillLoadout: [...storyProgress.activeSkillLoadout],
    appearanceItemIds: [...storyProgress.appearanceItemIds],
    equippedAppearance: { ...storyProgress.equippedAppearance },
  };
}
function copyStageCarryOver(stageCarryOver) {
  return {
    version: stageCarryOver.version,
    stageId: stageCarryOver.stageId,
    skillRanks: { ...stageCarryOver.skillRanks },
    itemIds: [...stageCarryOver.itemIds],
  };
}
function validStageCarryOver(stageCarryOver) {
  if (!isPlainObject(stageCarryOver) || !hasOnlyKeys(stageCarryOver, ["version", "stageId", "skillRanks", "itemIds"])) return false;
  if (stageCarryOver.version !== CARRY_OVER_VERSION) return false;
  if (stageCarryOver.stageId !== null && !STAGE_INDEX.has(stageCarryOver.stageId)) return false;
  if (!isPlainObject(stageCarryOver.skillRanks)) return false;
  if (!Object.entries(stageCarryOver.skillRanks).every(([skillId, rank]) =>
    Object.hasOwn(SKILLS, skillId) && Number.isInteger(rank) && rank >= 1 && rank <= CARRY_OVER_MAX_RANK)) return false;
  return validIds(stageCarryOver.itemIds)
    && stageCarryOver.itemIds.length <= CARRY_OVER_MAX_ITEMS
    && stageCarryOver.itemIds.every((itemId) => Object.hasOwn(ITEMS, itemId));
}
function copyWardenProgress(wardenProgress) {
  return {
    statPoints: { ...wardenProgress.statPoints },
    skillTreeIds: [...wardenProgress.skillTreeIds],
    traitIds: [...wardenProgress.traitIds],
  };
}
function copyCompanionFormation(companionFormation) { return { ...companionFormation }; }

/** Echo Core earned so far: 1 per distinct captured elite id (elite extract, stage-capped at 10) + 3 per resolved stage (boss kill, capped at 30) — UNIFIED-GDD.md §3.2, campaign budget 40. */
export function echoCoreEarned(campaign) {
  const capturedEliteCount = Math.min(STAGES.length, new Set(campaign.companionCollection.flatMap((record) => record.capturedEliteIds)).size);
  return capturedEliteCount + campaign.resolvedIds.length * 3;
}
/**
 * Bound Fragment earned so far.
 *
 * Cycle 9 correction (`N-20260730-C9-01`). This was `resolvedIds.length` with a comment claiming
 * "max 10" — a stale assumption inherited from a larger stage list. `STAGES.length` is **3**, so the
 * real lifetime pool was **3** [OBSERVED], against a slot ladder costing 16 and a single equipment
 * line to T5 costing 10. The capacity feature was unfundable by a factor of five, and the "max 10"
 * comment is why two separate audits mis-stated the budget instead of measuring it.
 *
 * The shape now mirrors `echoCoreEarned` above — a per-stage multiplier plus a distinct-elite term —
 * so both Track A and Track B earn on the same rhythm rather than one being silently starved:
 *
 *   3 per resolved stage (boss kill)      -> 9 at full clear
 * + 1 per distinct captured elite         -> 3 at full clear (stage-capped, as echoCore does)
 * = 12 lifetime maximum
 *
 * Against a repriced ladder of 7 (see COMPANION_SLOT_UNLOCKS) that leaves 5 toward equipment, so
 * capacity 10 is reachable and the slot/equipment tradeoff stays real instead of being decided by
 * an arithmetic impossibility.
 *
 * [TARGET] Raising an earn rate is a G5 (매출·밸런스 시너지) input. It is a deliberate, recorded
 * economy change, not a tuning nudge — see the negotiation record.
 */
export function boundFragmentEarned(campaign) {
  const capturedEliteCount = Math.min(
    STAGES.length,
    new Set(campaign.companionCollection.flatMap((record) => record.capturedEliteIds)).size,
  );
  return campaign.resolvedIds.length * 3 + capturedEliteCount;
}
export function echoCoreSpent(campaign) {
  const statCost = Object.values(campaign.wardenProgress.statPoints).reduce((sum, points) => sum + wardenStatTotalCost(points), 0);
  const skillCost = campaign.wardenProgress.skillTreeIds.reduce((sum, id) => sum + (WARDEN_SKILL_TREE[id]?.cost ?? 0), 0);
  const extractedSkillCost = Object.values(campaign.storyProgress?.extractedSkillLevels ?? {})
    .reduce((sum, level) => sum + extractedSkillSpentAtLevel(level), 0);
  return statCost + skillCost + extractedSkillCost;
}
/**
 * Bound Fragment spent so far. Equipment tiers and companion slots draw on the SAME currency, which
 * is the budget conflict spec §3 escalated to PM rather than silently resolving: earning is
 * `resolvedIds.length` (max 10) while a full slot ladder costs 16 cumulative, and one equipment line
 * to T5 already costs 10. Both spends are counted here so the shared budget is enforced honestly and
 * the shortfall surfaces as an unaffordable purchase instead of a hidden overdraft.
 */
export function boundFragmentSpent(campaign) {
  const equipmentCost = campaign.ownedEquipmentIds.reduce((sum, id) => {
    const stepIndex = Number(id.split(":")[2]);
    return sum + (EQUIPMENT_TIER_UPGRADE_COST[stepIndex] ?? 0);
  }, 0);
  return equipmentCost + companionSlotSpent(campaign.unlockedCompanionSlots ?? 0);
}

/** Cumulative Bound Fragment cost of the first `unlockedSlots` ladder rows. */
function companionSlotSpent(unlockedSlots) {
  return COMPANION_SLOT_UNLOCKS.slice(0, unlockedSlots).reduce((sum, entry) => sum + entry.boundFragmentCost, 0);
}

/** Unlocked extra slots beyond the base (0..7). Slots are contiguous, so a count IS the full state. */
export function companionSlotsUnlocked(campaign) {
  return Math.min(campaign.unlockedCompanionSlots ?? 0, COMPANION_SLOT_UNLOCKS.length);
}

/**
 * Derived legion capacity for this campaign: base 3 plus every unlocked slot, hard-capped at 10.
 *
 * This is the MUTATION-TIME bound (spec §3). It is deliberately NOT used by `validCampaign()`: that
 * function checks loadout length at line 281 BEFORE it validates `resolvedIds` at line 282, so a
 * resolver called there would let a tampered save self-certify its own capacity from fields that
 * have not been validated yet. Load time uses the literal ceiling instead. Three checkpoints, three
 * different bounds, on purpose.
 */
export function companionCapacityForCampaign(campaign) {
  return Math.min(COMPANION_CAPACITY_BASE + companionSlotsUnlocked(campaign), COMPANION_CAPACITY_MAX);
}

/**
 * The next purchasable slot and whether it is currently attainable, or null at max capacity.
 * Exposed so the lobby renders the unlock button from one source of truth rather than re-deriving
 * the (contested, PM-owned) ladder numbers.
 */
export function companionSlotUnlockCostFor(campaign) {
  const nextSlot = COMPANION_CAPACITY_BASE + companionSlotsUnlocked(campaign) + 1;
  const entry = companionSlotUnlockFor(nextSlot);
  if (!entry) return null;
  const stageGateMet = campaign.resolvedIds.length >= entry.requiresStageClears;
  const remainingBudget = boundFragmentEarned(campaign) - boundFragmentSpent(campaign);
  return {
    slot: entry.slot,
    requiresStageClears: entry.requiresStageClears,
    boundFragmentCost: entry.boundFragmentCost,
    stageGateMet,
    affordable: remainingBudget >= entry.boundFragmentCost,
  };
}
/** 0-based tier index (0=T1 baseline .. 4=T5) currently owned for an owner+slot pair. */
export function equipmentTierIndexFor(campaign, ownerId, slot) {
  const prefix = `${ownerId}:${slot}:`;
  return campaign.ownedEquipmentIds.filter((id) => id.startsWith(prefix)).length;
}
function equipmentTiersFor(campaign, ownerId) {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, equipmentTierIndexFor(campaign, ownerId, slot)]));
}
export function wardenRuntimeStatsForCampaign(campaign) {
  return deriveWardenRuntimeStats({ ...campaign.wardenProgress, equipment: equipmentTiersFor(campaign, WARDEN_OWNER_ID) });
}
export function companionRuntimeStatsForCampaign(campaign, companionId) {
  return deriveCompanionRuntimeStats(companionId, { equipment: equipmentTiersFor(campaign, companionId) });
}
/** FRONT/BACK slot for a loadout companion; defaults to BACK when unassigned (legacy-compatible, matches formation-sim §4.2). */
export function companionFormationSlot(campaign, prototypeId) { return campaign.companionFormation[prototypeId] || "BACK"; }

function validWardenProgress(campaign, wardenProgress) {
  if (!isPlainObject(wardenProgress) || !hasOnlyKeys(wardenProgress, ["statPoints", "skillTreeIds", "traitIds"])) return false;
  if (!isPlainObject(wardenProgress.statPoints)) return false;
  if (!Object.entries(wardenProgress.statPoints).every(([statId, points]) => Object.hasOwn(WARDEN_STATS, statId) && Number.isInteger(points) && points >= 0 && points <= WARDEN_STATS[statId].maxPoints)) return false;
  if (!validIds(wardenProgress.skillTreeIds) || !wardenProgress.skillTreeIds.every((id) => Object.hasOwn(WARDEN_SKILL_TREE, id) && WARDEN_SKILL_TREE[id].prereq.every((prereqId) => wardenProgress.skillTreeIds.includes(prereqId)))) return false;
  if (!validIds(wardenProgress.traitIds) || wardenProgress.traitIds.length > WARDEN_TRAIT_UNLOCK_SEQUENCES.length || !wardenProgress.traitIds.every((id) => Object.hasOwn(WARDEN_TRAITS, id))) return false;
  const statCost = Object.entries(wardenProgress.statPoints).reduce((sum, [, points]) => sum + wardenStatTotalCost(points), 0);
  const skillCost = wardenProgress.skillTreeIds.reduce((sum, id) => sum + WARDEN_SKILL_TREE[id].cost, 0);
  return statCost + skillCost <= echoCoreEarned(campaign);
}
function validOwnedEquipmentIds(campaign, ownedEquipmentIds) {
  if (!validIds(ownedEquipmentIds)) return false;
  const owners = new Set([WARDEN_OWNER_ID, ...campaign.companionCollection.map((record) => record.prototype)]);
  const stepsByKey = new Map();
  for (const id of ownedEquipmentIds) {
    const parts = id.split(":");
    if (parts.length !== 3) return false;
    const [ownerId, slot, stepText] = parts;
    if (!owners.has(ownerId) || !EQUIPMENT_SLOTS.includes(slot)) return false;
    const step = Number(stepText);
    if (!Number.isInteger(step) || String(step) !== stepText || step < 0 || step >= EQUIPMENT_TIER_UPGRADE_COST.length) return false;
    const key = `${ownerId}:${slot}`;
    if (!stepsByKey.has(key)) stepsByKey.set(key, new Set());
    stepsByKey.get(key).add(step);
  }
  for (const steps of stepsByKey.values()) {
    for (let i = 0; i < steps.size; i += 1) if (!steps.has(i)) return false; // contiguous from 0, no gaps
  }
  const totalCost = ownedEquipmentIds.reduce((sum, id) => sum + EQUIPMENT_TIER_UPGRADE_COST[Number(id.split(":")[2])], 0);
  return totalCost <= boundFragmentEarned(campaign);
}
function validCompanionFormation(campaign, companionFormation) {
  if (!isPlainObject(companionFormation)) return false;
  const entries = Object.entries(companionFormation);
  if (!entries.every(([prototype, slot]) => campaign.companionLoadout.prototypeIds.includes(prototype) && FORMATION_SLOTS.includes(slot))) return false;
  return entries.filter(([, slot]) => slot === "FRONT").length <= MAX_FRONT_SLOTS;
}
/**
 * Validates the unlocked-slot count (load time).
 *
 * Stored as a contiguous COUNT rather than a set of slot numbers: the ladder can only be climbed in
 * order, so a count is the exact state and there is no gap case to validate (unlike
 * `ownedEquipmentIds`, which needs a contiguity check because it is keyed per owner+slot).
 *
 * Both gates are re-checked here, not just the budget, so a hand-edited save cannot grant slots it
 * never earned: every unlocked row must have its stage-clear requirement met, and the combined
 * equipment + slot spend must fit the earned Bound Fragment budget.
 */
function validUnlockedCompanionSlots(campaign) {
  const unlocked = campaign.unlockedCompanionSlots;
  if (!Number.isInteger(unlocked) || unlocked < 0 || unlocked > COMPANION_SLOT_UNLOCKS.length) return false;
  const gatesMet = COMPANION_SLOT_UNLOCKS.slice(0, unlocked)
    .every((entry) => campaign.resolvedIds.length >= entry.requiresStageClears);
  return gatesMet && boundFragmentSpent(campaign) <= boundFragmentEarned(campaign);
}
export function extractedSkillUpgradeCostForLevel(targetLevel) {
  return targetLevel - 1;
}
function extractedSkillSpentAtLevel(level) {
  let cost = 0;
  for (let targetLevel = 2; targetLevel <= level; targetLevel += 1) {
    cost += extractedSkillUpgradeCostForLevel(targetLevel);
  }
  return cost;
}
function validStoryProgress(campaign, storyProgress) {
  const keys = [
    "version", "questCompletionsByStage", "extractedSkillIds", "extractedSkillLevels",
    "activeSkillLoadout", "appearanceItemIds", "equippedAppearance",
  ];
  if (!isPlainObject(storyProgress) || !hasOnlyKeys(storyProgress, keys) || storyProgress.version !== STORY_PROGRESS_VERSION) return false;
  const resolvedStories = campaign.resolvedIds.map(stageStoryFor).filter(Boolean);
  if (!isPlainObject(storyProgress.questCompletionsByStage)
      || Object.keys(storyProgress.questCompletionsByStage).length !== resolvedStories.length
      || !resolvedStories.every((story) => storyProgress.questCompletionsByStage[story.stageId] === true)) return false;
  const expectedSkillIds = resolvedStories.map((story) => story.extractionReward.skillId);
  if (!validIds(storyProgress.extractedSkillIds)
      || storyProgress.extractedSkillIds.length !== expectedSkillIds.length
      || !expectedSkillIds.every((skillId) =>
        storyProgress.extractedSkillIds.includes(skillId) && SKILLS[skillId]?.kind === "active")) return false;
  if (!isPlainObject(storyProgress.extractedSkillLevels)
      || Object.keys(storyProgress.extractedSkillLevels).length !== storyProgress.extractedSkillIds.length
      || !storyProgress.extractedSkillIds.every((skillId) => {
        const level = storyProgress.extractedSkillLevels[skillId];
        return Number.isInteger(level) && level >= 1 && level <= MAX_EXTRACTED_SKILL_LEVEL;
      })) return false;
  if (!validIds(storyProgress.activeSkillLoadout)
      || storyProgress.activeSkillLoadout.length > MAX_EXTRACTED_SKILL_LOADOUT
      || !storyProgress.activeSkillLoadout.every((skillId) => storyProgress.extractedSkillIds.includes(skillId))) return false;
  const storyByAppearanceId = new Map(Object.values(STAGE_STORIES).map((story) => [story.appearanceReward.id, story]));
  const expectedAppearanceIds = resolvedStories.map((story) => story.appearanceReward.id);
  if (!validIds(storyProgress.appearanceItemIds)
      || storyProgress.appearanceItemIds.length !== expectedAppearanceIds.length
      || !expectedAppearanceIds.every((itemId) => storyProgress.appearanceItemIds.includes(itemId))) return false;
  if (!isPlainObject(storyProgress.equippedAppearance)
      || !Object.entries(storyProgress.equippedAppearance).every(([slot, itemId]) => {
        const story = storyByAppearanceId.get(itemId);
        return storyProgress.appearanceItemIds.includes(itemId) && story?.appearanceReward.slot === slot;
      })) return false;
  if (!isPlainObject(campaign.wardenProgress)) return false;
  return echoCoreSpent({ ...campaign, storyProgress }) <= echoCoreEarned(campaign);
}

function copyCampaign(campaign) {
  return {
    campaignId: campaign.campaignId, resetEpoch: campaign.resetEpoch, unlockedStageIndex: campaign.unlockedStageIndex,
    companionCollection: campaign.companionCollection.map((record) => ({ prototype: record.prototype, evolution: record.evolution, capturedEliteIds: [...record.capturedEliteIds] })),
    companionLoadout: { prototypeIds: [...campaign.companionLoadout.prototypeIds] },
    resolvedIds: [...campaign.resolvedIds], attemptsByStage: { ...campaign.attemptsByStage },
    rewardIds: [...(campaign.rewardIds ?? [])], achievementIds: [...(campaign.achievementIds ?? [])],
    idleReturn: copyIdleReturn(campaign.idleReturn ?? initialIdleReturn()),
    lastResolution: campaign.lastResolution ? { ...campaign.lastResolution } : null,
    wardenProgress: copyWardenProgress(campaign.wardenProgress ?? initialWardenProgress()),
    ownedEquipmentIds: [...(campaign.ownedEquipmentIds ?? [])],
    companionFormation: copyCompanionFormation(campaign.companionFormation ?? {}),
    stageCarryOver: copyStageCarryOver(campaign.stageCarryOver ?? initialStageCarryOver()),
    storyProgress: copyStoryProgress(campaign.storyProgress ?? initialStoryProgress(campaign.resolvedIds)),
    unlockedCompanionSlots: campaign.unlockedCompanionSlots ?? 0,
  };
}
const LEGACY_KEYS = ["campaignId", "resetEpoch", "unlockedStageIndex", "companionCollection", "companionLoadout", "resolvedIds", "attemptsByStage", "lastResolution"];
const REWARD_KEYS = [...LEGACY_KEYS, "rewardIds", "achievementIds"];
const IDLE_KEYS = [...REWARD_KEYS, "idleReturn"];
const CURRENT_KEYS = [...IDLE_KEYS, "wardenProgress", "ownedEquipmentIds", "companionFormation", "stageCarryOver", "storyProgress", "unlockedCompanionSlots"];
const initialIdleReturn = () => ({ version: IDLE_RETURN_VERSION, lastSettledAt: null, totalProgress: 0 });
function migrateCampaign(value) {
  if (!isPlainObject(value)) return value;
  if (!LEGACY_KEYS.every((key) => Object.hasOwn(value, key))) return value; // baseline fields are required, never migrated
  const patch = {};
  if (!Object.hasOwn(value, "rewardIds")) patch.rewardIds = [];
  if (!Object.hasOwn(value, "achievementIds")) patch.achievementIds = [];
  if (!Object.hasOwn(value, "idleReturn")) patch.idleReturn = initialIdleReturn();
  if (!Object.hasOwn(value, "wardenProgress")) patch.wardenProgress = initialWardenProgress();
  if (!Object.hasOwn(value, "ownedEquipmentIds")) patch.ownedEquipmentIds = [];
  if (!Object.hasOwn(value, "companionFormation")) patch.companionFormation = {};
  if (!Object.hasOwn(value, "stageCarryOver")) patch.stageCarryOver = initialStageCarryOver();
  if (!Object.hasOwn(value, "storyProgress")) patch.storyProgress = initialStoryProgress(value.resolvedIds);
  // Cycle 9: pre-capacity saves carry no slot state; 0 unlocked == the historical hard cap of 3.
  if (!Object.hasOwn(value, "unlockedCompanionSlots")) patch.unlockedCompanionSlots = 0;
  return Object.keys(patch).length ? { ...value, ...patch } : value;
}
function validCampaign(value) {
  const candidate = migrateCampaign(value);
  if (!isPlainObject(candidate) || !hasOnlyKeys(candidate, CURRENT_KEYS)) return false;
  if (!isNonEmptyString(candidate.campaignId) || !Number.isInteger(candidate.resetEpoch) || candidate.resetEpoch < 0 || !Number.isInteger(candidate.unlockedStageIndex) || candidate.unlockedStageIndex < 0 || candidate.unlockedStageIndex >= STAGES.length) return false;
  if (!Array.isArray(candidate.companionCollection) || !candidate.companionCollection.every((record) => isPlainObject(record) && hasOnlyKeys(record, ["prototype", "evolution", "capturedEliteIds"]) && canonicalPrototype(record.prototype) && Number.isInteger(record.evolution) && record.evolution >= 1 && record.evolution <= 3 && validIds(record.capturedEliteIds))) return false;
  const prototypes = candidate.companionCollection.map((record) => record.prototype);
  /**
   * LOAD-TIME bound (spec §3): the literal `COMPANION_CAPACITY_MAX`, never the derived resolver.
   *
   * This check runs BEFORE `resolvedIds` is validated on the next line, and `companionCapacityForCampaign`
   * derives capacity from `resolvedIds` + `unlockedCompanionSlots`. Calling the resolver here would let a
   * tampered save self-certify its own capacity from fields this function has not vetted yet — inflate
   * `resolvedIds`, and an oversized loadout would validate itself. The literal ceiling cannot be gamed:
   * a save is well-formed if it is within the absolute maximum, and the derived per-campaign bound is
   * enforced at MUTATION time by `setCompanionLoadout()` where the campaign is already trusted.
   */
  if (new Set(prototypes).size !== prototypes.length || !isPlainObject(candidate.companionLoadout) || !hasOnlyKeys(candidate.companionLoadout, ["prototypeIds"]) || !validIds(candidate.companionLoadout.prototypeIds) || candidate.companionLoadout.prototypeIds.length > COMPANION_CAPACITY_MAX || !candidate.companionLoadout.prototypeIds.every((prototype) => prototypes.includes(prototype))) return false;
  if (!validIds(candidate.resolvedIds) || !candidate.resolvedIds.every((id) => STAGE_INDEX.has(id)) || !isPlainObject(candidate.attemptsByStage) || !Object.entries(candidate.attemptsByStage).every(([id, attempts]) => STAGE_INDEX.has(id) && Number.isInteger(attempts) && attempts >= 0)) return false;
  if (!validIds(candidate.rewardIds) || !candidate.rewardIds.every((id) => Object.hasOwn(REWARDS, id)) || !validIds(candidate.achievementIds)) return false;
  if (!isPlainObject(candidate.idleReturn) || !hasOnlyKeys(candidate.idleReturn, ["version", "lastSettledAt", "totalProgress"]) || candidate.idleReturn.version !== IDLE_RETURN_VERSION || (candidate.idleReturn.lastSettledAt !== null && !isTimestamp(candidate.idleReturn.lastSettledAt)) || !isTimestamp(candidate.idleReturn.totalProgress)) return false;
  if (candidate.lastResolution !== null && !(isPlainObject(candidate.lastResolution) && hasOnlyKeys(candidate.lastResolution, ["stageId", "outcome", "campaignComplete"]) && STAGE_INDEX.has(candidate.lastResolution.stageId) && ["victory", "defeat", "FINAL_COMPLETION"].includes(candidate.lastResolution.outcome) && typeof candidate.lastResolution.campaignComplete === "boolean")) return false;
  if (!validStageCarryOver(candidate.stageCarryOver)) return false;
  if (!validWardenProgress(candidate, candidate.wardenProgress)) return false;
  if (!validStoryProgress(candidate, candidate.storyProgress)) return false;
  if (!validOwnedEquipmentIds(candidate, candidate.ownedEquipmentIds)) return false;
  if (!validUnlockedCompanionSlots(candidate)) return false;
  return validCompanionFormation(candidate, candidate.companionFormation);
}
function requireCampaign(campaign) { if (!validCampaign(campaign)) fail("Invalid defense campaign."); }

export function createCampaign({ campaignId, resetEpoch = 0 } = {}) {
  if (!Number.isInteger(resetEpoch) || resetEpoch < 0) fail("resetEpoch must be a non-negative integer.");
  const id = campaignId ?? `defense-${resetEpoch}-${++campaignSequence}`;
  if (!isNonEmptyString(id)) fail("campaignId must be a non-empty string.");
  return {
    campaignId: id, resetEpoch, unlockedStageIndex: 0, companionCollection: [], companionLoadout: { prototypeIds: [] },
    resolvedIds: [], attemptsByStage: {}, rewardIds: [], achievementIds: [], idleReturn: initialIdleReturn(), lastResolution: null,
    wardenProgress: initialWardenProgress(), ownedEquipmentIds: [], companionFormation: {},
    stageCarryOver: initialStageCarryOver(),
    storyProgress: initialStoryProgress(),
    unlockedCompanionSlots: 0,
  };
}
export function startRun(campaign, stageId = STAGES[campaign?.unlockedStageIndex]?.id) {
  requireCampaign(campaign);
  const stageIndex = STAGE_INDEX.get(stageId);
  if (stageIndex === undefined || stageIndex > campaign.unlockedStageIndex) fail("Stage is not unlocked.");
  const next = copyCampaign(campaign);
  next.attemptsByStage[stageId] = (next.attemptsByStage[stageId] ?? 0) + 1;
  return next;
}
export function applyCampaignRunResult(campaign, { stageId, outcome, rewardId = null } = {}) {
  requireCampaign(campaign);
  const stageIndex = STAGE_INDEX.get(stageId);
  if (stageIndex === undefined || stageIndex > campaign.unlockedStageIndex) fail("Stage is not unlocked.");
  if (!["victory", "defeat", "FINAL_COMPLETION"].includes(outcome)) fail("Run outcome must be victory, defeat, or FINAL_COMPLETION.");
  const next = copyCampaign(campaign);
  const victory = outcome === "victory" || outcome === "FINAL_COMPLETION";
  const authoredRewards = STAGE_REWARD_IDS[stageId] ?? [];
  const effectiveRewardId = victory ? (rewardId ?? authoredRewards[0] ?? null) : null;
  if (effectiveRewardId !== null && (!isNonEmptyString(effectiveRewardId) || !Object.hasOwn(REWARDS, effectiveRewardId) || !authoredRewards.includes(effectiveRewardId))) fail("Reward must be authored for this stage.");
  if (victory && !next.resolvedIds.includes(stageId)) {
    next.resolvedIds.push(stageId);
    next.resolvedIds.sort();
    next.unlockedStageIndex = Math.max(next.unlockedStageIndex, Math.min(stageIndex + 1, STAGES.length - 1));
  }
  if (victory && !next.achievementIds.includes(`stage-clear:${stageId}`)) next.achievementIds.push(`stage-clear:${stageId}`);
  if (effectiveRewardId !== null && !next.rewardIds.includes(effectiveRewardId)) next.rewardIds.push(effectiveRewardId);
  if (victory && !next.storyProgress.questCompletionsByStage[stageId]) {
    const story = stageStoryFor(stageId);
    next.storyProgress.questCompletionsByStage[stageId] = true;
    const skillId = story.extractionReward.skillId;
    if (!next.storyProgress.extractedSkillIds.includes(skillId)) next.storyProgress.extractedSkillIds.push(skillId);
    next.storyProgress.extractedSkillLevels[skillId] ??= story.extractionReward.level;
    const appearance = story.appearanceReward;
    if (!next.storyProgress.appearanceItemIds.includes(appearance.id)) next.storyProgress.appearanceItemIds.push(appearance.id);
    next.storyProgress.equippedAppearance[appearance.slot] ??= appearance.id;
    next.storyProgress.extractedSkillIds.sort();
    next.storyProgress.appearanceItemIds.sort();
  }
  next.achievementIds.sort();
  next.rewardIds.sort();
  next.lastResolution = { stageId, outcome, campaignComplete: victory && stageIndex === STAGES.length - 1 && next.resolvedIds.includes(stageId) };
  return next;
}
export function equipExtractedSkill(campaign, skillId) {
  requireCampaign(campaign);
  if (!campaign.storyProgress.extractedSkillIds.includes(skillId)) fail("Extracted skill must be unlocked before it can be equipped.");
  const next = copyCampaign(campaign);
  if (next.storyProgress.activeSkillLoadout.includes(skillId)) return next;
  if (next.storyProgress.activeSkillLoadout.length >= MAX_EXTRACTED_SKILL_LOADOUT) fail(`At most ${MAX_EXTRACTED_SKILL_LOADOUT} extracted skills may be equipped.`);
  next.storyProgress.activeSkillLoadout.push(skillId);
  next.storyProgress.activeSkillLoadout.sort();
  return next;
}

export function unequipExtractedSkill(campaign, skillId) {
  requireCampaign(campaign);
  if (!campaign.storyProgress.extractedSkillIds.includes(skillId)) fail("Extracted skill must be unlocked before it can be unequipped.");
  if (!campaign.storyProgress.activeSkillLoadout.includes(skillId)) fail("Extracted skill must be equipped before it can be unequipped.");
  const next = copyCampaign(campaign);
  next.storyProgress.activeSkillLoadout = next.storyProgress.activeSkillLoadout.filter((id) => id !== skillId);
  return next;
}

export function upgradeExtractedSkill(campaign, skillId) {
  requireCampaign(campaign);
  if (!campaign.storyProgress.extractedSkillIds.includes(skillId)) fail("Extracted skill must be unlocked before it can be upgraded.");
  const currentLevel = campaign.storyProgress.extractedSkillLevels[skillId];
  if (currentLevel >= MAX_EXTRACTED_SKILL_LEVEL) fail("Extracted skill is already at max level.");
  const targetLevel = currentLevel + 1;
  if (echoCoreSpent(campaign) + extractedSkillUpgradeCostForLevel(targetLevel) > echoCoreEarned(campaign)) fail("Not enough Echo Core.");
  const next = copyCampaign(campaign);
  next.storyProgress.extractedSkillLevels[skillId] = targetLevel;
  return next;
}

export function equipAppearanceItem(campaign, itemId) {
  requireCampaign(campaign);
  if (!campaign.storyProgress.appearanceItemIds.includes(itemId)) fail("Appearance item must be owned before it can be equipped.");
  const story = Object.values(STAGE_STORIES).find((entry) => entry.appearanceReward.id === itemId);
  const next = copyCampaign(campaign);
  next.storyProgress.equippedAppearance[story.appearanceReward.slot] = itemId;
  return next;
}

/**
 * Records (victory) or clears (defeat) the stage-to-stage carry-over.
 *
 * `carryOver` is exactly what `runCarryOver()` returns from the finished run: skill ranks already
 * decayed and capped at CARRY_OVER_MAX_RANK, and at most CARRY_OVER_MAX_ITEMS collected items.
 * Unknown skill/item ids and out-of-range ranks are dropped rather than throwing, so a run from an
 * older rules version can never wedge a saved campaign.
 */
export function applyRunCarryOver(campaign, { stageId, outcome, carryOver = null } = {}) {
  requireCampaign(campaign);
  if (!STAGE_INDEX.has(stageId)) fail("Unknown stage for carry-over.");
  if (!["victory", "defeat", "FINAL_COMPLETION"].includes(outcome)) fail("Run outcome must be victory, defeat, or FINAL_COMPLETION.");
  const next = copyCampaign(campaign);
  if (outcome === "defeat" || !carryOver) {
    next.stageCarryOver = initialStageCarryOver();
    return next;
  }
  const skillRanks = {};
  for (const [skillId, rank] of Object.entries(carryOver.skillRanks ?? {})) {
    if (!Object.hasOwn(SKILLS, skillId) || !Number.isInteger(rank) || rank < 1) continue;
    skillRanks[skillId] = Math.min(rank, CARRY_OVER_MAX_RANK);
  }
  const itemIds = [...new Set((carryOver.itemIds ?? []).filter((itemId) => Object.hasOwn(ITEMS, itemId)))]
    .slice(-CARRY_OVER_MAX_ITEMS);
  next.stageCarryOver = { version: CARRY_OVER_VERSION, stageId, skillRanks, itemIds };
  return next;
}

/** Farwatch Hold ward level (balance-sheet.md undertow-encroachment): resolvedIds.length + floor(companionCollection.length / 2). Auto-derived, no separate investment resource. */
export function wardLevel(campaign) { return campaign.resolvedIds.length + Math.floor(campaign.companionCollection.length / 2); }
/** Wardline pressure this settlement window (1/hour, capped at 8h — reuses IDLE_RETURN_MAX_ELAPSED_MS). */
function wardlinePressure(elapsedMs) { return Math.min(Math.floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8); }
export function settleIdleReturn(campaign, { now } = {}) {
  requireCampaign(campaign);
  const next = copyCampaign(campaign);
  if (!isTimestamp(now)) return { campaign: next, receipt: idleReceipt("INVALID_TIME") };
  const lastSettledAt = next.idleReturn.lastSettledAt;
  if (lastSettledAt === null) {
    next.idleReturn.lastSettledAt = now;
    return { campaign: next, receipt: idleReceipt("INITIALIZED", { requestedAt: now, settledAt: now }) };
  }
  if (now < lastSettledAt) return { campaign: next, receipt: idleReceipt("INVALID_TIME", { requestedAt: now }) };
  const elapsedMs = now - lastSettledAt;
  if (elapsedMs < IDLE_RETURN_INTERVAL_MS) return { campaign: next, receipt: idleReceipt("EARLY", { requestedAt: now, elapsedMs }) };
  const settledElapsedMs = Math.min(elapsedMs, IDLE_RETURN_MAX_ELAPSED_MS);
  const completedStages = next.resolvedIds.length;
  next.idleReturn.lastSettledAt = now;
  if (completedStages === 0) {
    return { campaign: next, receipt: idleReceipt("NO_COMPLETED_STAGES", { requestedAt: now, elapsedMs, settledElapsedMs, settledAt: now }) };
  }
  const pressure = wardlinePressure(elapsedMs);
  const level = wardLevel(next);
  if (pressure > level) {
    return { campaign: next, receipt: idleReceipt("ENCROACHED", { requestedAt: now, elapsedMs, settledElapsedMs, completedStages, settledAt: now }) };
  }
  const awardedProgress = completedStages * Math.floor(settledElapsedMs / IDLE_RETURN_INTERVAL_MS);
  if (!Number.isSafeInteger(next.idleReturn.totalProgress + awardedProgress)) {
    return { campaign: copyCampaign(campaign), receipt: idleReceipt("CAPACITY_REACHED", { requestedAt: now, elapsedMs, settledElapsedMs, completedStages }) };
  }
  next.idleReturn.totalProgress += awardedProgress;
  return { campaign: next, receipt: idleReceipt("SETTLED", { requestedAt: now, elapsedMs, settledElapsedMs, completedStages, awardedProgress, settledAt: now }) };
}
export function applyEliteExtractionEvents(campaign, events) {
  requireCampaign(campaign);
  if (!Array.isArray(events)) fail("Extraction events must be passed as an array.");
  const capturedElitePrototypes = new Map();
  for (const record of campaign.companionCollection) {
    for (const eliteId of record.capturedEliteIds) {
      capturedElitePrototypes.set(eliteId, record.prototype);
    }
  }
  let next = campaign;
  const eventById = new Map();
  const newCaptureCount = new Set();
  for (const event of events) {
    if (!isPlainObject(event)) fail("Extraction events must be plain objects.");
    const { eventId, eliteId, prototype } = event;
    if (!isNonEmptyString(eventId) || !isNonEmptyString(eliteId) || !isNonEmptyString(prototype)) fail("ELITE_EXTRACTED events must include eventId, eliteId, and prototype.");
    const prior = eventById.get(eventId);
    if (prior) {
      if (prior.eliteId !== eliteId || prior.prototype !== prototype) fail("same eventId cannot carry conflicting elite payloads.");
      continue;
    }
    eventById.set(eventId, { eliteId, prototype });
    const priorPrototype = capturedElitePrototypes.get(eliteId);
    if (priorPrototype !== undefined) {
      if (priorPrototype !== prototype) fail("An eliteId cannot be captured by multiple companion prototypes.");
      continue;
    }
    if (newCaptureCount.size > 0) fail("Only one elite handoff may be applied per run.");
    next = captureElite(next, eliteId, prototype);
    newCaptureCount.add(eliteId);
    capturedElitePrototypes.set(eliteId, prototype);
  }
  return next;
}
export function captureElite(campaign, eliteId, prototype) {
  requireCampaign(campaign);
  if (!isNonEmptyString(eliteId) || !canonicalPrototype(prototype)) fail("eliteId and prototype must be canonical non-empty strings.");
  const next = copyCampaign(campaign);
  let record = next.companionCollection.find((entry) => entry.prototype === prototype);
  if (!record) {
    record = { prototype, evolution: 1, capturedEliteIds: [eliteId] };
    next.companionCollection.push(record);
    next.companionCollection.sort((left, right) => left.prototype.localeCompare(right.prototype));
  } else if (!record.capturedEliteIds.includes(eliteId)) {
    record.capturedEliteIds.push(eliteId);
    record.capturedEliteIds.sort();
    record.evolution = Math.min(3, record.evolution + 1);
  }
  return next;
}
export function setCompanionLoadout(campaign, prototypeIds) {
  requireCampaign(campaign);
  /**
   * MUTATION-TIME bound (spec §3): the DERIVED per-campaign capacity, not the literal ceiling. The
   * campaign has already passed `requireCampaign` on the line above, so its `resolvedIds` and
   * unlocked-slot count are trusted and the resolver is safe to call here — which is exactly why
   * load-time validation must not use it.
   */
  const capacity = companionCapacityForCampaign(campaign);
  if (!validIds(prototypeIds) || prototypeIds.length > capacity || !prototypeIds.every((prototype) => campaign.companionCollection.some((record) => record.prototype === prototype))) fail(`Loadout must contain up to ${capacity} owned canonical companions.`);
  const next = copyCampaign(campaign);
  next.companionLoadout.prototypeIds = [...prototypeIds].sort();
  next.companionFormation = Object.fromEntries(Object.entries(next.companionFormation).filter(([prototype]) => prototypeIds.includes(prototype)));
  return next;
}

/** Sets a loadout companion's FRONT/BACK slot. Omitting a companion (or `slot=null`) defaults it to BACK. Max 2 FRONT (UNIFIED-GDD.md §4.2). */
export function setCompanionFormationSlot(campaign, prototypeId, slot) {
  requireCampaign(campaign);
  if (!campaign.companionLoadout.prototypeIds.includes(prototypeId)) fail("Companion must be in the current loadout.");
  if (slot !== null && !FORMATION_SLOTS.includes(slot)) fail("slot must be FRONT, BACK, or null.");
  const next = copyCampaign(campaign);
  if (slot === null || slot === "BACK") delete next.companionFormation[prototypeId];
  else {
    const frontCount = Object.entries(next.companionFormation).filter(([id, s]) => s === "FRONT" && id !== prototypeId).length;
    if (frontCount >= MAX_FRONT_SLOTS) fail(`At most ${MAX_FRONT_SLOTS} companions may be FRONT.`);
    next.companionFormation[prototypeId] = "FRONT";
  }
  return next;
}

/** Allocates one point in a Track A stat (Echo Core spend gated by echoCoreEarned budget). */
export function allocateWardenStatPoint(campaign, statId) {
  requireCampaign(campaign);
  if (!Object.hasOwn(WARDEN_STATS, statId)) fail("Unknown Warden stat.");
  const current = campaign.wardenProgress.statPoints[statId] ?? 0;
  if (current >= WARDEN_STATS[statId].maxPoints) fail("Stat is already at max points.");
  const next = copyCampaign(campaign);
  next.wardenProgress.statPoints[statId] = current + 1;
  if (echoCoreSpent(next) > echoCoreEarned(next)) fail("Not enough Echo Core.");
  return next;
}
/** Unlocks one Track A skill-tree node (prerequisites + Echo Core budget enforced). */
export function unlockWardenSkillNode(campaign, nodeId) {
  requireCampaign(campaign);
  if (!Object.hasOwn(WARDEN_SKILL_TREE, nodeId)) fail("Unknown skill-tree node.");
  if (campaign.wardenProgress.skillTreeIds.includes(nodeId)) fail("Node is already unlocked.");
  const node = WARDEN_SKILL_TREE[nodeId];
  if (!node.prereq.every((prereqId) => campaign.wardenProgress.skillTreeIds.includes(prereqId))) fail("Prerequisite node(s) not unlocked.");
  const next = copyCampaign(campaign);
  next.wardenProgress.skillTreeIds.push(nodeId);
  next.wardenProgress.skillTreeIds.sort();
  if (echoCoreSpent(next) > echoCoreEarned(next)) fail("Not enough Echo Core.");
  return next;
}
/** Selects a Warden trait for the next open unlock sequence (stage-clear count 2/4/6/8/10); must be one of that sequence's 3 offers. */
export function selectWardenTrait(campaign, traitId) {
  requireCampaign(campaign);
  const nextSequenceSlot = campaign.wardenProgress.traitIds.length;
  if (nextSequenceSlot >= WARDEN_TRAIT_UNLOCK_SEQUENCES.length) fail("All trait unlock sequences are already resolved.");
  const sequenceNumber = WARDEN_TRAIT_UNLOCK_SEQUENCES[nextSequenceSlot];
  if (campaign.resolvedIds.length < sequenceNumber) fail(`Trait unlocks at ${sequenceNumber} cleared stages.`);
  const offers = wardenTraitOffersForSequence(sequenceNumber, campaign.wardenProgress.traitIds);
  if (campaign.wardenProgress.traitIds.includes(traitId)) fail("Trait is already owned.");
  if (!offers.includes(traitId)) fail("traitId must be one of the offered traits for this unlock sequence.");
  const next = copyCampaign(campaign);
  next.wardenProgress.traitIds.push(traitId);
  return next;
}
/** Advances one equipment slot by one tier for `ownerId` ("warden" or an owned companion prototype); Bound Fragment budget enforced. */
export function purchaseEquipmentTier(campaign, ownerId, slot) {
  requireCampaign(campaign);
  if (ownerId !== WARDEN_OWNER_ID && !campaign.companionCollection.some((record) => record.prototype === ownerId)) fail("ownerId must be \"warden\" or an owned companion.");
  if (!EQUIPMENT_SLOTS.includes(slot)) fail("Unknown equipment slot.");
  const step = equipmentTierIndexFor(campaign, ownerId, slot);
  if (step >= EQUIPMENT_TIERS.length - 1) fail("Slot is already at max tier.");
  const next = copyCampaign(campaign);
  next.ownedEquipmentIds.push(`${ownerId}:${slot}:${step}`);
  next.ownedEquipmentIds.sort();
  if (boundFragmentSpent(next) > boundFragmentEarned(next)) fail("Not enough Bound Fragment.");
  return next;
}
/**
 * Unlocks the next legion slot (4th..10th), following `purchaseEquipmentTier`'s pattern exactly:
 * validate the campaign, reject the terminal case, mutate a copy, then assert the Bound Fragment
 * budget on the RESULT and fail if it overdraws. Checking the budget post-mutation is what makes the
 * shared equipment/slot budget honest — `boundFragmentSpent(next)` sums both spends, so a slot cannot
 * be bought with fragments already committed to equipment tiers.
 *
 * Requires BOTH gates (spec §3): the stage-clear count and the payment. Level alone is insufficient.
 */
export function purchaseCompanionSlot(campaign) {
  requireCampaign(campaign);
  const unlocked = companionSlotsUnlocked(campaign);
  const entry = companionSlotUnlockFor(COMPANION_CAPACITY_BASE + unlocked + 1);
  if (!entry) fail("Legion capacity is already at maximum.");
  if (campaign.resolvedIds.length < entry.requiresStageClears) fail(`Slot ${entry.slot} unlocks at ${entry.requiresStageClears} cleared stages.`);
  const next = copyCampaign(campaign);
  next.unlockedCompanionSlots = unlocked + 1;
  if (boundFragmentSpent(next) > boundFragmentEarned(next)) fail("Not enough Bound Fragment.");
  return next;
}

export function serializeCampaign(campaign) {
  requireCampaign(campaign);
  return copyCampaign(campaign);
}
export function restoreCampaign(serialized) {
  let value = serialized;
  if (typeof serialized === "string") {
    try { value = JSON.parse(serialized); } catch { return null; }
  }
  return validCampaign(value) ? copyCampaign(value) : null;
}
