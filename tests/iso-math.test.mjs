import assert from "node:assert/strict";
import test from "node:test";

import {
  TILE_W,
  TILE_H,
  ELEV_H,
  LAYER,
  worldToScreen,
  screenToWorldFlat,
  pickTile,
  depthKey,
  findPath,
  steer,
  rectContains,
  directionIndex,
  mulberry32,
} from "../iso-math.js";

// Contract evidence: docs/shadow-lord-rts-rpg-hybrid-design.md 2:1 dimetric
// projection model. Every test asserts a property (round-trip, monotonicity,
// ordering, exclusion) — never a restatement of the projection formula.

// --- helpers ----------------------------------------------------------------

function assertCardinalSteps(path, label) {
  for (let i = 1; i < path.length; i++) {
    const dx = Math.abs(path[i].x - path[i - 1].x);
    const dy = Math.abs(path[i].y - path[i - 1].y);
    assert.equal(
      dx + dy,
      1,
      `${label}: step ${i - 1}->${i} (${path[i - 1].x},${path[i - 1].y})->(${path[i].x},${path[i].y}) must be a single cardinal move (no diagonals, no jumps)`
    );
  }
}

// --- INV-1: flat round-trip -------------------------------------------------

test("INV-1 screenToWorldFlat inverts worldToScreen exactly at z=0 for integer and dyadic coordinates", () => {
  const points = [
    [0, 0],
    [1, 0],
    [0, 1],
    [5, 3],
    [-4, 7],
    [-9, -13],
    [2.5, -1.25],
    [-0.75, -0.5],
    [1000, -999],
  ];
  for (const [x, y] of points) {
    const s = worldToScreen(x, y, 0);
    const back = screenToWorldFlat(s.x, s.y);
    assert.equal(back.x, x, `round-trip x for world (${x},${y}) via screen (${s.x},${s.y})`);
    assert.equal(back.y, y, `round-trip y for world (${x},${y}) via screen (${s.x},${s.y})`);
  }
});

test("INV-1 round-trip holds within 1e-9 across a seeded sweep of arbitrary real coordinates", () => {
  const seed = 20260716;
  const rand = mulberry32(seed);
  for (let i = 0; i < 200; i++) {
    const x = (rand() - 0.5) * 200;
    const y = (rand() - 0.5) * 200;
    const s = worldToScreen(x, y, 0);
    const back = screenToWorldFlat(s.x, s.y);
    assert.ok(
      Math.abs(back.x - x) < 1e-9 && Math.abs(back.y - y) < 1e-9,
      `round-trip drift at sweep #${i} (seed ${seed}): world (${x},${y}) came back as (${back.x},${back.y})`
    );
  }
});

// --- INV-2: 2:1 dimetric ratio ----------------------------------------------

test("INV-2 unit world steps project to half-tile screen deltas with a 2:1 ratio from any base point", () => {
  assert.deepEqual(worldToScreen(1, 0, 0), { x: 32, y: 16 }, "+x_w unit vector must land at (32,16)");
  assert.deepEqual(worldToScreen(0, 1, 0), { x: -32, y: 16 }, "+y_w unit vector must land at (-32,16)");

  // The projection is affine: the same delta must hold from every base point,
  // including negative and fractional coordinates.
  const bases = [
    [0, 0],
    [-7, 4],
    [3.5, 6.25],
    [100, -50],
  ];
  for (const [bx, by] of bases) {
    const o = worldToScreen(bx, by, 0);
    const px = worldToScreen(bx + 1, by, 0);
    const py = worldToScreen(bx, by + 1, 0);
    assert.equal(px.x - o.x, TILE_W / 2, `+x_w step from (${bx},${by}) must move +TILE_W/2 on screen x`);
    assert.equal(px.y - o.y, TILE_H / 2, `+x_w step from (${bx},${by}) must move +TILE_H/2 on screen y`);
    assert.equal(py.x - o.x, -TILE_W / 2, `+y_w step from (${bx},${by}) must move -TILE_W/2 on screen x`);
    assert.equal(py.y - o.y, TILE_H / 2, `+y_w step from (${bx},${by}) must move +TILE_H/2 on screen y`);
    assert.equal(
      Math.abs((px.x - o.x) / (px.y - o.y)),
      2,
      `screen step from (${bx},${by}) must keep the 2:1 dimetric ratio`
    );
  }
});

