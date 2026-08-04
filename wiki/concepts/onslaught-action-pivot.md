# Onslaught action pivot (unapproved, in-design)

**Type:** concept — product direction change
**Run ID:** `20260728-onslaught-action-pivot`
**Status:** `[TARGET]` — design contract, not a measurement. **No gate has passed.**
**Authority:** `_workspace/current/design/master-numeric-contract.md`
**Supersedes (design-only, not yet live):** the two design docs deleted from `docs/` in this cycle

Entity: [[wiki/entities/abyssal-surge]]

## Why this page exists

During this run another session deleted the repository's only product-contract
docs (`docs/abyssal-command-defense-survivor-design.md`,
`docs/abyssal-surge-production-cycle.md`) while drafting a genre pivot. As of
this ingest, **no top-level doc states "what this game is" except README.md**,
which is written for the shipped defense-survivor build and is explicitly
marked stale on the pivot axes. This page is the wiki's placeholder authority
for "what changes, and how far it got" until the pivot is approved and new
product-contract docs are authored (delta doc §9 lists exactly which docs need
rewriting on approval).

## Genre delta (defense-survivor → action hack-and-slash roguelite)

| Axis | Before (shipped) | After (target) |
|---|---|---|
| Genre | mobile single-player defense survivor | mobile single-player action hack-and-slash roguelite |
| Input | movement only, auto-combat | movement + 3 attack verbs + active skills |
| Run length | 26.9–27.7s `[OBSERVED]` | 300–480s `[TARGET]` |
| Fail condition | gate durability 0 | commander death |
| Progression | stage clear | stage clear + growth persists on loss |
| Map | authored fixed coords | seed-based cell placement |
| Narrative | in-game text cutscenes | lobby video/staged images |

**One line:** from watching a gate get defended by autobattle, to directly
cutting/dodging through a 5–8 minute survival run.

## Pillars

- **Kept:** 60Hz deterministic sim as authority; renderer one-way (snapshot
  read-only, `getRunDigest()` immutable); offline local save + JSON
  export/import; no monetization; Abyssal lore proper nouns (Dusk Warden,
  Echo Deep, Moonless Court, Gate Zenith); 10-stage campaign ending at Gate
  Zenith; reduced-motion support; single gameplay plane; full-bleed canvas +
  edge HUD.
- **Dropped:** auto basic attack, gate defense objective, 6-stage objective
  chain, 3-stance formation (`VANGUARD`/`TURRET`/`SPLIT`), objective pressure
  decay, in-game text cutscene relay (moves to lobby media).
  `FORMATION_STANCES` is retired; companions keep only auto-follow + final
  boss-reward elite extraction.
- **New:** combo-cancel melee combat, i-frame dash that preserves combos,
  AoE skills for density, telegraphed dodgeable boss patterns, seed-based
  cell layout, three staggered growth axes, camera/VFX staged over
  readability, lobby media narrative.

## Player loop (5–8 min)

```
DESCENT 30s → SKIRMISH 75s → SURGE 75s → MIDBOSS ~60s (kill-only)
  → BIGWAVE 60s → FINALE ~60s (kill-only)
```
Baseline 21600 tick (360s), band 18000–28800 tick, hard ceiling 32400 tick
(540s) forces an ending. No timeout-victory path exists for FINALE.

## Gate status (2026-07-28 review cycle)

| Gate | Prior `[OBSERVED]` | Current | Reason |
|---|---|---|---|
| G1 lore | PASS | unaffected | proper nouns/order kept, only delivery medium changes |
| G2 balance | FAIL | re-measure required | 5–8min balance unrelated to 27s measurement |
| G3 formation | FAIL | redefine | stances → category loadout |
| G4 immersion/accessibility | PASS (lobby) | re-measure required | HUD fully changed |
| G6 ops/perf | FAIL | re-measure required | bigwave 60 units × VFX |
| G7 core loop | BLOCKED | redefine | 30–180s → 300–480s |
| G8 first exposure | BLOCKED | re-measure required | new input learning curve |

**No gate moved to PASS this cycle.** Design documents are not measurements.

## Process state

- Cycle 1 (design): complete — 11 design docs + `master-gdd-delta.md` all done.
- Cycle 2 (director review): complete — decision `D-20260728-OAP-01` approves
  **planning/implementation order only**, not any gate.
- Director explicitly deferred updating README's public product description
  until slice 2 gets a human playtest verdict. Do not represent unimplemented
  pivot targets as current features anywhere outside `_workspace/current/`.
- Next physical step: implement slice 1 (movement/camera) per
  `_workspace/current/engineering/migration-map.md#9`, then slice 2 (combat
  verbs) with a real-browser human playtest gate before any further slice.

## Cross-references

- `_workspace/current/design/master-gdd-delta.md` — full delta (this page is a synthesis, not a replacement)
- `_workspace/current/design/onslaught-action-product-contract.md` — SSOT product contract
- `_workspace/current/production/task-manifest.md` — task/gate ledger
- `_workspace/current/production/decision-log.md#D-20260728-OAP-01` — approval record
