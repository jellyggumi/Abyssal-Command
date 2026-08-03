# Terrain tiles — making the floor contract machine-checked (spec §6.1)

Base: `origin/main` @ `5cc82bf6`, stacked on `feat/echo-throne-composition`.
Source: `_workspace/current/design/stage-dungeon-composition-spec.md` §1.1, §2.1–2.3, §6.1, risk R8.

## The gap this closes

The three stages already ship a **composed slab floor**: the promoted terrain GLBs carry
`terrain-{stage}-slab-{nnn}` quads — 3, 4 and 5 of them — plus an apron [OBSERVED, read from the
GLB JSON chunks and corroborated by the browser proof's `terrainIntegrity.meshCount` of 4 / 5 / 6].
But the catalog knew nothing about them. It carried **one** support collider of two triangles
spanning the whole bounds, so:

- nothing checked that the visible slabs tile the walkable bounds — the four tiling contracts of
  §1.1 were promised in a spec, not machine-checked;
- slab ids were never passed through `claimId`, so a slab id could silently duplicate a route or a
  prop id (spec risk **R8**);
- the visible floor and the walkable plane were the same rectangle only by coincidence of authoring.

## What lands

`gameplay.terrainTiles` on all three profiles, one entry per shipped slab:

| Stage | Tiles | Rects |
|---|---|---|
| cinder-span | 3 | 600–8600 · 8600–17000 · 17000–23400, all y 800–11200 |
| abyss-chancel | 4 | 600–8000 · 8000–16400 (full height), then 16400–23400 split at y 7200 |
| echo-throne | 5 | 600–6800 · the three 6800–16600 bands split at y 4000 / 8000 · 16600–23400 |

Each tile carries `id`, `index`, `name`, `materialId`, `plateNode`, `elevation: 0`, an integer
`rect`, and `colliderTriangleIndices`. The support mesh is re-authored from one bounds-spanning
quad into **two triangles per tile**, in tile order, so tile *N* owns triangles *2N* and *2N+1*.
Total area is unchanged and provably exact: 237 120 000 / 241 680 000 / 246 240 000, each equal to
its stage's bounds area.

## The validator extension

Added to `validateProfile` immediately before the route block, purely additive:

- every tile goes through `claimId`, so slab ids now share the stage-wide uniqueness set — R8 closed;
- `index`, `id`, `plateNode`, `materialId` and `elevation` must match the authored convention exactly;
- `rect` must be integer, non-empty and inside the walkable bounds;
- tiles may not overlap pairwise;
- `Σ tileArea` must equal the bounds area exactly — no gap, no overhang;
- the support mesh must carry exactly `2 × tiles.length` triangles;
- each tile's two named triangles must lie inside that tile's own rect.

## Proof it is not a no-op

Three mutations of the real catalog, each imported through the live validator
(`tests/stage-terrain-tiles-contract.test.mjs`, test 4) [OBSERVED]:

| Mutation | Result |
|---|---|
| slab-02 widened to overlap slab-01 | rejected — `Terrain tiles overlap: cinder-span:slab-02, cinder-span:slab-01` |
| slab-03 shifted to leave a 200-unit gap | rejected — `Terrain tiles must tile the walkable bounds exactly: cinder-span` |
| one slab's support triangles deleted | rejected — `Support mesh must carry two triangles per terrain tile: cinder-span` |

Plus three positive tests: exact tiling with no overlap, per-tile triangle ownership with no
unclaimed triangle, and **every authored `plateNode` resolving inside the shipped GLB** — which is
what keeps the catalog and the art asset from drifting apart silently.

## Evidence

- New suite `tests/stage-terrain-tiles-contract.test.mjs`: 4/4.
- Focused stage suites 54/54; gate checks 11/11 — **no digest movement**, as expected: partitioning
  one flat quad into per-slab quads changes the support mesh's description, not its geometry.
- Full `node --test 'tests/**/*.test.mjs'`: **611 tests, 581 pass, 5 fail, 25 skipped** — the same
  five pre-existing failures verified red on a pristine `origin/main` worktree.
- Pacing unchanged on all three stages (cinder 188–320 s, chancel 199–204 s, throne 206–222 s;
  doctrine window 180–360 s).
- Browser proof: all three stages pass, `terrainIntegrity.meshCount` 4 / 5 / 6 matching 3 / 4 / 5
  slabs plus one apron each.

## What this unlocks and what it does not

Unlocks: a stage can now be asked *which slab is this point on* from authored data, which is what
the gimmick set (spec §4) and any per-chamber material or audio treatment need.

Does not: no gimmicks, no seam inlay geometry, no material merge. `materialId` is authored but
nothing reads it yet — it is recorded so the renderer's future per-slab material pass has a source
of truth instead of a naming convention.
