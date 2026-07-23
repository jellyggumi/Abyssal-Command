# G2 assessment contract — runtime-backed planned definition

**Status:** `PROPOSED / UNVERIFIED — G2 NOT MEASURED / NOT PASSED`  
**Stage:** `Stage 2 REDO`  
**Scope:** This binds a finite future harness population to current catalog/runtime identifiers. It neither collects evidence nor authorizes a runtime/catalog, tuning, reward, idle-return, monetization, provider, network, G8, release, or gate change.

## Source-backed runtime facts

| Fact | Exact current source | Contract use |
| --- | --- | --- |
| Catalog plan descriptors | `defense-catalog.js:481-527` | Each catalog stage commits `map-plan:<stage>:v1`, `wave-plan:<stage>:v1`, and `m4-plan:<stage>:v1`. |
| Catalog stage IDs | `defense-catalog.js:443-454` | Canonical bindings use `cinder-span`, `veil-citadel`, `howling-sprawl`, `sunken-bastion`, `starless-canal`, and `gate-zenith`; Gate Zenith boss ID is `s10-abyss-regent`. |
| Committed runtime identity | `defense-run-simulation.js:1432-1497,1667-1706` | Each future row must retain `plan.identity`, `mapPlanId`, `wavePlanId`, `m4PlanId`, `waveVariantId`, stage, seed, and measurement profile ID. |
| Current terminal behavior | `defense-run-simulation.js:1391-1419` | Failure emits `TERMINAL/DEFEAT`; ordinary stage boss completion emits `TERMINAL/VICTORY`; Gate Zenith boss completion emits `TERMINAL/FINAL_COMPLETION`. There is no current `RETREAT` terminal. |
| Current M4 behavior | `defense-catalog.js:504-522`; `defense-run-simulation.js:599-665` | Every stage has two cards, occupation recovery, and `M4_CARD_INVENTORY_EXHAUSTED` fallback. Inputs are `M4_CARD_DECISION` with exact card ID and `SELECT` or `DECLINE`. |
| QA-only multi-skill fixture | `defense-catalog.js:33-50`; `defense-run-simulation.js:1456-1468` | `qa-multi-skill-measurement-v1` is QA-only, has budget `g2-measurement-fixture-budget-v1`, and initializes ordered skills `soul-lance`, `grave-pulse`. |

## Canonical finite assessment bindings

The canonical condition IDs, exact stage/plan IDs, cohort selectors, and outcome bindings are in [`g2-assessment-units-v1.json`](g2-assessment-units-v1.json). They replace stale non-source map, wave, and terminal names.

| Cohort / planned pressure | Canonical condition | Catalog stage / plans | Source-backed target binding | Terminal binding |
| --- | --- | --- | --- | --- |
| ordinary / low | `g2-condition-ordinary-low-v1` | `cinder-span`; `map-plan:cinder-span:v1`; `wave-plan:cinder-span:v1`; `m4-plan:cinder-span:v1` | Non-boss member of committed wave schedule | `VICTORY` |
| ordinary / median | `g2-condition-ordinary-median-v1` | `howling-sprawl`; matching `:v1` plan IDs | Non-boss member of committed wave schedule | `VICTORY` |
| ordinary / high | `g2-condition-ordinary-high-v1` | `gate-zenith`; matching `:v1` plan IDs | Non-boss member of committed wave schedule | `FINAL_COMPLETION` |
| elite / low | `g2-condition-elite-low-v1` | `veil-citadel`; matching `:v1` plan IDs | `s2-veil-sentinel` | `VICTORY` |
| elite / median | `g2-condition-elite-median-v1` | `sunken-bastion`; matching `:v1` plan IDs | `s4-anchor-diver` | `VICTORY` |
| elite / high | `g2-condition-elite-high-v1` | `starless-canal`; matching `:v1` plan IDs | `s7-toll-keeper` | `VICTORY` |
| stage-10 boss / low, median, high | `g2-condition-stage-10-boss-{low,median,high}-v1` | `gate-zenith`; matching `:v1` plan IDs | `s10-abyss-regent` | `FINAL_COMPLETION` |

