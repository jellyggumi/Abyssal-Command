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
} from "../campaign-state.js";
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

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
function request(value) {
  return { result: value, error: null, onsuccess: null, onerror: null };
}

function sharedIndexedDb() {
  const records = new Map();
  const errors = [];
  const readonlyWaiters = [];
  const writeTransactions = [];
  let storeExists = false;
  let readonlyGate = null;
  let writing = false;

  const finishRequest = (event) => queueMicrotask(() => event.request.onsuccess?.());

  const finishTransaction = (transaction) => {
    if (transaction.write) records.set(transaction.write.key, transaction.write.value);
    transaction.complete = true;
    transaction.oncomplete?.();
    writing = false;
    drainWrites();
  };

  const enqueueWrite = (transaction) => {
    if (transaction.queued) return;
    transaction.queued = true;
    writeTransactions.push(transaction);
    drainWrites();
  };

  const drainWrites = () => {
    if (writing) return;
    const transaction = writeTransactions.shift();
    if (!transaction) return;
    writing = true;
    queueMicrotask(() => {
      const event = transaction.getEvent;
      if (!event) {
        finishTransaction(transaction);
        return;
      }
      event.request.result = records.get(event.key);
      event.request.onsuccess?.();
      queueMicrotask(() => finishTransaction(transaction));
    });
  };

  const database = {
    errors,
    objectStoreNames: {
      contains: () => storeExists,
    },
    createObjectStore() {
      storeExists = true;
    },
    transaction(_storeName, mode) {
      const transaction = {
        complete: false,
        error: null,
        onabort: null,
        oncomplete: null,
        onerror: null,
        queued: false,
        write: null,
      };
      const store = {
        get(key) {
          const event = { key, request: request(records.get(key)) };
          if (mode === "readonly") {
            if (!readonlyGate) {
              finishRequest(event);
            } else {
              readonlyGate.values.push(event.request.result);
              readonlyGate.remaining -= 1;
              readonlyWaiters.push(event);
              if (readonlyGate.remaining === 0) readonlyGate.entered.resolve();
            }
          } else {
            transaction.getEvent = event;
            enqueueWrite(transaction);
          }
          return event.request;
        },
        put(value, key) {
          transaction.write = { key, value };
          if (mode === "readwrite") enqueueWrite(transaction);
        },
      };
      transaction.objectStore = () => store;
      return transaction;
    },
  };

  return {
    errors,
    indexedDB: {
      open() {
        const openRequest = request(database);
        queueMicrotask(() => {
          if (!storeExists) openRequest.onupgradeneeded?.();
          openRequest.onsuccess?.();
        });
        return openRequest;
      },
    },
    holdReadonlyGets(count) {
      readonlyGate = {
        entered: deferred(),
        remaining: count,
        values: [],
      };
      return {
        entered: readonlyGate.entered.promise,
        release() {
          const events = readonlyWaiters.splice(0);
          readonlyGate = null;
          for (const event of events) finishRequest(event);
        },
        values: readonlyGate.values,
      };
    },
    pendingWriteTransactions: () => writeTransactions.length + Number(writing),
  };
}

async function withoutWebLocks(operation) {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
    writable: true,
  });
  try {
    return await operation();
  } finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  }
}

