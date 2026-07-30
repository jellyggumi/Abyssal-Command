/**
 * Deterministic, renderer-neutral 60 Hz defense-survivor simulation.
 * Every state-changing API returns a new frozen run; callers may retain old runs.
 */
import * as Catalog from "./defense-catalog.js";
import {
  ARENA, AUDIO_CUES, BOSSES, COLLISION, COMBAT_TARGETING, COMMANDER, COMPANION_AUTONOMY, COMPANIONS,
  CUTSCENES, ENEMIES, CARRY_OVER_MAX_ITEMS, CARRY_OVER_MAX_RANK, CARRY_OVER_RANK_DECAY,

  MAX_SKILL_RANK, SKILL_RANK_COOLDOWN_FLOOR, SKILL_RANK_COOLDOWN_STEP, SKILL_RANK_DAMAGE_STEP,
  SKILL_RANK_PASSIVE_SHARE,
  GATE, ITEMS, MEASUREMENT_PROFILES, OCTANT_VECTORS, REWARDS, SKILLS, STAGE_BY_ID, STAGE_ITEM_IDS,
  STAGE_REWARD_IDS, TARGET_PRIORITY, TICK_RATE, XP_GROWTH,
  AREA_BP, AREA_COMBAT, AREA_FIELD, AI_RESPONSE_PATTERNS,
  areaShareBp, areaSourceProfile, elementOf, samplePattern,
} from "./defense-catalog.js";
import {
  BACK_ROW_SYNERGY_DAMAGE_BONUS, BOSS_RALLY_COOLDOWN_REDUCTION, COMPANION_ROLES,
  deriveWardenRuntimeStats, deriveCompanionRuntimeStats, companionFormationIntegrity,
  FORMATION_STANCES, orderCompanionsByFormationIntent, STANCE_CONFIG,
} from "./rpg-catalog.js";
import { stageWorldFor } from "./stage-world-catalog.js";
import { questObjectiveForEvent, stageStoryFor, storyBeatForEvent } from "./stage-story-catalog.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const clamp = (value, low, high) => value < low ? low : value > high ? high : value;
const distanceSquared = (a, b) => { const x = a.x - b.x; const y = a.y - b.y; return x * x + y * y; };
const scaled = (value, scale) => Math.trunc(value * scale / 100);
// Abyss Depth (wiki reports 2026-07-30 GAP-A/C): run-scoped clear-to-unlock difficulty ladder.
// depth 0 is a pure identity (same seed stream, same scale, same snapshot keys) so every existing
// digest fixture is byte-unchanged. Each depth adds +ABYSS_DEPTH_SCALE_STEP% enemy HP/XP and folds
// into the WAVE rng stream only (rotating enemy policy/composition), never the identity/combat rng.
export const ABYSS_DEPTH_MAX = 3; // 3 stages -> 3 named Abyss Depth packages (defense-catalog ABYSS_DEPTH_PACKAGES)
const ABYSS_DEPTH_SCALE_STEP = 15;
const rngNext = (seed) => { let x = seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
const stageFor = (stageId) => {
  const stage = STAGE_BY_ID[stageId];
  if (!stage) throw new RangeError(`Unknown defense stage: ${stageId}`);
  return stage;
};
const validLoadout = (loadout) => [...new Set((Array.isArray(loadout) ? loadout : []).filter((id) => COMPANIONS[id]))].sort().slice(0, 3);
const nextId = (run, prefix) => `${prefix}-${++run.nextId}`;
const actor = (id, kind, x, y, hp, maxHp, extra = {}) => ({ id, kind, x, y, elevation: 0, hp, maxHp, ...extra });
const sortedActors = (entries) => [...entries].sort((left, right) => left.id.localeCompare(right.id));
const stageCutscene = (stage) => CUTSCENES[stage.id] || CUTSCENES.default;
const eventCue = (name) => AUDIO_CUES[name]?.id || null;

const worldForRun = (run) => stageWorldFor(run.stage.id);

function meshSupportAt(world, x, y) {
  const colliders = world.gameplay.meshColliders;
  if (!Array.isArray(colliders)) return null;
  let support = null;
  colliders.forEach((collider) => {
    collider.triangles.forEach((vertices, triangleIndex) => {
      const [first, second, third] = vertices;
      const denominator = (second.y - third.y) * (first.x - third.x)
        + (third.x - second.x) * (first.y - third.y);
      const firstWeight = ((second.y - third.y) * (x - third.x)
        + (third.x - second.x) * (y - third.y)) / denominator;
      const secondWeight = ((third.y - first.y) * (x - third.x)
        + (first.x - third.x) * (y - third.y)) / denominator;
      const thirdWeight = 1 - firstWeight - secondWeight;
      if (firstWeight < 0 || secondWeight < 0 || thirdWeight < 0
        || firstWeight > 1 || secondWeight > 1 || thirdWeight > 1) return;
      const elevation = Math.round(firstWeight * first.elevation
        + secondWeight * second.elevation + thirdWeight * third.elevation);
      const candidate = { elevation, supportMeshId: collider.id, triangleIndex };
      if (!support || candidate.elevation > support.elevation
        || (candidate.elevation === support.elevation
          && (candidate.supportMeshId.localeCompare(support.supportMeshId) < 0
            || (candidate.supportMeshId === support.supportMeshId
              && candidate.triangleIndex < support.triangleIndex)))) {
        support = candidate;
      }
    });
  });
  return support;
}

function terrainSupportAt(world, x, y) {
  const meshSupport = meshSupportAt(world, x, y);
  if (meshSupport) return meshSupport;
  let elevation = 0;
  for (const surface of world.gameplay.surfaces) {
    const area = surface.bounds;
    if (x < area.minX || x > area.maxX || y < area.minY || y > area.maxY) continue;
    const axis = surface.elevation.axis;
    const min = axis === "x" ? area.minX : area.minY;
    const max = axis === "x" ? area.maxX : area.maxY;
    const coordinate = clamp(axis === "x" ? x : y, min, max);
    const span = max - min;
    const height = span === 0
      ? surface.elevation.atMax
      : Math.round(surface.elevation.atMin
        + (surface.elevation.atMax - surface.elevation.atMin) * (coordinate - min) / span);
    elevation = Math.max(elevation, height);
  }
  return { elevation, supportMeshId: null };
}

function clampToWorld(world, entity, point) {
  const bounds = world.gameplay.bounds;
  const radius = Math.max(0, Math.trunc(entity.radius || 0));
  return {
    x: clamp(Math.round(point.x), bounds.minX + radius, bounds.maxX - radius),
    y: clamp(Math.round(point.y), bounds.minY + radius, bounds.maxY - radius),
  };
}

function insideObstacle(entity, point, obstacle) {
  const radius = obstacle.footprint.radius + Math.max(0, Math.trunc(entity.radius || 0));
  const dx = point.x - obstacle.footprint.x;
  const dy = point.y - obstacle.footprint.y;
  return dx * dx + dy * dy < radius * radius;
}

function pushOutsideObstacle(world, entity, point, obstacle) {
  let placed = clampToWorld(world, entity, point);
  if (!insideObstacle(entity, placed, obstacle)) return placed;
  const radius = obstacle.footprint.radius + Math.max(0, Math.trunc(entity.radius || 0));
  const dx = placed.x - obstacle.footprint.x;
  const dy = placed.y - obstacle.footprint.y;
  const distance = Math.hypot(dx, dy);
  const nx = distance === 0 ? 1 : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;
  placed = clampToWorld(world, entity, {
    x: obstacle.footprint.x + nx * radius,
    y: obstacle.footprint.y + ny * radius,
  });
  for (let nudge = 0; nudge < 4 && insideObstacle(entity, placed, obstacle); nudge += 1) {
    placed = clampToWorld(world, entity, { x: placed.x + Math.sign(nx || 1), y: placed.y + Math.sign(ny) });
  }
  return placed;
}

function resolveTerrainPlacement(run, entity, point) {
  const world = worldForRun(run);
  let placed = clampToWorld(world, entity, point);
  for (let pass = 0; pass < 4; pass += 1) {
    let displaced = false;
    for (const obstacle of world.gameplay.obstacles) {
      if (!insideObstacle(entity, placed, obstacle)) continue;
      placed = pushOutsideObstacle(world, entity, placed, obstacle);
      displaced = true;
    }
    if (!displaced) break;
  }
  const support = terrainSupportAt(world, placed.x, placed.y);
  return {
    x: placed.x,
    y: placed.y,
    elevation: support.elevation,
    supportMeshId: support.supportMeshId,
  };
}

function placeOnTerrain(run, entity, point) {
  const placed = resolveTerrainPlacement(run, entity, point);
  entity.x = placed.x;
  entity.y = placed.y;
  entity.elevation = placed.elevation;
  if (placed.supportMeshId) entity.supportMeshId = placed.supportMeshId;
  else delete entity.supportMeshId;
}

function firstObstacleHit(world, entity, from, to) {
  const movementX = to.x - from.x;
  const movementY = to.y - from.y;
  const movementSquared = movementX * movementX + movementY * movementY;
  if (movementSquared === 0) return null;

  let first = null;
  for (const obstacle of world.gameplay.obstacles) {
    const radius = obstacle.footprint.radius + Math.max(0, Math.trunc(entity.radius || 0));
    const offsetX = from.x - obstacle.footprint.x;
    const offsetY = from.y - obstacle.footprint.y;
    const outsideSquared = offsetX * offsetX + offsetY * offsetY - radius * radius;
    if (outsideSquared < 0) continue;
    const projected = 2 * (offsetX * movementX + offsetY * movementY);
    const discriminant = projected * projected - 4 * movementSquared * outsideSquared;
    if (discriminant <= 0) continue;
    const at = (-projected - Math.sqrt(discriminant)) / (2 * movementSquared);
    if (at < 0 || at > 1) continue;
    if (!first || at < first.at || (at === first.at && obstacle.id.localeCompare(first.obstacle.id) < 0)) {
      first = { at, obstacle };
    }
  }
  return first;
}

/** Facing is stored as a fixed-point unit vector (x1000) so snapshots stay integer-deterministic. */
const FACING_SCALE = 1000;
function setFacing(entity, dx, dy) {
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  entity.facingX = Math.round(dx / length * FACING_SCALE);
  entity.facingY = Math.round(dy / length * FACING_SCALE);
}
function facingOf(entity) {
  const x = entity.facingX || 0;
  const y = entity.facingY || 0;
  const length = Math.hypot(x, y);
  if (length === 0) return null;
  return { x: x / length, y: y / length };
}

/**
 * A body may only walk onto ground it can step up to. Anything steeper than COLLISION.stepHeight is
 * a wall, not a ramp, so the mover keeps its origin (or an axis-aligned slide) instead of teleporting
 * up a cliff face — the z/height dimension gates movement exactly like the obstacle footprints do.
 */
function climbableFrom(world, entity, fromElevation, point) {
  return terrainSupportAt(world, point.x, point.y).elevation - fromElevation <= COLLISION.stepHeight;
}

function moveOnTerrain(run, entity, point) {
  const world = worldForRun(run);
  const origin = { x: entity.x, y: entity.y };
  const originElevation = entity.elevation || 0;
  setFacing(entity, point.x - origin.x, point.y - origin.y);
  const movementBudget = Math.hypot(point.x - origin.x, point.y - origin.y);
  let from = origin;
  let target = clampToWorld(world, entity, point);
  /* Best position found so far. When an entity rests exactly on an obstacle contact circle the
   * per-iteration backoff can clamp `safe` back to `from`, so keeping only `from` as the fallback
   * would freeze that entity forever (it never leaves the grazing contact). Tracking the last
   * tangential slide candidate — which is always bounded by this tick's movement budget and is
   * pushed outside every obstacle by placeOnTerrain() — keeps deterministic sliding progress. */
  let resolved = origin;

  for (let collision = 0; collision < 3; collision += 1) {
    const hit = firstObstacleHit(world, entity, from, target);
    if (!hit) {
      resolved = target;
      break;
    }

    const movementX = target.x - from.x;
    const movementY = target.y - from.y;
    const backoff = 1 / Math.max(Math.abs(movementX), Math.abs(movementY), 1);
    const safeAt = Math.max(0, hit.at - backoff);
    const safe = clampToWorld(world, entity, {
      x: from.x + movementX * safeAt,
      y: from.y + movementY * safeAt,
    });
    const contactX = from.x + movementX * hit.at;
    const contactY = from.y + movementY * hit.at;
    const normalX = contactX - hit.obstacle.footprint.x;
    const normalY = contactY - hit.obstacle.footprint.y;
    const normalLength = Math.hypot(normalX, normalY) || 1;
    const nx = normalX / normalLength;
    const ny = normalY / normalLength;
    const remainingX = target.x - safe.x;
    const remainingY = target.y - safe.y;
    const inward = remainingX * nx + remainingY * ny;
    from = safe;
    resolved = safe;
    if (inward >= 0) break;

    const tangentX = -ny;
    const tangentY = nx;
    const tangential = remainingX * tangentX + remainingY * tangentY;
    if (Math.abs(tangential) < 1) {
      const travelled = Math.hypot(safe.x - origin.x, safe.y - origin.y);
      const detourDistance = Math.max(0, movementBudget - travelled);
      const counterClockwise = clampToWorld(world, entity, {
        x: safe.x + tangentX * detourDistance,
        y: safe.y + tangentY * detourDistance,
      });
      const clockwise = clampToWorld(world, entity, {
        x: safe.x - tangentX * detourDistance,
        y: safe.y - tangentY * detourDistance,
      });
      const counterClockwiseProgress = distanceSquared(counterClockwise, safe);
      const clockwiseProgress = distanceSquared(clockwise, safe);
      target = clockwiseProgress > counterClockwiseProgress ? clockwise : counterClockwise;
    } else {
      target = {
        x: safe.x + tangentX * tangential,
        y: safe.y + tangentY * tangential,
      };
    }
    target = pushOutsideObstacle(world, entity, target, hit.obstacle);
    resolved = target;
  }

  const rounded = { x: Math.round(resolved.x), y: Math.round(resolved.y) };
  if (!climbableFrom(world, entity, originElevation, rounded)) {
    const slideX = clampToWorld(world, entity, { x: rounded.x, y: origin.y });
    const slideY = clampToWorld(world, entity, { x: origin.x, y: rounded.y });
    if (climbableFrom(world, entity, originElevation, slideX)) resolved = slideX;
    else if (climbableFrom(world, entity, originElevation, slideY)) resolved = slideY;
    else resolved = origin;
  }

  placeOnTerrain(run, entity, resolved);
}

/** Circular body footprint used by body-vs-body separation. */
const bodyRadius = (entity) => Math.max(0, Math.trunc(entity.radius || 0));

/**
 * Bodies must never occupy the same footprint (the visible "objects glued through each other"
 * glitch). After every mover has been integrated for the tick, overlapping pairs are pushed apart
 * along their centre axis, then re-placed through the terrain resolver so the separation can never
 * shove a body inside an obstacle or outside the arena. Bodies standing on different decks
 * (elevation gap beyond COLLISION.separationElevationTolerance) do not collide.
 */
function separateBodies(run) {
  const movable = sortedActors([
    run.commander,
    ...run.companions.filter((companion) => companion.status !== "DOWNED"),
    ...run.enemies.filter((enemy) => enemy.hp > 0),
  ].filter(Boolean));
  if (movable.length === 0) return;
  const anchors = run.gate ? [run.gate] : [];
  const isPlayerSide = (entity) => entity.id === "commander" || entity.kind === "companion";

  for (let pass = 0; pass < COLLISION.separationPasses; pass += 1) {
    let displaced = false;
    for (let index = 0; index < movable.length; index += 1) {
      const body = movable[index];
      /* The gate is a hostile collision anchor, not a party formation blocker: authored companion
       * anchors intentionally sit inside its display footprint, and must remain reachable. */
      if (!isPlayerSide(body)) {
        for (const anchor of anchors) {
          if (resolveOverlap(run, body, anchor, true)) displaced = true;
        }
      }
      for (let other = index + 1; other < movable.length; other += 1) {
        const candidate = movable[other];
        /* Formation slots are authored party-relative positions, including deliberately overlapping
         * commander/companion silhouettes; only physical enemy contacts are separated. */
        if (isPlayerSide(body) && isPlayerSide(candidate)) continue;
        if (resolveOverlap(run, body, candidate, false)) displaced = true;
      }
    }
    if (!displaced) break;
  }


  /* Separation can be the last position writer in a tick. Re-place every mover so each uses its
   * own radius for world bounds and refreshes support mesh/elevation after any displacement. */
  movable.forEach((entity) => placeOnTerrain(run, entity, entity));
}

/** Pushes one overlapping pair apart; returns true when a push happened. `anchorFixed` pins `other`. */
function resolveOverlap(run, body, other, anchorFixed) {
  const minimum = bodyRadius(body) + bodyRadius(other);
  if (minimum <= 0) return false;
  if (Math.abs((body.elevation || 0) - (other.elevation || 0)) > COLLISION.separationElevationTolerance) return false;
  const dx = body.x - other.x;
  const dy = body.y - other.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= minimum) return false;
  const overlap = minimum - distance;
  /* Perfectly coincident bodies have no separation axis; break the tie deterministically by id so
   * replays stay identical instead of depending on floating-point noise. */
  const nx = distance === 0 ? (body.id.localeCompare(other.id) <= 0 ? 1 : -1) : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;
  /* One extra unit past contact absorbs the integer rounding in placeOnTerrain, so a pushed pair
   * lands strictly outside each other instead of oscillating on the contact circle. */
  const push = overlap + 1;
  const bodyShare = anchorFixed ? push : push / 2;
  const otherShare = anchorFixed ? 0 : push / 2;
  placeOnTerrain(run, body, { x: body.x + nx * bodyShare, y: body.y + ny * bodyShare });
  if (otherShare > 0) placeOnTerrain(run, other, { x: other.x - nx * otherShare, y: other.y - ny * otherShare });
  return true;
}


const SNAPSHOT_VERSION = 7;
const EVENT_VERSION = 4;
const emit = (run, type, payload = {}) => {
  const enrichedPayload = { ...payload };
  const stageId = run.stage?.id;
  const story = stageStoryFor(stageId);
  if (story) {
    const eventShape = { type, ...payload };
    const storyBeat = storyBeatForEvent(stageId, eventShape);
    const questObjective = questObjectiveForEvent(stageId, eventShape);
    if (storyBeat) enrichedPayload.storyBeat = clone(storyBeat);
    if (type === "STAGE_STARTED" || storyBeat || questObjective) {
      const objectiveIndex = questObjective ? story.quest.objectives.indexOf(questObjective) : -1;
      enrichedPayload.quest = {
        questId: story.quest.id,
        questGiverNpcId: story.quest.giverNpcId,
        ...(type === "STAGE_STARTED" ? {
          status: "ACQUIRED",
          acquisitionDialogue: clone(Array.isArray(story.quest.acquisitionDialogue) ? story.quest.acquisitionDialogue : []),
          objectiveId: story.quest.objectives[0]?.id ?? null,
          objectiveIndex: 0,
        } : questObjective ? {
          status: objectiveIndex === story.quest.objectives.length - 1 ? "COMPLETED" : "ADVANCED",
          objectiveId: questObjective.id,
          objectiveIndex,
        } : {
          status: "ACTIVE",
          objectiveId: null,
          objectiveIndex: null,
        }),
        objectiveTotal: story.quest.objectives.length,
      };
    }
  }
  const eventSequence = ++run.eventSequence;
  const identity = run.planCommitment?.identity || `uncommitted:${run.seed ?? 0}`;
  const event = {
    version: EVENT_VERSION,
    tick: run.tick,
    type,
    ...enrichedPayload,
    eventSequence,
    eventId: `${identity}:event:${eventSequence}`,
  };
  run.events.push(event);
  return event;
};
// Anti-stall pressure grace. The gate-defense phase is now an AUTHORED long hold
// (STAGE_WAVE_DOCTRINE defenseTicks, 140-230 s), so its grace is the authored hold plus the
// standard 60 s slack — otherwise the 100-damage pulse would grind the 1000-integrity gate down
// during normal, non-stalled play. Every later phase keeps the original flat 60 s grace.
const OBJECTIVE_PRESSURE_GRACE_TICKS = 3600;
const OBJECTIVE_PRESSURE_INTERVAL_TICKS = 600;
const OBJECTIVE_PRESSURE_DAMAGE = 100;
const OBJECTIVE_PRESSURE_DEADLINE_OFFSET = 9000;
const BOSS_PRESSURE_GRACE_TICKS = 1800;
/**
 * Boss entrance: 180 ticks = 3.0 s at 60 Hz. Authored here, carried on BOSS_SPAWNED, and read by
 * both the camera push and the subtitle band, so presentation cannot drift from the simulation.
 */
const BOSS_INTRO_TICKS = 180;
/** Camera pull-in during the entrance, in basis points of the live tier distance. */
const BOSS_INTRO_ZOOM_BP = 6200;
const ECHO_RECOVERY_PRESSURE_GRACE_TICKS = 150;
const GATE_PRESSURE_RELEASE_LEAD = freeze({
  "player-pursuit": 360,
  "resource-denial": 240,
  "low-hp-focus": 240,
  flank: 120,
});

const ENEMY_POLICIES = Catalog.ENEMY_POLICIES || freeze({
  "gate-pressure": { id: "gate-pressure", name: "Gate Pressure" },
  "player-pursuit": { id: "player-pursuit", name: "Player Pursuit" },
  "flank": { id: "flank", name: "Flank" },
  "resource-denial": { id: "resource-denial", name: "Resource Denial" },
  "elite-escort": { id: "elite-escort", name: "Elite Escort" },
  "low-hp-focus": { id: "low-hp-focus", name: "Low HP Focus" },
});


function stagePlanFor(stage) {
  const descriptor = Catalog.STAGE_PLAN_DESCRIPTORS?.[stage.id];
  if (!descriptor) throw new RangeError(`Missing immutable plan descriptor for defense stage: ${stage.id}`);
  return descriptor;
}

function buildWaveSchedule(stage, seed, tactics, wavePlan, depthPackage = null) {
  let rng = seed;
  const variation = tactics.seededVariation || { timingJitterTicks: 30, densityDelta: 1, laneJitter: 400 };
  const directions = tactics.spawnDirections?.length ? tactics.spawnDirections : ["W", "NW", "SW"];
  const policyChoices = {
    rusher: ["gate-pressure", "player-pursuit", "low-hp-focus"],
    flanker: ["flank", "low-hp-focus"],
    guardian: ["elite-escort", "gate-pressure"],
    ranged: ["resource-denial", "player-pursuit"],
  };
  const authoredPlan = wavePlan.authoredAlternatives ? wavePlan.waves : null;
  const waveSources = wavePlan.waves;
  const schedule = waveSources.map((source, waveIndex) => {
    const alternatives = source.alternatives?.length ? source.alternatives : [{
      id: `${stage.id}-wave-${waveIndex}-primary`,
      composition: [source.primary],
    }];
    let selected;
    let timingJitter;
    if (authoredPlan) {
      rng = rngNext(rng);
      selected = alternatives[Math.floor(rng / 0x100000) % alternatives.length];
      timingJitter = 0;
    } else if (alternatives.length > 1) {
      // Non-authored stages with declared composition variants (STAGE_WAVE_VARIANTS): seed-select
      // the enemy mix AND keep timing/density jitter. This is a superset of cinder-span's authored
      // path (which trades jitter away for composition variety); here replays vary both what spawns
      // and when. The extra RNG draw is taken ONLY when variants exist, so single-composition stages
      // keep their exact draw order — their digests stay byte-identical.
      rng = rngNext(rng);
      selected = alternatives[rng % alternatives.length];
      rng = rngNext(rng);
      timingJitter = (rng % (2 * variation.timingJitterTicks + 1)) - variation.timingJitterTicks;
    } else {
      rng = rngNext(rng);
      selected = alternatives[0];
      timingJitter = (rng % (2 * variation.timingJitterTicks + 1)) - variation.timingJitterTicks;
    }
    const composition = selected.composition.map(({ enemy, count }) => ({ enemy, count }));
    const primary = composition[0];
    rng = rngNext(rng);
    const densityDelta = authoredPlan ? 0 : (rng % (2 * variation.densityDelta + 1)) - variation.densityDelta;
    rng = rngNext(rng);
    // Every authored wave carries its encounter path. Direction and policy are still recorded for
    // presentation/AI intent, but neither may be used to invent navigation from scene decoration.
    const rolledDirection = directions[rng % directions.length];
    const direction = source.direction || rolledDirection;
    rng = rngNext(rng);
    const laneOffset = (rng % (2 * variation.laneJitter + 1)) - variation.laneJitter;
    rng = rngNext(rng);
    const policies = policyChoices[primary.enemy] || [ENEMIES[primary.enemy]?.policyId || "gate-pressure"];
    // Abyss Depth: a depth PACKAGE pins the normal-wave policy per index so enemy BEHAVIOR (not just
    // HP) changes by depth; depthPackage is null at depth 0 -> unchanged (identity). rng is only READ
    // here, never advanced, so pinning does not shift the downstream stream.
    const policyId = source.policyId || (depthPackage ? depthPackage.policyMix[waveIndex % depthPackage.policyMix.length] : policies[rng % policies.length]);
    const adjustedComposition = composition.map((entry, index) => ({
      enemy: entry.enemy,
      count: Math.max(1, entry.count + (index === 0 ? densityDelta : 0)),
    }));
    return {
      waveIndex,
      slot: source.slot ?? waveIndex,
      objectiveId: source.objectiveId || "gate-defense",
      routeId: source.routeId || null,
      alternativeId: selected.id,
      pattern: stage.wavePattern?.[waveIndex] || primary.enemy,
      kind: source.kind || "normal",
      label: source.label || null,
      baseAt: source.tick,
      at: Math.max(0, source.tick + timingJitter),
      type: primary.enemy,
      baseCount: primary.count,
      count: adjustedComposition.reduce((total, entry) => total + entry.count, 0),
      composition: adjustedComposition,
      selectionId: selected.id,
      direction,
      laneOffset,
      policyId,
      midboss: source.midboss ? { ...source.midboss } : null,
    };
  });
  schedule.sort((a, b) => a.at - b.at || a.waveIndex - b.waveIndex);
  const variantId = schedule.map(({ at, kind, composition, direction, laneOffset, policyId, selectionId, routeId }) =>
    `${at}:${kind}:${selectionId}:${composition.map(({ enemy, count }) => `${enemy}x${count}`).join("+")}:${direction}:${laneOffset}:${policyId}:${routeId || "legacy-route"}`).join("|");
  return { schedule, nextRng: rng, variantId };
}

