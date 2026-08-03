/** Immutable authored data for the renderer-neutral Abyssal Lantern defense run. */
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

/**
 * Slice-2 direct combat verbs. Contacts resolve when the player input is consumed by the
 * simulation; the renderer only observes the resulting action/contact events.
 */
export const DIRECT_COMBAT = freeze({
  comboWindowTicks: 30,
  /** Sustained in-contact ready-to-ready cadence for the complete LIGHT_1 → LIGHT_2 → LIGHT_3 chain. */
  lightReadyToReadyTicks: 28,
  light: freeze([
    freeze({ id: "LIGHT_1", damageBp: 7000, reach: 900, maxTargets: 3, recoveryTicks: 6 }),
    freeze({ id: "LIGHT_2", damageBp: 9000, reach: 1000, maxTargets: 4, recoveryTicks: 7 }),
    freeze({ id: "LIGHT_3", damageBp: 12000, reach: 1200, maxTargets: 5, recoveryTicks: 12 }),
  ]),
  heavy: freeze({ id: "HEAVY", damageBp: 18000, reach: 1400, maxTargets: 5, recoveryTicks: 20 }),
  dash: freeze({ distance: 1800, recoveryTicks: 8, iFrameTicks: 6, charges: 2, rechargeTicks: 90 }),
});

/**
 * Aim-biased target selection (core-loop-legion-spec.md §5). An optional player aim vector WEIGHTS
 * candidate selection instead of replacing it:
 *
 *   score(enemy) = distance^2 * (1 + AIM_BIAS * (1 - cos t) / 2)
 *
 * where t is the angle between the aim vector and the vector to the enemy. At AIM_BIAS 3.0 an enemy
 * directly behind the commander must be ~2x closer to win over one being aimed at. With no aim
 * vector present the weight is exactly 1, so the score reduces to `distance^2` and selection is
 * bit-identical to the pre-cycle-9 nearest-enemy behavior (ties still broken by id).
 *
 * Expressed in basis points because the comparison itself is done in scaled INTEGER arithmetic —
 * float scores would make ordering engine-dependent, which a deterministic sim cannot accept.
 */
export const AIM_BIAS_BP = 30000; // 3.0 x 10000
/** Fixed-point scale shared by aim/analog/facing vectors. Integer millis at magnitude 1000. */
export const AIM_VECTOR_SCALE = 1000;

/**
 * Extraction: corpse -> channel -> companion (core-loop-legion-spec.md §2).
 * Ported from the deferred `engineering/extraction-system.js` design. The timing values are the
 * deferred module's own and are internally consistent at 60 Hz, so they carry over unchanged.
 */
export const EXTRACTION = freeze({
  /** Corpse persists 10 s. */
  corpseDurationTicks: TICK_RATE * 10,
  /** Channel takes 2 s of continuous proximity. */
  channelTicks: TICK_RATE * 2,
  /** World units; the commander must stay inside this radius or the channel BREAKS (never pauses). */
  range: 1200,
  /** Hard cap on live corpses; oldest is evicted first (spec §6 tick-cost bound). */
  corpseCap: 12,
});

/**
 * Enemy grade -> companion grade. Fixes spec defect D2: the deferred module declared ALL enemy
 * types extractable, but extraction is midboss-onward, so trash produces no corpse at all. `normal`
 * is deliberately absent — absence IS the "no corpse" rule, and it also bounds the corpse array.
 */
export const EXTRACTION_GRADE_BY_ENEMY = freeze({
  elite: "BASIC",
  midboss: "SHADOW",
  boss: "BOSS",
});

/** Companion stat inheritance per extracted grade (spec §2 table, retained from the deferred module). */
export const GRADE_COMPANION_MULTIPLIERS = freeze({
  BASIC: freeze({ damageBp: 15000, fireTicksBp: 8000, hpInheritBp: 3000, defaultRange: 4000, loyaltyBase: 100 }),
  SHADOW: freeze({ damageBp: 18000, fireTicksBp: 7500, hpInheritBp: 4000, defaultRange: 4600, loyaltyBase: 120 }),
  BOSS: freeze({ damageBp: 20000, fireTicksBp: 7000, hpInheritBp: 5000, defaultRange: 5200, loyaltyBase: 150 }),
});

/**
 * Legion capacity, dynamic 3 -> 10 (core-loop-legion-spec.md §3).
 * `COMPANION_CAPACITY_BASE` replaces the *meaning* of campaign-state's MAX_LOADOUT_SIZE;
 * `COMPANION_CAPACITY_MAX` is the absolute ceiling used by load-time validation.
 */
export const COMPANION_CAPACITY_BASE = 3;
export const COMPANION_CAPACITY_MAX = 10;

/**
 * The 4th..10th slot unlock ladder, shipped as DATA on purpose.
 *
 * Each slot requires BOTH a stage-clear gate and a Bound Fragment payment; level alone is
 * insufficient, matching the request (레벨과 특정 조건(비용지불등)에 따라 해금). The resolver
 * (`companionCapacityForCampaign`) reads this table and contains no inline thresholds, so a
 * pricing decision edits data here and touches no logic anywhere.
 *
 * ECONOMY, as of the cycle-9 resolution (`N-20260730-C9-01`):
 *   Bound Fragment earned  = resolvedIds.length * 3 + distinct captured elites (elites capped at
 *                            STAGES.length) -> 12 lifetime max, 9 from stage clears alone
 *   This ladder            = 7 cumulative (7 rows x 1)
 *   Remainder              = 5 toward equipment, which needs 10 for one line to T5
 * So capacity 10 is reachable AND buying the full ladder still costs you a full equipment line.
 * The tradeoff is real; it is no longer an arithmetic impossibility.
 *
 * This comment previously described the PRE-resolution economy and said earning was
 * "`resolvedIds.length`, capped at 10" against a 16-cost ladder that was "NOT fully affordable...
 * a deliberate, recorded state". Every clause of that is now false. It is called out because that
 * exact "capped at 10" phrasing — inherited from a larger stage list, while STAGES.length is 3 —
 * is what led two separate audits to mis-state the budget by reading the comment instead of
 * measuring the function. Keep this block in sync with `campaign-state.js#boundFragmentEarned`;
 * a stale economy comment here has already cost this project two wrong analyses.
 */
export const COMPANION_SLOT_UNLOCKS = freeze([
  // Cycle 9 reprice (`N-20260730-C9-01`). The authored ladder cost 16 cumulative and gated slots
  // 7-10 behind 4/6/8/10 stage clears. `STAGES.length` is **3**, so those four rows were
  // PERMANENTLY UNREACHABLE at any price [OBSERVED] — a second defect independent of the budget,
  // and one that repricing alone could not have fixed.
  //
  // Every gate is now within the 3 stages that exist, and the cumulative cost is 7 against a
  // lifetime pool of 12 (see boundFragmentEarned), leaving 5 toward equipment. Capacity 10 is
  // reachable, and spending on slots still costs you equipment progress — the tradeoff is real
  // rather than arithmetically impossible.
  //
  // Gates rise 1,1,2,2,3,3,3: the first two slots land early to make the mechanic legible, then
  // pacing tightens so the last three all wait on a full clear.
  freeze({ slot: 4, requiresStageClears: 1, boundFragmentCost: 1 }),
  freeze({ slot: 5, requiresStageClears: 1, boundFragmentCost: 1 }),
  freeze({ slot: 6, requiresStageClears: 2, boundFragmentCost: 1 }),
  freeze({ slot: 7, requiresStageClears: 2, boundFragmentCost: 1 }),
  freeze({ slot: 8, requiresStageClears: 3, boundFragmentCost: 1 }),
  freeze({ slot: 9, requiresStageClears: 3, boundFragmentCost: 1 }),
  freeze({ slot: 10, requiresStageClears: 3, boundFragmentCost: 1 }),
]);

/** Ladder row for one slot number, or null when that slot is not unlockable. */
export function companionSlotUnlockFor(slot) {
  return COMPANION_SLOT_UNLOCKS.find((entry) => entry.slot === slot) || null;
}

