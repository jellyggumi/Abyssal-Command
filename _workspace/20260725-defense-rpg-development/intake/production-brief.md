# Stage 2 Intake — Defense/RPG Development

run-id: `20260725-defense-rpg-development` · director · 2026-07-25

## Intake schema

| field | value |
|---|---|
| game_type | Mobile-first, single-player 2.5D defense-survivor/RPG campaign; deterministic 60 Hz simulation with WebGL presentation |
| team_shape | Solo operator with harness lanes: director, game designer, balance/telemetry engineer, UI/UX designer, asset/provenance engineer, QA/verifier |
| engine | Vanilla JavaScript + three.js/WebGL on a static/offline page; Blender/GLB pipeline is optional authoring only |
| current_stage | **Stage 2 — retune/develop.** Stage 1 verification closed with every gate unresolved: G1–G7 FIX and G8 frequency PASS / impression BLOCKED (`_workspace/20260725-wellmade-verification/production/gate-reviews/stage-gate-review.md`) |
| next_public_beat | Re-measure the four Tier-0 fixes (`0.1` strings, `0.2` reachable `EXTRACT_ELITE`, `0.3` pedestal removal, `0.4` skeleton disposal), then expose a readable defense/offense + RPG slice with a measured 30–180 s loop, at least three deliberate action classes, and at least one accepted reward |
| source_packet | `_workspace/20260725-wellmade-verification/production/gate-reviews/stage-gate-review.md`; `_workspace/20260725-wellmade-verification/production/improvement-backlog.md`; `_workspace/20260722-defense-survival-expansion/design/core-loop.md`; `_workspace/20260722-defense-survival-expansion/design/gameplay-contract.md`; `_workspace/20260722-defense-survival-expansion/design/balance-sheet.md`; `app.js`; `defense-run-simulation.js`; `defense-catalog.js`; `rpg-catalog.js`; `battle-realtime-three.js`; `styles.css`; `assets/images/battle/pilot/dusk-warden-cartoon-albedo.provenance.json` |
| main_constraint | Preserve the existing deterministic, offline, observer-only architecture and explicit no-commerce boundary. Runtime state stays in the simulation/campaign authorities; UI, audio, renderer, and generated media may observe but may not author outcomes |
| main_question | Can the four cheap blocking defects be fixed and re-measured before Tier 1 art work, while a player can read and complete a real defense/offense + RPG loop without inventing research or human-impression evidence? |

## Evidence boundary

**Observed facts.** The latest review records 0 defeats in 700 stage clears, an unreachable `EXTRACT_ELITE`, a modelled 60 s circuit measured at 0.02 s with zero actions, low-tier mobile p95 24.2 ms with 8.302% long frames, and one leaked texture per actor spawn (`stage-gate-review.md`; `improvement-backlog.md`). The existing contracts define the simulation/UI ownership split and the 30–180 s, ≥3-action, ≥1-reward receipt (`design/core-loop.md`; `design/gameplay-contract.md`).

**Design inference.** Stage 2 should spend its first public beat on Tier 0 correctness and observability, then prove defense/offense readability and RPG choice value in the existing architecture. This is a proposed execution order, not a new gate result.

**Not evidence yet.** No human-impression score, voluntary-repeat receipt, or new gate PASS exists in this run. Research comparisons are public-description references, not runtime evidence. Generated GTI output is concept-only and is not shipped art; see `engineering/resource-provenance.md`.

## Non-goals

- No network, account, paid branch, commerce, reroll purchase, or monetized power.
- No parallel rules engine, renderer-authored outcomes, or replacement campaign model.
- No Tier 1 art authoring before the Tier 0 scale/runtime fixes are re-measured.
