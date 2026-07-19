(function () {
  const VERSION = "1.0.0";
  const STORAGE_KEY = "abyssal-surge-profile-v1";

  const CATALOG = Object.freeze({
    "iron": Object.freeze({
      id: "iron",
      nameEn: "Iron Theme",
      nameKo: "철의 테마",
      descEn: "Standard iron interface theme.",
      descKo: "기본 철의 인터페이스 테마.",
      price: 0,
      art: "assets/images/ui/reward-anchor-shard.png",
      type: "theme"
    }),
    "cinder": Object.freeze({
      id: "cinder",
      nameEn: "Cinder Theme",
      nameKo: "잿더미 테마",
      descEn: "Smoldering red highlights of the ember cohort.",
      descKo: "잿더미 코호트의 그을린 붉은색 테마.",
      price: 250,
      art: "assets/images/ui/reward-ember-cohort.png",
      type: "theme"
    }),
    "veil": Object.freeze({
      id: "veil",
      nameEn: "Veil Theme",
      nameKo: "장막 테마",
      descEn: "Deep blue and purple shadows of the veil vanguard.",
      descKo: "장막 선봉대의 깊은 청색 및 보라색 그림자 테마.",
      price: 425,
      art: "assets/images/ui/reward-veil-vanguard.png",
      type: "theme"
    }),
    "sovereign": Object.freeze({
      id: "sovereign",
      nameEn: "Sovereign Theme",
      nameKo: "군주 테마",
      descEn: "Ornate gold and crimson of the dawnless crown.",
      descKo: "여명 없는 왕관의 화려한 황금색 및 진홍색 테마.",
      price: 650,
      art: "assets/images/ui/reward-dawnless-crown.png",
      type: "theme"
    })
  });

  let currentProfile = null;
  const listeners = new Set();
  let memoryFallback = null;

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener();
      } catch (e) {
        console.error("Listener error:", e);
      }
    }
  }

  function getSnapshot() {
    return currentProfile;
  }

  function applyTheme(themeId) {
    try {
      document.documentElement.dataset.uiTheme = themeId || "iron";
    } catch (e) {
      console.error("Failed to apply theme to documentElement:", e);
    }
  }

  function createDefaultProfile() {
    return {
      balance: 300,
      ownedItems: ["iron"],
      equippedTheme: "iron",
      rewardedMilestones: [],
      hasReceivedStipend: true
    };
  }

  function validateProfile(data) {
    return (
      data &&
      typeof data === "object" &&
      typeof data.balance === "number" &&
      Number.isFinite(data.balance) &&
      data.balance >= 0 &&
      Array.isArray(data.ownedItems) &&
      typeof data.equippedTheme === "string" &&
      Array.isArray(data.rewardedMilestones)
    );
  }

  function sanitizeProfile(data) {
    const rawBalance = Number(data.balance);
    const balance = Number.isFinite(rawBalance) ? Math.max(0, Math.floor(rawBalance || 0)) : 0;
    const ownedItems = Array.from(new Set(data.ownedItems)).filter(
      id => typeof id === "string" && CATALOG[id]
    );
    if (!ownedItems.includes("iron")) {
      ownedItems.unshift("iron");
    }
    let equippedTheme = typeof data.equippedTheme === "string" && CATALOG[data.equippedTheme] ? data.equippedTheme : "iron";
    if (!ownedItems.includes(equippedTheme)) {
      equippedTheme = "iron";
    }
    const rewardedMilestones = Array.from(new Set(data.rewardedMilestones)).filter(
      m => typeof m === "string"
    );
    
    return {
      balance,
      ownedItems,
      equippedTheme,
      rewardedMilestones,
      hasReceivedStipend: !!data.hasReceivedStipend
    };
  }

  let mutationQueue = Promise.resolve();

  function enqueueMutation(fn) {
    if (typeof navigator !== "undefined" && navigator.locks && typeof navigator.locks.request === "function") {
      return navigator.locks.request("abyssal-surge-profile-lock", fn);
    } else {
      const nextPromise = mutationQueue.then(async () => {
        return fn();
      });
      mutationQueue = nextPromise.catch(() => {});
      return nextPromise;
    }
  }

  function loadProfile() {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (json) {
        const data = JSON.parse(json);
        if (validateProfile(data)) {
          const profile = sanitizeProfile(data);
          memoryFallback = profile;
          return profile;
        }
      }
    } catch (e) {
      console.error("Failed to load profile, using fallback:", e);
    }
    if (memoryFallback) {
      return sanitizeProfile(memoryFallback);
    }
    return createDefaultProfile();
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error("Failed to save profile to localStorage, using memory:", e);
    }
    memoryFallback = profile;
  }

  function purchase(id) {
    const runMutation = () => {
      const reloaded = loadProfile();
      currentProfile = Object.freeze(reloaded);

      const item = CATALOG[id];
      if (!item) {
        throw new Error("Item not found in catalog");
      }
      
      const nextProfile = {
        ...currentProfile,
        ownedItems: [...currentProfile.ownedItems],
        rewardedMilestones: [...currentProfile.rewardedMilestones]
      };
      
      if (nextProfile.ownedItems.includes(id)) {
        return true;
      }
      
      if (nextProfile.balance < item.price) {
        throw new Error("Insufficient balance");
      }
      
      nextProfile.balance -= item.price;
      nextProfile.ownedItems.push(id);
      
      currentProfile = Object.freeze(sanitizeProfile(nextProfile));
      saveProfile(currentProfile);
      applyTheme(currentProfile.equippedTheme);
      window.dispatchEvent(new CustomEvent("abyssal:profile-changed", { detail: currentProfile }));
      notify();
      return true;
    };

    if (typeof window === "undefined" || !window.navigator || typeof process !== "undefined") {
      return runMutation();
    }
    return enqueueMutation(runMutation);
  }

  function equip(id) {
    const runMutation = () => {
      const reloaded = loadProfile();
      currentProfile = Object.freeze(reloaded);

      const item = CATALOG[id];
      if (!item) {
        throw new Error("Item not found in catalog");
      }
      
      if (!currentProfile.ownedItems.includes(id)) {
        throw new Error("Item not owned");
      }
      
      const nextProfile = {
        ...currentProfile,
        ownedItems: [...currentProfile.ownedItems],
        rewardedMilestones: [...currentProfile.rewardedMilestones],
        equippedTheme: id
      };
      
      currentProfile = Object.freeze(sanitizeProfile(nextProfile));
      saveProfile(currentProfile);
      applyTheme(currentProfile.equippedTheme);
      window.dispatchEvent(new CustomEvent("abyssal:profile-changed", { detail: currentProfile }));
      notify();
      return true;
    };

    if (typeof window === "undefined" || !window.navigator || typeof process !== "undefined") {
      return runMutation();
    }
    return enqueueMutation(runMutation);
  }

  function syncCampaign(campaign) {
    const runMutation = () => {
      if (!campaign || typeof campaign !== "object") return;
      
      const reloaded = loadProfile();
      currentProfile = Object.freeze(reloaded);

      const stageIndex = typeof campaign.stageIndex === "number" ? campaign.stageIndex : 0;
      const status = typeof campaign.status === "string" ? campaign.status : "";
      
      const milestonesCleared = [];
      for (let index = 0; index < 10; index += 1) {
        const stageCleared =
          status === "campaign-complete" ||
          stageIndex > index ||
          (stageIndex === index && status === "reward");
        if (stageCleared) milestonesCleared.push(`stage-${index}`);
      }
      
      let changed = false;
      const nextProfile = {
        ...currentProfile,
        ownedItems: [...currentProfile.ownedItems],
        rewardedMilestones: [...currentProfile.rewardedMilestones]
      };
      
      milestonesCleared.forEach(m => {
        if (!nextProfile.rewardedMilestones.includes(m)) {
          nextProfile.rewardedMilestones.push(m);
          nextProfile.balance += 125;
          changed = true;
        }
      });
      
      if (status === "campaign-complete") {
        if (!nextProfile.rewardedMilestones.includes("campaign-complete")) {
          nextProfile.rewardedMilestones.push("campaign-complete");
          nextProfile.balance += 250;
          changed = true;
        }
      }
      
      if (changed) {
        currentProfile = Object.freeze(sanitizeProfile(nextProfile));
        saveProfile(currentProfile);
        window.dispatchEvent(new CustomEvent("abyssal:profile-changed", { detail: currentProfile }));
        notify();
      }
    };

    if (typeof window === "undefined" || !window.navigator || typeof process !== "undefined") {
      try {
        return runMutation();
      } catch (e) {
        console.error("syncCampaign failed:", e);
      }
      return;
    }
    return enqueueMutation(runMutation).catch(e => {
      console.error("syncCampaign failed:", e);
    });
  }

  try {
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) {
          const reloaded = loadProfile();
          currentProfile = Object.freeze(reloaded);
          applyTheme(currentProfile.equippedTheme);
          window.dispatchEvent(new CustomEvent("abyssal:profile-changed", { detail: currentProfile }));
          notify();
        }
      });
    }
  } catch (e) {
    console.error("Failed to add storage listener:", e);
  }

  function resetForTests() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to remove profile key from localStorage:", e);
    }
    memoryFallback = null;
    currentProfile = Object.freeze(createDefaultProfile());
    applyTheme(currentProfile.equippedTheme);
    window.dispatchEvent(new CustomEvent("abyssal:profile-changed", { detail: currentProfile }));
    notify();
  }

  // Initialize profile
  currentProfile = Object.freeze(loadProfile());
  applyTheme(currentProfile.equippedTheme);

  // Expose to window
  window.AbyssalProfile = Object.freeze({
    VERSION,
    CATALOG,
    getSnapshot,
    subscribe,
    purchase,
    equip,
    syncCampaign,
    resetForTests
  });
})();
