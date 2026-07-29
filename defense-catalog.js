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

/**
 * None-target combat geometry (no lock-on): melee resolves as an adjacent frontal sweep and
 * ranged fire resolves as a travelling orb that damages the first body its swept sphere touches.
 * All values are world units / ticks so the simulation stays integer-deterministic.
 */
export const COMBAT_TARGETING = freeze({
  mode: "none-target",
  melee: freeze({
    /** Extra reach past the two body radii that still counts as "adjacent". */
    reach: 900,
    /** Frontal half-arc as a cosine in basis points: 0 bp => 180° total sweep. */
    arcCosBp: 0,
    /** Sweep hits every body in the arc, capped so a single swing cannot clear a whole wave. */
    maxTargets: 5,
  }),
  ranged: freeze({
    /** World units advanced per tick by a travelling orb. */
    projectileSpeed: 1400,
    /** Orb body radius used for the swept-sphere overlap test. */
    projectileRadius: 220,
    /** Hard flight cap so a miss always expires. */
    maxTicks: 12,
  }),
  /** Vertical gap (elevation units) beyond which a body is out of reach of a hit. */
  elevationTolerance: 700,
});

/** Body-vs-body and body-vs-terrain collision limits shared by placement and movement. */
export const COLLISION = freeze({
  /** Elevation rise a body can walk up in one tick; anything steeper blocks like a wall. */
  stepHeight: 600,
  /** Separation passes run per tick to unstick overlapping bodies. */
  separationPasses: 12,
  /** Bodies further apart than this in elevation occupy different decks and never overlap-push. */
  separationElevationTolerance: 900,
});