/* ---------------------------------------------------------------------------------------------
 * Area combat model (광역 전투).
 *
 * Every contact in this game is area-of-effect. A basic swing, an orb impact, a companion volley,
 * a skill, an enemy strike and a boss slam all resolve as a DISC centred on the contact point:
 * the primary body takes its authored damage, and every other body of the opposing faction inside
 * the disc takes a derived share of it.
 *
 * The share is the product of four authored factors, each an integer basis-point weight so the
 * simulation stays bit-deterministic:
 *
 *   shareBp = falloffBp(distance, radius)   distance   -- how far the body stands from the contact
 *           x weightBp(source)              스킬가중치  -- how "wide" that kind of attack is authored to be
 *           x matchupBp(attacker, target)   속성        -- elemental advantage between the two bodies
 *           x sustainBp(durationTicks)      지속시간    -- burst now vs. the same budget spread over a field
 *
 * All four are visible, tunable, per-source data. They are the balance levers for area combat:
 * a wide, long, on-element hit is the strongest configuration and a narrow, instant, off-element
 * hit is the weakest, with everything between reachable by editing this block alone.
 * ------------------------------------------------------------------------------------------- */

/** Basis-point unit shared by every area factor. 10000 bp = x1.0. */
export const AREA_BP = 10000;

/**
 * Elemental identities. `neutral` never gains or suffers a matchup; it is the baseline a body
 * carries when its authored data says nothing about element.
 */
export const ELEMENT_IDS = freeze(["neutral", "ember", "frost", "veil", "void"]);

/**
 * Attacker -> defender multiplier. The advantage cycle is ember > frost > veil > void > ember,
 * so no element is globally dominant and every stage's enemy mix has an answer. Mirror matchups
 * are deliberately below 1.0: hitting a body with its own element is the worst case, which keeps
 * a single-element build from being universally correct.
 */
export const ELEMENT_MATCHUP_BP = freeze({
  neutral: freeze({ neutral: 10000, ember: 10000, frost: 10000, veil: 10000, void: 10000 }),
  ember: freeze({ neutral: 10000, ember: 9000, frost: 12500, veil: 10000, void: 8500 }),
  frost: freeze({ neutral: 10000, ember: 8500, frost: 9000, veil: 12500, void: 10000 }),
  veil: freeze({ neutral: 10000, ember: 10000, frost: 8500, veil: 9000, void: 12500 }),
  void: freeze({ neutral: 10000, ember: 12500, frost: 10000, veil: 8500, void: 9000 }),
});

/**
 * Per-source area geometry and weight.
 *
 * `radius` is the disc radius in world units, `weightBp` scales the splash share, and `element`
 * is the fallback element when neither the attacker body nor the skill declares one.
 * `fieldTicks` > 0 means the contact also leaves a lingering field (see `AREA_FIELD`).
 */
export const AREA_SOURCES = freeze({
  /** Commander basic swing: tight, frequent, cheap splash. */
  basic: freeze({ radius: 1100, weightBp: 5500, element: "neutral", fieldTicks: 0 }),
  /** Melee arc contact from any body. */
  melee: freeze({ radius: 1250, weightBp: 6000, element: "neutral", fieldTicks: 0 }),
  /** Travelling orb burst at the body it touched. */
  projectile: freeze({ radius: 1000, weightBp: 5000, element: "veil", fieldTicks: 0 }),
  /** Companion volley: the legion trades per-hit weight for uptime. */
  companion: freeze({ radius: 900, weightBp: 4500, element: "neutral", fieldTicks: 0 }),
  /** Player active skill: the widest player-side contact, and the only one that leaves a field. */
  skill: freeze({ radius: 2600, weightBp: 10000, element: "void", fieldTicks: 120 }),
  /**
   * Enemy contact strike. Player-side bodies standing together share the hit. The disc is sized
   * against the authored formation offsets (rpg-catalog STANCE_CONFIG: 300-1414 units), so
   * clustering the legion is a real risk and spreading it is a real answer.
   */
  enemy: freeze({ radius: 1200, weightBp: 4500, element: "ember", fieldTicks: 0 }),
  /** Enemy projectile detonation, sized to the same formation scale. */
  enemyProjectile: freeze({ radius: 1200, weightBp: 4000, element: "void", fieldTicks: 0 }),
  /** Boss slam: the widest contact in the game and always leaves a field. */
  boss: freeze({ radius: 3200, weightBp: 12000, element: "void", fieldTicks: 180 }),
});

/** Distance falloff and the hard bounds every area resolution is clamped by. */
export const AREA_COMBAT = freeze({
  mode: "always-area",
  /** Inside this fraction of the radius the splash share does not decay at all. */
  innerRatioBp: 3500,
  /** Share still applied exactly at the rim. Beyond the rim the body is untouched. */
  edgeShareBp: 3000,
  /** Bodies struck by one resolution, primary excluded. Bounds the per-tick cost. */
  maxSplashTargets: 8,
  /** A body inside the disc always takes at least this much, so "in range" is never free. */
  minSplashDamage: 1,
});

/** Lingering-field pacing. A field is the `지속시간` axis of the model made observable. */
export const AREA_FIELD = freeze({
  /** Ticks between damage pulses. 30 ticks = 0.5 s at 60 Hz. */
  pulseTicks: 30,
  /** Concurrent fields; the oldest is retired first so the tick cost stays bounded. */
  maxActive: 6,
  /**
   * Per-pulse share floor. Without it a very long field would pulse for nothing; with it a long
   * field trades a lower peak for a higher total, which is exactly the sustain-vs-burst choice.
   */
  sustainFloorBp: 2500,
  /** A field never out-damages the contact that spawned it on a single pulse. */
  sustainCeilingBp: 10000,
});

/** Element carried by a body/skill id, or `neutral` when the id is unknown. */
export function elementOf(source) {
  const element = typeof source === "string" ? source : source?.element;
  return ELEMENT_IDS.includes(element) ? element : "neutral";
}

/** Attacker-vs-defender element multiplier in basis points. */
export function elementMatchupBp(attackerElement, defenderElement) {
  const attacker = elementOf(attackerElement);
  const defender = elementOf(defenderElement);
  return ELEMENT_MATCHUP_BP[attacker]?.[defender] ?? AREA_BP;
}

/**
 * Distance factor: flat inside the inner ratio, then linear down to `edgeShareBp` at the rim.
 * Integer-only, so identical inputs give identical output on every engine.
 */
export function areaFalloffBp(distance, radius) {
  const span = Math.max(1, Math.trunc(radius));
  const gap = Math.max(0, Math.trunc(distance));
  if (gap >= span) return 0;
  const inner = Math.trunc(span * AREA_COMBAT.innerRatioBp / AREA_BP);
  if (gap <= inner) return AREA_BP;
  const decaySpan = Math.max(1, span - inner);
  const decayed = AREA_BP - Math.trunc((AREA_BP - AREA_COMBAT.edgeShareBp) * (gap - inner) / decaySpan);
  return Math.max(AREA_COMBAT.edgeShareBp, decayed);
}

/**
 * Duration factor. A field spreads one contact's budget over `durationTicks`, so each pulse is
 * worth `pulseTicks / durationTicks` of it — floored, so long fields keep a meaningful pulse.
 * An instant contact (durationTicks <= 0) is worth the full budget on its single hit.
 */
export function areaSustainBp(durationTicks) {
  const ticks = Math.max(0, Math.trunc(durationTicks));
  if (ticks <= 0) return AREA_BP;
  const share = Math.trunc(AREA_BP * AREA_FIELD.pulseTicks / Math.max(AREA_FIELD.pulseTicks, ticks));
  return Math.min(AREA_FIELD.sustainCeilingBp, Math.max(AREA_FIELD.sustainFloorBp, share));
}

/** Authored geometry/weight for one area source key. */
export function areaSourceProfile(sourceKey) {
  return AREA_SOURCES[sourceKey] || AREA_SOURCES.basic;
}

/**
 * The whole model in one call: the basis-point share a body at `distance` takes from a contact.
 * Factors are applied one at a time and truncated between steps so the result cannot depend on
 * floating-point association order.
 */
