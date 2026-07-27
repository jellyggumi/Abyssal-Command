import {
  STAGES,
  allocateWardenStatPoint,
  applyCampaignRunResult,
  applyEliteExtractionEvents,
  boundFragmentEarned,
  boundFragmentSpent,
  createCampaign,
  echoCoreEarned,
  echoCoreSpent,
  equipmentTierIndexFor,
  purchaseEquipmentTier,
  selectWardenTrait,
  setCompanionFormationSlot,
  setCompanionLoadout,
  startRun,
  unlockWardenSkillNode,
  wardLevel,
} from "./campaign-state.js";
import {
  COMPANION_ROLES, EQUIPMENT_SLOTS, EQUIPMENT_TIERS, FORMATION_STANCES, MAX_FRONT_SLOTS, STANCE_CONFIG,
  WARDEN_SKILL_TREE, WARDEN_STATS, WARDEN_TRAITS, WARDEN_TRAIT_UNLOCK_SEQUENCES,
  equipmentTierUpgradeCost, orderCompanionsByFormationIntent, roleForCompanion, wardenStatPointCost,
  wardenTraitOffersForSequence,
} from "./rpg-catalog.js";
import { DefenseStorage } from "./defense-storage.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "./defense-run-simulation.js";
import { RealtimeBattle, MeshThumbnailService, meshRootForCompanion, meshRootForStageBoss, COMMANDER_MESH_ROOT } from "./battle-realtime-three.js";
import { BattleVisualizer } from "./battle-visualizer.js";
import { ARENA, COMPANIONS, CUTSCENES, REWARDS, RULES_VERSION, SKILLS, STAGE_PRESENTATION_BY_ID, STAGE_REWARD_IDS, STAGE_TACTICS, TICK_RATE, XP_GROWTH } from "./defense-catalog.js";
import { cutsceneEventKey, cutsceneFromEvent } from "./defense-cutscene.js";
import { DefenseAudio } from "./defense-audio.js";
import { DefenseViewport } from "./defense-viewport.js";
import { DefenseTelemetry } from "./defense-telemetry.js";

const root = document.querySelector("#defense-app");
const storage = new DefenseStorage();
const viewport = new DefenseViewport();
const telemetry = new DefenseTelemetry();
const thumbnailService = new MeshThumbnailService();

const STEP_MS = 1000 / TICK_RATE;
const CAMERA_ORBIT_YAW_SENSITIVITY = 0.00372; // rad per logical px; full landscape width ~= 180deg
const CAMERA_ORBIT_PITCH_SENSITIVITY = 0.00246; // rad per logical px; drag up = look down (steeper pitch)
const CAMERA_PINCH_ZOOM_SENSITIVITY = 0.006; // zoomFactor delta per px of pinch-distance change
const DIRECTION_BY_VECTOR = Object.freeze({
  "0,-1": "N", "1,-1": "NE", "1,0": "E", "1,1": "SE",
  "0,1": "S", "-1,1": "SW", "-1,0": "W", "-1,-1": "NW", "0,0": "IDLE",
});
const KEY_DIRECTIONS = Object.freeze({
  w: "N", arrowup: "N", d: "E", arrowright: "E",
  s: "S", arrowdown: "S", a: "W", arrowleft: "W",
});
const SNAPSHOT_FEEDBACK_TYPES = new Set(["CRITICAL_HIT", "LORE_SURPRISE_RESOLVED"]);
const VISUAL_ACTOR_SCALE = 2.5;
const CAMERA_FOLLOW_X_LIMIT = 0.18;
const CAMERA_FOLLOW_Y_LIMIT = 0.14;
const CAMERA_FOLLOW_EASING = 0.18;
// World-HUD (Track 3) screen-space "float above ground anchor" offsets, in
// CSS pixels — NOT world units. See projectEntityToScreen()/projectStaticPoint()
// docs in battle-realtime-three.js for why a world-unit offset is unsafe here.
const WORLD_NAMEPLATE_LIFT_PX = 34;
const WORLD_DAMAGE_NUMBER_LIFT_PX = 18;
const WORLD_CAPTURE_PROMPT_LIFT_PX = 12;
const WORLD_WAYPOINT_EDGE_MARGIN_PX = 28; // clamped inset from the viewport edge, row 17's screen-clamp margin
// 3-stance formation selector (D22 판정11/Implementation interface, §2-a
// ui-redesign-delta-20260725.md) — glyph/label lookup keyed by
// FORMATION_STANCES id, purely presentational (the cycle order/cooldown
// itself is defense-run-simulation.js's authority via STANCE_CYCLE input).
// Glyphs are plain-text Unicode (not emoji) to match the existing
// .skill-glyph convention (app.js renderControls) rather than the design
// doc's literal "화살촉/원/삼지창" suggestion — a real trident glyph renders
// inconsistently across platforms as tofu/emoji-color-swap, so SPLIT uses
// Greek Psi (Ψ) as a stable three-prong approximation (documented per the
// design doc's "정확한 글리프는 디자이너 소관" escape hatch).
const STANCE_GLYPHS = Object.freeze({ VANGUARD: "▲", TURRET: "●", SPLIT: "Ψ" });
const STANCE_LABELS = Object.freeze({ VANGUARD: "전열", TURRET: "포대", SPLIT: "분산" });
// UNIFIED-GDD.md:85 / decision-log D22 Implementation interface: 4-second
// stance-switch cooldown, expressed in ticks against the shared TICK_RATE.
const STANCE_COOLDOWN_TICKS = 4 * TICK_RATE;
// Transient post-block shake feedback duration (§2-a "소프트 블록" — button
// stays tappable during cooldown, a blocked tap gets a brief visual nudge
// instead of a hard-disabled state).
const STANCE_BLOCK_SHAKE_MS = 260;
// Transient post-SUCCESS confirmation window (control-feel-20260725.md §2.2:
// a successful stance switch is the player's single most important real-time
// decision — the defense↔offense transition — and until now landed with only
// the STANCE_SWITCHED audio cue + a silent glyph swap, while a REJECTED tap
// got a visible shake. Good feel gives success at least as much feedback as
// failure. is-switched holds a STATIC glow (not a keyframe) for this window,
// so it is churn-immune under the per-tick #battle-actions innerHTML rebuild
// (the button subtree is torn down/recreated every ~40ms while the cooldown
// ring advances; a keyframe would restart each rebuild and stutter, a static
// held state re-applies identically). Non-motion, so it stays valid under
// reduced-motion — the accessible success signal the shake cannot be.
const STANCE_SWITCH_CONFIRM_MS = 520;
// One-shot campaign flag for the orbit-camera discovery toast (§2-b) —
// reuses the existing achievementIds array (campaign-state.js) as its
// storage exactly like the real "stage-clear:*" entries it already holds
// (see applyCampaignRunResult); campaign-state.js's own validCampaign()
// only requires unique non-empty strings here; namespacing with "ui-hint:"
// keeps it visually distinct from gameplay achievements without needing a
// schema change (this lane owns app.js/styles.css only, not campaign-state.js).
const CAMERA_HINT_ACHIEVEMENT_ID = "ui-hint:camera-orbit-discovery";
const STAGE_ART_FILE_BY_ID = Object.freeze({
  "cinder-span": "cinder-span",
  "veil-citadel": "veil-citadel",
  "echo-throne": "echo-throne-steps",
  "sunken-bastion": "sunken-bastion",
  "howling-sprawl": "howling-sprawl",
  "glass-necropolis": "glass-necropolis",
  "starless-canal": "starless-canal",
  "shattered-causeway": "shattered-causeway",
  "abyss-chancel": "abyss-chancel",
  "gate-zenith": "gate-zenith",
});

let campaign = null;
let selectedStageId = STAGES[0].id;
// Idle-style side-dock shell (20260727-lobby-dock-redesign, ui/hud-layout-spec.md +
// ui/component-contracts.md): replaces the old full-viewport #command-shell lobby overlay.
// Growth deck (left): 성장/동료/인벤토리. Ops deck (right): 출정/요새. Both docks are
// screen-space fixed UI, permanently docked to the viewport edges -- there is no longer a
// separate "lobby screen" to enter or leave; the live 3D battle canvas is always visible
// beside whichever dock panel (if any) is open.
const LEFT_DOCK_TABS = Object.freeze([
  { id: "growth", label: "성장", icon: "◆" },
  { id: "companions", label: "동료", icon: "❖" },
  { id: "inventory", label: "인벤토리", icon: "▦" },
]);
const RIGHT_DOCK_TABS = Object.freeze([
  { id: "sortie", label: "출정", icon: "◈" },
  { id: "stronghold", label: "요새", icon: "▣" },
]);
// dockOpen invariants (component-contracts.md §1): at most one side is true while
// dockTier==='compact'; both are forced false the instant BattleSession.beginRun() fires.
let dockOpen = { left: false, right: false };
let activeLeftDockTab = "growth";
let activeRightDockTab = "sortie";
let dockTier = "compact";
let dockMediaQuery = null;
let activeGrowthSegment = "stats"; // stats | skills | traits (성장 tab sub-nav)
let activeCompanionSegment = "list"; // list | formation (동료 tab sub-nav)
let statusText = "기록을 불러오는 중입니다.";
let campaignWrite = Promise.resolve();
let session = null;
let idleReturnReceipt = null;
// Item 6 (presentation-spec) — pooled screen-space particle burst for the 작전 개시 FAB.
// Six reusable <span>s recycled across clicks (DOM pool, not three.js); each animates
// transform+opacity then detaches. Lazily built on first use; skipped under reduced motion.
let sortieBurstPool = null;

/** component-contracts.md §1 computeDefaultDockOpen(): wide tier opens both docks;
 * compact tier opens ONLY the ops deck (sortie) so the existing zero-interaction
 * load-time browser contracts (#start-defense reachable immediately) keep passing. */
function computeDefaultDockOpen(tier) {
  return tier === "wide" ? { left: true, right: true } : { left: false, right: true };
}