export const COMPANION_AUTONOMY = freeze({
  itemClaimRange: COMMANDER.basicRange,
  hardLeashRange: 12000,
  followSpeed: COMMANDER.speed,
  returnSpeed: COMMANDER.speed * 2,
  itemContactRange: 300,
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
  "ashen-sigil": { id: "ashen-sigil", name: "Cinder Sigil", description: "기본 공격 피해 +180", damageBonus: 180 },
  "ward-splinter": { id: "ward-splinter", name: "Ward Splinter", description: "관문 최대 내구 +80, 즉시 +80", maxIntegrity: 80, integrity: 80 },
  "echo-compass": { id: "echo-compass", name: "Echo Compass", description: "XP 흡수 반경 +2500", pickupRange: 2500 },
  "hourglass-fragment": { id: "hourglass-fragment", name: "Ration Sigil Fragment", description: "스킬 쿨다운 10% 감소", cooldownReduction: 0.1 },
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
  "warden-lantern": { id: "warden-lantern", name: "Warden's Lantern", description: "런 시작 시 Commander 획득반경 +400", kind: "modifier", pickupRange: 400 },
  "choir-ward-crystal": { id: "choir-ward-crystal", name: "Choir Ward Crystal", description: "런 시작 시 Commander 치명타 확률 +3%p", kind: "modifier", critChanceBonusBp: 300 },
  "pack-warden-legacy": { id: "pack-warden-legacy", name: "Pack Warden Legacy", description: "다음 런의 동료 슬롯에 Pack Warden 기록", kind: "companion", companionId: "pack-warden" },
  "lantern-reaver-legacy": { id: "lantern-reaver-legacy", name: "Lantern Reaver Legacy", description: "다음 런의 동료 슬롯에 Lantern Reaver 기록", kind: "companion", companionId: "lantern-reaver" },
  "requiem-warden-legacy": { id: "requiem-warden-legacy", name: "Requiem Warden Legacy", description: "다음 런의 동료 슬롯에 Requiem Warden 기록", kind: "companion", companionId: "requiem-warden" },
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
  // Free-orbit camera pitch/zoom boundary tick (control-feel-20260725.md
  // §3.3/§3.5): a dedicated cue id — NOT a reuse of impact-hit — so its
  // own refractory bucket and lastCueAt are independent of the constant
  // combat impact-hit stream, which would otherwise both drown it out and
  // buzz it. Played renderer-side from app.js's pointer handlers, never
  // emitted as a simulation event (so it stays out of getRunDigest).
  cameraClamp: { id: "camera-clamp", waveform: "sawtooth", frequency: 90, duration: 0.035 },
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
  "abyss-chancel": {
    intro: ["심연 예배소의 서약이 두 번째 봉쇄선을 압박한다.", "거울 장막을 지나 성가의 결속점을 확보하라."],
    bossEntry: "Veil Tactician이 무너진 제단의 반사를 따라 전장을 재배열한다.",
    elite: "서약의 파편이 수호자의 발밑에서 장막을 세운다.",
    victory: "봉인된 성가가 꺼지고 왕좌로 향하는 균열이 열린다.",
    defeat: "장막이 결속점을 삼켰다. Cinder Span의 봉쇄선으로 복귀하라.",
  },
  "echo-throne": {
    intro: ["메아리 왕좌가 마지막 봉쇄선 위에서 호응한다.", "군주의 반향을 끊고 관문의 최종 결속을 지켜라."],
    bossEntry: "Gate Sovereign이 왕좌의 파편을 모아 전장을 하나의 명령으로 묶는다.",
    elite: "왕좌의 반향이 돌진하는 수호자의 그림자를 되살린다.",
    victory: "왕좌의 명령이 끊겼다. 세 번째 봉쇄선은 유지된다.",
    defeat: "관문의 최종 결속이 무너졌다. Echo Throne으로 복귀하라.",
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

/**
 * Skill rank ladder (특성 강화). Rank 1 is the shipped effect; each further rank adds a fixed share
 * of it. Authored here so the simulation, the growth preview UI, and the carry-over layer all read
 * the same numbers.
 */
export const MAX_SKILL_RANK = 5;
export const SKILL_RANK_DAMAGE_STEP = 0.25;
export const SKILL_RANK_COOLDOWN_STEP = 0.06;
export const SKILL_RANK_COOLDOWN_FLOOR = 0.7;
export const SKILL_RANK_PASSIVE_SHARE = 0.5;

/**
 * Stage-to-stage carry-over budget (스킬/아이템 효과 이어가기). Authored here so the simulation and the
 * campaign layer share one source of truth for what a victory may hand the next stage.
 */
export const CARRY_OVER_MAX_RANK = 3;
export const CARRY_OVER_RANK_DECAY = 1;
export const CARRY_OVER_MAX_ITEMS = 3;

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
  "pack-warden": { id: "pack-warden", name: "Pack Warden", damage: 400, fireTicks: 30, range: 4200 },
  "lantern-reaver": { id: "lantern-reaver", name: "Lantern Reaver", damage: 480, fireTicks: 40, range: 4400 },
  "requiem-warden": { id: "requiem-warden", name: "Requiem Warden", damage: 440, fireTicks: 38, range: 4600 },
});
export const SKILLS = freeze({
  "rift-bolt": { id: "rift-bolt", name: "Echo Bolt", role: "active", kind: "active", damage: 1800, cooldown: 390, radius: 0, motion: "attack", vfx: "rift-bolt" },
  "soul-lance": { id: "soul-lance", name: "Echo Lance", role: "active", kind: "active", damage: 1200, cooldown: 270, radius: 0, motion: "critical", vfx: "soul-lance" },
  "grave-pulse": { id: "grave-pulse", name: "Echo Pulse", role: "active", kind: "active", damage: 650, cooldown: 240, radius: 3000, motion: "critical", vfx: "grave-pulse" },
  "void-aegis": { id: "void-aegis", name: "Zenith Aegis", role: "active", kind: "active", damage: 0, cooldown: 300, radius: 0, integrity: 50, motion: "defence", vfx: "void-aegis" },
  "shadow-step": { id: "shadow-step", name: "Dusk Step", role: "active", kind: "active", damage: 900, cooldown: 210, radius: 4500, motion: "avoid", vfx: "shadow-step" },
  "eclipse-edge": { id: "eclipse-edge", name: "Dusk Edge", role: "passive", kind: "passive", basicDamage: 180 },
  "soul-magnet": { id: "soul-magnet", name: "Echo Magnet", role: "passive", kind: "passive", pickupRange: 1500 },
  "ward-binder": { id: "ward-binder", name: "Zenith Binder", role: "passive", kind: "passive", maxIntegrity: 120 },
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
  "abyss-chancel": {
    chokepath: { id: "chancel-nave", x: 18800, halfWidth: 1300 },
    flank: { id: "chancel-transept", entryX: 12800, entryY: 10200 },
    elevation: { id: "chancel-apse", x: 18000, y: 2600, rangeMultiplier: 1.13 },
    hazard: { id: "oath-pressure", x: 15600, y: 7000, radius: 1450, damagePerSecond: 16 },
    occupation: { id: "chancel-oath", x: 18200, y: 5200, radius: 800, holdTicks: 330, effects: { moveMultiplier: 1.05, rangeMultiplier: 1.11, recoveryPerSecond: 10 } },
    extraction: { id: "chancel-bind", x: 16000, y: 7000, radius: 850, windowTicks: 600 },
    spawnDirections: ["W", "SW", "NW"], seededVariation: { timingJitterTicks: 27, densityDelta: 1, laneJitter: 660 },
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
});
/*
 * REMOVED (run-id 20260728-stage-playtime-doctrine): CINDER_SPAN_WAVE_PLAN and STAGE_WAVE_VARIANTS.
 * Every stage now generates its wave plan from STAGE_WAVE_DOCTRINE, including two seeded
 * composition alternatives per wave, so the old single authored plan and the separate slot-variant
 * table were a second, dead source of wave truth. `stage.waves` (the legacy triples) is kept
 * because the spawn-budget and stage-catalog contracts still read it as authored data.
 */

/**
 * --- Long-form stage doctrine (run-id 20260728-stage-playtime-doctrine) -------------------------
 *
 * Goal (design target): one stage = 3-6 minutes of authored defense instead of the ~30-45 s
 * gate-hold the stage-2 retune shipped. The playtime is produced by CONTENT (wave count and the
 * gate-hold requirement), not by inflating enemy HP, so time-to-kill per enemy is unchanged.
 *
 * Every stage now publishes an authored wave plan generated from its doctrine row below:
 *   - `defenseTicks` becomes the stage's `gateTicks` (gate-hold requirement, 60 ticks = 1 s).
 *   - `waveCount` waves are spaced evenly across `defenseTicks`, so the last wave lands with
 *     roughly one cadence slot of clear-up time left before the gate-defense objective can close.
 *   - Wave kinds alternate on an authored cycle so pacing is legible:
 *       normal (웨이브)     - baseline squad, the stage's rotating enemy class.
 *       big    (빅 웨이브)   - 1.75x squad split across two classes, pushed down the map's own
 *                             pressure lane (chokepath push, or the flank lane on flank-biased maps).
 *       mid    (미들 웨이브) - a mid-boss plus a small escort; the mid-boss is an ordinary
 *                             (non-elite) enemy with MIDBOSS_PROFILE multipliers, so it blocks the
 *                             gate-defense clear check without touching elite/extraction/boss logic.
 *   - Direction and policy come from the stage's own `STAGE_TACTICS` (spawnDirections, chokepath,
 *     flank), which is what makes each map's wave pattern read differently.
 *
 * Numbers are pure authored data; `scripts/measure-stage-playtime.mjs` is the measurement harness
 * that validates the 180-360 s window against the shipped simulation.
 */
export const WAVE_KIND_PROFILE = freeze({
  normal: { id: "normal", label: "웨이브", countBp: 10000 },
  big: { id: "big", label: "빅 웨이브", countBp: 17500 },
  mid: { id: "mid", label: "미들 웨이브", countBp: 5000, midboss: true },
});
export const WAVE_KINDS = freeze(Object.keys(WAVE_KIND_PROFILE));
/** Mid-boss stat multipliers, in basis points, applied to the base enemy class it is built from. */
export const MIDBOSS_PROFILE = freeze({
  /**
   * Mid-boss HP is a share of the wave CLEAR BUDGET (see PLAYER_BASELINE_DPS below), not a multiple
   * of its base class: a guardian-based mid-boss at a flat 3.2x on a scale-240 stage was a 57k-HP
   * wall that stalled the whole gate-defense hold during measurement. At 60% of one cadence slot it
   * is ~10-12 s of focused fire for the floor player, with escorts sized inside the same budget.
   */
  hpBudgetBp: 6000,
  damageBp: 16000,
  xpBp: 40000,
  speedBp: 8500,
  radiusBp: 14000,
});
/**
 * Per-stage doctrine. `defenseTicks` climbs 140 s -> 230 s across the campaign; `squadBase` and
 * `waveCount` climb with it so density rises with the stage's own HP `scale`.
 * `kindCycle` is the authored wave-kind rhythm (the last wave is always forced to `big`).
 * `classes` are the enemy classes this map fields, in rotation order.
 */
export const STAGE_WAVE_DOCTRINE = freeze({
  "cinder-span": { gateIntegrity: 1600, defenseTicks: 10200, waveCount: 10, classes: freeze(["rusher", "flanker", "ranged"]), kindCycle: freeze(["normal", "normal", "big", "mid"]), pressureLane: "chokepath", midbossEnemy: "guardian" },
  "abyss-chancel": { gateIntegrity: 1700, defenseTicks: 10200, waveCount: 10, classes: freeze(["rusher", "flanker", "ranged"]), kindCycle: freeze(["normal", "big", "normal", "mid"]), pressureLane: "flank", midbossEnemy: "flanker" },
  "echo-throne": { gateIntegrity: 1800, defenseTicks: 10800, waveCount: 11, classes: freeze(["flanker", "ranged", "guardian"]), kindCycle: freeze(["normal", "normal", "big", "mid"]), pressureLane: "chokepath", midbossEnemy: "guardian" },
});

/**
 * Wave size is derived from a CLEAR BUDGET, not from a raw authored count.
 *
 *   clearableHp(cadence) = cadenceSeconds * PLAYER_BASELINE_DPS
 *   waveHp               = clearableHp * WAVE_PRESSURE_BP * kind.countBp
 *   count                = waveHp / (enemyHp * stageScale / 100)
 *
 * PLAYER_BASELINE_DPS is the shipped bare commander's single-target output
 * (COMMANDER.basicDamage 900 per COMMANDER.basicCooldown 24 ticks = 2250/s), so the budget is the
 * FLOOR case: companions, items, rewards, skill ranks and meta progression are all headroom on top.
 * WAVE_PRESSURE_BP leaves that headroom deliberately — a normal wave asks for 55% of the floor
 * player's clear capacity in one cadence slot, so a well-played wave clears (and pays the
 * WAVE_CLEARED recovery) while a sloppy one leaks into the next wave.
 *
 * The critical property for a 10-13 wave stage: because the divisor carries `stageScale`, late
 * stages field FEWER, TOUGHER bodies instead of the same count at 2.4x HP, which is what made the
 * long format unclearable at gate-zenith during measurement.
 */
export const PLAYER_BASELINE_DPS = 2250;
export const WAVE_PRESSURE_BP = 5500;
/** Builds one stage's authored, doctrine-driven wave plan. Deterministic and data-only. */
function buildDoctrineWavePlan(stageId, doctrine, tactics, stageScale) {
  const directions = tactics.spawnDirections?.length ? tactics.spawnDirections : ["W", "NW", "SW"];
  const cadence = Math.floor(doctrine.defenseTicks / doctrine.waveCount);
  const cadenceSeconds = cadence / TICK_RATE;
  const flankLane = doctrine.pressureLane === "flank" && tactics.flank;
  return freeze(Array.from({ length: doctrine.waveCount }, (unused, slot) => {
    const kind = slot === doctrine.waveCount - 1
      ? "big"
      : doctrine.kindCycle[slot % doctrine.kindCycle.length];
    const profile = WAVE_KIND_PROFILE[kind];
    const leadClass = doctrine.classes[slot % doctrine.classes.length];
    const supportClass = doctrine.classes[(slot + 1) % doctrine.classes.length];
    // Ramp: the stage's later waves ask for progressively more of the clear budget (100% -> 130%).
    const rampBp = 10000 + Math.floor((slot * 3000) / Math.max(1, doctrine.waveCount - 1));
    const waveHp = (cadenceSeconds * PLAYER_BASELINE_DPS * WAVE_PRESSURE_BP * profile.countBp * rampBp) / 1e12;
    // Every composition — primary AND remix — is sized from the SAME HP budget, split by share.
    // Sizing by body count instead would let a guardian-heavy remix carry several times the HP of
    // its rusher-led primary at the identical "count", which is how a big wave silently became
    // unclearable on the guardian stages.
    const scaledHp = (enemyId) => (ENEMIES[enemyId].hp * stageScale) / 100;
    /**
     * Sizes a composition from the wave's HP budget. A class whose single body already costs more
     * than its share is DROPPED and its share is handed to the other class, because rounding one
     * guardian up to a minimum of 1 body is how a "remix" silently became several times the work of
     * the primary it is supposed to mirror.
     */
    const budgetComposition = (shares) => {
      const affordable = shares.filter(([enemyId, shareBp]) => scaledHp(enemyId) <= (waveHp * shareBp) / 10000);
      const usable = affordable.length ? affordable : [shares.slice().sort((left, right) => scaledHp(left[0]) - scaledHp(right[0]))[0]];
      const totalShareBp = usable.reduce((sum, [, shareBp]) => sum + shareBp, 0);
      return usable.map(([enemyId, shareBp]) => ({
        enemy: enemyId,
        count: Math.max(1, Math.round(((waveHp * (shareBp / totalShareBp)) / scaledHp(enemyId)))),
      }));
    };
    const primaryComposition = kind === "big"
      ? budgetComposition([[leadClass, 6000], [supportClass, 4000]])
      : budgetComposition([[leadClass, 10000]]);
    const remixComposition = kind === "big"
      ? budgetComposition([[supportClass, 6000], [leadClass, 4000]])
      : budgetComposition([[leadClass, 6700], [supportClass, 3300]]);
    const count = primaryComposition[0].count;
    // Only the STATEMENT waves pin a policy: a big wave is the map's pressure push (chokepath or
    // flank) and a mid wave escorts its mid-boss. Normal waves deliberately leave the policy
    // unpinned so buildWaveSchedule keeps rolling the seeded pool, which is where player-pursuit and
    // low-hp-focus behaviour comes from — pinning every wave would delete those policies from play.
    const policyId = kind === "big"
      ? (flankLane ? "flank" : "gate-pressure")
      : kind === "mid" ? "elite-escort" : null;
    return freeze({
      slot,
      tick: slot * cadence,
      kind,
      label: profile.label,
      direction: directions[slot % directions.length],
      ...(policyId ? { policyId } : {}),
      primary: freeze({ enemy: leadClass, count }),
      alternatives: freeze([
        freeze({ id: `${stageId}-w${slot}-${kind}-primary`, composition: freeze(primaryComposition.map((entry) => freeze({ ...entry }))) }),
        freeze({ id: `${stageId}-w${slot}-${kind}-remix`, composition: freeze(remixComposition.map((entry) => freeze({ ...entry }))) }),
      ]),
      ...(profile.midboss
        ? {
          midboss: freeze({
            id: `${stageId}-midboss-${slot}`,
            enemy: doctrine.midbossEnemy,
            policyId: "gate-pressure",
            ...MIDBOSS_PROFILE,
            hp: Math.round((cadenceSeconds * PLAYER_BASELINE_DPS * MIDBOSS_PROFILE.hpBudgetBp) / 10000),
          }),
        }
        : {}),
    });
  }));
}

/**
 * `legacyGateTicks`/`legacyWaves` are the pre-doctrine short-hold values. They are kept as the
 * stage's `waves` triples (the spawn-budget and catalog contracts still read them as authored
 * data) while `gateTicks` and `wavePlan` now come from STAGE_WAVE_DOCTRINE, which is what the
 * simulation actually schedules.
 */
const stage = (id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss, legacyGateTicks, waves) => {
  const doctrine = STAGE_WAVE_DOCTRINE[id];
  if (!doctrine) throw new RangeError(`Missing wave doctrine for stage: ${id}`);
  const tactics = STAGE_TACTICS[id];
  return freeze({
    id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss,
    gateTicks: doctrine.defenseTicks,
    legacyGateTicks,
    waves,
    doctrine,
    wavePlan: buildDoctrineWavePlan(id, doctrine, tactics, scale),
    tactics,
    wavePattern: Object.freeze(["scout", "pressure", "flank", "ranged", "elite", "boss"]),
  });
};

export const STAGES = freeze([
  stage("cinder-span", "Cinder Span", "Cinder Warden", 100, "s1-ember-hunter", "rusher", "ember-cohort", "s1-cinder-warden", 900, [[0, "rusher", 4], [180, "flanker", 3], [390, "ranged", 2]]),
  stage("abyss-chancel", "Abyss Chancel", "Veil Tactician", 115, "s2-veil-sentinel", "flanker", "rift-lens", "s2-veil-tactician", 780, [[0, "rusher", 5], [180, "flanker", 4], [420, "ranged", 3]]),
  stage("echo-throne", "Echo Throne", "Gate Sovereign", 130, "s3-throne-wraith", "ranged", "throne-echo", "s3-gate-sovereign", 840, [[0, "flanker", 5], [210, "ranged", 3], [480, "guardian", 2]]),
]);

/**
 * Immutable display vocabulary for the Seal Atlas and passive terrain overlays.
 * These IDs and labels never participate in stage resolution or simulation.
 */
export const STAGE_PRESENTATION_BY_ID = freeze({
  "cinder-span": {
    palette: { surface: "surface-cinder-ash", contour: "contour-ember", landmark: "landmark-forge", hazard: "hazard-ash", objective: "objective-seal" },
    terrain: { patternId: "terrain.cinder-span.ash-bands", label: "재의 띠" },
    landmarks: [{ id: "landmark.ember-relay-spire", label: "불씨 중계탑" }, { id: "landmark.drowned-forge-arch", label: "잠긴 용광로 아치" }],
    atmosphere: { descriptor: "잿빛 바람이 교량의 봉쇄선을 훑는다.", motif: "불씨와 재의 흐름" },
    mapLabels: { title: "잿빛 교량", domain: "재의 봉쇄선", chokepath: "중앙 재길", flank: "남쪽 측면", elevation: "잿빛 감시대", hazard: "재 폭풍", occupation: "재의 봉인", extraction: "결속 지점", objective: "재의 봉인을 지켜 결속하라." },
  },
  "abyss-chancel": {
    palette: { surface: "surface-chancel-abyss", contour: "contour-oath", landmark: "landmark-apse", hazard: "hazard-oath", objective: "objective-oath" },
    terrain: { patternId: "terrain.abyss-chancel.oath-rings", label: "서약 고리" },
    landmarks: [{ id: "landmark.chancel-apse", label: "예배소 후진" }, { id: "landmark.chancel-nave", label: "예배소 본당" }],
    atmosphere: { descriptor: "심연 예배소의 서약이 시야를 봉인한다.", motif: "서약 고리와 보랏빛 정전" },
    mapLabels: { title: "심연 예배소", domain: "서약의 봉쇄선", chokepath: "예배소 본당", flank: "교차 회랑 측면", elevation: "예배소 후진", hazard: "서약의 압력", occupation: "예배소 서약", extraction: "결속 지점", objective: "예배소 서약을 역전해 결속하라." },
  },
  "echo-throne": {
    palette: { surface: "surface-throne-stone", contour: "contour-echo", landmark: "landmark-dais", hazard: "hazard-rift", objective: "objective-domain" },
    terrain: { patternId: "terrain.echo-throne.court-steps", label: "왕좌의 계단" },
    landmarks: [{ id: "landmark.throne-dais", label: "왕좌 단상" }, { id: "landmark.throne-aisle", label: "왕좌 회랑" }],
    atmosphere: { descriptor: "달 없는 궁정의 메아리가 왕좌 회랑을 울린다.", motif: "메아리와 단상의 균열" },
    mapLabels: { title: "메아리 왕좌", domain: "달 없는 궁정", chokepath: "왕좌 회랑", flank: "남쪽 측면", elevation: "왕좌 단상", hazard: "메아리 균열", occupation: "왕좌 영역", extraction: "결속 지점", objective: "왕좌 영역을 지켜 결속하라." },
  },
});

const stagePresentationIds = Object.keys(STAGE_PRESENTATION_BY_ID);
if (
  stagePresentationIds.length !== STAGES.length
  || STAGES.some(({ id }) => !Object.prototype.hasOwnProperty.call(STAGE_PRESENTATION_BY_ID, id))
) {
  throw new Error("STAGE_PRESENTATION_BY_ID must cover every authored stage.");
}
export const STAGE_ITEM_IDS = freeze({
  "cinder-span": "ashen-sigil",
  "abyss-chancel": "ward-splinter",
  "echo-throne": "echo-compass",
});
export const STAGE_REWARD_IDS = freeze({
  "cinder-span": Object.freeze(["ember-cohort-legacy", "stillwater-hourglass", "bulwark-brand"]),
  "abyss-chancel": Object.freeze(["rift-lens-archive", "anchor-shard-archive", "abyssal-banner"]),
  "echo-throne": Object.freeze(["throne-echo-record", "veil-vanguard-legacy", "stillwater-hourglass"]),
});
export const STAGE_BY_ID = freeze(Object.fromEntries(STAGES.map((entry) => [entry.id, entry])));

// Every stage now publishes a doctrine `wavePlan`; the legacy `waves` triples remain as the
// fallback source (and as authored data for the spawn-budget contract).
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