// --- INV-3: elevation offset ------------------------------------------------

test("INV-3 each elevation step lifts screen y by exactly ELEV_H and never touches screen x", () => {
  const points = [
    [0, 0],
    [2, 5],
    [-3, -4],
    [7.5, 0.25],
  ];
  for (const [x, y] of points) {
    for (let z = 0; z < 4; z++) {
      const low = worldToScreen(x, y, z);
      const high = worldToScreen(x, y, z + 1);
      assert.equal(low.y - high.y, ELEV_H, `z ${z}->${z + 1} at (${x},${y}) must raise the sprite by ELEV_H px`);
      assert.equal(high.x, low.x, `elevation at (${x},${y}) must not shift screen x`);
    }
    const flat = worldToScreen(x, y, 0);
    const tall = worldToScreen(x, y, 5);
    assert.equal(flat.y - tall.y, 5 * ELEV_H, `elevation offset must be linear in z at (${x},${y})`);
  }
});

// --- INV-4: pickTile column scan --------------------------------------------

test("INV-4 pickTile resolves flat clicks to their tile, lets raised tiles occlude, and rejects vacated ground", () => {
  const SIZE = 5;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const flatField = (x, y) => (inBounds(x, y) ? 0 : -1);
  // Single mesa: tile (2,2) rises to z=2, everything else flat.
  const mesaField = (x, y) => (inBounds(x, y) ? (x === 2 && y === 2 ? 2 : 0) : -1);

  // Flat ground: clicking the center of tile (3,1) picks exactly that tile.
  const flatCenter = worldToScreen(3.5, 1.5, 0);
  assert.deepEqual(
    pickTile(flatCenter.x, flatCenter.y, flatField, 4),
    { x: 3, y: 1, z: 0 },
    "flat field: click at the projected center of (3,1) must pick (3,1) at z=0"
  );

  // The mesa's screen anchor is its flat anchor lifted by z*ELEV_H. Clicking
  // there must pick the raised tile — the column scan finds the top first.
  const mesaFlat = worldToScreen(2.5, 2.5, 0);
  assert.deepEqual(
    pickTile(mesaFlat.x, mesaFlat.y - 2 * ELEV_H, mesaField, 4),
    { x: 2, y: 2, z: 2 },
    "mesa field: click at the raised position of (2,2) must pick it at z=2"
  );

  // The mesa vacated its old flat footprint: nothing occupies that screen
  // point any more, so the click must fall through to null — a picker that
  // ignores elevation would wrongly return (2,2) here.
  assert.equal(
    pickTile(mesaFlat.x, mesaFlat.y, mesaField, 4),
    null,
    "mesa field: click at the vacated flat position of (2,2) must pick nothing"
  );

  // Clicks far outside the heightfield resolve to null, not a phantom tile.
  assert.equal(pickTile(-1000, -1000, mesaField, 4), null, "off-map click must return null");
});

// --- INV-5: depthKey painter ordering ----------------------------------------