export function areaShareBp({ distance, radius, weightBp, attackerElement, defenderElement, durationTicks = 0 }) {
  const falloffBp = areaFalloffBp(distance, radius);
  if (falloffBp <= 0) return 0;
  let share = falloffBp;
  share = Math.trunc(share * Math.max(0, Math.trunc(weightBp)) / AREA_BP);
  share = Math.trunc(share * elementMatchupBp(attackerElement, defenderElement) / AREA_BP);
  share = Math.trunc(share * areaSustainBp(durationTicks) / AREA_BP);
  return Math.max(0, share);
}

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
/**
 * Timed stat buffs granted by field drops (cycle 10). **A SEPARATE CATALOG, NOT AN EXTENSION
 * OF `ITEMS`.**
 *
 * Keeping the two catalogs disjoint is load-bearing, not stylistic. `eligibleCompanionItem`
 * and `assignCompanionItemClaims` in defense-run-simulation.js both gate on
 * `pickup.kind === "item" && ITEMS[pickup.itemId]`. Adding these ids to `ITEMS` would
 * silently make companions claim, walk to, and collect buff drops. Disjoint catalogs mean
 * companion claiming excludes buff drops with ZERO code change — a structural property, not
 * a hope.
 *
 * `applyItem` grants PERMANENT deltas and is reached only from the `kind === "item"` branch,
 * so nothing here can ever become a permanent grant.
 *
 * Field contract: every value is a JSON primitive or an array of primitives, so the catalog
 * survives `clone = JSON.parse(JSON.stringify(...))` with no loss. `magnitude` is ALWAYS an
 * integer in basis points — the unit is fixed by the `stat` (see `BUFF_STAT_OPS`), never by
 * the item, so two items touching one stat can never disagree about the op. Sign is
 * meaningful: negative is a reduction.
 *
 * All magnitudes, durations, and caps are [TARGET] — unmeasured this cycle.
 */
export const BUFF_ITEMS = freeze({
  "ash-stride": { id: "ash-stride", name: "Ash Stride", rarity: "common", iconId: "buff-ash-stride", modelKey: "relic", stat: "moveSpeedBp", magnitude: 1000, durationTicks: 600, maxStacks: 2, stacking: "STACK", stageIds: freeze(["abyss-chancel", "cinder-span", "echo-throne"]) },
  // WITHDRAWN this cycle: "bulwark-echo", the only `gateMaxIntegrity` item.
  //
  // The stat is specified as a COMPOSED cap that never writes `gate.maxIntegrity`, so while
  // it is live `gate.integrity` legitimately exceeds the base max -- the spec's own check 11
  // says recovery fills to 1920 against a base 1600. But `getRunSnapshot` publishes
  // `gate: run.gate` verbatim, so the snapshot reports integrity 1920 against maxIntegrity
  // 1600, and three consumers assume that cannot happen:
  //   1. `scripts/run-stage1b-pressure-packets.mjs` trips its `to > max` invariant -- G7
  //      evidence tooling, so relaxing it is an evidence supersession, not a fix;
  //   2. the `low-hp-focus` enemy policy at :2705 computes
  //      `gateRatio = gate.integrity / gate.maxIntegrity`, so a gate buff pushes the ratio
  //      above 1 and flips target selection toward the commander -- a live behavioral
  //      change, not a display artifact;
  //   3. any HUD ratio reads the same pair.
  //
  // Shipping it needs the composed cap published in the snapshot and all three consumers
  // routed at it. That is a deliberate contract change with a G7 supersession attached, not
  // something to slip in at cycle close. `BUFF_STAT_OPS.gateMaxIntegrity` and
  // `effectiveGateMax` are intentionally retained so re-enabling is one line once that
  // work lands.
  "chancel-tempo": { id: "chancel-tempo", name: "Chancel Tempo", rarity: "resonant", iconId: "buff-chancel-tempo", modelKey: "blade", stat: "cooldownScaleBp", magnitude: -1500, durationTicks: 1200, maxStacks: 1, stacking: "REFRESH", stageIds: freeze(["abyss-chancel", "echo-throne"]) },
  "cinder-haste": { id: "cinder-haste", name: "Cinder Haste", rarity: "rare", iconId: "buff-cinder-haste", modelKey: "blade", stat: "cooldownScaleBp", magnitude: -800, durationTicks: 900, maxStacks: 2, stacking: "STACK", stageIds: freeze(["abyss-chancel", "cinder-span"]) },
  "ember-edge": { id: "ember-edge", name: "Ember Edge", rarity: "common", iconId: "buff-ember-edge", modelKey: "blade", stat: "basicDamage", magnitude: 1200, durationTicks: 600, maxStacks: 3, stacking: "STACK", stageIds: freeze(["abyss-chancel", "cinder-span", "echo-throne"]) },
  "lantern-aegis": { id: "lantern-aegis", name: "Lantern Aegis", rarity: "relic", iconId: "buff-lantern-aegis", modelKey: "relic", stat: "incomingDamageBp", magnitude: -2000, durationTicks: 1800, maxStacks: 1, stacking: "REFRESH", stageIds: freeze(["abyss-chancel", "cinder-span", "echo-throne"]) },
  "oath-keen": { id: "oath-keen", name: "Oath Keen", rarity: "rare", iconId: "buff-oath-keen", modelKey: "blade", stat: "critChanceBp", magnitude: 600, durationTicks: 900, maxStacks: 2, stacking: "STACK", stageIds: freeze(["abyss-chancel", "echo-throne"]) },
  "reaver-fervor": { id: "reaver-fervor", name: "Reaver Fervor", rarity: "resonant", iconId: "buff-reaver-fervor", modelKey: "blade", stat: "basicDamage", magnitude: 2500, durationTicks: 1200, maxStacks: 2, stacking: "STACK", stageIds: freeze(["abyss-chancel", "cinder-span", "echo-throne"]) },
  "reclaimer-pulse": { id: "reclaimer-pulse", name: "Reclaimer Pulse", rarity: "common", iconId: "buff-reclaimer-pulse", modelKey: "relic", stat: "pickupRange", magnitude: 2500, durationTicks: 900, maxStacks: 2, stacking: "STACK", stageIds: freeze(["abyss-chancel", "cinder-span", "echo-throne"]) },
  "throne-resonance": { id: "throne-resonance", name: "Throne Resonance", rarity: "relic", iconId: "buff-throne-resonance", modelKey: "blade", stat: "critChanceBp", magnitude: 1500, durationTicks: 1800, maxStacks: 1, stacking: "REFRESH", stageIds: freeze(["echo-throne"]) },
  "warding-splint": { id: "warding-splint", name: "Warding Splint", rarity: "rare", iconId: "buff-warding-splint", modelKey: "relic", stat: "incomingDamageBp", magnitude: -1000, durationTicks: 900, maxStacks: 2, stacking: "STACK", stageIds: freeze(["abyss-chancel", "cinder-span", "echo-throne"]) },
});
/**
 * Per-stat composition op and the cap on the COMPOSED TOTAL, independent of how many items
 * or stacks produced it.
 *
 * The cap is why caps exist at all: `reaver-fervor`x2 + `ember-edge`x3 sums to +8600bp =
 * x1.86 on basicDamage, which is 1.86x the authoritative 3510 DPS ceiling in
 * design/master-numeric-contract.md. +5000bp holds the burst at x1.50.
 *
 * `op` is a property of the STAT, not of the buff entry, and is never serialized.
 * A negative `capBp` is a floor (reductions clamp with `Math.max`). All values [TARGET].
 */
export const BUFF_STAT_OPS = freeze({
  basicDamage: { op: "mulBp", capBp: 5000 },
  gateMaxIntegrity: { op: "mulBp", capBp: 2000 },
  pickupRange: { op: "mulBp", capBp: 7000 },
  cooldownScaleBp: { op: "addBp", capBp: -3000 },
  moveSpeedBp: { op: "mulBp", capBp: 3000 },
  critChanceBp: { op: "addBp", capBp: 2000 },
  incomingDamageBp: { op: "addBp", capBp: -2000 },
});
/** Buff-drop lifecycle bounds. Ticks are 60 Hz. All [TARGET]. */
export const DROP_TTL_TICKS = 1800;
export const MAX_FIELD_DROPS = 8;
export const MAX_ACTIVE_BUFFS = 6;
/** Matches the existing elite-item spawn offset in `resolveDeaths`. */
export const DROP_OFFSET_X = 240;
/**
 * Drop chance per stage and enemy grade, integer basis points over a 10000 denominator —
 * the same denominator every existing bp roll uses.
 *
 * BASIC climbs 600 -> 1400 across the stages to compensate for BODY COUNT, not difficulty.
 * `buildDoctrineWavePlan` sizes each wave from a fixed HP budget and divides by
 * `enemyHp * stageScale / 100`, and stage scale is 100/115/130, so a later stage fields
 * FEWER, TOUGHER bodies for the same budget. A flat rate would make Echo Throne feel barren:
 * equal drop CADENCE is the goal, equal drop RATE would defeat it. Expected totals per full
 * stage converge at 4.87 / 5.10 / 5.83. All [TARGET].
 */
