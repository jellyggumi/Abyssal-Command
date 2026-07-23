# Expanded stage test plan — deterministic delivery contract

**Status:** planned / **NOT RUN**. This is a test-design artifact, not a gate review. No target below is a measured result or a G1–G8 PASS claim.

## Test charter and non-negotiable boundaries

This plan expands the Cinder Span slice into staged evidence work for an offline, deterministic, 60 Hz, single-player browser defense-survivor. `defense-catalog.js` remains the sole rules authority. Map/wave generation is frozen before tick 0; HUD, VFX, audio, captions, haptics, telemetry, storage UI, and rendering are read-only observers. The campaign remains finite (Stages 1–10; Stage 10 terminal).

The following are release blockers in every applicable row:

- a canonical replay mismatch; a presentation/input-source/renderer/audio/accessibility setting writing authoritative state; a wall-clock, locale, network, or async-asset dependency in rules;
- a required runtime network/provider request, credential, signed URL, account, commerce, remote experiment, cloud-sync, multiplayer, manual aim/target selection, or tactical queue;
- a missing build tuple or required evidence artifact; an open S1 defect; or an evidence tuple that does not match the tested build;
- a cue whose required meaning exists only in color, motion, sound, or haptics; or an idle grant that changes combat, stage completion, extraction/boss resolution, or run-only skills.

### Required evidence identity

Every automated result, capture, or human-session row records this tuple. Missing fields make the row `INVALID_MISSING_EVIDENCE`, never a pass.

```yaml
build_tuple:
  build_id: required
  source_revision: required
  rules_catalog_digest: required
  serializer_version: required
  map_grammar_version: required
  wave_grammar_version: required
  asset_manifest_version: required
  fixture_id: required
  map_key_or_seed: required
  input_tape_id: required
  clock_case: required
  viewport_device_browser: required
  input_source: required
  reduced_motion: required
  audio_caption_mode: required
  renderer_observer_id: required
  local_export_checksum: required
result_labels: [NOT_RUN, INVALID_MISSING_EVIDENCE, MEASURED_PASS, MEASURED_FAIL]
```

## Gate map and stage exit boundaries

| Stage | Test-plan work | Gate evidence supported | Gate-specific acceptance target | Blocking disposition |
|---|---|---|---|---|
| **Stage 1 — concept/presentation/core loop** | Freeze replay fixtures; bounded map/world schema checks; feedback semantics, captions, controls, and local resource-boundary checks; 90-second core-loop trace design. | G1 draft, G6 draft, G7 draft; inputs to G4/G8. | G1: no unaudited player-visible canon attachment; G6: required tuples and local-only observability exist; G7: 30–180 s trace has ≥3 actions and ≥1 reward event. | Missing fixture identity, canonical-world linkage, offline scan, or trace blocks the relevant draft evidence. It does not create a gate verdict. |
| **Stage 2 — balance/rewards/growth/encounters** | Five-archetype rotation; wave-combination corpus; reward-accounting and idle property tests; seeded repeat/novelty protocol; exploit sweeps. | G2, G3, G5, G7 final, G8. | G2: 45–55% matchup range, TTK ±15%, no combo pair >1.30× median EV; G3: ≥5 tested and ≥3 independently viable, no type >50% optimal-play dominance; G5: no-commerce/free-path parity according to signed 10–20-session envelope; G7: ≥70% voluntary re-entry; G8: ≤2/5 comparison frequency and ≥4/5 QA impression. | Any deterministic arithmetic/replay mismatch, dominant/untested archetype, undeclared probability, duplicated idle award, or unexplained wave outlier blocks the mapped measurement. |
| **Stage 3 — combat feedback/resources/performance/QA/release** | Density/readability and caption sessions; target-device performance/soak; local export/delete and zero-network audit; rollback rehearsal; final canon audit. | G4, G6 final, G1 final (with regression protection for G2/G3/G5/G7/G8). | G4: median immersion ≥4.0/5, feedback spot checks ≤100 ms, zero unresolved S1/S2 readability complaints; G6: p95 frame ≤16.7 ms, <0.5% frames >33.4 ms, stable 30-min memory soak, input ≤100 ms, readiness/rollback evidence complete; G1: zero unwaived canon violations. | A performance average without p95/tick backlog, unresolved readability/accessibility defect, provider/network surface, failed rollback, or mismatched release tuple blocks release readiness. |

