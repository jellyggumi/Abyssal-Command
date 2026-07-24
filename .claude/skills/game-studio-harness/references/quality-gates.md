# Quality Gates G1–G8

Every gate verdict requires: measured value + measurement method + evidence
path. A claim without all three is FAIL. Verdicts: PASS / FIX (specific
issues, ≤2 revision loops) / REDO (restart previous stage).

QA owns measurement (`qa/gate-measurements.md`); the director owns the
verdict (`production/gate-reviews/{stage}-{gate}.md`).

## Gate table

| ID | Gate (user condition) | Threshold | Measured by | Evidence |
|---|---|---|---|---|
| G1 | Narrative consistency within the worldview (세계관 내 일관적 서사) | 0 un-waived lore violations; 100% of shipped strings/effects/scenarios trace to `design/worldview.md` | QA audit pass over all player-visible content | `qa/gate-measurements.md#g1`, violation list |
| G2 | Rules & balance numbers well-set (규칙·밸런스 수치) | 100% mechanics covered in `design/balance-sheet.md`; matchup win-rates within 45–55%; TTK within ±15% of target; combo-matrix EV bounded (no dominant pair >1.3× median EV) | QA simulation/scripted matchups + sheet audit | `qa/gate-measurements.md#g2`, sim logs |
| G3 | Player-type diversity sufficient (플레이어 타입 다양성) | ≥3 archetypes independently viable (win-rate within band using distinct strategies); no archetype >50% dominance in optimal play; ≥5 archetypes tested | QA archetype-rotation sessions | `qa/playtest-report.md`, per-archetype table |
| G4 | Effects & animations give immersion (이펙트·애니메이션 몰입감) | Median immersion score ≥4.0/5 across scored scenes; effect feedback latency ≤100ms spot-checks; 0 unresolved readability complaints (S1/S2); UI accessibility numbers (touch target ≥48dp, contrast, reduced-motion parity) pass; 0 silent runtime-asset load failures (every MODEL_ROOT-relative path in a shipped lookup table -- boss/terrain/enemy/companion/commander/VFX -- resolves 200, not caught-and-skipped) | QA structured playtest scoring + latency probes; UI senior developer accessibility audit; programmer network-trace asset audit | `qa/gate-measurements.md#g4`, `ui/accessibility-audit.md`, browser network trace or equivalent fetch log |
| G5 | Revenue–balance synergy projected (매출·밸런스 시너지) | Paid/free win-rate delta ≤5%p at equal skill; comeback (일발역전) instant-reversal probability ≤30% per activation with recorded cap/cooldown; free-path parity within stated 10–20 session band; every revenue point has a signed negotiation-record entry | QA fairness sims + PM/designer record audit | `pm/reward-bands.md`, `pm/negotiation-record.md`, `qa/gate-measurements.md#g5` |
| G6 | Game-ops plan appropriately applied (게임운영 계획) | `ops/telemetry-contract.md` implemented (all PM-forecast + QA-verification fields emitting); `ops/rollback-runbook.md` tested once; `ops/release-readiness.md` checklist 100%; perf budget table green (p95 frame ≤16.7ms, long-frame <0.5%, memory stable over 30-min soak, input ≤100ms); UI DOM-count ceiling and UI input latency ≤100ms green | Programmer measurements verified by QA; UI senior developer perf-notes verified by QA | `engineering/perf-budget.md`, `ops/*`, `ui/perf-notes.md` |
| G7 | Core loop discovered, ≥1 mandatory (코어루프 최소 1개) | ≥1 loop in `design/core-loop.md` with numeric model: period 30–180s, ≥3 actions/loop, ≥1 reward event/loop, and playtest repeat-rate proxy ≥70% (testers voluntarily re-enter the loop) | Designer model + QA playtest confirmation | `design/core-loop.md`, `qa/playtest-report.md` |
| G8 | Novelty/striking element, ≥1 mandatory (참신성·인상 요소 1개) | ≥1 element appearing in ≤2 of ≥5 surveyed comparable titles (survey frequency table) AND QA impression score ≥4/5 | Designer novelty scorecard vs survey data + QA scoring | `design/novelty-scorecard.md`, `design/trend-survey/`, `qa/gate-measurements.md#g8` |

