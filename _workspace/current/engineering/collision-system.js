/**
 * 충돌 시스템 — Mesh Collision System for 그림자군단
 *
 * Per-stage mesh-to-mesh collision detection between game objects.
 * - Sphere-vs-Sphere between actors (enemies, player, companions, bosses)
 * - Sphere-vs-Mesh for terrain/obstacle triangle meshes
 * - Spatial queries for AoE (논타겟팅 범위공격) damage resolution
 * - Elevation-aware with stepHeight tolerance
 * - Integer math where possible for deterministic simulation
 *
 * Imports COLLISION constants from defense-catalog.js.
 */

import { COLLISION } from "../../../defense-catalog.js";

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

const STEP_HEIGHT = COLLISION.stepHeight;                           // 600
const SEPARATION_PASSES = COLLISION.separationPasses;               // 12
const SEPARATION_ELEV_TOLERANCE = COLLISION.separationElevationTolerance; // 900

// ── Sphere vs Sphere ───────────────────────────────────────────────────────
/**
 * @param {{x:number,y:number,radius:number}} a

 * @returns {{colliding:boolean, overlap:number, normalX:number, normalY:number}}
 */
export function sphereVsSphere(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const sumR = a.radius + b.radius;
  if (distSq >= sumR * sumR) {
    return { colliding: false, overlap: 0, normalX: 0, normalY: 0 };
  }
  const dist = Math.sqrt(distSq) || 1;
  const overlap = sumR - dist;
  return {
    colliding: true,
    overlap,
    normalX: dx / dist,
    normalY: dy / dist,
  };
}

// ── Closest point on triangle ──────────────────────────────────────────────
function closestPointOnTriangle2D(px, py, ax, ay, bx, by, cx, cy) {
  // Barycentric approach — project onto triangle in 2D
  const v0x = cx - ax, v0y = cy - ay;
  const v1x = bx - ax, v1y = by - ay;
  const v2x = px - ax, v2y = py - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (denom === 0) return { x: ax, y: ay, inside: false };

  const u = (dot11 * dot02 - dot01 * dot12) / denom;
  const v = (dot00 * dot12 - dot01 * dot02) / denom;

  if (u >= 0 && v >= 0 && u + v <= 1) {
    return { x: px, y: py, inside: true };
  }

  // Clamp to edges
  const clampToSegment = (sx, sy, ex, ey) => {
    const edx = ex - sx, edy = ey - sy;
    const len2 = edx * edx + edy * edy;
    if (len2 === 0) return { x: sx, y: sy };
    const t = Math.max(0, Math.min(1, ((px - sx) * edx + (py - sy) * edy) / len2));
    return { x: sx + t * edx, y: sy + t * edy };
  };

  const candidates = [
    clampToSegment(ax, ay, bx, by),
    clampToSegment(bx, by, cx, cy),
    clampToSegment(cx, cy, ax, ay),
  ];

  let best = candidates[0];
  let bestDist = (best.x - px) ** 2 + (best.y - py) ** 2;
  for (let i = 1; i < candidates.length; i++) {
    const d = (candidates[i].x - px) ** 2 + (candidates[i].y - py) ** 2;
    if (d < bestDist) { best = candidates[i]; bestDist = d; }
  }
  return { x: best.x, y: best.y, inside: false };
}

// ── Sphere vs Mesh Triangles ───────────────────────────────────────────────
/**
 * Test a sphere against an array of triangles (from stage-world-catalog meshColliders).
 * @param {{x:number,y:number,elevation:number,radius:number}} sphere
 * @param {Array<Array<{x:number,y:number,elevation:number}>>} triangles
 * @returns {{colliding:boolean, closestPoint:{x:number,y:number}|null, penetrationDepth:number}}
 */
export function sphereVsMeshTriangles(sphere, triangles) {
  let closestDist = Infinity;
  let closestPt = null;

  for (const verts of triangles) {
    const [a, b, c] = verts;
    // Elevation check: average triangle elevation vs sphere elevation
    const avgElev = Math.round((a.elevation + b.elevation + c.elevation) / 3);
    if (Math.abs(avgElev - sphere.elevation) > STEP_HEIGHT) continue;

    const pt = closestPointOnTriangle2D(sphere.x, sphere.y, a.x, a.y, b.x, b.y, c.x, c.y);
    const dx = pt.x - sphere.x;
    const dy = pt.y - sphere.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestPt = pt;
    }
  }

  if (!closestPt || closestDist >= sphere.radius) {
    return { colliding: false, closestPoint: closestPt, penetrationDepth: 0 };
  }
  return {
    colliding: true,
    closestPoint: closestPt,
    penetrationDepth: sphere.radius - closestDist,
  };
}

// ── Iterative Body Separation ──────────────────────────────────────────────
/**
 * Iteratively separate overlapping spherical bodies.
 * Elevation-aware: bodies on different decks do not push each other.
 * @param {Array<{id:string,x:number,y:number,elevation:number,radius:number}>} bodies — mutated in place
 * @param {number} [passes] — defaults to COLLISION.separationPasses (12)
 */
