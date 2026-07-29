# Stage Composition Audit — Stage 1 `cinder-span` (fidelity reference)

```yaml
run_id: 20260728-onslaught-action-pivot
status: "[OBSERVED] — audit of shipped catalog + asset state"
owner_skill: author-game-levels
scope: stage 1 only; stages 2-10 are audited in the sibling document
authority: defense-catalog.js, stage-world-catalog.js, campaign-state.js
depends_on:
  - design/pcg-stage-layout-spec.md
  - design/encounter-wave-spec.md
  - design/lobby-story-presentation-spec.md
```

This document is the **reference row** of the ten-stage composition audit. It records what
stage 1 actually is in the shipped catalog, and — in §6 — exactly which assets and code paths
stage 1 has that the other nine do not. Every other stage's "composition gaps" section is
measured against §6 and §7 here.

Evidence rule for this file: a path or value is `[OBSERVED]` only when this audit resolved it
from the named source line or listed it on disk. Design targets carried from
`pcg-stage-layout-spec.md` / `encounter-wave-spec.md` stay `[TARGET]` and are never restated
as measurements.

---

## 1. Identity

| Field | Value | Source |
|---|---|---|
| stage id | `cinder-span` | `defense-catalog.js:676` `[OBSERVED]` |
| display name | `Cinder Span` | `defense-catalog.js:676`; `campaign-state.js:16` `[OBSERVED]` |
| boss name | `Cinder Warden` | `defense-catalog.js:676`; `campaign-state.js:16` `[OBSERVED]` |
| campaign sequence | `1` | `campaign-state.js:16` (`sequence: 1`); `stage-world-catalog.js:75` (`sequence: 1`) `[OBSERVED]` |
| art-file key | `cinder-span` | `app.js:123` `STAGE_ART_FILE_BY_ID["cinder-span"] = "cinder-span"` `[OBSERVED]` |
| id ≠ filename? | **No.** id and art-file key are identical | `[OBSERVED]` |

**`echo-throne` flag (schema field, recorded for cross-stage comparability):** stage 3 is the
only stage whose art-file key differs from its id — `app.js:125` maps `"echo-throne"` →
`"echo-throne-steps"`, and `stage-world-catalog.js:160` uses the same
`echo-throne-steps` filename for its terrain GLB `[OBSERVED]`. Stage 1 has no such divergence,
so `stageArtPath("cinder-span")` and the world-profile terrain path both resolve from the
literal stage id.

`stageArtPath()` (`app.js:235-238`) returns
`assets/images/battle/ui/stages/${fileName}.png`, falling back to `STAGES[0].id` — i.e. to
**cinder-span itself** — for any unmapped stage `[OBSERVED]`. Stage 1 is therefore also the
art fallback target for the whole campaign.

Editorial showcase: `cinder-span` is showcase order `1` of exactly three
(`STAGE_SHOWCASE_IDS = ['cinder-span','veil-citadel','echo-throne']`, resolved from
`stage-world-catalog.js:578-584`) `[OBSERVED]`.

---

## 2. Runtime asset binding

All paths below were listed on disk during this audit (`ls assets/images/battle/...`) and
traced to the code line that requests them. Present/absent is per-file, not per-directory.

| Slot | Path | Bound by | State |
|---|---|---|---|
| Terrain GLB | `assets/images/battle/glb/terrain/cinder-span.glb` | `stage-world-catalog.js:77` `terrainGlbPath` → `battle-realtime-three.js:1623` `instantiateTerrainModel()` | **present** `[OBSERVED]` |
| Stage plate PNG | `assets/images/battle/ui/stages/cinder-span.png` | `app.js:123` + `app.js:237` `stageArtPath()`; consumed as CSS `--stage-art` at three call sites — the lobby root (`app.js:1172`), the battle surface template (`app.js:1484`), and the session re-mount (`app.js:1675`) | **present** `[OBSERVED]` |
| World plate — top-down | `assets/images/battle/world/cinder-span-topdown-plate.webp` | `battle-visualizer.js:23` `WORLD_TEXTURES.cinderSpanBackground` → drawn at `battle-visualizer.js:233` | **present** `[OBSERVED]` |
| World plate — tactical paper | `assets/images/battle/world/cinder-span-tactical-paper-plate.webp` | `battle-visualizer.js:24` `WORLD_TEXTURES.cinderSpanMap` → drawn at `battle-visualizer.js:235` | **present** `[OBSERVED]` |
| Boss GLB | `assets/images/battle/glb/bosses/cinder-warden.glb` | `defense-catalog.js:676` `boss = "s1-cinder-warden"` → `battle-realtime-three.js:128` `BOSS_MODELS` → `meshRootForStageBoss()` (`:178-181`) | **present** `[OBSERVED]` |
| Elite archetype mesh | `assets/images/battle/glb/enemies/scout.glb` | elite is `eliteKind: "rusher"` (`defense-catalog.js:676`), spawned at `defense-run-simulation.js:2460` `spawnEnemy(run, run.stage.eliteKind, true, …)`; `rusher` → `enemies/scout.glb` at `battle-realtime-three.js:145` | **present, shared** `[OBSERVED]` |
| Elite-specific mesh (`s1-ember-hunter`) | — | no entry in `BOSS_MODELS`/`ENEMY_MODELS`/`COMPANION_MODELS` | **absent by design** `[OBSERVED]` |
| Reward companion GLB | `assets/images/battle/glb/companions/ember-cohort.glb` | `defense-catalog.js:676` `eliteCompanion = "ember-cohort"` → `battle-realtime-three.js:153` `COMPANION_MODELS` → `meshRootForCompanion()` (`:171-173`) | **present** `[OBSERVED]` |

**Absences stated explicitly.** The elite `s1-ember-hunter` has **no dedicated mesh**: it is a
`rusher` flagged `elite=true`, so it draws `enemies/scout.glb`, the same mesh every ordinary
rusher uses `[OBSERVED]`. The elite's identity at runtime is carried only by the
`stageEliteId` field (`defense-run-simulation.js:666`) and the extraction events
(`:1762`, `:1822`, `:1833`), not by geometry. This is uniform across all ten stages — the
elite roster (`s1-ember-hunter` … `s10-regent-herald`) has **zero** authored meshes.

