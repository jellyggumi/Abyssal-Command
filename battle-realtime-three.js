import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import {
  createStageNavigation,
} from "./stage-navigation.js";

// Stages 4-10 reuse the three shipped GLB terrain/boss sets (resource-budget
// compromise; dedicated models are a future upgrade). To keep each boss
// visually distinct despite the shared mesh, createBattleObjects() applies a
// per-stage emissive/base-color tint from presentation.palette.hostile on
// top of the reused materials. Terrain reuse carries no identity claim.
const STAGE_ASSETS = Object.freeze({
  1: Object.freeze({ terrain: "terrain/cinder-span.glb", boss: "bosses/cinder-warden.glb" }),
  2: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/veil-tactician.glb" }),
  3: Object.freeze({ terrain: "terrain/echo-throne-steps.glb", boss: "bosses/gate-sovereign.glb" }),
  4: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/cinder-warden.glb" }),
  5: Object.freeze({ terrain: "terrain/cinder-span.glb", boss: "bosses/veil-tactician.glb" }),
  6: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/veil-tactician.glb" }),
  7: Object.freeze({ terrain: "terrain/cinder-span.glb", boss: "bosses/gate-sovereign.glb" }),
  8: Object.freeze({ terrain: "terrain/echo-throne-steps.glb", boss: "bosses/cinder-warden.glb" }),
  9: Object.freeze({ terrain: "terrain/veil-citadel.glb", boss: "bosses/gate-sovereign.glb" }),
  10: Object.freeze({ terrain: "terrain/echo-throne-steps.glb", boss: "bosses/gate-sovereign.glb" }),
});
const MODEL_ROOT = "./assets/models/abyssal-command/";
const BATTLE_ACTION_SEMANTICS = Object.freeze({
  hunt: Object.freeze({ source: "portal", target: "extractor", actor: "commander", actorClip: "Special", sourceAsset: "shade", clip: "Special" }),
  extract: Object.freeze({ source: "extractor", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "soul-extractor", clip: "Activate" }),
  materialize: Object.freeze({ source: "portal", target: "portal", actor: "commander", actorClip: "Special", sourceAsset: "rift-portal", clip: "Activate" }),
  capture: Object.freeze({ source: "commander", target: "node", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
  possess: Object.freeze({ source: "commander", target: "commander", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
  domain: Object.freeze({ source: "commander", target: "commander", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
  assault: Object.freeze({ source: "commander", target: "boss", actor: "commander", actorClip: "Special", sourceAsset: "commander", clip: "Special" }),
});
const MOVE_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
const SURGE_CODES = new Set(["ShiftLeft", "ShiftRight"]);
const TERRAIN_ELEVATION_SCALE = 0.42;
const ENEMY_ADVANCE_SPEED = 2.4;
const ATTACK_RANGE = 1.9;
const SHADE_INTERCEPT_RADIUS = 5;
const EPSILON = 0.0001;

// Presentation / Graphics Pass Configuration
const SHADOW_MAP_SIZE = 1024;
const SHADOW_CAMERA_SIZE = 18;
const SHADOW_CAMERA_NEAR = 0.5;
const SHADOW_CAMERA_FAR = 40;
const SHADOW_BIAS = -0.0008;
const FOG_DENSITY = 0.015;
const TONE_MAPPING_EXPOSURE = 1.05;
const FILL_LIGHT_INTENSITY = 0.65;
const RIM_LIGHT_INTENSITY = 0.85;
const RING_OPACITY = 0.4;
const CIRCLE_PROBES = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([1, 0]), Object.freeze([-1, 0]), Object.freeze([0, 1]), Object.freeze([0, -1]),
  Object.freeze([0.707, 0.707]), Object.freeze([0.707, -0.707]),
  Object.freeze([-0.707, 0.707]), Object.freeze([-0.707, -0.707]),
]);

function clipFor(clips, name) {
  const needle = name.toLowerCase();
  return clips.find((clip) => clip.name.toLowerCase() === needle || clip.name.toLowerCase().endsWith(`__${needle}`)) ?? null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cappedPixelRatio(width, devicePixelRatio) {
  const pixelRatioCap = width <= 480 ? 1.25 : width <= 900 ? 1.5 : 2;
  return Math.min(devicePixelRatio || 1, pixelRatioCap);
}

function disposeUnique(resource, disposed) {
  if (!resource || disposed.has(resource)) return;
  disposed.add(resource);
  resource.dispose?.();
}

function disposeTextures(value, disposed, visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  if (value.isTexture) {
    disposeUnique(value, disposed);
    return;
  }
  for (const nested of Object.values(value)) disposeTextures(nested, disposed, visited);
}

function disposeMaterialResources(material, disposed) {
  if (!material || disposed.has(material)) return;
  disposeTextures(material, disposed);
  disposeUnique(material, disposed);
}

function disposeObjectResources(root, disposed) {
  root?.traverse?.((node) => {
    if (!node.isMesh && !node.isPoints && !node.isLine) return;
    disposeUnique(node.geometry, disposed);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) disposeMaterialResources(material, disposed);
  });
}

const PARTICLE_CAPACITY = 360;
const AUDIO_ROOT = "./assets/audio/";

// Pooled point-sprite particle field for combat VFX (strike sparks, defeat
// ash, boss impacts, action bursts). One field per battle instance; all
// emitters share the same fixed-capacity buffer (additive-blended points),
// so cost is a single draw call regardless of how many effects are live.
export class ParticleField {
  constructor(scene) {
    this.capacity = PARTICLE_CAPACITY;
    this.cursor = 0;
    this.alive = new Uint8Array(this.capacity);
    this.life = new Float32Array(this.capacity);
    this.maxLife = new Float32Array(this.capacity);
    this.velocity = new Float32Array(this.capacity * 3);
    this.gravity = new Float32Array(this.capacity);
    this.baseColor = new Float32Array(this.capacity * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.capacity * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.16,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  // Emits `count` particles from (x, y, z) with the given color, spreading
  // outward at speeds in [speedMin, speedMax], living `life` seconds, pulled
  // down by `gravity` (world units/s^2; 0 = no fall, for rising wisps use a
  // negative value).
  emit(x, y, z, color, count, { speedMin = 0.8, speedMax = 2.4, life = 0.6, gravity = 2.2, upBias = 0.6 } = {}) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const position = this.points.geometry.attributes.position;
    const colors = this.points.geometry.attributes.color;
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      this.alive[i] = 1;
      const lifeSpan = life * (0.7 + Math.random() * 0.6);
      this.life[i] = lifeSpan;
      this.maxLife[i] = lifeSpan;
      this.gravity[i] = gravity;
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const spread = Math.random();
      this.velocity[i * 3] = Math.cos(angle) * speed * spread;
      this.velocity[i * 3 + 1] = speed * upBias + Math.random() * speed * 0.5;
      this.velocity[i * 3 + 2] = Math.sin(angle) * speed * spread;
      this.baseColor[i * 3] = c.r;
      this.baseColor[i * 3 + 1] = c.g;
      this.baseColor[i * 3 + 2] = c.b;
      position.setXYZ(i, x, y, z);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    position.needsUpdate = true;
    colors.needsUpdate = true;
  }

  update(dt) {
    const position = this.points.geometry.attributes.position;
    const color = this.points.geometry.attributes.color;
    let anyAlive = false;
    for (let i = 0; i < this.capacity; i += 1) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alive[i] = 0;
        color.setXYZ(i, 0, 0, 0);
        continue;
      }
      anyAlive = true;
      this.velocity[i * 3 + 1] -= this.gravity[i] * dt;
      const px = position.getX(i) + this.velocity[i * 3] * dt;
      const py = Math.max(0, position.getY(i) + this.velocity[i * 3 + 1] * dt);
      const pz = position.getZ(i) + this.velocity[i * 3 + 2] * dt;
      position.setXYZ(i, px, py, pz);
      const fade = Math.max(0, this.life[i] / this.maxLife[i]);
      color.setXYZ(i, this.baseColor[i * 3] * fade, this.baseColor[i * 3 + 1] * fade, this.baseColor[i * 3 + 2] * fade);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    return anyAlive;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

// Real 3D positional audio for combat events: shipped action-cue mp3s panned
// by PannerNode for materialize/capture/possess/domain/hunt/extract/assault,
// plus short procedural oscillator hits (no new audio assets needed) for
// continuous per-frame combat events that have no authored cue: strike
// clash, boss impact, defeat, breach, wave-cleared. Listener follows the
// camera every frame so panning/distance stays correct as the player orbits.
export class SpatialAudio {
  constructor() {
    const AudioCtx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
    this.ctx = AudioCtx ? new AudioCtx() : null;
    this.buffers = new Map();
    this.master = null;
    this.listenerForward = new THREE.Vector3();
    if (this.ctx) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
  }

  async loadSample(name) {
    const context = this.ctx;
    if (!context) return null;
    if (this.buffers.has(name)) return this.buffers.get(name);
    const promise = fetch(`${AUDIO_ROOT}${name}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((data) => (data ? context.decodeAudioData(data) : null))
      .catch(() => null);
    this.buffers.set(name, promise);
    return promise;
  }

  updateListener(camera) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const p = camera.position;
    if (listener.positionX) {
      listener.positionX.value = p.x;
      listener.positionY.value = p.y;
      listener.positionZ.value = p.z;
    } else if (listener.setPosition) {
      listener.setPosition(p.x, p.y, p.z);
    }
    const forward = this.listenerForward;
    camera.getWorldDirection(forward);
    if (listener.forwardX) {
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else if (listener.setOrientation) {
      listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  makePanner(x, y, z, context = this.ctx) {
    const panner = context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 4;
    panner.maxDistance = 40;
    panner.rolloffFactor = 1.1;
    panner.positionX ? panner.positionX.value = x : panner.setPosition(x, y, z);
    if (panner.positionX) { panner.positionY.value = y; panner.positionZ.value = z; }
    return panner;
  }

  // Plays a shipped mp3 (hunt/extract/materialize/capture/possess/domain/assault)
  // positioned at world (x, y, z).
  async playSample(name, x, y, z, gain = 0.8) {
    const context = this.ctx;
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => undefined);
    const buffer = await this.loadSample(name);
    if (!buffer) return;
    if (this.ctx !== context || context.state === "closed" || !this.master) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gainNode = context.createGain();
    gainNode.gain.value = gain;
    const panner = this.makePanner(x, y, z, context);
    source.connect(gainNode).connect(panner).connect(this.master);
    source.start();
    source.addEventListener("ended", () => {
      source.disconnect();
      gainNode.disconnect();
      panner.disconnect();
    }, { once: true });
  }

  // Short procedural blip (no audio file) for high-frequency combat events:
  // strike clash, boss impact, defeat, breach. Same technique already
  // proven in the Canvas 2D fallback's playSpatial(); ported to real 3D
  // panning here instead of virtual-listener 2D math.
  playTone(x, y, z, { freq = 320, endFreq = freq, duration = 0.18, type = "triangle", gain = 0.7 } = {}) {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => undefined);
    if (this.ctx.state === "closed") return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const panner = this.makePanner(x, y, z);
    osc.connect(gainNode).connect(panner).connect(this.master);
    osc.start(now);
    osc.stop(now + duration);
    osc.addEventListener("ended", () => {
      osc.disconnect();
      gainNode.disconnect();
      panner.disconnect();
    }, { once: true });
  }

  dispose() {
    this.buffers.clear();
    this.master?.disconnect();
    this.master = null;
    const context = this.ctx;
    this.ctx = null;
    if (context && context.state !== "closed") context.close().catch(() => undefined);
  }
}

export class RealtimeBattle {
  constructor(canvas, presentation, options = {}) {
    this.canvas = canvas;
    this.presentation = presentation;
    this.stageNumber = Math.max(1, Math.min(10, Number(presentation?.stageNumber) || 1));
    this.nodeGoal = Math.max(1, Number(options.nodeGoal) || 1);
    this.requestAction = typeof options.onActionRequest === "function" ? options.onActionRequest : null;
    this.getAvailableActions = typeof options.getAvailableActions === "function" ? options.getAvailableActions : null;
    this.onAssetStatus = typeof options.onAssetStatus === "function" ? options.onAssetStatus : null;
    this.onRendererFailure = typeof options.onRendererFailure === "function" ? options.onRendererFailure : null;
    this.onEncounterEvent = typeof options.onEncounterEvent === "function" ? options.onEncounterEvent : null;
    this.onRuntimeState = typeof options.onRuntimeState === "function" ? options.onRuntimeState : null;
    this.onActionFocus = typeof options.onActionFocus === "function" ? options.onActionFocus : null;
    this.lastHoveredAction = null;
    this.previewActionSemantic = null;
    this.onEnemyBreach = null; // Legacy callback; encounter events take precedence.
    this.encounter = null;
    this.encounterSnapshot = null;
    this.currentWaveId = null;
    this.pendingEncounterEvent = null;
    this.bossExposed = false;
    this.rafCallback = null;
    this.lastBossHealth = null;
    this.runtimeSignature = null;
    this.allies = [];
    this.enemies = [];
    this.engagements = new Map();
    this.exchanges = 0;
    this.authoritativeLegion = null;
    this.templates = new Map();
    this.mixers = [];
    this.disposedResources = new Set();
    this.interactives = [];
    this.pressed = new Set();
    this.destroyed = false;
    this.droppedTime = 0;
    this.running = false;
    this.lastTime = 0;
    this.raf = 0;
    this.hud = null;
    this.navigation = createStageNavigation(this.stageNumber);
    this.staticBlockers = [];
    this.nodes = [];
    this.capturedCount = 0;
    this.accumulator = 0;
    this.commanderVelocity = new THREE.Vector2(0, 0);
    this.commanderPath = null;
    this.routeLines = [];
    const portalAnchor = this.navigation.anchors.portal;
    const portalWorld = this.navigation.gridToWorld(portalAnchor.x, portalAnchor.y);
    this.rally = new THREE.Vector3(portalWorld.x + 1.25, 0, portalWorld.z);
    this.commanderPosition = new THREE.Vector3(portalWorld.x, 0, portalWorld.z);
    this.commanderOrder = null;
    this.cameraTarget = new THREE.Vector3(-5, 0, 0);
    this.cameraOffset = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.box = new THREE.Box3();
    this.size = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0;
    this.raycaster.far = 80;
    this.pointerNdc = new THREE.Vector2();
    this.pointer = null;
    this.orbitAzimuth = -0.9;
    this.orbitElevation = 0.55;
    this.zoom = 18;
    this.enemySerial = 0;
    this.actionClips = 0;
    this.particles = null;
    this.audio = new SpatialAudio();
    this.shakeTime = 0;
    this.shakeMagnitude = 0;
    this.shakeDuration = 0;
    this.shakeSeed = Math.random() * 1000;
    this.hitStopTime = 0;
    this.footstepTimer = 0;
    this.ambientEmitTimer = 0;
    this.nodePulse = 0;
    this.portalPulse = 0;
    this.bound = {
      resize: () => this.resize(),
      frame: (time) => this.frame(time),
      visibility: () => this.onVisibility(),
      clearPressedInput: () => this.clearPressedInput(),
      blur: () => {
        this.clearPressedInput();
        this.clearHover();
      },
      contextLost: (event) => this.onContextLost(event),
      keydown: (event) => this.onKey(event, true),
      keyup: (event) => this.onKey(event, false),
      pointerdown: (event) => this.onPointerDown(event),
      pointermove: (event) => this.onPointerMove(event),
      pointerup: (event) => this.onPointerUp(event),
      contextmenu: (event) => event.preventDefault(),
      pointercancel: (event) => this.onPointerCancel(event),
      wheel: (event) => this.onWheel(event),
      lostpointercapture: (event) => this.onLostPointerCapture(event),
      pointerleave: (event) => this.onPointerLeave(event),
    };
  }

  async init() {
    if (this.destroyed) throw new Error("Realtime battle was destroyed before initialization");
    this.navigation ??= createStageNavigation(this.stageNumber ?? 1);
    const gl = this.canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) {
      throw new Error("WebGL 2 is unavailable");
    }
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context: gl, antialias: true, alpha: false });
    const viewportWidth = Number(window.innerWidth) || 1440;
    this.renderer.setPixelRatio(cappedPixelRatio(viewportWidth, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(this.presentation?.palette?.background ?? "#060913", 1);

    // ACES filmic tone mapping with conservative exposure
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

    // Enable PCF soft shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    // Stage-palette fog/atmospheric depth
    const fogColor = this.presentation?.palette?.background ?? "#060913";
    this.scene.fog = new THREE.FogExp2(fogColor, FOG_DENSITY);

    const bounds = this.navigation.bounds;
    const mapWidth = bounds.right - bounds.left;
    const mapHeight = bounds.far - bounds.near;
    const maxDim = Math.max(mapWidth, mapHeight);
    this.zoom = 18 * Math.max(1, maxDim / 24);
    this.raycaster.far = Math.max(80, this.zoom * 3);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, Math.max(100, this.zoom * 4));

    // Hemisphere light with stage-colored ground
    const hemiLight = new THREE.HemisphereLight(0x91b9d0, this.presentation?.palette?.background ?? 0x090b14, 2.2);
    this.scene.add(hemiLight);

    // Configured directional shadow camera on key light
    const keyLight = new THREE.DirectionalLight(0xffe5c2, 2.6);
    keyLight.position.set(7, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
    keyLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
    keyLight.shadow.camera.near = SHADOW_CAMERA_NEAR;
    const shadowCameraSize = maxDim * 0.75;
    keyLight.shadow.camera.left = -shadowCameraSize;
    keyLight.shadow.camera.right = shadowCameraSize;
    keyLight.shadow.camera.top = shadowCameraSize;
    keyLight.shadow.camera.bottom = -shadowCameraSize;
    keyLight.shadow.camera.far = maxDim * 2.0;
    keyLight.shadow.bias = SHADOW_BIAS;
    this.scene.add(keyLight);
    this.keyLight = keyLight;

    // Subtle stage-colored fill light
    const fillLightColor = this.presentation?.palette?.ally ?? 0x70e5d0;
    const fillLight = new THREE.DirectionalLight(fillLightColor, FILL_LIGHT_INTENSITY);
    fillLight.position.set(-8, 6, -6);
    this.scene.add(fillLight);
    this.fillLight = fillLight;

    // Subtle stage-colored rim light
    const rimLightColor = this.presentation?.palette?.accent ?? 0xffb85c;
    const rimLight = new THREE.DirectionalLight(rimLightColor, RIM_LIGHT_INTENSITY);
    rimLight.position.set(-2, 10, -12);
    this.scene.add(rimLight);
    this.rimLight = rimLight;

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth + 4, mapHeight + 4),
      new THREE.MeshStandardMaterial({ color: 0x10182a, transparent: true, opacity: 0.08, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.userData.ground = true;
    this.ground.receiveShadow = true; // Receive shadows on ground
    this.scene.add(this.ground);
    this.ringGeometry = new THREE.RingGeometry(0.8, 1.1, 16);
    this.particles = new ParticleField(this.scene);
    this.attachEvents();
    this.resize();
    this.updateCamera(0);
    await this.loadStageAssets();
    if (this.destroyed) throw new Error("WebGL context was lost while loading stage resources");
    this.createBattleObjects();
    if (Number.isInteger(this.authoritativeLegion)) this.reconcileAllies(this.authoritativeLegion);
    this.reconcileEncounterWave();
    this.syncBossExposure();
    this.publishRuntimeState();
    this.rafCallback = this.bound?.frame ?? ((time) => this.frame(time));
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.rafCallback);
    return this;
  }

  attachEvents() {
    this.canvas.addEventListener("webglcontextlost", this.bound.contextLost, false);
    this.canvas.addEventListener("keydown", this.bound.keydown);
    this.canvas.addEventListener("keyup", this.bound.keyup);
    this.canvas.addEventListener("blur", this.bound.blur);
    this.canvas.addEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.addEventListener("pointermove", this.bound.pointermove);
    this.canvas.addEventListener("pointerup", this.bound.pointerup);
    this.canvas.addEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.addEventListener("lostpointercapture", this.bound.lostpointercapture);
    this.canvas.addEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.addEventListener("wheel", this.bound.wheel, { passive: false });
    this.canvas.addEventListener("pointerleave", this.bound.pointerleave);
    globalThis.window?.addEventListener("blur", this.bound.blur);
    document.addEventListener("visibilitychange", this.bound.visibility);
    this.resizeObserver = new ResizeObserver(this.bound.resize);
    this.resizeObserver.observe(this.canvas);
  }

  async loadStageAssets() {
    const stage = STAGE_ASSETS[this.stageNumber];
    const resources = [stage.terrain, "units/shade.glb", "units/scout.glb", "units/guard.glb", "units/reinforce.glb", stage.boss];
    let loaded = 0;
    this.onAssetStatus?.({ state: "loading", loaded, total: resources.length, clips: 0 });
    for (const resource of resources) {
      const gltf = await this.loadModel(resource);
      if (this.destroyed) throw new Error("Realtime battle was destroyed while loading stage resources");
      this.templates.set(resource, gltf);
      loaded += 1;
      this.actionClips += gltf.animations.length;
      this.onAssetStatus?.({ state: "loading", loaded, total: resources.length, clips: this.actionClips });
    }
    this.onAssetStatus?.({ state: "loaded", loaded, total: resources.length, clips: this.actionClips });
  }

  async loadModel(resource) {
    const url = `${MODEL_ROOT}${resource}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load ${resource}`);
      const data = await response.arrayBuffer();
      const resourceBase = url.slice(0, url.lastIndexOf("/") + 1);
      return await new Promise((resolve, reject) => {
        new GLTFLoader().parse(
          data,
          resourceBase,
          resolve,
          (error) => reject(error instanceof Error ? error : new Error(`Unable to load ${resource}`)),
        );
      });
    } catch (error) {
      throw error instanceof Error && error.message.includes(resource)
        ? error
        : new Error(`Unable to load ${resource}`);
    }
  }

  createBattleObjects() {
    const stage = STAGE_ASSETS[this.stageNumber];
    const terrain = this.cloneTemplate(stage.terrain, 22);
    terrain.root.position.y -= 0.03;
    this.scene.add(terrain.root);
    this.terrain = terrain.root;

    // Construction of the instanced tactical deck for walkable cells
    const cells = this.navigation.cells;
    const gridWidth = this.navigation.width || 24;
    const gridHeight = this.navigation.height || 12;

    // Cache route cells by creating membership sets for lookup
    const routeKeySets = this.navigation.routes.map((route) => {
      const set = new Set();
      if (route && Array.isArray(route.cells)) {
        for (const cell of route.cells) {
          set.add(`${cell.x},${cell.y}`);
        }
      }
      return set;
    });

    const walkableCells = [];
    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridWidth; c++) {
        const elevation = cells[r] ? cells[r][c] : -1;
        if (elevation >= 0) {
          walkableCells.push({ c, r, elevation });
        }
      }
    }

    const deckCount = walkableCells.length;
    if (deckCount > 0) {
      // 0.92 x 0.08 x 0.92 box dimensions to leave elegant 0.08 gaps
      const deckGeometry = new THREE.BoxGeometry(0.92, 0.08, 0.92);
      const deckMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x1b2638,
        emissiveIntensity: 0.5,
        roughness: 0.48,
        metalness: 0.35,
      });

      const deckMesh = new THREE.InstancedMesh(deckGeometry, deckMaterial, deckCount);
      deckMesh.castShadow = true;
      deckMesh.receiveShadow = true;

      this.deckGeometry = deckGeometry;
      this.deckMaterial = deckMaterial;
      this.deckMesh = deckMesh;

      const dummy = new THREE.Object3D();
      const colorNeutral = new THREE.Color(0x64748b);
      const colorJunction = new THREE.Color(0xcbd5e1);
      
      const routeColors = [
        new THREE.Color(this.presentation?.palette?.ally ?? 0x70e5d0),
        new THREE.Color(this.presentation?.palette?.accent ?? 0xffb85c),
        new THREE.Color(this.presentation?.palette?.hostile ?? 0xff7f79),
      ];

      for (let i = 0; i < deckCount; i++) {
        const { c, r, elevation } = walkableCells[i];
        const world = this.navigation.gridToWorld(c + 0.5, r + 0.5);
        // Keep the deck clearly above the transparent picking plane.
        const yPos = elevation * TERRAIN_ELEVATION_SCALE + 0.02;

        dummy.position.set(world.x, yPos, world.z);
        dummy.updateMatrix();
        deckMesh.setMatrixAt(i, dummy.matrix);

        // Determine route membership
        const key = `${c},${r}`;
        const memberOf = [];
        for (let ri = 0; ri < routeKeySets.length; ri++) {
          if (routeKeySets[ri].has(key)) {
            memberOf.push(ri);
          }
        }

        let tileColor;
        if (memberOf.length === 0) {
          tileColor = colorNeutral.clone();
        } else if (memberOf.length === 1) {
          const rIndex = memberOf[0];
          tileColor = routeColors[rIndex].clone();
        } else {
          // Junction of multiple routes
          tileColor = colorJunction.clone();
        }
        deckMesh.setColorAt(i, tileColor);
      }

      deckMesh.instanceMatrix.needsUpdate = true;
      deckMesh.instanceColor.needsUpdate = true;
      this.scene.add(deckMesh);
    }

    // Create route lines
    this.routeLines = [];
    const routeColors = [
      this.presentation?.palette?.ally ?? "#70e5d0",
      this.presentation?.palette?.accent ?? "#ffb85c",
      this.presentation?.palette?.hostile ?? "#ff7f79",
    ];
    for (let i = 0; i < this.navigation.routes.length; i++) {
      const route = this.navigation.routes[i];
      const points = [];
      for (const cell of route.cells) {
        const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
        const nav = this.navigationAt(world.x, world.z);
        // Keep route lines above the raised deck surface.
        const y = nav.elevation * TERRAIN_ELEVATION_SCALE + 0.10;
        points.push(new THREE.Vector3(world.x, y, world.z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: routeColors[i % routeColors.length],
        transparent: true,
        opacity: 0.9,
        linewidth: 3,
      });
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.routeLines.push(line);
    }

    const portalAnchor = this.navigation.anchors.portal;
    const portalPosition = this.gridToWorld(portalAnchor.x, portalAnchor.y);
    this.portal = this.makeMarker(0x87e8df, portalPosition.x, portalPosition.z, "materialize");
    this.portal.scale.set(0.7, 1.3, 0.7);
    this.registerStaticBlocker(this.portal, 0.65, false);
    this.scene.add(this.portal);

    // Create multiple nodes from anchors.nodes
    this.nodes = [];
    const nodeAnchors = this.navigation.anchors.nodes;
    for (let i = 0; i < nodeAnchors.length; i++) {
      const nodeAnchor = nodeAnchors[i];
      const nodePos = this.gridToWorld(nodeAnchor.x, nodeAnchor.y);
      const nodeMesh = this.makeMarker(0xffbc69, nodePos.x, nodePos.z, null);
      this.registerStaticBlocker(nodeMesh, 0.62, false);
      this.scene.add(nodeMesh);
      this.nodes.push(nodeMesh);
    }
    this.node = this.nodes[0] || null;
    this.updateNodeVisuals();

    const boss = this.cloneTemplate(stage.boss, 2.7);
    const bossAnchor = this.navigation.anchors.boss;
    const bossPosition = this.gridToWorld(bossAnchor.x, bossAnchor.y);
    this.setGroundedPosition(boss, bossPosition.x, bossPosition.z);
    boss.root.userData.pickRoot = boss.root;
    this.applyBossIdentityTint(boss.root);
    this.scene.add(boss.root);
    this.boss = boss;
    this.registerStaticBlocker(boss.root, 1.18, true, () => boss.root.visible);
    this.interactives.push(boss.root);
    this.syncBossExposure();
    this.play(boss, "Idle");

    const commander = this.cloneTemplate("units/shade.glb", 1.25);
    commander.radius = 0.42;
    this.setGroundedPosition(commander, this.commanderPosition.x, this.commanderPosition.z);
    this.commanderPosition.copy(commander.root.position);
    this.scene.add(commander.root);
    this.commander = commander;
    this.play(commander, "Idle");
  }

  // Stages 4-10 reuse a Stage 1-3 boss mesh (see STAGE_ASSETS comment). Tint
  // the reused materials with this stage's own hostile palette color so two
  // narratively distinct bosses never render as visually identical; stages
  // 1-3 keep their authored material untouched.
  applyBossIdentityTint(root) {
    if (this.stageNumber <= 3) return;
    const hex = this.presentation?.palette?.hostile;
    if (!hex) return;
    const tint = new THREE.Color(hex);
    root.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const tinted = materials.map((material) => {
        if (!material) return material;
        const clone = material.clone();
        clone.userData.isBossIdentityTint = true;
        if (clone.color) clone.color.lerp(tint, 0.55);
        if ("emissive" in clone) {
          clone.emissive = tint.clone();
          clone.emissiveIntensity = 0.35;
        }
        return clone;
      });
      node.material = tinted.length === 1 ? tinted[0] : tinted;
    });
  }

  makeMarker(color, x, z, semantic) {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.75, 0.16, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.55 }),
    );
    marker.position.set(x, this.navigationAt(x, z).elevation * TERRAIN_ELEVATION_SCALE + 0.08, z);
    marker.userData.semantic = semantic;
    marker.userData.pickRoot = marker;
    marker.castShadow = true;
    marker.receiveShadow = true;
    this.interactives.push(marker);

    // Create a low-cost ground ring / light halo to improve readability
    if (this.ringGeometry) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: RING_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(this.ringGeometry, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.07;
      marker.add(ring);
    }

    return marker;
  }

  gridToWorld(x, z) {
    const res = this.navigation.gridToWorld(x, z);
    return { x: res.x, z: res.z };
  }

  worldToGrid(x, z) {
    const res = this.navigation.worldToGrid(x, z);
    return { x: res.x, y: res.y };
  }

  navigationAt(x, z) {
    const grid = this.worldToGrid(x, z);
    const cellX = Math.floor(grid.x);
    const cellZ = Math.floor(grid.y);
    const height = this.navigation.heightAt(cellX, cellZ);
    return {
      x: grid.x,
      y: grid.y,
      elevation: Math.max(0, height),
      walkable: height >= 0,
    };
  }

  setNodeState(nodeMesh, status) {
    if (!nodeMesh) return;
    let colorHex;
    let opacity;
    let emissiveIntensity;
    let semantic;
    if (status === "captured") {
      colorHex = this.presentation?.palette?.node ?? 0xffbc69;
      opacity = 0.9;
      emissiveIntensity = 0.5;
      semantic = null;
    } else if (status === "next") {
      colorHex = this.presentation?.palette?.node ?? 0xffbc69;
      opacity = 1.0;
      emissiveIntensity = this.nodePulse;
      semantic = "capture";
    } else { // "future"
      colorHex = 0x71829b;
      opacity = 0.46;
      emissiveIntensity = 0.2;
      semantic = null;
    }

    const color = new THREE.Color(colorHex);

    if (nodeMesh.material) {
      if (nodeMesh.material.color && typeof nodeMesh.material.color.copy === "function") {
        nodeMesh.material.color.copy(color);
      } else {
        nodeMesh.material.color = color;
      }
      if (nodeMesh.material.emissive && typeof nodeMesh.material.emissive.copy === "function") {
        nodeMesh.material.emissive.copy(color);
      } else {
        nodeMesh.material.emissive = color;
      }
      nodeMesh.material.emissiveIntensity = emissiveIntensity;
      nodeMesh.material.transparent = true;
      nodeMesh.material.opacity = opacity;
    }

    nodeMesh.userData = nodeMesh.userData || {};
    nodeMesh.userData.semantic = semantic;

    if (typeof nodeMesh.traverse === "function") {
      nodeMesh.traverse((child) => {
        if (child !== nodeMesh && child.isMesh && child.material) {
          if (child.material.color && typeof child.material.color.copy === "function") {
            child.material.color.copy(color);
          } else {
            child.material.color = color;
          }
          child.material.transparent = true;
          child.material.opacity = opacity * RING_OPACITY;
        }
      });
    }
  }

  updateNodeVisuals() {
    if (!this.nodes || !this.nodes.length) return;
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeMesh = this.nodes[i];
      if (!nodeMesh) continue;
      let status = "future";
      if (i < this.capturedCount) {
        status = "captured";
      } else if (i === this.capturedCount) {
        status = "next";
      }
      this.setNodeState(nodeMesh, status);
    }
    const activeIndex = Math.min(this.nodes.length - 1, this.capturedCount);
    if (this.nodes[activeIndex]) {
      this.node = this.nodes[activeIndex];
    }
  }


  setGroundedPosition(instance, x, z) {
    const navigation = this.navigationAt(x, z);
    instance.root.position.set(x, navigation.elevation * TERRAIN_ELEVATION_SCALE, z);
  }

  registerStaticBlocker(root, radius, blocksMovement, active = () => true) {
    const collider = Object.freeze({ type: "circle", radius, blocksMovement });
    root.userData.collider = collider;
    this.staticBlockers.push({ root, radius, blocksMovement, active });
  }

  cloneTemplate(resource, targetSize) {
    const template = this.templates.get(resource);
    if (!template) throw new Error(`Missing stage template ${resource}`);
    const root = template.scene.clone(true);
    this.normalizeGroundCenter(root, targetSize);
    root.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    const instance = { root, mixer: new THREE.AnimationMixer(root), clips: template.animations, actions: new Map(), active: null, cooldown: 0 };
    this.mixers.push(instance.mixer);
    return instance;
  }

  normalizeGroundCenter(root, targetSize) {
    root.updateMatrixWorld(true);
    this.box.setFromObject(root);
    this.box.getSize(this.size);
    this.box.getCenter(this.center);
    const span = Math.max(this.size.x, this.size.z, EPSILON);
    const scale = targetSize / span;
    root.scale.setScalar(scale);
    root.position.set(-this.center.x * scale, -this.box.min.y * scale, -this.center.z * scale);
    root.updateMatrixWorld(true);
  }

  play(instance, name, once = false) {
    if (!instance?.clips) return;
    const clip = clipFor(instance.clips, name);
    if (!clip) return;
    let action = instance.actions.get(clip.name);
    if (!action) {
      action = instance.mixer.clipAction(clip);
      instance.actions.set(clip.name, action);
    }
    if (instance.active === action && action.isRunning()) return;
    if (instance.active && instance.active !== action) instance.active.fadeOut(0.1);
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(0.1).play();
    instance.active = action;
  }

  frame(time) {
    if (!this.running || this.destroyed || document.hidden) {
      this.raf = 0;
      return;
    }
    const rawDelta = (time - this.lastTime) / 1000;
    if (rawDelta > 0.10) {
      this.droppedTime += (rawDelta - 0.10);
    }
    let frameDelta = Math.max(0, rawDelta);
    this.lastTime = time;
    frameDelta = Math.min(0.10, frameDelta);

    let simDelta = frameDelta;
    if (this.hitStopTime > 0) {
      this.hitStopTime = Math.max(0, this.hitStopTime - frameDelta);
      simDelta = frameDelta * 0.06;
    }

    const SIM_TICK = 1 / 60;
    this.accumulator = (this.accumulator || 0) + simDelta;
    const maxAccumulator = 6 * SIM_TICK;
    if (this.accumulator > maxAccumulator) {
      this.droppedTime += (this.accumulator - maxAccumulator);
      this.accumulator = maxAccumulator;
    }

    while (this.accumulator >= SIM_TICK) {
      this.update(SIM_TICK);
      this.accumulator -= SIM_TICK;
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.rafCallback);
  }

  triggerHitStop(duration = 0.09) {
    this.hitStopTime = Math.max(this.hitStopTime, duration);
  }

  shakeCamera(magnitude, duration = 0.25) {
    const currentStrength = this.shakeMagnitude * (this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0);
    if (magnitude < currentStrength) return; // weaker pulse is already masked by the still-decaying stronger one
    this.shakeMagnitude = magnitude;
    this.shakeTime = duration;
    this.shakeDuration = duration;
  }

  update(dt) {
    this.reconcileEngagements();
    this.selectEngagements();
    this.updateEngagements(dt);
    this.reconcileEngagements();
    this.moveCommander(dt);
    this.updateAllies(dt);
    this.updateEnemies(dt);
    for (const mixer of this.mixers) mixer.update(dt);
    this.portal.rotation.y += dt * 0.8;
    for (const node of this.nodes) {
      if (node) node.rotation.y -= dt * 0.5;
    }
    if (this.node && !this.nodes.includes(this.node)) {
      this.node.rotation.y -= dt * 0.5;
    }
    this.updateMarkerPulses(dt);
    this.updateAmbience(dt);
    this.updatePreviewEmphasis(dt);
    this.particles?.update(dt);
    this.updateCamera(dt);
    this.audio.updateListener(this.camera);
    this.publishRuntimeState();
  }

  // Node/portal emissive spikes on capture/hunt/extract, then eases back to
  // its resting glow instead of staying pinned at the flash value forever.
  updateMarkerPulses(dt) {
    this.nodePulse = Math.max(0.8, this.nodePulse - dt * 3.2);
    this.portalPulse = Math.max(0.8, this.portalPulse - dt * 3.2);
    if (this.portal && this.portal.material) {
      this.portal.material.emissiveIntensity = this.portalPulse;
    }
    this.updateNodeVisuals();
  }

  // Slow drifting embers/motes in the stage's accent color — cheap
  // atmospheric depth that reads as "the battlefield is alive" without new
  // terrain geometry per elevation tier.
  updateAmbience(dt) {
    this.ambientEmitTimer -= dt;
    if (this.ambientEmitTimer > 0) return;
    this.ambientEmitTimer = 0.35;
    const accent = this.presentation?.palette?.accent ?? "#ffb85c";
    const x = (Math.random() - 0.5) * 16;
    const z = (Math.random() - 0.5) * 10;
    const y = 0.2 + Math.random() * 0.3;
    this.particles?.emit(x, y, z, accent, 1, {
      speedMin: 0.05, speedMax: 0.25, life: 3.5, gravity: -0.15, upBias: 0.4,
    });
  }

  liveAlly(unit) {
    return this.allies.includes(unit) && !unit.defeated;
  }

  liveEnemy(unit) {
    return !unit.defeated && !unit.breachVisualized;
  }

  clearEngagement(unit) {
    const mate = this.engagements.get(unit);
    if (!mate) return;
    this.engagements.delete(unit);
    if (this.engagements.get(mate) === unit) this.engagements.delete(mate);
  }

  bindEngagement(ally, enemy) {
    if (!this.allies.includes(ally) || !this.liveAlly(ally) || !this.liveEnemy(enemy)) return false;
    const allyMate = this.engagements.get(ally);
    const enemyMate = this.engagements.get(enemy);
    if (allyMate === enemy && enemyMate === ally) return true;
    if (allyMate || enemyMate) return false;
    this.engagements.set(ally, enemy);
    this.engagements.set(enemy, ally);
    return true;
  }

  reconcileEngagements() {
    for (const [unit, mate] of this.engagements) {
      const unitIsAlly = this.allies.includes(unit);
      const mateIsAlly = this.allies.includes(mate);
      if (
        this.engagements.get(mate) !== unit ||
        unitIsAlly === mateIsAlly ||
        (unitIsAlly ? !this.liveAlly(unit) : !this.liveEnemy(unit)) ||
        (mateIsAlly ? !this.liveAlly(mate) : !this.liveEnemy(mate))
      ) this.clearEngagement(unit);
    }
  }

  selectEngagements() {
    const rangeSquared = ATTACK_RANGE * ATTACK_RANGE;
    for (const ally of this.allies) {
      if (!this.liveAlly(ally) || this.engagements.has(ally)) continue;
      let nearest = null;
      let closest = rangeSquared;
      for (const enemy of this.enemies) {
        if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
        const dx = enemy.root.position.x - ally.root.position.x;
        const dz = enemy.root.position.z - ally.root.position.z;
        const distance = dx * dx + dz * dz;
        if (distance <= closest) {
          closest = distance;
          nearest = enemy;
        }
      }
      if (nearest) this.bindEngagement(ally, nearest);
    }
  }

  nearestUnengagedEnemy(ally) {
    if (!this.liveAlly(ally) || this.engagements.has(ally)) return null;
    const rangeSquared = SHADE_INTERCEPT_RADIUS * SHADE_INTERCEPT_RADIUS;
    let nearest = null;
    let closest = rangeSquared;
    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
      const dx = enemy.root.position.x - ally.root.position.x;
      const dz = enemy.root.position.z - ally.root.position.z;
      const distance = dx * dx + dz * dz;
      if (distance <= closest) {
        closest = distance;
        nearest = enemy;
      }
    }
    return nearest;
  }

  terrainClear(x, z, radius, previous) {
    const destination = this.navigationAt(x, z);
    if (!destination.walkable) return false;
    if (previous) {
      const prevGrid = this.worldToGrid(previous.x, previous.z);
      if (!this.navigation.climbOk(
        Math.floor(prevGrid.x),
        Math.floor(prevGrid.y),
        Math.floor(destination.x),
        Math.floor(destination.y),
      )) return false;
    }
    for (const [offsetX, offsetZ] of CIRCLE_PROBES) {
      if (!this.navigationAt(x + offsetX * radius, z + offsetZ * radius).walkable) return false;
    }
    return true;
  }

  collidesWithActor(unit, x, z, radius, actor, live) {
    if (!actor || actor === unit || !actor.root || !live) return false;
    const dx = x - actor.root.position.x;
    const dz = z - actor.root.position.z;
    const limit = radius + (actor.radius ?? 0.42);
    return dx * dx + dz * dz < limit * limit;
  }

  collidesAt(unit, x, z, radius) {
    for (const blocker of this.staticBlockers) {
      if (blocker.blocksMovement === false || blocker.active?.() === false) continue;
      const position = blocker.root?.position ?? blocker;
      const dx = x - position.x;
      const dz = z - position.z;
      const limit = radius + blocker.radius;
      if (dx * dx + dz * dz < limit * limit) return true;
    }
    for (const ally of this.allies) {
      if (this.collidesWithActor(unit, x, z, radius, ally, this.liveAlly(ally))) return true;
    }
    if (!this.enemies.includes(unit)) {
      for (const enemy of this.enemies) {
        if (this.collidesWithActor(unit, x, z, radius, enemy, this.liveEnemy(enemy))) return true;
      }
    }
    return false;
  }

  resolveMovement(unit, targetX, targetZ) {
    const root = unit?.root;
    if (!root) return { x: targetX, y: 0, z: targetZ, blocked: true };
    const radius = unit.radius ?? 0.42;
    const start = { x: root.position.x, z: root.position.z };
    const distance = Math.hypot(targetX - start.x, targetZ - start.z);
    const steps = Math.max(1, Math.ceil(distance / 0.12));
    let resolved = start;
    let blocked = false;
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      const x = start.x + (targetX - start.x) * progress;
      const z = start.z + (targetZ - start.z) * progress;
      if (!this.terrainClear(x, z, radius, resolved) || this.collidesAt(unit, x, z, radius)) {
        blocked = true;
        break;
      }
      resolved = { x, z };
    }
    const navigation = this.navigationAt(resolved.x, resolved.z);
    return {
      x: resolved.x,
      y: navigation.elevation * TERRAIN_ELEVATION_SCALE,
      z: resolved.z,
      blocked,
    };
  }

  applyResolvedMovement(unit, targetX, targetZ) {
    const resolved = this.resolveMovement(unit, targetX, targetZ);
    unit.root.position.set(resolved.x, resolved.y, resolved.z);
    return resolved;
  }

  updateEngagements(dt) {
    for (const ally of this.allies) {
      const enemy = this.engagements.get(ally);
      if (!enemy || this.engagements.get(enemy) !== ally || !this.liveAlly(ally) || !this.liveEnemy(enemy)) continue;
      ally.cooldown = Math.max(0, ally.cooldown - dt);
      this.play(ally, "Strike");
      if (ally.cooldown !== 0) continue;
      ally.cooldown = 0.55;
      enemy.hp -= 1;
      this.clashEffect(ally.root.position, enemy.root.position);
      this.enemyStrike(enemy, ally);
      this.exchanges += 1;
      if (enemy.hp <= 0) this.defeat(enemy);
    }
  }

  // Spark burst + clang tone at the midpoint of an ally/enemy melee
  // exchange — the one combat beat that repeats most often, so it must read
  // clearly without becoming visual noise (small particle count, short
  // percussive tone).
  clashEffect(allyPos, enemyPos) {
    const mx = (allyPos.x + enemyPos.x) / 2;
    const mz = (allyPos.z + enemyPos.z) / 2;
    const my = Math.max(allyPos.y, enemyPos.y) + 0.9;
    const spark = this.presentation?.palette?.accent ?? "#ffb85c";
    this.particles?.emit(mx, my, mz, spark, 6, { speedMin: 1.2, speedMax: 2.8, life: 0.28, gravity: 4, upBias: 0.4 });
    this.audio.playTone(mx, my, mz, { freq: 900, endFreq: 320, duration: 0.09, type: "triangle", gain: 0.35 });
  }

  enemyStrike(enemy, target, damage = 1) {
    if (!enemy || !target || target.defeated) return;
    this.play(enemy, "Strike");
    target.hp -= damage;
    target.hit = (target.hit ?? 0) + 1;
    const hostile = this.presentation?.palette?.hostile ?? "#ff7f79";
    this.particles?.emit(target.root.position.x, target.root.position.y + 0.8, target.root.position.z, hostile, 8, {
      speedMin: 1.4, speedMax: 3.2, life: 0.32, gravity: 5,
    });
    this.audio.playTone(target.root.position.x, target.root.position.y + 0.8, target.root.position.z, {
      freq: 220, endFreq: 90, duration: 0.14, type: "sawtooth", gain: 0.45,
    });
    if (target.hp <= 0 || target.hit >= 3) this.defeat(target);
  }

  moveCommander(dt) {
    if (!this.commander || !this.commander.root) return;
    let x = 0;
    let z = 0;
    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) z -= 1;
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) z += 1;
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) x -= 1;
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) x += 1;
    const root = this.commander.root;
    
    // Keyboard input cancels any active clicked path/movement order
    if (x !== 0 || z !== 0) {
      this.commanderOrder = null;
      this.commanderPath = null;
    }
    
    if (x === 0 && z === 0) {
      if (this.commanderPath && this.commanderPath.length > 0) {
        let nextWaypoint = this.commanderPath[0];
        let targetWorld = this.navigation.gridToWorld(nextWaypoint.x + 0.5, nextWaypoint.y + 0.5);
        x = targetWorld.x - root.position.x;
        z = targetWorld.z - root.position.z;
        if (Math.hypot(x, z) <= 0.08) {
          this.commanderPath.shift();
          if (this.commanderPath.length === 0) {
            this.commanderPath = null;
            this.commanderOrder = null;
            x = 0;
            z = 0;
          } else {
            nextWaypoint = this.commanderPath[0];
            targetWorld = this.navigation.gridToWorld(nextWaypoint.x + 0.5, nextWaypoint.y + 0.5);
            x = targetWorld.x - root.position.x;
            z = targetWorld.z - root.position.z;
          }
        }
      } else if (this.commanderOrder) {
        x = this.commanderOrder.x - root.position.x;
        z = this.commanderOrder.z - root.position.z;
        if (Math.hypot(x, z) <= 0.08) {
          this.commanderOrder = null;
          x = 0;
          z = 0;
        }
      }
    }
    
    const targetVel = new THREE.Vector2(0, 0);
    const length = Math.hypot(x, z);
    if (length > EPSILON) {
      const speed = this.hasSurge() ? 7.2 : 4.1;
      targetVel.set((x / length) * speed, (z / length) * speed);
    }
    
    if (!this.commanderVelocity) {
      this.commanderVelocity = new THREE.Vector2(0, 0);
    }
    
    const targetSpeed = targetVel.length();
    const currentSpeed = this.commanderVelocity.length();
    let rate = 28;
    if (targetSpeed === 0 || currentSpeed > targetSpeed) {
      rate = 36;
    }
    
    const diff = new THREE.Vector2().subVectors(targetVel, this.commanderVelocity);
    const diffLen = diff.length();
    const step = rate * dt;
    
    if (diffLen <= step) {
      this.commanderVelocity.copy(targetVel);
    } else {
      this.commanderVelocity.addScaledVector(diff.normalize(), step);
    }
    
    const speed = this.commanderVelocity.length();
    if (speed < 0.05) {
      this.commanderVelocity.set(0, 0);
      this.play(this.commander, "Idle");
      return;
    }
    
    const dx = this.commanderVelocity.x * dt;
    const dz = this.commanderVelocity.y * dt;
    const resolved = this.applyResolvedMovement(
      this.commander,
      root.position.x + dx,
      root.position.z + dz,
    );
    this.commanderPosition.copy(root.position);
    this.commander.root.rotation.y = Math.atan2(this.commanderVelocity.x, this.commanderVelocity.y);
    this.emitFootstepTrail(dt, root.position, this.hasSurge());
    this.play(this.commander, "Move");
    if (resolved.blocked) {
      this.commanderVelocity.set(0, 0);
      this.commanderOrder = null;
      this.commanderPath = null;
    }
  }

  // Ground dust while walking; a brighter, more frequent accent-color trail
  // while surging (Shift). Throttled by a shared timer so this never spams
  // the particle pool during sustained movement.
  emitFootstepTrail(dt, position, surging) {
    this.footstepTimer -= dt;
    if (this.footstepTimer > 0) return;
    if (surging) {
      this.footstepTimer = 0.05;
      const accent = this.presentation?.palette?.accent ?? "#ffb85c";
      this.particles?.emit(position.x, position.y + 0.15, position.z, accent, 2, {
        speedMin: 0.2, speedMax: 0.6, life: 0.3, gravity: 0.5, upBias: 0.2,
      });
    } else {
      this.footstepTimer = 0.22;
      this.particles?.emit(position.x, position.y + 0.05, position.z, "#8a8578", 3, {
        speedMin: 0.15, speedMax: 0.45, life: 0.4, gravity: 1.8, upBias: 0.15,
      });
    }
  }

  updateAllies(dt) {
    for (let index = 0; index < this.allies.length; index += 1) {
      const ally = this.allies[index];
      if (!this.liveAlly(ally) || this.engagements.has(ally)) continue;
      const intercept = this.nearestUnengagedEnemy(ally);
      const angle = index * 2.4;
      const desiredX = intercept?.root.position.x ?? this.rally.x + Math.cos(angle) * 1.25;
      const desiredZ = intercept?.root.position.z ?? this.rally.z + Math.sin(angle) * 1.25;
      const root = ally.root;
      this.applyResolvedMovement(
        ally,
        root.position.x + (desiredX - root.position.x) * Math.min(1, dt * 3),
        root.position.z + (desiredZ - root.position.z) * Math.min(1, dt * 3),
      );
      this.play(ally, "Move");
    }
  }

  updateEnemies(dt) {
    const portalAnchor = this.navigation.anchors.portal;
    const portalWorld = this.navigation.gridToWorld(portalAnchor.x, portalAnchor.y);
    
    for (const enemy of this.enemies) {
      if (!this.liveEnemy(enemy) || this.engagements.has(enemy)) continue;
      
      if (!enemy.waypoints) {
        const routeIndex = enemy.routeIndex ?? 0;
        const routeCells = this.navigation.routePath(routeIndex, true);
        if (routeCells) {
          enemy.waypoints = routeCells.map((cell) => {
            const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
            return new THREE.Vector3(world.x, 0, world.z);
          });
          for (const wp of enemy.waypoints) {
            const nav = this.navigationAt(wp.x, wp.z);
            wp.y = nav.elevation * TERRAIN_ELEVATION_SCALE;
          }
        }
        enemy.waypointIndex = 0;
      }
      
      if (enemy.waypoints && enemy.waypointIndex < enemy.waypoints.length) {
        let targetWP = enemy.waypoints[enemy.waypointIndex];
        let dx = targetWP.x - enemy.root.position.x;
        let dz = targetWP.z - enemy.root.position.z;
        while (Math.hypot(dx, dz) <= 0.08 && enemy.waypointIndex < enemy.waypoints.length - 1) {
          enemy.waypointIndex += 1;
          targetWP = enemy.waypoints[enemy.waypointIndex];
          dx = targetWP.x - enemy.root.position.x;
          dz = targetWP.z - enemy.root.position.z;
        }
        this.direction.set(dx, 0, dz);
      } else {
        this.direction.set(portalWorld.x - enemy.root.position.x, 0, portalWorld.z - enemy.root.position.z);
      }
      
      const distance = this.direction.length();
      if (distance > EPSILON) {
        this.direction.multiplyScalar(1 / distance);
        const resolved = this.applyResolvedMovement(
          enemy,
          enemy.root.position.x + this.direction.x * dt * 2.4,
          enemy.root.position.z + this.direction.z * dt * 2.4,
        );
        if (resolved.blocked) {
          const detourDistance = Math.min(0.24, dt * 2.4);
          const preferredDetour = this.applyResolvedMovement(
            enemy,
            enemy.root.position.x - this.direction.z * enemy.detourPreference * detourDistance,
            enemy.root.position.z + this.direction.x * enemy.detourPreference * detourDistance,
          );
          if (preferredDetour.blocked) {
            this.applyResolvedMovement(
              enemy,
              enemy.root.position.x + this.direction.z * enemy.detourPreference * detourDistance,
              enemy.root.position.z - this.direction.x * enemy.detourPreference * detourDistance,
            );
          }
        }
        enemy.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
      }
      this.play(enemy, "Move");
      if (enemy.root.position.x <= portalWorld.x) {
        enemy.breachVisualized = true;
        this.clearEngagement(enemy);
        this.particles?.emit(enemy.root.position.x, enemy.root.position.y + 0.6, enemy.root.position.z, "#ff3b3b", 16, {
          speedMin: 1.5, speedMax: 3.4, life: 0.5, gravity: 3,
        });
        this.audio.playTone(enemy.root.position.x, enemy.root.position.y + 0.6, enemy.root.position.z, {
          freq: 140, endFreq: 60, duration: 0.35, type: "square", gain: 0.75,
        });
        this.shakeCamera(0.14, 0.22);
        this.emitEncounterEvent("breach");
      }
    }

    if (this.currentWaveId && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.defeated || enemy.breachVisualized)) {
      const p = this.node?.position ?? this.commanderPosition;
      const ally = this.presentation?.palette?.ally ?? "#70e5d0";
      this.particles?.emit(p.x, 0.5, p.z, ally, 20, { speedMin: 1.6, speedMax: 3.4, life: 0.9, gravity: 1.4, upBias: 1 });
      this.audio.playTone(p.x, 0.5, p.z, { freq: 440, endFreq: 880, duration: 0.4, type: "sine", gain: 0.6 });
      this.emitEncounterEvent("wave-cleared");
    }
  }

  defeat(unit) {
    if (!unit || unit.defeated) return;
    unit.defeated = true;
    this.clearEngagement(unit);
    this.play(unit, "Defeat", true);
    const isAlly = this.allies.includes(unit);
    const isBoss = unit === this.boss;
    const color = isBoss || !isAlly
      ? (this.presentation?.palette?.hostile ?? "#ff7f79")
      : (this.presentation?.palette?.ally ?? "#70e5d0");
    const pos = unit.root.position;
    const count = isBoss ? 48 : 14;
    this.particles?.emit(pos.x, pos.y + 1, pos.z, color, count, {
      speedMin: isBoss ? 2.2 : 1, speedMax: isBoss ? 5 : 2.6, life: isBoss ? 1.1 : 0.65, gravity: 1.6, upBias: 0.8,
    });
    if (isBoss) {
      this.audio.playTone(pos.x, pos.y + 1, pos.z, { freq: 160, endFreq: 40, duration: 0.9, type: "sawtooth", gain: 0.9 });
      this.shakeCamera(0.35, 0.5);
      this.triggerHitStop(0.12);
    } else {
      this.audio.playTone(pos.x, pos.y + 1, pos.z, { freq: 260, endFreq: 70, duration: 0.4, type: "sine", gain: 0.5 });
    }
  }

  updateCamera(dt = 0) {
    const alpha = Math.min(1, Math.max(0, 1 - Math.exp(-dt / 0.1304)));
    this.lookTarget.copy(this.commanderPosition);
    if (this.previewActionSemantic) {
      const sourcePoint = this.actionFeedbackPoint(this.previewActionSemantic.source);
      const targetPoint = this.actionFeedbackPoint(this.previewActionSemantic.target);
      let biasTarget = targetPoint;
      if (this.previewActionSemantic.target === "commander" && this.previewActionSemantic.source !== "commander") {
        biasTarget = sourcePoint;
      }
      if (biasTarget) {
        const biasVec = new THREE.Vector3(biasTarget.x, biasTarget.y, biasTarget.z);
        this.lookTarget.lerp(biasVec, 0.35);
      }
    } else {
      if (this.boss?.root?.position) this.lookTarget.lerp(this.boss.root.position, 0.22);
    }
    this.cameraTarget.lerp(this.lookTarget, alpha);
    const bounds = this.navigation.bounds;
    this.cameraTarget.x = clamp(this.cameraTarget.x, bounds.left, bounds.right);
    this.cameraTarget.z = clamp(this.cameraTarget.z, bounds.near, bounds.far);
    const horizontal = Math.cos(this.orbitElevation) * this.zoom;
    this.cameraOffset.set(
      Math.cos(this.orbitAzimuth) * horizontal,
      Math.sin(this.orbitElevation) * this.zoom,
      Math.sin(this.orbitAzimuth) * horizontal,
    );
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const strength = this.shakeMagnitude * (this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0);
      const t = performance.now() * 0.001;
      this.camera.position.x += Math.sin((t + this.shakeSeed) * 47) * strength;
      this.camera.position.y += Math.sin((t + this.shakeSeed) * 61) * strength * 0.6;
      this.camera.position.z += Math.cos((t + this.shakeSeed) * 53) * strength;
      if (this.shakeTime === 0) this.shakeMagnitude = 0;
    }
    this.lookTarget.copy(this.cameraTarget);
    this.camera.lookAt(this.lookTarget);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const viewportWidth = Number(window.innerWidth) || rect.width;
    this.renderer.setPixelRatio(cappedPixelRatio(viewportWidth, window.devicePixelRatio));
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  clearPressedInput() {
    this.pressed.clear();
  }

  onKey(event, down) {
    if (document.activeElement !== this.canvas) return;
    const { code } = event;
    if (!MOVE_CODES.has(code) && !SURGE_CODES.has(code)) return;
    if (down) this.pressed.add(code);
    else this.pressed.delete(code);
    if (MOVE_CODES.has(code)) event.preventDefault();
  }

  hasSurge() {
    return this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight");
  }

  setPointerRay(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return true;
  }

  resolvePointerAction(event) {
    if (!this.setPointerRay(event)) return null;
    const hit = this.raycaster.intersectObjects(this.interactives, true)[0];
    let object = hit?.object ?? null;
    while (object && !object.userData.semantic) object = object.parent;
    const action = object?.userData.semantic || null;
    if (!action || !this.getAvailableActions) return action;
    const available = this.getAvailableActions();
    const allowed = typeof available?.has === "function"
      ? available.has(action)
      : available?.includes?.(action);
    return allowed === false ? null : action;
  }

  setHoveredAction(action) {
    const nextAction = action || null;
    this.canvas.style.cursor = nextAction ? "pointer" : "";
    if (nextAction === this.lastHoveredAction) return;
    this.lastHoveredAction = nextAction;
    this.onActionFocus?.(nextAction);
  }

  onPointerDown(event) {
    this.canvas.focus({ preventScroll: true });
    if (this.pointer) return;
    this.pointer = {
      id: event.pointerId,
      type: event.pointerType,
      downTime: event.timeStamp || Date.now(),
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      button: event.button
    };
    this.canvas.setPointerCapture(event.pointerId);

    // Touch down reports only actions that the authoritative campaign currently permits.
    this.setHoveredAction(this.resolvePointerAction(event));
  }

  onPointerMove(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) {
      this.setHoveredAction(this.resolvePointerAction(event));
      return;
    }

    if (!this.pointer.moved) {
      const dxStart = event.clientX - this.pointer.startX;
      const dyStart = event.clientY - this.pointer.startY;
      const distance = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
      const threshold = this.pointer.type === "touch" ? 12 : 6;
      if (distance > threshold) {
        this.pointer.moved = true;
        // Drag just became active, clear hover
        this.clearHover();
      }
    }
    if (!this.pointer.moved) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    this.orbitAzimuth -= dx * 0.008;
    this.orbitElevation = clamp(this.orbitElevation - dy * 0.006, 0.2, 1.25);
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  }

  onPointerUp(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const pointer = this.pointer;
    this.pointer = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);

    this.setHoveredAction(this.resolvePointerAction(event));

    if (pointer.moved) return;
    const upTime = event.timeStamp || Date.now();
    if (upTime - pointer.downTime <= 500) {
      this.pick(event, pointer.button === 2 ? "allies" : "personal");
      this.setHoveredAction(pointer.type === "touch" ? null : this.resolvePointerAction(event));
    }
  }

  onPointerCancel(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.pointer = null;
    this.clearHover();
  }

  onLostPointerCapture(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.pointer = null;
    this.clearHover();
  }

  onPointerLeave(event) {
    this.clearHover();
  }

  onWheel(event) {
    if (document.activeElement !== this.canvas) return;
    event.preventDefault();
    this.zoom = clamp(this.zoom + event.deltaY * 0.012, 9, 30);
  }

  pick(event, rallyKind) {
    if (rallyKind === "personal") {
      const action = this.resolvePointerAction(event);
      if (action) {
        this.requestAction?.(action);
        return;
      }
    } else if (!this.setPointerRay(event)) {
      return;
    }
    const ground = this.raycaster.intersectObject(this.ground, false)[0];
    if (!ground || !this.commander) return;
    
    if (rallyKind === "allies") {
      const resolved = this.resolveMovement(this.commander, ground.point.x, ground.point.z);
      if (resolved.blocked) {
        const hostile = this.presentation?.palette?.hostile ?? "#ff7f79";
        this.particles?.emit(ground.point.x, ground.point.y + 0.1, ground.point.z, hostile, 8, {
          speedMin: 0.5, speedMax: 1.5, life: 0.4, gravity: 3, upBias: 0.2
        });
        this.audio.playTone(ground.point.x, ground.point.y + 0.1, ground.point.z, {
          freq: 150, endFreq: 100, duration: 0.2, type: "sawtooth", gain: 0.4
        });
        return;
      }
      this.rally.set(resolved.x, resolved.y, resolved.z);
    } else {
      const startGrid = this.navigation.worldToGrid(this.commander.root.position.x, this.commander.root.position.z);
      const goalGrid = this.navigation.worldToGrid(ground.point.x, ground.point.z);
      const path = this.navigation.findPath(startGrid, goalGrid);
      if (!path || path.length === 0) {
        const hostile = this.presentation?.palette?.hostile ?? "#ff7f79";
        this.particles?.emit(ground.point.x, ground.point.y + 0.1, ground.point.z, hostile, 8, {
          speedMin: 0.5, speedMax: 1.5, life: 0.4, gravity: 3, upBias: 0.2
        });
        this.audio.playTone(ground.point.x, ground.point.y + 0.1, ground.point.z, {
          freq: 150, endFreq: 100, duration: 0.2, type: "sawtooth", gain: 0.4
        });
        return;
      }
      
      this.commanderPath = path;
      
      const finalCell = path[path.length - 1];
      const finalWorld = this.navigation.gridToWorld(finalCell.x + 0.5, finalCell.y + 0.5);
      const elevation = this.navigation.elevationAt(finalCell.x + 0.5, finalCell.y + 0.5);
      const targetY = elevation * TERRAIN_ELEVATION_SCALE;
      this.commanderOrder = new THREE.Vector3(finalWorld.x, targetY, finalWorld.z);
      
      const accent = this.presentation?.palette?.accent ?? "#ffb85c";
      this.particles?.emit(this.commanderOrder.x, this.commanderOrder.y + 0.1, this.commanderOrder.z, accent, 5, {
        speedMin: 0.5, speedMax: 1.5, life: 0.3, gravity: 2, upBias: 0.5
      });
      this.audio.playTone(this.commanderOrder.x, this.commanderOrder.y + 0.1, this.commanderOrder.z, {
        freq: 600, endFreq: 800, duration: 0.1, type: "sine", gain: 0.3
      });
    }
  }

  applyEncounter({ stageId, config, state } = {}) {
    const waves = Array.isArray(config?.waves) ? config.waves : null;
    const activeWaveId = typeof state?.activeWaveId === "string" ? state.activeWaveId : null;
    const snapshot = JSON.stringify({
      stageId: typeof stageId === "string" ? stageId : null,
      activeWaveId,
      bossExposed: state?.bossExposed === true,
      waves: Array.isArray(state?.waves)
        ? state.waves.map((wave) => ({ id: wave?.id, cleared: wave?.cleared === true, breaches: Number(wave?.breaches) || 0 }))
        : [],
    });
    if (this.encounterSnapshot !== null && this.encounterSnapshot !== snapshot) this.pendingEncounterEvent = null;
    this.encounterSnapshot = snapshot;
    this.encounter = waves ? { stageId, config, state } : null;
    this.bossExposed = state?.bossExposed === true;
    this.reconcileEncounterWave(activeWaveId);
    this.syncBossExposure();
    this.publishRuntimeState();
  }

  applyCampaignState({ campaign, stage, encounter, state } = {}) {
    const config = encounter?.config ?? stage?.encounter ?? null;
    const encounterState = encounter?.state ?? state?.encounter ?? state ?? campaign?.stage?.encounter ?? encounter ?? null;
    const stageId = encounter?.stageId ?? stage?.id ?? campaign?.stageId ?? null;
    this.capturedCount = Number(state?.stage?.nodes ?? state?.nodes ?? campaign?.stage?.nodes ?? this.capturedCount ?? 0);
    const legion = Number(state?.legion ?? campaign?.stage?.legion);
    if (Number.isInteger(legion) && legion >= 0) {
      this.authoritativeLegion = legion;
      this.reconcileAllies(legion);
    }
    const bossHealth = Number(state?.bossHealth ?? campaign?.stage?.bossHealth);
    if (Number.isFinite(bossHealth)) {
      if (bossHealth === 0 && this.lastBossHealth > 0) this.defeat(this.boss);
      this.lastBossHealth = bossHealth;
    }
    this.applyEncounter({ stageId, config, state: encounterState });
    this.updateNodeVisuals();
  }

  reconcileEncounterWave(activeWaveId = this.encounter?.state?.activeWaveId ?? null) {
    const wave = this.encounter?.config?.waves?.find((candidate) => candidate?.id === activeWaveId);
    if (!wave || this.currentWaveId !== wave.id) {
      this.clearEncounterWave();
      if (!wave || !this.scene || !this.templates.has("units/scout.glb")) return;
      this.currentWaveId = wave.id;
      this.spawnEncounterWave(wave);
    }
  }

  retire(instance) {
    const disposed = this.disposedResources;
    instance?.root?.traverse?.((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (material?.userData?.isBossIdentityTint) disposeUnique(material, disposed);
      }
    });
    if (!instance?.mixer) return;
    instance.mixer.stopAllAction();
    instance.mixer.uncacheRoot(instance.root);
    const index = this.mixers.indexOf(instance.mixer);
    if (index >= 0) this.mixers.splice(index, 1);
    instance.actions?.clear();
    instance.active = null;
    instance.root?.removeFromParent();
  }

  resolveSpawn(unit, x, z) {
    const candidates = [{ x, z }];
    for (let distance = 0.3; distance <= 2; distance += 0.3) {
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        candidates.push({ x: x + Math.cos(angle) * distance, z: z + Math.sin(angle) * distance });
      }
    }
    for (const candidate of candidates) {
      this.setGroundedPosition(unit, candidate.x, candidate.z);
      const resolved = this.resolveMovement(unit, candidate.x, candidate.z);
      if (!resolved.blocked) {
        unit.root.position.set(resolved.x, resolved.y, resolved.z);
        return true;
      }
    }
    return false;
  }

  clearEncounterWave() {
    for (const enemy of this.enemies) {
      this.clearEngagement(enemy);
      this.retire(enemy);
    }
    this.enemies.length = 0;
    this.currentWaveId = null;
  }

  createAlly() {
    const ally = this.cloneTemplate("units/shade.glb", 1.15);
    ally.radius = 0.4;
    ally.hp = 3;
    ally.defeated = false;
    const formation = this.allies.length % 3 - 1;
    if (!this.resolveSpawn(ally, this.commanderPosition.x - 0.3, this.commanderPosition.z + formation * 1.1)) {
      this.retire(ally);
      return;
    }
    this.scene.add(ally.root);
    this.allies.push(ally);
    this.play(ally, "Special", true);
  }

  reconcileAllies(count) {
    if (!this.scene || !this.templates.has("units/shade.glb")) return;
    const target = Math.max(0, count);
    const survivors = [];
    for (const ally of this.allies) {
      if (ally.defeated) {
        this.clearEngagement(ally);
        this.retire(ally);
      } else {
        survivors.push(ally);
      }
    }
    this.allies = survivors;
    while (this.allies.length > target) {
      const ally = this.allies.pop();
      this.clearEngagement(ally);
      this.retire(ally);
    }
    while (this.allies.length < target) {
      const before = this.allies.length;
      this.createAlly();
      if (this.allies.length === before) break;
    }
  }

  spawnEncounterWave(wave) {
    const count = Math.max(0, Number(wave?.hostiles) || 0);
    let model = "units/scout.glb";
    if (wave?.id === "guard") model = "units/guard.glb";
    else if (wave?.id === "reinforcement" || wave?.id === "reinforce") model = "units/reinforce.glb";
    if (!this.templates.has(model)) {
      model = "units/scout.glb";
    }
    for (let index = 0; index < count; index += 1) {
      const enemy = this.cloneTemplate(model, 1.2);
      enemy.radius = 0.42;
      
      const routeIndex = index % 3;
      const routeCells = this.navigation.routePath(routeIndex, true);
      const spawnWorld = this.navigation.gridToWorld(routeCells[0].x + 0.5, routeCells[0].y + 0.5);
      
      enemy.detourPreference = this.enemySerial % 2 === 0 ? 1 : -1;
      
      const spawned = this.resolveSpawn(
        enemy,
        spawnWorld.x,
        spawnWorld.z,
      );
      
      enemy.root.rotation.y = -Math.PI / 2;
      this.enemySerial += 1;
      
      if (!spawned) {
        this.retire(enemy);
        continue;
      }
      
      enemy.routeIndex = routeIndex;
      enemy.waypoints = routeCells.map((cell) => {
        const world = this.navigation.gridToWorld(cell.x + 0.5, cell.y + 0.5);
        return new THREE.Vector3(world.x, 0, world.z);
      });
      for (const wp of enemy.waypoints) {
        const nav = this.navigationAt(wp.x, wp.z);
        wp.y = nav.elevation * TERRAIN_ELEVATION_SCALE;
      }
      enemy.waypointIndex = 0;
      
      enemy.hp = Math.max(1, Number(wave.hostileHealth) || 2);
      enemy.archetype = wave.id;
      
      enemy.defeated = false;
      enemy.breachVisualized = false;
      this.scene.add(enemy.root);
      this.enemies.push(enemy);
      this.play(enemy, "Move");
    }
  }

  emitEncounterEvent(type) {
    const waveId = this.currentWaveId;
    const stageId = this.encounter?.stageId;
    if (
      this.pendingEncounterEvent ||
      (type !== "wave-cleared" && type !== "breach") ||
      !waveId ||
      typeof stageId !== "string" ||
      this.encounter?.state?.activeWaveId !== waveId
    ) return;
    this.pendingEncounterEvent = { type, stageId, waveId };
    if (this.onEncounterEvent) this.onEncounterEvent(this.pendingEncounterEvent);
    else if (type === "breach") this.onEnemyBreach?.();
  }

  syncBossExposure() {
    if (!this.boss?.root) return;
    this.boss.root.visible = this.bossExposed;
    this.boss.root.userData.semantic = this.bossExposed ? "assault" : null;
  }

  activeEngagements() {
    let count = 0;
    for (const ally of this.allies) {
      const enemy = this.engagements.get(ally);
      if (enemy && this.engagements.get(enemy) === ally && this.liveAlly(ally) && this.liveEnemy(enemy)) count += 1;
    }
    return count;
  }

  resolvedWaveCount() {
    let resolved = 0;
    for (const wave of this.encounter?.state?.waves ?? []) {
      if (wave?.cleared === true) resolved += 1;
    }
    return resolved;
  }

  visibleAllyCount() {
    let visible = 0;
    for (const ally of this.allies) {
      if (!ally.defeated) visible += 1;
    }
    return visible;
  }

  getRuntimeState() {
    return {
      mode: "realtime-3d",
      enemiesActive: this.enemies.length,
      alliesVisible: this.visibleAllyCount(),
      engagements: this.activeEngagements(),
      exchanges: this.exchanges,
      activeWaveId: this.encounter?.state?.activeWaveId ?? null,
      resolved: this.resolvedWaveCount(),
      total: this.encounter?.config?.waves?.length ?? 0,
      bossExposed: this.bossExposed,
    };
  }

  publishRuntimeState() {
    const enemiesActive = this.enemies.length;
    const alliesVisible = this.visibleAllyCount();
    const engagements = this.activeEngagements();
    const activeWaveId = this.encounter?.state?.activeWaveId ?? null;
    const resolved = this.resolvedWaveCount();
    const total = this.encounter?.config?.waves?.length ?? 0;
    const signature = `${enemiesActive}|${alliesVisible}|${engagements}|${this.exchanges}|${activeWaveId ?? ""}|${resolved}|${total}|${this.bossExposed ? 1 : 0}`;
    if (signature === this.runtimeSignature) return;
    this.runtimeSignature = signature;
    this.onRuntimeState?.({
      mode: "realtime-3d",
      enemiesActive,
      alliesVisible,
      engagements,
      exchanges: this.exchanges,
      activeWaveId,
      resolved,
      total,
      bossExposed: this.bossExposed,
    });
  }

  // Compatibility wrapper: visual effects must not establish or remove encounter units.
  spawnEnemy() {
    this.playActionEffect({ action: "hunt", source: "portal", target: "extractor" });
  }

  // Action feedback is renderer-local: it communicates a command that
  // campaign-state.js has already accepted, but never establishes units,
  // encounters, rewards, damage, or player orders.
  actionFeedbackPoint(point) {
    if (point === "portal") return this.portal?.position ?? this.commanderPosition;
    if (point === "extractor") {
      const extractor = this.navigation.anchors.extractor;
      const position = this.navigation.gridToWorld(extractor.x, extractor.y);
      return { x: position.x, y: this.navigationAt(position.x, position.z).elevation * TERRAIN_ELEVATION_SCALE, z: position.z };
    }
    if (point === "node") return this.node?.position ?? this.commanderPosition;
    if (point === "ally") return this.allies.find((candidate) => this.liveAlly(candidate))?.root?.position ?? this.commanderPosition;
    if (point === "boss") return this.boss?.root?.position ?? this.commanderPosition;
    return this.commander?.root?.position ?? this.commanderPosition;
  }
  actionFeedbackActor(actor) {
    if (actor === "ally") return this.allies.find((candidate) => this.liveAlly(candidate)) ?? this.commander;
    if (actor === "boss") return this.boss;
    return this.commander;
  }

  pulseActionMarker(point) {
    if (point === "portal") this.portalPulse = Math.max(this.portalPulse, 2.15);
    if (point === "node") this.nodePulse = Math.max(this.nodePulse, 2.15);
  }

  actionFeedbackProfile(action) {
    const palette = this.presentation?.palette ?? {};
    const ally = palette.ally ?? "#70e5d0";
    const accent = palette.accent ?? "#ffb85c";
    const hostile = palette.hostile ?? "#ff7f79";
    const profile = {
      hunt: { color: accent, count: 12, gain: 0.52 },
      extract: { color: ally, count: 14, gain: 0.58 },
      materialize: { color: ally, count: 20, gain: 0.7 },
      capture: { color: accent, count: 18, gain: 0.66 },
      possess: { color: accent, count: 16, gain: 0.62 },
      domain: { color: accent, count: 24, gain: 0.74 },
      assault: { color: hostile, count: 28, gain: 0.78 },
    }[action];
    return profile ? { action, ...profile } : null;
  }

  emitActionFeedback(semantic = {}) {
    const profile = this.actionFeedbackProfile(semantic.action);
    if (!profile) return null;
    const source = this.actionFeedbackPoint(semantic.source);
    const target = this.actionFeedbackPoint(semantic.target);
    const { action, color, count, gain } = profile;
    this.pulseActionMarker(semantic.source);
    this.pulseActionMarker(semantic.target);
    const sourceCount = Math.max(4, Math.floor(count * 0.42));
    const emit = (position, amount) => this.particles?.emit(position.x, position.y + 0.72, position.z, color, amount, {
      speedMin: 0.8,
      speedMax: action === "assault" ? 4.4 : 2.9,
      life: action === "domain" ? 0.9 : 0.58,
      gravity: action === "domain" ? -0.45 : 2.4,
      upBias: action === "assault" ? 0.45 : 0.9,
    });
    emit(source, sourceCount);
    if (source.x !== target.x || source.y !== target.y || source.z !== target.z) emit(target, count);
    else emit(target, count - sourceCount);
    this.audio.playSample(action, source.x, source.y + 0.72, source.z, gain);
    if (source.x !== target.x || source.y !== target.y || source.z !== target.z) {
      this.audio.playTone(target.x, target.y + 0.72, target.z, {
        freq: action === "assault" ? 170 : 420,
        endFreq: action === "assault" ? 90 : 760,
        duration: 0.16,
        type: action === "assault" ? "sawtooth" : "sine",
        gain: gain * 0.4,
      });
    }
    if (action === "assault") {
      this.shakeCamera(0.12, 0.18);
      this.triggerHitStop(0.06);
    }
    return { action, source, target };
  }

  playActionEffect(semantic = {}) {
    const action = semantic?.action;
    if (!action || this.destroyed) return;
    this.emitActionFeedback(semantic);
    const actor = this.actionFeedbackActor(semantic.actor);
    if (actor) this.play(actor, semantic.actorClip ?? semantic.clip ?? "Special", true);
    if (action === "assault" && this.bossExposed && this.boss && !this.boss.defeated) this.play(this.boss, "Attack", true);
    if (action === "possess" || action === "domain") this.rally.copy(this.commanderPosition);
  }

  triggerAction(semantic) {
    this.playActionEffect(semantic);
  }

  clearHover() {
    if (this.canvas && this.canvas.style) {
      this.canvas.style.cursor = "";
    }
    if (this.lastHoveredAction !== null) {
      this.lastHoveredAction = null;
      this.onActionFocus?.(null);
    }
  }

  resetPreviewEmphasis() {
    const root = this.boss?.root;
    if (!root?.userData || !Object.prototype.hasOwnProperty.call(root.userData, "originalScaleScalar")) return;
    root.scale.setScalar(root.userData.originalScaleScalar);
    delete root.userData.originalScaleScalar;
    root.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!Object.prototype.hasOwnProperty.call(material?.userData ?? {}, "previewOriginalEmissiveIntensity")) continue;
        material.emissiveIntensity = material.userData.previewOriginalEmissiveIntensity;
        delete material.userData.previewOriginalEmissiveIntensity;
      }
    });
  }

  previewAction(semantic) {
    if (!semantic?.action) {
      this.clearActionPreview();
      return;
    }
    if (this.previewActionSemantic?.action !== semantic.action) this.resetPreviewEmphasis();
    this.previewActionSemantic = semantic;
  }

  clearActionPreview(action = null) {
    if (action && this.previewActionSemantic?.action !== action) return;
    this.previewActionSemantic = null;
    this.resetPreviewEmphasis();
  }

  updatePreviewEmphasis() {
    const semantic = this.previewActionSemantic;
    if (!semantic) {
      this.resetPreviewEmphasis();
      return;
    }

    const targets = [semantic.source, semantic.target];
    if (!targets.includes("boss")) this.resetPreviewEmphasis();
    const time = performance.now() * 0.005;
    const pulseFactor = 1.0 + Math.sin(time * 12.0) * 0.12;

    if (targets.includes("portal") && this.portal) {
      this.portalPulse = Math.max(this.portalPulse, 2.5 + Math.sin(time * 12.0) * 0.5);
    }
    if (targets.includes("node") && this.node) {
      this.nodePulse = Math.max(this.nodePulse, 2.5 + Math.sin(time * 12.0) * 0.5);
    }
    if (targets.includes("boss") && this.boss && this.boss.root) {
      if (!this.boss.root.userData.originalScaleScalar) {
        this.boss.root.userData.originalScaleScalar = this.boss.root.scale.x;
      }
      this.boss.root.scale.setScalar(this.boss.root.userData.originalScaleScalar * pulseFactor);
      
      this.boss.root.traverse((node) => {
        if (node.isMesh) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if (!material?.userData?.isBossIdentityTint) continue;
            if (!Object.prototype.hasOwnProperty.call(material.userData, "previewOriginalEmissiveIntensity")) {
              material.userData.previewOriginalEmissiveIntensity = material.emissiveIntensity;
            }
            material.emissiveIntensity = 1.2 + Math.sin(time * 12.0) * 0.4;
          }
        }
      });
    }
  }

  setHud(hud) {
    this.hud = hud;
  }

  onVisibility() {
    if (document.hidden) {
      this.clearPressedInput();
      this.clearHover();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.running && !this.raf) {
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame(this.rafCallback);
    }
  }

  onContextLost(event) {
    event.preventDefault();
    this.destroy();
    this.onAssetStatus?.({ state: "unavailable" });
    this.onRendererFailure?.();
  }

  destroy() {
    if (this.destroyed) return;
    this.clearHover();
    this.clearActionPreview();
    this.destroyed = true;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.bound.visibility);
    globalThis.window?.removeEventListener("blur", this.bound.blur);
    this.canvas.removeEventListener("webglcontextlost", this.bound.contextLost);
    this.canvas.removeEventListener("keydown", this.bound.keydown);
    this.canvas.removeEventListener("keyup", this.bound.keyup);
    this.canvas.removeEventListener("blur", this.bound.blur);
    this.canvas.removeEventListener("pointerdown", this.bound.pointerdown);
    this.canvas.removeEventListener("pointermove", this.bound.pointermove);
    this.canvas.removeEventListener("pointerup", this.bound.pointerup);
    this.canvas.removeEventListener("pointercancel", this.bound.pointercancel);
    this.canvas.removeEventListener("lostpointercapture", this.bound.lostpointercapture);
    this.canvas.removeEventListener("pointerleave", this.bound.pointerleave);
    this.canvas.removeEventListener("contextmenu", this.bound.contextmenu);
    this.canvas.removeEventListener("wheel", this.bound.wheel);
    this.clearEncounterWave();
    for (const ally of this.allies) this.retire(ally);
    this.allies.length = 0;
    this.retire(this.commander);
    this.retire(this.boss);
    for (const mixer of this.mixers) mixer.stopAllAction();
    this.mixers.length = 0;
    this.staticBlockers.length = 0;
    this.particles?.dispose();
    if (this.keyLight) {
      this.keyLight.shadow?.dispose?.();
      this.keyLight = null;
    }
    this.fillLight = null;
    this.rimLight = null;
    if (this.ringGeometry) {
      disposeUnique(this.ringGeometry, this.disposedResources);
      this.ringGeometry = null;
    }
    if (this.routeLines) {
      for (const line of this.routeLines) {
        disposeObjectResources(line, this.disposedResources);
      }
      this.routeLines = null;
    }
    if (this.deckGeometry) {
      disposeUnique(this.deckGeometry, this.disposedResources);
      this.deckGeometry = null;
    }
    if (this.deckMaterial) {
      disposeMaterialResources(this.deckMaterial, this.disposedResources);
      this.deckMaterial = null;
    }
    if (this.deckMesh) {
      disposeObjectResources(this.deckMesh, this.disposedResources);
      this.deckMesh = null;
    }
    const roots = [
      ...[...this.templates.values()].map((template) => template?.scene),
      this.scene,
      this.terrain,
      this.ground,
      this.portal,
      ...this.nodes,
    ];
    if (this.node && !this.nodes.includes(this.node)) {
      roots.push(this.node);
    }
    for (const root of roots) disposeObjectResources(root, this.disposedResources);
    this.renderer?.dispose();
    this.audio?.dispose();
    this.templates.clear();
  }
}
