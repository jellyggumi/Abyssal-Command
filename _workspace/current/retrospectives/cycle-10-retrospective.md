# Cycle 10 retrospective — 스테이지 던전 구성

run-id: `20260728-onslaught-action-pivot`
cycle: 10
branch: `feat/cycle10-stage-dungeon`, worktree `/Users/jangyoung/orca/Abyssal-Surge-dungeon`
base: `033877ad`
operating mode: Stage 1 re-entry — content/asset build for three stage dungeons

---

## 1. What shipped, with evidence

### 1.1 Composed dungeon floors — DELIVERED and PROVEN [OBSERVED]

The battle floor was a single procedural quad on every stage. It is now a composed
slab floor on all three.

Pipeline, both halves new this cycle and both in
`_workspace/current/engineering/asset-pipeline/terrain-dungeon/`:

1. `deproject-terrain-plate.py` — the three concept plates are 1536×1024 three-quarter
   renders of a slab on white. Segment the silhouette, take the top-face corners (`N`
   from the topmost row, `W`/`E` from the **topmost pixel** of the extreme columns
   because the silhouette also contains the side faces, `S` by parallelogram closure),
   solve the homography onto a rectangle, downscale, then converge the wrap edges.
2. `build-dungeon-floor-blender.py` — authors each slab **in renderer world
   coordinates**, derives UVs from one global lattice, and adds a non-walkable apron.

| Measurement | Value |
|---|---|
| Wrap seam error, all three tiles, after blend | **0.0000 / 0.0000** (from 0.0664/0.0512/0.1085) |
| `fitFootprint` scale, all three stages | **1.000000** |
| Walkable world bounds vs `worldPointInto(bounds)` | **equal to 3 decimals on both axes** |
| Vertical extent, walkable slabs | **0** (apron alone at −0.002) |
| GLB load time through `vendor/loaders/GLTFLoader.js` | 30–40 ms |
| Slab counts | cinder 3, chancel 4, throne 5 |

Promoted with `promote-dungeon-floor.py` into `assets/mesh/terrain/**/runtime/**` with a
provenance sidecar each, and registered in all four asset allowlists. Catalog validator
loads clean with `terrainRuntimeEligible: true` and `terrainFallback` deleted on all
three profiles.

Browser proof: `_workspace/current/qa/cycle10-terrain-proof/` — three PNGs plus
`terrain-proof.json`. WebGL 2.0, 1440×900, console errors 0, page errors 0,
horizontal overflow 0.

### 1.2 Two engineering findings that changed the design

**The apron.** `fitFootprint` applies a **uniform** scale from `max(sizeX, sizeZ)`, while
actors are placed **per axis** by `worldPointInto` — and because both axes normalise by
their own dimension, the 2:1 gameplay arena renders as a 28×28 world square. A floor
authored at 2:1 would have been scaled by one factor for both axes and landed nowhere
near the actors. Authoring in world coordinates and padding the larger axis to exactly
32.2 makes the fit an identity. `DungeonLevelDesign` found this; it is the difference
between a floor that aligns and a floor that looks approximately right.

**JPEG destroys the seam.** The first export embedded PNG at 5,708,716 bytes, so JPEG q88
looked like an obvious 9.8× win. Measured, it raised the wrap seam error from 0.0000 to
**1.3792** — DCT blocks on opposite edges quantise independently, and at `uvRepeat` 3–4
per axis that discontinuity draws a regular grid across the floor. The proposed
wrap-aware resize did **not** fix it either (0.4557 vs 0.4049 naive at 256). What works
is resize-then-blend, which converges the edges by construction: 512 PNG, 509 KB, seam
exactly 0.

### 1.3 Test contract inverted, not weakened

Three test files hard-asserted the ineligible state. Per the cycle-2 rule that
invalidation tests are replaced only once substitute fixtures exist, each assertion was
**inverted to the promoted contract** rather than deleted: `terrainRuntimeEligible ===
true`, path matching `/\/runtime\/.*-floor\.glb$/`, `terrainFallback === undefined`,
candidate retained. **22/22 pass.**

One coverage defect was found and fixed in the process. `stage-terrain-environment-contract.test.mjs`
resolved its integrity subject with `profile.terrainGlbPath ?? profile.terrainSourceCandidatePath`.
That was a fallback while the path was null, so it always inspected the diorama; once the
floor became real the same expression silently retargeted onto it, leaving the retained
diorama and both textured candidates **unchecked anywhere in the suite** while the test
stayed green. The loop now iterates both subjects explicitly and asserts 6 distinct
hashes.

