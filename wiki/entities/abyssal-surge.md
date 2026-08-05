# Abyssal Surge (Abyssal-Command)

**Type:** entity — game product
**As of:** commit `12c550b` (2026-07-29)

## Current shipped build

Mobile-first single-player **defense survivor**. Player moves Dusk Warden;
basic attack/targeting is automatic. XP-driven run skill picks, elite
extraction into permanent companions, 10-stage campaign ending at Gate
Zenith. Deterministic 60 Hz simulation, Three.js/WebGL renderer with Canvas
2D snapshot-contract fallback (`battle-visualizer.js`). Offline local save,
JSON export/import only — no accounts, cloud sync, or monetization.

Canonical contract: `README.md` (§플레이 계약, §기술 계약). The two prior
standalone design docs — `docs/abyssal-command-defense-survivor-design.md`
and `docs/abyssal-surge-production-cycle.md` — were **deleted** in the
2026-07-28 merge; README.md now carries an explicit notice that it is the
valid summary for the current deployed build.

## In-design direction change (unapproved)

A genre pivot to an **action hack-and-slash roguelite** ("Onslaught") is in
active design under `_workspace/current/`, run-id
`20260728-onslaught-action-pivot`. Design-phase complete, director scope
approval given for *planning/implementation order only* — **no quality gate
has passed**. See [[wiki/concepts/onslaught-action-pivot]] for the full
delta. Do not treat pivot numbers as current game behavior.

## Asset production pipeline

Character assets (concept art → T-pose → 3D mesh → rig → motion → audio) run
through a fixed pipeline with one tool per asset class (see CLAUDE.md §3).
See [[wiki/concepts/character-3d-asset-pipeline]].

## Key repo-relative references

- `README.md` — current public contract
- `CLAUDE.md` — repository operating rules ([[wiki/sources/claude-md-operating-contract]])
- `docs/concept-to-web-game-3d-pipeline.md` — asset pipeline ([[wiki/sources/concept-to-web-game-3d-pipeline]])
- `_workspace/current/design/master-gdd-delta.md` — pivot delta
- `_workspace/current/production/task-manifest.md` — pivot gate status