function spawnPoint(direction, laneOffset) {
  if (direction === "NW") return { x: 1000, y: clamp(1000 + Math.abs(laneOffset), 500, 4000) };
  if (direction === "SW") return { x: 1000, y: clamp(ARENA.height - 1000 - Math.abs(laneOffset), 8000, ARENA.height - 500) };
  if (direction === "N") return { x: clamp(6000 + laneOffset, 2000, 18000), y: 500 };
  if (direction === "S") return { x: clamp(6000 + laneOffset, 2000, 18000), y: ARENA.height - 500 };
  return { x: 500, y: clamp(ARENA.gateY + laneOffset, 1000, ARENA.height - 1000) };
}

/** Legacy saves may retain policy-derived lanes. New authored waves must resolve one immutable path. */
function legacyLaneRoute(tactics, policyId, laneOffset) {
  if (policyId === "flank" && tactics.flank) {
    return [{ id: tactics.flank.id, x: tactics.flank.entryX, y: tactics.flank.entryY, zone: "flank" }];
  }
  if (policyId === "gate-pressure" && tactics.chokepath) {
    const halfLane = Math.max(0, Math.trunc(tactics.chokepath.halfWidth / 2));
    return [{
      id: tactics.chokepath.id,
      x: tactics.chokepath.x,
      y: clamp(ARENA.gateY + clamp(laneOffset, -halfLane, halfLane), 0, ARENA.height),
      zone: "chokepath",
    }];
  }
  return [];
}

function encounterPathFor(run, routeId) {
  if (!routeId) return null;
  return encounterRouteFor(run)?.paths?.find((path) => path.id === routeId) || null;
}

function spawnRoute(run, routeId, policyId, laneOffset) {
  if (!routeId) return legacyLaneRoute(run.tactics, policyId, laneOffset);
  const path = encounterPathFor(run, routeId);
  if (!path) throw new RangeError(`Unknown authored encounter path: ${routeId}`);
  return path.waypoints.map((waypoint) => ({ ...waypoint }));
}

/** Resolves `run.formationStance` (falling back to VANGUARD for any unset/unrecognized value — same
 * default `processInput`'s STANCE_CYCLE branch initializes to) to its STANCE_CONFIG entry. */
function activeStanceConfig(run) {
  return STANCE_CONFIG[FORMATION_STANCES.includes(run.formationStance) ? run.formationStance : "VANGUARD"];
}
/** FRONT/BACK is now derived from stance position-rank (loadout-order index into `run.companions`)
 * against the active stance's `derivedFrontCount` (UNIFIED-GDD.md:79-85), not a stored per-companion
 * slot map — `core-loop-redesign-20260725.md` §2 before/after table, row "FRONT 상한". Companions
 * beyond the 3 stance-offset slots (elite-extracted 4th+) clamp to the last offset index, which is
 * always >= every stance's derivedFrontCount (max 2), so they are always BACK. */
function stanceSlotForIndex(run, index) {
  return index < activeStanceConfig(run).derivedFrontCount ? "FRONT" : "BACK";
}
/** Formation targeting (UNIFIED-GDD.md §4.2/§4.3): FRONT companions still ACTIVE (not DOWNED) with formationIntegrity remaining. */
function livingFrontCompanions(run) {
  return run.companions.filter((entry, index) => stanceSlotForIndex(run, index) === "FRONT" && entry.status === "ACTIVE" && entry.hp > 0);
}
function nearestActor(origin, candidates) {
  return candidates.slice().sort((a, b) => {
    const delta = distanceSquared(origin, a) - distanceSquared(origin, b);
    return delta || a.id.localeCompare(b.id);
  })[0];
}
/**
 * Enemies that would otherwise pick the commander now pick from {commander, living FRONT companions}.
 * Companions are offset from the commander every tick per the active formation stance
 * (STANCE_CONFIG, applied in tick()'s companion position-sync), so distance is no longer always tied
 * the way it was under the old raw-snap model — ties (and near-ties) still resolve in favor of the
 * nearest FRONT companion (vanguard-screen intent: front row is engaged before the commander) rather
 * than `nearestActor`'s generic id-lexical tiebreak, which would otherwise always pick "commander"
 * over "companion-N" and leave FRONT targeting permanently inert.
 */
function playerSideTarget(run, enemy) {
  const fronts = livingFrontCompanions(run);
  if (!fronts.length) return run.commander;
  const nearestFront = nearestActor(enemy, fronts);
  if (distanceSquared(enemy, nearestFront) <= distanceSquared(enemy, run.commander)) return nearestFront;
  return run.commander;
}
/** Resolves a loadout into deterministic stance position-rank order, capped at 3.
 * Saved FRONT intent ranks first, unassigned companions retain the deterministic companionId
 * fallback, and saved BACK intent ranks last. The active stance still owns the live FRONT/BACK
 * count through stanceSlotForIndex(); this map only chooses which companion occupies each rank. */
function resolveFormation(companionLoadout, formation = {}) {
  return orderCompanionsByFormationIntent(validLoadout(companionLoadout), formation);
}

/**
 * `options.equipment`: {weapon,ward,trinket}
 * 0-based tier indices (default all T1/index 0). Role passives (damageBonus/eliteDamageBonus/
 * selfIntegrityMultiplier) only apply when `run.rpgActive` is true — an untouched campaign
 * (no Warden stat/skill/trait investment, no equipment purchased) produces byte-identical
 * companion damage/range/targeting-inertness to the pre-RPG baseline; role identity is real
 * but its numeric effect only activates once the player has entered the RPG layer at all
 * (UNIFIED-GDD.md §3.3 frames role passive as fixed-per-companion, but shipping it unconditionally
 * would silently rebalance every existing campaign with zero player action — see decision-log).
 * Damage/range order of operations (balance-sheet.md enforcement_scope): catalog base + additive
 * role/stat bonus, then x equipment tier (still derive-fn step_1), then x companions-wardpact
 * trait multiplier (also step_1, Warden-sourced). Fire-time stance synergy (step_2) is applied
 * per-tick in the fire loop, not baked in here.
 */
function addCompanion(run, companionId, { equipment = {} } = {}) {
  if (run.measurementProfile) return;
  const data = COMPANIONS[companionId];
  if (!data || run.companions.some((entry) => entry.companionId === companionId)) return;
  const runtime = deriveCompanionRuntimeStats(companionId, { equipment });
  const rpgActive = Boolean(run.rpgActive);
  const wardenRuntime = run.wardenState?.runtime;
  const wardpactDamageMultiplier = rpgActive ? (wardenRuntime?.companionDamageMultiplier ?? 1) : 1;
  const wardpactRangeMultiplier = rpgActive ? (wardenRuntime?.companionRangeMultiplier ?? 1) : 1;
  const roleDamageBonus = rpgActive ? runtime.damageBonus : 0;
  const selfIntegrityMultiplier = rpgActive ? runtime.selfIntegrityMultiplier : 1;
  const baseDamage = data.damage + (run.rewardIds.includes("abyssal-banner") ? REWARDS["abyssal-banner"].damageBonus : 0);
  const damage = Math.round(baseDamage * (1 + roleDamageBonus) * runtime.weaponTierMultiplier * wardpactDamageMultiplier);
  const range = Math.round(data.range * runtime.trinketTierMultiplier * wardpactRangeMultiplier);
  const maxFormationIntegrity = Math.round(companionFormationIntegrity(data.damage, runtime.wardTierIndex) * selfIntegrityMultiplier);
  const index = run.companions.length;
  const offset = activeStanceConfig(run).offsets[Math.min(index, activeStanceConfig(run).offsets.length - 1)];
  const companion = actor(nextId(run, "companion"), "companion", run.commander.x + offset.x, run.commander.y + offset.y, maxFormationIntegrity, maxFormationIntegrity, {
    companionId, cooldown: 0, damage, fireTicks: data.fireTicks, range, radius: 300,
    slot: stanceSlotForIndex(run, index), status: "ACTIVE", role: runtime.role, eliteDamageBonus: rpgActive ? runtime.eliteDamageBonus : 0,
    aiState: "FOLLOW", aiTargetId: null, combatTargetId: null, element: elementOf(data.element),
  });
  placeOnTerrain(run, companion, companion);
  run.companions.push(companion);
}

function applyOwnedRewards(run, rewardIds) {
  if (run.measurementProfile) return;
  const owned = [...new Set((Array.isArray(rewardIds) ? rewardIds : []).filter((id) => REWARDS[id]))].sort();
  owned.forEach((rewardId) => {
    const reward = REWARDS[rewardId];
    if (reward.companionId) addCompanion(run, reward.companionId);
    if (reward.cooldownReduction) run.commander.cooldownScale = clamp(run.commander.cooldownScale - reward.cooldownReduction, 0.4, 1);
    if (reward.gateDamageReduction) run.gateDamageReduction += reward.gateDamageReduction;
    if (reward.integrity) {
      run.gate.maxIntegrity += reward.integrity;
      run.gate.integrity += reward.integrity;
    }
    if (reward.pickupRange) run.commander.pickupRange += reward.pickupRange;
    if (reward.critChanceBonusBp) run.commander.critProfile.chanceBp = clamp(run.commander.critProfile.chanceBp + reward.critChanceBonusBp, 0, 10000);
  });
  run.rewardIds = owned;
  if (owned.includes("abyssal-banner")) run.companions.forEach((companion) => { companion.damage += REWARDS["abyssal-banner"].damageBonus; });
}

function spawnEnemy(run, type, elite = false, spawnOpt = {}) {
  const data = ENEMIES[type];
  if (!data) throw new RangeError(`Unknown authored enemy type: ${type}`);
  const effScale = run.stage.scale + (run.abyssDepth || 0) * ABYSS_DEPTH_SCALE_STEP;
  const hp = scaled(data.hp, effScale);
  // XP reward tracks enemy toughness: late stages scale enemy HP (line above) by
  // run.stage.scale, so a flat XP grant would stretch the in-run level-up cadence
  // the further a player progresses (2.4x the HP for the same XP at gate-zenith).
  // Scaling XP by the same stage factor keeps the level-up rhythm constant across
  // stages. scale 100 (cinder-span) is an identity, so Stage 1 digests are unchanged.
  const xpReward = scaled(data.xp, effScale);
  const fallbackPolicy = elite ? "low-hp-focus" : (
    type === "flanker" ? "flank" :
    type === "guardian" ? "elite-escort" :
    type === "ranged" ? "resource-denial" : "gate-pressure"
  );
  const policyId = spawnOpt.policyId || data.policyId || fallbackPolicy;
  const policy = ENEMY_POLICIES[policyId] || ENEMY_POLICIES["gate-pressure"];
  const direction = spawnOpt.direction || "W";
  const laneOffset = spawnOpt.laneOffset || 0;
  const routeId = spawnOpt.routeId || null;
  const point = elite ? { x: 14000, y: ARENA.gateY } : spawnPoint(direction, laneOffset);
  // Mid-boss (미들 웨이브 리더): an ordinary, NON-elite enemy carrying MIDBOSS_PROFILE multipliers.
  // Keeping it non-elite is deliberate — elite spawns drive the extraction/capture flow, while a
  // mid-boss only has to be a mid-wave damage sponge that the gate-defense clear check must wait on.
  const midboss = spawnOpt.midboss || null;
  const bp = (value, points) => Math.max(1, Math.trunc((value * points) / 10000));
  const baseHp = elite ? hp * 4 : (midboss ? Math.max(1, Math.trunc(midboss.hp)) : hp);
  const enemy = actor(nextId(run, elite ? "elite" : midboss ? "midboss" : "enemy"), type, point.x, point.y, baseHp, baseHp, {
    class: elite ? "elite" : type,
    speed: elite ? Math.trunc(data.speed * 0.8) : (midboss ? bp(data.speed, midboss.speedBp) : data.speed),
    damage: midboss ? bp(data.damage, midboss.damageBp) : data.damage,
    xp: elite ? xpReward * 4 : (midboss ? bp(xpReward, midboss.xpBp) : xpReward),
    elite,
    midboss: Boolean(midboss),
    midbossId: midboss?.id ?? null,
    radius: midboss ? bp(data.radius, midboss.radiusBp) : data.radius,
    stageEliteId: elite ? run.stage.eliteId : null,
    rangedCooldown: 0,
    projectileTicks: data.projectileTicks ?? 120,
    projectileRange: data.projectileRange ?? 0,
    attackCooldown: 0,
    attackTicks: data.attackTicks ?? (type === "guardian" ? 90 : type === "ranged" ? 120 : 60),
    policyId,
    policyIntent: policy?.intent || null,
    policyTarget: policy?.target || null,
    spawnDirection: direction,
    // Area-combat identity: the element decides every matchup this body takes part in, and the
    // pattern preset decides the shape and timing of its strikes.
    element: elementOf(data.element),
    patternId: data.patternId ?? null,
    routeId,
    route: spawnRoute(run, routeId, policyId, laneOffset),
    waypointIndex: 0,
    encounterObjectiveId: spawnOpt.objectiveId || null,
    waveIndex: Number.isInteger(spawnOpt.waveIndex) ? spawnOpt.waveIndex : null,
  });
  placeOnTerrain(run, enemy, point);
  run.enemies.push(enemy);
  const spawnEvent = emit(run, "ENEMY_SPAWNED", {
    entityId: enemy.id,
    enemyType: type,
    elite,
    midboss: Boolean(midboss),
    midbossId: midboss?.id ?? null,
    spawnDirection: direction,
    routeId: enemy.routeId,
    route: clone(enemy.route),
    objectiveId: enemy.encounterObjectiveId,
    waveIndex: enemy.waveIndex,
  });
  spawnEvent.spawnEventId = spawnEvent.eventId;
  enemy.spawnEventId = spawnEvent.eventId;
  if (midboss) {
    emit(run, "MIDBOSS_SPAWNED", {
      entityId: enemy.id,
      midbossId: midboss.id,
      enemyType: type,
      hp: enemy.hp,
      spawnDirection: direction,
      cue: eventCue("bossSpawned"),
    });
  }
  emit(run, "ENEMY_POLICY_SELECTED", {
    entityId: enemy.id,
    spawnEventId: enemy.spawnEventId,
    policyId,
    intent: enemy.policyIntent,
    target: enemy.policyTarget,
    spawnDirection: direction,
  });
  return enemy;
}

function spawnBoss(run) {
  const data = BOSSES[run.stage.boss];
  const hp = data.hp;
  const policyId = data.policyId || "low-hp-focus";
  const policy = ENEMY_POLICIES[policyId] || ENEMY_POLICIES["low-hp-focus"];
  const routeId = encounterRouteFor(run)?.finale?.bossPathId || null;
  const boss = actor(nextId(run, "boss"), "boss", 11000, ARENA.gateY, hp, hp, {
    class: "boss",
    speed: data.speed,
    damage: data.damage,
    xp: data.xp,
    bossId: data.id,
    radius: data.radius,
    attackCooldown: 0,
    attackWindup: false,
    attackTicks: data.attackTicks ?? 90,
    rangedCooldown: 0,
    projectileTicks: data.projectileTicks ?? 120,
    projectileRange: data.projectileRange ?? 0,
    policyId,
    policyIntent: policy?.intent || null,
    policyTarget: policy?.target || null,
    element: elementOf(data.element),
    patternId: data.patternId ?? null,
    patternStepId: null,
    patternActionId: null,
    spawnDirection: "W",
    routeId,
    route: spawnRoute(run, routeId, policyId, 0),
    waypointIndex: 0,
    encounterObjectiveId: "boss-kill",
  });
  placeOnTerrain(run, boss, boss);
  run.enemies.push(boss);
  run.bossSpawned = true;
  run.bossSpawnedAt = run.tick;
  if (livingFrontCompanions(run).length) {
    run.rallyTargetId = boss.id;
    run.companions.forEach((companion) => {
      if (companion.status === "ACTIVE") companion.cooldown = Math.trunc(companion.cooldown * (1 - BOSS_RALLY_COOLDOWN_REDUCTION));
    });
    emit(run, "BOSS_RALLY_WINDOW", { bossId: boss.id, entityId: boss.id, cooldownReductionBp: Math.round(BOSS_RALLY_COOLDOWN_REDUCTION * 10000) });
  }
  const spawnEvent = emit(run, "BOSS_SPAWNED", {
    bossId: data.id,
    entityId: boss.id,
    policyId,
    intent: boss.policyIntent,
    spawnDirection: "W",
    routeId,
    route: clone(boss.route),
    objectiveId: "boss-kill",
    element: boss.element,
    patternId: boss.patternId,
    /**
     * Authored 3-second entrance. The simulation owns the timing (`BOSS_INTRO_TICKS`) so the
     * renderer's camera push and the HUD's subtitle band cannot drift apart, and so a replay of
     * the same run frames the boss identically. Presentation-only: no combat value reads it, and
     * the boss is already live at this tick — the entrance never freezes the fight.
     */
    intro: {
      durationTicks: BOSS_INTRO_TICKS,
      endsAtTick: run.tick + BOSS_INTRO_TICKS,
      title: run.stage.bossName || data.id,
      subtitle: stageCutscene(run.stage).bossEntry || null,
      cameraCueId: `camera:boss-intro:${boss.id}`,
      motion: "show",
      zoomBp: BOSS_INTRO_ZOOM_BP,
    },
    cue: eventCue("bossSpawned"),
  });
  spawnEvent.spawnEventId = spawnEvent.eventId;
  boss.spawnEventId = spawnEvent.eventId;
}

function encounterStateFor(route) {
  const first = route?.objectives?.[0] || null;
  return {
    version: 1,
    routeId: route?.id || null,
    status: first ? "ACTIVE" : "COMPLETE",
    objectiveIndex: 0,
    objectiveId: first?.id || null,
    attempt: 1,
    retries: 0,
    recoveryUntil: null,
    pressurePausedAt: null,
    commitmentCap: Math.max(1, route?.commitmentCap || 1),
    maxConcurrentEnemies: Math.max(1, route?.maxConcurrentEnemies || 1),
    committedAttackerIds: [],
    committedAttackerCount: 0,
    rewardKeys: [],
    spawnQueue: [],
    nextSpawnAt: 0,
    startedWaveIndices: [],
    retryWaveIndices: [],
    objectives: Object.fromEntries((route?.objectives || []).map((objective) => [objective.id, {
      id: objective.id,
      kind: objective.kind,
      completed: false,
      completedAt: null,
      contestedAt: null,
      attempts: 1,
      retries: 0,
    }])),
  };
}

function ensureEncounterState(run) {
  if (run.encounter) return run.encounter;
  const route = Catalog.STAGE_ENCOUNTER_ROUTES?.[run.stage.id] || run.stage.encounterRoute;
  run.encounter = encounterStateFor(route);
  return run.encounter;
}

function encounterRouteFor(run) {
  return Catalog.STAGE_ENCOUNTER_ROUTES?.[run.stage.id] || run.stage.encounterRoute || null;
}

function activeEncounterObjective(run) {
  const route = encounterRouteFor(run);
  return route?.objectives?.[run.encounter?.objectiveIndex] || null;
}
function encounterObjectiveHandoff(run, objective, objectiveIndex = null) {
  const route = encounterRouteFor(run);
  const resolvedIndex = Number.isInteger(objectiveIndex)
    ? objectiveIndex
    : route?.objectives?.findIndex(({ id }) => id === objective?.id);
  return {
    stageId: run.stage.id,
    routeId: route?.id || run.encounter?.routeId || null,
    objectiveId: objective?.id || null,
    objectiveKind: objective?.kind || null,
    objectiveIndex: resolvedIndex >= 0 ? resolvedIndex : null,
    cameraCueId: objective?.cameraCueId || null,
    point: objective?.point ? clone(objective.point) : null,
  };
}


function encounterSnapshot(run) {
  const encounter = run.encounter || encounterStateFor(encounterRouteFor(run));
  return {
    version: encounter.version,
    routeId: encounter.routeId,
    status: encounter.status,
    objectiveIndex: encounter.objectiveIndex,
    objectiveId: encounter.objectiveId,
    attempt: encounter.attempt,
    retries: encounter.retries,
    recoveryUntil: encounter.recoveryUntil,
    commitmentCap: encounter.commitmentCap,
    maxConcurrentEnemies: encounter.maxConcurrentEnemies,
    committedAttackerIds: [...encounter.committedAttackerIds],
    committedAttackerCount: encounter.committedAttackerCount,
    rewardKeys: [...encounter.rewardKeys],
    pendingSpawnCount: encounter.spawnQueue.length,
    objectives: clone(encounter.objectives),
  };
}

function grantEncounterRecovery(run, rewardKey, recovery, payload = {}) {
  const encounter = ensureEncounterState(run);
  if (encounter.rewardKeys.includes(rewardKey)) return null;
  encounter.rewardKeys.push(rewardKey);
  const commanderGain = Math.min(
    Math.trunc((run.commander.maxIntegrity * Math.max(0, recovery?.commanderBp || 0)) / 10000),
    run.commander.maxIntegrity - run.commander.integrity,
  );
  const gateGain = Math.min(
    Math.trunc((run.gate.maxIntegrity * Math.max(0, recovery?.gateBp || 0)) / 10000),
    run.gate.maxIntegrity - run.gate.integrity,
  );
  run.commander.integrity += commanderGain;
  run.gate.integrity += gateGain;
  emit(run, "ENCOUNTER_REWARD_GRANTED", {
    rewardKey,
    commanderRecovered: commanderGain,
    gateRecovered: gateGain,
    ...payload,
  });
  return { commanderGain, gateGain };
}

