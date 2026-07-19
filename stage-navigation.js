// Authoritative tactical navigation shared by both battle renderers. Grid cells
// are 1×1; -1 is void and every non-negative value is terrain elevation.
export const STAGE_GRID_WIDTH = 24;
export const STAGE_GRID_HEIGHT = 12;

// Legacy defaults retained for callers that have not yet moved to the per-stage
// navigation object. New code must use navigation.anchors.
export const STAGE_TACTICAL_ANCHORS = Object.freeze({
  portal: Object.freeze({ x: 1, y: 5.5 }),
  boss: Object.freeze({ x: 22, y: 5.5 }),
  node: Object.freeze({ x: 12, y: 5.5 }),
});

const LANES = Object.freeze([2, 5, 8]);
const EXPECTED_NODE_COUNTS = Object.freeze([1, 2, 1, 1, 1, 2, 2, 2, 3, 3]);

const STAGES = Object.freeze([
  stage(1, "Cinder Span", 6, 18, [30, 28, 32], [[12, 5.5]],
    ["Ash Shelf", "Forge Bridge", "Smelter Catwalk"], ["exposed", "objective", "cover"]),
  stage(2, "Veil Citadel", 6, 18, [30, 32, 34], [[9, 2.5], [9, 8.5]],
    ["Signal Terrace", "Veil Gate", "Relay Ramp"], ["high-ground", "exposed", "objective"]),
  stage(3, "Echo Throne", 7, 17, [36, 32, 34], [[14, 5.5]],
    ["Whisper Stair", "Grand Ascent", "Servitor Ramp"], ["cover", "objective", "flank"]),
  stage(4, "Sunken Bastion", 6, 18, [32, 34, 36], [[12, 5.5]],
    ["Breakwater", "Flood Causeway", "Sea Wall"], ["exposed", "hazard", "cover"]),
  stage(5, "Howling Sprawl", 7, 17, [36, 34, 38], [[13, 5.5]],
    ["Ruin Arcade", "Howling Plaza", "Collapsed Alleys"], ["cover", "objective", "flank"]),
  stage(6, "Glass Necropolis", 7, 18, [34, 36, 38], [[10, 2.5], [10, 8.5]],
    ["Grave Terrace", "Crystal Nave", "Crypt Walk"], ["high-ground", "exposed", "objective"]),
  stage(7, "Starless Canal", 6, 18, [36, 38, 40], [[9, 2.5], [9, 8.5]],
    ["Moonless Quay", "Twin Bridge Chain", "Barge Deck"], ["cover", "exposed", "current"]),
  stage(8, "Shattered Causeway", 7, 17, [36, 38, 40], [[10, 2.5], [10, 8.5]],
    ["Upper Span", "Shard Steps", "Underbridge"], ["high-ground", "hazard", "cover"]),
  stage(9, "Abyss Chancel", 6, 18, [38, 40, 42], [[8, 2.5], [12, 5.5], [8, 8.5]],
    ["Cantor Chain", "Rite Bridge", "Choir Walk"], ["high-ground", "current", "cover"]),
  stage(10, "Gate Zenith", 7, 17, [44, 40, 42], [[9, 2.5], [12, 5.5], [9, 8.5]],
    ["Crown Spiral", "Grand Stair", "Pilgrim Stair"], ["flank", "objective", "cover"]),
]);

function stage(number, name, junctionA, junctionB, lengths, nodes, routeNames, affordances) {
  return Object.freeze({
    number,
    name,
    junctionA,
    junctionB,
    lengths: Object.freeze(lengths),
    nodes: Object.freeze(nodes.map(([x, y], index) => Object.freeze({ id: `node-${index + 1}`, x, y }))),
    routeNames: Object.freeze(routeNames),
    affordances: Object.freeze(affordances),
  });
}

