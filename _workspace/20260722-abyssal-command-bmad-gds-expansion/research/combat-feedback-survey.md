# Combat-feedback survey — bounded Canvas 2D readability

**Status:** implementation-ready research targets only. This packet does not report a capture, runtime measurement, player study, or gate pass. **G4, G6, and G7 remain NOT MEASURED / NOT PASSED.**

## Scope and non-negotiable boundaries

This survey specifies presentation of confirmed normal attacks, skills, criticals, damage, cooldown readiness, vitality, and effect density for the offline deterministic 60 Hz single-player Canvas 2D defense-survivor. It does **not** change damage, targeting, cooldowns, RNG, movement, stage plans, encounters, economy, input, or canon; it creates no assets and adds no network, commerce, account, wall-clock, or nondeterministic dependency.

The existing architecture makes HUD, Canvas, VFX, audio, narration, haptics, accessibility modes, and telemetry downstream observers. A delayed, dropped, duplicated, muted, or reduced-motion observer must leave canonical state byte-identical. The proposed adapter therefore consumes only immutable resolved facts; it never predicts an outcome or feeds an effect decision back into the 60 Hz simulation.

**Terminology.** *Source-derived* means supported by the cited source. *Target* means an original, falsifiable proposal for this game. A source example is evidence for a pattern, not a license to copy its art, names, content, or mechanics.

## Evidence ledger (accessed 2026-07-22)

