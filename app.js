import {
  MAX_EXTRACTED_SKILL_LEVEL,
  MAX_EXTRACTED_SKILL_LOADOUT,
  STAGES,
  allocateWardenStatPoint,
  applyCampaignRunResult,
  applyEliteExtractionEvents,
  applyRunCarryOver,
  boundFragmentEarned,
  boundFragmentSpent,
  createCampaign,
  echoCoreEarned,
  echoCoreSpent,
  equipAppearanceItem,
  equipExtractedSkill,
  extractedSkillUpgradeCostForLevel,
  equipmentTierIndexFor,
  purchaseEquipmentTier,
  selectWardenTrait,
  setCompanionFormationSlot,
  setCompanionLoadout,
  startRun,
  unlockWardenSkillNode,
  upgradeExtractedSkill,
  unequipExtractedSkill,
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
  ABYSS_DEPTH_MAX,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
  runCarryOver,
} from "./defense-run-simulation.js";
import { RealtimeBattle, MeshThumbnailService, meshRootForCompanion, meshRootForStageBoss, COMMANDER_MESH_ROOT } from "./battle-realtime-three.js";
import { BattleVisualizer } from "./battle-visualizer.js";
import { ARENA, COMPANIONS, CUTSCENES, REWARDS, RULES_VERSION, SKILLS, SKILL_RANK_COOLDOWN_FLOOR, SKILL_RANK_COOLDOWN_STEP, SKILL_RANK_DAMAGE_STEP, SKILL_RANK_PASSIVE_SHARE, STAGE_PRESENTATION_BY_ID, STAGE_REWARD_IDS, STAGE_TACTICS, TICK_RATE, XP_GROWTH, abyssDepthPackage } from "./defense-catalog.js";
// Cycle 10 §5.3: BUFF_ITEMS is authored by the drop/buff cycle inside defense-catalog.js and
// does not exist at this commit. A NAMESPACE import cannot throw on a missing export, whereas a
// named import would be a hard module error that blanks the entire app before first paint. The
// buff strip therefore degrades to "renders nothing" while the catalog is absent and lights up
// with no further UI change the moment the export lands. Read through buffItem() below, never
// destructured at module scope, so the binding is picked up live rather than snapshotted.
import * as defenseCatalog from "./defense-catalog.js";
import { cutsceneEventKey, cutsceneFromEvent } from "./defense-cutscene.js";
import { DefenseAudio } from "./defense-audio.js";
import { DefenseViewport } from "./defense-viewport.js";
import { DefenseTelemetry } from "./defense-telemetry.js";
import { STAGE_SHOWCASE_IDS, stageWorldFor } from "./stage-world-catalog.js";
import { STAGE_STORIES, questProgressForEvents, stageStoryFor } from "./stage-story-catalog.js";
import {
  dialogueLineAt,
  dialogueScriptFor,
  showcaseCamera,
  stagingFor,
} from "./lobby-cinematic.js";

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
const JOYSTICK_OCTANTS = Object.freeze(["E", "SE", "S", "SW", "W", "NW", "N", "NE"]);
const JOYSTICK_DEAD_ZONE_RATIO = 0.22;
// ── Cycle 10 §5 dungeon-aware HUD readouts ───────────────────────────────────────────────
// Presentation-only vocabulary. None of this reaches the simulation, so getRunDigest is
// untouched by every constant below.
//
// Route-role labels for #battle-route-rail. Keyed on the AUTHORED `role` strings in
// stage-world-catalog.js so a rail node can never invent a role the level does not declare.
const ROUTE_ROLE_LABELS = Object.freeze({
  ingress: "진입",
  "intermediate-objective": "중간 목표",
  "intermediate-gate": "중간 관문",
  "final-gate": "최종 관문",
});
// Gimmick class glyphs (spec §5.2). `hazard` doubles as the fallback: an unknown class must
// still render something, and "hazard" is the honest default for an unrecognised threat.
const GIMMICK_CLASS_GLYPHS = Object.freeze({
  deformation: "◤", gate: "⌗", mirror: "◈", hazard: "⚠",
});
// FALLBACK ONLY, never the value. telegraphTicks is per gimmick class -- deformation 180,
// narrowing gate 120, progress-ring/mirror 90, hazard 60 -- and the chip reads it off the event
// (director ruling v6 C2). 180 is the longest tier, so a gimmick arriving with a malformed field
// gets the most conservative window rather than a cue that expires before its own TRIGGERED.
const GIMMICK_TELEGRAPH_FALLBACK_TICKS = 180;
// Buff-strip vocabulary (spec §5.3). Both sets are VALIDATION domains, not lookup tables: an
// unknown `stat` degrades to the neutral group and an unknown `rarity` to common, so a future
// enum change in the simulation cannot break the strip or throw.
const BUFF_STATS = new Set([
  "basicDamage", "gateMaxIntegrity", "pickupRange",
  "cooldownScaleBp", "moveSpeedBp", "critChanceBp", "incomingDamageBp",
]);
const BUFF_RARITIES = new Set(["common", "rare", "resonant", "relic"]);
// Pre-expiry warning window, 180 ticks = 3s. DERIVED, never an event (spec §5.3): a
// `BUFF_EXPIRING` event would have to fire per buff per tick to be accurate.
const BUFF_WARN_TICKS = 180;
/**
 * Resolves a buff's DISPLAY data from the frozen catalog by `itemId`.
 *
 * Read through the namespace import rather than a destructured binding so the lookup picks up
 * `BUFF_ITEMS` the moment the drop/buff cycle exports it -- at this commit the export does not
 * exist and every call returns null, which renders an empty strip instead of throwing.
 * Deliberately keyed on `itemId` and NEVER on `stat`: several items share a stat, so a
 * stat-keyed icon would show the wrong plate for all but the first item of each stat.
 */
const buffItem = (itemId) => (itemId ? defenseCatalog.BUFF_ITEMS?.[itemId] ?? null : null);
const KEY_DIRECTIONS = Object.freeze({
  w: "N", arrowup: "N", d: "E", arrowright: "E",
  s: "S", arrowdown: "S", a: "W", arrowleft: "W",
});
const ATTACK_KEYS = new Set([" ", "space", "spacebar", "j", "f", "enter"]);
const ATTACK_CODES = new Set(["Space", "KeyJ", "KeyF", "Numpad0"]);
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
const LOBBY_SHOWCASE_STAGE_ID_SET = new Set(STAGE_SHOWCASE_IDS);

/** Lobby cinematic (ui/lobby-cinematic-spec.md) — the GitHub-Pages main screen is the
 * SAME persistent shell as combat, so "the lobby" is `session.started === false`. While
 * that holds, the live 3D surface stages a presentation-only face-off between the
 * commander and the selected front's boss, and the showcase camera loops through the
 * wide → closeup → wide breathing cycle from lobby-cinematic.js. Everything here is
 * presentation: nothing in this block writes simulation state or feeds getRunDigest(). */
const LOBBY_STRATEGY_PRESETS = Object.freeze([
  {
    id: "ASSAULT",
    glyph: "▲",
    label: "돌격",
    // Every deployed companion is marked FRONT. The SIMULATION still caps how many can
    // actually hold the line (rpg-catalog MAX_FRONT_SLOTS and the live stance's
    // derivedFrontCount) -- this preset only expresses intent, so the hint says so.
    slotFor: () => "FRONT",
    hint: `모든 동료를 전열 의도로 표시합니다. 실제 전열 인원은 전투 중 편성 태세의 전열 정원(최대 ${MAX_FRONT_SLOTS})까지만 적용됩니다.`,
  },
  {
    id: "BALANCED",
    glyph: "Ψ",
    label: "균형",
    slotFor: (index) => (index === 0 ? "FRONT" : "BACK"),
    hint: "선두 1명만 전열 의도, 나머지는 후열입니다. 전열 손실과 화력을 함께 유지하는 기본값입니다.",
  },
  {
    id: "RANGED",
    glyph: "●",
    label: "후위",
    slotFor: () => "BACK",
    hint: "모든 동료를 후열 의도로 둡니다. 지휘관이 전면을 맡고 동료는 사거리를 유지합니다.",
  },
]);
/** Fallback used when the stored formation matches no preset (e.g. a hand-edited mix from
 * the 군단 → 편성 tab). The lobby then shows nothing checked rather than lying about it. */
const LOBBY_STRATEGY_CUSTOM = "CUSTOM";


let campaign = null;
let selectedStageId = STAGES[0].id;
let selectedAbyssDepth = 0; // Abyss Depth (wiki 2026-07-30 GAP-A): run-scoped difficulty ladder, NOT persisted; clamped to cleared-stage count each build.
/** Max Abyss Depth unlocked = cleared-stage count, capped at ABYSS_DEPTH_MAX (clear-to-unlock, GAP-A). depth 0 always available. */
function maxUnlockedAbyssDepth() { return campaign ? Math.min(ABYSS_DEPTH_MAX, campaign.resolvedIds?.length ?? 0) : 0; }
// Persistent RPG command decks (20260729-ui-dock-removal, ui/dock-removal-plan.md):
// replaces the slide-open side docks. Two fixed edge columns, siblings of
// #defense-battle-surface, mounted ONLY before a run and emptied the instant a run starts:
//   left  #command-deck-left  -- 캐릭터 시트: 상태창 + 인벤토리 | 성장 | 군단 (one at a time)
//   right #command-deck-right -- 전황 시트: 구역 미니맵 / 브리핑 / 진행 / 요새 기록실
// There is no open/close state and no slide gesture: the segment bar is always visible and
// switching is instant, so 인벤토리 and 스킬 are one tap away with nothing to reveal.
//
// Why ONE section at a time rather than all four stacked: mounting all of them measured a
// 3505px scroll height inside a 325px deck body -- 10.8 screens of vertical scrolling to
// reach 군단. Scrolling is acceptable INSIDE 인벤토리 (a list that legitimately grows) and
// nowhere else, so the deck shows the compact status window plus exactly one section, and
// each section is sized to fit its band. That is a layout fix, not a disclosure mechanic:
// no section is hidden behind a gesture, and the control that switches them never scrolls
// away.
// `icon` is the text fallback the glyph rendered before the art pass; `iconId` names the
// generated plate in assets/images/battle/ui/hud/ that styles.css binds via [data-ui-icon].
// The glyph is kept in the DOM only when no iconId is present, so a missing asset degrades
// to the old readable glyph instead of an empty box.
const LEFT_DECK_SECTIONS = Object.freeze([
  { id: "inventory", label: "인벤토리", icon: "▦", iconId: "nav-inventory" },
  { id: "skills", label: "스킬", icon: "✦", iconId: "nav-growth" },
  { id: "growth", label: "성장", icon: "◆", iconId: "nav-growth" },
  { id: "legion", label: "군단", icon: "❖", iconId: "nav-companions" },
]);
// A 5th segment is NOT available: the landscape bar measures 203px, and 5 chips at the 48dp
// floor plus gaps need 252px, while 4 need 201px and fit with 2px spare. Any further surface
// must share an existing segment or be trimmed -- never added as a chip.
// Which left-deck section is on screen. Defaults to 인벤토리 because the user directive names
// it first; persisted only in memory, so a reload lands on the same default rather than a
// remembered state the player cannot see the reason for.
let activeLeftSection = LEFT_DECK_SECTIONS[0].id;

// Which right-deck (전황 시트) section is on screen. Same reason as the left deck: mounting
// 출정 and 요새 together measured 1951px of content in a 307px body at portrait, putting the
// stage-progression control at y=1224 and the guide launcher at y=1935 -- both off-screen,
// with no affordance revealing them. Defaults to 출정 because that is the pre-run task.
const RIGHT_DECK_SECTIONS = Object.freeze([
  { id: "sortie", label: "출정", icon: "➤", iconId: "nav-sortie" },
  { id: "stronghold", label: "요새", icon: "▤", iconId: "nav-stronghold" },
]);
let activeRightSection = RIGHT_DECK_SECTIONS[0].id;
let statusText = "기록을 불러오는 중입니다.";
let campaignWrite = Promise.resolve();
let session = null;
let idleReturnReceipt = null;
// Item 6 (presentation-spec) — pooled screen-space particle burst for the 작전 개시 FAB.
// Six reusable <span>s recycled across clicks (DOM pool, not three.js); each animates
// transform+opacity then detaches. Lazily built on first use; skipped under reduced motion.
let sortieBurstPool = null;

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

function appearanceLoadoutForCampaign(source = campaign) {
  const equipped = source?.storyProgress?.equippedAppearance ?? {};
  const rewards = new Map(Object.values(STAGE_STORIES).map((story) => [story.appearanceReward.id, story.appearanceReward]));
  return Object.fromEntries(Object.entries(equipped).flatMap(([slot, itemId]) => {
    const reward = rewards.get(itemId);
    return reward?.slot === slot ? [[slot, reward]] : [];
  }));
}