function currentDockTier() {
  return globalThis.matchMedia?.("(min-width: 900px)").matches ? "wide" : "compact";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function selectedLoadout() {
  return Array.isArray(campaign?.companionLoadout?.prototypeIds)
    ? campaign.companionLoadout.prototypeIds
    : [];
}

function stageFor(stageId) {
  return STAGES.find((stage) => stage.id === stageId) ?? STAGES[0];
}

function stageArtPath(stageId) {
  const fileName = STAGE_ART_FILE_BY_ID[stageId] ?? STAGE_ART_FILE_BY_ID[STAGES[0].id];
  return `assets/images/battle/ui/stages/${fileName}.png`;
}



function stagePresentationFor(stageId) {
  return STAGE_PRESENTATION_BY_ID[stageId] ?? STAGE_PRESENTATION_BY_ID[STAGES[0].id];
}

function normalizedPosition(x, y) {
  return Object.freeze({
    x: x / ARENA.width * 2 - 1,
    y: y / ARENA.height * 2 - 1,
  });
}

function stageTerrainProjection(stageId) {
  const tactics = STAGE_TACTICS[stageId] ?? STAGE_TACTICS[STAGES[0].id];
  const presentation = stagePresentationFor(stageId);
  return Object.freeze({
    patternId: presentation.terrain.patternId,
    label: presentation.terrain.label,
    palette: presentation.palette,
    chokepath: Object.freeze({
      id: tactics.chokepath.id,
      ...normalizedPosition(tactics.chokepath.x, ARENA.height / 2),
      halfWidth: tactics.chokepath.halfWidth / ARENA.width * 2,
      label: presentation.mapLabels.chokepath,
    }),
    flank: Object.freeze({
      id: tactics.flank.id,
      ...normalizedPosition(tactics.flank.entryX, tactics.flank.entryY),
      label: presentation.mapLabels.flank,
    }),
    elevation: Object.freeze({
      id: tactics.elevation.id,
      ...normalizedPosition(tactics.elevation.x, tactics.elevation.y),
      label: presentation.mapLabels.elevation,
    }),
    hazard: Object.freeze({
      id: tactics.hazard.id,
      ...normalizedPosition(tactics.hazard.x, tactics.hazard.y),
      radius: tactics.hazard.radius / ARENA.width * 2,
      label: presentation.mapLabels.hazard,
    }),
    occupation: Object.freeze({
      id: tactics.occupation.id,
      ...normalizedPosition(tactics.occupation.x, tactics.occupation.y),
      radius: tactics.occupation.radius / ARENA.width * 2,
      label: presentation.mapLabels.occupation,
    }),
    extraction: Object.freeze({
      id: tactics.extraction.id,
      ...normalizedPosition(tactics.extraction.x, tactics.extraction.y),
      radius: tactics.extraction.radius / ARENA.width * 2,
      label: presentation.mapLabels.extraction,
    }),
    spawnDirections: tactics.spawnDirections,
  });
}

/**
 * Renders a GLB-mesh portrait span with an immediate text-glyph fallback (never a blank/
 * broken-image state while the async thumbnail loads, or permanently when meshRoot is
 * null -- e.g. stages 4-10 have no boss GLB root yet, see meshRootForStageBoss()). Caller
 * supplies the FULL class string so this can decorate either the general .rc-portrait
 * utility (companion cards) or an existing shaped container (.gate-panel-portrait,
 * .target-sigil circles) by combining both class names.
 */
function portraitMarkup(meshRoot, fallbackGlyph, className) {
  const attrs = meshRoot ? ` data-portrait-mesh="${meshRoot}" data-portrait-hydrated="0"` : "";
  return `<span class="${className}" aria-hidden="true"${attrs}><span class="rc-portrait-fallback">${escapeHtml(fallbackGlyph)}</span></span>`;
}

/** Finds every not-yet-hydrated portrait span under scope and asynchronously swaps its
 * fallback glyph for the real GLB-rendered thumbnail once available. Marks nodes hydrated
 * SYNCHRONOUSLY (before the async render even starts) so a rapid re-render or a second
 * call for the same scope never double-fires a render for the same node. Safe to call
 * unconditionally after every innerHTML assignment that might contain portrait spans --
 * thumbnailService caches by mesh root, so repeat calls across re-renders cost nothing
 * once a given mesh has rendered once. */
function hydratePortraits(scope) {
  for (const node of scope.querySelectorAll('[data-portrait-mesh]:not([data-portrait-hydrated="1"])')) {
    node.dataset.portraitHydrated = "1";
    const meshRoot = node.dataset.portraitMesh;
    thumbnailService.render(meshRoot).then((dataUrl) => {
      if (!dataUrl || !node.isConnected) return; // keep fallback glyph on failure or if this node was replaced by a newer render
      const img = document.createElement("img");
      img.alt = "";
      img.src = dataUrl;
      node.replaceChildren(img);
    }).catch(() => {});
  }
}

function companionGlyph(prototype) {
  return {
    "ember-cohort": "✦",
    "rift-lens": "◈",
    "veil-vanguard": "◇",
    "anchor-shard": "⬡",
    "throne-echo": "◌",
    "dawnless-crown": "♜",
    "pack-warden": "◊",
    "lantern-reaver": "☖",
    "requiem-warden": "○",
  }[prototype] ?? "·";
}

function stageNarrativeFor(stageId) {
  return CUTSCENES[stageId] ?? CUTSCENES.default;
}

function stageObjective(stageId) {
  const intro = stageNarrativeFor(stageId).intro;
  const lines = Array.isArray(intro) ? intro.filter((line) => typeof line === "string") : [];
  return lines.join(" ") || "관문을 지키고 메아리를 추출하라.";
}

function idleReturnSummary() {
  const total = campaign?.idleReturn?.totalProgress ?? 0;
  const receipt = idleReturnReceipt;
  if (receipt?.outcome === "SETTLED") {
    return { outcome: receipt.outcome, total, text: `오프라인 귀환 정산 완료 · +${receipt.awardedProgress} 기록 · 누적 ${total}` };
  }
  if (receipt?.outcome === "NO_COMPLETED_STAGES") {
    return { outcome: receipt.outcome, total, text: `오프라인 귀환을 확인했습니다 · 완료 전선 없음 · 누적 ${total}` };
  }
  if (receipt?.outcome === "ENCROACHED") {
    return { outcome: receipt.outcome, total, text: `저지선 압력 초과 · 이번 구간 정산 몰수(동료/장비/영구성장 손실 없음) · 저지 레벨 ${campaign ? wardLevel(campaign) : 0} · 누적 ${total}` };
  }
  if (receipt?.outcome === "INITIALIZED") {
    return { outcome: receipt.outcome, total, text: `오프라인 귀환 기록 시작 · 누적 ${total}` };
  }
  return { outcome: receipt?.outcome ?? "UNAVAILABLE", total, text: `오프라인 귀환 기록 · 누적 ${total}` };
}

function integrityProjection(actor) {
  const maxIntegrity = Math.max(1, Number.isFinite(actor?.maxIntegrity) ? actor.maxIntegrity : 1);
  const integrity = Math.max(0, Math.min(maxIntegrity, Number.isFinite(actor?.integrity) ? actor.integrity : 0));
  const ratio = integrity / maxIntegrity;
  const state = ratio <= 0.15 ? "critical" : ratio <= 0.35 ? "pressured" : "stable";
  return { integrity, maxIntegrity, ratio, state };
}

function loopPresentation(snapshot, { userPaused = false } = {}) {
  const objectives = snapshot?.objectives ?? {};
  const phase = objectives.phase ?? snapshot?.objectiveProgress?.phase ?? "gate-defense";
  const pressure = snapshot?.objectivePressure ?? {};
  const extraction = snapshot?.extractionProgress ?? {};
  const gate = integrityProjection(snapshot?.gate);
  const commander = integrityProjection(snapshot?.commander);
  const stance = FORMATION_STANCES.includes(snapshot?.formationStance) ? snapshot.formationStance : "VANGUARD";
  const routeStarted = Boolean(snapshot?.commander?.objectiveRoute);
  const cooldownTicks = Math.max(0, (snapshot?.stanceCooldownUntilTick ?? 0) - (snapshot?.tick ?? 0));
  const pressureSeconds = Number.isFinite(pressure.deadlineTick)
    ? Math.max(0, Math.ceil((pressure.deadlineTick - (snapshot?.tick ?? 0)) / TICK_RATE))
    : null;
  const phaseLabels = {
    "gate-defense": "관문 방어",
    "echo-recovery": "메아리 회수",
    growth: "성장 선택",
    occupation: "전장 점유",
    extraction: "엘리트 추출",
    "boss-kill": "보스 결전",
  };
  const phaseLabel = userPaused
    ? "사용자 일시 정지 · 전투 정지"
    : snapshot?.terminal === "VICTORY"
      ? "전투 승리 · 다음 출정"
      : snapshot?.terminal === "DEFEAT"
        ? "전투 패배 · 재출정"
        : snapshot?.growthOffer
          ? "성장 선택 · 전투 정지"
          : (snapshot?.tick ?? 0) < TICK_RATE * 3
            ? `작전 개시 · ${phaseLabels[phase] ?? "전선 유지"}`
            : phaseLabels[phase] ?? "전선 유지";
  const pressureLabel = pressureSeconds === null
    ? `압박 ${gate.state} · 관문 ${gate.integrity}/${gate.maxIntegrity}`
    : `압박 ${pressureSeconds}초 · 관문 ${gate.integrity}/${gate.maxIntegrity} · 지휘관 ${commander.integrity}/${commander.maxIntegrity}`;
  const growthLabel = snapshot?.growthOffer
    ? `Lv.${snapshot.commander.level} · ${snapshot.growthOffer.choices.length}개 성장 오퍼`
    : `성장 Lv.${snapshot?.commander?.level ?? 1} · XP ${snapshot?.commander?.xp ?? 0}`;
  const formationLabel = cooldownTicks > 0
    ? `편성 ${STANCE_LABELS[stance]} · 전환 ${Math.ceil(cooldownTicks / TICK_RATE)}초`
    : `편성 ${STANCE_LABELS[stance]} · 전환 가능`;
  const holdSeconds = Math.floor((extraction.holdTicks ?? 0) / TICK_RATE);
  const maxHoldSeconds = Math.ceil((extraction.maxHoldTicks ?? 0) / TICK_RATE);
  const extractionHolding = routeStarted && extraction.availableAt !== null && extraction.availableAt !== undefined;
  const extractionLabel = snapshot?.extracted
    ? "추출 완료 · 다음 출정 선택"
    : extraction.failed
      ? "추출 실패 · 재출정 필요"
      : extraction.completed
        ? "추출 준비 완료 · 정예 확정"
        : extractionHolding
          ? `추출 홀드 ${holdSeconds}/${maxHoldSeconds}초`
          : "정예 추출 지점 대기";
  return { phaseLabel, pressureLabel, growthLabel, formationLabel, extractionLabel };
}

function nextRewardName(stageId) {
  const authored = STAGE_REWARD_IDS[stageId] ?? [];
  const rewardId = authored.find((id) => !(campaign?.rewardIds ?? []).includes(id)) ?? authored[0];
  return REWARDS[rewardId]?.name ?? "봉쇄 기록";
}



function companionLabel(prototype) {
  return COMPANIONS[prototype]?.name ?? prototype;
}

function growthUpgradePreview(skillId, snapshot) {
  const skill = SKILLS[skillId] ?? {};
  const currentValue = snapshot.commander.skillRanks[skillId] ?? 0;
  const upgradedValue = currentValue + 1;
  const details = [`등급 ${currentValue} → ${upgradedValue}`];
  if (skill.basicDamage) details.push(`기본 공격 ${snapshot.commander.basicDamage} → ${snapshot.commander.basicDamage + skill.basicDamage}`);
  if (skill.pickupRange) details.push(`회수 반경 ${snapshot.commander.pickupRange} → ${snapshot.commander.pickupRange + skill.pickupRange}`);
  if (skill.maxIntegrity) details.push(`최대 내구 ${snapshot.commander.maxIntegrity} → ${snapshot.commander.maxIntegrity + skill.maxIntegrity}`);
  if (skill.damage) details.push(`피해 ${currentValue ? skill.damage : 0} → ${skill.damage}`);
  if (skill.integrity) details.push(`회복 ${currentValue ? skill.integrity : 0} → ${skill.integrity}`);
  if (skill.cooldown) details.push(`재사용 ${(skill.cooldown / TICK_RATE).toFixed(1)}초`);
  return { skillId, currentValue, upgradedValue, label: details.join(" · ") };
}

function rewardUpgradePreview(rewardId, snapshot) {
  const reward = REWARDS[rewardId] ?? {};
  const owned = snapshot.rewardIds.includes(rewardId);
  const currentValue = owned ? 1 : 0;
  const upgradedValue = 1;
  let detail = `Archive 기록 ${currentValue} → ${upgradedValue}`;
  if (reward.cooldownReduction) {
    const current = Math.round((1 - snapshot.commander.cooldownScale) * 100);
    const upgraded = owned ? current : Math.min(60, current + Math.round(reward.cooldownReduction * 100));
    detail = `쿨다운 감소 ${current}% → ${upgraded}%`;
  } else if (reward.gateDamageReduction) {
    const upgraded = owned ? snapshot.gateDamageReduction : snapshot.gateDamageReduction + reward.gateDamageReduction;
    detail = `관문 피해 감소 ${snapshot.gateDamageReduction} → ${upgraded}`;
  } else if (reward.integrity) {
    const upgraded = owned ? snapshot.gate.maxIntegrity : snapshot.gate.maxIntegrity + reward.integrity;
    detail = `관문 최대 내구 ${snapshot.gate.maxIntegrity} → ${upgraded}`;
  } else if (reward.companionId) {
    const current = snapshot.companions.some((entry) => entry.companionId === reward.companionId) ? 1 : 0;
    detail = `추출 동료 ${current} → 1`;
  } else if (reward.damageBonus) {
    const current = owned ? reward.damageBonus : 0;
    detail = `동료 공격 보너스 ${current} → ${reward.damageBonus}`;
  }
  return { rewardId, currentValue, upgradedValue, label: `${detail}${owned ? " · 이미 기록됨" : ""}` };
}

function stableRunSeed(stageId) {
  const attempt = campaign.attemptsByStage[stageId] ?? 0;
  const source = `${campaign.campaignId}:${campaign.resetEpoch}:${stageId}:${attempt}`;
  let hash = 0x811c9dc5;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 1;
}

async function persistCampaign(message = "기록을 저장했습니다.") {
  statusText = message;
  const write = campaignWrite.then(() => storage.save(campaign));
  campaignWrite = write.catch(() => {});
  try {
    await write;
  } catch {
    statusText = "저장소에 기록하지 못했습니다. 현재 세션은 계속됩니다.";
  }
}

/**
 * Warden growth data (stats/skills/traits/equipment/formation) shared by the
 * 성장/인벤토리/동료 command tabs and the pause-menu read-only overlay.
 * `interactive=false` renders the same markup with disabled/inert controls
 * (Option A pause overlay, D5 — a read-only glance, not a second input surface).
 */
function wardenGrowthData() {
  const wp = campaign.wardenProgress;
  return {
    wp,
    echoEarned: echoCoreEarned(campaign),
    echoSpent: echoCoreSpent(campaign),
    fragEarned: boundFragmentEarned(campaign),
    fragSpent: boundFragmentSpent(campaign),
    level: wardLevel(campaign),
    loadout: selectedLoadout(),
  };
}

function wardenStatsMarkup(data, interactive = true) {
  const { wp, echoEarned, echoSpent } = data;
  return Object.values(WARDEN_STATS).map((stat) => {
    const points = wp.statPoints[stat.id] ?? 0;
    const maxed = points >= stat.maxPoints;
    const nextCost = maxed ? null : wardenStatPointCost(points + 1);
    const affordable = nextCost !== null && echoSpent + nextCost <= echoEarned;
    return `<div class="growth-stat-row rc-lift"><div><strong>${escapeHtml(stat.name)}</strong><small>${escapeHtml(stat.description)} · ${points}/${stat.maxPoints}</small></div>${interactive ? `<button data-warden-stat="${stat.id}" ${maxed || !affordable ? "disabled" : ""}>${maxed ? "만렙" : `+1 (${nextCost} EC)`}</button>` : `<span class="growth-readonly-value">${maxed ? "만렙" : `${points}/${stat.maxPoints}`}</span>`}</div>`;
  }).join("");
}

function wardenSkillsMarkup(data, interactive = true) {
  const { wp, echoEarned, echoSpent } = data;
  return Object.values(WARDEN_SKILL_TREE).map((node) => {
    const unlocked = wp.skillTreeIds.includes(node.id);
    const prereqMet = node.prereq.every((id) => wp.skillTreeIds.includes(id));
    const affordable = echoSpent + node.cost <= echoEarned;
    const canUnlock = !unlocked && prereqMet && affordable;
    return `<div class="growth-skill-node rc-lift${unlocked ? " is-unlocked" : ""}"><span class="progression-icon" data-track="permanent" aria-hidden="true"></span><div><strong>${escapeHtml(node.id)}</strong><small>${escapeHtml(node.description)} · 비용 ${node.cost} EC${node.prereq.length ? ` · 선행 ${node.prereq.join(", ")}` : ""}</small></div>${interactive ? `<button data-warden-skill="${node.id}" ${unlocked || !canUnlock ? "disabled" : ""}>${unlocked ? "해금됨" : "해금"}</button>` : `<span class="growth-readonly-value">${unlocked ? "해금됨" : "미해금"}</span>`}</div>`;
  }).join("");
}

function wardenTraitsMarkup(data, interactive = true) {
  const { wp } = data;
  const nextTraitSlot = wp.traitIds.length;
  const nextTraitSequence = WARDEN_TRAIT_UNLOCK_SEQUENCES[nextTraitSlot];
  const traitOffers = interactive && nextTraitSequence !== undefined && campaign.resolvedIds.length >= nextTraitSequence
    ? wardenTraitOffersForSequence(nextTraitSequence, wp.traitIds) : [];
  return `
    <p class="section-copy">선택됨: ${wp.traitIds.length ? wp.traitIds.map((id) => escapeHtml(WARDEN_TRAITS[id]?.name ?? id)).join(", ") : "없음"} (${wp.traitIds.length}/${WARDEN_TRAIT_UNLOCK_SEQUENCES.length})</p>
    ${traitOffers.length ? `<div class="growth-trait-offers">${traitOffers.map((id) => { const trait = WARDEN_TRAITS[id]; return `<button class="growth-trait-card rc-lift" data-warden-trait="${id}"><strong>${escapeHtml(trait.name)}</strong><small>${escapeHtml(trait.description)}</small><em>${escapeHtml(trait.tradeoff)}</em></button>`; }).join("")}</div>`
      : !interactive ? "" : nextTraitSequence !== undefined ? `<p class="section-copy">다음 특성은 ${nextTraitSequence}전선 완료 시 선택 가능합니다 (현재 ${campaign.resolvedIds.length}).</p>` : `<p class="section-copy">모든 특성 슬롯을 사용했습니다.</p>`}`;
}

function equipmentOwnersMarkup(data, interactive = true) {
  const { fragEarned, fragSpent, loadout } = data;
  const equipOwners = [{ id: "warden", label: "Dusk Warden" }, ...loadout.map((id) => ({ id, label: companionLabel(id) }))];
  return equipOwners.map((owner) => `
    <div class="growth-equip-owner"><strong>${escapeHtml(owner.label)}</strong><div class="growth-equip-slots">${EQUIPMENT_SLOTS.map((slot) => {
      const tierIndex = equipmentTierIndexFor(campaign, owner.id, slot);
      const maxed = tierIndex >= EQUIPMENT_TIERS.length - 1;
      const currentTier = EQUIPMENT_TIERS[tierIndex];
      const cost = maxed ? null : equipmentTierUpgradeCost(tierIndex);
      const affordable = cost !== null && fragSpent + cost <= fragEarned;
      return `<div class="growth-equip-slot rc-lift"><small>${slot}</small><span class="progression-icon" data-track="permanent" aria-hidden="true"></span><span class="tier-icon" data-tier-vertices="${currentTier.vertexCount}" aria-hidden="true"></span><span>${escapeHtml(currentTier.name)} (${currentTier.id})</span>${interactive ? `<button data-warden-equip-owner="${owner.id}" data-warden-equip-slot="${slot}" ${maxed || !affordable ? "disabled" : ""}>${maxed ? "최대" : `강화 (${cost} BF)`}</button>` : ""}</div>`;
    }).join("")}</div></div>`).join("");
}

/**
 * Formation validation badges (ui-redesign-delta-20260725.md §C, ACCEPT) —
 * color-independent (icon glyph + aria-label, never color alone) risk
 * signal on `.growth-formation-slot`. Two mutually-exclusive triggers
 * (§C's two-signal table):
 *   - red (DOWNED, `✕`): `downedIds` is the LIVE run's currently-downed
 *     companion set — only ever populated by the pause-overlay call site
 *     (re-entry mid-run, run-scoped state, never persisted to campaign).
 *     Takes priority when both would apply (a downed companion's ward tier
 *     is moot until the run resets).
 *   - yellow (low ward, `!`): off-battle formation-edit screen only
 *     (`downedIds` omitted/null there) — FRONT slot + ward tier index 0
 *     (T1, unreinforced) [INFERENCE per design doc: exact "low" threshold is
 *     a balance-sheet.md decision, T1-baseline used as the proposed floor].
 * Non-blocking: informational only, never disables the FRONT/BACK button.
 */
function formationRowMarkup(data, interactive = true, downedIds = null, liveCompanions = null) {
  const liveById = new Map((liveCompanions ?? []).map((companion) => [companion.companionId, companion]));
  const orderedLoadout = liveCompanions?.length
    ? liveCompanions.map((companion) => companion.companionId)
    : orderCompanionsByFormationIntent(data.loadout, campaign.companionFormation);
  const copy = liveCompanions?.length
    ? "현재 전투 슬롯은 스탠스가 결정합니다. 선호 위치는 다음 출전 순위에 반영됩니다."
    : "전열/후열 선호가 출전 순위를 정합니다. 현재 VANGUARD 시작 배치는 순위 1–2 전열, 순위 3 후열이며 전투 중 스탠스가 실제 슬롯 수를 바꿉니다.";
  return orderedLoadout.length ? `<p class="section-copy">${copy}</p><div class="growth-formation-row">${orderedLoadout.map((id, index) => {
    const savedIntent = campaign.companionFormation[id] || "BACK";
    const openingSlot = liveById.get(id)?.slot ?? (index < STANCE_CONFIG.VANGUARD.derivedFrontCount ? "FRONT" : "BACK");
    const label = companionLabel(id);
    const role = COMPANION_ROLES[roleForCompanion(id)]?.name || "미분류";
    const isDowned = downedIds?.has(id) ?? false;
    const isLowWard = !isDowned && downedIds === null && openingSlot === "FRONT" && equipmentTierIndexFor(campaign, id, "ward") === 0;
    const badge = isDowned
      ? `<span class="formation-integrity-badge is-downed" aria-label="편성 경고: ${escapeHtml(label)} 현재 전열 이탈(DOWNED) 상태">✕</span>`
      : isLowWard
        ? `<span class="formation-integrity-badge is-low-ward" aria-label="편성 경고: ${escapeHtml(label)} 출전 전열 배치 위험 — 워드 등급 낮음">!</span>`
        : "";
    const targetIntent = savedIntent === "FRONT" ? "BACK" : "FRONT";
    return `<div class="growth-formation-slot rc-lift" data-position-rank="${index + 1}">${badge}<span class="formation-position-copy"><small>#${index + 1} · ${liveCompanions?.length ? "현재" : "출전"} ${openingSlot === "FRONT" ? "전열" : "후열"}</small><strong>${escapeHtml(label)}</strong><em>${escapeHtml(role)}</em></span><span class="formation-saved-intent">선호 ${savedIntent}</span>${interactive ? `<button data-warden-formation="${id}" data-warden-formation-target="${targetIntent}" aria-label="${escapeHtml(label)}의 선호 위치를 ${targetIntent}으로 변경">${targetIntent === "FRONT" ? "전열 우선" : "후열 우선"}</button>` : ""}</div>`;
  }).join("")}</div>` : `<p class="section-copy">편성된 동료가 없습니다.</p>`;
}

/** 성장 tab: stats/skills/traits, sub-navigated by `activeGrowthSegment`. */
function renderGrowthTab() {
  const data = wardenGrowthData();
  const segments = [
    { id: "stats", label: "스탯 (Echo Core)", html: `<div class="growth-stat-grid">${wardenStatsMarkup(data)}</div>` },
    { id: "skills", label: "스킬트리 (Echo Core 공용)", html: `<div class="growth-skill-grid">${wardenSkillsMarkup(data)}</div>` },
    { id: "traits", label: "특성 (전선 클리어 시 3택1)", html: wardenTraitsMarkup(data) },
  ];
  if (!segments.some((segment) => segment.id === activeGrowthSegment)) activeGrowthSegment = "stats";
  return `
    <section class="growth-panel command-screen" aria-labelledby="growth-title">
      <div class="panel-heading"><div><p class="eyebrow">DUSK WARDEN · TRACK A</p><h2 id="growth-title">성장</h2></div><span class="panel-count">EC ${data.echoSpent}/${data.echoEarned} · 저지 Lv${data.level}</span></div>
      <div class="command-segment-bar" role="tablist" aria-label="성장 항목">${segments.map((segment) => `<button class="command-segment${segment.id === activeGrowthSegment ? " is-active" : ""}" role="tab" aria-selected="${segment.id === activeGrowthSegment}" data-growth-segment="${segment.id}">${segment.label}</button>`).join("")}</div>
      <div class="command-segment-body">${segments.find((segment) => segment.id === activeGrowthSegment).html}</div>
    </section>`;
}

/**
 * 동료 tab: list/detail (IA screen #5) + 편성 (IA screen #6) as sub-nav
 * segments — mirrors 성장 tab's segment-bar pattern for the same reason
 * (ui/lane-info-architecture.md section 2.1 lists these as two distinct
 * numbered screens under one tab, not one flat scroll).
 */
function renderCompanionsListSegment(data) {
  const collection = campaign.companionCollection;
  return `
    <p class="section-copy">정예를 추출하면 영구 동료가 됩니다. 편성한 동료는 다음 출전부터 자동으로 함께합니다.</p>
    <div class="loadout-slots" aria-label="현재 동료 편성">${[0, 1, 2].map((index) => { const prototype = data.loadout[index]; return prototype ? `<div class="loadout-slot is-filled">${portraitMarkup(meshRootForCompanion(prototype), companionGlyph(prototype), "rc-portrait rc-portrait-sm")}<strong>${escapeHtml(companionLabel(prototype))}</strong><small>결속 ${index + 1}</small></div>` : `<div class="loadout-slot"><span class="slot-plus">+</span><small>빈 슬롯</small></div>`; }).join("")}</div>
    <div class="companion-grid">${collection.length ? collection.map((record) => `<button class="companion-card rc-lift${data.loadout.includes(record.prototype) ? " is-selected rc-glow-ring" : ""}" data-companion="${record.prototype}" aria-pressed="${data.loadout.includes(record.prototype)}">${portraitMarkup(meshRootForCompanion(record.prototype), companionGlyph(record.prototype), "rc-portrait rc-portrait-md")}<span><strong>${escapeHtml(companionLabel(record.prototype))}</strong><small>진화 ${record.evolution} · 추출 ${record.capturedEliteIds.length}</small></span><i>${data.loadout.includes(record.prototype) ? "편성됨" : "편성"}</i></button>`).join("") : `<div class="empty-companions"><span class="companion-glyph">?</span><div><strong>아직 결속한 동료가 없습니다.</strong><p>전투 중 빛나는 정예를 쓰러뜨린 뒤 <b>추출</b>하세요.</p></div></div>`}</div>`;
}

function renderCompanionsTab() {
  const data = wardenGrowthData();
  const segments = [
    { id: "list", label: "목록", html: renderCompanionsListSegment(data) },
    { id: "formation", label: `편성 (출전 순위 · 전열 선호 최대 ${MAX_FRONT_SLOTS})`, html: formationRowMarkup(data) },
  ];
  if (!segments.some((segment) => segment.id === activeCompanionSegment)) activeCompanionSegment = "list";
  return `
    <section class="loadout-panel command-screen" aria-labelledby="companion-title">
      <div class="panel-heading"><div><p class="eyebrow">COMMAND BOND</p><h2 id="companion-title">동료</h2></div><span class="panel-count">${data.loadout.length}/3 ACTIVE</span></div>
      <div class="command-segment-bar" role="tablist" aria-label="동료 항목">${segments.map((segment) => `<button class="command-segment${segment.id === activeCompanionSegment ? " is-active" : ""}" role="tab" aria-selected="${segment.id === activeCompanionSegment}" data-companion-segment="${segment.id}">${segment.label}</button>`).join("")}</div>
      <div class="command-segment-body">${segments.find((segment) => segment.id === activeCompanionSegment).html}</div>
    </section>`;
}

/** 인벤토리 tab: the 3-slot x 5-tier equipment ladder (weapon/ward/trinket) — no discrete item-drop inventory exists in this build. */
function renderInventoryTab() {
  const data = wardenGrowthData();
  return `
    <section class="growth-panel command-screen" aria-labelledby="inventory-title">
      <div class="panel-heading"><div><p class="eyebrow">DUSK WARDEN · TRACK B</p><h2 id="inventory-title">인벤토리</h2></div><span class="panel-count">BF ${data.fragSpent}/${data.fragEarned}</span></div>
      <div class="growth-equip-grid">${equipmentOwnersMarkup(data)}</div>
    </section>`;
}

/** 요새 tab: existing archive-panel (permanent rewards + idle-return summary) relabeled per the tab shell.
 * Prepends the idle-return-recap paragraph (component-contracts.md §3.4 secondary_placement) so a
 * player who dismissed the load-time toast can still re-check what happened offline, every time this
 * panel is open -- unlike the toast, this recap persists (not once-only). */
function renderStrongholdTab() {
  const completed = campaign.resolvedIds?.length ?? 0;
  const idleSummary = idleReturnSummary();
  return `
    <section class="archive-panel command-screen" aria-labelledby="reward-title">
      <p class="idle-return-recap idle-return-banner" data-idle-return-outcome="${escapeHtml(idleSummary.outcome)}" data-idle-return-total="${idleSummary.total}" aria-live="polite">${escapeHtml(idleSummary.text)}</p>
      <div class="panel-heading"><div><p class="eyebrow">ECHO DEEP</p><h2 id="reward-title">요새</h2></div></div>
      <div class="archive-summary"><span class="archive-ring"><b>${completed}</b><small>전선<br />완료</small></span><div><strong>영구 진행</strong><p>보스 보상과 동료 결속은 기록실에 남아 다음 런에도 이어집니다. 최근 오프라인 진행은 페이지 상단에 표시됩니다.</p></div></div>
      <div class="reward-grid">${(campaign.rewardIds?.length ?? 0) ? campaign.rewardIds.map((id) => `<article class="reward-card rc-lift rc-glass"><span class="reward-mark">✦</span><strong>${escapeHtml(REWARDS[id]?.name ?? id)}</strong><span>${escapeHtml(REWARDS[id]?.description ?? "기록된 보상")}</span></article>`).join("") : `<p class="empty-archive">첫 보스를 봉쇄하면 영구 보상을 선택할 수 있습니다.</p>`}</div>
      <details class="archive-tools"><summary>기록 관리 <span>오프라인 저장 · ${escapeHtml(storage.backend ?? "확인 중")}</span></summary><div class="storage-row" aria-label="캠페인 제어"><button id="export-defense">기록 내보내기</button><label class="import-label">기록 가져오기<input id="import-defense" type="file" accept="application/json,text/plain" /></label><button id="export-telemetry">진단 내보내기</button><button id="reset-defense">새 기록</button><output aria-live="polite">${escapeHtml(statusText)}</output></div></details>
    </section>`;
}


/**
 * Idle-style side-dock shell (20260727-lobby-dock-redesign): renders into the 4 persistent
 * sibling nodes mounted once by mountShell() -- #command-dock-left, #command-dock-right,
 * #start-defense.sortie-fab, #idle-return-toast -- NEVER touches #defense-battle-surface,
 * which lives for the whole page lifetime, untouched by this pass. Both docks are
 * screen-space fixed UI anchored to the viewport edges; the live 3D scene (ticking or
 * frozen at tick-0 depending on session.started) is always visible beside them. There is
 * no longer a single full-viewport "shell" -- see ui/hud-layout-spec.md for the rationale.
 */

/** Shared DockRail + DockPanel markup/wiring for one side (component-contracts.md §3.1/§3.2). */
function renderDockSide({ side, tabs, activeTab, isOpen, tabBodyHtml, brandLabel }) {
  const container = root.querySelector(`#command-dock-${side}`);
  if (!container) return;
  const railTabsHtml = tabs.map((tab) => `<button class="dock-rail-tab" role="tab" aria-selected="${tab.id === activeTab}" aria-expanded="${isOpen && tab.id === activeTab}" aria-controls="dock-panel-${side}" data-dock-tab="${tab.id}"><span class="dock-rail-icon" aria-hidden="true">${tab.icon}</span><span class="sr-only">${escapeHtml(tab.label)}</span></button>`).join("");
  const panelTabsHtml = tabs.map((tab) => `<button class="dock-rail-tab" role="tab" aria-selected="${tab.id === activeTab}" data-dock-tab="${tab.id}"><span class="dock-rail-icon" aria-hidden="true">${tab.icon}</span><span class="sr-only">${escapeHtml(tab.label)}</span></button>`).join("");
  container.innerHTML = `
    <nav class="dock-rail" data-dock-side="${side}" data-dock-open="${isOpen}" role="tablist" aria-label="${escapeHtml(brandLabel)}">${railTabsHtml}</nav>
    ${isOpen ? `
    <section class="dock-panel rc-glass" id="dock-panel-${side}" data-dock-side="${side}">
      <header class="dock-panel-header">
        <span class="dock-brand" role="img" aria-label="ABYSSAL COMMAND · FARWATCH HOLD" title="ABYSSAL COMMAND · FARWATCH HOLD">AC</span>
        <nav class="dock-panel-tabs" role="tablist" aria-label="${escapeHtml(brandLabel)}">${panelTabsHtml}</nav>
        <button type="button" class="dock-panel-close" aria-label="${escapeHtml(brandLabel)} 닫기">×</button>
      </header>
      <div class="dock-panel-body">${tabBodyHtml}</div>
    </section>` : ""}`;
  hydratePortraits(container);

  container.querySelectorAll("[data-dock-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const clickedTab = button.dataset.dockTab;
      if (isOpen && clickedTab === activeTab) {
        dockOpen[side] = false;
      } else {
        if (side === "left") activeLeftDockTab = clickedTab; else activeRightDockTab = clickedTab;
        dockOpen[side] = true;
        if (dockTier === "compact") dockOpen[side === "left" ? "right" : "left"] = false;
      }
      renderShell();
      root.querySelector(`#command-dock-${side} [data-dock-tab="${clickedTab}"]`)?.focus?.();
    });
  });
  container.querySelector(".dock-panel-close")?.addEventListener("click", () => {
    dockOpen[side] = false;
    renderShell();
    root.querySelector(`#command-dock-${side} [data-dock-tab="${activeTab}"]`)?.focus?.();
  });
  if (isOpen) container.querySelector(".dock-panel-header")?.focus?.();
  return container;
}