function enqueueEncounterWave(run, wave, retryAttempt = null) {
  const encounter = ensureEncounterState(run);
  const objectiveId = wave.objectiveId || encounter.objectiveId || "gate-defense";
  emit(run, "WAVE_VARIANT_STARTED", {
    waveIndex: wave.waveIndex,
    pattern: wave.pattern,
    slot: wave.slot,
    kind: wave.kind || "normal",
    label: wave.label || null,
    alternativeId: wave.alternativeId,
    count: wave.count,
    composition: clone(wave.composition),
    selectionId: wave.selectionId,
    policyId: wave.policyId,
    spawnDirection: wave.direction,
    midbossId: wave.midboss?.id ?? null,
    variantId: run.waveVariant.id,
    routeId: wave.routeId || null,
    objectiveId,
    retryAttempt,
  });
  if (wave.midboss) {
    // Statement enemies must enter on the authored wave beat. Queuing the
    // mid-boss behind leftovers from the previous wave hides the cue and can
    // delay it by hundreds of ticks under the concurrency cap.
    spawnEnemy(run, wave.midboss.enemy, false, {
      direction: wave.direction,
      laneOffset: wave.laneOffset,
      policyId: wave.midboss.policyId,
      routeId: wave.routeId || null,
      objectiveId,
      waveIndex: wave.waveIndex,
      midboss: wave.midboss,
    });
  }
  const pending = [];
  let spawnIndex = 0;
  wave.composition.forEach(({ enemy, count }) => {
    const policyId = enemy === wave.type ? wave.policyId : (ENEMIES[enemy]?.policyId || wave.policyId);
    for (let index = 0; index < count; index += 1) {
      pending.push({
        waveIndex: wave.waveIndex,
        objectiveId,
        type: enemy,
        spawnOpt: {
          direction: wave.direction,
          laneOffset: wave.laneOffset + spawnIndex * 200,
          policyId,
          routeId: wave.routeId || null,
        },
      });
      spawnIndex += 1;
    }
  });
  encounter.spawnQueue.push(...pending);
  if (!encounter.startedWaveIndices.includes(wave.waveIndex)) {
    encounter.startedWaveIndices.push(wave.waveIndex);
    encounter.startedWaveIndices.sort((left, right) => left - right);
  }
}

function processEncounterSpawns(run) {
  const encounter = ensureEncounterState(run);
  if (encounter.status !== "ACTIVE" || !encounter.spawnQueue.length || run.tick < encounter.nextSpawnAt) return;
  const pending = encounter.spawnQueue[0];
  if (pending.objectiveId !== encounter.objectiveId) return;
  const activeBodies = run.enemies.filter((enemy) => enemy.class !== "boss" && !enemy.elite).length;
  if (activeBodies >= encounter.maxConcurrentEnemies) return;
  encounter.spawnQueue.shift();
  spawnEnemy(run, pending.type, false, {
    ...pending.spawnOpt,
    objectiveId: pending.objectiveId,
    waveIndex: pending.waveIndex,
  });
  encounter.nextSpawnAt = run.tick + Math.max(1, encounterRouteFor(run)?.spawnIntervalTicks || 1);
}

function beginEncounterRecovery(run, reason = "PLAYER_RETRY") {
  const encounter = ensureEncounterState(run);
  const objective = activeEncounterObjective(run);
  if (!objective || encounter.status !== "ACTIVE" || encounter.attempt >= objective.retry.maxAttempts) return false;
  const objectiveId = objective.id;
  const retryWaveIndices = encounter.startedWaveIndices.filter((waveIndex) =>
    run.waveSchedule.find((wave) => wave.waveIndex === waveIndex)?.objectiveId === objectiveId);
  const withdrawn = run.enemies.filter((enemy) => enemy.encounterObjectiveId === objectiveId);
  const withdrawnIds = new Set(withdrawn.map((enemy) => enemy.id));
  run.enemies = run.enemies.filter((enemy) => !withdrawnIds.has(enemy.id));
  encounter.spawnQueue = encounter.spawnQueue.filter((pending) => pending.objectiveId !== objectiveId);
  encounter.retryWaveIndices = retryWaveIndices;
  encounter.status = "RECOVERY";
  encounter.recoveryUntil = run.tick + objective.retry.recoveryTicks;
  encounter.pressurePausedAt = run.tick;
  encounter.committedAttackerIds = [];
  encounter.committedAttackerCount = 0;
  const commanderFloor = Math.trunc((run.commander.maxIntegrity * objective.retry.commanderFloorBp) / 10000);
  const gateFloor = Math.trunc((run.gate.maxIntegrity * objective.retry.gateFloorBp) / 10000);
  run.commander.integrity = Math.max(run.commander.integrity, commanderFloor);
  run.gate.integrity = Math.max(run.gate.integrity, gateFloor);
  emit(run, "ENCOUNTER_OBJECTIVE_FAILED", {
    ...encounterObjectiveHandoff(run, objective),
    attempt: encounter.attempt,
    reason,
    withdrawnEnemyIds: withdrawn.map(({ id }) => id),
  });
  emit(run, "ENCOUNTER_RECOVERY_STARTED", {
    objectiveId,
    attempt: encounter.attempt,
    recoveryUntil: encounter.recoveryUntil,
    recoveryTicks: objective.retry.recoveryTicks,
  });
  return true;
}

function processEncounterRecovery(run) {
  const encounter = ensureEncounterState(run);
  if (encounter.status !== "RECOVERY" || run.tick < encounter.recoveryUntil) return;
  const objective = activeEncounterObjective(run);
  const pausedAt = Number.isInteger(encounter.pressurePausedAt) ? encounter.pressurePausedAt : run.tick;
  const pausedTicks = Math.max(0, run.tick - pausedAt);
  if (run.objectivePressure && pausedTicks > 0) {
    run.objectivePressure.phaseStartedAt += pausedTicks;
    run.objectivePressure.deadlineTick += pausedTicks;
  }
  encounter.status = "ACTIVE";
  encounter.attempt += 1;
  encounter.retries += 1;
  encounter.recoveryUntil = null;
  encounter.pressurePausedAt = null;
  encounter.nextSpawnAt = run.tick;
  const objectiveState = encounter.objectives[objective.id];
  objectiveState.attempts = encounter.attempt;
  objectiveState.retries = encounter.retries;
  emit(run, "ENCOUNTER_RETRY_STARTED", {
    objectiveId: objective.id,
    attempt: encounter.attempt,
    retries: encounter.retries,
  });
  const retryIndices = [...encounter.retryWaveIndices];
  encounter.retryWaveIndices = [];
  retryIndices.forEach((waveIndex) => {
    const wave = run.waveSchedule.find((entry) => entry.waveIndex === waveIndex);
    if (wave) enqueueEncounterWave(run, wave, encounter.attempt);
  });
}

function updateEncounterObjective(run) {
  const encounter = ensureEncounterState(run);
  if (encounter.status !== "ACTIVE") return;
  const route = encounterRouteFor(run);
  const objective = activeEncounterObjective(run);
  if (!route || !objective) return;
  const objectiveWaves = run.waveSchedule.filter((wave) => wave.objectiveId === objective.id);
  const allStarted = objectiveWaves.length > 0
    && objectiveWaves.every((wave) => encounter.startedWaveIndices.includes(wave.waveIndex));
  const pending = encounter.spawnQueue.some((entry) => entry.objectiveId === objective.id);
  const alive = run.enemies.some((enemy) => enemy.encounterObjectiveId === objective.id && enemy.hp > 0);
  if (!allStarted || pending || alive) return;
  const objectiveState = encounter.objectives[objective.id];
  if (!objectiveState || objectiveState.completed) return;
  objectiveState.completed = true;
  objectiveState.completedAt = run.tick;
  grantEncounterRecovery(run, `objective:${objective.id}`, objective.recovery, {
    objectiveId: objective.id,
    rewardType: "objective-recovery",
  });
  emit(run, "ENCOUNTER_OBJECTIVE_COMPLETED", {
    ...encounterObjectiveHandoff(run, objective),
    attempt: encounter.attempt,
    retries: encounter.retries,
  });
  const nextIndex = encounter.objectiveIndex + 1;
  const nextObjective = route.objectives[nextIndex] || null;
  encounter.objectiveIndex = nextIndex;
  encounter.objectiveId = nextObjective?.id || null;
  encounter.attempt = 1;
  encounter.retries = 0;
  encounter.status = nextObjective ? "ACTIVE" : "COMPLETE";
  if (run.objectives.route) {
    run.objectives.route.phase = encounter.objectiveId || "complete";
    run.objectives.route.completed = encounter.status === "COMPLETE";
  }
  if (nextObjective) {
    emit(run, "ENCOUNTER_OBJECTIVE_STARTED", {
      ...encounterObjectiveHandoff(run, nextObjective, nextIndex),
      previousObjectiveId: objective.id,
    });
  }
}

function getEffectiveRange(run, baseRange) {
  let multiplier = 1.0;
  const tactics = run.tactics;
  if (tactics?.elevation && distanceSquared(run.commander, tactics.elevation) <= 2000 * 2000) {
    multiplier *= (tactics.elevation.rangeMultiplier || 1.25);
  }
  if (run.occupationProgress?.captured || (tactics?.occupation && distanceSquared(run.commander, tactics.occupation) <= tactics.occupation.radius * tactics.occupation.radius)) {
    multiplier *= (tactics?.occupation?.effects?.rangeMultiplier || 1.2);
  }
  return Math.trunc(baseRange * multiplier);
}

function getCommanderSpeed(run) {
  let mult = 1.0;
  const tactics = run.tactics;
  if (run.occupationProgress?.captured || (tactics?.occupation && distanceSquared(run.commander, tactics.occupation) <= tactics.occupation.radius * tactics.occupation.radius)) {
    mult *= (tactics?.occupation?.effects?.moveMultiplier || 1.15);
  }
  return Math.trunc(COMMANDER.speed * mult);
}

/**
 * Composes Warden trait/skill conditional damage multipliers for one hit against `target`
 * (basic attack or skill cast). Static stat/equipment contributions are already baked into
 * `run.commander.basicDamage` at run creation — this only layers the fire-time conditionals
 * that need live run state (integrity ratio, target class, kill-stacks, first-attack flag).
 */
function commanderDamageMultiplier(run, target, { skill = false, firstStrikeFactor = null } = {}) {
  const runtime = run.wardenState?.runtime;
  if (!runtime) return 1;
  let mult = runtime.damageMultiplier;
  if (skill) mult *= runtime.skillDamageMultiplier;
  if (runtime.desperateEcho && run.commander.integrity / run.commander.maxIntegrity <= runtime.desperateEcho.thresholdIntegrityFraction) {
    mult *= runtime.desperateEcho.damageMultiplier;
  }
  if (runtime.eliteHunter && target) {
    const isElite = target.elite || target.class === "boss";
    mult *= isElite ? runtime.eliteHunter.eliteDamageMultiplier : runtime.eliteHunter.normalDamageMultiplier;
  }
  if (runtime.chainReaction && run.wardenState.chainReactionStacks > 0) {
    mult *= 1 + runtime.chainReaction.perKillDamageBonus * run.wardenState.chainReactionStacks;
  }
  if (firstStrikeFactor !== null) mult *= firstStrikeFactor;
  else if (runtime.firstStrikeMultiplier && !run.wardenState.firstStrikeConsumed) {
    mult *= runtime.firstStrikeMultiplier;
    run.wardenState.firstStrikeConsumed = true;
  }
  return mult;
}
/** Consumes the once-per-run first-strike flag exactly once per player action (not once per AoE target) and returns the multiplier factor (1 if unavailable/already consumed). */
function consumeFirstStrikeFactor(run) {
  const runtime = run.wardenState?.runtime;
  if (!runtime?.firstStrikeMultiplier || run.wardenState.firstStrikeConsumed) return 1;
  run.wardenState.firstStrikeConsumed = true;
  return runtime.firstStrikeMultiplier;
}
/** echo-backlash/echo-cascade: chance-based extra hit off raw basicDamage (balance-sheet.md: "추가타 basicDamage*0.5"), independently crit-resolved. */
function maybeFireExtraHit(run, target) {
  const extraHit = run.wardenState?.runtime?.extraHit;
  if (!extraHit) return;
  run.combatRng = rngNext(run.combatRng);
  if (run.combatRng % 10000 >= extraHit.extraHitChance * 10000) return;
  const hit = resolveCritical(run, "basic", Math.round(run.commander.basicDamage * extraHit.extraHitDamageMultiplier));
  playerAttack(run, run.commander, hit.damage, "commander", hit, COMMANDER.basicRange);

}
/** wardens-ward (once/run shield-as-heal at <=30% integrity) + echo-warden-awakening (once/run full cooldown reset at <=15% integrity). Called after any commander integrity loss. */
function applyWardenDamageResponse(run) {
  const runtime = run.wardenState?.runtime;
  if (!runtime) return;
  const ratio = run.commander.integrity / run.commander.maxIntegrity;
  if (runtime.wardensWard && !run.wardenState.wardensWardConsumed && ratio <= runtime.wardensWard.thresholdIntegrityFraction) {
    run.wardenState.wardensWardConsumed = true;
    const shield = Math.round(run.commander.maxIntegrity * runtime.wardensWard.shieldFraction);
    run.commander.integrity = clamp(run.commander.integrity + shield, 0, run.commander.maxIntegrity);
    emit(run, "WARDENS_WARD_TRIGGERED", { entityId: run.commander.id, shield, hp: run.commander.integrity });
  }
  if (runtime.awakeningReset && !run.wardenState.awakeningResetConsumed && ratio <= runtime.awakeningReset.thresholdIntegrityFraction) {
    run.wardenState.awakeningResetConsumed = true;
    run.commander.basicCooldown = 0;
    Object.keys(run.commander.cooldowns).forEach((id) => { run.commander.cooldowns[id] = 0; });
    run.companions.forEach((companion) => { companion.cooldown = 0; });
    emit(run, "ECHO_WARDEN_AWAKENING_TRIGGERED", { entityId: run.commander.id });
  }
}
/** wardens-vigil: 0.5%-of-max-integrity/sec regen below 50% integrity. Milli-integrity accumulator (same fractional-carry pattern as `terrainRecovery`) avoids truncating to 0 every tick at 60Hz. */
function applyWardenVigilRegen(run) {
  const vigil = run.wardenState?.runtime?.wardensVigil;
  if (!vigil) return;
  if (run.commander.integrity / run.commander.maxIntegrity > vigil.thresholdIntegrityFraction) return;
  if (run.commander.integrity <= 0) return;
  run.wardenState.vigilRegenRemainderMilli += run.commander.maxIntegrity * vigil.regenPerSecondFraction * 1000 / TICK_RATE;
  const wholeRegen = Math.trunc(run.wardenState.vigilRegenRemainderMilli / 1000);
  if (wholeRegen > 0) {
    run.wardenState.vigilRegenRemainderMilli -= wholeRegen * 1000;
    run.commander.integrity = clamp(run.commander.integrity + wholeRegen, 0, run.commander.maxIntegrity);
  }
}