function toggleExtractedSkill(source, skillId) {
  return source.storyProgress.activeSkillLoadout.includes(skillId)
    ? unequipExtractedSkill(source, skillId)
    : equipExtractedSkill(source, skillId);
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

/** Spoiler discipline, applied to the lobby cinematic exactly as the 출정 deck applies it
 * (renderSortieTabBody()): only the three STAGE_SHOWCASE_IDS fronts may disclose the boss
 * name, domain and objective. Every other front renders the sealed editorial copy, so the
 * main screen never leaks a boss the player has not deployed against yet. */
function lobbyStageFacts(stageId) {
  const stage = stageFor(stageId);
  const disclosed = LOBBY_SHOWCASE_STAGE_ID_SET.has(stage.id);
  const spoilerSafe = stageWorldFor(stage.id)?.editorial?.spoilerSafe ?? null;
  const presentation = stagePresentationFor(stage.id);
  return {
    stage,
    disclosed,
    sequenceLabel: String(stage.sequence).padStart(2, "0"),
    stageName: disclosed ? stage.name : spoilerSafe?.title ?? stage.name,
    bossName: disclosed ? stage.bossName : "미확인 위협",
    domain: disclosed ? `${presentation.mapLabels.title} · ${presentation.mapLabels.domain}` : "좌표 봉인 · 배치 후 공개",
    threat: disclosed ? `${presentation.terrain.label} · ${presentation.mapLabels.hazard}` : "위협 등급 미상",
    objective: disclosed ? stageObjective(stage.id) : spoilerSafe?.summary ?? "상세 위협은 출전 전까지 봉인됩니다.",
    reward: disclosed ? nextRewardName(stage.id) : spoilerSafe?.rewardHint ?? "봉쇄 완료 후 공개",
  };
}

/** Derives the checked strategy preset from the STORED formation intent rather than holding
 * a second copy of it: the 군단 → 편성 tab writes the same campaign.companionFormation map,
 * so a hand-built mix there must show up here as CUSTOM instead of silently claiming a
 * preset the player never chose. */
function activeLobbyStrategyId() {
  const loadout = selectedLoadout();
  if (!loadout.length) return LOBBY_STRATEGY_CUSTOM;
  const stored = loadout.map((id) => campaign?.companionFormation?.[id] || "BACK");
  const match = LOBBY_STRATEGY_PRESETS.find((preset) => stored.every((slot, index) => slot === preset.slotFor(index)));
  return match?.id ?? LOBBY_STRATEGY_CUSTOM;
}

/** Applies a preset by writing every deployed companion's slot through the campaign-state
 * API the 편성 tab already uses -- no parallel persistence path, so both surfaces stay one
 * source of truth. Returns false when nothing changed, so a redundant tap does not spend a
 * storage write. */
function applyLobbyStrategy(presetId) {
  const preset = LOBBY_STRATEGY_PRESETS.find((entry) => entry.id === presetId);
  const loadout = selectedLoadout();
  if (!preset || !loadout.length) return false;
  let changed = false;
  loadout.forEach((prototypeId, index) => {
    const slot = preset.slotFor(index);
    if ((campaign.companionFormation?.[prototypeId] || "BACK") === slot) return;
    campaign = setCompanionFormationSlot(campaign, prototypeId, slot);
    changed = true;
  });
  return changed;
}

/** Toggles one companion in/out of the 3-slot deployment through setCompanionLoadout(), which
 * owns the size validation. Returns false when the toggle would be rejected (roster full), so
 * the caller can leave the persisted state and the preview run untouched. */
function toggleLobbyCompanion(prototypeId) {
  const loadout = selectedLoadout();
  const next = loadout.includes(prototypeId)
    ? loadout.filter((id) => id !== prototypeId)
    : [...loadout, prototypeId];
  if (next.length === loadout.length) return false;
  const updated = setCompanionLoadout(campaign, next);
  if (updated === campaign) return false;
  campaign = updated;
  return true;
}

/** Static skeleton for #lobby-cinematic, mounted ONCE by mountShell(). Text nodes are filled
 * by renderLobbyCinematic()/BattleSession.updateLobbyCinematic() so the per-frame camera and
 * dialogue passes never re-parse markup. Ids match ui/lobby-cinematic-spec.md §2. */
function lobbyCinematicMarkup() {
  return `
    <div id="lobby-cinematic" class="lobby-cinematic" data-active="true" data-framing="wide" data-speaker="commander">
      <div class="lobby-cine-vignette" aria-hidden="true"></div>
      <header class="lobby-cine-head">
        <p class="lobby-brand-lockup" aria-label="Abyssal Lantern, 심연의 등불"><span>ABYSSAL</span><b>LANTERN</b><small>심연의 등불</small></p>
        <p class="lobby-cine-eyebrow">LANTERN ROUTE · STAGE <span id="lobby-cine-seq"></span></p>
        <h1 class="lobby-cine-stage" id="lobby-cine-stage"></h1>
        <p class="lobby-cine-domain" id="lobby-cine-domain"></p>
      </header>
      <div class="lobby-boss-plate" id="lobby-boss-plate" data-visible="false">
        <span class="lobby-boss-eyebrow">STAGE THREAT</span>
        <strong class="lobby-boss-name" id="lobby-boss-name"></strong>
        <span class="lobby-boss-threat" id="lobby-boss-threat"></span>
      </div>
      <section class="lobby-objective" aria-labelledby="lobby-objective-title">
        <h2 class="lobby-objective-title" id="lobby-objective-title">작전 목표 · OBJECTIVE</h2>
        <p class="lobby-objective-text" id="lobby-objective-text"></p>
        <p class="lobby-objective-reward" id="lobby-objective-reward"></p>
      </section>
      <output class="lobby-dialogue" id="lobby-dialogue" role="status" aria-live="polite">
        <span class="lobby-dialogue-portrait" id="lobby-dialogue-portrait" aria-hidden="true"></span>
        <span class="lobby-dialogue-bubble">
          <b class="lobby-dialogue-speaker" id="lobby-dialogue-speaker"></b>
          <span class="lobby-dialogue-text" id="lobby-dialogue-text"></span>
        </span>
      </output>
      <section class="lobby-setup" id="lobby-setup" aria-label="출전 준비">
        <div class="lobby-setup-block" data-setup="strategy">
          <h3 class="lobby-setup-title">전략 배치 · FORMATION</h3>
          <div class="lobby-strategy-row" role="radiogroup" aria-label="전략 편성" id="lobby-strategy-row"></div>
          <p class="lobby-setup-hint" id="lobby-strategy-hint"></p>
        </div>
        <div class="lobby-setup-block" data-setup="companions">
          <h3 class="lobby-setup-title">동료 선택 · SQUAD <small id="lobby-companion-count"></small></h3>
          <div class="lobby-companion-row" id="lobby-companion-row"></div>
          <p class="lobby-setup-hint" id="lobby-companion-hint"></p>
        </div>
      </section>
    </div>`;
}

/** Repaints every campaign-driven part of the lobby overlay (stage identity, objective,
 * strategy row, companion chips) and rebinds their handlers. Called from renderShell(), so
 * it re-runs on exactly the same beats as the decks -- one render dispatcher, not two. The
 * per-frame camera/dialogue pass lives separately in BattleSession.updateLobbyCinematic(). */
function renderLobbyCinematic() {
  const overlay = root.querySelector("#lobby-cinematic");
  if (!overlay || !campaign) return;
  const requiredNodes = [
    "#lobby-cine-seq", "#lobby-cine-stage", "#lobby-cine-domain",
    "#lobby-boss-name", "#lobby-boss-threat", "#lobby-objective-text",
    "#lobby-objective-reward",
  ];
  if (requiredNodes.some((selector) => !overlay.querySelector(selector))) return;
  const started = session?.started ?? false;
  overlay.dataset.active = started ? "false" : "true";
  if (started) return;

  const facts = lobbyStageFacts(selectedStageId);
  overlay.querySelector("#lobby-cine-seq").textContent = facts.sequenceLabel;
  overlay.querySelector("#lobby-cine-stage").textContent = facts.stageName;
  overlay.querySelector("#lobby-cine-domain").textContent = facts.domain;
  overlay.querySelector("#lobby-boss-name").textContent = facts.bossName;
  overlay.querySelector("#lobby-boss-threat").textContent = facts.threat;
  overlay.querySelector("#lobby-objective-text").textContent = facts.objective;
  overlay.querySelector("#lobby-objective-reward").textContent = `승리 시 → ${facts.reward}`;

  const activeStrategy = activeLobbyStrategyId();
  const loadout = selectedLoadout();
  const strategyRow = overlay.querySelector("#lobby-strategy-row");
  strategyRow.innerHTML = LOBBY_STRATEGY_PRESETS.map((preset) => `
    <button type="button" class="lobby-strategy" data-strategy="${escapeHtml(preset.id)}" role="radio" aria-checked="${preset.id === activeStrategy}" aria-label="${escapeHtml(preset.label)} 전략 선택"${loadout.length ? "" : " disabled"}><b aria-hidden="true">${preset.glyph}</b><span>${escapeHtml(preset.label)}</span></button>`).join("");
  const activePreset = LOBBY_STRATEGY_PRESETS.find((preset) => preset.id === activeStrategy);
  overlay.querySelector("#lobby-strategy-hint").textContent = loadout.length
    ? activePreset?.hint ?? "군단 → 편성 탭에서 직접 지정한 혼합 편성입니다."
    : "결속한 동료가 없어 전략 편성을 적용할 수 없습니다.";

  const collection = campaign.companionCollection ?? [];
  const companionRow = overlay.querySelector("#lobby-companion-row");
  companionRow.innerHTML = collection.length
    ? collection.map((prototypeId) => {
      const deployed = loadout.includes(prototypeId);
      const roleName = COMPANION_ROLES[roleForCompanion(prototypeId)]?.name ?? "미분류";
      const full = !deployed && loadout.length >= 3;
      return `
        <button type="button" class="lobby-companion-chip rc-lift" data-companion="${escapeHtml(prototypeId)}" aria-pressed="${deployed}" aria-label="${escapeHtml(companionLabel(prototypeId))} ${deployed ? "출전 해제" : "출전 편성"}"${full ? " disabled" : ""}><span class="lobby-companion-glyph" aria-hidden="true">${companionGlyph(prototypeId)}</span><b class="lobby-companion-name">${escapeHtml(companionLabel(prototypeId))}</b><small class="lobby-companion-role">${escapeHtml(roleName)}</small></button>`;
    }).join("")
    : `<p class="lobby-companion-empty">아직 결속한 동료가 없습니다. 전투에서 정예를 처치한 뒤 추출하세요.</p>`;
  overlay.querySelector("#lobby-companion-count").textContent = `${loadout.length}/3`;
  overlay.querySelector("#lobby-companion-hint").textContent = collection.length
    ? loadout.length >= 3
      ? "출전 슬롯이 가득 찼습니다. 해제하려면 편성된 동료를 다시 누르세요."
      : "최대 3명까지 편성할 수 있습니다."
    : "정예 추출로 동료를 확보하면 이곳에서 바로 편성할 수 있습니다.";

  strategyRow.querySelectorAll("[data-strategy]").forEach((button) => {
    button.addEventListener("click", () => {
      if (session?.started) return;
      if (!applyLobbyStrategy(button.dataset.strategy)) return;
      void persistCampaign("전략 편성을 저장했습니다.");
      session?.remountForStage(selectedStageId);
      renderShell();
    });
  });
  companionRow.querySelectorAll("[data-companion]").forEach((button) => {
    button.addEventListener("click", () => {
      if (session?.started) return;
      if (!toggleLobbyCompanion(button.dataset.companion)) return;
      void persistCampaign("출전 동료를 저장했습니다.");
      session?.remountForStage(selectedStageId);
      renderShell();
    });
  });
}



function companionLabel(prototype) {
  return COMPANIONS[prototype]?.name ?? prototype;
}

function growthUpgradePreview(skillId, snapshot) {
  const skill = SKILLS[skillId] ?? {};
  const currentValue = snapshot.commander.skillRanks[skillId] ?? 0;
  const upgradedValue = currentValue + 1;
  // Rank math must mirror the simulation exactly (defense-catalog.js SKILL_RANK_*): a rank-up banks
  // a share of the passive effect, and scales an active's damage up and its cooldown down.
  const passiveShare = currentValue ? SKILL_RANK_PASSIVE_SHARE : 1;
  const rankDamage = (rank) => Math.round((skill.damage || 0) * (1 + SKILL_RANK_DAMAGE_STEP * (rank - 1)));
  const rankCooldown = (rank) => Math.max(1, Math.trunc((skill.cooldown || 0)
    * Math.max(SKILL_RANK_COOLDOWN_FLOOR, 1 - SKILL_RANK_COOLDOWN_STEP * (rank - 1))));
  const details = [`등급 ${currentValue} → ${upgradedValue}`];
  if (skill.basicDamage) details.push(`기본 공격 ${snapshot.commander.basicDamage} → ${snapshot.commander.basicDamage + Math.round(skill.basicDamage * passiveShare)}`);
  if (skill.pickupRange) details.push(`회수 반경 ${snapshot.commander.pickupRange} → ${snapshot.commander.pickupRange + Math.round(skill.pickupRange * passiveShare)}`);
  if (skill.maxIntegrity) details.push(`최대 내구 ${snapshot.commander.maxIntegrity} → ${snapshot.commander.maxIntegrity + Math.round(skill.maxIntegrity * passiveShare)}`);
  if (skill.damage) details.push(`피해 ${currentValue ? rankDamage(currentValue) : 0} → ${rankDamage(upgradedValue)}`);
  if (skill.integrity) details.push(`회복 ${currentValue ? skill.integrity : 0} → ${skill.integrity}`);
  if (skill.cooldown) details.push(`재사용 ${(rankCooldown(upgradedValue) / TICK_RATE).toFixed(1)}초`);
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

function extractedSkillsMarkup(data) {
  const progress = campaign.storyProgress;
  const availableEcho = data.echoEarned - data.echoSpent;
  const equipped = new Set(progress.activeSkillLoadout);
  const loadoutFull = equipped.size >= MAX_EXTRACTED_SKILL_LOADOUT;
  const rows = progress.extractedSkillIds
    .filter((skillId) => SKILLS[skillId]?.kind === "active")
    .map((skillId) => {
      const skill = SKILLS[skillId];
      const level = progress.extractedSkillLevels[skillId] ?? 1;
      const maxed = level >= MAX_EXTRACTED_SKILL_LEVEL;
      const targetLevel = maxed ? level : level + 1;
      const upgradeCost = maxed ? null : extractedSkillUpgradeCostForLevel(targetLevel);
      const isEquipped = equipped.has(skillId);
      const equipDisabled = !isEquipped && loadoutFull;
      const upgradeDisabled = maxed || upgradeCost > availableEcho;
      return `
        <div class="extracted-skill-card rc-lift${isEquipped ? " is-equipped" : ""}" data-extracted-skill="${escapeHtml(skillId)}">
          <span class="progression-icon" data-track="run-scoped" aria-hidden="true"></span>
          <div class="extracted-skill-copy">
            <strong>${escapeHtml(skill.name ?? skillId)}</strong>
            <small>추출 액티브 · Lv ${level}/${MAX_EXTRACTED_SKILL_LEVEL} · ${isEquipped ? "장착 중" : "보관 중"}</small>
          </div>
          <button type="button" data-extracted-skill-toggle="${escapeHtml(skillId)}" aria-pressed="${isEquipped}" ${equipDisabled ? "disabled" : ""}>${isEquipped ? "해제" : loadoutFull ? `장착 ${MAX_EXTRACTED_SKILL_LOADOUT}/${MAX_EXTRACTED_SKILL_LOADOUT}` : "장착"}</button>
          <button type="button" data-extracted-skill-upgrade="${escapeHtml(skillId)}" ${upgradeDisabled ? "disabled" : ""}>${maxed ? "최대 Lv 5" : `Lv ${targetLevel} (${upgradeCost} EC)`}</button>
        </div>`;
    }).join("");
  return rows || `<p class="section-copy">전선을 완료하면 추출 액티브 스킬이 이곳에 기록됩니다.</p>`;
}

function appearanceItemsMarkup() {
  const progress = campaign.storyProgress;
  const storiesByItem = new Map(Object.values(STAGE_STORIES).map((story) => [story.appearanceReward.id, story]));
  const rows = progress.appearanceItemIds.map((itemId) => {
    const reward = storiesByItem.get(itemId)?.appearanceReward;
    if (!reward) return "";
    const equipped = progress.equippedAppearance[reward.slot] === itemId;
    return `
      <div class="appearance-item-card rc-lift${equipped ? " is-equipped" : ""}" data-appearance-slot="${escapeHtml(reward.slot)}">
        <span class="appearance-item-mark" aria-hidden="true">◇</span>
        <div><strong>${escapeHtml(reward.name)}</strong><small>${escapeHtml(reward.slot)} 슬롯 · ${equipped ? "착용 중" : "보유"}</small></div>
        <button type="button" data-appearance-item="${escapeHtml(itemId)}" aria-pressed="${equipped}" ${equipped ? "disabled" : ""}>${equipped ? "착용 중" : "착용"}</button>
      </div>`;
  }).join("");
  return rows || `<p class="section-copy">스토리 전선의 외형 보상을 아직 획득하지 못했습니다.</p>`;
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

/** Shared shell for one left-deck section (ui/dock-removal-plan.md §4.1). Icon-led
 * heading + a numeric state chip + the body. The heading plate is aria-hidden and the
 * readable name lives in the <h2>, so swapping glyph for image is invisible to assistive
 * tech; a section without a generated plate renders its text glyph instead, which is the
 * same missing-asset degradation the old rail had. */
function deckSectionMarkup(id, { titleId, chipHtml = "", bodyHtml }) {
  const section = LEFT_DECK_SECTIONS.find((entry) => entry.id === id);
  const mark = section.iconId
    ? `<span class="deck-section-icon" data-ui-icon="${section.iconId}" aria-hidden="true"></span>`
    : `<span class="deck-section-icon" aria-hidden="true">${section.icon}</span>`;
  return `
    <section class="deck-section command-screen" id="deck-section-${id}" tabindex="-1" aria-labelledby="${titleId}">
      <div class="deck-section-head">${mark}<h2 id="${titleId}">${escapeHtml(section.label)}</h2><span class="deck-section-chips">${chipHtml}</span></div>
      <div class="deck-section-body">${bodyHtml}</div>
    </section>`;
}

/** Currency/state chip: the generated plate carries the unit, so no "EC"/"BF" text is
 * printed next to the number (ui/dock-removal-plan.md §5). The unit name is still spoken
 * -- role="img" + aria-label -- so the figure is never unit-less to a screen reader. */
function deckCurrencyChip(kind, amount, unitName) {
  return `<span class="deck-chip deck-chip-${kind}" role="img" aria-label="${escapeHtml(`${unitName} 잔량 ${amount}`)}"><span class="deck-chip-glyph" data-ui-icon="currency-${kind}" aria-hidden="true"></span><b>${amount}</b></span>`;
}

/** 인벤토리 section: story appearance rewards followed by the existing 3-slot x 5-tier
 * equipment ladder. Cosmetics are presentation-only campaign state; equipment remains the
 * existing permanent-stat authority. */
function renderInventorySection(data) {
  const bf = data.fragEarned - data.fragSpent;
  return deckSectionMarkup("inventory", {
    titleId: "inventory-title",
    chipHtml: deckCurrencyChip("bound-fragment", bf, "속박 파편"),
    bodyHtml: `
      <div class="deck-subsection"><h3 class="deck-subhead">외형 장비</h3><div class="appearance-item-grid">${appearanceItemsMarkup()}</div></div>
      <div class="deck-subsection"><h3 class="deck-subhead">장비 티어</h3><div class="growth-equip-grid">${equipmentOwnersMarkup(data)}</div></div>`,
  });
}

/** 스킬 section: extracted active loadout plus the existing permanent skill tree. They are
 * separate authorities: extracted ranks enter a run, while tree nodes modify permanent stats. */
function renderSkillSection(data) {
  const ec = data.echoEarned - data.echoSpent;
  return deckSectionMarkup("skills", {
    titleId: "skills-title",
    chipHtml: `${deckCurrencyChip("echo-core", ec, "에코 코어")}<span class="deck-chip deck-chip-level"><b>Lv ${data.level}</b></span>`,
    bodyHtml: `
      <div class="deck-subsection"><h3 class="deck-subhead">추출 액티브 · ${campaign.storyProgress.activeSkillLoadout.length}/${MAX_EXTRACTED_SKILL_LOADOUT}</h3><div class="extracted-skill-grid">${extractedSkillsMarkup(data)}</div></div>
      <div class="deck-subsection"><h3 class="deck-subhead">영구 스킬 트리</h3><div class="growth-skill-grid">${wardenSkillsMarkup(data)}</div></div>`,
  });
}

/** 성장 section: 스탯 + 특성.
 *
 * This section is the ONE documented exception to "no scrolling outside 인벤토리". Measured
 * at 824px against a 251px band (+485 portrait, +589 landscape), and every alternative was
 * rejected on measurement:
 *   - splitting it into 스탯 / 특성 chips needs a 5th segment, and 5 chips at the 48dp floor
 *     need 252px in a bar that measures 203px at landscape;
 *   - shrinking the type further collides with the same 48dp floor on the +/- controls;
 *   - dropping either surface would remove a permanent-progression axis the player spends
 *     Echo Core on, which is not "필요한 요소만" -- it is removing a required element.
 * So the scroll is scoped to THIS section's own body wrapper: the status window and the
 * section heading stay pinned, and 인벤토리 / 스킬 / 군단 remain non-scrolling. One explicit
 * exception is honest; four silent ones would not be. */
function renderGrowthSection(data) {
  const ec = data.echoEarned - data.echoSpent;
  return deckSectionMarkup("growth", {
    titleId: "growth-title",
    chipHtml: `${deckCurrencyChip("echo-core", ec, "에코 코어")}<span class="deck-chip deck-chip-level"><b>Lv ${data.level}</b></span>`,
    bodyHtml: `
      <div class="deck-subsection"><h3 class="deck-subhead">스탯</h3><div class="growth-stat-grid">${wardenStatsMarkup(data)}</div></div>
      <div class="deck-subsection"><h3 class="deck-subhead">특성</h3>${wardenTraitsMarkup(data)}</div>`,
  });
}

/** 군단 section: bond slots + roster (IA screen #5) and 편성 (IA screen #6) together.
 * They were two segments of one tab; both are views of the same three loadout slots, so
 * mounting both removes a tap without adding a screen. Portraits carry the identity --
 * the roster is a picture grid, not a list of names. */
function renderLegionSection(data) {
  const collection = campaign.companionCollection;
  const slotsHtml = [0, 1, 2].map((index) => {
    const prototype = data.loadout[index];
    return prototype
      ? `<div class="loadout-slot is-filled">${portraitMarkup(meshRootForCompanion(prototype), companionGlyph(prototype), "rc-portrait rc-portrait-sm")}<strong>${escapeHtml(companionLabel(prototype))}</strong><small>결속 ${index + 1}</small></div>`
      : `<div class="loadout-slot"><span class="slot-plus">+</span><small>빈 슬롯</small></div>`;
  }).join("");
  const rosterHtml = collection.length
    ? collection.map((record) => `<button class="companion-card rc-lift${data.loadout.includes(record.prototype) ? " is-selected rc-glow-ring" : ""}" data-companion="${record.prototype}" aria-pressed="${data.loadout.includes(record.prototype)}">${portraitMarkup(meshRootForCompanion(record.prototype), companionGlyph(record.prototype), "rc-portrait rc-portrait-md")}<span><strong>${escapeHtml(companionLabel(record.prototype))}</strong><small>진화 ${record.evolution} · 추출 ${record.capturedEliteIds.length}</small></span><i>${data.loadout.includes(record.prototype) ? "편성됨" : "편성"}</i></button>`).join("")
    : `<div class="empty-companions"><span class="companion-glyph">?</span><div><strong>결속한 동료가 없습니다.</strong><p>정예를 쓰러뜨린 뒤 <b>추출</b>하세요.</p></div></div>`;
  return deckSectionMarkup("legion", {
    titleId: "companion-title",
    chipHtml: `<span class="deck-chip deck-chip-count" role="img" aria-label="편성 ${data.loadout.length} / 정원 3"><b>${data.loadout.length}/3</b></span>`,
    bodyHtml: `
      <div class="loadout-slots" aria-label="현재 동료 편성">${slotsHtml}</div>
      <div class="companion-grid">${rosterHtml}</div>
      <div class="deck-subsection"><h3 class="deck-subhead">편성</h3>${formationRowMarkup(data)}</div>`,
  });
}

/** Record-management tools, mounted OUTSIDE the right deck's switched region.
 *
 * `#import-defense` must be in the DOM with zero interaction: it is a documented load-time
 * contract (`tests/defense-stat-delta-browser.test.mjs` waits on it immediately after
 * `goto`, with no tap). Since the right deck now renders one section at a time and defaults
 * to 출정, leaving these inside 요새 would put record management behind a segment tap and
 * break that contract. They stay collapsed inside their own `<details>`, so the cost of
 * always mounting them is one summary row. */
function audioSettingsMarkup() {
  const muted = session?.audio?.muted ?? false;
  const volume = session?.audio?.volume ?? 1.0;
  return `
    <div class="shell-audio-settings" role="group" aria-label="오디오 설정">
      <div class="audio-control-row">
        <button type="button" id="shell-audio-mute-btn" class="audio-mute-button" aria-pressed="${muted}" aria-label="음소거 토글">
          <span>${muted ? "소리 켜기" : "음소거"}</span>
        </button>
        <div class="audio-volume-slider-container">
          <label id="shell-volume-label" for="shell-audio-volume">볼륨: ${Math.round(volume * 100)}%</label>
          <input type="range" id="shell-audio-volume" min="0" max="1" step="0.05" value="${volume}" aria-labelledby="shell-volume-label" />
        </div>
      </div>
    </div>`;
}

function recordToolsMarkup() {
  return `
    <details class="archive-tools"><summary>기록 관리 <span>오프라인 저장 · ${escapeHtml(storage.backend ?? "확인 중")}</span></summary><div class="storage-row" aria-label="캠페인 제어"><button id="export-defense">기록 내보내기</button><label class="import-label">기록 가져오기<input id="import-defense" type="file" accept="application/json,text/plain" /></label><button id="export-telemetry">진단 내보내기</button><button id="reset-defense">새 기록</button><output aria-live="polite">${escapeHtml(statusText)}</output></div></details>`;
}

/** 요새 (right deck): permanent rewards + idle-return recap. The recap paragraph persists
 * here (unlike the one-shot load-time toast) so a player who dismissed the toast can still
 * re-read what happened offline. Record tools live in recordToolsMarkup() instead -- see
 * why there. */
function renderStrongholdTab() {
  const completed = campaign.resolvedIds?.length ?? 0;
  const idleSummary = idleReturnSummary();
  return `
    <section class="archive-panel command-screen" id="ops-section-stronghold" aria-labelledby="reward-title">
      <p class="idle-return-recap idle-return-banner" data-idle-return-outcome="${escapeHtml(idleSummary.outcome)}" data-idle-return-total="${idleSummary.total}" aria-live="polite">${escapeHtml(idleSummary.text)}</p>
      <div class="panel-heading"><span class="panel-mark" data-ui-icon="nav-stronghold" aria-hidden="true"></span><div><p class="eyebrow">ECHO DEEP</p><h2 id="reward-title">요새</h2></div></div>
      <div class="archive-summary"><span class="archive-ring"><b>${completed}</b><small>전선<br />완료</small></span><div class="reward-mark-row" aria-hidden="true">${(campaign.rewardIds ?? []).slice(0, 4).map(() => `<span class="reward-pip"></span>`).join("")}</div></div>
      <div class="reward-grid">${(campaign.rewardIds?.length ?? 0) ? campaign.rewardIds.map((id) => `<article class="reward-card rc-lift rc-glass"><span class="reward-mark">✦</span><strong>${escapeHtml(REWARDS[id]?.name ?? id)}</strong><span>${escapeHtml(REWARDS[id]?.description ?? "기록된 보상")}</span></article>`).join("") : `<p class="empty-archive">첫 보스를 봉쇄하면 영구 보상을 선택할 수 있습니다.</p>`}</div>
    </section>`;
}

/** 저지 레벨 → 시스템 랭크 표기 (표시 전용, 시뮬레이션에 영향 없음). */
function monarchRankFor(level) {
  if (level >= 25) return "S";
  if (level >= 20) return "A";
  if (level >= 15) return "B";
  if (level >= 10) return "C";
  if (level >= 5) return "D";
  return "E";
}

/**
 * 로비 상단 시스템 상태창(표시 전용): 저지 레벨 / 그림자 마력(잔여 Echo Core)
 * / 군단 정원 / 결속 병력 / 추출 기록을 한 창에 모아 보여준다.
 * campaign 과 wardenGrowthData() 를 읽기만 하며 어떤 상태도 기록하지 않는다.
 */
function monarchStatusMarkup() {
  const data = wardenGrowthData();
  const mana = Math.max(0, data.echoEarned - data.echoSpent);
  const manaRatio = data.echoEarned > 0 ? Math.min(1, Math.max(0, mana / data.echoEarned)) : 0;
  const manaPercent = Math.round(manaRatio * 100);
  const collection = campaign.companionCollection ?? [];
  const extracted = new Set(collection.flatMap((record) => record.capturedEliteIds ?? [])).size;
  const rank = monarchRankFor(data.level);
  return `
    <section id="monarch-status" class="monarch-status command-screen system-window" aria-labelledby="monarch-status-title">
      <div class="panel-heading">${portraitMarkup(COMMANDER_MESH_ROOT, "DW", "monarch-portrait rc-portrait")}<div><p class="eyebrow">SYSTEM WINDOW · SHADOW LEGION</p><h2 id="monarch-status-title">시스템 상태창</h2></div><span class="rank-badge">RANK ${rank}</span></div>
      <div class="monarch-gauge" data-monarch-mana-percent="${manaPercent}">
        <p class="monarch-gauge-label"><span>그림자 마력 (Echo Core)</span><b id="monarch-mana-readout">${mana} / ${data.echoEarned} EC</b></p>
        <div class="monarch-gauge-track" role="img" aria-label="그림자 마력 잔량 ${manaPercent}%"><span id="monarch-mana-fill" class="monarch-gauge-fill" style="width: ${manaPercent}%"></span></div>
      </div>
      <dl class="monarch-stat-grid">
        <div><dt>저지 레벨</dt><dd>Lv ${data.level}</dd></div>
        <div><dt>군단 정원</dt><dd>${data.loadout.length}/3</dd></div>
        <div><dt>결속 병력</dt><dd>${collection.length}</dd></div>
        <div><dt>추출 기록</dt><dd>${extracted}</dd></div>
      </dl>
      <p class="monarch-arise-hint"><span class="monarch-arise-chip">ARISE</span><span class="monarch-arise-pips" role="img" aria-label="추출한 정예 ${extracted}">${Array.from({ length: Math.min(extracted, 6) }, () => `<i></i>`).join("")}</span></p>
    </section>`;
}



/**
 * Persistent RPG command decks (20260729-ui-dock-removal, ui/dock-removal-plan.md §4):
 * renders into the persistent sibling nodes mounted once by mountShell() --
 * #command-deck-left, #command-deck-right, #start-defense.sortie-fab, #idle-return-toast --
 * and NEVER touches #defense-battle-surface, which lives for the whole page lifetime.
 * Both decks are screen-space fixed columns on the viewport edges; the live 3D scene
 * (frozen at tick-0 until session.started) is always visible in the band between them.
 * There is no open/close mechanic: a deck is either mounted (pre-run) or emptied (mid-run).
 */

/** Shared shell for one deck column: sticky masthead + scrolling body. No open/close arg,
 * no tablist, no close button -- the whole point of this pass. */
function renderDeckSide({ side, mastheadHtml, bodyHtml, deckLabel }) {
  const container = root.querySelector(`#command-deck-${side}`);
  if (!container) return;
  container.innerHTML = `
    <section class="command-deck rc-glass" data-deck-side="${side}" aria-label="${escapeHtml(deckLabel)}">
      <header class="deck-masthead">${mastheadHtml}</header>
      <div class="deck-body">${bodyHtml}</div>
    </section>`;
  hydratePortraits(container);
  return container;
}

/** Left deck masthead: an always-visible segment bar that switches which section occupies the
 * deck body. Not a disclosure mechanic and not a slide menu -- the bar never scrolls away,
 * every label is permanently on screen, and switching is a single tap with no reveal
 * animation. It exists because mounting all four sections at once measured a 3505px scroll
 * height in a 325px body; scrolling belongs to 인벤토리's own list, not to the deck.
 * Each chip carries its icon plate plus a visible label, so the control is readable without
 * relying on the icon alone. */
function segmentBarMarkup({ sections, activeId, attr, label }) {
  return `<nav class="deck-segment-bar" role="tablist" aria-label="${escapeHtml(label)}">${sections.map((section) => {
    const active = section.id === activeId;
    const mark = section.iconId
      ? `<span class="deck-jump-icon" data-ui-icon="${section.iconId}" aria-hidden="true"></span>`
      : `<span class="deck-jump-icon" aria-hidden="true">${section.icon}</span>`;
    // aria-label rather than a parallel .sr-only span: the short-viewport block in
    // styles.css hides .deck-segment-label with `display: none`, which removes it from the
    // accessibility tree too, and the icon plate is aria-hidden. Without this the
    // role="tab" buttons would have no accessible name at all in landscape. An aria-label
    // also avoids the duplicate announcement a visible label plus .sr-only would produce.
    //
    // Deliberately NO `aria-controls`: only ONE section is mounted at a time, so a reference
    // from every chip would dangle for every inactive tab -- measured, both right-deck
    // targets resolved to nothing. `role="tab"` + `aria-selected` already convey the
    // relationship, and a dangling aria-controls is worse than an absent one.
    return `<button type="button" class="deck-segment${active ? " is-active" : ""}" role="tab" aria-selected="${active}" aria-label="${escapeHtml(section.label)}" ${attr}="${section.id}">${mark}<span class="deck-segment-label">${escapeHtml(section.label)}</span></button>`;
  }).join("")}</nav>`;
}

function deckSegmentBarMarkup() {
  return segmentBarMarkup({
    sections: LEFT_DECK_SECTIONS,
    activeId: activeLeftSection,
    attr: "data-deck-section",
    label: "캐릭터 시트 구역",
  });
}

/** Right deck masthead bar. Same contract as the left: always visible, no slide gesture,
 * one section mounted at a time. 요새's record tools stay OUTSIDE the switched region (see
 * renderCommandDeckRight) so `#import-defense` remains in the DOM with zero interaction --
 * `tests/defense-stat-delta-browser.test.mjs` waits on it right after load. */
function rightDeckSegmentBarMarkup() {
  return segmentBarMarkup({
    sections: RIGHT_DECK_SECTIONS,
    activeId: activeRightSection,
    attr: "data-ops-section",
    label: "전황 시트 구역",
  });
}

/** 캐릭터 시트 (left deck): the compact status window plus exactly ONE of
 * 인벤토리 / 성장 / 군단. #monarch-status stays the first element child of .deck-body -- it
 * summarises what this deck governs (저지 레벨 / 그림자 마력 / 군단 정원 / 결속 병력) and the
 * section below spends against those numbers. */
function renderCommandDeckLeft() {
  if (!campaign) return;
  const data = wardenGrowthData();
  const sectionHtml = activeLeftSection === "skills"
    ? renderSkillSection(data)
    : activeLeftSection === "growth"
      ? renderGrowthSection(data)
      : activeLeftSection === "legion"
        ? renderLegionSection(data)
        : renderInventorySection(data);
  const deck = renderDeckSide({
    side: "left",
    deckLabel: "캐릭터 시트",
    mastheadHtml: deckSegmentBarMarkup(),
    bodyHtml: `${monarchStatusMarkup()}${sectionHtml}`,
  });
  if (!deck) return;
  deck.querySelectorAll("[data-deck-section]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.deckSection === activeLeftSection) return;
      activeLeftSection = button.dataset.deckSection;
      renderShell();
      root.querySelector(`#command-deck-left [data-deck-section="${activeLeftSection}"]`)?.focus?.();
    });
  });
  deck.querySelectorAll("[data-companion]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prototype = button.dataset.companion;
      const current = selectedLoadout();
      const next = current.includes(prototype) ? current.filter((entry) => entry !== prototype) : [...current, prototype].slice(0, 3);
      campaign = setCompanionLoadout(campaign, next);
      await persistCampaign("동료 편성을 저장했습니다.");
      renderShell();
    });
  });
  // Every growth control is the same shape: read one/two data attributes, call the pure
  // campaign-state transition, persist, re-render. Table instead of five near-identical
  // try/catch blocks. None of these touch live simulation state (CLAUDE.md §2).
  const growthActions = [
    { attr: "data-warden-stat", apply: (el) => allocateWardenStatPoint(campaign, el.dataset.wardenStat), status: "스탯 포인트를 배분했습니다." },
    { attr: "data-warden-skill", apply: (el) => unlockWardenSkillNode(campaign, el.dataset.wardenSkill), status: "스킬 노드를 해금했습니다." },
    { attr: "data-warden-trait", apply: (el) => selectWardenTrait(campaign, el.dataset.wardenTrait), status: "특성을 선택했습니다." },
    { attr: "data-warden-equip-owner", apply: (el) => purchaseEquipmentTier(campaign, el.dataset.wardenEquipOwner, el.dataset.wardenEquipSlot), status: "장비를 강화했습니다." },
    { attr: "data-warden-formation", apply: (el) => setCompanionFormationSlot(campaign, el.dataset.wardenFormation, el.dataset.wardenFormationTarget), status: "편성을 변경했습니다." },
    { attr: "data-extracted-skill-toggle", apply: (el) => toggleExtractedSkill(campaign, el.dataset.extractedSkillToggle), status: "추출 스킬 편성을 저장했습니다." },
    { attr: "data-extracted-skill-upgrade", apply: (el) => upgradeExtractedSkill(campaign, el.dataset.extractedSkillUpgrade), status: "추출 스킬을 강화했습니다." },
    { attr: "data-appearance-item", apply: (el) => equipAppearanceItem(campaign, el.dataset.appearanceItem), status: "외형 장비를 착용했습니다.", syncAppearance: true },
  ];
  for (const { attr, apply, status, syncAppearance = false } of growthActions) {
    deck.querySelectorAll(`[${attr}]`).forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          campaign = apply(button);
          await persistCampaign(status);
          if (syncAppearance) session?.syncAppearanceLoadout?.();
        } catch (error) {
          statusText = error.message;
        }
        renderShell();
      });
    });
  }
}

