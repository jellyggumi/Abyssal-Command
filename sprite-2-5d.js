const WORLD_WIDTH = 1536;
const WORLD_HEIGHT = 1024;
const FIXED_STEP = 1 / 60;
const MAX_FRAME_DELTA = 0.25;
const MAX_CATCH_UP_STEPS = 5;
const ARENA_X = 768;
const ARENA_Y = 604;
const ARENA_HALF_WIDTH = 520;
const ARENA_HALF_HEIGHT = 270;
const ARENA_RING = [
  [ARENA_X, ARENA_Y - ARENA_HALF_HEIGHT],
  [ARENA_X + ARENA_HALF_WIDTH, ARENA_Y],
  [ARENA_X, ARENA_Y + ARENA_HALF_HEIGHT],
  [ARENA_X - ARENA_HALF_WIDTH, ARENA_Y],
];
const FAR_DEPTH_SCALE = 0.62;
const NEAR_DEPTH_SCALE = 1;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_SPEED = 218;
const PLAYER_DAMAGE = 58;
const PLAYER_ATTACK_RANGE = 160;
const PLAYER_ATTACK_COOLDOWN = 0.48;
const PLAYER_HIT_GRACE = 0.38;
const ENEMY_BASE_HEALTH = 58;
const ENEMY_ATTACK_RANGE = 76;
const ENEMY_ATTACK_COOLDOWN = 1.22;
const ENEMY_CAP = 20;
const TARGET_WAVE = 10;
const ENCIRCLE_RADIUS = 140;
const ENCIRCLE_THRESHOLD = 3;
const SPAWN_CUE_LEAD = 0.35;
const BRIEFING_SKIP_KEY = "abyssal-lantern:cinder-court:skip-briefing";
const LANTERN_MAX_CHARGE = 100;
const LANTERN_REGEN_PER_SECOND = 7;
const LANTERN_CHARGE_PER_KILL = 6;
const NOVA_COST = 45;
const NOVA_COOLDOWN = 6.5;
const NOVA_RADIUS = 250;
const NOVA_DAMAGE = 96;
const WARD_COST = 30;
const WARD_COOLDOWN = 9;
const WARD_DURATION = 3;
const PICKUP_LIFETIME = 12;
// Collection radius for field drops. Matched to PLAYER_ATTACK_RANGE (160) so a drop from an
// enemy the player melee-kills lands inside its own collect zone — otherwise kills at up to
// 160px drop items outside the 78px magnet and they pile up uncollected (felt like "no drops").
// Still a WALK-TO radius, not a full-arena vacuum: ranged Nova kills (radius 250) drop beyond it
// and must be walked to. The y-axis is iso-compressed by 1.42 at the check site, so the vertical
// reach is ~113.
const PICKUP_MAGNET_RADIUS = 160;
const RELIC_SCORE = 250;
const EMBER_SHARD_HEAL = 18;
const OIL_FLASK_CHARGE = 35;
const RUN_DIGEST_KEY = "abyssal-lantern:cinder-court:last-run";
const CONTINUE_URL = "abyssal-oneline.html";
const CONTINUE_DELAY_SECONDS = 9;
const AUDIO_MUTE_KEY = "abyssal-lantern:cinder-court:muted";

// World record beats: the Cinder Court is the lower reliquary of the Abyssal
// Lantern campaign, so every wave reveals one line of why the Ember Cohort
// keeps climbing toward the last flame.
const LORE_BEATS = [
  "잿불 법정은 군단이 그 기름을 용광로로 바꾸기 전까지 성유물고였다.",
  "잿불 군단의 몸은 비어 있다. 그 안에서 타는 것은 훔쳐온 랜턴 기름이다.",
  "당신이 줍는 유물 조각 하나하나가 심연이 지우려 한 이름이다.",
  "파수꾼의 결계는 갑옷이 아니다. 어둠이 읽지 못하도록 봉인된 기억이다.",
  "더 깊은 군단은 이미 타오르며 온다. 보내지기 전에 불붙여진 것이다.",
  "랜턴은 심연을 죽이지 않는다. 다만 심연이 셈을 끝내지 못하게 막을 뿐이다.",
];

const ITEM_KINDS = Object.freeze({
  "ember-shard": Object.freeze({ label: "잿불 파편", color: "#ff9a52" }),
  "oil-flask": Object.freeze({ label: "기름 플라스크", color: "#ffd489" }),
  "relic-mote": Object.freeze({ label: "유물 조각", color: "#8fe9ff" }),
});
const ITEM_DROP_ORDER = Object.freeze(["ember-shard", "oil-flask", "relic-mote"]);


const ASSET_URLS = {
  backdrop: new URL("./assets/images/sprite-2-5d/cinder-court-backdrop.png", import.meta.url),
  wardenManifest: new URL("./assets/images/sprite-2-5d/warden/manifest.json", import.meta.url),
  wardenSheet: new URL("./assets/images/sprite-2-5d/warden/sprite-sheet.png", import.meta.url),
  cohortManifest: new URL("./assets/images/sprite-2-5d/ember-cohort/manifest.json", import.meta.url),
  cohortSheet: new URL("./assets/images/sprite-2-5d/ember-cohort/sprite-sheet.png", import.meta.url),
  relicItem: new URL("./assets/images/sprite-2-5d/items/relic-crystal.png", import.meta.url),
};

const body = document.body;
const gameRoot = document.querySelector("#sprite-2-5d-game");
const canvas = document.querySelector("#sprite-2-5d-canvas");
const context = canvas.getContext("2d", { alpha: false });
const statusNode = document.querySelector("#sprite-2-5d-status");
const loadingPanel = document.querySelector("#sprite-2-5d-loading");
const gameOverPanel = document.querySelector("#sprite-2-5d-game-over");
const finalScoreNode = document.querySelector("#sprite-2-5d-final-score");
const restartButton = document.querySelector("#sprite-2-5d-restart");
const healthMeter = document.querySelector("#sprite-2-5d-health");
const healthFill = document.querySelector("#sprite-2-5d-health-fill");
const healthValue = document.querySelector("#sprite-2-5d-health-value");
const waveValue = document.querySelector("#sprite-2-5d-wave");
const scoreValue = document.querySelector("#sprite-2-5d-score");
const enemiesValue = document.querySelector("#sprite-2-5d-enemies");
const touchControls = document.querySelector("#sprite-2-5d-touch-controls");
const controlButtons = Array.from(document.querySelectorAll("[data-control]"));
const skillButtons = Array.from(document.querySelectorAll("[data-skill]"));
const runSummaryNode = document.querySelector("#sprite-2-5d-run-summary");
const countdownNode = document.querySelector("#sprite-2-5d-countdown");
const continueLink = document.querySelector("#sprite-2-5d-continue");
const chargeMeter = document.querySelector("#sprite-2-5d-charge");
const chargeFill = document.querySelector("#sprite-2-5d-charge-fill");
const chargeValue = document.querySelector("#sprite-2-5d-charge-value");
const relicsValue = document.querySelector("#sprite-2-5d-relics");
const loreNode = document.querySelector("#sprite-2-5d-lore");
const audioToggle = document.querySelector("#sprite-2-5d-audio-toggle");
const novaCooldownNode = document.querySelector("#sprite-2-5d-skill-nova-cooldown");
const wardCooldownNode = document.querySelector("#sprite-2-5d-skill-ward-cooldown");
const gameOverEyebrow = document.querySelector("#sprite-2-5d-game-over-eyebrow");
const gameOverTitle = document.querySelector("#game-over-title");
const briefingPanel = document.querySelector("#sprite-2-5d-briefing");
const briefingStart = document.querySelector("#sprite-2-5d-briefing-start");
const briefingSkip = document.querySelector("#sprite-2-5d-briefing-skip");
const helpButton = document.querySelector("#sprite-2-5d-help");

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

if (!context) {
  throw new Error("A 2D canvas context is required for the Cinder Court route.");
}

let canvasBackingScale = 1;
let dprMatch = null;
let dprMatchListener = null;
context.imageSmoothingEnabled = false;