test("INV-5 depthKey orders layers on a tile, keeps larger (x+y) in front, and breaks (x+y) ties by z", () => {
  // (a) Same tile, same z: strict layer ladder ground < prop < unit < fx.
  const ladder = ["ground", "prop", "unit", "fx"];
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(
      depthKey(2, 3, 0, LAYER[ladder[i - 1]]) < depthKey(2, 3, 0, LAYER[ladder[i]]),
      `on one tile, ${ladder[i - 1]} must sort behind ${ladder[i]}`
    );
  }

  // (b) Larger (x+y) always wins — even a max-elevation fx on the north tile
  // must stay behind bare ground one row south. This is what draws a unit at
  // (2,3) in front of a wall at (2,2).
  assert.ok(
    depthKey(2, 2, 8, LAYER.fx) < depthKey(2, 3, 0, LAYER.ground),
    "north tile at max elevation + top layer must still sort behind the south tile's ground"
  );
  assert.ok(
    depthKey(2, 2, 2, LAYER.prop) < depthKey(2, 3, 0, LAYER.unit),
    "a unit standing south of a 2-high wall prop must draw in front of it"
  );

  // (c) Equal (x+y): higher z draws in front, on one tile and across tiles.
  assert.ok(
    depthKey(3, 2, 0, LAYER.unit) < depthKey(3, 2, 1, LAYER.unit),
    "same tile: the higher of two stacked units must draw in front"
  );
  assert.ok(
    depthKey(2, 3, 0, LAYER.unit) < depthKey(4, 1, 2, LAYER.unit),
    "equal (x+y) across tiles: the higher-elevation unit must draw in front"
  );
});

// --- INV-6: findPath ----------------------------------------------------------

test("INV-6a findPath returns Manhattan-shortest cardinal paths on an open field", () => {
  const open = { walkable: () => true, width: 10, height: 10 };

  const straight = findPath({ x: 2, y: 3 }, { x: 7, y: 3 }, open);
  assert.ok(straight, "straight-line path must exist on an open field");
  assert.equal(straight.length, 5 + 0 + 1, "straight path length must be dx+dy+1");
  assert.deepEqual(straight[0], { x: 2, y: 3 }, "path must begin at start");
  assert.deepEqual(straight.at(-1), { x: 7, y: 3 }, "path must end at goal");
  assertCardinalSteps(straight, "open-field straight path");

  const bent = findPath({ x: 1, y: 1 }, { x: 4, y: 5 }, open);
  assert.ok(bent, "L-path must exist on an open field");
  assert.equal(bent.length, 3 + 4 + 1, "L-path length must be dx+dy+1 (diagonals would shorten it)");
  assertCardinalSteps(bent, "open-field L-path");

  const trivial = findPath({ x: 2, y: 2 }, { x: 2, y: 2 }, open);
  assert.deepEqual(trivial, [{ x: 2, y: 2 }], "start===goal must yield the single-cell path");
});

test("INV-6b findPath detours around a wall without ever standing on a wall tile", () => {
  // 8x8 field, solid wall on column x=4 except one gap at (4,7).
  const isWall = (x, y) => x === 4 && y !== 7;
  const grid = { walkable: (x, y) => !isWall(x, y), width: 8, height: 8 };

  const path = findPath({ x: 0, y: 0 }, { x: 7, y: 0 }, grid);
  assert.ok(path, "a path through the (4,7) gap must exist");
  for (const cell of path) {
    assert.ok(!isWall(cell.x, cell.y), `path must never include wall tile (${cell.x},${cell.y})`);
    assert.ok(
      cell.x >= 0 && cell.y >= 0 && cell.x < 8 && cell.y < 8,
      `path cell (${cell.x},${cell.y}) must stay inside the grid`
    );
  }
  assertCardinalSteps(path, "wall detour");
  assert.ok(
    path.some((c) => c.x === 4 && c.y === 7),
    "every legal crossing runs through the single gap at (4,7)"
  );
  // A* with the admissible Manhattan heuristic must stay optimal:
  // 11 steps to the gap + 10 steps from the gap = 21 steps = 22 cells.
  assert.equal(path.length, 22, "detour must be the shortest legal path (22 cells through the gap)");
});

test("INV-6c findPath returns null for unreachable goals instead of looping or guessing", () => {
  const wallColumn = { walkable: (x) => x !== 2, width: 5, height: 5, };
  assert.equal(
    findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, wallColumn),
    null,
    "a full wall column must make the far side unreachable"
  );

  const boxedGoal = {
    walkable: (x, y) => !((Math.abs(x - 3) === 1 && y === 3) || (x === 3 && Math.abs(y - 3) === 1)),
    width: 7,
    height: 7,
  };
  assert.equal(
    findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, boxedGoal),
    null,
    "a goal boxed in by four unwalkable neighbors must be unreachable"
  );
});

