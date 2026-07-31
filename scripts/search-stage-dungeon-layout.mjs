#!/usr/bin/env node
/**
 * Offline dungeon-layout search for a canonical stage (prompts/approved/03-procedural-layout.md).
 *
 * Proposes obstacle/prop lattices on the flat 24000 x 12000 plane, rejects every candidate that
 * violates a `validateProfile` clause or disconnects a protected anchor, and prints the survivors
 * as constructor tuples for hand transcription into `stage-world-catalog.js`.
 *
 * It never writes runtime data: geometry stays static authored data, so `getRunDigest()` is
 * untouched. Modules are seeded jitters around authored slots — the "adjacency" constraint is the
 * pinch pairing declared in MODULES, i.e. two facing walls must leave a readable gap across the
 * critical route.
 *
 *   node scripts/search-stage-dungeon-layout.mjs cinder-span --seeds 8
 */
import { ARENA, STAGE_ENCOUNTER_ROUTES, STAGE_TACTICS } from "../defense-catalog.js";
import { STAGE_WORLD_PROFILES } from "../stage-world-catalog.js";

const CELL = 200;
const GATE_KEEP_CLEAR = 900;
const ANCHOR_KEEP_CLEAR = 300;
// A legal-but-hairline corridor is a defect waiting for the next revision, so newly placed or moved
// geometry must clear the route by a real band. Frozen shipped geometry keeps its authored margin
// (cinder-span's collapsed parapet ships at 50 units from the detour) and is only reported.
const MIN_NEW_ROUTE_MARGIN = 300;

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pointSegmentDistance = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0,
    (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / lengthSquared));
  return Math.hypot(point.x - (start.x + (t * dx)), point.y - (start.y + (t * dy)));
};

/**
 * Module vocabulary per stage. Each entry is one authored slot: a target placement, the jitter box
 * the search may explore, the radius band, and the pinch partner it must leave a gap with.
 */
const MODULES = {
  // cinder-span, cycle 10 + phase 1. The six obstacles promoted in place by the cycle-10 layout
  // pass are frozen; the two jittered slots are the ingress gatehouse pair, the one doorway the
  // promoted debris does not provide. They re-place two existing background props, so the twelve
  // authored pack-node placements stay twelve.
  "cinder-span": [
    { id: "cinder-span:ash-gatehouse-north", role: "wall", target: { x: 7700, y: 3100 }, jitter: { x: 700, y: 700 }, radius: [700, 860], pinch: "ingress" },
    { id: "cinder-span:ash-gatehouse-south", role: "wall", target: { x: 7400, y: 8500 }, jitter: { x: 700, y: 700 }, radius: [660, 800], pinch: "ingress" },
    { id: "cinder-span:relay-debris-north", role: "debris", target: { x: 5000, y: 10400 }, jitter: { x: 0, y: 0 }, radius: [500, 500], pinch: "frozen-north" },
    { id: "cinder-span:drowned-forge-arch", role: "arch", target: { x: 12600, y: 2800 }, jitter: { x: 0, y: 0 }, radius: [850, 850], pinch: "relay" },
    { id: "cinder-span:collapsed-parapet", role: "wall", target: { x: 13200, y: 9300 }, jitter: { x: 0, y: 0 }, radius: [900, 900], pinch: "relay" },
    { id: "cinder-span:relay-debris-south", role: "debris", target: { x: 15000, y: 1500 }, jitter: { x: 0, y: 0 }, radius: [540, 540], pinch: "frozen-south" },
    { id: "cinder-span:west-ash-wall", role: "wall", target: { x: 19000, y: 4400 }, jitter: { x: 0, y: 0 }, radius: [940, 940], pinch: "threshold" },
    { id: "cinder-span:east-ash-wall", role: "wall", target: { x: 20800, y: 9900 }, jitter: { x: 0, y: 0 }, radius: [700, 700], pinch: "threshold" },
  ],
};

/** Non-colliding dressing props the search also places (they still may not block a route). */
const DRESSING = { "cinder-span": [] };

const stageId = process.argv[2] ?? "cinder-span";
const seedCount = Number(process.argv[process.argv.indexOf("--seeds") + 1]) || 8;
const profile = STAGE_WORLD_PROFILES[stageId];
const tactics = STAGE_TACTICS[stageId];
const encounter = STAGE_ENCOUNTER_ROUTES[stageId];
if (!profile || !MODULES[stageId]) throw new Error(`No module vocabulary for stage: ${stageId}`);

const { minX, maxX, minY, maxY } = profile.gameplay.bounds;
const routes = profile.gameplay.routes;
const segments = routes.flatMap((route) => route.waypoints.slice(1).map((waypoint, index) => ({
  routeId: route.id,
  half: route.corridorWidth / 2,
  start: route.waypoints[index].placement,
  end: waypoint.placement,
})));

