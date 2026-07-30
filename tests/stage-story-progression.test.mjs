import assert from "node:assert/strict";
import test from "node:test";

import { cutsceneFromEvent } from "../defense-cutscene.js";
import {
  MAX_EXTRACTED_SKILL_LOADOUT,
  MAX_EXTRACTED_SKILL_LEVEL,
  applyCampaignRunResult,
  captureElite,
  createCampaign,
  echoCoreEarned,
  echoCoreSpent,
  extractedSkillUpgradeCostForLevel,
  equipAppearanceItem,
  equipExtractedSkill,
  restoreCampaign,
  serializeCampaign,
  startRun,
  upgradeExtractedSkill,
  unequipExtractedSkill,
} from "../campaign-state.js";
import { SKILLS } from "../defense-catalog.js";
import { createDefenseRun, getRunSnapshot } from "../defense-run-simulation.js";
import {
  STAGE_STORIES,
  questProgressForEvents,
  storyBeatForEvent,
} from "../stage-story-catalog.js";
import { stageWorldFor } from "../stage-world-catalog.js";

const STORY_STAGE_IDS = ["cinder-span", "abyss-chancel", "echo-throne"];
const EMPTY_STORY_PROGRESS = {
  version: 1,
  questCompletionsByStage: {},
  extractedSkillIds: [],
  extractedSkillLevels: {},
  activeSkillLoadout: [],
  appearanceItemIds: [],
  equippedAppearance: {},
};

function clearStage(campaign, stageId) {
  const started = startRun(campaign, stageId);
  return applyCampaignRunResult(started, { stageId, outcome: "victory" });
}

function clearStoryStages(campaignId) {
  let campaign = createCampaign({ campaignId });
  for (const stageId of STORY_STAGE_IDS) campaign = clearStage(campaign, stageId);
  return campaign;
}

test("create, serialize, and restore preserve the canonical empty story-progress save contract", () => {
  const campaign = createCampaign({ campaignId: "story-progress-empty" });
  const serialized = serializeCampaign(campaign);

  assert.deepEqual(campaign.storyProgress, EMPTY_STORY_PROGRESS);
  assert.deepEqual(serialized.storyProgress, EMPTY_STORY_PROGRESS);
  assert.deepEqual(restoreCampaign(serialized)?.storyProgress, EMPTY_STORY_PROGRESS);
  assert.deepEqual(restoreCampaign(JSON.stringify(serialized))?.storyProgress, EMPTY_STORY_PROGRESS);
});

test("a first stage clear grants its story rewards once and repeat clears stay idempotent", () => {
  const firstClear = clearStage(createCampaign({ campaignId: "story-first-clear" }), "cinder-span");

  assert.deepEqual(firstClear.storyProgress.questCompletionsByStage, { "cinder-span": true });
  assert.deepEqual(firstClear.storyProgress.extractedSkillIds, ["rift-bolt"]);
  assert.deepEqual(firstClear.storyProgress.extractedSkillLevels, { "rift-bolt": 1 });
  assert.equal(SKILLS[firstClear.storyProgress.extractedSkillIds[0]]?.kind, "active");
  assert.deepEqual(firstClear.storyProgress.appearanceItemIds, ["cinder-span-ember-chain"]);
  assert.deepEqual(firstClear.storyProgress.equippedAppearance, { back: "cinder-span-ember-chain" });

  const repeated = clearStage(firstClear, "cinder-span");
  assert.deepEqual(repeated.storyProgress, firstClear.storyProgress);
  assert.equal(repeated.storyProgress.extractedSkillIds.length, 1);
  assert.equal(repeated.storyProgress.appearanceItemIds.length, 1);
});

test("the extracted active-skill loadout accepts all three story skills once and rejects unowned ids", () => {
  let campaign = clearStoryStages("story-skill-loadout");
  const storySkillIds = STORY_STAGE_IDS.map((stageId) => STAGE_STORIES[stageId].extractionReward.skillId);

  for (const skillId of storySkillIds) campaign = equipExtractedSkill(campaign, skillId);
  assert.equal(MAX_EXTRACTED_SKILL_LOADOUT, 3);
  assert.equal(campaign.storyProgress.activeSkillLoadout.length, 3);
  assert.deepEqual(campaign.storyProgress.activeSkillLoadout, [...storySkillIds].sort());

  const repeated = equipExtractedSkill(campaign, storySkillIds[0]);
  assert.deepEqual(repeated.storyProgress.activeSkillLoadout, campaign.storyProgress.activeSkillLoadout);
  for (const skillId of ["soul-lance", "not-a-skill"]) {
    assert.throws(
      () => equipExtractedSkill(campaign, skillId),
      /Extracted skill must be unlocked before it can be equipped/,
      `${skillId} must not enter the extracted-skill loadout`,
    );
  }
});