| ID | Evidence | What it supports | Bounded use here |
|---|---|---|---|
| E1 | [Xbox Accessibility Guideline 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) — Microsoft primary guidance | Critical visual/audio gameplay information should have another sensory method; color alone must not convey information; examples include direction-of-damage indicators, health depletion, distinct hit/contact/kill sounds, and haptics used alongside another cue. | Give player damage, hazards, criticals, and readiness a shape/text/state path that does not require color, audio, or haptics. Ordinary hit texture may remain optional. |
| E2 | [Xbox Accessibility Guideline 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102) — Microsoft primary guidance | It calls out HUD health meters, directional cues, and glyphs; source floors are 4.5:1 for standard important elements, 3:1 for large elements, and 7:1 in high-contrast mode. | Use outline/backplate variants for vital HUD and compact combat text. Test against the worst backing pixel, not an ideal background. |
| E3 | [W3C WCAG 2.2 SC 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) — W3C primary standard explanation | Content must not flash more than three times in one second unless below the defined thresholds; saturated-red flashing has separate risk; an off switch cannot undo a first unsafe flash. | Adopt ≤3 flashes/s as a source-derived safety ceiling for all combined combat effects. This does not claim formal WCAG conformance. |
| E4 | [W3C WCAG 2.2 SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) — W3C primary standard explanation | Nonessential motion can be removed, controlled, or reduced; nonessential animation can cause distraction, dizziness, headaches, or nausea. | Treat camera motion, scale punches, particle travel, and screen shake as optional enrichment; static semantic equivalents are mandatory. |
| E5 | [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) — Mozilla platform reference | Browser-visible preference communicates a request to remove, reduce, or replace nonessential motion. | Map this preference and an in-game setting to the deterministic observer profile; never map it to rules changes. |
| E6 | [MDN Canvas optimisation](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) — Mozilla platform reference | Recommends pre-rendering repeated primitives, integer coordinates, minimizing state changes, batching calls, avoiding costly text/shadows, and using `requestAnimationFrame()` for animation. | Bound particles/labels and pool predictable effect instances; cache static glyphs and backplates. It does not establish a frame-time result. |
| E7 | [MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — Mozilla platform reference | Calls normally follow display refresh and callback timestamps must be used for frame-based animation to avoid high-refresh-speed drift. | Render interpolation may use the callback timestamp but effect identity, birth, expiry, coalescing, and culling remain keyed to simulation ticks. |

### Evidence synthesis

1. **Make meaning legible before adding impact.** E1 and E2 support distinct visual channels: a skill needs a readable area/state; a critical needs a non-color signature; health and cooldown state need stable HUD state. More glow or more particles is not a semantic distinction.
2. **Keep causality local and state stable.** The effect that says “this target was hit” belongs at the resolved target; player/Gate vitality and cooldown belong at a stable edge-HUD location. Persistent bars for every common enemy would convert transient causality into permanent clutter.
3. **Motion is never the only message.** E3–E5 support a static outcome/area/ready-state language. Reduced motion is not a blanket hide-effects option; it is an equal semantic projection with no camera displacement, scale bounce, rotation, particle travel, or flash.
4. **Canvas budgets must be explicit.** E6–E7 support avoiding repeated/uncapped canvas work, while the local performance contract sets the actual future targets. A presentation effect must have a fixed maximum lifetime, instance count, draw budget, and deterministic load-shedding path.

## Tiered feedback matrix

All values below are **Targets** at 60 Hz. `tick` values are rule-observer timing; a renderer may interpolate between frames but may not extend semantic lifetime past the stated end tick. “Static” is the reduced-motion projection, not a lesser or missing feature.

| Tier / priority | Event family | Standard projection | Static / reduced-motion projection | Numeric target | Protected meaning and gate linkage |
|---|---|---|---|---|---|
| T0 — survival, never culled | Player/W-03 Gate damage; active harmful telegraph | Stable edge health fill + numeric/text option; a single world-local directional wedge or bounded threat contour | Same fill, number/icon, outline/pattern, and fixed wedge/contour; no red wash, camera kick, or moving particles | Vital fill begins ≤2 rendered frames after state observation; one damage tail for 24 ticks (400 ms); 0 lower-tier masks over active danger boundary | Player survival and Gate integrity remain readable. **G4:** feedback latency/readability. **G6:** presentation must not alter input or frame budget. **G7:** movement decision remains legible. |
| T1 — action-critical, never culled | Resolved skill; cooldown-ready transition | Geometry family specific to the resolved ability: origin sigil + bounded area/path + resolve mark; HUD icon with wedge/bar countdown | Static icon + outlined resolved area/path + state label; stepped fill and ready border, no spin/bounce | Skill: 24–42 ticks (400–700 ms), ≤12 subparticles; cooldown gauge redraw at least every 6 ticks; ready settle 10 ticks | Distinguishes a committed automatic/ability event from normal fire without adding aim/attack interaction. **G4/G7.** |
| T2 — outcome-critical, coalesce but do not erase class | Critical damage; elite/boss phase/health change | Angular fracture-ring glyph plus `CRIT` token/icon; elite/boss anchored health plate and phase notch | Same glyph/token and health bar/notch; opacity-only departure allowed | Crit: 12–18 ticks (200–300 ms), ≤6 fragments; max one full crit flourish/target/20 ticks; exactly one selected elite/boss world plate plus optional boss edge mirror | Critical and boss information retains a non-color signature. **G4:** normal-vs-critical recognition. **G7:** build outcome is readable. |
| T3 — texture, first to aggregate/cull | Normal automatic hit, noncritical death, ordinary floating damage | Compact contact crescent + impact stamp; optional aggregated numeric label | Instant crescent + static impact stamp; number may be omitted only if the hit mark remains | Hit: 9–14 ticks (150–233 ms), ≤4 subparticles; label at most one/target/30 ticks (500 ms); label lifetime 18 ticks (300 ms) | Communicates automatic combat without drowning movement/threat decisions. **G4:** low-clutter immersion/readability. **G6:** VFX CPU/GPU/draw budget. |
| T4 — decorative, optional | Ambient motes, residual trails, flourish audio/haptic | Low-alpha local residue behind units | Removed or one static residue mark | ≤6 ticks for any unconfirmed-looking residue; no gameplay message | Must be removed before any T0–T3 element is degraded. **G6** load shedding only. |

### Performance-rank mapping

The local `T0`–`T4` labels are a readability order. They map to the established performance contract as follows: **T0 = rank 1; T1 and critical T2 = rank 2; elite/boss health portion of T2 = rank 3; T3 and T4 = rank 4.** Thus normal-hit particles, normal damage labels, and ambient texture are all performance **rank 4** and are governed by the existing rank-4 density and coverage limits.

### Normal versus skill attack grammar

| Dimension | Normal automatic attack | Skill / ability resolution | Critical modifier | Prohibition |
|---|---|---|---|---|
| Shape | short crescent/contact stamp directed toward resolved target | one bounded authored geometry family at observed origin/area/path | fracture ring over the underlying event | Do not use color, brightness, or particle count as the only discriminator. |
| Persistence | 9–14 ticks | 24–42 ticks | 12–18 ticks, capped separately | Do not extend a normal hit to impersonate an active area or skill. |
| HUD state | none by default; optional aggregate number | cooldown icon/wedge/number is persistent | no extra persistent meter | Do not expose a manual attack/aim/target control. |
| Motion-free reading | instant stamp at target | static origin marker + resolved boundary/path + ready state | static ring + `CRIT` token/icon | Do not rely on freeze, shake, travel, sound, or haptic. |
| Audio/haptic | optional, aggregate only | optional distinct local cue after confirmed resolution | optional distinct cue, rate-limited | No audio/haptic is necessary for success; no gameplay state follows a cue. |

## Deterministic observer event contract

This narrows, but does not replace, `abyssal.observer-event` v1 in `engineering/architecture-contract.md`. The deterministic core publishes a detached, immutable resolved event; the Canvas adapter creates a presentation request and records a local decision. No visual request is itself an event in the rules log.

### Required envelope and combat-feedback payload

| Field | Type / example | Required rule | Presentation use |
|---|---|---|---|
| `eventId` | `${simTick}:${subjectId}:${type}:${ordinal}` | Immutable, unique within replay | Stable seed and dedupe key. |
| `simTick`, `sequence` | non-negative integer | Immutable canonical order | Birth tick and same-tick ordering. |
| `type` | `combat.damage.resolved`, `combat.ability.resolved`, `combat.cooldown.changed`, `gate.integrity.changed` | Resolved fact only | Select the feedback recipe. |
| `rulesVersion` | immutable version ID | Must join replay metadata | Capture comparability; never selects a random VFX variant. |
| `sourceId`, `targetId` | entity IDs or `null` only where schema permits | IDs refer to resolved entities | World anchor and directional relationship. |
| `worldX`, `worldY` | canonical resolved coordinates | Must be a resolved position, never pointer coordinates | Anchor stamp/glyph/boundary. |
| `damageBase`, `damageFinal` | integer | Present for damage only; final is after resolution | Optional aggregated label; never recompute damage visually. |
| `healthBefore`, `healthAfter` | integer | Present for damage/integrity change | Health transition, not prediction. |
| `critical` | boolean | Present for resolved damage | Selects the T2 modifier. |
| `abilityId`, `abilityPhase`, `cooldownState`, `readyTick` | immutable IDs/state/tick | `abilityId` and `abilityPhase: resolved` are required for `combat.ability.resolved`; cooldown state/ready tick are required for cooldown facts | Bind the skill recipe to a confirmed result and render its readiness gauge. |
| `area` | `{kind, origin, points/radius}` or `null` | Required and authoritative for `combat.ability.resolved`; otherwise present only when the resolved event has an authoritative area | Clip/outline effect to observed area; never use rendering bounds for collision. |
| `ordinal` | non-negative integer | Monotonic within `(simTick, subjectId, type)` | Deterministic tie-break; no wall-clock dependence. |

**Required proposed ability event.** Add `combat.ability.resolved` only if the core can publish the immutable resolved fact with `eventId`, `simTick`, `sequence`, `sourceId`, `abilityId`, `abilityPhase: resolved`, authoritative `worldX/worldY`, authoritative non-null `area`, and the resolved cooldown state. This is a **future observer-event schema target**, not a claim that the current core emits it. Without this event, the Canvas adapter must show only cooldown state and must not infer a skill origin, target, path, or area from a damage event.

### Local presentation request and decision record

| Field | Target rule |
|---|---|
| `presentationKey` | `eventId + recipeVersion`; recipe version is content metadata, not simulation input. |
| `tier`, `anchor`, `startTick`, `endTick`, `semanticMask` | Required for every visible request; `startTick >= simTick`, fixed end tick, mask expresses protected-zone checks. |
| `motionProfile` | `standard` or `reduced`; changes only projection. `reduced` must preserve event class, world/HUD location, area, state, and text/icon. |
| `instanceCost` | Fixed `{sprites, particles, labels, canvasStateChanges}` max declared by the matrix. No unbounded emitter or text generation. |
| `deterministicSeed` | `hash(eventId, recipeVersion)` only. `Math.random`, wall clock, render cadence, device state, and asset load timing are forbidden. |
| `decision` | `rendered`, `coalesced`, `culled`, or `staticSubstitute`; includes deterministic `reasonCode` and the retained aggregate’s `eventId` range. |
| `observerInvariant` | Presentation mode must not be present in any input to rules, RNG, cooldown, target choice, damage, checkpoint, campaign persistence, or plan admission. |

### Required adapter rules

1. Deduplicate by `eventId`; on a replay seek/re-render, replace an identical `presentationKey` rather than emitting a duplicate.
2. Sort same-frame candidates by `(tier ASC, simTick ASC, sequence ASC, eventId ASC)`. Culling is deterministic and local; it cannot reorder or suppress rule events.
3. A missing asset, audio device, callback, or reduced-motion preference produces a static substitute or a logged local suppression. It never retries a rule action or changes a checkpoint.
4. `combat.damage.resolved` may make a T3 normal request plus a T2 critical modifier. One resolved event cannot create more than one numeric label candidate. `combat.ability.resolved` alone may make the T1 skill-resolve request; damage events may decorate that request but cannot substitute for its authoritative area.
5. `combat.cooldown.changed` owns the gauge’s semantic state. Render timestamps interpolate only the observed value; a renderer must not infer readiness before `readyTick`/state says so.

## Timing, density, and Canvas budgets

### Target timing table

| Signal | Start rule | Duration | Rate cap | Motion profile boundary |
|---|---|---:|---:|---|
| Normal hit | first rendered frame after observed resolved event | 9–14 ticks | per target, aggregate labels once/30 ticks | Reduced: instant mark held 12 ticks. |
| Crit modifier | same observed damage event | 12–18 ticks | full flourish once/target/20 ticks | Reduced: static ring/token held 18 ticks. |
| Skill resolution | observed resolved skill event only | 24–42 ticks | one active recipe/ability slot | Reduced: static sigil/outline held 30 ticks. |
| Player/Gate damage | observed state decrease | wedge tail 24 ticks | one wedge per subject; latest severity wins | Reduced: same static wedge, no vignette/shake. |
| Cooldown change | observed cooldown event/state | persistent | visual update no slower than every 6 ticks; ready cue once/30 ticks globally | Reduced: stepped fill/open-versus-lock shape; no radial spin. |
| Screen shake / hit-stop | **not a rule-time action** | fixed **2 simulation ticks** (33.4 ms maximum at 60 Hz), evaluated from `startTick`/`endTick`; no render-frame lifetime | skill/crit only, never normal hit; one active camera impulse | Reduced: 0 ticks. The simulation, input, cooldown, and event time continue unpaused. |

The two-tick visual-only cap is an original target designed to stay inside the local `p95 <=100 ms` input-to-visible confirmation constraint; it is **not** a claim that hit-stop improves feel. The impulse has a deterministic waveform derived from `eventId` and evaluates to zero at `endTick`; render cadence changes interpolation only, never its semantic lifetime. “Hit-stop” here must not pause the deterministic simulation, input admission, or scene update. The preferred default is **no global screen shake**; if implemented, it is optional, local camera displacement only, clamped to **2 CSS px at 480×270** logical viewport, and disabled under reduced motion.

### Anti-overload governor

| Pressure condition | Deterministic action | Non-negotiable preservation |
|---|---|---|
| T0 danger or vital mask active | Reserve its protected zone; suppress intersecting T3/T4 requests and make T1/T2 static if masks collide | Threat boundary, player/Gate health, and damage direction remain visible. |
| Within 160dp player radius in any rolling 30 ticks | Max 6 performance-rank-4 (T3/T4) emitters and max 2 aggregate labels; coalesce by `(targetId, critical, 30-tick bucket)` | A confirmed normal hit retains one contact mark; critical class retains its glyph/token. |
| Viewport coverage | Performance-rank-4 (T3/T4) alpha ≥0.15 covers ≤18% of viewport and ≤8% of an active T0 protected zone | No low-tier particle or label intersects an active threat boundary. |
| Critical burst chain | First crit receives full glyph/≤6 fragments; later events in its 20-tick target window become glyph-only and aggregate numeric value if enabled | `critical=true` remains visible as a class. |
| Particle/label pool exhausted | Culling order: T4 residue → T3 particles → T3 labels → T3 marks; never allocate during the render loop | T0/T1/T2 static semantics and HUD state remain. |
| Canvas frame/load budget exceeded | Apply the same deterministic local cull order, cache/pre-render repeated glyphs, batch style-equivalent draws; log reason | Rules tick rate, normalized input, audio-independent semantics, and checkpoint hash remain unchanged. |
| Flash review sees ≥3 flashes in any second or unsafe red/area pattern | Reject recipe from the candidate set; do not solve via a post-hoc warning or player-only toggle | Static icon/text/outline remains available. |

### Future performance targets

These inherit and do not replace `engineering/perf-budget.md`: performance-rank-4 (T3/T4) density is no more than six emitters and two aggregate labels/500 ms within 160dp; rank-4 alpha coverage is ≤18% viewport and ≤8% active rank-1 protected zone; presentation contribution p95 is ≤2.0 ms CPU and ≤2.5 ms GPU in a paired dense replay; no positive allocation/memory slope occurs across the soak. The mapping above makes normal-hit particles and labels subject to those rank-4 limits. The source ledger supports the implementation approach, while only the named future traces can establish the budget result.

## Reduced-motion and sensory-safe equivalence

| Meaning | Standard | Reduced motion / audio muted / no haptic | Invariant assertion |
|---|---|---|---|
| Normal confirmed hit | crescent + impact + optional aggregate number | static stamp, optional number | Event ID and target location link to the same resolved damage fact. |
| Skill result | sigil + bounded geometry/path + resolve mark | static sigil + same bounded outline/path + resolved-state icon | Ability identity, authoritative area, and cooldown state match exactly. |
| Critical | fracture ring + token + optional cue | fracture ring + token only | Critical state distinguishes from normal without color/motion/audio. |
| Player/Gate damage | HUD decrease + directional wedge + optional cue | identical fill/number/icon/wedge | Subject, health result, and direction remain readable. |
| Cooldown / ready | radial/wedge gauge + optional ready settle | stepped fill + lock/open glyph + numeric option | Ready/not-ready state and observed `readyTick` remain unchanged. |
| Elite/boss vitality | anchored plate and phase notch | identical plate/notch | Target identity and observed health/phase remain unchanged. |

**Contrast targets.** Important standard-size combat text/glyphs must meet **4.5:1** against their worst backing pixel; large elements **3:1**; high-contrast mode **7:1** (source-derived from E2). Color is reinforcement only: every T0–T2 message needs a shape, pattern, icon, or concise text alternative. Effects/audio/haptics controls are optional and independently disableable; no loss of either channel may make a rule state unavailable.

## Implementation boundary

1. **Core owns facts.** Extend only the observer projection after the established immutable event families exist. Do not add an effect timer, particle seed, screen-shake state, or presentation preference to canonical state.
2. **Renderer owns projection.** One Canvas presentation adapter maps `observer_event_envelope` payloads to recipes, pools, masks, and draw calls. It caches/pre-renders repeated primitives, snaps drawing coordinates as appropriate, batches by style, and keeps dynamic text/`shadowBlur` bounded per E6.
3. **Settings own presentation.** `prefers-reduced-motion` plus an in-game override select `standard` or `reduced` projection. The preference is not serialized into replay inputs and cannot alter auto-attack, targeting, cooldowns, or movement.
4. **Telemetry owns evidence only.** Local-only diagnostic records may hold event ID, recipe version, tier, cull reason, active-instance count, mask-coverage sample, motion profile, render timestamp, and paired frame-time sample. Do not record account, network, raw device identifier, or personal data.
5. **Asset/content owns semantics.** Each recipe must declare its tier, duration, footprint/mask behavior, static equivalent, contrast variant, localizable token, fixed pool cost, and deterministic seed derivation. An undeclared or looping effect is rejected.

## Measurable hypotheses and gate linkage

| Hypothesis (all future targets) | Method / required artifact | Gate consequence |
|---|---|---|
| The event-to-presentation adapter displays one source-backed T0–T2 semantic artifact for every confirmed relevant observer event and displays none for a rejected/unresolved intent. | Fixed replay; join event log `(simTick, subjectId, type, ordinal)` with adapter log; compare canonical checkpoint hashes across standard/reduced/muted profiles. `qa/evidence/gates/G4-presentation-readability-and-playtest.json` plus observer differential report. | **G4:** tests feedback causality/latency. **G6:** proves observer isolation. No gate pass is claimed. |
| Players can distinguish normal, skill, and critical feedback with audio off and reduced motion without losing threat or health comprehension. | Counterbalanced 500 ms clips + 1 s static cards at low/normal/saturated fixture density; record correctness, confidence, motion-sensitivity report, and unresolved S1/S2 complaints. Target: ≥90% normal-vs-critical and ≥95% skill-area / player-vs-Gate-health classification. | **G4:** contributes to its 0 unresolved S1/S2 complaint and immersion/readability method. **G7:** confirms feedback preserves movement/build-loop understanding. |
| Combat texture does not hide an active telegraph or create unacceptable flash patterns. | Per-frame rank masks + source flash analysis at largest logical viewport; record alpha coverage/intersections and events per 1 s. Target: 0 T3/T4 intersections with T0 boundary; T3/T4 coverage within 18%/8%; ≤3 flashes/s. | **G4:** safety/readability evidence. **G6:** local diagnostic evidence, not a performance pass. |
| Presentation remains within the existing Canvas budget and does not degrade deterministic input or 60 Hz rules. | Paired five-pass presentation-on/off dense replay after warm-up; sample identical simulation ticks, CPU/GPU frame contribution, allocations, input-to-visible latency, 30/60/120 Hz adapter outputs. | **G6:** tests its p95 ≤16.7 ms / long-frame / memory / input requirements. **G7:** movement and the 30–180 s loop cannot be obscured or delayed. |
| The automatic-combat loop communicates a meaningful outcome without requiring manual attack input or a central overlay. | 90 s fixed loop replay with movement-first input; inspect that normal hits are texture, skill/crit/cooldown are distinct, and HUD never masks the next movement decision. Target: no additional attack/aim/target control and no presentation-mode divergence in outcome/checkpoint. | **G7:** supports its action/reward/voluntary-repeat study design; it is not a repeat proxy result. |

## Acceptance checklist for a future implementation

- Every recipe has an immutable observed source event/state, tick-bounded lifetime, deterministic seed, tier, static equivalent, mask, fixed pool cost, and cull path.
- At 480×270 and 844×390 logical capture profiles, T0–T2 contrast and static meanings are inspected against worst-case backing pixels; color-vision simulation is only a prefilter before player testing.
- The dense normal-hit, elite/multi-telegraph, skill, crit-chain, cooldown-ready, player/Gate-damage, reduced-motion, muted, and missing-audio fixtures run against the same rules replay and produce identical canonical hashes.
- Capture review enforces the source-derived ≤3 flashes/s ceiling and records combined high-brightness/red risks; no “epilepsy safe” claim is made.
- Paired presentation-on/off evidence validates the existing G6 p95 frame, long-frame, memory, and input requirements. Failure culls texture before semantic danger and never drops a rules tick.
- G4, G6, and G7 remain **NOT MEASURED / NOT PASSED** until their named QA artifacts contain the required measurements and review.

## Decision

Use a quiet hierarchy: survival and movement information first, committed skill/critical outcomes second, normal-hit texture last. The canonical 60 Hz simulation decides what happened; Canvas makes the resolved fact readable with bounded, deterministic, reduced-motion-safe projection. This design preserves the game’s automatic-combat core without confusing spectacle for authority.
