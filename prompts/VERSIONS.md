# Prompt versions

One row per approved prompt version. A prompt that encodes a repository invariant must be revised in
the same commit that changes the invariant.

| Prompt | Version | Date | Source | Bound to | Change |
|---|---|---|---|---|---|
| `approved/00-stage-map-blueprint.md` | v1 | 2026-07-31 | custom + prompts.chat C.R.A.F.T. | `stage-world-catalog.js` `validateProfile`, `ARENA` in `defense-catalog.js` | Initial. Band grid derived from the three shipped profiles. |
| `approved/01-encounter-progression.md` | v1 | 2026-07-31 | `/skill:design-game-encounters` + C.R.A.F.T. | `STAGE_ENCOUNTER_ROUTES`, `STAGE_TACTICS`, `STAGES` | Initial. Objective/wave/cap envelope from the three shipped stages. |
| `approved/02-stage-world-authoring.md` | v1 | 2026-07-31 | `/skill:author-game-levels` + C.R.A.F.T. | `validateProfile` lines 382-563 of `stage-world-catalog.js` | Initial. All 24 validator clauses inlined. |
| `approved/03-procedural-layout.md` | v1 | 2026-07-31 | prompts.chat `Act as a Procedural Content Generator` (CC0) | `validateProfile` obstacle/route clearance clauses | Initial. Retargeted from infinite 2D caves to a bounded, hand-curated 24000x12000 plane. |
| `approved/03-procedural-layout.md` | v2 | 2026-07-31 | same | + `STAGE_ENCOUNTER_ROUTES[].paths` | Added the spawn-approach clearance filter after the authored abyss-chancel layout blocked `chancel-south-entry` by 453 units, and required `--verify` to pass on the final authored layout. |
| `approved/04-stage-dressing-assets.md` | v1 | 2026-07-31 | catalog §5 + `CLAUDE.md` §3 | prop count 8-14, provenance rule | Initial. |
| `approved/05-vfx-and-budget.md` | v1 | 2026-07-31 | `/skill:create-game-vfx`, `/skill:optimize-threejs-games` | `vfxCue` path/clip contract | Initial. |
| `approved/06-regression-and-proof.md` | v1 | 2026-07-31 | `/skill:test-playable-web-games` + `CLAUDE.md` §6 | `tests/**/*.test.mjs` | Initial. Records the 2026-07-31 baseline, including the pre-existing `stage-wave-doctrine` failure. |
| `approved/07-release.md` | v1 | 2026-07-31 | `/skill:ship-web-games` | `CLAUDE.md` §5 git safety | Initial. |
| `RUNBOOK.md` | v1 | 2026-07-31 | derived from code | `STAGES`, `STAGE_TACTICS`, `STAGE_ENCOUNTER_ROUTES`, `STAGE_WORLD_PROFILES`, `STAGE_STORIES` | Initial. Resolves every `${placeholder}` for stages 1-3; cross-checked against the catalogs by script on 2026-07-31. |

## Known limitations

- The band grid in `00` is descriptive of the three shipped stages, not a proof that a fourth stage
  must use it. A stage that departs from it must still clear `validateProfile` and every suite in
  `06`; departures are recorded here.
- `03` cannot emit runtime data directly. WFC/BSP/Dungeon Architect output is a *proposal*; only a
  human-curated transcription into `stage-world-catalog.js` is authoritative.
- `RUNBOOK.md` is a transcription of code. When a catalog value changes, re-run the cross-check
  script in `log.md` (2026-07-31 runbook entry) rather than editing the table from memory.
- `04` cannot promote generated meshes on its own. `CLAUDE.md` §3 requires an adjacent
  `.provenance.json` with `runtimeEligible: false` and an explicit audit before runtime use.
