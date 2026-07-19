import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { RealtimeBattle } from "../battle-realtime-three.js";

function makeRoot(x = 0, z = 0) {
  return {
    removed: false,
    position: {
      x,
      y: 0,
      z,
      set(nextX, nextY, nextZ) {
        this.x = nextX;
        this.y = nextY;
        this.z = nextZ;
        return this;
      },
    },
    userData: {},
    removeFromParent() {
      this.removed = true;
    },
  };
}

function makeUnit({ x = 0, z = 0, hp = 2, hit = 0 } = {}) {
  return { root: makeRoot(x, z), hp, hit, cooldown: 0, defeated: false };
}

function makeRetirableMixer() {
  return {
    stopped: 0,
    uncachedRoots: [],
    stopAllAction() {
      this.stopped += 1;
    },
    uncacheRoot(root) {
      this.uncachedRoots.push(root);
    },
    uncacheAction() {},
  };
}
async function initializeRendererPresentation() {
  const source = await readFile(new URL("../battle-realtime-three.js", import.meta.url), "utf8");
  const definition = source.match(/  async init\(\) \{[\s\S]*?\n  \}(?=\n\n  attachEvents\(\))/);
  assert.ok(definition, "renderer module must expose its initialization behavior");

  class Vector3 {
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }
  class WebGLRenderer {
    constructor(options) {
      this.options = options;
      this.shadowMap = {};
    }
    setPixelRatio(value) { this.pixelRatio = value; }
    setClearColor(color, alpha) { this.clearColor = { color, alpha }; }
  }
  class Scene {
    constructor() { this.children = []; }
    add(...children) { this.children.push(...children); }
  }
  class FogExp2 {
    constructor(color, density) {
      this.color = color;
      this.density = density;
    }
  }
  class PerspectiveCamera {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class HemisphereLight {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class DirectionalLight {
    constructor(...parameters) {
      this.parameters = parameters;
      this.position = new Vector3();
      this.shadow = { mapSize: {}, camera: {} };
    }
  }
  class PlaneGeometry {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class MeshStandardMaterial {
    constructor(parameters) { this.parameters = parameters; }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.rotation = {};
      this.userData = {};
    }
  }
  class RingGeometry {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class ParticleField {}

  const THREE = {
    ACESFilmicToneMapping: Symbol("ACESFilmicToneMapping"),
    PCFSoftShadowMap: Symbol("PCFSoftShadowMap"),
    SRGBColorSpace: Symbol("SRGBColorSpace"),
    WebGLRenderer,
    Scene,
    FogExp2,
    PerspectiveCamera,
    HemisphereLight,
    DirectionalLight,
    PlaneGeometry,
    MeshStandardMaterial,
    Mesh,
    RingGeometry,
  };
  const context = vm.createContext({
    THREE,
    ParticleField,
    cappedPixelRatio: (_width, devicePixelRatio) => devicePixelRatio,
    FILL_LIGHT_INTENSITY: 0.65,
    FOG_DENSITY: 0.015,
    RIM_LIGHT_INTENSITY: 0.85,
    SHADOW_BIAS: -0.0008,
    SHADOW_CAMERA_FAR: 40,
    SHADOW_CAMERA_NEAR: 0.5,
    SHADOW_CAMERA_SIZE: 18,
    SHADOW_MAP_SIZE: 1024,
    TONE_MAPPING_EXPOSURE: 1.05,
    Number,
    performance: { now: () => 100 },
    requestAnimationFrame: () => 1,
    window: { devicePixelRatio: 2 },
  });
  const executable = definition[0].replace(/^  async init\(\)/, "async function init()");
  vm.runInContext(`${executable}\nglobalThis.initialize = init;`, context, { filename: "battle-realtime-three.js" });

  const webgl2Context = {};
  const contextRequests = [];
  const canvas = {
    getContext(...args) {
      contextRequests.push(args);
      return args[0] === "webgl2" ? webgl2Context : null;
    },
  };
  const battle = {
    canvas,
    presentation: {
      palette: { accent: "#f0a040", ally: "#70e5d0", background: "#101827" },
    },
    destroyed: false,
    authoritativeLegion: null,
    navigation: { bounds: { left: -12, right: 12, near: -6, far: 6 } },
    raycaster: {},
    attachEvents() {},
    updateCamera() {},
    resize() {},
    async loadStageAssets() {},
    createBattleObjects() {},
    reconcileEncounterWave() {},
    syncBossExposure() {},
    publishRuntimeState() {},
    frame() {},
  };
  await context.initialize.call(battle);
  return { battle, THREE, types: { FogExp2, RingGeometry }, canvas, contextRequests, webgl2Context };
}

test("RealtimeBattle initialization applies atmospheric rendering and configured tactical markers", async () => {
  const { battle, THREE, types, canvas, contextRequests, webgl2Context } = await initializeRendererPresentation();
  assert.equal(contextRequests.length, 1, "realtime initialization must make exactly one context request");
  const [contextType, contextAttributes] = contextRequests[0];
  assert.equal(contextType, "webgl2", "realtime initialization must require WebGL2");
  assert.deepEqual(
    Object.fromEntries(Object.entries(contextAttributes)),
    { antialias: true, alpha: false },
    "realtime initialization must request the hardened opaque antialiased context",
  );
  assert.equal(battle.renderer.options.canvas, canvas, "WebGLRenderer must receive the battle canvas");
  assert.equal(
    battle.renderer.options.context,
    webgl2Context,
    "WebGLRenderer must receive the exact context returned by the battle canvas",
  );

  assert.equal(battle.renderer.toneMapping, THREE.ACESFilmicToneMapping, "realtime rendering must use ACES filmic tone mapping");
  assert.deepEqual(
    { enabled: battle.renderer.shadowMap.enabled, type: battle.renderer.shadowMap.type },
    { enabled: true, type: THREE.PCFSoftShadowMap },
    "realtime rendering must enable PCF soft shadows",
  );
  assert.equal(battle.scene.fog instanceof types.FogExp2, true, "realtime rendering must use exponential atmospheric fog");
  assert.equal(battle.scene.fog.color, "#101827", "fog must use the active stage background palette");
  assert.equal(battle.ground.receiveShadow, true, "the tactical ground must receive unit and marker shadows");

  const shadowCamera = battle.keyLight.shadow.camera;
  assert.ok(shadowCamera.near > 0 && shadowCamera.far > shadowCamera.near, "shadow camera must define a positive near/far depth range");
  assert.equal(shadowCamera.left, -shadowCamera.right, "shadow camera must cover equal left and right tactical extents");
  assert.equal(shadowCamera.bottom, -shadowCamera.top, "shadow camera must cover equal top and bottom tactical extents");
  assert.ok(
    battle.keyLight.shadow.mapSize.width > 0
      && battle.keyLight.shadow.mapSize.width === battle.keyLight.shadow.mapSize.height,
    "directional shadows must use a nonzero square map",
  );
  assert.equal(battle.ringGeometry instanceof types.RingGeometry, true, "tactical markers must use ring geometry");
  assert.deepEqual(
    battle.ringGeometry.parameters,
    [0.8, 1.1, 16],
    "marker rings must retain a visible annulus with enough segments to read as circular",
  );
});

test("RealtimeBattle resize reapplies DPR tiers without changing the canvas dimensions or skipping projection updates", () => {
  const canvasRect = { width: 960, height: 540 };
  const pixelRatios = [];
  const canvasSizes = [];
  const camera = {
    aspect: 0,
    projectionUpdates: 0,
    updateProjectionMatrix() {
      this.projectionUpdates += 1;
    },
  };
  const canvas = {
    getBoundingClientRect() {
      return canvasRect;
    },
  };
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const viewport = { devicePixelRatio: 3, innerWidth: 901 };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: viewport,
  });

  try {
    const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
    battle.renderer = {
      setPixelRatio(value) {
        pixelRatios.push(value);
      },
      setSize(width, height, updateStyle) {
        canvasSizes.push([width, height, updateStyle]);
      },
    };
    battle.camera = camera;

    for (const innerWidth of [901, 900, 481, 480]) {
      viewport.innerWidth = innerWidth;
      battle.resize();
    }

    assert.deepEqual(
      pixelRatios,
      [2, 1.5, 1.5, 1.25],
      "crossing the desktop and mobile width boundaries must reapply the matching DPR cap",
    );
    assert.deepEqual(
      canvasSizes,
      [
        [960, 540, false],
        [960, 540, false],
        [960, 540, false],
        [960, 540, false],
      ],
      "DPR tier changes must preserve the measured canvas dimensions and CSS size",
    );
    assert.equal(camera.aspect, 16 / 9, "resize must preserve the canvas aspect ratio in the camera");
    assert.equal(
      camera.projectionUpdates,
      4,
      "every threshold-crossing resize must publish the updated camera projection",
    );
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
  }
});


test("RealtimeBattle safely ignores playback requests from clip-less runtime bindings", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  assert.doesNotThrow(
    () => battle.play({}),
    "a runtime binding that has not exposed animation clips must not break the command feedback path",
  );
});

