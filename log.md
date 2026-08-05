# Log

Append-only timeline of meaningful wiki operations.

Use headings in this format:

```md
## [YYYY-MM-DD] ingest | Source title
## [YYYY-MM-DD] query  | Question title
## [YYYY-MM-DD] lint   | Pass summary
```

Each entry should list the files touched, the reason for the change, and any follow-up work.

## [2026-07-29] report | Natural rest-pose motion library

- Added `wiki/reports/2026-07-29-natural-rest-pose-motion-library.md` to record the 11-asset natural bind-pose cutover, its evidence, and its focused regression gates.
- Updated `index.md` so the report is discoverable from the vault entry point.

## [2026-07-30] ingest | Motion generation + encounter pattern research

- Added `raw/sources/2026-07-30-motion-generation-and-encounter-pattern-research.md` (immutable
  capture of MDM arXiv:2209.14916, T2M-GPT arXiv:2301.06052, the three.js animation-system docs and
  the Game Developer behaviour-tree article).
- Added `wiki/sources/2026-07-30-motion-generation-and-encounter-pattern-research.md` summarising
  what each source settles and what it does not.
- Added `wiki/concepts/motion-generation-for-runtime-rigs.md` (method comparison, the Blender
  retarget pipeline we run, and the concretised motion prompt templates) and
  `wiki/concepts/attack-pattern-presets-and-ai-response.md` (three-phase step structure, authored
  presets, and the four AI response patterns).
- Updated `index.md` so both concepts and the source note are reachable from the vault entry point.
- Follow-up: the generative path (S1/S2) has not been executed; the prompt templates exist for the
  case where a beat is missing from `assets/motion/bench`, and any output must clear the
  provenance/audit gate in `CLAUDE.md` §3 before it can be referenced at runtime.

## [2026-07-31] report | Stage 1 cinder-span ash gatehouse (phase 1)

- Ran `prompts/approved/00` → `03` → `02` → `01` → `06` for `cinder-span` on top of the cycle-10
  layout pass (`origin/main` @ `012ea15d`), with every bound coordinate frozen.
- Collision detour: an earlier draft of this work re-placed three props into a full doorway lattice
  before cycle 10 landed the same idea by promoting frozen props in place. That draft was dropped
  rather than merged over another session's work; the shipped change is additive to it.
- `stage-world-catalog.js`: obstacles 6 → 8. Two background props (`south-forge-teeth-prop`,
  `north-ash-talon-prop`) become the ash gatehouse pillars at (7800, 3000) r840 and (7600, 8000)
  r740, the one doorway the promoted debris does not provide (gap 3424). Prop count stays 12 and the
  pinned pack-node list is unchanged. One landmark added.
- `defense-catalog.js`: `mapVariant` v1 → v2 listing the `ash-gatehouse` module. No balance value
  changed — the measurement showed identical bot pacing, so nothing motivated a retune.
- Added `scripts/search-stage-dungeon-layout.mjs` (seeded module search, flood fill, five clearance
  filters; 11/12 seeds survived, seed 42 curated) and `scripts/measure-stage-pacing.mjs`.
- Evidence: focused suites 101/101; full `node --test 'tests/**/*.test.mjs'` 607 tests, 577 pass,
  5 fail — all five reproduced red on a pristine `origin/main` worktree, so this branch adds no
  failure. Browser proof green on all three stages, 12 props each, zero console errors.
- Digest gates repinned for cinder-span only; `abyss-chancel`, `echo-throne` and all three
  rng-at-3000 fixtures re-measured unchanged.
## [2026-07-31] report | Stage 2 abyss-chancel composition + a validator blind spot

- Executed the authored chancel composition (`_workspace/current/design/stage-dungeon-composition-spec.md`
  §2.2/§3.3/§5.2/§6) as the atomic unit the cycle-10 retrospective specified: props, landmarks,
  anchors, obstacles and routes in one commit. 13 props (7 obstacles), 6 landmarks, 4 motivated
  lights, 4 fog breaks, critical route re-threaded through both objective points, detour moved to
  the northern mirror aisle. Bound coordinates untouched.