function resolveCanvasBackingScale() {
  const dpr = Number(window.devicePixelRatio);
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

function syncCanvasBackingStore() {
  const nextScale = resolveCanvasBackingScale();
  const nextWidth = Math.max(1, Math.round(WORLD_WIDTH * nextScale));
  const nextHeight = Math.max(1, Math.round(WORLD_HEIGHT * nextScale));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = false;
  context.setTransform(nextScale, 0, 0, nextScale, 0, 0);

  canvasBackingScale = nextScale;
}

function rebindBackingScaleWatcher() {
  const nextScale = resolveCanvasBackingScale();
  const nextMatch = window.matchMedia(`(resolution: ${nextScale}dppx)`);
  if (dprMatch && nextMatch.media === dprMatch.media) {
    return;
  }

  if (dprMatch && dprMatchListener) {
    if (dprMatch.removeEventListener) {
      dprMatch.removeEventListener("change", dprMatchListener);
    } else {
      dprMatch.removeListener(dprMatchListener);
    }
  }

  const onBackingScaleChange = () => {
    resyncCanvasBackingScale();
  };
  dprMatch = nextMatch;
  dprMatchListener = onBackingScaleChange;
  if (dprMatch.addEventListener) {
    dprMatch.addEventListener("change", dprMatchListener);
  } else {
    dprMatch.addListener(dprMatchListener);
  }
}

function resyncCanvasBackingScale() {
  syncCanvasBackingStore();
  rebindBackingScaleWatcher();
}

window.addEventListener("resize", resyncCanvasBackingScale, { passive: true });
syncCanvasBackingStore();
rebindBackingScaleWatcher();
const assets = {
  backdrop: null,
  warden: null,
  cohort: null,
  relicItem: null,
};

const player = {
  kind: "player",
  asset: null,
  x: ARENA_X,
  y: ARENA_Y + 42,
  facing: 1,
  scale: 0.78,
  health: PLAYER_MAX_HEALTH,
  clipName: "idle",
  clipTime: 0,
  clipFrame: 0,
  attackCooldown: 0,
  damageCooldown: 0,
  attackId: 0,
  moving: false,
  hitFlash: 0,
  wardTime: 0,
};

const state = {
  mode: "loading",
  wave: 1,
  score: 0,
  enemies: [],
  livingEnemies: 0,
  pendingSpawns: 0,
  spawnTimer: 0,
  intermission: 0,
  nextEnemyId: 1,
  accumulator: 0,
  lastTimestamp: 0,
  hudDirty: true,
  reducedMotion: reducedMotionQuery.matches,
  waveSeed: 0,
  charge: LANTERN_MAX_CHARGE,
  kills: 0,
  relics: 0,
  pickups: [],
  nextPickupId: 1,
  novaCooldown: 0,
  wardCooldown: 0,
  novaFlash: 0,
  muted: false,
  continueTimerId: 0,
  continueRemaining: 0,
  encircled: false,
  spawnCue: null,
};


const keyboard = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const controlHeld = {
  up: 0,
  down: 0,
  left: 0,
  right: 0,
};
const semanticNudge = {
  x: 0,
  y: 0,
};

const pointerBindings = new Map();
const renderActors = [];
const renderScratch = {
  anchor: { x: 0, y: 0 },
  spriteDest: { x: 0, y: 0, width: 0, height: 0 },
  shadow: { centerX: 0, centerY: 0, radiusX: 0, radiusY: 0 },
  hitFlash: { visible: false, centerX: 0, centerY: 0, radiusX: 0, radiusY: 0, lineWidth: 0 },
  healthBar: {
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    inset: 0,
    fillX: 0,
    fillY: 0,
    fillWidth: 0,
    fillHeight: 0,
  },
  attackArc: {
    visible: false,
    centerX: 0,
    centerY: 0,
    radius: 0,
    lineWidth: 0,
    startAngle: 0,
    endAngle: 0,
    anticlockwise: false,
  },
  groundRing: { centerX: 0, centerY: 0, radiusX: 0, radiusY: 0, lineWidth: 0 },
};
const SPAWN_POINTS = [
  [284, 577],
  [421, 405],
  [694, 350],
  [1027, 389],
  [1239, 570],
  [1138, 743],
  [848, 840],
  [536, 798],
];
let attackQueued = false;
let animationFrameId = 0;
let loopRunning = false;
let gameStarted = false;

function setControlsEnabled(enabled) {
  for (let index = 0; index < controlButtons.length; index += 1) {
    controlButtons[index].disabled = !enabled;
  }
}

function setMode(mode) {
  state.mode = mode;
  body.dataset.gameState = mode;
  gameRoot.dataset.runtime = mode;
  setControlsEnabled(mode === "running" || mode === "wave-clear");
}
function isActiveMode() {
  return state.mode === "running" || state.mode === "wave-clear";
}

function startLoop() {
  if (loopRunning || document.hidden || !isActiveMode()) {
    return;
  }
  state.lastTimestamp = 0;
  state.accumulator = 0;
  loopRunning = true;
  animationFrameId = requestAnimationFrame(frame);
}

function stopLoop() {
  if (animationFrameId !== 0) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = 0;
  loopRunning = false;
  state.lastTimestamp = 0;
  state.accumulator = 0;
}


function announce(message) {
  statusNode.textContent = message;
}

function loadImage(url, label) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`${label} could not be decoded.`)), { once: true });
    image.src = url.href;
  });
}

async function loadManifest(url, label) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
  return response.json();
}

function validateManifest(label, manifest, sheetImage) {
  if (!manifest || manifest.schema !== "perfectpixel.sprite/2" || manifest.version !== 2) {
    throw new Error(`${label} uses an unsupported sprite manifest.`);
  }
  if (!manifest.sheet || manifest.sheet.image !== "sprite-sheet.png") {
    throw new Error(`${label} does not declare the expected sprite sheet.`);
  }
  if (manifest.sheet.width !== sheetImage.naturalWidth || manifest.sheet.height !== sheetImage.naturalHeight) {
    throw new Error(`${label} sheet dimensions do not match its manifest.`);
  }

  const requiredClips = ["idle", "walk", "attack"];
  for (let clipIndex = 0; clipIndex < requiredClips.length; clipIndex += 1) {
    const clipName = requiredClips[clipIndex];
    const clip = manifest.animations && manifest.animations[clipName];
    if (!clip || !Number.isInteger(clip.frames) || clip.frames < 1 || !Array.isArray(clip.rects) || clip.rects.length !== clip.frames) {
      throw new Error(`${label} ${clipName} has an invalid frame contract.`);
    }
    if (!Number.isFinite(clip.fps) || clip.fps <= 0 || typeof clip.loop !== "boolean") {
      throw new Error(`${label} ${clipName} has invalid playback metadata.`);
    }
    if (!clip.pivot || !Number.isFinite(clip.pivot.x) || !Number.isFinite(clip.pivot.y)) {
      throw new Error(`${label} ${clipName} is missing a valid pivot.`);
    }

    for (let frameIndex = 0; frameIndex < clip.rects.length; frameIndex += 1) {
      const rect = clip.rects[frameIndex];
      const validRect = rect
        && Number.isFinite(rect.x)
        && Number.isFinite(rect.y)
        && Number.isFinite(rect.w)
        && Number.isFinite(rect.h)
        && rect.w > 0
        && rect.h > 0
        && rect.x >= 0
        && rect.y >= 0
        && rect.x + rect.w <= manifest.sheet.width
        && rect.y + rect.h <= manifest.sheet.height;
      if (!validRect) {
        throw new Error(`${label} ${clipName} frame ${frameIndex} leaves the declared sheet.`);
      }
    }
  }

  if (manifest.animations.attack.loop) {
    throw new Error(`${label} attack must be a non-looping clip.`);
  }
  if (!manifest.animations.idle.loop || !manifest.animations.walk.loop) {
    throw new Error(`${label} idle and walk clips must loop.`);
  }

  return {
    manifest,
    image: sheetImage,
  };
}

async function loadAssets() {
  const results = await Promise.all([
    loadImage(ASSET_URLS.backdrop, "Cinder Court backdrop"),
    loadManifest(ASSET_URLS.wardenManifest, "Dusk Warden manifest"),
    loadImage(ASSET_URLS.wardenSheet, "Dusk Warden sheet"),
    loadManifest(ASSET_URLS.cohortManifest, "Ember Cohort manifest"),
    loadImage(ASSET_URLS.cohortSheet, "Ember Cohort sheet"),
  ]);

  if (results[0].naturalWidth !== WORLD_WIDTH || results[0].naturalHeight !== WORLD_HEIGHT) {
    throw new Error("Cinder Court backdrop dimensions are not 1536 × 1024.");
  }

  assets.backdrop = results[0];
  assets.warden = validateManifest("Dusk Warden", results[1], results[2]);
  assets.cohort = validateManifest("Ember Cohort", results[3], results[4]);

  // Item drop sprite. Optional: a load failure degrades drawPickups() to its diamond
  // fallback rather than blocking the whole run on a missing icon.
  try {
    assets.relicItem = await loadImage(ASSET_URLS.relicItem, "Relic item sprite");
  } catch (error) {
    console.warn("Relic item sprite failed to load; using diamond fallback:", error);
    assets.relicItem = null;
  }
}

function setClip(actor, clipName, force = false) {
  if (!force && actor.clipName === clipName) {
    return;
  }
  actor.clipName = clipName;
  actor.clipTime = 0;
  actor.clipFrame = 0;
}

function advanceClip(actor, deltaTime) {
  const clip = actor.asset.manifest.animations[actor.clipName];
  actor.clipTime += deltaTime;
  const requestedFrame = Math.floor(actor.clipTime * clip.fps);

  if (clip.loop) {
    actor.clipFrame = requestedFrame % clip.frames;
    return false;
  }

  if (requestedFrame >= clip.frames) {
    setClip(actor, "idle", true);
    return true;
  }

  actor.clipFrame = requestedFrame;
  return false;
}

function clampToArena(actor, margin) {
  const halfWidth = ARENA_HALF_WIDTH - margin;
  const halfHeight = ARENA_HALF_HEIGHT - margin * 0.5;
  let localX = actor.x - ARENA_X;
  let localY = actor.y - ARENA_Y;
  const normalizedDistance = Math.abs(localX) / halfWidth + Math.abs(localY) / halfHeight;

  if (normalizedDistance > 1) {
    localX /= normalizedDistance;
    localY /= normalizedDistance;
    actor.x = ARENA_X + localX;
    actor.y = ARENA_Y + localY;
  }
}

function clearInput() {
  keyboard.up = false;
  keyboard.down = false;
  keyboard.left = false;
  keyboard.right = false;
  controlHeld.up = 0;
  controlHeld.down = 0;
  controlHeld.left = 0;
  controlHeld.right = 0;
  semanticNudge.x = 0;
  semanticNudge.y = 0;
  pointerBindings.clear();
  attackQueued = false;
  for (let index = 0; index < controlButtons.length; index += 1) {
    controlButtons[index].classList.remove("is-active");
  }
}

// --- Procedural battle audio -------------------------------------------------
// The Cinder Court route ships no audio files: every cue is synthesised from a
// short oscillator envelope so the arena stays a single-page, asset-free route.
let audioContext = null;

