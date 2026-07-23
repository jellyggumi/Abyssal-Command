# Combat readability, feedback, and one-thumb controls

## Research question and scope

How should an automatic-combat, mobile-first survivor make danger, damage, critical outcomes, health, and movement comprehensible during dense combat without adding manual aim/attack controls or violating motion-accessibility requirements?

This packet covers combat feedback and controls only. It excludes long-term economy, reward progression, and stage generation. “Target” means an original proposed acceptance threshold, not a fact supplied by a source. “Source-derived” marks a numerical external requirement.

## Product guardrails

Abyssal Command's product contract is the governing source:

- The player moves; basic attack and targeting remain automatic. No aim button, attack button, tactical queue, or target-selection interaction may be introduced.
- The battlefield remains full-bleed Canvas with state/control information at the edge HUD; a central opaque panel must not cover enemies, projectiles, or hazards.
- Simulation remains deterministic fixed-step **60 Hz** [source-derived: current product contract]. Rendering, particles, audio, haptics, and HUD are snapshot observers only: they must never change a tick, RNG result, target, collision, damage, XP choice, extraction, or progression.
- The game remains offline/local-first, single-player, without network, accounts, or commerce.
- Respect `prefers-reduced-motion`; static contrast, shape, and text must preserve the meaning of danger, damage, and selection. Preserve Abyssal canon only: W-01 Echo, W-02 Bind, W-03 Gate Integrity, W-04 Domain, W-05 Archive. No studied title's character, asset, names, content, or UI is copied.

## Evidence ledger

