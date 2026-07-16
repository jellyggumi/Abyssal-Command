import {
  RULES_VERSION,
  STAGES,
  applyAction,
  applyBattleBreach,
  chooseReward,
  createCampaign,
  createSaveEnvelope,
  getAvailableActions,
  getCampaignBenefits,
  getStageChecklist,
  restoreSaveEnvelope,
  retryStage,
  startCampaign
} from "./campaign-state.js";
import { BattleVisualizer } from "./battle-visualizer.js";
import { createLiquidEther } from "./liquid-ether.js";

const BUILD_TAG = "abyssal-surge-static-v1";
const DB_NAME = "abyssal-surge-campaign";
const DB_VERSION = 1;
const STORE_NAME = "campaigns";
const PRIMARY_KEY = "primary";
const FALLBACK_KEY = "abyssal-surge-campaign-fallback-v1";
const MAX_IMPORT_BYTES = 256 * 1024;
const REWARD_ART_IDS = new Set(["ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo", "dawnless-crown"]);
const ACTION_KEYS = Object.freeze({ h: "hunt", e: "extract", m: "materialize", c: "capture", p: "possess", d: "domain", a: "assault" });
const COOLDOWN_SECONDS = Object.freeze({
  hunt: 4,
  extract: 6,
  materialize: 5,
  capture: 8,
  possess: 10,
  domain: 15,
  assault: 3
});
const BOSS_SPEC = Object.freeze([
  Object.freeze({ threat: "Class A", counter: 1, lore: "The forge bridge's ashbound sentinel breaks intruders against the drowned iron." }),
  Object.freeze({ threat: "Class S", counter: 2, lore: "A tactician of listening stone that turns every uncovered route into a killing field." }),
  Object.freeze({ threat: "Class Sovereign", counter: 8, lore: "The final gate's remembered ruler, holding back the last abyssal tide." })
]);
const CUE_BY_EFFECT = Object.freeze({
  hunt: "assets/audio/hunt.mp3",
  extract: "assets/audio/extract.mp3",
  materialize: "assets/audio/materialize.mp3",
  capture: "assets/audio/capture.mp3",
  possess: "assets/audio/possess.mp3",
  domain: "assets/audio/domain.mp3",
  assault: "assets/audio/assault.mp3",
  reward: "assets/audio/reward.mp3"
});
const NARRATION = Object.freeze({
  intro: Object.freeze({ audio: "assets/audio/narr-intro.mp3", line: "심연의 문이 열렸다. 그림자 군주여, 일어나라." }),
  "cinder-span": Object.freeze({ audio: "assets/audio/narr-stage1.mp3", line: "잿빛 교량, 신더 스팬. 재의 메아리를 사냥하고 영혼을 거두어라." }),
  "veil-citadel": Object.freeze({ audio: "assets/audio/narr-stage2.mp3", line: "장막 성채, 베일 시타델. 빙의의 힘이 깨어난다. 두 거점을 동시에 장악하라." }),
  "echo-throne": Object.freeze({ audio: "assets/audio/narr-stage3.mp3", line: "메아리 왕좌. 군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라." }),
  victory: Object.freeze({ audio: "assets/audio/narr-victory.mp3", line: "침묵한 문 앞에서, 그림자 군단이 왕좌에 오른다." }),
  defeat: Object.freeze({ audio: "assets/audio/narr-defeat.mp3", line: "군단의 닻이 끊어졌다. 다시, 일어나라." })
});
const TYPE_MS_PER_CHAR = 28;
const BOSS_BY_STAGE = Object.freeze({
  "cinder-span": "assets/images/ui/boss-cinder-warden.png",
  "veil-citadel": "assets/images/ui/boss-veil-tactician.png",
  "echo-throne": "assets/images/ui/boss-gate-sovereign.png"
});
const VIDEO_BY_STAGE = Object.freeze({
  "cinder-span": "assets/video/cinder-span.mp4",
  "veil-citadel": "assets/video/veil-citadel.mp4",
  "echo-throne": "assets/video/echo-throne.mp4"
});
const IMAGE_BY_STAGE = Object.freeze({
  "cinder-span": "assets/images/cinder-span.png",
  "veil-citadel": "assets/images/veil-citadel.png",
  "echo-throne": "assets/images/echo-throne.png"
});

class CampaignStorage {
  constructor() {
    this.db = null;
    this.mode = "memory";
    this.memory = null;
  }

