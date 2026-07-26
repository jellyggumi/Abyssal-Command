# Cinder Span — stage and control specification

run-id: `20260725-defense-rpg-development`  
owner: game designer  
status: deterministic vertical-slice direction; no runtime pass claim

## Purpose and boundaries

This is one bounded presentation/control slice for `cinder-span`, built from the existing stage contract and retained resource paths. It does not add a rules authority: `defense-run-simulation.js` owns events/outcomes, `campaign-state.js` owns persistent handoff, and UI/renderer/audio observe snapshots and queued input only. It introduces no network, accounts, commerce, paid power, new catalog values, generated art, or new asset registry.

**Known state:** current engaged receipts reach extraction in 9/9 runs, but Cinder Span lasts **26.90–27.70 s** in three samples. That is below the 30-second G7 lower bound. This spec labels the intended measurement; it does not count those samples as a completed loop.

```yaml
slice: cinder-span-readable-defense-offense-rpg
status: proposed_not_measured
stage_id: cinder-span
rules_authority: defense-run-simulation.js
campaign_authority: campaign-state.js
measurement_window:
  start: first_combat_input_tick
  end: accepted_reward_tick
  duration_s_band: [30, 180]
  current_cinder_span_observation_s: [26.90, 27.70]
  current_cinder_span_qualifies: false
required_deliberate_action_classes_min: 3
required_accepted_reward_events_min: 1
primary_touch_target_min_css_px: 44
priority_objects_visible_without_modal: [gate, priority_threat, safe_route, domain, extraction]
timeline_measurements:
  windows_s:
    defend_and_scout: [0, 15]
    pressure_or_domain: [15, 30]
    growth_choice: [30, 55]
    bind_opportunity: [45, 75]
    boss_and_reward: [70, 180]
  cinder_sub_30_receipt_is_qualifying: false
  future_accept_reject_receipt: qa/evidence/g7-engaged-4hz-current.json_or_successor
portrait_safe_area:
  current_test_expected_css_px: 11
  current_test_observed_css_px: 59
  current_test_passed: false
  future_accept_reject_command: node tests/defense-hud-responsive-browser.cjs
visual_pass_claim: false
human_comprehension_claim: false
```

## Stage read — one camera, five answers

| Player question | World/UI response | Deterministic data source | Presentation rule | Future measurement |
|---|---|---|---|---|
| What fails first? | **Gate** integrity on the defensive end; text `Gate current/max`, integrity bar, and Gate icon/shape. | Gate snapshot fields. | Never replace text with a color-only state. | Browser capture asserts a visible labeled Gate element during combat and terminal cause trace includes Gate if it ends the run. |
| What must I answer now? | **Priority threat**: a named, target-marked gate-pressure or low-HP-focus enemy with route arrow and intent timer/order. | Enemy policy/target and tick in simulation event/snapshot. | Exactly one highest-priority callout; secondary enemies stay non-blocking. | Snapshot-to-DOM test validates one priority marker and source event; human comprehension is separately unmeasured. |
| Where can I retreat or rotate? | **Safe route**: solid chevron/ribbon from current player region to authored `cinder-center` intercept or `cinder-overlook` recovery geometry. | Existing stage terrain/objective semantics; chosen route is observer output, never a pathfinding authority. | Route must be visible while a threat is active and never hide Gate label. | Camera/HUD rectangle test verifies both route and Gate are visible without modal. |
| What changes my tactical geometry? | **Domain**: `cinder-seal` with hold/contest status, numeric capture progress, and its existing authored effect label. | Domain occupation state/events. | Show `unsecured / contesting / captured`; use text plus shape; no decorative-only feedback. | Trace records `OCCUPATION_PROGRESS|CAPTURED|INTERRUPTED` and screenshot validates label. |
| What is the high-risk reward action? | **Extraction**: Cinder elite candidate, `cinder-bind` point, 600-tick candidate lifetime, Bind progress, and success/expiry status. | Authoritative candidate/extraction events. | Candidate, point, countdown, and interruption reason remain visible through reduced motion. | Trace records candidate → request → accepted/rejected/expired → `ELITE_EXTRACTED` where applicable. |

## Control feedback contract

The scene may use retained `cinder-span.glb`, the world plates, existing GLBs, and procedural audio only through current rendering paths. They are presentation candidates, not state writers.

