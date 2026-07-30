# Layout cutover contract — routes and obstacles, cycle 10 close

`[OBSERVED]` Measured in `/Users/jangyoung/orca/Abyssal-Surge-dungeon` at HEAD.
Source of truth: `_workspace/current/design/stage-dungeon-composition-spec.md`
§3.2–§3.4 (routes) and §5.1–§5.3 (obstacles/props). Every number below is quoted
from that spec, not derived.

## Why this is split into two commits

The simulation's coupling to `stage-world-catalog.js` was measured, not assumed:

| data | read by `defense-run-simulation.js` | digest impact |
|---|---|---|
| `gameplay.routes` | **zero reads** (`grep -c "gameplay\.routes"` = 0) | **none** |
| `gameplay.obstacles` | `resolveTerrainPlacement`, `firstObstacleHit` | **yes** — displaces entities |
| `gameplay.bounds` / `meshColliders` | yes | unchanged here |

`stageLayout` in `getRunSnapshot` (`:3949`) is built from `run.tactics` only, so
neither routes nor obstacles enter it directly. `clampToWorld` `Math.round`s every
coordinate, so no float can leak into `PRE_EXISTING_FLOAT_PATHS`.

Therefore:

1. **Commit A — routes only.** Must land with the determinism baseline
   (`tests/defense-run-simulation.test.mjs` check 1) **still green**. That green is
   the evidence that routes are digest-neutral. Do not re-pin any hash in this commit.
2. **Commit B — obstacles + the props that back them.** Checks 1 and 2 go red
   legitimately. Re-capture the baseline hashes in the **same** commit using
   `git show 033877ad:defense-run-simulation.js`, so the delta is attributable to
   exactly one geometry change.

Anything that re-pins a hash in commit A is wrong by construction.

## Commit A — route waypoints and corridor widths

Current vs spec, measured. `corridorWidth` changes too, and the validator's
clearance rule scales with it, so widths and waypoints must move together.

| stage | route | corridorWidth now → spec |
|---|---|---|
| cinder-span | critical | 1200 → **1400** |
| cinder-span | optional-detour | 700 → **900** |
| abyss-chancel | critical | 1000 → **1400** |
| abyss-chancel | optional-detour | 700 → **900** |
| echo-throne | critical | 1100 → **1400** |
| echo-throne | optional-detour | 700 → **900** |

Waypoints — 5 of 7 differ on every stage. `ingress` and `final-gate` already match
and must not move (`final-gate` is the ARENA gate, fixed by I13).

### cinder-span (`stage-world-catalog.js:142-152`)

```js
route("cinder-span:critical-route", "critical", 1400, [
  waypoint("cinder-span:ingress",               "ingress",                1800,  6000),
  waypoint("cinder-span:cinder-relay-crossing", "intermediate-objective", 14600, 5200),
  waypoint("cinder-span:cinder-forge-stand",    "intermediate-gate",      17400, 6400),
  waypoint("cinder-span:final-gate",            "final-gate",             22000, 6000),
]),
route("cinder-span:optional-detour", "optional-detour", 900, [
  waypoint("cinder-span:detour-entry",   "detour-entry",     6000, 10600),
  waypoint("cinder-span:ash-cache",      "detour-objective", 13200, 10700),
  waypoint("cinder-span:detour-exit",    "detour-exit",      19600, 10700),
]),
```

`intermediate-gate` is at `y = 6400`, **not** on the objective centre `y = 6000`.
Spec §3.1 derives this: at `y = 6000` the final leg passes exactly 1600 from the
frozen `west-ash-wall-prop` (r940) against a requirement of `940 + 700 = 1640`, so
it fails. Lifting to 6400 tilts the leg away. Do not "correct" it to 6000.

### abyss-chancel

```js
route("abyss-chancel:critical-route", "critical", 1400, [
  waypoint("abyss-chancel:ingress",               "ingress",                1800,  6000),
  waypoint("abyss-chancel:chancel-nave-advance",  "intermediate-objective", 15000, 6000),
  waypoint("abyss-chancel:chancel-transept-lock", "intermediate-gate",      17600, 8200),
  waypoint("abyss-chancel:final-gate",            "final-gate",             22000, 6000),
]),
route("abyss-chancel:optional-detour", "optional-detour", 900, [
  waypoint("abyss-chancel:detour-entry",       "detour-entry",     6200, 2600),
  waypoint("abyss-chancel:mirror-aisle-cache", "detour-objective", 12000, 1800),
  waypoint("abyss-chancel:detour-exit",        "detour-exit",      19800, 2600),
]),
```

### echo-throne

