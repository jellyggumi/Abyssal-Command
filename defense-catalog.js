/** Immutable authored data for the renderer-neutral Abyssal Command defense run. */
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

export const RULES_VERSION = "defense-survivor-v1";
export const TICK_RATE = 60;
export const ARENA = freeze({ width: 24000, height: 12000, gateX: 22000, gateY: 6000 });
export const OCTANT_VECTORS = freeze({
  IDLE: freeze({ x: 0, y: 0 }),
  N: freeze({ x: 0, y: -1000 }), NE: freeze({ x: 707, y: -707 }), E: freeze({ x: 1000, y: 0 }),
  SE: freeze({ x: 707, y: 707 }), S: freeze({ x: 0, y: 1000 }), SW: freeze({ x: -707, y: 707 }),
  W: freeze({ x: -1000, y: 0 }), NW: freeze({ x: -707, y: -707 }),
});
export const COMMANDER = freeze({
  radius: 360,
  speed: 4100,
  basicCooldown: 24,
  basicDamage: 900,
  basicRange: 6000,
  maxIntegrity: 1000,
  integrity: 1000,
  critProfile: freeze({
    sources: freeze(["basic", "skill"]),
    chanceBp: 1500,
    multiplierBp: 20000,
  }),
});
export const MEASUREMENT_FIXTURE_BUDGET_ID = "g2-measurement-fixture-budget-v1";
export const QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID = "qa-multi-skill-measurement-v1";
export const QA_MULTI_SKILL_MEASUREMENT_FIXTURE = freeze({
  id: QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID,
  name: "QA Multi-Skill Measurement",
  qaOnly: true,
  budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
  maxIntegrity: 1000,
  basicCooldownTicks: 24,
  basicDamage: 900,
  critProfile: freeze({
    sources: freeze(["basic", "skill"]),
    chanceBp: 1500,
    multiplierBp: 17000,
  }),
  activeSkillId: "soul-lance",
  activeSkillIds: freeze(["soul-lance", "grave-pulse"]),
  fixtureActiveCooldownTicks: 270,
});
export const MEASUREMENT_PROFILES = freeze({
  bulwark: freeze({
    id: "bulwark",
    name: "Bulwark",
    budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
    maxIntegrity: 1250,
    basicCooldownTicks: 30,
    basicDamage: 900,
    critProfile: freeze({
      sources: freeze(["basic", "skill"]),
      chanceBp: 500,
      multiplierBp: 15000,
    }),
    activeSkillId: "void-aegis",
    fixtureActiveCooldownTicks: 300,
  }),
  striker: freeze({
    id: "striker",
    name: "Striker",
    budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
    maxIntegrity: 1000,
    basicCooldownTicks: 18,
    basicDamage: 900,
    critProfile: freeze({
      sources: freeze(["basic", "skill"]),
      chanceBp: 1500,
      multiplierBp: 17000,
    }),
    activeSkillId: "soul-lance",
    fixtureActiveCooldownTicks: 270,
  }),
  gambit: freeze({
    id: "gambit",
    name: "Gambit",
    budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
    maxIntegrity: 900,
    basicCooldownTicks: 30,
    basicDamage: 900,
    critProfile: freeze({
      sources: freeze(["basic", "skill"]),
      chanceBp: 3000,
      multiplierBp: 19000,
    }),
    activeSkillId: "grave-pulse",
    fixtureActiveCooldownTicks: 240,
  }),
  conductor: freeze({
    id: "conductor",
    name: "Conductor",
    budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
    maxIntegrity: 1000,
    basicCooldownTicks: 24,
    basicDamage: 900,
    critProfile: freeze({
      sources: freeze(["basic", "skill"]),
      chanceBp: 1500,
      multiplierBp: 17000,
    }),
    activeSkillId: "shadow-step",
    fixtureActiveCooldownTicks: 120,
  }),
  rift: freeze({
    id: "rift",
    name: "Rift",
    budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
    maxIntegrity: 1000,
    basicCooldownTicks: 30,
    basicDamage: 900,
    critProfile: freeze({
      sources: freeze(["basic", "skill"]),
      chanceBp: 2000,
      multiplierBp: 18000,
    }),
    activeSkillId: "shadow-step",
    fixtureActiveCooldownTicks: 210,
  }),
});
export const GATE = freeze({ maxIntegrity: 1000, radius: 900 });
export const TARGET_PRIORITY = freeze({ boss: 0, elite: 1, ranged: 2, guardian: 3, flanker: 4, rusher: 5, interactable: 6 });
export const XP_GROWTH = freeze([30, 55, 85, 120, 160, 205, 255, 310]);
export const ITEMS = freeze({
  "ashen-sigil": { id: "ashen-sigil", name: "Ashen Sigil", description: "기본 공격 피해 +180", damageBonus: 180 },
  "ward-splinter": { id: "ward-splinter", name: "Ward Splinter", description: "관문 최대 내구 +80, 즉시 +80", maxIntegrity: 80, integrity: 80 },
  "echo-compass": { id: "echo-compass", name: "Echo Compass", description: "XP 흡수 반경 +2500", pickupRange: 2500 },
  "hourglass-fragment": { id: "hourglass-fragment", name: "Hourglass Fragment", description: "스킬 쿨다운 10% 감소", cooldownReduction: 0.1 },
  "dawnless-crown-shard": { id: "dawnless-crown-shard", name: "Moonless Command Shard", description: "Moonless Court 명령 파편: 기본 공격 피해 +240, 관문 최대 내구 +120", damageBonus: 240, maxIntegrity: 120, integrity: 120 },
});
export const REWARDS = freeze({
  "ember-cohort-legacy": { id: "ember-cohort-legacy", name: "Ember Cohort Legacy", description: "다음 런의 동료 슬롯에 Ember Cohort 기록", kind: "companion", companionId: "ember-cohort" },
  "rift-lens-archive": { id: "rift-lens-archive", name: "Rift Lens Archive", description: "Rift Lens의 결속 기록을 기록실에 보존", kind: "archive" },
  "stillwater-hourglass": { id: "stillwater-hourglass", name: "Stillwater Hourglass", description: "런 시작 시 스킬 쿨다운 20% 감소", kind: "modifier", cooldownReduction: 0.2 },
  "bulwark-brand": { id: "bulwark-brand", name: "Bulwark Brand", description: "보스 반격 피해 2 감소", kind: "modifier", gateDamageReduction: 2 },
  "veil-vanguard-legacy": { id: "veil-vanguard-legacy", name: "Veil Vanguard Legacy", description: "다음 런 시작 시 그림자 1기 추가", kind: "companion", companionId: "veil-vanguard" },
  "anchor-shard-archive": { id: "anchor-shard-archive", name: "Anchor Shard Archive", description: "다음 스테이지 진입 시 관문 내구 +40", kind: "modifier", integrity: 40 },
  "abyssal-banner": { id: "abyssal-banner", name: "Abyssal Banner", description: "런 시작 및 이후 추출 동료 공격력 +60", kind: "modifier", damageBonus: 60 },
  "throne-echo-record": { id: "throne-echo-record", name: "Moonless Court Echo Record", description: "Moonless Court 왕좌에서 회수한 잔향을 기록실에 보존", kind: "archive" },
  "dawnless-crown": { id: "dawnless-crown", name: "Moonless Command Archive", description: "Moonless Court의 최종 명령 잔향을 기록실에 보존", kind: "archive" },
});
export const AUDIO_CUES = freeze({
  stageStart: { id: "stage-start", waveform: "sine", frequency: 220, duration: 0.18 },
  enemyDefeated: { id: "enemy-defeated", waveform: "triangle", frequency: 160, duration: 0.08 },
  eliteExtracted: { id: "elite-extracted", waveform: "sine", frequency: 420, duration: 0.32 },
  itemCollected: { id: "item-collected", waveform: "sine", frequency: 560, duration: 0.2 },
  growthOffer: { id: "growth-offer", waveform: "triangle", frequency: 320, duration: 0.24 },
  skillCast: { id: "skill-cast", waveform: "sawtooth", frequency: 260, duration: 0.14 },
  bossSpawned: { id: "boss-spawned", waveform: "sawtooth", frequency: 90, duration: 0.5 },
  movementStep: { id: "movement-step", waveform: "triangle", frequency: 92, duration: 0.045 },
  weaponFire: { id: "weapon-fire", waveform: "square", frequency: 310, duration: 0.055 },
  impactHit: { id: "impact-hit", waveform: "sawtooth", frequency: 118, duration: 0.07 },
  criticalHit: { id: "critical-hit", waveform: "square", frequency: 480, duration: 0.12 },
  extractionReady: { id: "extraction-ready", waveform: "sine", frequency: 360, duration: 0.22 },
  occupationCaptured: { id: "occupation-captured", waveform: "triangle", frequency: 240, duration: 0.18 },
  terminal: { id: "terminal", waveform: "sine", frequency: 120, duration: 0.5 },
});
export const ARCHIVE_RETURN = freeze({
  ruleVersion: RULES_VERSION,
  maxElapsedHours: 12,
  creditsPerHour: 1,
  maxCredits: 12,
  nonCombat: true,
  commerce: false,
});
export const CUTSCENES = freeze({
  "cinder-span": {
    intro: ["심연의 문이 열렸다.", "잿빛 교량에서 재의 메아리를 묶어라."],
    bossEntry: "잿빛 파수꾼이 용광로의 사슬을 끌며 둑길을 차단한다.",
    elite: "열기가 없는 불씨가 영혼 웅덩이를 남긴다.",
    victory: "다리 끝의 재가 다음 봉쇄선을 가리킨다.",
    defeat: "첫 번째 봉쇄선이 끊어졌다. Dusk Warden, 관문으로 복귀하라.",
  },
  "veil-citadel": {
    intro: ["장막 성채가 신호를 삼킨다.", "점유점과 추출점을 붙들고 장막의 잔향을 결속하라."],
    elite: "감시석의 빈 투구가 새로운 의지를 기다린다.",
    victory: "거울의 명령이 끊기고 왕좌의 방향이 열린다.",
    defeat: "장막이 다시 닫혔다. 신호를 되찾아라.",
  },
  "echo-throne": {
    intro: ["Moonless Court의 메아리 왕좌가 세 번째 봉쇄선 위에 떠 있다.", "한 번뿐인 군주의 영역으로 관문을 버텨라."],
    elite: "왕좌의 잔향이 Moonless Court의 명령을 기억한다.",
    victory: "왕좌의 명령이 끊기고 세 번째 봉쇄선이 이어졌다.",
    defeat: "왕좌의 명령이 관문을 되찾았다. 세 번째 봉쇄선으로 복귀하라.",
  },
  "sunken-bastion": {
    intro: ["가라앉은 보루의 네 번째 봉쇄선이 흔들린다.", "침수된 추출점을 점유하고 닻의 잔향을 결속하라."],
    elite: "닻의 잔향이 물길의 추출점에 머문다.",
    victory: "조류의 명령이 끊기고 네 번째 봉쇄선이 이어졌다.",
    defeat: "침수 압력이 관문을 무너뜨렸다. 네 번째 봉쇄선으로 복귀하라.",
  },
  "howling-sprawl": {
    intro: ["울부짖는 황야가 다섯 번째 관문의 측면을 연다.", "측면 추출점을 점유하고 무리의 잔향을 회수하라."],
    elite: "무리의 잔향이 바람길의 결속 신호로 남는다.",
    victory: "측면의 명령이 끊기고 다섯 번째 봉쇄선이 닫혔다.",
    defeat: "측면 압력이 관문을 갈랐다. 다섯 번째 봉쇄선으로 복귀하라.",
  },
  "glass-necropolis": {
    intro: ["유리 묘역의 고지가 여섯 번째 관문을 내려다본다.", "반사되는 사선을 피해 추출점을 점유하라."],
    elite: "합창의 잔향이 깨진 기록면 위에 머문다.",
    victory: "반사된 명령이 멎고 여섯 번째 봉쇄선이 이어졌다.",
    defeat: "집중 사격이 관문을 깨뜨렸다. 여섯 번째 봉쇄선으로 복귀하라.",
  },
  "starless-canal": {
    intro: ["별 없는 운하가 일곱 번째 관문으로 갈라진다.", "위험 수로의 추출점을 점유하고 통행 잔향을 회수하라."],
    elite: "통행의 잔향이 잠긴 수문에서 결속을 기다린다.",
    victory: "수로의 명령이 끊기고 일곱 번째 봉쇄선이 이어졌다.",
    defeat: "갈라진 수로가 관문을 포위했다. 일곱 번째 봉쇄선으로 복귀하라.",
  },
  "shattered-causeway": {
    intro: ["부서진 둑길이 여덟 번째 관문 앞에서 끊겼다.", "붕괴 구간의 추출점을 점유하고 교량 잔향을 결속하라."],
    elite: "교량의 잔향이 무너진 연결부를 붙든다.",
    victory: "거상의 압력이 멎고 여덟 번째 봉쇄선이 이어졌다.",
    defeat: "붕괴 충격이 관문에 닿았다. 여덟 번째 봉쇄선으로 복귀하라.",
  },
  "abyss-chancel": {
    intro: ["심연 예배소의 서약이 아홉 번째 관문을 억누른다.", "서약의 추출점을 점유하고 명령 잔향을 역전하라."],
    elite: "서명자의 잔향이 결속할 새 명령을 기다린다.",
    victory: "가려진 서약이 끊기고 아홉 번째 봉쇄선이 이어졌다.",
    defeat: "서약의 압력이 관문을 닫았다. 아홉 번째 봉쇄선으로 복귀하라.",
  },
  "gate-zenith": {
    intro: ["Gate Zenith에서 Moonless Court의 명령망이 Echo Deep과 맞닿는다.", "Dusk Warden, 마지막 추출점을 점유하고 열 번째 관문을 지켜라."],
    elite: "섭정의 잔향이 마지막 결속 신호로 남는다.",
    victory: "Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다.",
    defeat: "마지막 관문이 무너졌다. Dusk Warden, 열 번째 봉쇄선으로 복귀하라.",
  },
  default: {
    intro: ["새 봉쇄선이 신호를 삼킨다.", "관문을 지키고 메아리를 추출하라."],
    elite: "잔향이 다음 전선을 가리킨다.",
    victory: "봉쇄선이 유지되고 다음 관문이 열린다.",
    defeat: "관문이 무너졌다. 다시 일어나라.",
  },
});
export const ANIMATION_CLIPS = freeze({
  commander: Object.freeze(["idle", "walk", "strike", "cast", "damage", "low-hp"]),
  enemy: Object.freeze(["idle", "advance", "strike", "defeat", "flank", "escort"]),
  effects: Object.freeze(["extract", "extraction-ready", "item", "skill", "reward", "occupation", "echo-recovery", "boss-defeat"]),
});

