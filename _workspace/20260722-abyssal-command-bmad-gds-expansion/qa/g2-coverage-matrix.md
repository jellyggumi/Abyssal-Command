# G2 full-route coverage matrix — runtime-backed planned definition

**State:** `BLOCKED — prerequisite definitions only`  
**Gate:** **G2 `NOT MEASURED / NOT PASSED`**  
**Stage:** **Stage 2 `REDO`**

This matrix has no collected evidence and grants no collection, tuning, runtime/catalog, reward, idle-return, monetization, provider/network, G8, release, or gate authority. Every row below is either an exact current runtime/catalog fact or **SIGNED PROPOSED DESIGN INPUT**.

## Canonical source-backed surfaces

| Surface | Current fact | Exact source |
| --- | --- | --- |
| Plan descriptors | Every catalog stage exposes `map-plan:<stage>:v1`, `wave-plan:<stage>:v1`, and `m4-plan:<stage>:v1`. | `defense-catalog.js:481-527` |
| Runtime identity | The snapshot exports `plan.identity`, `mapPlanId`, `wavePlanId`, `m4PlanId`, and `waveVariantId`. | `defense-run-simulation.js:1432-1497,1667-1706` |
| Terminal outcomes | Runtime emits `DEFEAT`; boss completion emits `VICTORY` or `FINAL_COMPLETION` for `gate-zenith`. | `defense-run-simulation.js:1391-1419` |
| M4 operations | The runtime accepts `M4_CARD_DECISION`; cards can be selected/declined/rejected, exhausted inventory falls back, and selected recovery reaches `occupation`. | `defense-run-simulation.js:599-665,668-679` |
| QA multi-skill fixture | `qa-multi-skill-measurement-v1` is QA-only and initializes `[soul-lance, grave-pulse]`. | `defense-catalog.js:33-50`; `defense-run-simulation.js:1456-1468` |

The canonical conditions, M4 bindings, terminal mappings, and required run identity are sole-sourced by [`design/g2-assessment-units-v1.json`](../design/g2-assessment-units-v1.json). The nine M5 mappings are sole-sourced by [`design/g2-ttk-cohort-register-v1.json`](../design/g2-ttk-cohort-register-v1.json). The M6 fixture/signature/comparator scope is sole-sourced by [`pm/g2-combo-comparator-register-v1.json`](../pm/g2-combo-comparator-register-v1.json).

## Finite planned execution matrices

| Matrix | Finite planned population | Required canonical facts | State / current blocker |
| --- | --- | --- | --- |
| M1 — full-route outcomes | `5` catalog profiles × finite signed seeds × `9` canonical assessment conditions × `{declared-movement, adversarial-movement}`. Profile/seed/input-policy cardinalities are **SIGNED PROPOSED DESIGN INPUT** until signed. | Condition ID, profile ID, seed, stage ID, map/wave/M4 plan IDs, wave variant ID, terminal event/outcome, rules catalog digest. | `NOT MEASURED`; runner must emit every identity field and terminal event. |
| M2 — observer invariance | Every M1 tuple × `{normal-A, normal-B, reduced-A, reduced-B, muted-A, muted-B, dropped}` × `{30,60,120}` declared harness cadence. | The runner binds and records the declared finite observer configuration and detached cadence projection while the core remains 60 Hz; signatures/hashes remain admission facts. | `NOT MEASURED`; no signed observer implementation hashes or admission exist. |
| M3 — cooldown boundaries | Every applicable signed M1 active-skill tuple × `{C-1,C,C+1}` × signed stable/target-loss-reacquisition case. | Core `INPUT_ACCEPTED`/`INPUT_REJECTED`, cooldown-set/ready, and explicit `M3_TARGET_LOSS`/`M3_TARGET_REACQUIRED` events; configured/actual ready tick and plan identity. | `NOT MEASURED`; missing evidence or a rejected required target probe remains an invalid retained row. |
| M4 — recovery/fallback | Every canonical condition × profile × signed seed × applicable signed input policy × `{select first card, decline then select, decline to exhaustion, invalid card}`. | Exact stage M4 card IDs, recovery ID/safe lane, fallback ID/reason, and the declared event sequence. | `NOT MEASURED`; four closed cases are definitions, not corpus evidence. |
| M5 — TTK cohorts | `9` canonical cohort mappings × `5` catalog profiles × signed seeds × signed input policies. | TTK mapping/register digest, target instance, matched spawn/kill event IDs and ticks, plan identity/variant, cohort/condition ID. | `NOT MEASURED`; any missing linkage is retained `NOT_OBSERVED`. |
| M6 — combo EV | QA fixture `qa-multi-skill-measurement-v1` × ordered signature `[soul-lance, grave-pulse]` × 3 signed proposed seeds `{17,18,19}` × 2 signed proposed combat-RNG position labels. | Fixture/signature/ordered ability fields, linked cast/causal/target/resolved facts, finite comparator population, finite median, and ratio disposition. | `NOT MEASURED`; no signed admission or collected comparator set exists. |