### 1.4 Design specifications — DELIVERED

Six specs, 6,800+ lines total, all in `_workspace/current/`:

| Spec | Lines | Owns |
|---|---|---|
| `design/stage-dungeon-composition-spec.md` | 1197 | 12 slabs, routes, 13 gimmicks, emitter→light inventory |
| `design/stage-pacing-5to15min-spec.md` | 996 | 8-block budgets summing to 390/525/750 s |
| `design/item-drop-timed-buff-spec.md` | 946 | `BUFF_ITEMS`, `run.buffs`, `dropRng`, drop tables |
| `design/vfx-drop-spawn-terrain-spec.md` | 1250 | 9 pooled cues + 2 pool-free surfaces, pool proof |
| `design/audio-feedback-dungeon-spec.md` | 1426 | footsteps, 12 cues, 9 soundscape states |
| `ui/hud-overhaul-joystick-cutover-spec.md` | 984 | joystick cutover, 4 compositions, buff strip |

### 1.5 Implementation — three lanes LANDED and verified, one still open

Committed on `feat/cycle10-stage-dungeon`:

| commit | lane | evidence |
|---|---|---|
| `17428d69` | composed dungeon floors, catalog promotion, 4 asset allowlists, 3 contract-test inversions | 22/22 + 37/37 |
| `d37b6568` | joystick cutover, route rail, gimmick chip, buff strip, six design specs | joystick browser 4/4, overlay 6/6, world-presentation 10/10 |
| `ad0c3751` | footstep un-shadowing, 11 new cues, soundscape 6→9 states | audio 17/17, cutscene audio 8/8 |
| `f1accc05` | four-composition joystick proof | measured, see below |

Committed-surface regression, 11 files, run in the isolated worktree with
`--test-concurrency=2`: **110 tests, 110 pass, 0 fail** [OBSERVED].

**Joystick cutover, browser-measured at four authored compositions** [OBSERVED]:

| composition | viewport | pad | portraitFlag | centre clear | <44px controls | h-overflow |
|---|---|---|---|---|---|---|
| phone landscape | 844×390 | 116×116 | false | yes | 0 | 0 |
| phone portrait | 390×844 | 116×116 | **true** | yes | 0 | 0 |
| desktop | 1440×900 | 144×144 | false | yes | 0 | 0 |
| Steam | 1920×1080 | 160×160 | false | yes | 0 | 0 |

Portrait is the case that matters: it was `display: none` before, so the
five-button pad was the only control there and the joystick could never appear.
Four distinct pad sizes, not one scaled copy.

**Renderer and UI lanes were both ABORTED mid-verification**, so I audited and
finished them myself rather than reporting a half-landed lane. `battle-realtime-three.js`
`node --check` clean at 5239 lines with every new symbol present; I took the two
`combat-presentation-contract` assertion inversions its owner never reached.
`app.js` clean at 4171 lines; `AudioImpl` found and reported a `renderRouteRail`
null-dereference in it that reddened 3 of 8 cutscene-audio tests, proved it was
not theirs by A/B against the base `defense-audio.js`, and it is fixed.

**The drop/buff lane is NOT closed.** The simulation code landed —
`run.buffs`, `dropRng`, `rollBuffDrop`, `expireBuffs`, `reconcileGateCap`,
`BUFF_ITEMS` — but it shipped with **zero tests**, and its own spec §9 names seven
determinism checks as a hard gate: *if any of those seven fails, the feature does
not ship*. `grep -rl dropRng tests/` returned nothing. Three `Tester` agents were
dispatched to author the missing coverage: the seven determinism checks, the new
renderer VFX behavior, and the new audio cue behavior. Roughly 930 of ~1250 new
lines had no behavioral coverage, because the passing runs cited above prove the
new code did not break old behavior — no existing test emits the new event types,
so those branches were never entered. That is the carried-vs-new evidence
distinction CLAUDE.md §6 requires, and it is why those passes are not sufficient.

---

## 2. Defects the cycle found in existing code [OBSERVED]

These were latent before this cycle and would not have surfaced without the specs.

