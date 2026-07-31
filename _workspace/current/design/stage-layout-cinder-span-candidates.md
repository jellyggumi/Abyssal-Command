# Stage layout candidates — cinder-span, phase 1 (prompt 03)

Prompt: `prompts/approved/03-procedural-layout.md` v1.
Generator: `node scripts/search-stage-dungeon-layout.mjs cinder-span --seeds 12` [OBSERVED 2026-07-31].
Base: `origin/main` @ `012ea15d` (cycle-10 layout pass already landed).
The generator proposes; it never writes runtime data. The recommended candidate was transcribed into
`stage-world-catalog.js` by hand.

## Algorithm

Seeded module placement, not free-form noise. The vocabulary is eight architectural slots: the six
cycle-10 obstacles, declared **frozen** (zero jitter, exact authored radii), plus the two jittered
ingress gatehouse pillars. Each slot carries a pinch partner, and the adjacency constraint is that
two facing pillars must leave a readable doorway across the critical route. Seeds are
`(index + 1) * 7`, RNG is mulberry32, placements snap to a 100-unit grid and radii to 20 units, so a
seed reproduces exactly.

Rejection filters, applied before any candidate is shown:

1. walkable-bounds containment of the full footprint;
2. `hypot(x - 22000, y - 6000) >= radius + 900` for every obstacle (canonical gate);
3. `pointSegmentDistance(entity, segment) >= radius + corridorWidth / 2` for every solid against
   every authored route segment — critical route at half-width 700, detour at 450;
4. pair separation `>= rA + rB` across obstacles and the kept beacon props;
5. visibility anchors clear every obstacle by `radius + 300`;
6. flood fill on a 200-unit grid from the ingress cell must reach every protected anchor and the gate;
7. newly placed geometry must clear the routes by at least 300 units. Frozen geometry is exempt and
   only reported: the cycle-10 parapet sits 50 units from the detour corridor and phase 1 does not
   move it.

Score = doorway tightness inside the readable 2400–4600 band, plus the new-geometry route margin
capped at 900.

## Seed results [OBSERVED]

Pinch gaps: ingress (new) / relay (frozen) / threshold (frozen).

| seed | verdict | new-geometry margin | frozen margin | pinch gaps | reachable cells | score |
|---|---|---|---|---|---|---|
| 7 | pass | 953 | 50 | 4461 / 4778 / 4147 | 5516 | 1492 |
| 14 | pass | 1013 | 50 | 3616 / 4778 / 4147 | 5539 | 2337 |
| 21 | pass | 886 | 50 | 3995 / 4778 / 4147 | 5527 | 1944 |
| 28 | pass | 713 | 50 | 3281 / 4778 / 4147 | 5521 | 2485 |
| 35 | pass | 1050 | 50 | 3856 / 4778 / 4147 | 5528 | 2097 |
| **42** | **pass** | **918** | 50 | **3424** / 4778 / 4147 | 5512 | **2529** |
| 49 | pass | 919 | 50 | 3834 / 4778 / 4147 | 5528 | 2119 |
| 56 | pass | 1025 | 50 | 3841 / 4778 / 4147 | 5511 | 2112 |
| 63 | pass | 981 | 50 | 4401 / 4778 / 4147 | 5533 | 1552 |
| 70 | REJECT — hairline corridor, new geometry clears the route by 189 | 189 | 50 | 4898 / 4778 / 4147 | 5527 | — |
| 77 | pass | 865 | 50 | 3904 / 4778 / 4147 | 5519 | 2014 |
| 84 | pass | 611 | 50 | 4201 / 4778 / 4147 | 5529 | 1463 |

Survivors: 11 / 12.

## Recommendation — seed 42

- **3424** units is the tightest doorway among the survivors that still keeps a comfortable route
  margin. Seed 28 is tighter (3281) but pays for it with a 713-unit margin; seeds 7/63 open to
  ~4400, which reads as "two rocks", not a gate.
- It keeps a **918**-unit clearance for the new geometry, so phase 2 can re-theme the pillars
  without re-deriving clearance from scratch.
- It leaves both frozen doorways untouched, so the cycle-10 layout keeps its authored reading.
- The detour still runs outside the doorway and never becomes the faster path to the gate.

## Transcribed candidate

```js
obstacle("cinder-span:ash-gatehouse-south", 7600, 8000, 740, "cinder-span:ash-gatehouse-south-prop"),
obstacle("cinder-span:ash-gatehouse-north", 7800, 3000, 840, "cinder-span:ash-gatehouse-north-prop"),

prop("cinder-span:ash-gatehouse-north-prop", CINDER_RESOURCES.features, "wall", 7800, 3000, 0, 1.5708, 840, "terrain-cinder-span-feature-039"),
prop("cinder-span:ash-gatehouse-south-prop", CINDER_RESOURCES.props, "wall", 7600, 8000, 0, 1.5708, 740, "terrain-cinder-span-prop-030"),
```

Both pillars re-use the pack nodes their source props already addressed — `feature-039` (1412 tris,
formerly the south forge teeth) and `prop-030` (formerly the north ash talon) — scaled to their new
wall footprints by `fitFootprint`. Prop count stays 12 and the pinned node list is unchanged.