- Found and fixed a defect the spec would have shipped: two obstacles sat on
  `STAGE_ENCOUNTER_ROUTES` spawn approaches (`narthex-debris` −453 over `chancel-south-entry`,
  `nave-seal` −54 over `chancel-nave-north`). `validateProfile` never checks those paths, so the
  module imported cleanly and every suite stayed green while a measured run collapsed from 81 spawns
  / 7 cleared waves to 27 / 1. After the minimal correction: 83 spawns, 10 waves, boss reached.
- Durable fix: `scripts/search-stage-dungeon-layout.mjs` gained the spawn-approach clearance filter
  and a `--verify` mode that runs the whole filter set against an authored profile. Recorded in
  `prompts/approved/03-procedural-layout.md` v2 and in the concept page.
- The verifier then found two more overlaps on `echo-throne` (`fractured-dais` −19,
  `gallery-debris` −75); both corrected, with measured runs unchanged (60 spawns, 9 waves, boss on
  both builds).
- Pacing: chancel now completes on every measured seed (199-204 s) where `origin/main` never
  completed (bot capped at 325 s in gate-defense). Doctrine window is 180-360 s.
- Evidence: focused suites 64/64 plus gate checks 11/11; full `node --test 'tests/**/*.test.mjs'`
  607 tests, 577 pass, 5 fail — the same five pre-existing failures verified red on a pristine
  `origin/main` worktree. Browser proof green on all three stages (chancel now 13 props).
- Digest gates needed no repin: the pinned `abyss-chancel` and `echo-throne` windows re-measured
  byte-identical, consistent with the cycle-10 finding that those windows never reach the changed
  circles.

## [2026-07-31] report | Stage 3 echo-throne composition — the spec's last stage lands

- Executed the authored throne composition (`stage-dungeon-composition-spec.md` §2.3/§3.4/§5.3/§5.4)
  as one atomic change: 13 props (7 obstacles), 6 landmarks, 4 motivated lights, 5 fog breaks, and
  both routes re-authored. Bound coordinates untouched.
- Critical route now runs the mirror axis with both intermediate waypoints on the encounter
  objective points; the detour enters the north gallery, cuts the aisle at (10100, 6000) and exits
  south, so the optional path physically performs the stage's mirror.
- `fractured-dais-prop` moves to (19200, 7600) and shrinks r900 -> r700. The cycle-10 retrospective
  flagged this as load-bearing: keeping r900 there fails the critical route by -700. At r700 it
  clears by 200, reproducing the spec's claimed +200.00 exactly.
- `--verify` now passes for all three stages: cinder 50, chancel 419, throne 200 route margin,
  every spawn approach clear.
- Pacing unchanged and inside band (209-222 s vs 209-217 s baseline, complete on every seed).
- Evidence: focused suites 54/54 plus gate checks 11/11 with no digest repin needed; full
  `node --test 'tests/**/*.test.mjs'` 607 tests, 577 pass, 5 fail — the same five pre-existing
  failures. Browser proof green on all three stages (12 / 13 / 13 props).

## [2026-07-31] report | Terrain tiles: the floor contract becomes machine-checked

- Authored `gameplay.terrainTiles` for all three stages (3 / 4 / 5 slabs) matching the slab quads
  the promoted terrain GLBs already ship, and re-authored the support mesh from one bounds-spanning
  quad into two triangles per tile, in tile order.
- Added the spec §6.1 validator extension: slab ids now pass through `claimId` (closing spec risk
  R8, where a slab id could silently duplicate a route or prop id), rects must be integer and inside
  bounds, tiles may not overlap, `Σ tileArea` must equal the bounds area exactly, the support mesh
  must carry two triangles per tile, and each tile's triangles must lie inside its own rect.