function orderedTargets(run, origin, range) {
  const maxDistance = getEffectiveRange(run, range) ** 2;
  return run.enemies.filter((entry) => entry.hp > 0 && distanceSquared(entry, origin) <= maxDistance).sort((a, b) => {
    const priority = (TARGET_PRIORITY[a.class] ?? 99) - (TARGET_PRIORITY[b.class] ?? 99);
    if (priority) return priority;
    const distance = distanceSquared(a, origin) - distanceSquared(b, origin);
    if (distance) return distance;
    if (a.hp !== b.hp) return a.hp - b.hp;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Formation anchor for one companion, with the live AI response applied.
 *
 * `evade` pushes the anchor radially out of the telegraph that covered this body until it clears
 * the disc; `spread` fans the anchor sideways so two companions caught by one disc do not both
 * stand in the same place. Both are windowed (AI_RESPONSE_PATTERNS) and decay on their own, so
 * the formation returns to its authored offsets by itself.
 */
function companionFormationAnchor(run, companion, index) {
  const stance = activeStanceConfig(run);
  const offset = stance.offsets[Math.min(index, stance.offsets.length - 1)];
  let anchorX = run.commander.x + offset.x;
  let anchorY = run.commander.y + offset.y;
  if (companion.evadeUntilTick && run.tick <= companion.evadeUntilTick) {
    const dx = anchorX - companion.evadeFromX;
    const dy = anchorY - companion.evadeFromY;
    const distance = Math.hypot(dx, dy);
    const clearance = Math.max(1, Math.trunc(companion.evadeClearance || 0));
    if (distance > 0 && distance < clearance) {
      anchorX = Math.round(companion.evadeFromX + dx / distance * clearance);
      anchorY = Math.round(companion.evadeFromY + dy / distance * clearance);
    } else if (distance === 0) {
      anchorX += clearance;
    }
  }
  if (companion.spreadUntilTick && run.tick <= companion.spreadUntilTick) {
    const scatter = Math.trunc(AI_RESPONSE_PATTERNS.spread.separationBp * (index + 1) * 100 / AREA_BP);
    anchorX += index % 2 === 0 ? scatter : -scatter;
    anchorY += index % 2 === 0 ? -scatter : scatter;
  }
  const placed = resolveTerrainPlacement(run, companion, { x: anchorX, y: anchorY });
  return { x: placed.x, y: placed.y };
}

function moveToward(run, entity, destination, speed) {
  const dx = destination.x - entity.x;
  const dy = destination.y - entity.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return;
  const step = Math.min(Math.max(1, Math.trunc(speed / TICK_RATE)), distance);
  const target = distance <= step
    ? destination
    : {
      x: entity.x + Math.trunc(dx / distance * step),
      y: entity.y + Math.trunc(dy / distance * step),
    };
  moveOnTerrain(run, entity, target);
}

function eligibleCompanionItem(run, companion, pickup) {
  return pickup?.kind === "item"
    && Boolean(ITEMS[pickup.itemId])
    && (pickup.deniedUntil || -1) < run.tick
    && distanceSquared(pickup, run.commander) <= COMPANION_AUTONOMY.hardLeashRange ** 2
    && distanceSquared(pickup, companion) <= COMPANION_AUTONOMY.itemClaimRange ** 2;
}

function assignCompanionItemClaims(run) {
  const claimedPickupIds = new Set();
  for (const companion of run.companions) {
    if (companion.status !== "ACTIVE") {
      companion.aiState = "DOWNED";
      companion.aiTargetId = null;
      companion.combatTargetId = null;
      continue;
    }
    const target = run.pickups.find((pickup) => pickup.id === companion.aiTargetId
      && !claimedPickupIds.has(pickup.id)
      && eligibleCompanionItem(run, companion, pickup));
    companion.aiTargetId = target?.id ?? null;
    if (target) {
      companion.aiState = "COLLECT";
      claimedPickupIds.add(target.id);
    }
  }

  const availableItems = run.pickups
    .filter((pickup) => pickup.kind === "item" && ITEMS[pickup.itemId] && !claimedPickupIds.has(pickup.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const pickup of availableItems) {
    let claimant = null;
    let claimantIndex = Infinity;
    let claimantDistance = Infinity;
    run.companions.forEach((companion, index) => {
      if (companion.status !== "ACTIVE"
          || companion.aiTargetId !== null
          || !eligibleCompanionItem(run, companion, pickup)) return;
      const candidateDistance = distanceSquared(pickup, companion);
      if (candidateDistance < claimantDistance
          || (candidateDistance === claimantDistance && index < claimantIndex)
          || (candidateDistance === claimantDistance && index === claimantIndex
            && companion.id.localeCompare(claimant?.id ?? "") < 0)) {
        claimant = companion;
        claimantIndex = index;
        claimantDistance = candidateDistance;
      }
    });
    if (!claimant) continue;
    claimant.aiState = "COLLECT";
    claimant.aiTargetId = pickup.id;
    claimedPickupIds.add(pickup.id);
  }
}

function companionCombatTarget(run, companion) {
  if (run.rallyTargetId) {
    const boss = run.enemies.find((entry) => entry.id === run.rallyTargetId && entry.hp > 0);
    if (boss && distanceSquared(companion, boss) <= getEffectiveRange(run, companion.range) ** 2) return boss;
  }
  return orderedTargets(run, companion, companion.range)[0] || null;
}

function updateCompanions(run) {
  assignCompanionItemClaims(run);
  run.companions.forEach((companion, index) => {
    const anchor = companionFormationAnchor(run, companion, index);
    companion.slot = stanceSlotForIndex(run, index);
    if (companion.status !== "ACTIVE") return;

    if (distanceSquared(companion, run.commander) > COMPANION_AUTONOMY.hardLeashRange ** 2) {
      companion.aiTargetId = null;
      companion.aiState = "RETURN";
    }

    const itemTarget = companion.aiTargetId
      ? run.pickups.find((pickup) => pickup.id === companion.aiTargetId) || null
      : null;
    if (itemTarget) {
      companion.aiState = "COLLECT";
      moveToward(run, companion, itemTarget, COMPANION_AUTONOMY.followSpeed);
    } else {
      const returning = companion.aiState === "COLLECT" || companion.aiState === "RETURN";
      moveToward(run, companion, anchor, returning ? COMPANION_AUTONOMY.returnSpeed : COMPANION_AUTONOMY.followSpeed);
      const atAnchor = companion.x === anchor.x && companion.y === anchor.y;
      companion.aiState = returning && !atAnchor ? "RETURN" : "FOLLOW";
    }

    const target = companionCombatTarget(run, companion);
    companion.combatTargetId = target?.id ?? null;
    companion.cooldown -= 1;
    if (companion.cooldown <= 0) {
      if (target) {
        const isElite = target.elite || target.class === "boss";
        const synergyActive = companion.slot === "BACK" && livingFrontCompanions(run).length > 0;
        const mult = (isElite ? 1 + (companion.eliteDamageBonus || 0) : 1)
          * (synergyActive ? 1 + BACK_ROW_SYNERGY_DAMAGE_BONUS : 1);
        playerAttack(run, companion, Math.round(companion.damage * mult), companion.companionId, null, companion.range);

      }
      // AI response `punish`: inside the recovery window a heavy attack just opened, allied fire
      // recovers faster. This is the reward for surviving the telegraph rather than avoiding it.
      companion.cooldown = punishWindowActive(run)
        ? Math.max(1, Math.trunc(companion.fireTicks * AI_RESPONSE_PATTERNS.punish.cooldownScaleBp / AREA_BP))
        : companion.fireTicks;
    }
  });
}

function resolveCritical(run, source, baseDamage) {
  if (baseDamage <= 0) return { source, baseDamage, damage: baseDamage, critical: false };
  const profile = run?.commander?.critProfile || COMMANDER.critProfile;
  if (!profile?.sources?.includes(source)) return { source, baseDamage, damage: baseDamage, critical: false };
  run.combatRng = rngNext(run.combatRng);
  const critical = run.combatRng % 10000 < profile.chanceBp;
  return {
    source,
    baseDamage,
    damage: critical ? Math.trunc(baseDamage * profile.multiplierBp / 10000) : baseDamage,
    critical,
    chanceBp: profile.chanceBp,
    multiplierBp: profile.multiplierBp,
  };
}

function fire(run, source, target, damage, owner, ttl = 5, combat = null) {
  const hit = combat || { source: null, baseDamage: damage, damage, critical: false };
  const projectile = actor(nextId(run, "projectile"), "projectile", source.x, source.y, 1, 1, {
    elevation: source.elevation || 0,
    sourceId: source.id,
    targetId: target.id,
    damage: hit.damage,
    owner,
    ttl,
    combat: hit,
    element: elementOf(source.element),
    // The launching side is recorded on the shell itself: resolving it from the live enemy list
    // at detonation would flip sides whenever the shooter died mid-flight.
    faction: source.kind === "enemy" || source.class === "boss" ? "enemy" : "player",
  });
  run.projectiles.push(projectile);
  const firedEvent = emit(run, "WEAPON_FIRED", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    projectileId: projectile.id,
    targetId: target.id,
    targetSpawnEventId: target.spawnEventId || null,
    owner,
    damage: hit.damage,
    baseDamage: hit.baseDamage,
    combatSource: hit.source,
    critical: hit.critical,
    cue: eventCue("weaponFire"),
  });
  firedEvent.spawnEventId = firedEvent.eventId;
  projectile.spawnEventId = firedEvent.eventId;
  projectile.causalRootId = firedEvent.eventId;
  if (hit.critical) emit(run, "CRITICAL_HIT", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    targetId: target.id,
    targetSpawnEventId: target.spawnEventId || null,
    projectileId: projectile.id,
    causalRootId: projectile.causalRootId,
    source: hit.source,
    baseDamage: hit.baseDamage,
    damage: hit.damage,
    chanceBp: hit.chanceBp,
    multiplierBp: hit.multiplierBp,
    cue: eventCue("criticalHit"),
  });
}

/* ---------------------------------------------------------------------------------------------
 * Area combat (광역 전투) — every contact splashes.
 *
 * `resolveAreaImpact()` is the single authority. Every damage-dealing call site hands it a
 * contact point, the authored damage of the PRIMARY hit and a source key; it finds every other
 * body of the opposing faction inside the disc and applies
 * `damage x areaShareBp(distance, weight, element, duration)` to each.
 *
 * Invariants:
 *  - The primary body is damaged by its own call site. This function never double-damages it.
 *  - Iteration order is the deterministic `sortedActors()` order, and every arithmetic step is
 *    integer, so the digest is reproducible.
 *  - Splash never kills the gate. Structures are hit by their own authored paths only.
 * ------------------------------------------------------------------------------------------- */

/** Bodies of the faction OPPOSING `faction`, deterministically ordered, primary excluded. */
function areaVictims(run, faction, excludeIds) {
  const bodies = faction === "player"
    ? sortedActors(run.enemies).filter((enemy) => enemy.hp > 0)
    : [run.commander, ...sortedActors(run.companions).filter((entry) => entry.status !== "DOWNED")];
  return bodies.filter((body) => body && !excludeIds.has(body.id));
}

/** Live integrity of a body, whichever field its kind stores it in. */
const bodyHealth = (body) => (body.id === "commander" ? body.integrity : body.hp);

/**
 * Applies one splash hit to one body and emits the damage event its kind already uses, so HUD,
 * telemetry and audio keep working without learning a new event type.
 */
function applyAreaDamageToBody(run, body, damage, context) {
  if (damage <= 0) return 0;
  if (body.id === "commander") {
    const scaled = Math.round(damage * run.commander.incomingDamageMultiplier);
    run.commander.integrity = clamp(run.commander.integrity - scaled, 0, run.commander.maxIntegrity);
    emit(run, "COMMANDER_DAMAGED", {
      enemyId: context.sourceId,
      sourceId: context.sourceId,
      damage: scaled,
      hp: run.commander.integrity,
      maxHp: run.commander.maxIntegrity,
      area: true,
      areaSource: context.sourceKey,
      element: context.element,
      causalRootId: context.causalRootId,
    });
    applyWardenDamageResponse(run);
    return scaled;
  }
  if (body.kind === "companion") {
    body.hp = clamp(body.hp - damage, 0, body.maxHp);
    emit(run, "COMPANION_DAMAGED", {
      entityId: body.id,
      companionId: body.companionId,
      sourceId: context.sourceId,
      damage,
      hp: body.hp,
      maxHp: body.maxHp,
      area: true,
      areaSource: context.sourceKey,
      element: context.element,
      causalRootId: context.causalRootId,
    });
    if (body.hp <= 0 && body.status === "ACTIVE") {
      body.status = "DOWNED";
      emit(run, "COMPANION_DOWNED", { entityId: body.id, companionId: body.companionId, area: true });
    }
    return damage;
  }
  const applied = damageEnemyBody(run, body, damage);
  body.lastCausalRootId = context.causalRootId || body.lastCausalRootId;
  return applied.damage;
}

/**
 * Resolves one area contact. Returns the splash descriptor the renderer reads (origin, radius,
 * element and the per-body damage list) — the event carrying it is emitted here as well.
 */
function resolveAreaImpact(run, {
  origin,
  faction,
  sourceId,
  sourceKey = "basic",
  damage,
  element = null,
  radius = null,
  weightBp = null,
  durationTicks = 0,
  excludeIds = [],
  causalRootId = null,
  castInstanceId = null,
}) {
  const profile = areaSourceProfile(sourceKey);
  const discRadius = Math.max(1, Math.trunc(radius ?? profile.radius));
  const discWeightBp = Math.max(0, Math.trunc(weightBp ?? profile.weightBp));
  const attackerElement = elementOf(element ?? profile.element);
  const baseDamage = Math.max(0, Math.trunc(damage));
  const exclude = new Set(excludeIds.filter(Boolean));
  if (baseDamage <= 0 || discWeightBp <= 0) return null;

  const struck = [];
  for (const body of areaVictims(run, faction, exclude)) {
    if (struck.length >= AREA_COMBAT.maxSplashTargets) break;
    const distance = Math.trunc(Math.sqrt(distanceSquared(body, origin)));
    const shareBp = areaShareBp({
      distance,
      radius: discRadius,
      weightBp: discWeightBp,
      attackerElement,
      defenderElement: elementOf(body.element),
      durationTicks,
    });
    if (shareBp <= 0) continue;
    const braced = body.braceUntilTick && run.tick <= body.braceUntilTick;
    const rawDamage = Math.trunc(baseDamage * shareBp / AREA_BP);
    const bracedDamage = braced
      ? Math.trunc(rawDamage * AI_RESPONSE_PATTERNS.brace.damageScaleBp / AREA_BP)
      : rawDamage;
    const finalDamage = Math.max(AREA_COMBAT.minSplashDamage, bracedDamage);
    const healthBefore = bodyHealth(body);
    const applied = applyAreaDamageToBody(run, body, finalDamage, {
      sourceId,
      sourceKey,
      element: attackerElement,
      causalRootId,
    });
    struck.push({
      targetId: body.id,
      damage: applied,
      distance,
      shareBp,
      // The defender's element is published so a reviewer can reproduce the share by hand:
      // share = falloff(distance) x weight x matchup(attacker, defender) x sustain(duration).
      defenderElement: elementOf(body.element),
      braced: Boolean(braced),
      healthBefore,
      healthAfter: bodyHealth(body),
    });
  }
  if (!struck.length) return null;

  const impact = {
    sourceId,
    sourceKey,
    faction,
    element: attackerElement,
    originX: Math.trunc(origin.x),
    originY: Math.trunc(origin.y),
    radius: discRadius,
    weightBp: discWeightBp,
    durationTicks: Math.max(0, Math.trunc(durationTicks)),
    targets: struck,
    targetIds: struck.map((entry) => entry.targetId),
    causalRootId,
    castInstanceId,
    simTick: run.tick,
    cue: eventCue("impactHit"),
  };
  emit(run, "AREA_IMPACT", impact);
  return impact;
}

/**
 * Spawns a lingering field. The field re-runs `resolveAreaImpact` every `AREA_FIELD.pulseTicks`
 * with the duration factor applied, which is what makes "지속시간" a real balance axis rather
 * than a label: the same budget either lands now or is paid out over the field's life.
 */
function spawnAreaField(run, { origin, faction, sourceId, sourceKey, damage, element, radius, weightBp, durationTicks, causalRootId = null }) {
  const ticks = Math.max(0, Math.trunc(durationTicks));
  if (ticks < AREA_FIELD.pulseTicks) return null;
  const profile = areaSourceProfile(sourceKey);
  const field = {
    id: nextId(run, "field"),
    faction,
    sourceId,
    sourceKey,
    element: elementOf(element ?? profile.element),
    x: Math.trunc(origin.x),
    y: Math.trunc(origin.y),
    radius: Math.max(1, Math.trunc(radius ?? profile.radius)),
    weightBp: Math.max(0, Math.trunc(weightBp ?? profile.weightBp)),
    damage: Math.max(0, Math.trunc(damage)),
    durationTicks: ticks,
    startedAt: run.tick,
    expiresAt: run.tick + ticks,
    nextPulseAt: run.tick + AREA_FIELD.pulseTicks,
    causalRootId,
  };
  run.areaFields.push(field);
  while (run.areaFields.length > AREA_FIELD.maxActive) {
    const retired = run.areaFields.shift();
    emit(run, "AREA_FIELD_ENDED", { fieldId: retired.id, reason: "EVICTED", simTick: run.tick });
  }
  emit(run, "AREA_FIELD_STARTED", {
    fieldId: field.id,
    sourceId,
    sourceKey,
    faction,
    element: field.element,
    originX: field.x,
    originY: field.y,
    radius: field.radius,
    durationTicks: ticks,
    expiresAt: field.expiresAt,
    causalRootId,
    simTick: run.tick,
    cue: eventCue("impactHit"),
  });
  return field;
}

/** Ticks every live field: pulse on schedule, retire on expiry. Deterministic array order. */
function processAreaFields(run) {
  if (!run.areaFields.length) return;
  const surviving = [];
  for (const field of run.areaFields) {
    if (run.tick >= field.nextPulseAt && run.tick <= field.expiresAt) {
      const impact = resolveAreaImpact(run, {
        origin: field,
        faction: field.faction,
        sourceId: field.sourceId,
        sourceKey: field.sourceKey,
        damage: field.damage,
        element: field.element,
        radius: field.radius,
        weightBp: field.weightBp,
        durationTicks: field.durationTicks,
        causalRootId: field.causalRootId,
      });
      field.nextPulseAt = run.tick + AREA_FIELD.pulseTicks;
      emit(run, "AREA_FIELD_PULSE", {
        fieldId: field.id,
        sourceId: field.sourceId,
        faction: field.faction,
        element: field.element,
        originX: field.x,
        originY: field.y,
        radius: field.radius,
        targetIds: impact ? impact.targetIds : [],
        remainingTicks: field.expiresAt - run.tick,
        simTick: run.tick,
      });
    }
    if (run.tick >= field.expiresAt) {
      emit(run, "AREA_FIELD_ENDED", { fieldId: field.id, reason: "EXPIRED", simTick: run.tick });
      continue;
    }
    surviving.push(field);
  }
  run.areaFields = surviving;
}

/**
 * AI response patterns (defense-catalog AI_RESPONSE_PATTERNS) applied to one telegraph.
 *
 * Every player-side body the telegraph disc covers is marked with an evade window; when two or
 * more are covered they additionally take a scatter bias so the legion stops standing in one
 * disc; a body already too deep inside the disc braces instead. The recovery window that follows
 * the attack is what opens the punish window on the attacker.
 */
function applyTelegraphResponse(run, attacker, origin, radius) {
  const covered = [run.commander, ...sortedActors(run.companions).filter((entry) => entry.status !== "DOWNED")]
    .filter((body) => distanceSquared(body, origin) <= radius * radius);
  if (!covered.length) return { evading: [], bracing: [] };
  const evade = AI_RESPONSE_PATTERNS.evade;
  const spread = AI_RESPONSE_PATTERNS.spread;
  const braceRadius = Math.trunc(radius * AI_RESPONSE_PATTERNS.brace.damageScaleBp / AREA_BP / 2);
  const evading = [];
  const bracing = [];
  for (const body of covered) {
    const distance = Math.trunc(Math.sqrt(distanceSquared(body, origin)));
    if (distance <= braceRadius) {
      body.braceUntilTick = run.tick + AI_RESPONSE_PATTERNS.brace.windowTicks;
      bracing.push(body.id);
      continue;
    }
    body.evadeUntilTick = run.tick + evade.windowTicks;
    body.evadeFromX = Math.trunc(origin.x);
    body.evadeFromY = Math.trunc(origin.y);
    body.evadeClearance = radius + Math.trunc(radius * evade.clearanceBp / AREA_BP);
    evading.push(body.id);
  }
  if (covered.length >= spread.minBodies) {
    for (const body of covered) body.spreadUntilTick = run.tick + spread.windowTicks;
  }
  emit(run, "AI_RESPONSE_APPLIED", {
    entityId: attacker.id,
    responsePatterns: [
      ...(evading.length ? ["evade"] : []),
      ...(covered.length >= spread.minBodies ? ["spread"] : []),
      ...(bracing.length ? ["brace"] : []),
    ],
    evadingIds: evading,
    bracingIds: bracing,
    originX: Math.trunc(origin.x),
    originY: Math.trunc(origin.y),
    radius,
    simTick: run.tick,
  });
  return { evading, bracing };
}

/** True while allied fire is inside a punish window opened by a recovering attacker. */
function punishWindowActive(run) {
  return run.punishWindowUntilTick > 0 && run.tick <= run.punishWindowUntilTick;
}

/* ---------------------------------------------------------------------------------------------
 * None-target combat (COMBAT_TARGETING).
 *
 * Player-side attacks no longer lock onto an enemy id. A swing damages every body inside the
 * adjacent frontal arc, and ranged fire spawns a travelling orb whose swept sphere damages the
 * first body it touches — whichever enemy walks into the line, not the one that was aimed at.
 * Enemy fire keeps the legacy timed projectile so wave pressure pacing is unchanged.
 * ------------------------------------------------------------------------------------------- */

/** Elite escorts soak a quarter of the damage aimed at the leader they guard. */
function damageEnemyBody(run, target, damage) {
  const escort = sortedActors(run.enemies).find((entry) => entry.policyId === "elite-escort"
    && entry.escortLeaderId === target.id
    && distanceSquared(entry, target) <= 1600 ** 2);
  const applied = escort ? Math.max(1, Math.trunc(damage * 3 / 4)) : damage;
  target.hp -= applied;
  // The tick of the last hit is what the semantic `stagger` state reads; it is bookkeeping for
  // presentation and AI, never an input to damage.
  target.lastDamagedTick = run.tick;
  return { damage: applied, guardedBy: escort ? escort.id : null };
}

const withinStrikeHeight = (source, other) =>
  Math.abs((other.elevation || 0) - (source.elevation || 0)) <= COMBAT_TARGETING.elevationTolerance;

/** Nearest living enemy inside `range` that is also within strike height — direction only, no lock. */
function nearestEnemy(run, source, range) {
  const maxSquared = getEffectiveRange(run, range) ** 2;
  let best = null;
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0) continue;
    if (!withinStrikeHeight(source, enemy)) continue;
    const distance = distanceSquared(enemy, source);
    if (distance > maxSquared) continue;
    if (!best || distance < best.distance
      || (distance === best.distance && enemy.id.localeCompare(best.enemy.id) < 0)) {
      best = { enemy, distance };
    }
  }
  return best?.enemy || null;
}

/** Unit aim vector: toward the nearest body in range, else the direction the attacker faces. */
function aimDirection(run, source, range) {
  const near = nearestEnemy(run, source, range);
  if (near) {
    const dx = near.x - source.x;
    const dy = near.y - source.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) return { x: dx / length, y: dy / length, aimId: near.id };
  }
  const facing = facingOf(source);
  if (facing) return { x: facing.x, y: facing.y, aimId: near?.id || null };
  return near ? { x: 1, y: 0, aimId: near.id } : null;
}

/** Every living enemy whose body touches the adjacent frontal sweep, nearest first. */
function meleeSweepTargets(run, source, aim) {
  const { reach, arcCosBp, maxTargets } = COMBAT_TARGETING.melee;
  const arcCos = arcCosBp / 10000;
  const sourceRadius = Math.max(0, Math.trunc(source.radius || 0));
  return run.enemies
    .filter((enemy) => enemy.hp > 0 && withinStrikeHeight(source, enemy))
    .map((enemy) => {
      const dx = enemy.x - source.x;
      const dy = enemy.y - source.y;
      const distance = Math.hypot(dx, dy);
      const gap = distance - sourceRadius - Math.max(0, Math.trunc(enemy.radius || 0));
      const facingDot = distance === 0 ? 1 : (dx / distance) * aim.x + (dy / distance) * aim.y;
      return { enemy, distance, gap, facingDot };
    })
    .filter((entry) => entry.gap <= reach && entry.facingDot >= arcCos)
    .sort((left, right) => left.distance - right.distance || left.enemy.id.localeCompare(right.enemy.id))
    .slice(0, maxTargets)
    .map((entry) => entry.enemy);
}

/** Resolves one adjacent sweep; returns the number of bodies struck. */
function meleeSweep(run, source, targets, damage, owner, combat) {
  const hit = combat || { source: null, baseDamage: damage, damage, critical: false };
  const sweepEvent = emit(run, "MELEE_SWEEP", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    owner,
    reach: COMBAT_TARGETING.melee.reach,
    arcCosBp: COMBAT_TARGETING.melee.arcCosBp,
    targetIds: targets.map((target) => target.id),
    damage: hit.damage,
    baseDamage: hit.baseDamage,
    combatSource: hit.source,
    critical: hit.critical,
    cue: eventCue("weaponFire"),
  });
  sweepEvent.spawnEventId = sweepEvent.eventId;
  if (hit.critical) emit(run, "CRITICAL_HIT", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    targetId: targets[0]?.id || null,
    causalRootId: sweepEvent.eventId,
    source: hit.source,
    baseDamage: hit.baseDamage,
    damage: hit.damage,
    chanceBp: hit.chanceBp,
    multiplierBp: hit.multiplierBp,
    cue: eventCue("criticalHit"),
  });
  targets.forEach((target) => {
    const applied = damageEnemyBody(run, target, hit.damage);
    target.lastCausalRootId = sweepEvent.eventId;
    emit(run, "MELEE_IMPACT", {
      entityId: source.id,
      sourceId: source.id,
      causalRootId: sweepEvent.eventId,
      targetId: target.id,
      targetSpawnEventId: target.spawnEventId || null,
      owner,
      damage: applied.damage,
      guardedBy: applied.guardedBy,
      hit: true,
      cue: eventCue("impactHit"),
    });
  });
  // 광역: the swing is a disc centred on the arc, not a list of locked targets. Bodies already
  // struck by the arc are excluded so nobody is damaged twice by one swing.
  resolveAreaImpact(run, {
    origin: source,
    faction: "player",
    sourceId: source.id,
    sourceKey: source.id === "commander" ? "basic" : "companion",
    damage: hit.damage,
    element: source.element,
    excludeIds: targets.map((target) => target.id),
    causalRootId: sweepEvent.eventId,
  });
  return targets.length;
}

/** Spawns a travelling orb along `aim`; it damages the first body its swept sphere touches. */
function fireTravellingOrb(run, source, aim, damage, owner, range, combat) {
  const hit = combat || { source: null, baseDamage: damage, damage, critical: false };
  const speed = COMBAT_TARGETING.ranged.projectileSpeed;
  const maxRange = getEffectiveRange(run, range);
  const projectile = actor(nextId(run, "projectile"), "projectile", source.x, source.y, 1, 1, {
    elevation: source.elevation || 0,
    sourceId: source.id,
    targetId: null,
    aimId: aim.aimId,
    mode: "travel",
    faction: "player",
    radius: COMBAT_TARGETING.ranged.projectileRadius,
    vx: Math.round(aim.x * speed),
    vy: Math.round(aim.y * speed),
    remainingRange: maxRange,
    damage: hit.damage,
    owner,
    ttl: COMBAT_TARGETING.ranged.maxTicks,
    combat: hit,
    element: elementOf(source.element),
  });
  run.projectiles.push(projectile);
  const firedEvent = emit(run, "WEAPON_FIRED", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    projectileId: projectile.id,
    targetId: null,
    aimId: aim.aimId,
    mode: "travel",
    targetSpawnEventId: null,
    owner,
    damage: hit.damage,
    baseDamage: hit.baseDamage,
    combatSource: hit.source,
    critical: hit.critical,
    cue: eventCue("weaponFire"),
  });
  firedEvent.spawnEventId = firedEvent.eventId;
  projectile.spawnEventId = firedEvent.eventId;
  projectile.causalRootId = firedEvent.eventId;
  if (hit.critical) emit(run, "CRITICAL_HIT", {
    entityId: source.id,
    sourceSpawnEventId: source.spawnEventId || null,
    targetId: null,
    projectileId: projectile.id,
    causalRootId: projectile.causalRootId,
    source: hit.source,
    baseDamage: hit.baseDamage,
    damage: hit.damage,
    chanceBp: hit.chanceBp,
    multiplierBp: hit.multiplierBp,
    cue: eventCue("criticalHit"),
  });
  return projectile;
}

/**
 * One player-side attack: adjacent bodies are swept in melee, otherwise an orb is launched down the
 * aim line. Returns true when the attack resolved (so cooldown bookkeeping stays with the caller).
 */
function playerAttack(run, source, damage, owner, combat, range) {
  const aim = aimDirection(run, source, range);
  if (!aim) return false;
  const adjacent = meleeSweepTargets(run, source, aim);
  setFacing(source, aim.x * FACING_SCALE, aim.y * FACING_SCALE);
  if (adjacent.length > 0) {
    meleeSweep(run, source, adjacent, damage, owner, combat);
    return true;
  }
  if (!aim.aimId) return false;
  fireTravellingOrb(run, source, aim, damage, owner, range, combat);
  return true;
}

/** Resolves the commander's shared basic-attack verb for both automatic and manual input. */
function resolveCommanderBasicAttack(run, aimReference, mode = "automatic") {
  const mult = commanderDamageMultiplier(run, aimReference, { skill: false });
  const hit = resolveCritical(run, "basic", Math.round(run.commander.basicDamage * mult));
  const resolved = playerAttack(run, run.commander, hit.damage, "commander", hit, COMMANDER.basicRange);

  if (!resolved) return false;

  if (mode === "manual") {
    emit(run, "BASIC_ATTACK", {
      entityId: run.commander.id,
      targetId: aimReference.id,
      critical: hit.critical,
      damage: hit.damage,
      cue: eventCue("weaponFire"),
    });
  }

  maybeFireExtraHit(run, aimReference);
  return true;
}

function commanderBasicAttack(run, mode = "automatic") {
  const aimReference = nearestEnemy(run, run.commander, COMMANDER.basicRange);
  if (!aimReference) return false;
  return resolveCommanderBasicAttack(run, aimReference, mode);
}

/** Closest point parameter (0..1) of segment `from`->`delta` to `point`. */
function segmentClosestFraction(from, delta, point) {
  const lengthSquared = delta.x * delta.x + delta.y * delta.y;
  if (lengthSquared === 0) return 0;
  const at = ((point.x - from.x) * delta.x + (point.y - from.y) * delta.y) / lengthSquared;
  return clamp(at, 0, 1);
}

/**
 * Advances travelling orbs one tick with a swept-sphere test: whichever living body the orb's path
 * touches first (ties broken by id) takes the hit. Terrain obstacles and the arena bounds stop the
 * orb without damage, so a shot can be blocked by cover exactly like a body can.
 */
function advanceTravellingProjectiles(run) {
  const world = worldForRun(run);
  const bounds = world.gameplay.bounds;
  const survivors = [];
  for (const projectile of run.projectiles) {
    if (projectile.mode !== "travel") { survivors.push(projectile); continue; }
    const from = { x: projectile.x, y: projectile.y };
    const step = Math.min(Math.hypot(projectile.vx, projectile.vy), Math.max(0, projectile.remainingRange));
    const heading = Math.hypot(projectile.vx, projectile.vy) || 1;
    const delta = { x: projectile.vx / heading * step, y: projectile.vy / heading * step };
    const to = { x: from.x + delta.x, y: from.y + delta.y };

    let struck = null;
    for (const enemy of run.enemies) {
      if (enemy.hp <= 0) continue;
      if (!withinStrikeHeight(projectile, enemy)) continue;
      const at = segmentClosestFraction(from, delta, enemy);
      const closestX = from.x + delta.x * at;
      const closestY = from.y + delta.y * at;
      const reach = projectile.radius + Math.max(0, Math.trunc(enemy.radius || 0));
      const gapSquared = (closestX - enemy.x) ** 2 + (closestY - enemy.y) ** 2;
      if (gapSquared > reach * reach) continue;
      if (!struck || at < struck.at || (at === struck.at && enemy.id.localeCompare(struck.enemy.id) < 0)) {
        struck = { enemy, at };
      }
    }

    const blocker = firstObstacleHit(world, { radius: projectile.radius }, from, to);
    if (blocker && (!struck || blocker.at < struck.at)) {
      emit(run, "PROJECTILE_BLOCKED", {
        projectileId: projectile.id,
        sourceId: projectile.sourceId,
        causalRootId: projectile.causalRootId,
        obstacleId: blocker.obstacle.id,
        owner: projectile.owner,
      });
      continue;
    }

    if (struck) {
      const applied = damageEnemyBody(run, struck.enemy, projectile.damage);
      struck.enemy.lastCausalRootId = projectile.causalRootId;
      emit(run, "PROJECTILE_IMPACT", {
        projectileId: projectile.id,
        sourceId: projectile.sourceId,
        causalRootId: projectile.causalRootId,
        projectileSpawnEventId: projectile.spawnEventId,
        targetId: struck.enemy.id,
        targetSpawnEventId: struck.enemy.spawnEventId || null,
        owner: projectile.owner,
        damage: applied.damage,
        hit: true,
        guardedBy: applied.guardedBy,
        cue: eventCue("impactHit"),
      });
      // 광역: the orb detonates on contact; the body it touched is excluded from its own burst.
      resolveAreaImpact(run, {
        origin: struck.enemy,
        faction: "player",
        sourceId: projectile.sourceId,
        sourceKey: "projectile",
        damage: projectile.damage,
        element: projectile.element,
        excludeIds: [struck.enemy.id],
        causalRootId: projectile.causalRootId,
      });
      continue;
    }

    projectile.x = Math.round(to.x);
    projectile.y = Math.round(to.y);
    projectile.remainingRange -= step;
    projectile.ttl -= 1;
    projectile.elevation = terrainSupportAt(world, projectile.x, projectile.y).elevation
      + COMBAT_TARGETING.ranged.projectileRadius;
    const outside = projectile.x <= bounds.minX || projectile.x >= bounds.maxX
      || projectile.y <= bounds.minY || projectile.y >= bounds.maxY;
    if (projectile.ttl <= 0 || projectile.remainingRange <= 0 || outside) {
      emit(run, "PROJECTILE_EXPIRED", {
        projectileId: projectile.id,
        sourceId: projectile.sourceId,
        causalRootId: projectile.causalRootId,
        owner: projectile.owner,
        reason: outside ? "bounds" : "range",
      });
      continue;
    }
    survivors.push(projectile);
  }
  run.projectiles = survivors;
}


