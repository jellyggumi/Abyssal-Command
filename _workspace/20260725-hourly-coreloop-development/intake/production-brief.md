# Production Brief — Hourly Core-Loop Development

run-id: `20260725-hourly-coreloop-development` · director · 2026-07-25

## bmad-gds intake schema

| field | value |
|---|---|
| game_type | Mobile-first, single-player 2.5D/WebGL defense-survivor RPG: a Warden commands a defensible lane, converts decisive combat into persistent growth, then returns with a changed build |
| team_shape | Solo operator + materialized Game Studio Harness team: director, designer, PM, programmer, QA |
| engine | Vanilla JS + three.js WebGL on static GitHub Pages; Blender and GLB assets for 3D authoring |
| current_stage | **Stage 2 re-entry — retune / develop**. The verified prior cycle ruled out a concept restart: the execution, not the core premise, fails the gates. |
| next_public_beat | A playable vertical slice where loss is possible, `EXTRACT_ELITE` is an intentional player decision, commander defense/offense/RPG growth changes the outcome, and the 3D stage presents the canon palette, readable lanes, and motion. |
| source_packet | `20260725-wellmade-verification` gate review and Tier-0/Tier-1 backlog; 51 deployed GLBs; WebGL renderer; deterministic simulation; live mobile UX baseline; generated original stage concept `/tmp/abyssal-command-stage-concept.png`. |
| main_constraint | The main tree is dirty from a separate in-flight rig pass. Hourly automation must use an isolated worktree, never delete `_workspace/` artifacts, never overlap a run, and refuse a dirty worker tree. |
| main_question | Every hour, what smallest evidence-backed change most improves intuitive defense/offense choice, RPG growth consequence, 3D asset utility, stage atmosphere, controls, or mobile readability — while preserving determinism and gate evidence? |

## Operating mode — ONE mode this cycle

**Stage 2 retune / develop.** Each hourly run may execute exactly one eligible
vertical slice from `production/task-manifest.md`: QA discovery → design/PM
numbers → programmer implementation → QA re-measurement. It must not invent a
new concept, mass-replace assets, or enter Stage 3 until Stage-2 exit evidence
exists.

## Hourly working rule

A run is productive only if it emits all of:

1. one reproducible input/evidence reference;
2. one bounded change or an explicit no-change decision;
3. its targeted test or measurable scenario;
4. a task-manifest update and short retrospective note;
5. a wiki note through Obsidian.

If any preflight fails, the run records `skipped` with the reason and changes
nothing.
