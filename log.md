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