function applyItem(run, itemId) {
  if (run.measurementProfile) return;
  const item = ITEMS[itemId];
  if (item.damageBonus) run.commander.basicDamage += item.damageBonus;
  if (item.maxIntegrity) {
    run.gate.maxIntegrity += item.maxIntegrity;
    run.gate.integrity = clamp(run.gate.integrity + item.integrity, 0, run.gate.maxIntegrity);
  }
  if (item.pickupRange) run.commander.pickupRange += item.pickupRange;
  if (item.cooldownReduction) run.commander.cooldownScale = clamp(run.commander.cooldownScale - item.cooldownReduction, 0.5, 1);
}

function collectPickups(run) {
  let gained = 0;
  const commanderRadiusSquared = run.commander.pickupRange ** 2;
  const companionContactSquared = COMPANION_AUTONOMY.itemContactRange ** 2;
  run.pickups = run.pickups.filter((pickup) => {
    const commanderInRange = distanceSquared(pickup, run.commander) <= commanderRadiusSquared;
    if (pickup.kind === "echo") {
      if (!commanderInRange) return true;
      const denier = sortedActors(run.enemies).find((enemy) => enemy.policyId === "resource-denial"
        && distanceSquared(enemy, pickup) <= Math.max(enemy.radius + 150, enemy.projectileRange || 0) ** 2);
      if (denier && (pickup.deniedUntil || -1) < run.tick) {
        pickup.deniedUntil = run.tick + 60;
        pickup.deniedBy = denier.id;
        run.progress.echoDenied += pickup.xp;
        const denial = {
          entityId: denier.id,
          enemyId: denier.id,
          pickupId: pickup.id,
          deniedXp: pickup.xp,
          policyId: denier.policyId,
          objectiveId: "echo-recovery",
          deniedUntil: pickup.deniedUntil,
        };
        emit(run, "PICKUP_DENIED", denial);
        emit(run, "ECHO_DENIED", denial);
      }
      if (pickup.deniedUntil >= run.tick) return true;
      gained += pickup.xp;
      return false;
    }

    if (pickup.kind === "item") {
      const claimant = run.companions.find((companion) => companion.status === "ACTIVE"
        && companion.aiState === "COLLECT"
        && companion.aiTargetId === pickup.id);
      const companionCollector = claimant && distanceSquared(claimant, pickup) <= companionContactSquared
        ? claimant
        : null;
      if (claimant && !companionCollector) return true;
      if (!companionCollector && !commanderInRange) return true;
      applyItem(run, pickup.itemId);
      run.itemIds.push(pickup.itemId);
      run.progress.itemsCollected += 1;
      emit(run, "ITEM_COLLECTED", {
        itemId: pickup.itemId,
        entityId: companionCollector?.id ?? run.commander.id,
        companionId: companionCollector?.companionId ?? null,
        cue: eventCue("itemCollected"),
      });
      if (companionCollector) {
        companionCollector.aiState = "RETURN";
        companionCollector.aiTargetId = null;
      }
      return false;
    }

    if (!commanderInRange) return true;
    gained += pickup.xp;
    return false;
  });
  run.commander.xp += gained;
}

function makeOffer(run) {
  if (run.measurementProfile) return;
  let seed = run.rng;
  // Rank-up offers: a skill the commander already owns stays in the pool until MAX_SKILL_RANK, so a
  // long stage deepens a build (특성 강화) instead of only widening it with new skill ids.
  const available = Object.keys(SKILLS)
    .filter((id) => !run.commander.skills.includes(id) || (run.commander.skillRanks[id] ?? 1) < MAX_SKILL_RANK)
    .sort();
  const choices = [];
  while (available.length && choices.length < 3) {
    seed = rngNext(seed);
    choices.push(available.splice(seed % available.length, 1)[0]);
  }
  run.rng = seed;
  run.growthOffer = { level: run.commander.level + 1, choices };
  emit(run, "GROWTH_OFFER", { choices: [...choices], objectiveId: "growth", cue: eventCue("growthOffer") });
}

function applySkill(run, skillId) {
  if (run.measurementProfile) return false;
  const skill = SKILLS[skillId];
  if (!skill || !run.growthOffer || !run.growthOffer.choices.includes(skillId)) return false;
  const completedLevelCost = XP_GROWTH[run.commander.level - 1] || XP_GROWTH.at(-1);
  const owned = run.commander.skills.includes(skillId);
  const rank = owned ? Math.min(MAX_SKILL_RANK, (run.commander.skillRanks[skillId] ?? 1) + 1) : 1;
  if (!owned) {
    run.commander.skills.push(skillId);
    run.commander.skills.sort();
  }
  run.commander.skillRanks[skillId] = rank;
  run.commander.level = run.growthOffer.level;
  run.progress.skillsLearned += 1;
  applySkillRankEffects(run, skill, rank);
  run.commander.xp -= completedLevelCost;
  run.growthOffer = null;
  emit(run, "SKILL_SELECTED", { skillId, rank, rankUp: owned, objectiveId: "growth", cue: eventCue("growthOffer") });
  return true;
}

/**
 * Skill rank scaling (특성 강화). Rank 1 is the shipped effect; every extra rank adds a fixed share
 * of it. Passives bank their bonus immediately; actives read their rank at cast time through
 * `skillRankDamage` / `skillRankCooldown`, so a rank carried in from the previous stage is worth
 * exactly what it would be worth if it had been earned in this one.
 */
function applySkillRankEffects(run, skill, rank) {
  if (skill.kind === "passive") {
    const share = rank === 1 ? 1 : SKILL_RANK_PASSIVE_SHARE;
    run.commander.basicDamage += Math.round((skill.basicDamage || 0) * share);
    if (skill.maxIntegrity) {
      const gain = Math.round(skill.maxIntegrity * share);
      run.commander.maxIntegrity += gain;
      run.commander.integrity += gain;
    }
    run.commander.pickupRange += Math.round((skill.pickupRange || 0) * share);
  } else if (rank === 1) run.commander.cooldowns[skill.id] = 0;
}
/** Active-skill damage at its current rank: +25% of base per rank beyond the first. */
function skillRankDamage(run, skill) {
  const rank = run.commander.skillRanks?.[skill.id] ?? 1;
  return Math.round((skill.damage || 0) * (1 + SKILL_RANK_DAMAGE_STEP * (rank - 1)));
}
/** Active-skill cooldown at its current rank: -6% of base per rank beyond the first, floored at 70%. */
function skillRankCooldown(run, skill, baseCooldownTicks) {
  const rank = run.commander.skillRanks?.[skill.id] ?? 1;
  const scale = Math.max(SKILL_RANK_COOLDOWN_FLOOR, 1 - SKILL_RANK_COOLDOWN_STEP * (rank - 1));
  return Math.max(1, Math.trunc(baseCooldownTicks * scale));
}

function castSkill(run, skillId) {
  const skill = SKILLS[skillId];
  if (!skill || skill.kind !== "active" || !run.commander.skills.includes(skillId) || run.commander.cooldowns[skillId] > 0) return false;
  const targets = orderedTargets(run, run.commander, skill.radius || COMMANDER.basicRange);
  const castSequence = ++run.castSequence;
  const castInstanceId = `${run.planCommitment.identity}:cast:${castSequence}`;
  const causalRootId = `${run.planCommitment.identity}:causal:${castSequence}`;
  if (skill.integrity) run.commander.integrity = clamp(run.commander.integrity + skill.integrity, 0, run.commander.maxIntegrity);
  if (skill.radius) {
    const firstStrikeFactor = targets.length ? consumeFirstStrikeFactor(run) : 1;
    targets.forEach((entry) => {
      const healthBefore = entry.hp;
      const hit = resolveCritical(run, "skill", Math.round(skillRankDamage(run, skill) * commanderDamageMultiplier(run, entry, { skill: true, firstStrikeFactor })));
      entry.hp -= hit.damage;
      const healthAfter = entry.hp;
      entry.lastCastInstanceId = castInstanceId;
      entry.lastCausalRootId = causalRootId;
      emit(run, "SKILL_RESOLVED_DAMAGE", {
        sourceId: run.commander.id,
        targetId: entry.id,
        skillId,
        castInstanceId,
        causalRootId,
        targetSpawnEventId: entry.spawnEventId || null,
        baseDamage: hit.baseDamage,
        finalDamage: hit.damage,
        damage: hit.damage,
        critical: hit.critical,
        ...(hit.chanceBp !== undefined ? { chanceBp: hit.chanceBp, multiplierBp: hit.multiplierBp } : {}),
        healthBefore,
        healthAfter,
        simTick: run.tick,
        hit: true,
      });
      if (hit.critical) emit(run, "CRITICAL_HIT", {
        entityId: run.commander.id,
        targetId: entry.id,
        source: hit.source,
        castInstanceId,
        causalRootId,
        targetSpawnEventId: entry.spawnEventId || null,
        baseDamage: hit.baseDamage,
        damage: hit.damage,
        chanceBp: hit.chanceBp,
        multiplierBp: hit.multiplierBp,
        cue: eventCue("criticalHit"),
      });
    });
  } else if (targets[0]) {
    const entry = targets[0];
    const healthBefore = entry.hp;
    const hit = resolveCritical(run, "skill", Math.round(skillRankDamage(run, skill) * commanderDamageMultiplier(run, entry, { skill: true })));
    entry.hp -= hit.damage;
    const healthAfter = entry.hp;
    entry.lastCastInstanceId = castInstanceId;
    entry.lastCausalRootId = causalRootId;
    emit(run, "SKILL_RESOLVED_DAMAGE", {
      sourceId: run.commander.id,
      targetId: entry.id,
      skillId,
      castInstanceId,
      causalRootId,
      targetSpawnEventId: entry.spawnEventId || null,
      baseDamage: hit.baseDamage,
      finalDamage: hit.damage,
      damage: hit.damage,
      critical: hit.critical,
      ...(hit.chanceBp !== undefined ? { chanceBp: hit.chanceBp, multiplierBp: hit.multiplierBp } : {}),
      healthBefore,
      healthAfter,
      simTick: run.tick,
      hit: true,
    });
    if (hit.critical) emit(run, "CRITICAL_HIT", {
      entityId: run.commander.id,
      targetId: entry.id,
      source: hit.source,
      baseDamage: hit.baseDamage,
      damage: hit.damage,
      castInstanceId,
      causalRootId,
      targetSpawnEventId: entry.spawnEventId || null,
      chanceBp: hit.chanceBp,
      multiplierBp: hit.multiplierBp,
      cue: eventCue("criticalHit"),
    });
  }

  // 광역: every cast is a disc, including the single-target actives. The bodies the authored
  // skill already damaged are excluded, so the splash only reaches what the skill did NOT hit.
  // A skill that declares `fieldTicks` also leaves a field, which is the duration axis of the
  // area model: the same damage budget either lands now or is paid out over the field's life.
  const skillDamage = skillRankDamage(run, skill);
  const skillOrigin = targets[0] ? { x: targets[0].x, y: targets[0].y } : { x: run.commander.x, y: run.commander.y };
  if (skillDamage > 0) {
    resolveAreaImpact(run, {
      origin: skillOrigin,
      faction: "player",
      sourceId: run.commander.id,
      sourceKey: "skill",
      damage: skillDamage,
      element: skill.element,
      radius: skill.areaRadius,
      weightBp: skill.areaWeightBp,
      excludeIds: targets.map((entry) => entry.id),
      causalRootId,
      castInstanceId,
    });
    if (skill.fieldTicks > 0) {
      spawnAreaField(run, {
        origin: skillOrigin,
        faction: "player",
        sourceId: run.commander.id,
        sourceKey: "skill",
        damage: skillDamage,
        element: skill.element,
        radius: skill.areaRadius,
        weightBp: skill.areaWeightBp,
        durationTicks: skill.fieldTicks,
        causalRootId,
      });
    }
  }

  const baseCooldownTicks = run.measurementProfile?.fixtureActiveCooldownTicks ?? skill.cooldown;
  const effectiveCooldownTicks = Math.max(1, Math.trunc(skillRankCooldown(run, skill, baseCooldownTicks) * run.commander.cooldownScale));
  run.commander.cooldowns[skillId] = effectiveCooldownTicks;

  const readyTick = run.tick + effectiveCooldownTicks - 1;

  // `motion`/`vfx` carried over from a concurrent session's in-flight change: their upgraded
  // copy of this emit had been spliced into the CRITICAL_HIT object literal above (:1607),
  // which left the file unparseable. The upgrade is applied here, at the emit HEAD already
  // had, rather than discarded. Recorded in
  // _workspace/current/production/concurrent-session-collision-20260729.md.
  emit(run, "SKILL_CAST", { skillId, motion: skill.motion || "attack", vfx: skill.vfx || skillId, castInstanceId, causalRootId, cue: eventCue("skillCast") });
  emit(run, "SKILL_COOLDOWN_SET", {
    castInstanceId,
    causalRootId,
    skillId,
    baseCooldownTicks,
    effectiveCooldownTicks,
    setTick: run.tick,
    readyTick,
    targetCount: skill.radius ? targets.length : (targets[0] ? 1 : 0),
    simTick: run.tick,
  });
  return true;
}

function applyReward(run, rewardId) {
  if (run.measurementProfile) return false;
  if (!run.rewardOffer || !run.rewardOffer.choices.includes(rewardId) || !REWARDS[rewardId]) return false;
  const rewardEmissionId = `reward:${rewardId}`;
  const alreadyOwned = run.rewardIds.includes(rewardId);
  run.rewardOffer = null;
  if (alreadyOwned) {
    emit(run, "REWARD_SELECTION_DUPLICATE_IGNORED", {
      rewardId,
      rewardEmissionId,
      reason: "REWARD_ALREADY_OWNED",
    });
    return true;
  }
  run.rewardIds.push(rewardId);
  emit(run, "REWARD_SELECTED", {
    rewardId,
    rewardEmissionId,
    alreadyOwned: false,
    cue: eventCue("terminal"),
  });
  return true;
}


function activeM4Card(run) {
  return run.planCommitment.m4Plan.cards[run.m4.cursor] || null;
}

function processM4Decision(run, payload) {
  const card = activeM4Card(run);
  const cardId = payload?.cardId || payload;
  const decision = payload?.decision;
  if (!card || run.m4.status !== "AVAILABLE" || card.id !== cardId || !["SELECT", "DECLINE"].includes(decision)) {
    emit(run, "M4_CARD_REJECTED", {
      cardId: cardId || null,
      reason: !card ? "M4_CARD_INVENTORY_EXHAUSTED" : "M4_CARD_DECISION_INVALID",
      m4PlanId: run.planCommitment.m4Plan.id,
    });
    return false;
  }
  run.m4.decisions.push({ cardId: card.id, decision, tick: run.tick });
  if (decision === "SELECT") {
    run.m4.selectedCardId = card.id;
    run.m4.status = "RECOVERY_PENDING";
    emit(run, "M4_CARD_SELECTED", {
      cardId: card.id,
      cardCheckpointObjectiveId: card.checkpointObjectiveId,
      m4PlanId: run.planCommitment.m4Plan.id,
      recoveryId: run.planCommitment.m4Plan.recovery.id,
      safeLaneId: run.planCommitment.m4Plan.recovery.safeLaneId,
    });
    return true;
  }
  run.m4.cursor += 1;
  const nextCard = activeM4Card(run);
  if (nextCard) {
    emit(run, "M4_CARD_DECLINED", {
      cardId: card.id,
      nextCardId: nextCard.id,
      m4PlanId: run.planCommitment.m4Plan.id,
    });
    emit(run, "M4_CARD_AVAILABLE", {
      cardId: nextCard.id,
      m4PlanId: run.planCommitment.m4Plan.id,
      inventory: run.m4.inventory.slice(run.m4.cursor),
    });
    return true;
  }
  run.m4.status = "FALLBACK";
  run.m4.fallbackReason = run.planCommitment.m4Plan.fallback.reason;
  emit(run, "M4_FALLBACK", {
    m4PlanId: run.planCommitment.m4Plan.id,
    fallbackId: run.planCommitment.m4Plan.fallback.id,
    reason: run.m4.fallbackReason,
    safeLaneId: run.planCommitment.m4Plan.fallback.safeLaneId,
    objectiveId: run.planCommitment.m4Plan.fallback.objectiveId,
  });
  return true;
}

function updateM4Recovery(run) {
  if (run.m4.status !== "RECOVERY_PENDING"
      || run.objectives.phase !== run.planCommitment.m4Plan.recovery.checkpointObjectiveId) return;
  run.m4.status = "RECOVERED";
  run.m4.recoveredAt = run.tick;
  emit(run, "M4_RECOVERY_CHECKPOINT", {
    cardId: run.m4.selectedCardId,
    m4PlanId: run.planCommitment.m4Plan.id,
    recoveryId: run.planCommitment.m4Plan.recovery.id,
    safeLaneId: run.planCommitment.m4Plan.recovery.safeLaneId,
    objectiveId: run.planCommitment.m4Plan.recovery.checkpointObjectiveId,
  });
}

function processInput(run, input) {
  let accepted = false;
  let rejectionReason = "INPUT_NOT_ACCEPTED";
  if (["MOVE", "ATTACK", "SKILL_CAST", "SKILL_SELECTED", "GROWTH_OFFER_SELECTED", "EXTRACT_ELITE"].includes(input.type)) run.commander.engaged = true;
  if (input.type === "MOVE") {
    const direction = typeof input.payload === "string" ? input.payload : input.payload?.octant;
    if (OCTANT_VECTORS[direction]) {
      run.commander.move = direction;
      accepted = true;
    } else rejectionReason = "INVALID_DIRECTION";
  } else if (input.type === "ATTACK") {
    // Inputs are processed before the per-tick cooldown decrement. Allowing one remaining
    // tick keeps the manual verb reachable without racing the automatic-fire loop; the +1
    // reservation below consumes that decrement and prevents a same-tick double shot.
    if (run.commander.basicCooldown > 1) rejectionReason = "BASIC_ATTACK_ON_COOLDOWN";
    else if (commanderBasicAttack(run, "manual")) {
      run.commander.basicCooldown = (run.commander.basicTicks || COMMANDER.basicCooldown) + 1;
      accepted = true;
    } else rejectionReason = "BASIC_ATTACK_NO_TARGET";
  } else if (input.type === "STANCE_CYCLE") {
    if (run.tick >= (run.stanceCooldownUntilTick ?? 0)) {
      const currentStance = FORMATION_STANCES.includes(run.formationStance) ? run.formationStance : "VANGUARD";
      const nextIndex = (FORMATION_STANCES.indexOf(currentStance) + 1) % FORMATION_STANCES.length;
      run.formationStance = FORMATION_STANCES[nextIndex];
      run.stanceCooldownUntilTick = run.tick + 4 * TICK_RATE;
      accepted = true;
      emit(run, "STANCE_SWITCHED", { stance: run.formationStance, atTick: run.tick });
    } else {
      rejectionReason = "STANCE_ON_COOLDOWN";
      emit(run, "STANCE_SWITCH_BLOCKED", { stance: run.formationStance, remainingTicks: run.stanceCooldownUntilTick - run.tick });
    }
  } else if (input.type === "SKILL_SELECTED" || input.type === "GROWTH_OFFER_SELECTED") {
    accepted = applySkill(run, input.payload?.skillId || input.payload);
    rejectionReason = "GROWTH_OFFER_SELECTION_UNAVAILABLE";
  } else if (input.type === "SKILL_CAST") {
    accepted = castSkill(run, input.payload?.skillId || input.payload);
    rejectionReason = "SKILL_NOT_READY_OR_UNAVAILABLE";
  } else if (input.type === "RETRY_OBJECTIVE") {
    const encounter = ensureEncounterState(run);
    accepted = beginEncounterRecovery(run, "PLAYER_RETRY");
    rejectionReason = encounter.status === "RECOVERY"
      ? "ENCOUNTER_RECOVERY_ACTIVE"
      : encounter.status === "COMPLETE"
        ? "ENCOUNTER_ROUTE_COMPLETE"
        : "ENCOUNTER_RETRY_LIMIT_REACHED";
  } else if (input.type === "REWARD_SELECTED") {
    const rewardId = input.payload?.rewardId || input.payload;
    if (!run.measurementProfile && run.rewardOffer?.choices.includes(rewardId) && REWARDS[rewardId]) {
      accepted = applyReward(run, rewardId);
    } else rejectionReason = "REWARD_SELECTION_UNAVAILABLE";
  } else if (input.type === "M4_CARD_DECISION") {
    accepted = processM4Decision(run, input.payload);
    rejectionReason = "M4_CARD_DECISION_INVALID";
  } else if (input.type === "M3_TARGET_PROBE") {
    const phase = input.payload?.phase;
    const target = orderedTargets(run, run.commander, COMMANDER.basicRange)[0] || null;
    if (phase === "LOSS" || phase === "REACQUIRE") {
      emit(run, phase === "LOSS" ? "M3_TARGET_LOSS" : "M3_TARGET_REACQUIRED", {
        probeId: input.payload?.probeId ?? null,
        targetId: target?.id ?? null,
        targetSpawnEventId: target?.spawnEventId ?? null,
        targetAvailable: Boolean(target),
        simTick: run.tick,
      });
      accepted = true;
    } else rejectionReason = "M3_TARGET_PROBE_INVALID";
  } else if (input.type === "EXTRACT_ELITE") {
    const candidate = run.eliteCandidate;
    const enemyId = input.payload?.enemyId || input.payload;
    const extractionReady = Boolean(run.extractionProgress.completed && run.extractionProgress.ready);
    if (!run.extracted && candidate && candidate.enemyId === enemyId && (candidate.expiresAt === null || run.tick <= candidate.expiresAt) && extractionReady) {
      run.extracted = true;
      run.progress.extracted += 1;
      addCompanion(run, candidate.prototype);
      emit(run, "ELITE_EXTRACTED", {
        eliteId: candidate.eliteId,
        entityId: enemyId,
        prototype: candidate.prototype,
        companionId: candidate.prototype,
        objectiveId: "echo-recovery",
        extractionPointId: run.extractionProgress.id,
        cue: eventCue("eliteExtracted"),
      });
      accepted = true;
    } else {
      const routeStarted = Boolean(candidate && candidate.enemyId === enemyId && (candidate.expiresAt === null || run.tick <= candidate.expiresAt) && !extractionReady);
      if (routeStarted) run.commander.objectiveRoute = true;
      rejectionReason = run.extracted ? "ELITE_ALREADY_EXTRACTED" : !candidate ? "NO_ECHO_CANDIDATE" : !extractionReady ? "EXTRACTION_HOLD_INCOMPLETE" : "WINDOW_EXPIRED";
      emit(run, "EXTRACTION_REJECTED", {
        entityId: enemyId || null,
        objectiveId: "extraction",
        extractionPointId: run.extractionProgress.id,
        reason: rejectionReason,
        routeStarted,
      });
    }
  } else rejectionReason = "INPUT_TYPE_UNSUPPORTED";
  emit(run, accepted ? "INPUT_ACCEPTED" : "INPUT_REJECTED", {
    inputId: input.inputId ?? null,
    inputType: input.type,
    atTick: run.tick,
    reason: accepted ? null : rejectionReason,
  });
  return accepted;
}