function readStoredMute() {
  try {
    return window.localStorage.getItem(AUDIO_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistMute(muted) {
  try {
    window.localStorage.setItem(AUDIO_MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage is optional; muting still applies for the current run.
  }
}

const AUDIO_CUES = Object.freeze({
  strike: { type: "square", from: 320, to: 140, duration: 0.12, gain: 0.05 },
  hit: { type: "sawtooth", from: 210, to: 90, duration: 0.14, gain: 0.05 },
  kill: { type: "triangle", from: 420, to: 120, duration: 0.24, gain: 0.06 },
  nova: { type: "sawtooth", from: 620, to: 70, duration: 0.55, gain: 0.09 },
  ward: { type: "sine", from: 180, to: 720, duration: 0.42, gain: 0.07 },
  pickup: { type: "sine", from: 640, to: 1180, duration: 0.16, gain: 0.05 },
  wave: { type: "triangle", from: 240, to: 480, duration: 0.42, gain: 0.06 },
  gameover: { type: "sine", from: 300, to: 60, duration: 0.9, gain: 0.09 },
});

function ensureAudioContext() {
  if (state.muted) {
    return null;
  }
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  if (!audioContext) {
    try {
      audioContext = new AudioContextClass();
    } catch {
      audioContext = null;
      return null;
    }
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playCue(cueName) {
  const cue = AUDIO_CUES[cueName];
  if (!cue) {
    return false;
  }
  const audio = ensureAudioContext();
  if (!audio) {
    return false;
  }

  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = cue.type;
  oscillator.frequency.setValueAtTime(cue.from, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, cue.to), now + cue.duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(cue.gain, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + cue.duration + 0.02);
  return true;
}

function setMuted(muted) {
  state.muted = muted;
  persistMute(muted);
  audioToggle.textContent = muted ? "소리: 꺼짐" : "소리: 켜짐";
  audioToggle.setAttribute("aria-pressed", muted ? "true" : "false");
  if (muted && audioContext) {
    audioContext.suspend().catch(() => {});
  }
}

// --- Items -------------------------------------------------------------------
function itemKindForEnemy(enemy) {
  return ITEM_DROP_ORDER[enemy.id % ITEM_DROP_ORDER.length];
}

function spawnPickup(enemy) {
  state.pickups.push({
    id: state.nextPickupId,
    kind: itemKindForEnemy(enemy),
    x: enemy.x,
    y: enemy.y,
    life: PICKUP_LIFETIME,
    bob: 0,
  });
  state.nextPickupId += 1;
}

function collectPickup(pickup) {
  if (pickup.kind === "ember-shard") {
    player.health = Math.min(PLAYER_MAX_HEALTH, player.health + EMBER_SHARD_HEAL);
  } else if (pickup.kind === "oil-flask") {
    state.charge = Math.min(LANTERN_MAX_CHARGE, state.charge + OIL_FLASK_CHARGE);
  } else {
    state.relics += 1;
    state.score += RELIC_SCORE;
  }
  playCue("pickup");
  state.hudDirty = true;
}

function updatePickups(deltaTime) {
  for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
    const pickup = state.pickups[index];
    pickup.life -= deltaTime;
    pickup.bob += deltaTime;

    const deltaX = player.x - pickup.x;
    const deltaY = (player.y - pickup.y) * 1.42;
    if (deltaX * deltaX + deltaY * deltaY <= PICKUP_MAGNET_RADIUS * PICKUP_MAGNET_RADIUS) {
      collectPickup(pickup);
      state.pickups.splice(index, 1);
      continue;
    }
    if (pickup.life <= 0) {
      state.pickups.splice(index, 1);
    }
  }
}

// --- Skills ------------------------------------------------------------------
function castNova() {
  state.charge -= NOVA_COST;
  state.novaCooldown = NOVA_COOLDOWN;
  state.novaFlash = state.reducedMotion ? 0.08 : 0.42;
  let struck = 0;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (enemy.dead) {
      continue;
    }
    const deltaX = enemy.x - player.x;
    const deltaY = (enemy.y - player.y) * 1.42;
    if (deltaX * deltaX + deltaY * deltaY <= NOVA_RADIUS * NOVA_RADIUS) {
      damageEnemy(enemy, NOVA_DAMAGE);
      struck += 1;
    }
  }
  triggerShake(SHAKE_NOVA);
  triggerHitStop(HITSTOP_HEAVY_TICKS);
  spawnSparks(player.x, player.y - 40, 26, 2.2, 240);
  playCue("nova");
  announce(`잿불 노바 작렬. 고리 안의 적 ${struck}기가 휩쓸렸다.`);
  return struck;
}

function castWard() {
  state.charge -= WARD_COST;
  state.wardCooldown = WARD_COOLDOWN;
  player.wardTime = WARD_DURATION;
  playCue("ward");
  announce("랜턴 결계 봉인. 3초간 모든 피해를 거부한다.");
  return true;
}

function skillCost(skillName) {
  return skillName === "nova" ? NOVA_COST : WARD_COST;
}

function skillCooldownRemaining(skillName) {
  return skillName === "nova" ? state.novaCooldown : state.wardCooldown;
}

function canUseSkill(skillName) {
  if (skillName !== "nova" && skillName !== "ward") {
    return false;
  }
  if (state.mode !== "running" && state.mode !== "wave-clear") {
    return false;
  }
  return skillCooldownRemaining(skillName) <= 0 && state.charge >= skillCost(skillName);
}

function useSkill(skillName) {
  if (!canUseSkill(skillName)) {
    return false;
  }
  if (skillName === "nova") {
    castNova();
  } else {
    castWard();
  }
  state.hudDirty = true;
  return true;
}

function updateSkills(deltaTime) {
  if (state.novaCooldown > 0 || state.wardCooldown > 0) {
    state.hudDirty = true;
  }
  state.novaCooldown = Math.max(0, state.novaCooldown - deltaTime);
  state.wardCooldown = Math.max(0, state.wardCooldown - deltaTime);
  state.novaFlash = Math.max(0, state.novaFlash - deltaTime);
  player.wardTime = Math.max(0, player.wardTime - deltaTime);


  const regenerated = Math.min(LANTERN_MAX_CHARGE, state.charge + LANTERN_REGEN_PER_SECOND * deltaTime);
  if (regenerated !== state.charge) {
    state.charge = regenerated;
    state.hudDirty = true;
  }
}

// --- Run closure -------------------------------------------------------------
function writeRunDigest(reason, outcome = "defeat") {
  const digest = {
    route: "cinder-court",
    reason,
    outcome,
    wave: state.wave,
    score: state.score,
    kills: state.kills,
    relics: state.relics,
    endedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(RUN_DIGEST_KEY, JSON.stringify(digest));
  } catch {
    // A blocked storage quota must never stop the run from closing.
  }
  return digest;
}

function cancelContinueCountdown() {
  if (state.continueTimerId !== 0) {
    window.clearInterval(state.continueTimerId);
    state.continueTimerId = 0;
  }
  state.continueRemaining = 0;
  countdownNode.textContent = "";
}

function startContinueCountdown() {
  cancelContinueCountdown();
  state.continueRemaining = CONTINUE_DELAY_SECONDS;
  countdownNode.textContent = `${state.continueRemaining}초 후 어비스 기록으로 이동 · 재점화하면 남는다`;
  state.continueTimerId = window.setInterval(() => {
    state.continueRemaining -= 1;
    if (state.continueRemaining <= 0) {
      cancelContinueCountdown();
      window.location.assign(CONTINUE_URL);
      return;
    }
    countdownNode.textContent = `${state.continueRemaining}초 후 어비스 기록으로 이동 · 재점화하면 남는다`;
  }, 1000);
}

function endRun(reason, outcome = "defeat") {
  setMode("gameover");
  clearInput();
  const digest = writeRunDigest(reason, outcome);
  const victory = outcome === "victory";
  gameOverPanel.dataset.outcome = outcome;
  gameOverEyebrow.textContent = victory ? "랜턴이 끝까지 타올랐다" : "랜턴이 꺼져간다";
  gameOverTitle.textContent = victory ? "잿불 법정을 사수했다" : "법정이 함락되었다";
  finalScoreNode.textContent = victory
    ? `점수 ${state.score.toLocaleString()} · 웨이브 ${TARGET_WAVE} 완주`
    : `점수 ${state.score.toLocaleString()} · 웨이브 ${state.wave}`;
  runSummaryNode.textContent = `유물 ${state.relics} · 처치 ${state.kills}`;
  gameOverPanel.hidden = false;
  playCue(victory ? "wave" : "gameover");
  startContinueCountdown();
  restartButton.focus({ preventScroll: true });
  return digest;
}


function loreForWave(waveNumber) {
  return LORE_BEATS[(waveNumber - 1) % LORE_BEATS.length];
}

function startWave(waveNumber) {
  state.wave = waveNumber;
  state.waveSeed = (waveNumber * 3) % SPAWN_POINTS.length;
  state.pendingSpawns = Math.min(ENEMY_CAP, 3 + Math.floor(waveNumber * 1.2));
  state.spawnTimer = 0.18;
  state.intermission = 0;
  state.hudDirty = true;
  loreNode.textContent = loreForWave(waveNumber);
  setMode("running");
  if (waveNumber > 1) {
    playCue("wave");
  }
  announce(`웨이브 ${waveNumber}. 잿불 군단 반응 ${state.pendingSpawns}기가 법정에 진입한다.`);
}

function restartGame() {
  gameStarted = true;
  cancelContinueCountdown();
  state.enemies.length = 0;
  state.pickups.length = 0;
  state.livingEnemies = 0;
  state.score = 0;
  state.kills = 0;
  state.relics = 0;
  state.charge = LANTERN_MAX_CHARGE;
  state.novaCooldown = 0;
  state.wardCooldown = 0;
  state.novaFlash = 0;
  vfx.hitStopTicks = 0;
  vfx.shakeTime = 0;
  vfx.shakeAmp = 0;
  vfx.shakeDur = 0;
  vfx.particles.length = 0;
  vfx.damageNumbers.length = 0;
  state.encircled = false;
  state.spawnCue = null;
  state.nextEnemyId = 1;
  state.nextPickupId = 1;
  state.accumulator = 0;
  player.x = ARENA_X;
  player.y = ARENA_Y + 42;
  player.facing = 1;
  player.health = PLAYER_MAX_HEALTH;
  player.attackCooldown = 0;
  player.damageCooldown = 0;
  player.attackId = 0;
  player.hitFlash = 0;
  player.wardTime = 0;
  player.moving = false;
  setClip(player, "idle", true);
  clearInput();
  gameOverPanel.hidden = true;
  gameOverPanel.removeAttribute("data-outcome");
  startWave(1);
  updateHud();
  startLoop();
}

let resumeMode = "running";

function readSkipBriefing() {
  try {
    return window.localStorage.getItem(BRIEFING_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

function persistSkipBriefing(skip) {
  try {
    window.localStorage.setItem(BRIEFING_SKIP_KEY, skip ? "1" : "0");
  } catch {
    // A blocked storage quota must never stop the briefing from closing.
  }
}

// A reload (F5 / Cmd-R / Cmd-Shift-R) always re-shows the briefing, even when the
// "다시 보지 않기" skip flag is set: a refresh is an explicit "show me again" intent.
// The platform cannot tell a hard refresh from a soft one -- both report navigation
// type "reload" -- so every reload qualifies, while a fresh visit (typed URL, link,
// bfcache restore) still honours the saved skip.
function isReloadNavigation() {
  try {
    const entry = performance.getEntriesByType?.("navigation")?.[0];
    if (entry && typeof entry.type === "string") {
      return entry.type === "reload";
    }
    return performance.navigation?.type === 1;
  } catch {
    return false;
  }
}

function showBriefing() {
  setMode("briefing");
  briefingPanel.hidden = false;
  briefingSkip.checked = readSkipBriefing();
  briefingStart.focus({ preventScroll: true });
}

function dismissBriefing() {
  persistSkipBriefing(briefingSkip.checked);
  briefingPanel.hidden = true;
  if (!gameStarted) {
    restartGame();
  } else {
    setMode(resumeMode === "wave-clear" ? "wave-clear" : "running");
    startLoop();
  }
}


function spawnEnemy() {
  const pointIndex = (state.waveSeed + state.nextEnemyId * 3) % SPAWN_POINTS.length;
  const spawnPoint = SPAWN_POINTS[pointIndex];
  const waveHealth = ENEMY_BASE_HEALTH + Math.min(92, (state.wave - 1) * 9);
  const enemy = {
    kind: "enemy",
    id: state.nextEnemyId,
    asset: assets.cohort,
    x: spawnPoint[0],
    y: spawnPoint[1],
    facing: spawnPoint[0] < ARENA_X ? 1 : -1,
    scale: 0.72,
    health: waveHealth,
    maxHealth: waveHealth,
    clipName: "idle",
    clipTime: 0,
    clipFrame: 0,
    attackCooldown: (state.nextEnemyId % 3) * 0.18,
    didDamage: false,
    lastHitAttack: -1,
    dead: false,
    fadeTime: 0,
    hitFlash: 0,
  };

  state.nextEnemyId += 1;
  state.enemies.push(enemy);
  state.livingEnemies += 1;
  state.hudDirty = true;
}

function damageEnemy(enemy, amount) {
  if (enemy.dead) {
    return;
  }
  enemy.health = Math.max(0, enemy.health - amount);
  enemy.hitFlash = state.reducedMotion ? 0.04 : 0.13;
  state.hudDirty = true;
  playCue("hit");
  const hitDepth = depthScaleForY(enemy.y);
  const hitX = enemy.x;
  const hitY = enemy.y - 70 * hitDepth;
  const heavy = amount >= 90;
  spawnSparks(hitX, hitY, heavy ? 12 : 8, 1, 120);
  spawnDamageNumber(hitX, hitY - 30 * hitDepth, amount, heavy);
  triggerHitStop(heavy ? HITSTOP_HEAVY_TICKS : HITSTOP_LIGHT_TICKS);
  triggerShake(heavy ? SHAKE_HEAVY : SHAKE_LIGHT);
  applyKnockback(enemy, heavy ? KNOCK_HEAVY : KNOCK_LIGHT);

  if (enemy.health === 0) {
    enemy.dead = true;
    enemy.fadeTime = state.reducedMotion ? 0.08 : 0.34;
    setClip(enemy, "idle", true);
    state.livingEnemies -= 1;
    state.score += 100 * state.wave;
    state.kills += 1;
    state.charge = Math.min(LANTERN_MAX_CHARGE, state.charge + LANTERN_CHARGE_PER_KILL);
    spawnPickup(enemy);
    state.hudDirty = true;
    playCue("kill");
    spawnSparks(hitX, hitY, 16, 1.4, 170);
    triggerShake(SHAKE_HEAVY);
    triggerHitStop(HITSTOP_HEAVY_TICKS);
  }
}

function damagePlayer(amount) {
  if (state.mode === "gameover" || state.mode === "error" || player.damageCooldown > 0) {
    return;
  }

  if (player.wardTime > 0) {
    // Lantern Ward refuses the hit outright, but still consumes the contact so
    // a warded player is not chain-hit by the same swing.
    player.damageCooldown = PLAYER_HIT_GRACE;
    return;
  }

  player.damageCooldown = PLAYER_HIT_GRACE;
  player.health = Math.max(0, player.health - amount);
  player.hitFlash = state.reducedMotion ? 0.04 : 0.16;
  state.hudDirty = true;
  triggerShake(SHAKE_LIGHT);
  spawnSparks(player.x, player.y - 74 * depthScaleForY(player.y), 6, 0.8, 90);

  if (player.health === 0) {
    endRun("overrun", "defeat");
    announce(`웨이브 ${state.wave}에서 잿불 법정이 함락됐다. 최종 점수 ${state.score}. R을 누르거나 재점화를 선택하라.`);
  } else if (player.health <= 30) {
    announce(`랜턴 내구도 위험: ${player.health}. 멈추지 마라.`);
  }
}


function updatePlayer(deltaTime) {
  player.attackCooldown = Math.max(0, player.attackCooldown - deltaTime);
  player.damageCooldown = Math.max(0, player.damageCooldown - deltaTime);
  player.hitFlash = Math.max(0, player.hitFlash - deltaTime);

  let movementX = (keyboard.right || controlHeld.right > 0 ? 1 : 0)
    - (keyboard.left || controlHeld.left > 0 ? 1 : 0);
  let movementY = (keyboard.down || controlHeld.down > 0 ? 1 : 0)
    - (keyboard.up || controlHeld.up > 0 ? 1 : 0);
  const movementLength = Math.hypot(movementX, movementY);

  if (movementLength > 0) {
    movementX /= movementLength;
    movementY /= movementLength;
    const attackMovementScale = player.clipName === "attack" ? 0.42 : 1;
    player.x += movementX * PLAYER_SPEED * attackMovementScale * deltaTime;
    player.y += movementY * PLAYER_SPEED * 0.68 * attackMovementScale * deltaTime;
    player.moving = true;
    if (movementX !== 0) {
      player.facing = movementX > 0 ? 1 : -1;
    }
    clampToArena(player, 34);
  } else {
    player.moving = false;
  }
  if (semanticNudge.x !== 0 || semanticNudge.y !== 0) {
    player.x += semanticNudge.x * 34;
    player.y += semanticNudge.y * 23;
    player.moving = true;
    if (semanticNudge.x !== 0) {
      player.facing = semanticNudge.x > 0 ? 1 : -1;
    }
    semanticNudge.x = 0;
    semanticNudge.y = 0;
    clampToArena(player, 34);
  }


  if (attackQueued && player.attackCooldown <= 0 && player.clipName !== "attack") {
    player.attackId += 1;
    player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
    setClip(player, "attack", true);
    playCue("strike");

  }
  attackQueued = false;

  if (player.clipName !== "attack") {
    setClip(player, player.moving ? "walk" : "idle");
  }
  advanceClip(player, deltaTime);

  if (player.clipName === "attack" && player.clipFrame >= 2 && player.clipFrame <= 3) {
    for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
      const enemy = state.enemies[enemyIndex];
      if (enemy.dead || enemy.lastHitAttack === player.attackId) {
        continue;
      }
      const deltaX = enemy.x - player.x;
      const deltaY = (enemy.y - player.y) * 1.42;
      const inFacingArc = deltaX * player.facing >= -18;
      if (inFacingArc && deltaX * deltaX + deltaY * deltaY <= PLAYER_ATTACK_RANGE * PLAYER_ATTACK_RANGE) {
        enemy.lastHitAttack = player.attackId;
        damageEnemy(enemy, PLAYER_DAMAGE);
      }
    }
  }
}

function updateEnemy(enemy, deltaTime, enemyIndex) {
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaTime);
  enemy.hitFlash = Math.max(0, enemy.hitFlash - deltaTime);

  const deltaX = player.x - enemy.x;
  const deltaY = player.y - enemy.y;
  const combatY = deltaY * 1.42;
  const distance = Math.hypot(deltaX, combatY);

  if (enemy.clipName !== "attack") {
    if (distance <= ENEMY_ATTACK_RANGE && enemy.attackCooldown <= 0) {
      enemy.didDamage = false;
      enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN + Math.min(0.38, state.wave * 0.025);
      setClip(enemy, "attack", true);
    } else {
      let moveX = deltaX;
      let moveY = deltaY;
      const rawDistance = Math.hypot(moveX, moveY);
      if (rawDistance > 0.001) {
        moveX /= rawDistance;
        moveY /= rawDistance;
      }

      for (let otherIndex = 0; otherIndex < state.enemies.length; otherIndex += 1) {
        if (otherIndex === enemyIndex) {
          continue;
        }
        const other = state.enemies[otherIndex];
        if (other.dead) {
          continue;
        }
        const separationX = enemy.x - other.x;
        const separationY = enemy.y - other.y;
        const separationSquared = separationX * separationX + separationY * separationY;
        if (separationSquared > 0.01 && separationSquared < 4900) {
          const separationDistance = Math.sqrt(separationSquared);
          const separationWeight = (70 - separationDistance) / 70;
          moveX += (separationX / separationDistance) * separationWeight * 0.76;
          moveY += (separationY / separationDistance) * separationWeight * 0.76;
        }
      }

      const adjustedLength = Math.hypot(moveX, moveY);
      if (adjustedLength > 0.001) {
        moveX /= adjustedLength;
        moveY /= adjustedLength;
      }

      const enemySpeed = Math.min(128, 78 + state.wave * 3.2 + (enemy.id % 3) * 2.5);
      if (distance > ENEMY_ATTACK_RANGE - 5) {
        enemy.x += moveX * enemySpeed * deltaTime;
        enemy.y += moveY * enemySpeed * 0.68 * deltaTime;
        clampToArena(enemy, 24);
        setClip(enemy, "walk");
      } else {
        setClip(enemy, "idle");
      }
    }
  }

  if (Math.abs(deltaX) > 4) {
    enemy.facing = deltaX > 0 ? 1 : -1;
  }

  advanceClip(enemy, deltaTime);

  if (enemy.clipName === "attack" && enemy.clipFrame >= 2 && !enemy.didDamage) {
    const contactX = player.x - enemy.x;
    const contactY = (player.y - enemy.y) * 1.42;
    if (contactX * contactX + contactY * contactY <= (ENEMY_ATTACK_RANGE + 14) ** 2) {
      enemy.didDamage = true;
      damagePlayer(Math.min(18, 7 + Math.floor(state.wave * 0.8)));
    }
  }
}

function updateEnemies(deltaTime) {
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = state.enemies[enemyIndex];
    if (enemy.dead) {
      enemy.fadeTime -= deltaTime;
      continue;
    }
    updateEnemy(enemy, deltaTime, enemyIndex);
    if (state.mode === "gameover") {
      break;
    }
  }

  for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = state.enemies[enemyIndex];
    if (enemy.dead && enemy.fadeTime <= 0) {
      state.enemies.splice(enemyIndex, 1);
    }
  }
}

function updateWave(deltaTime) {
  if (state.mode === "wave-clear") {
    state.intermission -= deltaTime;
    if (state.intermission <= 0) {
      startWave(state.wave + 1);
    }
    return;
  }

  if (state.pendingSpawns > 0 && state.enemies.length < ENEMY_CAP) {
    state.spawnTimer -= deltaTime;
    if (state.spawnTimer <= SPAWN_CUE_LEAD) {
      const cuePoint = SPAWN_POINTS[(state.waveSeed + state.nextEnemyId * 3) % SPAWN_POINTS.length];
      if (!state.spawnCue || state.spawnCue.x !== cuePoint[0] || state.spawnCue.y !== cuePoint[1]) {
        state.spawnCue = { x: cuePoint[0], y: cuePoint[1], t: 0 };
      } else {
        state.spawnCue.t += deltaTime;
      }
    }
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.pendingSpawns -= 1;
      state.spawnTimer = Math.max(0.28, 0.62 - state.wave * 0.018);
      state.spawnCue = null;
      state.hudDirty = true;
    }
  } else if (state.spawnCue) {
    state.spawnCue = null;
  }

  if (state.pendingSpawns === 0 && state.livingEnemies === 0) {
    if (state.wave >= TARGET_WAVE) {
      endRun("cleared", "victory");
      announce(`웨이브 ${TARGET_WAVE} 완주. 잿불 법정을 사수했다.`);
      return;
    }
    state.intermission = 2.15;
    setMode("wave-clear");
    state.hudDirty = true;
    announce(`웨이브 ${state.wave} 확보. 다음 군단이 모이고 있다.`);
  }
}

function updateEncircle() {
  let near = 0;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (enemy.dead) {
      continue;
    }
    const deltaX = enemy.x - player.x;
    const deltaY = (enemy.y - player.y) * 1.42;
    if (deltaX * deltaX + deltaY * deltaY <= ENCIRCLE_RADIUS * ENCIRCLE_RADIUS) {
      near += 1;
    }
  }
  const encircled = near >= ENCIRCLE_THRESHOLD;
  if (encircled !== state.encircled) {
    state.encircled = encircled;
    if (encircled) {
      announce("포위됐다 — 뚫고 나가라.");
    }
  }
}

function fixedUpdate(deltaTime) {
  if (state.mode !== "running" && state.mode !== "wave-clear") {
    return;
  }
  updatePlayer(deltaTime);
  updateEnemies(deltaTime);
  if (state.mode !== "gameover") {
    updateSkills(deltaTime);
    updatePickups(deltaTime);
    updateWave(deltaTime);
    updateEncircle();
  }

  if (state.hudDirty) {
    updateHud();
  }

}

function depthScaleForY(y) {
  const normalizedDepth = Math.min(1, Math.max(0, (y - (ARENA_Y - ARENA_HALF_HEIGHT)) / (ARENA_HALF_HEIGHT * 2)));
  const quantizedDepth = Math.round(normalizedDepth * 9) / 9;
  return FAR_DEPTH_SCALE + (NEAR_DEPTH_SCALE - FAR_DEPTH_SCALE) * quantizedDepth;
}
function spriteScaleForActor(actor, depthScale) {
  return actor.scale * depthScale;
}

function spriteAnchorForActor(actor, output) {
  output.x = Math.round(actor.x);
  output.y = Math.round(actor.y);
  return output;
}

function writeShadowGeometry(actor, depthScale, anchor, output) {
  output.centerX = anchor.x;
  output.centerY = anchor.y - 2 * depthScale;
  output.radiusX = (actor.kind === "player" ? 42 : 36) * depthScale;
  output.radiusY = (actor.kind === "player" ? 14 : 12) * depthScale;
  return output;
}

function writeHitFlashGeometry(actor, depthScale, anchor, reducedMotion, output) {
  output.visible = actor.hitFlash > 0 && !reducedMotion;
  output.centerX = anchor.x;
  output.centerY = anchor.y - 79 * depthScale;
  output.radiusX = 42 * depthScale;
  output.radiusY = 90 * depthScale;
  output.lineWidth = 4 * depthScale;
  return output;
}

function writeHealthBarGeometry(actor, depthScale, anchor, output) {
  const width = 70 * depthScale;
  const height = 7 * depthScale;
  const inset = depthScale;
  const x = anchor.x - width / 2;
  const y = anchor.y - 176 * depthScale;

  output.visible = !actor.dead && actor.health < actor.maxHealth;
  output.x = x;
  output.y = y;
  output.width = width;
  output.height = height;
  output.inset = inset;
  output.fillX = x + inset;
  output.fillY = y + inset;
  output.fillWidth = (width - inset * 2) * (actor.health / actor.maxHealth);
  output.fillHeight = Math.max(1, height - inset * 2);
  return output;
}

function writeAttackArcGeometry(actor, depthScale, anchor, output) {
  output.visible = actor.clipName === "attack" && actor.clipFrame >= 2 && actor.clipFrame <= 3;
  output.centerX = anchor.x;
  output.centerY = anchor.y - 54 * depthScale;
  output.radius = 118;
  output.lineWidth = 8;
  output.startAngle = actor.facing > 0 ? -0.85 : Math.PI - 0.85;
  output.endAngle = actor.facing > 0 ? 0.62 : Math.PI + 0.62;
  output.anticlockwise = actor.facing < 0;
  return output;
}

function writeGroundRingGeometry(depthScale, anchor, output) {
  output.centerX = anchor.x;
  output.centerY = anchor.y;
  output.radiusX = 50 * depthScale;
  output.radiusY = 17 * depthScale;
  output.lineWidth = 3 * depthScale;
  return output;
}

function writeSpriteDestinationGeometry(clip, spriteScale, rect, output) {
  output.x = Math.round(-clip.pivot.x * spriteScale);
  output.y = Math.round(-clip.pivot.y * spriteScale);
  output.width = Math.max(1, Math.round(rect.w * spriteScale));
  output.height = Math.max(1, Math.round(rect.h * spriteScale));
  return output;
}

function drawShadow(actor, depthScale, anchor) {
  const shadow = writeShadowGeometry(actor, depthScale, anchor, renderScratch.shadow);
  context.save();
  context.globalAlpha = actor.dead ? Math.max(0, actor.fadeTime / 0.34) * 0.22 : 0.34;
  context.fillStyle = "#020407";
  context.beginPath();
  context.ellipse(
    shadow.centerX,
    shadow.centerY,
    shadow.radiusX,
    shadow.radiusY,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

// --- VFX system (presentation-only; never touches simulation/digest) ----------
const HITSTOP_LIGHT_TICKS = 2;
const HITSTOP_HEAVY_TICKS = 5;
const SHAKE_LIGHT = { amp: 3, dur: 0.12 };
const SHAKE_HEAVY = { amp: 6, dur: 0.16 };
const SHAKE_NOVA = { amp: 11, dur: 0.26 };
const SHAKE_FREQ = 46;
const MAX_PARTICLES = 96;
const MAX_DAMAGE_NUMBERS = 24;
const KNOCK_LIGHT = 9;
const KNOCK_HEAVY = 16;
const KNOCK_LAMBDA = 15;
const SPARK_WARM = "#ff8a3c";
const SPARK_HOT = "#fff0c0";

const vfx = {
  hitStopTicks: 0,
  shakeTime: 0,
  shakeDur: 0,
  shakeAmp: 0,
  shakeSeed: 0,
  particles: [],
  damageNumbers: [],
};

const flashCanvas = document.createElement("canvas");
flashCanvas.width = 256;
flashCanvas.height = 256;
const flashCtx = flashCanvas.getContext("2d");
flashCtx.imageSmoothingEnabled = false;

function drawSilhouetteFlash(image, rect, spriteDest, color, alpha) {
  if (flashCanvas.width !== rect.w || flashCanvas.height !== rect.h) {
    flashCanvas.width = rect.w;
    flashCanvas.height = rect.h;
    flashCtx.imageSmoothingEnabled = false;
  }
  flashCtx.globalCompositeOperation = "source-over";
  flashCtx.globalAlpha = 1;
  flashCtx.clearRect(0, 0, rect.w, rect.h);
  flashCtx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  flashCtx.globalCompositeOperation = "source-atop";
  flashCtx.fillStyle = color;
  flashCtx.fillRect(0, 0, rect.w, rect.h);
  flashCtx.globalCompositeOperation = "source-over";
  context.globalAlpha = alpha;
  // 5-arg blit: scales the whole offscreen buffer to the sprite destination.
  // Intentionally not the 9-arg form so the render-probe actor-draw count is untouched.
  context.drawImage(flashCanvas, spriteDest.x, spriteDest.y, spriteDest.width, spriteDest.height);
  context.globalAlpha = 1;
}

function triggerHitStop(ticks) {
  if (state.reducedMotion) {
    return;
  }
  vfx.hitStopTicks = Math.max(vfx.hitStopTicks, ticks);
}

function triggerShake(profile) {
  if (state.reducedMotion) {
    return;
  }
  if (profile.amp * (profile.dur) >= vfx.shakeAmp * Math.max(0.0001, vfx.shakeTime)) {
    vfx.shakeAmp = profile.amp;
    vfx.shakeDur = profile.dur;
    vfx.shakeTime = profile.dur;
    vfx.shakeSeed = (vfx.shakeSeed + 1) % 1000;
  }
}

function currentShake() {
  if (vfx.shakeTime <= 0 || vfx.shakeDur <= 0) {
    return { x: 0, y: 0 };
  }
  const decay = vfx.shakeTime / vfx.shakeDur;
  const amp = vfx.shakeAmp * decay * decay;
  const t = (vfx.shakeDur - vfx.shakeTime) * SHAKE_FREQ + vfx.shakeSeed;
  return { x: Math.sin(t) * amp, y: Math.cos(t * 1.37) * amp };
}

function pushParticle(p) {
  if (vfx.particles.length >= MAX_PARTICLES) {
    vfx.particles.shift();
  }
  vfx.particles.push(p);
}

function spawnSparks(x, y, count, spread, speed) {
  if (state.reducedMotion) {
    return;
  }
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.4 + Math.random() * 0.6);
    pushParticle({
      x,
      y,
      vx: Math.cos(angle) * velocity * spread,
      vy: Math.sin(angle) * velocity * 0.7 - 30,
      gravity: 210,
      life: 0.28 + Math.random() * 0.24,
      maxLife: 0.52,
      size: 2 + Math.floor(Math.random() * 3),
      color: Math.random() < 0.4 ? SPARK_HOT : SPARK_WARM,
    });
  }
}

function spawnDamageNumber(x, y, amount, heavy) {
  if (vfx.damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
    vfx.damageNumbers.shift();
  }
  vfx.damageNumbers.push({
    x: x + (state.reducedMotion ? 0 : (Math.random() - 0.5) * 18),
    y,
    vy: state.reducedMotion ? 0 : -70,
    life: 0.7,
    maxLife: 0.7,
    text: String(amount),
    heavy,
  });
}

function applyKnockback(enemy, dist) {
  if (state.reducedMotion) {
    return;
  }
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  enemy.knockX = (dx / len) * dist;
  enemy.knockY = (dy / len) * dist * 0.6;
}

function updatePresentation(dt) {
  if (dt <= 0) {
    return;
  }
  if (vfx.shakeTime > 0) {
    vfx.shakeTime = Math.max(0, vfx.shakeTime - dt);
  }
  for (let i = vfx.particles.length - 1; i >= 0; i -= 1) {
    const p = vfx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      vfx.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = vfx.damageNumbers.length - 1; i >= 0; i -= 1) {
    const d = vfx.damageNumbers[i];
    d.life -= dt;
    if (d.life <= 0) {
      vfx.damageNumbers.splice(i, 1);
      continue;
    }
    d.y += d.vy * dt;
  }
  const lerp = Math.min(1, dt * KNOCK_LAMBDA);
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    if (e.knockX) e.knockX += (0 - e.knockX) * lerp;
    if (e.knockY) e.knockY += (0 - e.knockY) * lerp;
  }
}