export const ENEMY_POLICIES = freeze({
  "gate-pressure": { id: "gate-pressure", target: "gate", intent: "breach" },
  "player-pursuit": { id: "player-pursuit", target: "commander", intent: "attack" },
  flank: { id: "flank", target: "gate", intent: "flank" },
  "resource-denial": { id: "resource-denial", target: "echo-pickup", intent: "deny" },
  "elite-escort": { id: "elite-escort", target: "elite", intent: "escort" },
  "low-hp-focus": { id: "low-hp-focus", target: "lowest-hp-friendly", intent: "focus" },
});

export const ENEMIES = freeze({
  rusher: { id: "rusher", hp: 3000, speed: 3000, damage: 10, attackTicks: 60, xp: 8, radius: 260, policyId: "gate-pressure" },
  flanker: { id: "flanker", hp: 3600, speed: 3300, damage: 12, attackTicks: 60, xp: 10, radius: 340, policyId: "flank" },
  guardian: { id: "guardian", hp: 9000, speed: 1700, damage: 20, attackTicks: 90, xp: 18, radius: 540, policyId: "elite-escort" },
  ranged: { id: "ranged", hp: 2800, speed: 2000, damage: 20, attackTicks: 120, xp: 12, radius: 320, projectileRange: 6000, projectileTicks: 120, policyId: "resource-denial" },
});
export const COMPANIONS = freeze({
  "ember-cohort": { id: "ember-cohort", name: "Ember Cohort", damage: 420, fireTicks: 36, range: 4600 },
  "rift-lens": { id: "rift-lens", name: "Rift Lens", damage: 540, fireTicks: 48, range: 5200 },
  "veil-vanguard": { id: "veil-vanguard", name: "Veil Vanguard", damage: 360, fireTicks: 28, range: 4000 },
  "anchor-shard": { id: "anchor-shard", name: "Anchor Shard", damage: 720, fireTicks: 70, range: 5600 },
  "throne-echo": { id: "throne-echo", name: "Throne Echo", damage: 480, fireTicks: 38, range: 4800 },
  "dawnless-crown": { id: "dawnless-crown", name: "Moonless Command", damage: 600, fireTicks: 52, range: 6000 },
});
export const SKILLS = freeze({
  "rift-bolt": { id: "rift-bolt", name: "Echo Bolt", role: "active", kind: "active", damage: 1800, cooldown: 390, radius: 0 },
  "soul-lance": { id: "soul-lance", name: "Echo Lance", role: "active", kind: "active", damage: 1200, cooldown: 270, radius: 0 },
  "grave-pulse": { id: "grave-pulse", name: "Echo Pulse", role: "active", kind: "active", damage: 650, cooldown: 240, radius: 3000 },
  "void-aegis": { id: "void-aegis", name: "Gate Aegis", role: "active", kind: "active", damage: 0, cooldown: 300, radius: 0, integrity: 50 },
  "shadow-step": { id: "shadow-step", name: "Dusk Step", role: "active", kind: "active", damage: 900, cooldown: 210, radius: 4500 },
  "eclipse-edge": { id: "eclipse-edge", name: "Dusk Edge", role: "passive", kind: "passive", basicDamage: 180 },
  "soul-magnet": { id: "soul-magnet", name: "Echo Magnet", role: "passive", kind: "passive", pickupRange: 1500 },
  "ward-binder": { id: "ward-binder", name: "Gate Binder", role: "passive", kind: "passive", maxIntegrity: 120 },
});
export const BOSSES = freeze({
  "s1-cinder-warden": { id: "s1-cinder-warden", hp: 40000, speed: 1800, damage: 200, attackTicks: 90, xp: 100, radius: 900, policyId: "player-pursuit" },
  "s2-veil-tactician": { id: "s2-veil-tactician", hp: 48000, speed: 1650, damage: 200, attackTicks: 90, xp: 110, radius: 900, policyId: "resource-denial" },
  "s3-gate-sovereign": { id: "s3-gate-sovereign", hp: 60000, speed: 1500, damage: 300, attackTicks: 90, xp: 120, radius: 980, policyId: "low-hp-focus" },
  "s4-tide-warden": { id: "s4-tide-warden", hp: 68000, speed: 1500, damage: 200, attackTicks: 90, xp: 130, radius: 980, policyId: "gate-pressure" },
  "s5-pack-herald": { id: "s5-pack-herald", hp: 76000, speed: 2100, damage: 200, attackTicks: 90, xp: 140, radius: 900, policyId: "flank" },
  "s6-requiem-choir": { id: "s6-requiem-choir", hp: 84000, speed: 1350, damage: 200, attackTicks: 90, xp: 150, radius: 980, policyId: "low-hp-focus" },
  "s7-lantern-tyrant": { id: "s7-lantern-tyrant", hp: 92000, speed: 1650, damage: 200, attackTicks: 90, xp: 160, radius: 980, policyId: "resource-denial" },
  "s8-bridge-colossus": { id: "s8-bridge-colossus", hp: 100000, speed: 1200, damage: 300, attackTicks: 90, xp: 170, radius: 1100, policyId: "gate-pressure" },
  "s9-veiled-concordat": { id: "s9-veiled-concordat", hp: 110000, speed: 1500, damage: 200, attackTicks: 90, xp: 180, radius: 1040, policyId: "elite-escort" },
  "s10-abyss-regent": { id: "s10-abyss-regent", hp: 150000, speed: 1800, damage: 300, attackTicks: 90, xp: 200, radius: 1100, policyId: "player-pursuit" },
});