function completesWithin(promise, timeoutMs = 1_000) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`settlement did not complete within ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function campaignWithCompletedStages(count = 1) {
  let campaign = createCampaign({ campaignId: `idle-${count}` });
  const stageOrder = ["cinder-span", "veil-citadel", "echo-throne", "sunken-bastion", "howling-sprawl", "glass-necropolis", "starless-canal", "shattered-causeway"];
  for (const stageId of stageOrder.slice(0, count)) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  return campaign;
}

test("idle settlement caps elapsed time, awards only completed-stage progress, and leaves an active run unchanged", () => {
  const campaign = campaignWithCompletedStages(8); // wardLevel=8 clears the 8h-elapsed-cap pressure=8 wardline gate (balance-sheet.md undertow-encroachment); this test's actual subject is elapsed-time capping/award-scaling/immutability, not wardline
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
    completedStages: 8,
    awardedProgress: 8 * (IDLE_RETURN_MAX_ELAPSED_MS / IDLE_RETURN_INTERVAL_MS),
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

test("concurrent storage instances settle a due persisted campaign exactly once", async () => {
  const firstDecodeEntered = deferred();
  const secondDecodeEntered = deferred();
  const releaseDecodes = deferred();
  let gateArmed = false;
  let gatedDigests = 0;
  let holdSecondDecode = true;
  const crypto = {
    subtle: {
      async digest() {
        if (!gateArmed) return new Uint8Array([0]).buffer;
        gatedDigests += 1;
        if (gatedDigests === 1) {
          firstDecodeEntered.resolve();
          await releaseDecodes.promise;
        } else if (gatedDigests === 2) {
          secondDecodeEntered.resolve();
          if (holdSecondDecode) await releaseDecodes.promise;
        }
        return new Uint8Array([0]).buffer;
      },
    },
  };
  const localStorage = memoryStorage();
  const firstStorage = new DefenseStorage({ indexedDB: null, localStorage, crypto });
  const secondStorage = new DefenseStorage({ indexedDB: null, localStorage, crypto });
  const anchoredAt = 120_000;
  const awardedProgress = 2;
  const anchored = settleIdleReturn(campaignWithCompletedStages(), { now: anchoredAt }).campaign;
  await firstStorage.save(anchored);
  gateArmed = true;

  const dueAt = anchoredAt + (awardedProgress * IDLE_RETURN_INTERVAL_MS);
  let firstFinished = false;
  const firstSettlement = firstStorage.settleIdleReturn({ now: dueAt }).finally(() => {
    firstFinished = true;
  });
  await firstDecodeEntered.promise;
  const secondSettlement = secondStorage.settleIdleReturn({ now: dueAt });
  assert.equal(firstFinished, false, "the second call must begin while the first is pending");
  const secondDecodeRanBeforeRelease = await Promise.race([
    secondDecodeEntered.promise.then(() => true),
    new Promise((resolve) => setImmediate(() => resolve(false))),
  ]);
  holdSecondDecode = false;
  releaseDecodes.resolve();
  const settlements = await Promise.all([firstSettlement, secondSettlement]);
  const receipts = settlements.map(({ receipt }) => receipt);
  const settledReceipts = receipts.filter(({ outcome }) => outcome === "SETTLED");
  const persisted = await firstStorage.load();

  assert.equal(secondDecodeRanBeforeRelease, false, "a second storage instance must not load the due campaign before the first settlement persists");
  assert.equal(settledReceipts.length, 1, "overlapping calls must produce one settlement receipt");
  assert.equal(settledReceipts[0].awardedProgress, awardedProgress);
  assert.equal(receipts.filter(({ outcome }) => outcome === "EARLY").length, 1);
  assert.equal(persisted.idleReturn.totalProgress, awardedProgress, "the canonical persisted campaign must not double-award progress");
  assert.equal(persisted.idleReturn.lastSettledAt, dueAt);
  assert.deepEqual(persisted, settlements.find(({ receipt }) => receipt.outcome === "SETTLED").campaign);
});
test("independent IndexedDB storage realms compare-and-set one overlapping idle settlement without Web Locks", async () => {
  await withoutWebLocks(async () => {
    const sharedDatabase = sharedIndexedDb();
    const [{ DefenseStorage: FirstRealmStorage }, { DefenseStorage: SecondRealmStorage }] = await Promise.all([
      import(new URL("../defense-storage.js?indexeddb-idle-race-first", import.meta.url)),
      import(new URL("../defense-storage.js?indexeddb-idle-race-second", import.meta.url)),
    ]);
    const firstStorage = new FirstRealmStorage({ indexedDB: sharedDatabase.indexedDB, localStorage: null, crypto: null });
    const secondStorage = new SecondRealmStorage({ indexedDB: sharedDatabase.indexedDB, localStorage: null, crypto: null });
    const anchoredAt = 180_000;
    const awardedProgress = 2;
    const anchored = settleIdleReturn(campaignWithCompletedStages(), { now: anchoredAt }).campaign;

    await firstStorage.save(anchored);
    const preSettlementEnvelope = await firstStorage.exportText();
    const readonlyGets = sharedDatabase.holdReadonlyGets(2);
    const dueAt = anchoredAt + (awardedProgress * IDLE_RETURN_INTERVAL_MS);
    const firstSettlement = firstStorage.settleIdleReturn({ now: dueAt });
    const secondSettlement = secondStorage.settleIdleReturn({ now: dueAt });

    await readonlyGets.entered;
    assert.deepEqual(
      readonlyGets.values,
      [preSettlementEnvelope, preSettlementEnvelope],
      "both storage realms must read the same due envelope before either compare-and-set transaction commits",
    );
    readonlyGets.release();

    const settlements = await completesWithin(Promise.all([firstSettlement, secondSettlement]));
    const receipts = settlements.map(({ receipt }) => receipt);
    const settledReceipts = receipts.filter(({ outcome }) => outcome === "SETTLED");
    const earlyReceipts = receipts.filter(({ outcome }) => outcome === "EARLY");
    const persisted = await firstStorage.load();

    assert.equal(settledReceipts.length, 1, "only one compare-and-set transaction may award the due interval");
    assert.equal(settledReceipts[0].awardedProgress, awardedProgress);
    assert.equal(earlyReceipts.length, 1, "the compare-and-set loser must re-read the canonical campaign and return EARLY");
    assert.equal(earlyReceipts[0].awardedProgress, 0);
    assert.equal(persisted.idleReturn.totalProgress, awardedProgress, "the shared IndexedDB record must contain one canonical increment");
    assert.equal(persisted.idleReturn.lastSettledAt, dueAt);
    assert.equal(sharedDatabase.pendingWriteTransactions(), 0, "all IndexedDB transactions must complete");
    assert.deepEqual(sharedDatabase.errors, [], "the overlapping settlement must not raise a transaction error");
  });
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
