# Hourly Review Protocol — Stage 2

run-id: `20260725-defense-rpg-development`

This is a review cadence, not a claim that any gate passes. Every hour, the QA lead records one immutable row with build/rules/catalog hashes, timestamp, reviewer, seed set, changed files, observed metrics, verdict, and next action. No formatter, project-wide test, or undocumented human-impression claim is part of this packet.

## Numeric review card

| check | numeric rule / observation | evidence to attach |
|---|---|---|
| Tier 0.1 narrative | zero shipped `그림자군단` strings; canonical Warden Corps vocabulary only | current `app.js` lines + rerun narrative receipt; baseline failure is documented in `_workspace/20260725-wellmade-verification/qa/narrative-audit.md#g1` |
| Tier 0.2 extraction | at least one accepted `EXTRACT_ELITE` after elite defeat, with candidate-relative window and `ELITE_EXTRACTED` | deterministic input/event trace; baseline was 1,033 inputs / 0 accepted |
| Tier 0.3 assets | rendered-height parity remeasured; pedestal absent; triangle/draw-call delta recorded | GLB/pipeline report; baseline was 54–100% intended height and 134,969 inert triangles |
| Tier 0.4 disposal | 40 spawn/despawn cycles do not show linear renderer-held texture growth | leak receipt; baseline was 52→297 textures, one leak/spawn |
| G2 balance/failure | defeat is reachable; win-rate target 0.45–0.55 where applicable; boss TTK uses frozen ±15% band | five-archetype matrix and boss TTK trace; baseline was 0 defeats / 700 clears |
| G3 role diversity | five archetypes exercised; distinct actions/stance choices affect trace, not just labels | per-archetype traces and action deltas; baseline 7/7 viable only vacuously |
| G4 readability/animation | boss idle variation, material/height evidence, and UI critical-object capture | browser screenshots + clip/material receipt; baseline has four frozen boss idles and 23/24 flat off-canon materials |
| G6 performance | p95 frame ≤16.7 ms and long-frame <0.5% on target low-tier profile; input p95 ≤100 ms | device-profile JSON; baseline low-tier frame p95 24.2 ms / 8.302%, input p95 5.6 ms |
| G7 loop | 30–180 s, ≥3 distinct deliberate action classes, ≥1 accepted reward | event receipt with start/end ticks; baseline modelled circuit 0.02 s / 0 actions |
| G8 novelty | frequency result stays source-bounded; impression remains **unmeasured** until human review after reachable extraction | comparator table + later reviewer packet; baseline frequency 0/11, impression blocked |

## Roles and handoff

- **QA lead:** owns the hourly row, reruns the narrow receipt, labels observed fact vs inference, and blocks ungrounded PASS language.
- **Simulation/balance reviewer:** checks seed identity, event order, action classes, failure pressure, extraction, and TTK.
- **UI/UX reviewer:** checks ≥44×44 CSS px controls, non-color cues, field-object location, reduced-motion semantics, and screenshots.
- **Asset/provenance reviewer:** checks sidecars, rights state, hashes, GLB embedding, fallback load, and texture/triangle effects.
- **Director:** decides stop/escalate, maintains Tier 0→Tier 1 ordering, and signs only evidence-backed status.
- **Human-impression reviewer (later, not yet active):** records observed comprehension/repeat behavior only after a stable build; no impression evidence exists in this run.

## Hourly record template

```text
hour_utc:
build_hash / rules_version / catalog_hash:
reviewer:
changed_files:
seed_set_and_archetypes:
Tier0_receipts: 0.1= / 0.2= / 0.3= / 0.4=
loop_duration_s / distinct_action_classes / accepted_rewards:
min_gate_hp / min_warden_hp / boss_ttk_ticks:
frame_p95_ms / long_frame_pct / input_p95_ms:
touch_target_min_css_px:
asset_rights_or_runtime_blockers:
observed_facts:
design_inferences:
verdict: HOLD | ADVANCE_TO_NEXT_TIER | ESCALATE
next_action_and_owner:
```

## Stop/escalate rule

**Stop the current lane immediately and escalate to the director** when any of the following occurs: deterministic digest/event order changes for identical seed and input; a Tier-0 receipt regresses or remains unmeasured; extraction is again unreachable; a new asset lacks provenance/rights/GLB/runtime evidence; any critical control is below 44×44 CSS px; low-tier p95 exceeds 16.7 ms or long frames reach 0.5%; a proposed Tier 1 change depends on an unresolved Tier 0 scale/runtime defect; or a reviewer is asked to label a research statement or human impression as runtime evidence.

The director records the exact failing receipt, freezes Tier 1 work where relevant, assigns one owner, and schedules a focused re-measurement. No gate is marked PASS from a target, projection, screenshot without method, or external reference page alone.