- Added `tests/stage-terrain-tiles-contract.test.mjs` (4 tests): exact tiling, per-tile triangle
  ownership, every `plateNode` resolving inside the shipped GLB, and three negative controls that
  import mutated copies of the real catalog and assert each new clause rejects.
- Evidence: new suite 4/4; focused stage suites 54/54; gate checks 11/11 with no digest movement
  (partitioning a flat quad changes its description, not its geometry); full
  `node --test 'tests/**/*.test.mjs'` 611 tests, 581 pass, 5 fail — the same five pre-existing
  failures. Browser proof green with `terrainIntegrity.meshCount` 4 / 5 / 6, matching 3 / 4 / 5
  slabs plus one apron per stage.
- Not included: gimmicks (spec §4), seam inlay geometry (R11), per-slab material merge.
  `materialId` is authored but unread — recorded so the renderer has a source of truth later.

## [2026-07-31] report | Gimmick catalog: the spatial half lands with its gates

- Authored `gameplay.gimmicks[]` for all three stages (4 / 4 / 5 = 13) exactly per spec §4.2-4.4,
  ids frozen because `EncounterPacing`, `VfxCueDesign` and `AudioFeedbackDesign` already address
  them verbatim. Multi-point gimmicks keep the ruled single-`placement` shape and carry their extra
  footprints in `satellitePlacements`.
- Additive validator clauses: `claimId` on every gimmick, class enum, per-class telegraph tier
  (deformation 180 / gate 120 or 90 / mirror 90 / hazard 60), `slabId` naming a real terrain tile
  **and the footprint sitting inside that tile's rect**, `objectiveId` naming a real objective,
  a declared narrowing never widening, every objective covered, and **V17**: any corridor change
  must leave >= 900, since COMMANDER.radius 360 means the commander's diameter is 720 while the
  generic corridor floor is only 600.
- Added `tests/stage-gimmick-catalog.test.mjs` (5 tests): coverage and ordering, the V17 floor read
  from `COMMANDER.radius` rather than hardcoded, per-slab containment, ring gimmicks matching their
  occupation geometry, and four negative controls importing mutated copies of the real catalog.
- Nothing at runtime reads the new field yet, and the report says so: the simulation half (arming,
  the `gimmickRng` stream, the GIMMICK_* events, the R12 `event.type` dispatch discipline) is owned
  by the lane currently working `defense-run-simulation.js`.
- Evidence: new suite 5/5; stage suites 50/50; gate checks 11/11 with no digest movement; full
  `node --test 'tests/**/*.test.mjs'` 616 tests, 586 pass, 5 fail -- the same five pre-existing
  failures.
## [2026-07-31] ingest | Stage map / 3D dungeon / stage composition skill catalog

- Added `raw/sources/2026-07-31-stage-map-composition-skill-catalog.md` (immutable capture of the
  operator's skill/tool catalog, the prompts.chat README, and the three CC0 `prompts.csv` seed rows
  used as prompt scaffolding).
- Added `wiki/sources/2026-07-31-stage-map-composition-skill-catalog.md` recording what each capture
  settles and what it does not — notably that both prompts.chat PCG rows assume runtime infinite
  generation, the opposite of this repository's static authored-data contract.
- Added `wiki/concepts/stage-map-composition-pipeline.md`: the canonical band grid observed across
  the three shipped stages, the executable map contract transcribed from `validateProfile`
  (`stage-world-catalog.js:382-563`), per-tool applicability verdicts under `CLAUDE.md` §2/§3, and
  the seven-step pipeline.
- Added the prompt library `prompts/README.md`, `prompts/VERSIONS.md`, `prompts/drafts/README.md`
  and `prompts/approved/00`–`07` — one C.R.A.F.T. prompt per pipeline step, each with the numeric
  invariants and its own regression gate inlined.
- Updated `index.md` so the source, the concept page, and the prompt library are reachable from the
  vault entry point.
- Evidence: `node --test` over `stage-world-quest-points`,
  `stage-world-encounter-routing-contract`, `world-presentation-contract`,
  `defense-stage-world-movement`, `stage-terrain-environment-contract`,
  `stage-framing-and-motion-profile`, `stage-wave-doctrine` — 55 tests, 55 pass, 0 fail.
