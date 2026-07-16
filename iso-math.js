// Pure 2:1 dimetric ("isometric") math for the battle view.
// No DOM, no WebGL — everything here is unit-testable in Node.
//
// Model (from the 2.5D RTS architecture report):
// - Logic runs on a Cartesian tile grid (x_w, y_w) with integer elevation z_w.
// - Screen projection is the industry 2:1 dimetric map (~26.565° horizon angle):
//     x_s = (x_w - y_w) * TILE_W/2
//     y_s = (x_w + y_w) * TILE_H/2 - z_w * ELEV_H
// - Parallel projection: no perspective shortening, units keep constant size.
// - Depth sorting uses the floor-height rule: painter key from (x_w + y_w),
//   elevation and a per-layer bias, so ground < node/prop < unit on the same tile.

export const TILE_W = 64;
export const TILE_H = 32;
export const ELEV_H = 16; // screen pixels per elevation step

// Layer biases for the painter queue. Ground strictly below everything on the
// same tile; props (nodes, portals) below units standing on the same tile.
export const LAYER = Object.freeze({ ground: 0, prop: 0.25, unit: 0.5, fx: 0.75 });

export function worldToScreen(xw, yw, zw = 0) {
  return {
    x: (xw - yw) * (TILE_W / 2),
    y: (xw + yw) * (TILE_H / 2) - zw * ELEV_H
  };
}

// Inverse for flat ground (z_w = 0). Fractional tile coordinates.
export function screenToWorldFlat(xs, ys) {
  const a = xs / (TILE_W / 2);
  const b = ys / (TILE_H / 2);
  return { x: (b + a) / 2, y: (b - a) / 2 };
}

// Column-scan picking over a heightfield (top elevation first), per the
// report's screen-space column scanning algorithm. `heightAt(x, y)` returns
// integer elevation or -1 for out-of-bounds. Returns the picked integer tile
// or null.
export function pickTile(xs, ys, heightAt, maxElevation = 8) {
  for (let z = maxElevation; z >= 0; z--) {
    const flat = screenToWorldFlat(xs, ys + z * ELEV_H);
    const tx = Math.floor(flat.x);
    const ty = Math.floor(flat.y);
    const h = heightAt(tx, ty);
    if (h === z) return { x: tx, y: ty, z };
  }
  return null;
}

// Painter depth key. Higher = drawn later (in front).
export function depthKey(xw, yw, zw = 0, layer = LAYER.unit) {
  return (xw + yw) + zw * 0.001 + layer;
}

// --- A* over the tile grid -------------------------------------------------
// walkable(x, y) -> boolean. 4-neighborhood with |Δelevation| ≤ 1 allowed via
// climbOk callback (slope rule); diagonal steps excluded to keep formation
// lanes readable.
export function findPath(start, goal, { walkable, climbOk = () => true, width, height }) {
  const key = (x, y) => y * width + x;
  const open = new Map();
  const gScore = new Map();
  const cameFrom = new Map();
  const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  const startKey = key(start.x, start.y);
  open.set(startKey, { x: start.x, y: start.y, f: h(start.x, start.y) });
  gScore.set(startKey, 0);

  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let guard = width * height * 4;

  while (open.size > 0 && guard-- > 0) {
    let currentKey = null;
    let current = null;
    for (const [k, node] of open) {
      if (!current || node.f < current.f) { current = node; currentKey = k; }
    }
    if (current.x === goal.x && current.y === goal.y) {
      const path = [{ x: current.x, y: current.y }];
      let k = currentKey;
      while (cameFrom.has(k)) {
        k = cameFrom.get(k);
        const y = Math.floor(k / width);
        const x = k - y * width;
        path.push({ x, y });
      }
      return path.reverse();
    }
    open.delete(currentKey);
    for (const [dx, dy] of neighbors) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!walkable(nx, ny) || !climbOk(current.x, current.y, nx, ny)) continue;
      const nKey = key(nx, ny);
      const tentative = gScore.get(currentKey) + 1;
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, currentKey);
        gScore.set(nKey, tentative);
        const f = tentative + h(nx, ny);
        open.set(nKey, { x: nx, y: ny, f });
      }
    }
  }
  return null;
}

// --- Local steering (simplified reciprocal separation) ---------------------
// Blend a preferred velocity toward the next waypoint with a separation push
// away from close neighbors. This is the lightweight stand-in for full ORCA:
// with ≤30 units and 4-neighbor lanes it removes clumping without the LP solve.
export function steer(unit, preferred, neighbors, { separationRadius = 0.55, separationWeight = 0.8 } = {}) {
  let pushX = 0;
  let pushY = 0;
  for (const other of neighbors) {
    if (other === unit) continue;
    const dx = unit.x - other.x;
    const dy = unit.y - other.y;
    const d2 = dx * dx + dy * dy;
    if (d2 === 0 || d2 > separationRadius * separationRadius) continue;
    const d = Math.sqrt(d2);
    const strength = (separationRadius - d) / separationRadius;
    pushX += (dx / d) * strength;
    pushY += (dy / d) * strength;
  }
  return {
    x: preferred.x + pushX * separationWeight,
    y: preferred.y + pushY * separationWeight
  };
}

// Screen-space rect containment for drag selection (non-physics filter loop
// per the report: project unit positions, test Rect.contains in 2D).
export function rectContains(rect, px, py) {
  const x0 = Math.min(rect.x0, rect.x1);
  const x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1);
  const y1 = Math.max(rect.y0, rect.y1);
  return px >= x0 && px <= x1 && py >= y0 && py <= y1;
}

// 8-direction sprite index from a movement vector (for pre-rendered sheets).
// Index 0 = +x ("east" on grid), counter-clockwise in world space.
export function directionIndex(dx, dy) {
  if (dx === 0 && dy === 0) return 0;
  const angle = Math.atan2(-dy, dx); // grid y grows "down-right" on screen
  const sector = Math.round(angle / (Math.PI / 4));
  return ((sector % 8) + 8) % 8;
}

// Deterministic PRNG (mulberry32) — presentation-layer randomness must be
// seedable so a replayed battle shows the same choreography.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