export const DROP_CHANCE_BP = freeze({
  "cinder-span": freeze({ BASIC: 600, SHADOW: 2500, BOSS: 10000 }),
  "abyss-chancel": freeze({ BASIC: 800, SHADOW: 3000, BOSS: 10000 }),
  "echo-throne": freeze({ BASIC: 1400, SHADOW: 3500, BOSS: 10000 }),
});
/** Rarity weights per grade, integer bp. Every row sums to 10000. All [TARGET]. */
export const RARITY_WEIGHTS_BP = freeze({
  BASIC: freeze({ common: 7500, rare: 2500, resonant: 0, relic: 0 }),
  SHADOW: freeze({ common: 0, rare: 6000, resonant: 4000, relic: 0 }),
  BOSS: freeze({ common: 0, rare: 0, resonant: 5000, relic: 5000 }),
});
/** Rarity order, ascending. Used for the fall-through when a resolved pool is empty. */
export const BUFF_RARITIES = freeze(["common", "rare", "resonant", "relic"]);
/**
 * Authored floor bounds per stage — the outer rectangle `STAGE_SLABS` exactly tiles.
 * Gameplay units, integers. Published by DungeonLevelDesign in
 * design/stage-dungeon-composition-spec.md and frozen.
 */
export const STAGE_FLOOR_BOUNDS = freeze({
  "cinder-span": freeze({ minX: 600, maxX: 23400, minY: 800, maxY: 11200 }),
  "abyss-chancel": freeze({ minX: 600, maxX: 23400, minY: 700, maxY: 11300 }),
  "echo-throne": freeze({ minX: 600, maxX: 23400, minY: 600, maxY: 11400 }),
});
/**
 * The 12 frozen floor slabs, in authored order (slab-01 first). Ids are the full
 * `{stageId}:slab-{nn}` string — never the bare `slab-nn`.
 *
 * Verified by DungeonLevelDesign: exact area closure against the bounds rectangle
 * (237,120,000 / 241,680,000 / 246,240,000 unit^2) and zero pairwise overlap on all three
 * stages. `materialId` is carried here so audio and terrain resolve one table instead of
 * duplicating it; note `abyss-chancel:slab-01`/`-02` deliberately share `flagstone-oath`.
 */
export const STAGE_SLABS = freeze({
  "cinder-span": freeze([
    freeze({ id: "cinder-span:slab-01", materialId: "ash-drift", minX: 600, maxX: 8600, minY: 800, maxY: 11200 }),
    freeze({ id: "cinder-span:slab-02", materialId: "basalt-ember", minX: 8600, maxX: 17000, minY: 800, maxY: 11200 }),
    freeze({ id: "cinder-span:slab-03", materialId: "forge-plate", minX: 17000, maxX: 23400, minY: 800, maxY: 11200 }),
  ]),
  "abyss-chancel": freeze([
    freeze({ id: "abyss-chancel:slab-01", materialId: "flagstone-oath", minX: 600, maxX: 8000, minY: 700, maxY: 11300 }),
    freeze({ id: "abyss-chancel:slab-02", materialId: "flagstone-oath", minX: 8000, maxX: 16400, minY: 700, maxY: 11300 }),
    freeze({ id: "abyss-chancel:slab-03", materialId: "oath-inlay", minX: 16400, maxX: 23400, minY: 700, maxY: 7200 }),
    freeze({ id: "abyss-chancel:slab-04", materialId: "vestry-tile", minX: 16400, maxX: 23400, minY: 7200, maxY: 11300 }),
  ]),
  "echo-throne": freeze([
    freeze({ id: "echo-throne:slab-01", materialId: "polished-echo", minX: 600, maxX: 6800, minY: 600, maxY: 11400 }),
    freeze({ id: "echo-throne:slab-02", materialId: "fracture-glass", minX: 6800, maxX: 16600, minY: 600, maxY: 4000 }),
    freeze({ id: "echo-throne:slab-03", materialId: "gilt-compass", minX: 6800, maxX: 16600, minY: 4000, maxY: 8000 }),
    freeze({ id: "echo-throne:slab-04", materialId: "fracture-glass", minX: 6800, maxX: 16600, minY: 8000, maxY: 11400 }),
    freeze({ id: "echo-throne:slab-05", materialId: "polished-echo", minX: 16600, maxX: 23400, minY: 600, maxY: 11400 }),
  ]),
});
/**
 * Canonical slab id at a gameplay point, or `null` outside the authored floor.
 *
 * Pure function of position — reads no simulation state and writes none. Interior edges are
 * HALF-OPEN and only the stage's outer edge is CLOSED. Without that rule a point exactly on a
 * seam matches two slabs and the answer depends on iteration order, which is silent
 * nondeterminism rather than a visible bug.
 *
 * `null` is reachable and correct, not an error: the slabs do not cover the full
 * 24000x12000 arena and enemies spawn from the W/NW/SW edges, so a death at `x < 600` — or a
 * drop pushed outside by `DROP_OFFSET_X` — resolves to `null`.
 */
export function slabAt(stageId, x, y) {
  const bounds = STAGE_FLOOR_BOUNDS[stageId];
  const slabs = STAGE_SLABS[stageId];
  if (!bounds || !slabs) return null;
  for (const slab of slabs) {
    const withinX = slab.maxX === bounds.maxX ? x <= slab.maxX : x < slab.maxX;
    const withinY = slab.maxY === bounds.maxY ? y <= slab.maxY : y < slab.maxY;
    if (x >= slab.minX && withinX && y >= slab.minY && withinY) return slab.id;
  }
  return null;
}
/** `{ slabId, materialId }` at a gameplay point, or `null`. Presentation/audio convenience. */
export function slabMaterialAt(stageId, x, y) {
  const slabId = slabAt(stageId, x, y);
  if (!slabId) return null;
  const slab = STAGE_SLABS[stageId].find((entry) => entry.id === slabId);
  return { slabId, materialId: slab.materialId };
}
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

/** Abyss Depth packages (wiki 2026-07-30 difficulty-feel report). Each depth is a NAMED rule-change
 * package, NOT a global stat multiplier: it pins the normal-wave enemy-policy mix (behavior change),
 * gives the finale elite an affix aura + extra escorts, optionally cuts occupation recovery, and
 * carries a reward tier. depth 0 has NO package (identity). 3 stages -> 3 depths. Rendered by app.js
 * (naming/toast/tint) + defense-run-simulation.js (policy/elite/recovery). */
export const ABYSS_DEPTH_PACKAGES = freeze({
  1: freeze({ id: 1, name: "재의 추격", dominantLabel: "추격 · 지휘관 직격", policyMix: freeze(["player-pursuit", "player-pursuit", "gate-pressure"]), elitePolicy: "player-pursuit", eliteEscorts: 1, affixAura: "ember", tint: "ember", recoveryCapRatio: 0.25, rewardTier: 1 }),
  2: freeze({ id: 2, name: "메아리 기근", dominantLabel: "자원 봉쇄 · 지속력 고갈", policyMix: freeze(["resource-denial", "resource-denial", "flank"]), elitePolicy: "resource-denial", eliteEscorts: 1, affixAura: "frost", tint: "frost", recoveryCapRatio: 0.12, rewardTier: 2 }),
  3: freeze({ id: 3, name: "협공의 장막", dominantLabel: "협공 · 약자 집중", policyMix: freeze(["flank", "low-hp-focus", "flank"]), elitePolicy: "flank", eliteEscorts: 2, affixAura: "veil", tint: "veil", recoveryCapRatio: 0.20, rewardTier: 3 }),
});
export function abyssDepthPackage(depth) { return ABYSS_DEPTH_PACKAGES[depth] || null; }