- Fixed on the way: `tests/stage-wave-doctrine.test.mjs` asserted that every passive rank-up raises
  `basicDamage`. `applySkillRankEffects` banks the stat the passive authors (`eclipse-edge` →
  `basicDamage`, `soul-magnet` → `pickupRange`, `ward-binder` → `maxIntegrity`), so the assertion
  was wrong, not the simulation. It now checks the authored stat per passive; the suite was
  deterministically red twice before the change and is 10/10 green after.
- Follow-up: no stage data changed in this session. The prompts are the applied artifact; the next
  stage map revision enters at `prompts/approved/00` and must re-clear the same suites.

## [2026-07-31] lint   | Authored vault clean after the stage-map ingest

- `bash scripts/wiki-sync.sh --lint`: 8 pages, no structural issues.
- The pre-existing orphan `wiki/reports/2026-07-29-natural-rest-pose-motion-library` is now linked
  from its parent concept `wiki/concepts/motion-generation-for-runtime-rigs.md` §7.

## [2026-07-31] report | Stage 1-3 runbook: placeholders resolved from code

- Added `prompts/RUNBOOK.md` — identity, presentation, encounter, quest, reward and fixture-seed
  tables for the three canonical stages, so `${stageId}` and every other placeholder in
  `prompts/approved/*` resolves without reading the catalogs again. Stage 1 `cinder-span`,
  stage 2 `abyss-chancel`, stage 3 `echo-throne`.
- Cross-checked every runbook number against `STAGES`, `STAGE_TACTICS`, `STAGE_ENCOUNTER_ROUTES` and
  `STAGE_WORLD_PROFILES` with a one-off Node script: caps, objective ids/points/radii, occupation
  and extraction geometry, the four quest-point placements, silhouette profiles, VFX effect ids,
  walkable bounds and obstacle/prop/landmark counts all match.
- Corrected two transcription defects found by that check: `echo-throne` caps were recorded as
  `9 / — / —` in `prompts/approved/01` (actual `10 / 26-8-4 / 15`) and its objective radii were
  missing; the objective-2 radius range in `prompts/approved/00` and
  `wiki/concepts/stage-map-composition-pipeline.md` was `1400-1500` (actual `1400-1550`), and the
  west-entry x was `6200` (actual `6000-6200`).

## [2026-07-31] ingest | Game 3D VFX / animation / cinematic skill catalog + presentation prompt track

- Added `raw/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog.md` — immutable verbatim
  capture of the operator's presentation skill/tool catalog (9 sections) plus the same session's
  second requirement (knockback, and parallel / encircling / ground-emergence / sky-drop enemy
  arrival instead of a serial column).
- Added `wiki/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog.md`. All 14 repository
  paths named in the capture's §9 verified present with `find`. The capture's own eight-step order
  contains no number, so on its own it cannot pass `CLAUDE.md` §6; the numbers were recovered from
  the runtime instead.
- Added `wiki/concepts/runtime-presentation-and-arrival-choreography.md` — the executable
  presentation contract: `MAX_VISUAL_EFFECTS 40` with per-family live budgets
  `drop 3 / buff 2 / spawn 4 / deform 1`, 88 `VFX_MODELS` event ids, 17 eviction-exempt types, the
  `resolveVfxLifetimeTicks` precedence, `TARGET_HEIGHT` and the `motionProfileFor` bounds, the
  per-stage camera clamps and intro dolly lengths, the contact-feel constants, and the four
  requested arrival patterns decomposed across the simulation/renderer boundary.
