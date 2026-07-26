# Improvement Backlog — what needs fixing to make this "well made"

run-id `20260725-wellmade-verification` · director · 2026-07-25

Ranked by (player-visible impact) ÷ (cost), every item traced to a measurement
made this cycle. Nothing here is an opinion; each row names the number that
produced it.

## Tier 0 — blocking, cheap, do first

| # | item | why | cost | evidence |
|---|---|---|---|---|
| **0.1** | Replace `그림자군단` in 2 shipped strings | `app.js:585` `<h1>그림자군단 방어선</h1>` and `app.js:573` "그림자 군단으로 복속". Canon names the player faction **Warden Corps**; `그림자군단` appears in 0 canon docs. Both a lore violation and IP-adjacent — defeat→extract→subjugate-into-shadow-army is the source IP's signature mechanic, stated literally. Survived 3 de-IP passes because all 3 swept filenames and asset ids, never shipped Korean UI | **2 strings** | `qa/narrative-audit.md#g1` V1 |
| **0.2** | Make `EXTRACT_ELITE` reachable | The signature novelty element (G8, 0 of 11 surveyed titles) is unreachable dead code. `extractionProgress.completed = true` has one writer (`defense-run-simulation.js:1411`) which also sets `run.extracted = true` at :1413; the input guard needs `completed && !extracted`. Verified 2 ways: 1,033 inputs / 0 accepted, and static single-writer analysis | small — split the auto-complete so the hold opens a *window* the player closes | `design/core-loop.md#g7-extract` |
| **0.3** | Delete `<id>_pedestal` from character GLBs | Fixes 3 defects with one change: characters render at **54–100% of intended height** (46-point spread — a boss can render shorter than a companion), **134,969 inert triangles (24%)**, and **13 of 40 draw calls**. Prototyped: scale → 100%, rig + 11 clips + 17,524 keyframes preserved byte-for-byte | one pipeline line + re-export | `engineering/fix-1-pedestal-removal-validated.md`, `engineering/evidence/g6-plinth.json` |
| **0.4** | Call `Skeleton.dispose()` in `disposeObject3D` | GPU textures grow **52 → 297 dead-linear over 40 spawn/despawn cycles**, exactly 1 leaked per actor spawn, while the scene graph stays flat at 11 actors. ~1.24 MiB orphaned per 30-min session at measured churn | one call | `engineering/evidence/g6-leak.json` |

Tier 0 total: two strings, one guard, one pipeline line, one dispose call.

## Tier 1 — the "well made" gap proper

| # | item | why | evidence |
|---|---|---|---|
| **1.1** | **Give the cast material identity** | `textures: 0` on all 51 GLB; 23/24 characters carry exactly one flat material. Redmean distance from the 5-token canon palette: **min 44.4 / median 93.3 / max 201.7**. Only `dusk-warden` conforms (0.0). The screenshots show characters, terrain and background collapsing into one pink/rust hue — the lobby UI uses the canon palette correctly and the 3D scene does not. **This is the single largest visible gap.** Spec already written: marks must hold ΔE ≥25 / ≥25% luminance separation from the active stage tint | `design/presentation-spec.md`, `screens/11,13`, `qa/narrative-audit.md` |
| **1.2** | **Author per-character animation** | All 24 characters share one identical procedural clip library — same 11 clips, same 24 Hz, same 8 varying bones in idle, same 0.0035 value spread. Every character walks identically | `qa/evidence/data/clip-track-census.json` |
| **1.3** | **Un-freeze 4 boss idles** | `gate-sovereign`, `lantern-tyrant`, `tide-warden`, `veiled-concordat`: idle has **0 varying bones, maxValueSpread 1.28e-17**. Literal statues, and they are 4 of 10 stage bosses — the pose a player watches longest | `qa/evidence/data/idle-tracks.json` |
| **1.4** | **Give the campaign a failure state** | **0 defeats in 700 stage clears** across both RPG arms. Delta 0.0%p. The RPG layer is exonerated — it delivers a real 1.309× TTK speedup that changes no outcome because the ceiling sits below the floor. Owner: `defense-catalog.js` stage budgets | `qa/gate-measurements.md#g2` |
| **1.5** | **Replace the player commander model** | 1,002 body triangles of cone-and-sphere placeholder on the one actor that is never off screen, against 8,676–39,264 for every NPC | `engineering/rig-pipeline-root-cause.md` D5 |
| **1.6** | **Fix the T-pose gate** | `tposeOk: false` on **23 of 24** models, arm axis deviation 33–96° against a 12° tolerance, `rotatedDeg: {}` on every one. `rig-all-characters.sh` gates on process exit code, so all 24 install as "OK" | `/tmp/rig-staging/reports/*.json` |

## Tier 2 — real, lower urgency