test("INV-6d findPath respects climbOk cliffs and only crosses via the ramp", () => {
  const SIZE = 6;
  // Plateau at x>=3 (z=2), lowland at x<3 (z=0), single ramp tile (3,3) at z=1.
  const elev = (x, y) => (x === 3 && y === 3 ? 1 : x >= 3 ? 2 : 0);
  const slopeRule = (x, y, nx, ny) => Math.abs(elev(nx, ny) - elev(x, y)) <= 1;
  const grid = { walkable: () => true, climbOk: slopeRule, width: SIZE, height: SIZE };

  const path = findPath({ x: 0, y: 0 }, { x: 5, y: 0 }, grid);
  assert.ok(path, "lowland to plateau must be reachable through the ramp");
  assertCardinalSteps(path, "cliff climb");
  assert.ok(
    path.some((c) => c.x === 3 && c.y === 3),
    "the only legal cliff crossing is the ramp at (3,3)"
  );
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    assert.ok(
      slopeRule(a.x, a.y, b.x, b.y),
      `step (${a.x},${a.y})->(${b.x},${b.y}) climbs ${Math.abs(elev(b.x, b.y) - elev(a.x, a.y))} levels — cliff edge crossed`
    );
  }

  // Remove the ramp: the cliff face is now sheer everywhere -> unreachable.
  const sheer = (x) => (x >= 3 ? 2 : 0);
  const sheerRule = (x, y, nx, ny) => Math.abs(sheer(nx) - sheer(x)) <= 1;
  assert.equal(
    findPath({ x: 0, y: 0 }, { x: 5, y: 0 }, { walkable: () => true, climbOk: sheerRule, width: SIZE, height: SIZE }),
    null,
    "with no ramp, a 2-level cliff must be impassable"
  );
});

// --- INV-7: steering separation ------------------------------------------------

test("INV-7 steer passes preferred through when alone, pushes away from close neighbors, ignores far ones", () => {
  const opts = { separationRadius: 0.5, separationWeight: 1 };
  const unit = { x: 3, y: 4 };
  const preferred = { x: 0.7, y: -0.2 };

  // (a) No neighbors -> preferred velocity untouched.
  assert.deepEqual(steer(unit, preferred, [], opts), preferred, "no neighbors must leave preferred unchanged");
  assert.deepEqual(
    steer(unit, preferred, [unit], opts),
    preferred,
    "the unit itself in the neighbor list must be ignored"
  );

  // (b) Close neighbor to the east (+x) -> push component points west (-x).
  const east = steer(unit, preferred, [{ x: 3.3, y: 4 }], opts);
  assert.ok(east.x < preferred.x, `east neighbor must push x below preferred (got ${east.x})`);
  assert.equal(east.y, preferred.y, "a purely-east neighbor must not add any y push");

  // Close neighbor at -y -> push component points toward +y.
  const north = steer(unit, preferred, [{ x: 3, y: 3.7 }], opts);
  assert.ok(north.y > preferred.y, `-y neighbor must push y above preferred (got ${north.y})`);
  assert.equal(north.x, preferred.x, "a purely -y neighbor must not add any x push");

  // Closer neighbors push harder (monotone separation strength).
  const near = steer(unit, preferred, [{ x: 3.1, y: 4 }], opts);
  assert.ok(
    preferred.x - near.x > preferred.x - east.x,
    "a nearer neighbor must produce a strictly stronger push than a farther one"
  );

  // (c) Neighbor outside separationRadius -> ignored entirely.
  assert.deepEqual(
    steer(unit, preferred, [{ x: 3.9, y: 4 }], opts),
    preferred,
    "a neighbor beyond separationRadius must not perturb the velocity"
  );

  // Degenerate overlap (distance 0) must be skipped, never NaN.
  const overlapped = steer(unit, preferred, [{ x: 3, y: 4 }], opts);
  assert.ok(Number.isFinite(overlapped.x) && Number.isFinite(overlapped.y), "co-located neighbor must not produce NaN");
  assert.deepEqual(overlapped, preferred, "co-located neighbor carries no direction and must be skipped");
});