test("RealtimeBattle clears held keyboard movement on canvas, window, and hidden-document focus loss without cancelling click-to-move", () => {
  const canvasListeners = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const listeners = (target) => ({
    addEventListener(type, handler) {
      target.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (target.get(type) === handler) target.delete(type);
    },
  });
  const canvas = listeners(canvasListeners);
  const document = { ...listeners(documentListeners), activeElement: canvas, hidden: false };
  const window = listeners(windowListeners);
  const descriptors = new Map(
    ["document", "window", "ResizeObserver"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  Object.assign(globalThis, {
    document,
    window,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });

  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  const commanderOrder = { x: 4, y: 0, z: -2 };
  const pressMovement = () => {
    document.activeElement = canvas;
    canvasListeners.get("keydown")({ code: "KeyW", preventDefault() {} });
    assert.deepEqual([...battle.pressed], ["KeyW"], "the movement key must be held before focus is lost");
  };
  const assertClearedWithoutCancellingOrder = (source, loseFocus) => {
    battle.commanderOrder = commanderOrder;
    pressMovement();
    loseFocus();
    assert.deepEqual([...battle.pressed], [], `${source} focus loss must clear held keyboard movement`);
    assert.strictEqual(
      battle.commanderOrder,
      commanderOrder,
      `${source} focus loss must preserve the active click-to-move commander order`,
    );
  };

  try {
    battle.attachEvents();
    assert.equal(typeof canvasListeners.get("blur"), "function", "the canvas must clear input when it loses focus");
    assert.equal(typeof windowListeners.get("blur"), "function", "the browser window must clear input when it loses focus");

    assertClearedWithoutCancellingOrder("canvas", () => {
      document.activeElement = null;
      canvasListeners.get("blur")();
    });
    assertClearedWithoutCancellingOrder("window", () => {
      document.activeElement = null;
      windowListeners.get("blur")();
    });
    assertClearedWithoutCancellingOrder("hidden document", () => {
      document.hidden = true;
      documentListeners.get("visibilitychange")();
      document.hidden = false;
    });
  } finally {
    battle.destroy();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("RealtimeBattle projects WebGL pointer focus and clears it on cancellation, pointer exit, and canvas blur", () => {
  const canvasListeners = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const listeners = (target) => ({
    addEventListener(type, handler) {
      target.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (target.get(type) === handler) target.delete(type);
    },
  });
  const canvas = {
    ...listeners(canvasListeners),
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const document = { ...listeners(documentListeners), activeElement: canvas, hidden: false };
  const window = listeners(windowListeners);
  const descriptors = new Map(
    ["document", "window", "ResizeObserver"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  Object.assign(globalThis, {
    document,
    window,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });

  let availableActions = ["materialize"];
  const requestedActions = [];
  const focusedActions = [];
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1 },
    {
      getAvailableActions: () => availableActions,
      onActionRequest: (action) => {
        requestedActions.push(action);
        availableActions = [];
      },
      onActionFocus: (action) => focusedActions.push(action),
    },
  );
  const semanticRoot = { userData: { semantic: "materialize" }, parent: null };
  const semanticChild = { userData: {}, parent: semanticRoot };
  let hit = true;
  battle.camera = {};
  battle.raycaster = {
    setFromCamera() {},
    intersectObjects: () => (hit ? [{ object: semanticChild }] : []),
  };
  battle.interactives = [semanticRoot];

  try {
    battle.attachEvents();
    const pointer = {
      button: 0,
      clientX: 50,
      clientY: 50,
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 10,
    };

    canvasListeners.get("pointermove")(pointer);
    canvasListeners.get("pointermove")(pointer);
    hit = false;
    canvasListeners.get("pointermove")(pointer);
    const passiveHover = focusedActions.splice(0);

    hit = true;
    canvasListeners.get("pointerdown")(pointer);
    canvasListeners.get("pointercancel")(pointer);
    const pointercancel = focusedActions.splice(0);

    canvasListeners.get("pointermove")(pointer);
    canvasListeners.get("pointerleave")(pointer);
    const pointerleave = focusedActions.splice(0);

    canvasListeners.get("pointermove")(pointer);
    canvasListeners.get("blur")();
    const blur = focusedActions.splice(0);

    canvasListeners.get("pointerdown")(pointer);
    canvasListeners.get("pointerup")(pointer);
    const acceptedAction = focusedActions.splice(0);

    assert.deepEqual(
      { passiveHover, pointercancel, pointerleave, blur },
      {
        passiveHover: ["materialize", null],
        pointercancel: ["materialize", null],
        pointerleave: ["materialize", null],
        blur: ["materialize", null],
      },
      "WebGL focus callbacks must deduplicate stable hover and clear every command/dossier projection when interaction focus exits",
    );
    assert.deepEqual(requestedActions, ["materialize"], "eligible personal pointerup must dispatch the focused action");
    assert.equal(
      acceptedAction.at(-1),
      null,
      "accepted pointer action must refresh availability and clear stale WebGL focus after synchronous dispatch",
    );
  } finally {
    battle.destroy();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("RealtimeBattle previewAction accepts the action-enriched DOM semantic and clears it through the renderer seam", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const semantic = Object.freeze({
    action: "hunt",
    source: "portal",
    target: "extractor",
    actor: "commander",
    actorClip: "Special",
    sourceAsset: "shade",
    clip: "Special",
  });

  battle.previewAction(semantic);
  assert.strictEqual(
    battle.previewActionSemantic,
    semantic,
    "DOM pointer or keyboard focus must project the exact action-enriched semantic supplied by the app bridge",
  );

  battle.clearActionPreview();
  assert.equal(battle.previewActionSemantic, null, "DOM pointerout or blur must clear the renderer preview");
});

test("RealtimeBattle placement validation preserves the active deployment kind", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const receivedKinds = [];
  battle.navigation = {
    width: 24,
    height: 12,
    validateDeployment(_x, _y, _deployments, kind) {
      receivedKinds.push(kind);
      return { valid: kind === "tower" };
    },
  };

  battle.placementMode = "tower";
  assert.equal(battle.isPlacementLegal(8, 2), true, "tower preview must use tower route-blocking semantics");
  battle.placementMode = "barricade";
  assert.equal(battle.isPlacementLegal(8, 2), false, "barricade preview must use barricade route-blocking semantics");
  assert.deepEqual(receivedKinds, ["tower", "barricade"], "each WebGL preview must pass its current kind to the shared validator");
});

test("RealtimeBattle external focus is callback-pure and publishes minimap-compatible tactical state", () => {
  const tacticalRequests = [];
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 1 },
    { onTacticalRequest: (request) => tacticalRequests.push(request) },
  );
  battle.updateFocusHighlight = () => {};
  const navigation = battle.navigation;
  battle.cachedNavigationSnapshot = {
    width: navigation.width,
    height: navigation.height,
    cells: navigation.cells,
    routes: navigation.routes.map(({ id, lane, cells }) => ({ id, lane, cells })),
    zones: navigation.zones.map(({ kind, cells }) => ({ kind, cells })),
    anchors: {
      portal: navigation.anchors.portal,
      boss: navigation.anchors.boss,
      extractor: navigation.anchors.extractor,
      rally: navigation.anchors.rally,
      alliedSpawn: navigation.anchors.alliedSpawn,
      nodes: navigation.anchors.nodes,
      hostileSpawns: navigation.anchors.hostileSpawns,
    },
  };
  battle.commander = { ...makeUnit({ x: -4, z: 0, hp: 3 }), id: "commander" };
  battle.allies = [{ ...makeUnit({ x: -2, z: 1, hp: 2 }), id: "ally-1" }];
  battle.enemies = [{ ...makeUnit({ x: 4, z: -1, hp: 2 }), id: "enemy-1" }];
  battle.deploymentsMap.set("tower-1", { id: "tower-1", kind: "tower", gridX: 8, gridY: 5 });

  battle.focusTacticalCell({ x: 8, y: 5 });
  const snapshot = battle.getTacticalSnapshot();

  assert.deepEqual(tacticalRequests, [], "applying minimap focus must not re-enter the tactical request callback");
  assert.deepEqual(
    {
      stageNumber: snapshot.stageNumber,
      navigationSize: [snapshot.navigation.width, snapshot.navigation.height],
      focus: snapshot.focus,
      units: snapshot.units,
      deployments: snapshot.deployments,
    },
    {
      stageNumber: 1,
      navigationSize: [24, 12],
      focus: { x: 8, y: 5 },
      units: [
        { id: "commander", team: 1, x: -4, z: 0, hp: 3 },
        { id: "ally-1", team: 1, x: -2, z: 1, hp: 2 },
        { id: "enemy-1", team: 2, x: 4, z: -1, hp: 2 },
      ],
      deployments: [{ id: "tower-1", kind: "tower", x: 8, y: 5 }],
    },
    "the WebGL snapshot must retain the navigation, world-unit, deployment, and focus fields consumed by the minimap",
  );
});

test("RealtimeBattle selected-unit orders follow the shared Stage 1 route around void", () => {
  const tacticalRequests = [];
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1 },
    { onTacticalRequest: (request) => tacticalRequests.push(request) },
  );
  const startCell = {
    x: Math.floor(battle.navigation.anchors.alliedSpawn.x),
    y: Math.floor(battle.navigation.anchors.alliedSpawn.y),
  };
  const targetCell = { x: 12, y: 2 };
  const authoredPath = battle.navigation.findPath(startCell, targetCell);
  const directCrossesVoid = Array.from({ length: 101 }, (_, step) => {
    const progress = step / 100;
    const x = startCell.x + 0.5 + (targetCell.x - startCell.x) * progress;
    const y = startCell.y + 0.5 + (targetCell.y - startCell.y) * progress;
    return !battle.navigation.walkable(x, y);
  }).some(Boolean);
  assert.ok(authoredPath && authoredPath.length > 2, "the Stage 1 fixture must expose a nontrivial shared route");
  assert.equal(directCrossesVoid, true, "the Stage 1 fixture's direct start-to-target segment must cross void");

  const startWorld = battle.navigation.gridToWorld(
    battle.navigation.anchors.alliedSpawn.x,
    battle.navigation.anchors.alliedSpawn.y,
  );
  const commanderWorld = battle.navigation.gridToWorld(3.5, 5.5);
  const targetWorld = battle.navigation.gridToWorld(targetCell.x + 0.5, targetCell.y + 0.5);
  battle.camera = {};
  battle.ground = {};
  battle.commander = makeUnit({ x: commanderWorld.x, z: commanderWorld.z });
  const ally = makeUnit({ x: startWorld.x, z: startWorld.z });
  battle.allies = [ally];
  battle.selection.add(ally);
  battle.raycaster = {
    setFromCamera() {},
    intersectObjects: () => [],
    intersectObject: () => [{ point: { x: targetWorld.x, y: 0, z: targetWorld.z } }],
  };
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  battle.play = () => {};
  const pointer = {
    button: 2,
    clientX: 50,
    clientY: 50,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 10,
  };

  battle.onPointerDown(pointer);
  battle.onPointerUp(pointer);

  assert.deepEqual(tacticalRequests, [], "selected-unit movement must remain renderer-local");

  const visitedCells = new Set();
  let reachedTarget = false;
  for (let step = 0; step < 1200; step += 1) {
    battle.updateAllies(1 / 30);
    const cell = battle.navigation.worldToGrid(ally.root.position.x, ally.root.position.z);
    visitedCells.add(`${Math.floor(cell.x)},${Math.floor(cell.y)}`);
    if (Math.hypot(ally.root.position.x - targetWorld.x, ally.root.position.z - targetWorld.z) <= 0.16) {
      reachedTarget = true;
      break;
    }
  }

  assert.equal(reachedTarget, true, "the selected ally must reach the authored target instead of stopping at the void");
  assert.ok(visitedCells.size > 2, "the accepted order must traverse a nontrivial multi-cell route");
});




test("RealtimeBattle uses the unit Strike vocabulary for scout attacks", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const scout = makeUnit({ x: 2 });
  const target = makeUnit();
  const played = [];
  battle.play = (unit, clip, once) => played.push({ unit, clip, once });

  battle.enemyStrike(scout, target, 2);

  assert.equal(
    played.find(({ unit }) => unit === scout)?.clip,
    "Strike",
    "a scout uses the unit's exported Strike clip rather than a boss-only Attack clip",
  );
});

test("RealtimeBattle starts one-shot Defeat playback once when non-commander actors become defeated", () => {
  const enemyBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const enemyCommander = makeUnit();
  const ally = makeUnit();
  const enemy = makeUnit({ hp: 1 });
  const enemyPlays = [];
  enemyBattle.commander = enemyCommander;
  enemyBattle.allies = [ally];
  enemyBattle.enemies = [enemy];
  enemyBattle.engagements.set(ally, enemy);
  enemyBattle.engagements.set(enemy, ally);
  enemyBattle.play = (unit, clip, once) => enemyPlays.push({ unit, clip, once });

  enemyBattle.updateEngagements(1);
  enemyBattle.updateEngagements(1);

  const allyBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const allyCommander = makeUnit();
  const scout = makeUnit({ x: 2 });
  const defeatedAlly = makeUnit({ hit: 2 });
  const allyPlays = [];
  allyBattle.commander = allyCommander;
  allyBattle.allies = [defeatedAlly];
  allyBattle.enemies = [scout];
  allyBattle.engagements.set(defeatedAlly, scout);
  allyBattle.engagements.set(scout, defeatedAlly);
  allyBattle.play = (unit, clip, once) => allyPlays.push({ unit, clip, once });

  allyBattle.updateEngagements(2);
  allyBattle.updateEngagements(2);

  assert.equal(enemy.defeated, true, "lethal allied damage marks the enemy defeated");
  assert.equal(defeatedAlly.defeated, true, "the third scout hit marks a non-commander ally defeated");
  assert.deepEqual(
    enemyPlays.filter(({ clip }) => clip === "Defeat"),
    [{ unit: enemy, clip: "Defeat", once: true }],
    "a defeated enemy must start one finite Defeat clip and never restart it on later updates",
  );
  assert.deepEqual(
    allyPlays.filter(({ clip }) => clip === "Defeat"),
    [{ unit: defeatedAlly, clip: "Defeat", once: true }],
    "a defeated non-commander ally must start one finite Defeat clip and never restart it on later updates",
  );
});

test("RealtimeBattle keeps Defeat on a lethally assaulted exposed boss while live exposed bosses still Attack", () => {
  const lethalBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const lethalBoss = makeUnit({ hp: 16 });
  const lethalPlays = [];
  lethalBattle.boss = lethalBoss;
  lethalBattle.play = (unit, clip, once) => lethalPlays.push({ unit, clip, once });

  lethalBattle.applyCampaignState({ state: { legion: 0, bossHealth: 16, bossExposed: true } });
  lethalBattle.applyCampaignState({ state: { legion: 0, bossHealth: 0, bossExposed: true } });
  lethalBattle.playActionEffect({ action: "assault", source: "boss", target: "commander" });

  assert.equal(lethalBoss.defeated, true, "the final assault's campaign sync must defeat the boss");
  assert.deepEqual(
    lethalPlays,
    [{ unit: lethalBoss, clip: "Defeat", once: true }],
    "a lethal exposed-boss assault must leave the boss's one-shot Defeat playback intact",
  );

  const liveBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const liveBoss = makeUnit({ hp: 16 });
  const livePlays = [];
  liveBattle.boss = liveBoss;
  liveBattle.bossExposed = true;
  liveBattle.play = (unit, clip, once) => livePlays.push({ unit, clip, once });

  liveBattle.playActionEffect({ action: "assault", source: "boss", target: "commander" });

  assert.deepEqual(
    livePlays,
    [{ unit: liveBoss, clip: "Attack", once: true }],
    "a nonlethal exposed-boss assault must retain its boss Attack playback",
  );
});

test("RealtimeBattle clears a wave once every enemy is defeated or breach-retired while live enemies block completion", () => {
  const makeWaveBattle = () => {
    const events = [];
    const battle = new RealtimeBattle(
      null,
      { stageNumber: 1 },
      { onEncounterEvent: (event) => events.push(event) },
    );
    battle.currentWaveId = "scout";
    battle.encounter = {
      stageId: "cinder-span",
      state: { activeWaveId: "scout" },
    };
    return { battle, events };
  };

  const resolvedWave = makeWaveBattle();
  const defeated = makeUnit();
  const breached = makeUnit();
  defeated.defeated = true;
  breached.breachVisualized = true;
  resolvedWave.battle.enemies = [defeated, breached];

  resolvedWave.battle.updateEnemies(0);
  resolvedWave.battle.updateEnemies(0);

  assert.deepEqual(
    resolvedWave.events,
    [{ type: "wave-cleared", stageId: "cinder-span", waveId: "scout" }],
    "a mixed defeated-and-breached wave must clear once without repeating while its resolution is pending",
  );

  const blockedWave = makeWaveBattle();
  const live = makeUnit();
  live.breachVisualized = false;
  blockedWave.battle.enemies = [defeated, breached, live];
  blockedWave.battle.engagements.set(live, defeated);

  blockedWave.battle.updateEnemies(0);

  assert.deepEqual(
    blockedWave.events,
    [],
    "one live unresolved enemy must block wave completion even when every peer is defeated or breached",
  );
});


test("RealtimeBattle retires enemy animation mixers when an encounter wave is cleared", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const mixer = makeRetirableMixer();
  const enemy = { root: makeRoot(), mixer };
  battle.enemies = [enemy];
  battle.mixers = [mixer];

  battle.clearEncounterWave();

  assert.equal(enemy.root.removed, true, "cleared enemy root must leave the scene");
  assert.equal(mixer.stopped, 1, "cleared enemy mixer must stop all active actions");
  assert.deepEqual(mixer.uncachedRoots, [enemy.root], "cleared enemy mixer must release its cloned root");
  assert.deepEqual(battle.mixers, [], "cleared enemy mixer must not remain in the per-frame update list");
});

test("RealtimeBattle retires removed ally animation mixers during authoritative reconciliation", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const mixer = makeRetirableMixer();
  const ally = { root: makeRoot(), mixer, defeated: false };
  battle.scene = {};
  battle.templates.set("units/shade.glb", {});
  battle.allies = [ally];
  battle.mixers = [mixer];

  battle.reconcileAllies(0);

  assert.equal(ally.root.removed, true, "ally removed by authoritative count must leave the scene");
  assert.equal(mixer.stopped, 1, "removed ally mixer must stop all active actions");
  assert.deepEqual(mixer.uncachedRoots, [ally.root], "removed ally mixer must release its cloned root");
  assert.deepEqual(battle.mixers, [], "removed ally mixer must not remain in the per-frame update list");
});