| # | Defect | Evidence |
|---|---|---|
| 1 | `effectAnchor()` never reads top-level `event.x`/`event.y`, and `spawnVfx()` hard-returns on a null anchor with no warning. **8 of 9 new cues would have silently never rendered.** | `battle-realtime-three.js:1194-1210`, `:4029`; verified by the director |
| 2 | `worldPointInto()` treats `\|x\| ≤ 1 && \|y\| ≤ 1` as normalised, so a legitimate arena-corner (0,0) lands at arena centre. An explicit `normalized: false` does not force the raw path. | `:932` |
| 3 | `movement-step` is **dead code**, not merely unmapped: the simulation already emits `cue: eventCue("movementStep")` every 12th tick, but the policy registry shadows the catalog-cue fallback. Footsteps are a re-wiring, not a new synth. | `defense-audio.js:230`, `defense-catalog.js:208-209`, `defense-run-simulation.js:2886` |
| 4 | `weapon-fire` is a second dead profile by the same mechanism — a weapon's release sounds identical to its windup. | same |
| 5 | A fully **dodged** projectile sounds exactly like a landed hit, though the renderer already plays the avoid animation off the same field. | `PROJECTILE_IMPACT` with `hit === false` → `impact-hit` |
| 6 | The 300–900 s window is **unreachable by construction**, not merely un-tuned: the objective-pressure deadline forces DEFEAT at 320/325/330 s. This corrects a carried claim of a "~3000–4000 s practical ceiling". | `map-simulation.md:317` vs the deadline arithmetic |
| 7 | `scripts/measure-stage-playtime.mjs` cannot validate the target window: `PLAYTIME_TARGET_SECONDS {min:180,max:360}` reports false for every compliant run, and `MAX_TICKS` 28800 truncates every throne target as TIMEOUT. | `:26-27` |
| 8 | A coarse-portrait `display:none` movement pad reached `updateJoystick`, whose zeroed rect made radius 1 and computed octants from the screen origin. **Closed on this branch by cycle 10** — `git diff -- app.js` shows the geometry guard and the `joystickActive()` early return as added lines, not inherited. The concurrent session's own fix lives only in their uncommitted tree and is **not** in `feat/cycle10-stage-dungeon`, so a conflict resolution that drops our lines silently reopens the bug. | `app.js` `joystickActive()`, `onMoveControlDown` |
| 9 | **A runtime asset must be registered in FIVE lists, and nothing enforces that they move together.** `defense-runtime-assets.mjs`, `tests/pages-artifact-smoke.cjs`, `static.yml` `PAGES_RUNTIME_PATHS`, the `release-closure.test.mjs` literal, and the generated `assets/defense-asset-manifest.json`. I moved four and missed the fifth. It was **CI-blocking**, not cosmetic: `pr-guard.yml:144` and `static.yml:117` both run `defense-asset-manifest.test.mjs` in their gate sets, so a push would have failed the PR guard. `release-closure` compares two of the five with an order-sensitive `assert.deepEqual`, so position matters as well as membership. Found by the full-suite run, not by reasoning. | `tests/defense-asset-manifest.test.mjs:50` |
| 10 | `dev.sh --verify` execs `tests/playtest-browser-3stage.cjs`, which exists in no tree and not at HEAD. That flag has been dead since it was written. | `dev.sh:50-53` |
| 11 | **The `gateMaxIntegrity` buff makes the published snapshot self-inconsistent — a cycle-10 regression, withdrawn rather than shipped.** `bulwark-echo` composes an effective gate cap without writing `gate.maxIntegrity`, but `getRunSnapshot` publishes `gate: run.gate` verbatim, so while the buff is live the snapshot reports `integrity 1920` against `maxIntegrity 1600`. Three consumers assume that cannot happen: the Stage1b pressure runner's `to > max` invariant (**G7 evidence tooling**), the `low-hp-focus` enemy policy's `gateRatio = integrity / maxIntegrity` (a gate buff pushes it above 1 and flips targeting to the commander — **live behaviour, not display**), and any HUD ratio. The spec's own §4 predicted the HUD half and `reconcileGateCap` answered only the *post-removal* half. **Attribution measured, not assumed:** the failing file passes 8/8 at base `033877ad` in a detached worktree, so it is ours. Item withdrawn; spec check 11 PARKED; `effectiveGateMax` keeps coverage via a synthetic entry. Re-enabling requires publishing the composed cap and rerouting all three consumers. | `stage1b-pressure: invalid gate integrity state at tick 1496: from=1600, to=1601, max=1600`; `defense-run-simulation.js:3921`, `:2705`; commit `64974d3d` |