function drawParticles() {
  if (vfx.particles.length === 0) {
    return;
  }
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let i = 0; i < vfx.particles.length; i += 1) {
    const p = vfx.particles[i];
    context.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    context.fillStyle = p.color;
    const s = p.size;
    context.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
  }
  context.restore();
}

function drawDamageNumbers() {
  if (vfx.damageNumbers.length === 0) {
    return;
  }
  context.save();
  context.textAlign = "center";
  for (let i = 0; i < vfx.damageNumbers.length; i += 1) {
    const d = vfx.damageNumbers[i];
    const fade = Math.max(0, Math.min(1, d.life / d.maxLife));
    context.globalAlpha = fade;
    context.font = d.heavy ? "900 40px ui-monospace, monospace" : "800 30px ui-monospace, monospace";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(4, 6, 10, 0.9)";
    context.strokeText(d.text, d.x, d.y);
    context.fillStyle = d.heavy ? "#ffd27a" : "#ffe9a8";
    context.fillText(d.text, d.x, d.y);
  }
  context.restore();
}


function drawActor(actor) {
  const clip = actor.asset.manifest.animations[actor.clipName];
  const rect = clip.rects[actor.clipFrame];
  const depthScale = depthScaleForY(actor.y);
  const spriteScale = spriteScaleForActor(actor, depthScale);
  const anchor = spriteAnchorForActor(actor, renderScratch.anchor);
  const spriteDest = writeSpriteDestinationGeometry(clip, spriteScale, rect, renderScratch.spriteDest);
  const fadeAlpha = actor.dead ? Math.max(0, actor.fadeTime / (state.reducedMotion ? 0.08 : 0.34)) : 1;

  drawShadow(actor, depthScale, anchor);
  const knockX = actor.knockX || 0;
  const knockY = actor.knockY || 0;
  context.save();
  context.globalAlpha = fadeAlpha;
  context.translate(anchor.x + knockX, anchor.y + knockY);
  context.scale(actor.facing, 1);
  context.drawImage(
    actor.asset.image,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    spriteDest.x,
    spriteDest.y,
    spriteDest.width,
    spriteDest.height,
  );
  if (actor.hitFlash > 0 && !state.reducedMotion) {
    drawSilhouetteFlash(
      actor.asset.image,
      rect,
      spriteDest,
      actor.kind === "player" ? "#c8ffff" : "#ffffff",
      Math.min(0.9, actor.hitFlash * 6.5),
    );
  }
  context.restore();

  if (actor.kind === "enemy") {
    const healthBar = writeHealthBarGeometry(actor, depthScale, anchor, renderScratch.healthBar);
    if (healthBar.visible) {
      context.fillStyle = "rgba(2, 4, 7, 0.82)";
      context.fillRect(healthBar.x, healthBar.y, healthBar.width, healthBar.height);
      context.fillStyle = "#ef6d3e";
      context.fillRect(
        healthBar.fillX,
        healthBar.fillY,
        healthBar.fillWidth,
        healthBar.fillHeight,
      );
    }
  }
}