export const ENEMIES = freeze({
  rusher: { id: "rusher", hp: 3000, speed: 3000, damage: 10, attackTicks: 60, xp: 8, radius: 260, policyId: "gate-pressure", element: "ember", patternId: "ember-rush" },
  flanker: { id: "flanker", hp: 3600, speed: 3300, damage: 12, attackTicks: 60, xp: 10, radius: 340, policyId: "flank", element: "veil", patternId: "veil-flank" },
  guardian: { id: "guardian", hp: 9000, speed: 1700, damage: 20, attackTicks: 90, xp: 18, radius: 540, policyId: "elite-escort", element: "frost", patternId: "frost-guard" },
  ranged: { id: "ranged", hp: 2800, speed: 2000, damage: 20, attackTicks: 120, xp: 12, radius: 320, projectileRange: 6000, projectileTicks: 120, policyId: "resource-denial", element: "void", patternId: "void-volley" },
});
export const COMPANIONS = freeze({
  "ember-cohort": { id: "ember-cohort", name: "Ember Cohort", damage: 420, fireTicks: 36, range: 4600, element: "ember" },
  "rift-lens": { id: "rift-lens", name: "Rift Lens", damage: 540, fireTicks: 48, range: 5200, element: "void" },
  "veil-vanguard": { id: "veil-vanguard", name: "Veil Vanguard", damage: 360, fireTicks: 28, range: 4000, element: "veil" },
  "anchor-shard": { id: "anchor-shard", name: "Anchor Shard", damage: 720, fireTicks: 70, range: 5600, element: "frost" },
  "throne-echo": { id: "throne-echo", name: "Throne Echo", damage: 480, fireTicks: 38, range: 4800, element: "void" },
  "dawnless-crown": { id: "dawnless-crown", name: "Moonless Command", damage: 600, fireTicks: 52, range: 6000, element: "veil" },
  "pack-warden": { id: "pack-warden", name: "Pack Warden", damage: 400, fireTicks: 30, range: 4200, element: "ember" },
  "lantern-reaver": { id: "lantern-reaver", name: "Lantern Reaver", damage: 480, fireTicks: 40, range: 4400, element: "ember" },
  "requiem-warden": { id: "requiem-warden", name: "Requiem Warden", damage: 440, fireTicks: 38, range: 4600, element: "frost" },
});
/**
 * Active skills declare their own area identity: `element` picks the matchup row, `areaWeightBp`
 * overrides the generic skill weight, `areaRadius` overrides the disc, and `fieldTicks` decides
 * whether the cast leaves a lingering field. A skill that declares none of them inherits
 * `AREA_SOURCES.skill` unchanged, so this stays additive to the authored damage/cooldown values.
 */
export const SKILLS = freeze({
  "rift-bolt": { id: "rift-bolt", name: "Echo Bolt", role: "active", kind: "active", damage: 1800, cooldown: 390, radius: 0, motion: "attack", vfx: "rift-bolt", element: "void", areaRadius: 1800, areaWeightBp: 11000, fieldTicks: 0 },
  "soul-lance": { id: "soul-lance", name: "Echo Lance", role: "active", kind: "active", damage: 1200, cooldown: 270, radius: 0, motion: "critical", vfx: "soul-lance", element: "veil", areaRadius: 2200, areaWeightBp: 9000, fieldTicks: 0 },
  "grave-pulse": { id: "grave-pulse", name: "Echo Pulse", role: "active", kind: "active", damage: 650, cooldown: 240, radius: 3000, motion: "critical", vfx: "grave-pulse", element: "ember", areaRadius: 3000, areaWeightBp: 10000, fieldTicks: 180 },
  "void-aegis": { id: "void-aegis", name: "Zenith Aegis", role: "active", kind: "active", damage: 0, cooldown: 300, radius: 0, integrity: 50, motion: "defence", vfx: "void-aegis", element: "frost", areaRadius: 1600, areaWeightBp: 0, fieldTicks: 0 },
  "shadow-step": { id: "shadow-step", name: "Dusk Step", role: "active", kind: "active", damage: 900, cooldown: 210, radius: 4500, motion: "avoid", vfx: "shadow-step", element: "frost", areaRadius: 2400, areaWeightBp: 8500, fieldTicks: 90 },
  // --- aoe-burst (광역 파괴) --------------------------------------------
  // Authored in design/skill-and-growth-spec.md §2.2 as the answer to
  // SURGE/BIGWAVE density ("근접 처치율 2.7/s로는 밀도 60을 감당할 수 없다"), and
  // required by master-numeric-contract.md §2 row 2 ("광역기 필요성 발생"). Both
  // are 원형 360°, which orderedTargets() already resolves natively.
  //
  // `regents-verdict` is the BIGWAVE payoff: damage is `min(targets, targetCap)
  // * damagePerTarget`, so it is worth 400 against one enemy and 4800 against
  // twelve. Density IS the damage — that is what makes one cast resolve a wave.
  // `damage: 0` keeps skillRankDamage()'s base term at zero so rank scaling
  // applies to damagePerTarget alone (castSkill()), and it also keeps the area
  // model off this skill entirely: castSkill() only splashes when the authored
  // damage is positive, so its per-target sum is never double-counted.
  //
  // `areaRadius` deliberately equals each skill's authored `radius`: the burst
  // already damages everything inside its stated circle, so the area layer adds
  // the element matchup and the ring/blink presentation without widening the
  // circle the player was told about.
  "ash-nova": { id: "ash-nova", name: "Ash Nova", role: "active", kind: "active", category: "aoe-burst", damage: 1400, cooldown: 480, radius: 3600, motion: "critical", vfx: "ash-nova", element: "ember", areaRadius: 3600, areaWeightBp: 10000, fieldTicks: 0 },
  "regents-verdict": { id: "regents-verdict", name: "Regent's Verdict", role: "active", kind: "active", category: "aoe-burst", damage: 0, damagePerTarget: 400, targetCap: 12, cooldown: 900, radius: 5000, motion: "critical", vfx: "regents-verdict", element: "void", areaRadius: 5000, areaWeightBp: 10000, fieldTicks: 0 },
  "eclipse-edge": { id: "eclipse-edge", name: "Dusk Edge", role: "passive", kind: "passive", basicDamage: 180 },
  "soul-magnet": { id: "soul-magnet", name: "Echo Magnet", role: "passive", kind: "passive", pickupRange: 1500 },
  "ward-binder": { id: "ward-binder", name: "Zenith Binder", role: "passive", kind: "passive", maxIntegrity: 120 },
});
export const BOSSES = freeze({
  "s1-cinder-warden": { id: "s1-cinder-warden", hp: 40000, speed: 1800, damage: 200, attackTicks: 90, xp: 100, radius: 900, policyId: "player-pursuit", element: "ember", patternId: "cinder-warden-cycle" },
  "s2-veil-tactician": { id: "s2-veil-tactician", hp: 48000, speed: 1650, damage: 200, attackTicks: 90, xp: 110, radius: 900, policyId: "resource-denial", element: "veil", patternId: "veil-tactician-cycle" },
  "s3-gate-sovereign": { id: "s3-gate-sovereign", hp: 60000, speed: 1500, damage: 300, attackTicks: 90, xp: 120, radius: 980, policyId: "low-hp-focus", element: "void", patternId: "gate-sovereign-cycle" },
});

/* ---------------------------------------------------------------------------------------------
 * Attack-pattern presets and the AI response patterns that answer them.
 *
 * A pattern is an ORDERED, LOOPING sequence of steps. Each step is a three-phase action —
 * telegraph (the readable tell), active (the one tick that authors contact) and recovery (the
 * punish window) — matching the startup/active/recovery contract the combat design uses
 * elsewhere. The simulation owns the timing; the renderer only reflects the phase it is told.
 *
 * Because timing lives here and nowhere else, a designer can retime a boss without touching a
 * single line of behaviour code, and the same table is what the AI response patterns read when
 * they decide whether to evade, spread out or punish.
 * ------------------------------------------------------------------------------------------- */

/** Contact shapes a step can author. `disc` is centred on the attacker, `lead` on the target. */
export const ATTACK_SHAPES = freeze(["disc", "lead", "ring"]);

const attackStep = (id, { telegraphTicks, activeTicks, recoveryTicks, shape = "disc", radius, damageBp = 10000, weightBp = null, fieldTicks = 0, element = null }) => freeze({
  id,
  telegraphTicks,
  activeTicks,
  recoveryTicks,
  totalTicks: telegraphTicks + activeTicks + recoveryTicks,
  shape,
  radius,
  damageBp,
  weightBp,
  fieldTicks,
  element,
});