test("RealtimeBattle exposes the shared 24×12 terrain walkability and elevation for 3D navigation", () => {
  const cinderSpan = new RealtimeBattle(null, { stageNumber: 1 });
  const veilCitadel = new RealtimeBattle(null, { stageNumber: 2 });
  const echoThrone = new RealtimeBattle(null, { stageNumber: 3 });

  const bridgeVoid = cinderSpan.navigationAt(-3, -3);
  assert.equal(bridgeVoid.x, 9, "Stage 1 navigation must map world space across all 24 grid columns");
  assert.equal(bridgeVoid.y, 3, "Stage 1 navigation must map world space across all 12 grid rows");
  assert.equal(
    bridgeVoid.walkable,
    false,
    "the Stage 1 bridge void must be unwalkable to 3D navigation just as it is on the 2D heightfield",
  );
  assert.deepEqual(
    veilCitadel.navigationAt(-3, -3.5),
    { x: 9, y: 2.5, elevation: 1, walkable: true },
    "the Stage 2 raised citadel must report the shared heightfield elevation",
  );
  assert.deepEqual(
    echoThrone.navigationAt(5, -0.5),
    { x: 17, y: 5.5, elevation: 2, walkable: true },
    "the Stage 3 throne ascent must report the shared two-level elevation",
  );
});