- Two findings established from code, neither present in the capture:
  - **Knockback is presentation-only.** `grep -n knockback defense-run-simulation.js` returns
    nothing. The whole model is four renderer constants (`battle-realtime-three.js:1057-1060`,
    160/260 ms and 0.12/0.26 world units) applied as an offset that `updateActorFollow()` pulls back
    every frame. Authoritative knockback does not exist and adding it is a digest-visible change.
  - **The graded-arrival hook is dead.** `ENEMY_SPAWNED` has exactly one emit site
    (`defense-run-simulation.js:1036`) and its payload carries neither `grade` nor `telegraphTicks`,
    while the renderer branches on both (`isCriticalVfxEvent`, `resolveVfxLifetimeTicks`). So the
    SHADOW pool exemption and the 60-tick arrival telegraph are unreachable in production, and every
    arrival resolves to the 30-tick fallback and stays evictable.
- Added `prompts/approved/10`–`19`, the presentation track: cue spec, arrival choreography, impact
  and knockback feel, motion source/retarget, runtime VFX, camera and cinematic, audio cue layer,
  frame budget recovery, regression proof, capture and release. Each is C.R.A.F.T. plus
  `HARD CONSTRAINTS` / `DONE WHEN`, with the numeric invariants above inlined.
- Updated `prompts/README.md` (two tracks, the `05` vs `10`–`14` ownership boundary, a new authoring
  rule that the simulation boundary is a hard constraint), `prompts/VERSIONS.md` (10 rows plus 5
  limitations), and `index.md`.
- Evidence: the ten presentation suites run in one command —
  `node --test tests/combat-presentation-contract.test.mjs tests/world-presentation-contract.test.mjs
  tests/stage-framing-and-motion-profile.test.mjs tests/realtime-motion-routing.test.mjs
  tests/ingame-motion-pack.test.mjs tests/runtime-visual-assets.test.mjs
  tests/aoe-burst-wide-hit-contract.test.mjs tests/audio-feedback-runtime.test.mjs
  tests/audio-sample-hybrid.test.mjs tests/battle-session-cutscene-audio.test.mjs`
  — **129 tests, 129 pass, 0 fail, 19836 ms**. Recorded as the baseline inside
  `prompts/approved/18`.
- No runtime code changed in this session. The prompts and the concept page are the applied
  artifact; the arrival and knockback work itself enters at `prompts/approved/11` and `12`, and
  `11` is blocked on a simulation-owner decision about whether an arrival formation may draw from
  the seeded RNG (`defense-run-simulation.js:1518`).

## [2026-07-31] ingest + change | Stage pattern / difficulty / system diversification catalog, the systems prompt track, and the `echo-throne` doctrine retune

- Added `raw/sources/2026-07-31-stage-pattern-difficulty-system-variation-skill-catalog.md` —
  immutable verbatim capture of the operator's third catalog (9 sections: encounter design, numeric
  balance, diversification axes, simulation tuning, QA gates, planning frameworks, external theory,
  external tooling, repository mapping).
- Added `wiki/sources/2026-07-31-stage-pattern-difficulty-system-variation-skill-catalog.md`. §9's
  three data owners and eight scripts verified present. One correction filed: the capture's
  regression table lists `tests/stage-wave-doctrine.test.mjs`, which `prompts/VERSIONS.md` still
  carried as a known pre-existing failure — re-measured this session at **10 tests / 10 pass / 0
  fail / 22885 ms**, so that limitation row is stale and was corrected in place.
- Added `wiki/concepts/stage-difficulty-and-system-variation.md` — the executable contract: the
  clear-budget derivation (`PLAYER_BASELINE_DPS 2250` = COMMANDER 900 dmg / 24 t at `TICK_RATE 60`,
  `WAVE_PRESSURE_BP 5500`, ramp 10000→13000 bp, `WAVE_KIND_PROFILE` 10000/17500/5000,
  `MIDBOSS_PROFILE` hp 6000 bp of one cadence budget), the per-stage doctrine and measured
  budget ratios, the four archetypes with their attack-pattern phase timings and the four AI
  response windows, the `ABYSS_DEPTH_PACKAGES` rule packages, the 20 variation axes, and the G2/G3/
  G5/G6/G7/G8 thresholds transcribed verbatim from `scripts/evaluate-stage1b-gates.mjs`.