```js
route("echo-throne:critical-route", "critical", 1400, [
  waypoint("echo-throne:ingress",            "ingress",                1800,  6000),
  waypoint("echo-throne:throne-aisle-break", "intermediate-objective", 15200, 6000),
  waypoint("echo-throne:throne-dais-stand",  "intermediate-gate",      18000, 6000),
  waypoint("echo-throne:final-gate",         "final-gate",             22000, 6000),
]),
route("echo-throne:optional-detour", "optional-detour", 900, [
  waypoint("echo-throne:detour-entry",         "detour-entry",     7800,  2200),
  waypoint("echo-throne:mirror-gallery-cache", "detour-objective", 12400, 9800),
  waypoint("echo-throne:detour-exit",          "detour-exit",      19200, 9200),
]),
```

**Waypoint ids change on some rows** (e.g. cinder keeps `ash-cache`; chancel gains
`mirror-aisle-cache`, throne gains `mirror-gallery-cache`). Check
`tests/stage-world-quest-points.test.mjs` and
`tests/stage-world-encounter-routing-contract.test.mjs` for id assertions before
renaming, and update them in the same commit if they pin old ids.

### Validator rules commit A must satisfy

`stage-world-catalog.js` validates at module load; a violation **throws on import**,
so `node -e "import('./stage-world-catalog.js')"` is the fastest gate.

* **I6 waypoint inset** — every waypoint inside `bounds` inset by `corridorWidth / 2`.
  At 1400 that is `x ∈ 1300..22700`, `y ∈ 1500..10500` for cinder (bounds
  `600..23400 × 800..11200`). Widening 1200 → 1400 shrinks the legal box, so a
  waypoint that was legal can become illegal.
* **I7 clearance** — for every route segment and every obstacle **and prop**:
  `pointSegmentDistance(centre, segStart, segEnd) >= radius + corridorWidth / 2`.
  Props count as blockers. Spec's measured tightest margins: cinder **+49.86**,
  chancel **+301.24**, throne **+200.00** — all positive, cinder's is a hard
  geometric limit, not slack.

## Commit B — obstacles, and the props that back them

| stage | obstacles now → spec | props now → spec |
|---|---|---|
| cinder-span | 3 → **6** | 12 → 12 (frozen by I15, unchanged) |
| abyss-chancel | 6 → **7** | 12 → **13** |
| echo-throne | 6 → **7** | 12 → **13** |

### cinder-span — obstacles only, props frozen

I10 forces identical `x, y, radius` to the backing prop; I15 freezes all twelve
prop placements. So the three added obstacles promote already-visible frozen props
to collision. Full target set (spec §5.1):

| obstacle id | x | y | r | propId |
|---|---|---|---|---|
| `cinder-span:relay-debris-north` | 5000 | 10400 | 500 | `cinder-span:relay-debris-north-prop` |
| `cinder-span:drowned-forge-arch` | 12600 | 2800 | 850 | `cinder-span:forge-arch` |
| `cinder-span:collapsed-parapet` | 13200 | 9300 | 900 | `cinder-span:collapsed-parapet-prop` |
| `cinder-span:relay-debris-south` | 15000 | 1500 | 540 | `cinder-span:relay-debris-south-prop` |
| `cinder-span:west-ash-wall` | 19000 | 4400 | 940 | `cinder-span:west-ash-wall-prop` |
| `cinder-span:east-ash-wall` | 20800 | 9900 | 700 | `cinder-span:east-ash-wall-prop` |

`west-ash-wall` keeps id, centre and radius exactly — it is the live movement
fixture of I16, asserted by `tests/defense-stage-world-movement.test.mjs`.

**Verify each `propId` exists with matching geometry before adding the obstacle.**
The three new rows name props that must already be in the catalog at those exact
coordinates; if a prop is missing or sits elsewhere, stop and report rather than
inventing a placement.

### chancel and throne

Spec §5.2 and §5.3 give full 13-row prop tables with an `obstacle?` column. The
current catalog has 12 props and 6 obstacles on each. Read those tables and
reconcile: the spec's prop set is **not** a superset of the current one — several
ids and coordinates differ (e.g. current `abyss-chancel:oath-apse-prop` r880 at
(14000,8750) has no spec row; spec has `narthex-colonnade-prop` r650 at (5200,3800)
which the catalog lacks).

**This is a reconciliation, not an append.** Removing a prop id breaks
`tests/runtime-visual-assets.test.mjs` and
`tests/stage-terrain-environment-contract.test.mjs`, which pin prop ids and
### chancel and throne — measured, and the art blocker does NOT exist

`[OBSERVED]` The concern that a new prop might need unauthored art applies to **cinder
only**. Measured `modelNode` backing per stage:

| stage | props with a `modelNode` | `modelPath` |
|---|---|---|
| cinder-span | **12/12** | stage-specific `terrain-cinder-span-props.glb` + `-features.glb` |
| abyss-chancel | **0/12** | shared `prop-sprite-sheet-single-object.05` (relic) / `.03` (blade) |
| echo-throne | **0/12** | same two shared meshes |

So cinder's props are real authored terrain art addressed by node name, and a prop that
names a missing node is genuinely unauthored. Chancel and throne props are **generic
relic/blade instances with no node addressing at all** — which is exactly what spec §5.2
states (`relic` = `…object.05…`, `blade` = `…object.03…`). Adding a chancel or throne prop
therefore needs no new art: pick `relic` or `blade` per the spec's `model` column.