`low`, `median`, and `high` are **SIGNED PROPOSED DESIGN INPUTS** for the listed finite conditions. The runtime exposes committed plans and wave variants, not a pressure-band field; the runner must preserve the declared condition ID instead of inferring a band.

## M4 recovery and fallback applicability

M4 is applicable to every condition above. The source-backed plan templates are:

- cards: `<stage_id>-hold-line` at `gate-defense`, then `<stage_id>-recover-echo` at `echo-recovery`;
- selected card: emit `M4_CARD_SELECTED`, enter `RECOVERY_PENDING`, and retain card/recovery/safe-lane IDs;
- recovery: transition to `RECOVERED` only at `occupation` and retain `M4_RECOVERY_CHECKPOINT`;
- declined final card: retain `M4_FALLBACK` with exact reason `M4_CARD_INVENTORY_EXHAUSTED` and the catalog safe-lane ID;
- rejected decision: retain `M4_CARD_REJECTED` without replacing the first failure.

The exact cards, recovery IDs, fallback IDs, and safe-lane IDs are catalog facts in the assessment-unit register. No card, relief, or fallback is inferred from a display label.

## M5 TTK cohort contract

[`g2-ttk-cohort-register-v1.json`](g2-ttk-cohort-register-v1.json) defines nine canonical M5 cohort mappings. For a valid target instance:

```text
TTK_ticks   = matched_kill_tick - matched_spawn_tick
TTK_seconds = TTK_ticks / 60
```

The runtime source confirms fixed simulation progress and death linkage, but every M5 linkage field and percentile result remains uncollected. A missing or unlinked spawn/kill is `NOT_OBSERVED`, never zero. Target bands remain **SIGNED PROPOSED DESIGN INPUTS** only:

- ordinary: `0.35–1.25 s`;
- elite: `6–14 s`;
- stage-10 boss: `35–90 s`; its proposed p50 global target is `51–69 s`.

There is no measured TTK, percentile, coverage, or pass/fail conclusion in this contract.

## M6 QA-only multi-skill comparator contract

[`../pm/g2-combo-comparator-register-v1.json`](../pm/g2-combo-comparator-register-v1.json) freezes the one source-backed QA-only signature:

```text
fixture_id         = qa-multi-skill-measurement-v1
ordered_ability_ids = [soul-lance, grave-pulse]
condition           = g2-condition-stage-10-boss-median-v1
```

The **finite comparator population is a signed proposed design input**, not a result: seeds `{17,18,19}` × declared combat-RNG position labels `{combat-rng-initial, combat-rng-plus-1}` = six expected candidates. The current runtime does not expose a deck-position register; those labels require a runner export and a digest before collection. A valid combo still requires linked resolved active-skill events from both ability IDs inside 120 simulation ticks. The cap remains a target (`ratio <= 1.30`), not a measured judgment.

The M6 signed role record assigns designer, PM, QA, programmer, and director responsibilities without granting collection authorization. It keeps the PM's existing offense/commercial-boundary attestation while requiring QA and programmer countersignature before a run.

## Expected-tuples regeneration — separate ownership blocker

No expected-tuples generator, runner, source, script, test, or evidence JSONL was modified here. The separate owner must regenerate from the five registers using **only** these exact fields:

```text
assessment_condition_id, profile_id, seed_id, input_policy_id,
stage_id, map_plan_id, wave_plan_id, m4_plan_id,
target_cohort_id, pressure_band_id, terminal_binding,
measurementProfileId, target_instance_id, signature_id,
ordered_ability_ids, crit_or_deck_position_id,
plan.identity, waveVariantId, rules_catalog_digest,
input_tape_digest, observer_implementation_digest,
observer_equivalent_canonical_digest, local_export_checksum
```

It must retain the corresponding assessment-register, TTK-register, comparator-register, rules-catalog, plan-identity, and expected-manifest digests. Missing, extra, duplicate, or mismatched tuples are retained first failures; none may be invented, dropped, or aggregated away.

Until that runner/register work, raw collection, source-integrity review, and independent metric review occur, **G2 remains `NOT MEASURED / NOT PASSED` and Stage 2 remains `REDO`**.