/** 성장 덱 (left dock): 성장/동료/인벤토리 -- character-power progression, no time pressure. */
function renderDockLeft() {
  if (!campaign) return;
  if (!LEFT_DOCK_TABS.some((tab) => tab.id === activeLeftDockTab)) activeLeftDockTab = "growth";
  const tabBodies = { growth: renderGrowthTab(), companions: renderCompanionsTab(), inventory: renderInventoryTab() };
  const dock = renderDockSide({
    side: "left",
    tabs: LEFT_DOCK_TABS,
    activeTab: activeLeftDockTab,
    isOpen: dockOpen.left,
    tabBodyHtml: tabBodies[activeLeftDockTab],
    brandLabel: "성장 덱",
  });
  if (!dock) return;
  dock.querySelectorAll("[data-growth-segment]").forEach((button) => {
    button.addEventListener("click", () => { activeGrowthSegment = button.dataset.growthSegment; renderShell(); });
  });
  dock.querySelectorAll("[data-companion-segment]").forEach((button) => {
    button.addEventListener("click", () => { activeCompanionSegment = button.dataset.companionSegment; renderShell(); });
  });
  dock.querySelectorAll("[data-companion]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prototype = button.dataset.companion;
      const current = selectedLoadout();
      const next = current.includes(prototype) ? current.filter((entry) => entry !== prototype) : [...current, prototype].slice(0, 3);
      campaign = setCompanionLoadout(campaign, next);
      await persistCampaign("동료 편성을 저장했습니다.");
      renderShell();
    });
  });
  dock.querySelectorAll("[data-warden-stat]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = allocateWardenStatPoint(campaign, button.dataset.wardenStat);
        await persistCampaign("스탯 포인트를 배분했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderShell();
    });
  });
  dock.querySelectorAll("[data-warden-skill]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = unlockWardenSkillNode(campaign, button.dataset.wardenSkill);
        await persistCampaign("스킬 노드를 해금했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderShell();
    });
  });
  dock.querySelectorAll("[data-warden-trait]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = selectWardenTrait(campaign, button.dataset.wardenTrait);
        await persistCampaign("특성을 선택했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderShell();
    });
  });
  dock.querySelectorAll("[data-warden-equip-owner]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = purchaseEquipmentTier(campaign, button.dataset.wardenEquipOwner, button.dataset.wardenEquipSlot);
        await persistCampaign("장비를 강화했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderShell();
    });
  });
  dock.querySelectorAll("[data-warden-formation]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        campaign = setCompanionFormationSlot(campaign, button.dataset.wardenFormation, button.dataset.wardenFormationTarget);
        await persistCampaign("편성을 변경했습니다.");
      } catch (error) {
        statusText = error.message;
      }
      renderShell();
    });
  });
  renderRailCurrency();
}

/** 출정 tab body, TRIMMED per hud-layout-spec.md §4: hero-copy and the decorative
 * tactical-map/stage-atlas are dropped -- the live 3D canvas next to this panel IS the
 * battlefield preview now. Every authored fact the atlas held (terrain, hazard, flank,
 * chokepath, elevation, occupation, extraction, landmarks) is folded into briefing-stats. */
function renderSortieTabBody(selected, selectedPresentation, selectedTerrain, selectedObjective, completed, unlocked, started) {
  return `
    <section class="mission-panel command-screen" aria-labelledby="stage-title">
      <div class="panel-heading"><div><p class="eyebrow">CAMPAIGN MAP</p><h2 id="stage-title">전선 선택</h2></div><span class="panel-count">${completed} CLEAR · ${unlocked} UNLOCKED</span></div>
      <div class="stage-rail">
        ${STAGES.map((stage, index) => {
          const locked = index > campaign.unlockedStageIndex;
          const cleared = campaign.resolvedIds?.includes(stage.id);
          const disabled = locked || (started && stage.id !== selected.id);
          return `<button class="stage-card rc-lift${stage.id === selected.id ? " is-selected rc-glow-ring" : ""}" data-stage="${stage.id}" style="--stage-card-art: url('${stageArtPath(stage.id)}')" aria-pressed="${stage.id === selected.id}" ${disabled ? "disabled" : ""}><span class="stage-card-art" aria-hidden="true"></span><span class="stage-index">${String(stage.sequence).padStart(2, "0")}</span><span class="stage-info"><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.bossName)}</small></span><span class="stage-state">${locked ? "잠김" : started && stage.id === selected.id ? "전투 중" : cleared ? "CLEAR" : stage.id === selected.id ? "선택됨" : "출전 가능"}</span>${stage.id === selected.id ? '<span class="stage-reward-chip" aria-hidden="true">✦ 보상</span>' : ""}</button>`;
        }).join("")}
      </div>
    </section>
    <aside class="briefing-panel command-screen" aria-labelledby="briefing-title">
      <div class="panel-heading"><div><p class="eyebrow">TACTICAL BRIEFING · ${escapeHtml(selectedPresentation.mapLabels.domain)}</p><h2 id="briefing-title">작전 브리핑</h2></div><span class="briefing-code">AC-${String(selected.sequence).padStart(2, "0")}</span></div>
      <div class="briefing-target" data-stage-briefing="selected" data-stage-id="${escapeHtml(selected.id)}">${portraitMarkup(meshRootForStageBoss(selected.id), "◉", "target-sigil rc-portrait")}<div><small>${escapeHtml(selectedPresentation.mapLabels.title)} · ${escapeHtml(selectedPresentation.atmosphere.descriptor)}</small><strong>${escapeHtml(selected.bossName)}</strong><span id="briefing-stage-narrative" data-stage-id="${escapeHtml(selected.id)}">${escapeHtml(selectedObjective)}</span></div></div>
      <p class="briefing-reward"><span>승리 시 →</span> <strong>${escapeHtml(nextRewardName(selected.id))}</strong></p>
      <details class="briefing-detail">
        <summary>전황 상세</summary>
        <dl class="briefing-stats">
          <div><dt>지형 / 고지</dt><dd>${escapeHtml(selectedPresentation.terrain.label)} · ${escapeHtml(selectedPresentation.mapLabels.chokepath)} · ${escapeHtml(selectedPresentation.mapLabels.elevation)}</dd></div>
          <div><dt>위협 / 측면</dt><dd>${escapeHtml(selectedPresentation.mapLabels.hazard)} · ${escapeHtml(selectedPresentation.mapLabels.flank)} (${escapeHtml(selectedTerrain.spawnDirections.join(", "))})</dd></div>
          <div><dt>점유 → 추출</dt><dd>${escapeHtml(selectedPresentation.mapLabels.occupation)} → ${escapeHtml(selectedPresentation.mapLabels.extraction)}</dd></div>
          <div><dt>랜드마크</dt><dd>${escapeHtml(selectedPresentation.landmarks.map(({ label }) => label).join(" · "))}</dd></div>
        </dl>
      </details>
      <p class="briefing-tip"><strong>${escapeHtml(selectedPresentation.mapLabels.objective)}</strong> 중앙 전장에서 손가락을 끌어 이동하세요. 정예를 처치하고 <b>추출(Extract)</b>하여 동료를 확보할 수 있습니다.</p>
    </aside>`;
}

