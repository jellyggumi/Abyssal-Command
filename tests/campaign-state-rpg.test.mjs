import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

import {
  STAGES,
  createCampaign,
  startRun,
  applyCampaignRunResult,
  captureElite,
  setCompanionLoadout,
  serializeCampaign,
  restoreCampaign,
  echoCoreEarned,
  boundFragmentEarned,
  echoCoreSpent,
  boundFragmentSpent,
  equipmentTierIndexFor,
  wardenRuntimeStatsForCampaign,
  companionRuntimeStatsForCampaign,
  companionFormationSlot,
  wardLevel,
  allocateWardenStatPoint,
  unlockWardenSkillNode,
  selectWardenTrait,
  purchaseEquipmentTier,
  setCompanionFormationSlot,
  settleIdleReturn,
  purchaseCompanionSlot,
  companionCapacityForCampaign,
  companionSlotsUnlocked,
  companionSlotUnlockCostFor,
  COMPANION_CAPACITY_BASE,
  COMPANION_CAPACITY_MAX,
  COMPANION_SLOT_UNLOCKS,
  IDLE_RETURN_INTERVAL_MS,
} from "../campaign-state.js";

import { EQUIPMENT_TIERS } from "../rpg-catalog.js";

function campaignWithElitesAndResolves(campaignId, { elites = [], stages = [] } = {}) {
  let campaign = createCampaign({ campaignId });
  for (const [eliteId, prototype] of elites) campaign = captureElite(campaign, eliteId, prototype);
  for (const stageId of stages) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  return campaign;
}

test("echoCoreEarned weights captured elites at 1x and resolved stages at 3x (not the swapped order)", () => {
  const campaign = campaignWithElitesAndResolves("echo-earn", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  // 2 distinct captured elite ids (1 each) + 1 resolved stage * 3 = 5. A swapped weighting
  // (capturedEliteCount*3 + resolvedIds.length*1) would instead yield 2*3 + 1*1 = 7.
  assert.equal(echoCoreEarned(campaign), 5);
});

test("echoCoreEarned counts distinct captured elite ids, not total capture calls, and caps naturally via companionCollection size", () => {
  let campaign = createCampaign({ campaignId: "echo-distinct" });
  campaign = captureElite(campaign, "elite-a", "ember-cohort");
  campaign = captureElite(campaign, "elite-b", "ember-cohort"); // same prototype, second elite -> evolution bump, still +1 distinct id
  assert.equal(campaign.companionCollection[0].evolution, 2);
  assert.equal(echoCoreEarned(campaign), 2, "two distinct elite ids captured onto the same prototype still count as 2");

  const repeatCapture = captureElite(campaign, "elite-a", "ember-cohort");
  assert.equal(echoCoreEarned(repeatCapture), 2, "recapturing an already-captured elite id does not double count");
});

test("echoCoreEarned caps captured-elite contribution at the current canonical stage count", () => {
  let campaign = createCampaign({ campaignId: "echo-cap-exploit-guard" });
  for (let i = 0; i < 40; i += 1) campaign = captureElite(campaign, `elite-${i}`, "ember-cohort");
  assert.equal(
    echoCoreEarned(campaign),
    STAGES.length,
    "fabricated elite ids must never contribute more Echo Core than the canonical stage count",
  );
});


test("allocateWardenStatPoint stops at the Echo Core ceiling of the current campaign", () => {
  const stageOrder = STAGES.map(({ id }) => id);
  const companionCycle = ["ember-cohort", "rift-lens", "veil-vanguard"];
  let campaign = createCampaign({ campaignId: "stat-current-campaign-cap" });
  stageOrder.forEach((stageId, index) => {
    campaign = captureElite(campaign, `elite-${index}`, companionCycle[index]);
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  });
  assert.equal(echoCoreEarned(campaign), STAGES.length * 4);

  let allocated = campaign;
  for (let i = 0; i < 4; i += 1) allocated = allocateWardenStatPoint(allocated, "binding-might");
  assert.equal(allocated.wardenProgress.statPoints["binding-might"], 4);
  assert.equal(echoCoreSpent(allocated), 10);
  assert.throws(
    () => allocateWardenStatPoint(allocated, "binding-might"),
    /Not enough Echo Core/u,
    "the next point costs 4 Echo Core and must not exceed the current 12-Core campaign ceiling",
  );
});

/**
 * Cycle 9 (`N-20260730-C9-01`): the old name — "equals the resolved stage count" — WAS the stale
 * premise. Earning is no longer `resolvedIds.length`; it now mirrors `echoCoreEarned`'s shape.
 * Asserted as separable terms with hand-computed witnesses (never as a re-implementation of the
 * formula, which would pass against any formula), so a swapped or dropped term fails here.
 */
test("boundFragmentEarned weights resolved stages at 3x and distinct captured elites at 1x (not the pre-cycle-9 raw resolved-stage count)", () => {
  // 1 resolved stage, no elites -> 1*3 = 3. The pre-cycle-9 formula (`resolvedIds.length`) yields 1,
  // and a swapped weighting (stages*1 + elites*3) also yields 1 here. Both are caught.
  assert.equal(boundFragmentEarned(campaignWithElitesAndResolves("bound-stage-term", { stages: ["cinder-span"] })), 3);

  // 2 distinct elites, no resolved stage -> 0*3 + 2 = 2. Isolates the elite term: were elites
  // weighted 3x, this would be 6; were the term missing entirely, 0.
  assert.equal(boundFragmentEarned(campaignWithElitesAndResolves("bound-elite-term", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
  })), 2);

  // Both terms together -> 1*3 + 2 = 5, which no single-term formula produces.
  assert.equal(boundFragmentEarned(campaignWithElitesAndResolves("bound-both-terms", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  })), 5);

  assert.equal(boundFragmentEarned(createCampaign({ campaignId: "bound-zero" })), 0);
});

test("boundFragmentEarned caps the captured-elite term at the canonical stage count, matching echoCoreEarned's exploit guard", () => {
  let campaign = createCampaign({ campaignId: "bound-elite-cap" });
  for (let i = 0; i < 40; i += 1) campaign = captureElite(campaign, `elite-${i}`, "ember-cohort");
  // No resolved stages, so the whole value IS the (capped) elite term. Without the cap this is 40.
  assert.equal(
    boundFragmentEarned(campaign),
    STAGES.length,
    "fabricated elite ids must never contribute more Bound Fragment than the canonical stage count",
  );
});

test("wardLevel derives from resolvedIds.length + floor(companionCollection.length / 2)", () => {
  const campaign = campaignWithElitesAndResolves("ward-level", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
    stages: ["cinder-span"],
  });
  // resolvedIds.length=1, companionCollection.length=3, floor(3/2)=1 -> 2
  assert.equal(wardLevel(campaign), 2);
  assert.equal(wardLevel(createCampaign({ campaignId: "ward-zero" })), 0);
});

test("companionFormationSlot defaults to BACK for an unassigned companion", () => {
  const campaign = createCampaign({ campaignId: "formation-default" });
  assert.equal(companionFormationSlot(campaign, "ember-cohort"), "BACK");
});