function normalizeStageNumber(stageNumber) {
  return Math.max(1, Math.min(10, Math.trunc(Number(stageNumber)) || 1));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function authoredRoute(meta, laneIndex) {
  const y = LANES[laneIndex];
  const targetLength = meta.lengths[laneIndex];
  const route = [];
  const push = (x, row) => {
    const previous = route.at(-1);
    if (!previous || previous.x !== x || previous.y !== row) route.push({ x, y: row });
  };

  for (let x = 1; x <= meta.junctionA; x += 1) push(x, 5);

  const towardLane = y > 5 ? 1 : -1;
  for (let row = 5 + towardLane; y > 5 ? row <= y : row >= y; row += towardLane) {
    push(meta.junctionA, row);
  }

  const baseLength = 22 + 2 * Math.abs(y - 5);
  const detours = (targetLength - baseLength) / 2;
  for (let x = meta.junctionA + 1, offset = 0; x <= meta.junctionB; x += 1, offset += 1) {
    if (offset < detours) {
      const detourDirection = laneIndex === 0 ? -1 : laneIndex === 2 ? 1 : offset % 2 === 0 ? -1 : 1;
      push(x - 1, y + detourDirection);
      push(x, y + detourDirection);
    }
    push(x, y);
  }

  const towardCenter = 5 > y ? 1 : -1;
  for (let row = y + towardCenter; 5 > y ? row <= 5 : row >= 5; row += towardCenter) {
    push(meta.junctionB, row);
  }
  for (let x = meta.junctionB + 1; x <= 22; x += 1) push(x, 5);

  if (route.length !== targetLength) {
    throw new Error(`Stage ${meta.number} route ${laneIndex + 1} expected ${targetLength} cells, got ${route.length}`);
  }
  return route;
}

function elevationFor(stageNumber, laneIndex, x) {
  if (stageNumber === 3) return Math.min(2, Math.floor(x / 8));
  if (stageNumber === 10) return Math.min(3, Math.floor(x / 6));
  if ([2, 6, 9].includes(stageNumber) && laneIndex === 0) return 1;
  return 0;
}

function compile(stageNumber) {
  const meta = STAGES[normalizeStageNumber(stageNumber) - 1];
  const mutableRoutes = LANES.map((_, laneIndex) => authoredRoute(meta, laneIndex));
  const cells = Array.from({ length: STAGE_GRID_HEIGHT }, () => Array(STAGE_GRID_WIDTH).fill(-1));

  mutableRoutes.forEach((route, laneIndex) => {
    for (const cell of route) cells[cell.y][cell.x] = elevationFor(meta.number, laneIndex, cell.x);
  });

  // Four-cell-deep deployment frontages keep spawns readable and allow units
  // to separate before entering one of the three authored lanes.
  for (let x = 0; x <= 5; x += 1) {
    for (let y = 4; y <= 7; y += 1) cells[y][x] = Math.max(0, cells[y][x]);
  }
  for (let x = 19; x < STAGE_GRID_WIDTH; x += 1) {
    for (let y = 4; y <= 7; y += 1) cells[y][x] = Math.max(0, cells[y][x]);
  }

  // The two authored reconnect columns are deliberately walkable. They create
  // route-switch decisions without merging the lane interiors.
  for (const x of [meta.junctionA, meta.junctionB]) {
    for (let y = LANES[0]; y <= LANES[2]; y += 1) cells[y][x] = Math.max(0, cells[y][x]);
  }

  for (const node of meta.nodes) {
    const x = Math.floor(node.x);
    const y = Math.floor(node.y);
    cells[y][x] = Math.max(0, cells[y][x]);
  }

  const frozenCells = Object.freeze(cells.map((row) => Object.freeze(row)));
  const routes = Object.freeze(mutableRoutes.map((route, laneIndex) => Object.freeze({
    id: slug(meta.routeNames[laneIndex]),
    name: meta.routeNames[laneIndex],
    lane: laneIndex,
    affordance: meta.affordances[laneIndex],
    cells: Object.freeze(route.map(({ x, y }) => Object.freeze({ x, y }))),
  })));

  const hostileSpawns = Object.freeze(routes.map((route, laneIndex) => {
    const cell = [...route.cells].reverse().find((candidate) => candidate.x < meta.junctionB && candidate.y === LANES[laneIndex]);
    return Object.freeze({ id: `hostile-${laneIndex + 1}`, x: cell.x + 0.5, y: cell.y + 0.5, routeIndex: laneIndex });
  }));

  const anchors = Object.freeze({
    portal: Object.freeze({ id: "portal", x: 1, y: 5.5 }),
    boss: Object.freeze({ id: "boss", x: 22, y: 5.5 }),
    extractor: Object.freeze({ id: "extractor", x: 7.5, y: 5.5 }),
    rally: Object.freeze({ id: "rally", x: 3, y: 5.5 }),
    alliedSpawn: Object.freeze({ id: "allied-spawn", x: 1.5, y: 5.5 }),
    hostileSpawns,
    nodes: meta.nodes,
  });

  const zones = Object.freeze(routes.map((route) => Object.freeze({
    id: `lane-${route.lane + 1}`,
    name: route.name,
    kind: route.affordance,
    cells: Object.freeze(route.cells.filter((cell) => cell.x > meta.junctionA && cell.x < meta.junctionB)),
  })));

  return { meta, cells: frozenCells, routes, anchors, zones };
}

function cellCoordinate(value, limit) {
  return Math.max(0, Math.min(limit - 1, Math.floor(Number(value) || 0)));
}

function findPath(cells, start, goal, allowedKeys = null) {
  const width = STAGE_GRID_WIDTH;
  const height = STAGE_GRID_HEIGHT;
  const sx = cellCoordinate(start?.x, width);
  const sy = cellCoordinate(start?.y, height);
  const gx = cellCoordinate(goal?.x, width);
  const gy = cellCoordinate(goal?.y, height);
  const startIndex = sy * width + sx;
  const goalIndex = gy * width + gx;
  const parent = new Int16Array(width * height);
  parent.fill(-1);
  const queue = new Int16Array(width * height);
  let read = 0;
  let write = 0;

  const permitted = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height || cells[y][x] < 0) return false;
    return !allowedKeys || allowedKeys.has(y * width + x) || x <= 5 || x >= 19;
  };
  if (!permitted(sx, sy) || !permitted(gx, gy)) return null;

  parent[startIndex] = startIndex;
  queue[write++] = startIndex;
  const directions = Object.freeze([[1, 0], [0, -1], [0, 1], [-1, 0]]);

  while (read < write) {
    const current = queue[read++];
    if (current === goalIndex) break;
    const x = current % width;
    const y = Math.floor(current / width);
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (!permitted(nx, ny)) continue;
      const next = ny * width + nx;
      if (parent[next] !== -1) continue;
      if (Math.abs(cells[ny][nx] - cells[y][x]) > 1) continue;
      parent[next] = current;
      queue[write++] = next;
    }
  }

  if (parent[goalIndex] === -1) return null;
  const path = [];
  for (let current = goalIndex; ; current = parent[current]) {
    path.push({ x: current % width, y: Math.floor(current / width) });
    if (current === startIndex) break;
  }
  return path.reverse();
}

