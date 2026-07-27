# Stage 1b Cinder Pressure and Agency — Final Measurement Report

## Disposition

**Overall disposition: BLOCKED.**

This report closes the measurement cycle; it does not promote the packet. The canonical verdict is:

`_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage1b-gate-verdict-20260726.json`

Status language is strict:

- **OBSERVED** — a value recorded by the canonical verdict or its referenced G6 artifacts.
- **BLOCKED** — required evidence is absent or incomplete.
- **N/A** — the gate does not apply; this is not a pass.

All Stage 1b gameplay, pressure, formation, and persistence exports are deterministic scripted or synthetic measurement. They are **not human evidence** and do not satisfy G7 or G8.

## Canonical evaluation command

The final verdict is reproducible with this command:

```sh
node scripts/evaluate-stage1b-gates.mjs \
  --symmetric _workspace/20260726-stage1b-cinder-pressure-agency/qa/stage1b-symmetric-trials-20260726.json \
  --g3 _workspace/20260726-stage1b-cinder-pressure-agency/qa/stage1b-g3-stance-events-20260726.json \
  --pressure _workspace/20260726-stage1b-cinder-pressure-agency/qa/stage1b-pressure-packets-20260726.json \
  --persistence _workspace/20260726-stage1b-cinder-pressure-agency/qa/stage1b-persistence-scenarios-20260726.json \
  --g7 _workspace/20260726-stage1b-cinder-pressure-agency/study/g7-session-observer-template.json \
  --g8-survey _workspace/20260726-stage1b-cinder-pressure-agency/study/g8-direct-feature-survey-template.json \
  --g8-impression _workspace/20260726-stage1b-cinder-pressure-agency/study/g8-impression-session-template.json \
  --g6-provenance _workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-provenance-20260726.json \
  --g6-scenario _workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-scenario-20260726.json \
  --g6-fullapp _workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-fullapp-isolated-20260726.json \
  --g6-leak _workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-leak-20260726.json \
  --g6-soak _workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-soak-30m-isolated-20260726.json \
  --output <verdict.json>
```

The command was re-run against the listed inputs during this authoring pass. It returned `BLOCKED`, and its output matched the canonical verdict. The focused exporter/evaluator command also completed successfully:

```sh
node --test tests/stage1b-evidence-exporters.test.mjs tests/stage1b-gate-evaluator.test.mjs
```

Passing focused tests establish that the evidence and evaluator contracts execute. They do not override any gate verdict below.

## Exact gate table

| Gate | Status | Threshold, preserved verbatim | Final measurement | Evidence |
|---|---|---|---|---|
| G2 | **FAIL** | each archetype 9-11 explicit wins out of 20 canonical symmetric pairs; ties are not wins; 15 pressure rows each gateMinPct 55.0-80.0%, 0-3 defeats, and MEASURED boss TTK 5.95-8.05 seconds | **OBSERVED:** explicit wins are bulwark `4/20`, conductor `14/20`, gambit `7/20`, rift `5/20`, striker `20/20`; every archetype misses `9-11/20`. Pressure has the exact row failures listed below, `2/15` defeats, and `13` measured boss TTKs. | `qa/stage1b-symmetric-trials-20260726.json`; `qa/stage1b-pressure-packets-20260726.json`; canonical verdict `gates.G2` |
| G3 | **FAIL** | BOSS_RALLY_COOLDOWN_REDUCTION=0, one TURRET FRONT, 50/50 post-switch damage conversions, at least one control COMPANION_DOWNED, combined control defeat rate <=20%, and legal combo maxEV/medianEV <=1.30 | **OBSERVED:** all `50/50` rally-to-TURRET conversions were not exposed and had zero post-switch damage; TURRET FRONT count was `1`; cooldown reduction was `0`; VANGUARD+SPLIT controls had `0` companion downs and `12/100` defeats; legal-combo maxEV/medianEV was `2040/1200 = 1.70`. | `qa/stage1b-g3-stance-events-20260726.json`; `qa/stage1b-symmetric-trials-20260726.json`; canonical verdict `gates.G3` |
| G5 | **N/A** | No G5 threshold is declared in the canonical verdict. | **N/A:** `monetizationSurfaceIntroduced=false`. This is not PASS. | canonical verdict `gates.G5` |
| G6 | **FAIL** | all full-app tiers and 30-minute soak p95 frame <=16.7ms, long-frame ratio <0.5%, input p95 <=100ms, stable soak memory; DOM <5000; telemetry, rollback, release-readiness, and UI-browser provenance complete | **OBSERVED:** full-app and soak measurements are isolated. Desktop and both mobile proxy tiers miss at least one frame threshold; the shipped-mobile tier does not remove the all-tier requirement. The soak records `0.1138 MiB/min` and `memoryStable=false`. Rollback-runbook and release-readiness PASS provenance are absent. | G6 artifacts listed below; canonical verdict `gates.G6` |
| G7 | **BLOCKED** | at least 14 voluntary re-entries out of 20 eligible decisions across 10 participants; every circuit 30-180 seconds; at least 3 distinct player actions and at least 1 `ELITE_EXTRACTED` reward event per decision | **BLOCKED:** `0/10` participants, `0/20` eligible decisions, and `0/14` voluntary re-entries. Action/reward minimums are unmeasured because the supplied file is a blank template, not human evidence. | `study/g7-session-observer-template.json`; canonical verdict `gates.G7` |
| G8 | **BLOCKED** | five sourced titles with direct-feature count <=2/5 and ten first-exposure raw scores with median >=4.0/5 | **BLOCKED:** direct-feature survey `0/5`; first-exposure scores `0/10`; median unavailable. The supplied files are templates, not human evidence. | `study/g8-direct-feature-survey-template.json`; `study/g8-impression-session-template.json`; canonical verdict `gates.G8` |

