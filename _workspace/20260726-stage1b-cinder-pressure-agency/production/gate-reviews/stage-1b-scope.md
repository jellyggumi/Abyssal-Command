# Stage 1b Scope Review — Cinder Pressure and Agency

run-id: `20260726-stage1b-cinder-pressure-agency`
date: `2026-07-26`
status: **DRAFT — DIRECTOR REVIEW REQUIRED**
source: `../20260726-stage2-balance-agency/production/decision-log.md#d-20260726-s2c-03`

## Decision boundary

This is a concept/architecture and instrumentation packet. It is **not** authorization to change Cinder numbers. No new `defense-catalog.js` or `rpg-catalog.js` values are approved by this document.

## Evidence reviewed

- Final Stage 2 summary: `../20260726-stage2-balance-agency/qa/post-retune-derived-summary.json`.
- Final QA measurements: `../20260726-stage2-balance-agency/qa/gate-measurements.md#final-d-20260726-s2c-02-remeasurement`.
- Final director disposition: `../20260726-stage2-balance-agency/production/decision-log.md#d-20260726-s2c-03`.
- Runtime diagnosis: Cinder pressure reaches growth without an offer for SPLIT seed 403; boss pressure grace explains the exploit probe's zero post-switch damage; targetability is active but companion exposure is under-calibrated.

## Scope acceptance checklist

| Requirement | Packet evidence | Status |
|---|---|---|
| Authored pressure model with packet-level attribution | `design/pressure-agency-redesign.md` §3.1 | DRAFT |
| Formation phase attribution from accepted switch event | `design/pressure-agency-redesign.md` §3.3; `engineering/instrumentation-contract.md` | DRAFT |
| Explicit TTK non-spawn status | `engineering/instrumentation-contract.md` required checks | DRAFT |
| Symmetric paired-trial and legal-combo EV surface | `design/pressure-agency-redesign.md` §4; task manifest | DRAFT |
| Three persistence scenarios with state diffs | `engineering/instrumentation-contract.md` `persistenceScenario` | DRAFT |
| G7 rendered 10/20/14 protocol | `study/rendered-study-protocol.md` | DRAFT |
| G8 five-title plus ten-session protocol | `study/rendered-study-protocol.md` | DRAFT |
| Frozen boundaries and no-monetization policy | all packet artifacts; task manifest hard policy | PASS (scope text only) |

## Director gate

**NO GO pending review.** A director must either approve this packet for instrumentation-only implementation or return it with concrete scope edits. Approval must not be interpreted as approval of any gameplay retune.

## Required next evidence after approval

1. Correct G3 probe attribution and explicitly mark boss-grace conversions as `NOT_EXPOSED`.
2. Correct G7 synthetic input policy so passive skills are not queued as active casts and deduplicate macro reward boundaries.
3. Repair the stale extraction fixture under the current signed pressure model without weakening its behavioral assertion.
4. Add deterministic persistence trace/state-diff scenarios for victory, defeat after accepted extraction, and defeat before acceptance.
5. Run focused tests and only then draft any future data proposal as a separate director decision.
