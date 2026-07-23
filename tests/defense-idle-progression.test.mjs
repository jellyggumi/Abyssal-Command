import assert from "node:assert/strict";
import test from "node:test";

import {
  IDLE_RETURN_INTERVAL_MS,
  IDLE_RETURN_MAX_ELAPSED_MS,
  applyCampaignRunResult,
  createCampaign,
  serializeCampaign,
  settleIdleReturn,
  startRun,
  wardLevel,
} from "../campaign-state.js";
import { STAGES } from "../defense-catalog.js";
import { DefenseStorage } from "../defense-storage.js";
import { createDefenseRun, getRunSnapshot } from "../defense-run-simulation.js";

function memoryStorage(initialValues = []) {
  const values = new Map(initialValues);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

/**
 * `count` completed stages, drawn from the real 10-stage `STAGES` order (not a fixed
 * 2-stage list) so tests can reach a `wardLevel` above the 8h-idle wardline-pressure cap
 * (`campaign-state.js`'s `wardlinePressure`, saturates at 8) when they need the SETTLED
 * path rather than ENCROACHED — see `campaign-state-rpg.test.mjs`'s dedicated ENCROACHED
 * coverage for that gate's own tests.
 */
function campaignWithCompletedStages(count = 1) {
  let campaign = createCampaign({ campaignId: `idle-${count}` });
  for (const stage of STAGES.slice(0, count)) {
    campaign = startRun(campaign, stage.id);
    campaign = applyCampaignRunResult(campaign, { stageId: stage.id, outcome: "victory" });
  }
  return campaign;
}

test("idle settlement caps elapsed time, awards only completed-stage progress, and leaves an active run unchanged", () => {
  // 9 completed stages -> wardLevel 9 (no companions captured on a plain "victory" outcome),
  // comfortably above the wardline-pressure cap of 8 so this exercises the SETTLED path this
  // test has always covered, not the newer ENCROACHED gate (233a9d0) which has its own tests.
  const campaign = campaignWithCompletedStages(9);
  assert.equal(wardLevel(campaign), 9);
  const activeRun = createDefenseRun({ stageId: "cinder-span", seed: 41 });
  const activeRunSnapshot = getRunSnapshot(activeRun);
  const campaignBeforeSettlement = serializeCampaign(campaign);
  const anchored = settleIdleReturn(campaign, { now: 10_000 });
  const settled = settleIdleReturn(anchored.campaign, {
    now: 10_000 + IDLE_RETURN_MAX_ELAPSED_MS + (3 * IDLE_RETURN_INTERVAL_MS),
  });

  assert.deepEqual(settled.receipt, {
    outcome: "SETTLED",
    requestedAt: 10_000 + IDLE_RETURN_MAX_ELAPSED_MS + (3 * IDLE_RETURN_INTERVAL_MS),
    elapsedMs: IDLE_RETURN_MAX_ELAPSED_MS + (3 * IDLE_RETURN_INTERVAL_MS),
    settledElapsedMs: IDLE_RETURN_MAX_ELAPSED_MS,
    completedStages: 9,
    awardedProgress: 9 * (IDLE_RETURN_MAX_ELAPSED_MS / IDLE_RETURN_INTERVAL_MS),
    settledAt: 10_000 + IDLE_RETURN_MAX_ELAPSED_MS + (3 * IDLE_RETURN_INTERVAL_MS),
  });
  assert.deepEqual(serializeCampaign(campaign), campaignBeforeSettlement, "settlement must not mutate its campaign input");
  assert.deepEqual(getRunSnapshot(activeRun), activeRunSnapshot, "idle settlement must not mutate an active deterministic run");
});

test("idle settlement grants a settled interval once and rejects early or repeated claims without an award", () => {
  const anchored = settleIdleReturn(campaignWithCompletedStages(), { now: 25_000 });
  const claimedAt = 25_000 + (3 * IDLE_RETURN_INTERVAL_MS);
  const settled = settleIdleReturn(anchored.campaign, { now: claimedAt });
  const repeated = settleIdleReturn(settled.campaign, { now: claimedAt });
  const early = settleIdleReturn(settled.campaign, { now: claimedAt + IDLE_RETURN_INTERVAL_MS - 1 });

  assert.equal(settled.receipt.outcome, "SETTLED");
  assert.equal(settled.receipt.awardedProgress, 3);
  assert.deepEqual(repeated.receipt, {
    outcome: "EARLY",
    requestedAt: claimedAt,
    elapsedMs: 0,
    settledElapsedMs: 0,
    completedStages: 0,
    awardedProgress: 0,
    settledAt: null,
  });
  assert.equal(early.receipt.outcome, "EARLY");
  assert.equal(early.receipt.elapsedMs, IDLE_RETURN_INTERVAL_MS - 1);
  assert.equal(early.receipt.awardedProgress, 0);
  assert.deepEqual(serializeCampaign(repeated.campaign), serializeCampaign(settled.campaign));
  assert.deepEqual(serializeCampaign(early.campaign), serializeCampaign(settled.campaign));
});

test("storage settles once, persists the settled campaign, and preserves it across early or repeated claims", async () => {
  const storage = new DefenseStorage({ indexedDB: null, localStorage: memoryStorage(), crypto: null });
  await storage.save(campaignWithCompletedStages());

  const initialized = await storage.settleIdleReturn({ now: 50_000 });
  const settledAt = 50_000 + (2 * IDLE_RETURN_INTERVAL_MS);
  const settled = await storage.settleIdleReturn({ now: settledAt });
  const persistedText = await storage.exportText();
  const repeated = await storage.settleIdleReturn({ now: settledAt });
  const early = await storage.settleIdleReturn({ now: settledAt + IDLE_RETURN_INTERVAL_MS - 1 });

  assert.equal(initialized.receipt.outcome, "INITIALIZED");
  assert.equal(settled.receipt.outcome, "SETTLED");
  assert.equal(settled.receipt.awardedProgress, 2);
  assert.deepEqual(await storage.load(), settled.campaign, "a settled campaign must round-trip through its public storage adapter");
  assert.equal(repeated.receipt.outcome, "EARLY");
  assert.equal(repeated.receipt.awardedProgress, 0);
  assert.equal(early.receipt.outcome, "EARLY");
  assert.equal(early.receipt.awardedProgress, 0);
  assert.equal(await storage.exportText(), persistedText, "non-award receipts must not overwrite the persisted settlement");
});

test("malformed persisted idle data is rejected without an award or storage replacement", async () => {
  const key = "malformed-idle";
  const localStorage = memoryStorage([[key, "{not-json"]]);
  const storage = new DefenseStorage({ key, indexedDB: null, localStorage, crypto: null });

  const settlement = await storage.settleIdleReturn({ now: 90_000 });

  assert.deepEqual(settlement, {
    campaign: null,
    receipt: {
      outcome: "NO_CAMPAIGN",
      requestedAt: 90_000,
      elapsedMs: 0,
      settledElapsedMs: 0,
      completedStages: 0,
      awardedProgress: 0,
      settledAt: null,
    },
  });
  assert.equal(localStorage.getItem(key), "{not-json", "invalid input must not replace the existing stored value");
  assert.equal(await storage.importText("{also-not-json"), false);
  assert.equal(localStorage.getItem(key), "{not-json", "a rejected import must not replace the malformed stored value");
});