export const ATTACK_PATTERNS = freeze({
  /** Trash rusher: one short tell, one contact. Readable at a glance, cheap to dodge. */
  "ember-rush": freeze({
    id: "ember-rush",
    element: "ember",
    steps: freeze([
      attackStep("lunge", { telegraphTicks: 18, activeTicks: 6, recoveryTicks: 24, radius: 950, damageBp: 10000 }),
    ]),
  }),
  /** Flanker alternates a fast poke with a wider arc, so spacing alone is not a full answer. */
  "veil-flank": freeze({
    id: "veil-flank",
    element: "veil",
    steps: freeze([
      attackStep("poke", { telegraphTicks: 12, activeTicks: 4, recoveryTicks: 20, radius: 800, damageBp: 8500 }),
      attackStep("arc", { telegraphTicks: 24, activeTicks: 6, recoveryTicks: 26, radius: 1400, damageBp: 11500 }),
    ]),
  }),
  /** Guardian is slow and wide: the escort punishes crowding around the leader it protects. */
  "frost-guard": freeze({
    id: "frost-guard",
    element: "frost",
    steps: freeze([
      attackStep("slam", { telegraphTicks: 34, activeTicks: 8, recoveryTicks: 40, radius: 1500, damageBp: 12000, fieldTicks: 60 }),
    ]),
  }),
  /** Ranged denial: a long tell, a ring that punishes standing on top of the volley. */
  "void-volley": freeze({
    id: "void-volley",
    element: "void",
    steps: freeze([
      attackStep("volley", { telegraphTicks: 40, activeTicks: 4, recoveryTicks: 44, shape: "lead", radius: 1100, damageBp: 9000 }),
    ]),
  }),
  /** Stage 1 boss: pursue-and-slam, then a field that denies the spot it just hit. */
  "cinder-warden-cycle": freeze({
    id: "cinder-warden-cycle",
    element: "ember",
    steps: freeze([
      attackStep("cleave", { telegraphTicks: 45, activeTicks: 8, recoveryTicks: 37, radius: 2600, damageBp: 10000, weightBp: 11000 }),
      attackStep("ember-fall", { telegraphTicks: 60, activeTicks: 6, recoveryTicks: 54, shape: "lead", radius: 3200, damageBp: 12000, weightBp: 12000, fieldTicks: 180 }),
    ]),
  }),
  /** Stage 2 boss: a ring that punishes hugging, then a lead disc that punishes running. */
  "veil-tactician-cycle": freeze({
    id: "veil-tactician-cycle",
    element: "veil",
    steps: freeze([
      attackStep("veil-ring", { telegraphTicks: 50, activeTicks: 6, recoveryTicks: 34, shape: "ring", radius: 3000, damageBp: 9000, weightBp: 12500 }),
      attackStep("mirror-step", { telegraphTicks: 36, activeTicks: 6, recoveryTicks: 48, shape: "lead", radius: 2400, damageBp: 11000, weightBp: 11000, fieldTicks: 120 }),
    ]),
  }),
  /** Stage 3 boss: three escalating steps, the last one the widest contact in the game. */
  "gate-sovereign-cycle": freeze({
    id: "gate-sovereign-cycle",
    element: "void",
    steps: freeze([
      attackStep("sovereign-cleave", { telegraphTicks: 40, activeTicks: 8, recoveryTicks: 32, radius: 2800, damageBp: 9500, weightBp: 11000 }),
      attackStep("throne-quake", { telegraphTicks: 55, activeTicks: 8, recoveryTicks: 45, radius: 3600, damageBp: 11000, weightBp: 12500, fieldTicks: 150 }),
      attackStep("null-collapse", { telegraphTicks: 70, activeTicks: 10, recoveryTicks: 60, shape: "lead", radius: 4200, damageBp: 13000, weightBp: 13000, fieldTicks: 240 }),
    ]),
  }),
});

/** Pattern preset for a body, or null when that body has no authored pattern. */
export function attackPatternFor(patternId) {
  return ATTACK_PATTERNS[patternId] || null;
}

/**
 * Sampler: where a pattern stands after `elapsedTicks`. Pure, total and deterministic — the same
 * (patternId, elapsed) always yields the same phase, which is what makes pattern fixtures
 * reproducible without playing the encounter.
 */
export function samplePattern(patternId, elapsedTicks) {
  const pattern = attackPatternFor(patternId);
  if (!pattern || !pattern.steps.length) return null;
  const cycleTicks = pattern.steps.reduce((total, step) => total + step.totalTicks, 0);
  const elapsed = Math.max(0, Math.trunc(elapsedTicks));
  const loop = Math.trunc(elapsed / cycleTicks);
  let offset = elapsed % cycleTicks;
  for (let index = 0; index < pattern.steps.length; index += 1) {
    const step = pattern.steps[index];
    if (offset >= step.totalTicks) {
      offset -= step.totalTicks;
      continue;
    }
    const phase = offset < step.telegraphTicks
      ? "telegraph"
      : (offset < step.telegraphTicks + step.activeTicks ? "active" : "recovery");
    return {
      patternId: pattern.id,
      stepId: step.id,
      stepIndex: index,
      step,
      phase,
      phaseTick: phase === "telegraph"
        ? offset
        : (phase === "active" ? offset - step.telegraphTicks : offset - step.telegraphTicks - step.activeTicks),
      /** One id per (loop, step): stable across a step's three phases, new on every repeat. */
      actionId: `${pattern.id}:${loop}:${index}:${step.id}`,
      cycleTicks,
    };
  }
  return null;
}

/**
 * AI response patterns — what the OTHER side does about a telegraph.
 *
 * These are not flavour: each entry is read by the simulation at the tick its trigger fires.
 * They are the reason a wide telegraph is a decision rather than an unavoidable tax.
 */