---

## 3. Process failures, and what they cost

### 3.1 Four provenance traps, in escalating severity

1. **Stale line numbers.** Specs were authored against the shared tree carrying ~430
   uncommitted lines. `resolveDeaths` was cited at `:2500` and is at `:2210`; two
   citations were **past EOF**. A few matched coincidentally, which made a spot-check
   pass while the rest were off by hundreds.
2. **Relative paths read the wrong tree.** `grep`/`read`/`glob` resolve a relative path
   against the original workspace root, not the worktree. Reproduced: the same pattern
   returned line 404 relative and 378 absolute. Four agents' citations were poisoned;
   two spec authors had to re-measure and correct **39** and **54** citations.
3. **Relative paths also WRITE to the wrong tree.** An `edit` with a relative header
   resolved against the forbidden tree and was stopped **only** by the stale-hash check.
   `styles.css` differs by one line between trees — had the file been byte-identical the
   tag would have matched and the write would have landed in a tree we were told not to
   touch.
4. **`_workspace/` is per-worktree.** The dungeon copies of the specs were snapshotted
   mid-authoring, so an implementer was building from a version with no anchor table and
   the stale caveat still in it.

Cost: one wasted three-stage Blender build against a stale script copy, and two spec
rewrites. Every trap was caught by an agent reporting a divergence instead of adapting
silently — that discipline is what kept them off the branch.

### 3.2 Test-runner pile-up

Four concurrent full-suite runners and 51 node workers on 12 cores, **load average
101.75–120.98**. `job cancel` killed the parent but not the children, which node spawns
without the `--test` flag. This suite has wall-clock-sensitive subtests — one runs 324 s
unloaded — so oversubscription manufactures timeout failures indistinguishable from real
regressions, and the tests write real fixtures, so concurrent runs corrupt each other.

Consequence recorded honestly: **there is no full-suite pass/fail baseline for cycle 10.**
Four attempts were started and all four were killed or invalidated. Per-file baselines
were captured instead, in the clean worktree — see `qa/cycle10-baseline.md`.

**The missing baseline turned out to be recoverable per-file, and that is how defect 11 was
caught.** `git worktree add --detach /tmp/as-base<sha> <base-sha>`, symlink `node_modules`,
then run the *specific* failing file there. `stage1b-pressure-packets` + `-evidence-exporters`
returned **8/8 pass at base** against 0/3 + 2/5 on the branch, which converted "six failures,
unknown origin" into "six failures, ours, in this feature" without needing a full-suite
before-number at all. Two operational costs, both real: the base run took **1642 s** because
it shared cores with verification runs, and `timeout` kills only the parent `node --test` — a
`run-g3-stance-events.mjs` grandchild survived at **599% CPU** as an orphan (`ppid 1`) and
silently starved every later run until it was reaped by pid. `kill -9` is also **not valid**
in this shell (`kill: invalid signal name`); `kill -s KILL <pid>` is. After reaping, the same
pressure-packets file that had timed out at 800 s finished in **109 s**. Per-file base
attribution should be the default first move on any suspected regression, and orphan reaping
the default first move before timing anything.

### 3.3 A director ruling that contradicted itself

Ruling v1 fixed `stat` to four values. Rulings v13/v14 then required basis-point
magnitudes and gate-targeted integrity — which the four names could not express
truthfully. `DropBuffSystem` escalated instead of silently diverging, and v17 superseded
my own list with their seven-value enum. The lesson is that a vocabulary ruling issued
before the constraints are settled will contradict the constraints.

### 3.4 An RNG collision that no test would have caught

Two agents independently chose `0x85ebca6b`. Two streams seeded identically are
perfectly correlated, and because RNG state is never serialised into the digest, **no
existing test would have detected it.** Registry now closed at four constants:
`combatRng` `0x9e3779b9`, surprise `0x6d2b79f5`, `dropRng` `0x85ebca6b`, `gimmickRng`
`0xc2b2ae35`.

---

## 4. Gate status

**No gate changed to PASS this cycle.** Design and assets are not measurements.

