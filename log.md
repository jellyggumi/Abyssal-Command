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