export const AI_RESPONSE_PATTERNS = freeze({
  /** A body covered by a live telegraph disc steps out along the perpendicular. */
  evade: freeze({
    id: "evade",
    trigger: "telegraph-covers-self",
    windowTicks: 45,
    /** Extra world units per tick granted while evading, on top of the body's own speed. */
    speedBonusBp: 3500,
    /** How far outside the telegraph rim the body wants to end up. */
    clearanceBp: 2500,
  }),
  /** Two or more allies inside one telegraph: they scatter instead of all eating it. */
  spread: freeze({
    id: "spread",
    trigger: "shared-telegraph",
    minBodies: 2,
    windowTicks: 60,
    /** Separation the scatter aims for, as a share of the telegraph radius. */
    separationBp: 6000,
  }),
  /** The recovery window is the answer to a heavy attack: allied fire speeds up inside it. */
  punish: freeze({
    id: "punish",
    trigger: "attacker-recovering",
    windowTicks: 60,
    /** Cooldown scale applied to allied fire during the window. 7000bp = 30% faster. */
    cooldownScaleBp: 7000,
  }),
  /** A body that cannot clear the disc in time braces instead, trading mobility for reduction. */
  brace: freeze({
    id: "brace",
    trigger: "telegraph-unavoidable",
    windowTicks: 30,
    /** Incoming area share while bracing. */
    damageScaleBp: 6500,
  }),
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
      version: "v2",
      modules: freeze(["ember-relay-spire", "drowned-forge-arch", "ash-gatehouse"]),
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
/**
 * Stage encounter routes are authored independently from stage-world presentation. Objective
 * points are simulation coordinates; renderers may decorate them, but may not redefine their
 * order, wave ownership, pacing, retry budget, or fairness caps.
 */
const encounterPath = (id, objectiveId, direction, waypoints) => freeze({
  id,
  objectiveId,
  direction,
  waypoints: freeze(waypoints.map((waypoint) => freeze({ radius: 400, ...waypoint }))),
});

const routeWaypoint = (id, x, y, extra = {}) => freeze({ id, x, y, ...extra });

const objectiveRoutePaths = (stageId, objectiveId, point, approaches) => approaches.map(
  ({ direction, via }) => encounterPath(
    `encounter-path:${stageId}:${objectiveId}:${direction.toLowerCase()}`,
    objectiveId,
    direction,
    [
      ...via,
      routeWaypoint(`contest:${objectiveId}`, point.x, point.y, {
        radius: Math.max(400, Math.trunc(point.radius / 2)),
        contest: true,
      }),
    ],
  ),
);

const stageEncounterRoute = ({
  stageId,
  commitmentCap,
  maxConcurrentEnemies,
  bigWaveMaxConcurrentEnemies,
  bigWaveCommitmentCap,
  bigWaveSpawnIntervalTicks,
  spawnIntervalTicks,
  objectives,
  approaches,
  finale,
}) => freeze({
  id: `encounter-route:${stageId}:v1`,
  commitmentCap,
  maxConcurrentEnemies,
  // Phase escalation (master-numeric-contract.md §2): the authored concurrency
  // ceiling rises 8 -> 18 -> 34 -> 60 across DESCENT..BIGWAVE. The runtime had a
  // single flat number, so it was permanently pinned at the DESCENT-tier value
  // and a "big" wave was never denser than the opening skirmish -- which is why
  // an area skill could never catch more than 7 bodies.
  //
  // These are the BIG-wave ceilings only; `kind: "normal"` waves keep the value
  // above. Deliberately BELOW the contract's BIGWAVE 60: that row is gated on
  // "적 메시 인스턴스드 렌더 필수 (60개 개별 draw 금지)" (§9), and this renderer
  // still clones one skinned GLB per actor (instantiateActorModel). 60 concurrent
  // rigged actors would breach the 180 draw-call budget outright. Raising past
  // these values is blocked on instanced rendering, not on this table.
  bigWaveMaxConcurrentEnemies,
  bigWaveCommitmentCap,
  // Third lever, and the one that actually decides whether a big wave READS as a
  // wave: the queue drain rate. A raised concurrency ceiling does nothing while
  // bodies trickle in one per `spawnIntervalTicks` -- measured, the field held 14
  // against a ceiling of 22, so the interval was binding, not the cap. A big wave
  // must arrive as a burst ("정신없는 최대 밀도", master-numeric-contract.md §2 row 4).
  bigWaveSpawnIntervalTicks,
  spawnIntervalTicks,
  objectives: freeze(objectives),
  paths: freeze([
    ...objectives.flatMap((objective) => objectiveRoutePaths(
      stageId,
      objective.id,
      objective.point,
      approaches[objective.id],
    )),
    ...finale.paths,
  ]),
  finale: freeze({
    objectiveOrder: freeze(["echo-recovery", "occupation", "boss-kill", "extraction"]),
    elitePathId: finale.elitePathId,
    bossPathId: finale.bossPathId,
  }),
});

const objectiveDefinition = (id, kind, point, waveSlots, retry, recovery, contestTicks) => freeze({
  id,
  kind,
  cameraCueId: `camera:encounter:${id}`,
  point: freeze(point),
  waveSlots: freeze(waveSlots),
  retry: freeze(retry),
  recovery: freeze(recovery),
  contestTicks,
});

const finalePaths = (stageId, eliteVia, bossVia) => {
  const elitePathId = `encounter-path:${stageId}:echo-recovery`;
  const bossPathId = `encounter-path:${stageId}:boss-kill`;
  return freeze({
    elitePathId,
    bossPathId,
    paths: freeze([
      encounterPath(elitePathId, "echo-recovery", "W", eliteVia),
      encounterPath(bossPathId, "boss-kill", "W", bossVia),
    ]),
  });
};

export const STAGE_ENCOUNTER_ROUTES = freeze({
  "cinder-span": stageEncounterRoute({
    stageId: "cinder-span",
    commitmentCap: 3,
    maxConcurrentEnemies: 8,
    bigWaveMaxConcurrentEnemies: 22,
    bigWaveCommitmentCap: 7,
    bigWaveSpawnIntervalTicks: 5,
    spawnIntervalTicks: 18,
    objectives: [
      objectiveDefinition(
        "cinder-relay-crossing",
        "corridor",
        { x: 14600, y: 5200, radius: 1100 },
        [0, 1, 2, 3, 4],
        { recoveryTicks: 180, maxAttempts: 3, commanderFloorBp: 3500, gateFloorBp: 3000 },
        { commanderBp: 900, gateBp: 600 },
        60,
      ),
      objectiveDefinition(
        "cinder-forge-stand",
        "arena",
        { x: 17400, y: 6000, radius: 1400 },
        [5, 6, 7, 8, 9],
        { recoveryTicks: 210, maxAttempts: 3, commanderFloorBp: 4000, gateFloorBp: 3500 },
        { commanderBp: 1100, gateBp: 700 },
        75,
      ),
    ],
    approaches: {
      "cinder-relay-crossing": [
        { direction: "W", via: [routeWaypoint("cinder-west-entry", 6200, 5800), routeWaypoint("cinder-relay-west", 11200, 5200)] },
        { direction: "SW", via: [routeWaypoint("cinder-south-entry", 6000, 9800), routeWaypoint("cinder-relay-south", 11800, 7200)] },
      ],
      "cinder-forge-stand": [
        { direction: "W", via: [routeWaypoint("cinder-west-entry", 6200, 5800), routeWaypoint("contest:cinder-relay-crossing", 14600, 5200)] },
        { direction: "SW", via: [routeWaypoint("cinder-south-entry", 6000, 9800), routeWaypoint("contest:cinder-relay-crossing", 14600, 5200)] },
      ],
    },
    finale: finalePaths(
      "cinder-span",
      [routeWaypoint("contest:cinder-forge-stand", 17400, 6000), routeWaypoint("cinder-echo-recovery", 17600, 6000, { contest: true, contestTicks: 90, radius: 500 })],
      [routeWaypoint("cinder-bind-approach", 15400, 6000), routeWaypoint("cinder-boss-threshold", 19000, 6000, { contest: true, contestTicks: 120, radius: 600 })],
    ),
  }),
  "abyss-chancel": stageEncounterRoute({
    stageId: "abyss-chancel",
    commitmentCap: 4,
    maxConcurrentEnemies: 9,
    bigWaveMaxConcurrentEnemies: 24,
    bigWaveCommitmentCap: 8,
    bigWaveSpawnIntervalTicks: 6,
    spawnIntervalTicks: 24,
    objectives: [
      objectiveDefinition(
        "chancel-nave-advance",
        "corridor",
        { x: 15000, y: 6000, radius: 1000 },
        [0, 1, 2, 3],
        { recoveryTicks: 240, maxAttempts: 3, commanderFloorBp: 4000, gateFloorBp: 3500 },
        { commanderBp: 1000, gateBp: 700 },
        75,
      ),
      objectiveDefinition(
        "chancel-transept-lock",
        "arena",
        { x: 17600, y: 8200, radius: 1500 },
        [4, 5, 6, 7, 8, 9],
        { recoveryTicks: 270, maxAttempts: 3, commanderFloorBp: 4500, gateFloorBp: 4000 },
        { commanderBp: 1200, gateBp: 800 },
        90,
      ),
    ],
    approaches: {
      "chancel-nave-advance": [
        { direction: "W", via: [routeWaypoint("chancel-west-entry", 6200, 6000), routeWaypoint("chancel-nave-west", 11400, 6000)] },
        { direction: "SW", via: [routeWaypoint("chancel-south-entry", 6200, 9800), routeWaypoint("chancel-nave-south", 11600, 7600)] },
        { direction: "NW", via: [routeWaypoint("chancel-north-entry", 6200, 2000), routeWaypoint("chancel-nave-north", 11600, 4400)] },
      ],
      "chancel-transept-lock": [
        { direction: "W", via: [routeWaypoint("chancel-west-entry", 6200, 6000), routeWaypoint("contest:chancel-nave-advance", 15000, 6000)] },
        { direction: "SW", via: [routeWaypoint("chancel-south-entry", 6200, 9800), routeWaypoint("contest:chancel-nave-advance", 15000, 6000)] },
        { direction: "NW", via: [routeWaypoint("chancel-north-entry", 6200, 2000), routeWaypoint("contest:chancel-nave-advance", 15000, 6000)] },
      ],
    },
    finale: finalePaths(
      "abyss-chancel",
      [routeWaypoint("contest:chancel-transept-lock", 17600, 8200), routeWaypoint("chancel-echo-recovery", 18200, 5200, { contest: true, contestTicks: 105, radius: 500 })],
      [routeWaypoint("chancel-bind-approach", 16000, 7000), routeWaypoint("chancel-boss-threshold", 19300, 6000, { contest: true, contestTicks: 135, radius: 600 })],
    ),
  }),
  "echo-throne": stageEncounterRoute({
    stageId: "echo-throne",
    commitmentCap: 4,
    maxConcurrentEnemies: 10,
    bigWaveMaxConcurrentEnemies: 26,
    bigWaveCommitmentCap: 8,
    bigWaveSpawnIntervalTicks: 4,
    spawnIntervalTicks: 15,
    objectives: [
      objectiveDefinition(
        "throne-aisle-break",
        "corridor",
        { x: 15200, y: 6000, radius: 1050 },
        [0, 1, 2, 3, 4, 5],
        { recoveryTicks: 210, maxAttempts: 3, commanderFloorBp: 4500, gateFloorBp: 4000 },
        { commanderBp: 1100, gateBp: 750 },
        90,
      ),
      objectiveDefinition(
        "throne-dais-stand",
        "arena",
        { x: 18000, y: 6000, radius: 1550 },
        [6, 7, 8, 9, 10],
        { recoveryTicks: 300, maxAttempts: 3, commanderFloorBp: 5000, gateFloorBp: 4500 },
        { commanderBp: 1300, gateBp: 900 },
        105,
      ),
    ],
    approaches: {
      "throne-aisle-break": [
        { direction: "W", via: [routeWaypoint("throne-west-entry", 6000, 6000), routeWaypoint("throne-aisle-west", 11600, 6000)] },
        { direction: "SW", via: [routeWaypoint("throne-south-entry", 6000, 10000), routeWaypoint("throne-aisle-south", 11800, 7600)] },
        { direction: "NW", via: [routeWaypoint("throne-north-entry", 6000, 2000), routeWaypoint("throne-aisle-north", 11800, 4400)] },
      ],
      "throne-dais-stand": [
        { direction: "W", via: [routeWaypoint("throne-west-entry", 6000, 6000), routeWaypoint("contest:throne-aisle-break", 15200, 6000)] },
        { direction: "SW", via: [routeWaypoint("throne-south-entry", 6000, 10000), routeWaypoint("contest:throne-aisle-break", 15200, 6000)] },
        { direction: "NW", via: [routeWaypoint("throne-north-entry", 6000, 2000), routeWaypoint("contest:throne-aisle-break", 15200, 6000)] },
      ],
    },
    finale: finalePaths(
      "echo-throne",
      [routeWaypoint("contest:throne-dais-stand", 18000, 6000), routeWaypoint("throne-echo-recovery", 18400, 6000, { contest: true, contestTicks: 120, radius: 550 })],
      [routeWaypoint("throne-bind-approach", 16200, 7600), routeWaypoint("throne-boss-threshold", 19400, 6000, { contest: true, contestTicks: 150, radius: 650 })],
    ),
  }),
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
   * is ~10-12 s of sustained in-contact direct-light fire, with escorts sized inside the same budget.
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
  "cinder-span": { gateIntegrity: 1600, defenseTicks: 10200, waveCount: 10, classes: freeze(["rusher", "flanker", "ranged"]), kindCycle: freeze(["normal", "normal", "big", "mid"]), openingPolicyId: "player-pursuit", pressureLane: "chokepath", midbossEnemy: "guardian" },
  "abyss-chancel": { gateIntegrity: 1700, defenseTicks: 10500, waveCount: 10, classes: freeze(["ranged", "flanker", "rusher", "guardian"]), kindCycle: freeze(["normal", "big", "normal", "mid"]), pressureLane: "flank", midbossEnemy: "flanker" },
  // echo-throne is the campaign's LAST stage, so it must ask for the largest set of distinct
  // answers, not merely the largest HP `scale` (100 -> 115 -> 130). Measured by
  // `scripts/scan-stage-variation.mjs` it did the opposite: it fielded three classes against
  // abyss-chancel's four, and it copied cinder-span's mid-boss class, pressure lane and wave-kind
  // rhythm outright, so stage 3 was stage 1 with bigger numbers. It now fields all four classes in
  // its own rotation order, walls on a RANGED mid-boss (a body that must be closed on, not a slower
  // guardian to be out-traded), and keeps a 5-slot rhythm that no other stage uses.
  "echo-throne": { gateIntegrity: 1800, defenseTicks: 10800, waveCount: 11, classes: freeze(["flanker", "ranged", "guardian", "rusher"]), kindCycle: freeze(["normal", "mid", "normal", "big", "normal"]), openingPolicyId: "low-hp-focus", pressureLane: "chokepath", midbossEnemy: "ranged" },
});

/**
 * Wave size is derived from a CLEAR BUDGET, not from a raw authored count.
 *
 *   clearableHp(cadence) = cadenceSeconds * PLAYER_BASELINE_DPS
 *   waveHp               = clearableHp * WAVE_PRESSURE_BP * kind.countBp
 *   count                = waveHp / (enemyHp * stageScale / 100)
 *
 * PLAYER_BASELINE_DPS is sustained in-contact direct LIGHT_1 → LIGHT_2 → LIGHT_3 output:
 * the 70% + 90% + 120% hits against COMMANDER.basicDamage total 2520 damage, completed
 * ready-to-ready every 28 ticks. At 60 ticks per second, that is 5400 single-target DPS.
 * Companions, items, rewards, skill ranks and meta progression are additional headroom.
 * WAVE_PRESSURE_BP preserves that headroom deliberately — a normal wave asks for 55% of the
 * sustained direct-light clear capacity in one cadence slot, so a well-played wave clears (and pays the
 * WAVE_CLEARED recovery) while a sloppy one leaks into the next wave.
 *
 * The critical property for a 10-13 wave stage: because the divisor carries `stageScale`, late
 * stages field FEWER, TOUGHER bodies instead of the same count at 2.4x HP, which is what made the
 * long format unclearable at gate-zenith during measurement.
 */
export const PLAYER_BASELINE_DPS = (
  COMMANDER.basicDamage
  * DIRECT_COMBAT.light.reduce((totalDamageBp, action) => totalDamageBp + action.damageBp, 0)
  * TICK_RATE
) / (10000 * DIRECT_COMBAT.lightReadyToReadyTicks);
export const WAVE_PRESSURE_BP = 5500;
/** Builds one stage's authored, doctrine-driven wave plan. Deterministic and data-only. */
function buildDoctrineWavePlan(stageId, doctrine, tactics, stageScale) {
  const directions = tactics.spawnDirections?.length ? tactics.spawnDirections : ["W", "NW", "SW"];
  const encounterRoute = STAGE_ENCOUNTER_ROUTES[stageId];
  const cadence = Math.floor(doctrine.defenseTicks / doctrine.waveCount);
  const cadenceSeconds = cadence / TICK_RATE;
  const flankLane = doctrine.pressureLane === "flank" && tactics.flank;
  return freeze(Array.from({ length: doctrine.waveCount }, (unused, slot) => {
    const kind = slot === doctrine.waveCount - 1
      ? "big"
      : doctrine.kindCycle[slot % doctrine.kindCycle.length];
    const encounterObjective = encounterRoute.objectives.find((objective) => objective.waveSlots.includes(slot));
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
    // Statement waves pin pressure behavior. Normal waves stay seeded except for a declared
    // opening policy, which makes the first encounter's pressure legible.
    const policyId = slot === 0 && doctrine.openingPolicyId
      ? doctrine.openingPolicyId
      : kind === "big"
        ? (flankLane ? "flank" : "gate-pressure")
        : kind === "mid" ? "elite-escort" : null;
    const direction = directions[slot % directions.length];
    const encounterPath = encounterRoute.paths.find((path) =>
      path.objectiveId === encounterObjective?.id && path.direction === direction);
    if (!encounterObjective || !encounterPath) {
      throw new RangeError(`Wave ${stageId}:${slot} requires an authored objective path for ${direction}`);
    }
    return freeze({
      slot,
      tick: slot * cadence,
      kind,
      label: profile.label,
      direction,
      routeId: encounterPath.id,
      objectiveId: encounterObjective.id,
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
  const encounterRoute = STAGE_ENCOUNTER_ROUTES[id];
  if (!encounterRoute || encounterRoute.objectives.length < 2) {
    throw new RangeError(`Stage requires at least two encounter objectives: ${id}`);
  }
  const routedSlots = encounterRoute.objectives.flatMap(({ waveSlots }) => waveSlots);
  const orderedSlots = encounterRoute.objectives.map(({ waveSlots }) => [...waveSlots].sort((left, right) => left - right));
  if (routedSlots.length !== doctrine.waveCount
      || new Set(routedSlots).size !== doctrine.waveCount
      || routedSlots.some((slot) => slot < 0 || slot >= doctrine.waveCount)
      || orderedSlots.some((slots, index) => index > 0 && slots[0] <= orderedSlots[index - 1].at(-1))) {
    throw new RangeError(`Encounter route must own every wave slot once and in objective order: ${id}`);
  }
  const pathIds = new Set(encounterRoute.paths.map(({ id: pathId }) => pathId));
  if (pathIds.size !== encounterRoute.paths.length
      || !pathIds.has(encounterRoute.finale.elitePathId)
      || !pathIds.has(encounterRoute.finale.bossPathId)
      || encounterRoute.paths.some((path) => !path.waypoints.length
        || new Set(path.waypoints.map(({ id: waypointId }) => waypointId)).size !== path.waypoints.length)) {
    throw new RangeError(`Encounter route paths must be unique, non-empty, and cover the finale: ${id}`);
  }
  return freeze({
    id, name, bossName, scale, eliteId, eliteKind, eliteCompanion, boss,
    gateTicks: doctrine.defenseTicks,
    legacyGateTicks,
    waves,
    doctrine,
    wavePlan: buildDoctrineWavePlan(id, doctrine, tactics, scale),
    tactics,
    encounterRoute,
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
    objectiveOrder: freeze([
      "gate-defense",
      ...stageEntry.encounterRoute.objectives.map(({ id }) => id),
      "echo-recovery",
      "growth",
      "occupation",
      "boss-kill",
      "extraction",
    ]),
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