test("RealtimeBattle movement resolution rejects shared chasms and adopts shared terrain elevation", () => {
  const cinderSpan = new RealtimeBattle(null, { stageNumber: 1 });
  const veilCitadel = new RealtimeBattle(null, { stageNumber: 2 });
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let chasmTransition = null;
  for (const cell of cinderSpan.navigation.routes[0].cells) {
    const voidOffset = directions.find(([dx, dy]) => !cinderSpan.navigation.walkable(cell.x + dx, cell.y + dy));
    if (voidOffset) {
      chasmTransition = {
        from: cell,
        to: { x: cell.x + voidOffset[0], y: cell.y + voidOffset[1] },
      };
      break;
    }
  }
  assert.ok(chasmTransition, "Stage 1 must expose a legal route cell adjacent to a chasm");
  const bridgeStart = cinderSpan.navigation.gridToWorld(chasmTransition.from.x + 0.5, chasmTransition.from.y + 0.5);
  const bridgeTarget = cinderSpan.navigation.gridToWorld(chasmTransition.to.x + 0.5, chasmTransition.to.y + 0.5);
  const bridgeUnit = makeUnit({ x: bridgeStart.x, z: bridgeStart.z });
  bridgeUnit.radius = 0;

  const elevatedRoute = veilCitadel.navigation.routes[0].cells;
  const elevatedIndex = elevatedRoute.findIndex(
    (cell, index) => index > 0 && veilCitadel.navigation.heightAt(cell.x, cell.y) === 1,
  );
  assert.ok(elevatedIndex > 0, "Stage 2 must expose a reachable raised route cell");
  const plateauStart = veilCitadel.navigation.gridToWorld(
    elevatedRoute[elevatedIndex - 1].x + 0.5,
    elevatedRoute[elevatedIndex - 1].y + 0.5,
  );
  const plateauTarget = veilCitadel.navigation.gridToWorld(
    elevatedRoute[elevatedIndex].x + 0.5,
    elevatedRoute[elevatedIndex].y + 0.5,
  );
  const citadelUnit = makeUnit({ x: plateauStart.x, z: plateauStart.z });
  citadelUnit.radius = 0;

  const blockedAtChasm = cinderSpan.resolveMovement(bridgeUnit, bridgeTarget.x, bridgeTarget.z);
  assert.equal(blockedAtChasm.blocked, true, "a 3D unit must not enter the Stage 1 chasm");
  assert.equal(
    cinderSpan.navigationAt(blockedAtChasm.x, blockedAtChasm.z).walkable,
    true,
    "a blocked 3D move must finish on legal terrain",
  );
  assert.notDeepEqual(
    { x: blockedAtChasm.x, z: blockedAtChasm.z },
    bridgeTarget,
    "a blocked 3D move must not resolve onto its void target",
  );
  assert.deepEqual(
    veilCitadel.resolveMovement(citadelUnit, plateauTarget.x, plateauTarget.z),
    { x: plateauTarget.x, y: 0.42, z: plateauTarget.z, blocked: false },
    "a legal 3D move onto the Stage 2 plateau must take the same elevation as the shared heightfield",
  );
});

test("RealtimeBattle caps a stalled frame at six deterministic simulation steps", (t) => {
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.document = { hidden: false };
  const scheduled = [];
  globalThis.requestAnimationFrame = (callback) => {
    scheduled.push(callback);
    return 91;
  };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
  });

  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const updates = [];
  let renders = 0;
  battle.running = true;
  battle.renderer = { render: () => { renders += 1; } };
  battle.scene = {};
  battle.camera = {};
  battle.update = (dt) => updates.push(dt);

  battle.frame(1000);

  assert.equal(updates.length, 6, "a one-second stall must not trigger more than six catch-up simulation steps");
  assert.ok(updates.every((dt) => dt === 1 / 60), "every catch-up step must use the fixed 60 Hz timestep");
  assert.equal(renders, 1, "the capped catch-up frame must still render exactly once");
  assert.deepEqual(scheduled, [battle.rafCallback], "the frame loop must schedule exactly one successor");
  assert.ok(battle.accumulator >= 0 && battle.accumulator < 1 / 60, "the capped frame must leave less than one simulation step queued");
});

test("RealtimeBattle spawns hostile waves from the 24×12 route frontage without legacy 16×8 coordinates", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 10 });
  const spawnCalls = [];
  battle.scene = { add() {} };
  battle.cloneTemplate = () => {
    const enemy = makeUnit();
    enemy.root.rotation = {};
    return enemy;
  };
  battle.resolveSpawn = (enemy, x, z) => {
    enemy.root.position.set(x, 0, z);
    spawnCalls.push({ x, z });
    return true;
  };
  battle.play = () => {};

  battle.spawnEncounterWave({ id: "zenith-wave", hostiles: 3, hostileHealth: 4 });

  const expectedSpawns = battle.navigation.routes.map((_, routeIndex) => {
    const spawnCell = battle.navigation.routePath(routeIndex, true)[0];
    return battle.navigation.gridToWorld(spawnCell.x + 0.5, spawnCell.y + 0.5);
  }).map(({ x, z }) => ({ x, z }));
  assert.deepEqual(spawnCalls, expectedSpawns, "each hostile route must spawn from its authored far-side endpoint");
  assert.equal(battle.enemies.length, 3, "the renderer must materialize every hostile in the supplied wave");
  battle.enemies.forEach((enemy, routeIndex) => {
    const spawnGrid = battle.navigation.worldToGrid(spawnCalls[routeIndex].x, spawnCalls[routeIndex].z);
    assert.equal(spawnGrid.x, 22.5, `route ${routeIndex + 1} must spawn beyond the legacy 16-column boundary`);
    assert.equal(enemy.waypoints.length, battle.navigation.routes[routeIndex].cells.length, `route ${routeIndex + 1} must retain its full authored path`);
    const finalGrid = battle.navigation.worldToGrid(enemy.waypoints.at(-1).x, enemy.waypoints.at(-1).z);
    assert.deepEqual(finalGrid, { x: 1.5, y: 5.5 }, `route ${routeIndex + 1} must terminate at the portal frontage`);
  });
});