export function buildStageHeightfield(stageNumber) {
  return createStageNavigation(stageNumber).cells;
}

export function createStageNavigation(stageNumber) {
  const { meta, cells, routes, anchors, zones } = compile(stageNumber);
  const routeKeySets = routes.map((route) => new Set(route.cells.map((cell) => cell.y * STAGE_GRID_WIDTH + cell.x)));
  const heightAt = (x, y) => {
    const column = Math.floor(x);
    const row = Math.floor(y);
    return column < 0 || row < 0 || column >= STAGE_GRID_WIDTH || row >= STAGE_GRID_HEIGHT ? -1 : cells[row][column];
  };
  const walkable = (x, y) => heightAt(x, y) >= 0;
  const climbOk = (x0, y0, x1, y1) => {
    const from = heightAt(x0, y0);
    const to = heightAt(x1, y1);
    return from >= 0 && to >= 0 && Math.abs(to - from) <= 1;
  };
  const gridToWorld = (x, y) => Object.freeze({ x: x - STAGE_GRID_WIDTH / 2, z: y - STAGE_GRID_HEIGHT / 2 });
  const worldToGrid = (x, z) => Object.freeze({ x: x + STAGE_GRID_WIDTH / 2, y: z + STAGE_GRID_HEIGHT / 2 });

  return Object.freeze({
    stageNumber: meta.number,
    name: meta.name,
    width: STAGE_GRID_WIDTH,
    height: STAGE_GRID_HEIGHT,
    revision: `stage-${meta.number}-24x12-v1`,
    bounds: Object.freeze({ left: -12, right: 12, near: -6, far: 6 }),
    cells,
    anchors,
    routes,
    zones,
    heightAt,
    elevationAt: (x, y) => Math.max(0, heightAt(x, y)),
    walkable,
    climbOk,
    gridToWorld,
    worldToGrid,
    findPath: (start, goal, options = {}) => {
      const routeIndex = Number.isInteger(options.routeIndex) ? options.routeIndex : null;
      return findPath(cells, start, goal, routeIndex === null ? null : routeKeySets[routeIndex] ?? null);
    },
    routePath: (routeIndex, reverse = false) => {
      const route = routes[routeIndex];
      if (!route) return null;
      const source = reverse ? [...route.cells].reverse() : route.cells;
      return source.map(({ x, y }) => ({ x, y }));
    },
    getAnchorById: (id) => {
      if (typeof id !== "string") return null;
      if (id in anchors && !Array.isArray(anchors[id])) return anchors[id];
      return [...anchors.hostileSpawns, ...anchors.nodes].find((anchor) => anchor.id === id) ?? null;
    },
    getNodeByIndex: (index) => anchors.nodes[index] ?? null,
  });
}