- **Measured defect, then fixed.** Built `scripts/scan-stage-variation.mjs` (catalog-only,
  deterministic) to turn the capture's core discipline — 난이도는 요구되는 대응의 종류 수 — into a
  number. It failed on the shipped catalog: response types ran **16 → 17 → 16** while HP `scale`
  ran 100 → 115 → 130, because `echo-throne` fielded three enemy classes against `abyss-chancel`'s
  four and copied `cinder-span`'s mid-boss class (`guardian`), pressure lane (`chokepath`) and
  wave-kind rhythm (`n n b m …`).
- Retuned the `echo-throne` doctrine row in `defense-catalog.js` — and only that row:
  `classes` → `flanker > ranged > guardian > rusher` (all four classes), `kindCycle` →
  `normal, mid, normal, big, normal` (a 5-slot rhythm no other stage uses),
  `midbossEnemy` → `ranged` (a wall that must be closed on, not out-traded). Hold, cadence, wave
  count, caps, coordinates and `scale` untouched. Response types now **16 → 17 → 17**; worst
  pairwise shared-axis ratio **3/20 = 0.15**.
- Added `tests/stage-variation-doctrine.test.mjs` (6 tests / 6 pass): shared-axis ratchet ≤ 0.20,
  stage-unique rhythm/mid-boss/class-rotation, HP scale climbing **and** response types never
  falling with the last stage strictly above the first, final-stage class coverage, mid-boss
  authorship. The ratchet is set at the shipped worst pair plus one axis of headroom.
- Evidence, isolated in sandboxes because another session is concurrently editing
  `defense-run-simulation.js` (arrival choreography):
  - `node scripts/run-defense-balance-sim.mjs --strict` — `pass: true`, 0 failures, before and
    after. `cinder-span` and `abyss-chancel` digests **byte-identical**; `echo-throne`
    FINAL_COMPLETION on all three seeds, @12614/@12685/@12781 → @12640/@12517/@12783.
  - `node scripts/measure-stage-playtime.mjs --seeds 3` — `echo-throne` median 210.08 s → 209.68 s
    (208.48–213.28), 3/3 victories, 3/3 in the 180–360 s target; stages 1–2 numerically unchanged.
  - `node scripts/scan-stage-variation.mjs --strict` — exit 0, `worstSharedRatio 0.15`.
  - `node --test tests/stage-wave-doctrine.test.mjs tests/stage2-balance-retune.test.mjs
    tests/stage-world-encounter-routing-contract.test.mjs tests/stage-world-quest-points.test.mjs
    tests/stage-story-progression.test.mjs tests/defense-stage-world-movement.test.mjs
    tests/defense-expansion-contract.test.mjs` — **64 tests / 62 pass / 2 fail / 156055 ms**. Both
    failures are the single assertion `gate pressure advances toward the gate`, isolated to the
    other session's in-flight simulation: HEAD sim + HEAD catalog 17/17, HEAD sim + this session's
    catalog 17/17, working sim + either catalog 15/17.
  - `node --test tests/defense-run-simulation.test.mjs` — first run **40 / 39 / 1**: the pinned
    `echo-throne/12/500 bare` digest fixture. It was invalidated twice over at that moment — by this
    doctrine retune and, independently, by the concurrent arrival work (which then produced
    `3e523f9e…` for all three pinned stages). Re-measured an hour later the arrival work had become
    digest-neutral at every pinned checkpoint (`cinder-span/71/500` and `abyss-chancel/9/500` back to
    their `HEAD` values), so the remaining delta was attributable to this retune alone and the row
    was recomputed with `probe-digest.mjs` to
    `01972547729aa402735cb70eef54c126a816ec062bc2e165a511e04de825107a` — the same value the HEAD
    simulation sandbox produced for this catalog. Re-run: **40 / 40 / 0**. The other three fixture
    rows are byte-identical, which is what proves the retune stayed inside one stage.
  - The five `stage1b-*` suites exceeded a 20-minute budget and were not run to completion. They are
    `cinder-span`-only and that stage's digests were shown byte-identical.