function resolveDeaths(run) {
  const dead = run.enemies.filter((entry) => entry.hp <= 0).sort((a, b) => a.id.localeCompare(b.id));
  if (!dead.length) return;
  run.enemies = run.enemies.filter((entry) => entry.hp > 0);
  run.progress.defeated += dead.length;
  dead.forEach((entry) => {
    const echo = actor(nextId(run, "pickup"), "pickup", entry.x, entry.y, 1, 1, { kind: "echo", xp: entry.xp, elevation: entry.elevation || 0 });
    placeOnTerrain(run, echo, echo);
    run.pickups.push(echo);
    const killEvent = emit(run, "ENEMY_DEFEATED", {
      enemyId: entry.id,
      midboss: Boolean(entry.midboss),
      midbossId: entry.midbossId || null,
      spawnEventId: entry.spawnEventId || null,
      castInstanceId: entry.lastCastInstanceId || null,
      causalRootId: entry.lastCausalRootId || null,
      cue: eventCue("enemyDefeated"),
    });
    killEvent.killEventId = killEvent.eventId;
    entry.killEventId = killEvent.eventId;
    if (entry.elite) {
      const itemId = run.measurementProfile ? null : (STAGE_ITEM_IDS[run.stage.id] || null);
      if (!run.measurementProfile) {
        const item = actor(nextId(run, "item"), "item", entry.x + 240, entry.y, 1, 1, { kind: "item", itemId, xp: 0 });
        placeOnTerrain(run, item, item);
        run.pickups.push(item);
      }
      run.eliteCandidate = {
        enemyId: entry.id,
        eliteId: entry.stageEliteId,
        prototype: run.stage.eliteCompanion,
        defeatedAt: run.tick,
        expiresAt: null,
      };
      run.extractionProgress.availableAt = run.tick;
      run.extractionProgress.expiresAt = null;
      run.objectives.echoRecovery.completed = true;
      run.objectives.echoRecovery.completedAt = run.tick;
      emit(run, "ELITE_CANDIDATE_AVAILABLE", {
        enemyId: entry.id,
        eliteId: entry.stageEliteId,
        prototype: run.stage.eliteCompanion,
        itemId,
        expiresAt: run.eliteCandidate.expiresAt,
        objectiveId: "echo-recovery",
        cutscene: stageCutscene(run.stage).elite,
      });
      const escorts = run.enemies.filter((enemy) =>
        enemy.policyId === "elite-escort" && enemy.encounterObjectiveId === "echo-recovery");
      if (escorts.length) {
        const escortIds = new Set(escorts.map((enemy) => enemy.id));
        run.enemies = run.enemies.filter((enemy) => !escortIds.has(enemy.id));
        escorts.forEach((enemy) => emit(run, "ESCORT_RETREATED", {
          entityId: enemy.id,
          leaderId: entry.id,
          policyId: enemy.policyId,
          objectiveId: "echo-recovery",
        }));
      }
      emit(run, "OBJECTIVE_COMPLETED", { objectiveId: "echo-recovery" });
    }
  });
  if (run.wardenState?.runtime?.chainReaction) {
    run.wardenState.chainReactionStacks = Math.min(run.wardenState.runtime.chainReaction.maxStacks, run.wardenState.chainReactionStacks + dead.length);
  }
}

function getTargetPosition(run, enemy) {
  while (enemy.waypointIndex < enemy.route.length) {
    const waypoint = enemy.route[enemy.waypointIndex];
    const reachRadius = Math.max(1, waypoint.radius || 400);
    if (distanceSquared(enemy, waypoint) > reachRadius * reachRadius) return waypoint;
    if (waypoint.contest) {
      if (enemy.routeContestWaypointId !== waypoint.id) {
        const objective = encounterRouteFor(run)?.objectives?.find(({ id }) => id === enemy.encounterObjectiveId);
        const contestTicks = Math.max(1, waypoint.contestTicks || objective?.contestTicks || 60);
        enemy.routeContestWaypointId = waypoint.id;
        enemy.routeContestedAt = run.tick;
        enemy.routeReleaseAt = run.tick + contestTicks;
        const objectiveState = run.encounter?.objectives?.[enemy.encounterObjectiveId];
        if (objectiveState && objectiveState.contestedAt == null) objectiveState.contestedAt = run.tick;
        emit(run, "ENCOUNTER_PATH_CONTESTED", {
          entityId: enemy.id,
          routeId: enemy.routeId,
          waypointId: waypoint.id,
          objectiveId: enemy.encounterObjectiveId,
          releaseAt: enemy.routeReleaseAt,
          telegraphTicks: contestTicks,
        });
      }
      if (run.tick < enemy.routeReleaseAt) return waypoint;
    }
    enemy.waypointIndex += 1;
  }

  if (enemy.policyId === "player-pursuit") return playerSideTarget(run, enemy);
  if (enemy.policyId === "resource-denial") {
    const echoes = run.pickups.filter((pickup) => pickup.kind === "echo").sort((a, b) => {
      const delta = distanceSquared(enemy, a) - distanceSquared(enemy, b);
      return delta || a.id.localeCompare(b.id);
    });
    return echoes[0] || run.commander;
  }
  if (enemy.policyId === "elite-escort") {
    const leader = sortedActors(run.enemies).find((entry) => entry.hp > 0 && entry.id !== enemy.id && (entry.elite || entry.class === "boss"));
    if (leader) {
      if (enemy.escortLeaderId !== leader.id) {
        enemy.escortLeaderId = leader.id;
        emit(run, "ESCORT_LEADER_ACQUIRED", {
          entityId: enemy.id,
          leaderId: leader.id,
          policyId: enemy.policyId,
          objectiveId: run.objectives.phase,
        });
      }
      return { x: Math.max(0, leader.x - 500), y: leader.y };
    }
    enemy.escortLeaderId = null;
    return run.gate;
  }
  if (enemy.policyId === "low-hp-focus") {
    const gateRatio = run.gate.integrity / run.gate.maxIntegrity;
    const commanderRatio = run.commander.integrity / run.commander.maxIntegrity;
    return commanderRatio < gateRatio ? playerSideTarget(run, enemy) : run.gate;
  }
  if (enemy.policyId === "flank") {
    return distanceSquared(enemy, run.commander) < distanceSquared(enemy, run.gate) ? playerSideTarget(run, enemy) : run.gate;
  }
  return run.gate;
}

function pressureTarget(run, enemy) {
  if (enemy.policyId === "player-pursuit" || enemy.policyId === "resource-denial") return playerSideTarget(run, enemy);
  if (enemy.policyId === "low-hp-focus" || enemy.policyId === "flank") {
    return distanceSquared(enemy, run.commander) < distanceSquared(enemy, run.gate) ? playerSideTarget(run, enemy) : run.gate;
  }
  return run.gate;
}

function refreshAttackerCommitment(run) {
  const encounter = ensureEncounterState(run);
  const candidates = run.enemies
    .filter((enemy) => {
      if (enemy.hp <= 0 || (enemy.policyId === "elite-escort" && enemy.escortLeaderId)) return false;
      if (enemy.class === "boss" && run.tick < run.bossSpawnedAt + BOSS_PRESSURE_GRACE_TICKS) return false;
      const target = pressureTarget(run, enemy);
      const attackRange = enemy.projectileRange > 0
        ? enemy.projectileRange
        : enemy.radius + (target.radius || 0);
      const approachStep = Math.max(1, Math.trunc(enemy.speed / TICK_RATE));
      return distanceSquared(enemy, target) <= (attackRange + approachStep) ** 2;
    })
    .sort((left, right) => {
      const distanceDelta = distanceSquared(left, pressureTarget(run, left))
        - distanceSquared(right, pressureTarget(run, right));
      return distanceDelta || left.id.localeCompare(right.id);
    });
  const nextIds = candidates.slice(0, encounter.commitmentCap).map(({ id }) => id);
  const changed = nextIds.length !== encounter.committedAttackerIds.length
    || nextIds.some((id, index) => encounter.committedAttackerIds[index] !== id);
  encounter.committedAttackerIds = nextIds;
  encounter.committedAttackerCount = nextIds.length;
  if (changed) {
    emit(run, "ATTACKER_COMMITMENT_CHANGED", {
      objectiveId: encounter.objectiveId || run.objectives.phase,
      committedAttackerIds: [...nextIds],
      committedAttackerCount: nextIds.length,
      commitmentCap: encounter.commitmentCap,
    });
  }
}

/**
 * Semantic monster state (build-game-monster-system: the MonsterRuntime -> MonsterViewAdapter seam).
 *
 * The runtime already knows everything needed to name what a body is doing; before this it was
 * scattered across `attackWindup`, `attackCooldown`, route commitment and raw positions, so the
 * view layer had to guess. This publishes ONE authoritative state per body, derived only from
 * simulation data. It never decides damage: contact is still authored by the attack path.
 *
 * `defeated` is produced only for a body still in the array with no health; resolveDeaths()
 * removes it in the same tick and announces it with ENEMY_DEFEATED.
 */
export const MONSTER_STATES = freeze([
  "idle", "investigate", "pursue", "reposition", "windup", "attack", "recover", "stagger", "defeated",
]);

/** Ticks a body keeps reading as staggered after taking a hit. */
const MONSTER_STAGGER_TICKS = 18;

function monsterState(run, enemy, { moved, contactRange, targetDistance }) {
  if (enemy.hp <= 0) return "defeated";
  if (enemy.lastStrikeTick === run.tick) return "attack";
  if (enemy.attackWindup) return "windup";
  if (Number.isInteger(enemy.lastDamagedTick) && run.tick - enemy.lastDamagedTick < MONSTER_STAGGER_TICKS) return "stagger";
  if (enemy.attackCooldown > 0 && targetDistance <= contactRange) return "recover";
  if (moved) {
    return enemy.route?.length && enemy.waypointIndex < enemy.route.length - 1 ? "reposition" : "pursue";
  }
  return targetDistance <= contactRange ? "idle" : "investigate";
}

function moveEnemies(run) {
  const breachedIds = new Set();
  const chokepath = run.tactics?.chokepath;
  refreshAttackerCommitment(run);
  const committedIds = new Set(run.encounter.committedAttackerIds);

  run.enemies.forEach((enemy) => {
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= 1;
    if (enemy.rangedCooldown > 0) enemy.rangedCooldown -= 1;

    const commitmentTarget = pressureTarget(run, enemy);
    const commitmentRange = enemy.projectileRange > 0
      ? enemy.projectileRange
      : enemy.radius + (commitmentTarget.radius || 0);
    const approachStep = Math.max(1, Math.trunc(enemy.speed / TICK_RATE));
    const waitingForCommitment = !committedIds.has(enemy.id)
      && distanceSquared(enemy, commitmentTarget) <= (commitmentRange + approachStep) ** 2;
    let speed = waitingForCommitment || (enemy.class === "boss" && enemy.attackWindup) ? 0 : enemy.speed;
    if (chokepath && Math.abs(enemy.x - chokepath.x) <= chokepath.halfWidth) speed = Math.trunc(speed * 0.85);

    const targetPosition = getTargetPosition(run, enemy);
    const from = { x: enemy.x, y: enemy.y };
    const dx = targetPosition.x - enemy.x;
    const dy = targetPosition.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && speed > 0) {
      const movement = Math.min(Math.max(1, Math.trunc(speed / TICK_RATE)), distance);
      moveOnTerrain(run, enemy, {
        x: Math.round(enemy.x + dx / distance * movement),
        y: Math.round(enemy.y + dy / distance * movement),
      });
    }
    enemy.movedThisTick = enemy.x !== from.x || enemy.y !== from.y;
    if (enemy.movedThisTick) {
      emit(run, "MOVE", {
        entityId: enemy.id,
        from,
        to: { x: enemy.x, y: enemy.y },
        policyId: enemy.policyId,
        intent: enemy.policyIntent,
        waypointId: enemy.route[enemy.waypointIndex]?.id || null,
      });
    }

    if (enemy.policyId === "resource-denial") {
      const denialRange = Math.max(enemy.radius + 150, enemy.projectileRange || 0);
      const denied = run.pickups.find((pickup) => pickup.kind === "echo"
        && distanceSquared(enemy, pickup) <= denialRange ** 2);
      if (denied && (denied.deniedUntil || -1) < run.tick) {
        denied.deniedUntil = run.tick + 60;
        denied.deniedBy = enemy.id;
        run.progress.echoDenied += denied.xp;
        const denial = {
          entityId: enemy.id,
          enemyId: enemy.id,
          pickupId: denied.id,
          deniedXp: denied.xp,
          policyId: enemy.policyId,
          objectiveId: "echo-recovery",
          deniedUntil: denied.deniedUntil,
        };
        emit(run, "PICKUP_DENIED", denial);
        emit(run, "ECHO_DENIED", denial);
      }
    }

    if (enemy.policyId === "elite-escort" && enemy.escortLeaderId) return;
    const target = pressureTarget(run, enemy);
    const targetDistance = Math.sqrt(distanceSquared(enemy, target));
    const attackRange = enemy.projectileRange > 0
      ? enemy.projectileRange
      : enemy.radius + (target.radius || 0);
    if (targetDistance <= attackRange && !committedIds.has(enemy.id)) return;
    const pressureReleaseTick = run.objectives.phase === "echo-recovery"
      ? run.objectives.gateDefense.completedAt + ECHO_RECOVERY_PRESSURE_GRACE_TICKS
      : run.stage.gateTicks - (GATE_PRESSURE_RELEASE_LEAD[enemy.policyId] || 0);
    const commanderPressureDelayed = run.commander.engaged
      && target.id === "commander"
      && (run.objectives.phase === "gate-defense" || run.objectives.phase === "echo-recovery")
      && run.tick < pressureReleaseTick;
    if (commanderPressureDelayed) {
      const rangedReady = enemy.projectileRange > 0
        && targetDistance <= enemy.projectileRange
        && enemy.rangedCooldown <= 0;
      const contactReady = targetDistance <= enemy.radius + (target.radius || 0)
        && enemy.attackCooldown <= 0;
      if (rangedReady || contactReady) {
        if (rangedReady) enemy.rangedCooldown = enemy.projectileTicks;
        else enemy.attackCooldown = enemy.attackTicks;
        emit(run, "ENEMY_PRESSURE_DELAYED", {
          entityId: enemy.id,
          targetId: target.id,
          policyId: enemy.policyId,
          objectiveId: run.objectives.phase,
          releaseTick: pressureReleaseTick,
        });
      }
      return;
    }
    if (enemy.class === "boss" && run.tick < run.bossSpawnedAt + BOSS_PRESSURE_GRACE_TICKS) return;
    if (enemy.projectileRange > 0 && targetDistance <= enemy.projectileRange && enemy.rangedCooldown <= 0) {
      const damage = target.id === "gate" ? Math.max(1, enemy.damage - Math.trunc(run.gateDamageReduction / 2)) : (target.id === "commander" ? Math.round(enemy.damage * run.commander.incomingDamageMultiplier) : enemy.damage);
      fire(run, enemy, target, damage, enemy.id, Math.max(1, Math.trunc(enemy.projectileTicks / 12)));
      enemy.rangedCooldown = enemy.projectileTicks;
      return;
    }

    // Telegraph -> active -> recovery, for EVERY body that carries a pattern.
    //
    // The boss already worked this way; the authored patterns give trash and elites the same
    // three-phase shape, so a wide swing is announced before it lands and the AI response
    // patterns have something to answer. A body with no authored telegraph (telegraphTicks 0)
    // keeps the original immediate-contact cadence.
    const contactRange = enemy.radius + (target.radius || 0);
    const bossBody = enemy.class === "boss";
    if (enemy.attackWindup) {
      if (enemy.attackCooldown > 0) return;
      if (targetDistance > contactRange) {
        enemy.attackWindup = false;
        emit(run, bossBody ? "BOSS_ATTACK_CANCELLED" : "ENEMY_ATTACK_CANCELLED", {
          entityId: enemy.id,
          targetId: target.id,
          policyId: enemy.policyId,
          patternId: enemy.patternId ?? null,
          stepId: enemy.patternStepId ?? null,
          actionId: enemy.patternActionId ?? null,
        });
        return;
      }
    } else {
      if (targetDistance > contactRange || enemy.attackCooldown > 0) return;
      // The authored pattern preset decides what THIS strike is: its disc, its damage weight,
      // its tell length and whether it leaves a field. Two consecutive slams from one body
      // therefore read as two different attacks instead of one repeated animation.
      const sample = samplePattern(enemy.patternId, bossBody ? run.tick - (run.bossSpawnedAt ?? 0) : run.tick);
      const telegraphTicks = bossBody ? enemy.attackTicks : (sample?.step?.telegraphTicks ?? 0);
      if (telegraphTicks > 0) {
        enemy.attackWindup = true;
        enemy.attackCooldown = telegraphTicks;
        enemy.patternStepId = sample?.stepId ?? null;
        enemy.patternActionId = sample?.actionId ?? null;
        const telegraphRadius = sample?.step?.radius ?? areaSourceProfile(bossBody ? "boss" : "enemy").radius;
        emit(run, bossBody ? "BOSS_ATTACK_TELEGRAPHED" : "ENEMY_ATTACK_TELEGRAPHED", {
          entityId: enemy.id,
          targetId: target.id,
          policyId: enemy.policyId,
          windupTicks: telegraphTicks,
          patternId: sample?.patternId ?? null,
          stepId: sample?.stepId ?? null,
          actionId: sample?.actionId ?? null,
          phase: "telegraph",
          shape: sample?.step?.shape ?? "disc",
          element: elementOf(sample?.step?.element ?? enemy.element),
          radius: telegraphRadius,
          originX: enemy.x,
          originY: enemy.y,
        });
        // AI response: the covered player-side bodies decide to evade, scatter or brace.
        applyTelegraphResponse(run, enemy, enemy, telegraphRadius);
        return;
      }
    }
    let commanderDamage = 0;
    let gateDamage = 0;
    let companionDamage = 0;
    if (target.id === "gate") {
      gateDamage = Math.max(0, enemy.damage - run.gateDamageReduction);
    } else if (target.kind === "companion") {
      companionDamage = enemy.damage;
    } else {
      commanderDamage = enemy.damage;
      const guardingGate = (run.objectives.phase === "gate-defense" || run.extracted)
        && distanceSquared(run.commander, run.gate) <= (run.gate.radius + COMMANDER.basicRange) ** 2;
      if (guardingGate) {
        const commanderRatio = run.commander.integrity / run.commander.maxIntegrity;
        const gateRatio = run.gate.integrity / run.gate.maxIntegrity;
        if (gateRatio > commanderRatio) {
          gateDamage = Math.max(0, commanderDamage - run.gateDamageReduction);
          commanderDamage = 0;
        }
      }
    }
    const damage = target.id === "gate" ? gateDamage : (target.kind === "companion" ? companionDamage : Math.round(commanderDamage * run.commander.incomingDamageMultiplier));
    const bossStrike = bossBody;
    const patternSample = bossStrike
      ? samplePattern(enemy.patternId, run.tick - (run.bossSpawnedAt ?? 0))
      : samplePattern(enemy.patternId, run.tick);
    const patternStep = patternSample?.step ?? null;
    enemy.attackWindup = false;
    enemy.lastStrikeTick = run.tick;
    if (!bossStrike) enemy.attackCooldown = enemy.attackTicks;
    emit(run, "ENEMY_ATTACK", {
      entityId: enemy.id,
      targetId: target.id,
      damage,
      policyId: enemy.policyId,
      intent: enemy.policyIntent,
      patternId: patternSample?.patternId ?? null,
      stepId: patternSample?.stepId ?? null,
      actionId: patternSample?.actionId ?? null,
      phase: "active",
      element: elementOf(patternStep?.element ?? enemy.element),
      radius: patternStep?.radius ?? areaSourceProfile(bossStrike ? "boss" : "enemy").radius,
    });
    // 광역: every enemy strike is a disc on the player side. The primary target is excluded —
    // it is damaged by the authored branch below — so the splash is exactly "who else was
    // standing close enough".
    const strikeSourceKey = bossStrike ? "boss" : "enemy";
    const strikeProfile = areaSourceProfile(strikeSourceKey);
    const strikeDamage = Math.max(0, Math.trunc(enemy.damage * (patternStep?.damageBp ?? AREA_BP) / AREA_BP));
    resolveAreaImpact(run, {
      origin: patternStep?.shape === "lead" ? { x: target.x ?? enemy.x, y: target.y ?? enemy.y } : enemy,
      faction: "enemy",
      sourceId: enemy.id,
      sourceKey: strikeSourceKey,
      damage: strikeDamage,
      element: patternStep?.element ?? enemy.element,
      radius: patternStep?.radius ?? strikeProfile.radius,
      weightBp: patternStep?.weightBp ?? strikeProfile.weightBp,
      excludeIds: [target.id],
    });
    const fieldTicks = patternStep?.fieldTicks ?? (bossStrike ? strikeProfile.fieldTicks : 0);
    if (fieldTicks > 0) {
      spawnAreaField(run, {
        origin: patternStep?.shape === "lead" ? { x: target.x ?? enemy.x, y: target.y ?? enemy.y } : enemy,
        faction: "enemy",
        sourceId: enemy.id,
        sourceKey: strikeSourceKey,
        damage: strikeDamage,
        element: patternStep?.element ?? enemy.element,
        radius: patternStep?.radius ?? strikeProfile.radius,
        weightBp: patternStep?.weightBp ?? strikeProfile.weightBp,
        durationTicks: fieldTicks,
      });
    }
    if (bossStrike) {
      // The recovery phase of a heavy attack is the answer window: allied fire speeds up
      // inside it (AI_RESPONSE_PATTERNS.punish), which is what makes a telegraph a trade.
      run.punishWindowUntilTick = run.tick + (patternStep?.recoveryTicks ?? AI_RESPONSE_PATTERNS.punish.windowTicks);
      emit(run, "AI_RESPONSE_APPLIED", {
        entityId: enemy.id,
        responsePatterns: ["punish"],
        windowUntilTick: run.punishWindowUntilTick,
        cooldownScaleBp: AI_RESPONSE_PATTERNS.punish.cooldownScaleBp,
        simTick: run.tick,
      });
    }
    if (target.id === "gate") {
      run.gate.integrity = clamp(run.gate.integrity - damage, 0, run.gate.maxIntegrity);
      emit(run, "GATE_BREACHED", { enemyId: enemy.id, damage, policyId: enemy.policyId });
      if (enemy.class !== "boss" && !enemy.elite) breachedIds.add(enemy.id);
    } else if (target.kind === "companion" && target.status !== "DOWNED") {
      target.hp = clamp(target.hp - damage, 0, target.maxHp);
      emit(run, "COMPANION_DAMAGED", { enemyId: enemy.id, entityId: target.id, companionId: target.companionId, damage, hp: target.hp, maxHp: target.maxHp, policyId: enemy.policyId });
      if (target.hp <= 0 && target.status === "ACTIVE") {
        target.status = "DOWNED";
        emit(run, "COMPANION_DOWNED", { entityId: target.id, companionId: target.companionId, policyId: enemy.policyId });
      }
    } else {
      run.commander.integrity = clamp(run.commander.integrity - damage, 0, run.commander.maxIntegrity);
      emit(run, "COMMANDER_DAMAGED", {
        enemyId: enemy.id,
        damage,
        hp: run.commander.integrity,
        maxHp: run.commander.maxIntegrity,
        policyId: enemy.policyId,
      });
      applyWardenDamageResponse(run);
      if (gateDamage > 0) {
        run.gate.integrity = clamp(run.gate.integrity - gateDamage, 0, run.gate.maxIntegrity);
        emit(run, "GATE_BREACHED", {
          enemyId: enemy.id,
          damage: gateDamage,
          policyId: enemy.policyId,
          objectiveId: "gate-defense",
          interceptedFor: "commander",
        });
      }
    }
  });

  if (breachedIds.size) run.enemies = run.enemies.filter((enemy) => !breachedIds.has(enemy.id));

  // One authoritative semantic state per body, published after every body has finished its pass
  // so a windup entered or a strike resolved THIS tick is what the snapshot reports.
  for (const enemy of run.enemies) {
    const target = pressureTarget(run, enemy);
    enemy.state = monsterState(run, enemy, {
      moved: enemy.movedThisTick === true,
      contactRange: enemy.radius + (target.radius || 0),
      targetDistance: Math.sqrt(distanceSquared(enemy, target)),
    });
  }
}

/** Opens extraction only after the occupation has been secured and its boss guardian is defeated. */
function openExtractionWindow(run, tactics) {
  if (!run.occupationProgress.captured || !run.objectives.bossKill.completed || !run.eliteCandidate) return;
  if (run.extractionProgress.expiresAt !== null) return;
  const windowTicks = tactics.extraction?.windowTicks || 600;
  run.extractionProgress.expiresAt = run.tick + windowTicks;
  run.eliteCandidate.expiresAt = run.extractionProgress.expiresAt;
  emit(run, "EXTRACTION_WINDOW_OPENED", {
    stageId: run.stage.id,
    objectiveId: "extraction",
    extractionPointId: tactics.extraction?.id || null,
    expiresAt: run.extractionProgress.expiresAt,
    windowTicks,
  });
}