## M4 applicability and first-failure protocol

For each M4 tuple, the runner must retain the first failure or terminal event, not a synthesized success state:

| Planned case | Required exact runtime signal | First-failure disposition |
| --- | --- | --- |
| Select current card | `M4_CARD_SELECTED` with catalog card, recovery, and safe-lane IDs | Missing/mismatched signal is `INVALID_MISSING_EVIDENCE`. |
| Recover selected card | `M4_RECOVERY_CHECKPOINT` at `occupation` | Missing checkpoint is `FAIL_WAVE_RECOVERY_OR_FALLBACK`. |
| Decline then select | Exact retained sequence `M4_CARD_DECLINED → M4_CARD_AVAILABLE → M4_CARD_SELECTED → M4_RECOVERY_CHECKPOINT` | Any missing, reordered, or substituted event is `FAIL_WAVE_RECOVERY_OR_FALLBACK`. |
| Decline after final card | `M4_FALLBACK` reason `M4_CARD_INVENTORY_EXHAUSTED` | Missing or substituted reason is `FAIL_WAVE_RECOVERY_OR_FALLBACK`. |
| Invalid/exhausted request | `M4_CARD_REJECTED` | Never substitute a valid card, retry away, or delete the row. |

## Required expected-tuple regeneration contract

**Owner:** runner/register executor. The regenerated closure is a definition-only artifact; no corpus or evidence JSONL is created.

The generator must use the new register fields exactly:

```text
assessment_condition_id, cohort_mapping_id, profile_id, seed_id,
input_policy_id, stage_id, map_plan_id, wave_plan_id, m4_plan_id,
pressure_band_id, target_cohort_id, terminal_binding,
measurementProfileId, waveVariantId, target_instance_id,
signature_id, ordered_ability_ids, crit_or_deck_position_id
```

Each output tuple must retain these digests/checksums:

```text
assessment_units_register_digest, ttk_register_digest,
combo_register_digest, rules_catalog_digest, plan.identity,
input_tape_digest, observer_implementation_digest,
observer_equivalent_canonical_digest, expected_tuple_manifest_digest,
local_export_checksum
```

The generator must emit a retained failure row for any missing, extra, duplicate, or mismatched tuple. It must not infer a pressure band, map/wave plan, target, terminal outcome, deck/RNG position, or comparator member.

## Collection blockers

1. A separate owner must regenerate expected tuples and digests from the updated finite registers.
2. The runner must export the required terminal, committed-plan, wave-variant, target spawn/kill, M4, cooldown, and M6 linkage fields without authoritative state writes.
3. QA and programmer countersignatures are required before collection; the director remains post-review only.
4. Raw corpus, source-integrity review, and independent metric review remain absent.

Until all blockers are resolved, **G2 is `NOT MEASURED / NOT PASSED` and Stage 2 is `REDO`**.