| # | item | why |
|---|---|---|
| 2.1 | Low-tier mobile perf | p95 **24.2 ms**, long-frame **8.30%** at 6× CPU throttle vs budget 16.7 ms / 0.5%. Mid-tier marginal at 15.0 ms / 0.736%. Item 0.3 already buys 22.8% p50 / 24.1% p95 render time back at mid-tier |
| 2.2 | Turtle archetype TTK ceiling | 6/10 stages violate. Root cause is in the QA archetype policy (`turtle.statPriority` never invests `binding-might`/`abyssal-resonance`), not confirmed as a game-numbers defect |
| 2.3 | R1 warden-share ceiling | 127/350 points (36.3%) exceed the 20% ceiling, worst 40.1%. Equipment **widens** the gap — 280 of 330 measurable points widen, only 45 narrow. Closes the prior cycle's open question |
| 2.4 | Reward pacing | 67.8% of reward gaps are **under 0.1 s** — rewards arrive in simultaneous clumps, not rhythm |
| 2.5 | Delete the condemned 23 MB previs GLB | `assets/defense-asset-manifest.json:2781-2789` already marks it `"disposition": "delete"`, `"runtimeReference": false`. Repo-only — `PAGES_RUNTIME_PATHS` already excludes it, so **no player-facing win**, purely repo hygiene |
| 2.6 | Terrain fidelity | Whole campaign is **4,120 triangles** — less than one trash enemy. Uniformly low, so it reads as style rather than as broken; below the character defects |
| 2.7 | Product-name and hub-label consistency | `<title>` 심연 방어선 vs `<h1>` 그림자군단 방어선; hub shipped as DEEP REFUGE where canon says Farwatch Hold |

## Tier 3 — process, and the reason this list was needed

**Convert this cycle's six audits into standing CI assertions.** Every defect
above survived a **209-test green suite**. The same failure mode appeared in four
independent lanes this cycle: an artifact true when produced, never rebound to
its source, trusted afterwards.

- `character-rig-contract.test.mjs`: assert no `*_pedestal` mesh, `tposeOk`,
  idle `varyingBones > 0`, rendered-height parity.
- Shipped player-visible strings asserted against a canon vocabulary — would
  have caught 0.1 on the day it landed (`NarrativeG1`'s proposal).
- A test asserting every `_workspace/*/production/task-manifest.md` in HEAD is
  still on disk. **155 files across 3 prior workspaces were deleted during this
  session, twice** — once mid-cycle and again after the first restore.
  Causally established: deleted → **237 pass / 10 fail**; restored → **247 pass /
  0 fail**. The 10 failures are all `G2 full-route CLI …` and `live product
  closure …`, whose names point at a measurement-pipeline regression rather than
  at a missing fixture. The signal exists and misdirects (`conflicts.md#C1`).
- Assert `fitHeight()` matches the *character* to its class target, not the GLB
  bounding box.

## Sequencing

```
Tier 0 (0.1 → 0.4)          two strings, one guard, one pipeline line, one dispose call
   └─ 0.3 unblocks 1.1/1.5  correct scale before authoring materials or a new commander
Tier 1.1 + 1.2/1.3          the actual "well made" work — art and animation authoring
Tier 1.4                    difficulty; independent of all art work, can run in parallel
Tier 2                      after Tier 1 lands
Tier 3                      alongside everything, cheapest insurance in the list
```

**0.3 must precede 1.1 and 1.5.** Authoring materials or a replacement commander
against a cast that renders at 54–100% of intended height would bake the scale
error into new art.

## What is already good — do not "fix" these

Stated so a later cycle does not burn effort re-litigating measured-sound work:

- **Rig fit is correct on all 24 characters** — foot bone at exactly 6% of body
  height, uniformly. My earlier "floating rig" claim was a wrong denominator and
  is retracted.
- **Weight distribution is healthy** — top-weighted bone 8.1–16.6% on 23 of 24.
- **Mesh sculpts are high quality** — real silhouette variety and design intent.
- **The lobby / HUD is well made** — canon palette, strong contrast, clean
  hierarchy. It is the reference the 3D scene should be measured against.
- **Determinism and test discipline hold** — 209 pass / 0 fail / 1 documented
  skip; the renderer cannot perturb `getRunDigest()`.
- **Efficiency spread passes** — 1.261× per-archetype and 1.211× pairwise
  against the 1.3× cap, at n=5 seeds.
- **Input latency passes by two orders of magnitude** — worst 5.6 ms against a
  100 ms budget.
- **Naming is coherent** across all 3 asset generations; gen-2 companions
  deliberately cross-link to gen-1 bosses. The one seam is the 4 enemies
  (`guard`/`possessed`/`scout`/`shade`), which score 0% on canon lexemes.
