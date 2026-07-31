# Stage map blueprint — cinder-span, phase 1 (prompt 00)

Prompt: `prompts/approved/00-stage-map-blueprint.md` v1. Runbook: `prompts/RUNBOOK.md`.
Base: `origin/main` @ `012ea15d`, i.e. **after** the cycle-10 layout pass that promoted three frozen
cinder props to obstacles. This blueprint is additive to that work and does not move any of it.

Phase 1 rule agreed with the owner: **every bound coordinate is frozen.** Objectives, occupation,
extraction, hazard, quest points, routes, bounds and the canonical gate do not move. Per-stage
concept re-theming is phase 2.

## Brief

`cinder-span` teaches one thing: *the route is a corridor you hold, not a field you roam*. Cycle 10
gave the plane six obstacles, but they are scattered cover — debris north, debris south, the forge
arch and parapet pair, and the two ash walls near the gate. What the map still lacked was a
**doorway**: a place where the corridor visibly narrows and the player has to commit. Phase 1 builds
exactly one, at the ingress band, out of props that already exist.

## Frozen anchors [OBSERVED]

| Anchor | Coordinate |
|---|---|
| ingress | (1800, 6000) |
| critical intermediate-objective / intermediate-gate | (14600, 5200) / (17400, 6400) |
| final gate | (22000, 6000) — keep-clear r900 |
| detour entry / objective / exit | (6000, 10600) / (13200, 10700) / (19600, 10700) |
| objective 1 / objective 2 | (14600, 5200) r1100 / (17400, 6000) r1400 |
| occupation / extraction / hazard | (17600, 6000) r900 / (15400, 6000) r1000 / (14800, 6000) r1100 |
| quest points 1–4 | (14600,5200) (17400,6000) (17600,6000) (15400,6000) |
| quest giver | (17100, 2700) |
| motivated lights / fog break | (17600,7400) (15400,7400) (3000,1700) (22500,10100) / (10800,6000) r1500 |
| cycle-10 obstacles (frozen) | relay debris N (5000,10400) r500 · forge arch (12600,2800) r850 · parapet (13200,9300) r900 · relay debris S (15000,1500) r540 · west ash wall (19000,4400) r940 · east ash wall (20800,9900) r700 |

## What phase 1 adds

| Band (X) | Room | Doorway |
|---|---|---|
| 600–6800 | **Ingress Hall** — establishing shot, ingress beacon, relay debris N as first cover | — |
| 7000–8600 | — | **Ash Gatehouse**: north pillar (7800, 3000) r840 ↔ south pillar (7600, 8000) r740; gap **3424** |
| 8800–12000 | **Relay Court** — fog break at (10800, 6000) | — |
| 12600–13200 | — | **Forge Arch** (cycle 10, frozen): gap **4778** |
| 13500–18800 | **Objective Chamber** — objective 1, hazard, extraction, objective 2, occupation | — |
| 19000–20800 | — | **Gate Threshold** (cycle 10, frozen): west ↔ east ash wall, gap **4147** |
| 21000–23400 | **Gate Apron** — gate beacon, final gate | — |

The gatehouse is built by re-placing two background props that carried no collision:
`south-forge-teeth-prop` → `ash-gatehouse-north-prop`, `north-ash-talon-prop` →
`ash-gatehouse-south-prop`. Their pack nodes are unchanged, so the twelve authored pack-node
placements stay twelve and `tests/runtime-visual-assets.test.mjs` keeps its node list.

## Budget

| Element | cycle 10 | phase 1 | Rule |
|---|---|---|---|
| obstacles | 6 | 8 | no validator cap; every obstacle needs a matching prop |
| props | 12 | 12 | pinned at 12 by `tests/runtime-visual-assets.test.mjs` |
| distinct pack nodes | 12 | 12 (same set) | one node per placement, pinned |
| landmarks | 6 | 7 | ≥ 4 |
| motivated lights / fog breaks / VFX cues | 4 / 1 / 1 | unchanged | ≥ 2 / ≥ 1 / exactly 1 |

## Clearance proof

Executed — `node scripts/search-stage-dungeon-layout.mjs cinder-span --seeds 12`, curated seed 42:

```
new geometry vs every route segment    min margin 918  (required: radius + corridorWidth/2, +300 band)
frozen geometry vs every route segment min margin  50  (parapet vs detour, authored by cycle 10)
obstacle vs gate (22000,6000)          min margin 1560 (required: radius + 900)
prop pair separation                   min margin  872 (east ash wall / gate beacon; required: rA + rB)
visibility anchor vs obstacle          min margin  712 (required: obstacle radius + 300)
flood fill from ingress                5512 cells, every protected anchor and the gate reached
```

## What this map deliberately does not do

- No elevation, no second plane: every value stays `elevation: 0`.
- No move of any cycle-10 obstacle, prop placement, route or bound coordinate.
- No balance retune. The measurement showed the doorway does not shift bot pacing
  (190–320 s on both builds, doctrine window 180–360 s), and nothing in the geometry motivated a
  number change, so `STAGE_TACTICS` keeps every value except the `mapVariant` module list.
- No shortcut that skips objective 2, and no re-entry loop that could re-grant a reward.

## Open questions carried into phase 2

1. The gatehouse pillars re-use a forge-teeth and a talon node scaled to wall footprints. Phase 2's
   per-stage concept pass should decide whether stage 1 gets its own gatehouse mesh.
2. Should the detour get its own doorway, or stay a fast lane that trades cover for exposure?
3. `abyss-chancel` and `echo-throne` still need their own module vocabularies.