function updateObjectivePhase(run) {
  const objectives = run.objectives;
  if (!objectives.gateDefense.completed
      && run.tick >= run.stage.gateTicks
      && run.waveIndex >= run.waveSchedule.length
      && ensureEncounterState(run).status === "COMPLETE"
      && !run.encounter.spawnQueue.length
      && !run.enemies.some((enemy) => !enemy.elite && enemy.class !== "boss")) {
    objectives.gateDefense.completed = true;
    objectives.gateDefense.completedAt = run.tick;
    emit(run, "OBJECTIVE_COMPLETED", { objectiveId: "gate-defense" });
  }
  if (!objectives.growth.completed && run.progress.skillsLearned > 0) {
    objectives.growth.completed = true;
    objectives.growth.completedAt = run.tick;
    emit(run, "OBJECTIVE_COMPLETED", { objectiveId: "growth" });
  }
  objectives.occupation.completed = run.occupationProgress.captured;
  objectives.extraction.completed = run.extracted;
  const ordered = [
    ["gate-defense", objectives.gateDefense],
    ["echo-recovery", objectives.echoRecovery],
    ["growth", objectives.growth],
    ["occupation", objectives.occupation],
    ["boss-kill", objectives.bossKill],
    ["extraction", objectives.extraction],
  ];
  const nextPhase = ordered.find(([, objective]) => !objective.completed)?.[0] || "complete";
  if (nextPhase !== objectives.phase) {
    const previousPhase = objectives.phase;
    objectives.phase = nextPhase;
    emit(run, "OBJECTIVE_PHASE_CHANGED", { objectiveId: nextPhase, previousObjectiveId: previousPhase });
    run.objectivePressure.phase = nextPhase;
    run.objectivePressure.phaseStartedAt = run.tick;
  }
  updateM4Recovery(run);
}

function applyFixedRate(run, key, ratePerSecond) {
  run.terrainRemainders[key] = (run.terrainRemainders[key] || 0) + Math.max(0, ratePerSecond || 0);
  const value = Math.trunc(run.terrainRemainders[key] / TICK_RATE);
  run.terrainRemainders[key] %= TICK_RATE;
  return value;
}
/**
 * Wave-clear recovery (long-stage sustain, run-id 20260728-stage-playtime-doctrine).
 *
 * A 3-6 minute hold is an attrition problem: with no sustain the commander is chipped to zero long
 * before the last wave, which is exactly what the pre-doctrine 30-45 s stages never had to answer.
 * Clearing a wave's spawns before the next wave lands is the authored breathing beat, and it pays
 * back a fixed fraction of BOTH bars. It fires at most once per scheduled wave, only while the
 * gate-defense hold is live, so it can never be farmed after the hold closes.
 */
const WAVE_CLEAR_COMMANDER_RECOVERY_BP = 800;
const WAVE_CLEAR_GATE_RECOVERY_BP = 500;
function processWaveClearRecovery(run) {
  if (run.objectives.gateDefense.completed) return;
  if (run.waveIndex <= run.waveClearIndex || run.waveIndex === 0) return;
  if (ensureEncounterState(run).spawnQueue.length) return;
  if (run.enemies.some((enemy) => enemy.hp > 0 && !enemy.elite && enemy.class !== "boss")) return;
  run.waveClearIndex = run.waveIndex;
  const waveIndex = run.waveClearIndex - 1;
  const recovery = grantEncounterRecovery(
    run,
    `wave:${waveIndex}`,
    { commanderBp: WAVE_CLEAR_COMMANDER_RECOVERY_BP, gateBp: WAVE_CLEAR_GATE_RECOVERY_BP },
    { objectiveId: run.waveSchedule[waveIndex]?.objectiveId || "gate-defense", rewardType: "wave-recovery", waveIndex },
  );
  if (!recovery) return;
  emit(run, "WAVE_CLEARED", {
    waveIndex,
    objectiveId: run.waveSchedule[waveIndex]?.objectiveId || "gate-defense",
    commanderRecovered: recovery.commanderGain,
    gateRecovered: recovery.gateGain,
    commanderIntegrity: run.commander.integrity,
    gateIntegrity: run.gate.integrity,
  });
}
function processObjectivePressure(run) {
  const pressure = run.objectivePressure;
  if (!pressure || run.objectives.phase === "complete" || ensureEncounterState(run).status === "RECOVERY") return;
  const elapsed = run.tick - pressure.phaseStartedAt;
  const grace = run.objectives.phase === "gate-defense"
    ? run.stage.gateTicks + OBJECTIVE_PRESSURE_GRACE_TICKS
    : OBJECTIVE_PRESSURE_GRACE_TICKS;
  if (elapsed >= grace
      && (elapsed - grace) % OBJECTIVE_PRESSURE_INTERVAL_TICKS === 0) {
    pressure.pulses += 1;
    const damage = Math.min(OBJECTIVE_PRESSURE_DAMAGE, run.gate.integrity);
    run.gate.integrity -= damage;
    emit(run, "OBJECTIVE_PRESSURE_PULSE", {
      objectiveId: run.objectives.phase,
      pulse: pressure.pulses,
      targetId: "gate",
      damage,
      deadlineTick: pressure.deadlineTick,
    });
  }
  if (run.tick >= pressure.deadlineTick && run.gate.integrity > 0) {
    pressure.pulses += 1;
    const damage = run.gate.integrity;
    run.gate.integrity = 0;
    emit(run, "OBJECTIVE_PRESSURE_DEADLINE", {
      objectiveId: run.objectives.phase,
      pulse: pressure.pulses,
      targetId: "gate",
      damage,
      deadlineTick: pressure.deadlineTick,
    });
  }
}
function processTerrainEffects(run) {
  const tactics = run.tactics;
  if (!tactics) return;
  updateObjectivePhase(run);

  if (tactics.hazard) {
    const hazard = tactics.hazard;
    const exposed = [run.commander, ...run.enemies].filter((entity) => distanceSquared(entity, hazard) <= hazard.radius ** 2);
    exposed.forEach((entity) => {
      const damage = applyFixedRate(run, `hazard:${entity.id}`, hazard.damagePerSecond);
      if (!damage) return;
      if (entity.id === "commander") {
        run.commander.integrity = clamp(run.commander.integrity - damage, 0, run.commander.maxIntegrity);
      } else entity.hp -= damage;
      emit(run, "HAZARD_DAMAGE", {
        entityId: entity.id,
        hazardId: hazard.id,
        damage,
        hp: entity.id === "commander" ? run.commander.integrity : entity.hp,
        maxHp: entity.id === "commander" ? run.commander.maxIntegrity : entity.maxHp,
      });
    });
  }

  const occupation = tactics.occupation;
  if (occupation && run.objectives.growth.completed) {
    const inZone = distanceSquared(run.commander, occupation) <= occupation.radius ** 2;
    const contested = run.enemies.some((enemy) => distanceSquared(enemy, occupation) <= occupation.radius ** 2);
    if (!run.occupationProgress.captured && run.objectives.phase === "occupation" && inZone && !contested) {
      run.occupationProgress.holdTicks = Math.min(run.occupationProgress.maxHoldTicks, run.occupationProgress.holdTicks + 1);
      if (run.occupationProgress.holdTicks % 60 === 0 && run.occupationProgress.holdTicks < run.occupationProgress.maxHoldTicks) {
        emit(run, "OCCUPATION_PROGRESS", {
          objectiveId: "occupation",
          occupationPointId: occupation.id,
          holdTicks: run.occupationProgress.holdTicks,
          maxHoldTicks: run.occupationProgress.maxHoldTicks,
          contested: false,
        });
      }
      if (run.occupationProgress.holdTicks >= run.occupationProgress.maxHoldTicks) {
        run.occupationProgress.captured = true;
        run.occupationProgress.capturedAt = run.tick;
        openExtractionWindow(run, tactics);
        emit(run, "OCCUPATION_CAPTURED", {
          objectiveId: "occupation",
          occupationPointId: occupation.id,
          effects: clone(occupation.effects || {}),
          cue: eventCue("occupationCaptured"),
        });
      }
    } else if (!run.occupationProgress.captured && run.occupationProgress.holdTicks > 0) {
      run.occupationProgress.holdTicks = 0;
      emit(run, "OCCUPATION_INTERRUPTED", {
        objectiveId: "occupation",
        occupationPointId: occupation.id,
        contested,
      });
    }

    if (inZone) {
      const recovery = applyFixedRate(run, "occupation-recovery", occupation.effects?.recoveryPerSecond || 0);
      if (recovery) {
        const previousCommander = run.commander.integrity;
        const previousGate = run.gate.integrity;
        const commanderBudget = Math.max(0, Math.trunc(run.commander.maxIntegrity * run.terrainRecovery.capRatio) - run.terrainRecovery.commander);
        const gateBudget = Math.max(0, Math.trunc(run.gate.maxIntegrity * run.terrainRecovery.capRatio) - run.terrainRecovery.gate);
        run.commander.integrity = clamp(run.commander.integrity + Math.min(recovery, commanderBudget), 0, run.commander.maxIntegrity);
        run.gate.integrity = clamp(run.gate.integrity + Math.min(recovery, gateBudget), 0, run.gate.maxIntegrity);
        const commanderRecovery = run.commander.integrity - previousCommander;
        const gateRecovery = run.gate.integrity - previousGate;
        run.terrainRecovery.commander += commanderRecovery;
        run.terrainRecovery.gate += gateRecovery;
        emit(run, "TERRAIN_RECOVERY", {
          objectiveId: "occupation",
          occupationPointId: occupation.id,
          recovery,
          commanderRecovery,
          gateRecovery,
          commanderTotal: run.terrainRecovery.commander,
          gateTotal: run.terrainRecovery.gate,
          capRatio: run.terrainRecovery.capRatio,
        });
      }
    }
  }

  // Extraction is the post-boss exit beat. The window may open only after boss-kill, regardless
  // of whether occupation or the Echo candidate was secured first.
  openExtractionWindow(run, tactics);
  const extraction = tactics.extraction;
  const extractionOpen = extraction
    && run.objectives.phase === "extraction"
    && run.objectives.bossKill.completed
    && run.extractionProgress.availableAt !== null
    && run.tick <= run.extractionProgress.expiresAt;
  if (extractionOpen && !run.extractionProgress.completed) {
    const inZone = distanceSquared(run.commander, extraction) <= extraction.radius ** 2;
    const contested = run.enemies.some((enemy) => distanceSquared(enemy, extraction) <= extraction.radius ** 2);
    if (inZone && !contested) {
      run.extractionProgress.holdTicks = Math.min(run.extractionProgress.maxHoldTicks, run.extractionProgress.holdTicks + 1);
      if (run.extractionProgress.holdTicks % 30 === 0 && run.extractionProgress.holdTicks < run.extractionProgress.maxHoldTicks) {
        emit(run, "EXTRACTION_PROGRESS", {
          objectiveId: "extraction",
          extractionPointId: extraction.id,
          holdTicks: run.extractionProgress.holdTicks,
          maxHoldTicks: run.extractionProgress.maxHoldTicks,
        });
      }
      if (run.extractionProgress.holdTicks >= run.extractionProgress.maxHoldTicks) {
        run.extractionProgress.completed = true;
        run.extractionProgress.ready = true;
        run.extractionProgress.completedAt = run.tick;
        run.commander.objectiveRoute = false;
        emit(run, "EXTRACTION_COMPLETED", {
          objectiveId: "extraction",
          extractionPointId: extraction.id,
          ready: true,
          cue: eventCue("extractionReady"),
        });
      }
    } else if (run.extractionProgress.holdTicks > 0) {
      run.extractionProgress.holdTicks = 0;
      emit(run, "EXTRACTION_INTERRUPTED", {
        objectiveId: "extraction",
        extractionPointId: extraction.id,
        contested,
      });
    }
  } else if (extraction && run.extractionProgress.availableAt !== null
      && run.extractionProgress.expiresAt !== null
      && run.tick > run.extractionProgress.expiresAt
      && !run.extractionProgress.completed
      && !run.extractionProgress.failed) {
    run.extractionProgress.failed = true;
    run.commander.objectiveRoute = false;
    emit(run, "OBJECTIVE_FAILED", { objectiveId: "extraction", extractionPointId: extraction.id });
  }
  updateObjectivePhase(run);
}

function tick(run) {
  run.tick += 1;
  run.events = [];
  while (run.inputs.length && run.inputs[0].at <= run.tick) processInput(run, run.inputs.shift());
  if (run.growthOffer) return;
  processEncounterRecovery(run);

  const commanderFrom = { x: run.commander.x, y: run.commander.y };
  const commanderSpeed = getCommanderSpeed(run);
  let moveDirection = run.commander.move;
  let routeTarget = null;
  if (run.commander.objectiveRoute && run.objectives.phase === "occupation") routeTarget = run.tactics.occupation;
  else if (run.commander.objectiveRoute && run.objectives.phase === "extraction") routeTarget = run.tactics.extraction;
  else if (run.extracted || run.extractionProgress.failed) run.commander.objectiveRoute = false;

  if (routeTarget) {
    const dx = routeTarget.x - run.commander.x;
    const dy = routeTarget.y - run.commander.y;
    const distance = Math.hypot(dx, dy);
    const holdRadius = Math.max(0, routeTarget.radius - 100);
    if (distance > holdRadius) {
      const movement = Math.min(Math.max(1, Math.trunc(commanderSpeed / TICK_RATE)), distance - holdRadius);
      moveOnTerrain(run, run.commander, {
        x: Math.round(run.commander.x + dx / distance * movement),
        y: Math.round(run.commander.y + dy / distance * movement),
      });
      moveDirection = "OBJECTIVE_ROUTE";
    }
  } else {
    const vector = OCTANT_VECTORS[run.commander.move];
    moveOnTerrain(run, run.commander, {
      x: run.commander.x + Math.trunc(vector.x * commanderSpeed / 1000 / TICK_RATE),
      y: run.commander.y + Math.trunc(vector.y * commanderSpeed / 1000 / TICK_RATE),
    });
  }
  if (run.commander.x !== commanderFrom.x || run.commander.y !== commanderFrom.y) {
    emit(run, "MOVE", {
      entityId: run.commander.id,
      from: commanderFrom,
      to: { x: run.commander.x, y: run.commander.y },
      direction: moveDirection,
      speed: commanderSpeed,
      objectiveId: routeTarget ? run.objectives.phase : null,
      cue: run.tick % 12 === 0 ? eventCue("movementStep") : null,
    });
  }

  Object.keys(run.commander.cooldowns).forEach((id) => {
    if (run.commander.cooldowns[id] > 0) {
      run.commander.cooldowns[id] -= 1;
      if (run.commander.cooldowns[id] === 0) {
        emit(run, "SKILL_COOLDOWN_READY", {
          skillId: id,
          readyTick: run.tick,
          simTick: run.tick,
        });
      }
    }
  });
  applyWardenVigilRegen(run);


  const encounter = ensureEncounterState(run);
  while (encounter.status === "ACTIVE"
      && run.waveIndex < run.waveSchedule.length
      && run.waveSchedule[run.waveIndex].at <= run.tick) {
    const wave = run.waveSchedule[run.waveIndex];
    if (wave.objectiveId && wave.objectiveId !== encounter.objectiveId) break;
    enqueueEncounterWave(run, wave);
    run.waveIndex += 1;
  }
  processEncounterSpawns(run);

  processTerrainEffects(run);
  if (!run.eliteSpawned && run.objectives.gateDefense.completed) {
    const elitePathId = encounterRouteFor(run)?.finale?.elitePathId || null;
    const depthPkg = Catalog.abyssDepthPackage(run.abyssDepth);
    const elite = spawnEnemy(run, run.stage.eliteKind, true, {
      policyId: depthPkg?.elitePolicy || "low-hp-focus",
      direction: "W",
      routeId: elitePathId,
      objectiveId: "echo-recovery",
    });
    if (depthPkg?.affixAura) elite.affixAura = depthPkg.affixAura;
    const escortCount = depthPkg?.eliteEscorts ?? 1;
    for (let escortIndex = 0; escortIndex < escortCount; escortIndex += 1) {
      const escort = spawnEnemy(run, "guardian", false, {
        policyId: "elite-escort",
        direction: "W",
        laneOffset: 500 * (escortIndex + 1),
        routeId: elitePathId,
        objectiveId: "echo-recovery",
      });
      escort.escortLeaderId = elite.id;
      if (depthPkg?.affixAura) escort.affixAura = depthPkg.affixAura;
      emit(run, "ESCORT_LEADER_ACQUIRED", {
        entityId: escort.id,
        leaderId: elite.id,
        policyId: escort.policyId,
        objectiveId: "echo-recovery",
      });
    }
    run.eliteSpawned = true;
  }

  advanceTravellingProjectiles(run);
  // Lingering area fields pulse before deaths are resolved, so a field kill lands on this tick.
  processAreaFields(run);

  /* Legacy timed projectiles (enemy fire) only: travelling orbs were already integrated above. */
  run.projectiles.forEach((projectile) => { if (projectile.mode !== "travel") projectile.ttl -= 1; });
  const impacts = run.projectiles.filter((projectile) => projectile.mode !== "travel" && projectile.ttl <= 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  run.projectiles = run.projectiles.filter((projectile) => projectile.mode === "travel" || projectile.ttl > 0);

  impacts.forEach((projectile) => {
    let damage = projectile.damage;
    let hit = true;
    let guardedBy = null;
    let targetSpawnEventId = null;
    if (projectile.targetId === "gate") {
      run.gate.integrity = clamp(run.gate.integrity - damage, 0, run.gate.maxIntegrity);
    } else if (projectile.targetId === "commander") {
      run.commander.integrity = clamp(run.commander.integrity - damage, 0, run.commander.maxIntegrity);
      applyWardenDamageResponse(run);
    } else if (run.companions.some((entry) => entry.id === projectile.targetId && entry.status !== "DOWNED")) {
      // A projectile already in flight when its target went DOWNED must not keep hitting it: a DOWNED
      // companion is out of the fight until it is restored. Long stages make this window common.
      const target = run.companions.find((entry) => entry.id === projectile.targetId);
      target.hp = clamp(target.hp - damage, 0, target.maxHp);
      emit(run, "COMPANION_DAMAGED", { entityId: target.id, companionId: target.companionId, damage, hp: target.hp, maxHp: target.maxHp, owner: projectile.owner });
      if (target.hp <= 0 && target.status === "ACTIVE") {
        target.status = "DOWNED";
        emit(run, "COMPANION_DOWNED", { entityId: target.id, companionId: target.companionId, owner: projectile.owner });
      }
    } else {
      const target = run.enemies.find((entry) => entry.id === projectile.targetId);
      if (!target) hit = false;
      else {
        const escort = sortedActors(run.enemies).find((entry) => entry.policyId === "elite-escort"
          && entry.escortLeaderId === target.id
          && distanceSquared(entry, target) <= 1600 ** 2);
        if (escort) {
          guardedBy = escort.id;
          damage = Math.max(1, Math.trunc(damage * 3 / 4));
        }
        target.hp -= damage;
        targetSpawnEventId = target.spawnEventId || null;
        target.lastCausalRootId = projectile.causalRootId;
      }
    }
    // Restored verbatim from HEAD: a concurrent session spliced a duplicate of the commander
    // basic-attack cooldown block (which already exists correctly in tick() below) into the
    // middle of the escort predicate, destroying the escort-guard damage application and this
    // emit's opener. Recorded in
    // _workspace/current/production/concurrent-session-collision-20260729.md.
    emit(run, "PROJECTILE_IMPACT", {
      projectileId: projectile.id,
      sourceId: projectile.sourceId,
      causalRootId: projectile.causalRootId,
      projectileSpawnEventId: projectile.spawnEventId,
      targetId: projectile.targetId,
      owner: projectile.owner,
      targetSpawnEventId,
      damage: hit ? damage : 0,
      hit,
      guardedBy,
      cue: hit ? eventCue("impactHit") : null,
    });
    // 광역: an enemy shell detonates on whatever it reached. Structures are never splashed —
    // the gate has its own authored damage path — so this only reaches bodies.
    if (hit && projectile.targetId !== "gate") {
      const detonation = run.commander.id === projectile.targetId
        ? run.commander
        : (run.companions.find((entry) => entry.id === projectile.targetId)
          || run.enemies.find((entry) => entry.id === projectile.targetId));
      if (detonation) {
        resolveAreaImpact(run, {
          origin: detonation,
          faction: projectile.faction ?? "enemy",
          sourceId: projectile.sourceId,
          sourceKey: "enemyProjectile",
          damage: projectile.damage,
          element: projectile.element,
          excludeIds: [projectile.targetId],
          causalRootId: projectile.causalRootId,
        });
      }
    }
  });

  run.commander.basicCooldown -= 1;
  if (run.commander.basicCooldown <= 0) {
    /* None-target: the aim reference only feeds conditional damage multipliers — the hit itself is
     * resolved by the melee arc or by the travelling orb's swept sphere. */
    commanderBasicAttack(run, "automatic");
    run.commander.basicCooldown = run.commander.basicTicks || COMMANDER.basicCooldown;
  }


  updateCompanions(run);

  moveEnemies(run);
  /* Bodies are integrated independently, so unstick every overlapping pair before the tick is
   * snapshotted — no two bodies may share a footprint. */
  separateBodies(run);

  resolveDeaths(run);
  processWaveClearRecovery(run);
  assignCompanionItemClaims(run);
  collectPickups(run);
  updateEncounterObjective(run);
  updateObjectivePhase(run);
  processObjectivePressure(run);

  if (!run.bossSpawned
      && run.objectives.occupation.completed
      && run.objectives.phase === "boss-kill"
      && run.tick >= run.stage.gateTicks
      && !run.enemies.some((enemy) => enemy.class !== "boss")) {
    spawnBoss(run);
  }

  if (run.gate.integrity <= 0 || run.commander.integrity <= 0 || run.extractionProgress.failed) {
    run.terminal = "DEFEAT";
    emit(run, "TERMINAL", {
      outcome: "DEFEAT",
      planIdentity: run.planCommitment.identity,
      objectiveId: run.extractionProgress.failed ? "extraction" : "survival",
      cutscene: stageCutscene(run.stage).defeat,
      cue: eventCue("terminal"),
    });
  } else {
    if (run.bossSpawned
        && !run.objectives.bossKill.completed
        && !run.enemies.some((entry) => entry.class === "boss")) {
      run.objectives.bossKill.completed = true;
      run.objectives.bossKill.completedAt = run.tick;
      emit(run, "OBJECTIVE_COMPLETED", {
        stageId: run.stage.id,
        objectiveId: "boss-kill",
        bossTtkTicks: run.bossSpawnedAt === null ? null : run.tick - run.bossSpawnedAt,
      });
      updateObjectivePhase(run);
      openExtractionWindow(run, run.tactics);
    }
    if (run.objectives.bossKill.completed && run.extracted) {
      run.terminal = run.stage.id === "echo-throne" ? "FINAL_COMPLETION" : "VICTORY";
      if (!run.progress.achievements.includes(`stage-clear:${run.stage.id}`)) {
        run.progress.achievements.push(`stage-clear:${run.stage.id}`);
      }
      run.rewardOffer = { choices: [...(STAGE_REWARD_IDS[run.stage.id] || [])] };
      emit(run, "TERMINAL", {
        outcome: run.terminal,
        planIdentity: run.planCommitment.identity,
        objectiveId: "extraction",
        bossTtkTicks: run.bossSpawnedAt === null ? null : run.objectives.bossKill.completedAt - run.bossSpawnedAt,
        rewardChoices: [...run.rewardOffer.choices],
        cutscene: stageCutscene(run.stage).victory,
        cue: eventCue("terminal"),
      });
    }
  }

  const itemCollected = run.events.some((event) => event.type === "ITEM_COLLECTED");
  // Growth offers used to be gated behind the completed gate-defense + echo-recovery objectives,
  // which was survivable when the hold was 15-45 s. With the authored 160-250 s hold
  // (STAGE_WAVE_DOCTRINE) that gate meant the ENTIRE defense was played at level 1 with no
  // upgrades, and the level-up circuit only opened after the fight was effectively over. The XP
  // threshold itself is now the only progression gate; the integrity and pending-item guards
  // (never interrupt a near-death moment or an item pickup beat) are unchanged.
  if (!run.terminal && !run.growthOffer && !itemCollected
      && run.commander.integrity * 10 > run.commander.maxIntegrity
      && run.commander.xp >= (XP_GROWTH[run.commander.level - 1] || XP_GROWTH.at(-1))) {
    makeOffer(run);
  }
}

/**
 * Stage-to-stage carry-over (스킬/아이템 효과 이어가기).
 *
 * A victory hands the NEXT stage the build the player actually assembled, one rank lighter and
 * capped, so a long campaign compounds without becoming a snowball:
 *   carriedRank = clamp(earnedRank - CARRY_OVER_RANK_DECAY, 1, CARRY_OVER_MAX_RANK)
 *   items       = the last CARRY_OVER_MAX_ITEMS collected in-run, re-applied at full effect
 * Defeat carries nothing. `runCarryOver()` is what the campaign layer persists.
 */
export function runCarryOver(run) {
  const snapshotRanks = run?.commander?.skillRanks || {};
  const skillRanks = {};
  for (const [skillId, rank] of Object.entries(snapshotRanks)) {
    if (!SKILLS[skillId]) continue;
    skillRanks[skillId] = clamp(rank - CARRY_OVER_RANK_DECAY, 1, CARRY_OVER_MAX_RANK);
  }
  return {
    version: 1,
    skillRanks,
    itemIds: [...(run?.itemIds || [])].slice(-CARRY_OVER_MAX_ITEMS),
  };
}
function applyExtractedSkillRanks(state, extractedSkillRanks) {
  if (!extractedSkillRanks || typeof extractedSkillRanks !== "object" || Array.isArray(extractedSkillRanks)) return;
  for (const skillId of Object.keys(extractedSkillRanks).sort()) {
    const skill = SKILLS[skillId];
    if (!skill || skill.kind !== "active") continue;
    const rank = clamp(Math.trunc(extractedSkillRanks[skillId]), 1, MAX_SKILL_RANK);
    if (!Number.isFinite(rank)) continue;
    if (!state.commander.skills.includes(skillId)) state.commander.skills.push(skillId);
    const currentRank = state.commander.skillRanks[skillId] ?? 0;
    const targetRank = Math.max(currentRank, rank);
    state.commander.skillRanks[skillId] = targetRank;
    for (let step = currentRank + 1; step <= targetRank; step += 1) applySkillRankEffects(state, skill, step);
  }
  state.commander.skills.sort();
}
function applyCarryOver(state, carryOver) {
  if (!carryOver) return;
  const skillRanks = carryOver.skillRanks || {};
  const carriedSkills = [];
  for (const skillId of Object.keys(skillRanks).sort()) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    const carriedRank = clamp(Math.trunc(skillRanks[skillId]), 1, CARRY_OVER_MAX_RANK);
    if (!state.commander.skills.includes(skillId)) state.commander.skills.push(skillId);
    const currentRank = state.commander.skillRanks[skillId] ?? 0;
    const rank = Math.max(currentRank, carriedRank);
    state.commander.skillRanks[skillId] = rank;
    for (let step = currentRank + 1; step <= rank; step += 1) applySkillRankEffects(state, skill, step);
    carriedSkills.push({ skillId, rank });
  }
  state.commander.skills.sort();
  const carriedItems = [...(carryOver.itemIds || [])].filter((itemId) => ITEMS[itemId]).slice(-CARRY_OVER_MAX_ITEMS);
  carriedItems.forEach((itemId) => applyItem(state, itemId));
  if (carriedSkills.length || carriedItems.length) {
    emit(state, "CARRY_OVER_APPLIED", {
      skills: carriedSkills,
      itemIds: [...carriedItems],
      objectiveId: "growth",
    });
  }
}

