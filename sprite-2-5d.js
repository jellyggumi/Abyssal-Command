const WORLD_WIDTH = 1536;
const WORLD_HEIGHT = 1024;
const FIXED_STEP = 1 / 60;
const MAX_FRAME_DELTA = 0.25;
const MAX_CATCH_UP_STEPS = 5;
const ARENA_X = 768;
const ARENA_Y = 604;
const ARENA_HALF_WIDTH = 520;
const ARENA_HALF_HEIGHT = 270;
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

const ASSET_URLS = {
  backdrop: new URL("./assets/images/sprite-2-5d/cinder-court-backdrop.png", import.meta.url),
  wardenManifest: new URL("./assets/images/sprite-2-5d/warden/manifest.json", import.meta.url),
  wardenSheet: new URL("./assets/images/sprite-2-5d/warden/sprite-sheet.png", import.meta.url),
  cohortManifest: new URL("./assets/images/sprite-2-5d/ember-cohort/manifest.json", import.meta.url),
  cohortSheet: new URL("./assets/images/sprite-2-5d/ember-cohort/sprite-sheet.png", import.meta.url),
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
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

if (!context) {
  throw new Error("A 2D canvas context is required for the Cinder Court route.");
}

canvas.width = WORLD_WIDTH;
canvas.height = WORLD_HEIGHT;
context.imageSmoothingEnabled = false;

const assets = {
  backdrop: null,
  warden: null,
  cohort: null,
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

function startWave(waveNumber) {
  state.wave = waveNumber;
  state.waveSeed = (waveNumber * 3) % SPAWN_POINTS.length;
  state.pendingSpawns = Math.min(ENEMY_CAP, 3 + Math.floor(waveNumber * 1.2));
  state.spawnTimer = 0.18;
  state.intermission = 0;
  state.hudDirty = true;
  setMode("running");
  announce(`Wave ${waveNumber}. ${state.pendingSpawns} Ember Cohort signatures entering the court.`);
}

function restartGame() {
  state.enemies.length = 0;
  state.livingEnemies = 0;
  state.score = 0;
  state.nextEnemyId = 1;
  state.accumulator = 0;
  player.x = ARENA_X;
  player.y = ARENA_Y + 42;
  player.facing = 1;
  player.health = PLAYER_MAX_HEALTH;
  player.attackCooldown = 0;
  player.damageCooldown = 0;
  player.attackId = 0;
  player.hitFlash = 0;
  player.moving = false;
  setClip(player, "idle", true);
  clearInput();
  gameOverPanel.hidden = true;
  startWave(1);
  updateHud();
  startLoop();
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

  if (enemy.health === 0) {
    enemy.dead = true;
    enemy.fadeTime = state.reducedMotion ? 0.08 : 0.34;
    setClip(enemy, "idle", true);
    state.livingEnemies -= 1;
    state.score += 100 * state.wave;
    state.hudDirty = true;
  }
}

function damagePlayer(amount) {
  if (state.mode === "gameover" || state.mode === "error" || player.damageCooldown > 0) {
    return;
  }

  player.damageCooldown = PLAYER_HIT_GRACE;
  player.health = Math.max(0, player.health - amount);
  player.hitFlash = state.reducedMotion ? 0.04 : 0.16;
  state.hudDirty = true;

  if (player.health === 0) {
    setMode("gameover");
    clearInput();
    finalScoreNode.textContent = `Score ${state.score.toLocaleString()} · Wave ${state.wave}`;
    gameOverPanel.hidden = false;
    announce(`The Cinder Court fell on wave ${state.wave}. Final score ${state.score}. Press R or choose Rekindle.`);
    restartButton.focus({ preventScroll: true });
  } else if (player.health <= 30) {
    announce(`Lantern integrity critical: ${player.health}. Keep moving.`);
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
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.pendingSpawns -= 1;
      state.spawnTimer = Math.max(0.28, 0.62 - state.wave * 0.018);
      state.hudDirty = true;
    }
  }

  if (state.pendingSpawns === 0 && state.livingEnemies === 0) {
    state.intermission = 2.15;
    setMode("wave-clear");
    state.hudDirty = true;
    announce(`Wave ${state.wave} secured. The next cohort is gathering.`);
  }
}

function fixedUpdate(deltaTime) {
  if (state.mode !== "running" && state.mode !== "wave-clear") {
    return;
  }

  updatePlayer(deltaTime);
  updateEnemies(deltaTime);
  if (state.mode !== "gameover") {
    updateWave(deltaTime);
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

function drawActor(actor) {
  const clip = actor.asset.manifest.animations[actor.clipName];
  const rect = clip.rects[actor.clipFrame];
  const depthScale = depthScaleForY(actor.y);
  const spriteScale = spriteScaleForActor(actor, depthScale);
  const anchor = spriteAnchorForActor(actor, renderScratch.anchor);
  const fadeAlpha = actor.dead ? Math.max(0, actor.fadeTime / (state.reducedMotion ? 0.08 : 0.34)) : 1;

  drawShadow(actor, depthScale, anchor);
  context.save();
  context.globalAlpha = fadeAlpha;
  context.translate(anchor.x, anchor.y);
  context.scale(actor.facing * spriteScale, spriteScale);
  context.drawImage(
    actor.asset.image,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    -clip.pivot.x,
    -clip.pivot.y,
    rect.w,
    rect.h,
  );
  context.restore();

  const hitFlash = writeHitFlashGeometry(
    actor,
    depthScale,
    anchor,
    state.reducedMotion,
    renderScratch.hitFlash,
  );
  if (hitFlash.visible) {
    context.save();
    context.globalAlpha = Math.min(0.8, actor.hitFlash * 6);
    context.strokeStyle = actor.kind === "player" ? "#7ff6ff" : "#ff8a4c";
    context.lineWidth = hitFlash.lineWidth;
    context.beginPath();
    context.ellipse(
      hitFlash.centerX,
      hitFlash.centerY,
      hitFlash.radiusX,
      hitFlash.radiusY,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  }

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
  context.fillText(`WAVE ${state.wave} SECURED`, 768, 496);
  context.fillStyle = "#c7d2d5";
  context.font = "24px Georgia, serif";
  context.fillText("Hold the lantern line", 768, 535);
  context.restore();
}

function compareActorDepth(actorA, actorB) {
  return actorA.y - actorB.y || (actorA.kind === "player" ? 1 : -1);
}
function readActorRenderSnapshot(actor, drawOrder) {
  const depthScale = depthScaleForY(actor.y);
  const spriteAnchor = Object.freeze({ ...spriteAnchorForActor(actor, {}) });
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
    spriteScale: spriteScaleForActor(actor, depthScale),
    spriteAnchor,
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
  drawWaveMarker();
}

function updateHud() {
  const healthRatio = player.health / PLAYER_MAX_HEALTH;
  healthValue.textContent = `${player.health} / ${PLAYER_MAX_HEALTH}`;
  healthFill.style.width = `${healthRatio * 100}%`;
  healthMeter.classList.toggle("is-critical", healthRatio <= 0.3);
  healthMeter.setAttribute("aria-valuenow", String(player.health));
  waveValue.textContent = String(state.wave);
  scoreValue.textContent = state.score.toLocaleString();
  enemiesValue.textContent = String(state.livingEnemies + state.pendingSpawns);
  canvas.dataset.wave = String(state.wave);
  canvas.dataset.score = String(state.score);
  canvas.dataset.playerHealth = String(player.health);
  canvas.dataset.enemies = String(state.livingEnemies + state.pendingSpawns);
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
    fixedUpdate(FIXED_STEP);
    state.accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (steps === MAX_CATCH_UP_STEPS && state.accumulator >= FIXED_STEP) {
    state.accumulator = 0;
  }

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
    restartGame();
  } catch (error) {
    setMode("error");
    loadingPanel.classList.add("is-error");
    loadingPanel.querySelector("strong").textContent = "The court could not open";
    loadingPanel.querySelector("span:last-child").textContent = error instanceof Error
      ? error.message
      : "An unknown asset loading error occurred.";
    announce("Game assets failed validation. Reload after checking the sprite bundle files.");
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