function drawCombatFeedback() {
  const depthScale = depthScaleForY(player.y);
  const anchor = spriteAnchorForActor(player, renderScratch.anchor);
  const attackArc = writeAttackArcGeometry(
    player,
    depthScale,
    anchor,
    renderScratch.attackArc,
  );
  if (!attackArc.visible) {
    return;
  }

  if (!state.reducedMotion) {
    context.save();
    context.globalCompositeOperation = "lighter";
    const dir = player.facing;
    for (let layer = 0; layer < 5; layer += 1) {
      const t = layer / 4;
      context.globalAlpha = 0.10 + 0.5 * (1 - t);
      context.strokeStyle = layer < 2 ? "#fff2c8" : "#ff9a3c";
      context.lineWidth = 3 + 15 * (1 - t);
      context.beginPath();
      const spread = 0.22 * t;
      const start = dir > 0 ? attackArc.startAngle - 0.2 + spread : attackArc.startAngle + 0.2 - spread;
      const end = dir > 0 ? attackArc.endAngle - spread : attackArc.endAngle + spread;
      context.arc(attackArc.centerX, attackArc.centerY, attackArc.radius - layer * 6, start, end, attackArc.anticlockwise);
      context.stroke();
    }
    context.restore();
  }

  context.save();
  context.globalAlpha = state.reducedMotion ? 0.28 : 0.5;
  context.strokeStyle = "#ffb064";
  context.lineWidth = attackArc.lineWidth;
  context.beginPath();
  context.arc(
    attackArc.centerX,
    attackArc.centerY,
    attackArc.radius,
    attackArc.startAngle,
    attackArc.endAngle,
    attackArc.anticlockwise,
  );
  context.stroke();
  context.restore();
}

