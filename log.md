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