| Gate | Before | Now | Why |
|---|---|---|---|
| G1 세계관 | PASS | **영향 없음** | 고유명·순서 유지. Story quotes re-grounded to `stage-story-catalog.js` rather than a design doc. |
| G2 밸런스 | 재측정 필요 | **재측정 필요** | pacing spec is `[TARGET]` and unimplemented; the harness itself cannot judge the window (defect 7). Drop rate has one live datapoint — 8 deaths → 1 drop against `BASIC = 600bp` — which is consistent, not a balance measurement. |
| G3 편성 | 재정의 | **영향 없음** | cycle 9 owns it; explicitly fenced out by ruling R27. |
| G4 몰입/접근성 | 재측정 필요 | **부분 증거** | Joystick is now primary at all four compositions, browser-measured: pad 116/116/144/160, centre clear, zero controls under 44×44, zero horizontal overflow, portrait included. **No human-play adjudication**, so the gate does not move. |
| G6 운영/성능 | 재측정 필요 | **부분 증거** | Terrain load 30–40 ms; 3/4/5 slabs plus one apron per stage; `fitFootprint` 1.000000; floor GLBs 1.75–2.09 MB with lossless 512 PNG albedo. Draw-call and frame-time delta **unmeasured** — `tests/defense-performance-browser.cjs` exists and was not run. |
| G7 코어 루프 | 재정의 | **재측정 필요** | No 5–15 min run measured. The drop→collect→buff path is proven live at tick 3651, but a full stage traversal is not. |
| G8 최초 노출 | 재측정 필요 | **재측정 필요** | Joystick learning curve unmeasured; needs a human. |

---

## 5. Unresolved, carried forward

1. **No full-suite baseline — CLOSED. The suite ran to completion and cycle 10 causes zero
   pass/fail regressions.** `[OBSERVED]` Four earlier attempts were killed by the runner
   pile-up in §3.2. The fifth, run alone at `--test-concurrency=4` over all **57** files after
   reaping the orphans, finished: **566 pass, 1 fail.** The one failure is
   `tests/stage1b-persistence.test.mjs:332`, and it **reproduces at base `033877ad`**
   (10/11 there too, same subtest), so it is inherited, not ours — see item 12 for its
   three-leg attribution. Two traps worth naming, because both cost time here: the dot
   reporter emits **no `# tests` summary** when a child exits non-zero, so a completed run
   looks like a dead one — count the dots and `✖` marks instead; and `pgrep -f "node --test"`
   matches only the parent, because children spawn as `node --test-concurrency=4 tests/<file>`
   with no `--test` token. I twice concluded "the run died" from those two artifacts while it
   was healthy, and once ran `git checkout -- qa/evidence/` **mid-run**, racing a live
   exporter write. That race produced no spurious failure — proven by base reproducing the
   same single failure without any race — but it was still the wrong move: the exporter
   restores the canonical file in its own `finally`, so the checkout was both unnecessary and
   capable of corrupting an in-flight write.
2. **`Math.round` in `effectiveCooldownScaleBp` — CLOSED. Load-bearing at reachable values,
   and the spec's stated reason was the wrong one.** The spec and an earlier commit message
   of mine both claim `0.9 * 10000` is `9000.000000000002`. It is exactly 9000 — verified —
   so the justification was false and a mutation sweep over clean literals let the deletion
   survive. The dust is not in the literals, it is in the **accumulated subtraction** the
   write paths actually perform, and there it changes a gameplay number:

   | reachable expression | product | `trunc` | `round` |
   |---|---|---|---|
   | `0.7 − 0.2` | 4999.999999999999 | **4999** | **5000** |
   | `0.94 − 0.06` | 8799.999999999998 | **8799** | **8800** |
   | 0.06 step 3 | 8199.999999999998 | **8199** | **8200** |
   | 0.06 step 4 | 7599.999999999998 | **7599** | **7600** |
   | 0.06 step 5 | 6999.999999999997 | **6999** | **7000** |

   Successive `SKILL_RANK_COOLDOWN_STEP` 0.06 from 1.0 goes dusty at step 2 and stays dusty
   through step 5, off by one every time. So the guard prevents a live off-by-one, not
   harmless dust — and separately it is required for integrality, because the accessor feeds
   `Math.trunc(ticks * bp / 10000)` and without the round 20 of 35 reachable scales return a
   float `bp`. The test now derives the reduction set from the live catalogs so a new
   reduction widens the sweep automatically, and pins `assert.equal(0.9 * 10000, 9000)` so
   the false claim cannot rot back in. A mutant that was UNDETECTED is now DETECTED.