/** 전황 덱 (right dock): 출정/요새 -- where the campaign stands (current front + permanent record). */
function renderDockRight() {
  if (!campaign) return;
  const selected = stageFor(selectedStageId);
  const selectedPresentation = stagePresentationFor(selected.id);
  const selectedTerrain = stageTerrainProjection(selected.id);
  const completed = campaign.resolvedIds?.length ?? 0;
  const unlocked = campaign.unlockedStageIndex + 1;
  const selectedObjective = stageObjective(selected.id);
  const started = session?.started ?? false;
  root.dataset.stageId = selected.id;
  root.style.setProperty("--stage-art", `url("${stageArtPath(selected.id)}")`);
  if (!RIGHT_DOCK_TABS.some((tab) => tab.id === activeRightDockTab)) activeRightDockTab = "sortie";
  const briefingLine = started
    ? `전투 진행 중 · ${escapeHtml(selected.name)} · ${escapeHtml(selected.bossName)}`
    : `${escapeHtml(selected.name)} · ${escapeHtml(selected.bossName)}`;
  const tabBodies = {
    sortie: `<p class="dock-briefing-line" aria-live="polite">${briefingLine}</p>${renderSortieTabBody(selected, selectedPresentation, selectedTerrain, selectedObjective, completed, unlocked, started)}`,
    stronghold: renderStrongholdTab(),
  };
  const dock = renderDockSide({
    side: "right",
    tabs: RIGHT_DOCK_TABS,
    activeTab: activeRightDockTab,
    isOpen: dockOpen.right,
    tabBodyHtml: tabBodies[activeRightDockTab],
    brandLabel: "전황 덱",
  });
  if (!dock) return;
  dock.querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      if (session?.started) return; // stage-rail is locked to the live stage once a run is committed
      selectedStageId = button.dataset.stage;
      session?.remountForStage(selectedStageId);
      renderShell();
    });
  });
  dock.querySelector("#export-defense")?.addEventListener("click", async () => {
    const text = await storage.exportText();
    if (!text) {
      statusText = "내보낼 유효한 기록이 없습니다.";
      renderShell();
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "abyssal-defense-record.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  dock.querySelector("#export-telemetry")?.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([telemetry.exportJson()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "abyssal-defense-telemetry.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  dock.querySelector("#import-defense")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    const text = file ? await file.text() : "";
    if (!text || !(await storage.importText(text))) {
      statusText = "기록 형식을 확인할 수 없습니다.";
      renderShell();
      return;
    }
    campaign = (await storage.load()) ?? campaign;
    selectedStageId = STAGES[campaign.unlockedStageIndex].id;
    statusText = "기록을 가져왔습니다.";
    session?.remountForStage(selectedStageId);
    renderShell();
  });
  dock.querySelector("#reset-defense")?.addEventListener("click", async () => {
    if (session?.started) return;
    await storage.clear();
    campaign = createCampaign({ resetEpoch: campaign.resetEpoch + 1 });
    selectedStageId = STAGES[0].id;
    await persistCampaign("새 기록을 시작했습니다.");
    session?.remountForStage(selectedStageId);
    renderShell();
  });
}

/** SortieFab (component-contracts.md §3.3): persistent floating action button, NOT inside
 * any dock -- the single most important pre-run action stays reachable regardless of dock
 * state. Removed from the DOM (not just hidden) once session.started, mirroring today's
 * ternary swap for the CTA. id UNCHANGED ("#start-defense") -- required by the project's
 * existing browser contracts. */
function renderSortieFab() {
  if (!campaign) return;
  const existing = root.querySelector("#start-defense");
  if (session?.started) {
    existing?.remove();
    return;
  }
  const selected = stageFor(selectedStageId);
  const label = `${escapeHtml(selected.name)} · ${escapeHtml(selected.bossName)} 전선으로`;
  if (existing) {
    existing.innerHTML = `<span>작전 개시</span><small>${label}</small><b aria-hidden="true">↗</b>`;
    return;
  }
  const button = document.createElement("button");
  button.id = "start-defense";
  button.className = "sortie-fab";
  button.innerHTML = `<span>작전 개시</span><small>${label}</small><b aria-hidden="true">↗</b>`;
  button.addEventListener("click", () => {
    spawnSortieBurst(button);
    session?.beginRun();
    dockOpen = { left: false, right: false };
    renderShell();
  });
  root.append(button);
}

/** IdleReturnToast (component-contracts.md §3.4): mounted ONCE at mountShell() time, only
 * if idleReturnReceipt is present (i.e. settleIdleReturn() actually ran and reported back)
 * -- a one-time "welcome back" notice, not persistent-progression UI. Self-removes on
 * manual dismiss (click) or an 8s auto-timeout. The persisted recap lives inside the
 * stronghold dock tab instead (renderStrongholdTab()'s .idle-return-recap). */
function renderIdleReturnToast() {
  if (!idleReturnReceipt) return;
  const idleSummary = idleReturnSummary();
  const receipt = idleReturnReceipt;
  const toast = document.createElement("output");
  toast.id = "idle-return-toast";
  toast.className = "idle-return-toast rc-glass";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.dataset.idleReturnOutcome = idleSummary.outcome;
  toast.dataset.idleReturnTotal = String(idleSummary.total);
  const settledPayday = idleSummary.outcome === "SETTLED" && (receipt?.awardedProgress ?? 0) > 0;
  const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (settledPayday) {
    // Item 5 — one-shot "payday" count-up. The static `누적 ${total}` line is present
    // from first paint (keeps the public-contract textContent/total assertions holding
    // regardless of count-up progress); the gold +N counts 0→awardedProgress once via a
    // self-terminating rAF that clears itself (never a persistent loop).
    const awarded = receipt.awardedProgress;
    toast.classList.add("idle-return-payday");
    toast.innerHTML = `<p class="idle-payday-eyebrow">귀환 · 봉쇄선이 버텼습니다</p><p class="idle-payday-count" aria-live="polite"><b>+0</b></p><p class="idle-payday-total">누적 ${idleSummary.total}</p>`;
    const countNode = toast.querySelector(".idle-payday-count b");
    let raf = null;
    let done = false;
    const paint = (value) => { countNode.textContent = `+${value}`; };
    const finish = () => {
      done = true;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      paint(awarded);
      countNode.parentElement.classList.add("idle-payday-reveal");
    };
    if (reduceMotion) {
      paint(awarded); // G4 resting state: final number immediately, no count-up/rise
      done = true;
    } else {
      const DURATION = 600;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, Math.max(0, (now - start) / DURATION));
        paint(Math.round(t * awarded));
        if (t < 1) raf = requestAnimationFrame(step);
        else finish();
      };
      raf = requestAnimationFrame(step);
    }
    toast.addEventListener("click", () => {
      if (!done) { finish(); return; } // first tap skips to the final number
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      toast.remove();
    });
  } else {
    if (idleSummary.outcome === "ENCROACHED") toast.classList.add("idle-return-encroached");
    toast.innerHTML = `<p>${escapeHtml(idleSummary.text)}</p>`;
    toast.addEventListener("click", () => toast.remove());
  }
  root.append(toast);
  setTimeout(() => toast.remove(), 8000);
}

/** Top-level dispatcher: re-renders both docks and the sortie FAB. Called by every
 * dock/tab/campaign-mutation handler in place of the old single renderCommandShell(). The
 * idle-return toast is NOT re-rendered here -- it is a one-shot mount, see
 * renderIdleReturnToast()'s own doc comment. */
function renderShell() {
  renderDockLeft();
  renderDockRight();
  renderSortieFab();
}

/** Item 2 (presentation-spec, revised) — the two persistent currencies live INSIDE the
 * left (성장) dock rail as compact icon chips pinned to the bottom, below the tab icons,
 * instead of a floating top-left overlay (which overlapped the rail's own tab UI).
 * Amounts = earned−spent affordability balance the growth/inventory docks spend against
 * (wardenGrowthData parity). Each chip deep-links to where it is spent (EC→성장, BF→인벤토리).
 * Rendered into the freshly-rebuilt left rail by renderDockLeft(); collapses with the rail
 * when the left panel opens, and CSS-hidden once data-defense-started flips (yields to the
 * combat HUD / D-pad). */
function renderRailCurrency() {
  const railEl = root.querySelector("#command-dock-left .dock-rail");
  if (!railEl || !campaign) return;
  const ec = echoCoreEarned(campaign) - echoCoreSpent(campaign);
  const bf = boundFragmentEarned(campaign) - boundFragmentSpent(campaign);
  const group = document.createElement("div");
  group.className = "rail-currency";
  group.innerHTML = `
    <button type="button" class="rail-currency-chip rail-currency-ec" data-currency="echo-core" aria-label="에코 코어 ${ec} · 성장 열기"><span class="rail-currency-glyph" aria-hidden="true">◈</span><b class="rail-currency-amount">${ec}</b></button>
    <button type="button" class="rail-currency-chip rail-currency-bf" data-currency="bound-fragment" aria-label="속박 파편 ${bf} · 인벤토리 열기"><span class="rail-currency-glyph" aria-hidden="true">✦</span><b class="rail-currency-amount">${bf}</b></button>`;
  railEl.append(group);
  group.querySelector('[data-currency="echo-core"]').addEventListener("click", () => openLeftDockTab("growth"));
  group.querySelector('[data-currency="bound-fragment"]').addEventListener("click", () => openLeftDockTab("inventory"));
}

/** Currency-pill deep link: opens the left (성장) dock on the named tab, mirroring the
 * dock-rail tab-open behavior (compact tier force-closes the opposite dock). No-op mid-run
 * (the rail is CSS-hidden then anyway). */
function openLeftDockTab(tab) {
  if (session?.started) return;
  activeLeftDockTab = tab;
  dockOpen.left = true;
  if (dockTier === "compact") dockOpen.right = false;
  renderShell();
}

/** Item 6 (presentation-spec) — pooled screen-space particle burst on 작전 개시 press.
 * 5 of 6 recycled <span>s fly out on transform+opacity from the FAB centre then detach
 * back to the pool. Skipped entirely under reduced motion (G4). */
function spawnSortieBurst(button) {
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const rect = button.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  if (!sortieBurstPool) {
    sortieBurstPool = Array.from({ length: 6 }, () => {
      const span = document.createElement("span");
      span.className = "sortie-burst-particle";
      span.setAttribute("aria-hidden", "true");
      return span;
    });
  }
  const count = 5;
  for (let i = 0; i < count; i += 1) {
    const particle = sortieBurstPool[i];
    if (particle.isConnected) continue;
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const distance = 46 + (i % 2) * 14;
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    particle.style.setProperty("--burst-dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--burst-dy", `${Math.sin(angle) * distance}px`);
    particle.classList.remove("is-bursting");
    root.append(particle);
    void particle.offsetWidth; // restart the animation on a recycled node
    particle.classList.add("is-bursting");
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
  }
}

/** matchMedia('(min-width: 900px)') change listener (component-contracts.md §4
 * new_only row): recomputes dockTier and re-runs computeDefaultDockOpen() ONLY when the
 * tier actually flipped, so a resize within the same tier never clobbers a user's manual
 * open/close. Mid-run (session.started), a tier flip stays collapsed rather than
 * reopening -- the run-start force-collapse invariant outranks the tier default. */
function setupDockTierListener() {
  dockMediaQuery = globalThis.matchMedia?.("(min-width: 900px)") ?? null;
  dockMediaQuery?.addEventListener?.("change", () => {
    const nextTier = currentDockTier();
    if (nextTier === dockTier) return;
    dockTier = nextTier;
    dockOpen = session?.started ? { left: false, right: false } : computeDefaultDockOpen(dockTier);
    renderShell();
  });
}


function requestBattleImmersion() {
  const fullscreen = document.documentElement.requestFullscreen?.().catch(() => undefined);
  Promise.resolve(fullscreen).finally(() => {
    globalThis.screen?.orientation?.lock?.("landscape").catch(() => undefined);
  });
}

/**
 * Idle-style side-dock shell (20260727-lobby-dock-redesign) bootstrap: mounts the ENTIRE
 * persistent DOM exactly once for the page's whole lifetime -- #defense-battle-surface
 * (canvas + world-hud-overlay + edge-hud, unchanged markup from the old beginSession()) as
 * the fixed-fullscreen base layer, plus #command-dock-left/#command-dock-right as the two
 * edge-anchored dock wrappers renderDockLeft()/renderDockRight() target. There is no
 * second `root.innerHTML =` swap anywhere else in this module -- "entering battle" is
 * BattleSession.beginRun() flipping `started`, not a screen transition.
 * `data-defense-ready="true"` is set immediately (the battle surface always exists now);
 * `data-defense-started` reflects whether a real run is ticking, set by beginRun() -- CI
 * browser contracts wait on the latter instead of a click transition.
 */
function mountShell(stageId) {
  document.body.style.overflow = "hidden";
  root.className = "";
  root.innerHTML = `
    <section id="defense-battle-surface" data-defense-ready="true" data-defense-started="false" data-defense-input-seq="0" data-defense-skill="" data-defense-move="IDLE" data-defense-state="active" data-stage-id="${escapeHtml(stageId)}" style="--stage-art: url('${stageArtPath(stageId)}')" aria-label="심연 방어 전장">
      <div class="battle-stage-art" aria-hidden="true"></div>
      <canvas id="defense-canvas" aria-label="방어 전장"></canvas>
      <div id="world-hud-overlay" aria-hidden="true"></div>
      <div id="defense-edge-hud">
        <div class="defense-edge defense-top">
          <div class="hud-panel hud-mission" data-stage-hud-context="current"><span class="hud-eyebrow">ABYSSAL COMMAND · SEAL ATLAS</span><strong id="battle-stage"></strong><span id="battle-domain"></span><span id="battle-terrain-context"></span><span id="battle-status" aria-live="polite"></span><div class="hud-xp" aria-hidden="true"><b id="battle-xp-label"></b><span class="hud-xp-track"><i id="battle-xp-fill"></i></span></div></div>
          <div class="hud-panel hud-loop-state" data-stage-hud-context="loop"><span class="hud-eyebrow">RUN STATE · AGENCY</span><strong id="battle-loop-phase" aria-live="polite"></strong><span id="battle-pressure-state"></span><span id="battle-growth-state"></span><span id="battle-formation-state"></span><span id="battle-extraction-state"></span></div>
          <div class="top-right-hud"><div class="objective-chip"><span class="objective-pulse" aria-hidden="true"></span><span><small>현재 명령</small><strong id="battle-objective"></strong></span></div><div class="hud-right-stack"><div class="hud-actions" id="skill-actions" aria-label="활성 스킬"></div><div class="hud-passives" id="passive-badges" aria-label="지속 특성"></div></div></div>
        </div>
        <output id="battle-event-feedback" class="battle-event-feedback" role="status" aria-live="polite" aria-atomic="true"></output>
        <div class="arena-callout" aria-hidden="true"><span>GATE CORE</span><i></i><span>전선을 유지하세요</span></div>
        <div class="defense-edge defense-bottom">
          <div class="hud-panel gate-panel"><div class="gate-panel-copy">${portraitMarkup(COMMANDER_MESH_ROOT, "DW", "gate-panel-portrait rc-portrait")}<span class="hud-eyebrow">COMMANDER / GATE INTEGRITY</span><div class="gate-panel-bars" aria-hidden="true"><span class="gate-panel-bar-track commander"><i id="battle-commander-bar-fill"></i></span><span class="gate-panel-bar-track gate"><i id="battle-gate-bar-fill"></i></span></div><strong id="battle-commander-integrity"></strong><strong id="battle-integrity"></strong><span id="battle-enemies"></span></div><div class="integrity-meter" aria-hidden="true"><i id="battle-integrity-fill"></i></div></div>
          <div class="one-thumb-controls" id="movement-actions" role="group" aria-label="한 손 이동 조작">
            <button type="button" data-move="N" aria-label="위로 이동">↑</button>
            <button type="button" data-move="W" aria-label="왼쪽으로 이동">←</button>
            <button type="button" data-move="IDLE" aria-label="이동 정지">●</button>
            <button type="button" data-move="E" aria-label="오른쪽으로 이동">→</button>
            <button type="button" data-move="S" aria-label="아래로 이동">↓</button>
          </div>
          <div class="hud-actions" id="battle-actions" aria-label="전투 행동"></div>
        </div>
      </div>
    </section>
    <div id="command-dock-left"></div>
    <div id="command-dock-right"></div>`;
  hydratePortraits(root);
  session = new BattleSession(stageId);
  session.start();
  dockTier = currentDockTier();
  dockOpen = computeDefaultDockOpen(dockTier);
  setupDockTierListener();
  renderShell();
  renderIdleReturnToast();
}