## Instrumentation readiness

Readiness is reported separately from outcome gates. These two instrumentation checks are ready; G2, G3, G6, G7, and G8 are not promoted by that readiness.

| Instrumentation surface | Status | OBSERVED coverage | Durable artifact |
|---|---|---|---|
| Pressure packets | **OBSERVED — readiness PASS only** | `15/15` planned runs and `45` packets | `_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage1b-pressure-packets-20260726.json` |
| Persistence scenarios | **OBSERVED — readiness PASS only** | `3` scenarios and `2` accepted handoffs | `_workspace/20260726-stage1b-cinder-pressure-agency/qa/stage1b-persistence-scenarios-20260726.json` |

The persistence artifact covers victory, defeat after acceptance, and defeat before acceptance through a synthetic controller. It establishes the scripted persistence evidence surface only; it does not establish voluntary player behavior.

## G2 failure detail

### Symmetric archetype results

| Archetype | OBSERVED explicit wins | Required |
|---|---:|---:|
| bulwark | `4/20` | `9-11/20` |
| conductor | `14/20` | `9-11/20` |
| gambit | `7/20` | `9-11/20` |
| rift | `5/20` | `9-11/20` |
| striker | `20/20` | `9-11/20` |

All five archetypes fail the explicit-win envelope. Ties are recorded separately and are not credited as wins.

### Exact pressure failure list

The canonical verdict records these gate-minimum failures:

| Stance/seed | OBSERVED gateMinPct | Required |
|---|---:|---:|
| VANGUARD/401 | `89.8` | `55.0-80.0` |
| VANGUARD/402 | `99` | `55.0-80.0` |
| VANGUARD/403 | `99` | `55.0-80.0` |
| VANGUARD/404 | `87` | `55.0-80.0` |
| VANGUARD/405 | `88` | `55.0-80.0` |
| TURRET/401 | `88.6` | `55.0-80.0` |
| TURRET/402 | `89` | `55.0-80.0` |
| TURRET/403 | `87` | `55.0-80.0` |
| TURRET/404 | `87` | `55.0-80.0` |
| TURRET/405 | `88` | `55.0-80.0` |
| SPLIT/401 | `49.6` | `55.0-80.0` |
| SPLIT/402 | `0` | `55.0-80.0` |
| SPLIT/403 | `0` | `55.0-80.0` |

SPLIT/402 and SPLIT/403 also record `NOT_SPAWNED_DEFEAT/null` boss TTK instead of a required measured `5.95-8.05` second value. Across the pressure set, the verdict records `2/15` defeats and `13` measured boss TTKs. The allowed defeat band does not compensate for the gate-minimum and missing-TTK failures.

## G3 failure detail

- **OBSERVED rally conversion:** `50/50` rally-to-TURRET conversions were not exposed, and all `50/50` had zero post-switch damage.
- **OBSERVED retained constraints:** every recorded TURRET FRONT count is `1`, and every recorded boss rally cooldown reduction is `0`.
- **OBSERVED control consequence:** VANGUARD+SPLIT controls recorded `0` `COMPANION_DOWNED` events. The controls recorded `12/100` defeats, within the `<=20%` ceiling, but the required companion-down consequence is absent.
- **OBSERVED dominance:** the legal-combo sample records maxEV `2040`, medianEV `1200`, and maxEV/medianEV `1.70`, above `1.30`.

These are independent failures: retaining one TURRET FRONT, zero rally cooldown reduction, and an in-ceiling control defeat rate does not satisfy the missing exposure, damage, companion-down, or EV requirements.

## Focused, browser, and performance evidence

### Focused telemetry contract

The G6 provenance artifact records:

```sh
node --test tests/defense-observers-contract.test.mjs
```

**OBSERVED:** `11` pass, `0` fail. Durable output:

`_workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-telemetry-contract-20260726.tap`

This satisfies the telemetry-contract provenance component only.

### UI browser gate

The G6 provenance artifact records:

