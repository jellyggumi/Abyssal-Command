# Stage map composition — echo-throne (prompts 00 / 02 / 03-verify)

Base: `origin/main` @ `5cc82bf6`, stacked on `feat/abyss-chancel-composition`.
Source: `_workspace/current/design/stage-dungeon-composition-spec.md` §2.3, §3.4, §5.3, §5.4 — the
last of the three compositions the cycle-10 retrospective recorded as scoped.

Bound coordinates untouched: encounter objectives `(15200, 6000)` and `(18000, 6000)`, occupation
`(18400, 6000)`, extraction `(16200, 7600)`, hazard, the four quest points, the canonical gate and
the walkable bounds are exactly as shipped.

## What the stage now is

Five slabs: a west narthex, two galleries that are **exact mirrors about `y = 6000`**, the sovereign
aisle between them, and an undivided east crescent court holding the dais, the occupation and the
gate. The mirror is arithmetic, not a promise — `y' = 12000 − y` maps any gallery point onto the
same point in the other.

- **Critical route** (corridor 1400): `1800,6000 → 15200,6000 → 18000,6000 → 22000,6000`. Both
  intermediate waypoints sit exactly on the encounter objective points, and the route runs down the
  mirror axis itself.
- **Detour** (corridor 900): `7800,2200 → 12400,9800 → 19200,9200`. It enters the north gallery,
  cuts the sovereign aisle at `(10100, 6000)` under fire, and exits through the south gallery — the
  detour physically performs the stage's mirror.
- 13 props, 7 of them obstacles; the west and east fractured wings share radius 650 at the same
  `y = 9000` as the crescent's two horns; 4 motivated lights; 5 fog breaks, one per slab.

`fractured-dais-prop` moves to `(19200, 7600)` and shrinks **r900 → r700**. The cycle-10
retrospective flagged this as load-bearing and it is: keeping r900 at that position fails the
critical route by −700. At r700 the same position clears it by 200.

## Verification

`node scripts/search-stage-dungeon-layout.mjs echo-throne --verify` → **PASS**, route margin 200,
5922 reachable cells. All three stages pass the same filter set:

| Stage | verdict | min world-route margin | reachable cells |
|---|---|---|---|
| cinder-span | PASS | 50 (authored parapet vs detour) | 5512 |
| abyss-chancel | PASS | 419 | 5858 |
| echo-throne | PASS | **200** | 5922 |

The 200 reproduces the spec's own claimed `+200.00` exactly, as chancel's 301.24 did. The filter set
now includes spawn-approach clearance, so this is a stronger pass than the spec's harness gave:
throne's two spawn overlaps (`fractured-dais` −19, `gallery-debris` −75) were corrected in the
preceding commit and the re-authored positions clear every path.

## Pacing

`node scripts/measure-stage-pacing.mjs echo-throne 3 12 19 37`:

| build | seed 3 | 12 | 19 | 37 | outcome | peak living | peak committed (cap 4) |
|---|---|---|---|---|---|---|---|
| `origin/main` | 209 s | 217 s | 210 s | 213 s | complete | 10–11 | 4 |
| this branch | 222 s | 219 s | 209 s | 212 s | complete | 10–11 | 4 |

Unchanged inside the doctrine window. Throne already completed on `main`; the composition re-authors
the space without moving the fight's shape — which is the correct outcome for a stage whose pacing
was already inside band.

## Landmark ids

`landmark.throne-dais` and `landmark.throne-aisle` keep their ids, deviating from the spec's rename,
because `STAGE_PRESENTATION_BY_ID` in `defense-catalog.js` addresses them by id for the Seal Atlas.
The other four take the spec's names. Same deviation, same reason, as chancel.

## Not in this change

- The five throne gimmicks in spec §4.4 (returning aisle, dais command echo, crescent gallery
  shutters, domain command ring, sovereign command shear) are simulation features, not layout.
- `terrainTiles` / slab ids and the §6.1 validator extension are a separate additive change; this
  commit authors only what today's schema holds.
- Seam inlay geometry (§6 R11) remains unbuilt; the floor is provably coplanar, so it is a
  presentation question, not a collision one.