export const CINDER_SPAN_SURPRISE_TABLE = freeze({
  id: "cinder-span-surprise",
  chanceBp: 2500,
  outcomes: freeze([
    { id: "ash-echo-whisper", text: "옛 교량의 재가 바람에 흩어지며 희미한 메아리를 남긴다." },
    { id: "forge-ember-flicker", text: "잠긴 용광로 잔해에서 작은 불씨 하나가 튀어오른다." },
  ]),
});

export const CINDER_SPAN_WAVE_PLAN = freeze([
  {
    slot: 0,
    tick: 0,
    primary: freeze({ enemy: "rusher", count: 4 }),
    alternatives: freeze([
      { id: "opening-rusher-pure", composition: freeze([{ enemy: "rusher", count: 4 }]) },
      { id: "opening-rusher-flanker", composition: freeze([{ enemy: "rusher", count: 2 }, { enemy: "flanker", count: 2 }]) },
    ]),
  },
  {
    slot: 1,
    tick: 180,
    primary: freeze({ enemy: "flanker", count: 3 }),
    alternatives: freeze([
      { id: "pressure-flanker-pure", composition: freeze([{ enemy: "flanker", count: 3 }]) },
      { id: "pressure-flanker-rusher", composition: freeze([{ enemy: "flanker", count: 2 }, { enemy: "rusher", count: 1 }]) },
    ]),
  },
  {
    slot: 2,
    tick: 390,
    primary: freeze({ enemy: "ranged", count: 2 }),
    alternatives: freeze([
      { id: "denial-ranged-pure", composition: freeze([{ enemy: "ranged", count: 2 }]) },
      { id: "denial-ranged-flanker", composition: freeze([{ enemy: "ranged", count: 1 }, { enemy: "flanker", count: 1 }]) },
    ]),
  },
]);

