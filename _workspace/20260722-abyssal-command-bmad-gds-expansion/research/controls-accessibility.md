# Abyssal Command — Controls, Accessibility, and Continuous-Combat Research Packet

## Research question

How can a mobile-first, movement-first game provide reliable one-thumb movement, optional skill activation, haptics, keyboard/controller parity, and usable focus behavior while combat targets automatically and never waits for player aim?

**Scope and non-negotiables.** This packet treats `defense-catalog.js` as the rules authority and the fixed 60 Hz simulation as authoritative. Render, HUD, audio, narration, haptics, focus changes, and rotation are observers. The player supplies only movement intent and discrete ability-slot intent; no device receives a manual target, aim vector, drag-to-aim path, or target-selection command. W-01 through W-05 remain canon and Stage 10 remains the ending. This is an offline, local-first product: all feedback is device-local and no control or accessibility feature depends on network, accounts, commerce, or an API.

**Evidence labels.** **[Observed]** is directly supported by the cited source. **[Inference]** is a bounded design conclusion from the source and this project's contracts. **[Target]** is an unverified project acceptance threshold to validate, not an industry fact.

## Source ledger

| ID | Provenance | Source | Evidence used | Limits |
|---|---|---|---|---|
| S1 | **Primary — Android Developers** | [Accessibility principles: touch target size](https://developer.android.com/guide/topics/ui/accessibility/principles#touch-target-size) | **[Observed]** Android recommends at least 48 × 48 dp touch targets and describes expanding a smaller icon's touch area with `TouchDelegate`. | Android guidance; it does not specify a combat joystick geometry. |
| S2 | **Primary — Android Developers** | [Haptics design principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles) | **[Observed]** Android recommends action-oriented `performHapticFeedback` constants where appropriate, warns against gratuitous vibration, and notes device capability variance. | API guidance; it cannot establish player comfort or perception. |
| S3 | **Primary — Android Developers** | [Make apps more accessible with a keyboard](https://developer.android.com/develop/ui/accessibility/keyboard) | **[Observed]** Keyboard users need logical focus navigation; custom controls must be made focusable and tested. | UI-oriented documentation; game-canvas behavior still needs product-specific testing. |
| S4 | **Primary — Android Developers** | [Game controller support](https://developer.android.com/games/sdk/game-controller/controller-support) | **[Observed]** Android documents standard controller mappings and controller input/haptic support surfaces. | Mapping support does not itself guarantee equivalent game outcomes. |
| S5 | **Primary — Apple Developer** | [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) | **[Observed]** Apple frames haptics as feedback that should have a clear relationship to an action/event and should not be overused. | Apple platform guidance; pattern identity varies by device. |
| S6 | **Primary — Apple Developer** | [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | **[Observed]** Apple calls for purposeful motion and respecting the system Reduce Motion preference. | Does not define this game's fallback visual language. |
| S7 | **Primary standard — W3C** | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — SC 2.1.1, 2.1.2, 2.4.7, 2.4.11, 2.5.1, 2.5.7, 2.5.8 | **[Observed]** Keyboard operation, no keyboard trap, visible/non-obscured focus, alternatives to complex pointer gestures/dragging, and minimum target sizing are relevant accessibility criteria. | WCAG is not a game-control ergonomics study; mobile-native compliance must be checked against platform behavior. |
| S8 | **Primary practice guidance — W3C WAI** | [ARIA Authoring Practices: Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | **[Observed]** A modal dialog needs deliberate focus placement, containment, dismissal, and focus return. | Applies to semantic overlay UI, not to the real-time combat simulation itself. |
| S9 | **Secondary — Game Accessibility Guidelines** | [Basic: Input](https://gameaccessibilityguidelines.com/basic/) | **[Observed]** The industry guidance recommends remappable controls and avoiding simultaneous/rapid input demands where possible. | Useful cross-game practice, but not a platform standard or controlled study. |

## Observed patterns and bounded conclusions

1. **Targets are a spatial-access requirement, not merely icon size.** S1's 48 dp recommendation means the ability's hit region should be at least that large even when the glyph is visually smaller. **[Inference]** In continuous combat, movement and ability controls should have non-overlapping hit regions; otherwise the player’s thumb placement becomes an accidental skill-selection mechanism.
2. **Haptics must identify an event, not become a damage meter.** S2 and S5 both support clear, intentional mapping and avoiding overuse. **[Inference]** Use sparse haptics for acknowledged player input and major state transitions; do not vibrate on every automatic hit, projectile, or damage tick.
3. **Input parity is outcome parity, not identical physical gestures.** S3, S4, and S7 require operable non-touch paths. **[Inference]** Touch, keyboard, and controller must emit the same small action vocabulary to the rules layer: `move(x,y)`, `ability(slot)`, `openOverlay(kind)`, and `closeOverlay`. The simulation never receives a source-device-specific mechanic.
4. **Focus belongs to actionable UI and overlays, not to every combat effect.** S7/S8 require focus visibility and no trap. **[Inference]** The combat canvas can accept continuous movement keys while no overlay is open; keyboard focus traverses HUD/overlay controls only when the player enters UI navigation. It must not chase transient enemies or auto-target changes.
5. **Motion/haptic/audio settings cannot remove meaning.** S2, S5, S6, and S7 support redundancy and motion alternatives. **[Inference]** A resolved gameplay event needs a stable visual state first; audio and haptic cues supplement it. Reduced-motion replaces shake, flash travel, and camera lurch with static contrast, icon/state changes, and readable meter deltas.

## Control model and calibration proposal

### 1. One-thumb movement — proposed baseline

**[Target]** The default touch control is a **floating movement pad** in the lower-left safe-area quadrant, appearing on first touch inside a configurable left-half movement zone. It controls movement only. The opposite thumb is never required for aim; it may tap a skill, but automatic combat continues if it does not.

| Parameter | Proposed value | Rationale and guardrail |
|---|---:|---|
| Movement-zone width | 50% of the logical canvas, excluding system-edge inset | **[Target]** Lets the player choose a comfortable starting location without an always-visible visual obstruction. A left-handed option mirrors the complete layout. |
| Pad activation radius | 88 dp; visual disc may be smaller | **[Target]** Large enough for a thumb-rest region; does not claim platform guidance. It is deliberately separate from S1's 48 dp minimum for discrete controls. |
| Dead zone | radial 12% of pad radius | **[Target]** Eliminates drift; expose 6%, 12%, and 18% presets plus calibration preview. |
| Outer clamp | 100% radius; normalized vector clamped to unit length | **[Target]** Prevents edge overtravel from increasing speed or leaking layout coordinates into rules. |
| Direction response | radial magnitude curve: linear default; optional gentle curve, never aim assist | **[Target]** The curve maps physical displacement to `move(x,y)` only; it may not select targets, turn attacks, or alter cooldowns. |
| Release/cancel | next 60 Hz tick emits neutral movement | **[Target]** No stale movement after an OS gesture, overlay open, focus loss, or touch cancel. |
| Calibration | 20-second local preview: sample 8 compass holds plus release; user selects dead-zone/left-right layout, no biometric profile stored | **[Target]** Supports motor variance without collecting or transmitting sensitive raw touch traces. |

**[Inference]** There is no drag requirement for abilities. S7's pointer/drag criteria support a single-pointer alternative; here the alternative is stronger: skills are a single, large tap with no aiming phase. Movement is a continuous touch because movement itself is the core control, but no gameplay function requires multi-touch, pinch, swipe pattern, or long press.

### 2. Skill activation without manual aim

**[Target]** Each ability slot is a single-tap 52 dp minimum hit target (exceeding S1's 48 dp guidance), positioned outside the movement zone and system gesture inset. The visual icon may be 40 dp but the semantic and touch region remains 52 dp. An attempted tap produces one of only three deterministic UI outcomes on the next simulation tick: accepted, cooldown/locked, or unavailable. The combat authority resolves the ability's target under authored rules; the UI cannot supply a target ID.

**[Target]** A skill button's visual state includes a number/name, cooldown ring or static countdown, and unavailable state with non-color encoding. It never requires double tap, hold, radial menu, drag, or "tap enemy then cast." A configurable keyboard/controller binding triggers the same `ability(slot)` action.

### 3. Input responsiveness and event ordering

| Measurement | Requirement |
|---|---|
| Device event → normalized action enqueued | **[Target]** p95 ≤ 16.7 ms under target-device load; timestamp and source captured locally. |
| Enqueued action → next fixed-tick acceptance/rejection | **[Target]** ≤ 1 simulation tick (16.7 ms), except an event arriving after the tick boundary may wait one additional tick. |
| Accepted action → visible state confirmation | **[Target]** p95 ≤ 50 ms from source event, measured on target hardware; confirmation is static HUD state, not a particle-only cue. |
| Accepted action → optional haptic/audio dispatch | **[Target]** p95 ≤ 100 ms; absence due to OS/device/user setting is valid and must not suppress the visual confirmation. |
| Input source switching | **[Target]** source may change per action; no 500 ms lockout, no source-specific cooldown, and no combat-rule branch. |
| Deterministic ordering | **[Target]** actions are sorted by tick, then documented monotonic sequence within the tick; UI event timestamps never directly advance simulation time. |

The response numbers are **targets**, not claims about a platform guarantee. They are deliberately measured against the simulation tick and local presentation, so no network timing is in the loop.

## Keyboard, controller, touch, and focus parity

### Common action contract

| Intent | Touch | Keyboard | Controller | Rules-layer form |
|---|---|---|---|---|
| Move | floating pad displacement | WASD and arrows, both remappable | left stick / D-pad, both supported | `move(x, y)` |
| Stop | finger release/cancel | key release / opposing keys resolve to neutral | stick returns to dead zone / D-pad release | `move(0, 0)` |
| Ability 1–3 | one tap per slot | 1–3 defaults, remappable | face buttons defaults, remappable | `ability(slot)` |
| Open pause/accessibility overlay | dedicated 48+ dp button | Escape / configurable key | Menu / configurable button | `openOverlay(kind)` |
| Close overlay | explicit Close or system back only where safe | Escape | B/Back | `closeOverlay` |
| Select auto-target | **not present** | **not present** | **not present** | prohibited |

**[Target]** A keyboard/controller user may complete the same run, choose the same abilities, move with equivalent eight-direction/analog vectors, and open/close the same overlays as a touch user. Exact motor path equality is neither possible nor needed. The parity gate is equality of the accepted action stream after normalization and equality of the resolved event log for a fixed seed and normalized action stream.

### Focus policy

1. **Gameplay, no overlay.** **[Target]** The game surface consumes movement/ability keys only; it does not expose enemies, combat log rows, or transient effects as tab stops. A visible `Controls`/`Pause` button remains keyboard reachable from the surrounding shell. This avoids a rapidly mutating focus order and respects the no-manual-aim model.
2. **Persistent HUD.** **[Target]** Only stable actions (pause, settings, and ability buttons when enabled) are focusable. Focus indication has at least 3:1 contrast against its adjacent unfocused state and is never hidden behind the HUD, matching the intent of WCAG 2.4.7/2.4.11. Cooldown changes update the accessible name/status without stealing focus.
3. **Modal overlay.** **[Target]** Opening an explicit settings/pause/accessibility overlay places focus on its labelled heading or first meaningful control; Tab/Shift+Tab (or equivalent controller navigation) stays inside; Escape/Back closes it; focus returns to the invoking button. This follows S8. The overlay must offer a visible close action and must not require pointer-only dismissal.
4. **Screen reader verbosity.** **[Target]** Announce state transitions (Gate Integrity threshold crossed, ability accepted/unavailable, W-01…W-05/stage change) as concise, deduplicated status messages. Do not announce every automatic hit, movement sample, cooldown decrement, or haptic. Any HUD message that is important enough to act on is also a persistent visual state.
5. **Remapping.** **[Target]** Controls expose a local, conflict-detecting remap screen; reserved OS/system keys cannot be captured. Reset-to-default is reachable with keyboard/controller. The action names, not physical keys, are announced.

## Feedback redundancy and reduced-motion behavior

| Resolved event | Visual baseline (required) | Haptic (optional) | Audio (optional) | Reduced-motion behavior |
|---|---|---|---|---|
| Movement pad engaged/released | pad state plus character direction/position | none by default | none by default | no pad spring/character lurch needed; static position remains authoritative |
| Ability accepted | slot state changes to cooldown, event label/icon | one light acknowledgement, rate-limited | short confirmation | replace launch/travel flourish with the slot/state change and icon |
| Ability unavailable | persistent cooldown/lock state and text | restrained reject only if player enables it | soft reject | no shake; retain text/icon state |
| Gate Integrity threshold | stable meter, label, contrast change, optional screen-reader status | one distinct threshold pulse | distinct cue | no camera shake, flash strobe, or moving vignette; meter and label remain |
| Domain/Stage/W-01…W-05 transition | named card/state and persistent objective | one medium transition pattern | named cue/narration when enabled | static crossfade or immediate state card; no pan/zoom required |
| Player damage/critical risk | health/integrity meter and non-color status | at most one warning pattern per cooldown window | warning cue | no hit-stop/camera motion necessary; persistent status survives |

**[Target]** Haptic patterns are local presentation observers of already-resolved events. Cap routine acknowledgement haptics to one per 250 ms and no more than three per rolling second; priority threshold warnings may pre-empt but are also capped at one per second. Respect OS haptic settings and an in-game `Off / Reduced / Full` setting. **[Target]** No outcome, cooldown, available action, or warning is communicated solely by haptic or sound.

**[Target]** When reduced motion is active, disable camera shake, recoil displacement, screen rotation, zoom/pan flourish, parallax travel, and repeated flash pulses. Do not slow, pause, or otherwise alter the 60 Hz combat simulation. Replace them with static meter changes, icon/name changes, contrast, and optional audio/haptic—each independently disableable.

## Scenario matrix: overlays, activation, rotation, and assistive input

| Conflict | Failure if untreated | Rules-safe resolution | Acceptance check |
|---|---|---|---|
| Overlay opens while a thumb is dragging | Movement sticks; the overlay covers the focused action; player cannot dismiss it. | **[Target]** On overlay-open, inject exactly one neutral-movement action for the next tick, release pointer capture, and snapshot the invoker. Overlay focus is contained; close returns focus to invoker. The simulation does not pause or receive overlay state as combat input. | Automated touch-cancel test plus keyboard-only open/close: next tick is neutral; no post-close stale movement; focus return is visible. |
| HUD overlays a skill button or focus ring | Tap lands on the wrong control; focus is entirely obscured. | **[Target]** Reserve non-overlapping HUD layers and safe insets; the higher layer must be non-interactive or displace the underlying action. Perform geometry checks for every supported aspect/safe area. | Screenshot/layout test: every enabled action has 52 dp unoccluded hit area and focus outline fully visible. |
| Skill activation competes with movement thumb | Two thumbs become mandatory, or a skill tap becomes aim. | **[Target]** Combat is automatic; a skill is a one-tap slot command with cooldown confirmation. The movement pad lives on one side; ability strip lives on the other and is mirrored by handedness setting. | Instrument same-thumb and alternating-thumb play: run remains completable with movement only; no source event includes target/angle. |
| Keyboard overlay focus consumes movement keys | WASD moves the avatar while editing settings, or a modal traps focus. | **[Target]** While modal focus is active, suppress combat movement/skill bindings except documented global Escape/Back; on close, movement resumes only on a fresh keydown (never stale held state). | Keyboard test: open overlay while holding W; movement neutralizes; Tab loops only in overlay; Escape returns focus; fresh W required. |
| System screen rotation during combat | Coordinate transform changes while finger is down, input maps to a target/skill, or presentation changes simulation timing. | **[Target]** Lock logical orientation for an active run. Layout/handedness/orientation changes occur only before the run or at an authored non-combat intermission and are recorded in replay metadata; physical rotation during a run does not resize the logical canvas, remap input, or alter simulation timing. | Rotation-automation test during every stage: resolved event hash and tick count equal baseline; no synthetic skill/movement event. |
| Rotation/resize obscures UI | A system inset or aspect change hides close/ability controls. | **[Target]** If platform policy permits live resize outside a run, cancel active pointers, recompute safe areas, then require a fresh touch. Never auto-activate a control at the new coordinate. | Resize fuzz test: every action remains ≥48 dp, ability ≥52 dp, and focus outline is not obscured. |
| Screen-reader speech and automatic combat compete | Speech becomes an unreadable flood; player misses real action feedback. | **[Target]** Deduplicate by event type/state and throttle noncritical status; never move focus on an automatic event. Provide a concise combat-status mode and a verbose local log view outside urgent input. | Assistive-tech scripted run: ≤1 noncritical announcement/2 s; all threshold/ability state changes remain discoverable in persistent HUD. |

### Orientation decision

**[Inference]** Allowing an active run to reflow into a new orientation makes UI presentation affect input coordinates, contrary to the requirement that presentation not alter a result. **[Target]** The safe default is to choose portrait/landscape and handedness before starting, maintain a fixed logical canvas for the run, and treat any requested setting change as a post-run/intermission preference. If a platform requires a surface recreation, suspend presentation only long enough to restore the same logical canvas and do not advance or skip simulation ticks; this edge case must be tested rather than assumed.

## Abyssal-specific implications

1. **[Target] Make `move` and `ability(slot)` the complete player-to-rules boundary.** Automatic targeting remains catalog-owned; no HUD control, accessibility overlay, haptic callback, or renderer may pass target identity, aim angle, damage, cooldown result, or simulation time into `defense-catalog.js`.
2. **[Target] Add a pre-run local calibration panel.** It selects handedness, dead-zone preset, movement curve, haptic level, audio level, reduced-motion override, and remappings. It may preview movement and feedback but must not start combat or write an online profile.
3. **[Target] Treat Gate Integrity and W-01…W-05 as persistent multi-channel states.** For every threshold/transition, preserve name, meter/icon, and non-color contrast; haptic and sound observe the same resolved event. Stage 10 uses the same static reduced-motion-safe transition language.
4. **[Target] Separate real-time canvas input from semantic overlay navigation.** The canvas offers direct remappable movement/ability input while no overlay is active; menus are native/semantic focusable controls with W3C-style containment and return. Neither surface can make manual aiming appear.
5. **[Target] Create a device-agnostic replay normalization gate.** Record only fixed-tick normalized actions and run configuration—not raw touch coordinates, haptic capability, screen rotation, audio state, or frame timing. A seeded replay must resolve identically after touch, keyboard, and controller normalization.

## Experiments and local telemetry

All telemetry below is local, aggregate, and opt-in for playtest export; it sends nothing at gameplay time. Do not retain raw coordinate traces, speech text, device identifiers, or accessibility setting values tied to an identity.

| Experiment / signal | Method | Success / falsifier |
|---|---|---|
| One-thumb calibration | In a 20-second noncombat course, compare dead-zone 6/12/18% and left/right layouts; record aggregate correction reversals, movement-cancel rate, and completion time. | **[Target]** Default 12% is rejected if it has >10% more correction reversals or >5% worse completion than a preset for either handedness group. |
| Ability misactivation | Count `ability(slot)` attempts that are immediately followed by an opposite movement correction within 250 ms; separately record unavailable taps. | **[Target]** Reject layout if suspected misactivation exceeds 2 per 10-minute run or differs by >1 percentage point between mirrored layouts. This is a diagnostic, not proof of intent. |
| Input latency | Timestamp source event, enqueue, tick acceptance, and visual confirmation with monotonic local clock. Report p50/p95 by input source/device class. | Fail if p95 breaches the targets in the responsiveness table for any required source. |
| Cross-input parity | Run a fixed seed from semantically identical normalized touch, keyboard, and controller streams; compare resolved event log and final simulation hash. | Any difference is a blocker; source type is leaking into rules or input normalization. |
| Overlay/focus regression | Script Tab/Shift+Tab, Escape/Back, controller navigation, a held movement key/touch, and overlay open/close. | Fail if focus is hidden/trapped, no close is reachable, input remains active after open, or movement resumes without fresh intent. |
| Reduced-motion redundancy | Complete W-01 to W-05 and Stage 10 with Reduce Motion enabled, haptics disabled, and audio muted; ask testers to identify ability availability and Gate Integrity threshold state using visual HUD only. | **[Target]** At least 90% correct state identification across scripted checkpoints; otherwise a critical cue is presentation-only. |
| Screen-reader signal quality | Test a scripted combat run with TalkBack/VoiceOver and a physical keyboard/controller; log announcement category/rate, no content. | Fail if automatic events steal focus, any required state has no accessible name/persistent state, or noncritical speech exceeds 1 announcement/2 s. |
| Rotation/reproducibility | Replay a fixed 60 Hz input stream while rotation/recreation attempts occur at known ticks; compare tick count, normalized actions, and resolved hash. | Any added/missing action or hash/tick mismatch is a blocker. |
| Haptic readability and fatigue | Compare `Off`, `Reduced`, `Full` for accepted ability and threshold cues; record opt-out rate and event recognition in a noncombat test. | **[Target]** If Full causes >15% opt-out or recognition does not exceed visual-only performance, reduce/remove the pattern rather than increasing intensity. |

### Required event schema for the tests

**[Target]** The minimum replay-safe local record is:

```text
tick, sequence, actionType, normalizedValueOrSlot, sourceClass,
acceptedOrRejected, rejectionCode, simulationEventId
```

`sourceClass` is only `touch | keyboard | controller | accessibility-switch` and is excluded from combat-rule evaluation. The record intentionally excludes raw screen position, target ID, haptic/audio dispatch success, frame delta, and presentation coordinates.

## Failure mode and falsification

### Authority/reproducibility failure: presentation supplies a combat decision

A tempting implementation is to let the HUD's tap coordinate choose an enemy, let an aim animation change attack timing, or let an orientation/resize handler recompute a movement vector in presentation space. That would violate both no-manual-aim and the authority boundary: render/input plumbing would be deciding a combat result.

**Falsification test.** Build a fixture that replays the same tick-indexed `move` and `ability(slot)` stream under (a) touch/keyboard/controller source labels, (b) haptics/audio on and off, (c) reduced motion on and off, (d) all overlay open/close sequences, and (e) rotation attempts. Assert an exact match of the authoritative resolved-event log and final simulation hash. Separately schema-check every input action to reject target IDs, screen coordinates, aim angles, damage values, cooldown values, and wall-clock timestamps. One mismatch is a blocker, not a tuning issue.

## Risks and contradictions

- **Platform target guidance differs from compact HUD desires.** S1's 48 dp baseline conflicts with dense ability strips. Do not shrink hit areas to fit; use fewer simultaneous exposed slots, a pre-run layout choice, or a noncombat overlay. A visually compact icon can still own a larger semantic/touch target.
- **Continuous movement and modal conventions conflict by design.** S8 expects focus containment, while continuous combat suggests the world continues. The bounded choice here is: modal overlays suppress player movement intent but never pause/modify automatic combat; therefore opening one is an intentional risk, not a hidden way to pause danger. The product must communicate that state before opening it.
- **Haptics are neither universal nor consistent.** S2/S5 support capability-aware, optional haptics. Hardware, OS settings, battery modes, and sensory preference make them non-authoritative. Visual confirmation remains required.
- **Keyboard parity can expose focus bugs that touch never sees.** S3/S7 demand logical focus and no trap; a canvas-first implementation may lack semantic controls. Maintain a dedicated keyboard/controller test path rather than declaring parity from key event handlers alone.
- **Rotation should not be a combat input.** Supporting mid-run orientation change risks a presentation-to-rules leak. Lock the logical run canvas and validate recreation behavior with hash tests.
- **Automatic combat must not conceal lack of agency.** The control scheme reduces dexterity demand, but accessible movement and one-tap abilities must still have intelligible effect. The playtest should measure whether users can tell accepted, unavailable, and consequential actions apart without camera motion, haptics, or audio.

## Delivery gate

Do not accept the control system until all of the following are demonstrated on target touch hardware and one keyboard/controller path:

1. A movement-only run is completable without manual aim or multi-touch.
2. Every discrete control meets the 48 dp baseline; ability activations meet the 52 dp project target and remain unoccluded.
3. Touch, keyboard, and controller normalize to the same action contract and pass the fixed-seed hash comparison.
4. Overlay focus is visible, contained, escapable, and restored; no overlay leaves stale movement active.
5. Reduced-motion + haptics-off + audio-muted mode retains every actionable/combat-critical state through persistent visual/UI semantics.
6. Rotation/recreation attempts cannot add actions, alter tick count, or change the authoritative resolved hash.