test("RealtimeBattle maps Stage 1 waves to authored GLBs and later archetypes to the scout fallback", () => {
  const modelByWave = {};

  for (const waveId of ["scout", "guard", "reinforcement", "depthguard"]) {
    const battle = new RealtimeBattle(null, { stageNumber: 1 });
    for (const model of ["units/scout.glb", "units/guard.glb", "units/reinforce.glb"]) {
      battle.templates.set(model, {});
    }
    battle.scene = { add() {} };
    battle.resolveSpawn = () => true;
    battle.play = () => {};
    battle.cloneTemplate = (model) => {
      modelByWave[waveId] = model;
      const enemy = makeUnit();
      enemy.root.rotation = {};
      return enemy;
    };

    battle.spawnEncounterWave({ id: waveId, hostiles: 1, hostileHealth: 2 });
  }

  assert.deepEqual(
    modelByWave,
    {
      scout: "units/scout.glb",
      guard: "units/guard.glb",
      reinforcement: "units/reinforce.glb",
      depthguard: "units/scout.glb",
    },
    "only the declared Stage 1 waves may select dedicated GLBs; later archetypes must retain the scout fallback",
  );
});

test("RealtimeBattle rejects selected-unit orders that target the shared Stage 1 chasm", () => {
  const tacticalRequests = [];
  const failureParticles = [];
  const failureTones = [];
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1 },
    { onTacticalRequest: (request) => tacticalRequests.push(request) },
  );
  const start = battle.navigation.gridToWorld(
    battle.navigation.anchors.alliedSpawn.x,
    battle.navigation.anchors.alliedSpawn.y,
  );
  const ally = makeUnit({ x: start.x, z: start.z });
  battle.commander = makeUnit({ x: start.x, z: start.z });
  battle.allies = [ally];
  battle.selection.add(ally);
  battle.camera = {};
  battle.ground = {};
  battle.raycaster = {
    setFromCamera() {},
    intersectObjects: () => [],
    intersectObject: () => [{ point: { x: -3, y: 0, z: -3 } }],
  };
  battle.particles = { emit: (...args) => failureParticles.push(args) };
  battle.audio = { playTone: (...args) => failureTones.push(args) };
  battle.rally.set(start.x - 1.25, 0, start.z);
  battle.play = () => {};
  const priorRally = battle.rally.clone();

  battle.pick({ clientX: 50, clientY: 50 }, "allies");

  battle.updateAllies(1 / 30);
  assert.deepEqual(
    { x: ally.root.position.x, y: ally.root.position.y, z: ally.root.position.z },
    { x: start.x, y: 0, z: start.z },
    "an unreachable void target must leave the selected ally at its legal formation position",
  );
  assert.deepEqual(
    battle.rally.toArray(),
    priorRally.toArray(),
    "rally input on the Stage 1 void must preserve the last legal rally point",
  );
  assert.equal(failureParticles.length, 1, "a rejected chasm order must emit one visible failure cue");
  assert.equal(failureTones.length, 1, "a rejected chasm order must emit one audible failure cue");
  assert.deepEqual(tacticalRequests, [], "a rejected selected-unit order must remain renderer-local");
});

test("RealtimeBattle movement resolution stops before static and live colliders", () => {
  const staticBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const staticMover = makeUnit({ x: -3, z: -0.5 });
  staticMover.radius = 0.42;
  staticBattle.commander = staticMover;
  staticBattle.staticBlockers = [{
    root: makeRoot(-0.5, -0.5),
    radius: 0.62,
    blocksMovement: true,
    active: () => true,
  }];

  const staticResult = staticBattle.resolveMovement(staticMover, 0, -0.5);

  assert.equal(staticResult.blocked, true, "the command node collider must block a commander before overlap");
  assert.ok(
    staticResult.x >= -1.56 && staticResult.x < -1.53,
    `the command node collider must stop at the combined-radius contact point (got x=${staticResult.x})`,
  );
  assert.equal(staticResult.z, -0.5, "static collision resolution must not introduce lateral drift");

  const liveBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const liveMover = makeUnit({ x: -3, z: -0.5 });
  const liveBlocker = makeUnit({ x: -1, z: -0.5 });
  liveMover.radius = 0.42;
  liveBlocker.radius = 0.42;
  liveBattle.commander = liveMover;
  liveBattle.allies = [liveBlocker];

  const liveResult = liveBattle.resolveMovement(liveMover, 0, -0.5);

  assert.equal(liveResult.blocked, true, "a live ally must block a commander before overlap");
  assert.ok(
    liveResult.x >= -1.92 && liveResult.x < -1.8,
    `a live ally must stop at the first sampled position before combined-radius overlap (got x=${liveResult.x})`,
  );
  assert.equal(liveResult.z, -0.5, "live collision resolution must not introduce lateral drift");
});

test("RealtimeBattle resolves extractor feedback through the injected shared navigation anchor", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const defaultPoint = battle.actionFeedbackPoint("extractor");
  const baseNavigation = battle.navigation;
  const injectedAnchor = Object.freeze({ id: "extractor", x: 16.5, y: 5.5 });
  const gridToWorldCalls = [];
  battle.navigation = {
    ...baseNavigation,
    anchors: { ...baseNavigation.anchors, extractor: injectedAnchor },
    gridToWorld: (x, y) => {
      gridToWorldCalls.push({ x, y });
      return baseNavigation.gridToWorld(x, y);
    },
  };

  const injectedPoint = battle.actionFeedbackPoint("extractor");
  const injectedWorld = baseNavigation.gridToWorld(injectedAnchor.x, injectedAnchor.y);
  assert.deepEqual(
    gridToWorldCalls,
    [{ x: injectedAnchor.x, y: injectedAnchor.y }],
    "extractor feedback must resolve the current shared stage anchor through navigation.gridToWorld",
  );
  assert.deepEqual(
    injectedPoint,
    {
      x: injectedWorld.x,
      y: battle.navigationAt(injectedWorld.x, injectedWorld.z).elevation * 0.42,
      z: injectedWorld.z,
    },
    "extractor feedback must land on the injected shared navigation anchor",
  );
  assert.notDeepEqual(injectedPoint, defaultPoint, "changing the shared extractor anchor must move renderer feedback instead of retaining a legacy literal");
});