The gate owner—not this plan—issues any PASS/FIX/REDO decision. The current state remains `NOT_RUN` for this expanded plan and does not supersede the bounded Stage 2 deterministic measurement work.

## Automation and property suites

| ID | Feature / risk | Fixture and method | Observable assertion | Evidence artifact | Gate(s) | Blocker severity |
|---|---|---|---|---|---|---|
| A01 | Fixed-tick authority | Same `MapKey`, save state, normalized input tape, and checkpoints at 30/60/120 Hz render cadence; observer A/B/disabled; normal/reduced motion; audio/caption modes. | Canonical state hash, PRNG position, input cursor, map digest, wave cursor, resolved-event IDs, offers, and persistent totals are byte-identical; only tagged observer timestamps/playback outcomes may differ. | `qa/evidence/determinism/expanded-observer-differentials.jsonl` | G2/G4/G5/G6/G7 | P0 |
| A02 | Deterministic PCG and bounded world linkage | Freeze ≥64 complete `MapKey`s; generate each three fresh times in serial and deliberately permuted candidate order; inject one negative fixture per hard predicate. | 192/192 positive canonical MapPlan bytes/digests and selection traces match; negatives reject with their expected predicate; no new seed, wall-clock reseed, renderer choice, extra objective, altered stage order, or Stage 11 continuation. | `qa/evidence/pcg/expanded-map-plan-replay.jsonl` | G1/G6/G7/G8 | P0 |
| A03 | PCG quality/readability | For each stage, execute a separate 100-key corpus after A02 is clean; compute valid-plan rate, variable-subgraph collision, module concentration, authored-envelope violations, and route/pressure outliers. | 100% valid plans; 0 envelope violations/unlogged substitution; target exact variable-subgraph collision ≤2%; target module share ≤40% where ≥3 candidates exist. Human objective direction test is separate. | `qa/evidence/pcg/stage-variety-envelope.json` | G1/G3/G7/G8 | P1; P0 for envelope/authority failure |
| A04 | Wave combination grammar | Cross product of all authored wave cards by role, landmark/anchor family, pressure/relief phase, safe-lane condition, cooldown adjacency, and deterministic fallback; include empty/depleted deck and invalid-card fixtures. | Every schedule has declared relief, reachable safe lane, telegraph before denial, stable fallback ordering, replayable checkpoints, and no repeated signature beyond its declared rotation window. Invalid/depleted cases reject or use the recorded deterministic fallback. | `qa/evidence/waves/expanded-combination-lint.json` | G2/G3/G7/G8 | P0 for nondeterminism/unreachable lane; P1 otherwise |
| A05 | Encounter pressure and exploit sweep | For each wave family, replay five archetypes through ordinary, elite, and Stage-10 fixtures at low/median/high pressure; add adversarial hold-position, path-edge, cooldown-boundary, relief-skip, and card-exhaustion tapes. | Log health window, damage taken, route progress, TTK ticks, cooldown share, crit drought, combo p5/p50/p95, and safe-lane use; inspect distributions, not averages alone. Any exploit in the register has a minimal tape and first divergent tick/event. | `qa/evidence/combat/expanded-wave-archetype-sweep.jsonl`; `qa/exploit-register.md` | G2/G3/G7 | P0 for replay/authority; P1 for balance exploit |
| A06 | Archetype rotation (minimum five) | Rotate **Bulwark, Striker, Gambit, Conductor, RiftHybrid** on paired MapKey/wave/input-policy families with equal authored power budget, same catalog digest, same starting-state band, and fixed crit/deck positions. | All five are tested; per-archetype win rate, ordinary/elite/Stage-10 TTK, EV and cooldown-EV share are reported. Gate evaluation may only use a type as viable after its distinct-strategy trace exists; no conclusion from pooled mean. | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl`; `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl` | G2/G3 | P1; P0 if fixture isolation fails |
| A07 | Combat arithmetic and event-to-feedback truth | Forced full/pressured/critical/zero health, normal/critical damage, reductions/floor, cooldown C-1/C/C+1, accepted/rejected actions, source/target loss. | `after = before + Σ resolved deltas`; crit label/event ID maps to the resolved multiplier and damage; one resolved event has the expected semantic snapshot; reduced motion/audio mute changes no rule hash. | `qa/evidence/combat/expanded-feedback-truth.jsonl` | G2/G4 | P0 arithmetic or observer write; P1 readability omission |
| A08 | Probabilistic reward accounting | Enumerate every authored reward table and state predicate. For noncombat surprise only, exhaust every outcome/roll state and compute exact rational `Σ(p_i × value_i)` from displayed odds; test duplicate exhaustion, commitment, stale/double input, and version migration. Persistent tactic rewards use a deterministic condition or finite progress meter. | 100% persistent tactic rewards have no hidden chance; displayed outcome set/odds/predicate exactly equal the rules table; probabilities sum to 1 exactly; all rewards have ledger entries; each valid choice commits once with matching before/after hash; no purchase/time/return gate. | `qa/evidence/rewards/probability-and-ledger-audit.jsonl` | G5/G7 | P0 hidden odds/duplicate/wrong reward; P1 unclear disclosure |
| A09 | Fair progression and 10–20-session parity | Synthesize account states at session 10 and 20 with appropriate unlocked companion/loadout; run matched fixed-seed Stage 1–10 and boss tapes. Separately test finite eligible-completion meter. | Target median completion and boss-clear times remain within ±15%; no permanent reward makes raw stats automatically decisive; target visible progress reaches its associated unlock in ≤3 eligible completions and never resets. | `qa/evidence/rewards/session-parity-and-progress-meter.jsonl` | G3/G5/G7 | P1; P0 if no-commerce boundary is violated |
| A10 | Idle settlement transaction | Property-generate valid elapsed time, 0 h, short, 12 h cap, cap+1, 24 h, negative/future/rollback clock, malformed/version/checksum mismatch, storage denied, interrupted write, reload twice, and 100 same-key reopens. | Fixed-point recomputation equals receipt; exactly one valid claim; invalid elapsed gives zero; idle ≤20% of median active-run permanent value; no run skill/combat XP/stage/boss/extraction/companion grant; UI never claims success after failed save; zero network. | `qa/evidence/idle/expanded-return-transaction.jsonl` | G5/G6/G7 | P0 duplicate/lost persistent resource or run-state leak |
| A11 | Effects, HUD, and visual safety | Capture low/normal/saturated effects in standard, reduced-motion, high-contrast/color-filter, effects-muted, and fallback-renderer modes. Measure semantic snapshot, protected-zone intersection, rank mask, flash count/rate, contrast, cooldown readability, and player/Gate/elite status. | Tier-4 effects cannot mask Tier-1 hazard/player state; every critical meaning has text/shape/static non-color evidence; VFX range equals the resolved event range; no essential cue disappears in reduced motion. | `qa/evidence/presentation/expanded-mask-safety.json`; captures/video manifest | G4/G6 | P0 essential meaning absent; P1 readability failure |
| A12 | Local audio, narration, and captions | Exercise sound on, muted, mono, decode failure, missing local asset, delayed playback, captions-only, reduced motion, haptics off, and playback adapter A/B. Static-scan built assets and dependencies. | Same deterministic rule hashes/event IDs across modes; caption/UI is available when playback fails; captions name the resolved event without inventing state; zero runtime provider SDK/host/credential/remote-audio URL; no asset blocks state progression. | `qa/evidence/audio/expanded-offline-caption-fallback.jsonl`; `qa/evidence/audio/runtime-provider-scan.txt` | G1/G4/G6 | P0 network/provider or state change; P1 caption/readability fault |
| A13 | Controls/accessibility parity | Re-encode a fixed normalized tape as touch, keyboard, controller, and accessibility-switch input. Test left/right layout, dead-zone 6/12/18%, focus loss, held-action overlay open/close, resize/rotation/recreation attempt, remap conflict, haptics off, muted, and reduced motion. | Same accepted normalized action stream and resolved-event/final hash; no target ID/aim angle/raw coordinate reaches rules; release/cancel neutralizes next tick; source event → accepted tick p95 target ≤2 ticks; visual confirmation p95 target ≤100 ms. | `qa/evidence/controls/expanded-input-parity.jsonl`; `qa/evidence/controls/input-chain-trace.json` | G4/G6 | P0 authority/hash/stale movement; P1 latency/accessibility fault |
| A14 | Geometry, keyboard, and assistive technology | At smallest supported viewport, target-device viewport, safe-area variants, and supported orientation contract: dump logical hit regions; scripted Tab/Shift+Tab/Escape/Back/controller navigation; screen-reader status script. | Essential discrete controls are ≥24×24 CSS px minimum and project ability controls ≥52 dp; all focus is visible/unobscured, modal-contained, escapable, and returned to invoker; no keyboard trap; automatic events do not steal focus; required state retains accessible name. | `qa/evidence/accessibility/expanded-control-feedback-audit.json`; focus and screen-reader session notes | G4/G6 | P1; P0 if control state changes rules or required action unavailable |
| A15 | Presentation/manual readability | Counterbalanced static reduced-motion screenshots and normal short captures of normal hit, crit, low health, hazard, cooldown unavailable/ready, choice, objective/Gate, and captioned narration. Hold event ID/content constant and randomize order. | Capture event ID, prompt, answer, confidence, mode, and defect severity. Report denominator and missingness; do not substitute exposure/clicks for comprehension. Stage target: median immersion ≥4.0/5 and zero unresolved S1/S2 readability complaint, only after sessions exist. | `qa/evidence/playtest/expanded-readability-session.jsonl`; consent-free local capture manifest | G1/G4/G7/G8 | P1; S1/S2 unresolved blocks G4 |
| A16 | Core-loop and novelty manual protocol | Run 90-second trace per archetype/mode, then an optional immediate re-entry prompt; separately perform five-comparable-title novelty ledger and fixed-seed impression task. | Trace records ≥3 player actions and ≥1 reward event; repeat proxy is voluntary re-entry, not a forced retry. Novelty ledger names five sources, feature criteria, reviewer score, and fixed seed; target ≤2/5 frequency and ≥4/5 impression. | `qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl`; `qa/evidence/gates/G8-novelty-comparison-and-impression.json` | G7/G8 | P1 insufficient evidence |
| A17 | Performance and simulation headroom | Script 90-second peak and 30-minute soak on each required device/browser/mode cell. Log frame interval, update/render durations, tick steps/backlog, canonical hashes, heap/memory samples, DOM count, input path, and optional Long Task diagnostics. | Report p50/p95/worst per cell, never a blended average. Targets: p95 ≤16.7 ms, <0.5% frames >33.4 ms, no positive retained-memory slope for 30 min, p95 input-to-presented ≤100 ms, and zero unreported backlog drops. Canonical replay remains equal under pressure. | `qa/evidence/performance/expanded-device-soak.jsonl`; `qa/evidence/performance/vfx-density-audit.json` | G4/G6 | P0 silent tick loss/hash change; P1 budget breach |
| A18 | Local telemetry, release service level, and rollback | Cold-load/run/idle-return/export/delete with browser networking disabled; inspect service-worker/cache/dependency traces; static scan package; restore a previous pinned build tuple and rerun affected smoke corpus. | Zero required network requests and no identity/private data; telemetry is local, bounded, optional, exportable/deletable, and cannot mutate rules. Release evidence has one matching tuple and all named artifacts. Rollback restores pinned prior tuple and its selected replay/controls/audio smoke cases. | `qa/evidence/ops/network-disabled-export-trace.json`; `qa/evidence/ops/release-tuple-audit.json`; `qa/evidence/ops/rollback-recovery-report.json` | G1/G4/G5/G6/G7 | P0 network/privacy/rollback/replay mismatch; P1 missing release artifact |

## Device, input, and presentation matrix

The matrix is a coverage requirement, not evidence that a device is currently supported. The release owner must name exact hardware/OS/browser versions before execution; results may not be pooled across cells.

| Cell family | Required cells | Required scenarios | Minimum artifacts |
|---|---|---|---|
| Touch target browser | Small mobile viewport, target-device mobile viewport, standard mobile viewport; each in its named supported browser version. | Touch pad, ability tap, cancel, safe-area, left/right layout, 6/12/18% dead zone, reduced motion, mute/captions, peak effects. | A13/A14 input parity, geometry dump, A17 peak/soak trace. |
| Keyboard desktop browser | Narrow desktop viewport and target desktop viewport in each supported browser version. | WASD/arrows, remap, Tab/Shift+Tab, Escape, held-key overlay open, focus return, captions-only, reduced motion. | A13/A14 parity/focus, A15 session capture, A17 peak/soak trace. |
| Controller path | One named controller-capable target-browser/device path. | Left stick/D-pad, face-button ability, Menu/Back overlay, focus/controller navigation, haptics disabled. | A13 parity, A14 focus script, A17 peak/soak trace. |
| Accessibility-switch path | One supported switch/digital-action emulation path. | Movement/action sequence, overlay navigation, captions-only, reduced motion, audio/haptics off. | A13 normalized tape, A14 accessibility audit, A17 peak/soak trace. |
| Render/observer modes | 30/60/120 Hz harness cadence; standard/reduced motion; effects normal/muted; renderer/observer A/B/disabled. | Identical seed/tape, save/reload checkpoint, peak wave and idle-return boundary. | A01 differential and A17 peak/soak trace. |
| Audio/caption modes | Sound on, mute, mono, captions-only, decode failure, missing local asset, delayed playback. | Crit, health threshold, cooldown, objective/Gate, narration, Stage 10 terminal state. | A12 fallback matrix, A15 captures, and A17 peak/soak trace. |

## Manual evidence sessions

Manual testing remains required because semantic correctness does not prove readability or immersion. A session is invalid without the evidence identity, scenario order, prompt set, raw response, severity taxonomy, and reviewer identity/role (no account identifier required).

| Session | Participants / allocation | Controlled material | Questions and scoring | Evidence / blocker |
|---|---|---|---|---|
| Objective orientation | Target: 12 first-exposure participants per evaluated stage, two valid keys/stage; counterbalance normal and reduced motion. | Orientation → objective/Gate route prior to first pressure commitment. | Identify objective direction and Gate route; record wrong turns and tick to first correct route. Target ≥10/12 in each motion mode. | `qa/evidence/playtest/objective-orientation.jsonl`; failure is G1/G4/G7 blocker until cue is repaired. |
| Feedback discrimination | Preregister sample/criterion before recruitment; counterbalance screenshot/capture order. | Event-ID-matched normal hit, crit, low health, hazard, no-event controls; static and normal modes. | State/effect identification and confidence; severity for any missing static signal. No click metric substitutes. | A15 artifact; unresolved S1/S2 blocks G4. |
| Control accessibility | At least one tester in each touch, keyboard, controller, and switch path; include reduced-motion + mute + haptics-off session. | 90-second fixed-seed run, overlay script, rotation/recreation attempt. | Can tester act without aim/multi-touch, identify accepted/unavailable action, close overlay, and return focus? Log every accessibility blocker. | A13/A14 artifacts; any essential-action failure blocks G4/G6. |
| Archetype rotation | Five profiles rotated in Latin-square order against paired seed/wave families; no profile omitted. | 90-second core loop plus ordinary/elite/Stage-10 deterministic fixture. | Distinct strategy description, perceived fairness, outcome/death reason, voluntary re-entry. Record outcomes separate from satisfaction. | A06/A16 artifacts; missing rotation blocks G3. |
| Audio/caption fallback | Same session material across sound-on and captions-only/missing-asset variants. | Objective, crit, cooldown, Gate, narration transition. | Identify current state/action from visual/caption channels; verify a missing asset does not conceal or stop state. | A12/A15 artifacts; any reliance on sound-only is G4/G6 blocker. |

## Exploit hypotheses and triage rule

Every discovered candidate gets a fixture ID, build tuple, minimal reproduction tape, first divergent tick/event, impact, and explicit broadcast request in `qa/exploit-register.md`. A reproduced P0/P1 blocks its mapped evidence until corrected and re-run under the same tuple.

| Hypothesis | Falsification fixture | Failure signature | Gate(s) |
|---|---|---|---|
| Candidate enumeration or worker order changes PCG/wave selection. | A02/A04 serial vs permuted evaluation. | First unequal map/schedule field or selection trace. | G2/G6/G7/G8 |
| Presentation setting changes combat, RNG, offer, map, or settlement result. | A01 across observer/audio/motion/render modes. | Canonical hash/event/total mismatch. | G2/G4/G5/G6/G7 |
| A safe-lane/relief card can be suppressed by deck exhaustion, adjacency, or topological pinch. | A04/A05 depleted-deck and peak-pressure fixtures. | No reachable relief, missing telegraph, or unrecorded fallback. | G2/G3/G7 |
| One archetype or combo wins through a cooldown/crit boundary rather than distinct strategy. | A05/A06 forced C-1/C/C+1 and crit/deck positions. | >1.30× median combo EV, out-of-band win/TTK, or repeated dominant trace. | G2/G3 |
| A displayed reward/odds table differs from accounting, permits duplicates, or hides permanent chance. | A08 exhaust all authored tables/predicates and stale/double inputs. | Probability sum ≠1, UI/rules mismatch, duplicate/second commit, undisclosed permanent chance. | G5/G7 |
| Clock rollback/reopen/storage fault mints, loses, or mispartitions idle value. | A10 property corpus and interrupted write/reopen ×100. | Duplicate/lost grant, run-state mutation, nonzero invalid elapsed award, false success. | G5/G6/G7 |
| Dense VFX, captions, or fallback rendering hides an actionable state. | A11/A12 peak capture and semantic snapshot join. | Required event lacks static non-color cue; protected-zone overlap; caption mislabels event. | G4/G6 |
| Touch/focus/rotation maps presentation coordinates into aim, leaves stale movement, or traps the player. | A13/A14 held action + overlay + resize/rotation scripts. | Target/angle input reaches rules; no neutral next tick; hash/tick mismatch; inaccessible close. | G4/G6 |
| Asset/telemetry/release path escapes the offline boundary. | A12/A18 cold load plus network-disabled run/export/delete/rollback. | Required request, provider/secret URL, identity data, remote dependency, or unrepeatable rollback. | G1/G4/G5/G6/G7 |

## Execution split, failure policy, and release handoff

| Loop | Runs | Blocking rule | Intentional exclusion |
|---|---|---|---|
| Local / implementation | Focused A01/A02/A04/A07/A08/A10/A13 properties for changed authority surface. | Any authoritative mismatch, accounting error, or persistence defect blocks the change. | No broad device/30-minute/manual session claim. |
| PR / review | Determinism, schema/resource static scan, affected wave/reward/idle/control fixtures. | Exact evidence and input fixture must identify the changed contract. | Human readability and full-device matrix remain release evidence. |
| Scheduled breadth | 100-key/stage PCG corpus, wave cross-product, five-archetype sweep, device-mode peak matrix, long soak. | Results are segmented; repeated flaky case is quarantined only with owner, defect, expiry, and retained evidence. | No automatic gate verdict. |
| Release candidate | Complete matching tuple; all applicable A01–A18 artifacts; manual sessions; zero-network audit; rollback rehearsal; independent human review. | Any missing artifact, open S1 defect, unresolved P0/P1, tuple mismatch, or failed rollback is `BLOCKED`. | No network/service availability metric is substituted for offline local proof. |

A flaky failure is not solved by rerunning until green. Preserve the first failing tuple/tape, reduce to a minimal reproduction, classify it in the defect register, and either fix it or keep the affected gate evidence blocked. New tests must remain at the lowest layer capable of proving the reported defect; broad browser repetition cannot replace a deterministic property assertion.

## Implementation boundaries

- **Allowed test hooks:** deterministic fixture selection, fixed-tick clocks, canonical serializers, local in-memory diagnostic export, injected storage/clock/audio/renderer adapters, browser network-disable interception, and static built-output scans.
- **Prohibited test hooks:** changing catalog values to make a test pass; unrecorded random seeds; real provider calls; browser credentials/private URLs; remote telemetry/experiments; wall-clock timing as authoritative simulation input; raw touch-coordinate, speech-text, or account-identity collection.
- **Artifact ownership:** QA writes evidence and defect/exploit records; engineering supplies deterministic hooks and performance traces; PM/designer own signed reward/balance changes; the director alone reviews gates. This plan makes no runtime modification request and does not authorize changes outside its test boundaries.

## Evidence sources (accessed 2026-07-22)

| Source | Use in this plan | URL |
|---|---|---|
| Abyssal Command design contract | Product boundary: offline, 60 Hz, movement-first, Stage 10 terminal. | `docs/abyssal-command-defense-survivor-design.md` |
| W3C WCAG 2.2 | Keyboard, focus, pointer gesture, target-size, and motion-accessibility assertions. | https://www.w3.org/TR/WCAG22/ |
| W3C — Animation from Interactions | Reduced-motion fallback requirement. | https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html |
| W3C — Target Size (Minimum) | 24×24 CSS-pixel minimum target reference. | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| MDN — `localStorage` | Storage-denied/private/corrupt-state idle cases. | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage |
| MDN — PerformanceLongTaskTiming | Optional diagnostic only; engine frame/tick logs remain authoritative. | https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming |
| web.dev — Interaction to Next Paint | Input timing decomposition; its 200 ms web figure is not a game pass criterion. | https://web.dev/articles/inp |
| Fiedler — Fix Your Timestep! | Fixed-step replay and backlog/spiral diagnostics. | https://gafferongames.com/post/fix_your_timestep/ |
| O’Neill — PCG reference usage | Record PRNG state/stream as replay identity, not display seed alone. | https://www.pcg-random.org/using-pcg-c-basic.html |
| Android Developers — accessibility touch targets | Touch hit-area cross-check and physical target guidance. | https://developer.android.com/guide/topics/ui/accessibility/principles#touch-target-size |
| Android Developers — keyboard accessibility | Focusability and keyboard-test basis. | https://developer.android.com/develop/ui/accessibility/keyboard |
| Android Developers — game controller support | Controller path/mapping test surface. | https://developer.android.com/games/sdk/game-controller/controller-support |
| Apple HIG — Motion | Respect system Reduce Motion without changing rules. | https://developer.apple.com/design/human-interface-guidelines/motion |
| Project research packets | Detailed target provenance and feature contracts: PCG, waves, rewards/idle, VFX/HUD, audio/narration, controls, telemetry. | `research/{pcg-map-grammar,wave-encounter-composition,progression-rewards-idle,vfx-hud-feedback,audio-narration-direction,controls-accessibility,qa-measurement-protocol,telemetry-playtest-contract}.md` |

## Planned evidence conclusion

This plan supplies observable assertions and manual evidence paths for every expanded feature. It requires deterministic property/replay proof before subjective review, preserves five-type archetype rotation, separates device/mode cells, and treats offline release readiness as a tuple-bound local evidence problem. **No suite was run, no runtime behavior was changed, and no G1–G8 gate is declared.**