// --- INV-8: rect containment ---------------------------------------------------

test("INV-8 rectContains is orientation-independent and classifies inside/outside for inverted rects", () => {
  const inverted = { x0: 10, y0: 20, x1: -5, y1: 3 };
  assert.ok(rectContains(inverted, 0, 10), "interior point must be inside a corner-swapped drag rect");
  assert.ok(!rectContains(inverted, 11, 10), "point east of the rect must be outside");
  assert.ok(!rectContains(inverted, 0, 21), "point south of the rect must be outside");
  assert.ok(!rectContains(inverted, -6, 10), "point west of the rect must be outside");
  assert.ok(!rectContains(inverted, 0, 2), "point north of the rect must be outside");

  // Dragging the same box in any of the four corner orders selects the same units.
  const orientations = [
    { x0: -5, y0: 3, x1: 10, y1: 20 },
    { x0: 10, y0: 3, x1: -5, y1: 20 },
    { x0: -5, y0: 20, x1: 10, y1: 3 },
    { x0: 10, y0: 20, x1: -5, y1: 3 },
  ];
  const probes = [
    [0, 10],
    [-5, 3],
    [10, 20],
    [12, 10],
    [0, -1],
  ];
  for (const [px, py] of probes) {
    const verdicts = orientations.map((r) => rectContains(r, px, py));
    assert.ok(
      verdicts.every((v) => v === verdicts[0]),
      `containment of (${px},${py}) must not depend on drag direction (got ${verdicts})`
    );
  }
});

// --- INV-9: 8-direction sprite index ---------------------------------------------

test("INV-9 directionIndex maps the 8 movement directions to distinct indices 0..7, magnitude-invariant", () => {
  // Cardinal anchors from the contract (index 0 = +x, counter-clockwise).
  assert.equal(directionIndex(1, 0), 0, "(+x) east must map to index 0");
  assert.equal(directionIndex(0, -1), 2, "(-y) north must map to index 2");
  assert.equal(directionIndex(-1, 0), 4, "(-x) west must map to index 4");
  assert.equal(directionIndex(0, 1), 6, "(+y) south must map to index 6");

  // All 8 unit directions must map onto all 8 sprite indices (near-bijection).
  const compass = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  const indices = compass.map(([dx, dy]) => directionIndex(dx, dy));
  assert.deepEqual(
    [...new Set(indices)].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7],
    "the 8 compass directions must cover all 8 sprite indices without collisions"
  );

  // Sprite choice depends on direction only, never on speed.
  for (const [dx, dy] of compass) {
    assert.equal(
      directionIndex(dx * 7.5, dy * 7.5),
      directionIndex(dx, dy),
      `scaling (${dx},${dy}) by 7.5 must not change the sprite index`
    );
  }

  // Any real movement vector resolves to an integer index in 0..7.
  const rand = mulberry32(42);
  for (let i = 0; i < 64; i++) {
    const dx = rand() - 0.5;
    const dy = rand() - 0.5;
    const idx = directionIndex(dx, dy);
    assert.ok(
      Number.isInteger(idx) && idx >= 0 && idx <= 7,
      `directionIndex(${dx},${dy}) must be an integer in 0..7 (got ${idx})`
    );
  }
});

// --- INV-10: seeded PRNG -----------------------------------------------------------

test("INV-10 mulberry32 replays identically per seed, diverges across seeds, and stays in [0,1)", () => {
  const draw5 = (seed) => {
    const r = mulberry32(seed);
    return [r(), r(), r(), r(), r()];
  };

  assert.deepEqual(draw5(1234), draw5(1234), "same seed must replay the exact same choreography");
  assert.deepEqual(draw5(0), draw5(0), "seed 0 must also be deterministic");
  assert.notDeepEqual(draw5(1234), draw5(5678), "different seeds must produce different sequences");

  for (const seed of [0, 1, 1234, 0xdeadbeef]) {
    const r = mulberry32(seed);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1, `draw #${i} of seed ${seed} must lie in [0,1) (got ${v})`);
    }
  }
});
