# G2 full-route offense attribution contract — proposed / unverified

**Recorded:** 2026-07-22  
**Owner:** game PM (attribution and no-commercial-change boundary); game QA (collection and validation); game programmer (read-only full-route runner and observer export)  
**Status:** **PROPOSED / UNVERIFIED — G2 `NOT MEASURED / NOT PASSED`**  
**Authority boundary:** This is a preregistration for measurement only. It authorizes no gameplay, catalog, reward, idle-return, monetization, provider/network, release, or gate-status change.

## Purpose and non-claims

This contract freezes how a future **complete full-route** G2 corpus attributes (1) total offense, (2) active-skill EV, and (3) active-skill cooldown share. It does not measure a result, choose a target band, infer a retune, or reinterpret the bounded 360-tick Cinder Span diagnostic as full-route evidence.

All threshold language and all fixture values below are **proposed / unverified** until the required corpus is collected and independently reviewed. The current diagnostic JSONL is evidence of bounded event retention only; its manifest remains `INCOMPLETE` / `NOT_PASSED`.

## Frozen deterministic calculation inputs

Each eligible full-route run must record this immutable input identity before tick 0. A missing, changed, or unverified value makes the row `INVALID_MISSING_EVIDENCE`; it contributes to neither numerator nor denominator.

| Input | Frozen value or required identity | Owner | Evidence source / path | Blocker if absent or unequal |
| --- | --- | --- | --- | --- |
| Rules and clock | `defense-catalog.js` rules authority; integer simulation at `60 Hz`; `rules_version`, `source_revision`, simulator/build hash, `rules_catalog_digest`, serializer/event schema versions | game programmer; QA verifies | `qa/gate-measurements.md`; `design/balance-sheet.md`; future `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` | Any non-60 Hz authoritative result, digest/version mismatch, or observer/write influence |
| Analytic profile | `budget_id=g2-measurement-fixture-budget-v1`; one of Bulwark, Striker, Gambit, Conductor, Rift; full fixture tuple including max integrity, basic damage/cadence, crit chance/multiplier, one listed active skill, and fixture cooldown | game designer freezes; game QA selects | `design/balance-sheet.md` § Phase 2b G2 measurement-fixture decision; `pm/negotiation-record.md` PMD-06 | No equal-budget fixture ID, unknown profile, undocumented override, or normal-run loadout |
| Route population | Signed assessment-unit ID; stage/objective/cohort; map key or seed; wave/pressure tape; target instance IDs; terminal-outcome mapping; starting-state band; deck/critical scheduler position | game QA + game designer sign | `qa/g2-canonical-preregistration.md` § Required decisions before a full collection | Unsigned assessment unit, terminal mapping, TTK cohort mapping, or coverage matrix |
| Player action | Normalized input-policy ID, input-tape ID and digest, movement policy, active-skill decision/cast order, and cooldown C-1/C/C+1 case where declared | game QA | `qa/expanded-stage-test-plan.md` A05–A07; future canonical G2 JSONL | Missing tape/digest, undeclared manual aim/target choice, or a comparison across different policies |
| Read-only observer cell | Observer ID/mode (A, B, disabled), renderer cadence, reduced-motion, audio/caption mode, and canonical checkpoint/replay digest | game programmer supplies; QA validates | `qa/expanded-stage-test-plan.md` A01; `qa/g2-canonical-preregistration.md` § Frozen calculation rules | Different canonical state, RNG/deck position, ready ticks, or digest across observer cells |

## Attribution event boundary

### Eligible resolved-offense event

An event may enter any offense calculation only when all of the following fields are present and valid:

```yaml
required_resolved_offense_fields:
  event_id: immutable and unique within run
  sim_tick: non-negative integer
  source_actor_id: fixture commander instance
  source_kind: basic | active_skill
  active_skill_id: required when source_kind=active_skill; null otherwise
  cast_instance_id: required when source_kind=active_skill
  causal_root_id: required when source_kind=active_skill
  target_actor_id: hostile target instance
  target_spawn_event_id: linked spawn identity
  base_damage: non-negative integer
  final_damage: non-negative integer
  resolution_state: resolved
  rules_catalog_digest: equals frozen run digest
  assessment_unit_id: equals frozen run identity
```

`event_id` is counted exactly once. A multi-target or multi-hit active cast contributes one row per target-level resolved-damage event; no cast, projectile-impact, animation, or snapshot count may substitute for missing `final_damage`. A target despawned before resolution produces no inferred damage. Damage is attributed at the recorded resolution tick, never at cast tick, render time, wall-clock time, or cooldown-ready tick.

### Total-offense boundary — proposed / unverified