test("RealtimeBattle emits bounded directional feedback for every supported action without mutating authoritative combat state", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { ally: "#ally", accent: "#accent", hostile: "#hostile" },
  });
  const commander = makeUnit({ x: 1, z: 2 });
  const boss = makeUnit({ x: -2, z: 3 });
  const ally = makeUnit({ x: 4, z: -1 });
  const enemy = makeUnit({ x: -4, z: 1 });
  const portal = makeRoot(8, -2);
  const node = makeRoot(-5, 4);
  const campaign = Object.freeze({ state: Object.freeze({ phase: "active", legion: 2 }) });
  const particleCalls = [];
  const sampleCalls = [];
  const toneCalls = [];
  const shakeCalls = [];
  commander.root.position.y = 0.4;
  boss.root.position.y = 1;
  ally.root.position.y = 0.2;
  portal.position.y = 0.6;
  node.position.y = 0.8;
  battle.commander = commander;
  battle.boss = boss;
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.portal = portal;
  battle.node = { position: node.position, material: { emissiveIntensity: 0 } };
  battle.encounter = campaign;
  battle.authoritativeLegion = 2;
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = {
    playSample: (...args) => sampleCalls.push(args),
    playTone: (...args) => toneCalls.push(args),
  };
  battle.shakeCamera = (...args) => shakeCalls.push(args);
  const hitStopCalls = [];
  battle.triggerHitStop = (duration) => hitStopCalls.push(duration);


  const extractorAnchor = battle.navigation.anchors.extractor;
  const extractorWorld = battle.navigation.gridToWorld(extractorAnchor.x, extractorAnchor.y);
  const extractor = {
    x: extractorWorld.x,
    y: battle.navigationAt(extractorWorld.x, extractorWorld.z).elevation * 0.42,
    z: extractorWorld.z,
  };
  const semantics = [
    { action: "hunt", source: "portal", target: "extractor" },
    { action: "extract", source: "extractor", target: "portal" },
    { action: "materialize", source: "portal", target: "portal" },
    { action: "capture", source: "portal", target: "node" },
    { action: "possess", source: "portal", target: "ally" },
    { action: "domain", source: "portal", target: "portal" },
    { action: "assault", source: "ally", target: "boss" },
  ];
  const feedback = semantics.map((semantic) => battle.emitActionFeedback(semantic));

  assert.deepEqual(
    battle.actionFeedbackPoint("extractor"),
    extractor,
    "extract feedback must use its authored coordinate on the expanded 24×12 tactical grid",
  );
  assert.deepEqual(
    feedback,
    [
      { action: "hunt", source: portal.position, target: extractor },
      { action: "extract", source: extractor, target: portal.position },
      { action: "materialize", source: portal.position, target: portal.position },
      { action: "capture", source: portal.position, target: node.position },
      { action: "possess", source: portal.position, target: ally.root.position },
      { action: "domain", source: portal.position, target: portal.position },
      { action: "assault", source: ally.root.position, target: boss.root.position },
    ],
    "each player action must preserve its semantic source and tactical target",
  );
  assert.deepEqual(
    particleCalls.map(([x, y, z, color, count]) => [x, Number(y.toFixed(2)), z, color, count]),
    [
      [8, 1.32, -2, "#accent", 5], [extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, "#accent", 12],
      [extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, "#ally", 5], [8, 1.32, -2, "#ally", 14],
      [8, 1.32, -2, "#ally", 8], [8, 1.32, -2, "#ally", 12],
      [8, 1.32, -2, "#accent", 7], [-5, 1.52, 4, "#accent", 18],
      [8, 1.32, -2, "#accent", 6], [4, 0.92, -1, "#accent", 16],
      [8, 1.32, -2, "#accent", 10], [8, 1.32, -2, "#accent", 14],
      [4, 0.92, -1, "#hostile", 11], [-2, 1.72, 3, "#hostile", 28],
    ],
    "each action must emit bounded source and target particle bursts in its semantic direction",
  );
  assert.deepEqual(
    sampleCalls.map(([action, x, y, z, gain]) => [action, x, Number(y.toFixed(2)), z, gain]),
    [
      ["hunt", 8, 1.32, -2, 0.52],
      ["extract", extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, 0.58],
      ["materialize", 8, 1.32, -2, 0.7],
      ["capture", 8, 1.32, -2, 0.66],
      ["possess", 8, 1.32, -2, 0.62],
      ["domain", 8, 1.32, -2, 0.74],
      ["assault", 4, 0.92, -1, 0.78],
    ],
    "every feedback path must request its authored sample at the semantic source",
  );
  assert.deepEqual(
    toneCalls.map(([x, y, z, options]) => [x, Number(y.toFixed(2)), z, Number(options.gain.toFixed(3))]),
    [
      [extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, 0.208],
      [8, 1.32, -2, 0.232],
      [-5, 1.52, 4, 0.264],
      [4, 0.92, -1, 0.248],
      [-2, 1.72, 3, 0.312],
    ],
    "distinct endpoints must add a directionally aligned target tone",
  );
  assert.ok(
    particleCalls.every(([, , , , count]) => count <= 28),
    "action feedback particles must stay within the bounded maximum burst size",
  );
  assert.equal(battle.portalPulse, 2.15, "portal-origin actions must leave a non-animated portal marker pulse");
  assert.equal(battle.nodePulse, 2.15, "capture must leave a non-animated command-node marker pulse");
  assert.deepEqual(shakeCalls, [[0.12, 0.18]], "only assault feedback may request camera shake");
  assert.deepEqual(
    hitStopCalls,
    [0.06],
    "assault feedback must request one bounded 0.06-second hit stop without extending command authority",
  );
  assert.equal(battle.encounter, campaign, "feedback must leave authoritative encounter configuration and state untouched");
  assert.equal(battle.authoritativeLegion, 2, "feedback must not change the campaign-authoritative legion count");
  assert.deepEqual(battle.allies, [ally], "feedback must not create or remove allied encounter units");
  assert.deepEqual(battle.enemies, [enemy], "feedback must not create or remove enemy encounter units");
  assert.equal(ally.root.removed, false, "feedback must not retire existing allies");
  assert.equal(enemy.root.removed, false, "feedback must not retire existing enemies");
});

test("RealtimeBattle resolves every verified action actor to the commander with supported clips", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const commander = makeUnit();
  const ally = makeUnit({ x: 2 });
  const boss = makeUnit({ x: -2 });
  const played = [];
  battle.commander = commander;
  battle.allies = [ally];
  battle.boss = boss;
  battle.portal = makeRoot(4, 1);
  battle.node = { position: makeRoot(-4, 1).position, material: { emissiveIntensity: 0 } };
  battle.bossExposed = false;
  battle.particles = null;
  battle.audio = { playSample() {}, playTone() {} };
  battle.play = (actor, clip, once) => played.push({ actor, clip, once });

  const semantics = [
    { action: "hunt", source: "portal", target: "extractor", actor: "commander", actorClip: "Special", clip: "Special" },
    { action: "extract", source: "extractor", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "materialize", source: "portal", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "capture", source: "portal", target: "node", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "possess", source: "portal", target: "ally", actor: "commander", actorClip: "Special", clip: "Special" },
    { action: "domain", source: "portal", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "assault", source: "ally", target: "boss", actor: "commander", actorClip: "Strike", clip: "Strike" },
  ];
  for (const semantic of semantics) battle.triggerAction(semantic);

  assert.deepEqual(
    played,
    semantics.map(({ actorClip }) => ({ actor: commander, clip: actorClip, once: true })),
    "all verified actions must route one-shot playback through the commander using actorClip rather than a source-atlas clip",
  );
  assert.ok(
    played.every(({ clip }) => clip === "Special" || clip === "Strike"),
    "commander playback must use only the model-proven Special or Strike clip vocabulary",
  );
});

test("RealtimeBattle materialize feedback stays renderer-local on the public action path", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const ally = makeUnit();
  const enemy = makeUnit({ x: 3 });
  const portal = makeRoot(6, -4);
  const campaign = Object.freeze({ state: Object.freeze({ phase: "active", legion: 2 }) });
  const particleCalls = [];
  const sampleCalls = [];
  const createCalls = [];
  const reconcileCalls = [];
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.portal = portal;
  battle.encounter = campaign;
  battle.authoritativeLegion = null;
  battle.running = true;
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = { playSample: (...args) => sampleCalls.push(args) };
  battle.createAlly = (...args) => createCalls.push(args);
  battle.reconcileAllies = (...args) => reconcileCalls.push(args);
  battle.play = () => {};

  battle.triggerAction({ action: "materialize", source: "portal", target: "portal", count: 3 });

  assert.equal(particleCalls.length, 2, "materialize must emit bounded source and target renderer-local bursts");
  assert.deepEqual(sampleCalls, [["materialize", 6, 0.72, -4, 0.7]], "materialize must request its authored audio cue");
  assert.deepEqual(createCalls, [], "materialize feedback must not create units, even while the battle is running");
  assert.deepEqual(reconcileCalls, [], "materialize feedback must not reconcile units outside applyCampaignState");
  assert.equal(battle.encounter, campaign, "materialize feedback must not mutate encounter state");
  assert.equal(battle.authoritativeLegion, null, "materialize feedback must not mutate campaign-authoritative legion count");
  assert.deepEqual(battle.allies, [ally], "materialize feedback must not create or remove allies");
  assert.deepEqual(battle.enemies, [enemy], "materialize feedback must not create or remove enemies");
});

test("RealtimeBattle makes a melee exchange legible through midpoint and target-directed feedback", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { accent: "#gold", hostile: "#red" },
  });
  const ally = makeUnit({ x: -1, z: 2 });
  const enemy = makeUnit({ x: 3, z: -2 });
  const particleCalls = [];
  const toneCalls = [];
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.engagements.set(ally, enemy);
  battle.engagements.set(enemy, ally);
  battle.play = () => {};
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = { playTone: (...args) => toneCalls.push(args) };

  battle.updateEngagements(1);

  assert.deepEqual(
    particleCalls,
    [
      [1, 0.9, 0, "#gold", 6, { speedMin: 1.2, speedMax: 2.8, life: 0.28, gravity: 4, upBias: 0.4 }],
      [ally.root.position.x, 0.8, ally.root.position.z, "#red", 8, { speedMin: 1.4, speedMax: 3.2, life: 0.32, gravity: 5 }],
    ],
    "each exchange must show a shared clash at the contact midpoint and a hostile impact on the struck ally",
  );
  assert.deepEqual(
    toneCalls.map(([x, y, z, options]) => ({ x, y, z, options })),
    [
      { x: 1, y: 0.9, z: 0, options: { freq: 900, endFreq: 320, duration: 0.09, type: "triangle", gain: 0.35 } },
      { x: -1, y: 0.8, z: 2, options: { freq: 220, endFreq: 90, duration: 0.14, type: "sawtooth", gain: 0.45 } },
    ],
    "each visual combat direction must have an aligned spatial sound cue",
  );
  assert.equal(ally.hit, 1, "the target receives exactly one combat hit for the exchange");
  assert.equal(enemy.hp, 1, "the attacker resolves exactly one combat hit against its paired enemy");
  assert.deepEqual(battle.allies, [ally], "combat feedback must not create or remove allied units");
  assert.deepEqual(battle.enemies, [enemy], "combat feedback must not create or remove enemy units");
});