- Added `prompts/approved/20`–`29`, the systems/difficulty/variation track: encounter pattern brief,
  enemy behaviour policy, difficulty budget, doctrine write, variation package, balance simulation,
  gate evaluation, monotony scan, systems regression proof, changelog and release. C.R.A.F.T. plus
  `HARD CONSTRAINTS` / `DONE WHEN`, with the numeric invariants above inlined.
- Updated `prompts/README.md` (three tracks, the `01` vs `22`–`23` geometry/pressure boundary, a new
  authoring rule that difficulty is a response-type count), `prompts/VERSIONS.md` (11 rows, 5 new
  limitations, 1 corrected), `prompts/RUNBOOK.md` (six systems entry points + the systems doctrine
  table), and `index.md`.
- Evidence artifacts and the digest probe are kept at
  `_workspace/current/qa/stage-variation-retune-20260731/` with a README naming the command behind
  each file; the throwaway module sandboxes were deleted. Nothing was committed by this session.

## [2026-07-31] execution | echo-throne 리튠 격리 커밋 + 게이트·심연 뎁스 실측 (브랜치 `retune/echo-throne-response-types`)

- deep-interview(17라운드, 모호도 5%) → ralplan 합의(3차 반복, Architect/Critic APPROVE_WITH_CHANGES)
  → 사용자 승인 후 실행. 스펙 `.gjc/_session-019fb61e-.../specs/deep-interview-stage-systems-remaining-work.md`,
  계획 `.gjc/_session-019fb61e-.../plans/ralplan/.../stage-03-planner.md`.
- 격리: `git worktree add -b retune/echo-throne-response-types ../abyssal-retune HEAD` + `node_modules` 심볼릭 링크.
  원 트리는 무변형이며 상대 세션(arrival choreography)의 미커밋 6파일은 그대로 남아 있다. 되돌림 태그
  `pre-retune-worktree-20260731`.
- 커밋 3개: ① 리튠+다변화 래칫+세 트랙 문서(55파일) ② `measure-stage-playtime.mjs`에 `--depth`/`--seed-list`/
  `minGateIntegrity` ③ 증거.
- **[OBSERVED] 아키타입 밸런스 붕괴가 처음 측정됨.** `stage1b-symmetric-trials-v1` 아티팩트는 저장소에 존재한
  적이 없었다(qa/evidence 전역 검색 0건). 정규 생산자로 생성(100행/21.5초)하니 G2 임계 9-11/20 대비
  striker 20/20, conductor 15/20, gambit 6/20, bulwark 5/20, rift 4/20. 깨끗한 HEAD 워크트리에서 동일 결과 →
  이번 리튠과 무관한 사전 결함.
- **[OBSERVED] 심연 뎁스는 규칙을 바꾸지만 난이도를 바꾸지 않는다.** cinder-span × 시드 401-405 × depth 0/1/2/3
  = 20런에서 게이트 무결성 바닥값 중앙이 1580 / 1580 / 1577 / 1588, 플레이타임 192.58 / 193.33 / 192.33 /
  193.73 s. 전 구간 5/5 승리·5/5 목표 내. 델타 최대 0.7%로 노이즈 수준이라 AC-10(모든 depth>0 < depth0,
  그리고 depth2 ≤ depth3 ≤ depth1) **FAIL**. 측정 유효성은 별도 확인 — `snapshot.abyssDepth`, 회복캡
  0.25/0.12/0.20, 정책 분포(추격 3 / 봉쇄 2+측면 2 / 측면 4)가 설계대로 전환된다. 계획대로 롤백하지 않고
  설계-수치 불일치로 기록.
