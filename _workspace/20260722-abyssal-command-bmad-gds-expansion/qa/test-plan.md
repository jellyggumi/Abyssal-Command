# QA Stage 1 test plan — Cinder Span Command Feedback

## Scope and evidence status

This is a future-test contract for the 90-second concept-validation slice. No fixture, implementation, human session, audio asset, provider request, or gate measurement is asserted. Rules remain deterministic at 60 Hz; `defense-catalog.js` is the sole authored rules authority. HUD/VFX/audio/narration/telemetry are observers; the product remains local/offline, movement-first automatic combat, reduced-motion-capable, W-01…W-05 canon, and Stage 10 ends the campaign.

Sources: `docs/abyssal-command-defense-survivor-design.md`; `.survey/abyssal-command-systems-expansion/{context,triage,solutions}.md`; `research/{qa-measurement-protocol,combat-systems-balance,pcg-map-grammar,wave-encounter-composition,progression-idle-economy,elevenlabs-integration,audio-narration-direction,vfx-hud-feedback,narrative-stage-presentation,controls-accessibility,telemetry-playtest-contract,stage-world-procedural,progression-rewards-idle,combat-feedback-controls}.md`.

```yaml
plan:
  id: qa-stage-1-cinder-span-v1
  status: NOT RUN
  slice_duration_s: 90
  rules_authority: defense-catalog.js
  simulation_tick_rate_hz: 60
  network_allowed: false
  live_provider_calls_allowed: false
  stages_allowed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  campaign_end_stage: 10
  observer_fields_allowed_to_differ: [presentation_timestamp, playback_outcome, render_frame]
```

## Fixture rules

Every future fixture records build ID, rules/catalog digest, serializer version, grammar version, fixed seed/MapKey, input tape, clock case, viewport/device class, input source, audio mode, reduced-motion mode, renderer/observer ID, and local-export checksum. A result without these fields is invalid—not passing. `sim_tick`, ordered input, RNG/deck cursor, MapPlan digest, offer/effect hashes, and persistent totals are compared at checkpoints.

### PCG seed corpus

Freeze a corpus before implementation, rather than counting arbitrary seeds afterward. The corpus carries the complete versioned `MapKey` (not a display seed alone), expected canonical MapPlan bytes/digest, validation predicates, objective-link ID, descriptor signature, and fixed input tape.

```yaml
pcg_seed_corpus:
  status: NOT CREATED
  minimum_complete_map_keys: 64
  generation_passes_per_key: 3
  planned_exact_comparisons: 192
  planned_stage_expansion_corpus_per_stage: 100
  required_roles: [Ingress, Orientation, Approach, ObjectiveAnchor, Gate, Resolution]
  optional_role: DetourPressure
  required_negative_predicates:
    - unmatched_port
    - unreachable_objective_anchor
    - second_primary_objective
    - missing_detour_rejoin
    - out_of_range_module
  forbidden_fallbacks: [wall_clock_seed, unrecorded_new_seed, renderer_choice]
  evidence_path: qa/evidence/pcg/MapPlanReplayCorpus.jsonl
```

## Test suites