test("RealtimeBattle loads every declared stage resource with or without a canvas test double", async () => {
  const expectedStageResources = new Map([
    [4, ["terrain/veil-citadel.glb", "bosses/cinder-warden.glb"]],
    [5, ["terrain/cinder-span.glb", "bosses/veil-tactician.glb"]],
    [6, ["terrain/veil-citadel.glb", "bosses/veil-tactician.glb"]],
    [7, ["terrain/cinder-span.glb", "bosses/gate-sovereign.glb"]],
    [8, ["terrain/echo-throne-steps.glb", "bosses/cinder-warden.glb"]],
    [9, ["terrain/veil-citadel.glb", "bosses/gate-sovereign.glb"]],
    [10, ["terrain/echo-throne-steps.glb", "bosses/gate-sovereign.glb"]],
  ]);

  for (const canvas of [null, {}]) {
    for (const [stageNumber, [terrain, boss]] of expectedStageResources) {
      const battle = new RealtimeBattle(canvas, { stageNumber });
      const loaded = [];
      battle.loadModel = async (resource) => {
        loaded.push(resource);
        return { animations: [] };
      };

      await battle.loadStageAssets();

      assert.equal(battle.stageNumber, stageNumber, `Stage ${stageNumber} must not be clamped to Stage 3.`);
      assert.deepEqual(
        { width: battle.navigation.width, height: battle.navigation.height },
        { width: 24, height: 12 },
        `Stage ${stageNumber} must initialize the expanded tactical navigation grid.`,
      );
      assert.deepEqual(
        loaded,
        [terrain, "units/shade.glb", "units/scout.glb", "units/guard.glb", "units/reinforce.glb", boss],
        `Stage ${stageNumber} must request every declared resource ${canvas ? "with" : "without"} a canvas test double.`,
      );
    }
  }
});

test("ParticleField recycles the fixed-capacity pool instead of growing unbounded", async () => {
  const { ParticleField } = await import("../battle-realtime-three.js");
  const added = [];
  const scene = { add: (object) => added.push(object) };
  const field = new ParticleField(scene);

  assert.equal(field.capacity, 360, "particle pool capacity must match the documented budget");
  assert.equal(added.length, 1, "constructing a ParticleField must add exactly one Points object to the scene");

  field.emit(0, 0, 0, "#ffffff", 400, {});
  const aliveCount = Array.from(field.alive).filter((flag) => flag === 1).length;
  assert.equal(aliveCount, 360, "emitting more particles than capacity must recycle oldest slots, never exceed capacity");
  assert.equal(field.cursor, 40, "cursor must wrap modulo capacity after overflowing (400 % 360 = 40)");

  field.update(10);
  const aliveAfterLongDt = Array.from(field.alive).filter((flag) => flag === 1).length;
  assert.equal(aliveAfterLongDt, 0, "a long enough dt must expire every particle back to the dead pool");

  field.dispose();
});

test("SpatialAudio constructs safely with a null AudioContext outside a browser environment", async () => {
  const { SpatialAudio } = await import("../battle-realtime-three.js");
  const audio = new SpatialAudio();

  assert.equal(audio.ctx, null, "non-browser SpatialAudio must not construct a real AudioContext");
  assert.equal(audio.master, null, "non-browser SpatialAudio must not construct a master gain node");
  assert.doesNotThrow(() => audio.playTone(0, 0, 0, { freq: 440 }), "playTone must tolerate a null AudioContext");
  assert.doesNotThrow(() => audio.playSample("hunt", 0, 0, 0, 1), "playSample must tolerate a null AudioContext");
  assert.doesNotThrow(() => audio.updateListener({ position: { x: 0, y: 0, z: 0 } }), "updateListener must tolerate a null AudioContext");
});

test("SpatialAudio abandons pending sample playback when disposed before decoding completes", async () => {
  const { promise: decodeStarted, resolve: markDecodeStarted } = Promise.withResolvers();
  const { promise: decoded, resolve: finishDecode } = Promise.withResolvers();
  const calls = { gains: 0, panners: 0, sources: 0, starts: 0 };
  const node = {
    gain: { value: 0 },
    connect(target) {
      return target;
    },
    disconnect() {},
  };

  class PendingDecodeAudioContext {
    state = "running";
    destination = {};

    createGain() {
      calls.gains += 1;
      return { ...node, gain: { value: 0 } };
    }

    createPanner() {
      calls.panners += 1;
      return { ...node };
    }

    createBufferSource() {
      calls.sources += 1;
      return {
        ...node,
        addEventListener() {},
        start() {
          calls.starts += 1;
        },
      };
    }

    decodeAudioData() {
      markDecodeStarted();
      return decoded;
    }

    close() {
      this.state = "closed";
      return Promise.resolve();
    }
  }

  const descriptors = new Map(
    ["fetch", "window"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { AudioContext: PendingDecodeAudioContext },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
  });

  try {
    const { SpatialAudio } = await import("../battle-realtime-three.js");
    const audio = new SpatialAudio();
    calls.gains = 0;
    const playback = audio.playSample("hunt", 1, 2, 3, 0.5);

    await decodeStarted;
    audio.dispose();
    finishDecode({});

    await assert.doesNotReject(playback, "a disposed pending playback must settle without dereferencing cleared audio state");
    assert.deepEqual(
      calls,
      { gains: 0, panners: 0, sources: 0, starts: 0 },
      "resolving decode after disposal must not create playback nodes or start late audio",
    );
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("RealtimeBattle triggers boss defeat feedback exactly once when applyCampaignState reports bossHealth reaching zero", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1, palette: { hostile: "#ff7f79" } });
  const boss = makeUnit({ x: 3, z: 5 });
  battle.boss = boss;
  const defeatCalls = [];
  const originalDefeat = battle.defeat.bind(battle);
  battle.defeat = (unit) => {
    defeatCalls.push(unit);
    return originalDefeat(unit);
  };

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 8 } });
  assert.deepEqual(defeatCalls, [], "the first sync at full boss health must not trigger defeat");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 3 } });
  assert.deepEqual(defeatCalls, [], "a partial-damage sync must not trigger defeat");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.deepEqual(defeatCalls, [boss], "bossHealth transitioning to zero must call defeat(this.boss) exactly once");
  assert.equal(boss.defeated, true, "the boss instance itself must be marked defeated");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.deepEqual(defeatCalls, [boss], "a repeated zero-health sync must not re-trigger defeat (defeat() is itself idempotent via unit.defeated)");
});

test("RealtimeBattle applyCampaignState does not defeat the boss on a fresh stage entry at full health after a prior defeat", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1, palette: { hostile: "#ff7f79" } });
  const boss = makeUnit({ x: 3, z: 5 });
  battle.boss = boss;

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 8 } });
  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.equal(boss.defeated, true, "boss must be defeated once its health reaches zero");

  const nextBoss = makeUnit({ x: -1, z: 2 });
  battle.boss = nextBoss;
  battle.applyCampaignState({ state: { legion: 0, bossHealth: 12 } });
  assert.equal(nextBoss.defeated, false, "a fresh boss instance on stage retry/advance must not start pre-defeated");
});

test("RealtimeBattle shakeCamera lets a weaker overlapping pulse decay smoothly instead of spiking the envelope", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  battle.shakeCamera(0.35, 0.5);
  assert.equal(battle.shakeMagnitude, 0.35);
  assert.equal(battle.shakeDuration, 0.5);

  // Simulate 0.45s of decay (0.05s of the 0.5s duration remaining): residual strength = 0.35 * 0.05/0.5 = 0.035.
  battle.shakeTime = 0.05;
  const strengthBeforeWeakerPulse = battle.shakeMagnitude * (battle.shakeDuration > 0 ? battle.shakeTime / battle.shakeDuration : 0);
  assert.ok(Math.abs(strengthBeforeWeakerPulse - 0.035) < 1e-9, "sanity: the shake must have decayed to the expected residual strength");

  // A pulse weaker than the current residual strength (e.g. a footstep-dust-scale event) must not spike the envelope back up.
  battle.shakeCamera(0.02, 0.22);
  assert.equal(battle.shakeMagnitude, 0.35, "a pulse weaker than the still-decaying residual strength must not overwrite the peak magnitude");
  assert.equal(battle.shakeDuration, 0.5, "a weaker pulse must not reset the decay envelope's duration denominator");
  assert.equal(battle.shakeTime, 0.05, "a weaker pulse must not extend the remaining shake time");

  // A pulse stronger than the current residual strength (but weaker than the original peak) correctly takes over as the new envelope.
  battle.shakeCamera(0.14, 0.22);
  assert.equal(battle.shakeMagnitude, 0.14, "a pulse stronger than the current residual strength must take over as the new envelope, even if weaker than the original peak");
  assert.equal(battle.shakeDuration, 0.22);
  assert.equal(battle.shakeTime, 0.22);

  battle.shakeCamera(0.5, 0.3);
  assert.equal(battle.shakeMagnitude, 0.5, "a pulse stronger than the current envelope must take over");
  assert.equal(battle.shakeDuration, 0.3);
  assert.equal(battle.shakeTime, 0.3);
});