- **[OBSERVED] 게이트 verdict 생성됨, disposition BLOCKED.** `qa/evidence/gates/stage1b-verdict.json`.
  G6/G7/G8은 인자 미공급에 따른 자동 BLOCKED(사람 실측 종속), G2는 readiness BLOCKED(pressure 15런 샘플플랜
  불완전, 보존 필드 누락), G3 FAIL 3건. 기존 pressure/persistence 아티팩트도 현재 evaluator 스키마를
  만족하지 못한다.
- 저비용 3수트: 63 tests / 62 pass / 1 fail / 119961 ms. 실패 1건(`stage1b-persistence`의 exporter 시맨틱
  digest 불일치)은 깨끗한 HEAD에서도 10/11로 동일 실패 → 사전 결함.
- Phase D(브라우저 미드보스 증거) 미착수. 이번에 확인한 사실: `app.js`에 `midboss`/`bossSpawned` 문자열이 없어
  미드보스 스폰은 DOM에 아무 신호를 남기지 않고 렌더러(`battle-realtime-three.js:1315`)만 소비한다. 자동 판정에는
  `tests/stage-runtime-proof-browser.test.mjs:96`의 `INSTALL_RUNTIME_PROBE` 재사용이 선행돼야 하며, 검증되지 않은
  스크립트를 커밋하지 않기 위해 착수하지 않았다.
- AC-12(고비용 exporters) 미실행: `git log -1 -- defense-run-simulation.js` = `9ba2aa39` ≠ HEAD `c139b508`,
  상대 세션 변경이 아직 미커밋이라 트리거 미충족.
- 푸시하지 않음. Phase D 미완 상태이며 체인지로그·푸시는 계획상 브라우저 증명 이후 단계다.

## [2026-08-04] report | 병합 후 시스템 상태 — cycle 9·10 통합 + 진입 라우팅 피벗

- `origin/main`(176 커밋)을 `feature/first_lee`로 fast-forward 병합(685파일, 충돌 0). 로컬
  `main`은 stale(244 behind)이라 대상이 아니었다. 병합이 cycle 9(코어 루프)·cycle 10(스테이지
  던전)과 회고에 없던 진입 라우팅 피벗을 현재 브랜치로 가져왔다.
- 코드에서 재분석해 `wiki/reports/2026-08-04-post-merge-system-state.md`를 추가하고 `index.md`
  Overview·Reports를 갱신했다.
- **가장 큰 구조 변화 [OBSERVED]**: Pages 루트(`index.html`)가 Three.js 캠페인에서 2.5D 스프라이트
  아레나(`sprite-2-5d.js`)로 피벗. 기존 캠페인은 `campaign.html`(`app.js`)로 이동해 보존. 오타본
  `abbysal-oneline.html`은 정본으로 리다이렉트. 시드 `intake/seed-sprite25d-entry-routing.md`.
- **신규 런타임 모듈 3종 [OBSERVED]**: `sprite-2-5d.js`(무자산 2D 캔버스 아레나, 절차적 오디오,
  종료 시 `abyssal-oneline.html`로 전환), `defense-speech-bubble.js`(캠페인 서사를 음성→월드
  말풍선으로 교체, `defense-audio.js` 이벤트 집합과 동일 불변식), `sealbound.js`(독립 프로토타입
  라우트 `sealbound.html`).
- **게이트 [carried]**: 두 회고 모두 어떤 게이트도 PASS로 만들지 않았다 — 설계·자산은 측정이
  아니며 G4/G7/G8은 사람 플레이 판정 대기. drop/buff 스펙 §9 결정성 7체크 종결 여부는 이 세션이
  재측정하지 않았다.
- **이 세션 실측 [OBSERVED]**: 정적 서버(127.0.0.1:8000)에서 `/`·`/campaign.html`·`/sprite-2-5d.js`·
  `/sealbound.html` 모두 200; 서빙된 루트가 `src="sprite-2-5d.js"` 참조; 루트 브라우저 부팅 시
  console/page 에러 0, `<canvas>` 1개, `hasThree:false`. 이 절 밖의 수치는 모두 [carried]다.
- 커밋·푸시하지 않음. 볼트 문서(reports/index/log)만 갱신했다.