test("unequipping one active skill preserves extraction ownership and levels without mutating the source campaign", () => {
  let equipped = clearStoryStages("story-skill-unequip");
  const storySkillIds = STORY_STAGE_IDS.map((stageId) => STAGE_STORIES[stageId].extractionReward.skillId);
  for (const skillId of storySkillIds) equipped = equipExtractedSkill(equipped, skillId);
  const beforeUnequip = serializeCampaign(equipped);
  const removedSkillId = storySkillIds[1];

  const unequipped = unequipExtractedSkill(equipped, removedSkillId);

  assert.deepEqual(equipped, beforeUnequip, "unequip must not mutate the source campaign");
  assert.deepEqual(
    unequipped.storyProgress.activeSkillLoadout,
    beforeUnequip.storyProgress.activeSkillLoadout.filter((skillId) => skillId !== removedSkillId),
  );
  assert.deepEqual(unequipped.storyProgress.extractedSkillIds, beforeUnequip.storyProgress.extractedSkillIds);
  assert.deepEqual(unequipped.storyProgress.extractedSkillLevels, beforeUnequip.storyProgress.extractedSkillLevels);
});

test("extracted-skill upgrades spend cumulative Echo Core costs and stop at level 5", () => {
  for (const [level, expectedCost] of [[1, 0], [2, 1], [3, 2], [4, 3], [5, 4]]) {
    assert.equal(extractedSkillUpgradeCostForLevel(level), expectedCost);
  }

  let budgetLimited = clearStage(createCampaign({ campaignId: "story-upgrade-budget" }), "cinder-span");
  budgetLimited = upgradeExtractedSkill(budgetLimited, "rift-bolt");
  budgetLimited = upgradeExtractedSkill(budgetLimited, "rift-bolt");
  assert.equal(budgetLimited.storyProgress.extractedSkillLevels["rift-bolt"], 3);
  assert.equal(echoCoreSpent(budgetLimited), 3);
  assert.throws(() => upgradeExtractedSkill(budgetLimited, "rift-bolt"), /Not enough Echo Core/);
  assert.equal(budgetLimited.storyProgress.extractedSkillLevels["rift-bolt"], 3);

  let funded = createCampaign({ campaignId: "story-upgrade-max" });
  const elites = [
    ["story-elite-1", "ember-cohort"],
    ["story-elite-2", "rift-lens"],
    ["story-elite-3", "veil-vanguard"],
  ];
  for (const [eliteId, prototype] of elites) funded = captureElite(funded, eliteId, prototype);
  for (const stageId of STORY_STAGE_IDS) funded = clearStage(funded, stageId);
  assert.equal(echoCoreEarned(funded), 12);

  for (const [expectedLevel, expectedCost] of [[2, 1], [3, 3], [4, 6], [5, 10]]) {
    funded = upgradeExtractedSkill(funded, "rift-bolt");
    assert.equal(funded.storyProgress.extractedSkillLevels["rift-bolt"], expectedLevel);
    assert.equal(echoCoreSpent(funded), expectedCost);
  }
  assert.equal(MAX_EXTRACTED_SKILL_LEVEL, 5);
  assert.throws(() => upgradeExtractedSkill(funded, "rift-bolt"), /already at max level/);
});

test("appearance equipment remains owned and bound to its authored slot", () => {
  const campaign = clearStoryStages("story-appearance-slots");
  const expectedBySlot = {
    back: "cinder-span-ember-chain",
    ward: "abyss-chancel-ward",
    head: "echo-throne-crown",
  };

  assert.deepEqual(campaign.storyProgress.equippedAppearance, expectedBySlot);
  for (const itemId of Object.values(expectedBySlot)) {
    assert.ok(campaign.storyProgress.appearanceItemIds.includes(itemId), `${itemId} must be owned before it is equipped`);
  }
  assert.throws(
    () => equipAppearanceItem(campaign, "not-an-appearance-item"),
    /Appearance item must be owned before it can be equipped/,
  );

  const wrongSlot = serializeCampaign(campaign);
  wrongSlot.storyProgress.equippedAppearance = { head: "cinder-span-ember-chain" };
  assert.equal(restoreCampaign(wrongSlot), null, "a save cannot equip an owned appearance in another slot");
});

test("every story reward and quest giver resolves through the live skill and stage-world catalogs", () => {
  const stories = Object.values(STAGE_STORIES);
  assert.equal(stories.length, 3);

  for (const story of stories) {
    const skill = SKILLS[story.extractionReward.skillId];
    assert.ok(skill, `${story.stageId} extraction skill must exist`);
    assert.equal(skill.kind, "active", `${story.stageId} extraction reward must be an active skill`);

    const world = stageWorldFor(story.stageId);
    assert.ok(world, `${story.stageId} must have a live stage-world profile`);
    const questGiver = world.presentation.npcs.find((npc) => npc.id === story.quest.giverNpcId);
    assert.ok(questGiver, `${story.quest.giverNpcId} must be placed in ${story.stageId}`);
    assert.equal(questGiver.questId, story.quest.id, `${story.quest.id} must be assigned to its placed NPC`);
  }
});