/** 출정 body: hero-copy and the decorative tactical-map/stage-atlas are dropped -- the live
 * 3D canvas next to this deck IS the battlefield preview now. Every authored fact the atlas
 * held (terrain, hazard, flank, chokepath, elevation, occupation, extraction, landmarks) is
 * folded into briefing-stats.
 *
 * Editorial spoiler discipline is preserved from the authored-stage-presentation pass: only
 * the three STAGE_SHOWCASE_IDS fronts disclose named cards + a tactical briefing. Every
 * other front is reachable through the spoiler-free progression <select> and renders a
 * sealed dossier instead -- no boss name, terrain label, hazard or objective leaks before
 * the player actually deploys there. That is why the flat 10-card stage rail is not used. */
function renderSortieTabBody(selected, selectedPresentation, selectedTerrain, selectedObjective, completed, unlocked, started) {
  const activeModality = session?.inputModality || "keyboard";
  const selectedIndex = STAGES.findIndex(({ id }) => id === selected.id);
  const selectedIsShowcase = LOBBY_SHOWCASE_STAGE_ID_SET.has(selected.id);
  const selectedCleared = campaign.resolvedIds?.includes(selected.id);
  const selectedStatus = selectedCleared ? "CLEAR" : selectedIndex <= campaign.unlockedStageIndex ? "출전 가능" : "잠김";
  const selectedEditorial = stageWorldFor(selected.id)?.editorial?.spoilerSafe;
  const selectedReward = selectedIsShowcase
    ? nextRewardName(selected.id)
    : selectedEditorial?.rewardHint ?? "봉쇄 완료 후 공개";
  const revealedStageCount = STAGE_SHOWCASE_IDS.filter((stageId) => {
    const stageIndex = STAGES.findIndex(({ id }) => id === stageId);
    return stageIndex <= campaign.unlockedStageIndex;
  }).length;
  const minimapNodes = STAGE_SHOWCASE_IDS
    .map((stageId) => stageFor(stageId))
    .map((stage) => {
      const stageIndex = STAGES.findIndex(({ id }) => id === stage.id);
      const locked = stageIndex > campaign.unlockedStageIndex;
      const cleared = campaign.resolvedIds?.includes(stage.id);
      const selectedNode = stage.id === selected.id;
      const state = locked ? "잠김" : started && selectedNode ? "전투 중" : cleared ? "CLEAR" : selectedNode ? "선택됨" : "출전 가능";
      const disclosure = stageWorldFor(stage.id)?.editorial?.spoilerSafe;
      const title = disclosure?.title ?? stage.name;
      const summary = locked
        ? "등불을 전진시켜 이 구역을 밝히세요."
        : CUTSCENES[stage.id]?.intro?.[0] ?? disclosure?.summary ?? "봉쇄 기록을 열람합니다.";
      const disabled = locked || (started && !selectedNode);
      return `
        <button class="stage-map-node${selectedNode ? " is-selected" : ""}${cleared ? " is-cleared" : ""}${locked ? " is-locked" : " is-revealed"}" data-stage-showcase="${escapeHtml(stage.id)}" data-map-index="${stageIndex}" aria-label="${escapeHtml(title)} 미니맵 지점 선택, ${state}" aria-pressed="${selectedNode}" ${disabled ? "disabled" : ""}>
          <span class="stage-map-sigil" aria-hidden="true"><b>${String(stage.sequence).padStart(2, "0")}</b></span>
          <span class="stage-map-copy"><small>${state}</small><strong>${escapeHtml(title)}</strong><span>${escapeHtml(summary)}</span></span>
        </button>`;
    }).join("");
  const progressionOptions = STAGES.map((stage, index) => {
    const locked = index > campaign.unlockedStageIndex;
    const cleared = campaign.resolvedIds?.includes(stage.id);
    const state = locked ? "잠김" : cleared ? "CLEAR" : stage.id === selected.id ? "선택됨" : "출전 가능";
    const disclosure = stageWorldFor(stage.id)?.editorial?.spoilerSafe;
    const title = disclosure?.title ?? stage.name;
    const reward = disclosure?.rewardHint ?? "봉쇄 완료 후 공개";
    return `<option value="${escapeHtml(stage.id)}" data-stage-id="${escapeHtml(stage.id)}" ${stage.id === selected.id ? "selected" : ""} ${locked ? "disabled" : ""}>${String(stage.sequence).padStart(2, "0")} · ${escapeHtml(title)} · ${state} · 보상 ${escapeHtml(reward)}</option>`;
  }).join("");
  const briefingPanel = selectedIsShowcase
    ? `
    <aside class="briefing-panel command-screen" aria-labelledby="briefing-title">
      <div class="panel-heading"><div><p class="eyebrow">TACTICAL BRIEFING · ${escapeHtml(selectedPresentation.mapLabels.domain)}</p><h2 id="briefing-title">작전 브리핑</h2></div><span class="briefing-code">AC-${String(selected.sequence).padStart(2, "0")}</span></div>
      <div class="briefing-target" data-stage-briefing="selected" data-stage-id="${escapeHtml(selected.id)}">${portraitMarkup(meshRootForStageBoss(selected.id), "◉", "target-sigil rc-portrait")}<div><small>${escapeHtml(selectedPresentation.mapLabels.title)} · ${escapeHtml(selectedPresentation.atmosphere.descriptor)}</small><strong>${escapeHtml(selected.bossName)}</strong><span id="briefing-stage-narrative" data-stage-id="${escapeHtml(selected.id)}">${escapeHtml(selectedObjective)}</span></div></div>
      <p class="briefing-reward"><span>승리 시 →</span> <strong>${escapeHtml(selectedReward)}</strong></p>
      <details class="briefing-detail">
        <summary>전황 상세</summary>
        <dl class="briefing-stats">
          <div><dt>지형 / 고지</dt><dd>${escapeHtml(selectedPresentation.terrain.label)} · ${escapeHtml(selectedPresentation.mapLabels.chokepath)} · ${escapeHtml(selectedPresentation.mapLabels.elevation)}</dd></div>
          <div><dt>위협 / 측면</dt><dd>${escapeHtml(selectedPresentation.mapLabels.hazard)} · ${escapeHtml(selectedPresentation.mapLabels.flank)} (${escapeHtml(selectedTerrain.spawnDirections.join(", "))})</dd></div>
          <div><dt>점유 → 추출</dt><dd>${escapeHtml(selectedPresentation.mapLabels.occupation)} → ${escapeHtml(selectedPresentation.mapLabels.extraction)}</dd></div>
          <div><dt>랜드마크</dt><dd>${escapeHtml(selectedPresentation.landmarks.map(({ label }) => label).join(" · "))}</dd></div>
        </dl>
      </details>
      <p class="briefing-tip"><strong>${escapeHtml(selectedPresentation.mapLabels.objective)}</strong></p>
    </aside>`
    : `
    <aside class="briefing-panel command-screen spoiler-safe-briefing" data-stage-disclosure="safe" aria-labelledby="briefing-title">
      <div class="panel-heading"><div><p class="eyebrow">DEPLOYMENT SUMMARY</p><h2 id="briefing-title">출전 요약</h2></div><span class="briefing-code">AC-${String(selected.sequence).padStart(2, "0")}</span></div>
      <div class="safe-briefing-row"><span>전선</span><strong>${escapeHtml(selectedEditorial?.title ?? selected.name)}</strong></div>
      <div class="safe-briefing-row"><span>상태</span><strong>${selectedStatus}</strong></div>
      <div class="safe-briefing-row"><span>보상 단서</span><strong>${escapeHtml(selectedReward)}</strong></div>
      <p class="briefing-tip">${escapeHtml(selectedEditorial?.summary ?? "상세 위협과 전장 구성은 출전 전까지 봉인됩니다.")}</p>
    </aside>`;
  // Order is load-bearing. The progression <select> is the PRIMARY pre-run control -- it is
  // how the player picks a front and it is the only launch-selectable surface for the seven
  // non-showcase stages. It used to sit after the showcase grid, which measured y=1324 in an
  // 844-tall viewport: 1300px of scrolling to reach the one control the deck exists for.
  // Progression now leads, the showcase grid and briefing follow as browse content, and the
  // guide launcher trails. Nothing is removed; the reading order matches the task order.
  return `
    <section class="mission-panel command-screen" id="ops-section-sortie" aria-labelledby="stage-title">
      <div class="panel-heading"><span class="panel-mark" data-ui-icon="nav-sortie" aria-hidden="true"></span><div><p class="eyebrow">LANTERN ROUTE · DEPLOYMENT</p><h2 id="stage-title">등불 항로</h2></div><span class="panel-count">${completed} CLEAR · ${unlocked} OPEN</span></div>
      <div class="stage-progression-control">
        <label for="stage-progression">출전 스테이지 선택</label>
        <select id="stage-progression" data-stage-progress aria-label="출전 스테이지 선택" ${started ? "disabled" : ""}>${progressionOptions}</select>
        <div class="stage-progression-summary" aria-live="polite"><span>${selectedStatus}</span><strong>${escapeHtml(selectedEditorial?.title ?? selected.name)}</strong><small>완료 보상 · ${escapeHtml(selectedReward)}</small></div>
      </div>
      <p class="section-copy sr-only">세 스테이지의 등불 항로와 출전 상태를 확인합니다.</p>
      <div class="stage-sortie-map" data-stage-map data-revealed-count="${revealedStageCount}" aria-label="출전 항로 미니맵, ${revealedStageCount}개 스테이지 밝혀짐">
        <div class="stage-map-fog" aria-hidden="true"></div>
        <div class="stage-map-route" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="stage-map-nodes">${minimapNodes}</div>
      </div>
    </section>
    ${briefingPanel}
    <div class="lobby-guide-launch"><button type="button" data-guide-open aria-label="전투 작전 가이드 열기" aria-haspopup="dialog" aria-controls="lobby-guide-dialog"><span class="guide-launch-mark" aria-hidden="true">?</span><span>조작·전투 가이드</span></button></div>
    <dialog id="lobby-guide-dialog" class="lobby-guide-dialog" aria-labelledby="lobby-guide-title">
      <div class="lobby-guide-shell">
        <div class="panel-heading"><div><p class="eyebrow">ABYSSAL LANTERN · FIELD MANUAL</p><h2 id="lobby-guide-title">전투 작전 가이드</h2></div><button type="button" data-guide-close aria-label="전투 작전 가이드 닫기">닫기</button></div>

        <div class="modality-selectors" role="tablist" aria-label="기기별 조작법">
          <button type="button" id="modality-tab-keyboard" role="tab" class="modality-tab" aria-selected="${activeModality === "keyboard"}" aria-controls="modality-panel-keyboard" tabindex="${activeModality === "keyboard" ? "0" : "-1"}" data-modality-select="keyboard">키보드</button>
          <button type="button" id="modality-tab-pointer" role="tab" class="modality-tab" aria-selected="${activeModality === "pointer"}" aria-controls="modality-panel-pointer" tabindex="${activeModality === "pointer" ? "0" : "-1"}" data-modality-select="pointer">마우스</button>
          <button type="button" id="modality-tab-touch" role="tab" class="modality-tab" aria-selected="${activeModality === "touch"}" aria-controls="modality-panel-touch" tabindex="${activeModality === "touch" ? "0" : "-1"}" data-modality-select="touch">터치</button>
        </div>

        <div class="modality-content" data-active-modality="${activeModality}">
          <div id="modality-panel-keyboard" class="modality-pane" data-pane="keyboard" role="tabpanel" aria-labelledby="modality-tab-keyboard" ${activeModality === "keyboard" ? "" : "hidden"}>
            <ul class="guide-list">
              <li><b>지휘관 이동:</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> (화살표 키)</li>
              <li><b>기본 공격:</b> <kbd>Space</kbd> 또는 <kbd>J</kbd> 키</li>
              <li><b>스탠스 / 스킬 / 정예 추출:</b> <kbd>Tab</kbd> 키로 해당 버튼 포커스 후 <kbd>Space</kbd> 또는 <kbd>Enter</kbd></li>
              <li><b>전투 일시 정지:</b> <kbd>P</kbd> 또는 <kbd>Escape</kbd> 키</li>
              <li><b>카메라 제어:</b> 키보드 포커스 조작 지원</li>
            </ul>
          </div>

          <div id="modality-panel-pointer" class="modality-pane" data-pane="pointer" role="tabpanel" aria-labelledby="modality-tab-pointer" ${activeModality === "pointer" ? "" : "hidden"}>
            <ul class="guide-list">
              <li><b>지휘관 이동:</b> 좌측 하단 D-pad 이동 버튼 클릭</li>
              <li><b>기본 공격:</b> 우측 하단 공격 버튼 클릭</li>
              <li><b>스킬 사용:</b> 활성 스킬 아이콘 클릭</li>
              <li><b>스탠스 전환:</b> 좌측 하단 스탠스 아이콘 클릭</li>
              <li><b>정예 추출:</b> 정예 적 처치 후 우측 하단 추출 버튼 클릭</li>
              <li><b>카메라 회전:</b> 화면 클릭 후 드래그 (Orbit)</li>
              <li><b>카메라 줌:</b> 마우스 휠 스크롤 (Zoom)</li>
              <li><b>일시 정지:</b> 일시 정지 버튼 클릭</li>
            </ul>
          </div>

          <div id="modality-panel-touch" class="modality-pane" data-pane="touch" role="tabpanel" aria-labelledby="modality-tab-touch" ${activeModality === "touch" ? "" : "hidden"}>
            <ul class="guide-list">
              <li><b>지휘관 이동:</b> 전장 화면 좌측 하단 D-pad 방향키 터치 및 홀드</li>
              <li><b>기본 공격:</b> 우측 하단 공격 버튼 터치</li>
              <li><b>스킬 사용:</b> 활성 스킬 아이콘 터치</li>
              <li><b>스탠스 전환:</b> 좌측 하단 스탠스 아이콘 터치</li>
              <li><b>정예 추출:</b> 정예 적 처치 후 우측 하단 추출 버튼 터치</li>
              <li><b>카메라 회전:</b> 전장 화면을 손가락 1개로 드래그 (Orbit)</li>
              <li><b>카메라 줌:</b> 화면 손가락 2개 꼬집기 (Pinch Zoom)</li>
              <li><b>일시 정지:</b> 일시 정지 버튼 터치</li>
            </ul>
          </div>
        </div>

        <div class="lobby-guide-grid">
          <section data-guide-section="companion" aria-labelledby="guide-companion-title"><span aria-hidden="true">01</span><h3 id="guide-companion-title">동료 편성·자율 전투</h3><ol><li><b>군단</b>에서 최대 3명을 출전 편성하세요.</li><li>전열·후열 선호는 다음 출전의 배치 순위에 반영됩니다.</li><li>동료는 자동 교전하고, 멀어지면 지휘관 곁으로 복귀합니다.</li></ol></section>
          <section data-guide-section="extraction" aria-labelledby="guide-extraction-title"><span aria-hidden="true">02</span><h3 id="guide-extraction-title">정예 추출 · ARISE</h3><ol><li>정예를 처치한 뒤 <b>Bind 시작</b>을 누르세요.</li><li>추출 지점 안에서 홀드가 끝날 때까지 버티세요.</li><li><b>정예 추출</b>이 준비되면 눌러 영구 동료로 결속하세요.</li></ol></section>
          <section data-guide-section="skills" aria-labelledby="guide-skills-title"><span aria-hidden="true">03</span><h3 id="guide-skills-title">공격·스킬·쿨다운</h3><ol><li><b>공격</b> 버튼은 언제든 기본 공격을 보냅니다.</li><li>준비된 액티브 스킬을 누르면 즉시 사용합니다.</li><li>레벨업 선택은 이번 런, 성장 탭의 스킬 노드는 영구 적용입니다.</li></ol></section>
        </div>
      </div>
    </dialog>`;
}