export function separateBodies(bodies, passes = SEPARATION_PASSES) {
  for (let p = 0; p < passes; p++) {
    let anyOverlap = false;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        // Skip different elevation decks
        if (Math.abs((a.elevation || 0) - (b.elevation || 0)) > SEPARATION_ELEV_TOLERANCE) continue;

        const col = sphereVsSphere(a, b);
        if (!col.colliding) continue;
        anyOverlap = true;
        const half = Math.ceil(col.overlap / 2);
        a.x = Math.round(a.x - col.normalX * half);
        a.y = Math.round(a.y - col.normalY * half);
        b.x = Math.round(b.x + col.normalX * half);
        b.y = Math.round(b.y + col.normalY * half);
      }
    }
    if (!anyOverlap) break;
  }
}

// ── Resolve single body vs terrain obstacles ───────────────────────────────
/**
 * Push a body out of terrain obstacles (circle footprint).
 * @param {{x:number,y:number,elevation:number,radius:number}} body
 * @param {Array<{footprint:{x:number,y:number,radius:number},elevation:number}>} obstacles
 */
export function resolveTerrainCollision(body, obstacles) {
  for (const obs of obstacles) {
    if (Math.abs((body.elevation || 0) - (obs.elevation || 0)) > STEP_HEIGHT) continue;
    const col = sphereVsSphere(body, { x: obs.footprint.x, y: obs.footprint.y, radius: obs.footprint.radius });
    if (!col.colliding) continue;
    body.x = Math.round(body.x - col.normalX * col.overlap);
    body.y = Math.round(body.y - col.normalY * col.overlap);
  }
}

// ── Stage Collision Context ────────────────────────────────────────────────
/**
 * Build a collision context from a stage world profile (from stage-world-catalog.js).
 * @param {object} stageWorldProfile — a profile from STAGE_WORLD_PROFILES
 * @returns {object} frozen collision context
 */
export function createStageCollisionContext(stageWorldProfile) {
  const gp = stageWorldProfile.gameplay;
  return freeze({
    stageId: stageWorldProfile.stageId,
    bounds: gp.bounds,
    obstacles: gp.obstacles,
    meshColliders: gp.meshColliders,
    surfaces: gp.surfaces,
  });
}

/**
 * Run per-tick collision resolution for all bodies in the stage.
 * @param {object} context — from createStageCollisionContext
 * @param {Array} bodies — array of mutable body objects with {x,y,elevation,radius}
 */
export function updateCollisions(context, bodies) {
  // 1. Clamp bodies to stage bounds
  const b = context.bounds;
  for (const body of bodies) {
    body.x = Math.max(b.minX + body.radius, Math.min(b.maxX - body.radius, body.x));
    body.y = Math.max(b.minY + body.radius, Math.min(b.maxY - body.radius, body.y));
  }

  // 2. Resolve vs terrain obstacles
  for (const body of bodies) {
    resolveTerrainCollision(body, context.obstacles);
  }

  // 3. Body-vs-body separation
  separateBodies(bodies);
}

// ── Spatial Query: AoE ─────────────────────────────────────────────────────
/**
 * Find all bodies within a given radius (for AoE / 범위공격).
 * Elevation-aware: ignores bodies on different decks.
 * @param {object} _context — collision context (reserved for spatial index)
 * @param {number} x — center x
 * @param {number} y — center y
 * @param {number} radius — query radius in world units
 * @param {Array} bodies — candidate bodies
 * @param {number} [elevation=0] — query elevation
 * @returns {Array} bodies within radius
 */
export function queryBodiesInRadius(_context, x, y, radius, bodies, elevation = 0) {
  const r2 = radius * radius;
  return bodies.filter((body) => {
    if (Math.abs((body.elevation || 0) - elevation) > SEPARATION_ELEV_TOLERANCE) return false;
    const dx = body.x - x;
    const dy = body.y - y;
    return dx * dx + dy * dy <= r2;
  });
}

// ── Raycast ────────────────────────────────────────────────────────────────
/**
 * Simple 2D ray-segment test against obstacle circles for projectile/LOS.
 * @param {object} context — collision context
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @returns {{hit:boolean, hitObstacleId:string|null, hitX:number, hitY:number, distance:number}}
 */
export function raycast(context, fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { hit: false, hitObstacleId: null, hitX: fromX, hitY: fromY, distance: 0 };

  const dirX = dx / len;
  const dirY = dy / len;

  let closestT = len;
  let hitId = null;

  for (const obs of context.obstacles) {
    const fp = obs.footprint;
    const ocx = fp.x - fromX;
    const ocy = fp.y - fromY;
    const proj = ocx * dirX + ocy * dirY;
    if (proj < 0 || proj > len) continue;
    const perpSq = ocx * ocx + ocy * ocy - proj * proj;
    if (perpSq > fp.radius * fp.radius) continue;
    const halfChord = Math.sqrt(fp.radius * fp.radius - perpSq);
    const t = proj - halfChord;
    if (t > 0 && t < closestT) {
      closestT = t;
      hitId = obs.id;
    }
  }

  return {
    hit: hitId !== null,
    hitObstacleId: hitId,
    hitX: Math.round(fromX + dirX * closestT),
    hitY: Math.round(fromY + dirY * closestT),
    distance: Math.round(closestT),
  };
}
