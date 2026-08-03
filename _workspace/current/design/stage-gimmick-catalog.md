# Gimmick catalog — the spatial half, machine-checked (spec §4)

Base: `origin/main` @ `5cc82bf6`, stacked on `feat/stage-terrain-tiles`.
Source: `_workspace/current/design/stage-dungeon-composition-spec.md` §4.1–4.5, risks R5 and R12.

## Scope, stated plainly

The spec defines a gimmick as a two-lane feature: **`profile.gameplay.gimmicks[]` carries the
spatial fields only; timing, arming and state live in the simulation.** This change lands the
spatial half and the gates that make it checkable. **Nothing at runtime reads it yet** — the
simulation lane owns `defense-run-simulation.js` and is being worked concurrently, and R12 requires
its consumers to dispatch on `event.type` before reading `telegraphTicks`.

That makes this a contract, not a feature: three other lanes (`EncounterPacing`, `VfxCueDesign`,
`AudioFeedbackDesign`) have already adopted these ids verbatim, so the ids and geometry needed a
source of truth that cannot silently drift.

## The 13 authored gimmicks

| Stage | # | id | class | slab | objective | telegraph | corridor |
|---|---|---|---|---|---|---|---|
| cinder-span | 1 | `ash-causeway-collapse` | deformation | slab-02 | `cinder-relay-crossing` | 180 | 1400 → 900 |
| | 2 | `forge-pressure-vents` | hazard | slab-03 | `cinder-forge-stand` | 60 | — (3 vents) |
| | 3 | `seal-oath-ring` | gate | slab-03 | `cinder-seal` | 90 | — (r900) |
| | 4 | `warden-chain-fall` | deformation | slab-03 | `boss-kill` | 180 | 1400 → 1000 |
| abyss-chancel | 1 | `mirror-answer-aisle` | mirror | slab-02 | `chancel-nave-advance` | 90 | 1400 → 1400 |
| | 2 | `transept-three-way-lock` | gate | slab-04 | `chancel-transept-lock` | 120 | 1400 → 900 (3 bars) |
| | 3 | `oath-ring-shortcut` | gate | slab-03 | `chancel-oath` | 90 | 0 → 900 (adds a lane) |
| | 4 | `classification-craze` | deformation | slab-03 | `boss-kill` | 180 | 1400 → 900 |
| echo-throne | 1 | `returning-aisle` | mirror | slab-03 | `throne-aisle-break` | 90 | 1400 → 1400 |
| | 2 | `dais-command-echo` | hazard | slab-05 | `throne-dais-stand` | 60 | — |
| | 3 | `crescent-gallery-shutters` | gate | slab-05 | `throne-dais-stand` | 120 | 1400 → 900 (2 shutters) |
| | 4 | `domain-command-ring` | gate | slab-05 | `throne-domain` | 90 | — (r800) |
| | 5 | `sovereign-command-shear` | deformation | slab-05 | `boss-kill` | 180 | 1400 → 900 |

Multi-point gimmicks keep the ruled single-`placement` shape and carry their extra footprints in
`satellitePlacements`, so no lane has to learn a second field name.

## What is now machine-checked

Additive clauses in `validateProfile`:

- every gimmick id passes `claimId` — stage-scoped and unique against every other world id;
- `gimmickClass ∈ {deformation, gate, mirror, hazard}`;
- `telegraphTicks` must be on its class tier — deformation 180, gate 120 or 90, mirror 90, hazard 60.
  The spec's whole reason for per-class tiers is that one hardcoded 180 leaves a 60-tick hazard cue
  lingering 120 ticks past its own trigger, telling the player something is still arming after it
  fired;
- `slabId` must name a real terrain tile **and the footprint must sit inside that tile's rect** —
  the coupling the previous PR's `terrainTiles` made possible;
- `objectiveId` must be a real target: an encounter objective, the occupation point, or `boss-kill`;
- **V17**: any gimmick that declares a corridor change must leave `corridorWidthAfter >= 900`.
  `COMMANDER.radius` is 360, so the commander's diameter is 720; the validator's generic corridor
  floor of 600 is *narrower than the actor it admits*. The spec asked for this to become a real gate
  rather than an arithmetic claim, and it is one now;
- a declared narrowing may not widen the corridor;
- every authored objective must have a bound gimmick, and each stage needs a deformation gimmick.

## Proof the clauses are not decorative

`tests/stage-gimmick-catalog.test.mjs`, four mutations of the real catalog imported through the
live validator [OBSERVED]:

| Mutation | Result |
|---|---|
| `warden-chain-fall` narrowed 1400 → 800 | rejected — `Gimmick narrows below the commander floor` |
| `ash-causeway-collapse` moved to x 18400 (out of slab-02) | rejected — `Gimmick footprint leaves its own slab` |
| `seal-oath-ring` pointed at `slab-09` | rejected — `Gimmick names an unknown slab` |
| `classification-craze` retargeted off `boss-kill` | rejected — `Every authored objective needs a bound gimmick` |
| `mirror-answer-aisle` telegraph 90 → 180 | rejected — `Gimmick telegraph is off its class tier` |

Positive tests cover objective coverage and ordering, the V17 floor against `COMMANDER.radius` read
from the catalog rather than hardcoded, per-slab containment, and a cross-check that the two ring
gimmicks sit exactly on their occupation centres with exactly the occupation radius
(`cinder-seal` r900, `throne-domain` r800).

## Evidence

- New suite 5/5; stage suites 50/50; gate checks 11/11 — **no digest movement**, since nothing in
  the simulation reads the new field yet.
- Full `node --test 'tests/**/*.test.mjs'`: **616 tests, 586 pass, 5 fail, 25 skipped** — the same
  five pre-existing failures verified red on a pristine `origin/main` worktree.

## What the simulation lane still owns

Arming, triggering, the `gimmickRng` derived stream (`seed ^ 0xc2b2ae35`, distinct from the three
claimed constants), the one-trigger-per-tick rule, `GIMMICK_ARMED` / `GIMMICK_TRIGGERED` /
`GIMMICK_RESOLVED` events, and the R12 dispatch discipline: read `telegraphTicks` only after keying
on `event.type`, because `ENCOUNTER_PATH_CONTESTED` already carries that field for 120–139 bodies
per stage and a type-agnostic reader would starve the 24-slot VFX pool.
