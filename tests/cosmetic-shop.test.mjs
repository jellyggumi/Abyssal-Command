import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// Helper to mock the browser environment and load profile-store.js
async function loadProfileStore({ initialProfile = null, initialProfileJson = null, lockDelayMs = 0 } = {}) {
  const source = await readFile(new URL("../profile-store.js", import.meta.url), "utf8");

  // LocalStorage Mock
  class LocalStorageMock {
    constructor() {
      this.store = {};
    }
    clear() {
      this.store = {};
    }
    getItem(key) {
      return this.store[key] || null;
    }
    setItem(key, value) {
      this.store[key] = String(value);
    }
    removeItem(key) {
      delete this.store[key];
    }
  }

  const localStorage = new LocalStorageMock();
  if (initialProfileJson !== null) {
    localStorage.setItem("abyssal-surge-profile-v1", initialProfileJson);
  } else if (initialProfile) {
    localStorage.setItem("abyssal-surge-profile-v1", JSON.stringify(initialProfile));
  }
  const lockStats = { active: 0, maxActive: 0, requests: [] };
  let lockQueue = Promise.resolve();
  const navigatorMock = {
    locks: {
      request(name, mutation) {
        lockStats.requests.push(name);
        const result = lockQueue.then(async () => {
          lockStats.active += 1;
          lockStats.maxActive = Math.max(lockStats.maxActive, lockStats.active);
          try {
            if (lockDelayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, lockDelayMs));
            }
            return await mutation();
          } finally {
            lockStats.active -= 1;
          }
        });
        lockQueue = result.catch(() => {});
        return result;
      }
    }
  };

  // Document Mock
  const dataset = {};
  const documentMock = {
    documentElement: {
      dataset: dataset,
      style: {}
    }
  };

  // Event Target Mock for window
  const eventListeners = {};
  const windowMock = {
    ...(lockDelayMs > 0 ? { navigator: navigatorMock } : {}),
    addEventListener(type, listener) {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(listener);
    },
    removeEventListener(type, listener) {
      if (!eventListeners[type]) return;
      eventListeners[type] = eventListeners[type].filter(l => l !== listener);
    },
    dispatchEvent(event) {
      const listeners = eventListeners[event.type];
      if (listeners) {
        listeners.forEach(l => {
          try {
            l(event);
          } catch (e) {
            console.error(e);
          }
        });
      }
      return true;
    }
  };

  class CustomEventMock {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail || null;
    }
  }

  const context = vm.createContext({
    window: windowMock,
    document: documentMock,
    localStorage,
    navigator: lockDelayMs > 0 ? navigatorMock : undefined,
    CustomEvent: CustomEventMock,
    console,
    setTimeout
  });

  // Expose context globals to globalThis in the context for IIFE compatibility
  vm.runInContext(`
    globalThis.window = window;
    globalThis.document = document;
    globalThis.localStorage = localStorage;
    globalThis.CustomEvent = CustomEvent;
    globalThis.navigator = navigator;
  `, context);

  vm.runInContext(source, context, { filename: "profile-store.js" });

  return {
    AbyssalProfile: context.window.AbyssalProfile,
    localStorage: context.localStorage,
    document: context.document,
    window: context.window,
    lockStats
  };
}

test("AbyssalProfile - Fresh profile starts with 300 stipend", async () => {
  const { AbyssalProfile } = await loadProfileStore();
  const snapshot = AbyssalProfile.getSnapshot();
  
  assert.equal(snapshot.balance, 300, "Fresh profile should start with 300 balance");
  assert.deepEqual(Array.from(snapshot.ownedItems), ["iron"], "Fresh profile should only own 'iron' theme");
  assert.equal(snapshot.equippedTheme, "iron", "Fresh profile should equip 'iron' theme by default");
  assert.equal(snapshot.hasReceivedStipend, true, "Fresh profile has received stipend flag set");
});