| ID | Source / provenance | Exact factual support | Bounded use here |
|---|---|---|---|
| E1 | [Survivor.io — Google Play](https://play.google.com/store/apps/details?id=com.dxx.firenow&hl=en), official product-store page; **direct page retrieval** | The publisher's feature list says “Face off against **1000+** monsters at once” and “Clear the map with one-hand controls.” [source-derived: 1000+ is its marketing claim.] | A relevant genre exemplar can combine high encounter density with one-hand movement. This does **not** establish its internal combat, VFX, or accessibility design. |
| E2 | [Xbox Accessibility Guideline 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103), Microsoft official guidance; **direct page retrieval** | Its goal is to express visual and audio cues through multiple sensory methods. It says color alone should never represent information; critical visual content needs another sensory method, and critical audio needs another sensory method. It also states haptics must accompany at least one other cue because devices/users may lack or disable haptics. | Critical combat states require visual redundancy; sound and optional haptics reinforce rather than gate play. |
| E3 | [Xbox Accessibility Guideline 105](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/105), Microsoft official guidance; **direct page retrieval** | Recommends independent volume/mute controls for music, voice-over, active effects, ambient effects, narration, and voice chat; also recommends a stereo-to-mono option for important directional cues. | Separate music/ambient/effects controls and mono-safe cue design are appropriate; multiplayer/voice-chat portions are out of scope. |
| E4 | [Understanding WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), W3C official accessibility standard explanation; **direct page retrieval** | Content must not flash more than **three times in any one-second period** [source-derived], unless below the stated thresholds. It specifically notes greater sensitivity to saturated red flashing and says a toggle is not enough after a dangerous flash has already occurred. | No critical-hit, damage, or hazard feedback may depend on rapid bright/red flashing. Treat the source as a web standard adapted as a safety floor, not as proof of game compliance. |
| E5 | [Understanding WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), W3C official accessibility standard explanation; **direct page retrieval** | Motion animation triggered by interaction can be disabled unless essential; W3C recommends avoiding unnecessary motion, providing an off control, or honoring reduced motion. | Movement responsiveness is essential; camera shake, hit stop visuals, recoil motion, particles, and decorative drift are not required to convey the rule state and need a static fallback. |
| E6 | [MDN: `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), Mozilla-maintained web platform reference; **direct page retrieval** | The media feature detects a device request to minimize nonessential motion and communicates a preference to remove, reduce, or replace motion animation. It lists iOS accessibility Motion and Android **9+** Accessibility “Remove animations” [source-derived]. | Browser Canvas can derive the visual mode from the platform preference. This is technical reference material, not a product-design mandate. |
| E7 | [Game Accessibility Guidelines — full list](https://gameaccessibilityguidelines.com/full-list/), industry accessibility guideline collection; **direct page retrieval** | It calls for large/well-spaced virtual controls, adjustable sensitivity, simple controls or a simpler alternative, no color-only essential information, no sound-only essential information, distinct key-event sounds, separate effects/music volume, and a haptics toggle/slider. | Supports a one-thumb movement surface with adjustable response and multimodal combat feedback. These are guidelines, not a platform certification. |
| E8 | [Current product contract](../../../docs/abyssal-command-defense-survivor-design.md), repository primary design source; **direct local retrieval** | Defines movement-first automatic combat; fixed deterministic 60 Hz simulation; snapshot Canvas projection; edge HUD; and reduced-motion behavior where hazards, damage, and selection remain readable through static contrast and text. | Overrides every external example where sources conflict or propose more controls, network behavior, or central overlays. |

### Source-quality notes

- E1 is an official commercial page and only substantiates its published one-hand/high-density positioning. It is not used as evidence of hidden design practice.
- E2–E5 are primary/official accessibility guidance. E6 is a credible technical reference. E7 is a domain-specific, non-governmental guidance collection.
- No claim above relies on an indexed snippet alone. The report makes no causal claim that a specific feedback feature improves retention, conversion, or accessibility outcomes without a dedicated study.

## Repeated patterns and synthesis

1. **Feedback is a ranked language, not a particle budget.** E2/E7 require critical information to survive loss of a sensory channel and color discrimination. In an automatic-combat survivor, the player cannot prove agency by pressing attack; feedback must instead answer: “What is about to hurt me?”, “Was I hit?”, “Am I safe enough to move through this?”, and “Did the automatic build produce a meaningful outcome?”
2. **Temporary danger belongs near its world cause; persistent self-state belongs in stable HUD.** The existing edge-HUD rule protects the playfield. E2 supports on-screen damage direction and redundant state. Therefore telegraphs should attach to the hazard/enemy/ground, while player health and W-03 Gate Integrity remain stable edge-HUD information. A central toast must not become the primary hazard signal.
3. **Differentiate semantic classes with more than color or intensity.** Critical hits, normal hits, shield/Gate damage, enemy attacks, and enemy death should differ by shape/icon/text/audio role, not merely “more particles” or red/yellow swaps. This follows E2/E7 and prevents VFX density from erasing critical states.
4. **Audio is a finite attention channel.** E3/E7 favor separable controls and distinct key-event sounds. The consequence is not “sound every hit”; it is reserve a short, distinct cue for a state the player must act on or can learn from, while ordinary hit sounds are rate-limited/aggregated.
5. **One-thumb is a constraint on command count, not permission to hide motion precision.** E1 establishes the genre positioning; E7 favors simple controls and sensitivity adjustment. Automatic combat preserves a single continuous movement task, but input must visibly and immediately map to travel without camera or VFX obscuring the avatar.
6. **Reduced motion is a second readable language, not simply fewer effects.** E4/E5/E6 require that essential meanings survive when nonessential movement/flashing is suppressed. Static outlines, fills, icons, and concise labels must be equivalent in gameplay meaning to dynamic feedback.

## Original design implications for Abyssal Command

The following are proposed requirements, not source claims.

### DI-1 — A four-tier feedback hierarchy with a VFX reservation rule

**Design.** Reserve visual/audio attention in this order: (A) imminent player-threatening telegraph and W-03 Gate Integrity danger; (B) confirmed player damage and damage direction; (C) elite/boss health/state and selection; (D) automatic-attack hit/critical/death flourish. A lower tier must not draw over, recolor, or visually intersect an active higher-tier telegraph. Normal enemy damage numbers are optional aggregate feedback, not guaranteed per-hit text.

- **Measurable targets.** During scripted high-density captures, **target:** 100% of active Tier-A telegraphs have a visible non-color shape boundary or patterned fill; **target:** 0 frames where a Tier-D particle/damage-number layer covers a Tier-A boundary at the threat location; **target:** 95% correct player identification of the next harmful zone in a paused-frame test.
- **Validation.** Deterministic replay captures at the same source snapshots across low/medium/high effect-density fixtures; frame-review collision check; five-second recognition test with sound on and off.
- **Why it fits.** It keeps central terrain playable, does not add a control, and turns automatic combat's spectacle into subordinate feedback.

### DI-2 — State-linked hit confirmation, with a non-color critical signature

**Design.** Emit hit feedback only from a confirmed simulation event in the observed snapshot. Normal hit = compact local impact mark plus a low-priority, rate-limited effect cue; critical = a distinct angular/ring glyph, short “CRIT” label or icon, and a distinct effects-bus cue. Critical may be visually stronger, but it must not use screen flash, red strobe, camera shake, or an effect that masks a telegraph. W-01 Echo, W-02 Bind, W-04 Domain, and W-05 Archive may each map to an original shape/motion family; they must not borrow another title's names or art.

- **Measurable targets.** **Target:** in an A/B recognition clip, 90% of participants distinguish normal hit versus critical with audio muted; **target:** 90% distinguish them with visuals hidden but effects audio available; **target:** 0 feedback events emitted for damage absent from the next observed simulation result.
- **Validation.** Paired short-clip classification (visual-only/audio-only); event-log-to-snapshot audit keyed by simulation tick; reduced-motion replay comparison.
- **Safety bound.** **Source-derived safety ceiling:** no component flashes more than three times in one second (E4). The reduced-motion version replaces animated burst/scale with a static outlined glyph and text/icon for the same event.

### DI-3 — Health visibility separates player survival from target detail

**Design.** Keep player vitality and W-03 Gate Integrity persistent, high-contrast, and edge-HUD anchored. Show a target health bar only for a selected/elite/boss enemy, anchored to that enemy and paired with a non-color rank/state marker; never render health bars for every common enemy. The player damage moment receives a brief directional wedge plus a numeric/worded health-state change in the stable HUD, not a full-screen red wash.

- **Measurable targets.** **Target:** 95% correct “player vs. elite health” identification from a one-second static capture; **target:** 90% correct source-side identification after a damage event with sound off; **target:** 100% of health meaning remains understandable in a deuteranopia simulation *and* receives sign-off from actual player testing (simulation is a prefilter only, per E2).
- **Validation.** Static-capture comprehension cards; replay-based damage-direction quiz; color-vision simulation precheck followed by participant sessions; edge-HUD occlusion inspection across landscape and rotated logical landscape.
- **Why it fits.** Persistent self-state is stable enough to consult; temporary causality remains at the threat. No additional targeting command is created.

### DI-4 — Telegraphs use an explicit pre-impact / impact / recovery grammar

**Design.** Every avoidable hostile action receives: (1) a pre-impact world cue (ground contour, edge arrow, or enemy silhouette change); (2) an impact state whose boundary persists long enough to see the affected area; (3) a recovery fade that cannot be mistaken for a fresh warning. Different threat types differ by geometry and cadence, not color alone. Do not use continuous camera shake for threat urgency.

- **Measurable targets.** **Target:** 95% correct threat-type and safe-direction response in a no-audio first-seen clip; **target:** 90% in reduced-motion mode; **target:** fewer than 5% of participant-reported “I moved into an effect that looked finished” incidents per scripted ten-threat sequence.
- **Validation.** Blind first-seen clips, including dense automatic-fire backgrounds; reduced-motion parity run; issue coding for false-positive versus missed telegraph.
- **Accessibility bound.** The dynamic and reduced-motion variants share the same location, boundary, and state semantics. A motion toggle cannot turn an avoidable threat into unmarked damage.

### DI-5 — One-thumb movement has calibrated micro-control, not extra combat commands

**Design.** Use one movable thumb-control surface with configurable sensitivity and a visible neutral/engaged state. Apply a small dead zone and a capped movement vector in input interpretation; expose sensitivity and left/right placement without changing combat rules. The renderer may show a subtle static thumb anchor when enabled, but it must not occupy or mask central hazards. Haptics remain optional and are never the only confirmation.

- **Measurable targets.** **Target:** 90% successful completion of a narrow-gap movement fixture in each handedness placement after a single practice attempt; **target:** fewer than 3 unintended direction reversals per minute in the fixture; **target:** 100% of the same fixture can be completed with haptics disabled and with reduced motion enabled.
- **Validation.** Instrument raw input direction changes, movement-vector output, and collision outcomes in deterministic replay; compare default/left/right/sensitivity settings. The exact movement input sequence is replayable; visual/audio settings are recorded separately and must not affect the simulated outcome.
- **Scope guard.** No attack, aim, lock-on, manual target choice, combo input, or strategic command queue is added.

### DI-6 — Sound layers carry state, not hit spam

**Design.** Create independent master/music/ambient/effects controls; a mono-safe option routes important cues to both channels. Effects roles are: threat onset, player damage, critical, elite/boss state change, and optional ordinary-hit texture. When multiple normal hits occur, coalesce them into a bounded mix; preserve a clear threat/damage cue. Every gameplay-critical sound gets a visible static equivalent, and every gameplay-critical visual gets at least one additional available channel (sound or optional haptic).

- **Measurable targets.** **Target:** 95% correct threat-versus-critical cue classification in isolated audio; **target:** 90% correct threat detection with effects muted using visual state alone; **target:** 0 critical/threat cues masked in a scripted 30-second high-density mix according to automated event-versus-playback-log review.
- **Validation.** Audio-only classification; muted visual QA; mixing capture review at master/effects/music extremes and mono output.
- **Why it fits.** It applies E2/E3 without making sound, stereo hearing, or haptic hardware necessary for success.

## Reduced-motion and sensory-accessibility fallback matrix

| Meaning | Standard projection | Reduced-motion / muted / no-haptic equivalent | Must remain invariant |
|---|---|---|---|
| Incoming hazard | Brief shape change + bounded ground/edge telegraph + optional cue | Static outlined/patterned boundary with threat icon; no shake/flash needed | Location, affected area, danger state, and timing source snapshot |
| Player took damage | Compact directional wedge, HUD decrease, optional effects/haptic | Static directional wedge + HUD number/icon; no color-only red wash | Damage result and source direction if known |
| Critical automatic hit | Local impact burst, glyph, distinct effects cue | Static angular/ring glyph plus “CRIT” icon/text; audio optional | It is distinct from normal hit without changing damage |
| Elite/boss state | Anchored health bar, icon/shape, optional cue | Same bar/icon/shape with no pulse or decorative drift | Target identity/state and health snapshot |
| Movement engagement | Responsive movement and optional thumb-anchor/haptic | Same input-to-vector behavior; no animation required | Input order, vector result, and 60 Hz simulation outcome |

## Contradictions, risks, and decisions

- **Visual redundancy can create clutter.** E2 favors multiple channels, but duplicating every normal hit as text + particles + sound would obscure the survival game. Decision: redundancy is mandatory for Tier-A/B critical state, while Tier-D normal-hit feedback is aggregatable and subordinate.
- **Audio directionality can help but cannot be required.** E3 supports spatial/mono options; mobile speakers, mono output, hearing loss, and muted play make it unsafe as the sole telegraph. Decision: visual location/boundary carries the rule; audio reinforces it.
- **A reduced-motion fallback can accidentally reduce clarity.** Simply hiding particles may erase critical or danger feedback. Decision: ship a semantic static equivalent first, then layer motion over it; verify parity through the DI tests.
- **W3C flash limits are not a complete mobile-game seizure assessment.** E4 is a conservative external safety floor, and the game is Canvas rather than a conventional web document. Decision: enforce the source-derived three-flashes-per-second ceiling and perform capture-based manual review, including saturated-red cases; do not claim formal WCAG conformance from this packet.
- **Automatic-combat sources can tempt imitation.** E1 only supports a broad genre pattern. Decision: retain only the abstract movement-first/high-density insight; Abyssal uses independent canon, UI, sound, art, nomenclature, and content.

## Candidate validation packet

1. **Deterministic combat readability replay.** Build three snapshot fixtures (baseline, dense normal-hit, elite + multi-telegraph) and run the same inputs at normal/reduced-motion, effects-muted, mono, left/right thumb placement, and fallback Canvas adapters. Compare simulation event hashes: **target:** identical within each fixture regardless of presentation settings.
2. **Comprehension study.** Show short first-seen clips and static captures to players with all channels, visuals-only, audio-only, and reduced-motion. Record threat detection, safe-direction selection, critical identification, player-versus-elite health interpretation, and confidence. Use DI-1 through DI-6 targets as gates, not as guaranteed outcomes.
3. **Capture safety review.** Inspect high-density, critical-chain, damage, and boss sequences at the largest intended viewport. Confirm the source-derived flash limit, no central opaque feedback panel, static equivalents present, and no lower-tier layer covering active telegraphs.
4. **Control micro-fixture.** Replay a fixed input set and collect unintended reversals, path completion, collision result, and input-to-vector evidence for sensitivity/handedness variants. Presentation controls may change only presentation settings, never replay outcome.

## Handoff summary

Prioritize survival causality over combat spectacle: world-anchored telegraphs first, stable player/Gate health second, explicit non-color critical confirmation third, and normal hit decoration last. Every essential meaning needs a static visual path; sound and haptic improve feel but never determine success. This retains movement-first automatic combat, Canvas snapshot projection, determinism, offline persistence, and Abyssal canon while making the feedback system measurable rather than aesthetic-only.