### 2.1 Additional world-profile assets bound for stage 1

Beyond the six contract slots, `stageWorldFor("cinder-span")` binds these, all on disk
`[OBSERVED]`:

| Role | Prop/actor id | Path | Source line |
|---|---|---|---|
| `gate-choke` prop | `cinder-span:seal-brand` | `assets/images/battle/glb/props/bulwark-brand.glb` | `stage-world-catalog.js:114` |
| `extraction-beacon` prop | `cinder-span:forge-lantern` | `assets/images/battle/glb/props/warden-lantern.glb` | `stage-world-catalog.js:115` |
| `lookout` NPC | `cinder-span:ember-lookout` (actor `ember-cohort`) | `assets/images/battle/glb/companions/ember-cohort.glb` | `stage-world-catalog.js:118` |

### 2.2 Runtime allowlist state

The two world plates are present in **all three** allowlist sources that must stay in sync
`[OBSERVED]`:

- `scripts/defense-runtime-assets.mjs:23-24` (`RETAINED_ASSET_PATHS`)
- `assets/defense-asset-manifest.json:1998, :2008` — both `"disposition": "retain"`,
  `"runtimeReference": true`
- `.github/workflows/static.yml:34` (`PAGES_RUNTIME_PATHS`)

No provenance sidecar exists next to either plate. `assets/images/battle/world/` contains
exactly three files: the two plates and `concept-sung-hum-boss.provenance.json`, which names a
boss concept, not a plate `[OBSERVED]`. Per `CLAUDE.md` §3 every generated image gets an
adjacent `.provenance.json`; the plates have none. Recorded in §7 as gap G-4.

---

## 3. Presentation vocabulary

Quoted verbatim from `STAGE_PRESENTATION_BY_ID["cinder-span"]`, `defense-catalog.js:693-699`
`[OBSERVED]`.

### 3.1 Palette ids

| Role | Id |
|---|---|
| `surface` | `surface-cinder-ash` |
| `contour` | `contour-ember` |
| `landmark` | `landmark-forge` |
| `hazard` | `hazard-ash` |
| `objective` | `objective-seal` |

The world profile carries a **sixth** palette key the catalog does not: `accent: "#f3592c"`
(`stage-world-catalog.js:100`) `[OBSERVED]`. The browser proof records the derived
`clearColor` as `#7b2a1a` with `fogNear 22.400000000000002` / `fogFar 50.4`, matching
`stage-world-catalog.js:101` `[OBSERVED]`.

### 3.2 Terrain pattern

| Field | Value |
|---|---|
| `patternId` | `terrain.cinder-span.ash-bands` |
| `label` | `재의 띠` |

### 3.3 Landmarks

| Id | Label |
|---|---|
| `landmark.ember-relay-spire` | `불씨 중계탑` |
| `landmark.drowned-forge-arch` | `잠긴 용광로 아치` |

Both ids also exist in the world profile with English labels and placements —
`Ember Relay Spire` at `(17600, 6000, 0)` and `Drowned Forge Arch` at `(12600, 2800, 0)`
(`stage-world-catalog.js:110-111`) `[OBSERVED]`. The Korean labels above are the display
vocabulary; the English ones are the authoring labels. Both name the same two ids.

### 3.4 Atmosphere

| Field | Value |
|---|---|
| `descriptor` | `잿빛 바람이 교량의 봉쇄선을 훑는다.` |
| `motif` | `불씨와 재의 흐름` |

World-profile English counterpart: descriptor `Ash wind combs the bridge blockade.`, motif
`embers moving through ash` (`stage-world-catalog.js:101`) `[OBSERVED]`.

### 3.5 `mapLabels` — full set (all nine keys)

| Key | Value |
|---|---|
| `title` | `잿빛 교량` |
| `domain` | `재의 봉쇄선` |
| `chokepath` | `중앙 재길` |
| `flank` | `남쪽 측면` |
| `elevation` | `잿빛 감시대` |
| `hazard` | `재 폭풍` |
| `occupation` | `재의 봉인` |
| `extraction` | `결속 지점` |
| `objective` | `재의 봉인을 지켜 결속하라.` |

`STAGE_PRESENTATION_BY_ID` is frozen and coverage-checked: `defense-catalog.js:765-771` throws
`"STAGE_PRESENTATION_BY_ID must cover every authored stage."` if the key set drifts from
`STAGES` `[OBSERVED]`.

---

## 4. Encounter composition

### 4.1 Authored wave table (legacy triples, verbatim)

From `defense-catalog.js:676`, the tenth positional argument of `stage(...)` `[OBSERVED]`:

```
[[0, "rusher", 4], [180, "flanker", 3], [390, "ranged", 2]]
```

| tick | archetype | count |
|---|---|---|
| `0` | `rusher` | `4` |
| `180` | `flanker` | `3` |
| `390` | `ranged` | `2` |

**These three triples are no longer what the simulation schedules.** `defense-catalog.js:653-658`
states the `waves` field is retained "as authored data" for the spawn-budget and catalog
contracts, while `gateTicks` and `wavePlan` now come from `STAGE_WAVE_DOCTRINE`. The
contract-mandated triples are reproduced above verbatim; §4.3 records what actually runs.

### 4.2 xpTarget / `scale`

**Naming defect, recorded rather than smoothed over.** The batch contract calls the fourth
positional argument `xpTarget`. The shipped code names that parameter `scale`
(`defense-catalog.js:659`, stored as `scale` at `:664`) and the identifier `xpTarget` does not
appear anywhere in `defense-catalog.js`, `campaign-state.js`, or `app.js` `[OBSERVED]`.