3. **Two of my own claims were narrowed by measurement and the narrow form is the true one.**
   Digest byte-identity holds for runs with **zero spawned drops**, not "no buff active" —
   a spawned drop consumes a `nextId` and renumbers subsequent actor ids. And six of the
   seven `bp === 0` accessor guards are arithmetically **unobservable**: deleting one keeps
   every check green. I twice wrote that those guards are what make byte-identity a proof;
   that is true of exactly one row.
4. **Hazard-class visuals have no owner** (R30). `forge-pressure-vents` and
   `dais-command-echo` ship with correct pool behaviour and **no dedicated visual**.
   Reusing `deform-fracture-seam.glb` is prohibited — a narrowing seam and a pressure
   vent are different claims about the world.
5. **R-3 is closed for terrain, open for VFX.** The three new VFX GLBs
   (`drop-beacon-pillar`, `arrival-breach-gate`, `deform-fracture-seam`) are absent from
   all four allowlists because nobody has authored them yet.
6. **Pacing deltas are unimplemented.** The doctrine changes that would make 390/525/750 s
   reachable — including the two harness constants — are specified, not landed.
7. **Four files need a real merge with the concurrent session**: `defense-catalog.js`
   (923 vs 1025), `defense-run-simulation.js` (3570 vs 4002), `app.js`,
   `battle-realtime-three.js`. Planned, not a surprise.
8. **Slab layouts — cinder-span CLOSED, chancel and throne scoped and measured.**
   `[OBSERVED]` Cinder's authored layout is now applied: routes in `87915ded`
   (corridorWidth 1200→1400 / 700→900, five waypoints moved) and obstacles in `eb434315`
   (3→6, promoting three already-visible frozen props to collision). Margins recomputed with
   the validator's own rule: critical +213.87, detour +49.86 — the detour figure reproduces
   the spec's stated tightest margin to the hundredth.

   Two measurements made this landable in two commits instead of one risky one. First,
   `defense-run-simulation.js` has **zero reads of `gameplay.routes`** (it reads `bounds`,
   `surfaces`, `obstacles`, `meshColliders`), so the route commit is digest-neutral and
   `defense-run-simulation.test.mjs` stayed 40/40 with **zero hash re-pins** — that green is
   the evidence rather than an assumption. Second, obstacles **are** read
   (`resolveTerrainPlacement`, `firstObstacleHit`) and do displace entities, yet the four
   pinned windows still did not move, because none of them reaches the three added circles
   (closest approach +2494.53). That null result carries a positive control: injecting one
   obstacle on the commander's start moves the hash to `d4086a62`, so the harness is
   demonstrably sensitive and the invariance is measured, not an unwired no-op. **Do not
   generalise "obstacles are digest-neutral" from it.**

   **Chancel and throne are deliberately not applied, and the reason is arithmetic.** The
   spec's routes were authored against its own re-authored prop layout, so against today's
   props they are illegal — chancel critical **−532.23** (`oath-relic`), chancel detour
   **−967.36** (`east-colonnade-prop`), throne detour **−883.20**
   (`east-fractured-wing-prop`); all three throw `Prop blocks authored route` at import.
   Throne's critical passes at +310.00, so it is not uniformly broken — it is coupled.
   The spec's own layout is self-consistent (its claimed +301.24 / +200.00 reproduce
   exactly), so this is an **ordering** finding, not a spec defect.

   The atomic unit there is far wider than "routes and obstacles", measured:

   | stage | props exact / moved / absent / dropped | landmarks orphaned | anchors that must move |
   |---|---|---|---|
   | abyss-chancel | 3 / 5 / 5 / 4 | 1 (`landmark.west-colonnade`) | 2 (`apse-light-anchor`, `nave-light-anchor`) |
   | echo-throne | 3 / 7 / 3 / 2 | 1 (`landmark.echo-court-crescent`) | 2 (`dais-light-anchor`, `aisle-light-anchor`) |

   Plus the spec renames all 12 landmark ids, and `fractured-dais-prop` changes **radius**
   900→700 as well as position — which is load-bearing, not cosmetic: keep r900 at the new
   (19200, 7600) and throne's critical route fails by −700. So landing it means props +
   landmarks + anchors + obstacles + routes in one commit, **deleting six currently visible
   props** across two stages. That is a presentation content decision, not the
   route/obstacle gap this item was opened for. Chancel/throne props are generic
   relic/blade instances with **no `modelNode` at all** (0/12 on both, vs cinder's 12/12
   from stage-specific packs), so no unauthored art blocks it — only the content call does.