test("React cosmetic shop mounts at its shell root and exposes only the persisted theme catalog", async () => {
  const [reactUi, reactShop, { AbyssalProfile, localStorage }] = await Promise.all([
    readFile(new URL("../react-game-ui.js", import.meta.url), "utf8"),
    readFile(new URL("../react-shop.js", import.meta.url), "utf8"),
    loadProfileStore(),
  ]);
  const catalog = Object.values(AbyssalProfile.CATALOG).map(({ id, price, type, art }) => ({ id, price, type, art }));

  assert.match(reactUi, /id:\s*["']shop-root["']/, "the React shell must expose the cosmetic shop mount root");
  assert.match(reactShop, /document\.getElementById\(["']shop-root["']\)/, "the cosmetic shop must resolve its dedicated root");
  assert.match(reactShop, /Object\.values\(window\.AbyssalProfile\.CATALOG\)/, "the rendered catalog must come from the profile store");
  assert.match(reactShop, /ReactDOM\.createRoot\(container\)[\s\S]*?root\.render\(React\.createElement\(ShopApp\)\)/, "the shop must mount its React catalog");
  assert.deepEqual(catalog, [
    { id: "iron", price: 0, type: "theme", art: "assets/images/ui/reward-anchor-shard.png" },
    { id: "cinder", price: 250, type: "theme", art: "assets/images/ui/reward-ember-cohort.png" },
    { id: "veil", price: 425, type: "theme", art: "assets/images/ui/reward-veil-vanguard.png" },
    { id: "sovereign", price: 650, type: "theme", art: "assets/images/ui/reward-dawnless-crown.png" },
  ], "the shop catalog must remain cosmetic-only and stable");

  localStorage.setItem("abyssal-surge-campaign-v4", "campaign-sentinel");
  AbyssalProfile.purchase("cinder");
  assert.ok(localStorage.getItem("abyssal-surge-profile-v1"), "shop purchases must persist to the profile key");
  assert.equal(localStorage.getItem("abyssal-surge-campaign-v4"), "campaign-sentinel", "shop persistence must not mutate campaign storage");
});

test("AbyssalProfile - First 250 purchase leaves 50 and can equip", async () => {
  const { AbyssalProfile, document } = await loadProfileStore();
  
  // Purchase cinder theme (cost 250)
  const result = AbyssalProfile.purchase("cinder");
  assert.equal(result, true, "Purchase should succeed");
  
  let snapshot = AbyssalProfile.getSnapshot();
  assert.equal(snapshot.balance, 50, "Balance should be 50 after purchasing 250 item");
  assert.ok(Array.from(snapshot.ownedItems).includes("cinder"), "Owned items should now include cinder");
  
  // Equip cinder theme
  const equipResult = AbyssalProfile.equip("cinder");
  assert.equal(equipResult, true, "Equip should succeed");
  
  snapshot = AbyssalProfile.getSnapshot();
  assert.equal(snapshot.equippedTheme, "cinder", "Equipped theme should be cinder");
  assert.equal(document.documentElement.dataset.uiTheme, "cinder", "dataset.uiTheme should be updated to cinder");
});

test("AbyssalProfile - Insufficient funds are rejected without mutation", async () => {
  const { AbyssalProfile } = await loadProfileStore();
  
  // Try to purchase sovereign theme (cost 650, balance 300)
  assert.throws(() => {
    AbyssalProfile.purchase("sovereign");
  }, /Insufficient balance/, "Should throw Insufficient balance error");
  
  const snapshot = AbyssalProfile.getSnapshot();
  assert.equal(snapshot.balance, 300, "Balance should remain unchanged");
  assert.deepEqual(Array.from(snapshot.ownedItems), ["iron"], "Owned items should remain unchanged");
});

test("AbyssalProfile - Reload restores ownership and theme", async () => {
  const { AbyssalProfile, localStorage } = await loadProfileStore();
  
  // Purchase and equip cinder theme
  AbyssalProfile.purchase("cinder");
  AbyssalProfile.equip("cinder");
  
  // Retrieve serialized JSON from localStorage to verify persistence
  const savedData = localStorage.getItem("abyssal-surge-profile-v1");
  assert.ok(savedData, "Profile data should be saved in localStorage");
  
  // Mock reloading: create a new load context but keep localStorage
  const source = await readFile(new URL("../profile-store.js", import.meta.url), "utf8");
  const context = vm.createContext({
    window: {
      addEventListener() {},
      dispatchEvent() {}
    },
    document: {
      documentElement: { dataset: {} }
    },
    localStorage: localStorage,
    CustomEvent: class {},
    console: console
  });
  
  vm.runInContext(`
    globalThis.window = window;
    globalThis.document = document;
    globalThis.localStorage = localStorage;
  `, context);
  
  vm.runInContext(source, context, { filename: "profile-store.js" });
  
  const reloadedProfile = context.window.AbyssalProfile;
  const snapshot = reloadedProfile.getSnapshot();
  
  assert.equal(snapshot.balance, 50, "Balance should be restored to 50");
  assert.ok(Array.from(snapshot.ownedItems).includes("cinder"), "Owned items should still include cinder");
  assert.equal(snapshot.equippedTheme, "cinder", "Equipped theme should still be cinder");
  assert.equal(context.document.documentElement.dataset.uiTheme, "cinder", "Theme should be applied to document element on load");
});

test("AbyssalProfile - Corrupt storage falls back safely", async () => {
  const { localStorage } = await loadProfileStore();
  
  // Inject corrupt data
  localStorage.setItem("abyssal-surge-profile-v1", "{corrupted_json:[}");
  
  // Load profile store with corrupt data
  const source = await readFile(new URL("../profile-store.js", import.meta.url), "utf8");
  const context = vm.createContext({
    window: {
      addEventListener() {},
      dispatchEvent() {}
    },
    document: {
      documentElement: { dataset: {} }
    },
    localStorage: localStorage,
    CustomEvent: class {},
    console: console
  });
  
  vm.runInContext(`
    globalThis.window = window;
    globalThis.document = document;
    globalThis.localStorage = localStorage;
  `, context);
  
  vm.runInContext(source, context, { filename: "profile-store.js" });
  
  const reloadedProfile = context.window.AbyssalProfile;
  const snapshot = reloadedProfile.getSnapshot();
  
  assert.equal(snapshot.balance, 300, "Should fall back to default profile with 300 stipend");
  assert.deepEqual(Array.from(snapshot.ownedItems), ["iron"], "Should fall back to owning iron theme");
  assert.equal(snapshot.equippedTheme, "iron", "Should fall back to equipping iron theme");
});

test("AbyssalProfile - Campaign sync awards all ten stage milestones and completion exactly once", async () => {
  const { AbyssalProfile, localStorage } = await loadProfileStore();
  const stageMilestones = Array.from({ length: 10 }, (_, index) => `stage-${index}`);

  AbyssalProfile.syncCampaign({ stageIndex: 0, status: "active" });
  assert.equal(AbyssalProfile.getSnapshot().balance, 300, "active Stage 1 must not award a clear milestone");

  for (let stageIndex = 0; stageIndex < 10; stageIndex += 1) {
    const campaign = { stageIndex, status: "reward" };
    AbyssalProfile.syncCampaign(campaign);
    const awarded = AbyssalProfile.getSnapshot();
    assert.equal(awarded.balance, 300 + (stageIndex + 1) * 125, `clearing Stage ${stageIndex + 1} must award 125 marks`);
    assert.deepEqual(Array.from(awarded.rewardedMilestones), stageMilestones.slice(0, stageIndex + 1), `Stage ${stageIndex + 1} must record every cleared stage once`);

    AbyssalProfile.syncCampaign(campaign);
    const repeated = AbyssalProfile.getSnapshot();
    assert.equal(repeated.balance, awarded.balance, `repeating Stage ${stageIndex + 1} sync must be idempotent`);
    assert.deepEqual(Array.from(repeated.rewardedMilestones), Array.from(awarded.rewardedMilestones), `repeating Stage ${stageIndex + 1} sync must not duplicate milestones`);
  }

  const completion = { stageIndex: 9, status: "campaign-complete" };
  AbyssalProfile.syncCampaign(completion);
  const completed = AbyssalProfile.getSnapshot();
  assert.equal(completed.balance, 1800, "ten stage awards plus the completion award must total 1,800 marks");
  assert.deepEqual(Array.from(completed.rewardedMilestones), [...stageMilestones, "campaign-complete"], "completion must preserve all ten stage milestones and add one completion milestone");

  const persisted = JSON.parse(localStorage.getItem("abyssal-surge-profile-v1"));
  assert.equal(persisted.balance, 1800, "the complete milestone ledger must persist");
  assert.deepEqual(Array.from(persisted.rewardedMilestones), [...stageMilestones, "campaign-complete"], "all milestone IDs must persist");

  AbyssalProfile.syncCampaign(completion);
  const repeatedCompletion = AbyssalProfile.getSnapshot();
  assert.equal(repeatedCompletion.balance, 1800, "repeating campaign completion must not award marks again");
  assert.deepEqual(Array.from(repeatedCompletion.rewardedMilestones), [...stageMilestones, "campaign-complete"], "repeating completion must not duplicate any milestone");
});

test("AbyssalProfile - Web Locks preserve concurrent delayed purchases and the latest balance", async () => {
  const initialProfile = {
    balance: 1000,
    ownedItems: ["iron"],
    equippedTheme: "iron",
    rewardedMilestones: [],
    hasReceivedStipend: true
  };
  const { AbyssalProfile, localStorage, lockStats } = await loadProfileStore({
    initialProfile,
    lockDelayMs: 5
  });

  await Promise.all([
    AbyssalProfile.purchase("cinder"),
    AbyssalProfile.purchase("veil")
  ]);

  const snapshot = AbyssalProfile.getSnapshot();
  const persisted = JSON.parse(localStorage.getItem("abyssal-surge-profile-v1"));
  assert.deepEqual(lockStats.requests, [
    "abyssal-surge-profile-lock",
    "abyssal-surge-profile-lock"
  ], "each browser mutation must enter the shared profile Web Lock");
  assert.equal(lockStats.maxActive, 1, "delayed profile mutations must never overlap inside the lock");
  assert.deepEqual(
    Array.from(snapshot.ownedItems).sort(),
    ["cinder", "iron", "veil"],
    "both purchases must survive serialization"
  );
  assert.equal(snapshot.balance, 325, "the live snapshot must expose the balance after both purchases");
  assert.deepEqual(
    Array.from(persisted.ownedItems).sort(),
    ["cinder", "iron", "veil"],
    "the latest persisted profile must retain both purchases"
  );
  assert.equal(persisted.balance, 325, "the latest persisted balance must include both deductions");
});

test("AbyssalProfile - non-finite balances are rejected and the recovered profile remains JSON-stable", async () => {
  const invalidJson = '{"balance":1e400,"ownedItems":["iron","cinder"],"equippedTheme":"cinder","rewardedMilestones":[],"hasReceivedStipend":true}';
  const { AbyssalProfile, localStorage } = await loadProfileStore({ initialProfileJson: invalidJson });
  const recovered = AbyssalProfile.getSnapshot();

  assert.equal(Number.isFinite(recovered.balance), true, "a parsed Infinity balance must never enter the live profile");
  assert.equal(recovered.balance, 300, "a profile with a non-finite balance must recover from the safe stipend default");
  assert.deepEqual(Array.from(recovered.ownedItems), ["iron"], "rejection must not retain ownership from an invalid profile");

  AbyssalProfile.purchase("cinder");
  const persistedJson = localStorage.getItem("abyssal-surge-profile-v1");
  const persisted = JSON.parse(persistedJson);
  assert.equal(Number.isFinite(persisted.balance), true, "the recovered profile must persist a finite JSON balance");
  assert.equal(persisted.balance, 50, "the recovered profile must remain usable after rejection");

  const { AbyssalProfile: reloadedProfile } = await loadProfileStore({ initialProfileJson: persistedJson });
  const reloaded = reloadedProfile.getSnapshot();
  assert.deepEqual(
    {
      balance: reloaded.balance,
      ownedItems: Array.from(reloaded.ownedItems),
      equippedTheme: reloaded.equippedTheme,
      rewardedMilestones: Array.from(reloaded.rewardedMilestones),
      hasReceivedStipend: reloaded.hasReceivedStipend
    },
    persisted,
    "a sanitized persisted profile must survive a JSON parse/stringify reload without drift"
  );
});

test("AbyssalProfile - resetForTests() functions correctly", async () => {
  const { AbyssalProfile } = await loadProfileStore();
  
  AbyssalProfile.purchase("cinder");
  AbyssalProfile.equip("cinder");
  
  AbyssalProfile.resetForTests();
  const snapshot = AbyssalProfile.getSnapshot();
  
  assert.equal(snapshot.balance, 300, "Balance should be reset to 300");
  assert.deepEqual(Array.from(snapshot.ownedItems), ["iron"], "Owned items should be reset to iron only");
  assert.equal(snapshot.equippedTheme, "iron", "Equipped theme should be reset to iron");
});