| ID | Test and deterministic method | Required future evidence | Failure signature |
|---|---|---|---|
| T01 | Generate every corpus MapKey three fresh times, serial and deliberately permuted candidate evaluation; assert canonical MapPlan bytes/digest and validation trace. | `qa/evidence/pcg/MapPlanReplayCorpus.jsonl` | First unequal canonical field, selection trace, or a validation fallback. |
| T02 | Validate fixed stage backbone and W-01…W-05 attachment: Orientation/W-01, ObjectiveAnchor/W-02, Gate/W-03, Domain palette/W-04, Resolution reference/W-05. Verify stage plan cannot create lore, objective order, rewards, or Stage 11. | `qa/evidence/pcg/stage-world-schema.json` | Missing backbone role, unallowlisted payload, changed stage order, or Stage-10 continuation. |
| T03 | Resolve authored wave cards across each seed; lint mandatory relief, safe lanes, telegraphs, cooldown/adjacency, landmark-deck exhaustion, role rotation, and deterministic fallback ordering. | `qa/evidence/waves/schedule-lint.json` | Repeated signature beyond declared window, no relief, unreachable lane, untelegraphed denial, or nondeterministic fallback. |
| T04 | Run equal-authored-budget five-archetype sweeps: Bulwark, Striker, Gambit, Conductor, Rift hybrid. Record health window, ordinary/elite/Stage-10 TTK, total EV, cooldown share, critical drought, and combo p5/p50/p95. | `qa/evidence/combat/archetype-sweep.jsonl` | Missing profile, arithmetic mismatch, or an outlier that is only averaged away. |
| T05 | Force health full/pressured/critical/zero, normal/critical damage, cooldown C-1/C/C+1, reductions/floor, and rejected action cases. Join each result event to semantic snapshot and standard/reduced/muted projection. | `qa/evidence/combat/feedback-truth.jsonl` and captures | A health/crit/cooldown state has no event source, non-color fallback, or correct arithmetic. |
| T06 | Capture low/normal/saturated effects fixtures and inspect rank masks, critical/low-health flash rate, contrast, protected-zone intersection, player/Gate/elite bar meaning, and cooldown readiness. | `qa/evidence/presentation/mask-and-safety.json` | Tier-4 masks Tier-1, flash safety breach, color/motion-only meaning, or visual range differs from rule result. |
| T07 | Audio/narration matrix: sound-on, muted, mono, decode failure, missing local asset, reduced-motion, and caption-only. Static scan has zero ElevenLabs runtime hosts/SDKs/credentials/remote audio URLs. | `qa/evidence/audio/offline-fallback.jsonl`, `qa/evidence/audio/runtime-scan.txt` | Rule hash changes, text/caption unavailable, missing asset blocks state, provider request, or secret surface. |
| T08 | Input matrix: touch, keyboard, controller, accessibility-switch normalized streams; left/right layouts, dead-zone presets, focus/overlay open-close, held input cancellation, resize/rotation attempt, and reduced-motion/haptics-off/muted variants. | `qa/evidence/controls/input-parity.jsonl`, focus captures | Manual target/aim enters rules, stale movement remains, hidden/trapped focus, input hash differs, or target inaccessible. |
| T09 | Idle transaction matrix: 0 h, short, cap boundary, cap+1, 24 h, negative/rollback/future clock, malformed save, checksum mismatch, storage denied, two reloads, and 100 same-key reopens. Assert fixed-point recomputation, one settlement, receipt equality, allowed-field diff, and no network. | `qa/evidence/idle/return-permit-matrix.jsonl` | Duplicate/lost award, nonzero invalid elapsed award, run-state leak, UI success after save failure, or combat/progression mutation. |
| T10 | Differential replay for every representative fixture at 30/60/120 Hz rendering, normal/reduced motion, all audio presets, observer A/B/disabled, local export on/off, and two cohort labels. | `qa/evidence/determinism/observer-differentials.jsonl` | First canonical checkpoint/RNG/input/MapPlan/combat/offer/persistence mismatch. |
| T11 | Moderated readability/playtest protocol after deterministic fixtures are stable: normal, reduced-motion static, sound-off captioned, touch/keyboard/controller. Ask state/action probes and preserve assignment/missingness. | `qa/evidence/playtest/` local opt-in exports | Exposure/click is misrepresented as comprehension; cohort mismatch; unsegmented reporting. |

## Archetype rotation and planned participant cells

```yaml
archetype_rotation:
  status: NOT RUN
  profiles: [Bulwark, Striker, Gambit, Conductor, RiftHybrid]
  fixed_comparison_axes:
    - equal_authored_power_budget
    - same_rules_catalog_digest
    - same_stage_and_seed_family
    - same_starting_state_band
    - same_input_policy
  required_outputs:
    - survival_window_s
    - ordinary_elite_stage10_ttk_ticks
    - total_ev_and_cooldown_ev_share
    - crit_count_and_drought_distribution
    - combo_p5_p50_p95
    - route_progress_and_damage_taken
  human_playtest_modes: [normal, reduced_motion_static, sound_off_captioned]
  accessibility_input_cells: [touch, keyboard, controller]
```

## Exit rule

A planned target is not a measurement. A suite may supply only `NOT MEASURED`, `MEASURED PASS`, or `MEASURED FAIL` after its named evidence is present. Any deterministic mismatch, authority leak, hidden network/provider dependency, missing essential static fallback, or open S1 defect blocks the relevant gate.

## Stage 3 planned verification packet — NOT RUN

This packet extends the 90-second contract with planned Stage 3 evidence collection. It does not execute a test, create an asset, exercise a provider, establish rights, or issue a gate verdict. All numeric thresholds below remain **Target** values until the named evidence has a complete matching build tuple; missing evidence is `INVALID_MISSING_EVIDENCE`, never a pass.