export class BattleSession {
  constructor(stageId) {
    this.stageId = stageId;
    this.surface = root.querySelector("#defense-battle-surface");
    this.canvas = root.querySelector("#defense-canvas");
    this.statusNode = root.querySelector("#battle-status");
    this.run = this.createRunForStage(stageId);
    this.motionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    // Unified shell (D9, production/decision-log.md): the run does NOT tick at
    // construction -- `started` gates loop()'s advanceDefenseRun() call and every
    // combat-only control surface (D-pad, pause, skill bar, objective chip, extraction).
    // Before commit (started===false) this.run sits frozen at its real tick-0 state
    // (terrain, commander, gate, any pre-placed companions) rendered through the exact
    // same renderSnapshot() path as a live run -- not a fake preview image. beginRun()
    // is the ONLY place this flips true and calls campaign-state.js startRun()
    // (attemptsByStage) -- pre-commit stage switching must never record an attempt.
    this.started = false;

    this.renderer = null;
    this.audio = new DefenseAudio();
    this.audioTick = null;
    this.audioEventKeys = new Set();
    this.frame = 0;
    this.lastFrameAt = 0;
    this.accumulator = 0;
    this.inputSeq = 0;
    // this.pointer tracks the single active orbit-drag pointer (last known
    // logical position, for incremental deltas); this.pinch tracks a
    // two-finger zoom gesture once a second pointer joins.
    this.pointer = null;
    this.pinch = null;
    this.activePointers = new Map();
    this.controlPointerId = null;
    this.feedbackTick = null;
    this.feedbackEventKeys = new Set();
    this.heldKeys = new Set();
    this.listenerCount = 0;
    this.extractionEvents = [];
    this.terminalHandled = false;
    this.rewardPrompted = false;
    this.selectedRewardId = null;
    this.userPaused = false;
    this.bindStartPending = false;
    this.cutsceneEventKeys = new Set();
    this.cutsceneTimer = null;
    this.cutsceneRelayTimers = [];
    this.cutsceneQueue = [];
    this.stopped = false;
    this.camera = { x: 0, y: 0 };
    this.focusBeforeGrowth = null;
    // Pause overlay (D5, Option A): a read-only glance at stats/inventory/
    // companions, only ever shown while userPaused===true (no real-time
    // threat exists to hide, so the "no central panel" rule's intent holds).
    this.pauseOverlaySegment = "stats";
    this.focusBeforePause = null;
    // Non-blocking edge-card toasts (level-up on victory, reward-tier gain on
    // stage clear, boss-rally-window notice) — reuse the existing .edge-card
    // pattern, auto-dismiss, never pause the sim themselves.
    this.toastTimer = null;
    this.rallyAcknowledgedBossIds = new Set();
    // §2-a stance-switch soft-block shake feedback (see render()'s
    // STANCE_SWITCH_BLOCKED scan) — lastStanceBlockEventId dedupes repeated
    // renders of the same blocked event; stanceShakeUntil is a wall-clock
    // deadline (performance.now()), never set at all under reduced-motion.
    this.lastStanceBlockEventId = null;
    this.stanceShakeUntil = 0;
    // §2.2 stance-switch success confirmation (mirror of the block feedback
    // above): lastStanceSwitchEventId dedupes repeated renders of the same
    // STANCE_SWITCHED event; stanceConfirmUntil is a wall-clock deadline.
    // Unlike the shake, this IS set under reduced-motion — the held glow is
    // not motion, so it remains a valid accessible success signal.
    this.lastStanceSwitchEventId = null;
    this.stanceConfirmUntil = 0;
    // World-space HUD (Track 3, DOM-overlay pattern — ui/lane-hud-layout.md
    // section 4, Option B): companion nameplates/health bars, elite capture
    // prompt, floating damage numbers, all positioned via
    // RealtimeBattle.projectEntityToScreen()/projectStaticPoint(). No-ops
    // when the Canvas2D fallback is active (worldToNDC returns null there);
    // the pure-shape anchors (self-marker, health rings) stay Canvas2D-only
    // per the existing battle-visualizer.js/battle-realtime-three.js
    // Canvas2D drawing code, unaffected by this DOM layer.
    this.worldHudDamageEventKeys = new Set();
    this.worldHudDamageTick = null;
    this.onResize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onMoveControlDown = this.onMoveControlDown.bind(this);
    this.onMoveControlEnd = this.onMoveControlEnd.bind(this);
    this.onMoveControlClick = this.onMoveControlClick.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onReducedMotion = (event) => {
      telemetry.recordReducedMotion(event.matches);
      if (event.matches) this.camera = { x: 0, y: 0 };
    };
    this.loop = this.loop.bind(this);
  }