9. **Tiling reads repetitively** at `uvRepeat` 3–5 per axis on the chancel and throne
   floors. Seams are mathematically invisible; the *pattern period* is visible. A
   per-slab rotation or a second variant tile would break it up.
10. **Spec check 11 is PARKED and the drop/buff catalog ships 10 of 11 items.** The
   withdrawal in defect 11 is the honest close of the gate-cap question for this cycle, not
   a solution. Carried: (a) check 11's three-removal-path reconciliation is **uncovered**,
   because no reachable drop can produce a gate buff — `reconcileGateCap` is live code whose
   eviction path now has no end-to-end test; (b) the withdrawal edits `defense-catalog.js`, so
   `qa/evidence/gates/G2/g2-adversarial-tape-fixture.receipt.json` now claims a **stale**
   digest for it (`31a36ad1…` recorded vs `c0b2c1ea…` actual). **That is the narrowest true
   statement, and the real scope is wider — see item 11**, which measured two receipts with
   2-of-7 and 5-of-6 stale inputs and traced most of the drift to commits before this cycle.
   G2 was not re-adjudicated here, so nothing was re-exported into a gate nobody judged — the
   next G2 adjudication must. (c) The cycle-10 drop/buff proof folder carries
   `SUPERSEDED-bulwark-echo.md`; its receipt and `dbimpl-behavior.mjs` measured the withdrawn
   item accurately and are deliberately left byte-unedited.
11. **Committed G2/G3 gate evidence is stale, measured three ways — re-export deferred, not
   forgotten.** `[OBSERVED]` The G3 formation-attribution exporter is deterministic (four
   successful runs, one size each), and it produces **three different artifacts** depending on
   the tree:

   | tree | bytes | delta vs committed |
   |---|---|---|
   | committed at HEAD (last written by `47d8dcda`, 2026-07-28) | 12,985,632 | — |
   | base `033877ad` | 13,953,706 | **+968,074** |
   | this branch | 13,920,096 | +934,464 |

   So the **dominant drift is pre-existing** — `defense-run-simulation.js` changed in **9
   commits** between the artifact's last write and our base (10 to HEAD; the tenth,
   `ee82c5f0`, is ours), including `543194e8` "Abyss Depth v2" and others from concurrent
   sessions. Cycle 10's own contribution is the residual
   **−33,610** (base → branch), and total `controlRuns[].events` moves 18,540 → 14,804.
   Deliberately **reverted, not re-exported**: re-exporting would fold three days of other
   sessions' simulation changes into a G3 re-adjudication nobody requested, and G3 is fenced
   out of this cycle by ruling R27. G3 must be re-exported and re-adjudicated by whoever owns
   it next — the artifact in the tree today describes none of the three trees above.

   Two receipts also carry stale `inputDigests`, wider than item 10 stated:
   `G2/g2-adversarial-tape-fixture.receipt.json` has **2 of 7** stale (`defense-catalog.js`,
   `defense-run-simulation.js`), and `G2/stage1b-cinder-pressure-packets.json.receipt.json` —
   a **release** receipt (`sourceRevision: stage1b-release-20260727`) — has **5 of 6**,
   including `scripts/run-stage1b-pressure-packets.mjs` and
   `scripts/export-stage1b-pressure-packets.mjs`, which are the very G7 tooling cited in
   defect 11. Their `outputSha256` still matches their own payload, so each artifact is
   internally consistent; only the inputs drifted. Nothing enforces this —
   `g2-adversarial-tape-cli.test.mjs:149` only asserts the digest *matches the sha256 format*,
   never its value — so CI stays green while the provenance rots. A value comparison there
   would have caught all of it.

   How this was found, since the method generalises: an interrupted test left the canonical
   artifact dirty. The exporter writes the canonical path and restores the original in a
   `finally`, so killing the parent skips the restore. The dirty file was **not** damage —
   chasing it to a byte count, then to the base tree, then to `git log` on the artifact path
   is what separated "9 KB of killed-run garbage" from "968 KB of real, pre-existing,
   three-day drift".