/** Coordinates no candidate may displace or block. */
const PROTECTED = [
  ...routes.flatMap((route) => route.waypoints.map((waypoint) => ({ id: waypoint.id, ...waypoint.placement }))),
  ...encounter.objectives.map((objective) => ({ id: objective.id, x: objective.point.x, y: objective.point.y })),
  { id: tactics.occupation.id, x: tactics.occupation.x, y: tactics.occupation.y },
  { id: tactics.extraction.id, x: tactics.extraction.x, y: tactics.extraction.y },
  { id: tactics.hazard.id, x: tactics.hazard.x, y: tactics.hazard.y },
  ...profile.presentation.questPoints.map((point) => ({ id: point.id, x: point.placement.x, y: point.placement.y })),
  ...profile.presentation.npcs.map((npc) => ({ id: npc.id, x: npc.placement.x, y: npc.placement.y })),
];

/** Props that keep their authored placement (beacons, lanterns, objective brands). */
const KEPT_PROP_IDS = new Set([
  `${stageId}:seal-brand`,
  `${stageId}:forge-relic`,
  `${stageId}:ingress-beacon-prop`,
  `${stageId}:gate-beacon-prop`,
]);
const keptProps = profile.presentation.props
  .filter((prop) => KEPT_PROP_IDS.has(prop.id))
  .map((prop) => ({ id: prop.id, x: prop.placement.x, y: prop.placement.y, radius: prop.footprintRadius }));
const anchors = profile.presentation.visibilityAnchors.map((anchor) => ({
  id: anchor.id, x: anchor.placement.x, y: anchor.placement.y,
}));

const jitterValue = (rng, target, spread) => Math.round((target + ((rng() * 2) - 1) * spread) / 100) * 100;
const jitterRadius = (rng, [low, high]) => Math.round((low + (rng() * (high - low))) / 20) * 20;

function buildCandidate(seed) {
  const rng = mulberry32(seed);
  const obstacles = MODULES[stageId].map((module) => ({
    id: module.id,
    role: module.role,
    pinch: module.pinch,
    x: jitterValue(rng, module.target.x, module.jitter.x),
    y: jitterValue(rng, module.target.y, module.jitter.y),
    radius: module.jitter.x === 0 && module.jitter.y === 0 ? module.radius[0] : jitterRadius(rng, module.radius),
    frozen: module.jitter.x === 0 && module.jitter.y === 0,
  }));
  const dressing = (DRESSING[stageId] ?? []).map((module) => ({
    id: module.id,
    role: module.role,
    x: jitterValue(rng, module.target.x, module.jitter.x),
    y: jitterValue(rng, module.target.y, module.jitter.y),
    radius: jitterRadius(rng, module.radius),
    frozen: false,
  }));
  return { seed, obstacles, dressing };
}