```sh
node tests/defense-performance-browser.cjs
```

**OBSERVED:** the focused browser gate passes at `844x390` and `2056x1082`. Durable output:

`_workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-ui-browser-gate-20260726.json`

This satisfies the focused UI-browser provenance component only. It does not replace the all-tier full-app or soak requirements.

### Isolated full-app performance

The isolated full-app artifact records `measurementIsolation.status=ISOLATED` and the preflight command:

```sh
pgrep -fl 'node.*(test|run-g[236]|run-stage1b)'
```

The preflight result is `NO_MATCHES_EXIT_1`.

| Tier | Frame delta p95 | Long-frame ratio | Input p95 | DOM nodes | Assessment against G6 |
|---|---:|---:|---:|---:|---|
| desktop-m2pro-dsf1 | `16.8 ms` | `0.00196` | `0.4 ms` | `100` | **FAIL:** frame p95 exceeds `16.7 ms`. |
| shipped-mobile-dsf2 | `16.7 ms` | `0.0014` | `0.3 ms` | `100` | No listed metric failure, but G6 requires all tiers. |
| midtier-mobile-proxy-dsf2-cpu4x | `33.3 ms` | `0.02106` | `1.7 ms` | `103` | **FAIL:** frame p95 exceeds `16.7 ms`; long-frame ratio is not below `0.005`. |
| low-mobile-proxy-dsf2-cpu6x | `50 ms` | `0.19329` | `2.7 ms` | `109` | **FAIL:** frame p95 exceeds `16.7 ms`; long-frame ratio is not below `0.005`. |

Durable output:

`_workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-fullapp-isolated-20260726.json`

### Isolated soak and supplemental performance artifacts

The isolated soak records:

- **OBSERVED duration:** `1807155 ms`, against minimum `1800000 ms`.
- **OBSERVED frame delta p95:** `16.7 ms`.
- **OBSERVED long-frame ratio:** `0.000903`.
- **OBSERVED input p95:** `2.3 ms`.
- **OBSERVED heap slope:** `0.1138 MiB/min`.
- **OBSERVED stability classification:** `memoryStable=false`.

The soak therefore does not establish stable memory even though its duration, frame p95, long-frame ratio, and input p95 are recorded. Its isolation preflight is the same `pgrep` command above with `NO_MATCHES_EXIT_1`.

Durable performance artifacts:

- `_workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-soak-30m-isolated-20260726.json`
- `_workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-scenario-20260726.json`
- `_workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-leak-20260726.json` — supplemental leak evidence, `40` generations
- `_workspace/20260726-stage1b-cinder-pressure-agency/qa/g6-provenance-20260726.json`

The capture command is not embedded in the full-app or soak artifacts, so this report does not invent one. The artifacts themselves and their evaluator digests are the durable evidence.

## Unresolved blockers

### G2 — FAIL

- All five archetypes miss the `9-11/20` explicit-win envelope.
- The exact pressure list above contains every gate-minimum failure recorded by the canonical verdict.
- SPLIT/402 and SPLIT/403 have no measured boss TTK.

### G3 — FAIL

- `50/50` rally-to-TURRET conversions have zero post-switch damage and no exposure.
- VANGUARD+SPLIT controls have no `COMPANION_DOWNED` event.
- Legal-combo maxEV/medianEV is `1.70`, above `1.30`.

### G6 — FAIL

- Rollback-runbook PASS provenance with a path and SHA-256 digest is missing.
- Release-readiness PASS provenance with a path and SHA-256 digest is missing.
- Desktop frame p95 is `16.8 ms`, above `16.7 ms`.
- Midtier mobile proxy frame p95 is `33.3 ms`, above `16.7 ms`, and long-frame ratio `0.02106` is not below `0.005`.
- Low mobile proxy frame p95 is `50 ms`, above `16.7 ms`, and long-frame ratio `0.19329` is not below `0.005`.
- Soak heap slope/status does not establish stable memory at `0.1138 MiB/min`.

### G7 — BLOCKED

- Canonical study metadata and completed human sessions are absent.
- Evidence remains `0/10` participants, `0/20` eligible decisions, and `0/14` voluntary re-entries; the required `>=3` distinct player actions, `>=1` `ELITE_EXTRACTED` reward event, and inclusive `30-180 s` circuit duration are therefore unmeasured.
- The observer file is a template. No synthetic artifact is relabeled as human evidence.

### G8 — BLOCKED

- The canonical five-title collection is incomplete: `0/5`.
- The canonical first-exposure study is incomplete: `0/10`, with no median.
- The supplied files are templates. No human-evidence claim is made.

## Close decision

The measurement system is ready enough to expose failures, but the Stage 1b packet is not ready to advance. G2, G3, and G6 are **FAIL**; G7 and G8 are **BLOCKED**; G5 is **N/A, not PASS**. The packet returns to director review, and the next public beat remains deferred.