test("allocateWardenStatPoint enforces the shared Echo Core budget, including cross-blocking against skill-tree spending", () => {
  const campaign = campaignWithElitesAndResolves("stat-budget", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  assert.equal(echoCoreEarned(campaign), 5);

  const afterOne = allocateWardenStatPoint(campaign, "binding-might");
  assert.equal(afterOne.wardenProgress.statPoints["binding-might"], 1);
  assert.equal(echoCoreSpent(afterOne), 2);

  assert.throws(() => allocateWardenStatPoint(campaign, "not-a-stat"), TypeError);

  // 3rd point on binding-might costs 3, cumulative 2+2+3=7 > earned 5
  const afterTwo = allocateWardenStatPoint(afterOne, "binding-might");
  assert.throws(() => allocateWardenStatPoint(afterTwo, "binding-might"), TypeError, "3rd point exceeds the 5-point budget");

  // Cross-blocking: spend the entire 5-point budget on a skill node, then a stat point must fail.
  const skillSpent = unlockWardenSkillNode(campaign, "wardens-ward"); // cost 5, exhausts the budget
  assert.throws(() => allocateWardenStatPoint(skillSpent, "binding-might"), TypeError, "stat allocation must be blocked once the shared budget is exhausted by skill spending");
});

test("unlockWardenSkillNode enforces prerequisites and the shared Echo Core budget", () => {
  const campaign = campaignWithElitesAndResolves("skill-budget", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  assert.throws(() => unlockWardenSkillNode(campaign, "echo-cascade"), TypeError, "echo-cascade requires echo-backlash first");

  const backlash = unlockWardenSkillNode(campaign, "echo-backlash"); // cost 5
  assert.equal(echoCoreSpent(backlash), 5);
  assert.throws(() => unlockWardenSkillNode(backlash, "echo-cascade"), TypeError, "cost 8 exceeds the remaining 0 budget");
  assert.throws(() => unlockWardenSkillNode(backlash, "echo-backlash"), TypeError, "already unlocked");
});

test("selectWardenTrait gates by stage-clear sequence count and only accepts that sequence's offered 3 traits", () => {
  const campaign = createCampaign({ campaignId: "trait-select" });
  assert.throws(() => selectWardenTrait(campaign, "first-strike"), TypeError, "no stages resolved yet, sequence 2 not reached");

  let resolved = campaign;
  for (const stageId of STAGES.slice(0, 2).map(({ id }) => id)) {
    resolved = startRun(resolved, stageId);
    resolved = applyCampaignRunResult(resolved, { stageId, outcome: "victory" });
  }
  assert.equal(resolved.resolvedIds.length, 2);

  assert.throws(() => selectWardenTrait(resolved, "chain-reaction"), TypeError, "chain-reaction is not offered at sequence 2");
  const picked = selectWardenTrait(resolved, "first-strike");
  assert.deepEqual(picked.wardenProgress.traitIds, ["first-strike"]);

  assert.throws(() => selectWardenTrait(picked, "desperate-echo"), TypeError, "sequence 4 not yet reached (only 2 stages resolved)");
});

test("purchaseEquipmentTier validates ownerId, enforces max tier, and enforces the Bound Fragment budget", () => {
  const campaign = campaignWithElitesAndResolves("equip-budget", {
    elites: [["e1", "ember-cohort"]],
    stages: ["cinder-span"],
  });
  // 1 resolved stage (3) + 1 distinct captured elite (1) = 4, per the cycle-9 earning formula.
  assert.equal(boundFragmentEarned(campaign), 1 * 3 + 1);

  assert.throws(() => purchaseEquipmentTier(campaign, "not-owned", "weapon"), TypeError);
  assert.throws(() => purchaseEquipmentTier(campaign, "warden", "not-a-slot"), TypeError);

  const upgraded = purchaseEquipmentTier(campaign, "warden", "weapon"); // step 0 costs 1 -> 1 of 4
  assert.equal(equipmentTierIndexFor(upgraded, "warden", "weapon"), 1);
  assert.equal(boundFragmentSpent(upgraded), 1);
  const tierThree = purchaseEquipmentTier(upgraded, "warden", "weapon"); // step 1 costs 2 -> 3 of 4
  assert.equal(equipmentTierIndexFor(tierThree, "warden", "weapon"), 2);
  assert.equal(boundFragmentSpent(tierThree), 3);
  assert.throws(
    () => purchaseEquipmentTier(tierThree, "warden", "weapon"),
    /Not enough Bound Fragment/u,
    "step 2 costs 3 more, totalling 6 against the 4 this campaign has earned",
  );

  // an owned companion is also a valid ownerId
  const companionEquip = purchaseEquipmentTier(campaign, "ember-cohort", "trinket");
  assert.equal(equipmentTierIndexFor(companionEquip, "ember-cohort", "trinket"), 1);
});

test("purchaseEquipmentTier cannot spend beyond the current campaign's Bound Fragment ceiling", () => {
  let campaign = createCampaign({ campaignId: "equip-current-campaign-cap" });
  for (const { id: stageId } of STAGES) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  // Full clear, no captured elites: the elite term is 0, so the ceiling is the stage term alone.
  // Derived from STAGES.length rather than a literal 9 — baking the literal is exactly how the
  // pre-cycle-9 defect hid behind a stale "max 10" comment.
  assert.equal(boundFragmentEarned(campaign), STAGES.length * 3);

  let tiers = campaign;
  for (let step = 0; step < 3; step += 1) tiers = purchaseEquipmentTier(tiers, "warden", "weapon");
  assert.equal(equipmentTierIndexFor(tiers, "warden", "weapon"), 3);
  assert.equal(boundFragmentSpent(tiers), 6, "steps 0+1+2 cost 1+2+3");
  assert.throws(
    () => purchaseEquipmentTier(tiers, "warden", "weapon"),
    /Not enough Bound Fragment/u,
    "the T5 step costs 4 more, totalling 10 against the 9 a full three-stage clear earns: one equipment line still cannot be maxed on stage clears alone",
  );
});

test("setCompanionFormationSlot requires loadout membership and enforces MAX_FRONT_SLOTS", () => {
  let campaign = campaignWithElitesAndResolves("formation-slots", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "veil-vanguard"]);

  assert.throws(() => setCompanionFormationSlot(campaign, "not-in-loadout", "FRONT"), TypeError);

  const oneFront = setCompanionFormationSlot(campaign, "ember-cohort", "FRONT");
  const twoFront = setCompanionFormationSlot(oneFront, "rift-lens", "FRONT");
  assert.equal(companionFormationSlot(twoFront, "ember-cohort"), "FRONT");
  assert.equal(companionFormationSlot(twoFront, "rift-lens"), "FRONT");
  assert.throws(() => setCompanionFormationSlot(twoFront, "veil-vanguard", "FRONT"), TypeError, "a 3rd FRONT companion must be rejected");

  const backAgain = setCompanionFormationSlot(twoFront, "ember-cohort", "BACK");
  assert.equal(companionFormationSlot(backAgain, "ember-cohort"), "BACK");
  const thirdNowFits = setCompanionFormationSlot(backAgain, "veil-vanguard", "FRONT");
  assert.equal(companionFormationSlot(thirdNowFits, "veil-vanguard"), "FRONT");
});

test("setCompanionLoadout drops companionFormation entries for companions no longer in the loadout", () => {
  let campaign = campaignWithElitesAndResolves("formation-prune", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens"]);
  campaign = setCompanionFormationSlot(campaign, "ember-cohort", "FRONT");
  assert.equal(companionFormationSlot(campaign, "ember-cohort"), "FRONT");

  const shrunk = setCompanionLoadout(campaign, ["rift-lens"]);
  assert.equal(companionFormationSlot(shrunk, "ember-cohort"), "BACK", "dropping a companion from the loadout resets its formation to the BACK default");
});

test("wardenRuntimeStatsForCampaign and companionRuntimeStatsForCampaign derive from live campaign state (stat points + equipment)", () => {
  const campaign = campaignWithElitesAndResolves("runtime-derive", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  const withStat = allocateWardenStatPoint(campaign, "binding-might");
  const runtime = wardenRuntimeStatsForCampaign(withStat);
  assert.equal(runtime.basicDamageBonus, 15);

  const withEquip = purchaseEquipmentTier(campaign, "ember-cohort", "weapon");
  const companionRuntime = companionRuntimeStatsForCampaign(withEquip, "ember-cohort");
  assert.equal(companionRuntime.weaponTierMultiplier, 1.15);
  assert.equal(companionRuntime.role, "striker");
});

test("settleIdleReturn: INITIALIZED on first call, EARLY before one interval, SETTLED with award, NO_COMPLETED_STAGES with zero resolves", () => {
  const noStages = createCampaign({ campaignId: "idle-no-stages" });
  const first = settleIdleReturn(noStages, { now: 1000 });
  assert.equal(first.receipt.outcome, "INITIALIZED");
  assert.equal(first.campaign.idleReturn.lastSettledAt, 1000);

  const tooEarly = settleIdleReturn(first.campaign, { now: 1000 + IDLE_RETURN_INTERVAL_MS - 1 });
  assert.equal(tooEarly.receipt.outcome, "EARLY");

  const zeroStages = settleIdleReturn(first.campaign, { now: 1000 + IDLE_RETURN_INTERVAL_MS });
  assert.equal(zeroStages.receipt.outcome, "NO_COMPLETED_STAGES");

  let withStage = campaignWithElitesAndResolves("idle-settled", { stages: ["cinder-span"] });
  const initialized = settleIdleReturn(withStage, { now: 1000 });
  const settled = settleIdleReturn(initialized.campaign, { now: 1000 + IDLE_RETURN_INTERVAL_MS });
  assert.equal(settled.receipt.outcome, "SETTLED");
  assert.equal(settled.receipt.awardedProgress, 1); // 1 completed stage * floor(1 interval / 1 interval) = 1
  assert.equal(settled.campaign.idleReturn.totalProgress, 1);
});

test("settleIdleReturn returns ENCROACHED and forfeits the award when pressure exceeds wardLevel, but still advances lastSettledAt and leaves totalProgress unchanged", () => {
  let campaign = campaignWithElitesAndResolves("idle-encroached", { stages: ["cinder-span"] }); // wardLevel = 1 + floor(0/2) = 1
  assert.equal(wardLevel(campaign), 1);

  const initialized = settleIdleReturn(campaign, { now: 1000 });
  const priorProgress = initialized.campaign.idleReturn.totalProgress;

  // pressure = min(floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8); need pressure > wardLevel(1), so pressure=2
  const elapsedForPressure2 = 2 * 60 * IDLE_RETURN_INTERVAL_MS;
  const encroached = settleIdleReturn(initialized.campaign, { now: 1000 + elapsedForPressure2 });
  assert.equal(encroached.receipt.outcome, "ENCROACHED");
  assert.equal(encroached.campaign.idleReturn.totalProgress, priorProgress, "the forfeited window must not add to totalProgress");
  assert.equal(encroached.campaign.idleReturn.lastSettledAt, 1000 + elapsedForPressure2, "lastSettledAt still advances despite the forfeiture");
});

test("settleIdleReturn SETTLES normally when pressure does not exceed wardLevel (guard against an always-ENCROACHED regression)", () => {
  // build wardLevel up to 3 (3 resolved stages) so a 2-hour-equivalent pressure of 2 does not encroach
  let campaign = createCampaign({ campaignId: "idle-not-encroached" });
  for (const { id: stageId } of STAGES) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  assert.equal(wardLevel(campaign), 3);
  const initialized = settleIdleReturn(campaign, { now: 1000 });
  const elapsedForPressure2 = 2 * 60 * IDLE_RETURN_INTERVAL_MS;
  const settled = settleIdleReturn(initialized.campaign, { now: 1000 + elapsedForPressure2 });
  assert.equal(settled.receipt.outcome, "SETTLED");
  assert.ok(settled.campaign.idleReturn.totalProgress > 0);
});

test("restoreCampaign migrates all five historical shapes, defaulting missing RPG-era and cycle-9 fields", () => {
  let campaign = createCampaign({ campaignId: "migrate-shapes", resetEpoch: 7 });
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });
  const current = serializeCampaign(campaign);
  /**
   * The persisted campaign shape is 17 keys. Cycle 9 added the 17th, `unlockedCompanionSlots`
   * (core-loop-legion-spec.md §3): the contiguous count of purchased legion slots beyond the base 3,
   * which `companionCapacityForCampaign()` turns into the derived 3..10 capacity. It is a versioned
   * addition, not a leak — `CURRENT_KEYS` carries it and `migrateCampaign` defaults pre-cycle-9 saves
   * to 0 (asserted by shape (e) below).
   *
   * Asserted as a SORTED KEY SET, not a count, and written out as literals rather than imported from
   * `CURRENT_KEYS`. A count cannot distinguish an addition from a rename, nor from a simultaneous
   * drop+add — which is how the 17th key landed here silently. Deriving the expectation from the
   * schema's own key list would be worse still: the test would validate the code against itself and
   * a stray `CURRENT_KEYS` entry would certify itself. Same anti-circularity rule the implementation
   * follows at campaign-state.js:361-370, where load-time validation uses the literal ceiling 10
   * instead of calling the derived resolver.
   */
  assert.deepEqual(Object.keys(current).sort(), [
    "achievementIds",
    "attemptsByStage",
    "campaignId",
    "companionCollection",
    "companionFormation",
    "companionLoadout",
    "idleReturn",
    "lastResolution",
    "ownedEquipmentIds",
    "resetEpoch",
    "resolvedIds",
    "rewardIds",
    "stageCarryOver",
    "storyProgress",
    "unlockedCompanionSlots",
    "unlockedStageIndex",
    "wardenProgress",
  ].sort());
  assert.ok(current.rewardIds.length > 0);
  assert.ok(current.achievementIds.length > 0);
  const expectedMigratedStoryProgress = {
    version: 1,
    questCompletionsByStage: { "cinder-span": true },
    extractedSkillIds: ["rift-bolt"],
    extractedSkillLevels: { "rift-bolt": 1 },
    activeSkillLoadout: [],
    appearanceItemIds: ["cinder-span-ember-chain"],
    equippedAppearance: { back: "cinder-span-ember-chain" },
  };

  /**
   * Shapes (a)-(d) all predate cycle 9, so each must also drop `unlockedCompanionSlots` to stay the
   * shape it claims to be. Before this, they inherited the new key from `current` and quietly became
   * 9/10/11/12-key hybrids — the documented counts were the only thing still asserting the old
   * shapes, and they were wrong. Every one of them must migrate the slot count to 0.
   */
  // shape (a): oldest 8-key pre-reward shape
  const shapeA = { ...current };
  delete shapeA.rewardIds;
  delete shapeA.achievementIds;
  delete shapeA.idleReturn;
  delete shapeA.wardenProgress;
  delete shapeA.ownedEquipmentIds;
  delete shapeA.companionFormation;
  delete shapeA.stageCarryOver;
  delete shapeA.storyProgress;
  delete shapeA.unlockedCompanionSlots;
  assert.equal(Object.keys(shapeA).length, 8);
  const restoredA = restoreCampaign(shapeA);
  assert.ok(restoredA);
  assert.deepEqual(restoredA.rewardIds, []);
  assert.deepEqual(restoredA.achievementIds, []);
  assert.deepEqual(restoredA.idleReturn, { version: 1, lastSettledAt: null, totalProgress: 0 });
  assert.deepEqual(restoredA.wardenProgress, { statPoints: {}, skillTreeIds: [], traitIds: [] });
  assert.deepEqual(restoredA.ownedEquipmentIds, []);
  assert.deepEqual(restoredA.companionFormation, {});
  assert.deepEqual(restoredA.stageCarryOver, { version: 1, stageId: null, skillRanks: {}, itemIds: [] });
  assert.deepEqual(restoredA.storyProgress, expectedMigratedStoryProgress);
  assert.equal(restoredA.unlockedCompanionSlots, 0, "the oldest shape must migrate to zero purchased slots");

  // shape (b): 9-key (+idleReturn, no rewards)
  const shapeB = { ...current };
  delete shapeB.rewardIds;
  delete shapeB.achievementIds;
  delete shapeB.wardenProgress;
  delete shapeB.ownedEquipmentIds;
  delete shapeB.companionFormation;
  delete shapeB.stageCarryOver;
  delete shapeB.storyProgress;
  delete shapeB.unlockedCompanionSlots;
  assert.equal(Object.keys(shapeB).length, 9);
  const restoredB = restoreCampaign(shapeB);
  assert.ok(restoredB);
  assert.deepEqual(restoredB.rewardIds, []);
  assert.deepEqual(restoredB.idleReturn, current.idleReturn);
  assert.deepEqual(restoredB.storyProgress, expectedMigratedStoryProgress);
  assert.equal(restoredB.unlockedCompanionSlots, 0);

  // shape (c): 10-key (+rewards, no idleReturn)
  const shapeC = { ...current };
  delete shapeC.idleReturn;
  delete shapeC.wardenProgress;
  delete shapeC.ownedEquipmentIds;
  delete shapeC.companionFormation;
  delete shapeC.stageCarryOver;
  delete shapeC.storyProgress;
  delete shapeC.unlockedCompanionSlots;
  assert.equal(Object.keys(shapeC).length, 10);
  const restoredC = restoreCampaign(shapeC);
  assert.ok(restoredC);
  assert.deepEqual(restoredC.rewardIds, current.rewardIds);
  assert.deepEqual(restoredC.idleReturn, { version: 1, lastSettledAt: null, totalProgress: 0 });
  assert.deepEqual(restoredC.storyProgress, expectedMigratedStoryProgress);
  assert.equal(restoredC.unlockedCompanionSlots, 0);

  // shape (d): 11-key current pre-RPG production shape (rewards+idleReturn, no RPG fields),
  // WITH non-empty rewardIds/achievementIds — regression: an earlier implementation wiped these.
  const shapeD = { ...current };
  delete shapeD.wardenProgress;
  delete shapeD.ownedEquipmentIds;
  delete shapeD.companionFormation;
  delete shapeD.stageCarryOver;
  delete shapeD.storyProgress;
  delete shapeD.unlockedCompanionSlots;
  assert.equal(Object.keys(shapeD).length, 11);
  const restoredD = restoreCampaign(shapeD);
  assert.ok(restoredD);
  assert.deepEqual(restoredD.rewardIds, current.rewardIds, "non-empty rewardIds must round-trip unchanged through migration");
  assert.deepEqual(restoredD.achievementIds, current.achievementIds, "non-empty achievementIds must round-trip unchanged through migration");
  assert.deepEqual(restoredD.wardenProgress, { statPoints: {}, skillTreeIds: [], traitIds: [] });
  assert.deepEqual(restoredD.ownedEquipmentIds, []);
  assert.deepEqual(restoredD.companionFormation, {});
  assert.deepEqual(restoredD.storyProgress, expectedMigratedStoryProgress);

  // shape (e): 16-key pre-cycle-9 shape — everything except `unlockedCompanionSlots`. This is the
  // real production save that existed before the dynamic capacity system, so it MUST migrate to 0
  // unlocked slots (the historical hard cap of 3) rather than fail validation.
  const shapeE = { ...current };
  delete shapeE.unlockedCompanionSlots;
  assert.equal(Object.keys(shapeE).length, 16);
  const restoredE = restoreCampaign(shapeE);
  assert.ok(restoredE, "a pre-cycle-9 save must still load");
  assert.equal(restoredE.unlockedCompanionSlots, 0, "pre-cycle-9 saves default to zero purchased slots");
  assert.equal(companionCapacityForCampaign(restoredE), COMPANION_CAPACITY_BASE, "a migrated pre-cycle-9 save keeps the historical capacity of 3");
  assert.deepEqual(restoredE.storyProgress, expectedMigratedStoryProgress);
});

test("restoreCampaign rejects a tampered save with an unaffordable statPoints total", () => {
  const campaign = campaignWithElitesAndResolves("tamper-stat", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
    stages: ["cinder-span"],
  });
  const base = serializeCampaign(campaign); // echoCoreEarned = 3 + 1*3 = 6
  const tampered = { ...base, wardenProgress: { statPoints: { "binding-might": 10 }, skillTreeIds: [], traitIds: [] } }; // cost 40 > earned 6
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save with an unaffordable ownedEquipmentIds total", () => {
  const campaign = campaignWithElitesAndResolves("tamper-equip", {
    elites: [["e1", "ember-cohort"]],
    stages: ["cinder-span"],
  });
  const base = serializeCampaign(campaign); // boundFragmentEarned = 1
  const tampered = { ...base, ownedEquipmentIds: ["warden:weapon:0", "warden:weapon:1", "warden:weapon:2", "warden:weapon:3"] }; // cost 1+2+3+4=10 > earned 1
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save with more traitIds than WARDEN_TRAIT_UNLOCK_SEQUENCES.length", () => {
  const campaign = createCampaign({ campaignId: "tamper-traits" });
  const base = serializeCampaign(campaign);
  const tampered = {
    ...base,
    wardenProgress: {
      statPoints: {},
      skillTreeIds: [],
      traitIds: ["first-strike", "desperate-echo", "reckless-reclaim", "gate-keeper", "chain-reaction", "elite-hunter"],
    },
  };
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save with more than MAX_FRONT_SLOTS FRONT companions in companionFormation", () => {
  let campaign = campaignWithElitesAndResolves("tamper-formation-front", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "veil-vanguard"]);
  const base = serializeCampaign(campaign);
  const tampered = { ...base, companionFormation: { "ember-cohort": "FRONT", "rift-lens": "FRONT", "veil-vanguard": "FRONT" } };
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save whose companionFormation references a companion not in the current loadout", () => {
  let campaign = campaignWithElitesAndResolves("tamper-formation-ref", {
    elites: [["e1", "ember-cohort"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort"]);
  const base = serializeCampaign(campaign);
  const tampered = { ...base, companionFormation: { "anchor-shard": "FRONT" } };
  assert.equal(restoreCampaign(tampered), null);
});

test("a valid current-shape campaign restores without modification", () => {
  const campaign = campaignWithElitesAndResolves("valid-roundtrip", {
    elites: [["e1", "ember-cohort"]],
    stages: ["cinder-span"],
  });
  const serialized = serializeCampaign(campaign);
  assert.deepEqual(restoreCampaign(serialized), campaign);
  assert.deepEqual(restoreCampaign(JSON.stringify(serialized)), campaign);
});

test("deterministic persistence trace preserves stable campaign fields across serialize and restore", () => {
  let campaign = createCampaign({ campaignId: "deterministic-persistence-trace" });
  campaign = captureElite(campaign, "trace-elite-ember", "ember-cohort");
  campaign = captureElite(campaign, "trace-elite-rift", "rift-lens");
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens"]);
  campaign = setCompanionFormationSlot(campaign, "ember-cohort", "FRONT");
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });
  campaign = allocateWardenStatPoint(campaign, "binding-might");
  campaign = purchaseEquipmentTier(campaign, "warden", "weapon");
  campaign = settleIdleReturn(campaign, { now: 123456 }).campaign;

  const preSerialization = campaign;
  const firstSerialized = serializeCampaign(preSerialization);
  const restored = restoreCampaign(firstSerialized);
  const secondSerialized = serializeCampaign(restored);

  assert.deepEqual(restored, preSerialization);
  assert.deepEqual(secondSerialized, firstSerialized);
  assert.equal(restored.campaignId, preSerialization.campaignId);
  for (const field of [
    "resolvedIds",
    "companionCollection",
    "rewardIds",
    "achievementIds",
    "wardenProgress",
    "ownedEquipmentIds",
    "companionFormation",
    "idleReturn",
    "storyProgress",
  ]) {
    assert.deepEqual(restored[field], preSerialization[field], `${field} must survive persistence exactly`);
  }
});

// --- Cycle 9: dynamic legion capacity (core-loop-legion-spec.md §3) ---

/**
 * REPLACES the pre-cycle-9 "budget dominance" canary, which is now BOTH vacuous and wrong.
 *
 * That canary asserted `cumulativeCost >= maxGate` at every prefix, and reasoned from it that the
 * gate clause of `validUnlockedCompanionSlots` was load-time redundant: while earning was
 * `resolvedIds.length`, "affordable" strictly implied "gate met". Cycle 9 (`N-20260730-C9-01`)
 * changed earning to `resolvedIds.length * 3 + elites`, which breaks that implication outright — a
 * save can now be affordable AND gate-blocked (proved directly by the load-time gate witness below).
 *
 * The canary did not fire when that happened. With flat costs of 1 and gates 1,1,2,2,3,3,3 it reads
 * 1>=1, 2>=1, 3>=2, 4>=2, 5>=3, 6>=3, 7>=3 — trivially true, and true for essentially any flat
 * pricing. It was a dead canary asserting a false conclusion, so it is deleted rather than renamed.
 *
 * The invariant with teeth under the new economy is FUNDING, not dominance: every prefix of the
 * ladder must be payable out of what its own gate guarantees. This is exactly the property whose
 * absence was the G3 defect — the ladder cost 16 against a lifetime pool of 3 — and it is measured
 * through the real `boundFragmentEarned`, never a re-implementation of it, so a future change to the
 * earning formula is reflected here instead of silently invalidating a baked-in literal.
 */
test("every slot ladder prefix is payable out of the Bound Fragment its own stage gate guarantees (funding canary: fires if PM reprices a row or pushes a gate past its funding)", () => {
  let cumulativeCost = 0;
  for (const [index, entry] of COMPANION_SLOT_UNLOCKS.entries()) {
    cumulativeCost += entry.boundFragmentCost;
    // A campaign that has cleared exactly this row's gate and captured nothing: the weakest
    // legitimate wallet that is entitled to buy this row.
    const atGate = campaignWithElitesAndResolves(`ladder-funding-${index}`, {
      stages: STAGES.slice(0, entry.requiresStageClears).map(({ id }) => id),
    });
    assert.ok(
      cumulativeCost <= boundFragmentEarned(atGate),
      `slot ${entry.slot} (ladder row ${index}): the ladder costs ${cumulativeCost} cumulative by this row, but clearing its ${entry.requiresStageClears}-stage gate only earns ${boundFragmentEarned(atGate)}. A gate a player can reach but never afford is the G3 defect (N-20260730-C9-01) reopening.`,
    );
  }
});

/**
 * The reachability defect, locked. Repricing alone could NOT have fixed cycle 9: slots 7/8/9/10 were
 * gated behind 4/6/8/10 stage clears against `STAGES.length` of 3, so four ladder rows were
 * PERMANENTLY UNREACHABLE AT ANY PRICE — a second defect independent of cost, and one nothing in
 * this suite guarded. The funding canary above cannot catch it: an unreachable gate makes the
 * funding comparison meaningless rather than false, because `STAGES.slice(0, 6)` simply saturates.
 */
test("every slot ladder gate is reachable within the canonical stage count (locks the cycle-9 reachability defect that repricing alone could not fix)", () => {
  for (const entry of COMPANION_SLOT_UNLOCKS) {
    assert.ok(
      entry.requiresStageClears <= STAGES.length,
      `slot ${entry.slot} gates at ${entry.requiresStageClears} cleared stages but only ${STAGES.length} stages exist, so this row can never be purchased at any price`,
    );
  }
});

/**
 * INVERSION of "a full slot ladder is unaffordable by design, so maximum legion capacity is
 * unreachable in a legitimate campaign". That test encoded the G3 SHORTFALL as an invariant and
 * asserted `restoreCampaign(fullLadderSave) === null`. Cycle 9 resolved the shortfall, so the old
 * assertion is now backwards: this is the acceptance proof that `N-20260730-C9-01` is closed.
 *
 * BOTH halves are asserted. The first alone would be a re-baseline; the second is what the old test
 * was really protecting — that slots and equipment genuinely compete for one pool. Drop it and a
 * future earn-rate inflation that makes everything simultaneously affordable would pass unnoticed.
 */
test("maximum legion capacity is reachable in a legitimate campaign, and buying the full ladder still prices out a full equipment line (cycle-9 acceptance)", () => {
  const fullLadderCost = COMPANION_SLOT_UNLOCKS.reduce((sum, entry) => sum + entry.boundFragmentCost, 0);
  const campaign = campaignWithElitesAndResolves("capacity-reachable", { stages: STAGES.map(({ id }) => id) });
  const earned = boundFragmentEarned(campaign);
  assert.ok(
    fullLadderCost <= earned,
    `the ladder costs ${fullLadderCost} and a full clear earns ${earned}: capacity must be fundable on stage clears alone`,
  );

  // Half 1 — capacity 10 IS reachable through the real mutators.
  let maxed = campaign;
  for (let i = 0; i < COMPANION_SLOT_UNLOCKS.length; i += 1) maxed = purchaseCompanionSlot(maxed);
  assert.equal(maxed.unlockedCompanionSlots, COMPANION_SLOT_UNLOCKS.length);
  assert.equal(companionCapacityForCampaign(maxed), COMPANION_CAPACITY_MAX);
  assert.ok(restoreCampaign(serializeCampaign(maxed)), "a legitimately maxed save must now VALIDATE; rejecting it was the G3 shortfall this cycle resolved");

  // Half 2 — the tradeoff still bites: the ladder consumes the pool an equipment line needs.
  const remaining = boundFragmentEarned(maxed) - boundFragmentSpent(maxed);
  let tiers = maxed;
  let affordableSteps = 0;
  for (;;) {
    try { tiers = purchaseEquipmentTier(tiers, "warden", "weapon"); } catch { break; }
    affordableSteps += 1;
  }
  assert.ok(
    affordableSteps < EQUIPMENT_TIERS.length - 1,
    `after the full ladder only ${remaining} fragments remain, which must not fund all ${EQUIPMENT_TIERS.length - 1} tier steps of a single equipment line — slots and equipment must still compete`,
  );
  assert.throws(
    () => purchaseEquipmentTier(tiers, "warden", "weapon"),
    /Not enough Bound Fragment/u,
    "the equipment line must run out of budget, not out of tiers",
  );
  assert.ok(equipmentTierIndexFor(tiers, "warden", "weapon") < EQUIPMENT_TIERS.length - 1, "a full T5 line must remain unaffordable after maxing capacity");
});

/**
 * The terminal `!entry -> "Legion capacity is already at maximum."` branch of `purchaseCompanionSlot`,
 * reachable for the FIRST TIME after cycle 9 and previously uncovered. The deleted test above carried
 * a comment asserting this branch "has no reachable test through a real campaign" because
 * `requireCampaign` rejected a maxed input before the branch could run. That was a consequence of the
 * shortfall, not a property of the code, and it is no longer true — so the claim is removed with it.
 *
 * This is also the cleanest end-to-end proof that G3 is resolved: capacity 10 through the real
 * mutators, no tampered save and no serialization shortcut anywhere in the path.
 */
test("purchaseCompanionSlot reports max capacity once the whole ladder is bought (terminal branch, reachable only after the cycle-9 reprice)", () => {
  let campaign = campaignWithElitesAndResolves("capacity-terminal", { stages: STAGES.map(({ id }) => id) });
  for (let i = 0; i < COMPANION_SLOT_UNLOCKS.length; i += 1) {
    campaign = purchaseCompanionSlot(campaign);
    assert.equal(companionCapacityForCampaign(campaign), COMPANION_CAPACITY_BASE + i + 1, `purchase ${i + 1} must raise capacity by exactly 1`);
  }
  assert.equal(companionCapacityForCampaign(campaign), COMPANION_CAPACITY_MAX);
  assert.equal(companionSlotUnlockCostFor(campaign), null, "the lobby resolver must report no further slot at max capacity");
  assert.throws(
    () => purchaseCompanionSlot(campaign),
    /already at maximum/u,
    "the ladder is exhausted, so the terminal branch must surface as a capacity failure, never as a gate or payment failure",
  );
});

test("restoreCampaign rejects a tampered save claiming more unlocked slots than the ladder has rows", () => {
  let campaign = createCampaign({ campaignId: "tamper-slots-overlong" });
  for (const { id: stageId } of STAGES) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  const base = serializeCampaign(campaign);
  // Cycle 9 moved which clause fires here. The ladder now costs 7 against 9 earned, so `slice` past
  // the end still yields an AFFORDABLE, gate-met cost — the budget clause would ACCEPT this value.
  // The `> COMPANION_SLOT_UNLOCKS.length` range clause is now the SOLE rejecter, making this test
  // that clause's only witness rather than the redundant restatement it used to be.
  const overlong = COMPANION_SLOT_UNLOCKS.length + 1;
  const slicedCost = COMPANION_SLOT_UNLOCKS.slice(0, overlong).reduce((sum, entry) => sum + entry.boundFragmentCost, 0);
  assert.ok(slicedCost <= boundFragmentEarned(campaign), "precondition: the over-long value is affordable, so only the range clause can reject it");
  assert.equal(restoreCampaign({ ...base, unlockedCompanionSlots: overlong }), null);
});

test("restoreCampaign rejects a tampered save whose unlockedCompanionSlots is not a non-negative integer", () => {
  let campaign = createCampaign({ campaignId: "tamper-slots-nonint" });
  for (const { id: stageId } of STAGES) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  const base = serializeCampaign(campaign);
  // These two values are the ONLY witnesses that isolate the integer and sign clauses. Both slip
  // past the gate and budget checks on their own:
  //   1.5 -> slice(0, 1.5) keeps 1 row, cost 1 against the 9 a full clear earns and its gate is met, so only Number.isInteger rejects it.
  //   -7  -> slice(0, -7) is EMPTY, so cost 0 and gates vacuously met; only `unlocked < 0` rejects it.
  assert.equal(restoreCampaign({ ...base, unlockedCompanionSlots: 1.5 }), null, "a fractional slot count must be rejected by the integer clause");
  assert.equal(restoreCampaign({ ...base, unlockedCompanionSlots: -7 }), null, "a negative slot count must be rejected by the sign clause, not by a cost that a negative slice silently zeroes");
  assert.equal(restoreCampaign({ ...base, unlockedCompanionSlots: "2" }), null, "a string slot count must be rejected");
});

test("restoreCampaign accepts an affordable gate-met unlockedCompanionSlots and isolates each rejecting clause: budget (equipment-drained) and gate (affordable but unmet)", () => {
  let campaign = createCampaign({ campaignId: "tamper-slots-affordable" });
  for (const { id: stageId } of STAGES) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  const base = serializeCampaign(campaign); // earned 9 (3 stages * 3), no equipment spend
  // Slots 4 and 5 cost 1 each and gate at 1 cleared stage; both are met and affordable at a full clear.
  const restored = restoreCampaign({ ...base, unlockedCompanionSlots: 2 });
  assert.ok(restored, "an affordable, gate-met slot count must load");
  assert.equal(restored.unlockedCompanionSlots, 2);
  assert.equal(companionCapacityForCampaign(restored), COMPANION_CAPACITY_BASE + 2);

  /**
   * The load-time BUDGET clause witness. Cycle 9 made this materially harder to construct and the
   * old witness no longer works: every ladder row is now affordable at its own gate (7 cumulative
   * against 9 earned), so NO slot-only value can overdraw. Tampering with slots alone can no longer
   * reach this clause at all.
   *
   * So the witness must drain the pool with equipment first. Six fragments of weapon tiers leave 3
   * of 9; four slots then cost 4, totalling 10 > 9, while every one of those rows' gates (1,1,2,2)
   * IS met at a full clear. That isolates the budget clause: `gatesMet` alone admits this save.
   * Deleting `boundFragmentSpent(campaign) <= boundFragmentEarned(campaign)` from
   * `validUnlockedCompanionSlots` makes ONLY this assertion fail.
   */
  let drained = campaign;
  for (let step = 0; step < 3; step += 1) drained = purchaseEquipmentTier(drained, "warden", "weapon");
  const drainedBase = serializeCampaign(drained);
  assert.equal(boundFragmentSpent(drained), 6, "precondition: equipment has committed 6 of the 9 earned fragments");
  assert.ok(
    restoreCampaign({ ...drainedBase, unlockedCompanionSlots: 3 }),
    "three slots cost 3, exactly exhausting the remaining budget, so this must still load",
  );
  const oneTooMany = restoreCampaign({ ...drainedBase, unlockedCompanionSlots: 4 });
  assert.equal(oneTooMany, null, "the fourth slot's gate is met but its cost pushes total spend to 10 against 9 earned, so the save must be rejected on budget alone");

  /**
   * The load-time GATE clause witness — newly constructible, and newly REQUIRED. While earning was
   * `resolvedIds.length`, "affordable" implied "gate met", so no save could isolate this clause and
   * the old canary called it redundant. Under cycle-9 earning, one cleared stage pays 3 while the
   * third ladder row still gates at 2 clears: affordable, yet gate-blocked. Deleting the `gatesMet`
   * conjunct from `validUnlockedCompanionSlots` makes ONLY this assertion fail.
   */
  const oneStage = campaignWithElitesAndResolves("tamper-slots-gate", { stages: [STAGES[0].id] });
  const oneStageBase = serializeCampaign(oneStage);
  const threeRowCost = COMPANION_SLOT_UNLOCKS.slice(0, 3).reduce((sum, entry) => sum + entry.boundFragmentCost, 0);
  assert.ok(threeRowCost <= boundFragmentEarned(oneStage), "precondition: three rows are affordable on one clear, so only the gate can reject them");
  assert.ok(restoreCampaign({ ...oneStageBase, unlockedCompanionSlots: 2 }), "the first two rows gate at 1 clear and must load");
  assert.equal(
    restoreCampaign({ ...oneStageBase, unlockedCompanionSlots: 3 }),
    null,
    "the third row is affordable but gates at 2 cleared stages against 1 resolved, so the save must be rejected on the gate alone",
  );
});

test("purchaseCompanionSlot and purchaseEquipmentTier draw from the SAME Bound Fragment budget in both directions", () => {
  let campaign = createCampaign({ campaignId: "shared-fragment-budget" });
  for (const { id: stageId } of STAGES) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  assert.equal(boundFragmentEarned(campaign), STAGES.length * 3);

  // Direction 1: slots first shrink what equipment can afford.
  let fourSlots = campaign;
  for (let i = 0; i < 4; i += 1) fourSlots = purchaseCompanionSlot(fourSlots);
  assert.equal(boundFragmentSpent(fourSlots), 4, "slot purchases must register as Bound Fragment spend");
  const slotsThenEquip = purchaseEquipmentTier(purchaseEquipmentTier(fourSlots, "warden", "weapon"), "warden", "weapon");
  assert.equal(boundFragmentSpent(slotsThenEquip), 7, "4 slots + tier steps 0 and 1 (1+2)");
  assert.throws(
    () => purchaseEquipmentTier(slotsThenEquip, "warden", "weapon"),
    /Not enough Bound Fragment/u,
    "step 2 costs 3 more; the four purchased slots already consumed the fragments that would have paid for it",
  );

  // Control: without the slot purchases the identical equipment path SUCCEEDS on the same earnings.
  // This is what proves the block above came from the shared budget and not from an equipment rule.
  let equipOnly = campaign;
  for (let step = 0; step < 3; step += 1) equipOnly = purchaseEquipmentTier(equipOnly, "warden", "weapon");
  assert.equal(equipmentTierIndexFor(equipOnly, "warden", "weapon"), 3, "the same three tier steps must be affordable when no slots were bought");
  assert.equal(boundFragmentSpent(equipOnly), 6);

  // Direction 2: equipment first shrinks what slots can afford. Two ward steps commit the last 3.
  const fullyCommitted = purchaseEquipmentTier(purchaseEquipmentTier(equipOnly, "warden", "ward"), "warden", "ward");
  assert.equal(boundFragmentSpent(fullyCommitted), STAGES.length * 3, "equipment has now committed the entire lifetime pool");
  const blockedSlot = companionSlotUnlockCostFor(fullyCommitted);
  assert.equal(blockedSlot.stageGateMet, true, "the gate is met, so only the shared budget can block this slot");
  assert.equal(blockedSlot.affordable, false);
  assert.throws(
    () => purchaseCompanionSlot(fullyCommitted),
    /Not enough Bound Fragment/u,
    "slot 4 costs 1 but equipment already committed the whole 9-fragment budget",
  );
  // And the slot WAS affordable before that equipment spend — same campaign, same earnings.
  assert.equal(companionCapacityForCampaign(purchaseCompanionSlot(campaign)), COMPANION_CAPACITY_BASE + 1);
});

test("purchaseCompanionSlot fails on the stage-clear gate before the budget, with a distinct gate message", () => {
  const fresh = createCampaign({ campaignId: "slot-gate-unmet" });
  assert.equal(boundFragmentEarned(fresh), 0);
  /**
   * ORDERING witness, still valid after cycle 9 [OBSERVED]. Slot 4 gates at 1 cleared stage and
   * costs 1, so a fresh campaign violates BOTH rules simultaneously: the gate (0 clears < 1) and the
   * budget (spending 1 against 0 earned). Only ordering decides which message surfaces. Delete the
   * gate check and this throws /Not enough Bound Fragment/ instead, failing this assertion — which
   * is what makes it a genuine ordering proof rather than a bare gate check.
   */
  assert.equal(COMPANION_SLOT_UNLOCKS[0].boundFragmentCost, 1, "precondition: the first row costs more than a fresh campaign's 0 earned, so the budget is violated too");
  assert.throws(
    () => purchaseCompanionSlot(fresh),
    /Slot 4 unlocks at 1 cleared stages/u,
    "with both rules violated the gate must win: an unmet stage gate must surface as a gate failure, never as a payment failure",
  );

  /**
   * Gate binding INDEPENDENTLY of affordability. Cycle 9 strengthened this case: one cleared stage
   * now earns 3, which is enough to pay for the third ladder row — the lobby resolver confirms
   * `affordable: true` — yet its 2-clear gate blocks it. Before cycle 9 no such campaign existed,
   * because affordability implied the gate was met.
   */
  const oneStage = campaignWithElitesAndResolves("slot-gate-one-stage", { stages: [STAGES[0].id] });
  const twoSlots = purchaseCompanionSlot(purchaseCompanionSlot(oneStage));
  assert.equal(companionCapacityForCampaign(twoSlots), COMPANION_CAPACITY_BASE + 2);
  const gated = companionSlotUnlockCostFor(twoSlots);
  assert.equal(gated.slot, 6);
  assert.equal(gated.affordable, true, "the fragments to pay for this slot are in hand, isolating the gate as the blocking rule");
  assert.equal(gated.stageGateMet, false, "the lobby resolver must report the same unmet gate");
  assert.throws(
    () => purchaseCompanionSlot(twoSlots),
    /Slot 6 unlocks at 2 cleared stages/u,
    "budget alone is insufficient: the next slot's stage gate must block even when the player can afford it",
  );
});

test("purchaseCompanionSlot fails with insufficient Bound Fragment rather than overdrawing, once the gate is met", () => {
  const campaign = campaignWithElitesAndResolves("slot-budget-unmet", { stages: STAGES.map(({ id }) => id) });
  /**
   * The MUTATION-TIME budget clause witness (`campaign-state.js` purchaseCompanionSlot). Cycle 9
   * repriced the ladder so every row is affordable at its own gate — cumulative 7 against 9 earned —
   * which makes a slot-only budget failure UNREACHABLE. A witness that buys only slots would leave
   * that clause unable to fire at all, so deleting it would keep the whole suite green: the test
   * would be theatre.
   *
   * The pool must therefore be drained with equipment first. Three weapon steps (1+2+3) and two ward
   * steps (1+2) commit all 9, after which slot 4's gate is MET and only the budget can refuse it.
   */
  let drained = campaign;
  for (let step = 0; step < 3; step += 1) drained = purchaseEquipmentTier(drained, "warden", "weapon");
  drained = purchaseEquipmentTier(purchaseEquipmentTier(drained, "warden", "ward"), "warden", "ward");
  assert.equal(boundFragmentSpent(drained), boundFragmentEarned(drained), "precondition: equipment has committed the entire pool");

  const next = companionSlotUnlockCostFor(drained);
  assert.equal(next.slot, 4);
  assert.equal(next.stageGateMet, true, "the gate is satisfied, isolating the budget as the blocking rule");
  assert.equal(next.affordable, false);
  assert.throws(() => purchaseCompanionSlot(drained), /Not enough Bound Fragment/u);
  // The rejection must not leave a partial purchase behind.
  assert.equal(drained.unlockedCompanionSlots, 0, "a failed purchase must not mutate the source campaign");
  assert.equal(boundFragmentSpent(drained), boundFragmentEarned(drained), "a failed purchase must not overdraw the budget");
});

test("companionCapacityForCampaign returns the base for a fresh campaign, adds exactly 1 per unlocked slot, and clamps at the maximum", () => {
  assert.equal(companionCapacityForCampaign(createCampaign({ campaignId: "capacity-fresh" })), COMPANION_CAPACITY_BASE);

  // Exercised on the pure resolver at every row. Since cycle 9 the upper rows ARE reachable in a real
  // campaign (see the acceptance test above), but the resolver is total and its clamp is the guard
  // against a repriced ladder or a forged count, so each row is still asserted directly.
  for (let unlocked = 0; unlocked <= COMPANION_SLOT_UNLOCKS.length; unlocked += 1) {
    assert.equal(
      companionCapacityForCampaign({ unlockedCompanionSlots: unlocked }),
      COMPANION_CAPACITY_BASE + unlocked,
      `${unlocked} unlocked slots must derive capacity ${COMPANION_CAPACITY_BASE + unlocked}`,
    );
  }
  assert.equal(COMPANION_CAPACITY_BASE + COMPANION_SLOT_UNLOCKS.length, COMPANION_CAPACITY_MAX, "the ladder must span exactly base -> max with no gap or overshoot");

  // Past the ladder both the count and the capacity clamp instead of running away.
  assert.equal(companionSlotsUnlocked({ unlockedCompanionSlots: 99 }), COMPANION_SLOT_UNLOCKS.length);
  assert.equal(companionCapacityForCampaign({ unlockedCompanionSlots: 99 }), COMPANION_CAPACITY_MAX);
  // A pre-cycle-9 shape reaching the resolver before migration must read as the base, not NaN.
  assert.equal(companionCapacityForCampaign({}), COMPANION_CAPACITY_BASE);
});

test("setCompanionLoadout accepts a loadout up to the DERIVED capacity and rejects one beyond it", () => {
  let campaign = createCampaign({ campaignId: "loadout-derived-capacity" });
  for (const { id: stageId } of STAGES) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  const owned = ["ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo", "dawnless-crown"];
  for (const prototype of owned) campaign = captureElite(campaign, `elite-${prototype}`, prototype);

  // At base capacity 3: three fit, a fourth does not — even though six companions are owned.
  assert.equal(companionCapacityForCampaign(campaign), COMPANION_CAPACITY_BASE);
  assert.equal(setCompanionLoadout(campaign, owned.slice(0, 3)).companionLoadout.prototypeIds.length, 3);
  assert.throws(() => setCompanionLoadout(campaign, owned.slice(0, 4)), /up to 3 owned canonical companions/u);

  // Two purchased slots raise the DERIVED bound to 5: five now fit, six still do not.
  const twoSlots = purchaseCompanionSlot(purchaseCompanionSlot(campaign));
  assert.equal(companionCapacityForCampaign(twoSlots), COMPANION_CAPACITY_BASE + 2);
  assert.equal(setCompanionLoadout(twoSlots, owned.slice(0, 5)).companionLoadout.prototypeIds.length, 5, "capacity purchased with fragments must actually be usable");
  assert.throws(() => setCompanionLoadout(twoSlots, owned), /up to 5 owned canonical companions/u, "the derived bound must move with purchases, not jump to the literal ceiling");
});

test("load-time validation bounds the loadout by the literal ceiling while setCompanionLoadout bounds it by the derived capacity (spec §3 asymmetry, deliberately not one bound)", () => {
  let campaign = createCampaign({ campaignId: "loadout-bound-asymmetry" });
  const owned = ["ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo"];
  for (const prototype of owned) campaign = captureElite(campaign, `elite-${prototype}`, prototype);
  campaign = startRun(campaign, STAGES[0].id);
  campaign = applyCampaignRunResult(campaign, { stageId: STAGES[0].id, outcome: "victory" });

  // A five-companion loadout with ZERO purchased slots: over the derived capacity of 3, under the
  // literal ceiling of 10. `validCampaign` checks the loadout BEFORE it validates `resolvedIds`, so
  // it deliberately uses the literal ceiling — calling the derived resolver there would let a save
  // self-certify its capacity from fields not yet vetted (campaign-state.js:361-370).
  const forged = {
    ...serializeCampaign(campaign),
    companionLoadout: { prototypeIds: [...owned].sort() },
  };
  assert.equal(forged.unlockedCompanionSlots, 0);
  const restored = restoreCampaign(forged);
  assert.ok(restored, "load time must accept a well-formed loadout within the literal ceiling even though it exceeds the derived capacity");
  assert.equal(restored.companionLoadout.prototypeIds.length, 5);
  assert.equal(companionCapacityForCampaign(restored), COMPANION_CAPACITY_BASE);

  // MUTATION time refuses to grow — or even re-set — that same loadout, quoting the derived bound.
  assert.throws(
    () => setCompanionLoadout(restored, owned),
    /up to 3 owned canonical companions/u,
    "the mutation bound is the derived capacity, so an over-capacity legacy loadout cannot be re-committed",
  );
  // The asymmetry must not brick the save: shrinking into the derived capacity still works.
  assert.equal(setCompanionLoadout(restored, owned.slice(0, 3)).companionLoadout.prototypeIds.length, 3);
});
