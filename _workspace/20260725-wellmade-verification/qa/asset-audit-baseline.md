# Asset Audit Baseline — director direct measurement (2026-07-25)

Method: direct GLB binary parse (JSON chunk + accessor walk) over all 51 GLB in
`assets/images/battle/glb/`. Reproducible via the eval cells in this session;
no third-party tool, no estimate.

## Rig coverage — RESOLVED vs Cycle 4's carried risk

All 24 character GLBs (10 boss + 9 companion + 4 enemy + 1 commander) carry
`skins=1`, `joints=24`, `animations=11`. `tests/character-rig-contract.test.mjs`
passes 24/24. Cycle 4's "4 bosses failed rigging" risk is **closed** by the
in-flight (uncommitted) rig pass.

## DEFECT A — animation density is 3.1x sparser on exactly 4 bosses

Keyframes per bone per second, by clip:

| model cohort | idle | move | run | hit | bighit | attack | critical | avoid | defence | die | show | avg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 models (baseline) | 11.0 | 22.4 | 24.2 | 20.0 | 21.2 | 23.1 | 23.4 | 24.4 | 21.3 | 19.5 | 19.1 | **20.87** |
| gate-sovereign, lantern-tyrant, tide-warden, veiled-concordat | 1.2 | 8.8 | 8.5 | 6.5 | 5.6 | 7.5 | 7.8 | 9.1 | 7.7 | 5.9 | 5.4 | **6.73** |

- Clip **durations are identical** across both cohorts (idle 5.00s, attack 3.75s, ...),
  so this is pure sample-rate loss, not different choreography.
- Worst case: `idle` at 1.2 kf/bone/s = ~6 keyframes across a 5-second loop.
  These 4 are the ones a player stares at longest — a boss idles while the
  player fights its adds.
- These are the same 4 the prior cycle logged as rig failures. The rig pass
  fixed the binding but produced a degraded action library for them.
- `tests/character-rig-contract.test.mjs` does **not** assert keyframe density,
  which is why 24/24 green coexists with this defect.

## DEFECT B — 23 of 24 characters are single flat untextured color

- `textures = 0` on **every** GLB in the project (51/51).
- `materials = 1` on 23 of 24 characters. Only `commander/dusk-warden.glb`
  carries 4 (`#3e305c` Void Obsidian / `#30acd5` Cyan Rift / `#dcc768` Zenith
  Void Gold / `#72788f` Cold Steel — the canon palette).
- Every other character is one desaturated mauve: `#a9809f`, `#aa7b85`,
  `#9a5c78`, `#a673ad`, `#77507e`, `#af8886`, `#d4aded`, `#888595`, `#b1b0cf`,
  `#7976b3`, `#8e7684`, `#8b789d`, `#b36174`, `#a484a3`, `#9e6f7f`, `#ad77c6`,
  `#d4b6c4`, `#8f9fae`, `#8e8289`, `#b476af`, `#8873a1`, `#9760a2`.
- Consequence: a 39,000-triangle boss and a 15,000-triangle trash enemy read as
  the same untextured pink mass at gameplay camera distance. Silhouette is the
  only channel carrying identity, and the palette does not distinguish faction,
  threat tier, or role.
- This is the single largest gap between the current build and "well made".

## DEFECT C — triangle budget is inverted against screen time

| class | tris | on-screen |
|---|---|---|
| boss | 37,174–39,438 (tide-warden 14,987) | one at a time, late in a stage |
| enemy | 15,134–15,733 | many at once, continuously |
| companion | 15,267–16,086 | up to 3, continuously |
| **commander (player)** | **1,034** | **always, center-frame, camera-followed** |
| terrain | 108–1,008 | full-frame, always |

The player's own avatar has **1/38th** the geometry of a boss, and the
always-visible terrain is 108–1,008 tris. Detail is allocated inversely to
screen time.

## DEFECT D — 22.5 MB unreferenced previs asset in the shipping tree

`previs/anchor-shard.previs.glb` — 500,000 tris, 22.55 MB, 0 skins, 1 animation.
That is 42% of the entire 53 MB GLB payload for one unreferenced file.
Grep confirms the renderer never resolves a `previs/` path.

## Clean results (no action)

- All 51 GLB parse as valid glTF 2.0 with intact BIN chunks.
- Dead-bone counts are low (0–4 of 24); the top-weighted bone sits at 8.1–16.6%
  for 23 of 24 models — the "one bone owns half the mesh" defect the rig
  contract test was written against is genuinely fixed.
- `pack-herald.glb` is the lone weight outlier at 24.1% on `DEF-pelvis.L`
  (baseline cohort 8–17%). Below the test's failure bar but worth a look.