For one eligible run and one signed assessment unit:

```text
TotalOffenseFinalDamage = Σ final_damage(e)
  for every eligible resolved-offense event e
  where source_actor_id is the fixture commander
    and source_kind ∈ {basic, active_skill}
    and target_actor_id is a hostile target
    and e occurs from route start through the recorded terminal outcome
```

This is a **damage-output** denominator, not a score, kill count, survival value, health restoration, shield value, or expected-DPS formula. It includes qualifying basic and qualifying active-skill final damage only. It is segmented by profile × signed assessment unit × seed/deck-position population × input policy × observer cell; pooling across those segments is prohibited.

### Active-skill EV boundary — proposed / unverified

For a declared active-skill cast instance `c`:

```text
ActiveSkillEV(c) = Σ final_damage(e)
  for eligible resolved-offense events e
  where source_kind = active_skill
    and e.active_skill_id = fixture.active_skill_id
    and e.cast_instance_id = c
    and e.causal_root_id = c.causal_root_id
```

A signed combo instance is an ordered, finite set of declared cast instances and causal roots. Its EV is the sum of `ActiveSkillEV(c)` across that set. The future comparator median uses only signed comparable combos with the same profile, assessment unit, target cohort, input policy, seed/deck-position population, and observer-equivalent canonical digest. The current one-skill diagnostic cannot define a multi-skill comparator set and cannot support the proposed `≤1.30 × median` combo rule.

### Cooldown attribution and share — proposed / unverified

Cooldown observer records are required to establish that each cast was legal, but cooldown records themselves add **zero** offense damage. For every included active cast, retain:

```yaml
required_cooldown_fields:
  ability_id: equals fixture.active_skill_id
  cast_instance_id: joins the active resolved-damage events
  prior_ready_tick: integer
  cooldown_set_tick: integer
  configured_cooldown_ticks: integer
  ready_tick: integer
  state: SET | READY
```

The proposed active-skill cooldown share for one segmented assessment unit is:

```text
ActiveCooldownOffenseShare =
  Σ final_damage(e) for eligible active_skill events e
  ───────────────────────────────────────────────
  TotalOffenseFinalDamage in the identical run scope
```

The numerator must reconcile to legal `SET` and `READY` records and the frozen fixture cooldown. Record C-1, C, and C+1 readiness cases separately; do not average them into a valid case. If the denominator is zero, if an active event cannot join to its cast/cooldown identity, or if a ready tick is missing or differs from the configured boundary, the share is `NOT_OBSERVED`, never `0%`. The 15–40% Conductor share is a **proposed / unverified target**, not a result or approval.

## Explicit fixture exclusions

The future full-route G2 fixture must be isolated before tick 0 and must reject, rather than silently ignore, a non-empty excluded field.

| Excluded field or behavior | Required fixture value / check | Owner | Evidence source / path | Blocker |
| --- | --- | --- | --- | --- |
| Companions and runtime items | `companion_id=null`; `item_ids=[]`; no companion, pickup, item, or hidden pre-run modifier event | game QA; game programmer supplies export | `design/balance-sheet.md` fixture common inputs; `pm/negotiation-record.md` PMD-06 | Any modifier or source actor outside fixture commander contributes offense |
| Rewards and growth | `reward_modifier_ids=[]`; no offers, campaign/permanent progression, XP, reward ledger, or reward-derived combat modifier | game PM owns boundary; QA validates | `design/balance-sheet.md` fixture boundary; `pm/negotiation-record.md` PMD-06 | Any reward/growth field delta or reward-derived offense event |
| Idle / Archive return | No idle clock, permit, receipt, settlement, return credit, save mutation, or idle-derived combat/progression field | game PM owns boundary; QA validates | `pm/negotiation-record.md` PMD-02 and PMD-06; `qa/expanded-stage-test-plan.md` A10 | Any idle/Archive input, transaction, or state delta |
| Monetization / commercial paths | No ads, purchases, paid power, paid skips, premium currency, subscription, entitlement, account, or commercial experiment field | game PM owns boundary; QA validates | `pm/negotiation-record.md` PMD-06 and non-negotiable constraints; `qa/gate-measurements.md` G5 | Any commercial route, entitlement, or price/offer field exists or changes |
| Provider and network behavior | Browser network disabled; no runtime provider SDK, host, credential, remote URL, telemetry upload, cloud sync, multiplayer, remote experiment, or account request | game programmer supplies trace; QA validates | `qa/expanded-stage-test-plan.md` A12 and A18 | Any required request, provider/credential route, or network-dependent result |
| Presentation and accessibility observers | Renderer, HUD, VFX, audio, captions, haptics, reduced-motion, and diagnostics remain read-only; they may not write rules, RNG, cooldown, reward, or outcome state | game programmer; QA validates | `qa/expanded-stage-test-plan.md` A01; `design/balance-sheet.md` fixed deterministic scope | Canonical state/digest differs by observer mode |