  async open() {
    if (!("indexedDB" in window)) {
      this.mode = "fallback";
      return this.mode;
    }
    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
      });
      this.mode = "indexeddb";
    } catch {
      this.db = null;
      this.mode = "fallback";
    }
    return this.mode;
  }

  readFallback() {
    if (this.memory) return this.memory;
    try {
      const raw = window.localStorage.getItem(FALLBACK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  writeFallback(envelope) {
    this.memory = envelope;
    try {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(envelope));
      return "localStorage";
    } catch {
      return "memory";
    }
  }

  async load() {
    if (this.db) {
      try {
        const record = await new Promise((resolve, reject) => {
          const request = this.db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(PRIMARY_KEY);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (record?.envelope) return { envelope: record.envelope, source: "IndexedDB" };
      } catch {
        this.mode = "fallback";
      }
    }
    const envelope = this.readFallback();
    return { envelope, source: envelope ? "local fallback" : null };
  }

  async save(envelope) {
    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction(STORE_NAME, "readwrite");
          transaction.objectStore(STORE_NAME).put({ id: PRIMARY_KEY, envelope });
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
        this.mode = "indexeddb";
        return "IndexedDB";
      } catch {
        this.mode = "fallback";
      }
    }
    return this.writeFallback(envelope);
  }
}

const elements = Object.freeze({
  lobby: document.querySelector("#campaign-lobby"),
  screen: document.querySelector("#campaign-screen"),
  start: document.querySelector("#start-campaign"),
  resume: document.querySelector("#resume-campaign"),
  restart: document.querySelector("#restart-campaign"),
  retry: document.querySelector("#retry-stage"),
  views: Object.freeze({
    scenario: document.querySelector("#view-scenario"),
    bossSpec: document.querySelector("#view-boss-spec"),
    battle: document.querySelector("#view-battle"),
    result: document.querySelector("#view-result")
  }),
  goToBossSpec: document.querySelector("#go-to-boss-spec"),
  goToBattle: document.querySelector("#go-to-battle"),
  goToNextScenario: document.querySelector("#go-to-next-scenario"),
  retryFromResult: document.querySelector("#retry-from-result"),
  resultTitle: document.querySelector("#result-title"),
  resultText: document.querySelector("#result-text"),
  bossSpecPortrait: document.querySelector("#boss-portrait-spec"),
  bossSpecName: document.querySelector("#boss-spec-name"),
  bossSpecLore: document.querySelector("#boss-spec-lore"),
  bossSpecThreat: document.querySelector("#boss-spec-threat"),
  bossSpecHp: document.querySelector("#boss-spec-hp"),
  bossSpecCounter: document.querySelector("#boss-spec-counter"),
  bossSpecNodes: document.querySelector("#boss-spec-nodes"),
  statMaxIntegrity: document.querySelector("#stat-max-integrity"),
  statCooldownReduction: document.querySelector("#stat-cooldown-reduction"),
  statExtraDamage: document.querySelector("#stat-extra-damage"),
  statActiveItems: document.querySelector("#stat-active-items"),
  waveIndicator: document.querySelector("#battle-wave-indicator"),
  battleCanvas: document.querySelector("#battle-canvas-3d"),
  stageNumber: document.querySelector("#stage-number"),
  stageHeading: document.querySelector("#stage-heading"),
  stageRegion: document.querySelector("#stage-region"),
  stageObjective: document.querySelector("#stage-objective"),
  status: document.querySelector("#campaign-status"),
  souls: document.querySelector("#souls-value"),
  legion: document.querySelector("#legion-value"),
  nodes: document.querySelector("#nodes-value"),
  integrity: document.querySelector("#integrity-value"),
  bossLabel: document.querySelector("#boss-label"),
  boss: document.querySelector("#boss-value"),
  checklist: document.querySelector("#objective-checklist"),
  rewardPanel: document.querySelector("#reward-panel"),
  rewardOptions: document.querySelector("#reward-options"),
  complete: document.querySelector("#campaign-complete"),
  completionSummary: document.querySelector("#completion-summary"),
  saveStatus: document.querySelector("#save-status"),
  exportSave: document.querySelector("#export-save"),
  importSave: document.querySelector("#import-save"),
  effect: document.querySelector("#visual-effect"),
  ambience: document.querySelector("#toggle-stage-ambience"),
  transition: document.querySelector("#stage-transition"),
  video: document.querySelector("#stage-transition-video"),
  cinematic: document.querySelector("#campaign-cinematic"),
  cinematicButton: document.querySelector("#play-cinematic"),
  cinematicStatus: document.querySelector("#cinematic-status"),
  narrationLine: document.querySelector("#narration-line"),
  narrationSr: document.querySelector("#narration-sr"),
  commandButtons: [...document.querySelectorAll("[data-action]")],
  stageButtons: [1, 2, 3].map((number) => document.querySelector(`#stage-select-${number}`)),
  bgmToggle: document.querySelector("#bgm-toggle"),
  bgmPlayer: document.querySelector("#bgm-player")
});

let campaign = null;
let storedCampaign = null;
let storage = new CampaignStorage();
let cuePlayer = null;
let ambiencePlayer = null;
let narrationPlayer = null;
let typingTimer = 0;
let narratedStageId = null;
let narratedOutcome = null;
let activeView = "scenario";
let visualizer = null;
let waveTimer = 0;
let cooldownTimer = 0;
let waveIndex = 0;
const cooldowns = new Map();
let pendingNextScenario = false;

function currentStage() {
  return STAGES[campaign.stageIndex];
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function renderChecklist() {
  elements.checklist.replaceChildren();
  for (const item of getStageChecklist(campaign)) {
    const row = document.createElement("li");
    row.className = item.complete ? "complete" : "pending";
    row.textContent = item.label;
    row.setAttribute("aria-label", `${item.label}: ${item.complete ? "complete" : "pending"}`);
    elements.checklist.append(row);
  }
}

function renderRewards(stage) {
  elements.rewardOptions.replaceChildren();
  for (const reward of stage.rewards) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reward-option";
    button.dataset.rewardId = reward.id;
    if (REWARD_ART_IDS.has(reward.id)) {
      const art = document.createElement("img");
      art.className = "reward-art";
      art.alt = "";
      art.src = `assets/images/ui/reward-${reward.id}.png`;
      art.addEventListener("error", () => art.remove(), { once: true });
      button.append(art);
    }
    const name = document.createElement("strong");
    name.textContent = reward.name;
    const description = document.createElement("span");
    description.textContent = reward.description;
    button.append(name, description);
    button.addEventListener("click", () => handleReward(reward.id));
    elements.rewardOptions.append(button);
  }
}

function renderStageMedia(stage) {
  const videoSource = VIDEO_BY_STAGE[stage.id];
  const imageSource = IMAGE_BY_STAGE[stage.id];
  if (elements.video.dataset.stage === stage.id) return;

  elements.video.dataset.stage = stage.id;
  elements.transition.style.removeProperty("background-image");
  if (imageSource) {
    const image = new Image();
    image.onload = () => {
      if (elements.video.dataset.stage === stage.id) {
        elements.transition.style.backgroundImage = `linear-gradient(115deg, rgb(14 18 36 / 92%), rgb(17 27 44 / 72%)), url("${imageSource}")`;
      }
    };
    image.onerror = () => elements.transition.style.removeProperty("background-image");
    image.src = imageSource;
  }

  const portrait = document.querySelector("#boss-portrait");
  if (portrait) {
    const bossArt = BOSS_BY_STAGE[stage.id];
    if (bossArt) {
      portrait.src = bossArt;
      portrait.alt = "";
      portrait.hidden = false;
    } else {
      portrait.hidden = true;
    }
  }

  elements.video.hidden = true;
  elements.video.removeAttribute("src");
  elements.video.load();
  if (!videoSource || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  elements.video.src = videoSource;
  elements.video.onloadeddata = () => {
    elements.video.hidden = false;
    elements.video.play().catch(() => undefined);
  };
  elements.video.onerror = () => {
    elements.video.hidden = true;
    elements.video.removeAttribute("src");
  };
  elements.video.load();
}

function remainingCooldown(action, now = performance.now()) {
  return Math.max(0, (cooldowns.get(action) ?? 0) - now);
}

function stopBattle() {
  window.clearInterval(waveTimer);
  window.clearInterval(cooldownTimer);
  waveTimer = 0;
  cooldownTimer = 0;
  cooldowns.clear();
  visualizer?.destroy();
  visualizer = null;
}

function spawnBattleWave() {
  if (activeView !== "battle" || !visualizer) return;
  const stage = currentStage();
  const waveNames = ["SCOUT", "GUARD", "BOSS REINFORCEMENT"];
  const enemyCounts = [2, 3 + stage.number, 5 + stage.number];
  elements.waveIndicator.textContent = `WAVE ${waveIndex + 1}/3 · ${waveNames[waveIndex]}`;
  visualizer.spawnEnemy(enemyCounts[waveIndex]);
  waveIndex = (waveIndex + 1) % waveNames.length;
}

function startBattle() {
  if (!campaign || campaign.status !== "active" || visualizer) return;
  waveIndex = 0;
  visualizer = new BattleVisualizer(elements.battleCanvas);
  visualizer.onEnemyBreach = () => {
    void handleBattleBreach();
  };
  try {
    visualizer.init();
    spawnBattleWave();
    waveTimer = window.setInterval(spawnBattleWave, 6000);
    cooldownTimer = window.setInterval(render, 100);
  } catch {
    stopBattle();
    elements.status.textContent = "Battle visualization is unavailable; command rules remain ready.";
  }
}

function showView(view) {
  if (!elements.views[view] || !campaign) return;
  if (view === "battle" && campaign.status !== "active") return;
  if (activeView === "battle" && view !== "battle") stopBattle();
  activeView = view;
  for (const [name, node] of Object.entries(elements.views)) node.hidden = name !== view;
  if (view === "battle") startBattle();
  render();
}

function renderBossSpec(stage, state, benefits) {
  const spec = BOSS_SPEC[stage.number - 1];
  elements.bossSpecPortrait.src = BOSS_BY_STAGE[stage.id];
  elements.bossSpecPortrait.alt = `${stage.bossName} portrait`;
  elements.bossSpecName.textContent = stage.bossName;
  elements.bossSpecLore.textContent = spec.lore;
  elements.bossSpecThreat.textContent = spec.threat;
  elements.bossSpecHp.textContent = `${state.bossHealth} / ${stage.bossHealth} HP`;
  elements.bossSpecCounter.textContent = String(spec.counter);
  elements.bossSpecNodes.textContent = `${stage.nodeGoal} Node${stage.nodeGoal === 1 ? "" : "s"}`;
  elements.statMaxIntegrity.textContent = String(benefits.maxIntegrity);
  elements.statCooldownReduction.textContent = `${Math.round(benefits.cooldownReduction * 100)}%`;
  elements.statExtraDamage.textContent = `+${benefits.extraAssaultDamage}`;
  elements.statActiveItems.textContent = benefits.activeItemNames.length ? benefits.activeItemNames.join(", ") : "None";
}

function renderResult(isComplete) {
  const isDefeat = campaign.status === "defeat";
  const awaitingReward = campaign.status === "reward";
  const rewardClaimed = pendingNextScenario && campaign.status === "active";
  elements.resultTitle.textContent = isDefeat ? "Anchor Lost" : isComplete ? "Campaign Complete" : awaitingReward ? "Ward Broken" : "Reward Claimed";
  elements.resultText.textContent = isDefeat ? "DEFEAT" : "VICTORY";
  elements.resultText.className = `result-text ${isDefeat ? "defeat" : "victory"}`;
  elements.goToNextScenario.hidden = !rewardClaimed;
  elements.retryFromResult.hidden = !isDefeat;
}

function renderCooldown(button, action, available) {
  const remaining = remainingCooldown(action);
  const cooling = remaining > 0;
  const enabled = activeView === "battle" && available && !cooling;
  button.disabled = !enabled;
  button.setAttribute("aria-disabled", String(!enabled));
  const overlay = button.querySelector(".cooldown-overlay");
  const timer = button.querySelector(".cooldown-timer");
  if (overlay) overlay.hidden = !cooling;
  if (timer) timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
}

function render() {
  if (!campaign) return;
  const stage = currentStage();
  const state = campaign.stage;
  const benefits = getCampaignBenefits(campaign);
  const available = new Set(getAvailableActions(campaign));
  const isComplete = campaign.status === "campaign-complete";

  elements.stageNumber.textContent = `Stage ${stage.number} of ${STAGES.length}`;
  elements.stageHeading.textContent = stage.title;
  elements.stageRegion.textContent = stage.region;
  elements.stageObjective.textContent = stage.objective;
  elements.status.textContent = campaign.lastMessage;
  elements.souls.textContent = String(state.souls);
  elements.legion.textContent = `${state.legion} / ${state.capacity}`;
  elements.nodes.textContent = `${state.nodes} / ${stage.nodeGoal}`;
  elements.integrity.textContent = `${state.integrity} / ${benefits.maxIntegrity}`;
  elements.bossLabel.textContent = `${stage.bossName} ward`;
  elements.boss.textContent = `${state.bossHealth} / ${stage.bossHealth}`;
  elements.retry.disabled = campaign.status === "reward" || isComplete;
  elements.rewardPanel.hidden = campaign.status !== "reward";
  elements.complete.hidden = !isComplete;
  elements.completionSummary.textContent = isComplete ? campaign.lastMessage : "";
  renderBossSpec(stage, state, benefits);
  renderResult(isComplete);

  for (const button of elements.commandButtons) {
    const action = button.dataset.action;
    renderCooldown(button, action, available.has(action));
  }
  for (const [index, button] of elements.stageButtons.entries()) {
    const stageNumber = index + 1;
    const active = stageNumber === stage.number && !isComplete;
    const cleared = stageNumber < stage.number || isComplete;
    button.disabled = true;
    button.classList.toggle("active", active);
    button.classList.toggle("cleared", cleared);
    button.classList.toggle("locked", !active && !cleared);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    button.setAttribute("aria-label", `${STAGES[index].title}: ${active ? "current stage" : cleared ? "cleared" : "locked"}`);
  }

  renderChecklist();
  if (campaign.status === "reward") renderRewards(stage);
  renderStageMedia(stage);
  syncNarration();
}

function revealCampaign() {
  elements.lobby.hidden = true;
  elements.screen.hidden = false;
  const terminal = ["reward", "defeat", "campaign-complete"].includes(campaign.status);
  showView(terminal ? "result" : "scenario");
  window.requestAnimationFrame(() => (terminal ? elements.resultTitle : elements.stageHeading).focus());
}

function playCue(effect) {
  const source = CUE_BY_EFFECT[effect];
  if (!source) return;
  if (!cuePlayer) {
    cuePlayer = new Audio();
    cuePlayer.preload = "none";
    cuePlayer.addEventListener("error", () => undefined);
  }
  cuePlayer.pause();
  cuePlayer.currentTime = 0;
  cuePlayer.src = source;
  cuePlayer.play().catch(() => undefined);
}

function typeText(target, text) {
  window.clearInterval(typingTimer);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    target.textContent = text;
    target.classList.remove("is-typing");
    return;
  }
  let index = 0;
  target.textContent = "";
  target.classList.add("is-typing");
  typingTimer = window.setInterval(() => {
    index += 1;
    target.textContent = text.slice(0, index);
    if (index >= text.length) {
      window.clearInterval(typingTimer);
      target.classList.remove("is-typing");
    }
  }, TYPE_MS_PER_CHAR);
}

function playNarration(key) {
  const entry = NARRATION[key];
  if (!entry) return;
  typeText(elements.narrationLine, entry.line);
  elements.narrationSr.textContent = entry.line;
  if (!narrationPlayer) {
    narrationPlayer = new Audio();
    narrationPlayer.preload = "none";
    narrationPlayer.addEventListener("error", () => undefined);
  }
  narrationPlayer.pause();
  narrationPlayer.currentTime = 0;
  narrationPlayer.src = entry.audio;
  narrationPlayer.play().catch(() => undefined);
}

function syncNarration() {
  if (!campaign) return;
  const stage = currentStage();
  if (campaign.status === "campaign-complete") {
    if (narratedOutcome !== "victory") {
      narratedOutcome = "victory";
      playNarration("victory");
    }
    return;
  }
  if (campaign.status === "defeat") {
    if (narratedOutcome !== "defeat") {
      narratedOutcome = "defeat";
      playNarration("defeat");
    }
    return;
  }
  narratedOutcome = null;
  if (narratedStageId !== stage.id) {
    narratedStageId = stage.id;
    playNarration(stage.id);
  }
}

function flashEffect(effect) {
  const run = () => {
    elements.effect.className = "visual-effect";
    void elements.effect.offsetWidth;
    elements.effect.classList.add("is-active", `effect-${effect}`);
    elements.effect.addEventListener("animationend", () => {
      elements.effect.className = "visual-effect";
    }, { once: true });
  };
  if (["materialize", "domain", "assault"].includes(effect)) {
    elements.effect.className = "visual-effect effect-inversion is-active";
    setTimeout(run, 150);
  } else {
    run();
  }
}

async function persistCampaign(context = "Campaign saved") {
  if (!campaign) return;
  const savedTo = await storage.save(createSaveEnvelope(campaign));
  setSaveStatus(`${context} in ${savedTo}.`);
}

function triggerBattleVisual(action) {
  if (!visualizer) return;
  const state = campaign.stage;
  const benefits = getCampaignBenefits(campaign);
  if (action === "hunt") visualizer.triggerHunt();
  if (action === "extract") visualizer.triggerExtract();
  if (action === "materialize") visualizer.triggerMaterialize(Math.max(1, 2 + benefits.summonBonus));
  if (action === "capture") visualizer.triggerCapture(state.nodes, currentStage().nodeGoal);
  if (action === "possess") visualizer.triggerPossess();
  if (action === "domain") visualizer.triggerDomain();
  if (action === "assault") visualizer.triggerAssault();
}

function startActionCooldown(action) {
  const benefits = getCampaignBenefits(campaign);
  const duration = COOLDOWN_SECONDS[action] * (1 - benefits.cooldownReduction);
  cooldowns.set(action, performance.now() + duration * 1000);
}

async function handleAction(action) {
  if (!campaign || activeView !== "battle" || remainingCooldown(action) > 0 || !getAvailableActions(campaign).includes(action)) return;
  const result = applyAction(campaign, action);
  campaign = result.state;
  if (!result.accepted) {
    render();
    return;
  }
  startActionCooldown(action);
  triggerBattleVisual(action);
  flashEffect(result.effect);
  playCue(result.effect);
  await persistCampaign("Campaign saved");
  render();
  if (campaign.status === "reward") {
    showView("result");
    elements.rewardOptions.querySelector("button")?.focus();
  } else if (campaign.status === "defeat") {
    showView("result");
    elements.retryFromResult.focus();
  }
}

async function handleBattleBreach() {
  if (!campaign || activeView !== "battle") return;
  const result = applyBattleBreach(campaign);
  campaign = result.state;
  if (!result.accepted) return;
  flashEffect("assault");
  await persistCampaign("Battle breach saved");
  render();
  if (campaign.status === "defeat") {
    showView("result");
    elements.retryFromResult.focus();
  }
}

async function handleReward(rewardId) {
  if (!campaign || activeView !== "result") return;
  const result = chooseReward(campaign, rewardId);
  campaign = result.state;
  render();
  if (!result.accepted) return;
  flashEffect("reward");
  playCue("reward");
  await persistCampaign("Reward and campaign saved");
  if (campaign.status === "campaign-complete") {
    document.querySelector("#completion-heading")?.focus();
    return;
  }
  pendingNextScenario = true;
  render();
  elements.goToNextScenario.focus();
}

async function beginNewCampaign() {
  if (campaign && campaign.trace.length > 0 && !window.confirm("Start a new campaign? Your current local run will be replaced.")) return;
  stopBattle();
  const result = startCampaign(createCampaign());
  campaign = result.state;
  storedCampaign = null;
  pendingNextScenario = false;
  activeView = "scenario";
  narratedStageId = STAGES[campaign.stageIndex].id;
  narratedOutcome = null;
  revealCampaign();
  flashEffect("awaken");
  playNarration("intro");
  await persistCampaign("New campaign saved");
}

async function handleRetry() {
  if (!campaign) return;
  const result = retryStage(campaign);
  campaign = result.state;
  if (!result.accepted) {
    render();
    return;
  }
  pendingNextScenario = false;
  flashEffect("retry");
  await persistCampaign("Stage retry saved");
  showView("scenario");
}

function exportSave() {
  if (!campaign) return;
  const blob = new Blob([JSON.stringify(createSaveEnvelope(campaign), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "abyssal-surge-campaign-save.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setSaveStatus("Versioned campaign save exported.");
}

async function importSave(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setSaveStatus("Import rejected: save exceeds the 256 KiB limit.");
    elements.importSave.value = "";
    return;
  }
  try {
    const envelope = JSON.parse(await file.text());
    campaign = restoreSaveEnvelope(envelope);
    storedCampaign = campaign;
    revealCampaign();
    await persistCampaign("Imported campaign saved");
    flashEffect("reward");
  } catch (error) {
    setSaveStatus(`Import rejected: ${error instanceof Error ? error.message : "invalid save file"}`);
  } finally {
    elements.importSave.value = "";
  }
}

function toggleAmbience() {
  if (!ambiencePlayer) {
    ambiencePlayer = new Audio("assets/audio/ambient.mp3");
    ambiencePlayer.loop = true;
    ambiencePlayer.preload = "none";
    ambiencePlayer.addEventListener("error", () => {
      ambiencePlayer.pause();
      elements.ambience.textContent = "Ambient sound unavailable";
      elements.ambience.setAttribute("aria-pressed", "false");
    });
  }
  if (ambiencePlayer.paused) {
    ambiencePlayer.play().then(() => {
      elements.ambience.textContent = "Pause ambient sound";
      elements.ambience.setAttribute("aria-pressed", "true");
    }).catch(() => {
      elements.ambience.textContent = "Ambient sound unavailable";
    });
  } else {
    ambiencePlayer.pause();
    elements.ambience.textContent = "Play ambient sound";
    elements.ambience.setAttribute("aria-pressed", "false");
  }
}
function toggleBgm() {
  const player = elements.bgmPlayer;
  const toggle = elements.bgmToggle;
  if (!player || !toggle) return;
  if (player.paused) {
    player.volume = 0.55;
    player.play().then(() => {
      toggle.classList.add("is-playing");
      toggle.setAttribute("aria-pressed", "true");
    }).catch(() => {
      toggle.classList.remove("is-playing");
      toggle.setAttribute("aria-pressed", "false");
    });
  } else {
    player.pause();
    toggle.classList.remove("is-playing");
    toggle.setAttribute("aria-pressed", "false");
  }
}


function playCinematic() {
  const video = elements.cinematic;
  video.hidden = false;
  video.muted = true;
  elements.cinematicButton.disabled = true;
  elements.cinematicStatus.textContent = "Loading optional cinematic…";
  video.onloadeddata = () => {
    elements.cinematicButton.disabled = false;
    elements.cinematicStatus.textContent = "Cinematic playing muted. Use native controls to enable sound.";
    video.play().catch(() => {
      elements.cinematicStatus.textContent = "Cinematic is ready. Press play in its native controls.";
    });
  };
  video.onerror = () => {
    video.pause();
    video.hidden = true;
    video.removeAttribute("src");
    video.load();
    elements.cinematicButton.disabled = false;
    elements.cinematicStatus.textContent = "Cinematic unavailable. Text campaign briefing remains complete.";
  };
  video.src = "assets/video/shadow-lord-cinematic.mp4";
  video.load();
}

function wireControls() {
  elements.start.addEventListener("click", beginNewCampaign);
  elements.restart.addEventListener("click", beginNewCampaign);
  elements.resume.addEventListener("click", () => {
    stopBattle();
    campaign = storedCampaign;
    pendingNextScenario = false;
    revealCampaign();
  });
  elements.retry.addEventListener("click", handleRetry);
  elements.goToBossSpec.addEventListener("click", () => {
    if (campaign?.status === "active") showView("bossSpec");
  });
  elements.goToBattle.addEventListener("click", () => {
    if (campaign?.status === "active") showView("battle");
  });
  elements.goToNextScenario.addEventListener("click", () => {
    if (campaign?.status !== "active" || !pendingNextScenario) return;
    pendingNextScenario = false;
    showView("scenario");
  });
  elements.retryFromResult.addEventListener("click", handleRetry);
  elements.commandButtons.forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  elements.exportSave.addEventListener("click", exportSave);
  elements.importSave.addEventListener("change", () => importSave(elements.importSave.files?.[0]));
  elements.ambience.addEventListener("click", toggleAmbience);
  elements.bgmToggle?.addEventListener("click", toggleBgm);
  elements.cinematicButton.addEventListener("click", playCinematic);
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
    const action = ACTION_KEYS[event.key.toLowerCase()];
    if (action && activeView === "battle" && campaign && getAvailableActions(campaign).includes(action)) {
      event.preventDefault();
      void handleAction(action);
    }
  });
}

function initLiquidEtherBackground() {
  const container = document.querySelector("#liquid-ether-bg");
  if (!container) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    createLiquidEther(container, {
      colors: ["#6F2969", "#B32B2B", "#395781"],
      mouseForce: 20,
      cursorSize: 100,
      isViscous: false,
      viscous: 30,
      iterationsViscous: 32,
      iterationsPoisson: 32,
      resolution: 0.5,
      isBounce: false,
      autoDemo: true,
      autoSpeed: 0.5,
      autoIntensity: 2.2,
      takeoverDuration: 0.25,
      autoResumeDelay: 3000,
      autoRampDuration: 0.6
    });
  } catch {
    // WebGL unavailable or blocked; leave the static CSS gradient background in place.
  }
}

