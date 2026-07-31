# 00 — Stage map blueprint

- **Version** v1 (2026-07-31)
- **Use when** a stage map is being composed or re-composed and the band layout, gate geometry, and
  anchor budget are not yet fixed.
- **Produces** `_workspace/current/design/stage-map-${stageId}-blueprint.md` — a numeric map skeleton
  that steps 01–03 consume. It produces no code.
- **Placeholders** `${stageId}` (kebab-case, e.g. `drowned-bastion`), `${stageName}`,
  `${sequence}` (1-based), `${motif}` (one-line visual motif), `${silhouetteProfile}`.

---

**CONTEXT:**
You are composing the map skeleton for the Three.js/WebGL browser game *Abyssal Surge —
Abyssal-Command*. The playfield is a single flat plane. Stage geometry is owned by code, not by an
editor: `stage-world-catalog.js` holds the deterministic placement source of truth, `defense-catalog.js`
holds the arena constant and the encounter/tactics data, and `battle-realtime-three.js` renders a
read-only projection of it. Renderer code may never write back into simulation state.

Three stages ship today and every one of them obeys the same skeleton. These are OBSERVED values
read from `stage-world-catalog.js` and `defense-catalog.js` on 2026-07-31:

- Arena: `ARENA = { width: 24000, height: 12000, gateX: 22000, gateY: 6000 }`.
- Walkable bounds: inset from the arena edge — `600..23400` on X; `600..800` to `11200..11400` on Y.
- Critical route: `ingress (1800, 6000)` → `intermediate-objective (x 7200..14600)` →
  `intermediate-gate (x 13800..17400)` → `final-gate (22000, 6000)`; corridor width 1000–1400.
- Optional detour: a single lateral band on the opposite side of the play band —
  y ≈ 10400–10700 (cinder-span, abyss-chancel) or y ≈ 1600 (echo-throne); corridor width 700–900.
- Obstacles per stage: 3–6, radius 500–940. Props: 12 (validator allows 8–14). Landmarks: 6
  (validator floor 4). Motivated lights: 4 (floor 2). Fog breaks: 1 (floor 1).
- Objective 1 is `corridor` kind, radius 1000–1100, at x 14600–15200.
  Objective 2 is `arena` kind, radius 1400–1550, at x 17400–18000.
- Occupation point: x 17600–18400, radius 800–900, hold 180–330 ticks.
  Extraction point: x 15400–16200, radius 850–1000, window 600 ticks.
- Hazard: radius 1100–1450, 8–16 dps, centred x 14800–16000.
- Chokepath: x 18000–18800, half-width 1300–2200. Flank entry: (12000–12800, 9800–10400).
- Spawn directions: `["W","SW"]` or `["W","SW","NW"]`; west entries resolve at x 6000–6200.

**ROLE:**
You are a level architect with two decades of shipped action-game layout work and a strong bias
toward legibility over spectacle. You treat architecture as gameplay communication: every band of
the map exists to tell the player where to move, what threatens them, what the objective is, and
what state the run is in. You do not add verticality; you make a flat plane read.

**ACTION:**

1. Restate the stage brief in one paragraph: fantasy of the space, the single mechanical idea the
   map must teach, and its position `${sequence}` in the campaign.
2. Assign every X band a purpose and a numeric range. Start from this skeleton and adjust only with
   a stated reason:
   | Band (X) | Purpose |
   |---|---|
   | 600–3000 | ingress apron, first beacon, camera establishing shot |
   | 3000–6200 | approach; spawn resolution for W / SW / NW |
   | 6000–11800 | traverse; detour entry; first silhouette read |
   | 11800–15200 | objective 1 (corridor) + first contest |
   | 15400–16200 | hazard core + extraction beacon |
   | 17400–18400 | objective 2 (arena) + occupation + chokepath |
   | 19000–21100 | boss threshold |
   | 21100–23400 | gate apron; keep-clear radius 900 around (22000, 6000) |
3. Assign the three Y bands: north dressing (y ≤ 2800), main play band (y 4400–7600), south band
   (y ≥ 9000). Exactly one of the dressing bands carries the optional detour; the other stays
   non-walkable background dressing.
4. Place the fixed anchor set as numeric coordinates: ingress, two intermediate waypoints, final
   gate, two encounter objectives, occupation, extraction, hazard, chokepath, flank entry, elevation
   anchor, quest giver, and the four quest points.
5. Budget the dressing: obstacle count and radii, prop count (8–14), landmark count (≥4), motivated
   lights (≥2, each on a prop), fog breaks (≥1), one VFX cue.
6. Prove clearance arithmetically before anything is authored: for every obstacle/prop `p` and every
   route segment `s`, show `distance(p, s) ≥ p.radius + corridorWidth/2`; for every obstacle,
   `hypot(x-22000, y-6000) ≥ radius + 900`; for every pair of props,
   `distance ≥ r_left + r_right`; for every visibility anchor and obstacle,
   `distance ≥ obstacle.radius + 300`.
7. Name what the map does **not** do: no elevation change, no second walkable plane, no shortcut
   that skips objective 2, no re-entry that could duplicate a reward.
8. List the open questions that steps 01–02 must answer before code is written.

**FORMAT:**
Markdown, written to `_workspace/current/design/stage-map-${stageId}-blueprint.md`. Bands and
anchors go in tables; clearance proofs go in a fenced block showing the arithmetic. Mark every
statement `[OBSERVED]`, `[INFERENCE]`, or `[TARGET]` per `CLAUDE.md` §1. No ASCII art larger than
80 columns.

**TARGET AUDIENCE:**
The next agent session, which will run prompt `01` and `02` against this file and must not need to
re-derive a single number. It reads code fluently and rejects adjectives.

**HARD CONSTRAINTS:**

- One flat gameplay plane. Every elevation value in the resulting data is exactly `0`.
  `gameplay.surfaces` must stay `[]`.
- The critical route terminates exactly at `(22000, 6000)` and nowhere else.
- Walkable bounds must contain `gateX ± 900` and `gateY ± 900`.
- Route waypoints must sit at least `corridorWidth / 2` inside the walkable bounds.
- The critical route needs ≥ 2 waypoints whose role starts with `intermediate-`.
- IDs are stage-scoped: `${stageId}:<name>`, except landmarks which use `landmark.<name>`.
- `${silhouetteProfile}` must be unique across all stages.
- Nothing in this step touches `stage-world-catalog.js`, `defense-catalog.js`, or any runtime file.

**DONE WHEN:**
Every anchor in step 4 has integer coordinates, every clearance inequality in step 6 is written out
and satisfied, and a reader can transcribe the file into `stage-world-catalog.js` without inventing
a number.
