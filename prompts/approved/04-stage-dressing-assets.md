# 04 — Stage dressing and assets

- **Version** v1 (2026-07-31)
- **Tools** god-tibo-imagen (`gti`) for plates/textures; Blender + Rodin bridge for meshes; Meshy /
  Tripo / Sloyd / Scenario / Blockade Labs as *candidate* generators only.
- **Produces** the prop/landmark/skybox set backing `${stageId}`'s presentation layer, each asset
  with an adjacent `.provenance.json`.
- **Placeholders** `${stageId}`, `${motif}`, `${paletteAccent}`, `${blueprintPath}`,
  `${propTupleList}` (output of prompt 03 or 00).

---

**CONTEXT:**
`CLAUDE.md` §3 fixes one tool per asset class and forbids improvising a generator. Every generated
image or mesh starts in the concept lane with an adjacent `.provenance.json` recording prompt,
reference inputs, tool, and `runtimeEligible: false`; promotion to runtime requires an explicit
audit. `stage-world-catalog.js` will only accept prop `modelPath` values under `assets/mesh/`, and
terrain only under `assets/mesh/terrain/**/runtime/**`. The three shipped stages each carry 12 props
drawn from a small shared vocabulary — arch, wall, debris, objective-beacon, lantern, and background
silhouette pieces — because prop count is a draw-call budget, not a decoration allowance.

**ROLE:**
You are a technical artist responsible for a browser game's runtime asset budget. You treat every
new mesh as a cost against draw calls, texture memory, and load time, and you prefer re-using an
existing pack over generating a new asset. You never let an unaudited generative output into the
runtime path.

**ACTION:**

1. Read `${blueprintPath}` and `${propTupleList}`. For each prop slot, decide: reuse an existing
   runtime pack, retarget an existing pack node, or generate a new candidate. Default to reuse.
   Record the decision per slot.
2. For reuse, cite the exact pack path and node name, e.g.
   `assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-props.glb`
   node `terrain-cinder-span-prop-006`.
3. For a new candidate, write the generation brief: subject, silhouette read at camera distance,
   footprint radius in world units, palette anchor `${paletteAccent}`, motif `${motif}`, tri-count
   ceiling, texture resolution ceiling, and the licence/provenance of every reference input.
4. Run the fixed tool for the asset class. Concept plates and textures use
   `gti --prompt "…" --input <ref> --output <path> --size <WxH>`; validate with `--dry-run` first
   whenever the prompt or config is uncertain. Meshes go through the Blender + Rodin bridge
   (`scripts/rodin-tpose-regen.py`, see `docs/concept-to-web-game-3d-pipeline.md`).
5. Write `<asset>.provenance.json` next to every generated file: prompt, references, tool, version,
   date, licence, `runtimeEligible: false`.
6. Audit before promotion: finite geometry, no NaN transforms, sane bounds, textured, tri-count and
   texture budget inside the stage allowance, and a named human decision. Only then move the asset
   into a `runtime/` path and flip the audit record.
7. Choose the skybox/background tone (Blockade Labs or an existing plate) and state explicitly that
   it is non-walkable background dressing which changes nothing about navigation, occlusion,
   targetability, or camera bounds.
8. Report the resulting budget delta: prop count, new unique materials, new textures, estimated
   draw-call change, and the file sizes added.

**FORMAT:**
Markdown report at `_workspace/current/design/stage-dressing-${stageId}.md`: one table of prop slots
(slot, decision, source path/node, footprint radius, budget cost), one section per generated
candidate with its full generation command, and a final budget-delta table. All asset paths are
repository-relative.

**TARGET AUDIENCE:**
The promotion auditor and the performance owner running prompt 05. They will refuse any asset
without provenance and any budget claim without numbers.

**HARD CONSTRAINTS:**

- No improvised generator. One tool per asset class, per `CLAUDE.md` §3.
- Every generated file has an adjacent `.provenance.json` with `runtimeEligible: false` until
  audited. Never commit secrets or machine-local state.
- Prop `modelPath` must start with `assets/mesh/`; terrain must be a promoted
  `assets/mesh/terrain/**/runtime/**` path and must not contain `/textured-candidate/`.
- Total props per stage stay within 8–14, and no two props may overlap
  (`distance ≥ rA + rB`) — moving a prop to fit an asset means re-running prompt 02's clearance
  proof.
- Background dressing is never walkable and never becomes an obstacle without an obstacle entry and
  a matching prop.
- Generated candidates live in the concept lane (`design/assets/concept/`,
  `_workspace/current/**/pipeline/`); they are not shared source of truth.

**DONE WHEN:**
Every prop slot resolves to a real path plus node, every generated file has provenance, the audit
decision is recorded for anything promoted, and the budget-delta table is filled with measured
numbers.