function evaluate(candidate) {
  const failures = [];
  const solids = [...candidate.obstacles, ...candidate.dressing, ...keptProps.map((prop) => ({ ...prop, frozen: true }))];
  let minRouteMargin = Infinity;
  let minNewRouteMargin = Infinity;

  for (const entry of candidate.obstacles) {
    if (entry.x - entry.radius < minX || entry.x + entry.radius > maxX
      || entry.y - entry.radius < minY || entry.y + entry.radius > maxY) failures.push(`${entry.id}: leaves walkable bounds`);
    const gateGap = Math.hypot(entry.x - ARENA.gateX, entry.y - ARENA.gateY) - (entry.radius + GATE_KEEP_CLEAR);
    if (gateGap < 0) failures.push(`${entry.id}: blocks gate geometry by ${Math.round(-gateGap)}`);
  }
  for (const entry of solids) {
    for (const segment of segments) {
      const margin = pointSegmentDistance(entry, segment.start, segment.end) - (entry.radius + segment.half);
      if (margin < 0) failures.push(`${entry.id}: blocks ${segment.routeId} by ${Math.round(-margin)}`);
      minRouteMargin = Math.min(minRouteMargin, margin);
      if (!entry.frozen) minNewRouteMargin = Math.min(minNewRouteMargin, margin);
    }
  }
  for (let left = 0; left < solids.length; left += 1) {
    for (let right = left + 1; right < solids.length; right += 1) {
      const gap = Math.hypot(solids[left].x - solids[right].x, solids[left].y - solids[right].y)
        - (solids[left].radius + solids[right].radius);
      if (gap < 0) failures.push(`${solids[left].id} overlaps ${solids[right].id} by ${Math.round(-gap)}`);
    }
  }
  for (const anchor of anchors) {
    for (const entry of candidate.obstacles) {
      const gap = Math.hypot(anchor.x - entry.x, anchor.y - entry.y) - (entry.radius + ANCHOR_KEEP_CLEAR);
      if (gap < 0) failures.push(`${anchor.id}: occluded by ${entry.id} by ${Math.round(-gap)}`);
    }
  }

  // Flood fill on a CELL grid, treating obstacle discs as blocked, from the ingress cell.
  const columns = Math.floor((maxX - minX) / CELL);
  const rows = Math.floor((maxY - minY) / CELL);
  const blocked = (cx, cy) => candidate.obstacles.some((entry) =>
    Math.hypot(cx - entry.x, cy - entry.y) < entry.radius + 200);
  const key = (col, row) => (row * (columns + 1)) + col;
  const ingress = PROTECTED.find((point) => point.id.endsWith(":ingress")) ?? PROTECTED[0];
  const startCol = Math.round((ingress.x - minX) / CELL);
  const startRow = Math.round((ingress.y - minY) / CELL);
  const seen = new Set([key(startCol, startRow)]);
  const queue = [[startCol, startRow]];
  while (queue.length) {
    const [col, row] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc > columns || nr > rows) continue;
      const id = key(nc, nr);
      if (seen.has(id)) continue;
      if (blocked(minX + (nc * CELL), minY + (nr * CELL))) continue;
      seen.add(id);
      queue.push([nc, nr]);
    }
  }
  const unreachable = PROTECTED.filter((point) => !seen.has(key(
    Math.round((point.x - minX) / CELL), Math.round((point.y - minY) / CELL))));
  if (unreachable.length) failures.push(`unreachable: ${unreachable.map((point) => point.id).join(", ")}`);
  if (!seen.has(key(Math.round((ARENA.gateX - minX) / CELL), Math.round((ARENA.gateY - minY) / CELL)))) {
    failures.push("unreachable: canonical gate");
  }
  if (minNewRouteMargin < MIN_NEW_ROUTE_MARGIN) {
    failures.push(`hairline corridor: new geometry clears the route by ${Math.round(minNewRouteMargin)} < ${MIN_NEW_ROUTE_MARGIN}`);
  }

  const pinches = [...new Set(candidate.obstacles.map((entry) => entry.pinch))].map((pinch) => {
    const pair = candidate.obstacles.filter((entry) => entry.pinch === pinch);
    if (pair.length !== 2) return { pinch, gap: null };
    const gap = Math.round(Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)
      - (pair[0].radius + pair[1].radius));
    return { pinch, gap };
  });
  // A pinch reads as a doorway between 2400 and 4600 units at this camera distance; tighter is
  // better inside that band, and anything outside it scores zero.
  const pinchScore = pinches.reduce((total, entry) => total
    + (entry.gap !== null && entry.gap >= 2400 && entry.gap <= 4600 ? (4600 - entry.gap) : 0), 0);
  return {
    ...candidate,
    failures,
    reachableCells: seen.size,
    minRouteMargin: Math.round(minRouteMargin),
    minNewRouteMargin: Math.round(minNewRouteMargin),
    pinches,
    score: failures.length ? -1 : Math.round(pinchScore + Math.min(minNewRouteMargin, 900)),
  };
}

const results = Array.from({ length: seedCount }, (_, index) => evaluate(buildCandidate((index + 1) * 7)));
const survivors = results.filter((entry) => entry.failures.length === 0).sort((a, b) => b.score - a.score);

console.log(`stage: ${stageId}   seeds: ${seedCount}   survivors: ${survivors.length}/${results.length}`);
console.log("| seed | verdict | new-geometry margin | frozen margin | pinch gaps | reachable cells | score |");
console.log("|---|---|---|---|---|---|---|");
for (const entry of results) {
  const gaps = entry.pinches.map((pinch) => `${pinch.pinch}:${pinch.gap ?? "n/a"}`).join(" ");
  const verdict = entry.failures.length ? `REJECT (${entry.failures[0]})` : "pass";
  console.log(`| ${entry.seed} | ${verdict} | ${entry.minNewRouteMargin} | ${entry.minRouteMargin} | ${gaps} | ${entry.reachableCells} | ${entry.score} |`);
}

const best = survivors[0];
if (!best) { console.log("\nNo candidate survived."); process.exit(1); }
console.log(`\nrecommended seed ${best.seed}\n`);
console.log("obstacles:");
for (const entry of best.obstacles) {
  console.log(`obstacle("${entry.id}", ${entry.x}, ${entry.y}, ${entry.radius}, "${entry.id.endsWith("-prop") || entry.id.endsWith("arch") ? entry.id : `${entry.id}-prop`}"),`);
}
console.log("\ndressing props:");
for (const entry of best.dressing) {
  console.log(`prop("${entry.id}", CINDER_RESOURCES.features, "${entry.role}", ${entry.x}, ${entry.y}, 0, <yaw>, ${entry.radius}, "<node>"),`);
}