| ID | Planned delivery / owner | Verification method | Required evidence path | Target only | Blocker | Status |
|---|---|---|---|---|---|---|
| S3-T01 | Ordered combat feedback — deterministic QA owner | Force normal/critical hit, health threshold, cooldown C-1/C/C+1, action accepted/rejected, and source/target loss; join each ordered resolved-event ID to semantic snapshot, caption, and presentation timestamp. | `qa/evidence/combat/stage3-event-order-and-feedback.jsonl` | Event-to-visible-feedback p95 ≤100 ms; every projection cites the resolved event and leaves rule hash unchanged. | Missing/reordered/invented event, arithmetic/hash mismatch, presentation observer write, or absent static non-color representation. | NOT RUN |
| S3-T02 | Sensory reduction and reduced motion — accessibility QA owner | Replay the S3-T01 event set in reduced-motion, mute, no-haptic, high-contrast, effects-muted, and fallback-renderer cells; use event-ID-matched state/action probes with controlled order. | `qa/evidence/presentation/stage3-reduced-motion-safety.json`; `qa/evidence/playtest/stage3-feedback-discrimination.jsonl` | Defined recognition targets and zero unresolved S1/S2 readability complaints. | Any essential cue relies only on motion, color, audio, or haptics; missing raw probe/allocation/missingness data; unresolved S1/S2 defect. | NOT RUN |
| S3-T03 | Touch/keyboard/controller/switch parity — accessibility QA owner | Encode the fixed normalized tape as touch, keyboard, controller, and switch; test handedness, dead-zone 6/12/18%, focus/overlay open-close, held cancellation, resize/rotation, and keyboard navigation. | `qa/evidence/controls/stage3-input-parity.jsonl`; `qa/evidence/accessibility/stage3-focus-and-geometry-audit.json` | Same accepted stream/resolved-event/final hash; essential discrete targets ≥24×24 CSS px and ability controls ≥52 dp; input-to-presented p95 ≤100 ms. | Target/aim/raw coordinate reaches rules; stale movement/focus trap/obscured focus; essential action unavailable; hash divergence. | NOT RUN |
| S3-T04 | Audio fallback plus asset absence/rights audit — QA and resource-admission owners | Exercise sound-on, mute, mono, captions-only, decode failure, missing local asset, delayed playback, and reduced motion; perform local static inventory and admission/rights record review only. | `qa/evidence/audio/stage3-offline-caption-fallback.jsonl`; `qa/evidence/audio/stage3-runtime-provider-scan.txt`; `qa/evidence/assets/stage3-admission-and-rights-audit.json` | Rules/event IDs are invariant; captions/UI remain available and a missing asset cannot block state progression. | Runtime provider/secret/remote URL, absent asset provenance/right record, unavailable caption, or asset-dependent state. `gti` dry-run only, incompatible `ppgen` provider, timed-out Blender inspection, unavailable ElevenLabs credentials/rights, and unapproved Vox beat map remain blocking facts—not generated/cleared assets. | NOT RUN |
| S3-T05 | Save and idle return — persistence QA owner | Run 0 h, cap, cap+1, 24 h, rollback/future, corrupt save, storage denial, interrupted write, two reloads, and 100 same-key reopens under browser networking disabled. | `qa/evidence/idle/stage3-return-permit-matrix.jsonl`; `qa/evidence/ops/stage3-network-disabled-idle-trace.json` | Fixed-point receipt equals committed local record; exactly one valid settlement; invalid elapsed awards zero. | Duplicate/lost/invalid award, false save-success UI, combat/progression/stage mutation, undeclared save diff, or network request. | NOT RUN |
| S3-T06 | Render memory and peak/soak performance — performance QA owner | Run named device/browser/input/motion/render cells through a 90-second peak and 30-minute soak; record frame/update/render duration, tick backlog, hashes, memory, DOM count, and input path. | `qa/evidence/performance/stage3-device-peak-and-soak.jsonl`; `qa/evidence/performance/stage3-render-density-audit.json` | Per-cell p95 frame ≤16.7 ms; <0.5% frames >33.4 ms; no positive retained-memory slope; p95 input-to-presented ≤100 ms; no unreported backlog. | Pooled cells, missing tuple, budget breach, positive retained-memory slope, unreported backlog/tick loss, or hash mismatch. | NOT RUN |
| S3-T07 | Local operations and rollback — operations QA owner | Cold-load/run/idle-return/export/delete with networking disabled; inspect service-worker/cache/dependency traces; static scan; restore prior pinned tuple and rerun selected smoke cases. | `qa/evidence/ops/stage3-network-disabled-export-delete.json`; `qa/evidence/ops/stage3-release-tuple-audit.json`; `qa/evidence/ops/stage3-rollback-recovery-report.json` | Local export is optional, bounded, checksum-manifested, exportable/deletable, and cannot mutate rules; rollback restores selected smoke evidence. | Required network or identity/private field, telemetry state mutation, missing manifest/checksum, tuple mismatch, or rollback failure. | NOT RUN |
| S3-T08 | Human immersion/readability scoring — moderated-playtest QA owner | Counterbalance normal, reduced-motion, and sound-off/captioned event-ID-matched material; preregister prompts; retain raw response, confidence, severity, assignment, missingness, and complaint disposition. | `qa/evidence/playtest/stage3-immersion-and-readability.jsonl`; `qa/evidence/gates/G4-presentation-readability-and-playtest.json` | Median immersion ≥4.0/5 with zero unresolved S1/S2 readability complaints after triage. | No raw/preregistered/denominator data, clicks/exposure substituted for comprehension, missing evidence tuple, or unresolved S1/S2 complaint. | NOT RUN |

