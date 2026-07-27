# Retained Workspace Lineage

**Retained run:** `20260726-stage2-balance-agency`  
**Foundation run:** `20260723-solo-warden-rpg-concept`  
**Foundation commit:** `cc73402`  
**Retention policy:** one workspace run remains under `_workspace/`; superseded run directories are not recreated.

## What this run is

This folder is the single retained production record from the 2026-07-23 concept through the 2026-07-26 Stage 2 balance and agency work. The Stage 2 run extends the initial concept; it does not replace the world, campaign, deterministic simulation contract, or offline/no-commerce boundary.

The compact foundation snapshot is `design/foundation-20260723-concept.md`. For exact historical text, use the immutable source paths at commit `cc73402`:

- `_workspace/20260723-solo-warden-rpg-concept/design/worldview.md`
- `_workspace/20260723-solo-warden-rpg-concept/design/core-loop.md`
- `_workspace/20260723-solo-warden-rpg-concept/design/UNIFIED-GDD.md`
- `_workspace/20260723-solo-warden-rpg-concept/intake/production-brief.md`
- `_workspace/20260723-solo-warden-rpg-concept/production/task-manifest.md`
- `_workspace/20260723-solo-warden-rpg-concept/production/decision-log.md`

Use `git show cc73402:<path>` to inspect those historical artifacts without restoring a second workspace directory.

## Development carried into Stage 2

| Area | Current retained evidence |
|---|---|
| Current operating scope and owners | `production/task-manifest.md` |
| Current gate state and balance proposal | `design/balance-sheet.md`, `design/core-loop.md`, `design/novelty-scorecard.md` |
| Reward and fairness boundary | `pm/reward-bands.md`, `pm/revenue-forecast.md`, `pm/negotiation-record.md` |
| Runtime/data and extraction analysis | `engineering/extraction-agency-analysis.md` plus the runtime files named by the manifest |
| Baseline measurements and exploit register | `qa/gate-measurements.md`, `qa/exploit-register.md`, `qa/playtest-report.md`, `qa/test-plan.md` |
| Stage 2 director decisions | `production/decision-log.md` |
| QA and PM communications | `messages/001-qa-baseline.md` and `pm/negotiation-record.md` |

## Canonical authority

1. The current retained run is authoritative for Stage 2 status, measurements, and approved changes.
2. `design/foundation-20260723-concept.md` is the continuity index for the initial concept; it is not a second live GDD.
3. The immutable `cc73402` paths are historical evidence only. Do not copy their old gate labels into current reports.
4. Runtime behavior and deterministic simulation tests remain the authority for shipped behavior; documents cannot promote an unmeasured gate.

## Completion check for the one-folder cleanup

- The only workspace run directory retained in the working tree is `_workspace/20260726-stage1b-cinder-pressure-agency/`.
- Initial concept provenance is retained through `design/foundation-20260723-concept.md` and its immutable commit references.
- Current Stage 2 artifacts remain in their existing domain folders; no superseded run directory is required for traceability.