export function validateStageNavigation(stageNumber) {
  const navigation = createStageNavigation(stageNumber);
  const meta = STAGES[navigation.stageNumber - 1];
  if (navigation.width !== 24 || navigation.height !== 12) return false;
  if (!Object.isFrozen(navigation.cells) || navigation.cells.length !== 12) return false;
  if (navigation.cells.some((row) => !Object.isFrozen(row) || row.length !== 24)) return false;
  if (navigation.routes.length !== 3 || navigation.zones.length !== 3) return false;
  if (navigation.anchors.nodes.length !== EXPECTED_NODE_COUNTS[navigation.stageNumber - 1]) return false;

  const anchorKeys = new Set();
  for (const anchor of [
    navigation.anchors.portal,
    navigation.anchors.boss,
    navigation.anchors.extractor,
    navigation.anchors.rally,
    navigation.anchors.alliedSpawn,
    ...navigation.anchors.hostileSpawns,
    ...navigation.anchors.nodes,
  ]) {
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return false;
    if (!navigation.walkable(anchor.x, anchor.y)) return false;
    if (anchor.id.startsWith("node-") && anchorKeys.has(`${anchor.x},${anchor.y}`)) return false;
    anchorKeys.add(`${anchor.x},${anchor.y}`);
    if (!navigation.findPath(navigation.anchors.portal, anchor)) return false;
  }

  const routeLengths = navigation.routes.map((route) => route.cells.length);
  if (routeLengths.some((length, index) => length !== meta.lengths[index])) return false;
  if (Math.max(...routeLengths) / Math.min(...routeLengths) > 1.35) return false;

  for (const route of navigation.routes) {
    if (!route.affordance || !Object.isFrozen(route.cells)) return false;
    if (route.cells[0].x !== 1 || route.cells[0].y !== 5) return false;
    if (route.cells.at(-1).x !== 22 || route.cells.at(-1).y !== 5) return false;
    for (let index = 0; index < route.cells.length; index += 1) {
      const cell = route.cells[index];
      if (!navigation.walkable(cell.x, cell.y)) return false;
      if (index > 0) {
        const previous = route.cells[index - 1];
        if (Math.abs(previous.x - cell.x) + Math.abs(previous.y - cell.y) !== 1) return false;
        if (!navigation.climbOk(previous.x, previous.y, cell.x, cell.y)) return false;
      }
    }
  }

  const interiorSets = navigation.routes.map((route) => new Set(
    route.cells
      .filter((cell) => cell.x > meta.junctionA && cell.x < meta.junctionB)
      .map((cell) => `${cell.x},${cell.y}`),
  ));
  for (let index = 0; index < interiorSets.length; index += 1) {
    const cells = interiorSets[index];
    let nonShared = 0;
    for (const key of cells) {
      if (interiorSets.every((other, otherIndex) => otherIndex === index || !other.has(key))) nonShared += 1;
    }
    if (cells.size === 0 || nonShared / cells.size < 0.5) return false;
  }
  return true;
}