## No-commercial-change compliance check — proposed / unverified

Compliance is not inferred from the absence of a damage event. For each full-route evidence build, QA must retain all three checks under the same build tuple:

1. **Fixture allowlist diff:** compare the pre-run and terminal state against the frozen G2 fixture allowlist. The only accepted source profile is the fixture commander with its one listed skill; all reward, idle, commercial, account, entitlement, and provider/network fields must be absent or unchanged. A non-empty excluded-field diff invalidates the run.
2. **Static build and dependency scan:** scan source and built output for payment/ads/subscription/premium-currency/account/cloud-entitlement/remote-experiment/provider SDK/credential/remote-URL paths. Attach the exact scanner version, command, input digest, findings, and reviewed allowlist. Any unreviewed match blocks G2 evidence; this is no proof of G5 passage.
3. **Network-disabled execution trace:** run the identical full-route tuple with browser networking disabled and record every attempted request plus final canonical replay/checkpoint digest. Zero required requests and digest equality are required. A request, attempted credential route, or differing outcome blocks the run.

Required evidence is stored with the canonical G2 corpus as `commercial_change_check` rows and referenced from `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`; the broader independent network-disabled audit remains `qa/evidence/ops/network-disabled-export-trace.json`. This check preserves the no-commercial-change boundary only. It does **not** convert the fixture into G5 evidence or pass any gate.

## Collection, review, and blockers

| Required output | Owner | Method | Evidence path | Current blocker |
| --- | --- | --- | --- | --- |
| Signed full-route assessment units, terminal outcomes, TTK cohort mapping, combo comparator set, and finite coverage matrix | game QA + game designer; game PM signs the combo/commercial boundary | Sign before collection; construct expected tuples and reject missing or duplicate rows | `qa/g2-canonical-preregistration.md` plus canonical G2 JSONL manifest | Required decisions remain unsigned / absent from the preregistration |
| Full-route deterministic offense/cooldown export | game programmer; game QA runs | Emit eligible resolved-offense, cast, cooldown, terminal, observer, and exclusion-check records through terminal outcome | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` | Current corpus ends `INCOMPLETE_WINDOW` at 360 ticks |
| Attribution reconciliation | game QA | Enforce unique event IDs; join active events to legal casts and cooldown SET/READY records; recompute all three formula outputs from raw rows | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` and independent QA review receipt | Current bounded diagnostic does not supply full-route/combination coverage |
| No-commercial-change evidence | game QA; game PM reviews | Allowlist state diff + static scan + network-disabled trace under matching build tuple | Canonical G2 `commercial_change_check` rows; `qa/evidence/ops/network-disabled-export-trace.json` | No full-route tuple-bound scan/trace exists |
| Independent verdict | game-production-director after independent QA review | Verify complete signed matrix, checksum validity, observer invariance, attribution validity, and all prerequisite evidence | Director gate review referencing canonical G2 JSONL | Collection and independent review do not yet exist |

## Gate boundary

The only current conclusion is **G2 `NOT MEASURED / NOT PASSED`**. This contract creates no measured total offense, active-skill EV, cooldown share, combo conclusion, G5 conclusion, commercial-change pass, gameplay retune, release permission, or G8 human-impression result. G8 remains a separate blocked, preregistered consented human first-exposure task.

## Exact source artifacts

- `qa/g2-canonical-preregistration.md` — signed-decision prerequisites, frozen G2 formulas, and current gate boundary.
- `qa/gate-measurements.md` — authoritative G2 threshold, method, canonical evidence path, and current `NOT MEASURED / NOT PASSED` state.
- `design/balance-sheet.md` — 60 Hz integer arithmetic, equal-budget analytic fixture inputs, fixture-only isolation, and unverified cooldown/EV targets.
- `pm/negotiation-record.md` — PMD-06 measurement-only authorization, required damage/cooldown records, zero reward/idle/commerce changes, and no-provider/no-network constraint.
- `qa/expanded-stage-test-plan.md` — deterministic evidence identity, A01 observer invariance, A05–A07 combat/cooldown coverage, A10 idle boundary, and A12/A18 network/provider audit requirements.
- `production/gate-reviews/stage-2-deterministic-measurement.md` — bounded diagnostic limitation, prerequisite receipt, and maintained Stage 2 REDO / G2 `NOT MEASURED / NOT PASSED` disposition.
