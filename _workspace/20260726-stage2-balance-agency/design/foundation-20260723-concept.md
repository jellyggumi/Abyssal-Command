# Foundation — 2026-07-23 Solo Warden RPG Concept

**Purpose:** retain the initial concept contract inside the single retained workspace without copying stale Stage 1 documents into the Stage 2 source-of-truth.

**Immutable source:** `cc73402` (`20260723-solo-warden-rpg-concept`). The complete historical artifacts remain addressable with `git show cc73402:<path>`; this file is the traceable foundation snapshot, not a replacement for those originals.

## Carried product contract

The 2026-07-26 Stage 2 work is an implementation and measurement continuation of the 2026-07-23 concept, not a new product branch.

- **World and campaign:** Dusk Warden, Echo Deep, Moonless Court, Gate Zenith, and the fixed ten-stage campaign ending at Gate Zenith.
- **Action chain:** `hunt -> extract -> materialize -> capture -> assault` remains the progression vocabulary.
- **Core loop:** defend a gate, recover an Echo, choose growth, occupy the stage, extract an elite, and resolve the boss route.
- **Combat presentation:** camera-follow bird's-eye presentation and a three-stance formation (`VANGUARD`, `TURRET`, `SPLIT`) are presentation/gameplay extensions over the existing deterministic run contract.
- **Simulation boundary:** the 60 Hz simulation remains the authority. Rendering consumes snapshots and must not write back into simulation state or alter `getRunDigest()` inputs.
- **Progression boundary:** the Warden's permanent growth is distinct from run-scoped formation state and companion behavior.
- **Product boundary:** offline/local play, no account dependency, no paid path, no premium currency, no ads, and no gacha.

## Source trace

| Foundation claim | Historical source | Current continuation |
|---|---|---|
| World, canon names, ten-stage order, and verb chain | `cc73402:_workspace/20260723-solo-warden-rpg-concept/design/worldview.md` | `_workspace/20260726-stage2-balance-agency/intake/production-brief.md` and current runtime catalogs |
| Gate-defense/extraction loop and formation change | `cc73402:_workspace/20260723-solo-warden-rpg-concept/design/core-loop.md` | `_workspace/20260726-stage2-balance-agency/design/core-loop.md` |
| Integrated Stage 1 system contract | `cc73402:_workspace/20260723-solo-warden-rpg-concept/design/UNIFIED-GDD.md` | current Stage 2 design, PM, engineering, QA, and production artifacts |
| Initial implementation scope and deterministic snapshot contract | `cc73402:_workspace/20260723-solo-warden-rpg-concept/production/task-manifest.md` | current `production/task-manifest.md` and runtime regression tests |
| Director decisions and arbitration history | `cc73402:_workspace/20260723-solo-warden-rpg-concept/production/decision-log.md` | current `production/decision-log.md`; Stage 2 decisions are appended in the retained run |

## Authority rule

- This snapshot records what Stage 2 carries forward from the initial concept.
- The retained 2026-07-26 artifacts are authoritative for current gate status, approved numeric changes, and measurement evidence.
- Historical Stage 1 statuses must not be read as current gate verdicts. Current gate state is read from the retained run's `design/`, `qa/`, `pm/`, `engineering/`, and `production/` artifacts.
- The old run directory is intentionally not recreated. Its provenance is preserved by the immutable commit reference above and this in-run traceability snapshot.