| Field | Value | Meaning in code |
|---|---|---|
| `scale` (contract's "xpTarget") | `100` | enemy-HP multiplier: `scaledHp = ENEMIES[id].hp * stageScale / 100` (`defense-catalog.js:596`) `[OBSERVED]` |

At `scale: 100` stage 1 is the **unscaled baseline** — every enemy fields its catalog HP
exactly. It is the only stage with this property; stage 2 is `115` and the ramp ends at `240`
for `gate-zenith` (`defense-catalog.js:677-685`) `[OBSERVED]`.

XP is a separate, per-enemy field (`ENEMIES[*].xp`, `BOSSES[*].xp`) and the boss
`s1-cinder-warden` awards `xp: 100` (`defense-catalog.js:362`) `[OBSERVED]`. The numeric
coincidence between `scale: 100` and boss `xp: 100` is **not** an identity; do not treat the
stage argument as an XP quantity.

### 4.3 Doctrine wave plan (what actually schedules)

`STAGE_WAVE_DOCTRINE["cinder-span"]` (`defense-catalog.js:544`) `[OBSERVED]`:

| Field | Value |
|---|---|
| `gateIntegrity` | `1600` |
| `defenseTicks` | `10200` (= `gateTicks`; `170 s` at `TICK_RATE 60`) |
| `waveCount` | `10` |
| `classes` | `["rusher", "flanker", "ranged"]` |
| `kindCycle` | `["normal", "normal", "big", "mid"]` |
| `pressureLane` | `chokepath` |
| `midbossEnemy` | `guardian` |
| `legacyGateTicks` | `900` (superseded, retained) |

Resolved plan — derived by importing `STAGE_BY_ID["cinder-span"].wavePlan` read-only during
this audit; cadence `floor(10200 / 10) = 1020` `[OBSERVED]`:

| slot | tick | kind | label | direction | policyId | primary | mid-boss |
|---|---|---|---|---|---|---|---|
| 0 | 0 | normal | 웨이브 | W | — | `rusher` × 7 | — |
| 1 | 1020 | normal | 웨이브 | SW | — | `flanker` × 6 | — |
| 2 | 2040 | big | 빅 웨이브 | W | `gate-pressure` | `ranged` × 8 | — |
| 3 | 3060 | mid | 미들 웨이브 | SW | `elite-escort` | `rusher` × 4 | `guardian`, hp `22950` |
| 4 | 4080 | normal | 웨이브 | W | — | `flanker` × 7 | — |
| 5 | 5100 | normal | 웨이브 | SW | — | `ranged` × 9 | — |
| 6 | 6120 | big | 빅 웨이브 | W | `gate-pressure` | `rusher` × 9 | — |
| 7 | 7140 | mid | 미들 웨이브 | SW | `elite-escort` | `flanker` × 4 | `guardian`, hp `22950` |
| 8 | 8160 | normal | 웨이브 | SW→W* | — | `ranged` × 10 | — |
| 9 | 9180 | big | 빅 웨이브 | SW | `gate-pressure` | `rusher` × 10 | — |

\* direction cycles `directions[slot % 2]` over `spawnDirections: ["W","SW"]`
(`defense-catalog.js:391`, `:631`); slot 8 is `W` `[OBSERVED]`. Slot 9 is forced to `big`
regardless of `kindCycle` by `defense-catalog.js:583-585`.

Each slot also publishes two authored alternatives (`-primary` / `-remix`,
`defense-catalog.js:634-637`); the seeded selection of one per slot is what
`tests/cinder-span-vertical-slice.test.mjs:91` pins.

### 4.4 Boss and elite

| Field | Value | Source |
|---|---|---|
| boss id | `s1-cinder-warden` | `defense-catalog.js:676` `[OBSERVED]` |
| boss stats | hp `40000`, speed `1800`, damage `200`, attackTicks `90`, xp `100`, radius `900`, policy `player-pursuit` | `defense-catalog.js:362` `[OBSERVED]` |
| elite id | `s1-ember-hunter` | `defense-catalog.js:676` `[OBSERVED]` |
| elite archetype | `rusher` | `defense-catalog.js:676` (`eliteKind`) `[OBSERVED]` |
| reward companion | `ember-cohort` (`Ember Cohort`, damage `420`, fireTicks `36`, range `4600`) | `defense-catalog.js:676`, `:341` `[OBSERVED]` |
| stage item | `ashen-sigil` | `defense-catalog.js:773` `[OBSERVED]` |
| stage rewards | `["ember-cohort-legacy", "stillwater-hourglass", "bulwark-brand"]` | `defense-catalog.js:785` `[OBSERVED]` |

`s1-cinder-warden` is the **lowest-HP boss in the campaign** (`40000`, versus `150000` for
`s10-abyss-regent`) `[OBSERVED]`.

### 4.5 Cutscene lines (verbatim)

From `CUTSCENES["cinder-span"]`, `defense-catalog.js:232-238` `[OBSERVED]`:

| Key | Line |
|---|---|
| `intro[0]` | `심연의 문이 열렸다.` |
| `intro[1]` | `잿빛 교량에서 재의 메아리를 묶어라.` |
| `bossEntry` | `잿빛 파수꾼이 용광로의 사슬을 끌며 둑길을 차단한다.` |
| `elite` | `열기가 없는 불씨가 영혼 웅덩이를 남긴다.` |
| `victory` | `다리 끝의 재가 다음 봉쇄선을 가리킨다.` |
| `defeat` | `첫 번째 봉쇄선이 끊어졌다. Dusk Warden, 관문으로 복귀하라.` |

Consumption `[OBSERVED]`: `intro` at `defense-run-simulation.js:2869`, `elite` at `:1838`,
`defeat` at `:2567`, `victory` at `:2587`; `intro[0]` also feeds the lobby showcase teaser at
`app.js:1089` (`cutsceneTeaser`). **`bossEntry` has zero consumers.** A repository-wide search
returns only the authoring line `defense-catalog.js:234` and a design-doc reference at
`_workspace/current/design/lobby-story-presentation-spec.md:18` — no runtime or test code
reads it. See §6.4 and gap G-1.

### 4.6 Tactics anchors

`STAGE_TACTICS["cinder-span"]` (`defense-catalog.js:384-402`) `[OBSERVED]`:

| Anchor | Value |
|---|---|
| `chokepath` | `cinder-center`, x `18000`, halfWidth `2200` |
| `flank` | `cinder-south`, entry `(12000, 9800)` |
| `elevation` | `cinder-overlook`, `(16600, 2600)`, rangeMultiplier `1.08` |
| `hazard` | `ash-surge`, `(14800, 6000)`, radius `1100`, dps `8` |
| `occupation` | `cinder-seal`, `(17600, 6000)`, radius `900`, holdTicks `180` |
| `extraction` | `cinder-bind`, `(15400, 6000)`, radius `1000`, windowTicks `600` |
| `spawnDirections` | `["W", "SW"]` |
| `seededVariation` | timingJitter `12`, densityDelta `1`, laneJitter `300` |
| `mapVariant` | `v1`, modules `["ember-relay-spire","drowned-forge-arch"]`, protectedCorridor declared |
| `surpriseTable` | `CINDER_SPAN_SURPRISE_TABLE` |

Arena frame shared by all stages: `ARENA = { width: 24000, height: 12000, gateX: 22000,
gateY: 6000 }` (`defense-catalog.js:12`); `GATE = { maxIntegrity: 1000, radius: 900 }`
(`:174`); `COMBAT_TARGETING` is `none-target` with melee reach `900` / arcCosBp `0` /
maxTargets `5`, ranged projectileSpeed `1400` / radius `220` / maxTicks `12`, and
`elevationTolerance 700` (`:39-59`) `[OBSERVED]`. None of these are per-stage; they are the
constant frame every stage composition sits inside.

Stage-1 gameplay bounds are **narrower than `ARENA`**: `bounds(600, 23400, 800, 11200)`
(`stage-world-catalog.js:79`) `[OBSERVED]`.

---

## 5. Composition gaps

What is missing for stage 1 itself. (What the *other* stages are missing relative to stage 1
is §6; this list is stage 1's own debt.)

1. **`bossEntry` is authored but never played.** The line exists at
   `defense-catalog.js:234` and is the only one in the campaign, but no code path reads it
   (§4.5). Either wire a `BOSS_SPAWNED`-adjacent cutscene emission in
   `defense-run-simulation.js` alongside the existing four, or delete the field. Leaving it is
   a false signal that stage 1's boss entry is presented.
2. **Neither world plate has a provenance sidecar.** `CLAUDE.md` §3 requires an adjacent
   `.provenance.json` for every generated image. `assets/images/battle/world/` has none for
   either `.webp` (§2.2). The plates are already promoted to runtime-retained in all three
   allowlists, so the audit that promotion required cannot be reconstructed from the tree.
3. **`legacyGateTicks: 900` and the three legacy wave triples are dead data with live
   readers.** `defense-catalog.js:653-658` says the spawn-budget and catalog contracts still
   read `waves`, and `tests/stage2-balance-retune.test.mjs:19` pins `legacyGateTicks === 900`.
   The 3-triple table (§4.1) and the 10-slot plan (§4.3) disagree about what stage 1 is by a
   factor of 11.3× in hold length (`900` → `10200`). Any consumer that reads `waves` is
   reading a ~15 s stage.
4. **The elite has no visual identity.** `s1-ember-hunter` renders as `enemies/scout.glb`,
   identical to the rushers around it (§2). The extraction beat — the stage's authored reward
   hook, per `stage-world-catalog.js:121` — has no mesh, silhouette, or material distinguishing
   its target. This is campaign-wide, but it lands hardest on stage 1, which is where the
   player learns extraction exists.
5. **`cinematic.intro` is authored for stage 1 only and is not covered by any test.**
   `stage-world-catalog.js:102-108` authors a 90-tick intro camera move
   (`from {distance 6, azimuth −0.24, polar −0.34}` → `to {0,0,0}`). No test in `tests/`
   asserts it plays, and the browser proof records `renderedFrames` but no camera track (§7).
6. **The elevation conflict is stage 1's data, and the spec's stated mitigation for it is
   false.** `pcg-stage-layout-spec.md` §1.1 correctly `[OBSERVED]`-flags
   `cinder-span:overlook-ramp` (x-axis `0 → 420`) and `cinder-span:overlook-platform`
   (flat `420`, `stage-world-catalog.js:85-86`) as the concrete collision with the
   single-plane rule. But it then records a **"완화 요인 `[OBSERVED]`"** asserting the values
   are presentation-only and *"시뮬레이션이 소비하지 않는다"* (the simulation does not consume
   them). **That is contradicted by the shipped simulation.** `terrainSupportAt()`
   (`defense-run-simulation.js:79-98`) reads `surface.elevation.axis / atMin / atMax` and
   interpolates a real elevation, which then feeds `[OBSERVED]`:

   | Consumer | Line | Effect |
   |---|---|---|
   | `climbableFrom()` | `:211-212` | compares rise against `COLLISION.stepHeight`; gates movement |
   | `moveOnTerrain()` | `:287-293` | on a failed climb, deflects to a slide axis or cancels the move |
   | `placeOnTerrain()` | `:147, :156` | sets `entity.elevation` for gate, commander, companions, boss, spawns, pushes, pickups |
   | projectile step | `:1375-1376` | projectile elevation = terrain support + `projectileRadius` |

   So the elevation is live simulation input, not decoration. What is *actually* true — and
   this is the load-bearing correction — is that **stage 1's numbers sit under every threshold
   that would make it bite** `[OBSERVED]`:

   | Quantity | Value | Threshold | Result |
   |---|---|---|---|
   | ramp rise | `420` | `COLLISION.stepHeight = 600` | climbable — never blocks |
   | platform elevation | `420` | `COMBAT_TARGETING.elevationTolerance = 700` | hits still connect across it |
   | ramp gradient | `420 / 1600 = 0.2625` per unit | `600` per tick | would need `2286` units of x in one tick to exceed |

   Stage 1 is therefore safe **by numeric coincidence, not by architecture.** A PCG module
   that authors a rise `> 600` creates a genuine movement wall through the same code path,
   which is precisely the failure `pcg-stage-layout-spec.md` §6 assertion 7 ("보행 경사 0건")
   is meant to prevent — but that spec is currently relying on a mitigation that does not hold.

   Compounding it for stage 1 specifically: `meshSupportAt()` takes **precedence** over the
   surface loop (`defense-run-simulation.js:80-81` returns early on a mesh hit), and stage 1 is
   the only stage with a `meshColliders` block (`stage-world-catalog.js:88-97`), whose triangles
   encode the same `420` rise over `(15000-17900, 1900-3400)`. For stage 1 the **mesh collider
   is the primary elevation source and the surfaces are the fallback.** Renaming the surface
   types to `decor-ramp`/`decor-platform` per that spec's decision table would therefore change
   nothing about stage 1's actual elevation resolution. Both layers must be reconciled, and
   §1.1's mitigation paragraph needs correcting before its decision table is acted on. This
   audit does not resolve the conflict; it records that the premise under it is wrong.
7. **No stage-1 shrine / recovery anchor exists in the catalog.** `encounter-wave-spec.md`
   §1.1 and §1.2 make `shrine` the failure-recovery affordance at commander ≤30% / ≤40%
   `[TARGET]`, and `pcg-stage-layout-spec.md` §2.3 places it as an anchor inside `transit`
   cells. `STAGE_TACTICS["cinder-span"]` has no shrine anchor and no `transit` cell concept
   (§4.6) `[OBSERVED]`. The gap is between the target specs and the shipped catalog, not
   inside the catalog.

---

## 6. What makes stage 1 the reference

Every item below was established by reading the source, and every one is stated as an
asymmetry with the count of stages that share it.

### 6.1 World plates — the headline (1 of 10)

`battle-visualizer.js:22-25` declares exactly two world textures, both `cinder-span`:

```js
const WORLD_TEXTURES = Object.freeze({
  cinderSpanBackground: "./assets/images/battle/world/cinder-span-topdown-plate.webp",
  cinderSpanMap: "./assets/images/battle/world/cinder-span-tactical-paper-plate.webp",
});
```

They are drawn by `drawCinderSpanArtwork()` (`:231-236`), whose **first statement is a
hard stage-id gate**: `if (projection?.stageId !== "cinder-span") return;` `[OBSERVED]`. The
background is drawn at 3× extent with `alpha 0.2`; the tactical plate is inset by
`min(w,h) * 0.07` with `alpha 0.12`.

Consequences, exactly:

- `assets/images/battle/world/` contains **two** `.webp` files, both stage 1 `[OBSERVED]`.
  Stages 2-10 have zero world plates.
- The feature is **Canvas2D-fallback only**. `WORLD_TEXTURES` lives in
  `battle-visualizer.js`, the Canvas fallback renderer; the WebGL path
  (`battle-realtime-three.js`) never references it. A player on the WebGL path sees no world
  plate on any stage, including stage 1 `[OBSERVED]`.
- The function name itself is stage-bound (`drawCinderSpanArtwork`), so extending this to
  stage 2 is a rename + data-table refactor, not a content drop.

### 6.2 `meshColliders` — 1 of 10, and enforced

`cinder-span` is the only profile with a `gameplay.meshColliders` array
(`stage-world-catalog.js:88-97`): one collider, `cinder-span:walkable-support`, with 6
triangles `[OBSERVED]`. The other nine profiles carry `obstacles` + `surfaces` only.

This is not incidental — the catalog **validator hard-codes it**
(`stage-world-catalog.js:512-514`):

```js
if (profile.stageId === "cinder-span" && meshColliders.length === 0) {
  throw new Error("Cinder Span requires an authored walkable support mesh.");
}
```

Stage 1 is the only stage whose walkable support is a load-bearing, module-throwing
requirement.

**It is load-bearing at runtime too, not only at validation.** `meshSupportAt()` is consulted
*before* the surface loop inside `terrainSupportAt()` — `defense-run-simulation.js:80-81`
returns early on a mesh hit `[OBSERVED]`. Stage 1 is therefore the only stage whose elevation
resolves from a mesh collider first, with `gameplay.surfaces` as fallback; the other nine
resolve from surfaces alone. Gap G-6 explains why that ordering changes the fix.

### 6.3 `cinematic.intro` — 1 of 10

`presentation.cinematic` appears once, at `stage-world-catalog.js:102-108` `[OBSERVED]`:
`durationTicks 90`, `from { distance: 6, azimuth: -0.24, polar: -0.34 }`,
`to { distance: 0, azimuth: 0, polar: 0 }`. No other profile has a `cinematic` key. Stage 1 is
the only stage with an authored camera move on entry.

### 6.4 `bossEntry` cutscene line — 1 of 10

Of the ten stage entries in `CUTSCENES` plus `default`, **only `cinder-span` has a
`bossEntry` key** (`defense-catalog.js:234`) `[OBSERVED]`. Every other stage carries exactly
`intro` / `elite` / `victory` / `defeat`. The `default` fallback
(`defense-catalog.js`, resolved via `CUTSCENES.default`) also lacks it, so there is no
inherited fallback line either.

As recorded in §4.5, the field currently has no reader. Stage 1 therefore holds the campaign's
only authored boss-entry beat *and* the campaign's only unconsumed cutscene field — the same
line is simultaneously the fidelity high-water mark and gap G-1.

### 6.5 `surpriseTable` — 1 of 10

`CINDER_SPAN_SURPRISE_TABLE` (`defense-catalog.js:374-381`) is the only surprise table in the
catalog, and `surpriseTable` appears in exactly one `STAGE_TACTICS` entry, `cinder-span`
(`:401`) `[OBSERVED]`. Contents: `chanceBp 2500`, two outcomes —
`ash-echo-whisper` (`옛 교량의 재가 바람에 흩어지며 희미한 메아리를 남긴다.`) and
`forge-ember-flicker` (`잠긴 용광로 잔해에서 작은 불씨 하나가 튀어오른다.`).

It is live: `defense-run-simulation.js:2872` emits `LORE_SURPRISE_RESOLVED` and exposes
`state.loreSurprise`. Stage 1 is the only stage that can produce that event.

### 6.6 `mapVariant` — 1 of 10

`STAGE_TACTICS["cinder-span"].mapVariant` (`defense-catalog.js:392-400`) is the only
`mapVariant` in the catalog `[OBSERVED]`: `version "v1"`, `modules
["ember-relay-spire","drowned-forge-arch"]`, and a `protectedCorridor` asserting
`declared / preservesObjectives / preservesRoutes` all `true`. Stage 1 is the only stage with a
declared protected corridor — the invariant the PCG work in `pcg-stage-layout-spec.md` needs
in order to guarantee it has not broken a route.

### 6.7 `scale: 100` — the unscaled baseline, 1 of 10

Stage 1 is the only stage where `scaledHp(enemy) === ENEMIES[enemy].hp`
(`defense-catalog.js:596`, `scale: 100` at `:676`) `[OBSERVED]`. Every balance number read off
stage 1 is a raw catalog number; every other stage's is scaled (`115` … `240`). Stage 1 is
therefore the only stage where a measured TTK can be compared directly against authored HP
without dividing out a stage multiplier.

### 6.8 Art-path fallback target — 1 of 10

`stageArtPath()` (`app.js:236`) falls back to `STAGE_ART_FILE_BY_ID[STAGES[0].id]` for any
unmapped stage id — `STAGES[0]` is `cinder-span` `[OBSERVED]`. A stage added without an art
mapping silently renders stage 1's plate.

### 6.9 Test coverage — measured, and the skew is 15:1

Counted across all 64 files in `tests/` by scanning each for the ten canonical stage ids
`[OBSERVED]`:

| Stage | Test files naming it |
|---|---|
| `cinder-span` | **31** |
| `gate-zenith` | 13 |
| `veil-citadel` | 12 |
| `echo-throne` | 11 |
| `sunken-bastion` | 8 |
| `howling-sprawl` | 8 |
| `starless-canal` | 7 |
| `glass-necropolis` | 6 |
| `shattered-causeway` | 6 |
| `abyss-chancel` | 5 |

The sharper number is **sole-stage** coverage — files that mention exactly one stage id, i.e.
tests written against a specific stage rather than iterating the roster:

| | Count |
|---|---|
| Files whose only stage is `cinder-span` | **15** |
| Files whose only stage is any other stage | **1** (`tests/defense-public-contract-browser.cjs` → `echo-throne`) |

`tests/cinder-span-vertical-slice.test.mjs` is also the only test file in the repository
*named* after a stage `[OBSERVED]`.

The 15 sole-stage-1 files: `battle-session-cutscene-audio.test.mjs` (16 refs),
`defense-observers-contract.test.mjs` (10), `g2-measurement-fixture.test.mjs` (8),
`stage1b-gate-evaluator.test.mjs` (5), `companion-autonomy.test.mjs` (5),
`defense-stage-world-movement.test.mjs` (5), `stage2-balance-retune.test.mjs` (4),
`defense-cutscene.test.mjs` (3), `defense-survivor-browser.cjs` (3),
`stage-terrain-environment-contract.test.mjs` (2),
`defense-phone-battle-hud-browser.test.cjs` (2), `defense-asset-manifest.test.mjs` (2),
`stage1b-g3-g7-verification.test.mjs` (1), `cinder-span-vertical-slice.test.mjs` (1),
`none-target-combat.test.mjs` (1).

Worth singling out from that list: `stage2-balance-retune.test.mjs` — the file named for
stage **2** — references only `cinder-span` `[OBSERVED]`. Its four references are all to
`STAGE_BY_ID["cinder-span"]` (`:8`, `:49-54`, `:57`).

Stage 1 additionally supplies the fixture stage for the nominally stage-agnostic suites
(`tests/stage-wave-doctrine.test.mjs:102, :111, :138, :156, :188, :228, :267, :278, :301`;
`tests/world-presentation-contract.test.mjs:216, :285, :357, :433`;
`tests/stage-terrain-environment-contract.test.mjs:623, :652`), so a stage-1 regression breaks
those suites too.

**Consequence for the other nine stages:** their coverage is almost entirely *incidental* —
they are exercised by roster-iterating contracts (`stage-wave-doctrine`,
`world-presentation-contract`, `stage-runtime-proof-browser`), never by a test written for
them. A stage-2-specific composition defect that the roster loops do not model has, by this
count, one place to be caught and it is not a stage-2 test.

### 6.10 Editorial showcase slot 1 — 1 of 3

`editorial(true, 1, "Cinder Span", "Hold the ash bridge and learn the first binding route.",
"A recoverable Echo answers a successful extraction.")` (`stage-world-catalog.js:121`)
`[OBSERVED]`. Three stages are showcases; stage 1 is order 1. The catalog throws if the
showcase count is not exactly three (`stage-world-catalog.js:584`).

### 6.11 Summary — the asymmetry ledger

| Feature | Stage 1 | Stages 2-10 | Source |
|---|---|---|---|
| World plates (`.webp`) | 2 | 0 | `battle-visualizer.js:22-25` |
| `meshColliders` | 1 (validator-enforced) | 0 | `stage-world-catalog.js:88, :512` |
| `cinematic.intro` | present | absent | `stage-world-catalog.js:102` |
| `bossEntry` cutscene line | present (unconsumed) | absent | `defense-catalog.js:234` |
| `surpriseTable` | present | absent | `defense-catalog.js:401` |
| `mapVariant` + protectedCorridor | present | absent | `defense-catalog.js:392` |
| `scale` | `100` (unscaled) | `115`–`240` | `defense-catalog.js:676-685` |
| Art-path fallback target | yes | no | `app.js:236` |
| Sole-stage test files | **15** | **1** (all nine combined) | §6.9 count over `tests/` |
| Test files naming the stage | **31** | `5`–`13` each | §6.9 count over `tests/` |
| Test file named after the stage | yes | no | `tests/cinder-span-vertical-slice.test.mjs` |
| Terrain GLB | present | present (all 10) | `stage-world-catalog.js` |
| Stage plate PNG | present | present (all 10) | `app.js:122-133` |
| Boss GLB | present | present (all 10) | `battle-realtime-three.js:127-138` |
| Elite-specific mesh | absent | absent (all 10) | `battle-realtime-three.js:144-149` |

**Reading of the ledger:** stage 1's lead is not in the four bulk asset classes — terrain,
plate, boss, companion are complete for all ten stages `[OBSERVED]`. The lead is entirely in
**per-stage authored specials** (6 features, all 1-of-10) and **verification depth** (§7).
Bringing stage 2 to stage-1 fidelity is authoring and test work, not an asset-generation
backlog.

---

## 7. Stage 1 readiness ledger

Pass/fail below is established by **reading** the assertion and, where it exists, the durable
artifact it produced. No suite was run by this audit — `CLAUDE.md` §6 reserves
`node --test 'tests/**/*.test.mjs'` for the parent session.

| Test file | What it asserts for stage 1 | State |
|---|---|---|
| `tests/cinder-span-vertical-slice.test.mjs:91` | Every wave slot selects exactly one authored alternative; seed 17 replays identically; seeds 17 vs 18 differ without leaving the authored catalog | `[INFERENCE]` unverified — requires parent regression run. Settled by `node --test tests/cinder-span-vertical-slice.test.mjs` |
| `tests/cinder-span-vertical-slice.test.mjs:107` | A critical within seeds 1-16 replays; `entityId === "commander"`; `chanceBp === 1500`, `multiplierBp === 20000` matching `COMMANDER.critProfile`; `damage === trunc(base × mult / 10000)` | `[INFERENCE]` unverified — same command |
| `tests/cinder-span-vertical-slice.test.mjs:136` | Seed 23 lore surprise replays; `tableId === "cinder-span-surprise"`; `rollBp ∈ [0,10000)`; and it damages nothing — commander/gate integrity untouched, `enemies`/`projectiles` empty, `rewardOffer` null, `waveVariant` unchanged | `[INFERENCE]` unverified — same command |
| `tests/stage-wave-doctrine.test.mjs:35-47` | `gateTicks === doctrine.defenseTicks`; hold ∈ `[160, 250] s` (stage 1 = `170 s`, inside); last wave is `big`; last wave tick `< gateTicks` (`9180 < 10200`) | Arithmetic verified by reading catalog values `[OBSERVED]`; assertion execution `[INFERENCE]` unverified — `node --test tests/stage-wave-doctrine.test.mjs` |
| `tests/stage-wave-doctrine.test.mjs:101` | Stage 1 mid-boss is non-elite, budget-sized, and holds the gate-defense objective open | `[INFERENCE]` unverified — same command |
| `tests/stage-wave-doctrine.test.mjs:287` | `cinder-span` plays 3-6 min under an objective-seeking bot | `[INFERENCE]` unverified — same command. This is the direct check on the §4.3 doctrine and the highest-value single run |
| `tests/stage2-balance-retune.test.mjs:8-77` | `gateTicks === STAGE_WAVE_DOCTRINE.defenseTicks`; `legacyGateTicks === 900`; `wavePlan.length === waveCount`; elite ids and the `cinder-seal` / `cinder-bind` coordinates pinned | `[INFERENCE]` unverified — `node --test tests/stage2-balance-retune.test.mjs` |
| `tests/world-presentation-contract.test.mjs:232` | All 10 stages expose one frozen presentation profile; key sets match `STAGES` | `[INFERENCE]` unverified — `node --test tests/world-presentation-contract.test.mjs` |
| `tests/world-presentation-contract.test.mjs:349` | Stage-1 **world-plate artwork is passive**: with `Image` stubbed both unavailable and available, the projection, canonical snapshot, and `getRunDigest()` are all byte-identical | `[INFERENCE]` unverified — same command. This is the only test that touches §6.1 |
| `tests/world-presentation-contract.test.mjs:392` | `applyStagePalette` lands stage-1 fog on `stageFogRange()` — near `22.4`, far `50.4` | `[INFERENCE]` unverified — same command. Values corroborated by the browser proof artifact below `[OBSERVED]` |
| `tests/stage-terrain-environment-contract.test.mjs:552` | All ten terrains are distinct authored environments (hash-compared, no duplicate proxies) | `[INFERENCE]` unverified — `node --test tests/stage-terrain-environment-contract.test.mjs` |
| `tests/stage-terrain-environment-contract.test.mjs:611` | Stage-1 terrain provenance resolves through `scripts/audit-stage-scenes.mjs` without displacing auxiliary mesh provenance | `[INFERENCE]` unverified — same command |
| `tests/stage-terrain-environment-contract.test.mjs:651` | The architecture-count gate rejects a copied low-detail proxy mutation of `cinder-span.glb` | `[INFERENCE]` unverified — same command |
| `tests/stage-runtime-proof-browser.test.mjs:345` | All ten stages load their authored world in isolated real-WebGL Playwright sessions; stage 1 must match backplate `cinder-span.png`, tint `0xf3592c`, terrain `cinder-span.glb`, its 2 props and 1 NPC | **`[OBSERVED]` PASS from durable artifact** — see below. Re-running requires Playwright/Chromium |

### 7.1 The one `[OBSERVED]` runtime pass

Two durable summaries of the same browser proof were read during this audit. **The second was
deleted by the concurrent workspace-normalization pass while this document was being written**
— re-checked at the end of the audit: the archive copy is present, the dated-root copy is gone
`[OBSERVED]`. Both rows are kept because the deleted copy is what establishes §7.2, but only
the archive row is a citable, durable artifact going forward.

| Artifact | `generatedAt` | overall `pass` | cinder `pass` | `renderedFrames` | `consoleErrors` | now |
|---|---|---|---|---|---|---|
| `_workspace/archive/20260726-stage1b-cinder-pressure-agency/qa/stage-runtime-proof/stage-runtime-summary.json` | `2026-07-27T20:37:19.464Z` | `true` | `true` | `74` | `0` | **present — cite this one** |
| `_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage-runtime-proof/stage-runtime-summary.json` | `2026-07-28T14:30:40.212Z` | `true` | `true` | `69` | `0` | removed mid-audit by the normalization pass |

Both record, for `cinder-span`, `expected` === `observed` on backplate CSS custom property
(`url("assets/images/battle/ui/stages/cinder-span.png")`), `terrainLoaded: true` with
`terrainGlbPath: assets/images/battle/glb/terrain/cinder-span.glb`, palette
`clearColor #7b2a1a` / `fogNear 22.400000000000002` / `fogFar 50.4`, prop records
`cinder-span:forge-lantern` → `warden-lantern.glb` and `cinder-span:seal-brand` →
`bulwark-brand.glb`, and npc record `cinder-span:ember-lookout` → `ember-cohort.glb`;
`pageErrors: []` `[OBSERVED]`.

Every runtime asset response logged for the stage-1 session is HTTP `200`, including
`bosses/cinder-warden.glb`, `commander/dusk-warden.glb`, `companions/ember-cohort.glb`,
`enemies/scout.glb`, and `terrain/cinder-span.glb` `[OBSERVED]`.

**This is the strongest stage-1 evidence in the tree and it is the only `[OBSERVED]` PASS in
the ledger.** Note what it does *not* cover: the world plates (§6.1) are Canvas2D-only and the
proof runs the WebGL path, so `cinder-span-topdown-plate.webp` and
`cinder-span-tactical-paper-plate.webp` are absent from its `runtimeAssetResponses` list
`[OBSERVED]`. The `cinematic.intro` camera move (§6.3) is likewise unverified by it.

### 7.2 Defect found while establishing the ledger

`tests/stage-runtime-proof-browser.test.mjs:26` hardcodes

```js
const OUTPUT_DIR = path.join(ROOT, "_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage-runtime-proof");
```

— a **dated top-level `_workspace/` root**, which `CLAUDE.md` §1 forbids (only `current/` and
`archive/` may exist). The two summaries in §7.1 were the same proof written to both the
archived and the dated-root location, and the dated-root one was the newer of the two
`[OBSERVED]` — i.e. running this test regenerates the violating directory. The normalization
pass has since deleted that directory, but **the constant at `:26` is unchanged**, so the next
execution of this test recreates it. Deleting the output without repointing the constant fixes
the symptom for exactly one run. The constant is runtime-adjacent source and out of this
audit's write scope; it is raised here and carried in the workspace-normalization record.

### 7.3 Carried evidence that no longer matches shipped constants

`_workspace/archive/20260726-stage1b-cinder-pressure-agency/qa/gate-measurements.md` (run-id
`20260726-stage2-balance-agency`) records G2 measurements against `Cinder gateTicks=900` and
waves `rusher:7 / flanker:5 / ranged:4` `[OBSERVED]`. The shipped catalog is now
`gateTicks = 10200` with the ten-slot plan in §4.3, and `900` survives only as
`legacyGateTicks`. Those G2 numbers — the `91.4–96.8%` gate-margin band, the `6.43–7.17 s`
boss-TTK band, the `250/250` archetype clears — are **measurements of a superseded stage
definition** and must not be carried forward as current stage-1 evidence. The
`_workspace/current/production/task-manifest.md` position that G2 needs re-measurement is
consistent with this; this audit adds the specific reason: the stage under test changed by
`11.3×` in hold length.

### 7.4 Ledger summary

| Category | Count |
|---|---|
| Checks asserting stage-1 behaviour, by reading | 14 |
| `[OBSERVED]` PASS from a durable artifact | 1 (§7.1) |
| `[INFERENCE]` unverified — requires parent regression run | 13 |
| Stage-1 features with **no** covering check | 3 — world plates as *rendered* output (§6.1; only passivity is tested), `cinematic.intro` (§6.3), `bossEntry` (§6.4, no consumer to test) |

Single command that settles the 13 unverified rows plus everything else:
`node --test 'tests/**/*.test.mjs'` (quoted glob, per `CLAUDE.md` §6). The browser row is
already settled by §7.1 and re-running it additionally requires Playwright/Chromium.

---

## 8. Cross-references

- `_workspace/current/design/pcg-stage-layout-spec.md` §1.1 — owns the stage-1 elevation
  conflict (gap G-6). **Needs a correction:** its "완화 요인" paragraph asserts the simulation
  does not consume `surface.elevation`; `defense-run-simulation.js:79-98` does consume it, and
  feeds movement gating, placement, and projectiles. This audit supplies the measured
  thresholds that show stage 1 is nonetheless unblocked, plus the `meshColliders` precedence
  half of the conflict. Corroborated independently by the stages-2-10 lane.
- `_workspace/current/design/encounter-wave-spec.md` §1, §3 — owns the `[TARGET]` phase
  beatsheet and density curve. The §4.3 plan here is the shipped `[OBSERVED]` schedule; the two
  are different objects and must not be conflated.
- `_workspace/current/design/lobby-story-presentation-spec.md` §18 — states `bossEntry` is
  consumed by the cutscene layer. This audit finds no consumer (§4.5); that line needs
  correcting or the feature needs wiring.
- `_workspace/current/design/master-numeric-contract.md` — numeric authority for both specs
  above.
- Sibling: `stage-composition-map-stages-2-10.md` — the remaining nine stages, same schema,
  measured against §6 and §7 of this document.