### Stage 3 service-level and accessibility boundary

- **Local-only service boundary:** S3-T05 and S3-T07 must run with browser networking disabled. Exports remain local and contain only the schema/version/field dictionary, build/fixture/cohort metadata, redaction profile, event count, and checksum; they must not contain account identifiers, raw gestures, voice, free text, or a remote transport.
- **Accessibility boundary:** S3-T02 and S3-T03 require static non-color meaning, optional audio/haptic/motion, visible and returnable focus, no keyboard trap, safe-area geometry, and normalized input only. Presentation never selects targets, resolves combat, consumes RNG, or advances a tick.
- **Execution boundary:** These are release-evidence plans, not PR claims. No source or test implementation is requested here; no external provider, media generator, Blender operation, or rights-clearing action is authorized by this packet.

### Exact future gate-evaluation bundles

| Gate | Evaluation owner | Required evidence before evaluation | Present state |
|---|---|---|---|
| G2 | Gate owner with deterministic-measurement owner | Stage 3 supplies feedback regression protection only. G2 remains integrity-only and requires its separately collected equal-budget archetype sweep, fixed seed/tape, canonical rule events, and result export. | NOT MEASURED / NOT PASSED — integrity-only |
| G3 | Gate owner with systems-balance owner | No Stage 3 G3 evaluation evidence is supplied; viable-archetype rotation, distinct-strategy traces, and anti-dominance evidence remain separately required. | NOT MEASURED / NOT PASSED |
| G1 | Gate owner with QA/resource-admission review | S3-T04 asset-admission/right record and runtime-provider scan; S3-T07 network-disabled operations trace, release-tuple audit, rollback report, and matching build tuple. | NOT MEASURED / NOT PASSED |
| G4 | Gate owner with accessibility and moderated-playtest QA review | S3-T01 event-order trace; S3-T02 sensory-safe captures/probe rows; S3-T03 input/focus/geometry trace; S3-T04 fallback joins; S3-T06 per-cell performance evidence; S3-T08 raw immersion/readability rows plus closed S1/S2 register. | NOT MEASURED / NOT PASSED |
| G5 | Gate owner with progression/persistence owner | No Stage 3 G5 evaluation evidence is supplied; the separately required offer/commit chain, idle fairness corpus, parity evidence, and network-off trace remain outstanding. | NOT MEASURED / NOT PASSED |
| G6 | Gate owner with operations/performance QA review | S3-T03 parity/focus/input trace; S3-T05 fixed-point save/idle corpus plus network-disabled trace; S3-T06 unpooled peak/soak/hash/backlog/memory evidence; S3-T07 export/delete, release tuple, and rollback artifacts. | NOT MEASURED / NOT PASSED |
| G7 | Gate owner with core-loop study owner | No Stage 3 G7 evaluation evidence is supplied; the separately required loop tape, movement/objective trace, accepted reward event, and voluntary re-entry rows remain outstanding. | NOT MEASURED / NOT PASSED |
| G8 | Gate owner with independent human-review owner | Not supplied by this packet: the preregistered fixed seed corpus, five-comparable-title comparison ledger, and independent impression rows are still required. | NOT MEASURED / NOT PASSED — known human-evidence gap |

No Stage 3 row changes the existing release disposition: **release remains BLOCKED** until all applicable evidence exists, is tuple-matched, and is evaluated by its named gate owner.