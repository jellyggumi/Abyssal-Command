# Task Manifest — Well-Made Verification Cycle

run-id: `20260725-wellmade-verification` · director · 2026-07-25
Operating mode: **stage-gate verification review** (measure-only, no feature code)
Next public beat: a build whose "well made" claim is backed by G1–G8 measurement
rather than by shipped-code volume.

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| Intake + operating-mode selection | director | intake | `intake/production-brief.md` | — | done | cycle open |
| Baseline suite run | director | intake | `node --test 'tests/**/*.test.mjs'` → 209 pass / 0 fail / 1 skip, 70s | — | done | baseline |
| GLB fleet audit (51 files, binary parse) | director | S1 | `qa/asset-audit-baseline.md` | G4 input | done | asset truth |
| Rig/anim/pose root-cause analysis | director | S1 | `engineering/rig-pipeline-root-cause.md` | G4 input | done | 6 defects D1–D6 |
| Blender render verification (51 GLB + run-cycle frames) | director | S1 | `/tmp/pose-audit/`, `/tmp/clips/` | G4 input | done | visual evidence |
| Fix-1 feasibility prototype (plinth strip) | director | S1 | `engineering/fix-1-pedestal-removal-validated.md` | G4/G6 input | done | 54%→100% scale, rig preserved |
| Payload audit | director | S1 | `engineering/payload-audit.md` | G6 input | done | 29 MB of 53 MB recoverable |
| Terrain audit | director | S1 | `engineering/terrain-audit.md` | G4 input | done | 4,120 tris campaign-wide |
| Formal G2/G3 archetype rotation | BalanceG2G3 | S2 | `qa/gate-measurements.md#g2/#g3`, `qa/evidence/` (14 sweeps) | G2, G3 | done | both FIX; 700 stage clears, 0 defeats |
| Formal G6 perf budget on 3D renderer | PerfG6 | S3 | `engineering/evidence/g6-{scenario,fullapp,plinth,leak,soak}.json` | G6 | done-partial | FIX; final markdown not written before timeout, JSON complete |
| G4 immersion + in-browser visual verification | VisualG4 | S3 | `qa/evidence/data/*.json`, `qa/evidence/screens/` (14 shots) | G4 | done-partial | FIX; final markdown not written before timeout, JSON + screens complete |
| G7 core loop + G8 novelty scorecard | DesignG7G8 | S2 | `design/core-loop.md`, `design/novelty-scorecard.md`, `design/presentation-spec.md`, `design/trend-survey/` | G7, G8 | done | G7 FIX; G8 frequency PASS / impression blocked |
| G1 final narrative + de-IP audit | NarrativeG1 | S3 | `qa/narrative-audit.md` (529 lines) | G1 | done | FIX; 1 S1 (그림자군단) blocking |
| Gate synthesis + verdicts | director | S3 | `production/gate-reviews/stage-gate-review.md` | all | done | no gate reaches PASS |
| Ranked improvement backlog | director | close | `production/improvement-backlog.md` | — | done | 4 Tier-0, 6 Tier-1, 7 Tier-2, 1 Tier-3 |
| Retrospective | director | close | `retrospectives/cycle-1-retrospective.md` | — | done | next entry: Stage 2 retune |
| Workspace restoration | director | S3 | `conflicts.md#C1` | — | done | 155 files across 3 prior run-ids restored from HEAD |

## Carried-forward risks from Cycle 4 — disposition this cycle

| # | risk | disposition |
|---|---|---|
| 1 | R2 role-diversity matrix not extended | assigned to BalanceG2G3 (G3 scope) |
| 2 | Turret ↔ Boss Rally Window mutual exclusion | assigned to BalanceG2G3 (stance differentiation) |
| 3 | Formal G2/G3/G6 never executed | assigned to BalanceG2G3 + PerfG6 — the core of this cycle |
| 4 | Terrain UV seam exposure unverified | partially addressed: `textures: 0` project-wide, so there are no UV seams to expose. Recorded in `terrain-audit.md` |
| 5 | Enemy nameplate CSS with no application point | not in scope; carried forward again, explicitly |
| 6 | 4 bosses "rigging failed" | **superseded twice** — all 4 are rigged AND correctly fitted (foot bone 6% of body height). The residual defect is that their idle has **0 varying bones** (literal statues), which `VisualG4` established after correcting the director's "3.1× sparse sample rate" reading |

## Director corrections issued mid-cycle

Two of my own readings were wrong and were retracted in writing and by broadcast
before any downstream agent built on them:
1. "Pedestal is skinned to pelvis/spine and swings with the hips" — the plinth is
   unskinned and never deforms.
2. "Rig floats, foot bone at 12–49% of mesh height" — measured against total
   height including plinth. Against **body** height the foot bone is at exactly
   6% on all 24 models; the rig is correctly fitted everywhere.

Both retractions are recorded in `engineering/rig-pipeline-root-cause.md` under
"Corrections issued during this audit". Root cause in both cases: choosing a
denominator without verifying what it contained.

## Scope discipline

This cycle ships **no** gameplay, art, or renderer change. The plinth-strip
prototype wrote to `/tmp/probe/` only; `assets/` is untouched by the director
lane. The working tree remains dirty with the pre-existing in-flight rig pass,
which this cycle measured but did not commit, revert, or extend.