/** 전황 시트 (right deck): ONE of 출정 / 요새 at a time, plus the record tools mounted
 * unconditionally beneath them.
 *
 * Measured reason for switching rather than stacking: 출정 + 요새 together came to 1951px of
 * content in a 307px body at portrait, which put the stage-progression control at y=1224 and
 * the guide launcher at y=1935 -- both off-screen with nothing revealing them. Same defect
 * the left deck had, same fix.
 *
 * `recordToolsMarkup()` is appended OUTSIDE the switched section on purpose: `#import-defense`
 * is a zero-interaction load-time contract, so it must not sit behind a segment tap. */
function renderCommandDeckRight() {
  if (!campaign) return;
  const selected = stageFor(selectedStageId);
  // Spoiler discipline: authored presentation/terrain are only resolved for the three
  // editorial showcase fronts. Every other front stays sealed until the player deploys.
  const selectedIsShowcase = LOBBY_SHOWCASE_STAGE_ID_SET.has(selected.id);
  const selectedPresentation = selectedIsShowcase ? stagePresentationFor(selected.id) : null;
  const selectedTerrain = selectedIsShowcase ? stageTerrainProjection(selected.id) : null;
  const completed = campaign.resolvedIds?.length ?? 0;
  const unlocked = campaign.unlockedStageIndex + 1;
  const selectedObjective = stageObjective(selected.id);
  const started = session?.started ?? false;
  root.dataset.stageId = selected.id;
  const frontLabel = selectedIsShowcase
    ? `${escapeHtml(selected.name)} · ${escapeHtml(selected.bossName)}`
    : escapeHtml(stageWorldFor(selected.id)?.editorial?.spoilerSafe?.title ?? selected.name);
  const opsHtml = activeRightSection === "stronghold"
    ? renderStrongholdTab()
    : renderSortieTabBody(selected, selectedPresentation, selectedTerrain, selectedObjective, completed, unlocked, started);
  const deck = renderDeckSide({
    side: "right",
    deckLabel: "전황 시트",
    mastheadHtml: `
      <span class="deck-brand" data-ui-icon="brand-mark" role="img" aria-label="Abyssal Lantern"></span>
      <span class="deck-brand-copy"><b>ABYSSAL LANTERN</b><small>심연의 등불</small></span>
      <p class="deck-front-line" aria-live="polite">${started ? `전투 진행 중 · ${frontLabel}` : frontLabel}</p>
      ${rightDeckSegmentBarMarkup()}`,
    bodyHtml: `${opsHtml}${audioSettingsMarkup()}${recordToolsMarkup()}`,
  });
  if (!deck) return;

  const shellMuteBtn = deck.querySelector("#shell-audio-mute-btn");
  shellMuteBtn?.addEventListener("click", () => {
    if (!session?.audio) return;
    const nextMuted = !session.audio.muted;
    session.audio.setMuted(nextMuted);
    shellMuteBtn.setAttribute("aria-pressed", String(nextMuted));
    const textSpan = shellMuteBtn.querySelector("span");
    if (textSpan) textSpan.textContent = nextMuted ? "소리 켜기" : "음소거";
  });

  const shellVolumeInput = deck.querySelector("#shell-audio-volume");
  shellVolumeInput?.addEventListener("input", (e) => {
    if (!session?.audio) return;
    const val = parseFloat(e.target.value);
    session.audio.setVolume(val);
    const label = deck.querySelector("#shell-volume-label");
    if (label) label.textContent = `볼륨: ${Math.round(val * 100)}%`;
  });

  deck.querySelectorAll("[data-ops-section]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.opsSection === activeRightSection) return;
      activeRightSection = button.dataset.opsSection;
      renderShell();
      root.querySelector(`#command-deck-right [data-ops-section="${activeRightSection}"]`)?.focus?.();
    });
  });
  deck.querySelectorAll("[data-stage-showcase]").forEach((button) => {
    button.addEventListener("click", () => {
      if (session?.started) return; // stage selection is locked to the live front once a run is committed
      selectedStageId = button.dataset.stageShowcase;
      session?.remountForStage(selectedStageId);
      renderShell();
    });
  });
  deck.querySelector("[data-stage-progress]")?.addEventListener("change", (event) => {
    if (session?.started) return;
    const stageId = event.currentTarget.selectedOptions[0]?.dataset.stageId;
    if (!stageId) return;
    selectedStageId = stageId;
    session?.remountForStage(selectedStageId);
    renderShell();
  });
  const guideDialog = deck.querySelector("#lobby-guide-dialog");
  const guideTrigger = deck.querySelector("[data-guide-open]");
  guideTrigger?.addEventListener("click", () => {
    if (!guideDialog?.open) guideDialog?.showModal();
    guideDialog?.querySelector("[data-guide-close]")?.focus();
  });
  guideDialog?.querySelector("[data-guide-close]")?.addEventListener("click", () => guideDialog.close());
  guideDialog?.addEventListener("close", () => guideTrigger?.focus());
  const modalityTabs = [...deck.querySelectorAll("[data-modality-select]")];
  const activateModalityTab = (button, { focus = false } = {}) => {
    session?.updateInputModality(button.dataset.modalitySelect);
    if (focus) deck.querySelector(`[data-modality-select="${button.dataset.modalitySelect}"]`)?.focus();
  };
  modalityTabs.forEach((button, index) => {
    button.addEventListener("click", () => activateModalityTab(button));
    button.addEventListener("keydown", (event) => {
      const last = modalityTabs.length - 1;
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowRight" || event.key === "ArrowDown"
            ? (index + 1) % modalityTabs.length
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? (index - 1 + modalityTabs.length) % modalityTabs.length
              : null;
      if (nextIndex === null) return;
      event.preventDefault();
      event.stopPropagation();
      activateModalityTab(modalityTabs[nextIndex], { focus: true });
    });
  });
  deck.querySelector("#export-defense")?.addEventListener("click", async () => {
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
  deck.querySelector("#export-telemetry")?.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([telemetry.exportJson()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "abyssal-defense-telemetry.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  deck.querySelector("#import-defense")?.addEventListener("change", async (event) => {
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
  deck.querySelector("#reset-defense")?.addEventListener("click", async () => {
    if (session?.started) return;
    await storage.clear();
    campaign = createCampaign({ resetEpoch: campaign.resetEpoch + 1 });
    selectedStageId = STAGES[0].id;
    await persistCampaign("새 기록을 시작했습니다.");
    session?.remountForStage(selectedStageId);
    renderShell();
  });
}

/** SortieFab: fixed bottom-centre floating action button, NOT inside either deck -- the
 * single most important pre-run action is reachable with zero interaction at load, which is
 * a documented browser contract (tests/defense-survivor-browser.cjs,
 * tests/defense-hud-responsive-browser.cjs). Removed from the DOM (not just hidden) once
 * session.started. id UNCHANGED ("#start-defense"). */
function renderSortieFab() {
  if (!campaign) return;
  const existing = root.querySelector("#start-defense");
  if (session?.started) {
    existing?.remove();
    return;
  }
  const selected = stageFor(selectedStageId);
  const depthNow = Math.min(selectedAbyssDepth, maxUnlockedAbyssDepth());
  const depthPkg = depthNow ? abyssDepthPackage(depthNow) : null;
  const label = `${escapeHtml(selected.name)} · ${escapeHtml(selected.bossName)}${depthPkg ? ` · 심연 ${depthNow} ${escapeHtml(depthPkg.name)}` : ""}`;
  // One markup string for both the create and the update path: the update path used to
  // rebuild the chevron WITHOUT data-ui-icon, so a re-render silently downgraded the
  // generated plate back to the ↗ glyph.
  const innerHtml = `<span class="sortie-action-label">등불 점화 · 작전 개시</span><small>${label}</small><b data-ui-icon="control-sortie" aria-hidden="true"></b>`;
  if (existing) {
    existing.innerHTML = innerHtml;
    return;
  }
  const button = document.createElement("button");
  button.id = "start-defense";
  button.className = "sortie-fab";
  button.innerHTML = innerHtml;
  button.addEventListener("click", () => {
    spawnSortieBurst(button);
    session?.beginRun();
    renderShell();
  });
  root.append(button);
}

/** AbyssDepthControl (wiki 2026-07-30 GAP-A/C): run-scoped difficulty-ladder selector, a fixed
 * sibling just above the SortieFab so the chosen depth is set right at 전투개시. Always mounted
 * pre-run (visible immediately); depths above the cleared-stage count render as LOCKED options
 * (clear-to-unlock, GAP-A). Removed the instant a run starts. Not persisted — resets to 0 on
 * reload. Changing depth remounts the run so the new scale + enemy-policy rotation are live
 * before the first tick. */
function renderAbyssDepthControl() {
  if (!campaign) return;
  const existing = root.querySelector("#abyss-depth-control");
  if (session?.started) { existing?.remove(); return; }
  const maxDepth = maxUnlockedAbyssDepth();
  if (selectedAbyssDepth > maxDepth) selectedAbyssDepth = maxDepth;
  const options = Array.from({ length: ABYSS_DEPTH_MAX + 1 }, (_, d) => {
    const locked = d > maxDepth;
    const pkg = abyssDepthPackage(d);
    const text = d === 0 ? "심연 0 · 기본"
      : locked ? `심연 ${d} · ${pkg?.name ?? ""} · 잠김 (${d} 클리어)`
      : `심연 ${d} · ${pkg?.name ?? ""} · 보상 T${pkg?.rewardTier ?? d}`;
    return `<option value="${d}"${d === selectedAbyssDepth ? " selected" : ""}${locked ? " disabled" : ""}>${text}</option>`;
  }).join("");
  const inner = `<span class="abyss-depth-eyebrow">ABYSS DEPTH · 심도</span><select id="abyss-depth-select" aria-label="심연 심도 선택">${options}</select>`;
  if (existing) { existing.innerHTML = inner; }
  else {
    const box = document.createElement("div");
    box.id = "abyss-depth-control";
    box.className = "abyss-depth-control rc-glass";
    box.innerHTML = inner;
    root.append(box);
  }
  root.querySelector("#abyss-depth-select")?.addEventListener("change", (event) => {
    if (session?.started) return;
    selectedAbyssDepth = Math.min(Number(event.currentTarget.value) || 0, maxUnlockedAbyssDepth());
    session?.remountForStage(selectedStageId);
    renderShell();
  });
}

/** IdleReturnToast (ui/component-contracts.md §4): mounted ONCE at mountShell() time, only
 * if idleReturnReceipt is present (i.e. settleIdleReturn() actually ran and reported back)
 * -- a one-time "welcome back" notice, not persistent-progression UI. Self-removes on
 * manual dismiss (click) or an 8s auto-timeout. The persisted recap lives inside the
 * 요새 section instead (renderStrongholdTab()'s .idle-return-recap). */
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

/** Top-level dispatcher: re-renders both command decks and the sortie FAB. Called by every
 * deck/campaign-mutation handler. The idle-return toast is NOT re-rendered here -- it is a
 * one-shot mount, see renderIdleReturnToast()'s own doc comment.
 *
 * Mid-run both decks are EMPTIED rather than restyled: combat owns the whole screen, so the
 * lobby columns leave no nodes behind to hit-test against canvas touches, and the combat HUD
 * budget in ui/hud-information-architecture.md §6 is unaffected by this pass. */
function renderShell() {
  // `data-stage-id` must track the SELECTED front in both branches. It used to be set only
  // on the started branch, so `mountShell` seeded it once and selecting a different front
  // pre-run left it stale -- `tests/lobby-guide-disclosure-browser.test.mjs:184` waits on
  // `#defense-app[data-stage-id="<selected>"]` after a keyboard selection and timed out
  // against the seeded value. The attribute is a selection readout, not a run readout.
  root.dataset.stageId = stageFor(selectedStageId).id;
  if (session?.started) {
    const leftDeck = root.querySelector("#command-deck-left");
    const rightDeck = root.querySelector("#command-deck-right");
    if (leftDeck) leftDeck.innerHTML = "";
    if (rightDeck) rightDeck.innerHTML = "";
  } else {
    renderCommandDeckLeft();
    renderCommandDeckRight();
  }
  renderSortieFab();
  renderAbyssDepthControl();
  renderLobbyCinematic();
  session?.syncAppearanceLoadout?.();
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

function requestBattleImmersion() {
  const fullscreen = document.documentElement.requestFullscreen?.().catch(() => undefined);
  Promise.resolve(fullscreen).finally(() => {
    globalThis.screen?.orientation?.lock?.("landscape").catch(() => undefined);
  });
}

/**
 * Persistent command-deck bootstrap: mounts the ENTIRE persistent DOM exactly once for the
 * page's whole lifetime -- #defense-battle-surface (canvas + world-hud-overlay + edge-hud)
 * as the fixed-fullscreen base layer, plus #command-deck-left/#command-deck-right as the two
 * edge-anchored deck wrappers renderCommandDeckLeft()/renderCommandDeckRight() target. There
 * is no second `root.innerHTML =` swap anywhere else in this module -- "entering battle" is
 * BattleSession.beginRun() flipping `started`, not a screen transition.
 * `data-defense-ready="true"` is set immediately (the battle surface always exists now);
 * `data-defense-started` reflects whether a real run is ticking, set by beginRun() -- CI
 * browser contracts wait on the latter instead of a click transition.
 * No deck open/close state is initialised here: the decks are always mounted pre-run, and
 * their responsive geometry is entirely CSS, so there is nothing to seed or listen for.
 */
function mountShell(stageId) {
  document.body.style.overflow = "hidden";
  root.className = "";
  root.innerHTML = `
    <section id="defense-battle-surface" data-defense-ready="true" data-defense-started="false" data-defense-input-seq="0" data-defense-skill="" data-defense-move="IDLE" data-defense-state="active" data-stage-id="${escapeHtml(stageId)}" aria-label="Abyssal Lantern 전장">
      <canvas id="defense-canvas" aria-label="Abyssal Lantern 실시간 전장"></canvas>
      <div id="world-hud-overlay" aria-hidden="true"></div>
${lobbyCinematicMarkup()}
      <div id="defense-edge-hud">
        <div class="defense-edge defense-top">
          <div class="hud-panel hud-mission" data-stage-hud-context="current"><span class="hud-eyebrow">ABYSSAL LANTERN · 전장</span><strong id="battle-stage"></strong><span id="battle-domain"></span><span id="battle-terrain-context"></span><span id="battle-status" aria-live="polite"></span><div class="hud-xp" aria-hidden="true" data-ui-icon-lead="stat-echo-xp"><b id="battle-xp-label"></b><span class="hud-xp-track"><i id="battle-xp-fill"></i></span></div></div>
          <div class="hud-panel hud-loop-state" data-stage-hud-context="loop"><span class="hud-eyebrow">OBJECTIVE FLOW · 진행</span><strong id="battle-loop-phase" aria-live="polite"></strong><ol class="hud-route-rail" id="battle-route-rail" role="list" aria-label="던전 동선"></ol><div class="hud-loop-grid"><span id="battle-pressure-state"></span><span id="battle-growth-state"></span><span id="battle-formation-state"></span><span id="battle-extraction-state"></span></div><div class="hud-gimmick-chip" id="battle-gimmick-state" role="status" aria-live="off" data-gimmick-state=""></div></div>
          <div class="hud-panel hud-legion"><span class="hud-eyebrow">LANTERN LEGION · 군단</span><div class="hud-legion-stack"><span class="legion-mana-label" id="battle-legion-mana-label"></span><span class="legion-mana-track"><i id="battle-legion-mana-fill"></i></span><div class="legion-roster" id="battle-legion-roster"></div><span class="hud-stance-mode" id="battle-stance-mode"></span></div></div>

          <div class="top-right-hud"><div class="hud-order-strip"><div class="objective-chip"><span class="objective-pulse" aria-hidden="true"></span><span class="objective-copy"><small>현재 퀘스트 · QUEST</small><b id="battle-quest-title"></b><strong id="battle-objective"></strong><em id="battle-quest-count"></em></span></div></div><div class="hud-right-stack"><div class="hud-passives" id="passive-badges" aria-label="지속 특성"></div></div></div>
        </div>
        <output id="battle-event-feedback" class="battle-event-feedback" role="status" aria-live="polite" aria-atomic="true"></output>
        <div class="arise-banner" id="battle-arise-banner" data-active="false" aria-hidden="true">ARISE</div>

        <div class="arena-callout" aria-hidden="true"><span>LANTERN GATE</span><i></i><span>등불을 지키세요</span></div>
        <div class="defense-edge defense-bottom">
          <div class="hud-panel gate-panel"><div class="gate-panel-copy">${portraitMarkup(COMMANDER_MESH_ROOT, "DW", "gate-panel-portrait rc-portrait")}<span class="hud-eyebrow">WARDEN / LANTERN INTEGRITY</span><div class="gate-panel-bars" aria-hidden="true"><span class="gate-panel-bar-icon" data-ui-icon="stat-commander"></span><span class="gate-panel-bar-track commander"><i id="battle-commander-bar-fill"></i></span><span class="gate-panel-bar-icon" data-ui-icon="stat-gate-integrity"></span><span class="gate-panel-bar-track gate"><i id="battle-gate-bar-fill"></i></span></div><strong id="battle-commander-integrity"></strong><strong id="battle-integrity"></strong><span id="battle-enemies"></span></div><div class="integrity-meter" aria-hidden="true"><i id="battle-integrity-fill"></i></div><ul class="hud-buff-strip" id="battle-buff-strip" role="list" aria-label="활성 강화" aria-live="off"></ul></div>
          <div class="one-thumb-controls" id="movement-actions" data-movement-control="octant-joystick" role="group" aria-label="한 손 이동 조작">
            <div class="virtual-joystick" data-joystick role="application" aria-label="이동 스틱" aria-describedby="movement-hint"><span class="virtual-joystick-rune" aria-hidden="true"></span><i class="virtual-joystick-knob" data-joystick-knob aria-hidden="true"></i></div>
            <button type="button" data-move="N" aria-label="위로 이동">↑</button>
            <button type="button" data-move="W" aria-label="왼쪽으로 이동">←</button>
            <button type="button" data-move="IDLE" aria-label="이동 정지">●</button>
            <button type="button" data-move="E" aria-label="오른쪽으로 이동">→</button>
            <button type="button" data-move="S" aria-label="아래로 이동">↓</button>
            <span id="movement-hint" class="sr-only">스틱을 끌어 이동. 방향 버튼은 키보드로도 사용할 수 있습니다.</span>
          </div>
          <div class="combat-input-cluster" id="combat-input-cluster" role="group" aria-label="전투 입력">
            <button type="button" id="manual-attack" class="manual-attack-action" aria-label="수동 공격 (Space 또는 J)"><span class="manual-attack-glyph" aria-hidden="true">✦</span><span class="manual-attack-label">공격</span><kbd>SPACE</kbd></button>
            <div class="skill-actions skill-radial" id="skill-actions" aria-label="활성 스킬"></div>
          </div>
          <div class="hud-actions" id="battle-actions" aria-label="전투 행동"></div>
        </div>
      </div>
    </section>
    <div id="command-deck-left"></div>
    <div id="command-deck-right"></div>`;

  hydratePortraits(root);
  session = new BattleSession(stageId);
  session.start();
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
    // Cycle 10 §5.3a. One-shot pre-expiry warning ledger, keyed by buffId. Presentation-only:
    // never read by the simulation, so getRunDigest is unaffected.
    this.warnedBuffIds = new Set();
    // §5.1/§5.2/§5.3 render signatures -- these let each readout rebuild its DOM only when the
    // node identity actually changes, instead of replaceChildren() 60 times a second (which
    // would drop focus and restart the active-pip animation every frame).
    this.routeRailSignature = "";
    this.gimmickChipSignature = "";
    this.buffStripSignature = "";
    this.frame = 0;
    this.lastFrameAt = 0;
    this.inputModality = "keyboard";
    this.onGlobalPointerDown = this.onGlobalPointerDown.bind(this);
    this.accumulator = 0;
    this.inputSeq = 0;
    // this.pointer tracks the single active orbit-drag pointer (last known
    // logical position, for incremental deltas); this.pinch tracks a
    // two-finger zoom gesture once a second pointer joins.
    this.pointer = null;
    this.pinch = null;
    this.activePointers = new Map();
    this.controlPointerId = null;
    this.controlPointerMode = null;
    this.joystickDirection = "IDLE";
    this.feedbackTick = null;
    this.feedbackEventKeys = new Set();
    this.feedbackTimer = null;
    this.heldKeys = new Set();
    this.listenerCount = 0;
    this.extractionEvents = [];
    this.questEvents = [];
    this.questEventKeys = new Set();
    this.questEventKeyGroups = [];
    this.accumulateQuestEvents(this.run.events);
    this.terminalHandled = false;
    this.rewardPrompted = false;
    this.selectedRewardId = null;
    this.userPaused = false;
    this.bindStartPending = false;
    this.cutsceneEventKeys = new Set();
    this.cutsceneTimer = null;
    this.ariseTimer = null;
    this.legionRosterSignature = "";
    this.lastAriseState = null;


    this.cutsceneRelayTimers = [];
    this.cutsceneQueue = [];
    this.cutsceneActive = false;
    this.stopped = false;
    this.camera = { x: 0, y: 0 };
    this.focusBeforeGrowth = null;
    this.pauseOverlaySegment = "stats";
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
    // Lobby cinematic (ui/lobby-cinematic-spec.md §3). Presentation-only, pre-run only:
    // `showcaseStartedAt` is the wall clock the camera cycle and the dialogue relay are
    // measured from, `showcaseBaselineZoom` is the renderer's own resting orbit distance
    // captured on the first showcase frame (so the cycle scales the renderer's clamped
    // range instead of hard-coding world units), and `showcaseSuppressed` latches true the
    // moment the player takes the camera or moves, permanently handing control back for
    // this pre-run session. remountForStage() resets all three.
    this.showcaseStartedAt = performance.now();
    this.showcaseBaselineZoom = null;
    this.showcaseSuppressed = false;
    this.lobbyDialogueIndex = null;
    this.lobbyDialogueStageId = null;
    this.lobbyDialogueScript = null;
    this.onResize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onAttackSurfacePointerDown = this.onAttackSurfacePointerDown.bind(this);
    this.onAttackSurfaceClick = this.onAttackSurfaceClick.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onMoveControlDown = this.onMoveControlDown.bind(this);
    this.onMoveControlMove = this.onMoveControlMove.bind(this);
    this.onMoveControlEnd = this.onMoveControlEnd.bind(this);
    this.onMoveControlClick = this.onMoveControlClick.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onReducedMotion = (event) => {
      const reducedMotion = event.matches;
      telemetry.recordReducedMotion(reducedMotion);
      this.renderer?.setReducedMotion?.(reducedMotion);
      if (reducedMotion) {
        this.camera = { x: 0, y: 0 };
        this.render();
      }
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
      abyssDepth: Math.min(selectedAbyssDepth, maxUnlockedAbyssDepth()),
      companionLoadout,
      rewardIds: campaign.rewardIds ?? [],
      wardenProgress: campaign.wardenProgress,
      wardenEquipment: equipTiers("warden"),
      companionEquipment: Object.fromEntries(companionLoadout.map((id) => [id, equipTiers(id)])),
      extractedSkillRanks: Object.fromEntries(
        (campaign.storyProgress?.activeSkillLoadout ?? []).map((skillId) => [
          skillId,
          campaign.storyProgress?.extractedSkillLevels?.[skillId] ?? 1,
        ]),
      ),
      formation: campaign.companionFormation,
      // Stage-to-stage carry-over: the skill ranks and items the previous cleared stage
      // handed back. Lives here rather than at the constructor's call site so a pre-commit
      // stage switch through remountForStage() rebuilds the run with it too.
      carryOver: campaign.stageCarryOver ?? null,
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
    delete this.surface.dataset.abyssTint;
    delete this.surface.dataset.abyssDepth;
    this.run = this.createRunForStage(stageId);
    this.audio.resetRun();
    this.audioEventKeys.clear();
    // Cycle 10 §5.3a: a buff warns ONCE, not every frame for 180 ticks. Reset here as well as
    // in beginRun() because `nextId` is a shared per-run counter, so a re-entered stage can
    // reissue a `buff-<n>` this Set already holds -- without the remount reset that buff would
    // never warn again for the rest of the session.
    // Assignment rather than .clear() deliberately. Nothing else holds a reference to this Set,
    // so replacing it is equivalent to clearing it -- and it also survives the codebase's
    // Object.create(BattleSession.prototype) test fixtures, which build a session field-by-field
    // and never run the constructor. A .clear() there is a TypeError on undefined.
    this.warnedBuffIds = new Set();
    this.audioTick = null;
    this.questEvents = [];
    this.questEventKeys.clear();
    this.questEventKeyGroups = [];
    this.accumulateQuestEvents(this.run.events);
    this.extractionEvents = [];
    this.terminalHandled = false;
    this.rewardPrompted = false;
    this.selectedRewardId = null;
    this.bindStartPending = false;
    this.cutsceneEventKeys.clear();
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = null;
    const feedback = root.querySelector("#battle-event-feedback");
    if (feedback) {
      feedback.textContent = "";
      delete feedback.dataset.feedback;
    }
    delete this.surface.dataset.defenseFeedback;
    this.cutsceneRelayTimers.forEach((timer) => clearTimeout(timer));
    this.cutsceneRelayTimers = [];
    this.cutsceneQueue = [];
    this.dismissCutscene();
    this.rallyAcknowledgedBossIds = new Set();
    this.accumulator = 0;
    this.resetCamera();
    // A stage switch restarts the lobby showcase from its wide establishing beat and hands
    // the camera back to the choreography, because the player is now looking at a different
    // front and boss -- carrying the previous front's suppression/clock over would strand
    // the new boss off-frame.
    this.resetLobbyShowcase();
    this.surface.querySelectorAll(".edge-card").forEach((card) => card.remove());
    this.render();
    this.syncAppearanceLoadout();
  }

  /** Restarts the pre-run camera cycle and dialogue relay from their establishing beat. */
  resetLobbyShowcase() {
    this.showcaseStartedAt = performance.now();
    this.showcaseBaselineZoom = null;
    this.showcaseSuppressed = false;
    this.lobbyDialogueIndex = null;
    this.lobbyDialogueStageId = null;
    this.lobbyDialogueScript = null;
  }

  /** Player input owns the camera/movement for the rest of this lobby visit. */
  suppressLobbyShowcase() {
    this.showcaseSuppressed = true;
  }

  /** The lobby is the existing combat shell before a run is committed. */
  inLobby() {
    return this.started === false && !this.stopped;
  }

  /** Presentation-only per-frame pass. It uses renderer public APIs exclusively and
   * never writes to the deterministic simulation snapshot or run digest inputs. */
  updateLobbyCinematic() {
    const overlay = root.querySelector("#lobby-cinematic");
    if (!overlay) return;
    if (!this.inLobby()) {
      overlay.dataset.active = "false";
      return;
    }
    overlay.dataset.active = "true";
    const reducedMotion = this.motionQuery?.matches ?? false;
    const elapsed = performance.now() - this.showcaseStartedAt;
    const shot = showcaseCamera(elapsed, { reducedMotion });
    if (!this.showcaseSuppressed) this.applyShowcaseCamera(shot);
    overlay.dataset.framing = shot.framing;

    const plate = overlay.querySelector("#lobby-boss-plate");
    if (plate) {
      plate.dataset.visible = LOBBY_SHOWCASE_STAGE_ID_SET.has(this.stageId)
        && (shot.framing === "mid" || shot.framing === "closeup") ? "true" : "false";
    }
    this.updateLobbyDialogue(overlay, reducedMotion ? 0 : elapsed);
  }

  /** Converts the absolute choreography pose into public incremental orbit/zoom calls.
   * Renderer-owned clamps remain authoritative; Canvas2D simply has no such API. */
  applyShowcaseCamera(shot) {
    const renderer = this.renderer;
    if (typeof renderer?.orbit !== "function" || typeof renderer?.zoom !== "function") return;
    if (![renderer.orbitYaw, renderer.orbitPitch, renderer.zoomFactor].every(Number.isFinite)) return;
    if (this.showcaseBaselineZoom === null) this.showcaseBaselineZoom = renderer.zoomFactor;
    renderer.orbit(shot.yaw - renderer.orbitYaw, shot.pitch - renderer.orbitPitch);
    renderer.zoom(this.showcaseBaselineZoom * shot.distanceScale - renderer.zoomFactor);
  }

  /** Updates the aria-live dialogue only when its actual scripted line changes. */
  updateLobbyDialogue(overlay, elapsed) {
    if (!overlay || overlay.isConnected === false || this.stopped) return;
    if (this.lobbyDialogueStageId !== this.stageId || !this.lobbyDialogueScript) {
      const facts = lobbyStageFacts(this.stageId);
      this.lobbyDialogueScript = dialogueScriptFor({
        stageId: this.stageId,
        stageName: facts.stageName,
        bossName: facts.bossName,
        objective: facts.objective,
      });
      this.lobbyDialogueStageId = this.stageId;
      this.lobbyDialogueIndex = null;
    }
    const resolved = dialogueLineAt(elapsed, this.lobbyDialogueScript);
    if (!resolved || resolved.index === this.lobbyDialogueIndex) return;
    this.lobbyDialogueIndex = resolved.index;
    const speaker = resolved.line.speaker === "boss" ? "boss" : "commander";
    overlay.dataset.speaker = speaker;
    const facts = lobbyStageFacts(this.stageId);
    const speakerNode = overlay.querySelector("#lobby-dialogue-speaker");
    const textNode = overlay.querySelector("#lobby-dialogue-text");
    const portraitNode = overlay.querySelector("#lobby-dialogue-portrait");
    if (!speakerNode || !textNode || !portraitNode) return;
    speakerNode.textContent = speaker === "boss"
      ? facts.bossName
      : "지휘관 · DUSK WARDEN";
    textNode.textContent = resolved.line.text;
    portraitNode.textContent = speaker === "boss" ? "◉" : "◈";
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
    this.warnedBuffIds = new Set();
    this.accumulator = 0;
    this.lastFrameAt = 0;
    document.documentElement.dataset.defenseStarted = "true";
    this.surface.dataset.defenseStarted = "true";
    // Abyss Depth entrance juice: name the active depth package, wash the battle surface in its
    // tint, and announce the dominant rule change (depth 0 = no package -> nothing added).
    const depthPkg = abyssDepthPackage(this.run?.abyssDepth ?? 0);
    if (depthPkg) {
      this.surface.dataset.abyssDepth = String(this.run.abyssDepth);
      this.surface.dataset.abyssTint = depthPkg.tint;
      this.showToast(`<h2>심연 ${this.run.abyssDepth} · ${escapeHtml(depthPkg.name)}</h2><p>${escapeHtml(depthPkg.dominantLabel)} 활성 · 보상 T${depthPkg.rewardTier}</p>`, { className: "defense-toast-abyss", durationMs: 5000 });
    } else {
      delete this.surface.dataset.abyssDepth;
      delete this.surface.dataset.abyssTint;
    }
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
    this.syncAppearanceLoadout();
    this.listen(this.canvas, "pointerdown", this.onPointerDown);
    this.listen(this.canvas, "pointermove", this.onPointerMove);
    this.listen(this.canvas, "pointerup", this.onPointerEnd);
    this.listen(this.canvas, "pointercancel", this.onPointerEnd);
    this.listen(this.canvas, "lostpointercapture", this.onPointerEnd);
    this.movementControls = root.querySelector("#movement-actions");
    this.listen(this.movementControls, "pointerdown", this.onMoveControlDown);
    this.listen(this.movementControls, "pointermove", this.onMoveControlMove);
    this.listen(this.movementControls, "pointerup", this.onMoveControlEnd);
    this.listen(this.movementControls, "pointercancel", this.onMoveControlEnd);
    this.listen(this.movementControls, "lostpointercapture", this.onMoveControlEnd);
    this.listen(this.movementControls, "click", this.onMoveControlClick);
    this.listen(root, "pointerdown", this.onAttackSurfacePointerDown);
    this.listen(root, "click", this.onAttackSurfaceClick);
    this.listen(window, "blur", this.onWindowBlur);
    this.listen(document, "visibilitychange", this.onVisibility);
    this.listen(window, "keydown", this.onKey);
    this.listen(window, "keyup", this.onKey);
    this.listen(window, "pointerdown", this.onGlobalPointerDown);
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

  syncAppearanceLoadout() {
    this.renderer?.setAppearanceLoadout?.(appearanceLoadoutForCampaign());
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
      if (this.inLobby()) this.suppressLobbyShowcase();
      if (this.renderer?.zoom?.(-deltaDistance * CAMERA_PINCH_ZOOM_SENSITIVITY)) this.signalCameraClamp();
      return;
    }
    if (this.pointer?.id !== event.pointerId) return;
    const dx = point.x - this.pointer.x;
    const dy = point.y - this.pointer.y;
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.dismissCameraHint();
    if (this.inLobby() && (dx !== 0 || dy !== 0)) this.suppressLobbyShowcase();
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

  onAttackSurfacePointerDown(event) {
    if (!event.target.closest?.("#manual-attack")) return;
    this.onAttackControlDown(event);
  }

  onAttackSurfaceClick(event) {
    if (!event.target.closest?.("#manual-attack")) return;
    this.onAttackControlClick(event);
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

  onAttackControlDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    this.send("ATTACK");
    this.signalAttackFeedback();
  }

  onAttackControlClick(event) {
    if (event.detail !== 0) return;
    this.send("ATTACK");
    this.signalAttackFeedback();
  }

  signalAttackFeedback() {
    const control = root.querySelector("#manual-attack");
    if (!control) return;
    control.dataset.feedback = "true";
    clearTimeout(this.attackFeedbackTimer);
    this.attackFeedbackTimer = setTimeout(() => control.removeAttribute("data-feedback"), 180);
  }

  /**
   * Cycle 10 (ui/hud-overhaul-joystick-cutover-spec.md §3.1): the stick is the PRIMARY
   * movement control at every viewport and for EVERY pointer type, so availability is no
   * longer a modality question at all -- the `(pointer: coarse) and (orientation: landscape)`
   * media query and its `data-defense-portrait` companion clause are both gone. It is purely
   * a geometry question: has CSS given the pad a box?
   *
   * Reading the same rect updateJoystick() reads is what makes this un-desyncable, and the
   * rect check is load-bearing rather than defensive garnish. Without it a `display: none` pad
   * still reaches updateJoystick(), whose zeroed getBoundingClientRect() collapses radius to 1,
   * derives the octant from the viewport origin to the finger, and swallows the [data-move]
   * fallback press entirely (spec §2.1). Keeping the rect check and dropping the media query
   * makes the CSS in §3.4 the single switch: give the element a box and the stick is live;
   * take the box away and the five ring buttons resume ownership with no JS change.
   */
  joystickActive() {
    const joystick = this.movementControls?.querySelector("[data-joystick]");
    if (!joystick) return false;
    const rect = joystick.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  updateJoystick(event) {
    const joystick = this.movementControls?.querySelector("[data-joystick]");
    const knob = joystick?.querySelector("[data-joystick-knob]");
    if (!joystick || !knob) return;
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const knobRadius = Math.min(knob.offsetWidth, knob.offsetHeight) / 2;
    const maxTravel = Math.max(1, radius - knobRadius);
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const travel = Math.min(distance, maxTravel);
    const scale = distance > 0 ? travel / distance : 0;
    const clampedX = dx * scale;
    const clampedY = dy * scale;
    knob.style.setProperty("--joystick-x", `${clampedX}px`);
    knob.style.setProperty("--joystick-y", `${clampedY}px`);
    const direction = distance < radius * JOYSTICK_DEAD_ZONE_RATIO
      ? "IDLE"
      : JOYSTICK_OCTANTS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
    this.movementControls.dataset.joystickDirection = direction;
    if (direction === this.joystickDirection) return;
    this.joystickDirection = direction;
    this.send("MOVE", direction);
    if (direction !== "IDLE" && this.inLobby()) this.suppressLobbyShowcase();
  }

  resetJoystick({ sendIdle = true } = {}) {
    const knob = this.movementControls?.querySelector("[data-joystick-knob]");
    knob?.style.removeProperty("--joystick-x");
    knob?.style.removeProperty("--joystick-y");
    if (this.movementControls) this.movementControls.dataset.joystickDirection = "IDLE";
    this.joystickDirection = "IDLE";
    if (sendIdle) this.send("MOVE", "IDLE");
  }

  onMoveControlDown(event) {
    if (this.controlPointerId !== null || (event.button !== undefined && event.button !== 0)) return;
    // Buttons FIRST (spec §3.2). The pad is visible at every viewport after §3.4, so the
    // octant ring and the drag surface share one container. A press that actually landed on a
    // labelled control is that control's press -- resolving it by pad geometry instead would
    // discard the player's stated intent and break the held-movement contract in
    // tests/defense-survivor-browser.cjs (hover [data-move="W"] -> mouse.down -> held MOVE W).
    // Requirement C1 keeps every [data-move] box clear of the pad centre, so a drag that
    // starts at the centre still finds no button here and falls through to the stick.
    const button = event.target.closest?.("[data-move]");
    if (button) {
      event.preventDefault();
      this.controlPointerId = event.pointerId;
      this.controlPointerMode = "buttons";
      button.setPointerCapture?.(event.pointerId);
      this.send("MOVE", button.dataset.move);
      if (button.dataset.move !== "IDLE" && this.inLobby()) this.suppressLobbyShowcase();
      return;
    }
    if (!this.joystickActive()) return;
    event.preventDefault();
    this.controlPointerId = event.pointerId;
    this.controlPointerMode = "joystick";
    this.movementControls.setPointerCapture?.(event.pointerId);
    this.updateJoystick(event);
  }

  onMoveControlMove(event) {
    if (event.pointerId !== this.controlPointerId || this.controlPointerMode !== "joystick") return;
    event.preventDefault();
    this.updateJoystick(event);
  }

  onMoveControlEnd(event) {
    if (event.pointerId !== this.controlPointerId) return;
    const captureTarget = this.controlPointerMode === "joystick"
      ? this.movementControls
      : event.target.closest?.("[data-move]");
    if (captureTarget?.hasPointerCapture?.(event.pointerId)) captureTarget.releasePointerCapture(event.pointerId);
    this.controlPointerId = null;
    this.controlPointerMode = null;
    this.resetJoystick();
  }

  onMoveControlClick(event) {
    if (event.detail !== 0) return;
    const button = event.target.closest?.("[data-move]");
    if (button) this.send("MOVE", button.dataset.move);
    if (button?.dataset.move !== "IDLE" && this.inLobby()) this.suppressLobbyShowcase();
  }

  onWindowBlur() {
    this.controlPointerId = null;
    this.controlPointerMode = null;
    this.heldKeys.clear();
    this.pointer = null;
    this.pinch = null;
    this.activePointers.clear();
    this.resetJoystick();
  }

  onVisibility() {
    if (!document.hidden) return;
    this.accumulator = 0;
    this.lastFrameAt = 0;
    this.onWindowBlur();
  }

  onGlobalPointerDown(event) {
    this.updateInputModality(event.pointerType === "touch" ? "touch" : "pointer");
  }

  updateInputModality(modality) {
    if (!["keyboard", "pointer", "touch"].includes(modality)) return;
    this.inputModality = modality;
    root.setAttribute("data-input-modality", modality);
    const dialog = root.querySelector("#lobby-guide-dialog");
    if (!dialog?.open) return;
    dialog.querySelectorAll("[data-modality-select]").forEach((button) => {
      const selected = button.dataset.modalitySelect === modality;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    dialog.querySelectorAll("[data-pane]").forEach((panel) => {
      panel.hidden = panel.dataset.pane !== modality;
    });
    dialog.querySelector(".modality-content")?.setAttribute("data-active-modality", modality);
  }

  onKey(event) {
    const target = event.target;
    const key = event.key.toLowerCase();
    if ((key === "escape" || key === "p") && event.type === "keydown" && this.started && !isTerminalRun(this.run)) {
      this.updateInputModality("keyboard");
      event.preventDefault();
      this.togglePause();
      return;
    }
    // Editable controls own gameplay keys, but the pause hotkeys above remain global so a
    // focused volume range cannot strand keyboard users inside the modal pause screen.
    if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
    const compositeNavigationKey = ["arrowleft", "arrowright", "arrowup", "arrowdown", "home", "end"].includes(key);
    if (compositeNavigationKey && target?.closest?.('[role="tablist"]')) return;
    this.updateInputModality("keyboard");
    // A focused control owns its ACTIVATION keys (Enter and Space) -- that is how keyboard
    // activation works, and the `preventDefault()` below would otherwise cancel it.
    // ATTACK_KEYS contains "enter" and " ", so without this exemption Enter/Space stopped
    // activating EVERY button in the app: measured, focusing a showcase card and pressing
    // Enter left the selection unchanged, which is exactly what
    // tests/lobby-guide-disclosure-browser.test.mjs asserts as "keyboard operable".
    const isActivationKey = key === "enter" || key === " " || event.code === "Space";
    if (isActivationKey && target?.closest?.("button, a[href], summary, [role='button']")) return;
    if (ATTACK_KEYS.has(key) || ATTACK_CODES.has(event.code)) {
      event.preventDefault();
      if (event.type === "keydown" && !event.repeat) {
        if (this.inLobby()) this.suppressLobbyShowcase();
        this.send("ATTACK");
        this.signalAttackFeedback();
      }
      return;
    }
    if (!KEY_DIRECTIONS[key]) return;
    event.preventDefault();
    if (event.type === "keydown" && this.inLobby()) this.suppressLobbyShowcase();
    if (event.type === "keydown") this.heldKeys.add(key);
    else this.heldKeys.delete(key);
    const directions = [...this.heldKeys].map((entry) => KEY_DIRECTIONS[entry]);
    const vertical = directions.includes("N") ? -1 : directions.includes("S") ? 1 : 0;
    const horizontal = directions.includes("W") ? -1 : directions.includes("E") ? 1 : 0;
    this.send("MOVE", DIRECTION_BY_VECTOR[`${horizontal},${vertical}`]);
  }

  send(type, payload) {
    if (this.stopped || this.userPaused || (isTerminalRun(this.run) && type !== "REWARD_SELECTED")) return;
    const inputAt = performance.now();
    this.run = queueInput(this.run, type, payload);
    const inputSeq = ++this.inputSeq;
    this.surface.dataset.defenseInputSeq = String(inputSeq);
    if (type === "MOVE") this.surface.dataset.defenseMove = payload;
    if (type === "ATTACK") this.surface.dataset.defenseAttack = String(inputSeq);
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
    if (this.started && !document.hidden && !this.userPaused && !this.cutsceneActive && !isTerminalRun(this.run)) {
      this.accumulator += elapsed;
      while (this.accumulator >= STEP_MS) {
        this.run = advanceDefenseRun(this.run, 1);
        frameEvents.push(...this.run.events);
        this.accumulateQuestEvents(this.run.events);
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
    const lobbyStaging = this.inLobby() ? stagingFor(this.stageId, ARENA) : null;
    const stagedCommander = lobbyStaging
      ? {
        ...snapshot.commander,
        x: lobbyStaging.commander.x,
        y: lobbyStaging.commander.y,
        facing: lobbyStaging.facing,
        presentationAction: "idle",
      }
      : snapshot.commander;
    const stagedCompanions = lobbyStaging
      ? snapshot.companions.map((companion, index) => {
        const point = lobbyStaging.companions[index] ?? lobbyStaging.commander;
        return {
          ...companion,
          x: point.x,
          y: point.y,
          facing: lobbyStaging.facing,
          presentationAction: "idle",
        };
      })
      : snapshot.companions;
    // The pre-run boss is a presentation-only synthetic entity. It is deliberately appended
    // after the authoritative snapshot is read, never fed to advanceDefenseRun(), telemetry,
    // or getRunDigest(). RealtimeBattle resolves its mesh solely from `class === "boss"` and
    // `bossId`, while the Canvas fallback has all normal health/radius fields it expects.
    const lobbyBoss = lobbyStaging
      ? {
        id: `lobby-preview:${this.stageId}`,
        kind: "boss",
        class: "boss",
        bossId: stageFor(this.stageId).boss,
        hp: stageFor(this.stageId).scale,
        maxHp: stageFor(this.stageId).scale,
        radius: 25,
        x: lobbyStaging.boss.x,
        y: lobbyStaging.boss.y,
        facing: lobbyStaging.facing + Math.PI,
        presentationAction: "show",
      }
      : null;
    return {
      ...snapshot,
      presentation,
      gate: project(snapshot.gate),
      commander: project(stagedCommander),
      enemies: [...snapshot.enemies, ...(lobbyBoss ? [lobbyBoss] : [])].map(project),
      projectiles: snapshot.projectiles.map(project),
      pickups: snapshot.pickups.map(project),
      companions: stagedCompanions.map(project),
    };
  }

  accumulateQuestEvents(events) {
    for (const event of events ?? []) {
      if (!event?.quest && !event?.storyBeat) continue;
      const keys = [
        event.eventId ? `event:${event.eventId}` : null,
        event.quest?.objectiveId ? `quest:${event.type}:${event.quest.objectiveId}` : null,
        event.storyBeat?.id ? `story:${event.storyBeat.id}` : null,
      ].filter(Boolean);
      if (keys.some((key) => this.questEventKeys.has(key))) continue;
      const retained = { type: event.type };
      if (event.objectiveId !== undefined) retained.objectiveId = event.objectiveId;
      if (event.occupationPointId !== undefined) retained.occupationPointId = event.occupationPointId;
      this.questEvents.push(retained);
      this.questEventKeyGroups.push(keys);
      keys.forEach((key) => this.questEventKeys.add(key));
      while (this.questEvents.length > 16) {
        this.questEvents.shift();
        const expiredKeys = this.questEventKeyGroups.shift() ?? [];
        expiredKeys.forEach((key) => this.questEventKeys.delete(key));
      }
    }
  }

  recordExtraction(snapshot) {
    for (const event of snapshot.events) {
      if (event.type !== "ELITE_EXTRACTED") continue;
      this.extractionEvents.push({ eventId: event.eventId, eliteId: event.eliteId, prototype: event.prototype });
    }
  }

  dismissCutscene(expectedOverlay = null) {
    const overlay = this.surface?.querySelector("#defense-cutscene-overlay");
    if (expectedOverlay && overlay !== expectedOverlay) return;
    if (this.cutsceneTimer !== null) {
      clearTimeout(this.cutsceneTimer);
      this.cutsceneTimer = null;
    }
    this.cutsceneRelayTimers.forEach((timer) => clearTimeout(timer));
    this.cutsceneRelayTimers = [];
    if (!this.cutsceneActive && !overlay) return;
    overlay?.remove();
    this.cutsceneActive = false;
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
    const nonBlocking = event?.quest?.status === "ACQUIRED";
    overlay.dataset.nonblocking = String(nonBlocking);
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
      if (this.stopped || overlay.isConnected === false || beatNode.isConnected === false) return;
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
    dismiss.addEventListener("click", () => this.dismissCutscene(overlay));
    frame.append(heading, beatNode, dismiss);
    overlay.append(frame);
    this.surface.append(overlay);
    this.cutsceneActive = !nonBlocking;
    this.surface.dataset.defenseCutscene = cutscene.eventType;
    beats.slice(1).forEach((beat) => {
      this.cutsceneRelayTimers.push(setTimeout(() => renderBeat(beat), beat.timing.startMs));
    });
    // Arm auto-dismiss only after this synchronous startup turn yields. A slow
    // WebGL mount must not consume the visible window before the battle can be
    // observed or interacted with.
    this.cutsceneTimer = setTimeout(() => {
      if (this.stopped || overlay.isConnected === false || (!nonBlocking && !this.cutsceneActive)) {
        this.cutsceneTimer = null;
        return;
      }
      this.cutsceneTimer = setTimeout(
        () => {
          if (this.stopped || overlay.isConnected === false || (!nonBlocking && !this.cutsceneActive)) return;
          this.dismissCutscene(overlay);
        },
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
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      if (feedback.isConnected === false) return;
      feedback.textContent = "";
      delete feedback.dataset.feedback;
      delete this.surface?.dataset.defenseFeedback;
      this.feedbackTimer = null;
    }, 1800);
  }
  render(frameEvents = null) {
    // The module-level session can outlive a test/page teardown by one animation
    // frame. Do not let presentation callbacks write into a dismantled shell.
    if (!this.surface || this.surface.isConnected === false || !root.querySelector("#battle-stage")) return;
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
      const key = event.eventId ?? [
        event.type,
        event.stageId,
        event.eventSequence,
        event.entityId,
        event.enemyId,
        event.itemId,
        event.rewardId,
        event.objectiveId,
        event.occupationPointId,
        event.bossId,
        event.outcome,
        event.tableId,
        event.storyBeat?.id,
      ].map((value) => value ?? "").join(":");
      if (this.audioEventKeys.has(key)) return false;
      this.audioEventKeys.add(key);
      return true;
    });
    this.audio.consume(newAudioEvents);
    this.recordExtraction(snapshot);
    if (this.started) this.consumeCutscenes(snapshot.events);
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
    const depthPkg = this.run?.abyssDepth ? abyssDepthPackage(this.run.abyssDepth) : null;
    const depthBadge = depthPkg ? ` · 심연 ${this.run.abyssDepth} ${depthPkg.name} · ${depthPkg.dominantLabel}` : "";
    root.querySelector("#battle-terrain-context").textContent = `${presentation.terrain.label} · ${presentation.mapLabels.hazard} · ${presentation.mapLabels.occupation} → ${presentation.mapLabels.extraction}${depthBadge}`;
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
    const story = stageStoryFor(this.stageId);
    const questProgress = questProgressForEvents(this.stageId, this.questEvents);
    const currentQuestObjective = story?.quest?.objectives.find((entry) => entry.id === questProgress?.currentObjectiveId);
    root.querySelector("#battle-quest-title").textContent = story?.title ?? "전선 임무";
    root.querySelector("#battle-objective").textContent = questProgress?.completed
      ? "퀘스트 완료"
      : currentQuestObjective?.label ?? presentation.mapLabels.objective;
    root.querySelector("#battle-quest-count").textContent = questProgress
      ? `${questProgress.completedObjectives}/${questProgress.totalObjectives} 완료`
      : "";
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
    this.renderLegionHud(snapshot);
    this.renderRouteRail(snapshot);
    this.renderGimmickChip(snapshot);
    this.renderBuffStrip(snapshot);
    if (this.started) {
      this.renderControls(snapshot);
      this.renderPauseOverlay(snapshot);
      if (snapshot.terminal && !this.terminalHandled) void this.resolveTerminal(snapshot);
      this.renderEventFeedback(snapshot);
    }
    this.renderWorldHud(snapshot);
    this.updateLobbyCinematic();
  }

  /**
   * Shadow-legion HUD panel. Pure presentation off the snapshot:

   * "그림자 마력" is the legion's aggregate integrity ratio (sum of companion
   * integrity / max integrity), the roster chips mirror per-companion state,
   * and the stance chip surfaces the committed formation as a defense/offense
   * mode. No simulation state is written, so getRunDigest is unaffected.
   */
  renderLegionHud(snapshot) {
    const companions = snapshot.companions ?? [];
    const manaLabel = root.querySelector("#battle-legion-mana-label");
    const manaFill = root.querySelector("#battle-legion-mana-fill");
    const rosterNode = root.querySelector("#battle-legion-roster");
    const stanceNode = root.querySelector("#battle-stance-mode");
    if (!manaLabel || !manaFill || !rosterNode || !stanceNode) return;
    const total = companions.length;
    const maxSum = companions.reduce((sum, unit) => sum + (unit.maxIntegrity ?? 0), 0);
    const liveSum = companions.reduce((sum, unit) => sum + Math.max(0, unit.integrity ?? 0), 0);
    const alive = companions.filter((unit) => (unit.integrity ?? 0) > 0).length;
    const ratio = maxSum > 0 ? Math.max(0, Math.min(1, liveSum / maxSum)) : 0;
    const percent = Math.round(ratio * 100);
    manaLabel.textContent = `그림자 마력 ${percent}% · 군단 ${alive}/${total}`;
    manaFill.style.width = `${percent}%`;
    // Signature is stored on the node (not the session) so a HUD re-mount,
    // which resets innerHTML, always repopulates the roster.
    const signature = companions.map((unit) => `${unit.companionId}:${(unit.integrity ?? 0) > 0 ? 1 : 0}`).join("|");
    if (signature !== rosterNode.dataset.rosterSignature) {
      rosterNode.dataset.rosterSignature = signature;
      rosterNode.innerHTML = companions.length
        ? companions.map((unit) => `<span class="legion-roster-unit" data-state="${(unit.integrity ?? 0) > 0 ? "active" : "downed"}">${escapeHtml(companionLabel(unit.companionId))}</span>`).join("")
        : `<span class="legion-roster-unit" data-state="downed">편성된 그림자 없음</span>`;
    }

    const offense = snapshot.formationStance === "VANGUARD";
    stanceNode.textContent = offense ? "돌격진형 · OFFENSE" : "방어진형 · DEFENSE";
    stanceNode.dataset.stanceMode = offense ? "offense" : "defense";
    // ARISE flash: fires on the transition into an extraction-ready/extracted
    // state, read straight from the snapshot (same source the surface dataset
    // uses) so it never depends on DOM state that a re-mount could reset.
    const ariseState = snapshot.extracted
      ? "extracted"
      : snapshot.extractionProgress?.completed && !snapshot.extractionProgress?.failed
        ? "ready"
        : "pending";
    if (ariseState !== this.lastAriseState) {
      this.lastAriseState = ariseState;
      if (ariseState === "ready" || ariseState === "extracted") this.pulseAriseBanner();
    }

  }

  /**
   * Cycle 10 §5.1 -- route/objective rail. Read-only over the AUTHORED critical route in
   * stage-world-catalog.js, so the rail can never disagree with the level it describes.
   *
   * Node count is `waypoints.length`, not a hard-coded 4. Every stage authors exactly four
   * today and the catalog validator enforces >=2 `intermediate-*` plus termination at the
   * canonical gate, but it permits MORE -- a 5-waypoint dungeon would silently clip a fixed
   * 4-node rail (spec Open risk R14). Rendering the real length costs nothing and removes
   * the failure mode.
   *
   * State source is `snapshot.encounter.objectives[objectiveId].completed`, driven by
   * ENCOUNTER_OBJECTIVE_COMPLETED -- no new event. The authored waypoint id is
   * `<stageId>:<objectiveId>` for the two intermediate nodes, which is exactly how a rail node
   * binds to encounter state. `ingress` is cleared the moment the run is under way; `final-gate`
   * clears on extraction.
   *
   * `aria-live` is deliberately absent (spec §7.3): route advance is a beat the world already
   * narrates, and #battle-status remains the single combat announcer.
   */
  renderRouteRail(snapshot) {
    const rail = root.querySelector("#battle-route-rail");
    if (!rail) return;
    const critical = stageWorldFor(this.stageId)?.gameplay?.routes?.find(({ kind }) => kind === "critical");
    const waypoints = critical?.waypoints ?? [];
    if (!waypoints.length) {
      rail.replaceChildren();
      delete this.surface.dataset.routeWaypoint;
      return;
    }
    const objectiveState = snapshot.encounter?.objectives ?? {};
    const extractionCleared = Boolean(snapshot.extracted);
    const cleared = waypoints.map(({ id, role }) => {
      if (role === "ingress") return this.started;
      if (role === "final-gate") return extractionCleared;
      return Boolean(objectiveState[id.slice(this.stageId.length + 1)]?.completed);
    });
    const activeIndex = cleared.indexOf(false);
    // Rebuild the <li> set only when the node identity changes; a per-frame replaceChildren
    // would discard focus and restart the active-pip animation 60 times a second.
    const signature = waypoints.map(({ id }) => id).join("|");
    if (this.routeRailSignature !== signature) {
      this.routeRailSignature = signature;
      rail.replaceChildren(...waypoints.map(({ id, role }) => {
        const node = document.createElement("li");
        node.className = "route-node";
        node.dataset.routeRole = role;
        node.dataset.routeWaypoint = id;
        // The label is written ONCE here, at build time, because the role -- and therefore the
        // label -- is fixed for the life of the node. Only `data-route-state` varies per frame.
        const pip = document.createElement("span");
        pip.className = "route-pip";
        pip.setAttribute("aria-hidden", "true");
        const label = document.createElement("b");
        label.textContent = ROUTE_ROLE_LABELS[role] ?? role;
        node.append(pip, label);
        return node;
      }));
    }
    // Per-frame work is ONE attribute write per node. Deliberately no DOM read-back: the
    // previous form read `node.querySelector("b").textContent` to decide whether to write it,
    // which dereferenced null wherever the child was not round-trippable -- it crashed
    // tests/battle-session-cutscene-audio.test.mjs (3 of 8) through a DOM stub whose
    // querySelector does not resolve appended children. Deriving state from the snapshot
    // instead of from the DOM removes the failure mode rather than guarding it.
    [...rail.children].forEach((node, index) => {
      const state = cleared[index] ? "cleared" : index === activeIndex ? "active" : "pending";
      if (node.dataset.routeState !== state) node.dataset.routeState = state;
    });
    const activeWaypoint = activeIndex === -1 ? waypoints.at(-1) : waypoints[activeIndex];
    if (this.surface.dataset.routeWaypoint !== activeWaypoint.id) this.surface.dataset.routeWaypoint = activeWaypoint.id;
  }

  /**
   * Cycle 10 §5.2 -- gimmick chip. SUBORDINATE by contract: the world decal is the primary
   * telegraph, so the chip carries the class glyph and the objective, and deliberately shows NO
   * countdown (the decal's fill is that information).
   *
   * The GIMMICK_ARMED / GIMMICK_TRIGGERED / GIMMICK_RESOLVED family is authored by the dungeon
   * cycle and is NOT emitted at this commit, so `armed` stays empty and the chip renders nothing.
   * That is the correct absent state, not a stub: `data-gimmick-state=""` is exactly what the
   * auto-hide CSS keys on, so this lights up unchanged the moment the events land.
   *
   * Concurrency is capped at 2 armed per stage stage-wide, so `+1` is the only overflow that can
   * exist and a second chip is never needed.
   */
  renderGimmickChip(snapshot) {
    const chip = root.querySelector("#battle-gimmick-state");
    if (!chip) return;
    const armed = (snapshot.gimmicks ?? []).filter((entry) => entry && entry.state !== "resolved");
    if (!armed.length) {
      if (chip.dataset.gimmickState !== "") {
        chip.dataset.gimmickState = "";
        chip.replaceChildren();
      }
      if (this.surface.dataset.gimmickState !== "") this.surface.dataset.gimmickState = "";
      return;
    }
    // Smallest remaining telegraph wins the single chip. telegraphTicks IS the full reaction
    // window (ARMED at T, TRIGGERED at exactly T + telegraphTicks), so remaining is derived and
    // the chip needs no timer of its own.
    //
    // telegraphTicks is PER CLASS, not one global constant -- four tiers: deformation 180,
    // narrowing gate 120, progress-ring/mirror 90, hazard 60. So it is READ FROM THE EVENT and
    // 180 is only a fallback, never the value. Hardcoding 180 would leave a 60-tick hazard cue
    // claiming to be arming for 120 ticks after it already fired (director ruling v6 C2).
    // The Number.isInteger guard also keeps a missing field from producing NaN, which would
    // poison the comparator and randomise which gimmick owns the chip.
    const expiryOf = (entry) => (Number.isInteger(entry.armedAtTick) ? entry.armedAtTick : 0)
      + (Number.isInteger(entry.telegraphTicks) ? entry.telegraphTicks : GIMMICK_TELEGRAPH_FALLBACK_TICKS);
    const ordered = [...armed].sort((left, right) => expiryOf(left) - expiryOf(right));
    const lead = ordered[0];
    const state = lead.state === "triggered" ? "triggered" : "armed";
    const glyph = GIMMICK_CLASS_GLYPHS[lead.gimmickClass] ?? GIMMICK_CLASS_GLYPHS.hazard;
    // Deformation narrowing is a simulation-enforced hazard band INSIDE the authored corridor.
    // The copy must not imply the floor moved, so the bars are labelled as a hazard proportion.
    const bars = state === "triggered" && lead.gimmickClass === "deformation"
      && lead.corridorWidthBefore > 0 && lead.corridorWidthAfter >= 0
      ? "▮".repeat(Math.round((lead.corridorWidthAfter / lead.corridorWidthBefore) * 5))
        .padEnd(5, "▯")
      : "";
    const overflow = ordered.length > 1 ? `+${ordered.length - 1}` : "";
    const signature = `${state}|${lead.gimmickId}|${bars}|${overflow}`;
    if (this.gimmickChipSignature !== signature) {
      this.gimmickChipSignature = signature;
      chip.replaceChildren();
      const glyphNode = document.createElement("span");
      glyphNode.className = "gimmick-glyph";
      glyphNode.setAttribute("aria-hidden", "true");
      glyphNode.textContent = glyph;
      const labelNode = document.createElement("span");
      labelNode.className = "gimmick-label";
      labelNode.textContent = lead.objectiveId ?? lead.gimmickId ?? "";
      chip.append(glyphNode, labelNode);
      if (bars) {
        const barsNode = document.createElement("span");
        barsNode.className = "gimmick-bars";
        barsNode.textContent = bars;
        chip.append(barsNode);
      }
      if (overflow) {
        const overflowNode = document.createElement("span");
        overflowNode.className = "gimmick-overflow";
        overflowNode.textContent = overflow;
        chip.append(overflowNode);
      }
    }
    if (chip.dataset.gimmickState !== state) chip.dataset.gimmickState = state;
    if (this.surface.dataset.gimmickState !== state) this.surface.dataset.gimmickState = state;
  }

  /**
   * Cycle 10 §5.3 -- active-buff strip. Steady state renders from `snapshot.buffs`, NEVER from
   * events, so it is unaffected by the effectAnchor() defect that blocks VFX for the same events.
   *
   * Three blocking contracts are honoured here and each one has a failure it prevents:
   *   1. `snapshot.buffs ?? []` -- presence is CONDITIONAL, emitted only when the run has a
   *      buff, mirroring abyssDepth. Reading `.length` unguarded would throw on every pre-drop
   *      frame, which is every frame of every existing digest fixture (spec Open risk R8).
   *   2. Slots are <li>/<span>, NEVER <button>. defense-phone-battle-hud-browser collects
   *      `.defense-bottom button` and requires every hit visible and >=44x44; a 26-36px readout
   *      chip is neither, so a <button> slot fails two assertions at once (R6).
   *   3. Order is the simulation's ascending buffId and the HUD MUST NOT re-sort. Sorting by
   *      remaining time makes icons swap position as they tick.
   * Display data resolves from the frozen catalog by `itemId`, never from `stat` (several items
   * share a stat), and an unknown stat degrades to the neutral group so a future enum change
   * cannot break the strip.
   */
  renderBuffStrip(snapshot) {
    const strip = root.querySelector("#battle-buff-strip");
    if (!strip) return;
    const entries = snapshot.buffs ?? [];
    if (!entries.length) {
      if (strip.childElementCount) strip.replaceChildren();
      this.buffStripSignature = "";
      return;
    }
    const tick = snapshot.tick ?? 0;
    const rendered = entries.map((entry) => {
      const item = buffItem(entry.itemId);
      const remaining = Math.max(0, (entry.expiresAtTick ?? 0) - tick);
      return {
        buffId: entry.buffId,
        itemId: entry.itemId,
        iconId: item?.iconId ?? "",
        name: item?.name ?? entry.itemId ?? "",
        rarity: BUFF_RARITIES.has(item?.rarity) ? item.rarity : "common",
        stat: BUFF_STATS.has(entry.stat) ? entry.stat : "neutral",
        // magnitude is an integer in basis points and stays one -- /100 happens only at the
        // read site, so no float is ever stored or serialized.
        percent: Number.isFinite(entry.magnitude) ? entry.magnitude / 100 : null,
        stacks: Math.max(1, entry.stacks ?? 1),
        seconds: Math.ceil(remaining / TICK_RATE),
        warning: remaining > 0 && remaining <= BUFF_WARN_TICKS,
      };
    });
    // Cycle 10 §5.3a -- pre-expiry warning, ONE comparison with TWO consumers. `slot.warning`
    // above is the only place the 180-tick threshold is evaluated; the hatched overlay
    // (data-buff-warning, set below) and the audio sting both read THIS result, so the visual
    // and the sound cannot disagree. Do not add a second copy of BUFF_WARN_TICKS anywhere.
    //
    // Placed ahead of the signature early-return deliberately: the audio edge must not depend
    // on DOM diffing. It is an EDGE, not a level -- fired only as the flag flips false->true,
    // so a buff stings once per approach rather than 180 times.
    //
    // The Set is also CLEARED when a buff rises back above the threshold, which is what makes
    // BUFF_REFRESHED correct: a refresh extends expiresAtTick, so the buff approaches expiry a
    // second time and must be allowed to warn again. A permanently-held id would warn once for
    // the lifetime of the run and stay silent through every later expiry.
    //
    // signalBuffExpiring is optional-called: defense-audio.js does not export it at this
    // commit, so this degrades to "no sting, hatch overlay still renders" instead of throwing
    // inside the render loop.
    rendered.forEach((slot) => {
      // ??= for the same prototype-constructed-fixture reason as the reset sites above.
      const warned = (this.warnedBuffIds ??= new Set());
      if (slot.warning) {
        if (!warned.has(slot.buffId)) {
          warned.add(slot.buffId);
          this.audio?.signalBuffExpiring?.(slot.buffId);
        }
        return;
      }
      warned.delete(slot.buffId);
    });
    // The signature covers every VISIBLE field, so any change at all means the slot content
    // changed. Build each slot complete in one pass and swap it in, rather than creating empty
    // spans and then re-querying them to fill in text: that re-query is the read-back pattern
    // that crashed renderRouteRail through a DOM stub, and here it would only have surfaced
    // once snapshot.buffs starts being emitted -- i.e. long after this code was reviewed.
    // Cost of always rebuilding is one replaceChildren per second per buff (the seconds label is
    // the fastest-changing field), not one per frame.
    const signature = rendered.map((slot) =>
      `${slot.buffId}:${slot.stacks}:${slot.seconds}:${slot.warning ? 1 : 0}`).join("|");
    if (this.buffStripSignature === signature) return;
    this.buffStripSignature = signature;
    strip.replaceChildren(...rendered.map((slot) => {
      const node = document.createElement("li");
      node.className = "buff-slot";
      node.dataset.buffId = slot.buffId;
      node.dataset.buffItem = slot.itemId ?? "";
      node.dataset.buffStat = slot.stat;
      node.dataset.buffRarity = slot.rarity;
      node.dataset.buffWarning = slot.warning ? "true" : "false";
      node.dataset.buffStacks = String(slot.stacks);
      const icon = document.createElement("span");
      icon.className = "buff-icon";
      if (slot.iconId) icon.dataset.uiIcon = slot.iconId;
      icon.setAttribute("aria-hidden", "true");
      const stacks = document.createElement("span");
      stacks.className = "buff-stacks";
      stacks.setAttribute("aria-hidden", "true");
      stacks.textContent = slot.stacks > 1 ? `×${slot.stacks}` : "";
      const remainingNode = document.createElement("span");
      remainingNode.className = "buff-remaining";
      remainingNode.setAttribute("aria-hidden", "true");
      remainingNode.textContent = `${slot.seconds}s`;
      // ONE .sr-only sentence per slot, with every numeric span aria-hidden, so a screen reader
      // hears one phrase instead of four disconnected fragments (spec §7.3).
      const readout = document.createElement("span");
      readout.className = "sr-only";
      const percentText = slot.percent === null ? "" : `, ${slot.percent}%`;
      readout.textContent = `${slot.name}${percentText}, ${slot.stacks}중첩, 남은 ${slot.seconds}초`;
      node.append(icon, stacks, remainingNode, readout);
      return node;
    }));
  }

  /** Flash the ARISE banner for ~1.2s; the timer is cleared in stop(). */
  pulseAriseBanner() {
    const banner = root.querySelector("#battle-arise-banner");
    if (!banner) return;
    banner.dataset.active = "true";
    clearTimeout(this.ariseTimer);
    this.ariseTimer = setTimeout(() => {
      const node = root.querySelector("#battle-arise-banner");
      if (node) node.dataset.active = "false";
    }, 1200);
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
      return `<button class="skill-action" data-cast="${id}" data-defense-skill="${id}" aria-label="${escapeHtml(skill.name ?? id)} 스킬 사용" ${cooldown ? "disabled" : ""}><span class="skill-glyph" aria-hidden="true">${glyph}</span><span class="skill-copy"><strong>${escapeHtml(skill.name ?? id)}</strong><small>${cooldown ? `${(cooldown / TICK_RATE).toFixed(1)}s` : "준비됨"}</small></span></button>`;
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
        card.className = "edge-card system-window growth-system-window";
        card.id = "defense-growth-offer";
        this.surface.append(card);
        this.focusBeforeGrowth = document.activeElement;
      }
      if (card.dataset.offer !== offerKey) {
        card.dataset.offer = offerKey;
        const previews = snapshot.growthOffer.choices.map((id) => growthUpgradePreview(id, snapshot));
        telemetry.append("GROWTH_OFFER_VALUES", { tick: snapshot.tick, choices: previews });
        card.innerHTML = `<p class="system-alert-line" role="status">[알림] 플레이어에게 퀘스트가 도착했습니다.</p><h2>성장 선택 · 전투 일시 정지</h2><p class="system-alert-sub">Lv.${escapeHtml(String(snapshot.commander?.level ?? 1))} · 군단 강화 노드를 하나 개방하십시오.</p><div class="choices">${previews.map(({ skillId, label }) => `<button data-pick="${skillId}"><span class="progression-icon" data-track="run-scoped" aria-hidden="true"></span><strong>${escapeHtml(SKILLS[skillId]?.name ?? skillId)}</strong><span class="growth-choice-copy">${escapeHtml(label)}</span></button>`).join("")}</div>`;
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
    const actionMarkup = `${stanceMarkup}<button id="toggle-pause" data-ui-icon-lead="control-pause" aria-pressed="${this.userPaused}">${this.userPaused ? "전투 계속" : "일시 정지"}</button>${
      candidate && !snapshot.extracted
        ? `<button id="extract-elite" data-defense-extract="${candidate.enemyId}"${extractionDisabled ? " disabled" : ""} aria-disabled="${extractionDisabled ? "true" : "false"}" title="${extractionTitle}">${escapeHtml(extractionLabel)}</button>`
        : ""
    }`;
    if (actions.dataset.actions !== actionMarkup) {
      const focusedActionId = actions.contains(document.activeElement) ? document.activeElement.id : "";
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
      const focusTarget = focusedActionId ? document.getElementById(focusedActionId) : null;
      if (focusTarget && actions.contains(focusTarget)) focusTarget.focus();
    }
  }

  togglePause() {
    const nextPaused = !this.userPaused;
    if (nextPaused) {
      this.heldKeys.clear();
      this.send("MOVE", "IDLE");
    }
    this.userPaused = nextPaused;
    this.surface.dataset.defenseState = this.userPaused ? "paused" : "active";
    this.accumulator = 0;
    if (this.userPaused) {
      this.audio.pause();
    } else {
      this.audio.resume();
    }
    this.render();
    // #battle-actions is reconciled when aria-pressed changes, so the button
    // that opened the overlay is detached. Resume always lands on the live
    // replacement pause control, which is also the stable keyboard target
    // when P/Escape opened the overlay without a focused trigger.
    if (!this.userPaused) this.surface.querySelector("#toggle-pause")?.focus();
  }

  setPauseBackgroundInert(active, overlay = null) {
    if (!active) {
      root.querySelectorAll('[data-pause-inert="true"]').forEach((node) => {
        node.inert = false;
        delete node.dataset.pauseInert;
      });
      return;
    }
    const candidates = [
      ...this.surface.children,
      ...root.querySelectorAll("#command-deck-left, #command-deck-right, #sortie-fab"),
    ];
    candidates.forEach((node) => {
      if (node === overlay || node.inert) return;
      node.inert = true;
      node.dataset.pauseInert = "true";
    });
  }

  trapPauseFocus(event, overlay) {
    if (event.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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
      this.setPauseBackgroundInert(false);
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
    const muted = this.audio.muted;
    const volume = this.audio.volume;
    const markup = `
      <div class="pause-overlay-panel" role="dialog" aria-modal="true" aria-labelledby="pause-overlay-title" aria-describedby="pause-overlay-copy">
        <div class="pause-overlay-head">
          <div><p class="eyebrow">ABYSSAL LANTERN · PAUSED</p><h2 id="pause-overlay-title">전투 일시 정지</h2><p id="pause-overlay-copy">현재 빌드와 편성을 확인하세요. Esc 또는 P로 바로 복귀할 수 있습니다.</p></div>
          <button id="pause-overlay-resume" class="primary-action">전투 재개</button>
        </div>
        <div class="pause-overlay-settings" role="group" aria-label="오디오 설정">
          <button type="button" id="pause-audio-mute-btn" class="audio-mute-button" aria-pressed="${muted}" aria-label="음소거 토글">
            <span>${muted ? "소리 켜기" : "음소거"}</span>
          </button>
          <div class="audio-volume-slider-container">
            <label id="pause-volume-label" for="pause-audio-volume">볼륨: ${Math.round(volume * 100)}%</label>
            <input type="range" id="pause-audio-volume" min="0" max="1" step="0.05" value="${volume}" aria-labelledby="pause-volume-label" />
          </div>
        </div>
        <div class="command-segment-bar" role="tablist" aria-label="일시정지 요약">${segments.map((segment) => `<button id="pause-tab-${segment.id}" class="command-segment${segment.id === this.pauseOverlaySegment ? " is-active" : ""}" role="tab" aria-selected="${segment.id === this.pauseOverlaySegment}" aria-controls="pause-panel-${segment.id}" tabindex="${segment.id === this.pauseOverlaySegment ? "0" : "-1"}" data-pause-segment="${segment.id}">${segment.label}</button>`).join("")}</div>
        <div id="pause-panel-${this.pauseOverlaySegment}" class="command-segment-body pause-overlay-readonly" role="tabpanel" aria-labelledby="pause-tab-${this.pauseOverlaySegment}">${segments.find((segment) => segment.id === this.pauseOverlaySegment).html}</div>
      </div>`;
    let created = false;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "defense-pause-overlay";
      overlay.addEventListener("keydown", (event) => this.trapPauseFocus(event, overlay));
      this.surface.append(overlay);
      created = true;
    }
    this.setPauseBackgroundInert(true, overlay);
    if (overlay.dataset.segment !== this.pauseOverlaySegment) {
      overlay.dataset.segment = this.pauseOverlaySegment;
      overlay.innerHTML = markup;
      overlay.querySelector("#pause-overlay-resume").addEventListener("click", () => this.togglePause());
      overlay.onkeydown = (event) => {
        if (event.key.toLowerCase() === "p") {
          event.preventDefault();
          event.stopPropagation();
          this.togglePause();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          this.togglePause();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...overlay.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        )].filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      const pauseTabs = [...overlay.querySelectorAll("[data-pause-segment]")];
      const selectPauseSegment = (button) => {
        this.pauseOverlaySegment = button.dataset.pauseSegment;
        overlay.dataset.segment = "";
        this.renderPauseOverlay();
        overlay.querySelector(`[data-pause-segment="${this.pauseOverlaySegment}"]`)?.focus();
      };
      pauseTabs.forEach((button, index) => {
        button.addEventListener("click", () => selectPauseSegment(button));
        button.addEventListener("keydown", (event) => {
          const last = pauseTabs.length - 1;
          const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : event.key === "ArrowRight" || event.key === "ArrowDown"
                ? (index + 1) % pauseTabs.length
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                  ? (index - 1 + pauseTabs.length) % pauseTabs.length
                  : null;
          if (nextIndex === null) return;
          event.preventDefault();
          event.stopPropagation();
          selectPauseSegment(pauseTabs[nextIndex]);
        });
      });

      const muteBtn = overlay.querySelector("#pause-audio-mute-btn");
      muteBtn?.addEventListener("click", () => {
        const nextMuted = !this.audio.muted;
        this.audio.setMuted(nextMuted);
        muteBtn.setAttribute("aria-pressed", String(nextMuted));
        const textSpan = muteBtn.querySelector("span");
        if (textSpan) textSpan.textContent = nextMuted ? "소리 켜기" : "음소거";

      });

      const volumeInput = overlay.querySelector("#pause-audio-volume");
      volumeInput?.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.audio.setVolume(val);
        const label = overlay.querySelector("#pause-volume-label");
        if (label) label.textContent = `볼륨: ${Math.round(val * 100)}%`;

      });
    }
    if (created) overlay.querySelector("#pause-overlay-resume")?.focus();
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
    // Stage-to-stage carry-over: a cleared stage hands its skill ranks and collected items to the
    // next run (defeat clears them). Persisted below with the rest of the resolution.
    campaign = applyRunCarryOver(campaign, { stageId: this.stageId, outcome, carryOver: runCarryOver(this.run) });
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
    card.innerHTML = `<p class="eyebrow">ABYSSAL LANTERN · RUN COMPLETE</p><h2>${outcome === "defeat" ? "등불이 꺼졌습니다" : complete ? "Abyssal Lantern 완주" : "스테이지 봉쇄 성공"}</h2>
      <p>${outcome === "defeat" ? "같은 스테이지를 즉시 다시 시작하거나 출전 준비로 돌아갈 수 있습니다." : complete ? "세 등불이 연결되었습니다. 기록실에서 완주 기록을 확인하세요." : "다음 스테이지로 이어가거나 출전 준비에서 빌드를 정비하세요."}</p>
      <div class="choices"><button id="result-action">${outcome === "defeat" ? "같은 스테이지 재도전" : complete ? "기록실로" : "다음 스테이지"}</button><button id="lobby-action">출전 준비로</button></div>`;
    this.surface.append(card);
    // Deck visibility is derived from session.started inside renderShell(), so
    // remountForStage()/beginRun() alone are enough here -- there is no separate open/close
    // state left to reset on either branch.
    card.querySelector("#result-action").addEventListener("click", () => {
      if (outcome === "defeat") {
        this.remountForStage(this.stageId);
        this.beginRun();
      } else if (complete) {
        this.remountForStage(STAGES[0].id);
        selectedStageId = STAGES[0].id;
      } else {
        selectedStageId = STAGES[campaign.unlockedStageIndex].id;
        this.remountForStage(selectedStageId);
        this.beginRun();
      }
      renderShell();
    });
    card.querySelector("#lobby-action").addEventListener("click", () => {
      this.remountForStage(this.stageId);
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