function initReactBitsEffects() {
  // 1. Interactive Particles Background (Fluid Shadow Smoke Particles)
  const canvas = document.querySelector("#particles-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let particles = [];
    const maxParticles = 50;
    let mouse = { x: -1000, y: -1000 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener("mouseleave", () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    // Spawn extra particles on click
    window.addEventListener("click", (e) => {
      for (let i = 0; i < 8; i++) {
        particles.push(new Particle(e.clientX, e.clientY, true));
      }
      if (particles.length > maxParticles + 20) {
        particles.splice(0, particles.length - (maxParticles + 20));
      }
    });

    class Particle {
      constructor(x, y, isSpawned = false) {
        this.isSpawned = isSpawned;
        if (isSpawned) {
          this.x = x + (Math.random() - 0.5) * 20;
          this.y = y + (Math.random() - 0.5) * 20;
          this.size = Math.random() * 4 + 2;
          this.speedY = (Math.random() - 0.5) * 1.5;
          this.speedX = (Math.random() - 0.5) * 1.5;
          this.alpha = 0.8;
        } else {
          this.reset();
          this.y = Math.random() * canvas.height;
        }
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20;
        this.size = Math.random() * 3 + 1;
        this.speedY = -(Math.random() * 0.8 + 0.2);
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.alpha = Math.random() * 0.5 + 0.1;
        const palette = ["112, 229, 208", "171, 104, 255", "255, 122, 122", "111, 149, 235"];
        this.color = palette[Math.floor(Math.random() * palette.length)]; // aqua, purple, ember red, gate blue
      }
      update() {
        // Interaction with mouse
        if (mouse.x !== -1000) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            // Repel slightly
            const force = (120 - dist) / 120;
            this.x -= (dx / dist) * force * 1.5;
            this.y -= (dy / dist) * force * 1.5;
          }
        }

        this.y += this.speedY;
        this.x += this.speedX;

        if (this.isSpawned) {
          this.alpha -= 0.015;
          if (this.alpha <= 0) {
            const idx = particles.indexOf(this);
            if (idx > -1) particles.splice(idx, 1);
          }
        } else {
          if (this.y < -20 || this.x < -20 || this.x > canvas.width + 20) {
            this.reset();
          }
        }
      }
      draw() {
        ctx.fillStyle = `rgba(${this.color || "112, 229, 208"}, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p) {
          p.update();
          p.draw();
        }
      }
      if (!reduceMotion) requestAnimationFrame(animate);
    }
    animate();
    if (reduceMotion) {
      window.addEventListener("mousemove", () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) p.draw();
      });
    }
  }

  // 2. Spotlight & Tilt Effects (only on devices with hover capability)
  if (window.matchMedia("(hover: hover)").matches) {
    const panels = document.querySelectorAll(".panel, .map-node, .storyboard-card");
    panels.forEach((panel) => {
      panel.addEventListener("mousemove", (e) => {
        const rect = panel.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        panel.style.setProperty("--mouse-x", `${x}px`);
        panel.style.setProperty("--mouse-y", `${y}px`);

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6; // max 6 degrees tilt
        const rotateY = ((x - centerX) / centerX) * 6;
        panel.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      panel.addEventListener("mouseleave", () => {
        panel.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
      });
    });

    // 3. Magnetic Buttons Effect
    const buttons = document.querySelectorAll("button, .file-button");
    buttons.forEach((btn) => {
      btn.classList.add("magnetic-button");
      window.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const btnX = rect.left + rect.width / 2;
        const btnY = rect.top + rect.height / 2;
        const dx = e.clientX - btnX;
        const dy = e.clientY - btnY;
        const dist = Math.hypot(dx, dy);

        if (dist < 70) {
          // Pull button towards cursor
          const pullX = dx * 0.25;
          const pullY = dy * 0.25;
          btn.style.transform = `translate(${pullX}px, ${pullY}px)`;
        } else {
          btn.style.transform = "";
        }
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }
}

async function initialize() {
  document.documentElement.dataset.rulesVersion = RULES_VERSION;
  document.documentElement.dataset.buildTag = BUILD_TAG;
  await storage.open();
  const loaded = await storage.load();
  if (loaded.envelope) {
    try {
      storedCampaign = restoreSaveEnvelope(loaded.envelope);
      elements.resume.hidden = false;
      setSaveStatus(`A compatible campaign is available from ${loaded.source}.`);
    } catch {
      setSaveStatus("A local save was found but is incompatible. Start a new campaign or import a valid save.");
    }
  } else {
    setSaveStatus(storage.mode === "indexeddb" ? "No local campaign yet. IndexedDB is ready." : "IndexedDB is unavailable; this session will use the safe local fallback.");
  }
  wireControls();
  initLiquidEtherBackground();
  initReactBitsEffects();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}

initialize();
