# Stage map composition — abyss-chancel (prompts 00 / 02 / 03-verify)

Base: `origin/main` @ `5cc82bf6`, stacked on `feat/cinder-span-dungeon-layout`.
Source of the layout: `_workspace/current/design/stage-dungeon-composition-spec.md` §2.2, §3.3, §5.2,
§6 — the composition the cycle-10 retrospective recorded as **scoped, not todo**, together with its
own warning that it must land as one atomic commit (props + landmarks + anchors + obstacles +
routes), because its routes are illegal against the previously authored props.

Bound coordinates are untouched: encounter objectives `(15000, 6000)` and `(17600, 8200)`,
occupation `(18200, 5200)`, extraction `(16000, 7000)`, hazard, the four quest points, the canonical
gate and the walkable bounds are all exactly as shipped, so the quest-point equality contract holds
byte-for-byte.

## What the stage now is

Four chambers threaded by a route that crosses its own fork:

| Slab | Band | Role |
|---|---|---|
| 01 West Processional Narthex | x 600–8000 | ingress, processional approach, first cover |
| 02 Nave Crossing | x 8000–16400 | objective 1, the mirror aisle, extraction |
| 03 North Oath Apse | x 16400–23400, y 700–7200 | occupation, gate, boss |
| 04 South Transept Arm | x 16400–23400, y 7200–11300 | objective 2, three-way junction |

The critical route (corridor 1400) is `1800,6000 → 15000,6000 → 17600,8200 → 22000,6000`: its two
intermediate waypoints **are** the two encounter objective points, and it crosses the `y = 7200`
fork twice — down into the transept arm, back up to the apse. The detour (corridor 900) moves to the
northern mirror aisle `6200,2600 → 12000,1800 → 19800,2600`: shorter, lit, and exactly the answer
the stage quest asks the player to refuse.

13 props (7 of them obstacles), 6 landmarks, 4 motivated lights, 4 fog breaks — one readable pocket
per slab.

## The defect this composition would have shipped

The spec's clearance arithmetic covered the world catalog's own routes. It never checked
`STAGE_ENCOUNTER_ROUTES[...].paths` — the per-direction spawn approaches — because `validateProfile`
does not check them either. Two authored circles landed on top of them [OBSERVED]:

| Obstacle | Blocks | By |
|---|---|---|
| `narthex-debris` (6000, 9400) r500 | `chancel-south-entry` (6200, 9800) r400 — the SW spawn entry | **−453** |
| `nave-seal` (12200, 3400) r820 | `chancel-nave-north` (11600, 4400) r400 — the NW approach | **−54** |

The module still imported cleanly and every stage suite stayed green, but a measured bot run
collapsed:

| seed 9, 8-minute cap | spawns | waves cleared | mid-bosses | boss | avg living |
|---|---|---|---|---|---|
| `origin/main` | 81 | 7 | 2 | — | 3.40 |
| spec as authored | **27** | **1** | 1 | — | 8.08 |
| after the fix below | **83** | **10** | 2 | **1** | 3.70 |

Fix, minimal and measured: `narthex-debris` moves to `(6000, 8400)` (clears the SW entry by 514) and
`nave-seal` to `(13000, 3600)` (clears the NW approach by 392 and the detour by 419). Both stay
inside their authored slab and keep the spec's radii and roles; `landmark.chancel-nave` follows the
seal.

## Verification of the authored layout

`node scripts/search-stage-dungeon-layout.mjs abyss-chancel --verify` → **PASS**, route margin 419,
5858 reachable cells. Filters: bounds, gate keep-clear, world-route corridor, prop-pair separation,
visibility anchors, spawn-approach clearance, flood-fill reachability.

| Measurement | Value |
|---|---|
| min world-route margin | 418.58 (`nave-seal-prop` vs the detour) |
| min spawn-path margin | 392 (`nave-seal` vs `chancel-nave-north`) |
| min gate margin | 858.32 |
| min anchor-vs-obstacle margin | 492.22 |
| min prop-pair separation | 1440.35 |

Landmark ids: `landmark.chancel-apse` and `landmark.chancel-nave` keep their ids, deviating from the
spec's rename, because `STAGE_PRESENTATION_BY_ID` in `defense-catalog.js` addresses them by id for
the Seal Atlas. The other four take the spec's names.

## Pacing

`node scripts/measure-stage-pacing.mjs abyss-chancel 9 5 3 71`:

| build | seed 9 | 5 | 3 | 71 | outcome | peak committed (cap 4) |
|---|---|---|---|---|---|---|
| `origin/main` | 325 s | 325 s | 325 s | 325 s | never completes — bot ends in gate-defense | 4 |
| this branch | 199 s | 201 s | 204 s | 203 s | **complete** on every seed | 4 |

The stage is now finishable by the objective-seeking bot inside the 180–360 s doctrine window. That
is a behaviour change the composition earned: the critical route now leads through the objectives
instead of past them, and all three spawn lanes are open.

## Carried into the next pass

- The same verifier found two spawn-path overlaps on `echo-throne`
  (`fractured-dais` −19 vs `throne-bind-approach`, `gallery-debris` −75 vs `throne-north-entry`).
  Both are corrected in this branch as a separate commit; the throne composition itself
  (5 slabs, 13 props, mirrored galleries) is still scoped and untouched.
- The chancel gimmicks in spec §4.3 (mirror answer aisle, transept three-way lock, oath ring
  shortcut, classification craze) are simulation features, not layout, and are not in this change.
