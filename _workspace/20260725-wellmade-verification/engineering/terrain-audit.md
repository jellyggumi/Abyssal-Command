# Terrain Audit — director direct measurement (2026-07-25)

Method: direct GLB parse of all 10 stage terrains + Blender front-ortho renders
(`/tmp/pose-audit/`). **Caveat stated up front:** these are front-orthographic
flat-lit renders. The game uses a perspective orbit camera at an angle with a
PMREM environment and a stage palette tint, so in-game appearance differs.
VisualG4 owns the in-game readability verdict; this is the geometry inventory.

## Inventory

| # | stage | tris | parts | part naming |
|---|---|---|---|---|
| 1 | cinder-span | 356 | 8 | `Cube.011`–`Cube.016` + 2 named |
| 2 | veil-citadel | 224 | 8 | `Cube.017/018`, `Icosphere.015/016`, `Cylinder.010/011` + 2 named |
| 3 | **echo-throne-steps** | **108** | 5 | `Cube.019`–`Cube.021` + banner pole/cloth |
| 4 | sunken-bastion | 552 | 7 | all named (`bastion-*`) |
| 5 | howling-sprawl | 248 | 6 | all named (`sprawl-*`) |
| 6 | glass-necropolis | 120 | 6 | all named (`necropolis-*`) |
| 7 | starless-canal | 388 | 9 | all named (`canal-*`) |
| 8 | shattered-causeway | 460 | 6 | all named (`causeway-*`) |
| 9 | abyss-chancel | 656 | 7 | all named (`chancel-*`) |
| 10 | gate-zenith | 1,008 | 8 | all named (`zenith-*`) |

Total terrain geometry across the whole campaign: **4,120 triangles** — less
than a third of one trash enemy (`guard`, 11,043 body tris).

## Finding T1 — terrain is untextured primitive geometry

`textures: 0`, 3–4 materials each, 108–1,008 tris. The renders show boxes,
cylinders, spheres and a torus. Stage 3 (`echo-throne-steps`, 108 tris) renders
as a single small marker at this framing.

The consequence is a scale mismatch rather than an absolute quality problem: a
15,000–39,000-triangle sculpted character stands on a 108–1,008-triangle grey
primitive. Whatever the camera angle, the character and its ground plane are
authored at two entirely different fidelity tiers.

## Finding T2 — three stages leaked Blender default part names

`cinder-span` (`Cube.011`–`Cube.016`), `veil-citadel` (`Cube.017/018`,
`Icosphere.015/016`, `Cylinder.010/011`) and `echo-throne-steps`
(`Cube.019`–`Cube.021`) ship with auto-generated primitive names, while the
other seven use a deliberate `<stage>-<element>` convention
(`bastion-flooded-floor`, `canal-floodgate`, `zenith-gate-ring-outer`, …).

Cosmetic in isolation, but it marks exactly which stages were built by hand
without passing through the naming pass the other seven got — a useful signal
for where authoring attention stopped.

## Finding T3 — geometry budget rises with stage number, and that is correct

1,008 tris at `gate-zenith` (stage 10) vs 108 at `echo-throne-steps` (stage 3).
The final stage carries ~9x the geometry of the thinnest mid stage. Whether
intentional or incidental, the direction matches the campaign's escalation, so
it is recorded as sound rather than flagged.

## Recommendation

Terrain is the cheapest surface to lift. The whole campaign is 4,120 triangles —
raising every stage to ~5,000 tris with real materials would add ~46,000
triangles total, still one third of the 134,969 triangles that pedestal removal
frees up (`fix-1-pedestal-removal-validated.md`). Net geometry would still fall.

Priority-wise this sits below the character-cast defects: terrain is uniformly
low-detail, which reads as a deliberate style, whereas the character cast is
inconsistent with itself (54%–100% render scale, one flat mauve, a placeholder
player avatar), which reads as unfinished.