function drawWaveMarker() {
  if (state.mode !== "wave-clear") {
    return;
  }
  context.save();
  context.fillStyle = "rgba(4, 8, 12, 0.74)";
  context.fillRect(568, 455, 400, 108);
  context.strokeStyle = "rgba(88, 227, 242, 0.5)";
  context.strokeRect(568.5, 455.5, 399, 107);
  context.textAlign = "center";
  context.fillStyle = "#78e9f1";
  context.font = "700 20px ui-monospace, monospace";
  context.fillText(`웨이브 ${state.wave} 확보`, 768, 496);
  context.fillStyle = "#c7d2d5";
  context.font = "24px Georgia, serif";
  context.fillText("랜턴의 전선을 지켜라", 768, 535);
  context.restore();
}


function drawPickups() {
  for (let index = 0; index < state.pickups.length; index += 1) {
    const pickup = state.pickups[index];
    const depthScale = depthScaleForY(pickup.y);
    const bob = state.reducedMotion ? 0 : Math.sin(pickup.bob * 4) * 4;
    const centerX = Math.round(pickup.x);
    const centerY = Math.round(pickup.y - 26 * depthScale + bob);
    const expiring = pickup.life <= 3;

    context.save();
    context.globalAlpha = expiring && !state.reducedMotion
      ? 0.35 + Math.abs(Math.sin(pickup.life * 6)) * 0.65
      : 0.92;

    const sprite = assets.relicItem;
    if (sprite && sprite.naturalWidth > 0) {
      // Draw the prop sprite-sheet crystal, tinted per item kind so the three drops still
      // read apart. Height ~40px at depthScale 1; aspect preserved from the source image.
      const drawHeight = 40 * depthScale;
      const drawWidth = drawHeight * (sprite.naturalWidth / sprite.naturalHeight);
      context.drawImage(sprite, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
      // A soft kind-colour wash so ember-shard / oil-flask / relic-mote differ at a glance.
      context.globalCompositeOperation = "source-atop";
      context.globalAlpha *= 0.35;
      context.fillStyle = ITEM_KINDS[pickup.kind].color;
      context.fillRect(centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
      context.restore();
      continue;
    }

    // Fallback: the original procedural diamond (used only if the sprite failed to load).
    const radius = 11 * depthScale;
    context.fillStyle = ITEM_KINDS[pickup.kind].color;
    context.beginPath();
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + radius * 0.72, centerY);
    context.lineTo(centerX, centerY + radius);
    context.lineTo(centerX - radius * 0.72, centerY);
    context.closePath();
    context.fill();
    context.globalAlpha = 0.28;
    context.strokeStyle = "#04070b";
    context.lineWidth = 2 * depthScale;
    context.stroke();
    context.restore();
  }
}

function drawWardAura() {
  if (player.wardTime <= 0) {
    return;
  }
  const depthScale = depthScaleForY(player.y);
  const anchor = spriteAnchorForActor(player, renderScratch.anchor);
  const cy = anchor.y - 74 * depthScale;
  const rx = 62 * depthScale;
  const ry = 96 * depthScale;
  const pulse = state.reducedMotion ? 1 : 1 + Math.sin(player.wardTime * 12) * 0.06;
  context.save();
  context.globalAlpha = Math.min(0.28, 0.1 + (player.wardTime / WARD_DURATION) * 0.22);
  context.fillStyle = "#173f45";
  context.beginPath();
  context.ellipse(anchor.x, cy, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = Math.min(0.7, 0.3 + (player.wardTime / WARD_DURATION) * 0.4);
  context.strokeStyle = "#9af4ef";
  context.lineWidth = 3 * depthScale;
  context.beginPath();
  context.ellipse(anchor.x, cy, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
  context.stroke();
  if (!state.reducedMotion) {
    const spin = player.wardTime * 2.4;
    context.strokeStyle = "#d8fffb";
    context.lineWidth = 2 * depthScale;
    context.globalAlpha = 0.5;
    for (let i = 0; i < 8; i += 1) {
      const a = spin + (i / 8) * Math.PI * 2;
      const ox = Math.cos(a) * rx * pulse;
      const oy = Math.sin(a) * ry * pulse;
      context.beginPath();
      context.moveTo(anchor.x + ox * 0.86, cy + oy * 0.86);
      context.lineTo(anchor.x + ox, cy + oy);
      context.stroke();
    }
  }
  context.restore();
}

function drawNovaBurst() {
  if (state.novaFlash <= 0) {
    return;
  }
  const span = state.reducedMotion ? 0.08 : 0.42;
  const progress = 1 - state.novaFlash / span;
  const anchor = spriteAnchorForActor(player, renderScratch.anchor);
  const cx = anchor.x;
  const cy = anchor.y - 40;
  const scale = 0.35 + progress * 0.65;
  const rx = NOVA_RADIUS * scale;
  const ry = NOVA_RADIUS * 0.7 * scale;
  context.save();
  if (!state.reducedMotion) {
    context.globalCompositeOperation = "lighter";
    const fade = Math.max(0, 1 - progress);
    const grad = context.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, rx));
    grad.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`);
    grad.addColorStop(0.25, `rgba(255,210,130,${0.5 * fade})`);
    grad.addColorStop(0.7, `rgba(255,130,50,${0.2 * fade})`);
    grad.addColorStop(1, "rgba(255,90,40,0)");
    context.fillStyle = grad;
    context.beginPath();
    context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    const embers = 24;
    for (let i = 0; i < embers; i += 1) {
      const a = (i / embers) * Math.PI * 2;
      const dist = scale * (0.55 + (i % 5) * 0.09);
      const px = cx + Math.cos(a) * NOVA_RADIUS * dist;
      const py = cy + Math.sin(a) * NOVA_RADIUS * 0.7 * dist;
      context.globalAlpha = Math.max(0, (0.8 - (i % 5) * 0.12) * fade);
      context.fillStyle = i % 3 === 0 ? "#fff0c0" : "#ff8a3c";
      const r = 2 + (i % 3);
      context.fillRect(Math.round(px - r), Math.round(py - r), r * 2, r * 2);
    }
    context.globalCompositeOperation = "source-over";
  }
  const rings = [[0.62, 0.9, 12, "#fff2cc"], [0.82, 0.55, 9, "#ffb161"], [1.0, 0.32, 6, "#ff7a3c"]];
  for (let i = 0; i < rings.length; i += 1) {
    const ring = rings[i];
    context.globalAlpha = Math.max(0, ring[1] * (1 - progress));
    context.strokeStyle = ring[3];
    context.lineWidth = ring[2];
    context.beginPath();
    context.ellipse(cx, cy, rx * ring[0], ry * ring[0], 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function compareActorDepth(actorA, actorB) {
  return actorA.y - actorB.y || (actorA.kind === "player" ? 1 : -1);
}
function readActorRenderSnapshot(actor, drawOrder) {
  const depthScale = depthScaleForY(actor.y);
  const spriteScale = spriteScaleForActor(actor, depthScale);
  const spriteAnchor = Object.freeze({ ...spriteAnchorForActor(actor, {}) });
  const clip = actor.asset.manifest.animations[actor.clipName];
  const rect = clip.rects[actor.clipFrame];
  const spriteDest = Object.freeze({
    ...writeSpriteDestinationGeometry(clip, spriteScale, rect, {}),
  });
  const shadow = Object.freeze({
    ...writeShadowGeometry(actor, depthScale, spriteAnchor, {}),
  });
  const hitFlash = Object.freeze({
    ...writeHitFlashGeometry(
      actor,
      depthScale,
      spriteAnchor,
      state.reducedMotion,
      {},
    ),
  });
  const healthBar = actor.kind === "enemy"
    ? Object.freeze({
      ...writeHealthBarGeometry(actor, depthScale, spriteAnchor, {}),
    })
    : null;
  const attackArc = actor.kind === "player"
    ? Object.freeze({
      ...writeAttackArcGeometry(actor, depthScale, spriteAnchor, {}),
    })
    : null;
  const groundRing = actor.kind === "player"
    ? Object.freeze({
      ...writeGroundRingGeometry(depthScale, spriteAnchor, {}),
    })
    : null;

  return Object.freeze({
    kind: actor.kind,
    id: actor.kind === "player" ? "player" : actor.id,
    y: actor.y,
    drawOrder,
    depthScale,
    spriteScale,
    spriteAnchor,
    spriteDest,
    shadow,
    hitFlash,
    healthBar,
    attackArc,
    groundRing,
  });
}

function readRenderSnapshot() {
  const actors = [player, ...state.enemies].sort(compareActorDepth);
  return Object.freeze({
    renderer: "canvas2d",
    backingScale: canvasBackingScale,
    actors: Object.freeze(actors.map(readActorRenderSnapshot)),
  });
}

Object.defineProperty(window, "__SPRITE_2_5D_TEST__", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({
    depthScaleAtY: depthScaleForY,
    readRenderSnapshot,
  }),
});


function drawArenaBoundary() {
  const tracePath = () => {
    context.beginPath();
    context.moveTo(ARENA_RING[0][0], ARENA_RING[0][1]);
    for (let index = 1; index < ARENA_RING.length; index += 1) {
      context.lineTo(ARENA_RING[index][0], ARENA_RING[index][1]);
    }
    context.closePath();
  };
  context.save();
  // Soft glow underlay so the wall reads against the busy diorama backdrop.
  context.strokeStyle = "rgba(88, 227, 242, 0.28)";
  context.lineWidth = 7;
  context.shadowColor = "rgba(88, 227, 242, 0.55)";
  context.shadowBlur = state.reducedMotion ? 0 : 14;
  tracePath();
  context.stroke();
  // Crisp dashed edge on top marks the exact limit the movement clamp enforces.
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(178, 245, 249, 0.85)";
  context.lineWidth = 2;
  context.setLineDash([16, 12]);
  tracePath();
  context.stroke();
  context.restore();
}

function drawSpawnCue() {
  const cue = state.spawnCue;
  if (!cue) {
    return;
  }
  const pulse = state.reducedMotion ? 0.62 : 0.35 + Math.abs(Math.sin(cue.t * 8)) * 0.55;
  const dirX = ARENA_X - cue.x;
  const dirY = ARENA_Y - cue.y;
  const length = Math.hypot(dirX, dirY) || 1;
  const angle = Math.atan2(dirY / length, dirX / length);
  context.save();
  context.translate(cue.x, cue.y);
  context.rotate(angle);
  context.globalAlpha = pulse;
  context.fillStyle = "#ff7a52";
  context.beginPath();
  context.moveTo(24, 0);
  context.lineTo(-10, -14);
  context.lineTo(-10, 14);
  context.closePath();
  context.fill();
  context.restore();
}

function drawEncircleVignette() {
  if (!state.encircled || state.mode !== "running") {
    return;
  }
  const gradient = context.createRadialGradient(
    ARENA_X, ARENA_Y, ARENA_HALF_WIDTH * 0.55,
    ARENA_X, ARENA_Y, ARENA_HALF_WIDTH * 1.15,
  );
  gradient.addColorStop(0, "rgba(182, 32, 24, 0)");
  gradient.addColorStop(1, "rgba(182, 32, 24, 0.42)");
  context.save();
  context.fillStyle = gradient;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.restore();
}

function render() {
  if (!assets.backdrop) {
    context.fillStyle = "#070b11";
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    return;
  }

  context.globalAlpha = 1;
  context.drawImage(assets.backdrop, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.fillStyle = "rgba(2, 7, 12, 0.06)";
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  context.save();
  const shake = currentShake();
  context.translate(shake.x, shake.y);

  const playerDepthScale = depthScaleForY(player.y);
  const playerAnchor = spriteAnchorForActor(player, renderScratch.anchor);
  const groundRing = writeGroundRingGeometry(
    playerDepthScale,
    playerAnchor,
    renderScratch.groundRing,
  );
  context.save();
  context.strokeStyle = "rgba(90, 230, 240, 0.2)";
  context.lineWidth = groundRing.lineWidth;
  context.beginPath();
  context.ellipse(
    groundRing.centerX,
    groundRing.centerY,
    groundRing.radiusX,
    groundRing.radiusY,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();

  drawArenaBoundary();
  drawSpawnCue();
  drawPickups();


  renderActors.length = 0;
  renderActors.push(player);
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    renderActors.push(state.enemies[enemyIndex]);
  }
  renderActors.sort(compareActorDepth);

  for (let actorIndex = 0; actorIndex < renderActors.length; actorIndex += 1) {
    drawActor(renderActors[actorIndex]);
  }

  drawCombatFeedback();
  drawWardAura();
  drawNovaBurst();
  drawParticles();
  drawDamageNumbers();
  context.restore();

  drawWaveMarker();
  drawEncircleVignette();

}

function updateHud() {
  const healthRatio = player.health / PLAYER_MAX_HEALTH;
  healthValue.textContent = `${player.health} / ${PLAYER_MAX_HEALTH}`;
  healthFill.style.width = `${healthRatio * 100}%`;
  healthMeter.classList.toggle("is-critical", healthRatio <= 0.3);
  healthMeter.setAttribute("aria-valuenow", String(player.health));
  waveValue.textContent = `${state.wave} / ${TARGET_WAVE}`;
  scoreValue.textContent = state.score.toLocaleString();
  enemiesValue.textContent = String(state.livingEnemies + state.pendingSpawns);
  canvas.dataset.wave = String(state.wave);
  canvas.dataset.score = String(state.score);
  canvas.dataset.playerHealth = String(player.health);
  canvas.dataset.enemies = String(state.livingEnemies + state.pendingSpawns);

  const chargeRounded = Math.round(state.charge);
  const chargeRatio = chargeRounded / LANTERN_MAX_CHARGE;
  chargeValue.textContent = `${chargeRounded} / ${LANTERN_MAX_CHARGE}`;
  chargeFill.style.width = `${chargeRatio * 100}%`;
  chargeMeter.setAttribute("aria-valuenow", String(chargeRounded));
  chargeMeter.classList.toggle("is-low", chargeRatio <= 0.3);
  relicsValue.textContent = String(state.relics);
  canvas.dataset.charge = String(chargeRounded);
  canvas.dataset.relics = String(state.relics);
  canvas.dataset.kills = String(state.kills);

  for (let index = 0; index < skillButtons.length; index += 1) {
    const button = skillButtons[index];
    const skillName = button.dataset.skill;
    const remaining = skillCooldownRemaining(skillName);
    const ready = canUseSkill(skillName);
    const label = remaining > 0 ? `${remaining.toFixed(1)}s` : ready ? "준비됨" : `기름 ${skillCost(skillName)} 필요`;
    const node = skillName === "nova" ? novaCooldownNode : wardCooldownNode;
    if (node && node.textContent !== label) {
      node.textContent = label;
    }
    button.disabled = !ready;
    button.classList.toggle("is-cooling", remaining > 0);
    button.classList.toggle("is-ready", ready);
    button.dataset.ready = ready ? "true" : "false";
  }

  state.hudDirty = false;

}

function queueSemanticNudge(controlName) {
  if (controlName === "up") semanticNudge.y = Math.max(-1, semanticNudge.y - 1);
  if (controlName === "down") semanticNudge.y = Math.min(1, semanticNudge.y + 1);
  if (controlName === "left") semanticNudge.x = Math.max(-1, semanticNudge.x - 1);
  if (controlName === "right") semanticNudge.x = Math.min(1, semanticNudge.x + 1);
}

function frame(timestamp) {
  if (!loopRunning) {
    return;
  }
  animationFrameId = 0;
  if (state.lastTimestamp === 0) {
    state.lastTimestamp = timestamp;
  }
  const elapsed = Math.min(MAX_FRAME_DELTA, Math.max(0, (timestamp - state.lastTimestamp) / 1000));
  state.lastTimestamp = timestamp;
  state.accumulator += elapsed;

  let steps = 0;
  while (state.accumulator >= FIXED_STEP && steps < MAX_CATCH_UP_STEPS) {
    if (vfx.hitStopTicks > 0) {
      vfx.hitStopTicks -= 1;
      state.accumulator -= FIXED_STEP;
      steps += 1;
      continue;
    }
    fixedUpdate(FIXED_STEP);
    state.accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (steps === MAX_CATCH_UP_STEPS && state.accumulator >= FIXED_STEP) {
    state.accumulator = 0;
  }

  updatePresentation(elapsed);
  render();
  if (loopRunning && isActiveMode() && !document.hidden) {
    animationFrameId = requestAnimationFrame(frame);
  } else {
    stopLoop();
  }
}

function controlNameForCode(code) {
  if (code === "KeyW" || code === "ArrowUp") return "up";
  if (code === "KeyS" || code === "ArrowDown") return "down";
  if (code === "KeyA" || code === "ArrowLeft") return "left";
  if (code === "KeyD" || code === "ArrowRight") return "right";
  return "";
}

function handleKeyDown(event) {
  if (state.mode === "briefing") {
    if (event.code === "Space" || event.code === "Enter" || event.code === "Escape") {
      event.preventDefault();
      dismissBriefing();
    }
    return;
  }

  const controlName = controlNameForCode(event.code);
  if (controlName) {
    if (state.mode === "running" || state.mode === "wave-clear") {
      keyboard[controlName] = true;
      event.preventDefault();
    }
    return;
  }

  if (event.code === "Space") {
    if (event.target instanceof Element && event.target.closest("[data-control]")) {
      return;
    }
    if (state.mode === "running" || state.mode === "wave-clear") {
      if (!event.repeat) {
        attackQueued = true;
      }
      event.preventDefault();
    }
    return;
  }

  if (event.code === "KeyQ" || event.code === "KeyE") {
    if (!event.repeat && isActiveMode()) {
      useSkill(event.code === "KeyQ" ? "nova" : "ward");
    }
    event.preventDefault();
    return;
  }

  if (event.code === "KeyR" && !event.repeat && state.mode !== "loading" && state.mode !== "error") {
    event.preventDefault();
    restartGame();
  }
}

function handleKeyUp(event) {
  const controlName = controlNameForCode(event.code);
  if (controlName) {
    keyboard[controlName] = false;
    if (state.mode === "running" || state.mode === "wave-clear") {
      event.preventDefault();
    }
  }
}

function releasePointer(event) {
  const controlName = pointerBindings.get(event.pointerId);
  if (!controlName) {
    return;
  }
  pointerBindings.delete(event.pointerId);
  if (controlName !== "attack") {
    controlHeld[controlName] = Math.max(0, controlHeld[controlName] - 1);
  }
  event.currentTarget.classList.remove("is-active");
}

for (let buttonIndex = 0; buttonIndex < controlButtons.length; buttonIndex += 1) {
  const button = controlButtons[buttonIndex];
  button.disabled = true;
  button.addEventListener("pointerdown", (event) => {
    if (state.mode !== "running" && state.mode !== "wave-clear") {
      return;
    }
    const controlName = button.dataset.control;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointerBindings.set(event.pointerId, controlName);
    button.classList.add("is-active");
    if (controlName === "attack") {
      attackQueued = true;
    } else {
      controlHeld[controlName] += 1;
    }
  });
  button.addEventListener("pointerup", releasePointer);
  button.addEventListener("pointercancel", releasePointer);
  button.addEventListener("lostpointercapture", releasePointer);
  button.addEventListener("click", (event) => {
    if (event.detail !== 0 || !isActiveMode()) {
      return;
    }
    const controlName = button.dataset.control;
    if (controlName === "attack") {
      attackQueued = true;
    } else {
      queueSemanticNudge(controlName);
    }
  });
}

for (let skillIndex = 0; skillIndex < skillButtons.length; skillIndex += 1) {
  const button = skillButtons[skillIndex];
  button.addEventListener("click", (event) => {
    event.preventDefault();
    useSkill(button.dataset.skill);
  });
}

touchControls.addEventListener("touchmove", (event) => {
  if (pointerBindings.size > 0 && event.cancelable) {
    event.preventDefault();
  }
}, { passive: false });

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    stopLoop();
  } else {
    startLoop();
  }
});
restartButton.addEventListener("click", restartGame);
briefingStart.addEventListener("click", dismissBriefing);
helpButton.addEventListener("click", () => {
  if (state.mode === "running" || state.mode === "wave-clear") {
    resumeMode = state.mode;
    stopLoop();
    showBriefing();
  }
});
reducedMotionQuery.addEventListener("change", (event) => {
  state.reducedMotion = event.matches;
});

async function boot() {
  setControlsEnabled(false);
  render();

  try {
    await loadAssets();
    player.asset = assets.warden;
    loadingPanel.hidden = true;
    if (readSkipBriefing() && !isReloadNavigation()) {
      restartGame();
    } else {
      showBriefing();
    }
  } catch (error) {
    setMode("error");
    loadingPanel.classList.add("is-error");
    loadingPanel.querySelector("strong").textContent = "법정을 열 수 없었다";
    loadingPanel.querySelector("span:last-child").textContent = error instanceof Error
      ? error.message
      : "알 수 없는 자산 로딩 오류가 발생했다.";
    announce("게임 자산 검증에 실패했다. 스프라이트 번들 파일을 확인한 뒤 새로고침하라.");
    console.error("[sprite-2-5d] Asset initialization failed:", error);
    stopLoop();
    render();
  }
}

boot();

window.addEventListener("pagehide", () => {
  clearInput();
  stopLoop();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted && isActiveMode()) {
    state.lastTimestamp = 0;
    state.accumulator = 0;
    startLoop();
  }
});