/** Creates a new run. `seed` is coerced to an unsigned xorshift32 state (zero becomes one).
 * `formation` is the saved per-companion FRONT/BACK intent map. It deterministically chooses
 * companion position rank at run creation; the active stance still derives the live slot count
 * from STANCE_CONFIG every tick. See resolveFormation(). */
export function createDefenseRun({ stageId, seed = 1, companionLoadout = [], rewardIds = [], measurementProfileId = null, wardenProgress = null, wardenEquipment = {}, companionEquipment = {}, formation = {}, extractedSkillRanks = null, carryOver = null, abyssDepth = 0 } = {}) {
  const stage = stageFor(stageId);
  const stagePlan = stagePlanFor(stage);
  const unsignedSeed = (seed >>> 0) || 1;
  const depth = Number.isInteger(abyssDepth) ? clamp(abyssDepth, 0, ABYSS_DEPTH_MAX) : 0;
  // Only the wave schedule reroutes on depth; identity/surprise/combat rng stay on unsignedSeed so
  // depth 0 is byte-identical and higher depths just rotate which enemy policies/compositions roll.
  const waveSeed = depth ? (((unsignedSeed ^ (0x51ed2701 * (depth + 1))) >>> 0) || 1) : unsignedSeed;
  const tactics = stagePlan.mapPlan.tactics;
  const depthPackage = Catalog.abyssDepthPackage(depth);
  const { schedule, nextRng, variantId } = buildWaveSchedule(stage, waveSeed, tactics, stagePlan.wavePlan, depthPackage);
  const planIdentity = `${stagePlan.mapPlan.id}:${stagePlan.wavePlan.id}:seed:${unsignedSeed}`;
  const surpriseTable = tactics.surpriseTable;
  const surpriseRng = rngNext(unsignedSeed ^ 0x6d2b79f5);
  const rawSurprise = surpriseTable ? {
    tableId: surpriseTable.id,
    rollBp: surpriseRng % 10000,
    outcome: surpriseRng % 10000 < surpriseTable.chanceBp
      ? surpriseTable.outcomes[rngNext(surpriseRng) % surpriseTable.outcomes.length]
      : null,
  } : null;
  const loreSurprise = rawSurprise && {
    tableId: rawSurprise.tableId,
    rollBp: rawSurprise.rollBp,
    outcomeId: rawSurprise.outcome?.id || null,
    text: rawSurprise.outcome?.text || null,
  };

  const profileKey = typeof measurementProfileId === "string" ? measurementProfileId.toLowerCase() : null;
  const measurementProfile = profileKey === Catalog.QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID
    ? Catalog.QA_MULTI_SKILL_MEASUREMENT_FIXTURE
    : profileKey ? MEASUREMENT_PROFILES[profileKey] : null;

  const maxIntegrity = measurementProfile ? measurementProfile.maxIntegrity : GATE.maxIntegrity;
  const stageGateIntegrity = stage.doctrine?.gateIntegrity ?? GATE.maxIntegrity;
  const basicTicks = measurementProfile ? measurementProfile.basicCooldownTicks : COMMANDER.basicCooldown;
  const critProfile = measurementProfile ? clone(measurementProfile.critProfile) : clone(COMMANDER.critProfile);
  const initialSkills = measurementProfile
    ? [...(measurementProfile.activeSkillIds || [measurementProfile.activeSkillId])]
    : [];
  const initialSkillRanks = Object.fromEntries(initialSkills.map((skillId) => [skillId, 1]));
  const initialCooldowns = Object.fromEntries(initialSkills.map((skillId) => [skillId, 0]));

  const state = {
    version: SNAPSHOT_VERSION,
    tick: 0,
    seed: unsignedSeed,
    abyssDepth: depth,
    abyssDepthName: depthPackage?.name || null,
    rng: nextRng,
    combatRng: rngNext(unsignedSeed ^ 0x9e3779b9),
    nextId: 0,
    eventSequence: 0,
    castSequence: 0,
    stage,
    tactics,
    planCommitment: {
      version: 1,
      identity: planIdentity,
      mapPlan: stagePlan.mapPlan,
      wavePlan: stagePlan.wavePlan,
      m4Plan: stagePlan.m4Plan,
      waveVariantId: variantId,
    },
    ...(measurementProfile ? { measurementProfileId: measurementProfile.id, measurementProfile } : {}),
    waveSchedule: schedule,
    waveVariant: {
      version: 1,
      id: variantId,
      planId: stagePlan.wavePlan.id,
      seed: unsignedSeed,
      schedule: clone(schedule),
    },
    waveIndex: 0,
    waveClearIndex: 0,
    encounter: encounterStateFor(stage.encounterRoute),
    inputs: [],
    inputSequence: 0,
    events: [],
    enemies: [],
    projectiles: [],
    /** Live lingering area fields (defense-catalog AREA_FIELD). Ticked by processAreaFields(). */
    areaFields: [],
    /** Tick through which allied fire is inside an AI punish window. 0 = no window. */
    punishWindowUntilTick: 0,
    pickups: [],
    companions: [],
    itemIds: [],
    rewardIds: [],
    rewardOffer: null,
    loreSurprise: null,
    m4: {
      planId: stagePlan.m4Plan.id,
      inventory: stagePlan.m4Plan.cards.map((card) => card.id),
      cursor: 0,
      status: "AVAILABLE",
      selectedCardId: null,
      recoveredAt: null,
      fallbackReason: null,
      decisions: [],
    },
    progress: { defeated: 0, extracted: 0, echoDenied: 0, itemsCollected: 0, skillsLearned: 0, achievements: [] },
    gateDamageReduction: 0,
    terrainRecovery: { commander: 0, gate: 0, capRatio: depthPackage?.recoveryCapRatio ?? 0.25 },
    rallyTargetId: null,
    formationStance: "VANGUARD",
    stanceCooldownUntilTick: 0,
    wardenState: null,
    // Gate durability is now a per-stage doctrine number: a 3-6 minute hold takes several times
    // the total incoming damage the pre-doctrine 30-45 s hold did, so the 1000-integrity gate is
    // scaled to the authored hold length instead of leaving the format unwinnable.
    gate: { id: "gate", x: ARENA.gateX, y: ARENA.gateY, elevation: 0, integrity: stageGateIntegrity, maxIntegrity: stageGateIntegrity, radius: GATE.radius },
    commander: {
      id: "commander",
      x: 19000,
      y: ARENA.gateY,
      elevation: 0,
      radius: COMMANDER.radius,
      integrity: maxIntegrity,
      maxIntegrity,
      xp: 0,
      level: 1,
      move: "IDLE",
      moveSpeed: COMMANDER.speed,
      basicDamage: measurementProfile ? measurementProfile.basicDamage : COMMANDER.basicDamage,
      basicTicks,
      basicCooldown: 0,
      objectiveRoute: false,
      engaged: false,
      pickupRange: 12000,
      incomingDamageMultiplier: 1,
      cooldownScale: 1,
      critProfile,
      skills: initialSkills,
      skillRanks: initialSkillRanks,
      cooldowns: initialCooldowns,
    },
    occupationProgress: {
      id: tactics.occupation?.id || "occ-1",
      holdTicks: 0,
      maxHoldTicks: tactics.occupation?.holdTicks || 180,
      captured: false,
      capturedAt: null,
    },
    extractionProgress: {
      id: tactics.extraction?.id || "ext-1",
      holdTicks: 0,
      maxHoldTicks: 120,
      completed: false,
      ready: false,
      completedAt: null,
      failed: false,
      availableAt: null,
      expiresAt: null,
      windowTicks: tactics.extraction?.windowTicks || 720,
    },
    objectives: {
      version: 1,
      phase: "gate-defense",
      route: {
        version: 1,
        id: stage.encounterRoute.id,
        phase: stage.encounterRoute.objectives[0]?.id || "complete",
        order: stage.encounterRoute.objectives.map(({ id }) => id),
        completed: false,
      },
      gateDefense: { completed: false, completedAt: null, requiredTick: stage.gateTicks },
      echoRecovery: { completed: false, completedAt: null },
      growth: { completed: false, completedAt: null },
      occupation: { completed: false, pointId: tactics.occupation?.id || null },
      extraction: { completed: false, pointId: tactics.extraction?.id || null },
      bossKill: { completed: false, completedAt: null },
    },
    objectivePressure: {
      phase: "gate-defense",
      phaseStartedAt: 0,
      deadlineTick: stage.gateTicks + OBJECTIVE_PRESSURE_DEADLINE_OFFSET,
      pulses: 0,
    },
    terrainRemainders: {},
    eliteSpawned: false,
    eliteCandidate: null,
    extracted: false,
    bossSpawned: false,
    bossSpawnedAt: null,
    growthOffer: null,
    terminal: null,
  };
  placeOnTerrain(state, state.gate, state.gate);
  placeOnTerrain(state, state.commander, state.commander);
  if (!measurementProfile) {
    const hasWardenInvestment = wardenProgress && (Object.keys(wardenProgress.statPoints || {}).length || (wardenProgress.skillTreeIds || []).length || (wardenProgress.traitIds || []).length);
    const hasEquipmentInvestment = Object.values(wardenEquipment).some((tier) => tier > 0) || Object.values(companionEquipment).some((eq) => Object.values(eq || {}).some((tier) => tier > 0));
    const rpgActive = Boolean(hasWardenInvestment || hasEquipmentInvestment);
    state.rpgActive = rpgActive;
    if (wardenProgress) {
      const runtime = deriveWardenRuntimeStats({ ...wardenProgress, equipment: wardenEquipment });
      state.wardenState = {
        runtime, firstStrikeConsumed: false, wardensWardConsumed: false, awakeningResetConsumed: false,
        chainReactionStacks: 0, vigilRegenRemainderMilli: 0,
      };
      state.commander.basicDamage = Math.round((state.commander.basicDamage + runtime.basicDamageBonus) * runtime.weaponTierMultiplier);
      state.commander.maxIntegrity = Math.round((state.commander.maxIntegrity + runtime.maxIntegrityBonus) * runtime.maxIntegrityMultiplier * runtime.wardTierMultiplier);
      state.commander.integrity = state.commander.maxIntegrity;
      state.commander.pickupRange = Math.round((state.commander.pickupRange + runtime.pickupRangeBonus) * runtime.pickupRangeMultiplier * runtime.trinketTierMultiplier);
      state.commander.cooldownScale = clamp(state.commander.cooldownScale - runtime.cooldownReduction, 0.4, 1);
      state.commander.critProfile.chanceBp = clamp(state.commander.critProfile.chanceBp + runtime.critChanceBonusBp, 0, 10000);
    }
    resolveFormation(companionLoadout, formation).forEach((id) => addCompanion(state, id, { equipment: companionEquipment[id] || {} }));
    applyOwnedRewards(state, rewardIds);
    applyExtractedSkillRanks(state, extractedSkillRanks);
    applyCarryOver(state, carryOver);
    if (rpgActive) {
      let incomingMultiplier = state.commander.incomingDamageMultiplier;
      if (state.wardenState?.runtime?.incomingDamageMultiplier) incomingMultiplier *= state.wardenState.runtime.incomingDamageMultiplier;
      state.companions.forEach((companion) => {
        if (companion.status !== "ACTIVE") return;
        if (companion.role === "vanguard") incomingMultiplier *= COMPANION_ROLES.vanguard.commanderIncomingDamageMultiplier;
        if (companion.role === "support") {
          state.commander.pickupRange = Math.round(state.commander.pickupRange * COMPANION_ROLES.support.commanderPickupRangeMultiplier);
          state.commander.cooldownScale = clamp(state.commander.cooldownScale - COMPANION_ROLES.support.commanderCooldownReduction, 0.4, 1);
        }
      });
      state.commander.incomingDamageMultiplier = incomingMultiplier;
    }
  }
  emit(state, "STAGE_STARTED", {
    planIdentity,
    stageId,
    mapPlanId: stagePlan.mapPlan.id,
    wavePlanId: stagePlan.wavePlan.id,
    m4PlanId: stagePlan.m4Plan.id,
    cutscene: stageCutscene(stage).intro,
    cue: eventCue("stageStart"),
  });
  const openingEncounterObjective = stage.encounterRoute.objectives[0];
  if (openingEncounterObjective) {
    emit(state, "ENCOUNTER_OBJECTIVE_STARTED", {
      ...encounterObjectiveHandoff(state, openingEncounterObjective, 0),
      previousObjectiveId: null,
    });
  }
  if (loreSurprise) state.loreSurprise = emit(state, "LORE_SURPRISE_RESOLVED", loreSurprise);
  emit(state, "M4_CARD_AVAILABLE", {
    cardId: state.m4.inventory[0],
    m4PlanId: stagePlan.m4Plan.id,
    inventory: [...state.m4.inventory],
  });
  return freeze(state);
}

/** Queues one input for the next simulation tick and returns a new run. */
export function queueInput(run, type, payload = null) {
  if (!run || !["MOVE", "ATTACK", "SKILL_CAST", "SKILL_SELECTED", "GROWTH_OFFER_SELECTED", "REWARD_SELECTED", "RETRY_OBJECTIVE", "EXTRACT_ELITE", "M4_CARD_DECISION", "M3_TARGET_PROBE", "STANCE_CYCLE"].includes(type)) return run;
  const next = clone(run);
  next.inputSequence = (next.inputSequence || 0) + 1;
  next.inputs.push({ at: next.tick + 1, inputId: `${next.planCommitment.identity}:input:${next.inputSequence}`, type, payload: clone(payload) });
  return freeze(next);
}


/** Advances exactly `steps` 60 Hz ticks, stopping early for growth selection or a terminal outcome. */
export function advanceDefenseRun(run, steps = 1) {
  if (!run || !Number.isInteger(steps) || steps < 0) throw new RangeError("steps must be a non-negative integer");
  const next = clone(run);
  const world = worldForRun(next);
  const usesMeshSupport = Boolean(world.gameplay.meshColliders?.length);
  const supportMeshIds = new Set((world.gameplay.meshColliders || [])
    .map((collider) => collider.id)
    .filter((id) => typeof id === "string"));
  for (const entity of [next.gate, next.commander, ...(next.enemies || []), ...(next.companions || []), ...(next.pickups || []), ...(next.projectiles || [])]) {
    const meshContactInvalid = usesMeshSupport && !supportMeshIds.has(entity?.supportMeshId);
    const staleNonMeshContact = !usesMeshSupport && Object.hasOwn(entity || {}, "supportMeshId");
    if (entity && (!Number.isInteger(entity.elevation) || meshContactInvalid || staleNonMeshContact)) {
      placeOnTerrain(next, entity, entity);
    }
  }
  if (!next.terrainRecovery) next.terrainRecovery = { commander: 0, gate: 0, capRatio: 0.25 };
  if (next.extractionProgress && typeof next.extractionProgress.ready !== "boolean") {
    next.extractionProgress.ready = Boolean(next.extractionProgress.completed);
  }
  if (next.commander && typeof next.commander.objectiveRoute !== "boolean") next.commander.objectiveRoute = false;
  if (next.commander && typeof next.commander.engaged !== "boolean") next.commander.engaged = false;
  if (!Number.isInteger(next.combatRng)) next.combatRng = rngNext(next.seed ^ 0x9e3779b9);
  ensureEncounterState(next);
  if (!next.objectives.route) {
    const route = encounterRouteFor(next);
    next.objectives.route = {
      version: 1,
      id: route?.id || null,
      phase: next.encounter.objectiveId || "complete",
      order: (route?.objectives || []).map(({ id }) => id),
      completed: next.encounter.status === "COMPLETE",
    };
  }
  if (!next.objectivePressure) {
    next.objectivePressure = {
      phase: next.objectives?.phase || "gate-defense",
      phaseStartedAt: next.tick,
      deadlineTick: next.stage.gateTicks + OBJECTIVE_PRESSURE_DEADLINE_OFFSET,
      pulses: 0,
    };
  }
  next.enemies?.forEach((enemy) => {
    if (enemy.class === "boss" && typeof enemy.attackWindup !== "boolean") enemy.attackWindup = false;
  });
  for (let index = 0; index < steps && !next.terminal; index += 1) {
    if (next.growthOffer) {
      const selections = next.inputs.filter((input) => input.type === "GROWTH_OFFER_SELECTED" || input.type === "SKILL_SELECTED");
      if (!selections.length) break;
      next.inputs = next.inputs.filter((input) => input.type !== "GROWTH_OFFER_SELECTED" && input.type !== "SKILL_SELECTED");
      selections.forEach((input) => processInput(next, input));
      if (next.growthOffer) break;
    }
    tick(next);
    if (next.growthOffer) break;
  }
  if (next.terminal && next.rewardOffer) {
    const selections = next.inputs.filter((input) => input.type === "REWARD_SELECTED");
    next.inputs = next.inputs.filter((input) => input.type !== "REWARD_SELECTED");
    selections.forEach((input) => processInput(next, input));
  }
  return freeze(next);
}

/** Returns a detached, frozen renderer-friendly snapshot with every live actor. */
export function getRunSnapshot(run) {
  return freeze(clone({
    version: SNAPSHOT_VERSION,
    eventVersion: EVENT_VERSION,
    tick: run.tick,
    stageId: run.stage.id,
    stageName: run.stage.name,
    bossName: run.stage.bossName,
    terminal: run.terminal,
    ...(run.abyssDepth ? { abyssDepth: run.abyssDepth, abyssDepthName: run.abyssDepthName ?? null } : {}),
    plan: {
      identity: run.planCommitment.identity,
      mapPlanId: run.planCommitment.mapPlan.id,
      wavePlanId: run.planCommitment.wavePlan.id,
      m4PlanId: run.planCommitment.m4Plan.id,
      waveVariantId: run.planCommitment.waveVariantId,
    },
    ...(run.measurementProfileId ? { measurementProfileId: run.measurementProfileId } : {}),
    gate: run.gate,
    gateDamageReduction: run.gateDamageReduction,
    terrainRecovery: run.terrainRecovery,
    commander: run.commander,
    rallyTargetId: run.rallyTargetId,
    formationStance: run.formationStance,
    stanceCooldownUntilTick: run.stanceCooldownUntilTick,
    wardenState: run.wardenState ? { chainReactionStacks: run.wardenState.chainReactionStacks, firstStrikeConsumed: run.wardenState.firstStrikeConsumed, wardensWardConsumed: run.wardenState.wardensWardConsumed, awakeningResetConsumed: run.wardenState.awakeningResetConsumed } : null,
    growthOffer: run.growthOffer,
    rewardOffer: run.rewardOffer,
    itemIds: run.itemIds,
    rewardIds: run.rewardIds,
    encounter: encounterSnapshot(run),
    progress: run.progress,
    loreSurprise: run.loreSurprise,
    m4: run.m4,
    eliteCandidate: run.eliteCandidate,
    extracted: run.extracted,
    bossSpawned: run.bossSpawned,
    cutscene: stageCutscene(run.stage),
    events: run.events.map((event) => ({ version: EVENT_VERSION, ...event })),
    enemies: sortedActors(run.enemies),
    projectiles: sortedActors(run.projectiles),
    /** Live area fields, so a renderer can draw a persistent ground zone without inferring it. */
    areaFields: sortedActors(run.areaFields),
    punishWindowUntilTick: run.punishWindowUntilTick,
    pickups: sortedActors(run.pickups),
    companions: sortedActors(run.companions),
    occupationProgress: run.occupationProgress,
    extractionProgress: run.extractionProgress,
    tactics: run.tactics,
    stageLayout: {
      chokepath: run.tactics.chokepath,
      flank: run.tactics.flank,
      elevation: run.tactics.elevation,
      hazard: run.tactics.hazard,
      occupationPoint: run.tactics.occupation,
      extractionPoint: run.tactics.extraction,
    },
    waveVariant: run.waveVariant,
    objectives: run.objectives,
    objectivePressure: run.objectivePressure,
    objectiveProgress: {
      phase: run.objectives.phase,
      occupation: run.occupationProgress,
      extraction: run.extractionProgress,
    },
  }));
}

/** Returns a stable JSON digest suitable for equal-run and replay comparisons. */
export function getRunDigest(run) { return JSON.stringify(getRunSnapshot(run)); }

/** True only after integrity failure or boss-stage completion. */
export function isTerminalRun(run) { return Boolean(run?.terminal); }

export {
  CARRY_OVER_MAX_ITEMS,
  MAX_SKILL_RANK,
  SKILL_RANK_DAMAGE_STEP,
  CARRY_OVER_MAX_RANK,
  CARRY_OVER_RANK_DECAY,
  TICK_RATE,
  OBJECTIVE_PRESSURE_GRACE_TICKS,
  BOSS_PRESSURE_GRACE_TICKS,
  ECHO_RECOVERY_PRESSURE_GRACE_TICKS,
};