test("RealtimeBattle restores rally-to-commander grouping on possess and domain actions", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { ally: "#ally", accent: "#accent", hostile: "#hostile" },
  });
  battle.commanderPosition.set(4, 0, -2);
  battle.play = () => {};

  battle.playActionEffect({ action: "possess", source: "portal", target: "ally", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 4, y: 0, z: -2 },
    "possess must rally allies to the commander's current position",
  );

  battle.rally.set(99, 0, 99);
  battle.playActionEffect({ action: "domain", source: "portal", target: "portal", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 4, y: 0, z: -2 },
    "domain must also rally allies to the commander's current position",
  );

  battle.rally.set(99, 0, 99);
  battle.playActionEffect({ action: "hunt", source: "portal", target: "extractor", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 99, y: 0, z: 99 },
    "actions other than possess/domain must not touch the rally point",
  );
});

test("RealtimeBattle retire() disposes boss-identity-tint material clones without touching template-shared materials", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  let disposedCount = 0;
  const tintedMaterial = { userData: { isBossIdentityTint: true }, dispose: () => { disposedCount += 1; } };
  const sharedMaterial = { userData: {}, dispose: () => { disposedCount += 1; } };
  const boss = {
    root: {
      traverse(visit) {
        visit({ isMesh: true, material: tintedMaterial });
        visit({ isMesh: true, material: sharedMaterial });
        visit({ isMesh: false, material: sharedMaterial });
      },
      removeFromParent() {},
    },
    mixer: null,
  };

  battle.retire(boss);
  assert.equal(disposedCount, 1, "retire() must dispose exactly the boss-identity-tint clone, not the template-shared material");
});

test("RealtimeBattle destroy disposes shared WebGL resources once and remains idempotent", (t) => {
  const priorDocument = globalThis.document;
  globalThis.document = { removeEventListener() {} };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  });

  const disposals = { geometry: 0, material: 0, texture: 0, ring: 0, shadow: 0, renderer: 0, particles: 0, audio: 0 };
  const texture = { isTexture: true, dispose: () => { disposals.texture += 1; } };
  const material = { map: texture, dispose: () => { disposals.material += 1; } };
  const geometry = { dispose: () => { disposals.geometry += 1; } };
  const ringGeometry = { dispose: () => { disposals.ring += 1; } };
  const sharedMesh = { isMesh: true, geometry, material };
  const canvas = { removeEventListener() {} };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  battle.scene = {
    traverse(visit) {
      visit(sharedMesh);
      visit({ isMesh: true, geometry, material });
    },
  };
  battle.templates.set("units/shade.glb", {
    scene: {
      traverse(visit) {
        visit({ isMesh: true, geometry, material });
      },
    },
  });
  battle.renderer = { dispose: () => { disposals.renderer += 1; } };
  battle.particles = { dispose: () => { disposals.particles += 1; } };
  battle.audio = { dispose: () => { disposals.audio += 1; } };
  battle.ringGeometry = ringGeometry;
  battle.keyLight = { shadow: { dispose: () => { disposals.shadow += 1; } } };

  battle.destroy();
  battle.destroy();

  assert.deepEqual(
    disposals,
    { geometry: 1, material: 1, texture: 1, ring: 1, shadow: 1, renderer: 1, particles: 1, audio: 1 },
    "destroy must release each shared GPU resource once even when the scene exposes it through multiple meshes and destroy is repeated",
  );
});

function makeRealtimeTowerScenario({ fortificationLevel = 1, distance = 1 } = {}) {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const enemy = { ...makeUnit({ x: distance, z: 0, hp: 10 }), id: "enemy-1" };
  const towerRoot = makeRoot();
  towerRoot.position.distanceTo = (target) => Math.hypot(
    towerRoot.position.x - target.x,
    towerRoot.position.z - target.z,
  );

  battle.fortificationLevel = fortificationLevel;
  battle.enemies = [enemy];
  battle.getGimmickAt = () => null;
  battle.drawTracer = () => {};
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  battle.deploymentsMap.set("tower-1", {
    id: "tower-1",
    kind: "tower",
    root: towerRoot,
    gridX: 0,
    gridY: 0,
    cooldown: 0,
  });

  return {
    battle,
    enemy,
    shotCount: () => battle.getTacticalSnapshot().towerShots.length,
  };
}

test("RealtimeBattle tower auto-fire applies fortification bonuses above the level-1 baseline", async (t) => {
  const cases = [
    { name: "level 1 deals baseline damage", fortificationLevel: 1, expectedDamage: 1 },
    { name: "level 2 adds twenty percent damage", fortificationLevel: 2, expectedDamage: 1.2 },
  ];

  for (const { name, fortificationLevel, expectedDamage } of cases) {
    await t.test(name, () => {
      const { battle, enemy, shotCount } = makeRealtimeTowerScenario({ fortificationLevel });

      battle.updateTowers(0);

      assert.deepEqual(
        {
          damage: Number((10 - enemy.hp).toFixed(6)),
          shots: shotCount(),
        },
        { damage: expectedDamage, shots: 1 },
        "one live enemy inside tower range must take the level-scaled damage from exactly one emitted shot",
      );
    });
  }
});

test("RealtimeBattle tower auto-fire includes the shared base-range boundary and excludes enemies beyond it", async (t) => {
  const cases = [
    { name: "enemy exactly four units away is in range", distance: 4, expectedShots: 1 },
    { name: "enemy just beyond four units is out of range", distance: 4.001, expectedShots: 0 },
  ];

  for (const { name, distance, expectedShots } of cases) {
    await t.test(name, () => {
      const { battle, shotCount } = makeRealtimeTowerScenario({ distance });

      battle.updateTowers(0);

      assert.equal(
        shotCount(),
        expectedShots,
        "the WebGL tower must use the same inclusive four-unit base range as the Canvas tower",
      );
    });
  }
});

test("RealtimeBattle tower auto-fire emits only one shot during the shared one-second cooldown", () => {
  const { battle, shotCount } = makeRealtimeTowerScenario();
  const shotsByElapsedTime = [];

  for (const elapsed of [0, 0.8, 0.2]) {
    battle.updateTowers(elapsed);
    shotsByElapsedTime.push(shotCount());
  }

  assert.deepEqual(
    shotsByElapsedTime,
    [1, 1, 2],
    "the tower must fire immediately, remain blocked at 0.8 seconds, and fire again after one full second",
  );
});

function measureRealtimeMobilityTick({ mobilityLevel, terrainMultiplier = 1 }) {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const commander = makeUnit();
  const ally = makeUnit({ z: 1 });
  commander.root.rotation = { y: 0 };
  ally.customOrder = { x: 1, z: 1 };
  ally.customOrderReached = false;

  battle.mobilityLevel = mobilityLevel;
  battle.commander = commander;
  battle.allies = [ally];
  battle.pressed.add("KeyD");
  battle.getGimmickAt = () => ({
    effects: { movementSpeedMultiplier: terrainMultiplier },
  });
  battle.applyResolvedMovement = (unit, targetX, targetZ) => {
    unit.root.position.set(targetX, 0, targetZ);
    return { x: targetX, y: 0, z: targetZ, blocked: false };
  };
  battle.play = () => {};

  battle.moveCommander(0.25);
  battle.updateAllies(0.25);

  return {
    commander: Math.hypot(commander.root.position.x, commander.root.position.z),
    ally: Math.hypot(ally.root.position.x, ally.root.position.z - 1),
  };
}

test("RealtimeBattle Mobility accelerates only the commander and composes with terrain movement", async (t) => {
  const baseline = measureRealtimeMobilityTick({ mobilityLevel: 1 });
  const upgraded = measureRealtimeMobilityTick({ mobilityLevel: 2 });
  const terrainMultiplier = 0.5;
  const terrainAffected = measureRealtimeMobilityTick({ mobilityLevel: 2, terrainMultiplier });

  await t.test("level 2 moves the commander exactly fifteen percent farther than level 1", () => {
    assert.equal(
      Number((upgraded.commander / baseline.commander).toFixed(12)),
      1.15,
      "Mobility level 1 must be the commander baseline and level 2 must add exactly fifteen percent",
    );
  });

  await t.test("level 2 leaves allied-unit movement at the level-1 distance", () => {
    assert.equal(
      Number((upgraded.ally / baseline.ally).toFixed(12)),
      1,
      "Mobility must not change allied-unit speed",
    );
  });

  await t.test("terrain movement effects multiply the upgraded commander distance", () => {
    assert.equal(
      Number((terrainAffected.commander / upgraded.commander).toFixed(12)),
      terrainMultiplier,
      "terrain movement effects must remain multiplicative with commander Mobility",
    );
  });
});
