# Abyssal Command — UI/UX Personas and Controls Research Packet

## Decision and boundary

Design the Cinder Span Command Feedback slice as a **mobile-landscape, edge-instrumented survival surface**: the centre remains an unobstructed movement-and-threat field; stable self-state is readable at the edges; confirmed causes appear at their world location; choice, result, and return information move into explicit full-page, semantic overlays.

This is a planning artifact. Every non-source-derived numeric value below is an unverified **Target**, even where a table omits the word; no target is an implemented or passed gate. **G4 and G6 are NOT MEASURED / NOT PASSED.** The deterministic 60 Hz core and `defense-catalog.js` remain the only rules authority. UI, Canvas, VFX, audio, haptics, accessibility settings, and telemetry are observer-only: none may pick a target, resolve damage, alter cooldowns, consume RNG, advance a tick, award a reward, or depend on a network service.

**Scope.** Personas; landscape HUD; health/critical/damage/cooldown semantics; reward and idle-return clarity; input, focus, safe-area, responsive, and accessibility contracts. **Non-goal.** UI code, a new combat command, manual aiming, commerce, online telemetry, or a claim of accessibility conformance.

## Evidence ledger

| ID | Source and access date | Observed support used | Bounded application |
|---|---|---|---|
| E1 | [Android: accessibility principles—touch target size](https://developer.android.com/guide/topics/ui/accessibility/principles#touch-target-size), accessed 2026-07-22 | Android recommends interactive targets of at least 48 × 48 dp and permits expanding the hit region without enlarging the icon. | Minimum touch geometry for actionable HUD and overlay controls. It does not prescribe a game HUD. |
| E2 | [Android: keyboard accessibility](https://developer.android.com/develop/ui/accessibility/keyboard), accessed 2026-07-22 | Keyboard operation needs logical focus navigation; custom controls need to be focusable and tested. | Full keyboard path and visible focus requirements for shell/overlay controls. |
| E3 | [Android: controller support](https://developer.android.com/games/sdk/game-controller/controller-support), accessed 2026-07-22 | Android documents controller support and standard input surfaces. | Controller maps to the same normalized action vocabulary, not a device-specific combat rule. |
| E4 | [Apple HIG: Haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics), accessed 2026-07-22 | Haptics should have a clear action/event relationship and not be overused. | Optional, rate-limited acknowledgement only; no rule or necessary meaning depends on haptics. |
| E5 | [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), accessed 2026-07-22 | Relevant criteria include keyboard operation/no trap, focus appearance/not obscured, alternatives to complex gestures, and target size. | Semantic overlays and controls; this packet does not claim Canvas-game conformance. |
| E6 | [W3C: Understanding 2.3.1 Three Flashes](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), accessed 2026-07-22 | Content must not flash more than three times in one second unless below its thresholds. | Crit/damage/ready treatments reject flash escalation. |
| E7 | [W3C: modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), accessed 2026-07-22 | A modal needs intentional initial focus, containment, dismissal, and focus return. | Pause, settings, result, and idle receipt overlays. |
| E8 | [Xbox Accessibility Guideline 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102), accessed 2026-07-22 | Important HUD visuals and directional cues need sufficient contrast; the guidance uses 4.5:1 standard, 3:1 large, and 7:1 high-contrast values. | Capture-review floors for meaningful labels/glyphs; not a certification claim. |
| E9 | [Xbox Accessibility Guideline 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103), accessed 2026-07-22 | Essential information should not rely on a single sensory channel or color alone. | Every combat-critical status has shape/text/state in addition to optional sound/haptic/color. |
| E10 | [MDN: `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), accessed 2026-07-22 | Web content can detect a user request to minimize nonessential motion. | Static equivalent is designed first, with motion only as optional enrichment. |
| E11 | [Current product contract](../../../docs/abyssal-command-defense-survivor-design.md), accessed 2026-07-22 | Full-bleed Canvas, edge HUD, movement-first automatic combat, deterministic 60 Hz, local persistence, and reduced-motion readability. | Governing product constraint; overrides an external pattern if they conflict. |

## Target players and critical journey moments

The personas are design lenses, not demographic claims. Their targets must be tested with people; no persona represents an observed cohort.

| Persona | Situation and need | Moment that must succeed | UI decision | Measurable hypothesis (Target) | Primary stage/gate coverage |
|---|---|---|---|---|---|
| **Mara — one-thumb commuter** | Plays in short, interrupted stretches; wants to dodge without learning aim controls. | First 20 seconds: engage movement, recognize a threat, use or ignore an available skill, recover after a touch cancel. | Floating movement pad on the chosen side; automatic targeting; one-tap skills on the opposite edge; no required multi-touch, drag-to-aim, or hold. | ≥90% complete a narrow-gap movement micro-fixture after one practice attempt; <3 unintended reversals/minute. | Stage 1 core loop; G4 feedback latency/readability; G6 input chain. |
| **Ivo — build reader** | Understands tactical consequences and wants a fair reason for each offer/unlock. | XP choice, elite extraction progress, run result, Archive review. | One effect + tactical role + before/after value; ≤3 options; named finite permanent-progress condition; receipt stays inspectable. | ≥80% correctly predict an XP choice's immediate effect before confirm; 100% of permanent rewards display condition/progress. | Stage 2 reward/balance; G6 choice-chain integrity. |
| **Sana — sensory-safe player** | Uses reduced motion, muted audio, high contrast, or color-vision aids; needs danger without flashing or noise. | Incoming telegraph, player/Gate damage, critical distinction, skill readiness. | Pattern/icon/text and stable meters are primary; motion/audio/haptic are optional; no full-screen red wash or flash-based meaning. | ≥90% correctly identify danger, player-vs-Gate state, and ready/not-ready in reduced-motion, mute, no-haptic captures. | Stage 3 combat feedback; G4 readability and flash/contrast review. |
| **Theo — keyboard/controller user** | Needs the same run outcome without touch precision. | Start/run, skill activation, pause/settings, result/return receipt. | One action vocabulary and semantic focus path; controller/keyboard do not expose target selection. | Same normalized action stream on a fixed seed yields equal resolved-event log and canonical hash across input sources. | Stage 3 accessibility/QA; G6 input and observer differential. |
| **Ari — returner** | Reopens offline after a gap and needs to understand exactly what, if anything, was awarded. | Idle settlement before starting another run. | Static receipt says accepted elapsed time, cap, formula/basis, grant, and next active goal; no urgency or loss framing. | 100% of receipt fields match the committed local record; 0 duplicate grants after repeated reopening. | Stage 2 growth/idle; G6 local telemetry/export and G7 loop clarity. |

### Journey-map commitments

| Journey moment | Player question | Required response | Never do |
|---|---|---|---|
| Pre-run orientation/calibration | “Can I control this comfortably?” | Let player choose handedness, input source, dead-zone preset, reduced motion, haptics, and remaps in a local preview. | Start combat from calibration or collect raw gesture traces. |
| Live survival | “What threatens me, and what state am I in?” | World-local telegraph plus persistent player/Gate instruments; one hierarchy wins when signals overlap. | Cover the centre with a toast, aim reticle, or enemy-bar forest. |
| Skill command | “Did the command take, and when can I use it again?” | Immediate accepted/unavailable state, visible cooldown gauge, optional local cue; no manual target picker. | Make a particle burst the only acknowledgement. |
| Build/reward decision | “What changes if I choose this?” | Full-page choice surface with three maximum, effect/role/value and an inspectable current-build summary. | Use hidden odds, scarcity timer, or a dominant unlabeled recommendation. |
| Result/return | “What persisted and what should I do next?” | Separate run-only recap from permanent Archive progress; receipt is reviewable and dismissible. | Retain run skills, auto-claim twice, or frame absence as failure. |

## Landscape HUD information architecture

### Layout law

The active run uses one logical landscape canvas. At the target low viewport (480 × 270 CSS px) and baseline viewport (844 × 390 CSS px), **Target:** protected interaction and text geometry derives from dynamic safe-area insets, never hard-coded status-bar values. Landscape rotation during an active run must retain the logical canvas and cannot synthesize a movement/skill command; layout/handedness change is a pre-run or authored-intermission choice.

```
┌ safe inset ────────────────────────────────────────────────────────┐
│ [PLAYER VITALS] [W-03 GATE INTEGRITY]     [BOSS/OBJECTIVE] [PAUSE] │  1. persistent survival/status rail
│                                                                     │
│   world-local telegraphs, avatar, hazards, confirmed impacts        │  2. protected playfield
│   (no opaque central panel; transient feedback remains local)       │
│                                                                     │
│ [FLOATING MOVE ZONE]                         [SKILL 1][2][3]       │  3. thumb/control rail
└ safe inset ────────────────────────────────────────────────────────┘
```

**Handedness.** Default is movement left / skills right. A single local toggle mirrors **the complete lower control rail** and associated nonessential edge placements. Persistent vitality retains a stable semantic order (player then Gate) with labels/icons; mirroring never changes a rules action or creates a target-selection side.

### Hierarchy and screen inventory

| Rank / surface | Contents and placement | Interaction policy | Source of truth | Responsive rule |
|---|---|---|---|---|
| **P0 survival rail** | Player health and W-03 Gate Integrity, upper safe edge; boss health joins only for an active boss. | Passive; not a canvas tab stop. | `combat.damage.resolved`, `gate.integrity.changed`, boss state snapshot. | Never truncate labels; step down decorative art before semantic text/number. |
| **P1 command rail** | Up to 3 ability slots, lower safe edge opposite movement zone; pause/settings 48dp+ at top safe corner. | Skills are one-tap and focusable only while enabled; pause/settings always focusable. | Input acceptance and `combat.cooldown.changed`. | Each skill hit target ≥52dp; pause/settings ≥48dp; no overlap with system gesture inset. |
| **P2 playfield** | Avatar, world telegraphs, elite/boss plate, source-local critical/damage feedback, selected objective marker. | No target/aim interaction. | Confirmed snapshot/events only. | Full remaining space; HUD cannot use an opaque central card. |
| **P3 XP choice** | Full-page semantic modal: title, current build, three max options, each effect/role/value, close/defer only if rules allow it. | Modal focus contained; choice uses one accepted action; no combat target input. | `choice.offered`, `choice.committed`. | One-column list at narrow height; 48dp+ option buttons; text scales before copy is omitted. |
| **P4 run result** | Full-page result: stage outcome, run-only effects expiring, confirmed Archive/persistent delta, next allowed action. | Semantic modal with explicit close/continue. | `stage.result.committed`. | No autoplay dismissal; preserve a scrollable or paged reading order. |
| **P5 idle settlement** | Full-page Archive receipt, before/after totals, accepted elapsed/cap/basis, one-time grant/result, next active recommendation. | Explicit acknowledge; no claim/retry command if already committed. | `idle.claim.committed` only. | Receipt can wrap/scroll; no small-print formula or time-pressure badge. |
| **P6 settings/accessibility** | Handedness, dead-zone/sensitivity, remapping, high contrast, reduce motion, text/numeric gauge option, audio/haptics. | Native/semantic controls with focus containment. | Local preference state; observer-only. | Settings always separate from run rules and safe-area constrained. |

### Safe-area and density geometry targets

| Item | Target geometry / rule | Measurement |
|---|---|---|
| Safe inset | Read platform-provided left/right/top/bottom insets every eligible layout pass; semantic action hit rectangles must lie fully inside safe content rect. | Screenshot/layout assertion at 480×270 and 844×390, left/right cutout variants. |
| Gesture exclusion | Keep each discrete action’s full 48/52dp hit rectangle out of OS gesture/cutout inset; never rely on a non-actionable icon inside it. | Geometry test records hit rect and system inset; 0 overlap. |
| Movement zone | 50% logical-canvas width excluding system insets; floating pad activation radius 88dp; 12% radial dead zone default (6/12/18% presets). | Input micro-fixture logs normalized vectors, cancel/reversal rate, and setting. |
| Ability rail | Max three simultaneous slots; 52dp minimum hit target, 8dp minimum gap, anchored outside movement zone. | Touch/focus geometry check: 0 overlap/occlusion, all active actions reachable. |
| Pause/settings | 48dp minimum target; 3:1 focus contrast against adjacent unfocused state; explicit text name in accessibility tree. | Manual keyboard/controller path plus contrast capture. |
| Playfield reservation | No opaque P3–P6 overlay during live combat except an intentional modal; rank-4 effects occupy ≤18% viewport at alpha ≥0.15 and ≤8% within 160dp of active survival signal. | Deterministic rank-mask capture; lower ranks cull first. |

## Live combat feedback contract

### Health bars and harm

| State | Presentation hierarchy | Required semantic encoding | Forbidden / fallback | Target comprehension evidence |
|---|---|---|---|---|
| Player health | Persistent upper edge: icon + “Player” label + current/max or configured percentage + fill + adaptive outline. | Player-specific icon/label/pattern; never color alone. | No full-screen red wash. In reduced motion: static fill/text + one static directional wedge. | ≥95% distinguish player from elite/boss health from 1-second static capture. |
| W-03 Gate Integrity | Adjacent but visibly distinct rail: Gate icon + “Gate Integrity” label + value/bucket + patterned fill. | Different label, icon, position/pattern from player health. | Never merge into player health or hide behind boss UI. | ≥95% correct player-versus-Gate identification in static capture. |
| Elite/boss health | Only selected elite or boss gets a world-anchored bar/name/rank; boss additionally mirrors top-edge long-lived health. | Rank icon/phase segment/notch plus text name; phase never color-only. | No persistent common-enemy bars. Static equivalent has same segments/label. | ≥95% identify boss/elite and remaining health band from 1-second capture. |
| Confirmed player harm | Stable meter changes plus a short world-local/directional wedge indicating known source side. | Directional shape + persistent value delta; optional sound/haptic only. | No shake/strobe requirement; one wedge only. | ≥90% identify damage side in muted/reduced-motion replay. |

### Critical, damage, and cooldown gauges

| Event | Primary visual | Timing/density target | Accessible/static equivalent | Source-event owner |
|---|---|---:|---|---|
| Normal automatic hit | Compact world-local contact/impact; aggregate number only when helpful. | 9–14 ticks; max one aggregate label per target per 30 ticks. | Instant mark for 12 ticks; no travel or particle requirement. | `combat.damage.resolved` with `crit=false`; deterministic core. |
| Critical | Angular fracture-ring plus localized `CRIT` token/icon at confirmed target. | 12–18 ticks; one flourish/target/20 ticks; later events coalesce. | Static ring + token for 18 ticks; no fragment/flash/audio dependency. | `combat.damage.resolved` with `crit=true`; deterministic core. |
| Damage popup | Only numeric when the value supports a decision/learning or aggregate represents a bounded window. | Max two floating aggregate labels per 500ms within 160dp of player; rank-1 danger always wins. | Label remains text with outlined backing; can be suppressed without changing rule state. | Confirmed core event with an immutable event-time world anchor or immutable snapshot reference; presentation may coalesce only after event exists. |
| Skill accepted | Slot transitions to cooldown plus local resolved geometry from confirmed event. | UI state visible p95 ≤50ms after accepted action; geometry 24–42 ticks. | Static slot state and outlined affected boundary; optional cue/haptic. | Input admission result + `combat.cooldown.changed`; core. |
| Skill unavailable | Locked/slash shape, numerical seconds when enabled, concise unavailable status. | Reject is shown by next simulation tick (or one additional tick at boundary). | Text/shape, not shake or sound alone. | Deterministic input admission + cooldown snapshot. |
| Cooldown/ready | Icon + radial/wedge depletion + optional seconds; ready = open sigil/border, unavailable = lock/slash. | Gauge updates at least every 6 ticks; ready outline settles 10 ticks; ≤1 ready cue per 30 ticks globally. | Stepped fill + numeric option + static border; no spinning required. | `combat.cooldown.changed`; core. |

All feedback reads a detached resolved event ID in the form `${simTick}:${subjectId}:${type}:${ordinal}`. A world-local combat event additionally carries either an immutable `worldAnchor` in canonical world coordinates at resolution or an immutable `snapshotRevision` from which that anchor can be read; delayed rendering must not relocate feedback to a later entity pose. A missing, delayed, muted, or reduced-motion presentation is a missing presentation, not an altered game event. No visual may imply a confirmed hit, crit, availability, or health result until its named source exists.

## Reward clarity and idle settlement

### Reward decision surface

| Moment | Required content | Decision rule | Target verification |
|---|---|---|---|
| XP offer | Up to 3 options; each has a short name, one effect, tactical role tag, and before/after number if numeric. Current-build panel explains interaction. | A recommendation, if present, includes an explicit build-based reason and remains optional. | ≥80% immediate-effect prediction before commitment; no option over 70% selection in comparable contexts without documented rationale. |
| Extraction/Archive progress | Reward identity, disclosed eligible condition, `current / finite maximum`, tactical role, and what persists versus expires. | Permanent tactical unlock follows deterministic condition/finite meter; no hidden chance, duplicate dilution, or retry pressure. | 100% persistent rewards have displayed condition/progress; no UI/rule mismatch in replay cases. |
| Run result | Outcome, temporary build expiration, confirmed persistent delta, next stage/unlock state. | Result cannot award a new rule outcome; it reports `stage.result.committed`. | Event-to-screen join is exactly once; user can inspect before leaving. |
| Idle receipt | Accepted elapsed, cap, basis/formula version, before/after, grant, idempotency state, and next active goal. | A committed receipt is review-only; no background combat, stage clear, extraction, boss result, or run XP. | 0 duplicate grants across reopen/reload matrix; 100% receipt-to-commit field match. |

**Idle settlement view.** Use a quiet, full-page W-05 Archive receipt—not a live-combat overlay. Lead with the resolved outcome (`Archive return recorded` or `No return credit available`), then show the calculation in readable rows. **Target:** the cap reads as a fairness bound, not a countdown: “Up to 12 h counted; absence never loses stored progress.” Do not show notification prompts, return streaks, “vault full,” paid acceleration, or a visually urgent timer.

## Control mappings and micro-control feel

### Device-normalized action contract

| Intent | Touch | Keyboard | Controller | Rules payload | Constraint |
|---|---|---|---|---|---|
| Move | Floating-pad displacement in selected half | WASD and arrow keys, remappable | Left stick and D-pad | `move(x,y)` | Radial clamp; release/cancel produces neutral next tick. |
| Ability 1–3 | One tap per 52dp slot | `1`–`3`, remappable | Face buttons, remappable | `ability(slot)` | No target ID, aim angle, drag, hold, or double tap. |
| Pause/accessibility | 48dp labeled edge action | Escape/configurable key | Menu/configurable button | `openOverlay(kind)` | Opening neutralizes held movement and releases pointer capture. |
| Close/back | Visible close or safe platform back | Escape | B/Back | `closeOverlay` | Returns focus to invoker; fresh movement intent required after close. |
| Auto-target / attack | **Not exposed** | **Not exposed** | **Not exposed** | prohibited | Automatic combat stays catalog-owned. |

### Feel targets

| Measure | Target | Instrumented boundary |
|---|---:|---|
| Source event → normalized action enqueue | p95 ≤16.7ms | Local input observer; no wall-clock drives a tick. |
| Enqueue → accept/reject | ≤1 tick; a post-boundary event may wait one extra tick | Deterministic admission only. |
| Accepted action → visible static confirmation | p95 ≤50ms | HUD state confirmation, not a particle-only cue. |
| Accepted action → optional cue/haptic | p95 ≤100ms | Observer-only; missing hardware/settings is valid. |
| Routine haptic rate | ≤1 per 250ms and ≤3/rolling second | Local optional observer; priority warning ≤1/second. |
| Handoff/left-right parity | No source-specific cooldown, lockout, or rule branch | Fixed-seed normalized action/replay comparison. |

**One-thumb accessibility.** A movement-only run remains completable; skills are optional tactical commands, never a second-thumb requirement. The system accepts ordinary touch movement as the core continuous gesture, but offers no essential pinch, swipe sequence, hold, radial-menu, or multi-touch interaction. Left/right mirroring, sensitivity/dead-zone presets, and local calibration change movement intent normalization only; they cannot alter target selection or combat results.

## Keyboard, focus, and assistive operation

### Focus policy

1. **Live game:** stable actionable UI only—pause/settings and enabled skill buttons—participates in focus navigation. Enemy entities, combat log rows, normal impacts, cooldown ticks, and auto-target changes are never tab stops. Cooldown updates never steal focus.
2. **Overlay:** initial focus lands on the labelled heading or first meaningful control; Tab/Shift+Tab and controller navigation remain within the modal; Escape/B/Back closes it; focus returns to the invoking control. While an overlay is active, movement/skill key state is neutralized and cannot resume without fresh input.
3. **Status announcements:** announce only action-relevant state transitions (ability accepted/unavailable, player/Gate threshold, objective/stage change, committed receipt). Deduplicate and limit noncritical automatic announcements to **Target: ≤1 per 2 seconds**. Automatic events never move focus.
4. **Names and controls:** icon buttons have accessible names; a skill name includes readiness and optional remaining time; status labels use persistent visual state as well as an accessible text equivalent. Prefer semantic HTML/native controls in overlays instead of ARIA recreation.

### Accessibility requirements and manual proof

| Surface | Required behavior | Automated-friendly check | Manual proof still required |
|---|---|---|---|
| Keyboard/controller | Logical order, visible non-obscured focus, Enter/Space or controller activation, no trap. | Labels, roles, target dimensions, duplicate IDs. | Full run, settings, choice, result, and idle-receipt traversal on physical keyboard/controller. |
| Touch | 48dp action minimum; 52dp skills; no complex gesture for essential command; mirrored layout. | Hit-rect/safe-inset overlap. | One-thumb movement, cancellation, left/right layout, and misactivation sessions. |
| Screen reader | Concise, deduplicated state announcements; no focus theft; content remains persistent. | Accessible name/role/value and live-region wiring. | TalkBack/VoiceOver scripted run with audio muted and hardware keyboard. |
| Vision/motion | Non-color encoding, contrast floors, text/numeric option, reduced-motion static equivalents, flash cap. | Contrast/sample, flash/frame, rank-mask checks. | High-contrast/zoom/reflow and motion-sensitive review at both target landscape viewports. |
| Resize/rotation | Recompute layout only when safe; cancel pointers; fresh touch required; active logical canvas remains stable. | Geometry and replay schema checks. | Rotation/recreation attempts during fixed replay; compare tick count, normalized actions, and hash. |

## Source-event ownership and implementation boundary

| UI concern | Allowed inputs | Owner | Allowed output | Explicitly prohibited |
|---|---|---|---|---|
| Player/Gate/boss meter | Resolved health/Gate/boss snapshot/event | Deterministic core | Read-only HUD projection, caption, local diagnostic | Applying damage, choosing target, changing boss phase. |
| Crit/damage popup | `combat.damage.resolved` event ID/value/crit plus immutable resolution-time `worldAnchor` or `snapshotRevision` | Deterministic core | VFX/caption request; aggregation after event exists | Predicting hit, reading later entity position, rerolling crit, changing damage/RNG. |
| Cooldown/skill state | Input admission and `combat.cooldown.changed` | Deterministic core | Button state, static gauge, optional cue | Accepting a cast, choosing area, decrementing cooldown. |
| Choice/reward UI | `choice.offered`, `choice.committed`, committed catalog summaries | Deterministic core | Semantic offer/result projection, local diagnostic | Rerolling/reordering offers, granting persistent value. |
| Idle receipt | `idle.claim.committed` record | Campaign/persistence owner after core authorization | Reviewable Archive receipt | Reading wall clock to grant, retrying claim, background simulation. |
| Preferences/remapping | Local preference record | UI preference owner | Input normalization/presentation configuration | Device-specific rule branch, raw-gesture profiling, network sync. |
| Presentation telemetry | Detached source event/state and local timing | Observer-only telemetry | Local bounded diagnostic record/export | Remote transport, backpressure, rule/campaign mutation. |

## Stage split and gate handoff

| Production stage | UI/UX delivery boundary | Key measurable targets | Gate linkage and evidence path |
|---|---|---|---|
| **Stage 1 — concept, presentation, core loop** | Implement/fixture the landscape HUD hierarchy, P0/P1/P2 semantics, one-thumb control contract, health/crit/cooldown static equivalents, core screen inventory. | Source-event to visible feedback p95 ≤100ms; health/crit/cooldown recognition targets; input confirmation p95 ≤50ms; **Target:** median immersion ≥4.0/5 and 0 unresolved S1/S2 readability complaints after documented defect triage. | **G4** fixed captures, rank-mask/flash/contrast/event join, observer-rate matrix, counterbalanced participant study, and defect-triage output: `qa/evidence/gates/G4-presentation-readability-and-playtest.json`. NOT MEASURED / NOT PASSED. |
| **Stage 2 — balance, rewards, growth, encounters** | Implement/fixture XP choice, extraction/Archive disclosure, result clarity, and idle-settlement receipt. UI reports only committed outcomes. | ≥80% option-effect prediction; 100% persistent-condition disclosure; 0 duplicate idle receipt grants. | **G6** local choice/receipt conformance: `qa/telemetry/choice-commit-chain.json`; G5/G7 adjacent policy checks. NOT MEASURED / NOT PASSED. |
| **Stage 3 — combat feedback, resources, performance, QA/release** | Test focus, controller/keyboard parity, reduced-motion/high-contrast/safe-area matrix, density/flash controls, input/performance/telemetry; exercise local rollback and complete release-readiness checklist. | 48/52dp geometry; no focus trap/obscured focus; hash parity across inputs/modes; telemetry implemented; rollback tested; readiness checklist complete; p95 frame ≤16.7ms, long frames <0.5%, 30-minute memory stable, input ≤100ms. | **G4** readability/immersion and **G6** local-only telemetry, network-disabled export/delete, soak, rollback, and readiness evidence: `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json`. Both NOT MEASURED / NOT PASSED. |

### Testable acceptance matrix

| Hypothesis | Fixture/method | Pass condition (Target only) | Gate |
|---|---|---|---|
| Essential combat meaning survives sensory reduction. | Fixed low/normal/saturated replays in reduced-motion, mute, no-haptic, high-contrast modes. | Health, Gate, critical, threat, and cooldown comprehension meets defined 90–95% targets; static semantics equal rule event IDs. | G4 |
| HUD respects the field and safe areas. | Screenshot/geometry sweep: 480×270 and 844×390; both cutout sides; handedness modes. | 0 interactive hit rectangles overlap unsafe inset; 0 critical edge labels clipped; no lower-rank mask covers survival zone. | G4/G6 |
| One-thumb input is controlled and equivalent. | Narrow-gap/local calibration micro-fixture plus touch/keyboard/controller fixed-action replay. | Movement completion ≥90%, <3 unintended reversals/minute; matching normalized stream produces matching resolved log/hash. | G4/G6 |
| Semantic overlays are operable. | Tab/Shift+Tab, Escape/Back, controller navigation, held-key/touch open-close scripts. | Logical order, no trap, visible focus, focus return; no stale movement after overlay opening. | G6 |
| Rewards/return are truthful and local. | Choice/receipt event-to-screen join and reopen/clock-anomaly matrix. | Exactly-once display/receipt; 0 duplicate grant; all rendered fields match committed local record; no network request. | G6 |
| Presentation does not create a performance or determinism failure. | Paired presentation-on/off replay at 30/60/120Hz and 30-minute target-device soak. | Core hash unchanged; p95 frame/long-frame/memory/input targets meet G6 thresholds. | G4/G6 |
| G4 participant evidence includes immersion and complaint closure. | Counterbalanced normal/reduced-motion/sound-off study with a documented S1/S2 complaint register. | **Target:** median immersion ≥4.0/5; 0 unresolved S1/S2 readability complaints after triage. | G4 |
| Operations readiness is exercised, not assumed. | Local-only telemetry schema audit, network-disabled export/delete, rollback rehearsal, and release-readiness checklist. | Telemetry implemented; rollback tested; readiness checklist complete; evidence records outcome without remote transport. | G6 |

## Risks and explicit decisions

- **Dense HUD versus operability:** do not shrink targets to fit more skills. Keep three slots maximum, use full-page overlays for configuration/choice, and preserve the field.
- **Automatic combat versus feedback agency:** player agency is movement plus explicit ability input. Do not add attack, aim, target selection, or a decorative reticle to manufacture agency.
- **Optional cues versus lost meaning:** sound/haptic/motion can enrich an event but cannot be its only reliable representation.
- **Fullscreen versus device insets:** full-bleed playfield is compatible with safe actions only when geometry reads current insets. A cosmetic edge can extend; a required control cannot.
- **Telemetry versus privacy:** record local, bounded IDs/timings and normalized actions only. Never persist raw gesture paths, voice, account identifiers, precise location, or a network transport.
- **Gate discipline:** this artifact supplies targets and test design. It does not establish G4/G6 performance, immersion, accessibility, or runtime behavior.

## Handoff decision

Build the static semantic layer first: a quiet edge HUD, named/outlined health instruments, confirmed world-local consequences, calm cooldown gauges, and full-page decision/receipt surfaces. Then add controlled VFX, audio, and haptics as disposable observer enrichment. This preserves the full mobile landscape playfield, one-thumb movement-first combat, offline deterministic rules, and a credible G4/G6 verification path without claiming any gate has passed.