## Character asset pipeline standard (referenced by G4)

Applies to any humanoid/creature 3D character asset entering a shipped GLB
lookup table (`BOSS_MODELS`/`COMPANION_MODELS`/`ENEMY_MODELS`/etc.).

- **Pose**: every rigging-bound character mesh must be generated/exported in
  T-pose (arms horizontal) or A-pose before rigging -- auto-rig tools key off
  this. A mesh confirmed in a non-T/A pose ships with a `.NOTPOSE.` filename
  marker and a decision-log entry; it is not silently treated as rig-ready.
- **Rigging tool selection** (evaluated 2026-07-24; re-verify licensing/API
  status before reuse -- vendor terms and service stability both drift):
  - **Tripo AI** -- primary choice when automation matters (batches of
    3+ characters). Real REST API + `tripo3d` Python SDK, `animate_rig` task
    type covers both humanoid and non-humanoid/creature topologies, native
    GLB output (zero conversion hops). Free "Basic" tier output is
    CC BY 4.0 (requires shipped-credits attribution); Professional tier
    removes the attribution requirement. Budget ~300 credits/month on the
    free tier against batch size. Requires `TRIPO_API_KEY`; treat its
    absence as a hard blocker to note explicitly, not a reason to
    hand-wave rigging as done.
  - **AccuRig** (Reallusion, free incl. commercial use for self-authored
    meshes) -- humanoid fallback when no Tripo key is available and batch
    size is small enough for manual GUI sessions. FBX/OBJ in, FBX/USD/iAvatar
    out (no native glTF -- requires an FBX-to-Blender-to-GLB round trip).
    GUI-only, no batch/CLI path.
  - **Mesh2Motion** (MIT/CC0, github.com/Mesh2Motion) -- creature/non-humanoid
    fallback when licensing cleanliness matters more than automation. Native
    GLB in/out (zero conversion hops, matches this project's Rodin/Hyper3D
    pipeline directly). Browser-based, semi-automatic skeleton fitting --
    no batch/CLI path, one interactive session per asset.
  - **Mixamo**: not recommended as of 2026-07-24 -- free/commercial-safe
    licensing is fine, but documented recurring auth/upload instability with
    no Adobe fix timeline makes it a batch-reliability risk; prefer AccuRig
    for the same free/manual/humanoid niche.
- **Runtime wiring verification** (the concrete failure this standard exists
  to prevent): a character/terrain/VFX GLB is not "done" when the file
  exists on disk. It is done when `loadGltf()` (or the runtime's equivalent
  loader) actually resolves it over the network with a real in-browser
  render — confirmed on 2026-07-24 that a `.catch()` swallowing a 404 into a
  no-op is indistinguishable from success in every artifact/manifest/test
  that doesn't independently probe the network. Evidence must include either
  a network-trace excerpt or an equivalent fetch-log showing 200s for the
  claimed asset set, not just `ls`/file-exists checks on the export
  directory.

## Stage → gate mapping

| Stage | Gates required to exit |
|---|---|
| Stage 1 | G7 draft (loop modeled + implemented), G1 draft (worldview locked, content-so-far consistent), G6-ops draft (telemetry contract + resource manifest exist) |
| Stage 2 | G2, G3, G5, G7 final, G8 |
| Stage 3 | G4, G6 final, G1 final |

## Blocking rules
- Any open S1 defect blocks every gate.
- Missing evidence path = FAIL regardless of claimed value.
- A gate FIX loop may run at most twice; the third failure forces a director
  scope decision recorded in `production/decision-log.md`.
- Waivers (e.g., intentional lore break for an event) must be written by the
  director with reasoning and expiry; unexpired waivers count as pass-with-note.

## Threshold provenance
Bands (45–55% win-rate, ±15% TTK, ≤30% reversal, ≤5%p paid delta, 10–20
session parity, 16.7ms/100ms perf, 4.0/5 immersion, ≤2-of-5 novelty
frequency, ≥70% loop repeat-rate) are the harness defaults. The designer may
propose per-genre overrides in `design/balance-sheet.md#band-overrides`;
overrides take effect only after a director-approved decision-log entry.