12. **The G7 persistence exporter's hardcoded digest is stale, and cycle 10 moves it twice
    more — three legs, each measured separately.** `[OBSERVED]` The suite's single failure.
    `scripts/export-stage1b-persistence-scenarios.mjs` pins an expected
    `semanticPayloadDigest`, which hashes the whole payload with only `sourceRevision`
    normalised, so any captured field moves it. Four digests, one run of the same file per
    tree:

    | tree | observed digest | leg |
    |---|---|---|
    | hardcoded expectation in the exporter | `821366a0…` | — |
    | base `033877ad` | `484347b6…` | **inherited**: the constant was already wrong before this cycle (5 sim commits since `2359578b` last touched the script) |
    | `ee82c5f0` (buff layer landed, `bulwark-echo` still present) | `24dd69f9…` | **ours, leg 1**: the drop/buff layer changed persisted state |
    | HEAD (withdrawal applied) | `d063a266…` | **ours, leg 2**: withdrawing the item shrank cinder-span's rare pool 3→2, so a seeded roll that previously landed on it now lands elsewhere — drop *outcomes* change for any seed reaching that pool, whether or not a buff is ever collected |

    **Why the last leg is attributable to the withdrawal specifically**, since
    `ee82c5f0..HEAD` is 23 files and 4,490 insertions and would otherwise license nothing:
    in that range `defense-run-simulation.js` is **byte-identical** (`git diff --numstat` is
    empty) and `defense-catalog.js` is touched by **exactly one commit — `64974d3d`, the
    withdrawal — at +20/−1**. Everything else in the range is renderer, audio, tests, specs,
    and PNGs that the persistence exporter never reads. So the only input to that digest which
    moved is the catalog, and the only catalog change is the withdrawn item.

    Two consequences. First, **the constant is deliberately not refreshed**: doing so would
    absorb five commits of other sessions' drift into this cycle's commit, which is exactly the
    G3 mistake item 11 avoided. Whoever re-adjudicates G7 re-pins it. Second, and more
    interesting, **the persisted-scenario payload is sensitive to the drop/buff layer while
    `getRunSnapshot` is not** — determinism check 1 proved snapshot byte-identity precisely
    because the snapshot omits `buffs`/`buffStats`. So byte-identity of the snapshot was never
    evidence that persistence was unaffected, and the retrospective's G7 "재측정 필요" line has a
    concrete reason attached rather than a general one.

    Method note: three of the four numbers above came from throwaway detached worktrees
    (`git worktree add --detach /tmp/as-<sha> <sha>`, symlink `node_modules`, run the one
    file, ~90 s each). A three-way split that separates inherited drift from two distinct
    cycle-10 increments cost four single-file runs and no guessing.

---

## 6. Next-cycle entry decision

**Enter at Stage 2 (balance / core-loop stability), not Stage 1.** Concept and asset work
for the three dungeons is done and proven. What is missing is measurement: the pacing
deltas plus the two harness constants, then a seeded duration run per stage, then human
play adjudication for G4/G7/G8.

Sequence, in dependency order:

1. Land the pacing doctrine deltas and the two `measure-stage-playtime.mjs` constants.
2. ~~Run the full suite once, alone, in the worktree. Record the real baseline.~~ **DONE this
   cycle** — 57 files, 566 pass, 1 fail, the failure reproduced at base. See unresolved item 1.
   What is still owed is the G7 persistence digest re-pin described in item 12.
3. Chancel and throne layout — **not** "apply the spec", which is what this looked like from
   the outside. Cinder is done (`87915ded`, `eb434315`). Those two need props + landmarks +
   anchors + obstacles + routes in ONE commit, and it deletes six visible props. Decide the
   content question first: is the spec's re-authored prop layout the one we want, given it
   drops `oath-apse-prop` (r880) and `court-crescent-prop` and renames all 12 landmarks?
   Applying routes alone throws at import — measured, see unresolved item 8.
4. Author the three VFX GLBs and register them in all four allowlists in one commit.
5. Merge with the concurrent session's cycle-9 branch deliberately, file by file.
6. Only then seek human-play adjudication.