export const STAGE_TACTICS = freeze({
  "cinder-span": {
    chokepath: { id: "cinder-center", x: 18000, halfWidth: 2200 },
    flank: { id: "cinder-south", entryX: 12000, entryY: 9800 },
    elevation: { id: "cinder-overlook", x: 16600, y: 2600, rangeMultiplier: 1.08 },
    hazard: { id: "ash-surge", x: 14800, y: 6000, radius: 1100, damagePerSecond: 8 },
    occupation: { id: "cinder-seal", x: 17600, y: 6000, radius: 900, holdTicks: 180, effects: { moveMultiplier: 1.05, rangeMultiplier: 1.08, recoveryPerSecond: 4 } },
    extraction: { id: "cinder-bind", x: 15400, y: 6000, radius: 1000, windowTicks: 600 },
    spawnDirections: ["W", "SW"], seededVariation: { timingJitterTicks: 12, densityDelta: 1, laneJitter: 300 },
    mapVariant: freeze({
      version: "v1",
      modules: freeze(["ember-relay-spire", "drowned-forge-arch"]),
      protectedCorridor: freeze({
        declared: true,
        preservesObjectives: true,
        preservesRoutes: true,
      }),
    }),
    surpriseTable: CINDER_SPAN_SURPRISE_TABLE,
  },
  "veil-citadel": {
    chokepath: { id: "veil-twins", x: 18400, halfWidth: 1800 },
    flank: { id: "veil-north", entryX: 12400, entryY: 1800 },
    elevation: { id: "veil-rampart", x: 17000, y: 3000, rangeMultiplier: 1.12 },
    hazard: { id: "mirror-static", x: 15400, y: 7200, radius: 1000, damagePerSecond: 9 },
    occupation: { id: "veil-signal", x: 18000, y: 4200, radius: 850, holdTicks: 210, effects: { moveMultiplier: 1.04, rangeMultiplier: 1.1, recoveryPerSecond: 5 } },
    extraction: { id: "veil-bind", x: 15800, y: 3400, radius: 950, windowTicks: 600 },
    spawnDirections: ["W", "NW"], seededVariation: { timingJitterTicks: 15, densityDelta: 1, laneJitter: 360 },
  },
  "echo-throne": {
    chokepath: { id: "throne-aisle", x: 18800, halfWidth: 1600 },
    flank: { id: "throne-south", entryX: 12800, entryY: 10400 },
    elevation: { id: "throne-dais", x: 18200, y: 6000, rangeMultiplier: 1.1 },
    hazard: { id: "echo-rift", x: 16000, y: 6000, radius: 1250, damagePerSecond: 10 },
    occupation: { id: "throne-domain", x: 18400, y: 6000, radius: 800, holdTicks: 240, effects: { moveMultiplier: 1.06, rangeMultiplier: 1.08, recoveryPerSecond: 6 } },
    extraction: { id: "throne-bind", x: 16200, y: 7600, radius: 900, windowTicks: 600 },
    spawnDirections: ["W", "SW", "NW"], seededVariation: { timingJitterTicks: 18, densityDelta: 1, laneJitter: 420 },
  },
  "sunken-bastion": {
    chokepath: { id: "bastion-floodgate", x: 18600, halfWidth: 1500 },
    flank: { id: "bastion-channel", entryX: 12600, entryY: 10200 },
    elevation: { id: "bastion-anchor", x: 17400, y: 2800, rangeMultiplier: 1.1 },
    hazard: { id: "flood-pulse", x: 15200, y: 8200, radius: 1400, damagePerSecond: 11 },
    occupation: { id: "bastion-pump", x: 17800, y: 7600, radius: 900, holdTicks: 240, effects: { moveMultiplier: 1.05, rangeMultiplier: 1.08, recoveryPerSecond: 7 } },
    extraction: { id: "bastion-bind", x: 15600, y: 8000, radius: 950, windowTicks: 600 },
    spawnDirections: ["W", "SW"], seededVariation: { timingJitterTicks: 18, densityDelta: 1, laneJitter: 450 },
  },
  "howling-sprawl": {
    chokepath: { id: "sprawl-funnel", x: 18200, halfWidth: 1900 },
    flank: { id: "sprawl-crosswind", entryX: 12000, entryY: 1600 },
    elevation: { id: "sprawl-ridge", x: 16800, y: 2400, rangeMultiplier: 1.09 },
    hazard: { id: "howling-gust", x: 15000, y: 5000, radius: 1500, damagePerSecond: 10 },
    occupation: { id: "sprawl-beacon", x: 17400, y: 3600, radius: 950, holdTicks: 270, effects: { moveMultiplier: 1.08, rangeMultiplier: 1.06, recoveryPerSecond: 6 } },
    extraction: { id: "sprawl-bind", x: 15000, y: 2600, radius: 1000, windowTicks: 600 },
    spawnDirections: ["W", "NW", "SW"], seededVariation: { timingJitterTicks: 21, densityDelta: 1, laneJitter: 520 },
  },
  "glass-necropolis": {
    chokepath: { id: "glass-crypt", x: 19000, halfWidth: 1400 },
    flank: { id: "glass-reflection", entryX: 13200, entryY: 9800 },
    elevation: { id: "glass-spire", x: 17600, y: 2200, rangeMultiplier: 1.14 },
    hazard: { id: "glass-shardfall", x: 15800, y: 6200, radius: 1200, damagePerSecond: 13 },
    occupation: { id: "glass-choir", x: 18200, y: 3200, radius: 800, holdTicks: 270, effects: { moveMultiplier: 1.04, rangeMultiplier: 1.12, recoveryPerSecond: 7 } },
    extraction: { id: "glass-bind", x: 16000, y: 3600, radius: 900, windowTicks: 600 },
    spawnDirections: ["W", "NW"], seededVariation: { timingJitterTicks: 21, densityDelta: 1, laneJitter: 480 },
  },
  "starless-canal": {
    chokepath: { id: "canal-lock", x: 18400, halfWidth: 1500 },
    flank: { id: "canal-sluice", entryX: 12200, entryY: 10400 },
    elevation: { id: "canal-towpath", x: 17000, y: 3000, rangeMultiplier: 1.1 },
    hazard: { id: "canal-undertow", x: 14600, y: 8000, radius: 1550, damagePerSecond: 12 },
    occupation: { id: "canal-toll", x: 17600, y: 7600, radius: 900, holdTicks: 300, effects: { moveMultiplier: 1.07, rangeMultiplier: 1.08, recoveryPerSecond: 8 } },
    extraction: { id: "canal-bind", x: 15200, y: 8200, radius: 950, windowTicks: 600 },
    spawnDirections: ["W", "SW", "NW"], seededVariation: { timingJitterTicks: 24, densityDelta: 1, laneJitter: 600 },
  },
  "shattered-causeway": {
    chokepath: { id: "causeway-gap", x: 19200, halfWidth: 1200 },
    flank: { id: "causeway-rubble", entryX: 13000, entryY: 1800 },
    elevation: { id: "causeway-keystone", x: 17800, y: 2600, rangeMultiplier: 1.12 },
    hazard: { id: "causeway-collapse", x: 16000, y: 6000, radius: 1350, damagePerSecond: 15 },
    occupation: { id: "causeway-brace", x: 18400, y: 4400, radius: 800, holdTicks: 300, effects: { moveMultiplier: 1.05, rangeMultiplier: 1.1, recoveryPerSecond: 9 } },
    extraction: { id: "causeway-bind", x: 16400, y: 4000, radius: 900, windowTicks: 600 },
    spawnDirections: ["W", "NW"], seededVariation: { timingJitterTicks: 24, densityDelta: 1, laneJitter: 560 },
  },
  "abyss-chancel": {
    chokepath: { id: "chancel-nave", x: 18800, halfWidth: 1300 },
    flank: { id: "chancel-transept", entryX: 12800, entryY: 10200 },
    elevation: { id: "chancel-apse", x: 18000, y: 2600, rangeMultiplier: 1.13 },
    hazard: { id: "oath-pressure", x: 15600, y: 7000, radius: 1450, damagePerSecond: 16 },
    occupation: { id: "chancel-oath", x: 18200, y: 5200, radius: 800, holdTicks: 330, effects: { moveMultiplier: 1.05, rangeMultiplier: 1.11, recoveryPerSecond: 10 } },
    extraction: { id: "chancel-bind", x: 16000, y: 7000, radius: 850, windowTicks: 600 },
    spawnDirections: ["W", "SW", "NW"], seededVariation: { timingJitterTicks: 27, densityDelta: 1, laneJitter: 660 },
  },
  "gate-zenith": {
    chokepath: { id: "zenith-threshold", x: 19400, halfWidth: 1100 },
    flank: { id: "zenith-umbra", entryX: 13200, entryY: 1400 },
    elevation: { id: "zenith-crown", x: 18400, y: 2200, rangeMultiplier: 1.15 },
    hazard: { id: "deep-command", x: 16400, y: 6000, radius: 1600, damagePerSecond: 18 },
    occupation: { id: "zenith-last-seal", x: 18800, y: 6000, radius: 750, holdTicks: 360, effects: { moveMultiplier: 1.06, rangeMultiplier: 1.12, recoveryPerSecond: 12 } },
    extraction: { id: "zenith-bind", x: 16600, y: 6000, radius: 850, windowTicks: 600 },
    spawnDirections: ["W", "NW", "SW"], seededVariation: { timingJitterTicks: 30, densityDelta: 1, laneJitter: 720 },
  },
});