  /** Builds a fresh tick-0 DefenseRun for `stageId` from the current campaign snapshot
   * (equipment/wardenProgress/loadout/formation) -- shared by the constructor and
   * remountForStage() so pre-commit stage switching and initial mount build identical
   * run shapes. Pure w.r.t. campaign/telemetry -- no attemptsByStage bump, no
   * telemetry.startRun()/recordFormationCommit() call; those are beginRun()'s job alone
   * (see this.started's doc comment on the constructor). */
  createRunForStage(stageId) {
    const seed = stableRunSeed(stageId);
    const equipTiers = (ownerId) => Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, equipmentTierIndexFor(campaign, ownerId, slot)]));
    const companionLoadout = selectedLoadout();
    return createDefenseRun({
      stageId,
      seed,
      companionLoadout,
      rewardIds: campaign.rewardIds ?? [],
      wardenProgress: campaign.wardenProgress,
      wardenEquipment: equipTiers("warden"),
      companionEquipment: Object.fromEntries(companionLoadout.map((id) => [id, equipTiers(id)])),
      formation: campaign.companionFormation,
    });
  }

  /** Rebuilds this.run for `stageId` and resets ALL per-run/per-session tracking state --
   * two callers, one behavior: (1) pre-commit stage-rail selection while !started (mirrors
   * what the constructor does for the initial stage), and (2) resolveTerminal()'s
   * result-action/lobby-action handlers returning a FINISHED run to a fresh preview
   * (explicitly resets started=false here -- there is no third caller, so this is always
   * either "not started yet" or "just finished", never mid-run). Never touches campaign
   * or telemetry -- see beginRun()'s doc comment for why those live there alone. */
  remountForStage(stageId) {
    this.started = false;
    document.documentElement.dataset.defenseStarted = "false";
    this.stageId = stageId;
    this.surface.dataset.stageId = stageId;
    this.surface.dataset.defenseStarted = "false";
    this.surface.style.setProperty("--stage-art", `url("${stageArtPath(stageId)}")`);
    this.run = this.createRunForStage(stageId);
    this.extractionEvents = [];
    this.terminalHandled = false;
    this.rewardPrompted = false;
    this.selectedRewardId = null;
    this.bindStartPending = false;
    this.cutsceneEventKeys.clear();
    this.cutsceneRelayTimers.forEach((timer) => clearTimeout(timer));
    this.cutsceneRelayTimers = [];
    this.cutsceneQueue = [];
    this.dismissCutscene();
    this.rallyAcknowledgedBossIds = new Set();
    this.accumulator = 0;
    this.resetCamera();
    this.surface.querySelectorAll(".edge-card").forEach((card) => card.remove());
    this.render();
  }

  /** Player-committed start (the ONLY place this.started flips true): records the real
   * campaign attempt (attemptsByStage), starts telemetry/formation-commit tracking,
   * requests fullscreen/landscape (must run inside this click handler's user-gesture
   * stack), and lets loop() begin ticking this.run from its current tick-0 state -- the
   * exact scene the player was just previewing, not a fresh remount, so there is no
   * visible reset/flash. */
  beginRun() {
    if (this.started) return;
    campaign = startRun(campaign, this.stageId);
    void persistCampaign("출전 기록을 저장했습니다.");
    requestBattleImmersion();
    const seed = stableRunSeed(this.stageId);
    telemetry.startRun({ stageId: this.stageId, seed, rulesVersion: RULES_VERSION, reducedMotion: this.motionQuery?.matches ?? false });
    const openingSnapshot = getRunSnapshot(this.run);
    telemetry.recordFormationCommit({
      formationStance: openingSnapshot.formationStance,
      savedIntent: Object.fromEntries(selectedLoadout().map((id) => [id, campaign.companionFormation[id] || "BACK"])),
      resolvedCompanionRows: openingSnapshot.companions.map((companion, index) => ({
        positionRank: index + 1,
        companionId: companion.companionId,
        slot: companion.slot,
      })),
    });
    this.started = true;
    this.accumulator = 0;
    this.lastFrameAt = 0;
    document.documentElement.dataset.defenseStarted = "true";
    this.surface.dataset.defenseStarted = "true";
    this.render();
  }

  start() {
    viewport.start();
    this.audio.start();
    this.resize();
    try {
      this.renderer = new RealtimeBattle().mount({ canvas: this.canvas, viewport: this.canvas });
    } catch {
      this.renderer = new BattleVisualizer().mount({ canvas: this.canvas, viewport: this.canvas });
    }
    this.updateRendererModeAttribute();
    this.listen(this.canvas, "pointerdown", this.onPointerDown);
    this.listen(this.canvas, "pointermove", this.onPointerMove);
    this.listen(this.canvas, "pointerup", this.onPointerEnd);
    this.listen(this.canvas, "pointercancel", this.onPointerEnd);
    this.listen(this.canvas, "lostpointercapture", this.onPointerEnd);
    this.movementControls = root.querySelector("#movement-actions");
    this.listen(this.movementControls, "pointerdown", this.onMoveControlDown);
    this.listen(this.movementControls, "pointerup", this.onMoveControlEnd);
    this.listen(this.movementControls, "pointercancel", this.onMoveControlEnd);
    this.listen(this.movementControls, "lostpointercapture", this.onMoveControlEnd);
    this.listen(this.movementControls, "click", this.onMoveControlClick);
    this.listen(window, "blur", this.onWindowBlur);
    this.listen(document, "visibilitychange", this.onVisibility);
    this.listen(window, "keydown", this.onKey);
    this.listen(window, "keyup", this.onKey);
    this.listen(window, "resize", this.onResize);
    this.listen(window, "abyssal:defense-viewportchange", this.onResize);
    if (this.motionQuery) this.listen(this.motionQuery, "change", this.onReducedMotion);
    this.render();
    this.maybeShowCameraHint();
    this.frame = requestAnimationFrame(this.loop);
  }

  listen(target, type, handler) {
    target.addEventListener(type, handler);
    this.listenerCount += 1;
  }

  unlisten(target, type, handler) {
    target.removeEventListener(type, handler);
    this.listenerCount = Math.max(0, this.listenerCount - 1);
  }

  resize() {
    const style = getComputedStyle(document.documentElement);
    const logicalWidth = parseFloat(style.getPropertyValue("--defense-logical-width"));
    const logicalHeight = parseFloat(style.getPropertyValue("--defense-logical-height"));
    const rect = this.canvas.getBoundingClientRect();
    const width = logicalWidth || rect.width;
    const height = logicalHeight || rect.height;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(width * ratio));
    this.canvas.height = Math.max(1, Math.round(height * ratio));
    this.resetCamera();
  }

  resetCamera() {
    this.camera = { x: 0, y: 0 };
  }

  updateCamera(commander) {
    const width = Math.max(1, this.canvas?.width ?? 1);
    const height = Math.max(1, this.canvas?.height ?? 1);
    const x = Number.isFinite(commander?.x) ? commander.x : 0;
    const y = Number.isFinite(commander?.y) ? commander.y : 0;
    const target = {
      x: Math.max(-width * CAMERA_FOLLOW_X_LIMIT, Math.min(width * CAMERA_FOLLOW_X_LIMIT, -x * width / 2)),
      y: Math.max(-height * CAMERA_FOLLOW_Y_LIMIT, Math.min(height * CAMERA_FOLLOW_Y_LIMIT, -y * height / 2)),
    };
    if (this.motionQuery?.matches) {
      this.camera = target;
      return target;
    }
    this.camera = {
      x: this.camera.x + (target.x - this.camera.x) * CAMERA_FOLLOW_EASING,
      y: this.camera.y + (target.y - this.camera.y) * CAMERA_FOLLOW_EASING,
    };
    return this.camera;
  }

  logicalPoint(event) {
    return viewport.mapPhysicalToLogical({ clientX: event.clientX, clientY: event.clientY });
  }

  centralRegionContains(point) {
    const width = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--defense-logical-width")) || innerWidth;
    const height = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--defense-logical-height")) || innerHeight;
    return point.x >= width * 0.08 && point.x <= width * 0.92 && point.y >= height * 0.14 && point.y <= height * 0.86;
  }

  // Canvas pointer input now drives the free camera (Cycle 3 / D17), never
  // movement: one-finger drag orbits (yaw/pitch), two-finger pinch zooms.
  // Movement input is exclusively #movement-actions (D-pad) and keyboard —
  // both fully independent of the canvas, so no movement capability is lost.
  onPointerDown(event) {
    const point = this.logicalPoint(event);
    if (!this.centralRegionContains(point)) return;
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);
    this.activePointers.set(event.pointerId, point);
    if (this.activePointers.size === 1) {
      this.pointer = { id: event.pointerId, x: point.x, y: point.y };
      this.pinch = null;
    } else if (this.activePointers.size === 2) {
      this.pointer = null;
      this.pinch = { distance: this.pinchDistance() };
    }
  }

  pinchDistance() {
    const points = [...this.activePointers.values()];
    if (points.length !== 2) return 0;
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }

  onPointerMove(event) {
    if (!this.activePointers.has(event.pointerId)) return;
    const point = this.logicalPoint(event);
    this.activePointers.set(event.pointerId, point);
    if (this.pinch) {
      const distance = this.pinchDistance();
      const deltaDistance = distance - this.pinch.distance;
      this.pinch.distance = distance;
      this.dismissCameraHint();
      if (this.renderer?.zoom?.(-deltaDistance * CAMERA_PINCH_ZOOM_SENSITIVITY)) this.signalCameraClamp();
      return;
    }
    if (this.pointer?.id !== event.pointerId) return;
    const dx = point.x - this.pointer.x;
    const dy = point.y - this.pointer.y;
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.dismissCameraHint();
    if (this.renderer?.orbit?.(dx * CAMERA_ORBIT_YAW_SENSITIVITY, -dy * CAMERA_ORBIT_PITCH_SENSITIVITY)) this.signalCameraClamp();
  }

  // Plays the short low-volume boundary tick when a drag/pinch pushes
  // against an already-saturated pitch/zoom clamp (control-feel-
  // 20260725.md §3.3/§3.5). Pure renderer-side side channel: the
  // simulation never sees this, so getRunDigest determinism is untouched.
  // The cue's own 0.15s refractory (defense-audio.js) stops a continuous
  // push into the wall from buzzing -- no app-side throttle needed. Audio
  // is orthogonal to prefers-reduced-motion, so no motion-query branch:
  // the tick is intentionally the one boundary signal that survives
  // reduced-motion (§3.3 chose audio-only precisely for that reason).
  signalCameraClamp() {
    this.audio?.play?.("camera-clamp");
  }

  onPointerEnd(event) {
    if (!this.activePointers.has(event.pointerId)) return;
    if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.activePointers.delete(event.pointerId);
    this.pinch = null;
    if (this.activePointers.size === 1) {
      const [[id, point]] = this.activePointers;
      this.pointer = { id, x: point.x, y: point.y };
    } else {
      this.pointer = null;
    }
  }

  onMoveControlDown(event) {
    const button = event.target.closest?.("[data-move]");
    if (!button || this.controlPointerId !== null) return;
    event.preventDefault();
    this.controlPointerId = event.pointerId;
    button.setPointerCapture?.(event.pointerId);
    this.send("MOVE", button.dataset.move);
  }

  onMoveControlEnd(event) {
    if (event.pointerId !== this.controlPointerId) return;
    const button = event.target.closest?.("[data-move]");
    if (button?.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
    this.controlPointerId = null;
    this.send("MOVE", "IDLE");
  }

  onMoveControlClick(event) {
    if (event.detail !== 0) return;
    const button = event.target.closest?.("[data-move]");
    if (button) this.send("MOVE", button.dataset.move);
  }

  onWindowBlur() {
    this.controlPointerId = null;
    this.heldKeys.clear();
    this.pointer = null;
    this.pinch = null;
    this.activePointers.clear();
    this.send("MOVE", "IDLE");
  }

  onVisibility() {
    if (!document.hidden) return;
    this.accumulator = 0;
    this.lastFrameAt = 0;
    this.onWindowBlur();
  }

  onKey(event) {
    const key = event.key.toLowerCase();
    if (!KEY_DIRECTIONS[key]) return;
    event.preventDefault();
    if (event.type === "keydown") this.heldKeys.add(key);
    else this.heldKeys.delete(key);
    const directions = [...this.heldKeys].map((entry) => KEY_DIRECTIONS[entry]);
    const vertical = directions.includes("N") ? -1 : directions.includes("S") ? 1 : 0;
    const horizontal = directions.includes("W") ? -1 : directions.includes("E") ? 1 : 0;
    this.send("MOVE", DIRECTION_BY_VECTOR[`${horizontal},${vertical}`]);
  }

  send(type, payload) {
    if (this.stopped || (isTerminalRun(this.run) && type !== "REWARD_SELECTED")) return;
    const inputAt = performance.now();
    this.run = queueInput(this.run, type, payload);
    const inputSeq = ++this.inputSeq;
    this.surface.dataset.defenseInputSeq = String(inputSeq);
    if (type === "MOVE") this.surface.dataset.defenseMove = payload;
    if (type === "SKILL_CAST" || type === "SKILL_SELECTED" || type === "REWARD_SELECTED") {
      this.surface.dataset.defenseSkill = payload?.skillId ?? payload?.rewardId ?? payload ?? "";
    }
    this.renderer?.onVisualFeedback?.(inputSeq);
    const visibleAt = performance.now();
    telemetry.recordInputFeedback({ inputSeq, type, inputAtMs: inputAt, visibleAtMs: visibleAt, tick: this.run.tick });
    window.dispatchEvent(new CustomEvent("abyssal:defense-input-feedback", {
      detail: { inputSeq, type, admittedAt: inputAt, displayedAt: visibleAt, tick: this.run.tick },
    }));
  }

  loop(frameNow) {
    if (this.stopped) return;
    if (!this.lastFrameAt) this.lastFrameAt = frameNow;
    const frameDuration = Math.max(0, frameNow - this.lastFrameAt);
    const elapsed = Math.min(100, frameDuration);
    this.lastFrameAt = frameNow;
    // BUGFIX (found investigating a CI-only flaky floating-damage-number test):
    // tick() (defense-run-simulation.js) does `run.events = []` at its very
    // first line -- a full reset, not an append. On a slow device/CI runner
    // where a single requestAnimationFrame interval exceeds several STEP_MS
    // budgets, this catch-up loop calls advanceDefenseRun(this.run, 1)
    // (i.e. exactly one real 60Hz tick) multiple times per rendered frame,
    // and each call's tick() clobbers .events from the PREVIOUS call in this
    // same burst -- only the LAST real tick's events ever reached render().
    // Harmless for state-derived UI (nameplates, health bars) but silently
    // dropped every event-derived consumer's events from all-but-the-last
    // tick whenever frames run behind: audio cues, event-feedback text,
    // cutscene triggers, and world-HUD floating damage numbers. Each real
    // tick runs exactly once per advanceDefenseRun(this.run, 1) call (steps=1
    // guarantees at most one tick() invocation), so this.run.events
    // immediately after each call is exactly that one tick's events --
    // collecting them here recovers every tick's events for this frame.
    const frameEvents = [];
    if (this.started && !document.hidden && !this.userPaused && !isTerminalRun(this.run)) {
      this.accumulator += elapsed;
      while (this.accumulator >= STEP_MS) {
        this.run = advanceDefenseRun(this.run, 1);
        frameEvents.push(...this.run.events);
        this.accumulator -= STEP_MS;
      }
    } else {
      this.accumulator = 0;
    }
    this.render(frameEvents);
    telemetry.recordFrameProbe({
      frameDurationMs: frameDuration,
      heapUsedBytes: globalThis.performance?.memory?.usedJSHeapSize,
      atMs: frameNow,
    });
    this.frame = requestAnimationFrame(this.loop);
  }

  projected(snapshot) {
    const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const presentationRadius = (actor) => {
      if (actor.id === "gate") return 30;
      if (actor.id === "commander") return 11 * VISUAL_ACTOR_SCALE;
      if (actor.class === "boss") return 25 * VISUAL_ACTOR_SCALE;
      if (actor.elite) return 14 * VISUAL_ACTOR_SCALE;
      if (actor.kind === "companion") return 9;
      if (actor.kind === "projectile") return 3;
      if (actor.kind === "pickup") return 5;
      return 8 * VISUAL_ACTOR_SCALE;
    };
    const project = (actor) => ({
      ...actor,
      x: actor.x / ARENA.width * 2 - 1,
      y: actor.y / ARENA.height * 2 - 1,
      radius: presentationRadius(actor) * pixelRatio,
      normalized: true,
    });
    const presentation = Object.freeze({
      stageId: this.stageId,
      visualScale: VISUAL_ACTOR_SCALE,
      stagePresentation: stagePresentationFor(this.stageId),
      terrain: stageTerrainProjection(this.stageId),
    });
    return {
      ...snapshot,
      presentation,
      gate: project(snapshot.gate),
      commander: project(snapshot.commander),
      enemies: snapshot.enemies.map(project),
      projectiles: snapshot.projectiles.map(project),
      pickups: snapshot.pickups.map(project),
      companions: snapshot.companions.map(project),
    };
  }

  recordExtraction(snapshot) {
    for (const event of snapshot.events) {
      if (event.type !== "ELITE_EXTRACTED") continue;
      this.extractionEvents.push({ eventId: event.eventId, eliteId: event.eliteId, prototype: event.prototype });
    }
  }

  dismissCutscene() {
    if (this.cutsceneTimer !== null) {
      clearTimeout(this.cutsceneTimer);
      this.cutsceneTimer = null;
    }
    this.cutsceneRelayTimers.forEach((timer) => clearTimeout(timer));
    this.cutsceneRelayTimers = [];
    this.surface?.querySelector("#defense-cutscene-overlay")?.remove();
    if (this.surface) delete this.surface.dataset.defenseCutscene;
    const nextEntry = this.cutsceneQueue.shift();
    if (nextEntry && !this.stopped) this.showCutscene(nextEntry.cutscene, nextEntry.event);
  }

  presentCutscene(event) {
    const cutscene = cutsceneFromEvent(event);
    const key = cutsceneEventKey(event);
    if (!cutscene || !key || this.cutsceneEventKeys.has(key)) return;
    this.cutsceneEventKeys.add(key);
    const entry = { cutscene, event };
    if (this.surface?.querySelector("#defense-cutscene-overlay")) {
      this.cutsceneQueue.push(entry);
      return;
    }
    this.showCutscene(cutscene, event);
  }

  showCutscene(cutscene, event = null) {
    const overlay = document.createElement("section");
    overlay.id = "defense-cutscene-overlay";
    overlay.className = "defense-cutscene";
    overlay.dataset.cutsceneEvent = cutscene.eventType;
    overlay.dataset.captionMode = cutscene.captionMode ?? "dialogue";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-atomic", "true");

    const frame = document.createElement("div");
    frame.className = "cutscene-frame";
    const heading = document.createElement("header");
    heading.className = "cutscene-heading";
    const kicker = document.createElement("span");
    kicker.className = "cutscene-kicker";
    kicker.textContent = cutscene.captionMode === "narration" ? "IN-SCENE CAPTION" : "CINEMATIC RELAY";
    const title = document.createElement("h2");
    title.textContent = cutscene.title;
    heading.append(kicker, title);

    const beatNode = document.createElement("div");
    beatNode.className = "cutscene-beat";
    const beats = cutscene.beats?.length
      ? cutscene.beats
      : cutscene.lines.map((text, index) => ({
        index,
        text,
        captionMode: cutscene.captionMode ?? "dialogue",
        relay: { sequence: index + 1, speaker: cutscene.captionMode === "narration" ? "narrator" : `speaker-${index % 2 === 0 ? "a" : "b"}` },
        timing: { startMs: index * 2400 },
      }));
    const speakerLabels = {
      narrator: "NARRATION",
      "speaker-a": "WARDEN CHANNEL",
      "speaker-b": "FARWATCH RELAY",
    };
    const renderBeat = (beat) => {
      beatNode.dataset.beat = String(beat.index);
      beatNode.dataset.speaker = beat.relay.speaker;
      const speaker = document.createElement("span");
      speaker.className = "cutscene-speaker";
      speaker.textContent = speakerLabels[beat.relay.speaker] ?? beat.relay.speaker;
      const copy = document.createElement("p");
      copy.className = "cutscene-line";
      copy.textContent = beat.text;
      const progress = document.createElement("span");
      progress.className = "cutscene-progress";
      progress.setAttribute("aria-hidden", "true");
      beats.forEach((_, index) => {
        const marker = document.createElement("i");
        if (index === beat.index) marker.className = "is-current";
        progress.append(marker);
      });
      beatNode.replaceChildren(speaker, copy, progress);
    };
    renderBeat(beats[0]);

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.dataset.cutsceneDismiss = "true";
    dismiss.textContent = "계속";
    dismiss.addEventListener("click", () => this.dismissCutscene());
    frame.append(heading, beatNode, dismiss);
    overlay.append(frame);
    this.surface.append(overlay);
    this.surface.dataset.defenseCutscene = cutscene.eventType;
    if (event && !this.stopped) this.audio?.consume?.([event]);
    beats.slice(1).forEach((beat) => {
      this.cutsceneRelayTimers.push(setTimeout(() => renderBeat(beat), beat.timing.startMs));
    });
    // Arm auto-dismiss only after this synchronous startup turn yields. A slow
    // WebGL mount must not consume the visible window before the battle can be
    // observed or interacted with.
    this.cutsceneTimer = setTimeout(() => {
      this.cutsceneTimer = setTimeout(
        () => this.dismissCutscene(),
        cutscene.timing?.dismissAfterMs ?? 8000,
      );
    }, 0);
  }

  consumeCutscenes(events) {
    events.forEach((event) => this.presentCutscene(event));
  }


  renderEventFeedback(snapshot) {
    if (this.feedbackTick !== snapshot.tick) {
      this.feedbackTick = snapshot.tick;
      this.feedbackEventKeys.clear();
    }
    const feedback = root.querySelector("#battle-event-feedback");
    const freshEvents = snapshot.events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => SNAPSHOT_FEEDBACK_TYPES.has(event.type))
      .filter(({ event, index }) => {
        const key = event.eventId ?? event.id ?? `${snapshot.tick}:${index}:${event.type}:${event.enemyId ?? event.targetId ?? ""}`;
        if (this.feedbackEventKeys.has(key)) return false;
        this.feedbackEventKeys.add(key);
        return true;
      });
    if (!freshEvents.length || !feedback) return;
    const feedbackTypes = new Set(freshEvents.map(({ event }) => event.type));
    feedback.dataset.feedback = [...feedbackTypes].map((type) => type === "CRITICAL_HIT" ? "critical" : "lore").join(" ");
    feedback.textContent = freshEvents.map(({ event }) => event.type === "CRITICAL_HIT"
      ? "CRIT · 치명타 확정"
      : event.text ?? event.message ?? event.summary ?? event.lore ?? "심연의 비밀이 해소되었습니다.").join(" · ");
    this.surface.dataset.defenseFeedback = feedback.dataset.feedback;
  }
  render(frameEvents = null) {
    const rawSnapshot = getRunSnapshot(this.run);
    // frameEvents (see loop()'s doc comment) carries every tick's events from
    // this render's catch-up burst, when more than one real tick ran since
    // the last frame; rawSnapshot.events alone would only ever contain the
    // LAST such tick's events. Falls back to rawSnapshot.events (a no-op
    // override, same array) when frameEvents is empty/absent -- e.g. this
    // frame ran zero ticks (paused/hidden/terminal) and every consumer should
    // keep seeing whatever the unchanged this.run.events already holds, same
    // as before this fix.
    const snapshot = frameEvents && frameEvents.length ? { ...rawSnapshot, events: frameEvents } : rawSnapshot;
    telemetry.recordSnapshot(snapshot);
    telemetry.recordSimulationEvents(snapshot.events);
    if (this.audioTick !== snapshot.tick) {
      this.audioTick = snapshot.tick;
      this.audioEventKeys.clear();
    }
    const newAudioEvents = snapshot.events.filter((event) => {
      if (cutsceneFromEvent(event)) return false;
      const key = `${event.type}:${event.enemyId ?? event.itemId ?? event.rewardId ?? ""}`;
      if (this.audioEventKeys.has(key)) return false;
      this.audioEventKeys.add(key);
      return true;
    });
    this.audio.consume(newAudioEvents);
    this.recordExtraction(snapshot);
    this.consumeCutscenes(snapshot.events);
    // Boss Rally Window (rpg-catalog.js BOSS_RALLY_COOLDOWN_REDUCTION) is an
    // automatic sim-driven effect at boss spawn — there is no player-input
    // path for it (queueInput only accepts MOVE/SKILL_CAST/SKILL_SELECTED/
    // GROWTH_OFFER_SELECTED/REWARD_SELECTED/EXTRACT_ELITE/M4/M3), so this is a
    // passive notification of an effect the sim already applied, never a
    // client-side "trigger" that would make the UI a second rules authority.
    const rallyEvent = snapshot.events.find((event) => event.type === "BOSS_RALLY_WINDOW" && !this.rallyAcknowledgedBossIds.has(event.bossId));
    if (rallyEvent) {
      this.rallyAcknowledgedBossIds.add(rallyEvent.bossId);
      const reductionPct = Math.round((rallyEvent.cooldownReductionBp ?? 0) / 100);
      this.showToast(`<h2>총공세 발동</h2><p>보스 등장 — 편성된 동료 쿨다운 ${reductionPct}% 감소</p>`, { className: "defense-toast-rally" });
    }
    // Stance-switch soft-block feedback (§2-a "소프트 블록 권장" — button
    // stays tappable during cooldown, a cooldown-rejected tap gets a brief
    // shake instead of a hard-disabled state). Passive notification of a
    // sim-emitted event, same pattern as the rally-window toast above —
    // never a client-side re-derivation of the cooldown gate itself.
    const blockedEvent = snapshot.events.find((event) => event.type === "STANCE_SWITCH_BLOCKED");
    if (blockedEvent && blockedEvent.eventId !== this.lastStanceBlockEventId) {
      this.lastStanceBlockEventId = blockedEvent.eventId;
      if (!this.motionQuery?.matches) this.stanceShakeUntil = performance.now() + STANCE_BLOCK_SHAKE_MS;
    }
    // §2.2 stance-switch SUCCESS confirmation — same passive sim-event scan as
    // the block feedback, applied to STANCE_SWITCHED. No reduced-motion guard:
    // the is-switched glow is a static highlight, not motion, so it stays on
    // as the accessible "switch confirmed" signal even when animations are off.
    const switchedEvent = snapshot.events.find((event) => event.type === "STANCE_SWITCHED");
    if (switchedEvent && switchedEvent.eventId !== this.lastStanceSwitchEventId) {
      this.lastStanceSwitchEventId = switchedEvent.eventId;
      this.stanceConfirmUntil = performance.now() + STANCE_SWITCH_CONFIRM_MS;
    }
    const projection = this.projected(snapshot);
    const camera = this.updateCamera(projection.commander);
    const frame = {
      viewport: this.canvas,
      portrait: document.documentElement.dataset.defensePortrait === "true",
      camera: Object.freeze({ x: camera.x, y: camera.y }),
    };
    try {
      this.renderer?.renderSnapshot(projection, frame);
    } catch {
      this.renderer?.dispose?.();
      this.renderer = new BattleVisualizer().mount({ canvas: this.canvas, viewport: this.canvas });
      this.renderer.renderSnapshot(projection, frame);
      this.updateRendererModeAttribute();
    }
    const stage = stageFor(this.stageId);
    const gateIntegrity = integrityProjection(snapshot.gate);
    const commanderIntegrity = integrityProjection(snapshot.commander);
    const presentation = stagePresentationFor(this.stageId);
    root.querySelector("#battle-stage").textContent = `${stage.sequence}. ${stage.name}`;
    root.querySelector("#battle-domain").textContent = `${presentation.mapLabels.title} · ${presentation.mapLabels.domain}`;
    root.querySelector("#battle-terrain-context").textContent = `${presentation.terrain.label} · ${presentation.mapLabels.hazard} · ${presentation.mapLabels.occupation} → ${presentation.mapLabels.extraction}`;
    this.surface.dataset.stageId = this.stageId;
    this.surface.dataset.terrainPattern = presentation.terrain.patternId;
    this.surface.dataset.visualScale = String(VISUAL_ACTOR_SCALE);
    this.surface.dataset.defenseState = this.userPaused
      ? "paused"
      : snapshot.terminal
        ? snapshot.terminal.toLowerCase()
        : snapshot.growthOffer
          ? "growth"
          : snapshot.rewardOffer
            ? "reward"
            : snapshot.tick < TICK_RATE * 3
              ? "starting"
              : "active";
    this.statusNode.textContent = this.userPaused
      ? "사용자 일시 정지"
      : snapshot.growthOffer
        ? "성장 선택 중 · 전투 정지"
        : snapshot.rewardOffer
          ? "보상 선택 중 · 기록 대기"
          : snapshot.terminal
            ? "전투 종료"
            : `시간 ${Math.floor(snapshot.tick / TICK_RATE)}초 · Lv.${snapshot.commander.level}`;
    root.querySelector("#battle-objective").textContent = presentation.mapLabels.objective;
    const loopState = loopPresentation(snapshot, { userPaused: this.userPaused });
    root.querySelector("#battle-loop-phase").textContent = loopState.phaseLabel;
    root.querySelector("#battle-pressure-state").textContent = loopState.pressureLabel;
    root.querySelector("#battle-growth-state").textContent = loopState.growthLabel;
    root.querySelector("#battle-formation-state").textContent = loopState.formationLabel;
    root.querySelector("#battle-extraction-state").textContent = loopState.extractionLabel;
    this.surface.dataset.objectivePhase = snapshot.objectives?.phase ?? "unknown";
    this.surface.dataset.extractionState = snapshot.extracted ? "extracted" : snapshot.extractionProgress?.failed ? "failed" : snapshot.extractionProgress?.completed ? "ready" : "pending";
    // In-run XP-to-next-level progress (IA: the core RPG growth decision was
    // previously invisible mid-combat — only "Lv.N" text, no progress toward
    // the next skill/growth offer). Cost mirrors the simulation's own level-up
    // threshold exactly (defense-run-simulation.js:641/1689) so the bar fills
    // precisely to the moment the growth offer fires. Pure client render off
    // snapshot.commander — no simulation state touched, getRunDigest unaffected.
    const xpCost = XP_GROWTH[snapshot.commander.level - 1] || XP_GROWTH.at(-1);
    const xpRatio = xpCost > 0 ? Math.max(0, Math.min(1, snapshot.commander.xp / xpCost)) : 0;
    root.querySelector("#battle-xp-fill").style.width = `${xpRatio * 100}%`;
    root.querySelector("#battle-xp-label").textContent = `Lv.${snapshot.commander.level} · ${snapshot.commander.xp}/${xpCost}`;
    const commanderNode = root.querySelector("#battle-commander-integrity");
    commanderNode.textContent = `지휘관 내구 ${commanderIntegrity.integrity}/${commanderIntegrity.maxIntegrity} · ${commanderIntegrity.state}`;
    commanderNode.dataset.integrityState = commanderIntegrity.state;
    commanderNode.dataset.integrityCurrent = String(commanderIntegrity.integrity);
    commanderNode.dataset.integrityMax = String(commanderIntegrity.maxIntegrity);
    const gateNode = root.querySelector("#battle-integrity");
    gateNode.textContent = `관문 내구 ${gateIntegrity.integrity}/${gateIntegrity.maxIntegrity} · ${gateIntegrity.state}`;
    gateNode.dataset.integrityState = gateIntegrity.state;
    gateNode.dataset.integrityCurrent = String(gateIntegrity.integrity);
    gateNode.dataset.integrityMax = String(gateIntegrity.maxIntegrity);
    this.surface.dataset.commanderIntegrity = commanderIntegrity.state;
    this.surface.dataset.gateIntegrity = gateIntegrity.state;
    root.querySelector("#battle-integrity-fill").style.width = `${gateIntegrity.ratio * 100}%`;
    root.querySelector("#battle-commander-bar-fill").style.width = `${commanderIntegrity.ratio * 100}%`;
    root.querySelector("#battle-gate-bar-fill").style.width = `${gateIntegrity.ratio * 100}%`;
    root.querySelector("#battle-enemies").textContent = `적 ${snapshot.enemies.length} · 처치 ${snapshot.progress.defeated} · 아이템 ${snapshot.progress.itemsCollected}`;
    if (this.started) {
      this.renderControls(snapshot);
      this.renderPauseOverlay(snapshot);
      if (snapshot.terminal && !this.terminalHandled) void this.resolveTerminal(snapshot);
      this.renderEventFeedback(snapshot);
    }
    this.renderWorldHud(snapshot);
  }

  /**
   * World-space HUD text/interactive anchors (companion nameplates+health
   * bars, elite capture prompt, floating damage numbers) — DOM overlay,
   * updated every frame via RealtimeBattle's NDC projection. A no-op when
   * the Canvas2D fallback is active (projection methods return null there),
   * which is correct: those pure Canvas2D adapters have no 3D camera to
   * project through, and this DOM layer is additive presentation only.
   */
  renderWorldHud(snapshot) {
    const overlay = root.querySelector("#world-hud-overlay");
    if (!overlay) return;
    const width = Math.max(1, this.canvas?.clientWidth ?? 1);
    const height = Math.max(1, this.canvas?.clientHeight ?? 1);
    const toScreen = (ndc) => ({ x: (ndc.x + 1) / 2 * width, y: (1 - ndc.y) / 2 * height });

    // Offscreen objective waypoint arrow (screen #17, hybrid world->screen
    // clamp) — the camera-follow view frequently has the gate (this stage's
    // sole "next objective" beacon, per the gate marker's world-space ring)
    // outside the viewport; a fixed camera-relative arrow is standard topdown-
    // ARPG practice for keeping an always-relevant objective locatable. Ground
    // point normalized the same way updateExtractionRing's world-space twin
    // does (this field isn't in app.js's own projected() normalization pass).
    let waypointArrow = overlay.querySelector(".world-waypoint-arrow");
    const gate = snapshot.gate;
    if (gate && this.renderer?.projectStaticPoint) {
      const normalizedX = gate.x / ARENA.width * 2 - 1;
      const normalizedY = gate.y / ARENA.height * 2 - 1;
      const ndc = this.renderer.projectStaticPoint(normalizedX, normalizedY);
      if (ndc && !ndc.visible) {
        // Behind-camera points have no meaningful screen direction (worldToNDC
        // intentionally returns null there, see its docstring) - only an
        // in-front-but-outside-frustum point can be clamped to an edge arrow.
        const raw = toScreen(ndc);
        const centerX = width / 2;
        const centerY = height / 2;
        const dx = raw.x - centerX;
        const dy = raw.y - centerY;
        const halfW = width / 2 - WORLD_WAYPOINT_EDGE_MARGIN_PX;
        const halfH = height / 2 - WORLD_WAYPOINT_EDGE_MARGIN_PX;
        const scale = Math.min(halfW / Math.max(Math.abs(dx), 1e-6), halfH / Math.max(Math.abs(dy), 1e-6));
        const clampedX = centerX + dx * Math.min(1, scale);
        const clampedY = centerY + dy * Math.min(1, scale);
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // +90: glyph points "up" at angle 0
        if (!waypointArrow) {
          waypointArrow = document.createElement("div");
          waypointArrow.className = "world-waypoint-arrow";
          waypointArrow.textContent = "▲";
          waypointArrow.setAttribute("aria-hidden", "true");
          overlay.append(waypointArrow);
        }
        waypointArrow.style.transform = "translate(" + clampedX + "px, " + clampedY + "px) translate(-50%, -50%) rotate(" + angleDeg + "deg)";
      } else {
        waypointArrow?.remove();
      }
    } else {
      waypointArrow?.remove();
    }


    // Companion nameplates + health bars (screen #11) — capped at the
    // existing MAX_LOADOUT_SIZE=3 loadout precedent, so no separate cap is
    // needed (there are never more than 3 companions to plate). Projects
    // the companion's GROUND anchor (see projectEntityToScreen() doc) and
    // floats the plate above it with a fixed screen-space pixel offset
    // (WORLD_NAMEPLATE_LIFT_PX) — zoom-varying by design, but never
    // decides visibility, unlike a world-unit height offset would.
    const nameplateAnchors = new Map();
    for (const companion of snapshot.companions ?? []) {
      const ndc = this.renderer?.projectEntityToScreen?.(companion.id);
      if (!ndc?.visible) continue;
      const point = toScreen(ndc);
      const ratio = Math.max(0, Math.min(1, (companion.hp ?? 0) / Math.max(1, companion.maxHp ?? 1)));
      let node = overlay.querySelector('[data-world-nameplate="' + companion.id + '"]');
      if (!node) {
        node = document.createElement("div");
        node.className = "world-nameplate world-hud-nameplate--companion";
        node.dataset.worldNameplate = companion.id;
        node.innerHTML = "<strong></strong><span class=\"world-nameplate-bar\"><i></i></span>";
        overlay.append(node);
      }
      node.classList.toggle("is-downed", companion.status === "DOWNED");
      node.querySelector("strong").textContent = companionLabel(companion.companionId);
      node.querySelector("i").style.width = (ratio * 100) + "%";
      node.style.transform = "translate(" + point.x + "px, " + (point.y - WORLD_NAMEPLATE_LIFT_PX) + "px) translate(-50%, -100%)";
      nameplateAnchors.set(companion.id, node);
    }
    overlay.querySelectorAll("[data-world-nameplate]").forEach((node) => {
      if (!nameplateAnchors.has(node.dataset.worldNameplate)) node.remove();
    });

    // Elite capture prompt (screen #15) — anchored at the stage's fixed
    // extraction zone (STAGE_TACTICS[stageId].extraction), not the
    // defeated-elite corpse: defense-run-simulation.js removes dead enemies
    // from run.enemies immediately, so eliteCandidate carries no live
    // position — the actual mechanic is "carry the echo to the extraction
    // zone", which is what this prompt correctly reflects. Same ground-anchor
    // + screen-space-lift pattern as the nameplate above.
    let capturePrompt = overlay.querySelector(".world-capture-prompt");
    const extraction = snapshot.tactics?.extraction;
    const extractionReady = Boolean(snapshot.extractionProgress?.completed && snapshot.extractionProgress?.ready !== false);
    if (snapshot.eliteCandidate && !snapshot.extracted && extraction) {
      const normalizedX = extraction.x / ARENA.width * 2 - 1;
      const normalizedY = extraction.y / ARENA.height * 2 - 1;
      const ndc = this.renderer?.projectStaticPoint?.(normalizedX, normalizedY);
      if (ndc?.visible) {
        const point = toScreen(ndc);
        if (!capturePrompt) {
          capturePrompt = document.createElement("div");
          capturePrompt.className = "world-capture-prompt";
          overlay.append(capturePrompt);
        }
        const extractionProgress = snapshot.extractionProgress ?? {};
        const holdSeconds = Math.floor((extractionProgress.holdTicks ?? 0) / TICK_RATE);
        const maxHoldSeconds = Math.ceil((extractionProgress.maxHoldTicks ?? 0) / TICK_RATE);
        const holding = Boolean(snapshot.commander?.objectiveRoute)
          && extractionProgress.availableAt !== null
          && extractionProgress.availableAt !== undefined;
        capturePrompt.textContent = extractionProgress.failed
          ? "추출 실패 · 재출정"
          : extractionReady
            ? "추출 가능 · " + companionLabel(snapshot.eliteCandidate.prototype)
            : `${holding ? `결속 홀드 ${holdSeconds}/${maxHoldSeconds}초 · ` : "Bind 대기 · "}${companionLabel(snapshot.eliteCandidate.prototype)}`;
        capturePrompt.dataset.extractionState = extractionProgress.failed
          ? "failed"
          : extractionReady
            ? "ready"
            : holding
              ? "holding"
              : "pending";
        capturePrompt.style.transform = "translate(" + point.x + "px, " + (point.y - WORLD_CAPTURE_PROMPT_LIFT_PX) + "px) translate(-50%, -100%)";
      } else {
        capturePrompt?.remove();
      }
    } else {
      capturePrompt?.remove();
    }

    // Floating damage numbers (screen #16) — event-driven, pooled at
    // MAX_VISUAL_EFFECTS=24 (battle-visualizer.js precedent). Two
    // non-overlapping event sources (verified against
    // defense-run-simulation.js emit() call sites): PROJECTILE_IMPACT for
    // ranged hits on enemies/commander (excludes gate by design — it has a
    // persistent HUD bar already; excludes companion ids because a
    // companion ranged hit ALSO emits COMPANION_DAMAGED for the same hit,
    // which would double-count), and COMMANDER_DAMAGED/COMPANION_DAMAGED
    // unconditionally for melee contact damage (which never emits
    // PROJECTILE_IMPACT). Enemy-takes-melee-contact-damage has no event at
    // all in this codebase (enemies only take damage via projectiles), so
    // that path needs no separate handling.
    //
    // Structure: an outer .world-damage-number holds the JS-computed screen
    // position (set once via inline transform, never animated — a CSS
    // animation replaces the ENTIRE computed transform value for an
    // animated property, so co-animating position and rise/fade on the same
    // element would silently discard the position, pinning every number to
    // the overlay's top-left corner). An inner span carries the rise+fade
    // keyframe animation relative to that fixed position.
    if (this.worldHudDamageTick !== snapshot.tick) {
      this.worldHudDamageTick = snapshot.tick;
      this.worldHudDamageEventKeys.clear();
    }
    const companionIds = new Set((snapshot.companions ?? []).map((companion) => companion.id));
    for (const event of snapshot.events ?? []) {
      let targetId = null;
      let damage = null;
      if (event.type === "PROJECTILE_IMPACT" && event.hit && event.targetId !== "gate" && !companionIds.has(event.targetId)) {
        targetId = event.targetId;
        damage = event.damage;
      } else if (event.type === "COMMANDER_DAMAGED") {
        targetId = "commander";
        damage = event.damage;
      } else if (event.type === "COMPANION_DAMAGED") {
        targetId = event.entityId;
        damage = event.damage;
      } else {
        continue;
      }
      if (targetId === null || !damage) continue;
      // Keyed by the EVENT's own tick (always present, see emit() in
      // defense-run-simulation.js), not the outer snapshot.tick -- snapshot
      // now carries a whole frame's worth of events across a slow-frame
      // catch-up burst (see loop()'s frameEvents), so two genuinely distinct
      // hits on the same target in different real ticks must not collide on
      // the same key.
      const key = event.type + ":" + targetId + ":" + event.tick;
      if (this.worldHudDamageEventKeys.has(key)) continue;
      this.worldHudDamageEventKeys.add(key);
      const ndc = this.renderer?.projectEntityToScreen?.(targetId);
      if (!ndc?.visible) continue;
      const point = toScreen(ndc);
      const isCriticalTick = (snapshot.events ?? []).some((candidate) => candidate.type === "CRITICAL_HIT" && (candidate.targetId === targetId || candidate.entityId === targetId));
      const pooled = overlay.querySelectorAll(".world-damage-number");
      if (pooled.length >= 24) pooled[0].remove();
      const number = document.createElement("div");
      number.className = "world-damage-number";
      number.style.transform = "translate(" + point.x + "px, " + (point.y - WORLD_DAMAGE_NUMBER_LIFT_PX) + "px)";
      const rise = document.createElement("span");
      rise.className = "world-damage-number-rise" + (isCriticalTick ? " is-crit" : "");
      rise.textContent = "-" + damage;
      number.append(rise);
      overlay.append(number);
      rise.addEventListener("animationend", () => number.remove());
      setTimeout(() => number.remove(), 1200); // fallback if reduced-motion suppresses the animationend event
    }
  }

  renderControls(snapshot) {
    const skills = root.querySelector("#skill-actions");
    const activeSkills = snapshot.commander.skills.filter((id) => SKILLS[id]?.kind === "active");
    const markup = activeSkills.map((id) => {
      const cooldown = snapshot.commander.cooldowns[id] ?? 0;
      const skill = SKILLS[id] ?? {};
      const glyph = { "rift-bolt": "✦", "soul-lance": "╱", "grave-pulse": "◉", "void-aegis": "⬡", "shadow-step": "◇" }[id] ?? "✦";
      return `<button class="skill-action" data-cast="${id}" data-defense-skill="${id}" ${cooldown ? "disabled" : ""}><span class="skill-glyph" aria-hidden="true">${glyph}</span><span class="skill-copy"><strong>${escapeHtml(skill.name ?? id)}</strong><small>${cooldown ? `${(cooldown / TICK_RATE).toFixed(1)}s` : "준비됨"}</small></span></button>`;
    }).join("");
    if (skills.dataset.skills !== markup) {
      skills.dataset.skills = markup;
      skills.innerHTML = markup;
      skills.querySelectorAll("[data-cast]").forEach((button) => {
        button.addEventListener("click", () => this.send("SKILL_CAST", { skillId: button.dataset.cast }));
      });
    }

    // Persistent read-only badges for acquired PASSIVE skills. #skill-actions
    // above filters kind==="active", so before this the 3 passive picks
    // (Dusk Edge/Echo Magnet/Gate Binder) vanished into stats after the level-up
    // toast -- half the growth pool left zero on-screen trace of the character's
    // building kit. These non-interactive chips keep that accrued power visible
    // for the whole run (survivor/ARPG "growth is felt" legibility), each chip
    // labelled with exactly the per-skill boon the growth preview promised.
    const passives = root.querySelector("#passive-badges");
    if (passives) {
      const passiveGlyphs = { "eclipse-edge": "†", "soul-magnet": "◎", "ward-binder": "❖" };
      const passiveMarkup = snapshot.commander.skills
        .filter((id) => SKILLS[id]?.kind === "passive")
        .map((id) => {
          const skill = SKILLS[id] ?? {};
          const glyph = passiveGlyphs[id] ?? "◆";
          const boon = skill.basicDamage ? `+${skill.basicDamage} 공격`
            : skill.pickupRange ? `+${skill.pickupRange} 회수`
            : skill.maxIntegrity ? `+${skill.maxIntegrity} 내구` : "지속";
          const name = escapeHtml(skill.name ?? id);
          return `<span class="passive-badge" data-passive="${id}" title="${name} · ${escapeHtml(boon)}"><span class="passive-glyph" aria-hidden="true">${glyph}</span><span class="passive-copy"><strong>${name}</strong><small>${escapeHtml(boon)}</small></span></span>`;
        }).join("");
      if (passives.dataset.passives !== passiveMarkup) {
        passives.dataset.passives = passiveMarkup;
        passives.innerHTML = passiveMarkup;
      }
    }

    // Scoped to the growth-offer card's own id (not the broader .edge-card
    // class) -- .edge-card is now shared with transient toasts (defense-toast,
    // including the camera-hint toast, app.js maybeShowCameraHint()) that must
    // survive this render pass untouched. A class-based :not() selector here
    // previously caught and removed any other .edge-card present, including
    // toasts that had nothing to do with the growth offer.
    let card = root.querySelector("#defense-growth-offer");
    if (snapshot.growthOffer) {
      const offerKey = snapshot.growthOffer.choices.join(",");
      if (!card) {
        card = document.createElement("section");
        card.className = "edge-card";
        card.id = "defense-growth-offer";
        this.surface.append(card);
        this.focusBeforeGrowth = document.activeElement;
      }
      if (card.dataset.offer !== offerKey) {
        card.dataset.offer = offerKey;
        const previews = snapshot.growthOffer.choices.map((id) => growthUpgradePreview(id, snapshot));
        telemetry.append("GROWTH_OFFER_VALUES", { tick: snapshot.tick, choices: previews });
        card.innerHTML = `<h2>성장 선택 · 전투 일시 정지</h2><div class="choices">${previews.map(({ skillId, label }) => `<button data-pick="${skillId}"><span class="progression-icon" data-track="run-scoped" aria-hidden="true"></span><strong>${escapeHtml(SKILLS[skillId]?.name ?? skillId)}</strong><span class="growth-choice-copy">${escapeHtml(label)}</span></button>`).join("")}</div>`;
        card.querySelectorAll("[data-pick]").forEach((button) => {
          button.addEventListener("click", () => {
            const picked = previews.find((preview) => preview.skillId === button.dataset.pick);
            this.send("SKILL_SELECTED", { skillId: button.dataset.pick });
            card.remove();
            this.focusBeforeGrowth?.focus?.();
            if (picked) this.showToast(`<h2>LV UP · 스킬 습득</h2><p>${escapeHtml(SKILLS[picked.skillId]?.name ?? picked.skillId)} · ${escapeHtml(picked.label)}</p>`, { className: "defense-toast-levelup" });
          });
        });
        card.querySelector("button")?.focus();
      }
    } else if (card) {
      card.remove();
    }

    /**
     * §2-a 3-stance selector — leftmost in #battle-actions (before pause):
     * mid-run reselectable action needs steadier reach than the
     * context-only extract-elite button (design doc's placement rationale).
     * Regenerates every render (like the skill-action cooldown text above)
     * so the JS-driven radial-fill ring (--rc-cooldown-pct, mirroring the
     * existing --rc-glow-angle conic-gradient convention) advances every
     * tick instead of animating continuously.
     */
    const stance = FORMATION_STANCES.includes(snapshot.formationStance) ? snapshot.formationStance : "VANGUARD";
    const cooldownUntil = snapshot.stanceCooldownUntilTick ?? 0;
    const ticksRemaining = Math.max(0, cooldownUntil - snapshot.tick);
    const onCooldown = ticksRemaining > 0;
    const cooldownPct = onCooldown ? Math.min(100, Math.round((ticksRemaining / STANCE_COOLDOWN_TICKS) * 100)) : 0;
    const secondsRemaining = Math.ceil(ticksRemaining / TICK_RATE);
    const isBlocked = performance.now() < this.stanceShakeUntil;
    const isSwitched = performance.now() < this.stanceConfirmUntil;
    const stanceLabel = `편성 스탠스: ${STANCE_LABELS[stance]}${onCooldown ? ` (전환까지 ${secondsRemaining}초)` : ""}`;
    const stanceMarkup = `<button id="stance-cycle" class="stance-cycle-button${isBlocked ? " is-blocked" : ""}${isSwitched ? " is-switched" : ""}" style="--rc-cooldown-pct:${cooldownPct}" aria-live="polite" aria-label="${escapeHtml(stanceLabel)}"><span class="stance-glyph" aria-hidden="true">${STANCE_GLYPHS[stance]}</span></button>`;

    const actions = root.querySelector("#battle-actions");
    const candidate = snapshot.eliteCandidate;
    const extractionReady = Boolean(snapshot.extractionProgress?.completed && snapshot.extractionProgress?.ready !== false);
    if (!candidate || extractionReady || snapshot.commander?.objectiveRoute) {
      this.bindStartPending = false;
    }
    const extractionRouting = Boolean(snapshot.commander?.objectiveRoute || this.bindStartPending);
    const extractionDisabled = !extractionReady && extractionRouting;
    const extractionLabel = candidate
      ? `${extractionReady ? "정예 추출" : extractionRouting ? "Bind 진행 중" : "Bind 시작"} · ${companionLabel(candidate.prototype)}`
      : "";
    const extractionTitle = extractionReady
      ? "정예를 추출합니다"
      : extractionRouting
        ? "Bind 진행 중"
        : "Bind를 시작합니다";
    const actionMarkup = `${stanceMarkup}<button id="toggle-pause" aria-pressed="${this.userPaused}">${this.userPaused ? "전투 계속" : "일시 정지"}</button>${
      candidate && !snapshot.extracted
        ? `<button id="extract-elite" data-defense-extract="${candidate.enemyId}"${extractionDisabled ? " disabled" : ""} aria-disabled="${extractionDisabled ? "true" : "false"}" title="${extractionTitle}">${escapeHtml(extractionLabel)}</button>`
        : ""
    }`;
    if (actions.dataset.actions !== actionMarkup) {
      actions.dataset.actions = actionMarkup;
      actions.innerHTML = actionMarkup;
      actions.querySelector("#stance-cycle")?.addEventListener("click", () => this.send("STANCE_CYCLE"));
      actions.querySelector("#toggle-pause")?.addEventListener("click", () => this.togglePause());
      actions.querySelector("#extract-elite")?.addEventListener("click", (event) => {
        if (!extractionReady && !extractionRouting) {
          this.bindStartPending = true;
          const button = event.currentTarget;
          button.disabled = true;
          button.setAttribute("aria-disabled", "true");
          button.textContent = `Bind 진행 중 · ${companionLabel(candidate.prototype)}`;
          button.title = "Bind 진행 중";
        }
        this.send("EXTRACT_ELITE", { enemyId: candidate.enemyId });
      });
    }
  }

  togglePause() {
    this.userPaused = !this.userPaused;
    this.surface.dataset.defenseState = this.userPaused ? "paused" : "active";
    this.accumulator = 0;
    if (this.userPaused) this.focusBeforePause = document.activeElement;
    this.render();
    if (!this.userPaused) this.focusBeforePause?.focus?.();
  }

  /**
   * Exposes which renderer is actually active as a DOM-observable fact —
   * RealtimeBattle's mount()-time WebGL2 detection AND its render()-time
   * webglcontextlost/exception-driven failover are both otherwise invisible
   * to tests, since app.js's own try/catch silently swaps to BattleVisualizer
   * on any renderSnapshot throw. Without this, a browser test staying green
   * proves nothing about whether the real WebGL path rendered a single frame
   * or crashed immediately and ran entirely on the Canvas2D fallback.
   */
  updateRendererModeAttribute() {
    // Identity check, NOT a renderer-reported flag: neither RealtimeBattle nor
    // BattleVisualizer defines `usingFallback` (an earlier revision read that
    // field, which was always undefined, so this attribute reported "canvas2d"
    // 100% of the time and the browser test above it could never actually
    // observe a live WebGL playthrough). Both mount() methods return `this`,
    // and every assignment site here constructs one of exactly these two
    // classes, so the constructor is the ground truth for which path is live.
    this.surface.dataset.defenseRenderer = this.renderer instanceof RealtimeBattle ? "webgl" : "canvas2d";
  }

  /**
   * Pause menu (D5, Option A — production/decision-log.md): a large read-only
   * overlay over the frozen battle canvas, shown ONLY while userPaused===true.
   * The "no central panel over the battlefield" rule's stated purpose is
   * preserving real-time-threat visibility; with the sim paused there is no
   * real-time threat, so this satisfies the rule's intent without violating
   * its letter in spirit. Reuses wardenGrowthData()/*Markup(data, false) —
   * interactive=false renders the identical growth-panel markup with inert
   * controls, so this never becomes a second input surface (D5 rationale).
   */
  renderPauseOverlay(snapshot = getRunSnapshot(this.run)) {
    let overlay = this.surface.querySelector("#defense-pause-overlay");
    if (!this.userPaused) {
      overlay?.remove();
      return;
    }
    const data = wardenGrowthData();
    // Red DOWNED badges (§C) are live-run state, unlike the yellow low-ward
    // badge (a static campaign-equipment calculation) — only ever populated
    // here (pause-overlay re-entry), never in the off-battle formation tab.
    const downedIds = new Set(snapshot.companions.filter((companion) => companion.status === "DOWNED").map((companion) => companion.companionId));
    const segments = [
      { id: "stats", label: "스탯", html: `<div class="growth-stat-grid">${wardenStatsMarkup(data, false)}</div>` },
      { id: "inventory", label: "인벤토리", html: `<div class="growth-equip-grid">${equipmentOwnersMarkup(data, false)}</div>` },
      { id: "companions", label: "동료", html: formationRowMarkup(data, false, downedIds, snapshot.companions) },
    ];
    if (!segments.some((segment) => segment.id === this.pauseOverlaySegment)) this.pauseOverlaySegment = "stats";
    const markup = `
      <div class="pause-overlay-panel" role="dialog" aria-modal="true" aria-labelledby="pause-overlay-title">
        <div class="panel-heading"><h2 id="pause-overlay-title">일시 정지 · 빌드 확인</h2><button id="pause-overlay-resume" class="primary-action">전투 재개</button></div>
        <div class="command-segment-bar" role="tablist" aria-label="일시정지 요약">${segments.map((segment) => `<button class="command-segment${segment.id === this.pauseOverlaySegment ? " is-active" : ""}" role="tab" aria-selected="${segment.id === this.pauseOverlaySegment}" data-pause-segment="${segment.id}">${segment.label}</button>`).join("")}</div>
        <div class="command-segment-body pause-overlay-readonly">${segments.find((segment) => segment.id === this.pauseOverlaySegment).html}</div>
      </div>`;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "defense-pause-overlay";
      this.surface.append(overlay);
    }
    if (overlay.dataset.segment !== this.pauseOverlaySegment) {
      overlay.dataset.segment = this.pauseOverlaySegment;
      overlay.innerHTML = markup;
      overlay.querySelector("#pause-overlay-resume").addEventListener("click", () => this.togglePause());
      overlay.querySelectorAll("[data-pause-segment]").forEach((button) => {
        button.addEventListener("click", () => {
          this.pauseOverlaySegment = button.dataset.pauseSegment;
          overlay.dataset.segment = "";
          this.renderPauseOverlay();
        });
      });
    }
  }

  /** Non-blocking edge-card toast — level-up/reward-tier/rally notices. Single shared slot; auto-dismisses. Returns the created toast element (camera-hint uses this to tag itself for early-dismiss lookup). */
  showToast(innerHtml, { className = "", durationMs = 4000 } = {}) {
    root.querySelector(".edge-card.defense-toast")?.remove();
    clearTimeout(this.toastTimer);
    const toast = document.createElement("section");
    toast.className = `edge-card defense-toast ${className}`.trim();
    toast.setAttribute("role", "status");
    toast.innerHTML = innerHtml;
    toast.addEventListener("click", () => toast.remove());
    this.surface.append(toast);
    this.toastTimer = setTimeout(() => { toast.remove(); this.toastTimer = null; }, durationMs);
    return toast;
  }

  /**
   * §2-b orbit-camera discovery hint — one-shot per campaign
   * (CAMERA_HINT_ACHIEVEMENT_ID flag on the existing achievementIds array,
   * campaign-state.js's existing one-time-flag storage — see that constant's
   * doc comment for why no new storage mechanism was introduced), shown on
   * this battle canvas's first mount (called once from start()). Reuses
   * showToast()/.edge-card.defense-toast verbatim — no new toast pattern.
   * Copy text is verbatim from ui-redesign-delta-20260725.md §2-b.
   */
  maybeShowCameraHint() {
    if (campaign.achievementIds?.includes(CAMERA_HINT_ACHIEVEMENT_ID)) return;
    campaign = { ...campaign, achievementIds: [...campaign.achievementIds, CAMERA_HINT_ACHIEVEMENT_ID].sort() };
    void persistCampaign("카메라 안내를 확인했습니다.");
    const toast = this.showToast(
      `<h2>궤도 카메라 안내</h2><p><span aria-hidden="true">🔄</span> 손가락 1개로 드래그해 시야를 돌리고(Orbit), <span aria-hidden="true">🤏</span> 손가락 2개로 꼬집어 확대/축소(Pinch Zoom)하세요</p>`,
      { className: "defense-toast-camera-hint", durationMs: 5000 },
    );
    toast.dataset.cameraHint = "true";
  }

  /** Early-dismiss half of §2-b's "5초 또는 첫 제스처, 둘 중 빠른 쪽" rule — called from onPointerMove on any real orbit/pinch input. Idempotent no-op once already dismissed/timed out. */
  dismissCameraHint() {
    const toast = root.querySelector('.edge-card.defense-toast[data-camera-hint="true"]');
    if (!toast) return;
    if (this.toastTimer) { clearTimeout(this.toastTimer); this.toastTimer = null; }
    toast.remove();
  }

  async resolveTerminal(snapshot) {
    if (this.terminalHandled) return;
    this.surface.dataset.defenseState = snapshot.terminal.toLowerCase();
    const outcome = snapshot.terminal === "FINAL_COMPLETION"
      ? "FINAL_COMPLETION"
      : snapshot.terminal === "DEFEAT" ? "defeat" : "victory";
    const choices = snapshot.rewardOffer?.choices ?? [];
    if (outcome !== "defeat" && choices.length && !this.selectedRewardId) {
      if (this.rewardPrompted) return;
      this.rewardPrompted = true;
      const card = document.createElement("section");
      card.className = "edge-card defense-result defense-reward";
      const rewardPreviews = choices.map((id) => rewardUpgradePreview(id, snapshot));
      telemetry.append("REWARD_OFFER_VALUES", { tick: snapshot.tick, choices: rewardPreviews });
      card.innerHTML = `<h2>보상 선택 · 영구 기록</h2><p>이번 승리의 보상 하나를 다음 출전에 적용합니다.</p><div class="choices">${rewardPreviews.map(({ rewardId, label }) => `<button data-reward="${rewardId}"><strong>${escapeHtml(REWARDS[rewardId]?.name ?? rewardId)}</strong><span>${escapeHtml(REWARDS[rewardId]?.description ?? "기록 보상")}</span><span>${escapeHtml(label)}</span></button>`).join("")}</div>`;
      this.surface.append(card);
      card.querySelectorAll("[data-reward]").forEach((button) => {
        button.addEventListener("click", () => {
          this.selectedRewardId = button.dataset.reward;
          this.send("REWARD_SELECTED", { rewardId: this.selectedRewardId });
          this.run = advanceDefenseRun(this.run, 0);
          void this.resolveTerminal(getRunSnapshot(this.run));
        });
      });
      card.querySelector("button")?.focus();
      return;
    }
    this.terminalHandled = true;
    // Extraction persistence now happens once at terminal from the ordered
    // per-run event list, so duplicate events within a single run only
    // promote to one canonical campaign mutation.
    const campaignAfterExtraction = applyEliteExtractionEvents(campaign, this.extractionEvents);
    if (campaignAfterExtraction !== campaign) {
      campaign = campaignAfterExtraction;
      await persistCampaign("동료를 기록했습니다.");
    }
    // Level-up toast (IA screen #9): Echo Core (permanent-stat currency) is
    // only ever granted at campaign-resolution points (elite capture / boss
    // kill, see campaign-state.js echoCoreEarned) — there is no mid-battle
    // permanent-level event to hook, so this fires here at the honest actual
    // moment the gain happens, keyed to a real before/after delta.
    const echoBefore = echoCoreEarned(campaign);
    campaign = applyCampaignRunResult(campaign, { stageId: this.stageId, outcome, rewardId: this.selectedRewardId });
    const complete = campaign.lastResolution.campaignComplete;
    const echoDelta = echoCoreEarned(campaign) - echoBefore;
    telemetry.recordRunResult({ outcome, rewardId: this.selectedRewardId, campaignComplete: complete, stageId: this.stageId, tick: snapshot.tick });
    await persistCampaign(outcome === "defeat" ? "패배 기록을 저장했습니다." : "방어 기록과 보상을 저장했습니다.");
    if (outcome !== "defeat" && echoDelta > 0) {
      this.showToast(`<h2>LV UP · 진행 기록</h2><p>Echo Core +${echoDelta} (누적 ${echoCoreEarned(campaign)})</p>`, { className: "defense-toast-levelup" });
    }
    if (this.selectedRewardId && REWARDS[this.selectedRewardId]) {
      const reward = REWARDS[this.selectedRewardId];
      this.showToast(`<h2>기록 보상 획득</h2><p><strong>${escapeHtml(reward.name)}</strong> · ${escapeHtml(reward.description ?? "")}</p>`, { className: "defense-toast-reward" });
    }
    const card = document.createElement("section");
    card.className = "edge-card defense-result";
    card.innerHTML = `<h2>${outcome === "defeat" ? "방어선이 무너졌습니다" : complete ? "심연 방어선 완수" : "관문 방어 성공"}</h2>
      <div class="choices"><button id="result-action">${outcome === "defeat" ? "같은 구역 재도전" : complete ? "기록실로" : "다음 구역"}</button><button id="lobby-action">로비</button></div>`;
    this.surface.append(card);
    card.querySelector("#result-action").addEventListener("click", () => {
      if (outcome === "defeat") {
        this.remountForStage(this.stageId);
        this.beginRun();
        dockOpen = { left: false, right: false };
      } else if (complete) {
        this.remountForStage(STAGES[0].id);
        selectedStageId = STAGES[0].id;
        dockOpen = computeDefaultDockOpen(dockTier);
      } else {
        selectedStageId = STAGES[campaign.unlockedStageIndex].id;
        this.remountForStage(selectedStageId);
        this.beginRun();
        dockOpen = { left: false, right: false };
      }
      renderShell();
    });
    card.querySelector("#lobby-action").addEventListener("click", () => {
      this.remountForStage(this.stageId);
      dockOpen = computeDefaultDockOpen(dockTier);
      renderShell();
    });
    card.querySelector("button")?.focus();
  }

  debugMetrics() {
    return {
      domNodes: this.surface?.querySelectorAll("*").length ?? 0,
      liveRafLoops: this.stopped || !this.frame ? 0 : 1,
      registeredListeners: this.listenerCount,
      timers: 0,
      audioNodes: this.audio.debugMetrics().nodes,
      renderer: this.renderer?.debugMetrics?.() ?? { geometries: 0, textures: 0, programs: 0 },
      inputMarkerCount: this.inputSeq,
    };
  }
}

async function initialize() {
  try {
    await storage.open();
    const settlement = await storage.settleIdleReturn({ now: Date.now() });
    campaign = settlement.campaign ?? createCampaign();
    idleReturnReceipt = settlement.receipt;
  } catch {
    campaign = (await storage.load()) ?? createCampaign();
  }
  selectedStageId = STAGES[campaign.unlockedStageIndex]?.id ?? STAGES[0].id;
  statusText = `저장소 ${storage.backend ?? "메모리"} 준비됨`;
  viewport.start();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => undefined);
  mountShell(selectedStageId);
}

void initialize();
