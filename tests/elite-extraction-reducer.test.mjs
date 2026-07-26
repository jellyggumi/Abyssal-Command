import assert from "node:assert/strict";
import test from "node:test";

import {
  createCampaign,
  applyEliteExtractionEvents,
} from "../campaign-state.js";

function campaignKeys(campaign) {
  return Object.keys(campaign).sort();
}

test("applyEliteExtractionEvents keeps campaign reference on identical same-id replay", () => {
  const campaign = createCampaign({ campaignId: "elite-reducer-identical-event-id" });
  const captured = applyEliteExtractionEvents(campaign, [{ eventId: "evt-1", eliteId: "elite-ember", prototype: "ember-cohort" }]);
  const replayed = applyEliteExtractionEvents(captured, [{ eventId: "evt-1", eliteId: "elite-ember", prototype: "ember-cohort" }]);

  assert.equal(replayed, captured);
});

test("applyEliteExtractionEvents keeps campaign reference for already-captured same elite/prototype", () => {
  const campaign = createCampaign({ campaignId: "elite-reducer-repeat-prototype" });
  const captured = applyEliteExtractionEvents(campaign, [{ eventId: "evt-1", eliteId: "elite-ember", prototype: "ember-cohort" }]);
  const replay = applyEliteExtractionEvents(captured, [{ eventId: "evt-2", eliteId: "elite-ember", prototype: "ember-cohort" }]);

  assert.equal(replay, captured);
  assert.equal(replay.companionCollection.length, 1);
  assert.deepEqual(replay.companionCollection[0].capturedEliteIds, ["elite-ember"]);
});

test("applyEliteExtractionEvents captures a new elite and preserves schema without auto-equip", () => {
  const campaign = createCampaign({ campaignId: "elite-reducer-capture" });
  const keysBefore = campaignKeys(campaign);

  const captured = applyEliteExtractionEvents(campaign, [{ eventId: "evt-1", eliteId: "elite-ember", prototype: "ember-cohort" }]);

  assert.notEqual(captured, campaign);
  assert.deepEqual(keysBefore, campaignKeys(captured));
  assert.deepEqual(captured.companionLoadout.prototypeIds, []);
  assert.deepEqual(captured.companionFormation, {});
  assert.deepEqual(captured.companionCollection, [
    {
      prototype: "ember-cohort",
      evolution: 1,
      capturedEliteIds: ["elite-ember"],
    },
  ]);
  assert.deepEqual(captured.ownedEquipmentIds, []);
  assert.equal(captured.companionLoadout.prototypeIds.includes("ember-cohort"), false);
});

test("applyEliteExtractionEvents throws when event payload fields are missing/invalid", () => {
  const campaign = createCampaign({ campaignId: "elite-reducer-invalid" });

  assert.throws(() => applyEliteExtractionEvents(campaign, [{}]), TypeError);
  assert.throws(() => applyEliteExtractionEvents(campaign, [{ eventId: "evt", eliteId: "", prototype: "ember-cohort" }]), TypeError);
  assert.throws(() => applyEliteExtractionEvents(campaign, [{ eventId: "evt", eliteId: "elite-ember", prototype: "not-a-companion" }]), TypeError);
});

test("applyEliteExtractionEvents rejects replayed eventId with conflicting payload", () => {
  const campaign = createCampaign({ campaignId: "elite-reducer-conflict-event-id" });

  assert.throws(() => applyEliteExtractionEvents(campaign, [
    { eventId: "evt", eliteId: "elite-ember", prototype: "ember-cohort" },
    { eventId: "evt", eliteId: "elite-rift", prototype: "rift-lens" },
  ]), TypeError);
});

test("applyEliteExtractionEvents rejects same elite mapped to different prototype", () => {
  const campaign = applyEliteExtractionEvents(createCampaign({ campaignId: "elite-reducer-conflict-proto" }), [
    { eventId: "evt-1", eliteId: "elite-shared", prototype: "ember-cohort" },
  ]);

  assert.throws(() => applyEliteExtractionEvents(campaign, [
    { eventId: "evt-2", eliteId: "elite-shared", prototype: "rift-lens" },
  ]), TypeError);
});

test("applyEliteExtractionEvents rejects two distinct new handoffs in one cumulative batch", () => {
  const campaign = createCampaign({ campaignId: "elite-reducer-two-handoffs" });

  assert.throws(() => applyEliteExtractionEvents(campaign, [
    { eventId: "evt-1", eliteId: "elite-ember", prototype: "ember-cohort" },
    { eventId: "evt-2", eliteId: "elite-rift", prototype: "rift-lens" },
  ]), TypeError);
});

test("applyEliteExtractionEvents allows a second distinct elite in a later run/batch", () => {
  const afterFirstRun = applyEliteExtractionEvents(createCampaign({ campaignId: "elite-reducer-later-run" }), [
    { eventId: "run-1:evt-1", eliteId: "elite-ember", prototype: "ember-cohort" },
  ]);
  const afterSecondRun = applyEliteExtractionEvents(afterFirstRun, [
    { eventId: "run-2:evt-1", eliteId: "elite-rift", prototype: "rift-lens" },
  ]);

  assert.equal(afterFirstRun.companionCollection.length, 1);
  assert.equal(afterSecondRun.companionCollection.length, 2);
  assert.equal(afterSecondRun.companionCollection.find((record) => record.prototype === "ember-cohort" )?.capturedEliteIds[0], "elite-ember");
  assert.equal(afterSecondRun.companionCollection.find((record) => record.prototype === "rift-lens" )?.capturedEliteIds[0], "elite-rift");
  assert.notEqual(afterSecondRun, afterFirstRun);
});