const stage = (id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss, gateTicks, waves, wavePlan = null) => freeze({
  id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss, gateTicks, waves,
  ...(wavePlan ? { wavePlan } : {}),
  tactics: STAGE_TACTICS[id],
  wavePattern: Object.freeze(["scout", "pressure", "flank", "ranged", "elite", "boss"]),
});
export const STAGES = freeze([
  stage("cinder-span", "Cinder Span", "Cinder Warden", 100, "s1-ember-hunter", "rusher", "ember-cohort", "s1-cinder-warden", 720, [[0, "rusher", 4], [180, "flanker", 3], [390, "ranged", 2]], CINDER_SPAN_WAVE_PLAN),
  stage("veil-citadel", "Veil Citadel", "Veil Tactician", 115, "s2-veil-sentinel", "flanker", "rift-lens", "s2-veil-tactician", 780, [[0, "rusher", 5], [180, "flanker", 4], [420, "ranged", 3]]),
  stage("echo-throne", "Echo Throne", "Gate Sovereign", 130, "s3-throne-wraith", "ranged", "throne-echo", "s3-gate-sovereign", 840, [[0, "flanker", 5], [210, "ranged", 3], [480, "guardian", 2]]),
  stage("sunken-bastion", "Sunken Bastion", "Tide Warden", 145, "s4-anchor-diver", "guardian", "anchor-shard", "s4-tide-warden", 900, [[0, "rusher", 6], [220, "ranged", 4], [510, "guardian", 2]]),
  stage("howling-sprawl", "Howling Sprawl", "Pack Herald", 160, "s5-pack-sentinel", "guardian", "veil-vanguard", "s5-pack-herald", 960, [[0, "flanker", 6], [240, "ranged", 4], [540, "guardian", 3]]),
  stage("glass-necropolis", "Glass Necropolis", "Requiem Choir", 175, "s6-choir-adept", "ranged", "throne-echo", "s6-requiem-choir", 1020, [[0, "rusher", 7], [260, "ranged", 5], [570, "guardian", 3]]),
  stage("starless-canal", "Starless Canal", "Lantern Tyrant", 190, "s7-toll-keeper", "ranged", "anchor-shard", "s7-lantern-tyrant", 1080, [[0, "flanker", 7], [270, "ranged", 5], [600, "guardian", 4]]),
  stage("shattered-causeway", "Shattered Causeway", "Bridge Colossus", 205, "s8-keystone-warden", "guardian", "ember-cohort", "s8-bridge-colossus", 1140, [[0, "rusher", 8], [280, "ranged", 6], [630, "guardian", 4]]),
  stage("abyss-chancel", "Abyss Chancel", "Veiled Concordat", 220, "s9-oathbound-signatory", "guardian", "dawnless-crown", "s9-veiled-concordat", 1200, [[0, "flanker", 8], [300, "ranged", 6], [660, "guardian", 5]]),
  stage("gate-zenith", "Gate Zenith", "Abyss Regent", 240, "s10-regent-herald", "flanker", "dawnless-crown", "s10-abyss-regent", 1260, [[0, "rusher", 9], [300, "ranged", 7], [690, "guardian", 5]]),
]);
export const STAGE_ITEM_IDS = freeze({
  "cinder-span": "ashen-sigil",
  "veil-citadel": "ward-splinter",
  "echo-throne": "echo-compass",
  "sunken-bastion": "hourglass-fragment",
  "howling-sprawl": "ashen-sigil",
  "glass-necropolis": "ward-splinter",
  "starless-canal": "echo-compass",
  "shattered-causeway": "hourglass-fragment",
  "abyss-chancel": "ashen-sigil",
  "gate-zenith": "dawnless-crown-shard",
});
export const STAGE_REWARD_IDS = freeze({
  "cinder-span": Object.freeze(["ember-cohort-legacy", "stillwater-hourglass", "bulwark-brand"]),
  "veil-citadel": Object.freeze(["rift-lens-archive", "anchor-shard-archive", "abyssal-banner"]),
  "echo-throne": Object.freeze(["throne-echo-record", "veil-vanguard-legacy", "stillwater-hourglass"]),
  "sunken-bastion": Object.freeze(["anchor-shard-archive", "bulwark-brand", "abyssal-banner"]),
  "howling-sprawl": Object.freeze(["veil-vanguard-legacy", "ember-cohort-legacy", "rift-lens-archive"]),
  "glass-necropolis": Object.freeze(["rift-lens-archive", "stillwater-hourglass", "anchor-shard-archive"]),
  "starless-canal": Object.freeze(["abyssal-banner", "bulwark-brand", "throne-echo-record"]),
  "shattered-causeway": Object.freeze(["ember-cohort-legacy", "veil-vanguard-legacy", "abyssal-banner"]),
  "abyss-chancel": Object.freeze(["dawnless-crown", "throne-echo-record", "bulwark-brand"]),
  "gate-zenith": Object.freeze(["dawnless-crown", "throne-echo-record", "rift-lens-archive"]),
});
export const STAGE_BY_ID = freeze(Object.fromEntries(STAGES.map((entry) => [entry.id, entry])));