| Intent | Countable input | Immediate observer feedback | Failure feedback | Acceptance evidence |
|---|---|---|---|---|
| Defend / reposition | `MOVE` region transition | Route chevron updates; Gate/threat labels remain visible; existing `MOVE` audio cue may observe. | If a route is blocked or the Gate is damaged, show source and amount in event feed. | Accepted-input row + positional/region change event. |
| Commit build response | `SKILL_SELECTED` then optional `SKILL_CAST` | Three choices show `current → upgraded`, run scope, and one confirm target; cast state/cooldown appears after acceptance. | Rejection reports eligibility/cooldown; no speculative stat change. | `SKILL_SELECTED` and/or `SKILL_CAST` authoritative events plus growth-delta browser test. |
| Trade safety for objective | `DOMAIN_OCCUPY` and `EXTRACT_ELITE` | Domain progress or Bind progress numerically advances only from snapshot state. | Contest/interruption/expiry names the interrupting threat and remaining time; it does not grant a companion. | Occupation/extraction event chain in deterministic trace. |

`MOVE`, growth selection/cast, and Domain/Bind are three distinct deliberate-action classes. Auto-attacks, passive damage, audio, camera motion, and overlay dismissal are not actions.

## Cinder Span measured beat map

The time cells define what must be observed; they do not alter current catalog timing. A run is eligible only if the trace reaches an accepted reward inside the band.

| Window from first input | Required decision read | Intended action class | Required state/feedback | Failure visible if missed |
|---:|---|---|---|---|
| 0–15 s | Gate ingress and priority threat | `MOVE` | Gate/Warden current/max, route arrow, threat target/intent. | Gate breach event names pressure source. |
| 15–30 s | decide safe intercept versus recovery/Domain route | `MOVE` or `DOMAIN_OCCUPY` | `cinder-seal` state and contest indicator. | Interrupted occupation names contesting pressure. |
| 30–55 s | accept one current-to-upgraded build choice; rotate/cast for it | `SKILL_SELECTED` / `SKILL_CAST` | Three cards with value delta and run scope. | Unavailable/rejected action reports reason; no changed value before acceptance. |
| 45–75 s | choose whether the elite Bind is worth leaving the Gate | `EXTRACT_ELITE` | Candidate, `cinder-bind`, 600-tick expiry, progress. | Expiry/interruption preserves run state and names outcome. |
| 70–180 s | preserve Gate/Warden against Cinder Warden and accept stage reward | `MOVE_OR_SKILL_CAST`, then reward selection | Boss intent, Gate/Warden risk, terminal/reward scope. | Terminal card shows cause, min integrity states, companion status, retry/return. |

The overlap is intentional; Cinder does not pause to present a menu. If a run reaches reward before 30 seconds, it receives `FAIL_DURATION`, not `QUALIFY`.

## Mobile and accessibility measurement plan

| Surface | Gate-checkable target | Current evidence | Future reject/accept method |
|---|---:|---|---|
| Primary controls (move, cast, Bind, confirm/cancel) | ≥44 × 44 CSS px | Not cleared: the portrait responsive test aborted. | `node tests/defense-hud-responsive-browser.cjs` must complete and report all critical target rectangles. |
| Portrait top cutout | Existing test fixture must pass | **FAIL:** `59 !== 11`; target-size coverage was not emitted. | Rerun that exact test after UI correction; do not replace it with a screenshot-only claim. |
| Five priority objects | five visible without modal | No current numeric coverage. | Browser test emits a bounding rectangle/visibility record for Gate, priority threat, safe route, Domain, extraction. |
| Growth choice | three cards with `current → upgraded` | 1/1 focused browser test passed. | Keep `node --test tests/defense-stat-delta-browser.test.mjs`; it does not clear portrait or human readability. |
| Reduced motion / no audio | status semantics retained | No current Cinder-specific receipt. | Browser/snapshot test verifies labels and terminal/extraction status with optional audio unavailable. |

## Defect response map

| Defect | Response in this spec | Required evidence before closure |
|---|---|---|
| X-01 | The same visible threat/route/control states feed the shared adversarial tape; UI never supplies outcome state. | `design/balance-sheet.md` tape receipt, not a visual claim. |
| X-02 | Preserve the 30–180 s measurement window and label sub-30 Cinder as failure; force three action classes and one accepted reward in the trace. | `measure-g7-core-loop` output with Cinder duration ≥30 s plus human voluntary-repeat study still pending. |
| X-03 | Keep critical objects modal-free and primary controls ≥44 CSS px; retain the current portrait failure verbatim. | Passing responsive browser receipt, including top-cutout assertion and target coverage. |
| D-01 | Make Bind a visible player-closed action with candidate, point, countdown, success/expiry, and scope-separated companion result. | 9/9 reachability can be rerun; G8 remains blocked until human impression evidence exists. |

## Handoff slice

The bounded implementation handoff is: **render only the five Cinder semantic markers and route all three action classes through existing input/event paths, then emit the listed evidence fields.** No stage tuning, generated art ingestion, catalog mutation, new simulation authority, or gate-PASS claim is included.
