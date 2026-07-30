# Stage dungeon composition spec — cycle 10

run-id: `20260728-onslaught-action-pivot` · cycle 10 · lane: `design`
owner: Level Designer (dungeon composition and routes)
engine: **Three.js + WebGL browser only**

Scope: turn each of the three canonical stages from one flat quad into a composed
dungeon floor of combined terrain slabs, with routes, gimmicks, landmarks,
obstacles, props and motivated lights.

Non-goals (owned elsewhere): wave timing and enemy composition
(`EncounterPacing`), drop and buff rules (`DropBuffSystem`), VFX cue authoring
(`VfxCueDesign`), audio (`AudioFeedbackDesign`), UI (`UiOverhaulConcept`).

Evidence marks: `[OBSERVED]` = read from source at the cited line, `[TARGET]` =
authored by this spec, `[INFERENCE]` = derived. **Every coordinate and every
count in this document is `[TARGET]`** unless the row says otherwise.

---

## 0. Binding invariants this spec must not break

All line numbers in this table were re-measured through an **absolute
`/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` path** at commit `033877ad`
and are valid for the implementation worktree. See §0.2 before relying on any
other citation in this document.

| # | Invariant | Source `[OBSERVED]`, dungeon tree @ `033877ad` |
|---|---|---|
| I1 | Arena `24000 × 12000`, gate at `(22000, 6000)` | `defense-catalog.js:12` |
| I2 | Critical route must terminate exactly at the gate | `stage-world-catalog.js:449-450` |
| I3 | Exactly **one** critical route and **one** optional detour per stage | `stage-world-catalog.js:434-435`, `tests/stage-world-encounter-routing-contract.test.mjs:263-264` |
| I4 | Critical waypoint roles are exactly `["ingress","intermediate-objective","intermediate-gate","final-gate"]` — **4 waypoints, exactly 2 intermediates** | `tests/stage-world-encounter-routing-contract.test.mjs:265-271`, `tests/defense-stage-world-movement.test.mjs:110-119` |
| I5 | Detour waypoint roles are exactly `["detour-entry","detour-objective","detour-exit"]` — **3 waypoints** | `tests/stage-world-encounter-routing-contract.test.mjs:272` |
| I6 | `corridorWidth >= 600` (`:438`); every waypoint inside `bounds` inset by `corridorWidth / 2` (`:443-444`) | `stage-world-catalog.js:438,443-444` |
| I7 | Route clearance: for every route segment, every obstacle **and** every prop must satisfy `pointSegmentDistance(centre, segStart, segEnd) >= radius + corridorWidth / 2` | `stage-world-catalog.js:456` (obstacles), `:478` (props) |
| I8 | `gameplay.surfaces` must be `[]` (`:416`); exactly **one** `meshCollider` (`:419`); triangles non-degenerate (`:429`); every vertex `elevation === 0` and **integer** | `stage-world-catalog.js:416,419,429`, `tests/defense-stage-world-movement.test.mjs:135-142` |
| I9 | Props: 8–14 entries, `elevation === 0`, inside bounds (`:465-466`), no pairwise overlap `dist >= rL + rR` (`:486-487`) | `stage-world-catalog.js:465-466,486-487` |
| I10 | Every obstacle needs a prop at the **identical** `x`, `y`, `radius` | `stage-world-catalog.js:468-471` |
| I11 | Obstacle centre must be `>= radius + 900` from the gate | `stage-world-catalog.js:414` |
| I12 | `>= 2` `motivated-light` + `>= 1` `fog-break` (`:501-502`); every anchor `>= obstacleRadius + 300` from every obstacle centre (`:505-508`); every motivated light sits on a **prop's exact x,y** (`:510-512`) | `stage-world-catalog.js:501-512` |
| I13 | Exactly 4 quest points (`:523`), distinct roles and placements (`:549-550`), ordered binding (`:551-558`); points 1–2 must equal `STAGE_ENCOUNTER_ROUTES[stage].objectives[].point`, point 3 `STAGE_TACTICS.occupation`, point 4 `STAGE_TACTICS.extraction` | `stage-world-catalog.js:523,549-558`, `tests/stage-world-quest-points.test.mjs:200-211` |
| I14 | ~~All three stages keep `terrainGlbPath: null`, `terrainRuntimeEligible: false`~~ — **SUPERSEDED, terrain was promoted mid-cycle.** All three now carry a `…/runtime/terrain/terrain-{stage}-floor.glb` path with `terrainRuntimeEligible: true` and **no** `terrainFallback`; the three catalog-contract tests were inverted to the promoted contract. What still binds: a profile may hold a promoted path **or** a fallback, never both, and a promoted path must live under `assets/mesh/terrain/**/runtime/**` and outside `/textured-candidate/` | `stage-world-catalog.js:126,128,205,207,287,289,392-395`; see §1.7 |
| I15 | **Cinder Span props are frozen**: exactly 12, with fixed ids, fixed `modelNode` names, and fixed placements bound to real GLB pack nodes | `tests/runtime-visual-assets.test.mjs:86,100-140`, `tests/stage-terrain-environment-contract.test.mjs:388-391` |
| I16 | Obstacle id `cinder-span:west-ash-wall` at `(19000, 4400) r940` is a live movement fixture | `tests/defense-stage-world-movement.test.mjs:17,76-101` |
| I17 | One flat gameplay plane at elevation 0; no stairs, ramps, pits, ledges or vertical traversal, ever | `author-game-levels` skill, "Enforce one gameplay plane" |
| I21 | **A corridor must admit the actor.** `COMMANDER.radius = 360`, so the commander diameter is **720**. Every authored `corridorWidth` and every gimmick `corridorWidthAfter` must exceed 720 — the validator's own 600 floor does not, and is therefore not a sufficient bound | `defense-catalog.js:20`, `stage-world-catalog.js:439` |
| I18 | `WORLD_SCALE = 14` (`:45`); `TERRAIN_TARGET_HALF_EXTENT = WORLD_SCALE * 1.15 = 16.1` (`:52`); each gameplay axis is normalised by **its own** dimension in `worldPointInto` (`:875-887`), so the 2:1 arena becomes a square in world space — deliberately | `battle-realtime-three.js:45,52,875-887` |
| I19 | Landmarks: `>= 4`, each referencing an existing prop id, `elevation === 0`, inside bounds | `stage-world-catalog.js:492-493` |
| I20 | Every world id must be stage-scoped (`{stageId}:`) or a `landmark.` id | `stage-world-catalog.js:404` |

**I15 is the hardest constraint in this cycle.** Cinder's twelve props are
addressed to real nodes inside
`assets/mesh/terrain/terrain-cinder-span/runtime/packs/*.glb`. This spec
therefore **re-uses all twelve Cinder prop placements unchanged** and authors
Cinder's slabs, routes, obstacles and gimmicks *around* them. Chancel and Throne
props are free and are re-authored.

### 0.1 Validation evidence for this spec

Every coordinate below was checked against the **real** `validateProfile`
(`stage-world-catalog.js:381-561`), not a re-implementation: the three authored
profiles were substituted into a copy of the module at
`/tmp/abyssal-slab-check/candidate-catalog-v6-final.mjs` (validator byte-identical;
the `defense-catalog.js` import rewritten to the absolute **dungeon-tree** path)
and imported with `cwd` set to the dungeon worktree, per director rulings R20/R35.

```
node --input-type=module -e 'await import("/tmp/abyssal-slab-check/candidate-catalog-v6-final.mjs")'
→ VALIDATOR PASS v6   (module-load-time validateProfile ran on all three stages, no throw)
```

`[OBSERVED]` from that run:

| Stage | slabs | Σ slab area | bounds area | tiles exactly | pairwise overlap | collider triangles | props | obstacles | tightest route margin | inset headroom |
|---|---|---|---|---|---|---|---|---|---|---|
| `cinder-span` | 3 | 237 120 000 | 237 120 000 | yes | 0 | 6 | 12 | 6 | **+49.86** (`collapsed-parapet` vs detour) | 50 |
| `abyss-chancel` | 4 | 241 680 000 | 241 680 000 | yes | 0 | 8 | 13 | 7 | **+301.24** (`nave-seal` vs detour) | 500 |
| `echo-throne` | 5 | 246 240 000 | 246 240 000 | yes | 0 | 10 | 13 | 7 | **+200.00** (`fractured-dais` vs critical) | 500 |

Margins are for the **final** corridor widths — critical **1400**, detour **900**,
all three stages — after the I21 commander-diameter revision. The last column is
waypoint inset headroom: how far the tightest waypoint sits inside the
`corridorWidth / 2` inset bound.

Cinder's `+49.86` is a **hard geometric limit, not slack left on the table**, and
§3.2 derives it. It is the smallest margin in the spec and it is deliberate; see
risk R2.

No test file was executed and no `qa/` artifact was written (director hard stop
on suite execution). The command above is a single module import, not a test run.

### 0.2 Citation policy — anchor on symbols, not line numbers

**Every code line number in this document has been re-measured through an
absolute `/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` path at commit
`033877ad` and is valid for the implementation worktree.** That was not true of
the first draft: this spec was authored in `/Users/jangyoung/orca/Abyssal-Surge`,
whose working tree carries uncommitted work from a concurrent session, and its
original citations were authoring-tree numbers.

The drift is real and large, and it is **not** uniform — some files match, some
are off by one, some by hundreds — so a spot-check can coincidentally pass while
the rest is wrong.

**Do not identify a tree by line count** (director ruling R32). Line counts were
used as discriminators early in this cycle and expired within hours: the dungeon
tree's own implementers grew `defense-catalog.js` past the figure that was
supposed to prove you were *not* in it. Following a stale count would talk a
correctly-located agent into "correcting" into the forbidden tree. **Identify the
tree by PATH.** The only non-decaying identity check is commit-addressed:
`git show 033877ad:<path>` returns the base blob regardless of any working tree. `stage-world-catalog.js`, the file
this spec is mostly about, is **byte-identical across both trees** (`diff -q`
reports no difference, 576 lines), which is why its citations survived; the
`defense-catalog.js` and `battle-realtime-three.js` citations did not and were
corrected. Corrections are itemised in the tables below, with the wrong value
kept in a labelled column rather than erased.

Rules for anyone implementing from this spec:

1. **The durable anchor is the symbol name and the quoted code text**, never the line number. Re-`grep` for `validateProfile`, `fitFootprint`, `worldPointInto`, `instantiateTerrainModel`, `effectAnchor`, `CRITICAL_VFX_EVENT_TYPES`, `STAGE_TACTICS`, `STAGE_ENCOUNTER_ROUTES`. Re-grep **immediately before each edit, every time** — not once at the start of a task. The file moves under you as your own edits land, and a sibling editing the same file moves it further (director ruling R33).
2. **Pass absolute worktree paths to every tool.** `[OBSERVED]` (reported by `AudioImpl`, consistent with the director's measurements): relative paths resolve against the workspace root, i.e. the tree you must not touch. Pass `cwd` on every shell call.
3. **If the code you find differs from what this spec quotes, stop and escalate** rather than adapting silently. An `[OBSERVED]` mark certifies code read in the authoring tree, not yours.
4. **Write hazard, not just read hazard** `[OBSERVED]` (director ruling R20, proven by `UiJoystickImpl`): the relative-path trap applies to `edit` and `write` too. A relative section header resolved against the forbidden tree and was stopped only by the stale-hash check — had the file been byte-identical across both trees the write would have landed silently in the wrong tree. Every `edit`/`write` header must carry the full absolute dungeon path, re-read through that same path immediately before the edit.

#### Standing policy — grep the blob before naming a payload field

`[OBSERVED]` director standing policy, adopted after **five** agents
independently hit the same class of bug in one cycle. Before introducing any
event-payload field name:

```
git show 033877ad:defense-run-simulation.js | grep -n <field>
```

A working-tree grep cannot answer this — it sees a concurrent session's
uncommitted work. Only the commit-addressed read is authoritative.

| Field | Blob status |
|---|---|
| `gimmickClass`, `slabId`, `blockId`, `dropId`, `buffId`, `rarity`, `stat`, `magnitude`, `stacks`, `durationTicks`, `expiresAtTick` | 0 occurrences — safe |
| `grade` | 0 as a field; 3 substring hits are the word "upgrade" in comments — safe, verified rather than assumed |
| `telegraphTicks` | **pre-exists** `:2296`, contest duration on `ENCOUNTER_PATH_CONTESTED` — must be type-gated (R12) |
| `recoveryTicks` | **pre-exists** `:1049`, retry window on `ENCOUNTER_RECOVERY_STARTED` — must be type-gated |
| `objectiveId` | **pre-exists heavily — 69 occurrences**, e.g. `:904`, `:959`, `:1012`, `:1046`, `:2084`. **This is a field I emit** on all three `GIMMICK_*` events, so it is the collision closest to home — see below |
| `reason` | **pre-exists with four incompatible vocabularies across six sites** — verified: `:1740` `"bounds"`/`"range"` (lowercase), `:2018` `"REWARD_ALREADY_OWNED"` and `:2044` `"M4_CARD_*"` (SCREAMING), `:2082` and `:2195`/`:2204` dynamic and nullable. The most dangerous of all of them, because the value sets do not overlap today, so a `reason`-keyed table fails **silently** — no throw, no wrong cue, just a gate that never fires. Invisible in review and in test |

**`objectiveId` deserves its own warning, because presence-keying it is the
subtlest trap in this family.** `ENCOUNTER_PATH_CONTESTED` carries `objectiveId`
*and* `telegraphTicks` — the two fields a gimmick telegraph would naturally key
on. A consumer that asks "does this event have an `objectiveId`?" instead of
"is this event a `GIMMICK_*`?" will render a **complete, plausible-looking
artefact** — real label, real lifetime, real objective — for a route contest
with no gimmick attached. Nothing looks broken. A defect that looks correct
survives review, survives QA, and ships.

The durable shape, for every consumer of my gimmick payloads:

```js
const GIMMICK_EVENTS = new Set(["GIMMICK_ARMED", "GIMMICK_TRIGGERED", "GIMMICK_RESOLVED"]);
if (!GIMMICK_EVENTS.has(event.type)) return;   // allow-set FIRST
// only now may objectiveId / telegraphTicks / slabId / gimmickClass be read
```

Allow-set before field read. Never presence-keying, never a shared cross-family
reader. Credit to `UiOverhaulConcept` for the `objectiveId` form of the finding
and to `AudioFeedbackDesign` for the `reason` enumeration; I verified both
against the blob.

**The allow-set may live one level up the call graph — and that is the case a
grep will not show you.** `[OBSERVED]`, verified at source in
`defense-audio.js`: `feedbackEventKey` composes a dedupe key by reading **every
id field it can find**, including `event?.objectiveId ?? ""` at `:984`. Read in
isolation that is exactly the presence-keying hazard above — type-agnostic by
design. It is safe only because `:968` guards the whole function:

```js
if (!FEEDBACK_EVENT_TYPES.has(event?.type) && !byId[event?.cue]) return null;   // :968
…
event?.objectiveId ?? "",                                                       // :984
```

`ENCOUNTER_PATH_CONTESTED` satisfies neither clause, so the function returns
before the read. Two lessons for anyone auditing this family:

1. **Grepping the field name is not sufficient.** A read can be type-agnostic at its own line and still be unreachable. Trace to the entry point before calling a site unsafe — and, symmetrically, before calling one safe.
2. **Unreachability is a property of the current call graph, not of the codebase.** `AudioFeedbackDesign`'s qualification is the right one to inherit: audio's immunity holds *because* `AUDIO_EVENT_POLICY` is the single entry point, and it evaporates the moment a consumer reads snapshot events outside `consume()`. The same is true of the renderer's `resolveVfxLifetimeTicks`. Both are **unreachable today, guarded-by-architecture tomorrow.** Neither should be inherited by a future reader as "that module is immune."

I introduced `telegraphTicks` without running this check, in a spec whose own
§0.2 is about verifying against the blob. The check costs one command.

#### Measured anchors — dungeon tree @ `033877ad`

`[OBSERVED]`, all measured through absolute
`/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` paths. **These supersede every
other line number in this document.**

`stage-world-catalog.js` — **576 lines, byte-identical across both trees**
(`diff -q` returns no difference), so its citations are the only ones in this
spec that were already safe:

| Symbol / rule | Line |
|---|---|
| `const bounds = (minX, …)` and the helper block | 14–52 |
| `const PROPS = Object.freeze` | 108 |
| cinder `terrainFallback` reason `authored-diorama-not-flat-gameplay-eligible` | 125 |
| `const validateProfile = (profile) =>` | 381 |
| "requires one eligible runtime strategy" throw | 391 |
| "World id must be stage-scoped" throw | 404 |
| "Obstacle blocks canonical gate geometry" throw | 414 |
| "must keep one flat accessible movement plane" throw | 416 |
| "requires one authored flat support mesh" throw | 419 |
| "Degenerate mesh collider triangle" throw | 429 |
| "requires one critical route and an optional detour" throw | 434–435 |
| "Invalid navigable corridor" (`corridorWidth >= 600`) | 438 |
| "Route waypoint leaves its navigable corridor" (inset) | 443–444 |
| "Critical route requires two intermediate waypoints" | 448 |
| "must terminate at the canonical gate" | 450 |
| "Obstacle blocks authored route" (clearance) | 456 |
| "Stage props must be sparse, flat, retained placements" (8–14) | 465–466 |
| "Obstacle requires matching visible geometry" | 468–471 |
| "Prop blocks authored route" (clearance) | 478 |
| "Stage prop instances overlap" | 486–487 |
| "Landmark requires a flat stage prop" | 492–493 |
| "Invalid occlusion-safe visibility anchors" | 501–509 |
| "Motivated light must remain attached to its visible emitter" | 510–512 |
| "requires exactly four quest points" | 523 |
| "Quest points require distinct visual roles and placements" | 549–550 |
| "Invalid ordered quest point" | 551–558 |

`defense-catalog.js` — **923 lines in the dungeon tree vs 1012 in the authoring
tree; the files DIFFER.** Re-measured:

| Symbol | Dungeon line | This spec originally cited |
|---|---|---|
| `export const ARENA` | 12 | 12 ✓ |
| `chokepath: { id: "cinder-center" …}` | 350 | — |
| `flank: { id: "cinder-south", entryX: 12000, entryY: 9800 }` | 351 | 351 ✓ |
| `hazard: { id: "ash-surge", x: 14800, y: 6000, radius: 1100 }` | 353 | 353 ✓ |
| `occupation: { id: "cinder-seal", … radius: 900 }` | 354 | 354 ✓ |
| `flank: { id: "chancel-transept", entryX: 12800, entryY: 10200 }` | **370** | 369 ✗ |
| `occupation: { id: "chancel-oath", … }` | 373 | — |
| chancel `spawnDirections: ["W", "SW", "NW"]` | **375** | 373 ✗ |
| `occupation: { id: "throne-domain", … radius: 800 }` | **382** | 381 ✗ |
| throne `spawnDirections: ["W", "SW", "NW"]` | 384 | — |
| objective point `{ x: 14600, y: 5200, radius: 1100 }` | 480 | — |
| objective point `{ x: 17400, y: 6000, radius: 1400 }` | 489 | — |
| objective point `{ x: 15000, y: 6000, radius: 1000 }` | 521 | — |
| objective point `{ x: 17600, y: 8200, radius: 1500 }` | 530 | — |
| objective point `{ x: 15200, y: 6000, radius: 1050 }` | 564 | — |
| objective point `{ x: 18000, y: 6000, radius: 1550 }` | 573 | — |
| `scripts/measure-stage-playtime.mjs` reference | 629 | 629 ✓ |

All six encounter objective points and all three occupation/extraction points
are **identical in value** across both trees, so every quest-point coordinate in
§2 is correct regardless of which tree an implementer reads.

`battle-realtime-three.js` — **4846 lines in the dungeon tree.** Re-measured:

| Symbol | Dungeon line | This spec originally cited |
|---|---|---|
| `const WORLD_SCALE = 14` | 45 | 45 ✓ |
| `const TERRAIN_TARGET_HALF_EXTENT` | 52 | 52 ✓ |
| `const CRITICAL_VFX_EVENT_TYPES` | **404** | 404–422 ✓ |
| `function worldPointInto` | **875–887** | 946-953 ✗ |
| `function effectAnchor` | **1136** | — |
| `function fitFootprint` | **1354** | 1427-1433 ✗ |
| `async function instantiateTerrainModel` | 1644 | — |
| `function instantiateProceduralTerrain` | **1654** | 1727-1745 ✗ |
| `async function instantiateStageProp` | 1717 | 1717 ✓ |
| `HemisphereLight(0xfff2d6, 0x140a06, 1.1)` | 2155 | 2155 ✓ |
| `DirectionalLight(0xffd9a8, 1.6)` | 2156 | 2156 ✓ |

`defense-run-simulation.js` — **3570 lines in the dungeon tree** (4002 in the
authoring tree). From the director's measured table: `combatRng` initialiser in
the run literal `:3217`, rehydration guard `:3446`, surprise roll `:3570`-region,
`getRunSnapshot` `:3489`, `getRunDigest` `:3555`, `SNAPSHOT_VERSION = 7` `:378`.
This spec's two original citations (`:3610`, `:3858`) were **past end-of-file in
both trees** and are corrected in §4.1 rule 7.

---

## 1. `terrainTiles` composition contract

A stage floor stops being one quad and becomes **N coplanar floor slabs** laid on
the elevation-0 plane. Slabs are chambers and connectors; together they tile the
stage's `gameplay.bounds` rectangle exactly.

### 1.1 Schema

New field: `profile.gameplay.terrainTiles: Slab[]`, authored immediately after
`bounds`. Factory to add to `stage-world-catalog.js` beside the existing helpers
(`stage-world-catalog.js:14-52`):

```js
const slab = (stageId, index, name, materialId, minX, maxX, minY, maxY) => ({
  id: `${stageId}:slab-${String(index).padStart(2, "0")}`,
  index,
  name,
  materialId,
  rect: { minX, maxX, minY, maxY },
  elevation: 0,
  plateNode: `terrain-${stageId}-slab-${String(index).padStart(3, "0")}`,
  colliderTriangleIndices: [(index - 1) * 2, (index - 1) * 2 + 1],
});
```

| Field | Type | Rule |
|---|---|---|
| `id` | string | Exactly `{stageId}:slab-{nn}`, `nn` zero-padded to 2, 1-based, contiguous. Director-ruled form. |
| `index` | integer | 1-based, matches `nn`, ascending, no gaps. Also the **seam-ownership priority**: lower index owns a shared edge. |
| `name` | string | Human-readable chamber name. Presentation only. |
| `materialId` | string | One of that stage's three ruled material ids (§1.5). Reuse across slabs is allowed and deliberate. |
| `rect` | `{minX,maxX,minY,maxY}` | **Integers**, gameplay units, `minX < maxX`, `minY < maxY`, fully inside `gameplay.bounds`. |
| `elevation` | `0` | Literal `0`. Any other value is a defect — I17. |
| `plateNode` | string | Exactly `terrain-{stageId}-slab-{nnn}`, `nnn` zero-padded to 3 (§6). |
| `colliderTriangleIndices` | `[int,int]` | The two indices this slab contributes to `meshColliders[0].triangles`, i.e. `[2(index-1), 2(index-1)+1]`. Derived, never hand-written. |

Tiling contract, all four required:

1. `Σ (maxX-minX)(maxY-minY) === (bounds.maxX-bounds.minX)(bounds.maxY-bounds.minY)` — **no gap**.
2. Pairwise interior overlap area `=== 0` for every slab pair — **no overlap**.
3. No slab rect leaves `bounds`.
4. `meshColliders[0].triangles.length === 2 × terrainTiles.length`, in slab order.

### 1.2 Collider derivation — the one flat support mesh is unchanged in kind

The validator requires **exactly one** `meshCollider` (I8). Slabs do not add
colliders; they *partition the triangle list of the single existing one*. Each
slab contributes two triangles:

```js
const slabTriangles = (slabs) => slabs.flatMap(({ rect: r }) => [
  triangle(r.minX, r.minY, 0, r.maxX, r.minY, 0, r.maxX, r.maxY, 0),
  triangle(r.minX, r.minY, 0, r.maxX, r.maxY, 0, r.minX, r.maxY, 0),
]);
// cinder-span: meshCollider("cinder-span:walkable-support", slabTriangles(CINDER_SLABS))
```

Both triangles have non-zero signed area, so the degeneracy guard
(`stage-world-catalog.js:429`) passes. All vertices are integers and
`elevation === 0`, satisfying `tests/defense-stage-world-movement.test.mjs:135-142`.
Navigation and collision are therefore **byte-equivalent in shape** to today's
single quad — the union of slab rects *is* the bounds rectangle. Composition is
a visual and semantic decomposition, not a navigation change.

### 1.3 Deriving a top-down floor texture from an isometric plate

The three source plates
(`assets/mesh/terrain/terrain-{stage}/terrain-{stage}-terrain.raw.png`) are
**isometric renders** — the authoring prompt states "viewed from a raised
three-quarter angle" `[OBSERVED]` — verified in the primary source, the `terrain`
layer `prompt` string inside
`assets/mesh/terrain/terrain-cinder-span/terrain-cinder-span.layers.json`, not
from the discovery report that quotes it. A slab needs
a **top-down** tiling albedo. Sampling the plate directly would bake the
three-quarter foreshortening into the floor, and rotating it 90° for a
perpendicular slab would show the perspective disagreeing with itself.

Derivation, per stage, once (not per slab):

| Step | Operation | Output |
|---|---|---|
| D1 | Author four corner points, in image pixels, of the largest quadrilateral of **pure walkable ground** in the plate (exclude horizon, walls, props, silhouettes). Record as `platePlanarQuad: [[px,py] ×4]` in the stage's `.layers.json`. | 4 authored points |
| D2 | Compute the homography `H` mapping `platePlanarQuad → unit square`; resample with `H⁻¹` into a **2048 × 2048** square. This is the inverse-perspective rectification: it removes the isometric foreshortening. | `{stage}-floor-rectified.png` |
| D3 | **De-light.** Divide the rectified image by its own Gaussian-blurred luminance (σ = 128 px), renormalise to the source median luminance. | lighting-neutral albedo |
| D4 | **Make tileable.** 64-px mirrored edge blend on all four sides; verify by offset-wrap (shift 1024,1024 — no visible seam). | tiling albedo |
| D5 | Per-material variant: recolour/roughness-grade the tiling albedo into that stage's three `materialId` variants (§1.5). | 3 albedo + 3 roughness maps per stage |

**D3 is not optional.** The renderer supplies direction with its own key light
(`DirectionalLight`, `0xffd9a8`, intensity 1.6, `battle-realtime-three.js:2156`
`[OBSERVED]`). A plate with baked directional light, used on two slabs at
different rotations, produces two contradictory light directions on one
coplanar floor — the exact artefact that made the previous authored diorama
ineligible. The rectified plate is a **detail albedo only**; all directional
light comes from the scene.

Rotation rule: a slab may set `plateRotationQuarters ∈ {0,1,2,3}` for variety.
Because D3 removed directional light and D4 made the texture tileable in both
axes, quarter rotation is safe. Any rotation other than a multiple of 90° is
forbidden — it breaks the UV lattice in §1.4.

### 1.4 Seam policy — coplanar, welded, no ridge

Adjacent slabs share an exact edge coordinate (`slab-01.maxX === slab-02.minX`),
with no epsilon gap and no overlap. Rules:

1. **Coplanar.** Every floor vertex at Blender `Z = 0` exactly → three.js `Y = 0`. No slab may offset Z "to avoid z-fighting": coplanar rectangles that do not overlap cannot z-fight, because they share no fragment.
2. **Welded.** After joining slab meshes in Blender, run `bpy.ops.mesh.remove_doubles(threshold=0.0001)` on the shared edges so the seam has no crack.
3. **No lip.** No kerb, step, bevel, extrusion or raised trim on a seam. A seam is a *material change*, never a geometric feature. Anything a capsule could stand on violates I17.
4. **Material break is hidden by texture, not geometry.** Each seam gets a flat inlay strip `terrain-{stage}-seam-{nnn}`: a separate quad of width **240 gameplay units** centred on the seam line, at `Z = 0`, rendered with `polygonOffset: true, polygonOffsetFactor: -1, depthWrite: false`. It draws over the floor without moving it.
5. **The inlay is presentation-only.** It contributes **zero** collider triangles, zero obstacles, zero navigation data. It is never in `meshColliders`.
6. **Global UV lattice** (§1.4.1) guarantees the tiling period is continuous across every seam, so the inlay hides a *material* transition, not a *pattern* discontinuity.

#### 1.4.1 Global UV lattice

Per-slab integer UV repeats are impossible here (slab heights are 10 400 /
10 600 / 10 800, widths 6 200–9 800 — no common tile size divides all of them).
Instead the UV lattice is **global and anchored at gameplay origin (0,0)**, so
adjacent slabs continue the pattern by construction:

```
tilePeriod = 2000 gameplay units on X, 1000 gameplay units on Y
uvRepeat = [(maxX-minX)/2000, (maxY-minY)/1000]
uvOffset = [minX/2000,        minY/1000]
```

The X:Y period is 2:1 because world space normalises each axis by its own
dimension (I18), so 2000 gameplay X and 1000 gameplay Y are both ≈2.333 world
units — the texture tile is **square on screen**. Partial tiles occur only at
the outer stage rim, which is behind the wall line and outside the camera's
readable bounds. Computed values are in the per-stage tables (§2).

### 1.5 Slab material ids (director-ruled, verbatim)

| Stage | Allowed `materialId` values |
|---|---|
| `cinder-span` | `basalt-ember` · `ash-drift` · `forge-plate` |
| `abyss-chancel` | `flagstone-oath` · `oath-inlay` · `vestry-tile` |
| `echo-throne` | `polished-echo` · `gilt-compass` · `fracture-glass` |

Presentation lookup, **read-only**, consumed by `AudioFeedbackDesign` for
footstep timbre and by `VfxCueDesign` for impact decals:

```
slabMaterialAt(stageId, x, y) -> { slabId, materialId } | null
```

* Derives purely from `profile.gameplay.terrainTiles[].rect`. Never writes simulation state, never consumes RNG, never called inside the simulation tick.
* **Total** over stage bounds — the rects tile bounds exactly (§0.1), so any in-bounds point resolves.
* **Single-valued on seams**: scan slabs in ascending `index`, inclusive bounds, **first match wins**. A point exactly on a shared edge always resolves to the lower-index slab, so a footstep on a seam cannot flicker between two timbres mid-stride.
* Returns `null` outside bounds; callers use the stage default. Never throws.

### 1.6 Blender authoring contract — apron makes `fitFootprint` a no-op

`[OBSERVED]` `fitFootprint` (`battle-realtime-three.js:1354-1360`) applies a
**uniform** scale `32.2 / max(sizeX, sizeZ)` to any loaded terrain GLB, while
actors are placed by `worldPointInto` (`:946-953`) which normalises each gameplay
axis by its own dimension. If the floor is authored at gameplay aspect ratio the
two disagree and actors walk off the art.

Two facts fix this:

1. **Author the floor at *world* aspect ratio, not gameplay aspect ratio.** Map gameplay → Blender with `bx = (gx/24000*2 - 1) * 14`, `by = (gy/12000*2 - 1) * 14`, `bz = 0`. A 22 800 × 10 400 walkable rect becomes ≈26.6 × 24.27 world units — nearly square, not 2.19:1. This is the intentional "symbolic stage diorama" framing `[OBSERVED]` (`battle-realtime-three.js:40-45`).
2. **Add a fixed non-walkable apron** so the total footprint's larger axis is exactly `32.2` and the uniform scale becomes exactly `1.000000`:

| Stage | Apron rect (gameplay) | World extent X × Z | `fitFootprint` scale `[TARGET]` |
|---|---|---|---|
| `cinder-span` | `-1800..25800 × -400..12400` | 32.2 × 29.8666 | **1.000000** |
| `abyss-chancel` | `-1800..25800 × -500..12500` | 32.2 × 30.3334 | **1.000000** |
| `echo-throne` | `-1800..25800 × -600..12600` | 32.2 × 30.8000 | **1.000000** |

The apron is `bounds` grown by **2400 gameplay units on X and 1200 on Y** for
every stage. It is coplanar dressing at `Z = 0`, contributes **no** collider
triangle, and lies wholly outside `gameplay.bounds`, so it can never be walked
on. With scale exactly 1, the walkable rect lands precisely where
`worldPointInto` puts actors.

Axis conversion: Blender is Z-up, glTF is Y-up. Author in the Blender XY plane at
`Z = 0`; the exporter maps Blender `+Y → three.js +Z`, matching
`worldPointInto`'s use of `target.z` for the gameplay Y axis. Export with
`+Y up`, `apply modifiers`, `export object names`.

### 1.7 Runtime consumption — Lane B has LANDED

This section was authored as a two-lane choice. **Lane B shipped**, so the
choice is closed. `[OBSERVED]` in the dungeon worktree:

| Stage | `terrainGlbPath` | `terrainRuntimeEligible` |
|---|---|---|
| `cinder-span` | `assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span-floor.glb` | `true` |
| `abyss-chancel` | `assets/mesh/terrain/terrain-abyss-chancel/runtime/terrain/terrain-abyss-chancel-floor.glb` | `true` |
| `echo-throne` | `assets/mesh/terrain/terrain-echo-throne/runtime/terrain/terrain-echo-throne-floor.glb` | `true` |

`terrainFallback` is deleted on all three, which is required — holding a
promoted path *and* a fallback throws "requires one eligible runtime strategy"
`[OBSERVED]` (`stage-world-catalog.js:392`). `terrainSourceCandidatePath` is
retained on all three as the offline-inspection artifact. The floor is now loaded
through `instantiateTerrainModel` (`battle-realtime-three.js:1644`), not through
`instantiateProceduralTerrain`.

Shipped node and material inventory, read directly out of the three GLBs
`[OBSERVED]`:

| Stage | Nodes | Materials |
|---|---|---|
| `cinder-span` | `terrain-cinder-span-slab-001..003`, `terrain-cinder-span-apron-001` | `mat-ash-drift-001`, `mat-basalt-ember-002`, `mat-forge-plate-003`, `mat-cinder-span-apron` |
| `abyss-chancel` | `terrain-abyss-chancel-slab-001..004`, `…-apron-001` | `mat-flagstone-oath-001`, `mat-flagstone-oath-002`, `mat-oath-inlay-003`, `mat-vestry-tile-004`, `mat-abyss-chancel-apron` |
| `echo-throne` | `terrain-echo-throne-slab-001..005`, `…-apron-001` | `mat-polished-echo-001`, `mat-fracture-glass-002`, `mat-gilt-compass-003`, `mat-fracture-glass-004`, `mat-polished-echo-005`, `mat-echo-throne-apron` |

The slab and apron node names match §6 exactly, and the material naming
`mat-{materialId}-{nnn}` preserves the `materialId` of §1.5 inside the asset, so
`slabMaterialAt` and the shipped mesh cannot silently disagree.

Two §6 items did **not** ship, both recorded honestly rather than back-dated:

1. **No `terrain-{stage}-terrain-001` root node.** The slabs and apron are direct children of the glTF scene root. This turns out to be correct and my §6 requirement was over-specified: `fitFootprint` (`battle-realtime-three.js:1354-1360`) calls `Box3().setFromObject(object3d)` and `object3d.scale.setScalar(scale)` on the instantiated scene, so the glTF scene root already provides the single uniformly-scaled parent the requirement was protecting. §6 marks the root node **optional**.
2. **No `terrain-{stage}-seam-{nnn}` inlay strips.** The material transition at each seam is currently a hard edge between two coplanar slab quads. This is legal — the floor is provably coplanar (vertical extent exactly `0.000000`, below) — but the "no visible ridge" claim of §1.4 now rests entirely on the de-lit textures and the shared UV lattice, with no inlay to hide the material break. See risk R11.

`[OBSERVED]` geometry, read from the glTF POSITION accessor min/max of every
mesh in each shipped floor GLB:

| Stage | extent X | extent Z | **vertical extent** | `fitFootprint` scale |
|---|---|---|---|---|
| `cinder-span` | 32.2000 | 29.8667 | **0.000000** | **1.000000** |
| `abyss-chancel` | 32.2000 | 30.3333 | **0.000000** | **1.000000** |
| `echo-throne` | 32.2000 | 30.8000 | **0.000000** | **1.000000** |

This is the §1.6 apron arithmetic confirmed on the real asset rather than on
paper: the larger axis is exactly 32.2 for all three, so the uniform scale is
exactly 1, and the vertical extent is exactly zero, so I17 holds in the geometry
and not merely in the catalog.

Draw-call budget `[TARGET]`: 1 mesh per slab + 1 apron (Throne worst case 6 vs 1
before). Seam inlays would have added up to 8 more; since they did not ship, the
standing mitigation is to merge slabs sharing a `materialId` into one
`BufferGeometry`. Floor draw calls per stage then become **≤ 4**. Unmeasured.

---

## 2. Per-stage composition

Bounds and camera are unchanged from the current catalog (they already satisfy
the gate-envelope rule I1/I11 and are cited as `[OBSERVED]`
`stage-world-catalog.js:127,207,290`).

### 2.1 Cinder Span — 3-slab combination: a linear ash bridge span

`bounds(600, 23400, 800, 11200)` · silhouette `jagged-parapet-blockade`, primary
axis `x`.

**Why 3, and why cut on X.** The stage is a *bridge*. A bridge reads as three
things and only three: the abutment you enter from, the span you are exposed on,
and the far landing you fight for. Cutting on X puts those three in the order the
player traverses them, and makes the stage's primary axis (`x`) the axis of the
composition. The story agrees: `cross-ember-relay` happens **on the span**,
`hold-drowned-forge` and `reverse-cinder-seal` happen **on the far landing**, and
the Warden's reversal line — "봉인을 풀면 길이 열리는 게 아니다. 네 뒤의 다리가 먼저
무너진다" (`stage-story-catalog.js:52` `[OBSERVED]`) — is a statement about the span
*behind* you, which only means something if the span is a distinct place.

| Slab id | Name | `minX` | `maxX` | `minY` | `maxY` | W × H | `materialId` | Purpose | `uvRepeat` | `uvOffset` |
|---|---|---|---|---|---|---|---|---|---|---|
| `cinder-span:slab-01` | West Ash Abutment | 600 | 8600 | 800 | 11200 | 8000 × 10400 | `ash-drift` | Ingress, orientation, retreat | 4.0 × 10.4 | 0.3, 0.8 |
| `cinder-span:slab-02` | Ember Relay Causeway | 8600 | 17000 | 800 | 11200 | 8400 × 10400 | `basalt-ember` | Exposed span; objective 1; extraction | 4.2 × 10.4 | 4.3, 0.8 |
| `cinder-span:slab-03` | Drowned Forge Court | 17000 | 23400 | 800 | 11200 | 6400 × 10400 | `forge-plate` | Objectives 2–4; occupation; gate | 3.2 × 10.4 | 8.5, 0.8 |

World-space rects for the Blender agent (X, Z): slab-01 `-13.3..-3.9667 ×
-12.1333..12.1333`, slab-02 `-3.9667..5.8333 × same`, slab-03 `5.8333..13.3 ×
same`.

Objective → slab `[OBSERVED]` from point-in-rect against the authored rects:

| Simulation point | Coordinate | Slab | Story objective |
|---|---|---|---|
| `cinder-relay-crossing` | 14600, 5200 | `slab-02` | 1 `cross-ember-relay` |
| `cinder-bind` (extraction) | 15400, 6000 | `slab-02` | 4 (extraction) |
| `cinder-forge-stand` | 17400, 6000 | `slab-03` | 2 `hold-drowned-forge` |
| `cinder-seal` (occupation) | 17600, 6000 | `slab-03` | 3 `reverse-cinder-seal` |
| gate | 22000, 6000 | `slab-03` | 4 `release-the-chains` |

### 2.2 Abyss Chancel — 4-slab combination: a nave with a transept cross

`bounds(600, 23400, 700, 11300)` · silhouette `bent-nave-colonnade`.

**Why 4, and why the east half splits on Y.** A chancel is a nave that *crosses*.
Objective 2 is literally "교차 회랑의 세 갈래 압력을 끊어라" — cut the three-way
pressure of the crossing corridor (`stage-story-catalog.js:74` `[OBSERVED]`) — and the
stage spawns from exactly three directions, `W / SW / NW` `[OBSERVED]`
(`defense-catalog.js:375`). So the composition must contain a real junction. Two
slabs run the nave west→east; at `x = 16400` the floor forks on `y = 7200` into
the **north oath apse** (which holds the gate and the occupation) and the **south
transept arm** (which holds the transept-lock fight). The critical route is
forced to go *down* into the transept and back *up* to the gate — it walks the
cross.

The arms are deliberately unequal (6500 vs 4100 tall). The mirror offers the
short, lit, northern answer; refusing it means committing to the southern arm.
That asymmetry is the stage's thesis — "거울이 먼저 내놓은 답을 거부하세요"
(`stage-story-catalog.js:90` `[OBSERVED]`) — expressed as floor plan. `y = 7200` is
also 300 units clear of the gate envelope (`gateY ± 900 = 5100..6900`), so the
fork never crosses the gate geometry.

| Slab id | Name | `minX` | `maxX` | `minY` | `maxY` | W × H | `materialId` | Purpose | `uvRepeat` | `uvOffset` |
|---|---|---|---|---|---|---|---|---|---|---|
| `abyss-chancel:slab-01` | West Processional Narthex | 600 | 8000 | 700 | 11300 | 7400 × 10600 | `flagstone-oath` | Ingress, processional approach | 3.7 × 10.6 | 0.3, 0.7 |
| `abyss-chancel:slab-02` | Nave Crossing | 8000 | 16400 | 700 | 11300 | 8400 × 10600 | `flagstone-oath` | Objective 1; mirror aisle; extraction | 4.2 × 10.6 | 4.0, 0.7 |
| `abyss-chancel:slab-03` | North Oath Apse | 16400 | 23400 | 700 | 7200 | 7000 × 6500 | `oath-inlay` | Occupation; gate; boss | 3.5 × 6.5 | 8.2, 0.7 |
| `abyss-chancel:slab-04` | South Transept Arm | 16400 | 23400 | 7200 | 11300 | 7000 × 4100 | `vestry-tile` | Objective 2, three-way junction | 3.5 × 4.1 | 8.2, 7.2 |

| Simulation point | Coordinate | Slab | Story objective |
|---|---|---|---|
| `chancel-nave-advance` | 15000, 6000 | `slab-02` | 1 `advance-the-nave` |
| `chancel-bind` (extraction) | 16000, 7000 | `slab-02` | 4 (extraction) |
| `chancel-transept-lock` | 17600, 8200 | `slab-04` | 2 `lock-the-transept` |
| `chancel-oath` (occupation) | 18200, 5200 | `slab-03` | 3 `refuse-the-oath` |
| gate | 22000, 6000 | `slab-03` | 4 `shatter-classification` |

### 2.3 Echo Throne — 5-slab combination: a crescent court with flanking galleries

`bounds(600, 23400, 600, 11400)` · silhouette `axial-crescent-court`.

**Why 5, and why the galleries mirror.** The stage's mechanic is repetition:
"되돌아오는 왕좌 회랑을 돌파하라" — break the *returning* throne aisle
(`stage-story-catalog.js:111` `[OBSERVED]`). A mirror needs two halves that are
provably identical. The middle band splits on `y = 4000` and `y = 8000` into a
north gallery, the sovereign aisle, and a south gallery — the galleries are
**exact mirrors about `y = 6000`** (both 9800 × 3400), so `y' = 12000 - y` maps
any point in one to the same point in the other. That makes the mirror an
arithmetic fact about the floor, not a promise in a design doc. The aisle is
centred on `y = 6000` (4000..8000), so the critical route and the mirror axis are
the same line. The east court is left undivided because the dais, the occupation
and the gate are all inside `x 18000..22000` and must share one continuous
crescent floor.

| Slab id | Name | `minX` | `maxX` | `minY` | `maxY` | W × H | `materialId` | Purpose | `uvRepeat` | `uvOffset` |
|---|---|---|---|---|---|---|---|---|---|---|
| `echo-throne:slab-01` | West Echo Narthex | 600 | 6800 | 600 | 11400 | 6200 × 10800 | `polished-echo` | Ingress, orientation | 3.1 × 10.8 | 0.3, 0.6 |
| `echo-throne:slab-02` | North Repeating Gallery | 6800 | 16600 | 600 | 4000 | 9800 × 3400 | `fracture-glass` | Mirror source; detour entry | 4.9 × 3.4 | 3.4, 0.6 |
| `echo-throne:slab-03` | Sovereign Aisle | 6800 | 16600 | 4000 | 8000 | 9800 × 4000 | `gilt-compass` | Objective 1; extraction; mirror axis | 4.9 × 4.0 | 3.4, 4.0 |
| `echo-throne:slab-04` | South Repeating Gallery | 6800 | 16600 | 8000 | 11400 | 9800 × 3400 | `fracture-glass` | Mirror image of slab-02 | 4.9 × 3.4 | 3.4, 8.0 |
| `echo-throne:slab-05` | Crescent Throne Court | 16600 | 23400 | 600 | 11400 | 6800 × 10800 | `polished-echo` | Objective 2; occupation; gate; boss | 3.4 × 10.8 | 8.3, 0.6 |

| Simulation point | Coordinate | Slab | Story objective |
|---|---|---|---|
| `throne-aisle-break` | 15200, 6000 | `slab-03` | 1 `break-the-aisle` |
| `throne-bind` (extraction) | 16200, 7600 | `slab-03` | 4 (extraction) |
| `throne-dais-stand` | 18000, 6000 | `slab-05` | 2 `stand-at-the-dais` |
| `throne-domain` (occupation) | 18400, 6000 | `slab-05` | 3 `claim-the-domain` |
| gate | 22000, 6000 | `slab-05` | 4 `break-the-sovereign-command` |

### 2.4 Seam inventory

`[OBSERVED]` — derived from the authored rects by adjacency scan.

| Stage | Seam node | Slab pair | Axis | At | Span | Length |
|---|---|---|---|---|---|---|
| cinder-span | `terrain-cinder-span-seam-001` | 01\|02 | x | 8600 | y 800..11200 | 10400 |
| cinder-span | `terrain-cinder-span-seam-002` | 02\|03 | x | 17000 | y 800..11200 | 10400 |
| abyss-chancel | `terrain-abyss-chancel-seam-001` | 01\|02 | x | 8000 | y 700..11300 | 10600 |
| abyss-chancel | `terrain-abyss-chancel-seam-002` | 02\|03 | x | 16400 | y 700..7200 | 6500 |
| abyss-chancel | `terrain-abyss-chancel-seam-003` | 02\|04 | x | 16400 | y 7200..11300 | 4100 |
| abyss-chancel | `terrain-abyss-chancel-seam-004` | 03\|04 | y | 7200 | x 16400..23400 | 7000 |
| echo-throne | `terrain-echo-throne-seam-001` | 01\|02 | x | 6800 | y 600..4000 | 3400 |
| echo-throne | `terrain-echo-throne-seam-002` | 01\|03 | x | 6800 | y 4000..8000 | 4000 |
| echo-throne | `terrain-echo-throne-seam-003` | 01\|04 | x | 6800 | y 8000..11400 | 3400 |
| echo-throne | `terrain-echo-throne-seam-004` | 02\|03 | y | 4000 | x 6800..16600 | 9800 |
| echo-throne | `terrain-echo-throne-seam-005` | 02\|05 | x | 16600 | y 600..4000 | 3400 |
| echo-throne | `terrain-echo-throne-seam-006` | 03\|04 | y | 8000 | x 6800..16600 | 9800 |
| echo-throne | `terrain-echo-throne-seam-007` | 03\|05 | x | 16600 | y 4000..8000 | 4000 |
| echo-throne | `terrain-echo-throne-seam-008` | 04\|05 | x | 16600 | y 8000..11400 | 3400 |

---

## 3. Routes and traversal

### 3.1 Clearance arithmetic

The validator's rule (I7) is, for every route segment and every obstacle **and**
every prop:

```
pointSegmentDistance(centre, segStart, segEnd)  >=  radius + corridorWidth / 2
```

Read geometrically: the blocker's **rim** must be at least `corridorWidth / 2`
from the route centreline. Consequences the level designer must author against:

* **Usable corridor width = `corridorWidth`.** Two blockers flanking a segment leave a rim-to-rim gap of at least `corridorWidth`.
* **Waypoint inset.** Every waypoint must lie inside `bounds` inset by `corridorWidth / 2` (I6), so wide corridors cost usable arena at the rim.
* **Props count as blockers, not just obstacles.** A decorative prop with a large `footprintRadius` blocks a route exactly as hard as an obstacle does. Cinder's frozen `west-ash-wall-prop` (r940) is both.
* **Margin = `distance − radius − corridorWidth/2`.** Positive is required; the validator uses strict `<` so zero passes, but zero is not authored here.

Authored corridor widths and their required clearances:

| Stage | Route | `corridorWidth` | Half | Waypoint inset X | Waypoint inset Y | Required clearance for r=650 / r=900 / r=940 |
|---|---|---|---|---|---|---|
| cinder-span | critical | 1400 | 700 | 1300..22700 | 1500..10500 | 1350 / 1600 / 1640 |
| cinder-span | detour | 900 | 450 | 1050..22950 | 1250..10750 | 1100 / 1350 / 1390 |
| abyss-chancel | critical | 1400 | 700 | 1300..22700 | 1400..10600 | 1350 / 1600 / 1640 |
| abyss-chancel | detour | 900 | 450 | 1050..22950 | 1150..10850 | 1100 / 1350 / 1390 |
| echo-throne | critical | 1400 | 700 | 1300..22700 | 1300..10700 | 1350 / 1600 / 1640 |
| echo-throne | detour | 900 | 450 | 1050..22950 | 1050..10950 | 1100 / 1350 / 1390 |

Measured tightest margin per stage `[OBSERVED]` from the validated candidate:
cinder **+49.86**, chancel **+301.24**, throne **+200.00**. All positive; no
waypoint lands inside any obstacle or prop radius. Cinder's figure is a hard
geometric limit derived below, not routing slack.

Cinder is the tightest stage because I15 freezes its twelve prop placements, so
almost every degree of freedom the other two stages have is unavailable here.

On the **critical** route the binding prop is the frozen `west-ash-wall-prop` at
`(19000, 4400) r940`. Placing the `intermediate-gate` waypoint at `(17400, 6000)`
— on the forge-stand objective centre — gives a horizontal final leg whose
distance to that prop is exactly **1600**, against a requirement of `940 + 700 =`
**1640** at the final width of 1400. That placement **does not pass**. Lifting
the waypoint to `(17400, 6400)` tilts the leg away from the wall and makes the
stage legal at 1400. This is why Cinder's `intermediate-gate` is at `y = 6400`
and not on the objective centre: the quest-point marker stays at `(17400, 6000)`
(fixed by I13), while the movement path approaches the arena rather than standing
on its centre.

On the **detour** the binding prop is `collapsed-parapet-prop`, and its margin of
**+49.86** is the spec's smallest. It is a hard geometric limit derived in §3.2,
not slack that better routing would recover.

### 3.2 Cinder Span routes

```js
route("cinder-span:critical-route", "critical", 1400, [
  waypoint("cinder-span:ingress",               "ingress",                1800,  6000),  // slab-01
  waypoint("cinder-span:cinder-relay-crossing", "intermediate-objective", 14600, 5200),  // slab-02, = objective point
  waypoint("cinder-span:cinder-forge-stand",    "intermediate-gate",      17400, 6400),  // slab-03
  waypoint("cinder-span:final-gate",            "final-gate",             22000, 6000),  // slab-03, = ARENA gate
]),
route("cinder-span:optional-detour", "optional-detour", 900, [
  waypoint("cinder-span:detour-entry",   "detour-entry",     6000, 10600),  // slab-01
  waypoint("cinder-span:ash-cache",      "detour-objective", 13200, 10700), // slab-02
  waypoint("cinder-span:detour-exit",    "detour-exit",      19600, 10700), // slab-03
]),
```

Slab thread `[OBSERVED]`: critical `slab-01 → slab-02 → slab-03 → slab-03`;
detour `slab-01 → slab-02 → slab-03`. Both routes cross both seams, so both cross
all three chambers.

The detour is the **southern ash verge**, deliberately aligned with the stage's
own flank spawn lane `cinder-south` at `entryY 9800` `[OBSERVED]`
(`defense-catalog.js:351`) — taking the detour means walking into the flank.

The verge lane is the most constrained geometry in the spec, and the constraint
is exact rather than approximate. `collapsed-parapet-prop` is frozen by I15 at
`(13200, 9300) r900`, so its rim is at `y = 10200`; the stage's south bound is
`y = 11200`. **The usable band is therefore exactly 1000 gameplay units wide**,
and it must hold a corridor that satisfies two competing rules:

| Rule | Requirement at `W = 900` |
|---|---|
| I7 obstacle clearance | lane centre `>= 9300 + 900 + 450 = 10650` |
| I6 waypoint inset | lane centre `<= 11200 − 450 = 10750` |

A 100-unit window for the centre, and the corridor itself consumes 900 of the
1000. Centring at **`y = 10700`** splits the remainder evenly: **≈50 units of
obstacle margin and 50 units of inset headroom.** A parameter sweep over entry,
cache and exit positions (597 legal configurations) confirms 50/50 is the
*maximum achievable balance* — no waypoint arrangement does better, because the
binding quantity is the corridor width against a fixed 1000-unit gap, not the
routing.

The alternative was `W = 800`, which yields ~100 units of authoring margin but
drops player clearance to `(800 − 720) / 2 = 40` units per side — **less than one
tick of lateral movement** at `COMMANDER.speed 4100` (68.3 units/tick). This spec
takes `W = 900`. The 90-unit player clearance is a runtime property the player
feels on every pass; the ~50-unit authoring margin is a design-time property that
only matters if someone later moves a prop. Trading a felt constraint for an
authoring convenience would be the wrong way round.

Entry sits at `(6000, 10600)` — the sweep's best-scoring approach — and the cache
and exit at `y = 10700`.

### 3.3 Abyss Chancel routes

```js
route("abyss-chancel:critical-route", "critical", 1400, [
  waypoint("abyss-chancel:ingress",                "ingress",                1800,  6000), // slab-01
  waypoint("abyss-chancel:chancel-nave-advance",   "intermediate-objective", 15000, 6000), // slab-02, = objective point
  waypoint("abyss-chancel:chancel-transept-lock",  "intermediate-gate",      17600, 8200), // slab-04, = objective point
  waypoint("abyss-chancel:final-gate",             "final-gate",             22000, 6000), // slab-03, = ARENA gate
]),
route("abyss-chancel:optional-detour", "optional-detour", 900, [
  waypoint("abyss-chancel:detour-entry",        "detour-entry",     6200, 2600), // slab-01
  waypoint("abyss-chancel:mirror-aisle-cache",  "detour-objective", 12000, 1800), // slab-02
  waypoint("abyss-chancel:detour-exit",         "detour-exit",      19800, 2600), // slab-03
]),
```

Slab thread `[OBSERVED]`: critical `slab-01 → slab-02 → slab-04 → slab-03` —
**all four slabs**, and it crosses the `y = 7200` fork twice: down into the
transept arm at `x ≈ 16418`, back up to the apse at `x = 19600`. The route *is*
the cross.

The detour is the **mirror's offered aisle** along the north. This is the stage's
central choice made spatial: the mirror lights the short northern lane, and the
quest is to refuse the answer the mirror offers first. Taking the detour is
taking the mirror's answer.

### 3.4 Echo Throne routes

```js
route("echo-throne:critical-route", "critical", 1400, [
  waypoint("echo-throne:ingress",             "ingress",                1800,  6000), // slab-01
  waypoint("echo-throne:throne-aisle-break",  "intermediate-objective", 15200, 6000), // slab-03, = objective point
  waypoint("echo-throne:throne-dais-stand",   "intermediate-gate",      18000, 6000), // slab-05, = objective point
  waypoint("echo-throne:final-gate",          "final-gate",             22000, 6000), // slab-05, = ARENA gate
]),
route("echo-throne:optional-detour", "optional-detour", 900, [
  waypoint("echo-throne:detour-entry",           "detour-entry",     7800,  2200), // slab-02
  waypoint("echo-throne:mirror-gallery-cache",   "detour-objective", 12400, 9800), // slab-04
  waypoint("echo-throne:detour-exit",            "detour-exit",      19200, 9200), // slab-05
]),
```

Slab thread `[OBSERVED]`: critical `slab-01 → slab-03 → slab-05 → slab-05`;
detour `slab-02 → slab-04 → slab-05`, and its first leg crosses `y = 4000` at
`x ≈ 8285` and `y = 8000` at `x ≈ 11309`, so it passes through `slab-03` between
them. **Union of the two routes = all five slabs.** I3 forbids a second detour,
so a single diagonal detour is the only way to reach five chambers with 4 + 3
waypoints — and it is the right one: the detour crosses the critical corridor at
`(10100, 6000)`, so the player who takes the gallery route must cut the lane
under fire. Enter the north gallery, cross the sovereign aisle, exit through the
south gallery — the detour physically performs the stage's mirror.

---

## 4. Gimmicks

13 gimmicks: 4 / 4 / 5. Exactly one per objective block, plus a second in the
Throne dais block. Ids are director-ruled `{stageId}:gimmick-{name}` and are
**frozen** — `EncounterPacing`, `VfxCueDesign` and `AudioFeedbackDesign` have
adopted them verbatim.

### 4.1 Universal gimmick rules

1. **Flat-plane safe, always.** No gimmick changes elevation, adds collision, moves the floor plane, or edits `meshColliders`. A "narrowing" is a **hazard / steering band inside the already-authored corridor**. Precedent `[OBSERVED]`: `STAGE_TACTICS.hazard` `ash-surge` at `(14800, 6000) r1100` already sits directly on Cinder's critical line (`defense-catalog.js:353`), so a damage zone on a corridor is an established, validated pattern; an *obstacle* there is not.
2. **The authored `corridorWidth` never changes.** It stays at the pre-trigger value so `validateProfile` keeps passing. The narrowing is published in the event payload only.
3. **`corridorWidthAfter >= 900` for every gimmick — the commander must still fit.** `[OBSERVED]` `COMMANDER.radius = 360` (`defense-catalog.js:20`), so the commander's **diameter is 720**. The validator's own corridor floor is only 600 (`stage-world-catalog.js:439`), which is *narrower than the actor it is supposed to admit*: a 600- or 700-wide narrowed band leaves no damage-free line at all, turning a skill check into guaranteed chip damage. The authored floor is therefore **900**, giving `(900 − 720) / 2 = 90` gameplay units of clearance per side — about 1.3 ticks of lateral correction at `COMMANDER.speed 4100`. Every authored `corridorWidth` and every `corridorWidthAfter` in this spec satisfies `> 720`, and the narrowed value also still clears the validator's 600 floor if re-checked.
4. **Simulation-enforced**, not advisory: the band applies damage and steering cost. Therefore `deformation` and `hazard` cues must be **pool-exempt** (predicate `gimmickClass === "deformation" || gimmickClass === "hazard"`, added to `CRITICAL_VFX_EVENT_TYPES`, `battle-realtime-three.js:404` `[OBSERVED]`, director ruling R24); `gate` and `mirror` cues may be evicted.
5. **`telegraphTicks` is the full player reaction window, and it is PER CLASS.** `GIMMICK_ARMED` at tick `T`, `GIMMICK_TRIGGERED` at exactly `T + telegraphTicks`. Four tiers, per director ruling v6 C2: **180** deformation · **120** narrowing gate · **90** progress-ring and mirror · **60** hazard. Consumers **must read `event.telegraphTicks`**, never hardcode a constant — `lifetime = Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 180`, with 180 as fallback and clamp only. A single hardcoded 180 would leave a 60-tick hazard cue lingering 120 ticks past its own `GIMMICK_TRIGGERED`, telling the player something is still arming after it has already fired.

   **Key on `event.type` FIRST — `telegraphTicks` is not a new field name, and reading it un-gated exhausts the 24-slot VFX pool (risk R12 quantifies it: 120/139/137 bodies per stage each emitting one).** `[OBSERVED]`, verified against the base blob with `git show 033877ad:defense-run-simulation.js | grep -n telegraphTicks`: the field already exists at `:2296`, emitted on **`ENCOUNTER_PATH_CONTESTED`** carrying `contestTicks`, which is a different quantity with different semantics. A type-agnostic `if (Number.isInteger(event.telegraphTicks))` helper therefore matches enemy path-contest events as well as gimmick events and will give them gimmick cue lifetimes. Every consumer must gate on `event.type ∈ { GIMMICK_ARMED, GIMMICK_TRIGGERED, GIMMICK_RESOLVED }` (or the `ENEMY_SPAWNED` set) **before** reading the field. Credit to `AudioFeedbackDesign` for finding this; I re-verified it against the blob.
6. **One trigger per tick, stage-wide.** Max concurrently armed per stage = **2**, of which class `deformation` = **1**. If two would trigger on the same tick, the lower authored `order` fires at `T` and the other defers to `T + 1`. No RNG in the tie-break.
7. **Determinism.** Arming is driven by tick and objective state. Where a choice is genuinely needed (which vent, which bar order) it draws from a **derived** stream `run.gimmickRng = rngNext(seed ^ 0xc2b2ae35)`, following the existing pattern `run.combatRng = rngNext(unsignedSeed ^ 0x9e3779b9)` `[OBSERVED]` (`defense-run-simulation.js:3217` in the implementation worktree, rehydration guard `:3446`). `0xc2b2ae35` is distinct from **all three** streams already claimed: `combatRng` `0x9e3779b9`, the surprise roll `0x6d2b79f5`, and `DropBuffSystem`'s `run.dropRng` `0x85ebca6b`. Two streams seeded with the same constant would be perfectly correlated — a determinism defect no existing test would catch, since RNG state is never serialised into the digest. **`run.rng` is never consumed** — that would shift every downstream draw and break `getRunDigest()`.
8. **`gimmickClass` ∈ `deformation` | `gate` | `mirror` | `hazard`** (director R5). Consumers branch on the class, never on a second event type.

Authored catalog shape, `profile.gameplay.gimmicks[]` (spatial fields only;
timing and state live in simulation):

```js
const gimmick = (stageId, name, gimmickClass, slabId, objectiveId, x, y, order,
                 telegraphTicks, corridorWidthBefore, corridorWidthAfter, radius = 0) => ({
  id: `${stageId}:gimmick-${name}`,
  gimmickClass, slabId, objectiveId, order, telegraphTicks,
  placement: { x, y, elevation: 0 },
  radius,
  corridorWidthBefore, corridorWidthAfter,
});
```

### 4.2 Cinder Span — 4 gimmicks

| # | id | slab | class | objective | movement | x, y | telegraph | width before→after | toggles |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `cinder-span:gimmick-ash-causeway-collapse` | slab-02 | deformation | `cinder-relay-crossing` | FUNNEL | 11400, 5400 | 180 | 1400 → 900 | once |
| 2 | `cinder-span:gimmick-forge-pressure-vents` | slab-03 | hazard | `cinder-forge-stand` | HAZARD | 17600,5000 / 18500,6500 / 17500,7000 | 60 | 1400 → 1400 | cycles |
| 3 | `cinder-span:gimmick-seal-oath-ring` | slab-03 | gate | `cinder-seal` (occupation) | FUNNEL | 17600, 6000 (r900) | 90 | — | once |
| 4 | `cinder-span:gimmick-warden-chain-fall` | slab-03 | deformation | `boss-kill` | FUNNEL | 19700, 6200 | 180 | 1400 → 1000 | ≤2 phases |

**1 — Ash causeway collapse.** Story objective 1 `cross-ember-relay`. The
causeway's north and south lips crumble inward, eating 250 units off each edge of
the critical corridor: 1400 → 900 walkable band, hazard bands on the remains.
*Decision it forces:* commit through a corridor now barely wider than a dodge, or
back out and take the southern verge detour, which costs traversal time and walks
into the `cinder-south` flank lane. *Telegraph:* 180 ticks (3 s) of ember spill
tracing the two lines that will become hazard, plus a rising ash plume at
`(11400, 5400)`. *Flat-plane-safe implementation:* the floor plane, the slab rect
and the collider triangles are untouched; the collapse is two hazard/steering
bands 250 wide hugging the authored corridor edges, plus the deformation cue.
Nothing is lowered, nothing becomes a pit.

**2 — Forge pressure vents.** Story objective 2 `hold-drowned-forge` ("잠긴
용광로의 압력을 끊어라" — break the locked forge's pressure). Three vent
footprints inside the forge-stand arena (all within `r1400` of `(17400,6000)`)
cycle on and off, so the safe standing area rotates during a stationary hold.
*Decision:* where to plant for the hold, and when to give up ground and re-plant.
*Telegraph:* 60 ticks of pressure whine and a floor glow ring at the next vent.
*Flat-plane-safe:* damage footprints on the plane, no geometry change; the "vent"
is a decal plus VFX, not a hole.

**3 — Seal oath ring.** Story objective 3 `reverse-cinder-seal`. A ring at the
occupation centre `(17600, 6000)` r900 — exactly `STAGE_TACTICS.occupation.radius`
`[OBSERVED]` (`defense-catalog.js:354`) — suppresses occupation progress while
intact. Breaking it opens the capture. *Decision:* spend damage on the ring now,
or hold longer under pressure. *Telegraph:* 90 ticks; the ring's brand brightens
and the occupation gauge visibly stalls. *Flat-plane-safe:* a progress gate and a
decal, never collision. It does not block pathing — do not model it as `BLOCK`.

**4 — Warden chain fall.** Story objective 4 `release-the-chains`, and the payoff
of the reversal line "네 뒤의 다리가 먼저 무너진다". On each boss phase change a
chain anchor slams across the gate approach at `(19700, 6200)`, narrowing the
final leg 1400 → 1000. *Decision:* fight the boss in the open court, or in the
narrowed throat where its own adds are also compressed. *Telegraph:* 180 ticks of
chain-tension groan and a shadow line across the floor. *Flat-plane-safe:* the
anchor's *visual* mass is non-walkable background dressing above the plane; the
gameplay effect is the narrowed band. Max 2 arms per run.

### 4.3 Abyss Chancel — 4 gimmicks

| # | id | slab | class | objective | movement | x, y | telegraph | width before→after | toggles |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `abyss-chancel:gimmick-mirror-answer-aisle` | slab-02 | mirror | `chancel-nave-advance` | SIGHT | 12000, 6000 | 90 | 1400 → 1400 | per wave |
| 2 | `abyss-chancel:gimmick-transept-three-way-lock` | slab-04 | gate | `chancel-transept-lock` | FUNNEL | 17600, 8200 | 120 | 1400 → 900 | 3 bars |
| 3 | `abyss-chancel:gimmick-oath-ring-shortcut` | slab-03 | gate | `chancel-oath` (occupation) | FUNNEL | 18000, 7200 | 90 | 0 → 900 (adds a lane) | once |
| 4 | `abyss-chancel:gimmick-classification-craze` | slab-03 | deformation | `boss-kill` | FUNNEL | 20600, 6000 | 180 | 1400 → 900 | ≤2 phases |

**1 — Mirror answer aisle.** Story objective 1 `advance-the-nave` ("거울보다 먼저
본당을 돌파하라" — break the nave *before* the mirror). The mirror lights one lane
of the crossing as the recommended answer. Advancing down the lit lane spawns a
mirrored squad at the reflected position across the nave axis `y = 6000`; the
unlit lane is safe but slower. *Decision:* the whole stage's thesis — take the
answer offered, or refuse it and pay in time. *Telegraph:* 90 ticks; the lit lane
brightens before the mirror commits. *Flat-plane-safe:* changes **information and
spawns**, never geometry. Corridor width unchanged — this is `SIGHT`.

**2 — Transept three-way lock.** Story objective 2 `lock-the-transept`. Three oath
bars, one per spawn approach — W `(16800, 8200)`, SW `(17600, 9800)`, NW
`(18400, 7600)` — matching the stage's three spawn directions `W / SW / NW`
`[OBSERVED]` (`defense-catalog.js:375`). Each standing bar suppresses one lane
into the arm; with all three up the usable band drops to 900. *Decision:* break
bars for room, or leave them and fight compressed with fewer simultaneous
approaches. *Telegraph:* 120 ticks per bar, violet static climbing the bar.
*Flat-plane-safe:* lane suppression is a steering weight plus hazard, not
collision; 600 is the validator floor, so the narrowed corridor is still legal.

**3 — Oath ring shortcut.** Story objective 3 `refuse-the-oath`. A ring sitting
**exactly on seam-004** (`y = 7200`, the transept↔apse fork) at `(18000, 7200)`.
Breaking it opens a direct lane from the transept-lock to the occupation point,
removing roughly 2600 units of travel. *Decision:* spend damage now to buy
traversal later, or walk the long way around the fork. *Telegraph:* 90 ticks of
oath-ring resonance along the seam. *Flat-plane-safe:* it **adds** a 900-wide
lane on the existing plane; it never cuts one. This is the gimmick that makes a
seam matter as a place.

**4 — Classification craze.** Story objective 4 `shatter-classification`. On boss
phase 2 the tactician's classification grid crazes the apse floor at
`(20600, 6000)`: the gate approach narrows 1400 → 900 and a hazard band tracks
the boss. *Decision:* deny the boss the narrowed throat, or use it to stop its
adds. *Telegraph:* 180 ticks; grid lines etch across the floor before they become
hazard. *Flat-plane-safe:* etched decal plus band; the plane is untouched.

### 4.4 Echo Throne — 5 gimmicks

| # | id | slab | class | objective | movement | x, y | telegraph | width before→after | toggles |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `echo-throne:gimmick-returning-aisle` | slab-03 | mirror | `throne-aisle-break` | SIGHT | 15200, 6000 | 90 | 1400 → 1400 | per kill batch |
| 2 | `echo-throne:gimmick-dais-command-echo` | slab-05 | hazard | `throne-dais-stand` | HAZARD | 18000, 6000 | 60 | — | cycles |
| 3 | `echo-throne:gimmick-crescent-gallery-shutters` | slab-05 | gate | `throne-dais-stand` | FUNNEL | 16600,3000 / 16600,9600 | 120 | 1400 → 900 | 2 shutters |
| 4 | `echo-throne:gimmick-domain-command-ring` | slab-05 | gate | `throne-domain` (occupation) | FUNNEL | 18400, 6000 (r800) | 90 | — | once |
| 5 | `echo-throne:gimmick-sovereign-command-shear` | slab-05 | deformation | `boss-kill` | FUNNEL | 20800, 6000 | 180 | 1400 → 900 | ≤2 phases |

**1 — Returning aisle.** Story objective 1 `break-the-aisle`. Every enemy killed
inside the sovereign aisle (`slab-03`) returns as a mirror in the **opposite**
gallery at `y' = 12000 - y`. Because `slab-02` and `slab-04` are exact mirrors
about `y = 6000` (both 9800 × 3400), the reflected point is guaranteed to land on
walkable floor in the other gallery — this is arithmetic, not a designer promise.
*Decision:* kill in the aisle and accept a mirrored wave behind you, or bait
enemies into a gallery where kills do not return. *Telegraph:* 90 ticks; a
fracture pulse crosses the aisle to the mirrored spawn point before it lands.
*Flat-plane-safe:* changes spawn positions and information only.

**2 — Dais command echo.** Story objective 2 `stand-at-the-dais` ("왕좌를
소유하지 않고 단상을 지켜라" — hold the dais *without owning* the throne). The dais
repeats the player's own last heavy attack back at the position they used it,
after a fixed delay. *Decision:* not *whether* to commit, but *where you are
standing* when you do. *Telegraph:* 60 ticks; a cold-blue ghost of the player's
own swing at the recorded position. *Flat-plane-safe:* a timed damage footprint
on the plane.

**3 — Crescent gallery shutters.** Story objective 2, second gimmick in the dais
block (the one extra `EncounterPacing` allows). Two shutters sit on the court's
gallery mouths — north on **seam-005** `(16600, 3000)`, south on **seam-008**
`(16600, 9600)`. While open, gallery enemies pour into the court and crowd
pressure narrows the usable dais approach to 900. Each shutter is breakable and
closing one cuts that spawn lane. *Decision:* spend the dais hold breaking a
shutter for lasting relief, or tank both lanes. *Telegraph:* 120 ticks of shutter
grind. *Flat-plane-safe:* spawn-lane suppression plus a crowd-pressure steering
band; the shutter's visual mass is background dressing above the plane.

**4 — Domain command ring.** Story objective 3 `claim-the-domain`. The occupation
ring at `(18400, 6000)` r800 — exactly `STAGE_TACTICS.occupation.radius`
`[OBSERVED]` (`defense-catalog.js:382`) — **inverts**: standing inside drains
progress until the command ring is broken. This is the Sovereign's line "단상을
차지해도 왕좌의 명령은 너에게 돌아온다" made mechanical. *Decision:* break first
and hold clean, or hold and bleed. *Telegraph:* 90 ticks; the ring counter-rotates
against the capture gauge. *Flat-plane-safe:* progress gate plus decal, no
collision. Not `BLOCK`.

**5 — Sovereign command shear.** Story objective 4 `break-the-sovereign-command`.
On boss phase change the court floor shears at `(20800, 6000)`, narrowing the
gate approach 1400 → 900. *Decision:* hold the wide crescent, or take the narrow
throat where the Sovereign's echoes overlap. *Telegraph:* 180 ticks of a shear
line propagating from the gate toward the dais. *Flat-plane-safe:* band plus
decal; the plane never moves. Max 2 arms per run.

### 4.5 Gimmick → objective coverage

| Stage | obj 1 | obj 2 | obj 3 (occupation) | obj 4 (boss) |
|---|---|---|---|---|
| cinder-span | causeway-collapse | forge-pressure-vents | seal-oath-ring | warden-chain-fall |
| abyss-chancel | mirror-answer-aisle | transept-three-way-lock | oath-ring-shortcut | classification-craze |
| echo-throne | returning-aisle | dais-command-echo **+** crescent-gallery-shutters | domain-command-ring | sovereign-command-shear |

Every one of the 12 story objectives across the three stages has at least one
bound spatial gimmick. G1's condition — objective ↔ space 1:1 — is satisfiable
from this table.

---

## 5. Landmarks, obstacles, props, lights

### 5.1 Cinder Span — props frozen (I15), obstacles expanded 3 → 6

All twelve prop placements, ids and `modelNode` names are **unchanged** from the
current catalog, so `tests/runtime-visual-assets.test.mjs:100-140` and
`tests/stage-terrain-environment-contract.test.mjs:388-391` continue to pass
untouched. Obstacles are drawn only from that frozen set (I10 forces identical
`x`, `y`, `radius`).

| Obstacle id | x | y | r | prop id | slab |
|---|---|---|---|---|---|
| `cinder-span:relay-debris-north` | 5000 | 10400 | 500 | `cinder-span:relay-debris-north-prop` | slab-01 |
| `cinder-span:drowned-forge-arch` | 12600 | 2800 | 850 | `cinder-span:forge-arch` | slab-02 |
| `cinder-span:collapsed-parapet` | 13200 | 9300 | 900 | `cinder-span:collapsed-parapet-prop` | slab-02 |
| `cinder-span:relay-debris-south` | 15000 | 1500 | 540 | `cinder-span:relay-debris-south-prop` | slab-02 |
| `cinder-span:west-ash-wall` | 19000 | 4400 | 940 | `cinder-span:west-ash-wall-prop` | slab-03 |
| `cinder-span:east-ash-wall` | 20800 | 9900 | 700 | `cinder-span:east-ash-wall-prop` | slab-03 |

`cinder-span:west-ash-wall` keeps its id, centre and radius exactly — it is the
live movement fixture of I16. The three added obstacles promote already-visible
frozen props to collision, which is the cheapest honest way to give a 3-slab
dungeon real per-chamber架 structure: every chamber now owns at least one solid
mass. Gate rule (I11) verified for all six.

Landmarks (6, unchanged): `landmark.ember-relay-spire`,
`landmark.drowned-forge-arch`, `landmark.collapsed-parapet`,
`landmark.ash-wall`, `landmark.cinder-ingress-beacon`,
`landmark.cinder-gate-beacon`.

### 5.2 Abyss Chancel — 13 props, 7 obstacles

| Prop id | model | role | x | y | r | slab | obstacle? |
|---|---|---|---|---|---|---|---|
| `abyss-chancel:west-processional-lamp-prop` | relic | processional-lantern | 2700 | 1600 | 140 | 01 | — |
| `abyss-chancel:vestry-screen-prop` | blade | background-vestry-screen | 2600 | 10700 | 300 | 01 | — |
| `abyss-chancel:narthex-colonnade-prop` | blade | wall | 5200 | 3800 | 650 | 01 | ✓ |
| `abyss-chancel:narthex-debris-prop` | relic | debris | 6000 | 9400 | 500 | 01 | ✓ |
| `abyss-chancel:nave-seal-prop` | blade | arch | 12200 | 3400 | 820 | 02 | ✓ |
| `abyss-chancel:transept-debris-prop` | relic | debris | 12800 | 9800 | 500 | 02 | ✓ |
| `abyss-chancel:crossing-lamp-prop` | relic | crossing-lantern | 13000 | 7400 | 150 | 02 | — |
| `abyss-chancel:nave-blade` | blade | objective-beacon | 15000 | 4200 | 150 | 02 | — |
| `abyss-chancel:oath-relic` | relic | oath-lantern | 18200 | 3600 | 190 | 03 | — |
| `abyss-chancel:east-colonnade-prop` | blade | wall | 20400 | 4200 | 650 | 03 | ✓ |
| `abyss-chancel:east-processional-lamp-prop` | relic | processional-lantern | 22200 | 1600 | 140 | 03 | — |
| `abyss-chancel:oath-ring-plinth-prop` | blade | oath-ring | 17800 | 10400 | 400 | 04 | ✓ |
| `abyss-chancel:apse-wing-prop` | relic | wall | 20200 | 9600 | 650 | 04 | ✓ |

`relic` = `assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb`,
`blade` = `…-object.03/…` `[OBSERVED]` (`stage-world-catalog.js:108-111`). Every
slab owns at least two props, so no chamber reads as empty floor. Pairwise
non-overlap verified; `transept-debris-prop` sits beside the stage's own flank
entry `chancel-transept (12800, 10200)` `[OBSERVED]` (`defense-catalog.js:370`).

Landmarks (6): `landmark.chancel-oath-apse`, `landmark.chancel-nave-seal`,
`landmark.narthex-colonnade`, `landmark.chancel-apse-wing`,
`landmark.chancel-oath-ring`, `landmark.chancel-processional-lamp`.

### 5.3 Echo Throne — 13 props, 7 obstacles

| Prop id | model | role | x | y | r | slab | obstacle? |
|---|---|---|---|---|---|---|---|
| `echo-throne:narthex-shard-prop` | blade | background-gallery-shard | 2800 | 1200 | 300 | 01 | — |
| `echo-throne:west-crown-light-prop` | relic | crown-lantern | 2700 | 10500 | 140 | 01 | — |
| `echo-throne:west-fractured-wing-prop` | blade | wall | 5400 | 9000 | 650 | 01 | ✓ |
| `echo-throne:gallery-debris-prop` | relic | debris | 9200 | 1400 | 500 | 02 | ✓ |
| `echo-throne:echo-aisle-prop` | blade | arch | 12000 | 2600 | 800 | 02 | ✓ |
| `echo-throne:crown-shard-prop` | relic | debris | 15600 | 1600 | 600 | 02 | ✓ |
| `echo-throne:aisle-blade` | blade | objective-beacon | 15200 | 4600 | 150 | 03 | — |
| `echo-throne:compass-inlay-lamp-prop` | relic | compass-lantern | 13400 | 7400 | 160 | 03 | — |
| `echo-throne:south-fractured-wing-prop` | blade | wall | 9800 | 9800 | 650 | 04 | ✓ |
| `echo-throne:dais-relic` | relic | throne-lantern | 18400 | 4200 | 190 | 05 | — |
| `echo-throne:fractured-dais-prop` | relic | arch | 19200 | 7600 | 700 | 05 | ✓ |
| `echo-throne:east-fractured-wing-prop` | blade | wall | 20600 | 9000 | 650 | 05 | ✓ |
| `echo-throne:east-crown-light-prop` | relic | crown-lantern | 22200 | 10500 | 140 | 05 | — |

`west-fractured-wing-prop` and `east-fractured-wing-prop` share radius 650 and
sit at the same `y = 9000` on opposite sides of the court — the crescent's two
horns. `narthex-shard-prop` and `west-crown-light-prop` bracket the narthex.

Landmarks (6): `landmark.throne-dais-relic`, `landmark.throne-echo-aisle`,
`landmark.throne-fractured-dais`, `landmark.throne-crown-shard`,
`landmark.throne-east-wing`, `landmark.throne-west-crown-light`.

### 5.4 Emitter → light inventory

The `author-game-levels` skill requires every local light to be attached to a
visible emitter, with a full source-to-light record. `visibilityAnchor`
(`stage-world-catalog.js:53-60` `[OBSERVED]`) carries `sourcePropId`, placement and
radius; the validator already enforces that a `motivated-light` anchor sits on
its emitter prop's **exact** `x, y` (`:507-510`) and stays `>= obstacleRadius + 300`
from every obstacle (`:505-508`).

Gameplay→world range conversion `[INFERENCE]` from I18:
`worldRange = gameplayRadius × 28 / 24000 = gameplayRadius / 857.142857`.

Attachment: every emitter here is a lantern/beacon prop fitted to pickup height
`0.7` world units `[OBSERVED]` (`battle-realtime-three.js` `TARGET_HEIGHT.pickup`),
so the light node attaches at local `+0.35 Y` — the lantern's own mid-height,
which is what a lantern of that size can plausibly emit from.

| Stage | Emitter prop (visible) | Light / anchor id | Type | Anchor x, y | Range (gameplay → world) | Colour | Intensity `[TARGET]` | Occlusion intent | Enabled | Fallback |
|---|---|---|---|---|---|---|---|---|---|---|
| cinder | `cinder-span:seal-brand` | `cinder-span:relay-light-anchor` | Point | 17600, 7400 | 1100 → 1.283 | `#f3592c` | 1.5 | no shadow; `occlusionSafe` | on | drop to ambient only |
| cinder | `cinder-span:forge-relic` | `cinder-span:forge-light-anchor` | Point | 15400, 7400 | 900 → 1.050 | `#ffb066` | 1.2 | no shadow | on | ambient only |
| cinder | `cinder-span:ingress-beacon-prop` | `cinder-span:ingress-beacon-light` | Point | 3000, 1700 | 760 → 0.887 | `#f3592c` | 1.0 | no shadow | on | ambient only |
| cinder | `cinder-span:gate-beacon-prop` | `cinder-span:gate-beacon-light` | Point | 22500, 10100 | 760 → 0.887 | `#f3592c` | 1.0 | no shadow | on | ambient only |
| chancel | `abyss-chancel:west-processional-lamp-prop` | `abyss-chancel:west-processional-light` | Point | 2700, 1600 | 720 → 0.840 | `#8f67ff` | 1.0 | no shadow | on | ambient only |
| chancel | `abyss-chancel:crossing-lamp-prop` | `abyss-chancel:crossing-light-anchor` | Point | 13000, 7400 | 900 → 1.050 | `#c9a9ff` | 1.2 | no shadow | on | ambient only |
| chancel | `abyss-chancel:oath-relic` | `abyss-chancel:oath-light-anchor` | Point | 18200, 3600 | 1100 → 1.283 | `#8f67ff` | 1.5 | no shadow | on | ambient only |
| chancel | `abyss-chancel:east-processional-lamp-prop` | `abyss-chancel:east-processional-light` | Point | 22200, 1600 | 720 → 0.840 | `#8f67ff` | 1.0 | no shadow | on | ambient only |
| throne | `echo-throne:west-crown-light-prop` | `echo-throne:west-crown-light` | Point | 2700, 10500 | 780 → 0.910 | `#72c8ff` | 1.0 | no shadow | on | ambient only |
| throne | `echo-throne:compass-inlay-lamp-prop` | `echo-throne:compass-light-anchor` | Point | 13400, 7400 | 900 → 1.050 | `#9fe0ff` | 1.2 | no shadow | on | ambient only |
| throne | `echo-throne:dais-relic` | `echo-throne:dais-light-anchor` | Point | 18400, 4200 | 1100 → 1.283 | `#72c8ff` | 1.5 | no shadow | on | ambient only |
| throne | `echo-throne:east-crown-light-prop` | `echo-throne:east-crown-light` | Point | 22200, 10500 | 780 → 0.910 | `#72c8ff` | 1.0 | no shadow | on | ambient only |

Rules carried from the skill:

* **No unexplained floating light.** Every row above names a visible emitter prop. Any future local light without an emitter row is a defect.
* **Emitter state governs the light.** If an emitter prop fails to load — `instantiateStageProp` can reject `[OBSERVED]` (`battle-realtime-three.js`, symbol `instantiateStageProp`, verified directly) — its local light must be removed, not left orphaned. The fallback column is that behaviour.
* **Ambient is documented separately and never fakes a lantern.** The hemisphere + directional pair (`battle-realtime-three.js:2155-2156` `[OBSERVED]`) is global mood and the sole source of direction; a stage may tint the PMREM environment, but may not add a positionless "torch".
* **Emitters are never obstacles.** All twelve emitters are small non-collidable props, which keeps them `>= obstacleRadius + 300` clear of every obstacle circle as the validator demands.

Fog breaks — one per slab, so every chamber has a guaranteed readable pocket
(validator needs `>= 1`; this authors 3 / 4 / 5):

| Stage | Anchor ids (x, y, radius) |
|---|---|
| cinder-span | `slab-01-fog-break` 4600, 6000, 1400 · `slab-02-fog-break` 12000, 6000, 1500 · `slab-03-fog-break` 20000, 6000, 1300 |
| abyss-chancel | `slab-01` 4200, 6000, 1400 · `slab-02` 10000, 6000, 1500 · `slab-03` 20800, 2400, 1200 · `slab-04` 19000, 8800, 1200 |
| echo-throne | `slab-01` 3800, 6000, 1400 · `slab-02` 10600, 3000, 1200 · `slab-03` 11000, 6000, 1500 · `slab-04` 13000, 9800, 1200 · `slab-05` 21000, 3600, 1300 |

All ids are prefixed `{stageId}:` per the stage-scoping rule
(`stage-world-catalog.js:404`).

---

## 6. Named-node contract

Convention `[OBSERVED]`: `terrain-{stage}-{role}-{index}`, index zero-padded to
3, resolved at runtime by `scene.getObjectByName(...)`
(`map-terrain-assets.md:305-330`). Existing roles are `terrain`, `feature`,
`prop`. This spec adds `slab` and `seam`.

| Node name | Role | Count | Requirement |
|---|---|---|---|
| `terrain-{stage}-terrain-001` | root | **optional — did not ship, and is not needed** | Originally required as the single uniformly-scaled parent. `fitFootprint` (`battle-realtime-three.js:1354-1360`) calls `Box3().setFromObject()` and `scale.setScalar()` on the instantiated glTF **scene**, which already is that parent, so slabs as direct scene children scale correctly. The shipped GLBs omit it. Keep it optional; do not add it back. |
| `terrain-{stage}-slab-{nnn}` | slab floor | 3 / 4 / 5 | One flat quad per slab, `Z = 0`, its own material, UVs from the global lattice (§1.4.1). `nnn` matches the slab `index`. |
| `terrain-{stage}-seam-{nnn}` | seam inlay | **0 shipped** (2 / 4 / 8 specified) | Flat inlay strip, 240 gameplay units wide, centred on the shared edge, `Z = 0`, `polygonOffset`. Presentation only — contributes no collider. **Not built.** The seam is currently a bare material edge between two coplanar quads. See risk R11. |
| `terrain-{stage}-apron-001` | apron | 1 per stage | Non-walkable dressing filling the §1.6 apron rect. Outside `gameplay.bounds`, no collider. |

Required node names, exhaustive:

```
terrain-cinder-span-terrain-001
terrain-cinder-span-slab-001  terrain-cinder-span-slab-002  terrain-cinder-span-slab-003
terrain-cinder-span-seam-001  terrain-cinder-span-seam-002
terrain-cinder-span-apron-001

terrain-abyss-chancel-terrain-001
terrain-abyss-chancel-slab-001 … -slab-004
terrain-abyss-chancel-seam-001 … -seam-004
terrain-abyss-chancel-apron-001

terrain-echo-throne-terrain-001
terrain-echo-throne-slab-001 … -slab-005
terrain-echo-throne-seam-001 … -seam-008
terrain-echo-throne-apron-001
```

Cinder's existing twelve feature/prop node names are **untouched** and remain the
addressable prop identities (I15):
`terrain-cinder-span-feature-{005,008,016,026,039}` and
`terrain-cinder-span-prop-{006,011,012,014,030,033,044}`.

Names must survive export (glTF 2.0 preserves object names) and every new asset
must be registered in `assets/defense-asset-manifest.json` via
`node scripts/build-defense-asset-manifest.mjs --write` `[OBSERVED]`
(`map-terrain-assets.md:522-535`).

### 6.1 Required validator extension (additive)

`terrainTiles` ids are currently not claimed, so a slab id could silently collide
with a route or prop id. Add a block to `validateProfile` immediately after the
`meshColliders` block (`stage-world-catalog.js:416-431`):

```js
const tiles = profile.gameplay.terrainTiles ?? [];
if (!Array.isArray(tiles) || tiles.length < 1) throw new Error(`Stage world requires authored terrain tiles: ${profile.stageId}`);
let tiledArea = 0;
tiles.forEach((tile, index) => {
  claimId(tile);                                   // stage-scoped uniqueness, shares the id set
  const r = tile.rect;
  if (!(tile.index === index + 1
    && tile.id === `${profile.stageId}:slab-${String(index + 1).padStart(2, "0")}`
    && tile.plateNode === `terrain-${profile.stageId}-slab-${String(index + 1).padStart(3, "0")}`
    && tile.elevation === 0
    && Number.isInteger(r.minX) && Number.isInteger(r.maxX)
    && Number.isInteger(r.minY) && Number.isInteger(r.maxY)
    && r.minX < r.maxX && r.minY < r.maxY
    && inside(r.minX, minX, maxX) && inside(r.maxX, minX, maxX)
    && inside(r.minY, minY, maxY) && inside(r.maxY, minY, maxY)
    && tile.colliderTriangleIndices[0] === index * 2
    && tile.colliderTriangleIndices[1] === index * 2 + 1)) throw new Error(`Invalid terrain tile: ${tile.id}`);
  tiledArea += (r.maxX - r.minX) * (r.maxY - r.minY);
  for (let other = 0; other < index; other += 1) {
    const q = tiles[other].rect;
    if (Math.max(0, Math.min(r.maxX, q.maxX) - Math.max(r.minX, q.minX))
      * Math.max(0, Math.min(r.maxY, q.maxY) - Math.max(r.minY, q.minY)) !== 0) throw new Error(`Terrain tiles overlap: ${tile.id}, ${tiles[other].id}`);
  }
});
if (tiledArea !== (maxX - minX) * (maxY - minY)) throw new Error(`Terrain tiles must tile the walkable bounds exactly: ${profile.stageId}`);
if (profile.gameplay.meshColliders[0].triangles.length !== tiles.length * 2) throw new Error(`Support mesh must carry two triangles per terrain tile: ${profile.stageId}`);
```

This is purely additive: it introduces no new failure for any field that exists
today, and it makes the four tiling contracts of §1.1 machine-checked rather than
promised.

---

## Verification matrix

| # | Check | Assertion | Where measured | Status |
|---|---|---|---|---|
| V1 | Authored profiles satisfy the live validator | Importing the module runs `validateProfile` on all three stages without throwing | `cd /Users/jangyoung/orca/Abyssal-Surge-dungeon && node --input-type=module -e 'await import("/tmp/abyssal-slab-check/candidate-catalog-v6-final.mjs")'` | **PASS `[OBSERVED]`** — "VALIDATOR PASS v6", dungeon `defense-catalog.js`, dungeon `cwd` |
| V2 | Slabs tile bounds exactly, no gap | `Σ slabArea === boundsArea` per stage | same harness | **PASS `[OBSERVED]`** — 237 120 000 / 241 680 000 / 246 240 000, all equal |
| V3 | Slabs never overlap | pairwise intersection area `=== 0` | same harness | **PASS `[OBSERVED]`** — 0 for all three |
| V4 | No slab leaves bounds | every rect inside `gameplay.bounds` | same harness | **PASS `[OBSERVED]`** |
| V5 | Collider triangle count matches slab count | `triangles.length === 2 × slabs.length` | same harness | **PASS `[OBSERVED]`** — 6 / 8 / 10 |
| V6 | Every collider vertex flat and integer | `elevation === 0`, `Number.isInteger(x && y)` | `tests/defense-stage-world-movement.test.mjs:135-142` | not run (director hard stop); satisfied by construction — all authored rects are integers |
| V7 | No route waypoint inside an obstacle or prop radius | min margin `> 0` over every (segment × blocker) pair | same harness | **PASS `[OBSERVED]`** — tightest +49.86 / +301.24 / +200.00 |
| V8 | Critical route terminates at the canonical gate | `finalGate === (22000, 6000)` | `stage-world-catalog.js:449-450` | **PASS `[OBSERVED]`** via V1 |
| V9 | Waypoint role sequences unchanged | critical `[ingress, intermediate-objective, intermediate-gate, final-gate]`; detour `[detour-entry, detour-objective, detour-exit]` | `tests/stage-world-encounter-routing-contract.test.mjs:265-272` | not run; satisfied by construction — 4 and 3 waypoints, exact roles |
| V10 | Quest points still bind to simulation truth | points 1–2 equal `STAGE_ENCOUNTER_ROUTES[...].objectives[].point`; 3 = occupation, 4 = extraction | `tests/stage-world-quest-points.test.mjs:200-211` | not run; satisfied by construction — quest point coordinates unchanged |
| V11 | Cinder prop identity preserved | 12 props, exact ids, exact `modelNode` set, exact placements | `tests/runtime-visual-assets.test.mjs:86,100-140` | not run; satisfied by construction — Cinder props copied verbatim |
| V12 | Cinder pack nodes still resolvable | every Cinder `modelNode` exists in the two runtime pack GLBs | `tests/stage-terrain-environment-contract.test.mjs:388-391` | not run; unaffected — no `modelNode` changed |
| V13 | Movement fixture intact | obstacle `cinder-span:west-ash-wall` at `(19000,4400) r940` still present | `tests/defense-stage-world-movement.test.mjs:17,76-101` | not run; satisfied by construction |
| V14 | Terrain promotion is coherent | each stage holds a promoted path **xor** a fallback; promoted path under `assets/mesh/terrain/**/runtime/**` and not under `/textured-candidate/`; candidate path retained | `stage-world-catalog.js:392-395` (module-load validator), inverted catalog-contract tests | **PASS `[OBSERVED]`** — all three promoted, `terrainRuntimeEligible: true`, fallback deleted, module loads without throwing |
| V15 | `EXPECTED_WORLD_TOPOLOGY` fixture regenerated | fixture matches the new props / obstacles / routes / collider triangles | `tests/stage-world-quest-points.test.mjs:13-135` — **fixture must be rewritten in the implementation phase** | **WILL FAIL until updated** — see risk R1 |
| V16 | `slabMaterialAt` is total and single-valued | resolves every in-bounds point; a point on a seam always returns the lower-index slab | new unit test, to be added beside `tests/defense-stage-world-movement.test.mjs` | `[TARGET]` — not yet written |
| V17 | Gimmick corridor floor respected | every gimmick's `corridorWidthAfter >= 900`, i.e. `> 2 × COMMANDER.radius (720)` | new unit test over `profile.gameplay.gimmicks` | **PASS `[OBSERVED]`** arithmetically — authored set is 900/1000/900/900/900/900/900 and the two lane-adding/no-change gimmicks; min = 900 > 720 |
| V18 | Gimmick determinism | `run.gimmickRng` derives from `seed ^ 0x85ebca6b`; `run.rng` untouched; `getRunDigest()` depth-0 bytes unchanged for a fixed seed | existing digest fixtures + a new gimmick-stream test | `[TARGET]` — unmeasured |
| V19 | One gimmick trigger per tick | no two `GIMMICK_TRIGGERED` events share a tick across a full seeded run | new simulation test | `[TARGET]` — unmeasured |
| V20 | `fitFootprint` is a no-op for the authored floor | loaded terrain footprint's larger axis `=== 32.2`, so scale `=== 1.000000`; vertical extent `=== 0` | glTF accessor min/max read directly from the three shipped floor GLBs | **PASS `[OBSERVED]` on the real asset** — extentX 32.2000 for all three; extentZ 29.8667 / 30.3333 / 30.8000; **vertical extent exactly 0.000000**; `fitFootprint` scale exactly 1.000000 for all three |
| V21 | Seam produces no visible ridge | browser proof: walk each seam on every route, no step, no crack, no z-fight flicker; capture per-seam screenshot | `tests/stage-runtime-proof-browser.test.mjs` | `[TARGET]` — unmeasured, owned by the Verification phase |
| V22 | Floor draw calls within budget | ≤ 4 floor draw calls per stage after material merge; p95 frame ≤ 16.7 ms | browser proof `debugMetrics()` | `[TARGET]` — unmeasured, G6 owned by the director's baseline run |
| V23 | 5–15 minute traversal | each stage completes in 300–900 s of simulated time on the authored routes | `scripts/measure-stage-playtime.mjs` `[OBSERVED]` (`defense-catalog.js:629`) | `[TARGET]` — owned by `EncounterPacing` |

V6, V9–V14 are marked "not run" deliberately: the director issued a hard stop on
suite execution for this cycle because four concurrent runners at load average
101.75 manufacture timeout failures. Each is satisfied by construction and its
exact assertion site is named above for the Verification phase.

---

## Open risks

**R1 — `EXPECTED_WORLD_TOPOLOGY` will fail until regenerated.** *Breaks:*
`tests/stage-world-quest-points.test.mjs:13-135`, test "quest metadata is a
presentation overlay that leaves world traversal topology unchanged". That
fixture hard-codes every prop id, obstacle id, collider triangle and route
waypoint for all three stages. Re-authoring routes and obstacles — which this
assignment requires — necessarily invalidates it. *Mitigation:* the fixture is a
snapshot, not a contract; regenerate it from the new profiles in the same commit
as the catalog change, and diff it by eye against §2/§3/§5 before accepting. It
must be regenerated, never deleted or loosened.

**R2 — Cinder's clearance margin is structurally thin.** *Breaks:*
`stage-world-catalog.js:478` (prop route clearance). I15 freezes
`west-ash-wall-prop` at `(19000,4400) r940` and I13 pins the gate at
`(22000,6000)`, so the final leg's clearance is nearly determined; the
`intermediate-gate` `y` is almost the only free variable: at `y = 6000` the
required clearance is 1640 against an available 1600, so the objective-centre
placement **fails outright** at the final width of 1400, and `y = 6400` is what
makes the stage legal.

The detour is tighter still and is the binding case for the whole spec:
`collapsed-parapet-prop` is frozen at `(13200, 9300) r900` and the south bound is
`11200`, leaving **exactly 1000 units** for a 900-wide corridor — margin and
inset headroom can only ever be ~50 each (§3.2). *Mitigation:* treat Cinder's
critical `corridorWidth: 1400` with the `(17400, 6400)` waypoint, and the detour
`corridorWidth: 900` with the `y = 10700` lane, as **four coupled values**.
Changing any one requires re-running the V7 margin measurement. If
`collapsed-parapet-prop` is ever unfrozen, moving it north is the single change
that relieves the whole constraint.

**R3 — Echo Throne sits near the prop ceiling.** *Breaks:*
`stage-world-catalog.js:465-466` (`props.length > 14`). Throne and Chancel are
authored at 13 of a maximum 14. *Mitigation:* any future Throne prop must replace
one, or the ceiling must be raised deliberately with a stated reason. The 14-prop
cap exists to keep stages sparse and readable; raising it silently is the wrong
fix.

**R4 — Gimmick VFX cues do not render until the renderer anchor defect is fixed.**
*Breaks:* nothing that passes today; it makes new work invisible. `[OBSERVED]`
`effectAnchor()` never reads top-level `event.x` / `event.y` and `spawnVfx()`
hard-returns on a null anchor — confirmed by the director as defect D1. All three
`GIMMICK_*` events carry top-level `x, y` per ruling R8, so every gimmick cue
silently no-ops until prerequisite PR-1 lands. *Mitigation:* PR-1 is owned by
`VfxCueDesign`; this spec keeps the ruled field names and does not work around
it. Do not rename `x`/`y` to `anchor` locally — that would create the
translation-map defect ruling R19 forbids.

**R5 — A "narrowing" gimmick implemented as collision would break routes.**
*Breaks:* `stage-world-catalog.js:456`/`:478` and every authored route at once. If an
implementer adds runtime obstacles to realise a narrowing, the authored
`corridorWidth` becomes a lie, pathing diverges from the authored corridor, and
the clearance invariant is violated without any test noticing (the validator only
sees authored data). *Mitigation:* §4.1 rules 1–3 are binding — hazard/steering
band only, authored width unchanged, `corridorWidthAfter >= 900` (> the 720 commander diameter). V17 should be
implemented as a real test so the floor is machine-checked.

**R6 — Slab count multiplies floor draw calls.** *Breaks:* the G6 budget (p95
≤ 16.7 ms), not a test. Naive per-slab and per-seam meshes take Throne from 1
floor draw call to 13. *Mitigation:* the material-merge requirement in §1.7 caps
it at ≤ 4 per stage. Unmeasured — the number is `[TARGET]` and the director owns
the baseline run.

**R7 — The rectified plate can still smuggle baked light.** *Breaks:* visual
coherence, and the same judgement that produced
`authored-diorama-not-flat-gameplay-eligible` `[OBSERVED]`
(`stage-world-catalog.js:125`). If D3 de-lighting is skipped or under-applied, two
slabs at different `plateRotationQuarters` will show contradictory light
directions on one coplanar floor. *Mitigation:* D3 is mandatory and its σ is
specified; the acceptance check is a 90°-rotation A/B of the same texture under
the scene's single directional light.

**R8 — Slab ids are unvalidated until §6.1 lands.** *Breaks:* nothing loudly — a
slab id could duplicate a route or prop id and no test would notice, because
`claimId` never sees `terrainTiles`. *Mitigation:* ship the §6.1 validator
extension in the same commit as `terrainTiles`. It is additive and cannot fail on
existing fields.

**R9 — Two-worktree provenance.** *Breaks:* any citation, and potentially the
forbidden tree itself. This spec was authored in
`/Users/jangyoung/orca/Abyssal-Surge` but is implemented in
`/Users/jangyoung/orca/Abyssal-Surge-dungeon` @ `033877ad`. `[OBSERVED]`
`defense-catalog.js` differs across the two trees (923 vs 1012 lines) and
`battle-realtime-three.js` is 4846 lines in the dungeon tree; `[OBSERVED]`
`stage-world-catalog.js` is byte-identical (`diff -q`, 576 lines), which is why
this spec's core citations survived. Worse, the `edit`/`write` tools resolve a
**relative** path against the authoring tree, so a relative edit header can write
into the tree nobody is allowed to touch — the stale-hash check is the only
guard, and it fails open for byte-identical files (director ruling R20).
*Mitigation:* §0.2 carries a measured anchor table for all four files and every
citation in this document has been re-measured through an absolute dungeon path.
Implementers must still anchor on symbols, pass absolute dungeon paths to every
tool, and pass `cwd` on every shell call. A copy of this spec is mirrored to the
dungeon tree at the identical relative path; both copies are byte-identical
(`shasum -a 256` match) and must be kept so.

**R12 — `telegraphTicks` collides with a pre-existing field, and un-gated it
exhausts the VFX pool.** *Breaks:* any type-agnostic cue-lifetime helper, and
through it the entire 24-slot VFX budget.

`[OBSERVED]`, verified against the base blob by me and independently by
`EncounterPacing` and `AudioFeedbackDesign`:
`git show 033877ad:defense-run-simulation.js | grep -n telegraphTicks` → `:2296`.
The field is already emitted on **`ENCOUNTER_PATH_CONTESTED`** carrying
`contestTicks`, sourced at `:2284` from
`Math.max(1, waypoint.contestTicks || objective?.contestTicks || 60)` — *how long
a body must hold a contest waypoint*. A routing duration, not a reaction window.

**The blast radius is quantified, not hypothetical.**
`ENCOUNTER_PATH_CONTESTED` fires for every routed body at every contest waypoint.
At `EncounterPacing`'s wave counts that is **120 / 139 / 137 bodies per stage**.
A type-agnostic `Number.isInteger(event.telegraphTicks)` reader therefore spawns
one telegraph cue **per arriving enemy**, at lifetimes 60–105 (objective
`contestTicks`) and 90–150 (finale waypoints), into a pool of
`MAX_VISUAL_EFFECTS = 24`. Contest noise evicts the arrival and gimmick cues the
pool was sized for. This is a failure that passes `node --check` and a green test
run and only appears as pool starvation at runtime.

**Required dispatch order — switch on `event.type` FIRST:**

```js
if (event.type === "GIMMICK_ARMED")      lifetime = Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 180;
else if (event.type === "ENEMY_SPAWNED") lifetime = Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 90;
// ENCOUNTER_PATH_CONTESTED carries telegraphTicks and is NOT a telegraph cue — never consume it here.
```

A **second, benign collision** exists: `recoveryTicks` also pre-dates this cycle
(`:1031`, `:1049`, emitted on `ENCOUNTER_RECOVERY_STARTED` from
`objective.retry.recoveryTicks`). Same concept at a different scope, and both are
integer tick spans, so a mis-read degrades to a wrong-but-plausible duration
rather than a flood. Match on type there too.

Genuinely new, **0 occurrences** in the blob: `gimmickClass`, `slabId`,
`blockId`, and `grade` as a field — the three `grade` substring hits are the word
"upgrade" inside comments, which I checked rather than assuming.

*Mitigation:* §4.1 rule 5 carries the dispatch order.

**Renderer status: CLOSED, verified rather than assumed.** `[OBSERVED]` by the
director, who owns `battle-realtime-three.js` and read it rather than asking:
`resolveVfxLifetimeTicks` (`:517-527`) dispatches on `event.type` **first**, and
of the 10 grep hits **8 are comments and exactly 2 are real reads** — `:523`
inside the `ENEMY_SPAWNED` branch and `:525` inside `GIMMICK_ARMED`. There is no
shared `effectLifetime(event)` helper and no type-agnostic path.
`ENCOUNTER_PATH_CONTESTED` falls through to `return table`, and having no
`VFX_MODELS` entry it exits `spawnVfx` at `if (!relPath) return;` before any
lifetime is consumed. `telegraphLifetime` additionally demands
`Number.isInteger(value) && value > 0`, so a float or zero degrades to the class
fallback. **The pool-exhaustion vector cannot occur in the shipped renderer.**
The analysis was right and worth the alarm; the implementation happened to
already be correct. Both facts are on record — that is the difference between a
verified claim and a lucky one.

**Still binding for any future consumer.** The guard is a property of one
function today, not of the codebase. A new reader that skips the type dispatch
re-opens the whole vector. Two related traps, from peers: `ENCOUNTER_PATH_CONTESTED`
also carries `objectiveId`, so a *presence-keyed* gimmick chip would render a
complete, plausible-looking chip — real label, real lifetime — for a route
contest with no gimmick, and a defect that looks correct survives review. And
`reason` already carries **four incompatible vocabularies** across six events,
which is worse than `telegraphTicks` because the value sets do not overlap today,
so a `reason`-keyed table fails *silently*. The durable shape is an explicit
allow-set — `GIMMICK_EVENTS.has(event.type)` — checked before any field read, and
a standing prohibition on a shared cross-family telegraph reader.
*Provenance:* I chose this field name without grep-checking prior use, in a spec
whose own §0.2 is about verifying against the blob. Caught by peers, not by me.
Renaming is cleaner but the name is director-ruled and adopted by three lanes, so
dispatch discipline is the correct fix rather than a late rename.

**R11 — Seams shipped with no inlay strip.** *Breaks:* nothing structurally —
the floor is provably coplanar (`[OBSERVED]` vertical extent exactly
`0.000000` in all three shipped GLBs), so there is no ridge, no crack a capsule
can catch on, and no z-fighting (the quads do not overlap). What is at risk is
purely the *read*: §1.4 promised the material transition would be covered by a
240-wide `terrain-{stage}-seam-{nnn}` inlay, and none was built. The claim "the
seam reads as a deliberate chamber boundary rather than a texture swap" is now
carried entirely by the de-lit plates and the shared global UV lattice.
*Mitigation:* V21 (browser walk of every seam) is the check that decides whether
an inlay is needed at all; it is unmeasured. If a seam reads as an accidental
texture join, the inlay is additive presentation-only geometry and can be added
without touching collision, routes, or the catalog. Do not "fix" a visible seam
by offsetting a slab in Z — that would break I17 and the measured 0.000000
vertical extent.

**R10 — Every number authored here is `[TARGET]`, including the readability
claims.** No human has walked these routes, no seam has been rendered, and no
frame time has been sampled. V21–V23 are unmeasured. This spec is a design
artifact; it moves no gate. Per the cycle brief, "설계·자산은 측정이 아니다" —
design and assets are not measurement.