const planWaveSources = (stageEntry) => freeze(
  (stageEntry.wavePlan?.length
    ? stageEntry.wavePlan
    : stageEntry.waves.map(([tick, enemy, count], slot) => freeze({
      slot,
      tick,
      primary: freeze({ enemy, count }),
    }))),
);
const stagePlanDescriptor = (stageEntry) => {
  const waveSources = planWaveSources(stageEntry);
  const mapPlan = freeze({
    id: `map-plan:${stageEntry.id}:v1`,
    stageId: stageEntry.id,
    tactics: stageEntry.tactics,
    objectiveOrder: freeze(["gate-defense", "echo-recovery", "growth", "occupation", "extraction", "boss-kill"]),
  });
  const wavePlan = freeze({
    id: `wave-plan:${stageEntry.id}:v1`,
    stageId: stageEntry.id,
    authoredAlternatives: Boolean(stageEntry.wavePlan?.length),
    waves: waveSources,
  });
  const m4Plan = freeze({
    id: `m4-plan:${stageEntry.id}:v1`,
    stageId: stageEntry.id,
    cards: freeze([
      freeze({ id: `${stageEntry.id}-hold-line`, checkpointObjectiveId: "gate-defense" }),
      freeze({ id: `${stageEntry.id}-recover-echo`, checkpointObjectiveId: "echo-recovery" }),
    ]),
    recovery: freeze({
      id: `${stageEntry.id}-safe-lane`,
      checkpointObjectiveId: "occupation",
      safeLaneId: stageEntry.tactics.chokepath.id,
    }),
    fallback: freeze({
      id: `${stageEntry.id}-fallback`,
      reason: "M4_CARD_INVENTORY_EXHAUSTED",
      objectiveId: "occupation",
      safeLaneId: stageEntry.tactics.chokepath.id,
    }),
  });
  return freeze({ version: 1, stageId: stageEntry.id, mapPlan, wavePlan, m4Plan });
};
export const STAGE_PLAN_DESCRIPTORS = freeze(
  Object.fromEntries(STAGES.map((stageEntry) => [stageEntry.id, stagePlanDescriptor(stageEntry)])),
);
