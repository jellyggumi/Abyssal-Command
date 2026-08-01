(() => {
  "use strict";

  const FIXED_STEP = 1 / 60;
  const MAX_FRAME_DELTA = 0.25;
  const MAX_CATCH_UP_STEPS = 8;
  const MAX_INTEGRITY = 100;
  const MAX_ENERGY = 6;
  const INITIAL_ENERGY = 3;
  const ENERGY_REGEN_PER_SECOND = 0.6;
  const SPAWN_DELAY_SECONDS = 0.45;
  const ACTION_DURATION_TICKS = 20;

  const ABILITIES = Object.freeze({
    crescent: Object.freeze({ cost: 1, damage: 26, label: "Crescent" }),
    "rift-lance": Object.freeze({ cost: 2, damage: 58, label: "Rift Lance" }),
    "bind-seal": Object.freeze({ cost: 3, damage: 0, label: "Bind Seal" }),
  });

  const FRONT_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "cinder-span",
      name: "Cinder Span",
      impact: 7,
      threats: Object.freeze([
        Object.freeze({ name: "Ash Vanguard", health: 60, pressureRate: 2.3 }),
        Object.freeze({ name: "Cinder Bailiff", health: 82, pressureRate: 2.6 }),
        Object.freeze({ name: "Pyre Castellan", health: 105, pressureRate: 2.9 }),
      ]),
    }),
    Object.freeze({
      id: "abyss-chancel",
      name: "Abyss Chancel",
      impact: 8,
      threats: Object.freeze([
        Object.freeze({ name: "Drowned Cantor", health: 60, pressureRate: 2.6 }),
        Object.freeze({ name: "Mirror Penitent", health: 82, pressureRate: 2.9 }),
        Object.freeze({ name: "Chancel Witness", health: 105, pressureRate: 3.2 }),
      ]),
    }),
    Object.freeze({
      id: "echo-throne",
      name: "Echo Throne",
      impact: 9,
      threats: Object.freeze([
        Object.freeze({ name: "Hollow Retainer", health: 60, pressureRate: 2.9 }),
        Object.freeze({ name: "Echo Regent", health: 82, pressureRate: 3.2 }),
        Object.freeze({ name: "Throne Remnant", health: 105, pressureRate: 3.5 }),
      ]),
    }),
  ]);

  const body = document.body;
  const statusNode = document.querySelector("#sealbound-status");
  const stage = document.querySelector("#sealbound-stage");
  const stageName = document.querySelector("#sealbound-stage-name");
  const threatName = document.querySelector("#sealbound-threat-name");
  const sealNode = document.querySelector("#sealbound-seal");
  const sealLabel = document.querySelector("[data-seal-label]");
  const frontButtons = Array.from(document.querySelectorAll("[data-front-index]"));
  const frontStateNodes = Array.from(document.querySelectorAll("[data-front-state]"));
  const sceneNodes = Array.from(document.querySelectorAll("[data-front-scene]"));
  const abilityButtons = Array.from(document.querySelectorAll("[data-ability]"));
  const restartButtons = [
    document.querySelector("#sealbound-restart"),
    document.querySelector("#sealbound-outcome-restart"),
  ].filter(Boolean);
  const integrityMeter = document.querySelector("#sealbound-integrity");
  const integrityFill = document.querySelector("#sealbound-integrity-fill");
  const integrityValue = document.querySelector("#sealbound-integrity-value");
  const energyMeter = document.querySelector("#sealbound-energy");
  const energyFill = document.querySelector("#sealbound-energy-fill");
  const energyValue = document.querySelector("#sealbound-energy-value");
  const pressureMeter = document.querySelector("#sealbound-pressure");
  const pressureFill = document.querySelector("#sealbound-pressure-fill");
  const pressureValue = document.querySelector("#sealbound-pressure-value");
  const clearsValue = document.querySelector("#sealbound-clears");
  const capturesValue = document.querySelector("#sealbound-captures");
  const outcome = document.querySelector("#sealbound-outcome");
  const outcomeKicker = document.querySelector("#sealbound-outcome-kicker");
  const outcomeTitle = document.querySelector("#sealbound-outcome-title");
  const outcomeMessage = document.querySelector("#sealbound-outcome-message");
  const spriteNodes = Array.from(document.querySelectorAll("[data-sprite]"));
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let state;
  let frameRequest = 0;
  let previousFrameTime = null;
  let frameAccumulator = 0;
  let manualAccumulator = 0;
  let pageActive = true;

  function createFrontState(definition) {
    return {
      id: definition.id,
      pressure: 0,
      cleared: false,
      captured: false,
      sealState: "sealed",
      enemyIndex: 0,
      enemyHealth: definition.threats[0].health,
      spawnTimer: 0,
    };
  }

  function createInitialState() {
    return {
      mode: "running",
      selectedFront: 0,
      integrity: MAX_INTEGRITY,
      energy: INITIAL_ENERGY,
      tick: 0,
      elapsed: 0,
      actionTicks: 0,
      fronts: FRONT_DEFINITIONS.map(createFrontState),
    };
  }

  function countCleared() {
    return state.fronts.reduce((total, front) => total + Number(front.cleared), 0);
  }

  function countCaptured() {
    return state.fronts.reduce((total, front) => total + Number(front.captured), 0);
  }

  function allFrontsCleared() {
    return countCleared() === state.fronts.length;
  }

  function setStatus(message) {
    statusNode.textContent = message;
  }

  function exposeSeals() {
    if (!allFrontsCleared()) return;
    for (const front of state.fronts) {
      if (!front.captured) front.sealState = "exposed";
    }
    setStatus("All three fronts are clear. Select each exposed seal and invoke Bind Seal.");
  }

  function finishGame(mode) {
    state.mode = mode;
    state.actionTicks = 0;
    stopLoop();
    if (mode === "victory") {
      setStatus("Victory. All three seals are bound and the abyssal route is closed.");
    } else {
      setStatus("Game over. Lantern integrity has fallen to zero. Press R to restart.");
    }
  }

  function advanceThreat(frontIndex) {
    const front = state.fronts[frontIndex];
    const definition = FRONT_DEFINITIONS[frontIndex];
    const nextIndex = front.enemyIndex + 1;

    if (nextIndex < definition.threats.length) {
      front.enemyIndex = nextIndex;
      front.enemyHealth = definition.threats[nextIndex].health;
      front.spawnTimer = SPAWN_DELAY_SECONDS;
      setStatus(`${definition.name} is reforming: ${definition.threats[nextIndex].name} approaches.`);
      return;
    }

    front.enemyHealth = 0;
    front.spawnTimer = 0;
    front.cleared = true;
    setStatus(`${definition.name} is clear. ${countCleared()} of 3 fronts secured.`);
    exposeSeals();
  }

  function simulateTick() {
    if (state.mode !== "running") return;

    state.tick += 1;
    state.elapsed = state.tick * FIXED_STEP;
    state.energy = Math.min(MAX_ENERGY, state.energy + ENERGY_REGEN_PER_SECOND * FIXED_STEP);
    if (state.actionTicks > 0) state.actionTicks -= 1;

    for (let index = 0; index < state.fronts.length; index += 1) {
      const front = state.fronts[index];
      if (front.cleared) continue;

      if (front.spawnTimer > 0) {
        front.spawnTimer = Math.max(0, front.spawnTimer - FIXED_STEP);
        continue;
      }

      const definition = FRONT_DEFINITIONS[index];
      const threat = definition.threats[front.enemyIndex];
      front.pressure += threat.pressureRate * FIXED_STEP;

      while (front.pressure >= 100 && state.mode === "running") {
        front.pressure -= 100;
        state.integrity = Math.max(0, state.integrity - definition.impact);
        setStatus(`${definition.name} breaches the ward for ${definition.impact} integrity.`);
        if (state.integrity <= 0) finishGame("gameover");
      }
    }
  }

  function updateMeter(meter, fill, value, maximum) {
    const bounded = Math.max(0, Math.min(maximum, value));
    meter.setAttribute("aria-valuenow", String(Number(bounded.toFixed(2))));
    fill.style.transform = `scaleX(${bounded / maximum})`;
  }

  function renderFrontNavigation() {
    for (let index = 0; index < frontButtons.length; index += 1) {
      const button = frontButtons[index];
      const front = state.fronts[index];
      const selected = index === state.selectedFront;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = state.mode !== "running";
      button.dataset.sealState = front.sealState;

      let stateLabel = "Contested";
      if (front.captured) stateLabel = "Captured";
      else if (front.sealState === "exposed") stateLabel = "Seal exposed";
      else if (front.cleared) stateLabel = "Clear";
      frontStateNodes[index].textContent = stateLabel;
    }
  }

  function renderStage() {
    const selectedIndex = state.selectedFront;
    const front = state.fronts[selectedIndex];
    const definition = FRONT_DEFINITIONS[selectedIndex];
    const threat = definition.threats[front.enemyIndex];

    stage.dataset.front = definition.id;
    stage.dataset.sealState = front.sealState;
    stage.dataset.threatState = front.captured
      ? "captured"
      : front.cleared
        ? "cleared"
        : front.spawnTimer > 0
          ? "spawn"
          : "active";
    stage.classList.toggle("is-striking", state.actionTicks > 0 && state.mode === "running");
    stageName.textContent = definition.name;

    if (front.captured) threatName.textContent = "Seal captured · front dormant";
    else if (front.cleared) threatName.textContent = "Threat sequence cleared";
    else if (front.spawnTimer > 0) threatName.textContent = `${threat.name} · forming`;
    else threatName.textContent = `${threat.name} · ${Math.ceil(front.enemyHealth)} / ${threat.health} resolve`;

    sealNode.dataset.sealState = front.sealState;
    sealLabel.textContent = front.captured
      ? "Seal captured"
      : front.sealState === "exposed"
        ? "Seal exposed"
        : "Seal locked";

    for (const scene of sceneNodes) {
      scene.classList.toggle("is-active", scene.dataset.frontScene === definition.id);
    }

    const reduceMotion = reducedMotionQuery.matches;
    const idleFrame = reduceMotion || state.mode !== "running" ? 0 : Math.floor(state.tick / 10) % 4;
    const cohortFrame = reduceMotion || state.mode !== "running" ? 0 : Math.floor((state.tick + 5) / 10) % 4;
    for (const sprite of spriteNodes) {
      const isWarden = sprite.dataset.sprite === "warden";
      const attackFrame = reduceMotion ? 2 : Math.min(4, Math.floor((ACTION_DURATION_TICKS - state.actionTicks) / 4));
      const frame = isWarden && state.actionTicks > 0 ? attackFrame : isWarden ? idleFrame : cohortFrame;
      const row = isWarden && state.actionTicks > 0 ? 2 : 0;
      sprite.style.setProperty("--frame-x", `${frame * (-100 / 6)}%`);
      sprite.style.setProperty("--frame-y", `${row * (-100 / 3)}%`);
    }
  }

  function renderAbilities() {
    const front = state.fronts[state.selectedFront];
    const cleared = allFrontsCleared();

    for (const button of abilityButtons) {
      const abilityId = button.dataset.ability;
      const ability = ABILITIES[abilityId];
      const hasEnergy = state.energy + 1e-9 >= ability.cost;
      let available = state.mode === "running" && hasEnergy;
      if (abilityId === "bind-seal") {
        available = available && cleared && front.sealState === "exposed" && !front.captured;
      } else {
        available = available && !front.cleared && front.spawnTimer <= 0;
      }
      button.disabled = !available;
      button.setAttribute("aria-label", `${ability.label}, costs ${ability.cost} seal energy${available ? "" : ", unavailable"}`);
    }
  }

  function renderOutcome() {
    const finished = state.mode !== "running";
    outcome.hidden = !finished;
    if (!finished) return;

    if (state.mode === "victory") {
      outcomeKicker.textContent = "Protocol complete";
      outcomeTitle.textContent = "All seals bound";
      outcomeMessage.textContent = "The Cinder Span, Abyss Chancel, and Echo Throne fall silent.";
    } else {
      outcomeKicker.textContent = "The lantern gutters";
      outcomeTitle.textContent = "The lantern is extinguished";
      outcomeMessage.textContent = "Pressure consumed the ward before the three seals could be captured.";
    }
  }

  function render() {
    const selectedFront = state.fronts[state.selectedFront];
    body.dataset.gameState = state.mode;
    renderFrontNavigation();
    renderStage();
    renderAbilities();

    updateMeter(integrityMeter, integrityFill, state.integrity, MAX_INTEGRITY);
    integrityValue.textContent = `${Math.ceil(state.integrity)} / ${MAX_INTEGRITY}`;
    updateMeter(energyMeter, energyFill, state.energy, MAX_ENERGY);
    energyValue.textContent = `${state.energy.toFixed(1)} / ${MAX_ENERGY}`;
    updateMeter(pressureMeter, pressureFill, selectedFront.pressure, 100);
    pressureValue.textContent = `${Math.floor(selectedFront.pressure)}%`;
    clearsValue.textContent = `${countCleared()} / ${state.fronts.length}`;
    capturesValue.textContent = `${countCaptured()} / ${state.fronts.length}`;
    renderOutcome();
  }

  function selectFront(index) {
    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= state.fronts.length) return false;
    if (state.mode !== "running") return false;
    state.selectedFront = numericIndex;
    const definition = FRONT_DEFINITIONS[numericIndex];
    setStatus(`${definition.name} selected. ${state.fronts[numericIndex].captured ? "Seal captured." : "Issue a Warden command."}`);
    render();
    return true;
  }

  function useAbility(abilityId) {
    if (state.mode !== "running") return false;
    const ability = ABILITIES[abilityId];
    if (!ability || state.energy + 1e-9 < ability.cost) return false;

    const frontIndex = state.selectedFront;
    const front = state.fronts[frontIndex];
    const definition = FRONT_DEFINITIONS[frontIndex];

    if (abilityId === "bind-seal") {
      if (!allFrontsCleared() || front.captured || front.sealState !== "exposed") return false;
      state.energy = Math.max(0, state.energy - ability.cost);
      front.captured = true;
      front.sealState = "captured";
      state.actionTicks = ACTION_DURATION_TICKS;
      setStatus(`${definition.name} seal captured. ${countCaptured()} of 3 seals bound.`);
      if (countCaptured() === state.fronts.length) finishGame("victory");
      render();
      return true;
    }

    if (front.cleared || front.spawnTimer > 0) return false;
    state.energy = Math.max(0, state.energy - ability.cost);
    state.actionTicks = ACTION_DURATION_TICKS;
    front.enemyHealth = Math.max(0, front.enemyHealth - ability.damage);
    if (front.enemyHealth <= 0) {
      const defeatedName = definition.threats[front.enemyIndex].name;
      setStatus(`${ability.label} breaks ${defeatedName}.`);
      advanceThreat(frontIndex);
    } else {
      setStatus(`${ability.label} strikes ${definition.threats[front.enemyIndex].name} for ${ability.damage}.`);
    }
    render();
    return true;
  }

  function stopLoop() {
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    previousFrameTime = null;
    frameAccumulator = 0;
  }

  function requestNextFrame() {
    if (!pageActive || state.mode !== "running" || frameRequest) return;
    frameRequest = window.requestAnimationFrame(onAnimationFrame);
  }

  function onAnimationFrame(timestamp) {
    frameRequest = 0;
    if (!pageActive || state.mode !== "running") return;

    if (previousFrameTime === null) previousFrameTime = timestamp;
    const delta = Math.min(MAX_FRAME_DELTA, Math.max(0, (timestamp - previousFrameTime) / 1000));
    previousFrameTime = timestamp;
    frameAccumulator += delta;

    let catchUpSteps = 0;
    while (frameAccumulator + 1e-12 >= FIXED_STEP && catchUpSteps < MAX_CATCH_UP_STEPS && state.mode === "running") {
      simulateTick();
      frameAccumulator -= FIXED_STEP;
      catchUpSteps += 1;
    }
    if (catchUpSteps === MAX_CATCH_UP_STEPS && frameAccumulator >= FIXED_STEP) {
      frameAccumulator %= FIXED_STEP;
    }

    render();
    requestNextFrame();
  }

  function restart() {
    stopLoop();
    state = createInitialState();
    manualAccumulator = 0;
    setStatus("Cinder Span selected. Break every threat sequence, then bind the exposed seals.");
    render();
    requestNextFrame();
    return snapshot();
  }

  function step(seconds) {
    const duration = Number(seconds);
    if (!Number.isFinite(duration) || duration < 0) return snapshot();

    const shouldResume = pageActive && state.mode === "running";
    stopLoop();
    manualAccumulator += Math.min(duration, 600);
    let guard = 0;
    const maximumTicks = 600 * 60 + 1;
    while (manualAccumulator + 1e-12 >= FIXED_STEP && state.mode === "running" && guard < maximumTicks) {
      simulateTick();
      manualAccumulator -= FIXED_STEP;
      guard += 1;
    }
    render();
    if (shouldResume && state.mode === "running") requestNextFrame();
    return snapshot();
  }

  function snapshot() {
    const fronts = state.fronts.map((front) => Object.freeze({
      id: front.id,
      pressure: Number(front.pressure.toFixed(4)),
      cleared: front.cleared,
      captured: front.captured,
      sealState: front.sealState,
      enemyIndex: front.enemyIndex,
      enemyHealth: Number(front.enemyHealth.toFixed(4)),
      spawnTimer: Number(front.spawnTimer.toFixed(4)),
    }));

    return Object.freeze({
      mode: state.mode,
      selectedFront: state.selectedFront,
      selectedFrontId: FRONT_DEFINITIONS[state.selectedFront].id,
      integrity: Number(state.integrity.toFixed(4)),
      energy: Number(state.energy.toFixed(4)),
      sealsCaptured: countCaptured(),
      frontsCleared: countCleared(),
      tick: state.tick,
      elapsed: Number(state.elapsed.toFixed(4)),
      loopRunning: Boolean(frameRequest),
      fronts: Object.freeze(fronts),
    });
  }

  for (const button of frontButtons) {
    button.addEventListener("click", () => selectFront(Number(button.dataset.frontIndex)));
  }

  for (const button of abilityButtons) {
    button.addEventListener("click", () => useAbility(button.dataset.ability));
  }

  for (const button of restartButtons) {
    button.addEventListener("click", restart);
  }

  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "1" || key === "2" || key === "3") {
      event.preventDefault();
      selectFront(Number(key) - 1);
    } else if (key === "q") {
      event.preventDefault();
      useAbility("crescent");
    } else if (key === "w") {
      event.preventDefault();
      useAbility("rift-lance");
    } else if (key === "e") {
      event.preventDefault();
      useAbility("bind-seal");
    } else if (key === "r") {
      event.preventDefault();
      restart();
    }
  });

  window.addEventListener("pagehide", () => {
    pageActive = false;
    stopLoop();
  });

  window.addEventListener("pageshow", () => {
    pageActive = true;
    requestNextFrame();
  });

  reducedMotionQuery.addEventListener("change", render);

  const testApi = Object.freeze({ snapshot, restart, selectFront, useAbility, step });
  Object.defineProperty(window, "__SEALBOUND_TEST__", {
    value: testApi,
    writable: false,
    configurable: false,
    enumerable: false,
  });

  restart();
})();