Cinder needs no prop change at all. All three of its added obstacles are backed by props
**already in the catalog at exactly the spec's geometry**, verified:
`relay-debris-north-prop` (5000, 10400, r500) node `terrain-cinder-span-prop-033`,
`relay-debris-south-prop` (15000, 1500, r540) node `terrain-cinder-span-prop-044`,
`east-ash-wall-prop` (20800, 9900, r700) node `terrain-cinder-span-feature-008`. So I10
is satisfiable by promotion alone.

### chancel and throne — the actual reconciliation, measured row by row

This is **not** an append. Measured against spec §5.2/§5.3:

| stage | exact | moved | absent | dropped |
|---|---|---|---|---|
| abyss-chancel | 3 | 5 | 5 (4 of them back obstacles) | 4 |
| echo-throne | 3 | 7 | 3 (1 backs an obstacle) | 2 |

**abyss-chancel** — absent: `narthex-colonnade-prop` (5200,3800,r650)◆,
`narthex-debris-prop` (6000,9400,r500)◆, `transept-debris-prop` (12800,9800,r500)◆,
`oath-ring-plinth-prop` (17800,10400,r400)◆, `crossing-lamp-prop` (13000,7400,r150).
Moved: `nave-seal-prop` y 3150→3400◆, `nave-blade` (12200,4800)→(15000,4200),
`oath-relic` (18000,7600)→(18200,3600), `east-colonnade-prop` (18500,2600)→(20400,4200)◆,
`apse-wing-prop` (19100,9400)→(20200,9600)◆. Dropped: `oath-apse-prop` r880,
`west-colonnade-prop` r650, `vestry-debris-prop` r500, `south-nave-screen-prop` r360.

**echo-throne** — absent: `narthex-shard-prop` (2800,1200,r300),
`compass-inlay-lamp-prop` (13400,7400,r160), `south-fractured-wing-prop` (9800,9800,r650)◆.
Moved: `gallery-debris-prop` (6200,1200)→(9200,1400)◆,
`echo-aisle-prop` (11800,3000)→(12000,2600)◆,
`crown-shard-prop` (19400,2400)→(15600,1600)◆, `aisle-blade` (11800,4400)→(15200,4600),
`dais-relic` (18200,7200)→(18400,4200),
`fractured-dais-prop` (15400,8600,r900)→(19200,7600,**r700**)◆,
`east-fractured-wing-prop` (19000,9000)→(20600,9000)◆. Dropped: `court-crescent-prop`
r380, `south-gallery-shard-prop` r300.

`◆` = backs an obstacle, so I10 forces the obstacle's geometry to move with it.

Two consequences to weigh before editing:

* **Dropping a prop is a visible content deletion**, not a refactor. Four chancel and two
  throne props disappear from the world. Each dropped prop must also lose its landmark and
  `visibilityAnchor` if one references it, or the validator's emitter rule fails.
* **`fractured-dais-prop` changes radius** 900 → 700 as well as position, so its obstacle
  shrinks. That is a gameplay change, not a reposition.

`tests/combat-presentation-contract.test.mjs:1273` hardcodes `propCount === 11` — verified
to be the **cinder** case with one node deliberately removed (12 − 1), so it is unaffected
by chancel/throne prop counts. Re-verify rather than trusting this line.

  A new obstacle can invalidate a route that was legal, so re-run the validator.
* **Emitters are never obstacles** — all twelve light emitter props stay
  non-collidable and `>= obstacleRadius + 300` from every obstacle circle.

## Verification, both commits

```bash
cd /Users/jangyoung/orca/Abyssal-Surge-dungeon
node -e "import('./stage-world-catalog.js').then(()=>console.log('validator OK'))"
node --test --test-concurrency=2 \
  tests/stage-world-encounter-routing-contract.test.mjs \
  tests/stage-world-quest-points.test.mjs \
  tests/defense-stage-world-movement.test.mjs \
  tests/runtime-visual-assets.test.mjs \
  tests/stage-terrain-environment-contract.test.mjs
```

Commit A additionally: `node --test tests/defense-run-simulation.test.mjs` must be
**40/40 with no hash re-pin**. If check 1 goes red in commit A, routes are not
digest-neutral and the measurement in this contract is wrong — stop and report,
do not re-pin.

## Hard rules

* Use **absolute paths** on every tool call. Relative paths resolve against
  `/Users/jangyoung/orca/Abyssal-Surge` — the forbidden tree — and silently measure
  or write the wrong file. This cost this cycle four poisoned citations and one
  near-miss write.
* Line numbers in the design spec are unreliable across trees. Anchor on **symbol
  and quoted code text**, re-grep before every edit.
* Never weaken or delete an assertion to make a test pass. If an assertion blocks
  the spec, report the conflict.
* `_workspace/` is per-worktree. Write only under the dungeon worktree's copy.