const OBJECTIVE_EVENT_CASES = [
  {
    stageId: "cinder-span",
    questId: "cinder-span:unchain-the-descent",
    objectiveIds: ["cross-ember-relay", "hold-drowned-forge", "reverse-cinder-seal", "release-the-chains"],
    events: [
      { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "cinder-relay-crossing" },
      { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "cinder-forge-stand" },
      { type: "OCCUPATION_CAPTURED", occupationPointId: "cinder-seal" },
      { type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" },
    ],
  },
  {
    stageId: "abyss-chancel",
    questId: "abyss-chancel:refuse-repeated-answer",
    objectiveIds: ["advance-the-nave", "lock-the-transept", "refuse-the-oath", "shatter-classification"],
    events: [
      { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "chancel-nave-advance" },
      { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "chancel-transept-lock" },
      { type: "OCCUPATION_CAPTURED", occupationPointId: "chancel-oath" },
      { type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" },
    ],
  },
  {
    stageId: "echo-throne",
    questId: "echo-throne:break-the-command",
    objectiveIds: ["break-the-aisle", "stand-at-the-dais", "claim-the-domain", "break-the-sovereign-command"],
    events: [
      { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "throne-aisle-break" },
      { type: "ENCOUNTER_OBJECTIVE_COMPLETED", objectiveId: "throne-dais-stand" },
      { type: "OCCUPATION_CAPTURED", occupationPointId: "throne-domain" },
      { type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" },
    ],
  },
];

test("quest progress derives all four objectives from existing events in authored order", () => {
  for (const { stageId, questId, objectiveIds, events } of OBJECTIVE_EVENT_CASES) {
    const outOfOrder = questProgressForEvents(stageId, [events[1], events[0], events[2], events[3]]);
    assert.deepEqual(outOfOrder, {
      questId,
      completedObjectiveIds: [objectiveIds[0]],
      completedObjectives: 1,
      totalObjectives: 4,
      currentObjectiveId: objectiveIds[1],
      completed: false,
    }, `${stageId} must not credit an objective emitted before its prerequisite`);

    const representativeEvents = events.flatMap((event, index) => [
      { type: "DAMAGE_DEALT", eventId: `${stageId}:noise:${index}` },
      { ...event, eventId: `${stageId}:objective:${index}`, version: 4 },
    ]);
    assert.deepEqual(questProgressForEvents(stageId, representativeEvents), {
      questId,
      completedObjectiveIds: objectiveIds,
      completedObjectives: 4,
      totalObjectives: 4,
      currentObjectiveId: null,
      completed: true,
    });
  }
});

const STORY_BEAT_CASES = [
  {
    stageId: "cinder-span",
    events: [
      [{ type: "STAGE_STARTED", stageId: "cinder-span" }, "questAcquisition"],
      [{ type: "OCCUPATION_CAPTURED", occupationPointId: "cinder-seal" }, "occupationReversal"],
      [{ type: "BOSS_SPAWNED", bossId: "s1-cinder-warden" }, "bossEntry"],
      [{ type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }, "questCompletion"],
    ],
  },
  {
    stageId: "abyss-chancel",
    events: [
      [{ type: "STAGE_STARTED", stageId: "abyss-chancel" }, "questAcquisition"],
      [{ type: "OCCUPATION_CAPTURED", occupationPointId: "chancel-oath" }, "occupationReversal"],
      [{ type: "BOSS_SPAWNED", bossId: "s2-veil-tactician" }, "bossEntry"],
      [{ type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }, "questCompletion"],
    ],
  },
  {
    stageId: "echo-throne",
    events: [
      [{ type: "STAGE_STARTED", stageId: "echo-throne" }, "questAcquisition"],
      [{ type: "OCCUPATION_CAPTURED", occupationPointId: "throne-domain" }, "occupationReversal"],
      [{ type: "BOSS_SPAWNED", bossId: "s3-gate-sovereign" }, "bossEntry"],
      [{ type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }, "questCompletion"],
    ],
  },
];

test("story beats match the existing stage-start, occupation, boss, and boss-kill event vocabulary", () => {
  for (const { stageId, events } of STORY_BEAT_CASES) {
    for (const [event, expectedKind] of events) {
      assert.equal(storyBeatForEvent(stageId, { ...event, version: 4 })?.kind, expectedKind);
    }
    assert.equal(storyBeatForEvent(stageId, { type: "BOSS_SPAWNED", bossId: "wrong-boss" }), null);
  }
  assert.equal(storyBeatForEvent("not-a-stage", { type: "STAGE_STARTED", stageId: "not-a-stage" }), null);
});

test("the public stage-start event reaches the cutscene adapter with authored acquisition dialogue", () => {
  const snapshot = getRunSnapshot(createDefenseRun({ stageId: "cinder-span", seed: 73 }));
  const stageStarted = snapshot.events.find((event) => event.type === "STAGE_STARTED");
  const acquisitionText = STAGE_STORIES["cinder-span"].storyBeats
    .find((beat) => beat.kind === "questAcquisition").dialogue.text;

  assert.ok(stageStarted, "the public snapshot must expose STAGE_STARTED");
  assert.equal(stageStarted.storyBeat?.dialogue?.text, acquisitionText, "the event story payload must expose the authored quest acquisition");
  assert.ok(cutsceneFromEvent(stageStarted)?.lines.includes(acquisitionText), "the presentation adapter must keep that authored line reachable");
});
